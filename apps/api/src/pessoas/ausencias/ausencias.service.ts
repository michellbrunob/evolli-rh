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
import { PessoasAuditContext } from "../pessoas.types";
import { escolherVinculoPrincipal } from "../colaborador/vinculo-principal";
import {
  type AusenciaDoSaldo,
  type Dia,
  type PeriodoAquisitivo,
  STATUS_QUE_OCUPAM,
  dataDoDia,
  diaDaVolta,
  diaDe,
  diasCorridos,
  diasUteis,
  direitoDoTipo,
  hojeEmSaoPaulo,
  maxVendaveis,
  periodoParaFerias,
  periodosAquisitivos,
  prazoDoAbono,
  type RegraDeFerias,
  regraDeFeriasDoTipo,
  seSobrepoem,
  somarDias,
  somarMeses,
} from "./calculo-ausencias";
import {
  GrupoDeTipo,
  ListarAusenciasQueryDto,
  PeriodoDaLista,
  RegistrarAusenciaDto,
  SimularAusenciaQueryDto,
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
  status: StatusAusencia;
  observacao: string | null;
  registradoEm: string;
  decididoEm: string | null;
  /** T215 — o atestado ou documento anexado (vivo), sem nome nem chave. */
  anexo: { formato: string; tamanhoBytes: number; enviadoEm: string } | null;
}

export interface IndicadoresDeAusencias {
  emFeriasAgora: number;
  licencasEAfastamentos: number;
  faltasEsteMes: number;
  proximasFerias: number;
  pendentes: number;
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
  maxVendaveis: number | null;
  prazoAbono: Dia | null;
  /** T215 — a regra de férias do vínculo da pessoa. */
  regraDeFerias: RegraDeFerias;
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
  ) {}

  // ---- lista ---------------------------------------------------------------

  async listar(
    query: ListarAusenciasQueryDto,
    ctx: PessoasAuditContext,
  ): Promise<ListagemDeAusencias> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const hoje = hojeEmSaoPaulo();
    const where: Prisma.AusenciaWhereInput = { empresaId };
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
      itens: linhas.map((l) => paraApi(l, fotos)),
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
      this.prisma.ausencia.count({ where: { empresaId, ...filtro } });
    const [
      emFeriasAgora,
      licencasEAfastamentos,
      faltasEsteMes,
      proximasFerias,
      pendentes,
    ] = await Promise.all([
      conta(filtroDoPeriodo("em_ferias_agora", hoje)),
      conta(filtroDoPeriodo("licencas_afastamentos", hoje)),
      conta(filtroDoPeriodo("faltas_mes", hoje)),
      conta(filtroDoPeriodo("proximas_ferias", hoje)),
      conta({ status: "aguardando_rh" }),
    ]);
    return {
      emFeriasAgora,
      licencasEAfastamentos,
      faltasEsteMes,
      proximasFerias,
      pendentes,
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
    if (erros.length > 0) throw new CamposRecusadosException(erros);

    const aprovada = dto.tipo === "afastamento" || dto.aprovada;
    const linha = await this.prisma.$transaction(async (tx) => {
      // Um registro por vez para a mesma pessoa: a sobreposição e o saldo
      // são conferidos sem corrida com outra aba.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ausencia:${dto.colaboradorId}:${empresaId}`}))`;
      const existentes = await tx.ausencia.findMany({
        where: {
          colaboradorId: dto.colaboradorId,
          empresaId,
          status: { in: [...STATUS_QUE_OCUPAM] },
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
          if (vendidos > maxVendaveis(periodo.direito)) {
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
      return criada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos);
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
        where: { id: ausenciaId, empresaId },
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
      const destino = proximoStatus(atual.status, decisao);
      if (destino === null) throw new ConflictException();
      if (destino === atual.status) return atual;
      const atualizada = await tx.ausencia.update({
        where: { id: atual.id },
        data: {
          status: destino,
          decididoPorId: ctx.actor.id,
          decididoEm: new Date(),
          ...(decisao === "recusar" ? { motivoDecisao: motivo ?? null } : {}),
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
      return atualizada;
    });
    const fotos = await this.fotos(empresaId, [linha.colaboradorId]);
    return paraApi(linha, fotos);
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
    };
    if (query.tipo !== "ferias" || !fim || regraDeFerias !== "calculada") {
      return {
        ...base,
        periodo: null,
        saldoAntes: null,
        saldoDepois: null,
        maxVendaveis: null,
        prazoAbono: null,
      };
    }
    const existentes = await this.prisma.ausencia.findMany({
      where: {
        colaboradorId: query.colaboradorId,
        empresaId,
        status: { in: [...STATUS_QUE_OCUPAM] },
      },
    });
    const hoje = hojeEmSaoPaulo();
    const periodos = this.periodosDoVinculo(
      principal,
      existentes.map(paraSaldo),
      hoje,
      query.inicio > hoje ? query.inicio : hoje,
    );
    const periodo = periodoParaFerias(
      periodos,
      query.inicio,
      query.periodoAquisitivoInicio ?? null,
    );
    const usados = base.dias! + (query.diasVendidos ?? 0);
    if (!periodo) {
      return {
        ...base,
        periodo: null,
        saldoAntes: 0,
        saldoDepois: -usados,
        maxVendaveis: 0,
        prazoAbono: null,
      };
    }
    return {
      ...base,
      periodo: { inicio: periodo.inicio, fim: periodo.fim },
      saldoAntes: periodo.disponiveis,
      saldoDepois: periodo.disponiveis - usados,
      maxVendaveis: maxVendaveis(periodo.direito),
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
      where: { colaboradorId, empresaId },
      include: INCLUSAO,
      orderBy: [{ inicio: "desc" }, { criadoEm: "desc" }],
    });
    const hoje = hojeEmSaoPaulo();
    const regraDeFerias = regraDeFeriasDoTipo(principal.tipo);
    const periodos =
      regraDeFerias === "calculada"
        ? this.periodosDoVinculo(principal, linhas.map(paraSaldo), hoje, hoje)
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
    const disponivel = periodos.findIndex(
      (p) => p.situacao === "disponivel" && p.disponiveis > 0,
    );
    const periodoAtual =
      disponivel >= 0
        ? disponivel
        : periodos.length > 0
          ? periodos.length - 1
          : null;
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
      proximaAusencia: proxima ? paraApi(proxima, fotos) : null,
      historico: linhas.map((l) => paraApi(l, fotos)),
    };
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

function paraApi(
  linha: LinhaDeAusencia,
  fotos: Map<string, { versao: number }>,
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
    status: linha.status,
    observacao: linha.observacao,
    registradoEm: linha.criadoEm.toISOString(),
    decididoEm: linha.decididoEm ? linha.decididoEm.toISOString() : null,
    anexo: linha.anexos[0]
      ? {
          formato: linha.anexos[0].formato,
          tamanhoBytes: linha.anexos[0].tamanhoBytes,
          enviadoEm: linha.anexos[0].criadoEm.toISOString(),
        }
      : null,
  };
}
