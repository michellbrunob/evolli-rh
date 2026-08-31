/**
 * Orquestrador **puro** do fluxo de Ponto V1 (T060).
 *
 * TypeScript puro — **sem** NestJS, Prisma, I/O, banco, rede, log, variáveis de
 * ambiente ou persistência. **Compõe** os núcleos já integrados para validar os
 * **handoffs** do fluxo, em memória, sobre dados **sintéticos**:
 *
 * - T050 `apurarDiaSintetico` — apuração diária;
 * - T052 `movimentosDeApuracaoDiaria` + `gerarExtratoSintetico` — extrato/saldo;
 * - T054 `aplicarSequencia` — propostas de compensação;
 * - T057 `aplicarSequenciaPeriodo` — fechamento do período;
 * - T059 `aplicarSequenciaPendencia` — fila "Verificar folhas".
 *
 * Handoffs explícitos:
 * - apuração diária → movimentos **separados** de crédito/débito (adaptador T052,
 *   **exclusivo**) → extrato derivado;
 * - as pendências da fila seguem **independentes do saldo**;
 * - as propostas aprovadas permanecem **sem movimento**;
 * - o fechamento só percorre estados quando o chamador fornece as ações humanas.
 *
 * Fronteiras preservadas — o orquestrador **NÃO**:
 * - deixa crédito compensar débito automaticamente (o extrato mantém componentes
 *   separados; o núcleo T052 nunca colapsa num líquido);
 * - cria `debito_compensacao` a partir de proposta aprovada (propostas jamais
 *   alimentam o extrato);
 * - deixa pendência resolvida/descartada alterar o saldo (o saldo deriva só da
 *   apuração);
 * - cria movimento, altera saldo ou captura assinatura no fechamento/Espelho;
 * - fecha automaticamente por saldo, severidade, alerta ou ausência de pendência;
 * - gera tipos de pendência, compensação ou decisão de RH automaticamente;
 * - calcula dinheiro, pagamento, Folha, salário, adicional, DSR financeiro ou
 *   desconto; nem persiste, loga, faz I/O, importação AFD/TXT ou associação por
 *   CPF.
 *
 * **Fail-closed:** qualquer núcleo inválido, referência inconsistente ou ação
 * humana inválida recusa a simulação **inteira** — sem resultado parcial.
 */

import { apurarDiaSintetico } from "../apuracao/apuracao";
import { ResultadoApuracaoDiaria } from "../apuracao/apuracao.types";
import {
  gerarExtratoSintetico,
  movimentosDeApuracaoDiaria,
} from "../banco-horas/banco-horas";
import { MovimentoBancoHoras } from "../banco-horas/banco-horas.types";
import {
  aplicarSequencia,
  ResultadoHistorico,
} from "../compensacao/compensacao";
import { aplicarSequenciaPeriodo } from "../fechamento/fechamento";
import { aplicarSequenciaPendencia } from "../verificar-folhas/verificar-folhas";
import { ResultadoHistoricoPendencia } from "../verificar-folhas/verificar-folhas";
import {
  EntradaOrquestracao,
  EtapaOrquestracao,
  OrquestracaoErroCodigo,
  ResultadoOrquestracao,
} from "./orquestracao.types";

function vazio(valor: unknown): boolean {
  return typeof valor !== "string" || valor.trim().length === 0;
}

function recusar(
  codigo: OrquestracaoErroCodigo,
  etapa: EtapaOrquestracao,
  indice: number | null,
): ResultadoOrquestracao {
  return { status: "recusado", erro: { codigo, etapa, indice } };
}

/**
 * Simula o fluxo de Ponto ponta a ponta, encadeando os handoffs entre os núcleos
 * já integrados. **Não** cria regra trabalhista nova nem substitui os núcleos:
 * apenas os compõe e devolve os resultados de cada etapa, ou recusa a simulação
 * inteira (fail-closed) na primeira inconsistência.
 *
 * @param entrada entrada **sintética explícita** — escopo, dias a apurar,
 *   pendências, propostas e o percurso de fechamento (todos fornecidos pelo
 *   chamador; nada é inferido nem lido de fonte externa).
 */
export function simularFluxoPonto(
  entrada: EntradaOrquestracao,
): ResultadoOrquestracao {
  // ---- 1. Escopo sintético (guarda fail-closed) -----------------------------
  if (
    vazio(entrada?.escopo?.empresaRef) ||
    vazio(entrada?.escopo?.vinculoRef)
  ) {
    return recusar("ESCOPO_INVALIDO", "escopo", null);
  }
  const { empresaRef, vinculoRef } = entrada.escopo;

  // ---- 2. Consistência de referências ---------------------------------------
  // Pendências, propostas e fechamento devem referenciar o mesmo escopo técnico.
  for (const [i, pendencia] of entrada.pendencias.entries()) {
    if (
      pendencia.inicial.empresaRef !== empresaRef ||
      pendencia.inicial.vinculoRef !== vinculoRef
    ) {
      return recusar("REFERENCIA_INCONSISTENTE", "pendencias", i);
    }
  }
  for (const [i, proposta] of entrada.propostas.entries()) {
    if (
      proposta.inicial.empresaRef !== empresaRef ||
      proposta.inicial.vinculoRef !== vinculoRef
    ) {
      return recusar("REFERENCIA_INCONSISTENTE", "propostas", i);
    }
  }
  if (
    entrada.fechamento.inicial.empresaRef !== empresaRef ||
    entrada.fechamento.inicial.vinculoRef !== vinculoRef
  ) {
    return recusar("REFERENCIA_INCONSISTENTE", "fechamento", null);
  }

  // ---- 3. Handoff: apuração diária → movimentos separados (adaptador T052) ---
  const apuracoes: ResultadoApuracaoDiaria[] = [];
  const movimentos: MovimentoBancoHoras[] = [];
  for (const [i, dia] of entrada.dias.entries()) {
    const resultado = apurarDiaSintetico(dia.entrada);
    if (resultado.status !== "apurado") {
      return recusar("APURACAO_INVALIDA", "apuracao", i);
    }
    apuracoes.push(resultado);
    // Movimentos derivados **exclusivamente** pelo adaptador de T052 — crédito e
    // débito separados; o crédito nunca compensa o débito automaticamente.
    for (const movimento of movimentosDeApuracaoDiaria(resultado, dia.meta)) {
      movimentos.push(movimento);
    }
  }

  // ---- 4. Handoff: movimentos → extrato/saldo derivado (T052) ----------------
  const extrato = gerarExtratoSintetico(movimentos);
  if (extrato.status !== "gerado") {
    return recusar("EXTRATO_INVALIDO", "extrato", null);
  }

  // ---- 5. Pendências da fila (independentes do saldo; fail-closed) -----------
  // Um percurso de pendência jamais alimenta o extrato nem altera o saldo.
  const pendencias: ResultadoHistoricoPendencia[] = [];
  for (const [i, pendencia] of entrada.pendencias.entries()) {
    const historico = aplicarSequenciaPendencia(
      pendencia.inicial,
      pendencia.passos,
    );
    if (historico.erro !== null) {
      return recusar("PENDENCIA_INVALIDA", "pendencias", i);
    }
    pendencias.push(historico);
  }

  // ---- 6. Propostas de compensação (aprovada = sem movimento; fail-closed) ---
  // Nenhum movimento é derivado de proposta: `debito_compensacao` não é criado
  // aqui (permanece pendente e fora do escopo — T053 §2/§6).
  const propostas: ResultadoHistorico[] = [];
  for (const [i, proposta] of entrada.propostas.entries()) {
    const historico = aplicarSequencia(proposta.inicial, proposta.passos);
    if (historico.erro !== null) {
      return recusar("PROPOSTA_INVALIDA", "propostas", i);
    }
    propostas.push(historico);
  }

  // ---- 7. Fechamento do período (só com ações humanas fornecidas) ------------
  // Só percorre estados pelas ações do chamador; nunca fecha automaticamente por
  // saldo, severidade, alerta ou ausência de pendência. Não cria movimento, não
  // altera saldo e não captura assinatura (T056 §2/§5/§6).
  const fechamento = aplicarSequenciaPeriodo(
    entrada.fechamento.inicial,
    entrada.fechamento.passos,
  );
  if (fechamento.erro !== null) {
    return recusar("FECHAMENTO_INVALIDO", "fechamento", null);
  }

  // ---- Resultado consolidado (saldo derivado só da apuração) -----------------
  return {
    status: "simulado",
    apuracoes,
    movimentos,
    extrato: extrato.linhas,
    resumo: {
      totalCreditosMinutos: extrato.totalCreditosMinutos,
      totalDebitosMinutos: extrato.totalDebitosMinutos,
      saldoMinutos: extrato.saldoMinutos,
      quantidadeMovimentos: movimentos.length,
    },
    pendencias,
    propostas,
    fechamento,
  };
}
