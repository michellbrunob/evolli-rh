import { randomUUID } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  IndisponibilidadeException,
  RecusaDeNegocioException,
  campoDaPergunta,
} from "../../common/erros/recusa-por-campo";
import { ARMAZENAMENTO_DE_DOCUMENTOS } from "../../pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  type VerificadorDeArquivos,
} from "../../pessoas/documentos-colaborador/verificador-de-arquivos";
import type { ArmazenamentoDeObjetos } from "../../pessoas/foto-colaborador/armazenamento-de-objetos";
import { PessoasAuditoriaService } from "../../pessoas/pessoas-auditoria.service";
import type { PessoasAuditContext } from "../../pessoas/pessoas.types";
import { PesquisasService } from "../pesquisas.service";
import {
  ETAPAS_NR1,
  acompanhamentoVazio,
  adicionarEvidencia,
  conferirAcompanhamento,
  detalharAcompanhamento,
  evidenciaDa,
  lerAcompanhamento,
  removerEvidencia,
  type AcompanhamentoNr1,
  type AcompanhamentoNr1Detalhe,
  type EtapaNr1,
} from "./copsoq/acompanhamento";
import {
  EvidenciaRecusada,
  TIPO_DO_FORMATO_DA_EVIDENCIA,
  chaveDaEvidencia,
  conferirArquivoDaEvidencia,
  nomeDaEvidencia,
  type ArquivoDaEvidencia,
} from "./copsoq/evidencias";

/** O arquivo enviado e o nome que veio no cabeçalho (codificado). */
export interface EvidenciaEnviada extends ArquivoDaEvidencia {
  readonly nome: string | undefined;
}

export interface EvidenciaBaixada {
  bytes: Buffer;
  tipo: string;
  nome: string;
}

/**
 * T216 — conformidade com a NR-1 (riscos psicossociais): as 7 etapas que a
 * empresa marca e guarda e o plano de ação escrito pelo RH, em
 * `pesquisa.acompanhamento`. O resultado do modelo sai pelos resultados da
 * pesquisa (`ResultadosPesquisa.modelo`); aqui fica só o acompanhamento.
 *
 * Arquivos de evidência: no armazenamento privado e com o antivírus dos
 * documentos do colaborador (T213, ADR 0021) — conferidos e verificados
 * ANTES de gravar (reprovado: recusado; antivírus fora do ar: 503); o
 * registro fica no acompanhamento, com a linha da pesquisa travada.
 */
@Injectable()
export class AcompanhamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pesquisas: PesquisasService,
    private readonly auditoria: PessoasAuditoriaService,
    @Inject(ARMAZENAMENTO_DE_DOCUMENTOS)
    private readonly armazenamento: ArmazenamentoDeObjetos,
    @Inject(VERIFICADOR_DE_ARQUIVOS)
    private readonly verificador: VerificadorDeArquivos,
  ) {}

  private async detalhe(
    p: { id: string; identificacao: string; publicadaEm: Date | null },
    bruto: unknown,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const [respostas, participantes] = await Promise.all([
      this.prisma.pesquisaResposta.count({ where: { pesquisaId: p.id } }),
      this.prisma.pesquisaParticipante.count({ where: { pesquisaId: p.id } }),
    ]);
    return detalharAcompanhamento(lerAcompanhamento(bruto), {
      anonima: p.identificacao === "anonima",
      respostas,
      participantes,
      publicadaEm: p.publicadaEm,
    });
  }

  async obter(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "leitura",
      ctx,
    );
    if (p.modelo !== "copsoq") throw new NotFoundException();
    return this.detalhe(p, p.acompanhamento ?? acompanhamentoVazio());
  }

  async gravar(
    id: string,
    corpo: unknown,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const gravado = await this.prisma.$transaction(async (tx) => {
      const { pesquisa: p, empresaId } = await this.pesquisas.pesquisaDoModelo(
        tx,
        id,
        "escrita",
        ctx,
      );
      if (p.modelo !== "copsoq") throw new NotFoundException();
      const conferido = conferirAcompanhamento(
        corpo,
        lerAcompanhamento(p.acompanhamento),
        new Date(),
      );
      if (!conferido.ok) throw new CamposRecusadosException(conferido.erros);
      const novo = await tx.pesquisa.update({
        where: { id: p.id },
        data: {
          acompanhamento: conferido.valor as unknown as Prisma.InputJsonValue,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pesquisas_pesquisa_alterada",
        "pesquisa",
        p.id,
        empresaId,
      );
      return novo;
    });
    return this.detalhe(gravado, gravado.acompanhamento);
  }

  /** Anexa um arquivo de evidência à etapa (RH e DP). */
  async enviarEvidencia(
    id: string,
    etapaDaRota: string,
    arquivo: EvidenciaEnviada,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const etapa = this.etapaConhecida(etapaDaRota);
    const { pesquisa: p, empresaId } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "escrita",
      ctx,
    );
    if (p.modelo !== "copsoq") throw new NotFoundException();
    let conferido: ReturnType<typeof conferirArquivoDaEvidencia>;
    try {
      conferido = conferirArquivoDaEvidencia(arquivo);
    } catch (erro) {
      if (erro instanceof EvidenciaRecusada) {
        throw new RecusaDeNegocioException(erro.motivo);
      }
      throw erro;
    }
    // A etapa e o limite, antes do antivírus (relidos na transação).
    const vaga = adicionarEvidencia(
      lerAcompanhamento(p.acompanhamento),
      etapa,
      this.registro("pre", conferido, arquivo, "", empresaId, id, etapa),
    );
    if (!vaga.ok) this.recusarEtapa(etapa, vaga.motivo);

    let resultado: Awaited<ReturnType<VerificadorDeArquivos["verificar"]>>;
    try {
      resultado = await this.verificador.verificar(arquivo.bytes);
    } catch {
      throw new IndisponibilidadeException(
        "evidencia_verificacao_indisponivel",
      );
    }
    if (resultado !== "aprovado") {
      throw new RecusaDeNegocioException("evidencia_reprovada_antivirus");
    }

    const arquivoId = randomUUID();
    const novo = this.registro(
      arquivoId,
      conferido,
      arquivo,
      new Date().toISOString(),
      empresaId,
      id,
      etapa,
    );
    try {
      await this.armazenamento.gravar(
        novo.chave,
        arquivo.bytes,
        TIPO_DO_FORMATO_DA_EVIDENCIA[conferido.formato],
      );
    } catch {
      await this.apagarSemFalhar(novo.chave);
      throw new IndisponibilidadeException(
        "evidencia_armazenamento_indisponivel",
      );
    }
    try {
      const gravado = await this.prisma.$transaction(async (tx) => {
        const atual = await this.travar(tx, id, ctx);
        const r = adicionarEvidencia(
          lerAcompanhamento(atual.acompanhamento),
          etapa,
          novo,
        );
        if (!r.ok) this.recusarEtapa(etapa, r.motivo);
        return this.gravarAcompanhamento(tx, ctx, id, empresaId, r.valor);
      });
      return this.detalhe(gravado, gravado.acompanhamento);
    } catch (erro) {
      await this.apagarSemFalhar(novo.chave);
      throw erro;
    }
  }

  /** O arquivo de evidência (download privado; só RH e DP). */
  async baixarEvidencia(
    id: string,
    etapaDaRota: string,
    arquivoId: string,
    ctx: PessoasAuditContext,
  ): Promise<EvidenciaBaixada> {
    const etapa = this.etapaConhecida(etapaDaRota);
    // "escrita": os arquivos podem ter dados pessoais (listas de presença);
    // como nos documentos do colaborador, o master técnico não os lê.
    const { pesquisa: p } = await this.pesquisas.pesquisaDoModelo(
      this.prisma,
      id,
      "escrita",
      ctx,
    );
    if (p.modelo !== "copsoq") throw new NotFoundException();
    const arquivo = evidenciaDa(
      lerAcompanhamento(p.acompanhamento),
      etapa,
      arquivoId,
    );
    if (!arquivo) throw new NotFoundException();
    let bytes: Buffer | null;
    try {
      bytes = await this.armazenamento.ler(arquivo.chave);
    } catch {
      throw new IndisponibilidadeException(
        "evidencia_armazenamento_indisponivel",
      );
    }
    if (!bytes) throw new NotFoundException();
    return {
      bytes,
      tipo: TIPO_DO_FORMATO_DA_EVIDENCIA[arquivo.formato],
      nome: arquivo.nome,
    };
  }

  /** Remove o arquivo da etapa e do armazenamento (RH e DP). */
  async removerEvidencia(
    id: string,
    etapaDaRota: string,
    arquivoId: string,
    ctx: PessoasAuditContext,
  ): Promise<AcompanhamentoNr1Detalhe> {
    const etapa = this.etapaConhecida(etapaDaRota);
    let chave = "";
    const gravado = await this.prisma.$transaction(async (tx) => {
      const { pesquisa: p, empresaId } = await this.pesquisas.pesquisaDoModelo(
        tx,
        id,
        "escrita",
        ctx,
      );
      if (p.modelo !== "copsoq") throw new NotFoundException();
      const atual = await this.travar(tx, id, ctx);
      const r = removerEvidencia(
        lerAcompanhamento(atual.acompanhamento),
        etapa,
        arquivoId,
      );
      if (!r) throw new NotFoundException();
      chave = r.removido.chave;
      return this.gravarAcompanhamento(tx, ctx, id, empresaId, r.valor);
    });
    // Depois de gravar: se o armazenamento falhar, sobra só o objeto órfão.
    await this.apagarSemFalhar(chave);
    return this.detalhe(gravado, gravado.acompanhamento);
  }

  private registro(
    arquivoId: string,
    conferido: ReturnType<typeof conferirArquivoDaEvidencia>,
    arquivo: EvidenciaEnviada,
    enviadoEm: string,
    empresaId: string,
    pesquisaId: string,
    etapa: EtapaNr1,
  ) {
    return {
      id: arquivoId,
      nome: nomeDaEvidencia(arquivo.nome, conferido.formato),
      formato: conferido.formato,
      tamanhoBytes: conferido.tamanhoBytes,
      hashSha256: conferido.hashSha256,
      chave: chaveDaEvidencia(empresaId, pesquisaId, etapa, arquivoId),
      enviadoEm,
    };
  }

  /** A etapa vem da rota: só um id conhecido vira nome de campo. */
  private recusarEtapa(
    etapa: EtapaNr1,
    motivo: "nao_se_aplica" | "limite",
  ): never {
    throw new CamposRecusadosException([
      { campo: campoDaPergunta(`etapas.${etapa}`), motivo },
    ]);
  }

  /** Etapa desconhecida na rota: 404 (nada é lido nem gravado). */
  private etapaConhecida(etapa: string): EtapaNr1 {
    if (!ETAPAS_NR1.includes(etapa as EtapaNr1)) throw new NotFoundException();
    return etapa as EtapaNr1;
  }

  /** Trava a linha da pesquisa (`FOR UPDATE`) e relê o acompanhamento. */
  private async travar(
    tx: Prisma.TransactionClient,
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<{ acompanhamento: Prisma.JsonValue | null }> {
    await tx.$queryRaw`SELECT id FROM pesquisa WHERE id = ${id}::text FOR UPDATE`;
    const linha = await tx.pesquisa.findFirst({
      where: { id, empresaId: ctx.actor.companyId ?? "", excluidaEm: null },
      select: { acompanhamento: true },
    });
    if (!linha) throw new NotFoundException();
    return linha;
  }

  private async gravarAcompanhamento(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    id: string,
    empresaId: string,
    valor: AcompanhamentoNr1,
  ) {
    const novo = await tx.pesquisa.update({
      where: { id },
      data: {
        acompanhamento: {
          ...valor,
          atualizadoEm: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await this.auditoria.registrarMutacao(
      tx,
      ctx,
      "pesquisas_pesquisa_alterada",
      "pesquisa",
      id,
      empresaId,
    );
    return novo;
  }

  private async apagarSemFalhar(chave: string): Promise<void> {
    if (!chave) return;
    await this.armazenamento.apagar(chave).catch(() => undefined);
  }
}
