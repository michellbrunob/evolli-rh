/**
 * T216 — o texto de cada resposta e a planilha (.xlsx) dos resultados,
 * gerada no navegador. O PDF é a página imprimível do relatório.
 *
 * Privacidade (LGPD): a exportação segue a identificação da pesquisa. O
 * resumo por pergunta nunca leva autor fora da identificada, mesmo que o
 * servidor o mande; respostas individuais saem com o nome só na
 * identificada, numeradas na anônima e nunca na confidencial. Nada leva CPF.
 */
import { abasDoModelo } from "./modelos/exportacao";
import { abasDaPlanilhaClima } from "./modelos/clima/planilhaClima";
import { temTelasDoClima } from "./modelos/clima/catalogo";
import type {
  CampoGrupo,
  Identificacao,
  Pergunta,
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadoPergunta,
  ResultadosPesquisa,
} from "../../api/pesquisasClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { plural } from "../../format/plural";
import { nomeDoArquivo } from "../dashboard/exportacao";
import {
  type AbaXlsx,
  type CelulaXlsx,
  montarXlsx,
} from "../pessoas/importacao/planilhaXlsx";
import {
  INTERVALO_DA_ZONA,
  textoDaFaixa,
  type RelatorioDeResultados,
} from "./dadosDoRelatorio";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { CAMPOS_DE_GRUPO } from "./SepararRespostasPor";
import { ehDeEscala } from "./indicadores";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_TIPO,
  ROTULOS_DA_CONCORDANCIA,
  rotulosDosPontos,
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
    case "escolha_unica":
    case "escolha_forcada": {
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
    case "concordancia":
    case "concordancia_4":
    case "satisfacao_4": {
      const n = Number(valor);
      const rotulos = rotulosDosPontos(p) ?? ROTULOS_DA_CONCORDANCIA;
      return `${n} · ${rotulos[n - 1] ?? ""}`.trim();
    }
    case "escala": {
      const n = Number(valor);
      const rotulo = rotulosDosPontos(p)?.[n - (p.config.minimo ?? 1)];
      return rotulo ? `${n} · ${rotulo}` : numero(n);
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

/** Percentual (0–100) como célula de porcentagem do Excel. */
const porcento = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: v / 100, formato: "percentual" };
/** Média com uma casa, como número. */
const decimal = (v: number | null): CelulaXlsx =>
  v === null ? "—" : { numero: Math.round(v * 10) / 10, formato: "decimal" };

const ROTULO_DA_ESCALA = (e: { minimo: number; maximo: number }) =>
  `${e.minimo} a ${e.maximo}`;

/** Título na linha 1 e "<Empresa> · <pesquisa>" na linha 2. */
function cabecalhoDaAba(
  titulo: string,
  rel: RelatorioDeResultados,
): CelulaXlsx[][] {
  return [[titulo], [`${rel.empresa || "Empresa"} · ${rel.nome}`], []];
}

const DEPOIS_DO_CABECALHO = 3;

/**
 * A planilha (.xlsx) do relatório: Resumo, Perguntas, eNPS, Participantes
 * (só identificada e anônima), Comentários, Alertas e Metodologia. Números
 * saem como número (médias com uma casa, percentuais em %, datas como data).
 * O gerador não embute imagens: os gráficos ficam no relatório em PDF.
 */
export function planilhaDosResultados(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  respostas: readonly RespostaDetalhe[] | null,
): Uint8Array {
  // T216 — Clima: a planilha própria do modelo, no lugar das abas genéricas.
  if (temTelasDoClima(detalhe, geral))
    return montarXlsx(
      abasDaPlanilhaClima({
        rel,
        detalhe,
        r: geral.modelo?.modelo === "clima" ? geral.modelo : null,
        respostas,
      }),
    );
  const abas: AbaXlsx[] = [];
  const titulo = (linhas: CelulaXlsx[][], cabecalhos: number[]) => ({
    titulo: true,
    linhasDeCabecalho: cabecalhos,
    linhas,
  });

  // 1. Resumo.
  const resumo: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Resumo", rel),
    ["Participação", ""],
    ["Convidados", rel.convidados === null ? "Link aberto" : rel.convidados],
    ["Respostas", rel.respostas],
    ...(rel.participacao !== null
      ? [["Taxa de participação", porcento(rel.participacao)]]
      : []),
    ["Período das respostas", rel.periodo],
    ["Identificação", ROTULO_DA_IDENTIFICACAO[rel.identificacao]],
    [],
    ["Resultado", "", ""],
  ];
  const linhaDoResultado = resumo.length - 1;
  if (rel.numerosOcultos)
    resumo.push([
      "Números ocultos",
      "",
      `Menos de ${rel.minimoPorGrupo} respostas: para proteger quem respondeu, médias, favorável, eNPS e comentários não aparecem.`,
    ]);
  else
    resumo.push(
      [
        "Média geral (de 0 a 10)",
        decimal(rel.mediaGeral),
        rel.faixaGeral
          ? textoDaFaixa(rel.faixaGeral)
          : "Sem perguntas de escala",
      ],
      [
        "Favorável",
        porcento(rel.favoravelGeral),
        "Notas 8 a 10 na escala de 10 (ou o terço de cima das outras escalas)",
      ],
      rel.enps
        ? [
            "eNPS",
            rel.enps.indice,
            `${rel.enps.rotuloDaZona} · ${percentual(rel.enps.promotores, rel.enps.total)}% promotores · ${percentual(rel.enps.neutros, rel.enps.total)}% neutros · ${percentual(rel.enps.detratores, rel.enps.total)}% detratores`,
          ]
        : ["eNPS", "—", "Sem a pergunta de recomendação"],
      [
        "Maior média",
        decimal(rel.maior?.media10 ?? null),
        rel.maior?.texto ?? "—",
      ],
      [
        "Menor média",
        decimal(rel.menor?.media10 ?? null),
        rel.menor?.texto ?? "—",
      ],
      [
        "Comentários livres",
        rel.comentarios.reduce((n, c) => n + c.textos.length, 0),
      ],
    );
  abas.push({
    nome: "Resumo",
    larguras: [28, 16, 70],
    ...titulo(resumo, [DEPOIS_DO_CABECALHO, linhaDoResultado]),
  });

  // T216 — as abas próprias do modelo (dimensões, pilares), logo depois.
  if (!rel.numerosOcultos)
    abas.push(
      ...abasDoModelo(geral, rel.empresa, rel.nome, {
        minimoPorGrupo: rel.minimoPorGrupo,
        respostas,
        secoes: detalhe.secoes,
      }),
    );

  // 2. Perguntas (as de escala; o eNPS tem a aba dele).
  const menorNota = Math.min(10, ...rel.perguntas.map((p) => p.escala.minimo));
  const maiorNota = Math.max(1, ...rel.perguntas.map((p) => p.escala.maximo));
  const NOTAS = Array.from(
    { length: maiorNota - menorNota + 1 },
    (_, i) => menorNota + i,
  );
  const perguntas: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Perguntas", rel),
    [
      "#",
      "Pergunta",
      "Tema",
      "Escala",
      "Respostas",
      "Média",
      "Média (0 a 10)",
      "Faixa",
      "Favorável",
      "Neutro",
      "Desfavorável",
      ...NOTAS.map((n) => `Nota ${n}`),
    ],
    ...[...rel.perguntas]
      .sort((a, b) => a.numero - b.numero)
      .map((p): CelulaXlsx[] => [
        p.numero,
        p.texto,
        p.rotulo,
        ROTULO_DA_ESCALA(p.escala),
        p.respostas,
        decimal(p.media),
        decimal(p.media10),
        p.faixa ? textoDaFaixa(p.faixa) : "—",
        porcento(p.favoravel),
        porcento(p.neutro),
        porcento(p.desfavoravel),
        ...NOTAS.map(
          (n) => p.porNota.find((x) => x.nota === n)?.quantidade ?? "",
        ),
      ]),
    [
      "",
      "Média geral (média das perguntas)",
      "",
      "",
      "",
      "",
      decimal(rel.mediaGeral),
    ],
  ];
  abas.push({
    nome: "Perguntas",
    larguras: [5, 60, 26, 10, 11, 9, 13, 20, 11, 10, 13, ...NOTAS.map(() => 8)],
    ...titulo(perguntas, [DEPOIS_DO_CABECALHO]),
  });

  // 3. eNPS.
  const enps: CelulaXlsx[][] = [...cabecalhoDaAba("eNPS", rel)];
  const cabecalhosDoEnps = [DEPOIS_DO_CABECALHO];
  if (rel.numerosOcultos) {
    enps.push([
      `Números ocultos: menos de ${rel.minimoPorGrupo} respostas, para proteger quem respondeu.`,
    ]);
  } else if (rel.enps) {
    const e = rel.enps;
    enps.push(
      ["Indicador", "Valor", "Detalhe"],
      ["eNPS", e.indice, `${e.rotuloDaZona} (${INTERVALO_DA_ZONA[e.zona]})`],
      ["Respostas", e.total, ""],
      [
        "Promotores (9 e 10)",
        e.promotores,
        porcento(percentual(e.promotores, e.total)),
      ],
      ["Neutros (7 e 8)", e.neutros, porcento(percentual(e.neutros, e.total))],
      [
        "Detratores (0 a 6)",
        e.detratores,
        porcento(percentual(e.detratores, e.total)),
      ],
      [],
      ["Nota", "Pessoas", "Do total"],
    );
    cabecalhosDoEnps.push(enps.length - 1);
    for (const n of e.porNota)
      enps.push([
        n.nota,
        n.quantidade,
        porcento(percentual(n.quantidade, e.total)),
      ]);
  } else {
    enps.push(["Esta pesquisa não tem a pergunta de recomendação (eNPS)."]);
  }
  abas.push({
    nome: "eNPS",
    larguras: [24, 12, 40],
    ...titulo(enps, cabecalhosDoEnps),
  });

  // 4. Participantes: nunca na confidencial.
  const individuais =
    detalhe.identificacao === "confidencial" ? null : respostas;
  if (individuais) {
    const todas = perguntasEmOrdem(detalhe.secoes);
    const identificada = detalhe.identificacao === "identificada";
    const ocultos = new Set(
      geral.departamentos.filter((d) => !d.visivel).map((d) => d.nome),
    );
    // Anônima: uma coluna por campo de "separar por", com o grupo escolhido
    // ou "Oculto" (abaixo do mínimo ou protegendo um grupo menor).
    const campos = identificada
      ? []
      : (detalhe.separarPor ?? []).filter((c) =>
          CAMPOS_DE_GRUPO.some((x) => x.campo === c),
        );
    const grupoDe = (r: RespostaDetalhe, campo: CampoGrupo) => {
      const g = r.grupos?.find((x) => x.campo === campo);
      if (g?.oculto) return "Oculto";
      if (g?.grupo) return ocultos.has(g.grupo) ? "Oculto" : g.grupo;
      return "—";
    };
    const colunasDeGrupo = identificada
      ? ["Departamento"]
      : campos.length > 0
        ? campos.map((c) => CAMPOS_DE_GRUPO.find((x) => x.campo === c)!.rotulo)
        : ["Departamento"];
    const gruposDa = (r: RespostaDetalhe): CelulaXlsx[] =>
      identificada
        ? [r.departamento ?? "—"]
        : campos.length > 0
          ? campos.map((c) => grupoDe(r, c))
          : ["—"];
    const formatos: Record<number, "data" | "dataHora"> = {};
    const fixas = identificada ? 3 : 1 + colunasDeGrupo.length;
    if (identificada) formatos[2] = "dataHora";
    todas.forEach((p, i) => {
      if (p.tipo === "data") formatos[fixas + i] = "data";
    });
    const participantes: CelulaXlsx[][] = [
      ...cabecalhoDaAba("Participantes", rel),
      [
        identificada ? "Nome" : "Participante",
        ...colunasDeGrupo,
        ...(identificada ? ["Respondida em"] : []),
        ...todas.map((p, i) => `${i + 1}. ${p.rotulo || p.texto}`),
        "Média",
      ],
      ...individuais.map((r): CelulaXlsx[] => {
        const valores = new Map(r.valores.map((v) => [v.perguntaId, v.valor]));
        return [
          identificada ? (r.nome ?? "") : `Participante ${r.numero}`,
          ...gruposDa(r),
          ...(identificada
            ? [
                serialDoInstante(r.respondidaEm) ??
                  formatarInstante(r.respondidaEm),
              ]
            : []),
          ...todas.map((p) =>
            valores.has(p.id)
              ? celulaDaResposta(p, valores.get(p.id))
              : SEM_RESPOSTA,
          ),
          decimal(r.media),
        ];
      }),
    ];
    abas.push({
      nome: "Participantes",
      larguras: [
        26,
        20,
        ...(identificada ? [18] : []),
        ...todas.map(() => 24),
        9,
      ],
      formatos,
      ...titulo(participantes, [DEPOIS_DO_CABECALHO]),
    });
  }

  // 5. Comentários (em ordem alfabética fora da identificada).
  const comAutor = rel.identificacao === "identificada";
  const comentarios: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Comentários", rel),
    ["Pergunta", "Comentário", ...(comAutor ? ["Autor"] : [])],
  ];
  for (const c of rel.comentarios)
    for (const t of c.textos)
      comentarios.push([
        c.pergunta,
        t.texto,
        ...(comAutor ? [t.autor ?? ""] : []),
      ]);
  if (comentarios.length === DEPOIS_DO_CABECALHO + 1)
    comentarios.push(["", "Nenhum comentário livre."]);
  abas.push({
    nome: "Comentários",
    larguras: [40, 80, ...(comAutor ? [26] : [])],
    ...titulo(comentarios, [DEPOIS_DO_CABECALHO]),
  });

  // 6. Alertas.
  const alertas: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Alertas", rel),
    [
      "Severidade",
      "Onde",
      "O quê",
      "Departamento",
      "Média (0 a 10)",
      "Favorável",
      "Respostas",
      "Motivo",
    ],
    ...rel.alertas.map((a): CelulaXlsx[] => [
      a.severidade,
      a.onde,
      a.oQue,
      a.departamento,
      decimal(a.media),
      porcento(a.favoravel),
      a.respostas,
      a.motivo,
    ]),
  ];
  if (rel.alertas.length === 0)
    alertas.push(["—", "", "Nenhum ponto de atenção pelas regras abaixo."]);
  abas.push({
    nome: "Alertas",
    larguras: [11, 13, 40, 22, 14, 11, 11, 44],
    ...titulo(alertas, [DEPOIS_DO_CABECALHO]),
  });

  // 7. Metodologia.
  const metodologia: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Metodologia", rel),
    ["Tema", "Como é calculado"],
    ...METODOLOGIA.map(([tema, texto]) => [tema, texto]),
    [
      "Grupos pequenos",
      `Grupos com menos de ${rel.minimoPorGrupo} respostas não mostram números, para ninguém ser reconhecido.`,
    ],
  ];
  abas.push({
    nome: "Metodologia",
    larguras: [26, 100],
    quebrarTexto: false,
    ...titulo(metodologia, [DEPOIS_DO_CABECALHO]),
  });

  return montarXlsx(abas);
}

/** O que cada número quer dizer (planilha e relatório em PDF). */
export const METODOLOGIA: readonly (readonly [string, string])[] = [
  [
    "Escala",
    "As perguntas de nota usam a escala do modelo (de 1 a 10, de 1 a 5 ou de 0 a 10). Para comparar, toda média é levada à escala de 0 a 10.",
  ],
  [
    "Média da pergunta",
    "Soma das notas dividida pelo número de pessoas que responderam a pergunta.",
  ],
  [
    "Média geral",
    "Média simples das médias das perguntas de nota (a de recomendação fica de fora).",
  ],
  [
    "Favorável, neutro e desfavorável",
    "Na escala de 10: notas 8 a 10 (favorável), 5 a 7 (neutro) e 1 a 4 (desfavorável). Nas outras escalas, o terço de cima, o do meio e o de baixo.",
  ],
  [
    "Faixas da média",
    "Abaixo de 6,5: crítica. De 6,5 a 7,9: atenção. 8 ou mais: saudável.",
  ],
  [
    "eNPS",
    "Percentual de promotores (notas 9 e 10) menos o de detratores (0 a 6). Vai de −100 a 100.",
  ],
  [
    "Identificação",
    "Identificada: as respostas mostram quem respondeu. Confidencial: o RH vê só os resultados agregados, sem respostas individuais. Anônima: ninguém é identificado; as respostas são numeradas.",
  ],
  [
    "Preenchimento",
    "Perguntas opcionais em branco não entram nas médias; cada pergunta conta só quem a respondeu.",
  ],
];

export function nomeDaExportacao(
  nome: string,
  extensao: "xlsx" | "pdf",
): string {
  return nomeDoArquivo([nome, "resultados"], extensao);
}
