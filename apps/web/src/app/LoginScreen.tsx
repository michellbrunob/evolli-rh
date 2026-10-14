/**
 * Login web (T116) + verificação de 2º fator (T126); composição
 * institucional na T160.
 *
 * ## O que a T160 mudou, e o que ela deliberadamente não mudou
 *
 * Mudou a **composição**: a porta de entrada passou a ter um painel
 * institucional com a marca do Evolli e um fundo abstrato **desenhado aqui**,
 * ao lado do cartão de credenciais. Referência de mercado entrou como
 * princípio de composição — hierarquia, respiro, par painel/cartão —, nunca
 * como material copiado: não há marca, texto, ilustração, ícone, paleta ou
 * layout de terceiro neste arquivo, e nenhum ativo é baixado.
 *
 * **Não mudou nada do contrato.** Mesmos campos, mesmo `autoComplete`, mesmas
 * mensagens genéricas, mesma máquina de duas fases, mesmo `onLoginSuccess`.
 * E continua sem cadastro, "lembrar-me", CAPTCHA, recuperação de senha,
 * registro de ponto ou SSO: nenhum deles tem contrato de servidor, e um botão
 * que o servidor não honra é promessa vazia — a mesma regra que governou a
 * T159.
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
import { MarcaEvolli } from "./IconeModulo";
import "./LoginScreen.css";

export const LOGIN_TITULO_ID = "login-titulo";

/**
 * Fundo abstrato do painel institucional (T160).
 *
 * Geometria elementar — círculos, um anel, um retângulo arredondado girado e
 * uma onda —, composta aqui. Sem gradiente, porque a fundação visual do
 * produto não os usa, e sem imagem externa: é SVG embutido, então não há
 * requisição, não há ativo de terceiro e o arquivo acompanha o repositório.
 *
 * `aria-hidden` e `focusable="false"`: é decoração. Nada do que esta tela
 * comunica depende dela.
 */
function FundoInstitucional() {
  return (
    <svg
      className="login-screen__fundo"
      viewBox="0 0 600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* Cada forma vive num `<g>` próprio para que a profundidade de entrada
          (ver `LoginScreen.css`) se aplique ao grupo, sem sobrescrever o
          `transform` de rotação que o retângulo já carrega como atributo. */}
      <g className="login-screen__forma login-screen__forma--1">
        <circle cx="505" cy="135" r="250" fill="#ffffff" fillOpacity="0.09" />
      </g>
      <g className="login-screen__forma login-screen__forma--2">
        <circle
          cx="120"
          cy="735"
          r="185"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.22"
          strokeWidth="2"
        />
      </g>
      <g className="login-screen__forma login-screen__forma--3">
        <rect
          x="250"
          y="430"
          width="300"
          height="300"
          rx="92"
          fill="#ffffff"
          fillOpacity="0.07"
          transform="rotate(-18 400 580)"
        />
      </g>
      <g className="login-screen__forma login-screen__forma--4">
        <path
          d="M-40 300 C 140 236, 300 360, 480 292 S 760 200, 900 268"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
      </g>
      <g className="login-screen__forma login-screen__forma--5">
        <circle cx="96" cy="196" r="7" fill="#ffffff" fillOpacity="0.5" />
      </g>
      <g className="login-screen__forma login-screen__forma--6">
        <circle cx="430" cy="830" r="11" fill="#ffffff" fillOpacity="0.35" />
      </g>
    </svg>
  );
}

/**
 * Painel institucional. Diz o que o produto é, não o que ele promete ser:
 * os três módulos citados — pessoas, estrutura e jornada — são exatamente os
 * que têm capacidade real, como a T159 fixou. Sem métrica, sem depoimento,
 * sem link para fora.
 */
function PainelInstitucional() {
  return (
    <div className="login-screen__painel">
      <FundoInstitucional />
      <div className="login-screen__painel-conteudo">
        <span className="login-screen__marca">
          <MarcaEvolli tom="clara" />
          <span className="login-screen__marca-nome">Evolli RH</span>
        </span>
        <p className="login-screen__lema">
          Pessoas, estrutura e jornada no mesmo lugar.
        </p>
        <p className="login-screen__nota">
          Ambiente interno · acesso restrito a contas autorizadas
        </p>
      </div>
    </div>
  );
}

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
      <PainelInstitucional />

      <main className="login-screen__area">
        <div className="login-screen__card">
          <h1 id={LOGIN_TITULO_ID} className="login-screen__title">
            {fase === "credenciais" ? "Entrar" : "Verificação em duas etapas"}
          </h1>

          {fase === "credenciais" ? (
            <>
              <p className="login-screen__subtitle">
                Entre com seu e-mail e senha.
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
      </main>
    </div>
  );
}
