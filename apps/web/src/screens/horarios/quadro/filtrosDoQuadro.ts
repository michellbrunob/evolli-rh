/**
 * T215 — a gaveta "Filtros" do quadro da escala, em funções puras. O quadro
 * já tem todas as pessoas do período, então o filtro é no navegador:
 *
 * - atalhos: "Com aviso da CLT", "Sem escala" e "Mudanças não publicadas";
 * - grupos de várias opções: Unidade, Departamento, Tipo de contrato, Turno,
 *   Gestor, Cargo, Área, Centro de custo, Nível e Gênero (marcar várias =
 *   qualquer uma delas; "Não informado"/"Sem turno"/"Sem gestor" é uma opção
 *   como as outras);
 * - grupos diferentes se somam (E);
 * - a contagem de cada opção é FACETADA: conta quem passa em todos os OUTROS
 *   filtros (a opção com 0 fica, apagada).
 */
import type { PessoaDoQuadroApi } from "../../../api/escalaClient";
import { turnoDaPessoa } from "./quadroDaEscala";

/** O valor de "Não informado" / "Sem turno" / "Sem gestor". */
export const SEM_VALOR = "__sem__";

export type GrupoDoFiltro =
  | "unidades"
  | "departamentos"
  | "tipos"
  | "turnos"
  | "gestores"
  | "cargos"
  | "areas"
  | "centrosCusto"
  | "niveis"
  | "generos";

export type AtalhoDoFiltro = "comAviso" | "semEscala" | "mudancas" | "ausentes";

export interface FiltrosDoQuadro {
  readonly comAviso: boolean;
  readonly semEscala: boolean;
  /** Atalho "Mudanças não publicadas" (rascunho no período). */
  readonly mudancas: boolean;
  /** Atalho "De férias ou afastados" (ausência aprovada no período). */
  readonly ausentes: boolean;
  readonly unidades: readonly string[];
  readonly departamentos: readonly string[];
  readonly tipos: readonly string[];
  readonly turnos: readonly string[];
  readonly gestores: readonly string[];
  readonly cargos: readonly string[];
  readonly areas: readonly string[];
  readonly centrosCusto: readonly string[];
  readonly niveis: readonly string[];
  readonly generos: readonly string[];
}

export const FILTROS_DO_QUADRO_VAZIOS: FiltrosDoQuadro = {
  comAviso: false,
  semEscala: false,
  mudancas: false,
  ausentes: false,
  unidades: [],
  departamentos: [],
  tipos: [],
  turnos: [],
  gestores: [],
  cargos: [],
  areas: [],
  centrosCusto: [],
  niveis: [],
  generos: [],
};

/** Os grupos, na ordem da gaveta, com o rótulo e o "todos" do resumo. */
export const GRUPOS_DO_FILTRO: readonly {
  readonly grupo: GrupoDoFiltro;
  readonly rotulo: string;
  readonly todos: string;
  /** Como aparece: lista de caixas aberta, pílulas ou linha que abre. */
  readonly forma: "lista" | "pilulas" | "recolhida";
}[] = [
  { grupo: "unidades", rotulo: "Unidade", todos: "Todas", forma: "lista" },
  {
    grupo: "departamentos",
    rotulo: "Departamento",
    todos: "Todos",
    forma: "lista",
  },
  {
    grupo: "tipos",
    rotulo: "Tipo de contrato",
    todos: "Todos",
    forma: "pilulas",
  },
  { grupo: "turnos", rotulo: "Turno", todos: "Todos", forma: "pilulas" },
  { grupo: "gestores", rotulo: "Gestor", todos: "Todos", forma: "recolhida" },
  { grupo: "cargos", rotulo: "Cargo", todos: "Todos", forma: "recolhida" },
  { grupo: "areas", rotulo: "Área", todos: "Todas", forma: "recolhida" },
  {
    grupo: "centrosCusto",
    rotulo: "Centro de custo",
    todos: "Todos",
    forma: "recolhida",
  },
  { grupo: "niveis", rotulo: "Nível", todos: "Todos", forma: "recolhida" },
  { grupo: "generos", rotulo: "Gênero", todos: "Todos", forma: "recolhida" },
];

export const ROTULO_DO_ATALHO: Readonly<Record<AtalhoDoFiltro, string>> = {
  comAviso: "Com aviso da CLT",
  semEscala: "Sem escala",
  mudancas: "Mudanças não publicadas",
  ausentes: "De férias ou afastados",
};

export const ATALHOS_DO_FILTRO: readonly AtalhoDoFiltro[] = [
  "comAviso",
  "semEscala",
  "mudancas",
  "ausentes",
];

/** Quantos filtros estão ligados (cada opção marcada conta um). */
export function quantosFiltros(f: FiltrosDoQuadro): number {
  return (
    ATALHOS_DO_FILTRO.filter((a) => f[a]).length +
    GRUPOS_DO_FILTRO.reduce((t, g) => t + f[g.grupo].length, 0)
  );
}

/** O que os atalhos precisam saber do quadro. */
export interface ContextoDoFiltro {
  readonly referencia: string;
  /** Quem tem aviso da CLT no período. */
  readonly comAviso: ReadonlySet<string>;
  /** Quem tem rascunho no período. */
  readonly comMudanca: ReadonlySet<string>;
  /** Quem tem ausência aprovada no período. */
  readonly comAusencia: ReadonlySet<string>;
}

/** O valor (id ou código) da pessoa no grupo; `SEM_VALOR` quando não há. */
export function valorDe(
  p: PessoaDoQuadroApi,
  grupo: GrupoDoFiltro,
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
    case "gestores":
      return p.gestor?.id ?? SEM_VALOR;
    case "cargos":
      return p.cargo?.id ?? SEM_VALOR;
    case "areas":
      return p.area?.id ?? SEM_VALOR;
    case "centrosCusto":
      return p.centroCusto?.id ?? SEM_VALOR;
    case "niveis":
      return p.nivel ?? SEM_VALOR;
    case "generos":
      return p.genero ?? SEM_VALOR;
  }
}

export interface RotulosDosCodigos {
  readonly tipo: (codigo: string) => string;
  readonly nivel: (codigo: string) => string;
  readonly genero: (codigo: string) => string;
}

function nomeDe(
  p: PessoaDoQuadroApi,
  grupo: GrupoDoFiltro,
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
    case "gestores":
      return p.gestor?.nome ?? null;
    case "cargos":
      return p.cargo?.nome ?? null;
    case "areas":
      return p.area?.nome ?? null;
    case "centrosCusto":
      return p.centroCusto?.nome ?? null;
    case "niveis":
      return p.nivel ? rotulos.nivel(p.nivel) : null;
    case "generos":
      return p.genero ? rotulos.genero(p.genero) : null;
  }
}

/** "Não informado", "Sem turno" ou "Sem gestor". */
export function rotuloSemValor(grupo: GrupoDoFiltro): string {
  if (grupo === "turnos") return "Sem turno";
  if (grupo === "gestores") return "Sem gestor";
  return "Não informado";
}

export interface OpcaoDoFiltro {
  readonly valor: string;
  readonly rotulo: string;
  readonly quantas: number;
  /** Só no turno: a cor. */
  readonly cor?: string | null;
}

/** Sem nenhum padrão de escala no período. */
export function semEscala(p: PessoaDoQuadroApi): boolean {
  return p.escalas.length === 0;
}

function passaNoAtalho(
  p: PessoaDoQuadroApi,
  atalho: AtalhoDoFiltro,
  ctx: ContextoDoFiltro,
): boolean {
  if (atalho === "comAviso") return ctx.comAviso.has(p.colaboradorId);
  if (atalho === "semEscala") return semEscala(p);
  if (atalho === "ausentes") return ctx.comAusencia.has(p.colaboradorId);
  return ctx.comMudanca.has(p.colaboradorId);
}

export function filtrar(
  pessoas: readonly PessoaDoQuadroApi[],
  f: FiltrosDoQuadro,
  ctx: ContextoDoFiltro,
): PessoaDoQuadroApi[] {
  return pessoas.filter(
    (p) =>
      ATALHOS_DO_FILTRO.every((a) => !f[a] || passaNoAtalho(p, a, ctx)) &&
      GRUPOS_DO_FILTRO.every(
        ({ grupo }) =>
          f[grupo].length === 0 ||
          f[grupo].includes(valorDe(p, grupo, ctx.referencia)),
      ),
  );
}

/**
 * As opções do grupo (todas as que aparecem no quadro) com a contagem
 * facetada: quem passa nos outros filtros. "Não informado" primeiro, depois
 * em ordem alfabética.
 */
export function opcoesDo(
  pessoas: readonly PessoaDoQuadroApi[],
  grupo: GrupoDoFiltro,
  f: FiltrosDoQuadro,
  ctx: ContextoDoFiltro,
  rotulos: RotulosDosCodigos,
): OpcaoDoFiltro[] {
  const mapa = new Map<
    string,
    { rotulo: string; quantas: number; cor?: string | null }
  >();
  for (const p of pessoas) {
    const valor = valorDe(p, grupo, ctx.referencia);
    if (!mapa.has(valor)) {
      mapa.set(valor, {
        rotulo:
          nomeDe(p, grupo, ctx.referencia, rotulos) ?? rotuloSemValor(grupo),
        quantas: 0,
        ...(grupo === "turnos"
          ? { cor: turnoDaPessoa(p, ctx.referencia)?.cor ?? null }
          : {}),
      });
    }
  }
  for (const p of filtrar(pessoas, { ...f, [grupo]: [] }, ctx)) {
    mapa.get(valorDe(p, grupo, ctx.referencia))!.quantas += 1;
  }
  return [...mapa.entries()]
    .map(([valor, o]) => ({ valor, ...o }))
    .sort((a, b) => {
      if (a.valor === SEM_VALOR) return -1;
      if (b.valor === SEM_VALOR) return 1;
      return a.rotulo.localeCompare(b.rotulo, "pt-BR");
    });
}

/** Quantas pessoas o atalho mostraria, com os outros filtros. */
export function contagemDoAtalho(
  pessoas: readonly PessoaDoQuadroApi[],
  atalho: AtalhoDoFiltro,
  f: FiltrosDoQuadro,
  ctx: ContextoDoFiltro,
): number {
  return filtrar(pessoas, { ...f, [atalho]: true }, ctx).length;
}

/** Marca ou desmarca uma opção do grupo. */
export function alternarOpcao(
  f: FiltrosDoQuadro,
  grupo: GrupoDoFiltro,
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

/** O resumo do grupo fechado: os rótulos marcados, ou "Todos". */
export function resumoDoGrupo(
  opcoes: readonly OpcaoDoFiltro[],
  marcados: readonly string[],
  todos: string,
): string {
  if (marcados.length === 0) return todos;
  return opcoes
    .filter((o) => marcados.includes(o.valor))
    .map((o) => o.rotulo)
    .join(", ");
}

export interface FiltroAplicado {
  readonly chave: string;
  /** "Tipo de contrato: CLT" ou "Sem escala". */
  readonly texto: string;
  /** Os filtros sem este. */
  readonly sem: FiltrosDoQuadro;
}

/** As pílulas dos filtros aplicados (cada uma se remove sozinha). */
export function filtrosAplicados(
  pessoas: readonly PessoaDoQuadroApi[],
  f: FiltrosDoQuadro,
  ctx: ContextoDoFiltro,
  rotulos: RotulosDosCodigos,
): FiltroAplicado[] {
  const lista: FiltroAplicado[] = [];
  for (const a of ATALHOS_DO_FILTRO) {
    if (f[a]) {
      lista.push({
        chave: a,
        texto: ROTULO_DO_ATALHO[a],
        sem: { ...f, [a]: false },
      });
    }
  }
  for (const g of GRUPOS_DO_FILTRO) {
    if (f[g.grupo].length === 0) continue;
    const opcoes = opcoesDo(
      pessoas,
      g.grupo,
      FILTROS_DO_QUADRO_VAZIOS,
      ctx,
      rotulos,
    );
    for (const valor of f[g.grupo]) {
      const rotulo =
        opcoes.find((o) => o.valor === valor)?.rotulo ??
        (valor === SEM_VALOR ? rotuloSemValor(g.grupo) : valor);
      lista.push({
        chave: `${g.grupo}:${valor}`,
        texto: `${g.rotulo}: ${rotulo}`,
        sem: alternarOpcao(f, g.grupo, valor),
      });
    }
  }
  return lista;
}
