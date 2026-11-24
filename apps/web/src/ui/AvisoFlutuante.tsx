/**
 * T215 — aviso flutuante de sucesso, no canto inferior direito da tela (como
 * o da referência ao salvar): ✓, título e um texto curto. Some sozinho depois
 * de alguns segundos ou no "Fechar aviso". É região de status: o leitor de
 * tela anuncia sem mover o foco.
 */
import { useEffect, useId } from "react";
import "./AvisoFlutuante.css";

export interface ConteudoDoAviso {
  /** Muda a cada aviso novo (reinicia o tempo). */
  readonly id: number;
  readonly titulo: string;
  readonly texto?: string;
}

export function AvisoFlutuante({
  aviso,
  onFechar,
  duracaoMs = 6000,
}: {
  readonly aviso: ConteudoDoAviso | null;
  readonly onFechar: () => void;
  readonly duracaoMs?: number;
}) {
  const idTitulo = useId();
  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(onFechar, duracaoMs);
    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso?.id, duracaoMs]);

  if (!aviso) return null;
  return (
    <div
      key={aviso.id}
      role="status"
      aria-live="polite"
      aria-labelledby={idTitulo}
      className="aviso-flutuante"
    >
      <svg
        className="aviso-flutuante__icone"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="10"
          r="8.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M6.5 10.25l2.25 2.25 4.75-5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="aviso-flutuante__textos">
        <p id={idTitulo} className="aviso-flutuante__titulo">
          {aviso.titulo}
        </p>
        {aviso.texto ? (
          <p className="aviso-flutuante__texto">{aviso.texto}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="aviso-flutuante__fechar"
        aria-label="Fechar aviso"
        onClick={onFechar}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
