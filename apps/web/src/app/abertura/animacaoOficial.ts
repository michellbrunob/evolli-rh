/**
 * Tela de abertura — PONTO DE CONEXÃO DA ANIMAÇÃO OFICIAL (Lottie).
 *
 * Ainda não existe animação aprovada no repositório. Enquanto isso, a tela de
 * abertura mostra só a marca do Evolli (`MarcaEvolli`) com uma transição em
 * CSS. Nenhuma animação de terceiros é baixada, copiada ou versionada.
 *
 * Quando a animação oficial (After Effects → Bodymovin) for aprovada:
 *
 * 1. Exporte pelo Bodymovin em JSON, com as imagens embutidas (sem arquivos
 *    externos) e sem expressões — o player usado é o `lottie_light` (SVG),
 *    que não executa expressões.
 * 2. Salve o arquivo exatamente em:
 *    `apps/web/src/app/abertura/animacao-oficial.json`
 * 3. Troque o `null` abaixo por:
 *    `() => import("./animacao-oficial.json")`
 *
 * Só isso. O JSON e o player são carregados sob demanda (fora do pacote
 * principal), a marca estática continua como reserva enquanto carregam ou se
 * algo falhar, e com `prefers-reduced-motion` a animação fica parada no
 * último quadro.
 */
import type { CarregadorDeAnimacao } from "./AnimacaoLottie";

export const carregarAnimacaoOficial: CarregadorDeAnimacao | null = null;
