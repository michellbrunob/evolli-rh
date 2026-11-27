/**
 * T216 — Perfil comportamental (DISC): o resultado que a pessoa vê logo
 * depois de enviar, na página pública. Quatro cartões com o percentual (o
 * predominante em destaque), a distribuição, o radar e a frase do fator
 * predominante. O resultado vale só nesta tela; "Salvar em PDF" usa a
 * impressão do navegador.
 */
import type { ReactNode } from "react";
import { Button } from "../../../../components/Button";
import { FATOR, FATORES, corDoFator } from "./fatores";
import { BarrasDisc, LetraDoFator, RadarDisc } from "./graficosDisc";
import type { PerfilLocal } from "./perfilLocal";
import "./Disc.css";

export function ResultadoPublicoDisc({
  perfil,
  previa,
  titulo,
}: {
  readonly perfil: PerfilLocal;
  readonly previa: boolean;
  /** O título da tela (recebe o foco). */
  readonly titulo: ReactNode;
}) {
  const p = perfil.percentuais;
  const principal = FATOR[perfil.predominante];
  return (
    <div className="disc-publico">
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
          : "Confira abaixo o seu perfil comportamental."}
      </p>
      <ul
        className="disc-publico__cartoes"
        aria-label="Seu resultado por fator"
      >
        {FATORES.map((f) => (
          <li
            key={f}
            className="disc-publico__cartao"
            style={{ ["--cor-do-fator" as string]: corDoFator(f) }}
            {...(f === perfil.predominante ? { "data-predominante": "" } : {})}
          >
            {f === perfil.predominante ? (
              <span className="disc-publico__etiqueta">Predominante</span>
            ) : null}
            <LetraDoFator fator={f} />
            <strong>{`${p[f]}%`}</strong>
            <span>{FATOR[f].nome}</span>
          </li>
        ))}
      </ul>
      <div className="disc-publico__graficos">
        <section aria-label="Distribuição">
          <h2 className="disc__subtitulo">Distribuição</h2>
          <BarrasDisc percentuais={p} rotulo="Distribuição dos fatores" />
        </section>
        <section aria-label="Mapa comportamental">
          <h2 className="disc__subtitulo">Mapa comportamental</h2>
          <RadarDisc percentuais={p} rotulo="Mapa comportamental" />
        </section>
      </div>
      <div className="disc__destaque">
        <LetraDoFator fator={perfil.predominante} tamanho="lg" />
        <div>
          <p className="disc__destaque-titulo">{`Perfil predominante: ${principal.nome}`}</p>
          <p>{principal.frase}</p>
        </div>
      </div>
      <p className="disc-publico__aviso" role="note">
        Este resultado aparece só agora. Ao fechar a página, ele não pode ser
        aberto de novo — salve em PDF se quiser guardar.
      </p>
      <div className="disc-publico__acoes">
        <Button variant="secondary" onClick={() => window.print()}>
          Salvar em PDF
        </Button>
      </div>
    </div>
  );
}
