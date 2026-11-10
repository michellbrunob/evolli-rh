/**
 * T207 — gráfico mensal interativo do Dashboard.
 *
 * Cada mês é um botão (uma parada de Tab só para o grupo: o mês "atual" do
 * grupo tem `tabIndex` 0, os outros -1). Ao passar o ponteiro ou focar um
 * mês, aparece um painel com os números REAIS daquele mês. O painel é o
 * `aria-describedby` do botão focado: o leitor de tela ouve o nome do mês e
 * os números dele — só a mudança relevante, nenhuma região viva.
 *
 * Teclado: setas, Home e End percorrem os meses; Escape fecha o painel e o
 * foco fica no mês. O painel fica dentro do quadro (sem posição fixa), então
 * não passa por cima de modal, guarda ou menu, e fica ao lado da coluna
 * (nunca sobre a barra inspecionada, nunca além da borda).
 *
 * As barras continuam decorativas; a tabela equivalente segue embaixo.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { TipoMovimentacao } from "../../api/movimentacaoClient";
import {
  ROTULO_DA_MOVIMENTACAO,
  mesAbreviado,
  nomeDoMes,
} from "./dashboardDados";

export interface GraficoMensalProps {
  readonly ano: number;
  readonly meses: number;
  readonly tipos: readonly TipoMovimentacao[];
  readonly porTipo: Readonly<Record<TipoMovimentacao, readonly number[]>>;
  /** Nome do grupo de meses para o leitor de tela. */
  readonly rotulo: string;
}

function sinal(n: number): string {
  if (n > 0) return `+${String(n)}`;
  if (n < 0) return `−${String(Math.abs(n))}`;
  return "0";
}

export function GraficoMensal({
  ano,
  meses,
  tipos,
  porTipo,
  rotulo,
}: GraficoMensalProps) {
  const prefixo = useId();
  const idPainel = `${prefixo}-painel`;
  const botoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  /** O mês com o painel aberto (ponteiro ou foco), ou nenhum. */
  const [aberto, setAberto] = useState<number | null>(null);
  /** O mês que recebe o Tab do grupo (o último focado). */
  const [daVez, setDaVez] = useState(meses - 1);

  const valor = (t: TipoMovimentacao, i: number) => porTipo[t]?.[i] ?? 0;
  const maximo = Math.max(1, ...tipos.flatMap((t) => [...(porTipo[t] ?? [])]));
  const comSaldo = tipos.includes("admissao") && tipos.includes("desligamento");
  const indices = Array.from({ length: meses }, (_, i) => i);
  const daVezValido = Math.min(Math.max(daVez, 0), meses - 1);

  function focar(i: number) {
    botoesRef.current[i]?.focus();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, i: number) {
    let alvo: number | null = null;
    if (evento.key === "ArrowRight") alvo = Math.min(i + 1, meses - 1);
    if (evento.key === "ArrowLeft") alvo = Math.max(i - 1, 0);
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = meses - 1;
    if (evento.key === "Escape") {
      if (aberto !== null) {
        evento.preventDefault();
        setAberto(null);
      }
      return;
    }
    if (alvo === null) return;
    evento.preventDefault();
    focar(alvo);
  }

  /** Ao lado da coluna: à direita na primeira metade, à esquerda na segunda. */
  const alinhamento =
    aberto === null ? "" : aberto < Math.ceil(meses / 2) ? "depois" : "antes";

  return (
    <div
      className="dashboard__grafico"
      onMouseLeave={() => {
        const ativo = document.activeElement;
        const focado = botoesRef.current.findIndex((b) => b === ativo);
        setAberto(focado >= 0 ? focado : null);
      }}
    >
      <div className="dashboard__legenda" aria-hidden="true">
        {tipos.map((t) => (
          <span key={t}>
            <span className={`dashboard__marca dashboard__marca--${t}`} />
            {ROTULO_DA_MOVIMENTACAO[t]}
          </span>
        ))}
      </div>
      <div className="dashboard__area-grafico">
        <div className="dashboard__colunas" role="group" aria-label={rotulo}>
          {indices.map((i) => (
            <button
              key={i}
              type="button"
              ref={(no) => {
                botoesRef.current[i] = no;
              }}
              className={
                aberto === i
                  ? "dashboard__coluna dashboard__coluna--aberta"
                  : "dashboard__coluna"
              }
              tabIndex={i === daVezValido ? 0 : -1}
              aria-describedby={aberto === i ? idPainel : undefined}
              onFocus={() => {
                setDaVez(i);
                setAberto(i);
              }}
              onBlur={(evento) => {
                const destino = evento.relatedTarget;
                if (
                  !(destino instanceof Node) ||
                  !botoesRef.current.some((b) => b === destino)
                ) {
                  setAberto(null);
                }
              }}
              onMouseEnter={() => setAberto(i)}
              onKeyDown={(evento) => aoTeclar(evento, i)}
            >
              <span className="dashboard__barras" aria-hidden="true">
                {tipos.map((t) => (
                  <span
                    key={t}
                    className={`dashboard__barra-mes dashboard__barra-mes--${t}`}
                    style={{ height: `${(valor(t, i) / maximo) * 100}%` }}
                  />
                ))}
              </span>
              <span className="dashboard__mes" aria-hidden="true">
                {mesAbreviado(i)}
              </span>
              <span className="dashboard__so-leitor">
                {nomeDoMes(i)} de {ano}
              </span>
            </button>
          ))}
        </div>
        {aberto !== null ? (
          <div
            id={idPainel}
            role="tooltip"
            className={`dashboard__dica-mes dashboard__dica-mes--${alinhamento}`}
            style={{
              ["--coluna" as string]: String(aberto),
              ["--colunas" as string]: String(meses),
            }}
          >
            <p className="dashboard__dica-mes-titulo">
              {nomeDoMes(aberto)} de {ano}
            </p>
            <dl className="dashboard__dica-mes-lista">
              {tipos.map((t) => (
                <div key={t}>
                  <dt>
                    <span
                      className={`dashboard__marca dashboard__marca--${t}`}
                      aria-hidden="true"
                    />
                    {ROTULO_DA_MOVIMENTACAO[t]}
                  </dt>
                  <dd>{valor(t, aberto)}</dd>
                </div>
              ))}
              {comSaldo ? (
                <div>
                  <dt>Diferença</dt>
                  <dd>
                    {sinal(
                      valor("admissao", aberto) - valor("desligamento", aberto),
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
