/**
 * T216 — Perfil comportamental (DISC): os gráficos em SVG e CSS, sem
 * biblioteca. Cada gráfico tem um rótulo em texto para o leitor de tela;
 * as cores vêm dos tokens (`fatores.ts`).
 */
import { AREAS } from "./areas";
import { FATOR, FATORES, corDoFator, type FatorDisc } from "./fatores";
import type { FaixaDeDiversidade, Pontos } from "./tiposDisc";

/** O quadradinho com a letra do fator, na cor dele. */
export function LetraDoFator({
  fator,
  tamanho = "md",
}: {
  readonly fator: FatorDisc;
  readonly tamanho?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={`disc__letra disc__letra--${tamanho}`}
      style={{ ["--cor-do-fator" as string]: corDoFator(fator) }}
      aria-hidden="true"
    >
      {fator}
    </span>
  );
}

const textoDos = (p: Pontos) =>
  FATORES.map((f) => `${FATOR[f].nome} ${p[f]}%`).join(", ");

/** A barra empilhada D/I/S/C com o percentual de cada fator. */
export function BarraDisc({
  percentuais,
  rotulo,
}: {
  readonly percentuais: Pontos;
  readonly rotulo: string;
}) {
  const total = FATORES.reduce((t, f) => t + percentuais[f], 0) || 1;
  return (
    <div className="disc__barra">
      <div
        className="disc__barra-trilha"
        role="img"
        aria-label={`${rotulo}: ${textoDos(percentuais)}`}
      >
        {FATORES.map((f) =>
          percentuais[f] > 0 ? (
            <span
              key={f}
              style={{
                width: `${(percentuais[f] / total) * 100}%`,
                background: corDoFator(f),
              }}
            />
          ) : null,
        )}
      </div>
      <ul className="disc__barra-legenda" aria-hidden="true">
        {FATORES.map((f) => (
          <li key={f}>
            <span
              className="disc__ponto"
              style={{ background: corDoFator(f) }}
            />
            {`${f} ${percentuais[f]}%`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma barra horizontal por fator (a distribuição da pessoa). */
export function BarrasDisc({
  percentuais,
  rotulo,
}: {
  readonly percentuais: Pontos;
  readonly rotulo: string;
}) {
  return (
    <ul className="disc__barras" aria-label={rotulo}>
      {FATORES.map((f) => (
        <li key={f}>
          <span className="disc__barras-nome">{FATOR[f].nome}</span>
          <span className="disc__barras-trilha" aria-hidden="true">
            <span
              style={{
                width: `${percentuais[f]}%`,
                background: corDoFator(f),
              }}
            />
          </span>
          <strong>{`${percentuais[f]}%`}</strong>
        </li>
      ))}
    </ul>
  );
}

/** Radar em losango: D em cima, I à direita, S embaixo, C à esquerda. */
export function RadarDisc({
  percentuais,
  rotulo,
}: {
  readonly percentuais: Pontos;
  readonly rotulo: string;
}) {
  const c = 60;
  const r = 44;
  const maior = Math.max(...FATORES.map((f) => percentuais[f]), 1);
  const escala = (v: number) => (v / Math.max(maior, 50)) * r;
  const ponto = (f: FatorDisc, v: number) => {
    const d = escala(v);
    if (f === "D") return [c, c - d] as const;
    if (f === "I") return [c + d, c] as const;
    if (f === "S") return [c, c + d] as const;
    return [c - d, c] as const;
  };
  const caminho = FATORES.map((f) => ponto(f, percentuais[f]).join(",")).join(
    " ",
  );
  const losango = (k: number) =>
    `${c},${c - r * k} ${c + r * k},${c} ${c},${c + r * k} ${c - r * k},${c}`;
  return (
    <figure
      className="disc__radar"
      role="img"
      aria-label={`${rotulo}: ${textoDos(percentuais)}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        {[1, 0.66, 0.33].map((k) => (
          <polygon key={k} points={losango(k)} className="disc__radar-grade" />
        ))}
        <line
          x1={c}
          y1={c - r}
          x2={c}
          y2={c + r}
          className="disc__radar-grade"
        />
        <line
          x1={c - r}
          y1={c}
          x2={c + r}
          y2={c}
          className="disc__radar-grade"
        />
        <polygon points={caminho} className="disc__radar-area" />
        {FATORES.map((f) => {
          const [x, y] = ponto(f, percentuais[f]);
          return <circle key={f} cx={x} cy={y} r={2.6} fill={corDoFator(f)} />;
        })}
        <text x={c} y={8} className="disc__radar-rotulo">
          D
        </text>
        <text x={114} y={c + 3} className="disc__radar-rotulo">
          I
        </text>
        <text x={c} y={118} className="disc__radar-rotulo">
          S
        </text>
        <text x={6} y={c + 3} className="disc__radar-rotulo">
          C
        </text>
      </svg>
    </figure>
  );
}

/**
 * O mapa de talentos: as 13 áreas (cor clara do fator), as pessoas
 * (bolinhas na cor do predominante) e o anel do centro do time.
 */
export function MapaDeTalentos({
  pontos,
  centro,
  contagem,
}: {
  readonly pontos: readonly { x: number; y: number; fator: FatorDisc }[];
  readonly centro: { x: number; y: number } | null;
  readonly contagem: ReadonlyMap<number, number>;
}) {
  const descricao = AREAS.filter((a) => (contagem.get(a.id) ?? 0) > 0)
    .map((a) => `${a.nome}: ${contagem.get(a.id)}`)
    .join(", ");
  return (
    <figure
      className="disc__mapa"
      role="img"
      aria-label={`Mapa de talentos. ${descricao || "Sem pessoas no mapa."}`}
    >
      <div className="disc__mapa-eixo disc__mapa-eixo--topo" aria-hidden="true">
        Emoção
      </div>
      <div className="disc__mapa-meio">
        <span
          className="disc__mapa-eixo disc__mapa-eixo--lado"
          aria-hidden="true"
        >
          Extroversão
        </span>
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="disc__mapa-svg"
        >
          {AREAS.map((a) => (
            <g key={a.id}>
              <rect
                x={a.x[0]}
                y={a.y[0]}
                width={a.x[1] - a.x[0]}
                height={a.y[1] - a.y[0]}
                className="disc__mapa-area"
                style={{ ["--cor-do-fator" as string]: corDoFator(a.fator) }}
              />
              <text
                x={(a.x[0] + a.x[1]) / 2}
                y={(a.y[0] + a.y[1]) / 2 - 1.5}
                className="disc__mapa-nome"
              >
                {a.nome}
              </text>
              {(contagem.get(a.id) ?? 0) > 0 ? (
                <text
                  x={(a.x[0] + a.x[1]) / 2}
                  y={(a.y[0] + a.y[1]) / 2 + 3.5}
                  className="disc__mapa-contagem"
                >
                  {contagem.get(a.id)}
                </text>
              ) : null}
            </g>
          ))}
          {pontos.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={1.6}
              fill={corDoFator(p.fator)}
              className="disc__mapa-pessoa"
            />
          ))}
          {centro ? (
            <circle
              cx={centro.x}
              cy={centro.y}
              r={3.2}
              className="disc__mapa-centro"
            />
          ) : null}
        </svg>
        <span
          className="disc__mapa-eixo disc__mapa-eixo--lado"
          aria-hidden="true"
        >
          Introversão
        </span>
      </div>
      <div className="disc__mapa-eixo" aria-hidden="true">
        Razão
      </div>
    </figure>
  );
}

export const ROTULO_DA_DIVERSIDADE: Readonly<
  Record<FaixaDeDiversidade, string>
> = {
  pouco_diverso: "Pouco diverso",
  moderado: "Moderado",
  equilibrado: "Equilibrado",
  altamente_diverso: "Altamente diverso",
};

export const TEXTO_DA_DIVERSIDADE: Readonly<
  Record<FaixaDeDiversidade, string>
> = {
  pouco_diverso:
    "O time pensa e age de forma parecida: decide rápido, mas tende a ter pontos cegos.",
  moderado:
    "Há alguma variedade de estilos, com um ou dois fatores puxando o time.",
  equilibrado:
    "Os estilos se completam bem; vale cuidar do fator menos presente.",
  altamente_diverso:
    "Estilos bem distribuídos: decisões mais ricas e menos pontos cegos.",
};

const FAIXAS: readonly {
  faixa: FaixaDeDiversidade;
  de: number;
  ate: number;
  cor: string;
}[] = [
  {
    faixa: "pouco_diverso",
    de: 0,
    ate: 40,
    cor: "var(--status-danger-border)",
  },
  { faixa: "moderado", de: 40, ate: 60, cor: "var(--status-warning-border)" },
  { faixa: "equilibrado", de: 60, ate: 80, cor: "var(--status-info-border)" },
  {
    faixa: "altamente_diverso",
    de: 80,
    ate: 100,
    cor: "var(--status-success-border)",
  },
];

/** Régua de 0 a 100 em quatro faixas, com o marcador do score. */
export function ReguaDaDiversidade({ score }: { readonly score: number }) {
  return (
    <div
      className="disc__diversidade-regua"
      role="img"
      aria-label={`Diversidade ${score} de 100`}
    >
      {FAIXAS.map((f) => (
        <span
          key={f.faixa}
          style={{ width: `${f.ate - f.de}%`, background: f.cor }}
        />
      ))}
      <span
        className="disc__diversidade-marcador"
        style={{ left: `${Math.max(0, Math.min(100, score))}%` }}
        aria-hidden="true"
      />
    </div>
  );
}
