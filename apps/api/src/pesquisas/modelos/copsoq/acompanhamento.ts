import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../../../common/erros/recusa-por-campo";
import { DIMENSOES_NR1 } from "./definicao";

/**
 * T216 — conformidade com a NR-1: as 7 etapas que a empresa marca e guarda
 * e o plano de ação que o RH escreve. Funções puras: conferir o corpo do
 * PUT e montar o detalhe com o que é automático.
 *
 * - Etapa 1 (mapear) conclui sozinha: anônima com a 1ª resposta; as demais
 *   quando todos os convidados responderam.
 * - Etapa 2 (plano) conclui sozinha com a 1ª medida no plano.
 * - Etapas 3 a 7: a empresa marca os itens, descreve onde guardou as
 *   evidências e conclui (exige um item marcado ou a descrição).
 * - Etapa 7 (revisar): prevista para 1 ano depois da publicação.
 */

export const ETAPAS_NR1 = [
  "mapear",
  "plano",
  "comunicar",
  "validar",
  "treinar",
  "implementar",
  "revisar",
] as const;
export type EtapaNr1 = (typeof ETAPAS_NR1)[number];

/** Quantos itens de verificação cada etapa tem (as automáticas, nenhum). */
export const ITENS_DA_ETAPA: Readonly<Record<EtapaNr1, number>> = {
  mapear: 0,
  plano: 0,
  comunicar: 3,
  validar: 3,
  treinar: 3,
  implementar: 3,
  revisar: 2,
};

export const ETAPAS_AUTOMATICAS: readonly EtapaNr1[] = ["mapear", "plano"];

/** Ordem de prioridade dos controles (NR-1). */
export const CONTROLES = [
  "eliminacao",
  "substituicao",
  "administrativo",
  "protecao",
] as const;
export type Controle = (typeof CONTROLES)[number];

export const SITUACOES_DA_MEDIDA = [
  "planejada",
  "em_andamento",
  "concluida",
] as const;
export type SituacaoDaMedida = (typeof SITUACOES_DA_MEDIDA)[number];

export const LIMITES_DO_ACOMPANHAMENTO = {
  evidencias: 2000,
  medidas: 200,
  titulo: 200,
  descricao: 1000,
  responsavel: 120,
  indicador: 300,
  nome: 120,
  registro: 60,
} as const;

export interface EtapaGravada {
  id: EtapaNr1;
  itens: boolean[];
  evidencias: string | null;
  /** Instante (ISO) em que a empresa concluiu; nas automáticas, `null`. */
  concluidaEm: string | null;
}

export interface MedidaDoPlano {
  id: string;
  dimensaoId: string;
  titulo: string;
  descricao: string | null;
  controle: Controle;
  responsavel: string | null;
  /** AAAA-MM-DD. */
  prazo: string | null;
  indicador: string | null;
  situacao: SituacaoDaMedida;
}

export interface AcompanhamentoNr1 {
  etapas: EtapaGravada[];
  plano: MedidaDoPlano[];
  profissionalSst: { nome: string | null; registro: string | null };
  atualizadoEm: string | null;
}

export interface EtapaDoDetalhe extends EtapaGravada {
  concluida: boolean;
  automatica: boolean;
}

export interface AcompanhamentoNr1Detalhe extends AcompanhamentoNr1 {
  etapas: EtapaDoDetalhe[];
  concluidas: number;
  proxima: EtapaNr1 | null;
  /** Mês previsto da reaplicação (AAAA-MM), 1 ano depois da publicação. */
  revisarEm: string | null;
}

export function acompanhamentoVazio(): AcompanhamentoNr1 {
  return {
    etapas: ETAPAS_NR1.map((id) => ({
      id,
      itens: Array.from({ length: ITENS_DA_ETAPA[id] }, () => false),
      evidencias: null,
      concluidaEm: null,
    })),
    plano: [],
    profissionalSst: { nome: null, registro: null },
    atualizadoEm: null,
  };
}

/** O que está gravado (forma livre do JSON) no formato atual. */
export function lerAcompanhamento(bruto: unknown): AcompanhamentoNr1 {
  const vazio = acompanhamentoVazio();
  if (!bruto || typeof bruto !== "object") return vazio;
  const r = bruto as Partial<AcompanhamentoNr1>;
  const gravadas = new Map((r.etapas ?? []).map((e) => [e.id, e]));
  return {
    etapas: vazio.etapas.map((e) => {
      const g = gravadas.get(e.id);
      return g
        ? {
            id: e.id,
            itens: e.itens.map((_, i) => g.itens?.[i] === true),
            evidencias: g.evidencias ?? null,
            concluidaEm: g.concluidaEm ?? null,
          }
        : e;
    }),
    plano: Array.isArray(r.plano) ? r.plano : [],
    profissionalSst: {
      nome: r.profissionalSst?.nome ?? null,
      registro: r.profissionalSst?.registro ?? null,
    },
    atualizadoEm: r.atualizadoEm ?? null,
  };
}

type Registro = Record<string, unknown>;
const ehRegistro = (v: unknown): v is Registro =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Texto opcional: aparado, vazio vira `null`, `undefined` se inválido. */
function opcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const DIMENSOES = new Set(DIMENSOES_NR1.map((d) => d.id));

function diaValido(v: string): boolean {
  if (!DIA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Confere o corpo do PUT: `{ etapas, plano, profissionalSst }`. As etapas
 * automáticas não se marcam; concluir exige um item ou a descrição das
 * evidências; a data de conclusão já gravada se mantém.
 */
export function conferirAcompanhamento(
  corpo: unknown,
  anterior: AcompanhamentoNr1,
  agora: Date,
):
  { ok: true; valor: AcompanhamentoNr1 } | { ok: false; erros: ErroDeCampo[] } {
  const erros: ErroDeCampo[] = [];
  const c = ehRegistro(corpo) ? corpo : {};
  const L = LIMITES_DO_ACOMPANHAMENTO;

  const brutas = Array.isArray(c.etapas) ? c.etapas : null;
  if (brutas === null) erros.push({ campo: "etapas", motivo: "invalido" });
  const porId = new Map<string, Registro>();
  for (const b of brutas ?? []) {
    if (!ehRegistro(b) || typeof b.id !== "string" || porId.has(b.id)) {
      erros.push({ campo: "etapas", motivo: "invalido" });
      break;
    }
    porId.set(b.id, b);
  }
  if ([...porId.keys()].some((id) => !ETAPAS_NR1.includes(id as EtapaNr1))) {
    erros.push({ campo: "etapas", motivo: "invalido" });
  }
  const antes = new Map(anterior.etapas.map((e) => [e.id, e]));
  const etapas: EtapaGravada[] = ETAPAS_NR1.map((id) => {
    const b = porId.get(id);
    const campo = campoDaPergunta(`etapas.${id}`);
    const vazia = antes.get(id)!;
    if (!b) return vazia;
    if (ETAPAS_AUTOMATICAS.includes(id)) {
      if (b.concluida === true) erros.push({ campo, motivo: "nao_se_aplica" });
      return vazia;
    }
    const total = ITENS_DA_ETAPA[id];
    const itens = Array.isArray(b.itens) ? b.itens : [];
    if (itens.length !== total || itens.some((x) => typeof x !== "boolean")) {
      erros.push({ campo, motivo: "invalido" });
    }
    const evidencias = opcional(b.evidencias, L.evidencias);
    if (evidencias === undefined) erros.push({ campo, motivo: "limite" });
    const marcados = itens.map((x) => x === true);
    const concluida = b.concluida === true;
    if (concluida && !marcados.some(Boolean) && !evidencias) {
      erros.push({ campo, motivo: "obrigatorio" });
    }
    return {
      id,
      itens: marcados.slice(0, total),
      evidencias: evidencias ?? null,
      concluidaEm: concluida
        ? (vazia.concluidaEm ?? agora.toISOString())
        : null,
    };
  });

  const brutasDoPlano = Array.isArray(c.plano) ? c.plano : null;
  if (brutasDoPlano === null)
    erros.push({ campo: "plano", motivo: "invalido" });
  else if (brutasDoPlano.length > L.medidas) {
    erros.push({ campo: "plano", motivo: "limite" });
  }
  const ids = new Set<string>();
  const plano: MedidaDoPlano[] = [];
  for (const b of (brutasDoPlano ?? []).slice(0, L.medidas)) {
    const campo = campoDaPergunta(
      `plano.${ehRegistro(b) && typeof b.id === "string" && ID.test(b.id) ? b.id : "medida"}`,
    );
    if (!ehRegistro(b) || typeof b.id !== "string" || !ID.test(b.id)) {
      erros.push({ campo: "plano", motivo: "invalido" });
      continue;
    }
    if (ids.has(b.id)) {
      erros.push({ campo: "plano", motivo: "invalido" });
      continue;
    }
    ids.add(b.id);
    const titulo = opcional(b.titulo, L.titulo);
    const descricao = opcional(b.descricao, L.descricao);
    const responsavel = opcional(b.responsavel, L.responsavel);
    const indicador = opcional(b.indicador, L.indicador);
    const prazo =
      b.prazo === null || b.prazo === undefined || b.prazo === ""
        ? null
        : typeof b.prazo === "string" && diaValido(b.prazo)
          ? b.prazo
          : undefined;
    if (!titulo) {
      erros.push({
        campo,
        motivo: titulo === undefined ? "limite" : "obrigatorio",
      });
    }
    if (
      descricao === undefined ||
      responsavel === undefined ||
      indicador === undefined
    ) {
      erros.push({ campo, motivo: "limite" });
    }
    if (
      typeof b.dimensaoId !== "string" ||
      !DIMENSOES.has(b.dimensaoId) ||
      !CONTROLES.includes(b.controle as Controle) ||
      !SITUACOES_DA_MEDIDA.includes(b.situacao as SituacaoDaMedida) ||
      prazo === undefined
    ) {
      erros.push({ campo, motivo: "invalido" });
    }
    plano.push({
      id: b.id,
      dimensaoId: String(b.dimensaoId),
      titulo: titulo ?? "",
      descricao: descricao ?? null,
      controle: b.controle as Controle,
      responsavel: responsavel ?? null,
      prazo: prazo ?? null,
      indicador: indicador ?? null,
      situacao: b.situacao as SituacaoDaMedida,
    });
  }

  const sst = ehRegistro(c.profissionalSst) ? c.profissionalSst : {};
  const nome = opcional(sst.nome, L.nome);
  const registro = opcional(sst.registro, L.registro);
  if (nome === undefined || registro === undefined) {
    erros.push({ campo: "profissionalSst", motivo: "limite" });
  }

  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    valor: {
      etapas,
      plano,
      profissionalSst: { nome: nome ?? null, registro: registro ?? null },
      atualizadoEm: agora.toISOString(),
    },
  };
}

/** AAAA-MM um ano depois do instante. */
function umAnoDepois(instante: Date): string {
  const brasilia = new Date(instante.getTime() - 3 * 3_600_000);
  return `${brasilia.getUTCFullYear() + 1}-${String(brasilia.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** O detalhe com as etapas automáticas resolvidas e a próxima etapa. */
export function detalharAcompanhamento(
  a: AcompanhamentoNr1,
  contexto: {
    anonima: boolean;
    respostas: number;
    participantes: number;
    publicadaEm: Date | null;
  },
): AcompanhamentoNr1Detalhe {
  const mapeado = contexto.anonima
    ? contexto.respostas > 0
    : contexto.participantes > 0 &&
      contexto.respostas >= contexto.participantes;
  const etapas: EtapaDoDetalhe[] = a.etapas.map((e) => {
    const automatica = ETAPAS_AUTOMATICAS.includes(e.id);
    const concluida =
      e.id === "mapear"
        ? mapeado
        : e.id === "plano"
          ? a.plano.length > 0
          : e.concluidaEm !== null;
    return { ...e, concluida, automatica };
  });
  return {
    ...a,
    etapas,
    concluidas: etapas.filter((e) => e.concluida).length,
    proxima: etapas.find((e) => !e.concluida)?.id ?? null,
    revisarEm: contexto.publicadaEm ? umAnoDepois(contexto.publicadaEm) : null,
  };
}
