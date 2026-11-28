/**
 * T216 — "Como a pessoa responde" na página Sobre o modelo: uma prévia que
 * funciona como a página pública — uma pergunta por tela, barra de
 * progresso, a escala com os rótulos das pontas, a nota marcada na cor da
 * faixa e "Próxima →" só depois de escolher a nota. O comentário final é
 * opcional; na última tela, "Recomeçar" volta à primeira. Nada é gravado.
 */
import { useId, useState } from "react";
import type { Pergunta } from "../../api/pesquisasClient";
import { faixaDaMedia10, mediaNa10 } from "./indicadores";
import { textoParaOPainel } from "./modelos/empresa";

interface TelaDaPrevia {
  readonly id: string;
  readonly texto: string;
  /** Sem escala: resposta escrita (opcional). */
  readonly escala: {
    readonly minimo: number;
    readonly maximo: number;
    readonly rotuloMinimo: string | null;
    readonly rotuloMaximo: string | null;
  } | null;
}

/** As telas da prévia: as perguntas de nota e as escritas, na ordem. */
export function telasDaPrevia(
  perguntas: readonly Pergunta[],
  comentarioFinal: string | null,
): TelaDaPrevia[] {
  const telas: TelaDaPrevia[] = perguntas.map((p) => ({
    id: p.id,
    texto: p.texto,
    escala:
      p.tipo === "escala"
        ? {
            minimo: p.config.minimo ?? 1,
            maximo: p.config.maximo ?? 5,
            rotuloMinimo: p.config.rotuloMinimo ?? null,
            rotuloMaximo: p.config.rotuloMaximo ?? null,
          }
        : p.tipo === "nota_0_10"
          ? {
              minimo: 0,
              maximo: 10,
              rotuloMinimo: p.config.rotuloMinimo ?? null,
              rotuloMaximo: p.config.rotuloMaximo ?? null,
            }
          : null,
  }));
  return comentarioFinal
    ? [...telas, { id: "comentario", texto: comentarioFinal, escala: null }]
    : telas;
}

export function PreviaDeResposta({
  telas,
}: {
  readonly telas: readonly TelaDaPrevia[];
}) {
  const ids = useId();
  const [indice, setIndice] = useState(0);
  const [nota, setNota] = useState<number | null>(null);
  const tela = telas[indice];
  if (!tela)
    return (
      <p className="pesquisas__suave">
        Uma pergunta por tela, com barra de progresso.
      </p>
    );
  const total = telas.length;
  const ultima = indice === total - 1;
  const e = tela.escala;
  const ir = (i: number) => {
    setIndice(i);
    setNota(null);
  };
  return (
    <div className="pesquisas__mock-resposta">
      <p className="pesquisas__suave">{`Pergunta ${indice + 1} de ${total}`}</p>
      <span
        className="pesquisas__progresso-fino"
        role="progressbar"
        aria-label="Progresso da prévia"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={indice + 1}
      >
        <span style={{ width: `${((indice + 1) / total) * 100}%` }} />
      </span>
      <strong id={`${ids}-texto`}>{textoParaOPainel(tela.texto)}</strong>
      {e ? (
        <>
          <span
            role="radiogroup"
            aria-label="Prévia: escolha uma nota"
            className="pesquisas__previa-escala pesquisas__previa-escala--viva"
          >
            {Array.from(
              { length: e.maximo - e.minimo + 1 },
              (_, i) => e.minimo + i,
            ).map((v) => (
              <label
                key={v}
                {...(nota === v
                  ? {
                      "data-marcada": "",
                      "data-faixa": faixaDaMedia10(mediaNa10(v, e)),
                    }
                  : {})}
              >
                <input
                  type="radio"
                  name={`${ids}-${tela.id}`}
                  value={v}
                  checked={nota === v}
                  onChange={() => setNota(v)}
                />
                {v}
              </label>
            ))}
          </span>
          {e.rotuloMinimo || e.rotuloMaximo ? (
            <span className="pesquisas__previa-pontas">
              <span>{e.rotuloMinimo}</span>
              <span>{e.rotuloMaximo}</span>
            </span>
          ) : null}
        </>
      ) : (
        <textarea
          className="pesquisas__campo pesquisas__previa-comentario"
          aria-labelledby={`${ids}-texto`}
          rows={2}
          placeholder="Escreva aqui, se quiser."
        />
      )}
      {ultima ? (
        <button
          type="button"
          className="pesquisas__mock-botao"
          onClick={() => ir(0)}
        >
          Recomeçar
        </button>
      ) : (
        <button
          type="button"
          className="pesquisas__mock-botao"
          disabled={e !== null && nota === null}
          onClick={() => ir(indice + 1)}
        >
          Próxima →
        </button>
      )}
    </div>
  );
}
