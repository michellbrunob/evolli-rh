/**
 * T216 — Motivação (TAD): a planilha (.xlsx) com as abas do modelo, no lugar
 * das abas genéricas de 0 a 10. Resumo (score geral e os 3 pilares de 1 a
 * 7, pessoas por nível), Afirmações (média marcada e média pontuada, com as
 * invertidas em `8 − média`), Respostas individuais (fora da confidencial:
 * o valor marcado em cada afirmação, os pilares e o geral de cada pessoa e
 * a linha de média) e Metodologia. Nada leva CPF; o nome só na identificada.
 */
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoTad,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import type {
  AbaXlsx,
  CelulaXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import type { RelatorioDeResultados } from "../../dadosDoRelatorio";
import { serialDoInstante } from "../../exportarResultados";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { ROTULO_DO_NIVEL } from "../resultadoComum";
import { ITENS_TAD, PILARES_TAD } from "./catalogo";

const duas = (v: number | null | undefined): CelulaXlsx =>
  v === null || v === undefined
    ? "—"
    : { numero: Math.round(v * 100) / 100, formato: "decimal" };

const DEPOIS = 3;

const media = (v: readonly number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;

/** A média pontuada: nas invertidas, `8 − média marcada`. */
export function mediaPontuada(
  mediaMarcada: number | null,
  invertida: boolean,
): number | null {
  if (mediaMarcada === null) return null;
  return invertida ? 8 - mediaMarcada : mediaMarcada;
}

export function abasDaTad(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  r: ResultadoTad,
  respostas: readonly RespostaDetalhe[] | null,
): AbaXlsx[] {
  const topo = (titulo: string): CelulaXlsx[][] => [
    [titulo],
    [`${rel.empresa || "Empresa"} · ${rel.nome}`],
    [],
  ];
  const porChave = new Map(
    perguntasEmOrdem(detalhe.secoes).flatMap((p) =>
      p.chave ? [[p.chave, p] as const] : [],
    ),
  );
  const itens = ITENS_TAD.flatMap((i, n) => {
    const p = porChave.get(i.chave);
    return p ? [{ ...i, numero: n + 1, pergunta: p }] : [];
  });
  const rotuloDoPilar = (chave: string) =>
    PILARES_TAD.find((p) => p.chave === chave)?.rotulo ?? chave;
  const porId = new Map(geral.perguntas.map((p) => [p.perguntaId, p]));
  const abas: AbaXlsx[] = [];

  // 1. Resumo.
  abas.push({
    nome: "Resumo",
    larguras: [30, 16, 14, 12],
    titulo: true,
    linhasDeCabecalho: [DEPOIS, DEPOIS + 6, DEPOIS + 12],
    linhas: [
      ...topo("Resumo · Motivação (TAD)"),
      ["Participação", ""],
      ["Convidados", rel.convidados === null ? "Link aberto" : rel.convidados],
      ["Respostas", rel.respostas],
      ["Período das respostas", rel.periodo],
      ["Identificação", ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]],
      [],
      ["Necessidade", "Score (1 a 7)", "Nível", "Perguntas"],
      [
        "Score geral",
        duas(r.geral),
        r.nivel ? ROTULO_DO_NIVEL[r.nivel] : "—",
        r.pilares.reduce((t, p) => t + p.perguntas, 0),
      ],
      ...r.pilares.map((p): CelulaXlsx[] => [
        p.rotulo,
        duas(p.score),
        p.nivel ? ROTULO_DO_NIVEL[p.nivel] : "—",
        p.perguntas,
      ]),
      [],
      ["Nível (score geral de cada pessoa)", "Pessoas"],
      ["Alto (5,5 a 7,0)", r.niveis.alto],
      ["Moderado (3,5 a 5,4)", r.niveis.moderado],
      ["Baixo (1,0 a 3,4)", r.niveis.baixo],
    ],
  });

  // 2. Afirmações.
  abas.push({
    nome: "Afirmações",
    larguras: [5, 60, 16, 11, 11, 15, 16, 6, 6, 6, 6, 6, 6, 6],
    titulo: true,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Afirmações"),
      [
        "#",
        "Afirmação",
        "Pilar",
        "Invertida",
        "Respostas",
        "Média marcada",
        "Média pontuada",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
      ],
      ...itens.map((i): CelulaXlsx[] => {
        const res = porId.get(i.pergunta.id);
        const m =
          res && "media" in res && typeof res.media === "number"
            ? res.media
            : null;
        const d =
          res && "distribuicao" in res && res.distribuicao
            ? res.distribuicao
            : [];
        return [
          i.numero,
          i.pergunta.texto,
          rotuloDoPilar(i.pilar),
          i.invertido ? "Sim" : "Não",
          res?.respondidas ?? 0,
          duas(m),
          duas(mediaPontuada(m, i.invertido)),
          ...[1, 2, 3, 4, 5, 6, 7].map(
            (v) => d.find((x) => x.valor === v)?.quantidade ?? 0,
          ),
        ];
      }),
    ],
  });

  // 3. Respostas individuais (nunca na confidencial).
  if (respostas && detalhe.identificacao !== "confidencial") {
    const ordenadas = [...respostas].sort((a, b) => a.numero - b.numero);
    const nome = (resp: RespostaDetalhe) =>
      detalhe.identificacao === "identificada" && resp.nome
        ? resp.nome
        : `Resposta #${resp.numero}`;
    const marcado = (resp: RespostaDetalhe, id: string) => {
      const v = resp.valores.find((x) => x.perguntaId === id)?.valor;
      return typeof v === "number" ? v : null;
    };
    const modeloDe = (resp: RespostaDetalhe) =>
      resp.modelo?.modelo === "tad" ? resp.modelo : null;
    abas.push({
      nome: "Respostas individuais",
      larguras: [24, 18, ...itens.map(() => 14), 13, 13, 15, 12, 11],
      titulo: true,
      linhasDeCabecalho: [DEPOIS],
      formatos: { 1: "dataHora" },
      linhas: [
        ...topo(
          `Respostas individuais · ${ordenadas.length === 1 ? "1 resposta" : `${ordenadas.length} respostas`}`,
        ),
        [
          "Resposta",
          "Respondeu em",
          ...itens.map(
            (i) =>
              `${i.numero}. ${i.pergunta.texto}${i.invertido ? " (invertida)" : ""}`,
          ),
          ...PILARES_TAD.map((p) => p.rotulo),
          "Score geral",
          "Nível",
        ],
        ...ordenadas.map((resp): CelulaXlsx[] => {
          const m = modeloDe(resp);
          return [
            nome(resp),
            serialDoInstante(resp.respondidaEm) ?? resp.respondidaEm,
            ...itens.map((i) => marcado(resp, i.pergunta.id) ?? ""),
            ...PILARES_TAD.map((p) =>
              duas(m?.pilares.find((x) => x.chave === p.chave)?.score),
            ),
            duas(m?.geral),
            m?.nivel ? ROTULO_DO_NIVEL[m.nivel] : "—",
          ];
        }),
        [
          "Média",
          "",
          ...itens.map((i) =>
            duas(
              media(
                ordenadas.flatMap((resp) => {
                  const v = marcado(resp, i.pergunta.id);
                  return v === null ? [] : [v];
                }),
              ),
            ),
          ),
          ...r.pilares.map((p) => duas(p.score)),
          duas(r.geral),
          r.nivel ? ROTULO_DO_NIVEL[r.nivel] : "—",
        ],
      ],
    });
  }

  // 4. Metodologia.
  abas.push({
    nome: "Metodologia",
    larguras: [26, 110],
    titulo: true,
    quebrarTexto: false,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Metodologia"),
      ["Tema", "Como é calculado"],
      [
        "Escala",
        "21 afirmações de 1 (nada verdadeiro) a 7 (totalmente verdadeiro), em 3 pilares: autonomia (7), competência (6) e relacionamento (8).",
      ],
      [
        "Invertidas",
        "Nas 9 afirmações invertidas, a resposta conta como 8 menos o valor marcado. A coluna Média pontuada já faz essa conta; os valores das respostas individuais saem como foram marcados.",
      ],
      [
        "Pilar e geral",
        "O pilar é a média das afirmações dele (já pontuadas); o score geral é a média dos 3 pilares, não das 21 afirmações.",
      ],
      [
        "Time",
        "O resultado do time é a média dos scores de cada pessoa, no geral e em cada pilar.",
      ],
      [
        "Níveis",
        "Alto de 5,5 a 7,0 (necessidade bem satisfeita); moderado de 3,5 a 5,4 (satisfação parcial); baixo de 1,0 a 3,4 (necessidade frustrada).",
      ],
      [
        "Identificação",
        "Anônima e confidencial: as respostas não mostram quem respondeu; a confidencial não tem respostas individuais.",
      ],
    ],
  });

  return abas;
}
