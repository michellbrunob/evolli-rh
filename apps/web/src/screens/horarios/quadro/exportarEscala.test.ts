import { describe, expect, it } from "vitest";
import type { DiaGravadoApi } from "../../../api/escalaClient";
import { lerAbasXlsx } from "../../pessoas/importacao/planilhaXlsx";
import {
  type ContextoDaExportacao,
  type OpcoesDaExportacao,
  gerarArquivoDaEscala,
  legendaDosTurnos,
  mudancasForaDoArquivo,
  nomeDoArquivoDaEscala,
  nomeParaArquivo,
  paginasDaEquipe,
  pdfDaEquipe,
  pdfDaPessoa,
  pessoasPublicadas,
  planilhaDaEscala,
  resumoDaPessoa,
  textoDaCelula,
  tituloDaExportacao,
} from "./exportarEscala";
import { escala, pessoa } from "./fixturasDoQuadro";
import { celulaDoDia, diasDoPeriodo } from "./quadroDaEscala";

const SEMANA = diasDoPeriodo("2026-12-07", "2026-12-13");

function dia(d: string, extra: Partial<DiaGravadoApi> = {}): DiaGravadoApi {
  return {
    dia: d,
    camada: "publicado",
    tipo: "trabalho",
    turno: { id: "t-c", nome: "Comercial", cor: "azul", sigla: "C" },
    periodos: [{ inicio: "09:00", fim: "18:00" }],
    intervaloMinutos: 60,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

function opcoes(extra: Partial<OpcoesDaExportacao> = {}): OpcoesDaExportacao {
  return {
    formato: "pdf",
    periodo: "semana",
    inicio: "2026-12-07",
    fim: "2026-12-13",
    separarPor: "unidade",
    zipPorPessoa: false,
    horas: true,
    legenda: true,
    assinatura: true,
    avisos: false,
    ...extra,
  };
}

const CTX: ContextoDaExportacao = {
  empresa: "Empresa Sintética",
  publicacao: {
    id: "p",
    inicio: "2026-12-07",
    fim: "2026-12-13",
    novas: 2,
    alteradas: 0,
    pessoas: 1,
    avisar: false,
    publicadaEm: "2026-11-24T15:00:00.000Z",
    publicadaPor: "RH Teste",
  },
  regras: undefined,
  geradoEm: "25/11/2026 às 12:54",
};

const ANA = pessoa("Ana Lima", {
  colaboradorId: "c-ana",
  unidade: { id: "u1", nome: "Matriz" },
  departamento: { id: "d1", nome: "Loja" },
  escalas: [escala()],
  dias: [
    dia("2026-12-07"),
    dia("2026-12-08", {
      tipo: "dsr",
      turno: null,
      periodos: [],
      intervaloMinutos: 0,
    }),
    dia("2026-12-09", {
      camada: "rascunho",
      tipo: "folga",
      turno: null,
      periodos: [],
    }),
  ],
});
const BRUNO = pessoa("Bruno Reis", {
  colaboradorId: "c-bruno",
  unidade: { id: "u2", nome: "Filial" },
  departamento: { id: "d1", nome: "Loja" },
  escalas: [escala()],
  dias: [dia("2026-12-10")],
});
// Só padrão e rascunho: não sai no arquivo.
const CAIO = pessoa("Caio Souza", {
  escalas: [escala()],
  dias: [dia("2026-12-07", { camada: "rascunho" })],
});

const texto = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("T215 — Exportar a escala", () => {
  it("só o publicado: quem não tem publicação fica fora; o rascunho e o padrão não entram", () => {
    const ps = pessoasPublicadas([ANA, BRUNO, CAIO], SEMANA);
    expect(ps.map((p) => p.nome)).toEqual(["Ana Lima", "Bruno Reis"]);
    const ana = ps[0]!;
    expect(SEMANA.map((d) => celulaDoDia(ana, d).tipo)).toEqual([
      "trabalho",
      "dsr",
      "sem-escala",
      "sem-escala",
      "sem-escala",
      "sem-escala",
      "sem-escala",
    ]);
    expect(mudancasForaDoArquivo([ANA, BRUNO, CAIO], SEMANA)).toBe(2);
    expect(
      pessoasPublicadas([ANA], diasDoPeriodo("2026-12-14", "2026-12-20")),
    ).toEqual([]);
  });

  it("nomes do arquivo e títulos", () => {
    expect(nomeDoArquivoDaEscala(opcoes())).toBe(
      "escala-semana-2026-12-07.pdf",
    );
    expect(nomeDoArquivoDaEscala(opcoes({ formato: "xlsx" }))).toBe(
      "escala-semana-2026-12-07.xlsx",
    );
    expect(
      nomeDoArquivoDaEscala(
        opcoes({ separarPor: "pessoa", zipPorPessoa: true }),
      ),
    ).toBe("escala-semana-2026-12-07.zip");
    expect(nomeDoArquivoDaEscala(opcoes({ separarPor: "pessoa" }))).toBe(
      "escala-semana-2026-12-07.pdf",
    );
    expect(
      nomeDoArquivoDaEscala(opcoes({ periodo: "mes", inicio: "2026-12-01" })),
    ).toBe("escala-mes-2026-12-01.pdf");
    // O .zip só vale com uma página por pessoa.
    expect(nomeDoArquivoDaEscala(opcoes({ zipPorPessoa: true }))).toBe(
      "escala-semana-2026-12-07.pdf",
    );
    expect(nomeParaArquivo("Ana  Lima-Souza Ç")).toBe("ana-lima-souza-c");
    expect(nomeParaArquivo("***")).toBe("pessoa");
    expect(tituloDaExportacao(opcoes())).toBe(
      "Escala da semana · 7 a 13 de dezembro de 2026",
    );
    expect(
      tituloDaExportacao(
        opcoes({ periodo: "dia", inicio: "2026-12-07", fim: "2026-12-07" }),
      ),
    ).toBe("Escala do dia · 07/12/2026");
    expect(
      tituloDaExportacao(
        opcoes({ periodo: "mes", inicio: "2026-12-01", fim: "2026-12-31" }),
      ),
    ).toBe("Escala do mês · Dezembro de 2026");
  });

  it("o texto de cada célula", () => {
    const folga = pessoa("F", {
      dias: [dia("2026-12-07", { tipo: "folga", turno: null, periodos: [] })],
    });
    expect(textoDaCelula(celulaDoDia(folga, "2026-12-07"))).toBe("Folga");
    const ana = pessoasPublicadas([ANA], SEMANA)[0]!;
    expect(textoDaCelula(celulaDoDia(ana, "2026-12-07"))).toBe(
      "Comercial 09:00–18:00",
    );
    expect(textoDaCelula(celulaDoDia(ana, "2026-12-08"))).toBe("DSR");
    expect(textoDaCelula(celulaDoDia(ana, "2026-12-09"))).toBe("");
  });

  it("páginas: por unidade (com departamentos), por departamento, por pessoa e sem separar", () => {
    const ps = pessoasPublicadas([ANA, BRUNO], SEMANA);
    expect(
      paginasDaEquipe(ps, "unidade", SEMANA).map((p) => [
        p.nome,
        p.grupos.map((g) => g.nome),
      ]),
    ).toEqual([
      ["Filial", ["Loja"]],
      ["Matriz", ["Loja"]],
    ]);
    // Sem unidade nem departamento: o grupo vai para o fim (depois de "Vila").
    const semNada = pessoasPublicadas(
      [
        {
          ...BRUNO,
          colaboradorId: "c-v",
          nome: "Vera",
          unidade: { id: "u9", nome: "Vila" },
        },
        {
          ...ANA,
          colaboradorId: "c-x",
          nome: "Abel",
          unidade: null,
          departamento: null,
        },
        BRUNO,
      ],
      SEMANA,
    );
    expect(
      paginasDaEquipe(semNada, "unidade", SEMANA).map((p) => [
        p.nome,
        p.grupos.map((g) => g.nome),
      ]),
    ).toEqual([
      ["Filial", ["Loja"]],
      ["Vila", ["Loja"]],
      ["Sem unidade", ["Sem departamento"]],
    ]);
    expect(
      paginasDaEquipe(ps, "departamento", SEMANA).map((p) => [
        p.nome,
        p.grupos.map((g) => g.nome),
      ]),
    ).toEqual([["Loja", ["Filial", "Matriz"]]]);
    expect(paginasDaEquipe(ps, "pessoa", SEMANA).map((p) => p.nome)).toEqual([
      "Ana Lima",
      "Bruno Reis",
    ]);
    expect(paginasDaEquipe(ps, "turno", SEMANA).map((p) => p.nome)).toEqual([
      "Comercial",
    ]);
    const unica = paginasDaEquipe(ps, "nenhum", SEMANA);
    expect(unica).toHaveLength(1);
    expect(unica[0]!.grupos[0]!.pessoas.map((p) => p.nome)).toEqual([
      "Ana Lima",
      "Bruno Reis",
    ]);
  });

  it("resumo da pessoa e legenda", () => {
    const ana = pessoasPublicadas([ANA], SEMANA)[0]!;
    expect(resumoDaPessoa(ana, SEMANA, undefined)).toEqual({
      dias: 1,
      minutos: 8 * 60,
      folgas: 1,
      feriados: 0,
    });
    const natal = pessoa("N", { dias: [dia("2026-12-25")] });
    expect(resumoDaPessoa(natal, ["2026-12-25"], undefined).feriados).toBe(1);
    expect(legendaDosTurnos([ana], SEMANA)).toEqual([
      {
        nome: "Comercial",
        cor: "azul",
        texto: "Comercial 09:00–18:00 · 1 h de intervalo",
      },
    ]);
  });

  it("PDF da equipe: título, local, versão, pessoas, horas, legenda, assinatura e rodapé", () => {
    const ps = pessoasPublicadas([ANA, BRUNO], SEMANA);
    const doc = pdfDaEquipe(ps, SEMANA, opcoes(), CTX);
    expect(doc.paginas).toHaveLength(2);
    const s = texto(doc.bytes());
    expect(s).toContain(
      "(Escala da semana \\267 7 a 13 de dezembro de 2026) Tj",
    );
    expect(s).toContain(
      "(Filial \\267 Empresa Sint\\351tica \\267 vers\\343o publicada em 24/11/2026 por RH Teste) Tj",
    );
    expect(s).toContain("(Uma p\\341gina por unidade) Tj");
    expect(s).toContain("(Ana Lima) Tj");
    expect(s).toContain("(8 h) Tj");
    expect(s).toContain("(Respons\\341vel) Tj");
    expect(s).toContain("(Gerado pelo Evolli em 25/11/2026 \\340s 12:54) Tj");
    expect(s).toContain("(2/2) Tj");
    // Sem horas, legenda e assinatura.
    const enxuto = texto(
      pdfDaEquipe(
        ps,
        SEMANA,
        opcoes({ horas: false, legenda: false, assinatura: false }),
        CTX,
      ).bytes(),
    );
    expect(enxuto).not.toContain("(Horas) Tj");
    expect(enxuto).not.toContain("de intervalo) Tj");
    expect(enxuto).not.toContain("(Respons\\341vel) Tj");
  });

  it("PDF da pessoa: os números do período e o calendário", () => {
    const ana = pessoasPublicadas([ANA], SEMANA)[0]!;
    const s = texto(
      pdfDaPessoa(ana, SEMANA, opcoes({ separarPor: "pessoa" }), CTX).bytes(),
    );
    expect(s).toContain("(Ana Lima \\267 7 a 13 de dezembro de 2026) Tj");
    expect(s).toContain("(dia de trabalho) Tj");
    expect(s).toContain("(folga \\(ou DSR\\)) Tj");
    expect(s).toContain("(Ciente do colaborador) Tj");
  });

  it("planilha: Escala e Horas previstas; os avisos quando pedidos", async () => {
    const ps = pessoasPublicadas([ANA, BRUNO], SEMANA);
    const abas = planilhaDaEscala(ps, SEMANA, opcoes({ formato: "xlsx" }));
    expect(abas.map((a) => a.nome)).toEqual(["Escala", "Horas previstas"]);
    expect(abas[0]!.linhas[0]).toEqual([
      "Colaborador",
      "Departamento",
      "Unidade",
      "07/12",
      "08/12",
      "09/12",
      "10/12",
      "11/12",
      "12/12",
      "13/12",
      "Horas",
    ]);
    expect(abas[0]!.linhas[1]).toEqual([
      "Ana Lima",
      "Loja",
      "Matriz",
      "Comercial 09:00–18:00",
      "DSR",
      "",
      "",
      "",
      "",
      "",
      "8 h",
    ]);
    expect(abas[1]!.linhas[1]).toEqual(["Ana Lima", 8, 0, 0, 0, 0, 0, 0, 8]);
    const comAvisos = planilhaDaEscala(
      ps,
      SEMANA,
      opcoes({ formato: "xlsx", avisos: true }),
      [
        {
          colaboradorId: "c-ana",
          nome: "Ana Lima",
          dia: "2026-12-07",
          chave: "dez_horas",
          categoria: "conferir",
          titulo: "11 h no dia",
          explicacao: "Mais de 10 h.",
        },
      ],
    );
    // Sem pedir os avisos (ou sem horas), a planilha não os traz.
    const semAvisos = planilhaDaEscala(
      ps,
      SEMANA,
      opcoes({ formato: "xlsx", avisos: false, horas: false }),
      [
        {
          colaboradorId: "c-ana",
          nome: "Ana Lima",
          dia: "2026-12-07",
          chave: "dez_horas",
          categoria: "conferir",
          titulo: "11 h no dia",
          explicacao: "Mais de 10 h.",
        },
      ],
    );
    expect(semAvisos.map((a) => a.nome)).toEqual(["Escala", "Horas previstas"]);
    expect(semAvisos[0]!.linhas[0]).not.toContain("Horas");
    expect(comAvisos.map((a) => a.nome)).toEqual([
      "Escala",
      "Horas previstas",
      "Avisos da CLT",
    ]);
    // O arquivo gerado é uma planilha legível.
    const arq = gerarArquivoDaEscala(
      [ANA, BRUNO, CAIO],
      SEMANA,
      opcoes({ formato: "xlsx" }),
      CTX,
    );
    expect(arq.nome).toBe("escala-semana-2026-12-07.xlsx");
    const lidas = await lerAbasXlsx(arq.bytes);
    expect(Object.keys(lidas)).toEqual(["Escala", "Horas previstas"]);
    expect(lidas["Escala"]![1]!.slice(0, 5)).toEqual([
      "Ana Lima",
      "Loja",
      "Matriz",
      "Comercial 09:00–18:00",
      "DSR",
    ]);
    expect(lidas["Escala"]).toHaveLength(3);
  });

  it("gerar: PDF da equipe, PDF com uma página por pessoa e .zip com um PDF por pessoa", () => {
    const pdf = gerarArquivoDaEscala([ANA, BRUNO, CAIO], SEMANA, opcoes(), CTX);
    expect(pdf).toMatchObject({
      nome: "escala-semana-2026-12-07.pdf",
      tipo: "application/pdf",
      paginas: 2,
    });
    expect(texto(pdf.bytes).startsWith("%PDF-1.4")).toBe(true);
    const porPessoa = gerarArquivoDaEscala(
      [ANA, BRUNO],
      SEMANA,
      opcoes({ separarPor: "pessoa" }),
      CTX,
    );
    expect(porPessoa.paginas).toBe(2);
    const zip = gerarArquivoDaEscala(
      [ANA, BRUNO],
      SEMANA,
      opcoes({ separarPor: "pessoa", zipPorPessoa: true }),
      CTX,
    );
    expect(zip).toMatchObject({
      nome: "escala-semana-2026-12-07.zip",
      tipo: "application/zip",
      paginas: 2,
    });
    const s = texto(zip.bytes);
    expect(s.startsWith("PK")).toBe(true);
    expect(s).toContain("escala-ana-lima-2026-12-07.pdf");
    expect(s).toContain("escala-bruno-reis-2026-12-07.pdf");
  });
});
