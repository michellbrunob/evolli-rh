import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  AcaoDadosPessoais,
  AuditAction,
  AuditResult,
  CampoDadosPessoais,
  CategoriaDadosPessoais,
  Prisma,
  ResultadoEventoDadosPessoais,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { podeAcessarPessoas } from "../escopo-pessoas.util";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { PessoasAuditContext } from "../pessoas.types";
import {
  EnderecoDto,
  PerfilPessoalDto,
  RegistrarDadosPessoaisDto,
} from "./dados-pessoais.dto";
import {
  CAMPOS_ENDERECO,
  CAMPOS_PERFIL,
  ChaveEndereco,
  ChavePerfil,
} from "./normalizacao-dados-pessoais.util";

/**
 * Valores do perfil como a API devolve. Data em dia civil `AAAA-MM-DD`,
 * obrigatória; os demais campos, opcionais, podem vir `null`.
 */
export type ValoresPerfil = {
  [K in Exclude<ChavePerfil, "dataNascimento">]: string | null;
} & {
  dataNascimento: string;
  atualizadoEm: Date;
};

export type ValoresEndereco = { [K in ChaveEndereco]: string | null } & {
  atualizadoEm: Date;
};

/**
 * - `sem_registro` — nenhuma das duas categorias gravada. É o estado de todo
 *   colaborador admitido antes desta fatia; nunca é erro.
 * - `registrado` — ao menos uma categoria gravada.
 * - `bloqueado` — nenhum vínculo na empresa segue previsto ou ativo: o uso
 *   operacional é bloqueado após o desligamento, como nos contatos.
 */
export type SituacaoDadosPessoais = "sem_registro" | "registrado" | "bloqueado";

export interface DadosPessoaisDoColaborador {
  colaboradorId: string;
  empresaId: string;
  situacao: SituacaoDadosPessoais;
  perfilPessoal: ValoresPerfil | null;
  endereco: ValoresEndereco | null;
}

/** Colaborador no escopo, com a empresa resolvida pelo vínculo. */
export interface AlvoDadosPessoais {
  colaboradorId: string;
  empresaId: string;
}

/**
 * Resultado da resolução do alvo:
 *
 * - `resolvido` — a empresa REAL do colaborador está decidida.
 * - `ambiguo` — `master_tecnico` sem empresa ativa diante de colaborador com
 *   vínculo em mais de uma empresa. NENHUMA empresa foi resolvida, então nada
 *   é lido nem gravado: a tentativa fica na trilha, sem empresa, e a resposta é
 *   409 — a empresa se escolhe pelo contexto ativo (T163), como nos contatos.
 */
type AlvoResolucao =
  | { tipo: "resolvido"; alvo: AlvoDadosPessoais; operacional: boolean }
  | { tipo: "ambiguo"; colaboradorId: string };

interface Evento {
  categoria: CategoriaDadosPessoais;
  registroId: string | null;
  acao: AcaoDadosPessoais;
  resultado: ResultadoEventoDadosPessoais;
  campos: readonly CampoDadosPessoais[];
  auditAction: AuditAction;
  auditResult: AuditResult;
}

const PROJECAO_PERFIL = {
  id: true,
  dataNascimento: true,
  sexo: true,
  saudacao: true,
  estadoCivil: true,
  nacionalidade: true,
  naturalidade: true,
  escolaridade: true,
  curso: true,
  nomePai: true,
  nomeMae: true,
  atualizadoEm: true,
} as const satisfies Prisma.PerfilPessoalColaboradorSelect;

const PROJECAO_ENDERECO = {
  id: true,
  pais: true,
  cep: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  cidade: true,
  estado: true,
  atualizadoEm: true,
} as const satisfies Prisma.EnderecoColaboradorSelect;

type PerfilProjetado = Prisma.PerfilPessoalColaboradorGetPayload<{
  select: typeof PROJECAO_PERFIL;
}>;
type EnderecoProjetado = Prisma.EnderecoColaboradorGetPayload<{
  select: typeof PROJECAO_ENDERECO;
}>;

const TODOS_PERFIL: readonly CampoDadosPessoais[] = CAMPOS_PERFIL.map(
  ([, campo]) => campo,
);
const TODOS_ENDERECO: readonly CampoDadosPessoais[] = CAMPOS_ENDERECO.map(
  ([, campo]) => campo,
);

const AS_DUAS_CATEGORIAS: readonly CategoriaDadosPessoais[] = [
  "perfil_pessoal",
  "endereco",
];

/** Dia civil `AAAA-MM-DD` de uma coluna `@db.Date`, sem fuso no caminho. */
function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** O perfil como a API devolve, sem o id do registro. */
function valoresPerfil(p: PerfilProjetado): ValoresPerfil {
  return {
    dataNascimento: diaCivil(p.dataNascimento),
    sexo: p.sexo,
    saudacao: p.saudacao,
    estadoCivil: p.estadoCivil,
    nacionalidade: p.nacionalidade,
    naturalidade: p.naturalidade,
    escolaridade: p.escolaridade,
    curso: p.curso,
    nomePai: p.nomePai,
    nomeMae: p.nomeMae,
    atualizadoEm: p.atualizadoEm,
  };
}

function valoresEndereco(e: EnderecoProjetado): ValoresEndereco {
  return {
    pais: e.pais,
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    estado: e.estado,
    atualizadoEm: e.atualizadoEm,
  };
}

/**
 * Bloco do perfil completo, com ausente como `null` (o PUT substitui). A data
 * de nascimento é obrigatória no DTO, então nunca sai `null` daqui.
 */
export function perfilCompleto(dto: PerfilPessoalDto): {
  [K in Exclude<ChavePerfil, "dataNascimento">]: string | null;
} & { dataNascimento: string } {
  return {
    dataNascimento: dto.dataNascimento,
    sexo: dto.sexo ?? null,
    saudacao: dto.saudacao ?? null,
    estadoCivil: dto.estadoCivil ?? null,
    nacionalidade: dto.nacionalidade ?? null,
    naturalidade: dto.naturalidade ?? null,
    escolaridade: dto.escolaridade ?? null,
    curso: dto.curso ?? null,
    nomePai: dto.nomePai ?? null,
    nomeMae: dto.nomeMae ?? null,
  };
}

export function enderecoCompleto(dto: EnderecoDto): {
  [K in ChaveEndereco]: string | null;
} {
  return {
    pais: dto.pais ?? null,
    cep: dto.cep ?? null,
    logradouro: dto.logradouro ?? null,
    numero: dto.numero ?? null,
    complemento: dto.complemento ?? null,
    bairro: dto.bairro ?? null,
    cidade: dto.cidade ?? null,
    estado: dto.estado ?? null,
  };
}

/** Campos com valor — os que uma CRIAÇÃO grava. Só os nomes. */
export function camposPreenchidos<K extends string>(
  valores: { [P in K]: string | null },
  mapa: readonly (readonly [K, CampoDadosPessoais])[],
): CampoDadosPessoais[] {
  return mapa.filter(([chave]) => valores[chave] !== null).map(([, c]) => c);
}

/** Campos cujo valor mudou — os que uma EDIÇÃO grava. Só os nomes. */
export function camposAlterados<K extends string>(
  atual: { [P in K]: string | null },
  novo: { [P in K]: string | null },
  mapa: readonly (readonly [K, CampoDadosPessoais])[],
): CampoDadosPessoais[] {
  return mapa
    .filter(([chave]) => atual[chave] !== novo[chave])
    .map(([, c]) => c);
}

function dadosDoPerfil(
  valores: { [K in Exclude<ChavePerfil, "dataNascimento">]: string | null } & {
    dataNascimento: string;
  },
) {
  return {
    ...valores,
    dataNascimento: new Date(`${valores.dataNascimento}T00:00:00.000Z`),
  };
}

function eUnicidadeVioladaNoBanco(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

/**
 * Dados pessoais e endereço do colaborador (T177, Módulo 1 do cadastro) —
 * agregados próprios, fora de `Colaborador`, por colaborador e empresa.
 *
 * Toda operação resolve no servidor a empresa REAL do colaborador pelo
 * vínculo. `rh` e `dp` atuam na empresa ativa da sessão; `master_tecnico`
 * (Emenda 2 da ADR 0012) também, quando tem empresa ativa, e em qualquer
 * empresa quando não tem — sempre a do vínculo, auditada com ela. Nenhum id
 * de empresa vem do navegador.
 *
 * TRILHA DE TODA OPERAÇÃO, uma por categoria, na MESMA transação do dado:
 * `audit_event` (ação, ator, empresa, id do colaborador) e
 * `dados_pessoais_colaborador_evento` (categoria, resultado e NOMES dos
 * campos). Nenhum valor pessoal entra em nenhuma das duas.
 */
@Injectable()
export class DadosPessoaisColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async consultar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<DadosPessoaisDoColaborador> {
    const resolucao = await this.resolverAlvo(colaboradorId, ctx, "read");
    if (resolucao.tipo === "ambiguo") {
      await this.registrarAmbiguidade(
        ctx,
        resolucao.colaboradorId,
        "leitura",
        AS_DUAS_CATEGORIAS,
      );
      throw new ConflictException();
    }
    const { alvo, operacional } = resolucao;

    return this.prisma.$transaction(async (tx) => {
      if (!operacional) {
        const ids = await this.idsDosRegistros(tx, alvo);
        await this.registrarEvento(tx, ctx, alvo, {
          categoria: "perfil_pessoal",
          registroId: ids.perfilId,
          acao: "leitura",
          resultado: "bloqueado",
          campos: [],
          auditAction: "pessoas_dados_pessoais_consultados",
          auditResult: "success",
        });
        await this.registrarEvento(tx, ctx, alvo, {
          categoria: "endereco",
          registroId: ids.enderecoId,
          acao: "leitura",
          resultado: "bloqueado",
          campos: [],
          auditAction: "pessoas_dados_pessoais_consultados",
          auditResult: "success",
        });
        return this.resposta(alvo, "bloqueado", null, null);
      }

      const perfil = await tx.perfilPessoalColaborador.findUnique({
        where: { colaboradorId_empresaId: alvo },
        select: PROJECAO_PERFIL,
      });
      const endereco = await tx.enderecoColaborador.findUnique({
        where: { colaboradorId_empresaId: alvo },
        select: PROJECAO_ENDERECO,
      });

      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "perfil_pessoal",
        registroId: perfil?.id ?? null,
        acao: "leitura",
        resultado: perfil ? "valores_devolvidos" : "sem_registro",
        campos: perfil ? TODOS_PERFIL : [],
        auditAction: "pessoas_dados_pessoais_consultados",
        auditResult: "success",
      });
      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "endereco",
        registroId: endereco?.id ?? null,
        acao: "leitura",
        resultado: endereco ? "valores_devolvidos" : "sem_registro",
        campos: endereco ? TODOS_ENDERECO : [],
        auditAction: "pessoas_dados_pessoais_consultados",
        auditResult: "success",
      });

      return this.resposta(
        alvo,
        perfil || endereco ? "registrado" : "sem_registro",
        perfil ? valoresPerfil(perfil) : null,
        endereco ? valoresEndereco(endereco) : null,
      );
    });
  }

  async registrar(
    colaboradorId: string,
    dto: RegistrarDadosPessoaisDto,
    ctx: PessoasAuditContext,
  ): Promise<DadosPessoaisDoColaborador> {
    if (!dto.perfilPessoal && !dto.endereco) {
      throw new BadRequestException();
    }
    const resolucao = await this.resolverAlvo(colaboradorId, ctx, "alter");
    if (resolucao.tipo === "ambiguo") {
      await this.registrarAmbiguidade(
        ctx,
        resolucao.colaboradorId,
        "edicao",
        AS_DUAS_CATEGORIAS.filter((c) =>
          c === "perfil_pessoal" ? dto.perfilPessoal : dto.endereco,
        ),
      );
      throw new ConflictException();
    }
    const { alvo, operacional } = resolucao;

    if (!operacional) {
      // Tentativa registrada ANTES da recusa, como nos contatos.
      await this.prisma.$transaction(async (tx) => {
        const ids = await this.idsDosRegistros(tx, alvo);
        if (dto.perfilPessoal) {
          await this.registrarEvento(tx, ctx, alvo, {
            categoria: "perfil_pessoal",
            registroId: ids.perfilId,
            acao: "edicao",
            resultado: "bloqueado",
            campos: [],
            auditAction: "pessoas_dados_pessoais_atualizados",
            auditResult: "failure",
          });
        }
        if (dto.endereco) {
          await this.registrarEvento(tx, ctx, alvo, {
            categoria: "endereco",
            registroId: ids.enderecoId,
            acao: "edicao",
            resultado: "bloqueado",
            campos: [],
            auditAction: "pessoas_dados_pessoais_atualizados",
            auditResult: "failure",
          });
        }
      });
      throw new ConflictException();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.perfilPessoal) {
          await this.gravarPerfil(tx, ctx, alvo, dto.perfilPessoal);
        }
        if (dto.endereco) {
          await this.gravarEndereco(tx, ctx, alvo, dto.endereco);
        }
        const perfil = await tx.perfilPessoalColaborador.findUnique({
          where: { colaboradorId_empresaId: alvo },
          select: PROJECAO_PERFIL,
        });
        const endereco = await tx.enderecoColaborador.findUnique({
          where: { colaboradorId_empresaId: alvo },
          select: PROJECAO_ENDERECO,
        });
        return this.resposta(
          alvo,
          perfil || endereco ? "registrado" : "sem_registro",
          perfil ? valoresPerfil(perfil) : null,
          endereco ? valoresEndereco(endereco) : null,
        );
      });
    } catch (erro) {
      if (eUnicidadeVioladaNoBanco(erro)) {
        throw new ConflictException();
      }
      throw erro;
    }
  }

  /**
   * Gravação na ADMISSÃO, dentro da transação dela: o colaborador e o vínculo
   * acabaram de nascer na mesma transação, então não há registro anterior.
   * O perfil é obrigatório (tem ao menos a data de nascimento) e é sempre
   * criado; o endereço, opcional, só é criado quando algum campo tem valor. Se
   * qualquer gravação falhar, a admissão inteira falha (ADR 0004 §2).
   */
  async gravarNaAdmissao(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoDadosPessoais,
    dto: {
      perfilPessoal: PerfilPessoalDto;
      endereco?: EnderecoDto | undefined;
    },
  ): Promise<{
    perfilPessoal: ValoresPerfil;
    endereco: ValoresEndereco | null;
  }> {
    const valoresDoPerfil = perfilCompleto(dto.perfilPessoal);
    const perfilCriado = await tx.perfilPessoalColaborador.create({
      data: {
        ...alvo,
        ...dadosDoPerfil(valoresDoPerfil),
        criadoPorUserId: ctx.actor.id,
        atualizadoPorUserId: ctx.actor.id,
      },
      select: PROJECAO_PERFIL,
    });
    await this.registrarEvento(tx, ctx, alvo, {
      categoria: "perfil_pessoal",
      registroId: perfilCriado.id,
      acao: "criacao",
      resultado: "gravado",
      campos: camposPreenchidos(valoresDoPerfil, CAMPOS_PERFIL),
      auditAction: "pessoas_dados_pessoais_criados",
      auditResult: "success",
    });
    const perfil = valoresPerfil(perfilCriado);

    let endereco: ValoresEndereco | null = null;
    if (dto.endereco) {
      const valores = enderecoCompleto(dto.endereco);
      const campos = camposPreenchidos(valores, CAMPOS_ENDERECO);
      if (campos.length > 0) {
        const criado = await tx.enderecoColaborador.create({
          data: {
            ...alvo,
            ...valores,
            criadoPorUserId: ctx.actor.id,
            atualizadoPorUserId: ctx.actor.id,
          },
          select: PROJECAO_ENDERECO,
        });
        await this.registrarEvento(tx, ctx, alvo, {
          categoria: "endereco",
          registroId: criado.id,
          acao: "criacao",
          resultado: "gravado",
          campos,
          auditAction: "pessoas_dados_pessoais_criados",
          auditResult: "success",
        });
        endereco = valoresEndereco(criado);
      }
    }
    return { perfilPessoal: perfil, endereco };
  }

  private async gravarPerfil(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoDadosPessoais,
    dto: PerfilPessoalDto,
  ): Promise<void> {
    const novo = perfilCompleto(dto);
    const atual = await tx.perfilPessoalColaborador.findUnique({
      where: { colaboradorId_empresaId: alvo },
      select: PROJECAO_PERFIL,
    });
    if (!atual) {
      // A data de nascimento é obrigatória: o bloco sempre tem ao menos um
      // campo, e criar é sempre gravar.
      const campos = camposPreenchidos(novo, CAMPOS_PERFIL);
      const criado = await tx.perfilPessoalColaborador.create({
        data: {
          ...alvo,
          ...dadosDoPerfil(novo),
          criadoPorUserId: ctx.actor.id,
          atualizadoPorUserId: ctx.actor.id,
        },
        select: { id: true },
      });
      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "perfil_pessoal",
        registroId: criado.id,
        acao: "criacao",
        resultado: "gravado",
        campos,
        auditAction: "pessoas_dados_pessoais_criados",
        auditResult: "success",
      });
      return;
    }

    const id = atual.id;
    const campos = camposAlterados(valoresPerfil(atual), novo, CAMPOS_PERFIL);
    if (campos.length === 0) {
      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "perfil_pessoal",
        registroId: id,
        acao: "leitura",
        resultado: "sem_alteracao",
        campos: TODOS_PERFIL,
        auditAction: "pessoas_dados_pessoais_consultados",
        auditResult: "success",
      });
      return;
    }
    await tx.perfilPessoalColaborador.update({
      where: { id },
      data: { ...dadosDoPerfil(novo), atualizadoPorUserId: ctx.actor.id },
    });
    await this.registrarEvento(tx, ctx, alvo, {
      categoria: "perfil_pessoal",
      registroId: id,
      acao: "edicao",
      resultado: "gravado",
      campos,
      auditAction: "pessoas_dados_pessoais_atualizados",
      auditResult: "success",
    });
  }

  private async gravarEndereco(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoDadosPessoais,
    dto: EnderecoDto,
  ): Promise<void> {
    const novo = enderecoCompleto(dto);
    const atual = await tx.enderecoColaborador.findUnique({
      where: { colaboradorId_empresaId: alvo },
      select: PROJECAO_ENDERECO,
    });
    if (!atual) {
      const campos = camposPreenchidos(novo, CAMPOS_ENDERECO);
      if (campos.length === 0) {
        await this.registrarEvento(tx, ctx, alvo, {
          categoria: "endereco",
          registroId: null,
          acao: "leitura",
          resultado: "sem_registro",
          campos: [],
          auditAction: "pessoas_dados_pessoais_consultados",
          auditResult: "success",
        });
        return;
      }
      const criado = await tx.enderecoColaborador.create({
        data: {
          ...alvo,
          ...novo,
          criadoPorUserId: ctx.actor.id,
          atualizadoPorUserId: ctx.actor.id,
        },
        select: { id: true },
      });
      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "endereco",
        registroId: criado.id,
        acao: "criacao",
        resultado: "gravado",
        campos,
        auditAction: "pessoas_dados_pessoais_criados",
        auditResult: "success",
      });
      return;
    }

    const id = atual.id;
    const campos = camposAlterados(atual, novo, CAMPOS_ENDERECO);
    if (campos.length === 0) {
      await this.registrarEvento(tx, ctx, alvo, {
        categoria: "endereco",
        registroId: id,
        acao: "leitura",
        resultado: "sem_alteracao",
        campos: TODOS_ENDERECO,
        auditAction: "pessoas_dados_pessoais_consultados",
        auditResult: "success",
      });
      return;
    }
    await tx.enderecoColaborador.update({
      where: { id },
      data: { ...novo, atualizadoPorUserId: ctx.actor.id },
    });
    await this.registrarEvento(tx, ctx, alvo, {
      categoria: "endereco",
      registroId: id,
      acao: "edicao",
      resultado: "gravado",
      campos,
      auditAction: "pessoas_dados_pessoais_atualizados",
      auditResult: "success",
    });
  }

  /**
   * Resolve o colaborador no escopo e a empresa REAL em que a operação vale —
   * o mesmo escopo dos contatos (`resolverEscopoContatos`):
   *
   * - Escopado (`rh`, `dp`, `master_tecnico` com empresa ativa): só vínculos
   *   da empresa da sessão.
   * - Global (`master_tecnico` sem empresa ativa): os vínculos do colaborador
   *   em qualquer empresa. Com mais de uma empresa, a operação é ambígua e
   *   nada é lido nem gravado.
   *
   * Inexistente e fora do escopo respondem igual (404, `negarAcesso`): a
   * distinção vazaria a existência de uma pessoa em outra empresa. A
   * reavaliação com a empresa do vínculo é defesa em profundidade.
   */
  private async resolverAlvo(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    action: "read" | "alter",
  ): Promise<AlvoResolucao> {
    const escopo = resolverEscopoContatos(ctx.actor);
    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        colaboradorId,
        ...(escopo.global ? {} : { empresaId: escopo.empresaId }),
      },
      select: { empresaId: true, situacao: true },
    });
    const [empresaId, ...outras] = [
      ...new Set(vinculos.map((v) => v.empresaId)),
    ];
    if (empresaId === undefined) {
      return this.auditoria.negarAcesso(
        ctx,
        "dados_pessoais_colaborador",
        colaboradorId,
        escopo.global ? null : escopo.empresaId,
      );
    }
    if (outras.length > 0) {
      return { tipo: "ambiguo", colaboradorId };
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        action,
        empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "dados_pessoais_colaborador",
        colaboradorId,
        empresaId,
      );
    }
    return {
      tipo: "resolvido",
      alvo: { colaboradorId, empresaId },
      operacional: vinculos.some((v) => v.situacao !== "encerrado"),
    };
  }

  /**
   * Tentativa sem empresa resolvida (`ambiguo`): uma linha por categoria
   * alcançada, SEM empresa, SEM registro e sem campo — e `audit_event` com
   * `failure`. Confirmada ANTES da recusa, como nos contatos.
   */
  private async registrarAmbiguidade(
    ctx: PessoasAuditContext,
    colaboradorId: string,
    acao: "leitura" | "edicao",
    categorias: readonly CategoriaDadosPessoais[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.auditoria.registrarNaTransacao(tx, ctx, {
        action:
          acao === "leitura"
            ? "pessoas_dados_pessoais_consultados"
            : "pessoas_dados_pessoais_atualizados",
        resource: "dados_pessoais_colaborador",
        resourceId: colaboradorId,
        empresaId: null,
        result: "failure",
      });
      for (const categoria of categorias) {
        await tx.dadosPessoaisColaboradorEvento.create({
          data: {
            colaboradorId,
            empresaId: null,
            categoria,
            perfilId: null,
            enderecoId: null,
            acao,
            resultado: "empresa_ambigua",
            campos: [],
            atorUserId: ctx.actor.id,
            requestId: ctx.metadata.requestId,
          },
        });
      }
    });
  }

  private async idsDosRegistros(
    tx: Prisma.TransactionClient,
    alvo: AlvoDadosPessoais,
  ): Promise<{ perfilId: string | null; enderecoId: string | null }> {
    const perfil = await tx.perfilPessoalColaborador.findUnique({
      where: { colaboradorId_empresaId: alvo },
      select: { id: true },
    });
    const endereco = await tx.enderecoColaborador.findUnique({
      where: { colaboradorId_empresaId: alvo },
      select: { id: true },
    });
    return { perfilId: perfil?.id ?? null, enderecoId: endereco?.id ?? null };
  }

  private async registrarEvento(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: AlvoDadosPessoais,
    evento: Evento,
  ): Promise<void> {
    await this.auditoria.registrarNaTransacao(tx, ctx, {
      action: evento.auditAction,
      resource: "dados_pessoais_colaborador",
      resourceId: alvo.colaboradorId,
      empresaId: alvo.empresaId,
      result: evento.auditResult,
    });
    await tx.dadosPessoaisColaboradorEvento.create({
      data: {
        colaboradorId: alvo.colaboradorId,
        empresaId: alvo.empresaId,
        categoria: evento.categoria,
        perfilId:
          evento.categoria === "perfil_pessoal" ? evento.registroId : null,
        enderecoId: evento.categoria === "endereco" ? evento.registroId : null,
        acao: evento.acao,
        resultado: evento.resultado,
        campos: [...evento.campos],
        atorUserId: ctx.actor.id,
        requestId: ctx.metadata.requestId,
      },
    });
  }

  private resposta(
    alvo: AlvoDadosPessoais,
    situacao: SituacaoDadosPessoais,
    perfilPessoal: ValoresPerfil | null,
    endereco: ValoresEndereco | null,
  ): DadosPessoaisDoColaborador {
    return {
      colaboradorId: alvo.colaboradorId,
      empresaId: alvo.empresaId,
      situacao,
      perfilPessoal,
      endereco,
    };
  }
}
