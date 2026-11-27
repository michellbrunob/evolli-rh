/**
 * T216 — as respostas de uma pessoa a uma pesquisa identificada, pergunta a
 * pergunta (aba Respostas dos resultados e aba Pesquisas da ficha).
 */
import type {
  Pergunta,
  Secao,
  ValorRespondido,
} from "../../api/pesquisasClient";
import { SEM_RESPOSTA, textoDoValor } from "./exportarResultados";
import { ehDeEscala, escalaDe, faixaDaMedia10, mediaNa10 } from "./indicadores";
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
                    {ehDeEscala(p) &&
                    typeof porPergunta.get(p.id) === "number" ? (
                      <LinhaDaEscala
                        pergunta={p}
                        valor={porPergunta.get(p.id) as number}
                      />
                    ) : (
                      texto
                    )}
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

/** A escala inteira (1 a 10, 0 a 10, 1 a 5), com a nota marcada na cor da faixa. */
function LinhaDaEscala({
  pergunta,
  valor,
}: {
  readonly pergunta: Pergunta;
  readonly valor: number;
}) {
  const e = escalaDe(pergunta);
  const pontos = Array.from(
    { length: e.maximo - e.minimo + 1 },
    (_, i) => e.minimo + i,
  );
  return (
    <span className="pesquisas__linha-escala">
      <span className="pesquisas__so-leitor">{`Nota ${valor} de ${e.maximo}`}</span>
      <span className="pesquisas__linha-escala-pontos" aria-hidden="true">
        {pontos.map((n) => (
          <span
            key={n}
            {...(n === valor
              ? {
                  "data-marcado": "",
                  "data-faixa": faixaDaMedia10(mediaNa10(valor, e)),
                }
              : {})}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}
