import { OrigemAlteracaoSalarial } from "@prisma/client";

/** T215 — uma alteração salarial como a API devolve. */
export interface AlteracaoSalarialDevolvida {
  id: string;
  origem: OrigemAlteracaoSalarial;
  /** Dia civil `AAAA-MM-DD`. */
  vigenciaInicio: string;
  /** Véspera do período seguinte; `null` no vigente. */
  vigenciaFim: string | null;
  /** Em reais, com ponto e 2 casas: "1621.00". */
  salarioBruto: string;
  cargo: string | null;
  modeloContrato: string | null;
  vigente: boolean;
}

interface LinhaGravada {
  id: string;
  origem: OrigemAlteracaoSalarial;
  vigenciaInicio: Date;
  salarioBruto: { toFixed(casas: number): string };
  cargo: string | null;
  modeloContrato: string | null;
}

function diaCivil(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function vespera(data: Date): string {
  const d = new Date(data.getTime());
  d.setUTCDate(d.getUTCDate() - 1);
  return diaCivil(d);
}

/**
 * T215 — a linha do tempo salarial: da mais nova para a mais antiga. A mais
 * nova é a vigente (aberta); cada outra vai até a véspera da seguinte. Só
 * recebe linhas vivas (não removidas).
 */
export function montarLinhaDoTempo(
  linhas: readonly LinhaGravada[],
): AlteracaoSalarialDevolvida[] {
  const ordenadas = [...linhas].sort(
    (a, b) => b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime(),
  );
  return ordenadas.map((l, i) => {
    const seguinte = ordenadas[i - 1];
    return {
      id: l.id,
      origem: l.origem,
      vigenciaInicio: diaCivil(l.vigenciaInicio),
      vigenciaFim: seguinte ? vespera(seguinte.vigenciaInicio) : null,
      salarioBruto: l.salarioBruto.toFixed(2),
      cargo: l.cargo,
      modeloContrato: l.modeloContrato,
      vigente: i === 0,
    };
  });
}
