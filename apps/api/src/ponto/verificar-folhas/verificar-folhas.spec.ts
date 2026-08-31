import { readFileSync } from "fs";
import { join } from "path";
import {
  aplicarSequenciaPendencia,
  ehTerminal,
  transicionarPendencia,
} from "./verificar-folhas";
import {
  PENDENCIA_IMPORTACAO_NAO_ASSOCIADA,
  PENDENCIA_JORNADA_INCOMPLETA,
  PERCURSO_DESCARTADA,
  PERCURSO_RESOLVIDA,
} from "./verificar-folhas.fixtures";
import {
  AcaoPendencia,
  EstadoPendencia,
  Pendencia,
  ResultadoTransicaoPendencia,
} from "./verificar-folhas.types";

/** Estreita para o ramo `transicionado` (falha o teste se veio `invalido`). */
function transicionado(resultado: ResultadoTransicaoPendencia) {
  expect(resultado.status).toBe("transicionado");
  if (resultado.status !== "transicionado") {
    throw new Error(`esperava transicionado, veio ${resultado.status}`);
  }
  return resultado;
}

describe("transicionarPendencia — ciclos válidos", () => {
  it("aberta → em_revisao_rh → resolvida_sem_alteracao_automatica", () => {
    const historico = aplicarSequenciaPendencia(
      PENDENCIA_JORNADA_INCOMPLETA,
      PERCURSO_RESOLVIDA,
    );
    expect(historico.erro).toBeNull();
    expect(historico.pendencia.situacao).toBe(
      "resolvida_sem_alteracao_automatica",
    );
    expect(ehTerminal(historico.pendencia.situacao)).toBe(true);
    expect(historico.eventos.map((e) => e.estadoPara)).toEqual([
      "em_revisao_rh",
      "resolvida_sem_alteracao_automatica",
    ]);
  });

  it("aberta → em_revisao_rh → descartada_por_erro_tecnico", () => {
    const historico = aplicarSequenciaPendencia(
      PENDENCIA_IMPORTACAO_NAO_ASSOCIADA,
      PERCURSO_DESCARTADA,
    );
    expect(historico.erro).toBeNull();
    expect(historico.pendencia.situacao).toBe("descartada_por_erro_tecnico");
    expect(ehTerminal(historico.pendencia.situacao)).toBe(true);
  });

  it("aguardando_informacao pode retomar, resolver ou descartar", () => {
    const emRevisao = transicionado(
      transicionarPendencia(
        PENDENCIA_JORNADA_INCOMPLETA,
        "iniciar_revisao",
        "rh",
        "AUD-1",
      ),
    ).pendencia;
    const aguardando = transicionado(
      transicionarPendencia(emRevisao, "aguardar_informacao", "rh", "AUD-2"),
    ).pendencia;
    expect(aguardando.situacao).toBe("aguardando_informacao");
    expect(
      transicionado(
        transicionarPendencia(aguardando, "retomar_revisao", "rh", "AUD-3"),
      ).pendencia.situacao,
    ).toBe("em_revisao_rh");
    expect(
      transicionado(
        transicionarPendencia(aguardando, "resolver_sem_alteracao", "rh", "A4"),
      ).pendencia.situacao,
    ).toBe("resolvida_sem_alteracao_automatica");
  });

  it("cada transição emite evento técnico com estado de/para e papel", () => {
    const r = transicionado(
      transicionarPendencia(
        PENDENCIA_JORNADA_INCOMPLETA,
        "iniciar_revisao",
        "rh",
        "AUD-1",
      ),
    );
    expect(r.evento).toEqual({
      pendenciaId: "PEND-DEMO-0001",
      acao: "iniciar_revisao",
      estadoDe: "aberta",
      estadoPara: "em_revisao_rh",
      papel: "rh",
      refAuditoria: "AUD-1",
    });
  });
});

describe("transicionarPendencia — transições inválidas e terminal", () => {
  it("transição fora de ordem falha (resolver direto de aberta)", () => {
    const r = transicionarPendencia(
      PENDENCIA_JORNADA_INCOMPLETA,
      "resolver_sem_alteracao",
      "rh",
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
  });

  it("estado terminal não admite nova transição", () => {
    const terminal: Pendencia = {
      ...PENDENCIA_JORNADA_INCOMPLETA,
      situacao: "resolvida_sem_alteracao_automatica",
    };
    const r = transicionarPendencia(terminal, "iniciar_revisao", "rh", "AUD-1");
    expect(r.status).toBe("invalido");
    if (r.status !== "invalido") return;
    expect(r.erro.codigo).toBe("ESTADO_TERMINAL");
  });
});

describe("transicionarPendencia — imutabilidade e histórico técnico", () => {
  it("não muta a pendência de entrada; devolve nova versão", () => {
    const congelada = Object.freeze({ ...PENDENCIA_JORNADA_INCOMPLETA });
    const r = transicionado(
      transicionarPendencia(congelada, "iniciar_revisao", "rh", "AUD-X"),
    );
    expect(congelada.situacao).toBe("aberta");
    expect(congelada.refAuditoria).toBe("AUD-DEMO-0000");
    expect(r.pendencia).not.toBe(congelada);
    expect(r.pendencia.situacao).toBe("em_revisao_rh");
  });

  it("aplicarSequenciaPendencia acumula histórico sem mutar a inicial", () => {
    const inicial = Object.freeze({ ...PENDENCIA_JORNADA_INCOMPLETA });
    const historico = aplicarSequenciaPendencia(inicial, PERCURSO_RESOLVIDA);
    expect(historico.eventos).toHaveLength(2);
    expect(inicial.situacao).toBe("aberta");
  });
});

describe("transicionarPendencia — permissão exclusiva para rh", () => {
  for (const papel of [
    "master_tecnico",
    "dp",
    "gestor",
    "colaborador",
  ] as const) {
    it(`nega transição para papel ${papel}`, () => {
      const r = transicionarPendencia(
        PENDENCIA_JORNADA_INCOMPLETA,
        "iniciar_revisao",
        papel,
        "AUD-1",
      );
      expect(r.status).toBe("invalido");
      if (r.status !== "invalido") return;
      expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
    });
  }
});

describe("transicionarPendencia — severidade é só priorização", () => {
  it("severidades diferentes não mudam o resultado nem bloqueiam", () => {
    for (const severidade of ["informativa", "atencao", "critica"] as const) {
      const pendencia: Pendencia = {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        severidade,
      };
      const r = transicionado(
        transicionarPendencia(pendencia, "iniciar_revisao", "rh", "AUD-1"),
      );
      // O núcleo copia a severidade sem recalcular; a transição não depende dela.
      expect(r.pendencia.severidade).toBe(severidade);
      expect(r.pendencia.situacao).toBe("em_revisao_rh");
    }
  });
});

describe("transicionarPendencia — fail-closed (rejeição segura)", () => {
  function pendencia(parcial: Partial<Pendencia>): Pendencia {
    return { ...PENDENCIA_JORNADA_INCOMPLETA, ...parcial } as Pendencia;
  }

  const casos: ReadonlyArray<{
    nome: string;
    pendencia: Pendencia;
    acao: AcaoPendencia;
    refAuditoria: string;
    codigo: string;
  }> = [
    {
      nome: "id vazio",
      pendencia: pendencia({ id: "  " }),
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "refAuditoria da transição vazia",
      pendencia: PENDENCIA_JORNADA_INCOMPLETA,
      acao: "iniciar_revisao",
      refAuditoria: "   ",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "data inválida",
      pendencia: pendencia({ periodoReferencia: "2026-02-30" }),
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "DATA_INVALIDA",
    },
    {
      nome: "tipo desconhecido",
      pendencia: {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        tipo: "tipo_inexistente",
      } as unknown as Pendencia,
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "TIPO_DESCONHECIDO",
    },
    {
      nome: "severidade desconhecida",
      pendencia: {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        severidade: "urgentissima",
      } as unknown as Pendencia,
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "SEVERIDADE_DESCONHECIDA",
    },
    {
      nome: "origem desconhecida",
      pendencia: {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        origem: "planilha",
      } as unknown as Pendencia,
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "ORIGEM_DESCONHECIDA",
    },
    {
      nome: "motivo desconhecido",
      pendencia: {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        motivo: "porque_sim",
      } as unknown as Pendencia,
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "MOTIVO_DESCONHECIDO",
    },
    {
      nome: "estado desconhecido",
      pendencia: {
        ...PENDENCIA_JORNADA_INCOMPLETA,
        situacao: "estado_x",
      } as unknown as Pendencia,
      acao: "iniciar_revisao",
      refAuditoria: "AUD-1",
      codigo: "ESTADO_DESCONHECIDO",
    },
    {
      nome: "ação desconhecida",
      pendencia: PENDENCIA_JORNADA_INCOMPLETA,
      acao: "explodir" as unknown as AcaoPendencia,
      refAuditoria: "AUD-1",
      codigo: "ACAO_DESCONHECIDA",
    },
  ];

  for (const caso of casos) {
    it(`rejeita com segurança: ${caso.nome}`, () => {
      let resultado: ResultadoTransicaoPendencia | undefined;
      expect(() => {
        resultado = transicionarPendencia(
          caso.pendencia,
          caso.acao,
          "rh",
          caso.refAuditoria,
        );
      }).not.toThrow();
      expect(resultado?.status).toBe("invalido");
      if (resultado?.status !== "invalido") return;
      expect(resultado.erro.codigo).toBe(caso.codigo);
      expect("pendencia" in resultado).toBe(false);
      expect("evento" in resultado).toBe(false);
    });
  }
});

describe("verificar-folhas — não toca núcleos T050/T052/T054/T057 nem saldo", () => {
  it("nenhum resultado expõe movimento, saldo, extrato, débito ou fechamento", () => {
    const historico = aplicarSequenciaPendencia(
      PENDENCIA_JORNADA_INCOMPLETA,
      PERCURSO_RESOLVIDA,
    );
    const texto = JSON.stringify(historico).toLowerCase();
    for (const termoProibido of [
      "movimento",
      "saldo",
      "extrato",
      "debito",
      "credito",
      "fechado_operacionalmente",
      "debitominutos",
      "creditominutos",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("verificar-folhas — pureza e ausência de dados financeiros/pessoais", () => {
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
    for (const arquivo of [
      "verificar-folhas.ts",
      "verificar-folhas.types.ts",
    ]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("o núcleo não importa T050/T052/T054/T057", () => {
    const fonte = readFileSync(join(__dirname, "verificar-folhas.ts"), "utf8");
    for (const proibido of [
      "apuracao",
      "banco-horas",
      "compensacao",
      "fechamento",
    ]) {
      expect(fonte).not.toContain(`/${proibido}`);
    }
  });

  it("nenhuma saída expõe dinheiro/Folha/pagamento nem CPF/nome", () => {
    const r = transicionarPendencia(
      PENDENCIA_JORNADA_INCOMPLETA,
      "iniciar_revisao",
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
      "secullum",
      "rwtech",
      "bioprox",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("ehTerminal só reconhece os dois estados terminais", () => {
    for (const estado of [
      "resolvida_sem_alteracao_automatica",
      "descartada_por_erro_tecnico",
    ] as const) {
      expect(ehTerminal(estado)).toBe(true);
    }
    for (const estado of [
      "aberta",
      "em_revisao_rh",
      "aguardando_informacao",
    ] as const) {
      expect(ehTerminal(estado as EstadoPendencia)).toBe(false);
    }
  });
});
