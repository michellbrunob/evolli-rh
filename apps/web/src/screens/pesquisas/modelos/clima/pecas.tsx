/**
 * T216 — peças das telas do Clima: o medidor do índice (0 a 100, marcas
 * nas faixas 50, 65 e 80), o selo da faixa e o quadro das notas
 * favoráveis/neutras/desfavoráveis. SVG e CSS, com nome acessível.
 */
import type {
  FaixaClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { SeloDaFaixa } from "../resultadoComum";
import { DIMENSOES_CLIMA } from "./catalogo";
import {
  FAIXAS_CLIMA,
  ROTULO_DA_FAIXA_CLIMA,
  VISUAL_DA_FAIXA_CLIMA,
} from "./faixas";
import "./Clima.css";

export const corDaDimensao = (chave: string) =>
  `var(${DIMENSOES_CLIMA.find((d) => d.chave === chave)?.cor ?? "--color-ink-subtle"})`;

export function SeloDaFaixaClima({
  faixa,
}: {
  readonly faixa: FaixaClima | null;
}) {
  if (!faixa) return null;
  return (
    <SeloDaFaixa
      faixa={VISUAL_DA_FAIXA_CLIMA[faixa]}
      texto={ROTULO_DA_FAIXA_CLIMA[faixa]}
    />
  );
}

/** Ponto do semicírculo (0 = esquerda, 100 = direita). */
function ponto(r: number, valor: number) {
  const rad = Math.PI - (valor / 100) * Math.PI;
  return { x: 100 + r * Math.cos(rad), y: 100 - r * Math.sin(rad) };
}

function arco(r: number, de: number, ate: number) {
  const a = ponto(r, de);
  const b = ponto(r, ate);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Medidor semicircular do índice, com as faixas e as marcas 0/50/65/80/100. */
export function MedidorDoIndice({
  valor,
  faixa,
  rotulo,
}: {
  readonly valor: number | null;
  readonly faixa: FaixaClima | null;
  readonly rotulo: string;
}) {
  const v = valor === null ? 0 : Math.max(0, Math.min(100, valor));
  const marca = ponto(66, v);
  return (
    <svg
      className="clima-medidor"
      viewBox="0 0 200 122"
      role="img"
      aria-label={
        valor === null
          ? `${rotulo}: sem respostas`
          : `${rotulo}: ${valor}%${faixa ? `, ${ROTULO_DA_FAIXA_CLIMA[faixa]}` : ""}`
      }
    >
      {FAIXAS_CLIMA.map((f) => (
        <path
          key={f.faixa}
          d={arco(86, f.de, f.ate)}
          className="clima-medidor__faixa"
          style={{ stroke: `var(${f.cor})` }}
        />
      ))}
      <path d={arco(66, 0, 100)} className="clima-medidor__trilho" />
      {valor !== null && v > 0 ? (
        <path
          d={arco(66, 0, v)}
          className="clima-medidor__arco"
          data-faixa={faixa ? VISUAL_DA_FAIXA_CLIMA[faixa] : undefined}
        />
      ) : null}
      {valor !== null ? (
        <circle
          cx={marca.x}
          cy={marca.y}
          r={6}
          className="clima-medidor__marcador"
        />
      ) : null}
      {[0, 50, 65, 80, 100].map((m) => {
        const p = ponto(100, m);
        return (
          <text
            key={m}
            x={p.x}
            y={Math.min(p.y + 4, 118)}
            textAnchor={m === 0 ? "start" : m === 100 ? "end" : "middle"}
            className="clima-medidor__marca"
          >
            {m}
          </text>
        );
      })}
      <text x={100} y={96} textAnchor="middle" className="clima-medidor__valor">
        {valor === null ? "—" : `${valor}%`}
      </text>
    </svg>
  );
}

/** O quadro "Todas as respostas · N notas". */
export function QuadroDasNotas({
  titulo = "Todas as respostas",
  favoraveis,
  neutras,
  desfavoraveis,
}: {
  readonly titulo?: string;
  readonly favoraveis: number;
  readonly neutras: number;
  readonly desfavoraveis: number;
}) {
  const total = favoraveis + neutras + desfavoraveis;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const linhas = [
    ["favoravel", "Favoráveis (4 e 5)", favoraveis],
    ["neutro", "Neutras (3)", neutras],
    ["desfavoravel", "Desfavoráveis (1 e 2)", desfavoraveis],
  ] as const;
  return (
    <section className="clima-notas" aria-label={titulo}>
      <h3 className="modelo-cartao__titulo">
        {`${titulo} · ${plural(total, "nota", "notas")}`}
      </h3>
      <ul>
        {linhas.map(([lado, rotulo, n]) => (
          <li key={lado}>
            <span
              className="clima-notas__ponto"
              data-lado={lado}
              aria-hidden="true"
            />
            <span>{rotulo}</span>
            <strong>{n}</strong>
            <span className="pesquisas__suave">{`${pct(n)}%`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os textos de uma pergunta aberta (vazio sem respostas visíveis). */
export function textosDaAberta(
  geral: ResultadosPesquisa,
  perguntaId: string,
): string[] {
  const r = geral.perguntas.find((p) => p.perguntaId === perguntaId);
  return r && "textos" in r ? r.textos.map((t) => t.texto) : [];
}

/** "1º", "2º"… */
export const ordinal = (n: number) => `${n}º`;
