/**
 * Tela de abertura institucional (T209).
 *
 * Aparece só no começo da sessão: enquanto a sessão é verificada ao recarregar
 * a página e, depois de um login aceito, enquanto o acesso (papel, empresa
 * ativa e tela inicial) é carregado. Não aparece na navegação interna nem na
 * troca de empresa. Quem decide quando mostrar é `AutenticacaoApp`.
 *
 * Hoje mostra a assinatura vertical oficial do Evolli (T210, `MarcaEvolli`,
 * arquivo local da pasta de marca) com uma transição em
 * CSS. A animação oficial em Lottie entra por `carregarAnimacaoOficial`
 * (ver `animacaoOficial.ts` — é lá que o `.json` do Bodymovin se conecta).
 *
 * Acessibilidade: a mensagem é uma região `role="status"` (o leitor de tela
 * ouve "Verificando sessão…" ou "Carregando seu acesso…"); a marca é
 * decorativa. Nada aqui recebe foco: quem leva o foco ao título é a tela que
 * nasce depois.
 */
import { useEffect, useState } from "react";
import { MarcaEvolli } from "../marca/MarcaEvolli";
import { AnimacaoLottie, type CarregadorDeAnimacao } from "./AnimacaoLottie";
import { carregarAnimacaoOficial } from "./animacaoOficial";
import "./TelaDeAbertura.css";

const CONSULTA_MOVIMENTO_REDUZIDO = "(prefers-reduced-motion: reduce)";

/** `prefers-reduced-motion`, acompanhando mudanças enquanto a tela existe. */
export function usePrefereMovimentoReduzido(): boolean {
  const [reduzir, setReduzir] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const consulta = window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO);
    const aoMudar = () => setReduzir(consulta.matches);
    consulta.addEventListener?.("change", aoMudar);
    return () => consulta.removeEventListener?.("change", aoMudar);
  }, []);
  return reduzir;
}

export interface TelaDeAberturaProps {
  /** O que o leitor de tela ouve (e o que aparece sob a marca). */
  readonly mensagem: string;
  /**
   * A animação a desenhar no lugar da marca estática. Padrão: a oficial
   * (`animacaoOficial.ts`), que ainda não existe — então, a marca.
   */
  readonly carregarAnimacao?: CarregadorDeAnimacao | null;
}

export function TelaDeAbertura({
  mensagem,
  carregarAnimacao = carregarAnimacaoOficial,
}: TelaDeAberturaProps) {
  const reduzirMovimento = usePrefereMovimentoReduzido();
  const marca = (
    <span className="tela-abertura__marca-estatica">
      <MarcaEvolli variante="vertical" decorativa />
    </span>
  );
  return (
    <div
      className="tela-abertura"
      data-movimento={reduzirMovimento ? "reduzido" : "normal"}
    >
      <div className="tela-abertura__marca" aria-hidden="true">
        {carregarAnimacao ? (
          <AnimacaoLottie
            carregar={carregarAnimacao}
            reduzirMovimento={reduzirMovimento}
            reserva={marca}
          />
        ) : (
          marca
        )}
      </div>
      <p className="tela-abertura__mensagem" role="status">
        {mensagem}
      </p>
    </div>
  );
}
