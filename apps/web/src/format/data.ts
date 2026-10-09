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
 * Instante **exige** designador de fuso (`Z` ou `±HH:mm`). Um valor sem fuso
 * seria lido como hora local do processo, e a tela mostraria horas diferentes
 * conforme a máquina — o defeito que esta tarefa fecha, não um que ela aceita.
 * Entrada ambígua devolve `—`.
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

/**
 * ## As gramáticas aceitas
 *
 * Nenhuma delas é prefixo: as três são **ancoradas no fim**. Um prefixo
 * permissivo aceita lixo e devolve uma data confiante, que é pior do que
 * recusar — `2026-10-08T99:99:99Z` não é um dia, e exibi-lo como `08/10/2026`
 * esconde a corrupção em vez de mostrá-la.
 *
 * O que cada função aceita saiu de uma MEDIÇÃO do que os call sites reais
 * entregam, com a suíte inteira instrumentada:
 *
 *   `formatarDiaCivil`       `AAAA-MM-DD` (2761x) · `null` (365x) ·
 *                            `AAAA-MM-DDT00:00:00.000Z` (153x)
 *   `formatarMesReferencia`  `AAAA-MM` (388x) — e **nada mais**
 *   `formatarInstante`       sempre com `Z`, vindo da API
 *
 * Daí as duas decisões:
 *
 * - a data civil aceita a forma serializada do Prisma, porque ela EXISTE nos
 *   contratos (coluna `@db.Date` volta como `Date` e serializa em meia-noite
 *   UTC) — mas só na forma estrita `T00:00:00`, com fração opcional e `Z`;
 *   qualquer outro horário ou offset é um instante disfarçado e é recusado;
 * - o mês de referência aceita **só** `AAAA-MM`, porque nenhum call site real
 *   entrega outra coisa. A competência vem de `<input type="month">`.
 */

/** `AAAA-MM-DD` exato. */
const CIVIL_EXATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Data civil serializada pelo Prisma: meia-noite UTC, fração opcional, `Z`.
 *
 * `T00:00:00` é literal de propósito. `2026-01-05T09:00:00Z` não é um dia
 * civil — é um instante — e cai fora.
 */
const CIVIL_SERIALIZADA = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.\d{1,9})?Z$/;

/** `AAAA-MM` exato. Nenhum call site real entrega outra forma. */
const MES_EXATO = /^(\d{4})-(\d{2})$/;

/** Regra gregoriana, sem `Date` e sem fuso. */
function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * O valor é um dia que existe no calendário?
 *
 * Aritmética civil pura. A versão anterior usava `Date.UTC`, e isso apagava
 * silenciosamente os anos 0–99: `Date.UTC(50, 0, 1)` devolve **1950**, pelo
 * mapeamento legado de ano de dois dígitos do JavaScript, então o round-trip
 * nunca batia e `0050-06-15` virava `—`. Sem `Date` no caminho, o século não
 * importa — e o calendário continua sendo o calendário.
 */
function diaExiste(ano: number, mes: number, dia: number): boolean {
  if (!Number.isInteger(ano) || ano < 1) return false;
  if (mes < 1 || mes > 12) return false;
  if (dia < 1) return false;
  const limite = mes === 2 && ehBissexto(ano) ? 29 : DIAS_POR_MES[mes - 1]!;
  return dia <= limite;
}

/**
 * Data civil → `DD/MM/AAAA`.
 *
 * Aceita `AAAA-MM-DD` e a forma serializada estrita do Prisma. Recusa tudo
 * mais, inclusive o que **parece** uma data com sobra: `2026-10-08lixo`,
 * `2026-10-08-01`, `2026-10-08T09:00:00Z`, `2026-10-08T99:99:99Z` e valores
 * com espaço. Dia inexistente também recusa.
 *
 * Nunca lança. Qualquer recusa devolve `—`.
 */
export function formatarDiaCivil(valor: string | null | undefined): string {
  if (typeof valor !== "string") return AUSENTE;
  const casado = CIVIL_EXATA.exec(valor) ?? CIVIL_SERIALIZADA.exec(valor);
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
 * Aceita **só** `AAAA-MM`. Não deriva competência de data completa: nenhum
 * call site real precisa disso, e aceitar prefixo era o que fazia
 * `2026-10-xx` e `2026-1013` renderizarem `10/2026` como se fossem válidos.
 */
export function formatarMesReferencia(
  valor: string | null | undefined,
): string {
  if (typeof valor !== "string") return AUSENTE;
  const casado = MES_EXATO.exec(valor);
  if (!casado) return AUSENTE;
  const [, ano, mes] = casado as unknown as [string, string, string];
  const m = Number(mes);
  if (m < 1 || m > 12) return AUSENTE;
  if (Number(ano) < 1) return AUSENTE;
  return `${mes}/${ano}`;
}

/**
 * Instante **inequívoco**: `AAAA-MM-DDTHH:mm`, segundos e fração opcionais, e
 * designador de fuso OBRIGATÓRIO — `Z` ou `±HH:mm`.
 *
 * O designador não é firula de validação: sem ele, `new Date("2026-10-08T15:30:00")`
 * é lido como **hora local do processo**. O mesmo valor renderiza `12:30` numa
 * máquina em UTC, `15:30` em São Paulo e `03:30` em Tóquio — a saída passaria a
 * depender de onde o código roda, que é exatamente o defeito que a T154 existe
 * para eliminar. Entrada ambígua devolve `—`: errar visivelmente é melhor que
 * exibir uma hora plausível e errada.
 *
 * Exigimos o `:` no offset (`+01:00`, não `+0100`): é a forma do perfil ISO
 * 8601 que a especificação da linguagem define, e é a única que a API emite.
 */
const INSTANTE_INEQUIVOCO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

/**
 * Offset máximo que existe de verdade.
 *
 * A gramática do ECMAScript aceita hora de offset de `00` a `23`, mas fuso
 * nenhum passa de `±14:00` (Kiritimati, na ponta positiva; a negativa não
 * chega a `-13:00`). `+23:59` não é um fuso, é lixo com forma de fuso — e o
 * ponto desta função é recusar o que não dá para interpretar com confiança.
 * No limite de 14 horas os minutos têm de ser `00`: não existe `+14:01`.
 */
const OFFSET_HORA_MAXIMA = 14;

/**
 * Valida o instante e devolve o `Date` correspondente, ou `null`.
 *
 * O regex sozinho aceitaria `2026-02-31T25:99:99Z`; os limites de calendário,
 * de relógio e de offset são conferidos aqui.
 */
function instanteDe(bruto: string): Date | null {
  const casado = INSTANTE_INEQUIVOCO.exec(bruto);
  if (!casado) return null;

  const [, ano, mes, dia, hora, minuto, segundo, offHora, offMinuto] = casado;
  if (!diaExiste(Number(ano), Number(mes), Number(dia))) return null;
  if (Number(hora) > 23 || Number(minuto) > 59) return null;
  if (segundo !== undefined && Number(segundo) > 59) return null;

  if (offHora !== undefined) {
    const oh = Number(offHora);
    const om = Number(offMinuto);
    if (om > 59) return null;
    if (oh > OFFSET_HORA_MAXIMA) return null;
    if (oh === OFFSET_HORA_MAXIMA && om !== 0) return null;
  }

  const instante = new Date(bruto);
  return Number.isNaN(instante.getTime()) ? null : instante;
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
 * **Só aceita instante inequívoco** — com `Z` ou com offset explícito. Recusa,
 * devolvendo `—`:
 *
 *   `2026-10-08T15:30:00`        sem fuso: a saída dependeria da máquina
 *   `2026-10-08 15:30:00Z`       espaço no lugar do `T`: nenhuma API emite
 *   `2026-10-08`                 data civil: é de `formatarDiaCivil`
 *   `2026-10-08T15:30:00+15:00`  offset que não existe (máximo real: ±14:00)
 *   `2026-10-08T15:30:00+14:01`  no limite de 14 horas, minuto tem de ser 00
 *   `2026-10-08T15:30:00+23:59`  aceito pela gramática da linguagem, mas não
 *                                é fuso nenhum
 *
 * Nunca lança. Ausente, ambíguo ou malformado devolvem `—`.
 *
 * **Espaço em volta:** esta função apara, e a data civil e o mês **não**. Não
 * é descuido: o `trim` do instante é contrato fixado por teste desde a
 * primeira rodada, e as duas gramáticas civis nasceram estritas nesta — onde
 * `" 2026-10-08 "` nunca chega de call site real.
 */
export function formatarInstante(valor: string | null | undefined): string {
  if (typeof valor !== "string") return AUSENTE;

  const instante = instanteDe(valor.trim());
  if (!instante) return AUSENTE;

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

  // `year: "numeric"` NÃO preenche com zero — ao contrário de `month` e `day`,
  // que são `2-digit`. Sem este `padStart`, o ano 99 sai como "99" e o formato
  // prometido (`DD/MM/AAAA`) quebra justamente onde ninguém olha.
  return `${dia}/${mes}/${ano.padStart(4, "0")} às ${hora}:${minuto}`;
}
