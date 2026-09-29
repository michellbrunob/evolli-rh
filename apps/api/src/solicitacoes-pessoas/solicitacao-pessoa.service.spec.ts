import {
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AccessUser, SolicitacaoPessoa } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { SolicitacaoPessoaService } from "./solicitacao-pessoa.service";
import { SolicitacoesPessoasAuditoriaService } from "./solicitacoes-pessoas-auditoria.service";
import { SolicitacoesPessoasAuditContext } from "./solicitacoes-pessoas.types";

const EMPRESA_A = "11111111-1111-4111-8111-111111111111";
const EMPRESA_B = "22222222-2222-4222-8222-222222222222";
const VINCULO = "33333333-3333-4333-8333-333333333333";
const SOLICITACAO = "44444444-4444-4444-8444-444444444444";

const ATOR_RH = {
  id: "user-rh",
  role: "rh",
  companyId: EMPRESA_A,
} as unknown as AccessUser;

const CTX: SolicitacoesPessoasAuditContext = {
  actor: ATOR_RH,
  metadata: { ip: null, userAgent: null, requestId: "req-1" },
};

function linha(overrides: Partial<SolicitacaoPessoa> = {}): SolicitacaoPessoa {
  return {
    id: SOLICITACAO,
    empresaId: EMPRESA_A,
    vinculoId: VINCULO,
    tipo: "ferias",
    motivo: "periodo_ferias",
    situacao: "rascunho",
    periodoReferencia: null,
    registradoPorUserId: "user-rh",
    enviadaEm: null,
    primeiraRevisaoEm: null,
    criadoEm: new Date("2026-09-29T10:00:00.000Z"),
    atualizadoEm: new Date("2026-09-29T10:00:00.000Z"),
    ...overrides,
  };
}

function montar(atual: SolicitacaoPessoa | null = linha()) {
  /**
   * Ordem real das chamadas dentro da transação. É o que permite provar que o
   * lock vem **antes** da leitura da situação — a asserção que falha na
   * implementação anterior, que lia e atualizava sem serializar.
   */
  const ordem: string[] = [];

  const tx = {
    // `SELECT ... FOR UPDATE`: devolve a linha quando ela existe **no escopo**
    // e zero linhas quando não existe ou é de outra empresa — os dois casos
    // indistinguíveis, como exige o 404 anti-enumeração.
    $queryRaw: jest.fn(async (..._args: unknown[]) => {
      ordem.push("lock");
      return atual === null ? [] : [{ id: atual.id }];
    }),
    vinculoFuncional: {
      findFirst: jest.fn().mockResolvedValue({ id: VINCULO }),
    },
    solicitacaoPessoa: {
      findFirst: jest.fn(async () => {
        ordem.push("releitura");
        return atual;
      }),
      create: jest.fn().mockResolvedValue(linha()),
      update: jest.fn().mockImplementation(async ({ data }) => {
        ordem.push("update");
        return linha({ ...data });
      }),
    },
    solicitacaoPessoaEvento: {
      create: jest.fn().mockImplementation(async () => {
        ordem.push("evento");
        return {};
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    solicitacaoPessoa: {
      findFirst: jest.fn().mockResolvedValue(atual),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    solicitacaoPessoaEvento: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;

  const auditoria = {
    registrarMutacao: jest.fn().mockImplementation(async () => {
      ordem.push("auditoria");
    }),
    registrarLeitura: jest.fn().mockResolvedValue(undefined),
    negarAcesso: jest.fn().mockImplementation(async () => {
      throw new NotFoundException();
    }),
  } as unknown as SolicitacoesPessoasAuditoriaService;

  return {
    ordem,
    tx,
    prisma,
    auditoria,
    service: new SolicitacaoPessoaService(prisma, auditoria),
  };
}

describe("SolicitacaoPessoaService — registro", () => {
  it("nega empresa do corpo diferente da sessão, sem criar nada", async () => {
    const { service, auditoria, tx } = montar();

    await expect(
      service.registrar(
        {
          empresaId: EMPRESA_B,
          vinculoId: VINCULO,
          tipo: "ferias",
          motivo: "periodo_ferias",
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(auditoria.negarAcesso).toHaveBeenCalledWith(CTX, null, EMPRESA_B);
    expect(tx.solicitacaoPessoa.create).not.toHaveBeenCalled();
  });

  it("nega vínculo que não é da empresa do ator com 404, não com erro de FK", async () => {
    const { service, auditoria, tx } = montar();
    tx.vinculoFuncional.findFirst.mockResolvedValue(null);

    await expect(
      service.registrar(
        {
          empresaId: EMPRESA_A,
          vinculoId: VINCULO,
          tipo: "ferias",
          motivo: "periodo_ferias",
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(auditoria.negarAcesso).toHaveBeenCalledWith(CTX, null, EMPRESA_A);
    expect(tx.solicitacaoPessoa.create).not.toHaveBeenCalled();
  });

  it("rejeita dia que não existe no calendário", async () => {
    const { service, tx } = montar();

    await expect(
      service.registrar(
        {
          empresaId: EMPRESA_A,
          vinculoId: VINCULO,
          tipo: "contestacao_ajuste_ponto",
          motivo: "divergencia_marcacao",
          periodoReferencia: "2026-02-30",
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(tx.solicitacaoPessoa.create).not.toHaveBeenCalled();
  });

  it("registra em rascunho, com evento de criação e auditoria na transação", async () => {
    const { service, auditoria, tx } = montar();

    await service.registrar(
      {
        empresaId: EMPRESA_A,
        vinculoId: VINCULO,
        tipo: "atestado",
        motivo: "atestado_apresentado",
      },
      CTX,
    );

    // A situação NÃO é enviada pelo cliente: nasce do default do banco.
    const dadosCriacao = tx.solicitacaoPessoa.create.mock.calls[0]![0]!.data;
    expect(dadosCriacao).not.toHaveProperty("situacao");
    expect(dadosCriacao.registradoPorUserId).toBe("user-rh");

    const evento = tx.solicitacaoPessoaEvento.create.mock.calls[0]![0]!.data;
    expect(evento.acao).toBe("criar");
    expect(evento.situacaoDe).toBeNull();
    expect(evento.situacaoPara).toBe("rascunho");
    expect(evento.requestId).toBe("req-1");

    expect(auditoria.registrarMutacao).toHaveBeenCalledWith(
      tx,
      CTX,
      "pessoas_solicitacao_criada",
      SOLICITACAO,
      EMPRESA_A,
    );
  });
});

describe("SolicitacaoPessoaService — transições", () => {
  for (const acao of ["recusar", "reabrir"] as const) {
    it(`exige justificativa codificada em ${acao} (PD-SOL-03)`, async () => {
      const { service, tx } = montar(
        linha({
          situacao: acao === "recusar" ? "em_revisao_rh" : "recusada",
        }),
      );

      await expect(
        service.transicionar(SOLICITACAO, { acao }, CTX),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
      expect(tx.solicitacaoPessoaEvento.create).not.toHaveBeenCalled();
    });
  }

  it("rejeita transição inválida sem tocar no estado nem no histórico", async () => {
    const { service, tx } = montar(linha({ situacao: "em_revisao_rh" }));

    await expect(
      service.transicionar(SOLICITACAO, { acao: "cancelar" }, CTX),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
    expect(tx.solicitacaoPessoaEvento.create).not.toHaveBeenCalled();
  });

  it("nega solicitação de outra empresa com 404", async () => {
    const { service, auditoria, tx } = montar(null);

    await expect(
      service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(auditoria.negarAcesso).toHaveBeenCalledWith(CTX, SOLICITACAO, null);
    expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
  });

  it("marca enviadaEm ao enviar e registra evento com o par de estados", async () => {
    const { service, auditoria, tx } = montar(linha({ situacao: "rascunho" }));

    await service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX);

    const dados = tx.solicitacaoPessoa.update.mock.calls[0]![0]!.data;
    expect(dados.situacao).toBe("enviada");
    expect(dados.enviadaEm).toBeInstanceOf(Date);
    expect(dados.primeiraRevisaoEm).toBeUndefined();

    const evento = tx.solicitacaoPessoaEvento.create.mock.calls[0]![0]!.data;
    expect(evento.situacaoDe).toBe("rascunho");
    expect(evento.situacaoPara).toBe("enviada");

    expect(auditoria.registrarMutacao).toHaveBeenCalledWith(
      tx,
      CTX,
      "pessoas_solicitacao_enviada",
      SOLICITACAO,
      EMPRESA_A,
    );
  });

  it("grava primeiraRevisaoEm na primeira entrada em revisão", async () => {
    const { service, tx } = montar(
      linha({ situacao: "enviada", primeiraRevisaoEm: null }),
    );

    await service.transicionar(SOLICITACAO, { acao: "iniciar_revisao" }, CTX);

    const dados = tx.solicitacaoPessoa.update.mock.calls[0]![0]!.data;
    expect(dados.situacao).toBe("em_revisao_rh");
    expect(dados.primeiraRevisaoEm).toBeInstanceOf(Date);
  });

  it("NÃO reescreve primeiraRevisaoEm ao reabrir: a evidência do primeiro retorno é preservada", async () => {
    const primeira = new Date("2026-09-20T09:00:00.000Z");
    const { service, tx } = montar(
      linha({ situacao: "recusada", primeiraRevisaoEm: primeira }),
    );

    await service.transicionar(
      SOLICITACAO,
      { acao: "reabrir", motivo: "reanalise_administrativa" },
      CTX,
    );

    const dados = tx.solicitacaoPessoa.update.mock.calls[0]![0]!.data;
    expect(dados.situacao).toBe("em_revisao_rh");
    expect(dados.primeiraRevisaoEm).toBeUndefined();

    const evento = tx.solicitacaoPessoaEvento.create.mock.calls[0]![0]!.data;
    expect(evento.motivo).toBe("reanalise_administrativa");
    expect(evento.situacaoDe).toBe("recusada");
  });

  it("não reabre solicitação cancelada", async () => {
    const { service, tx } = montar(linha({ situacao: "cancelada" }));

    await expect(
      service.transicionar(
        SOLICITACAO,
        { acao: "reabrir", motivo: "correcao_de_registro" },
        CTX,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
  });
});

/**
 * Serialização das transições concorrentes.
 *
 * A prova real de exclusão mútua exige dois processos e um PostgreSQL de
 * verdade, e está no E2E (`solicitacoes-pessoas.e2e-spec.ts`). O que se prova
 * aqui, de forma determinística e sem banco, é o **contrato de ordem** de que a
 * exclusão mútua depende: o lock é adquirido antes de a situação ser lida, e
 * estado, histórico e auditoria acontecem depois, dentro da mesma transação.
 * Toda asserção deste bloco falha na implementação anterior, que ia direto ao
 * `findFirst` sem `FOR UPDATE`.
 */
describe("SolicitacaoPessoaService — serialização de transições concorrentes", () => {
  it("trava a linha com FOR UPDATE, por id E empresa da sessão, antes de ler a situação", async () => {
    const { service, tx, ordem } = montar(linha({ situacao: "rascunho" }));

    await service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    const [fragmentos, ...valores] = tx.$queryRaw.mock.calls[0]! as [
      readonly string[],
      ...unknown[],
    ];
    const sql = fragmentos.join(" ? ").replace(/\s+/g, " ");

    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("solicitacao_pessoa");
    expect(sql).toContain("empresa_id");
    // O predicado do lock carrega os DOIS valores: id do recurso e empresa
    // derivada da sessão. Travar só por id deixaria o escopo fora da corrida.
    expect(valores).toEqual([SOLICITACAO, EMPRESA_A]);

    // Lock primeiro; só então a situação é lida.
    expect(ordem.indexOf("lock")).toBe(0);
    expect(ordem.indexOf("releitura")).toBe(1);
  });

  it("executa lock, releitura, atualização, histórico e auditoria nessa ordem, na mesma transação", async () => {
    const { service, prisma, ordem } = montar(linha({ situacao: "rascunho" }));

    await service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX);

    expect(ordem).toEqual([
      "lock",
      "releitura",
      "update",
      "evento",
      "auditoria",
    ]);
    // Tudo dentro de uma única transação — nenhuma das etapas escapa dela.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("a perdedora da corrida valida contra o estado já serializado e cai no 422 padrão", async () => {
    // Releitura sob o lock devolve `em_revisao_rh`: a concorrente venceu e já
    // commitou. O `cancelar` que era válido em `enviada` agora não é.
    const { service, tx, auditoria, ordem } = montar(
      linha({ situacao: "em_revisao_rh" }),
    );

    await expect(
      service.transicionar(SOLICITACAO, { acao: "cancelar" }, CTX),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(ordem).toEqual(["lock", "releitura"]);
    expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
    expect(tx.solicitacaoPessoaEvento.create).not.toHaveBeenCalled();
    expect(auditoria.registrarMutacao).not.toHaveBeenCalled();
  });

  it("solicitação inexistente e de outra empresa param no lock, sem releitura, com 404", async () => {
    // Zero linhas travadas é o resultado dos DOIS casos: o predicado do lock
    // não distingue "não existe" de "é de outra empresa".
    const { service, tx, auditoria, ordem } = montar(null);

    await expect(
      service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(ordem).toEqual(["lock"]);
    expect(tx.solicitacaoPessoa.findFirst).not.toHaveBeenCalled();
    expect(tx.solicitacaoPessoa.update).not.toHaveBeenCalled();
    expect(auditoria.negarAcesso).toHaveBeenCalledWith(CTX, SOLICITACAO, null);
  });

  it("falha da auditoria obrigatória propaga e impede a confirmação da mutação", async () => {
    const { service, tx, auditoria } = montar(linha({ situacao: "rascunho" }));
    const falha = new Error("auditoria indisponível");
    (auditoria.registrarMutacao as unknown as jest.Mock).mockRejectedValueOnce(
      falha,
    );

    // O erro NÃO é engolido: ele sobe do callback da transação, e é isso que
    // faz o PostgreSQL desfazer estado e histórico junto com o evento.
    await expect(
      service.transicionar(SOLICITACAO, { acao: "enviar" }, CTX),
    ).rejects.toBe(falha);

    // As escritas chegaram a ser emitidas dentro da transação — o que as
    // desfaz é justamente a exceção ter propagado, não o service tê-las
    // evitado.
    expect(tx.solicitacaoPessoa.update).toHaveBeenCalledTimes(1);
    expect(tx.solicitacaoPessoaEvento.create).toHaveBeenCalledTimes(1);
  });
});

describe("SolicitacaoPessoaService — leitura", () => {
  it("devolve página vazia para empresa alheia, sem consultar o banco", async () => {
    const { service, prisma } = montar();

    const resultado = await service.listar(
      { pagina: 1, tamanhoPagina: 20, empresaId: EMPRESA_B },
      CTX,
    );

    expect(resultado).toEqual({
      itens: [],
      pagina: 1,
      tamanhoPagina: 20,
      total: 0,
    });
    expect(prisma.solicitacaoPessoa.findMany).not.toHaveBeenCalled();
  });

  it("lista sempre presa à empresa da sessão e audita a leitura", async () => {
    const { service, prisma, auditoria } = montar();

    await service.listar({ pagina: 1, tamanhoPagina: 20 }, CTX);

    const where = (prisma.solicitacaoPessoa.findMany as jest.Mock).mock
      .calls[0]![0]!.where;
    expect(where.empresaId).toBe(EMPRESA_A);
    expect(auditoria.registrarLeitura).toHaveBeenCalledWith(
      CTX,
      null,
      EMPRESA_A,
    );
  });

  it("histórico sai em ordem cronológica e só da solicitação no escopo", async () => {
    const { service, prisma } = montar();

    await service.historico(SOLICITACAO, CTX);

    const consulta = (prisma.solicitacaoPessoaEvento.findMany as jest.Mock).mock
      .calls[0]![0]!;
    expect(consulta.where).toEqual({
      solicitacaoId: SOLICITACAO,
      empresaId: EMPRESA_A,
    });
    expect(consulta.orderBy).toEqual([{ ocorridoEm: "asc" }, { id: "asc" }]);
  });
});
