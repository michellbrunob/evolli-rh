import { perguntasEmOrdem } from "./estrutura-pesquisa";
import type {
  DepartamentoDoResultado,
  Pergunta,
  ResultadoPergunta,
  ResultadosPesquisa,
  Secao,
  ValorRespondido,
} from "./pesquisas.types";
import { perguntasVistas } from "./validacao-respostas";

/**
 * T216 — resultados agregados da pesquisa. Função pura: recebe a estrutura e
 * as respostas gravadas e devolve, por pergunta, média e distribuição
 * (escalas), eNPS, contagem das escolhas, sim/não, textos e datas, com
 * quantas pessoas viram a pergunta (condicionais). O recorte por
 * departamento respeita o mínimo de respostas por grupo.
 */

export interface RespostaParaCalculo {
  valores: readonly ValorRespondido[];
  /** Nome de quem respondeu — só na identificada. */
  autor: string | null;
  departamentoId: string | null;
}

/** Duas casas, sem `-0`. */
function arredondar(n: number): number {
  return Math.round(n * 100) / 100 || 0;
}

/** Os valores possíveis de uma escala (para a distribuição com zeros). */
function faixaDaEscala(p: Pergunta): [number, number] | null {
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
    return {
      ...base,
      viram,
      media,
      distribuicao,
      ...(p.tipo === "nota_0_10" && p.config.enps === true
        ? { enps: calcularEnps(numeros) }
        : {}),
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
  respostas: readonly RespostaParaCalculo[],
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

export interface EntradaDosResultados {
  pesquisaId: string;
  secoes: readonly Secao[];
  respostas: readonly RespostaParaCalculo[];
  participantes: number;
  /** id → nome dos departamentos das respostas. */
  nomesDosDepartamentos: ReadonlyMap<string, string>;
  minimoPorGrupo: number;
  departamentoId: string | null;
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
 * respostas; com `departamentoId`, só as do grupo, e nada de número quando o
 * grupo tem menos respostas que o mínimo (na confidencial, vale também sem
 * filtro).
 */
export function montarResultados(e: EntradaDosResultados): ResultadosPesquisa {
  const respostas = e.respostas.map((r) => ({
    ...r,
    autor: e.identificada ? r.autor : null,
  }));
  const porDepartamento = new Map<string, number>();
  for (const r of respostas) {
    if (r.departamentoId) {
      porDepartamento.set(
        r.departamentoId,
        (porDepartamento.get(r.departamentoId) ?? 0) + 1,
      );
    }
  }
  const departamentos: DepartamentoDoResultado[] = [...porDepartamento]
    .map(([id, quantidade]) => ({
      id,
      nome: e.nomesDosDepartamentos.get(id) ?? "Departamento",
      respostas: quantidade,
      visivel: quantidade >= e.minimoPorGrupo,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const filtradas =
    e.departamentoId === null
      ? respostas
      : respostas.filter((r) => r.departamentoId === e.departamentoId);
  const visivel =
    e.departamentoId === null && !e.minimoNaVisaoGeral
      ? true
      : filtradas.length >= e.minimoPorGrupo;

  return {
    pesquisaId: e.pesquisaId,
    respostas: respostas.length,
    participantes: e.participantes,
    departamentos,
    filtro: { departamentoId: e.departamentoId, visivel },
    perguntas: visivel ? resultadoDasPerguntas(e.secoes, filtradas) : [],
  };
}
