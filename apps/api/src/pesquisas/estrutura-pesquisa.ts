import {
  campoDaPergunta,
  type ErroDeCampo,
} from "../common/erros/recusa-por-campo";
import {
  type Condicao,
  type ConfigPergunta,
  type Opcao,
  type Pergunta,
  type Secao,
  TIPOS_PERGUNTA,
  type TipoPergunta,
} from "./pesquisas.types";

/**
 * T216 — a estrutura da pesquisa (seções e perguntas), conferida e
 * normalizada antes de gravar. Função pura: recebe o que veio no corpo (sem
 * confiar em forma nenhuma) e devolve só os campos conhecidos de cada tipo,
 * ou a lista de erros por campo (o id da pergunta, ou `secoes`).
 */

/** Ids gerados pelo cliente (uuid ou parecido), até 40. */
export const ID_DA_ESTRUTURA = /^[A-Za-z0-9_-]{1,40}$/;

export const LIMITES = {
  secoes: 20,
  perguntas: 60,
  textoPergunta: 300,
  descricaoPergunta: 500,
  tituloSecao: 120,
  descricaoSecao: 500,
  opcoesMinimo: 2,
  opcoesMaximo: 20,
  textoOpcao: 200,
  rotulo: 100,
} as const;

/** Tipos que podem abrir uma condição (a pergunta "anterior"). */
export const TIPOS_DE_CONDICAO: readonly TipoPergunta[] = [
  "escolha_unica",
  "multipla_escolha",
  "sim_nao",
];

type Registro = Record<string, unknown>;

function ehRegistro(v: unknown): v is Registro {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Texto opcional: aparado; vazio vira `null`; `undefined` se inválido. */
function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t === "") return null;
  return t.length > max ? undefined : t;
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && ID_DA_ESTRUTURA.test(v);
}

function inteiroEntre(v: unknown, min: number, max: number): v is number {
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
}

/** As opções de uma pergunta de escolha. */
function conferirOpcoes(v: unknown): Opcao[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length < LIMITES.opcoesMinimo || v.length > LIMITES.opcoesMaximo) {
    return null;
  }
  const ids = new Set<string>();
  const opcoes: Opcao[] = [];
  for (const o of v) {
    if (!ehRegistro(o) || !idValido(o.id) || ids.has(o.id)) return null;
    if (typeof o.texto !== "string") return null;
    const texto = o.texto.trim();
    if (texto === "" || texto.length > LIMITES.textoOpcao) return null;
    ids.add(o.id);
    opcoes.push({ id: o.id, texto });
  }
  return opcoes;
}

/** A configuração própria de cada tipo; `null` se inválida. */
export function conferirConfig(
  tipo: TipoPergunta,
  bruto: unknown,
): ConfigPergunta | null {
  const c: Registro = ehRegistro(bruto) ? bruto : {};
  switch (tipo) {
    case "escolha_unica":
    case "multipla_escolha": {
      const opcoes = conferirOpcoes(c.opcoes);
      if (!opcoes) return null;
      if (c.outro !== undefined && typeof c.outro !== "boolean") return null;
      const outro = c.outro === true;
      if (tipo === "escolha_unica") return { opcoes, outro };
      const maximo = c.maximo ?? null;
      if (
        maximo !== null &&
        !inteiroEntre(maximo, 1, opcoes.length + (outro ? 1 : 0))
      ) {
        return null;
      }
      return { opcoes, outro, maximo };
    }
    case "sim_nao": {
      const boa = c.respostaBoa ?? null;
      if (boa !== null && boa !== "sim" && boa !== "nao") return null;
      return { respostaBoa: boa };
    }
    case "nota_0_10": {
      if (c.enps !== undefined && typeof c.enps !== "boolean") return null;
      return { enps: c.enps === true };
    }
    case "escala": {
      const minimo = c.minimo ?? 1;
      const maximo = c.maximo ?? 5;
      if (minimo !== 0 && minimo !== 1) return null;
      if (!inteiroEntre(maximo, 2, 10)) return null;
      const rotuloMinimo = textoOpcional(c.rotuloMinimo, LIMITES.rotulo);
      const rotuloMaximo = textoOpcional(c.rotuloMaximo, LIMITES.rotulo);
      if (rotuloMinimo === undefined || rotuloMaximo === undefined) {
        return null;
      }
      return { minimo, maximo, rotuloMinimo, rotuloMaximo };
    }
    case "numero": {
      const minimo = c.minimo ?? null;
      const maximo = c.maximo ?? null;
      const finito = (n: unknown) =>
        n === null || (typeof n === "number" && Number.isFinite(n));
      if (!finito(minimo) || !finito(maximo)) return null;
      if (minimo !== null && maximo !== null && minimo > maximo) return null;
      if (c.inteiro !== undefined && typeof c.inteiro !== "boolean") {
        return null;
      }
      return {
        minimo: minimo as number | null,
        maximo: maximo as number | null,
        inteiro: c.inteiro === true,
      };
    }
    default:
      return {};
  }
}

/** Os ids que uma pergunta de condição aceita como `opcaoId`. */
export function opcoesDaCondicao(p: Pergunta): string[] {
  if (p.tipo === "sim_nao") return ["sim", "nao"];
  return (p.config.opcoes ?? []).map((o) => o.id);
}

export interface EstruturaConferida {
  secoes: Secao[];
  erros: ErroDeCampo[];
}

/**
 * Confere e normaliza as seções. `secoes` precisa ser lista de 1 a 20; o
 * total de perguntas vai de 0 a 60 (publicar exige ao menos 1). Ids únicos
 * na pesquisa (perguntas e seções) e nas opções da pergunta.
 */
export function conferirSecoes(entrada: unknown): EstruturaConferida {
  const erros: ErroDeCampo[] = [];
  const secoes: Secao[] = [];
  if (
    !Array.isArray(entrada) ||
    entrada.length < 1 ||
    entrada.length > LIMITES.secoes
  ) {
    return { secoes, erros: [{ campo: "secoes", motivo: "limite" }] };
  }
  const idsSecao = new Set<string>();
  /** Perguntas já vistas, na ordem (para a condição olhar só as anteriores). */
  const anteriores = new Map<string, Pergunta>();
  const todosOsIds = new Set<string>();
  /** Ids de pergunta já usados (mesmo de pergunta recusada). */
  const vistos = new Set<string>();
  let total = 0;
  let secaoInvalida = false;

  // Primeira passada: todos os ids de pergunta, para distinguir uma condição
  // que aponta para a frente (`fora_de_ordem`) de uma que não existe.
  for (const s of entrada) {
    if (ehRegistro(s) && Array.isArray(s.perguntas)) {
      for (const p of s.perguntas) {
        if (ehRegistro(p) && idValido(p.id)) todosOsIds.add(p.id);
      }
    }
  }

  for (const s of entrada) {
    if (!ehRegistro(s) || !idValido(s.id) || idsSecao.has(s.id)) {
      secaoInvalida = true;
      continue;
    }
    idsSecao.add(s.id);
    const titulo = textoOpcional(s.titulo, LIMITES.tituloSecao);
    const descricao = textoOpcional(s.descricao, LIMITES.descricaoSecao);
    if (titulo === undefined || descricao === undefined) {
      secaoInvalida = true;
      continue;
    }
    if (!Array.isArray(s.perguntas)) {
      secaoInvalida = true;
      continue;
    }
    const perguntas: Pergunta[] = [];
    for (const bruta of s.perguntas) {
      total += 1;
      const p = conferirPergunta(bruta, anteriores, todosOsIds, vistos, erros);
      if (p) {
        perguntas.push(p);
        anteriores.set(p.id, p);
      }
    }
    secoes.push({ id: s.id, titulo, descricao, perguntas });
  }

  if (secaoInvalida) erros.unshift({ campo: "secoes", motivo: "invalido" });
  if (total > LIMITES.perguntas) {
    erros.unshift({ campo: "secoes", motivo: "limite" });
  }
  return { secoes, erros };
}

function conferirPergunta(
  bruta: unknown,
  anteriores: ReadonlyMap<string, Pergunta>,
  todosOsIds: ReadonlySet<string>,
  vistos: Set<string>,
  erros: ErroDeCampo[],
): Pergunta | null {
  if (!ehRegistro(bruta) || !idValido(bruta.id) || vistos.has(bruta.id)) {
    erros.push({ campo: "secoes", motivo: "invalido" });
    return null;
  }
  const id = bruta.id;
  vistos.add(id);
  const campo = campoDaPergunta(id);
  const antes = erros.length;
  const tipo = bruta.tipo as TipoPergunta;
  if (!(TIPOS_PERGUNTA as readonly unknown[]).includes(tipo)) {
    erros.push({ campo, motivo: "invalido" });
    return null;
  }
  let texto = "";
  if (typeof bruta.texto !== "string" || bruta.texto.trim() === "") {
    erros.push({ campo, motivo: "obrigatorio" });
  } else if (bruta.texto.trim().length > LIMITES.textoPergunta) {
    erros.push({ campo, motivo: "limite" });
  } else {
    texto = bruta.texto.trim();
  }
  const descricao = textoOpcional(bruta.descricao, LIMITES.descricaoPergunta);
  if (descricao === undefined) erros.push({ campo, motivo: "limite" });
  if (
    bruta.obrigatoria !== undefined &&
    typeof bruta.obrigatoria !== "boolean"
  ) {
    erros.push({ campo, motivo: "invalido" });
  }
  const config = conferirConfig(tipo, bruta.config);
  if (!config) erros.push({ campo, motivo: "invalido" });

  let condicao: Condicao | null = null;
  if (bruta.condicao !== undefined && bruta.condicao !== null) {
    const c = bruta.condicao;
    if (!ehRegistro(c) || !idValido(c.perguntaId) || !idValido(c.opcaoId)) {
      erros.push({ campo, motivo: "invalido" });
    } else {
      const ref = anteriores.get(c.perguntaId);
      if (!ref && vistos.has(c.perguntaId) && c.perguntaId !== id) {
        // A anterior foi recusada: o erro já saiu por ela; esta não repete,
        // mas também não entra sem a condição.
        return null;
      } else if (!ref) {
        erros.push({
          campo,
          motivo:
            todosOsIds.has(c.perguntaId) || c.perguntaId === id
              ? "fora_de_ordem"
              : "invalido",
        });
      } else if (
        !TIPOS_DE_CONDICAO.includes(ref.tipo) ||
        !opcoesDaCondicao(ref).includes(c.opcaoId)
      ) {
        erros.push({ campo, motivo: "invalido" });
      } else {
        condicao = { perguntaId: c.perguntaId, opcaoId: c.opcaoId };
      }
    }
  }
  if (erros.length > antes || !config) return null;
  return {
    id,
    tipo,
    texto,
    descricao: descricao ?? null,
    obrigatoria: bruta.obrigatoria === true,
    config,
    condicao,
  };
}

/** Todas as perguntas, na ordem em que aparecem. */
export function perguntasEmOrdem(secoes: readonly Secao[]): Pergunta[] {
  return secoes.flatMap((s) => s.perguntas);
}

export function totalDePerguntas(secoes: readonly Secao[]): number {
  return perguntasEmOrdem(secoes).length;
}
