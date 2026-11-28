/** T216 — cabeçalho do assistente dos modelos com metodologia própria. */
export const CABECALHO_NO_ASSISTENTE: Readonly<
  Record<string, { readonly titulo: string; readonly subtitulo: string }>
> = {
  copsoq: {
    titulo: "Nova pesquisa NR-1",
    subtitulo:
      "Riscos psicossociais · 76 perguntas em 8 domínios · cerca de 15 minutos para responder.",
  },
  isfb: {
    titulo: "Nova pesquisa de Saúde financeira",
    subtitulo:
      "15 perguntas obrigatórias + 3 opcionais · cerca de 6 minutos para responder.",
  },
};
