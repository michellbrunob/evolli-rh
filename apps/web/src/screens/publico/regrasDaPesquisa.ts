/**
 * T216 — regras puras da resposta pelo link: o que fica visível (lógica
 * condicional), o que é válido em cada um dos 11 tipos, e o corpo do envio.
 *
 * A tela guarda o rascunho na forma da INTERFACE (`ValorRascunho`): texto
 * como foi digitado, data em `dd/mm/aaaa`, "Outro" marcado mesmo sem texto.
 * Só o envio converte para a forma do contrato (`ValorResposta`).
 */
import type {
  Pergunta,
  RespostaDaPergunta,
  Secao,
  ValorResposta,
} from "../../api/pesquisaPublicaClient";
import { dataDigitadaParaIso } from "../../format/dataDigitada";

export interface EscolhaRascunho {
  readonly opcao: string | null;
  /** `null`: "Outro" não marcado; texto (até vazio): marcado. */
  readonly outro: string | null;
}

export interface MultiplaRascunho {
  readonly opcoes: readonly string[];
  readonly outro: string | null;
}

export type ValorRascunho =
  string | number | EscolhaRascunho | MultiplaRascunho;

export type Respostas = Readonly<Record<string, ValorRascunho>>;

export const LIMITE_TEXTO_CURTO = 300;
export const LIMITE_PARAGRAFO = 3000;
export const LIMITE_OUTRO = 300;

// ---------------------------------------------------------------- formatos

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** `000.000.000-00`, conforme a pessoa digita. */
export function mascararCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Dígitos verificadores do CPF. */
export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const n = [...digitos].map(Number);
  const dv = (quantos: number) => {
    let soma = 0;
    for (let i = 0; i < quantos; i++) soma += n[i]! * (quantos + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === n[9] && dv(10) === n[10];
}

/** "1.234,5" ou "1234.5" → número; vazio ou lixo → `null`. */
export function lerNumero(valor: string): number | null {
  const limpo = valor.trim().replace(/\s/g, "");
  if (limpo === "") return null;
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  return Number(normal);
}

function numeroNaTela(n: number): string {
  return String(n).replace(".", ",");
}

// ----------------------------------------------------- lógica condicional

/** As opções marcadas numa resposta de escolha ou sim/não. */
function opcoesMarcadas(valor: ValorRascunho | undefined): readonly string[] {
  if (typeof valor === "string") return [valor];
  if (valor && typeof valor === "object") {
    if ("opcoes" in valor) return valor.opcoes;
    if (valor.opcao) return [valor.opcao];
  }
  return [];
}

/**
 * Perguntas visíveis, na ordem: sem condição, ou a pergunta da condição está
 * visível e tem a opção marcada. Escondida a pergunta-mãe, a filha também
 * some (encadeamento).
 */
export function perguntasVisiveis(
  secoes: readonly Secao[],
  respostas: Respostas,
): ReadonlySet<string> {
  const visiveis = new Set<string>();
  for (const secao of secoes) {
    for (const p of secao.perguntas) {
      const c = p.condicao;
      if (
        !c ||
        (visiveis.has(c.perguntaId) &&
          opcoesMarcadas(respostas[c.perguntaId]).includes(c.opcaoId))
      ) {
        visiveis.add(p.id);
      }
    }
  }
  return visiveis;
}

// --------------------------------------------------------------- validação

function vazio(valor: ValorRascunho | undefined): boolean {
  if (valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (typeof valor === "number") return false;
  if ("opcoes" in valor) {
    return valor.opcoes.length === 0 && valor.outro === null;
  }
  return valor.opcao === null && valor.outro === null;
}

/**
 * O erro da pergunta (texto para a tela) ou `null`. Só vale para perguntas
 * visíveis — a tela não chama para as escondidas.
 */
export function erroDaPergunta(
  p: Pergunta,
  valor: ValorRascunho | undefined,
): string | null {
  if (vazio(valor)) {
    if (!p.obrigatoria) return null;
    switch (p.tipo) {
      case "texto_curto":
      case "paragrafo":
        return "Escreva uma resposta para continuar.";
      case "multipla_escolha":
        return "Escolha pelo menos uma opção.";
      case "data":
        return "Informe uma data.";
      case "numero":
        return "Informe um número.";
      default:
        return "Escolha uma opção para continuar.";
    }
  }
  switch (p.tipo) {
    case "texto_curto":
    case "paragrafo": {
      const limite =
        p.tipo === "texto_curto" ? LIMITE_TEXTO_CURTO : LIMITE_PARAGRAFO;
      return typeof valor === "string" && valor.trim().length > limite
        ? `Use até ${limite} caracteres.`
        : null;
    }
    case "escolha_unica": {
      const v = valor as EscolhaRascunho;
      return v.outro !== null && v.outro.trim() === ""
        ? "Escreva qual é a outra opção."
        : null;
    }
    case "multipla_escolha": {
      const v = valor as MultiplaRascunho;
      if (v.outro !== null && v.outro.trim() === "") {
        return "Escreva qual é a outra opção.";
      }
      const total = v.opcoes.length + (v.outro !== null ? 1 : 0);
      const maximo = p.config.maximo;
      return maximo !== undefined && total > maximo
        ? `Escolha até ${maximo === 1 ? "1 opção" : `${maximo} opções`}.`
        : null;
    }
    case "data":
      return dataDigitadaParaIso(String(valor)) === null
        ? "Informe uma data válida, no formato dd/mm/aaaa."
        : null;
    case "numero": {
      const n = lerNumero(String(valor));
      if (n === null) return "Informe um número.";
      if (p.config.inteiro && !Number.isInteger(n)) {
        return "Informe um número inteiro, sem casas decimais.";
      }
      const { minimo, maximo } = p.config;
      const fora =
        (minimo !== undefined && n < minimo) ||
        (maximo !== undefined && n > maximo);
      if (!fora) return null;
      if (minimo !== undefined && maximo !== undefined) {
        return `Informe um número entre ${numeroNaTela(minimo)} e ${numeroNaTela(maximo)}.`;
      }
      return minimo !== undefined
        ? `Informe um número a partir de ${numeroNaTela(minimo)}.`
        : `Informe um número até ${numeroNaTela(maximo!)}.`;
    }
    default:
      return null;
  }
}

/** Erros das perguntas visíveis de uma seção, por id. */
export function errosDaSecao(
  secao: Secao,
  visiveis: ReadonlySet<string>,
  respostas: Respostas,
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const p of secao.perguntas) {
    if (!visiveis.has(p.id)) continue;
    const erro = erroDaPergunta(p, respostas[p.id]);
    if (erro) erros[p.id] = erro;
  }
  return erros;
}

// ------------------------------------------------------------------- envio

function valorDoEnvio(p: Pergunta, valor: ValorRascunho): ValorResposta | null {
  switch (p.tipo) {
    case "texto_curto":
    case "paragrafo":
      return String(valor).trim();
    case "escolha_unica": {
      const v = valor as EscolhaRascunho;
      if (v.outro !== null) return { outro: v.outro.trim() };
      return v.opcao ? { opcao: v.opcao } : null;
    }
    case "multipla_escolha": {
      const v = valor as MultiplaRascunho;
      return v.outro !== null
        ? { opcoes: v.opcoes, outro: v.outro.trim() }
        : { opcoes: v.opcoes };
    }
    case "data":
      return dataDigitadaParaIso(String(valor));
    case "numero":
      return lerNumero(String(valor));
    case "sim_nao":
      return valor === "sim" || valor === "nao" ? valor : null;
    default:
      return typeof valor === "number" ? valor : null;
  }
}

/**
 * Corpo do envio: só as perguntas VISÍVEIS e respondidas. O que ficou numa
 * pergunta escondida pela condição não vai ao servidor.
 */
export function montarRespostas(
  secoes: readonly Secao[],
  respostas: Respostas,
): RespostaDaPergunta[] {
  const visiveis = perguntasVisiveis(secoes, respostas);
  const saida: RespostaDaPergunta[] = [];
  for (const secao of secoes) {
    for (const p of secao.perguntas) {
      const valor = respostas[p.id];
      if (!visiveis.has(p.id) || valor === undefined || vazio(valor)) {
        continue;
      }
      const convertido = valorDoEnvio(p, valor);
      if (convertido !== null)
        saida.push({ perguntaId: p.id, valor: convertido });
    }
  }
  return saida;
}

/** Lê um rascunho guardado, descartando o que não tem a forma esperada. */
export function lerRascunho(texto: string | null): Respostas {
  if (!texto) return {};
  try {
    const dados: unknown = JSON.parse(texto);
    if (dados === null || typeof dados !== "object" || Array.isArray(dados)) {
      return {};
    }
    const saida: Record<string, ValorRascunho> = {};
    for (const [id, v] of Object.entries(dados as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number") saida[id] = v;
      else if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const outro = typeof o["outro"] === "string" ? o["outro"] : null;
        if (Array.isArray(o["opcoes"])) {
          saida[id] = {
            opcoes: o["opcoes"].filter(
              (x): x is string => typeof x === "string",
            ),
            outro,
          };
        } else {
          saida[id] = {
            opcao: typeof o["opcao"] === "string" ? o["opcao"] : null,
            outro,
          };
        }
      }
    }
    return saida;
  } catch {
    return {};
  }
}
