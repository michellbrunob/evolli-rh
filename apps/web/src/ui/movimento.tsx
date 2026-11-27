/**
 * T215 — peças do movimento da interface (o CSS mora em `movimento.css`):
 *
 * - `NumeroSuave`: o valor novo entra deslizando de leve (para cima quando
 *   aumenta, para baixo quando diminui); o primeiro valor aparece parado;
 * - `Esqueleto`: linhas que pulsam enquanto o conteúdo carrega, com o texto
 *   para leitor de tela;
 * - `Revelar`: o conteúdo carregado surge (opacidade e foco);
 * - `AvisoAnimado`: a mensagem de resultado sobe de leve; no sucesso, um ✓
 *   se desenha;
 *
 * O movimento das abas (de todas) mora em `movimentoDasAbas.ts`.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function NumeroSuave({
  valor,
  formatar = (v) => String(v),
  className,
}: {
  readonly valor: number;
  readonly formatar?: (valor: number) => string;
  readonly className?: string;
}) {
  const anterior = useRef<number | null>(null);
  const [estado, setEstado] = useState<{
    chave: number;
    direcao: "sobe" | "desce" | null;
  }>({ chave: 0, direcao: null });

  useLayoutEffect(() => {
    const antes = anterior.current;
    anterior.current = valor;
    if (antes === null || antes === valor) return;
    setEstado((e) => ({
      chave: e.chave + 1,
      direcao: valor > antes ? "sobe" : "desce",
    }));
  }, [valor]);

  return (
    <span
      // A chave nova reinicia a animação a cada troca.
      key={estado.chave}
      className={[
        "ev-numero",
        estado.direcao ? "ev-numero--mudou" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...(estado.direcao ? { "data-direcao": estado.direcao } : {})}
    >
      {formatar(valor)}
    </span>
  );
}

/**
 * As linhas só aparecem se a espera passar de `atrasoMs`: numa busca
 * rápida, o conteúdo entra direto, num movimento só (como na aba Dados).
 * O texto para leitor de tela está sempre lá.
 */
export function Esqueleto({
  rotulo,
  linhas = 4,
  atrasoMs = 300,
}: {
  readonly rotulo: string;
  readonly linhas?: number;
  readonly atrasoMs?: number;
}) {
  const [visivel, setVisivel] = useState(atrasoMs <= 0);
  useEffect(() => {
    if (atrasoMs <= 0) return;
    const espera = window.setTimeout(() => setVisivel(true), atrasoMs);
    return () => window.clearTimeout(espera);
  }, [atrasoMs]);
  return (
    <div className="ev-esqueleto" role="status" aria-busy="true">
      <span className="ev:sr-only">{rotulo}</span>
      {visivel
        ? Array.from({ length: linhas }, (_, i) => (
            <span key={i} className="ev-esqueleto__linha" aria-hidden="true" />
          ))
        : null}
    </div>
  );
}

export function Revelar({ children }: { readonly children: ReactNode }) {
  return <div className="ev-revelar">{children}</div>;
}

/** A mensagem diz que algo não deu certo? (Sem ✓ nesse caso.) */
export function ehAvisoDeFalha(mensagem: string): boolean {
  return /^não |não foi|não deu/i.test(mensagem.trim());
}

export function AvisoAnimado({
  mensagem,
  tipo = "sucesso",
  className,
}: {
  readonly mensagem: string;
  readonly tipo?: "sucesso" | "neutro";
  readonly className?: string;
}) {
  return (
    <p role="status" aria-live="polite" className={className}>
      {mensagem ? (
        <span key={mensagem} className={`ev-aviso ev-aviso--${tipo}`}>
          {tipo === "sucesso" ? (
            <svg
              className="ev-aviso__check"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3.5 8.5l3 3 6-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
              />
            </svg>
          ) : null}
          {mensagem}
        </span>
      ) : null}
    </p>
  );
}
