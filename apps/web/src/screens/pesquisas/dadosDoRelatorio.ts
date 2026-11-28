/**
 * T216 — os dados do relatório de resultados, montados uma vez e usados
 * pelo PDF (página imprimível) e pela planilha (.xlsx).
 *
 * Privacidade (LGPD): o relatório segue a identificação da pesquisa.
 * Comentários só levam autor na identificada (e saem em ordem alfabética nas
 * outras, para não denunciar a ordem de chegada); departamentos abaixo do
 * mínimo por grupo ficam ocultos; respostas individuais nunca entram na
 * confidencial. Nada leva CPF.
 */
import type {
  AnalisesPesquisa,
  CampoGrupo,
  Identificacao,
  IndicadoresDosResultados,
  Pergunta,
  PesquisaDetalhe,
  ResultadoPergunta,
  ResultadosPesquisa,
  RespostaResumo,
  ZonaEnps,
} from "../../api/pesquisasClient";
import {
  diaCivilDeHoje,
  formatarCompetenciaPorExtenso,
  formatarInstante,
  formatarIntervaloDeDias,
  mesDoDia,
} from "../../format/data";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import {
  ROTULO_DA_FAIXA_DA_MEDIA,
  ROTULO_DA_ZONA,
  ehDeEscala,
  escalaDe,
  faixaDaMedia10,
  faixasDe,
  indicadoresDe,
  mediaNa10,
  textoDoFavoravel,
  type EscalaDaPergunta,
  type Faixa,
} from "./indicadores";
import { modeloDaGaleria } from "./modelosDePesquisa";
import { ROTULO_DO_MODELO } from "./textosDasPesquisas";

/** Nome curto de cada faixa da média (Atenção, Crítica, Saudável). */
export const NOME_DA_FAIXA: Readonly<Record<Faixa, string>> = {
  baixa: "Crítica",
  media: "Atenção",
  alta: "Saudável",
};

/** "Atenção · 6,5 a 7,9". */
export const textoDaFaixa = (f: Faixa) =>
  `${NOME_DA_FAIXA[f]} · ${ROTULO_DA_FAIXA_DA_MEDIA[f]}`;

export const INTERVALO_DA_ZONA: Readonly<Record<ZonaEnps, string>> = {
  critica: "de −100 a −1",
  aperfeicoamento: "de 0 a 49",
  qualidade: "de 50 a 74",
  excelencia: "de 75 a 100",
};

const CLASSIFICACAO: Readonly<Record<Identificacao, string>> = {
  identificada: "Confidencial · RH · respostas identificadas",
  confidencial: "Confidencial · RH · respostas confidenciais",
  anonima: "Confidencial · RH · respostas anônimas",
};

/** "respostas identificadas" etc., para o rodapé das páginas. */
export const RESPOSTAS_DA_IDENTIFICACAO: Readonly<
  Record<Identificacao, string>
> = {
  identificada: "respostas identificadas",
  confidencial: "respostas confidenciais",
  anonima: "respostas anônimas",
};

export interface PerguntaDoRelatorio {
  readonly numero: number;
  readonly id: string;
  readonly texto: string;
  /** Rótulo curto (o do modelo ou o começo do texto). */
  readonly rotulo: string;
  readonly escala: EscalaDaPergunta;
  readonly respostas: number;
  /** Média na escala da pergunta. */
  readonly media: number | null;
  /** Média levada a 0–10 (faixa e ordenação). */
  readonly media10: number | null;
  readonly faixa: Faixa | null;
  /** Percentuais (0–100) de favorável, neutro e desfavorável. */
  readonly favoravel: number | null;
  readonly neutro: number | null;
  readonly desfavoravel: number | null;
  /** Quantas respostas em cada nota, do mínimo ao máximo. */
  readonly porNota: readonly { nota: number; quantidade: number }[];
}

/** Um grupo do recorte (a 1ª linha é "Toda a empresa", `grupoId` nulo). */
export interface GrupoDoRelatorio {
  readonly grupoId: string | null;
  readonly nome: string;
  readonly respostas: number;
  readonly visivel: boolean;
  readonly oculto: "minimo" | "protege_grupo_menor" | null;
  readonly mediaGeral: number | null;
  /** Percentual (0–100) de notas favoráveis nas perguntas de escala. */
  readonly favoravel: number | null;
  readonly enps: {
    readonly indice: number;
    readonly promotores: number;
    readonly neutros: number;
    readonly detratores: number;
    readonly total: number;
  } | null;
  /** Média (0–10) de cada coluna do recorte (o tema de cada pergunta). */
  readonly medias: readonly (number | null)[];
}

export interface AlertaDoRelatorio {
  readonly severidade: "Alta" | "Média";
  readonly onde: "Pergunta" | "Departamento";
  readonly oQue: string;
  readonly departamento: string;
  readonly media: number | null;
  readonly favoravel: number | null;
  readonly respostas: number;
  readonly motivo: string;
}

export interface RelatorioDeResultados {
  readonly nome: string;
  readonly modelo: string;
  readonly identificacao: Identificacao;
  readonly empresa: string;
  readonly mesDeReferencia: string;
  readonly periodo: string;
  /** O período com as horas da primeira e da última resposta. */
  readonly periodoComHoras: string;
  readonly emitidoEm: string;
  /** Quem emitiu (o nome de exibição da conta), quando conhecido. */
  readonly emitidoPor: string | null;
  readonly classificacao: string;
  readonly convidados: number | null;
  readonly respostas: number;
  readonly participacao: number | null;
  readonly mediaGeral: number | null;
  readonly faixaGeral: Faixa | null;
  readonly favoravelGeral: number | null;
  readonly enps: {
    readonly indice: number;
    readonly zona: ZonaEnps;
    readonly rotuloDaZona: string;
    readonly promotores: number;
    readonly neutros: number;
    readonly detratores: number;
    readonly total: number;
    readonly porNota: readonly { nota: number; quantidade: number }[];
  } | null;
  /** Perguntas de escala (sem o eNPS), da maior para a menor média. */
  readonly perguntas: readonly PerguntaDoRelatorio[];
  readonly maior: PerguntaDoRelatorio | null;
  readonly menor: PerguntaDoRelatorio | null;
  readonly comentarios: readonly {
    readonly pergunta: string;
    readonly textos: readonly { texto: string; autor: string | null }[];
  }[];
  /** Mapa por departamento (só com recorte); `null` sem recorte. */
  readonly departamentos: AnalisesPesquisa | null;
  /**
   * O recorte com médias, favorável e eNPS de cada grupo (a planilha "Por
   * departamento"); `null` sem recorte. Grupo oculto vem sem números.
   */
  readonly grupos: {
    readonly campo: CampoGrupo;
    readonly colunas: readonly string[];
    readonly linhas: readonly GrupoDoRelatorio[];
  } | null;
  readonly evolucao: AnalisesPesquisa["evolucao"];
  readonly alertas: readonly AlertaDoRelatorio[];
  readonly minimoPorGrupo: number;
  /**
   * Abaixo do mínimo por grupo (ex.: confidencial com poucas respostas): os
   * números não aparecem em nenhuma exportação.
   */
  readonly numerosOcultos: boolean;
}

const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : null;

function rotuloCurto(p: Pergunta): string {
  if (p.rotulo) return p.rotulo;
  return p.texto.length > 40 ? `${p.texto.slice(0, 39).trimEnd()}…` : p.texto;
}

function distribuicaoDe(r: ResultadoPergunta | undefined) {
  return r && "distribuicao" in r && r.distribuicao ? r.distribuicao : [];
}

function porNotaDe(
  r: ResultadoPergunta | undefined,
  e: EscalaDaPergunta,
): { nota: number; quantidade: number }[] {
  const d = distribuicaoDe(r);
  return Array.from({ length: e.maximo - e.minimo + 1 }, (_, i) => {
    const nota = e.minimo + i;
    return {
      nota,
      quantidade: d.find((x) => x.valor === nota)?.quantidade ?? 0,
    };
  });
}

/** "%" favorável somando as faixas das perguntas de escala (sem o eNPS). */
function favoravelDasPerguntas(
  todas: readonly Pergunta[],
  resultados: ResultadosPesquisa,
): number | null {
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  let altas = 0;
  let total = 0;
  for (const p of todas) {
    if (!ehDeEscala(p) || (p.tipo === "nota_0_10" && p.config.enps)) continue;
    const r = porId.get(p.id);
    const f =
      r && "faixas" in r && r.faixas
        ? r.faixas
        : faixasDe(distribuicaoDe(r), escalaDe(p));
    altas += f.alta;
    total += f.baixa + f.media + f.alta;
  }
  return pct(altas, total);
}

const enpsDoGrupo = (
  e: IndicadoresDosResultados["enps"],
): GrupoDoRelatorio["enps"] =>
  e
    ? {
        indice: e.indice,
        promotores: e.promotores,
        neutros: e.neutros,
        detratores: e.detratores,
        total: e.promotores + e.neutros + e.detratores,
      }
    : null;

/** Diferença em décimos, sem o erro do ponto flutuante (7,8 − 6,8 = 1). */
const decimos = (a: number, b: number) => Math.round((a - b) * 10);

/** "28/11/2026 00:27". */
const instanteCurto = (iso: string) =>
  formatarInstante(iso).replace(" às ", " ");

/** O dia civil (Brasília) de um instante. */
const diaDo = (iso: string) => diaCivilDeHoje(new Date(iso));

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function montarRelatorio(x: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly empresa: string;
  readonly hoje: string;
  /** Lista de respostas (o período); ausente na confidencial. */
  readonly respostas?: readonly RespostaResumo[] | null;
  readonly analises?: AnalisesPesquisa | null;
  /** A evolução sem recorte (quando não há `analises`). */
  readonly evolucao?: AnalisesPesquisa["evolucao"] | null;
  /** Quem emite (nome de exibição da conta). */
  readonly emitidoPor?: string | null;
  /** Os resultados de cada grupo visível do recorte, pelo id do grupo. */
  readonly porGrupo?: ReadonlyMap<string, ResultadosPesquisa> | null;
}): RelatorioDeResultados {
  const { detalhe: d, geral } = x;
  const porId = new Map(geral.perguntas.map((r) => [r.perguntaId, r]));
  const todas = perguntasEmOrdem(d.secoes);
  const ind = indicadoresDe(d, geral);

  const perguntas: PerguntaDoRelatorio[] = [];
  let altas = 0;
  let totalDasFaixas = 0;
  todas.forEach((p, i) => {
    if (!ehDeEscala(p) || (p.tipo === "nota_0_10" && p.config.enps)) return;
    const r = porId.get(p.id);
    const e = escalaDe(p);
    const media =
      r && "media" in r && typeof r.media === "number" ? r.media : null;
    const media10 = media === null ? null : mediaNa10(media, e);
    const f =
      r && "faixas" in r && r.faixas
        ? r.faixas
        : faixasDe(distribuicaoDe(r), e);
    const total = f.baixa + f.media + f.alta;
    altas += f.alta;
    totalDasFaixas += total;
    perguntas.push({
      numero: i + 1,
      id: p.id,
      texto: p.texto,
      rotulo: rotuloCurto(p),
      escala: e,
      respostas: r?.respondidas ?? 0,
      media,
      media10,
      faixa: media10 === null ? null : faixaDaMedia10(media10),
      favoravel: pct(f.alta, total),
      neutro: pct(f.media, total),
      desfavoravel: pct(f.baixa, total),
      porNota: porNotaDe(r, e),
    });
  });
  perguntas.sort((a, b) => (b.media10 ?? -1) - (a.media10 ?? -1));
  const comMedia = perguntas.filter((p) => p.media10 !== null);

  // eNPS: a primeira pergunta de recomendação com índice.
  const perguntaEnps = todas.find(
    (p) => p.tipo === "nota_0_10" && p.config.enps,
  );
  const rEnps = perguntaEnps ? porId.get(perguntaEnps.id) : undefined;
  const enps =
    ind.enps && rEnps
      ? {
          indice: ind.enps.indice,
          zona: ind.enps.zona,
          rotuloDaZona: ROTULO_DA_ZONA[ind.enps.zona],
          promotores: ind.enps.promotores,
          neutros: ind.enps.neutros,
          detratores: ind.enps.detratores,
          total: ind.enps.promotores + ind.enps.neutros + ind.enps.detratores,
          porNota: porNotaDe(rEnps, { minimo: 0, maximo: 10 }),
        }
      : null;

  const identificada = d.identificacao === "identificada";
  const comentarios = todas
    .map((p) => {
      const r = porId.get(p.id);
      if (!r || !("textos" in r) || r.textos.length === 0) return null;
      const textos = r.textos.map((t) => ({
        texto: t.texto,
        autor: identificada ? t.autor : null,
      }));
      if (!identificada)
        textos.sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR"));
      return { pergunta: p.texto, textos };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Período: da primeira à última resposta (ou desde a publicação).
  const dias = (x.respostas ?? []).map((r) => diaDo(r.respondidaEm)).sort();
  const inicio =
    dias[0] ?? (d.publicadaEm ? diaDo(d.publicadaEm) : diaDo(d.criadaEm));
  const fim = dias.at(-1) ?? x.hoje;
  const instantes = (x.respostas ?? []).map((r) => r.respondidaEm).sort();
  const periodoComHoras =
    instantes.length > 0
      ? `${instanteCurto(instantes[0]!)} a ${instanteCurto(instantes.at(-1)!)}`
      : formatarIntervaloDeDias(inicio, fim);
  const convidados = d.identificacao === "anonima" ? null : d.participantes;

  const analises = x.analises ?? null;
  const temRecorte =
    analises !== null && analises.linhas.some((l) => l.grupoId !== null);

  // O recorte: a empresa toda e cada grupo (os ocultos, sem números).
  const grupos: RelatorioDeResultados["grupos"] =
    analises && temRecorte
      ? {
          campo: analises.campo,
          colunas: analises.colunas.map((c) => c.rotulo),
          linhas: analises.linhas.map((l): GrupoDoRelatorio => {
            const oculto = l.visivel ? null : (l.oculto ?? "minimo");
            const base = {
              grupoId: l.grupoId,
              nome: l.grupoId === null ? "Toda a empresa" : l.nome,
              respostas: l.respostas,
              visivel: l.visivel,
              oculto,
            };
            if (!l.visivel)
              return {
                ...base,
                mediaGeral: null,
                favoravel: null,
                enps: null,
                medias: analises.colunas.map(() => null),
              };
            const doGrupo =
              l.grupoId === null ? geral : x.porGrupo?.get(l.grupoId);
            const visivel = doGrupo?.filtro.visivel !== false;
            return {
              ...base,
              mediaGeral: l.media,
              favoravel:
                doGrupo && visivel
                  ? favoravelDasPerguntas(todas, doGrupo)
                  : null,
              enps:
                doGrupo && visivel
                  ? enpsDoGrupo(indicadoresDe(d, doGrupo).enps)
                  : null,
              medias: l.medias,
            };
          }),
        }
      : null;

  // Alertas: só as regras críticas, uma linha por pergunta ou grupo.
  const alertas: AlertaDoRelatorio[] = [];
  for (const p of [...perguntas].sort((a, b) => a.numero - b.numero)) {
    if (p.media10 === null) continue;
    const motivo =
      p.faixa === "baixa"
        ? "Média abaixo de 6,5."
        : p.favoravel !== null && p.favoravel < 50
          ? "Menos da metade das respostas é favorável."
          : null;
    if (motivo)
      alertas.push({
        severidade: "Alta",
        onde: "Pergunta",
        oQue: p.texto,
        // A empresa toda: sem departamento.
        departamento: "",
        media: p.media10,
        favoravel: p.favoravel,
        respostas: p.respostas,
        motivo,
      });
  }
  if (grupos) {
    const daEmpresa =
      grupos.linhas.find((l) => l.grupoId === null)?.mediaGeral ??
      ind.mediaGeral;
    for (const l of grupos.linhas) {
      if (l.grupoId === null || !l.visivel || l.mediaGeral === null) continue;
      const motivo =
        faixaDaMedia10(l.mediaGeral) === "baixa"
          ? "Média do grupo abaixo de 6,5."
          : daEmpresa !== null && decimos(daEmpresa, l.mediaGeral) >= 10
            ? "Média do grupo 1 ponto ou mais abaixo da empresa."
            : null;
      if (motivo)
        alertas.push({
          severidade: "Alta",
          onde: "Departamento",
          oQue: l.nome,
          departamento: l.nome,
          media: l.mediaGeral,
          favoravel: l.favoravel,
          respostas: l.respostas,
          motivo,
        });
    }
  }

  return {
    nome: d.nome,
    modelo: modeloDaGaleria(d.modelo).nome || ROTULO_DO_MODELO[d.modelo],
    identificacao: d.identificacao,
    empresa: x.empresa,
    mesDeReferencia: maiuscula(formatarCompetenciaPorExtenso(mesDoDia(fim))),
    periodo: formatarIntervaloDeDias(inicio, fim),
    periodoComHoras,
    emitidoEm: x.hoje,
    emitidoPor: x.emitidoPor?.trim() || null,
    classificacao: CLASSIFICACAO[d.identificacao],
    convidados,
    respostas: Math.max(geral.respostas, d.respostas),
    participacao:
      convidados && convidados > 0
        ? pct(Math.max(geral.respostas, d.respostas), convidados)
        : null,
    mediaGeral: ind.mediaGeral,
    faixaGeral: ind.mediaGeral === null ? null : faixaDaMedia10(ind.mediaGeral),
    favoravelGeral: pct(altas, totalDasFaixas),
    enps,
    perguntas,
    maior: comMedia[0] ?? null,
    menor: comMedia.length > 1 ? comMedia.at(-1)! : null,
    comentarios,
    departamentos: temRecorte ? analises : null,
    grupos,
    // Só aplicações com respostas (como a aba Análises).
    evolucao: (analises?.evolucao ?? x.evolucao ?? []).filter(
      (e) => e.mediaGeral !== null,
    ),
    alertas,
    minimoPorGrupo: d.minimoPorGrupo,
    numerosOcultos: !geral.filtro.visivel,
  };
}

/** O texto do que é favorável numa escala ("notas 8 a 10"). */
export const notasFavoraveis = (e: EscalaDaPergunta) =>
  `notas ${textoDoFavoravel(e)}`;
