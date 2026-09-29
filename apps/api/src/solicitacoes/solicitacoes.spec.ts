import { readFileSync } from "fs";
import { join } from "path";

import {
  aplicarSequenciaSolicitacao,
  ehReabrivel,
  ehTerminal,
  transicionarSolicitacao,
} from "./solicitacoes";
import {
  ATOR_COLABORADOR,
  ATOR_COLABORADOR_OUTRO,
  ATOR_RH,
  ATOR_RH_OUTRA_EMPRESA,
  PERCURSO_ATESTADO_EM_REVISAO,
  PERCURSO_CONTESTACAO_ENCAMINHADA,
  PERCURSO_RECUSADA_E_REABERTA,
  SOLICITACAO_ATESTADO,
  SOLICITACAO_CONTESTACAO,
} from "./solicitacoes.fixtures";
import {
  AcaoSolicitacao,
  EstadoSolicitacao,
  ResultadoTransicaoSolicitacao,
  Solicitacao,
} from "./solicitacoes.types";

/** Narrowing helper: garante `status === "transicionada"` (ou falha o teste). */
function transicionada(
  resultado: ResultadoTransicaoSolicitacao,
): Extract<ResultadoTransicaoSolicitacao, { status: "transicionada" }> {
  if (resultado.status !== "transicionada") {
    throw new Error(`esperava transicionada, veio ${resultado.status}`);
  }
  return resultado;
}

describe("solicitacoes — fluxo de contestação encaminhada pelo RH", () => {
  it("colaborador envia e RH encaminha, sem alterar marcação ou saldo", () => {
    const historico = aplicarSequenciaSolicitacao(
      SOLICITACAO_CONTESTACAO,
      PERCURSO_CONTESTACAO_ENCAMINHADA,
    );
    expect(historico.erro).toBeNull();
    expect(historico.solicitacao.situacao).toBe("encaminhada_para_operacao_rh");
    expect(historico.eventos).toHaveLength(3);
    expect(historico.eventos.map((e) => e.estadoPara)).toEqual([
      "enviada",
      "em_revisao_rh",
      "encaminhada_para_operacao_rh",
    ]);

    // Nenhum efeito operacional: a saída expõe só a máquina de estados, sem
    // saldo, débito, banco de horas, fechamento ou espelho. (O motivo
    // codificado `divergencia_marcacao` é rótulo técnico, não correção.)
    const texto = JSON.stringify(historico).toLowerCase();
    for (const termoProibido of [
      "saldo",
      "debito",
      "credito",
      "banco",
      "fechamento",
      "espelho",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("cada passo do encaminhamento é só mudança de estado (sem mutação)", () => {
    const r1 = transicionada(
      transicionarSolicitacao(
        SOLICITACAO_CONTESTACAO,
        "enviar",
        ATOR_COLABORADOR,
        "AUD-1",
      ),
    );
    expect(r1.solicitacao.situacao).toBe("enviada");
    // a entrada não é mutada (imutabilidade)
    expect(SOLICITACAO_CONTESTACAO.situacao).toBe("rascunho");
    expect(r1.evento.estadoDe).toBe("rascunho");
    expect(r1.evento.estadoPara).toBe("enviada");
    expect(r1.evento.papel).toBe("colaborador");
  });
});

describe("solicitacoes — atestado sem anexo e sem conteúdo clínico", () => {
  it("atestado anda por estado, sem período, anexo ou dado de saúde", () => {
    const historico = aplicarSequenciaSolicitacao(
      SOLICITACAO_ATESTADO,
      PERCURSO_ATESTADO_EM_REVISAO,
    );
    expect(historico.erro).toBeNull();
    expect(historico.solicitacao.situacao).toBe("em_revisao_rh");
    expect(historico.solicitacao.periodoReferencia).toBeNull();

    // `PD-SOL-05`: atestado NÃO coleta diagnóstico, CID nem descrição clínica.
    // O tipo é só um rótulo técnico do catálogo — nada de saúde trafega aqui.
    const texto = JSON.stringify(historico).toLowerCase();
    for (const termoProibido of [
      "anexo",
      "arquivo",
      "upload",
      "download",
      "imagem",
      ".pdf",
      "assinatura",
      "base64",
      "diagnostico",
      "diagnóstico",
      "cid-",
      "clinic",
      "clínic",
      "doenca",
      "doença",
      "medic",
      "médic",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("solicitacoes — escopo por vínculo e empresa", () => {
  it("colaborador de outro vínculo não opera a solicitação", () => {
    const r = transicionarSolicitacao(
      SOLICITACAO_CONTESTACAO,
      "enviar",
      ATOR_COLABORADOR_OUTRO,
      "AUD-X",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("ATOR_FORA_DO_ESCOPO");
    }
  });

  it("RH de outra empresa não opera a solicitação", () => {
    // Leva a solicitação a `enviada` para uma ação de RH ser cabível.
    const enviada = transicionada(
      transicionarSolicitacao(
        SOLICITACAO_CONTESTACAO,
        "enviar",
        ATOR_COLABORADOR,
        "AUD-1",
      ),
    ).solicitacao;
    const r = transicionarSolicitacao(
      enviada,
      "iniciar_revisao",
      ATOR_RH_OUTRA_EMPRESA,
      "AUD-2",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("ATOR_FORA_DO_ESCOPO");
    }
  });
});

describe("solicitacoes — papéis negados para mutação", () => {
  for (const papel of ["master_tecnico", "dp", "gestor"] as const) {
    it(`nega ${papel} em qualquer ação`, () => {
      const r = transicionarSolicitacao(
        SOLICITACAO_CONTESTACAO,
        "enviar",
        { papel, empresaRef: "EMP-A", vinculoRef: "V-001" },
        "AUD-X",
      );
      expect(r.status).toBe("invalido");
      if (r.status === "invalido") {
        expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
      }
    });
  }

  it("colaborador não executa ação de RH (iniciar_revisao)", () => {
    const enviada = transicionada(
      transicionarSolicitacao(
        SOLICITACAO_CONTESTACAO,
        "enviar",
        ATOR_COLABORADOR,
        "AUD-1",
      ),
    ).solicitacao;
    const r = transicionarSolicitacao(
      enviada,
      "iniciar_revisao",
      ATOR_COLABORADOR,
      "AUD-2",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
    }
  });
});

describe("solicitacoes — transições válidas, inválidas e terminais", () => {
  it("percorre o ramo aguardando_informacao → em_revisao_rh → recusada", () => {
    const historico = aplicarSequenciaSolicitacao(SOLICITACAO_CONTESTACAO, [
      { acao: "enviar", ator: ATOR_COLABORADOR, refAuditoria: "AUD-1" },
      { acao: "iniciar_revisao", ator: ATOR_RH, refAuditoria: "AUD-2" },
      { acao: "aguardar_informacao", ator: ATOR_RH, refAuditoria: "AUD-3" },
      { acao: "retomar_revisao", ator: ATOR_RH, refAuditoria: "AUD-4" },
      { acao: "recusar", ator: ATOR_RH, refAuditoria: "AUD-5" },
    ]);
    expect(historico.erro).toBeNull();
    expect(historico.solicitacao.situacao).toBe("recusada");
  });

  it("colaborador cancela a própria solicitação em rascunho", () => {
    const r = transicionada(
      transicionarSolicitacao(
        SOLICITACAO_CONTESTACAO,
        "cancelar",
        ATOR_COLABORADOR,
        "AUD-1",
      ),
    );
    expect(r.solicitacao.situacao).toBe("cancelada");
  });

  it("rejeita transição fora de ordem (encaminhar a partir de rascunho)", () => {
    const r = transicionarSolicitacao(
      SOLICITACAO_CONTESTACAO,
      "encaminhar_para_operacao",
      ATOR_RH,
      "AUD-X",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
    }
  });

  it("rejeita transição a partir de estado terminal", () => {
    const encaminhada: Solicitacao = {
      ...SOLICITACAO_CONTESTACAO,
      situacao: "encaminhada_para_operacao_rh",
    };
    const r = transicionarSolicitacao(
      encaminhada,
      "iniciar_revisao",
      ATOR_RH,
      "AUD-X",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("ESTADO_TERMINAL");
    }
  });

  it("ehTerminal reconhece só os três estados terminais", () => {
    for (const estado of [
      "encaminhada_para_operacao_rh",
      "recusada",
      "cancelada",
    ] as const) {
      expect(ehTerminal(estado)).toBe(true);
    }
    for (const estado of [
      "rascunho",
      "enviada",
      "em_revisao_rh",
      "aguardando_informacao",
    ] as const) {
      expect(ehTerminal(estado as EstadoSolicitacao)).toBe(false);
    }
  });
});

describe("solicitacoes — catálogo aprovado (PD-SOL-01)", () => {
  it("aceita os seis tipos aprovados", () => {
    for (const tipo of [
      "contestacao_ajuste_ponto",
      "ausencia",
      "ferias",
      "atualizacao_cadastral",
      "atestado",
      "beneficios",
    ] as const) {
      const r = transicionarSolicitacao(
        { ...SOLICITACAO_CONTESTACAO, tipo },
        "enviar",
        ATOR_COLABORADOR,
        "AUD-1",
      );
      expect(r.status).toBe("transicionada");
    }
  });

  it("rejeita `documento`, que saiu do catálogo e ficou em solicitacoes-documento", () => {
    const r = transicionarSolicitacao(
      { ...SOLICITACAO_CONTESTACAO, tipo: "documento" as Solicitacao["tipo"] },
      "enviar",
      ATOR_COLABORADOR,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("TIPO_DESCONHECIDO");
    }
  });
});

describe("solicitacoes — cancelamento e reabertura (PD-SOL-03)", () => {
  function em(situacao: EstadoSolicitacao): Solicitacao {
    return { ...SOLICITACAO_CONTESTACAO, situacao };
  }

  it("cancela em rascunho e em enviada (antes de em_revisao_rh)", () => {
    for (const situacao of ["rascunho", "enviada"] as const) {
      const r = transicionada(
        transicionarSolicitacao(
          em(situacao),
          "cancelar",
          ATOR_COLABORADOR,
          "AUD-1",
        ),
      );
      expect(r.solicitacao.situacao).toBe("cancelada");
    }
  });

  it("NÃO cancela em em_revisao_rh — depois do marco não há cancelamento livre", () => {
    const r = transicionarSolicitacao(
      em("em_revisao_rh"),
      "cancelar",
      ATOR_COLABORADOR,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
    }
  });

  it("NÃO cancela em aguardando_informacao — transição do desenho anterior, revogada", () => {
    const r = transicionarSolicitacao(
      em("aguardando_informacao"),
      "cancelar",
      ATOR_COLABORADOR,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("TRANSICAO_INVALIDA");
    }
  });

  it("RH reabre encaminhada_para_operacao_rh ('encerrada') para em_revisao_rh", () => {
    const r = transicionada(
      transicionarSolicitacao(
        em("encaminhada_para_operacao_rh"),
        "reabrir",
        ATOR_RH,
        "AUD-1",
      ),
    );
    expect(r.solicitacao.situacao).toBe("em_revisao_rh");
    expect(r.evento.estadoDe).toBe("encaminhada_para_operacao_rh");
    expect(r.evento.papel).toBe("rh");
  });

  it("RH reabre recusada para em_revisao_rh, preservando o histórico", () => {
    const historico = aplicarSequenciaSolicitacao(
      SOLICITACAO_CONTESTACAO,
      PERCURSO_RECUSADA_E_REABERTA,
    );
    expect(historico.erro).toBeNull();
    expect(historico.solicitacao.situacao).toBe("em_revisao_rh");
    expect(historico.eventos.map((e) => e.estadoPara)).toEqual([
      "enviada",
      "em_revisao_rh",
      "recusada",
      "em_revisao_rh",
    ]);
  });

  it("NÃO reabre cancelada — exige nova solicitação", () => {
    const r = transicionarSolicitacao(
      em("cancelada"),
      "reabrir",
      ATOR_RH,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("ESTADO_TERMINAL");
    }
  });

  it("colaborador não reabre: reabertura é exclusiva do RH", () => {
    const r = transicionarSolicitacao(
      em("recusada"),
      "reabrir",
      ATOR_COLABORADOR,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("PAPEL_NAO_AUTORIZADO");
    }
  });

  it("ehReabrivel cobre os dois terminais reabríveis, nunca cancelada", () => {
    expect(ehReabrivel("encaminhada_para_operacao_rh")).toBe(true);
    expect(ehReabrivel("recusada")).toBe(true);
    expect(ehReabrivel("cancelada")).toBe(false);
    expect(ehReabrivel("rascunho")).toBe(false);
  });

  it("não existe estado literal `encerrada`: o termo designa o encaminhamento", () => {
    const r = transicionarSolicitacao(
      { ...SOLICITACAO_CONTESTACAO, situacao: "encerrada" as EstadoSolicitacao },
      "reabrir",
      ATOR_RH,
      "AUD-1",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("ESTADO_DESCONHECIDO");
    }
  });
});

describe("solicitacoes — fail-closed (rejeição segura)", () => {
  const casos: {
    readonly nome: string;
    readonly solicitacao: Solicitacao;
    readonly acao: AcaoSolicitacao;
    readonly esperado: string;
  }[] = [
    {
      nome: "id vazio",
      solicitacao: { ...SOLICITACAO_CONTESTACAO, id: "" },
      acao: "enviar",
      esperado: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "empresaRef vazio",
      solicitacao: { ...SOLICITACAO_CONTESTACAO, empresaRef: "  " },
      acao: "enviar",
      esperado: "CAMPO_OBRIGATORIO_VAZIO",
    },
    {
      nome: "período inválido",
      solicitacao: {
        ...SOLICITACAO_CONTESTACAO,
        periodoReferencia: "2026-02-30",
      },
      acao: "enviar",
      esperado: "PERIODO_INVALIDO",
    },
    {
      nome: "tipo desconhecido",
      solicitacao: {
        ...SOLICITACAO_CONTESTACAO,
        tipo: "tipo_inexistente" as Solicitacao["tipo"],
      },
      acao: "enviar",
      esperado: "TIPO_DESCONHECIDO",
    },
    {
      nome: "motivo desconhecido",
      solicitacao: {
        ...SOLICITACAO_CONTESTACAO,
        motivo: "motivo_inexistente" as Solicitacao["motivo"],
      },
      acao: "enviar",
      esperado: "MOTIVO_DESCONHECIDO",
    },
    {
      nome: "estado desconhecido",
      solicitacao: {
        ...SOLICITACAO_CONTESTACAO,
        situacao: "estado_inexistente" as Solicitacao["situacao"],
      },
      acao: "enviar",
      esperado: "ESTADO_DESCONHECIDO",
    },
    {
      nome: "ação desconhecida",
      solicitacao: SOLICITACAO_CONTESTACAO,
      acao: "acao_inexistente" as AcaoSolicitacao,
      esperado: "ACAO_DESCONHECIDA",
    },
  ];

  for (const caso of casos) {
    it(`rejeita ${caso.nome} → ${caso.esperado}`, () => {
      const r = transicionarSolicitacao(
        caso.solicitacao,
        caso.acao,
        ATOR_COLABORADOR,
        "AUD-X",
      );
      expect(r.status).toBe("invalido");
      if (r.status === "invalido") {
        expect(r.erro.codigo).toBe(caso.esperado);
      }
    });
  }

  it("rejeita papel desconhecido do ator", () => {
    const r = transicionarSolicitacao(
      SOLICITACAO_CONTESTACAO,
      "enviar",
      {
        papel: "papel_inexistente" as never,
        empresaRef: "EMP-A",
        vinculoRef: "V-001",
      },
      "AUD-X",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("PAPEL_DESCONHECIDO");
    }
  });

  it("rejeita refAuditoria nova vazia", () => {
    const r = transicionarSolicitacao(
      SOLICITACAO_CONTESTACAO,
      "enviar",
      ATOR_COLABORADOR,
      "   ",
    );
    expect(r.status).toBe("invalido");
    if (r.status === "invalido") {
      expect(r.erro.codigo).toBe("CAMPO_OBRIGATORIO_VAZIO");
    }
  });
});

describe("solicitacoes — imutabilidade e histórico técnico", () => {
  it("não muta a entrada e preserva o histórico de eventos", () => {
    const congelada = Object.freeze({ ...SOLICITACAO_CONTESTACAO });
    const historico = aplicarSequenciaSolicitacao(
      congelada,
      PERCURSO_CONTESTACAO_ENCAMINHADA,
    );
    expect(historico.erro).toBeNull();
    // entrada intacta
    expect(congelada.situacao).toBe("rascunho");
    expect(congelada.refAuditoria).toBe("AUD-SOL-0000");
    // histórico acumulado, nada apagado
    expect(historico.eventos).toHaveLength(3);
    expect(historico.eventos[0]?.refAuditoria).toBe("AUD-SOL-1");
    expect(historico.eventos[2]?.refAuditoria).toBe("AUD-SOL-3");
  });

  it("interrompe no primeiro erro, preservando o histórico até ali", () => {
    const historico = aplicarSequenciaSolicitacao(SOLICITACAO_CONTESTACAO, [
      { acao: "enviar", ator: ATOR_COLABORADOR, refAuditoria: "AUD-1" },
      // recusar a partir de `enviada` é fora de ordem → para aqui
      { acao: "recusar", ator: ATOR_RH, refAuditoria: "AUD-2" },
      { acao: "iniciar_revisao", ator: ATOR_RH, refAuditoria: "AUD-3" },
    ]);
    expect(historico.solicitacao.situacao).toBe("enviada");
    expect(historico.eventos).toHaveLength(1);
    expect(historico.erro?.status).toBe("invalido");
  });
});

describe("solicitacoes — pureza e ausência de integração/dados sensíveis", () => {
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
    for (const arquivo of ["solicitacoes.ts", "solicitacoes.types.ts"]) {
      for (const especificador of importsDoArquivo(arquivo)) {
        expect(especificador.startsWith(".")).toBe(true);
      }
    }
  });

  it("o núcleo não importa Ponto/Banco de Horas/Folha/Documentos/eSocial", () => {
    const fonte = readFileSync(join(__dirname, "solicitacoes.ts"), "utf8");
    for (const proibido of [
      "/ponto",
      "/apuracao",
      "/banco-horas",
      "/compensacao",
      "/fechamento",
      "/verificar-folhas",
      "/orquestracao",
      "/documentos",
      "esocial",
      "prisma",
      "@nestjs",
    ]) {
      expect(fonte).not.toContain(proibido);
    }
  });

  it("nenhuma saída expõe dinheiro/Folha/pagamento nem CPF/nome", () => {
    const r = transicionarSolicitacao(
      SOLICITACAO_CONTESTACAO,
      "enviar",
      ATOR_COLABORADOR,
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
      "atestado",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
