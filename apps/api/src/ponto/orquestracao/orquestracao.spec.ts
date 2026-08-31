import { readFileSync } from "fs";
import { join } from "path";

import { simularFluxoPonto } from "./orquestracao";
import {
  DIA_ATRASO,
  DIA_HORA_EXTRA,
  DIA_NORMAL,
  ESCOPO,
  FECHAMENTO_SIMULADO,
  PENDENCIA_ABERTA,
  PENDENCIA_SIMULADA,
  PERIODO_EM_APURACAO,
  PROPOSTA_RASCUNHO,
  PROPOSTA_SIMULADA,
} from "./orquestracao.fixtures";
import {
  EntradaOrquestracao,
  ResultadoOrquestracao,
} from "./orquestracao.types";

/** Narrowing helper: garante `status === "simulado"` (ou falha o teste). */
function simulado(
  resultado: ResultadoOrquestracao,
): Extract<ResultadoOrquestracao, { status: "simulado" }> {
  if (resultado.status !== "simulado") {
    throw new Error(`esperava simulado, veio ${resultado.status}`);
  }
  return resultado;
}

/** Narrowing helper: garante `status === "recusado"` (ou falha o teste). */
function recusado(
  resultado: ResultadoOrquestracao,
): Extract<ResultadoOrquestracao, { status: "recusado" }> {
  if (resultado.status !== "recusado") {
    throw new Error(`esperava recusado, veio ${resultado.status}`);
  }
  return resultado;
}

/** Entrada padrão completa: hora extra + atraso, pendência, proposta e fechamento. */
const SIMULACAO_PADRAO: EntradaOrquestracao = {
  escopo: ESCOPO,
  dias: [DIA_HORA_EXTRA, DIA_ATRASO],
  pendencias: [PENDENCIA_SIMULADA],
  propostas: [PROPOSTA_SIMULADA],
  fechamento: FECHAMENTO_SIMULADO,
};

describe("orquestracao — dia normal, sem alteração de saldo", () => {
  it("dia que bate a jornada não gera movimento nem altera o saldo", () => {
    const r = simulado(
      simularFluxoPonto({
        escopo: ESCOPO,
        dias: [DIA_NORMAL],
        pendencias: [],
        propostas: [],
        fechamento: FECHAMENTO_SIMULADO,
      }),
    );
    expect(r.movimentos).toHaveLength(0);
    expect(r.resumo.saldoMinutos).toBe(0);
    expect(r.resumo.totalCreditosMinutos).toBe(0);
    expect(r.resumo.totalDebitosMinutos).toBe(0);
    expect(r.resumo.quantidadeMovimentos).toBe(0);
  });
});

describe("orquestracao — atraso + hora extra homologado (crédito e débito separados)", () => {
  it("crédito 90 e débito 25 permanecem separados; saldo derivado 65", () => {
    const r = simulado(simularFluxoPonto(SIMULACAO_PADRAO));

    // Dois movimentos separados — o crédito nunca compensa o débito.
    expect(r.movimentos).toHaveLength(2);
    const credito = r.movimentos.find((m) => m.natureza === "credito");
    const debito = r.movimentos.find((m) => m.natureza === "debito");
    expect(credito?.minutos).toBe(90);
    expect(credito?.origem).toBe("apuracao_credito_extra");
    expect(debito?.minutos).toBe(25);
    expect(debito?.origem).toBe("apuracao_debito_atraso_saida");

    // Totais e saldo derivado.
    expect(r.resumo.totalCreditosMinutos).toBe(90);
    expect(r.resumo.totalDebitosMinutos).toBe(25);
    expect(r.resumo.saldoMinutos).toBe(65);
  });

  it("o extrato preserva a ordem de entrada dos movimentos", () => {
    const r = simulado(simularFluxoPonto(SIMULACAO_PADRAO));
    expect(r.extrato).toHaveLength(2);
    expect(r.extrato[0]?.movimento.natureza).toBe("credito");
    expect(r.extrato[0]?.saldoAcumuladoMinutos).toBe(90);
    expect(r.extrato[1]?.movimento.natureza).toBe("debito");
    expect(r.extrato[1]?.saldoAcumuladoMinutos).toBe(65);
  });
});

describe("orquestracao — proposta de compensação aprovada sem impacto no extrato", () => {
  it("proposta chega a aprovada_para_registro sem criar movimento", () => {
    const r = simulado(simularFluxoPonto(SIMULACAO_PADRAO));
    const proposta = r.propostas[0];
    expect(proposta?.proposta.situacao).toBe("aprovada_para_registro");
    expect(proposta?.erro).toBeNull();

    // Nenhum movimento de compensação foi criado pela proposta aprovada.
    expect(r.movimentos).toHaveLength(2);
    for (const movimento of r.movimentos) {
      expect(movimento.origem).not.toBe("apuracao_debito_compensacao");
    }
    // O saldo continua derivado só da apuração.
    expect(r.resumo.saldoMinutos).toBe(65);
  });

  it("remover a proposta não muda o saldo derivado", () => {
    const semProposta = simulado(
      simularFluxoPonto({ ...SIMULACAO_PADRAO, propostas: [] }),
    );
    const comProposta = simulado(simularFluxoPonto(SIMULACAO_PADRAO));
    expect(semProposta.resumo.saldoMinutos).toBe(
      comProposta.resumo.saldoMinutos,
    );
    expect(semProposta.movimentos).toHaveLength(comProposta.movimentos.length);
  });
});

describe("orquestracao — pendência revisada/resolvida sem alterar saldo", () => {
  it("pendência chega a resolvida sem tocar no extrato/saldo", () => {
    const r = simulado(simularFluxoPonto(SIMULACAO_PADRAO));
    const pendencia = r.pendencias[0];
    expect(pendencia?.pendencia.situacao).toBe(
      "resolvida_sem_alteracao_automatica",
    );
    expect(pendencia?.erro).toBeNull();
    // Saldo idêntico ao cenário sem pendências.
    const semPendencia = simulado(
      simularFluxoPonto({ ...SIMULACAO_PADRAO, pendencias: [] }),
    );
    expect(r.resumo.saldoMinutos).toBe(semPendencia.resumo.saldoMinutos);
    expect(r.resumo.saldoMinutos).toBe(65);
  });
});

describe("orquestracao — fechamento até conferência manual registrada", () => {
  it("percorre o ciclo sem PDF, assinatura ou alteração financeira", () => {
    const r = simulado(simularFluxoPonto(SIMULACAO_PADRAO));
    expect(r.fechamento.periodo.situacao).toBe("conferencia_manual_registrada");
    expect(r.fechamento.erro).toBeNull();
    expect(r.fechamento.eventos).toHaveLength(6);
    // O fechamento não cria movimento nem altera o saldo derivado.
    expect(r.movimentos).toHaveLength(2);
    expect(r.resumo.saldoMinutos).toBe(65);
  });

  it("sem ações humanas, o período não avança (não fecha automaticamente)", () => {
    const r = simulado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        fechamento: { inicial: PERIODO_EM_APURACAO, passos: [] },
      }),
    );
    expect(r.fechamento.periodo.situacao).toBe("em_apuracao");
    expect(r.fechamento.eventos).toHaveLength(0);
  });
});

describe("orquestracao — falha segura recusa a simulação inteira", () => {
  it("apuração inválida recusa tudo, sem resultado parcial", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        dias: [
          {
            entrada: {
              faixasPrevistas: [{ inicio: "08:00", fim: "12:00" }],
              // Marcações não pareiam com as faixas → apuração inválida.
              marcacoes: ["08:00"],
              classificacao: "regular",
            },
            meta: { idBase: "AP-BAD", dataReferencia: "2026-08-10" },
          },
        ],
      }),
    );
    expect(r.erro.codigo).toBe("APURACAO_INVALIDA");
    expect(r.erro.etapa).toBe("apuracao");
    expect(r.erro.indice).toBe(0);
    expect(r).not.toHaveProperty("movimentos");
    expect(r).not.toHaveProperty("resumo");
  });

  it("escopo vazio recusa antes de qualquer núcleo", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        escopo: { empresaRef: "", vinculoRef: "V-001" },
      }),
    );
    expect(r.erro.codigo).toBe("ESCOPO_INVALIDO");
    expect(r.erro.etapa).toBe("escopo");
  });

  it("referência inconsistente (pendência de outro escopo) recusa tudo", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        pendencias: [
          {
            inicial: { ...PENDENCIA_ABERTA, empresaRef: "EMP-B" },
            passos: [],
          },
        ],
      }),
    );
    expect(r.erro.codigo).toBe("REFERENCIA_INCONSISTENTE");
    expect(r.erro.etapa).toBe("pendencias");
    expect(r.erro.indice).toBe(0);
  });

  it("ação humana inválida no fechamento (fora de ordem) recusa tudo", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        fechamento: {
          inicial: PERIODO_EM_APURACAO,
          // Pular direto para fechar_operacionalmente é fora de ordem.
          passos: [
            {
              acao: "fechar_operacionalmente",
              papel: "rh",
              refAuditoria: "AUD-X",
            },
          ],
        },
      }),
    );
    expect(r.erro.codigo).toBe("FECHAMENTO_INVALIDO");
    expect(r.erro.etapa).toBe("fechamento");
  });

  it("papel não-rh no percurso de proposta recusa tudo", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        propostas: [
          {
            inicial: PROPOSTA_RASCUNHO,
            passos: [
              { acao: "submeter", papel: "gestor", refAuditoria: "AUD-Y" },
            ],
          },
        ],
      }),
    );
    expect(r.erro.codigo).toBe("PROPOSTA_INVALIDA");
    expect(r.erro.etapa).toBe("propostas");
  });

  it("percurso de pendência inválido recusa tudo", () => {
    const r = recusado(
      simularFluxoPonto({
        ...SIMULACAO_PADRAO,
        pendencias: [
          {
            inicial: PENDENCIA_ABERTA,
            // resolver direto de `aberta` é transição inválida.
            passos: [
              {
                acao: "resolver_sem_alteracao",
                papel: "rh",
                refAuditoria: "AUD-Z",
              },
            ],
          },
        ],
      }),
    );
    expect(r.erro.codigo).toBe("PENDENCIA_INVALIDA");
    expect(r.erro.etapa).toBe("pendencias");
  });
});

describe("orquestracao — pureza e ausência de dados pessoais/financeiros reais", () => {
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

  it("importa apenas módulos relativos (núcleos irmãos; sem NestJS/Prisma/I/O)", () => {
    for (const arquivo of ["orquestracao.ts", "orquestracao.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("compõe exatamente os cinco núcleos já integrados", () => {
    const fonte = readFileSync(join(__dirname, "orquestracao.ts"), "utf8");
    for (const nucleo of [
      "../apuracao/apuracao",
      "../banco-horas/banco-horas",
      "../compensacao/compensacao",
      "../fechamento/fechamento",
      "../verificar-folhas/verificar-folhas",
    ]) {
      expect(fonte).toContain(nucleo);
    }
  });

  it("nenhuma saída expõe dinheiro/Folha/pagamento nem CPF/nome real", () => {
    const r = simularFluxoPonto(SIMULACAO_PADRAO);
    const texto = JSON.stringify(r).toLowerCase();
    for (const termoProibido of [
      "salario",
      "salário",
      "pagamento",
      "dinheiro",
      "adicional",
      "dsr",
      "cpf",
      "assinatura",
      "secullum",
      "rwtech",
      "bioprox",
      ".pdf",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
