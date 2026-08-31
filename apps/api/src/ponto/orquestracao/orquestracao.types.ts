/**
 * Tipos do **orquestrador puro** do fluxo de Ponto V1 (T060).
 *
 * TypeScript puro — sem NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. O orquestrador **compõe** os núcleos já integrados
 * (T050 apuração, T052 extrato/saldo, T054 compensação, T057 fechamento, T059
 * fila "Verificar folhas") **em memória**, sobre dados **100% sintéticos**, para
 * **validar os handoffs** do fluxo — nunca para criar regra trabalhista nova nem
 * substituir os núcleos.
 *
 * Fronteiras (herdadas de T050/T052/T054/T057/T059): este orquestrador **não**
 * cria schema, migration, endpoint, controller, módulo Nest, API, banco, fila
 * real, persistência, log, ambiente, UI, upload, importação AFD/TXT ou
 * associação por CPF; **não** calcula dinheiro, pagamento, Folha, salário,
 * adicional, DSR financeiro ou desconto; **não** implementa compensação efetiva,
 * `debito_compensacao` a partir de proposta, quitação, reabertura, correção ou
 * assinatura eletrônica; e **não** declara conformidade com CCT ou Portaria 671.
 */

import {
  ApuracaoDiariaEntrada,
  ResultadoApuracaoDiaria,
} from "../apuracao/apuracao.types";
import { MetaMovimentoApuracao } from "../banco-horas/banco-horas";
import {
  LinhaExtrato,
  MovimentoBancoHoras,
} from "../banco-horas/banco-horas.types";
import { PassoTransicao, ResultadoHistorico } from "../compensacao/compensacao";
import { PropostaCompensacao } from "../compensacao/compensacao.types";
import {
  PassoPeriodo,
  ResultadoHistoricoPeriodo,
} from "../fechamento/fechamento";
import { PeriodoFechamento } from "../fechamento/fechamento.types";
import {
  PassoPendencia,
  ResultadoHistoricoPendencia,
} from "../verificar-folhas/verificar-folhas";
import { Pendencia } from "../verificar-folhas/verificar-folhas.types";

/**
 * Escopo técnico **sintético** compartilhado por toda a simulação. Só
 * referências técnicas: nunca razão social real, nome ou CPF. Serve para checar
 * a **consistência de referências** entre pendências, propostas e fechamento.
 */
export interface EscopoSimulacao {
  /** Referência técnica da empresa (`empresa_id`), nunca razão social real. */
  readonly empresaRef: string;
  /** Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF. */
  readonly vinculoRef: string;
}

/**
 * Um dia sintético a apurar (T050) + a meta técnica dos movimentos derivados
 * **exclusivamente** pelo adaptador de T052. A `entrada` é fornecida pelo
 * chamador; o orquestrador não infere classificação nem gera marcações.
 */
export interface DiaSimulado {
  readonly entrada: ApuracaoDiariaEntrada;
  readonly meta: MetaMovimentoApuracao;
}

/**
 * Uma pendência sintética (T059) + o **percurso humano de RH** a aplicar. As
 * ações são fornecidas pelo chamador; o orquestrador não decide transições nem
 * gera tipos de pendência automaticamente.
 */
export interface PendenciaSimulada {
  readonly inicial: Pendencia;
  readonly passos: readonly PassoPendencia[];
}

/**
 * Uma proposta de compensação sintética (T054) + o **percurso humano de RH** a
 * aplicar. As ações são fornecidas pelo chamador; uma proposta aprovada
 * permanece **sem movimento** (o orquestrador nunca cria `debito_compensacao`).
 */
export interface PropostaSimulada {
  readonly inicial: PropostaCompensacao;
  readonly passos: readonly PassoTransicao[];
}

/**
 * O período de fechamento sintético (T057) + as **ações humanas de RH** a
 * aplicar. O fechamento só percorre estados quando o chamador fornece ações
 * válidas — nunca por saldo, severidade, alerta ou ausência de pendência.
 */
export interface FechamentoSimulado {
  readonly inicial: PeriodoFechamento;
  readonly passos: readonly PassoPeriodo[];
}

/**
 * Entrada **sintética explícita** da simulação. Tudo é fornecido pelo chamador;
 * nada é inferido, gerado automaticamente ou lido de fonte externa.
 */
export interface EntradaOrquestracao {
  readonly escopo: EscopoSimulacao;
  readonly dias: readonly DiaSimulado[];
  readonly pendencias: readonly PendenciaSimulada[];
  readonly propostas: readonly PropostaSimulada[];
  readonly fechamento: FechamentoSimulado;
}

/** Etapa do fluxo em que a simulação foi recusada (endereçamento técnico). */
export type EtapaOrquestracao =
  "escopo" | "apuracao" | "extrato" | "pendencias" | "propostas" | "fechamento";

/** Código de erro **seguro** — rótulo técnico estável, sem dado sensível. */
export type OrquestracaoErroCodigo =
  /** Escopo sintético ausente/vazio (empresaRef/vinculoRef). */
  | "ESCOPO_INVALIDO"
  /** Pendência/proposta/fechamento referenciando escopo diferente do declarado. */
  | "REFERENCIA_INCONSISTENTE"
  /** Um dia não pôde ser apurado (T050 devolveu `invalido`). */
  | "APURACAO_INVALIDA"
  /** O extrato derivado foi rejeitado (T052 devolveu `invalido`). */
  | "EXTRATO_INVALIDO"
  /** Um percurso de pendência falhou (T059 devolveu erro). */
  | "PENDENCIA_INVALIDA"
  /** Um percurso de proposta falhou (T054 devolveu erro). */
  | "PROPOSTA_INVALIDA"
  /** O percurso de fechamento falhou (T057 devolveu erro). */
  | "FECHAMENTO_INVALIDO";

/** Erro de orquestração — só código seguro + etapa/índice técnico. */
export interface ErroOrquestracao {
  readonly codigo: OrquestracaoErroCodigo;
  readonly etapa: EtapaOrquestracao;
  /** Índice 0-based do item que falhou (dia/pendência/proposta), ou `null`. */
  readonly indice: number | null;
}

/**
 * Resumo **derivado** do extrato — só minutos, nunca dinheiro. Reflete o saldo
 * do Banco de Horas derivado **exclusivamente** da apuração (via adaptador
 * T052); pendências, propostas e fechamento **não** o alteram.
 */
export interface ResumoExtrato {
  readonly totalCreditosMinutos: number;
  readonly totalDebitosMinutos: number;
  /** Saldo derivado (créditos − débitos); pode ser negativo. */
  readonly saldoMinutos: number;
  /** Quantidade de movimentos no extrato (todos vindos da apuração). */
  readonly quantidadeMovimentos: number;
}

/**
 * Resultado da simulação — união discriminada por `status`.
 *
 * - `recusado`: **fail-closed** — qualquer núcleo inválido, referência
 *   inconsistente ou ação humana inválida recusa a simulação **inteira**;
 *   nenhum resultado parcial é produzido.
 * - `simulado`: os handoffs percorridos com sucesso — apurações, movimentos
 *   derivados, extrato, resumo de saldo e os históricos de pendências,
 *   propostas e fechamento, cada um preservado da sua própria máquina de estados.
 */
export type ResultadoOrquestracao =
  | {
      readonly status: "recusado";
      readonly erro: ErroOrquestracao;
    }
  | {
      readonly status: "simulado";
      readonly apuracoes: readonly ResultadoApuracaoDiaria[];
      readonly movimentos: readonly MovimentoBancoHoras[];
      readonly extrato: readonly LinhaExtrato[];
      readonly resumo: ResumoExtrato;
      readonly pendencias: readonly ResultadoHistoricoPendencia[];
      readonly propostas: readonly ResultadoHistorico[];
      readonly fechamento: ResultadoHistoricoPeriodo;
    };
