/**
 * T216 — as respostas de uma pessoa a uma pesquisa identificada, pergunta a
 * pergunta (aba Respostas dos resultados e aba Pesquisas da ficha).
 */
import type { Secao, ValorRespondido } from "../../api/pesquisasClient";
import { SEM_RESPOSTA, textoDoValor } from "./exportarResultados";
import "./Pesquisas.css";

export function RespostasDaPessoa({
  rotulo,
  secoes,
  valores,
}: {
  /** Nome acessível da região ("Respostas de …"). */
  readonly rotulo: string;
  readonly secoes: readonly Secao[];
  readonly valores: readonly ValorRespondido[];
}) {
  const porPergunta = new Map(valores.map((v) => [v.perguntaId, v.valor]));
  let n = 0;
  return (
    <section className="pesquisas__respostas" aria-label={rotulo}>
      {secoes.map((s) => (
        <div key={s.id} className="pesquisas__respostas-secao">
          {s.titulo ? (
            <h4 className="pesquisas__respostas-titulo">{s.titulo}</h4>
          ) : null}
          <dl className="pesquisas__respostas-lista">
            {s.perguntas.map((p) => {
              n += 1;
              const texto = porPergunta.has(p.id)
                ? textoDoValor(p, porPergunta.get(p.id))
                : SEM_RESPOSTA;
              return (
                <div key={p.id} className="pesquisas__respostas-item">
                  <dt>
                    <span className="pesquisas__suave" aria-hidden="true">
                      {`${n}. `}
                    </span>
                    {p.texto}
                  </dt>
                  <dd
                    {...(texto === SEM_RESPOSTA
                      ? { className: "pesquisas__suave" }
                      : {})}
                  >
                    {texto}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </section>
  );
}
