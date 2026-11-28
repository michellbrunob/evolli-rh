/**
 * T216 — eNPS: a aba Respostas (pílulas Todos · Promotores · Neutros ·
 * Detratores e a coluna da nota principal com o grupo) e a Visão geral do
 * resultado individual (a nota com o grupo e o que ela quer dizer, o eNPS
 * do time, cada complementar com a nota, o time e a diferença, e as
 * respostas abertas da pessoa).
 */
import { useState } from "react";
import type {
  GrupoDoEnps,
  PesquisaDetalhe,
  RespostaDetalhe,
  RespostaResumo,
  ResultadoIndividualDoEnps,
  Secao,
} from "../../../../api/pesquisasClient";
import { formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { IconeAvancar } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { Avatar, iniciaisDe, Pilulas } from "../../componentes";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { textoParaOPainel } from "../empresa";
import {
  FRASE_DO_GRUPO,
  GRUPOS_DO_ENPS,
  TITULO_DA_ZONA,
  comSinal,
  diferencaBr,
  umaCasaBr,
} from "./textos";
import "./Enps.css";

/** "27/11 · 11:23" (o mesmo formato da lista comum). */
const diaEHora = (iso: string) =>
  formatarInstante(iso).replace(/^(\d{2}\/\d{2})\/\d{4} às /, "$1 · ");

const grupo = (g: GrupoDoEnps) => GRUPOS_DO_ENPS.find((x) => x.grupo === g)!;

/** A nota com a cor do grupo e o selo ("9 · Promotor"). */
export function NotaDoEnps({
  nota,
  grupo: g,
}: {
  readonly nota: number;
  readonly grupo: GrupoDoEnps;
}) {
  return (
    <span className="enps-nota" data-grupo={g}>
      <span className="enps-nota__numero">{nota}</span>
      <span className="enps-selo">{grupo(g).singular}</span>
    </span>
  );
}

type Filtro = "todos" | GrupoDoEnps;

export function RespostasEnps({
  detalhe,
  respostas,
  onAbrir,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onAbrir: (id: string) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const identificada = detalhe.identificacao === "identificada";
  if (!respostas)
    return <Esqueleto rotulo="Carregando respostas…" linhas={4} />;
  if (respostas.length === 0)
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Ninguém respondeu ainda.</strong>
      </div>
    );
  const doGrupo = (g: GrupoDoEnps) =>
    respostas.filter((r) => r.enps?.grupo === g);
  const lista = filtro === "todos" ? respostas : doGrupo(filtro);
  return (
    <>
      <Pilulas
        rotulo="Respostas"
        valor={filtro}
        onMudar={setFiltro}
        opcoes={[
          { valor: "todos", rotulo: "Todos", contagem: respostas.length },
          ...GRUPOS_DO_ENPS.map((g) => ({
            valor: g.grupo,
            rotulo: g.plural,
            contagem: doGrupo(g.grupo).length,
          })),
        ]}
      />
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
              <th scope="col">Nota principal</th>
              <th scope="col">Respondeu em</th>
              <th scope="col">
                <span className="pesquisas__so-leitor">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => {
              const nome =
                identificada && r.nome
                  ? r.nome
                  : `Resposta anônima #${r.numero}`;
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
                      <span className="pesquisas__pessoa-textos">
                        <span className="pesquisas__forte">{nome}</span>
                        {identificada && r.departamento ? (
                          <span className="pesquisas__suave">
                            {r.departamento}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td>
                    {r.enps ? (
                      <NotaDoEnps nota={r.enps.nota} grupo={r.enps.grupo} />
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
          <span>{plural(lista.length, "resposta", "respostas")}</span>
          <span className="pesquisas__suave">
            Da mais recente para a mais antiga
          </span>
        </div>
      </div>
    </>
  );
}

/** A Visão geral do resultado individual do eNPS. */
export function IndividualEnps({
  p,
  resposta,
  secoes,
}: {
  readonly p: ResultadoIndividualDoEnps;
  readonly resposta: RespostaDetalhe;
  readonly secoes: readonly Secao[];
}) {
  const perguntas = perguntasEmOrdem(secoes);
  const porId = new Map(perguntas.map((x) => [x.id, x]));
  const rotuloDe = (id: string) => {
    const x = porId.get(id);
    return x ? textoParaOPainel(x.rotulo || x.texto) : "Pergunta";
  };
  const valores = new Map(resposta.valores.map((v) => [v.perguntaId, v.valor]));
  const abertas = perguntas.filter(
    (x) => x.tipo === "paragrafo" || x.tipo === "texto_curto",
  );
  return (
    <div className="modelo-resultado">
      <section className="modelo-cartao" aria-label="Nota principal">
        <h2 className="modelo-cartao__titulo">Nota principal</h2>
        {p.nota === null || p.grupo === null ? (
          <p className="pesquisas__suave">Sem nota na pergunta principal.</p>
        ) : (
          <>
            <div className="enps-individual__nota" data-grupo={p.grupo}>
              <span className="enps-nota__numero">{p.nota}</span>
              <span className="enps-selo">{grupo(p.grupo).singular}</span>
            </div>
            <p>{FRASE_DO_GRUPO[p.grupo]}</p>
          </>
        )}
        {p.enpsTime !== null && p.zonaTime !== null ? (
          <p className="pesquisas__suave">
            {`eNPS do time: ${comSinal(p.enpsTime)} (${TITULO_DA_ZONA[p.zonaTime].toLowerCase()}) · ${p.promotoresTime ?? 0}% são promotores`}
          </p>
        ) : null}
      </section>

      {p.complementares.length > 0 ? (
        <section
          className="modelo-cartao"
          aria-label="Perguntas complementares"
        >
          <h2 className="modelo-cartao__titulo">Perguntas complementares</h2>
          <div className="pesquisas__tabela-caixa">
            <table
              className="pesquisas__tabela enps-tabela"
              aria-label="Complementares comparadas com o time"
            >
              <thead>
                <tr>
                  <th scope="col">Pergunta</th>
                  <th scope="col" className="pesquisas__numero">
                    Nota
                  </th>
                  <th scope="col" className="pesquisas__numero">
                    Time
                  </th>
                  <th scope="col" className="pesquisas__numero">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.complementares.map((c) => (
                  <tr key={c.perguntaId}>
                    <td>{rotuloDe(c.perguntaId)}</td>
                    <td className="pesquisas__numero">
                      {c.nota === null ? "—" : c.nota}
                    </td>
                    <td className="pesquisas__numero">
                      {c.time === null ? "—" : umaCasaBr(c.time)}
                    </td>
                    <td className="pesquisas__numero">
                      {c.diferenca === null ? (
                        "—"
                      ) : (
                        <span
                          className="enps-diferenca"
                          data-sinal={
                            c.diferenca > 0
                              ? "mais"
                              : c.diferenca < 0
                                ? "menos"
                                : "igual"
                          }
                        >
                          {diferencaBr(c.diferenca)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {abertas.length > 0 ? (
        <section className="modelo-cartao" aria-label="Respostas abertas">
          <h2 className="modelo-cartao__titulo">Respostas abertas</h2>
          <ul className="enps-abertas">
            {abertas.map((x) => {
              const v = valores.get(x.id);
              return (
                <li key={x.id}>
                  <span className="pesquisas__suave">{rotuloDe(x.id)}</span>
                  {typeof v === "string" && v.trim() ? (
                    <blockquote>{v}</blockquote>
                  ) : (
                    <span className="pesquisas__suave">Sem resposta.</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
