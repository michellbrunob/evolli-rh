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
  const tx = {
    vinculoFuncional: {
      findFirst: jest.fn().mockResolvedValue({ id: VINCULO }),
    },
    solicitacaoPessoa: {
      findFirst: jest.fn().mockResolvedValue(atual),
      create: jest.fn().mockResolvedValue(linha()),
      update: jest
        .fn()
        .mockImplementation(async ({ data }) => linha({ ...data })),
    },
    solicitacaoPessoaEvento: { create: jest.fn().mockResolvedValue({}) },
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
    registrarMutacao: jest.fn().mockResolvedValue(undefined),
    registrarLeitura: jest.fn().mockResolvedValue(undefined),
    negarAcesso: jest.fn().mockImplementation(async () => {
      throw new NotFoundException();
    }),
  } as unknown as SolicitacoesPessoasAuditoriaService;

  return {
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
