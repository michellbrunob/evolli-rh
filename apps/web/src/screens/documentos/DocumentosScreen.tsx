/**
 * Documentos (T070) — wrapper de navegação local entre "Metadados" (padrão,
 * T047) e "Repositório documental" (T070).
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino "Documentos"
 * é selecionado no shell, este componente remonta e volta ao padrão
 * "Metadados" (mesmo princípio do "Ponto" — T063 — e do "Portal do
 * Colaborador" — T067). Como só a aba ativa é renderizada por vez, existe
 * sempre exatamente um `h1` na página — cada tela (`DocumentosMetadadosScreen`,
 * `RepositorioDocumentalScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useState } from "react";
import { DocumentosMetadadosScreen } from "./DocumentosMetadadosScreen";
import {
  REPOSITORIO_DOCUMENTAL_TITULO_ID,
  RepositorioDocumentalScreen,
} from "./RepositorioDocumentalScreen";
import "./DocumentosScreen.css";

export const DOCUMENTOS_METADADOS_TITULO_ID = "documentos-metadados-titulo";

type AbaDocumentos = "metadados" | "repositorio";

interface AbaDefinicao {
  readonly id: AbaDocumentos;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "metadados",
    rotulo: "Metadados",
    tituloId: DOCUMENTOS_METADADOS_TITULO_ID,
  },
  {
    id: "repositorio",
    rotulo: "Repositório documental",
    tituloId: REPOSITORIO_DOCUMENTAL_TITULO_ID,
  },
];

export interface DocumentosScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function DocumentosScreen({ onTituloIdChange }: DocumentosScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaDocumentos>("metadados");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="documentos-screen">
      <div
        role="tablist"
        aria-label="Seções de Documentos"
        className="documentos-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`documentos-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`documentos-panel-${aba.id}`}
              className={
                selecionada
                  ? "documentos-screen__tab documentos-screen__tab--ativa"
                  : "documentos-screen__tab"
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
        id={`documentos-panel-${definicaoAtiva.id}`}
        aria-labelledby={`documentos-tab-${definicaoAtiva.id}`}
        className="documentos-screen__panel"
      >
        {abaAtiva === "metadados" ? (
          <DocumentosMetadadosScreen />
        ) : (
          <RepositorioDocumentalScreen />
        )}
      </div>
    </div>
  );
}
