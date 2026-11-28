/**
 * T216 — saúde financeira no assistente: o aviso de tema sensível (abaixo
 * da identificação) e o interruptor que inclui ou tira as 3 perguntas
 * opcionais de autopercepção (não mudam a nota). As perguntas aparecem em
 * `PerguntasFixas`, como nos outros modelos de metodologia fixa.
 */
import type { Secao } from "../../../../api/pesquisasClient";
import { novoId } from "../../textosDasPesquisas";
import { SECOES_ISFB } from "./definicao";
import "../Modelos.css";

const TITULO_DA_AUTOPERCEPCAO = SECOES_ISFB[SECOES_ISFB.length - 1]!.titulo;

export const temAutopercepcao = (secoes: readonly Secao[]): boolean =>
  secoes.some((s) => s.perguntas.some((p) => p.chave === "O1"));

/** As seções com ou sem a autopercepção (O1 a O3, a última seção). */
export function comAutopercepcao(
  secoes: readonly Secao[],
  incluir: boolean,
): Secao[] {
  const sem = secoes.filter(
    (s) => !s.perguntas.some((p) => p.chave?.startsWith("O")),
  );
  if (!incluir) return sem;
  const modelo = SECOES_ISFB[SECOES_ISFB.length - 1]!;
  return [
    ...sem,
    {
      id: novoId(),
      titulo: TITULO_DA_AUTOPERCEPCAO,
      descricao: null,
      perguntas: modelo.perguntas.map((p) => ({
        id: novoId(),
        chave: p.chave ?? null,
        tipo: p.tipo,
        texto: p.texto,
        descricao: null,
        obrigatoria: p.obrigatoria ?? false,
        config: { ...(p.config ?? {}) },
        condicao: null,
        rotulo: p.rotulo ?? null,
      })),
    },
  ];
}

export function AvisoDaSaudeFinanceira() {
  return (
    <p className="pesquisas__nota" role="note">
      Dinheiro é um tema sensível. Com Confidencial ou Anônima as pessoas
      costumam responder com mais sinceridade; com Identificada, o RH vê o
      resultado de cada pessoa e os perfis do time.
    </p>
  );
}

export function InterruptorDaAutopercepcao({
  secoes,
  travado,
  onMudar,
}: {
  readonly secoes: readonly Secao[];
  readonly travado: boolean;
  readonly onMudar: (secoes: Secao[]) => void;
}) {
  const ligado = temAutopercepcao(secoes);
  return (
    <div className="pesquisas__cartao-secao modelos__opcional">
      <div>
        <strong>Incluir autopercepção (3 perguntas opcionais)</strong>
        <p className="pesquisas__suave">
          Não muda a nota. Ajuda o RH a ver quem percebe a própria situação e
          está aberto a receber apoio.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label="Incluir autopercepção"
        className="pesquisas__interruptor"
        disabled={travado}
        onClick={() => onMudar(comAutopercepcao(secoes, !ligado))}
      >
        <span className="pesquisas__interruptor-trilho" aria-hidden="true" />
      </button>
    </div>
  );
}
