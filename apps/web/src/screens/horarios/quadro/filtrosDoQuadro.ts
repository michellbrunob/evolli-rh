/**
 * T215 — a gaveta "Filtrar" do quadro da escala, em funções puras. O quadro
 * já tem todas as pessoas do período, então o filtro é no navegador:
 *
 * - atalho "Sem escala" (nenhum padrão no período);
 * - listas com contagem: Unidade, Departamento, Tipo de contrato e Turno
 *   (marcar várias = qualquer uma delas; "Não informado"/"Sem turno" é uma
 *   opção como as outras);
 * - seletores: Gestor, Cargo, Área, Centro de custo, Nível e Gênero.
 *
 * Grupos diferentes se somam (E); a contagem de cada opção é sobre todas as
 * pessoas do quadro.
 */
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { turnoDaPessoa } from "./quadroDaEscala";

/** O valor de "Não informado" / "Sem turno" nas listas e seletores. */
export const SEM_VALOR = "__sem__";

export type GrupoDeLista = "unidades" | "departamentos" | "tipos" | "turnos";
export type GrupoDeSeletor =
  "gestor" | "cargo" | "area" | "centroCusto" | "nivel" | "genero";

export interface FiltrosDoQuadro {
  /** Atalho "Com aviso da CLT". */
  readonly comAviso: boolean;
  readonly semEscala: boolean;
  readonly unidades: readonly string[];
  readonly departamentos: readonly string[];
  readonly tipos: readonly string[];
  readonly turnos: readonly string[];
  /** `""` = todos. */
  readonly gestor: string;
  readonly cargo: string;
  readonly area: string;
  readonly centroCusto: string;
  readonly nivel: string;
  readonly genero: string;
}

export const FILTROS_DO_QUADRO_VAZIOS: FiltrosDoQuadro = {
  comAviso: false,
  semEscala: false,
  unidades: [],
  departamentos: [],
  tipos: [],
  turnos: [],
  gestor: "",
  cargo: "",
  area: "",
  centroCusto: "",
  nivel: "",
  genero: "",
};

/** Quantos filtros estão ligados (cada opção marcada conta um). */
export function quantosFiltros(f: FiltrosDoQuadro): number {
  return (
    (f.comAviso ? 1 : 0) +
    (f.semEscala ? 1 : 0) +
    f.unidades.length +
    f.departamentos.length +
    f.tipos.length +
    f.turnos.length +
    (["gestor", "cargo", "area", "centroCusto", "nivel", "genero"] as const)
      .map((k): number => (f[k] ? 1 : 0))
      .reduce((a, b) => a + b, 0)
  );
}

/** O valor (id ou código) da pessoa no grupo; `SEM_VALOR` quando não há. */
export function valorDe(
  p: PessoaDoQuadroApi,
  grupo: GrupoDeLista | GrupoDeSeletor,
  referencia: string,
): string {
  switch (grupo) {
    case "unidades":
      return p.unidade?.id ?? SEM_VALOR;
    case "departamentos":
      return p.departamento?.id ?? SEM_VALOR;
    case "tipos":
      return p.tipoVinculo;
    case "turnos":
      return turnoDaPessoa(p, referencia)?.id ?? SEM_VALOR;
    case "gestor":
      return p.gestor?.id ?? SEM_VALOR;
    case "cargo":
      return p.cargo?.id ?? SEM_VALOR;
    case "area":
      return p.area?.id ?? SEM_VALOR;
    case "centroCusto":
      return p.centroCusto?.id ?? SEM_VALOR;
    case "nivel":
      return p.nivel ?? SEM_VALOR;
    case "genero":
      return p.genero ?? SEM_VALOR;
  }
}

function nomeDe(
  p: PessoaDoQuadroApi,
  grupo: GrupoDeLista | GrupoDeSeletor,
  referencia: string,
  rotulos: RotulosDosCodigos,
): string | null {
  switch (grupo) {
    case "unidades":
      return p.unidade?.nome ?? null;
    case "departamentos":
      return p.departamento?.nome ?? null;
    case "tipos":
      return rotulos.tipo(p.tipoVinculo);
    case "turnos":
      return turnoDaPessoa(p, referencia)?.nome ?? null;
    case "gestor":
      return p.gestor?.nome ?? null;
    case "cargo":
      return p.cargo?.nome ?? null;
    case "area":
      return p.area?.nome ?? null;
    case "centroCusto":
      return p.centroCusto?.nome ?? null;
    case "nivel":
      return p.nivel ? rotulos.nivel(p.nivel) : null;
    case "genero":
      return p.genero ? rotulos.genero(p.genero) : null;
  }
}

export interface RotulosDosCodigos {
  readonly tipo: (codigo: string) => string;
  readonly nivel: (codigo: string) => string;
  readonly genero: (codigo: string) => string;
}

export interface OpcaoDoFiltro {
  readonly valor: string;
  readonly rotulo: string;
  readonly quantas: number;
}

/**
 * As opções do grupo que aparecem no quadro, com quantas pessoas cada; "Não
 * informado" (ou "Sem turno") primeiro, depois em ordem alfabética.
 */
export function opcoesDo(
  pessoas: readonly PessoaDoQuadroApi[],
  grupo: GrupoDeLista | GrupoDeSeletor,
  referencia: string,
  rotulos: RotulosDosCodigos,
): OpcaoDoFiltro[] {
  const mapa = new Map<string, { rotulo: string; quantas: number }>();
  const vazio = grupo === "turnos" ? "Sem turno" : "Não informado";
  for (const p of pessoas) {
    const valor = valorDe(p, grupo, referencia);
    const atual = mapa.get(valor) ?? {
      rotulo: nomeDe(p, grupo, referencia, rotulos) ?? vazio,
      quantas: 0,
    };
    atual.quantas += 1;
    mapa.set(valor, atual);
  }
  return [...mapa.entries()]
    .map(([valor, o]) => ({ valor, ...o }))
    .sort((a, b) => {
      if (a.valor === SEM_VALOR) return -1;
      if (b.valor === SEM_VALOR) return 1;
      return a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });
}

/** Sem nenhum padrão de escala no período. */
export function semEscala(p: PessoaDoQuadroApi): boolean {
  return p.escalas.length === 0;
}

export function filtrar(
  pessoas: readonly PessoaDoQuadroApi[],
  f: FiltrosDoQuadro,
  referencia: string,
  /** Quem tem aviso da CLT no período (atalho "Com aviso da CLT"). */
  comAviso: ReadonlySet<string> = new Set(),
): PessoaDoQuadroApi[] {
  const listas: GrupoDeLista[] = [
    "unidades",
    "departamentos",
    "tipos",
    "turnos",
  ];
  const seletores: GrupoDeSeletor[] = [
    "gestor",
    "cargo",
    "area",
    "centroCusto",
    "nivel",
    "genero",
  ];
  return pessoas.filter(
    (p) =>
      (!f.comAviso || comAviso.has(p.colaboradorId)) &&
      (!f.semEscala || semEscala(p)) &&
      listas.every(
        (g) => f[g].length === 0 || f[g].includes(valorDe(p, g, referencia)),
      ) &&
      seletores.every((g) => !f[g] || f[g] === valorDe(p, g, referencia)),
  );
}

/** Marca ou desmarca uma opção da lista. */
export function alternarOpcao(
  f: FiltrosDoQuadro,
  grupo: GrupoDeLista,
  valor: string,
): FiltrosDoQuadro {
  const atual = f[grupo];
  return {
    ...f,
    [grupo]: atual.includes(valor)
      ? atual.filter((v) => v !== valor)
      : [...atual, valor],
  };
}
