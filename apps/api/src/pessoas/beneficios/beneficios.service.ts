import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, TipoVinculo } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  CamposRecusadosException,
  type ErroDeCampo,
} from "../../common/erros/recusa-por-campo";
import { PessoasAuditoriaService } from "../pessoas-auditoria.service";
import { PessoasAuditContext } from "../pessoas.types";
import { diaDe, hojeEmSaoPaulo } from "../ausencias/calculo-ausencias";
import {
  type AjusteDoMes,
  type CalculoDaPessoa,
  type RegrasDoBeneficio,
  calcularPessoa,
  limitePat,
  regrasAns,
} from "./calculo-beneficios";
import { diasPeloModelo, diasUteisDoMes } from "./dias-beneficio";
import {
  type BeneficioConferido,
  type BeneficioInformado,
  conferirBeneficio,
} from "./regras-beneficio";

/**
 * T215 — Benefícios da empresa ativa (como a referência, 2026-11-26): lista
 * por competência, prévia do cálculo (assistente), criar, editar, detalhe
 * por competência com o valor de cada pessoa, valores digitados no mês,
 * alteração em massa, pessoas, dependentes no plano, pausar, encerrar,
 * reativar, excluir (lógico), duplicar, histórico e o resumo da ficha.
 *
 * Sem módulo de Folha no Evolli: toda competência é "valores previstos"; as
 * regras atuais valem para todas as competências (o histórico registra a
 * partir de quando cada mudança foi pedida).
 *
 * `rh` e `dp` operam; o `master_tecnico` só lê; os demais papéis são negados
 * pelo guard. A trilha leva só ação, recurso (id) e empresa.
 */

export type Competencia = string; // AAAA-MM

export interface BeneficioApi {
  id: string;
  nome: string;
  categoria: BeneficioConferido["categoria"];
  folha: BeneficioConferido["folha"];
  tipoValor: BeneficioConferido["tipoValor"];
  inicio: string;
  fim: string | null;
  observacao: string | null;
  regras: RegrasDoBeneficio;
  situacao: "ativo" | "pausado" | "encerrado";
  suspensoAPartirDe: Competencia | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PessoaDoBeneficioApi extends CalculoDaPessoa {
  colaboradorId: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  departamentoId: string | null;
  contrato: TipoVinculo;
  escala: string | null;
  planoId: string | null;
  valorIndividual: number | null;
  ajustado: boolean;
  dependentesCadastrados: number;
  desligado: boolean;
}

export interface TotaisApi {
  pessoas: number;
  comPendencia: number;
  dependentes: number;
  valor: number;
  empresa: number;
  desconto: number;
  adicional: number;
}

export interface DetalheDoBeneficioApi {
  beneficio: BeneficioApi;
  competencia: Competencia;
  diasUteis: number;
  totais: TotaisApi;
  pessoas: PessoaDoBeneficioApi[];
  historico: number;
}

export interface LinhaDaListaApi {
  id: string;
  nome: string;
  categoria: BeneficioConferido["categoria"];
  situacao: "ativo" | "pausado" | "encerrado";
  suspensoAPartirDe: Competencia | null;
  pessoas: number;
  empresa: number;
  desconto: number;
}

export interface ListaDeBeneficiosApi {
  competencia: Competencia;
  beneficios: LinhaDaListaApi[];
}

export interface PreviaApi {
  competencia: Competencia;
  diasUteis: number;
  exemplo: CalculoDaPessoa;
  exemplosVt: {
    rotulo: string;
    salario: number | null;
    calculo: CalculoDaPessoa;
  }[];
  ans: ReturnType<typeof regrasAns>;
  pat: ReturnType<typeof limitePat>;
  pessoas: PessoaDoBeneficioApi[];
  totais: TotaisApi;
}

export interface FichaDeBeneficiosApi {
  competencia: Competencia;
  salarioBruto: number | null;
  beneficios: {
    id: string;
    nome: string;
    categoria: BeneficioConferido["categoria"];
    situacao: "ativo" | "pausado" | "encerrado";
    valor: number;
    empresa: number;
    desconto: number;
    adicional: number;
    pendencia: CalculoDaPessoa["pendencia"];
  }[];
}

export interface HistoricoApi {
  itens: {
    id: string;
    tipo: string;
    aPartirDe: Competencia;
    descricao: string;
    criadoEm: string;
  }[];
}

/** A pessoa como o cálculo a enxerga no mês. */
interface PessoaCarregada {
  colaboradorId: string;
  nome: string;
  tipo: TipoVinculo;
  situacao: string;
  cargo: string | null;
  departamento: string | null;
  departamentoId: string | null;
  unidadeId: string | null;
  salarioBase: number | null;
  nascimento: string | null;
  escala: string | null;
  diasPublicados: number | null;
  dependentesCadastrados: number;
}

type LinhaBeneficio = Prisma.BeneficioGetPayload<object>;

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export const SALARIO_MINIMO_2026 = 1621;

export function competenciaAtual(): Competencia {
  return hojeEmSaoPaulo().slice(0, 7);
}

/** `AAAA-MM` → a data do 1º dia. */
export function inicioDa(competencia: Competencia): Date {
  return new Date(`${competencia}-01T00:00:00Z`);
}

export function competenciaDe(data: Date): Competencia {
  return diaDe(data).slice(0, 7);
}

function proximaCompetencia(c: Competencia): Competencia {
  const [a, m] = c.split("-").map(Number) as [number, number];
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

function fimDoMes(c: Competencia): Date {
  return new Date(inicioDa(proximaCompetencia(c)).getTime() - 86_400_000);
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
function mesPorExtenso(c: Competencia): string {
  const [a, m] = c.split("-").map(Number) as [number, number];
  return `${MESES[m - 1]}/${a}`;
}
function mesCurto(c: Competencia): string {
  return `${c.slice(5)}/${c.slice(0, 4)}`;
}

function numero(d: Prisma.Decimal | null | undefined): number | null {
  return d === null || d === undefined ? null : Number(d);
}

function totaisDe(pessoas: readonly PessoaDoBeneficioApi[]): TotaisApi {
  return pessoas.reduce<TotaisApi>(
    (t, p) => ({
      pessoas: t.pessoas + 1,
      comPendencia: t.comPendencia + (p.pendencia ? 1 : 0),
      dependentes: t.dependentes + p.dependentesNoPlano,
      valor: t.valor + p.valor,
      empresa: t.empresa + p.empresa,
      desconto: t.desconto + p.desconto,
      adicional: t.adicional + p.adicional,
    }),
    {
      pessoas: 0,
      comPendencia: 0,
      dependentes: 0,
      valor: 0,
      empresa: 0,
      desconto: 0,
      adicional: 0,
    },
  );
}

/** O benefício está nas folhas da competência? */
function ativoNa(b: LinhaBeneficio, c: Competencia): boolean {
  if (b.excluidoEm) return false;
  if (competenciaDe(b.inicio) > c) return false;
  if (b.fim && competenciaDe(b.fim) < c) return false;
  if (b.suspensoAPartirDe && competenciaDe(b.suspensoAPartirDe) <= c) {
    return false;
  }
  return true;
}

@Injectable()
export class BeneficiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PessoasAuditoriaService,
  ) {}

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

  private competencia(c: string | undefined): Competencia {
    if (c === undefined || c === "") return competenciaAtual();
    if (!COMPETENCIA.test(c)) {
      throw new CamposRecusadosException([
        { campo: "competencia", motivo: "invalido" },
      ]);
    }
    return c;
  }

  private conferir(dto: BeneficioInformado): BeneficioConferido {
    const { erros, beneficio } = conferirBeneficio(dto);
    if (!beneficio) throw new CamposRecusadosException(erros);
    return beneficio;
  }

  // ---------------------------------------------------------------- carga

  /**
   * As pessoas (por colaborador) com o que o cálculo pede no mês: contrato,
   * salário vigente, nascimento, escala (publicada ou do cadastro),
   * lotação. Sem `ids`: as ativas da empresa (e as desligadas, se pedido).
   */
  private async carregarPessoas(
    db: Prisma.TransactionClient,
    empresaId: string,
    c: Competencia,
    ids: readonly string[] | null,
    incluirDesligados = false,
  ): Promise<Map<string, PessoaCarregada>> {
    const inicio = inicioDa(c);
    const fim = fimDoMes(c);
    const vinculos = await db.vinculoFuncional.findMany({
      where: {
        empresaId,
        ...(ids
          ? { colaboradorId: { in: [...ids] } }
          : {
              situacao: incluirDesligados
                ? { in: ["ativo", "encerrado"] }
                : "ativo",
            }),
      },
      select: {
        tipo: true,
        situacao: true,
        colaborador: { select: { id: true, nome: true } },
        contrato: { select: { salarioBruto: true, escala: true } },
        alocacoes: {
          where: { vigenteAte: null },
          select: {
            departamentoId: true,
            unidadeOrganizacionalId: true,
            departamento: { select: { nome: true } },
            cargo: { select: { nome: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ colaborador: { nome: "asc" } }, { dataAdmissao: "desc" }],
    });
    const mapa = new Map<string, PessoaCarregada>();
    for (const v of vinculos) {
      if (mapa.has(v.colaborador.id)) continue;
      const alocacao = v.alocacoes[0];
      mapa.set(v.colaborador.id, {
        colaboradorId: v.colaborador.id,
        nome: v.colaborador.nome,
        tipo: v.tipo,
        situacao: v.situacao,
        cargo: alocacao?.cargo?.nome ?? null,
        departamento: alocacao?.departamento?.nome ?? null,
        departamentoId: alocacao?.departamentoId ?? null,
        unidadeId: alocacao?.unidadeOrganizacionalId ?? null,
        salarioBase: numero(v.contrato?.salarioBruto),
        nascimento: null,
        escala: v.contrato?.escala ?? null,
        diasPublicados: null,
        dependentesCadastrados: 0,
      });
    }
    const todos = [...mapa.keys()];
    if (todos.length === 0) return mapa;
    const [perfis, escalas, publicados, dependentes] = await Promise.all([
      db.perfilPessoalColaborador.findMany({
        where: { empresaId, colaboradorId: { in: todos } },
        select: { colaboradorId: true, dataNascimento: true },
      }),
      db.escalaColaborador.findMany({
        where: {
          empresaId,
          colaboradorId: { in: todos },
          vigenciaInicio: { lte: fim },
          OR: [{ vigenciaFim: null }, { vigenciaFim: { gt: inicio } }],
        },
        orderBy: { vigenciaInicio: "asc" },
        select: { colaboradorId: true, modelo: true },
      }),
      db.escalaDia.groupBy({
        by: ["colaboradorId", "tipo"],
        where: {
          empresaId,
          camada: "publicado",
          colaboradorId: { in: todos },
          dia: { gte: inicio, lte: fim },
        },
        _count: { _all: true },
      }),
      db.dependenteColaborador.groupBy({
        by: ["colaboradorId"],
        where: { empresaId, colaboradorId: { in: todos }, removidoEm: null },
        _count: { _all: true },
      }),
    ]);
    for (const p of perfis) {
      const pessoa = mapa.get(p.colaboradorId);
      if (pessoa && p.dataNascimento)
        pessoa.nascimento = diaDe(p.dataNascimento);
    }
    for (const e of escalas) {
      const pessoa = mapa.get(e.colaboradorId);
      if (pessoa) pessoa.escala = e.modelo; // a última vigente no mês
    }
    for (const g of publicados) {
      const pessoa = mapa.get(g.colaboradorId);
      if (!pessoa) continue;
      pessoa.diasPublicados =
        (pessoa.diasPublicados ?? 0) +
        (g.tipo === "trabalho" ? g._count._all : 0);
    }
    for (const d of dependentes) {
      const pessoa = mapa.get(d.colaboradorId);
      if (pessoa) pessoa.dependentesCadastrados = d._count._all;
    }
    return mapa;
  }

  /** UF da empresa e os feriados municipais do mês (com as unidades). */
  private async calendario(
    db: Prisma.TransactionClient,
    empresaId: string,
    c: Competencia,
  ): Promise<{
    uf: string | null;
    municipais: { data: string; unidadeIds: string[] }[];
  }> {
    const [empresa, feriados] = await Promise.all([
      db.empresa.findUnique({ where: { id: empresaId }, select: { uf: true } }),
      db.escalaFeriadoLocal.findMany({
        where: {
          empresaId,
          arquivadoEm: null,
          tipo: "municipal",
          data: { gte: inicioDa(c), lte: fimDoMes(c) },
        },
        select: { data: true, unidadeIds: true },
      }),
    ]);
    return {
      uf: empresa?.uf ?? null,
      municipais: feriados.map((f) => ({
        data: diaDe(f.data),
        unidadeIds: f.unidadeIds,
      })),
    };
  }

  /** O cálculo de cada pessoa do benefício no mês. */
  private calcularTodos(
    regras: RegrasDoBeneficio,
    c: Competencia,
    cal: {
      uf: string | null;
      municipais: { data: string; unidadeIds: string[] }[];
    },
    linhas: {
      pessoa: PessoaCarregada;
      planoId: string | null;
      valorIndividual: number | null;
      ajuste: AjusteDoMes | null;
      ajustado: boolean;
      dependentes: { nascimento: string | null }[];
    }[],
  ): PessoaDoBeneficioApi[] {
    return linhas.map(
      ({ pessoa, planoId, valorIndividual, ajuste, ajustado, dependentes }) => {
        const uteis = diasUteisDoMes(
          c,
          cal.uf,
          cal.municipais
            .filter(
              (f) =>
                f.unidadeIds.length === 0 ||
                (pessoa.unidadeId && f.unidadeIds.includes(pessoa.unidadeId)),
            )
            .map((f) => f.data),
        );
        const peloModelo = diasPeloModelo(pessoa.escala, c);
        const escala =
          pessoa.diasPublicados !== null
            ? { escala: pessoa.diasPublicados, origemEscala: "escala" as const }
            : {
                escala: peloModelo ?? uteis,
                origemEscala: "catalogo" as const,
              };
        const calculo = calcularPessoa(
          regras,
          {
            tipoVinculo: pessoa.tipo,
            salarioBase: pessoa.salarioBase,
            nascimento: pessoa.nascimento,
            dependentes,
            dias: { uteis, ...escala },
            planoId,
            valorIndividual,
            ajuste,
          },
          c,
        );
        return {
          ...calculo,
          colaboradorId: pessoa.colaboradorId,
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          departamento: pessoa.departamento,
          departamentoId: pessoa.departamentoId,
          contrato: pessoa.tipo,
          escala: pessoa.escala,
          planoId,
          valorIndividual,
          ajustado,
          dependentesCadastrados: pessoa.dependentesCadastrados,
          desligado: pessoa.situacao === "encerrado",
        };
      },
    );
  }

  /** As pessoas do benefício no mês, calculadas. */
  private async pessoasDoBeneficio(
    db: Prisma.TransactionClient,
    b: LinhaBeneficio,
    c: Competencia,
    apenas?: readonly string[],
  ): Promise<PessoaDoBeneficioApi[]> {
    const inicio = inicioDa(c);
    const vinculos = await db.beneficioPessoa.findMany({
      where: {
        beneficioId: b.id,
        removidoEm: null,
        aPartirDe: { lte: inicio },
        OR: [{ ate: null }, { ate: { gt: inicio } }],
        ...(apenas ? { colaboradorId: { in: [...apenas] } } : {}),
      },
    });
    if (vinculos.length === 0) return [];
    const ids = vinculos.map((v) => v.colaboradorId);
    const [pessoas, cal, ajustes, deps] = await Promise.all([
      this.carregarPessoas(db, b.empresaId, c, ids),
      this.calendario(db, b.empresaId, c),
      db.beneficioAjuste.findMany({
        where: {
          beneficioId: b.id,
          competencia: inicio,
          colaboradorId: { in: ids },
        },
      }),
      db.beneficioDependente.findMany({
        where: {
          beneficioId: b.id,
          colaboradorId: { in: ids },
          aPartirDe: { lte: inicio },
          OR: [{ ate: null }, { ate: { gt: inicio } }],
          dependente: { removidoEm: null },
        },
        select: {
          colaboradorId: true,
          dependente: { select: { dataNascimento: true } },
        },
      }),
    ]);
    const regras = b.regras as unknown as RegrasDoBeneficio;
    const linhas = vinculos
      .map((v) => {
        const pessoa = pessoas.get(v.colaboradorId);
        if (!pessoa) return null;
        const a = ajustes.find((x) => x.colaboradorId === v.colaboradorId);
        return {
          pessoa,
          planoId: v.planoId,
          valorIndividual: numero(v.valorIndividual),
          ajuste: a
            ? {
                dias: a.dias,
                valorDia: numero(a.valorDia),
                valorMes: numero(a.valorMes),
                coparticipacao: numero(a.coparticipacao),
                antecipado: numero(a.antecipado),
              }
            : null,
          ajustado:
            !!a &&
            (a.dias !== null || a.valorDia !== null || a.valorMes !== null),
          dependentes: deps
            .filter((d) => d.colaboradorId === v.colaboradorId)
            .map((d) => ({
              nascimento: d.dependente.dataNascimento
                ? diaDe(d.dependente.dataNascimento)
                : null,
            })),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .sort((x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome, "pt-BR"));
    return this.calcularTodos(regras, c, cal, linhas);
  }

  private paraApi(b: LinhaBeneficio): BeneficioApi {
    return {
      id: b.id,
      nome: b.nome,
      categoria: b.categoria,
      folha: b.folha,
      tipoValor: b.tipoValor,
      inicio: diaDe(b.inicio),
      fim: b.fim ? diaDe(b.fim) : null,
      observacao: b.observacao,
      regras: b.regras as unknown as RegrasDoBeneficio,
      situacao: b.situacao,
      suspensoAPartirDe: b.suspensoAPartirDe
        ? competenciaDe(b.suspensoAPartirDe)
        : null,
      criadoEm: b.criadoEm.toISOString(),
      atualizadoEm: b.atualizadoEm.toISOString(),
    };
  }

  private async obterLinha(
    db: Prisma.TransactionClient,
    id: string,
    empresaId: string,
    ctx: PessoasAuditContext,
  ): Promise<LinhaBeneficio> {
    const b = await db.beneficio.findFirst({
      where: { id, empresaId, excluidoEm: null },
    });
    if (!b) return this.auditoria.negarAcesso(ctx, "beneficio", id, empresaId);
    return b;
  }

  private async historico(
    tx: Prisma.TransactionClient,
    b: { id: string; empresaId: string },
    tipo: string,
    aPartirDe: Competencia,
    descricao: string,
    ctx: PessoasAuditContext,
  ): Promise<void> {
    await tx.beneficioHistorico.create({
      data: {
        beneficioId: b.id,
        empresaId: b.empresaId,
        tipo,
        aPartirDe: inicioDa(aPartirDe),
        descricao: descricao.slice(0, 300),
        criadoPorId: ctx.actor.id,
      },
    });
  }

  // ---------------------------------------------------------------- leitura

  async listar(
    competencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<ListaDeBeneficiosApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const c = this.competencia(competencia);
    const beneficios = await this.prisma.beneficio.findMany({
      where: { empresaId, excluidoEm: null },
      orderBy: { criadoEm: "asc" },
    });
    const linhas: LinhaDaListaApi[] = [];
    for (const b of beneficios) {
      const pessoas = ativoNa(b, c)
        ? await this.pessoasDoBeneficio(this.prisma, b, c)
        : [];
      const t = totaisDe(pessoas);
      linhas.push({
        id: b.id,
        nome: b.nome,
        categoria: b.categoria,
        situacao: b.situacao,
        suspensoAPartirDe: b.suspensoAPartirDe
          ? competenciaDe(b.suspensoAPartirDe)
          : null,
        pessoas: ativoNa(b, c)
          ? t.pessoas
          : await this.prisma.beneficioPessoa.count({
              where: { beneficioId: b.id, removidoEm: null },
            }),
        empresa: t.empresa,
        desconto: t.desconto,
      });
    }
    return { competencia: c, beneficios: linhas };
  }

  /**
   * A prévia do assistente: o exemplo por pessoa (etapa Valores), os
   * exemplos do vale-transporte, as regras da ANS e do PAT, e cada pessoa
   * ativa calculada como se recebesse (etapa Colaboradores).
   */
  async previa(
    dto: BeneficioInformado & {
      competencia?: string;
      incluirDesligados?: boolean;
    },
    ctx: PessoasAuditContext,
  ): Promise<PreviaApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const conferido = conferirBeneficio(dto);
    const regras = conferido.beneficio?.regras ?? this.regrasParciais(dto);
    const c = this.competencia(
      dto.competencia ??
        (dto.inicio && /^\d{4}-\d{2}/.test(dto.inicio)
          ? dto.inicio.slice(0, 7)
          : undefined),
    );
    const [pessoas, cal] = await Promise.all([
      this.carregarPessoas(
        this.prisma,
        empresaId,
        c,
        null,
        dto.incluirDesligados === true,
      ),
      this.calendario(this.prisma, empresaId, c),
    ]);
    const diasUteis = diasUteisDoMes(
      c,
      cal.uf,
      cal.municipais
        .filter((f) => f.unidadeIds.length === 0)
        .map((f) => f.data),
    );
    const generica = {
      tipoVinculo: "clt",
      salarioBase: SALARIO_MINIMO_2026,
      nascimento: null,
      dependentes: [],
      dias: {
        uteis: diasUteis,
        escala: diasUteis,
        origemEscala: "catalogo" as const,
      },
      planoId: regras.planos[0]?.id ?? null,
      valorIndividual: null,
      ajuste: null,
    };
    const exemplosVt =
      regras.categoria === "mobilidade"
        ? (
            [
              ["salario", SALARIO_MINIMO_2026],
              ["salario", 3200],
              ["salario", 6500],
              ["estagio", null],
              ["sem_salario", null],
            ] as const
          ).map(([rotulo, salario]) => ({
            rotulo,
            salario,
            calculo: calcularPessoa(
              regras,
              {
                ...generica,
                tipoVinculo: rotulo === "estagio" ? "estagio" : "clt",
                salarioBase:
                  rotulo === "salario"
                    ? salario
                    : rotulo === "estagio"
                      ? SALARIO_MINIMO_2026
                      : null,
              },
              c,
            ),
          }))
        : [];
    const lista = this.calcularTodos(
      regras,
      c,
      cal,
      [...pessoas.values()].map((pessoa) => ({
        pessoa,
        planoId: null,
        valorIndividual: null,
        ajuste: null,
        ajustado: false,
        dependentes: [],
      })),
    );
    return {
      competencia: c,
      diasUteis,
      exemplo: calcularPessoa(regras, generica, c),
      exemplosVt,
      ans:
        regras.tipoValor === "faixa_etaria" ? regrasAns(regras.faixas) : null,
      pat: limitePat(regras),
      pessoas: lista,
      totais: totaisDe(lista),
    };
  }

  /** Regras com os padrões, para a prévia de um formulário incompleto. */
  private regrasParciais(dto: BeneficioInformado): RegrasDoBeneficio {
    const r = (dto.regras ?? {}) as Partial<RegrasDoBeneficio>;
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    return {
      categoria: (dto.categoria as RegrasDoBeneficio["categoria"]) ?? "outros",
      folha: (dto.folha as RegrasDoBeneficio["folha"]) ?? "desconto",
      tipoValor: (dto.tipoValor as RegrasDoBeneficio["tipoValor"]) ?? "fixo",
      valorMensal: num(r.valorMensal),
      valorDia: num(r.valorDia),
      diasModo: r.diasModo === "escala" ? "escala" : "uteis",
      individualModo: r.individualModo === "plano" ? "plano" : "livre",
      planos: Array.isArray(r.planos)
        ? r.planos.filter((p) => p && typeof p.valor === "number")
        : [],
      faixas: Array.isArray(r.faixas) ? r.faixas.map((f) => num(f) ?? 0) : [],
      colaboradorPaga: {
        calculo:
          r.colaboradorPaga?.calculo === "valor" ? "valor" : "percentual",
        titular: num(r.colaboradorPaga?.titular) ?? 0,
        dependente: num(r.colaboradorPaga?.dependente) ?? 0,
      },
      coparticipacao: r.coparticipacao === true,
      quemPaga: {
        modo:
          dto.folha === "adicional"
            ? "empresa_tudo"
            : r.quemPaga?.modo === "colaborador_tudo" ||
                r.quemPaga?.modo === "empresa_tudo"
              ? r.quemPaga.modo
              : "empresa_parte",
        calculo: r.quemPaga?.calculo === "valor" ? "valor" : "percentual",
        empresa: Math.min(
          num(r.quemPaga?.empresa) ?? 0,
          r.quemPaga?.calculo === "valor" ? Infinity : 100,
        ),
      },
      vt: {
        percentualSalario: Math.min(num(r.vt?.percentualSalario) ?? 6, 6),
        empresaCusteiaTudo: r.vt?.empresaCusteiaTudo === true,
      },
      antecipacao: r.antecipacao ?? null,
    };
  }

  async obter(
    id: string,
    competencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<DetalheDoBeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const c = this.competencia(competencia);
    const b = await this.obterLinha(this.prisma, id, empresaId, ctx);
    const [pessoas, historico, cal] = await Promise.all([
      ativoNa(b, c)
        ? this.pessoasDoBeneficio(this.prisma, b, c)
        : Promise.resolve([]),
      this.prisma.beneficioHistorico.count({ where: { beneficioId: b.id } }),
      this.calendario(this.prisma, empresaId, c),
    ]);
    return {
      beneficio: this.paraApi(b),
      competencia: c,
      diasUteis: diasUteisDoMes(
        c,
        cal.uf,
        cal.municipais
          .filter((f) => f.unidadeIds.length === 0)
          .map((f) => f.data),
      ),
      totais: totaisDe(pessoas),
      pessoas,
      historico,
    };
  }

  async listarHistorico(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<HistoricoApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const b = await this.obterLinha(this.prisma, id, empresaId, ctx);
    const itens = await this.prisma.beneficioHistorico.findMany({
      where: { beneficioId: b.id },
      orderBy: { criadoEm: "desc" },
    });
    return {
      itens: itens.map((h) => ({
        id: h.id,
        tipo: h.tipo,
        aPartirDe: competenciaDe(h.aPartirDe),
        descricao: h.descricao,
        criadoEm: h.criadoEm.toISOString(),
      })),
    };
  }

  /** Quem ainda não recebe (página Adicionar pessoas), com o valor previsto. */
  async candidatos(
    id: string,
    competencia: string | undefined,
    incluirDesligados: boolean,
    ctx: PessoasAuditContext,
  ): Promise<{ competencia: Competencia; pessoas: PessoaDoBeneficioApi[] }> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const c = this.competencia(competencia);
    const b = await this.obterLinha(this.prisma, id, empresaId, ctx);
    const ja = new Set(
      (
        await this.prisma.beneficioPessoa.findMany({
          where: { beneficioId: b.id, removidoEm: null },
          select: { colaboradorId: true },
        })
      ).map((v) => v.colaboradorId),
    );
    const [pessoas, cal] = await Promise.all([
      this.carregarPessoas(this.prisma, empresaId, c, null, incluirDesligados),
      this.calendario(this.prisma, empresaId, c),
    ]);
    const lista = this.calcularTodos(
      b.regras as unknown as RegrasDoBeneficio,
      c,
      cal,
      [...pessoas.values()]
        .filter((p) => !ja.has(p.colaboradorId))
        .map((pessoa) => ({
          pessoa,
          planoId: null,
          valorIndividual: null,
          ajuste: null,
          ajustado: false,
          dependentes: [],
        })),
    );
    return { competencia: c, pessoas: lista };
  }

  /** O resumo da aba Benefícios da ficha. */
  async daFicha(
    colaboradorId: string,
    competencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<FichaDeBeneficiosApi> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const c = this.competencia(competencia);
    const vinculo = await this.prisma.vinculoFuncional.findFirst({
      where: { colaboradorId, empresaId },
      orderBy: { dataAdmissao: "desc" },
      select: { contrato: { select: { salarioBruto: true } } },
    });
    if (!vinculo) {
      return this.auditoria.negarAcesso(
        ctx,
        "beneficio",
        colaboradorId,
        empresaId,
      );
    }
    const ligados = await this.prisma.beneficioPessoa.findMany({
      where: {
        colaboradorId,
        empresaId,
        removidoEm: null,
        beneficio: { excluidoEm: null },
      },
      select: { beneficio: true },
    });
    const beneficios: FichaDeBeneficiosApi["beneficios"] = [];
    for (const { beneficio: b } of ligados) {
      if (!ativoNa(b, c)) continue;
      const [p] = await this.pessoasDoBeneficio(this.prisma, b, c, [
        colaboradorId,
      ]);
      if (!p) continue;
      beneficios.push({
        id: b.id,
        nome: b.nome,
        categoria: b.categoria,
        situacao: b.situacao,
        valor: p.valor,
        empresa: p.empresa,
        desconto: p.desconto,
        adicional: p.adicional,
        pendencia: p.pendencia,
      });
    }
    beneficios.sort(
      (a, b) => b.empresa - a.empresa || a.nome.localeCompare(b.nome, "pt-BR"),
    );
    return {
      competencia: c,
      salarioBruto: numero(vinculo.contrato?.salarioBruto),
      beneficios,
    };
  }

  // ---------------------------------------------------------------- escrita

  private async conferirPessoas(
    tx: Prisma.TransactionClient,
    empresaId: string,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const encontrados = await tx.vinculoFuncional.findMany({
      where: { empresaId, colaboradorId: { in: [...ids] } },
      select: { colaboradorId: true },
      distinct: ["colaboradorId"],
    });
    if (encontrados.length !== new Set(ids).size) {
      throw new CamposRecusadosException([
        { campo: "pessoas", motivo: "indisponivel" },
      ]);
    }
  }

  async criar(
    dto: BeneficioInformado & {
      pessoas?: {
        colaboradorId: string;
        planoId?: string | null;
        valorIndividual?: number | null;
      }[];
    },
    ctx: PessoasAuditContext,
  ): Promise<BeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const b = this.conferir(dto);
    const pessoas = dto.pessoas ?? [];
    const aPartirDe = b.inicio.slice(0, 7);
    const criado = await this.prisma.$transaction(async (tx) => {
      await this.conferirPessoas(
        tx,
        empresaId,
        pessoas.map((p) => p.colaboradorId),
      );
      const linha = await tx.beneficio.create({
        data: {
          empresaId,
          nome: b.nome,
          categoria: b.categoria,
          folha: b.folha,
          tipoValor: b.tipoValor,
          inicio: new Date(`${b.inicio}T00:00:00Z`),
          fim: b.fim ? new Date(`${b.fim}T00:00:00Z`) : null,
          observacao: b.observacao,
          regras: b.regras as unknown as Prisma.InputJsonValue,
          criadoPorId: ctx.actor.id,
        },
      });
      for (const p of pessoas) {
        await tx.beneficioPessoa.create({
          data: {
            beneficioId: linha.id,
            empresaId,
            colaboradorId: p.colaboradorId,
            aPartirDe: inicioDa(aPartirDe),
            planoId: this.planoValido(b.regras, p.planoId),
            valorIndividual: p.valorIndividual ?? null,
            criadoPorId: ctx.actor.id,
          },
        });
      }
      await this.historico(
        tx,
        linha,
        "criado",
        aPartirDe,
        `Benefício criado com ${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_criado",
        "beneficio",
        linha.id,
        empresaId,
      );
      return linha;
    });
    return this.paraApi(criado);
  }

  private planoValido(
    regras: RegrasDoBeneficio,
    planoId: string | null | undefined,
  ): string | null {
    if (!planoId) return null;
    if (!regras.planos.some((p) => p.id === planoId)) {
      throw new CamposRecusadosException([
        { campo: "regras.planos", motivo: "indisponivel" },
      ]);
    }
    return planoId;
  }

  async alterar(
    id: string,
    dto: BeneficioInformado & { aPartirDe?: string },
    ctx: PessoasAuditContext,
  ): Promise<BeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const b = this.conferir(dto);
    const aPartirDe = this.competencia(dto.aPartirDe);
    const linha = await this.prisma.$transaction(async (tx) => {
      const atual = await this.obterLinha(tx, id, empresaId, ctx);
      const alterada = await tx.beneficio.update({
        where: { id: atual.id },
        data: {
          nome: b.nome,
          categoria: b.categoria,
          folha: b.folha,
          tipoValor: b.tipoValor,
          inicio: new Date(`${b.inicio}T00:00:00Z`),
          fim: b.fim ? new Date(`${b.fim}T00:00:00Z`) : null,
          observacao: b.observacao,
          regras: b.regras as unknown as Prisma.InputJsonValue,
        },
      });
      await this.historico(
        tx,
        alterada,
        "configuracao",
        aPartirDe,
        "Configuração do benefício alterada.",
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_alterado",
        "beneficio",
        alterada.id,
        empresaId,
      );
      return alterada;
    });
    return this.paraApi(linha);
  }

  async adicionarPessoas(
    id: string,
    dto: {
      aPartirDe: string;
      pessoas: {
        colaboradorId: string;
        planoId?: string | null;
        valorIndividual?: number | null;
      }[];
    },
    ctx: PessoasAuditContext,
  ): Promise<{ adicionadas: number }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const aPartirDe = this.competencia(dto.aPartirDe);
    if (dto.pessoas.length === 0) {
      throw new CamposRecusadosException([
        { campo: "pessoas", motivo: "obrigatorio" },
      ]);
    }
    return this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      const ids = dto.pessoas.map((p) => p.colaboradorId);
      await this.conferirPessoas(tx, empresaId, ids);
      const ja = await tx.beneficioPessoa.count({
        where: {
          beneficioId: b.id,
          removidoEm: null,
          colaboradorId: { in: ids },
        },
      });
      if (ja > 0) {
        throw new CamposRecusadosException([
          { campo: "pessoas", motivo: "ja_recebe" },
        ]);
      }
      const regras = b.regras as unknown as RegrasDoBeneficio;
      for (const p of dto.pessoas) {
        await tx.beneficioPessoa.create({
          data: {
            beneficioId: b.id,
            empresaId,
            colaboradorId: p.colaboradorId,
            aPartirDe: inicioDa(aPartirDe),
            planoId: this.planoValido(regras, p.planoId),
            valorIndividual: p.valorIndividual ?? null,
            criadoPorId: ctx.actor.id,
          },
        });
      }
      const n = dto.pessoas.length;
      await this.historico(
        tx,
        b,
        "pessoas",
        aPartirDe,
        `${n} ${n === 1 ? "pessoa adicionada" : "pessoas adicionadas"} ao benefício.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_pessoas_alteradas",
        "beneficio",
        b.id,
        empresaId,
      );
      return { adicionadas: n };
    });
  }

  async removerPessoa(
    id: string,
    colaboradorId: string,
    ctx: PessoasAuditContext,
  ): Promise<{ removida: true }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    return this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      const v = await tx.beneficioPessoa.findFirst({
        where: { beneficioId: b.id, colaboradorId, removidoEm: null },
      });
      if (!v)
        return this.auditoria.negarAcesso(ctx, "beneficio", b.id, empresaId);
      await tx.beneficioPessoa.update({
        where: { id: v.id },
        data: { removidoEm: new Date() },
      });
      await this.historico(
        tx,
        b,
        "pessoas",
        competenciaAtual(),
        "1 pessoa removida do benefício.",
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_pessoas_alteradas",
        "beneficio",
        b.id,
        empresaId,
      );
      return { removida: true as const };
    });
  }

  /** "Salvar valores": o que foi digitado no mês e o plano ou valor de cada pessoa. */
  async salvarValores(
    id: string,
    dto: {
      competencia: string;
      linhas: {
        colaboradorId: string;
        dias?: number | null;
        valorDia?: number | null;
        valorMes?: number | null;
        coparticipacao?: number | null;
        antecipado?: number | null;
        planoId?: string | null;
        valorIndividual?: number | null;
      }[];
    },
    ctx: PessoasAuditContext,
  ): Promise<{ alteradas: number }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const c = this.competencia(dto.competencia);
    return this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      const regras = b.regras as unknown as RegrasDoBeneficio;
      for (const l of dto.linhas) {
        const v = await tx.beneficioPessoa.findFirst({
          where: {
            beneficioId: b.id,
            colaboradorId: l.colaboradorId,
            removidoEm: null,
          },
        });
        if (!v)
          throw new CamposRecusadosException([
            { campo: "pessoas", motivo: "indisponivel" },
          ]);
        if (l.planoId !== undefined || l.valorIndividual !== undefined) {
          await tx.beneficioPessoa.update({
            where: { id: v.id },
            data: {
              ...(l.planoId !== undefined
                ? { planoId: this.planoValido(regras, l.planoId) }
                : {}),
              ...(l.valorIndividual !== undefined
                ? { valorIndividual: l.valorIndividual }
                : {}),
            },
          });
        }
        const campos = {
          ...(l.dias !== undefined ? { dias: l.dias } : {}),
          ...(l.valorDia !== undefined ? { valorDia: l.valorDia } : {}),
          ...(l.valorMes !== undefined ? { valorMes: l.valorMes } : {}),
          ...(l.coparticipacao !== undefined
            ? { coparticipacao: l.coparticipacao }
            : {}),
          ...(l.antecipado !== undefined ? { antecipado: l.antecipado } : {}),
        };
        if (Object.keys(campos).length === 0) continue;
        await tx.beneficioAjuste.upsert({
          where: {
            beneficioId_colaboradorId_competencia: {
              beneficioId: b.id,
              colaboradorId: l.colaboradorId,
              competencia: inicioDa(c),
            },
          },
          create: {
            beneficioId: b.id,
            empresaId,
            colaboradorId: l.colaboradorId,
            competencia: inicioDa(c),
            ...campos,
            atualizadoPorId: ctx.actor.id,
          },
          update: { ...campos, atualizadoPorId: ctx.actor.id },
        });
      }
      const n = dto.linhas.length;
      await this.historico(
        tx,
        b,
        "valores",
        c,
        `Valores de ${mesCurto(c)} alterados para ${n} ${n === 1 ? "pessoa" : "pessoas"}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_valores_alterados",
        "beneficio",
        b.id,
        empresaId,
      );
      return { alteradas: n };
    });
  }

  /**
   * "Alterar valor por dia": para todas as pessoas, as selecionadas ou por
   * escala ou departamento; novo valor, reajuste em %, dias no mês ou os
   * dois; só no mês (valores digitados) ou daqui em diante (muda a regra,
   * para todas as pessoas).
   */
  async alterarEmLote(
    id: string,
    dto: {
      competencia: string;
      para: "todos" | "selecionados" | "grupo";
      colaboradorIds?: string[];
      escalas?: string[];
      departamentoIds?: string[];
      valorDia?: number | null;
      reajustePercentual?: number | null;
      dias?: number | null;
      duracao: "mes" | "em_diante";
    },
    ctx: PessoasAuditContext,
  ): Promise<{ alteradas: number }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const c = this.competencia(dto.competencia);
    const erros: ErroDeCampo[] = [];
    const temValor = dto.valorDia != null || dto.reajustePercentual != null;
    if (!temValor && dto.dias == null)
      erros.push({ campo: "regras.valorDia", motivo: "obrigatorio" });
    if (
      dto.duracao === "em_diante" &&
      (dto.para !== "todos" || dto.dias != null)
    ) {
      erros.push({ campo: "aPartirDe", motivo: "nao_se_aplica" });
    }
    if (erros.length) throw new CamposRecusadosException(erros);
    return this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      const regras = b.regras as unknown as RegrasDoBeneficio;
      if (regras.tipoValor !== "dia_util") {
        throw new CamposRecusadosException([
          { campo: "tipoValor", motivo: "nao_se_aplica" },
        ]);
      }
      const base = regras.valorDia ?? 0;
      const novoValor =
        dto.valorDia != null
          ? dto.valorDia
          : dto.reajustePercentual != null
            ? Math.round(base * (1 + dto.reajustePercentual / 100) * 100) / 100
            : null;
      if (dto.duracao === "em_diante") {
        await tx.beneficio.update({
          where: { id: b.id },
          data: {
            regras: {
              ...regras,
              valorDia: novoValor,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        await this.historico(
          tx,
          b,
          "valores",
          c,
          `Valor por dia alterado de ${base.toFixed(2).replace(".", ",")} para ${(novoValor ?? base).toFixed(2).replace(".", ",")} a partir de ${mesCurto(c)}.`,
          ctx,
        );
        await this.auditoria.registrarMutacao(
          tx,
          ctx,
          "pessoas_beneficio_alterado",
          "beneficio",
          b.id,
          empresaId,
        );
        const todos = await tx.beneficioPessoa.count({
          where: { beneficioId: b.id, removidoEm: null },
        });
        return { alteradas: todos };
      }
      let alvos = await this.pessoasDoBeneficio(tx, b, c);
      if (dto.para === "selecionados") {
        const ids = new Set(dto.colaboradorIds ?? []);
        alvos = alvos.filter((p) => ids.has(p.colaboradorId));
      } else if (dto.para === "grupo") {
        const escalas = new Set(dto.escalas ?? []);
        const deps = new Set(dto.departamentoIds ?? []);
        alvos = alvos.filter(
          (p) =>
            (p.escala && escalas.has(p.escala)) ||
            (p.departamentoId && deps.has(p.departamentoId)),
        );
      }
      if (alvos.length === 0) {
        throw new CamposRecusadosException([
          { campo: "pessoas", motivo: "obrigatorio" },
        ]);
      }
      for (const p of alvos) {
        const campos = {
          ...(novoValor != null ? { valorDia: novoValor } : {}),
          ...(dto.dias != null ? { dias: dto.dias } : {}),
        };
        await tx.beneficioAjuste.upsert({
          where: {
            beneficioId_colaboradorId_competencia: {
              beneficioId: b.id,
              colaboradorId: p.colaboradorId,
              competencia: inicioDa(c),
            },
          },
          create: {
            beneficioId: b.id,
            empresaId,
            colaboradorId: p.colaboradorId,
            competencia: inicioDa(c),
            ...campos,
            atualizadoPorId: ctx.actor.id,
          },
          update: { ...campos, atualizadoPorId: ctx.actor.id },
        });
      }
      const n = alvos.length;
      await this.historico(
        tx,
        b,
        "valores",
        c,
        `Valores de ${mesCurto(c)} alterados para ${n} ${n === 1 ? "pessoa" : "pessoas"}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_valores_alterados",
        "beneficio",
        b.id,
        empresaId,
      );
      return { alteradas: n };
    });
  }

  /** Dependentes no plano (faixa etária), a partir de uma competência. */
  async dependentesNoPlano(
    id: string,
    colaboradorId: string,
    dto: { dependenteIds: string[]; aPartirDe: string },
    ctx: PessoasAuditContext,
  ): Promise<{ noPlano: number }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const c = this.competencia(dto.aPartirDe);
    const inicio = inicioDa(c);
    return this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      if (b.tipoValor !== "faixa_etaria") {
        throw new CamposRecusadosException([
          { campo: "dependenteIds", motivo: "nao_se_aplica" },
        ]);
      }
      const v = await tx.beneficioPessoa.findFirst({
        where: { beneficioId: b.id, colaboradorId, removidoEm: null },
      });
      if (!v)
        return this.auditoria.negarAcesso(ctx, "beneficio", b.id, empresaId);
      const validos = await tx.dependenteColaborador.findMany({
        where: {
          empresaId,
          colaboradorId,
          removidoEm: null,
          id: { in: dto.dependenteIds },
        },
        select: { id: true },
      });
      if (validos.length !== new Set(dto.dependenteIds).size) {
        throw new CamposRecusadosException([
          { campo: "dependenteIds", motivo: "indisponivel" },
        ]);
      }
      const vigentes = await tx.beneficioDependente.findMany({
        where: {
          beneficioId: b.id,
          colaboradorId,
          OR: [{ ate: null }, { ate: { gt: inicio } }],
        },
      });
      const querer = new Set(dto.dependenteIds);
      for (const d of vigentes) {
        if (querer.has(d.dependenteId)) {
          querer.delete(d.dependenteId);
          continue;
        }
        // Sai do plano a partir da competência; se entraria depois, o
        // intervalo fica vazio (ate = a partir de).
        await tx.beneficioDependente.update({
          where: { id: d.id },
          data: { ate: d.aPartirDe >= inicio ? d.aPartirDe : inicio },
        });
      }
      for (const dependenteId of querer) {
        await tx.beneficioDependente.create({
          data: {
            beneficioId: b.id,
            empresaId,
            colaboradorId,
            dependenteId,
            aPartirDe: inicio,
          },
        });
      }
      const n = dto.dependenteIds.length;
      await this.historico(
        tx,
        b,
        "dependentes",
        c,
        `Dependentes no plano: ${n} a partir de ${mesCurto(c)}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_pessoas_alteradas",
        "beneficio",
        b.id,
        empresaId,
      );
      return { noPlano: n };
    });
  }

  /** Os dependentes da pessoa e quais estão no plano na competência. */
  async dependentesDaPessoa(
    id: string,
    colaboradorId: string,
    competencia: string | undefined,
    ctx: PessoasAuditContext,
  ): Promise<{
    dependentes: {
      id: string;
      nome: string;
      parentesco: string;
      dataNascimento: string | null;
      noPlano: boolean;
    }[];
  }> {
    const empresaId = this.empresaDaSessao(ctx, "leitura");
    const c = this.competencia(competencia);
    const inicio = inicioDa(c);
    const b = await this.obterLinha(this.prisma, id, empresaId, ctx);
    const [deps, noPlano] = await Promise.all([
      this.prisma.dependenteColaborador.findMany({
        where: { empresaId, colaboradorId, removidoEm: null },
        orderBy: { nome: "asc" },
      }),
      this.prisma.beneficioDependente.findMany({
        where: {
          beneficioId: b.id,
          colaboradorId,
          aPartirDe: { lte: inicio },
          OR: [{ ate: null }, { ate: { gt: inicio } }],
        },
        select: { dependenteId: true },
      }),
    ]);
    const marcados = new Set(noPlano.map((d) => d.dependenteId));
    return {
      dependentes: deps.map((d) => ({
        id: d.id,
        nome: d.nome,
        parentesco: d.parentesco,
        dataNascimento: d.dataNascimento ? diaDe(d.dataNascimento) : null,
        noPlano: marcados.has(d.id),
      })),
    };
  }

  async suspender(
    id: string,
    tipo: "pausado" | "encerrado",
    aPartirDe: string,
    ctx: PessoasAuditContext,
  ): Promise<BeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const c = this.competencia(aPartirDe);
    const linha = await this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      if (b.situacao !== "ativo") {
        throw new CamposRecusadosException([
          { campo: "aPartirDe", motivo: "nao_se_aplica" },
        ]);
      }
      const alterada = await tx.beneficio.update({
        where: { id: b.id },
        data: { situacao: tipo, suspensoAPartirDe: inicioDa(c) },
      });
      await this.historico(
        tx,
        b,
        tipo === "pausado" ? "pausado" : "encerrado",
        c,
        tipo === "pausado"
          ? `Benefício pausado a partir de ${mesCurto(c)}.`
          : `Benefício encerrado a partir de ${mesCurto(c)}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        tipo === "pausado"
          ? "pessoas_beneficio_pausado"
          : "pessoas_beneficio_encerrado",
        "beneficio",
        b.id,
        empresaId,
      );
      return alterada;
    });
    return this.paraApi(linha);
  }

  async reativar(id: string, ctx: PessoasAuditContext): Promise<BeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const linha = await this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      if (b.situacao === "ativo") {
        throw new CamposRecusadosException([
          { campo: "aPartirDe", motivo: "nao_se_aplica" },
        ]);
      }
      const alterada = await tx.beneficio.update({
        where: { id: b.id },
        data: { situacao: "ativo", suspensoAPartirDe: null },
      });
      await this.historico(
        tx,
        b,
        "reativado",
        competenciaAtual(),
        "Benefício reativado.",
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_reativado",
        "beneficio",
        b.id,
        empresaId,
      );
      return alterada;
    });
    return this.paraApi(linha);
  }

  async excluir(
    id: string,
    ctx: PessoasAuditContext,
  ): Promise<{ excluido: true }> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    await this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      await tx.beneficio.update({
        where: { id: b.id },
        data: { excluidoEm: new Date(), excluidoPorId: ctx.actor.id },
      });
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_excluido",
        "beneficio",
        b.id,
        empresaId,
      );
    });
    return { excluido: true };
  }

  /** Copia as regras, sem pessoas; nome "(cópia)"; começa hoje. */
  async duplicar(id: string, ctx: PessoasAuditContext): Promise<BeneficioApi> {
    const empresaId = this.empresaDaSessao(ctx, "escrita");
    const linha = await this.prisma.$transaction(async (tx) => {
      const b = await this.obterLinha(tx, id, empresaId, ctx);
      const hoje = hojeEmSaoPaulo();
      const nome = `${b.nome} (cópia)`.slice(0, 120);
      const copia = await tx.beneficio.create({
        data: {
          empresaId,
          nome,
          categoria: b.categoria,
          folha: b.folha,
          tipoValor: b.tipoValor,
          inicio: new Date(`${hoje}T00:00:00Z`),
          fim: b.fim && diaDe(b.fim) >= hoje ? b.fim : null,
          observacao: b.observacao,
          regras: b.regras as Prisma.InputJsonValue,
          criadoPorId: ctx.actor.id,
        },
      });
      await this.historico(
        tx,
        copia,
        "criado",
        hoje.slice(0, 7),
        `Benefício duplicado de ${b.nome}.`,
        ctx,
      );
      await this.auditoria.registrarMutacao(
        tx,
        ctx,
        "pessoas_beneficio_criado",
        "beneficio",
        copia.id,
        empresaId,
      );
      return copia;
    });
    return this.paraApi(linha);
  }
}

export { mesPorExtenso };
