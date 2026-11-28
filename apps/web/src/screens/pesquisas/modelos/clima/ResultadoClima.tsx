/**
 * T216 — Visão geral da Pesquisa de Clima: o índice do time (% de
 * respostas favoráveis) no medidor, com a faixa e a frase; todas as notas
 * (favoráveis, neutras, desfavoráveis); como cada dimensão contribui (anéis
 * com a posição e a faixa, por resultado ou na ordem do modelo); o que puxa
 * para cima e o que pede atenção; os destaques (3 melhores e 3 piores
 * afirmações); o resultado por afirmação (filtro por dimensão, menor
 * favorável primeiro, 8 por página) e as respostas abertas.
 */
import { useState } from "react";
import type {
  PesquisaDetalhe,
  ResultadoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { PaginacaoSimples } from "../../../pessoas/PaginacaoSimples";
import { Pilulas } from "../../componentes";
import { Rosca } from "../../graficos";
import { textoParaOPainel } from "../empresa";
import { BarraFavoravel, LegendaFavoravel } from "../resultadoComum";
import { DIMENSOES_CLIMA, PREFIXO_DAS_ABERTAS } from "./catalogo";
import {
  FRASE_DA_FAIXA_CLIMA,
  ROTULO_DA_FAIXA_CLIMA,
  faixaDoClima,
} from "./faixas";
import {
  MedidorDoIndice,
  QuadroDasNotas,
  SeloDaFaixaClima,
  corDaDimensao,
  ordinal,
  textosDaAberta,
} from "./pecas";
import { rankingDoClima } from "./planilhaClima";

export const POR_PAGINA = 8;

type Afirmacao = ResultadoClima["afirmacoes"][number];

/** As afirmações com resposta, da maior para a menor (ou ao contrário). */
function emOrdem(
  afirmacoes: readonly Afirmacao[],
  menorPrimeiro: boolean,
): Afirmacao[] {
  return afirmacoes
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.favoravel !== null)
    .sort((x, y) =>
      menorPrimeiro
        ? x.a.favoravel! - y.a.favoravel! || x.i - y.i
        : y.a.favoravel! - x.a.favoravel! || x.i - y.i,
    )
    .map((x) => x.a);
}

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
  const [ordem, setOrdem] = useState<"resultado" | "modelo">("resultado");
  const [filtro, setFiltro] = useState<string>("todas");
  const [menorPrimeiro, setMenorPrimeiro] = useState(false);
  const [pagina, setPagina] = useState(1);

  const ranking = rankingDoClima(r);
  const posicao = new Map(ranking.map((d, i) => [d.chave, i + 1]));
  const dimensoes = ordem === "resultado" ? ranking : r.dimensoes;
  const cima = ranking[0];
  const atencao = ranking.length > 1 ? ranking.at(-1) : undefined;
  const melhores = emOrdem(r.afirmacoes, false).slice(0, 3);
  const piores = emOrdem(r.afirmacoes, true).slice(0, 3);
  const doFiltro = r.afirmacoes.filter(
    (a) => filtro === "todas" || a.dimensao === filtro,
  );
  const lista = menorPrimeiro ? emOrdem(doFiltro, true) : doFiltro;
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const daPagina = lista.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  const abertas = todas.filter((p) => p.chave?.startsWith(PREFIXO_DAS_ABERTAS));
  const totalDeAbertas = abertas.reduce(
    (t, p) => t + textosDaAberta(geral, p.id).length,
    0,
  );
  const rotuloDe = (chave: string) =>
    DIMENSOES_CLIMA.find((d) => d.chave === chave)?.rotulo ?? chave;

  const linhaDaAfirmacao = (a: Afirmacao) => {
    const texto = textoDe.get(a.perguntaId) ?? a.chave;
    return (
      <li key={a.chave}>
        <span className="clima-afirmacao">
          <span>{texto}</span>
          <span className="clima-afirmacao__dimensao">
            <span
              className="modelo-bolinha"
              style={{ background: corDaDimensao(a.dimensao) }}
              aria-hidden="true"
            />
            {rotuloDe(a.dimensao)}
          </span>
        </span>
        <span className="clima-numero">
          {a.favoravel === null ? "—" : `${a.favoravel}%`}
        </span>
      </li>
    );
  };

  return (
    <div className="modelo-resultado">
      <div className="clima-topo">
        <section
          className="modelo-cartao clima-indice"
          aria-labelledby="clima-indice"
        >
          <h2 id="clima-indice" className="modelo-cartao__titulo">
            Índice do time
          </h2>
          <MedidorDoIndice
            valor={r.favoravel}
            faixa={r.faixa}
            rotulo="Índice do time"
          />
          <SeloDaFaixaClima faixa={r.faixa} />
          <p className="pesquisas__suave">
            {r.faixa
              ? FRASE_DA_FAIXA_CLIMA[r.faixa]
              : "Ainda sem respostas às afirmações."}
          </p>
          <p className="pesquisas__suave">
            {`% de respostas favoráveis (4 e 5) nas ${plural(r.afirmacoes.length, "afirmação", "afirmações")}, com ${plural(geral.respostas, "resposta", "respostas")}.`}
          </p>
        </section>
        <div className="modelo-cartao">
          <QuadroDasNotas
            favoraveis={r.notas.favoraveis}
            neutras={r.notas.neutras}
            desfavoraveis={r.notas.desfavoraveis}
          />
        </div>
      </div>

      <section className="modelo-cartao" aria-labelledby="clima-dimensoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="clima-dimensoes">Como cada dimensão contribui</h2>
            <p className="pesquisas__suave">
              % de respostas favoráveis em cada dimensão
            </p>
          </div>
          <Pilulas
            rotulo="Ordem das dimensões"
            valor={ordem}
            onMudar={setOrdem}
            opcoes={[
              { valor: "resultado", rotulo: "Ordenar por resultado" },
              { valor: "modelo", rotulo: "Ordem do modelo" },
            ]}
          />
        </div>
        <ol className="clima-aneis" aria-label="Dimensões">
          {dimensoes.map((d) => (
            <li key={d.chave}>
              <Rosca
                fracao={(d.favoravel ?? 0) / 100}
                centro={d.favoravel === null ? "—" : `${d.favoravel}%`}
                cor={corDaDimensao(d.chave)}
                rotulo={`${d.rotulo}: ${d.favoravel === null ? "sem respostas" : `${d.favoravel}% favorável`}`}
              />
              <strong>{d.rotulo}</strong>
              <span className="pesquisas__suave">
                {posicao.has(d.chave)
                  ? `${ordinal(posicao.get(d.chave)!)} lugar`
                  : "Sem respostas"}
              </span>
              <SeloDaFaixaClima faixa={d.faixa} />
            </li>
          ))}
        </ol>
        {cima ? (
          <div className="clima-caixas">
            <div className="clima-caixa" data-tom="bom">
              <span className="modelo-cartao__titulo">Puxa para cima</span>
              <p>
                <strong>{cima.rotulo}</strong>
                {` · ${cima.favoravel}% favorável`}
              </p>
            </div>
            {atencao ? (
              <div className="clima-caixa" data-tom="atencao">
                <span className="modelo-cartao__titulo">Pede atenção</span>
                <p>
                  <strong>{atencao.rotulo}</strong>
                  {` · ${atencao.favoravel}% favorável`}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {melhores.length > 0 ? (
        <section className="modelo-cartao" aria-labelledby="clima-destaques">
          <h2 id="clima-destaques">Destaques</h2>
          <div className="clima-caixas">
            <div>
              <h3 className="modelo-cartao__titulo">
                As 3 afirmações mais favoráveis
              </h3>
              <ol className="clima-lista" aria-label="Mais favoráveis">
                {melhores.map(linhaDaAfirmacao)}
              </ol>
            </div>
            <div>
              <h3 className="modelo-cartao__titulo">
                As 3 afirmações menos favoráveis
              </h3>
              <ol className="clima-lista" aria-label="Menos favoráveis">
                {piores.map(linhaDaAfirmacao)}
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      <section className="modelo-cartao" aria-labelledby="clima-afirmacoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="clima-afirmacoes">Resultado por afirmação</h2>
            <p className="pesquisas__suave">
              {plural(lista.length, "afirmação", "afirmações")}
            </p>
          </div>
          <LegendaFavoravel />
        </div>
        <div className="clima-filtros">
          <Pilulas
            rotulo="Filtrar por dimensão"
            valor={filtro}
            onMudar={(v) => {
              setFiltro(v);
              setPagina(1);
            }}
            opcoes={[
              {
                valor: "todas",
                rotulo: "Todas",
                contagem: r.afirmacoes.length,
              },
              ...DIMENSOES_CLIMA.map((d) => ({
                valor: d.chave as string,
                rotulo: d.rotulo,
                contagem: r.afirmacoes.filter((a) => a.dimensao === d.chave)
                  .length,
              })),
            ]}
          />
          <label className="pesquisas__marcacao">
            <input
              type="checkbox"
              checked={menorPrimeiro}
              onChange={(e) => {
                setMenorPrimeiro(e.target.checked);
                setPagina(1);
              }}
            />
            Menor favorável primeiro
          </label>
        </div>
        <ol className="clima-lista" aria-label="Afirmações">
          {daPagina.map((a) => {
            const texto = textoDe.get(a.perguntaId) ?? a.chave;
            return (
              <li key={a.chave}>
                <span className="clima-afirmacao">
                  <span>{texto}</span>
                  <span className="clima-afirmacao__dimensao">
                    <span
                      className="modelo-bolinha"
                      style={{ background: corDaDimensao(a.dimensao) }}
                      aria-hidden="true"
                    />
                    {rotuloDe(a.dimensao)}
                    {a.favoravel !== null ? (
                      <span>{` · ${ROTULO_DA_FAIXA_CLIMA[faixaDoClima(a.favoravel)]}`}</span>
                    ) : null}
                  </span>
                </span>
                <BarraFavoravel
                  favoravel={a.favoravel ?? 0}
                  neutro={a.neutro ?? 0}
                  desfavoravel={a.desfavoravel ?? 0}
                  rotulo={texto}
                />
              </li>
            );
          })}
        </ol>
        <PaginacaoSimples
          rotulo="Páginas das afirmações"
          pagina={atual}
          totalPaginas={paginas}
          focoEstavel
          onIrPara={setPagina}
        />
      </section>

      <section className="modelo-cartao" aria-labelledby="clima-abertas">
        <h2 id="clima-abertas">
          Respostas abertas{" "}
          <span className="pesquisas__contagem">{totalDeAbertas}</span>
        </h2>
        {abertas.map((p) => {
          const textos = textosDaAberta(geral, p.id);
          return (
            <div key={p.id} aria-label={textoParaOPainel(p.texto)} role="group">
              <h3 className="modelo-cartao__titulo">
                {`${textoParaOPainel(p.texto)} · ${plural(textos.length, "resposta", "respostas")}`}
              </h3>
              {textos.length === 0 ? (
                <p className="pesquisas__suave">Nenhuma resposta escrita.</p>
              ) : (
                <ul className="modelo-lista-comentarios">
                  {textos.map((t, i) => (
                    <li key={i}>{`“${t}”`}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
