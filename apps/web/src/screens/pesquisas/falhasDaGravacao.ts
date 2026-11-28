/**
 * T216 — a mensagem de uma gravação recusada no assistente de pesquisa
 * (gravar, publicar, gerar, pré-visualizar). Separa o que a pessoa precisa
 * fazer: página desatualizada (403 `csrf_invalido`: tentar de novo), sessão
 * expirada (401 ou renovação do token recusada: entrar de novo), sem
 * permissão (403), pesquisa que mudou (409), campo recusado (422), falha do
 * servidor (5xx) e, só quando o pedido nem chegou, a conexão.
 */
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";

/** `acao`: "gravar a pesquisa", "gerar a pesquisa"… */
export function mensagemDaFalha(erro: unknown, acao: string): string {
  if (falhaPorTokenDesatualizado(erro))
    return `Não foi possível ${acao}: esta página ficou desatualizada. Tente de novo; o que você preencheu foi mantido.`;
  if (falhaPorSessaoExpirada(erro))
    return `Não foi possível ${acao}: sua sessão expirou. Entre de novo para continuar.`;
  if (falhaAoPrepararEnvio(erro))
    return `Não foi possível ${acao}: o pedido não saiu. Verifique a conexão e tente de novo.`;
  const status = (erro as { status?: unknown } | null)?.status;
  if (status === 403)
    return `Não foi possível ${acao}: seu acesso não permite esta ação nesta empresa.`;
  if (status === 409)
    return `Não foi possível ${acao}: a pesquisa mudou de situação. Volte à lista e abra de novo.`;
  if (status === 422)
    return `Não foi possível ${acao}: o servidor recusou algum campo. Revise as etapas e tente de novo.`;
  if (typeof status === "number" && status >= 500)
    return `Não foi possível ${acao}: o servidor teve um problema. Tente de novo em instantes.`;
  if (typeof status === "number")
    return `Não foi possível ${acao}. Tente de novo.`;
  return `Não foi possível ${acao}. Verifique a conexão e tente de novo.`;
}

/**
 * A falha pode passar sozinha (vale tentar de novo sem a pessoa fazer nada):
 * página desatualizada, conexão, pedido que nem saiu e falha do servidor.
 * Sessão expirada, permissão, pesquisa que mudou e campo recusado, não.
 */
export function falhaPassageira(erro: unknown): boolean {
  if (falhaPorTokenDesatualizado(erro)) return true;
  if (falhaPorSessaoExpirada(erro)) return false;
  if (falhaAoPrepararEnvio(erro)) return true;
  const status = (erro as { status?: unknown } | null)?.status;
  return typeof status !== "number" || status >= 500;
}

/** O motivo da falha, em uma frase (o texto de apoio de um aviso). */
export function motivoDaFalha(erro: unknown): string {
  if (falhaPorTokenDesatualizado(erro))
    return "A página ficou desatualizada. Tente de novo.";
  if (falhaPorSessaoExpirada(erro))
    return "Sua sessão expirou. Entre de novo para continuar.";
  if (falhaAoPrepararEnvio(erro))
    return "O pedido não saiu. Verifique a conexão e tente de novo.";
  const status = (erro as { status?: unknown } | null)?.status;
  if (status === 403) return "Seu acesso não permite esta ação nesta empresa.";
  if (status === 409)
    return "A pesquisa mudou de situação. Atualize a página e tente de novo.";
  if (typeof status === "number" && status >= 500)
    return "O servidor teve um problema. Tente de novo em instantes.";
  if (typeof status === "number") return "Atualize a página e tente de novo.";
  return "Verifique a conexão e tente de novo.";
}
