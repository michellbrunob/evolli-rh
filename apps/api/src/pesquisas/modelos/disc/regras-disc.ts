import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../../../common/erros/recusa-por-campo";
import type {
  ConfigPergunta,
  Modelo,
  Opcao,
  Pergunta,
  Secao,
} from "../../pesquisas.types";
import {
  FATORES,
  FRASES_POR_BLOCO,
  type Fator,
  NUMERO_DE_BLOCOS,
  TIPO_DO_BLOCO,
} from "./definicao-disc";

/**
 * T216 — Perfil comportamental (DISC): as regras do bloco de escolha
 * forçada e da estrutura do modelo. Funções puras, chamadas pela conferência
 * comum da estrutura e da resposta.
 */

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const TEXTO_DA_FRASE = 200;

type Registro = Record<string, unknown>;

function ehRegistro(v: unknown): v is Registro {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * A configuração de um bloco: exatamente 4 frases (id, texto até 200) e
 * cada fator D, I, S e C em uma delas. Devolve `null` se inválida.
 */
export function conferirConfigDoBloco(bruto: unknown): ConfigPergunta | null {
  if (!ehRegistro(bruto) || !Array.isArray(bruto.opcoes)) return null;
  const lista = bruto.opcoes as unknown[];
  if (lista.length !== FRASES_POR_BLOCO) return null;
  const ids = new Set<string>();
  const fatores = new Set<Fator>();
  const opcoes: Opcao[] = [];
  for (const o of lista) {
    if (!ehRegistro(o) || typeof o.id !== "string" || !ID.test(o.id)) {
      return null;
    }
    if (ids.has(o.id) || typeof o.texto !== "string") return null;
    const texto = o.texto.trim();
    if (texto === "" || texto.length > TEXTO_DA_FRASE) return null;
    const fator = o.fator as Fator;
    if (!FATORES.includes(fator) || fatores.has(fator)) return null;
    ids.add(o.id);
    fatores.add(fator);
    opcoes.push({ id: o.id, texto, fator });
  }
  return { opcoes };
}

/** A resposta de um bloco: `{ opcao: id }` de uma das 4 frases. */
export function conferirValorDoBloco(
  p: Pergunta,
  valor: unknown,
): { ok: true; valor: unknown } | { ok: false } {
  if (!ehRegistro(valor) || Object.keys(valor).length !== 1) {
    return { ok: false };
  }
  const ids = (p.config.opcoes ?? []).map((o) => o.id);
  return typeof valor.opcao === "string" && ids.includes(valor.opcao)
    ? { ok: true, valor: { opcao: valor.opcao } }
    : { ok: false };
}

/**
 * A estrutura conforme o modelo. No `disc`: só blocos, exatamente 28,
 * todos obrigatórios e sem condição. Nos demais modelos, o bloco não
 * existe (`nao_se_aplica` na pergunta).
 */
export function conferirEstruturaDisc(
  modelo: Modelo,
  secoes: readonly Secao[],
): ErroDeCampo[] {
  const perguntas = secoes.flatMap((s) => s.perguntas);
  const erros: ErroDeCampo[] = [];
  if (modelo !== "disc") {
    for (const p of perguntas) {
      if (p.tipo === TIPO_DO_BLOCO) {
        erros.push({ campo: campoDaPergunta(p.id), motivo: "nao_se_aplica" });
      }
    }
    return erros;
  }
  for (const p of perguntas) {
    if (p.tipo !== TIPO_DO_BLOCO || !p.obrigatoria || p.condicao !== null) {
      erros.push({ campo: campoDaPergunta(p.id), motivo: "invalido" });
    }
  }
  if (perguntas.length !== NUMERO_DE_BLOCOS) {
    erros.unshift({ campo: "secoes", motivo: "limite" });
  }
  return erros;
}
