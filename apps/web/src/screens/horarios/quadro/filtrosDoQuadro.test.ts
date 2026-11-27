import { describe, expect, it } from "vitest";
import {
  type ContextoDoFiltro,
  FILTROS_DO_QUADRO_VAZIOS,
  SEM_VALOR,
  alternarOpcao,
  contagemDoAtalho,
  filtrar,
  filtrosAplicados,
  opcoesDo,
  quantosFiltros,
  resumoDoGrupo,
  semEscala,
} from "./filtrosDoQuadro";
import { escala, pessoa, turno } from "./fixturasDoQuadro";

const REF = "2026-11-23";
const ROTULOS = {
  tipo: (c: string) => (c === "clt" ? "CLT" : c === "estagio" ? "Estágio" : c),
  nivel: (c: string) => (c === "pleno" ? "Pleno" : c),
  genero: (c: string) => (c === "feminino" ? "Feminino" : c),
};

const ti = { id: "d-ti", nome: "Tecnologia" };
const mk = { id: "d-mk", nome: "Marketing" };
const ana = pessoa("Ana", {
  departamento: ti,
  unidade: { id: "u1", nome: "Matriz" },
  gestor: { id: "g1", nome: "Gestora" },
  cargo: { id: "c1", nome: "Analista" },
  area: { id: "a1", nome: "Dados" },
  centroCusto: { id: "cc1", nome: "CC Tec" },
  nivel: "pleno",
  genero: "feminino",
  escalas: [escala()],
});
const bia = pessoa("Bia", {
  tipoVinculo: "estagio",
  departamento: mk,
  gestor: { id: "g2", nome: "Outro Gestor" },
  cargo: { id: "c2", nome: "Estagiária" },
  escalas: [escala({ turno: turno("Loja", { cor: "verde" }) })],
});
const caio = pessoa("Caio");
const todas = [ana, bia, caio];

const CTX: ContextoDoFiltro = {
  referencia: REF,
  comAviso: new Set(["c-Ana"]),
  comMudanca: new Set(["c-Bia"]),
  comAusencia: new Set(["c-Caio"]),
};
const nomes = (ps: { nome: string }[]) => ps.map((p) => p.nome);
const V = FILTROS_DO_QUADRO_VAZIOS;

describe("T215 — filtros do quadro", () => {
  it("opções: 'Não informado'/'Sem turno'/'Sem gestor' primeiro, depois em ordem alfabética; turno com a cor", () => {
    expect(
      opcoesDo(todas, "departamentos", V, CTX, ROTULOS).map((o) => [
        o.rotulo,
        o.quantas,
      ]),
    ).toEqual([
      ["Não informado", 1],
      ["Marketing", 1],
      ["Tecnologia", 1],
    ]);
    expect(opcoesDo(todas, "turnos", V, CTX, ROTULOS)).toEqual([
      { valor: SEM_VALOR, rotulo: "Sem turno", quantas: 1, cor: null },
      { valor: "t-Comercial", rotulo: "Comercial", quantas: 1, cor: "azul" },
      { valor: "t-Loja", rotulo: "Loja", quantas: 1, cor: "verde" },
    ]);
    expect(
      opcoesDo(todas, "gestores", V, CTX, ROTULOS).map((o) => o.rotulo),
    ).toEqual(["Sem gestor", "Gestora", "Outro Gestor"]);
    expect(
      opcoesDo(todas, "tipos", V, CTX, ROTULOS).map((o) => o.rotulo),
    ).toEqual(["CLT", "Estágio"]);
  });

  it("contagem facetada: conta quem passa nos OUTROS filtros; a opção zerada fica", () => {
    const f = { ...V, tipos: ["clt"] };
    expect(
      opcoesDo(todas, "departamentos", f, CTX, ROTULOS).map((o) => [
        o.rotulo,
        o.quantas,
      ]),
    ).toEqual([
      ["Não informado", 1],
      ["Marketing", 0],
      ["Tecnologia", 1],
    ]);
    // O próprio grupo não se conta: com CLT marcado, Estágio continua 1.
    expect(
      opcoesDo(todas, "tipos", f, CTX, ROTULOS).map((o) => [
        o.rotulo,
        o.quantas,
      ]),
    ).toEqual([
      ["CLT", 2],
      ["Estágio", 1],
    ]);
  });

  it("atalhos: com aviso, sem escala e mudanças não publicadas, com contagem facetada", () => {
    expect(semEscala(caio)).toBe(true);
    expect(nomes(filtrar(todas, { ...V, comAviso: true }, CTX))).toEqual([
      "Ana",
    ]);
    expect(nomes(filtrar(todas, { ...V, semEscala: true }, CTX))).toEqual([
      "Caio",
    ]);
    expect(nomes(filtrar(todas, { ...V, mudancas: true }, CTX))).toEqual([
      "Bia",
    ]);
    expect(contagemDoAtalho(todas, "mudancas", V, CTX)).toBe(1);
    expect(nomes(filtrar(todas, { ...V, ausentes: true }, CTX))).toEqual([
      "Caio",
    ]);
    expect(contagemDoAtalho(todas, "ausentes", V, CTX)).toBe(1);
    expect(
      contagemDoAtalho(todas, "ausentes", { ...V, tipos: ["estagio"] }, CTX),
    ).toBe(0);
    expect(
      contagemDoAtalho(todas, "mudancas", { ...V, tipos: ["clt"] }, CTX),
    ).toBe(0);
    // O próprio atalho ligado não zera a contagem dele.
    expect(
      contagemDoAtalho(todas, "semEscala", { ...V, semEscala: true }, CTX),
    ).toBe(1);
  });

  it("várias opções = qualquer uma; grupos se somam; todos os grupos são de várias opções", () => {
    expect(nomes(filtrar(todas, V, CTX))).toEqual(["Ana", "Bia", "Caio"]);
    expect(
      nomes(filtrar(todas, { ...V, departamentos: ["d-ti", SEM_VALOR] }, CTX)),
    ).toEqual(["Ana", "Caio"]);
    expect(
      nomes(
        filtrar(
          todas,
          { ...V, departamentos: ["d-ti", "d-mk"], tipos: ["estagio"] },
          CTX,
        ),
      ),
    ).toEqual(["Bia"]);
    expect(
      nomes(filtrar(todas, { ...V, gestores: ["g1", "g2"] }, CTX)),
    ).toEqual(["Ana", "Bia"]);
    expect(nomes(filtrar(todas, { ...V, gestores: [SEM_VALOR] }, CTX))).toEqual(
      ["Caio"],
    );
    for (const [grupo, valor, quem] of [
      ["cargos", "c2", "Bia"],
      ["areas", "a1", "Ana"],
      ["centrosCusto", "cc1", "Ana"],
      ["niveis", "pleno", "Ana"],
      ["generos", "feminino", "Ana"],
      ["unidades", "u1", "Ana"],
      ["turnos", "t-Loja", "Bia"],
    ] as const) {
      expect(nomes(filtrar(todas, { ...V, [grupo]: [valor] }, CTX))).toEqual([
        quem,
      ]);
    }
  });

  it("marcar, contar, resumir e as pílulas dos filtros aplicados", () => {
    let f = alternarOpcao(V, "cargos", "c1");
    f = alternarOpcao(f, "cargos", "c2");
    f = { ...f, semEscala: true };
    expect(quantosFiltros(f)).toBe(3);
    expect(alternarOpcao(f, "cargos", "c1").cargos).toEqual(["c2"]);
    const opcoes = opcoesDo(todas, "cargos", V, CTX, ROTULOS);
    expect(resumoDoGrupo(opcoes, f.cargos, "Todos")).toBe(
      "Analista, Estagiária",
    );
    expect(resumoDoGrupo(opcoes, [], "Todos")).toBe("Todos");
    const aplicados = filtrosAplicados(
      todas,
      { ...f, gestores: [SEM_VALOR] },
      CTX,
      ROTULOS,
    );
    expect(aplicados.map((a) => a.texto)).toEqual([
      "Sem escala",
      "Gestor: Sem gestor",
      "Cargo: Analista",
      "Cargo: Estagiária",
    ]);
    // Cada pílula tira só o dela.
    expect(aplicados[2]!.sem.cargos).toEqual(["c2"]);
    expect(aplicados[0]!.sem.semEscala).toBe(false);
  });
});
