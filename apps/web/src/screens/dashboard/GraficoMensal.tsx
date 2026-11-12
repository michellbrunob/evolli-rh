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
 * não passa por cima de modal, guarda ou menu. Ele abre numa vaga reservada
 * logo abaixo da faixa das colunas, dentro do próprio gráfico, alinhado ao
 * mês: nunca sobre um mês, nunca além da borda, nunca sobre outro bloco.
 *
 * As barras continuam decorativas. Os mesmos números ficam em tabela: na
 * aba Movimentação, logo abaixo do gráfico; no Quadro de colaboradores, na
 * vista de tabela (menu de ações).
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  /** Rótulo de cada tipo (padrão: o da movimentação). */
  readonly rotulos?: Partial<Readonly<Record<TipoMovimentacao, string>>>;
  /**
   * Métricas do mês que ainda não têm fonte: aparecem no painel como
   * "indisponível" — nunca como zero.
   */
  readonly indisponiveis?: readonly string[];
  /** Rótulo da diferença entre admissões e desligamentos. */
  readonly rotuloDoSaldo?: string;
}

/** Onde o painel do mês abre e quantas colunas ele pode ocupar. */
export interface PosicaoDoPainel {
  readonly lado: "depois" | "antes" | "abaixo";
  readonly espaco: number;
}

/**
 * Largura útil mínima ao lado da coluna (px); com menos, abre na largura
 * total. 210 px: a largura natural do painel (cerca de 195 a 204 px, com os
 * rótulos mais longos) mais a folga — ao lado, o texto não quebra e a vaga
 * fica na altura reservada; no celular, os meses do meio usam a largura total.
 */
export const LARGURA_UTIL_MINIMA_DO_PAINEL = 210;

/**
 * Abaixo das colunas, a partir do mês e para o lado com mais colunas livres,
 * com a largura limitada a elas: nunca cobre um mês e nunca passa da borda.
 * Sem lado livre (um mês só) ou sem largura útil nele (gráfico estreito, ano
 * curto), entra no fluxo abaixo das barras, na largura do gráfico.
 * `larguraDoGrafico` é a largura medida em px; 0 (sem layout) vale só a
 * regra das colunas.
 */
export function posicaoDoPainel(
  aberto: number,
  meses: number,
  larguraDoGrafico = 0,
): PosicaoDoPainel {
  const abaixo: PosicaoDoPainel = { lado: "abaixo", espaco: meses };
  if (meses <= 1) return abaixo;
  const direita = meses - aberto - 1;
  const esquerda = aberto;
  const lado: PosicaoDoPainel =
    direita >= esquerda
      ? { lado: "depois", espaco: direita }
      : { lado: "antes", espaco: esquerda };
  if (
    larguraDoGrafico > 0 &&
    (lado.espaco / meses) * larguraDoGrafico < LARGURA_UTIL_MINIMA_DO_PAINEL
  ) {
    return abaixo;
  }
  return lado;
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
  rotulos = {},
  indisponiveis = [],
  rotuloDoSaldo = "Diferença",
}: GraficoMensalProps) {
  const nomeDoTipo = (t: TipoMovimentacao) =>
    rotulos[t] ?? ROTULO_DA_MOVIMENTACAO[t];
  const prefixo = useId();
  const idPainel = `${prefixo}-painel`;
  const botoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  /** O mês com o painel aberto (ponteiro ou foco), ou nenhum. */
  const [aberto, setAberto] = useState<number | null>(null);
  /** Largura do gráfico (px), medida com o painel aberto; 0 sem layout. */
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [largura, setLargura] = useState(0);
  // Antes do desenho: o painel já nasce no lugar certo, e acompanha a
  // largura enquanto estiver aberto.
  useLayoutEffect(() => {
    if (aberto === null) return undefined;
    const medir = () =>
      setLargura(areaRef.current?.getBoundingClientRect().width ?? 0);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [aberto]);
  // Escape fecha o painel de qualquer lugar (WCAG 1.4.13), mesmo aberto só
  // pelo ponteiro e com o foco fora do gráfico; o foco não sai de onde está.
  useEffect(() => {
    if (aberto === null) return undefined;
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") setAberto(null);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);
  /** O mês que recebe o Tab do grupo (o último focado). */
  const [daVez, setDaVez] = useState(meses - 1);

  const valor = (t: TipoMovimentacao, i: number) => porTipo[t]?.[i] ?? 0;
  const maximo = Math.max(1, ...tipos.flatMap((t) => [...(porTipo[t] ?? [])]));
  const comSaldo = tipos.includes("admissao") && tipos.includes("desligamento");
  /** Linhas de texto do painel: título, tipos, saldo e indisponíveis. */
  const linhasDoPainel =
    1 + tipos.length + (comSaldo ? 1 : 0) + indisponiveis.length;
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
    if (alvo === null) return;
    evento.preventDefault();
    focar(alvo);
  }

  const posicao =
    aberto === null ? null : posicaoDoPainel(aberto, meses, largura);

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
            {nomeDoTipo(t)}
          </span>
        ))}
      </div>
      <div ref={areaRef} className="dashboard__area-grafico">
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
              onClick={() => {
                // Ativar (clique ou toque) também abre o mês, mesmo onde o
                // clique não leva o foco ao botão.
                setDaVez(i);
                setAberto(i);
              }}
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
        {/* A vaga do painel: espaço reservado aqui, dentro do gráfico, com a
            altura das linhas do painel — aberto, ele nunca sai do bloco nem
            cobre o que vem depois. */}
        <div
          className="dashboard__vaga-do-painel"
          style={{ ["--linhas-do-painel" as string]: String(linhasDoPainel) }}
        >
          {aberto !== null ? (
            <div
              id={idPainel}
              role="tooltip"
              className={`dashboard__dica-mes dashboard__dica-mes--${posicao?.lado ?? "depois"}`}
              style={{
                ["--coluna" as string]: String(aberto),
                ["--colunas" as string]: String(meses),
                ["--espaco" as string]: String(posicao?.espaco ?? 1),
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
                      {nomeDoTipo(t)}
                    </dt>
                    <dd>{valor(t, aberto)}</dd>
                  </div>
                ))}
                {comSaldo ? (
                  <div>
                    <dt>{rotuloDoSaldo}</dt>
                    <dd>
                      {sinal(
                        valor("admissao", aberto) -
                          valor("desligamento", aberto),
                      )}
                    </dd>
                  </div>
                ) : null}
                {indisponiveis.map((nome) => (
                  <div key={nome} className="dashboard__dica-mes-indisponivel">
                    <dt>{nome}</dt>
                    <dd>indisponível</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
