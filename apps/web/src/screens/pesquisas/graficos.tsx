/**
 * T216 — gráficos dos resultados, sem biblioteca: SVG e CSS com os tokens
 * do sistema. Todo gráfico tem nome acessível com os números (e, nas
 * barras, uma tabela só para leitor de tela); a cor nunca é o único sinal.
 */
import { umaCasa } from "./textosDasPesquisas";

/** Rosca com o valor no centro. `fracao` de 0 a 1. */
export function Rosca({
  fracao,
  centro,
  sufixo,
  legenda,
  cor,
  rotulo,
}: {
  readonly fracao: number;
  readonly centro: string;
  readonly sufixo?: string;
  readonly legenda?: string;
  readonly cor: string;
  readonly rotulo: string;
}) {
  const raio = 42;
  const volta = 2 * Math.PI * raio;
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <figure className="pesquisas__rosca" role="img" aria-label={rotulo}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          // O trilho é a cor do valor, bem clara.
          style={{
            stroke: `color-mix(in srgb, ${cor} 16%, var(--surface-canvas))`,
          }}
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${volta * f} ${volta}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <figcaption aria-hidden="true">
        <strong>{centro}</strong>
        {sufixo ? <span>{sufixo}</span> : null}
        {legenda ? <small>{legenda}</small> : null}
      </figcaption>
    </figure>
  );
}

export interface ParteDaBarra {
  readonly rotulo: string;
  readonly valor: number;
  readonly cor: string;
}

/**
 * Barra empilhada (faixas, eNPS) com a legenda em texto: "63% promotores"
 * ou, com `legendaSoRotulo`, só o rótulo de cada parte ("8 a 10").
 */
export function BarraEmpilhada({
  partes,
  rotulo,
  legenda = true,
  legendaSoRotulo = false,
}: {
  readonly partes: readonly ParteDaBarra[];
  readonly rotulo: string;
  readonly legenda?: boolean;
  readonly legendaSoRotulo?: boolean;
}) {
  const total = partes.reduce((t, p) => t + p.valor, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return (
    <div className="pesquisas__empilhada">
      <div
        className="pesquisas__empilhada-barra"
        role="img"
        aria-label={`${rotulo}: ${partes.map((p) => `${p.rotulo} ${pct(p.valor)}%`).join(", ")}`}
      >
        {partes.map((p) =>
          p.valor > 0 ? (
            <span
              key={p.rotulo}
              style={{
                width: `${(p.valor / total) * 100}%`,
                background: p.cor,
              }}
            />
          ) : null,
        )}
      </div>
      {legenda ? (
        <ul className="pesquisas__legenda" aria-hidden="true">
          {partes.map((p) => (
            <li key={p.rotulo}>
              <span
                className="pesquisas__ponto"
                style={{ background: p.cor }}
              />
              {legendaSoRotulo ? p.rotulo : `${pct(p.valor)}% ${p.rotulo}`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Barras verticais por nota, com a quantidade acima e as pontas embaixo. */
export function BarrasPorNota({
  valores,
  cor,
  rotuloMinimo,
  rotuloMaximo,
  rotulo,
}: {
  readonly valores: readonly { valor: number; quantidade: number }[];
  readonly cor: (valor: number) => string;
  readonly rotuloMinimo?: string;
  readonly rotuloMaximo?: string;
  readonly rotulo: string;
}) {
  const maior = Math.max(1, ...valores.map((v) => v.quantidade));
  return (
    <div className="pesquisas__barras">
      <div className="pesquisas__barras-area" aria-hidden="true">
        {valores.map((v) => (
          <div key={v.valor} className="pesquisas__barras-coluna">
            <span className="pesquisas__barras-qtd">
              {v.quantidade > 0 ? v.quantidade : ""}
            </span>
            <span
              className="pesquisas__barras-barra"
              style={{
                height: `${(v.quantidade / maior) * 100}%`,
                background: cor(v.valor),
              }}
            />
            <span className="pesquisas__barras-valor">{v.valor}</span>
          </div>
        ))}
      </div>
      {rotuloMinimo || rotuloMaximo ? (
        <div className="pesquisas__barras-pontas" aria-hidden="true">
          <span>{rotuloMinimo}</span>
          <span>{rotuloMaximo}</span>
        </div>
      ) : null}
      <div className="pesquisas__so-leitor">
        <table>
          <caption>{rotulo}</caption>
          <thead>
            <tr>
              <th scope="col">Nota</th>
              <th scope="col">Respostas</th>
            </tr>
          </thead>
          <tbody>
            {valores.map((v) => (
              <tr key={v.valor}>
                <td>{v.valor}</td>
                <td>{v.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Régua de 0 a 10 em três faixas (abaixo de 6,5 · 6,5 a 7,9 · 8 ou mais),
 * com o marcador do valor e, se houver, o traço da média do time. Com
 * `pontas`, os extremos da escala embaixo ("1" e "10").
 */
export function Regua({
  valor,
  referencia,
  rotulo,
  pontas,
}: {
  readonly valor: number | null;
  readonly referencia?: number | null;
  readonly rotulo: string;
  readonly pontas?: readonly [string, string];
}) {
  const pos = (v: number) => `${Math.max(0, Math.min(10, v)) * 10}%`;
  const regua = (
    <div
      className="pesquisas__regua"
      role="img"
      aria-label={`${rotulo}: ${valor === null ? "sem dado" : umaCasa(valor)}${
        referencia !== undefined && referencia !== null
          ? `; média do time ${umaCasa(referencia)}`
          : ""
      }`}
    >
      <span className="pesquisas__regua-faixas" aria-hidden="true">
        <span data-faixa="baixa" />
        <span data-faixa="media" />
        <span data-faixa="alta" />
      </span>
      {referencia !== undefined && referencia !== null ? (
        <span
          className="pesquisas__regua-time"
          style={{ left: pos(referencia) }}
          aria-hidden="true"
        />
      ) : null}
      {valor !== null ? (
        <span
          className="pesquisas__regua-marca"
          style={{ left: pos(valor) }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
  if (!pontas) return regua;
  return (
    <div className="pesquisas__regua-com-pontas">
      {regua}
      <div className="pesquisas__regua-pontas" aria-hidden="true">
        <span>{pontas[0]}</span>
        <span>{pontas[1]}</span>
      </div>
    </div>
  );
}

/** Linha da evolução (média geral de cada pesquisa do mesmo modelo). */
export function LinhaDeEvolucao({
  pontos,
  rotulo,
}: {
  readonly pontos: readonly { rotulo: string; valor: number | null }[];
  readonly rotulo: string;
}) {
  const validos = pontos.filter((p) => p.valor !== null) as {
    rotulo: string;
    valor: number;
  }[];
  const largura = 300;
  const altura = 120;
  const x = (i: number) =>
    validos.length <= 1
      ? largura / 2
      : 20 + (i * (largura - 40)) / (validos.length - 1);
  const y = (v: number) => altura - 15 - (v / 10) * (altura - 30);
  return (
    <figure className="pesquisas__evolucao">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label={`${rotulo}: ${validos.map((p) => `${p.rotulo} ${umaCasa(p.valor)}`).join("; ")}`}
      >
        <polyline
          fill="none"
          stroke="var(--color-action)"
          strokeWidth="2"
          points={validos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")}
        />
        {validos.map((p, i) => (
          <g key={`${p.rotulo}-${i}`}>
            <circle
              cx={x(i)}
              cy={y(p.valor)}
              r="4"
              fill="var(--color-action)"
            />
            <text
              x={x(i)}
              y={y(p.valor) - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink)"
            >
              {umaCasa(p.valor)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <ol className="pesquisas__evolucao-rotulos">
          {validos.map((p, i) => (
            <li key={`${p.rotulo}-${i}`}>{p.rotulo}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
