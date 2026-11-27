import type {
  Identificacao,
  MotivoIndisponivel,
  StatusPesquisa,
} from "./pesquisas.types";

/**
 * T216 — regras de status da pesquisa. Sem job: o prazo vencido é
 * calculado na leitura (`encerraEm` antes de hoje conta como finalizada).
 */

/** O status que a tela vê. `encerraEm` vale o dia inteiro. */
export function statusEfetivo(
  status: StatusPesquisa,
  encerraEm: string | null,
  hoje: string,
): StatusPesquisa {
  if (
    (status === "ativa" || status === "pausada") &&
    encerraEm !== null &&
    encerraEm < hoje
  ) {
    return "finalizada";
  }
  return status;
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

/** O aviso da página pública; `null` quando aceita resposta. */
export function motivoIndisponivel(
  efetivo: StatusPesquisa,
): MotivoIndisponivel | null {
  switch (efetivo) {
    case "ativa":
      return null;
    case "pausada":
      return "pausada";
    case "finalizada":
      return "encerrada";
    case "cancelada":
      return "cancelada";
    default:
      return "inexistente";
  }
}

/** Cerca de 20 segundos por pergunta; no mínimo 1 minuto. */
export function minutosEstimados(totalPerguntas: number): number {
  return Math.max(1, Math.ceil(totalPerguntas / 3));
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
