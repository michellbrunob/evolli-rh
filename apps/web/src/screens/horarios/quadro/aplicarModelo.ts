/**
 * T215 — "Aplicar modelo": uma escala do catálogo para várias pessoas de uma
 * vez, sempre no rascunho do quadro.
 *
 * - As células saem da MESMA regra do padrão (`celulaDoDia` sobre uma escala
 *   simulada), então o rascunho bate com o que o padrão mostraria.
 * - 6x1: a folga semanal (DSR) é o domingo para todos ou gira entre as
 *   pessoas; com "domingos", quem não folga no domingo folga nele a cada 3
 *   semanas (a folga da semana troca de lugar com o domingo).
 * - "Um turno por dia" (escalas de dias fixos): o turno de cada dia da semana.
 * - Sem "Substituir", o modelo só ocupa os dias sem rascunho nem publicado.
 * - Sem data de fim: o rascunho recebe as próximas 8 semanas e o padrão de
 *   cada pessoa passa a ser o modelo (feito pela tela, com `definirEscala`).
 */
import type {
  DiaGravadoApi,
  EscalaApi,
  GravarDiaDto,
  PessoaDoQuadroApi,
  TurnoDaEscalaApi,
} from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import {
  diaDaSemana,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { modeloDe } from "../../pessoas/ficha/escala/modelosDeEscala";
import {
  type CelulaDoQuadro,
  celulaDoDia,
  diaGravado,
  diasDoPeriodo,
  minutosDosPeriodos,
  periodosNoDia,
  segundaDaSemana,
} from "./quadroDaEscala";

/** Sem data de fim: semanas que vão para o rascunho. */
export const SEMANAS_SEM_FIM = 8;

/** Até uma data: o fim sugerido (quatro semanas). */
export const DIAS_SUGERIDOS = 28;

/** Ordem da folga distribuída: domingo, segunda, terça… */
const ORDEM_DA_FOLGA = [7, 1, 2, 3, 4, 5, 6] as const;

export type DistribuicaoDaFolga = "mesmo" | "distribuir";

export interface OpcoesDoModelo {
  readonly modelo: string;
  /** O turno dos dias de trabalho. */
  readonly turno: TabelaHorarioApi | null;
  /** "Um turno por dia": o turno de cada dia da semana (1 = segunda). */
  readonly turnoPorDia?: ReadonlyMap<number, TabelaHorarioApi>;
  /** Só 6x1. */
  readonly folga: DistribuicaoDaFolga;
  /** Só 6x1: folga no domingo pelo menos a cada 3 semanas. */
  readonly domingoACada3: boolean;
  /** Só "outra": os dias de trabalho (1 = segunda). */
  readonly diasTrabalho: readonly number[];
  readonly inicio: string;
  /** `null` = sem data de fim. */
  readonly fim: string | null;
  readonly substituir: boolean;
}

/** As escalas de dias fixos aceitam um turno por dia (fora a 6x1). */
export function aceitaTurnoPorDia(modelo: string): boolean {
  const m = modeloDe(modelo);
  return (
    m !== null &&
    ((m.tipo === "semanal" && m.codigo !== "6x1") || m.tipo === "outra")
  );
}

/** Os dias de trabalho de uma escala de dias fixos (para "um turno por dia"). */
export function diasFixosDo(
  modelo: string,
  diasTrabalho: readonly number[],
): number[] {
  const m = modeloDe(modelo);
  if (!m) return [];
  if (m.tipo === "outra") return [...diasTrabalho].sort((a, b) => a - b);
  // Semana espanhola: o sábado alternado também.
  return m.codigo === "semana_espanhola"
    ? [1, 2, 3, 4, 5, 6]
    : [...m.diasFixos];
}

/** Os dias que o modelo ocupa no rascunho. */
export function diasDoModelo(inicio: string, fim: string | null): string[] {
  const ultimo = fim ?? somarDias(inicio, SEMANAS_SEM_FIM * 7 - 1);
  return ultimo < inicio ? [] : diasDoPeriodo(inicio, ultimo);
}

/** O turno no formato da escala. */
export function turnoDaEscala(t: TabelaHorarioApi): TurnoDaEscalaApi {
  return {
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    ativo: t.ativo,
    periodos: t.periodos.map((p) => ({
      dia: p.dia,
      inicio: p.inicio,
      fim: p.fim,
    })),
    intervaloMinutos: t.intervaloMinutos ?? 0,
    cor: t.cor ?? null,
    sigla: t.sigla ?? null,
  };
}

/** A folga semanal (6x1) da pessoa na posição `indice`. */
export function folgaDaPessoa(
  folga: DistribuicaoDaFolga,
  indice: number,
): number {
  return folga === "mesmo" ? 7 : ORDEM_DA_FOLGA[indice % 7]!;
}

/** A escala que o modelo dá à pessoa na posição `indice`. */
export function escalaDoModelo(o: OpcoesDoModelo, indice: number): EscalaApi {
  const m = modeloDe(o.modelo);
  const ciclo =
    m?.tipo === "revezamento" ||
    m?.tipo === "plantao" ||
    m?.tipo === "embarque";
  return {
    id: "modelo",
    modelo: o.modelo,
    turno: o.turno ? turnoDaEscala(o.turno) : null,
    turnoNoite: null,
    folgaSemanal: o.modelo === "6x1" ? folgaDaPessoa(o.folga, indice) : null,
    diasTrabalho: m?.tipo === "outra" ? [...o.diasTrabalho] : [],
    inicioCiclo: ciclo ? o.inicio : null,
    vigenciaInicio: o.inicio,
    vigenciaFim: null,
    definidaEm: "",
    definidaPor: "",
  };
}

function trabalhoCom(
  t: TabelaHorarioApi,
  dia: string,
  base: CelulaDoQuadro,
): CelulaDoQuadro | null {
  const ps = periodosNoDia(
    { ...t, intervaloMinutos: t.intervaloMinutos ?? 0 },
    dia,
  )
    .slice(0, 2)
    .map((x) => ({ inicio: x.inicio, fim: x.fim }));
  if (ps.length === 0) return null;
  const intervalo = ps.length === 1 ? (t.intervaloMinutos ?? 0) : 0;
  return {
    ...base,
    tipo: "trabalho",
    turno: {
      id: t.id,
      nome: t.nome,
      cor: t.cor ?? null,
      sigla: t.sigla ?? null,
    },
    horario: `${ps[0]!.inicio}–${ps[ps.length - 1]!.fim}`,
    periodos: ps,
    intervaloMinutos: intervalo,
    minutos: minutosDosPeriodos(ps, intervalo),
  };
}

/**
 * As células do modelo para a pessoa na posição `indice`, nos `dias`
 * (fora do vínculo: `null`).
 */
export function celulasDoModelo(
  p: PessoaDoQuadroApi,
  o: OpcoesDoModelo,
  indice: number,
  dias: readonly string[],
): (CelulaDoQuadro | null)[] {
  const escala = escalaDoModelo(o, indice);
  const simulada: PessoaDoQuadroApi = { ...p, escalas: [escala], dias: [] };
  const celulas = dias.map((dia): CelulaDoQuadro | null => {
    const c = celulaDoDia(simulada, dia);
    if (c.tipo === "fora") return null;
    const proprio = o.turnoPorDia?.get(diaDaSemana(dia));
    if (c.tipo === "trabalho" && proprio) {
      return (
        trabalhoCom(proprio, dia, c) ?? {
          ...c,
          tipo: "folga",
          periodos: [],
          minutos: 0,
          horario: null,
          turno: null,
        }
      );
    }
    return c;
  });

  // 6x1 com a folga fora do domingo: a cada 3 semanas, folga no domingo.
  const folga = escala.folgaSemanal;
  if (
    o.modelo === "6x1" &&
    o.domingoACada3 &&
    folga !== null &&
    folga !== 7 &&
    o.turno
  ) {
    const primeira = segundaDaSemana(dias[0] ?? o.inicio);
    dias.forEach((dia, i) => {
      if (diaDaSemana(dia) !== 7) return;
      const semana = Math.round(
        (Date.parse(segundaDaSemana(dia)) - Date.parse(primeira)) /
          (7 * 24 * 60 * 60 * 1000),
      );
      if ((semana + indice) % 3 !== 2) return;
      const domingo = celulas[i];
      // O dia da folga, na mesma semana (segunda a sábado: antes do domingo).
      const j = i - (7 - folga);
      const diaDaFolga = j >= 0 ? celulas[j] : undefined;
      if (!domingo || domingo.tipo !== "trabalho") return;
      celulas[i] = {
        ...domingo,
        tipo: "dsr",
        turno: null,
        periodos: [],
        horario: null,
        minutos: 0,
        intervaloMinutos: 0,
      };
      if (
        diaDaFolga &&
        (diaDaFolga.tipo === "dsr" || diaDaFolga.tipo === "folga")
      ) {
        celulas[j] = trabalhoCom(o.turno!, dias[j]!, diaDaFolga) ?? diaDaFolga;
      }
    });
  }
  return celulas;
}

export interface PessoaNoModelo {
  readonly colaboradorId: string;
  readonly nome: string;
  /** Horas na primeira semana do modelo. */
  readonly minutosNaSemana: number;
  /** Células que vão para o rascunho. */
  readonly celulas: number;
}

export interface PlanoDoModelo {
  readonly gravar: GravarDiaDto[];
  /** Dias com rascunho ou publicado no período (o "Substituir"). */
  readonly ocupadas: number;
  readonly porPessoa: PessoaNoModelo[];
}

/** O lote do modelo, para todas as pessoas. */
export function planoDoModelo(
  pessoas: readonly PessoaDoQuadroApi[],
  o: OpcoesDoModelo,
): PlanoDoModelo {
  const dias = diasDoModelo(o.inicio, o.fim);
  const gravar: GravarDiaDto[] = [];
  const porPessoa: PessoaNoModelo[] = [];
  let ocupadas = 0;
  pessoas.forEach((p, indice) => {
    const celulas = celulasDoModelo(p, o, indice, dias);
    let n = 0;
    let minutosNaSemana = 0;
    celulas.forEach((c, i) => {
      if (!c) return;
      const dia = dias[i]!;
      if (i < 7) minutosNaSemana += c.minutos;
      const existente = diaGravado(p, dia);
      if (existente) ocupadas += 1;
      if (existente && !o.substituir) return;
      const comum = {
        colaboradorId: p.colaboradorId,
        dia,
        observacao: existente?.observacao ?? null,
      };
      if (c.tipo === "folga" || c.tipo === "dsr") {
        gravar.push({ ...comum, tipo: c.tipo });
        n += 1;
        return;
      }
      if (c.tipo !== "trabalho" || c.periodos.length === 0) return;
      gravar.push({
        ...comum,
        tipo: "trabalho",
        tabelaHorarioId: c.turno?.id ?? null,
        periodos: [...c.periodos],
        intervaloMinutos: c.intervaloMinutos,
        sobreaviso: [],
        unidadeOrganizacionalId: existente?.unidade?.id ?? null,
      });
      n += 1;
    });
    porPessoa.push({
      colaboradorId: p.colaboradorId,
      nome: p.nome,
      minutosNaSemana,
      celulas: n,
    });
  });
  return { gravar, ocupadas, porPessoa };
}

/**
 * As pessoas como ficariam no rascunho depois do modelo (para os avisos da
 * prévia): os dias gravados do lote entram como rascunho e, com `o`, a
 * escala do modelo vale no período (os avisos que olham a escala, como a 6x1
 * depois da transição, também aparecem).
 */
export function pessoasComOModelo(
  pessoas: readonly PessoaDoQuadroApi[],
  gravar: readonly GravarDiaDto[],
  turnos: readonly TabelaHorarioApi[],
  o?: OpcoesDoModelo,
): PessoaDoQuadroApi[] {
  const porPessoa = new Map<string, GravarDiaDto[]>();
  for (const g of gravar) {
    porPessoa.set(g.colaboradorId, [
      ...(porPessoa.get(g.colaboradorId) ?? []),
      g,
    ]);
  }
  return pessoas.map((p, indice) => {
    const novos = porPessoa.get(p.colaboradorId) ?? [];
    const escalas = o
      ? [
          {
            ...escalaDoModelo(o, indice),
            vigenciaFim: o.fim ? somarDias(o.fim, 1) : null,
          },
          ...p.escalas,
        ]
      : p.escalas;
    const diasNovos = new Set(novos.map((g) => g.dia));
    const rascunhos: DiaGravadoApi[] = novos.map((g) => {
      const t = turnos.find((x) => x.id === g.tabelaHorarioId) ?? null;
      return {
        dia: g.dia,
        camada: "rascunho",
        tipo: g.tipo,
        turno: t
          ? {
              id: t.id,
              nome: t.nome,
              cor: t.cor ?? null,
              sigla: t.sigla ?? null,
            }
          : null,
        periodos: g.periodos ?? [],
        intervaloMinutos: g.intervaloMinutos ?? 0,
        sobreaviso: g.sobreaviso ?? [],
        unidade: null,
        observacao: g.observacao ?? null,
      };
    });
    return {
      ...p,
      escalas,
      dias: [
        ...(p.dias ?? []).filter(
          (d) => !(d.camada === "rascunho" && diasNovos.has(d.dia)),
        ),
        ...rascunhos,
      ],
    };
  });
}

/* ---- Repasse entre o quadro e a página do modelo --------------------------
   O quadro diz quem está no filtro e quem está selecionado; a página, ao
   aplicar, deixa o aviso para o quadro mostrar na volta. Lidos uma vez. */

export interface PedidoDoModelo {
  /** As pessoas do filtro atual do quadro (`null` = todas). */
  readonly doFiltro: readonly string[] | null;
  /** As pessoas selecionadas no quadro (vazio = nenhuma). */
  readonly selecionadas: readonly string[];
}

let pedidoPendente: PedidoDoModelo | null = null;
let avisoPendente: string | null = null;

export function pedirModelo(pedido: PedidoDoModelo): void {
  pedidoPendente = pedido;
}

/**
 * O pedido do quadro, sem apagá-lo: a leitura acontece na renderização (que
 * pode se repetir); a página o esquece ao sair (`esquecerPedidoDoModelo`).
 */
export function lerPedidoDoModelo(): PedidoDoModelo | null {
  return pedidoPendente;
}

export function esquecerPedidoDoModelo(): void {
  pedidoPendente = null;
}

export function avisarNoQuadro(texto: string): void {
  avisoPendente = texto;
}

export function lerAvisoDoQuadro(): string | null {
  const a = avisoPendente;
  avisoPendente = null;
  return a;
}
