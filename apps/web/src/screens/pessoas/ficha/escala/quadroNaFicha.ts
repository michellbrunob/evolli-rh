/**
 * T215 — a aba Escala da ficha com o que está no quadro (como a referência):
 * os próximos 7 dias e o calendário do mês mostram o rascunho e o publicado
 * por cima do padrão, as férias e ausências aprovadas (que vencem o turno) e
 * os feriados da pessoa (nacionais, estaduais e locais da unidade). Sem o
 * quadro (falha ou sem acesso), vale só o padrão.
 */
import { useEffect, useState } from "react";
import type {
  PessoaDoQuadroApi,
  QuadroDaEscalaApi,
  RegrasDaEscalaApi,
} from "../../../../api/escalaClient";
import { feriadoDaPessoa } from "../../../horarios/quadro/avisosDaEscala";
import {
  type CelulaDoQuadro,
  celulaDoDia,
} from "../../../horarios/quadro/quadroDaEscala";
import { feriadoDe } from "./calendarioDaEscala";

export interface QuadroDaPessoa {
  readonly pessoa: PessoaDoQuadroApi;
  readonly regras: RegrasDaEscalaApi | undefined;
}

/** Lê o quadro do período e separa a pessoa; `null` enquanto não há. */
export function useQuadroDaPessoa(
  consultar:
    ((inicio: string, fim: string) => Promise<QuadroDaEscalaApi>) | undefined,
  colaboradorId: string,
  inicio: string,
  fim: string,
  versao: unknown,
): QuadroDaPessoa | null {
  const [quadro, setQuadro] = useState<QuadroDaPessoa | null>(null);
  useEffect(() => {
    if (!consultar) return;
    let vivo = true;
    consultar(inicio, fim).then(
      (q) => {
        if (!vivo) return;
        const pessoa = q.pessoas.find((p) => p.colaboradorId === colaboradorId);
        setQuadro(pessoa ? { pessoa, regras: q.regras } : null);
      },
      () => {
        if (vivo) setQuadro(null);
      },
    );
    return () => {
      vivo = false;
    };
  }, [consultar, colaboradorId, inicio, fim, versao]);
  return quadro;
}

/** O dia como o quadro o mostra (ou `null` sem o quadro) e o feriado. */
export function diaNoQuadro(
  quadro: QuadroDaPessoa | null,
  dia: string,
): { readonly celula: CelulaDoQuadro | null; readonly feriado: string | null } {
  if (!quadro) return { celula: null, feriado: feriadoDe(dia) };
  return {
    celula: celulaDoDia(quadro.pessoa, dia),
    feriado: feriadoDaPessoa(quadro.pessoa, dia, quadro.regras),
  };
}
