/**
 * T216 — opções da escolha de grupo (anônima com "Separar respostas por")
 * com nomes repetidos: o nome repetido ganha o código do cadastro entre
 * parênteses, para quem responde diferenciar (ex.: "Comercial (D02)"). A
 * comparação ignora maiúsculas, acentos e espaços nas pontas; os nomes
 * únicos ficam como estão. O painel faz o mesmo no assistente.
 */

const chaveDoNome = (nome: string) =>
  nome
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export function distinguirNomesRepetidos(
  itens: readonly { id: string; nome: string; codigo?: string | null }[],
): { id: string; nome: string }[] {
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
