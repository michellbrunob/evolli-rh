/**
 * T215 — o quadro "Escala de trabalho" em funções puras (dia civil
 * `AAAA-MM-DD`, aritmética em UTC):
 *
 * - o período da visão (semana de segunda a domingo; mês do dia 1 ao último)
 *   e o título dele;
 * - a célula de cada pessoa em cada dia, pelos padrões dela, com a MESMA
 *   regra da aba Escala da ficha (`resolverDia`): trabalho (turno, horário e
 *   horas líquidas), folga, DSR, sem escala ou fora do vínculo;
 * - "Escalados no dia", horas da pessoa e do grupo, e a meta do mês (a
 *   jornada por semana — contrato e limite legal da data — vezes dias ÷ 7);
 * - busca, ordem e agrupamento (departamento, unidade, turno, gestor).
 */
import type {
  AusenciaNoQuadroApi,
  DiaGravadoApi,
  EscalaApi,
  PeriodoDoDiaApi,
  PessoaDoQuadroApi,
  TurnoDaEscalaApi,
} from "../../../api/escalaClient";
import {
  diaDaSemana,
  jornadaPorSemana,
  minutosNoDia,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import {
  escalaDoDia,
  padraoDe,
  resolverDia,
} from "../../pessoas/ficha/escala/diaDaEscala";
import { modeloDe } from "../../pessoas/ficha/escala/modelosDeEscala";
import { ausenciaDoDia } from "./ausenciasDoQuadro";

export type Visao = "semana" | "mes";

export type Agrupamento =
  "departamento" | "unidade" | "turno" | "gestor" | "nenhum";

export const ROTULO_DO_AGRUPAMENTO: Readonly<Record<Agrupamento, string>> = {
  departamento: "Departamento",
  unidade: "Unidade",
  turno: "Turno",
  gestor: "Gestor",
  nenhum: "Nenhum",
};

/** Plural do nome do grupo ("4 departamentos"). */
const GRUPOS_NO_PLURAL: Readonly<
  Record<Exclude<Agrupamento, "nenhum">, [string, string]>
> = {
  departamento: ["departamento", "departamentos"],
  unidade: ["unidade", "unidades"],
  turno: ["turno", "turnos"],
  gestor: ["gestor", "gestores"],
};

export function nomeDosGrupos(
  por: Exclude<Agrupamento, "nenhum">,
  n: number,
): string {
  const [um, varios] = GRUPOS_NO_PLURAL[por];
  return `${n} ${n === 1 ? um : varios}`;
}

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const LETRAS_DOS_DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

function ultimoDiaDoMes(dia: string): string {
  const ano = Number(dia.slice(0, 4));
  const mes = Number(dia.slice(5, 7));
  const d = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${dia.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

export function segundaDaSemana(dia: string): string {
  return somarDias(dia, 1 - diaDaSemana(dia));
}

/**
 * O primeiro dia da semana do dia. T215 — a semana começa no dia das Regras
 * (1 = segunda … 7 = domingo).
 */
export function inicioDaSemana(dia: string, semanaComeca = 1): string {
  return somarDias(dia, -((diaDaSemana(dia) - semanaComeca + 7) % 7));
}

/** Primeiro e último dia mostrados (os dois contam). */
export function periodoDa(
  visao: Visao,
  ancora: string,
  semanaComeca = 1,
): { inicio: string; fim: string } {
  if (visao === "semana") {
    const inicio = inicioDaSemana(ancora, semanaComeca);
    return { inicio, fim: somarDias(inicio, 6) };
  }
  return { inicio: `${ancora.slice(0, 7)}-01`, fim: ultimoDiaDoMes(ancora) };
}

/** A âncora do período seguinte (`+1`) ou anterior (`-1`). */
export function deslocar(
  visao: Visao,
  ancora: string,
  passo: 1 | -1,
  semanaComeca = 1,
): string {
  if (visao === "semana") {
    return somarDias(inicioDaSemana(ancora, semanaComeca), 7 * passo);
  }
  const ano = Number(ancora.slice(0, 4));
  const mes = Number(ancora.slice(5, 7)) - 1 + passo;
  const d = new Date(Date.UTC(ano, mes, 1));
  return d.toISOString().slice(0, 10);
}

export function diasDoPeriodo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

function diaNum(dia: string): number {
  return Number(dia.slice(8, 10));
}

function nomeDoMes(dia: string): string {
  return MESES[Number(dia.slice(5, 7)) - 1]!;
}

/**
 * "23 a 29 de novembro de 2026", "30 de novembro a 6 de dezembro de 2026",
 * "28 de dezembro de 2026 a 3 de janeiro de 2027"; no mês, "Março de 2027".
 */
export function tituloDoPeriodo(
  visao: Visao,
  inicio: string,
  fim: string,
): string {
  if (visao === "mes") {
    const nome = nomeDoMes(inicio);
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${inicio.slice(0, 4)}`;
  }
  const anoI = inicio.slice(0, 4);
  const anoF = fim.slice(0, 4);
  if (anoI !== anoF) {
    return `${diaNum(inicio)} de ${nomeDoMes(inicio)} de ${anoI} a ${diaNum(fim)} de ${nomeDoMes(fim)} de ${anoF}`;
  }
  if (inicio.slice(5, 7) !== fim.slice(5, 7)) {
    return `${diaNum(inicio)} de ${nomeDoMes(inicio)} a ${diaNum(fim)} de ${nomeDoMes(fim)} de ${anoF}`;
  }
  return `${diaNum(inicio)} a ${diaNum(fim)} de ${nomeDoMes(fim)} de ${anoF}`;
}

const DIA_DA_API = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

type PeriodoApi = TurnoDaEscalaApi["periodos"][number];

/** Os períodos do turno no dia (jornada igual todo dia vale para qualquer dia). */
export function periodosNoDia(
  turno: TurnoDaEscalaApi,
  dia: string,
): PeriodoApi[] {
  const porDia = new Map<string, PeriodoApi[]>();
  for (const p of turno.periodos) {
    porDia.set(p.dia, [...(porDia.get(p.dia) ?? []), p]);
  }
  const assinaturas = new Set(
    [...porDia.values()].map((ps) =>
      ps
        .map((p) => `${p.inicio}-${p.fim}`)
        .sort()
        .join(","),
    ),
  );
  const lista =
    assinaturas.size === 1
      ? [...porDia.values()][0]!
      : (porDia.get(DIA_DA_API[diaDaSemana(dia) - 1]!) ?? []);
  return [...lista].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export type TipoDaCelula =
  | "trabalho"
  | "folga"
  | "dsr"
  | "sobreaviso"
  | "sem-escala"
  | "fora"
  | "ausencia";

/** O turno como a célula precisa: nome, cor e sigla. */
export interface TurnoDaCelula {
  readonly id: string;
  readonly nome: string;
  readonly cor?: string | null;
  readonly sigla?: string | null;
}

export interface CelulaDoQuadro {
  readonly dia: string;
  readonly tipo: TipoDaCelula;
  /** No trabalho: o turno do dia, ou `null` (sem turno fixo). */
  readonly turno: TurnoDaCelula | null;
  /** "09:00–18:00" (turno partido: "08:00–12:00 · 14:00–18:00"), ou `null`. */
  readonly horario: string | null;
  /** Horas líquidas do dia, em minutos. */
  readonly minutos: number;
  /** De onde vem o dia: o padrão da pessoa, o publicado ou o rascunho. */
  readonly origem: "padrao" | "publicado" | "rascunho";
  readonly periodos: readonly PeriodoDoDiaApi[];
  readonly intervaloMinutos: number;
  readonly sobreaviso: readonly PeriodoDoDiaApi[];
  readonly unidade: { readonly id: string; readonly nome: string } | null;
  readonly observacao: string | null;
  /** Na ausência: a ausência aprovada que cobre o dia (vence o turno). */
  readonly ausencia?: AusenciaNoQuadroApi | null;
}

/** Fora do vínculo: antes da admissão ou depois do último dia. */
function foraDoVinculo(p: PessoaDoQuadroApi, dia: string): boolean {
  return (
    dia < p.dataAdmissao ||
    (p.dataDesligamento !== null && dia > p.dataDesligamento)
  );
}

function minutosDaHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Duração do período; o fim antes (ou igual) do início é do dia seguinte. */
export function duracao(p: PeriodoDoDiaApi): number {
  const d = minutosDaHora(p.fim) - minutosDaHora(p.inicio);
  return d > 0 ? d : d + 24 * 60;
}

/** Trabalho do dia: a soma dos períodos, menos o intervalo num corrido. */
export function minutosDosPeriodos(
  periodos: readonly PeriodoDoDiaApi[],
  intervaloMinutos: number,
): number {
  const total = periodos.reduce((t, p) => t + duracao(p), 0);
  return periodos.length === 1 ? Math.max(0, total - intervaloMinutos) : total;
}

export function faixaDosPeriodos(periodos: readonly PeriodoDoDiaApi[]): string {
  return periodos.map((p) => `${p.inicio}–${p.fim}`).join(" · ");
}

/** O dia gravado que vale: o rascunho por cima do publicado. */
export function diaGravado(
  p: PessoaDoQuadroApi,
  dia: string,
): DiaGravadoApi | null {
  const doDia = (p.dias ?? []).filter((d) => d.dia === dia);
  return (
    doDia.find((d) => d.camada === "rascunho") ??
    doDia.find((d) => d.camada === "publicado") ??
    null
  );
}

export function celulaDoDia(p: PessoaDoQuadroApi, dia: string): CelulaDoQuadro {
  const vazio = {
    dia,
    turno: null,
    horario: null,
    minutos: 0,
    origem: "padrao" as const,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidade: null,
    observacao: null,
  };
  if (foraDoVinculo(p, dia)) return { ...vazio, tipo: "fora" };

  const g = diaGravado(p, dia);
  // Ausência aprovada vence o turno: só a observação do dia continua.
  const ausencia = ausenciaDoDia(p, dia);
  if (ausencia) {
    return {
      ...vazio,
      tipo: "ausencia",
      ausencia,
      origem: g?.camada ?? "padrao",
      observacao: g?.observacao ?? null,
    };
  }
  if (g) {
    const comum = {
      ...vazio,
      origem: g.camada,
      unidade: g.unidade,
      observacao: g.observacao,
    };
    if (g.tipo === "folga" || g.tipo === "dsr")
      return { ...comum, tipo: g.tipo };
    return {
      ...comum,
      tipo: g.tipo,
      turno: g.tipo === "trabalho" ? g.turno : null,
      periodos: g.periodos,
      intervaloMinutos: g.intervaloMinutos,
      sobreaviso: g.sobreaviso,
      horario:
        g.periodos.length > 0
          ? `${g.periodos[0]!.inicio}–${g.periodos[g.periodos.length - 1]!.fim}`
          : null,
      minutos:
        g.tipo === "trabalho"
          ? minutosDosPeriodos(g.periodos, g.intervaloMinutos)
          : 0,
    };
  }

  const r = resolverDia(p.escalas, dia);
  if (r.tipo === "sem-escala") return { ...vazio, tipo: "sem-escala" };
  if (r.tipo === "folga" || r.tipo === "dsr") return { ...vazio, tipo: r.tipo };
  if (r.turno === null) return { ...vazio, tipo: "trabalho" };
  const periodos = periodosNoDia(r.turno, dia);
  // Jornada que muda por dia da semana e não tem período hoje: folga do turno.
  if (periodos.length === 0) return { ...vazio, tipo: "folga" };
  const escala = escalaDoDia(p.escalas, dia)!;
  const intervalo = r.turno.intervaloMinutos ?? 0;
  return {
    ...vazio,
    tipo: "trabalho",
    turno: r.turno,
    horario: `${periodos[0]!.inicio}–${periodos[periodos.length - 1]!.fim}`,
    minutos: minutosNoDia(padraoDe(escala), dia),
    periodos: periodos.map((x) => ({ inicio: x.inicio, fim: x.fim })),
    intervaloMinutos: periodos.length === 1 ? intervalo : 0,
  };
}

/** A escala que descreve a pessoa no período: a do dia de referência ou a mais nova. */
function escalaDaPessoa(
  p: PessoaDoQuadroApi,
  referencia: string,
): EscalaApi | null {
  return escalaDoDia(p.escalas, referencia) ?? p.escalas[0] ?? null;
}

/** "5x2 · Comercial", "6x1", "5x2" (só no contrato) ou "Sem escala fixa". */
export function rotuloDaEscala(
  p: PessoaDoQuadroApi,
  referencia: string,
): string {
  const e = escalaDaPessoa(p, referencia);
  if (e) {
    const nome = modeloDe(e.modelo)?.nome ?? e.modelo;
    return e.turno ? `${nome} · ${e.turno.nome}` : nome;
  }
  if (p.escalaDoCadastro) {
    return modeloDe(p.escalaDoCadastro)?.nome ?? p.escalaDoCadastro;
  }
  return "Sem escala fixa";
}

/** O turno da pessoa no período (para agrupar), ou `null`. */
export function turnoDaPessoa(
  p: PessoaDoQuadroApi,
  referencia: string,
): TurnoDaEscalaApi | null {
  return escalaDaPessoa(p, referencia)?.turno ?? null;
}

/** Minutos previstos no mês: a jornada por semana de cada dia ÷ 7. */
export function metaDoPeriodo(
  p: PessoaDoQuadroApi,
  dias: readonly string[],
  inicioTransicao?: string,
): number {
  let total = 0;
  for (const dia of dias) {
    total += jornadaPorSemana(p.jornadaSemanalHoras, dia, inicioTransicao);
  }
  return Math.round(total / 7);
}

/**
 * "Pedro Teste" → "PT"; uma palavra só, as duas primeiras letras ("teste" →
 * "TE"). Palavras sem letra (números) não contam.
 */
export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca pelo nome, sem diferenciar acento nem maiúscula. */
export function buscar(
  pessoas: readonly PessoaDoQuadroApi[],
  termo: string,
): PessoaDoQuadroApi[] {
  const t = semAcento(termo.trim());
  if (!t) return [...pessoas];
  return pessoas.filter((p) => semAcento(p.nome).includes(t));
}

export const NAO_INFORMADO = "Não informado";

export interface GrupoDoQuadro {
  readonly chave: string;
  readonly nome: string;
  readonly pessoas: readonly PessoaDoQuadroApi[];
  /** A unidade comum a todas as pessoas do grupo, ou `null`. */
  readonly unidade: string | null;
}

function grupoDe(
  p: PessoaDoQuadroApi,
  por: Agrupamento,
  referencia: string,
): { chave: string; nome: string } {
  const ref =
    por === "departamento"
      ? p.departamento
      : por === "unidade"
        ? p.unidade
        : por === "gestor"
          ? p.gestor
          : por === "turno"
            ? turnoDaPessoa(p, referencia)
            : null;
  if (por === "nenhum") return { chave: "todos", nome: "" };
  return ref
    ? { chave: ref.id, nome: ref.nome }
    : { chave: "", nome: NAO_INFORMADO };
}

/**
 * Agrupa mantendo a ordem das pessoas dentro de cada grupo; grupos em ordem
 * alfabética, "Não informado" por último. Sem agrupamento, um grupo só.
 */
export function agrupar(
  pessoas: readonly PessoaDoQuadroApi[],
  por: Agrupamento,
  referencia: string,
): GrupoDoQuadro[] {
  const grupos = new Map<
    string,
    { nome: string; pessoas: PessoaDoQuadroApi[] }
  >();
  for (const p of pessoas) {
    const g = grupoDe(p, por, referencia);
    const atual = grupos.get(g.chave) ?? { nome: g.nome, pessoas: [] };
    atual.pessoas.push(p);
    grupos.set(g.chave, atual);
  }
  return [...grupos.entries()]
    .map(([chave, g]) => {
      const unidades = new Set(g.pessoas.map((p) => p.unidade?.nome ?? null));
      const unica = unidades.size === 1 ? [...unidades][0]! : null;
      return {
        chave,
        nome: g.nome,
        pessoas: g.pessoas,
        unidade: por === "unidade" ? null : unica,
      };
    })
    .sort((a, b) => {
      if (a.chave === "" && b.chave !== "") return 1;
      if (b.chave === "" && a.chave !== "") return -1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/** Ordena pelo nome, crescente ou decrescente. */
export function ordenar(
  pessoas: readonly PessoaDoQuadroApi[],
  ordem: "asc" | "desc",
): PessoaDoQuadroApi[] {
  const lista = [...pessoas].sort(
    (a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.colaboradorId.localeCompare(b.colaboradorId),
  );
  return ordem === "asc" ? lista : lista.reverse();
}
