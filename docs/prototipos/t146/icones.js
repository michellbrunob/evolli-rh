/**
 * Ícones do protótipo (T146) — SVG em traço, desenhados aqui.
 *
 * Nada de emoji e nada de biblioteca: a 1ª versão usava glifos tipográficos
 * (◉ ◎ ◷ …) como se fossem ícones, e eles chegavam ao olho com pesos e
 * tamanhos arbitrários, parecendo ruído decorativo. Formas geométricas simples,
 * no mesmo traço e na mesma caixa, pertencem ao mesmo sistema.
 *
 * `currentColor` de propósito: o ícone acompanha o estado do item e nunca
 * carrega significado sozinho — sempre há rótulo ao lado.
 */
const caixa = (miolo) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        focusable="false">${miolo}</svg>`;

export const ICONES = {
  /** Início: painel dividido. */
  inicio: caixa(
    '<rect x="3" y="3" width="7.5" height="8.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="3" y="14.5" width="7.5" height="6.5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/>',
  ),
  /** Pessoas: duas silhuetas. */
  pessoas: caixa(
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.1 2.5-5.4 5.5-5.4s5.5 2.3 5.5 5.4"/><path d="M16.2 5.3a3.2 3.2 0 0 1 0 6"/><path d="M17.5 14.9c1.9.6 3.2 2.3 3.2 4.6"/>',
  ),
  /** Jornada: relógio. */
  jornada: caixa(
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.2 2"/>',
  ),
  /** Ausências: calendário com dia vazado. */
  ausencias: caixa(
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.8h17M8 3v4M16 3v4"/><path d="M10.4 14.6h3.2"/>',
  ),
  /** Solicitações: folha com linhas. */
  solicitacoes: caixa(
    '<path d="M6 3.5h7.5L19 9v11.5H6z"/><path d="M13.3 3.5V9H19"/><path d="M9 13h7M9 16.6h4.6"/>',
  ),
  /** Benefícios: caixa com laço. */
  beneficios: caixa(
    '<rect x="3.5" y="8.5" width="17" height="12" rx="1.8"/><path d="M3.5 13h17M12 8.5v12"/><path d="M12 8.5c-2.6 0-4-1-4-2.4S9.2 3.5 12 8.5zM12 8.5c2.6 0 4-1 4-2.4S14.8 3.5 12 8.5z"/>',
  ),
  /** Clima e desenvolvimento: linha ascendente. */
  clima: caixa(
    '<path d="M3.5 20.5V4"/><path d="M3.5 20.5H21"/><path d="M7 16.5l3.8-4.6 3.2 2.6 4.4-6"/>',
  ),
  /** Relatórios: colunas. */
  relatorios: caixa(
    '<rect x="3.5" y="4" width="17" height="16.5" rx="2"/><path d="M8 16.4v-4M12 16.4V8.6M16 16.4v-2.6"/>',
  ),
  /** Administração: engrenagem simplificada. */
  administracao: caixa(
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9M18.5 18.5l-1.9-1.9M7.4 7.4 5.5 5.5"/>',
  ),

  /** Sinais de estado usados em avisos — nunca sozinhos, sempre com texto. */
  alerta: caixa(
    '<path d="M12 4.2 21 19.4H3z"/><path d="M12 10v4M12 16.6v.1"/>',
  ),
  certo: caixa(
    '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.2l2.6 2.6 5-5.4"/>',
  ),
  info: caixa(
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.4M12 7.8v.1"/>',
  ),
  mais: caixa('<path d="M12 5.5v13M5.5 12h13"/>'),
  busca: caixa(
    '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4 20 20"/>',
  ),
};
