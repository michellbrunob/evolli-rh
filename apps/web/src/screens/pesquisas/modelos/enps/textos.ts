/**
 * T216 — os textos e as contas de tela do eNPS: zonas, grupos, sinais e
 * percentuais. A zona e o grupo seguem o cálculo da API
 * (`apps/api/src/pesquisas/modelos/enps/calculo.ts`).
 */
import type { GrupoDoEnps, ZonaDoEnps } from "../../../../api/pesquisasClient";

export const ZONAS_DO_ENPS: readonly {
  readonly zona: ZonaDoEnps;
  readonly rotulo: string;
  readonly de: number;
  readonly ate: number;
  readonly faixa: "critico" | "atencao" | "saudavel" | "forte";
}[] = [
  { zona: "critica", rotulo: "Crítica", de: -100, ate: -1, faixa: "critico" },
  {
    zona: "aperfeicoamento",
    rotulo: "Aperfeiçoamento",
    de: 0,
    ate: 49,
    faixa: "atencao",
  },
  {
    zona: "qualidade",
    rotulo: "Qualidade",
    de: 50,
    ate: 74,
    faixa: "saudavel",
  },
  {
    zona: "excelencia",
    rotulo: "Excelência",
    de: 75,
    ate: 100,
    faixa: "forte",
  },
];

export const zonaDoEnps = (z: ZonaDoEnps) =>
  ZONAS_DO_ENPS.find((x) => x.zona === z)!;

/** "Zona de aperfeiçoamento". */
export const TITULO_DA_ZONA: Readonly<Record<ZonaDoEnps, string>> = {
  critica: "Zona crítica",
  aperfeicoamento: "Zona de aperfeiçoamento",
  qualidade: "Zona de qualidade",
  excelencia: "Zona de excelência",
};

/** O que a zona quer dizer, em uma frase. */
export const FRASE_DA_ZONA: Readonly<Record<ZonaDoEnps, string>> = {
  critica: "Há mais detratores que promotores: a recomendação pede ação já.",
  aperfeicoamento:
    "Há mais promotores que detratores, mas ainda há espaço para melhorar.",
  qualidade: "A maioria recomenda a empresa: bom sinal, vale manter o rumo.",
  excelencia: "As pessoas recomendam a empresa com entusiasmo.",
};

export const GRUPOS_DO_ENPS: readonly {
  readonly grupo: GrupoDoEnps;
  readonly singular: string;
  readonly plural: string;
  readonly notas: string;
}[] = [
  {
    grupo: "promotor",
    singular: "Promotor",
    plural: "Promotores",
    notas: "9–10",
  },
  { grupo: "neutro", singular: "Neutro", plural: "Neutros", notas: "7–8" },
  {
    grupo: "detrator",
    singular: "Detrator",
    plural: "Detratores",
    notas: "0–6",
  },
];

export const grupoDaNota = (nota: number): GrupoDoEnps =>
  nota >= 9 ? "promotor" : nota >= 7 ? "neutro" : "detrator";

/** O que a nota da pessoa quer dizer. */
export const FRASE_DO_GRUPO: Readonly<Record<GrupoDoEnps, string>> = {
  promotor: "Recomendaria a empresa: está entre quem a indica com entusiasmo.",
  neutro: "Vê pontos bons, mas sem entusiasmo para recomendar.",
  detrator: "Hoje não recomendaria a empresa como lugar para trabalhar.",
};

/** "+25" / "−12" / "0". */
export const comSinal = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";

/** "7,8" (uma casa, vírgula). */
export const umaCasaBr = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

/**
 * "+0,8" / "−4,2" / "−3" / "0": a diferença já vem com uma casa (o meio
 * sobe no valor com sinal, a regra do resultado individual); inteiro sem
 * casa.
 */
export const diferencaBr = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${Number.isInteger(n) ? String(Math.abs(n)) : umaCasaBr(Math.abs(n))}`;

export const pctDe = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;
