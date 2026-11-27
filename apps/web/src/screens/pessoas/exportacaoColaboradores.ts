/**
 * T215 — "Exportar" da lista de Colaboradores: a consulta atual (aba, busca e
 * filtros), todas as páginas, em Excel (.xlsx gerado no navegador) ou em
 * PDF (a impressão do navegador, que oferece "Salvar como PDF").
 *
 * Só o que a lista já recebeu do servidor, com a permissão de quem exporta:
 * CPF, contatos e salário só aparecem se o servidor os mandou.
 */
import type {
  ColaboradorListadoApi,
  ListarColaboradoresQuery,
  VinculoListadoApi,
} from "../../api/colaboradoresClient";
import { listarColaboradores } from "../../api/colaboradoresClient";
import { formatarDiaCivil } from "../../format/data";
import { exibirTelefone } from "../../format/mascaras";
import { mascararCpf } from "./NovaAdmissaoScreen";
import { formatarReais } from "./salarioLiquido";

/** O item da lista com os dados que a página e a exportação mostram. */
export type ColaboradorDaLista = ColaboradorListadoApi & {
  readonly cpf?: string | null;
  readonly contatos?: {
    readonly emailPessoal: string | null;
    readonly celular: string | null;
  } | null;
  readonly salarioBruto?: string | null;
  readonly desativado?: boolean;
};

/** Teto de páginas lidas numa exportação (100 por página). */
const PAGINAS_NO_MAXIMO = 100;

/** Lê todas as páginas da consulta (a mesma da tela), 100 por vez. */
export async function lerTudoParaExportar(
  consulta: Omit<ListarColaboradoresQuery, "pagina" | "tamanhoPagina">,
): Promise<ColaboradorDaLista[]> {
  const itens: ColaboradorDaLista[] = [];
  for (let pagina = 1; pagina <= PAGINAS_NO_MAXIMO; pagina += 1) {
    const resp = await listarColaboradores({
      ...consulta,
      pagina,
      tamanhoPagina: 100,
    });
    itens.push(...(resp.itens as ColaboradorDaLista[]));
    if (itens.length >= resp.total || resp.itens.length === 0) break;
  }
  return itens;
}

export const COLUNAS_DA_EXPORTACAO = [
  "Nome",
  "Cargo",
  "Departamento",
  "CPF",
  "E-mail pessoal",
  "Telefone",
  "Matrícula",
  "Tipo de contrato",
  "Situação",
  "Admissão",
  "Desligamento",
  "Salário bruto",
] as const;

/** O vínculo que a linha mostra: o ativo, senão o previsto, senão o primeiro. */
export function vinculoPrincipalDaLista(
  c: ColaboradorListadoApi,
): VinculoListadoApi | null {
  return (
    c.vinculos.find((v) => v.situacao === "ativo") ??
    c.vinculos.find((v) => v.situacao === "previsto") ??
    c.vinculos[0] ??
    null
  );
}

export function situacaoDaLista(c: ColaboradorDaLista): string {
  if (c.desativado) return "Inativo";
  if (c.vinculos.some((v) => v.situacao === "ativo")) return "Ativo";
  if (c.vinculos.some((v) => v.situacao === "previsto")) return "Em admissão";
  if (c.vinculos.some((v) => v.situacao === "encerrado")) return "Desligado";
  return c.situacao === "ativo" ? "Ativo" : "Inativo";
}

/** As linhas da planilha e do relatório (texto, como a tela mostra). */
export function linhasDaExportacao(
  itens: readonly ColaboradorDaLista[],
  rotuloDoTipo: (tipo: string) => string,
): string[][] {
  return itens.map((c) => {
    const v = vinculoPrincipalDaLista(c);
    return [
      c.nome,
      v?.lotacaoVigente?.cargo?.nome ?? "",
      v?.lotacaoVigente?.departamento?.nome ?? "",
      c.cpf ? mascararCpf(c.cpf) : "",
      c.contatos?.emailPessoal ?? "",
      exibirTelefone(c.contatos?.celular),
      v?.matricula ?? "",
      v ? rotuloDoTipo(v.tipo) : "",
      situacaoDaLista(c),
      v ? formatarDiaCivil(v.dataAdmissao) : "",
      v?.dataDesligamento ? formatarDiaCivil(v.dataDesligamento) : "",
      c.salarioBruto ? `R$ ${formatarReais(Number(c.salarioBruto))}` : "",
    ];
  });
}
