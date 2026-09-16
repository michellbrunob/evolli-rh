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

type EstadoSessao = "verificando" | "login" | "autenticado";

export function AutenticacaoApp() {
  const [estado, setEstado] = useState<EstadoSessao>("verificando");

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

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Mesmo se o servidor não confirmar a revogação (rede fora do ar,
      // sessão já expirada), a aba não pode ficar presa numa tela que
      // parece autenticada — segue para o login de qualquer forma.
    } finally {
      clearCsrfToken();
      setEstado("login");
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

  return <App onLogout={() => void handleLogout()} />;
}
