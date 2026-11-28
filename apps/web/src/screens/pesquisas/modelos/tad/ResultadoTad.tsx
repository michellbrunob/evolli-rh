/**
 * T216 — Motivação (TAD): o resultado do time (score geral de 1 a 7 com o
 * nível, os 3 pilares com barra e o mapa das necessidades em radar, e
 * quantas pessoas em cada nível) e o resultado de uma pessoa (o mesmo
 * desenho, sem a contagem, com a comparação de cada pilar com o time).
 */
import type {
  PilarTad,
  ResultadoIndividualTad,
  ResultadoTad,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import {
  BarraDeScore,
  ROTULO_DO_NIVEL,
  Radar,
  SeloDaFaixa,
  VISUAL_DO_NIVEL,
  duasCasas,
} from "../resultadoComum";
import { PILARES_TAD } from "./catalogo";

export const FRASE_DO_NIVEL = {
  alto: "Necessidade bem satisfeita.",
  moderado: "Satisfação parcial: vale acompanhar.",
  baixo: "Necessidade frustrada: pede ação.",
} as const;

function CartoesDosPilares({
  pilares,
}: {
  readonly pilares: readonly PilarTad[];
}) {
  return (
    <div className="modelo-pilares">
      {pilares.map((p) => {
        const def = PILARES_TAD.find((x) => x.chave === p.chave);
        return (
          <section
            key={p.chave}
            className="modelo-cartao"
            aria-label={p.rotulo}
          >
            <h3 className="modelo-cartao__titulo">
              <span
                className="modelo-bolinha"
                style={{ background: `var(${def?.cor ?? "--color-action"})` }}
                aria-hidden="true"
              />{" "}
              {p.rotulo}
            </h3>
            {p.score !== null && p.nivel ? (
              <>
                <p className="modelo-valor">
                  <strong>{duasCasas(p.score)}</strong>
                  <span className="pesquisas__suave">/ 7</span>
                  <SeloDaFaixa
                    faixa={VISUAL_DO_NIVEL[p.nivel]}
                    texto={ROTULO_DO_NIVEL[p.nivel]}
                  />
                </p>
                <BarraDeScore
                  valor={((p.score - 1) / 6) * 100}
                  faixa={VISUAL_DO_NIVEL[p.nivel]}
                  rotulo={`${p.rotulo}: ${duasCasas(p.score)} de 7`}
                />
              </>
            ) : (
              <p className="pesquisas__suave">—</p>
            )}
            <p className="pesquisas__suave">{def?.texto}</p>
          </section>
        );
      })}
    </div>
  );
}

/** O score geral, os pilares e o radar (time ou pessoa). */
export function PainelTad({
  r,
  titulo,
}: {
  readonly r: ResultadoTad | ResultadoIndividualTad;
  readonly titulo: string;
}) {
  return (
    <div className="modelo-resultado">
      <section className="modelo-cartao" aria-label="Score geral de motivação">
        <h3 className="modelo-cartao__titulo">{titulo}</h3>
        {r.geral !== null && r.nivel ? (
          <>
            <p className="modelo-valor">
              <strong>{duasCasas(r.geral)}</strong>
              <span className="pesquisas__suave">/ 7</span>
              <SeloDaFaixa
                faixa={VISUAL_DO_NIVEL[r.nivel]}
                texto={ROTULO_DO_NIVEL[r.nivel]}
              />
            </p>
            <p className="pesquisas__suave">{FRASE_DO_NIVEL[r.nivel]}</p>
          </>
        ) : (
          <p className="pesquisas__suave">—</p>
        )}
      </section>
      <CartoesDosPilares pilares={r.pilares} />
      <section className="modelo-cartao" aria-label="Mapa das necessidades">
        <h3 className="modelo-cartao__titulo">Mapa das necessidades</h3>
        <Radar
          rotulo="Mapa das necessidades, de 0 a 7"
          maximo={7}
          eixos={r.pilares.map((p) => ({
            rotulo: `${p.rotulo} (${p.score === null ? "—" : duasCasas(p.score)})`,
            valor: p.score ?? 0,
          }))}
        />
      </section>
    </div>
  );
}

export function ResultadoTadVisao({ r }: { readonly r: ResultadoTad }) {
  return (
    <div className="modelo-resultado">
      <PainelTad r={r} titulo="Resultado do time: score geral de motivação" />
      <section className="modelo-cartao" aria-label="Pessoas por nível">
        <h3 className="modelo-cartao__titulo">
          {`Pessoas por nível · ${plural(r.respondentes, "resposta", "respostas")}`}
        </h3>
        <ul className="modelo-niveis">
          {(["alto", "moderado", "baixo"] as const).map((n) => (
            <li key={n}>
              <SeloDaFaixa
                faixa={VISUAL_DO_NIVEL[n]}
                texto={`${ROTULO_DO_NIVEL[n]}: ${plural(r.niveis[n], "pessoa", "pessoas")}`}
              />
            </li>
          ))}
        </ul>
        <p className="pesquisas__suave">
          O time é a média dos scores de cada pessoa. Alto de 5,5 a 7,0 ·
          moderado de 3,5 a 5,4 · baixo de 1,0 a 3,4.
        </p>
      </section>
    </div>
  );
}

/** "+0,61" / "−1,20" / "0,00" (duas casas). */
export function diferencaTad(valor: number, time: number): string {
  const d = Math.round((valor - time) * 100) / 100;
  if (d === 0) return "0,00";
  return `${d > 0 ? "+" : "−"}${duasCasas(Math.abs(d))}`;
}

/**
 * O resultado de uma resposta na régua da TAD: o score geral, os pilares e
 * o radar, e cada pilar ao lado do time.
 */
export function IndividualTad({ r }: { readonly r: ResultadoIndividualTad }) {
  const time = r.time ?? null;
  const linhas = [
    { rotulo: "Score geral", valor: r.geral, doTime: time?.geral ?? null },
    ...r.pilares.map((p, i) => ({
      rotulo: p.rotulo,
      valor: p.score,
      doTime: time?.pilares[i] ?? null,
    })),
  ];
  return (
    <div className="modelo-resultado">
      <PainelTad r={r} titulo="Score geral de motivação" />
      {time ? (
        <section className="modelo-cartao" aria-labelledby="tad-comparacao">
          <h2 id="tad-comparacao">Comparação com o time</h2>
          <p className="pesquisas__suave">
            De 1 a 7. O time é a média dos scores de cada pessoa.
          </p>
          <table className="modelo-tabela" aria-label="Comparação com o time">
            <thead>
              <tr>
                <th scope="col">Necessidade</th>
                <th scope="col">Resposta</th>
                <th scope="col">Time</th>
                <th scope="col">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo}>
                  <td>{l.rotulo}</td>
                  <td className="modelo-numero">
                    {l.valor === null ? "—" : duasCasas(l.valor)}
                  </td>
                  <td className="modelo-numero">
                    {l.doTime === null ? "—" : duasCasas(l.doTime)}
                  </td>
                  <td className="modelo-numero">
                    {l.valor === null || l.doTime === null
                      ? "—"
                      : diferencaTad(l.valor, l.doTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
