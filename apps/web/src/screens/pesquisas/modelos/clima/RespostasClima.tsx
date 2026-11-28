/**
 * T216 — as respostas da Pesquisa de Clima: a lista (aba Respostas) com o
 * índice de cada resposta (% favorável, com a faixa) e o departamento; e a
 * visão geral do resultado individual — o índice da resposta no medidor,
 * a diferença para o time em pontos percentuais, as notas favoráveis,
 * neutras e desfavoráveis, cada dimensão (resposta × time), onde a resposta
 * difere do time (mais positivo e mais negativo), a distribuição das notas
 * 1 a 5 e as abertas.
 */
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoIndividualClima,
  Secao,
} from "../../../../api/pesquisasClient";
import { formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { IconeAvancar } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { Avatar, iniciaisDe } from "../../componentes";
import { Rosca } from "../../graficos";
import { textoParaOPainel } from "../empresa";
import { DIMENSOES_CLIMA, PREFIXO_DAS_ABERTAS } from "./catalogo";
import {
  MedidorDoIndice,
  QuadroDasNotas,
  SeloDaFaixaClima,
  corDaDimensao,
} from "./pecas";

/** "27/11 · 11:23". */
const diaEHora = (iso: string) =>
  formatarInstante(iso).replace(/^(\d{2}\/\d{2})\/\d{4} às /, "$1 · ");

/** O departamento da resposta: identificada pela ficha; anônima pelo grupo. */
export function departamentoDaResposta(
  r: RespostaResumo,
  identificada: boolean,
): string {
  if (identificada) return r.departamento ?? "—";
  const g = r.grupos?.find((x) => x.campo === "departamento");
  if (g?.oculto) return "Oculto";
  return g?.grupo ?? "—";
}

/** "5 p.p. abaixo do time (47%)", "igual ao time (47%)". */
export function diferencaDoTime(indice: number, time: number): string {
  const d = indice - time;
  if (d === 0) return `igual ao time (${time}%)`;
  return `${plural(Math.abs(d), "p.p.", "p.p.")} ${d > 0 ? "acima" : "abaixo"} do time (${time}%)`;
}

export function ListaDeRespostasClima({
  detalhe,
  respostas,
  onAbrir,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onAbrir: (id: string) => void;
}) {
  const identificada = detalhe.identificacao === "identificada";
  if (!respostas)
    return <Esqueleto rotulo="Carregando respostas…" linhas={4} />;
  if (respostas.length === 0)
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Ninguém respondeu ainda.</strong>
      </div>
    );
  return (
    <>
      {identificada ? (
        <p className="pesquisas__suave">
          A consulta às respostas individuais fica registrada na auditoria.
        </p>
      ) : null}
      <div className="pesquisas__tabela-caixa">
        <table
          className="pesquisas__tabela pesquisas__tabela--clicavel"
          aria-label="Respostas"
        >
          <thead>
            <tr>
              <th scope="col">Resposta</th>
              <th scope="col">Departamento</th>
              <th scope="col">Índice da resposta</th>
              <th scope="col">Respondeu em</th>
              <th scope="col">
                <span className="pesquisas__so-leitor">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((r) => {
              const nome =
                identificada && r.nome
                  ? r.nome
                  : `Resposta anônima #${r.numero}`;
              const resumo =
                r.resumoDoModelo?.modelo === "clima" ? r.resumoDoModelo : null;
              return (
                <tr key={r.id} onClick={() => onAbrir(r.id)}>
                  <td>
                    <span className="pesquisas__pessoa-linha">
                      <Avatar
                        texto={
                          identificada && r.nome
                            ? iniciaisDe(r.nome)
                            : `R${r.numero}`
                        }
                      />
                      <span className="pesquisas__forte">{nome}</span>
                    </span>
                  </td>
                  <td>{departamentoDaResposta(r, identificada)}</td>
                  <td>
                    {resumo && resumo.indice !== null ? (
                      <span className="pesquisas__pessoa-linha">
                        <span className="clima-numero">{`${resumo.indice}%`}</span>
                        <SeloDaFaixaClima faixa={resumo.faixa} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pesquisas__data">
                    {diaEHora(r.respondidaEm)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
                      aria-label={`Ver resultado de ${nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(r.id);
                      }}
                    >
                      Ver resultado
                      <IconeAvancar tamanho={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pesquisas__tabela-rodape">
          <span>{plural(respostas.length, "resposta", "respostas")}</span>
          <span className="pesquisas__suave">
            Da mais recente para a mais antiga
          </span>
        </div>
      </div>
    </>
  );
}

type AfirmacaoDaResposta = ResultadoIndividualClima["afirmacoes"][number];

/**
 * Onde a resposta difere do time, comparando a nota (favorável 4 e 5,
 * neutra 3, desfavorável 1 e 2) com o % favorável do time na mesma
 * afirmação. Mais positivo: favorável aqui e menos da metade do time
 * favorável. Mais negativo: desfavorável aqui e metade ou mais do time
 * favorável. Neutra nunca entra. Da maior distância para a menor (empate
 * pela ordem da pesquisa).
 */
export function diferencasDoTime(
  p: ResultadoIndividualClima,
  quantas = 5,
): {
  readonly maisPositivas: AfirmacaoDaResposta[];
  readonly maisNegativas: AfirmacaoDaResposta[];
} {
  const comNota = p.afirmacoes
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a.nota !== null && x.a.favoravelTime !== null);
  const maisPositivas = comNota
    .filter((x) => x.a.nota! >= 4 && x.a.favoravelTime! < 50)
    .sort((x, y) => x.a.favoravelTime! - y.a.favoravelTime! || x.i - y.i)
    .slice(0, quantas)
    .map((x) => x.a);
  const maisNegativas = comNota
    .filter((x) => x.a.nota! <= 2 && x.a.favoravelTime! >= 50)
    .sort((x, y) => y.a.favoravelTime! - x.a.favoravelTime! || x.i - y.i)
    .slice(0, quantas)
    .map((x) => x.a);
  return { maisPositivas, maisNegativas };
}

/** "Favorável (nota 5)", "Neutra (nota 3)", "Desfavorável (nota 1)". */
const tomDaNota = (nota: number) =>
  `${nota >= 4 ? "Favorável" : nota === 3 ? "Neutra" : "Desfavorável"} (nota ${nota})`;

/** A visão geral do resultado individual do Clima. */
export function VisaoIndividualClima({
  resposta,
  p,
  secoes,
  onVerRespostas,
}: {
  readonly resposta: RespostaDetalhe;
  readonly p: ResultadoIndividualClima;
  readonly secoes: readonly Secao[];
  /** "Ver todas as respostas" (a aba Respostas do individual). */
  readonly onVerRespostas?: (() => void) | undefined;
}) {
  const todas = secoes.flatMap((s) => s.perguntas);
  const textoDe = new Map(todas.map((x) => [x.id, textoParaOPainel(x.texto)]));
  const valor = new Map(resposta.valores.map((v) => [v.perguntaId, v.valor]));
  const abertas = todas.filter((x) => x.chave?.startsWith(PREFIXO_DAS_ABERTAS));
  const { maisPositivas, maisNegativas } = diferencasDoTime(p);
  const totalDaPessoa = p.distribuicao.resposta.reduce((a, b) => a + b, 0);
  const pctDaPessoa = (n: number) =>
    totalDaPessoa > 0 ? Math.round((n / totalDaPessoa) * 100) : 0;
  const rotuloDe = (chave: string) =>
    DIMENSOES_CLIMA.find((d) => d.chave === chave)?.rotulo ?? chave;
  const time = p.time?.indice ?? null;

  return (
    <div className="modelo-resultado">
      <div className="clima-topo">
        <section
          className="modelo-cartao clima-indice"
          aria-labelledby="clima-indice-resposta"
        >
          <h2 id="clima-indice-resposta" className="modelo-cartao__titulo">
            Índice desta resposta
          </h2>
          <MedidorDoIndice
            valor={p.indice}
            faixa={p.faixa}
            rotulo="Índice desta resposta"
          />
          <SeloDaFaixaClima faixa={p.faixa} />
          {p.indice !== null && time !== null ? (
            <p
              className="clima-diferenca"
              data-sinal={
                p.indice > time ? "acima" : p.indice < time ? "abaixo" : "igual"
              }
            >
              {diferencaDoTime(p.indice, time)}
            </p>
          ) : null}
        </section>
        <div className="modelo-cartao">
          <QuadroDasNotas
            titulo="Esta resposta"
            favoraveis={p.favoraveis}
            neutras={p.neutras}
            desfavoraveis={p.desfavoraveis}
          />
        </div>
      </div>

      <section
        className="modelo-cartao"
        aria-labelledby="clima-dimensoes-resposta"
      >
        <h2 id="clima-dimensoes-resposta">Cada dimensão: resposta e time</h2>
        <ol className="clima-aneis" aria-label="Dimensões da resposta">
          {p.dimensoes.map((d) => (
            <li key={d.chave}>
              <Rosca
                fracao={(d.indice ?? 0) / 100}
                centro={d.indice === null ? "—" : `${d.indice}%`}
                cor={corDaDimensao(d.chave)}
                rotulo={`${d.rotulo}: ${d.indice === null ? "sem resposta" : `${d.indice}% favorável`}${d.time !== null ? `, time ${d.time}%` : ""}`}
              />
              <strong>{d.rotulo}</strong>
              {d.time !== null ? (
                <span className="pesquisas__suave">
                  {`Time ${d.time}%${d.indice !== null ? ` · ${d.indice - d.time > 0 ? "+" : d.indice - d.time < 0 ? "−" : ""}${Math.abs(d.indice - d.time)} p.p.` : ""}`}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="modelo-cartao" aria-labelledby="clima-difere">
        <div className="modelo-secao-cabeca">
          <h2 id="clima-difere">Onde esta resposta difere do time</h2>
          {onVerRespostas ? (
            <button
              type="button"
              className="modelos__link"
              onClick={onVerRespostas}
            >
              Ver todas as respostas
            </button>
          ) : null}
        </div>
        <p className="pesquisas__suave">
          A nota desta resposta comparada com o % favorável do time na mesma
          afirmação.
        </p>
        <div className="clima-caixas">
          <div>
            <h3 className="modelo-cartao__titulo">Mais positivo que o time</h3>
            {maisPositivas.length === 0 ? (
              <p className="pesquisas__suave">
                Nenhuma afirmação em que esta resposta fique acima do time.
              </p>
            ) : (
              <ol className="clima-lista" aria-label="Mais positivo que o time">
                {maisPositivas.map((a) => (
                  <li key={a.chave}>
                    <span className="clima-afirmacao">
                      <span>{textoDe.get(a.perguntaId) ?? a.chave}</span>
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
                      {`${tomDaNota(a.nota!)} · time: ${a.favoravelTime}% favorável`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="modelo-cartao__titulo">Mais negativo que o time</h3>
            {maisNegativas.length === 0 ? (
              <p className="pesquisas__suave">
                Nenhuma afirmação em que esta resposta fique abaixo do time.
              </p>
            ) : (
              <ol className="clima-lista" aria-label="Mais negativo que o time">
                {maisNegativas.map((a) => (
                  <li key={a.chave}>
                    <span className="clima-afirmacao">
                      <span>{textoDe.get(a.perguntaId) ?? a.chave}</span>
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
                      {`${tomDaNota(a.nota!)} · time: ${a.favoravelTime}% favorável`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>

      <section className="modelo-cartao" aria-labelledby="clima-distribuicao">
        <h2 id="clima-distribuicao">Distribuição das notas</h2>
        <p className="pesquisas__suave">
          {p.distribuicao.time
            ? "Esta resposta (escuro) e o time (claro), em % das notas."
            : "Esta resposta, em % das notas."}
        </p>
        <ol className="clima-distribuicao" aria-label="Notas de 1 a 5">
          {p.distribuicao.resposta.map((q, i) => {
            const t = p.distribuicao.time?.[i] ?? null;
            return (
              <li
                key={i}
                aria-label={`Nota ${i + 1}: ${plural(q, "resposta", "respostas")} (${pctDaPessoa(q)}%)${t !== null ? `, time ${t}%` : ""}`}
              >
                <strong>{i + 1}</strong>
                <span className="clima-distribuicao__barras" aria-hidden="true">
                  <span style={{ width: `${pctDaPessoa(q)}%` }} />
                  {t !== null ? (
                    <span data-serie="time" style={{ width: `${t}%` }} />
                  ) : null}
                </span>
                <span className="pesquisas__suave">
                  {`${pctDaPessoa(q)}%${t !== null ? ` · ${t}%` : ""}`}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {abertas.length > 0 ? (
        <section
          className="modelo-cartao"
          aria-labelledby="clima-abertas-resposta"
        >
          <h2 id="clima-abertas-resposta">Respostas abertas</h2>
          {abertas.map((x) => {
            const v = valor.get(x.id);
            return (
              <div
                key={x.id}
                role="group"
                aria-label={textoParaOPainel(x.texto)}
              >
                <h3 className="modelo-cartao__titulo">
                  {textoParaOPainel(x.texto)}
                </h3>
                {typeof v === "string" && v.trim() ? (
                  <blockquote className="pesquisas__comentario">{v}</blockquote>
                ) : (
                  <p className="pesquisas__suave">Sem resposta.</p>
                )}
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
