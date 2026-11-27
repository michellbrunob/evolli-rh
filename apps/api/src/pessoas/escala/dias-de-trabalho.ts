import {
  diasDoMes,
  ehDiaUtil,
  proporcaoDoModelo,
} from "../beneficios/dias-beneficio";
import { type PadraoDoDia, resolverDiaDoPadrao } from "./dia-do-padrao";

/**
 * T215 — os dias de trabalho de uma pessoa no mês (`AAAA-MM`), a base dos
 * benefícios pagos "pela escala" e o número da aba Escala da ficha. Dia a
 * dia, com a regra da célula do quadro:
 *
 * 1. fora do vínculo (antes da admissão, depois do desligamento): não conta;
 * 2. ausência aprovada (férias, afastamento etc.; home office não entra):
 *    não conta — a ausência vence o turno, como no quadro;
 * 3. dia PUBLICADO: conta se for trabalho (o rascunho não conta);
 * 4. senão, o padrão que vale no dia (troca de escala no meio do mês
 *    incluída): conta se for trabalho;
 * 5. dia sem padrão nem publicado: a escala do cadastro — a proporção do
 *    modelo (12x36 = 1/2, 6x1 = 6/7) ou, no 5x2, "outra" e sem escala, o dia
 *    útil (sem feriados nacionais, estaduais e municipais da unidade).
 *
 * Sem padrão nem publicado no mês inteiro, a origem é o "catálogo" e o total
 * é a proporção do modelo (12x36 = 15, 6x1 = 26 em 30 dias) ou os dias
 * úteis. Nunca uma contagem parcial: todo dia do mês é resolvido.
 */
export interface EntradaDosDiasDeTrabalho {
  readonly competencia: string;
  /** Os padrões que tocam o mês (qualquer ordem). */
  readonly escalas: readonly PadraoDoDia[];
  /** Dia → tipo do dia PUBLICADO. */
  readonly publicados: ReadonlyMap<string, string>;
  /** As ausências aprovadas que descontam (sem home office). */
  readonly ausencias: readonly { inicio: string; fim: string | null }[];
  readonly escalaDoCadastro: string | null;
  readonly uf: string | null;
  /** Os feriados municipais que valem para a unidade da pessoa. */
  readonly feriadosMunicipais: readonly string[];
  readonly admissao: string | null;
  readonly desligamento: string | null;
}

export interface DiasDeTrabalho {
  readonly dias: number;
  /** `escala`: há padrão ou publicado no mês; `catalogo`: só o cadastro. */
  readonly origem: "escala" | "catalogo";
}

export function diasDeTrabalhoNoMes(
  e: EntradaDosDiasDeTrabalho,
): DiasDeTrabalho {
  const municipais = new Set(e.feriadosMunicipais);
  const proporcao = proporcaoDoModelo(e.escalaDoCadastro);
  let total = 0;
  let comEscala = false;
  for (let d = 1; d <= diasDoMes(e.competencia); d += 1) {
    const dia = `${e.competencia}-${String(d).padStart(2, "0")}`;
    const publicado = e.publicados.get(dia);
    const padrao = publicado ? null : resolverDiaDoPadrao(e.escalas, dia);
    if (publicado || padrao) comEscala = true;

    if (e.admissao && dia < e.admissao) continue;
    if (e.desligamento && dia > e.desligamento) continue;
    if (e.ausencias.some((a) => a.inicio <= dia && (!a.fim || dia <= a.fim))) {
      continue;
    }
    if (publicado) {
      if (publicado === "trabalho") total += 1;
    } else if (padrao) {
      if (padrao.tipo === "trabalho") total += 1;
    } else if (proporcao !== null) {
      total += proporcao;
    } else if (ehDiaUtil(dia, e.uf, municipais)) {
      total += 1;
    }
  }
  return {
    dias: Math.round(total),
    origem: comEscala ? "escala" : "catalogo",
  };
}
