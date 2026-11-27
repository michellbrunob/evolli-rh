import {
  CATALOGO,
  COMPETENCIAS,
  type Competencia,
  ITENS,
  competenciaDoItem,
} from "./definicao";

/**
 * T216 — Avaliação 90°/180°: o cálculo (funções puras).
 *
 * - Competência = média das 3 notas válidas (1 a 5); nota geral = média das
 *   8 competências; eixo Entrega = Responsabilidade, Organização,
 *   Proatividade e Resolução de problemas; eixo Pessoas = Comunicação,
 *   Trabalho em equipe, Liderança e Adaptabilidade. Tudo com 1 casa.
 * - Níveis sobre o valor arredondado: Insuficiente 1,0–1,9 · Em
 *   desenvolvimento 2,0–2,9 · Bom 3,0–3,9 · Excelente 4,0–4,4 ·
 *   Excepcional 4,5–5,0.
 * - Mapa de talentos 3×3 (Entrega × Pessoas): alto ≥ 4, médio 3–3,9,
 *   baixo < 3.
 * - Calibração: média que o gestor deu − média da empresa; com menos de 5
 *   avaliados, "poucas"; |diferença| ≥ 0,4: generoso (acima) ou exigente
 *   (abaixo); senão, alinhado.
 * - 180°: diferença = autoavaliação − gestor; |diferença| < 0,5 alinhada.
 */

export type Nivel =
  "insuficiente" | "em_desenvolvimento" | "bom" | "excelente" | "excepcional";

export type FaixaDoEixo = "alto" | "medio" | "baixo";

export type Quadrante =
  | "referencia"
  | "forte_na_entrega"
  | "entrega_sozinho"
  | "forte_com_pessoas"
  | "solido"
  | "relacao_a_desenvolver"
  | "conecta_entrega_pouco"
  | "entrega_abaixo"
  | "precisa_de_apoio";

export type GrupoDaNota = "destaque" | "esperado" | "apoio";

export type Calibracao = "poucas" | "generoso" | "exigente" | "alinhado";

export type Alinhamento = "acima" | "alinhada" | "abaixo";

export type Leitura =
  | "forca_confirmada"
  | "forca_nao_vista"
  | "ponto_cego"
  | "a_desenvolver"
  | "alinhada";

export type RegraDeComentarios = "opcionais" | "extremos" | "obrigatorios";

export const LIMIAR_DO_ALINHAMENTO = 0.5;
/** "Bem acima" (mapa da conversa): diferença de 1 ponto ou mais. */
export const LIMIAR_DA_CONVERSA = 1;
export const MINIMO_PARA_CALIBRAR = 5;
export const LIMIAR_DA_CALIBRACAO = 0.4;
export const MINIMO_DO_RECORTE = 3;

/**
 * 1 casa, sem o erro do ponto flutuante e simétrico no zero (2,45 → 2,5;
 * −0,45 → −0,5).
 */
export function umaCasa(n: number): number {
  const r = Math.round((Math.abs(n) + Number.EPSILON) * 10) / 10;
  return n < 0 ? -r : r;
}

function media(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((t, v) => t + v, 0) / valores.length;
}

function notaValida(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
}

export function nivelDaNota(nota: number): Nivel {
  const n = umaCasa(nota);
  if (n < 2) return "insuficiente";
  if (n < 3) return "em_desenvolvimento";
  if (n < 4) return "bom";
  if (n < 4.5) return "excelente";
  return "excepcional";
}

export function faixaDoEixo(valor: number): FaixaDoEixo {
  const n = umaCasa(valor);
  if (n >= 4) return "alto";
  if (n >= 3) return "medio";
  return "baixo";
}

const QUADRANTES: Readonly<
  Record<FaixaDoEixo, Readonly<Record<FaixaDoEixo, Quadrante>>>
> = {
  // [entrega][pessoas]
  alto: {
    alto: "referencia",
    medio: "forte_na_entrega",
    baixo: "entrega_sozinho",
  },
  medio: {
    alto: "forte_com_pessoas",
    medio: "solido",
    baixo: "relacao_a_desenvolver",
  },
  baixo: {
    alto: "conecta_entrega_pouco",
    medio: "entrega_abaixo",
    baixo: "precisa_de_apoio",
  },
};

export function quadrante(entrega: number, pessoas: number): Quadrante {
  return QUADRANTES[faixaDoEixo(entrega)][faixaDoEixo(pessoas)];
}

export function grupoDaNota(nota: number): GrupoDaNota {
  const n = umaCasa(nota);
  if (n >= 4) return "destaque";
  if (n >= 3) return "esperado";
  return "apoio";
}

/** As notas válidas de uma avaliação, por afirmação. */
export type Notas = Readonly<Record<string, number>>;

export type MediasPorCompetencia = Record<Competencia, number | null>;

/** Média (sem arredondar) de cada competência: as notas válidas dela. */
export function mediasPorCompetencia(notas: Notas): MediasPorCompetencia {
  const grupos = new Map<Competencia, number[]>();
  for (const [itemId, valor] of Object.entries(notas)) {
    const c = competenciaDoItem(itemId);
    if (!c || !notaValida(valor)) continue;
    grupos.set(c, [...(grupos.get(c) ?? []), valor]);
  }
  const r = {} as MediasPorCompetencia;
  for (const c of COMPETENCIAS) r[c] = media(grupos.get(c) ?? []);
  return r;
}

const DO_EIXO: Readonly<Record<"entrega" | "pessoas", Competencia[]>> = {
  entrega: CATALOGO.filter((c) => c.eixo === "entrega").map((c) => c.id),
  pessoas: CATALOGO.filter((c) => c.eixo === "pessoas").map((c) => c.id),
};

function mediaDe(
  medias: MediasPorCompetencia,
  quais: readonly Competencia[],
): number | null {
  return media(
    quais.map((c) => medias[c]).filter((v): v is number => v !== null),
  );
}

export interface NotaDaAvaliacao {
  /** 1 casa. */
  competencias: Record<Competencia, number | null>;
  geral: number | null;
  entrega: number | null;
  pessoas: number | null;
  nivel: Nivel | null;
  quadrante: Quadrante | null;
  grupo: GrupoDaNota | null;
}

/** A nota de uma avaliação (uma pessoa, um avaliador). */
export function notaDaAvaliacao(notas: Notas): NotaDaAvaliacao {
  const medias = mediasPorCompetencia(notas);
  const geral = mediaDe(medias, COMPETENCIAS);
  const entrega = mediaDe(medias, DO_EIXO.entrega);
  const pessoas = mediaDe(medias, DO_EIXO.pessoas);
  const competencias = {} as Record<Competencia, number | null>;
  for (const c of COMPETENCIAS) {
    competencias[c] = medias[c] === null ? null : umaCasa(medias[c]!);
  }
  return {
    competencias,
    geral: geral === null ? null : umaCasa(geral),
    entrega: entrega === null ? null : umaCasa(entrega),
    pessoas: pessoas === null ? null : umaCasa(pessoas),
    nivel: geral === null ? null : nivelDaNota(geral),
    quadrante:
      entrega === null || pessoas === null ? null : quadrante(entrega, pessoas),
    grupo: geral === null ? null : grupoDaNota(geral),
  };
}

/** Comentário obrigatório? (pela regra e pela média da competência). */
export function exigeComentario(
  regra: RegraDeComentarios,
  mediaDaCompetencia: number | null,
): boolean {
  if (regra === "obrigatorios") return true;
  if (regra === "opcionais" || mediaDaCompetencia === null) return false;
  const m = umaCasa(mediaDaCompetencia);
  return m < 2.5 || m === 5;
}

export type Alerta =
  | { tipo: "linha_reta" }
  | { tipo: "extremas_sem_comentario"; competencias: Competencia[] };

/**
 * Alertas de qualidade: as 24 notas iguais (resposta em linha reta) e
 * competências com média < 2,5 ou = 5 sem comentário.
 */
export function alertasDaAvaliacao(
  notas: Notas,
  comentarios: Readonly<Partial<Record<Competencia, string>>>,
): Alerta[] {
  const alertas: Alerta[] = [];
  const valores = ITENS.map((i) => notas[i.id]).filter(notaValida);
  if (valores.length === ITENS.length && new Set(valores).size === 1) {
    alertas.push({ tipo: "linha_reta" });
  }
  const medias = mediasPorCompetencia(notas);
  const sem = COMPETENCIAS.filter(
    (c) =>
      exigeComentario("extremos", medias[c]) && !comentarios[c]?.trim().length,
  );
  if (sem.length) {
    alertas.push({ tipo: "extremas_sem_comentario", competencias: sem });
  }
  return alertas;
}

// ---------------------------------------------------------------------------
// O time (90° e o lado do gestor na 180°)

export interface AvaliacaoDoGestor {
  avaliadoId: string;
  avaliadorId: string;
  notas: Notas;
}

export interface CompetenciaNoTime {
  competencia: Competencia;
  /** Média das médias das pessoas (1 casa). */
  media: number | null;
  /** Quem ficou abaixo de 3. */
  abaixoDe3: string[];
  percentualAbaixoDe3: number;
  /** A afirmação de menor média no time. */
  menorAfirmacao: { itemId: string; media: number } | null;
}

export interface ResumoDoTime {
  avaliadas: number;
  media: number | null;
  nivel: Nivel | null;
  /** Do mais forte ao mais fraco. */
  competencias: CompetenciaNoTime[];
  grupos: Record<GrupoDaNota, string[]>;
  mapa: Record<Quadrante, string[]>;
}

export function resumoDoTime(
  avaliacoes: readonly AvaliacaoDoGestor[],
): ResumoDoTime {
  const notas = avaliacoes.map((a) => ({
    a,
    nota: notaDaAvaliacao(a.notas),
    medias: mediasPorCompetencia(a.notas),
  }));
  const competencias: CompetenciaNoTime[] = COMPETENCIAS.map((c) => {
    const comMedia = notas.filter((n) => n.medias[c] !== null);
    const m = media(comMedia.map((n) => n.medias[c]!));
    const abaixo = comMedia
      .filter((n) => umaCasa(n.medias[c]!) < 3)
      .map((n) => n.a.avaliadoId);
    let menor: CompetenciaNoTime["menorAfirmacao"] = null;
    for (const item of ITENS.filter((i) => i.competencia === c)) {
      const mi = media(
        avaliacoes.map((a) => a.notas[item.id]).filter(notaValida),
      );
      if (mi !== null && (menor === null || mi < menor.media)) {
        menor = { itemId: item.id, media: umaCasa(mi) };
      }
    }
    return {
      competencia: c,
      media: m === null ? null : umaCasa(m),
      abaixoDe3: abaixo,
      percentualAbaixoDe3: comMedia.length
        ? Math.round((abaixo.length / comMedia.length) * 100)
        : 0,
      menorAfirmacao: menor,
    };
  });
  // Do mais forte ao mais fraco; sem média por último; empate pela ordem.
  const ordenadas = [...competencias].sort(
    (x, y) => (y.media ?? -1) - (x.media ?? -1),
  );
  const grupos: Record<GrupoDaNota, string[]> = {
    destaque: [],
    esperado: [],
    apoio: [],
  };
  const mapa = Object.fromEntries(
    Object.values(QUADRANTES).flatMap((l) =>
      Object.values(l).map((q) => [q, [] as string[]]),
    ),
  ) as Record<Quadrante, string[]>;
  for (const n of notas) {
    if (n.nota.grupo) grupos[n.nota.grupo].push(n.a.avaliadoId);
    if (n.nota.quadrante) mapa[n.nota.quadrante].push(n.a.avaliadoId);
  }
  const geral = media(
    notas.map((n) => n.nota.geral).filter((v): v is number => v !== null),
  );
  return {
    avaliadas: avaliacoes.length,
    media: geral === null ? null : umaCasa(geral),
    nivel: geral === null ? null : nivelDaNota(geral),
    competencias: ordenadas,
    grupos,
    mapa,
  };
}

export interface CalibracaoDoGestor {
  avaliadorId: string;
  avaliadas: number;
  media: number | null;
  diferenca: number | null;
  leitura: Calibracao;
}

/** Cada gestor contra a média da empresa (as notas gerais que deu). */
export function calibracao(
  avaliacoes: readonly AvaliacaoDoGestor[],
): CalibracaoDoGestor[] {
  const gerais = avaliacoes
    .map((a) => ({ a, g: notaDaAvaliacao(a.notas).geral }))
    .filter((x): x is { a: AvaliacaoDoGestor; g: number } => x.g !== null);
  const empresa = media(gerais.map((x) => x.g));
  const porGestor = new Map<string, number[]>();
  for (const x of gerais) {
    porGestor.set(x.a.avaliadorId, [
      ...(porGestor.get(x.a.avaliadorId) ?? []),
      x.g,
    ]);
  }
  return [...porGestor].map(([avaliadorId, notas]) => {
    const m = media(notas)!;
    const diferenca = empresa === null ? null : umaCasa(m - empresa);
    let leitura: Calibracao = "alinhado";
    if (notas.length < MINIMO_PARA_CALIBRAR) leitura = "poucas";
    else if (diferenca !== null && diferenca >= LIMIAR_DA_CALIBRACAO) {
      leitura = "generoso";
    } else if (diferenca !== null && diferenca <= -LIMIAR_DA_CALIBRACAO) {
      leitura = "exigente";
    }
    return {
      avaliadorId,
      avaliadas: notas.length,
      media: umaCasa(m),
      diferenca,
      leitura,
    };
  });
}

export type FaixaDeTempoDeCasa =
  | "ate_6_meses"
  | "6_meses_a_1_ano"
  | "1_a_3_anos"
  | "3_a_5_anos"
  | "mais_de_5_anos";

export const FAIXAS_DE_TEMPO_DE_CASA: readonly FaixaDeTempoDeCasa[] = [
  "ate_6_meses",
  "6_meses_a_1_ano",
  "1_a_3_anos",
  "3_a_5_anos",
  "mais_de_5_anos",
];

/** Meses completos entre a admissão e hoje (`AAAA-MM-DD`). */
export function mesesDeCasa(admissao: string, hoje: string): number {
  const [ay, am, ad] = admissao.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [hy, hm, hd] = hoje.split("-").map(Number) as [number, number, number];
  return (hy - ay) * 12 + (hm - am) - (hd < ad ? 1 : 0);
}

export function faixaDeTempoDeCasa(
  admissao: string,
  hoje: string,
): FaixaDeTempoDeCasa {
  const m = mesesDeCasa(admissao, hoje);
  if (m < 6) return "ate_6_meses";
  if (m < 12) return "6_meses_a_1_ano";
  if (m < 36) return "1_a_3_anos";
  if (m < 60) return "3_a_5_anos";
  return "mais_de_5_anos";
}

export interface RecorteDaAvaliacao {
  grupo: string;
  avaliadas: number;
  /** `null` abaixo do mínimo (3). */
  media: number | null;
  visivel: boolean;
}

/** Média da nota geral por grupo; grupos com menos de 3 ficam ocultos. */
export function recorte(
  avaliacoes: readonly AvaliacaoDoGestor[],
  grupoDe: (avaliadoId: string) => string | null,
): RecorteDaAvaliacao[] {
  const porGrupo = new Map<string, number[]>();
  for (const a of avaliacoes) {
    const g = grupoDe(a.avaliadoId);
    const geral = notaDaAvaliacao(a.notas).geral;
    if (g === null || geral === null) continue;
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), geral]);
  }
  return [...porGrupo].map(([grupo, notas]) => {
    const visivel = notas.length >= MINIMO_DO_RECORTE;
    return {
      grupo,
      avaliadas: notas.length,
      media: visivel ? umaCasa(media(notas)!) : null,
      visivel,
    };
  });
}

// ---------------------------------------------------------------------------
// 180°: gestor × autoavaliação

export function alinhamento(diferenca: number): Alinhamento {
  const d = umaCasa(diferenca);
  if (d >= LIMIAR_DO_ALINHAMENTO) return "acima";
  if (d <= -LIMIAR_DO_ALINHAMENTO) return "abaixo";
  return "alinhada";
}

/**
 * A leitura de uma competência na conversa: forças confirmadas (as duas
 * visões ≥ 4), forças que a pessoa não vê (gestor ≥ 1 ponto acima), pontos
 * cegos (a pessoa ≥ 1 ponto acima do gestor), a desenvolver (as duas < 3).
 */
export function leituraDaCompetencia(gestor: number, auto: number): Leitura {
  const g = umaCasa(gestor);
  const a = umaCasa(auto);
  if (g >= 4 && a >= 4) return "forca_confirmada";
  if (umaCasa(g - a) >= LIMIAR_DA_CONVERSA) return "forca_nao_vista";
  if (umaCasa(a - g) >= LIMIAR_DA_CONVERSA) return "ponto_cego";
  if (g < 3 && a < 3) return "a_desenvolver";
  return "alinhada";
}

export interface ComparativoDaCompetencia {
  competencia: Competencia;
  gestor: number | null;
  autoavaliacao: number | null;
  /** autoavaliação − gestor (1 casa). */
  diferenca: number | null;
  leitura: Leitura | null;
}

export interface ComparativoDaPessoa {
  competencias: ComparativoDaCompetencia[];
  gestor: number | null;
  autoavaliacao: number | null;
  diferenca: number | null;
  alinhamento: Alinhamento | null;
}

export function comparativoDaPessoa(
  gestor: Notas,
  auto: Notas,
): ComparativoDaPessoa {
  const g = notaDaAvaliacao(gestor);
  const a = notaDaAvaliacao(auto);
  const competencias = COMPETENCIAS.map((c): ComparativoDaCompetencia => {
    const vg = g.competencias[c];
    const va = a.competencias[c];
    const ambos = vg !== null && va !== null;
    return {
      competencia: c,
      gestor: vg,
      autoavaliacao: va,
      diferenca: ambos ? umaCasa(va - vg) : null,
      leitura: ambos ? leituraDaCompetencia(vg, va) : null,
    };
  });
  const diferenca =
    g.geral !== null && a.geral !== null ? umaCasa(a.geral - g.geral) : null;
  return {
    competencias,
    gestor: g.geral,
    autoavaliacao: a.geral,
    diferenca,
    alinhamento: diferenca === null ? null : alinhamento(diferenca),
  };
}

export interface ComparativoDoTime {
  /** Pessoas com as duas avaliações. */
  completas: number;
  /** Ordenado pela diferença (maior primeiro). */
  competencias: {
    competencia: Competencia;
    gestor: number | null;
    autoavaliacao: number | null;
    diferenca: number | null;
  }[];
  acima: number;
  alinhadas: number;
  abaixo: number;
}

export function comparativoDoTime(
  pares: readonly { gestor: Notas; auto: Notas }[],
): ComparativoDoTime {
  const pessoas = pares.map((p) => comparativoDaPessoa(p.gestor, p.auto));
  const competencias = COMPETENCIAS.map((c) => {
    const g = media(
      pessoas
        .map((p) => p.competencias.find((x) => x.competencia === c)!.gestor)
        .filter((v): v is number => v !== null),
    );
    const a = media(
      pessoas
        .map(
          (p) => p.competencias.find((x) => x.competencia === c)!.autoavaliacao,
        )
        .filter((v): v is number => v !== null),
    );
    return {
      competencia: c,
      gestor: g === null ? null : umaCasa(g),
      autoavaliacao: a === null ? null : umaCasa(a),
      diferenca: g === null || a === null ? null : umaCasa(a - g),
    };
  }).sort((x, y) => (y.diferenca ?? -9) - (x.diferenca ?? -9));
  return {
    completas: pessoas.length,
    competencias,
    acima: pessoas.filter((p) => p.alinhamento === "acima").length,
    alinhadas: pessoas.filter((p) => p.alinhamento === "alinhada").length,
    abaixo: pessoas.filter((p) => p.alinhamento === "abaixo").length,
  };
}

export type PassoDoRoteiro =
  | "forcas_confirmadas"
  | "forcas_nao_vistas"
  | "pontos_cegos"
  | "a_desenvolver"
  | "plano";

/**
 * A ordem da conversa de feedback: começar pelo que as duas visões
 * confirmam, mostrar as forças que a pessoa não vê, tratar os pontos cegos,
 * o que desenvolver juntos e fechar com o plano. Passo sem competência sai.
 */
export function roteiroDeFeedback(
  comparativo: ComparativoDaPessoa,
): { passo: PassoDoRoteiro; competencias: Competencia[] }[] {
  const de = (l: Leitura) =>
    comparativo.competencias
      .filter((c) => c.leitura === l)
      .map((c) => c.competencia);
  const passos: { passo: PassoDoRoteiro; competencias: Competencia[] }[] = [
    { passo: "forcas_confirmadas", competencias: de("forca_confirmada") },
    { passo: "forcas_nao_vistas", competencias: de("forca_nao_vista") },
    { passo: "pontos_cegos", competencias: de("ponto_cego") },
    { passo: "a_desenvolver", competencias: de("a_desenvolver") },
  ];
  return [
    ...passos.filter((p) => p.competencias.length > 0),
    { passo: "plano", competencias: [] },
  ];
}

/** O que desenvolver (90°): as competências da pessoa abaixo de 3, da menor. */
export function pontosADesenvolver(nota: NotaDaAvaliacao): Competencia[] {
  return COMPETENCIAS.filter(
    (c) => nota.competencias[c] !== null && nota.competencias[c]! < 3,
  ).sort((x, y) => nota.competencias[x]! - nota.competencias[y]!);
}
