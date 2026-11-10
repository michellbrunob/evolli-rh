/**
 * T207 — exportações reais dos blocos do Dashboard.
 *
 * CSV: o mesmo conteúdo que o bloco mostra, com BOM UTF-8 e ponto e vírgula
 * (abre direto nas planilhas comuns em português). Valor indisponível é "—",
 * nunca zero. Nenhum dado pessoal: só números agregados do bloco.
 *
 * PDF: a impressão nativa do navegador, que oferece "Salvar como PDF". Antes
 * de imprimir, tudo o que não é o bloco escolhido (menu lateral, cabeçalho,
 * outros blocos) sai da impressão; depois dela, a página volta como estava.
 * Nenhuma dependência nova e nenhum arquivo falso.
 */

/** Uma célula do CSV; `null` é dado indisponível. */
export type CelulaDoCsv = string | number | null;

export const INDISPONIVEL_NO_CSV = "—";

const SEPARADOR = ";";
const FIM_DE_LINHA = "\r\n";
/** Marca de ordem de bytes (U+FEFF): planilhas reconhecem o UTF-8. */
const BOM = String.fromCharCode(0xfeff);

function celula(valor: CelulaDoCsv): string {
  const texto = valor === null ? INDISPONIVEL_NO_CSV : String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** O CSV: cabeçalho e linhas, exatamente como recebidos. */
export function montarCsv(
  cabecalho: readonly string[],
  linhas: readonly (readonly CelulaDoCsv[])[],
): string {
  return (
    BOM +
    [cabecalho, ...linhas]
      .map((linha) => linha.map(celula).join(SEPARADOR))
      .join(FIM_DE_LINHA) +
    FIM_DE_LINHA
  );
}

/** "Quadro de colaboradores", "Empresa Ágil", 2026 → "quadro-de-colaboradores-empresa-agil-2026.csv". */
export function nomeDoArquivo(
  partes: readonly (string | number)[],
  extensao: string,
): string {
  const base = partes
    .map((parte) =>
      String(parte)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter((parte) => parte.length > 0)
    .join("-");
  return `${base || "dashboard"}.${extensao}`;
}

/** Baixa o texto como arquivo, pelo próprio navegador. */
export function baixarArquivo(
  conteudo: string,
  nome: string,
  tipo = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Atributo de quem fica fora da impressão (irmãos do caminho até o bloco). */
export const FORA_DA_IMPRESSAO = "data-fora-da-impressao";
/** Atributo do bloco impresso. */
export const BLOCO_IMPRESSO = "data-bloco-impresso";
/** Classe no `<html>` enquanto um bloco é impresso. */
export const CLASSE_IMPRIMINDO = "evolli-imprimindo-bloco";

/** Desfaz a preparação da impressão. Chamar duas vezes não faz mal. */
export function limparImpressao(): void {
  for (const no of document.querySelectorAll(`[${FORA_DA_IMPRESSAO}]`)) {
    no.removeAttribute(FORA_DA_IMPRESSAO);
  }
  for (const no of document.querySelectorAll(`[${BLOCO_IMPRESSO}]`)) {
    no.removeAttribute(BLOCO_IMPRESSO);
  }
  document.documentElement.classList.remove(CLASSE_IMPRIMINDO);
}

/**
 * Prepara a impressão só deste bloco e abre a impressão do navegador. Cada
 * irmão no caminho do bloco até o `<body>` é marcado para sair da impressão;
 * ao fim da impressão (`afterprint`) a marcação é desfeita.
 */
export function imprimirSomente(bloco: HTMLElement): void {
  limparImpressao();
  let atual: HTMLElement = bloco;
  while (atual !== document.body && atual.parentElement) {
    const pai: HTMLElement = atual.parentElement;
    for (const irmao of Array.from(pai.children)) {
      if (irmao !== atual) irmao.setAttribute(FORA_DA_IMPRESSAO, "");
    }
    atual = pai;
  }
  bloco.setAttribute(BLOCO_IMPRESSO, "");
  document.documentElement.classList.add(CLASSE_IMPRIMINDO);
  window.addEventListener("afterprint", limparImpressao, { once: true });
  window.print();
}
