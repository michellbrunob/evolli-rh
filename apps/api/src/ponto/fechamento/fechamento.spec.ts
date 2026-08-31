import { readFileSync } from "fs";
import { join } from "path";
import {
  aplicarSequenciaPeriodo,
  ehTerminal,
  transicionarPeriodo,
} from "./fechamento";
import { PERCURSO_COMPLETO, PERIODO_EM_APURACAO } from "./fechamento.fixtures";
import {
  AcaoPeriodo,
  EstadoPeriodo,
  PeriodoFechamento,
  ResultadoTransicaoPeriodo,
} from "./fechamento.types";

/** Estreita para o ramo `transicionado` (falha o teste se veio `invalido`). */
function transicionado(resultado: ResultadoTransicaoPeriodo) {
  expect(resultado.status).toBe("transicionado");
  if (resultado.status !== "transicionado") {
    throw new Error(`esperava transicionado, veio ${resultado.status}`);
  }
  return resultado;
}

describe("transicionarPeriodo — percurso completo", () => {
  it("em_apuracao → ... → conferencia_manual_registrada (por rh)", () => {
    const historico = aplicarSequenciaPeriodo(
      PERIODO_EM_APURACAO,
      PERCURSO_COMPLETO,
    );
    expect(historico.erro).toBeNull();
    expect(historico.periodo.situacao).toBe("conferencia_manual_registrada");
    expect(ehTerminal(historico.periodo.situacao)).toBe(true);
    expect(historico.eventos.map((e) => e.estadoPara)).toEqual([
      "em_verificacao_rh",
      "pronto_para_fechamento",
      "fechado_operacionalmente",
      "espelho_emitido",
      "conferencia_manual_pendente",
      "conferencia_manual_registrada",
    ]);
  });

  it("cada transição emite evento técnico com estado de/para e papel", () => {
    const r = transicionado(
      transicionarPeriodo(
        PERIODO_EM_APURACAO,
        "enviar_para_verificacao",
        "rh",
        "AUD-1",
      ),
    );
    expect(r.periodo.situacao).toBe("em_verificacao_rh");
    expect(r.periodo.refAuditoria).toBe("AUD-1");
    expect(r.evento).toEqual({
      periodoId: "PER-DEMO-0001",
      acao: "enviar_para_verificacao",
      estadoDe: "em_apuracao",
      estadoPara: "em_verificacao_rh",
      papel: "rh",
      refAuditoria: "AUD-1",
    });
  });
});

describe("transicionarPeriodo — transições inválidas e terminal", () => {
  it("transição fora de ordem falha (fechar direto de em_apuracao)", () => {
    const r = transicionarPeriodo(
      PERIODO_EM_APURACAO,
      "fechar_operacionalmente",
      "rh",
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
  });

  it("estado terminal não admite nova transição", () => {
    const terminal: PeriodoFechamento = {
      ...PERIODO_EM_APURACAO,
      situacao: "conferencia_manual_registrada",
    };
    const r = transicionarPeriodo(
      terminal,
      "registrar_conferencia_manual",
      "rh",
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("ESTADO_TERMINAL");
  });

  it("não há retrocesso (verificacao → apuracao não é ação válida)", () => {
    const verificacao: PeriodoFechamento = {
      ...PERIODO_EM_APURACAO,
      situacao: "em_verificacao_rh",
    };
    // Só existe a ação de avanço; qualquer outra falha.
    const r = transicionarPeriodo(
      verificacao,
      "fechar_operacionalmente",
      "rh",
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
  });
});

describe("transicionarPeriodo — imutabilidade e histórico técnico", () => {
  it("não muta o período de entrada; devolve nova versão", () => {
    const congelado = Object.freeze({ ...PERIODO_EM_APURACAO });
    const r = transicionado(
      transicionarPeriodo(congelado, "enviar_para_verificacao", "rh", "AUD-X"),
    );
    expect(congelado.situacao).toBe("em_apuracao");
    expect(congelado.refAuditoria).toBe("AUD-DEMO-0000");
    expect(r.periodo).not.toBe(congelado);
    expect(r.periodo.situacao).toBe("em_verificacao_rh");
  });

  it("aplicarSequenciaPeriodo acumula histórico sem mutar a inicial", () => {
    const inicial = Object.freeze({ ...PERIODO_EM_APURACAO });
    const historico = aplicarSequenciaPeriodo(inicial, PERCURSO_COMPLETO);
    expect(historico.eventos).toHaveLength(6);
    expect(inicial.situacao).toBe("em_apuracao");
  });
});

describe("transicionarPeriodo — permissão exclusiva para rh", () => {
  for (const papel of [
    "master_tecnico",
    "dp",
    "gestor",
    "colaborador",
  ] as const) {
    it(`nega transição para papel ${papel}`, () => {
      const r = transicionarPeriodo(
        PERIODO_EM_APURACAO,
        "enviar_para_verificacao",
        papel,
        "AUD-1",
      );
      expect(r.status).toBe("invalido");
      if (r.status !== "invalido") return;
      expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
    });
  }
});

describe("transicionarPeriodo — fail-closed (rejeição segura)", () => {
  function periodo(parcial: Partial<PeriodoFechamento>): PeriodoFechamento {
    return { ...PERIODO_EM_APURACAO, ...parcial } as PeriodoFechamento;
  }

  const casos: ReadonlyArray<{
    nome: string;
    periodo: PeriodoFechamento;
    acao: AcaoPeriodo;
    refAuditoria: string;
    codigo: string;
  }> = [
    {
      nome: "id vazio",
      periodo: periodo({ id: "  " }),
      acao: "enviar_para_verificacao",
      refAuditoria: "AUD-1",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "empresaRef vazio",
      periodo: periodo({ empresaRef: "" }),
      acao: "enviar_para_verificacao",
      refAuditoria: "AUD-1",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "refAuditoria da transição vazia",
      periodo: PERIODO_EM_APURACAO,
      acao: "enviar_para_verificacao",
      refAuditoria: "   ",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "data inválida",
      periodo: periodo({ fimReferencia: "2026-02-30" }),
      acao: "enviar_para_verificacao",
      refAuditoria: "AUD-1",
      codigo: "DATA_INVALIDA",
    },
    {
      nome: "intervalo invertido",
      periodo: periodo({
        inicioReferencia: "2026-08-25",
        fimReferencia: "2026-07-26",
      }),
      acao: "enviar_para_verificacao",
      refAuditoria: "AUD-1",
      codigo: "INTERVALO_INVERTIDO",
    },
    {
      nome: "estado desconhecido",
      periodo: {
        ...PERIODO_EM_APURACAO,
        situacao: "estado_inexistente",
      } as unknown as PeriodoFechamento,
      acao: "enviar_para_verificacao",
      refAuditoria: "AUD-1",
      codigo: "ESTADO_DESCONHECIDO",
    },
    {
      nome: "ação desconhecida",
      periodo: PERIODO_EM_APURACAO,
      acao: "reabrir" as unknown as AcaoPeriodo,
      refAuditoria: "AUD-1",
      codigo: "ACAO_DESCONHECIDA",
    },
  ];

  for (const caso of casos) {
    it(`rejeita com segurança: ${caso.nome}`, () => {
      let resultado: ResultadoTransicaoPeriodo | undefined;
      expect(() => {
        resultado = transicionarPeriodo(
          caso.periodo,
          caso.acao,
          "rh",
          caso.refAuditoria,
        );
      }).not.toThrow();
      expect(resultado?.status).toBe("invalido");
      if (resultado?.status !== "invalido") return;
      expect(resultado.erro.codigo).toBe(caso.codigo);
      expect("periodo" in resultado).toBe(false);
      expect("evento" in resultado).toBe(false);
    });
  }
});

describe("fechamento — não toca Banco de Horas / apuração / saldo", () => {
  it("nenhum resultado expõe movimento, saldo, extrato ou débito", () => {
    const historico = aplicarSequenciaPeriodo(
      PERIODO_EM_APURACAO,
      PERCURSO_COMPLETO,
    );
    const texto = JSON.stringify(historico).toLowerCase();
    for (const termoProibido of [
      "movimento",
      "saldo",
      "extrato",
      "debito",
      "credito",
      "creditominutos",
      "debitominutos",
      "apuracaodiaria",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("fechamento — pureza e ausência de dados financeiros/pessoais", () => {
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

  it("importa apenas módulos relativos próprios (sem NestJS/Prisma/I/O)", () => {
    for (const arquivo of ["fechamento.ts", "fechamento.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("o núcleo não importa T050/T052/T054", () => {
    const fonte = readFileSync(join(__dirname, "fechamento.ts"), "utf8");
    for (const proibido of ["apuracao", "banco-horas", "compensacao"]) {
      expect(fonte).not.toContain(`/${proibido}`);
    }
  });

  it("nenhuma saída expõe dinheiro/Folha/pagamento nem CPF/nome/assinatura", () => {
    const r = transicionarPeriodo(
      PERIODO_EM_APURACAO,
      "enviar_para_verificacao",
      "rh",
      "AUD-1",
    );
    const texto = JSON.stringify(r).toLowerCase();
    for (const termoProibido of [
      "valor",
      "salario",
      "salário",
      "pagamento",
      "dinheiro",
      "folha",
      "adicional",
      "dsr",
      "cpf",
      "assinatura",
      "pdf",
      "secullum",
      "rwtech",
      "bioprox",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("ehTerminal só reconhece conferencia_manual_registrada", () => {
    expect(ehTerminal("conferencia_manual_registrada")).toBe(true);
    for (const estado of [
      "em_apuracao",
      "em_verificacao_rh",
      "pronto_para_fechamento",
      "fechado_operacionalmente",
      "espelho_emitido",
      "conferencia_manual_pendente",
    ] as const) {
      expect(ehTerminal(estado as EstadoPeriodo)).toBe(false);
    }
  });
});
