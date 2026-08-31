import { readFileSync } from "fs";
import { join } from "path";
import { aplicarSequencia, ehTerminal, transicionar } from "./compensacao";
import { PROPOSTA_RASCUNHO } from "./compensacao.fixtures";
import {
  AcaoProposta,
  EstadoProposta,
  PropostaCompensacao,
  ResultadoTransicao,
} from "./compensacao.types";

/** Estreita para o ramo `transicionado` (falha o teste se veio `invalido`). */
function transicionado(resultado: ResultadoTransicao) {
  expect(resultado.status).toBe("transicionado");
  if (resultado.status !== "transicionado") {
    throw new Error(`esperava transicionado, veio ${resultado.status}`);
  }
  return resultado;
}

describe("transicionar — transições válidas", () => {
  it("rascunho → submetida_para_revisao (por rh), com nova versão e evento", () => {
    const r = transicionado(
      transicionar(PROPOSTA_RASCUNHO, "submeter", "rh", "AUD-DEMO-0001"),
    );
    expect(r.proposta.situacao).toBe("submetida_para_revisao");
    expect(r.proposta.refAuditoria).toBe("AUD-DEMO-0001");
    expect(r.evento).toEqual({
      propostaId: "COMP-DEMO-0001",
      acao: "submeter",
      estadoDe: "rascunho",
      estadoPara: "submetida_para_revisao",
      papel: "rh",
      refAuditoria: "AUD-DEMO-0001",
    });
  });

  it("submetida_para_revisao → aprovada_para_registro", () => {
    const submetida = transicionado(
      transicionar(PROPOSTA_RASCUNHO, "submeter", "rh", "AUD-1"),
    ).proposta;
    const r = transicionado(transicionar(submetida, "aprovar", "rh", "AUD-2"));
    expect(r.proposta.situacao).toBe("aprovada_para_registro");
    expect(ehTerminal(r.proposta.situacao)).toBe(true);
  });

  it("submetida_para_revisao → recusada e → cancelada", () => {
    const submetida = transicionado(
      transicionar(PROPOSTA_RASCUNHO, "submeter", "rh", "AUD-1"),
    ).proposta;
    expect(
      transicionado(transicionar(submetida, "recusar", "rh", "AUD-2")).proposta
        .situacao,
    ).toBe("recusada");
    expect(
      transicionado(transicionar(submetida, "cancelar", "rh", "AUD-3")).proposta
        .situacao,
    ).toBe("cancelada");
  });

  it("rascunho → cancelada", () => {
    const r = transicionado(
      transicionar(PROPOSTA_RASCUNHO, "cancelar", "rh", "AUD-9"),
    );
    expect(r.proposta.situacao).toBe("cancelada");
  });
});

describe("transicionar — imutabilidade e histórico técnico", () => {
  it("não muta a proposta de entrada; devolve nova versão", () => {
    const congelada = Object.freeze({ ...PROPOSTA_RASCUNHO });
    const r = transicionado(transicionar(congelada, "submeter", "rh", "AUD-X"));
    // Entrada intacta.
    expect(congelada.situacao).toBe("rascunho");
    expect(congelada.refAuditoria).toBe("AUD-DEMO-0000");
    // Nova versão é outro objeto.
    expect(r.proposta).not.toBe(congelada);
    expect(r.proposta.situacao).toBe("submetida_para_revisao");
  });

  it("aplicarSequencia acumula histórico de eventos sem mutar a inicial", () => {
    const inicial = Object.freeze({ ...PROPOSTA_RASCUNHO });
    const historico = aplicarSequencia(inicial, [
      { acao: "submeter", papel: "rh", refAuditoria: "AUD-1" },
      { acao: "aprovar", papel: "rh", refAuditoria: "AUD-2" },
    ]);
    expect(historico.erro).toBeNull();
    expect(historico.proposta.situacao).toBe("aprovada_para_registro");
    expect(historico.eventos.map((e) => e.estadoPara)).toEqual([
      "submetida_para_revisao",
      "aprovada_para_registro",
    ]);
    // Inicial preservada.
    expect(inicial.situacao).toBe("rascunho");
  });
});

describe("transicionar — permissão exclusiva para rh", () => {
  for (const papel of [
    "master_tecnico",
    "dp",
    "gestor",
    "colaborador",
  ] as const) {
    it(`nega transição para papel ${papel}`, () => {
      const r = transicionar(PROPOSTA_RASCUNHO, "submeter", papel, "AUD-1");
      expect(r.status).toBe("invalido");
      if (r.status !== "invalido") return;
      expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
    });
  }
});

describe("transicionar — fail-closed (rejeição segura)", () => {
  function proposta(
    parcial: Partial<PropostaCompensacao>,
  ): PropostaCompensacao {
    return { ...PROPOSTA_RASCUNHO, ...parcial } as PropostaCompensacao;
  }

  const casos: ReadonlyArray<{
    nome: string;
    proposta: PropostaCompensacao;
    acao: AcaoProposta;
    refAuditoria: string;
    codigo: string;
  }> = [
    {
      nome: "id vazio",
      proposta: proposta({ id: "   " }),
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "empresaRef vazio",
      proposta: proposta({ empresaRef: "" }),
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "refAuditoria da transição vazia",
      proposta: PROPOSTA_RASCUNHO,
      acao: "submeter",
      refAuditoria: "  ",
      codigo: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "período inválido",
      proposta: proposta({ periodoReferencia: "2026-02-30" }),
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "PERIODO_INVALIDO",
    },
    {
      nome: "minutos não inteiros",
      proposta: proposta({ minutosPropostos: 12.5 }),
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "MINUTOS_INVALIDOS",
    },
    {
      nome: "minutos não positivos",
      proposta: proposta({ minutosPropostos: 0 }),
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "MINUTOS_INVALIDOS",
    },
    {
      nome: "justificativa fora do catálogo",
      proposta: {
        ...PROPOSTA_RASCUNHO,
        justificativa: "texto livre proibido",
      } as unknown as PropostaCompensacao,
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "JUSTIFICATIVA_DESCONHECIDA",
    },
    {
      nome: "estado desconhecido",
      proposta: {
        ...PROPOSTA_RASCUNHO,
        situacao: "estado_inexistente",
      } as unknown as PropostaCompensacao,
      acao: "submeter",
      refAuditoria: "AUD-1",
      codigo: "ESTADO_DESCONHECIDO",
    },
    {
      nome: "ação desconhecida",
      proposta: PROPOSTA_RASCUNHO,
      acao: "detonar" as unknown as AcaoProposta,
      refAuditoria: "AUD-1",
      codigo: "ACAO_DESCONHECIDA",
    },
    {
      nome: "transição inválida (aprovar a partir de rascunho)",
      proposta: PROPOSTA_RASCUNHO,
      acao: "aprovar",
      refAuditoria: "AUD-1",
      codigo: "TRANSICAO_INVALIDA",
    },
    {
      nome: "transição a partir de estado terminal",
      proposta: proposta({ situacao: "aprovada_para_registro" }),
      acao: "cancelar",
      refAuditoria: "AUD-1",
      codigo: "ESTADO_TERMINAL",
    },
  ];

  for (const caso of casos) {
    it(`rejeita com segurança: ${caso.nome}`, () => {
      let resultado: ResultadoTransicao | undefined;
      expect(() => {
        resultado = transicionar(
          caso.proposta,
          caso.acao,
          "rh",
          caso.refAuditoria,
        );
      }).not.toThrow();
      expect(resultado?.status).toBe("invalido");
      if (resultado?.status !== "invalido") return;
      expect(resultado.erro.codigo).toBe(caso.codigo);
      // Fail-closed: nenhuma proposta/evento no ramo inválido.
      expect("proposta" in resultado).toBe(false);
      expect("evento" in resultado).toBe(false);
    });
  }
});

describe("compensação — não cria movimento nem toca T052/saldo", () => {
  it("proposta aprovada não expõe débito, movimento, saldo ou extrato", () => {
    const aprovada = aplicarSequencia(PROPOSTA_RASCUNHO, [
      { acao: "submeter", papel: "rh", refAuditoria: "AUD-1" },
      { acao: "aprovar", papel: "rh", refAuditoria: "AUD-2" },
    ]);
    expect(aprovada.proposta.situacao).toBe("aprovada_para_registro");
    // A proposta aprovada NÃO carrega estruturas de movimento/extrato do T052.
    // (Termos estruturais; "saldo" isolado não é checado porque aparece como
    // substring legítima do código de justificativa `compensacao_saldo_positivo`.)
    const texto = JSON.stringify(aprovada).toLowerCase();
    for (const termoProibido of [
      "debito_compensacao",
      "movimento",
      "extrato",
      "saldominutos",
      "saldoacumulado",
      "debitominutos",
      "creditominutos",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("recusada e cancelada não geram débito", () => {
    const recusada = aplicarSequencia(PROPOSTA_RASCUNHO, [
      { acao: "submeter", papel: "rh", refAuditoria: "AUD-1" },
      { acao: "recusar", papel: "rh", refAuditoria: "AUD-2" },
    ]);
    const cancelada = aplicarSequencia(PROPOSTA_RASCUNHO, [
      { acao: "cancelar", papel: "rh", refAuditoria: "AUD-1" },
    ]);
    for (const h of [recusada, cancelada]) {
      const texto = JSON.stringify(h).toLowerCase();
      expect(texto).not.toContain("debito_compensacao");
      expect(texto).not.toContain("movimento");
      expect(texto).not.toContain("extrato");
    }
  });
});

describe("compensação — pureza e ausência de dados financeiros/pessoais", () => {
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
    for (const arquivo of ["compensacao.ts", "compensacao.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("nenhuma saída expõe dinheiro/Folha/pagamento nem CPF/nome", () => {
    const r = transicionar(PROPOSTA_RASCUNHO, "submeter", "rh", "AUD-1");
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

  it("estados terminais são reconhecidos por ehTerminal", () => {
    for (const estado of [
      "aprovada_para_registro",
      "recusada",
      "cancelada",
    ] as const) {
      expect(ehTerminal(estado)).toBe(true);
    }
    for (const estado of ["rascunho", "submetida_para_revisao"] as const) {
      expect(ehTerminal(estado as EstadoProposta)).toBe(false);
    }
  });
});
