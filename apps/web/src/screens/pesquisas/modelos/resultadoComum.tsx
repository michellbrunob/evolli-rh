/**
 * T216 — peças dos resultados dos modelos com cálculo próprio: o selo da
 * faixa, a régua 0–100 com marcador, a barra desfavorável/favorável, o
 * bloco da recomendação (eNPS e LNPS) com a distribuição e o radar. SVG e
 * CSS, sem biblioteca; todo gráfico tem nome acessível com os números.
 */
import type {
  FaixaDeRecomendacao,
  FaixaDeScore,
  NivelTad,
  RecomendacaoDoModelo,
} from "../../../api/pesquisasClient";
import { plural } from "../../../format/plural";
import "./Resultados.css";

export const ROTULO_DA_FAIXA: Readonly<Record<FaixaDeScore, string>> = {
  critico: "Crítico",
  atencao: "Atenção",
  saudavel: "Saudável",
  forte: "Forte",
};

export const ROTULO_DA_RECOMENDACAO: Readonly<
  Record<FaixaDeRecomendacao, string>
> = {
  critico: "Crítico",
  em_ajuste: "Em ajuste",
  bom: "Bom",
  excelente: "Excelente",
};

export const ROTULO_DO_NIVEL: Readonly<Record<NivelTad, string>> = {
  alto: "Alto",
  moderado: "Moderado",
  baixo: "Baixo",
};

/** A faixa visual (cor) de cada classificação. */
export type FaixaVisual = FaixaDeScore;

export const VISUAL_DA_RECOMENDACAO: Readonly<
  Record<FaixaDeRecomendacao, FaixaVisual>
> = {
  critico: "critico",
  em_ajuste: "atencao",
  bom: "saudavel",
  excelente: "forte",
};

export const VISUAL_DO_NIVEL: Readonly<Record<NivelTad, FaixaVisual>> = {
  alto: "forte",
  moderado: "atencao",
  baixo: "critico",
};

/** "4,39" (duas casas, vírgula). */
export const duasCasas = (n: number) => n.toFixed(2).replace(".", ",");

/** "+34" / "−12" / "0". */
export const comSinal = (n: number) =>
  n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";

export const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

export function SeloDaFaixa({
  faixa,
  texto,
}: {
  readonly faixa: FaixaVisual;
  readonly texto: string;
}) {
  return (
    <span className="modelo-faixa" data-faixa={faixa}>
      {texto}
    </span>
  );
}

/** Régua de 0 a 100 com as 4 faixas e o marcador do valor. */
export function ReguaDeScore({
  valor,
  rotulo,
}: {
  readonly valor: number;
  readonly rotulo: string;
}) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <span
      className="modelo-regua"
      role="img"
      aria-label={`${rotulo}: ${Math.round(valor)} de 100`}
    >
      <span data-faixa="critico" style={{ width: "50%" }} />
      <span data-faixa="atencao" style={{ width: "20%" }} />
      <span data-faixa="saudavel" style={{ width: "15%" }} />
      <span data-faixa="forte" style={{ width: "15%" }} />
      <span className="modelo-regua__marcador" style={{ left: `${v}%` }} />
    </span>
  );
}

/** Barra de score (0–100) na cor da faixa, com o marcador. */
export function BarraDeScore({
  valor,
  faixa,
  rotulo,
}: {
  readonly valor: number;
  readonly faixa: FaixaVisual;
  readonly rotulo: string;
}) {
  const v = Math.max(0, Math.min(100, valor));
  return (
    <span
      className="modelo-barra"
      role="img"
      aria-label={`${rotulo}: ${Math.round(valor)} de 100`}
    >
      <span data-faixa={faixa} style={{ width: `${v}%` }} />
    </span>
  );
}

/** "← Desfavorável · Favorável →": % desfavorável e % favorável. */
export function BarraFavoravel({
  favoravel,
  neutro,
  desfavoravel,
  rotulo,
}: {
  readonly favoravel: number;
  readonly neutro: number;
  readonly desfavoravel: number;
  readonly rotulo: string;
}) {
  return (
    <span
      className="modelo-favoravel"
      role="img"
      aria-label={`${rotulo}: ${desfavoravel}% desfavorável, ${neutro}% neutro, ${favoravel}% favorável`}
    >
      <span className="modelo-favoravel__num" data-lado="desfavoravel">
        {`${desfavoravel}%`}
      </span>
      <span className="modelo-favoravel__trilho" aria-hidden="true">
        <span data-lado="desfavoravel" style={{ width: `${desfavoravel}%` }} />
        <span data-lado="neutro" style={{ width: `${neutro}%` }} />
        <span data-lado="favoravel" style={{ width: `${favoravel}%` }} />
      </span>
      <span className="modelo-favoravel__num" data-lado="favoravel">
        {`${favoravel}%`}
      </span>
    </span>
  );
}

/** Legenda Desfavorável · Neutro · Favorável. */
export function LegendaFavoravel() {
  return (
    <ul className="modelo-legenda" aria-label="Legenda">
      <li>
        <span data-lado="desfavoravel" aria-hidden="true" />
        Desfavorável (1–2)
      </li>
      <li>
        <span data-lado="neutro" aria-hidden="true" />
        Neutro (3)
      </li>
      <li>
        <span data-lado="favoravel" aria-hidden="true" />
        Favorável (4–5)
      </li>
    </ul>
  );
}

/** O bloco do eNPS ou do LNPS: régua −100…100, distribuição e os grupos. */
export function BlocoDeRecomendacao({
  titulo,
  enunciado,
  r,
}: {
  readonly titulo: string;
  readonly enunciado: string | null;
  readonly r: RecomendacaoDoModelo;
}) {
  const maior = Math.max(1, ...r.distribuicao.map((d) => d.quantidade));
  const pos = r.indice === null ? null : ((r.indice + 100) / 200) * 100;
  return (
    <section className="modelo-cartao modelo-recomendacao" aria-label={titulo}>
      <h3 className="modelo-cartao__titulo">{titulo}</h3>
      {enunciado ? (
        <p className="pesquisas__suave">{`“${enunciado}”`}</p>
      ) : null}
      {r.indice === null || r.faixa === null ? (
        <p className="pesquisas__suave">Ainda sem notas.</p>
      ) : (
        <>
          <p className="modelo-valor">
            <strong>{comSinal(r.indice)}</strong>
            <SeloDaFaixa
              faixa={VISUAL_DA_RECOMENDACAO[r.faixa]}
              texto={ROTULO_DA_RECOMENDACAO[r.faixa]}
            />
          </p>
          <span
            className="modelo-regua modelo-regua--nps"
            role="img"
            aria-label={`${titulo}: ${r.indice}, de −100 a 100`}
          >
            <span data-faixa="critico" style={{ width: "50%" }} />
            <span data-faixa="atencao" style={{ width: "15%" }} />
            <span data-faixa="saudavel" style={{ width: "20%" }} />
            <span data-faixa="forte" style={{ width: "15%" }} />
            {pos !== null ? (
              <span
                className="modelo-regua__marcador"
                style={{ left: `${pos}%` }}
              />
            ) : null}
          </span>
          <p className="modelo-regua__marcas" aria-hidden="true">
            <span>−100</span>
            <span>0</span>
            <span>30</span>
            <span>70</span>
            <span>100</span>
          </p>
        </>
      )}
      <figure
        className="modelo-histograma"
        aria-label={`Distribuição das notas de ${titulo}`}
      >
        <figcaption className="pesquisas__suave">
          Distribuição das notas
        </figcaption>
        <ol>
          {r.distribuicao.map((d) => (
            <li key={d.valor}>
              <span className="modelo-histograma__qtd">{d.quantidade}</span>
              <span
                className="modelo-histograma__barra"
                data-grupo={
                  d.valor >= 9
                    ? "promotor"
                    : d.valor >= 7
                      ? "neutro"
                      : "detrator"
                }
                style={{ height: `${(d.quantidade / maior) * 100}%` }}
                aria-hidden="true"
              />
              <span className="modelo-histograma__nota">{d.valor}</span>
            </li>
          ))}
        </ol>
      </figure>
      <ul className="modelo-grupos-nps">
        {(
          [
            ["Promotores", "notas 9–10", r.promotores, "promotor"],
            ["Neutros", "notas 7–8", r.neutros, "neutro"],
            ["Detratores", "notas 0–6", r.detratores, "detrator"],
          ] as const
        ).map(([nome, notas, qtd, grupo]) => (
          <li key={nome} data-grupo={grupo}>
            <strong>{nome}</strong>
            <span className="pesquisas__suave">{notas}</span>
            <span>
              {`${plural(qtd, "pessoa", "pessoas")} · ${pct(qtd, r.respostas)}%`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Radar de N eixos (0 até `maximo`), com o polígono do valor. */
export function Radar({
  eixos,
  maximo,
  rotulo,
}: {
  readonly eixos: readonly { rotulo: string; valor: number; cor?: string }[];
  readonly maximo: number;
  readonly rotulo: string;
}) {
  const n = eixos.length;
  const c = 100;
  const raio = 70;
  const ponto = (i: number, f: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + Math.cos(a) * raio * f, c + Math.sin(a) * raio * f] as const;
  };
  const poligono = (f: (i: number) => number) =>
    eixos.map((_, i) => ponto(i, f(i)).join(",")).join(" ");
  return (
    <figure
      className="modelo-radar"
      role="img"
      aria-label={`${rotulo}: ${eixos
        .map((e) => `${e.rotulo} ${duasCasas(e.valor)}`)
        .join(", ")}`}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={poligono(() => f)}
            fill="none"
            stroke="var(--hairline)"
          />
        ))}
        {eixos.map((_, i) => {
          const [x, y] = ponto(i, 1);
          return (
            <line
              key={i}
              x1={c}
              y1={c}
              x2={x}
              y2={y}
              stroke="var(--hairline)"
            />
          );
        })}
        <polygon
          points={poligono((i) =>
            Math.max(0, Math.min(1, eixos[i]!.valor / maximo)),
          )}
          fill="color-mix(in srgb, var(--color-action) 22%, transparent)"
          stroke="var(--color-action)"
          strokeWidth="2"
        />
        {eixos.map((e, i) => {
          const [x, y] = ponto(i, 1.22);
          return (
            <text
              key={e.rotulo}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="var(--color-ink-muted)"
            >
              {e.rotulo}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
