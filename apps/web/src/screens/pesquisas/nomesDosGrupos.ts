/**
 * T216 — opções de "Separar respostas por" com nomes repetidos (dois
 * departamentos "Comercial", por exemplo): quem escolhe precisa diferenciar.
 * O nome repetido ganha o código do cadastro entre parênteses; os demais
 * ficam como estão. A comparação ignora maiúsculas, acentos e espaços nas
 * pontas. A API faz o mesmo na página pública.
 */
import type { OpcaoDeGrupo } from "./servicoDePesquisas";

const chaveDoNome = (nome: string) =>
  nome
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export function distinguirNomesRepetidos(
  itens: readonly {
    readonly id: string;
    readonly nome: string;
    readonly codigo?: string | null;
  }[],
): OpcaoDeGrupo[] {
  const vezes = new Map<string, number>();
  for (const i of itens) {
    const chave = chaveDoNome(i.nome);
    vezes.set(chave, (vezes.get(chave) ?? 0) + 1);
  }
  return itens.map(({ id, nome, codigo }) => ({
    id,
    nome:
      (vezes.get(chaveDoNome(nome)) ?? 0) > 1 && codigo?.trim()
        ? `${nome.trim()} (${codigo.trim()})`
        : nome,
  }));
}
