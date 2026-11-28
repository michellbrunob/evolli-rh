/**
 * T216 — Motivação (TAD): o relatório imprimível (PDF pelo navegador), no
 * padrão do módulo. Capa (score geral e os 3 pilares), 01 resultado do time
 * (pilares, mapa das necessidades e pessoas por nível), 02 afirmações (a
 * média marcada e a pontuada, com as invertidas em `8 − média`) e a
 * metodologia. Escala de 1 a 7 (nunca a média 0–10).
 */
import type { ResultadoTad } from "../../../../api/pesquisasClient";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import { formatarDiaCivil } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { Pagina, RodapeDaCapa, Secao } from "../../RelatorioImprimivel";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { ROTULO_DO_NIVEL, Radar, duasCasas } from "../resultadoComum";
import { ITENS_TAD, PILARES_TAD } from "./catalogo";
import { mediaPontuada } from "./exportarTad";
import { FRASE_DO_NIVEL } from "./ResultadoTad";

const duas = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : duasCasas(n);

export function DocumentoTad({
  carregado,
  r,
}: {
  readonly carregado: RelatorioCarregado;
  readonly r: ResultadoTad | null;
}) {
  const { detalhe, empresa, rel, geral } = carregado;
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const total = 4;
  const cabecalho = {
    esquerda: "Motivação (TAD) · Relatório de resultados",
    direita: `Gerado em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento interno · uso do RH",
    numero,
    total,
  });
  const porChave = new Map(
    perguntasEmOrdem(detalhe.secoes).flatMap((p) =>
      p.chave ? [[p.chave, p] as const] : [],
    ),
  );
  const porId = new Map(geral.perguntas.map((p) => [p.perguntaId, p]));
  const ocultos = (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            Motivação (TAD)
          </span>
        </div>
        <p className="relatorio__sobretitulo">
          AUTONOMIA · COMPETÊNCIA · RELACIONAMENTO
        </p>
        <h1 className="relatorio__capa-titulo">{rel.nome}</h1>
        <p className="relatorio__capa-subtitulo">
          Quanto as 3 necessidades que sustentam a motivação estão satisfeitas
          no time, de 1 a 7.
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Score geral</p>
            <strong className="relatorio__numero">{duas(r?.geral)}</strong>
            <span>
              {r?.nivel ? `de 7 · ${ROTULO_DO_NIVEL[r.nivel]}` : "de 7"}
            </span>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Os 3 pilares</p>
            <ul className="relatorio__destaques">
              {(r?.pilares ?? []).map((p) => (
                <li key={p.chave}>
                  <span>{p.rotulo}</span>
                  <strong>{duas(p.score)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">{`${plural(rel.respostas, "resposta", "respostas")} · ${ROTULO_DA_IDENTIFICACAO[detalhe.identificacao].toLowerCase()}`}</p>
            <span>
              {rel.participacao !== null
                ? `Participação de ${rel.participacao}%`
                : "Link aberto"}
            </span>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Aplicação", rel.periodo],
            ["Instrumento", "Motivação (TAD)"],
            ["Gerado em", emitido],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <Secao numero="01" titulo="Resultado do time">
          {r ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>Score geral</span>
                  <strong>{duas(r.geral)}</strong>
                  <span>
                    {r.nivel
                      ? `${ROTULO_DO_NIVEL[r.nivel]} · ${FRASE_DO_NIVEL[r.nivel]}`
                      : "—"}
                  </span>
                </div>
                {(["alto", "moderado", "baixo"] as const).map((n) => (
                  <div key={n} className="relatorio__indicador">
                    <span>{ROTULO_DO_NIVEL[n]}</span>
                    <strong>{r.niveis[n]}</strong>
                    <span>{r.niveis[n] === 1 ? "pessoa" : "pessoas"}</span>
                  </div>
                ))}
              </div>
              <table className="relatorio__tabela" aria-label="Os 3 pilares">
                <thead>
                  <tr>
                    <th>Pilar</th>
                    <th>Score (1 a 7)</th>
                    <th>Nível</th>
                    <th>O que mede</th>
                  </tr>
                </thead>
                <tbody>
                  {r.pilares.map((p) => (
                    <tr key={p.chave}>
                      <td>{`${p.rotulo} (${plural(p.perguntas, "afirmação", "afirmações")})`}</td>
                      <td>{duas(p.score)}</td>
                      <td>{p.nivel ? ROTULO_DO_NIVEL[p.nivel] : "—"}</td>
                      <td>
                        {PILARES_TAD.find((x) => x.chave === p.chave)?.texto}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Mapa das necessidades</h3>
              <Radar
                rotulo="Mapa das necessidades, de 0 a 7"
                maximo={7}
                eixos={r.pilares.map((p) => ({
                  rotulo: `${p.rotulo} (${duas(p.score)})`,
                  valor: p.score ?? 0,
                }))}
              />
            </>
          ) : (
            ocultos
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <Secao numero="02" titulo="Afirmações">
          {r ? (
            <table className="relatorio__tabela" aria-label="Afirmações">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Afirmação</th>
                  <th>Pilar</th>
                  <th>Média marcada</th>
                  <th>Média pontuada</th>
                </tr>
              </thead>
              <tbody>
                {ITENS_TAD.flatMap((i, n) => {
                  const p = porChave.get(i.chave);
                  if (!p) return [];
                  const res = porId.get(p.id);
                  const m =
                    res && "media" in res && typeof res.media === "number"
                      ? res.media
                      : null;
                  return [
                    <tr key={i.chave}>
                      <td>{n + 1}</td>
                      <td>{`${p.texto}${i.invertido ? " (invertida)" : ""}`}</td>
                      <td>
                        {PILARES_TAD.find((x) => x.chave === i.pilar)?.rotulo}
                      </td>
                      <td>{duas(m)}</td>
                      <td>{duas(mediaPontuada(m, i.invertido))}</td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          ) : (
            ocultos
          )}
          <p className="relatorio__rotulo">
            Nas afirmações invertidas, a média pontuada é 8 menos a média
            marcada.
          </p>
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        <h2 className="relatorio__sumario-titulo">Metodologia</h2>
        <dl className="relatorio__metodologia">
          <dt>Escala</dt>
          <dd>
            21 afirmações de 1 (nada verdadeiro) a 7 (totalmente verdadeiro):
            autonomia 7, competência 6 e relacionamento 8.
          </dd>
          <dt>Invertidas</dt>
          <dd>9 afirmações contam como 8 menos a resposta.</dd>
          <dt>Pilar, geral e time</dt>
          <dd>
            O pilar é a média das afirmações dele; o geral, a média dos 3
            pilares; o time, a média dos scores de cada pessoa.
          </dd>
          <dt>Níveis</dt>
          <dd>
            Alto de 5,5 a 7,0 · moderado de 3,5 a 5,4 · baixo de 1,0 a 3,4.
          </dd>
          <dt>Proteção dos dados</dt>
          <dd>{`Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não mostram números.`}</dd>
        </dl>
      </Pagina>
    </div>
  );
}
