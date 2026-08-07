import { Injectable } from "@nestjs/common";
import {
  AlocacaoOrganizacional,
  MovimentacaoFuncional,
  StatusMovimentacao,
  VinculoFuncional,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import {
  EscopoPessoas,
  podeAcessarPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  assertDestinoCoerente,
  assertDestinoValidoEAtivo,
  dataUtc,
} from "../validacao-pessoas.util";
import { extrairDestino, traduzirErroPessoas } from "../pessoas-comum.util";
import { CriarVinculoDto } from "../dto/pessoas.dto";

/**
 * Vínculo funcional — a relação entre um Colaborador e uma Empresa. É ele que
 * carrega `empresa_id` e, portanto, a fronteira de autorização (ADR 0007,
 * d. 11), e é nele que vive a `matricula`, única dentro da empresa (item 2).
 */
@Injectable()
export class VinculoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  /**
   * Novo vínculo para colaborador já existente — readmissão, tipicamente.
   *
   * O colaborador precisa estar **visível no escopo do ator**. Reaproveitar
   * uma pessoa cujo único vínculo esteja em outra empresa não é possível nesta
   * V1: sem identificador pessoal (Baseline V1, item 1), o sistema não tem
   * como reconhecê-la, e inventar um seria introduzir dado não aprovado.
   *
   * O vínculo anterior encerrado **não é reaberto** — readmissão é vínculo
   * novo, sempre (spec §8). RI-V6 garante, no banco, que não haja dois ativos
   * no mesmo par (colaborador, empresa).
   */
  async criar(
    dto: CriarVinculoDto,
    ctx: PessoasAuditContext,
  ): Promise<VinculoFuncional> {
    const escopo = resolverEscopoPessoas(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_funcional",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "vinculo_funcional",
        "create",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_funcional",
        null,
        escopo.empresaId,
      );
    }

    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: dto.colaboradorId,
        vinculos: { some: { empresaId: escopo.empresaId } },
      },
      select: { id: true },
    });
    if (!colaborador) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        dto.colaboradorId,
        escopo.empresaId,
      );
    }

    const destino = extrairDestino(dto);
    assertDestinoCoerente("admissao", destino);

    const dataAdmissao = dataUtc(new Date(dto.dataAdmissao));
    const status: StatusMovimentacao =
      dataAdmissao > dataUtc(new Date()) ? "programada" : "solicitada";

    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, escopo.empresaId, destino);

        const vinculo = await tx.vinculoFuncional.create({
          data: {
            colaboradorId: colaborador.id,
            empresaId: escopo.empresaId,
            matricula: dto.matricula,
            tipo: dto.tipo,
            situacao: "previsto",
            dataAdmissao,
          },
        });

        const movimentacao = await tx.movimentacaoFuncional.create({
          data: {
            vinculoId: vinculo.id,
            empresaId: escopo.empresaId,
            tipo: "admissao",
            status,
            motivoCodigo: dto.motivoCodigo,
            solicitanteUserId: ctx.actor.id,
            vigenciaInicio: dataAdmissao,
            destinoUnidadeOrganizacionalId: destino.unidadeOrganizacionalId,
            destinoDepartamentoId: destino.departamentoId,
            destinoAreaId: destino.areaId,
            destinoEquipeId: destino.equipeId,
            destinoCargoId: destino.cargoId,
            destinoCentroCustoId: destino.centroCustoId,
          },
        });

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_vinculo_criado",
          "vinculo_funcional",
          vinculo.id,
          escopo.empresaId,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          status === "programada"
            ? "pessoas_movimentacao_programada"
            : "pessoas_movimentacao_registrada",
          "movimentacao_funcional",
          movimentacao.id,
          escopo.empresaId,
        );

        return vinculo;
      });
    } catch (error) {
      traduzirErroPessoas(error);
    }
  }

  /** Vínculos de um colaborador, dentro do escopo do ator. */
  async listarPorColaborador(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<VinculoFuncional[]> {
    const escopo = resolverEscopoPessoas(ctx.actor);

    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: colaboradorId,
        vinculos: { some: { empresaId: escopo.empresaId } },
      },
      select: { id: true },
    });
    if (!colaborador) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaboradorId,
        null,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "vinculo_funcional",
        "read",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "vinculo_funcional",
        colaboradorId,
        escopo.empresaId,
      );
    }

    // Só os vínculos da empresa do ator: um colaborador com vínculo em duas
    // empresas não expõe uma para quem só tem escopo na outra.
    return this.prisma.vinculoFuncional.findMany({
      where: { colaboradorId: colaborador.id, empresaId: escopo.empresaId },
      orderBy: [{ dataAdmissao: "desc" }, { id: "asc" }],
    });
  }

  /** Histórico completo de alocações — nenhuma linha é omitida ou reescrita. */
  async listarAlocacoes(
    vinculoId: string,
    ctx: PessoasAuditContext,
  ): Promise<AlocacaoOrganizacional[]> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const vinculo = await this.carregarVinculoNoEscopo(
      vinculoId,
      ctx,
      escopo,
      "read",
      "alocacao_organizacional",
    );

    return this.prisma.alocacaoOrganizacional.findMany({
      where: { vinculoId: vinculo.id },
      orderBy: [{ vigenteDe: "asc" }],
    });
  }

  /**
   * **A garantia central desta fatia** (spec §1): qual era a situação numa
   * data de referência.
   *
   * É leitura direta, não reconstrução de log: `vigente_ate` é **exclusivo**,
   * então o intervalo válido é `[vigente_de, vigente_ate)` e a consulta é uma
   * comparação simples. Nenhuma linha precisou ser sobrescrita para isso.
   *
   * Data futura devolve a alocação vigente conhecida (ou nenhuma) — nunca
   * projeta movimentação programada que ainda não foi efetivada (spec §10).
   */
  async situacaoEmData(
    vinculoId: string,
    dataReferencia: string,
    ctx: PessoasAuditContext,
  ): Promise<{
    vinculo: VinculoFuncional;
    dataReferencia: string;
    alocacao: AlocacaoOrganizacional | null;
  }> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const vinculo = await this.carregarVinculoNoEscopo(
      vinculoId,
      ctx,
      escopo,
      "read",
      "alocacao_organizacional",
    );

    const data = dataUtc(new Date(dataReferencia));

    const alocacao = await this.prisma.alocacaoOrganizacional.findFirst({
      where: {
        vinculoId: vinculo.id,
        vigenteDe: { lte: data },
        OR: [{ vigenteAte: null }, { vigenteAte: { gt: data } }],
      },
    });

    return { vinculo, dataReferencia, alocacao };
  }

  /** Linha do tempo: os atos, na ordem em que passaram a valer (spec §4.8). */
  async linhaDoTempo(
    vinculoId: string,
    ctx: PessoasAuditContext,
  ): Promise<MovimentacaoFuncional[]> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const vinculo = await this.carregarVinculoNoEscopo(
      vinculoId,
      ctx,
      escopo,
      "read",
      "movimentacao_funcional",
    );

    // Inclui `cancelada` e `retificada`: a tentativa recusada e o registro
    // corrigido fazem parte do histórico (RI-M6, RI-M2).
    return this.prisma.movimentacaoFuncional.findMany({
      where: { vinculoId: vinculo.id },
      orderBy: [{ vigenciaInicio: "asc" }, { registradaEm: "asc" }],
    });
  }

  private async carregarVinculoNoEscopo(
    vinculoId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoPessoas,
    action: "read" | "alter" | "manage",
    resource:
      | "vinculo_funcional"
      | "alocacao_organizacional"
      | "movimentacao_funcional",
  ): Promise<VinculoFuncional> {
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { id: vinculoId, empresaId: escopo.empresaId },
    });

    if (!vinculo) {
      return this.auditoria.negarAcesso(ctx, resource, vinculoId, null);
    }
    if (!podeAcessarPessoas(ctx.actor, resource, action, vinculo.empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        resource,
        vinculo.id,
        vinculo.empresaId,
      );
    }

    return vinculo;
  }
}
