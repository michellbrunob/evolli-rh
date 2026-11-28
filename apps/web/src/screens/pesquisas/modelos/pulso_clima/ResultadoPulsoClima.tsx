/**
 * T216 — Visão geral do Pulso e Clima: 4 cartões (score geral 0–100 com a
 * régua, eNPS, LNPS e a dimensão mais crítica), o resultado por dimensão
 * (da mais baixa para a mais alta, com score e desfavorável/favorável), os
 * blocos do eNPS e do LNPS (régua, distribuição e grupos), o detalhe por
 * pergunta em acordeões e os comentários por dimensão.
 */
import { useState } from "react";
import type {
  PesquisaDetalhe,
  ResultadoPulsoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { textoParaOPainel } from "../empresa";
import {
  BarraDeScore,
  BarraFavoravel,
  BlocoDeRecomendacao,
  LegendaFavoravel,
  ROTULO_DA_FAIXA,
  ROTULO_DA_RECOMENDACAO,
  ReguaDeScore,
  SeloDaFaixa,
  VISUAL_DA_RECOMENDACAO,
  comSinal,
  pct,
} from "../resultadoComum";
import { DIMENSOES_PULSO_CLIMA, corDaDimensao } from "./catalogo";

const corDe = (chave: string) => {
  const i = DIMENSOES_PULSO_CLIMA.findIndex((d) => d.chave === chave);
  return i >= 0 ? `var(${corDaDimensao(i)})` : "var(--color-ink-subtle)";
};

const ROTULO_DO_GRUPO: Readonly<Record<string, string>> = {
  lnps: "LNPS · liderança direta",
  enps: "eNPS · empresa",
};

export function textosDoComentario(
  geral: ResultadosPesquisa,
  perguntaId: string,
): string[] {
  const r = geral.perguntas.find((p) => p.perguntaId === perguntaId);
  return r && "textos" in r ? r.textos.map((t) => t.texto) : [];
}

export function ResultadoPulsoClima({
  detalhe,
  geral,
  r,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoPulsoClima;
}) {
  const textoDe = new Map(
    detalhe.secoes.flatMap((s) =>
      s.perguntas.map((p) => [p.id, textoParaOPainel(p.texto)] as const),
    ),
  );
  const ordenadas = [...r.dimensoes]
    .filter((d) => d.score !== null)
    .sort((a, b) => a.score! - b.score!);
  const critica = ordenadas[0] ?? null;
  const [filtro, setFiltro] = useState<string>("todas");
  const comentarios = r.comentarios.flatMap((c) =>
    textosDoComentario(geral, c.perguntaId).map((texto) => ({
      dimensao: c.dimensao,
      texto,
    })),
  );
  const visiveis =
    filtro === "todas"
      ? comentarios
      : comentarios.filter((c) => c.dimensao === filtro);
  const rotuloDaDimensao = (chave: string) =>
    r.dimensoes.find((d) => d.chave === chave)?.rotulo ??
    ROTULO_DO_GRUPO[chave] ??
    chave;

  return (
    <div className="modelo-resultado">
      <section className="modelo-indicadores" aria-label="Indicadores">
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Score geral</h3>
          {r.score !== null && r.faixa !== null ? (
            <>
              <p className="modelo-valor">
                <strong>{r.score}</strong>
                <span className="pesquisas__suave">/100</span>
                <SeloDaFaixa faixa={r.faixa} texto={ROTULO_DA_FAIXA[r.faixa]} />
              </p>
              <p className="pesquisas__suave">Média das 22 afirmações.</p>
              <ReguaDeScore valor={r.score} rotulo="Score geral" />
            </>
          ) : (
            <p className="pesquisas__suave">—</p>
          )}
        </div>
        {(
          [
            ["eNPS · empresa", r.enps],
            ["LNPS · liderança direta", r.lnps],
          ] as const
        ).map(([titulo, nps]) => (
          <div key={titulo} className="modelo-cartao">
            <h3 className="modelo-cartao__titulo">{titulo}</h3>
            {nps.indice !== null && nps.faixa !== null ? (
              <>
                <p className="modelo-valor">
                  <strong>{comSinal(nps.indice)}</strong>
                  <SeloDaFaixa
                    faixa={VISUAL_DA_RECOMENDACAO[nps.faixa]}
                    texto={ROTULO_DA_RECOMENDACAO[nps.faixa]}
                  />
                </p>
                <p className="pesquisas__suave">
                  {`${pct(nps.promotores, nps.respostas)}% promotores · ${pct(nps.detratores, nps.respostas)}% detratores`}
                </p>
                <span className="modelo-favoravel__trilho" aria-hidden="true">
                  <span
                    data-lado="desfavoravel"
                    style={{ width: `${pct(nps.detratores, nps.respostas)}%` }}
                  />
                  <span
                    data-lado="neutro"
                    style={{ width: `${pct(nps.neutros, nps.respostas)}%` }}
                  />
                  <span
                    data-lado="favoravel"
                    style={{ width: `${pct(nps.promotores, nps.respostas)}%` }}
                  />
                </span>
              </>
            ) : (
              <p className="pesquisas__suave">Ainda sem notas.</p>
            )}
          </div>
        ))}
        <div className="modelo-cartao">
          <h3 className="modelo-cartao__titulo">Dimensão mais crítica</h3>
          {critica && critica.faixa ? (
            <>
              <p className="modelo-valor">
                <strong>{critica.score}</strong>
                <span className="pesquisas__suave">/100</span>
                <SeloDaFaixa
                  faixa={critica.faixa}
                  texto={ROTULO_DA_FAIXA[critica.faixa]}
                />
              </p>
              <p>{critica.rotulo}</p>
            </>
          ) : (
            <p className="pesquisas__suave">—</p>
          )}
        </div>
      </section>

      <section className="modelo-cartao" aria-labelledby="pc-dimensoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="pc-dimensoes">Resultado por dimensão</h2>
            <p className="pesquisas__suave">
              Score de 0 a 100 · da dimensão mais baixa para a mais alta
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
                valor={d.score!}
                faixa={d.faixa!}
                rotulo={d.rotulo}
              />
              <span className="modelo-numero">{d.score}</span>
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

      <div className="modelo-recomendacoes">
        <BlocoDeRecomendacao
          titulo="eNPS · empresa"
          enunciado={
            r.enps.perguntaId ? (textoDe.get(r.enps.perguntaId) ?? null) : null
          }
          r={r.enps}
        />
        <BlocoDeRecomendacao
          titulo="LNPS · liderança direta"
          enunciado={
            r.lnps.perguntaId ? (textoDe.get(r.lnps.perguntaId) ?? null) : null
          }
          r={r.lnps}
        />
      </div>

      <section className="modelo-resultado" aria-labelledby="pc-detalhe">
        <div className="modelo-secao-cabeca">
          <h2 id="pc-detalhe">Detalhe por pergunta</h2>
        </div>
        {r.dimensoes.map((d) => {
          const afirmacoes = r.afirmacoes.filter((a) => a.dimensao === d.chave);
          return (
            <details key={d.chave} className="modelo-detalhe">
              <summary>
                <span
                  className="modelo-bolinha"
                  style={{ background: corDe(d.chave) }}
                  aria-hidden="true"
                />
                <strong>{d.rotulo}</strong>
                <span className="modelo-numero">
                  {d.score === null ? "—" : `${d.score}/100`}
                </span>
              </summary>
              <table className="modelo-tabela">
                <thead>
                  <tr>
                    <th scope="col">Afirmação</th>
                    <th scope="col">Desfavorável · Favorável</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {afirmacoes.map((a) => (
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
                      <td className="modelo-numero">{a.score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.comentarios > 0 ? (
                <p className="pesquisas__suave modelo-detalhe__rodape">
                  {`${plural(d.comentarios, "comentário", "comentários")} sobre esta dimensão`}
                </p>
              ) : null}
            </details>
          );
        })}
      </section>

      <section className="modelo-cartao" aria-labelledby="pc-comentarios">
        <div className="modelo-secao-cabeca">
          <h2 id="pc-comentarios">
            Comentários{" "}
            <span className="pesquisas__contagem">{comentarios.length}</span>
          </h2>
        </div>
        {detalhe.identificacao !== "identificada" ? (
          <p className="pesquisas__suave">
            Os comentários aparecem sem nome e em ordem alfabética, para ninguém
            ser identificado.
          </p>
        ) : null}
        <div className="modelo-comentarios">
          <ul
            className="modelo-filtro-dimensoes"
            aria-label="Filtrar por dimensão"
          >
            <li>
              <button
                type="button"
                aria-pressed={filtro === "todas"}
                onClick={() => setFiltro("todas")}
              >
                Todas as dimensões
                <span className="pesquisas__contagem">
                  {comentarios.length}
                </span>
              </button>
            </li>
            {r.comentarios.map((c) => (
              <li key={c.dimensao}>
                <button
                  type="button"
                  aria-pressed={filtro === c.dimensao}
                  onClick={() => setFiltro(c.dimensao)}
                >
                  <span
                    className="modelo-bolinha"
                    style={{ background: corDe(c.dimensao) }}
                    aria-hidden="true"
                  />
                  {rotuloDaDimensao(c.dimensao)}
                  <span className="pesquisas__contagem">{c.quantidade}</span>
                </button>
              </li>
            ))}
          </ul>
          {visiveis.length === 0 ? (
            <p className="pesquisas__suave">Nenhum comentário por aqui.</p>
          ) : (
            <ul className="modelo-lista-comentarios" aria-label="Comentários">
              {visiveis.map((c, i) => (
                <li
                  key={`${c.dimensao}-${i}`}
                  style={{ ["--comentario-cor" as string]: corDe(c.dimensao) }}
                >
                  <span className="pesquisas__suave">
                    {rotuloDaDimensao(c.dimensao)}
                  </span>
                  <span>{`“${c.texto}”`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
