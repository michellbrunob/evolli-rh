/**
 * T216 — os cartões da capa do PDF de uma resposta na régua do modelo (TAD:
 * score de 1 a 7 com o nível e os pilares ao lado do time; Pulso e Clima:
 * score de 0 a 100 com a faixa, as dimensões ao lado do time e as notas de
 * recomendação), no lugar da média de 0 a 10. `null` nos demais modelos.
 */
import type { RespostaDetalhe } from "../../../api/pesquisasClient";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DO_NIVEL,
  comSinal,
  duasCasas,
} from "./resultadoComum";
import {
  comparacaoComOTime,
  grupoDaNota,
} from "./pulso_clima/IndividualPulsoClima";
import { diferencaTad } from "./tad/ResultadoTad";

export function cartoesIndividuaisDoModelo(r: RespostaDetalhe) {
  const m = r.modelo;
  if (m?.modelo === "tad") {
    const time = m.time ?? null;
    return (
      <div className="relatorio__capa-cartoes">
        <div className="relatorio__cartao">
          <p className="relatorio__cartao-titulo">Score geral de motivação</p>
          <strong className="relatorio__numero">
            {m.geral === null ? "—" : duasCasas(m.geral)}
          </strong>
          <span>{m.nivel ? `de 7 · ${ROTULO_DO_NIVEL[m.nivel]}` : "de 7"}</span>
          {m.geral !== null && time?.geral != null ? (
            <span>{`${diferencaTad(m.geral, time.geral)} em relação ao time (${duasCasas(time.geral)})`}</span>
          ) : null}
        </div>
        <div className="relatorio__cartao">
          <p className="relatorio__cartao-titulo">
            Os 3 pilares<span>resposta · time</span>
          </p>
          <ul className="relatorio__destaques" aria-label="Pilares da resposta">
            {m.pilares.map((p, i) => (
              <li key={p.chave}>
                <span>{p.rotulo}</span>
                <span className="relatorio__rotulo">
                  {time?.pilares[i] != null
                    ? `time ${duasCasas(time.pilares[i]!)}`
                    : ""}
                </span>
                <strong>{p.score === null ? "—" : duasCasas(p.score)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  if (m?.modelo === "pulso_clima") {
    return (
      <div className="relatorio__capa-cartoes">
        <div className="relatorio__cartao">
          <p className="relatorio__cartao-titulo">Score da resposta</p>
          <strong className="relatorio__numero">{m.score ?? "—"}</strong>
          <span>
            {m.faixa ? `de 100 · ${ROTULO_DA_FAIXA[m.faixa]}` : "de 100"}
          </span>
          {m.score !== null && m.scoreTime !== null ? (
            <span>{comparacaoComOTime(m.score, m.scoreTime)}</span>
          ) : null}
        </div>
        <div className="relatorio__cartao">
          <p className="relatorio__cartao-titulo">
            Por dimensão<span>resposta · time</span>
          </p>
          <ul
            className="relatorio__destaques"
            aria-label="Dimensões da resposta"
          >
            {m.dimensoes.map((d) => (
              <li key={d.chave}>
                <span>{d.rotulo}</span>
                <span className="relatorio__rotulo">
                  {d.scoreTime === null ? "" : `time ${d.scoreTime}`}
                </span>
                <strong>{d.score ?? "—"}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div className="relatorio__cartao">
          <p className="relatorio__cartao-titulo">Recomendação</p>
          <ul
            className="relatorio__destaques"
            aria-label="Recomendação da resposta"
          >
            {(
              [
                ["eNPS · empresa", m.enps],
                ["LNPS · liderança direta", m.lnps],
              ] as const
            ).map(([rotulo, x]) => (
              <li key={rotulo}>
                <span>{rotulo}</span>
                <span className="relatorio__rotulo">
                  {x.nota === null
                    ? "sem nota"
                    : `${grupoDaNota(x.nota)}${x.indiceTime !== null ? ` · time ${comSinal(x.indiceTime)}` : ""}`}
                </span>
                <strong>{x.nota ?? "—"}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  return null;
}
