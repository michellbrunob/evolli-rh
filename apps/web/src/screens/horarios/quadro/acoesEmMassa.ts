/**
 * T215 — ações em massa do quadro da escala, em funções puras: o que gravar e
 * o que limpar no RASCUNHO, a partir das células (mesma regra do quadro).
 *
 * - Copiar semana anterior / Repetir esta semana até…: cada dia recebe o dia
 *   correspondente da semana de origem; dia de origem que vem do padrão (ou
 *   sem escala) deixa o destino no padrão (o rascunho dele sai), como na
 *   referência.
 * - Trocar turno: nos dias escolhidos do período, onde já há turno (ou também
 *   nas folgas), o turno novo com o horário dele no dia.
 * - Dar folga: Folga ou DSR num dia.
 * - Limpar o rascunho do período: os dias com rascunho.
 *
 * Dia fora do vínculo da pessoa nunca entra.
 */
import type {
  DiaGravadoApi,
  GravarDiaDto,
  PessoaDoQuadroApi,
} from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import {
  diaDaSemana,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { ausenciaDoDia } from "./ausenciasDoQuadro";
import {
  type CelulaDoQuadro,
  celulaDoDia,
  diasDoPeriodo,
  periodosNoDia,
} from "./quadroDaEscala";

export type ValorDoDia = Omit<GravarDiaDto, "colaboradorId" | "dia">;

export interface DiaDaPessoa {
  readonly colaboradorId: string;
  readonly dia: string;
}

export interface PlanoDoLote {
  readonly gravar: GravarDiaDto[];
  readonly limpar: DiaDaPessoa[];
}

export const chaveDoDia = (colaboradorId: string, dia: string) =>
  `${colaboradorId}|${dia}`;

/** O valor que regrava a célula; `null` quando ela não tem alocação própria. */
export function valorDaCelula(c: CelulaDoQuadro): ValorDoDia | null {
  // Sem escala, fora do vínculo e ausência (vence o turno): nada a copiar.
  if (c.tipo === "sem-escala" || c.tipo === "fora" || c.tipo === "ausencia")
    return null;
  if (c.tipo === "folga" || c.tipo === "dsr") {
    return { tipo: c.tipo, observacao: c.observacao };
  }
  if (c.tipo === "trabalho" && c.periodos.length === 0) return null;
  return {
    tipo: c.tipo,
    ...(c.tipo === "trabalho"
      ? {
          tabelaHorarioId: c.turno?.id ?? null,
          intervaloMinutos: c.periodos.length === 1 ? c.intervaloMinutos : 0,
          sobreaviso: [...c.sobreaviso],
        }
      : {}),
    periodos: [...c.periodos],
    unidadeOrganizacionalId: c.unidade?.id ?? null,
    observacao: c.observacao,
  };
}

/** O valor que regrava um dia gravado (o "Desfazer"). */
export function valorDoGravado(g: DiaGravadoApi): ValorDoDia {
  if (g.tipo === "folga" || g.tipo === "dsr") {
    return { tipo: g.tipo, observacao: g.observacao };
  }
  return {
    tipo: g.tipo,
    ...(g.tipo === "trabalho"
      ? {
          tabelaHorarioId: g.turno?.id ?? null,
          intervaloMinutos: g.intervaloMinutos,
          sobreaviso: g.sobreaviso,
        }
      : {}),
    periodos: g.periodos,
    unidadeOrganizacionalId: g.unidade?.id ?? null,
    observacao: g.observacao,
  };
}

function noVinculo(p: PessoaDoQuadroApi, dia: string): boolean {
  return (
    dia >= p.dataAdmissao &&
    (p.dataDesligamento === null || dia <= p.dataDesligamento)
  );
}

/**
 * Copia os dias `origem` (de cada pessoa) para os dias `destino`, na mesma
 * ordem. `pessoasDaOrigem` traz os dias da origem (outro período carregado).
 */
export function copiarDias(
  pessoas: readonly PessoaDoQuadroApi[],
  pessoasDaOrigem: ReadonlyMap<string, PessoaDoQuadroApi>,
  origem: readonly string[],
  destino: readonly string[],
): PlanoDoLote {
  const gravar: GravarDiaDto[] = [];
  const limpar: DiaDaPessoa[] = [];
  for (const p of pessoas) {
    const fonte = pessoasDaOrigem.get(p.colaboradorId) ?? p;
    destino.forEach((dia, i) => {
      // Fora do vínculo ou ausência aprovada no destino: o dia fica como está.
      if (!noVinculo(p, dia) || ausenciaDoDia(p, dia)) return;
      const c = celulaDoDia(fonte, origem[i]!);
      // Ausência na origem não se copia (é de Férias e ausências).
      if (c.tipo === "ausencia") return;
      const valor = c.origem === "padrao" ? null : valorDaCelula(c);
      if (valor) gravar.push({ ...valor, colaboradorId: p.colaboradorId, dia });
      else limpar.push({ colaboradorId: p.colaboradorId, dia });
    });
  }
  return { gravar, limpar };
}

/** As semanas depois da que começa em `inicioDaSemana`, até o dia `ate`. */
export function semanasAte(inicioDaSemana: string, ate: string): string[][] {
  const semanas: string[][] = [];
  for (
    let inicio = somarDias(inicioDaSemana, 7);
    inicio <= ate;
    inicio = somarDias(inicio, 7)
  ) {
    semanas.push(
      diasDoPeriodo(inicio, somarDias(inicio, 6)).filter((d) => d <= ate),
    );
  }
  return semanas;
}

export interface OpcoesDaTroca {
  readonly turno: TabelaHorarioApi;
  readonly de: string;
  readonly ate: string;
  /** 1 = segunda … 7 = domingo. */
  readonly diasDaSemana: ReadonlySet<number>;
  readonly tambemNasFolgas: boolean;
}

export interface MudancaDaPessoa {
  readonly colaboradorId: string;
  readonly nome: string;
  /** Dias que passam ao turno novo. */
  readonly dias: number;
  /** Dias que já são do turno (sem mudança). */
  readonly iguais: number;
}

/** Trocar turno: o lote e o que muda por pessoa. */
export function trocarTurno(
  pessoas: readonly PessoaDoQuadroApi[],
  o: OpcoesDaTroca,
): { plano: PlanoDoLote; mudancas: MudancaDaPessoa[] } {
  const gravar: GravarDiaDto[] = [];
  const mudancas: MudancaDaPessoa[] = [];
  const dias = diasDoPeriodo(o.de, o.ate).filter((d) =>
    o.diasDaSemana.has(diaDaSemana(d)),
  );
  for (const p of pessoas) {
    let n = 0;
    let iguais = 0;
    for (const dia of dias) {
      if (!noVinculo(p, dia)) continue;
      const c = celulaDoDia(p, dia);
      // Ausência aprovada vence o turno: o dia fica de fora.
      if (c.tipo === "ausencia") continue;
      // Só onde já há turno, salvo "Também nas folgas".
      if (c.tipo !== "trabalho" && !o.tambemNasFolgas) continue;
      if (c.tipo === "trabalho" && c.turno?.id === o.turno.id) {
        iguais += 1;
        continue;
      }
      const ps = periodosNoDia(
        { ...o.turno, intervaloMinutos: o.turno.intervaloMinutos ?? 0 },
        dia,
      ).slice(0, 2);
      if (ps.length === 0) continue;
      n += 1;
      gravar.push({
        colaboradorId: p.colaboradorId,
        dia,
        tipo: "trabalho",
        tabelaHorarioId: o.turno.id,
        periodos: ps.map((x) => ({ inicio: x.inicio, fim: x.fim })),
        intervaloMinutos: ps.length === 1 ? (o.turno.intervaloMinutos ?? 0) : 0,
        sobreaviso: [],
        unidadeOrganizacionalId: c.unidade?.id ?? null,
        observacao: c.observacao,
      });
    }
    mudancas.push({
      colaboradorId: p.colaboradorId,
      nome: p.nome,
      dias: n,
      iguais,
    });
  }
  return { plano: { gravar, limpar: [] }, mudancas };
}

/**
 * Dar folga (ou DSR) num dia; quem está fora do vínculo ou com ausência
 * aprovada no dia fica de fora.
 */
export function darFolga(
  pessoas: readonly PessoaDoQuadroApi[],
  dia: string,
  tipo: "folga" | "dsr",
): PlanoDoLote {
  return {
    gravar: pessoas
      .filter((p) => noVinculo(p, dia) && !ausenciaDoDia(p, dia))
      .map((p) => ({
        colaboradorId: p.colaboradorId,
        dia,
        tipo,
        observacao: celulaDoDia(p, dia).observacao,
      })),
    limpar: [],
  };
}

/** Os dias com rascunho das pessoas, no período carregado. */
export function rascunhosDe(
  pessoas: readonly PessoaDoQuadroApi[],
): DiaDaPessoa[] {
  return pessoas.flatMap((p) =>
    (p.dias ?? [])
      .filter((d) => d.camada === "rascunho")
      .map((d) => ({ colaboradorId: p.colaboradorId, dia: d.dia })),
  );
}

/**
 * Como desfazer um lote: o rascunho que cada dia tinha antes (regravado) ou
 * nenhum (limpo). `anteriores` vem dos períodos carregados.
 */
export function planoParaDesfazer(
  plano: PlanoDoLote,
  anteriores: ReadonlyMap<string, DiaGravadoApi>,
): PlanoDoLote {
  const gravar: GravarDiaDto[] = [];
  const limpar: DiaDaPessoa[] = [];
  const vistos = new Set<string>();
  for (const d of [...plano.gravar, ...plano.limpar]) {
    const chave = chaveDoDia(d.colaboradorId, d.dia);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const antes = anteriores.get(chave);
    if (antes) {
      gravar.push({
        ...valorDoGravado(antes),
        colaboradorId: d.colaboradorId,
        dia: d.dia,
      });
    } else {
      limpar.push({ colaboradorId: d.colaboradorId, dia: d.dia });
    }
  }
  return { gravar, limpar };
}

/** Os rascunhos de pessoas carregadas, por chave pessoa|dia. */
export function rascunhosPorChave(
  pessoas: Iterable<PessoaDoQuadroApi>,
): Map<string, DiaGravadoApi> {
  const m = new Map<string, DiaGravadoApi>();
  for (const p of pessoas) {
    for (const d of p.dias ?? []) {
      if (d.camada === "rascunho") m.set(chaveDoDia(p.colaboradorId, d.dia), d);
    }
  }
  return m;
}

/** Quantas pessoas o lote toca. */
export function pessoasDoLote(plano: PlanoDoLote): number {
  return new Set([...plano.gravar, ...plano.limpar].map((d) => d.colaboradorId))
    .size;
}
