/**
 * Ponto (T063) — wrapper de navegação local entre "Visão do período" (padrão),
 * "Verificar folhas" (T045), "Banco de Horas" (T069), "Ajustes manuais"
 * (T077), "Fechamento e Espelho" (T079), "Escalas e jornadas" (T095),
 * "Inconsistências" (T096) e "Justificativas" (T097).
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino "Ponto" é
 * selecionado no shell, este componente remonta e volta ao padrão "Visão do
 * período" (T063 requisito 1). Como só a aba ativa é renderizada por vez,
 * existe sempre exatamente um `h1` na página — cada tela (`VisaoPeriodoScreen`,
 * `VerificarFolhasScreen`, `BancoHorasScreen`, `AjustesManuaisScreen`,
 * `FechamentoEspelhoScreen`, `EscalasJornadasScreen`, `InconsistenciasScreen`,
 * `JustificativasScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useState } from "react";
import {
  VISAO_PERIODO_TITULO_ID,
  VisaoPeriodoScreen,
} from "./VisaoPeriodoScreen";
import { VerificarFolhasScreen } from "./VerificarFolhasScreen";
import { BANCO_HORAS_TITULO_ID, BancoHorasScreen } from "./BancoHorasScreen";
import {
  AJUSTES_MANUAIS_TITULO_ID,
  AjustesManuaisScreen,
} from "./AjustesManuaisScreen";
import {
  FECHAMENTO_ESPELHO_TITULO_ID,
  FechamentoEspelhoScreen,
} from "./FechamentoEspelhoScreen";
import {
  ESCALAS_JORNADAS_TITULO_ID,
  EscalasJornadasScreen,
} from "./EscalasJornadasScreen";
import {
  INCONSISTENCIAS_TITULO_ID,
  InconsistenciasScreen,
} from "./InconsistenciasScreen";
import {
  JUSTIFICATIVAS_TITULO_ID,
  JustificativasScreen,
} from "./JustificativasScreen";
import "./PontoScreen.css";

export const VERIFICAR_FOLHAS_TITULO_ID = "verificar-folhas-titulo";

type AbaPonto =
  | "periodo"
  | "verificar_folhas"
  | "banco_horas"
  | "ajustes_manuais"
  | "fechamento_espelho"
  | "escalas_jornadas"
  | "inconsistencias"
  | "justificativas";

interface AbaDefinicao {
  readonly id: AbaPonto;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "periodo",
    rotulo: "Visão do período",
    tituloId: VISAO_PERIODO_TITULO_ID,
  },
  {
    id: "verificar_folhas",
    rotulo: "Verificar folhas",
    tituloId: VERIFICAR_FOLHAS_TITULO_ID,
  },
  {
    id: "banco_horas",
    rotulo: "Banco de Horas",
    tituloId: BANCO_HORAS_TITULO_ID,
  },
  {
    id: "ajustes_manuais",
    rotulo: "Ajustes manuais",
    tituloId: AJUSTES_MANUAIS_TITULO_ID,
  },
  {
    id: "fechamento_espelho",
    rotulo: "Fechamento e Espelho",
    tituloId: FECHAMENTO_ESPELHO_TITULO_ID,
  },
  {
    id: "escalas_jornadas",
    rotulo: "Escalas e jornadas",
    tituloId: ESCALAS_JORNADAS_TITULO_ID,
  },
  {
    id: "inconsistencias",
    rotulo: "Inconsistências",
    tituloId: INCONSISTENCIAS_TITULO_ID,
  },
  {
    id: "justificativas",
    rotulo: "Justificativas",
    tituloId: JUSTIFICATIVAS_TITULO_ID,
  },
];

export interface PontoScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function PontoScreen({ onTituloIdChange }: PontoScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaPonto>("periodo");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="ponto-screen">
      <div
        role="tablist"
        aria-label="Seções de Ponto"
        className="ponto-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`ponto-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`ponto-panel-${aba.id}`}
              className={
                selecionada
                  ? "ponto-screen__tab ponto-screen__tab--ativa"
                  : "ponto-screen__tab"
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
        id={`ponto-panel-${definicaoAtiva.id}`}
        aria-labelledby={`ponto-tab-${definicaoAtiva.id}`}
        className="ponto-screen__panel"
      >
        {abaAtiva === "periodo" ? (
          <VisaoPeriodoScreen />
        ) : abaAtiva === "verificar_folhas" ? (
          <VerificarFolhasScreen />
        ) : abaAtiva === "banco_horas" ? (
          <BancoHorasScreen />
        ) : abaAtiva === "ajustes_manuais" ? (
          <AjustesManuaisScreen />
        ) : abaAtiva === "fechamento_espelho" ? (
          <FechamentoEspelhoScreen />
        ) : abaAtiva === "escalas_jornadas" ? (
          <EscalasJornadasScreen />
        ) : abaAtiva === "inconsistencias" ? (
          <InconsistenciasScreen />
        ) : (
          <JustificativasScreen />
        )}
      </div>
    </div>
  );
}
