/**
 * T216 — Pulso e Clima: a aba Comentários. Ordenados do mais recente para o
 * mais antigo (ou o contrário); no mesmo mês, em ordem alfabética, para a
 * ordem não ligar o texto a quem respondeu. Filtro lateral por dimensão com
 * o score e a contagem; cada cartão mostra a dimensão, o score com a faixa,
 * o texto e "Anônimo · departamento · mês" (o departamento só aparece
 * quando o grupo dele tem o mínimo de respostas).
 */
import { useState } from "react";
import type {
  PesquisaDetalhe,
  ResultadoPulsoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { formatarCompetenciaPorExtenso } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { ListaDeEscolha } from "../../../../ui";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DA_RECOMENDACAO,
  SeloDaFaixa,
  VISUAL_DA_RECOMENDACAO,
  comSinal,
} from "../resultadoComum";
import { DIMENSOES_PULSO_CLIMA, corDaDimensao } from "./catalogo";
import "./PulsoClima.css";

const ROTULO_DA_RECOMENDACAO_DO_GRUPO: Readonly<Record<string, string>> = {
  lnps: "LNPS · liderança direta",
  enps: "eNPS · empresa",
};

/** A dimensão pedida pelo atalho "Ver em Comentários" (lida uma vez). */
let dimensaoPedida: string | null = null;

export function pedirDimensaoDosComentarios(chave: string | null) {
  dimensaoPedida = chave;
}

function corDe(chave: string): string {
  const i = DIMENSOES_PULSO_CLIMA.findIndex((d) => d.chave === chave);
  if (i >= 0) return `var(${corDaDimensao(i)})`;
  if (chave === "lnps") return "var(--modelo-celeste)";
  if (chave === "enps") return "var(--modelo-coral)";
  return "var(--color-ink-subtle)";
}

export interface ComentarioDaLista {
  readonly dimensao: string;
  readonly texto: string;
  readonly mes: string | null;
  readonly departamento: string | null;
}

/** Os comentários do resultado (ou, sem os textos, os da pergunta). */
export function comentariosDoResultado(
  r: ResultadoPulsoClima,
  geral: ResultadosPesquisa,
): ComentarioDaLista[] {
  // Todas as dimensões juntas: do mês mais recente ao mais antigo (a ordem
  // dentro do mês fica a da API, alfabética).
  const lista = r.comentarios.flatMap((c) => {
    if (c.textos) return c.textos.map((t) => ({ dimensao: c.dimensao, ...t }));
    const p = geral.perguntas.find((x) => x.perguntaId === c.perguntaId);
    return p && "textos" in p
      ? p.textos.map((t) => ({
          dimensao: c.dimensao,
          texto: t.texto,
          mes: null,
          departamento: null,
        }))
      : [];
  });
  return lista
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.mes ?? "").localeCompare(a.c.mes ?? "") || a.i - b.i)
    .map((x) => x.c);
}

export function ComentariosPulsoClima({
  detalhe,
  geral,
  r,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoPulsoClima;
}) {
  const [filtro, setFiltro] = useState<string>(() => {
    const pedida = dimensaoPedida;
    dimensaoPedida = null;
    return pedida && r.comentarios.some((c) => c.dimensao === pedida)
      ? pedida
      : "todas";
  });
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");
  const todos = comentariosDoResultado(r, geral);
  const doFiltro =
    filtro === "todas" ? todos : todos.filter((c) => c.dimensao === filtro);
  // A API manda do mais recente para o mais antigo; "mais antigos" inverte
  // os meses e mantém a ordem alfabética dentro de cada mês.
  const visiveis =
    ordem === "recentes"
      ? doFiltro
      : doFiltro
          .map((c, i) => ({ c, i }))
          .sort(
            (a, b) => (a.c.mes ?? "").localeCompare(b.c.mes ?? "") || a.i - b.i,
          )
          .map((x) => x.c);
  const anonimo = detalhe.identificacao !== "identificada";
  const dimensaoDe = (chave: string) =>
    r.dimensoes.find((d) => d.chave === chave) ?? null;
  const rotuloDe = (chave: string) =>
    dimensaoDe(chave)?.rotulo ??
    ROTULO_DA_RECOMENDACAO_DO_GRUPO[chave] ??
    chave;

  /** O score (dimensão) ou o índice (eNPS/LNPS) com a faixa. */
  function Indicador({ chave }: { readonly chave: string }) {
    const d = dimensaoDe(chave);
    if (d) {
      return d.score !== null && d.faixa ? (
        <span className="pc-comentario__score">
          <strong>{`${d.score}/100`}</strong>
          <SeloDaFaixa faixa={d.faixa} texto={ROTULO_DA_FAIXA[d.faixa]} />
        </span>
      ) : null;
    }
    const nps = chave === "enps" ? r.enps : chave === "lnps" ? r.lnps : null;
    return nps && nps.indice !== null && nps.faixa ? (
      <span className="pc-comentario__score">
        <strong>{comSinal(nps.indice)}</strong>
        <SeloDaFaixa
          faixa={VISUAL_DA_RECOMENDACAO[nps.faixa]}
          texto={ROTULO_DA_RECOMENDACAO[nps.faixa]}
        />
      </span>
    ) : null;
  }

  return (
    <section className="modelo-cartao" aria-labelledby="pc-comentarios">
      <div className="modelo-secao-cabeca">
        <h2 id="pc-comentarios">
          Comentários{" "}
          <span className="pesquisas__contagem">{todos.length}</span>
        </h2>
        <div className="pc-ordenar">
          <label htmlFor="pc-comentarios-ordem">Ordenar</label>
          <ListaDeEscolha
            id="pc-comentarios-ordem"
            opcoes={[
              { valor: "recentes", rotulo: "Mais recentes" },
              { valor: "antigos", rotulo: "Mais antigos" },
            ]}
            valor={ordem}
            onMudar={(v) => setOrdem(v === "antigos" ? "antigos" : "recentes")}
          />
        </div>
      </div>
      {anonimo ? (
        <p className="pesquisas__suave" role="note">
          {`Os comentários aparecem sem nome. O departamento só é mostrado em grupos com ${plural(detalhe.minimoPorGrupo, "resposta", "respostas")} ou mais.`}
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
              <span className="pesquisas__contagem">{todos.length}</span>
            </button>
          </li>
          {r.comentarios.map((c) => {
            const d = dimensaoDe(c.dimensao);
            return (
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
                  <span className="pc-filtro__nome">
                    {rotuloDe(c.dimensao)}
                    {d && d.score !== null ? (
                      <span className="pesquisas__suave">{` · ${d.score}/100`}</span>
                    ) : null}
                  </span>
                  <span className="pesquisas__contagem">{c.quantidade}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {visiveis.length === 0 ? (
          <p className="pesquisas__suave">Nenhum comentário por aqui.</p>
        ) : (
          <ul className="pc-comentarios" aria-label="Comentários">
            {visiveis.map((c, i) => {
              const d = dimensaoDe(c.dimensao);
              const quantos =
                r.comentarios.find((x) => x.dimensao === c.dimensao)
                  ?.quantidade ?? 0;
              return (
                <li
                  key={`${c.dimensao}-${i}`}
                  className="pc-comentario"
                  style={{ ["--comentario-cor" as string]: corDe(c.dimensao) }}
                >
                  <div className="pc-comentario__cabeca">
                    <span>
                      <strong>{rotuloDe(c.dimensao)}</strong>
                      <span className="pesquisas__suave">
                        {` · ${plural(quantos, "comentário", "comentários")}${d ? ` · ${plural(d.afirmacoes, "afirmação", "afirmações")}` : ""}`}
                      </span>
                    </span>
                    <Indicador chave={c.dimensao} />
                  </div>
                  <p className="pc-comentario__texto">{`“${c.texto}”`}</p>
                  <p className="pesquisas__suave pc-comentario__rodape">
                    {[
                      anonimo ? "Anônimo" : null,
                      c.departamento ?? "Departamento oculto",
                      c.mes ? formatarCompetenciaPorExtenso(c.mes) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
