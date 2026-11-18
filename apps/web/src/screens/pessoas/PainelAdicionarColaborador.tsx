/**
 * T194 — painel lateral "Adicionar colaborador": o ponto de entrada das formas
 * de iniciar a entrada de uma pessoa na empresa ativa.
 *
 * Só escolhe — nunca grava nada nem chama API. O cadastro individual leva à
 * página de Nova admissão de sempre (com a confirmação e a idempotência da
 * T179); a importação por planilha (T209, Bloco C), à página de importação,
 * quando o shell a oferece. As indisponíveis aparecem com o motivo
 * de estarem indisponíveis e **não podem ser escolhidas**: o rádio delas é
 * desabilitado de verdade (fora do teclado, anunciado como indisponível), e
 * não há botão, link nem ação por trás delas — botão sem operação seria
 * promessa falsa (T178).
 *
 * As formas são um grupo de rádios nativos (`<input type="radio">` dentro do
 * cartão-rótulo): teclado, leitor de tela e estado desabilitado vêm do
 * navegador, sem ARIA inventado. O botão do rodapé inicia a forma escolhida.
 *
 * T212 — escolhida a planilha, o próprio cartão se abre nos três passos
 * (baixar o modelo `.xlsx`, preencher, escolher o arquivo — pelo botão ou
 * soltando o arquivo na área). O arquivo fica só neste navegador; o botão do
 * rodapé só se habilita com ele e o entrega ao shell, que abre a página de
 * importação já na conferência.
 *
 * A janela é o `Sheet` da camada `src/ui` (T209, Radix): entra pela direita,
 * foco no título, foco preso, Escape e clique no fundo fecham, foco devolvido
 * a quem abriu, fundo inerte e rolagem travada. Sem formulário a salvar,
 * nunca vira edição pendente
 * (T189): abrir e fechar não pedem confirmação, e a troca de empresa segue
 * livre. Ícones dos cartões: SVG desenhado aqui, com geometria simples;
 * os dos passos vêm de `src/ui/icones`. Sempre `aria-hidden`.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { Button, Sheet } from "../../ui";
import {
  IconeBaixarArquivo,
  IconeEnviarArquivo,
  IconeInformacao,
} from "../../ui/icones";
import { baixarArquivo } from "../dashboard/exportacao";
import { LIMITE_DE_LINHAS } from "./importacao/planilhaColaboradores";
import {
  NOME_DO_MODELO_XLSX,
  TIPO_MIME_XLSX,
  gerarModeloXlsx,
} from "./importacao/planilhaXlsx";
import "./PainelAdicionarColaborador.css";

export const TITULO_PAINEL_ADICIONAR = "Adicionar colaborador";
export const ROTULO_INICIAR_CADASTRO = "Iniciar cadastro";
export const ROTULO_INICIAR_IMPORTACAO = "Iniciar importação";
/** T212 — nome acessível do campo de arquivo do passo 3. */
export const ROTULO_ARQUIVO_DO_PAINEL = "Arquivo da planilha (.xlsx ou .csv)";

/** T212 — os dados obrigatórios do modelo, como a pessoa os lê. */
const DADOS_OBRIGATORIOS = [
  "Nome",
  "Tipo de vínculo",
  "Data de admissão",
  "Data de nascimento",
  "Departamento",
  "Cargo",
] as const;

/** T212 — o que o painel aceita (a página confere o resto). */
const FORMATOS_ACEITOS = `.xlsx,.csv,${TIPO_MIME_XLSX},text/csv`;
const EXTENSAO_ACEITA = /\.(xlsx|csv)$/i;

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
  /**
   * T209 (Bloco C) — importar planilha: leva à página de importação. Sem
   * ele, a forma segue indisponível, com o motivo.
   */
  readonly onImportarPlanilha?: () => void;
  /**
   * T212 — o arquivo escolhido no passo 3 do painel: o shell abre a página
   * de importação já com ele, na conferência.
   */
  readonly onImportarArquivo?: (arquivo: File) => void;
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

/** T209 (Bloco C) — a planilha, quando há quem a abra. */
const PLANILHA_DISPONIVEL: Forma = {
  id: "planilha",
  titulo: "Importar planilha",
  texto:
    "Traga várias pessoas de uma vez a partir de um arquivo, conferido linha a linha antes de importar.",
  icone: <IconePlanilha />,
  etiqueta: "Até 200 pessoas por arquivo .xlsx ou .csv",
};

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

/** T212 — um passo numerado da importação. */
function Passo({
  numero,
  titulo,
  texto,
  children,
}: {
  readonly numero: number;
  readonly titulo: string;
  readonly texto?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <li className="painel-adicionar__passo">
      <span className="painel-adicionar__passo-numero" aria-hidden="true">
        {numero}
      </span>
      <div className="painel-adicionar__passo-conteudo">
        <p className="painel-adicionar__passo-titulo">{titulo}</p>
        {texto ? (
          <p className="painel-adicionar__passo-texto">{texto}</p>
        ) : null}
        {children}
      </div>
    </li>
  );
}

export function PainelAdicionarColaborador({
  aberto,
  empresaAtiva,
  onFechar,
  onCadastroIndividual,
  onImportarPlanilha,
  onImportarArquivo,
}: PainelAdicionarColaboradorProps) {
  const prefixo = useId();
  // Só as formas disponíveis podem ser escolhidas; o cadastro individual já
  // vem marcado.
  const [escolhida, setEscolhida] = useState<FormaId>("individual");
  // T212 — o arquivo escolhido no passo 3 (só neste navegador).
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoRecusado, setArquivoRecusado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const campoArquivoRef = useRef<HTMLInputElement>(null);
  const formas = FORMAS.map((forma) =>
    forma.id === "planilha" && onImportarPlanilha ? PLANILHA_DISPONIVEL : forma,
  );
  const importando = escolhida === "planilha" && Boolean(onImportarPlanilha);
  // Com o passo 3 no painel, a importação só começa com o arquivo.
  const esperaArquivo = importando && Boolean(onImportarArquivo);
  const idAviso = `${prefixo}-aviso`;
  const idFormatos = `${prefixo}-formatos`;

  // Fechado o painel, o arquivo escolhido é esquecido.
  useEffect(() => {
    if (aberto) return;
    setArquivo(null);
    setArquivoRecusado(null);
    setArrastando(false);
  }, [aberto]);

  function receberArquivo(escolhido: File | undefined) {
    if (!escolhido) return;
    if (!EXTENSAO_ACEITA.test(escolhido.name)) {
      setArquivo(null);
      setArquivoRecusado(
        `"${escolhido.name}" não é .xlsx nem .csv. Use o modelo baixado no passo 1.`,
      );
      return;
    }
    setArquivoRecusado(null);
    setArquivo(escolhido);
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    receberArquivo(evento.dataTransfer.files?.[0]);
  }

  function iniciar() {
    if (escolhida === "individual") onCadastroIndividual();
    else if (escolhida === "planilha") {
      if (onImportarArquivo) {
        if (arquivo) onImportarArquivo(arquivo);
      } else onImportarPlanilha?.();
    }
  }

  const passosDaImportacao = (
    <section
      className="painel-adicionar__importacao"
      aria-labelledby={`${prefixo}-como-importar`}
    >
      <h3
        id={`${prefixo}-como-importar`}
        className="painel-adicionar__subtitulo"
      >
        Como importar
      </h3>
      <ol className="painel-adicionar__passos">
        <Passo
          numero={1}
          titulo="Baixe o modelo"
          texto="Planilha .xlsx com as colunas certas, exemplos e instruções."
        >
          <Button
            variant="secondary"
            className="painel-adicionar__baixar"
            onClick={() =>
              baixarArquivo(
                gerarModeloXlsx(),
                NOME_DO_MODELO_XLSX,
                TIPO_MIME_XLSX,
              )
            }
          >
            <IconeBaixarArquivo />
            Baixar modelo (.xlsx)
          </Button>
        </Passo>
        <Passo
          numero={2}
          titulo="Preencha no Excel ou no Google Planilhas"
          texto={
            <>
              Uma pessoa por linha, com os códigos ativos de departamento, cargo
              e unidade, e sem a linha de exemplo. Estes dados são obrigatórios;
              matrícula e unidade podem ficar em branco:
            </>
          }
        >
          <ul
            className="painel-adicionar__obrigatorios"
            aria-label="Dados obrigatórios"
          >
            {DADOS_OBRIGATORIOS.map((dado) => (
              <li key={dado} className="painel-adicionar__obrigatorio">
                {dado}
                <span
                  className="painel-adicionar__obrigatorio-marca"
                  aria-hidden="true"
                >
                  *
                </span>
              </li>
            ))}
          </ul>
        </Passo>
        <Passo numero={3} titulo="Escolha o arquivo preenchido">
          {onImportarArquivo ? (
            <div
              className={[
                "painel-adicionar__soltar",
                arrastando ? "painel-adicionar__soltar--arrastando" : "",
                arquivo ? "painel-adicionar__soltar--escolhido" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={(evento) => {
                evento.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={aoSoltar}
            >
              <span
                className="painel-adicionar__soltar-icone"
                aria-hidden="true"
              >
                <IconeEnviarArquivo tamanho={22} />
              </span>
              <p className="painel-adicionar__soltar-titulo">
                Selecione a planilha neste computador
              </p>
              <p className="painel-adicionar__soltar-texto" id={idFormatos}>
                .xlsx ou .csv em UTF-8 · até {LIMITE_DE_LINHAS} linhas e 1 MB
              </p>
              {/* Campo nativo, oculto: o botão o abre; o rótulo dá o nome. */}
              <input
                ref={campoArquivoRef}
                type="file"
                hidden
                accept={FORMATOS_ACEITOS}
                aria-label={ROTULO_ARQUIVO_DO_PAINEL}
                onChange={(evento) => {
                  const campo = evento.currentTarget;
                  const escolhido = campo.files?.[0];
                  campo.value = "";
                  receberArquivo(escolhido);
                }}
              />
              <Button
                variant="primary"
                aria-describedby={idFormatos}
                onClick={() => campoArquivoRef.current?.click()}
              >
                <IconeEnviarArquivo />
                {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
              </Button>
              <p className="painel-adicionar__soltar-dica">
                ou solte o arquivo nesta área
              </p>
              <p
                className="painel-adicionar__soltar-escolhido"
                role="status"
                aria-live="polite"
              >
                {arquivo ? (
                  <>
                    Arquivo escolhido: <strong>{arquivo.name}</strong>
                  </>
                ) : null}
              </p>
              {arquivoRecusado ? (
                <p className="painel-adicionar__soltar-erro" role="alert">
                  {arquivoRecusado}
                </p>
              ) : null}
            </div>
          ) : null}
        </Passo>
      </ol>
    </section>
  );

  return (
    <Sheet
      aberto={aberto}
      titulo={TITULO_PAINEL_ADICIONAR}
      descricao="Escolha o caminho mais prático para trazer alguém para a equipe."
      icone={<IconeAdicionarPessoa />}
      onFechar={onFechar}
      rodape={
        <>
          {esperaArquivo && !arquivo ? (
            <p className="painel-adicionar__aviso" id={idAviso}>
              <IconeInformacao tamanho={16} />
              Escolha o arquivo no passo 3 para seguir
            </p>
          ) : null}
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={iniciar}
            disabled={esperaArquivo && !arquivo}
            {...(esperaArquivo && !arquivo
              ? { "aria-describedby": idAviso }
              : {})}
          >
            {importando ? ROTULO_INICIAR_IMPORTACAO : ROTULO_INICIAR_CADASTRO}
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
        {formas.map((forma) => {
          const disponivel = forma.motivo === undefined;
          const idTitulo = `${prefixo}-${forma.id}-titulo`;
          const idTexto = `${prefixo}-${forma.id}-texto`;
          const idMotivo = `${prefixo}-${forma.id}-motivo`;
          const idEtiqueta = `${prefixo}-${forma.id}-etiqueta`;
          const marcada = disponivel && escolhida === forma.id;
          // T212 — a planilha escolhida abre os passos no próprio cartão.
          const expandida = marcada && forma.id === "planilha" && importando;
          return (
            <div
              key={forma.id}
              className={[
                "painel-adicionar__bloco",
                expandida ? "painel-adicionar__bloco--expandido" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <label
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
              {expandida ? passosDaImportacao : null}
            </div>
          );
        })}
      </fieldset>
    </Sheet>
  );
}
