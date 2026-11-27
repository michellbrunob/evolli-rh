/**
 * T215 — planilha de "Importar valores": o modelo com as pessoas e os
 * valores de hoje, e a leitura (.xlsx e .csv) do que voltou. Sintético.
 */
import { describe, expect, it } from "vitest";
import type {
  PessoaDoBeneficioApi,
  RegrasDoBeneficioApi,
} from "../../api/beneficiosClient";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import {
  baseDoArquivo,
  colunasDaImportacao,
  cpfsDoTexto,
  formatarCpf,
  lerArquivoDeValores,
  lerCsv,
  lerLinhasDeValores,
  modeloDeValores,
  oQueAtualiza,
} from "./planilhaDeValores";

const R = {
  individualModo: "livre",
  coparticipacao: false,
  antecipacao: null,
} as unknown as RegrasDoBeneficioApi;

const ANA = {
  colaboradorId: "c-1",
  nome: "Ana Teste",
  cpf: "11144477735",
  escala: "5x2",
  dias: 19,
  valorDia: 3000,
  valor: 57000,
  coparticipacao: null,
  antecipado: null,
} as unknown as PessoaDoBeneficioApi;

describe("planilha de valores", () => {
  it("colunas por tipo de valor, como o servidor", () => {
    expect(colunasDaImportacao("dia_util", R)).toEqual(["dias", "valorDia"]);
    expect(colunasDaImportacao("fixo", R)).toEqual(["valorMes"]);
    expect(colunasDaImportacao("individual", R)).toEqual(["valorMes"]);
    expect(
      colunasDaImportacao("individual", { ...R, individualModo: "plano" }),
    ).toEqual([]);
    expect(
      colunasDaImportacao("faixa_etaria", { ...R, coparticipacao: true }),
    ).toEqual(["coparticipacao"]);
    expect(colunasDaImportacao("faixa_etaria", R)).toEqual([]);
    expect(oQueAtualiza(["dias", "valorDia"])).toBe(
      "dias no mês e valor por dia",
    );
    expect(oQueAtualiza(["coparticipacao"])).toBe("coparticipação");
  });

  it("modelo: cabeçalho, CPF formatado, escala e os valores de hoje", async () => {
    const abas = await lerAbasXlsx(
      modeloDeValores(["dias", "valorDia"], [ANA], "novembro/2026"),
    );
    expect(abas["Valores"]).toEqual([
      ["CPF", "Colaborador", "Escala", "Dias no mês", "Valor por dia"],
      ["111.444.777-35", "Ana Teste", "5x2", "19", "30"],
    ]);
    expect(abas["Instruções"]![0]).toEqual([
      "Valores de novembro/2026. Um mês por planilha.",
    ]);
  });

  it("CSV com ponto e vírgula, aspas e BOM", () => {
    expect(lerCsv('﻿CPF;Nome;Valor\r\n111;"Silva; Ana";"30,00"\n')).toEqual([
      ["CPF", "Nome", "Valor"],
      ["111", "Silva; Ana", "30,00"],
    ]);
    expect(lerCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("linhas: casa o cabeçalho sem acento nem asterisco; ignora vazias", () => {
    const r = lerLinhasDeValores(
      [
        ["cpf *", "Colaborador", "DIAS NO MES", "Valor por dia"],
        ["111.444.777-35", "Ana", "15", ""],
        ["", "", "", ""],
        ["529.982.247-25", "Bia", "", "32,50"],
      ],
      ["dias", "valorDia"],
    );
    expect(r).toEqual({
      linhas: [
        {
          linha: 2,
          cpf: "111.444.777-35",
          valores: { dias: "15", valorDia: null },
        },
        {
          linha: 4,
          cpf: "529.982.247-25",
          valores: { dias: null, valorDia: "32,50" },
        },
      ],
      nomes: { 2: "Ana", 4: "Bia" },
    });
  });

  it("recusas: sem CPF, sem coluna de valor, vazia", () => {
    expect(lerLinhasDeValores([["Nome", "Dias no mês"]], ["dias"])).toEqual({
      erro: "A planilha não tem a coluna CPF. Use o modelo, sem mudar o cabeçalho.",
    });
    expect(lerLinhasDeValores([["CPF", "Nome"]], ["coparticipacao"])).toEqual({
      erro: "A planilha não tem a coluna Coparticipação. Use o modelo, sem mudar o cabeçalho.",
    });
    expect(lerLinhasDeValores([["CPF", "Dias no mês"]], ["dias"])).toEqual({
      erro: "A planilha não tem nenhuma linha preenchida.",
    });
  });

  it("arquivo: o modelo volta lido; tipo e tamanho conferidos", async () => {
    const bytes = modeloDeValores(["dias", "valorDia"], [ANA], "11/2026");
    const xlsx = new File([bytes as BlobPart], "valores.xlsx");
    expect(await lerArquivoDeValores(xlsx, ["dias", "valorDia"])).toEqual({
      linhas: [
        {
          linha: 2,
          cpf: "111.444.777-35",
          valores: { dias: "19", valorDia: "30" },
        },
      ],
      nomes: { 2: "Ana Teste" },
    });
    const csv = new File(["CPF;Dias no mês\n11144477735;12\n"], "v.csv");
    expect(await lerArquivoDeValores(csv, ["dias"])).toEqual({
      linhas: [{ linha: 2, cpf: "11144477735", valores: { dias: "12" } }],
      nomes: {},
    });
    expect(
      await lerArquivoDeValores(new File(["x"], "v.pdf"), ["dias"]),
    ).toEqual({ erro: "Envie um arquivo .xlsx ou .csv." });
  });

  it("CPFs colados: máscara, separadores, repetidos e zeros comidos", () => {
    expect(
      cpfsDoTexto(
        "111.444.777-35\n52998224725;111.444.777-35\t1234567890, 12, abc",
      ),
    ).toEqual(["11144477735", "52998224725", "01234567890"]);
    expect(cpfsDoTexto("")).toEqual([]);
  });

  it("formatos auxiliares", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35");
    expect(formatarCpf(null)).toBe("");
    expect(baseDoArquivo("VR Ótimo", "2026-11")).toBe("vr-otimo-2026-11");
  });
});
