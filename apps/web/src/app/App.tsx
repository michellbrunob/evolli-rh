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
import { useCallback, useEffect, useRef, useState } from "react";
import "./tokens.css";
import "./app-shell.css";
import { ROTULO_PAPEL } from "../api/usersClient";
import { MarcaEvolli } from "./IconeModulo";
import { SessoesAtivasPanel } from "./SessoesAtivasPanel";
import { SegurancaMfaPanel } from "./SegurancaMfaPanel";
import {
  ADMINISTRACAO_LIDERANCA_TITULO_ID,
  AdministracaoLiderancaScreen,
  CONTAS_ACESSO_TITULO_ID,
  ContasAcessoScreen,
} from "../screens/administracao";
import {
  DOCUMENTOS_METADADOS_TITULO_ID,
  DocumentosScreen,
} from "../screens/documentos";
import { EQUIPE_TITULO_ID, EquipeScreen } from "../screens/equipe";
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
import { PainelNavigation } from "./PainelNavigation";
import { destinoInicialPara, destinoPorId } from "./mapaNavegacao";

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
  equipe: EQUIPE_TITULO_ID,
  "administracao-lideranca": ADMINISTRACAO_LIDERANCA_TITULO_ID,
};

/**
 * Seletor de elemento focável, para prender o foco dentro da gaveta no
 * mobile. Igual ao do `Modal` (UI-F04) de propósito: duas definições
 * diferentes de "focável" no mesmo produto divergiriam na primeira exceção.
 */
const FOCAVEIS_GAVETA =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ícone do botão da gaveta. Três traços — desenho próprio, elementar, sem
 * conjunto de terceiro (ver `docs/decisions/t159-direcao-visual-navegacao.md`).
 * `aria-hidden` porque o botão já se chama "Menu" em texto.
 */
function IconeMenu() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
    </svg>
  );
}

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
  if (destinoId === "cadastros-demonstracao") {
    return (
      <CadastrosScreen
        modo="demonstrativo"
        onTituloIdChange={onCadastrosTituloIdChange}
      />
    );
  }
  if (destinoId === "pessoas") {
    return <PessoasScreen onTituloIdChange={onPessoasTituloIdChange} />;
  }
  // T159 — os destinos `*-demonstracao` reusam o MESMO contêiner, em modo
  // demonstrativo. Nenhuma tela foi duplicada: o que muda é qual subconjunto
  // de abas o contêiner lista.
  if (destinoId === "pessoas-demonstracao") {
    return (
      <PessoasScreen
        modo="demonstrativo"
        onTituloIdChange={onPessoasTituloIdChange}
      />
    );
  }
  if (destinoId === "ponto") {
    return <PontoScreen onTituloIdChange={onPontoTituloIdChange} />;
  }
  if (destinoId === "ponto-demonstracao") {
    return (
      <PontoScreen
        modo="demonstrativo"
        onTituloIdChange={onPontoTituloIdChange}
      />
    );
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
  if (destinoId === "equipe") {
    return <EquipeScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />;
  }
  if (destinoId === "administracao-lideranca") {
    return (
      <AdministracaoLiderancaScreen
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />
    );
  }
  const destino = destinoPorId(destinoId);
  return (
    <ModuloEmPreparacao
      titulo={destino?.label ?? "Módulo"}
      descricao="Este módulo ainda está em preparação."
    />
  );
}

/**
 * Destino em que cada papel ATERRISSA. Não é autorização, e a distinção é a
 * coisa mais importante deste arquivo: este mapa não concede nem nega nada.
 * O RBAC decide cada requisição no servidor, e a `EquipeScreen` reverifica o
 * papel por conta própria. Aqui só se escolhe onde a pessoa começa.
 *
 * Por que existe (T153): o `gestor` caía em "Cadastros", cuja tela dispara
 * `GET /v1/horarios` — capacidade que ele não tem. O resultado medido era
 * 403 na aterrissagem e uma tela "Somente RH" como primeira impressão do
 * produto, justamente na tarefa que lhe dá a primeira capacidade real.
 *
 * Só `gestor` entra aqui. Todos os demais papéis continuam em "cadastros",
 * byte por byte como antes — esta correção não move `rh`, `dp`,
 * `colaborador` nem `master_tecnico`.
 */
/**
 * Resolve o destino inicial a partir do papel JÁ conhecido.
 *
 * Síncrono de propósito: é usado como inicializador de `useState`, não como
 * efeito. Corrigir o destino depois da montagem produziria exatamente o que
 * esta regra elimina — o flash da tela errada e a requisição que ela dispara
 * antes de ser trocada.
 *
 * T159: a tabela mudou de lugar, não de natureza. Mora em `mapaNavegacao.ts`,
 * junto dos destinos, e deixou de ser uma exceção só para `gestor`: cada papel
 * aterrissa onde o RBAC lhe concede a primeira requisição, e quem não tem
 * capacidade funcional nenhuma cai em `inicio`, que não chama nada. Antes
 * disso, seis papéis abriam o produto num 403.
 */
export { destinoInicialPara };

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
  /**
   * T131 — disponibilidade REAL do MFA, decidida pelo servidor e repassada pelo
   * `AutenticacaoApp` (via `GET /v1/users/me`). Controla se o botão/painel
   * "Segurança" (cadastro de 2º fator) aparece. Padrão `false` (seguro): sem
   * confirmação do servidor, a UI de MFA fica oculta — nunca uma flag de
   * frontend liga o recurso. O servidor continua autoritativo (rotas de MFA
   * respondem 404 quando desativado).
   */
  mfaDisponivel?: boolean;
  /**
   * T153 — papel do ator, decidido pelo SERVIDOR e repassado pelo
   * `AutenticacaoApp` (via `GET /v1/users/me`, a mesma leitura que já traz
   * `mfaAvailable`). Serve só para decidir se o destino "Minha equipe"
   * aparece na navegação. Padrão `null` (seguro): sem confirmação do
   * servidor, o destino fica oculto.
   *
   * Não é autorização — a `EquipeScreen` refaz a verificação por conta
   * própria e o RBAC continua sendo a única fronteira real.
   */
  papelDoAtor?: string | null;
}

export function App({
  onLogout,
  onSessaoAtualEncerrada,
  mfaDisponivel = false,
  papelDoAtor = null,
}: AppProps = {}) {
  // Inicialização SÍNCRONA com o papel já resolvido. O `AutenticacaoApp` só
  // monta este componente depois de `GET /v1/users/me` concluir com sucesso,
  // então `papelDoAtor` já é conhecido no primeiro render: não há destino
  // intermediário, não há efeito de correção e, portanto, não há como a tela
  // errada montar e disparar a requisição dela.
  //
  // Nunca é recalculado depois: quem navegou escolheu, e sobrescrever a
  // escolha seria um redirecionamento surpresa. Trocar de ator remonta o
  // componente (ver a `key` em `AutenticacaoApp`), e aí o inicializador roda
  // de novo com o papel novo.
  const [destinoAtivoId, setDestinoAtivoId] = useState(() =>
    destinoInicialPara(papelDoAtor),
  );
  const [sessoesAtivasAberto, setSessoesAtivasAberto] = useState(false);
  const [segurancaAberto, setSegurancaAberto] = useState(false);
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

  // Gaveta do mobile. No desktop ela nunca abre: o único botão que a abre é
  // `display: none` acima de 834px, e a barra lateral é permanente.
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const botaoMenuRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // Navegar fecha a gaveta — no desktop isto não tem efeito, porque ela já
  // está fechada. Vale para a barra e para os atalhos da Visão geral.
  const irPara = useCallback((destinoId: string) => {
    setDestinoAtivoId(destinoId);
    setGavetaAberta(false);
  }, []);

  // Foco preso, `Escape` e devolução de foco — mesma disciplina do `Modal`
  // (UI-F04). Enquanto a gaveta está aberta ela é a única região alcançável:
  // deixá-la por cima da página e permitir que o `Tab` fosse para trás seria
  // afirmar uma coisa e permitir outra.
  useEffect(() => {
    if (!gavetaAberta) return;
    const caixa = sidebarRef.current;
    // Capturado agora, e nao na limpeza: na limpeza o ref ja pode apontar
    // para outro no (regra react-hooks/exhaustive-deps).
    const acionador = botaoMenuRef.current;

    function focaveisDaGaveta(): HTMLElement[] {
      if (!caixa) return [];
      return [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS_GAVETA)].filter(
        // `closest` e não `hasAttribute`: o submenu fechado é um `<ul hidden>`
        // e os botões dentro dele não carregam o atributo.
        (elemento) => elemento.closest("[hidden]") === null,
      );
    }

    focaveisDaGaveta()[0]?.focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setGavetaAberta(false);
        return;
      }
      if (evento.key !== "Tab" || !caixa) return;
      const focaveis = focaveisDaGaveta();
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0]!;
      const ultimo = focaveis[focaveis.length - 1]!;
      const atual = document.activeElement;
      if (!caixa.contains(atual)) {
        evento.preventDefault();
        (evento.shiftKey ? ultimo : primeiro).focus();
      } else if (evento.shiftKey && atual === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && atual === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      if (acionador && document.contains(acionador)) acionador.focus();
    };
  }, [gavetaAberta]);

  const rotuloDoPapel = papelDoAtor ? ROTULO_PAPEL[papelDoAtor] : undefined;

  return (
    <div
      className={
        gavetaAberta ? "app-shell app-shell--gaveta-aberta" : "app-shell"
      }
    >
      <a className="app-shell__skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>

      <header className="app-shell__topbar">
        <div className="app-shell__topbar-inner">
          <button
            type="button"
            className="app-shell__menu"
            ref={botaoMenuRef}
            aria-expanded={gavetaAberta}
            aria-controls="navegacao-lateral"
            onClick={() => setGavetaAberta((aberta) => !aberta)}
          >
            <IconeMenu />
            Menu
          </button>

          <span className="app-shell__marca-compacta">
            <MarcaEvolli />
            <span className="app-shell__marca-nome">Evolli RH</span>
          </span>

          <div className="app-shell__acoes">
            {/* Contexto do ator: o papel que o SERVIDOR informou. Nada de
                menu de conta, foto nem nome inventado — só o que existe. */}
            {rotuloDoPapel ? (
              <span className="app-shell__contexto">{rotuloDoPapel}</span>
            ) : null}
            {onLogout && mfaDisponivel ? (
              <button
                type="button"
                className="app-shell__seguranca"
                aria-expanded={segurancaAberto}
                onClick={() => {
                  setSegurancaAberto((aberto) => !aberto);
                  setSessoesAtivasAberto(false);
                }}
              >
                Segurança
              </button>
            ) : null}
            {onLogout ? (
              <button
                type="button"
                className="app-shell__sessoes-ativas"
                aria-expanded={sessoesAtivasAberto}
                onClick={() => {
                  setSessoesAtivasAberto((aberto) => !aberto);
                  setSegurancaAberto(false);
                }}
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
        </div>
      </header>

      {onLogout && mfaDisponivel && segurancaAberto ? (
        <div className="app-shell__sessoes-ativas-wrapper">
          <SegurancaMfaPanel
            aberto={segurancaAberto}
            onFechar={() => setSegurancaAberto(false)}
            onSessaoAtualEncerrada={() => onSessaoAtualEncerrada?.()}
          />
        </div>
      ) : null}

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
        {gavetaAberta ? (
          <button
            type="button"
            className="app-shell__fundo-gaveta"
            aria-label="Fechar menu"
            onClick={() => setGavetaAberta(false)}
          />
        ) : null}

        <div
          className="app-shell__sidebar"
          id="navegacao-lateral"
          ref={sidebarRef}
        >
          <span className="app-shell__marca">
            <MarcaEvolli />
            <span className="app-shell__marca-texto">
              <span className="app-shell__marca-nome">Evolli RH</span>
              <span className="app-shell__marca-tag">
                Painel Administrativo
              </span>
            </span>
          </span>

          {/* T159 — o shell passa o papel e a navegação decide sozinha quais
              destinos condicionados oferecer, lendo os papéis declarados no
              mapa. Antes a lista de capacidades era remontada aqui, longe dos
              destinos, e já havia divergido deles. */}
          <PainelNavigation
            destinoAtivoId={destinoAtivoId}
            onSelecionar={irPara}
            papel={papelDoAtor}
          />
        </div>

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
            irPara,
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
          <span>Ambiente interno · sem dados reais</span>
        </div>
      </footer>
    </div>
  );
}
