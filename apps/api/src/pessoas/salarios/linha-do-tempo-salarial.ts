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
 * nova fica aberta; cada outra vai até a véspera da seguinte. Vigente é só a
 * mais nova que JÁ começou (início até `hoje`, dia civil de São Paulo): numa
 * admissão futura, nenhuma linha é vigente antes do primeiro dia. Só recebe
 * linhas vivas (não removidas).
 */
export function montarLinhaDoTempo(
  linhas: readonly LinhaGravada[],
  /** Dia civil `AAAA-MM-DD` de hoje (São Paulo). */
  hoje: string,
): AlteracaoSalarialDevolvida[] {
  const ordenadas = [...linhas].sort(
    (a, b) => b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime(),
  );
  const indiceVigente = ordenadas.findIndex(
    (l) => diaCivil(l.vigenciaInicio) <= hoje,
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
      vigente: i === indiceVigente,
    };
  });
}
