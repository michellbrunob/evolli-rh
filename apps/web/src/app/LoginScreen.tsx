/**
 * Login web (T116) — e-mail e senha, contra o backend de autenticação já
 * existente (`POST /v1/auth/login`).
 *
 * Sem cadastro público, gestão de usuários, redefinição de senha, MFA ou
 * SSO nesta tela — o envio de e-mail de recuperação ainda não está
 * provisionado de ponta a ponta (fora de escopo desta fundação).
 *
 * A mensagem de erro é SEMPRE a mesma para qualquer falha de credencial
 * (401): nunca indica se o e-mail existe, se foi a senha que falhou ou se a
 * conta está bloqueada — o próprio backend já responde de forma
 * indistinguível para todos esses casos (anti-enumeração, spec §6); esta
 * tela só preserva essa propriedade, nunca a enfraquece. "Muitas tentativas"
 * (429) é tratada à parte: não é sobre identidade, é sobre volume de
 * requisições, e o próprio backend já limita por e-mail normalizado + IP
 * independentemente de a conta existir. Qualquer outra falha (servidor fora
 * do ar, erro inesperado) recebe uma terceira mensagem, também genérica, mas
 * que não sugere credencial errada — não seria honesto dizer "e-mail ou
 * senha inválidos" quando o problema é de infraestrutura.
 */
import { useId, useState } from "react";
import { Button, FormField } from "../components";
import { ApiError, login } from "../api/authClient";
import "./LoginScreen.css";

export const LOGIN_TITULO_ID = "login-titulo";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

function mensagemErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.status === 401) {
      return "E-mail ou senha inválidos.";
    }
    if (erro.status === 429) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    return "Não foi possível entrar. Tente novamente em instantes.";
  }
  return "Não foi possível entrar. Verifique sua conexão e tente novamente.";
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emailId = useId();
  const senhaId = useId();

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setErro(null);
    try {
      await login({ email, password: senha });
      onLoginSuccess();
    } catch (err: unknown) {
      // Nunca mantém a senha em memória de estado além do necessário para a
      // tentativa que já falhou.
      setSenha("");
      setEnviando(false);
      setErro(mensagemErro(err));
    }
  }

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <h1 id={LOGIN_TITULO_ID} className="login-screen__title">
          Entrar
        </h1>
        <p className="login-screen__subtitle">
          Acesse o Painel Administrativo Evolli RH com seu e-mail e senha.
        </p>

        <form
          className="login-screen__form"
          aria-label="Formulário de login"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <FormField id={emailId} label="E-mail" required>
            {(control) => (
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro(null);
                }}
                {...control}
              />
            )}
          </FormField>

          <FormField id={senhaId} label="Senha" required>
            {(control) => (
              <input
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro(null);
                }}
                {...control}
              />
            )}
          </FormField>

          {erro ? (
            <p className="login-screen__erro" role="alert">
              {erro}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
