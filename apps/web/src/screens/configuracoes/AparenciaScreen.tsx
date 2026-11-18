/**
 * T210 — Configurações › Aparência: o tema da PRÓPRIA conta.
 *
 * Quatro cartões num grupo de rádios nativos (setas e espaço do teclado, nome
 * e descrição lidos pelo leitor de tela). Escolher aplica na hora — o
 * `data-theme` do `<html>` muda antes da resposta — e grava na conta
 * (`PATCH /v1/users/me/aparencia`). Não há botão de salvar: a escolha É a
 * gravação.
 *
 * - **Sucesso:** o cartão escolhido passa a "Em uso", a sessão segue com o
 *   ator devolvido pelo servidor e a região de status anuncia.
 * - **Falha:** a tela volta ao tema anterior (no `<html>` e no cartão
 *   marcado) e um alerta diz que nada mudou.
 * - **Gravando:** outra escolha espera (`aria-busy`); os rádios não ficam
 *   desabilitados, para o foco do teclado não se perder.
 *
 * Um anúncio por desfecho: sucesso na região de status, falha no alerta.
 */
import { useEffect, useRef, useState } from "react";
import {
  atualizarAparenciaPropria,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import { falhaPorSessaoExpirada } from "../../api/csrfClient";
import { PageHeader } from "../../components";
import {
  TEMAS,
  aplicarTema,
  nomeDoTema,
  temaDaConta,
  type TemaDeAparencia,
} from "../../app/aparencia";
import "./MeuPerfilScreen.css";
import "./AparenciaScreen.css";
import { NavegacaoConfiguracoes } from "./NavegacaoConfiguracoes";

/** `id` do `h1` da tela — o título que recebe o foco ao abrir. */
export const APARENCIA_TITULO_ID = "configuracoes-aparencia-titulo";
const SECAO_TITULO_ID = "configuracoes-aparencia-secao-titulo";
const GRUPO_ROTULO_ID = "configuracoes-aparencia-grupo";

const MENSAGEM_FALHA =
  "Não foi possível salvar o tema. O tema anterior foi mantido.";
const MENSAGEM_SESSAO =
  "Sua sessão terminou. Entre de novo para escolher o tema; o tema anterior foi mantido.";

export interface AparenciaScreenProps {
  /** O `temaAparencia` do ator da sessão (ausente ou inválido = padrão). */
  readonly temaAtual: string | null | undefined;
  /** O ator como o servidor devolveu depois de gravar. */
  readonly onContaAtualizada?: ((ator: SafeAccessUserApi) => void) | undefined;
  /** A conta alcança Configurações › Empresas (item na navegação). */
  readonly mostrarEmpresas?: boolean;
}

export function AparenciaScreen({
  temaAtual,
  onContaAtualizada,
  mostrarEmpresas = false,
}: AparenciaScreenProps) {
  const [emUso, setEmUso] = useState<TemaDeAparencia>(() =>
    temaDaConta(temaAtual),
  );
  const [escolhido, setEscolhido] = useState<TemaDeAparencia>(emUso);
  const [gravando, setGravando] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [falha, setFalha] = useState("");
  const gravandoRef = useRef(false);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  async function escolher(tema: TemaDeAparencia) {
    if (gravandoRef.current || tema === emUso) return;
    const anterior = emUso;
    gravandoRef.current = true;
    setGravando(true);
    setEscolhido(tema);
    setSucesso("");
    setFalha("");
    aplicarTema(tema);
    try {
      const ator = await atualizarAparenciaPropria(tema);
      if (!montadoRef.current) return;
      setEmUso(tema);
      setSucesso(`Tema ${nomeDoTema(tema)} aplicado e salvo na sua conta.`);
      onContaAtualizada?.(ator);
    } catch (erro) {
      // A escolha não ficou na conta: a tela inteira volta ao que vale.
      aplicarTema(anterior);
      if (!montadoRef.current) return;
      setEscolhido(anterior);
      setFalha(falhaPorSessaoExpirada(erro) ? MENSAGEM_SESSAO : MENSAGEM_FALHA);
    } finally {
      gravandoRef.current = false;
      if (montadoRef.current) setGravando(false);
    }
  }

  return (
    <div className="configuracoes">
      <PageHeader
        headingLevel={1}
        titleId={APARENCIA_TITULO_ID}
        title="Configurações"
        description="A sua conta de acesso ao Evolli."
      />

      <div className="configuracoes__corpo">
        <NavegacaoConfiguracoes
          atual="aparencia"
          mostrarEmpresas={mostrarEmpresas}
        />

        <section
          className="configuracoes__painel"
          aria-labelledby={SECAO_TITULO_ID}
        >
          <div className="configuracoes__cabecalho">
            <h2 className="configuracoes__titulo" id={SECAO_TITULO_ID}>
              Aparência
            </h2>
            <p className="configuracoes__texto">
              Escolha como o Evolli será exibido para você.
            </p>
          </div>

          <p className="aparencia__rotulo-grupo" id={GRUPO_ROTULO_ID}>
            Tema
          </p>
          <div
            className="aparencia__temas"
            role="radiogroup"
            aria-labelledby={GRUPO_ROTULO_ID}
            aria-busy={gravando}
          >
            {TEMAS.map((tema) => {
              const id = `aparencia-tema-${tema.codigo}`;
              const descricaoId = `${id}-descricao`;
              const emUsoId = `${id}-em-uso`;
              const marcado = escolhido === tema.codigo;
              const ehOEmUso = emUso === tema.codigo;
              return (
                <label
                  key={tema.codigo}
                  className={
                    marcado
                      ? "aparencia__cartao aparencia__cartao--marcado"
                      : "aparencia__cartao"
                  }
                  htmlFor={id}
                >
                  <span
                    className="aparencia__amostra"
                    aria-hidden="true"
                    style={{
                      background: tema.amostra.fundo,
                      color: tema.amostra.texto,
                    }}
                  >
                    <span
                      className="aparencia__amostra-cartao"
                      style={{ background: tema.amostra.superficie }}
                    >
                      <span className="aparencia__amostra-linha" />
                      <span className="aparencia__amostra-linha aparencia__amostra-linha--curta" />
                      <span
                        className="aparencia__amostra-acao"
                        style={{ background: tema.amostra.acao }}
                      />
                    </span>
                  </span>
                  <span className="aparencia__cartao-topo">
                    <input
                      className="aparencia__radio"
                      type="radio"
                      name="tema-aparencia"
                      id={id}
                      value={tema.codigo}
                      checked={marcado}
                      onChange={() => void escolher(tema.codigo)}
                      aria-describedby={
                        ehOEmUso ? `${descricaoId} ${emUsoId}` : descricaoId
                      }
                    />
                    <span className="aparencia__nome">{tema.nome}</span>
                    {ehOEmUso ? (
                      <span className="aparencia__em-uso" id={emUsoId}>
                        Em uso
                      </span>
                    ) : null}
                  </span>
                  <span className="aparencia__descricao" id={descricaoId}>
                    {tema.descricao}
                  </span>
                </label>
              );
            })}
          </div>

          <p className="aparencia__aviso" role="status">
            {sucesso}
          </p>
          {falha ? (
            <p
              className="aparencia__aviso aparencia__aviso--falha"
              role="alert"
            >
              {falha}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
