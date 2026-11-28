/**
 * T216 — Onboarding: regras puras da tela (resumo do envio, contagem das
 * perguntas, configuração padrão e validação do assistente).
 */
import type { Identificacao, Secao } from "../../../../api/pesquisasClient";
import { formatarDiaCivil } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { minutosDoOnboarding } from "./envio";
import type { ConfigOnboarding } from "./cliente";

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

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O resumo vivo do rodapé. */
export function resumoDoEnvio(c: ConfigOnboarding): string {
  if (c.modo === "automatizar") {
    const r = c.rodadas.map(String);
    const lista =
      r.length <= 1
        ? (r[0] ?? "")
        : `${r.slice(0, -1).join(", ")} e ${r.at(-1)}`;
    return r.length
      ? `Automático · ${lista} dias após a admissão`
      : "Automático · escolha uma rodada";
  }
  if (c.modo === "agendar") {
    return c.agendadoPara
      ? `Agendado · ${formatarDiaCivil(c.agendadoPara)} às ${c.horario}`
      : "Agendado · escolha o dia";
  }
  return `Enviar agora · prazo de ${plural(c.prazoDias, "dia", "dias")}`;
}

export function textoDoPrazoELembrete(c: ConfigOnboarding): string {
  return `${plural(c.prazoDias, "dia", "dias")} para responder · ${
    c.lembreteDias === null
      ? "sem lembrete"
      : `lembrete ${plural(c.lembreteDias, "dia", "dias")} depois`
  }`;
}

export interface ContagemDePerguntas {
  perguntas: number;
  blocos: number;
  obrigatorias: number;
  minutos: number;
}

export function contarPerguntas(secoes: readonly Secao[]): ContagemDePerguntas {
  const todas = secoes.flatMap((s) => s.perguntas);
  return {
    perguntas: todas.length,
    blocos: secoes.length,
    obrigatorias: todas.filter((p) => p.obrigatoria).length,
    minutos: minutosDoOnboarding(todas.length),
  };
}

export function textoDaContagem(c: ContagemDePerguntas): string {
  return [
    plural(c.perguntas, "pergunta", "perguntas"),
    plural(c.blocos, "bloco", "blocos"),
    plural(c.obrigatorias, "obrigatória", "obrigatórias"),
    `cerca de ${plural(c.minutos, "minuto", "minutos")}`,
  ].join(" · ");
}

/** Erros da 1ª etapa (o que impede avançar). */
export function errosDaConfiguracao(
  nome: string,
  c: ConfigOnboarding,
  hoje: string,
): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!nome.trim()) erros.nome = "Dê um nome para a pesquisa.";
  else if (nome.trim().length > 120) erros.nome = "Use até 120 caracteres.";
  if (c.modo === "automatizar" && c.rodadas.length === 0) {
    erros.rodadas = "Escolha pelo menos uma rodada.";
  }
  if (c.modo === "agendar") {
    if (!c.agendadoPara) erros.agendadoPara = "Escolha o dia do envio.";
    else if (c.agendadoPara < hoje) {
      erros.agendadoPara = "Escolha hoje ou um dia depois de hoje.";
    }
  }
  return erros;
}

/** A configuração que vai para a API (a anônima não tem lembrete). */
export function configParaEnviar(
  c: ConfigOnboarding,
  identificacao: Identificacao,
): ConfigOnboarding {
  return {
    ...c,
    rodadas: c.modo === "automatizar" ? c.rodadas : [],
    agendadoPara: c.modo === "agendar" ? c.agendadoPara : null,
    incluirAtrasados: c.modo === "automatizar" ? c.incluirAtrasados : false,
    lembreteDias: identificacao === "anonima" ? null : c.lembreteDias,
  };
}

export function textoDoBotaoFinal(
  c: ConfigOnboarding,
  pessoas: number,
): string {
  if (c.modo === "automatizar") return "Ativar automação";
  if (c.modo === "agendar") {
    return `Agendar para ${plural(pessoas, "pessoa", "pessoas")}`;
  }
  return `Enviar agora para ${plural(pessoas, "pessoa", "pessoas")}`;
}

export const ROTULO_DA_SITUACAO = {
  agendado: "Agendado",
  aguardando_email: "Aguardando e-mail",
  enviado: "Enviado",
  sem_email: "Sem e-mail",
  respondido: "Respondeu",
  pulado: "Pulado",
} as const;
