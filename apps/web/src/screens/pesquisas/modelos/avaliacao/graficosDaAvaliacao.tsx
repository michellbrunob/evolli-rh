/**
 * T216 — gráficos da Avaliação 90°/180° em SVG/CSS (sem biblioteca): a roda
 * de competências (radar 1–5), a régua de uma nota, os halteres gestor ×
 * autoavaliação e as barras do ranking. Cada gráfico tem um nome acessível
 * e a lista dos valores para leitor de tela.
 */
import { CATALOGO, competencia, nota1, type Competencia } from "./catalogo";

const LADO = 260;
const CENTRO = LADO / 2;
const RAIO = 92;

function ponto(i: number, total: number, valor: number): [number, number] {
  const angulo = (Math.PI * 2 * i) / total - Math.PI / 2;
  const r = (Math.max(0, Math.min(5, valor) - 1) / 4) * RAIO;
  return [CENTRO + r * Math.cos(angulo), CENTRO + r * Math.sin(angulo)];
}

/** Radar das 8 competências (1 a 5); uma ou duas séries. */
export function RodaDeCompetencias({
  rotulo,
  series,
}: {
  readonly rotulo: string;
  readonly series: readonly {
    readonly nome: string;
    readonly classe: string;
    readonly valores: Partial<Record<Competencia, number | null>>;
  }[];
}) {
  const total = CATALOGO.length;
  return (
    <figure className="avaliacao__radar">
      <svg viewBox={`0 0 ${LADO} ${LADO}`} role="img" aria-label={rotulo}>
        {[1, 2, 3, 4, 5].map((n) => (
          <polygon
            key={n}
            className="avaliacao__radar-grade"
            points={CATALOGO.map((_, i) => ponto(i, total, n).join(",")).join(" ")}
          />
        ))}
        {CATALOGO.map((c, i) => {
          const [x, y] = ponto(i, total, 5);
          const [tx, ty] = ponto(i, total, 6.1);
          return (
            <g key={c.id}>
              <line className="avaliacao__radar-eixo" x1={CENTRO} y1={CENTRO} x2={x} y2={y} />
              <text
                className="avaliacao__radar-rotulo"
                x={tx}
                y={ty}
                textAnchor={tx < CENTRO - 4 ? "end" : tx > CENTRO + 4 ? "start" : "middle"}
                dominantBaseline="middle"
              >
                {c.rotulo}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <polygon
            key={s.nome}
            className={`avaliacao__radar-serie ${s.classe}`}
            points={CATALOGO.map((c, i) => ponto(i, total, s.valores[c.id] ?? 1).join(",")).join(" ")}
          />
        ))}
      </svg>
      <figcaption className="pesquisas__so-leitor">
        <ul>
          {series.map((s) =>
            CATALOGO.map((c) => (
              <li key={`${s.nome}-${c.id}`}>{`${s.nome}, ${c.rotulo}: ${nota1(s.valores[c.id] ?? null)}`}</li>
            )),
          )}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Posição (0–100%) de uma nota na régua 1–5. */
export function posicaoNaRegua(nota: number): number {
  return ((Math.max(1, Math.min(5, nota)) - 1) / 4) * 100;
}

/** Barra horizontal de uma nota (1 a 5), na cor da competência. */
export function BarraDaNota({
  nota,
  cor,
  rotulo,
}: {
  readonly nota: number | null;
  readonly cor?: string;
  readonly rotulo: string;
}) {
  return (
    <span
      className="avaliacao__barra"
      role="meter"
      aria-label={rotulo}
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={nota ?? undefined}
      aria-valuetext={nota1(nota)}
    >
      <span
        style={{
          width: `${nota === null ? 0 : posicaoNaRegua(nota)}%`,
          ...(cor ? { ["--cor" as string]: `var(${cor})` } : {}),
        }}
      />
    </span>
  );
}

/** Halteres: gestor × autoavaliação por competência, na régua 1–5. */
export function Halteres({
  linhas,
}: {
  readonly linhas: readonly {
    readonly competencia: Competencia;
    readonly gestor: number | null;
    readonly autoavaliacao: number | null;
    readonly diferenca: number | null;
  }[];
}) {
  return (
    <div className="avaliacao__halteres" role="table" aria-label="Gestor × autoavaliação por competência">
      <div role="row" className="avaliacao__halteres-legenda">
        <span role="columnheader">Competência</span>
        <span role="columnheader">
          <span className="avaliacao__marca avaliacao__marca--gestor" aria-hidden="true" /> Gestor
          <span className="avaliacao__marca avaliacao__marca--auto" aria-hidden="true" /> Autoavaliação
        </span>
        <span role="columnheader">Diferença</span>
      </div>
      {linhas.map((l) => {
        const g = l.gestor;
        const a = l.autoavaliacao;
        const ini = g !== null && a !== null ? Math.min(posicaoNaRegua(g), posicaoNaRegua(a)) : 0;
        const fim = g !== null && a !== null ? Math.max(posicaoNaRegua(g), posicaoNaRegua(a)) : 0;
        return (
          <div role="row" key={l.competencia} className="avaliacao__halter">
            <span role="cell">{competencia(l.competencia).rotulo}</span>
            <span role="cell" className="avaliacao__halter-trilho" aria-label={`Gestor ${nota1(g)}, autoavaliação ${nota1(a)}`}>
              {g !== null && a !== null ? (
                <span className="avaliacao__halter-faixa" style={{ left: `${ini}%`, width: `${fim - ini}%` }} />
              ) : null}
              {g !== null ? (
                <span className="avaliacao__marca avaliacao__marca--gestor" style={{ left: `${posicaoNaRegua(g)}%` }} />
              ) : null}
              {a !== null ? (
                <span className="avaliacao__marca avaliacao__marca--auto" style={{ left: `${posicaoNaRegua(a)}%` }} />
              ) : null}
            </span>
            <span role="cell" className="avaliacao__numero">
              {l.diferenca === null
                ? "—"
                : `${l.diferenca > 0 ? "+" : l.diferenca < 0 ? "−" : ""}${nota1(Math.abs(l.diferenca))}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
