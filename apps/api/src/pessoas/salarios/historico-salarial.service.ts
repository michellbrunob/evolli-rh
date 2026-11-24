import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SituacaoVinculo, TipoVinculo } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
} from "../../common/erros/recusa-por-campo";
import { hojeEmSaoPaulo } from "../ausencias/calculo-ausencias";
import { escolherVinculoPrincipal } from "../colaborador/vinculo-principal";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { podeAcessarPessoas } from "../escopo-pessoas.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { GravarAlteracaoSalarialDto } from "./historico-salarial.dto";
import {
  AlteracaoSalarialDevolvida,
  montarLinhaDoTempo,
} from "./linha-do-tempo-salarial";
import { espelharSalarioVigente } from "./salario-vigente";

/** T215 — a aba Salários da ficha. */
export interface HistoricoSalarial {
  colaboradorId: string;
  empresaId: string;
  vinculo: {
    id: string;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    /** Dia civil `AAAA-MM-DD`. */
    dataAdmissao: string;
  };
  /** Do contrato, para o líquido estimado da tela. */
  dependentesIrrf: number | null;
  pensaoAlimenticiaPercentual: string | null;
  /** Da mais nova para a mais antiga; a primeira é a vigente. */
  alteracoes: AlteracaoSalarialDevolvida[];
}

const PROJECAO_VINCULO = {
  id: true,
  empresaId: true,
  matricula: true,
  tipo: true,
  situacao: true,
  dataAdmissao: true,
} as const satisfies Prisma.VinculoFuncionalSelect;

type VinculoProjetado = Prisma.VinculoFuncionalGetPayload<{
  select: typeof PROJECAO_VINCULO;
}>;

const PROJECAO_ALTERACAO = {
  id: true,
  origem: true,
  vigenciaInicio: true,
  salarioBruto: true,
  cargo: true,
  modeloContrato: true,
} as const satisfies Prisma.AlteracaoSalarialSelect;

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function dataDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function eDataEmUso(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

/**
 * T215 — linha do tempo salarial do vínculo principal (aba Salários da
 * ficha), com a mesma autorização do contrato (`contrato_vinculo`): `rh` e
 * `dp` na empresa ativa leem e gravam; o `master_tecnico` lê na empresa
 * ativa ou, sem ela, na empresa do vínculo (leitura global auditada).
 *
 * Regras de gravação:
 * - a data de início vai da admissão até hoje (o futuro ainda não é
 *   salário vigente, e o contrato espelha o vigente);
 * - uma data por período (a removida libera a data);
 * - a linha da admissão muda valor, cargo e modelo, nunca a data, e não se
 *   remove;
 * - depois do desligamento, só leitura;
 * - remoção só lógica.
 *
 * A trilha leva só ação, recurso, empresa e o id da ALTERAÇÃO.
 */
@Injectable()
export class HistoricoSalarialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

  async consultar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<HistoricoSalarial> {
    const escopo = resolverEscopoContatos(ctx.actor);
    const { empresaId, principal } = await this.resolverPrincipal(
      colaboradorId,
      ctx,
      "read",
      escopo.global ? null : escopo.empresaId,
    );
    if (escopo.global) {
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "alteracao_salarial",
        principal.id,
      );
    }
    return this.montar(this.prisma, colaboradorId, empresaId, principal);
  }

  async registrar(
    colaboradorId: string,
    dto: GravarAlteracaoSalarialDto,
    ctx: PessoasAuditContext,
  ): Promise<HistoricoSalarial> {
    const { empresaId, principal } = await this.resolverParaGravar(
      colaboradorId,
      ctx,
    );
    this.conferirData(dto.vigenciaInicio, principal);
    return this.gravar(async (tx) => {
      await this.conferirDataLivre(tx, principal.id, dto.vigenciaInicio, null);
      const linha = await tx.alteracaoSalarial.create({
        data: {
          vinculoId: principal.id,
          empresaId,
          origem: "alteracao",
          vigenciaInicio: dataDoDia(dto.vigenciaInicio),
          salarioBruto: dto.salarioBruto,
          cargo: dto.cargo ?? null,
          modeloContrato: dto.modeloContrato ?? null,
          registradaPorUserId: ctx.actor.id,
        },
        select: { id: true },
      });
      await espelharSalarioVigente(tx, { vinculoId: principal.id, empresaId });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_salario_registrado",
        "alteracao_salarial",
        linha.id,
        empresaId,
      );
      return this.montar(tx, colaboradorId, empresaId, principal);
    });
  }

  async atualizar(
    colaboradorId: string,
    alteracaoId: string,
    dto: GravarAlteracaoSalarialDto,
    ctx: PessoasAuditContext,
  ): Promise<HistoricoSalarial> {
    const { empresaId, principal } = await this.resolverParaGravar(
      colaboradorId,
      ctx,
    );
    const atual = await this.alteracaoViva(principal.id, alteracaoId);
    if (
      atual.origem === "admissao" &&
      dto.vigenciaInicio !== diaCivil(atual.vigenciaInicio)
    ) {
      throw new CamposRecusadosException([
        { campo: "vigenciaInicio", motivo: "nao_se_aplica" },
      ]);
    }
    if (atual.origem !== "admissao") {
      this.conferirData(dto.vigenciaInicio, principal);
    }
    return this.gravar(async (tx) => {
      await this.conferirDataLivre(
        tx,
        principal.id,
        dto.vigenciaInicio,
        alteracaoId,
      );
      await tx.alteracaoSalarial.update({
        where: { id: alteracaoId },
        data: {
          vigenciaInicio: dataDoDia(dto.vigenciaInicio),
          salarioBruto: dto.salarioBruto,
          cargo: dto.cargo ?? null,
          modeloContrato: dto.modeloContrato ?? null,
        },
      });
      await espelharSalarioVigente(tx, { vinculoId: principal.id, empresaId });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_salario_atualizado",
        "alteracao_salarial",
        alteracaoId,
        empresaId,
      );
      return this.montar(tx, colaboradorId, empresaId, principal);
    });
  }

  async remover(
    colaboradorId: string,
    alteracaoId: string,
    ctx: PessoasAuditContext,
  ): Promise<HistoricoSalarial> {
    const { empresaId, principal } = await this.resolverParaGravar(
      colaboradorId,
      ctx,
    );
    const atual = await this.alteracaoViva(principal.id, alteracaoId);
    if (atual.origem === "admissao") {
      throw new ConflictException();
    }
    return this.gravar(async (tx) => {
      await tx.alteracaoSalarial.update({
        where: { id: alteracaoId },
        data: { removidaEm: new Date(), removidaPorUserId: ctx.actor.id },
      });
      await espelharSalarioVigente(tx, { vinculoId: principal.id, empresaId });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_salario_removido",
        "alteracao_salarial",
        alteracaoId,
        empresaId,
      );
      return this.montar(tx, colaboradorId, empresaId, principal);
    });
  }

  private async gravar<T>(
    operacao: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operacao);
    } catch (erro) {
      // Duas gravações simultâneas na mesma data: o índice parcial decide.
      if (eDataEmUso(erro)) {
        throw new ConflitoDeCamposException([
          { campo: "vigenciaInicio", motivo: "em_uso" },
        ]);
      }
      throw erro;
    }
  }

  private async montar(
    db: Prisma.TransactionClient,
    colaboradorId: string,
    empresaId: string,
    principal: VinculoProjetado,
  ): Promise<HistoricoSalarial> {
    const [linhas, contrato] = await Promise.all([
      db.alteracaoSalarial.findMany({
        where: { vinculoId: principal.id, removidaEm: null },
        select: PROJECAO_ALTERACAO,
      }),
      db.contratoVinculo.findUnique({
        where: { vinculoId: principal.id },
        select: { dependentesIrrf: true, pensaoAlimenticiaPercentual: true },
      }),
    ]);
    return {
      colaboradorId,
      empresaId,
      vinculo: {
        id: principal.id,
        tipo: principal.tipo,
        situacao: principal.situacao,
        dataAdmissao: diaCivil(principal.dataAdmissao),
      },
      dependentesIrrf: contrato?.dependentesIrrf ?? null,
      pensaoAlimenticiaPercentual:
        contrato?.pensaoAlimenticiaPercentual?.toFixed(2) ?? null,
      alteracoes: montarLinhaDoTempo(linhas),
    };
  }

  /** Da admissão até hoje (dia civil de São Paulo). */
  private conferirData(dia: string, principal: VinculoProjetado): void {
    if (dia < diaCivil(principal.dataAdmissao)) {
      throw new CamposRecusadosException([
        { campo: "vigenciaInicio", motivo: "fora_de_ordem" },
      ]);
    }
    if (dia > hojeEmSaoPaulo()) {
      throw new CamposRecusadosException([
        { campo: "vigenciaInicio", motivo: "futura" },
      ]);
    }
  }

  private async conferirDataLivre(
    tx: Prisma.TransactionClient,
    vinculoId: string,
    dia: string,
    alteracaoId: string | null,
  ): Promise<void> {
    const outra = await tx.alteracaoSalarial.findFirst({
      where: {
        vinculoId,
        removidaEm: null,
        vigenciaInicio: dataDoDia(dia),
        ...(alteracaoId === null ? {} : { NOT: { id: alteracaoId } }),
      },
      select: { id: true },
    });
    if (outra) {
      throw new ConflitoDeCamposException([
        { campo: "vigenciaInicio", motivo: "em_uso" },
      ]);
    }
  }

  /** Alteração viva DESTE vínculo; outra, removida ou inexistente: 404. */
  private async alteracaoViva(vinculoId: string, alteracaoId: string) {
    const linha = await this.prisma.alteracaoSalarial.findFirst({
      where: { id: alteracaoId, vinculoId, removidaEm: null },
      select: { origem: true, vigenciaInicio: true },
    });
    if (!linha) throw new NotFoundException();
    return linha;
  }

  private async resolverParaGravar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<{ empresaId: string; principal: VinculoProjetado }> {
    const escopo = resolverEscopoContatos(ctx.actor);
    // O master técnico não grava (o guard já o recusa).
    if (escopo.global) {
      return this.auditoria.negarAcesso(
        ctx,
        "alteracao_salarial",
        colaboradorId,
        null,
      );
    }
    const resolvido = await this.resolverPrincipal(
      colaboradorId,
      ctx,
      "alter",
      escopo.empresaId,
    );
    // Depois do desligamento, o uso operacional é bloqueado.
    if (resolvido.principal.situacao === "encerrado") {
      throw new ConflictException();
    }
    return resolvido;
  }

  /**
   * O vínculo principal na empresa (a ativa da sessão, ou a do vínculo para
   * o master sem empresa). Sem vínculo no escopo: 404 auditado. Vínculos em
   * mais de uma empresa sem empresa ativa: 409.
   */
  private async resolverPrincipal(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    action: "read" | "alter",
    empresaDaSessao: string | null,
  ): Promise<{ empresaId: string; principal: VinculoProjetado }> {
    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: {
        colaboradorId,
        ...(empresaDaSessao === null ? {} : { empresaId: empresaDaSessao }),
      },
      select: PROJECAO_VINCULO,
    });
    const [empresaId, ...outras] = [
      ...new Set(vinculos.map((v) => v.empresaId)),
    ];
    if (empresaId === undefined) {
      return this.auditoria.negarAcesso(
        ctx,
        "alteracao_salarial",
        colaboradorId,
        empresaDaSessao,
      );
    }
    if (outras.length > 0) {
      throw new ConflictException();
    }
    if (!podeAcessarPessoas(ctx.actor, "contrato_vinculo", action, empresaId)) {
      return this.auditoria.negarAcesso(
        ctx,
        "alteracao_salarial",
        colaboradorId,
        empresaId,
      );
    }
    const principal = escolherVinculoPrincipal(vinculos)!;
    return { empresaId, principal };
  }
}
