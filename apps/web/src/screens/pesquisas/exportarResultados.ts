/**
 * T216 — o texto de cada resposta e a exportação dos resultados (Excel e
 * PDF), gerados no navegador.
 *
 * Privacidade (LGPD): a exportação segue a identificação da pesquisa. O
 * resumo por pergunta nunca leva autor fora da identificada, mesmo que o
 * servidor o mande; respostas individuais saem com o nome só na
 * identificada, numeradas na anônima e nunca na confidencial. Nada leva CPF.
 */
import type {
  Identificacao,
  IndicadoresDosResultados,
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoPergunta,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import {
  type Cor,
  DocumentoPdf,
  cortarTexto,
  larguraDoTexto,
} from "../../arquivos/pdfSimples";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { plural } from "../../format/plural";
import { nomeDoArquivo } from "../dashboard/exportacao";
import { type AbaXlsx, montarXlsx } from "../pessoas/importacao/planilhaXlsx";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { ROTULO_DA_ZONA, ehDeEscala, escalaDe, mediaNa10 } from "./indicadores";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_TIPO,
  ROTULOS_DA_CONCORDANCIA,
  dataDoInstante,
  percentual,
  umaCasa,
} from "./textosDasPesquisas";

export const SEM_RESPOSTA = "Sem resposta";

const DIA_EM_MS = 86_400_000;
/** 1970-01-01 no sistema de datas do Excel (1900). */
const EPOCA_DO_EXCEL = 25_569;
/** Brasília: UTC−3 (sem horário de verão desde 2019). */
const FUSO_DE_BRASILIA_MS = 3 * 3_600_000;

/** Um instante como data e hora seriais do Excel, no horário de Brasília. */
export function serialDoInstante(iso: string): number | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return (ms - FUSO_DE_BRASILIA_MS) / DIA_EM_MS + EPOCA_DO_EXCEL;
}

/** Um dia civil (`AAAA-MM-DD`) como data serial do Excel. */
export function serialDoDia(dia: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  return (
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DIA_EM_MS +
    EPOCA_DO_EXCEL
  );
}

/** Tipos cuja resposta vai à planilha como número. */
function respostaNumerica(p: Pergunta): boolean {
  return ehDeEscala(p) || p.tipo === "numero";
}

/** A célula da resposta: número, data serial ou texto. */
function celulaDaResposta(p: Pergunta, valor: unknown): string | number {
  if (valor === null || valor === undefined || valor === "")
    return SEM_RESPOSTA;
  if (respostaNumerica(p)) {
    const n = typeof valor === "number" ? valor : Number(valor);
    if (Number.isFinite(n)) return n;
  }
  if (p.tipo === "data") {
    const serial = serialDoDia(String(valor));
    if (serial !== null) return serial;
  }
  return textoDoValor(p, valor);
}

const numero = (n: number) => String(n).replace(".", ",");

/** A resposta de uma pessoa, em texto legível. */
export function textoDoValor(p: Pergunta, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "")
    return SEM_RESPOSTA;
  const opcao = (id: unknown) =>
    p.config.opcoes?.find((o) => o.id === id)?.texto ?? "Opção removida";
  switch (p.tipo) {
    case "texto_curto":
    case "paragrafo":
      return String(valor);
    case "escolha_unica": {
      const v = valor as { opcao?: string; outro?: string };
      if (typeof v.outro === "string") return `Outro: ${v.outro}`;
      return v.opcao ? opcao(v.opcao) : SEM_RESPOSTA;
    }
    case "multipla_escolha": {
      const v = valor as { opcoes?: string[]; outro?: string };
      const partes = (v.opcoes ?? []).map(opcao);
      if (typeof v.outro === "string" && v.outro)
        partes.push(`Outro: ${v.outro}`);
      return partes.length > 0 ? partes.join(", ") : SEM_RESPOSTA;
    }
    case "sim_nao":
      return valor === "sim" ? "Sim" : valor === "nao" ? "Não" : SEM_RESPOSTA;
    case "concordancia": {
      const n = Number(valor);
      return `${n} · ${ROTULOS_DA_CONCORDANCIA[n - 1] ?? ""}`.trim();
    }
    case "estrelas":
      return plural(Number(valor), "estrela", "estrelas");
    case "data":
      return formatarDiaCivil(String(valor));
    default:
      return typeof valor === "number" ? numero(valor) : String(valor);
  }
}

/** O resultado agregado de uma pergunta, em uma linha de texto. */
export function resumoDoResultado(
  p: Pergunta,
  r: ResultadoPergunta | undefined,
  identificacao: Identificacao,
): string {
  if (!r) return "Sem respostas";
  const partes: string[] = [];
  if ("enps" in r) {
    const { promotores, neutros, detratores, indice } = r.enps;
    partes.push(
      `eNPS ${indice === null ? "—" : indice}`,
      `${plural(promotores, "promotor", "promotores")}, ${plural(neutros, "neutro", "neutros")}, ${plural(detratores, "detrator", "detratores")}`,
    );
  }
  if ("media" in r && r.media !== undefined) {
    partes.push(`Média ${r.media === null ? "—" : umaCasa(r.media)}`);
    if ("favoravel" in r && r.favoravel !== undefined && r.favoravel !== null)
      partes.push(`${r.favoravel}% favorável`);
    if (r.distribuicao && r.distribuicao.length > 0)
      partes.push(
        r.distribuicao.map((d) => `${d.valor}: ${d.quantidade}`).join("; "),
      );
  }
  if ("opcoes" in r) {
    const total = r.respondidas;
    partes.push(
      r.opcoes
        .map((o) => {
          const texto =
            p.config.opcoes?.find((x) => x.id === o.opcaoId)?.texto ??
            "Opção removida";
          return `${texto}: ${o.quantidade} (${percentual(o.quantidade, total)}%)`;
        })
        .join("; "),
    );
    if (r.outros.length > 0) partes.push(`Outro: ${r.outros.join(" | ")}`);
  }
  if ("sim" in r) {
    const total = r.sim + r.nao;
    partes.push(
      `Sim: ${r.sim} (${percentual(r.sim, total)}%); Não: ${r.nao} (${percentual(r.nao, total)}%)`,
    );
  }
  if ("textos" in r) {
    partes.push(
      r.textos
        .map((t) =>
          identificacao === "identificada" && t.autor
            ? `${t.autor}: ${t.texto}`
            : t.texto,
        )
        .join(" | "),
    );
  }
  if ("datas" in r) {
    partes.push(
      r.datas
        .map((d) => `${formatarDiaCivil(d.valor)}: ${d.quantidade}`)
        .join("; "),
    );
  }
  return partes.filter(Boolean).join(" · ");
}

export interface LinhaDoResumo {
  readonly secao: string;
  readonly numero: number;
  readonly pergunta: string;
  readonly tipo: string;
  readonly viram: number;
  readonly responderam: number;
  readonly resultado: string;
}

/** As linhas do resumo por pergunta (planilha e PDF); vazio abaixo do mínimo. */
export function linhasDoResumo(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
): LinhaDoResumo[] {
  if (!resultados.filtro.visivel) return [];
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  const linhas: LinhaDoResumo[] = [];
  let n = 0;
  detalhe.secoes.forEach((s, si) => {
    for (const p of s.perguntas) {
      n += 1;
      const r = porId.get(p.id);
      linhas.push({
        secao: s.titulo ?? `Seção ${si + 1}`,
        numero: n,
        pergunta: p.texto,
        tipo: ROTULO_DO_TIPO[p.tipo],
        viram: r ? r.viram : 0,
        responderam: r ? r.respondidas : 0,
        resultado: resumoDoResultado(p, r, detalhe.identificacao),
      });
    }
  });
  return linhas;
}

/**
 * A planilha (.xlsx): "Resultados" (resumo por pergunta) e, quando a
 * identificação permite, "Respostas" (uma linha por resposta: com o nome na
 * identificada; numerada, sem pessoa, na anônima). A confidencial nunca
 * leva respostas individuais.
 */
export function planilhaDosResultados(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
  respostas: readonly RespostaDetalhe[] | null,
): Uint8Array {
  const resumo = linhasDoResumo(detalhe, resultados);
  const abas: AbaXlsx[] = [
    {
      nome: "Resultados",
      cabecalho: true,
      larguras: [22, 6, 60, 18, 10, 12, 70],
      linhas: [
        [
          "Seção",
          "Nº",
          "Pergunta",
          "Tipo",
          "Viram",
          "Responderam",
          "Resultado",
        ],
        ...(resumo.length === 0
          ? [["", "", "Poucas respostas para mostrar", "", "", "", ""]]
          : resumo.map((l) => [
              l.secao,
              l.numero,
              l.pergunta,
              l.tipo,
              l.viram,
              l.responderam,
              l.resultado,
            ])),
      ],
    },
  ];
  const individuais =
    detalhe.identificacao === "confidencial" ? null : respostas;
  if (individuais) {
    const perguntas = perguntasEmOrdem(detalhe.secoes);
    const identificada = detalhe.identificacao === "identificada";
    const formatos: Record<number, "data" | "dataHora"> = { 2: "dataHora" };
    perguntas.forEach((p, i) => {
      if (p.tipo === "data") formatos[3 + i] = "data";
    });
    abas.push({
      nome: "Respostas",
      cabecalho: true,
      formatos,
      larguras: [26, 20, 20, ...perguntas.map(() => 30)],
      linhas: [
        [
          identificada ? "Nome" : "Resposta",
          "Departamento",
          "Respondida em",
          ...perguntas.map((p, i) => `${i + 1}. ${p.rotulo || p.texto}`),
        ],
        ...individuais.map((r) => {
          const valores = new Map(
            r.valores.map((v) => [v.perguntaId, v.valor]),
          );
          return [
            identificada ? (r.nome ?? "") : `Resposta #${r.numero}`,
            identificada ? (r.departamento ?? "") : "",
            serialDoInstante(r.respondidaEm) ??
              formatarInstante(r.respondidaEm),
            ...perguntas.map((p) =>
              valores.has(p.id)
                ? celulaDaResposta(p, valores.get(p.id))
                : SEM_RESPOSTA,
            ),
          ];
        }),
      ],
    });
  }
  return montarXlsx(abas);
}

const MARGEM = 40;
const TINTA: Cor = [29, 29, 31];
const SUAVE: Cor = [71, 84, 103];
const LINHA: Cor = [210, 210, 215];

/** Quebra o texto em linhas que cabem na largura (palavra a palavra). */
function quebrar(texto: string, largura: number, tamanho: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(" ")) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (larguraDoTexto(tentativa, tamanho) > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 8);
}

/** O relatório em PDF: cabeçalho, indicadores e o resumo de cada pergunta. */
export function pdfDosResultados(
  detalhe: PesquisaDetalhe,
  resultados: ResultadosPesquisa,
  indicadores: Pick<IndicadoresDosResultados, "mediaGeral" | "enps"> &
    Partial<Pick<IndicadoresDosResultados, "maiorMedia" | "menorMedia">>,
): Uint8Array {
  const doc = new DocumentoPdf(detalhe.nome);
  let pg = doc.novaPagina();
  let y = 50;
  pg.texto(MARGEM, y, cortarTexto(detalhe.nome, pg.largura - MARGEM * 2, 16), {
    tamanho: 16,
    negrito: true,
    cor: TINTA,
  });
  y += 18;
  pg.texto(
    MARGEM,
    y,
    `${ROTULO_DO_MODELO[detalhe.modelo]} · ${ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]} · ${plural(resultados.respostas, "resposta", "respostas")} · criada em ${dataDoInstante(detalhe.criadaEm)}`,
    { tamanho: 9, cor: SUAVE },
  );
  y += 20;
  y = quadrosDeIndicadores(pg, y, detalhe, indicadores);
  pg.linha(MARGEM, y, pg.largura - MARGEM, y, LINHA);
  y += 18;
  const resumo = linhasDoResumo(detalhe, resultados);
  if (resumo.length === 0) {
    pg.texto(MARGEM, y, "Poucas respostas para mostrar.", {
      tamanho: 10,
      cor: SUAVE,
    });
  }
  const largura = pg.largura - MARGEM * 2;
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  for (const l of resumo) {
    const titulo = quebrar(`${l.numero}. ${l.pergunta}`, largura, 10);
    const corpo = quebrar(l.resultado || "Sem respostas", largura, 8);
    const p = perguntas[l.numero - 1];
    const r = p ? porId.get(p.id) : undefined;
    const barras = p && r ? barrasDaPergunta(p, r) : [];
    const altura =
      titulo.length * 13 + corpo.length * 11 + barras.length * 14 + 12;
    if (y + altura > pg.altura - MARGEM) {
      pg = doc.novaPagina();
      y = 50;
    }
    for (const t of titulo) {
      pg.texto(MARGEM, y, t, { tamanho: 10, negrito: true, cor: TINTA });
      y += 13;
    }
    for (const t of corpo) {
      pg.texto(MARGEM, y, t, { tamanho: 8, cor: SUAVE });
      y += 11;
    }
    y = desenharBarras(pg, y, barras);
    y += 12;
  }
  return doc.bytes();
}

type PaginaPdf = ReturnType<DocumentoPdf["novaPagina"]>;

const VERMELHO: Cor = [196, 50, 50];
const AMARELO: Cor = [214, 160, 30];
const VERDE: Cor = [38, 140, 80];
const AZUL: Cor = [40, 100, 200];
const TRILHO: Cor = [236, 236, 240];

/** Do vermelho (nota baixa) ao verde (nota alta), passando pelo amarelo. */
function corDaNotaNoPdf(fracao: number): Cor {
  const f = Math.max(0, Math.min(1, fracao));
  const [a, b, t] =
    f <= 0.5 ? [VERMELHO, AMARELO, f / 0.5] : [AMARELO, VERDE, (f - 0.5) / 0.5];
  return [0, 1, 2].map((i) =>
    Math.round(a[i]! + (b[i]! - a[i]!) * t),
  ) as unknown as Cor;
}

interface BarraDoPdf {
  readonly rotulo: string;
  readonly quantidade: number;
  readonly total: number;
  readonly cor: Cor;
}

/** As barras de uma pergunta: distribuição das notas ou das opções. */
function barrasDaPergunta(p: Pergunta, r: ResultadoPergunta): BarraDoPdf[] {
  if ("media" in r && r.distribuicao && r.distribuicao.length > 0) {
    const e = ehDeEscala(p) ? escalaDe(p) : null;
    const total = r.distribuicao.reduce((s, d) => s + d.quantidade, 0);
    return r.distribuicao.map((d) => ({
      rotulo: String(d.valor),
      quantidade: d.quantidade,
      total,
      cor: e
        ? corDaNotaNoPdf(
            (d.valor - e.minimo) / Math.max(1, e.maximo - e.minimo),
          )
        : AZUL,
    }));
  }
  if ("opcoes" in r) {
    return r.opcoes.map((o) => ({
      rotulo:
        p.config.opcoes?.find((x) => x.id === o.opcaoId)?.texto ??
        "Opção removida",
      quantidade: o.quantidade,
      total: r.respondidas,
      cor: AZUL,
    }));
  }
  if ("sim" in r) {
    const total = r.sim + r.nao;
    return [
      { rotulo: "Sim", quantidade: r.sim, total, cor: VERDE },
      { rotulo: "Não", quantidade: r.nao, total, cor: VERMELHO },
    ];
  }
  return [];
}

/** Desenha as barras horizontais (rótulo, trilho, barra e percentual). */
function desenharBarras(
  pg: PaginaPdf,
  y0: number,
  barras: readonly BarraDoPdf[],
): number {
  let y = y0 + (barras.length > 0 ? 4 : 0);
  const xTrilho = MARGEM + 110;
  const largura = pg.largura - MARGEM - 60 - xTrilho;
  for (const b of barras) {
    pg.texto(MARGEM, y + 7, cortarTexto(b.rotulo, 104, 8), {
      tamanho: 8,
      cor: SUAVE,
    });
    pg.retangulo(xTrilho, y, largura, 8, { preenchimento: TRILHO });
    const fracao = b.total > 0 ? b.quantidade / b.total : 0;
    if (fracao > 0)
      pg.retangulo(xTrilho, y, largura * fracao, 8, { preenchimento: b.cor });
    pg.texto(
      xTrilho + largura + 8,
      y + 7,
      `${b.quantidade} · ${percentual(b.quantidade, b.total)}%`,
      {
        tamanho: 8,
        cor: TINTA,
      },
    );
    y += 14;
  }
  return y;
}

/** Quatro quadros: média geral, maior e menor média e eNPS (com a zona). */
function quadrosDeIndicadores(
  pg: PaginaPdf,
  y: number,
  detalhe: PesquisaDetalhe,
  ind: Pick<IndicadoresDosResultados, "mediaGeral" | "enps"> &
    Partial<Pick<IndicadoresDosResultados, "maiorMedia" | "menorMedia">>,
): number {
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const textoDa = (id: string | undefined) => {
    const p = perguntas.find((x) => x.id === id);
    return p ? p.rotulo || p.texto : "";
  };
  const na10 = (
    x: { perguntaId: string; media: number } | null | undefined,
  ) => {
    if (!x) return null;
    const p = perguntas.find((q) => q.id === x.perguntaId);
    return p && ehDeEscala(p) ? mediaNa10(x.media, escalaDe(p)) : x.media;
  };
  const quadros: { titulo: string; valor: string; nota: string }[] = [
    {
      titulo: "Média geral",
      valor: ind.mediaGeral === null ? "—" : `${umaCasa(ind.mediaGeral)} /10`,
      nota: "Perguntas de escala, de 0 a 10",
    },
    {
      titulo: "Maior média",
      valor: ind.maiorMedia ? umaCasa(na10(ind.maiorMedia) ?? 0) : "—",
      nota: textoDa(ind.maiorMedia?.perguntaId),
    },
    {
      titulo: "Menor média",
      valor: ind.menorMedia ? umaCasa(na10(ind.menorMedia) ?? 0) : "—",
      nota: textoDa(ind.menorMedia?.perguntaId),
    },
    {
      titulo: "eNPS",
      valor: ind.enps ? String(ind.enps.indice) : "—",
      nota: ind.enps
        ? ROTULO_DA_ZONA[ind.enps.zona]
        : "Sem a pergunta de recomendação",
    },
  ];
  const vao = 8;
  const largura = (pg.largura - MARGEM * 2 - vao * 3) / 4;
  const altura = 52;
  quadros.forEach((q, i) => {
    const x = MARGEM + i * (largura + vao);
    pg.retangulo(x, y, largura, altura, { contorno: LINHA, espessura: 0.6 });
    pg.texto(x + 8, y + 14, q.titulo, { tamanho: 8, cor: SUAVE });
    pg.texto(x + 8, y + 31, q.valor, {
      tamanho: 14,
      negrito: true,
      cor: TINTA,
    });
    pg.texto(x + 8, y + 45, cortarTexto(q.nota, largura - 16, 7), {
      tamanho: 7,
      cor: SUAVE,
    });
  });
  return y + altura + 14;
}

/** O PDF de uma resposta: cada pergunta e o que foi respondido. */
export function pdfDaResposta(
  nomeDaPesquisa: string,
  titulo: string,
  resposta: Pick<RespostaDetalhe, "respondidaEm" | "valores">,
  secoes: readonly PesquisaDetalhe["secoes"][number][],
): Uint8Array {
  const doc = new DocumentoPdf(`${nomeDaPesquisa} — ${titulo}`);
  let pg = doc.novaPagina();
  let y = 50;
  pg.texto(MARGEM, y, cortarTexto(titulo, pg.largura - MARGEM * 2, 16), {
    tamanho: 16,
    negrito: true,
    cor: TINTA,
  });
  y += 18;
  pg.texto(
    MARGEM,
    y,
    cortarTexto(
      `${nomeDaPesquisa} · respondeu em ${formatarInstante(resposta.respondidaEm)}`,
      pg.largura - MARGEM * 2,
      9,
    ),
    { tamanho: 9, cor: SUAVE },
  );
  y += 16;
  pg.linha(MARGEM, y, pg.largura - MARGEM, y, LINHA);
  y += 18;
  const valores = new Map(resposta.valores.map((v) => [v.perguntaId, v.valor]));
  const largura = pg.largura - MARGEM * 2;
  perguntasEmOrdem(secoes).forEach((p, i) => {
    const titulo = quebrar(`${i + 1}. ${p.texto}`, largura, 10);
    const corpo = quebrar(
      valores.has(p.id) ? textoDoValor(p, valores.get(p.id)) : SEM_RESPOSTA,
      largura,
      9,
    );
    const altura = titulo.length * 13 + corpo.length * 12 + 10;
    if (y + altura > pg.altura - MARGEM) {
      pg = doc.novaPagina();
      y = 50;
    }
    for (const t of titulo) {
      pg.texto(MARGEM, y, t, { tamanho: 10, negrito: true, cor: TINTA });
      y += 13;
    }
    for (const t of corpo) {
      pg.texto(MARGEM, y, t, { tamanho: 9, cor: SUAVE });
      y += 12;
    }
    y += 10;
  });
  return doc.bytes();
}

export function nomeDaExportacao(
  nome: string,
  extensao: "xlsx" | "pdf",
): string {
  return nomeDoArquivo([nome, "resultados"], extensao);
}
