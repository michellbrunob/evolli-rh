/**
 * Login web (T116) + verificação de 2º fator (T126).
 *
 * Máquina de duas fases dentro da própria tela de login, sem renderizar o
 * shell: `credenciais` → (se o backend indicar MFA) → `mfa`. Enquanto o 2º
 * fator não é verificado, NENHUMA sessão plena existe e o shell nunca aparece
 * — só `onLoginSuccess` (chamado após sessão real) libera o `AutenticacaoApp`.
 *
 * Sem cadastro público, gestão de usuários, redefinição de senha ou SSO nesta
 * tela. O `challengeToken` opaco vive só em estado de componente (memória),
 * nunca em storage/URL/DOM persistente, e é descartado ao voltar ou ao
 * concluir. Senha e código são limpos do estado assim que deixam de ser
 * necessários.
 *
 * Mensagens de erro SEMPRE genéricas (401 de credencial e 401 de 2º fator não
 * distinguem conta, fator, código usado/expirado ou estado interno — o
 * backend já responde de forma indistinguível; esta tela só preserva isso).
 */
import { useId, useState } from "react";
import { Button, FormField } from "../components";
import { ApiError, login, verifyMfa } from "../api/authClient";
import "./LoginScreen.css";

export const LOGIN_TITULO_ID = "login-titulo";

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

type Fase = "credenciais" | "mfa";

function mensagemErroCredenciais(erro: unknown): string {
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

function mensagemErroMfa(erro: unknown): string {
  if (erro instanceof ApiError) {
    if (erro.status === 401) {
      // Genérico: não revela se o código estava errado, o challenge expirou,
      // já foi usado, ou a conta/fator não existe.
      return "Código inválido ou expirado. Tente novamente.";
    }
    if (erro.status === 429) {
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    }
    return "Não foi possível verificar o código. Tente novamente em instantes.";
  }
  return "Não foi possível verificar o código. Verifique sua conexão e tente novamente.";
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [fase, setFase] = useState<Fase>("credenciais");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emailId = useId();
  const senhaId = useId();
  const codigoId = useId();

  async function handleSubmitCredenciais(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setErro(null);
    try {
      const resultado = await login({ email, password: senha });
      // A senha não é mais necessária após a tentativa — some do estado em
      // qualquer desfecho.
      setSenha("");
      if (resultado.mfaRequerido) {
        setChallengeToken(resultado.challengeToken);
        setFase("mfa");
        setEnviando(false);
        return;
      }
      onLoginSuccess();
    } catch (err: unknown) {
      setSenha("");
      setEnviando(false);
      setErro(mensagemErroCredenciais(err));
    }
  }

  async function handleSubmitMfa(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando || !challengeToken) return;

    setEnviando(true);
    setErro(null);
    try {
      await verifyMfa({ challengeToken, code: codigo.trim() });
      // Sucesso: descarta challenge e código da memória antes de liberar.
      setChallengeToken(null);
      setCodigo("");
      onLoginSuccess();
    } catch (err: unknown) {
      setCodigo("");
      setEnviando(false);
      setErro(mensagemErroMfa(err));
    }
  }

  function voltarParaCredenciais() {
    // Limpa senha, código e challenge da memória ao voltar.
    setSenha("");
    setCodigo("");
    setChallengeToken(null);
    setErro(null);
    setEnviando(false);
    setFase("credenciais");
  }

  return (
    <div className="login-screen">
      <div className="login-screen__card">
        <h1 id={LOGIN_TITULO_ID} className="login-screen__title">
          {fase === "credenciais" ? "Entrar" : "Verificação em duas etapas"}
        </h1>

        {fase === "credenciais" ? (
          <>
            <p className="login-screen__subtitle">
              Acesse o Painel Administrativo Evolli RH com seu e-mail e senha.
            </p>

            <form
              className="login-screen__form"
              aria-label="Formulário de login"
              onSubmit={(e) => void handleSubmitCredenciais(e)}
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
          </>
        ) : (
          <>
            <p className="login-screen__subtitle">
              Digite o código de 6 dígitos do seu aplicativo autenticador. Se
              não tiver o dispositivo, use um dos seus códigos de recuperação.
            </p>

            <form
              className="login-screen__form"
              aria-label="Verificação em duas etapas"
              onSubmit={(e) => void handleSubmitMfa(e)}
            >
              <FormField
                id={codigoId}
                label="Código de verificação"
                required
                help="Código do app autenticador ou um código de recuperação."
              >
                {(control) => (
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(e) => {
                      setCodigo(e.target.value);
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

              <div className="login-screen__mfa-acoes">
                <Button
                  type="button"
                  variant="subtle"
                  onClick={voltarParaCredenciais}
                >
                  Voltar
                </Button>
                <Button type="submit" variant="primary" disabled={enviando}>
                  {enviando ? "Verificando…" : "Verificar"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
