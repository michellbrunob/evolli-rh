/**
 * T205 — dados do Dashboard inicial, só de contratos existentes (D-1):
 *
 * - `GET /v1/colaboradores` → `contadores` (pessoas ativas, em admissão e
 *   ativas por tipo de vínculo, hoje, do escopo inteiro);
 * - `GET /v1/movimentacoes?tipo=&status=efetivada` → admissões e
 *   desligamentos efetivados (vínculos), agrupados por mês da vigência.
 *
 * O servidor não filtra movimentações por período e as devolve da vigência
 * mais recente para a mais antiga. A série é lida em páginas de 100, de trás
 * para frente, até passar do início do ano consultado — com teto de 20 páginas
 * por série (D-7). Acima do teto, a série é marcada como excedida e nenhum
 * número parcial é devolvido.
 *
 * Só `efetivada` conta: a retificação deixa a original como `retificada` e
 * cria outra movimentação, que só conta quando efetivada; `programada`,
 * `solicitada` e `cancelada` não produziram estado.
 */
import type {
  ListarMovimentacoesQuery,
  MovimentacaoApi,
  ResultadoPaginado,
  TipoMovimentacao,
} from "../../api/movimentacaoClient";

export const TAMANHO_PAGINA_MOVIMENTACOES = 100;
export const TETO_DE_PAGINAS_POR_SERIE = 20;

/** O período consultado: o ano civil, até hoje no ano corrente. */
export interface PeriodoDoDashboard {
  readonly ano: number;
  /** `AAAA-01-01`. */
  readonly inicio: string;
  /** `AAAA-12-31`, ou hoje no ano corrente (`AAAA-MM-DD`). */
  readonly fim: string;
  /** Meses do período: 12, ou o mês corrente no ano corrente. */
  readonly meses: number;
  /** O ano é o corrente (o período vai "até hoje"). */
  readonly ateHoje: boolean;
}

function doisDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** O período do ano consultado, pelo relógio do navegador. */
export function periodoDoAno(
  ano: number,
  agora: Date = new Date(),
): PeriodoDoDashboard {
  const corrente = agora.getFullYear();
  const ateHoje = ano === corrente;
  const mes = agora.getMonth() + 1;
  return {
    ano,
    inicio: `${ano}-01-01`,
    fim: ateHoje
      ? `${ano}-${doisDigitos(mes)}-${doisDigitos(agora.getDate())}`
      : `${ano}-12-31`,
    meses: ateHoje ? mes : 12,
    ateHoje,
  };
}

const DIA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})/;

/** O dia civil (`AAAA-MM-DD`) de uma data da API, ou `null` se malformada. */
export function diaCivilDe(valor: string): string | null {
  const casado = DIA_CIVIL.exec(valor);
  if (!casado) return null;
  const [, ano, mes, dia] = casado as unknown as [
    string,
    string,
    string,
    string,
  ];
  return `${ano}-${mes}-${dia}`;
}

/** Série mensal de um tipo de movimentação. */
export type SerieMensal =
  | {
      readonly tipo: "completa";
      /** Uma contagem por mês do período (índice 0 = janeiro). */
      readonly porMes: readonly number[];
      readonly total: number;
    }
  | { readonly tipo: "excedida" };

export type ListarMovimentacoes = (
  query: ListarMovimentacoesQuery,
) => Promise<ResultadoPaginado<MovimentacaoApi>>;

/**
 * A leitura deixou de valer no meio da paginação (outro ano, outra leitura,
 * tela desmontada): as páginas restantes não são pedidas.
 */
export class LeituraAbandonada extends Error {
  constructor() {
    super("Leitura da série abandonada");
    this.name = "LeituraAbandonada";
  }
}

/**
 * Lê as movimentações efetivadas de um tipo no período e as agrupa por mês.
 *
 * Para quando: a página traz uma vigência anterior ao início do período (a
 * ordem é decrescente), a página vem incompleta ou o total já foi lido. Chega
 * ao teto sem nenhuma dessas condições → `excedida`. Uma movimentação que
 * reaparece na página seguinte (registro novo empurrando a paginação) conta
 * uma vez só.
 *
 * `vale` é conferido antes de cada página depois da primeira: quando a
 * leitura deixou de valer, a paginação para com `LeituraAbandonada`.
 */
export async function lerSerieMensal(
  tipo: TipoMovimentacao,
  periodo: PeriodoDoDashboard,
  listar: ListarMovimentacoes,
  vale: () => boolean = () => true,
): Promise<SerieMensal> {
  const porMes = new Array<number>(periodo.meses).fill(0);
  const vistos = new Set<string>();
  for (let pagina = 1; pagina <= TETO_DE_PAGINAS_POR_SERIE; pagina += 1) {
    if (pagina > 1 && !vale()) throw new LeituraAbandonada();
    const resposta = await listar({
      tipo,
      status: "efetivada",
      pagina,
      tamanhoPagina: TAMANHO_PAGINA_MOVIMENTACOES,
    });
    let passouDoInicio = false;
    for (const m of resposta.itens) {
      if (m.tipo !== tipo || m.status !== "efetivada" || vistos.has(m.id)) {
        continue;
      }
      vistos.add(m.id);
      const dia = diaCivilDe(m.vigenciaInicio);
      if (dia === null || dia > periodo.fim) continue;
      if (dia < periodo.inicio) {
        passouDoInicio = true;
        continue;
      }
      const mes = Number(dia.slice(5, 7)) - 1;
      if (mes >= 0 && mes < periodo.meses) porMes[mes] = (porMes[mes] ?? 0) + 1;
    }
    const acabou =
      passouDoInicio ||
      resposta.itens.length < TAMANHO_PAGINA_MOVIMENTACOES ||
      pagina * TAMANHO_PAGINA_MOVIMENTACOES >= resposta.total;
    if (acabou) {
      return {
        tipo: "completa",
        porMes,
        total: porMes.reduce((a, b) => a + b, 0),
      };
    }
  }
  return { tipo: "excedida" };
}

/**
 * T207 — as quatro movimentações efetivadas que o contrato entrega (V-3), na
 * ordem em que aparecem na aba Movimentação.
 */
export const TIPOS_DE_MOVIMENTACAO: readonly TipoMovimentacao[] = [
  "admissao",
  "desligamento",
  "transferencia_organizacional",
  "mudanca_cargo",
];

/** T207 — rótulo no plural, para cabeçalhos e legendas. */
export const ROTULO_DA_MOVIMENTACAO: Readonly<
  Record<TipoMovimentacao, string>
> = {
  admissao: "Admissões",
  desligamento: "Desligamentos",
  transferencia_organizacional: "Transferências",
  mudanca_cargo: "Mudanças de cargo",
};

const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Nome do mês (índice 0 = janeiro), com a inicial maiúscula. */
export function nomeDoMes(indice: number): string {
  const nome = NOMES_DOS_MESES[indice] ?? "";
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** Abreviação de três letras do mês, para o rótulo das barras. */
export function mesAbreviado(indice: number): string {
  return nomeDoMes(indice).slice(0, 3);
}

/** "1 pessoa ativa" / "3 pessoas ativas". */
export function plural(
  n: number,
  singular: string,
  pluralizado: string,
): string {
  return `${String(n)} ${n === 1 ? singular : pluralizado}`;
}

/**
 * A frase-resumo (E-2): os mesmos números dos cartões, numa linha. Pessoas
 * para os ativos e em admissão; vínculos para admissões e desligamentos.
 */
export function fraseResumo(
  ativos: number,
  emAdmissao: number,
  admissoes: number,
  desligamentos: number,
  periodo: PeriodoDoDashboard,
): string {
  const quando = periodo.ateHoje
    ? `Em ${periodo.ano}, até hoje,`
    : `Em ${periodo.ano},`;
  return `Hoje há ${plural(ativos, "pessoa ativa", "pessoas ativas")} e ${plural(
    emAdmissao,
    "pessoa em admissão",
    "pessoas em admissão",
  )}. ${quando} houve ${plural(admissoes, "admissão", "admissões")} e ${plural(
    desligamentos,
    "desligamento",
    "desligamentos",
  )} de vínculos efetivados.`;
}

// ---------------------------------------------------------------------------
// T207 — o time de hoje: distribuição por departamento e tempo de casa.
//
// Fonte: `GET /v1/colaboradores?grupo=ativos` (o mesmo contrato da listagem
// de Colaboradores, isolado pela empresa da sessão), lido em páginas de 100
// com o mesmo teto das séries (20 páginas = 2.000 pessoas). Acima do teto, a
// leitura é marcada como excedida e nenhum número é mostrado.
//
// De cada pessoa ativa, só o VÍNCULO PRINCIPAL (o primeiro, na ordem do
// servidor: ativo antes de previsto e encerrado): a data de admissão dele e o
// departamento da lotação vigente. Nenhum dado pessoal é lido.
//
// Privacidade: nenhum grupo com menos de `MINIMO_DO_GRUPO` pessoas aparece
// com nome ou número exato — grupos pequenos são somados num grupo neutro, e
// com menos de 3 pessoas no total nada é exibido.
// ---------------------------------------------------------------------------

export const MINIMO_DO_GRUPO = 3;

/** O que o Dashboard usa de cada pessoa ativa. */
export interface PessoaAtivaDoTime {
  readonly id: string;
  /** Dia civil da admissão do vínculo principal (`AAAA-MM-DD`). */
  readonly dataAdmissao: string | null;
  /** Departamento da lotação vigente do vínculo principal, se houver. */
  readonly departamento: { readonly id: string; readonly nome: string } | null;
}

export type TimeDeHoje =
  | {
      readonly tipo: "completo";
      readonly pessoas: readonly PessoaAtivaDoTime[];
    }
  | { readonly tipo: "excedido" };

interface ItemDaListagem {
  readonly id: string;
  readonly vinculos: readonly {
    readonly dataAdmissao: string;
    readonly lotacaoVigente: {
      readonly departamento: {
        readonly id: string;
        readonly nome: string;
      } | null;
    } | null;
  }[];
}

export type ListarAtivos = (query: {
  grupo: "ativos";
  pagina: number;
  tamanhoPagina: number;
}) => Promise<{ itens: readonly ItemDaListagem[]; total: number }>;

/**
 * Lê as pessoas ativas de hoje, de 100 em 100, até o total ou uma página
 * incompleta. Pessoa repetida entre páginas conta uma vez. `vale` é conferido
 * antes de cada página depois da primeira (`LeituraAbandonada`).
 */
export async function lerTimeDeHoje(
  listar: ListarAtivos,
  vale: () => boolean = () => true,
): Promise<TimeDeHoje> {
  const pessoas = new Map<string, PessoaAtivaDoTime>();
  for (let pagina = 1; pagina <= TETO_DE_PAGINAS_POR_SERIE; pagina += 1) {
    if (pagina > 1 && !vale()) throw new LeituraAbandonada();
    const resposta = await listar({
      grupo: "ativos",
      pagina,
      tamanhoPagina: TAMANHO_PAGINA_MOVIMENTACOES,
    });
    for (const item of resposta.itens) {
      if (pessoas.has(item.id)) continue;
      const principal = item.vinculos[0];
      const departamento = principal?.lotacaoVigente?.departamento ?? null;
      pessoas.set(item.id, {
        id: item.id,
        dataAdmissao: principal ? diaCivilDe(principal.dataAdmissao) : null,
        departamento: departamento
          ? { id: departamento.id, nome: departamento.nome }
          : null,
      });
    }
    const acabou =
      resposta.itens.length < TAMANHO_PAGINA_MOVIMENTACOES ||
      pagina * TAMANHO_PAGINA_MOVIMENTACOES >= resposta.total;
    if (acabou) return { tipo: "completo", pessoas: [...pessoas.values()] };
  }
  return { tipo: "excedido" };
}

/** Um grupo exibível: nome e quantidade (sempre >= `MINIMO_DO_GRUPO`). */
export interface GrupoDoTime {
  readonly nome: string;
  readonly pessoas: number;
}

export type DistribuicaoDoTime =
  | { readonly tipo: "pouca-gente"; readonly total: number }
  | {
      readonly tipo: "distribuida";
      readonly total: number;
      /** Departamentos com pelo menos `MINIMO_DO_GRUPO` pessoas. */
      readonly grupos: readonly GrupoDoTime[];
      /** Quantos departamentos têm ao menos uma pessoa (com nome). */
      readonly departamentos: number;
      /**
       * Pessoas somadas no grupo neutro: departamentos pequenos e quem não
       * tem departamento vigente. `0` quando não há.
       */
      readonly agrupadas: number;
    };

/**
 * Pessoas ativas por departamento da lotação vigente. Departamento com menos
 * de `MINIMO_DO_GRUPO` pessoas, e as pessoas sem departamento vigente, vão
 * para um grupo neutro, sem nome. Ordem: maior grupo primeiro, depois nome.
 */
export function distribuirPorDepartamento(
  pessoas: readonly PessoaAtivaDoTime[],
): DistribuicaoDoTime {
  const total = pessoas.length;
  if (total < MINIMO_DO_GRUPO) return { tipo: "pouca-gente", total };
  const porId = new Map<string, GrupoDoTime>();
  let semDepartamento = 0;
  for (const p of pessoas) {
    if (!p.departamento) {
      semDepartamento += 1;
      continue;
    }
    const atual = porId.get(p.departamento.id);
    porId.set(p.departamento.id, {
      nome: p.departamento.nome,
      pessoas: (atual?.pessoas ?? 0) + 1,
    });
  }
  const todos = [...porId.values()];
  const grupos = todos
    .filter((g) => g.pessoas >= MINIMO_DO_GRUPO)
    .sort(
      (a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome, "pt-BR"),
    );
  const agrupadas =
    semDepartamento +
    todos
      .filter((g) => g.pessoas < MINIMO_DO_GRUPO)
      .reduce((soma, g) => soma + g.pessoas, 0);
  return {
    tipo: "distribuida",
    total,
    grupos,
    departamentos: todos.length,
    agrupadas,
  };
}

/** Faixas de tempo de casa, em meses completos `[de, ate)`. */
export const FAIXAS_DE_TEMPO_DE_CASA = [
  { rotulo: "Menos de 1 ano", de: 0, ate: 12 },
  { rotulo: "1 a 2 anos", de: 12, ate: 24 },
  { rotulo: "2 a 5 anos", de: 24, ate: 60 },
  { rotulo: "5 a 10 anos", de: 60, ate: 120 },
  { rotulo: "10 anos ou mais", de: 120, ate: Number.POSITIVE_INFINITY },
] as const;

/** Meses completos entre o dia civil `de` e o dia civil de `hoje`. */
export function mesesCompletos(de: string, hoje: Date): number {
  const [a, m, d] = de.split("-").map(Number) as [number, number, number];
  let meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  if (hoje.getDate() < d) meses -= 1;
  return Math.max(0, meses);
}

/** Uma faixa exibida: um intervalo contínuo de faixas e quantas pessoas. */
export interface FaixaExibida {
  readonly rotulo: string;
  readonly pessoas: number;
}

export type TempoDeCasa =
  | { readonly tipo: "pouca-gente"; readonly total: number }
  | {
      readonly tipo: "calculado";
      readonly total: number;
      /** Mediana em meses completos. */
      readonly medianaEmMeses: number;
      /** Toda faixa tem 0 ou pelo menos `MINIMO_DO_GRUPO` pessoas. */
      readonly faixas: readonly FaixaExibida[];
      /** Pessoas sem data de admissão legível (não entram no cálculo). */
      readonly semData: number;
    };

function anosEmTexto(meses: number): string {
  const anos = meses / 12;
  return anos === 1 ? "1 ano" : `${String(anos)} anos`;
}

/** Rótulo de um intervalo `[de, ate)` em meses, escrito em anos. */
function rotuloDaFaixa(de: number, ate: number): string {
  const semFim = ate === Number.POSITIVE_INFINITY;
  if (de === 0 && semFim) return "Qualquer tempo de casa";
  if (de === 0) return `Menos de ${anosEmTexto(ate)}`;
  if (semFim) return `${anosEmTexto(de)} ou mais`;
  return `${String(de / 12)} a ${anosEmTexto(ate)}`;
}

interface Intervalo {
  readonly de: number;
  readonly ate: number;
  readonly pessoas: number;
}

/**
 * Junta faixas com 1 ou 2 pessoas às vizinhas, da mais longa para a mais
 * curta, até cada intervalo ter 0 ou pelo menos `MINIMO_DO_GRUPO` pessoas.
 * Nenhuma faixa fica escondida com "menos de 3" — que a diferença para o
 * total entregaria —, e cada número exibido é exato.
 */
function agruparFaixas(contagens: readonly number[]): FaixaExibida[] {
  const saida: Intervalo[] = [];
  let aberto: Intervalo | null = null;
  for (let i = FAIXAS_DE_TEMPO_DE_CASA.length - 1; i >= 0; i -= 1) {
    const f = FAIXAS_DE_TEMPO_DE_CASA[i]!;
    const n = contagens[i] ?? 0;
    aberto = aberto
      ? { de: f.de, ate: aberto.ate, pessoas: aberto.pessoas + n }
      : { de: f.de, ate: f.ate, pessoas: n };
    if (aberto.pessoas === 0 || aberto.pessoas >= MINIMO_DO_GRUPO) {
      saida.unshift(aberto);
      aberto = null;
    }
  }
  // Sobra pequena na ponta curta: junta com as seguintes até ter o mínimo.
  while (aberto && aberto.pessoas < MINIMO_DO_GRUPO && saida.length > 0) {
    const seguinte: Intervalo = saida.shift()!;
    aberto = {
      de: aberto.de,
      ate: seguinte.ate,
      pessoas: aberto.pessoas + seguinte.pessoas,
    };
  }
  if (aberto) saida.unshift(aberto);
  return saida.map((f) => ({
    rotulo: rotuloDaFaixa(f.de, f.ate),
    pessoas: f.pessoas,
  }));
}

/**
 * Tempo de casa das pessoas ativas, pela admissão do vínculo principal e
 * pelo dia de hoje do navegador. Mediana (não média: um único vínculo muito
 * antigo não puxa o número). Faixas pequenas se juntam às vizinhas.
 */
export function calcularTempoDeCasa(
  pessoas: readonly PessoaAtivaDoTime[],
  hoje: Date = new Date(),
): TempoDeCasa {
  const meses = pessoas
    .map((p) => (p.dataAdmissao ? mesesCompletos(p.dataAdmissao, hoje) : null))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  const total = meses.length;
  if (total < MINIMO_DO_GRUPO) return { tipo: "pouca-gente", total };
  const meio = Math.floor(total / 2);
  const medianaEmMeses =
    total % 2 === 1
      ? meses[meio]!
      : Math.floor((meses[meio - 1]! + meses[meio]!) / 2);
  const contagens = FAIXAS_DE_TEMPO_DE_CASA.map(
    (f) => meses.filter((m) => m >= f.de && m < f.ate).length,
  );
  return {
    tipo: "calculado",
    total,
    medianaEmMeses,
    faixas: agruparFaixas(contagens),
    semData: pessoas.length - total,
  };
}

/** "8 meses", "1 ano", "2 anos e 3 meses". */
export function duracaoEmTexto(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnos = anos === 0 ? "" : anos === 1 ? "1 ano" : `${anos} anos`;
  const parteMeses =
    resto === 0 ? "" : resto === 1 ? "1 mês" : `${resto} meses`;
  if (parteAnos && parteMeses) return `${parteAnos} e ${parteMeses}`;
  return parteAnos || parteMeses || "menos de 1 mês";
}
