import { ConflictException, Injectable } from "@nestjs/common";
import {
  Colaborador,
  ContatoColaborador,
  EnderecoColaborador,
  IdempotenciaAdmissao,
  MovimentacaoFuncional,
  PerfilPessoalColaborador,
  Prisma,
  SituacaoColaborador,
  SituacaoVinculo,
  StatusMovimentacao,
  TipoMovimentacao,
  TipoVinculo,
  VinculoFuncional,
  VinculoHorario,
} from "@prisma/client";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
  ErroDeCampo,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import {
  ContadoresColaboradores,
  PessoasAuditContext,
  ResultadoPaginado,
} from "../pessoas.types";
import {
  EscopoLeituraPessoas,
  deslocamento,
  filtroVinculoEmpresa,
  intersectarLeitura,
  podeAcessarPessoas,
  podeConsultarPessoas,
  resolverEscopoLeituraPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  assertDestinoCoerente,
  assertDestinoValidoEAtivo,
  dataUtc,
} from "../validacao-pessoas.util";
import { extrairDestino, traduzirErroPessoas } from "../pessoas-comum.util";
import {
  AdmitirColaboradorDto,
  type GrupoColaborador,
  ListarColaboradoresQueryDto,
  RetificarColaboradorDto,
} from "../dto/pessoas.dto";
import {
  DadosPessoaisColaboradorService,
  ValoresEndereco,
  ValoresPerfil,
  enderecoCompleto,
  perfilCompleto,
} from "../dados-pessoais/dados-pessoais.service";
import {
  ContatoColaboradorService,
  ValoresContatos,
  camposPreenchidos,
  contatosInformados,
} from "../contatos/contato-colaborador.service";
import { escaparCuringas } from "../../common/busca.util";
import { dataLocalDe } from "../../ponto/competencia.util";
import { clausulasDeBusca, indicadoresDoEscopo } from "./listagem-pagina";
import {
  comDesativacaoVigente,
  grupoExcluiDesativados,
  selecaoDaDesativacaoVigente,
  semDesativacaoVigente,
} from "./desativacao";
import {
  type ContratoDaAdmissao,
  contratoConfere,
  contratoGravado,
  gravarContratoNaAdmissao,
} from "./contrato-admissao";

/**
 * Resposta da admissão (T167).
 *
 * Mantém os campos do `Colaborador` no topo — quem já lia `id`, `nome` e
 * `situacao` continua lendo —, e ACRESCENTA a confirmação do vínculo e do ato
 * de admissão criados na mesma transação. Antes, o cliente precisava de dois
 * GETs para saber que vínculo tinha nascido.
 *
 * Projeção FECHADA: cada campo é escolhido aqui, nunca a entidade inteira. Só
 * entram dados já aprovados (nome, matrícula, tipo, situação, datas
 * funcionais) e identificadores técnicos. A lotação aparece como os ids do
 * destino gravado na movimentação: a alocação só nasce na efetivação (ADR 0007,
 * ato × estado), e afirmar uma lotação vigente aqui seria falso.
 *
 * O topo também é escolhido campo a campo — e não `...colaborador` —, para que
 * uma coluna futura no `Colaborador` não passe para esta resposta sem decisão.
 */
export interface AdmissaoRegistrada extends Pick<
  Colaborador,
  "id" | "nome" | "situacao" | "criadoEm" | "atualizadoEm"
> {
  vinculo: {
    id: string;
    empresaId: string;
    /** T179 — opcional na Nova admissão. */
    matricula: string | null;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    dataAdmissao: Date;
  };
  movimentacao: {
    id: string;
    tipo: TipoMovimentacao;
    status: StatusMovimentacao;
    vigenciaInicio: Date;
    destino: {
      unidadeOrganizacionalId: string | null;
      departamentoId: string | null;
      areaId: string | null;
      equipeId: string | null;
      cargoId: string | null;
      centroCustoId: string | null;
    };
  };
  /**
   * T177 — o que o servidor gravou do Módulo 1. T209 — perfil e endereço são
   * `null` quando nenhum campo deles veio.
   */
  perfilPessoal: ValoresPerfil | null;
  endereco: ValoresEndereco | null;
  /** T179 — `null` quando nenhum contato foi informado na admissão. */
  contatos: ValoresContatos | null;
  /**
   * T183 — a vigência da jornada criada com a admissão, ou `null` quando
   * nenhuma jornada foi escolhida (é opcional).
   */
  jornada: JornadaDaAdmissao | null;
  /** T209 — o contrato da admissão (etapa 2), ou `null` sem nenhum valor. */
  contrato: ContratoDaAdmissao | null;
}

/** T183 — a jornada da admissão: só ids e a data de início. */
export interface JornadaDaAdmissao {
  id: string;
  tabelaHorarioId: string;
  vigenciaInicio: Date;
}

/** T184 — referência organizacional resumida: só id, código e nome. */
export interface ReferenciaListada {
  id: string;
  codigo: string;
  nome: string;
}

/**
 * T184 — lotação VIGENTE do vínculo (a alocação organizacional aberta,
 * `vigente_ate` nulo): só o cargo e o departamento, cada um `null` quando a
 * lotação não o tem. Vínculo previsto (admissão não efetivada) e encerrado não
 * têm lotação vigente: `null` (decisão da proprietária de 2026-10-26).
 */
export interface LotacaoListada {
  cargo: ReferenciaListada | null;
  departamento: ReferenciaListada | null;
}

/**
 * T178 — vínculo resumido na listagem: o que a porta principal de
 * Colaboradores mostra (matrícula, situação e admissão), sem tipo nem nada
 * além. Só vínculos do escopo da sessão. T184 — mais a lotação vigente
 * (cargo e departamento).
 */
export interface VinculoListado {
  id: string;
  empresaId: string;
  /** T179 — opcional na Nova admissão: pode vir `null`. */
  matricula: string | null;
  /** T199 — tipo do vínculo (dado aprovado: "tipo/situação do vínculo"). */
  tipo: TipoVinculo;
  situacao: SituacaoVinculo;
  dataAdmissao: Date;
  dataDesligamento: Date | null;
  /** T184 — `null` sem lotação vigente. */
  lotacaoVigente: LotacaoListada | null;
  /**
   * T185 — as vigências de jornada (T183) do colaborador na empresa deste
   * vínculo que tocam `[hoje UTC − 1, hoje UTC + 1]`: no máximo três. A tela
   * escolhe a que contém o dia civil do navegador, como a ficha. Vazio para
   * vínculo que não está ativo (decisão da proprietária de 2026-10-26).
   */
  vigenciasDeJornada: VigenciaDeJornadaListada[];
}

/** T185 — uma vigência de jornada na listagem: datas e a jornada resumida. */
export interface VigenciaDeJornadaListada {
  /** Primeiro dia (`YYYY-MM-DD`). */
  vigenciaInicio: string;
  /** Primeiro dia SEM a jornada (`YYYY-MM-DD`), ou `null`. */
  vigenciaFim: string | null;
  jornada: { id: string; codigo: string | null; nome: string; ativo: boolean };
}

/** T185 — `Date` (coluna DATE, meia-noite UTC) -> `"YYYY-MM-DD"`. */
function diaIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** T185 — chave do par colaborador e empresa. */
function chaveDoPar(colaboradorId: string, empresaId: string): string {
  return `${colaboradorId}|${empresaId}`;
}

/**
 * T178 — item da listagem: projeção FECHADA. `situacao` é a situação **na
 * empresa ativa** para quem está escopado (tem vínculo ativo nela), e a
 * materializada (global) só para o `master_tecnico` sem empresa ativa. A
 * global, para o RH de uma empresa, mostraria "ativo" um colaborador desligado
 * ali e ativo em outra — resíduo de uma empresa na tela da outra.
 */
export interface ColaboradorListado {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: Date;
  atualizadoEm: Date;
  /** Ordenados: ativo, previsto, encerrado; depois admissão mais recente. */
  vinculos: VinculoListado[];
  /** T209 — se há foto do colaborador NA EMPRESA ATIVA (ver `FotoAnunciada`). */
  foto: FotoAnunciada | null;
  /**
   * T215 — desativado na empresa (global: em alguma). A `situacao` vem
   * "inativo"; a linha só aparece em Todos.
   */
  desativado: boolean;
  /**
   * T215 — o CPF (11 dígitos) do perfil pessoal na empresa ativa. AUSENTE
   * para quem não lê dados pessoais e sem empresa ativa; `null` sem CPF ou
   * com o dado bloqueado (desligado: só a ficha diz que existe).
   */
  cpf?: string | null;
  /**
   * T215 — e-mail pessoal e celular do contato ATIVO na empresa. AUSENTE
   * para quem não lê contatos e sem empresa ativa; `null` sem contato ou
   * bloqueado.
   */
  contatos?: { emailPessoal: string | null; celular: string | null } | null;
  /**
   * T215 — salário bruto do contrato do vínculo PRINCIPAL ("5000.00").
   * AUSENTE para quem não lê `contrato_vinculo` e sem empresa ativa; `null`
   * sem contrato ou sem salário.
   */
  salarioBruto?: string | null;
}

/** T215 — o que a página lê de cada linha, além da projeção de sempre. */
interface DadosDaLinha {
  cpf?: string | null;
  contatos?: { emailPessoal: string | null; celular: string | null } | null;
  salarioBruto?: string | null;
}

/**
 * T209 — a foto do colaborador, anunciada na listagem e na ficha: SÓ a
 * versão (para a tela montar a rota autenticada `GET
 * /v1/colaboradores/:id/foto?tamanho=…&v=…`). Nunca chave do objeto, hash,
 * tamanho, autor nem endereço do armazenamento (ADR 0020). `null` sem foto,
 * sem empresa ativa (a rota não a entregaria) ou sem leitura de dados
 * pessoais na empresa.
 */
export interface FotoAnunciada {
  versao: number;
}

/** T209 — o detalhe da ficha: o cadastro e a foto anunciada. */
export type ColaboradorDetalhado = Colaborador & {
  foto: FotoAnunciada | null;
};

export interface ListagemColaboradores extends ResultadoPaginado<ColaboradorListado> {
  contadores: ContadoresColaboradores;
}

// T196 — o escape dos curingas passou ao utilitário comum (`common/busca.util`),
// usado também pelas referências organizacionais; reexportado aqui para quem
// já importava daqui.
export { escaparCuringas };

const ORDEM_SITUACAO_VINCULO: Record<SituacaoVinculo, number> = {
  ativo: 0,
  previsto: 1,
  encerrado: 2,
};

/** T179 — matrícula opcional: quem não tem vai depois de quem tem. */
function compararMatriculas(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

/**
 * T190 — filtro por Departamento e/ou Cargo, pela lotação VIGENTE (T184): um
 * vínculo ATIVO do escopo cuja alocação ABERTA (`vigenteAte` nulo) tem o
 * departamento e o cargo pedidos — os dois na MESMA alocação, quando os dois
 * vêm. Previsto, encerrado e vínculo sem lotação vigente não casam: não há
 * lotação vigente ativa a mostrar, e aparecer filtrado seria afirmar uma
 * lotação que a linha não tem.
 *
 * Sem nenhum dos dois, `null`: o filtro não entra na consulta.
 */
export function filtroDeLotacaoVigente(
  noEscopo: Prisma.VinculoFuncionalWhereInput,
  departamentoId: string | undefined,
  cargoId: string | undefined,
): Prisma.ColaboradorWhereInput | null {
  if (!departamentoId && !cargoId) return null;
  return {
    vinculos: {
      some: {
        ...noEscopo,
        situacao: "ativo",
        alocacoes: {
          some: {
            vigenteAte: null,
            ...(departamentoId ? { departamentoId } : {}),
            ...(cargoId ? { cargoId } : {}),
          },
        },
      },
    },
  };
}

/**
 * T199 — o grupo da aba (N-1, exclusivo: ativo > previsto > encerrado) e o
 * tipo de vínculo (N-5, no MESMO vínculo que define o grupo), no `where` —
 * antes da paginação. `null` quando nenhum dos dois foi pedido.
 */
export function filtroDeGrupo(
  noEscopo: Prisma.VinculoFuncionalWhereInput,
  grupo: GrupoColaborador | undefined,
  /** T215 — um tipo, ou vários (qualquer um deles). */
  tipo?: TipoVinculo | readonly TipoVinculo[],
): Prisma.ColaboradorWhereInput | null {
  const doTipo: Prisma.VinculoFuncionalWhereInput =
    tipo === undefined
      ? {}
      : typeof tipo === "string"
        ? { tipo }
        : tipo.length > 0
          ? { tipo: { in: [...tipo] } }
          : {};
  const temTipo = Object.keys(doTipo).length > 0;
  const com = (situacao: SituacaoVinculo): Prisma.ColaboradorWhereInput => ({
    vinculos: { some: { ...noEscopo, situacao, ...doTipo } },
  });
  const sem = (situacao: SituacaoVinculo): Prisma.ColaboradorWhereInput => ({
    vinculos: { none: { ...noEscopo, situacao } },
  });
  switch (grupo) {
    case "ativos":
      return com("ativo");
    case "em_admissao":
      return { AND: [sem("ativo"), com("previsto")] };
    case "desligados":
      return { AND: [sem("ativo"), sem("previsto"), com("encerrado")] };
    default:
      return temTipo
        ? { vinculos: { some: { ...noEscopo, ...doTipo } } }
        : null;
  }
}

/** T215 — o que a gaveta "Filtrar" manda (cada grupo, uma lista). */
export interface FiltrosDaGaveta {
  readonly departamentos?: readonly string[] | undefined;
  readonly areas?: readonly string[] | undefined;
  readonly centrosCusto?: readonly string[] | undefined;
  readonly unidades?: readonly string[] | undefined;
  readonly cargos?: readonly string[] | undefined;
  readonly niveis?: readonly string[] | undefined;
  readonly generos?: readonly string[] | undefined;
}

/**
 * T215 — a gaveta "Filtrar" no `where`. Dentro de um grupo, qualquer um dos
 * valores; entre os grupos, todos. Lotação e nível valem no MESMO vínculo
 * ATIVO do escopo, na alocação ABERTA (a regra da T190); o gênero, no perfil
 * pessoal do escopo. Nada marcado: lista vazia (nenhum filtro na consulta).
 */
export function filtrosDaGaveta(
  noEscopo: Prisma.VinculoFuncionalWhereInput,
  filtros: FiltrosDaGaveta,
): Prisma.ColaboradorWhereInput[] {
  const em = (lista: readonly string[] | undefined) =>
    lista && lista.length > 0 ? { in: [...lista] } : undefined;
  const alocacao: Prisma.AlocacaoOrganizacionalWhereInput = {};
  const departamentos = em(filtros.departamentos);
  const areas = em(filtros.areas);
  const centros = em(filtros.centrosCusto);
  const unidades = em(filtros.unidades);
  const cargos = em(filtros.cargos);
  if (departamentos) alocacao.departamentoId = departamentos;
  if (areas) alocacao.areaId = areas;
  if (centros) alocacao.centroCustoId = centros;
  if (unidades) alocacao.unidadeOrganizacionalId = unidades;
  if (cargos) alocacao.cargoId = cargos;
  const niveis = em(filtros.niveis);
  const temLotacao = Object.keys(alocacao).length > 0;

  const resultado: Prisma.ColaboradorWhereInput[] = [];
  if (temLotacao || niveis) {
    resultado.push({
      vinculos: {
        some: {
          ...noEscopo,
          situacao: "ativo",
          ...(temLotacao
            ? { alocacoes: { some: { vigenteAte: null, ...alocacao } } }
            : {}),
          ...(niveis ? { contrato: { is: { nivel: niveis } } } : {}),
        },
      },
    });
  }
  const generos = em(filtros.generos);
  if (generos) {
    resultado.push({
      perfisPessoais: {
        some: {
          ...(typeof noEscopo.empresaId === "string"
            ? { empresaId: noEscopo.empresaId }
            : {}),
          genero: generos,
        },
      },
    });
  }
  return resultado;
}

/** Um vínculo ativo, só com o que decide o principal e o tipo. */
export interface VinculoAtivoResumido {
  colaboradorId: string;
  tipo: TipoVinculo;
  dataAdmissao: Date;
  matricula: string | null;
}

/**
 * T199 — ativos por tipo (N-2): cada colaborador conta UMA vez, pelo tipo do
 * vínculo principal ativo — a mesma ordem da listagem e da ficha (admissão
 * mais recente, depois a matrícula). A soma é o número de ativos.
 */
export function distribuirAtivosPorTipo(
  vinculosAtivos: readonly VinculoAtivoResumido[],
): Record<TipoVinculo, number> {
  const principal = new Map<string, VinculoAtivoResumido>();
  for (const v of vinculosAtivos) {
    const atual = principal.get(v.colaboradorId);
    if (
      !atual ||
      v.dataAdmissao.getTime() > atual.dataAdmissao.getTime() ||
      (v.dataAdmissao.getTime() === atual.dataAdmissao.getTime() &&
        compararMatriculas(v.matricula, atual.matricula) < 0)
    ) {
      principal.set(v.colaboradorId, v);
    }
  }
  const contagem: Record<TipoVinculo, number> = {
    clt: 0,
    estagio: 0,
    aprendiz: 0,
    pj: 0,
    temporario: 0,
    outro_controlado: 0,
    part_time: 0,
    freelancer: 0,
    trainee: 0,
  };
  for (const v of principal.values()) contagem[v.tipo] += 1;
  return contagem;
}

/** T199 — contadores de um escopo vazio (filtro de empresa sem interseção). */
export function contadoresVazios(): ContadoresColaboradores {
  return {
    ativos: 0,
    inativos: 0,
    emAdmissao: 0,
    desligados: 0,
    total: 0,
    desativados: 0,
    ativosPorTipo: distribuirAtivosPorTipo([]),
    admitidosNoMes: 0,
    desligadosNoAno: 0,
    serieAtivos: [0, 0, 0, 0, 0, 0],
  };
}

/** Vínculo principal primeiro: o ativo, depois o previsto, depois o mais novo. */
export function ordenarVinculosListados(
  vinculos: readonly VinculoListado[],
): VinculoListado[] {
  return [...vinculos].sort(
    (a, b) =>
      ORDEM_SITUACAO_VINCULO[a.situacao] - ORDEM_SITUACAO_VINCULO[b.situacao] ||
      b.dataAdmissao.getTime() - a.dataAdmissao.getTime() ||
      // T179 — matrícula opcional: quem não tem vai depois de quem tem.
      compararMatriculas(a.matricula, b.matricula),
  );
}

/**
 * T179 — campos da admissão já usados na empresa ativa: matrícula e e-mail
 * pessoal (único na mesma empresa, decisão da proprietária de 2026-10-21).
 * Só a empresa ativa é consultada: "em uso" nunca revela alguém de outra.
 */
export async function conflitosDaAdmissao(
  tx: Prisma.TransactionClient,
  empresaId: string,
  dto: Pick<AdmitirColaboradorDto, "matricula" | "contatos"> & {
    readonly perfilPessoal?: { readonly cpf?: string | null } | undefined;
  },
): Promise<ErroDeCampo[]> {
  // T179 — matrícula e e-mail são opcionais: só o que veio é conferido.
  const emailPessoal = contatosInformados(dto.contatos).emailPessoal;
  const matricula =
    dto.matricula == null
      ? null
      : await tx.vinculoFuncional.findFirst({
          where: { empresaId, matricula: dto.matricula },
          select: { id: true },
        });
  const email =
    emailPessoal === null
      ? null
      : await tx.contatoColaborador.findFirst({
          where: { empresaId, emailPessoal },
          select: { id: true },
        });
  // T209 — CPF único na empresa (só a empresa ativa é consultada).
  const cpfInformado = dto.perfilPessoal?.cpf ?? null;
  const cpf =
    cpfInformado === null
      ? null
      : await tx.perfilPessoalColaborador.findFirst({
          where: { empresaId, cpf: cpfInformado },
          select: { id: true },
        });
  const erros: ErroDeCampo[] = [];
  if (matricula) erros.push({ campo: "matricula", motivo: "em_uso" });
  if (email) erros.push({ campo: "contatos.emailPessoal", motivo: "em_uso" });
  if (cpf) erros.push({ campo: "perfilPessoal.cpf", motivo: "em_uso" });
  return erros;
}

/**
 * T179 — qual campo da admissão uma unicidade do banco protegeu. Só a
 * matrícula na empresa e o e-mail pessoal na empresa têm campo público; a
 * unicidade da chave de idempotência e as demais voltam `null`.
 */
export function camposDaUnicidadeViolada(erro: unknown): ErroDeCampo[] | null {
  if (
    !(erro instanceof Prisma.PrismaClientKnownRequestError) ||
    erro.code !== "P2002"
  ) {
    return null;
  }
  const alvo = erro.meta?.["target"];
  const texto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  if (/chave/.test(texto)) return null;
  if (/matricula/.test(texto)) {
    return [{ campo: "matricula", motivo: "em_uso" }];
  }
  if (/email_pessoal|emailPessoal/.test(texto)) {
    return [{ campo: "contatos.emailPessoal", motivo: "em_uso" }];
  }
  if (/cpf/.test(texto)) {
    return [{ campo: "perfilPessoal.cpf", motivo: "em_uso" }];
  }
  return null;
}

/** O que o reenvio idempotente compara com a admissão gravada. */
export interface AdmissaoGravada {
  colaborador: Pick<Colaborador, "nome">;
  vinculo: Pick<
    VinculoFuncional,
    "empresaId" | "matricula" | "tipo" | "dataAdmissao"
  >;
  movimentacao: Pick<
    MovimentacaoFuncional,
    | "motivoCodigo"
    | "destinoUnidadeOrganizacionalId"
    | "destinoDepartamentoId"
    | "destinoAreaId"
    | "destinoEquipeId"
    | "destinoCargoId"
    | "destinoCentroCustoId"
  >;
  perfil: Omit<
    PerfilPessoalColaborador,
    | "id"
    | "empresaId"
    | "colaboradorId"
    | "criadoPorUserId"
    | "atualizadoPorUserId"
    | "criadoEm"
    | "atualizadoEm"
  > | null;
  endereco: Omit<
    EnderecoColaborador,
    | "id"
    | "empresaId"
    | "colaboradorId"
    | "criadoPorUserId"
    | "atualizadoPorUserId"
    | "criadoEm"
    | "atualizadoEm"
  > | null;
  contato: Pick<
    ContatoColaborador,
    "emailPessoal" | "celular" | "telefone" | "ativo"
  > | null;
  /** T183 — a jornada criada com a admissão; ausente ou `null` é nenhuma. */
  jornada?: Pick<VinculoHorario, "tabelaHorarioId"> | null;
  /** T209 — o contrato gravado com a admissão; ausente ou `null` é nenhum. */
  contrato?: Prisma.ContratoVinculoGetPayload<object> | null;
}

/**
 * T179 — o reenvio traz o MESMO conteúdo da admissão gravada? Compara cada
 * campo já normalizado (o DTO passa pelos mesmos `@Transform` da gravação).
 * Uma admissão editada depois (nome retificado, contato alterado) deixa de
 * conferir — e o reenvio é recusado, em vez de devolver um estado que não é
 * mais o do envio.
 */
export function admissaoConfere(
  dto: AdmitirColaboradorDto,
  gravada: AdmissaoGravada,
): boolean {
  const { colaborador, vinculo, movimentacao, perfil, endereco, contato } =
    gravada;
  const destino = extrairDestino(dto);
  const iguais = (a: unknown, b: unknown) => a === b;

  // T209 — o contrato (etapa 2) também precisa ser o mesmo do envio.
  if (!contratoConfere(dto.contrato, gravada.contrato ?? null)) return false;

  // T183 — a jornada opcional também precisa ser a mesma do envio.
  if (
    !iguais(
      gravada.jornada?.tabelaHorarioId ?? null,
      dto.tabelaHorarioId ?? null,
    )
  ) {
    return false;
  }

  if (
    !iguais(colaborador.nome, dto.nome) ||
    !iguais(vinculo.empresaId, dto.empresaId) ||
    !iguais(vinculo.matricula, dto.matricula ?? null) ||
    !iguais(vinculo.tipo, dto.tipo) ||
    vinculo.dataAdmissao.getTime() !==
      dataUtc(new Date(dto.dataAdmissao)).getTime() ||
    !iguais(movimentacao.motivoCodigo, dto.motivoCodigo) ||
    !iguais(
      movimentacao.destinoUnidadeOrganizacionalId,
      destino.unidadeOrganizacionalId,
    ) ||
    !iguais(movimentacao.destinoDepartamentoId, destino.departamentoId) ||
    !iguais(movimentacao.destinoAreaId, destino.areaId) ||
    !iguais(movimentacao.destinoEquipeId, destino.equipeId) ||
    !iguais(movimentacao.destinoCargoId, destino.cargoId) ||
    !iguais(movimentacao.destinoCentroCustoId, destino.centroCustoId)
  ) {
    return false;
  }

  const perfilEnviado = perfilCompleto(dto.perfilPessoal);
  const perfilTemValor = Object.values(perfilEnviado).some((v) => v !== null);
  // T209 — perfil sem nenhum valor não nasce: os dois lados precisam bater.
  if (!perfilTemValor) {
    if (perfil !== null) return false;
  } else {
    if (!perfil) return false;
    if (
      (perfil.dataNascimento?.toISOString().slice(0, 10) ?? null) !==
      perfilEnviado.dataNascimento
    ) {
      return false;
    }
    for (const chave of CHAVES_PERFIL_SEM_DATA) {
      if (!iguais(perfil[chave], perfilEnviado[chave])) return false;
    }
  }

  const enderecoEnviado = dto.endereco ? enderecoCompleto(dto.endereco) : null;
  const enderecoTemValor =
    enderecoEnviado !== null &&
    Object.values(enderecoEnviado).some((v) => v !== null);
  if (!enderecoTemValor) {
    if (endereco !== null) return false;
  } else {
    if (!endereco) return false;
    for (const chave of CHAVES_ENDERECO) {
      if (!iguais(endereco[chave], enderecoEnviado![chave])) return false;
    }
  }

  // T179 — contatos opcionais: sem nenhum enviado, nenhum registro nasceu.
  const enviados = contatosInformados(dto.contatos);
  // Registro inativo (contatos removidos depois) é o mesmo "sem contato".
  if (camposPreenchidos(enviados).length === 0) {
    return contato === null || !contato.ativo;
  }
  return (
    contato !== null &&
    iguais(contato.emailPessoal, enviados.emailPessoal) &&
    iguais(contato.celular, enviados.celular) &&
    iguais(contato.telefone, enviados.telefone)
  );
}

const CHAVES_PERFIL_SEM_DATA = [
  "cpf",
  "rg",
  "genero",
  "contatoEmergenciaNome",
  "contatoEmergenciaTelefone",
  "sexo",
  "saudacao",
  "estadoCivil",
  "nacionalidade",
  "naturalidade",
  "escolaridade",
  "curso",
  "nomePai",
  "nomeMae",
] as const;

const CHAVES_ENDERECO = [
  "pais",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
] as const;

/**
 * Colaborador — a pessoa. Carrega **apenas** os dados aprovados na Baseline V1
 * (item 1): `nome` e `situacao` derivada. Nenhum documento, contato, endereço,
 * data de nascimento, nome social ou dado sensível existe nesta entidade.
 *
 * Não tem `empresa_id`: a empresa é propriedade do **vínculo** (item 2). Por
 * isso o escopo de leitura atravessa a relação — um colaborador é visível a
 * quem tem escopo em alguma empresa onde ele tenha vínculo.
 */
@Injectable()
export class ColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    // T177 — Módulo 1 do cadastro, gravado na transação da admissão.
    private readonly dadosPessoais: DadosPessoaisColaboradorService,
    private readonly contatos: ContatoColaboradorService,
  ) {}

  /**
   * Admissão: cria colaborador, primeiro vínculo (`previsto`) e a movimentação
   * de `admissao` — **na mesma transação**.
   *
   * Os três nascem juntos por necessidade de autorização, não por conveniência:
   * um colaborador sem vínculo não teria empresa, ficaria fora de todo escopo e
   * seria invisível até para quem o criou.
   *
   * O vínculo nasce `previsto`, nunca `ativo`: ativar exige efetivar a
   * movimentação, que é ato explícito e auditado (spec §8).
   */
  async admitir(
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<AdmissaoRegistrada> {
    return (await this.admitirIdempotente(dto, ctx, undefined)).admissao;
  }

  /**
   * T179 — admissão com idempotência do envio (decisão da proprietária de
   * 2026-10-21).
   *
   * Com `chave`, a mesma chave do MESMO ator na MESMA empresa nunca cria duas
   * admissões: o reenvio devolve a admissão já gravada (`reenvio: true`); a
   * mesma chave com conteúdo diferente é recusada (422,
   * `idempotencia_conteudo_divergente`). Envios simultâneos com a mesma chave
   * se resolvem no banco: o segundo esbarra numa unicidade, e o `catch`
   * encontra o registro do primeiro e responde como reenvio.
   *
   * Duplicidade de dado (matrícula, e-mail pessoal na empresa) responde 409
   * com o campo e sem o valor (`ConflitoDeCamposException`).
   */
  async admitirIdempotente(
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
    chave: string | undefined,
  ): Promise<{ admissao: AdmissaoRegistrada; reenvio: boolean }> {
    const escopo = resolverEscopoPessoas(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      // Empresa fora do escopo: 404 público, `denied` na trilha. Nunca 403 —
      // confirmaria a existência da empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(ctx.actor, "colaborador", "create", escopo.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        escopo.empresaId,
      );
    }
    // T177 — cada bloco do Módulo 1 tem a sua própria permissão, reavaliada
    // com a empresa ativa. Hoje `rh` e `dp` têm as duas; a verificação existe
    // para que o dia em que as matrizes divergirem não abra um atalho pela
    // admissão.
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "dados_pessoais_colaborador",
        null,
        escopo.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "contato_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
        null,
        escopo.empresaId,
      );
    }

    // T183 — a jornada opcional é um vínculo de horário: só quem ATRIBUI
    // jornada (o RH) pode enviá-la. O DP admite, mas não altera jornada;
    // vinda dele, a admissão inteira é negada, sem gravar nada.
    if (
      dto.tabelaHorarioId !== undefined &&
      !podeAcessarPessoas(
        ctx.actor,
        "vinculo_horario",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_horario",
        null,
        escopo.empresaId,
      );
    }

    const destino = extrairDestino(dto);
    assertDestinoCoerente("admissao", destino);

    const dataAdmissao = dataUtc(new Date(dto.dataAdmissao));
    const status: StatusMovimentacao =
      dataAdmissao > dataUtc(new Date()) ? "programada" : "solicitada";

    // Reenvio de uma chave já registrada: nada é gravado de novo.
    const registroAnterior = await this.registroDaChave(
      ctx.actor.id,
      escopo.empresaId,
      chave,
    );
    if (registroAnterior) {
      return this.reenviarAdmissao(registroAnterior, dto, ctx);
    }

    try {
      const admissao = await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, escopo.empresaId, destino);

        // T179 — duplicidade de dado, toda de uma vez e só na empresa ativa.
        // A restrição do banco é a garantia (corrida chega como P2002, abaixo);
        // esta consulta só existe para dizer QUAIS campos conflitam.
        const conflitos = await conflitosDaAdmissao(tx, escopo.empresaId, dto);
        if (conflitos.length > 0) {
          throw new ConflitoDeCamposException(conflitos);
        }

        const colaborador = await tx.colaborador.create({
          data: { nome: dto.nome, situacao: SituacaoColaborador.inativo },
        });

        const vinculo = await tx.vinculoFuncional.create({
          data: {
            colaboradorId: colaborador.id,
            empresaId: escopo.empresaId,
            matricula: dto.matricula ?? null,
            tipo: dto.tipo,
            situacao: "previsto",
            dataAdmissao,
          },
        });

        const movimentacao = await tx.movimentacaoFuncional.create({
          data: {
            vinculoId: vinculo.id,
            empresaId: escopo.empresaId,
            tipo: "admissao",
            status,
            motivoCodigo: dto.motivoCodigo,
            solicitanteUserId: ctx.actor.id,
            vigenciaInicio: dataAdmissao,
            destinoUnidadeOrganizacionalId: destino.unidadeOrganizacionalId,
            destinoDepartamentoId: destino.departamentoId,
            destinoAreaId: destino.areaId,
            destinoEquipeId: destino.equipeId,
            destinoCargoId: destino.cargoId,
            destinoCentroCustoId: destino.centroCustoId,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_colaborador_criado",
          "colaborador",
          colaborador.id,
          escopo.empresaId,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_vinculo_criado",
          "vinculo_funcional",
          vinculo.id,
          escopo.empresaId,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          status === "programada"
            ? "pessoas_movimentacao_programada"
            : "pessoas_movimentacao_registrada",
          "movimentacao_funcional",
          movimentacao.id,
          escopo.empresaId,
        );

        // T177 — Módulo 1: perfil, endereço e contatos iniciais, na MESMA
        // transação. Qualquer falha desfaz a admissão inteira: não existe
        // colaborador sem os dados enviados, nem dado sem colaborador.
        const alvoModulo1 = {
          colaboradorId: colaborador.id,
          empresaId: escopo.empresaId,
        };
        const modulo1 = await this.dadosPessoais.gravarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          { perfilPessoal: dto.perfilPessoal, endereco: dto.endereco },
        );
        const contatosGravados = await this.contatos.criarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          dto.contatos,
        );

        // T183 — jornada opcional: a vigência começa na data de admissão,
        // na MESMA transação. Qualquer recusa desfaz a admissão inteira.
        const jornada =
          dto.tabelaHorarioId === undefined
            ? null
            : await this.atribuirJornadaNaAdmissao(tx, ctx, {
                colaboradorId: colaborador.id,
                empresaId: escopo.empresaId,
                tabelaHorarioId: dto.tabelaHorarioId,
                dataAdmissao,
              });

        // T209 — contrato da admissão (etapa 2), na MESMA transação.
        const contrato = await gravarContratoNaAdmissao(
          tx,
          { vinculoId: vinculo.id, empresaId: escopo.empresaId },
          dto.contrato,
        );

        // T179 — registro de idempotência na MESMA transação: existe se, e só
        // se, a admissão existe. Só chave, ator, empresa e ids — nenhum dado
        // pessoal.
        if (chave !== undefined) {
          await tx.idempotenciaAdmissao.create({
            data: {
              chave,
              atorUserId: ctx.actor.id,
              empresaId: escopo.empresaId,
              colaboradorId: colaborador.id,
              vinculoId: vinculo.id,
              movimentacaoId: movimentacao.id,
            },
          });
        }

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          situacao: colaborador.situacao,
          criadoEm: colaborador.criadoEm,
          atualizadoEm: colaborador.atualizadoEm,
          vinculo: {
            id: vinculo.id,
            empresaId: vinculo.empresaId,
            matricula: vinculo.matricula,
            tipo: vinculo.tipo,
            situacao: vinculo.situacao,
            dataAdmissao: vinculo.dataAdmissao,
          },
          movimentacao: {
            id: movimentacao.id,
            tipo: movimentacao.tipo,
            status: movimentacao.status,
            vigenciaInicio: movimentacao.vigenciaInicio,
            destino: {
              unidadeOrganizacionalId:
                movimentacao.destinoUnidadeOrganizacionalId,
              departamentoId: movimentacao.destinoDepartamentoId,
              areaId: movimentacao.destinoAreaId,
              equipeId: movimentacao.destinoEquipeId,
              cargoId: movimentacao.destinoCargoId,
              centroCustoId: movimentacao.destinoCentroCustoId,
            },
          },
          perfilPessoal: modulo1.perfilPessoal,
          endereco: modulo1.endereco,
          contatos: contatosGravados,
          jornada,
          contrato,
        };
      });
      return { admissao, reenvio: false };
    } catch (error) {
      const conflito =
        error instanceof ConflitoDeCamposException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002");
      if (conflito) {
        // Envio simultâneo com a mesma chave: o outro já gravou. A unicidade
        // que barrou este (matrícula, e-mail ou a própria chave) é a do
        // registro dele — é reenvio, não conflito.
        const registro = await this.registroDaChave(
          ctx.actor.id,
          escopo.empresaId,
          chave,
        );
        if (registro) {
          return this.reenviarAdmissao(registro, dto, ctx);
        }
      }
      if (error instanceof ConflitoDeCamposException) {
        throw error;
      }
      const campos = camposDaUnicidadeViolada(error);
      if (campos) {
        throw new ConflitoDeCamposException(campos);
      }
      traduzirErroPessoas(error);
    }
  }

  /**
   * T183 — cria a vigência da jornada escolhida na admissão. Só jornada
   * ATIVA da empresa ativa: inexistente nela e inativa respondem igual
   * (`indisponivel`), sem revelar outra empresa. Na trilha, só o id.
   */
  private async atribuirJornadaNaAdmissao(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    alvo: {
      colaboradorId: string;
      empresaId: string;
      tabelaHorarioId: string;
      dataAdmissao: Date;
    },
  ): Promise<JornadaDaAdmissao> {
    const tabela = await tx.tabelaHorario.findFirst({
      where: {
        id: alvo.tabelaHorarioId,
        empresaId: alvo.empresaId,
        ativo: true,
      },
      select: { id: true },
    });
    if (tabela === null) {
      throw new CamposRecusadosException([
        { campo: "tabelaHorarioId", motivo: "indisponivel" },
      ]);
    }
    const vinculo = await tx.vinculoHorario.create({
      data: {
        colaboradorId: alvo.colaboradorId,
        empresaId: alvo.empresaId,
        tabelaHorarioId: tabela.id,
        vigenciaInicio: alvo.dataAdmissao,
        vigenciaFim: null,
        criadoPorUserId: ctx.actor.id,
      },
    });
    await this.auditoria.registrarMutacao(
      tx,
      ctx,
      "horarios_vinculo_criado",
      "vinculo_horario",
      vinculo.id,
      alvo.empresaId,
    );
    return {
      id: vinculo.id,
      tabelaHorarioId: vinculo.tabelaHorarioId,
      vigenciaInicio: vinculo.vigenciaInicio,
    };
  }

  /**
   * T185 — vigências de jornada que tocam `[hoje UTC − 1, hoje UTC + 1]` para
   * cada par colaborador e empresa: as vigências não se cruzam, então são no
   * máximo três por par — o bastante para a tela decidir pelo dia civil do
   * navegador em qualquer fuso, sem o histórico inteiro.
   */
  private async jornadasPertoDeHoje(
    pares: readonly { colaboradorId: string; empresaId: string }[],
  ): Promise<Map<string, VigenciaDeJornadaListada[]>> {
    const porPar = new Map<string, VigenciaDeJornadaListada[]>();
    if (pares.length === 0) return porPar;
    const hoje = dataUtc(new Date());
    const umDia = 24 * 60 * 60 * 1000;
    const ontem = new Date(hoje.getTime() - umDia);
    const amanha = new Date(hoje.getTime() + umDia);
    const vigencias = await this.prisma.vinculoHorario.findMany({
      where: {
        OR: pares.map(({ colaboradorId, empresaId }) => ({
          colaboradorId,
          empresaId,
        })),
        vigenciaInicio: { lte: amanha },
        AND: [{ OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: ontem } }] }],
      },
      orderBy: [{ vigenciaInicio: "asc" }, { id: "asc" }],
      select: {
        colaboradorId: true,
        empresaId: true,
        vigenciaInicio: true,
        vigenciaFim: true,
        tabela: { select: { id: true, codigo: true, nome: true, ativo: true } },
      },
    });
    for (const v of vigencias) {
      const chave = chaveDoPar(v.colaboradorId, v.empresaId);
      const lista = porPar.get(chave) ?? [];
      lista.push({
        vigenciaInicio: diaIso(v.vigenciaInicio),
        vigenciaFim: v.vigenciaFim !== null ? diaIso(v.vigenciaFim) : null,
        jornada: v.tabela,
      });
      porPar.set(chave, lista);
    }
    return porPar;
  }

  /** O registro de idempotência desta chave, deste ator, nesta empresa. */
  private async registroDaChave(
    atorUserId: string,
    empresaId: string,
    chave: string | undefined,
  ): Promise<IdempotenciaAdmissao | null> {
    if (chave === undefined) return null;
    return this.prisma.idempotenciaAdmissao.findUnique({
      where: {
        atorUserId_empresaId_chave: { atorUserId, empresaId, chave },
      },
    });
  }

  /**
   * T179 — reenvio de uma chave já registrada.
   *
   * O conteúdo do reenvio é comparado com a PRÓPRIA admissão gravada — por
   * isso o registro de idempotência não precisa guardar nem um resumo dele.
   * A comparação lê no servidor e nada devolve; só quando confere a resposta
   * é montada, pelas consultas de dados pessoais e de contatos, que deixam a
   * trilha de leitura de sempre.
   */
  private async reenviarAdmissao(
    registro: IdempotenciaAdmissao,
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<{ admissao: AdmissaoRegistrada; reenvio: boolean }> {
    const gravada = await this.prisma.$transaction(async (tx) => {
      const [colaborador, vinculo, movimentacao, perfil, endereco, contato] =
        await Promise.all([
          tx.colaborador.findUniqueOrThrow({
            where: { id: registro.colaboradorId },
          }),
          tx.vinculoFuncional.findUniqueOrThrow({
            where: { id: registro.vinculoId },
          }),
          tx.movimentacaoFuncional.findUniqueOrThrow({
            where: { id: registro.movimentacaoId },
          }),
          tx.perfilPessoalColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
          tx.enderecoColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
          tx.contatoColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
        ]);
      // T183 — a jornada criada com a admissão: a vigência que começa na data
      // de admissão, a primeira gravada. Uma troca posterior encerra esta e
      // cria outra; esta continua no histórico.
      const jornada = await tx.vinculoHorario.findFirst({
        where: {
          colaboradorId: registro.colaboradorId,
          empresaId: registro.empresaId,
          vigenciaInicio: vinculo.dataAdmissao,
        },
        orderBy: { criadoEm: "asc" },
        select: { id: true, tabelaHorarioId: true, vigenciaInicio: true },
      });
      // T209 — o contrato gravado com a admissão (etapa 2).
      const contrato = await tx.contratoVinculo.findUnique({
        where: { vinculoId: registro.vinculoId },
      });
      return {
        colaborador,
        vinculo,
        movimentacao,
        perfil,
        endereco,
        contato,
        jornada,
        contrato,
      };
    });

    if (!admissaoConfere(dto, gravada)) {
      throw new RecusaDeNegocioException("idempotencia_conteudo_divergente");
    }

    const dados = await this.dadosPessoais.consultar(
      registro.colaboradorId,
      ctx,
    );
    const contatos = await this.contatos.consultar(registro.colaboradorId, ctx);
    if (dados.situacao === "bloqueado" || contatos.situacao === "bloqueado") {
      // A admissão confere, mas o uso operacional foi bloqueado depois dela
      // (desligamento): não há o que devolver como admissão registrada.
      throw new ConflictException();
    }

    const { colaborador, vinculo, movimentacao } = gravada;
    return {
      reenvio: true,
      admissao: {
        id: colaborador.id,
        nome: colaborador.nome,
        situacao: colaborador.situacao,
        criadoEm: colaborador.criadoEm,
        atualizadoEm: colaborador.atualizadoEm,
        vinculo: {
          id: vinculo.id,
          empresaId: vinculo.empresaId,
          matricula: vinculo.matricula,
          tipo: vinculo.tipo,
          situacao: vinculo.situacao,
          dataAdmissao: vinculo.dataAdmissao,
        },
        movimentacao: {
          id: movimentacao.id,
          tipo: movimentacao.tipo,
          status: movimentacao.status,
          vigenciaInicio: movimentacao.vigenciaInicio,
          destino: {
            unidadeOrganizacionalId:
              movimentacao.destinoUnidadeOrganizacionalId,
            departamentoId: movimentacao.destinoDepartamentoId,
            areaId: movimentacao.destinoAreaId,
            equipeId: movimentacao.destinoEquipeId,
            cargoId: movimentacao.destinoCargoId,
            centroCustoId: movimentacao.destinoCentroCustoId,
          },
        },
        perfilPessoal: dados.perfilPessoal,
        endereco: dados.endereco,
        contatos: contatos.contatos,
        jornada: gravada.jornada,
        contrato: contratoGravado(gravada.contrato),
      },
    };
  }

  /**
   * Listagem da porta principal de Colaboradores (T164; T178).
   *
   * - **Escopo estrutural:** para `rh`/`dp` (e `master_tecnico` com empresa
   *   ativa), só colaborador com vínculo na empresa da sessão; para o
   *   `master_tecnico` sem empresa ativa, toda a base, auditada.
   * - **Situação na empresa:** escopado, "ativo" é ter vínculo ativo NA
   *   empresa ativa — no filtro, na coluna e nos contadores. Global, vale a
   *   situação materializada.
   * - **Busca** (T178): nome contém, sem diferenciar maiúsculas; ou matrícula
   *   contém, só em vínculos do escopo.
   * - **Contadores** (T178): o escopo inteiro, sem filtros nem busca.
   * - **Departamento e Cargo** (T190): pela lotação vigente, no banco, antes
   *   da paginação (`filtroDeLotacaoVigente`). Os contadores não mudam.
   */
  async listar(
    query: ListarColaboradoresQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ListagemColaboradores> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const filtro = intersectarLeitura(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
        contadores: contadoresVazios(),
      };
    }

    const empresaId = filtro.empresaId;
    const noEscopo: Prisma.VinculoFuncionalWhereInput =
      empresaId !== undefined ? { empresaId } : {};

    // Escopo: colaborador com vínculo na empresa (escopado) ou qualquer um
    // (global). É a base de tudo — lista, total e contadores.
    const base: Prisma.ColaboradorWhereInput =
      empresaId !== undefined ? { vinculos: { some: { empresaId } } } : {};

    // T215 — o desativado na empresa não é ativo: sai do "ativo" e entra no
    // "inativo", pela mesma regra dos grupos.
    const ativoNoEscopo: Prisma.ColaboradorWhereInput = {
      AND: [
        empresaId !== undefined
          ? { vinculos: { some: { empresaId, situacao: "ativo" } } }
          : { situacao: "ativo" },
        semDesativacaoVigente(empresaId),
      ],
    };
    const inativoNoEscopo: Prisma.ColaboradorWhereInput = {
      OR: [
        empresaId !== undefined
          ? { vinculos: { none: { empresaId, situacao: "ativo" } } }
          : { situacao: "inativo" },
        comDesativacaoVigente(empresaId),
      ],
    };

    const filtros: Prisma.ColaboradorWhereInput[] = [base];
    if (query.situacaoVinculo) {
      filtros.push({
        vinculos: { some: { ...noEscopo, situacao: query.situacaoVinculo } },
      });
    }
    if (query.situacao) {
      filtros.push(
        query.situacao === "ativo" ? ativoNoEscopo : inativoNoEscopo,
      );
    }
    if (query.busca) {
      // T215 — nome, matrícula, CPF, e-mail pessoal e id (ver
      // `clausulasDeBusca`); CPF e e-mail só para quem os lê na ficha.
      const pode = (
        recurso: "dados_pessoais_colaborador" | "contato_colaborador",
      ) =>
        empresaId !== undefined
          ? podeAcessarPessoas(ctx.actor, recurso, "read", empresaId)
          : podeConsultarPessoas(ctx.actor, recurso, "read", escopo);
      filtros.push({
        OR: clausulasDeBusca(query.busca, {
          noEscopo,
          empresaId,
          podeCpf: pode("dados_pessoais_colaborador"),
          podeEmail: pode("contato_colaborador"),
        }),
      });
    }
    const porLotacao = filtroDeLotacaoVigente(
      noEscopo,
      query.departamentoId,
      query.cargoId,
    );
    if (porLotacao) filtros.push(porLotacao);
    // T215 — a gaveta "Filtrar" (listas; grupos combinados).
    filtros.push(
      ...filtrosDaGaveta(noEscopo, {
        departamentos: query.departamentos,
        areas: query.areas,
        centrosCusto: query.centrosCusto,
        unidades: query.unidades,
        cargos: query.cargos,
        niveis: query.niveis,
        generos: query.generos,
      }),
    );
    // T199 — grupo da aba e tipo de vínculo, no banco e antes da paginação.
    // T215 — o tipo único (antigo) e a lista da gaveta valem juntos.
    const tipos = [
      ...(query.tipoVinculo ? [query.tipoVinculo] : []),
      ...(query.tipos ?? []),
    ];
    const porGrupo = filtroDeGrupo(
      noEscopo,
      query.grupo,
      tipos.length === 1 ? tipos[0] : tipos.length > 1 ? tipos : undefined,
    );
    if (porGrupo) filtros.push(porGrupo);
    // T215 — o desativado fica só em Todos.
    if (grupoExcluiDesativados(query.grupo)) {
      filtros.push(semDesativacaoVigente(empresaId));
    }
    const where: Prisma.ColaboradorWhereInput = { AND: filtros };

    // T199 — contadores do escopo inteiro, sem busca, filtros nem aba; os
    // três grupos pela MESMA regra do filtro, para que somem o total.
    const contarGrupo = (grupo: GrupoColaborador) =>
      this.prisma.colaborador.count({
        where: {
          AND: [
            base,
            filtroDeGrupo(noEscopo, grupo)!,
            semDesativacaoVigente(empresaId),
          ],
        },
      });

    const [
      linhas,
      total,
      ativos,
      totalNoEscopo,
      emAdmissao,
      desligados,
      vinculosAtivos,
      desativados,
      vinculosDoEscopo,
    ] = await Promise.all([
      this.prisma.colaborador.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente.
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
        select: {
          id: true,
          nome: true,
          situacao: true,
          criadoEm: true,
          atualizadoEm: true,
          // T215 — a desativação vigente na empresa, se houver.
          desativacoes: selecaoDaDesativacaoVigente(empresaId),
          vinculos: {
            where: noEscopo,
            select: {
              id: true,
              empresaId: true,
              matricula: true,
              tipo: true,
              situacao: true,
              dataAdmissao: true,
              dataDesligamento: true,
              // T184 — a lotação vigente: a alocação ABERTA do vínculo (no
              // máximo uma; o banco garante). Cargo e departamento são da
              // mesma empresa do vínculo pela FK composta, e o vínculo já está
              // no escopo da sessão.
              alocacoes: {
                where: { vigenteAte: null },
                take: 1,
                select: {
                  cargo: { select: { id: true, codigo: true, nome: true } },
                  departamento: {
                    select: { id: true, codigo: true, nome: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.colaborador.count({ where }),
      contarGrupo("ativos"),
      this.prisma.colaborador.count({ where: base }),
      contarGrupo("em_admissao"),
      contarGrupo("desligados"),
      this.prisma.vinculoFuncional.findMany({
        // T215 — o desativado não conta entre os ativos por tipo.
        where: {
          ...noEscopo,
          situacao: "ativo",
          colaborador: semDesativacaoVigente(empresaId),
        },
        select: {
          colaboradorId: true,
          tipo: true,
          dataAdmissao: true,
          matricula: true,
        },
      }),
      this.prisma.colaborador.count({
        where: { AND: [base, comDesativacaoVigente(empresaId)] },
      }),
      // T215 — indicadores do cartão: admitidos no mês, desligados no ano e
      // a série de 6 meses, sem quem está desativado na empresa.
      this.prisma.vinculoFuncional.findMany({
        where: {
          ...noEscopo,
          situacao: { in: ["ativo", "encerrado"] },
          colaborador: semDesativacaoVigente(empresaId),
        },
        select: {
          colaboradorId: true,
          situacao: true,
          dataAdmissao: true,
          dataDesligamento: true,
        },
      }),
    ]);

    if (escopo.global) {
      // Consulta ampla do Master: auditada (fail-safe), sem dado pessoal.
      await this.auditoria.registrarConsultaGlobal(ctx, "colaborador", null);
    }

    // T185 — jornadas perto de hoje dos vínculos ATIVOS desta página, numa
    // consulta só. O vínculo de jornada é do colaborador na empresa (T183),
    // e os vínculos já vêm do escopo da sessão: nenhum par sai dele.
    const jornadasPorPar = await this.jornadasPertoDeHoje(
      linhas.flatMap((c) =>
        c.vinculos
          .filter((v) => v.situacao === "ativo")
          .map((v) => ({ colaboradorId: c.id, empresaId: v.empresaId })),
      ),
    );

    // T209 — a foto da página, numa consulta só (sem ler o armazenamento).
    const fotos = await this.fotosAnunciadas(
      ctx,
      empresaId,
      linhas.map((c) => c.id),
    );

    // T215 — CPF, contatos e salário da página, em lote e com a trilha.
    const dadosDasLinhas = await this.dadosDasLinhas(ctx, empresaId, linhas);

    const itens: ColaboradorListado[] = linhas.map((c) => ({
      id: c.id,
      nome: c.nome,
      situacao:
        c.desativacoes.length > 0
          ? "inativo"
          : empresaId !== undefined
            ? c.vinculos.some((v) => v.situacao === "ativo")
              ? "ativo"
              : "inativo"
            : c.situacao,
      criadoEm: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
      vinculos: ordenarVinculosListados(
        c.vinculos.map(({ alocacoes, ...vinculo }) => ({
          ...vinculo,
          lotacaoVigente: alocacoes[0]
            ? {
                cargo: alocacoes[0].cargo,
                departamento: alocacoes[0].departamento,
              }
            : null,
          vigenciasDeJornada:
            vinculo.situacao === "ativo"
              ? (jornadasPorPar.get(chaveDoPar(c.id, vinculo.empresaId)) ?? [])
              : [],
        })),
      ),
      foto: fotos.get(c.id) ?? null,
      desativado: c.desativacoes.length > 0,
      ...(dadosDasLinhas.get(c.id) ?? {}),
    }));

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
      contadores: {
        ativos,
        inativos: totalNoEscopo - ativos,
        emAdmissao,
        desligados,
        desativados,
        total: totalNoEscopo,
        ativosPorTipo: distribuirAtivosPorTipo(vinculosAtivos),
        ...indicadoresDoEscopo(vinculosDoEscopo, dataLocalDe(new Date())),
      },
    };
  }

  /**
   * T215 — CPF, contatos e salário bruto das linhas da página, em três
   * consultas (nunca uma por linha).
   *
   * - Só com empresa ativa (o `master_tecnico` global não recebe nenhum dos
   *   três: os dados são por empresa, como a foto).
   * - Cada campo só para quem o lê na ficha: `dados_pessoais_colaborador`
   *   (CPF), `contato_colaborador` (contatos) e `contrato_vinculo` (salário).
   *   Sem a permissão, o campo nem vai — a tela distingue "sem permissão" de
   *   "vazio".
   * - CPF e contatos de quem não está em uso operacional na empresa
   *   (desligado) vêm `null`: o dado é bloqueado, como na ficha.
   * - Toda leitura que devolve valor deixa a trilha de sempre, na mesma
   *   transação (fail-safe): o evento da categoria (leitura, valores
   *   devolvidos, só os NOMES dos campos) e o `audit_event` da consulta.
   */
  private async dadosDasLinhas(
    ctx: PessoasAuditContext,
    empresaId: string | undefined,
    linhas: readonly {
      id: string;
      vinculos: readonly {
        id: string;
        situacao: SituacaoVinculo;
        dataAdmissao: Date;
        matricula: string | null;
      }[];
    }[],
  ): Promise<Map<string, DadosDaLinha>> {
    const resultado = new Map<string, DadosDaLinha>();
    if (empresaId === undefined || linhas.length === 0) return resultado;
    const lerCpf = podeAcessarPessoas(
      ctx.actor,
      "dados_pessoais_colaborador",
      "read",
      empresaId,
    );
    const lerContatos = podeAcessarPessoas(
      ctx.actor,
      "contato_colaborador",
      "read",
      empresaId,
    );
    const lerSalario = podeAcessarPessoas(
      ctx.actor,
      "contrato_vinculo",
      "read",
      empresaId,
    );
    if (!lerCpf && !lerContatos && !lerSalario) return resultado;

    const operacionais = linhas
      .filter((c) => c.vinculos.some((v) => v.situacao !== "encerrado"))
      .map((c) => c.id);
    // O vínculo principal: a mesma ordem da linha, da ficha e do contrato.
    const principais = new Map<string, string>();
    for (const c of linhas) {
      const [principal] = [...c.vinculos].sort(
        (a, b) =>
          ORDEM_SITUACAO_VINCULO[a.situacao] -
            ORDEM_SITUACAO_VINCULO[b.situacao] ||
          b.dataAdmissao.getTime() - a.dataAdmissao.getTime() ||
          compararMatriculas(a.matricula, b.matricula),
      );
      if (principal) principais.set(c.id, principal.id);
    }

    await this.prisma.$transaction(async (tx) => {
      const perfis =
        lerCpf && operacionais.length > 0
          ? await tx.perfilPessoalColaborador.findMany({
              where: { empresaId, colaboradorId: { in: operacionais } },
              select: { id: true, colaboradorId: true, cpf: true },
            })
          : [];
      const contatos =
        lerContatos && operacionais.length > 0
          ? await tx.contatoColaborador.findMany({
              where: {
                empresaId,
                colaboradorId: { in: operacionais },
                ativo: true,
              },
              select: {
                id: true,
                colaboradorId: true,
                emailPessoal: true,
                celular: true,
              },
            })
          : [];
      const contratos = lerSalario
        ? await tx.contratoVinculo.findMany({
            where: { empresaId, vinculoId: { in: [...principais.values()] } },
            select: { vinculoId: true, salarioBruto: true },
          })
        : [];

      const cpfPor = new Map(perfis.map((p) => [p.colaboradorId, p]));
      const contatoPor = new Map(contatos.map((c) => [c.colaboradorId, c]));
      const salarioPor = new Map(
        contratos.map((c) => [
          c.vinculoId,
          c.salarioBruto === null ? null : c.salarioBruto.toFixed(2),
        ]),
      );

      for (const c of linhas) {
        const dados: DadosDaLinha = {};
        if (lerCpf) dados.cpf = cpfPor.get(c.id)?.cpf ?? null;
        if (lerContatos) {
          const contato = contatoPor.get(c.id);
          dados.contatos = contato
            ? { emailPessoal: contato.emailPessoal, celular: contato.celular }
            : null;
        }
        if (lerSalario) {
          const vinculoId = principais.get(c.id);
          dados.salarioBruto = vinculoId
            ? (salarioPor.get(vinculoId) ?? null)
            : null;
        }
        resultado.set(c.id, dados);
      }

      // A trilha de cada valor devolvido (só os NOMES dos campos).
      const cpfsLidos = perfis.filter((p) => p.cpf !== null);
      if (cpfsLidos.length > 0) {
        await tx.dadosPessoaisColaboradorEvento.createMany({
          data: cpfsLidos.map((p) => ({
            colaboradorId: p.colaboradorId,
            empresaId,
            categoria: "perfil_pessoal" as const,
            perfilId: p.id,
            enderecoId: null,
            acao: "leitura" as const,
            resultado: "valores_devolvidos" as const,
            campos: ["cpf" as const],
            atorUserId: ctx.actor.id,
            requestId: ctx.metadata.requestId,
          })),
        });
        for (const p of cpfsLidos) {
          await this.auditoria.registrarNaTransacao(tx, ctx, {
            action: "pessoas_dados_pessoais_consultados",
            resource: "dados_pessoais_colaborador",
            resourceId: p.colaboradorId,
            empresaId,
            result: "success",
          });
        }
      }
      // A leitura alcança o registro de contato inteiro (a regra do banco
      // para a leitura com valores: os três campos), como na ficha — mesmo
      // que a linha mostre só e-mail e celular.
      const contatosLidos = contatos.map((c) => ({
        contato: c,
        campos: ["email_pessoal", "celular", "telefone"] as const,
      }));
      if (contatosLidos.length > 0) {
        await tx.contatoColaboradorEvento.createMany({
          data: contatosLidos.map(({ contato, campos }) => ({
            colaboradorId: contato.colaboradorId,
            empresaId,
            contatoId: contato.id,
            acao: "leitura" as const,
            resultado: "valores_devolvidos" as const,
            campos: [...campos],
            atorUserId: ctx.actor.id,
            requestId: ctx.metadata.requestId,
          })),
        });
        for (const { contato } of contatosLidos) {
          await this.auditoria.registrarNaTransacao(tx, ctx, {
            action: "pessoas_contato_consultado",
            resource: "contato_colaborador",
            resourceId: contato.colaboradorId,
            empresaId,
            result: "success",
          });
        }
      }
    });
    return resultado;
  }

  async detalhar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<ColaboradorDetalhado> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const colaborador = await this.carregarNoEscopo(
      colaboradorId,
      ctx,
      escopo,
      "read",
    );
    const fotos = await this.fotosAnunciadas(
      ctx,
      escopo.global ? undefined : escopo.empresaId,
      [colaborador.id],
    );
    return { ...colaborador, foto: fotos.get(colaborador.id) ?? null };
  }

  /**
   * T209 — a versão da foto de cada colaborador, SÓ na empresa ativa e só
   * para quem lê dados pessoais nela (a mesma regra da rota da foto, ADR
   * 0020). Global (sem empresa ativa): nada — a rota não entregaria. Lê só o
   * banco: o armazenamento de objetos nunca é tocado aqui.
   */
  private async fotosAnunciadas(
    ctx: PessoasAuditContext,
    empresaId: string | undefined,
    colaboradorIds: readonly string[],
  ): Promise<Map<string, FotoAnunciada>> {
    if (
      empresaId === undefined ||
      colaboradorIds.length === 0 ||
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "read",
        empresaId,
      )
    ) {
      return new Map();
    }
    const fotos = await this.prisma.fotoColaborador.findMany({
      where: { empresaId, colaboradorId: { in: [...colaboradorIds] } },
      select: { colaboradorId: true, versao: true },
    });
    return new Map(fotos.map((f) => [f.colaboradorId, { versao: f.versao }]));
  }

  /**
   * Retificação de cadastro — **só o nome** (spec §4.10 aplicado ao cadastro).
   *
   * A trilha registra *que* houve retificação, nunca o valor anterior nem o
   * novo (ADR 0004 §5): o valor seria dado pessoal, e a trilha não é
   * repositório de dado pessoal.
   */
  async retificar(
    colaboradorId: string,
    dto: RetificarColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const colaborador = await this.carregarNoEscopo(
      colaboradorId,
      ctx,
      // Mutação é sempre escopada (master_tecnico nunca chega aqui): reusa o
      // carregador de leitura na forma escopada.
      { global: false, empresaId: escopo.empresaId },
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.colaborador.update({
        where: { id: colaborador.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_colaborador_atualizado",
        "colaborador",
        atualizado.id,
        escopo.empresaId,
      );

      return atualizado;
    });
  }

  private async carregarNoEscopo(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoLeituraPessoas,
    action: "read" | "alter" | "manage",
  ): Promise<Colaborador> {
    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: colaboradorId,
        // Escopado: só se tiver vínculo na empresa do ator. Global (Master):
        // sem filtro de empresa.
        ...filtroVinculoEmpresa(escopo),
      },
    });

    if (!colaborador) {
      // Inexistente e fora do escopo respondem igual (404) — a distinção
      // vazaria a existência de uma pessoa em outra empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaboradorId,
        null,
      );
    }

    if (!podeConsultarPessoas(ctx.actor, "colaborador", action, escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaborador.id,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (escopo.global && action === "read") {
      // Leitura global do Master: auditada (fail-safe), só id técnico.
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "colaborador",
        colaborador.id,
      );
    }

    return colaborador;
  }
}
