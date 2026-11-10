/**
 * T207 — peças comuns do Dashboard: "Como calculamos" (V-5), o card de
 * indicador sem dado (V-2) e o estado de bloco ou aba sem dado no Evolli.
 */
import { useId, useState, type ReactNode } from "react";

/**
 * "Como calculamos": um botão que abre e fecha a explicação, no fluxo da
 * página. Só em indicador com cálculo real.
 */
export function ComoCalculamos({
  assunto,
  children,
}: {
  readonly assunto: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  return (
    <div className="dashboard__como">
      <button
        type="button"
        className="dashboard__como-botao"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        Como calculamos
        <span className="dashboard__so-leitor">: {assunto}</span>
      </button>
      <div id={id} className="dashboard__como-texto" hidden={!aberto}>
        {children}
      </div>
    </div>
  );
}

/**
 * Card de indicador sem dado: o mesmo molde do card real, com "—" no lugar
 * do número, o estado em texto e o que falta. Sem porcentagem, tendência,
 * comparação nem ação. O "—" é escondido do leitor de tela, que ouve o nome,
 * o estado e a explicação.
 */
export function CartaoSemDado({
  id,
  rotulo,
  selo,
  children,
}: {
  readonly id: string;
  readonly rotulo: string;
  readonly selo: string;
  readonly children: ReactNode;
}) {
  return (
    <article
      className="dashboard__indicador dashboard__indicador--sem-dado"
      aria-labelledby={id}
    >
      <h3 id={id} className="dashboard__indicador-rotulo">
        {rotulo}
      </h3>
      <p className="dashboard__indicador-valor" aria-hidden="true">
        —
      </p>
      <p className="dashboard__selo dashboard__selo--estado">{selo}</p>
      <p className="dashboard__indicador-nota">{children}</p>
    </article>
  );
}

/** Aba sem dado no Evolli: rota real, nenhum número, o porquê. */
export function EstadoIndisponivel({
  titulo,
  texto,
}: {
  readonly titulo: string;
  readonly texto: string;
}) {
  const id = useId();
  return (
    <section className="dashboard__indisponivel" aria-labelledby={id}>
      <h2 id={id} className="dashboard__subtitulo">
        {titulo}
      </h2>
      <p className="dashboard__selo dashboard__selo--estado">
        Indisponível no Evolli
      </p>
      <p className="dashboard__indisponivel-texto">{texto}</p>
    </section>
  );
}

/**
 * Bloco da Visão Geral sem dado: título e subtítulo do bloco, e um quadro
 * com o estado em texto e a explicação. Nenhum número, nenhuma ação.
 */
export function BlocoSemDado({
  titulo,
  subtitulo,
  selo,
  children,
}: {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly selo: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="dashboard__bloco" aria-labelledby={id}>
      <div className="dashboard__bloco-topo">
        <h2 id={id} className="dashboard__subtitulo">
          {titulo}
        </h2>
        <p className="dashboard__explicacao">{subtitulo}</p>
      </div>
      <div className="dashboard__vazio-quadro">
        <p className="dashboard__selo dashboard__selo--estado">{selo}</p>
        <p className="dashboard__vazio-texto">{children}</p>
      </div>
    </section>
  );
}
