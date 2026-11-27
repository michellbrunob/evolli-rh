import type {
  Identificacao,
  MotivoIndisponivel,
  StatusPesquisa,
} from "./pesquisas.types";

/**
 * T216 — regras de status da pesquisa. Sem job: o prazo vencido é
 * calculado na leitura (o instante de `encerraEm` já passou: finalizada).
 */

/**
 * Fuso de Brasília. O Brasil não tem horário de verão desde 2019: o
 * deslocamento é fixo.
 */
export const FUSO_BRASILIA = "-03:00";
const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;
const ENCERRAMENTO = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/;

/** Os campos de data e hora de um instante, no horário de Brasília. */
function emBrasilia(d: Date): { dia: string; hora: string } {
  const iso = new Date(d.getTime() - DESLOCAMENTO_MS).toISOString();
  return { dia: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/**
 * `AAAA-MM-DDTHH:mm` (horário de Brasília) → o instante. Só a data (formato
 * antigo) vale até 23:59 daquele dia. `null` se a data ou a hora não existem.
 */
export function lerEncerramento(v: string): Date | null {
  const m = ENCERRAMENTO.exec(v);
  if (!m) return null;
  const dia = m[1]!;
  const hora = m[2] ?? "23:59";
  const d = new Date(`${dia}T${hora}:00${FUSO_BRASILIA}`);
  if (Number.isNaN(d.getTime())) return null;
  const volta = emBrasilia(d);
  return volta.dia === dia && volta.hora === hora ? d : null;
}

/** O instante em ISO com o fuso de Brasília (`AAAA-MM-DDTHH:mm:ss-03:00`). */
export function formatarEncerramento(d: Date): string {
  const iso = new Date(d.getTime() - DESLOCAMENTO_MS).toISOString();
  return `${iso.slice(0, 19)}${FUSO_BRASILIA}`;
}

/** Ativa ou pausada com o instante do prazo já passado. */
export function prazoVencido(
  status: StatusPesquisa,
  encerraEm: Date | null,
  agora: Date,
): boolean {
  return (
    (status === "ativa" || status === "pausada") &&
    encerraEm !== null &&
    encerraEm.getTime() < agora.getTime()
  );
}

/** O status que a tela vê. */
export function statusEfetivo(
  status: StatusPesquisa,
  encerraEm: Date | null,
  agora: Date,
): StatusPesquisa {
  return prazoVencido(status, encerraEm, agora) ? "finalizada" : status;
}

/** Só rascunho, ativa e pausada editam. */
export function podeEditar(efetivo: StatusPesquisa): boolean {
  return efetivo === "rascunho" || efetivo === "ativa" || efetivo === "pausada";
}

/**
 * Transições pelo menu de status (`POST /status`). Rascunho → ativa só pelo
 * Publicar; finalizada e cancelada não voltam.
 */
const TRANSICOES: Readonly<Record<StatusPesquisa, readonly StatusPesquisa[]>> =
  {
    rascunho: [],
    ativa: ["pausada", "finalizada", "cancelada"],
    pausada: ["ativa", "finalizada", "cancelada"],
    finalizada: [],
    cancelada: [],
  };

export function transicaoValida(
  efetivo: StatusPesquisa,
  novo: StatusPesquisa,
): boolean {
  return TRANSICOES[efetivo].includes(novo);
}

/**
 * O aviso da página pública; `null` quando aceita resposta. `finalizada` é
 * a encerrada à mão; `encerrada`, a do prazo vencido.
 */
export function motivoIndisponivel(
  status: StatusPesquisa,
  encerraEm: Date | null,
  agora: Date,
): MotivoIndisponivel | null {
  if (prazoVencido(status, encerraEm, agora)) return "encerrada";
  switch (status) {
    case "ativa":
      return null;
    case "pausada":
      return "pausada";
    case "finalizada":
      return "finalizada";
    case "cancelada":
      return "cancelada";
    default:
      return "inexistente";
  }
}

/**
 * 20 segundos por pergunta, arredondado ao minuto mais próximo; no mínimo
 * 1 minuto. A mesma regra da tela.
 */
export function minutosEstimados(totalPerguntas: number): number {
  return Math.max(1, Math.round((totalPerguntas * 20) / 60));
}

/** Identificada e confidencial validam a pessoa (CPF + nascimento). */
export function exigeIdentificacao(i: Identificacao): boolean {
  return i !== "anonima";
}

/** "Ana Maria Souza" → "Ana". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** Só os dígitos do CPF (11) ou `null`. */
export function cpfNormalizado(cpf: string): string | null {
  const d = cpf.replace(/[.\-\s]/g, "");
  return /^\d{11}$/.test(d) ? d : null;
}

/**
 * O participante consegue se identificar pelo link? O `identificar` exige
 * CPF e data de nascimento no perfil pessoal (na empresa). Na anônima não há
 * identificação: sempre.
 */
export function identificavelPeloLink(
  identificacao: Identificacao,
  perfil: { cpf: string | null; dataNascimento: Date | null } | null,
): boolean {
  if (!exigeIdentificacao(identificacao)) return true;
  return !!perfil && !!perfil.cpf && perfil.dataNascimento !== null;
}
