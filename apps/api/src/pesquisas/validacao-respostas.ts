import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../common/erros/recusa-por-campo";
import { perguntasEmOrdem } from "./estrutura-pesquisa";
import type { Pergunta, Secao, ValorRespondido } from "./pesquisas.types";

/**
 * T216 — a resposta pelo link: confere cada valor pelo tipo da pergunta (a
 * tabela do documento), exige as obrigatórias que a pessoa viu e descarta o
 * que veio para pergunta escondida pela condição. Função pura.
 */

const DIA = /^\d{4}-\d{2}-\d{2}$/;
export const LIMITE_TEXTO_CURTO = 300;
export const LIMITE_PARAGRAFO = 3000;
export const LIMITE_OUTRO = 300;

type Registro = Record<string, unknown>;

function ehRegistro(v: unknown): v is Registro {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function diaValido(v: string): boolean {
  if (!DIA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function inteiroEntre(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

/** Valor vazio: não respondida (a obrigatoriedade decide se pode). */
export function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && !v.trim());
}

type Conferido = { ok: true; valor: unknown } | { ok: false };

/** O valor no formato do tipo, normalizado (texto aparado). */
export function conferirValor(p: Pergunta, valor: unknown): Conferido {
  const recusa: Conferido = { ok: false };
  switch (p.tipo) {
    case "texto_curto":
    case "paragrafo": {
      if (typeof valor !== "string") return recusa;
      const t = valor.trim();
      const max =
        p.tipo === "texto_curto" ? LIMITE_TEXTO_CURTO : LIMITE_PARAGRAFO;
      return t.length > max ? recusa : { ok: true, valor: t };
    }
    case "escolha_unica": {
      if (!ehRegistro(valor)) return recusa;
      const chaves = Object.keys(valor);
      if (chaves.length !== 1) return recusa;
      if (chaves[0] === "opcao") {
        const ids = (p.config.opcoes ?? []).map((o) => o.id);
        return typeof valor.opcao === "string" && ids.includes(valor.opcao)
          ? { ok: true, valor: { opcao: valor.opcao } }
          : recusa;
      }
      if (chaves[0] === "outro" && p.config.outro === true) {
        const t = typeof valor.outro === "string" ? valor.outro.trim() : "";
        return t && t.length <= LIMITE_OUTRO
          ? { ok: true, valor: { outro: t } }
          : recusa;
      }
      return recusa;
    }
    case "multipla_escolha": {
      if (!ehRegistro(valor) || !Array.isArray(valor.opcoes)) return recusa;
      if (Object.keys(valor).some((k) => k !== "opcoes" && k !== "outro")) {
        return recusa;
      }
      const ids = (p.config.opcoes ?? []).map((o) => o.id);
      const marcadas = valor.opcoes as unknown[];
      if (
        marcadas.some((o) => typeof o !== "string" || !ids.includes(o)) ||
        new Set(marcadas).size !== marcadas.length
      ) {
        return recusa;
      }
      let outro: string | undefined;
      if (valor.outro !== undefined && valor.outro !== null) {
        if (p.config.outro !== true || typeof valor.outro !== "string") {
          return recusa;
        }
        const t = valor.outro.trim();
        if (t.length > LIMITE_OUTRO) return recusa;
        if (t) outro = t;
      }
      const total = marcadas.length + (outro ? 1 : 0);
      // Nada marcado: o mesmo que não responder.
      if (total === 0) return { ok: true, valor: null };
      const maximo = p.config.maximo ?? null;
      if (maximo !== null && total > maximo) return recusa;
      // A ordem da configuração, não a do clique.
      const opcoes = ids.filter((id) => marcadas.includes(id));
      return {
        ok: true,
        valor: outro === undefined ? { opcoes } : { opcoes, outro },
      };
    }
    case "sim_nao":
      return valor === "sim" || valor === "nao" ? { ok: true, valor } : recusa;
    case "concordancia":
    case "estrelas":
      return inteiroEntre(valor, 1, 5) ? { ok: true, valor } : recusa;
    case "nota_0_10":
      return inteiroEntre(valor, 0, 10) ? { ok: true, valor } : recusa;
    case "escala":
      return inteiroEntre(valor, p.config.minimo ?? 1, p.config.maximo ?? 5)
        ? { ok: true, valor }
        : recusa;
    case "data":
      return typeof valor === "string" && diaValido(valor)
        ? { ok: true, valor }
        : recusa;
    case "numero": {
      if (typeof valor !== "number" || !Number.isFinite(valor)) return recusa;
      if (p.config.inteiro === true && !Number.isInteger(valor)) return recusa;
      const { minimo, maximo } = p.config;
      if (minimo !== undefined && minimo !== null && valor < minimo) {
        return recusa;
      }
      if (maximo !== undefined && maximo !== null && valor > maximo) {
        return recusa;
      }
      return { ok: true, valor };
    }
  }
}

/** A opção marcada (ou "sim"/"nao") está no valor da pergunta? */
export function marcou(valor: unknown, opcaoId: string): boolean {
  if (typeof valor === "string") return valor === opcaoId;
  if (!ehRegistro(valor)) return false;
  if (typeof valor.opcao === "string") return valor.opcao === opcaoId;
  if (Array.isArray(valor.opcoes)) return valor.opcoes.includes(opcaoId);
  return false;
}

/**
 * Quem viu cada pergunta, a partir dos valores (já conferidos) de quem
 * respondeu: sem condição, todos; com condição, quem viu a pergunta anterior
 * e marcou a opção. Como o valor de pergunta escondida é descartado no
 * envio, refazer a conta sobre o que ficou gravado dá o mesmo resultado.
 */
export function perguntasVistas(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): Set<string> {
  const vistas = new Set<string>();
  for (const p of perguntasEmOrdem(secoes)) {
    if (!p.condicao) {
      vistas.add(p.id);
      continue;
    }
    const { perguntaId, opcaoId } = p.condicao;
    if (vistas.has(perguntaId) && marcou(valores.get(perguntaId), opcaoId)) {
      vistas.add(p.id);
    }
  }
  return vistas;
}

export interface RespostasConferidas {
  valores: ValorRespondido[];
  erros: ErroDeCampo[];
}

/**
 * Confere o envio inteiro. `respostas` já chega como lista (o DTO garante);
 * pergunta desconhecida ou repetida recusa o campo `respostas`.
 */
export function conferirRespostas(
  secoes: readonly Secao[],
  respostas: readonly { perguntaId: string; valor: unknown }[],
): RespostasConferidas {
  const erros: ErroDeCampo[] = [];
  const perguntas = perguntasEmOrdem(secoes);
  const ids = new Set(perguntas.map((p) => p.id));
  const enviados = new Map<string, unknown>();
  for (const r of respostas) {
    if (!ids.has(r.perguntaId) || enviados.has(r.perguntaId)) {
      return {
        valores: [],
        erros: [{ campo: "respostas", motivo: "invalido" }],
      };
    }
    enviados.set(r.perguntaId, r.valor);
  }

  const aceitos = new Map<string, unknown>();
  const vistas = new Set<string>();
  for (const p of perguntas) {
    const visivel =
      !p.condicao ||
      (vistas.has(p.condicao.perguntaId) &&
        marcou(aceitos.get(p.condicao.perguntaId), p.condicao.opcaoId));
    if (!visivel) continue; // escondida: não exigida, valor descartado
    vistas.add(p.id);
    const bruto = enviados.get(p.id);
    if (vazio(bruto)) {
      if (p.obrigatoria) {
        erros.push({ campo: campoDaPergunta(p.id), motivo: "obrigatorio" });
      }
      continue;
    }
    const c = conferirValor(p, bruto);
    if (!c.ok) {
      erros.push({ campo: campoDaPergunta(p.id), motivo: "invalido" });
      continue;
    }
    if (vazio(c.valor)) {
      if (p.obrigatoria) {
        erros.push({ campo: campoDaPergunta(p.id), motivo: "obrigatorio" });
      }
      continue;
    }
    aceitos.set(p.id, c.valor);
  }
  return {
    valores: erros.length
      ? []
      : [...aceitos].map(([perguntaId, valor]) => ({ perguntaId, valor })),
    erros,
  };
}
