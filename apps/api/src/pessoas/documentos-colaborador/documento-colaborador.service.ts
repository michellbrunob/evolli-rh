import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Prisma,
  type CategoriaDocumentoColaborador,
  type EstadoVerificacaoDocumento,
  type FormatoDocumentoColaborador,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  IndisponibilidadeException,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import type { AuthorizationResource } from "../../auth/authorization/permission.types";
import type { AuthorizationAction } from "../../auth/authorization/permission.types";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import type { PessoasAuditContext } from "../pessoas.types";
import {
  podeAcessarPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import { resolverEscopoContatos } from "../contatos/escopo-contatos.util";
import type { ArmazenamentoDeObjetos } from "../foto-colaborador/armazenamento-de-objetos";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "./armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  type ResultadoDaVerificacao,
  type VerificadorDeArquivos,
} from "./verificador-de-arquivos";
import {
  DOCUMENTOS_POR_CATEGORIA,
  DOCUMENTOS_POR_COLABORADOR,
  DocumentoRecusado,
  TIPO_DO_FORMATO,
  conferirArquivoDoDocumento,
  conferirCategoriaENome,
  nomeDoDownload,
  type ArquivoConferido,
  type ArquivoDoDocumento,
} from "./documento-colaborador.arquivo";

/** Chave do objeto: só ids internos (ADR 0021). */
export function chaveDoDocumento(
  empresaId: string,
  colaboradorId: string,
  documentoId: string,
  versaoId: string,
): string {
  return `v1/empresas/${empresaId}/colaboradores/${colaboradorId}/documentos/${documentoId}/${versaoId}`;
}

/**
 * Envio em andamento há mais que isto sem registro concluído vira lixo: só
 * então a limpeza o apaga (não atropela um envio que ainda está gravando).
 */
export const LIMPEZA_ENVIO_PARADO_MS = 15 * 60 * 1000;
const LIMPEZAS_POR_VEZ = 20;

export interface DocumentoColaboradorDto {
  readonly id: string;
  readonly categoria: CategoriaDocumentoColaborador;
  /** Só em "outros", e nunca para o `master_tecnico`. */
  readonly nome: string | null;
  readonly estado: EstadoVerificacaoDocumento;
  readonly formato: FormatoDocumentoColaborador;
  readonly tamanhoBytes: number;
  readonly versao: number;
  readonly enviadoEm: string;
  readonly verificadoEm: string | null;
}

export interface ResultadoDoEnvio {
  readonly documento: DocumentoColaboradorDto;
  readonly reenvio: boolean;
}

export interface ArquivoBaixado {
  readonly bytes: Buffer;
  readonly tipo: string;
  readonly nome: string;
}

interface Alvo {
  readonly colaboradorId: string;
  readonly empresaId: string;
}

type VersaoComDocumento = Prisma.VersaoDocumentoColaboradorGetPayload<{
  include: { documento: true };
}>;

/** O que o antivírus respondeu, antes de qualquer gravação. */
interface VerificacaoFeita {
  readonly resultado: ResultadoDaVerificacao;
  readonly verificadoEm: Date;
}

const recusar = (erro: unknown): never => {
  if (erro instanceof DocumentoRecusado) {
    throw new RecusaDeNegocioException(erro.motivo);
  }
  throw erro;
};

/**
 * T213 — documentos do colaborador com arquivo real (ADR 0021).
 *
 * - **Escrita** (enviar, trocar, remover, verificar de novo): RH e DP, só na
 *   empresa ativa e só para colaborador com vínculo nela. Fora do escopo e
 *   inexistente respondem igual (404).
 * - **Lista e estado:** RH, DP e `master_tecnico` COM empresa ativa; o nome
 *   livre de "outros" não vai ao `master_tecnico`.
 * - **Download:** só RH e DP, só de versão APROVADA pelo antivírus, e com a
 *   trilha gravada antes (sem registro, sem download).
 * - **Trava do antivírus:** o arquivo passa pelo antivírus ANTES de qualquer
 *   gravação. Sem verificador configurado e operante (ClamAV ausente, fora
 *   do ar ou sem resposta no tempo), o envio é recusado com 503 e nada é
 *   gravado — nem no R2, nem no banco.
 * - **Ordem segura do envio:** antivírus → limpeza pendente registrada →
 *   objeto gravado no R2 → documento e versão no banco, já com o resultado
 *   (e a trilha) → limpeza baixada. O que sobrar no R2 sem registro
 *   concluído é apagado depois.
 * - **Quarentena fail-closed:** só o aprovado é baixado; o reprovado fica
 *   guardado e bloqueado. Versão antiga ainda `em_verificacao` só muda pela
 *   nova tentativa do antivírus.
 * - **Auditoria:** sem conteúdo, nome, categoria, tamanho, hash ou chave.
 */
@Injectable()
export class DocumentoColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    @Inject(ARMAZENAMENTO_DE_DOCUMENTOS)
    private readonly armazenamento: ArmazenamentoDeObjetos,
    @Inject(VERIFICADOR_DE_ARQUIVOS)
    private readonly verificador: VerificadorDeArquivos,
  ) {}

  // ------------------------------------------------------------ escopo

  private async alvoDeEscrita(
    colaboradorId: string,
    action: "create" | "alter",
    ctx: PessoasAuditContext,
  ): Promise<Alvo> {
    const { empresaId } = resolverEscopoPessoas(ctx.actor);
    return this.conferirVinculo(
      colaboradorId,
      empresaId,
      "documento_colaborador",
      action,
      ctx,
    );
  }

  private async alvoDeLeitura(
    colaboradorId: string,
    resource: AuthorizationResource,
    ctx: PessoasAuditContext,
  ): Promise<Alvo> {
    const escopo = resolverEscopoContatos(ctx.actor);
    if (escopo.global) {
      // Sem empresa ativa não há em qual empresa ler: nada é buscado.
      return this.auditoria.negarAcesso(
        ctx,
        "documento_colaborador",
        colaboradorId,
        null,
      );
    }
    return this.conferirVinculo(
      colaboradorId,
      escopo.empresaId,
      resource,
      "read",
      ctx,
    );
  }

  private async conferirVinculo(
    colaboradorId: string,
    empresaId: string,
    resource: AuthorizationResource,
    action: AuthorizationAction,
    ctx: PessoasAuditContext,
  ): Promise<Alvo> {
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      select: { id: true },
    });
    if (
      !vinculo ||
      !podeAcessarPessoas(ctx.actor, resource, action, empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "documento_colaborador",
        colaboradorId,
        empresaId,
      );
    }
    return { colaboradorId, empresaId };
  }

  private async documentoAtivo(alvo: Alvo, documentoId: string) {
    const documento = await this.prisma.documentoColaborador.findFirst({
      where: {
        id: documentoId,
        colaboradorId: alvo.colaboradorId,
        empresaId: alvo.empresaId,
        removidoEm: null,
      },
      include: { versoes: { orderBy: { numero: "desc" }, take: 1 } },
    });
    if (!documento || documento.versoes.length === 0) {
      throw new NotFoundException();
    }
    return { documento, atual: documento.versoes[0]! };
  }

  // ------------------------------------------------------------ leitura

  async listar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<DocumentoColaboradorDto[]> {
    const alvo = await this.alvoDeLeitura(
      colaboradorId,
      "documento_colaborador",
      ctx,
    );
    const documentos = await this.prisma.documentoColaborador.findMany({
      where: {
        colaboradorId: alvo.colaboradorId,
        empresaId: alvo.empresaId,
        removidoEm: null,
      },
      include: { versoes: { orderBy: { numero: "desc" }, take: 1 } },
      orderBy: { criadoEm: "asc" },
    });
    const mostrarNome = ctx.actor.role !== "master_tecnico";
    return documentos
      .filter((d) => d.versoes.length > 0)
      .map((d) => this.dto(d, d.versoes[0]!, mostrarNome));
  }

  async baixar(
    colaboradorId: string,
    documentoId: string,
    ctx: PessoasAuditContext,
  ): Promise<ArquivoBaixado> {
    const alvo = await this.alvoDeLeitura(
      colaboradorId,
      "conteudo_documento_colaborador",
      ctx,
    );
    const { documento, atual } = await this.documentoAtivo(alvo, documentoId);
    // Quarentena: só o aprovado sai.
    if (atual.estado !== "aprovado") {
      throw new RecusaDeNegocioException("documento_nao_disponivel");
    }
    const bytes = await this.lerObjeto(atual.chave);
    // Fail-safe: sem trilha gravada, nada é entregue.
    await this.prisma.$transaction((tx) =>
      this.auditoria.registrarNaTransacao(tx, ctx, {
        action: "pessoas_documento_colaborador_baixado",
        resource: "documento_colaborador",
        resourceId: documento.id,
        empresaId: alvo.empresaId,
        result: "success",
      }),
    );
    return {
      bytes,
      tipo: TIPO_DO_FORMATO[atual.formato],
      nome: nomeDoDownload(documento.categoria, atual.formato, atual.criadoEm),
    };
  }

  // ------------------------------------------------------------ escrita

  /** Novo documento (versão 1). */
  async enviar(
    colaboradorId: string,
    pedido: {
      readonly categoria: string | undefined;
      readonly nome: string | undefined;
      readonly arquivo: ArquivoDoDocumento;
    },
    chaveIdempotencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoDoEnvio> {
    const alvo = await this.alvoDeEscrita(colaboradorId, "create", ctx);
    await this.tentarLimpezasPendentes(alvo.empresaId);

    let identificacao: ReturnType<typeof conferirCategoriaENome>;
    let conferido: ArquivoConferido;
    try {
      identificacao = conferirCategoriaENome(pedido.categoria, pedido.nome);
      conferido = conferirArquivoDoDocumento(pedido.arquivo);
    } catch (erro) {
      return recusar(erro);
    }

    const reenvio = await this.reenvio(
      alvo,
      chaveIdempotencia,
      ctx,
      (v) =>
        v.numero === 1 &&
        v.documento.categoria === identificacao.categoria &&
        v.documento.nomeOutros === identificacao.nomeOutros &&
        v.hashSha256 === conferido.hashSha256,
    );
    if (reenvio) return reenvio;

    await this.conferirLimites(this.prisma, alvo, identificacao.categoria);
    const verificacao = await this.verificarAntesDeGravar(pedido.arquivo.bytes);

    const documentoId = randomUUID();
    const versaoId = randomUUID();
    const chave = chaveDoDocumento(
      alvo.empresaId,
      alvo.colaboradorId,
      documentoId,
      versaoId,
    );
    await this.gravarObjeto(alvo, chave, pedido.arquivo.bytes, conferido);

    let versao: VersaoComDocumento;
    try {
      versao = await this.prisma.$transaction(async (tx) => {
        await this.conferirLimites(tx, alvo, identificacao.categoria);
        await tx.documentoColaborador.create({
          data: {
            id: documentoId,
            empresaId: alvo.empresaId,
            colaboradorId: alvo.colaboradorId,
            categoria: identificacao.categoria,
            nomeOutros: identificacao.nomeOutros,
            criadoPorId: ctx.actor.id,
          },
        });
        const criada = await this.criarVersao(tx, {
          versaoId,
          documentoId,
          numero: 1,
          chave,
          conferido,
          verificacao,
          chaveIdempotencia,
          alvo,
          ctx,
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_documento_colaborador_enviado",
          "documento_colaborador",
          documentoId,
          alvo.empresaId,
        );
        await this.registrarResultado(tx, ctx, verificacao, criada);
        return criada;
      });
    } catch (erro) {
      await this.descartarObjeto(alvo, chave);
      const corrida = await this.corridaDeIdempotencia(
        erro,
        alvo,
        chaveIdempotencia,
        ctx,
      );
      if (corrida) return corrida;
      throw erro;
    }

    return {
      documento: this.dto(versao.documento, versao, true),
      reenvio: false,
    };
  }

  /** Troca: versão nova; a anterior fica preservada. */
  async trocar(
    colaboradorId: string,
    documentoId: string,
    arquivo: ArquivoDoDocumento,
    chaveIdempotencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoDoEnvio> {
    const alvo = await this.alvoDeEscrita(colaboradorId, "alter", ctx);
    await this.tentarLimpezasPendentes(alvo.empresaId);
    const { atual } = await this.documentoAtivo(alvo, documentoId);

    let conferido: ArquivoConferido;
    try {
      conferido = conferirArquivoDoDocumento(arquivo);
    } catch (erro) {
      return recusar(erro);
    }

    const reenvio = await this.reenvio(
      alvo,
      chaveIdempotencia,
      ctx,
      (v) =>
        v.documentoId === documentoId &&
        v.numero > 1 &&
        v.hashSha256 === conferido.hashSha256,
    );
    if (reenvio) return reenvio;
    const verificacao = await this.verificarAntesDeGravar(arquivo.bytes);

    const versaoId = randomUUID();
    const chave = chaveDoDocumento(
      alvo.empresaId,
      alvo.colaboradorId,
      documentoId,
      versaoId,
    );
    await this.gravarObjeto(alvo, chave, arquivo.bytes, conferido);

    let versao: VersaoComDocumento;
    try {
      versao = await this.prisma.$transaction(async (tx) => {
        const criada = await this.criarVersao(tx, {
          versaoId,
          documentoId,
          numero: atual.numero + 1,
          chave,
          conferido,
          verificacao,
          chaveIdempotencia,
          alvo,
          ctx,
        });
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_documento_colaborador_substituido",
          "documento_colaborador",
          documentoId,
          alvo.empresaId,
        );
        await this.registrarResultado(tx, ctx, verificacao, criada);
        return criada;
      });
    } catch (erro) {
      await this.descartarObjeto(alvo, chave);
      const corrida = await this.corridaDeIdempotencia(
        erro,
        alvo,
        chaveIdempotencia,
        ctx,
      );
      if (corrida) return corrida;
      throw erro;
    }

    return {
      documento: this.dto(versao.documento, versao, true),
      reenvio: false,
    };
  }

  /** Remoção LÓGICA: some da lista e do download; o objeto fica no R2. */
  async remover(
    colaboradorId: string,
    documentoId: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    const alvo = await this.alvoDeEscrita(colaboradorId, "alter", ctx);
    await this.prisma.$transaction(async (tx) => {
      const atualizados = await tx.documentoColaborador.updateMany({
        where: {
          id: documentoId,
          colaboradorId: alvo.colaboradorId,
          empresaId: alvo.empresaId,
          removidoEm: null,
        },
        data: { removidoEm: new Date(), removidoPorId: ctx.actor.id },
      });
      if (atualizados.count === 0) throw new NotFoundException();
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_documento_colaborador_removido",
        "documento_colaborador",
        documentoId,
        alvo.empresaId,
      );
    });
  }

  /** Nova tentativa do antivírus para a versão atual ainda em verificação. */
  async verificarDeNovo(
    colaboradorId: string,
    documentoId: string,
    ctx: PessoasAuditContext,
  ): Promise<DocumentoColaboradorDto> {
    const alvo = await this.alvoDeEscrita(colaboradorId, "alter", ctx);
    const { documento, atual } = await this.documentoAtivo(alvo, documentoId);
    if (atual.estado !== "em_verificacao") {
      return this.dto(documento, atual, true);
    }
    const bytes = await this.lerObjeto(atual.chave);
    const estado = await this.verificar({ ...atual, documento }, bytes, ctx);
    return this.dto(documento, { ...atual, ...estado }, true);
  }

  // ------------------------------------------------------------ internos

  private async conferirLimites(
    db: Prisma.TransactionClient | PrismaService,
    alvo: Alvo,
    categoria: CategoriaDocumentoColaborador,
  ): Promise<void> {
    const base = {
      colaboradorId: alvo.colaboradorId,
      empresaId: alvo.empresaId,
      removidoEm: null,
    };
    const [total, naCategoria] = await Promise.all([
      db.documentoColaborador.count({ where: base }),
      db.documentoColaborador.count({ where: { ...base, categoria } }),
    ]);
    if (naCategoria >= DOCUMENTOS_POR_CATEGORIA) {
      throw new RecusaDeNegocioException("documento_limite_categoria");
    }
    if (total >= DOCUMENTOS_POR_COLABORADOR) {
      throw new RecusaDeNegocioException("documento_limite_colaborador");
    }
  }

  private criarVersao(
    tx: Prisma.TransactionClient,
    dados: {
      versaoId: string;
      documentoId: string;
      numero: number;
      chave: string;
      conferido: ArquivoConferido;
      verificacao: VerificacaoFeita;
      chaveIdempotencia: string | undefined;
      alvo: Alvo;
      ctx: PessoasAuditContext;
    },
  ): Promise<VersaoComDocumento> {
    return tx.versaoDocumentoColaborador
      .create({
        data: {
          id: dados.versaoId,
          documentoId: dados.documentoId,
          empresaId: dados.alvo.empresaId,
          numero: dados.numero,
          chave: dados.chave,
          formato: dados.conferido.formato,
          tamanhoBytes: dados.conferido.tamanhoBytes,
          hashSha256: dados.conferido.hashSha256,
          // O antivírus já respondeu: a versão nasce com o resultado.
          estado: dados.verificacao.resultado,
          verificadoEm: dados.verificacao.verificadoEm,
          enviadaPorId: dados.ctx.actor.id,
          chaveIdempotencia: dados.chaveIdempotencia ?? null,
        },
        include: { documento: true },
      })
      .then(async (versao) => {
        // Registro concluído: o objeto deixa de ser candidato à limpeza.
        await tx.limpezaDocumentoColaboradorPendente.deleteMany({
          where: { chave: dados.chave },
        });
        return versao;
      });
  }

  /**
   * Reenvio com a mesma chave (mesma conta e empresa): devolve o que já foi
   * registrado; conteúdo diferente com a mesma chave é recusado.
   */
  private async reenvio(
    alvo: Alvo,
    chaveIdempotencia: string | undefined,
    ctx: PessoasAuditContext,
    mesmoPedido: (versao: VersaoComDocumento) => boolean,
  ): Promise<ResultadoDoEnvio | null> {
    if (!chaveIdempotencia) return null;
    const existente = await this.prisma.versaoDocumentoColaborador.findUnique({
      where: {
        enviadaPorId_empresaId_chaveIdempotencia: {
          enviadaPorId: ctx.actor.id,
          empresaId: alvo.empresaId,
          chaveIdempotencia,
        },
      },
      include: { documento: true },
    });
    if (!existente) return null;
    if (
      existente.documento.colaboradorId !== alvo.colaboradorId ||
      !mesmoPedido(existente)
    ) {
      throw new RecusaDeNegocioException("idempotencia_conteudo_divergente");
    }
    const atual = await this.prisma.versaoDocumentoColaborador.findFirst({
      where: { documentoId: existente.documentoId },
      orderBy: { numero: "desc" },
    });
    return {
      documento: this.dto(existente.documento, atual ?? existente, true),
      reenvio: true,
    };
  }

  /** Dois envios simultâneos com a mesma chave: o segundo vira reenvio. */
  private async corridaDeIdempotencia(
    erro: unknown,
    alvo: Alvo,
    chaveIdempotencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<ResultadoDoEnvio | null> {
    if (
      !chaveIdempotencia ||
      !(erro instanceof Prisma.PrismaClientKnownRequestError) ||
      erro.code !== "P2002"
    ) {
      return null;
    }
    return this.reenvio(alvo, chaveIdempotencia, ctx, () => true);
  }

  /**
   * Registra a limpeza ANTES de gravar: se o processo cair no meio, o objeto
   * não fica órfão sem rastro. Falha do R2 é 503 e não deixa registro.
   */
  private async gravarObjeto(
    alvo: Alvo,
    chave: string,
    bytes: Buffer,
    conferido: ArquivoConferido,
  ): Promise<void> {
    await this.prisma.limpezaDocumentoColaboradorPendente.create({
      data: {
        chave,
        motivo: "envio_em_andamento",
        empresaId: alvo.empresaId,
        colaboradorId: alvo.colaboradorId,
      },
    });
    try {
      await this.armazenamento.gravar(
        chave,
        bytes,
        TIPO_DO_FORMATO[conferido.formato],
      );
    } catch {
      await this.descartarObjeto(alvo, chave);
      throw new ServiceUnavailableException({
        message: "Armazenamento indisponível.",
        codigo: "documento_armazenamento_indisponivel",
      });
    }
  }

  /** O objeto não ganhou registro: apaga; se não der, fica pendente. */
  private async descartarObjeto(alvo: Alvo, chave: string): Promise<void> {
    try {
      await this.armazenamento.apagar(chave);
      await this.prisma.limpezaDocumentoColaboradorPendente.deleteMany({
        where: { chave },
      });
    } catch {
      await this.prisma.limpezaDocumentoColaboradorPendente
        .upsert({
          where: { chave },
          create: {
            chave,
            motivo: "falha_no_envio",
            empresaId: alvo.empresaId,
            colaboradorId: alvo.colaboradorId,
          },
          update: { motivo: "falha_no_envio" },
        })
        .catch(() => undefined);
    }
  }

  private async lerObjeto(chave: string): Promise<Buffer> {
    let bytes: Buffer | null;
    try {
      bytes = await this.armazenamento.ler(chave);
    } catch {
      throw new ServiceUnavailableException({
        message: "Armazenamento indisponível.",
        codigo: "documento_armazenamento_indisponivel",
      });
    }
    if (!bytes) throw new NotFoundException();
    return bytes;
  }

  /**
   * A trava: o arquivo passa pelo antivírus antes de qualquer gravação. Sem
   * verificador configurado, fora do ar ou sem resposta no tempo, 503 com
   * código fixo — e nada é gravado no R2 nem no banco.
   */
  private async verificarAntesDeGravar(
    bytes: Buffer,
  ): Promise<VerificacaoFeita> {
    try {
      const resultado = await this.verificador.verificar(bytes);
      return { resultado, verificadoEm: new Date() };
    } catch {
      throw new IndisponibilidadeException(
        "documento_verificacao_indisponivel",
      );
    }
  }

  /** A trilha do resultado da verificação, na mesma transação do registro. */
  private registrarResultado(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    verificacao: VerificacaoFeita,
    versao: VersaoComDocumento,
  ) {
    return this.auditoria.registrarMutacao(
      tx,
      ctx,
      verificacao.resultado === "aprovado"
        ? "pessoas_documento_colaborador_aprovado"
        : "pessoas_documento_colaborador_reprovado",
      "documento_colaborador",
      versao.documentoId,
      versao.empresaId,
    );
  }

  /**
   * Nova tentativa para versão antiga ainda em verificação. Aprovado ou
   * reprovado muda o estado (com a trilha); falha mantém `em_verificacao` —
   * e o download bloqueado.
   */
  private async verificar(
    versao: VersaoComDocumento,
    bytes: Buffer,
    ctx: PessoasAuditContext,
  ): Promise<{
    estado: EstadoVerificacaoDocumento;
    verificadoEm: Date | null;
  }> {
    let resultado: "aprovado" | "reprovado";
    try {
      resultado = await this.verificador.verificar(bytes);
    } catch {
      await this.prisma
        .$transaction((tx) =>
          this.auditoria.registrarNaTransacao(tx, ctx, {
            action: "pessoas_documento_colaborador_nao_verificado",
            resource: "documento_colaborador",
            resourceId: versao.documentoId,
            empresaId: versao.empresaId,
            result: "failure",
          }),
        )
        .catch(() => undefined);
      return { estado: "em_verificacao", verificadoEm: null };
    }
    const verificadoEm = new Date();
    await this.prisma.$transaction(async (tx) => {
      const mudou = await tx.versaoDocumentoColaborador.updateMany({
        where: { id: versao.id, estado: "em_verificacao" },
        data: { estado: resultado, verificadoEm },
      });
      if (mudou.count === 0) return;
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        resultado === "aprovado"
          ? "pessoas_documento_colaborador_aprovado"
          : "pessoas_documento_colaborador_reprovado",
        "documento_colaborador",
        versao.documentoId,
        versao.empresaId,
      );
    });
    return { estado: resultado, verificadoEm };
  }

  /**
   * Apaga do R2 os objetos sem registro concluído: falhas de envio e envios
   * parados há mais de 15 minutos. Se o objeto ganhou registro, só a
   * pendência sai. Nunca derruba a operação que a chamou.
   */
  async tentarLimpezasPendentes(
    empresaId: string,
    agora: Date = new Date(),
  ): Promise<number> {
    let apagadas = 0;
    try {
      const limite = new Date(agora.getTime() - LIMPEZA_ENVIO_PARADO_MS);
      const pendentes =
        await this.prisma.limpezaDocumentoColaboradorPendente.findMany({
          where: {
            empresaId,
            OR: [
              { motivo: "falha_no_envio" },
              { motivo: "envio_em_andamento", criadoEm: { lt: limite } },
            ],
          },
          orderBy: { criadoEm: "asc" },
          take: LIMPEZAS_POR_VEZ,
        });
      for (const pendente of pendentes) {
        const registrada =
          await this.prisma.versaoDocumentoColaborador.findUnique({
            where: { chave: pendente.chave },
            select: { id: true },
          });
        try {
          if (!registrada) await this.armazenamento.apagar(pendente.chave);
          await this.prisma.limpezaDocumentoColaboradorPendente.delete({
            where: { id: pendente.id },
          });
          apagadas += 1;
        } catch {
          await this.prisma.limpezaDocumentoColaboradorPendente.update({
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

  private dto(
    documento: {
      id: string;
      categoria: CategoriaDocumentoColaborador;
      nomeOutros: string | null;
    },
    versao: {
      estado: EstadoVerificacaoDocumento;
      formato: FormatoDocumentoColaborador;
      tamanhoBytes: number;
      numero: number;
      criadoEm: Date;
      verificadoEm: Date | null;
    },
    mostrarNome: boolean,
  ): DocumentoColaboradorDto {
    return {
      id: documento.id,
      categoria: documento.categoria,
      nome: mostrarNome ? documento.nomeOutros : null,
      estado: versao.estado,
      formato: versao.formato,
      tamanhoBytes: versao.tamanhoBytes,
      versao: versao.numero,
      enviadoEm: versao.criadoEm.toISOString(),
      verificadoEm: versao.verificadoEm?.toISOString() ?? null,
    };
  }
}
