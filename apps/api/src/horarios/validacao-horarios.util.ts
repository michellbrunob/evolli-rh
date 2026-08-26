import {
  ConflictException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DIAS_SEMANA, DiaSemana } from "./horarios.types";

/** `"HH:MM"` 24h. Mesma âncora usada no DTO (`@Matches`). */
export const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Nome do dia -> inteiro 1..7 persistido (1=segunda ... 7=domingo). */
export function diaParaNumero(dia: DiaSemana): number {
  return DIAS_SEMANA.indexOf(dia) + 1;
}

/** Inteiro 1..7 -> nome do dia. */
export function numeroParaDia(numero: number): DiaSemana {
  const dia = DIAS_SEMANA[numero - 1];
  if (dia === undefined) {
    // Não deveria acontecer: o CHECK do banco garante 1..7. Defensivo.
    throw new UnprocessableEntityException("Dia da semana invalido.");
  }
  return dia;
}

/** `"HH:MM"` -> minutos desde a meia-noite (0..1439). */
export function minutosDe(hora: string): number {
  const partes = hora.split(":");
  const h = Number(partes[0]);
  const m = Number(partes[1]);
  return h * 60 + m;
}

/** Minutos desde a meia-noite -> `"HH:MM"`. */
export function formatarHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Período já normalizado para persistência. */
export interface PeriodoNormalizado {
  diaSemana: number;
  inicioMinuto: number;
  fimMinuto: number;
}

interface PeriodoEntrada {
  dia: DiaSemana;
  inicio: string;
  fim: string;
}

/**
 * Valida e normaliza os períodos de uma tabela (regras de integridade também
 * garantidas no banco por CHECK + EXCLUSION CONSTRAINT — aqui é a validação de
 * negócio que devolve erro 422 legível antes de chegar ao banco):
 *
 *  - par completo entrada/saída (garantido pelo DTO, reforçado aqui);
 *  - saída depois da entrada, no mesmo dia (sem período que cruza a meia-noite
 *    nesta V1 — jornada é intradiária);
 *  - sem sobreposição entre períodos do mesmo dia.
 *
 * Dias sem período (sábado/domingo, folga) simplesmente não aparecem na lista.
 * Uma lista vazia é aceita: representa uma tabela sem jornada prevista — a
 * decisão de exigir ao menos um período é de produto, não assumida aqui.
 */
export function normalizarPeriodos(
  periodos: PeriodoEntrada[],
): PeriodoNormalizado[] {
  const normalizados = periodos.map((p) => ({
    diaSemana: diaParaNumero(p.dia),
    inicioMinuto: minutosDe(p.inicio),
    fimMinuto: minutosDe(p.fim),
  }));

  for (const p of normalizados) {
    if (p.fimMinuto <= p.inicioMinuto) {
      throw new UnprocessableEntityException(
        "Saida deve ser posterior a entrada no mesmo periodo.",
      );
    }
  }

  // Sobreposição por dia: ordena por início dentro de cada dia e compara vizinhos.
  const porDia = new Map<number, PeriodoNormalizado[]>();
  for (const p of normalizados) {
    const lista = porDia.get(p.diaSemana);
    if (lista === undefined) {
      porDia.set(p.diaSemana, [p]);
    } else {
      lista.push(p);
    }
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a.inicioMinuto - b.inicioMinuto);
    for (let i = 1; i < lista.length; i += 1) {
      const anterior = lista[i - 1]!;
      const atual = lista[i]!;
      // `[)`: adjacência (fim == início seguinte) é permitida; interseção não.
      if (atual.inicioMinuto < anterior.fimMinuto) {
        throw new UnprocessableEntityException(
          "Periodos do mesmo dia nao podem se sobrepor.",
        );
      }
    }
  }

  return normalizados;
}

/**
 * Traduz falha de restrição do banco em erro HTTP estável, sem vazar nome de
 * tabela, coluna, constraint ou SQL. Mesmo critério de `traduzirErroPonto`.
 */
export function traduzirErroHorario(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 (unique) — inclui o índice parcial de vínculo aberto único.
    if (error.code === "P2002") {
      throw new ConflictException();
    }
    // P2003 (FK) — inclui as FKs compostas que garantem "mesma empresa".
    if (error.code === "P2003") {
      throw new UnprocessableEntityException();
    }
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // 23P01 — EXCLUSION: sobreposição de períodos ou de vigências.
    if (
      /23P01/.test(error.message) ||
      /exclusion constraint/i.test(error.message)
    ) {
      throw new ConflictException();
    }
    // 23514 — CHECK: dia/minuto inválido, vigência incoerente.
    // 23503 — FK; 23505 — unique (índice parcial).
    if (
      /23514/.test(error.message) ||
      /violates check constraint/i.test(error.message)
    ) {
      throw new UnprocessableEntityException();
    }
    if (
      /23505/.test(error.message) ||
      /violates unique constraint/i.test(error.message)
    ) {
      throw new ConflictException();
    }
    // Trigger de integridade (colaborador sem vínculo funcional na empresa).
    if (/integrity_constraint_violation/i.test(error.message)) {
      throw new UnprocessableEntityException();
    }
  }

  // Erro de privilégio (42501) e demais: não traduz. Ver `traduzirErroPonto`.
  throw error;
}
