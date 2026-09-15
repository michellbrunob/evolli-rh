/**
 * Cadastros (T073) — wrapper de navegação local entre "Horários" (padrão,
 * T043), "Estrutura organizacional" (T073), "Calendário de feriados" (T076),
 * "Políticas de Banco de Horas" (T078), "Funções e cargos" (T080),
 * "Motivos de ausência e justificativas" (T081), "Centros de custo" (T083),
 * "Tipos de documento" (T084), "Motivos de desligamento" (T085),
 * "Escolaridade" (T086) e "Cidades e localidades" (T087).
 *
 * A troca de aba é feita só por estado React local (`useState`) — sem React
 * Router, sem rota real, sem API/fetch. A cada vez que o destino "Cadastros"
 * é selecionado no shell, este componente remonta e volta ao padrão
 * "Horários" (mesmo princípio do "Ponto" — T063 — do "Documentos" — T070 —
 * e do "Pessoas" — T072). Como só a aba ativa é renderizada por vez, existe
 * sempre exatamente um `h1` na página — cada tela (`CadastroHorariosScreen`,
 * `EstruturaOrganizacionalScreen`, `CalendarioFeriadosScreen`,
 * `PoliticasBancoHorasScreen`, `FuncoesCargosScreen`,
 * `MotivosAusenciaJustificativasScreen`, `CentrosCustoScreen`,
 * `TiposDocumentoScreen`, `MotivosDesligamentoScreen`, `EscolaridadeScreen`,
 * `CidadesLocalidadesScreen`) já traz o seu próprio.
 *
 * As abas usam o padrão ARIA de abas (`role="tablist"`/`role="tab"` +
 * `aria-selected`), distinto do `aria-current` do `PainelNavigation` (que
 * marca um destino de navegação, não uma aba de conteúdo). O item ativo nunca
 * depende só de cor: soma `aria-selected`, peso de fonte e uma barra inferior
 * sólida (mesmo princípio do `PainelNavigation`/`StatusBadge`).
 */
import { useEffect, useState } from "react";
import {
  CadastroHorariosScreen,
  HORARIOS_TITULO_ID,
} from "./CadastroHorariosScreen";
import {
  CALENDARIO_FERIADOS_TITULO_ID,
  CalendarioFeriadosScreen,
} from "./CalendarioFeriadosScreen";
import {
  CENTROS_CUSTO_TITULO_ID,
  CentrosCustoScreen,
} from "./CentrosCustoScreen";
import {
  CIDADES_LOCALIDADES_TITULO_ID,
  CidadesLocalidadesScreen,
} from "./CidadesLocalidadesScreen";
import {
  ESCOLARIDADE_TITULO_ID,
  EscolaridadeScreen,
} from "./EscolaridadeScreen";
import {
  ESTRUTURA_ORGANIZACIONAL_TITULO_ID,
  EstruturaOrganizacionalScreen,
} from "./EstruturaOrganizacionalScreen";
import {
  FUNCOES_CARGOS_TITULO_ID,
  FuncoesCargosScreen,
} from "./FuncoesCargosScreen";
import {
  MOTIVOS_AUSENCIA_JUSTIFICATIVAS_TITULO_ID,
  MotivosAusenciaJustificativasScreen,
} from "./MotivosAusenciaJustificativasScreen";
import {
  MOTIVOS_DESLIGAMENTO_TITULO_ID,
  MotivosDesligamentoScreen,
} from "./MotivosDesligamentoScreen";
import {
  POLITICAS_BANCO_HORAS_TITULO_ID,
  PoliticasBancoHorasScreen,
} from "./PoliticasBancoHorasScreen";
import {
  TIPOS_DOCUMENTO_TITULO_ID,
  TiposDocumentoScreen,
} from "./TiposDocumentoScreen";
import "./CadastrosScreen.css";

export { HORARIOS_TITULO_ID };

type AbaCadastros =
  | "horarios"
  | "estrutura"
  | "feriados"
  | "politicas_bh"
  | "funcoes_cargos"
  | "motivos_ausencia_justificativas"
  | "centros_custo"
  | "tipos_documento"
  | "motivos_desligamento"
  | "escolaridade"
  | "cidades_localidades";

interface AbaDefinicao {
  readonly id: AbaCadastros;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "horarios",
    rotulo: "Horários",
    tituloId: HORARIOS_TITULO_ID,
  },
  {
    id: "estrutura",
    rotulo: "Estrutura organizacional",
    tituloId: ESTRUTURA_ORGANIZACIONAL_TITULO_ID,
  },
  {
    id: "feriados",
    rotulo: "Calendário de feriados",
    tituloId: CALENDARIO_FERIADOS_TITULO_ID,
  },
  {
    id: "politicas_bh",
    rotulo: "Políticas de Banco de Horas",
    tituloId: POLITICAS_BANCO_HORAS_TITULO_ID,
  },
  {
    id: "funcoes_cargos",
    rotulo: "Funções e cargos",
    tituloId: FUNCOES_CARGOS_TITULO_ID,
  },
  {
    id: "motivos_ausencia_justificativas",
    rotulo: "Motivos de ausência e justificativas",
    tituloId: MOTIVOS_AUSENCIA_JUSTIFICATIVAS_TITULO_ID,
  },
  {
    id: "centros_custo",
    rotulo: "Centros de custo",
    tituloId: CENTROS_CUSTO_TITULO_ID,
  },
  {
    id: "tipos_documento",
    rotulo: "Tipos de documento",
    tituloId: TIPOS_DOCUMENTO_TITULO_ID,
  },
  {
    id: "motivos_desligamento",
    rotulo: "Motivos de desligamento",
    tituloId: MOTIVOS_DESLIGAMENTO_TITULO_ID,
  },
  {
    id: "escolaridade",
    rotulo: "Escolaridade",
    tituloId: ESCOLARIDADE_TITULO_ID,
  },
  {
    id: "cidades_localidades",
    rotulo: "Cidades e localidades",
    tituloId: CIDADES_LOCALIDADES_TITULO_ID,
  },
];

export interface CadastrosScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function CadastrosScreen({ onTituloIdChange }: CadastrosScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaCadastros>("horarios");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="cadastros-screen">
      <div
        role="tablist"
        aria-label="Seções de Cadastros"
        className="cadastros-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`cadastros-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`cadastros-panel-${aba.id}`}
              className={
                selecionada
                  ? "cadastros-screen__tab cadastros-screen__tab--ativa"
                  : "cadastros-screen__tab"
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
        id={`cadastros-panel-${definicaoAtiva.id}`}
        aria-labelledby={`cadastros-tab-${definicaoAtiva.id}`}
        className="cadastros-screen__panel"
      >
        {abaAtiva === "horarios" ? (
          <CadastroHorariosScreen />
        ) : abaAtiva === "estrutura" ? (
          <EstruturaOrganizacionalScreen />
        ) : abaAtiva === "feriados" ? (
          <CalendarioFeriadosScreen />
        ) : abaAtiva === "politicas_bh" ? (
          <PoliticasBancoHorasScreen />
        ) : abaAtiva === "funcoes_cargos" ? (
          <FuncoesCargosScreen />
        ) : abaAtiva === "motivos_ausencia_justificativas" ? (
          <MotivosAusenciaJustificativasScreen />
        ) : abaAtiva === "centros_custo" ? (
          <CentrosCustoScreen />
        ) : abaAtiva === "tipos_documento" ? (
          <TiposDocumentoScreen />
        ) : abaAtiva === "motivos_desligamento" ? (
          <MotivosDesligamentoScreen />
        ) : abaAtiva === "escolaridade" ? (
          <EscolaridadeScreen />
        ) : (
          <CidadesLocalidadesScreen />
        )}
      </div>
    </div>
  );
}
