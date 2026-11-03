/**
 * T200 — guarda de saída com edição pendente: um ponto único no shell.
 *
 * ## Por que existe
 *
 * O registro da T189 (`edicoesPendentes.tsx`) sabe quais telas têm alteração
 * não salva ou salvamento em andamento, mas só a troca de empresa o
 * consultava. Menu, Hub, Sair, abas que desmontam a tela, rota digitada e
 * voltar/avançar descartavam o que foi digitado sem perguntar.
 *
 * Agora toda saída pede licença por aqui (`solicitarSaida`):
 *
 * - nada pendente → sai na hora;
 * - edição pendente → um único diálogo do Evolli lista as telas e oferece
 *   **Continuar editando** (padrão, também no Escape) ou **Sair sem salvar**
 *   (só com clique explícito);
 * - salvamento em andamento → a saída fica bloqueada, o motivo é dito e não
 *   há descarte; quando o salvamento termina, a pessoa continua onde está
 *   (nada navega sozinho).
 *
 * As telas não ganham lógica de navegação: continuam só declarando
 * `useEdicaoEmAndamento`. A troca de empresa continua com o diálogo próprio
 * da T189.
 *
 * ## Recarregar e fechar a aba
 *
 * Só o navegador pode perguntar: o aviso nativo (`beforeunload`), com o texto
 * dele. Fica registrado **apenas** enquanto houver edição pendente ou
 * salvamento — registrado sempre, impediria o cache de voltar/avançar.
 *
 * ## Fora de um provedor
 *
 * Telas montadas sozinhas (os testes de cada uma) não têm guarda: o pedido
 * executa direto, como antes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Button } from "../components/Button";
import {
  type AreaDeEdicaoId,
  useRegistroDoContexto,
  useResumoDasEdicoes,
} from "./edicoesPendentes";
import "./guardaDeSaida.css";

export interface PedidoDeSaida {
  /** A saída em si: só roda sem pendência, ou depois de "Sair sem salvar". */
  readonly executar: () => void;
  /**
   * Só as edições desta área contam (a saída desmonta só ela); numa lista,
   * as de todas elas. Sem área, contam todas.
   */
  readonly area?: AreaDeEdicaoId | readonly AreaDeEdicaoId[];
  /**
   * A saída só começa em `executar` e termina depois (voltar/avançar do
   * navegador, que é assíncrono). Depois de "Sair sem salvar", o foco não
   * volta a quem pediu: quem conclui a saída cuida dele.
   */
  readonly adiada?: boolean;
}

export interface GuardaDeSaida {
  /** Pede a saída: executa já, ou depois da escolha explícita. */
  solicitarSaida(pedido: PedidoDeSaida): void;
  /** Há o que perguntar (edição pendente ou salvamento) nesta área? */
  exigeConfirmacao(area?: AreaDeEdicaoId | readonly AreaDeEdicaoId[]): boolean;
  /** O diálogo da guarda está na tela. */
  ocupada(): boolean;
}

const GUARDA_LIVRE: GuardaDeSaida = {
  solicitarSaida: (pedido) => pedido.executar(),
  exigeConfirmacao: () => false,
  ocupada: () => false,
};

const GuardaContext = createContext<GuardaDeSaida>(GUARDA_LIVRE);

/** A guarda do shell (fora dele, uma que deixa sair sempre). */
export function useGuardaDeSaida(): GuardaDeSaida {
  return useContext(GuardaContext);
}

/**
 * Onde o foco descansa quando quem o tinha saiu da tela: a região principal
 * do shell, a área do Hub ou, sem nenhuma delas, o `<main>`. Nunca o `body`.
 */
const REGIOES_PRINCIPAIS = ["#conteudo-principal", "#hub-conteudo", "main"];

/** Foca a região principal que estiver na tela. `true` se conseguiu. */
export function focarRegiaoPrincipal(): boolean {
  for (const seletor of REGIOES_PRINCIPAIS) {
    const regiao = document.querySelector<HTMLElement>(seletor);
    regiao?.focus();
    if (regiao && document.activeElement === regiao) return true;
  }
  return false;
}

interface PerguntaAberta {
  readonly pedido: PedidoDeSaida;
  readonly modo: "confirmar" | "salvando";
  /** As telas, nas palavras delas, no momento da pergunta. */
  readonly rotulos: readonly string[];
  /** As frases a mais que as próprias telas declararam (`aviso`). */
  readonly avisos: readonly string[];
  /** Quem pediu a saída: recebe o foco de volta ao continuar. */
  readonly origem: HTMLElement | null;
}

const INERTE = { inert: "" } as Record<string, string>;
const FOCAVEIS = "button:not([disabled])";

/**
 * O provedor da guarda. Precisa estar dentro de `ProvedorDeEdicoes` (é o
 * registro dele que a guarda lê). Envolve a árvore do produto: enquanto o
 * diálogo está na tela, ela fica inerte.
 *
 * `suspensa`: outro aviso do shell assumiu a tela (empresa trocada em outra
 * aba). A pergunta em aberto é desfeita sem sair, e nenhuma nova abre.
 */
export function ProvedorDeGuarda({
  children,
  suspensa = false,
}: {
  readonly children: ReactNode;
  readonly suspensa?: boolean;
}) {
  const registro = useRegistroDoContexto();
  const resumo = useResumoDasEdicoes();
  const [pergunta, setPergunta] = useState<PerguntaAberta | null>(null);
  const perguntaRef = useRef(pergunta);
  perguntaRef.current = pergunta;
  const suspensaRef = useRef(suspensa);
  suspensaRef.current = suspensa;
  /** Durante a saída aceita, pedidos aninhados (a mesma saída) passam direto. */
  const executandoRef = useRef(false);
  /** Para onde o foco volta depois que o diálogo some. */
  const focoDepoisRef = useRef<{
    alvo: HTMLElement | null;
    saiu: boolean;
  } | null>(null);

  const api = useMemo<GuardaDeSaida>(
    () => ({
      solicitarSaida(pedido) {
        if (executandoRef.current || registro === null) {
          pedido.executar();
          return;
        }
        // Já há uma pergunta na tela (ou outro aviso do shell): nada de
        // segunda pergunta nem de saída por baixo dela.
        if (perguntaRef.current !== null || suspensaRef.current) return;
        const r = registro.resumir(pedido.area);
        if (r.pendentes.length === 0 && r.salvando.length === 0) {
          pedido.executar();
          return;
        }
        const ativo = document.activeElement;
        const nova: PerguntaAberta = {
          pedido,
          modo: r.salvando.length > 0 ? "salvando" : "confirmar",
          rotulos: r.salvando.length > 0 ? r.salvando : r.pendentes,
          avisos: r.salvando.length > 0 ? [] : registro.avisos(pedido.area),
          origem:
            ativo instanceof HTMLElement && ativo !== document.body
              ? ativo
              : null,
        };
        perguntaRef.current = nova;
        setPergunta(nova);
      },
      exigeConfirmacao(area) {
        if (registro === null) return false;
        const r = registro.resumir(area);
        return r.pendentes.length > 0 || r.salvando.length > 0;
      },
      ocupada: () => perguntaRef.current !== null,
    }),
    [registro],
  );

  const continuar = useCallback(() => {
    const atual = perguntaRef.current;
    if (atual === null) return;
    focoDepoisRef.current = { alvo: atual.origem, saiu: false };
    perguntaRef.current = null;
    setPergunta(null);
  }, []);

  const sairSemSalvar = useCallback(() => {
    const atual = perguntaRef.current;
    if (atual === null || atual.modo !== "confirmar") return;
    focoDepoisRef.current = atual.pedido.adiada
      ? null
      : { alvo: atual.origem, saiu: true };
    perguntaRef.current = null;
    setPergunta(null);
    executandoRef.current = true;
    try {
      atual.pedido.executar();
    } finally {
      executandoRef.current = false;
    }
  }, []);

  // Outro aviso do shell assumiu a tela: a pergunta é desfeita sem sair.
  useEffect(() => {
    if (suspensa && perguntaRef.current !== null) continuar();
  }, [suspensa, continuar]);

  // O foco depois do diálogo: de volta a quem pediu, se ele ainda está na
  // tela; senão, depois de sair, à região principal — nunca o `body`. Roda
  // depois dos efeitos da tela nova, que podem ter decidido o foco antes. A
  // saída adiada não passa por aqui: quem a conclui cuida do foco.
  useEffect(() => {
    if (pergunta !== null) return;
    const depois = focoDepoisRef.current;
    if (depois === null) return;
    focoDepoisRef.current = null;
    const { alvo, saiu } = depois;
    if (alvo && alvo.isConnected) {
      alvo.focus();
      if (document.activeElement === alvo) return;
    }
    const ativo = document.activeElement;
    if (saiu && ativo !== null && ativo !== document.body) return;
    focarRegiaoPrincipal();
  }, [pergunta]);

  // Recarregar e fechar a aba: só o aviso nativo, e só com o que perder.
  const temOQuePerder =
    resumo.pendentes.length > 0 || resumo.salvando.length > 0;
  useEffect(() => {
    if (!temOQuePerder) return;
    function avisar(evento: BeforeUnloadEvent) {
      evento.preventDefault();
      // Navegadores antigos só perguntam com `returnValue` preenchido.
      evento.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [temOQuePerder]);

  return (
    <GuardaContext.Provider value={api}>
      {/* O invólucro existe sempre: aparecer só com o diálogo recriaria a
          árvore e descartaria justamente o que ele protege. */}
      <div className="guarda-saida__arvore" {...(pergunta ? INERTE : {})}>
        {children}
      </div>
      {pergunta ? (
        <DialogoDeSaida
          pergunta={pergunta}
          onContinuar={continuar}
          onSair={sairSemSalvar}
        />
      ) : null}
    </GuardaContext.Provider>
  );
}

function DialogoDeSaida({
  pergunta,
  onContinuar,
  onSair,
}: {
  readonly pergunta: PerguntaAberta;
  readonly onContinuar: () => void;
  readonly onSair: () => void;
}) {
  const tituloId = useId();
  const textoId = useId();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const salvando = pergunta.modo === "salvando";

  // O foco entra na ação segura: "Continuar editando" (ou "Entendi").
  useEffect(() => {
    const caixa = caixaRef.current;
    (caixa?.querySelector<HTMLElement>(FOCAVEIS) ?? caixa)?.focus();
  }, []);

  // Escape continua editando; Tab e Shift+Tab ficam no diálogo. Na fase de
  // captura da `window`, antes da gaveta e de qualquer outro ouvinte.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const caixa = caixaRef.current;
      if (!caixa) return;
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        onContinuar();
        return;
      }
      if (evento.key !== "Tab") return;
      evento.preventDefault();
      evento.stopPropagation();
      const focaveis = [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (focaveis.length === 0) {
        caixa.focus();
        return;
      }
      const indice = focaveis.indexOf(document.activeElement as HTMLElement);
      const passo = evento.shiftKey ? -1 : 1;
      const proximo =
        indice < 0 ? 0 : (indice + passo + focaveis.length) % focaveis.length;
      focaveis[proximo]!.focus();
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onContinuar]);

  return (
    <div className="guarda-saida" role="presentation">
      {/* O fundo não é focável: sem impedir o mousedown, o clique nele
          levaria o foco ao `body`, fora do diálogo. Ele também não fecha
          nem sai — só os botões decidem. */}
      <div
        className="guarda-saida__fundo"
        aria-hidden="true"
        onMouseDown={(evento) => evento.preventDefault()}
      />
      <div
        className="guarda-saida__caixa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={textoId}
        tabIndex={-1}
        ref={caixaRef}
      >
        <h2 className="guarda-saida__titulo" id={tituloId}>
          {salvando ? "Aguarde o salvamento terminar" : "Sair sem salvar?"}
        </h2>
        <div className="guarda-saida__texto" id={textoId}>
          <p>
            {salvando
              ? "Há um salvamento em andamento em:"
              : "Há alterações não salvas em:"}
          </p>
          <ul className="guarda-saida__telas">
            {pergunta.rotulos.map((rotulo) => (
              <li key={rotulo}>{rotulo}</li>
            ))}
          </ul>
          <p>
            {salvando
              ? "Não é possível sair enquanto ele não terminar. Quando terminar, você continua nesta tela."
              : "Saindo agora, elas serão descartadas."}
          </p>
          {pergunta.avisos.map((aviso) => (
            <p key={aviso}>{aviso}</p>
          ))}
        </div>
        <div className="guarda-saida__acoes">
          {salvando ? (
            <Button type="button" variant="secondary" onClick={onContinuar}>
              Entendi
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onContinuar}>
                Continuar editando
              </Button>
              <Button type="button" onClick={onSair}>
                Sair sem salvar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
