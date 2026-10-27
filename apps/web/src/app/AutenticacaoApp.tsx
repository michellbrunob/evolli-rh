/**
 * Portão de sessão (T116; estados explícitos na T153) — decide entre
 * "Verificando…", a tela de login, a resolução do ator e o shell autenticado
 * (`App`). Este é o componente montado por `main.tsx`; `App` nunca é montado
 * diretamente fora daqui.
 *
 * Restauração de sessão ao recarregar a página: o único caminho suportado
 * pela API é `GET /v1/auth/csrf` (exige `SessionGuard` — cookie de sessão
 * HttpOnly). Reaproveita `refreshCsrfToken` como o próprio checador de
 * sessão (200 → sessão válida, token novo em memória; 401 → sessão ausente/
 * expirada) — não existe endpoint de sessão dedicado, e não há necessidade
 * de um novo: o mesmo GET que a aplicação já usava para o token cumpre as
 * duas funções. Nunca usa localStorage, sessionStorage ou cookie legível
 * por script para isso.
 *
 * ## Por que existe um estado a mais desde a T153
 *
 * Antes havia três estados, e "sessão válida" montava o shell **na hora**.
 * A leitura de `GET /v1/users/me` corria em paralelo, só para alimentar
 * `mfaDisponivel`. Consequência medida em navegador: o shell montava no
 * destino padrão "Cadastros", a tela de horários disparava
 * `GET /v1/horarios` e um `gestor` — que não tem essa capacidade — recebia
 * **403 antes mesmo de o papel dele ser conhecido**. No refresh a ordem era
 * literalmente `/v1/horarios` **antes** de `/v1/users/me`.
 *
 * Esconder o destino depois, por efeito, não resolveria: a requisição
 * proibida já teria saído e a tela proibida já teria piscado. A única
 * correção que elimina as duas coisas é **não montar nada funcional
 * enquanto o ator não for conhecido** — e é isso que o estado
 * `resolvendo-ator` faz.
 *
 * ## Fail-closed
 *
 * Falha ao resolver o ator **não** cai no shell com papel desconhecido: cai
 * numa tela segura, com nova tentativa e saída. Resposta que chega sem um
 * `role` utilizável conta como falha — "montar com o papel conhecido" exige
 * conhecê-lo, e um shell montado sem papel é exatamente o estado que
 * produzia o 403.
 *
 * ## Troca de empresa remonta a árvore (T163)
 *
 * Quando o servidor confirma uma troca de contexto empresarial, não basta
 * atualizar um pedaço da tela: **tudo** o que estava montado foi desenhado
 * com dados da empresa anterior. Então o ator é resolvido de novo — a mesma
 * passagem por `resolvendo-ator` do login — e a `key` da árvore passa a
 * incluir a empresa ativa.
 *
 * Trocar a `key` desmonta e remonta Hub e shell. É assim que nenhum dado da
 * empresa anterior sobra na tela: não há o que limpar, porque os componentes
 * que o exibiam deixaram de existir. Limpar estado "na mão" dependeria de
 * lembrar de cada lugar — e o primeiro esquecido seria vazamento entre
 * empresas.
 *
 * ## T189 — a troca mantém o módulo, e as outras abas sabem dela
 *
 * Até a T188 a troca devolvia a pessoa ao Hub. Com o seletor no topo do menu
 * lateral, ela fica no **mesmo módulo**, na tela inicial segura dele
 * (`destinoAposTrocaDeEmpresa`): a árvore continua sendo recriada, então
 * busca, filtros, seleção e ficha da empresa anterior somem do mesmo jeito; a
 * troca é anunciada (região `role="status"` que sobrevive à remontagem) e o
 * foco vai para o título da tela.
 *
 * Todas as abas compartilham a sessão — e, portanto, a empresa ativa. Depois
 * de uma troca, esta aba avisa as outras (`sincronizacaoDeContexto`); ao
 * receber o aviso, ou ao voltar a ter foco, cada aba reconfere
 * `GET /v1/users/me` e se recria no contexto que o servidor informar. Se ela
 * tem edição pendente, nada é descartado em silêncio: um aviso bloqueia a tela
 * e deixa a pessoa voltar à empresa anterior ou seguir na nova
 * (`AvisoContextoAlterado`). É mitigação no navegador; a verificação
 * definitiva no servidor fica fora desta tarefa.
 *
 * ## O Hub entra entre o ator resolvido e o shell (T162)
 *
 * `pronto` deixou de significar "monta o shell" e passou a significar "o ator
 * é conhecido". Com o ator conhecido, a primeira tela é o **Hub**, que diz o
 * que este acesso abre; o shell só monta quando alguém escolhe um produto
 * ali. Os quatro estados anteriores não mudaram, e a ordem que a T153 fixou
 * continua valendo — o Hub não dispara nenhuma requisição funcional, e a
 * única leitura que faz (`GET /v1/empresas`, para o nome da empresa) acontece
 * só para papéis a que o RBAC concede `empresa:read`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./tokens.css";
import "./AutenticacaoApp.css";
import { App } from "./App";
import { AvisoContextoAlterado } from "./AvisoContextoAlterado";
import { HubPosLogin } from "./HubPosLogin";
import { LoginScreen } from "./LoginScreen";
import { ProvedorDeEdicoes, useRegistroDeEdicoes } from "./edicoesPendentes";
import { ProvedorDeEmpresasDoContexto } from "./SeletorEmpresaAtiva";
import {
  abrirCanalDeContexto,
  type CanalDeContexto,
} from "./sincronizacaoDeContexto";
import { destinoAposTrocaDeEmpresa, destinoDaRota } from "./rotasDoShell";
import { logout } from "../api/authClient";
import {
  trocarEmpresaDoContexto,
  type EmpresaDoContextoApi,
} from "../api/contextoEmpresarialClient";
import { clearCsrfToken, refreshCsrfToken } from "../api/csrfClient";
import {
  ApiError,
  obterUsuarioAtual,
  type SafeAccessUserApi,
} from "../api/usersClient";

type EstadoSessao =
  /** Checando o cookie de sessão. Nada do shell existe. */
  | "verificando-sessao"
  /** Sem sessão: tela de login. */
  | "login"
  /** Sessão válida, lendo o ator. **Nada funcional monta aqui.** */
  | "resolvendo-ator"
  /** Ator resolvido: só agora o shell existe, já com o papel conhecido. */
  | "pronto"
  /** Não foi possível resolver o ator: falha fechado, sem shell. */
  | "falha-ator";

/** Tira a árvore antiga do alcance enquanto o aviso de contexto decide. */
const FUNDO_INERTE: Record<string, string> = {
  inert: "",
  "aria-hidden": "true",
};

/** "Empresa X (código X)" ou o acesso global — só o que o servidor devolveu. */
function descreverEmpresa(
  empresa:
    { readonly nome: string; readonly codigo: string } | null | undefined,
): string {
  return empresa
    ? `${empresa.nome} (código ${empresa.codigo})`
    : "acesso global — todas as empresas";
}

export function AutenticacaoApp() {
  const [estado, setEstado] = useState<EstadoSessao>("verificando-sessao");
  /**
   * O ator resolvido. É a ÚNICA fonte de `mfaDisponivel` e do papel — os dois
   * saem da mesma leitura, sem requisição extra. Nulo em qualquer estado que
   * não seja `pronto`, de modo que não exista caminho em que o shell veja o
   * ator da sessão anterior.
   */
  const [ator, setAtor] = useState<SafeAccessUserApi | null>(null);
  /**
   * Produto aberto a partir do Hub. `null` é o Hub — o estado em que a sessão
   * nasce e ao qual ela volta.
   *
   * T178 — exceção única: a URL já traz uma rota conhecida do shell
   * (`rotasDoShell.ts`), como ao recarregar `#/pessoas/colaboradores`. Aí a
   * sessão abre direto nesse destino, sem passar pelo Hub: a rota sobrevive ao
   * recarregamento. Não é atalho de permissão — o `App` passa o pedido pela
   * mesma `resolverEntrada` de sempre, e papel que não abre o destino cai no
   * seu destino permitido. Logout e troca de empresa continuam voltando ao Hub.
   */
  const [destinoAberto, setDestinoAberto] = useState<string | null>(() =>
    destinoDaRota(window.location.hash),
  );

  /** T189 — edições pendentes e salvamentos em andamento, da árvore toda. */
  const registro = useRegistroDeEdicoes();
  /**
   * T189 — o que a região `role="status"` anuncia. Ela fica FORA da árvore
   * recriada na troca, para que o anúncio sobreviva à remontagem.
   */
  const [anuncio, setAnuncio] = useState("");
  /** T189 — a próxima tela montada leva o foco ao próprio título. */
  const [focarTitulo, setFocarTitulo] = useState(false);
  /**
   * T189 — o ator que o servidor informou depois de uma mudança de empresa
   * feita por fora desta aba, enquanto ela tem edição pendente. Não nulo
   * significa: aviso na tela, árvore antiga inerte.
   */
  const [contextoAlterado, setContextoAlterado] =
    useState<SafeAccessUserApi | null>(null);

  // Leituras fora do desenho (ouvintes de foco e do canal) precisam do valor
  // atual, não do capturado quando o ouvinte foi criado.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const atorRef = useRef(ator);
  atorRef.current = ator;
  const destinoAbertoRef = useRef(destinoAberto);
  destinoAbertoRef.current = destinoAberto;
  const contextoAlteradoRef = useRef(contextoAlterado);
  contextoAlteradoRef.current = contextoAlterado;
  /** O destino que o shell exibe agora (ele avisa a cada mudança). */
  const destinoExibidoRef = useRef<string | null>(null);
  const reconferindoRef = useRef(false);
  const canalRef = useRef<CanalDeContexto | null>(null);

  useEffect(() => {
    const canal = abrirCanalDeContexto();
    canalRef.current = canal;
    return () => {
      canal?.fechar();
      canalRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function verificarSessao() {
      try {
        await refreshCsrfToken();
        // Sessão válida não é o fim: agora o ator precisa ser resolvido
        // ANTES de qualquer tela funcional montar.
        if (!cancelado) setEstado("resolvendo-ator");
      } catch {
        // Sessão ausente, expirada ou qualquer outra falha na verificação:
        // trata como não autenticado — a própria tela de login permite
        // tentar de novo ao entrar.
        if (!cancelado) setEstado("login");
      }
    }

    void verificarSessao();
    return () => {
      cancelado = true;
    };
  }, []);

  // Resolução do ator. Roda só em `resolvendo-ator`, e é o único caminho
  // para `pronto` — não há como o shell montar sem passar por aqui.
  useEffect(() => {
    if (estado !== "resolvendo-ator") return;
    let cancelado = false;

    async function resolverAtor() {
      try {
        const eu = await obterUsuarioAtual();
        if (cancelado) return;
        // Papel ausente ou vazio é falha, não "papel nulo": seguir com o
        // shell montado e papel desconhecido é o estado que esta correção
        // existe para eliminar.
        if (typeof eu?.role !== "string" || eu.role.trim() === "") {
          setAtor(null);
          setEstado("falha-ator");
          return;
        }
        setAtor(eu);
        setEstado("pronto");
      } catch {
        // Nada do corpo da resposta é lido nem exibido: a mensagem da tela
        // de falha é escrita por nós.
        if (cancelado) return;
        setAtor(null);
        setEstado("falha-ator");
      }
    }

    void resolverAtor();
    return () => {
      cancelado = true;
    };
  }, [estado]);

  /**
   * Limpa só o estado em memória e volta ao login — nunca toca em
   * storage. Usado tanto pelo logout explícito (depois de tentar avisar o
   * servidor) quanto por `SessoesAtivasPanel` (T117), quando ele descobre —
   * por uma releitura que responde 401, nunca por adivinhação — que a
   * sessão desta aba já não é válida (foi a sessão revogada em "Sessões
   * ativas", ou expirou por outro motivo).
   */
  const encerrarSessaoLocalmente = useCallback(() => {
    clearCsrfToken();
    // O ator sai JUNTO com a sessão. Sem isto, uma nova sessão poderia
    // montar o shell com o papel — e o destino inicial — do usuário
    // anterior.
    setAtor(null);
    // E o produto aberto sai junto com os dois: a sessão seguinte começa no
    // Hub, nunca dentro do módulo em que a anterior estava.
    setDestinoAberto(null);
    setContextoAlterado(null);
    setAnuncio("");
    setEstado("login");
  }, []);

  /** O módulo em que a pessoa está, ou `null` no Hub. */
  const destinoAtual = useCallback((): string | null => {
    const aberto = destinoAbertoRef.current;
    return aberto === null ? null : (destinoExibidoRef.current ?? aberto);
  }, []);

  /**
   * T163 — o servidor confirmou uma troca de empresa; reresolve o ator.
   *
   * Volta a `resolvendo-ator`, exatamente o caminho do login. Duas coisas
   * acontecem por isso: `/v1/users/me` devolve a empresa ativa NOVA, e nada
   * funcional fica montado durante a transição — a mesma garantia da T153,
   * agora valendo também para a troca de contexto.
   *
   * T189 — o produto aberto NÃO volta mais ao Hub: a pessoa fica no mesmo
   * módulo, na tela inicial segura dele, e a troca é anunciada. As outras
   * abas são avisadas para reconferir o próprio contexto.
   */
  const aoTrocarEmpresa = useCallback(
    (empresa: EmpresaDoContextoApi) => {
      canalRef.current?.avisar();
      setDestinoAberto(destinoAposTrocaDeEmpresa(destinoAtual()));
      setAnuncio(`Empresa ativa alterada para ${descreverEmpresa(empresa)}.`);
      setFocarTitulo(true);
      setEstado("resolvendo-ator");
    },
    [destinoAtual],
  );

  /**
   * T189 — aplica o contexto que o servidor informou depois de uma mudança
   * feita por fora desta aba. Trocar o ator troca a `key` da árvore: tudo é
   * recriado, no mesmo módulo (ou no Hub, se a conta é outra).
   */
  const aplicarContextoAlterado = useCallback(
    (eu: SafeAccessUserApi) => {
      const mesmaConta = eu.id === atorRef.current?.id;
      // Sem passar por `resolvendo-ator`, o shell novo nasce ANTES de o antigo
      // limpar a URL ao desmontar — e leria a rota da tela anterior (a Nova
      // admissão, por exemplo). A rota sai aqui; o shell novo escreve a do
      // destino reduzido.
      if (destinoDaRota(window.location.hash) !== null) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      setContextoAlterado(null);
      setDestinoAberto(
        mesmaConta ? destinoAposTrocaDeEmpresa(destinoAtual()) : null,
      );
      setAnuncio(
        `A empresa ativa desta sessão mudou. Empresa ativa: ${descreverEmpresa(eu.empresaAtiva)}.`,
      );
      setFocarTitulo(true);
      setAtor(eu);
    },
    [destinoAtual],
  );

  /**
   * T189 — reconfere o contexto com o servidor (aviso de outra aba, ou a aba
   * voltou a ter foco). O aviso entre abas nunca é tomado como verdade: quem
   * decide é `GET /v1/users/me`.
   */
  const reconferirContexto = useCallback(async () => {
    if (
      estadoRef.current !== "pronto" ||
      reconferindoRef.current ||
      contextoAlteradoRef.current !== null
    ) {
      return;
    }
    const atual = atorRef.current;
    if (atual === null) return;
    reconferindoRef.current = true;
    try {
      const eu = await obterUsuarioAtual();
      // Algo mudou enquanto a leitura voava (uma troca nesta própria aba, um
      // logout): a leitura já não descreve a tela.
      if (estadoRef.current !== "pronto" || atorRef.current !== atual) return;
      if (typeof eu?.role !== "string" || eu.role.trim() === "") return;
      const mesmaConta = eu.id === atual.id;
      const mesmaEmpresa = (eu.companyId ?? null) === (atual.companyId ?? null);
      if (mesmaConta && mesmaEmpresa) return;
      const resumo = registro.obter();
      if (resumo.pendentes.length > 0 || resumo.salvando.length > 0) {
        setContextoAlterado(eu);
        return;
      }
      aplicarContextoAlterado(eu);
    } catch (erro) {
      // Sessão encerrada por fora (logout em outra aba, expiração): a mesma
      // saída de `SessoesAtivasPanel`. Outras falhas não mudam nada — a
      // próxima reconferência tenta de novo.
      if (erro instanceof ApiError && erro.status === 401) {
        encerrarSessaoLocalmente();
      }
    } finally {
      reconferindoRef.current = false;
    }
  }, [registro, aplicarContextoAlterado, encerrarSessaoLocalmente]);

  // T189 — quando reconferir: aviso de outra aba, aba visível de novo, janela
  // com foco de novo. Só com o ator conhecido.
  useEffect(() => {
    if (estado !== "pronto") return;
    const pararDeOuvir = canalRef.current?.ouvir(
      () => void reconferirContexto(),
    );
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void reconferirContexto();
    };
    const aoFocar = () => void reconferirContexto();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("focus", aoFocar);
    return () => {
      pararDeOuvir?.();
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("focus", aoFocar);
    };
  }, [estado, reconferirContexto]);

  // O pedido de foco vale para UMA montagem: a tela que acabou de nascer já o
  // leu no próprio efeito de montagem, que roda antes deste.
  useEffect(() => {
    if (estado === "pronto" && focarTitulo) setFocarTitulo(false);
  }, [estado, focarTitulo]);

  /**
   * T189 — volta a sessão para a empresa em que esta aba estava, pelo mesmo
   * contrato de troca. A árvore não é recriada: a edição continua intacta.
   */
  const voltarAoContextoAnterior = useCallback(async () => {
    const anterior = atorRef.current?.companyId ?? null;
    if (anterior === null) throw new Error("sem empresa anterior");
    await trocarEmpresaDoContexto(anterior);
    canalRef.current?.avisar();
    setContextoAlterado(null);
    setAnuncio(
      "Esta aba voltou à empresa em que estava. As alterações não salvas foram mantidas.",
    );
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Mesmo se o servidor não confirmar a revogação (rede fora do ar,
      // sessão já expirada), a aba não pode ficar presa numa tela que
      // parece autenticada — segue para o login de qualquer forma.
    } finally {
      encerrarSessaoLocalmente();
    }
  }, [encerrarSessaoLocalmente]);

  // T189 — a região de anúncio fica fora de qualquer árvore que a troca
  // recria; o registro de edições e a lista de empresas, acima delas. A lista
  // tem `key` no ator: outra conta, outra leitura — e a troca de empresa da
  // mesma conta não a relê.
  const comContexto = (conteudo: ReactNode) => (
    <ProvedorDeEdicoes registro={registro}>
      <div
        className="autenticacao-app__anuncio"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {anuncio}
      </div>
      <ProvedorDeEmpresasDoContexto
        key={ator?.id ?? "sem-ator"}
        podeTrocarEmpresa={ator?.podeTrocarEmpresa === true}
      >
        {conteudo}
      </ProvedorDeEmpresasDoContexto>
    </ProvedorDeEdicoes>
  );

  if (estado === "verificando-sessao") {
    return comContexto(
      <div className="autenticacao-app__verificando" role="status">
        Verificando sessão…
      </div>,
    );
  }

  if (estado === "login") {
    return comContexto(
      <LoginScreen onLoginSuccess={() => setEstado("resolvendo-ator")} />,
    );
  }

  if (estado === "resolvendo-ator") {
    return comContexto(
      <div className="autenticacao-app__verificando" role="status">
        Carregando seu acesso…
      </div>,
    );
  }

  if (estado === "falha-ator" || ator === null) {
    // `ator === null` no mesmo ramo não é redundância defensiva: é o que
    // torna impossível, por tipo, renderizar `<App>` sem ator — o `ator.role`
    // abaixo não compila de outro jeito.
    return comContexto(
      <div className="autenticacao-app__falha" role="alert">
        <p>Não foi possível carregar seu acesso.</p>
        <p>
          Sua sessão continua ativa. Tente novamente ou saia e entre de novo.
        </p>
        <div className="autenticacao-app__falha-acoes">
          <button type="button" onClick={() => setEstado("resolvendo-ator")}>
            Tentar novamente
          </button>
          <button type="button" onClick={() => void handleLogout()}>
            Sair
          </button>
        </div>
      </div>,
    );
  }

  // T163 — a chave inclui a empresa ATIVA. Trocar de empresa remonta tudo,
  // e com isso nenhum dado da empresa anterior sobrevive na tela.
  const chaveDaArvore = `${ator.id}:${ator.companyId ?? "global"}`;
  const podeTrocarEmpresa = ator.podeTrocarEmpresa === true;

  const arvore =
    destinoAberto === null ? (
      <HubPosLogin
        key={chaveDaArvore}
        papelDoAtor={ator.role}
        empresaAtiva={ator.empresaAtiva ?? null}
        podeTrocarEmpresa={podeTrocarEmpresa}
        emailDoAtor={ator.email}
        onAbrirDestino={setDestinoAberto}
        onEmpresaTrocada={aoTrocarEmpresa}
        onLogout={() => void handleLogout()}
        focarTituloAoAbrir={focarTitulo}
      />
    ) : (
      <App
        // Ator diferente força remontagem, e com ela o recálculo do destino
        // inicial. O caminho normal (logout → login) já desmonta o `App`; a
        // chave cobre qualquer caminho futuro que troque o ator sem passar
        // pelo login. Desde a T163 ela inclui também a empresa ativa.
        key={chaveDaArvore}
        onLogout={() => void handleLogout()}
        onSessaoAtualEncerrada={encerrarSessaoLocalmente}
        mfaDisponivel={ator.mfaAvailable === true}
        papelDoAtor={ator.role}
        // T164 — a empresa ATIVA desce para as telas que precisam dizer em
        // qual empresa o que esta visivel foi lido. Mesma fonte do Hub: o ator.
        empresaAtiva={ator.empresaAtiva ?? null}
        // T189 — e o seletor do menu lateral, com o mesmo poder de troca.
        podeTrocarEmpresa={podeTrocarEmpresa}
        onEmpresaTrocada={aoTrocarEmpresa}
        onDestinoAlterado={(destinoId) => {
          destinoExibidoRef.current = destinoId;
        }}
        focarTituloAoAbrir={focarTitulo}
        destinoInicial={destinoAberto}
        onVoltarAoHub={() => {
          destinoExibidoRef.current = null;
          setDestinoAberto(null);
        }}
      />
    );

  return comContexto(
    <>
      {/* O invólucro existe SEMPRE: aparecer só com o aviso mudaria o pai da
          árvore e a recriaria — descartando justamente a edição que o aviso
          protege. */}
      <div
        className="autenticacao-app__arvore"
        {...(contextoAlterado ? FUNDO_INERTE : {})}
      >
        {arvore}
      </div>
      {contextoAlterado ? (
        <AvisoContextoAlterado
          empresaNova={descreverEmpresa(contextoAlterado.empresaAtiva)}
          podeVoltar={
            contextoAlterado.id === ator.id && ator.companyId !== null
          }
          onVoltar={voltarAoContextoAnterior}
          onContinuar={() => aplicarContextoAlterado(contextoAlterado)}
        />
      ) : null}
    </>,
  );
}
