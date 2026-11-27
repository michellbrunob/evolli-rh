import { AccessUser } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { EscalaPublicacaoService } from "./escala-publicacao.service";

/**
 * T215 — "Publicar" em lote: com muitos rascunhos, poucos comandos (nunca 3
 * por linha) e a transação com timeout explícito de 60 s, como `gravarLote`
 * e `limparLote` (o padrão de 5 s estourava).
 */
const EMPRESA = "empresa-1";
const ATOR = {
  id: "user-1",
  role: "rh",
  companyId: EMPRESA,
} as unknown as AccessUser;
const CTX = {
  actor: ATOR,
  metadata: { ip: null, userAgent: null, requestId: "r" },
} as never;

function rascunho(i: number) {
  const dia = new Date(Date.UTC(2026, 10, 2 + (i % 28)));
  return {
    id: `r-${i}`,
    colaboradorId: `c-${Math.floor(i / 28)}`,
    empresaId: EMPRESA,
    dia,
    camada: "rascunho",
    tipo: "folga",
    tabelaHorarioId: null,
    periodos: [],
    intervaloMinutos: 0,
    sobreaviso: [],
    unidadeOrganizacionalId: null,
    observacao: null,
  };
}

function montar(rascunhos: ReturnType<typeof rascunho>[]) {
  const tx = {
    escalaDia: {
      findMany: jest.fn(async (a: { where: { camada: string } }) =>
        a.where.camada === "rascunho"
          ? rascunhos
          : // Metade dos dias já publicados (viram "alteradas").
            rascunhos
              .filter((_, i) => i % 2 === 0)
              .map((r) => ({
                id: `p-${r.id}`,
                colaboradorId: r.colaboradorId,
                dia: r.dia,
              })),
      ),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 0 })),
      createMany: jest.fn(async () => ({ count: 0 })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    vinculoFuncional: { findMany: jest.fn(async () => []) },
    escalaColaborador: { findMany: jest.fn(async () => []) },
    escalaPublicacao: {
      create: jest.fn(async (a: { data: Record<string, unknown> }) => ({
        id: "pub-1",
        inicio: new Date("2026-11-02T00:00:00Z"),
        fim: new Date("2026-11-29T00:00:00Z"),
        novas: a.data.novas,
        alteradas: a.data.alteradas,
        pessoas: a.data.pessoas,
        avisar: false,
        publicadoEm: new Date(),
        publicadoPor: { nomeExibicao: "RH" },
      })),
    },
  };
  const $transaction = jest.fn(
    async (fn: (t: typeof tx) => Promise<unknown>, _opcoes?: unknown) => fn(tx),
  );
  const prisma = { $transaction } as unknown as PrismaService;
  const auditoria = {
    registrarMutacao: jest.fn(async () => undefined),
  } as unknown as PessoasAuditoriaService;
  return {
    service: new EscalaPublicacaoService(prisma, auditoria),
    tx,
    $transaction,
  };
}

describe("T215 — publicar a escala em lote", () => {
  it("1.000 rascunhos: poucos comandos, nenhum por linha, e timeout de 60 s", async () => {
    const rascunhos = Array.from({ length: 1000 }, (_, i) => rascunho(i));
    const { service, tx, $transaction } = montar(rascunhos);
    const r = await service.publicar(
      { inicio: "2026-11-02", fim: "2026-11-29", avisar: false },
      CTX,
    );
    expect($transaction).toHaveBeenCalledTimes(1);
    expect($transaction.mock.calls[0]![1]).toEqual({ timeout: 60_000 });
    // Nada linha a linha.
    expect(tx.escalaDia.findUnique).not.toHaveBeenCalled();
    expect(tx.escalaDia.update).not.toHaveBeenCalled();
    expect(tx.escalaDia.create).not.toHaveBeenCalled();
    expect(tx.escalaDia.delete).not.toHaveBeenCalled();
    // Mesmo valor (folga) → um UPDATE para os 500 publicados trocados.
    expect(tx.escalaDia.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.escalaDia.createMany).toHaveBeenCalledTimes(1);
    expect(tx.escalaDia.deleteMany).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ novas: 500, alteradas: 500 });
  });
});
