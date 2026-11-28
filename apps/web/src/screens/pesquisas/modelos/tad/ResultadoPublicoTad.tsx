/**
 * T216 — Motivação (TAD): o resultado que a pessoa vê logo depois de
 * enviar, na página pública. O score geral com o nível e a frase, os 3
 * pilares com barra e o mapa das necessidades (radar). Vale só nesta tela;
 * "Salvar em PDF" usa a impressão do navegador.
 */
import type { ReactNode } from "react";
import { Button } from "../../../../components/Button";
import {
  BarraDeScore,
  ROTULO_DO_NIVEL,
  Radar,
  SeloDaFaixa,
  VISUAL_DO_NIVEL,
  duasCasas,
} from "../resultadoComum";
import { PILARES_TAD } from "./catalogo";
import type { ResultadoLocalTad } from "./resultadoLocal";
import { FRASE_DO_NIVEL } from "./ResultadoTad";
import "./Tad.css";

export function ResultadoPublicoTad({
  resultado: r,
  previa,
  titulo,
}: {
  readonly resultado: ResultadoLocalTad;
  readonly previa: boolean;
  /** O título da tela (recebe o foco). */
  readonly titulo: ReactNode;
}) {
  return (
    <div className="tad-publico">
      <span
        className="pesquisa-publica__simbolo pesquisa-publica__simbolo--sucesso"
        aria-hidden="true"
      >
        ✓
      </span>
      {titulo}
      <p className="pesquisa-publica__texto">
        {previa
          ? "Esta foi uma pré-visualização: nada foi gravado. Veja como o resultado aparece para quem responde."
          : "Confira abaixo como estão as suas 3 necessidades no trabalho."}
      </p>
      <section
        className="tad-publico__geral"
        data-faixa={VISUAL_DO_NIVEL[r.nivel]}
        aria-label="Score geral de motivação"
      >
        <p className="tad-publico__rotulo">Score geral de motivação</p>
        <p className="tad-publico__valor">
          <strong>{duasCasas(r.geral)}</strong>
          <span>de 7,00</span>
          <SeloDaFaixa
            faixa={VISUAL_DO_NIVEL[r.nivel]}
            texto={ROTULO_DO_NIVEL[r.nivel]}
          />
        </p>
        <p>{FRASE_DO_NIVEL[r.nivel]}</p>
      </section>
      <ul className="tad-publico__pilares" aria-label="Seus pilares">
        {r.pilares.map((p) => {
          const def = PILARES_TAD.find((x) => x.chave === p.chave);
          return (
            <li key={p.chave}>
              <span className="tad-publico__pilar-nome">
                <span
                  className="modelo-bolinha"
                  style={{ background: `var(${def?.cor ?? "--color-action"})` }}
                  aria-hidden="true"
                />
                <strong>{p.rotulo}</strong>
                {p.nivel ? (
                  <SeloDaFaixa
                    faixa={VISUAL_DO_NIVEL[p.nivel]}
                    texto={ROTULO_DO_NIVEL[p.nivel]}
                  />
                ) : null}
                <span className="tad-publico__pilar-valor">
                  {p.score === null ? "—" : duasCasas(p.score)}
                </span>
              </span>
              {p.score !== null && p.nivel ? (
                <BarraDeScore
                  valor={((p.score - 1) / 6) * 100}
                  faixa={VISUAL_DO_NIVEL[p.nivel]}
                  rotulo={`${p.rotulo}: ${duasCasas(p.score)} de 7`}
                />
              ) : null}
              <span className="pesquisas__suave">{def?.texto}</span>
            </li>
          );
        })}
      </ul>
      <section aria-label="Mapa de motivação" className="tad-publico__mapa">
        <h2 className="tad-publico__subtitulo">Mapa de motivação</h2>
        <Radar
          rotulo="Mapa de motivação, de 0 a 7"
          maximo={7}
          eixos={r.pilares.map((p) => ({
            rotulo: p.rotulo,
            valor: p.score ?? 0,
          }))}
        />
      </section>
      <p className="tad-publico__aviso" role="note">
        Este resultado aparece só agora. Ao fechar a página, ele não pode ser
        aberto de novo — salve em PDF se quiser guardar.
      </p>
      <div className="tad-publico__acoes">
        <Button variant="secondary" onClick={() => window.print()}>
          Salvar em PDF
        </Button>
      </div>
    </div>
  );
}
