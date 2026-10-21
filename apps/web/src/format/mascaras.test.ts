/**
 * T179 — máscaras de CEP e telefone, sem tela: digitar, colar, editar no
 * meio, apagar sobre separador e limites. Números sintéticos.
 */
import { describe, expect, it } from "vitest";
import {
  apagarComSeparador,
  aplicarMascara,
  colarNaMascara,
  digitosNacionaisDoTelefone,
  exibirCep,
  exibirTelefone,
  mascararCep,
  mascararTelefone,
  posicaoAposDigitos,
} from "./mascaras";

/** Digita `texto` caractere a caractere no fim do campo, como o teclado. */
function digitar(
  tipo: "cep" | "telefone",
  texto: string,
  inicial = "",
): string {
  let valor = inicial;
  for (const tecla of texto) {
    const entrada = valor + tecla;
    valor = aplicarMascara(tipo, valor, entrada, entrada.length).valor;
  }
  return valor;
}

describe("T179 — máscara de CEP", () => {
  it.each([
    ["3", "3"],
    ["30140", "30140"],
    ["301400", "30140-0"],
    ["30140071", "30140-071"],
  ])("progressiva: %p vira %p", (digitos, esperado) => {
    expect(mascararCep(digitos)).toBe(esperado);
    expect(digitar("cep", digitos)).toBe(esperado);
  });

  it("não aceita o 9º dígito digitado: o valor fica como estava", () => {
    const r = aplicarMascara("cep", "30140-071", "30140-0712", 10);
    expect(r).toEqual({ valor: "30140-071", cursor: 9 });
  });

  it("letras e pontuação colada somem; o excesso do fim é descartado", () => {
    expect(colarNaMascara("cep", "", 0, 0, " 30.140-071 ")).toEqual({
      valor: "30140-071",
      cursor: 9,
    });
    expect(colarNaMascara("cep", "", 0, 0, "301400719999").valor).toBe(
      "30140-071",
    );
  });

  it("Backspace logo depois do hífen apaga o dígito anterior", () => {
    // Cursor em "30140-|071".
    expect(apagarComSeparador("cep", "30140-071", 6, 6, "Backspace")).toEqual({
      valor: "30140-71",
      cursor: 4,
    });
  });

  it("Delete logo antes do hífen apaga o dígito seguinte", () => {
    // Cursor em "30140|-071".
    expect(apagarComSeparador("cep", "30140-071", 5, 5, "Delete")).toEqual({
      valor: "30140-71",
      cursor: 5,
    });
  });

  it("exibe o CEP gravado em 8 dígitos como 00000-000, só no Brasil", () => {
    expect(exibirCep("30140071", true)).toBe("30140-071");
    expect(exibirCep("30140-071", true)).toBe("30140-071");
    expect(exibirCep("1000-001", false)).toBe("1000-001");
    expect(exibirCep("30140071", false)).toBe("30140071");
    expect(exibirCep("ABC 123", true)).toBe("ABC 123");
  });
});

describe("T179 — máscara de telefone", () => {
  it.each([
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["113000", "(11) 3000"],
    ["1130000", "(11) 3000-0"],
    ["1130000000", "(11) 3000-0000"],
    ["11987654321", "(11) 98765-4321"],
  ])("progressiva: %p vira %p", (digitos, esperado) => {
    expect(mascararTelefone(digitos)).toBe(esperado);
    expect(digitar("telefone", digitos)).toBe(esperado);
  });

  it("o 11º dígito muda a forma de fixo para celular", () => {
    expect(digitar("telefone", "1", "(11) 9876-5432")).toBe("(11) 98765-4321");
  });

  it("não aceita o 12º dígito digitado", () => {
    const r = aplicarMascara(
      "telefone",
      "(11) 98765-4321",
      "(11) 98765-43219",
      16,
    );
    expect(r).toEqual({ valor: "(11) 98765-4321", cursor: 15 });
  });

  it.each([
    ["+55 11 98765-4321"],
    ["+55 (11) 98765-4321"],
    ["5511987654321"],
    ["11987654321"],
    ["(11) 98765-4321"],
    ["+5511987654321"],
  ])("colar %p dá o número nacional, sem o 55 do país", (colado) => {
    expect(colarNaMascara("telefone", "", 0, 0, colado)).toEqual({
      valor: "(11) 98765-4321",
      cursor: 15,
    });
    // O mesmo texto chegando inteiro por `onChange` (preenchimento, arrastar).
    expect(aplicarMascara("telefone", "", colado, colado.length).valor).toBe(
      "(11) 98765-4321",
    );
  });

  it("com 10 ou 11 dígitos, o 55 inicial é DDD e fica", () => {
    expect(digitosNacionaisDoTelefone("5598765432")).toBe("5598765432");
    expect(digitosNacionaisDoTelefone("55987654321")).toBe("55987654321");
    expect(digitosNacionaisDoTelefone("551130000000")).toBe("1130000000");
  });

  it("editar no meio mantém o cursor logo depois do dígito digitado", () => {
    // "(11) 3000-|0000" → digita 5 → "(11) 3000-50000": 11 dígitos, vira
    // celular; o cursor fica depois do "5".
    const r = aplicarMascara(
      "telefone",
      "(11) 3000-0000",
      "(11) 3000-50000",
      11,
    );
    expect(r.valor).toBe("(11) 30005-0000");
    expect(r.valor.slice(0, r.cursor)).toBe("(11) 30005");
  });

  it("apagar no meio com Backspace comum reformata e preserva o cursor pelos dígitos", () => {
    // "(11) 98765-|4321": o navegador apaga o "-"? Não: aqui o Backspace
    // apaga o "5" de "(11) 98765|-4321".
    const r = aplicarMascara(
      "telefone",
      "(11) 98765-4321",
      "(11) 9876-4321",
      9,
    );
    expect(r.valor).toBe("(11) 9876-4321");
    expect(r.valor.slice(0, r.cursor)).toBe("(11) 9876");
  });

  it("Backspace sobre o espaço, o parêntese e o hífen apaga o dígito anterior", () => {
    // "(11) |9" — antes do cursor há o espaço.
    expect(apagarComSeparador("telefone", "(11) 9", 5, 5, "Backspace")).toEqual(
      { valor: "(19", cursor: 2 },
    );
    // "(11) 98765-|4321"
    const r = apagarComSeparador(
      "telefone",
      "(11) 98765-4321",
      11,
      11,
      "Backspace",
    )!;
    expect(r.valor).toBe("(11) 9876-4321");
    expect(r.valor.slice(0, r.cursor)).toBe("(11) 9876");
  });

  it("Delete sobre separador apaga o dígito seguinte", () => {
    // "(11|) 98765-4321"
    const r = apagarComSeparador(
      "telefone",
      "(11) 98765-4321",
      3,
      3,
      "Delete",
    )!;
    expect(r.valor).toBe("(11) 8765-4321");
    expect(r.valor.slice(0, r.cursor)).toBe("(11");
  });

  it("com seleção, ou vizinho dígito, a tecla segue o normal", () => {
    expect(
      apagarComSeparador("telefone", "(11) 9876", 1, 4, "Backspace"),
    ).toBeNull();
    expect(
      apagarComSeparador("telefone", "(11) 9876", 3, 3, "Backspace"),
    ).toBeNull();
    expect(
      apagarComSeparador("telefone", "(11) 9876", 6, 6, "Delete"),
    ).toBeNull();
  });

  it("Backspace no início, só com separador antes, não apaga nada", () => {
    expect(apagarComSeparador("telefone", "(11", 1, 1, "Backspace")).toEqual({
      valor: "(11",
      cursor: 1,
    });
  });

  it("colar no meio substitui só a seleção", () => {
    // "(11) |9876|-5432" selecionado, cola "1234".
    const r = colarNaMascara("telefone", "(11) 9876-5432", 5, 9, "1234");
    expect(r.valor).toBe("(11) 1234-5432");
    expect(r.valor.slice(0, r.cursor)).toBe("(11) 1234");
  });

  it("exibe o gravado (+55) na forma brasileira; o resto, como veio", () => {
    expect(exibirTelefone("+5511987654321")).toBe("(11) 98765-4321");
    expect(exibirTelefone("+551130000000")).toBe("(11) 3000-0000");
    expect(exibirTelefone("1133330001")).toBe("(11) 3333-0001");
    expect(exibirTelefone("+442079460958")).toBe("+442079460958");
    expect(exibirTelefone("12345")).toBe("12345");
    expect(exibirTelefone(null)).toBe("");
  });

  it("posição depois do n-ésimo dígito", () => {
    expect(posicaoAposDigitos("(11) 98765-4321", 0)).toBe(0);
    expect(posicaoAposDigitos("(11) 98765-4321", 2)).toBe(3);
    expect(posicaoAposDigitos("(11) 98765-4321", 3)).toBe(6);
    expect(posicaoAposDigitos("(11) 98765-4321", 99)).toBe(15);
  });
});
