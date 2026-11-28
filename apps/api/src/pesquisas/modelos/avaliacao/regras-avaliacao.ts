import type { ErroDeCampo } from "../../../common/erros/recusa-por-campo";
import type { RegraDeComentarios } from "./calculo-avaliacao";
import type { ModeloDeAvaliacao } from "./definicao";

/**
 * T216 — Avaliação 90°/180°: o organograma (quem avalia quem pelo cadastro),
 * os times escolhidos e a configuração (funções puras).
 *
 * Organograma: o gestor de cada pessoa é o gestor da equipe da lotação
 * vigente dela (principal; sem principal, o substituto). Auto-referência é
 * ignorada (a pessoa não se avalia na 90°); gestor fora dos ativos ou sem
 * CPF e nascimento (não entra pelo link) manda o time para "sem gestor".
 */

export interface PessoaDoOrganograma {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  /** A equipe da lotação vigente. */
  equipeId: string | null;
  /** Tem CPF e nascimento no perfil (o link exige). */
  identificavel: boolean;
  temEmail: boolean;
}

export interface AtribuicaoVigente {
  equipeId: string;
  gestorId: string;
  papel: "principal" | "substituto";
}

export type MotivoSemGestor =
  "sem_gestor" | "gestor_sem_cpf" | "gestor_inativo";

export interface PessoaResumida {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  identificavel: boolean;
  temEmail: boolean;
}

export interface Organograma {
  times: { gestor: PessoaResumida; pessoas: PessoaResumida[] }[];
  semGestor: {
    pessoa: PessoaResumida;
    motivo: MotivoSemGestor;
    /** O nome do gestor do cadastro (sem CPF ou inativo). */
    gestorNome: string | null;
  }[];
}

const resumida = (p: PessoaDoOrganograma): PessoaResumida => ({
  id: p.id,
  nome: p.nome,
  cargo: p.cargo,
  departamento: p.departamento,
  identificavel: p.identificavel,
  temEmail: p.temEmail,
});

const porNome = (a: { nome: string }, b: { nome: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR");

/** O gestor de cada equipe: o principal; sem principal, o substituto. */
export function gestorDasEquipes(
  atribuicoes: readonly AtribuicaoVigente[],
): Map<string, string> {
  const r = new Map<string, string>();
  for (const papel of ["substituto", "principal"] as const) {
    for (const a of atribuicoes) {
      if (a.papel === papel) r.set(a.equipeId, a.gestorId);
    }
  }
  return r;
}

export function montarOrganograma(
  ativos: readonly PessoaDoOrganograma[],
  atribuicoes: readonly AtribuicaoVigente[],
  nomesDeFora: ReadonlyMap<string, string> = new Map(),
): Organograma {
  const pessoa = new Map(ativos.map((p) => [p.id, p]));
  const gestorDe = gestorDasEquipes(atribuicoes);
  const times = new Map<string, PessoaResumida[]>();
  const semGestor: Organograma["semGestor"] = [];
  for (const p of ativos) {
    const gestorId = p.equipeId ? (gestorDe.get(p.equipeId) ?? null) : null;
    if (gestorId === null || gestorId === p.id) {
      semGestor.push({
        pessoa: resumida(p),
        motivo: "sem_gestor",
        gestorNome: null,
      });
      continue;
    }
    const gestor = pessoa.get(gestorId);
    if (!gestor) {
      semGestor.push({
        pessoa: resumida(p),
        motivo: "gestor_inativo",
        gestorNome: nomesDeFora.get(gestorId) ?? null,
      });
      continue;
    }
    if (!gestor.identificavel) {
      semGestor.push({
        pessoa: resumida(p),
        motivo: "gestor_sem_cpf",
        gestorNome: gestor.nome,
      });
      continue;
    }
    times.set(gestorId, [...(times.get(gestorId) ?? []), resumida(p)]);
  }
  return {
    times: [...times]
      .map(([gestorId, pessoas]) => ({
        gestor: resumida(pessoa.get(gestorId)!),
        pessoas: pessoas.sort(porNome),
      }))
      .sort((a, b) => porNome(a.gestor, b.gestor)),
    semGestor: semGestor.sort((a, b) => porNome(a.pessoa, b.pessoa)),
  };
}

// ---------------------------------------------------------------------------
// Times escolhidos → pares

export interface TimeInformado {
  gestorId: string;
  avaliadoIds: string[];
}

export interface ParPlanejado {
  avaliadorId: string;
  avaliadoId: string;
  papel: "gestor" | "autoavaliacao";
}

/**
 * Confere os times (gestor ativo e identificável; pessoas ativas, cada uma
 * num time só, nunca o próprio gestor; ao menos um time com pessoa) e monta
 * os pares. Na 180°, cada pessoa identificável também se avalia; quem não
 * tem CPF e nascimento só é avaliada pelo gestor.
 */
export function planejarPares(
  modelo: ModeloDeAvaliacao,
  times: readonly TimeInformado[],
  ativos: ReadonlySet<string>,
  identificaveis: ReadonlySet<string>,
): { pares: ParPlanejado[]; erros: ErroDeCampo[] } {
  const erros: ErroDeCampo[] = [];
  const pares: ParPlanejado[] = [];
  const vistos = new Set<string>();
  const gestores = new Set<string>();
  for (const t of times) {
    if (gestores.has(t.gestorId)) {
      erros.push({ campo: "times", motivo: "repetida" });
      continue;
    }
    gestores.add(t.gestorId);
    if (!ativos.has(t.gestorId)) {
      erros.push({ campo: "times", motivo: "indisponivel" });
      continue;
    }
    if (!identificaveis.has(t.gestorId)) {
      erros.push({ campo: "times", motivo: "gestor_nao_identificavel" });
      continue;
    }
    for (const avaliadoId of t.avaliadoIds) {
      if (avaliadoId === t.gestorId) {
        erros.push({ campo: "times", motivo: "invalido" });
      } else if (!ativos.has(avaliadoId)) {
        erros.push({ campo: "times", motivo: "indisponivel" });
      } else if (vistos.has(avaliadoId)) {
        erros.push({ campo: "times", motivo: "repetida" });
      } else {
        vistos.add(avaliadoId);
        pares.push({ avaliadorId: t.gestorId, avaliadoId, papel: "gestor" });
        if (modelo === "avaliacao180" && identificaveis.has(avaliadoId)) {
          pares.push({
            avaliadorId: avaliadoId,
            avaliadoId,
            papel: "autoavaliacao",
          });
        }
      }
    }
  }
  if (!erros.length && !pares.some((p) => p.papel === "gestor")) {
    erros.push({ campo: "times", motivo: "sem_pessoas" });
  }
  return { pares: erros.length ? [] : pares, erros: dedup(erros) };
}

function dedup(erros: ErroDeCampo[]): ErroDeCampo[] {
  const chaves = new Set<string>();
  return erros.filter((e) => {
    const k = `${e.campo}:${e.motivo}`;
    if (chaves.has(k)) return false;
    chaves.add(k);
    return true;
  });
}

/** Quem entra pelo link: os gestores e, na 180°, quem se autoavalia. */
export function participantesDosPares(
  pares: readonly ParPlanejado[],
): string[] {
  return [...new Set(pares.map((p) => p.avaliadorId))];
}

// ---------------------------------------------------------------------------
// Configuração

export const LEMBRETES = ["7_dias", "3_dias", "no_dia", "depois"] as const;
export type Lembrete = (typeof LEMBRETES)[number];

export const VISIBILIDADES = ["depois_do_gestor", "so_rh"] as const;
export type Visibilidade = (typeof VISIBILIDADES)[number];

export const REGRAS_DE_COMENTARIOS: readonly RegraDeComentarios[] = [
  "opcionais",
  "extremos",
  "obrigatorios",
];

export interface ConfigAvaliacao {
  comentarios: RegraDeComentarios;
  /** O resultado (90°) ou o comparativo (180°) no Portal do Colaborador. */
  liberarNoPortal: boolean;
  /** 180°: o que o gestor vê depois de enviar. */
  visibilidade: Visibilidade;
  /** 180°: prazo da autoavaliação (instante); `null` = o mesmo do gestor. */
  prazoAutoavaliacao: string | null;
  lembretes: Lembrete[];
  envio: "email" | "link";
}

export const CONFIG_PADRAO: ConfigAvaliacao = {
  comentarios: "extremos",
  liberarNoPortal: false,
  visibilidade: "depois_do_gestor",
  prazoAutoavaliacao: null,
  lembretes: ["7_dias", "3_dias", "no_dia"],
  envio: "email",
};

const UMA_HORA = 60 * 60 * 1000;

type Registro = Record<string, unknown>;

/**
 * Confere a configuração. `prazo` é o encerramento da pesquisa (o prazo do
 * gestor); o da autoavaliação precisa ficar ≥ 1 h no futuro e antes dele.
 * Na 90°, a visibilidade e o prazo da autoavaliação não se aplicam.
 */
export function conferirConfigAvaliacao(
  modelo: ModeloDeAvaliacao,
  bruto: unknown,
  prazo: Date | null,
  agora: Date,
  lerInstante: (v: string) => Date | null,
): { config: ConfigAvaliacao | null; erros: ErroDeCampo[] } {
  const c: Registro =
    typeof bruto === "object" && bruto !== null && !Array.isArray(bruto)
      ? (bruto as Registro)
      : {};
  const erros: ErroDeCampo[] = [];
  const comentarios = (c.comentarios ??
    CONFIG_PADRAO.comentarios) as RegraDeComentarios;
  if (!REGRAS_DE_COMENTARIOS.includes(comentarios)) {
    erros.push({ campo: "comentarios", motivo: "invalido" });
  }
  const liberarNoPortal = c.liberarNoPortal ?? false;
  if (typeof liberarNoPortal !== "boolean") {
    erros.push({ campo: "liberarNoPortal", motivo: "invalido" });
  }
  const visibilidade = (c.visibilidade ??
    CONFIG_PADRAO.visibilidade) as Visibilidade;
  if (!VISIBILIDADES.includes(visibilidade)) {
    erros.push({ campo: "visibilidade", motivo: "invalido" });
  }
  const lembretes = c.lembretes ?? CONFIG_PADRAO.lembretes;
  if (
    !Array.isArray(lembretes) ||
    lembretes.some((l) => !(LEMBRETES as readonly unknown[]).includes(l)) ||
    new Set(lembretes).size !== lembretes.length
  ) {
    erros.push({ campo: "lembretes", motivo: "invalido" });
  }
  const envio = c.envio ?? CONFIG_PADRAO.envio;
  if (envio !== "email" && envio !== "link") {
    erros.push({ campo: "envio", motivo: "invalido" });
  }
  let prazoAutoavaliacao: string | null = null;
  const brutoAuto = c.prazoAutoavaliacao ?? null;
  if (brutoAuto !== null) {
    if (modelo !== "avaliacao180") {
      erros.push({ campo: "prazoAutoavaliacao", motivo: "nao_se_aplica" });
    } else if (typeof brutoAuto !== "string") {
      erros.push({ campo: "prazoAutoavaliacao", motivo: "invalido" });
    } else {
      const d = lerInstante(brutoAuto);
      if (d === null) {
        erros.push({ campo: "prazoAutoavaliacao", motivo: "invalido" });
      } else if (d.getTime() < agora.getTime() + UMA_HORA) {
        erros.push({ campo: "prazoAutoavaliacao", motivo: "fora_do_prazo" });
      } else if (prazo === null || d.getTime() >= prazo.getTime()) {
        erros.push({ campo: "prazoAutoavaliacao", motivo: "fora_de_ordem" });
      } else {
        prazoAutoavaliacao = d.toISOString();
      }
    }
  }
  if (erros.length) return { config: null, erros };
  return {
    config: {
      comentarios,
      liberarNoPortal: liberarNoPortal as boolean,
      visibilidade: modelo === "avaliacao180" ? visibilidade : "so_rh",
      prazoAutoavaliacao,
      lembretes: [...(lembretes as Lembrete[])].sort(
        (a, b) => LEMBRETES.indexOf(a) - LEMBRETES.indexOf(b),
      ),
      envio: envio as "email" | "link",
    },
    erros,
  };
}

/** A configuração gravada (ou o padrão, se faltar campo). */
export function configGravada(bruto: unknown): ConfigAvaliacao {
  const c =
    typeof bruto === "object" && bruto !== null ? (bruto as Registro) : {};
  return { ...CONFIG_PADRAO, ...(c as Partial<ConfigAvaliacao>) };
}

// ---------------------------------------------------------------------------
// Lembretes

/** O marco gravado em `pesquisa_envio.rodada` para cada aviso da avaliação. */
export const MARCO_DO_AVISO: Readonly<Record<"convite" | Lembrete, number>> = {
  convite: 0,
  "7_dias": 1,
  "3_dias": 2,
  no_dia: 3,
  depois: 4,
};

const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;

/** O dia (`AAAA-MM-DD`) de um instante no horário de Brasília. */
export function diaEmBrasilia(d: Date): string {
  return new Date(d.getTime() - DESLOCAMENTO_MS).toISOString().slice(0, 10);
}

function somarDiasAoDia(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 09:00 de um dia, no horário de Brasília. */
export function nove(dia: string): Date {
  return new Date(`${dia}T09:00:00-03:00`);
}

/**
 * A agenda dos lembretes: às 09:00 de 7 e 3 dias antes do prazo, do dia do
 * prazo e do dia seguinte ("depois"). Só os que caem ≥ 1 h no futuro e antes
 * do prazo (exceto "depois").
 */
export function agendaDeLembretes(
  prazo: Date,
  lembretes: readonly Lembrete[],
  agora: Date,
): { lembrete: Lembrete; quando: Date }[] {
  const dia = diaEmBrasilia(prazo);
  const desloc: Record<Lembrete, number> = {
    "7_dias": -7,
    "3_dias": -3,
    no_dia: 0,
    depois: 1,
  };
  return LEMBRETES.filter((l) => lembretes.includes(l))
    .map((lembrete) => ({
      lembrete,
      quando: nove(somarDiasAoDia(dia, desloc[lembrete])),
    }))
    .filter(
      (x) =>
        x.quando.getTime() >= agora.getTime() + UMA_HORA &&
        (x.lembrete === "depois" || x.quando.getTime() < prazo.getTime()),
    );
}
