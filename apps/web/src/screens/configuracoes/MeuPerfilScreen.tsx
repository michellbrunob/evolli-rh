/**
 * T208 — Configurações › Meu perfil (MP-1 a MP-8; ampliação MPA-1 a MPA-11).
 *
 * A conta de acesso da própria pessoa logada, em três seções:
 *
 * - **Identificação:** iniciais no lugar da foto (não há envio de arquivo),
 *   o **nome de exibição** — o único campo editável —, o papel, a empresa
 *   ativa, a criação da conta e a última alteração do perfil;
 * - **Contato:** o e-mail de acesso, só leitura (a alteração ainda não
 *   existe: precisa de fluxo próprio com verificação, MPA-5);
 * - **Formas de entrada:** só "e-mail e senha". Google, segundo fator e
 *   sessões não aparecem aqui (MPA-7 a MPA-9).
 *
 * Cargo e telefone não aparecem: são dados do colaborador, do RH (MPA-3,
 * MPA-4). Nada de identificador interno.
 *
 * ## Salvar
 *
 * O rodapé com Descartar e Salvar só existe quando o nome mudou (espaço a
 * mais não conta: a comparação é pelo nome normalizado). Salvar envia a
 * versão lida (`perfilAtualizadoEm`); se outra sessão salvou antes, o
 * servidor recusa com 409 e nada é sobrescrito — a tela diz isso e oferece
 * carregar os dados atuais. A edição se declara à guarda de saída (T189/T200):
 * com o nome alterado, sair pergunta; salvando, sair fica bloqueado.
 *
 * Um anúncio por desfecho: o sucesso vai à região de status; erro de campo e
 * falha vão a um alerta. Nunca os dois.
 */
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  ROTULO_PAPEL,
  atualizarPerfilProprio,
  enviarFotoPropria,
  obterUsuarioAtual,
  removerFotoPropria,
  urlDaFotoPropria,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import { falhaPorSessaoExpirada } from "../../api/csrfClient";
import { Button, PageHeader, TrilhaNavegacao } from "../../components";
import { AUSENTE, formatarInstante } from "../../format/data";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";
import {
  erroDoNomeExibicao,
  iniciaisDe,
  normalizarNomeExibicao,
} from "./nomeExibicao";
import "./MeuPerfilScreen.css";

/** `id` do `h1` da tela — o título que recebe o foco ao abrir. */
export const CONFIGURACOES_TITULO_ID = "configuracoes-titulo";
const MEU_PERFIL_TITULO_ID = "configuracoes-meu-perfil-titulo";
const GRUPO_SUA_CONTA_ID = "configuracoes-grupo-sua-conta";
const SECAO_IDENTIFICACAO_ID = "configuracoes-secao-identificacao";
const SECAO_CONTATO_ID = "configuracoes-secao-contato";
const SECAO_ENTRADA_ID = "configuracoes-secao-entrada";
const CAMPO_NOME_ID = "configuracoes-nome-exibicao";
const AJUDA_NOME_ID = `${CAMPO_NOME_ID}-ajuda`;
const ERRO_NOME_ID = `${CAMPO_NOME_ID}-erro`;
const PREVIA_TITULO_ID = "configuracoes-foto-previa-titulo";
const REMOCAO_TEXTO_ID = "configuracoes-foto-remocao-texto";

/** T208 — o que a tela aceita escolher (o servidor decide de fato, ADR 0018). */
export const FOTO_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
export const FOTO_LIMITE_BYTES = 5 * 1024 * 1024;

/** Mensagens das recusas da foto pelo servidor (código do 422). */
const MENSAGEM_DA_RECUSA: Readonly<Record<string, string>> = {
  foto_formato_invalido:
    "Este arquivo não é uma imagem JPEG, PNG ou WebP. Nada foi alterado.",
  foto_pequena:
    "A imagem é pequena demais: use uma com ao menos 128 × 128 pixels. Nada foi alterado.",
  foto_grande_demais:
    "A imagem tem pixels demais: use uma de até 25 megapixels. Nada foi alterado.",
  foto_invalida:
    "Não foi possível ler esta imagem; o arquivo pode estar corrompido. Nada foi alterado.",
};
const MENSAGEM_ARQUIVO_GRANDE =
  "O arquivo passa de 5 MB. Escolha uma imagem menor; nada foi alterado.";
const MENSAGEM_TIPO_NAO_ACEITO =
  "Escolha uma imagem JPEG, PNG ou WebP; nada foi alterado.";

/** O rótulo da edição na guarda de saída. */
export const ROTULO_DA_EDICAO_DO_PERFIL = "Meu perfil";

/** Só os campos do ator que esta tela exibe. */
export type ContaDoMeuPerfil = Pick<
  SafeAccessUserApi,
  | "email"
  | "role"
  | "createdAt"
  | "empresaAtiva"
  | "nomeExibicao"
  | "perfilAtualizadoEm"
  | "fotoVersao"
>;

export interface MeuPerfilScreenProps {
  /** A conta da sessão; `null` só quando o shell monta sem ator (testes). */
  readonly conta: ContaDoMeuPerfil | null;
  /**
   * O ator como o servidor devolveu depois de salvar (ou de recarregar após
   * um conflito) — para a sessão seguir com o nome novo sem remontar nada.
   */
  readonly onContaAtualizada?: ((ator: SafeAccessUserApi) => void) | undefined;
}

/** A data (sem a hora) do instante de criação, no fuso de negócio. */
function dataDaCriacao(instante: string | undefined): string {
  const formatado = formatarInstante(instante);
  return formatado.split(" às ")[0] ?? AUSENTE;
}

interface PerfilSalvo {
  readonly nomeExibicao: string | null;
  readonly perfilAtualizadoEm: string | null;
  /** T208 — versão da foto (instante da gravação), ou `null` sem foto. */
  readonly fotoVersao: string | null;
}

function perfilDe(conta: {
  readonly nomeExibicao?: string | null | undefined;
  readonly perfilAtualizadoEm?: string | null | undefined;
  readonly fotoVersao?: string | null | undefined;
}): PerfilSalvo {
  return {
    nomeExibicao: conta.nomeExibicao ?? null,
    perfilAtualizadoEm: conta.perfilAtualizadoEm ?? null,
    fotoVersao: conta.fotoVersao ?? null,
  };
}

/** A foto escolhida e ainda não enviada: o arquivo e a URL local da prévia. */
interface PreviaDaFoto {
  readonly arquivo: File;
  readonly url: string;
}

type Falha = "conflito" | "sessao" | "geral" | null;

export function MeuPerfilScreen({
  conta,
  onContaAtualizada,
}: MeuPerfilScreenProps) {
  const papel =
    conta === null ? AUSENTE : (ROTULO_PAPEL[conta.role] ?? conta.role);
  const empresa = conta?.empresaAtiva ?? null;

  const [salvo, setSalvo] = useState<PerfilSalvo>(() => perfilDe(conta ?? {}));
  const [rascunho, setRascunho] = useState(salvo.nomeExibicao ?? "");
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [falha, setFalha] = useState<Falha>(null);
  const [salvando, setSalvando] = useState(false);
  const [recarregando, setRecarregando] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  // T208 — foto de perfil (ADR 0018), com fluxo próprio, fora do rodapé do
  // nome: escolher mostra a prévia local; só "Usar esta foto" envia.
  const [previa, setPrevia] = useState<PreviaDaFoto | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [imagemFalhou, setImagemFalhou] = useState<string | null>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const escolherFotoRef = useRef<HTMLButtonElement>(null);
  const usarFotoRef = useRef<HTMLButtonElement>(null);
  const confirmarRemocaoRef = useRef<HTMLButtonElement>(null);
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const nomeNormalizado = normalizarNomeExibicao(rascunho);
  const alterado = conta !== null && nomeNormalizado !== salvo.nomeExibicao;
  const gravandoFoto = enviandoFoto || removendoFoto;
  const ocupado = salvando || recarregando || gravandoFoto;

  useEdicaoEmAndamento(ROTULO_DA_EDICAO_DO_PERFIL, {
    // Nome alterado ou foto escolhida e ainda não enviada: sair pergunta.
    pendente: alterado || previa !== null,
    // Gravando nome ou foto: sair fica bloqueado.
    salvando: salvando || gravandoFoto,
  });

  // A URL local da prévia é liberada quando a prévia some ou a tela desmonta.
  useEffect(() => {
    if (previa === null) return;
    return () => URL.revokeObjectURL(previa.url);
  }, [previa]);

  // Ao abrir sem foco em lugar nenhum (a recarga da rota, o "voltar" do
  // navegador), o título — como o Dashboard. Vindo do menu ou de um cartão,
  // o foco já está em outro lugar e não é tomado.
  useEffect(() => {
    const ativo = document.activeElement;
    if (ativo !== null && ativo !== document.body) return;
    const titulo = document.getElementById(CONFIGURACOES_TITULO_ID);
    if (!titulo) return;
    titulo.setAttribute("tabindex", "-1");
    titulo.focus();
  }, []);

  function focarCampo() {
    campoRef.current?.focus();
  }

  function aoDigitar(valor: string) {
    setRascunho(valor);
    setErroCampo(null);
    setAnuncio("");
  }

  function descartar() {
    setRascunho(salvo.nomeExibicao ?? "");
    setErroCampo(null);
    setFalha(null);
    setAnuncio("");
    focarCampo();
  }

  /**
   * Aceita o ator que o servidor devolveu como a nova versão salva. Depois de
   * gravar a foto, o nome que a pessoa está editando fica como está
   * (`manterRascunho`): a foto não apaga a edição do nome.
   */
  function aplicarDoServidor(
    ator: SafeAccessUserApi,
    { manterRascunho = false }: { manterRascunho?: boolean } = {},
  ) {
    const novo = perfilDe(ator);
    setSalvo(novo);
    if (!manterRascunho) setRascunho(novo.nomeExibicao ?? "");
    onContaAtualizada?.(ator);
  }

  function focarEscolherFoto() {
    escolherFotoRef.current?.focus();
  }

  function descartarPrevia() {
    setPrevia(null);
    if (arquivoRef.current) arquivoRef.current.value = "";
  }

  /** O arquivo escolhido vira prévia local; nada é enviado ainda. */
  function aoEscolherArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setAnuncio("");
    setFalha(null);
    setConfirmandoRemocao(false);
    if (arquivo.size > FOTO_LIMITE_BYTES) {
      descartarPrevia();
      setErroFoto(MENSAGEM_ARQUIVO_GRANDE);
      focarEscolherFoto();
      return;
    }
    if (!FOTO_TIPOS_ACEITOS.includes(arquivo.type)) {
      descartarPrevia();
      setErroFoto(MENSAGEM_TIPO_NAO_ACEITO);
      focarEscolherFoto();
      return;
    }
    setErroFoto(null);
    setPrevia({ arquivo, url: URL.createObjectURL(arquivo) });
  }

  // A prévia recém-aberta leva o foco à ação principal dela.
  const previaAbertaRef = useRef<string | null>(null);
  useEffect(() => {
    if (previa !== null && previaAbertaRef.current !== previa.url) {
      previaAbertaRef.current = previa.url;
      usarFotoRef.current?.focus();
    }
    if (previa === null) previaAbertaRef.current = null;
  }, [previa]);

  // A confirmação de remoção leva o foco ao botão que confirma.
  useEffect(() => {
    if (confirmandoRemocao) confirmarRemocaoRef.current?.focus();
  }, [confirmandoRemocao]);

  function cancelarPrevia() {
    descartarPrevia();
    setErroFoto(null);
    focarEscolherFoto();
  }

  /** Falha comum de gravação: conflito, sessão ou genérica. */
  function tratarFalhaDeGravacao(erroDoEnvio: unknown) {
    if (erroDoEnvio instanceof ApiError && erroDoEnvio.status === 409) {
      setFalha("conflito");
    } else if (falhaPorSessaoExpirada(erroDoEnvio)) {
      setFalha("sessao");
    } else {
      setFalha("geral");
    }
  }

  async function enviarFoto() {
    if (previa === null || ocupado) return;
    setEnviandoFoto(true);
    setErroFoto(null);
    setFalha(null);
    setAnuncio("");
    try {
      const ator = await enviarFotoPropria(
        previa.arquivo,
        salvo.perfilAtualizadoEm,
      );
      if (!montadoRef.current) return;
      aplicarDoServidor(ator, { manterRascunho: true });
      descartarPrevia();
      setAnuncio("Foto atualizada.");
      focarEscolherFoto();
    } catch (erroDoEnvio) {
      if (!montadoRef.current) return;
      if (
        erroDoEnvio instanceof ApiError &&
        (erroDoEnvio.status === 413 || erroDoEnvio.status === 422)
      ) {
        // O servidor recusou o arquivo: a prévia não serve, volta à escolha.
        descartarPrevia();
        setErroFoto(
          erroDoEnvio.status === 413
            ? MENSAGEM_ARQUIVO_GRANDE
            : (MENSAGEM_DA_RECUSA[erroDoEnvio.codigo ?? ""] ??
                MENSAGEM_DA_RECUSA.foto_invalida!),
        );
        focarEscolherFoto();
      } else {
        // Conflito, sessão ou falha: a prévia fica, para tentar de novo.
        tratarFalhaDeGravacao(erroDoEnvio);
      }
    } finally {
      if (montadoRef.current) setEnviandoFoto(false);
    }
  }

  function pedirRemocao() {
    setAnuncio("");
    setErroFoto(null);
    setConfirmandoRemocao(true);
  }

  function cancelarRemocao() {
    setConfirmandoRemocao(false);
    focarEscolherFoto();
  }

  async function removerFoto() {
    if (ocupado) return;
    setRemovendoFoto(true);
    setFalha(null);
    setAnuncio("");
    try {
      const ator = await removerFotoPropria(salvo.perfilAtualizadoEm);
      if (!montadoRef.current) return;
      aplicarDoServidor(ator, { manterRascunho: true });
      setConfirmandoRemocao(false);
      setAnuncio("Foto removida.");
      focarEscolherFoto();
    } catch (erroDoEnvio) {
      if (!montadoRef.current) return;
      setConfirmandoRemocao(false);
      tratarFalhaDeGravacao(erroDoEnvio);
    } finally {
      if (montadoRef.current) setRemovendoFoto(false);
    }
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!alterado || ocupado) return;
    const erro = erroDoNomeExibicao(nomeNormalizado);
    if (erro !== null) {
      setErroCampo(erro);
      setFalha(null);
      setAnuncio("");
      focarCampo();
      return;
    }
    setSalvando(true);
    setErroCampo(null);
    setFalha(null);
    setAnuncio("");
    try {
      const ator = await atualizarPerfilProprio({
        nomeExibicao: nomeNormalizado,
        perfilAtualizadoEmLido: salvo.perfilAtualizadoEm,
      });
      if (!montadoRef.current) return;
      aplicarDoServidor(ator);
      setAnuncio("Perfil salvo.");
      focarCampo();
    } catch (erroDoEnvio) {
      if (!montadoRef.current) return;
      if (erroDoEnvio instanceof ApiError && erroDoEnvio.status === 409) {
        setFalha("conflito");
      } else if (falhaPorSessaoExpirada(erroDoEnvio)) {
        // Tentar de novo não adianta: a sessão acabou. O texto fica no campo.
        setFalha("sessao");
      } else if (
        erroDoEnvio instanceof ApiError &&
        erroDoEnvio.status === 400
      ) {
        setErroCampo(
          "Este nome não foi aceito. Use de 2 a 80 caracteres, com ao menos uma letra.",
        );
        focarCampo();
      } else {
        setFalha("geral");
      }
    } finally {
      if (montadoRef.current) setSalvando(false);
    }
  }

  async function carregarDadosAtuais() {
    setRecarregando(true);
    setAnuncio("");
    try {
      const ator = await obterUsuarioAtual();
      if (!montadoRef.current) return;
      aplicarDoServidor(ator);
      setFalha(null);
      setErroCampo(null);
      setAnuncio("Dados atuais carregados.");
      focarCampo();
    } catch {
      if (montadoRef.current) setFalha("geral");
    } finally {
      if (montadoRef.current) setRecarregando(false);
    }
  }

  const nomeExibido = salvo.nomeExibicao ?? conta?.email ?? AUSENTE;
  const descricaoDoCampo = [AJUDA_NOME_ID, erroCampo ? ERRO_NOME_ID : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="configuracoes">
      <TrilhaNavegacao
        itens={[{ rotulo: "Configurações" }, { rotulo: "Meu perfil" }]}
      />
      <PageHeader
        headingLevel={1}
        titleId={CONFIGURACOES_TITULO_ID}
        title="Configurações"
        description="A sua conta de acesso ao Evolli RH."
      />

      <div className="configuracoes__corpo">
        <nav className="configuracoes__navegacao" aria-label="Configurações">
          <p className="configuracoes__grupo" id={GRUPO_SUA_CONTA_ID}>
            Sua conta
          </p>
          <ul
            className="configuracoes__itens"
            aria-labelledby={GRUPO_SUA_CONTA_ID}
          >
            <li>
              <a
                className="configuracoes__item configuracoes__item--atual"
                href="#/configuracoes/meu-perfil"
                aria-current="page"
              >
                Meu perfil
              </a>
            </li>
          </ul>
        </nav>

        <section
          className="configuracoes__painel"
          aria-labelledby={MEU_PERFIL_TITULO_ID}
        >
          <div className="configuracoes__cabecalho">
            <h2 className="configuracoes__titulo" id={MEU_PERFIL_TITULO_ID}>
              Meu perfil
            </h2>
            <p className="configuracoes__texto">
              Como você aparece no Evolli RH e os dados da sua conta de acesso.
            </p>
          </div>

          <form
            className="configuracoes__formulario"
            aria-labelledby={MEU_PERFIL_TITULO_ID}
            noValidate
            onSubmit={(evento) => void salvar(evento)}
          >
            <section
              className="configuracoes__secao"
              aria-labelledby={SECAO_IDENTIFICACAO_ID}
            >
              <div className="configuracoes__secao-topo">
                <h3
                  className="configuracoes__secao-titulo"
                  id={SECAO_IDENTIFICACAO_ID}
                >
                  Identificação
                </h3>
                <p className="configuracoes__secao-texto">
                  O nome com que você aparece e o seu lugar no Evolli RH.
                </p>
              </div>

              <div className="configuracoes__identidade">
                {salvo.fotoVersao !== null &&
                imagemFalhou !== salvo.fotoVersao ? (
                  <img
                    className="configuracoes__foto"
                    src={urlDaFotoPropria(salvo.fotoVersao)}
                    alt="Sua foto de perfil"
                    width={64}
                    height={64}
                    onError={() => setImagemFalhou(salvo.fotoVersao)}
                  />
                ) : (
                  <span className="configuracoes__iniciais" aria-hidden="true">
                    {conta === null
                      ? "?"
                      : iniciaisDe(salvo.nomeExibicao, conta.email)}
                  </span>
                )}
                <div className="configuracoes__identidade-texto">
                  <p className="configuracoes__nome-exibido">{nomeExibido}</p>
                  <p className="configuracoes__identidade-nota">
                    {salvo.fotoVersao !== null
                      ? "Só você vê a sua foto."
                      : "Sem foto: o Evolli RH mostra as suas iniciais."}
                  </p>
                </div>
              </div>

              {conta === null ? null : (
                <div className="configuracoes__foto-acoes">
                  <input
                    ref={arquivoRef}
                    className="configuracoes__arquivo"
                    type="file"
                    accept={FOTO_TIPOS_ACEITOS.join(",")}
                    aria-label="Arquivo da foto de perfil"
                    tabIndex={-1}
                    hidden
                    onChange={(evento) =>
                      aoEscolherArquivo(evento.target.files?.[0])
                    }
                  />
                  <button
                    ref={escolherFotoRef}
                    type="button"
                    className="evolli-button evolli-button--secondary"
                    disabled={ocupado}
                    onClick={() => arquivoRef.current?.click()}
                  >
                    {salvo.fotoVersao !== null ? "Trocar foto" : "Enviar foto"}
                  </button>
                  {salvo.fotoVersao !== null ? (
                    <Button
                      type="button"
                      variant="subtle"
                      disabled={ocupado}
                      onClick={pedirRemocao}
                    >
                      Remover foto
                    </Button>
                  ) : null}
                  <p className="configuracoes__ajuda">
                    JPEG, PNG ou WebP, até 5 MB e com ao menos 128 × 128 pixels.
                    O Evolli RH recorta o centro e grava uma cópia de 256 × 256.
                  </p>
                </div>
              )}

              {previa !== null ? (
                <div
                  className="configuracoes__previa"
                  role="group"
                  aria-labelledby={PREVIA_TITULO_ID}
                >
                  <p
                    className="configuracoes__previa-titulo"
                    id={PREVIA_TITULO_ID}
                  >
                    Prévia da nova foto
                  </p>
                  <img
                    className="configuracoes__previa-imagem"
                    src={previa.url}
                    alt="Prévia da nova foto, recortada no centro"
                    width={160}
                    height={160}
                  />
                  <div className="configuracoes__previa-acoes">
                    <button
                      ref={usarFotoRef}
                      type="button"
                      className="evolli-button evolli-button--primary"
                      disabled={ocupado}
                      onClick={() => void enviarFoto()}
                    >
                      {enviandoFoto ? "Enviando…" : "Usar esta foto"}
                    </button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={ocupado}
                      onClick={cancelarPrevia}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {confirmandoRemocao ? (
                <div
                  className="configuracoes__confirmacao"
                  role="group"
                  aria-labelledby={REMOCAO_TEXTO_ID}
                >
                  <p id={REMOCAO_TEXTO_ID}>
                    Remover a sua foto? A imagem é apagada e as iniciais voltam
                    a aparecer.
                  </p>
                  <div className="configuracoes__previa-acoes">
                    <button
                      ref={confirmarRemocaoRef}
                      type="button"
                      className="evolli-button evolli-button--primary"
                      disabled={ocupado}
                      onClick={() => void removerFoto()}
                    >
                      {removendoFoto ? "Removendo…" : "Remover a foto"}
                    </button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={ocupado}
                      onClick={cancelarRemocao}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {erroFoto !== null ? (
                <p className="configuracoes__falha" role="alert">
                  {erroFoto}
                </p>
              ) : null}

              {conta === null ? null : (
                <div className="configuracoes__linha configuracoes__linha--campo evolli-field">
                  <div className="configuracoes__rotulo">
                    <label
                      className="configuracoes__rotulo-texto"
                      htmlFor={CAMPO_NOME_ID}
                    >
                      Nome de exibição
                    </label>
                    <p className="configuracoes__ajuda" id={AJUDA_NOME_ID}>
                      Opcional, de 2 a 80 caracteres. Em branco, o Evolli RH usa
                      o seu e-mail de acesso.
                    </p>
                  </div>
                  <div className="configuracoes__valor">
                    <input
                      ref={campoRef}
                      id={CAMPO_NOME_ID}
                      name="nomeExibicao"
                      type="text"
                      autoComplete="nickname"
                      value={rascunho}
                      readOnly={ocupado}
                      aria-describedby={descricaoDoCampo}
                      {...(erroCampo ? { "aria-invalid": true } : {})}
                      onChange={(evento) => aoDigitar(evento.target.value)}
                    />
                    {erroCampo ? (
                      <p
                        className="evolli-field__error"
                        id={ERRO_NOME_ID}
                        role="alert"
                      >
                        <span
                          className="evolli-field__error-icon"
                          aria-hidden="true"
                        >
                          !
                        </span>
                        <span>{erroCampo}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <dl className="configuracoes__dados">
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>Papel</dt>
                  <dd>{papel}</dd>
                </div>
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>Empresa ativa</dt>
                  <dd>
                    {conta === null
                      ? AUSENTE
                      : empresa === null
                        ? "Nenhuma empresa ativa"
                        : `${empresa.nome} (${empresa.codigo})`}
                  </dd>
                </div>
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>Conta criada em</dt>
                  <dd>
                    {conta === null ? (
                      AUSENTE
                    ) : (
                      <time dateTime={conta.createdAt}>
                        {dataDaCriacao(conta.createdAt)}
                      </time>
                    )}
                  </dd>
                </div>
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>Última alteração do perfil</dt>
                  <dd>
                    {conta === null ? (
                      AUSENTE
                    ) : salvo.perfilAtualizadoEm === null ? (
                      "Ainda não alterado"
                    ) : (
                      <time dateTime={salvo.perfilAtualizadoEm}>
                        {formatarInstante(salvo.perfilAtualizadoEm)}
                      </time>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className="configuracoes__secao"
              aria-labelledby={SECAO_CONTATO_ID}
            >
              <div className="configuracoes__secao-topo">
                <h3
                  className="configuracoes__secao-titulo"
                  id={SECAO_CONTATO_ID}
                >
                  Contato
                </h3>
                <p className="configuracoes__secao-texto">
                  O e-mail com que você entra no Evolli RH. A alteração do
                  e-mail ainda não está disponível.
                </p>
              </div>
              <dl className="configuracoes__dados">
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>E-mail de acesso</dt>
                  <dd>{conta?.email ?? AUSENTE}</dd>
                </div>
              </dl>
            </section>

            <section
              className="configuracoes__secao"
              aria-labelledby={SECAO_ENTRADA_ID}
            >
              <div className="configuracoes__secao-topo">
                <h3
                  className="configuracoes__secao-titulo"
                  id={SECAO_ENTRADA_ID}
                >
                  Formas de entrada
                </h3>
                <p className="configuracoes__secao-texto">
                  Como você entra no Evolli RH hoje.
                </p>
              </div>
              <dl className="configuracoes__dados">
                <div className="configuracoes__linha configuracoes__dado">
                  <dt>E-mail e senha</dt>
                  <dd>Em uso</dd>
                </div>
              </dl>
            </section>

            {falha === "conflito" ? (
              <div className="configuracoes__falha" role="alert">
                <p className="configuracoes__falha-texto">
                  O seu perfil foi alterado em outra sessão depois que esta tela
                  foi aberta. Nada foi salvo; o seu texto continua no campo.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={ocupado}
                  onClick={() => void carregarDadosAtuais()}
                >
                  Carregar os dados atuais
                </Button>
              </div>
            ) : null}
            {falha === "sessao" ? (
              <p className="configuracoes__falha" role="alert">
                A sua sessão terminou. Entre de novo para salvar; nada foi
                alterado.
              </p>
            ) : null}
            {falha === "geral" ? (
              <p className="configuracoes__falha" role="alert">
                Não foi possível concluir agora. Nada foi alterado; tente de
                novo.
              </p>
            ) : null}

            {alterado || salvando ? (
              <div className="configuracoes__rodape">
                <p className="configuracoes__rodape-texto">
                  {salvando
                    ? "Salvando o seu perfil…"
                    : "O nome de exibição foi alterado e ainda não foi salvo."}
                </p>
                <div className="configuracoes__rodape-acoes">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={ocupado}
                    onClick={descartar}
                  >
                    Descartar
                  </Button>
                  <Button type="submit" disabled={ocupado}>
                    {salvando ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </div>
            ) : null}
          </form>

          <p className="configuracoes__anuncio" role="status">
            {anuncio}
          </p>
        </section>
      </div>
    </div>
  );
}
