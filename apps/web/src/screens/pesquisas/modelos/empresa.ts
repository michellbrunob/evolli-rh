/**
 * T216 — o marcador `{empresa}` dos textos dos modelos: quem responde vê o
 * nome da empresa; no painel (gaveta, assistente, resultados) e sem nome,
 * "nossa empresa".
 */
const MARCADOR = /\{empresa\}/g;

export function textoComEmpresa(texto: string, empresa: string | null): string {
  const nome = empresa?.trim();
  return texto.replace(MARCADOR, nome ? nome : "nossa empresa");
}

export function textoParaOPainel(texto: string): string {
  return textoComEmpresa(texto, null);
}
