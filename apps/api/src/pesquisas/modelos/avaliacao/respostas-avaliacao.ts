import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../../../common/erros/recusa-por-campo";
import {
  exigeComentario,
  mediasPorCompetencia,
  type RegraDeComentarios,
} from "./calculo-avaliacao";
import { COMPETENCIAS, type Competencia, ITENS } from "./definicao";

/**
 * T216 — a resposta de uma avaliação (gestor ou autoavaliação): as 24
 * afirmações, todas obrigatórias, de 1 a 5, e os comentários por competência
 * (até 1000 caracteres), exigidos conforme a regra. Os comentários são
 * gravados nos valores da resposta como `comentario_<competência>`.
 */

export const LIMITE_DO_COMENTARIO = 1000;
export const PREFIXO_DO_COMENTARIO = "comentario_";

export interface RespostaDaAvaliacaoConferida {
  notas: Record<string, number>;
  comentarios: Partial<Record<Competencia, string>>;
  /** O que vai para `pesquisa_resposta.valores`. */
  valores: { perguntaId: string; valor: number | string }[];
}

export function conferirRespostaDaAvaliacao(
  respostas: unknown,
  comentarios: unknown,
  regra: RegraDeComentarios,
): { resposta: RespostaDaAvaliacaoConferida | null; erros: ErroDeCampo[] } {
  const erros: ErroDeCampo[] = [];
  const recebidas = new Map<string, unknown>();
  if (!Array.isArray(respostas)) {
    return {
      resposta: null,
      erros: [{ campo: "respostas", motivo: "invalido" }],
    };
  }
  for (const r of respostas) {
    if (typeof r !== "object" || r === null) {
      return {
        resposta: null,
        erros: [{ campo: "respostas", motivo: "invalido" }],
      };
    }
    const { perguntaId, valor } = r as {
      perguntaId?: unknown;
      valor?: unknown;
    };
    if (typeof perguntaId !== "string" || recebidas.has(perguntaId)) {
      return {
        resposta: null,
        erros: [{ campo: "respostas", motivo: "invalido" }],
      };
    }
    recebidas.set(perguntaId, valor);
  }
  const notas: Record<string, number> = {};
  for (const i of ITENS) {
    const v = recebidas.get(i.id);
    if (v === undefined || v === null) {
      erros.push({ campo: campoDaPergunta(i.id), motivo: "obrigatorio" });
    } else if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) {
      erros.push({ campo: campoDaPergunta(i.id), motivo: "invalido" });
    } else {
      notas[i.id] = v as number;
    }
  }
  if ([...recebidas.keys()].some((k) => !ITENS.some((i) => i.id === k))) {
    erros.push({ campo: "respostas", motivo: "invalido" });
  }
  const c =
    typeof comentarios === "object" &&
    comentarios !== null &&
    !Array.isArray(comentarios)
      ? (comentarios as Record<string, unknown>)
      : comentarios === undefined || comentarios === null
        ? {}
        : null;
  if (c === null) {
    erros.push({ campo: "comentarios", motivo: "invalido" });
    return { resposta: null, erros };
  }
  const textos: Partial<Record<Competencia, string>> = {};
  for (const [chave, valor] of Object.entries(c)) {
    if (!(COMPETENCIAS as readonly string[]).includes(chave)) {
      erros.push({ campo: "comentarios", motivo: "invalido" });
      continue;
    }
    if (valor === null || valor === undefined) continue;
    if (typeof valor !== "string") {
      erros.push({ campo: "comentarios", motivo: "invalido" });
      continue;
    }
    const t = valor.trim();
    if (t.length > LIMITE_DO_COMENTARIO) {
      erros.push({
        campo: campoDaPergunta(`${PREFIXO_DO_COMENTARIO}${chave}`),
        motivo: "limite",
      });
    } else if (t) {
      textos[chave as Competencia] = t;
    }
  }
  if (!erros.length) {
    const medias = mediasPorCompetencia(notas);
    for (const comp of COMPETENCIAS) {
      if (exigeComentario(regra, medias[comp]) && !textos[comp]) {
        erros.push({
          campo: campoDaPergunta(`${PREFIXO_DO_COMENTARIO}${comp}`),
          motivo: "obrigatorio",
        });
      }
    }
  }
  if (erros.length) return { resposta: null, erros };
  return {
    resposta: {
      notas,
      comentarios: textos,
      valores: [
        ...ITENS.map((i) => ({ perguntaId: i.id, valor: notas[i.id]! })),
        ...COMPETENCIAS.filter((comp) => textos[comp]).map((comp) => ({
          perguntaId: `${PREFIXO_DO_COMENTARIO}${comp}`,
          valor: textos[comp]!,
        })),
      ],
    },
    erros,
  };
}

/** Lê os valores gravados de volta em notas e comentários. */
export function lerRespostaDaAvaliacao(valores: unknown): {
  notas: Record<string, number>;
  comentarios: Partial<Record<Competencia, string>>;
} {
  const notas: Record<string, number> = {};
  const comentarios: Partial<Record<Competencia, string>> = {};
  if (!Array.isArray(valores)) return { notas, comentarios };
  for (const v of valores as { perguntaId?: unknown; valor?: unknown }[]) {
    if (typeof v?.perguntaId !== "string") continue;
    if (v.perguntaId.startsWith(PREFIXO_DO_COMENTARIO)) {
      const comp = v.perguntaId.slice(PREFIXO_DO_COMENTARIO.length);
      if (
        (COMPETENCIAS as readonly string[]).includes(comp) &&
        typeof v.valor === "string"
      ) {
        comentarios[comp as Competencia] = v.valor;
      }
    } else if (typeof v.valor === "number") {
      notas[v.perguntaId] = v.valor;
    }
  }
  return { notas, comentarios };
}
