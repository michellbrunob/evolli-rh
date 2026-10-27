/**
 * Rótulos de movimentação funcional — fonte única para as telas que mostram
 * movimentações: o Histórico funcional (T115), que as opera, e a seção "Vida
 * funcional" da ficha (T187), que só as lê. Antes da T187 viviam dentro do
 * Histórico funcional; duas cópias divergiriam no primeiro rótulo corrigido.
 */
import type { StatusVariant } from "../../components";
import type {
  MotivoMovimentacao,
  StatusMovimentacao,
  TipoMovimentacao,
} from "../../api/movimentacaoClient";

export const ROTULO_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  admissao: "Admissão",
  transferencia_organizacional: "Transferência organizacional",
  mudanca_cargo: "Mudança de cargo",
  desligamento: "Desligamento",
};

export const ROTULO_STATUS_MOVIMENTACAO: Record<StatusMovimentacao, string> = {
  solicitada: "Solicitada",
  programada: "Programada",
  efetivada: "Efetivada",
  cancelada: "Cancelada",
  retificada: "Retificada",
};

export const VARIANTE_STATUS_MOVIMENTACAO: Record<
  StatusMovimentacao,
  StatusVariant
> = {
  solicitada: "info",
  programada: "info",
  efetivada: "success",
  cancelada: "neutral",
  retificada: "neutral",
};

export const ROTULO_MOTIVO: Record<MotivoMovimentacao, string> = {
  admissao_inicial: "Admissão inicial",
  reestruturacao_organizacional: "Reestruturação organizacional",
  realocacao_interna: "Realocação interna",
  promocao: "Promoção",
  correcao_cadastral: "Correção cadastral",
  encerramento_de_vinculo: "Encerramento de vínculo",
  outro_controlado: "Outro (controlado)",
};
