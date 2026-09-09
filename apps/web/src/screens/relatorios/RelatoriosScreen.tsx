/**
 * Relatórios (T075) — wrapper de navegação local entre "Exceções de Ponto"
 * (padrão) e "Relatórios disponíveis".
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino
 * "Relatórios" é selecionado no shell, este componente remonta e volta ao
 * padrão "Exceções de Ponto" (mesmo princípio do "Ponto" — T063 — do
 * "Documentos" — T070 — do "Pessoas" — T072 — e do "Cadastros" — T073).
 * Como só a aba ativa é renderizada por vez, existe sempre exatamente um
 * `h1` na página — cada tela (`ExcecoesPontoScreen`,
 * `RelatoriosDisponiveisScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useState } from "react";
import {
  EXCECOES_PONTO_TITULO_ID,
  ExcecoesPontoScreen,
} from "./ExcecoesPontoScreen";
import {
  RELATORIOS_DISPONIVEIS_TITULO_ID,
  RelatoriosDisponiveisScreen,
} from "./RelatoriosDisponiveisScreen";
import "./RelatoriosScreen.css";

type AbaRelatorios = "excecoes" | "disponiveis";

interface AbaDefinicao {
  readonly id: AbaRelatorios;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "excecoes",
    rotulo: "Exceções de Ponto",
    tituloId: EXCECOES_PONTO_TITULO_ID,
  },
  {
    id: "disponiveis",
    rotulo: "Relatórios disponíveis",
    tituloId: RELATORIOS_DISPONIVEIS_TITULO_ID,
  },
];

export interface RelatoriosScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function RelatoriosScreen({ onTituloIdChange }: RelatoriosScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorios>("excecoes");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="relatorios-screen">
      <div
        role="tablist"
        aria-label="Seções de Relatórios"
        className="relatorios-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`relatorios-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`relatorios-panel-${aba.id}`}
              className={
                selecionada
                  ? "relatorios-screen__tab relatorios-screen__tab--ativa"
                  : "relatorios-screen__tab"
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
        id={`relatorios-panel-${definicaoAtiva.id}`}
        aria-labelledby={`relatorios-tab-${definicaoAtiva.id}`}
        className="relatorios-screen__panel"
      >
        {abaAtiva === "excecoes" ? (
          <ExcecoesPontoScreen />
        ) : (
          <RelatoriosDisponiveisScreen />
        )}
      </div>
    </div>
  );
}
