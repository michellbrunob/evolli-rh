import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_PRINCIPAIS,
  ESTADOS_DO_DOCUMENTO,
  LIMITE_DE_OUTROS,
  ROTULO_DA_CATEGORIA,
  conferirArquivoEscolhido,
  conferirNomeDeOutros,
  estadoDaApi,
  ordenarPorEnvio,
  podeVerNoNavegador,
  principaisEnviados,
  quemEnviou,
  resumoDosDocumentos,
  rotuloDoDocumento,
  tamanhoLegivel,
  tipoDoArquivo,
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
    ["contrato.doc", "application/msword"],
    [
      "contrato.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["foto.webp", "image/webp"],
    ["contrato.DOCX", ""],
  ])("%s: aceito", (nome, tipo) => {
    expect(conferirArquivoEscolhido(arquivo(nome, tipo))).toBeNull();
  });

  it.each([
    ["foto.heic", "image/heic"],
    ["planilha.xlsx", "application/vnd.ms-excel"],
    ["sem-extensao", "application/pdf"],
    ["falso.pdf", "image/png"],
    ["falso.docx", "application/pdf"],
  ])("%s: recusado pelo formato", (nome, tipo) => {
    expect(conferirArquivoEscolhido(arquivo(nome, tipo))).toBe(
      "Envie o arquivo em PDF, DOC, DOCX, JPG, PNG ou WebP.",
    );
  });

  it("vazio: recusado", () => {
    expect(
      conferirArquivoEscolhido(arquivo("a.pdf", "application/pdf", 0)),
    ).toMatch(/vazio/);
  });

  it("T217 — acima de 10 MB: diz o tamanho do arquivo, o limite e o que fazer", () => {
    expect(
      conferirArquivoEscolhido(
        arquivo("a.pdf", "application/pdf", 12.4 * 1024 * 1024),
      ),
    ).toBe(
      "Este arquivo tem 12,4 MB e o limite é 10 MB. Diminua o tamanho ou converta para PDF antes de enviar.",
    );
    expect(
      conferirArquivoEscolhido(
        arquivo("a.png", "image/png", 10 * 1024 * 1024 + 1),
      ),
    ).toMatch(/^Este arquivo tem 10 MB e o limite é 10 MB\./);
    expect(
      conferirArquivoEscolhido(
        arquivo("a.pdf", "application/pdf", 10 * 1024 * 1024),
      ),
    ).toBeNull();
  });
});

describe("tipoDoArquivo (T217)", () => {
  it("usa o tipo do navegador; sem ele, o da extensão", () => {
    expect(tipoDoArquivo(arquivo("a.pdf", "application/pdf"))).toBe(
      "application/pdf",
    );
    expect(tipoDoArquivo(arquivo("a.docx", ""))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(tipoDoArquivo(arquivo("a.DOC", ""))).toBe("application/msword");
    expect(tipoDoArquivo(arquivo("a.webp", ""))).toBe("image/webp");
    expect(tipoDoArquivo(arquivo("sem", ""))).toBe("");
  });
});

describe("podeVerNoNavegador (T217)", () => {
  it("PDF e imagens abrem no navegador; DOC e DOCX só baixam", () => {
    expect(podeVerNoNavegador("pdf")).toBe(true);
    expect(podeVerNoNavegador("jpg")).toBe(true);
    expect(podeVerNoNavegador("png")).toBe(true);
    expect(podeVerNoNavegador("webp")).toBe(true);
    expect(podeVerNoNavegador("doc")).toBe(false);
    expect(podeVerNoNavegador("docx")).toBe(false);
  });
});

describe("quemEnviou (T217)", () => {
  it("nome e papel entre parênteses; sem nome, só o papel; sem autor, travessão", () => {
    expect(quemEnviou({ nome: "Ana Souza", papel: "rh" })).toBe(
      "Ana Souza (RH)",
    );
    expect(quemEnviou({ nome: "Bruno Lima", papel: "dp" })).toBe(
      "Bruno Lima (DP)",
    );
    expect(quemEnviou({ nome: null, papel: "dp" })).toBe("DP");
    expect(quemEnviou({ nome: "Carla", papel: "papel_novo" })).toBe(
      "Carla (papel_novo)",
    );
    expect(quemEnviou(null)).toBe("—");
  });
});

const doc = (enviadoEm: string, id = enviadoEm) => ({ id, enviadoEm });

describe("ordenarPorEnvio (T217)", () => {
  it("do envio mais recente para o mais antigo, sem mudar a lista original", () => {
    const lista = [
      doc("2026-11-20T10:00:00.000Z", "a"),
      doc("2026-11-28T09:00:00.000Z", "b"),
      doc("2026-11-25T23:30:00.000Z", "c"),
    ];
    expect(ordenarPorEnvio(lista).map((d) => d.id)).toEqual(["b", "c", "a"]);
    expect(lista.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("empate: mantém a ordem recebida", () => {
    const lista = [
      doc("2026-11-28T09:00:00.000Z", "x"),
      doc("2026-11-28T09:00:00.000Z", "y"),
      doc("2026-11-28T09:00:00.000Z", "z"),
    ];
    expect(ordenarPorEnvio(lista).map((d) => d.id)).toEqual(["x", "y", "z"]);
  });
});

describe("resumoDosDocumentos (T217)", () => {
  it("sem arquivos: frase própria", () => {
    expect(resumoDosDocumentos([])).toBe("Nada enviado ainda");
  });

  it("plural pela quantidade e o dia do último envio (fuso de Brasília)", () => {
    expect(resumoDosDocumentos([doc("2026-11-28T13:00:00.000Z")])).toBe(
      "1 arquivo · último envio em 28/11/2026",
    );
    expect(
      resumoDosDocumentos([
        doc("2026-11-20T10:00:00.000Z"),
        // 01:30 em UTC ainda é dia 25 em Brasília.
        doc("2026-11-26T01:30:00.000Z"),
        doc("2026-11-21T10:00:00.000Z"),
      ]),
    ).toBe("3 arquivos · último envio em 25/11/2026");
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
