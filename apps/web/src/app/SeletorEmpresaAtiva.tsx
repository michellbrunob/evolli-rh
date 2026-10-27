/**
 * T189 — empresa ativa: um componente só, no topo do menu lateral e no Hub.
 *
 * ## O que mostra
 *
 * - **Fechado:** nome e código interno da empresa ativa — os dois campos que
 *   `GET /v1/users/me` devolve. Não há CNPJ nem outro identificador fiscal no
 *   contrato, e nenhum é inventado aqui.
 * - **Aberto:** as empresas que o SERVIDOR autoriza
 *   (`GET /v1/auth/contexto/empresas`), com a atual marcada por texto, ícone
 *   e `aria-current`.
 * - **Só leitura** quando não há para onde ir: papel que não troca, empresa
 *   única, lista ainda carregando ou falha ao carregá-la.
 *
 * ## Quem pede a lista
 *
 * Só quem o servidor diz que troca (`podeTrocarEmpresa`). Os demais papéis
 * nem chegam a fazer a requisição — a rota responderia 403, mas a pergunta
 * nem deve ser feita. A lista é lida uma vez por login, num provedor acima do
 * Hub e do shell, e relida só depois de uma empresa se revelar indisponível.
 *
 * ## A troca
 *
 * Nada é otimista: a empresa nova só aparece depois de o servidor confirmar,
 * e quem monta o componente recria a árvore (T163). Antes de pedir a troca:
 *
 * - salvamento em andamento → as opções ficam desabilitadas até ele acabar;
 * - edição pendente → confirmação no próprio painel; cancelar não muda nada.
 *
 * ## Teclado e leitor de tela
 *
 * Botão de abertura com `aria-expanded`/`aria-controls`; Enter e Espaço
 * abrem (é um `<button>`), seta para baixo também. Aberto, o foco vai para a
 * empresa atual; setas, Home e End percorrem as opções; Tab segue a ordem do
 * documento; Esc fecha e devolve o foco ao botão. Carregamento e troca são
 * anunciados por `role="status"`, falhas por `role="alert"`.
 *
 * O Esc é ouvido na fase de CAPTURA da `window`, antes da gaveta do shell
 * (que ouve no `document`): fechar o painel não pode fechar a gaveta junto.
 *
 * Sem `localStorage`, `sessionStorage`, cookie escrito por script ou URL: a
 * empresa ativa é da sessão, no servidor.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as KeyboardEventReact, ReactNode } from "react";
import { Button } from "../components/Button";
import {
  ContextoApiError,
  listarEmpresasDoContexto,
  trocarEmpresaDoContexto,
  type EmpresaDoContextoApi,
} from "../api/contextoEmpresarialClient";
import { useResumoDasEdicoes } from "./edicoesPendentes";
import "./SeletorEmpresaAtiva.css";

/** Empresa ativa como o ator a traz. `id` falta só em montagens de teste. */
export interface EmpresaAtivaExibida {
  readonly id?: string;
  readonly codigo: string;
  readonly nome: string;
}

export type EstadoOpcoesDeEmpresa =
  /** O papel não troca de empresa: não há lista a pedir. */
  | { readonly tipo: "nao-aplicavel" }
  /** `anteriores`: a última lista, mantida à vista enquanto ela é relida. */
  | {
      readonly tipo: "carregando";
      readonly anteriores?: EmpresaDoContextoApi[];
    }
  | { readonly tipo: "carregadas"; readonly itens: EmpresaDoContextoApi[] }
  | { readonly tipo: "falha" };

interface OpcoesDeEmpresa {
  readonly estado: EstadoOpcoesDeEmpresa;
  readonly recarregar: () => void;
}

const OpcoesContext = createContext<OpcoesDeEmpresa | null>(null);

function useCarregamentoDeEmpresas(ativo: boolean): OpcoesDeEmpresa {
  const [estado, setEstado] = useState<EstadoOpcoesDeEmpresa>(() =>
    ativo ? { tipo: "carregando" } : { tipo: "nao-aplicavel" },
  );
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ativo) {
      setEstado({ tipo: "nao-aplicavel" });
      return;
    }
    let cancelado = false;
    setEstado((anterior) =>
      anterior.tipo === "carregadas"
        ? { tipo: "carregando", anteriores: anterior.itens }
        : { tipo: "carregando" },
    );
    listarEmpresasDoContexto()
      .then((itens) => {
        if (!cancelado) setEstado({ tipo: "carregadas", itens });
      })
      .catch(() => {
        // Nada do corpo da resposta é lido nem exibido: a mensagem é nossa.
        if (!cancelado) setEstado({ tipo: "falha" });
      });
    return () => {
      cancelado = true;
    };
  }, [ativo, tentativa]);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);
  return { estado, recarregar };
}

/**
 * Lê a lista uma vez para todos os seletores abaixo dele (Hub e shell). O
 * `AutenticacaoApp` o monta com `key` no ator: outra conta, outra leitura.
 */
export function ProvedorDeEmpresasDoContexto({
  podeTrocarEmpresa,
  children,
}: {
  readonly podeTrocarEmpresa: boolean;
  readonly children: ReactNode;
}) {
  const opcoes = useCarregamentoDeEmpresas(podeTrocarEmpresa);
  return (
    <OpcoesContext.Provider value={opcoes}>{children}</OpcoesContext.Provider>
  );
}

/** Do provedor, quando há; senão, leitura própria (componente montado só). */
function useOpcoesDeEmpresa(podeTrocarEmpresa: boolean): OpcoesDeEmpresa {
  const doProvedor = useContext(OpcoesContext);
  const local = useCarregamentoDeEmpresas(
    doProvedor === null && podeTrocarEmpresa,
  );
  return doProvedor ?? local;
}

type EstadoTroca =
  | { readonly tipo: "ocioso" }
  | {
      readonly tipo: "confirmando";
      readonly empresa: EmpresaDoContextoApi;
      readonly pendentes: readonly string[];
    }
  | { readonly tipo: "trocando"; readonly empresa: EmpresaDoContextoApi }
  | { readonly tipo: "falha" }
  | { readonly tipo: "indisponivel" };

export interface SeletorEmpresaAtivaProps {
  /** Prefixo dos ids — único por lugar em que o componente aparece. */
  readonly id: string;
  /** Onde ele aparece: muda só o espaçamento. */
  readonly variante: "menu" | "hub";
  readonly empresaAtiva: EmpresaAtivaExibida | null;
  /** Decidido pelo servidor (`/users/me`). O frontend não deduz. */
  readonly podeTrocarEmpresa: boolean;
  /** Só para a nota de que o acesso global volta com novo login. */
  readonly papelDoAtor: string | null;
  /** Chamado depois de o SERVIDOR confirmar a troca. */
  readonly onEmpresaTrocada: (empresa: EmpresaDoContextoApi) => void;
}

const ROTULO_GLOBAL = "Acesso global — todas as empresas";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p.charAt(0));
  return letras.join("").toUpperCase();
}

function listaEmTexto(rotulos: readonly string[]): string {
  if (rotulos.length <= 1) return rotulos[0] ?? "";
  return `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}

export function SeletorEmpresaAtiva({
  id,
  variante,
  empresaAtiva,
  podeTrocarEmpresa,
  papelDoAtor,
  onEmpresaTrocada,
}: SeletorEmpresaAtivaProps) {
  const { estado: opcoes, recarregar } = useOpcoesDeEmpresa(podeTrocarEmpresa);
  const resumo = useResumoDasEdicoes();
  const [aberto, setAberto] = useState(false);
  const [troca, setTroca] = useState<EstadoTroca>({ tipo: "ocioso" });

  const raizRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const confirmacaoRef = useRef<HTMLDivElement | null>(null);
  /** Foco pedido para depois do desenho que abre o painel. */
  const focarListaRef = useRef(false);

  const idBotao = `${id}-botao`;
  const idPainel = `${id}-painel`;
  const idTituloLista = `${id}-titulo-lista`;
  const idConfirmacao = `${id}-confirmacao`;

  // Durante uma releitura, a lista anterior segura o botão no lugar.
  const itensConhecidos =
    opcoes.tipo === "carregadas"
      ? opcoes.itens
      : opcoes.tipo === "carregando"
        ? (opcoes.anteriores ?? null)
        : null;
  const itens = opcoes.tipo === "carregadas" ? opcoes.itens : [];
  const ehAtual = (empresa: EmpresaDoContextoApi) =>
    empresaAtiva?.id !== undefined
      ? empresa.id === empresaAtiva.id
      : empresa.codigo === empresaAtiva?.codigo;
  const haOutraOpcao = (itensConhecidos ?? []).some((e) => !ehAtual(e));
  const expansivel = podeTrocarEmpresa && haOutraOpcao;

  const trocando = troca.tipo === "trocando";
  const salvandoAgora = resumo.salvando.length > 0;
  const opcoesTravadas =
    trocando || troca.tipo === "confirmando" || salvandoAgora;

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setTroca((t) =>
      t.tipo === "confirmando" ||
      t.tipo === "falha" ||
      t.tipo === "indisponivel"
        ? { tipo: "ocioso" }
        : t,
    );
    if (devolverFoco) botaoRef.current?.focus();
  }, []);

  // Foco na abertura: a empresa atual, ou a primeira opção habilitada.
  useEffect(() => {
    if (!aberto || !focarListaRef.current) return;
    const botoes = [
      ...(listaRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) ?? []),
    ];
    if (botoes.length === 0) return;
    focarListaRef.current = false;
    const atual = botoes.find((b) => b.getAttribute("aria-current") === "true");
    (atual ?? botoes[0])!.focus();
  });

  // A confirmação recebe o foco no botão que NÃO descarta nada.
  useEffect(() => {
    if (troca.tipo !== "confirmando") return;
    confirmacaoRef.current
      ?.querySelector<HTMLElement>("[data-foco-inicial]")
      ?.focus();
  }, [troca.tipo]);

  // Esc e clique fora. Captura na `window`: roda antes da gaveta do shell.
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      const raiz = raizRef.current;
      if (!raiz || !raiz.contains(document.activeElement)) return;
      evento.preventDefault();
      evento.stopPropagation();
      fechar(true);
    }
    function aoApontar(evento: PointerEvent) {
      const raiz = raizRef.current;
      if (
        raiz &&
        evento.target instanceof Node &&
        !raiz.contains(evento.target)
      )
        fechar(false);
    }
    window.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoApontar);
    return () => {
      window.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoApontar);
    };
  }, [aberto, fechar]);

  // Se a lista deixa de ter para onde ir (recarregada depois de uma empresa
  // indisponível), o painel fecha — não fica um painel sem escolha.
  useEffect(() => {
    if (aberto && opcoes.tipo === "carregadas" && !haOutraOpcao) {
      setAberto(false);
    }
  }, [aberto, opcoes.tipo, haOutraOpcao]);

  function alternar() {
    if (aberto) {
      fechar(false);
      return;
    }
    focarListaRef.current = true;
    setAberto(true);
  }

  function aoTeclarNoBotao(evento: KeyboardEventReact<HTMLButtonElement>) {
    if (evento.key === "ArrowDown" && !aberto) {
      evento.preventDefault();
      focarListaRef.current = true;
      setAberto(true);
    }
  }

  function aoTeclarNaLista(evento: KeyboardEventReact<HTMLUListElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(evento.key)) return;
    const botoes = [
      ...(listaRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ) ?? []),
    ];
    if (botoes.length === 0) return;
    evento.preventDefault();
    const indice = botoes.indexOf(document.activeElement as HTMLButtonElement);
    let proximo = 0;
    if (evento.key === "End") proximo = botoes.length - 1;
    else if (evento.key === "ArrowDown")
      proximo = indice < 0 ? 0 : (indice + 1) % botoes.length;
    else if (evento.key === "ArrowUp")
      proximo =
        indice < 0
          ? botoes.length - 1
          : (indice - 1 + botoes.length) % botoes.length;
    botoes[proximo]!.focus();
  }

  async function trocarPara(empresa: EmpresaDoContextoApi) {
    setTroca({ tipo: "trocando", empresa });
    try {
      const confirmada = await trocarEmpresaDoContexto(empresa.id);
      // Quem monta este componente recria a árvore: nada mais a fazer aqui.
      onEmpresaTrocada(confirmada);
    } catch (erro) {
      if (erro instanceof ContextoApiError && erro.status === 404) {
        // Inexistente, inativa ou não mais autorizada — o servidor não diz
        // qual, e a tela também não. A lista é relida.
        setTroca({ tipo: "indisponivel" });
        recarregar();
        return;
      }
      setTroca({ tipo: "falha" });
    }
  }

  function escolher(empresa: EmpresaDoContextoApi) {
    if (ehAtual(empresa)) {
      fechar(true);
      return;
    }
    if (salvandoAgora || trocando) return;
    if (resumo.pendentes.length > 0) {
      setTroca({ tipo: "confirmando", empresa, pendentes: resumo.pendentes });
      return;
    }
    void trocarPara(empresa);
  }

  function cancelarConfirmacao() {
    setTroca({ tipo: "ocioso" });
    fechar(true);
  }

  const nomeExibido =
    empresaAtiva === null
      ? podeTrocarEmpresa
        ? ROTULO_GLOBAL
        : "Não disponível para o seu perfil"
      : empresaAtiva.nome;

  const identidade = (
    <>
      {empresaAtiva ? (
        <span className="seletor-empresa__monograma" aria-hidden="true">
          {iniciais(empresaAtiva.nome)}
        </span>
      ) : null}
      <span className="seletor-empresa__textos">
        <span className="seletor-empresa__rotulo">Empresa ativa</span>
        <span className="seletor-empresa__nome">{nomeExibido}</span>
        {empresaAtiva ? (
          <span className="seletor-empresa__codigo">
            Código {empresaAtiva.codigo}
          </span>
        ) : null}
      </span>
    </>
  );

  const textoStatus =
    opcoes.tipo === "carregando" && !aberto
      ? "Carregando empresas…"
      : trocando
        ? `Trocando para ${troca.empresa.nome}…`
        : aberto && salvandoAgora
          ? `Aguarde: há um salvamento em andamento (${listaEmTexto(resumo.salvando)}). A troca de empresa fica disponível quando ele terminar.`
          : "";

  return (
    <div
      className={`seletor-empresa seletor-empresa--${variante}`}
      ref={raizRef}
      onBlur={(evento) => {
        // Foco que sai do componente fecha o painel (Tab para fora).
        const destino = evento.relatedTarget;
        if (
          aberto &&
          destino instanceof Node &&
          !raizRef.current?.contains(destino)
        ) {
          fechar(false);
        }
      }}
    >
      {expansivel ? (
        <button
          type="button"
          id={idBotao}
          ref={botaoRef}
          className="seletor-empresa__cartao seletor-empresa__botao"
          aria-expanded={aberto}
          aria-controls={idPainel}
          onClick={alternar}
          onKeyDown={aoTeclarNoBotao}
        >
          {identidade}
          <span className="seletor-empresa__oculto">Trocar de empresa</span>
          <svg
            className="seletor-empresa__seta"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <div className="seletor-empresa__cartao seletor-empresa__leitura">
          {identidade}
        </div>
      )}

      {expansivel ? (
        <div id={idPainel} className="seletor-empresa__painel" hidden={!aberto}>
          {troca.tipo === "confirmando" ? (
            <div
              className="seletor-empresa__confirmacao"
              role="group"
              aria-labelledby={idConfirmacao}
              ref={confirmacaoRef}
            >
              <p id={idConfirmacao} role="alert">
                Há edição em andamento em: {listaEmTexto(troca.pendentes)}.
                Trocar para {troca.empresa.nome} descarta o que não foi salvo.
              </p>
              <div className="seletor-empresa__acoes">
                <Button
                  type="button"
                  variant="secondary"
                  data-foco-inicial
                  onClick={cancelarConfirmacao}
                >
                  Continuar editando
                </Button>
                <Button
                  type="button"
                  onClick={() => void trocarPara(troca.empresa)}
                >
                  Trocar e descartar
                </Button>
              </div>
            </div>
          ) : null}

          <p className="seletor-empresa__titulo-lista" id={idTituloLista}>
            Empresas autorizadas
          </p>
          {opcoes.tipo === "carregando" ? (
            <p className="seletor-empresa__nota" role="status">
              Carregando empresas…
            </p>
          ) : (
            <ul
              className="seletor-empresa__lista"
              aria-labelledby={idTituloLista}
              ref={listaRef}
              onKeyDown={aoTeclarNaLista}
            >
              {itens.map((empresa) => {
                const atual = ehAtual(empresa);
                return (
                  <li key={empresa.id}>
                    <button
                      type="button"
                      className="seletor-empresa__opcao"
                      aria-current={atual ? "true" : undefined}
                      disabled={!atual && opcoesTravadas}
                      onClick={() => escolher(empresa)}
                    >
                      <span className="seletor-empresa__opcao-textos">
                        <span className="seletor-empresa__opcao-nome">
                          {empresa.nome}
                        </span>
                        <span className="seletor-empresa__opcao-codigo">
                          Código {empresa.codigo}
                        </span>
                      </span>
                      {atual ? (
                        <span className="seletor-empresa__atual">
                          <svg
                            viewBox="0 0 16 16"
                            width="14"
                            height="14"
                            aria-hidden="true"
                            focusable="false"
                          >
                            <path
                              d="M3.5 8.5l3 3 6-7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Atual
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {papelDoAtor === "master_tecnico" && empresaAtiva !== null ? (
            <p className="seletor-empresa__nota">
              O acesso global a todas as empresas volta com um novo login.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Fora do painel: se a lista relida não tiver mais para onde ir, o
          painel fecha e o aviso continua à vista. */}
      {troca.tipo === "falha" ? (
        <p className="seletor-empresa__erro" role="alert">
          Não foi possível trocar de empresa. Você continua na empresa atual;
          tente de novo.
        </p>
      ) : null}
      {troca.tipo === "indisponivel" ? (
        <p className="seletor-empresa__erro" role="alert">
          A empresa escolhida não está mais disponível para a sua conta. A lista
          foi atualizada.
        </p>
      ) : null}

      {podeTrocarEmpresa && opcoes.tipo === "falha" ? (
        <div className="seletor-empresa__falha">
          <p className="seletor-empresa__erro" role="alert">
            Não foi possível carregar as empresas.
          </p>
          <Button type="button" variant="secondary" onClick={recarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <p className="seletor-empresa__status" role="status">
        {textoStatus}
      </p>
    </div>
  );
}
