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
    // T179 (B2) — recusado com sinal, para o campo avisar.
    expect(r).toEqual({ valor: "30140-071", cursor: 9, recusado: true });
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
    expect(r).toEqual({ valor: "(11) 98765-4321", cursor: 15, recusado: true });
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

describe("T179 (B1) — telefone digitado tecla a tecla com o código do país", () => {
  it.each([
    ["+55 11 98765-4321", "(11) 98765-4321"],
    ["+55 91 98765-4321", "(91) 98765-4321"],
    ["+55 (91) 98765-4321", "(91) 98765-4321"],
    ["+5511987654321", "(11) 98765-4321"],
    ["+55 21 3333-4444", "(21) 3333-4444"],
  ])("digitar %p dá o mesmo que colar: %p", (texto, esperado) => {
    expect(digitar("telefone", texto)).toBe(esperado);
    expect(colarNaMascara("telefone", "", 0, 0, texto).valor).toBe(esperado);
  });

  it("sem o +, 13 dígitos começando por 55 que chegam INTEIROS (colagem, preenchimento) são o país", () => {
    expect(colarNaMascara("telefone", "", 0, 0, "5511987654321").valor).toBe(
      "(11) 98765-4321",
    );
    expect(colarNaMascara("telefone", "", 0, 0, "5591987654321").valor).toBe(
      "(91) 98765-4321",
    );
    expect(aplicarMascara("telefone", "", "5591987654321", 13).valor).toBe(
      "(91) 98765-4321",
    );
  });

  it("T179 (B2): sem o +, tecla a tecla, o país não entra — o número completo de DDD 55 recusa o excedente", () => {
    // Tecla a tecla, `55` + 9 dígitos JÁ é um número completo de DDD 55: o
    // 12º dígito é recusado (com aviso), em vez de reinterpretar o 55 como
    // país. O país, por teclado, se informa com `+`.
    let valor = "";
    let recusado = false;
    for (const tecla of "5591987654321") {
      const entrada = valor + tecla;
      const r = aplicarMascara("telefone", valor, entrada, entrada.length);
      valor = r.valor;
      recusado = recusado || r.recusado === true;
    }
    expect(valor).toBe("(55) 91987-6543");
    expect(recusado).toBe(true);
  });

  it("número nacional com DDD 55 continua com DDD 55", () => {
    expect(digitar("telefone", "55999998888")).toBe("(55) 99999-8888");
    expect(digitar("telefone", "5532221111")).toBe("(55) 3222-1111");
  });

  it("enquanto só há +, +5 ou +55, o campo mostra o que foi digitado", () => {
    expect(digitar("telefone", "+")).toBe("+");
    expect(digitar("telefone", "+5")).toBe("+5");
    expect(digitar("telefone", "+55")).toBe("+55");
    expect(digitar("telefone", "+55 ")).toBe("+55");
    expect(digitar("telefone", "+551")).toBe("(1");
  });

  it("+ de outro país fica como veio, sem máscara: nada de DDD inventado", () => {
    expect(digitar("telefone", "+1 202 555 0100")).toBe("+12025550100");
    expect(digitar("telefone", "+51")).toBe("+51");
  });

  it("nenhum dígito se perde e o 12º dígito de um número nacional continua recusado", () => {
    expect(digitar("telefone", "1", "(11) 98765-4321")).toBe("(11) 98765-4321");
    expect(
      digitar("telefone", "+55 91 98765-4321").replace(/[^0-9]/g, ""),
    ).toBe("91987654321");
  });

  it("Backspace e Delete com o + no campo seguem o normal", () => {
    expect(apagarComSeparador("telefone", "+", 1, 1, "Backspace")).toBeNull();
    expect(apagarComSeparador("telefone", "+55", 0, 0, "Delete")).toBeNull();
    expect(aplicarMascara("telefone", "+", "", 0)).toEqual({
      valor: "",
      cursor: 0,
    });
  });
});

describe("T179 (B2) — colar depois de +, +5 ou +55, e DDD 55 completo", () => {
  /** Digita `texto` e, no fim, cola `colado`, como o navegador faria. */
  function digitarEColar(texto: string, colado: string) {
    const valor = digitar("telefone", texto);
    return colarNaMascara(
      "telefone",
      valor,
      valor.length,
      valor.length,
      colado,
    );
  }

  it.each([
    ["+", "55 91 98765-4321"],
    ["+5", "5 91 98765-4321"],
    ["+55", "91 98765-4321"],
    ["+55", " 91 98765-4321"],
    ["+55", "+55 91 98765-4321"],
    ["+55", "5591987654321"],
  ])("digitar %p e colar %p dá (91) 98765-4321", (texto, colado) => {
    const r = digitarEColar(texto, colado);
    expect(r.valor).toBe("(91) 98765-4321");
    expect(r.recusado).toBeUndefined();
  });

  it("colar em campo vazio, com ou sem o país, dá o mesmo número", () => {
    for (const colado of [
      "+55 91 98765-4321",
      "5591987654321",
      "91 98765-4321",
      "(91) 98765-4321",
    ]) {
      expect(colarNaMascara("telefone", "", 0, 0, colado).valor).toBe(
        "(91) 98765-4321",
      );
    }
  });

  it("com DDD comum também: +55 e colar 11 98765-4321", () => {
    expect(digitarEColar("+55", "11 98765-4321").valor).toBe("(11) 98765-4321");
  });

  it("+55 e colar um número de DDD 55 mantém o DDD 55", () => {
    expect(digitarEColar("+55", "55 99999-8888").valor).toBe("(55) 99999-8888");
  });

  it("+ e colar um número sem o 55 não inventa o Brasil: fica como veio e é recusado na validação", () => {
    expect(digitarEColar("+", "91 98765-4321").valor).toBe("+91987654321");
  });

  it("colar número estrangeiro com + fica sem máscara, mesmo que pareça brasileiro", () => {
    expect(colarNaMascara("telefone", "", 0, 0, "+49 911 1234567").valor).toBe(
      "+499111234567",
    );
    expect(
      colarNaMascara("telefone", "(11) 9", 6, 6, "+49 911 1234567").valor,
    ).toBe("+499111234567");
  });

  it("colagem que passa de 11 dígitos é recusada com sinal, e o valor fica", () => {
    expect(digitarEColar("+55", "91 98765-43210")).toEqual({
      valor: "+55",
      cursor: 3,
      recusado: true,
    });
    const cheio = "(11) 98765-4321";
    expect(colarNaMascara("telefone", cheio, 15, 15, "12")).toEqual({
      valor: cheio,
      cursor: 15,
      recusado: true,
    });
  });

  it("DDD 55 completo: dígito a mais no fim ou no meio é recusado e o número fica", () => {
    const completo = digitar("telefone", "55999998888");
    expect(completo).toBe("(55) 99999-8888");
    for (const extra of ["1", "12"]) {
      let valor = completo;
      let recusado = false;
      for (const tecla of extra) {
        const entrada = valor + tecla;
        const r = aplicarMascara("telefone", valor, entrada, entrada.length);
        valor = r.valor;
        recusado = recusado || r.recusado === true;
      }
      expect(valor).toBe(completo);
      expect(recusado).toBe(true);
    }
    const meio = aplicarMascara("telefone", completo, "(55) 999919-8888", 10);
    expect(meio.valor).toBe(completo);
    expect(meio.recusado).toBe(true);
  });

  it("DDD 55 fixo completo ainda pode virar celular com o 11º dígito, como qualquer DDD", () => {
    expect(digitar("telefone", "5532221111")).toBe("(55) 3222-1111");
    expect(digitar("telefone", "5532221111" + "1")).toBe("(55) 32221-1111");
  });
});
