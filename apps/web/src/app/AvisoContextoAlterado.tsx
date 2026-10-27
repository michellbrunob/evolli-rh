/**
 * T189 — a empresa ativa desta sessão mudou por fora desta aba (troca em
 * outra aba, ou autorização revogada), e ESTA aba tem edição pendente ou
 * salvamento em andamento.
 *
 * ## Por que bloquear
 *
 * O servidor já opera na empresa nova. Deixar o formulário aberto e
 * utilizável seria convidar a gravar na empresa errada. Recriar a tela na
 * hora descartaria o que foi digitado sem aviso. O meio-termo honesto é este:
 * a tela antiga fica visível mas inerte (quem monta isto marca o resto com
 * `inert`), e a pessoa escolhe:
 *
 * - **Voltar à empresa anterior** — a sessão volta para onde esta aba estava,
 *   pelo mesmo contrato de troca, e a edição continua intacta. Só aparece
 *   quando é possível (mesma conta e havia empresa ativa; não há rota para
 *   voltar ao acesso global sem novo login).
 * - **Continuar na empresa nova** — a tela é recriada no contexto novo, e o
 *   que não foi salvo é descartado, como o texto diz antes do clique.
 *
 * Com salvamento em andamento, as duas escolhas esperam ele terminar.
 *
 * T189 (N1) — "continuar" não confia na leitura que abriu este aviso: a
 * empresa pode ter mudado DE NOVO enquanto ele estava na tela (as outras
 * abas seguem trocando). Quem monta o aviso relê o contexto no servidor e só
 * aplica o mais recente. Enquanto confere, e se a conferência falhar, o aviso
 * continua na tela e a árvore antiga continua inerte: nada é liberado nem
 * trocado para um contexto incerto.
 *
 * O nome da empresa anterior não é escrito aqui: pode ser justamente a que
 * deixou de estar autorizada.
 *
 * ## Teclado
 *
 * O foco entra na primeira ação. Tab e Shift+Tab circulam entre as ações; Esc
 * não descarta nada (não há escolha "padrão" destrutiva). As teclas são
 * tratadas na fase de captura da `window`, antes da gaveta do shell, para que
 * o foco preso dela não dispute com este aviso.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { useResumoDasEdicoes } from "./edicoesPendentes";

/** Resultado de reler o contexto antes de seguir na empresa nova. */
export type ResultadoDaConferencia =
  /** O contexto mais recente do servidor foi aplicado. */
  | "aplicado"
  /** 401: a sessão acabou. Nada foi aplicado. */
  | "sessao-encerrada"
  /** Rede, 403, 404, 5xx ou resposta sem papel. Nada foi aplicado. */
  | "falha";

export interface AvisoContextoAlteradoProps {
  /** A empresa em que a sessão está agora, já descrita ("Empresa X (código X)"). */
  readonly empresaNova: string;
  readonly podeVoltar: boolean;
  readonly onVoltar: () => Promise<void>;
  /** Relê o contexto no servidor e aplica o mais recente. */
  readonly onContinuar: () => Promise<ResultadoDaConferencia>;
  /** Saída quando a sessão acabou durante a conferência. */
  readonly onSair: () => void;
}

const FOCAVEIS = "button:not([disabled])";

export function AvisoContextoAlterado({
  empresaNova,
  podeVoltar,
  onVoltar,
  onContinuar,
  onSair,
}: AvisoContextoAlteradoProps) {
  const resumo = useResumoDasEdicoes();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const [voltando, setVoltando] = useState(false);
  const [falhaAoVoltar, setFalhaAoVoltar] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [falhaAoConferir, setFalhaAoConferir] = useState<
    "sessao-encerrada" | "falha" | null
  >(null);
  const salvando = resumo.salvando.length > 0;
  const sessaoEncerrada = falhaAoConferir === "sessao-encerrada";
  const ocupado = salvando || voltando || conferindo || sessaoEncerrada;

  useEffect(() => {
    const caixa = caixaRef.current;
    (caixa?.querySelector<HTMLElement>(FOCAVEIS) ?? caixa)?.focus();
  }, [ocupado]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const caixa = caixaRef.current;
      if (!caixa) return;
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
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
  }, []);

  async function voltar() {
    setVoltando(true);
    setFalhaAoVoltar(false);
    try {
      await onVoltar();
    } catch {
      setFalhaAoVoltar(true);
      setVoltando(false);
    }
  }

  async function continuar() {
    setConferindo(true);
    setFalhaAoConferir(null);
    setFalhaAoVoltar(false);
    try {
      const resultado = await onContinuar();
      // "aplicado": quem monta este aviso já o tirou da tela.
      if (resultado !== "aplicado") setFalhaAoConferir(resultado);
    } catch {
      setFalhaAoConferir("falha");
    } finally {
      setConferindo(false);
    }
  }

  return (
    <div className="aviso-contexto" role="presentation">
      <div className="aviso-contexto__fundo" aria-hidden="true" />
      <div
        className="aviso-contexto__caixa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-contexto-titulo"
        aria-describedby="aviso-contexto-texto"
        tabIndex={-1}
        ref={caixaRef}
      >
        <h2 className="aviso-contexto__titulo" id="aviso-contexto-titulo">
          A empresa ativa mudou
        </h2>
        <div id="aviso-contexto-texto" className="aviso-contexto__texto">
          <p>
            A empresa ativa desta sessão passou a ser {empresaNova}, por uma
            troca feita em outra aba ou por mudança de autorização.
          </p>
          <p>
            Esta aba tem alterações não salvas. Elas não podem ser gravadas na
            empresa anterior enquanto a sessão estiver na nova.
          </p>
        </div>

        {salvando ? (
          <p className="aviso-contexto__status" role="status">
            Aguarde: um salvamento está terminando.
          </p>
        ) : null}
        {voltando ? (
          <p className="aviso-contexto__status" role="status">
            Voltando à empresa anterior…
          </p>
        ) : null}
        {conferindo ? (
          <p className="aviso-contexto__status" role="status">
            Conferindo a empresa ativa com o servidor…
          </p>
        ) : null}
        {falhaAoConferir === "falha" ? (
          <p className="aviso-contexto__erro" role="alert">
            Não foi possível conferir a empresa ativa agora. Nada foi trocado
            nem descartado nesta aba; tente de novo.
          </p>
        ) : null}
        {sessaoEncerrada ? (
          <p className="aviso-contexto__erro" role="alert">
            Sua sessão terminou. As alterações desta aba não podem mais ser
            gravadas; saia e entre de novo.
          </p>
        ) : null}
        {falhaAoVoltar ? (
          <p className="aviso-contexto__erro" role="alert">
            Não foi possível voltar à empresa anterior. Ela pode não estar mais
            disponível para a sua conta.
          </p>
        ) : null}

        <div className="aviso-contexto__acoes">
          {podeVoltar && !falhaAoVoltar ? (
            <Button
              type="button"
              variant="secondary"
              disabled={ocupado}
              onClick={() => void voltar()}
            >
              Voltar à empresa anterior e continuar editando
            </Button>
          ) : null}
          {sessaoEncerrada ? (
            <Button type="button" onClick={onSair}>
              Sair
            </Button>
          ) : (
            <Button
              type="button"
              disabled={ocupado}
              onClick={() => void continuar()}
            >
              Continuar na empresa nova e descartar alterações
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
