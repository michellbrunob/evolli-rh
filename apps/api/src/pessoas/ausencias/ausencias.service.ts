import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  Prisma,
  StatusAusencia,
  TipoAusencia,
  TipoVinculo,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  ConflitoDeCamposException,
  ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import { escaparCuringas } from "../../common/busca.util";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PoliticasFeriasService } from "./politicas-ferias.service";
import type { ViolacaoDaPolitica } from "./politica-ferias";
import { PessoasAuditContext } from "../pessoas.types";
import { escolherVinculoPrincipal } from "../colaborador/vinculo-principal";
import {
  type AusenciaDoSaldo,
  type AvisoClt,
  type Dia,
  type PeriodoAquisitivo,
  STATUS_QUE_OCUPAM,
  avisosDaClt,
  dataDoDia,
  diaDaVolta,
  diaDe,
  diasCorridos,
  diasProporcionais,
  diasUteis,
  direitoDoTipo,
  indiceDoPeriodoAtual,
  hojeEmSaoPaulo,
  periodoParaFerias,
  vendaveisRestantes,
  periodosAquisitivos,
  prazoDoAbono,
  type RegraDeFerias,
  type ReinicioDoSaldo,
  regraDeFeriasDoTipo,
  seSobrepoem,
  somarDias,
  somarMeses,
} from "./calculo-ausencias";
import {
  AlterarAusenciaDto,
  GrupoDeTipo,
  ListarAusenciasQueryDto,
  PeriodoDaLista,
  RegistrarAusenciaDto,
  RegistrarReinicioDto,
  SimularAusenciaQueryDto,
  SugerirAusenciaDto,
  SimularReinicioQueryDto,
} from "./ausencias.dto";

/** A ausência como a tela a recebe. */
export interface AusenciaApi {
  id: string;
  colaborador: {
    id: string;
    nome: string;
    cargo: string | null;
    foto: { versao: number } | null;
  };
  tipo: TipoAusencia;
  motivoAfastamento: string | null;
  inicio: Dia;
  fim: Dia | null;
  dias: number | null;
  diasUteis: number | null;
  diasVendidos: number;
  periodoAquisitivo: { inicio: Dia; fim: Dia } | null;
  /** T215 — "Sugerir outras datas": o período proposto, se houver. */
  sugestao: { inicio: Dia; fim: Dia } | null;
  status: StatusAusencia;
  observacao: string | null;
  registradoEm: string;
  decididoEm: string | null;
  /** T215 — o atestado ou documento anexado (vivo), sem nome nem chave. */
  anexo: { formato: string; tamanhoBytes: number; enviadoEm: string } | null;
  /** T215 — férias coletivas (art. 140), que abrem um novo período. */
  feriasColetivas: boolean;
  /** T215 — registrada fora da política de férias: o porquê. */
  motivoForaDaPolitica: string | null;
}

export interface IndicadoresDeAusencias {
  emFeriasAgora: number;
  licencasEAfastamentos: number;
  faltasEsteMes: number;
  proximasFerias: number;
  pendentes: number;
  /** T215 — pessoas fora hoje, com a ausência aprovada (número da aba). */
  ausentesHoje: number;
}

export interface ListagemDeAusencias {
  itens: AusenciaApi[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
  indicadores: IndicadoresDeAusencias;
}

export interface SimulacaoDeAusencia {
  dias: number | null;
  diasUteis: number | null;
  volta: Dia | null;
  periodo: { inicio: Dia; fim: Dia } | null;
  saldoAntes: number | null;
  saldoDepois: number | null;
  /** O que ainda dá para vender no período (o limite menos o já vendido). */
  maxVendaveis: number | null;
  /** T215 — dias já vendidos por outras férias do mesmo período. */
  vendidosNoPeriodo: number | null;
  prazoAbono: Dia | null;
  /** T215 — a regra de férias do vínculo da pessoa. */
  regraDeFerias: RegraDeFerias;
  /** T215 — "Regras da CLT" (só aviso), nas férias com saldo calculado. */
  avisosClt: AvisoClt[];
  /** T215 — os períodos com saldo de que as férias podem descontar ("trocar"). */
  periodosDisponiveis: { inicio: Dia; fim: Dia; disponiveis: number }[];
  /** T215 — menos de 12 meses de casa no início: cabe "férias coletivas". */
  podeSerColetiva: boolean;
  /** T215 — simulada como coletiva: os dias proporcionais e o novo período. */
  coletiva: { dias: number; novoPeriodo: Dia } | null;
  /** T215 — a política de férias da pessoa e o que o pedido não segue. */
  politica: {
    id: string;
    nome: string;
    violacoes: ViolacaoDaPolitica[];
  } | null;
}

export interface FeriasDoColaborador {
  /** T215 — calculada (CLT, Estágio), sem_ferias (PJ, Freelancer), sem_regra. */
  regraDeFerias: RegraDeFerias;
  vinculo: { tipo: TipoVinculo; dataAdmissao: Dia };
  /** Só na regra calculada; nas demais, vazio. */
  periodos: PeriodoAquisitivo[];
  periodoAtual: number | null;
  proximaAusencia: AusenciaApi | null;
  historico: AusenciaApi[];
  /** T215 — reinícios da contagem ("Ajustar período"), do mais antigo. */
  reinicios: ReinicioApi[];
}

/** T215 — um reinício da contagem do período aquisitivo. */
export interface ReinicioApi {
  id: string;
  inicio: Dia;
  motivo: ReinicioDoSaldo["motivo"];
  diasPeriodoAnterior: number | null;
  observacao: string | null;
}

/** T215 — "Períodos hoje" / "Como os períodos vão ficar". */
export interface SimulacaoDeReinicio {
  periodos: PeriodoAquisitivo[];
  diasCalculados: number | null;
}

function reinicioParaApi(l: {
  id: string;
  inicio: Date;
  motivo: ReinicioDoSaldo["motivo"];
  diasPeriodoAnterior: number | null;
  observacao: string | null;
}): ReinicioApi {
  return {
    id: l.id,
    inicio: diaDe(l.inicio),
    motivo: l.motivo,
    diasPeriodoAnterior: l.diasPeriodoAnterior,
    observacao: l.observacao,
  };
}

export type DecisaoDeAusencia = "aprovar" | "recusar" | "cancelar";

const TIPOS_DO_GRUPO: Readonly<Record<GrupoDeTipo, TipoAusencia[]>> = {
  ferias: ["ferias"],
  licencas: ["licenca_medica", "licenca_maternidade", "licenca_paternidade"],
  afastamentos: ["afastamento"],
  faltas: ["falta_justificada", "falta_sem_justificativa"],
  day_off: ["day_off"],
  home_office: ["home_office"],
};

/** Pendentes de decisão (o RH aprova ou recusa). */
const PENDENTES: readonly StatusAusencia[] = [
  "aguardando_gestor",
  "aguardando_rh",
  "ajuste_sugerido",
];

const INCLUSAO = {
  colaborador: { select: { id: true, nome: true } },
  vinculo: {
    select: {
      alocacoes: {
        where: { vigenteAte: null },
        select: { cargo: { select: { nome: true } } },
        take: 1,
      },
    },
  },
  anexos: {
    where: { removidoEm: null },
    select: { formato: true, tamanhoBytes: true, criadoEm: true },
    take: 1,
  },
} as const satisfies Prisma.AusenciaInclude;

type LinhaDeAusencia = Prisma.AusenciaGetPayload<{ include: typeof INCLUSAO }>;

const VINCULO_DO_SALDO = {
  id: true,
  tipo: true,
  situacao: true,
  dataAdmissao: true,
  dataDesligamento: true,
  matricula: true,
} as const satisfies Prisma.VinculoFuncionalSelect;

type VinculoDoSaldo = Prisma.VinculoFuncionalGetPayload<{
  select: typeof VINCULO_DO_SALDO;
}>;

/** T215 — menos de 12 meses de casa no dia: cabe "férias coletivas" (art. 140). */
function podeSerColetiva(vinculo: { dataAdmissao: Date }, dia: Dia): boolean {
  return somarMeses(diaDe(vinculo.dataAdmissao), 12) > dia;
}

/** T215 — o reinício que as férias coletivas trazem (no início delas). */
function reinicioDaColetiva(inicio: Dia): ReinicioDoSaldo {
  return { inicio, motivo: "ferias_coletivas", dias: null };
}

function fimDoPeriodo(inicio: Dia): Dia {
  return somarDias(somarMeses(inicio, 12), -1);
}

function paraSaldo(linha: {
  tipo: TipoAusencia;
  status: StatusAusencia;
  inicio: Date;
  fim: Date | null;
  diasVendidos: number;
  periodoAquisitivoInicio: Date | null;
}): AusenciaDoSaldo {
  return {
    tipo: linha.tipo,
    status: linha.status,
    inicio: diaDe(linha.inicio),
    fim: linha.fim ? diaDe(linha.fim) : null,
    diasVendidos: linha.diasVendidos,
    periodoAquisitivoInicio: linha.periodoAquisitivoInicio
      ? diaDe(linha.periodoAquisitivoInicio)
      : null,
  };
}

/**
 * T215 — Férias e ausências do colaborador NA EMPRESA ATIVA: lista com
 * indicadores, registro, decisões (aprovar, recusar, cancelar), simulação do
 * registro e o saldo de férias da ficha.
 *
 * - **Escopo:** a empresa vem SEMPRE da sessão. `rh` e `dp` leem e escrevem;
 *   o `master_tecnico` só lê, e só com empresa ativa (o guard já decide a
 *   capacidade; aqui é defesa em profundidade). Colaborador ou ausência de
 *   outra empresa é 404 auditado, igual ao inexistente.
 * - **Nada se apaga:** cancelar e recusar mudam o status.
 * - **Trilha:** registro e cada decisão, só com o id da ausência e a empresa.
 */
@Injectable()
export class AusenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
    private readonly politicas: PoliticasFeriasService,
  ) {}

  // ---- lista ---------------------------------------------------------------

  async listar(
    query: ListarAusenciasQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ListagemDeAusencias> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const hoje = hojeEmSaoPaulo();
    const where: Prisma.AusenciaWhereInput = { empresaId, excluidaEm: null };
    const e: Prisma.AusenciaWhereInput[] = [];
    if (query.busca) {
      e.push({
        colaborador: {
          nome: { contains: escaparCuringas(query.busca), mode: "insensitive" },
        },
      });
    }
    if (query.tipo) e.push({ tipo: { in: TIPOS_DO_GRUPO[query.tipo] } });
    if (query.status) {
      e.push({
        status:
          query.status === "aguardando_voce" ? "aguardando_rh" : query.status,
      });
    }
    if (query.periodo) e.push(filtroDoPeriodo(query.periodo, hoje));
    if (e.length > 0) where.AND = e;

    const [total, linhas, indicadores] = await Promise.all([
      this.prisma.ausencia.count({ where }),
      this.prisma.ausencia.findMany({
        where,
        include: INCLUSAO,
        orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
        skip: (query.pagina - 1) * query.tamanhoPagina,
        take: query.tamanhoPagina,
      }),
      this.indicadores(empresaId, hoje),
    ]);
    const fotos = await this.fotos(
      empresaId,
      linhas.map((l) => l.colaboradorId),
    );
    return {
      itens: linhas.map((l) => paraApi(l, fotos, veAnexo(ctx))),
      pagina: query.pagina,
      tamanhoPagina: query.tamanhoPagina,
      total,
      indicadores,
    };
  }

  private async indicadores(
    empresaId: string,
    hoje: Dia,
  ): Promise<IndicadoresDeAusencias> {
    const conta = (filtro: Prisma.AusenciaWhereInput) =>
      this.prisma.ausencia.count({
        where: { empresaId, excluidaEm: null, ...filtro },
      });
    const [
      emFeriasAgora,
      licencasEAfastamentos,
      faltasEsteMes,
      proximasFerias,
      pendentes,
      ausentes,
    ] = await Promise.all([
      conta(filtroDoPeriodo("em_ferias_agora", hoje)),
      conta(filtroDoPeriodo("licencas_afastamentos", hoje)),
      conta(filtroDoPeriodo("faltas_mes", hoje)),
      conta(filtroDoPeriodo("proximas_ferias", hoje)),
      conta({ status: "aguardando_rh" }),
      this.prisma.ausencia.findMany({
        where: {
          empresaId,
          excluidaEm: null,
          status: { in: ["aprovada", "cancelamento_pedido"] },
          inicio: { lte: dataDoDia(hoje) },
          OR: [{ fim: null }, { fim: { gte: dataDoDia(hoje) } }],
        },
        select: { colaboradorId: true },
        distinct: ["colaboradorId"],
      }),
    ]);
    return {
      emFeriasAgora,
      licencasEAfastamentos,
      faltasEsteMes,
      proximasFerias,
      pendentes,
      ausentesHoje: ausentes.length,
    };
  }

  // ---- registro ------------------------------------------------------------

  async registrar(
    dto: RegistrarAusenciaDto,
    ctx: PessoasAuditContext,
  ): Promise<AusenciaApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const principal = await this.vinculoPrincipal(
      dto.colaboradorId,
      empresaId,
      ctx,
    );
    const erros = validarForma(dto);
    if (principal.situacao !== "ativo") {
      erros.push({ campo: "colaboradorId", motivo: "indisponivel" });
    } else if (erros.length === 0) {
      erros.push(...foraDoVinculo(principal, dto.inicio, dto.fim ?? null));
    }
    const regra = regraDeFeriasDoTipo(principal.tipo);
    if (dto.tipo === "ferias" && regra === "sem_ferias") {
      erros.push({ campo: "tipo", motivo: "nao_se_aplica" });
    }
    if (
      dto.tipo === "ferias" &&
      regra === "sem_regra" &&
      (dto.diasVendidos ?? 0) > 0
    ) {
      erros.push({ campo: "diasVendidos", motivo: "nao_se_aplica" });
    }
    const coletiva = dto.feriasColetivas === true;
    if (
      coletiva &&
      !(
        dto.tipo === "ferias" &&
        regra === "calculada" &&
        podeSerColetiva(principal, dto.inicio)
      )
    ) {
      erros.push({ campo: "feriasColetivas", motivo: "nao_se_aplica" });
    }
    if (erros.length > 0) throw new CamposRecusadosException(erros);

    const aprovada = dto.tipo === "afastamento" || dto.aprovada;
    const linha = await this.prisma.$transaction(async (tx) => {
      const periodoInicio = await this.conferirNoBanco(
        tx,
        dto,
        empresaId,
        principal,
        regra,
        null,
        coletiva,
      );
      // Já há reinício nessa data (ajustado antes): não cria outro.
      const jaReiniciado =
        coletiva &&
        (await tx.reinicioPeriodoAquisitivo.count({
          where: {
            vinculoId: principal.id,
            empresaId,
            inicio: dataDoDia(dto.inicio),
            removidoEm: null,
          },
        })) > 0;
      const avaliacao =
        dto.tipo === "ferias" && dto.fim
          ? await this.avaliarPolitica(tx, {
              ...dto,
              fim: dto.fim,
              empresaId,
              principal,
              regra,
            })
          : null;
      const foraDaPolitica =
        avaliacao !== null && avaliacao.violacoes.length > 0;
      if (foraDaPolitica && !dto.motivoForaDaPolitica) {
        throw new CamposRecusadosException([
          { campo: "motivoForaDaPolitica", motivo: "obrigatorio" },
        ]);
      }
      // O reinício da coletiva não pode tirar o período de férias já
      // lançadas (a mesma conferência do "Ajustar período").
      if (coletiva && !jaReiniciado) {
        await this.conferirFeriasLancadas(
          tx,
          principal,
          dto.colaboradorId,
          empresaId,
          [
            ...(await this.reiniciosDoVinculo(tx, principal.id, empresaId)),
            reinicioDaColetiva(dto.inicio),
          ],
        );
      }

      const agora = new Date();
      const criada = await tx.ausencia.create({
        data: {
          empresaId,
          colaboradorId: dto.colaboradorId,
          vinculoId: principal.id,
          tipo: dto.tipo,
          motivoAfastamento:
            dto.tipo === "afastamento" ? dto.motivoAfastamento! : null,
          inicio: dataDoDia(dto.inicio),
          fim: dto.fim ? dataDoDia(dto.fim) : null,
          diasVendidos: dto.tipo === "ferias" ? (dto.diasVendidos ?? 0) : 0,
          periodoAquisitivoInicio: periodoInicio
            ? dataDoDia(periodoInicio)
            : null,
          status: aprovada ? "aprovada" : "aguardando_rh",
          observacao: dto.observacao ?? null,
          feriasColetivas: coletiva,
          ...(foraDaPolitica
            ? {
                politicaFeriasId: avaliacao.id,
                motivoForaDaPolitica: dto.motivoForaDaPolitica ?? null,
              }
            : {}),
          registradoPorId: ctx.actor.id,
          ...(aprovada
            ? { decididoPorId: ctx.actor.id, decididoEm: agora }
            : {}),
        },
        include: INCLUSAO,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_ausencia_registrada",
        "ausencia",
        criada.id,
        empresaId,
      );
      if (coletiva && !jaReiniciado) {
        await this.criarReinicioDaColetiva(tx, ctx, criada.id, {
          empresaId,
          colaboradorId: dto.colaboradorId,
          vinculoId: principal.id,
          inicio: dto.inicio,
        });
      }
      return criada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos, veAnexo(ctx));
  }

  /**
   * A conferência que olha o banco, comum ao registro e à edição: a
   * sobreposição com outra ausência da pessoa e o saldo de férias. Na
   * edição, a própria ausência (`ignorar`) não conta. Devolve o início do
   * período aquisitivo das férias (ou `null`).
   */
  private async conferirNoBanco(
    tx: Prisma.TransactionClient,
    dto: RegistrarAusenciaDto,
    empresaId: string,
    principal: Awaited<ReturnType<AusenciasService["vinculoPrincipal"]>>,
    regra: ReturnType<typeof regraDeFeriasDoTipo>,
    ignorar: string | null,
    coletiva = false,
  ): Promise<Dia | null> {
    // Um registro por vez para a mesma pessoa: a sobreposição e o saldo
    // são conferidos sem corrida com outra aba.
    {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ausencia:${dto.colaboradorId}:${empresaId}`}))`;
      const existentes = await tx.ausencia.findMany({
        where: {
          colaboradorId: dto.colaboradorId,
          empresaId,
          status: { in: [...STATUS_QUE_OCUPAM] },
          excluidaEm: null,
          ...(ignorar ? { id: { not: ignorar } } : {}),
        },
      });
      const nova = { inicio: dto.inicio, fim: dto.fim ?? null };
      if (
        existentes.some((a) =>
          seSobrepoem(
            { inicio: diaDe(a.inicio), fim: a.fim ? diaDe(a.fim) : null },
            nova,
          ),
        )
      ) {
        throw new ConflitoDeCamposException([
          { campo: "inicio", motivo: "sobreposicao" },
        ]);
      }

      let periodoInicio: Dia | null = null;
      if (dto.tipo === "ferias" && regra === "calculada") {
        const hoje = hojeEmSaoPaulo();
        const periodos = this.periodosDoVinculo(
          principal,
          existentes.map(paraSaldo),
          hoje,
          dto.inicio > hoje ? dto.inicio : hoje,
          [
            ...(await this.reiniciosDoVinculo(tx, principal.id, empresaId)),
            ...(coletiva ? [reinicioDaColetiva(dto.inicio)] : []),
          ],
        );
        const periodo = periodoParaFerias(
          periodos,
          dto.inicio,
          dto.periodoAquisitivoInicio ?? null,
        );
        const vendidos = dto.diasVendidos ?? 0;
        const recusas: ErroDeCampo[] = [];
        if (!periodo) {
          recusas.push(
            dto.periodoAquisitivoInicio
              ? { campo: "periodoAquisitivoInicio", motivo: "indisponivel" }
              : { campo: "fim", motivo: "saldo_insuficiente" },
          );
        } else {
          // Venda em frações: soma o que as outras férias vivas do mesmo
          // período já venderam (a própria, na edição, não conta).
          const jaVendidos = existentes
            .filter(
              (a) =>
                a.tipo === "ferias" &&
                a.periodoAquisitivoInicio !== null &&
                diaDe(a.periodoAquisitivoInicio) === periodo.inicio,
            )
            .reduce((soma, a) => soma + a.diasVendidos, 0);
          if (vendidos > vendaveisRestantes(periodo.direito, jaVendidos)) {
            recusas.push({
              campo: "diasVendidos",
              motivo: "venda_acima_do_limite",
            });
          }
          if (
            diasCorridos(dto.inicio, dto.fim!) + vendidos >
            periodo.disponiveis
          ) {
            recusas.push({ campo: "fim", motivo: "saldo_insuficiente" });
          }
          periodoInicio = periodo.inicio;
        }
        if (recusas.length > 0) throw new CamposRecusadosException(recusas);
      }
      return periodoInicio;
    }
  }

  // ---- editar e excluir (como a referência) ---------------------------------

  /**
   * Edita a ausência com as mesmas regras do registro (forma, vínculo,
   * sobreposição, saldo, coletiva e política, sem contar a própria). "Já
   * aprovada" decide de novo (quem e quando); "ainda não" volta a aguardar o
   * RH. Cancelada ou recusada não muda (409); excluída ou de outra empresa,
   * 404. Vale o vínculo da própria ausência: encerrado, não se edita.
   */
  async alterar(
    ausenciaId: string,
    dto: AlterarAusenciaDto,
    ctx: PessoasAuditContext,
  ): Promise<AusenciaApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const atual = await this.prisma.ausencia.findFirst({
      where: { id: ausenciaId, empresaId, excluidaEm: null },
      select: {
        colaboradorId: true,
        status: true,
        vinculo: { select: VINCULO_DO_SALDO },
      },
    });
    if (!atual) {
      return this.auditoria.negarAcesso(ctx, "ausencia", ausenciaId, empresaId);
    }
    if (atual.status === "cancelada" || atual.status === "recusada") {
      throw new ConflictException();
    }
    const completo: RegistrarAusenciaDto = {
      ...dto,
      colaboradorId: atual.colaboradorId,
    };
    const vinculo = atual.vinculo;
    const erros = validarForma(completo);
    if (vinculo.situacao !== "ativo") {
      erros.push({ campo: "inicio", motivo: "fora_do_vinculo" });
    } else if (erros.length === 0) {
      erros.push(...foraDoVinculo(vinculo, dto.inicio, dto.fim ?? null));
    }
    const regra = regraDeFeriasDoTipo(vinculo.tipo);
    if (dto.tipo === "ferias" && regra === "sem_ferias") {
      erros.push({ campo: "tipo", motivo: "nao_se_aplica" });
    }
    if (
      dto.tipo === "ferias" &&
      regra === "sem_regra" &&
      (dto.diasVendidos ?? 0) > 0
    ) {
      erros.push({ campo: "diasVendidos", motivo: "nao_se_aplica" });
    }
    const coletiva = dto.feriasColetivas === true;
    if (
      coletiva &&
      !(
        dto.tipo === "ferias" &&
        regra === "calculada" &&
        podeSerColetiva(vinculo, dto.inicio)
      )
    ) {
      erros.push({ campo: "feriasColetivas", motivo: "nao_se_aplica" });
    }
    if (erros.length > 0) throw new CamposRecusadosException(erros);

    const aprovada = dto.tipo === "afastamento" || dto.aprovada;
    const linha = await this.prisma.$transaction(async (tx) => {
      await this.travarSaldo(tx, atual.colaboradorId, empresaId);
      // Relida sob a trava: outra aba pode ter cancelado ou excluído.
      const agora = await tx.ausencia.findFirst({
        where: { id: ausenciaId, empresaId, excluidaEm: null },
        select: { status: true },
      });
      if (!agora) {
        return this.auditoria.negarAcesso(
          ctx,
          "ausencia",
          ausenciaId,
          empresaId,
        );
      }
      if (agora.status === "cancelada" || agora.status === "recusada") {
        throw new ConflictException();
      }
      // A coletiva que muda de data (ou deixa de ser coletiva) desfaz o
      // reinício que abriu; as contas seguintes já o veem desfeito.
      const ligados = await tx.reinicioPeriodoAquisitivo.findMany({
        where: { ausenciaId, empresaId, removidoEm: null },
      });
      const mantido =
        coletiva && ligados.some((r) => diaDe(r.inicio) === dto.inicio);
      const desfeitos = mantido
        ? 0
        : await this.desfazerReiniciosDaAusencia(
            tx,
            ctx,
            ausenciaId,
            empresaId,
          );
      const jaReiniciado =
        coletiva &&
        (mantido ||
          (await tx.reinicioPeriodoAquisitivo.count({
            where: {
              vinculoId: vinculo.id,
              empresaId,
              inicio: dataDoDia(dto.inicio),
              removidoEm: null,
            },
          })) > 0);

      const periodoInicio = await this.conferirNoBanco(
        tx,
        completo,
        empresaId,
        vinculo,
        regra,
        ausenciaId,
        coletiva,
      );
      const avaliacao =
        dto.tipo === "ferias" && dto.fim
          ? await this.avaliarPolitica(tx, {
              ...dto,
              colaboradorId: atual.colaboradorId,
              fim: dto.fim,
              ignorar: ausenciaId,
              empresaId,
              principal: vinculo,
              regra,
            })
          : null;
      const foraDaPolitica =
        avaliacao !== null && avaliacao.violacoes.length > 0;
      if (foraDaPolitica && !dto.motivoForaDaPolitica) {
        throw new CamposRecusadosException([
          { campo: "motivoForaDaPolitica", motivo: "obrigatorio" },
        ]);
      }

      const atualizada = await tx.ausencia.update({
        where: { id: ausenciaId },
        data: {
          tipo: dto.tipo,
          motivoAfastamento:
            dto.tipo === "afastamento" ? dto.motivoAfastamento! : null,
          inicio: dataDoDia(dto.inicio),
          fim: dto.fim ? dataDoDia(dto.fim) : null,
          diasVendidos: dto.tipo === "ferias" ? (dto.diasVendidos ?? 0) : 0,
          periodoAquisitivoInicio: periodoInicio
            ? dataDoDia(periodoInicio)
            : null,
          observacao: dto.observacao ?? null,
          feriasColetivas: coletiva,
          // A política é avaliada de novo: dentro dela, os campos saem.
          politicaFeriasId: foraDaPolitica ? avaliacao.id : null,
          motivoForaDaPolitica: foraDaPolitica
            ? (dto.motivoForaDaPolitica ?? null)
            : null,
          motivoDecisao: null,
          // Editar responde à sugestão de outras datas (se havia).
          sugestaoInicio: null,
          sugestaoFim: null,
          ...(aprovada
            ? {
                status: "aprovada",
                decididoPorId: ctx.actor.id,
                decididoEm: new Date(),
              }
            : {
                status: "aguardando_rh",
                decididoPorId: null,
                decididoEm: null,
              }),
        },
        include: INCLUSAO,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_ausencia_alterada",
        "ausencia",
        ausenciaId,
        empresaId,
      );
      const criaReinicio = coletiva && !jaReiniciado;
      if (criaReinicio || desfeitos > 0) {
        // As férias já lançadas continuam com período (e com direito).
        await this.conferirFeriasLancadas(
          tx,
          vinculo,
          atual.colaboradorId,
          empresaId,
          [
            ...(await this.reiniciosDoVinculo(tx, vinculo.id, empresaId)),
            ...(criaReinicio ? [reinicioDaColetiva(dto.inicio)] : []),
          ],
        );
      }
      if (criaReinicio) {
        await this.criarReinicioDaColetiva(tx, ctx, ausenciaId, {
          empresaId,
          colaboradorId: atual.colaboradorId,
          vinculoId: vinculo.id,
          inicio: dto.inicio,
        });
      }
      return atualizada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos, veAnexo(ctx));
  }

  /**
   * Exclui a ausência, como a referência: ela sai do histórico, da lista,
   * do quadro e do saldo. O registro fica, marcado (quem e quando): a
   * aplicação não tem DELETE na tabela (histórico imutável). O reinício que
   * a coletiva abriu é desfeito junto.
   */
  async excluir(ausenciaId: string, ctx: PessoasAuditContext): Promise<void> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      const alvo = await tx.ausencia.findFirst({
        where: { id: ausenciaId, empresaId, excluidaEm: null },
        select: { colaboradorId: true },
      });
      if (alvo) await this.travarSaldo(tx, alvo.colaboradorId, empresaId);
      const marcadas = await tx.ausencia.updateMany({
        where: { id: ausenciaId, empresaId, excluidaEm: null },
        data: { excluidaEm: new Date(), excluidaPorId: ctx.actor.id },
      });
      if (marcadas.count === 0) {
        return this.auditoria.negarAcesso(
          ctx,
          "ausencia",
          ausenciaId,
          empresaId,
        );
      }
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_ausencia_excluida",
        "ausencia",
        ausenciaId,
        empresaId,
      );
      await this.desfazerEConferir(tx, ctx, ausenciaId, empresaId);
    });
  }

  // ---- decisões ------------------------------------------------------------

  async decidir(
    ausenciaId: string,
    decisao: DecisaoDeAusencia,
    motivo: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<AusenciaApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const linha = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.ausencia.findFirst({
        where: { id: ausenciaId, empresaId, excluidaEm: null },
        include: INCLUSAO,
      });
      if (!atual) {
        return this.auditoria.negarAcesso(
          ctx,
          "ausencia",
          ausenciaId,
          empresaId,
        );
      }
      // Sem o Portal, quem pediu não responde à sugestão: aprovar aqui
      // aprovaria as datas antigas. Para seguir, edita-se ou recusa-se.
      if (decisao === "aprovar" && atual.status === "ajuste_sugerido") {
        throw new CamposRecusadosException([
          { campo: "sugestao", motivo: "aguardando_resposta" },
        ]);
      }
      const destino = proximoStatus(atual.status, decisao);
      if (destino === null) throw new ConflictException();
      if (destino === atual.status) return atual;
      const desfaz = destino === "recusada" || destino === "cancelada";
      if (desfaz) await this.travarSaldo(tx, atual.colaboradorId, empresaId);
      const atualizada = await tx.ausencia.update({
        where: { id: atual.id },
        data: {
          status: destino,
          decididoPorId: ctx.actor.id,
          decididoEm: new Date(),
          ...(decisao === "recusar" || decisao === "aprovar"
            ? { motivoDecisao: motivo ?? null }
            : {}),
        },
        include: INCLUSAO,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        destino === "aprovada"
          ? "pessoas_ausencia_aprovada"
          : destino === "recusada"
            ? "pessoas_ausencia_recusada"
            : "pessoas_ausencia_cancelada",
        "ausencia",
        atual.id,
        empresaId,
      );
      // Recusada ou cancelada, a coletiva desfaz o reinício que abriu.
      if (desfaz) await this.desfazerEConferir(tx, ctx, atual.id, empresaId);
      return atualizada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos, veAnexo(ctx));
  }

  /**
   * "Sugerir outras datas" (como a referência): o pedido pendente fica em
   * "Ajuste sugerido", com o novo período e a mensagem; quem pediu aceita ou
   * pede outra data (pelo Portal, quando ele existir).
   */
  async sugerir(
    ausenciaId: string,
    dto: SugerirAusenciaDto,
    ctx: PessoasAuditContext,
  ): Promise<AusenciaApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const linha = await this.prisma.$transaction(async (tx) => {
      const atual = await tx.ausencia.findFirst({
        where: { id: ausenciaId, empresaId, excluidaEm: null },
        include: INCLUSAO,
      });
      if (!atual) {
        return this.auditoria.negarAcesso(
          ctx,
          "ausencia",
          ausenciaId,
          empresaId,
        );
      }
      if (
        !PENDENTES.includes(atual.status) ||
        atual.status === "ajuste_sugerido"
      ) {
        throw new ConflictException();
      }
      if (dto.fim < dto.inicio) {
        throw new CamposRecusadosException([
          { campo: "fim", motivo: "fim_antes_do_inicio" },
        ]);
      }
      if (
        dto.inicio === diaDe(atual.inicio) &&
        dto.fim === (atual.fim ? diaDe(atual.fim) : null)
      ) {
        throw new CamposRecusadosException([
          { campo: "inicio", motivo: "igual_ao_pedido" },
        ]);
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ausencia:${atual.colaboradorId}:${empresaId}`}))`;
      const outras = await tx.ausencia.findMany({
        where: {
          colaboradorId: atual.colaboradorId,
          empresaId,
          status: { in: [...STATUS_QUE_OCUPAM] },
          excluidaEm: null,
          id: { not: atual.id },
        },
      });
      if (
        outras.some((a) =>
          seSobrepoem(
            { inicio: diaDe(a.inicio), fim: a.fim ? diaDe(a.fim) : null },
            { inicio: dto.inicio, fim: dto.fim },
          ),
        )
      ) {
        throw new ConflitoDeCamposException([
          { campo: "inicio", motivo: "sobreposicao" },
        ]);
      }
      const atualizada = await tx.ausencia.update({
        where: { id: atual.id },
        data: {
          status: "ajuste_sugerido",
          sugestaoInicio: dataDoDia(dto.inicio),
          sugestaoFim: dataDoDia(dto.fim),
          motivoDecisao: dto.mensagem ?? null,
          decididoPorId: ctx.actor.id,
          decididoEm: new Date(),
        },
        include: INCLUSAO,
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_ausencia_ajuste_sugerido",
        "ausencia",
        atual.id,
        empresaId,
      );
      return atualizada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos, veAnexo(ctx));
  }

  // ---- simulação -----------------------------------------------------------

  async simular(
    query: SimularAusenciaQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<SimulacaoDeAusencia> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const principal = await this.vinculoPrincipal(
      query.colaboradorId,
      empresaId,
      ctx,
    );
    if (query.fim && query.fim < query.inicio) {
      throw new CamposRecusadosException([
        { campo: "fim", motivo: "fim_antes_do_inicio" },
      ]);
    }
    const fim = query.fim ?? null;
    const regraDeFerias = regraDeFeriasDoTipo(principal.tipo);
    const base = {
      dias: fim ? diasCorridos(query.inicio, fim) : null,
      diasUteis: fim ? diasUteis(query.inicio, fim) : null,
      volta: fim ? diaDaVolta(fim) : null,
      regraDeFerias,
      avisosClt: [] as AvisoClt[],
      periodosDisponiveis: [] as {
        inicio: Dia;
        fim: Dia;
        disponiveis: number;
      }[],
      podeSerColetiva:
        query.tipo === "ferias" &&
        regraDeFerias === "calculada" &&
        podeSerColetiva(principal, query.inicio),
      coletiva: null as { dias: number; novoPeriodo: Dia } | null,
      politica:
        query.tipo === "ferias" && fim
          ? await this.avaliarPolitica(this.prisma, {
              ...query,
              fim,
              empresaId,
              principal,
              regra: regraDeFerias,
            })
          : null,
    };
    if (query.tipo !== "ferias" || !fim || regraDeFerias !== "calculada") {
      return {
        ...base,
        periodo: null,
        saldoAntes: null,
        saldoDepois: null,
        maxVendaveis: null,
        vendidosNoPeriodo: null,
        prazoAbono: null,
      };
    }
    const existentes = await this.prisma.ausencia.findMany({
      where: {
        colaboradorId: query.colaboradorId,
        empresaId,
        status: { in: [...STATUS_QUE_OCUPAM] },
        excluidaEm: null,
        ...(query.ignorar ? { id: { not: query.ignorar } } : {}),
      },
    });
    const hoje = hojeEmSaoPaulo();
    const coletiva = query.feriasColetivas === true && base.podeSerColetiva;
    const periodos = this.periodosDoVinculo(
      principal,
      existentes.map(paraSaldo),
      hoje,
      query.inicio > hoje ? query.inicio : hoje,
      [
        ...(await this.reiniciosDoVinculo(
          this.prisma,
          principal.id,
          empresaId,
        )),
        ...(coletiva ? [reinicioDaColetiva(query.inicio)] : []),
      ],
    );
    const periodo = periodoParaFerias(
      periodos,
      query.inicio,
      query.periodoAquisitivoInicio ?? null,
    );
    if (coletiva) {
      const encurtado = periodos.find(
        (p) => p.encurtado?.novoInicio === query.inicio,
      );
      base.coletiva = encurtado
        ? { dias: encurtado.direito, novoPeriodo: query.inicio }
        : null;
    }
    const usados = base.dias! + (query.diasVendidos ?? 0);
    const periodosDisponiveis = periodos
      .filter((p) => p.fim < query.inicio && p.disponiveis > 0)
      .map((p) => ({
        inicio: p.inicio,
        fim: p.fim,
        disponiveis: p.disponiveis,
      }));
    if (!periodo) {
      return {
        ...base,
        periodosDisponiveis,
        periodo: null,
        saldoAntes: 0,
        saldoDepois: -usados,
        maxVendaveis: 0,
        vendidosNoPeriodo: null,
        prazoAbono: null,
      };
    }
    const doPeriodo = existentes.filter(
      (a) =>
        a.tipo === "ferias" &&
        a.fim !== null &&
        a.periodoAquisitivoInicio !== null &&
        diaDe(a.periodoAquisitivoInicio) === periodo.inicio,
    );
    const outrasFerias = doPeriodo.map((a) => ({
      inicio: diaDe(a.inicio),
      fim: diaDe(a.fim!),
    }));
    const vendidosNoPeriodo = doPeriodo.reduce(
      (soma, a) => soma + a.diasVendidos,
      0,
    );
    return {
      ...base,
      avisosClt: avisosDaClt({
        inicio: query.inicio,
        fim,
        periodo,
        outrasFerias,
        diasVendidos: query.diasVendidos ?? 0,
      }),
      periodosDisponiveis,
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      saldoAntes: periodo.disponiveis,
      saldoDepois: periodo.disponiveis - usados,
      maxVendaveis: vendaveisRestantes(periodo.direito, vendidosNoPeriodo),
      vendidosNoPeriodo,
      prazoAbono: prazoDoAbono(periodo),
    };
  }

  // ---- saldo da ficha ------------------------------------------------------

  async feriasDoColaborador(
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<FeriasDoColaborador> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const principal = await this.vinculoPrincipal(
      colaboradorId,
      empresaId,
      ctx,
    );
    const linhas = await this.prisma.ausencia.findMany({
      where: { colaboradorId, empresaId, excluidaEm: null },
      include: INCLUSAO,
      orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
    });
    const hoje = hojeEmSaoPaulo();
    const regraDeFerias = regraDeFeriasDoTipo(principal.tipo);
    const reinicios = await this.prisma.reinicioPeriodoAquisitivo.findMany({
      where: { vinculoId: principal.id, empresaId, removidoEm: null },
      orderBy: { inicio: "asc" },
    });
    const periodos =
      regraDeFerias === "calculada"
        ? this.periodosDoVinculo(
            principal,
            linhas.map(paraSaldo),
            hoje,
            hoje,
            reinicios.map((r) => ({
              inicio: diaDe(r.inicio),
              motivo: r.motivo,
              dias: r.diasPeriodoAnterior,
            })),
          )
        : [];
    // A leitura da ficha alcança dados de saúde (licenças): fica na trilha,
    // só com o id do colaborador — nunca tipo, datas ou observação.
    await this.auditoria.registrarLeitura(
      ctx,
      "pessoas_ausencia_consultada",
      "ausencia",
      colaboradorId,
      empresaId,
    );
    const periodoAtual = indiceDoPeriodoAtual(periodos, hoje);
    const fotos = await this.fotos(empresaId, [colaboradorId]);
    const proxima = [...linhas]
      .filter(
        (l) => STATUS_QUE_OCUPAM.includes(l.status) && diaDe(l.inicio) >= hoje,
      )
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
    return {
      regraDeFerias,
      vinculo: {
        tipo: principal.tipo,
        dataAdmissao: diaDe(principal.dataAdmissao),
      },
      periodos,
      periodoAtual,
      proximaAusencia: proxima ? paraApi(proxima, fotos, veAnexo(ctx)) : null,
      historico: linhas.map((l) => paraApi(l, fotos, veAnexo(ctx))),
      reinicios:
        regraDeFerias === "calculada" ? reinicios.map(reinicioParaApi) : [],
    };
  }

  // ---- ajustar período (reinício da contagem) ------------------------------

  /**
   * "Períodos hoje" (sem `inicio`) ou "Como os períodos vão ficar": o período
   * que a ficha mostraria e o seguinte. `diasCalculados`: o proporcional do
   * período que a data encurta (o "Calculado: N" do campo de dias).
   */
  async simularReinicio(
    colaboradorId: string,
    query: SimularReinicioQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<SimulacaoDeReinicio> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const principal = await this.vinculoPrincipal(
      colaboradorId,
      empresaId,
      ctx,
    );
    if (regraDeFeriasDoTipo(principal.tipo) !== "calculada") {
      return { periodos: [], diasCalculados: null };
    }
    const [ausencias, gravados] = await Promise.all([
      this.ausenciasDoSaldo(this.prisma, colaboradorId, empresaId),
      this.reiniciosDoVinculo(this.prisma, principal.id, empresaId),
    ]);
    const hoje = hojeEmSaoPaulo();
    const novo: ReinicioDoSaldo | null =
      query.inicio && query.inicio > diaDe(principal.dataAdmissao)
        ? {
            inicio: query.inicio,
            motivo: query.motivo ?? "ferias_coletivas",
            dias: query.dias ?? null,
          }
        : null;
    const reinicios = novo
      ? [...gravados.filter((r) => r.inicio !== novo.inicio), novo]
      : gravados;
    const ate = somarMeses(
      novo && novo.inicio > hoje ? somarDias(novo.inicio, -1) : hoje,
      12,
    );
    const periodos = this.periodosDoVinculo(
      principal,
      ausencias,
      hoje,
      ate,
      reinicios,
    );
    const i = indiceDoPeriodoAtual(periodos, hoje) ?? 0;
    const encurtado = novo
      ? periodos.find((p) => p.encurtado?.novoInicio === novo.inicio)
      : undefined;
    return {
      periodos: periodos.slice(i, i + 2),
      diasCalculados: encurtado
        ? diasProporcionais(
            encurtado.inicio,
            encurtado.fim,
            direitoDoTipo(principal.tipo),
          )
        : null,
    };
  }

  async registrarReinicio(
    colaboradorId: string,
    dto: RegistrarReinicioDto,
    ctx: PessoasAuditContext,
  ): Promise<ReinicioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const principal = await this.vinculoPrincipal(
      colaboradorId,
      empresaId,
      ctx,
    );
    if (regraDeFeriasDoTipo(principal.tipo) !== "calculada") {
      throw new CamposRecusadosException([
        { campo: "inicio", motivo: "sem_saldo_calculado" },
      ]);
    }
    if (dto.inicio <= diaDe(principal.dataAdmissao)) {
      throw new CamposRecusadosException([
        { campo: "inicio", motivo: "antes_da_admissao" },
      ]);
    }
    const linha = await this.prisma.$transaction(async (tx) => {
      await this.travarSaldo(tx, colaboradorId, empresaId);
      const gravados = await this.reiniciosDoVinculo(
        tx,
        principal.id,
        empresaId,
      );
      if (gravados.some((r) => r.inicio === dto.inicio)) {
        throw new ConflitoDeCamposException([
          { campo: "inicio", motivo: "ja_existe" },
        ]);
      }
      await this.conferirFeriasLancadas(
        tx,
        principal,
        colaboradorId,
        empresaId,
        [
          ...gravados,
          {
            inicio: dto.inicio,
            motivo: dto.motivo,
            dias: dto.diasPeriodoAnterior ?? null,
          },
        ],
      );
      const criado = await tx.reinicioPeriodoAquisitivo.create({
        data: {
          empresaId,
          colaboradorId,
          vinculoId: principal.id,
          inicio: dataDoDia(dto.inicio),
          motivo: dto.motivo,
          diasPeriodoAnterior: dto.diasPeriodoAnterior ?? null,
          observacao: dto.observacao ?? null,
          registradoPorId: ctx.actor.id,
        },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_periodo_reiniciado",
        "reinicio_periodo",
        criado.id,
        empresaId,
      );
      return criado;
    });
    return reinicioParaApi(linha);
  }

  async removerReinicio(
    colaboradorId: string,
    reinicioId: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      await this.travarSaldo(tx, colaboradorId, empresaId);
      const alvo = await tx.reinicioPeriodoAquisitivo.findFirst({
        where: { id: reinicioId, colaboradorId, empresaId, removidoEm: null },
      });
      if (!alvo) {
        return this.auditoria.negarAcesso(
          ctx,
          "reinicio_periodo",
          reinicioId,
          empresaId,
        );
      }
      const vinculo = await tx.vinculoFuncional.findFirstOrThrow({
        where: { id: alvo.vinculoId, empresaId },
        select: VINCULO_DO_SALDO,
      });
      const restantes = (
        await this.reiniciosDoVinculo(tx, alvo.vinculoId, empresaId)
      ).filter((r) => r.inicio !== diaDe(alvo.inicio));
      await this.conferirFeriasLancadas(
        tx,
        vinculo,
        colaboradorId,
        empresaId,
        restantes,
      );
      await tx.reinicioPeriodoAquisitivo.update({
        where: { id: alvo.id },
        data: { removidoEm: new Date(), removidoPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_periodo_reinicio_removido",
        "reinicio_periodo",
        alvo.id,
        empresaId,
      );
    });
  }

  /**
   * T215 — confere as férias contra a política da pessoa: o período de que
   * descontam (com a coletiva, se pedida), o saldo depois e as outras férias
   * do mesmo período. Sem política, `null`.
   */
  private async avaliarPolitica(
    db: Prisma.TransactionClient,
    a: {
      colaboradorId: string;
      inicio: Dia;
      fim: Dia;
      diasVendidos?: number;
      periodoAquisitivoInicio?: string;
      feriasColetivas?: boolean;
      ignorar?: string;
      empresaId: string;
      principal: VinculoDoSaldo;
      regra: RegraDeFerias;
    },
  ): Promise<{
    id: string;
    nome: string;
    violacoes: ViolacaoDaPolitica[];
  } | null> {
    let saldoDepois = Number.POSITIVE_INFINITY;
    let outrasFerias: { inicio: Dia; fim: Dia }[] = [];
    if (a.regra === "calculada") {
      const existentes = await db.ausencia.findMany({
        where: {
          colaboradorId: a.colaboradorId,
          empresaId: a.empresaId,
          status: { in: [...STATUS_QUE_OCUPAM] },
          excluidaEm: null,
          ...(a.ignorar ? { id: { not: a.ignorar } } : {}),
        },
      });
      const hoje = hojeEmSaoPaulo();
      const coletiva =
        a.feriasColetivas === true && podeSerColetiva(a.principal, a.inicio);
      const periodos = this.periodosDoVinculo(
        a.principal,
        existentes.map(paraSaldo),
        hoje,
        a.inicio > hoje ? a.inicio : hoje,
        [
          ...(await this.reiniciosDoVinculo(db, a.principal.id, a.empresaId)),
          ...(coletiva ? [reinicioDaColetiva(a.inicio)] : []),
        ],
      );
      const periodo = periodoParaFerias(
        periodos,
        a.inicio,
        a.periodoAquisitivoInicio ?? null,
      );
      const usados = diasCorridos(a.inicio, a.fim) + (a.diasVendidos ?? 0);
      saldoDepois = (periodo?.disponiveis ?? 0) - usados;
      outrasFerias = periodo
        ? existentes
            .filter(
              (x) =>
                x.tipo === "ferias" &&
                x.fim !== null &&
                x.periodoAquisitivoInicio !== null &&
                diaDe(x.periodoAquisitivoInicio) === periodo.inicio,
            )
            .map((x) => ({ inicio: diaDe(x.inicio), fim: diaDe(x.fim!) }))
        : [];
    }
    return this.politicas.avaliar(db, {
      empresaId: a.empresaId,
      colaboradorId: a.colaboradorId,
      tipo: a.principal.tipo,
      vinculoId: a.principal.id,
      inicio: a.inicio,
      fim: a.fim,
      saldoDepois,
      outrasFerias,
      ignorar: a.ignorar ?? null,
    });
  }

  /** T215 — o reinício que as férias coletivas abrem, ligado a elas. */
  private async criarReinicioDaColetiva(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    ausenciaId: string,
    a: {
      empresaId: string;
      colaboradorId: string;
      vinculoId: string;
      inicio: Dia;
    },
  ): Promise<void> {
    const reinicio = await tx.reinicioPeriodoAquisitivo.create({
      data: {
        empresaId: a.empresaId,
        colaboradorId: a.colaboradorId,
        vinculoId: a.vinculoId,
        inicio: dataDoDia(a.inicio),
        motivo: "ferias_coletivas",
        ausenciaId,
        registradoPorId: ctx.actor.id,
      },
    });
    await this.auditoria.registrarMutacao(
      tx,
      ctx,
      "pessoas_periodo_reiniciado",
      "reinicio_periodo",
      reinicio.id,
      a.empresaId,
    );
  }

  /**
   * T215 — desfaz (logicamente: quem e quando) os reinícios que a ausência
   * abriu como coletiva. Devolve quantos desfez.
   */
  private async desfazerReiniciosDaAusencia(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    ausenciaId: string,
    empresaId: string,
  ): Promise<number> {
    const ligados = await tx.reinicioPeriodoAquisitivo.findMany({
      where: { ausenciaId, empresaId, removidoEm: null },
      select: { id: true },
    });
    for (const r of ligados) {
      await tx.reinicioPeriodoAquisitivo.update({
        where: { id: r.id },
        data: { removidoEm: new Date(), removidoPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_periodo_reinicio_removido",
        "reinicio_periodo",
        r.id,
        empresaId,
      );
    }
    return ligados.length;
  }

  /**
   * T215 — depois de recusar, cancelar ou excluir: desfaz o reinício da
   * coletiva e confere que as férias já lançadas seguem com período.
   */
  private async desfazerEConferir(
    tx: Prisma.TransactionClient,
    ctx: PessoasAuditContext,
    ausenciaId: string,
    empresaId: string,
  ): Promise<void> {
    const desfeitos = await this.desfazerReiniciosDaAusencia(
      tx,
      ctx,
      ausenciaId,
      empresaId,
    );
    if (desfeitos === 0) return;
    const ausencia = await tx.ausencia.findFirstOrThrow({
      where: { id: ausenciaId, empresaId },
      select: { colaboradorId: true, vinculo: { select: VINCULO_DO_SALDO } },
    });
    await this.conferirFeriasLancadas(
      tx,
      ausencia.vinculo,
      ausencia.colaboradorId,
      empresaId,
      await this.reiniciosDoVinculo(tx, ausencia.vinculo.id, empresaId),
    );
  }

  /** Um ajuste por vez para a mesma pessoa (a mesma trava do registro). */
  private async travarSaldo(
    tx: Prisma.TransactionClient,
    colaboradorId: string,
    empresaId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ausencia:${colaboradorId}:${empresaId}`}))`;
  }

  /**
   * Com os reinícios propostos, toda férias lançada precisa continuar num
   * período (o início dele não pode sumir) e nenhum período pode ficar com
   * menos direito do que as férias já lançadas nele.
   */
  private async conferirFeriasLancadas(
    tx: Prisma.TransactionClient,
    vinculo: VinculoDoSaldo,
    colaboradorId: string,
    empresaId: string,
    reinicios: readonly ReinicioDoSaldo[],
  ): Promise<void> {
    const ausencias = await this.ausenciasDoSaldo(tx, colaboradorId, empresaId);
    const lancadas = ausencias.filter(
      (a) => a.tipo === "ferias" && a.periodoAquisitivoInicio !== null,
    );
    if (lancadas.length === 0) return;
    const ultimo = lancadas
      .map((a) => a.periodoAquisitivoInicio!)
      .reduce((m, d) => (d > m ? d : m));
    const hoje = hojeEmSaoPaulo();
    const periodos = this.periodosDoVinculo(
      vinculo,
      ausencias,
      hoje,
      ultimo > hoje ? ultimo : hoje,
      reinicios,
    );
    const inicios = new Set(periodos.map((p) => p.inicio));
    if (lancadas.some((a) => !inicios.has(a.periodoAquisitivoInicio!))) {
      throw new ConflitoDeCamposException([
        { campo: "inicio", motivo: "ferias_sem_periodo" },
      ]);
    }
    if (periodos.some((p) => p.solicitados > p.direito)) {
      throw new ConflitoDeCamposException([
        { campo: "diasPeriodoAnterior", motivo: "abaixo_das_ferias" },
      ]);
    }
  }

  private async ausenciasDoSaldo(
    db: Prisma.TransactionClient,
    colaboradorId: string,
    empresaId: string,
  ): Promise<AusenciaDoSaldo[]> {
    const linhas = await db.ausencia.findMany({
      where: {
        colaboradorId,
        empresaId,
        status: { in: [...STATUS_QUE_OCUPAM] },
        excluidaEm: null,
      },
    });
    return linhas.map(paraSaldo);
  }

  /** Os reinícios vivos do vínculo, na forma do cálculo. */
  private async reiniciosDoVinculo(
    db: Prisma.TransactionClient,
    vinculoId: string,
    empresaId: string,
  ): Promise<ReinicioDoSaldo[]> {
    const linhas = await db.reinicioPeriodoAquisitivo.findMany({
      where: { vinculoId, empresaId, removidoEm: null },
      orderBy: { inicio: "asc" },
    });
    return linhas.map((l) => ({
      inicio: diaDe(l.inicio),
      motivo: l.motivo,
      dias: l.diasPeriodoAnterior,
    }));
  }

  // ---- peças ---------------------------------------------------------------

  /**
   * A empresa ativa da sessão. Escrita: só `rh` e `dp`. Leitura: também o
   * `master_tecnico`, com empresa ativa.
   */
  private empresaDaSessao(
    ctx: PessoasAuditContext,
    uso: "leitura" | "escrita",
  ): string {
    const papel = ctx.actor.role;
    const permitido =
      papel === "rh" ||
      papel === "dp" ||
      (papel === "master_tecnico" && uso === "leitura");
    if (!permitido || ctx.actor.companyId === null) {
      throw new ForbiddenException();
    }
    return ctx.actor.companyId;
  }

  /** O vínculo principal NA EMPRESA; sem vínculo nela, 404 auditado. */
  private async vinculoPrincipal(
    colaboradorId: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ): Promise<VinculoDoSaldo> {
    const vinculos = await this.prisma.vinculoFuncional.findMany({
      where: { colaboradorId, empresaId },
      select: VINCULO_DO_SALDO,
    });
    const principal = escolherVinculoPrincipal(vinculos);
    if (!principal) {
      return this.auditoria.negarAcesso(
        ctx,
        "ausencia",
        colaboradorId,
        empresaId,
      );
    }
    return principal;
  }

  /** Períodos aquisitivos do vínculo, até o desligamento, se houver. */
  private periodosDoVinculo(
    vinculo: {
      tipo: TipoVinculo;
      dataAdmissao: Date;
      dataDesligamento: Date | null;
    },
    ausencias: readonly AusenciaDoSaldo[],
    hoje: Dia,
    ate: Dia,
    reinicios: readonly ReinicioDoSaldo[],
  ): PeriodoAquisitivo[] {
    const desligamento = vinculo.dataDesligamento
      ? diaDe(vinculo.dataDesligamento)
      : null;
    return periodosAquisitivos({
      admissao: diaDe(vinculo.dataAdmissao),
      ate: desligamento && desligamento < ate ? desligamento : ate,
      hoje,
      direito: direitoDoTipo(vinculo.tipo),
      ausencias,
      reinicios,
    });
  }

  /** A versão da foto de cada colaborador NA EMPRESA. */
  private async fotos(
    empresaId: string,
    colaboradorIds: readonly string[],
  ): Promise<Map<string, { versao: number }>> {
    if (colaboradorIds.length === 0) return new Map();
    const fotos = await this.prisma.fotoColaborador.findMany({
      where: { empresaId, colaboradorId: { in: [...new Set(colaboradorIds)] } },
      select: { colaboradorId: true, versao: true },
    });
    return new Map(fotos.map((f) => [f.colaboradorId, { versao: f.versao }]));
  }
}

/** O recorte do filtro "Período" (e dos indicadores), no dia de hoje. */
export function filtroDoPeriodo(
  periodo: PeriodoDaLista,
  hoje: Dia,
): Prisma.AusenciaWhereInput {
  const dia = dataDoDia(hoje);
  switch (periodo) {
    case "em_ferias_agora":
      return {
        tipo: "ferias",
        status: "aprovada",
        inicio: { lte: dia },
        fim: { gte: dia },
      };
    case "licencas_afastamentos":
      return {
        status: "aprovada",
        OR: [
          {
            tipo: { in: [...TIPOS_DO_GRUPO.licencas, "afastamento"] },
            inicio: { lte: dia },
            fim: { gte: dia },
          },
          { tipo: "afastamento", fim: null, inicio: { lte: dia } },
        ],
      };
    case "faltas_mes": {
      const primeiro = `${hoje.slice(0, 8)}01`;
      const ultimo = somarDias(somarMeses(primeiro, 1), -1);
      return {
        tipo: { in: TIPOS_DO_GRUPO.faltas },
        status: { notIn: ["cancelada", "recusada"] },
        inicio: { gte: dataDoDia(primeiro), lte: dataDoDia(ultimo) },
      };
    }
    case "proximas_ferias":
      return {
        tipo: "ferias",
        status: { in: ["aprovada", ...PENDENTES] },
        inicio: { gt: dia, lte: dataDoDia(somarDias(hoje, 30)) },
      };
  }
}

/** O status depois da decisão; o mesmo (idempotente); ou `null` (proibida). */
export function proximoStatus(
  atual: StatusAusencia,
  decisao: DecisaoDeAusencia,
): StatusAusencia | null {
  switch (decisao) {
    case "aprovar":
      if (atual === "aprovada") return atual;
      // Ajuste sugerido: aprovar aprovaria as datas antigas, e quem pediu
      // ainda não respondeu à sugestão (Portal, quando existir).
      if (atual === "ajuste_sugerido") return null;
      return PENDENTES.includes(atual) ? "aprovada" : null;
    case "recusar":
      if (atual === "recusada") return atual;
      if (PENDENTES.includes(atual)) return "recusada";
      // Recusar o pedido de cancelamento: a ausência segue aprovada.
      return atual === "cancelamento_pedido" ? "aprovada" : null;
    case "cancelar":
      if (atual === "cancelada") return atual;
      return atual === "recusada" ? null : "cancelada";
  }
}

/** As regras de forma do registro (antes de olhar o banco). */
export function validarForma(dto: RegistrarAusenciaDto): ErroDeCampo[] {
  const erros: ErroDeCampo[] = [];
  if (dto.tipo === "afastamento") {
    if (!dto.motivoAfastamento) {
      erros.push({ campo: "motivoAfastamento", motivo: "obrigatorio" });
    }
  } else {
    if (dto.motivoAfastamento) {
      erros.push({ campo: "motivoAfastamento", motivo: "nao_se_aplica" });
    }
    if (!dto.fim) erros.push({ campo: "fim", motivo: "obrigatorio" });
  }
  if (dto.fim && dto.fim < dto.inicio) {
    erros.push({ campo: "fim", motivo: "fim_antes_do_inicio" });
  }
  if (dto.tipo !== "ferias") {
    if ((dto.diasVendidos ?? 0) > 0) {
      erros.push({ campo: "diasVendidos", motivo: "nao_se_aplica" });
    }
    if (dto.periodoAquisitivoInicio) {
      erros.push({ campo: "periodoAquisitivoInicio", motivo: "nao_se_aplica" });
    }
  }
  return erros;
}

/**
 * T215 — a ausência precisa caber no vínculo: não começa antes da admissão
 * nem passa do desligamento (afastamento sem volta, com desligamento, passa).
 */
export function foraDoVinculo(
  vinculo: { dataAdmissao: Date; dataDesligamento: Date | null },
  inicio: Dia,
  fim: Dia | null,
): ErroDeCampo[] {
  if (inicio < diaDe(vinculo.dataAdmissao)) {
    return [{ campo: "inicio", motivo: "antes_da_admissao" }];
  }
  if (vinculo.dataDesligamento) {
    const desligamento = diaDe(vinculo.dataDesligamento);
    if (inicio > desligamento) {
      return [{ campo: "inicio", motivo: "fora_do_vinculo" }];
    }
    if (fim === null || fim > desligamento) {
      return [{ campo: "fim", motivo: "fora_do_vinculo" }];
    }
  }
  return [];
}

/**
 * T215 — o anexo (atestado) só aparece para quem pode baixá-lo: `rh` e `dp`.
 * O `master_tecnico` vê o registro e o estado da ausência, sem o anexo.
 */
function veAnexo(ctx: PessoasAuditContext): boolean {
  return ctx.actor.role === "rh" || ctx.actor.role === "dp";
}

function paraApi(
  linha: LinhaDeAusencia,
  fotos: Map<string, { versao: number }>,
  comAnexo: boolean,
): AusenciaApi {
  const inicio = diaDe(linha.inicio);
  const fim = linha.fim ? diaDe(linha.fim) : null;
  const periodo = linha.periodoAquisitivoInicio
    ? diaDe(linha.periodoAquisitivoInicio)
    : null;
  return {
    id: linha.id,
    colaborador: {
      id: linha.colaborador.id,
      nome: linha.colaborador.nome,
      cargo: linha.vinculo.alocacoes[0]?.cargo?.nome ?? null,
      foto: fotos.get(linha.colaboradorId) ?? null,
    },
    tipo: linha.tipo,
    motivoAfastamento: linha.motivoAfastamento,
    inicio,
    fim,
    dias: fim ? diasCorridos(inicio, fim) : null,
    diasUteis: fim ? diasUteis(inicio, fim) : null,
    diasVendidos: linha.diasVendidos,
    periodoAquisitivo: periodo
      ? { inicio: periodo, fim: fimDoPeriodo(periodo) }
      : null,
    sugestao:
      linha.sugestaoInicio && linha.sugestaoFim
        ? {
            inicio: diaDe(linha.sugestaoInicio),
            fim: diaDe(linha.sugestaoFim),
          }
        : null,
    status: linha.status,
    observacao: linha.observacao,
    registradoEm: linha.criadoEm.toISOString(),
    decididoEm: linha.decididoEm ? linha.decididoEm.toISOString() : null,
    anexo:
      comAnexo && linha.anexos[0]
        ? {
            formato: linha.anexos[0].formato,
            tamanhoBytes: linha.anexos[0].tamanhoBytes,
            enviadoEm: linha.anexos[0].criadoEm.toISOString(),
          }
        : null,
    feriasColetivas: linha.feriasColetivas,
    motivoForaDaPolitica: linha.motivoForaDaPolitica,
  };
}
