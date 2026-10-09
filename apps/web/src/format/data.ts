/**
 * Formatação de datas para a interface (T154) — ponto ÚNICO de apresentação.
 *
 * Mora num módulo PRÓPRIO, e não dentro de um cliente de API, por um motivo
 * concreto herdado do antigo `format/dia.ts`: as telas mockam os clientes
 * inteiros com `vi.mock("../../api/...")`. Um formatador exportado de lá
 * viraria `undefined` dentro do teste e a célula renderizaria vazio — o teste
 * passaria a medir o mock, não a tela.
 *
 * ## A regra
 *
 *   data completa .... `DD/MM/AAAA`
 *   mês e ano ........ `MM/AAAA`
 *   data e hora ...... `DD/MM/AAAA às HH:mm`, relógio de 24 horas
 *   locale ........... `pt-BR`
 *   fuso de negócio .. `America/Sao_Paulo`, **só para instantes**
 *   ausente .......... `—`
 *   inválido ......... `—`, nunca `Invalid Date`, nunca exceção
 *
 * **Isto é apresentação.** Contratos HTTP, banco e o `value` de
 * `<input type="date">` continuam em ISO. Nada aqui muda o que trafega.
 *
 * ## Por que há duas funções, e não uma
 *
 * A diferença entre `formatarDiaCivil` e `formatarInstante` é semântica, não
 * cosmética — e tratá-las como a mesma coisa é o defeito que esta tarefa
 * corrige.
 *
 * **Data civil** é um dia do calendário sem hora: admissão, desligamento,
 * vigência, `dataReferencia`, competência. No banco são colunas `@db.Date`.
 * `new Date("2026-10-08")` é lido pela especificação da linguagem como
 * **meia-noite UTC**; a oeste de Greenwich — onde o Brasil inteiro está — essa
 * data renderizada por `toLocaleDateString` vira **07/10/2026**. Deslocar o dia
 * de uma admissão ou de uma vigência não é detalhe visual: é informação
 * funcional errada. Por isso os componentes são lidos **direto da string**, e
 * `Date` não entra no caminho de exibição.
 *
 * É o mesmo defeito que a T151 corrigiu no servidor ao trocar
 * `toISOString().slice(0, 10)` por `dataLocalDe` com `FUSO_COMPETENCIA`.
 *
 * **Instante** é um ponto no tempo com hora: `createdAt`, marcos de trilha,
 * registros de ponto. Aqui converter é exatamente o certo, e a conversão usa
 * `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` — o mesmo fuso de
 * negócio que o ponto já fixa no servidor.
 *
 * **Consequência visível e pretendida:** instantes que antes eram exibidos
 * fatiando o ISO em UTC passam a mostrar a hora de São Paulo. Um registro
 * gravado às `2026-01-05T00:30:00.000Z` aparecia como `2026-01-05 00:30` e
 * passa a aparecer como `04/01/2026 às 21:30`. A hora muda porque a anterior
 * estava errada para quem lê no Brasil.
 */

/** Texto exibido quando não há valor. Padrão visual já adotado no produto. */
export const AUSENTE = "—";

/** Fuso de negócio. Mesmo valor que `FUSO_COMPETENCIA` fixa no servidor. */
export const FUSO_DE_NEGOCIO = "America/Sao_Paulo";

/** `AAAA-MM-DD` no início da string — aceita ISO completo, de onde corta o dia. */
const DIA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})/;

/** `AAAA-MM` no início da string. */
const MES_REFERENCIA = /^(\d{4})-(\d{2})/;

/**
 * O valor é um dia que existe no calendário?
 *
 * Usa `Date.UTC`, que é aritmética pura em UTC e **não** interpreta string:
 * nenhuma conversão de fuso acontece aqui, e o resultado nunca alimenta a
 * exibição. Serve só para recusar `2026-02-30` e `2026-13-01`, que o regex
 * sozinho aceitaria.
 */
function diaExiste(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/**
 * Data civil → `DD/MM/AAAA`.
 *
 * Aceita `AAAA-MM-DD` e também o ISO completo que o Prisma devolve para
 * colunas `@db.Date` (`2026-01-05T00:00:00.000Z`): os dez primeiros caracteres
 * **já são** o dia gravado, e cortá-los não recalcula fuso nenhum.
 *
 * Nunca lança. Ausente, malformado ou dia inexistente devolvem `—`.
 */
export function formatarDiaCivil(valor: string | null | undefined): string {
  if (typeof valor !== "string") return AUSENTE;
  const casado = DIA_CIVIL.exec(valor.trim());
  if (!casado) return AUSENTE;
  const [, ano, mes, dia] = casado as unknown as [
    string,
    string,
    string,
    string,
  ];
  if (!diaExiste(Number(ano), Number(mes), Number(dia))) return AUSENTE;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Mês de referência → `MM/AAAA`.
 *
 * Aceita `AAAA-MM`, `AAAA-MM-DD` e ISO completo. Mesmo critério: componentes
 * lidos da string, sem `Date` no caminho de exibição.
 */
export function formatarMesReferencia(
  valor: string | null | undefined,
): string {
  if (typeof valor !== "string") return AUSENTE;
  const casado = MES_REFERENCIA.exec(valor.trim());
  if (!casado) return AUSENTE;
  const [, ano, mes] = casado as unknown as [string, string, string];
  const m = Number(mes);
  if (m < 1 || m > 12) return AUSENTE;
  return `${mes}/${ano}`;
}

/**
 * Formatador de instante, criado uma vez.
 *
 * `hourCycle: "h23"` é explícito de propósito: `hour12: false` sozinho produz
 * `24` para a meia-noite em alguns motores, e "24:05" não é hora.
 *
 * Construir o `Intl.DateTimeFormat` pode lançar num ambiente sem dados de
 * fuso (ICU reduzido). Nesse caso o módulo não pode derrubar a aplicação
 * inteira na importação — daí a construção preguiçosa e protegida.
 */
let formatadorDeInstante: Intl.DateTimeFormat | null | undefined;

function obterFormatador(): Intl.DateTimeFormat | null {
  if (formatadorDeInstante !== undefined) return formatadorDeInstante;
  try {
    formatadorDeInstante = new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO_DE_NEGOCIO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatadorDeInstante = null;
  }
  return formatadorDeInstante;
}

/**
 * Instante ISO → `DD/MM/AAAA às HH:mm`, no fuso de negócio.
 *
 * Aqui `Date` é o caminho **correto**: o valor é um ponto no tempo, e a
 * conversão para `America/Sao_Paulo` é justamente o que o usuário precisa ver.
 *
 * Monta o texto a partir de `formatToParts` em vez de concatenar a saída
 * pronta: a pontuação que o `pt-BR` insere entre data e hora varia por versão
 * do ICU (vírgula, espaço estreito), e o contrato desta função é `às`.
 *
 * Nunca lança. Ausente, malformado ou `Invalid Date` devolvem `—`.
 */
export function formatarInstante(valor: string | null | undefined): string {
  if (typeof valor !== "string" || valor.trim() === "") return AUSENTE;

  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return AUSENTE;

  const formatador = obterFormatador();
  if (!formatador) return AUSENTE;

  const partes = new Map(
    formatador.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  const dia = partes.get("day");
  const mes = partes.get("month");
  const ano = partes.get("year");
  const hora = partes.get("hour");
  const minuto = partes.get("minute");
  if (!dia || !mes || !ano || !hora || !minuto) return AUSENTE;

  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}
