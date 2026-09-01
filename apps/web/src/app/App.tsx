/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Os sete
 * destinos já têm tela própria: "Início" (Visão geral, T048), "Cadastros"
 * (Horários, T043), "Pessoas" (Horário de trabalho, T046), "Ponto" (Visão do
 * período por padrão + Verificar folhas por aba local, T045/T063),
 * "Documentos" (Metadados, T047), "Portal do Colaborador" (Visão geral por
 * padrão + demais abas locais, T067 — prévia de interface, sem login real) e
 * "Solicitações" (Central do RH, T068 — fila de revisão demonstrativa). Os
 * atalhos da Visão geral também trocam apenas esse mesmo estado local
 * (`onNavegar` = `setDestinoAtivoId`). Sem autenticação, sessão ou dado real.
 * A presença deste shell não concede nem implica autorização: a tela
 * renderizada continua dependendo da decisão do servidor por papel, escopo e
 * objeto (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * `ModuloEmPreparacao` permanece importado como retorno defensivo de
 * `conteudoDoDestino` para qualquer destino fora da lista conhecida — hoje
 * inalcançável, já que todos os itens de `DESTINOS_PAINEL` têm tela própria.
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 *
 * "Ponto" e "Portal do Colaborador" são os destinos cujo `h1` pode mudar sem
 * trocar de destino (cada um troca de aba local entre telas com `h1` próprio).
 * `PontoScreen`/`PortalColaboradorScreen` reportam o `titleId` do `h1` visível
 * via `onTituloIdChange`, guardado em `pontoTituloId`/`portalTituloId` — os
 * demais destinos continuam usando o mapa estático `TITULO_ID_POR_DESTINO`.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { DocumentosMetadadosScreen } from "../screens/documentos";
import { CadastroHorariosScreen } from "../screens/horarios";
import { InicioVisaoGeralScreen } from "../screens/inicio";
import { PessoasHorarioScreen } from "../screens/pessoas";
import { PontoScreen } from "../screens/ponto/PontoScreen";
import { VISAO_PERIODO_TITULO_ID } from "../screens/ponto/VisaoPeriodoScreen";
import { PortalColaboradorScreen } from "../screens/portal-colaborador/PortalColaboradorScreen";
import { VISAO_GERAL_PORTAL_TITULO_ID } from "../screens/portal-colaborador/VisaoGeralPortalScreen";
import { CentralSolicitacoesRHScreen } from "../screens/solicitacoes-rh/CentralSolicitacoesRHScreen";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`.
 * "ponto" e "portal-colaborador" não aparecem aqui: seus `titleId` são
 * dinâmicos (ver `pontoTituloId`/`portalTituloId`). "solicitacoes-rh" tem
 * tela única, sem aba local, então usa o mapa estático normalmente. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  inicio: "inicio-visao-geral-titulo",
  cadastros: "horarios-titulo",
  pessoas: "pessoas-horario-titulo",
  documentos: "documentos-metadados-titulo",
  "solicitacoes-rh": "central-solicitacoes-rh-titulo",
};

function conteudoDoDestino(
  destinoId: string,
  onNavegar: (destinoId: string) => void,
  onPontoTituloIdChange: (tituloId: string) => void,
  onPortalTituloIdChange: (tituloId: string) => void,
) {
  if (destinoId === "inicio") {
    return <InicioVisaoGeralScreen onNavegar={onNavegar} />;
  }
  if (destinoId === "cadastros") {
    return <CadastroHorariosScreen />;
  }
  if (destinoId === "pessoas") {
    return <PessoasHorarioScreen />;
  }
  if (destinoId === "ponto") {
    return <PontoScreen onTituloIdChange={onPontoTituloIdChange} />;
  }
  if (destinoId === "documentos") {
    return <DocumentosMetadadosScreen />;
  }
  if (destinoId === "portal-colaborador") {
    return (
      <PortalColaboradorScreen onTituloIdChange={onPortalTituloIdChange} />
    );
  }
  if (destinoId === "solicitacoes-rh") {
    return <CentralSolicitacoesRHScreen />;
  }
  const destino = DESTINOS_PAINEL.find((item) => item.id === destinoId);
  return (
    <ModuloEmPreparacao
      titulo={destino?.label ?? "Módulo"}
      descricao="Este módulo ainda está em preparação."
    />
  );
}

export function App() {
  const [destinoAtivoId, setDestinoAtivoId] = useState("cadastros");
  // "Ponto" e "Portal do Colaborador" sempre voltam à aba padrão ao serem
  // selecionados (o wrapper de cada um remonta e reseta sua aba interna) —
  // por isso o valor inicial já é o `titleId` dessa aba padrão.
  const [pontoTituloId, setPontoTituloId] = useState(VISAO_PERIODO_TITULO_ID);
  const [portalTituloId, setPortalTituloId] = useState(
    VISAO_GERAL_PORTAL_TITULO_ID,
  );

  return (
    <div className="app-shell">
      <a className="app-shell__skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>

      <header className="app-shell__topbar">
        <div className="app-shell__topbar-inner">
          <span className="app-shell__brand">Evolli RH</span>
          <span className="app-shell__brand-tag">Painel Administrativo</span>
        </div>
      </header>

      <div className="app-shell__body">
        <PainelNavigation
          destinoAtivoId={destinoAtivoId}
          onSelecionar={setDestinoAtivoId}
        />

        <main
          id="conteudo-principal"
          className="app-shell__main"
          tabIndex={-1}
          aria-labelledby={
            destinoAtivoId === "ponto"
              ? pontoTituloId
              : destinoAtivoId === "portal-colaborador"
                ? portalTituloId
                : (TITULO_ID_POR_DESTINO[destinoAtivoId] ?? "modulo-titulo")
          }
        >
          {conteudoDoDestino(
            destinoAtivoId,
            setDestinoAtivoId,
            setPontoTituloId,
            setPortalTituloId,
          )}
        </main>
      </div>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <span className="app-shell__footer-brand">Evolli RH</span>
          <span>Painel Administrativo — fundação visual</span>
          <span>Ambiente interno · sem dados reais</span>
        </div>
      </footer>
    </div>
  );
}
