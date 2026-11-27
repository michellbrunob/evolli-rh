import type { ErroDeCampo } from "../../../common/erros/recusa-por-campo";
import {
  ehDiaUtil,
  somarDias,
} from "../../../pessoas/ausencias/calculo-ausencias";
import type { Identificacao } from "../../pesquisas.types";
import {
  RODADAS_AUTOMATICAS,
  type Rodada,
  type RodadaAutomatica,
} from "./definicao";

/**
 * T216 — Onboarding: o envio (agora, agendado ou automático na data de cada
 * pessoa), o público e o planejamento dos convites (funções puras).
 *
 * Automático: cada rodada (30, 60 e/ou 90 dias depois da admissão) gera um
 * convite na data da pessoa; "só em dias úteis" leva a data de sábado,
 * domingo ou feriado para o próximo dia útil. O convite é criado até 30 dias
 * antes da data (para aparecer em "Próximos") e sai no horário escolhido.
 * "Incluir quem já passou da data": quem passou há até 30 dias da ativação
 * recebe no primeiro envio. Quem entra é conferido na hora de criar o
 * convite. Tudo idempotente: um convite por pessoa e rodada.
 */

type Dia = string;

export const HORIZONTE_DIAS = 30;
export const ATRASO_MAXIMO_DIAS = 30;
export const PRAZOS = [3, 5, 7, 10, 15] as const;
export const LEMBRETES = [2, 3, 5] as const;
export const CAMPOS_DO_PUBLICO = [
  "departamento",
  "cargo",
  "unidade",
  "centroCusto",
] as const;
export type CampoDoPublico = (typeof CAMPOS_DO_PUBLICO)[number];

export type Publico =
  | { tipo: "todos" }
  | {
      tipo: "grupo";
      condicoes: {
        campo: CampoDoPublico;
        operador: "e" | "uma_destas";
        valores: string[];
      }[];
    }
  | { tipo: "pessoas"; colaboradorIds: string[] };

export interface EmailDoOnboarding {
  modelo: "padrao" | "personalizado";
  assunto: string | null;
  titulo: string | null;
  mensagem: string | null;
}

export interface ConfigOnboarding {
  modo: "agora" | "agendar" | "automatizar";
  rodadas: RodadaAutomatica[];
  /** `HH:mm`, de 06:00 a 21:00, de 30 em 30 minutos (Brasília). */
  horario: string;
  /** Agendar: o dia do envio. */
  agendadoPara: Dia | null;
  prazoDias: (typeof PRAZOS)[number];
  /** `null` = sem lembrete (sempre na anônima). */
  lembreteDias: (typeof LEMBRETES)[number] | null;
  soDiasUteis: boolean;
  incluirAtrasados: boolean;
  publico: Publico;
  email: EmailDoOnboarding;
}

export const CONFIG_PADRAO: ConfigOnboarding = {
  modo: "automatizar",
  rodadas: [30, 60],
  horario: "09:00",
  agendadoPara: null,
  prazoDias: 7,
  lembreteDias: 3,
  soDiasUteis: true,
  incluirAtrasados: false,
  publico: { tipo: "todos" },
  email: { modelo: "padrao", assunto: null, titulo: null, mensagem: null },
};

export const LIMITES_DO_EMAIL = { assunto: 80, titulo: 60, mensagem: 600 };

const HORARIO = /^(\d{2}):(\d{2})$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function horarioValido(h: unknown): h is string {
  if (typeof h !== "string") return false;
  const m = HORARIO.exec(h);
  if (!m) return false;
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  return minutos >= 6 * 60 && minutos <= 21 * 60 && Number(m[2]) % 30 === 0;
}

function diaValido(d: unknown): d is Dia {
  if (typeof d !== "string" || !DIA.test(d)) return false;
  const x = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d;
}

type Registro = Record<string, unknown>;
const ehRegistro = (v: unknown): v is Registro =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? undefined : t;
}

function conferirPublico(v: unknown): Publico | null {
  if (!ehRegistro(v)) return null;
  if (v.tipo === "todos") return { tipo: "todos" };
  if (v.tipo === "pessoas") {
    const ids = v.colaboradorIds;
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > 5000 ||
      ids.some((i) => typeof i !== "string" || !UUID.test(i)) ||
      new Set(ids).size !== ids.length
    ) {
      return null;
    }
    return { tipo: "pessoas", colaboradorIds: ids as string[] };
  }
  if (v.tipo === "grupo") {
    const cs = v.condicoes;
    if (!Array.isArray(cs) || cs.length === 0 || cs.length > 10) return null;
    const condicoes: Extract<Publico, { tipo: "grupo" }>["condicoes"] = [];
    for (const c of cs) {
      if (!ehRegistro(c)) return null;
      if (!(CAMPOS_DO_PUBLICO as readonly unknown[]).includes(c.campo)) {
        return null;
      }
      if (c.operador !== "e" && c.operador !== "uma_destas") return null;
      const valores = c.valores;
      if (
        !Array.isArray(valores) ||
        valores.length === 0 ||
        valores.some((x) => typeof x !== "string" || !UUID.test(x)) ||
        (c.operador === "e" && valores.length !== 1)
      ) {
        return null;
      }
      condicoes.push({
        campo: c.campo as CampoDoPublico,
        operador: c.operador,
        valores: [...new Set(valores as string[])],
      });
    }
    return { tipo: "grupo", condicoes };
  }
  return null;
}

/**
 * Confere a configuração do envio. Na anônima não há lembrete (não dá para
 * saber quem respondeu). Agendar exige o dia, a partir de hoje.
 */
export function conferirConfigOnboarding(
  bruto: unknown,
  identificacao: Identificacao,
  hoje: Dia,
): { config: ConfigOnboarding | null; erros: ErroDeCampo[] } {
  const c: Registro = ehRegistro(bruto) ? bruto : {};
  const erros: ErroDeCampo[] = [];
  const modo = c.modo ?? CONFIG_PADRAO.modo;
  if (modo !== "agora" && modo !== "agendar" && modo !== "automatizar") {
    erros.push({ campo: "envio", motivo: "invalido" });
  }
  const rodadas = c.rodadas ?? CONFIG_PADRAO.rodadas;
  let rodadasOk: RodadaAutomatica[] = [];
  if (
    !Array.isArray(rodadas) ||
    rodadas.some(
      (r) => !(RODADAS_AUTOMATICAS as readonly unknown[]).includes(r),
    ) ||
    new Set(rodadas).size !== rodadas.length
  ) {
    erros.push({ campo: "rodadas", motivo: "invalido" });
  } else {
    rodadasOk = [...(rodadas as RodadaAutomatica[])].sort((a, b) => a - b);
    if (modo === "automatizar" && rodadasOk.length === 0) {
      erros.push({ campo: "rodadas", motivo: "obrigatorio" });
    }
  }
  const horario = c.horario ?? CONFIG_PADRAO.horario;
  if (!horarioValido(horario)) {
    erros.push({ campo: "horario", motivo: "invalido" });
  }
  let agendadoPara: Dia | null = null;
  if (modo === "agendar") {
    if (!diaValido(c.agendadoPara)) {
      erros.push({ campo: "agendadoPara", motivo: "obrigatorio" });
    } else if (c.agendadoPara < hoje) {
      erros.push({ campo: "agendadoPara", motivo: "fora_do_prazo" });
    } else {
      agendadoPara = c.agendadoPara;
    }
  }
  const prazoDias = c.prazoDias ?? CONFIG_PADRAO.prazoDias;
  if (!(PRAZOS as readonly unknown[]).includes(prazoDias)) {
    erros.push({ campo: "prazoDias", motivo: "invalido" });
  }
  const lembreteBruto =
    c.lembreteDias === undefined ? CONFIG_PADRAO.lembreteDias : c.lembreteDias;
  if (
    lembreteBruto !== null &&
    !(LEMBRETES as readonly unknown[]).includes(lembreteBruto)
  ) {
    erros.push({ campo: "lembreteDias", motivo: "invalido" });
  }
  const soDiasUteis = c.soDiasUteis ?? CONFIG_PADRAO.soDiasUteis;
  const incluirAtrasados = c.incluirAtrasados ?? CONFIG_PADRAO.incluirAtrasados;
  if (
    typeof soDiasUteis !== "boolean" ||
    typeof incluirAtrasados !== "boolean"
  ) {
    erros.push({ campo: "envio", motivo: "invalido" });
  }
  const publico =
    c.publico === undefined
      ? CONFIG_PADRAO.publico
      : conferirPublico(c.publico);
  if (!publico) erros.push({ campo: "publico", motivo: "invalido" });

  const e: Registro = ehRegistro(c.email) ? c.email : {};
  const modeloEmail = e.modelo ?? "padrao";
  const assunto = textoOpcional(e.assunto, LIMITES_DO_EMAIL.assunto);
  const titulo = textoOpcional(e.titulo, LIMITES_DO_EMAIL.titulo);
  const mensagem = textoOpcional(e.mensagem, LIMITES_DO_EMAIL.mensagem);
  if (
    (modeloEmail !== "padrao" && modeloEmail !== "personalizado") ||
    assunto === undefined ||
    titulo === undefined ||
    mensagem === undefined ||
    (modeloEmail === "personalizado" && (!assunto || !titulo || !mensagem))
  ) {
    erros.push({ campo: "email", motivo: "invalido" });
  }
  if (erros.length) return { config: null, erros };
  return {
    config: {
      modo: modo as ConfigOnboarding["modo"],
      rodadas: modo === "automatizar" ? rodadasOk : [],
      horario: horario as string,
      agendadoPara,
      prazoDias: prazoDias as ConfigOnboarding["prazoDias"],
      lembreteDias:
        identificacao === "anonima"
          ? null
          : (lembreteBruto as ConfigOnboarding["lembreteDias"]),
      soDiasUteis: soDiasUteis as boolean,
      incluirAtrasados:
        modo === "automatizar" ? (incluirAtrasados as boolean) : false,
      publico: publico!,
      email:
        modeloEmail === "personalizado"
          ? {
              modelo: "personalizado",
              assunto: assunto ?? null,
              titulo: titulo ?? null,
              mensagem: mensagem ?? null,
            }
          : { modelo: "padrao", assunto: null, titulo: null, mensagem: null },
    },
    erros,
  };
}

/** A configuração gravada (com o padrão no que faltar). */
export function configGravada(bruto: unknown): ConfigOnboarding {
  const c = ehRegistro(bruto) ? bruto : {};
  return { ...CONFIG_PADRAO, ...(c as Partial<ConfigOnboarding>) };
}

// ---------------------------------------------------------------------------
// Datas

export function diaUtil(dia: Dia, feriados: ReadonlySet<Dia>): boolean {
  return ehDiaUtil(dia) && !feriados.has(dia);
}

/** O próprio dia, se útil; senão, o próximo dia útil. */
export function proximoDiaUtil(dia: Dia, feriados: ReadonlySet<Dia>): Dia {
  let d = dia;
  while (!diaUtil(d, feriados)) d = somarDias(d, 1);
  return d;
}

/** A data da rodada: admissão + N dias (e o próximo dia útil, se pedido). */
export function dataDaRodada(
  admissao: Dia,
  rodada: RodadaAutomatica,
  soDiasUteis: boolean,
  feriados: ReadonlySet<Dia> = new Set(),
): Dia {
  const d = somarDias(admissao, rodada);
  return soDiasUteis ? proximoDiaUtil(d, feriados) : d;
}

/** O instante do envio: o dia no horário escolhido (Brasília). */
export function instanteDoEnvio(dia: Dia, horario: string): Date {
  return new Date(`${dia}T${horario}:00-03:00`);
}

/** O último dia para responder: o dia do envio + o prazo. */
export function ultimoDiaParaResponder(
  dataPrevista: Dia,
  prazoDias: number,
): Dia {
  return somarDias(dataPrevista, prazoDias);
}

// ---------------------------------------------------------------------------
// Público e planejamento

export interface PessoaDoPublico {
  id: string;
  admissao: Dia | null;
  departamentoId: string | null;
  cargoId: string | null;
  unidadeId: string | null;
  centroCustoId: string | null;
}

const CAMPO_DA_PESSOA: Readonly<Record<CampoDoPublico, keyof PessoaDoPublico>> =
  {
    departamento: "departamentoId",
    cargo: "cargoId",
    unidade: "unidadeId",
    centroCusto: "centroCustoId",
  };

/** A pessoa atende ao público? (no grupo, todas as condições). */
export function noPublico(p: PessoaDoPublico, publico: Publico): boolean {
  switch (publico.tipo) {
    case "todos":
      return true;
    case "pessoas":
      return publico.colaboradorIds.includes(p.id);
    case "grupo":
      return publico.condicoes.every((c) => {
        const v = p[CAMPO_DA_PESSOA[c.campo]];
        return typeof v === "string" && c.valores.includes(v);
      });
  }
}

export interface EnvioPlanejado {
  colaboradorId: string;
  rodada: Rodada;
  dataPrevista: Dia;
}

/**
 * Os convites a criar agora. `inicio` é o dia da ativação; `existentes`, as
 * chaves `pessoa:rodada` já criadas (nunca repete).
 */
export function planejarEnvios(entrada: {
  config: ConfigOnboarding;
  inicio: Dia;
  hoje: Dia;
  pessoas: readonly PessoaDoPublico[];
  existentes: ReadonlySet<string>;
  feriados?: ReadonlySet<Dia>;
}): EnvioPlanejado[] {
  const { config, inicio, hoje, existentes } = entrada;
  const feriados = entrada.feriados ?? new Set<Dia>();
  const novos: EnvioPlanejado[] = [];
  const pessoas = entrada.pessoas.filter((p) => noPublico(p, config.publico));
  const chave = (id: string, r: number) => `${id}:${r}`;
  if (config.modo !== "automatizar") {
    const dia = config.modo === "agendar" ? config.agendadoPara! : inicio;
    for (const p of pessoas) {
      if (!existentes.has(chave(p.id, 0))) {
        novos.push({ colaboradorId: p.id, rodada: 0, dataPrevista: dia });
      }
    }
    return novos;
  }
  const horizonte = somarDias(hoje, HORIZONTE_DIAS);
  const limiteDoAtraso = somarDias(inicio, -ATRASO_MAXIMO_DIAS);
  const primeiroEnvio = config.soDiasUteis
    ? proximoDiaUtil(hoje, feriados)
    : hoje;
  for (const p of pessoas) {
    if (!p.admissao) continue;
    for (const r of config.rodadas) {
      if (existentes.has(chave(p.id, r))) continue;
      const data = dataDaRodada(p.admissao, r, config.soDiasUteis, feriados);
      if (data >= inicio) {
        if (data <= horizonte) {
          novos.push({ colaboradorId: p.id, rodada: r, dataPrevista: data });
        }
      } else if (config.incluirAtrasados && data >= limiteDoAtraso) {
        novos.push({
          colaboradorId: p.id,
          rodada: r,
          dataPrevista: primeiroEnvio,
        });
      }
    }
  }
  return novos;
}

/** Quantas pessoas do público fazem cada rodada nos próximos 30 dias. */
export function proximasRodadas(
  pessoas: readonly PessoaDoPublico[],
  config: Pick<ConfigOnboarding, "publico" | "soDiasUteis">,
  hoje: Dia,
  feriados: ReadonlySet<Dia> = new Set(),
): Record<RodadaAutomatica, number> {
  const fim = somarDias(hoje, HORIZONTE_DIAS);
  const r = { 30: 0, 60: 0, 90: 0 } as Record<RodadaAutomatica, number>;
  for (const p of pessoas) {
    if (!p.admissao || !noPublico(p, config.publico)) continue;
    for (const rodada of RODADAS_AUTOMATICAS) {
      const d = dataDaRodada(p.admissao, rodada, config.soDiasUteis, feriados);
      if (d >= hoje && d <= fim) r[rodada] += 1;
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Situação dos convites

export type SituacaoDoEnvio =
  | "agendado"
  | "aguardando_email"
  | "enviado"
  | "sem_email"
  | "respondido"
  | "pulado";

/** O convite agendado já deve sair? (agora: na hora; demais: no horário). */
export function envioVencido(
  config: Pick<ConfigOnboarding, "modo" | "horario">,
  dataPrevista: Dia,
  agora: Date,
): boolean {
  if (config.modo === "agora") return true;
  return (
    instanteDoEnvio(dataPrevista, config.horario).getTime() <= agora.getTime()
  );
}

/** A situação depois de tentar mandar o convite. */
export function situacaoDepoisDoAviso(
  temEmail: boolean,
  notificou: boolean,
): SituacaoDoEnvio {
  if (!temEmail) return "sem_email";
  return notificou ? "enviado" : "aguardando_email";
}

/** O lembrete já é devido? (uma vez, só para quem não respondeu, no prazo). */
export function lembreteDevido(
  envio: {
    situacao: SituacaoDoEnvio;
    dataPrevista: Dia;
    lembreteEm: Date | null;
  },
  config: Pick<ConfigOnboarding, "lembreteDias" | "horario" | "prazoDias">,
  agora: Date,
  hoje: Dia,
): boolean {
  if (config.lembreteDias === null || envio.lembreteEm !== null) return false;
  if (envio.situacao !== "aguardando_email" && envio.situacao !== "enviado") {
    return false;
  }
  if (hoje > ultimoDiaParaResponder(envio.dataPrevista, config.prazoDias)) {
    return false;
  }
  const quando = instanteDoEnvio(
    somarDias(envio.dataPrevista, config.lembreteDias),
    config.horario,
  );
  return quando.getTime() <= agora.getTime();
}

/** O convite aceita resposta hoje? (já saiu, no prazo, sem resposta). */
export function aceitaResposta(
  envio: { situacao: SituacaoDoEnvio; dataPrevista: Dia },
  prazoDias: number,
  hoje: Dia,
): boolean {
  if (envio.situacao === "respondido" || envio.situacao === "pulado") {
    return false;
  }
  if (envio.situacao === "agendado") return false;
  return (
    envio.dataPrevista <= hoje &&
    hoje <= ultimoDiaParaResponder(envio.dataPrevista, prazoDias)
  );
}

/**
 * O intervalo do agendador (ms) a partir do ambiente: `0` desliga; sem
 * valor, 5 minutos — exceto nos testes, em que fica desligado.
 */
export function intervaloDoAgendador(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const bruto = env.PESQUISAS_AGENDADOR_INTERVALO_MS;
  if (bruto === undefined || bruto.trim() === "") {
    return env.NODE_ENV === "test" ? 0 : 5 * 60 * 1000;
  }
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n === 0 ? 0 : Math.max(n, 10_000);
}
