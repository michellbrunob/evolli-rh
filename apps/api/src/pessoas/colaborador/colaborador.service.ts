import { ConflictException, Injectable } from "@nestjs/common";
import {
  Colaborador,
  ContatoColaborador,
  EnderecoColaborador,
  IdempotenciaAdmissao,
  MovimentacaoFuncional,
  PerfilPessoalColaborador,
  Prisma,
  SituacaoColaborador,
  SituacaoVinculo,
  StatusMovimentacao,
  TipoMovimentacao,
  TipoVinculo,
  VinculoFuncional,
} from "@prisma/client";
import {
  ConflitoDeCamposException,
  ErroDeCampo,
  RecusaDeNegocioException,
} from "../../common/erros/recusa-por-campo";
import { PrismaService } from "../../database/prisma.service";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import {
  ContadoresColaboradores,
  PessoasAuditContext,
  ResultadoPaginado,
} from "../pessoas.types";
import {
  EscopoLeituraPessoas,
  deslocamento,
  filtroVinculoEmpresa,
  intersectarLeitura,
  podeAcessarPessoas,
  podeConsultarPessoas,
  resolverEscopoLeituraPessoas,
  resolverEscopoPessoas,
} from "../escopo-pessoas.util";
import {
  assertDestinoCoerente,
  assertDestinoValidoEAtivo,
  dataUtc,
} from "../validacao-pessoas.util";
import { extrairDestino, traduzirErroPessoas } from "../pessoas-comum.util";
import {
  AdmitirColaboradorDto,
  ListarColaboradoresQueryDto,
  RetificarColaboradorDto,
} from "../dto/pessoas.dto";
import {
  DadosPessoaisColaboradorService,
  ValoresEndereco,
  ValoresPerfil,
  enderecoCompleto,
  perfilCompleto,
} from "../dados-pessoais/dados-pessoais.service";
import {
  ContatoColaboradorService,
  ValoresContatos,
} from "../contatos/contato-colaborador.service";

/**
 * Resposta da admissão (T167).
 *
 * Mantém os campos do `Colaborador` no topo — quem já lia `id`, `nome` e
 * `situacao` continua lendo —, e ACRESCENTA a confirmação do vínculo e do ato
 * de admissão criados na mesma transação. Antes, o cliente precisava de dois
 * GETs para saber que vínculo tinha nascido.
 *
 * Projeção FECHADA: cada campo é escolhido aqui, nunca a entidade inteira. Só
 * entram dados já aprovados (nome, matrícula, tipo, situação, datas
 * funcionais) e identificadores técnicos. A lotação aparece como os ids do
 * destino gravado na movimentação: a alocação só nasce na efetivação (ADR 0007,
 * ato × estado), e afirmar uma lotação vigente aqui seria falso.
 *
 * O topo também é escolhido campo a campo — e não `...colaborador` —, para que
 * uma coluna futura no `Colaborador` não passe para esta resposta sem decisão.
 */
export interface AdmissaoRegistrada extends Pick<
  Colaborador,
  "id" | "nome" | "situacao" | "criadoEm" | "atualizadoEm"
> {
  vinculo: {
    id: string;
    empresaId: string;
    matricula: string;
    tipo: TipoVinculo;
    situacao: SituacaoVinculo;
    dataAdmissao: Date;
  };
  movimentacao: {
    id: string;
    tipo: TipoMovimentacao;
    status: StatusMovimentacao;
    vigenciaInicio: Date;
    destino: {
      unidadeOrganizacionalId: string | null;
      departamentoId: string | null;
      areaId: string | null;
      equipeId: string | null;
      cargoId: string | null;
      centroCustoId: string | null;
    };
  };
  /**
   * T177 — o que o servidor gravou do Módulo 1. Perfil e contatos são
   * obrigatórios na admissão; endereço é `null` quando nenhum campo veio.
   */
  perfilPessoal: ValoresPerfil;
  endereco: ValoresEndereco | null;
  contatos: ValoresContatos;
}

/**
 * T178 — vínculo resumido na listagem: o que a porta principal de
 * Colaboradores mostra (matrícula, situação e admissão), sem tipo, lotação nem
 * nada além. Só vínculos do escopo da sessão.
 */
export interface VinculoListado {
  id: string;
  empresaId: string;
  matricula: string;
  situacao: SituacaoVinculo;
  dataAdmissao: Date;
  dataDesligamento: Date | null;
}

/**
 * T178 — item da listagem: projeção FECHADA. `situacao` é a situação **na
 * empresa ativa** para quem está escopado (tem vínculo ativo nela), e a
 * materializada (global) só para o `master_tecnico` sem empresa ativa. A
 * global, para o RH de uma empresa, mostraria "ativo" um colaborador desligado
 * ali e ativo em outra — resíduo de uma empresa na tela da outra.
 */
export interface ColaboradorListado {
  id: string;
  nome: string;
  situacao: SituacaoColaborador;
  criadoEm: Date;
  atualizadoEm: Date;
  /** Ordenados: ativo, previsto, encerrado; depois admissão mais recente. */
  vinculos: VinculoListado[];
}

export interface ListagemColaboradores extends ResultadoPaginado<ColaboradorListado> {
  contadores: ContadoresColaboradores;
}

/**
 * O `contains` do Prisma vira `LIKE '%termo%'` sem escapar os curingas: uma
 * busca por "%" ou "_" casaria com todo mundo. Escapados, valem literalmente.
 */
export function escaparCuringas(termo: string): string {
  return termo.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const ORDEM_SITUACAO_VINCULO: Record<SituacaoVinculo, number> = {
  ativo: 0,
  previsto: 1,
  encerrado: 2,
};

/** Vínculo principal primeiro: o ativo, depois o previsto, depois o mais novo. */
export function ordenarVinculosListados(
  vinculos: readonly VinculoListado[],
): VinculoListado[] {
  return [...vinculos].sort(
    (a, b) =>
      ORDEM_SITUACAO_VINCULO[a.situacao] - ORDEM_SITUACAO_VINCULO[b.situacao] ||
      b.dataAdmissao.getTime() - a.dataAdmissao.getTime() ||
      a.matricula.localeCompare(b.matricula),
  );
}

/**
 * T179 — campos da admissão já usados na empresa ativa: matrícula e e-mail
 * pessoal (único na mesma empresa, decisão da proprietária de 2026-10-21).
 * Só a empresa ativa é consultada: "em uso" nunca revela alguém de outra.
 */
export async function conflitosDaAdmissao(
  tx: Prisma.TransactionClient,
  empresaId: string,
  dto: Pick<AdmitirColaboradorDto, "matricula" | "contatos">,
): Promise<ErroDeCampo[]> {
  const matricula = await tx.vinculoFuncional.findFirst({
    where: { empresaId, matricula: dto.matricula },
    select: { id: true },
  });
  const email = await tx.contatoColaborador.findFirst({
    where: { empresaId, emailPessoal: dto.contatos.emailPessoal },
    select: { id: true },
  });
  const erros: ErroDeCampo[] = [];
  if (matricula) erros.push({ campo: "matricula", motivo: "em_uso" });
  if (email) erros.push({ campo: "contatos.emailPessoal", motivo: "em_uso" });
  return erros;
}

/**
 * T179 — qual campo da admissão uma unicidade do banco protegeu. Só a
 * matrícula na empresa e o e-mail pessoal na empresa têm campo público; a
 * unicidade da chave de idempotência e as demais voltam `null`.
 */
export function camposDaUnicidadeViolada(erro: unknown): ErroDeCampo[] | null {
  if (
    !(erro instanceof Prisma.PrismaClientKnownRequestError) ||
    erro.code !== "P2002"
  ) {
    return null;
  }
  const alvo = erro.meta?.["target"];
  const texto = Array.isArray(alvo) ? alvo.join(",") : String(alvo ?? "");
  if (/chave/.test(texto)) return null;
  if (/matricula/.test(texto)) {
    return [{ campo: "matricula", motivo: "em_uso" }];
  }
  if (/email_pessoal|emailPessoal/.test(texto)) {
    return [{ campo: "contatos.emailPessoal", motivo: "em_uso" }];
  }
  return null;
}

/** O que o reenvio idempotente compara com a admissão gravada. */
export interface AdmissaoGravada {
  colaborador: Pick<Colaborador, "nome">;
  vinculo: Pick<
    VinculoFuncional,
    "empresaId" | "matricula" | "tipo" | "dataAdmissao"
  >;
  movimentacao: Pick<
    MovimentacaoFuncional,
    | "motivoCodigo"
    | "destinoUnidadeOrganizacionalId"
    | "destinoDepartamentoId"
    | "destinoAreaId"
    | "destinoEquipeId"
    | "destinoCargoId"
    | "destinoCentroCustoId"
  >;
  perfil: Omit<
    PerfilPessoalColaborador,
    | "id"
    | "empresaId"
    | "colaboradorId"
    | "criadoPorUserId"
    | "atualizadoPorUserId"
    | "criadoEm"
    | "atualizadoEm"
  > | null;
  endereco: Omit<
    EnderecoColaborador,
    | "id"
    | "empresaId"
    | "colaboradorId"
    | "criadoPorUserId"
    | "atualizadoPorUserId"
    | "criadoEm"
    | "atualizadoEm"
  > | null;
  contato: Pick<
    ContatoColaborador,
    "emailPessoal" | "celular" | "telefone"
  > | null;
}

/**
 * T179 — o reenvio traz o MESMO conteúdo da admissão gravada? Compara cada
 * campo já normalizado (o DTO passa pelos mesmos `@Transform` da gravação).
 * Uma admissão editada depois (nome retificado, contato alterado) deixa de
 * conferir — e o reenvio é recusado, em vez de devolver um estado que não é
 * mais o do envio.
 */
export function admissaoConfere(
  dto: AdmitirColaboradorDto,
  gravada: AdmissaoGravada,
): boolean {
  const { colaborador, vinculo, movimentacao, perfil, endereco, contato } =
    gravada;
  const destino = extrairDestino(dto);
  const iguais = (a: unknown, b: unknown) => a === b;

  if (
    !iguais(colaborador.nome, dto.nome) ||
    !iguais(vinculo.empresaId, dto.empresaId) ||
    !iguais(vinculo.matricula, dto.matricula) ||
    !iguais(vinculo.tipo, dto.tipo) ||
    vinculo.dataAdmissao.getTime() !==
      dataUtc(new Date(dto.dataAdmissao)).getTime() ||
    !iguais(movimentacao.motivoCodigo, dto.motivoCodigo) ||
    !iguais(
      movimentacao.destinoUnidadeOrganizacionalId,
      destino.unidadeOrganizacionalId,
    ) ||
    !iguais(movimentacao.destinoDepartamentoId, destino.departamentoId) ||
    !iguais(movimentacao.destinoAreaId, destino.areaId) ||
    !iguais(movimentacao.destinoEquipeId, destino.equipeId) ||
    !iguais(movimentacao.destinoCargoId, destino.cargoId) ||
    !iguais(movimentacao.destinoCentroCustoId, destino.centroCustoId)
  ) {
    return false;
  }

  if (!perfil) return false;
  const perfilEnviado = perfilCompleto(dto.perfilPessoal);
  if (
    perfil.dataNascimento.toISOString().slice(0, 10) !==
    perfilEnviado.dataNascimento
  ) {
    return false;
  }
  for (const chave of CHAVES_PERFIL_SEM_DATA) {
    if (!iguais(perfil[chave], perfilEnviado[chave])) return false;
  }

  const enderecoEnviado = dto.endereco ? enderecoCompleto(dto.endereco) : null;
  const enderecoTemValor =
    enderecoEnviado !== null &&
    Object.values(enderecoEnviado).some((v) => v !== null);
  if (!enderecoTemValor) {
    if (endereco !== null) return false;
  } else {
    if (!endereco) return false;
    for (const chave of CHAVES_ENDERECO) {
      if (!iguais(endereco[chave], enderecoEnviado![chave])) return false;
    }
  }

  return (
    contato !== null &&
    iguais(contato.emailPessoal, dto.contatos.emailPessoal) &&
    iguais(contato.celular, dto.contatos.celular) &&
    iguais(contato.telefone, dto.contatos.telefone)
  );
}

const CHAVES_PERFIL_SEM_DATA = [
  "sexo",
  "saudacao",
  "estadoCivil",
  "nacionalidade",
  "naturalidade",
  "escolaridade",
  "curso",
  "nomePai",
  "nomeMae",
] as const;

const CHAVES_ENDERECO = [
  "pais",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
] as const;

/**
 * Colaborador — a pessoa. Carrega **apenas** os dados aprovados na Baseline V1
 * (item 1): `nome` e `situacao` derivada. Nenhum documento, contato, endereço,
 * data de nascimento, nome social ou dado sensível existe nesta entidade.
 *
 * Não tem `empresa_id`: a empresa é propriedade do **vínculo** (item 2). Por
 * isso o escopo de leitura atravessa a relação — um colaborador é visível a
 * quem tem escopo em alguma empresa onde ele tenha vínculo.
 */
@Injectable()
export class ColaboradorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    // T177 — Módulo 1 do cadastro, gravado na transação da admissão.
    private readonly dadosPessoais: DadosPessoaisColaboradorService,
    private readonly contatos: ContatoColaboradorService,
  ) {}

  /**
   * Admissão: cria colaborador, primeiro vínculo (`previsto`) e a movimentação
   * de `admissao` — **na mesma transação**.
   *
   * Os três nascem juntos por necessidade de autorização, não por conveniência:
   * um colaborador sem vínculo não teria empresa, ficaria fora de todo escopo e
   * seria invisível até para quem o criou.
   *
   * O vínculo nasce `previsto`, nunca `ativo`: ativar exige efetivar a
   * movimentação, que é ato explícito e auditado (spec §8).
   */
  async admitir(
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<AdmissaoRegistrada> {
    return (await this.admitirIdempotente(dto, ctx, undefined)).admissao;
  }

  /**
   * T179 — admissão com idempotência do envio (decisão da proprietária de
   * 2026-10-21).
   *
   * Com `chave`, a mesma chave do MESMO ator na MESMA empresa nunca cria duas
   * admissões: o reenvio devolve a admissão já gravada (`reenvio: true`); a
   * mesma chave com conteúdo diferente é recusada (422,
   * `idempotencia_conteudo_divergente`). Envios simultâneos com a mesma chave
   * se resolvem no banco: o segundo esbarra numa unicidade, e o `catch`
   * encontra o registro do primeiro e responde como reenvio.
   *
   * Duplicidade de dado (matrícula, e-mail pessoal na empresa) responde 409
   * com o campo e sem o valor (`ConflitoDeCamposException`).
   */
  async admitirIdempotente(
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
    chave: string | undefined,
  ): Promise<{ admissao: AdmissaoRegistrada; reenvio: boolean }> {
    const escopo = resolverEscopoPessoas(ctx.actor);

    if (dto.empresaId !== escopo.empresaId) {
      // Empresa fora do escopo: 404 público, `denied` na trilha. Nunca 403 —
      // confirmaria a existência da empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        dto.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(ctx.actor, "colaborador", "create", escopo.empresaId)
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        null,
        escopo.empresaId,
      );
    }
    // T177 — cada bloco do Módulo 1 tem a sua própria permissão, reavaliada
    // com a empresa ativa. Hoje `rh` e `dp` têm as duas; a verificação existe
    // para que o dia em que as matrizes divergirem não abra um atalho pela
    // admissão.
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "dados_pessoais_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "dados_pessoais_colaborador",
        null,
        escopo.empresaId,
      );
    }
    if (
      !podeAcessarPessoas(
        ctx.actor,
        "contato_colaborador",
        "alter",
        escopo.empresaId,
      )
    ) {
      return this.auditoria.negarAcesso(
        ctx,
        "contato_colaborador",
        null,
        escopo.empresaId,
      );
    }

    const destino = extrairDestino(dto);
    assertDestinoCoerente("admissao", destino);

    const dataAdmissao = dataUtc(new Date(dto.dataAdmissao));
    const status: StatusMovimentacao =
      dataAdmissao > dataUtc(new Date()) ? "programada" : "solicitada";

    // Reenvio de uma chave já registrada: nada é gravado de novo.
    const registroAnterior = await this.registroDaChave(
      ctx.actor.id,
      escopo.empresaId,
      chave,
    );
    if (registroAnterior) {
      return this.reenviarAdmissao(registroAnterior, dto, ctx);
    }

    try {
      const admissao = await this.prisma.$transaction(async (tx) => {
        await assertDestinoValidoEAtivo(tx, escopo.empresaId, destino);

        // T179 — duplicidade de dado, toda de uma vez e só na empresa ativa.
        // A restrição do banco é a garantia (corrida chega como P2002, abaixo);
        // esta consulta só existe para dizer QUAIS campos conflitam.
        const conflitos = await conflitosDaAdmissao(tx, escopo.empresaId, dto);
        if (conflitos.length > 0) {
          throw new ConflitoDeCamposException(conflitos);
        }

        const colaborador = await tx.colaborador.create({
          data: { nome: dto.nome, situacao: SituacaoColaborador.inativo },
        });

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
          "pessoas_colaborador_criado",
          "colaborador",
          colaborador.id,
          escopo.empresaId,
        );
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

        // T177 — Módulo 1: perfil, endereço e contatos iniciais, na MESMA
        // transação. Qualquer falha desfaz a admissão inteira: não existe
        // colaborador sem os dados enviados, nem dado sem colaborador.
        const alvoModulo1 = {
          colaboradorId: colaborador.id,
          empresaId: escopo.empresaId,
        };
        const modulo1 = await this.dadosPessoais.gravarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          { perfilPessoal: dto.perfilPessoal, endereco: dto.endereco },
        );
        const contatosGravados = await this.contatos.criarNaAdmissao(
          tx,
          ctx,
          alvoModulo1,
          dto.contatos,
        );

        // T179 — registro de idempotência na MESMA transação: existe se, e só
        // se, a admissão existe. Só chave, ator, empresa e ids — nenhum dado
        // pessoal.
        if (chave !== undefined) {
          await tx.idempotenciaAdmissao.create({
            data: {
              chave,
              atorUserId: ctx.actor.id,
              empresaId: escopo.empresaId,
              colaboradorId: colaborador.id,
              vinculoId: vinculo.id,
              movimentacaoId: movimentacao.id,
            },
          });
        }

        return {
          id: colaborador.id,
          nome: colaborador.nome,
          situacao: colaborador.situacao,
          criadoEm: colaborador.criadoEm,
          atualizadoEm: colaborador.atualizadoEm,
          vinculo: {
            id: vinculo.id,
            empresaId: vinculo.empresaId,
            matricula: vinculo.matricula,
            tipo: vinculo.tipo,
            situacao: vinculo.situacao,
            dataAdmissao: vinculo.dataAdmissao,
          },
          movimentacao: {
            id: movimentacao.id,
            tipo: movimentacao.tipo,
            status: movimentacao.status,
            vigenciaInicio: movimentacao.vigenciaInicio,
            destino: {
              unidadeOrganizacionalId:
                movimentacao.destinoUnidadeOrganizacionalId,
              departamentoId: movimentacao.destinoDepartamentoId,
              areaId: movimentacao.destinoAreaId,
              equipeId: movimentacao.destinoEquipeId,
              cargoId: movimentacao.destinoCargoId,
              centroCustoId: movimentacao.destinoCentroCustoId,
            },
          },
          perfilPessoal: modulo1.perfilPessoal,
          endereco: modulo1.endereco,
          contatos: contatosGravados,
        };
      });
      return { admissao, reenvio: false };
    } catch (error) {
      const conflito =
        error instanceof ConflitoDeCamposException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002");
      if (conflito) {
        // Envio simultâneo com a mesma chave: o outro já gravou. A unicidade
        // que barrou este (matrícula, e-mail ou a própria chave) é a do
        // registro dele — é reenvio, não conflito.
        const registro = await this.registroDaChave(
          ctx.actor.id,
          escopo.empresaId,
          chave,
        );
        if (registro) {
          return this.reenviarAdmissao(registro, dto, ctx);
        }
      }
      if (error instanceof ConflitoDeCamposException) {
        throw error;
      }
      const campos = camposDaUnicidadeViolada(error);
      if (campos) {
        throw new ConflitoDeCamposException(campos);
      }
      traduzirErroPessoas(error);
    }
  }

  /** O registro de idempotência desta chave, deste ator, nesta empresa. */
  private async registroDaChave(
    atorUserId: string,
    empresaId: string,
    chave: string | undefined,
  ): Promise<IdempotenciaAdmissao | null> {
    if (chave === undefined) return null;
    return this.prisma.idempotenciaAdmissao.findUnique({
      where: {
        atorUserId_empresaId_chave: { atorUserId, empresaId, chave },
      },
    });
  }

  /**
   * T179 — reenvio de uma chave já registrada.
   *
   * O conteúdo do reenvio é comparado com a PRÓPRIA admissão gravada — por
   * isso o registro de idempotência não precisa guardar nem um resumo dele.
   * A comparação lê no servidor e nada devolve; só quando confere a resposta
   * é montada, pelas consultas de dados pessoais e de contatos, que deixam a
   * trilha de leitura de sempre.
   */
  private async reenviarAdmissao(
    registro: IdempotenciaAdmissao,
    dto: AdmitirColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<{ admissao: AdmissaoRegistrada; reenvio: boolean }> {
    const gravada = await this.prisma.$transaction(async (tx) => {
      const [colaborador, vinculo, movimentacao, perfil, endereco, contato] =
        await Promise.all([
          tx.colaborador.findUniqueOrThrow({
            where: { id: registro.colaboradorId },
          }),
          tx.vinculoFuncional.findUniqueOrThrow({
            where: { id: registro.vinculoId },
          }),
          tx.movimentacaoFuncional.findUniqueOrThrow({
            where: { id: registro.movimentacaoId },
          }),
          tx.perfilPessoalColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
          tx.enderecoColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
          tx.contatoColaborador.findUnique({
            where: {
              colaboradorId_empresaId: {
                colaboradorId: registro.colaboradorId,
                empresaId: registro.empresaId,
              },
            },
          }),
        ]);
      return { colaborador, vinculo, movimentacao, perfil, endereco, contato };
    });

    if (!admissaoConfere(dto, gravada)) {
      throw new RecusaDeNegocioException("idempotencia_conteudo_divergente");
    }

    const dados = await this.dadosPessoais.consultar(
      registro.colaboradorId,
      ctx,
    );
    const contatos = await this.contatos.consultar(registro.colaboradorId, ctx);
    if (!dados.perfilPessoal || !contatos.contatos) {
      // A admissão confere, mas o uso operacional foi bloqueado depois dela
      // (desligamento): não há o que devolver como admissão registrada.
      throw new ConflictException();
    }

    const { colaborador, vinculo, movimentacao } = gravada;
    return {
      reenvio: true,
      admissao: {
        id: colaborador.id,
        nome: colaborador.nome,
        situacao: colaborador.situacao,
        criadoEm: colaborador.criadoEm,
        atualizadoEm: colaborador.atualizadoEm,
        vinculo: {
          id: vinculo.id,
          empresaId: vinculo.empresaId,
          matricula: vinculo.matricula,
          tipo: vinculo.tipo,
          situacao: vinculo.situacao,
          dataAdmissao: vinculo.dataAdmissao,
        },
        movimentacao: {
          id: movimentacao.id,
          tipo: movimentacao.tipo,
          status: movimentacao.status,
          vigenciaInicio: movimentacao.vigenciaInicio,
          destino: {
            unidadeOrganizacionalId:
              movimentacao.destinoUnidadeOrganizacionalId,
            departamentoId: movimentacao.destinoDepartamentoId,
            areaId: movimentacao.destinoAreaId,
            equipeId: movimentacao.destinoEquipeId,
            cargoId: movimentacao.destinoCargoId,
            centroCustoId: movimentacao.destinoCentroCustoId,
          },
        },
        perfilPessoal: dados.perfilPessoal,
        endereco: dados.endereco,
        contatos: contatos.contatos,
      },
    };
  }

  /**
   * Listagem da porta principal de Colaboradores (T164; T178).
   *
   * - **Escopo estrutural:** para `rh`/`dp` (e `master_tecnico` com empresa
   *   ativa), só colaborador com vínculo na empresa da sessão; para o
   *   `master_tecnico` sem empresa ativa, toda a base, auditada.
   * - **Situação na empresa:** escopado, "ativo" é ter vínculo ativo NA
   *   empresa ativa — no filtro, na coluna e nos contadores. Global, vale a
   *   situação materializada.
   * - **Busca** (T178): nome contém, sem diferenciar maiúsculas; ou matrícula
   *   contém, só em vínculos do escopo.
   * - **Contadores** (T178): o escopo inteiro, sem filtros nem busca.
   */
  async listar(
    query: ListarColaboradoresQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ListagemColaboradores> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    const filtro = intersectarLeitura(escopo, query.empresaId);

    if (filtro === null) {
      // Pedido de outra empresa devolve página vazia, nunca erro.
      return {
        itens: [],
        pagina: query.pagina,
        tamanhoPagina: query.tamanhoPagina,
        total: 0,
        contadores: { ativos: 0, inativos: 0 },
      };
    }

    const empresaId = filtro.empresaId;
    const noEscopo: Prisma.VinculoFuncionalWhereInput =
      empresaId !== undefined ? { empresaId } : {};

    // Escopo: colaborador com vínculo na empresa (escopado) ou qualquer um
    // (global). É a base de tudo — lista, total e contadores.
    const base: Prisma.ColaboradorWhereInput =
      empresaId !== undefined ? { vinculos: { some: { empresaId } } } : {};

    const ativoNoEscopo: Prisma.ColaboradorWhereInput =
      empresaId !== undefined
        ? { vinculos: { some: { empresaId, situacao: "ativo" } } }
        : { situacao: "ativo" };
    const inativoNoEscopo: Prisma.ColaboradorWhereInput =
      empresaId !== undefined
        ? { vinculos: { none: { empresaId, situacao: "ativo" } } }
        : { situacao: "inativo" };

    const filtros: Prisma.ColaboradorWhereInput[] = [base];
    if (query.situacaoVinculo) {
      filtros.push({
        vinculos: { some: { ...noEscopo, situacao: query.situacaoVinculo } },
      });
    }
    if (query.situacao) {
      filtros.push(
        query.situacao === "ativo" ? ativoNoEscopo : inativoNoEscopo,
      );
    }
    if (query.busca) {
      const termo = escaparCuringas(query.busca);
      filtros.push({
        OR: [
          { nome: { contains: termo, mode: "insensitive" } },
          {
            vinculos: {
              some: {
                ...noEscopo,
                matricula: { contains: termo, mode: "insensitive" },
              },
            },
          },
        ],
      });
    }
    const where: Prisma.ColaboradorWhereInput = { AND: filtros };

    const [linhas, total, ativos, totalNoEscopo] = await Promise.all([
      this.prisma.colaborador.findMany({
        where,
        // Ordenação fixa no servidor — nunca vinda do cliente.
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        skip: deslocamento(query.pagina, query.tamanhoPagina),
        take: query.tamanhoPagina,
        select: {
          id: true,
          nome: true,
          situacao: true,
          criadoEm: true,
          atualizadoEm: true,
          vinculos: {
            where: noEscopo,
            select: {
              id: true,
              empresaId: true,
              matricula: true,
              situacao: true,
              dataAdmissao: true,
              dataDesligamento: true,
            },
          },
        },
      }),
      this.prisma.colaborador.count({ where }),
      this.prisma.colaborador.count({ where: { AND: [base, ativoNoEscopo] } }),
      this.prisma.colaborador.count({ where: base }),
    ]);

    if (escopo.global) {
      // Consulta ampla do Master: auditada (fail-safe), sem dado pessoal.
      await this.auditoria.registrarConsultaGlobal(ctx, "colaborador", null);
    }

    const itens: ColaboradorListado[] = linhas.map((c) => ({
      id: c.id,
      nome: c.nome,
      situacao:
        empresaId !== undefined
          ? c.vinculos.some((v) => v.situacao === "ativo")
            ? "ativo"
            : "inativo"
          : c.situacao,
      criadoEm: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
      vinculos: ordenarVinculosListados(c.vinculos),
    }));

    return {
      itens,
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
      contadores: { ativos, inativos: totalNoEscopo - ativos },
    };
  }

  async detalhar(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoLeituraPessoas(ctx.actor);
    return this.carregarNoEscopo(colaboradorId, ctx, escopo, "read");
  }

  /**
   * Retificação de cadastro — **só o nome** (spec §4.10 aplicado ao cadastro).
   *
   * A trilha registra *que* houve retificação, nunca o valor anterior nem o
   * novo (ADR 0004 §5): o valor seria dado pessoal, e a trilha não é
   * repositório de dado pessoal.
   */
  async retificar(
    colaboradorId: string,
    dto: RetificarColaboradorDto,
    ctx: PessoasAuditContext,
  ): Promise<Colaborador> {
    const escopo = resolverEscopoPessoas(ctx.actor);
    const colaborador = await this.carregarNoEscopo(
      colaboradorId,
      ctx,
      // Mutação é sempre escopada (master_tecnico nunca chega aqui): reusa o
      // carregador de leitura na forma escopada.
      { global: false, empresaId: escopo.empresaId },
      "alter",
    );

    return this.prisma.$transaction(async (tx) => {
      const atualizado = await tx.colaborador.update({
        where: { id: colaborador.id },
        data: { nome: dto.nome },
      });

      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_colaborador_atualizado",
        "colaborador",
        atualizado.id,
        escopo.empresaId,
      );

      return atualizado;
    });
  }

  private async carregarNoEscopo(
    colaboradorId: string,
    ctx: PessoasAuditContext,
    escopo: EscopoLeituraPessoas,
    action: "read" | "alter" | "manage",
  ): Promise<Colaborador> {
    const colaborador = await this.prisma.colaborador.findFirst({
      where: {
        id: colaboradorId,
        // Escopado: só se tiver vínculo na empresa do ator. Global (Master):
        // sem filtro de empresa.
        ...filtroVinculoEmpresa(escopo),
      },
    });

    if (!colaborador) {
      // Inexistente e fora do escopo respondem igual (404) — a distinção
      // vazaria a existência de uma pessoa em outra empresa.
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaboradorId,
        null,
      );
    }

    if (!podeConsultarPessoas(ctx.actor, "colaborador", action, escopo)) {
      return this.auditoria.negarAcesso(
        ctx,
        "colaborador",
        colaborador.id,
        escopo.global ? null : escopo.empresaId,
      );
    }

    if (escopo.global && action === "read") {
      // Leitura global do Master: auditada (fail-safe), só id técnico.
      await this.auditoria.registrarConsultaGlobal(
        ctx,
        "colaborador",
        colaborador.id,
      );
    }

    return colaborador;
  }
}
