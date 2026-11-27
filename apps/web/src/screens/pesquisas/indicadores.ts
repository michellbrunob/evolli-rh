/**
 * T216 — as contas dos resultados que a tela mostra: escala de cada
 * pergunta, faixas (baixa, média, alta), "% favorável", média na escala de
 * 0 a 10, zona do eNPS e os indicadores gerais. O servidor manda os números
 * prontos (contrato ampliado); estas funções são o mesmo cálculo para quando
 * um campo ainda não veio, e a régua das cores.
 */
import type {
  FaixasDaEscala,
  IndicadoresDosResultados,
  Pergunta,
  PesquisaDetalhe,
  ResultadoPergunta,
  ResultadosPesquisa,
  ZonaEnps,
} from "../../api/pesquisasClient";
import { perguntasEmOrdem } from "./estadoDaPesquisa";

export interface EscalaDaPergunta {
  readonly minimo: number;
  readonly maximo: number;
}

/** Tipos que entram nas médias (o eNPS entra pela nota). */
export function ehDeEscala(p: Pergunta): boolean {
  return (
    p.tipo === "escala" ||
    p.tipo === "concordancia" ||
    p.tipo === "estrelas" ||
    p.tipo === "nota_0_10"
  );
}

export function escalaDe(p: Pergunta): EscalaDaPergunta {
  switch (p.tipo) {
    case "concordancia":
    case "estrelas":
      return { minimo: 1, maximo: 5 };
    case "nota_0_10":
      return { minimo: 0, maximo: 10 };
    default:
      return { minimo: p.config.minimo ?? 1, maximo: p.config.maximo ?? 5 };
  }
}

export type Faixa = "baixa" | "media" | "alta";

/** Os limites das faixas: até `baixaAte` é baixa; de `altaDesde` em diante, alta. */
export function limitesDasFaixas(e: EscalaDaPergunta): {
  baixaAte: number;
  altaDesde: number;
} {
  if (e.maximo === 10) return { baixaAte: 4, altaDesde: 8 };
  if (e.minimo === 1 && e.maximo === 5) return { baixaAte: 2, altaDesde: 4 };
  const n = e.maximo - e.minimo + 1;
  const terco = Math.max(1, Math.floor(n / 3));
  return {
    baixaAte: e.minimo + terco - 1,
    altaDesde: e.maximo - terco + 1,
  };
}

export function faixaDoValor(v: number, e: EscalaDaPergunta): Faixa {
  const { baixaAte, altaDesde } = limitesDasFaixas(e);
  return v <= baixaAte ? "baixa" : v >= altaDesde ? "alta" : "media";
}

/** Texto do que é favorável ("notas 8 a 10", "4 e 5"). */
export function textoDoFavoravel(e: EscalaDaPergunta): string {
  const { altaDesde } = limitesDasFaixas(e);
  return e.maximo - altaDesde === 1
    ? `${altaDesde} e ${e.maximo}`
    : `${altaDesde} a ${e.maximo}`;
}

/** As faixas pela distribuição (quando o servidor não as mandou). */
export function faixasDe(
  distribuicao: readonly { valor: number; quantidade: number }[],
  e: EscalaDaPergunta,
): FaixasDaEscala {
  const f: FaixasDaEscala = { baixa: 0, media: 0, alta: 0 };
  for (const d of distribuicao) f[faixaDoValor(d.valor, e)] += d.quantidade;
  return f;
}

export function favoravelDe(f: FaixasDaEscala): number | null {
  const total = f.baixa + f.media + f.alta;
  return total > 0 ? Math.round((f.alta / total) * 100) : null;
}

/** Média levada à escala de 0 a 10 (1–5 vira 2–10). */
export function mediaNa10(media: number, e: EscalaDaPergunta): number {
  return e.maximo === 10 ? media : (media * 10) / e.maximo;
}

/** A cor de uma nota na régua (vermelho, laranja, amarelo, verde). */
export function corDaNota(v: number, e: EscalaDaPergunta): string {
  const faixa = faixaDoValor(v, e);
  if (faixa === "baixa") return "var(--status-danger-ink)";
  if (faixa === "alta") return "var(--turno-verde)";
  const { baixaAte, altaDesde } = limitesDasFaixas(e);
  const meio = (baixaAte + altaDesde) / 2;
  return v < meio ? "var(--turno-laranja)" : "var(--turno-mostarda)";
}

/** Faixa de uma média na escala de 0 a 10 (mapa de calor e réguas). */
export function faixaDaMedia10(m: number): Faixa {
  return m < 6.5 ? "baixa" : m < 8 ? "media" : "alta";
}

export function zonaDoEnps(indice: number): ZonaEnps {
  if (indice < 0) return "critica";
  if (indice < 50) return "aperfeicoamento";
  if (indice < 75) return "qualidade";
  return "excelencia";
}

export const ROTULO_DA_ZONA: Readonly<Record<ZonaEnps, string>> = {
  critica: "Zona crítica",
  aperfeicoamento: "Zona de aperfeiçoamento",
  qualidade: "Zona de qualidade",
  excelencia: "Zona de excelência",
};

/** Média de um resultado numérico, se houver. */
export function mediaDe(r: ResultadoPergunta | undefined): number | null {
  if (!r || !("media" in r) || r.media === undefined) return null;
  return r.media;
}

/** Os indicadores gerais: os do servidor ou, na falta, o mesmo cálculo. */
export function indicadoresDe(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
): IndicadoresDosResultados {
  if (resultados.indicadores) return resultados.indicadores;
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  const medias: { perguntaId: string; media: number }[] = [];
  let enps: IndicadoresDosResultados["enps"] = null;
  for (const p of perguntasEmOrdem(detalhe.secoes)) {
    const r = porId.get(p.id);
    if (r && "enps" in r && r.enps.indice !== null && !enps) {
      enps = {
        indice: r.enps.indice,
        zona: r.enps.zona ?? zonaDoEnps(r.enps.indice),
        promotores: r.enps.promotores,
        neutros: r.enps.neutros,
        detratores: r.enps.detratores,
      };
    }
    if (!ehDeEscala(p) || (p.tipo === "nota_0_10" && p.config.enps)) continue;
    const m = mediaDe(r);
    if (m !== null)
      medias.push({ perguntaId: p.id, media: mediaNa10(m, escalaDe(p)) });
  }
  const ordenadas = [...medias].sort((a, b) => b.media - a.media);
  return {
    mediaGeral:
      medias.length > 0
        ? medias.reduce((t, m) => t + m.media, 0) / medias.length
        : null,
    perguntasDeEscala: medias.length,
    maiorMedia: ordenadas[0] ?? null,
    menorMedia: ordenadas.at(-1) ?? null,
    enps,
  };
}
