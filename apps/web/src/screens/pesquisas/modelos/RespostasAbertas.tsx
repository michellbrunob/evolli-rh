/**
 * T216 — as respostas abertas na Visão geral (eNPS e Clima): um bloco por
 * pergunta, lado a lado, com "N respostas", as 3 primeiras e "Ver as N
 * respostas"; o atalho "Ver temas em Análises" leva à aba Análises.
 *
 * Ordem: na identificada, as mais recentes primeiro (o servidor manda na
 * ordem de chegada); nas demais, a ordem alfabética do servidor — a de
 * chegada ajudaria a ligar o texto a quem respondeu. Nenhuma data aparece.
 */
import { useState } from "react";
import { Button } from "../../../components";
import { plural } from "../../../format/plural";
import "./Resultados.css";

export interface BlocoDeAbertas {
  readonly id: string;
  /** O enunciado da pergunta (título e nome do bloco). */
  readonly titulo: string;
  /** Na ordem do servidor. */
  readonly textos: readonly {
    readonly texto: string;
    readonly autor: string | null;
  }[];
}

const VISIVEIS = 3;

function Bloco({
  bloco,
  maisRecentesPrimeiro,
  comAutor,
}: {
  readonly bloco: BlocoDeAbertas;
  readonly maisRecentesPrimeiro: boolean;
  readonly comAutor: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const textos = maisRecentesPrimeiro
    ? [...bloco.textos].reverse()
    : bloco.textos;
  const total = textos.length;
  return (
    <div
      role="group"
      aria-label={bloco.titulo}
      className="respostas-abertas__bloco"
    >
      <h3 className="respostas-abertas__titulo">{bloco.titulo}</h3>
      <p className="pesquisas__suave">
        {plural(total, "resposta", "respostas")}
      </p>
      {total === 0 ? (
        <p className="pesquisas__suave">Nenhuma resposta escrita.</p>
      ) : (
        <ul className="respostas-abertas__lista">
          {(todas ? textos : textos.slice(0, VISIVEIS)).map((t, i) => (
            <li key={`${bloco.id}-${i}`}>
              <blockquote>{t.texto}</blockquote>
              {comAutor && t.autor ? (
                <span className="pesquisas__suave">{t.autor}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {total > VISIVEIS ? (
        <Button
          variant="secondary"
          aria-expanded={todas}
          onClick={() => setTodas((v) => !v)}
        >
          {todas ? "Mostrar menos" : `Ver as ${total} respostas`}
        </Button>
      ) : null}
    </div>
  );
}

export function RespostasAbertas({
  blocos,
  identificada,
  onVerTemas,
}: {
  readonly blocos: readonly BlocoDeAbertas[];
  /** Identificada: as mais recentes primeiro e o nome de quem escreveu. */
  readonly identificada: boolean;
  /** "Ver temas em Análises" (troca para a aba Análises). */
  readonly onVerTemas?: (() => void) | undefined;
}) {
  if (blocos.length === 0) return null;
  return (
    <section className="modelo-cartao" aria-label="Respostas abertas">
      <div className="modelo-secao-cabeca">
        <h2 className="modelo-cartao__titulo">Respostas abertas</h2>
        {onVerTemas ? (
          <Button variant="secondary" onClick={onVerTemas}>
            Ver temas em Análises
          </Button>
        ) : null}
      </div>
      <div className="respostas-abertas__blocos">
        {blocos.map((b) => (
          <Bloco
            key={b.id}
            bloco={b}
            maisRecentesPrimeiro={identificada}
            comAutor={identificada}
          />
        ))}
      </div>
    </section>
  );
}
