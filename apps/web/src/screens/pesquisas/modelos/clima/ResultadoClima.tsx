/**
 * T216 — Visão geral da Pesquisa de Clima: o % favorável geral com a faixa,
 * cada dimensão (do % favorável mais baixo ao mais alto) e, ao abrir, as 3
 * subdimensões e as afirmações; e as perguntas abertas.
 */
import type {
  PesquisaDetalhe,
  ResultadoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { textoParaOPainel } from "../empresa";
import {
  BarraDeScore,
  BarraFavoravel,
  LegendaFavoravel,
  ROTULO_DA_FAIXA,
  ReguaDeScore,
  SeloDaFaixa,
} from "../resultadoComum";
import { textosDoComentario } from "../pulso_clima/ResultadoPulsoClima";
import { DIMENSOES_CLIMA } from "./catalogo";

const corDe = (chave: string) =>
  `var(${DIMENSOES_CLIMA.find((d) => d.chave === chave)?.cor ?? "--color-ink-subtle"})`;

export function ResultadoClimaVisao({
  detalhe,
  geral,
  r,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoClima;
}) {
  const todas = detalhe.secoes.flatMap((s) => s.perguntas);
  const textoDe = new Map(todas.map((p) => [p.id, textoParaOPainel(p.texto)]));
  const ordenadas = [...r.dimensoes]
    .filter((d) => d.favoravel !== null)
    .sort((a, b) => a.favoravel! - b.favoravel!);
  const abertas = todas.filter((p) => p.chave?.startsWith("clima_aberta_"));
  const forte = ordenadas.at(-1);
  const fragil = ordenadas[0];

  return (
    <div className="modelo-resultado">
      <section className="modelo-indicadores" aria-label="Indicadores">
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Favorável no geral</h3>
          {r.favoravel !== null && r.faixa ? (
            <>
              <p className="modelo-valor">
                <strong>{`${r.favoravel}%`}</strong>
                <SeloDaFaixa faixa={r.faixa} texto={ROTULO_DA_FAIXA[r.faixa]} />
              </p>
              <p className="pesquisas__suave">
                Quem concorda (4 e 5) nas 60 afirmações.
              </p>
              <ReguaDeScore valor={r.favoravel} rotulo="Favorável no geral" />
            </>
          ) : (
            <p className="pesquisas__suave">—</p>
          )}
        </div>
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Score geral</h3>
          <p className="modelo-valor">
            <strong>{r.score ?? "—"}</strong>
            <span className="pesquisas__suave">/100</span>
          </p>
          <p className="pesquisas__suave">A média de 1 a 5 em 0 a 100.</p>
        </div>
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Dimensão mais forte</h3>
          <p className="modelo-valor">
            <strong>{forte ? `${forte.favoravel}%` : "—"}</strong>
          </p>
          <p>{forte?.rotulo ?? ""}</p>
        </div>
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Dimensão mais frágil</h3>
          <p className="modelo-valor">
            <strong>{fragil ? `${fragil.favoravel}%` : "—"}</strong>
          </p>
          <p>{fragil?.rotulo ?? ""}</p>
        </div>
      </section>

      <section className="modelo-cartao" aria-labelledby="clima-dimensoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="clima-dimensoes">Resultado por dimensão</h2>
            <p className="pesquisas__suave">
              % favorável · da dimensão mais baixa para a mais alta
            </p>
          </div>
          <LegendaFavoravel />
        </div>
        <ol className="modelo-dimensoes" aria-label="Dimensões">
          {ordenadas.map((d) => (
            <li key={d.chave}>
              <span className="modelo-dimensao-nome">
                <strong>
                  <span
                    className="modelo-bolinha"
                    style={{ background: corDe(d.chave) }}
                    aria-hidden="true"
                  />
                  {d.rotulo}
                </strong>
                <span className="pesquisas__suave">
                  {`${plural(d.afirmacoes, "afirmação", "afirmações")} · ${ROTULO_DA_FAIXA[d.faixa!]}`}
                </span>
              </span>
              <BarraDeScore
                valor={d.favoravel!}
                faixa={d.faixa!}
                rotulo={`${d.rotulo} (% favorável)`}
              />
              <span className="modelo-numero">{`${d.favoravel}%`}</span>
              <BarraFavoravel
                favoravel={d.favoravel ?? 0}
                neutro={d.neutro ?? 0}
                desfavoravel={d.desfavoravel ?? 0}
                rotulo={d.rotulo}
              />
            </li>
          ))}
        </ol>
      </section>

      <section className="modelo-resultado" aria-labelledby="clima-sub">
        <div className="modelo-secao-cabeca">
          <h2 id="clima-sub">Subdimensões e afirmações</h2>
        </div>
        {r.dimensoes.map((d) => (
          <details key={d.chave} className="modelo-detalhe">
            <summary>
              <span
                className="modelo-bolinha"
                style={{ background: corDe(d.chave) }}
                aria-hidden="true"
              />
              <strong>{d.rotulo}</strong>
              <span className="modelo-numero">
                {d.favoravel === null ? "—" : `${d.favoravel}% favorável`}
              </span>
            </summary>
            <table className="modelo-tabela">
              <thead>
                <tr>
                  <th scope="col">Subdimensão e afirmação</th>
                  <th scope="col">Desfavorável · Favorável</th>
                  <th scope="col">Média</th>
                </tr>
              </thead>
              <tbody>
                {(d.subdimensoes ?? []).flatMap((s) => [
                  <tr key={`${d.chave}-${s.chave}`}>
                    <th scope="row">
                      {s.rotulo}
                      {s.faixa ? (
                        <>
                          {" "}
                          <SeloDaFaixa
                            faixa={s.faixa}
                            texto={ROTULO_DA_FAIXA[s.faixa]}
                          />
                        </>
                      ) : null}
                    </th>
                    <td>
                      <BarraFavoravel
                        favoravel={s.favoravel ?? 0}
                        neutro={s.neutro ?? 0}
                        desfavoravel={s.desfavoravel ?? 0}
                        rotulo={s.rotulo}
                      />
                    </td>
                    <td className="modelo-numero">
                      {s.score === null ? "—" : `${s.score}/100`}
                    </td>
                  </tr>,
                  ...r.afirmacoes
                    .filter(
                      (a) =>
                        a.dimensao === d.chave && a.subdimensao === s.chave,
                    )
                    .map((a) => (
                      <tr key={a.chave}>
                        <td>{textoDe.get(a.perguntaId) ?? a.chave}</td>
                        <td>
                          <BarraFavoravel
                            favoravel={a.favoravel ?? 0}
                            neutro={a.neutro ?? 0}
                            desfavoravel={a.desfavoravel ?? 0}
                            rotulo={textoDe.get(a.perguntaId) ?? a.chave}
                          />
                        </td>
                        <td className="modelo-numero">
                          {a.media === null
                            ? "—"
                            : a.media.toFixed(2).replace(".", ",")}
                        </td>
                      </tr>
                    )),
                ])}
              </tbody>
            </table>
          </details>
        ))}
      </section>

      {abertas.map((p) => {
        const textos = textosDoComentario(geral, p.id);
        return (
          <section key={p.id} className="modelo-cartao" aria-label={p.texto}>
            <h2 className="modelo-cartao__titulo">
              {textoParaOPainel(p.texto)}
            </h2>
            {textos.length === 0 ? (
              <p className="pesquisas__suave">Nenhuma resposta escrita.</p>
            ) : (
              <ul className="modelo-lista-comentarios">
                {textos.map((t, i) => (
                  <li key={i}>{`“${t}”`}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
