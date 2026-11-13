/**
 * T208 — regras do nome de exibição na tela, espelho das do servidor
 * (`apps/api/src/users/perfil/nome-exibicao.util.ts`). O servidor continua
 * sendo quem decide; aqui elas existem para a pessoa saber o motivo antes de
 * enviar, e para "só espaços a mais" não contar como alteração.
 */

export const NOME_EXIBICAO_MINIMO = 2;
export const NOME_EXIBICAO_MAXIMO = 80;

const ESPACOS = /\s+/gu;
const LETRA = /\p{L}/u;
const CONTROLE_OU_FORMATACAO = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u;

/** NFC, espaços juntados e aparados; vazio vira `null` (limpa o nome). */
export function normalizarNomeExibicao(valor: string): string | null {
  const normalizado = valor.normalize("NFC").replace(ESPACOS, " ").trim();
  return normalizado === "" ? null : normalizado;
}

/** Quantidade de caracteres (pontos de código), como o servidor conta. */
export function tamanhoEmCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/** O motivo da recusa do nome já normalizado, ou `null` se ele vale. */
export function erroDoNomeExibicao(nome: string | null): string | null {
  if (nome === null) return null;
  const tamanho = tamanhoEmCaracteres(nome);
  if (tamanho < NOME_EXIBICAO_MINIMO) {
    return "Use ao menos 2 caracteres, ou deixe em branco para usar o e-mail.";
  }
  if (tamanho > NOME_EXIBICAO_MAXIMO) {
    return `Use no máximo 80 caracteres (agora são ${tamanho}).`;
  }
  if (CONTROLE_OU_FORMATACAO.test(nome)) {
    return "Remova caracteres invisíveis ou de controle.";
  }
  if (!LETRA.test(nome)) {
    return "Use ao menos uma letra.";
  }
  return null;
}

/**
 * As iniciais que ocupam o lugar da foto: primeira letra do primeiro e do
 * último trecho do nome de exibição — ou, sem nome, da parte do e-mail antes
 * do `@`, partida em `.`, `_` e `-`.
 */
export function iniciaisDe(nome: string | null, email: string): string {
  const base = nome ?? email.split("@")[0] ?? email;
  const trechos = base
    .split(/[\s._-]+/u)
    .map((trecho) => trecho.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter((letra) => letra !== "");
  if (trechos.length === 0) return "?";
  const letras =
    trechos.length === 1
      ? [trechos[0]!]
      : [trechos[0]!, trechos[trechos.length - 1]!];
  return letras.join("").toLocaleUpperCase("pt-BR");
}
