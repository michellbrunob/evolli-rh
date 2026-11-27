import type { RegrasDoBeneficio } from "./calculo-beneficios";
import { cpfValido } from "./dependentes.service";

/**
 * T215 — "Importar valores" de um benefício (como a referência,
 * 2026-11-26): a planilha atualiza, por CPF, os valores digitados do mês.
 * Aqui só a conferência de cada linha, sem banco: pronta (muda algo), sem
 * mudança (igual ao lançado) ou com pendência (o que corrigir).
 */

export type ColunaDaImportacao =
  "dias" | "valorDia" | "valorMes" | "coparticipacao" | "antecipado";

/** As colunas de valor que a planilha do benefício tem. */
export function colunasDaImportacao(
  r: RegrasDoBeneficio,
): ColunaDaImportacao[] {
  switch (r.tipoValor) {
    case "dia_util":
      return ["dias", "valorDia"];
    case "fixo":
      return ["valorMes"];
    case "individual":
      return r.individualModo === "livre" ? ["valorMes"] : [];
    case "faixa_etaria":
      return r.coparticipacao ? ["coparticipacao"] : [];
    case "antecipacao":
      return r.antecipacao?.modo === "variavel" ? ["antecipado"] : [];
    default:
      return [];
  }
}

/**
 * Reais escritos do jeito brasileiro ("1.234,56", "R$ 50,00") ou como o
 * Excel grava ("50.5"). Vazio = não informado.
 */
export function lerNumeroBr(
  texto: string | null | undefined,
): number | null | "invalido" {
  const t = (texto ?? "").replace(/R\$/gi, "").replace(/\s/g, "");
  if (t === "") return null;
  if (!/^\d[\d.,]*$/.test(t)) return "invalido";
  let normal: string;
  if (t.includes(",")) {
    if (t.split(",").length > 2) return "invalido";
    normal = t.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = t.split(".");
    // Um ponto só: com 3 casas é milhar ("1.234"); com outra quantidade é
    // decimal, como o Excel grava ("50.5", "33.299999999999997").
    normal =
      partes.length === 2 && partes[1]!.length !== 3 ? t : t.replace(/\./g, "");
  }
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : "invalido";
}

/** Dias no mês: inteiro de 0 a 31. */
export function lerDias(
  texto: string | null | undefined,
): number | null | "invalido" {
  const t = (texto ?? "").trim();
  if (t === "") return null;
  if (!/^\d{1,2}$/.test(t)) return "invalido";
  const n = Number(t);
  return n <= 31 ? n : "invalido";
}

/** Só os dígitos; com 9 ou 10, o Excel tirou os zeros da frente. */
export function cpfDaPlanilha(texto: string): string {
  const d = texto.replace(/\D/g, "");
  return d.length === 9 || d.length === 10 ? d.padStart(11, "0") : d;
}

/** O que corrigir na linha (dado da tela, não uma recusa da API). */
export interface ProblemaDaLinha {
  campo: "cpf" | "valores" | ColunaDaImportacao;
  motivo:
    "obrigatorio" | "invalido" | "nao_encontrado" | "nao_recebe" | "duplicado";
}

export interface LinhaInformada {
  /** Número da linha na planilha (a do cabeçalho é a 1). */
  linha: number;
  cpf: string;
  valores: Partial<Record<ColunaDaImportacao, string | null>>;
}

export interface LinhaConferida {
  linha: number;
  cpf: string;
  colaboradorId: string | null;
  nome: string | null;
  situacao: "pronta" | "sem_mudanca" | "pendencia";
  problemas: ProblemaDaLinha[];
  /** Só o que foi preenchido e vale para o benefício. */
  valores: Partial<Record<ColunaDaImportacao, number>>;
}

export function conferirLinhas(entrada: {
  linhas: readonly LinhaInformada[];
  colunas: readonly ColunaDaImportacao[];
  /** Pessoas ativas da empresa, por CPF. */
  empresa: ReadonlyMap<string, { colaboradorId: string; nome: string }>;
  /** Quem recebe o benefício no mês. */
  doBeneficio: ReadonlySet<string>;
  /** O que já está lançado no mês para cada pessoa. */
  atuais: ReadonlyMap<
    string,
    Partial<Record<ColunaDaImportacao, number | null>>
  >;
}): LinhaConferida[] {
  const vistos = new Set<string>();
  return entrada.linhas.map((l) => {
    const cpf = cpfDaPlanilha(l.cpf);
    const problemas: ProblemaDaLinha[] = [];
    const pessoa = entrada.empresa.get(cpf) ?? null;
    if (cpf === "") problemas.push({ campo: "cpf", motivo: "obrigatorio" });
    else if (!cpfValido(cpf))
      problemas.push({ campo: "cpf", motivo: "invalido" });
    else if (!pessoa)
      problemas.push({ campo: "cpf", motivo: "nao_encontrado" });
    else if (!entrada.doBeneficio.has(pessoa.colaboradorId))
      problemas.push({ campo: "cpf", motivo: "nao_recebe" });
    else if (vistos.has(cpf))
      problemas.push({ campo: "cpf", motivo: "duplicado" });
    if (cpf) vistos.add(cpf);

    const valores: Partial<Record<ColunaDaImportacao, number>> = {};
    let preenchidas = 0;
    for (const coluna of entrada.colunas) {
      const lido =
        coluna === "dias"
          ? lerDias(l.valores[coluna])
          : lerNumeroBr(l.valores[coluna]);
      if (lido === null) continue;
      preenchidas += 1;
      if (lido === "invalido") {
        problemas.push({ campo: coluna, motivo: "invalido" });
      } else {
        valores[coluna] = lido;
      }
    }
    if (preenchidas === 0) {
      problemas.push({ campo: "valores", motivo: "obrigatorio" });
    }

    const base = {
      linha: l.linha,
      cpf,
      colaboradorId: pessoa?.colaboradorId ?? null,
      nome: pessoa?.nome ?? null,
      problemas,
      valores,
    };
    if (problemas.length > 0) return { ...base, situacao: "pendencia" };
    const atual = entrada.atuais.get(pessoa!.colaboradorId) ?? {};
    const mudam = (Object.keys(valores) as ColunaDaImportacao[]).filter(
      (c) => (atual[c] ?? null) !== valores[c],
    );
    if (mudam.length === 0) return { ...base, situacao: "sem_mudanca" };
    // Só o que muda vai para o lançamento do mês.
    return {
      ...base,
      valores: Object.fromEntries(mudam.map((c) => [c, valores[c]])),
      situacao: "pronta",
    };
  });
}
