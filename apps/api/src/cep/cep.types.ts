/**
 * T178 — consulta de CEP para preenchimento assistido de endereço.
 *
 * Decisão da proprietária (2026-10-20): "Autorizo ViaCEP para preenchimento
 * assistido de endereço, somente para CEP brasileiro, com campos editáveis e
 * cadastro manual como alternativa." O navegador nunca fala com o fornecedor:
 * o Evolli consulta por uma rota interna, e o fornecedor fica atrás desta
 * interface — trocá-lo é trocar um adaptador.
 *
 * O que vai ao fornecedor é **só o CEP**. Nada de nome, CPF, telefone, e-mail
 * nem outro dado; a resposta bruta não é persistida, não há cache de endereço
 * em banco e não há consulta em lote.
 */

/** Endereço sugerido pelo fornecedor — tudo opcional, tudo editável na tela. */
export interface EnderecoSugerido {
  /** CEP consultado, só dígitos. */
  cep: string;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  /** Sigla da unidade federativa (duas letras maiúsculas). */
  uf: string | null;
  /** Nome do estado, quando o fornecedor o informa. */
  estado: string | null;
}

/**
 * Resultado da consulta ao fornecedor. `indisponivel` cobre timeout, erro de
 * rede, resposta HTTP de falha e corpo ilegível: para quem cadastra, o efeito
 * é o mesmo — seguir pelo preenchimento manual.
 */
export type ResultadoFornecedorCep =
  | { tipo: "encontrado"; endereco: EnderecoSugerido }
  | { tipo: "inexistente" }
  | { tipo: "indisponivel"; motivo: "timeout" | "falha" };

/** Fornecedor de CEP. Recebe só os 8 dígitos; nunca outro dado. */
export interface FornecedorCep {
  /** Nome técnico do fornecedor, para o registro da consulta. */
  readonly nome: string;
  consultar(cep: string): Promise<ResultadoFornecedorCep>;
}

/** Token de injeção do fornecedor — os testes o substituem por um falso. */
export const FORNECEDOR_CEP = Symbol("FORNECEDOR_CEP");

/** CEP brasileiro: exatamente 8 dígitos, sem máscara. */
export const CEP_BRASILEIRO = /^\d{8}$/;
