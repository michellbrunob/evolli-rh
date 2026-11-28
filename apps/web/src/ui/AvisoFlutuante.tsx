/**
 * T215 — aviso flutuante de sucesso, no canto inferior direito da tela (como
 * o da referência ao salvar): ✓, título e um texto curto. Some sozinho depois
 * de alguns segundos ou no "Fechar aviso". É região de status: o leitor de
 * tela anuncia sem mover o foco.
 *
 * T216 — tom de erro ("Não foi possível…"): cor e ícone de erro, e região de
 * alerta (anunciada na hora). Sem tom, é sucesso.
 */
import { useEffect, useId } from "react";
import "./AvisoFlutuante.css";

export interface ConteudoDoAviso {
  /** Muda a cada aviso novo (reinicia o tempo). */
  readonly id: number;
  readonly titulo: string;
  readonly texto?: string;
  /** T215 — uma ação no próprio aviso (ex.: "Desfazer"); usada, o aviso some. */
  readonly acao?: { readonly rotulo: string; readonly onClick: () => void };
  /** T216 — "erro" para falhas; sem tom, sucesso. */
  readonly tom?: "sucesso" | "erro";
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
  const erro = aviso.tom === "erro";
  return (
    <div
      key={aviso.id}
      {...(erro
        ? { role: "alert" }
        : { role: "status", "aria-live": "polite" as const })}
      aria-labelledby={idTitulo}
      className={
        erro ? "aviso-flutuante aviso-flutuante--erro" : "aviso-flutuante"
      }
    >
      <svg
        className="aviso-flutuante__icone"
        data-icone={erro ? "erro" : "sucesso"}
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
        {erro ? (
          <path
            d="M10 5.75v5.25M10 13.75v.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M6.5 10.25l2.25 2.25 4.75-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="aviso-flutuante__textos">
        <p id={idTitulo} className="aviso-flutuante__titulo">
          {aviso.titulo}
        </p>
        {aviso.texto ? (
          <p className="aviso-flutuante__texto">{aviso.texto}</p>
        ) : null}
      </div>
      {aviso.acao ? (
        <button
          type="button"
          className="aviso-flutuante__acao"
          onClick={() => {
            aviso.acao!.onClick();
            onFechar();
          }}
        >
          {aviso.acao.rotulo}
        </button>
      ) : null}
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
