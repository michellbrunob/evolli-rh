/**
 * T215 — os avisos da CLT do quadro da escala, calculados no RASCUNHO do
 * período carregado (como na referência). Não impedem publicar; cada aviso
 * liga ou desliga nas Regras da escala.
 *
 * Categorias: Atenção (o que costuma ser irregular), Conferir (pode estar
 * certo, depende do caso) e Informativos (só chamam a atenção para a folha).
 *
 * O que olha dias de fora do período (descanso entre jornadas na virada,
 * dias seguidos, domingos seguidos) vê só o período carregado. "Escalado
 * durante ausência aprovada" olha o dia gravado (rascunho ou publicado) com
 * trabalho ou sobreaviso num dia de ausência aprovada (a ausência vence o
 * turno). "Turnos sobrepostos" o servidor já recusa; não há contrato
 * intermitente.
 */
import type {
  ChaveDoAviso,
  PessoaDoQuadroApi,
  RegrasDaEscalaApi,
} from "../../../api/escalaClient";
import { diaMesCurto, idadeEmAnos, umAnoDepois } from "../../../format/data";
import { plural } from "../../../format/plural";
import {
  diaDaSemana,
  feriadoDe,
  feriadoEstadualDe,
  formatarHoras,
  jornadaPorSemana,
  limiteLegalSemanal,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { escalaDoDia } from "../../pessoas/ficha/escala/diaDaEscala";
import { modeloDe as modeloDoCatalogo } from "../../pessoas/ficha/escala/modelosDeEscala";
import {
  type CelulaDoQuadro,
  celulaDoDia,
  diaGravado,
  duracao,
} from "./quadroDaEscala";
import { tituloDaAusencia } from "./ausenciasDoQuadro";

export type CategoriaDoAviso = "atencao" | "conferir" | "informativo";

export const CATEGORIA: Readonly<Record<ChaveDoAviso, CategoriaDoAviso>> = {
  interjornada: "atencao",
  dois_descansos: "atencao",
  seis_dias: "atencao",
  dez_horas: "atencao",
  jornada_semanal: "conferir",
  revezamento: "conferir",
  intervalo: "atencao",
  sobrepostos: "atencao",
  plantao_descanso: "atencao",
  ausencia: "atencao",
  domingo: "conferir",
  feriado_comercio: "atencao",
  feriado: "conferir",
  "6x1_transicao": "atencao",
  aprendiz_estagio: "atencao",
  menor_noturno: "atencao",
  tempo_parcial: "atencao",
  intermitente: "atencao",
  noturno: "informativo",
  sobreaviso: "informativo",
  "12x36_2027": "informativo",
};

export interface AvisoDaEscala {
  readonly colaboradorId: string;
  readonly nome: string;
  readonly dia: string;
  readonly chave: ChaveDoAviso;
  readonly categoria: CategoriaDoAviso;
  readonly titulo: string;
  readonly explicacao: string;
}

const MIN_DIA = 24 * 60;

function minutosDaHora(h: string): number {
  const [a, b] = h.split(":").map(Number);
  return (a ?? 0) * 60 + (b ?? 0);
}

/** Os trechos de trabalho do dia em minutos corridos desde a 00:00. */
function trechosDoDia(c: CelulaDoQuadro): [number, number][] {
  if (c.tipo !== "trabalho") return [];
  const trechos: [number, number][] = [];
  for (const p of c.periodos) {
    let i = minutosDaHora(p.inicio);
    const anterior = trechos[trechos.length - 1];
    if (anterior && i < trechos[0]![0]) i += MIN_DIA;
    trechos.push([i, i + duracao(p)]);
  }
  return trechos;
}

/** O trecho cruza o horário noturno (22h às 5h)? */
function noturno(trechos: readonly [number, number][]): boolean {
  return trechos.some(([i, f]) =>
    FAIXAS_NOTURNAS.some(([a, b]) => i < b && f > a),
  );
}

const FAIXAS_NOTURNAS: readonly [number, number][] = [
  [-2 * 60, 5 * 60],
  [22 * 60, 29 * 60],
  [46 * 60, 53 * 60],
];

/** Turno de noite: metade ou mais das horas entre 22h e 5h. */
function turnoDeNoite(trechos: readonly [number, number][]): boolean {
  let total = 0;
  let noite = 0;
  for (const [i, f] of trechos) {
    total += f - i;
    for (const [a, b] of FAIXAS_NOTURNAS) {
      noite += Math.max(0, Math.min(f, b) - Math.max(i, a));
    }
  }
  return total > 0 && noite * 2 >= total;
}

/**
 * O feriado do dia para a pessoa: nacional, estadual (do estado da empresa)
 * ou local da unidade dela.
 */
export function feriadoDaPessoa(
  p: PessoaDoQuadroApi,
  dia: string,
  regras: RegrasDaEscalaApi | undefined,
): string | null {
  const nacional = feriadoDe(dia) ?? feriadoEstadualDe(dia, regras?.uf);
  if (nacional) return nacional;
  const local = regras?.feriados.find(
    (f) =>
      f.data === dia &&
      (f.unidadeIds.length === 0 ||
        (p.unidade !== null && f.unidadeIds.includes(p.unidade.id))),
  );
  return local?.nome ?? null;
}

function semanas(dias: readonly string[], semanaComeca: number): string[][] {
  const r: string[][] = [];
  for (const d of dias) {
    if (r.length === 0 || diaDaSemana(d) === semanaComeca) r.push([]);
    r[r.length - 1]!.push(d);
  }
  return r;
}

/** Todos os avisos ligados, das pessoas, no período. */
export function calcularAvisos(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  regras: RegrasDaEscalaApi | undefined,
): AvisoDaEscala[] {
  const ligado = (k: ChaveDoAviso) => regras?.avisos[k] ?? k !== "noturno";
  const conv = regras?.convencao;
  const transicao = regras?.inicioTransicao ?? "2026-12-16";
  const transicao2 = umAnoDepois(transicao);
  const avisos: AvisoDaEscala[] = [];

  for (const p of pessoas) {
    const cs = dias.map((d) => celulaDoDia(p, d));
    const modeloDe = (d: string) => escalaDoDia(p.escalas, d)?.modelo ?? null;
    // PJ e autônomos não são CLT: só os informativos.
    const clt = p.tipoVinculo !== "pj" && p.tipoVinculo !== "freelancer";
    const add = (
      dia: string,
      chave: ChaveDoAviso,
      titulo: string,
      explicacao: string,
    ) => {
      if (!ligado(chave)) return;
      if (!clt && CATEGORIA[chave] !== "informativo") return;
      avisos.push({
        colaboradorId: p.colaboradorId,
        nome: p.nome,
        dia,
        chave,
        categoria: CATEGORIA[chave],
        titulo,
        explicacao,
      });
    };

    // Dia a dia.
    let seguidos = 0;
    let domingosSeguidos = 0;
    let aviso6x1 = false;
    let aviso12x36 = false;
    cs.forEach((c, i) => {
      const dia = c.dia;
      const modelo = modeloDe(dia);
      const e12x36 = modelo === "12x36";
      const plantao =
        modelo !== null && modeloDoCatalogo(modelo)?.tipo === "plantao";
      const trechos = trechosDoDia(c);
      const min = c.minutos;

      // Escalado num dia de ausência aprovada (a ausência vence o turno).
      if (c.tipo === "ausencia" && c.ausencia) {
        const g = diaGravado(p, dia);
        if (g && (g.tipo === "trabalho" || g.tipo === "sobreaviso")) {
          add(
            dia,
            "ausencia",
            "Escalado durante ausência aprovada",
            `${tituloDaAusencia(c.ausencia)}: o dia não conta como trabalhado. Limpe o dia ou ajuste em Férias e ausências.`,
          );
        }
      }

      // 6x1 depois da transição, sem convenção.
      if (
        !aviso6x1 &&
        modelo === "6x1" &&
        dia >= transicao &&
        c.tipo === "trabalho" &&
        !conv?.["6x1_autorizada"]
      ) {
        aviso6x1 = true;
        add(
          dia,
          "6x1_transicao",
          "6x1 sem convenção depois da transição",
          `A partir de ${diaMesCurto(transicao)}, a 6x1 só vale com convenção coletiva (EC 141/2026).`,
        );
      }
      // 12x36 depois da 2ª etapa.
      if (!aviso12x36 && e12x36 && dia >= transicao2 && c.tipo === "trabalho") {
        aviso12x36 = true;
        add(
          dia,
          "12x36_2027",
          `12x36 depois de ${diaMesCurto(transicao2)}`,
          "A média de 42 h passa do limite de 40 h por semana (CLT, art. 59-A · EC 141/2026).",
        );
      }

      if (c.tipo === "trabalho" && trechos.length > 0) {
        // Mais de 10 h (12 h na 12x36).
        const teto = e12x36 ? 12 * 60 : 10 * 60;
        if (min > teto) {
          add(
            dia,
            "dez_horas",
            `${formatarHoras(min)} no dia`,
            e12x36
              ? "Passa de 12 h na 12x36 (CLT, art. 59-A)."
              : "Passa de 10 h (8 h + 2 extras) (CLT, art. 59).",
          );
        }
        // Intervalo (fora da 12x36).
        if (!e12x36 && c.periodos.length === 1) {
          const bruto = duracao(c.periodos[0]!);
          const minimo = conv?.intervalo_30min ? 30 : 60;
          if (bruto > 6 * 60 && c.intervaloMinutos < minimo) {
            add(
              dia,
              "intervalo",
              c.intervaloMinutos === 0
                ? "Sem intervalo"
                : `Intervalo de ${c.intervaloMinutos} min`,
              conv?.intervalo_30min
                ? "Acima de 6 h, o mínimo é 30 min pela convenção (CLT, art. 611-A, III)."
                : "Acima de 6 h de trabalho, o intervalo é de 1 h a 2 h (CLT, art. 71).",
            );
          } else if (
            bruto > 4 * 60 &&
            bruto <= 6 * 60 &&
            c.intervaloMinutos < 15
          ) {
            add(
              dia,
              "intervalo",
              "Sem pausa",
              "De 4 h a 6 h de trabalho, a pausa é de 15 min (CLT, art. 71, § 1º).",
            );
          }
        }
        // Descanso entre jornadas (ou depois do plantão).
        const anterior = cs[i - 1];
        const tAnt = anterior ? trechosDoDia(anterior) : [];
        if (tAnt.length > 0) {
          const descanso = trechos[0]![0] + MIN_DIA - tAnt[tAnt.length - 1]![1];
          if (e12x36 && descanso < 36 * 60) {
            add(
              dia,
              "plantao_descanso",
              `${formatarHoras(Math.max(0, descanso))} de descanso depois do plantão`,
              "A 12x36 pede 36 h seguidas de descanso (CLT, art. 59-A).",
            );
          } else if (!plantao && descanso < 11 * 60) {
            add(
              dia,
              "interjornada",
              `${formatarHoras(Math.max(0, descanso))} de descanso entre jornadas`,
              "O mínimo é 11 h entre uma jornada e a seguinte (CLT, art. 66).",
            );
          }
        }
        // Feriado.
        const feriado = feriadoDaPessoa(p, dia, regras);
        if (feriado && !e12x36) {
          if (
            conv?.comercio &&
            !conv.feriado_convencao &&
            !conv.portaria_1316
          ) {
            add(
              dia,
              "feriado_comercio",
              `Trabalho no feriado (${feriado})`,
              "No comércio, só com convenção coletiva (Lei 10.101/2000, art. 6º-A).",
            );
          } else {
            add(
              dia,
              "feriado",
              `Trabalho no feriado (${feriado})`,
              "O feriado trabalhado vai para a folha (Lei 605/1949).",
            );
          }
        }
        // Aprendiz e estágio: até 6 h por dia.
        if (
          (p.tipoVinculo === "aprendiz" || p.tipoVinculo === "estagio") &&
          min > 6 * 60
        ) {
          add(
            dia,
            "aprendiz_estagio",
            `${formatarHoras(min)} no dia`,
            p.tipoVinculo === "aprendiz"
              ? "Aprendiz: até 6 h por dia (CLT, art. 432)."
              : "Estágio: até 6 h por dia e 30 h por semana (Lei 11.788/2008, art. 10).",
          );
        }
        // Noturno: menor de 18 anos; e o informativo.
        if (noturno(trechos)) {
          if (p.dataNascimento && idadeEmAnos(p.dataNascimento, dia) < 18) {
            add(
              dia,
              "menor_noturno",
              "Menor de 18 anos em horário noturno",
              "Trabalho entre 22 h e 5 h é proibido para menores (CLT, art. 404).",
            );
          }
          add(
            dia,
            "noturno",
            "Turno noturno",
            "Trabalho entre 22 h e 5 h tem adicional na folha (CLT, art. 73).",
          );
        }
      }

      // Sobreaviso (informativo).
      if (c.tipo === "sobreaviso" || c.sobreaviso.length > 0) {
        add(
          dia,
          "sobreaviso",
          "Sobreaviso",
          "Fora do trabalho, esperando chamado: 1/3 da hora na folha (Súmula 428 do TST).",
        );
      }

      // Dias seguidos sem folga (fora da 12x36 e dos plantões).
      if (c.tipo === "trabalho" && !plantao) {
        seguidos += 1;
        if (seguidos === 7) {
          add(
            dia,
            "seis_dias",
            "7 dias seguidos sem folga",
            "O descanso semanal vem até o 7º dia (CLT, art. 67 · Lei 605/1949).",
          );
        }
      } else if (c.tipo !== "sem-escala") {
        seguidos = 0;
      }

      // Domingos seguidos de trabalho.
      if (diaDaSemana(dia) === 7) {
        if (c.tipo === "trabalho") domingosSeguidos += 1;
        else if (c.tipo !== "sem-escala") domingosSeguidos = 0;
        const limite = p.genero === "feminino" ? 2 : conv?.comercio ? 3 : 7;
        if (c.tipo === "trabalho" && domingosSeguidos === limite) {
          add(
            dia,
            "domingo",
            `${limite} domingos seguidos de trabalho`,
            p.genero === "feminino"
              ? "Folga no domingo a cada 2 semanas (CLT, art. 386)."
              : conv?.comercio
                ? "No comércio, folga no domingo a cada 3 semanas (Lei 10.101/2000, art. 6º)."
                : "Folga no domingo a cada 7 semanas (Portaria MTP 671/2021, art. 58, § 2º).",
          );
        }
      }
    });

    // Semana a semana.
    const descansos: number[] = [];
    for (const semana of semanas(dias, regras?.semanaComeca ?? 1)) {
      const csSemana = semana.map((d) => cs[dias.indexOf(d)]!);
      const minutos = csSemana.reduce((t, c) => t + c.minutos, 0);
      const ultimo = [...csSemana].reverse().find((c) => c.tipo === "trabalho");
      const modelo = modeloDe(semana[0]!);
      if (ultimo && modelo !== "12x36") {
        const limite = jornadaPorSemana(
          p.jornadaSemanalHoras,
          semana[0]!,
          transicao,
        );
        if (minutos > limite && semana.length === 7) {
          const legal = limiteLegalSemanal(semana[0]!, transicao) * 60;
          add(
            ultimo.dia,
            "jornada_semanal",
            `${formatarHoras(minutos)} na semana`,
            limite < legal
              ? `Acima da jornada do contrato (${formatarHoras(limite)}).`
              : semana[0]! >= transicao
                ? `Acima de ${formatarHoras(limite)} (CF, art. 7º, XIII · EC 141/2026).`
                : `Acima de ${formatarHoras(limite)} (CF, art. 7º, XIII).`,
          );
        }
        if (
          p.tipoVinculo === "estagio" &&
          minutos > 30 * 60 &&
          semana.length === 7
        ) {
          add(
            ultimo.dia,
            "aprendiz_estagio",
            `${formatarHoras(minutos)} na semana`,
            "Estágio: até 6 h por dia e 30 h por semana (Lei 11.788/2008, art. 10).",
          );
        }
        if (
          p.tipoVinculo === "part_time" &&
          minutos > 30 * 60 &&
          semana.length === 7
        ) {
          add(
            ultimo.dia,
            "tempo_parcial",
            `${formatarHoras(minutos)} na semana em tempo parcial`,
            "Até 30 h por semana, ou 26 h com até 6 extras (CLT, art. 58-A).",
          );
        }
      }
      // Revezamento: turnos de dia e de noite na semana.
      const tem = (pred: (t: [number, number][]) => boolean) =>
        csSemana.some((c) => pred(trechosDoDia(c)));
      if (
        tem((t) => t.length > 0 && turnoDeNoite(t)) &&
        tem((t) => t.length > 0 && !turnoDeNoite(t))
      ) {
        const teto = conv?.revezamento_8h ? 8 * 60 : 6 * 60;
        const longo = csSemana.find(
          (c) => c.tipo === "trabalho" && c.minutos > teto,
        );
        if (longo) {
          add(
            longo.dia,
            "revezamento",
            `${formatarHoras(longo.minutos)} em turno de revezamento`,
            "Quem alterna turnos de dia e de noite tem jornada de 6 h, salvo negociação coletiva (Constituição, art. 7º, XIV).",
          );
        }
      }
      if (semana.length === 7 && semana[0]! >= transicao && modelo !== null) {
        descansos.push(
          csSemana.filter((c) => c.tipo === "folga" || c.tipo === "dsr").length,
        );
      }
    }
    // 2 descansos por semana, em média, depois da transição.
    if (descansos.length > 0) {
      const media = descansos.reduce((a, b) => a + b, 0) / descansos.length;
      const modeloFinal = modeloDe(dias[dias.length - 1]!);
      const autorizada6x1 = modeloFinal === "6x1" && conv?.["6x1_autorizada"];
      if (media < 2 && !autorizada6x1 && modeloFinal !== "12x36") {
        const arred = Math.round(media * 10) / 10;
        add(
          dias[dias.length - 1]!,
          "dois_descansos",
          `${plural(arred, "descanso", "descansos").replace(".", ",")} por semana no período`,
          "A partir da transição, a média no mês precisa ser de 2 descansos por semana (EC 141/2026).",
        );
      }
    }
  }
  return avisos;
}

/** Avisos por célula (pessoa|dia). */
export function avisosPorCelula(
  avisos: readonly AvisoDaEscala[],
): Map<string, AvisoDaEscala[]> {
  const m = new Map<string, AvisoDaEscala[]>();
  for (const a of avisos) {
    const k = `${a.colaboradorId}|${a.dia}`;
    m.set(k, [...(m.get(k) ?? []), a]);
  }
  return m;
}

/** Pessoas em 6x1 em algum dia do período a partir da transição. */
export function pessoasEm6x1NaTransicao(
  pessoas: readonly PessoaDoQuadroApi[],
  dias: readonly string[],
  regras: RegrasDaEscalaApi | undefined,
): PessoaDoQuadroApi[] {
  const transicao = regras?.inicioTransicao ?? "2026-12-16";
  if (regras?.convencao["6x1_autorizada"]) return [];
  return pessoas.filter((p) =>
    dias.some(
      (d) => d >= transicao && escalaDoDia(p.escalas, d)?.modelo === "6x1",
    ),
  );
}
