import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_PRINCIPAIS,
  ESTADOS_DO_DOCUMENTO,
  LIMITE_DE_OUTROS,
  ROTULO_DA_CATEGORIA,
  conferirArquivoEscolhido,
  conferirNomeDeOutros,
  estadoDaApi,
  principaisEnviados,
  rotuloDoDocumento,
  tamanhoLegivel,
} from "./documentosDoColaborador";

/** T213 — regras do navegador para os documentos do colaborador. */

const arquivo = (nome: string, tipo: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], nome, { type: tipo });

describe("categorias e rótulos (T213)", () => {
  it("os cinco principais, na ordem da etapa", () => {
    expect(CATEGORIAS_PRINCIPAIS.map((c) => ROTULO_DA_CATEGORIA[c])).toEqual([
      "RG",
      "CPF",
      "Comprovante de endereço",
      "Carteira de Trabalho",
      "Certidões",
    ]);
  });

  it("o rótulo de Outros é o nome dado; sem nome (master), 'Outros'", () => {
    expect(rotuloDoDocumento("outros", "Contrato")).toBe("Contrato");
    expect(rotuloDoDocumento("outros", null)).toBe("Outros");
    expect(rotuloDoDocumento("cpf", null)).toBe("CPF");
  });
});

describe("estados (T213)", () => {
  it("cinco estados, cada um com texto (nunca só cor)", () => {
    expect(ESTADOS_DO_DOCUMENTO.map((e) => e.rotulo)).toEqual([
      "Pendente",
      "Em verificação",
      "Aprovado",
      "Reprovado",
      "Não enviado",
    ]);
    for (const estado of ESTADOS_DO_DOCUMENTO) {
      expect(estado.rotulo.length).toBeGreaterThan(0);
    }
  });

  it("estado da API vira estado da tela", () => {
    expect(estadoDaApi("em_verificacao")).toBe("em_verificacao");
    expect(estadoDaApi("aprovado")).toBe("aprovado");
    expect(estadoDaApi("reprovado")).toBe("reprovado");
  });
});

describe("conferirArquivoEscolhido (T213)", () => {
  it.each([
    ["rg.pdf", "application/pdf"],
    ["foto.JPG", "image/jpeg"],
    ["foto.jpeg", "image/jpeg"],
    ["scan.png", "image/png"],
  ])("%s: aceito", (nome, tipo) => {
    expect(conferirArquivoEscolhido(arquivo(nome, tipo))).toBeNull();
  });

  it.each([
    [
      "contrato.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["foto.heic", "image/heic"],
    ["sem-extensao", "application/pdf"],
    ["falso.pdf", "image/png"],
  ])("%s: recusado pelo formato", (nome, tipo) => {
    expect(conferirArquivoEscolhido(arquivo(nome, tipo))).toMatch(
      /PDF, JPG ou PNG/,
    );
  });

  it("vazio e acima de 10 MB: recusados", () => {
    expect(
      conferirArquivoEscolhido(arquivo("a.pdf", "application/pdf", 0)),
    ).toMatch(/vazio/);
    expect(
      conferirArquivoEscolhido(
        arquivo("a.pdf", "application/pdf", 10 * 1024 * 1024 + 1),
      ),
    ).toMatch(/10 MB/);
  });
});

describe("conferirNomeDeOutros (T213)", () => {
  it("aceita nome curto; recusa vazio, longo e repetido", () => {
    expect(conferirNomeDeOutros("Contrato", [])).toBeNull();
    expect(conferirNomeDeOutros("   ", [])).toMatch(/nome/);
    expect(conferirNomeDeOutros("x".repeat(61), [])).toMatch(/60/);
    expect(conferirNomeDeOutros(" contrato ", ["Contrato"])).toMatch(
      /Já existe/,
    );
  });

  it(`até ${LIMITE_DE_OUTROS} outros documentos`, () => {
    const existentes = Array.from(
      { length: LIMITE_DE_OUTROS },
      (_, i) => `D${i}`,
    );
    expect(conferirNomeDeOutros("Novo", existentes)).toMatch(
      new RegExp(String(LIMITE_DE_OUTROS)),
    );
  });
});

describe("tamanhoLegivel (T213)", () => {
  it("KB inteiros abaixo de 1 MB; MB com uma casa e vírgula, sem ',0'", () => {
    expect(tamanhoLegivel(10)).toBe("1 KB");
    expect(tamanhoLegivel(2048)).toBe("2 KB");
    expect(tamanhoLegivel(2.4 * 1024 * 1024)).toBe("2,4 MB");
    expect(tamanhoLegivel(10 * 1024 * 1024)).toBe("10 MB");
  });
});

describe('principaisEnviados (T215, como a referência: "N de 5 enviados")', () => {
  const d = (categoria: string, estado: string) =>
    ({ categoria, estado }) as Parameters<typeof principaisEnviados>[0][number];

  it("conta as categorias principais com arquivo; reprovado e Outros não contam", () => {
    expect(principaisEnviados([])).toBe(0);
    expect(
      principaisEnviados([
        d("rg", "aprovado"),
        d("rg", "em_verificacao"),
        d("cpf", "em_verificacao"),
        d("certidoes", "reprovado"),
        d("outros", "aprovado"),
      ]),
    ).toBe(2);
    expect(
      principaisEnviados(CATEGORIAS_PRINCIPAIS.map((c) => d(c, "aprovado"))),
    ).toBe(5);
  });
});
