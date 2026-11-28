/**
 * T216 — a Visão geral do eNPS: o medidor de −100 a 100 com a zona e a
 * conta ("X% promotores − Y% detratores = Z"), quem respondeu o quê
 * (promotores, neutros e detratores), a distribuição das notas de 0 a 10,
 * as complementares (distribuição 0–6 · 7–8 · 9–10 e média, da maior para
 * a menor) e as respostas abertas. SVG e CSS, com nome acessível.
 */
import { useState } from "react";
import type {
  ComplementarDoEnps,
  PesquisaDetalhe,
  ResultadoDoEnps,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { Button } from "../../../../components";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { textoParaOPainel } from "../empresa";
import {
  FRASE_DA_ZONA,
  GRUPOS_DO_ENPS,
  TITULO_DA_ZONA,
  ZONAS_DO_ENPS,
  comSinal,
  pctDe,
  umaCasaBr,
  zonaDoEnps,
} from "./textos";
import "../Resultados.css";
import "./Enps.css";

/** Ponto do arco do medidor para um valor de −100 a 100. */
function ponto(v: number, raio: number): [number, number] {
  const a = Math.PI * (1 - (v + 100) / 200);
  return [100 + raio * Math.cos(a), 100 - raio * Math.sin(a)];
}

function arco(de: number, ate: number, raio: number): string {
  const [x1, y1] = ponto(de, raio);
  const [x2, y2] = ponto(ate, raio);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${raio} ${raio} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const COR_DA_FAIXA = {
  critico: "var(--faixa-critico)",
  atencao: "var(--faixa-atencao)",
  saudavel: "var(--faixa-saudavel)",
  forte: "var(--faixa-forte)",
} as const;

/** O medidor de −100 a 100, com as zonas e as marcas 0, 50 e 75. */
export function MedidorDoEnps({ valor }: { readonly valor: number }) {
  const [mx, my] = ponto(Math.max(-100, Math.min(100, valor)), 80);
  return (
    <svg
      viewBox="0 0 200 118"
      role="img"
      aria-label={`eNPS ${valor}, de −100 a 100 (${TITULO_DA_ZONA[zonaDoEnpsDe(valor)].toLowerCase()})`}
    >
      {ZONAS_DO_ENPS.map((z) => (
        <path
          key={z.zona}
          d={arco(z.de, z.zona === "excelencia" ? 100 : z.ate + 1, 80)}
          fill="none"
          stroke={COR_DA_FAIXA[z.faixa]}
          strokeWidth="14"
        />
      ))}
      {[0, 50, 75].map((m) => {
        const [x, y] = ponto(m, 100);
        return (
          <text
            key={m}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-ink-muted)"
          >
            {m}
          </text>
        );
      })}
      <text
        x="20"
        y="114"
        textAnchor="middle"
        fontSize="9"
        fill="var(--color-ink-muted)"
      >
        −100
      </text>
      <text
        x="180"
        y="114"
        textAnchor="middle"
        fontSize="9"
        fill="var(--color-ink-muted)"
      >
        100
      </text>
      <line
        x1="100"
        y1="100"
        x2={mx.toFixed(2)}
        y2={my.toFixed(2)}
        stroke="var(--color-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="5" fill="var(--color-ink)" />
    </svg>
  );
}

function zonaDoEnpsDe(v: number) {
  return v < 0
    ? "critica"
    : v < 50
      ? "aperfeicoamento"
      : v < 75
        ? "qualidade"
        : "excelencia";
}

/** A barra 0–6 · 7–8 · 9–10 de uma complementar. */
export function DistribuicaoDaComplementar({
  c,
  rotulo,
}: {
  readonly c: ComplementarDoEnps;
  readonly rotulo: string;
}) {
  const partes = [
    ["detrator", c.detratores, "0 a 6"],
    ["neutro", c.neutros, "7 a 8"],
    ["promotor", c.promotores, "9 a 10"],
  ] as const;
  return (
    <span
      className="enps-distribuicao"
      role="img"
      aria-label={`${rotulo}: ${partes.map(([, n, notas]) => `${plural(n, "nota", "notas")} de ${notas}`).join(", ")}`}
    >
      {partes.map(([grupo, n]) => (
        <span
          key={grupo}
          data-grupo={grupo}
          style={{ width: `${pctDe(n, c.respostas)}%` }}
        />
      ))}
    </span>
  );
}

export function VisaoGeralEnps({
  detalhe,
  geral,
  r,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoDoEnps;
}) {
  const [todasAsAbertas, setTodasAsAbertas] = useState(false);
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const porId = new Map(perguntas.map((p) => [p.id, p]));
  const rotuloDe = (id: string) => {
    const p = porId.get(id);
    return p ? textoParaOPainel(p.rotulo || p.texto) : "Pergunta";
  };
  const textoDe = (id: string) => textoParaOPainel(porId.get(id)?.texto ?? "");
  const identificada = detalhe.identificacao === "identificada";

  // As abertas: na identificada, as mais recentes primeiro; nas demais, a
  // ordem alfabética do servidor (a de chegada ligaria o texto à pessoa).
  const abertas = geral.perguntas.flatMap((x) =>
    "textos" in x
      ? (identificada ? [...x.textos].reverse() : x.textos).map((t) => ({
          perguntaId: x.perguntaId,
          texto: t.texto,
          autor: identificada ? t.autor : null,
        }))
      : [],
  );
  const visiveis = todasAsAbertas ? abertas : abertas.slice(0, 3);
  const comMedia = r.complementares.filter((c) => c.media !== null);
  const menor = comMedia.at(-1);
  const pP = pctDe(r.promotores, r.respostas);
  const pN = pctDe(r.neutros, r.respostas);
  const pD = pctDe(r.detratores, r.respostas);
  const maior = Math.max(1, ...r.distribuicao.map((d) => d.quantidade));

  return (
    <div className="modelo-resultado">
      <div className="enps-topo">
        <section className="modelo-cartao" aria-label="eNPS do time">
          <h2 className="modelo-cartao__titulo">eNPS do time</h2>
          {r.indice === null || r.zona === null ? (
            <p className="pesquisas__suave">
              Ainda sem notas na pergunta principal.
            </p>
          ) : (
            <div className="enps-medidor">
              <MedidorDoEnps valor={r.indice} />
              <span className="enps-medidor__valor">{comSinal(r.indice)}</span>
              <span
                className="modelo-faixa"
                data-faixa={zonaDoEnps(r.zona).faixa}
              >
                {TITULO_DA_ZONA[r.zona]}
              </span>
              <p className="pesquisas__suave">{FRASE_DA_ZONA[r.zona]}</p>
              <p className="enps-conta">{`${pP}% promotores − ${pD}% detratores = ${r.indice}`}</p>
              <p className="enps-conta">
                {`${plural(r.respostas, "nota", "notas")} na pergunta principal`}
              </p>
            </div>
          )}
        </section>
        <section className="modelo-cartao" aria-label="Quem respondeu o quê">
          <h2 className="modelo-cartao__titulo">Quem respondeu o quê</h2>
          <ul className="enps-grupos">
            {GRUPOS_DO_ENPS.map((g) => {
              const n =
                g.grupo === "promotor"
                  ? r.promotores
                  : g.grupo === "neutro"
                    ? r.neutros
                    : r.detratores;
              const pct =
                g.grupo === "promotor" ? pP : g.grupo === "neutro" ? pN : pD;
              return (
                <li key={g.grupo} data-grupo={g.grupo}>
                  <span className="enps-grupos__pct">{`${pct}%`}</span>
                  <span className="pesquisas__pessoa-textos">
                    <strong>{g.plural}</strong>
                    <span className="pesquisas__suave">{`Notas ${g.notas}`}</span>
                  </span>
                  <span>{plural(n, "pessoa", "pessoas")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="modelo-cartao" aria-label="Distribuição das notas">
        <h2 className="modelo-cartao__titulo">Distribuição das notas</h2>
        <p className="pesquisas__suave">{textoDe(r.perguntaId ?? "")}</p>
        <figure
          className="modelo-histograma"
          aria-label={`Distribuição das notas de 0 a 10: ${r.distribuicao.map((d) => `nota ${d.valor}, ${plural(d.quantidade, "pessoa", "pessoas")}`).join("; ")}`}
        >
          <ol>
            {r.distribuicao.map((d) => (
              <li key={d.valor}>
                <span className="modelo-histograma__qtd">
                  {d.quantidade > 0 ? d.quantidade : ""}
                </span>
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
      </section>

      {r.complementares.length > 0 ? (
        <section
          className="modelo-cartao"
          aria-label="Perguntas complementares"
        >
          <h2 className="modelo-cartao__titulo">Perguntas complementares</h2>
          <p className="pesquisas__suave">
            Da maior média para a menor, na escala de 0 a 10.
          </p>
          <div className="pesquisas__tabela-caixa">
            <table
              className="pesquisas__tabela enps-tabela"
              aria-label="Perguntas complementares"
            >
              <thead>
                <tr>
                  <th scope="col">Pergunta</th>
                  <th scope="col">Distribuição (0–6 · 7–8 · 9–10)</th>
                  <th scope="col" className="pesquisas__numero">
                    Média
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.complementares.map((c) => (
                  <tr key={c.perguntaId}>
                    <td>
                      <span className="pesquisas__pessoa-textos">
                        <span className="pesquisas__forte">
                          {rotuloDe(c.perguntaId)}
                        </span>
                        <span className="pesquisas__suave">
                          {textoDe(c.perguntaId)}
                        </span>
                      </span>
                    </td>
                    <td>
                      {c.respostas > 0 ? (
                        <DistribuicaoDaComplementar
                          c={c}
                          rotulo={rotuloDe(c.perguntaId)}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pesquisas__numero">
                      {c.media === null ? "—" : umaCasaBr(c.media)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {menor && comMedia.length > 1 ? (
            <p>
              <strong>{rotuloDe(menor.perguntaId)}</strong>
              {` é o ponto que mais pede atenção (média ${umaCasaBr(menor.media!)}).`}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="modelo-cartao" aria-label="Respostas abertas">
        <h2 className="modelo-cartao__titulo">
          {`Respostas abertas · ${abertas.length}`}
        </h2>
        {abertas.length === 0 ? (
          <p className="pesquisas__suave">Nenhuma resposta aberta ainda.</p>
        ) : (
          <>
            <ul className="enps-abertas">
              {visiveis.map((a, i) => (
                <li key={`${a.perguntaId}-${i}`}>
                  <span className="pesquisas__suave">
                    {rotuloDe(a.perguntaId)}
                  </span>
                  <blockquote>{a.texto}</blockquote>
                  {a.autor ? (
                    <span className="pesquisas__suave">{a.autor}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {abertas.length > 3 ? (
              <Button
                variant="secondary"
                aria-expanded={todasAsAbertas}
                onClick={() => setTodasAsAbertas((v) => !v)}
              >
                {todasAsAbertas
                  ? "Mostrar menos"
                  : `Ver as ${abertas.length} respostas`}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
