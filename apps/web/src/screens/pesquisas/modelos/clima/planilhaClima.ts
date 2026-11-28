/**
 * T216 — a planilha (.xlsx) da Pesquisa de Clima, no lugar das abas
 * genéricas: Resumo (índice do time, faixa, respostas e as dimensões),
 * Dimensões (cada afirmação com o % favorável e a média de 1 a 5), Ranking
 * (as dimensões do maior para o menor índice) e Respostas individuais (os
 * valores de cada resposta e a linha da média).
 *
 * Privacidade (LGPD): com poucas respostas, os números não saem; as
 * respostas individuais nunca saem na confidencial, levam o nome só na
 * identificada (na anônima, numeradas e sem data). Nada leva CPF.
 */
import type {
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoClima,
} from "../../../../api/pesquisasClient";
import type {
  AbaXlsx,
  CelulaXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import type { RelatorioDeResultados } from "../../dadosDoRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { DIMENSOES_CLIMA, PREFIXO_DAS_ABERTAS } from "./catalogo";
import { ROTULO_DA_FAIXA_CLIMA, TEXTO_DAS_FAIXAS_CLIMA } from "./faixas";

const porcento = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: v / 100, formato: "percentual" };
const umaCasa = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: Math.round(v * 10) / 10, formato: "decimal" };

const DEPOIS_DO_CABECALHO = 3;

function cabecalho(titulo: string, rel: RelatorioDeResultados): CelulaXlsx[][] {
  return [[titulo], [`${rel.empresa || "Empresa"} · ${rel.nome}`], []];
}

const rotuloDaDimensao = (chave: string) =>
  DIMENSOES_CLIMA.find((d) => d.chave === chave)?.rotulo ?? chave;

/** As dimensões do maior para o menor índice; empate pela ordem do modelo. */
export function rankingDoClima(r: ResultadoClima): ResultadoClima["dimensoes"] {
  return r.dimensoes
    .map((d, i) => ({ d, i }))
    .filter((x) => x.d.favoravel !== null)
    .sort((a, b) => b.d.favoravel! - a.d.favoravel! || a.i - b.i)
    .map((x) => x.d);
}

export function abasDaPlanilhaClima(x: {
  readonly rel: RelatorioDeResultados;
  readonly detalhe: PesquisaDetalhe;
  readonly r: ResultadoClima | null;
  readonly respostas: readonly RespostaDetalhe[] | null;
}): AbaXlsx[] {
  const { rel, detalhe } = x;
  const r = rel.numerosOcultos ? null : x.r;
  const abas: AbaXlsx[] = [];
  const titulo = (linhas: CelulaXlsx[][], cabecalhos: number[]) => ({
    titulo: true,
    linhasDeCabecalho: cabecalhos,
    linhas,
  });

  // 1. Resumo.
  const resumo: CelulaXlsx[][] = [
    ...cabecalho("Resumo", rel),
    ["Indicador", "Valor", "Faixa", "Detalhe"],
  ];
  const cabecalhosDoResumo = [DEPOIS_DO_CABECALHO];
  if (!r) {
    resumo.push(
      [
        "Respostas",
        rel.respostas,
        "",
        ROTULO_DA_IDENTIFICACAO[rel.identificacao],
      ],
      [
        "Números ocultos",
        "",
        "",
        `Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`,
      ],
    );
  } else {
    const total = r.notas.favoraveis + r.notas.neutras + r.notas.desfavoraveis;
    resumo.push(
      [
        "Índice do time",
        porcento(r.favoravel),
        r.faixa ? ROTULO_DA_FAIXA_CLIMA[r.faixa] : "—",
        "% de respostas favoráveis (4 e 5) em todas as afirmações",
      ],
      [
        "Respostas",
        rel.respostas,
        "",
        rel.convidados === null
          ? `${ROTULO_DA_IDENTIFICACAO[rel.identificacao]} · link aberto`
          : `${ROTULO_DA_IDENTIFICACAO[rel.identificacao]} · ${plural(rel.convidados, "convidado", "convidados")}`,
      ],
      [
        "Favoráveis (4 e 5)",
        porcento(r.favoravel),
        "",
        `${r.notas.favoraveis} de ${total} notas`,
      ],
      [
        "Neutras (3)",
        porcento(r.neutro),
        "",
        `${r.notas.neutras} de ${total} notas`,
      ],
      [
        "Desfavoráveis (1 e 2)",
        porcento(r.desfavoravel),
        "",
        `${r.notas.desfavoraveis} de ${total} notas`,
      ],
      [],
      ["Dimensão", "% favorável", "Faixa", "Afirmações"],
    );
    cabecalhosDoResumo.push(resumo.length - 1);
    for (const d of r.dimensoes)
      resumo.push([
        d.rotulo,
        porcento(d.favoravel),
        d.faixa ? ROTULO_DA_FAIXA_CLIMA[d.faixa] : "—",
        d.afirmacoes,
      ]);
    resumo.push([], [TEXTO_DAS_FAIXAS_CLIMA]);
  }
  abas.push({
    nome: "Resumo",
    larguras: [28, 14, 14, 60],
    ...titulo(resumo, cabecalhosDoResumo),
  });
  if (!r) return abas;

  // 2. Dimensões: cada afirmação, na ordem da pesquisa.
  const todas = perguntasEmOrdem(detalhe.secoes);
  const textoDe = new Map(todas.map((p) => [p.id, textoParaOPainel(p.texto)]));
  abas.push({
    nome: "Dimensões",
    larguras: [18, 80, 13, 14],
    ...titulo(
      [
        ...cabecalho("Dimensões", rel),
        ["Dimensão", "Afirmação", "% favorável", "Média (1 a 5)"],
        ...r.afirmacoes.map((a): CelulaXlsx[] => [
          rotuloDaDimensao(a.dimensao),
          textoDe.get(a.perguntaId) ?? a.chave,
          porcento(a.favoravel),
          umaCasa(a.media),
        ]),
      ],
      [DEPOIS_DO_CABECALHO],
    ),
  });

  // 3. Ranking.
  abas.push({
    nome: "Ranking",
    larguras: [10, 22, 13, 14],
    ...titulo(
      [
        ...cabecalho("Ranking das dimensões", rel),
        ["Posição", "Dimensão", "% favorável", "Faixa"],
        ...rankingDoClima(r).map((d, i): CelulaXlsx[] => [
          i + 1,
          d.rotulo,
          porcento(d.favoravel),
          d.faixa ? ROTULO_DA_FAIXA_CLIMA[d.faixa] : "—",
        ]),
      ],
      [DEPOIS_DO_CABECALHO],
    ),
  });

  // 4. Respostas individuais: nunca na confidencial.
  const individuais =
    detalhe.identificacao === "confidencial" ? null : x.respostas;
  if (individuais) {
    const identificada = detalhe.identificacao === "identificada";
    const colunas = todas.filter(
      (p) =>
        p.tipo === "concordancia" ||
        (p.tipo === "paragrafo" && p.chave?.startsWith(PREFIXO_DAS_ABERTAS)),
    );
    const celula = (p: Pergunta, v: unknown): CelulaXlsx => {
      if (v === undefined || v === null || v === "") return "";
      if (p.tipo === "concordancia") {
        const n = Number(v);
        return Number.isFinite(n) ? n : "";
      }
      return String(v);
    };
    const linhas = individuais.map((resp): CelulaXlsx[] => {
      const valores = new Map(resp.valores.map((v) => [v.perguntaId, v.valor]));
      return [
        identificada && resp.nome ? resp.nome : `Resposta ${resp.numero}`,
        ...(identificada ? [formatarInstante(resp.respondidaEm)] : []),
        ...colunas.map((p) => celula(p, valores.get(p.id))),
      ];
    });
    const mediaDe = new Map(r.afirmacoes.map((a) => [a.perguntaId, a.media]));
    abas.push({
      nome: "Respostas individuais",
      larguras: [24, ...(identificada ? [18] : []), ...colunas.map(() => 26)],
      ...titulo(
        [
          ["Respostas individuais"],
          [
            `${rel.nome} · ${plural(individuais.length, "resposta", "respostas")}`,
          ],
          [],
          [
            identificada ? "Nome" : "Resposta",
            ...(identificada ? ["Respondida em"] : []),
            ...colunas.map((p) => textoDe.get(p.id) ?? p.texto),
          ],
          ...linhas,
          [
            "Média",
            ...(identificada ? [""] : []),
            ...colunas.map((p) =>
              p.tipo === "concordancia"
                ? umaCasa(mediaDe.get(p.id) ?? null)
                : "",
            ),
          ],
        ],
        [DEPOIS_DO_CABECALHO, DEPOIS_DO_CABECALHO + linhas.length + 1],
      ),
    });
  }
  return abas;
}
