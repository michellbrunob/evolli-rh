/**
 * Animação Lottie da tela de abertura (T209).
 *
 * Recebe um carregador do JSON exportado pelo Bodymovin e desenha a animação
 * com o player `lottie_light` (SVG, sem execução de expressões). O player e o
 * JSON chegam sob demanda: enquanto não chegam — ou se falharem — fica a
 * `reserva` (a marca estática).
 *
 * Movimento reduzido: a animação não toca; fica parada no último quadro (o
 * estado final da marca).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/** O conteúdo de um JSON do Bodymovin; o player valida o formato. */
export type DadosDaAnimacao = Record<string, unknown>;

/** `() => import("./arquivo.json")` — ou qualquer função que devolva os dados. */
export type CarregadorDeAnimacao = () => Promise<
  { readonly default: DadosDaAnimacao } | DadosDaAnimacao
>;

export interface AnimacaoLottieProps {
  readonly carregar: CarregadorDeAnimacao;
  readonly reduzirMovimento: boolean;
  /** O que aparece até a animação estar desenhada (e se ela falhar). */
  readonly reserva: ReactNode;
}

function extrairDados(
  modulo: { readonly default: DadosDaAnimacao } | DadosDaAnimacao,
): DadosDaAnimacao {
  return "default" in modulo &&
    typeof modulo.default === "object" &&
    modulo.default !== null
    ? (modulo.default as DadosDaAnimacao)
    : (modulo as DadosDaAnimacao);
}

export function AnimacaoLottie({
  carregar,
  reduzirMovimento,
  reserva,
}: AnimacaoLottieProps) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [desenhada, setDesenhada] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let destruir: (() => void) | null = null;
    setDesenhada(false);

    Promise.all([import("lottie-web/build/player/lottie_light"), carregar()])
      .then(([player, modulo]) => {
        const caixa = caixaRef.current;
        if (cancelado || caixa === null) return;
        const animacao = player.default.loadAnimation({
          container: caixa,
          renderer: "svg",
          loop: !reduzirMovimento,
          autoplay: !reduzirMovimento,
          animationData: extrairDados(modulo),
        });
        destruir = () => animacao.destroy();
        if (reduzirMovimento) {
          animacao.goToAndStop(Math.max(0, animacao.totalFrames - 1), true);
        }
        setDesenhada(true);
      })
      .catch(() => {
        // Sem animação: a marca estática continua. Nada é exibido sobre a
        // falha — a abertura não é lugar de erro, e ela some sozinha.
      });

    return () => {
      cancelado = true;
      destruir?.();
    };
  }, [carregar, reduzirMovimento]);

  return (
    <div
      className="tela-abertura__animacao"
      data-desenhada={desenhada ? "sim" : "nao"}
    >
      {desenhada ? null : reserva}
      <div ref={caixaRef} className="tela-abertura__lottie" />
    </div>
  );
}
