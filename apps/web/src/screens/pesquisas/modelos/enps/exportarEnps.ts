/**
 * T216 — a planilha (.xlsx) do eNPS, no lugar das abas genéricas: Visão
 * geral (participação, eNPS, zona, os três grupos, primeira e última
 * resposta, a escala e a fórmula), Gráficos (o eNPS, a distribuição das
 * notas de 0 a 10 e a média das complementares, com barras em texto),
 * Complementares (média e contagem por grupo), Respostas abertas e, quando
 * a pesquisa mostra respostas individuais, Respostas individuais.
 *
 * A contagem de respondentes é a da pesquisa (todas as respostas), e a de
 * notas é a da pergunta principal. Privacidade: os textos seguem a ordem
 * dos resultados (alfabética fora da identificada), o autor só aparece na
 * identificada e nada sai na confidencial além do agregado.
 */
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoDoEnps,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { formatarInstante } from "../../../../format/data";
import {
  type AbaXlsx,
  type CelulaXlsx,
  montarXlsx,
} from "../../../pessoas/importacao/planilhaXlsx";
import type { RelatorioDeResultados } from "../../dadosDoRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { GRUPOS_DO_ENPS, TITULO_DA_ZONA, grupoDaNota, pctDe } from "./textos";

const porcento = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: v / 100, formato: "percentual" };
const decimal = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: Math.round(v * 10) / 10, formato: "decimal" };

/** Uma barra em texto, proporcional (até 20 blocos). */
export const barraEmTexto = (parte: number, total: number) =>
  total > 0 ? "█".repeat(Math.round((parte / total) * 20)) : "";

const DEPOIS_DO_CABECALHO = 3;

function cabecalho(titulo: string, rel: RelatorioDeResultados): CelulaXlsx[][] {
  return [[titulo], [`${rel.empresa || "Empresa"} · ${rel.nome}`], []];
}

/** "3 (75%)". */
const comPercentual = (n: number, total: number) =>
  `${n} (${pctDe(n, total)}%)`;

export function abasDoEnps(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  respostas: readonly RespostaDetalhe[] | null,
): AbaXlsx[] {
  const r: ResultadoDoEnps | null =
    !rel.numerosOcultos && geral.modelo?.modelo === "enps"
      ? geral.modelo
      : null;
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const porId = new Map(perguntas.map((p) => [p.id, p]));
  const textoDe = (id: string | null) =>
    textoParaOPainel((id && porId.get(id)?.texto) || "");
  const abas: AbaXlsx[] = [];
  const aba = (
    nome: string,
    linhas: CelulaXlsx[][],
    larguras: number[],
    cabecalhos: number[] = [DEPOIS_DO_CABECALHO],
    extra: Partial<AbaXlsx> = {},
  ) =>
    abas.push({
      nome,
      larguras,
      titulo: true,
      linhasDeCabecalho: cabecalhos,
      linhas,
      ...extra,
    });
  const oculto = [
    `Números ocultos: menos de ${rel.minimoPorGrupo} respostas, para proteger quem respondeu.`,
  ];

  // 1. Visão geral.
  const datas = (respostas ?? [])
    .map((x) => x.respondidaEm)
    .sort((a, b) => a.localeCompare(b));
  const visao: CelulaXlsx[][] = [
    ...cabecalho("Visão geral", rel),
    ["Indicador", "Valor"],
    ["Convidados", rel.convidados === null ? "Link aberto" : rel.convidados],
    ["Respondentes", rel.respostas],
    ...(rel.participacao !== null
      ? [["Taxa de participação", porcento(rel.participacao)]]
      : []),
  ];
  if (r && r.indice !== null && r.zona !== null) {
    visao.push(
      ["eNPS (de −100 a 100)", r.indice],
      ["Zona", TITULO_DA_ZONA[r.zona]],
      ["Notas na pergunta principal", r.respostas],
      ["Promotores (notas 9 e 10)", comPercentual(r.promotores, r.respostas)],
      ["Neutros (notas 7 e 8)", comPercentual(r.neutros, r.respostas)],
      ["Detratores (notas 0 a 6)", comPercentual(r.detratores, r.respostas)],
    );
  } else if (rel.numerosOcultos) {
    visao.push(oculto);
  } else {
    visao.push(["eNPS (de −100 a 100)", "—", "Ainda sem notas"]);
  }
  visao.push(
    ...(datas.length > 0
      ? [
          ["Primeira resposta", formatarInstante(datas[0]!)],
          ["Última resposta", formatarInstante(datas.at(-1)!)],
        ]
      : [["Período das respostas", rel.periodo]]),
    ["Identificação", ROTULO_DA_IDENTIFICACAO[rel.identificacao]],
    [],
    ["Notas", "Grupo", "O que significa"],
  );
  const linhaDaEscala = visao.length - 1;
  visao.push(
    ["0 a 6", "Detratores", "Hoje não recomendariam a empresa"],
    ["7 e 8", "Neutros", "Veem pontos bons, sem entusiasmo para recomendar"],
    ["9 e 10", "Promotores", "Recomendam a empresa com entusiasmo"],
    [],
    [
      "Fórmula",
      "eNPS = % de promotores − % de detratores (de −100 a 100). Zonas: crítica abaixo de 0 · aperfeiçoamento 0 a 49 · qualidade 50 a 74 · excelência 75 a 100.",
    ],
  );
  aba(
    "Visão geral",
    visao,
    [30, 22, 60],
    [DEPOIS_DO_CABECALHO, linhaDaEscala],
    {
      quebrarTexto: false,
    },
  );

  // 2. Gráficos (barras em texto: o gerador não embute imagens).
  const graficos: CelulaXlsx[][] = [...cabecalho("Gráficos", rel)];
  const cabecalhosDosGraficos: number[] = [];
  if (r && r.indice !== null && r.zona !== null) {
    graficos.push(
      ["eNPS e zona", "", ""],
      [
        r.indice,
        TITULO_DA_ZONA[r.zona],
        `${r.respostas} notas na pergunta principal`,
      ],
      [],
      ["Grupo", "Pessoas", "Do total", "Barra"],
    );
    cabecalhosDosGraficos.push(DEPOIS_DO_CABECALHO, graficos.length - 1);
    for (const g of GRUPOS_DO_ENPS) {
      const n =
        g.grupo === "promotor"
          ? r.promotores
          : g.grupo === "neutro"
            ? r.neutros
            : r.detratores;
      graficos.push([
        `${g.plural} (${g.notas})`,
        n,
        porcento(pctDe(n, r.respostas)),
        barraEmTexto(n, r.respostas),
      ]);
    }
    graficos.push([], ["Nota", "Pessoas", "Grupo", "Barra"]);
    cabecalhosDosGraficos.push(graficos.length - 1);
    const maior = Math.max(1, ...r.distribuicao.map((d) => d.quantidade));
    for (const d of r.distribuicao)
      graficos.push([
        d.valor,
        d.quantidade,
        GRUPOS_DO_ENPS.find((g) => g.grupo === grupoDaNota(d.valor))!.singular,
        barraEmTexto(d.quantidade, maior),
      ]);
    if (r.complementares.length > 0) {
      graficos.push([], ["Complementar", "Média (0 a 10)", "", "Barra"]);
      cabecalhosDosGraficos.push(graficos.length - 1);
      for (const c of r.complementares)
        graficos.push([
          textoDe(c.perguntaId),
          decimal(c.media),
          "",
          c.media === null ? "" : barraEmTexto(c.media, 10),
        ]);
    }
  } else {
    graficos.push(rel.numerosOcultos ? oculto : ["Ainda sem notas."]);
    cabecalhosDosGraficos.push(DEPOIS_DO_CABECALHO);
  }
  aba("Gráficos", graficos, [50, 16, 22, 24], cabecalhosDosGraficos);

  // 3. Complementares.
  const complementares: CelulaXlsx[][] = [
    ...cabecalho("Complementares", rel),
    [
      "Pergunta",
      "Respostas",
      "Média (0 a 10)",
      "Detratores (0 a 6)",
      "Neutros (7 e 8)",
      "Promotores (9 e 10)",
    ],
  ];
  if (r) {
    for (const c of r.complementares)
      complementares.push([
        textoDe(c.perguntaId),
        c.respostas,
        decimal(c.media),
        c.detratores,
        c.neutros,
        c.promotores,
      ]);
    if (r.complementares.length === 0)
      complementares.push(["Esta pesquisa não tem perguntas complementares."]);
  } else {
    complementares.push(rel.numerosOcultos ? oculto : ["Ainda sem notas."]);
  }
  aba("Complementares", complementares, [60, 11, 15, 18, 16, 19]);

  // 4. Respostas abertas.
  const comAutor = rel.identificacao === "identificada";
  const abertas: CelulaXlsx[][] = [
    ...cabecalho("Respostas abertas", rel),
    ["Pergunta", "Resposta", ...(comAutor ? ["Autor"] : [])],
  ];
  if (rel.numerosOcultos) abertas.push(oculto);
  else {
    for (const c of rel.comentarios)
      for (const t of c.textos)
        abertas.push([
          textoParaOPainel(c.pergunta),
          t.texto,
          ...(comAutor ? [t.autor ?? ""] : []),
        ]);
    if (abertas.length === DEPOIS_DO_CABECALHO + 1)
      abertas.push(["", "Nenhuma resposta aberta."]);
  }
  aba("Respostas abertas", abertas, [44, 80, ...(comAutor ? [26] : [])]);

  // 5. Respostas individuais (nunca na confidencial).
  if (respostas && detalhe.identificacao !== "confidencial") {
    const identificada = detalhe.identificacao === "identificada";
    const principal = r?.perguntaId ?? null;
    const outras = perguntas.filter((p) => p.id !== principal);
    const linhas: CelulaXlsx[][] = [
      ...cabecalho("Respostas individuais", rel),
      [
        identificada ? "Nome" : "Participante",
        ...(identificada ? ["Departamento"] : []),
        "Nota principal",
        "Grupo",
        ...outras.map((p) => textoParaOPainel(p.rotulo || p.texto)),
      ],
    ];
    for (const x of respostas) {
      const valores = new Map(x.valores.map((v) => [v.perguntaId, v.valor]));
      const nota = principal ? valores.get(principal) : undefined;
      linhas.push([
        identificada ? (x.nome ?? "") : `Participante ${x.numero}`,
        ...(identificada ? [x.departamento ?? "—"] : []),
        typeof nota === "number" ? nota : "Sem resposta",
        typeof nota === "number"
          ? GRUPOS_DO_ENPS.find((g) => g.grupo === grupoDaNota(nota))!.singular
          : "—",
        ...outras.map((p) => {
          const v = valores.get(p.id);
          if (v === undefined || v === null || v === "") return "Sem resposta";
          return typeof v === "number" ? v : String(v);
        }),
      ]);
    }
    aba("Respostas individuais", linhas, [
      26,
      ...(identificada ? [20] : []),
      14,
      12,
      ...outras.map(() => 24),
    ]);
  }
  return abas;
}

export function planilhaDoEnps(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  respostas: readonly RespostaDetalhe[] | null,
): Uint8Array {
  return montarXlsx(abasDoEnps(rel, detalhe, geral, respostas));
}
