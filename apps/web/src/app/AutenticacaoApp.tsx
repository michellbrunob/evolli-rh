/**
 * Portão de sessão (T116) — decide entre "Verificando…", a tela de login e o
 * shell autenticado (`App`). Este é o componente montado por `main.tsx`;
 * `App` nunca é montado diretamente fora daqui.
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
 * Enquanto a sessão não está confirmada ("verificando"), NADA do shell —
 * nem `PainelNavigation`, nem qualquer tela interna — é renderizado.
 */
import { useEffect, useState } from "react";
import "./tokens.css";
import "./AutenticacaoApp.css";
import { App } from "./App";
import { LoginScreen } from "./LoginScreen";
import { logout } from "../api/authClient";
import { clearCsrfToken, refreshCsrfToken } from "../api/csrfClient";
import { obterUsuarioAtual } from "../api/usersClient";

type EstadoSessao = "verificando" | "login" | "autenticado";

export function AutenticacaoApp() {
  const [estado, setEstado] = useState<EstadoSessao>("verificando");
  // T131 — disponibilidade do MFA decidida pelo SERVIDOR (`GET /v1/users/me`).
  // Padrão `false` (seguro): a UI de MFA só aparece após o servidor confirmar
  // que o recurso está ativado. Nunca uma flag de frontend liga o recurso.
  const [mfaDisponivel, setMfaDisponivel] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarSessao() {
      try {
        await refreshCsrfToken();
        if (!cancelado) setEstado("autenticado");
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

  // T131 — ao autenticar, pergunta ao servidor se o MFA está disponível e
  // repassa ao shell. Falha ou ausência do campo → mantém `false` (seguro: a UI
  // de MFA fica oculta). O servidor permanece autoritativo de qualquer forma.
  useEffect(() => {
    if (estado !== "autenticado") {
      setMfaDisponivel(false);
      return;
    }
    let cancelado = false;
    async function carregarDisponibilidadeMfa() {
      try {
        const eu = await obterUsuarioAtual();
        if (!cancelado) setMfaDisponivel(eu.mfaAvailable === true);
      } catch {
        if (!cancelado) setMfaDisponivel(false);
      }
    }
    void carregarDisponibilidadeMfa();
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
  function encerrarSessaoLocalmente() {
    clearCsrfToken();
    setEstado("login");
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Mesmo se o servidor não confirmar a revogação (rede fora do ar,
      // sessão já expirada), a aba não pode ficar presa numa tela que
      // parece autenticada — segue para o login de qualquer forma.
    } finally {
      encerrarSessaoLocalmente();
    }
  }

  if (estado === "verificando") {
    return (
      <div className="autenticacao-app__verificando" role="status">
        Verificando sessão…
      </div>
    );
  }

  if (estado === "login") {
    return <LoginScreen onLoginSuccess={() => setEstado("autenticado")} />;
  }

  return (
    <App
      onLogout={() => void handleLogout()}
      onSessaoAtualEncerrada={encerrarSessaoLocalmente}
      mfaDisponivel={mfaDisponivel}
    />
  );
}
