/**
 * T216 — os desenhos da página "Sobre o modelo" do eNPS: o cartão da
 * pergunta principal (as 11 notas coloridas por grupo) e o cálculo (a
 * fórmula em pílulas e a barra das zonas de −100 a 100).
 */
import { GRUPOS_DO_ENPS, ZONAS_DO_ENPS, grupoDaNota } from "./textos";
import "./Enps.css";

const NOTAS = Array.from({ length: 11 }, (_, i) => i);

export function PrincipalDoEnps() {
  return (
    <div className="enps-sobre__principal">
      <p>
        <strong>
          “De 0 a 10, quanto você recomendaria a empresa como lugar para
          trabalhar?”
        </strong>
      </p>
      <p className="pesquisas__suave">
        Fixa em toda pesquisa eNPS: é ela que calcula o índice.
      </p>
      <ol className="enps-notas" aria-label="As notas de 0 a 10 por grupo">
        {NOTAS.map((n) => (
          <li key={n} data-grupo={grupoDaNota(n)}>
            {n}
          </li>
        ))}
      </ol>
      <ul className="enps-legenda">
        {[...GRUPOS_DO_ENPS].reverse().map((g) => (
          <li key={g.grupo} data-grupo={g.grupo}>
            <span aria-hidden="true" />
            {`${g.plural} · ${g.notas}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CalculoDoEnps() {
  return (
    <div className="enps-sobre__calculo">
      <p
        className="enps-formula"
        aria-label="eNPS = % de promotores − % de detratores"
      >
        <span className="enps-formula__pilula" data-grupo="promotor">
          % de promotores
        </span>
        <span aria-hidden="true">−</span>
        <span className="enps-formula__pilula" data-grupo="detrator">
          % de detratores
        </span>
        <span aria-hidden="true">=</span>
        <span className="enps-formula__pilula enps-formula__pilula--resultado">
          eNPS
        </span>
      </p>
      <p className="pesquisas__suave">
        Neutros (7 e 8) contam no total, mas não somam nem subtraem. O resultado
        vai de −100 (todos detratores) a 100 (todos promotores).
      </p>
      <BarraDasZonas />
    </div>
  );
}

/** A barra das 4 zonas, proporcional ao intervalo de cada uma. */
export function BarraDasZonas({ valor }: { readonly valor?: number | null }) {
  return (
    <div className="enps-zonas">
      <span
        className="enps-zonas__barra"
        role="img"
        aria-label={`Zonas do eNPS: ${ZONAS_DO_ENPS.map((z) => `${z.rotulo} de ${z.de} a ${z.ate}`).join("; ")}${valor !== undefined && valor !== null ? `. Resultado: ${valor}` : ""}`}
      >
        {ZONAS_DO_ENPS.map((z) => (
          <span
            key={z.zona}
            data-faixa={z.faixa}
            style={{ flexGrow: z.ate - z.de + 1 }}
          />
        ))}
        {valor !== undefined && valor !== null ? (
          <span
            className="enps-zonas__marcador"
            style={{ left: `${((valor + 100) / 200) * 100}%` }}
          />
        ) : null}
      </span>
      <ol className="enps-zonas__rotulos" aria-hidden="true">
        {ZONAS_DO_ENPS.map((z) => (
          <li key={z.zona} style={{ flexGrow: z.ate - z.de + 1 }}>
            <strong>{z.rotulo}</strong>
            <span>{`${z.de} a ${z.ate}`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
