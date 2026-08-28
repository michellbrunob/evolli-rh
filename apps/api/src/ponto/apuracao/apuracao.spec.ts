import { readFileSync } from "fs";
import { join } from "path";
import {
  ALMOCO_MINIMO_MINUTOS,
  TOLERANCIA_MINUTOS,
  apurarDiaSintetico,
} from "./apuracao";
import {
  CENARIOS_CLASSIFICACAO,
  CENARIO_ATRASO_MAIS_EXTRA,
  CENARIO_DIA_NORMAL,
  FAIXAS_MULTIPLAS,
  FAIXAS_PADRAO,
  montarDia,
} from "./apuracao.fixtures";
import { ResultadoApuracaoDiaria } from "./apuracao.types";

/** Estreita para o ramo `apurado` (falha o teste se veio `invalido`). */
function apurado(resultado: ResultadoApuracaoDiaria) {
  expect(resultado.status).toBe("apurado");
  if (resultado.status !== "apurado") {
    throw new Error(`esperava apurado, veio ${resultado.status}`);
  }
  return resultado;
}

describe("apurarDiaSintetico — cenários homologados (sintéticos)", () => {
  it("(a) dia normal: marcações batendo a jornada prevista, sem crédito/débito", () => {
    const r = apurado(apurarDiaSintetico(CENARIO_DIA_NORMAL));

    expect(r.jornadaPrevistaMinutos).toBe(480);
    expect(r.tempoEfetivoTrabalhadoMinutos).toBe(480);
    expect(r.jornadaComputadaMinutos).toBe(480);
    expect(r.creditoHoraExtraMinutos).toBe(0);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
    expect(r.diferencaNegativaBrutaMinutos).toBe(0);
    expect(r.toleranciaAplicada).toBe(false);
    expect(r.impactoBanco).toEqual({ creditoMinutos: 0, debitoMinutos: 0 });
    expect(r.apontamentos).toEqual([]);
  });

  it("(b) atraso + hora extra: crédito e débito separados, sem compensação", () => {
    const r = apurado(apurarDiaSintetico(CENARIO_ATRASO_MAIS_EXTRA));

    // 30 min de atraso no 1º bloco; 60 min além no 2º bloco.
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(30);
    expect(r.creditoHoraExtraMinutos).toBe(60);
    // Componentes permanecem separados — nada de líquido de 30.
    expect(r.impactoBanco).toEqual({ creditoMinutos: 60, debitoMinutos: 30 });
    expect(r.diferencaNegativaBrutaMinutos).toBe(30);
    expect(r.toleranciaAplicada).toBe(false);
  });

  it("(c) classificações sem cálculo por marcação: débito conforme a regra", () => {
    for (const classificacao of [
      "falta_justificada",
      "feriado",
      "folga",
      "ferias",
    ] as const) {
      const r = apurado(
        apurarDiaSintetico(CENARIOS_CLASSIFICACAO[classificacao]),
      );
      expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
      expect(r.impactoBanco).toEqual({ creditoMinutos: 0, debitoMinutos: 0 });
      expect(r.apontamentos).toEqual([]);
    }

    const injustificada = apurado(
      apurarDiaSintetico(CENARIOS_CLASSIFICACAO.falta_injustificada),
    );
    expect(injustificada.debitoAtrasoSaidaAntecipadaMinutos).toBe(480);
    expect(injustificada.impactoBanco).toEqual({
      creditoMinutos: 0,
      debitoMinutos: 480,
    });
    expect(injustificada.apontamentos).toEqual([
      { codigo: "dsr_desconto_sinalizado", financeiro: false },
    ]);

    const compensacao = apurado(
      apurarDiaSintetico(CENARIOS_CLASSIFICACAO.compensacao),
    );
    expect(compensacao.debitoAtrasoSaidaAntecipadaMinutos).toBe(480);
    expect(compensacao.impactoBanco).toEqual({
      creditoMinutos: 0,
      debitoMinutos: 480,
    });
    expect(compensacao.apontamentos).toEqual([]);
  });
});

describe("apurarDiaSintetico — tolerância de 15 min por dia", () => {
  it("atraso de exatamente 15 min: sem débito, jornada regular computada", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          marcacoes: ["08:15", "12:00", "14:00", "18:00"],
        }),
      ),
    );
    expect(r.diferencaNegativaBrutaMinutos).toBe(15);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
    expect(r.toleranciaAplicada).toBe(true);
    expect(TOLERANCIA_MINUTOS).toBe(15);
  });

  it("atraso de 16 min: débito sobre TODA a diferença, não só o excedente", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          marcacoes: ["08:16", "12:00", "14:00", "18:00"],
        }),
      ),
    );
    expect(r.diferencaNegativaBrutaMinutos).toBe(16);
    // 16, não 1 (excedente aos 15).
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(16);
    expect(r.toleranciaAplicada).toBe(false);
  });

  it("soma de atraso + saída antecipada acima de 15 min gera débito total", () => {
    // 10 min de atraso + 10 min de saída antecipada = 20 min.
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          marcacoes: ["08:10", "12:00", "14:00", "17:50"],
        }),
      ),
    );
    expect(r.diferencaNegativaBrutaMinutos).toBe(20);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(20);
  });
});

describe("apurarDiaSintetico — almoço livre (intervalo mínimo de 1h)", () => {
  const faixas = [
    { inicio: "08:00", fim: "12:00" },
    { inicio: "13:00", fim: "17:00" },
  ];
  // Só 30 min de almoço (12:00 → 12:30).
  const marcacoes = ["08:00", "12:00", "12:30", "17:00"];

  it("com almoço livre: considera 1h e reduz a jornada computada", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          faixasPrevistas: faixas,
          marcacoes,
          almocoLivre: true,
        }),
      ),
    );
    // Trabalho bruto = 8h30 (só almoçou 30 min); jornada computada = 8h.
    expect(r.tempoEfetivoTrabalhadoMinutos).toBe(510);
    expect(r.jornadaComputadaMinutos).toBe(480);
    // Os 30 min do almoço curto NÃO viram crédito.
    expect(r.creditoHoraExtraMinutos).toBe(0);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
    expect(ALMOCO_MINIMO_MINUTOS).toBe(60);
  });

  it("sem almoço livre: o retorno adiantado do almoço curto vira crédito", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          faixasPrevistas: faixas,
          marcacoes,
        }),
      ),
    );
    expect(r.tempoEfetivoTrabalhadoMinutos).toBe(510);
    expect(r.jornadaComputadaMinutos).toBe(510);
    // Retornou 30 min antes do previsto (12:30 vs 13:00) → crédito 30.
    expect(r.creditoHoraExtraMinutos).toBe(30);
  });
});

describe("apurarDiaSintetico — faixas múltiplas", () => {
  it("apura três faixas com marcações pontuais", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          faixasPrevistas: FAIXAS_MULTIPLAS,
          marcacoes: ["08:00", "10:00", "13:00", "15:00", "16:00", "18:00"],
        }),
      ),
    );
    expect(r.jornadaPrevistaMinutos).toBe(360);
    expect(r.tempoEfetivoTrabalhadoMinutos).toBe(360);
    expect(r.jornadaComputadaMinutos).toBe(360);
    expect(r.creditoHoraExtraMinutos).toBe(0);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
  });

  it("apura três faixas com atraso numa faixa intermediária", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          faixasPrevistas: FAIXAS_MULTIPLAS,
          // 20 min de atraso ao voltar para a 2ª faixa (13:20 vs 13:00).
          marcacoes: ["08:00", "10:00", "13:20", "15:00", "16:00", "18:00"],
        }),
      ),
    );
    expect(r.diferencaNegativaBrutaMinutos).toBe(20);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(20);
  });
});

describe("apurarDiaSintetico — entrada inválida (falha segura)", () => {
  const casos: ReadonlyArray<{
    nome: string;
    entrada: Parameters<typeof montarDia>[0];
    codigo: string;
  }> = [
    {
      nome: "faixa com horário fora de HH:MM",
      entrada: {
        classificacao: "regular",
        faixasPrevistas: [{ inicio: "08:60", fim: "12:00" }],
        marcacoes: ["08:00", "12:00"],
      },
      codigo: "FAIXA_HORARIO_INVALIDO",
    },
    {
      nome: "faixa com fim <= início",
      entrada: {
        classificacao: "regular",
        faixasPrevistas: [{ inicio: "12:00", fim: "08:00" }],
        marcacoes: ["08:00", "12:00"],
      },
      codigo: "FAIXA_INTERVALO_INVALIDO",
    },
    {
      nome: "faixas sobrepostas / fora de ordem",
      entrada: {
        classificacao: "regular",
        faixasPrevistas: [
          { inicio: "08:00", fim: "12:00" },
          { inicio: "11:00", fim: "15:00" },
        ],
        marcacoes: ["08:00", "12:00", "11:30", "15:00"],
      },
      codigo: "FAIXA_FORA_DE_ORDEM",
    },
    {
      nome: "marcação fora de HH:MM",
      entrada: {
        classificacao: "regular",
        marcacoes: ["08:00", "24:00"],
      },
      codigo: "MARCACAO_HORARIO_INVALIDO",
    },
    {
      nome: "marcações fora de ordem (repetidas)",
      entrada: {
        classificacao: "regular",
        marcacoes: ["08:00", "08:00", "14:00", "18:00"],
      },
      codigo: "MARCACAO_FORA_DE_ORDEM",
    },
    {
      nome: "marcações fora de ordem (decrescente)",
      entrada: {
        classificacao: "regular",
        marcacoes: ["12:00", "08:00", "14:00", "18:00"],
      },
      codigo: "MARCACAO_FORA_DE_ORDEM",
    },
    {
      nome: "dia regular com nº de marcações incompatível com as faixas",
      entrada: {
        classificacao: "regular",
        marcacoes: ["08:00", "12:00"], // 1 par para 2 faixas previstas
      },
      codigo: "MARCACOES_INCOMPATIVEIS_COM_FAIXAS",
    },
    {
      nome: "dia regular com nº ímpar de marcações",
      entrada: {
        classificacao: "regular",
        faixasPrevistas: [{ inicio: "08:00", fim: "12:00" }],
        marcacoes: ["08:00", "12:00", "14:00"],
      },
      codigo: "MARCACOES_INCOMPATIVEIS_COM_FAIXAS",
    },
    {
      nome: "almoço livre que inverteria o bloco seguinte",
      entrada: {
        classificacao: "regular",
        faixasPrevistas: [
          { inicio: "08:00", fim: "12:00" },
          { inicio: "12:20", fim: "13:00" },
        ],
        marcacoes: ["08:00", "12:00", "12:10", "12:40"],
        almocoLivre: true,
      },
      codigo: "ALMOCO_INVERTE_BLOCO",
    },
  ];

  for (const caso of casos) {
    it(`rejeita com segurança: ${caso.nome}`, () => {
      let resultado: ResultadoApuracaoDiaria | undefined;
      expect(() => {
        resultado = apurarDiaSintetico(montarDia(caso.entrada));
      }).not.toThrow();
      expect(resultado?.status).toBe("invalido");
      if (resultado?.status !== "invalido") return;
      expect(resultado.erro.codigo).toBe(caso.codigo);
    });
  }
});

describe("apurarDiaSintetico — alerta não financeiro de limite diário (CCT)", () => {
  // Faixa única de 10h (08:00–18:00): jornada computada = 600 min, on-time.
  const diaLongo = {
    classificacao: "regular" as const,
    faixasPrevistas: [{ inicio: "08:00", fim: "18:00" }],
    marcacoes: ["08:00", "18:00"],
  };

  it("sinaliza (sem bloquear/pagar) quando a jornada computada excede o limite", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({ ...diaLongo, limiteJornadaDiariaMinutos: 480 }),
      ),
    );
    // Continua apurado (não bloqueia) e não altera crédito/débito.
    expect(r.jornadaComputadaMinutos).toBe(600);
    expect(r.creditoHoraExtraMinutos).toBe(0);
    expect(r.debitoAtrasoSaidaAntecipadaMinutos).toBe(0);
    expect(r.apontamentos).toEqual([
      { codigo: "alerta_jornada_diaria_excedida", financeiro: false },
    ]);
    // O alerta é NÃO financeiro.
    for (const apontamento of r.apontamentos) {
      expect(apontamento.financeiro).toBe(false);
    }
  });

  it("não sinaliza quando a jornada computada é igual ou inferior ao limite", () => {
    const igual = apurado(
      apurarDiaSintetico(
        montarDia({ ...diaLongo, limiteJornadaDiariaMinutos: 600 }),
      ),
    );
    expect(igual.apontamentos).toEqual([]);

    const acima = apurado(
      apurarDiaSintetico(
        montarDia({ ...diaLongo, limiteJornadaDiariaMinutos: 601 }),
      ),
    );
    expect(acima.apontamentos).toEqual([]);
  });

  it("não sinaliza quando nenhum limite é configurado", () => {
    const r = apurado(apurarDiaSintetico(montarDia(diaLongo)));
    expect(r.apontamentos).toEqual([]);
  });
});

describe("apurarDiaSintetico — feriado trabalhado (sinalizado, não regular)", () => {
  it("feriado com marcações: sinaliza sem calcular crédito/débito", () => {
    const r = apurado(
      apurarDiaSintetico(
        montarDia({
          classificacao: "feriado",
          marcacoes: ["08:00", "12:00", "14:00", "18:00"],
        }),
      ),
    );
    // Não é tratado como dia regular: nada é apurado a partir das marcações.
    expect(r.tempoEfetivoTrabalhadoMinutos).toBe(0);
    expect(r.jornadaComputadaMinutos).toBe(0);
    expect(r.impactoBanco).toEqual({ creditoMinutos: 0, debitoMinutos: 0 });
    expect(r.apontamentos).toEqual([
      { codigo: "feriado_trabalhado_sinalizado", financeiro: false },
    ]);
  });

  it("feriado sem marcações: nenhum apontamento", () => {
    const r = apurado(
      apurarDiaSintetico(montarDia({ classificacao: "feriado" })),
    );
    expect(r.apontamentos).toEqual([]);
  });
});

describe("apuração — sem efeito financeiro na saída", () => {
  it("nenhum resultado expõe valor/percentual/pagamento/salário/Folha", () => {
    const resultados = [
      apurarDiaSintetico(CENARIO_ATRASO_MAIS_EXTRA),
      apurarDiaSintetico(
        montarDia({
          classificacao: "regular",
          faixasPrevistas: [{ inicio: "08:00", fim: "18:00" }],
          marcacoes: ["08:00", "18:00"],
          limiteJornadaDiariaMinutos: 480,
        }),
      ),
      apurarDiaSintetico(
        montarDia({
          classificacao: "feriado",
          marcacoes: ["08:00", "12:00"],
        }),
      ),
    ];
    for (const resultado of resultados) {
      const texto = JSON.stringify(resultado).toLowerCase();
      for (const termoProibido of [
        "valor",
        "percentual",
        "pagamento",
        "salario",
        "salário",
        "reais",
        "dinheiro",
        "folha",
        "monet",
      ]) {
        expect(texto).not.toContain(termoProibido);
      }
    }
  });
});

describe("apuração — pureza (sem framework nem dado real)", () => {
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

  it("o núcleo importa apenas módulos relativos próprios (sem NestJS/Prisma/I/O)", () => {
    for (const arquivo of ["apuracao.ts", "apuracao.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("não referencia CPF, nome real, empresa real ou dado real na saída", () => {
    const r = apurado(apurarDiaSintetico(CENARIO_ATRASO_MAIS_EXTRA));
    const texto = JSON.stringify(r).toLowerCase();
    for (const termoProibido of ["cpf", "secullum", "rwtech", "bioprox"]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("usa a jornada prevista padrão de 480 min (fixture sintética)", () => {
    const previstaTotal = FAIXAS_PADRAO.reduce((total, faixa) => {
      const [hi, mi] = faixa.inicio.split(":");
      const [hf, mf] = faixa.fim.split(":");
      const ini = Number(hi) * 60 + Number(mi);
      const fim = Number(hf) * 60 + Number(mf);
      return total + (fim - ini);
    }, 0);
    expect(previstaTotal).toBe(480);
  });
});
