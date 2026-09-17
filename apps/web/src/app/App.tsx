/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Os oito
 * destinos já têm tela própria: "Início" (Visão geral, T048), "Cadastros"
 * (Horários por padrão + "Estrutura organizacional" por aba local,
 * T043/T073), "Pessoas" (Colaboradores por padrão + "Horário de trabalho"
 * por aba local, T046/T072), "Ponto" (Visão do período por padrão +
 * Verificar folhas por aba local, T045/T063), "Documentos" (Metadados por
 * padrão + "Repositório documental" por aba local, T047/T070), "Portal do
 * Colaborador" (Visão geral por padrão + demais abas locais, T067 — prévia de
 * interface, sem login real), "Solicitações" (Central do RH, T068 — fila de
 * revisão demonstrativa) e "Relatórios" (Exceções de Ponto por padrão +
 * "Relatórios disponíveis" por aba local, T075). Os atalhos da Visão geral
 * também trocam apenas esse mesmo estado local (`onNavegar` =
 * `setDestinoAtivoId`). Sem dado real. A presença deste shell não concede
 * nem implica autorização: a tela renderizada continua dependendo da
 * decisão do servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * `ModuloEmPreparacao` permanece importado como retorno defensivo de
 * `conteudoDoDestino` para qualquer destino fora da lista conhecida — hoje
 * inalcançável, já que todos os itens de `DESTINOS_PAINEL` têm tela própria.
 *
 * Este componente continua sem saber nada de sessão, login ou CSRF — só
 * recebe, opcionalmente, `onLogout` (T116): quando presente, mostra um botão
 * "Sair" na barra superior; quando ausente (como em todo teste deste
 * arquivo, que renderiza `<App />` sem props), o botão simplesmente não
 * aparece — o shell renderizado é idêntico ao de antes do T116. Quem decide
 * SE este shell deve ou não ser renderizado — a sessão está confirmada ou
 * não — é o `AutenticacaoApp` (`./AutenticacaoApp.tsx`), que envolve este
 * componente e nunca o contrário.
 *
 * T117 soma, pelo mesmo gate de `onLogout`, o botão "Sessões ativas" e o
 * painel `SessoesAtivasPanel` (Minha conta > Sessões ativas). O painel só
 * lista/revoga sessões da própria conta (`GET/DELETE /v1/auth/sessions*`,
 * já existentes) — nunca administra outra pessoa, papel, e-mail ou senha.
 * `onSessaoAtualEncerrada` é chamado quando o próprio painel descobre (por
 * uma releitura que responde 401, nunca por adivinhação) que a sessão desta
 * aba deixou de ser válida; o `AutenticacaoApp` reage limpando o estado em
 * memória e voltando ao login — mesmo caminho do logout explícito.
 *
 * "Cadastros", "Pessoas", "Ponto", "Documentos", "Portal do Colaborador" e
 * "Relatórios" são os destinos cujo `h1` pode mudar sem trocar de destino
 * (cada um troca de aba local entre telas com `h1` próprio).
 * `CadastrosScreen`/`PessoasScreen`/`PontoScreen`/`DocumentosScreen`/`PortalColaboradorScreen`/`RelatoriosScreen`
 * reportam o `titleId` do `h1` visível via `onTituloIdChange`, guardado em
 * `cadastrosTituloId`/`pessoasTituloId`/`pontoTituloId`/`documentosTituloId`/`portalTituloId`/`relatoriosTituloId`
 * — os demais destinos continuam usando o mapa estático `TITULO_ID_POR_DESTINO`.
 */
import { useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { SessoesAtivasPanel } from "./SessoesAtivasPanel";
import {
  CONTAS_ACESSO_TITULO_ID,
  ContasAcessoScreen,
} from "../screens/administracao";
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
import {
  EXCECOES_PONTO_TITULO_ID,
  RelatoriosScreen,
} from "../screens/relatorios";
import { CentralSolicitacoesRHScreen } from "../screens/solicitacoes-rh/CentralSolicitacoesRHScreen";
import { ModuloEmPreparacao } from "./ModuloEmPreparacao";
import { DESTINOS_PAINEL, PainelNavigation } from "./PainelNavigation";

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`.
 * "cadastros", "pessoas", "ponto", "documentos", "portal-colaborador" e
 * "relatorios" não aparecem aqui: seus `titleId` são dinâmicos (ver
 * `cadastrosTituloId`/`pessoasTituloId`/`pontoTituloId`/`documentosTituloId`/`portalTituloId`/`relatoriosTituloId`).
 * "solicitacoes-rh" tem tela única, sem aba local, então usa o mapa estático
 * normalmente. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  inicio: "inicio-visao-geral-titulo",
  "solicitacoes-rh": "central-solicitacoes-rh-titulo",
  "contas-acesso": CONTAS_ACESSO_TITULO_ID,
};

function conteudoDoDestino(
  destinoId: string,
  onNavegar: (destinoId: string) => void,
  onCadastrosTituloIdChange: (tituloId: string) => void,
  onPessoasTituloIdChange: (tituloId: string) => void,
  onPontoTituloIdChange: (tituloId: string) => void,
  onDocumentosTituloIdChange: (tituloId: string) => void,
  onPortalTituloIdChange: (tituloId: string) => void,
  onRelatoriosTituloIdChange: (tituloId: string) => void,
  onSessaoAtualEncerrada: () => void,
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
  if (destinoId === "relatorios") {
    return <RelatoriosScreen onTituloIdChange={onRelatoriosTituloIdChange} />;
  }
  if (destinoId === "contas-acesso") {
    return (
      <ContasAcessoScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />
    );
  }
  const destino = DESTINOS_PAINEL.find((item) => item.id === destinoId);
  return (
    <ModuloEmPreparacao
      titulo={destino?.label ?? "Módulo"}
      descricao="Este módulo ainda está em preparação."
    />
  );
}

export interface AppProps {
  /** Presente só quando há sessão autenticada (ver `AutenticacaoApp`). Sem
   * ele, nenhum botão "Sair" aparece — comportamento idêntico ao de antes
   * do T116. */
  onLogout?: () => void;
  /** T117: chamado quando `SessoesAtivasPanel` descobre que a sessão desta
   * aba deixou de ser válida (foi a sessão revogada, ou já havia expirado).
   * Sem `onLogout`, o botão "Sessões ativas" também não aparece, então esta
   * prop nunca é exercida — mesmo gate das duas capacidades. */
  onSessaoAtualEncerrada?: () => void;
}

export function App({ onLogout, onSessaoAtualEncerrada }: AppProps = {}) {
  const [destinoAtivoId, setDestinoAtivoId] = useState("cadastros");
  const [sessoesAtivasAberto, setSessoesAtivasAberto] = useState(false);
  // "Cadastros", "Pessoas", "Ponto", "Documentos", "Portal do Colaborador" e
  // "Relatórios" sempre voltam à aba padrão ao serem selecionados (o wrapper
  // de cada um remonta e reseta sua aba interna) — por isso o valor inicial
  // já é o `titleId` dessa aba padrão.
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
  const [relatoriosTituloId, setRelatoriosTituloId] = useState(
    EXCECOES_PONTO_TITULO_ID,
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
          {onLogout ? (
            <button
              type="button"
              className="app-shell__sessoes-ativas"
              aria-expanded={sessoesAtivasAberto}
              onClick={() => setSessoesAtivasAberto((aberto) => !aberto)}
            >
              Sessões ativas
            </button>
          ) : null}
          {onLogout ? (
            <button
              type="button"
              className="app-shell__logout"
              onClick={onLogout}
            >
              Sair
            </button>
          ) : null}
        </div>
      </header>

      {onLogout && sessoesAtivasAberto ? (
        <div className="app-shell__sessoes-ativas-wrapper">
          <SessoesAtivasPanel
            aberto={sessoesAtivasAberto}
            onFechar={() => setSessoesAtivasAberto(false)}
            onSessaoAtualEncerrada={() => onSessaoAtualEncerrada?.()}
          />
        </div>
      ) : null}

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
                      : destinoAtivoId === "relatorios"
                        ? relatoriosTituloId
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
            setRelatoriosTituloId,
            () => onSessaoAtualEncerrada?.(),
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
