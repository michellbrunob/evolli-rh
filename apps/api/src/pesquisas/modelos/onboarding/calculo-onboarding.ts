import type { Pergunta, Secao } from "../../pesquisas.types";
import {
  ehItemDe4Pontos,
  PAPEIS,
  perguntaDoPapel,
  ROTULOS_DA_INTENCAO,
} from "./definicao";

/**
 * T216 — Onboarding: o resultado (funções puras).
 *
 * - Nota de um item de 4 pontos → 0–100: (valor − 1) ÷ 3 × 100.
 * - Índice do bloco = média das notas dos itens de 4 pontos dele (todas as
 *   respostas da rodada); índice geral = média de todos esses itens.
 * - Faixas (índice arredondado): < 50 crítico · 50–69 atenção · 70–84
 *   saudável · ≥ 85 forte.
 * - Uma rodada só mostra números com 3 respostas ou mais.
 * - Recomendação 0–10: % de 9–10 menos % de 0–6.
 * - Peso do bloco: correlação de Spearman entre a nota do bloco e a
 *   intenção de ficar, com 20 respostas ou mais; prioridade = nota < 70 e
 *   peso ≥ 0,4.
 */

export const MINIMO_POR_RODADA = 3;
export const MINIMO_PARA_PESO = 20;
export const CORTE_DA_NOTA = 70;
export const CORTE_DO_PESO = 0.4;

export type Faixa = "critico" | "atencao" | "saudavel" | "forte";

export function notaDoItem(valor: number): number {
  return ((valor - 1) / 3) * 100;
}

export function faixaDoIndice(indice: number): Faixa {
  const n = Math.round(indice);
  if (n < 50) return "critico";
  if (n < 70) return "atencao";
  if (n < 85) return "saudavel";
  return "forte";
}

export interface RespostaDoOnboarding {
  rodada: number;
  colaboradorId: string | null;
  valores: ReadonlyMap<string, unknown>;
}

const media = (v: readonly number[]) =>
  v.length ? v.reduce((t, x) => t + x, 0) / v.length : null;

const item4 = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 4;

/** As perguntas de 4 pontos de cada bloco (seção). */
function itensDosBlocos(secoes: readonly Secao[]) {
  return secoes
    .map((s) => ({ secao: s, itens: s.perguntas.filter(ehItemDe4Pontos) }))
    .filter((b) => b.itens.length > 0);
}

/** A nota (0–100) de um bloco numa resposta; `null` sem item respondido. */
function notaDoBloco(
  itens: readonly Pergunta[],
  valores: ReadonlyMap<string, unknown>,
): number | null {
  return media(
    itens
      .map((p) => valores.get(p.id))
      .filter(item4)
      .map(notaDoItem),
  );
}

export interface BlocoDaRodada {
  id: string;
  titulo: string | null;
  indice: number | null;
  faixa: Faixa | null;
  perguntas: { perguntaId: string; indice: number | null }[];
}

export interface Distribuicao {
  opcaoId: string;
  quantidade: number;
  percentual: number;
}

export interface Recomendacao {
  respostas: number;
  media: number | null;
  indice: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
}

export interface ResultadoDaRodada {
  rodada: number;
  respostas: number;
  visivel: boolean;
  faltam: number;
  indice: number | null;
  faixa: Faixa | null;
  blocos: BlocoDaRodada[];
  intencao: { opcoes: Distribuicao[]; querContinuar: number | null } | null;
  motivos: { opcoes: Distribuicao[]; outros: string[] } | null;
  recomendacao: Recomendacao | null;
}

function distribuicao(
  p: Pergunta,
  respostas: readonly RespostaDoOnboarding[],
): { opcoes: Distribuicao[]; outros: string[]; total: number } {
  const contagem = new Map<string, number>();
  const outros: string[] = [];
  let total = 0;
  for (const r of respostas) {
    const v = r.valores.get(p.id) as
      { opcao?: string; outro?: string } | undefined;
    if (!v || typeof v !== "object") continue;
    if (typeof v.opcao === "string") {
      contagem.set(v.opcao, (contagem.get(v.opcao) ?? 0) + 1);
      total += 1;
    } else if (typeof v.outro === "string") {
      outros.push(v.outro);
      total += 1;
    }
  }
  const opcoes = (p.config.opcoes ?? []).map((o) => {
    const q = contagem.get(o.id) ?? 0;
    return {
      opcaoId: o.id,
      quantidade: q,
      percentual: total ? Math.round((q / total) * 100) : 0,
    };
  });
  return {
    opcoes,
    outros: outros.sort((a, b) => a.localeCompare(b, "pt-BR")),
    total,
  };
}

export function recomendacao(
  p: Pergunta,
  respostas: readonly RespostaDoOnboarding[],
): Recomendacao {
  const notas = respostas
    .map((r) => r.valores.get(p.id))
    .filter(
      (v): v is number =>
        Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10,
    );
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const m = media(notas);
  return {
    respostas: notas.length,
    media: m === null ? null : Math.round(m * 10) / 10,
    indice: notas.length
      ? Math.round(((promotores - detratores) / notas.length) * 100)
      : null,
    promotores,
    neutros: notas.length - promotores - detratores,
    detratores,
  };
}

/** O resultado de uma rodada (as respostas já filtradas por ela). */
export function resultadoDaRodada(
  rodada: number,
  secoes: readonly Secao[],
  respostas: readonly RespostaDoOnboarding[],
): ResultadoDaRodada {
  const visivel = respostas.length >= MINIMO_POR_RODADA;
  const vazio: ResultadoDaRodada = {
    rodada,
    respostas: respostas.length,
    visivel,
    faltam: Math.max(0, MINIMO_POR_RODADA - respostas.length),
    indice: null,
    faixa: null,
    blocos: [],
    intencao: null,
    motivos: null,
    recomendacao: null,
  };
  if (!visivel) return vazio;
  const todas: number[] = [];
  const blocos = itensDosBlocos(secoes).map(({ secao, itens }) => {
    const notas: number[] = [];
    const perguntas = itens.map((p) => {
      const v = respostas
        .map((r) => r.valores.get(p.id))
        .filter(item4)
        .map(notaDoItem);
      notas.push(...v);
      const m = media(v);
      return { perguntaId: p.id, indice: m === null ? null : Math.round(m) };
    });
    todas.push(...notas);
    const m = media(notas);
    return {
      id: secao.id,
      titulo: secao.titulo,
      indice: m === null ? null : Math.round(m),
      faixa: m === null ? null : faixaDoIndice(m),
      perguntas,
    };
  });
  const geral = media(todas);
  const pIntencao = perguntaDoPapel(secoes, "intencao");
  const pMotivo = perguntaDoPapel(secoes, "motivo");
  const pRec = perguntaDoPapel(secoes, "recomendacao");
  let intencao: ResultadoDaRodada["intencao"] = null;
  if (pIntencao?.tipo === "escolha_unica") {
    const d = distribuicao(pIntencao, respostas);
    const ficam = d.opcoes.slice(0, 2).reduce((t, o) => t + o.quantidade, 0);
    intencao = {
      opcoes: d.opcoes,
      querContinuar: d.total ? Math.round((ficam / d.total) * 100) : null,
    };
  }
  let motivos: ResultadoDaRodada["motivos"] = null;
  if (pMotivo?.tipo === "escolha_unica") {
    const d = distribuicao(pMotivo, respostas);
    motivos = { opcoes: d.opcoes, outros: d.outros };
  }
  return {
    ...vazio,
    indice: geral === null ? null : Math.round(geral),
    faixa: geral === null ? null : faixaDoIndice(geral),
    blocos,
    intencao,
    motivos,
    recomendacao:
      pRec?.tipo === "nota_0_10" ? recomendacao(pRec, respostas) : null,
  };
}

export interface ComparacaoDosBlocos {
  de: number;
  para: number;
  blocos: {
    id: string;
    antes: number | null;
    depois: number | null;
    mudou: number | null;
  }[];
  geral: { antes: number | null; depois: number | null; mudou: number | null };
}

/** A mudança entre duas rodadas visíveis (pontos 0–100). */
export function compararRodadas(
  antes: ResultadoDaRodada,
  depois: ResultadoDaRodada,
): ComparacaoDosBlocos | null {
  if (!antes.visivel || !depois.visivel) return null;
  const dif = (a: number | null, b: number | null) =>
    a === null || b === null ? null : b - a;
  return {
    de: antes.rodada,
    para: depois.rodada,
    blocos: depois.blocos.map((b) => {
      const a = antes.blocos.find((x) => x.id === b.id)?.indice ?? null;
      return { id: b.id, antes: a, depois: b.indice, mudou: dif(a, b.indice) };
    }),
    geral: {
      antes: antes.indice,
      depois: depois.indice,
      mudou: dif(antes.indice, depois.indice),
    },
  };
}

/** Postos médios (empates com a média dos postos). */
function postos(v: readonly number[]): number[] {
  const ordem = v.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const r = new Array<number>(v.length);
  let k = 0;
  while (k < ordem.length) {
    let fim = k;
    while (fim + 1 < ordem.length && ordem[fim + 1]!.x === ordem[k]!.x) fim++;
    const medio = (k + fim) / 2 + 1;
    for (let j = k; j <= fim; j++) r[ordem[j]!.i] = medio;
    k = fim + 1;
  }
  return r;
}

/** Correlação de Spearman (Pearson dos postos); `null` sem variação. */
export function spearman(
  x: readonly number[],
  y: readonly number[],
): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const rx = postos(x);
  const ry = postos(y);
  const mx = media(rx)!;
  const my = media(ry)!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i]! - mx) * (ry[i]! - my);
    dx += (rx[i]! - mx) ** 2;
    dy += (ry[i]! - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** A intenção de ficar como número (4 = quer ficar … 1 = buscando). */
function intencaoComoNumero(p: Pergunta, valor: unknown): number | null {
  const opcoes = p.config.opcoes ?? [];
  const id = (valor as { opcao?: string } | undefined)?.opcao;
  const i = opcoes.findIndex((o) => o.id === id);
  return i < 0 ? null : opcoes.length - i;
}

export interface PesoDoBloco {
  id: string;
  titulo: string | null;
  indice: number | null;
  peso: number | null;
  prioridade: boolean;
}

/** Peso de cada bloco na intenção de ficar (todas as rodadas juntas). */
export function pesoDosBlocos(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoOnboarding[],
): { suficiente: boolean; blocos: PesoDoBloco[] } {
  const pIntencao = perguntaDoPapel(secoes, "intencao");
  const suficiente = pIntencao !== null && respostas.length >= MINIMO_PARA_PESO;
  const blocos = itensDosBlocos(secoes).map(({ secao, itens }) => {
    const pares: [number, number][] = [];
    const notas: number[] = [];
    for (const r of respostas) {
      const nb = notaDoBloco(itens, r.valores);
      if (nb === null) continue;
      notas.push(nb);
      const ni = pIntencao
        ? intencaoComoNumero(pIntencao, r.valores.get(pIntencao.id))
        : null;
      if (ni !== null) pares.push([nb, ni]);
    }
    const m = media(notas);
    const indice = m === null ? null : Math.round(m);
    const peso =
      suficiente && pares.length >= MINIMO_PARA_PESO
        ? spearman(
            pares.map((p) => p[0]),
            pares.map((p) => p[1]),
          )
        : null;
    const pesoArredondado = peso === null ? null : Math.round(peso * 100) / 100;
    return {
      id: secao.id,
      titulo: secao.titulo,
      indice,
      peso: pesoArredondado,
      prioridade:
        indice !== null &&
        pesoArredondado !== null &&
        indice < CORTE_DA_NOTA &&
        pesoArredondado >= CORTE_DO_PESO,
    };
  });
  return { suficiente, blocos };
}

/**
 * Para onde foi a intenção de ficar entre duas rodadas: só quem respondeu às
 * duas (identificada); com menos de 3 pessoas, oculto.
 */
export function fluxoDaIntencao(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoOnboarding[],
  de: number,
  para: number,
): {
  pessoas: number;
  visivel: boolean;
  fluxos: { de: string; para: string; quantidade: number }[];
} {
  const p = perguntaDoPapel(secoes, "intencao");
  const vazio = { pessoas: 0, visivel: false, fluxos: [] };
  if (!p) return vazio;
  const porPessoa = (rodada: number) =>
    new Map(
      respostas
        .filter((r) => r.rodada === rodada && r.colaboradorId)
        .map((r) => [
          r.colaboradorId!,
          (r.valores.get(p.id) as { opcao?: string } | undefined)?.opcao ??
            null,
        ]),
    );
  const a = porPessoa(de);
  const b = porPessoa(para);
  const contagem = new Map<string, number>();
  let pessoas = 0;
  for (const [id, opA] of a) {
    const opB = b.get(id);
    if (!opA || !opB) continue;
    pessoas += 1;
    const k = `${opA}|${opB}`;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  if (pessoas < MINIMO_POR_RODADA) return { ...vazio, pessoas };
  return {
    pessoas,
    visivel: true,
    fluxos: [...contagem].map(([k, quantidade]) => {
      const [x, y] = k.split("|") as [string, string];
      return { de: x, para: y, quantidade };
    }),
  };
}

/** Os contatos deixados (q14): sem nome, rodada ou data, em ordem alfabética. */
export function contatos(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoOnboarding[],
): string[] {
  const p = perguntaDoPapel(secoes, "contato");
  if (!p) return [];
  return respostas
    .map((r) => r.valores.get(p.id))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim())
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Os textos de uma das perguntas abertas do fim (sem autor). */
export function textosDoPapel(
  secoes: readonly Secao[],
  respostas: readonly RespostaDoOnboarding[],
  papel: "melhorar" | "gosta",
): string[] {
  const id = PAPEIS[papel];
  if (!perguntaDoPapel(secoes, papel)) return [];
  return respostas
    .map((r) => r.valores.get(id))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim())
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export interface Funil {
  noPublico: number;
  semEmail: number;
  aguardandoEmail: number;
  enviados: number;
  responderam: number;
  pulados: number;
  agendados: number;
}

/** O funil dos convites (abrir e clicar chegam com o e-mail). */
export function funil(envios: readonly { situacao: string }[]): Funil {
  const c = (s: string) => envios.filter((e) => e.situacao === s).length;
  return {
    noPublico: envios.length,
    semEmail: c("sem_email"),
    aguardandoEmail: c("aguardando_email"),
    enviados: c("enviado"),
    responderam: c("respondido"),
    pulados: c("pulado"),
    agendados: c("agendado"),
  };
}

export { ROTULOS_DA_INTENCAO };
