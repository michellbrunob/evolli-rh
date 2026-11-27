import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, TipoVinculo } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CamposRecusadosException } from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import {
  type Dia,
  STATUS_QUE_OCUPAM,
  dataDoDia,
  diaDe,
  hojeEmSaoPaulo,
} from "./calculo-ausencias";
import {
  type RegrasDaPolitica,
  type ViolacaoDaPolitica,
  incoerenciasDaPolitica,
  principaisRegras,
  violacoesDaPolitica,
} from "./politica-ferias";
import type { PoliticaFeriasDto } from "./politicas-ferias.dto";

export interface AlvoDaPolitica {
  tipo: "departamento" | "unidade" | "pessoa";
  id: string;
}

export interface AprovacaoDaPolitica {
  quem: "rh" | "gestor_rh" | "gestor";
  lembreteDias: number | null;
  foraDaPolitica: "avisar" | "bloquear";
}

/** A política como a tela a recebe (detalhe, para editar ou duplicar). */
export interface PoliticaFeriasApi {
  id: string;
  nome: string;
  descricao: string | null;
  textoColaborador: string | null;
  tiposVinculo: TipoVinculo[];
  abrangencia: "todos" | "algumas";
  alvos: (AlvoDaPolitica & { nome: string })[];
  valeAPartirDe: Dia;
  regras: RegrasDaPolitica;
  aprovacao: AprovacaoDaPolitica;
  rascunho: boolean;
  ativa: boolean;
}

/** Uma linha da lista ("Vale para", "Principais regras", "Quando não seguir"). */
export interface LinhaDePoliticaApi {
  id: string;
  nome: string;
  ativa: boolean;
  rascunho: boolean;
  tiposVinculo: TipoVinculo[];
  abrangencia: "todos" | "algumas";
  pessoas: number;
  principaisRegras: { primeira: string; segunda: string | null; mais: number };
  foraDaPolitica: "avisar" | "bloquear";
}

export interface ListaDePoliticasApi {
  politicas: LinhaDePoliticaApi[];
  semPolitica: {
    total: number;
    pessoas: { id: string; nome: string; contrato: TipoVinculo }[];
  };
}

/** A pessoa como a política a enxerga: contrato e lotação vigente. */
interface PessoaDaPolitica {
  colaboradorId: string;
  tipo: TipoVinculo;
  departamentoId: string | null;
  unidadeId: string | null;
}

type LinhaDaPolitica = Prisma.PoliticaFeriasGetPayload<object>;

/**
 * A política que vale para a pessoa: só as ativas, prontas e já em vigor, do
 * contrato dela; a mais específica (pessoa, depois departamento ou unidade,
 * por último o contrato); no empate, a mais recente.
 */
export function politicaDaPessoa(
  politicas: readonly LinhaDaPolitica[],
  pessoa: PessoaDaPolitica,
  hoje: Dia,
): LinhaDaPolitica | null {
  let melhor: { p: LinhaDaPolitica; peso: number } | null = null;
  for (const p of politicas) {
    if (!p.ativa || p.rascunho || diaDe(p.valeAPartirDe) > hoje) continue;
    if (!p.tiposVinculo.includes(pessoa.tipo)) continue;
    let peso = 0;
    if (p.abrangencia === "todos") peso = 1;
    else {
      const alvos = p.alvos as unknown as AlvoDaPolitica[];
      if (
        alvos.some((a) => a.tipo === "pessoa" && a.id === pessoa.colaboradorId)
      ) {
        peso = 3;
      } else if (
        alvos.some(
          (a) =>
            (a.tipo === "departamento" && a.id === pessoa.departamentoId) ||
            (a.tipo === "unidade" && a.id === pessoa.unidadeId),
        )
      ) {
        peso = 2;
      }
    }
    if (peso === 0) continue;
    if (
      !melhor ||
      peso > melhor.peso ||
      (peso === melhor.peso && p.criadoEm > melhor.p.criadoEm)
    ) {
      melhor = { p, peso };
    }
  }
  return melhor?.p ?? null;
}

/**
 * T215 — Políticas de férias da empresa ativa (como a referência): lista
 * (com quem fica sem política), detalhe, criar, alterar, desativar e
 * reativar; e a conferência de um pedido de férias contra a política da
 * pessoa. `rh` e `dp` escrevem; o `master_tecnico` só lê. Nada se apaga.
 */
@Injectable()
export class PoliticasFeriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  private empresaDaSessao(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita",
  ): string {
    const papel = ctx.actor.role;
    const permitido =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!permitido || ctx.actor.companyId === null) {
      throw new ForbiddenException();
    }
    return ctx.actor.companyId;
  }

  /** As pessoas ativas da empresa, com contrato e lotação vigente. */
  private async pessoasAtivas(
    db: Prisma.TransactionClient,
    empresaId: string,
  ): Promise<(PessoaDaPolitica & { nome: string })[]> {
    const vinculos = await db.vinculoFuncional.findMany({
      where: { empresaId, situacao: "ativo" },
      select: {
        tipo: true,
        colaborador: { select: { id: true, nome: true } },
        alocacoes: {
          where: { vigenteAte: null },
          select: { departamentoId: true, unidadeOrganizacionalId: true },
          take: 1,
        },
      },
      orderBy: { colaborador: { nome: "asc" } },
    });
    const vistos = new Set<string>();
    const pessoas: (PessoaDaPolitica & { nome: string })[] = [];
    for (const v of vinculos) {
      if (vistos.has(v.colaborador.id)) continue;
      vistos.add(v.colaborador.id);
      pessoas.push({
        colaboradorId: v.colaborador.id,
        nome: v.colaborador.nome,
        tipo: v.tipo,
        departamentoId: v.alocacoes[0]?.departamentoId ?? null,
        unidadeId: v.alocacoes[0]?.unidadeOrganizacionalId ?? null,
      });
    }
    return pessoas;
  }

  async listar(ctx: PessoasAuditContext): Promise<ListaDePoliticasApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const hoje = hojeEmSaoPaulo();
    const [politicas, pessoas] = await Promise.all([
      this.prisma.politicaFerias.findMany({
        where: { empresaId },
        orderBy: { criadoEm: "asc" },
      }),
      this.pessoasAtivas(this.prisma, empresaId),
    ]);
    const contagem = new Map<string, number>();
    const sem: ListaDePoliticasApi["semPolitica"]["pessoas"] = [];
    for (const pessoa of pessoas) {
      const p = politicaDaPessoa(politicas, pessoa, hoje);
      if (p) contagem.set(p.id, (contagem.get(p.id) ?? 0) + 1);
      else {
        sem.push({
          id: pessoa.colaboradorId,
          nome: pessoa.nome,
          contrato: pessoa.tipo,
        });
      }
    }
    return {
      politicas: politicas.map((p) => ({
        id: p.id,
        nome: p.nome,
        ativa: p.ativa,
        rascunho: p.rascunho,
        tiposVinculo: p.tiposVinculo,
        abrangencia: p.abrangencia,
        pessoas: contagem.get(p.id) ?? 0,
        principaisRegras: principaisRegras(
          p.regras as unknown as RegrasDaPolitica,
        ),
        foraDaPolitica: (p.aprovacao as unknown as AprovacaoDaPolitica)
          .foraDaPolitica,
      })),
      semPolitica: { total: sem.length, pessoas: sem },
    };
  }

  async obter(
    politicaId: string,
    ctx: PessoasAuditContext,
  ): Promise<PoliticaFeriasApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const p = await this.prisma.politicaFerias.findFirst({
      where: { id: politicaId, empresaId },
    });
    if (!p) {
      return this.auditoria.negarAcesso(
        ctx,
        "politica_ferias",
        politicaId,
        empresaId,
      );
    }
    return this.paraApi(p, empresaId);
  }

  async criar(
    dto: PoliticaFeriasDto,
    ctx: PessoasAuditContext,
  ): Promise<PoliticaFeriasApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    this.conferirForma(dto);
    const criada = await this.prisma.$transaction(async (tx) => {
      await this.conferirAlvos(tx, dto, empresaId);
      const p = await tx.politicaFerias.create({
        data: {
          empresaId,
          ...this.dados(dto),
          criadoPorId: ctx.actor.id,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_politica_ferias_criada",
        "politica_ferias",
        p.id,
        empresaId,
      );
      return p;
    });
    return this.paraApi(criada, empresaId);
  }

  async alterar(
    politicaId: string,
    dto: PoliticaFeriasDto,
    ctx: PessoasAuditContext,
  ): Promise<PoliticaFeriasApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    this.conferirForma(dto);
    const alterada = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.politicaFerias.findFirst({
        where: { id: politicaId, empresaId },
        select: { id: true },
      });
      if (!atual) {
        return this.auditoria.negarAcesso(
          ctx,
          "politica_ferias",
          politicaId,
          empresaId,
        );
      }
      await this.conferirAlvos(tx, dto, empresaId);
      const p = await tx.politicaFerias.update({
        where: { id: atual.id },
        data: this.dados(dto),
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_politica_ferias_alterada",
        "politica_ferias",
        p.id,
        empresaId,
      );
      return p;
    });
    return this.paraApi(alterada, empresaId);
  }

  async mudarSituacao(
    politicaId: string,
    ativa: boolean,
    ctx: PessoasAuditContext,
  ): Promise<PoliticaFeriasApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const p = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.politicaFerias.findFirst({
        where: { id: politicaId, empresaId },
        select: { id: true },
      });
      if (!atual) {
        return this.auditoria.negarAcesso(
          ctx,
          "politica_ferias",
          politicaId,
          empresaId,
        );
      }
      const linha = await tx.politicaFerias.update({
        where: { id: atual.id },
        data: ativa
          ? { ativa: true, desativadaEm: null, desativadaPorId: null }
          : {
              ativa: false,
              desativadaEm: new Date(),
              desativadaPorId: ctx.actor.id,
            },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        ativa
          ? "pessoas_politica_ferias_reativada"
          : "pessoas_politica_ferias_desativada",
        "politica_ferias",
        linha.id,
        empresaId,
      );
      return linha;
    });
    return this.paraApi(p, empresaId);
  }

  /**
   * Confere um pedido de férias contra a política da pessoa. Sem política,
   * `null` (para CLT, valem só os pisos da lei).
   */
  async avaliar(
    db: Prisma.TransactionClient,
    entrada: {
      empresaId: string;
      colaboradorId: string;
      tipo: TipoVinculo;
      vinculoId: string;
      inicio: Dia;
      fim: Dia;
      saldoDepois: number;
      outrasFerias: readonly { inicio: Dia; fim: Dia }[];
      ignorar: string | null;
    },
  ): Promise<{
    id: string;
    nome: string;
    violacoes: ViolacaoDaPolitica[];
  } | null> {
    const hoje = hojeEmSaoPaulo();
    const [politicas, alocacao] = await Promise.all([
      db.politicaFerias.findMany({ where: { empresaId: entrada.empresaId } }),
      db.alocacaoOrganizacional.findFirst({
        where: { vinculoId: entrada.vinculoId, vigenteAte: null },
        select: { departamentoId: true, unidadeOrganizacionalId: true },
      }),
    ]);
    const p = politicaDaPessoa(
      politicas,
      {
        colaboradorId: entrada.colaboradorId,
        tipo: entrada.tipo,
        departamentoId: alocacao?.departamentoId ?? null,
        unidadeId: alocacao?.unidadeOrganizacionalId ?? null,
      },
      hoje,
    );
    if (!p) return null;
    const regras = p.regras as unknown as RegrasDaPolitica;
    const foraNaEquipe =
      regras.foraAoMesmoTempo !== null && alocacao?.departamentoId
        ? await this.foraNaEquipe(db, {
            empresaId: entrada.empresaId,
            departamentoId: alocacao.departamentoId,
            colaboradorId: entrada.colaboradorId,
            inicio: entrada.inicio,
            fim: entrada.fim,
          })
        : 0;
    return {
      id: p.id,
      nome: p.nome,
      violacoes: violacoesDaPolitica({
        regras,
        hoje,
        inicio: entrada.inicio,
        fim: entrada.fim,
        saldoDepois: entrada.saldoDepois,
        outrasFerias: entrada.outrasFerias,
        foraNaEquipe,
      }),
    };
  }

  /** Outras pessoas do mesmo departamento de férias nessas datas. */
  private async foraNaEquipe(
    db: Prisma.TransactionClient,
    a: {
      empresaId: string;
      departamentoId: string;
      colaboradorId: string;
      inicio: Dia;
      fim: Dia;
    },
  ): Promise<number> {
    const linhas = await db.ausencia.findMany({
      where: {
        empresaId: a.empresaId,
        tipo: "ferias",
        excluidaEm: null,
        status: { in: [...STATUS_QUE_OCUPAM] },
        colaboradorId: { not: a.colaboradorId },
        inicio: { lte: dataDoDia(a.fim) },
        fim: { gte: dataDoDia(a.inicio) },
        vinculo: {
          alocacoes: {
            some: { vigenteAte: null, departamentoId: a.departamentoId },
          },
        },
      },
      select: { colaboradorId: true },
      distinct: ["colaboradorId"],
    });
    return linhas.length;
  }

  // ---- peças ---------------------------------------------------------------

  private conferirForma(dto: PoliticaFeriasDto): void {
    if (dto.abrangencia === "algumas" && dto.alvos.length === 0) {
      throw new CamposRecusadosException([
        { campo: "alvos", motivo: "obrigatorio" },
      ]);
    }
    const incoerencias = incoerenciasDaPolitica(dto.regras);
    if (incoerencias.length > 0) {
      throw new CamposRecusadosException(incoerencias);
    }
  }

  /**
   * Os alvos ("algumas") precisam ser da empresa ativa: departamento e
   * unidade dela, pessoa com vínculo nela. Outro id responde igual ao
   * inexistente (`indisponivel`), sem revelar outra empresa.
   */
  private async conferirAlvos(
    db: Prisma.TransactionClient,
    dto: PoliticaFeriasDto,
    empresaId: string,
  ): Promise<void> {
    if (dto.abrangencia !== "algumas") return;
    const ids = (tipo: AlvoDaPolitica["tipo"]) => [
      ...new Set(dto.alvos.filter((a) => a.tipo === tipo).map((a) => a.id)),
    ];
    const [deps, unidades, pessoas] = await Promise.all([
      db.departamento.count({
        where: { id: { in: ids("departamento") }, empresaId },
      }),
      db.unidadeOrganizacional.count({
        where: { id: { in: ids("unidade") }, empresaId },
      }),
      db.colaborador.count({
        where: { id: { in: ids("pessoa") }, vinculos: { some: { empresaId } } },
      }),
    ]);
    if (
      deps !== ids("departamento").length ||
      unidades !== ids("unidade").length ||
      pessoas !== ids("pessoa").length
    ) {
      throw new CamposRecusadosException([
        { campo: "alvos", motivo: "indisponivel" },
      ]);
    }
  }

  private dados(dto: PoliticaFeriasDto) {
    return {
      nome: dto.nome,
      descricao: dto.descricao ?? null,
      textoColaborador: dto.textoColaborador ?? null,
      tiposVinculo: dto.tiposVinculo,
      abrangencia: dto.abrangencia,
      alvos: (dto.abrangencia === "algumas"
        ? dto.alvos.map((a) => ({ tipo: a.tipo, id: a.id }))
        : []) as unknown as Prisma.InputJsonValue,
      valeAPartirDe: dataDoDia(dto.valeAPartirDe),
      regras: { ...dto.regras } as unknown as Prisma.InputJsonValue,
      aprovacao: { ...dto.aprovacao } as unknown as Prisma.InputJsonValue,
      rascunho: dto.rascunho ?? false,
    };
  }

  /** O detalhe, com o nome de cada alvo (departamento, unidade ou pessoa). */
  private async paraApi(
    p: LinhaDaPolitica,
    empresaId: string,
  ): Promise<PoliticaFeriasApi> {
    const alvos = p.alvos as unknown as AlvoDaPolitica[];
    const ids = (tipo: AlvoDaPolitica["tipo"]) =>
      alvos.filter((a) => a.tipo === tipo).map((a) => a.id);
    const [deps, unidades, pessoas] = await Promise.all([
      this.prisma.departamento.findMany({
        where: { id: { in: ids("departamento") }, empresaId },
        select: { id: true, nome: true },
      }),
      this.prisma.unidadeOrganizacional.findMany({
        where: { id: { in: ids("unidade") }, empresaId },
        select: { id: true, nome: true },
      }),
      // Só quem tem vínculo na empresa: nunca o nome de outra empresa.
      this.prisma.colaborador.findMany({
        where: { id: { in: ids("pessoa") }, vinculos: { some: { empresaId } } },
        select: { id: true, nome: true },
      }),
    ]);
    const nomes = new Map<string, string>(
      [...deps, ...unidades, ...pessoas].map((x) => [x.id, x.nome]),
    );
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      textoColaborador: p.textoColaborador,
      tiposVinculo: p.tiposVinculo,
      abrangencia: p.abrangencia,
      alvos: alvos.map((a) => ({ ...a, nome: nomes.get(a.id) ?? "—" })),
      valeAPartirDe: diaDe(p.valeAPartirDe),
      regras: p.regras as unknown as RegrasDaPolitica,
      aprovacao: p.aprovacao as unknown as AprovacaoDaPolitica,
      rascunho: p.rascunho,
      ativa: p.ativa,
    };
  }
}
