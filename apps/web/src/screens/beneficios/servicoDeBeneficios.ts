/**
 * T215 — as chamadas do módulo Benefícios (o shell liga o cliente real; os
 * testes, um falso).
 */
import * as cliente from "../../api/beneficiosClient";

export type ServicoDeBeneficios = Pick<
  typeof cliente,
  | "listarBeneficios"
  | "previaDoBeneficio"
  | "criarBeneficio"
  | "obterBeneficio"
  | "alterarBeneficio"
  | "historicoDoBeneficio"
  | "candidatosDoBeneficio"
  | "adicionarPessoasAoBeneficio"
  | "removerPessoaDoBeneficio"
  | "salvarValoresDoBeneficio"
  | "alterarValoresEmLote"
  | "dependentesDaPessoaNoBeneficio"
  | "salvarDependentesNoPlano"
  | "pausarBeneficio"
  | "encerrarBeneficio"
  | "reativarBeneficio"
  | "excluirBeneficio"
  | "duplicarBeneficio"
>;

export const servicoDeBeneficiosDoServidor: ServicoDeBeneficios = cliente;
