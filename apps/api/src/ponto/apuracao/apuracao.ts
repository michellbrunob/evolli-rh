/**
 * Núcleo puro de apuração diária de jornada e banco de horas (Ponto V1, T050).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log ou variáveis
 * de ambiente. Recebe estruturas sintéticas em memória e devolve, em memória,
 * os componentes da apuração do dia **em minutos** e apontamentos **não
 * financeiros**.
 *
 * Contrato: `docs/modules/etapa3-motor-apuracao-puro-v1.md` (T050). Regras
 * usadas: tolerância de 15 min por dia (§4.3), almoço livre ≥ 1h (§4.4),
 * componentes separados de crédito e débito (D2), classificações do dia (§5).
 *
 * Fronteiras rígidas — este núcleo **NÃO**:
 * - calcula dinheiro, DSR financeiro, Folha, saldo acumulado, quitação/
 *   pagamento de banco, fechamento, espelho ou assinatura;
 * - associa marcação a colaborador (CPF), faz parsing/importação, persiste,
 *   chama banco/rede, loga ou toca em NestJS/Prisma;
 * - infere a classificação do dia (é entrada) nem declara conformidade legal.
 */

import {
  ApuracaoDiariaEntrada,
  ApuracaoErroCodigo,
  Apontamento,
  ResultadoApuracaoDiaria,
} from "./apuracao.types";

/** Tolerância diária, em minutos (R3 do caderno; contrato §4.3). */
export const TOLERANCIA_MINUTOS = 15;

/** Intervalo mínimo de almoço livre, em minutos (R4 do caderno; contrato §4.4). */
export const ALMOCO_MINIMO_MINUTOS = 60;

/** `"HH:MM"` 24h — mesma âncora do módulo de horários (`HORA_PATTERN`). */
const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `"HH:MM"` → minutos desde a meia-noite (0..1439), ou `null` se inválido. */
function paraMinutos(hhmm: string): number | null {
  if (!HORA_PATTERN.test(hhmm)) {
    return null;
  }
  const partes = hhmm.split(":");
  const h = partes[0];
  const m = partes[1];
  if (h === undefined || m === undefined) {
    return null;
  }
  return Number(h) * 60 + Number(m);
}

function invalido(codigo: ApuracaoErroCodigo): ResultadoApuracaoDiaria {
  return { status: "invalido", erro: { codigo } };
}

interface FaixaMinutos {
  readonly ini: number;
  readonly fim: number;
}

/**
 * Valida e normaliza as faixas previstas. Faixas em `"HH:MM"`, fim > início,
 * sem sobreposição e em ordem crescente (blocos contíguos são permitidos).
 */
function normalizarFaixas(
  entrada: ApuracaoDiariaEntrada,
): FaixaMinutos[] | ApuracaoErroCodigo {
  const faixas: FaixaMinutos[] = [];
  let fimAnterior = -1;
  for (const faixa of entrada.faixasPrevistas) {
    const ini = paraMinutos(faixa.inicio);
    const fim = paraMinutos(faixa.fim);
    if (ini === null || fim === null) {
      return "FAIXA_HORARIO_INVALIDO";
    }
    if (fim <= ini) {
      return "FAIXA_INTERVALO_INVALIDO";
    }
    if (ini < fimAnterior) {
      return "FAIXA_FORA_DE_ORDEM";
    }
    faixas.push({ ini, fim });
    fimAnterior = fim;
  }
  return faixas;
}

/**
 * Valida e normaliza as marcações. `"HH:MM"`, em ordem cronológica **estrita**
 * (sem repetição). O pareamento (entrada/saída) é feito por ordem.
 */
function normalizarMarcacoes(
  entrada: ApuracaoDiariaEntrada,
): number[] | ApuracaoErroCodigo {
  const marcacoes: number[] = [];
  let anterior = -1;
  for (const marcacao of entrada.marcacoes) {
    const minuto = paraMinutos(marcacao);
    if (minuto === null) {
      return "MARCACAO_HORARIO_INVALIDO";
    }
    if (minuto <= anterior) {
      return "MARCACAO_FORA_DE_ORDEM";
    }
    marcacoes.push(minuto);
    anterior = minuto;
  }
  return marcacoes;
}

function somarJornadaPrevista(faixas: readonly FaixaMinutos[]): number {
  return faixas.reduce((total, faixa) => total + (faixa.fim - faixa.ini), 0);
}

/** Resultado `apurado` para dias sem cálculo por marcação (débito/crédito diretos). */
function apuradoSimples(
  entrada: ApuracaoDiariaEntrada,
  jornadaPrevistaMinutos: number,
  debitoMinutos: number,
  apontamentos: readonly Apontamento[],
): ResultadoApuracaoDiaria {
  return {
    status: "apurado",
    classificacao: entrada.classificacao,
    jornadaPrevistaMinutos,
    tempoEfetivoTrabalhadoMinutos: 0,
    jornadaComputadaMinutos: 0,
    creditoHoraExtraMinutos: 0,
    debitoAtrasoSaidaAntecipadaMinutos: debitoMinutos,
    diferencaNegativaBrutaMinutos: 0,
    toleranciaAplicada: false,
    impactoBanco: { creditoMinutos: 0, debitoMinutos },
    apontamentos,
  };
}

/**
 * Apura um dia `regular`: compara marcações com as faixas previstas, aplica o
 * almoço livre (§4.4) e a tolerância de 15 min por dia (§4.3), mantendo crédito
 * e débito como componentes separados (D2).
 */
function apurarRegular(
  entrada: ApuracaoDiariaEntrada,
  faixas: readonly FaixaMinutos[],
  marcacoes: readonly number[],
  jornadaPrevistaMinutos: number,
): ResultadoApuracaoDiaria {
  // Pareamento estrito: nº de marcações = 2 × nº de faixas.
  if (marcacoes.length !== faixas.length * 2) {
    return invalido("MARCACOES_INCOMPATIVEIS_COM_FAIXAS");
  }

  const almocoLivre = entrada.almocoLivre ?? false;

  let tempoEfetivo = 0;
  let jornadaComputada = 0;
  let totalDeficit = 0;
  let totalExtra = 0;
  let saidaAnterior: number | null = null;

  for (let i = 0; i < faixas.length; i += 1) {
    const faixa = faixas[i];
    const entrada_ = marcacoes[i * 2];
    const saida = marcacoes[i * 2 + 1];
    if (faixa === undefined || entrada_ === undefined || saida === undefined) {
      // Defensivo: os comprimentos já foram conferidos acima.
      return invalido("MARCACOES_INCOMPATIVEIS_COM_FAIXAS");
    }

    // Almoço livre: empurra a entrada efetiva do bloco para garantir ≥ 1h de
    // intervalo desde a saída anterior. O tempo "trabalhado" no almoço curto
    // sai da jornada computada e reaparece pela conta de desvios (§4.4).
    let entradaEfetiva = entrada_;
    if (saidaAnterior !== null && almocoLivre) {
      const intervaloReal = entrada_ - saidaAnterior;
      if (intervaloReal < ALMOCO_MINIMO_MINUTOS) {
        entradaEfetiva = saidaAnterior + ALMOCO_MINIMO_MINUTOS;
      }
    }
    if (entradaEfetiva >= saida) {
      return invalido("ALMOCO_INVERTE_BLOCO");
    }

    tempoEfetivo += saida - entrada_;
    jornadaComputada += saida - entradaEfetiva;

    // Desvios por faixa, usando a entrada efetiva. Débito = atraso + saída
    // antecipada; crédito = entrada/retorno adiantado + saída após o previsto.
    totalDeficit +=
      Math.max(0, entradaEfetiva - faixa.ini) + Math.max(0, faixa.fim - saida);
    totalExtra +=
      Math.max(0, faixa.ini - entradaEfetiva) + Math.max(0, saida - faixa.fim);

    saidaAnterior = saida;
  }

  // Tolerância por dia sobre a soma das diferenças negativas (§4.3): até 15 min
  // → sem débito; acima → débito sobre TODA a diferença negativa (não só o
  // excedente). Crédito de hora extra NÃO compensa o débito (componentes
  // separados, D2).
  const dentroDaTolerancia = totalDeficit <= TOLERANCIA_MINUTOS;
  const debito = dentroDaTolerancia ? 0 : totalDeficit;
  const credito = totalExtra;

  return {
    status: "apurado",
    classificacao: entrada.classificacao,
    jornadaPrevistaMinutos,
    tempoEfetivoTrabalhadoMinutos: tempoEfetivo,
    jornadaComputadaMinutos: jornadaComputada,
    creditoHoraExtraMinutos: credito,
    debitoAtrasoSaidaAntecipadaMinutos: debito,
    diferencaNegativaBrutaMinutos: totalDeficit,
    toleranciaAplicada: totalDeficit > 0 && dentroDaTolerancia,
    impactoBanco: { creditoMinutos: credito, debitoMinutos: debito },
    apontamentos: [],
  };
}

/**
 * Apura um dia a partir de estruturas **sintéticas**, retornando os componentes
 * separados da apuração (ou uma falha segura para entrada inválida).
 *
 * @param entrada faixas previstas, marcações sintéticas, classificação e almoço
 *   livre — todos sintéticos, fornecidos pelo chamador (este núcleo não faz I/O).
 */
export function apurarDiaSintetico(
  entrada: ApuracaoDiariaEntrada,
): ResultadoApuracaoDiaria {
  const faixas = normalizarFaixas(entrada);
  if (!Array.isArray(faixas)) {
    return invalido(faixas);
  }
  const marcacoes = normalizarMarcacoes(entrada);
  if (!Array.isArray(marcacoes)) {
    return invalido(marcacoes);
  }

  const jornadaPrevista = somarJornadaPrevista(faixas);

  switch (entrada.classificacao) {
    case "regular":
      return apurarRegular(entrada, faixas, marcacoes, jornadaPrevista);

    case "falta_injustificada":
      // Débito da jornada prevista + sinalizador NÃO financeiro de DSR (R8).
      return apuradoSimples(entrada, jornadaPrevista, jornadaPrevista, [
        { codigo: "dsr_desconto_sinalizado", financeiro: false },
      ]);

    case "compensacao":
      // Débito proposto da jornada prevista, sem validar saldo (contrato §5).
      return apuradoSimples(entrada, jornadaPrevista, jornadaPrevista, []);

    case "falta_justificada":
    case "feriado":
    case "folga":
    case "ferias":
      // Sem débito de banco, sem crédito, sem apontamento.
      return apuradoSimples(entrada, jornadaPrevista, 0, []);
  }
}
