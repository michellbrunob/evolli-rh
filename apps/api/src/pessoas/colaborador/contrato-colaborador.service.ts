import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, SituacaoVinculo, TipoVinculo } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
} from "../../common/erros/recusa-por-campo";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import { podeAcessarPessoas } from "../escopo-pessoas.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import {
  ContratoDaAdmissao,
  contratoEnviado,
  contratoGravado,
  contratoTemValor,
} from "./contrato-admissao";
import { RegistrarContratoColaboradorDto } from "./contrato-colaborador.dto";
import { escolherVinculoPrincipal } from "./vinculo-principal";
import { DesativacaoColaboradorService } from "./desativacao-colaborador.service";
import {
  decidirSalarioDoContrato,
  espelharSalarioVigente,
  registrarSalarioDaAdmissao,
} from "../salarios/salario-vigente";

/** O vínculo principal como a edição o mostra (só leitura, menos a matrícula). */
export interface VinculoDoContrato {
  id: string;
  matricula: string | null;
  tipo: TipoVinculo;
  situacao: SituacaoVinculo;
  /** Dia civil `AAAA-MM-DD`. */
  dataAdmissao: string;
  dataDesligamento: string | null;
}

export interface ContratoDoColaborador {
  colaboradorId: string;
  empresaId: string;
  vinculo: VinculoDoContrato;
  /** Sem linha gravada, todos os campos `null`. */
  contrato: ContratoDaAdmissao;
  /** Última gravação do contrato; `null` sem linha. */
  atualizadoEm: Date | null;
  /**
   * T215 — a pessoa está desativada NESTA empresa (lixeira do "Editar
   * colaborador"), e desde quando. A tela mostra o Status sem outra leitura.
   */
  desativado: boolean;
  desativadoEm: Date | null;
}

const PROJECAO_VINCULO = {
  id: true,
  empresaId: true,
  matricula: true,
  tipo: true,
  situacao: true,
  dataAdmissao: true,
  dataDesligamento: true,
} as const satisfies Prisma.VinculoFuncionalSelect;

type VinculoProjetado = Prisma.VinculoFuncionalGetPayload<{
  select: typeof PROJECAO_VINCULO;
}>;

const CONTRATO_VAZIO: ContratoDaAdmissao = {
  nivel: null,
  gestorDiretoId: null,
  jornadaSemanalHoras: null,
  escala: null,
  salarioBruto: null,
  conselhoProfissional: null,
  registroProfissional: null,
  dependentesIrrf: null,
  pensaoAlimenticiaPercentual: null,
};

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function vinculoDoContrato(v: VinculoProjetado): VinculoDoContrato {
  return {
    id: v.id,
    matricula: v.matricula,
    tipo: v.tipo,
    situacao: v.situacao,
    dataAdmissao: diaCivil(v.dataAdmissao),
    dataDesligamento: v.dataDesligamento ? diaCivil(v.dataDesligamento) : null,
  };
}

function eUnicidadeDaMatricula(erro: unknown): boolean {
  if (
    !(erro instanceof Prisma.PrismaClientKnownRequestError) ||
    erro.code !== "P2002"
  ) {
    return false;
  }
  const alvo = erro.meta?.["target"];
  const texto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  return /matricula/.test(texto);
}

/**
 * T215 — o contrato do vínculo principal na edição do colaborador
 * (`contrato_vinculo`, gravado pela admissão desde a T209).
 *
 * Toda operação resolve no servidor a empresa REAL pelo vínculo: `rh` e `dp`
 * na empresa ativa; o `master_tecnico` lê na empresa ativa ou, sem ela, na
 * empresa do vínculo (leitura global auditada). Nenhum id de empresa vem do
 * navegador. Inexistente e de outra empresa respondem igual (404).
 *
 * A trilha registra só ação, recurso, empresa e o id do VÍNCULO — nunca
 * salário, nível, registro ou matrícula.
 */
@Injectable()
export class ContratoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    private readonly desativacao: DesativacaoColaboradorService,
  ) {}

  async consultar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<ContratoDoColaborador> {
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
        "contrato_vinculo",
        principal.id,
      );
    }
    const [linha, estado] = await Promise.all([
      this.prisma.contratoVinculo.findUnique({
        where: { vinculoId: principal.id },
      }),
      this.desativacao.estado(colaboradorId, empresaId),
    ]);
    return {
      colaboradorId,
      empresaId,
      vinculo: vinculoDoContrato(principal),
      contrato: contratoGravado(linha) ?? CONTRATO_VAZIO,
      atualizadoEm: linha?.atualizadoEm ?? null,
      ...estado,
    };
  }

  async registrar(
    colaboradorId: string,
    dto: RegistrarContratoColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<ContratoDoColaborador> {
    const escopo = resolverEscopoContatos(ctx.actor);
    // O master técnico não edita (o guard já o recusa): sem empresa ativa,
    // nem chega a resolver nada.
    if (escopo.global) {
      return this.auditoria.negarAcesso(
        ctx,
        "contrato_vinculo",
        colaboradorId,
        null,
      );
    }
    const { empresaId, principal } = await this.resolverPrincipal(
      colaboradorId,
      ctx,
      "alter",
      escopo.empresaId,
    );
    // Depois do desligamento, o uso operacional é bloqueado (como nos dados
    // pessoais e nos contatos).
    if (principal.situacao === "encerrado") {
      throw new ConflictException();
    }

    const enviado = contratoEnviado(dto);
    if (enviado.gestorDiretoId !== null) {
      const gestorValido =
        enviado.gestorDiretoId !== colaboradorId &&
        (await this.prisma.vinculoFuncional.findFirst({
          where: { colaboradorId: enviado.gestorDiretoId, empresaId },
          select: { id: true },
        })) !== null;
      if (!gestorValido) {
        throw new CamposRecusadosException([
          { campo: "gestorDiretoId", motivo: "indisponivel" },
        ]);
      }
    }

    const novaMatricula =
      dto.matricula === undefined ? principal.matricula : dto.matricula;

    const estado = await this.desativacao.estado(colaboradorId, empresaId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        let vinculo = principal;
        if (novaMatricula !== principal.matricula) {
          if (novaMatricula !== null) {
            const emUso = await tx.vinculoFuncional.findFirst({
              where: {
                empresaId,
                matricula: novaMatricula,
                NOT: { id: principal.id },
              },
              select: { id: true },
            });
            if (emUso) {
              throw new ConflitoDeCamposException([
                { campo: "matricula", motivo: "em_uso" },
              ]);
            }
          }
          vinculo = await tx.vinculoFuncional.update({
            where: { id: principal.id },
            data: { matricula: novaMatricula },
            select: PROJECAO_VINCULO,
          });
        }

        // T215 — o salário NÃO muda por aqui: com linha do tempo salarial,
        // o contrato espelha o período vigente (gravado pela aba Salários) e
        // o enviado só passa se for o mesmo; sem linha do tempo, o enviado
        // abre a linha da admissão. Lido na transação: um reajuste gravado
        // depois que o formulário abriu continua intacto.
        const vigente = await tx.alteracaoSalarial.findFirst({
          where: { vinculoId: principal.id, removidaEm: null },
          orderBy: { vigenciaInicio: "desc" },
          select: { salarioBruto: true },
        });
        const decisao = decidirSalarioDoContrato(
          vigente?.salarioBruto.toFixed(2) ?? null,
          dto.salarioBruto === undefined ? undefined : enviado.salarioBruto,
        );

        const existente = await tx.contratoVinculo.findUnique({
          where: { vinculoId: principal.id },
          select: { vinculoId: true },
        });
        const dados = {
          nivel: enviado.nivel,
          gestorDiretoColaboradorId: enviado.gestorDiretoId,
          jornadaSemanalHoras: enviado.jornadaSemanalHoras,
          escala: enviado.escala,
          conselhoProfissional: enviado.conselhoProfissional,
          registroProfissional: enviado.registroProfissional,
          dependentesIrrf: enviado.dependentesIrrf,
          pensaoAlimenticiaPercentual: enviado.pensaoAlimenticiaPercentual,
          // Com linha do tempo, o espelho vem do vigente (abaixo), nunca do
          // corpo.
          ...(decisao.acao === "abrir_admissao"
            ? { salarioBruto: decisao.salarioBruto }
            : {}),
        };
        // Sem linha e sem nenhum valor, a linha não nasce (como na admissão).
        let linha = existente
          ? await tx.contratoVinculo.update({
              where: { vinculoId: principal.id },
              data: dados,
            })
          : contratoTemValor(enviado)
            ? await tx.contratoVinculo.create({
                data: { vinculoId: principal.id, empresaId, ...dados },
              })
            : null;
        if (decisao.acao === "manter") {
          // Depois do update (a linha do contrato já está travada nesta
          // transação): o salário do contrato é o do período vigente.
          await espelharSalarioVigente(tx, {
            vinculoId: principal.id,
            empresaId,
          });
          linha = await tx.contratoVinculo.findUnique({
            where: { vinculoId: principal.id },
          });
        }

        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_colaborador_atualizado",
          "contrato_vinculo",
          principal.id,
          empresaId,
        );

        // T215 — sem nenhum período, o salário enviado abre a linha da
        // admissão, na data de admissão.
        if (decisao.acao === "abrir_admissao") {
          const alteracaoId = await registrarSalarioDaAdmissao(
            tx,
            {
              vinculoId: principal.id,
              empresaId,
              dataAdmissao: principal.dataAdmissao,
              registradaPorUserId: ctx.actor.id,
            },
            decisao.salarioBruto,
          );
          await this.auditoria.registrarMutacao(
            tx,
            ctx,
            "pessoas_salario_registrado",
            "alteracao_salarial",
            alteracaoId!,
            empresaId,
          );
        }

        return {
          colaboradorId,
          empresaId,
          vinculo: vinculoDoContrato(vinculo),
          contrato: contratoGravado(linha) ?? CONTRATO_VAZIO,
          atualizadoEm: linha?.atualizadoEm ?? null,
          ...estado,
        };
      });
    } catch (erro) {
      if (eUnicidadeDaMatricula(erro)) {
        throw new ConflitoDeCamposException([
          { campo: "matricula", motivo: "em_uso" },
        ]);
      }
      throw erro;
    }
  }

  /**
   * O vínculo principal do colaborador na empresa (a ativa da sessão, ou a do
   * vínculo para o master sem empresa). Sem vínculo no escopo: 404 auditado.
   * Vínculos em mais de uma empresa sem empresa ativa: 409 (a empresa se
   * escolhe pelo contexto, T163).
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
        "contrato_vinculo",
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
        "contrato_vinculo",
        colaboradorId,
        empresaId,
      );
    }
    const principal = escolherVinculoPrincipal(vinculos)!;
    return { empresaId, principal };
  }
}
