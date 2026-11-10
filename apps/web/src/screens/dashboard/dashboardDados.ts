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
