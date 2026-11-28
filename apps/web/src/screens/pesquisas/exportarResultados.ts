/**
 * T216 — o texto de cada resposta e a planilha (.xlsx) dos resultados,
 * gerada no navegador. O PDF é a página imprimível do relatório.
 *
 * Privacidade (LGPD): a exportação segue a identificação da pesquisa. O
 * resumo por pergunta nunca leva autor fora da identificada, mesmo que o
 * servidor o mande; respostas individuais saem com o nome só na
 * identificada, numeradas na anônima e nunca na confidencial. Nada leva CPF.
 */
import { abasDoModelo, planilhaPropriaDoModelo } from "./modelos/exportacao";
import { abasDaPlanilhaClima } from "./modelos/clima/planilhaClima";
import { temTelasDoClima } from "./modelos/clima/catalogo";
import { planilhaDoEnps } from "./modelos/enps/exportarEnps";
import type {
  CampoGrupo,
  Identificacao,
  ParticipanteDaPesquisa,
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
  type GrupoDoRelatorio,
  type RelatorioDeResultados,
} from "./dadosDoRelatorio";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { textoParaOPainel } from "./modelos/empresa";
import { CAMPOS_DE_GRUPO } from "./SepararRespostasPor";
import { ehDeEscala } from "./indicadores";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_TIPO,
  ROTULOS_DA_CONCORDANCIA,
  rotulosDosPontos,
  percentual,
  textoDoOculto,
  umaCasa,
} from "./textosDasPesquisas";

/**
 * A contagem do grupo, até no oculto (o total e o menor já a revelam); os
 * números do grupo oculto, não.
 */
const respostasDoGrupo = (g: GrupoDoRelatorio): CelulaXlsx => g.respostas;

/** "Departamento", "Centro de custo", "Unidade". */
const rotuloDoCampo = (campo: CampoGrupo) =>
  CAMPOS_DE_GRUPO.find((x) => x.campo === campo)?.rotulo ?? "Grupo";

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

/** A célula na planilha: como `celulaDaResposta`, mas vazia sem resposta. */
function celulaNaPlanilha(p: Pergunta, valor: unknown): string | number {
  const c = celulaDaResposta(p, valor);
  return c === SEM_RESPOSTA ? "" : c;
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

/**
 * Título na linha 1; na 2, "<Empresa> · <pesquisa> · <identificação> ·
 * emitido em <data> por <quem>" e, se houver, a nota da aba.
 */
function cabecalhoDaAba(
  titulo: string,
  rel: RelatorioDeResultados,
  nota?: string,
): CelulaXlsx[][] {
  const emitido = `emitido em ${formatarDiaCivil(rel.emitidoEm)}${rel.emitidoPor ? ` por ${rel.emitidoPor}` : ""}`;
  return [
    [titulo],
    [
      [
        rel.empresa || "Empresa",
        rel.nome,
        ROTULO_DA_IDENTIFICACAO[rel.identificacao],
        emitido,
        ...(nota ? [nota] : []),
      ].join(" · "),
    ],
    [],
  ];
}

/**
 * A ordem das respostas na planilha da anônima: embaralhada de forma
 * estável pela pesquisa (a mesma a cada exportação), sem expor a ordem de
 * chegada.
 */
export function embaralharDeFormaEstavel<T>(
  itens: readonly T[],
  semente: string,
): T[] {
  let h = 2_166_136_261;
  for (let i = 0; i < semente.length; i += 1) {
    h ^= semente.charCodeAt(i);
    h = Math.imul(h, 16_777_619);
  }
  h = h || 1;
  const proximo = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4_294_967_296;
  };
  const r = [...itens];
  for (let i = r.length - 1; i > 0; i -= 1) {
    const j = Math.floor(proximo() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
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
  // T216 — eNPS: as abas do modelo no lugar das genéricas.
  if (detalhe.modelo === "enps")
    return planilhaDoEnps(rel, detalhe, geral, respostas);
  // T216 — Pulso e Clima e TAD: as abas do modelo, no lugar das genéricas.
  const doModelo = planilhaPropriaDoModelo(rel, detalhe, geral, respostas);
  if (doModelo) return montarXlsx(doModelo);
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
    ["Período das respostas", rel.periodoComHoras],
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
        "Média geral (1 a 10)",
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
      "Média (1 a 10)",
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
    // O eNPS de cada grupo do recorte (os pequenos, ocultos).
    if (rel.grupos) {
      const nome = rotuloDoCampo(rel.grupos.campo);
      enps.push(
        [],
        [
          `eNPS por ${nome.toLowerCase()} (grupos com ${rel.minimoPorGrupo}+ respostas)`,
        ],
        [nome, "Respostas", "eNPS", "Promotores", "Neutros", "Detratores"],
      );
      cabecalhosDoEnps.push(enps.length - 1);
      for (const g of rel.grupos.linhas) {
        if (g.grupoId === null) continue;
        enps.push(
          !g.visivel
            ? [
                g.nome,
                respostasDoGrupo(g),
                textoDoOculto(g.oculto, rel.minimoPorGrupo),
              ]
            : g.enps
              ? [
                  g.nome,
                  g.respostas,
                  g.enps.indice,
                  porcento(percentual(g.enps.promotores, g.enps.total)),
                  porcento(percentual(g.enps.neutros, g.enps.total)),
                  porcento(percentual(g.enps.detratores, g.enps.total)),
                ]
              : [g.nome, g.respostas, "—"],
        );
      }
    }
  } else {
    enps.push(["Esta pesquisa não tem a pergunta de recomendação (eNPS)."]);
  }
  abas.push({
    nome: "eNPS",
    larguras: [24, 12, 40, 12, 12, 12],
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
      ...cabecalhoDaAba(
        "Participantes",
        rel,
        identificada
          ? undefined
          : `ordem embaralhada; grupos com menos de ${rel.minimoPorGrupo} respostas aparecem como Oculto`,
      ),
      [
        identificada ? "Nome" : "Participante",
        ...colunasDeGrupo,
        ...(identificada ? ["Respondida em"] : []),
        ...cabecalhosDasPerguntas(todas, rel.empresa),
        "Média (1 a 10)",
      ],
      // Anônima: ordem embaralhada e numerada nela (nunca a de chegada).
      ...(identificada
        ? individuais
        : embaralharDeFormaEstavel(individuais, detalhe.id)
      ).map((r, i): CelulaXlsx[] => {
        const valores = new Map(r.valores.map((v) => [v.perguntaId, v.valor]));
        return [
          identificada ? (r.nome ?? "") : `Participante ${i + 1}`,
          ...gruposDa(r),
          ...(identificada
            ? [
                serialDoInstante(r.respondidaEm) ??
                  formatarInstante(r.respondidaEm),
              ]
            : []),
          // O que não foi respondido fica vazio.
          ...todas.map((p) =>
            valores.has(p.id) ? celulaNaPlanilha(p, valores.get(p.id)) : "",
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

  // 4b. Por departamento (ou o campo do recorte): números de cada grupo.
  if (rel.grupos && !rel.numerosOcultos) {
    const nome = rotuloDoCampo(rel.grupos.campo);
    const porGrupo: CelulaXlsx[][] = [
      ...cabecalhoDaAba(
        `Resultado por ${nome.toLowerCase()}`,
        rel,
        `grupos com menos de ${rel.minimoPorGrupo} respostas ficam ocultos`,
      ),
      [
        nome,
        "Respostas",
        "Média geral",
        "Favorável",
        "eNPS",
        ...rel.grupos.colunas,
      ],
      ...rel.grupos.linhas.map((g): CelulaXlsx[] =>
        g.visivel
          ? [
              g.nome,
              g.respostas,
              decimal(g.mediaGeral),
              porcento(g.favoravel),
              g.enps ? g.enps.indice : "—",
              ...g.medias.map(decimal),
            ]
          : [
              g.nome,
              respostasDoGrupo(g),
              textoDoOculto(g.oculto, rel.minimoPorGrupo),
            ],
      ),
    ];
    abas.push({
      nome: `Por ${nome.toLowerCase()}`,
      larguras: [28, 11, 12, 11, 8, ...rel.grupos.colunas.map(() => 14)],
      ...titulo(porGrupo, [DEPOIS_DO_CABECALHO]),
    });
  }

  // 4c. Preenchimento e Participação: só presença (quem respondeu), nunca a
  // nota; só com convidados (a anônima não tem).
  const convidados =
    detalhe.identificacao === "anonima" ? [] : detalhe.participantesLista;
  if (convidados.length > 0) {
    abas.push(
      abaDoPreenchimento(rel, convidados),
      abaDaParticipacao(rel, convidados),
    );
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

  // 5b. Evolução: a média e o eNPS nas pesquisas do mesmo modelo.
  abas.push(abaDaEvolucao(rel, detalhe));

  // 6. Alertas.
  const alertas: CelulaXlsx[][] = [
    ...cabecalhoDaAba(
      "Alertas",
      rel,
      `perguntas com média abaixo de 6,5 ou menos da metade favorável; grupos (${rel.minimoPorGrupo}+ respostas) com média abaixo de 6,5 ou 1 ponto abaixo da empresa`,
    ),
    [
      "Severidade",
      "Onde",
      "O quê",
      "Departamento",
      "Média (1 a 10)",
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
    ...(convidados.length > 0
      ? [
          [
            "Preenchimento e participação",
            "Convidados, quem respondeu e quem falta, por grupo e por pessoa. Ação: ok com 50% ou mais de preenchimento; cobrar abaixo disso. Só presença, nunca a nota.",
          ],
        ]
      : []),
    [
      "Evolução",
      "Média geral e eNPS das pesquisas do mesmo modelo, da mais antiga para a mais recente. Canceladas e as sem média visível ficam de fora.",
    ],
  ];
  abas.push({
    nome: "Metodologia",
    larguras: [26, 100],
    quebrarTexto: false,
    ...titulo(metodologia, [DEPOIS_DO_CABECALHO]),
  });

  // O índice das abas, no fim do Resumo (com as abas que existem de fato).
  const indice: CelulaXlsx[][] = [
    [],
    ["Abas desta planilha", ""],
    ...abas.slice(1).map((a) => [a.nome, descricaoDaAba(a.nome)]),
  ];
  abas[0] = {
    ...abas[0]!,
    linhas: [...resumo, ...indice],
    linhasDeCabecalho: [
      DEPOIS_DO_CABECALHO,
      linhaDoResultado,
      resumo.length + 1,
    ],
  };

  return montarXlsx(abas);
}

/** O que cada aba traz (o índice do Resumo). */
const DESCRICAO_DA_ABA: Readonly<Record<string, string>> = {
  Perguntas: "Média, favorável e quantas pessoas deram cada nota",
  eNPS: "Promotores, neutros, detratores e o eNPS de cada grupo",
  Participantes:
    "Uma linha por resposta, com o grupo e a nota de cada pergunta",
  Preenchimento: "Convidados, respostas e % por grupo, com ok ou cobrar",
  Participação: "Quem respondeu, por combinação de grupos e por pessoa",
  Comentários: "O que as pessoas escreveram",
  Evolução: "Média e eNPS nas pesquisas anteriores do mesmo modelo",
  Alertas: "Perguntas e grupos que pedem atenção",
  Metodologia: "Como cada número é calculado",
};

function descricaoDaAba(nome: string): string {
  if (DESCRICAO_DA_ABA[nome]) return DESCRICAO_DA_ABA[nome]!;
  if (nome.startsWith("Por "))
    return `Média, favorável e eNPS de cada ${nome.slice(4)}`;
  return "Os resultados próprios do modelo";
}

/**
 * Os cabeçalhos das perguntas na aba Participantes: "1. <texto>", com o
 * texto inteiro (e o nome da empresa no lugar do marcador); a recomendação
 * sai como "eNPS · <texto>" e não conta na numeração.
 */
function cabecalhosDasPerguntas(
  todas: readonly Pergunta[],
  empresa: string,
): string[] {
  let n = 0;
  return todas.map((p) => {
    const texto = textoParaOPainel(p.texto, empresa);
    if (p.tipo === "nota_0_10" && p.config.enps) return `eNPS · ${texto}`;
    n += 1;
    return `${n}. ${texto}`;
  });
}

/** Preenchimento (0–100) e a ação: ok com metade ou mais; senão, cobrar. */
const preenchimento = (responderam: number, total: number) =>
  total > 0 ? Math.round((responderam / total) * 100) : 0;
const acaoDoPreenchimento = (pct: number) => (pct >= 50 ? "ok" : "cobrar");

const CAMPOS_DA_LOTACAO: readonly {
  readonly rotulo: string;
  readonly sem: string;
  readonly de: (p: ParticipanteDaPesquisa) => string | null | undefined;
}[] = [
  {
    rotulo: "Departamento",
    sem: "Sem departamento",
    de: (p) => p.departamento,
  },
  {
    rotulo: "Centro de custo",
    sem: "Sem centro de custo",
    de: (p) => p.centroCusto,
  },
  { rotulo: "Unidade", sem: "Sem unidade", de: (p) => p.unidade },
];

/** Agrupa as pessoas por uma chave (os sem grupo no fim), em ordem de nome. */
function agrupar(
  pessoas: readonly ParticipanteDaPesquisa[],
  chave: (p: ParticipanteDaPesquisa) => string | null,
): [string | null, ParticipanteDaPesquisa[]][] {
  const grupos = new Map<string | null, ParticipanteDaPesquisa[]>();
  for (const p of pessoas) {
    const k = chave(p);
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  return [...grupos.entries()].sort(([a], [b]) =>
    a === null ? 1 : b === null ? -1 : a.localeCompare(b, "pt-BR"),
  );
}

const responderam = (pessoas: readonly ParticipanteDaPesquisa[]) =>
  pessoas.filter((p) => p.respondeu === true).length;

/** Preenchimento: convidados, respostas, quem falta e a ação, por grupo. */
function abaDoPreenchimento(
  rel: RelatorioDeResultados,
  convidados: readonly ParticipanteDaPesquisa[],
): AbaXlsx {
  const linhas: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Preenchimento", rel, "só presença, nunca a nota"),
  ];
  const cabecalhos: number[] = [];
  const linha = (
    nome: string,
    pessoas: readonly ParticipanteDaPesquisa[],
  ): CelulaXlsx[] => {
    const sim = responderam(pessoas);
    const pct = preenchimento(sim, pessoas.length);
    return [
      nome,
      pessoas.length,
      sim,
      pessoas.length - sim,
      porcento(pct),
      acaoDoPreenchimento(pct),
    ];
  };
  CAMPOS_DA_LOTACAO.forEach((campo, i) => {
    // Departamento sempre; centro de custo e unidade quando o cadastro tem.
    if (i > 0 && !convidados.some((p) => campo.de(p))) return;
    if (i > 0) linhas.push([]);
    linhas.push([
      campo.rotulo,
      "Convidados",
      "Responderam",
      "Faltam",
      "Preenchimento",
      "Ação",
    ]);
    cabecalhos.push(linhas.length - 1);
    if (i === 0) linhas.push(linha("Toda a empresa", convidados));
    for (const [nome, pessoas] of agrupar(
      convidados,
      (p) => campo.de(p) ?? null,
    ))
      linhas.push(linha(nome ?? campo.sem, pessoas));
  });
  return {
    nome: "Preenchimento",
    larguras: [32, 12, 13, 9, 15, 10],
    titulo: true,
    linhasDeCabecalho: cabecalhos,
    linhas,
  };
}

/** Participação: por combinação de grupos e por pessoa (sim ou não). */
function abaDaParticipacao(
  rel: RelatorioDeResultados,
  convidados: readonly ParticipanteDaPesquisa[],
): AbaXlsx {
  const grupo = (p: ParticipanteDaPesquisa, i: number) =>
    CAMPOS_DA_LOTACAO[i]!.de(p) ?? "—";
  const linhas: CelulaXlsx[][] = [
    ...cabecalhoDaAba("Participação", rel, "só presença, nunca a nota"),
    [
      "Departamento",
      "Centro de custo",
      "Unidade",
      "Convidados",
      "Responderam",
      "Preenchimento",
    ],
  ];
  const cabecalhos = [linhas.length - 1];
  // Quem não tem nenhum grupo no cadastro fica no fim.
  for (const [, pessoas] of agrupar(convidados, (p) =>
    CAMPOS_DA_LOTACAO.some((c) => c.de(p))
      ? [0, 1, 2].map((i) => grupo(p, i)).join("\u0000")
      : null,
  )) {
    const sim = responderam(pessoas);
    linhas.push([
      grupo(pessoas[0]!, 0),
      grupo(pessoas[0]!, 1),
      grupo(pessoas[0]!, 2),
      pessoas.length,
      sim,
      porcento(preenchimento(sim, pessoas.length)),
    ]);
  }
  linhas.push(
    [],
    ["Nome", "Departamento", "Centro de custo", "Unidade", "Respondeu"],
  );
  cabecalhos.push(linhas.length - 1);
  for (const p of [...convidados].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  ))
    linhas.push([
      p.nome,
      grupo(p, 0),
      grupo(p, 1),
      grupo(p, 2),
      p.respondeu ? "Sim" : "Não",
    ]);
  return {
    nome: "Participação",
    larguras: [30, 26, 22, 12, 13, 15],
    titulo: true,
    linhasDeCabecalho: cabecalhos,
    linhas,
  };
}

/** Evolução: média geral e eNPS nas pesquisas do mesmo modelo. */
function abaDaEvolucao(
  rel: RelatorioDeResultados,
  detalhe: PesquisaDetalhe,
): AbaXlsx {
  const linhas: CelulaXlsx[][] = [
    ...cabecalhoDaAba(
      "Evolução",
      rel,
      "pesquisas do mesmo modelo, da mais antiga para a mais recente",
    ),
    ["Pesquisa", "Publicada em", "Média geral (1 a 10)", "eNPS"],
    ...rel.evolucao.map((e): CelulaXlsx[] => [
      e.nome,
      serialDoInstante(e.publicadaEm) ?? formatarInstante(e.publicadaEm),
      decimal(e.mediaGeral),
      typeof e.enps === "number" ? e.enps : "—",
    ]),
  ];
  if (rel.evolucao.length <= 1)
    linhas.push(
      [],
      [
        `Esta é a primeira pesquisa ${ROTULO_DO_MODELO[detalhe.modelo]} com respostas: a evolução aparece a partir da próxima.`,
      ],
    );
  return {
    nome: "Evolução",
    larguras: [40, 18, 20, 10],
    formatos: { 1: "data" },
    titulo: true,
    linhasDeCabecalho: [DEPOIS_DO_CABECALHO],
    linhas,
  };
}

/** O que cada número quer dizer (planilha e relatório em PDF). */
export const METODOLOGIA: readonly (readonly [string, string])[] = [
  [
    "Escala",
    "As perguntas de nota usam a escala do modelo (de 1 a 10, de 1 a 5 ou de 0 a 10). Para comparar, toda média é levada à escala de 1 a 10.",
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
