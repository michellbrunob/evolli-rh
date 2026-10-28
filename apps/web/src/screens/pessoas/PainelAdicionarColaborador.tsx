/**
 * T194 — painel lateral "Adicionar colaborador": o ponto de entrada das formas
 * de iniciar a entrada de uma pessoa na empresa ativa.
 *
 * Só escolhe — nunca grava nada nem chama API. Hoje há uma forma disponível,
 * o cadastro individual, que leva à página de Nova admissão de sempre (com a
 * confirmação e a idempotência da T179). As outras duas aparecem com o motivo
 * de estarem indisponíveis e **não podem ser escolhidas**: o rádio delas é
 * desabilitado de verdade (fora do teclado, anunciado como indisponível), e
 * não há botão, link nem ação por trás delas — botão sem operação seria
 * promessa falsa (T178).
 *
 * As formas são um grupo de rádios nativos (`<input type="radio">` dentro do
 * cartão-rótulo): teclado, leitor de tela e estado desabilitado vêm do
 * navegador, sem ARIA inventado. O botão do rodapé inicia a forma escolhida.
 *
 * A janela é o `Modal` (foco preso, Escape, foco devolvido a quem abriu), na
 * posição lateral. Sem formulário a salvar, nunca vira edição pendente
 * (T189): abrir e fechar não pedem confirmação, e a troca de empresa segue
 * livre. Ícones: SVG desenhado aqui, com geometria simples, sempre
 * `aria-hidden` — nenhum vem de conjunto de terceiros (decisão da T159).
 */
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Button, Modal } from "../../components";
import "./PainelAdicionarColaborador.css";

export const TITULO_PAINEL_ADICIONAR = "Adicionar colaborador";
export const ROTULO_INICIAR_CADASTRO = "Iniciar cadastro";

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

/** Moldura comum dos ícones: mesmo `viewBox`, traço e cor do texto. */
function Icone({ children }: { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Uma pessoa com um "+": adicionar alguém. */
export function IconeAdicionarPessoa() {
  return (
    <Icone>
      <circle cx="8" cy="6.5" r="3" />
      <path d="M2.75 16.25c0-2.9 2.35-5 5.25-5 1.2 0 2.3.25 3.2.75" />
      <path d="M15 11.5v5M12.5 14h5" />
    </Icone>
  );
}

/** Uma folha com linhas de tabela: planilha. */
function IconePlanilha() {
  return (
    <Icone>
      <rect x="4" y="2.75" width="12" height="14.5" rx="1.5" />
      <path d="M4 7.5h12M4 12h12M9 7.5v9.75" />
    </Icone>
  );
}

/** Um envelope: convite enviado à pessoa. */
function IconeConvite() {
  return (
    <Icone>
      <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="1.5" />
      <path d="M3.25 5.5 10 10.5l6.75-5" />
    </Icone>
  );
}

type FormaId = "individual" | "planilha" | "digital";

interface Forma {
  readonly id: FormaId;
  readonly titulo: string;
  readonly texto: string;
  readonly icone: ReactNode;
  /** Etiqueta curta: o tempo, para a disponível; o estado, para as outras. */
  readonly etiqueta: string;
  /** Presente só nas indisponíveis: por que ainda não dá para usar. */
  readonly motivo?: string;
}

const FORMAS: readonly Forma[] = [
  {
    id: "individual",
    titulo: "Cadastro individual",
    texto:
      "Você preenche os dados da pessoa com calma, numa página só para isso, e confere tudo antes de salvar.",
    icone: <IconeAdicionarPessoa />,
    etiqueta: "Leva poucos minutos",
  },
  {
    id: "planilha",
    titulo: "Importar planilha",
    texto: "Traga várias pessoas de uma vez a partir de um arquivo.",
    icone: <IconePlanilha />,
    etiqueta: "Indisponível · em preparação",
    motivo:
      "Ainda estamos preparando a importação. Por enquanto, cadastre uma pessoa de cada vez.",
  },
  {
    id: "digital",
    titulo: "Admissão digital",
    texto:
      "A própria pessoa preenche os dados dela a partir de um convite, e você só confere.",
    icone: <IconeConvite />,
    etiqueta: "Indisponível · em preparação",
    motivo:
      "Antes de liberar, precisamos fechar as regras de segurança, de proteção de dados (LGPD) e do convite.",
  },
];

export function PainelAdicionarColaborador({
  aberto,
  empresaAtiva,
  onFechar,
  onCadastroIndividual,
}: PainelAdicionarColaboradorProps) {
  const prefixo = useId();
  // Só a forma disponível pode ser escolhida; ela já vem marcada.
  const [escolhida, setEscolhida] = useState<FormaId>("individual");

  function iniciar() {
    if (escolhida === "individual") onCadastroIndividual();
  }

  return (
    <Modal
      aberto={aberto}
      titulo={TITULO_PAINEL_ADICIONAR}
      descricao="Escolha o caminho mais prático para trazer alguém para a equipe."
      posicao="lateral"
      icone={<IconeAdicionarPessoa />}
      onFechar={onFechar}
      rodape={
        <>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={iniciar}>
            {ROTULO_INICIAR_CADASTRO}
          </Button>
        </>
      }
    >
      {empresaAtiva ? (
        <p className="painel-adicionar__empresa">
          Você está adicionando em{" "}
          <strong>
            {empresaAtiva.nome} ({empresaAtiva.codigo})
          </strong>
          .
        </p>
      ) : null}

      <fieldset className="painel-adicionar__formas">
        <legend className="painel-adicionar__legenda">
          Como você quer adicionar
        </legend>
        {FORMAS.map((forma) => {
          const disponivel = forma.motivo === undefined;
          const idTitulo = `${prefixo}-${forma.id}-titulo`;
          const idTexto = `${prefixo}-${forma.id}-texto`;
          const idMotivo = `${prefixo}-${forma.id}-motivo`;
          const idEtiqueta = `${prefixo}-${forma.id}-etiqueta`;
          const marcada = disponivel && escolhida === forma.id;
          return (
            <label
              key={forma.id}
              className={[
                "painel-adicionar__forma",
                disponivel
                  ? "painel-adicionar__forma--disponivel"
                  : "painel-adicionar__forma--indisponivel",
                marcada ? "painel-adicionar__forma--marcada" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              // Forma indisponível nunca é escolhida, nem pelo clique no
              // cartão: o rádio já é desabilitado, e o clique é anulado aqui.
              {...(disponivel ? {} : { onClick: (e) => e.preventDefault() })}
            >
              <span className="painel-adicionar__icone" aria-hidden="true">
                {forma.icone}
              </span>
              <span className="painel-adicionar__conteudo">
                <span className="painel-adicionar__titulo" id={idTitulo}>
                  {forma.titulo}
                </span>
                <span className="painel-adicionar__texto" id={idTexto}>
                  {forma.texto}
                </span>
                {forma.motivo ? (
                  <span className="painel-adicionar__motivo" id={idMotivo}>
                    {forma.motivo}
                  </span>
                ) : null}
                <span className="painel-adicionar__etiqueta" id={idEtiqueta}>
                  {forma.etiqueta}
                </span>
              </span>
              <input
                type="radio"
                className="painel-adicionar__radio"
                name={`${prefixo}-forma`}
                value={forma.id}
                checked={marcada}
                disabled={!disponivel}
                // Nome: só o título; o resto do cartão é descrição.
                aria-labelledby={idTitulo}
                aria-describedby={
                  disponivel
                    ? `${idTexto} ${idEtiqueta}`
                    : `${idEtiqueta} ${idTexto} ${idMotivo}`
                }
                onChange={() => {
                  if (disponivel) setEscolhida(forma.id);
                }}
              />
            </label>
          );
        })}
      </fieldset>
    </Modal>
  );
}
