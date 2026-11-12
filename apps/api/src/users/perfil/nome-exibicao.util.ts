/**
 * T208 — Configurações › Meu perfil: o nome de exibição da própria conta
 * (decisões MPA-1 e MPA-10, docs/decisions/t208-dossie-configuracoes-meu-perfil.md).
 *
 * Opcional e global da conta (não por empresa). Sem ele, a interface usa o
 * e-mail. Quando informado:
 *
 * - normalizado: forma Unicode NFC, qualquer espaço (tabulação, quebra de
 *   linha, espaço não separável) vira espaço simples, sequências de espaço
 *   viram um só e as extremidades são removidas;
 * - de 2 a 80 caracteres **depois** da normalização, contados por caractere
 *   (ponto de código), como o `char_length` do banco — um emoji não vale dois;
 * - texto real: ao menos uma letra, e nenhum caractere de controle ou
 *   invisível de formatação.
 *
 * Vazio (ou só espaços) e `null` limpam o nome: a interface volta ao e-mail.
 */

export const NOME_EXIBICAO_MINIMO = 2;
export const NOME_EXIBICAO_MAXIMO = 80;

const ESPACOS = /\s+/gu;
const LETRA = /\p{L}/u;
const CONTROLE_OU_FORMATACAO = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u;

/**
 * Normaliza o valor recebido. `null`, `undefined` e texto vazio (depois de
 * aparar) viram `null`; qualquer outro tipo passa sem mudança, para a
 * validação recusar.
 */
export function normalizarNomeExibicao(valor: unknown): unknown {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== "string") return valor;
  const normalizado = valor.normalize("NFC").replace(ESPACOS, " ").trim();
  return normalizado === "" ? null : normalizado;
}

/** Quantidade de caracteres (pontos de código), como `char_length`. */
export function tamanhoEmCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/**
 * O nome já normalizado é aceitável? `null` é (limpa o nome). Um texto só é
 * se tiver o tamanho certo, ao menos uma letra e nenhum caractere invisível.
 */
export function nomeExibicaoValido(valor: unknown): boolean {
  if (valor === null) return true;
  if (typeof valor !== "string") return false;
  const tamanho = tamanhoEmCaracteres(valor);
  if (tamanho < NOME_EXIBICAO_MINIMO || tamanho > NOME_EXIBICAO_MAXIMO) {
    return false;
  }
  if (!LETRA.test(valor)) return false;
  if (CONTROLE_OU_FORMATACAO.test(valor)) return false;
  return valor === valor.trim();
}
