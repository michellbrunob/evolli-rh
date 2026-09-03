/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Os sete
 * destinos já têm tela própria: "Início" (Visão geral, T048), "Cadastros"
 * (Horários por padrão + "Estrutura organizacional" por aba local,
 * T043/T073), "Pessoas" (Colaboradores por padrão + "Horário de trabalho"
 * por aba local, T046/T072), "Ponto" (Visão do período por padrão +
 * Verificar folhas por aba local, T045/T063), "Documentos" (Metadados por
 * padrão + "Repositório documental" por aba local, T047/T070), "Portal do
 * Colaborador" (Visão geral por padrão + demais abas locais, T067 — prévia de
 * interface, sem login real) e "Solicitações" (Central do RH, T068 — fila de
 * revisão demonstrativa). Os atalhos da Visão geral também trocam apenas esse
 * mesmo estado local (`onNavegar` = `setDestinoAtivoId`). Sem autenticação,
 * sessão ou dado real. A presença deste shell não concede nem implica
 * autorização: a tela renderizada continua dependendo da decisão do servidor
 * por papel, escopo e objeto (docs/modules/painel-administrativo-web-v1.md,
 * §3.6).
 *
 * `ModuloEmPreparacao` permanece importado como retorno defensivo de
 * `conteudoDoDestino` para qualquer destino fora da lista conhecida — hoje
 * inalcançável, já que todos os itens de `DESTINOS_PAINEL` têm tela própria.
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado
 * aqui: não há login nem sessão nesta fundação.
 *
 * "Cadastros", "Pessoas", "Ponto", "Documentos" e "Portal do Colaborador" são
 * os destinos cujo `h1` pode mudar sem trocar de destino (cada um troca de
 * aba local entre telas com `h1` próprio).
 * `CadastrosScreen`/`PessoasScreen`/`PontoScreen`/`DocumentosScreen`/`PortalColaboradorScreen`
 * reportam o `titleId` do `h1` visível via `onTituloIdChange`, guardado em
 * `cadastrosTituloId`/`pessoasTituloId`/`pontoTituloId`/`documentosTituloId`/`portalTituloId`
 * — os demais destinos continuam usando o mapa estático `TITULO_ID_POR_DESTINO`.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import {
  DOCUMENTOS_METADADOS_TITULO_ID,
  DocumentosScreen,
} from "../screens/documentos";
import { CadastrosScreen, HORARIOS_TITULO_ID } from "../screens/horarios";
import { InicioVisaoGeralScreen } from "../screens/inicio";
import { COLABORADORES_TITULO_ID, PessoasScreen } from "../screens/pessoas";
import { PontoScreen } from "../screens/ponto/PontoScreen";
import { VISAO_PERIODO_TITULO_ID } from "../screens/ponto/VisaoPeriodoScreen";
import { PortalColaboradorScreen } from "../screens/portal-colaborador/PortalColaboradorScreen";
import { VISAO_GERAL_PORTAL_TITULO_ID } from "../screens/portal-colaborador/VisaoGeralPortalScreen";
import { CentralSolicitacoesRHScreen } from "../screens/solicitacoes-rh/CentralSolicitacoesRHScreen";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`.
 * "cadastros", "pessoas", "ponto", "documentos" e "portal-colaborador" não
 * aparecem aqui: seus `titleId` são dinâmicos (ver
 * `cadastrosTituloId`/`pessoasTituloId`/`pontoTituloId`/`documentosTituloId`/`portalTituloId`).
 * "solicitacoes-rh" tem tela única, sem aba local, então usa o mapa estático
 * normalmente. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  inicio: "inicio-visao-geral-titulo",
  "solicitacoes-rh": "central-solicitacoes-rh-titulo",
};

function conteudoDoDestino(
  destinoId: string,
  onNavegar: (destinoId: string) => void,
  onCadastrosTituloIdChange: (tituloId: string) => void,
  onPessoasTituloIdChange: (tituloId: string) => void,
  onPontoTituloIdChange: (tituloId: string) => void,
  onDocumentosTituloIdChange: (tituloId: string) => void,
  onPortalTituloIdChange: (tituloId: string) => void,
) {
  if (destinoId === "inicio") {
    return <InicioVisaoGeralScreen onNavegar={onNavegar} />;
  }
  if (destinoId === "cadastros") {
    return <CadastrosScreen onTituloIdChange={onCadastrosTituloIdChange} />;
  }
  if (destinoId === "pessoas") {
    return <PessoasScreen onTituloIdChange={onPessoasTituloIdChange} />;
  }
  if (destinoId === "ponto") {
    return <PontoScreen onTituloIdChange={onPontoTituloIdChange} />;
  }
  if (destinoId === "documentos") {
    return <DocumentosScreen onTituloIdChange={onDocumentosTituloIdChange} />;
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
  // "Cadastros", "Pessoas", "Ponto", "Documentos" e "Portal do Colaborador"
  // sempre voltam à aba padrão ao serem selecionados (o wrapper de cada um
  // remonta e reseta sua aba interna) — por isso o valor inicial já é o
  // `titleId` dessa aba padrão.
  const [cadastrosTituloId, setCadastrosTituloId] =
    useState(HORARIOS_TITULO_ID);
  const [pessoasTituloId, setPessoasTituloId] = useState(
    COLABORADORES_TITULO_ID,
  );
  const [pontoTituloId, setPontoTituloId] = useState(VISAO_PERIODO_TITULO_ID);
  const [documentosTituloId, setDocumentosTituloId] = useState(
    DOCUMENTOS_METADADOS_TITULO_ID,
  );
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
            destinoAtivoId === "cadastros"
              ? cadastrosTituloId
              : destinoAtivoId === "pessoas"
                ? pessoasTituloId
                : destinoAtivoId === "ponto"
                  ? pontoTituloId
                  : destinoAtivoId === "documentos"
                    ? documentosTituloId
                    : destinoAtivoId === "portal-colaborador"
                      ? portalTituloId
                      : (TITULO_ID_POR_DESTINO[destinoAtivoId] ??
                        "modulo-titulo")
          }
        >
          {conteudoDoDestino(
            destinoAtivoId,
            setDestinoAtivoId,
            setCadastrosTituloId,
            setPessoasTituloId,
            setPontoTituloId,
            setDocumentosTituloId,
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
