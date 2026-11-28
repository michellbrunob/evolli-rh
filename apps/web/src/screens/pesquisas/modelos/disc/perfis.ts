/**
 * T216 — Perfil comportamental (DISC): o nome e o conteúdo de cada perfil
 * (textos do Evolli). Mono e tri usam o conteúdo do fator principal; as 12
 * combinações (bi) têm nome, resumo e síntese próprios, e as listas juntam
 * o fator principal com o secundário.
 */
import { FATOR, type ConteudoDoFator, type FatorDisc } from "./fatores";
import type { ClasseDisc, Intensidade, Pontos } from "./tiposDisc";

export interface Combinacao {
  readonly nome: string;
  readonly resumo: string;
  readonly sintese: string;
}

export const COMBINACOES: Readonly<Record<string, Combinacao>> = {
  DI: {
    nome: "Protagonista",
    resumo:
      "Puxa a execução com energia e convence as pessoas a seguirem junto. Une velocidade e carisma.",
    sintese: "Acelera e engaja ao mesmo tempo; cuide para ouvir no caminho.",
  },
  ID: {
    nome: "Porta-voz",
    resumo:
      "Convence pela conversa e não perde o resultado de vista. Mobiliza pessoas para uma meta.",
    sintese: "Inspira com metas claras; feche os compromissos por escrito.",
  },
  IS: {
    nome: "Elo do time",
    resumo:
      "Aproxima pessoas e cuida do clima. Cria laços e mantém o grupo unido.",
    sintese: "Une o grupo com leveza; aprenda a dizer não quando preciso.",
  },
  SI: {
    nome: "Presença acolhedora",
    resumo:
      "Apoia com paciência e calor humano. É a referência de quem precisa de ajuda.",
    sintese: "Acolhe e dá segurança; mostre também a sua opinião.",
  },
  SC: {
    nome: "Especialista",
    resumo:
      "Constância e cuidado técnico. Entrega com qualidade, no ritmo combinado.",
    sintese: "Consistência com qualidade; abra espaço para o novo.",
  },
  CS: {
    nome: "Análise cuidadosa",
    resumo:
      "Analisa com método e respeita as pessoas envolvidas. Prefere segurança a improviso.",
    sintese: "Precisão com calma; decida no tempo do negócio.",
  },
  DC: {
    nome: "Estrategista",
    resumo:
      "Decide com base em dados e persegue a meta com método. Planeja e executa.",
    sintese: "Resultado com critério; envolva o time nas decisões.",
  },
  CD: {
    nome: "Execução precisa",
    resumo:
      "Exige qualidade e cobra resultado. Transforma padrões em entregas.",
    sintese: "Padrão alto e foco na entrega; flexibilize quando fizer sentido.",
  },
  DS: {
    nome: "Firmeza constante",
    resumo:
      "Determinação com persistência. Persegue a meta sem perder o ritmo.",
    sintese: "Firme e persistente; explique as mudanças antes de cobrar.",
  },
  SD: {
    nome: "Estabilidade firme",
    resumo:
      "Mantém a constância e se posiciona quando precisa. Entrega com segurança.",
    sintese: "Constância com posição; arrisque um pouco mais.",
  },
  IC: {
    nome: "Comunicação analítica",
    resumo:
      "Explica ideias complexas de forma simples. Une argumento e conversa.",
    sintese: "Convence com dados; cuide para não se dispersar.",
  },
  CI: {
    nome: "Saber compartilhado",
    resumo:
      "Domina o assunto e gosta de ensinar. Leva o conhecimento técnico às pessoas.",
    sintese: "Conhecimento que circula; decida sem esperar a certeza total.",
  },
};

export const ROTULO_DA_INTENSIDADE: Readonly<Record<Intensidade, string>> = {
  puro: "Puro",
  acentuado: "Acentuado",
  moderado: "Moderado",
  equilibrado: "Equilibrado",
};

/** O que cada intensidade quer dizer (cartões e planilha). */
export const TEXTO_DA_INTENSIDADE: Readonly<Record<Intensidade, string>> = {
  puro: "Um fator domina com folga: o comportamento é bem marcado e previsível.",
  acentuado:
    "Um ou dois fatores se destacam com clareza, com espaço para os demais.",
  moderado:
    "Os fatores principais aparecem, mas sem grande distância dos outros.",
  equilibrado:
    "Três fatores em proporções parecidas: o comportamento muda conforme a situação.",
};

/** Adjetivo da intensidade concordando com o nome do fator (feminino). */
const INTENSIDADE_DO_FATOR: Readonly<Record<Intensidade, string>> = {
  puro: "pura",
  acentuado: "acentuada",
  moderado: "moderada",
  equilibrado: "equilibrada",
};

/** "Dominância pura", "Protagonista", "Perfil equilibrado". */
export function tituloDoPerfil(classe: ClasseDisc): string {
  if (classe.tipo === "mono") {
    const f = classe.fatores[0]!;
    return `${FATOR[f].nome} ${INTENSIDADE_DO_FATOR[classe.intensidade]}`;
  }
  if (classe.tipo === "bi") {
    return COMBINACOES[classe.codigo]?.nome ?? "Perfil combinado";
  }
  return "Perfil equilibrado";
}

/** "D", "D/C", "D/C/S". */
export const codigoDoPerfil = (classe: ClasseDisc) => classe.fatores.join("/");

export interface ConteudoDoPerfil extends Omit<
  ConteudoDoFator,
  "nome" | "cor" | "palavras"
> {
  readonly titulo: string;
  readonly principal: FatorDisc;
}

/** Junta as listas: 3 do principal e 2 do secundário, sem repetir. */
function juntar(
  a: readonly string[],
  b: readonly string[],
  deA = 3,
  deB = 2,
): string[] {
  return [...new Set([...a.slice(0, deA), ...b.slice(0, deB)])];
}

export function conteudoDoPerfil(classe: ClasseDisc): ConteudoDoPerfil {
  const principal = classe.fatores[0]!;
  const p = FATOR[principal];
  const base: ConteudoDoPerfil = {
    ...p,
    titulo: tituloDoPerfil(classe),
    principal,
  };
  if (classe.tipo !== "bi") return base;
  const s = FATOR[classe.fatores[1]!];
  const c = COMBINACOES[classe.codigo];
  return {
    ...base,
    resumo: c?.resumo ?? p.resumo,
    sintese: c?.sintese ?? p.sintese,
    fortes: juntar(p.fortes, s.fortes, 4, 2),
    atencao: juntar(p.atencao, s.atencao),
    desenvolvimento: juntar(p.desenvolvimento, s.desenvolvimento, 2, 2),
    estresse: juntar(p.estresse, s.estresse, 2, 2),
    feedback: juntar(p.feedback, s.feedback, 2, 1),
    motivar: juntar(p.motivar, s.motivar, 2, 1),
  };
}

/** "dominância, conformidade e estabilidade". */
export function nomesDosFatores(
  fatores: readonly FatorDisc[],
  minusculas = false,
): string {
  const nomes = fatores.map((f) =>
    minusculas ? FATOR[f].nome.toLowerCase() : FATOR[f].nome,
  );
  return nomes.length > 1
    ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`
    : (nomes[0] ?? "");
}

/**
 * O perfil do time em uma frase. O time equilibrado (três fatores perto
 * um do outro) tem texto próprio: o do fator principal falaria de um
 * estilo que não domina.
 */
export function resumoDoTime(classe: ClasseDisc): string {
  if (classe.tipo !== "tri") return conteudoDoPerfil(classe).resumo;
  return `Time equilibrado: ${nomesDosFatores(classe.fatores, true)} aparecem em proporções parecidas, sem um estilo que domine. O grupo se adapta a situações diferentes; deixe claros os papéis para que cada estilo entre na hora certa.`;
}

export type CampoDoTime = "fortes" | "atencao" | "feedback" | "estresse";

/**
 * Os pontos do time numa linha de "Como o time funciona": um de cada fator
 * principal, em rodízio, sem repetir (com um fator só, os 3 primeiros dele).
 */
export function chipsDoTime(
  classe: ClasseDisc,
  campo: CampoDoTime,
  quantos = 3,
): string[] {
  const listas = classe.fatores.map((f) => FATOR[f][campo]);
  const maior = Math.max(0, ...listas.map((l) => l.length));
  const saida: string[] = [];
  for (let i = 0; i < maior && saida.length < quantos; i++) {
    for (const l of listas) {
      const t = l[i];
      if (t && !saida.includes(t) && saida.length < quantos) saida.push(t);
    }
  }
  return saida;
}

/**
 * Entre os fatores ausentes (predominantes em ninguém), o que o time menos
 * tem na composição (empate: D, I, S, C); `null` sem ausentes.
 */
export function fatorMaisAusente(
  ausentes: readonly FatorDisc[],
  percentuais: Pontos,
): FatorDisc | null {
  const ordem = ["D", "I", "S", "C"] as const;
  return (
    [...ausentes].sort(
      (a, b) =>
        percentuais[a] - percentuais[b] || ordem.indexOf(a) - ordem.indexOf(b),
    )[0] ?? null
  );
}
