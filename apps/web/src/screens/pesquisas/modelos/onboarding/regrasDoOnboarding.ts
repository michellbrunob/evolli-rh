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
  email: {
    modelo: "padrao",
    assunto: null,
    titulo: null,
    mensagem: null,
    corPrincipal: null,
    corFundo: null,
  },
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

/** As cores prontas do e-mail personalizado (a principal e o fundo claro). */
export const CORES_PRINCIPAIS: readonly { cor: string; nome: string }[] = [
  { cor: "#1f6feb", nome: "Azul" },
  { cor: "#0f766e", nome: "Verde-petróleo" },
  { cor: "#7c3aed", nome: "Roxo" },
  { cor: "#c2410c", nome: "Laranja" },
  { cor: "#be123c", nome: "Vinho" },
  { cor: "#111827", nome: "Grafite" },
];
/** O fundo padrão do convite (branco): gravado como "sem cor". */
export const FUNDO_PADRAO = "#ffffff";
export const CORES_DE_FUNDO: readonly { cor: string; nome: string }[] = [
  { cor: "#ffffff", nome: "Branco" },
  { cor: "#f7f9fc", nome: "Gelo" },
  { cor: "#f5f3ff", nome: "Lavanda" },
  { cor: "#fff7ed", nome: "Areia" },
];

export const corValida = (v: string): boolean => /^#[0-9a-f]{6}$/i.test(v);

/** Luminância relativa (WCAG) de `#rrggbb`, de 0 a 1 (a mesma regra da API). */
export function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** O fundo do e-mail precisa ser claro (o texto do corpo é escuro). */
export const fundoClaro = (hex: string): boolean =>
  corValida(hex) && luminancia(hex) >= 0.8;

/** Texto do botão: branco ou preto, o que der mais contraste. */
export function corDoTextoSobre(hex: string): "#ffffff" | "#000000" {
  const l = luminancia(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

/**
 * Quantas pessoas recebem cada rodada no próximo mês: a de 30 dias conta
 * quem faz 30 dias de casa; as outras dizem o marco que a pessoa atinge.
 */
export function textoDasProximas(rodada: number, pessoas: number): string {
  return rodada === 30
    ? `${plural(pessoas, "pessoa", "pessoas")} nos próximos 30 dias`
    : `${plural(pessoas, "pessoa chega", "pessoas chegam")} aos ${rodada} dias de casa nos próximos 30 dias`;
}

/** "Ana" de "Ana Souza" (a saudação do e-mail). */
export const primeiroNome = (nome: string): string =>
  nome.trim().split(/\s+/)[0] ?? nome;

/** A sigla da empresa no topo do convite ("EA" de "Empresa Alfa"). */
export function siglaDaEmpresa(empresa: string | null | undefined): string {
  const partes = (empresa ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "RH";
  return partes
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("pt-BR"))
    .join("");
}
