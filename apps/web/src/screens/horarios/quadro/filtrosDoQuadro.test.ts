import { describe, expect, it } from "vitest";
import {
  FILTROS_DO_QUADRO_VAZIOS,
  SEM_VALOR,
  alternarOpcao,
  filtrar,
  opcoesDo,
  quantosFiltros,
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
  escalas: [escala({ turno: turno("Loja") })],
});
const caio = pessoa("Caio");
const todas = [ana, bia, caio];

describe("T215 — filtros do quadro", () => {
  it("opções com contagem: 'Não informado' primeiro, depois em ordem alfabética", () => {
    expect(opcoesDo(todas, "departamentos", REF, ROTULOS)).toEqual([
      { valor: SEM_VALOR, rotulo: "Não informado", quantas: 1 },
      { valor: "d-mk", rotulo: "Marketing", quantas: 1 },
      { valor: "d-ti", rotulo: "Tecnologia", quantas: 1 },
    ]);
    expect(opcoesDo(todas, "tipos", REF, ROTULOS)).toEqual([
      { valor: "clt", rotulo: "CLT", quantas: 2 },
      { valor: "estagio", rotulo: "Estágio", quantas: 1 },
    ]);
    expect(
      opcoesDo(todas, "turnos", REF, ROTULOS).map((o) => [o.rotulo, o.quantas]),
    ).toEqual([
      ["Sem turno", 1],
      ["Comercial", 1],
      ["Loja", 1],
    ]);
    expect(opcoesDo(todas, "nivel", REF, ROTULOS).map((o) => o.rotulo)).toEqual(
      ["Não informado", "Pleno"],
    );
  });

  it("sem filtro, todas; atalho Sem escala", () => {
    expect(filtrar(todas, FILTROS_DO_QUADRO_VAZIOS, REF)).toHaveLength(3);
    expect(semEscala(caio)).toBe(true);
    expect(
      filtrar(todas, { ...FILTROS_DO_QUADRO_VAZIOS, semEscala: true }, REF),
    ).toEqual([caio]);
  });

  it("lista: várias opções = qualquer uma; 'Não informado' é uma opção; grupos se somam", () => {
    let f = alternarOpcao(FILTROS_DO_QUADRO_VAZIOS, "departamentos", "d-ti");
    f = alternarOpcao(f, "departamentos", SEM_VALOR);
    expect(filtrar(todas, f, REF)).toEqual([ana, caio]);
    f = alternarOpcao(f, "tipos", "clt");
    expect(filtrar(todas, f, REF)).toEqual([ana, caio]);
    f = alternarOpcao(f, "turnos", "t-Comercial");
    expect(filtrar(todas, f, REF)).toEqual([ana]);
    // Desmarcar devolve.
    f = alternarOpcao(f, "turnos", "t-Comercial");
    expect(filtrar(todas, f, REF)).toEqual([ana, caio]);
    expect(quantosFiltros(f)).toBe(3);
  });

  it("seletores: gestor, cargo, área, centro de custo, nível e gênero", () => {
    for (const [grupo, valor] of [
      ["gestor", "g1"],
      ["cargo", "c1"],
      ["area", "a1"],
      ["centroCusto", "cc1"],
      ["nivel", "pleno"],
      ["genero", "feminino"],
    ] as const) {
      const f = { ...FILTROS_DO_QUADRO_VAZIOS, [grupo]: valor };
      expect(filtrar(todas, f, REF)).toEqual([ana]);
      expect(quantosFiltros(f)).toBe(1);
      expect(
        filtrar(
          todas,
          { ...FILTROS_DO_QUADRO_VAZIOS, [grupo]: SEM_VALOR },
          REF,
        ),
      ).toEqual([bia, caio]);
    }
  });
});
