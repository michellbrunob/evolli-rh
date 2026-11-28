/**
 * T216 — Pulso e Clima: o resultado de uma resposta na régua do modelo. O
 * score 0–100 da resposta ao lado do time, quantas afirmações em cada lado,
 * as notas de recomendação (eNPS e LNPS) com o índice do time, cada
 * dimensão (resposta × time), onde a resposta mais difere do time, a
 * distribuição de 1 a 5 (resposta × % do time) e os comentários.
 */
import type { ResultadoIndividualPulsoClima } from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import {
  BarraDeScore,
  ROTULO_DA_FAIXA,
  ReguaDeScore,
  SeloDaFaixa,
  comSinal,
} from "../resultadoComum";
import { DIMENSOES_PULSO_CLIMA, corDaDimensao } from "./catalogo";
import "./PulsoClima.css";

const ROTULO_DO_COMENTARIO: Readonly<Record<string, string>> = {
  lnps: "LNPS · liderança direta",
  enps: "eNPS · empresa",
};

const ROTULOS_1_A_5 = [
  "Discordo totalmente",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo totalmente",
] as const;

export function grupoDaNota(nota: number): string {
  return nota >= 9 ? "Promotor" : nota >= 7 ? "Neutro" : "Detrator";
}

/** "8 pontos acima do time (47)" / "igual ao time (47)". */
export function comparacaoComOTime(valor: number, time: number): string {
  const d = valor - time;
  if (d === 0) return `igual ao time (${time})`;
  return `${plural(Math.abs(d), "ponto", "pontos")} ${d > 0 ? "acima" : "abaixo"} do time (${time})`;
}

const corDe = (chave: string) => {
  const i = DIMENSOES_PULSO_CLIMA.findIndex((d) => d.chave === chave);
  return i >= 0 ? `var(${corDaDimensao(i)})` : "var(--color-ink-subtle)";
};

export function IndividualPulsoClima({
  p,
}: {
  readonly p: ResultadoIndividualPulsoClima;
}) {
  const total = p.favoraveis + p.neutras + p.desfavoraveis;
  const comparaveis = p.dimensoes.filter(
    (d) => d.score !== null && d.scoreTime !== null,
  );
  const diferencas = [...comparaveis]
    .sort(
      (a, b) =>
        Math.abs(b.score! - b.scoreTime!) - Math.abs(a.score! - a.scoreTime!),
    )
    .filter((d) => d.score !== d.scoreTime)
    .slice(0, 3);
  const maiorBarra = Math.max(
    1,
    ...p.distribuicao.map((d) => (total ? (d.resposta / total) * 100 : 0)),
    ...p.distribuicao.map((d) => d.time),
  );
  const rotuloDe = (chave: string) =>
    p.dimensoes.find((d) => d.chave === chave)?.rotulo ??
    ROTULO_DO_COMENTARIO[chave] ??
    chave;

  return (
    <div className="modelo-resultado">
      <section
        className="modelo-indicadores"
        aria-label="Indicadores da resposta"
      >
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Score da resposta</h3>
          {p.score !== null && p.faixa !== null ? (
            <>
              <p className="modelo-valor">
                <strong>{p.score}</strong>
                <span className="pesquisas__suave">/100</span>
                <SeloDaFaixa faixa={p.faixa} texto={ROTULO_DA_FAIXA[p.faixa]} />
              </p>
              {p.scoreTime !== null ? (
                <p className="pesquisas__suave">
                  {comparacaoComOTime(p.score, p.scoreTime)}
                </p>
              ) : null}
              <ReguaDeScore valor={p.score} rotulo="Score da resposta" />
            </>
          ) : (
            <p className="pesquisas__suave">—</p>
          )}
        </div>
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">
            {`Todas as respostas · ${plural(total, "afirmação", "afirmações")}`}
          </h3>
          <ul className="pc-contagem" aria-label="Afirmações por lado">
            <li data-lado="favoravel">
              <strong>{p.favoraveis}</strong>
              <span>{p.favoraveis === 1 ? "favorável" : "favoráveis"}</span>
            </li>
            <li data-lado="neutro">
              <strong>{p.neutras}</strong>
              <span>{p.neutras === 1 ? "neutra" : "neutras"}</span>
            </li>
            <li data-lado="desfavoravel">
              <strong>{p.desfavoraveis}</strong>
              <span>
                {p.desfavoraveis === 1 ? "desfavorável" : "desfavoráveis"}
              </span>
            </li>
          </ul>
        </div>
        {(
          [
            ["eNPS · empresa", "eNPS do time", p.enps],
            ["LNPS · liderança direta", "LNPS do time", p.lnps],
          ] as const
        ).map(([titulo, doTime, x]) => (
          <div key={titulo} className="modelo-cartao">
            <h3 className="modelo-cartao__titulo">{titulo}</h3>
            {x.nota === null ? (
              <p className="pesquisas__suave">Sem nota nesta resposta.</p>
            ) : (
              <>
                <p className="modelo-valor">
                  <strong>{x.nota}</strong>
                  <span className="pesquisas__suave">/10</span>
                </p>
                <p className="pesquisas__suave">
                  {`${grupoDaNota(x.nota)}${x.indiceTime !== null ? ` · ${doTime}: ${comSinal(x.indiceTime)}` : ""}`}
                </p>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="modelo-cartao" aria-labelledby="pc-ind-dimensoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="pc-ind-dimensoes">Por dimensão</h2>
            <p className="pesquisas__suave">
              Score de 0 a 100 desta resposta, ao lado do time
            </p>
          </div>
        </div>
        <table className="modelo-tabela" aria-label="Dimensões da resposta">
          <thead>
            <tr>
              <th scope="col">Dimensão</th>
              <th scope="col">Resposta</th>
              <th scope="col">Time</th>
              <th scope="col">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {p.dimensoes.map((d) => (
              <tr key={d.chave}>
                <td>
                  <span
                    className="modelo-bolinha"
                    style={{ background: corDe(d.chave) }}
                    aria-hidden="true"
                  />
                  {d.rotulo}
                </td>
                <td>
                  {d.score !== null && d.faixa !== null ? (
                    <span className="pc-celula-score">
                      <BarraDeScore
                        valor={d.score}
                        faixa={d.faixa}
                        rotulo={`${d.rotulo}, resposta`}
                      />
                      <span className="modelo-numero">{d.score}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="modelo-numero">{d.scoreTime ?? "—"}</td>
                <td className="modelo-numero">
                  {d.score !== null && d.scoreTime !== null
                    ? comSinal(d.score - d.scoreTime)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="pc-duas-colunas">
        <section className="modelo-cartao" aria-labelledby="pc-ind-difere">
          <h2 id="pc-ind-difere">Onde esta resposta difere do time</h2>
          {diferencas.length === 0 ? (
            <p className="pesquisas__suave">
              Nenhuma dimensão foge do resultado do time.
            </p>
          ) : (
            <ul className="pc-diferencas">
              {diferencas.map((d) => (
                <li key={d.chave}>
                  <strong>{d.rotulo}</strong>
                  <span className="pesquisas__suave">
                    {comparacaoComOTime(d.score!, d.scoreTime!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="modelo-cartao" aria-labelledby="pc-ind-dist">
          <h2 id="pc-ind-dist">Distribuição das notas</h2>
          <p className="pesquisas__suave">
            De 1 a 5: esta resposta (quantas afirmações) e o time (%)
          </p>
          <ol className="pc-distribuicao" aria-label="Distribuição de 1 a 5">
            {p.distribuicao.map((d) => {
              const pessoa = total ? (d.resposta / total) * 100 : 0;
              return (
                <li
                  key={d.valor}
                  aria-label={`${d.valor} ${ROTULOS_1_A_5[d.valor - 1]}: ${plural(d.resposta, "afirmação", "afirmações")} nesta resposta, ${d.time}% do time`}
                >
                  <span className="pc-distribuicao__nota">{d.valor}</span>
                  <span className="pc-distribuicao__barras" aria-hidden="true">
                    <span
                      data-serie="resposta"
                      style={{ width: `${(pessoa / maiorBarra) * 100}%` }}
                    />
                    <span
                      data-serie="time"
                      style={{ width: `${(d.time / maiorBarra) * 100}%` }}
                    />
                  </span>
                  <span className="pc-distribuicao__valores" aria-hidden="true">
                    {`${d.resposta} · ${d.time}%`}
                  </span>
                </li>
              );
            })}
          </ol>
          <ul className="modelo-legenda" aria-hidden="true">
            <li>
              <span data-serie="resposta" />
              Esta resposta
            </li>
            <li>
              <span data-serie="time" />
              Time
            </li>
          </ul>
        </section>
      </div>

      <section className="modelo-cartao" aria-labelledby="pc-ind-comentarios">
        <h2 id="pc-ind-comentarios">
          Comentários{" "}
          <span className="pesquisas__contagem">{p.comentarios.length}</span>
        </h2>
        {p.comentarios.length === 0 ? (
          <p className="pesquisas__suave">Nenhum comentário nesta resposta.</p>
        ) : (
          <ul
            className="modelo-lista-comentarios"
            aria-label="Comentários da resposta"
          >
            {p.comentarios.map((c) => (
              <li
                key={c.dimensao}
                style={{ ["--comentario-cor" as string]: corDe(c.dimensao) }}
              >
                <span className="pesquisas__suave">{rotuloDe(c.dimensao)}</span>
                <span>{`“${c.texto}”`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
