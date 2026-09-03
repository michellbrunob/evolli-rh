/**
 * Pessoas (T072) — wrapper de navegação local entre "Colaboradores" (padrão,
 * T072) e "Horário de trabalho" (T046).
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino "Pessoas"
 * é selecionado no shell, este componente remonta e volta ao padrão
 * "Colaboradores" (mesmo princípio do "Ponto" — T063 — do "Documentos" —
 * T070 — e do "Portal do Colaborador" — T067). Como só a aba ativa é
 * renderizada por vez, existe sempre exatamente um `h1` na página — cada
 * tela (`ColaboradoresScreen`, `PessoasHorarioScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useState } from "react";
import {
  COLABORADORES_TITULO_ID,
  ColaboradoresScreen,
} from "./ColaboradoresScreen";
import { PessoasHorarioScreen } from "./PessoasHorarioScreen";
import "./PessoasScreen.css";

export const PESSOAS_HORARIO_TITULO_ID = "pessoas-horario-titulo";

type AbaPessoas = "colaboradores" | "horario";

interface AbaDefinicao {
  readonly id: AbaPessoas;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "colaboradores",
    rotulo: "Colaboradores",
    tituloId: COLABORADORES_TITULO_ID,
  },
  {
    id: "horario",
    rotulo: "Horário de trabalho",
    tituloId: PESSOAS_HORARIO_TITULO_ID,
  },
];

export interface PessoasScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function PessoasScreen({ onTituloIdChange }: PessoasScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaPessoas>("colaboradores");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="pessoas-screen">
      <div
        role="tablist"
        aria-label="Seções de Pessoas"
        className="pessoas-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`pessoas-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`pessoas-panel-${aba.id}`}
              className={
                selecionada
                  ? "pessoas-screen__tab pessoas-screen__tab--ativa"
                  : "pessoas-screen__tab"
              }
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`pessoas-panel-${definicaoAtiva.id}`}
        aria-labelledby={`pessoas-tab-${definicaoAtiva.id}`}
        className="pessoas-screen__panel"
      >
        {abaAtiva === "colaboradores" ? (
          <ColaboradoresScreen />
        ) : (
          <PessoasHorarioScreen />
        )}
      </div>
    </div>
  );
}
