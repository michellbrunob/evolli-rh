import type { ErroDeCampo } from "../../common/erros/recusa-por-campo";

/**
 * T215 — modelos de escala (os mesmos códigos do contrato,
 * `contrato_vinculo.escala`), cada um com o tipo que decide quais campos do
 * padrão se aplicam:
 *
 * - `semanal`: dias fixos na semana; o 6x1 escolhe a folga semanal (DSR);
 * - `revezamento`: N dias de trabalho e M de folga, em ciclo;
 * - `plantao`: N horas de trabalho e M de descanso, em ciclo; o 12x36 pode
 *   alternar um turno da noite, mês sim, mês não;
 * - `embarque`: dias embarcado e de folga, em ciclo;
 * - `outra`: os dias de trabalho da semana são escolhidos.
 *
 * Revezamento, plantão e embarque pedem o início do ciclo (o primeiro dia de
 * trabalho, que decide onde caem as folgas).
 */
export type TipoDeEscala =
  "semanal" | "revezamento" | "plantao" | "embarque" | "outra";

export const MODELOS_DE_ESCALA = {
  "5x2": { tipo: "semanal" },
  "6x1": { tipo: "semanal" },
  semana_espanhola: { tipo: "semanal" },
  "4x3": { tipo: "semanal" },
  fim_de_semana: { tipo: "semanal" },
  "5x1": { tipo: "revezamento" },
  "6x2": { tipo: "revezamento" },
  "4x2": { tipo: "revezamento" },
  "2x2": { tipo: "revezamento" },
  "3x3": { tipo: "revezamento" },
  "4x4": { tipo: "revezamento" },
  "12x36": { tipo: "plantao" },
  "12x60": { tipo: "plantao" },
  "12x72": { tipo: "plantao" },
  "18x36": { tipo: "plantao" },
  "24x48": { tipo: "plantao" },
  "24x72": { tipo: "plantao" },
  "7x7": { tipo: "embarque" },
  "14x14": { tipo: "embarque" },
  "14x21": { tipo: "embarque" },
  "15x15": { tipo: "embarque" },
  "20x10": { tipo: "embarque" },
  "21x21": { tipo: "embarque" },
  "28x28": { tipo: "embarque" },
  outra: { tipo: "outra" },
} as const satisfies Record<string, { tipo: TipoDeEscala }>;

export type ModeloDeEscala = keyof typeof MODELOS_DE_ESCALA;

export const CODIGOS_DE_MODELO = Object.keys(
  MODELOS_DE_ESCALA,
) as ModeloDeEscala[];

/** O padrão como chega (campos ausentes ou nulos valem o mesmo). */
export interface PadraoInformado {
  modelo: string;
  tabelaHorarioId?: string | null;
  turnoNoiteId?: string | null;
  folgaSemanal?: number | null;
  diasTrabalho?: number[] | null;
  inicioCiclo?: string | null;
}

function tipoDe(modelo: string): TipoDeEscala | null {
  return (
    (MODELOS_DE_ESCALA as Record<string, { tipo: TipoDeEscala }>)[modelo]
      ?.tipo ?? null
  );
}

function informado(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0;
  return valor !== undefined && valor !== null;
}

/**
 * Os campos que o modelo pede ou recusa, na ordem do formulário. Só o
 * motivo, nunca o valor.
 */
export function conferirPadrao(p: PadraoInformado): ErroDeCampo[] {
  const tipo = tipoDe(p.modelo);
  const erros: ErroDeCampo[] = [];
  if (tipo === null) return [{ campo: "modelo", motivo: "invalido" }];

  if (p.modelo !== "12x36" && informado(p.turnoNoiteId)) {
    erros.push({ campo: "turnoNoiteId", motivo: "nao_se_aplica" });
  }

  if (p.modelo === "6x1") {
    if (!informado(p.folgaSemanal)) {
      erros.push({ campo: "folgaSemanal", motivo: "obrigatorio" });
    }
  } else if (informado(p.folgaSemanal)) {
    erros.push({ campo: "folgaSemanal", motivo: "nao_se_aplica" });
  }

  if (tipo === "outra") {
    const dias = p.diasTrabalho ?? [];
    if (dias.length === 0) {
      erros.push({ campo: "diasTrabalho", motivo: "obrigatorio" });
    } else if (new Set(dias).size !== dias.length) {
      erros.push({ campo: "diasTrabalho", motivo: "invalido" });
    }
  } else if (informado(p.diasTrabalho)) {
    erros.push({ campo: "diasTrabalho", motivo: "nao_se_aplica" });
  }

  const comCiclo =
    tipo === "revezamento" || tipo === "plantao" || tipo === "embarque";
  if (comCiclo && !informado(p.inicioCiclo)) {
    erros.push({ campo: "inicioCiclo", motivo: "obrigatorio" });
  } else if (!comCiclo && informado(p.inicioCiclo)) {
    erros.push({ campo: "inicioCiclo", motivo: "nao_se_aplica" });
  }
  return erros;
}

/** Os dias de trabalho em ordem (1 = segunda … 7 = domingo). */
export function diasOrdenados(dias: readonly number[] | null | undefined) {
  return [...(dias ?? [])].sort((a, b) => a - b);
}

/** Mesmo padrão (a troca precisa mudar alguma coisa). */
export function mesmoPadrao(a: PadraoInformado, b: PadraoInformado): boolean {
  return (
    a.modelo === b.modelo &&
    (a.tabelaHorarioId ?? null) === (b.tabelaHorarioId ?? null) &&
    (a.turnoNoiteId ?? null) === (b.turnoNoiteId ?? null) &&
    (a.folgaSemanal ?? null) === (b.folgaSemanal ?? null) &&
    (a.inicioCiclo ?? null) === (b.inicioCiclo ?? null) &&
    diasOrdenados(a.diasTrabalho).join(",") ===
      diasOrdenados(b.diasTrabalho).join(",")
  );
}
