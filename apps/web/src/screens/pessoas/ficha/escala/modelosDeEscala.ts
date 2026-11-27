import { OPCOES_ESCALA } from "../../NovaAdmissaoScreen";

/**
 * T215 — os 25 modelos de escala (os mesmos códigos e textos do contrato,
 * `OPCOES_ESCALA`), com o que o cálculo precisa:
 *
 * - `semanal`: os dias fixos na semana (1 = segunda … 7 = domingo);
 * - `revezamento` e `embarque`: dias de trabalho e de folga, em ciclo;
 * - `plantao`: horas de trabalho e de descanso, em ciclo;
 * - `outra`: os dias de trabalho são escolhidos.
 */
export type TipoDeEscala =
  "semanal" | "revezamento" | "plantao" | "embarque" | "outra";

export interface ModeloDeEscala {
  readonly codigo: string;
  readonly nome: string;
  readonly grupo: string;
  readonly descricao: string;
  readonly tipo: TipoDeEscala;
  /** Dias (revezamento, embarque) ou horas (plantão) de trabalho. */
  readonly trabalho: number;
  /** Dias (revezamento, embarque) ou horas (plantão) de folga. */
  readonly folga: number;
  /** Semanal: os dias fixos (o 6x1 tira a folga escolhida). */
  readonly diasFixos: readonly number[];
}

const SEMANAIS: Record<string, readonly number[]> = {
  "5x2": [1, 2, 3, 4, 5],
  "6x1": [1, 2, 3, 4, 5, 6, 7],
  semana_espanhola: [1, 2, 3, 4, 5],
  "4x3": [1, 2, 3, 4],
  fim_de_semana: [6, 7],
};

const EMBARQUE = new Set([
  "7x7",
  "14x14",
  "14x21",
  "15x15",
  "20x10",
  "21x21",
  "28x28",
]);
const PLANTAO = new Set(["12x36", "12x60", "12x72", "18x36", "24x48", "24x72"]);

function tipoDo(codigo: string): TipoDeEscala {
  if (codigo === "outra") return "outra";
  if (codigo in SEMANAIS) return "semanal";
  if (PLANTAO.has(codigo)) return "plantao";
  if (EMBARQUE.has(codigo)) return "embarque";
  return "revezamento";
}

export const MODELOS_DE_ESCALA: readonly ModeloDeEscala[] =
  OPCOES_ESCALA.filter((o) => o.codigo !== "nao_informada").map((o) => {
    const [grupo = "", descricao = ""] = o.descricao.split(" · ");
    const tipo = tipoDo(o.codigo);
    const [trabalho, folga] = /^\d+x\d+$/.test(o.codigo)
      ? o.codigo.split("x").map(Number)
      : [0, 0];
    return {
      codigo: o.codigo,
      nome: o.nome,
      grupo,
      descricao,
      tipo,
      trabalho: trabalho ?? 0,
      folga: folga ?? 0,
      diasFixos: SEMANAIS[o.codigo] ?? [],
    };
  });

/** Os grupos, na ordem em que aparecem. */
export const GRUPOS_DE_ESCALA: readonly string[] = [
  ...new Set(MODELOS_DE_ESCALA.map((m) => m.grupo)),
];

export function modeloDe(
  codigo: string | null | undefined,
): ModeloDeEscala | null {
  return MODELOS_DE_ESCALA.find((m) => m.codigo === codigo) ?? null;
}

/** Revezamento, plantão e embarque pedem o início do ciclo. */
export function temCiclo(codigo: string): boolean {
  const tipo = modeloDe(codigo)?.tipo;
  return tipo === "revezamento" || tipo === "plantao" || tipo === "embarque";
}

/** 1 = segunda … 7 = domingo. */
export const DIAS_DA_SEMANA = [
  { numero: 1, curto: "S", nome: "segunda" },
  { numero: 2, curto: "T", nome: "terça" },
  { numero: 3, curto: "Q", nome: "quarta" },
  { numero: 4, curto: "Q", nome: "quinta" },
  { numero: 5, curto: "S", nome: "sexta" },
  { numero: 6, curto: "S", nome: "sábado" },
  { numero: 7, curto: "D", nome: "domingo" },
] as const;
