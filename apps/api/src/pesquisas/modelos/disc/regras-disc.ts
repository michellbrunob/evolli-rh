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
 * O bloco só existe no modelo `disc` (nos demais, `nao_se_aplica` na
 * pergunta). Os 28 blocos do `disc` são a metodologia fixa do registro
 * (`ESTRUTURA_DISC` em `modelos/indice.ts`).
 */
export function conferirEstruturaDisc(
  modelo: Modelo,
  secoes: readonly Secao[],
): ErroDeCampo[] {
  if (modelo === "disc") return [];
  return secoes
    .flatMap((s) => s.perguntas)
    .filter((p) => p.tipo === TIPO_DO_BLOCO)
    .map((p) => ({ campo: campoDaPergunta(p.id), motivo: "nao_se_aplica" }));
}
