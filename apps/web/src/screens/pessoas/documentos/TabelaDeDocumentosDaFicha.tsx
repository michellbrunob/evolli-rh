import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormActions, StatusBadge } from "../../../components";
import { formatarInstante } from "../../../format/data";
import { Button, Dialog } from "../../../ui";
import {
  AvisoFlutuante,
  type ConteudoDoAviso,
} from "../../../ui/AvisoFlutuante";
import {
  IconeBaixarArquivo,
  IconeDocumento,
  IconeEnviarArquivo,
  IconeRemover,
  IconeVer,
} from "../../../ui/icones";
import {
  listarDocumentosDoColaborador,
  obterArquivoDoDocumento,
  removerDocumentoDoColaborador,
  verDocumentoDoColaborador,
  verificarDocumentoDeNovo,
  type DocumentoColaboradorApi,
} from "../../../api/colaboradoresClient";
import { baixarArquivo } from "../../dashboard/exportacao";
import {
  ROTULO_DO_ESTADO,
  ordenarPorEnvio,
  podeVerNoNavegador,
  quemEnviou,
  resumoDosDocumentos,
  rotuloDoDocumento,
  tamanhoLegivel,
} from "./documentosDoColaborador";
import {
  MenuDoArquivo,
  useFocoDepois,
  type AcaoDoMenu,
} from "./PecasDosDocumentos";
import "./TabelaDeDocumentosDaFicha.css";

/**
 * T217 — aba Documentos da ficha: a tabela do que já foi enviado (o
 * checklist de envio fica na edição e na etapa 4 do cadastro).
 *
 * - Cabeçalho: título, resumo ("N arquivos · último envio em …") e "Enviar
 *   documento", que leva à edição na seção Documentos.
 * - Colunas: Documento (rótulo + nome original), Enviado por (nome e papel),
 *   Data de envio (dia e hora, fuso de Brasília) e ações.
 * - Ordem: do envio mais recente para o mais antigo (versão atual).
 * - Ações (RH e DP): Ver (PDF e imagens), Baixar e "⋯" com Remover — e
 *   "Verificar de novo" enquanto o antivírus não respondeu. Só o aprovado é
 *   visto ou baixado (quarentena da T213).
 * - Remover é lógico: o arquivo sai da lista e continua guardado.
 * - Colaborador desligado continua editável (decisão da proprietária).
 * - Só leitura (`master_tecnico`): a tabela e quem enviou, sem ações.
 */

export interface TabelaDeDocumentosDaFichaProps {
  readonly colaboradorId: string;
  /** RH e DP: veem, baixam, removem e enviam (pela edição). */
  readonly podeOperar: boolean;
  /** Abre a edição na seção Documentos (o envio é feito lá). */
  readonly onEnviar?: () => void;
  /** A quantidade a cada carga (o contador da aba). */
  readonly onContagem?: (quantidade: number) => void;
}

type Carga =
  | { readonly estado: "carregando" }
  | { readonly estado: "falha" }
  | {
      readonly estado: "pronto";
      readonly documentos: DocumentoColaboradorApi[];
    };

const nomeDoTipo = (d: DocumentoColaboradorApi) =>
  rotuloDoDocumento(d.categoria, d.nome);

/** O nome original; sem ele (envio antigo ou só leitura), formato e tamanho. */
const nomeDoArquivo = (d: DocumentoColaboradorApi) =>
  d.nomeArquivo ??
  `${d.formato.toUpperCase()} · ${tamanhoLegivel(d.tamanhoBytes)}`;

const COLUNAS = ["Documento", "Enviado por", "Data de envio"] as const;

export function TabelaDeDocumentosDaFicha({
  colaboradorId,
  podeOperar,
  onEnviar,
  onContagem,
}: TabelaDeDocumentosDaFichaProps) {
  const prefixo = useId();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<DocumentoColaboradorApi | null>(
    null,
  );
  const [aviso, setAviso] = useState<ConteudoDoAviso | null>(null);
  const contador = useRef(0);
  const focar = useFocoDepois();

  const avisar = (titulo: string, tom?: "erro") => {
    contador.current += 1;
    setAviso({ id: contador.current, titulo, ...(tom ? { tom } : {}) });
  };

  const carregar = useCallback(async () => {
    try {
      const documentos = await listarDocumentosDoColaborador(colaboradorId);
      setCarga({ estado: "pronto", documentos: ordenarPorEnvio(documentos) });
    } catch {
      setCarga({ estado: "falha" });
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const avisarContagem = useRef(onContagem);
  avisarContagem.current = onContagem;
  useEffect(() => {
    if (carga.estado === "pronto") {
      avisarContagem.current?.(carga.documentos.length);
    }
  }, [carga]);

  const linhaId = (documentoId: string) => `${prefixo}-linha-${documentoId}`;
  const titulo = () => document.getElementById(`${prefixo}-titulo`);

  async function executar(
    documento: DocumentoColaboradorApi,
    acao: () => Promise<unknown>,
    falha: string,
  ) {
    setOcupado(documento.id);
    try {
      await acao();
    } catch {
      avisar(falha, "erro");
    } finally {
      setOcupado(null);
    }
  }

  const baixar = (documento: DocumentoColaboradorApi) =>
    executar(
      documento,
      async () => {
        const { blob, nome } = await obterArquivoDoDocumento(
          colaboradorId,
          documento.id,
        );
        baixarArquivo(
          blob,
          documento.nomeArquivo ?? nome,
          blob.type || "application/octet-stream",
        );
      },
      "Não foi possível baixar o arquivo agora. Tente de novo.",
    );

  const ver = (documento: DocumentoColaboradorApi) =>
    executar(
      documento,
      () => verDocumentoDoColaborador(colaboradorId, documento.id),
      "Não foi possível abrir o arquivo agora. Tente de novo.",
    );

  const verificar = (documento: DocumentoColaboradorApi) =>
    executar(
      documento,
      async () => {
        await verificarDocumentoDeNovo(colaboradorId, documento.id);
        await carregar();
      },
      "Não foi possível verificar o arquivo agora. Tente de novo.",
    );

  async function confirmarRemocao() {
    const alvo = removendo;
    setRemovendo(null);
    if (!alvo || carga.estado !== "pronto") return;
    const lista = carga.documentos;
    const posicao = lista.findIndex((d) => d.id === alvo.id);
    const vizinho = lista[posicao + 1] ?? lista[posicao - 1] ?? null;
    setOcupado(alvo.id);
    try {
      await removerDocumentoDoColaborador(colaboradorId, alvo.id);
      avisar("Arquivo removido da ficha.");
      await carregar();
      // O foco vai à linha vizinha (o "⋯" dela) ou, sem outra, ao título.
      focar(() =>
        vizinho
          ? (document
              .getElementById(linhaId(vizinho.id))
              ?.querySelector<HTMLElement>('[data-foco="menu"]') ?? titulo())
          : titulo(),
      );
    } catch {
      avisar(
        "Não foi possível remover o arquivo agora. Tente de novo.",
        "erro",
      );
    } finally {
      setOcupado(null);
    }
  }

  const botaoEnviar = (variante: "primary" | "secondary") =>
    podeOperar && onEnviar ? (
      <Button type="button" variant={variante} onClick={onEnviar}>
        <IconeEnviarArquivo />
        Enviar documento
      </Button>
    ) : null;

  const linha = (documento: DocumentoColaboradorApi) => {
    const tipo = nomeDoTipo(documento);
    const aprovado = documento.estado === "aprovado";
    const acoes: AcaoDoMenu[] = [
      ...(documento.estado === "em_verificacao"
        ? [
            {
              id: "verificar",
              rotulo: "Verificar de novo",
              aoEscolher: () => void verificar(documento),
            },
          ]
        : []),
      {
        id: "remover",
        rotulo: "Remover",
        aoEscolher: () => setRemovendo(documento),
      },
    ];
    return (
      <tr
        key={documento.id}
        id={linhaId(documento.id)}
        className="tabela-documentos__linha"
      >
        <td className="tabela-documentos__celula tabela-documentos__celula--documento">
          <span className="tabela-documentos__icone" aria-hidden="true">
            <IconeDocumento tamanho={18} />
          </span>
          <span className="tabela-documentos__identificacao">
            <span className="tabela-documentos__tipo">
              <strong>{tipo}</strong>
              {aprovado ? null : (
                <StatusBadge
                  variant={documento.estado === "reprovado" ? "danger" : "info"}
                >
                  {ROTULO_DO_ESTADO[documento.estado]}
                </StatusBadge>
              )}
            </span>
            <span
              className="tabela-documentos__arquivo"
              title={nomeDoArquivo(documento)}
            >
              {nomeDoArquivo(documento)}
            </span>
          </span>
        </td>
        <td className="tabela-documentos__celula tabela-documentos__celula--texto">
          <span className="tabela-documentos__rotulo-movel">Enviado por</span>
          {quemEnviou(documento.enviadoPor)}
        </td>
        <td className="tabela-documentos__celula tabela-documentos__celula--texto">
          <span className="tabela-documentos__rotulo-movel">Data de envio</span>
          {formatarInstante(documento.enviadoEm)}
        </td>
        <td className="tabela-documentos__celula tabela-documentos__celula--acoes">
          {podeOperar ? (
            <span className="tabela-documentos__acoes">
              {aprovado && podeVerNoNavegador(documento.formato) ? (
                <button
                  type="button"
                  className="tabela-documentos__botao"
                  aria-label={`Ver ${tipo}`}
                  title="Ver"
                  disabled={ocupado === documento.id}
                  onClick={() => void ver(documento)}
                >
                  <IconeVer tamanho={18} />
                </button>
              ) : null}
              {aprovado ? (
                <button
                  type="button"
                  className="tabela-documentos__botao"
                  aria-label={`Baixar ${tipo}`}
                  title="Baixar"
                  disabled={ocupado === documento.id}
                  onClick={() => void baixar(documento)}
                >
                  <IconeBaixarArquivo tamanho={18} />
                </button>
              ) : null}
              <MenuDoArquivo nome={tipo} acoes={acoes} />
            </span>
          ) : null}
        </td>
      </tr>
    );
  };

  const corpo = () => {
    if (carga.estado === "carregando") {
      return [0, 1, 2].map((i) => (
        <tr key={i} className="tabela-documentos__linha" aria-hidden="true">
          <td className="tabela-documentos__celula tabela-documentos__celula--documento">
            <span className="tabela-documentos__esqueleto tabela-documentos__esqueleto--icone" />
            <span className="tabela-documentos__esqueleto tabela-documentos__esqueleto--largo" />
          </td>
          <td className="tabela-documentos__celula">
            <span className="tabela-documentos__esqueleto" />
          </td>
          <td className="tabela-documentos__celula">
            <span className="tabela-documentos__esqueleto" />
          </td>
          <td className="tabela-documentos__celula" />
        </tr>
      ));
    }
    if (carga.estado === "pronto" && carga.documentos.length === 0) {
      return (
        <tr>
          <td colSpan={4} className="tabela-documentos__vazio">
            <span className="tabela-documentos__vazio-icone" aria-hidden="true">
              <IconeDocumento tamanho={20} />
            </span>
            <h4 className="tabela-documentos__vazio-titulo">
              Ainda não há arquivos
            </h4>
            <p className="tabela-documentos__vazio-texto">
              Documentos pessoais, comprovantes e contratos enviados para esta
              pessoa aparecem aqui, guardados com proteção.
            </p>
            {botaoEnviar("primary")}
          </td>
        </tr>
      );
    }
    return carga.estado === "pronto" ? carga.documentos.map(linha) : null;
  };

  return (
    <section
      className="tabela-documentos"
      aria-labelledby={`${prefixo}-titulo`}
    >
      <div className="tabela-documentos__cabeca">
        <div className="tabela-documentos__textos">
          <h3
            className="tabela-documentos__titulo"
            id={`${prefixo}-titulo`}
            tabIndex={-1}
          >
            Documentos
          </h3>
          <p className="tabela-documentos__resumo">
            {carga.estado === "pronto"
              ? resumoDosDocumentos(carga.documentos)
              : carga.estado === "carregando"
                ? "Carregando…"
                : " "}
          </p>
        </div>
        {botaoEnviar("secondary")}
      </div>

      {carga.estado === "falha" ? (
        <div className="tabela-documentos__falha">
          <p className="tabela-documentos__erro" role="alert">
            Não foi possível carregar os documentos agora. Tente de novo.
          </p>
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCarga({ estado: "carregando" });
                void carregar();
              }}
            >
              Tentar de novo
            </Button>
          </FormActions>
        </div>
      ) : (
        <div className="tabela-documentos__caixa">
          {carga.estado === "carregando" ? (
            <span
              className="ev:sr-only"
              role="status"
              aria-busy="true"
              aria-label="Carregando documentos"
            />
          ) : null}
          <table
            className="tabela-documentos__tabela"
            aria-label="Documentos enviados"
          >
            <colgroup>
              <col className="tabela-documentos__col-documento" />
              <col className="tabela-documentos__col-texto" />
              <col className="tabela-documentos__col-texto" />
              <col className="tabela-documentos__col-acoes" />
            </colgroup>
            <thead>
              <tr className="tabela-documentos__cabecalho">
                {COLUNAS.map((coluna) => (
                  <th key={coluna} scope="col">
                    {coluna}
                  </th>
                ))}
                <th scope="col">
                  <span className="ev:sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>{corpo()}</tbody>
          </table>
        </div>
      )}

      <Dialog
        aberto={removendo !== null}
        titulo="Remover este arquivo da ficha?"
        icone={<IconeRemover tamanho={20} />}
        descricao={
          removendo
            ? `${nomeDoTipo(removendo)} (${nomeDoArquivo(removendo)}) deixa de aparecer na lista, mas continua guardado com segurança.`
            : ""
        }
        onFechar={() => setRemovendo(null)}
        rodape={
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRemovendo(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              className="tabela-documentos__perigo"
              onClick={() => void confirmarRemocao()}
            >
              Remover
            </Button>
          </FormActions>
        }
      >
        {null}
      </Dialog>

      <AvisoFlutuante aviso={aviso} onFechar={() => setAviso(null)} />
    </section>
  );
}
