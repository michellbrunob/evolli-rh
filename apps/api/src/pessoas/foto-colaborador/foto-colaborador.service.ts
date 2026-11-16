import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RecusaDeNegocioException } from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import type { PessoasAuditContext } from "../pessoas.types";
import {
  podeAcessarPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import {
  ARMAZENAMENTO_DE_FOTOS,
  type ArmazenamentoDeObjetos,
} from "./armazenamento-de-objetos";
import {
  FotoDoColaboradorRecusada,
  TAMANHOS_DA_FOTO,
  processarFotoDoColaborador,
  type FotoEnviada,
  type TamanhoDaFoto,
} from "./foto-colaborador.processamento";

/** Prefixo das versões: só ids internos (ADR 0020). */
export function prefixoDaFoto(
  empresaId: string,
  colaboradorId: string,
  arquivoId: string,
): string {
  return `v1/empresas/${empresaId}/colaboradores/${colaboradorId}/foto/${arquivoId}/`;
}

export function chaveDaVersao(prefixo: string, tamanho: TamanhoDaFoto): string {
  return `${prefixo}foto-${tamanho}.webp`;
}

const chavesDe = (prefixo: string) =>
  TAMANHOS_DA_FOTO.map((t) => chaveDaVersao(prefixo, t));

type MotivoDaLimpeza = "substituicao" | "remocao" | "falha_no_envio";

interface Alvo {
  readonly colaboradorId: string;
  readonly empresaId: string;
}

/** Quantas limpezas pendentes cada operação tenta de passagem. */
const LIMPEZAS_POR_VEZ = 20;

/**
 * T209 — foto do colaborador (ADR 0020).
 *
 * - **Escrita** (enviar, substituir, remover): RH e DP, só na empresa ativa
 *   da sessão, e só para colaborador com vínculo nela; `master_tecnico` e os
 *   demais papéis nunca escrevem. Fora do escopo e inexistente respondem
 *   igual (404).
 * - **Leitura**: RH, DP e `master_tecnico` COM empresa ativa, depois de
 *   conferir o vínculo naquela empresa — antes de tocar no armazenamento.
 *   O prefixo do objeto não é autorização.
 * - **Ordem segura:** as versões novas são gravadas ANTES de o banco apontar
 *   para elas; só depois as antigas são apagadas. O que não puder ser
 *   apagado vira limpeza pendente (só ids e a chave), tentada de novo a cada
 *   operação de foto.
 * - **Auditoria** (dentro da transação): envio, substituição e remoção —
 *   sem conteúdo, hash, tamanho, dimensões ou chave do objeto.
 */
@Injectable()
export class FotoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    @Inject(ARMAZENAMENTO_DE_FOTOS)
    private readonly armazenamento: ArmazenamentoDeObjetos,
  ) {}

  private async alvoDeEscrita(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<Alvo> {
    const { empresaId } = resolverEscopoPessoas(ctx.actor);
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (
      !vinculo ||
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "alter",
        empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "foto_colaborador",
        colaboradorId,
        empresaId,
      );
    }
    return { colaboradorId, empresaId };
  }

  private async alvoDeLeitura(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<Alvo> {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) {
      // Sem empresa ativa não há em qual empresa ler: nada é buscado.
      return this.auditoria.negarAcesso(
        ctx,
        "foto_colaborador",
        colaboradorId,
        null,
      );
    }
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId: escopo.empresaId },
      select: { id: true },
    });
    if (
      !vinculo ||
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "read",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "foto_colaborador",
        colaboradorId,
        escopo.empresaId,
      );
    }
    return { colaboradorId, empresaId: escopo.empresaId };
  }

  /** Envia ou substitui a foto. Devolve só a versão e a data. */
  async enviar(
    colaboradorId: string,
    enviada: FotoEnviada,
    ctx: PessoasAuditContext,
  ): Promise<{ versao: number; atualizadoEm: string }> {
    const alvo = await this.alvoDeEscrita(colaboradorId, ctx);
    await this.tentarLimpezasPendentes(alvo.empresaId);

    let processada;
    try {
      processada = await processarFotoDoColaborador(enviada);
    } catch (erro) {
      if (erro instanceof FotoDoColaboradorRecusada) {
        throw new RecusaDeNegocioException(erro.motivo);
      }
      throw erro;
    }

    const arquivoId = randomUUID();
    const prefixo = prefixoDaFoto(
      alvo.empresaId,
      alvo.colaboradorId,
      arquivoId,
    );
    const gravadas: string[] = [];
    try {
      for (const tamanho of TAMANHOS_DA_FOTO) {
        const chave = chaveDaVersao(prefixo, tamanho);
        await this.armazenamento.gravar(
          chave,
          processada.versoes[tamanho],
          "image/webp",
        );
        gravadas.push(chave);
      }
    } catch {
      await this.apagarOuPendenciar(gravadas, "falha_no_envio", alvo);
      throw new ServiceUnavailableException({
        message: "Armazenamento indisponível.",
        codigo: "foto_armazenamento_indisponivel",
      });
    }

    let anterior: { chaveAtual: string } | null;
    let resultado: { versao: number; atualizadoEm: Date };
    try {
      ({ anterior, resultado } = await this.prisma.$transaction(async (tx) => {
        const existente = await tx.fotoColaborador.findUnique({
          where: {
            colaboradorId_empresaId: {
              colaboradorId: alvo.colaboradorId,
              empresaId: alvo.empresaId,
            },
          },
          select: { chaveAtual: true },
        });
        const dados = {
          arquivoId,
          chaveAtual: prefixo,
          hashSha256: processada.hashSha256,
          tamanhoBytes: processada.tamanhoBytes,
          tipo: "image/webp",
          enviadaPorId: ctx.actor.id,
        };
        const linha = await tx.fotoColaborador.upsert({
          where: {
            colaboradorId_empresaId: {
              colaboradorId: alvo.colaboradorId,
              empresaId: alvo.empresaId,
            },
          },
          create: {
            colaboradorId: alvo.colaboradorId,
            empresaId: alvo.empresaId,
            ...dados,
          },
          update: { ...dados, versao: { increment: 1 } },
          select: { versao: true, atualizadoEm: true },
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          existente
            ? "pessoas_foto_colaborador_substituida"
            : "pessoas_foto_colaborador_enviada",
          "foto_colaborador",
          alvo.colaboradorId,
          alvo.empresaId,
        );
        return { anterior: existente, resultado: linha };
      }));
    } catch (erro) {
      // O banco não apontou para as versões novas: elas não podem sobrar.
      await this.apagarOuPendenciar(gravadas, "falha_no_envio", alvo);
      throw erro;
    }

    if (anterior && anterior.chaveAtual !== prefixo) {
      await this.apagarOuPendenciar(
        chavesDe(anterior.chaveAtual),
        "substituicao",
        alvo,
      );
    }
    return {
      versao: resultado.versao,
      atualizadoEm: resultado.atualizadoEm.toISOString(),
    };
  }

  /** Remove a foto (sem foto, nada acontece). */
  async remover(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    const alvo = await this.alvoDeEscrita(colaboradorId, ctx);
    await this.tentarLimpezasPendentes(alvo.empresaId);
    const removida = await this.prisma.$transaction(async (tx) => {
      const existente = await tx.fotoColaborador.findUnique({
        where: {
          colaboradorId_empresaId: {
            colaboradorId: alvo.colaboradorId,
            empresaId: alvo.empresaId,
          },
        },
        select: { id: true, chaveAtual: true },
      });
      if (!existente) return null;
      await tx.fotoColaborador.delete({ where: { id: existente.id } });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_foto_colaborador_removida",
        "foto_colaborador",
        alvo.colaboradorId,
        alvo.empresaId,
      );
      return existente;
    });
    if (removida) {
      await this.apagarOuPendenciar(
        chavesDe(removida.chaveAtual),
        "remocao",
        alvo,
      );
    }
  }

  /** Os bytes de uma versão, depois de autorizar. */
  async ler(
    colaboradorId: string,
    tamanho: TamanhoDaFoto,
    ctx: PessoasAuditContext,
  ): Promise<{ bytes: Buffer; versao: number }> {
    const alvo = await this.alvoDeLeitura(colaboradorId, ctx);
    const foto = await this.prisma.fotoColaborador.findUnique({
      where: {
        colaboradorId_empresaId: {
          colaboradorId: alvo.colaboradorId,
          empresaId: alvo.empresaId,
        },
      },
      select: { chaveAtual: true, versao: true },
    });
    if (!foto) throw new NotFoundException();
    let bytes: Buffer | null;
    try {
      bytes = await this.armazenamento.ler(
        chaveDaVersao(foto.chaveAtual, tamanho),
      );
    } catch {
      throw new ServiceUnavailableException({
        message: "Armazenamento indisponível.",
        codigo: "foto_armazenamento_indisponivel",
      });
    }
    if (!bytes) throw new NotFoundException();
    return { bytes, versao: foto.versao };
  }

  /** Apaga cada chave; o que falhar vira limpeza pendente. */
  private async apagarOuPendenciar(
    chaves: readonly string[],
    motivo: MotivoDaLimpeza,
    alvo: Alvo,
  ): Promise<void> {
    const falharam: string[] = [];
    for (const chave of chaves) {
      try {
        await this.armazenamento.apagar(chave);
      } catch {
        falharam.push(chave);
      }
    }
    if (falharam.length === 0) return;
    await this.prisma.limpezaFotoColaboradorPendente.createMany({
      data: falharam.map((chave) => ({
        chave,
        motivo,
        empresaId: alvo.empresaId,
        colaboradorId: alvo.colaboradorId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Tenta de novo as limpezas pendentes da empresa (de passagem, a cada
   * operação de foto). Nunca derruba a operação que a chamou.
   */
  async tentarLimpezasPendentes(empresaId: string): Promise<number> {
    let apagadas = 0;
    try {
      const pendentes =
        await this.prisma.limpezaFotoColaboradorPendente.findMany({
          where: { empresaId },
          orderBy: { criadoEm: "asc" },
          take: LIMPEZAS_POR_VEZ,
        });
      for (const pendente of pendentes) {
        try {
          await this.armazenamento.apagar(pendente.chave);
          await this.prisma.limpezaFotoColaboradorPendente.delete({
            where: { id: pendente.id },
          });
          apagadas += 1;
        } catch {
          await this.prisma.limpezaFotoColaboradorPendente.update({
            where: { id: pendente.id },
            data: {
              tentativas: { increment: 1 },
              ultimaTentativaEm: new Date(),
            },
          });
        }
      }
    } catch {
      // A limpeza é de passagem: falhar aqui não impede a operação.
    }
    return apagadas;
  }
}
