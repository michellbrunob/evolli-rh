/**
 * T214 — o período do Dashboard: um botão com o ano e os meses lidos
 * ("2026 · jan a nov · até hoje") que abre uma janela com os anos. Nesta
 * fatia só existe a escala Ano; mês, trimestre e semestre ficam para depois.
 *
 * Padrão de janela não modal: o botão diz se está aberto (`aria-expanded`) e
 * qual janela controla; ao abrir, o foco vai ao ano escolhido; Escape fecha e
 * devolve o foco ao botão; clique fora ou foco fora fecham. Escolher um ano
 * fecha a janela, devolve o foco ao botão e entrega o ano ao shell.
 */
import { useEffect, useId, useRef, useState } from "react";
import { IconeAbrir, IconeCalendario } from "../../ui/icones";
import { periodoDoAno, rotuloDoPeriodo } from "./dashboardDados";

export function SeletorDePeriodo({
  ano,
  anos,
  corrente,
  onTrocarAno,
  onAbrir,
  lendoAnos = false,
}: {
  readonly ano: number;
  /** Do mais recente ao mais antigo: só os anos com cadastro. */
  readonly anos: readonly number[];
  readonly corrente: number;
  readonly onTrocarAno: (ano: number) => void;
  /** Chamado ao abrir a janela (a tela lê os anos com cadastro). */
  readonly onAbrir?: () => void;
  /** Os anos com cadastro ainda estão sendo lidos. */
  readonly lendoAnos?: boolean;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const escolhidoRef = useRef<HTMLButtonElement | null>(null);

  const periodo = periodoDoAno(ano);
  const meses = rotuloDoPeriodo(periodo);
  const situacao = periodo.ateHoje ? "até hoje" : "ano fechado";

  useEffect(() => {
    if (!aberto) return undefined;
    escolhidoRef.current?.focus();
    function aoPressionarFora(evento: Event) {
      const alvo = evento.target;
      if (alvo instanceof Node && raizRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    document.addEventListener("pointerdown", aoPressionarFora);
    document.addEventListener("mousedown", aoPressionarFora);
    return () => {
      document.removeEventListener("pointerdown", aoPressionarFora);
      document.removeEventListener("mousedown", aoPressionarFora);
    };
  }, [aberto]);

  function fecharDevolvendoFoco() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  return (
    <div
      ref={raizRef}
      className="dashboard__periodo dashboard__sem-impressao"
      onBlur={(evento) => {
        const destino = evento.relatedTarget;
        if (destino instanceof Node && raizRef.current?.contains(destino)) {
          return;
        }
        setAberto(false);
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && aberto) {
          evento.preventDefault();
          fecharDevolvendoFoco();
        }
      }}
    >
      <button
        ref={botaoRef}
        type="button"
        className="dashboard__periodo-botao"
        aria-expanded={aberto}
        aria-controls={`${id}-janela`}
        onClick={() => {
          if (!aberto) onAbrir?.();
          setAberto((a) => !a);
        }}
      >
        <IconeCalendario tamanho={18} className="dashboard__periodo-icone" />
        <span className="dashboard__so-leitor">Período consultado: </span>
        {/* `key` pelo ano: trocar de ano remonta o rótulo (nunca reescreve
            o texto de um ano com o de outro). */}
        <strong key={ano} className="dashboard__periodo-ano">
          {String(ano)}
        </strong>
        <span key={`m-${String(ano)}`} className="dashboard__periodo-meses">
          {meses} · {situacao}
        </span>
        <IconeAbrir tamanho={16} className="dashboard__periodo-seta" />
      </button>

      <div
        id={`${id}-janela`}
        role="dialog"
        aria-label="Escolher o período"
        className="dashboard__periodo-janela"
        hidden={!aberto}
      >
        <p className="dashboard__escala">
          <span className="dashboard__escala-item" aria-current="true">
            Ano
          </span>
        </p>
        {lendoAnos ? (
          <p className="dashboard__periodo-lendo">
            Buscando os anos com cadastro…
          </p>
        ) : null}
        <div role="group" aria-label="Ano" className="dashboard__periodo-anos">
          {anos.map((a) => {
            const p = periodoDoAno(a);
            const escolhido = a === ano;
            return (
              <button
                key={a}
                ref={escolhido ? escolhidoRef : undefined}
                type="button"
                className="dashboard__periodo-ano-opcao"
                aria-pressed={escolhido}
                onClick={() => {
                  fecharDevolvendoFoco();
                  if (!escolhido) onTrocarAno(a);
                }}
              >
                <span className="dashboard__periodo-ano-numero">
                  {String(a)}
                </span>
                <span className="dashboard__periodo-ano-detalhe">
                  {a === corrente
                    ? `${rotuloDoPeriodo(p)} · em andamento`
                    : "ano fechado"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="dashboard__periodo-explicacao">
          <p key={ano} className="dashboard__periodo-resumo">
            {String(ano)} · {meses}
            {periodo.ateHoje ? " (em andamento)" : " (ano fechado)"}
          </p>
          <p>
            Entradas, saídas e movimentações somam os meses do ano. Pessoas
            ativas, distribuição e tempo de casa são de hoje.
          </p>
        </div>
      </div>
    </div>
  );
}
