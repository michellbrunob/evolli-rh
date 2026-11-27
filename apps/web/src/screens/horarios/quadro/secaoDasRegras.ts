/**
 * T215 — abrir as Regras da escala já numa seção (como o `?secao=` da
 * referência): quem abre pede a seção e navega; a tela lê o pedido ao montar
 * (sem apagar na leitura, por causa do StrictMode) e o esquece ao desmontar.
 */
export type SecaoDasRegras =
  "jornada" | "convencao" | "feriados" | "avisos" | "publicacao";

let pedida: SecaoDasRegras | null = null;

export function pedirSecaoDasRegras(secao: SecaoDasRegras): void {
  pedida = secao;
}

export function lerSecaoDasRegras(): SecaoDasRegras | null {
  return pedida;
}

export function esquecerSecaoDasRegras(): void {
  pedida = null;
}
