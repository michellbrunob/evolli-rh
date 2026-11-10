/**
 * Shell do Painel Administrativo Web (UI-F01 + UI-F02 + UI-F03 + navegação
 * visual T044).
 *
 * Envoltório visual neutro (banner, skip-link, navegação, main, rodapé). A
 * navegação (`PainelNavigation`) troca apenas um estado local de "destino
 * selecionado" — sem React Router, sem rota real, sem API/fetch. Os oito
 * destinos já têm tela própria: "Início" (Visão geral, T048), "Cadastros"
 * ("Estrutura organizacional" por padrão + Funções e cargos e Centros de custo
 * por aba local, T073/T182; os Horários viraram o destino próprio "Jornadas
 * de trabalho", T182), "Pessoas" (Colaboradores por padrão + "Horário de trabalho"
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
 *
 * T206 — o menu lateral é uma faixa presa à borda esquerda, da altura da
 * janela, e o cabeçalho, o conteúdo e o rodapé formam a coluna à direita dela.
 * No desktop o menu pode ser recolhido num trilho de ícones (`menuRecolhido`),
 * e a coluna ocupa a largura liberada. Abaixo de 835px nada disso existe: a
 * gaveta do celular continua exatamente como era.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import {
  CadastrosScreen,
  ESTRUTURA_ORGANIZACIONAL_TITULO_ID,
  JORNADAS_TRABALHO_TITULO_ID,
  JornadasTrabalhoScreen,
} from "../screens/horarios";
import { InicioVisaoGeralScreen } from "../screens/inicio";
import {
  DASHBOARD_TITULO_ID,
  DashboardScreen,
} from "../screens/dashboard/DashboardScreen";
import {
  COLABORADORES_TITULO_ID,
  type FocoDoAdmitido,
  NOVA_ADMISSAO_TITULO_ID,
  NovaAdmissaoScreen,
  PessoasScreen,
} from "../screens/pessoas";
import type { ColaboradorApi } from "../api/colaboradoresClient";
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
import { DicaDoTrilho } from "./DicaDoTrilho";
import { ID_NAVEGACAO_PAINEL, PainelNavigation } from "./PainelNavigation";
import {
  SeletorEmpresaAtiva,
  type EmpresaAtivaExibida,
} from "./SeletorEmpresaAtiva";
import type { EmpresaDoContextoApi } from "../api/contextoEmpresarialClient";
import {
  destinoInicialPara,
  destinoPorId,
  capacidadeFuncionalDe,
  fichaParaOPapel,
  podeEditarFicha,
  podeLerSolicitacoesPessoas,
  podeOperarEstrutura,
  podeOperarJornadas,
} from "./mapaNavegacao";
import {
  type AbaDaFicha,
  type EstadoDaListagem,
  type OpcoesDaMudancaDaListagem,
  type RotaDaFicha,
  ESTADO_INICIAL_DA_LISTAGEM,
  destinoDaRota,
  ehFragmentoDeRota,
  competenciaDoMesAtual,
  competenciaValida,
  fichaDaRota,
  listagemDaRota,
  rotaDaFicha,
  rotaDaListagem,
  rotaDoDestino,
  anoCorrente,
  anoDoDashboardValido,
  dashboardDaRota,
  rotaDoDashboard,
} from "./rotasDoShell";
import { AREAS_DE_EDICAO, type AreaDeEdicaoId } from "./edicoesPendentes";
import { focarRegiaoPrincipal, useGuardaDeSaida } from "./guardaDeSaida";

/**
 * T200 — índice próprio de cada entrada do histórico criada pelo shell, em
 * `history.state`. É o que diz quanto o navegador andou num voltar/avançar
 * (`popstate` não diz), para a guarda desfazer e refazer exatamente esse
 * passo — sem entrada nova, sem cair em outra URL.
 */
const CHAVE_DO_INDICE = "evolliIndice";

function indiceDoEstado(estado: unknown): number | null {
  if (typeof estado !== "object" || estado === null) return null;
  const valor = (estado as Record<string, unknown>)[CHAVE_DO_INDICE];
  return typeof valor === "number" && Number.isInteger(valor) ? valor : null;
}

function estadoComIndice(indice: number): Record<string, unknown> {
  const atual = window.history.state;
  return {
    ...(typeof atual === "object" && atual !== null ? atual : {}),
    [CHAVE_DO_INDICE]: indice,
  };
}

/**
 * T200 — anota a URL da entrada de índice `indice` no mapa das entradas que
 * ainda existem. Uma entrada nova (criada logo depois da atual) apaga as que
 * estavam à frente — o navegador as descarta —, e elas saem do mapa.
 */
function anotarEntrada(
  entradas: Map<number, string>,
  indice: number,
  url: string,
  nova = false,
): void {
  if (nova) {
    for (const i of [...entradas.keys()]) if (i > indice) entradas.delete(i);
  }
  entradas.set(indice, url);
}

/**
 * T198 — a rota do que está na tela: a da ficha, quando ela está aberta em
 * Colaboradores; senão, a do destino (ou nenhuma).
 * T199 — a listagem de Colaboradores leva na rota o estado do dashboard (aba,
 * página e ids de filtros; nunca a busca).
 */
function rotaDoExibido(
  destinoId: string,
  ficha: RotaDaFicha | null,
  listagem: EstadoDaListagem = ESTADO_INICIAL_DA_LISTAGEM,
  ano: number = anoCorrente(),
): string | null {
  // T205 — o Dashboard leva sempre o ano consultado (forma canônica).
  if (destinoId === "dashboard") return rotaDoDashboard(ano);
  if (destinoId === "pessoas" && ficha !== null) return rotaDaFicha(ficha);
  if (destinoId === "pessoas") return rotaDaListagem(listagem);
  return rotaDoDestino(destinoId);
}

/**
 * T200 — dentro de Colaboradores, o que sai da tela quando a ficha e a
 * listagem exibidas mudam: a ficha (fechada, ou trocada por outro
 * colaborador) e a aba Jornada do dashboard (a listagem sai dela, mesmo com a
 * ficha aberta por cima). Abrir a ficha e trocar a aba dela não desmontam
 * nada: a listagem fica montada, escondida.
 */
function areasDescartadasEmPessoas(
  fichaAntes: RotaDaFicha | null,
  listagemAntes: EstadoDaListagem,
  fichaDepois: RotaDaFicha | null,
  listagemDepois: EstadoDaListagem,
): AreaDeEdicaoId[] {
  const areas: AreaDeEdicaoId[] = [];
  if (
    fichaAntes !== null &&
    fichaDepois?.colaboradorId !== fichaAntes.colaboradorId
  ) {
    areas.push(AREAS_DE_EDICAO.ficha);
  }
  if (listagemAntes.aba === "jornada" && listagemDepois.aba !== "jornada") {
    areas.push(AREAS_DE_EDICAO.jornadaDoDashboard);
  }
  return areas;
}

/** `titleId` do `h1` de cada destino, para `aria-labelledby` do `<main>`.
 * "cadastros", "pessoas", "ponto", "documentos", "portal-colaborador" e
 * "relatorios" não aparecem aqui: seus `titleId` são dinâmicos (ver
 * `cadastrosTituloId`/`pessoasTituloId`/`pontoTituloId`/`documentosTituloId`/`portalTituloId`/`relatoriosTituloId`).
 * "solicitacoes-rh" tem tela única, sem aba local, então usa o mapa estático
 * normalmente. */
const TITULO_ID_POR_DESTINO: Record<string, string> = {
  dashboard: DASHBOARD_TITULO_ID,
  inicio: "inicio-visao-geral-titulo",
  "solicitacoes-rh": "central-solicitacoes-rh-titulo",
  "contas-acesso": CONTAS_ACESSO_TITULO_ID,
  equipe: EQUIPE_TITULO_ID,
  "administracao-lideranca": ADMINISTRACAO_LIDERANCA_TITULO_ID,
  "nova-admissao": NOVA_ADMISSAO_TITULO_ID,
  "jornadas-trabalho": JORNADAS_TRABALHO_TITULO_ID,
};

/**
 * T176 — o colaborador que a página de Nova admissão pediu para abrir na aba
 * Colaboradores, e onde pôr o foco. Vive no shell porque atravessa destinos:
 * a página sai de cena e a tela de Colaboradores monta com o pedido.
 */
interface AberturaDoAdmitido {
  readonly colaborador: ColaboradorApi;
  readonly foco: FocoDoAdmitido;
}

/**
 * Seletor de elemento focável, para prender o foco dentro da gaveta no
 * mobile. Igual ao do `Modal` (UI-F04) de propósito: duas definições
 * diferentes de "focável" no mesmo produto divergiriam na primeira exceção.
 */
const FOCAVEIS_GAVETA =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mesmo `max-width` do `app-shell.css`. Declarado uma vez, em um lugar: se o
 * CSS e o JavaScript discordassem do breakpoint, existiria uma faixa de
 * largura em que a barra é permanente e o shell ainda se julga em modo
 * gaveta — que é precisamente o defeito R1.
 */
export const CONSULTA_MODO_GAVETA = "(max-width: 834px)";

/**
 * Atributos que tiram uma região do alcance enquanto a gaveta é modal.
 *
 * `inert` corta foco, clique e leitura; `aria-hidden` é a rede para o
 * navegador que ainda não implementa `inert`. Os dois juntos porque prometer
 * modalidade e deixar o fundo alcançável é o erro que o `Modal` (UI-F04) já
 * documenta: afirmar uma coisa e permitir outra.
 *
 * Tipado como atributos soltos porque `inert` ainda não existe nos tipos do
 * React 18 — o atributo é real e os navegadores o respeitam.
 */
const FUNDO_INERTE: Record<string, string> = {
  inert: "",
  "aria-hidden": "true",
};

/** `true` enquanto a janela está na faixa em que a barra lateral é gaveta. */
function avaliarModoGaveta(): boolean {
  // Sem `matchMedia` o modo gaveta é o padrão: é o que mantém a navegação
  // alcançável. O CSS continua decidindo o que aparece.
  return window.matchMedia?.(CONSULTA_MODO_GAVETA)?.matches ?? true;
}

/**
 * Acompanha o breakpoint. Reavalia na montagem (entre o primeiro render e o
 * efeito a janela pode ter mudado) e remove o ouvinte ao desmontar.
 */
function useModoGaveta(): boolean {
  const [modoGaveta, setModoGaveta] = useState(avaliarModoGaveta);

  useEffect(() => {
    const consulta = window.matchMedia?.(CONSULTA_MODO_GAVETA);
    if (!consulta) return;

    const reavaliar = () => setModoGaveta(avaliarModoGaveta());
    reavaliar();

    // Dois sinais, de propósito. `change` é o correto e basta num navegador
    // comum. `resize` é a rede: em ambiente com viewport emulado (o painel de
    // prévia deste projeto, entre outros) `matches` muda e o evento `change`
    // NUNCA chega — medido. Sem a rede, a janela cresceria e o shell
    // continuaria se julgando em modo gaveta, que é o defeito R1 de novo,
    // por outro caminho. Reavaliar é idempotente: `setState` com o mesmo
    // valor não re-renderiza.
    consulta.addEventListener("change", reavaliar);
    window.addEventListener("resize", reavaliar);
    return () => {
      consulta.removeEventListener("change", reavaliar);
      window.removeEventListener("resize", reavaliar);
    };
  }, []);

  return modoGaveta;
}

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

/**
 * T206 — ícone do botão de recolher/expandir o menu. Desenho próprio: uma
 * moldura com a faixa lateral marcada e uma seta que aponta para onde o menu
 * vai. Gira por CSS conforme o estado; o nome vem do texto do botão.
 */
function IconeRecolherMenu() {
  return (
    <svg
      className="app-shell__recolher-icone"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
      <path d="M7.25 3.75v12.5M13.25 7.75 11 10l2.25 2.25" />
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
  // T164 — ultimo parametro de proposito: acrescentar no fim preserva todas as
  // posicoes existentes, entao nenhuma chamada muda de significado por engano.
  empresaAtiva: { readonly nome: string; readonly codigo: string } | null,
  // T176 — também no fim, pelo mesmo motivo.
  admissao: {
    readonly onAbrirAdmitido: (abertura: AberturaDoAdmitido) => void;
    /** T177 — o papel abre a página de Nova admissão (ver `resolverEntrada`). */
    readonly podeAdmitir: boolean;
    /**
     * T179 — o papel do ator, só para a página orientar quem cadastra as
     * referências que faltam (RH) ou a quem pedir (DP). Não concede nada.
     */
    readonly papelDoAtor: string | null;
  },
  // T198 — a ficha unificada do colaborador, aberta pela rota.
  fichaDoColaborador: {
    readonly ficha: RotaDaFicha | null;
    readonly focarContatos: boolean;
    readonly onAbrir: (colaboradorId: string) => void;
    readonly onTrocarAba: (aba: AbaDaFicha) => void;
    /** T202 — outra competência da aba de ponto: o shell troca a rota. */
    readonly onTrocarCompetencia: (competencia: string) => void;
    readonly onFechar: () => void;
    /** T199 — o estado do dashboard de Colaboradores, guardado na URL. */
    readonly listagem: EstadoDaListagem;
    readonly onListagemChange: (
      listagem: EstadoDaListagem,
      opcoes?: OpcoesDaMudancaDaListagem,
    ) => void;
  },
  // T205 — o Dashboard inicial: o ano da URL e as navegações que ele pede.
  dashboard: {
    readonly ano: number;
    readonly onTrocarAno: (ano: number) => void;
    readonly onAbrirListagem: (estado: EstadoDaListagem) => void;
  },
) {
  if (destinoId === "dashboard") {
    return (
      <DashboardScreen
        ano={dashboard.ano}
        empresaAtiva={empresaAtiva}
        onTrocarAno={dashboard.onTrocarAno}
        onAbrirListagem={dashboard.onAbrirListagem}
      />
    );
  }
  if (destinoId === "inicio") {
    return <InicioVisaoGeralScreen onNavegar={onNavegar} />;
  }
  if (destinoId === "cadastros") {
    // T182 — DP (e quem só lê) vê a Estrutura sem controle de escrita.
    return (
      <CadastrosScreen
        onTituloIdChange={onCadastrosTituloIdChange}
        podeOperar={podeOperarEstrutura(admissao.papelDoAtor)}
      />
    );
  }
  if (destinoId === "jornadas-trabalho") {
    // T182 — só o RH opera; DP e `master_tecnico` consultam.
    return (
      <JornadasTrabalhoScreen
        podeOperar={podeOperarJornadas(admissao.papelDoAtor)}
      />
    );
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
    return (
      <PessoasScreen
        onTituloIdChange={onPessoasTituloIdChange}
        empresaAtiva={empresaAtiva}
        ficha={fichaDoColaborador.ficha}
        focarContatosNaFicha={fichaDoColaborador.focarContatos}
        onAbrirFicha={fichaDoColaborador.onAbrir}
        onTrocarAbaDaFicha={fichaDoColaborador.onTrocarAba}
        onTrocarCompetenciaDaFicha={fichaDoColaborador.onTrocarCompetencia}
        onFecharFicha={fichaDoColaborador.onFechar}
        listagem={fichaDoColaborador.listagem}
        onListagemChange={fichaDoColaborador.onListagemChange}
        {...(admissao.podeAdmitir
          ? { onNovaAdmissao: () => onNavegar("nova-admissao") }
          : {})}
        // T181 — a edição da ficha é só de RH e DP.
        podeEditarFicha={podeEditarFicha(admissao.papelDoAtor)}
        // T183 — atribuir, trocar e encerrar jornada é só do RH.
        podeOperarJornada={podeOperarJornadas(admissao.papelDoAtor)}
        // T203 — a aba Solicitações só existe para quem a lê (não o DP).
        podeVerSolicitacoes={podeLerSolicitacoesPessoas(admissao.papelDoAtor)}
      />
    );
  }
  if (destinoId === "nova-admissao") {
    return (
      <NovaAdmissaoScreen
        papelDoAtor={admissao.papelDoAtor}
        onSair={() => onNavegar("pessoas")}
        onAbrirAdmitido={(colaborador, foco) =>
          admissao.onAbrirAdmitido({ colaborador, foco })
        }
      />
    );
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

/**
 * Onde o shell monta: o destino que o Hub pediu, quando ele é legítimo para
 * este papel; o destino inicial do papel, em qualquer outro caso.
 *
 * Fail-closed por construção. Um destino **funcional** só passa se estiver na
 * capacidade do papel — a mesma tabela derivada do `rbac.evaluator` que o Hub
 * usa para decidir o que oferecer. Assim, nem um id inventado, nem um estado
 * antigo, nem uma regressão no Hub conseguem montar aqui a tela que
 * responderia 403 na primeira requisição.
 *
 * Destino **demonstrativo** passa para qualquer papel: ele não importa cliente
 * de API nenhum, então não há requisição a ser negada. É o mesmo motivo pelo
 * qual `inicio` é o destino de quem não tem capacidade funcional.
 */
function resolverEntrada(
  destinoInicial: string | null,
  papelDoAtor: string | null,
): string {
  if (destinoInicial === null) return destinoInicialPara(papelDoAtor);
  const destino = destinoPorId(destinoInicial);
  if (destino === undefined) return destinoInicialPara(papelDoAtor);
  if (destino.estado === "demonstrativo") return destino.id;
  const permitido = capacidadeFuncionalDe(papelDoAtor).some(
    (d) => d.id === destino.id,
  );
  return permitido ? destino.id : destinoInicialPara(papelDoAtor);
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
  /**
   * T162 — destino escolhido no Hub pós-login. Substitui `destinoInicialPara`
   * como ponto de entrada quando presente.
   *
   * **Validado aqui, e não só na origem.** O Hub só oferece destino que o
   * papel abre, mas esta prop é a fronteira do componente: um id inexistente,
   * ou um destino funcional que o papel NÃO abre, cai no destino inicial do
   * papel em vez de montar a tela que responderia 403. É a mesma regra da
   * T153, aplicada a um caminho novo.
   *
   * Destino demonstrativo é aceito de qualquer papel: ele não chama a API.
   */
  /**
   * T164 — a empresa de trabalho ATIVA, para as telas que precisam dizer em
   * qual empresa o que está na tela foi lido. Desce do `AutenticacaoApp`, que
   * já tem o ator; nenhuma tela faz leitura própria para obtê-la.
   *
   * T189 — também aparece no topo do menu lateral (`SeletorEmpresaAtiva`),
   * e é dali que quem o servidor autoriza troca de empresa sem voltar ao Hub.
   */
  empresaAtiva?: EmpresaAtivaExibida | null;
  /** T189 — decidido pelo servidor (`/users/me`): este papel troca de empresa? */
  podeTrocarEmpresa?: boolean;
  /**
   * T189 — o servidor confirmou a troca feita no menu lateral. Quem monta o
   * shell reresolve o ator e o remonta no mesmo módulo (ver `AutenticacaoApp`).
   */
  onEmpresaTrocada?: (empresa: EmpresaDoContextoApi) => void;
  /**
   * T189 — o destino exibido agora, para que uma troca de empresa (aqui ou em
   * outra aba) devolva a pessoa ao mesmo módulo.
   */
  onDestinoAlterado?: (destinoId: string) => void;
  /**
   * T189 — ao montar, levar o foco ao título da tela. Usado depois de uma
   * troca de empresa: a tela é outra, e quem usa teclado ou leitor de tela
   * precisa saber onde está.
   */
  focarTituloAoAbrir?: boolean;
  destinoInicial?: string | null;
  /**
   * T162 — volta ao Hub. Ausente significa que não há Hub acima deste shell
   * (é o caso dos testes que montam `App` sozinho), e aí o botão não aparece.
   */
  onVoltarAoHub?: () => void;
  /**
   * T206 — menu lateral recolhido em trilho de ícones (só no desktop).
   *
   * Controlado por quem monta o shell, para que a preferência sobreviva à
   * volta pelo Hub e morra com a conta, a empresa ou o logout (ver
   * `AutenticacaoApp`). Ausente, o shell guarda o estado sozinho, em memória.
   * Nunca há `localStorage`, `sessionStorage`, cookie ou URL.
   */
  menuRecolhido?: boolean;
  onMenuRecolhidoChange?: (recolhido: boolean) => void;
}

export function App({
  onLogout,
  onSessaoAtualEncerrada,
  mfaDisponivel = false,
  papelDoAtor = null,
  empresaAtiva = null,
  podeTrocarEmpresa = false,
  onEmpresaTrocada,
  onDestinoAlterado,
  focarTituloAoAbrir = false,
  destinoInicial = null,
  onVoltarAoHub,
  menuRecolhido,
  onMenuRecolhidoChange,
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
  // T176 — uma URL com rota conhecida (`#/pessoas/nova-admissao` e, desde a
  // T178, `#/pessoas/colaboradores`) tem precedência sobre o destino do Hub:
  // é o endereço que a pessoa abriu — ou recarregou. Mas
  // só quando o papel PODE abri-la — a mesma validação de capacidade de
  // qualquer pedido. Rota que o papel não abre é ignorada, e vale a escolha do
  // Hub, como se a URL não tivesse rota.
  // T198 — a mesma leitura decide o destino e, se for a ficha, qual ficha.
  const [entradaDaUrl] = useState(() => {
    const pedidoDaRota = destinoDaRota(window.location.hash);
    if (
      pedidoDaRota !== null &&
      resolverEntrada(pedidoDaRota, papelDoAtor) === pedidoDaRota
    ) {
      return {
        destino: pedidoDaRota,
        // T203 — a aba que o papel não lê (Solicitações, para o DP) vira
        // "dados"; a primeira exibição corrige a URL no lugar.
        ficha: fichaParaOPapel(fichaDaRota(window.location.hash), papelDoAtor),
        // T199 — inválido cai no padrão; a URL é corrigida no lugar.
        listagem:
          listagemDaRota(window.location.hash) ?? ESTADO_INICIAL_DA_LISTAGEM,
        // T205 — ano ausente, inválido ou futuro vira o corrente; a primeira
        // exibição corrige a URL no lugar.
        ano: dashboardDaRota(window.location.hash)?.ano ?? anoCorrente(),
      };
    }
    return {
      destino: resolverEntrada(destinoInicial, papelDoAtor),
      ficha: null,
      listagem: ESTADO_INICIAL_DA_LISTAGEM,
      ano: anoCorrente(),
    };
  });
  const [destinoAtivoId, setDestinoAtivoId] = useState(entradaDaUrl.destino);
  /**
   * T198 — a ficha do colaborador aberta em Colaboradores (D17, D18): o
   * colaborador e a aba, sempre os da URL. `null` é a listagem.
   */
  const [ficha, setFicha] = useState<RotaDaFicha | null>(entradaDaUrl.ficha);
  /**
   * T199 — o estado do dashboard de Colaboradores (aba, página e ids de
   * filtros), sempre o da URL: recarregar, voltar e avançar o restauram.
   */
  const [listagem, setListagem] = useState<EstadoDaListagem>(
    entradaDaUrl.listagem,
  );
  const listagemAtualRef = useRef(listagem);
  listagemAtualRef.current = listagem;
  /** T205 — o ano consultado no Dashboard, sempre o da URL. */
  const [anoDoDashboard, setAnoDoDashboard] = useState(entradaDaUrl.ano);
  /** T200 — a ficha exibida agora, lida pelo manipulador de URL. */
  const fichaAtualRef = useRef(ficha);
  fichaAtualRef.current = ficha;
  /** T200 — a guarda de saída do shell (ref: lida fora do desenho). */
  const guarda = useGuardaDeSaida();
  const guardaRef = useRef(guarda);
  guardaRef.current = guarda;
  /**
   * T200 — o índice da entrada do histórico em que o navegador está (a
   * posição dela). Toda entrada percorrida ganha um, inclusive a de uma
   * âncora da própria página: voltar e avançar contam passos certos.
   */
  const indiceRef = useRef(indiceDoEstado(window.history.state) ?? 0);
  /**
   * T200 — as entradas que o shell sabe que ainda existem: índice → URL. Uma
   * âncora ou rota digitada cria entrada nova e apaga as que estavam à
   * frente; uma saída aceita só é refeita pelo histórico quando o destino
   * continua lá (ver `refazer`).
   */
  const [entradas] = useState(
    () => new Map<number, string>([[indiceRef.current, window.location.href]]),
  );
  /** T200 — a navegação já aceita na guarda: refeita, não pergunta de novo. */
  const aceitaRef = useRef<{ indice: number; url: string } | null>(null);
  /**
   * T200 — o passo que o navegador está desfazendo (o `go` é assíncrono), com
   * o índice lido na entrada desfeita (`null`: ela não tinha). Só a chegada
   * de volta à entrada de `indiceRef` o encerra — pelo índice, nunca pela
   * URL; o outro evento do mesmo passo (`popstate` e `hashchange`) é
   * ignorado, para não desfazer duas vezes. Uma navegação aceita nesse
   * meio-tempo espera ele terminar: refeita antes, partiria da entrada errada.
   */
  const desfazendoRef = useRef<{ indiceDesfeito: number | null } | null>(null);
  const refazerDepoisRef = useRef<{ indice: number; url: string } | null>(null);
  /**
   * T200 — saídas adiadas (voltar, avançar, rota digitada) aceitas e já
   * aplicadas: o efeito de foco abaixo roda depois que a tela nova montou.
   */
  const [saidasConcluidas, setSaidasConcluidas] = useState(0);
  /** T200 — escreve no histórico levando o índice (`push` avança um). */
  const escreverNoHistorico = useCallback(
    (modo: "push" | "replace", url: string) => {
      const indice =
        modo === "push" ? indiceRef.current + 1 : indiceRef.current;
      if (modo === "push") {
        window.history.pushState({ [CHAVE_DO_INDICE]: indice }, "", url);
      } else {
        window.history.replaceState(estadoComIndice(indice), "", url);
      }
      indiceRef.current = indice;
      anotarEntrada(entradas, indice, window.location.href, modo === "push");
    },
    [entradas],
  );
  /**
   * T199 — o estado que, quando exibido, corrige a URL no lugar
   * (`replaceState`). Preso ao próprio estado, não à próxima escrita: o
   * efeito da URL roda depois dos efeitos dos filhos, ainda com o estado
   * anterior, e não pode gastar a correção numa rodada que nada escreve.
   */
  const correcaoDaListagemRef = useRef<EstadoDaListagem | null>(null);
  const mudarListagem = useCallback(
    (nova: EstadoDaListagem, opcoes?: OpcoesDaMudancaDaListagem) => {
      correcaoDaListagemRef.current = opcoes?.substituir ? nova : null;
      setListagem(nova);
    },
    [],
  );
  /** T176 — "Completar contatos": a ficha abre com o foco nos contatos. */
  const [focarContatosNaFicha, setFocarContatosNaFicha] = useState(false);
  /**
   * Para onde a URL SEM rota devolve (o "voltar" até ela): o último destino
   * sem rota exibido ou, antes de haver um, o destino inicial do papel — que,
   * desde a T178, pode ter rota própria (`pessoas`); aí a URL é corrigida para
   * a dela, no lugar (ver `aoMudarUrl`).
   */
  const destinoSemRotaRef = useRef(
    rotaDoExibido(destinoAtivoId, ficha, listagem, anoDoDashboard) === null
      ? destinoAtivoId
      : destinoInicialPara(papelDoAtor),
  );
  const [sessoesAtivasAberto, setSessoesAtivasAberto] = useState(false);
  const [segurancaAberto, setSegurancaAberto] = useState(false);
  // "Cadastros", "Pessoas", "Ponto", "Documentos", "Portal do Colaborador" e
  // "Relatórios" sempre voltam à aba padrão ao serem selecionados (o wrapper
  // de cada um remonta e reseta sua aba interna) — por isso o valor inicial
  // já é o `titleId` dessa aba padrão.
  const [cadastrosTituloId, setCadastrosTituloId] = useState(
    ESTRUTURA_ORGANIZACIONAL_TITULO_ID,
  );
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

  // Gaveta do mobile. `modoGaveta` é a largura da janela, não a intenção de
  // quem navega: a gaveta só é modal quando as duas coisas valem.
  const modoGaveta = useModoGaveta();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const gavetaModal = modoGaveta && gavetaAberta;

  // T206 — trilho recolhido. A preferência é de quem monta o shell quando ele
  // a controla; senão, deste componente. No modo gaveta ela não vale: a gaveta
  // do celular é sempre o menu inteiro.
  const [recolhidoLocal, setRecolhidoLocal] = useState(false);
  const recolhido = menuRecolhido ?? recolhidoLocal;
  const trilho = recolhido && !modoGaveta;
  const definirRecolhido = useCallback(
    (proximo: boolean) => {
      if (onMenuRecolhidoChange) onMenuRecolhidoChange(proximo);
      else setRecolhidoLocal(proximo);
    },
    [onMenuRecolhidoChange],
  );
  const expandirMenu = useCallback(
    () => definirRecolhido(false),
    [definirRecolhido],
  );
  const botaoMenuRef = useRef<HTMLButtonElement | null>(null);
  const botaoRecolherRef = useRef<HTMLButtonElement | null>(null);

  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // T206 — atravessar o breakpoint esconde parte do menu: no modo gaveta a
  // faixa inteira some pelo CSS (e o "Recolher menu" ganha `hidden`); no
  // desktop some o "Menu" (CSS). Se o foco estava no que sumiu, ele cairia no
  // `body`; passa para a entrada equivalente que acabou de aparecer — o
  // "Menu" para qualquer coisa da faixa, o "Recolher menu" para o "Menu".
  //
  // O navegador real tira o foco JÁ no redimensionamento, quando o CSS
  // esconde o elemento — antes de o React saber do breakpoint. Por isso não
  // basta perguntar quem está focado agora: guarda-se o último elemento que
  // recebeu foco, e um foco perdido (no `body`) que estava num acionador
  // conta como estando nele.
  const ultimoFocadoRef = useRef<Element | null>(null);
  useEffect(() => {
    const registrar = (evento: FocusEvent) => {
      ultimoFocadoRef.current = evento.target as Element | null;
    };
    document.addEventListener("focusin", registrar);
    return () => document.removeEventListener("focusin", registrar);
  }, []);
  useLayoutEffect(() => {
    const ativo = document.activeElement;
    const perdido = ativo === null || ativo === document.body;
    const ultimo = ultimoFocadoRef.current;
    const estavaEm = (regiao: HTMLElement | null) =>
      regiao !== null &&
      (regiao.contains(ativo) ||
        (perdido && ultimo !== null && regiao.contains(ultimo)));
    if (modoGaveta && estavaEm(sidebarRef.current)) {
      botaoMenuRef.current?.focus();
    } else if (!modoGaveta && estavaEm(botaoMenuRef.current)) {
      botaoRecolherRef.current?.focus();
    }
  }, [modoGaveta]);

  // R1 — atravessar o breakpoint para o desktop desfaz o estado móvel por
  // completo: sem gaveta aberta, sem scrim, sem foco preso, sem semântica de
  // diálogo. Antes disto, girar um tablet de 768 para 1024 com a gaveta
  // aberta deixava um scrim de página inteira por cima da barra já normal.
  useEffect(() => {
    if (modoGaveta) return;
    setGavetaAberta(false);
  }, [modoGaveta]);

  /**
   * S2 — fora do modo gaveta o acionador não mexe em nada.
   *
   * O botão existe no DOM em qualquer largura (quem o esconde no desktop é o
   * CSS), então um acionamento ali é possível por programa, por extensão ou
   * por teste. Sem esta guarda, `gavetaAberta` ficaria `true` de forma
   * invisível e a gaveta abriria SOZINHA na primeira vez que a janela
   * encolhesse — estado móvel latente, nascido no desktop.
   */
  const alternarGaveta = useCallback(() => {
    if (!avaliarModoGaveta()) return;
    setGavetaAberta((aberta) => !aberta);
  }, []);

  // Navegar fecha a gaveta — no desktop isto não tem efeito, porque ela já
  // está fechada. Vale para a barra e para os atalhos da Visão geral.
  const irParaDireto = useCallback((destinoId: string) => {
    // T198 — navegar pela barra sai da ficha: Colaboradores abre na listagem.
    // T199 — e a listagem abre no estado inicial (Ativos, sem filtros).
    setFicha(null);
    setListagem(ESTADO_INICIAL_DA_LISTAGEM);
    // T205 — o Dashboard abre pelo menu no ano corrente.
    setAnoDoDashboard(anoCorrente());
    setFocarContatosNaFicha(false);
    setDestinoAtivoId(destinoId);
    setGavetaAberta(false);
  }, []);
  // T200 — menu, atalhos e as navegações das telas passam pela guarda: com
  // edição pendente, a troca de destino pergunta antes de descartar.
  // O mesmo destino não desmonta a tela: só conta o que a volta da ficha e da
  // listagem ao início descarta (em Colaboradores); nada, nos outros.
  const irPara = useCallback(
    (destinoId: string) => {
      const executar = () => irParaDireto(destinoId);
      if (destinoId !== destinoAtivoRef.current) {
        guardaRef.current.solicitarSaida({ executar });
        return;
      }
      const area =
        destinoId === "pessoas"
          ? areasDescartadasEmPessoas(
              fichaAtualRef.current,
              listagemAtualRef.current,
              null,
              ESTADO_INICIAL_DA_LISTAGEM,
            )
          : [];
      if (area.length === 0) {
        executar();
        return;
      }
      guardaRef.current.solicitarSaida({ area, executar });
    },
    [irParaDireto],
  );

  // T176/T198 — "Abrir ficha" e "Completar contatos" da Nova admissão abrem a
  // ficha do admitido, na aba de dados.
  const abrirAdmitido = useCallback((abertura: AberturaDoAdmitido) => {
    setFicha({ colaboradorId: abertura.colaborador.id, aba: "dados" });
    setFocarContatosNaFicha(abertura.foco === "contatos");
    setDestinoAtivoId("pessoas");
  }, []);
  // T205 — trocar de ano no Dashboard é navegação: empilha uma entrada
  // (voltar e avançar percorrem os anos). Ano fora do intervalo não vira rota.
  const trocarAnoDoDashboard = useCallback((ano: number) => {
    if (!anoDoDashboardValido(ano)) return;
    setAnoDoDashboard(ano);
  }, []);
  // T205 — um indicador do Dashboard abre a listagem de Colaboradores já
  // filtrada (D-5). Passa pela guarda, como qualquer troca de destino; o
  // foco, que estava no indicador, vai à região principal da tela nova.
  const abrirListagemDoDashboard = useCallback((estado: EstadoDaListagem) => {
    guardaRef.current.solicitarSaida({
      executar: () => {
        setFicha(null);
        setFocarContatosNaFicha(false);
        setListagem(estado);
        setDestinoAtivoId("pessoas");
        setGavetaAberta(false);
        setSaidasConcluidas((n) => n + 1);
      },
    });
  }, []);
  const abrirFicha = useCallback((colaboradorId: string) => {
    setFocarContatosNaFicha(false);
    setFicha({ colaboradorId, aba: "dados" });
  }, []);
  const trocarAbaDaFicha = useCallback(
    (aba: AbaDaFicha) => {
      // T203 — aba que o papel não lê não é oferecida; se pedida, é ignorada.
      if (aba === "solicitacoes" && !podeLerSolicitacoesPessoas(papelDoAtor)) {
        return;
      }
      // T202 — a aba de ponto abre na última competência vista nesta ficha ou,
      // na primeira vez, no mês corrente (P-4).
      setFicha((atual) =>
        atual
          ? {
              ...atual,
              aba,
              ...(aba === "ponto"
                ? { competencia: atual.competencia ?? competenciaDoMesAtual() }
                : {}),
            }
          : atual,
      );
    },
    [papelDoAtor],
  );
  // T202 — trocar de mês é navegação: empilha uma entrada (voltar e avançar
  // percorrem os meses). Competência fora do formato não vira rota.
  const trocarCompetenciaDaFicha = useCallback((competencia: string) => {
    if (!competenciaValida(competencia)) return;
    setFicha((atual) =>
      atual && atual.aba === "ponto" ? { ...atual, competencia } : atual,
    );
  }, []);
  const fecharFicha = useCallback(() => {
    setFocarContatosNaFicha(false);
    setFicha(null);
  }, []);
  // T177 — "Nova admissão" (T178; era "Novo colaborador"), na listagem, leva
  // à página de Nova admissão e só aparece para
  // quem pode abri-la: a mesma validação de capacidade da entrada e da rota.
  // Perfil que só consulta não ganha um botão que o levaria a um 403.
  const podeAdmitir =
    resolverEntrada("nova-admissao", papelDoAtor) === "nova-admissao";

  /** O destino exibido agora — lido pelo manipulador de URL, fora do React. */
  const destinoAtivoRef = useRef(destinoAtivoId);
  /** A rota do último destino EXIBIDO, ou `null` se ele não tinha rota. */
  const rotaExibidaRef = useRef<string | null>(null);
  /**
   * T178 — `true` até a primeira exibição escrever a URL.
   *
   * Desde que `pessoas` tem rota, a aterrissagem comum (Hub → Colaboradores)
   * já escreve uma URL. Escrevê-la com `pushState` criaria uma entrada que a
   * pessoa nunca percorreu: o primeiro "voltar" não sairia de lugar nenhum. A
   * primeira exibição corrige a URL no lugar; só a navegação feita DENTRO do
   * shell empilha. Volta a `true` ao sair do shell (ver o efeito de limpeza),
   * o que também mantém o `StrictMode` de desenvolvimento — que desmonta e
   * remonta os efeitos — sem entrada duplicada.
   */
  const primeiraExibicaoRef = useRef(true);

  // T200 — a entrada em que o shell abriu ganha índice, se ainda não tem.
  useEffect(() => {
    if (indiceDoEstado(window.history.state) !== null) return;
    window.history.replaceState(
      estadoComIndice(indiceRef.current),
      "",
      window.location.href,
    );
  }, []);

  // T176 — a URL acompanha o destino. Destino com rota a escreve; destino sem
  // rota a retira, se ela estava lá. Sair de uma página com rota usa
  // `pushState`, para que o "voltar" do navegador volte a ela. Uma rota que
  // foi PEDIDA mas nunca exibida (papel sem acesso, na entrada) só é corrigida,
  // com `replaceState`: não vira entrada no histórico.
  //
  // T178 — com duas rotas, sair de uma página com rota pode ser ENTRAR em
  // outra (Nova admissão → Colaboradores): é o ramo de baixo, com `pushState`
  // — o "voltar" retorna à página de onde se saiu.
  useEffect(() => {
    const rota = rotaDoExibido(destinoAtivoId, ficha, listagem, anoDoDashboard);
    const atual = window.location.hash;
    const vinhaDeRota = rotaExibidaRef.current !== null;
    const primeiraExibicao = primeiraExibicaoRef.current;
    primeiraExibicaoRef.current = false;
    const substituir =
      correcaoDaListagemRef.current !== null &&
      correcaoDaListagemRef.current === listagem;
    if (substituir) correcaoDaListagemRef.current = null;
    destinoAtivoRef.current = destinoAtivoId;
    rotaExibidaRef.current = rota;
    if (rota === null) {
      destinoSemRotaRef.current = destinoAtivoId;
      if (destinoDaRota(atual) !== null) {
        const semRota = window.location.pathname + window.location.search;
        if (vinhaDeRota && !primeiraExibicao) {
          escreverNoHistorico("push", semRota);
        } else {
          escreverNoHistorico("replace", semRota);
        }
      }
    } else if (atual !== rota) {
      if (primeiraExibicao || substituir) {
        escreverNoHistorico("replace", rota);
      } else {
        escreverNoHistorico("push", rota);
      }
    }
  }, [destinoAtivoId, ficha, listagem, anoDoDashboard, escreverNoHistorico]);

  // T200 — uma saída adiada (voltar, avançar, rota digitada) foi aceita e a
  // tela nova já montou: o foco, que estava no diálogo, vai à região
  // principal — a menos que a tela nova já o tenha posto em algum lugar.
  useEffect(() => {
    if (saidasConcluidas === 0) return;
    const ativo = document.activeElement;
    if (ativo === null || ativo === document.body) focarRegiaoPrincipal();
  }, [saidasConcluidas]);

  // T189 — quem monta o shell sabe sempre o destino exibido: é para ele que
  // uma troca de empresa devolve. Ref, para não refazer o efeito a cada
  // desenho de quem passa a função.
  const onDestinoAlteradoRef = useRef(onDestinoAlterado);
  onDestinoAlteradoRef.current = onDestinoAlterado;
  useEffect(() => {
    onDestinoAlteradoRef.current?.(destinoAtivoId);
  }, [destinoAtivoId]);

  // "Voltar" e "avançar" do navegador, e a URL digitada com o painel aberto.
  // A rota passa pela mesma validação de capacidade da entrada.
  useEffect(() => {
    /**
     * T200 — o que a navegação pedida desmontaria: `undefined` é a tela
     * inteira (outro destino); uma lista de áreas, só elas; `null`, nada.
     */
    function areaDoDescarte(
      exibido: string,
      fichaExibida: RotaDaFicha | null,
      listagemExibida: EstadoDaListagem,
    ): AreaDeEdicaoId[] | undefined | null {
      if (exibido !== destinoAtivoRef.current) return undefined;
      if (exibido !== "pessoas") return null;
      const areas = areasDescartadasEmPessoas(
        fichaAtualRef.current,
        listagemAtualRef.current,
        fichaExibida,
        listagemExibida,
      );
      return areas.length > 0 ? areas : null;
    }

    /**
     * Volta o navegador à entrada que a tela descreve, sem trocar de tela.
     * `indiceDesfeito`: o índice lido na entrada que está sendo desfeita.
     */
    function desfazer(passo: number, indiceDesfeito: number | null) {
      desfazendoRef.current = { indiceDesfeito };
      window.history.go(-passo);
    }

    /**
     * Refaz a navegação aceita, agora sem perguntar, até a entrada de índice
     * `indice` e URL `url`. O salto é contado na hora, a partir de onde o
     * navegador está: com o diálogo aberto, uma âncora digitada muda essa
     * posição, e o passo do pedido original levaria a outra entrada.
     */
    function refazer(indice: number, url: string) {
      if (desfazendoRef.current !== null) {
        refazerDepoisRef.current = { indice, url };
        return;
      }
      const passo = indice - indiceRef.current;
      if (passo !== 0 && entradas.get(indice) === url) {
        aceitaRef.current = { indice, url };
        window.history.go(passo);
        return;
      }
      // O destino aceito já não está no histórico: uma âncora ou rota
      // digitada com o diálogo aberto o apagou (ou ocupou o lugar dele). A
      // URL aceita vira uma entrada nova da própria aplicação, logo depois da
      // atual, já aceita, e é aplicada aqui mesmo: `pushState` não dispara
      // evento. Nunca `go(0)` nem o `location` — sem hash, ele navegaria o
      // documento (recarga, com o aviso nativo). O foco segue o caminho
      // normal da saída concluída.
      const novo = indiceRef.current + 1;
      window.history.pushState({ [CHAVE_DO_INDICE]: novo }, "", url);
      anotarEntradaNova(novo, window.location.href);
      aceitaRef.current = { indice: novo, url: window.location.href };
      aoMudarUrl();
    }

    /** Uma entrada que o navegador acabou de criar, logo depois da atual. */
    function anotarEntradaNova(indice: number, url: string) {
      anotarEntrada(entradas, indice, url, true);
      // Uma saída aceita para uma entrada que acabou de sumir não vale mais.
      if (aceitaRef.current !== null && aceitaRef.current.indice >= indice) {
        aceitaRef.current = null;
      }
    }

    function aoMudarUrl() {
      const fragmento = window.location.hash;
      const urlPedida = window.location.href;
      const indiceLido = indiceDoEstado(window.history.state);
      // T200 — a entrada em que o navegador está existe, com esta URL.
      if (indiceLido !== null) anotarEntrada(entradas, indiceLido, urlPedida);
      // T200 — o navegador desfazendo um passo da guarda: só a chegada de
      // volta à entrada de `indiceRef` o encerra (e refaz a saída, se ela já
      // foi aceita); o outro evento do passo desfeito é ignorado.
      const desfazendo = desfazendoRef.current;
      if (desfazendo !== null) {
        if (indiceLido === indiceRef.current) {
          desfazendoRef.current = null;
          const depois = refazerDepoisRef.current;
          refazerDepoisRef.current = null;
          if (depois) refazer(depois.indice, depois.url);
          return;
        }
        if (indiceLido === desfazendo.indiceDesfeito) return;
        // Outra entrada: a pessoa andou de novo no meio da reversão. Ela não
        // chega mais; segue como navegação nova, sem refazer nada.
        desfazendoRef.current = null;
        refazerDepoisRef.current = null;
      }
      // T200 — o outro evento (`popstate` e `hashchange`) de um passo já
      // aplicado: a tela já descreve esta entrada.
      if (indiceLido !== null && indiceLido === indiceRef.current) return;
      // Sem índice, é uma entrada que o navegador criou agora (rota digitada
      // ou link): fica logo depois da atual.
      const indiceNovo = indiceLido ?? indiceRef.current + 1;
      // T178 — âncora da própria página (digitada, ou de um link): ninguém
      // pediu outro destino, e a tela fica onde está. T200 — a entrada ganha o
      // índice da posição dela: sem ele, voltar e avançar contariam errado.
      if (!ehFragmentoDeRota(fragmento)) {
        if (indiceLido === null) {
          window.history.replaceState(
            estadoComIndice(indiceNovo),
            "",
            urlPedida,
          );
          anotarEntradaNova(indiceNovo, urlPedida);
        }
        indiceRef.current = indiceNovo;
        return;
      }
      const aceitaAntes = aceitaRef.current;
      aceitaRef.current = null;
      const aceita =
        aceitaAntes !== null &&
        aceitaAntes.indice === indiceNovo &&
        aceitaAntes.url === urlPedida;
      const pedido = destinoDaRota(fragmento);
      let exibido: string;
      if (pedido === null) {
        exibido = destinoSemRotaRef.current;
      } else if (resolverEntrada(pedido, papelDoAtor) === pedido) {
        exibido = pedido;
      } else {
        // Rota recusada: a tela atual fica, se o papel pode estar nela; só sem
        // tela válida cai no destino inicial do papel.
        const atual = destinoAtivoRef.current;
        exibido =
          resolverEntrada(atual, papelDoAtor) === atual
            ? atual
            : destinoInicialPara(papelDoAtor);
      }
      // A URL volta a dizer o que está na tela — nunca fica pendurada numa
      // rota recusada ou desconhecida. Correção no lugar (`replaceState`):
      // quem mudou a URL foi o navegador, e empilhar aqui criaria um histórico
      // que a pessoa não percorreu. T178: vale também para o "voltar" até a
      // URL sem rota quando o destino dela tem rota (`pessoas`).
      // T198 — em Colaboradores, a URL diz se é a listagem ou qual ficha (e
      // em qual aba); fora dele, não há ficha.
      const fichaExibida =
        exibido === "pessoas" && pedido === "pessoas"
          ? fichaParaOPapel(fichaDaRota(fragmento), papelDoAtor)
          : null;
      // T199 — na listagem, a URL diz a aba, a página e os filtros; valor
      // inválido cai no padrão e a URL é corrigida no lugar, logo abaixo.
      const listagemExibida =
        exibido === "pessoas" && pedido === "pessoas"
          ? (listagemDaRota(fragmento) ?? listagemAtualRef.current)
          : ESTADO_INICIAL_DA_LISTAGEM;
      // T205 — no Dashboard, a URL diz o ano; inválido ou futuro vira o
      // corrente e a URL é corrigida no lugar, logo abaixo.
      const anoExibido =
        exibido === "dashboard" && pedido === "dashboard"
          ? (dashboardDaRota(fragmento)?.ano ?? anoCorrente())
          : anoCorrente();
      // T200 — com edição pendente no que esta navegação desmontaria (ou com
      // a guarda já perguntando), a URL volta ao que a tela descreve e a
      // guarda pergunta; só a escolha explícita refaz o mesmo passo.
      if (!aceita) {
        const guardaAtual = guardaRef.current;
        const area = areaDoDescarte(exibido, fichaExibida, listagemExibida);
        const ocupada = guardaAtual.ocupada();
        if (
          ocupada ||
          (area !== null && guardaAtual.exigeConfirmacao(area ?? undefined))
        ) {
          const passo = indiceNovo - indiceRef.current;
          // A entrada sem índice (rota digitada, criada agora logo depois da
          // atual) ganha o dela antes de ser desfeita: fica à frente como
          // entrada de avançar, e um salto de vários passos até ela precisa
          // saber onde ela está.
          if (indiceLido === null) {
            window.history.replaceState(
              estadoComIndice(indiceNovo),
              "",
              urlPedida,
            );
            anotarEntradaNova(indiceNovo, urlPedida);
          }
          desfazer(passo, indiceNovo);
          if (!ocupada) {
            guardaAtual.solicitarSaida({
              ...(area ? { area } : {}),
              adiada: true,
              executar: () => refazer(indiceNovo, urlPedida),
            });
          }
          return;
        }
      }
      indiceRef.current = indiceNovo;
      if (indiceLido === null) {
        window.history.replaceState(estadoComIndice(indiceNovo), "", urlPedida);
        anotarEntradaNova(indiceNovo, urlPedida);
      }
      // T200 — como em `irParaDireto`: navegar fecha a gaveta. Aberta, ela
      // deixaria o conteúdo principal inerte, sem como receber o foco.
      setGavetaAberta(false);
      setFicha(fichaExibida);
      if (fichaExibida === null) setFocarContatosNaFicha(false);
      setListagem(listagemExibida);
      setAnoDoDashboard(anoExibido);
      const rotaExibida = rotaDoExibido(
        exibido,
        fichaExibida,
        listagemExibida,
        anoExibido,
      );
      if (rotaExibida !== null) {
        if (fragmento !== rotaExibida) {
          escreverNoHistorico("replace", rotaExibida);
        }
      } else if (fragmento.startsWith("#/")) {
        escreverNoHistorico(
          "replace",
          window.location.pathname + window.location.search,
        );
      }
      setDestinoAtivoId(exibido);
      if (aceita) setSaidasConcluidas((n) => n + 1);
    }
    window.addEventListener("popstate", aoMudarUrl);
    window.addEventListener("hashchange", aoMudarUrl);
    return () => {
      window.removeEventListener("popstate", aoMudarUrl);
      window.removeEventListener("hashchange", aoMudarUrl);
    };
  }, [papelDoAtor, escreverNoHistorico, entradas]);

  // Sair do shell (Hub, logout) não deixa a rota pendurada na URL: a próxima
  // entrada pelo Hub não deve ser sequestrada por ela. T178: efeito próprio,
  // sem dependências, para que só a DESMONTAGEM limpe — antes a limpeza vivia
  // no efeito dos ouvintes e rodaria também a cada troca de papel.
  useEffect(
    () => () => {
      primeiraExibicaoRef.current = true;
      if (destinoDaRota(window.location.hash) !== null) {
        // T200 — o estado (com o índice) fica: só a rota sai da URL.
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
    },
    [],
  );

  // Foco preso, `Escape` e devolução de foco — mesma disciplina do `Modal`
  // (UI-F04). Enquanto a gaveta está aberta ela é a única região alcançável:
  // deixá-la por cima da página e permitir que o `Tab` fosse para trás seria
  // afirmar uma coisa e permitir outra.
  useEffect(() => {
    if (!gavetaModal) return;
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
      // Devolver o foco a quem abriu é certo quando a gaveta FECHA; é
      // errado quando ela some porque a janela cresceu — ali o acionador
      // acabou de virar `display: none`, e focá-lo jogaria o foco para o
      // `body`. A pergunta é feita ao `matchMedia` na hora, e não a um
      // sinalizador guardado antes: numa mesma renderização a limpeza roda
      // ANTES do efeito que reagiria ao breakpoint, e o sinalizador chegaria
      // tarde.
      if (avaliarModoGaveta() && acionador && document.contains(acionador)) {
        acionador.focus();
      }
    };
  }, [gavetaModal]);

  const rotuloDoPapel = papelDoAtor ? ROTULO_PAPEL[papelDoAtor] : undefined;

  const tituloDoDestinoId =
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
                : (TITULO_ID_POR_DESTINO[destinoAtivoId] ?? "modulo-titulo");

  // T189 — depois de uma troca de empresa, o foco vai para o título da tela
  // de destino (ou, sem título no DOM, para a região principal, nomeada por
  // ele). Só na montagem: é a tela nova que precisa ser anunciada.
  const mainRef = useRef<HTMLElement | null>(null);
  const tituloAoMontarRef = useRef(
    focarTituloAoAbrir ? tituloDoDestinoId : null,
  );
  useEffect(() => {
    const id = tituloAoMontarRef.current;
    if (id === null) return;
    tituloAoMontarRef.current = null;
    const titulo = document.getElementById(id);
    const alvo = titulo ?? mainRef.current;
    if (!alvo) return;
    if (!alvo.hasAttribute("tabindex")) alvo.setAttribute("tabindex", "-1");
    alvo.focus();
  }, []);

  return (
    <div
      className={[
        "app-shell",
        gavetaModal ? "app-shell--gaveta-aberta" : "",
        trilho ? "app-shell--menu-recolhido" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* T200 — o salto só move o foco: seguir a âncora criaria uma entrada
          no histórico (e tiraria a rota da URL). */}
      <a
        className="app-shell__skip-link"
        href="#conteudo-principal"
        onClick={(evento) => {
          evento.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Pular para o conteúdo
      </a>

      <div className="app-shell__body">
        {gavetaModal ? (
          <button
            type="button"
            className="app-shell__fundo-gaveta"
            aria-label="Fechar menu"
            onClick={() => setGavetaAberta(false)}
          />
        ) : null}

        {/* R3 — a semântica de diálogo existe SÓ enquanto a gaveta é modal.
            No desktop este mesmo nó é a barra lateral permanente, e anunciar
            uma barra permanente como janela modal seria mentir para quem usa
            leitor de tela. */}
        <div
          className="app-shell__sidebar"
          id="navegacao-lateral"
          ref={sidebarRef}
          {...(gavetaModal
            ? {
                role: "dialog",
                "aria-modal": true,
                "aria-label": "Menu de navegação",
              }
            : {})}
        >
          <div className="app-shell__cabecalho-lateral">
            <span className="app-shell__marca">
              <MarcaEvolli />
              <span className="app-shell__marca-texto">
                <span className="app-shell__marca-nome">Evolli RH</span>
                <span className="app-shell__marca-tag">
                  Painel Administrativo
                </span>
              </span>
            </span>

            {/* T206 — um nó só nos dois estados: o foco fica nele ao alternar,
                e o leitor de tela ouve a mudança uma vez, pelo próprio botão
                (nome e `aria-expanded`), sem região de anúncio duplicando. No
                modo gaveta ele sai da tabulação com `hidden`: a gaveta é
                sempre o menu inteiro. */}
            <button
              type="button"
              ref={botaoRecolherRef}
              className="app-shell__recolher"
              aria-expanded={!trilho}
              aria-controls={ID_NAVEGACAO_PAINEL}
              data-dica={trilho ? "Expandir menu" : "Recolher menu"}
              hidden={modoGaveta}
              onClick={() => definirRecolhido(!recolhido)}
            >
              <IconeRecolherMenu />
              <span className="app-shell__oculto">
                {trilho ? "Expandir menu" : "Recolher menu"}
              </span>
            </button>
          </div>

          {/* T189 — a empresa ativa, logo abaixo da marca. Só na sessão
              autenticada (mesmo critério de "Sair"): sem sessão não há
              empresa a mostrar. */}
          {onLogout ? (
            <SeletorEmpresaAtiva
              id="menu-empresa-ativa"
              variante="menu"
              empresaAtiva={empresaAtiva}
              podeTrocarEmpresa={podeTrocarEmpresa}
              papelDoAtor={papelDoAtor}
              onEmpresaTrocada={(empresa) => onEmpresaTrocada?.(empresa)}
              compacto={trilho}
              onExpandirMenu={expandirMenu}
            />
          ) : null}

          {/* T159 — o shell passa o papel e a navegação decide sozinha quais
              destinos condicionados oferecer, lendo os papéis declarados no
              mapa. Antes a lista de capacidades era remontada aqui, longe dos
              destinos, e já havia divergido deles. */}
          <PainelNavigation
            destinoAtivoId={destinoAtivoId}
            onSelecionar={irPara}
            papel={papelDoAtor}
            recolhido={trilho}
            onExpandir={expandirMenu}
          />

          <DicaDoTrilho raizRef={sidebarRef} ativa={!modoGaveta} />
        </div>

        {/* T206 — cabeçalho, painéis, conteúdo e rodapé formam a coluna à
            direita do menu: nada fica entre a navegação e o conteúdo. */}
        <div className="app-shell__coluna">
          <header
            className="app-shell__topbar"
            {...(gavetaModal ? FUNDO_INERTE : {})}
          >
            <div className="app-shell__topbar-inner">
              <button
                type="button"
                className="app-shell__menu"
                ref={botaoMenuRef}
                aria-expanded={gavetaModal}
                aria-controls="navegacao-lateral"
                onClick={alternarGaveta}
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
                {onVoltarAoHub ? (
                  <button
                    type="button"
                    className="app-shell__hub"
                    onClick={() =>
                      guardaRef.current.solicitarSaida({
                        executar: onVoltarAoHub,
                      })
                    }
                  >
                    Hub
                  </button>
                ) : null}
                {onLogout ? (
                  <button
                    type="button"
                    className="app-shell__logout"
                    onClick={() =>
                      guardaRef.current.solicitarSaida({ executar: onLogout })
                    }
                  >
                    Sair
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          {onLogout && mfaDisponivel && segurancaAberto ? (
            <div
              className="app-shell__sessoes-ativas-wrapper"
              {...(gavetaModal ? FUNDO_INERTE : {})}
            >
              <SegurancaMfaPanel
                aberto={segurancaAberto}
                onFechar={() => setSegurancaAberto(false)}
                onSessaoAtualEncerrada={() => onSessaoAtualEncerrada?.()}
              />
            </div>
          ) : null}

          {onLogout && sessoesAtivasAberto ? (
            <div
              className="app-shell__sessoes-ativas-wrapper"
              {...(gavetaModal ? FUNDO_INERTE : {})}
            >
              <SessoesAtivasPanel
                aberto={sessoesAtivasAberto}
                onFechar={() => setSessoesAtivasAberto(false)}
                onSessaoAtualEncerrada={() => onSessaoAtualEncerrada?.()}
              />
            </div>
          ) : null}

          <main
            id="conteudo-principal"
            className="app-shell__main"
            tabIndex={-1}
            {...(gavetaModal ? FUNDO_INERTE : {})}
            ref={mainRef}
            aria-labelledby={tituloDoDestinoId}
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
              empresaAtiva,
              {
                onAbrirAdmitido: abrirAdmitido,
                podeAdmitir,
                papelDoAtor,
              },
              {
                ficha,
                focarContatos: focarContatosNaFicha,
                onAbrir: abrirFicha,
                onTrocarAba: trocarAbaDaFicha,
                onTrocarCompetencia: trocarCompetenciaDaFicha,
                onFechar: fecharFicha,
                listagem,
                onListagemChange: mudarListagem,
              },
              {
                ano: anoDoDashboard,
                onTrocarAno: trocarAnoDoDashboard,
                onAbrirListagem: abrirListagemDoDashboard,
              },
            )}
          </main>

          <footer
            className="app-shell__footer"
            {...(gavetaModal ? FUNDO_INERTE : {})}
          >
            <div className="app-shell__footer-inner">
              <span className="app-shell__footer-brand">Evolli RH</span>
              <span>Ambiente interno · sem dados reais</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
