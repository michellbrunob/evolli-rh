/**
 * Portal do Colaborador — demonstração (T067) — wrapper de navegação local
 * entre "Visão geral" (padrão), "Minhas solicitações", "Minha jornada" e
 * "Meus documentos".
 *
 * É uma **prévia de interface**, não um acesso real de colaborador: sem
 * login, troca de usuário, impersonação ou controle de perfil. A troca de aba
 * é feita só por estado React local (`useState`) — sem React Router, sem rota
 * real, sem API/fetch. Como só a aba ativa é renderizada por vez, existe
 * sempre exatamente um `h1` na página — cada tela já traz o seu próprio.
 *
 * Mesmo padrão ARIA de abas já usado em `PontoScreen`
 * (`role="tablist"`/`role="tab"` + `aria-selected`), distinto do
 * `aria-current` do `PainelNavigation`. O item ativo nunca depende só de cor.
 */
import { useEffect, useState } from "react";
import { StatusBadge, Surface } from "../../components";
import {
  MEUS_DOCUMENTOS_TITULO_ID,
  MeusDocumentosScreen,
} from "./MeusDocumentosScreen";
import {
  MINHA_JORNADA_TITULO_ID,
  MinhaJornadaScreen,
} from "./MinhaJornadaScreen";
import {
  MINHAS_SOLICITACOES_TITULO_ID,
  MinhasSolicitacoesScreen,
} from "./MinhasSolicitacoesScreen";
import {
  VISAO_GERAL_PORTAL_TITULO_ID,
  VisaoGeralPortalScreen,
} from "./VisaoGeralPortalScreen";
import "./PortalColaboradorScreen.css";

export type AbaPortalColaborador =
  "visao_geral" | "solicitacoes" | "jornada" | "documentos";

interface AbaDefinicao {
  readonly id: AbaPortalColaborador;
  readonly rotulo: string;
  readonly tituloId: string;
}

const ABAS: readonly AbaDefinicao[] = [
  {
    id: "visao_geral",
    rotulo: "Visão geral",
    tituloId: VISAO_GERAL_PORTAL_TITULO_ID,
  },
  {
    id: "solicitacoes",
    rotulo: "Minhas solicitações",
    tituloId: MINHAS_SOLICITACOES_TITULO_ID,
  },
  {
    id: "jornada",
    rotulo: "Minha jornada",
    tituloId: MINHA_JORNADA_TITULO_ID,
  },
  {
    id: "documentos",
    rotulo: "Meus documentos",
    tituloId: MEUS_DOCUMENTOS_TITULO_ID,
  },
];

export interface PortalColaboradorScreenProps {
  /** Informa o `id` do `h1` atualmente visível, para o shell rotular o
   * `<main>` (`aria-labelledby`) mesmo quando a aba muda sem trocar de
   * destino. Não é navegação real — só sincroniza o rótulo de acessibilidade. */
  onTituloIdChange?: (tituloId: string) => void;
}

export function PortalColaboradorScreen({
  onTituloIdChange,
}: PortalColaboradorScreenProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaPortalColaborador>("visao_geral");

  const definicaoAtiva = ABAS.find((aba) => aba.id === abaAtiva) ?? ABAS[0]!;

  useEffect(() => {
    onTituloIdChange?.(definicaoAtiva.tituloId);
  }, [definicaoAtiva.tituloId, onTituloIdChange]);

  return (
    <div className="portal-colaborador-screen">
      <Surface
        as="section"
        padding="md"
        className="portal-colaborador-screen__banner"
        aria-labelledby="portal-colaborador-banner-titulo"
      >
        <StatusBadge variant="neutral">
          Portal do Colaborador — demonstração
        </StatusBadge>
        <p
          id="portal-colaborador-banner-titulo"
          className="portal-colaborador-screen__banner-texto"
        >
          Esta é uma prévia de interface do futuro Portal do Colaborador — não é
          um acesso real. Sem login, troca de usuário ou controle de perfil.
        </p>
      </Surface>

      <div
        role="tablist"
        aria-label="Seções do Portal do Colaborador"
        className="portal-colaborador-screen__tabs"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === abaAtiva;
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`portal-tab-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`portal-panel-${aba.id}`}
              className={
                selecionada
                  ? "portal-colaborador-screen__tab portal-colaborador-screen__tab--ativa"
                  : "portal-colaborador-screen__tab"
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
        id={`portal-panel-${definicaoAtiva.id}`}
        aria-labelledby={`portal-tab-${definicaoAtiva.id}`}
        className="portal-colaborador-screen__panel"
      >
        {abaAtiva === "visao_geral" ? (
          <VisaoGeralPortalScreen onNavegarAba={setAbaAtiva} />
        ) : abaAtiva === "solicitacoes" ? (
          <MinhasSolicitacoesScreen />
        ) : abaAtiva === "jornada" ? (
          <MinhaJornadaScreen />
        ) : (
          <MeusDocumentosScreen />
        )}
      </div>
    </div>
  );
}
