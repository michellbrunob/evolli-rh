/**
 * Competência mensal (Baseline Jornada V1, decisão 6).
 *
 * A competência é `'YYYY-MM'`, calculada a partir do `momento` **no insert** e
 * gravada no próprio evento — nunca derivada na consulta.
 *
 * ### Por que um fuso fixo, declarado aqui
 *
 * `momento` é `timestamptz`: um instante absoluto. "Que mês é este instante?"
 * só tem resposta depois de escolher um fuso — 2026-08-01T02:00Z é agosto em
 * UTC e **julho** em `America/Sao_Paulo`. Um sistema de ponto trabalha com o
 * tempo local de quem bate o ponto, então o fuso local é a resposta certa.
 *
 * Fixá-lo numa constante — em vez de ler de configuração de ambiente — é
 * deliberado: se o fuso pudesse mudar por variável de ambiente, mudar essa
 * variável reclassificaria silenciosamente registros já gravados. Trocar este
 * valor exige alterar código, o que atravessa PR, revisão e CI.
 *
 * ### Limite conhecido
 *
 * Um único fuso para todas as empresas. Empresa com operação em fuso distinto
 * (ou mudança de regra de horário de verão) é decisão de produto ainda não
 * tomada — registrada como limitação, não resolvida por suposição aqui.
 */
export const FUSO_COMPETENCIA = "America/Sao_Paulo";

/** `'YYYY-MM'` — quatro dígitos de ano, mês de 01 a 12. */
export const COMPETENCIA_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/**
 * `en-CA` produz partes numéricas estáveis (`2026`, `08`) independentemente da
 * locale do processo — a formatação é montada manualmente abaixo, então a
 * escolha só precisa garantir dígitos ocidentais e zero à esquerda.
 */
const FORMATADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_COMPETENCIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partesLocais(momento: Date): {
  ano: string;
  mes: string;
  dia: string;
} {
  const partes = FORMATADOR.formatToParts(momento);
  const buscar = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return { ano: buscar("year"), mes: buscar("month"), dia: buscar("day") };
}

/** Competência `'YYYY-MM'` do instante, no fuso declarado. */
export function competenciaDe(momento: Date): string {
  const { ano, mes } = partesLocais(momento);
  return `${ano}-${mes}`;
}

/**
 * Data local `'YYYY-MM-DD'` do instante, no mesmo fuso da competência.
 *
 * Usada para comparar o momento com `dataAdmissao`/`dataDesligamento` do
 * vínculo, que são `date` (sem hora, sem fuso). Comparar um `timestamptz`
 * diretamente com um `date` compararia meia-noite UTC contra hora local e
 * erraria a fronteira do primeiro e do último dia do vínculo.
 */
export function dataLocalDe(momento: Date): string {
  const { ano, mes, dia } = partesLocais(momento);
  return `${ano}-${mes}-${dia}`;
}

/**
 * Extrai `'YYYY-MM-DD'` de uma coluna `date` do Prisma, que chega como `Date`
 * em meia-noite UTC. Ler a parte ISO evita reintroduzir o fuso local numa data
 * que, por definição, não tem hora.
 */
export function dataDeColunaDate(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}
