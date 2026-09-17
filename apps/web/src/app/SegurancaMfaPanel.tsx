/**
 * Minha conta > Segurança (T126) — cadastro do 2º fator (TOTP) sobre os
 * contratos entregues na T125 (`POST /v1/auth/mfa/totp/enroll` e
 * `/confirm`). Reaproveita exclusivamente esses endpoints; sem endpoint,
 * permissão ou regra nova.
 *
 * O material de provisionamento (chave manual + `otpauth://` URI) só aparece
 * DURANTE o cadastro, e os 10 códigos de recuperação só aparecem UMA vez, na
 * confirmação. Depois de concluir, nada disso é reexibido — o estado em
 * memória é descartado. Nunca usa localStorage/sessionStorage nem grava
 * segredo/códigos em storage/URL/DOM persistente.
 *
 * QR Code: não há solução de QR no projeto e não se usa serviço externo. Para
 * não adicionar dependência nem embutir um gerador de QR não verificável, esta
 * versão mostra a CHAVE MANUAL (entrada manual é suportada por Google
 * Authenticator, Microsoft Authenticator e apps equivalentes) e o `otpauth://`
 * URI copiável. O QR escaneável fica como limitação registrada, a acrescentar
 * numa iteração futura sem serviço externo.
 */
import { useId, useState } from "react";
import {
  Button,
  EmptyState,
  FormField,
  StatusBadge,
  Surface,
} from "../components";
import {
  ApiError,
  confirmarEnrollmentMfa,
  iniciarEnrollmentMfa,
  type MaterialEnrollmentMfa,
} from "../api/mfaClient";
import "./SegurancaMfaPanel.css";

export interface SegurancaMfaPanelProps {
  aberto: boolean;
  onFechar: () => void;
  /** Chamado quando uma chamada desta área descobre (via 401) que a sessão
   * desta aba deixou de ser válida — mesmo caminho de `SessoesAtivasPanel`. */
  onSessaoAtualEncerrada: () => void;
}

type Fase =
  "inicial" | "carregando" | "erroInicio" | "enroll" | "codigos" | "concluido";

export function SegurancaMfaPanel({
  aberto,
  onFechar,
  onSessaoAtualEncerrada,
}: SegurancaMfaPanelProps) {
  const [fase, setFase] = useState<Fase>("inicial");
  const [material, setMaterial] = useState<MaterialEnrollmentMfa | null>(null);
  const [codigo, setCodigo] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erroInline, setErroInline] = useState<string | null>(null);
  const [erroInicioJaConfigurado, setErroInicioJaConfigurado] = useState(false);
  const tituloId = useId();
  const codigoId = useId();

  function tratou401(err: unknown): boolean {
    if (err instanceof ApiError && err.status === 401) {
      onSessaoAtualEncerrada();
      return true;
    }
    return false;
  }

  async function iniciar() {
    setFase("carregando");
    setErroInline(null);
    setErroInicioJaConfigurado(false);
    try {
      const m = await iniciarEnrollmentMfa();
      setMaterial(m);
      setCodigo("");
      setFase("enroll");
    } catch (err) {
      if (tratou401(err)) return;
      // 409 = já configurado; qualquer outro erro cai no estado de retry.
      if (err instanceof ApiError && err.status === 409) {
        setErroInicioJaConfigurado(true);
      }
      setFase("erroInicio");
    }
  }

  async function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErroInline(null);
    try {
      const { recoveryCodes: codes } = await confirmarEnrollmentMfa(
        codigo.trim(),
      );
      // Segredo/URI não são mais necessários — descarta da memória.
      setMaterial(null);
      setCodigo("");
      setRecoveryCodes(codes);
      setEnviando(false);
      setFase("codigos");
    } catch (err) {
      if (tratou401(err)) return;
      setEnviando(false);
      setCodigo("");
      setErroInline(
        err instanceof ApiError && err.status === 422
          ? "Código inválido. Verifique o app autenticador e tente novamente."
          : "Não foi possível confirmar o código. Tente novamente em instantes.",
      );
    }
  }

  function cancelarEnroll() {
    setMaterial(null);
    setCodigo("");
    setErroInline(null);
    setFase("inicial");
  }

  function concluir() {
    // Fecha a exibição única: descarta os códigos da memória.
    setRecoveryCodes([]);
    setFase("concluido");
  }

  function fecharPainel() {
    // Ao fechar o painel, zera tudo: nenhum material sensível permanece.
    setMaterial(null);
    setCodigo("");
    setRecoveryCodes([]);
    setErroInline(null);
    setErroInicioJaConfigurado(false);
    setFase("inicial");
    onFechar();
  }

  if (!aberto) return null;

  return (
    <Surface
      as="section"
      padding="lg"
      className="seguranca-mfa-painel"
      aria-labelledby={tituloId}
    >
      <div className="seguranca-mfa-painel__cabecalho">
        <h2 id={tituloId} className="seguranca-mfa-painel__titulo">
          Segurança da conta
        </h2>
        <Button variant="subtle" onClick={fecharPainel}>
          Fechar
        </Button>
      </div>

      <p className="seguranca-mfa-painel__intro">
        A autenticação em duas etapas (2FA) adiciona um código temporário do seu
        aplicativo autenticador ao entrar. Compatível com Google Authenticator,
        Microsoft Authenticator e apps equivalentes.
      </p>

      {fase === "inicial" ? (
        <Button onClick={() => void iniciar()}>
          Configurar autenticação em duas etapas
        </Button>
      ) : null}

      {fase === "carregando" ? (
        <p className="seguranca-mfa-painel__carregando" role="status">
          Preparando a configuração…
        </p>
      ) : null}

      {fase === "erroInicio" ? (
        <div className="seguranca-mfa-painel__erro">
          <StatusBadge variant={erroInicioJaConfigurado ? "info" : "danger"}>
            {erroInicioJaConfigurado ? "Já configurado" : "Erro"}
          </StatusBadge>
          <p role="alert">
            {erroInicioJaConfigurado
              ? "Esta conta já tem autenticação em duas etapas configurada."
              : "Não foi possível iniciar a configuração."}
          </p>
          {erroInicioJaConfigurado ? null : (
            <Button variant="secondary" onClick={() => void iniciar()}>
              Tentar novamente
            </Button>
          )}
        </div>
      ) : null}

      {fase === "enroll" && material ? (
        <div className="seguranca-mfa-painel__enroll">
          <h3 className="seguranca-mfa-painel__subtitulo">
            1. Adicione ao seu app autenticador
          </h3>
          <p>
            Abra o app e cadastre uma nova conta usando a chave abaixo (entrada
            manual). Guarde esta tela aberta só até concluir — a chave não é
            exibida de novo depois.
          </p>

          <FormField
            id="seguranca-mfa-chave"
            label="Chave (entrada manual)"
            help="Digite exatamente como aparece, sem espaços."
          >
            {(control) => (
              <input
                type="text"
                readOnly
                value={material.secretBase32}
                {...control}
              />
            )}
          </FormField>

          <FormField
            id="seguranca-mfa-uri"
            label="Ou use o endereço otpauth://"
            help="Alguns apps aceitam colar este endereço diretamente."
          >
            {(control) => (
              <input
                type="text"
                readOnly
                value={material.otpauthUri}
                {...control}
              />
            )}
          </FormField>

          <p className="seguranca-mfa-painel__nota-qr">
            O QR Code escaneável ainda não está disponível nesta tela (sem
            serviço externo). Use a chave ou o endereço acima por enquanto.
          </p>

          <h3 className="seguranca-mfa-painel__subtitulo">
            2. Confirme com o código do app
          </h3>
          <form
            className="seguranca-mfa-painel__form"
            aria-label="Confirmar código de autenticação"
            onSubmit={(e) => void confirmar(e)}
          >
            <FormField
              id={codigoId}
              label="Código de 6 dígitos"
              required
              {...(erroInline ? { error: erroInline } : {})}
            >
              {(control) => (
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    setErroInline(null);
                  }}
                  {...control}
                />
              )}
            </FormField>

            <div className="seguranca-mfa-painel__acoes">
              <Button
                type="button"
                variant="secondary"
                onClick={cancelarEnroll}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? "Confirmando…" : "Ativar 2FA"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {fase === "codigos" ? (
        <div className="seguranca-mfa-painel__codigos">
          <StatusBadge variant="success">2FA ativada</StatusBadge>
          <h3 className="seguranca-mfa-painel__subtitulo">
            Guarde seus códigos de recuperação
          </h3>
          <p role="alert">
            Estes 10 códigos são exibidos <strong>uma única vez</strong>. Cada
            um serve uma vez, para entrar se você perder o app autenticador.
            Guarde-os num lugar seguro (gerenciador de senhas ou impresso). Eles
            não serão mostrados de novo.
          </p>
          <ul className="seguranca-mfa-painel__lista-codigos">
            {recoveryCodes.map((c) => (
              <li key={c} className="seguranca-mfa-painel__codigo">
                {c}
              </li>
            ))}
          </ul>
          <Button onClick={concluir}>Já guardei meus códigos</Button>
        </div>
      ) : null}

      {fase === "concluido" ? (
        <EmptyState
          headingLevel={3}
          icon="✓"
          title="Autenticação em duas etapas ativada"
          description="A partir do próximo login, o código do app será solicitado. Seus códigos de recuperação não podem ser exibidos novamente."
        />
      ) : null}
    </Surface>
  );
}
