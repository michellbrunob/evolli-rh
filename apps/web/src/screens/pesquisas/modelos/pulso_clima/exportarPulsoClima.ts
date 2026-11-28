/**
 * T216 — Pulso e Clima: a planilha (.xlsx) com as abas do modelo, no lugar
 * das abas genéricas de 0 a 10. Dimensões (score 0–100, classificação,
 * respostas e perguntas; o geral; eNPS e LNPS), Visão geral, Resultados por
 * pergunta (média 1–5, favorável/neutro/desfavorável e as notas), eNPS e
 * LNPS, Respondentes × perguntas (fora da confidencial), Matriz de
 * distribuição, Ranking, Alertas, Por grupo (com recorte), Comentários e
 * Metodologia. Nada leva CPF; o nome só na identificada.
 */
import type {
  AfirmacaoDoModelo,
  PesquisaDetalhe,
  RecomendacaoDoModelo,
  RespostaDetalhe,
  ResultadoPulsoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import type {
  AbaXlsx,
  CelulaXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import { formatarMesReferencia } from "../../../../format/data";
import type { RelatorioDeResultados } from "../../dadosDoRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DA_RECOMENDACAO,
  pct,
} from "../resultadoComum";
import { faixaDoScoreLocal } from "./faixas";

const ROTULOS_1_A_5 = [
  "Discordo totalmente",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo totalmente",
] as const;

const porcento = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: v / 100, formato: "percentual" };
const duas = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: Math.round(v * 100) / 100, formato: "decimal" };

const DEPOIS = 3;

/** A zona da afirmação pela média: favorável ≥ 4, neutra 3–3,99, abaixo. */
export function zonaDaMedia(media: number | null): string {
  if (media === null) return "—";
  if (media >= 4) return "Favorável";
  if (media >= 3) return "Neutra";
  return "Desfavorável";
}

/**
 * Alerta da afirmação: alto risco com 50% ou mais de desfavoráveis ou média
 * abaixo de 2,5; atenção com 30% ou mais, ou média abaixo de 3; senão nada.
 */
export function alertaDaAfirmacao(
  a: Pick<AfirmacaoDoModelo, "media" | "desfavoravel">,
): "alto" | "atencao" | null {
  if (a.media === null || a.desfavoravel === null) return null;
  if (a.desfavoravel >= 50 || a.media < 2.5) return "alto";
  if (a.desfavoravel >= 30 || a.media < 3) return "atencao";
  return null;
}

/**
 * As 5 afirmações mais fortes (maior média) e as 5 que mais pedem atenção
 * (mais desfavoráveis; empate pela menor média).
 */
export function pontosFortesEDeAtencao(
  afirmacoes: readonly AfirmacaoDoModelo[],
): { fortes: AfirmacaoDoModelo[]; atencao: AfirmacaoDoModelo[] } {
  const comMedia = afirmacoes.filter((a) => a.media !== null);
  return {
    fortes: [...comMedia]
      .sort(
        (a, b) =>
          b.media! - a.media! || (b.favoravel ?? 0) - (a.favoravel ?? 0),
      )
      .slice(0, 5),
    atencao: [...comMedia]
      .sort(
        (a, b) =>
          (b.desfavoravel ?? 0) - (a.desfavoravel ?? 0) || a.media! - b.media!,
      )
      .slice(0, 5),
  };
}

function linhaDaRecomendacao(
  rotulo: string,
  r: RecomendacaoDoModelo,
): CelulaXlsx[] {
  return [
    rotulo,
    r.indice ?? "—",
    r.faixa ? ROTULO_DA_RECOMENDACAO[r.faixa] : "—",
    r.respostas,
    porcento(r.respostas ? pct(r.promotores, r.respostas) : null),
    porcento(r.respostas ? pct(r.neutros, r.respostas) : null),
    porcento(r.respostas ? pct(r.detratores, r.respostas) : null),
  ];
}

/** As abas do Pulso e Clima (o resultado do modelo precisa estar visível). */
export function abasDoPulsoClima(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  r: ResultadoPulsoClima,
  respostas: readonly RespostaDetalhe[] | null,
): AbaXlsx[] {
  const topo = (titulo: string): CelulaXlsx[][] => [
    [titulo],
    [`${rel.empresa || "Empresa"} · ${rel.nome}`],
    [],
  ];
  const todas = perguntasEmOrdem(detalhe.secoes);
  const textoDe = (id: string | null) =>
    textoParaOPainel(todas.find((p) => p.id === id)?.texto ?? "");
  const rotuloDaDimensao = (chave: string) =>
    r.dimensoes.find((d) => d.chave === chave)?.rotulo ??
    (chave === "lnps"
      ? "LNPS · liderança direta"
      : chave === "enps"
        ? "eNPS · empresa"
        : chave);
  const porId = new Map(geral.perguntas.map((p) => [p.perguntaId, p]));
  const notasDe = (perguntaId: string, de: number, ate: number) => {
    const p = porId.get(perguntaId);
    const d = p && "distribuicao" in p && p.distribuicao ? p.distribuicao : [];
    return Array.from(
      { length: ate - de + 1 },
      (_, i) => d.find((x) => x.valor === de + i)?.quantidade ?? 0,
    );
  };
  const abas: AbaXlsx[] = [];

  // 1. Dimensões.
  abas.push({
    nome: "Dimensões",
    larguras: [36, 15, 14, 11, 11, 11, 10, 13],
    titulo: true,
    linhasDeCabecalho: [DEPOIS, DEPOIS + r.dimensoes.length + 3],
    linhas: [
      ...topo("Score por dimensão (0 a 100)"),
      [
        "Dimensão",
        "Score (0 a 100)",
        "Classificação",
        "Respostas",
        "Perguntas",
        "Favorável",
        "Neutro",
        "Desfavorável",
      ],
      ...r.dimensoes.map((d): CelulaXlsx[] => [
        d.rotulo,
        d.score ?? "—",
        d.faixa ? ROTULO_DA_FAIXA[d.faixa] : "—",
        d.respostas,
        d.afirmacoes,
        porcento(d.favoravel),
        porcento(d.neutro),
        porcento(d.desfavoravel),
      ]),
      [
        "Score geral",
        r.score ?? "—",
        r.faixa ? ROTULO_DA_FAIXA[r.faixa] : "—",
        "",
        r.afirmacoes.length,
        porcento(r.favoravel),
        porcento(r.neutro),
        porcento(r.desfavoravel),
      ],
      [],
      [
        "Recomendação (−100 a 100)",
        "Índice",
        "Classificação",
        "Respostas",
        "Promotores",
        "Neutros",
        "Detratores",
      ],
      linhaDaRecomendacao("eNPS · empresa", r.enps),
      linhaDaRecomendacao("LNPS · liderança direta", r.lnps),
    ],
  });

  // 2. Visão geral.
  const notas15 = r.afirmacoes.reduce(
    (t, a) => ({
      soma: t.soma + (a.media ?? 0) * a.respostas,
      n: t.n + (a.media === null ? 0 : a.respostas),
    }),
    { soma: 0, n: 0 },
  );
  abas.push({
    nome: "Visão geral",
    larguras: [30, 22],
    titulo: true,
    linhasDeCabecalho: [DEPOIS, DEPOIS + 11],
    linhas: [
      ...topo("Visão geral"),
      ["Indicador", "Valor"],
      ["Convidados", rel.convidados === null ? "Link aberto" : rel.convidados],
      ["Respostas", rel.respostas],
      [
        "Taxa de participação",
        rel.participacao === null ? "—" : porcento(rel.participacao),
      ],
      [
        "Média geral (1 a 5)",
        duas(notas15.n ? notas15.soma / notas15.n : null),
      ],
      ["Favoráveis (4 e 5)", porcento(r.favoravel)],
      ["Neutras (3)", porcento(r.neutro)],
      ["Desfavoráveis (1 e 2)", porcento(r.desfavoravel)],
      ["Período das respostas", rel.periodo],
      ["Identificação", ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]],
      [],
      ["Escala (1 a 5)", "Rótulo"],
      ...ROTULOS_1_A_5.map((t, i): CelulaXlsx[] => [i + 1, t]),
    ],
  });

  // 3. Resultados por pergunta.
  abas.push({
    nome: "Resultados por pergunta",
    larguras: [5, 60, 30, 11, 9, 11, 10, 13, 6, 6, 6, 6, 6, 14],
    titulo: true,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Resultados por pergunta"),
      [
        "#",
        "Afirmação",
        "Dimensão",
        "Respostas",
        "Média",
        "Favorável",
        "Neutro",
        "Desfavorável",
        "1",
        "2",
        "3",
        "4",
        "5",
        "Zona",
      ],
      ...r.afirmacoes.map((a, i): CelulaXlsx[] => [
        i + 1,
        textoDe(a.perguntaId),
        rotuloDaDimensao(a.dimensao),
        a.respostas,
        duas(a.media),
        porcento(a.favoravel),
        porcento(a.neutro),
        porcento(a.desfavoravel),
        ...notasDe(a.perguntaId, 1, 5),
        zonaDaMedia(a.media),
      ]),
    ],
  });

  // 4. eNPS e LNPS.
  const blocoNps = (titulo: string, x: RecomendacaoDoModelo) => {
    const parte = (q: number) =>
      x.respostas ? `${q} (${pct(q, x.respostas)}%)` : "—";
    return [
      [titulo],
      ["Pergunta", textoDe(x.perguntaId) || "—"],
      ["Índice (−100 a 100)", x.indice ?? "—"],
      ["Classificação", x.faixa ? ROTULO_DA_RECOMENDACAO[x.faixa] : "—"],
      ["Promotores (9 e 10)", parte(x.promotores)],
      ["Neutros (7 e 8)", parte(x.neutros)],
      ["Detratores (0 a 6)", parte(x.detratores)],
      ["Respostas", x.respostas],
      ["Notas", ...x.distribuicao.map((d) => `${d.valor}: ${d.quantidade}`)],
      [],
    ] as CelulaXlsx[][];
  };
  abas.push({
    nome: "eNPS e LNPS",
    larguras: [26, 70],
    titulo: true,
    linhasDeCabecalho: [DEPOIS, DEPOIS + 10],
    linhas: [
      ...topo("eNPS e LNPS"),
      ...blocoNps("eNPS · empresa", r.enps),
      ...blocoNps("LNPS · liderança direta", r.lnps),
      [
        "O índice é o % de promotores (9 e 10) menos o % de detratores (0 a 6). Abaixo de 0 crítico, de 0 a 29 em ajuste, de 30 a 69 bom, 70 ou mais excelente.",
      ],
    ],
  });

  // 5. Respondentes × perguntas (nunca na confidencial).
  if (respostas && detalhe.identificacao !== "confidencial") {
    const colunas = [
      ...r.afirmacoes.map((a) => a.perguntaId),
      ...[r.lnps.perguntaId, r.enps.perguntaId].filter(
        (x): x is string => x !== null,
      ),
    ];
    const valor = (resp: RespostaDetalhe, id: string): CelulaXlsx => {
      const v = resp.valores.find((x) => x.perguntaId === id)?.valor;
      return typeof v === "number" ? v : "";
    };
    const nome = (resp: RespostaDetalhe) =>
      detalhe.identificacao === "identificada" && resp.nome
        ? resp.nome
        : `Resposta #${resp.numero}`;
    abas.push({
      nome: "Respondentes x Perguntas",
      larguras: [26, ...colunas.map(() => 12)],
      titulo: true,
      linhasDeCabecalho: [DEPOIS],
      linhas: [
        ...topo("Respondentes × perguntas"),
        ["Respondente", ...colunas.map((id) => textoDe(id))],
        ...[...respostas]
          .sort((a, b) => a.numero - b.numero)
          .map((resp): CelulaXlsx[] => [
            nome(resp),
            ...colunas.map((id) => valor(resp, id)),
          ]),
        [
          "Média por pergunta",
          ...r.afirmacoes.map((a) => duas(a.media)),
          ...[r.lnps, r.enps]
            .filter((x) => x.perguntaId !== null)
            .map((x) => {
              const soma = x.distribuicao.reduce(
                (t, d) => t + d.valor * d.quantidade,
                0,
              );
              return duas(x.respostas ? soma / x.respostas : null);
            }),
        ],
        [
          "% favorável (4 e 5) · % promotores",
          ...r.afirmacoes.map((a) => porcento(a.favoravel)),
          ...[r.lnps, r.enps]
            .filter((x) => x.perguntaId !== null)
            .map((x) =>
              porcento(x.respostas ? pct(x.promotores, x.respostas) : null),
            ),
        ],
      ],
    });
  }

  // 6. Matriz de distribuição.
  abas.push({
    nome: "Matriz de distribuição",
    larguras: [60, 8, 12, 12, 12, 12, 12, 8],
    titulo: true,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Matriz de distribuição · afirmação × nota"),
      ["Afirmação", "N", "1", "2", "3", "4", "5", "Moda"],
      ...r.afirmacoes.map((a, i): CelulaXlsx[] => {
        const contagem = notasDe(a.perguntaId, 1, 5);
        const maior = Math.max(...contagem);
        return [
          `${i + 1}. ${textoDe(a.perguntaId)}`,
          a.respostas,
          ...contagem.map((q) =>
            a.respostas ? `${q} (${pct(q, a.respostas)}%)` : "0",
          ),
          a.respostas ? contagem.indexOf(maior) + 1 : "—",
        ];
      }),
    ],
  });

  // 7. Ranking.
  const { fortes, atencao: criticas } = pontosFortesEDeAtencao(r.afirmacoes);
  abas.push({
    nome: "Ranking",
    larguras: [5, 60, 9, 13, 8],
    titulo: true,
    linhasDeCabecalho: [DEPOIS + 1, DEPOIS + fortes.length + 4],
    linhas: [
      ...topo("Ranking das afirmações"),
      ["5 pontos mais fortes"],
      ["#", "Afirmação", "Média", "Favorável", "N"],
      ...fortes.map((a, i): CelulaXlsx[] => [
        i + 1,
        textoDe(a.perguntaId),
        duas(a.media),
        porcento(a.favoravel),
        a.respostas,
      ]),
      [],
      ["5 pontos que mais pedem atenção"],
      ["#", "Afirmação", "Média", "Desfavorável", "N"],
      ...criticas.map((a, i): CelulaXlsx[] => [
        i + 1,
        textoDe(a.perguntaId),
        duas(a.media),
        porcento(a.desfavoravel),
        a.respostas,
      ]),
    ],
  });

  // 8. Alertas.
  const alertas = r.afirmacoes.flatMap((a, i) => {
    const nivel = alertaDaAfirmacao(a);
    return nivel ? [{ a, i, nivel }] : [];
  });
  abas.push({
    nome: "Alertas",
    larguras: [12, 60, 9, 13, 8, 50],
    titulo: true,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Alertas e riscos"),
      ["Severidade", "Afirmação", "Média", "Desfavorável", "N", "O que fazer"],
      ...alertas
        .sort(
          (x, y) =>
            (x.nivel === "alto" ? 0 : 1) - (y.nivel === "alto" ? 0 : 1) ||
            x.i - y.i,
        )
        .map(({ a, i, nivel }): CelulaXlsx[] => [
          nivel === "alto" ? "Alto" : "Atenção",
          `${i + 1}. ${textoDe(a.perguntaId)}`,
          duas(a.media),
          porcento(a.desfavoravel),
          a.respostas,
          nivel === "alto"
            ? "Agir já: conversar com o time e montar um plano para o ponto."
            : "Acompanhar: retomar o tema no próximo ciclo de escuta.",
        ]),
      ...(alertas.length === 0
        ? [["—", "Nenhuma afirmação nas regras de alerta."]]
        : []),
    ],
  });

  // 9. Por grupo (só com recorte): o score de cada dimensão por grupo.
  const mapa = rel.departamentos;
  if (mapa) {
    const rotuloDoCampo =
      mapa.campo === "centroCusto"
        ? "centro de custo"
        : mapa.campo === "unidade"
          ? "unidade"
          : "departamento";
    // As médias do mapa estão em 0–10 (média 1–5 × 2); de volta a 1–5.
    const scoreDoGrupo = (
      medias: readonly (number | null)[],
      chaves: readonly string[],
    ) => {
      const scores = mapa.colunas.flatMap((c, i) => {
        const a = r.afirmacoes.find((x) => x.perguntaId === c.perguntaId);
        const m = medias[i];
        if (!a || !chaves.includes(a.dimensao) || m === null || m === undefined)
          return [];
        return [((m / 2 - 1) / 4) * 100];
      });
      return scores.length
        ? Math.round(scores.reduce((t, s) => t + s, 0) / scores.length)
        : null;
    };
    const todasAsChaves = r.dimensoes.map((d) => d.chave);
    abas.push({
      nome: `Por ${rotuloDoCampo}`,
      larguras: [32, 12, 12, 13, ...r.dimensoes.map(() => 14)],
      titulo: true,
      linhasDeCabecalho: [DEPOIS],
      linhas: [
        ...topo(`Resultados por ${rotuloDoCampo}`),
        [
          rotuloDoCampo.charAt(0).toUpperCase() + rotuloDoCampo.slice(1),
          "Respostas",
          "Score geral",
          "Classificação",
          ...r.dimensoes.map((d) => d.rotulo),
        ],
        ...mapa.linhas.map((l): CelulaXlsx[] => {
          if (!l.visivel)
            return [
              l.nome,
              l.respostas,
              `Oculto · menos de ${rel.minimoPorGrupo} respostas`,
            ];
          const s = scoreDoGrupo(l.medias, todasAsChaves);
          return [
            l.grupoId === null ? `Toda a empresa` : l.nome,
            l.respostas,
            s ?? "—",
            s === null ? "—" : ROTULO_DA_FAIXA[faixaDoScoreLocal(s)],
            ...r.dimensoes.map((d) => scoreDoGrupo(l.medias, [d.chave]) ?? "—"),
          ];
        }),
      ],
    });
  }

  // 10. Comentários.
  const comentarios = r.comentarios.flatMap((c) =>
    (c.textos ?? []).map((t) => ({ dimensao: c.dimensao, ...t })),
  );
  abas.push({
    nome: "Comentários",
    larguras: [34, 12, 22, 90],
    titulo: true,
    linhasDeCabecalho: [DEPOIS],
    linhas: [
      ...topo("Comentários"),
      ["Dimensão", "Mês", "Departamento", "Comentário"],
      ...comentarios.map((c): CelulaXlsx[] => [
        rotuloDaDimensao(c.dimensao),
        c.mes ? formatarMesReferencia(c.mes) : "—",
        c.departamento ?? "Oculto",
        c.texto,
      ]),
      ...(comentarios.length === 0
        ? [["—", "", "", "Nenhum comentário."]]
        : []),
    ],
  });

  // 11. Metodologia.
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
        "As 22 afirmações vão de 1 (discordo totalmente) a 5 (concordo totalmente); o LNPS e o eNPS, de 0 a 10.",
      ],
      [
        "Score de 0 a 100",
        "A média de 1 a 5 da afirmação vira score por (média − 1) ÷ 4 × 100. A dimensão é a média das afirmações dela; o geral, a média das 22.",
      ],
      [
        "Faixas do score",
        "Abaixo de 50 crítico; de 50 a 69 atenção; de 70 a 84 saudável; 85 ou mais forte.",
      ],
      [
        "Favorável, neutro e desfavorável",
        "Notas 4 e 5 favoráveis, 3 neutra, 1 e 2 desfavoráveis, sobre todas as respostas.",
      ],
      [
        "Zona da afirmação",
        "Pela média: 4 ou mais favorável; de 3 a 3,99 neutra; abaixo de 3 desfavorável.",
      ],
      [
        "Alertas",
        "Atenção com 30% ou mais de desfavoráveis ou média abaixo de 3; alto com 50% ou mais ou média abaixo de 2,5.",
      ],
      [
        "eNPS e LNPS",
        "% de notas 9 e 10 menos % de notas de 0 a 6, de −100 a 100. Abaixo de 0 crítico; 0 a 29 em ajuste; 30 a 69 bom; 70 ou mais excelente.",
      ],
      [
        "Grupos pequenos",
        `Grupos com menos de ${rel.minimoPorGrupo} respostas não mostram números, e o departamento do comentário só aparece nesse mínimo.`,
      ],
      [
        "Identificação",
        "Anônima e confidencial: as respostas não mostram quem respondeu; a confidencial não tem respostas individuais.",
      ],
    ],
  });

  return abas;
}
