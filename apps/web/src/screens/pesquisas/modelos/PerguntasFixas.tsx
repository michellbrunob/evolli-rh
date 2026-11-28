/**
 * T216 — as perguntas de um modelo de metodologia fixa no assistente (Pulso
 * e Clima, Clima, TAD): o cartão "Perguntas N — Metodologia fixa", a
 * legenda da escala e os grupos em acordeão ("Expandir todas"), com o
 * número, o texto, o selo do tipo e o selo do item (subdimensão,
 * "Invertida"). O comentário de cada dimensão aparece como linha à parte.
 */
import { useState } from "react";
import type { Pergunta, Secao } from "../../../api/pesquisasClient";
import { plural } from "../../../format/plural";
import { IconeAbrir, IconeComentario } from "../../../ui/icones";
import { CartaoDeSecao } from "../componentes";
import { seloDoTipoDaPergunta } from "./selos";
import { textoParaOPainel } from "./empresa";
import type { ModeloDaGaleria } from "./tipos";
import "./PerguntasFixas.css";

interface Grupo {
  readonly titulo: string;
  readonly cor: string | undefined;
  readonly perguntas: readonly Pergunta[];
  readonly comentario: Pergunta | null;
}

const ehComentario = (p: Pergunta) =>
  Boolean(p.chave?.startsWith("__comentario_"));

export function gruposFixos(
  m: ModeloDaGaleria,
  secoes: readonly Secao[],
): Grupo[] {
  const todas = secoes.flatMap((s) => s.perguntas);
  if (m.agrupamento) {
    return m.agrupamento.map((g) => ({
      titulo: g.titulo,
      cor: g.cor,
      perguntas: todas.filter((p) => p.chave && g.chaves.includes(p.chave)),
      comentario: null,
    }));
  }
  return secoes.map((s, i) => ({
    titulo: s.titulo ?? "Perguntas",
    cor: m.secoes[i]?.cor,
    perguntas: s.perguntas.filter((p) => !ehComentario(p)),
    comentario: s.perguntas.find(ehComentario) ?? null,
  }));
}

export function PerguntasFixas({
  modelo: m,
  secoes,
}: {
  readonly modelo: ModeloDaGaleria;
  readonly secoes: readonly Secao[];
}) {
  const grupos = gruposFixos(m, secoes);
  const [abertos, setAbertos] = useState<ReadonlySet<number>>(
    () => new Set([0]),
  );
  const total = grupos.reduce((t, g) => t + g.perguntas.length, 0);
  const selosDoItem = new Map(
    m.secoes
      .flatMap((s) => s.perguntas)
      .filter((p) => p.chave && p.selo)
      .map((p) => [p.chave!, p.selo!]),
  );
  const todosAbertos = abertos.size === grupos.length;
  const ordem = new Map(
    secoes
      .flatMap((s) => s.perguntas)
      .filter((p) => !ehComentario(p))
      .map((p, i) => [p.id, i + 1]),
  );
  return (
    <CartaoDeSecao
      titulo="Perguntas"
      contador={String(total)}
      descricao="Metodologia fixa · as perguntas não podem ser editadas"
    >
      {m.legendaDaEscala ? (
        <div className="pesquisas__faixa-escala">
          <div>
            {m.legendaDaEscala.map((t, i) =>
              i === 0 ? (
                <strong key={t}>{t}</strong>
              ) : (
                <span key={t} className="pesquisas__suave">
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
      ) : null}
      <div className="fixas__cabeca">
        <span className="pesquisas__suave">
          {m.agrupamento ? "Agrupadas por pilar" : "Agrupadas por dimensão"}
        </span>
        <button
          type="button"
          className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
          onClick={() =>
            setAbertos(
              todosAbertos ? new Set() : new Set(grupos.map((_, i) => i)),
            )
          }
        >
          {todosAbertos ? "Recolher todas" : "Expandir todas"}
        </button>
      </div>
      <ul className="fixas__grupos">
        {grupos.map((g, i) => {
          const aberto = abertos.has(i);
          const idCorpo = `fixas-grupo-${i}`;
          return (
            <li key={`${g.titulo}-${i}`} className="fixas__grupo">
              <button
                type="button"
                className="fixas__gatilho"
                aria-expanded={aberto}
                aria-controls={idCorpo}
                onClick={() =>
                  setAbertos((a) => {
                    const n = new Set(a);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
              >
                <span
                  className="galeria__bolinha"
                  style={{
                    background: `var(${g.cor ?? "--color-ink-subtle"})`,
                  }}
                  aria-hidden="true"
                />
                <strong>{g.titulo}</strong>
                <span className="pesquisas__suave">
                  {` · ${plural(g.perguntas.length, "pergunta", "perguntas")}`}
                </span>
                <IconeAbrir
                  tamanho={16}
                  className={
                    aberto ? "fixas__seta fixas__seta--aberta" : "fixas__seta"
                  }
                />
              </button>
              {aberto ? (
                <div id={idCorpo} className="fixas__corpo">
                  <ol className="fixas__perguntas">
                    {g.perguntas.map((p) => {
                      const selo = p.chave
                        ? selosDoItem.get(p.chave)
                        : undefined;
                      return (
                        <li key={p.id}>
                          <span
                            className="pesquisas__numero-pergunta"
                            aria-hidden="true"
                          >
                            {String(ordem.get(p.id) ?? 0).padStart(2, "0")}
                          </span>
                          <span className="fixas__texto">
                            {textoParaOPainel(p.texto)}
                          </span>
                          {selo ? (
                            <span className="pesquisas__selo">{selo}</span>
                          ) : null}
                          <span className="pesquisas__selo">
                            {seloDoTipoDaPergunta(p)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {g.comentario ? (
                    <p className="fixas__comentario">
                      <IconeComentario tamanho={16} />
                      <span>
                        <strong>Comentário opcional sobre esta dimensão</strong>
                        <span className="pesquisas__suave">
                          Texto livre · opcional
                        </span>
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </CartaoDeSecao>
  );
}
