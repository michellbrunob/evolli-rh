import { perguntasEmOrdem } from "./estrutura-pesquisa";
import type {
  CampoGrupo,
  DepartamentoDoResultado,
  Faixas,
  GruposDaResposta,
  IndicadoresPesquisa,
  MotivoOculto,
  Pergunta,
  ResultadoPergunta,
  ResultadosPesquisa,
  Secao,
  ValorRespondido,
  ZonaEnps,
} from "./pesquisas.types";
import { perguntasVistas } from "./validacao-respostas";

/**
 * T216 — resultados agregados da pesquisa. Função pura: recebe a estrutura e
 * as respostas gravadas e devolve, por pergunta, média e distribuição
 * (escalas), eNPS, contagem das escolhas, sim/não, textos e datas, com
 * quantas pessoas viram a pergunta (condicionais), o "% favorável" e as
 * faixas das escalas, a zona do eNPS e os indicadores (média geral na escala
 * 0–10, maior e menor média). O recorte por grupo (departamento, centro de
 * custo ou unidade) respeita o mínimo de respostas por grupo.
 */

export interface RespostaParaCalculo {
  valores: readonly ValorRespondido[];
  /** Nome de quem respondeu — só na identificada. */
  autor: string | null;
  /** O grupo de cada campo (lotação, gravado no envio ou escolhido). */
  grupos: GruposDaResposta;
}

/** Duas casas, sem `-0`. */
export function arredondar(n: number): number {
  return Math.round(n * 100) / 100 || 0;
}

/** Os valores possíveis de uma escala (para a distribuição com zeros). */
export function faixaDaEscala(p: Pergunta): [number, number] | null {
  switch (p.tipo) {
    case "concordancia":
    case "estrelas":
      return [1, 5];
    case "nota_0_10":
      return [0, 10];
    case "escala":
      return [p.config.minimo ?? 1, p.config.maximo ?? 5];
    default:
      return null;
  }
}

const NUMERICOS = new Set([
  "concordancia",
  "estrelas",
  "nota_0_10",
  "escala",
  "numero",
]);

/** Tem faixas e "% favorável": concordância, estrelas, escala e nota. */
export function temFaixas(p: Pergunta): boolean {
  return faixaDaEscala(p) !== null;
}

/**
 * Entra na média geral: as perguntas de escala (concordância, estrelas,
 * escala e a nota 0–10 que não é eNPS). O eNPS tem indicador próprio.
 */
export function ehDeEscala(p: Pergunta): boolean {
  return temFaixas(p) && !(p.tipo === "nota_0_10" && p.config.enps === true);
}

/** O valor na escala 0–10 (proporcional ao máximo da escala). */
export function paraDez(p: Pergunta, valor: number): number {
  const maximo = faixaDaEscala(p)?.[1] ?? 10;
  return (valor * 10) / maximo;
}

/**
 * A faixa do valor. Escalas de 5 pontos: os dois de baixo, o do meio e os
 * dois de cima (concordância e estrelas: 4 e 5 favoráveis); as demais, em
 * terços (1–10 e 0–10: 8 a 10 favoráveis).
 */
export function faixaDoValor(p: Pergunta, valor: number): keyof Faixas {
  const [minimo, maximo] = faixaDaEscala(p) ?? [0, 10];
  const pontos = maximo - minimo + 1;
  const posicao = valor - minimo;
  if (pontos === 5) {
    return posicao <= 1 ? "baixa" : posicao === 2 ? "media" : "alta";
  }
  if (posicao < pontos / 3) return "baixa";
  if (posicao < (2 * pontos) / 3) return "media";
  return "alta";
}

/** Crítica < 0, aperfeiçoamento 0–49, qualidade 50–74, excelência 75–100. */
export function zonaDoEnps(indice: number): ZonaEnps {
  if (indice < 0) return "critica";
  if (indice < 50) return "aperfeicoamento";
  if (indice < 75) return "qualidade";
  return "excelencia";
}

/** eNPS: promotores 9–10, neutros 7–8, detratores 0–6. */
export function calcularEnps(notas: readonly number[]): {
  promotores: number;
  neutros: number;
  detratores: number;
  indice: number | null;
} {
  let promotores = 0;
  let neutros = 0;
  let detratores = 0;
  for (const n of notas) {
    if (n >= 9) promotores += 1;
    else if (n >= 7) neutros += 1;
    else detratores += 1;
  }
  const total = notas.length;
  const indice =
    total === 0
      ? null
      : Math.round(((promotores - detratores) / total) * 100) || 0;
  return { promotores, neutros, detratores, indice };
}

function resultadoDaPergunta(
  p: Pergunta,
  respostas: readonly {
    valores: ReadonlyMap<string, unknown>;
    vistas: ReadonlySet<string>;
    autor: string | null;
  }[],
): ResultadoPergunta {
  const viram = respostas.filter((r) => r.vistas.has(p.id)).length;
  const valores = respostas
    .filter((r) => r.valores.has(p.id))
    .map((r) => ({ valor: r.valores.get(p.id), autor: r.autor }));
  const base = { perguntaId: p.id, tipo: p.tipo, respondidas: valores.length };

  if (NUMERICOS.has(p.tipo)) {
    const numeros = valores
      .map((v) => v.valor)
      .filter((v): v is number => typeof v === "number");
    const media = numeros.length
      ? arredondar(numeros.reduce((a, b) => a + b, 0) / numeros.length)
      : null;
    const contagem = new Map<number, number>();
    for (const n of numeros) contagem.set(n, (contagem.get(n) ?? 0) + 1);
    const faixa = faixaDaEscala(p);
    const distribuicao = faixa
      ? Array.from({ length: faixa[1] - faixa[0] + 1 }, (_, i) => ({
          valor: faixa[0] + i,
          quantidade: contagem.get(faixa[0] + i) ?? 0,
        }))
      : [...contagem]
          .sort(([a], [b]) => a - b)
          .map(([valor, quantidade]) => ({ valor, quantidade }));
    let comFaixas: { favoravel: number | null; faixas: Faixas } | null = null;
    if (temFaixas(p)) {
      const faixas: Faixas = { baixa: 0, media: 0, alta: 0 };
      for (const v of numeros) faixas[faixaDoValor(p, v)] += 1;
      comFaixas = {
        favoravel: numeros.length
          ? Math.round((faixas.alta / numeros.length) * 100)
          : null,
        faixas,
      };
    }
    let enps = null;
    if (p.tipo === "nota_0_10" && p.config.enps === true) {
      const e = calcularEnps(numeros);
      enps = { ...e, zona: e.indice === null ? null : zonaDoEnps(e.indice) };
    }
    return {
      ...base,
      viram,
      media,
      distribuicao,
      ...(comFaixas ?? {}),
      ...(enps ? { enps } : {}),
    };
  }

  switch (p.tipo) {
    case "escolha_unica":
    case "multipla_escolha": {
      const contagem = new Map<string, number>();
      const outros: string[] = [];
      for (const { valor } of valores) {
        const v = valor as {
          opcao?: string;
          opcoes?: string[];
          outro?: string;
        };
        const marcadas = v.opcoes ?? (v.opcao ? [v.opcao] : []);
        for (const id of marcadas) {
          contagem.set(id, (contagem.get(id) ?? 0) + 1);
        }
        if (typeof v.outro === "string") outros.push(v.outro);
      }
      return {
        ...base,
        viram,
        opcoes: (p.config.opcoes ?? []).map((o) => ({
          opcaoId: o.id,
          quantidade: contagem.get(o.id) ?? 0,
        })),
        outros,
      };
    }
    case "sim_nao":
      return {
        ...base,
        viram,
        sim: valores.filter((v) => v.valor === "sim").length,
        nao: valores.filter((v) => v.valor === "nao").length,
      };
    case "data": {
      const contagem = new Map<string, number>();
      for (const { valor } of valores) {
        contagem.set(valor as string, (contagem.get(valor as string) ?? 0) + 1);
      }
      return {
        ...base,
        viram,
        datas: [...contagem]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([valor, quantidade]) => ({ valor, quantidade })),
      };
    }
    default:
      return {
        ...base,
        viram,
        textos: valores.map((v) => ({
          texto: v.valor as string,
          autor: v.autor,
        })),
      };
  }
}

/** Resultado de cada pergunta, na ordem da pesquisa. */
export function resultadoDasPerguntas(
  secoes: readonly Secao[],
  respostas: readonly Pick<RespostaParaCalculo, "valores" | "autor">[],
): ResultadoPergunta[] {
  const preparadas = respostas.map((r) => {
    const valores = new Map(r.valores.map((v) => [v.perguntaId, v.valor]));
    return {
      valores,
      vistas: perguntasVistas(secoes, valores),
      autor: r.autor,
    };
  });
  return perguntasEmOrdem(secoes).map((p) =>
    resultadoDaPergunta(p, preparadas),
  );
}

interface EnpsDoResultado {
  indice: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
}

/** Os indicadores do topo, sobre o resultado de cada pergunta. */
export function calcularIndicadores(
  secoes: readonly Secao[],
  perguntas: readonly ResultadoPergunta[],
): IndicadoresPesquisa {
  const porId = new Map(perguntas.map((r) => [r.perguntaId, r]));
  const deEscala = perguntasEmOrdem(secoes).filter(ehDeEscala);
  const medias: { perguntaId: string; media: number }[] = [];
  for (const p of deEscala) {
    const r = porId.get(p.id) as { media?: number | null } | undefined;
    if (r?.media !== undefined && r.media !== null) {
      medias.push({ perguntaId: p.id, media: arredondar(paraDez(p, r.media)) });
    }
  }
  const mediaGeral = medias.length
    ? arredondar(medias.reduce((a, m) => a + m.media, 0) / medias.length)
    : null;
  // Em caso de empate, a primeira na ordem da pesquisa.
  let maiorMedia: (typeof medias)[number] | null = null;
  let menorMedia: (typeof medias)[number] | null = null;
  for (const m of medias) {
    if (maiorMedia === null || m.media > maiorMedia.media) maiorMedia = m;
    if (menorMedia === null || m.media < menorMedia.media) menorMedia = m;
  }
  let enps: IndicadoresPesquisa["enps"] = null;
  for (const p of perguntasEmOrdem(secoes)) {
    if (p.tipo !== "nota_0_10" || p.config.enps !== true) continue;
    const r = porId.get(p.id) as { enps?: EnpsDoResultado } | undefined;
    if (r?.enps && r.enps.indice !== null) {
      enps = {
        indice: r.enps.indice,
        zona: zonaDoEnps(r.enps.indice),
        promotores: r.enps.promotores,
        neutros: r.enps.neutros,
        detratores: r.enps.detratores,
      };
      break;
    }
  }
  return {
    mediaGeral,
    perguntasDeEscala: deEscala.length,
    maiorMedia,
    menorMedia,
    enps,
  };
}

/** Média de uma resposta nas perguntas de escala (0–10). */
export function mediaDaResposta(
  secoes: readonly Secao[],
  valores: ReadonlyMap<string, unknown>,
): number | null {
  const notas: number[] = [];
  for (const p of perguntasEmOrdem(secoes).filter(ehDeEscala)) {
    const v = valores.get(p.id);
    if (typeof v === "number") notas.push(paraDez(p, v));
  }
  return notas.length
    ? arredondar(notas.reduce((a, b) => a + b, 0) / notas.length)
    : null;
}

/**
 * Supressão por grupo. Primária: grupo com menos respostas que o mínimo.
 * Secundária: o conjunto do que não aparece (grupos ocultos e as respostas
 * sem grupo) precisa ter ao menos duas partes — senão o total menos os
 * grupos visíveis daria exatamente o grupo oculto. Enquanto houver uma
 * parte só, o MENOR grupo visível também é escondido.
 */
export function suprimirGrupos(
  grupos: readonly { id: string; nome: string; respostas: number }[],
  semGrupo: number,
  minimoPorGrupo: number,
): Map<string, MotivoOculto | null> {
  const motivo = new Map<string, MotivoOculto | null>(
    grupos.map((g) => [
      g.id,
      g.respostas < minimoPorGrupo ? ("minimo" as const) : null,
    ]),
  );
  const ocultos = grupos.filter((g) => motivo.get(g.id) !== null);
  if (ocultos.length === 0) return motivo;
  const visiveis = grupos
    .filter((g) => motivo.get(g.id) === null)
    .sort(
      (a, b) =>
        a.respostas - b.respostas || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  let partes = ocultos.length + (semGrupo > 0 ? 1 : 0);
  while (partes < 2 && visiveis.length) {
    motivo.set(visiveis.shift()!.id, "protege_grupo_menor");
    partes += 1;
  }
  return motivo;
}

/** Os grupos de um campo com respostas, com a visibilidade de cada um. */
export function gruposDoCampo(
  campo: CampoGrupo,
  respostas: readonly { grupos: GruposDaResposta }[],
  nomes: ReadonlyMap<string, string>,
  minimoPorGrupo: number,
): DepartamentoDoResultado[] {
  const contagem = new Map<string, number>();
  let semGrupo = 0;
  for (const r of respostas) {
    const id = r.grupos[campo];
    if (id) contagem.set(id, (contagem.get(id) ?? 0) + 1);
    else semGrupo += 1;
  }
  const grupos = [...contagem].map(([id, quantidade]) => ({
    id,
    nome: nomes.get(id) ?? "Grupo",
    respostas: quantidade,
  }));
  const motivo = suprimirGrupos(grupos, semGrupo, minimoPorGrupo);
  return grupos
    .map((g) => {
      const oculto = motivo.get(g.id) ?? null;
      return { ...g, visivel: oculto === null, oculto };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const alfabetica = (a: string, b: string) =>
  a.localeCompare(b, "pt-BR", { sensitivity: "base" }) ||
  (a < b ? -1 : a > b ? 1 : 0);

/** Textos e "outro" em ordem alfabética. */
export function emOrdemAlfabetica(r: ResultadoPergunta): ResultadoPergunta {
  if ("textos" in r) {
    return {
      ...r,
      textos: [...r.textos].sort((a, b) => alfabetica(a.texto, b.texto)),
    };
  }
  if ("outros" in r) {
    return { ...r, outros: [...r.outros].sort(alfabetica) };
  }
  return r;
}

export interface EntradaDosResultados {
  pesquisaId: string;
  secoes: readonly Secao[];
  respostas: readonly RespostaParaCalculo[];
  /** `null` na anônima. */
  participantes: number | null;
  /** id → nome dos grupos das respostas (departamentos, centros, unidades). */
  nomesDosGrupos: ReadonlyMap<string, string>;
  minimoPorGrupo: number;
  /** O recorte pedido, ou `null` (visão geral). */
  filtro: { campo: CampoGrupo; grupoId: string } | null;
  /** Os recortes disponíveis (anônima: os de `separarPor`). */
  recortes: readonly CampoGrupo[];
  /** Só a identificada mostra o autor dos textos. */
  identificada: boolean;
  /**
   * Confidencial: a visão geral também respeita o mínimo por grupo (com
   * poucas respostas, o agregado e a lista de quem respondeu identificariam
   * a pessoa).
   */
  minimoNaVisaoGeral: boolean;
}

/**
 * Monta a resposta de `GET /pesquisas/:id/resultados`. Sem filtro, todas as
 * respostas; com um grupo, só as dele, e nada de número quando o grupo tem
 * menos respostas que o mínimo (na confidencial, vale também sem filtro).
 * Recorte fora dos disponíveis também não mostra número.
 */
export function montarResultados(e: EntradaDosResultados): ResultadosPesquisa {
  const respostas = e.respostas.map((r) => ({
    ...r,
    autor: e.identificada ? r.autor : null,
  }));
  const grupos: ResultadosPesquisa["grupos"] = {};
  for (const campo of e.recortes) {
    grupos[campo] = gruposDoCampo(
      campo,
      respostas,
      e.nomesDosGrupos,
      e.minimoPorGrupo,
    );
  }
  const f = e.filtro;
  const recorteValido = f === null || e.recortes.includes(f.campo);
  const filtradas = f
    ? respostas.filter((r) => r.grupos[f.campo] === f.grupoId)
    : respostas;
  // Com recorte, o grupo precisa estar visível depois da supressão (o
  // mínimo e a proteção do grupo menor); sem recorte, a confidencial
  // respeita o mínimo também na visão geral.
  let visivel: boolean;
  if (f === null) {
    visivel = !e.minimoNaVisaoGeral || filtradas.length >= e.minimoPorGrupo;
  } else {
    visivel =
      recorteValido &&
      (grupos[f.campo] ?? []).some((g) => g.id === f.grupoId && g.visivel);
  }
  const calculadas = visivel ? resultadoDasPerguntas(e.secoes, filtradas) : [];
  // Sem autor (confidencial, anônima e o master), os textos saem em ordem
  // alfabética: a ordem de chegada ajudaria a ligar o texto a quem
  // respondeu.
  const perguntas = e.identificada
    ? calculadas
    : calculadas.map(emOrdemAlfabetica);

  return {
    pesquisaId: e.pesquisaId,
    respostas: respostas.length,
    participantes: e.participantes,
    departamentos: grupos.departamento ?? [],
    grupos,
    filtro: {
      campo: f?.campo ?? null,
      grupoId: f?.grupoId ?? null,
      departamentoId: f?.campo === "departamento" ? f.grupoId : null,
      respostas: recorteValido ? filtradas.length : 0,
      visivel,
    },
    indicadores: calcularIndicadores(e.secoes, perguntas),
    recortes: [...e.recortes],
    perguntas,
  };
}
