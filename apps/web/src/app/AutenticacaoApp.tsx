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
 * O produto aberto também volta ao Hub na troca. Continuar dentro de
 * "Pessoas" depois de mudar de empresa mostraria a mesma tela com outro
 * universo de dados, sem que nada na interface marcasse a mudança.
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
import { useCallback, useEffect, useState } from "react";
import "./tokens.css";
import "./AutenticacaoApp.css";
import { App } from "./App";
import { HubPosLogin } from "./HubPosLogin";
import { LoginScreen } from "./LoginScreen";
import { destinoDaRota } from "./rotasDoShell";
import { logout } from "../api/authClient";
import { clearCsrfToken, refreshCsrfToken } from "../api/csrfClient";
import { obterUsuarioAtual, type SafeAccessUserApi } from "../api/usersClient";

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
    setEstado("login");
  }, []);

  /**
   * T163 — o servidor confirmou uma troca de empresa; reresolve o ator.
   *
   * Volta a `resolvendo-ator`, exatamente o caminho do login. Duas coisas
   * acontecem por isso: `/v1/users/me` devolve a empresa ativa NOVA, e nada
   * funcional fica montado durante a transição — a mesma garantia da T153,
   * agora valendo também para a troca de contexto.
   *
   * O produto aberto volta a `null`: depois de mudar de empresa, a pessoa
   * reentra pelo Hub, e não no meio de um módulo cujo conteúdo acabou de
   * trocar de universo sem aviso.
   */
  const recarregarContexto = useCallback(() => {
    setDestinoAberto(null);
    setEstado("resolvendo-ator");
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

  if (estado === "verificando-sessao") {
    return (
      <div className="autenticacao-app__verificando" role="status">
        Verificando sessão…
      </div>
    );
  }

  if (estado === "login") {
    return <LoginScreen onLoginSuccess={() => setEstado("resolvendo-ator")} />;
  }

  if (estado === "resolvendo-ator") {
    return (
      <div className="autenticacao-app__verificando" role="status">
        Carregando seu acesso…
      </div>
    );
  }

  if (estado === "falha-ator" || ator === null) {
    // `ator === null` no mesmo ramo não é redundância defensiva: é o que
    // torna impossível, por tipo, renderizar `<App>` sem ator — o `ator.role`
    // abaixo não compila de outro jeito.
    return (
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
      </div>
    );
  }

  // T163 — a chave inclui a empresa ATIVA. Trocar de empresa remonta tudo,
  // e com isso nenhum dado da empresa anterior sobrevive na tela.
  const chaveDaArvore = `${ator.id}:${ator.companyId ?? "global"}`;

  if (destinoAberto === null) {
    return (
      <HubPosLogin
        key={chaveDaArvore}
        papelDoAtor={ator.role}
        empresaAtiva={ator.empresaAtiva ?? null}
        podeTrocarEmpresa={ator.podeTrocarEmpresa === true}
        emailDoAtor={ator.email}
        onAbrirDestino={setDestinoAberto}
        onEmpresaTrocada={recarregarContexto}
        onLogout={() => void handleLogout()}
      />
    );
  }

  return (
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
      // T164 — a empresa ATIVA desce para as telas que precisam dizer em qual
      // empresa o que esta visivel foi lido. Mesma fonte do Hub: o ator.
      empresaAtiva={ator.empresaAtiva ?? null}
      destinoInicial={destinoAberto}
      onVoltarAoHub={() => setDestinoAberto(null)}
    />
  );
}
