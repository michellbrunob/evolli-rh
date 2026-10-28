/**
 * T194 — painel lateral "Adicionar colaborador": o ponto de entrada das formas
 * de iniciar a entrada de uma pessoa na empresa ativa.
 *
 * Só escolhe — nunca grava nada nem chama API. Hoje há uma forma disponível,
 * o cadastro individual, que leva à página de Nova admissão de sempre (com a
 * confirmação e a idempotência da T179). As outras duas aparecem com o motivo
 * de estarem indisponíveis e **sem nenhum controle**: não há botão, link nem
 * ação por trás delas — botão sem operação seria promessa falsa (T178).
 *
 * A janela é o `Modal` (foco preso, Escape, foco devolvido a quem abriu), na
 * posição lateral. Sem formulário, nunca vira edição pendente (T189): abrir e
 * fechar não pedem confirmação, e a troca de empresa segue livre.
 */
import { useId } from "react";
import { Button, Modal, StatusBadge } from "../../components";
import "./PainelAdicionarColaborador.css";

export const TITULO_PAINEL_ADICIONAR = "Adicionar colaborador";

export interface PainelAdicionarColaboradorProps {
  readonly aberto: boolean;
  /** Empresa em que a entrada vai acontecer (a ativa da sessão). */
  readonly empresaAtiva?: {
    readonly nome: string;
    readonly codigo: string;
  } | null;
  readonly onFechar: () => void;
  /** Cadastro individual: leva à página de Nova admissão. */
  readonly onCadastroIndividual: () => void;
}

interface FormaIndisponivel {
  readonly titulo: string;
  readonly finalidade: string;
  readonly motivo: string;
}

const INDISPONIVEIS: readonly FormaIndisponivel[] = [
  {
    titulo: "Importar planilha",
    finalidade: "Cadastrar várias pessoas de uma vez a partir de um arquivo.",
    motivo:
      "A importação está em preparação e ainda não foi liberada para uso.",
  },
  {
    titulo: "Admissão digital",
    finalidade:
      "A própria pessoa preenche os dados dela a partir de um convite.",
    motivo:
      "Depende das definições de segurança, de proteção de dados (LGPD) e do convite, ainda em decisão.",
  },
];

export function PainelAdicionarColaborador({
  aberto,
  empresaAtiva,
  onFechar,
  onCadastroIndividual,
}: PainelAdicionarColaboradorProps) {
  const prefixo = useId();
  const idTitulo = (i: number) => `${prefixo}-forma-${i}`;
  const idTexto = (i: number) => `${prefixo}-forma-${i}-texto`;

  return (
    <Modal
      aberto={aberto}
      titulo={TITULO_PAINEL_ADICIONAR}
      descricao="Escolha como iniciar a entrada de uma pessoa. Cada forma tem o seu caminho; as indisponíveis dizem por quê."
      posicao="lateral"
      onFechar={onFechar}
      rodape={
        <Button type="button" variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      }
    >
      {empresaAtiva ? (
        <p className="painel-adicionar__empresa">
          Empresa ativa:{" "}
          <strong>
            {empresaAtiva.nome} ({empresaAtiva.codigo})
          </strong>
        </p>
      ) : null}

      <ul className="painel-adicionar__formas" aria-label="Formas de adicionar">
        <li
          className="painel-adicionar__forma painel-adicionar__forma--disponivel"
          aria-labelledby={idTitulo(0)}
        >
          <div className="painel-adicionar__cabecalho">
            <h3 className="painel-adicionar__titulo" id={idTitulo(0)}>
              Cadastro individual
            </h3>
            <StatusBadge variant="success">Disponível</StatusBadge>
          </div>
          <p className="painel-adicionar__texto" id={idTexto(0)}>
            Você preenche os dados de uma pessoa na página de Nova admissão e
            confirma antes de gravar.
          </p>
          <Button
            type="button"
            className="painel-adicionar__acao"
            aria-describedby={idTexto(0)}
            onClick={onCadastroIndividual}
          >
            Iniciar cadastro individual
          </Button>
        </li>

        {INDISPONIVEIS.map((forma, indice) => {
          const i = indice + 1;
          return (
            <li
              key={forma.titulo}
              className="painel-adicionar__forma painel-adicionar__forma--indisponivel"
              aria-labelledby={idTitulo(i)}
            >
              <div className="painel-adicionar__cabecalho">
                <h3 className="painel-adicionar__titulo" id={idTitulo(i)}>
                  {forma.titulo}
                </h3>
                <StatusBadge variant="neutral">Indisponível</StatusBadge>
              </div>
              <p className="painel-adicionar__texto">{forma.finalidade}</p>
              <p className="painel-adicionar__motivo">
                <span className="painel-adicionar__motivo-rotulo">
                  Por que está indisponível:
                </span>{" "}
                {forma.motivo}
              </p>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
