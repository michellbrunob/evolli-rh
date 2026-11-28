/**
 * T216 — o relatório imprimível (PDF pelo navegador) da Pesquisa de Clima,
 * no padrão dos relatórios dos modelos (`modelos/relatorio.tsx`): capa com
 * o índice do time, as dimensões e os destaques; sumário, sobre a pesquisa
 * e como ler; 01 resumo executivo e conclusões; 02 dimensões; 03 destaques
 * (as 5 afirmações mais e menos favoráveis); 04 resultado por departamento
 * (grupos pequenos ocultos); 05 resultado por afirmação (por dimensão, com
 * as afirmações por faixa); 06 comentários e 07 metodologia.
 */
import type { ResultadoClima } from "../../../../api/pesquisasClient";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import { formatarDiaCivil } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import {
  Impressao,
  Pagina,
  RodapeDaCapa,
  Secao,
} from "../../RelatorioImprimivel";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { BarraFavoravel } from "../resultadoComum";
import { recortesDoClima, useGruposDoClima } from "./AnalisesClima";
import { DIMENSOES_CLIMA, PREFIXO_DAS_ABERTAS } from "./catalogo";
import {
  FAIXAS_CLIMA,
  ROTULO_DA_FAIXA_CLIMA,
  TEXTO_DAS_FAIXAS_CLIMA,
  faixaDoClima,
} from "./faixas";
import {
  MedidorDoIndice,
  SeloDaFaixaClima,
  corDaDimensao,
  textosDaAberta,
} from "./pecas";
import { rankingDoClima } from "./planilhaClima";
import "./Clima.css";

const TOTAL_DE_PAGINAS = 8;

type Afirmacao = ResultadoClima["afirmacoes"][number];

/** As afirmações com resposta, das mais para as menos favoráveis. */
function ordenadas(
  afirmacoes: readonly Afirmacao[],
  menorPrimeiro = false,
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

/** As conclusões automáticas do resumo (a faixa, o ponto forte e o frágil). */
export function conclusoesDoClima(r: ResultadoClima): string[] {
  const ranking = rankingDoClima(r);
  if (r.favoravel === null || !r.faixa || ranking.length === 0) return [];
  const saida = [
    `O índice do time é ${r.favoravel}%, na faixa ${ROTULO_DA_FAIXA_CLIMA[r.faixa]}.`,
  ];
  const forte = ranking[0]!;
  saida.push(
    `${forte.rotulo} (${forte.favoravel}%) é a dimensão mais favorável.`,
  );
  const menor = ranking.at(-1)!.favoravel;
  const frageis = ranking.filter((d) => d.favoravel === menor && d !== forte);
  if (frageis.length > 0)
    saida.push(
      `${frageis.map((d) => `${d.rotulo} (${d.favoravel}%)`).join(" e ")} ${frageis.length > 1 ? "pedem" : "pede"} mais atenção.`,
    );
  return saida;
}

export function RelatorioClima({
  carregado,
  servico,
  imprimir,
}: {
  readonly carregado: RelatorioCarregado;
  readonly servico: ServicoDePesquisas;
  readonly imprimir: boolean;
}) {
  const titulo = nomeDoArquivo(
    [carregado.detalhe.nome, "relatorio"],
    "pdf",
  ).replace(/\.pdf$/, "");
  return (
    <Impressao titulo={titulo} imprimir={imprimir}>
      <DocumentoClima carregado={carregado} servico={servico} />
    </Impressao>
  );
}

export function DocumentoClima({
  carregado,
  servico,
}: {
  readonly carregado: RelatorioCarregado;
  readonly servico: ServicoDePesquisas;
}) {
  const { detalhe, empresa, rel, geral } = carregado;
  const r =
    !rel.numerosOcultos && geral.modelo?.modelo === "clima"
      ? geral.modelo
      : null;
  const recortes = recortesDoClima(geral);
  const campo = recortes.includes("departamento")
    ? "departamento"
    : (recortes[0] ?? null);
  const grupos = useGruposDoClima(servico, detalhe, geral, r ? campo : null);
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const cabecalho = {
    esquerda: "Pesquisa de Clima · Relatório de resultados",
    direita: `${rel.mesDeReferencia} · Emitido em ${emitido}`,
  };
  const anonima = detalhe.identificacao !== "identificada";
  const rodape = (numero: number) => ({
    texto: `Documento confidencial${anonima ? " · respostas sem identificação" : " · RH"}`,
    numero,
    total: TOTAL_DE_PAGINAS,
  });
  const todas = detalhe.secoes.flatMap((s) => s.perguntas);
  const textoDe = new Map(todas.map((p) => [p.id, textoParaOPainel(p.texto)]));
  const abertas = todas.filter((p) => p.chave?.startsWith(PREFIXO_DAS_ABERTAS));
  const ranking = r ? rankingDoClima(r) : [];
  const totalDeNotas = r
    ? r.notas.favoraveis + r.notas.neutras + r.notas.desfavoraveis
    : 0;
  const sumario = [
    [
      "01",
      "Resumo executivo",
      "Índice do time, participação e conclusões",
      "3",
    ],
    ["02", "Dimensões", "O resultado das 5 dimensões", "3"],
    ["03", "Destaques", "As afirmações mais e menos favoráveis", "4"],
    ["04", "Resultado por departamento", "O índice de cada grupo", "4"],
    ["05", "Resultado por afirmação", "O % favorável de cada afirmação", "5–7"],
    ["06", "Comentários", "As respostas às perguntas abertas", "8"],
    ["07", "Metodologia", "Como o índice é calculado", "8"],
  ] as const;
  const porDimensao = DIMENSOES_CLIMA.map((d) => ({
    d,
    resumo: r?.dimensoes.find((x) => x.chave === d.chave) ?? null,
    afirmacoes: r
      ? ordenadas(r.afirmacoes.filter((a) => a.dimensao === d.chave))
      : [],
  }));
  // Da melhor para a pior faixa.
  const porFaixa = [...FAIXAS_CLIMA].reverse().map((f) => ({
    ...f,
    quantidade: r
      ? r.afirmacoes.filter(
          (a) => a.favoravel !== null && faixaDoClima(a.favoravel) === f.faixa,
        ).length
      : 0,
  }));
  const numeroDe = new Map(
    (r?.afirmacoes ?? []).map((a, i) => [
      a.chave,
      String(i + 1).padStart(2, "0"),
    ]),
  );
  const ocultos = (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );

  const blocoDaDimensao = (x: (typeof porDimensao)[number]) => (
    <div key={x.d.chave} className="relatorio__quadro">
      <h3>
        <span
          className="modelo-bolinha"
          style={{ background: corDaDimensao(x.d.chave) }}
          aria-hidden="true"
        />{" "}
        {x.d.rotulo}{" "}
        {x.resumo && x.resumo.favoravel !== null ? (
          <span className="pesquisas__suave">{`${x.resumo.favoravel}% · ${x.resumo.faixa ? ROTULO_DA_FAIXA_CLIMA[x.resumo.faixa] : ""}`}</span>
        ) : null}
        <span className="pesquisas__suave">{` · ${plural(x.afirmacoes.length, "afirmação", "afirmações")}`}</span>
      </h3>
      <table className="relatorio__tabela">
        <tbody>
          {x.afirmacoes.map((a) => (
            <tr
              key={a.chave}
              {...(a.favoravel !== null && a.favoravel < 50
                ? { "data-abaixo": "" }
                : {})}
            >
              <td>{numeroDe.get(a.chave)}</td>
              <th scope="row">{textoDe.get(a.perguntaId) ?? a.chave}</th>
              <td>
                <BarraFavoravel
                  favoravel={a.favoravel ?? 0}
                  neutro={a.neutro ?? 0}
                  desfavoravel={a.desfavoravel ?? 0}
                  rotulo={textoDe.get(a.perguntaId) ?? a.chave}
                />
              </td>
              <td>{`${a.favoravel}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            {rel.mesDeReferencia}
          </span>
        </div>
        <p className="relatorio__sobretitulo">Relatório de resultados</p>
        <h1 className="relatorio__capa-titulo">Pesquisa de Clima</h1>
        <p className="relatorio__capa-subtitulo">{`${empresa || "Empresa"} · ${rel.periodo}`}</p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao relatorio__cartao--medidor">
            <p className="relatorio__cartao-titulo">
              Índice do time
              <span>{plural(rel.respostas, "resposta", "respostas")}</span>
            </p>
            <MedidorDoIndice
              valor={r?.favoravel ?? null}
              faixa={r?.faixa ?? null}
              rotulo="Índice do time"
            />
            {r ? (
              <SeloDaFaixaClima faixa={r.faixa} />
            ) : (
              <span>Números ocultos</span>
            )}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Dimensões<span>% favorável</span>
            </p>
            <ul className="relatorio__destaques" aria-label="Dimensões na capa">
              {ranking.map((d) => (
                <li key={d.chave}>
                  <span>{d.rotulo}</span>
                  <strong>{`${d.favoravel}%`}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Destaques</p>
            {r && ranking.length > 0 ? (
              <ul className="relatorio__destaques">
                <li>
                  <span>{`Ponto mais forte: ${ranking[0]!.rotulo}`}</span>
                  <strong>{`${ranking[0]!.favoravel}%`}</strong>
                </li>
                <li>
                  <span>{`Pede atenção: ${ranking.at(-1)!.rotulo}`}</span>
                  <strong>{`${ranking.at(-1)!.favoravel}%`}</strong>
                </li>
                <li>
                  <span>{`Respostas favoráveis: ${r.notas.favoraveis} de ${totalDeNotas}`}</span>
                  <strong>{`${r.favoravel}%`}</strong>
                </li>
              </ul>
            ) : null}
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Período", rel.periodo],
            ["Emitido em", emitido],
            ["Classificação", "Confidencial · RH"],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h2 className="relatorio__sumario-titulo">Sumário</h2>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {sumario.map(([n, t, texto, p]) => (
            <li key={n}>
              <span className="relatorio__sumario-numero">{n}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
                <span>{texto}</span>
              </span>
              <span className="relatorio__sumario-pagina">{p}</span>
            </li>
          ))}
        </ol>
        <div className="relatorio__quadro">
          <h3>Sobre esta pesquisa</h3>
          <dl className="relatorio__indicadores">
            <div className="relatorio__indicador">
              <dt>Modelo</dt>
              <dd>Pesquisa de Clima (5 dimensões)</dd>
            </div>
            <div className="relatorio__indicador">
              <dt>Perguntas</dt>
              <dd>{`${plural(todas.filter((p) => p.tipo === "concordancia").length, "afirmação", "afirmações")} + ${plural(abertas.length, "aberta", "abertas")}`}</dd>
            </div>
            <div className="relatorio__indicador">
              <dt>Escala</dt>
              <dd>1 a 5 (concordância)</dd>
            </div>
            <div className="relatorio__indicador">
              <dt>Respostas</dt>
              <dd>{`${rel.respostas} · ${rel.convidados === null ? "link aberto" : ROTULO_DA_IDENTIFICACAO[rel.identificacao]}`}</dd>
            </div>
          </dl>
        </div>
        <div className="relatorio__quadro">
          <h3>Como ler este relatório</h3>
          <p>
            Cada afirmação é respondida de 1 (discordo totalmente) a 5 (concordo
            totalmente); 4 e 5 contam como favoráveis. O índice é o % de
            respostas favoráveis em todas as afirmações.
          </p>
          <ul className="relatorio__faixas" aria-label="Faixas do índice">
            {FAIXAS_CLIMA.map((f) => (
              <li key={f.faixa}>
                <strong>{f.rotulo}</strong>
                <span>{f.curto}</span>
              </li>
            ))}
          </ul>
        </div>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <h2 className="relatorio__titulo-interno">{detalhe.nome}</h2>
        <p className="pesquisas__suave">{`${empresa || "Empresa"} · ${plural(rel.respostas, "resposta", "respostas")}`}</p>
        <Secao numero="01" titulo="Resumo executivo">
          {r ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>Índice do time</span>
                  <strong>{`${r.favoravel ?? "—"}%`}</strong>
                  <span>
                    {r.faixa ? `Faixa ${ROTULO_DA_FAIXA_CLIMA[r.faixa]}` : ""}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Respostas</span>
                  <strong>{rel.respostas}</strong>
                  <span>
                    {rel.convidados === null
                      ? "link aberto"
                      : plural(rel.convidados, "convidado", "convidados")}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Respostas favoráveis</span>
                  <strong>{`${r.favoravel ?? "—"}%`}</strong>
                  <span>{`${r.neutro ?? 0}% neutras · ${r.desfavoravel ?? 0}% desfavoráveis`}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Afirmações</span>
                  <strong>{r.afirmacoes.length}</strong>
                  <span>5 dimensões</span>
                </div>
              </div>
              <div className="relatorio__quadro">
                <h3>Principais conclusões</h3>
                <ol aria-label="Principais conclusões">
                  {conclusoesDoClima(r).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            ocultos
          )}
        </Secao>
        {r ? (
          <Secao numero="02" titulo="Dimensões">
            <table className="relatorio__tabela" aria-label="Dimensões">
              <thead>
                <tr>
                  <th scope="col">Dimensão</th>
                  <th scope="col">Distribuição das respostas</th>
                  <th scope="col">Favorável</th>
                  <th scope="col">Faixa</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((d) => (
                  <tr key={d.chave}>
                    <th scope="row">{d.rotulo}</th>
                    <td>
                      <BarraFavoravel
                        favoravel={d.favoravel ?? 0}
                        neutro={d.neutro ?? 0}
                        desfavoravel={d.desfavoravel ?? 0}
                        rotulo={d.rotulo}
                      />
                    </td>
                    <td>{`${d.favoravel}%`}</td>
                    <td>
                      <SeloDaFaixaClima faixa={d.faixa} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        ) : null}
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        {r ? (
          <>
            <Secao numero="03" titulo="Destaques">
              <div className="clima-caixas">
                {(
                  [
                    ["Pontos fortes", ordenadas(r.afirmacoes).slice(0, 5)],
                    [
                      "Pontos de atenção",
                      ordenadas(r.afirmacoes, true).slice(0, 5),
                    ],
                  ] as const
                ).map(([t, lista]) => (
                  <div key={t} className="relatorio__quadro">
                    <h3>{t}</h3>
                    <ol aria-label={t}>
                      {lista.map((a) => (
                        <li key={a.chave}>
                          {`${textoDe.get(a.perguntaId) ?? a.chave} — ${a.favoravel}% · ${DIMENSOES_CLIMA.find((d) => d.chave === a.dimensao)?.rotulo ?? ""}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </Secao>
            <Secao numero="04" titulo="Resultado por departamento">
              <p className="pesquisas__suave">{`% favorável · grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} ficam ocultos`}</p>
              {!campo || (grupos !== null && grupos.length === 0) ? (
                <p className="relatorio__quadro">
                  Sem departamento informado para agrupar as respostas.
                </p>
              ) : grupos === null ? (
                <p className="pesquisas__suave">Carregando os grupos…</p>
              ) : (
                <table
                  className="relatorio__tabela"
                  aria-label="Resultado por departamento"
                >
                  <thead>
                    <tr>
                      <th scope="col">Grupo</th>
                      <th scope="col">Índice</th>
                      {DIMENSOES_CLIMA.map((d) => (
                        <th key={d.chave} scope="col">
                          {d.rotulo}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <tr key={g.id}>
                        <th scope="row">{g.nome}</th>
                        {g.resultado ? (
                          <>
                            <td>{`${g.resultado.favoravel ?? "—"}%`}</td>
                            {g.resultado.dimensoes.map((d) => (
                              <td key={d.chave}>
                                {d.favoravel === null ? "—" : `${d.favoravel}%`}
                              </td>
                            ))}
                          </>
                        ) : (
                          <td colSpan={1 + DIMENSOES_CLIMA.length}>Oculto</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Secao>
          </>
        ) : (
          ocultos
        )}
      </Pagina>

      {[
        porDimensao.slice(0, 2),
        porDimensao.slice(2, 4),
        porDimensao.slice(4),
      ].map((parte, i) => (
        <Pagina key={i} cabecalho={cabecalho} rodape={rodape(5 + i)}>
          <Secao numero="05" titulo="Resultado por afirmação">
            <p className="pesquisas__suave">{`Parte ${i + 1} de 3 · favorável (4 e 5), neutro (3) e desfavorável (1 e 2); abaixo de 50% em destaque`}</p>
            {r ? parte.map(blocoDaDimensao) : ocultos}
            {r && i === 2 ? (
              <div className="relatorio__quadro">
                <h3>{`As ${plural(r.afirmacoes.length, "afirmação", "afirmações")} por faixa`}</h3>
                <ul
                  className="relatorio__faixas"
                  aria-label="Afirmações por faixa"
                >
                  {porFaixa.map((f) => (
                    <li key={f.faixa}>
                      <strong>{f.quantidade}</strong>
                      <span>{f.rotulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Secao>
        </Pagina>
      ))}

      <Pagina cabecalho={cabecalho} rodape={rodape(8)}>
        <Secao numero="06" titulo="Comentários">
          <p className="pesquisas__suave">
            Respostas às perguntas abertas, sem identificação
          </p>
          {r
            ? abertas.map((p) => {
                const textos = textosDaAberta(geral, p.id);
                return (
                  <div key={p.id} className="relatorio__quadro">
                    <h3>{`${textoParaOPainel(p.texto)} · ${plural(textos.length, "resposta", "respostas")}`}</h3>
                    {textos.length === 0 ? (
                      <p>Nenhuma resposta escrita.</p>
                    ) : (
                      <ul className="relatorio__comentarios">
                        {textos.map((t, i) => (
                          <li key={i}>{`“${t}”`}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            : ocultos}
        </Secao>
        <Secao numero="07" titulo="Metodologia">
          <div className="relatorio__metodologia">
            <div className="relatorio__quadro">
              <h3>Modelo</h3>
              <p>
                Questionário próprio do Evolli em 5 dimensões — credibilidade,
                respeito, imparcialidade, orgulho e camaradagem — com afirmações
                respondidas de 1 a 5.
              </p>
            </div>
            <div className="relatorio__quadro">
              <h3>Cálculo</h3>
              <p>
                Favorável = notas 4 e 5. O resultado de cada afirmação e de cada
                dimensão é o % favorável; o índice do time considera todas as
                respostas às afirmações.
              </p>
            </div>
            <div className="relatorio__quadro">
              <h3>Privacidade</h3>
              <p>{`Recortes com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não aparecem. Os comentários saem sem nome.`}</p>
            </div>
          </div>
          <p className="pesquisas__suave">{TEXTO_DAS_FAIXAS_CLIMA}</p>
        </Secao>
      </Pagina>
    </div>
  );
}
