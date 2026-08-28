import { readFileSync } from "fs";
import { join } from "path";
import { apurarDiaSintetico } from "../apuracao/apuracao";
import { CENARIO_ATRASO_MAIS_EXTRA } from "../apuracao/apuracao.fixtures";
import {
  gerarExtratoSintetico,
  movimentosDeApuracaoDiaria,
} from "./banco-horas";
import {
  MOV_CREDITO,
  MOV_DEBITO,
  SEQUENCIA_CREDITO_DEBITO,
  SEQUENCIA_SALDO_NEGATIVO,
} from "./banco-horas.fixtures";
import {
  MovimentoBancoHoras,
  ResultadoExtratoBancoHoras,
} from "./banco-horas.types";

/** Estreita para o ramo `gerado` (falha o teste se veio `invalido`). */
function gerado(resultado: ResultadoExtratoBancoHoras) {
  expect(resultado.status).toBe("gerado");
  if (resultado.status !== "gerado") {
    throw new Error(`esperava gerado, veio ${resultado.status}`);
  }
  return resultado;
}

describe("gerarExtratoSintetico — crédito e débito isolados", () => {
  it("crédito isolado: saldo positivo, total de débito zero", () => {
    const r = gerado(gerarExtratoSintetico([MOV_CREDITO]));
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]?.saldoAcumuladoMinutos).toBe(120);
    expect(r.totalCreditosMinutos).toBe(120);
    expect(r.totalDebitosMinutos).toBe(0);
    expect(r.saldoMinutos).toBe(120);
  });

  it("débito isolado: saldo negativo, total de crédito zero", () => {
    const r = gerado(gerarExtratoSintetico([MOV_DEBITO]));
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]?.saldoAcumuladoMinutos).toBe(-25);
    expect(r.totalCreditosMinutos).toBe(0);
    expect(r.totalDebitosMinutos).toBe(25);
    expect(r.saldoMinutos).toBe(-25);
  });
});

describe("gerarExtratoSintetico — sequência preserva os dois eventos", () => {
  it("crédito + débito ficam separados, na ordem, com saldo derivado", () => {
    const r = gerado(gerarExtratoSintetico(SEQUENCIA_CREDITO_DEBITO));

    // Quatro linhas, nenhuma fundida num líquido; ordem de entrada preservada.
    expect(r.linhas).toHaveLength(4);
    expect(r.linhas.map((l) => l.saldoAcumuladoMinutos)).toEqual([
      120, 95, 185, 5,
    ]);
    // Cada movimento é preservado individualmente (mesma referência de entrada).
    expect(r.linhas.map((l) => l.movimento)).toEqual(SEQUENCIA_CREDITO_DEBITO);
    // Totais separados — crédito não abate débito.
    expect(r.totalCreditosMinutos).toBe(210);
    expect(r.totalDebitosMinutos).toBe(205);
    expect(r.saldoMinutos).toBe(5);
  });

  it("não compensa nem funde: dois eventos de mesma data seguem distintos", () => {
    const mesmaData: readonly MovimentoBancoHoras[] = [
      {
        id: "SD-1",
        natureza: "credito",
        minutos: 60,
        dataReferencia: "2026-07-01",
        origem: "apuracao_credito_extra",
      },
      {
        id: "SD-2",
        natureza: "debito",
        minutos: 60,
        dataReferencia: "2026-07-01",
        origem: "apuracao_debito_atraso_saida",
      },
    ];
    const r = gerado(gerarExtratoSintetico(mesmaData));
    expect(r.linhas).toHaveLength(2);
    expect(r.totalCreditosMinutos).toBe(60);
    expect(r.totalDebitosMinutos).toBe(60);
    expect(r.saldoMinutos).toBe(0);
    // Saldo zero por soma derivada, NÃO por fusão/remoção dos eventos.
    expect(r.linhas[0]?.movimento.id).toBe("SD-1");
    expect(r.linhas[1]?.movimento.id).toBe("SD-2");
  });
});

describe("gerarExtratoSintetico — saldo negativo permitido (só matemático)", () => {
  it("saldo negativo é resultado da soma, sem bloquear nem decidir política", () => {
    const r = gerado(gerarExtratoSintetico(SEQUENCIA_SALDO_NEGATIVO));
    expect(r.saldoMinutos).toBe(-70);
    expect(r.totalCreditosMinutos).toBe(30);
    expect(r.totalDebitosMinutos).toBe(100);
    // Não há erro nem bloqueio — o núcleo não decide política de saldo negativo.
    expect(r.linhas).toHaveLength(2);
  });
});

describe("movimentosDeApuracaoDiaria — adaptador do resultado T050", () => {
  it("converte o cenário homologado (atraso + extra) em crédito 90 e débito 25 separados", () => {
    const apuracao = apurarDiaSintetico(CENARIO_ATRASO_MAIS_EXTRA);
    const movimentos = movimentosDeApuracaoDiaria(apuracao, {
      idBase: "AP-DEMO-0001",
      dataReferencia: "2026-08-25",
    });

    // Dois movimentos distintos — crédito NÃO compensa débito.
    expect(movimentos).toHaveLength(2);
    expect(movimentos[0]).toEqual({
      id: "AP-DEMO-0001-C",
      natureza: "credito",
      minutos: 90,
      dataReferencia: "2026-08-25",
      origem: "apuracao_credito_extra",
    });
    expect(movimentos[1]).toEqual({
      id: "AP-DEMO-0001-D",
      natureza: "debito",
      minutos: 25,
      dataReferencia: "2026-08-25",
      origem: "apuracao_debito_atraso_saida",
    });

    // Alimentado no extrato: saldo derivado 65, totais separados.
    const extrato = gerado(gerarExtratoSintetico(movimentos));
    expect(extrato.totalCreditosMinutos).toBe(90);
    expect(extrato.totalDebitosMinutos).toBe(25);
    expect(extrato.saldoMinutos).toBe(65);
  });

  it("não gera movimento quando não há crédito nem débito, e ignora entrada inválida", () => {
    const feriado = apurarDiaSintetico({
      classificacao: "feriado",
      faixasPrevistas: [{ inicio: "08:00", fim: "12:00" }],
      marcacoes: [],
    });
    expect(
      movimentosDeApuracaoDiaria(feriado, {
        idBase: "AP-FER",
        dataReferencia: "2026-08-25",
      }),
    ).toEqual([]);

    const invalida = apurarDiaSintetico({
      classificacao: "regular",
      faixasPrevistas: [],
      marcacoes: ["25:00"],
    });
    expect(
      movimentosDeApuracaoDiaria(invalida, {
        idBase: "AP-INV",
        dataReferencia: "2026-08-25",
      }),
    ).toEqual([]);
  });
});

describe("gerarExtratoSintetico — validação fail-closed (rejeita todo o extrato)", () => {
  function movimento(
    parcial: Partial<MovimentoBancoHoras>,
  ): MovimentoBancoHoras {
    return { ...MOV_CREDITO, ...parcial } as MovimentoBancoHoras;
  }

  const casos: ReadonlyArray<{
    nome: string;
    movimentos: readonly MovimentoBancoHoras[];
    codigo: string;
  }> = [
    {
      nome: "identificador vazio",
      movimentos: [movimento({ id: "   " })],
      codigo: "MOVIMENTO_ID_VAZIO",
    },
    {
      nome: "identificador duplicado",
      movimentos: [MOV_CREDITO, movimento({ id: MOV_CREDITO.id, minutos: 5 })],
      codigo: "MOVIMENTO_ID_DUPLICADO",
    },
    {
      nome: "data fora de AAAA-MM-DD",
      movimentos: [movimento({ id: "X1", dataReferencia: "01/07/2026" })],
      codigo: "MOVIMENTO_DATA_INVALIDA",
    },
    {
      nome: "data inexistente no calendário",
      movimentos: [movimento({ id: "X2", dataReferencia: "2026-02-30" })],
      codigo: "MOVIMENTO_DATA_INVALIDA",
    },
    {
      nome: "minutos zero",
      movimentos: [movimento({ id: "X3", minutos: 0 })],
      codigo: "MOVIMENTO_MINUTOS_INVALIDOS",
    },
    {
      nome: "minutos negativos",
      movimentos: [movimento({ id: "X4", minutos: -10 })],
      codigo: "MOVIMENTO_MINUTOS_INVALIDOS",
    },
    {
      nome: "minutos não inteiros",
      movimentos: [movimento({ id: "X5", minutos: 10.5 })],
      codigo: "MOVIMENTO_MINUTOS_INVALIDOS",
    },
    {
      nome: "natureza desconhecida",
      movimentos: [
        {
          id: "X6",
          natureza: "outro",
          minutos: 30,
          dataReferencia: "2026-07-01",
          origem: "movimento_sintetico",
        } as unknown as MovimentoBancoHoras,
      ],
      codigo: "MOVIMENTO_NATUREZA_DESCONHECIDA",
    },
    {
      nome: "origem desconhecida",
      movimentos: [
        {
          id: "X7",
          natureza: "credito",
          minutos: 30,
          dataReferencia: "2026-07-01",
          origem: "debito_quitacao",
        } as unknown as MovimentoBancoHoras,
      ],
      codigo: "MOVIMENTO_ORIGEM_DESCONHECIDA",
    },
  ];

  for (const caso of casos) {
    it(`rejeita integralmente: ${caso.nome}`, () => {
      let resultado: ResultadoExtratoBancoHoras | undefined;
      expect(() => {
        resultado = gerarExtratoSintetico(caso.movimentos);
      }).not.toThrow();
      expect(resultado?.status).toBe("invalido");
      if (resultado?.status !== "invalido") return;
      expect(resultado.erro.codigo).toBe(caso.codigo);
      // Fail-closed: nenhum extrato parcial (a união não tem `linhas` no ramo).
      expect("linhas" in resultado).toBe(false);
    });
  }

  it("um movimento inválido no meio rejeita todo o resultado (nada parcial)", () => {
    const r = gerarExtratoSintetico([
      MOV_CREDITO,
      movimento({ id: "X8", minutos: 0 }),
      MOV_DEBITO,
    ]);
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("MOVIMENTO_MINUTOS_INVALIDOS");
    expect(r.erro.posicao).toBe(1);
  });
});

describe("banco-horas — pureza e ausência de dados financeiros/pessoais", () => {
  function importsDoArquivo(nomeArquivo: string): string[] {
    const fonte = readFileSync(join(__dirname, nomeArquivo), "utf8");
    const especificadores: string[] = [];
    const regex = /from\s+["']([^"']+)["']/g;
    let casamento: RegExpExecArray | null = regex.exec(fonte);
    while (casamento !== null) {
      const especificador = casamento[1];
      if (especificador !== undefined) especificadores.push(especificador);
      casamento = regex.exec(fonte);
    }
    return especificadores;
  }

  it("importa apenas módulos relativos (sem NestJS/Prisma/I/O)", () => {
    for (const arquivo of ["banco-horas.ts", "banco-horas.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("nenhum resultado expõe valor/salário/Folha/pagamento nem CPF/nome", () => {
    const extrato = gerarExtratoSintetico(SEQUENCIA_CREDITO_DEBITO);
    const texto = JSON.stringify(extrato).toLowerCase();
    for (const termoProibido of [
      "valor",
      "salario",
      "salário",
      "percentual",
      "pagamento",
      "dinheiro",
      "reais",
      "monet",
      "adicional",
      "folha",
      "cpf",
      "secullum",
      "rwtech",
      "bioprox",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
