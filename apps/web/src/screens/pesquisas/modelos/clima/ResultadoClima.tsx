/**
 * T216 — Visão geral da Pesquisa de Clima: o índice do time (% de
 * respostas favoráveis) no medidor, com a faixa e a frase; todas as notas
 * (favoráveis, neutras, desfavoráveis); como cada dimensão contribui (anéis
 * com a posição e a faixa, por resultado ou na ordem do modelo); o que puxa
 * para cima e o que pede atenção (com o que a dimensão representa e os
 * empates); os destaques (3 melhores e 3 piores afirmações, com "Ver todas
 * as afirmações"); o resultado por afirmação (filtro por dimensão, menor
 * favorável primeiro já ligado, 8 por página) e as respostas abertas.
 * Medidor e todas as respostas à esquerda; os anéis à direita.
 */
import { useRef, useState } from "react";
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
import { RespostasAbertas } from "../RespostasAbertas";
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

/**
 * A leitura das dimensões para "Puxa para cima" e "Pede atenção": as de
 * maior e de menor % favorável (empates juntos), o que representam e a
 * afirmação mais baixa entre as de menor resultado.
 */
export function leituraDasDimensoes(
  r: ResultadoClima,
  textoDe: ReadonlyMap<string, string>,
): {
  readonly todasEmpatadas: boolean;
  readonly maior: number;
  readonly menor: number;
  readonly maiores: string;
  readonly menores: string;
  readonly sobreAsMaiores: string;
  readonly sobreAsMenores: string;
  readonly maisBaixa: { texto: string; favoravel: number } | null;
} | null {
  const comResultado = rankingDoClima(r);
  if (comResultado.length === 0) return null;
  const maior = comResultado[0]!.favoravel!;
  const menor = comResultado.at(-1)!.favoravel!;
  const empatadas = (v: number) =>
    comResultado.filter((d) => d.favoravel === v);
  const nomes = (ds: readonly { rotulo: string }[]) =>
    ds.length === comResultado.length && ds.length > 1
      ? "Todas as dimensões"
      : ds.length === 1
        ? ds[0]!.rotulo
        : `${ds
            .slice(0, -1)
            .map((d) => d.rotulo)
            .join(", ")} e ${ds.at(-1)!.rotulo}`;
  const sobre = (ds: readonly { chave: string }[], lado: string) =>
    ds.length === 1
      ? (DIMENSOES_CLIMA.find((d) => d.chave === ds[0]!.chave)?.texto ?? "")
      : `Empatam no ${lado} resultado.`;
  const maiores = empatadas(maior);
  const menores = empatadas(menor);
  const chaves = new Set(menores.map((d) => d.chave));
  const baixa = emOrdem(
    r.afirmacoes.filter((a) => chaves.has(a.dimensao)),
    true,
  )[0];
  return {
    todasEmpatadas: maior === menor,
    maior,
    menor,
    maiores: nomes(maiores),
    menores: nomes(menores),
    sobreAsMaiores: sobre(maiores, "maior"),
    sobreAsMenores: sobre(menores, "menor"),
    maisBaixa: baixa
      ? {
          texto: textoDe.get(baixa.perguntaId) ?? baixa.chave,
          favoravel: baixa.favoravel!,
        }
      : null,
  };
}

export function ResultadoClimaVisao({
  detalhe,
  geral,
  r,
  onIrParaAnalises,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoClima;
  /** "Ver temas em Análises". */
  readonly onIrParaAnalises?: () => void;
}) {
  const todas = detalhe.secoes.flatMap((s) => s.perguntas);
  const textoDe = new Map(todas.map((p) => [p.id, textoParaOPainel(p.texto)]));
  const [ordem, setOrdem] = useState<"resultado" | "modelo">("resultado");
  const [filtro, setFiltro] = useState<string>("todas");
  // Abre pelo que pede atenção: o menor favorável primeiro.
  const [menorPrimeiro, setMenorPrimeiro] = useState(true);
  const [pagina, setPagina] = useState(1);
  const tituloDasAfirmacoes = useRef<HTMLHeadingElement>(null);

  const ranking = rankingDoClima(r);
  const posicao = new Map(ranking.map((d, i) => [d.chave, i + 1]));
  const dimensoes = ordem === "resultado" ? ranking : r.dimensoes;
  const leitura = leituraDasDimensoes(r, textoDe);
  const melhores = emOrdem(r.afirmacoes, false).slice(0, 3);
  const piores = emOrdem(r.afirmacoes, true).slice(0, 3);
  const doFiltro = r.afirmacoes.filter(
    (a) => filtro === "todas" || a.dimensao === filtro,
  );
  const lista = menorPrimeiro ? emOrdem(doFiltro, true) : doFiltro;
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const daPagina = lista.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  const abertas = todas
    .filter((p) => p.chave?.startsWith(PREFIXO_DAS_ABERTAS))
    .map((p) => {
      const x = geral.perguntas.find((g) => g.perguntaId === p.id);
      return {
        id: p.id,
        titulo: textoParaOPainel(p.texto),
        textos: x && "textos" in x ? x.textos : [],
      };
    });
  const verTodas = () => {
    setFiltro("todas");
    setPagina(1);
    const h = tituloDasAfirmacoes.current;
    h?.scrollIntoView?.({ block: "start" });
    h?.focus();
  };
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
        <div className="clima-topo__coluna">
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
          {leitura ? (
            <div className="clima-caixas">
              <div className="clima-caixa" data-tom="bom">
                <span className="modelo-cartao__titulo">Puxa para cima</span>
                {leitura.todasEmpatadas ? (
                  <p>{`Nenhuma dimensão se destaca: todas têm ${leitura.menor}% favorável.`}</p>
                ) : (
                  <>
                    <p>
                      <strong>{leitura.maiores}</strong>
                      {` · ${leitura.maior}% favorável`}
                    </p>
                    <p className="pesquisas__suave">{leitura.sobreAsMaiores}</p>
                  </>
                )}
              </div>
              <div className="clima-caixa" data-tom="atencao">
                <span className="modelo-cartao__titulo">Pede atenção</span>
                <p>
                  <strong>{leitura.menores}</strong>
                  {` · ${leitura.menor}% favorável${leitura.menor < 65 ? " · abaixo da faixa Boa" : ""}`}
                </p>
                <p className="pesquisas__suave">{leitura.sobreAsMenores}</p>
                {leitura.maisBaixa ? (
                  <p className="pesquisas__suave">{`Afirmação mais baixa: “${leitura.maisBaixa.texto}” (${leitura.maisBaixa.favoravel}%)`}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>

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
          <div>
            <button type="button" className="modelos__link" onClick={verTodas}>
              Ver todas as afirmações
            </button>
          </div>
        </section>
      ) : null}

      <section className="modelo-cartao" aria-labelledby="clima-afirmacoes">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="clima-afirmacoes" ref={tituloDasAfirmacoes} tabIndex={-1}>
              Resultado por afirmação
            </h2>
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

      <RespostasAbertas
        blocos={abertas}
        identificada={detalhe.identificacao === "identificada"}
        onVerTemas={onIrParaAnalises}
      />
    </div>
  );
}
