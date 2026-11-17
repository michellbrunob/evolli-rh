import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccessUser,
  Empresa,
  Prisma,
  StatusOrganizacional,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { OrganizacaoAuditoriaService } from "../organizacao-auditoria.service";
import {
  OrganizacaoAuditContext,
  ResultadoPaginado,
} from "../organizacao.types";
import { EscopoOrganizacional, resolverEscopo } from "../escopo.util";
import { podeAcessar } from "../autorizacao.util";
import { traduzirErroPrisma } from "../prisma-erro.util";
import {
  assertAindaInativo,
  assertSemFilhosAtivos,
  contarVinculosAtivosNaEmpresa,
} from "../validacao.util";
import {
  AtualizarNoOrganizacionalDto,
  CadastrarEmpresaDto,
  CriarEmpresaDto,
  ListarNosOrganizacionaisQueryDto,
} from "../dto/organizacao.dto";
import { codigosCandidatos } from "../criacao-automatica";
import { cnpjValido, normalizarCnpj } from "./cnpj";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
} from "../../common/erros/recusa-por-campo";
import {
  empresaEstaAutorizada,
  listarEmpresasAutorizadas,
  papelSelecionaEmpresa,
  papelTemPoliticaGlobal,
} from "../../auth/session/contexto-empresarial";

/** T209 — quem lê Configurações › Empresas. */
const PAPEIS_DA_LISTA_DE_EMPRESAS: readonly AccessUser["role"][] = [
  "rh",
  "dp",
  "master_tecnico",
];

/** T209 — a empresa como o cadastro a devolve (sem campos internos). */
export interface EmpresaCadastrada {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly status: StatusOrganizacional;
  readonly cnpj: string | null;
  readonly porte: string | null;
  readonly endereco: {
    readonly cep: string | null;
    readonly logradouro: string | null;
    readonly numero: string | null;
    readonly complemento: string | null;
    readonly bairro: string | null;
    readonly cidade: string | null;
    readonly uf: string | null;
  };
}

/** T209 — uma linha de Configurações › Empresas. */
export interface EmpresaDaConta {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly cnpj: string | null;
  readonly porte: string | null;
  readonly cep: string | null;
  readonly logradouro: string | null;
  readonly numero: string | null;
  readonly complemento: string | null;
  readonly bairro: string | null;
  readonly cidade: string | null;
  readonly uf: string | null;
  /** A empresa da conta: a primeira, que não pode ser removida. */
  readonly principal: boolean;
  /** Vínculos ativos (colaboradores ativos) na empresa. */
  readonly colaboradoresAtivos: number;
}

function comoCadastrada(e: Empresa): EmpresaCadastrada {
  return {
    id: e.id,
    codigo: e.codigo,
    nome: e.nome,
    status: e.status,
    cnpj: e.cnpj,
    porte: e.porte,
    endereco: {
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cidade: e.cidade,
      uf: e.uf,
    },
  };
}

/** Conflito de unicidade do Prisma no campo dado. */
function violouUnico(erro: unknown, campo: string): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002" &&
    JSON.stringify(erro.meta?.target ?? "").includes(campo)
  );
}

/**
 * Empresa — raiz do escopo organizacional (spec §3.1). Não existe entidade
 * acima dela nesta fatia, e `empresaId` é a única fronteira de autorização
 * (ADR 0005 decisão 3; Baseline V1 item 2).
 *
 * Sem CNPJ: DP-4 continua pendente de DPO/jurídico (spec §7).
 */
@Injectable()
export class EmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: OrganizacaoAuditoriaService,
  ) {}

  async criar(
    dto: CriarEmpresaDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    if (!escopo.global) {
      // Defesa em profundidade: o avaliador RBAC/ABAC já nega criação de
      // empresa a papel escopado, porque a empresa criada nunca é "a própria".
      throw new ForbiddenException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const criada = await tx.empresa.create({
          data: { codigo: dto.codigo, nome: dto.nome },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_empresa_criada",
          "empresa",
          criada.id,
          criada.id,
        );

        return criada;
      });
    } catch (error) {
      traduzirErroPrisma(error);
    }
  }

  /**
   * T209 — Nova empresa (Configurações › Empresas), por decisão da
   * proprietária (2026-11-17): RH e master técnico criam. O código sai do
   * nome; o CNPJ é conferido aqui (verificadores) e é único entre todas as
   * empresas. Quem cria pelo RH recebe a concessão da empresa nova na MESMA
   * transação (autor e data na própria concessão), e passa a poder trocar
   * para ela; o master já tem política global e não precisa de concessão.
   */
  async cadastrar(
    dto: CadastrarEmpresaDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<EmpresaCadastrada> {
    const ator = ctx.actor;
    if (!papelSelecionaEmpresa(ator.role)) throw new ForbiddenException();

    const cnpj = normalizarCnpj(dto.cnpj);
    if (cnpj === null || !cnpjValido(cnpj)) {
      throw new CamposRecusadosException([
        { campo: "cnpj", motivo: "invalido" },
      ]);
    }
    const conflito = () =>
      new ConflitoDeCamposException([{ campo: "cnpj", motivo: "em_uso" }]);
    if (
      await this.prisma.empresa.findUnique({
        where: { cnpj },
        select: { id: true },
      })
    ) {
      throw conflito();
    }

    const candidatos = codigosCandidatos(dto.nome, "EMP");
    const usados = new Set(
      (
        await this.prisma.empresa.findMany({
          where: { codigo: { in: candidatos } },
          select: { codigo: true },
        })
      ).map((e) => e.codigo),
    );
    const livres = candidatos.filter((c) => !usados.has(c));
    if (livres.length === 0) throw new ConflictException();

    const endereco = dto.endereco ?? {};
    for (const codigo of livres) {
      try {
        const criada = await this.prisma.$transaction(async (tx) => {
          const empresa = await tx.empresa.create({
            data: {
              codigo,
              nome: dto.nome,
              cnpj,
              porte: dto.porte ?? null,
              cep: endereco.cep ?? null,
              logradouro: endereco.logradouro ?? null,
              numero: endereco.numero ?? null,
              complemento: endereco.complemento ?? null,
              bairro: endereco.bairro ?? null,
              cidade: endereco.cidade ?? null,
              uf: endereco.uf ?? null,
            },
          });
          if (!papelTemPoliticaGlobal(ator.role)) {
            await tx.accessUserEmpresa.create({
              data: {
                userId: ator.id,
                empresaId: empresa.id,
                concedidoPorUserId: ator.id,
              },
            });
          }
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "organizacao_empresa_criada",
            "empresa",
            empresa.id,
            empresa.id,
          );
          return empresa;
        });
        return comoCadastrada(criada);
      } catch (erro) {
        if (violouUnico(erro, "cnpj")) throw conflito();
        // Código tomado por outra criação ao mesmo tempo: tenta o próximo.
        if (violouUnico(erro, "codigo")) continue;
        throw erro;
      }
    }
    throw new ConflictException();
  }

  /**
   * T209 — editar a empresa pelo painel lateral de Configurações › Empresas.
   * Mesmo contrato do cadastro (nome, CNPJ, porte e endereço, substituídos
   * por inteiro); só RH e master técnico; só empresa que a conta alcança —
   * fora dela, 404, igual à inexistente (anti-enumeração). O código não muda.
   */
  async atualizarCadastro(
    empresaId: string,
    dto: CadastrarEmpresaDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<EmpresaCadastrada> {
    const ator = ctx.actor as AccessUser & {
      readonly contaEmpresaId?: string | null;
    };
    if (!papelSelecionaEmpresa(ator.role)) throw new ForbiddenException();
    const conta =
      ator.contaEmpresaId !== undefined ? ator.contaEmpresaId : ator.companyId;
    const autorizada = await empresaEstaAutorizada(
      this.prisma,
      { id: ator.id, role: ator.role, companyId: conta },
      empresaId,
    );
    if (!autorizada) throw new NotFoundException();

    const cnpj = normalizarCnpj(dto.cnpj);
    if (cnpj === null || !cnpjValido(cnpj)) {
      throw new CamposRecusadosException([
        { campo: "cnpj", motivo: "invalido" },
      ]);
    }
    const conflito = () =>
      new ConflitoDeCamposException([{ campo: "cnpj", motivo: "em_uso" }]);
    const dono = await this.prisma.empresa.findUnique({
      where: { cnpj },
      select: { id: true },
    });
    if (dono && dono.id !== empresaId) throw conflito();

    const endereco = dto.endereco ?? {};
    try {
      const atualizada = await this.prisma.$transaction(async (tx) => {
        const empresa = await tx.empresa.update({
          where: { id: empresaId },
          data: {
            nome: dto.nome,
            cnpj,
            porte: dto.porte ?? null,
            cep: endereco.cep ?? null,
            logradouro: endereco.logradouro ?? null,
            numero: endereco.numero ?? null,
            complemento: endereco.complemento ?? null,
            bairro: endereco.bairro ?? null,
            cidade: endereco.cidade ?? null,
            uf: endereco.uf ?? null,
          },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "organizacao_empresa_atualizada",
          "empresa",
          empresa.id,
          empresa.id,
        );
        return empresa;
      });
      return comoCadastrada(atualizada);
    } catch (erro) {
      if (violouUnico(erro, "cnpj")) throw conflito();
      throw erro;
    }
  }

  /**
   * T209 — Configurações › Empresas: as empresas que esta conta alcança, a
   * principal (a da conta) primeiro. Papel que não troca de empresa vê só a
   * própria. Nenhuma consulta sai do que `listarEmpresasAutorizadas` já
   * autoriza.
   */
  async listarDaConta(
    ator: AccessUser & { readonly contaEmpresaId?: string | null },
  ): Promise<EmpresaDaConta[]> {
    // Só os papéis que têm Configurações › Empresas (RH, DP e master
    // técnico): os demais não precisam da contagem de ativos nem do
    // endereço da empresa.
    if (!PAPEIS_DA_LISTA_DE_EMPRESAS.includes(ator.role)) {
      throw new ForbiddenException();
    }
    const conta =
      ator.contaEmpresaId !== undefined ? ator.contaEmpresaId : ator.companyId;
    const usuario = { id: ator.id, role: ator.role, companyId: conta };
    const ids = papelSelecionaEmpresa(ator.role)
      ? (await listarEmpresasAutorizadas(this.prisma, usuario)).map((e) => e.id)
      : conta !== null
        ? [conta]
        : [];
    if (ids.length === 0) return [];

    const empresas = await this.prisma.empresa.findMany({
      where: { id: { in: ids }, status: StatusOrganizacional.ativo },
      orderBy: { codigo: "asc" },
    });
    const contagens = await Promise.all(
      empresas.map((e) => contarVinculosAtivosNaEmpresa(this.prisma, e.id)),
    );
    const itens = empresas.map((e, i) => ({
      id: e.id,
      codigo: e.codigo,
      nome: e.nome,
      cnpj: e.cnpj,
      porte: e.porte,
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cidade: e.cidade,
      uf: e.uf,
      principal: e.id === conta,
      colaboradoresAtivos: contagens[i]!,
    }));
    return [
      ...itens.filter((e) => e.principal),
      ...itens.filter((e) => !e.principal),
    ];
  }

  async listar(
    query: ListarNosOrganizacionaisQueryDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<ResultadoPaginado<Empresa>> {
    const escopo = resolverEscopo(ctx.actor);

    const where: Prisma.EmpresaWhereInput = {
      ...this.filtroDeEscopo(escopo),
      ...(query.status ? { status: query.status } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.empresa.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente (spec §10).
        orderBy: { codigo: "asc" },
        skip: (query.pagina - 1) * query.tamanhoPagina,
        take: query.tamanhoPagina,
      }),
      this.prisma.empresa.count({ where }),
    ]);

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "estrutura_organizacional",
      null,
      null,
    );

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
    };
  }

  async detalhar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(empresaId, ctx, escopo, "read");

    await this.auditoria.registrarConsultaAmpla(
      escopo,
      ctx,
      "empresa",
      empresa.id,
      empresa.id,
    );

    return empresa;
  }

  async atualizar(
    empresaId: string,
    dto: AtualizarNoOrganizacionalDto,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    await this.carregarNoEscopo(empresaId, ctx, escopo, "alter");

    return this.prisma.$transaction(async (tx) => {
      // Só `nome`: `codigo` é imutável (R1) e a empresa de uma entidade é
      // imutável (R7).
      const atualizada = await tx.empresa.update({
        where: { id: empresaId },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_atualizada",
        "empresa",
        atualizada.id,
        atualizada.id,
      );

      return atualizada;
    });
  }

  async inativar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(
      empresaId,
      ctx,
      escopo,
      "manage",
    );

    if (empresa.status === StatusOrganizacional.inativo) {
      // Inativar o que já está inativo é conflito, não no-op silencioso —
      // evita evento de auditoria sem alteração correspondente.
      throw new ConflictException();
    }

    await this.assertSemFilhosAtivos(empresaId);
    // RI-O1 (Fatia 2): alocacao vigente de vinculo ativo tambem bloqueia.
    // Mesma regra da ADR 0006 d.7 aplicada a uma classe nova de dependente
    // — bloqueia, nunca cascateia. A recusa nao revela o dependente.
    assertSemFilhosAtivos(
      await contarVinculosAtivosNaEmpresa(this.prisma, empresa.id),
    );

    return this.prisma.$transaction(async (tx) => {
      const inativada = await tx.empresa.update({
        where: { id: empresaId },
        data: { status: StatusOrganizacional.inativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_inativada",
        "empresa",
        inativada.id,
        inativada.id,
      );

      return inativada;
    });
  }

  /**
   * R-INA-5: reativação é operação explícita e auditada.
   *
   * `Empresa` é a raiz — não tem pai a validar. Não reclassifica, não altera
   * `codigo`, empresa ou qualquer relação: só a transição de status.
   */
  async reativar(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
  ): Promise<Empresa> {
    const escopo = resolverEscopo(ctx.actor);
    const empresa = await this.carregarNoEscopo(
      empresaId,
      ctx,
      escopo,
      "manage",
    );
    assertAindaInativo(empresa.status);

    return this.prisma.$transaction(async (tx) => {
      const reativada = await tx.empresa.update({
        where: { id: empresa.id },
        data: { status: StatusOrganizacional.ativo },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "organizacao_empresa_reativada",
        "empresa",
        reativada.id,
        reativada.id,
      );

      return reativada;
    });
  }

  /**
   * Para `Empresa` o escopo incide sobre o próprio `id`: um ator escopado só
   * alcança a empresa à qual pertence.
   */
  private filtroDeEscopo(
    escopo: EscopoOrganizacional,
  ): Prisma.EmpresaWhereInput {
    return escopo.global ? {} : { id: escopo.empresaId };
  }

  /**
   * Carrega a empresa **já restrita ao escopo do ator**. Inexistente e fora do
   * escopo produzem a mesma resposta 404 — confirmar a existência permitiria
   * enumeração (spec §10).
   */
  private async carregarNoEscopo(
    empresaId: string,
    ctx: OrganizacaoAuditContext,
    escopo: EscopoOrganizacional,
    action: "read" | "alter" | "manage",
  ): Promise<Empresa> {
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: empresaId, ...this.filtroDeEscopo(escopo) },
    });

    if (!empresa) {
      // Inexistente e fora do escopo respondem igual (404), mas a tentativa
      // fica registrada como `denied` na trilha (spec §9/§10).
      return this.auditoria.negarAcesso(ctx, "empresa", empresaId, null);
    }

    // Fase 2 da autorização, com a empresa resolvida — defesa em profundidade
    // sobre o filtro já aplicado na consulta.
    if (!podeAcessar(ctx.actor, "empresa", action, empresa.id)) {
      return this.auditoria.negarAcesso(ctx, "empresa", empresa.id, empresa.id);
    }

    return empresa;
  }

  /**
   * R-INA-2 (Baseline V1, item 7): inativação é **bloqueada** quando existe
   * elemento ativo vinculado. Nunca há cascata, em nenhuma hipótese.
   *
   * `Area` não é contada aqui: ela pende de um departamento, e departamento
   * ativo já bloqueia. Para todo departamento estar inativo, suas áreas já
   * precisaram estar inativas (ver `DepartamentoService`).
   */
  private async assertSemFilhosAtivos(empresaId: string): Promise<void> {
    const status = StatusOrganizacional.ativo;
    const [unidades, departamentos, equipes, cargos, centrosCusto] =
      await Promise.all([
        this.prisma.unidadeOrganizacional.count({
          where: { empresaId, status },
        }),
        this.prisma.departamento.count({ where: { empresaId, status } }),
        this.prisma.equipe.count({ where: { empresaId, status } }),
        this.prisma.cargo.count({ where: { empresaId, status } }),
        this.prisma.centroCusto.count({ where: { empresaId, status } }),
      ]);

    if (unidades + departamentos + equipes + cargos + centrosCusto > 0) {
      throw new ConflictException();
    }
  }
}
