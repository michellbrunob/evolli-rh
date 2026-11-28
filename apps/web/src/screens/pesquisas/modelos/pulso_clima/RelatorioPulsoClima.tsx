/**
 * T216 — Pulso e Clima: o relatório imprimível (PDF pelo navegador), no
 * padrão do módulo. Capa (score geral, eNPS e LNPS), ficha técnica e
 * sumário, 01 resumo e resultado por dimensão, 02 eNPS e LNPS, 03 detalhe
 * por afirmação, 04 pontos fortes, de atenção e alertas, 05 comentários e
 * a metodologia. Score de 0 a 100 e faixas do modelo (nunca a média 0–10).
 */
import type {
  RecomendacaoDoModelo,
  ResultadoPulsoClima,
} from "../../../../api/pesquisasClient";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import { formatarDiaCivil } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { Pagina, RodapeDaCapa, Secao } from "../../RelatorioImprimivel";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DA_RECOMENDACAO,
  comSinal,
  pct,
} from "../resultadoComum";
import { alertaDaAfirmacao, zonaDaMedia } from "./exportarPulsoClima";
import { mesPorExtenso } from "./ComentariosPulsoClima";

const umaCasa = (n: number | null) =>
  n === null ? "—" : n.toFixed(1).replace(".", ",");
const porcento = (n: number | null) => (n === null ? "—" : `${n}%`);

function TabelaDaRecomendacao({
  titulo,
  enunciado,
  r,
}: {
  readonly titulo: string;
  readonly enunciado: string;
  readonly r: RecomendacaoDoModelo;
}) {
  const parte = (q: number) =>
    r.respostas ? `${q} · ${pct(q, r.respostas)}%` : "—";
  return (
    <>
      <h3>{titulo}</h3>
      {enunciado ? (
        <p className="relatorio__rotulo">{`“${enunciado}”`}</p>
      ) : null}
      <table className="relatorio__tabela" aria-label={titulo}>
        <tbody>
          <tr>
            <th>Índice (−100 a 100)</th>
            <td>
              {r.indice === null
                ? "Ainda sem notas"
                : `${comSinal(r.indice)} · ${r.faixa ? ROTULO_DA_RECOMENDACAO[r.faixa] : ""}`}
            </td>
          </tr>
          <tr>
            <th>Promotores (9 e 10)</th>
            <td>{parte(r.promotores)}</td>
          </tr>
          <tr>
            <th>Neutros (7 e 8)</th>
            <td>{parte(r.neutros)}</td>
          </tr>
          <tr>
            <th>Detratores (0 a 6)</th>
            <td>{parte(r.detratores)}</td>
          </tr>
          <tr>
            <th>Notas de 0 a 10</th>
            <td>
              {r.distribuicao
                .map((d) => `${d.valor}: ${d.quantidade}`)
                .join(" · ")}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

export function DocumentoPulsoClima({
  carregado,
  r,
}: {
  readonly carregado: RelatorioCarregado;
  readonly r: ResultadoPulsoClima | null;
}) {
  const { detalhe, empresa, rel } = carregado;
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const total = 8;
  const cabecalho = {
    esquerda: "Pulso e Clima · Relatório de resultados",
    direita: `Gerado em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento interno · uso do RH",
    numero,
    total,
  });
  const todas = perguntasEmOrdem(detalhe.secoes);
  const textoDe = (id: string | null) =>
    textoParaOPainel(todas.find((p) => p.id === id)?.texto ?? "");
  const ordenadas = r
    ? [...r.dimensoes]
        .filter((d) => d.score !== null)
        .sort((a, b) => a.score! - b.score!)
    : [];
  const critica = ordenadas[0] ?? null;
  const forte = ordenadas.at(-1) ?? null;
  const comMedia = r ? r.afirmacoes.filter((a) => a.media !== null) : [];
  const fortes = [...comMedia].sort((a, b) => b.media! - a.media!).slice(0, 5);
  const atencao = [...comMedia]
    .sort(
      (a, b) =>
        (b.desfavoravel ?? 0) - (a.desfavoravel ?? 0) || a.media! - b.media!,
    )
    .slice(0, 5);
  const alertas = r
    ? r.afirmacoes.flatMap((a, i) => {
        const nivel = alertaDaAfirmacao(a);
        return nivel ? [{ a, i, nivel }] : [];
      })
    : [];
  const rotuloDe = (chave: string) =>
    r?.dimensoes.find((d) => d.chave === chave)?.rotulo ??
    (chave === "lnps"
      ? "LNPS · liderança direta"
      : chave === "enps"
        ? "eNPS · empresa"
        : chave);
  const ocultos = (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );
  const sumario = [
    ["01", "Resumo e resultado por dimensão", 3],
    ["02", "eNPS e LNPS", 4],
    ["03", "Detalhe por afirmação", 5],
    ["04", "Pontos fortes, de atenção e alertas", 6],
    ["05", "Comentários", 7],
    ["—", "Metodologia", 8],
  ] as const;

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            Clima organizacional
          </span>
        </div>
        <p className="relatorio__sobretitulo">{`PULSO E CLIMA · ${(mesPorExtenso(rel.emitidoEm.slice(0, 7)) || "").toUpperCase()}`}</p>
        <h1 className="relatorio__capa-titulo">{rel.nome}</h1>
        <p className="relatorio__capa-subtitulo">
          O clima em 8 dimensões, com a recomendação da empresa (eNPS) e da
          liderança direta (LNPS).
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Score geral</p>
            <strong className="relatorio__numero">{r?.score ?? "—"}</strong>
            <span>
              {r?.faixa ? `de 100 · ${ROTULO_DA_FAIXA[r.faixa]}` : "de 100"}
            </span>
          </div>
          {(
            [
              ["eNPS · empresa", r?.enps ?? null],
              ["LNPS · liderança direta", r?.lnps ?? null],
            ] as const
          ).map(([titulo, x]) => (
            <div key={titulo} className="relatorio__cartao">
              <p className="relatorio__cartao-titulo">{titulo}</p>
              <strong className="relatorio__numero">
                {x?.indice === null || x === null ? "—" : comSinal(x.indice)}
              </strong>
              <span>
                {x?.faixa ? ROTULO_DA_RECOMENDACAO[x.faixa] : "Sem notas"}
              </span>
            </div>
          ))}
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Aplicação", rel.periodo],
            ["Instrumento", "Pulso e Clima"],
            ["Gerado em", emitido],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h1 className="relatorio__sumario-titulo">Ficha técnica</h1>
        <table className="relatorio__tabela">
          <tbody>
            <tr>
              <th>Empresa</th>
              <td>{empresa || "—"}</td>
            </tr>
            <tr>
              <th>Instrumento</th>
              <td>
                Pulso e Clima · 22 afirmações de 1 a 5 em 8 dimensões, eNPS e
                LNPS de 0 a 10
              </td>
            </tr>
            <tr>
              <th>Período</th>
              <td>{rel.periodo}</td>
            </tr>
            <tr>
              <th>Participação</th>
              <td>
                {rel.convidados === null
                  ? `${plural(rel.respostas, "resposta", "respostas")} · link aberto`
                  : `${rel.respostas} de ${plural(rel.convidados, "pessoa", "pessoas")}${rel.participacao !== null ? ` · ${rel.participacao}%` : ""}`}
              </td>
            </tr>
            <tr>
              <th>Identificação</th>
              <td>{ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]}</td>
            </tr>
            <tr>
              <th>Proteção dos dados</th>
              <td>{`Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não mostram números.`}</td>
            </tr>
          </tbody>
        </table>
        <h2 className="relatorio__sumario-titulo">Sumário</h2>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {sumario.map(([n, t, p]) => (
            <li key={t}>
              <span className="relatorio__sumario-numero">{n}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
              </span>
              <span className="relatorio__sumario-pagina">{p}</span>
            </li>
          ))}
        </ol>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <Secao numero="01" titulo="Resumo e resultado por dimensão">
          {r ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>Score geral</span>
                  <strong>{r.score ?? "—"}</strong>
                  <span>
                    {r.faixa
                      ? `de 100 · ${ROTULO_DA_FAIXA[r.faixa]}`
                      : "de 100"}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Favoráveis</span>
                  <strong>{porcento(r.favoravel)}</strong>
                  <span>{`${porcento(r.desfavoravel)} desfavoráveis`}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Dimensão mais crítica</span>
                  <strong>{critica?.score ?? "—"}</strong>
                  <span>{critica?.rotulo ?? "—"}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Dimensão mais forte</span>
                  <strong>{forte?.score ?? "—"}</strong>
                  <span>{forte?.rotulo ?? "—"}</span>
                </div>
              </div>
              <table
                className="relatorio__tabela"
                aria-label="Resultado por dimensão"
              >
                <thead>
                  <tr>
                    <th>Dimensão</th>
                    <th>Score</th>
                    <th>Faixa</th>
                    <th>Favorável</th>
                    <th>Neutro</th>
                    <th>Desfavorável</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((d) => (
                    <tr key={d.chave}>
                      <td>{d.rotulo}</td>
                      <td>{d.score}</td>
                      <td>{d.faixa ? ROTULO_DA_FAIXA[d.faixa] : "—"}</td>
                      <td>{porcento(d.favoravel)}</td>
                      <td>{porcento(d.neutro)}</td>
                      <td>{porcento(d.desfavoravel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="relatorio__rotulo">
                Da dimensão mais baixa para a mais alta. Score de 0 a 100.
              </p>
            </>
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        <Secao numero="02" titulo="eNPS e LNPS">
          {r ? (
            <>
              <TabelaDaRecomendacao
                titulo="eNPS · empresa"
                enunciado={textoDe(r.enps.perguntaId)}
                r={r.enps}
              />
              <TabelaDaRecomendacao
                titulo="LNPS · liderança direta"
                enunciado={textoDe(r.lnps.perguntaId)}
                r={r.lnps}
              />
            </>
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        <Secao numero="03" titulo="Detalhe por afirmação">
          {r ? (
            <table
              className="relatorio__tabela"
              aria-label="Detalhe por afirmação"
            >
              <thead>
                <tr>
                  <th>Afirmação</th>
                  <th>Média</th>
                  <th>Score</th>
                  <th>Favorável</th>
                  <th>Desfavorável</th>
                  <th>Zona</th>
                </tr>
              </thead>
              <tbody>
                {r.dimensoes.flatMap((d) => [
                  <tr key={d.chave}>
                    <th colSpan={6}>{`${d.rotulo} · ${d.score ?? "—"}/100`}</th>
                  </tr>,
                  ...r.afirmacoes
                    .filter((a) => a.dimensao === d.chave)
                    .map((a) => (
                      <tr key={a.chave}>
                        <td>{textoDe(a.perguntaId)}</td>
                        <td>{umaCasa(a.media)}</td>
                        <td>{a.score ?? "—"}</td>
                        <td>{porcento(a.favoravel)}</td>
                        <td>{porcento(a.desfavoravel)}</td>
                        <td>{zonaDaMedia(a.media)}</td>
                      </tr>
                    )),
                ])}
              </tbody>
            </table>
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(6)}>
        <Secao numero="04" titulo="Pontos fortes, de atenção e alertas">
          {r ? (
            <>
              <h3>Os 5 pontos mais fortes</h3>
              <ol aria-label="Pontos mais fortes">
                {fortes.map((a) => (
                  <li key={a.chave}>
                    {`${textoDe(a.perguntaId)} · média ${umaCasa(a.media)} · ${porcento(a.favoravel)} favorável`}
                  </li>
                ))}
              </ol>
              <h3>Os 5 pontos que mais pedem atenção</h3>
              <ol aria-label="Pontos de atenção">
                {atencao.map((a) => (
                  <li key={a.chave}>
                    {`${textoDe(a.perguntaId)} · média ${umaCasa(a.media)} · ${porcento(a.desfavoravel)} desfavorável`}
                  </li>
                ))}
              </ol>
              <h3>Alertas</h3>
              {alertas.length === 0 ? (
                <p>Nenhuma afirmação nas regras de alerta.</p>
              ) : (
                <table className="relatorio__tabela" aria-label="Alertas">
                  <thead>
                    <tr>
                      <th>Severidade</th>
                      <th>Afirmação</th>
                      <th>Média</th>
                      <th>Desfavorável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(({ a, nivel }) => (
                      <tr key={a.chave}>
                        <td>{nivel === "alto" ? "Alto" : "Atenção"}</td>
                        <td>{textoDe(a.perguntaId)}</td>
                        <td>{umaCasa(a.media)}</td>
                        <td>{porcento(a.desfavoravel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(7)}>
        <Secao numero="05" titulo="Comentários">
          {r ? (
            r.comentarios.every((c) => (c.textos ?? []).length === 0) ? (
              <p>Nenhum comentário escrito.</p>
            ) : (
              r.comentarios
                .filter((c) => (c.textos ?? []).length > 0)
                .map((c) => (
                  <section key={c.dimensao} aria-label={rotuloDe(c.dimensao)}>
                    <h3>{`${rotuloDe(c.dimensao)} · ${plural(c.quantidade, "comentário", "comentários")}`}</h3>
                    <ul>
                      {(c.textos ?? []).map((t, i) => (
                        <li key={i}>{`“${t.texto}”`}</li>
                      ))}
                    </ul>
                  </section>
                ))
            )
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(8)}>
        <h2 className="relatorio__sumario-titulo">Metodologia</h2>
        <dl className="relatorio__metodologia">
          <dt>Score de 0 a 100</dt>
          <dd>
            A média de 1 a 5 de cada afirmação vira score por (média − 1) ÷ 4 ×
            100. A dimensão é a média das afirmações dela; o geral, a média das
            22.
          </dd>
          <dt>Faixas do score</dt>
          <dd>
            Abaixo de 50 crítico · 50 a 69 atenção · 70 a 84 saudável · 85 ou
            mais forte.
          </dd>
          <dt>eNPS e LNPS</dt>
          <dd>
            % de notas 9 e 10 menos % de notas de 0 a 6, de −100 a 100. Abaixo
            de 0 crítico · 0 a 29 em ajuste · 30 a 69 bom · 70 ou mais
            excelente.
          </dd>
          <dt>Favorável e alertas</dt>
          <dd>
            Notas 4 e 5 favoráveis, 3 neutra, 1 e 2 desfavoráveis. Alerta com
            30% ou mais de desfavoráveis ou média abaixo de 3; alto com 50% ou
            mais ou média abaixo de 2,5.
          </dd>
          <dt>Proteção dos dados</dt>
          <dd>{`Os comentários aparecem sem nome. Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não mostram números.`}</dd>
        </dl>
      </Pagina>
    </div>
  );
}
