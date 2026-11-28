import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormActions } from "../../../components";
import { formatarDiaCivil } from "../../../format/data";
import { Button, Dialog, Input } from "../../../ui";
import {
  IconeBaixarArquivo,
  IconeEnviarArquivo,
  IconeMais,
  IconeVer,
} from "../../../ui/icones";
import {
  enviarDocumentoDoColaborador,
  listarDocumentosDoColaborador,
  obterArquivoDoDocumento,
  removerDocumentoDoColaborador,
  trocarDocumentoDoColaborador,
  verDocumentoDoColaborador,
  verificarDocumentoDeNovo,
  type CategoriaDocumentoColaborador,
  type DocumentoColaboradorApi,
} from "../../../api/colaboradoresClient";
import {
  ACEITA_NO_CAMPO,
  CATEGORIAS_PRINCIPAIS,
  NOME_DE_OUTROS_MAXIMO,
  conferirArquivoEscolhido,
  conferirNomeDeOutros,
  novaChaveDeEnvio,
  podeVerNoNavegador,
  principaisEnviados,
  rotuloDoDocumento,
  tamanhoLegivel,
} from "./documentosDoColaborador";
import { baixarArquivo } from "../../dashboard/exportacao";
import { motivoDaFalhaDoEnvio } from "./EnvioDosDocumentos";
import {
  ArquivoDaLinha,
  EstadoDoDocumento,
  LinhaDoDocumento,
  MenuDoArquivo,
  naLinha,
  useFocoDepois,
  type AcaoDoMenu,
} from "./PecasDosDocumentos";

/**
 * T213 — documentos do colaborador na ficha (ADR 0021): a lista com o estado
 * de cada arquivo e, para RH e DP, enviar, ver, baixar, trocar, verificar de
 * novo e remover. O `master_tecnico` vê só a lista e o estado. O arquivo
 * nunca vem de URL do armazenamento: sempre pela rota autenticada da API.
 */

export interface ArquivosDoColaboradorProps {
  readonly colaboradorId: string;
  /** RH e DP: enviam, baixam, trocam e removem. */
  readonly podeOperar: boolean;
  /** T215 — a lista a cada carga (o ponto de pendência no menu da edição). */
  readonly onDocumentos?: (documentos: DocumentoColaboradorApi[]) => void;
}

type Pedido =
  | {
      readonly tipo: "novo";
      readonly categoria: CategoriaDocumentoColaborador;
      readonly nome?: string;
    }
  | { readonly tipo: "troca"; readonly documento: DocumentoColaboradorApi };

/** O dia do envio (UTC, o mesmo do nome do download), pelo formatador central. */
const dataCurta = (iso: string) => formatarDiaCivil(iso.slice(0, 10));

export function ArquivosDoColaborador({
  colaboradorId,
  podeOperar,
  onDocumentos,
}: ArquivosDoColaboradorProps) {
  const prefixo = useId();
  const [documentos, setDocumentos] = useState<
    DocumentoColaboradorApi[] | null
  >(null);
  const [falhaDaLista, setFalhaDaLista] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string>("");
  const [removendo, setRemovendo] = useState<DocumentoColaboradorApi | null>(
    null,
  );
  const [novoNome, setNovoNome] = useState("");
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const pedido = useRef<Pedido | null>(null);
  const focar = useFocoDepois();

  // Linhas da lista: um documento, ou a categoria ainda pendente.
  const linhaDoArquivo = (documentoId: string) => `${prefixo}-${documentoId}`;
  const linhaPendenteDe = (categoria: CategoriaDocumentoColaborador) =>
    `${prefixo}-pendente-${categoria}`;
  const campoNovo = () => document.getElementById(`${prefixo}-novo`);
  /**
   * Depois de remover: o "Enviar arquivo" da categoria, se ela voltou a
   * Pendente; senão o próximo arquivo da mesma categoria; em "Outros", o
   * campo Nome do documento.
   */
  const depoisDeRemover =
    (categoria: CategoriaDocumentoColaborador) => (): HTMLElement | null =>
      categoria === "outros"
        ? campoNovo()
        : (naLinha(linhaPendenteDe(categoria), "enviar")() ??
          document.querySelector<HTMLElement>(
            `[data-categoria="${categoria}"] [data-foco]`,
          ));

  const carregar = useCallback(async () => {
    try {
      setDocumentos(await listarDocumentosDoColaborador(colaboradorId));
      setFalhaDaLista(null);
    } catch {
      setFalhaDaLista(
        "Não foi possível carregar os documentos agora. Tente de novo.",
      );
    }
  }, [colaboradorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Quem mostra a pendência fora daqui recebe cada lista nova.
  const avisarLista = useRef(onDocumentos);
  avisarLista.current = onDocumentos;
  useEffect(() => {
    if (documentos) avisarLista.current?.(documentos);
  }, [documentos]);

  const marcarErro = (chave: string, erro: string | null) =>
    setErros((atual) => {
      const resto = { ...atual };
      delete resto[chave];
      return erro ? { ...resto, [chave]: erro } : resto;
    });

  function pedirArquivo(novo: Pedido) {
    pedido.current = novo;
    campo.current?.click();
  }

  async function aoEscolher(arquivo: File | undefined) {
    const atual = pedido.current;
    pedido.current = null;
    if (!arquivo || !atual) return;
    const chave =
      atual.tipo === "troca"
        ? atual.documento.id
        : atual.nome
          ? `outros-novo`
          : atual.categoria;
    /** Sem arquivo novo: onde a pessoa estava (Enviar, ou Ver/⋯ na troca). */
    const focarDeVolta = () =>
      focar(
        atual.tipo === "troca"
          ? naLinha(linhaDoArquivo(atual.documento.id), "ver", "menu")
          : atual.nome
            ? campoNovo
            : naLinha(linhaPendenteDe(atual.categoria), "enviar"),
      );
    const erro = conferirArquivoEscolhido(arquivo);
    marcarErro(chave, erro);
    if (erro) {
      focarDeVolta();
      return;
    }
    setOcupado(chave);
    try {
      const gravado =
        atual.tipo === "troca"
          ? await trocarDocumentoDoColaborador(
              colaboradorId,
              atual.documento.id,
              arquivo,
              novaChaveDeEnvio(),
            )
          : await enviarDocumentoDoColaborador(colaboradorId, {
              categoria: atual.categoria,
              ...(atual.nome ? { nome: atual.nome } : {}),
              arquivo,
              chaveIdempotencia: novaChaveDeEnvio(),
            });
      setAviso(
        `${rotuloDoDocumento(gravado.categoria, gravado.nome)}: arquivo recebido.`,
      );
      if (atual.tipo === "novo" && atual.nome) setNovoNome("");
      await carregar();
      // Arquivo recebido: "Ver" se aprovado; senão o "⋯" da linha.
      focar(naLinha(linhaDoArquivo(gravado.id), "ver", "menu"));
    } catch (falha: unknown) {
      marcarErro(chave, motivoDaFalhaDoEnvio(falha));
      focarDeVolta();
    } finally {
      setOcupado(null);
    }
  }

  async function executar(
    documento: DocumentoColaboradorApi,
    acao: () => Promise<unknown>,
    sucesso?: string,
    focoDepois?: () => HTMLElement | null,
  ) {
    setOcupado(documento.id);
    marcarErro(documento.id, null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      await carregar();
      if (focoDepois) focar(focoDepois);
    } catch {
      marcarErro(
        documento.id,
        "Não foi possível concluir agora. Tente de novo.",
      );
      if (focoDepois) focar(naLinha(linhaDoArquivo(documento.id), "menu"));
    } finally {
      setOcupado(null);
    }
  }

  function adicionarOutro() {
    const existentes = (documentos ?? [])
      .filter((d) => d.categoria === "outros")
      .map((d) => d.nome ?? "");
    const erro = conferirNomeDeOutros(novoNome, existentes);
    setErroDoNome(erro);
    if (erro) return;
    pedirArquivo({ tipo: "novo", categoria: "outros", nome: novoNome.trim() });
  }

  const linhaDoDocumento = (documento: DocumentoColaboradorApi) => {
    const nome = rotuloDoDocumento(documento.categoria, documento.nome);
    const aprovado = documento.estado === "aprovado";
    // T217 — Baixar fica na linha (fora do "⋯"), com o nome original.
    const baixar = () =>
      void executar(documento, async () => {
        const { blob, nome: neutro } = await obterArquivoDoDocumento(
          colaboradorId,
          documento.id,
        );
        baixarArquivo(
          blob,
          documento.nomeArquivo ?? neutro,
          blob.type || "application/octet-stream",
        );
      });
    const acoes: AcaoDoMenu[] = podeOperar
      ? [
          {
            id: "trocar",
            rotulo: "Trocar arquivo",
            aoEscolher: () => pedirArquivo({ tipo: "troca", documento }),
          },
          ...(documento.estado === "em_verificacao"
            ? [
                {
                  id: "verificar",
                  rotulo: "Verificar de novo",
                  aoEscolher: () =>
                    void executar(documento, () =>
                      verificarDocumentoDeNovo(colaboradorId, documento.id),
                    ),
                },
              ]
            : []),
          {
            id: "remover",
            rotulo: "Remover",
            aoEscolher: () => setRemovendo(documento),
          },
        ]
      : [];
    return (
      <LinhaDoDocumento
        key={documento.id}
        id={linhaDoArquivo(documento.id)}
        categoria={documento.categoria}
        nome={nome}
        estado={
          <ArquivoDaLinha
            // T217 — o nome original e o dia do envio; sem nome (envio
            // anterior), o formato, o dia e o tamanho.
            nome={
              documento.nomeArquivo ??
              `${documento.formato.toUpperCase()} · ${dataCurta(documento.enviadoEm)}`
            }
            tamanho={
              documento.nomeArquivo
                ? `Enviado em ${dataCurta(documento.enviadoEm)}`
                : tamanhoLegivel(documento.tamanhoBytes)
            }
            estado={
              ocupado === documento.id ? (
                <EstadoDoDocumento estado="em_verificacao" rotulo="Enviando…" />
              ) : (
                <EstadoDoDocumento estado={documento.estado} />
              )
            }
          />
        }
        erro={erros[documento.id] ?? null}
        acoes={
          podeOperar ? (
            <>
              {aprovado && podeVerNoNavegador(documento.formato) ? (
                <button
                  type="button"
                  className="documentos__botao-icone"
                  aria-label={`Ver o arquivo de ${nome}`}
                  data-foco="ver"
                  onClick={() =>
                    void executar(documento, () =>
                      verDocumentoDoColaborador(colaboradorId, documento.id),
                    )
                  }
                >
                  <IconeVer />
                </button>
              ) : null}
              {aprovado ? (
                <button
                  type="button"
                  className="documentos__botao-icone"
                  aria-label={`Baixar o arquivo de ${nome}`}
                  onClick={baixar}
                >
                  <IconeBaixarArquivo />
                </button>
              ) : null}
              <MenuDoArquivo nome={nome} acoes={acoes} />
            </>
          ) : null
        }
      />
    );
  };

  const linhaPendente = (categoria: CategoriaDocumentoColaborador) => {
    const nome = rotuloDoDocumento(categoria, null);
    return (
      <LinhaDoDocumento
        key={`pendente-${categoria}`}
        id={linhaPendenteDe(categoria)}
        categoria={categoria}
        nome={nome}
        estado={
          ocupado === categoria ? (
            <EstadoDoDocumento estado="em_verificacao" rotulo="Enviando…" />
          ) : (
            <EstadoDoDocumento estado="pendente" />
          )
        }
        erro={erros[categoria] ?? null}
        acoes={
          podeOperar ? (
            <Button
              type="button"
              variant="secondary"
              aria-label={`Enviar arquivo de ${nome}`}
              data-foco="enviar"
              disabled={ocupado !== null}
              onClick={() => pedirArquivo({ tipo: "novo", categoria })}
            >
              <IconeEnviarArquivo />
              Enviar arquivo
            </Button>
          ) : null
        }
      />
    );
  };

  const principais = (documentos ?? []).filter((d) => d.categoria !== "outros");
  const outros = (documentos ?? []).filter((d) => d.categoria === "outros");

  return (
    <section
      className="documentos documentos--ficha"
      aria-labelledby={`${prefixo}-titulo`}
    >
      <div className="documentos__secao">
        <h3 className="documentos__titulo" id={`${prefixo}-titulo`}>
          Documentos principais
        </h3>
        {documentos ? (
          <p className="documentos__texto">
            {principaisEnviados(documentos)} de {CATEGORIAS_PRINCIPAIS.length}{" "}
            anexados.
          </p>
        ) : null}
        <p className="documentos__texto" role="status" aria-live="polite">
          {aviso}
        </p>
      </div>

      {falhaDaLista ? (
        <div className="documentos__secao">
          <p className="documentos__erro" role="alert">
            {falhaDaLista}
          </p>
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void carregar()}
            >
              Tentar de novo
            </Button>
          </FormActions>
        </div>
      ) : documentos === null ? (
        <p className="documentos__texto" role="status">
          Carregando documentos…
        </p>
      ) : (
        <>
          <ul className="documentos__lista" aria-label="Documentos principais">
            {CATEGORIAS_PRINCIPAIS.flatMap((categoria) => {
              const daCategoria = principais.filter(
                (d) => d.categoria === categoria,
              );
              return daCategoria.length > 0
                ? daCategoria.map(linhaDoDocumento)
                : [linhaPendente(categoria)];
            })}
          </ul>

          <div className="documentos__secao">
            <h3 className="documentos__titulo">Outros documentos</h3>
            <p className="documentos__texto">
              Contratos, termos assinados e qualquer outro arquivo da pessoa.
            </p>
            {outros.length > 0 ? (
              <ul className="documentos__lista" aria-label="Outros documentos">
                {outros.map(linhaDoDocumento)}
              </ul>
            ) : null}
            {podeOperar ? (
              <div className="documentos__novo">
                <div className="documentos__identificacao">
                  <label
                    className="documentos__nome"
                    htmlFor={`${prefixo}-novo`}
                  >
                    Nome do documento
                  </label>
                  <span
                    className="documentos__detalhe"
                    id={`${prefixo}-novo-ajuda`}
                  >
                    Escreva como ele aparece na lista e escolha o arquivo.
                  </span>
                </div>
                <Input
                  id={`${prefixo}-novo`}
                  type="text"
                  value={novoNome}
                  maxLength={NOME_DE_OUTROS_MAXIMO}
                  placeholder="Ex.: Contrato de experiência"
                  aria-describedby={`${prefixo}-novo-ajuda`}
                  aria-invalid={
                    erroDoNome || erros["outros-novo"] ? true : undefined
                  }
                  onChange={(e) => {
                    setNovoNome(e.target.value);
                    setErroDoNome(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarOutro();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={novoNome.trim() === "" || ocupado !== null}
                  onClick={adicionarOutro}
                >
                  <IconeMais />
                  Adicionar
                </Button>
                {erroDoNome || erros["outros-novo"] ? (
                  <p className="documentos__erro" role="alert">
                    {erroDoNome ?? erros["outros-novo"]}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}

      {podeOperar ? (
        <input
          ref={campo}
          type="file"
          className="documentos__campo-oculto"
          accept={ACEITA_NO_CAMPO}
          aria-label="Arquivo do documento"
          onChange={(evento) => {
            const alvo = evento.currentTarget;
            const arquivo = alvo.files?.[0];
            alvo.value = "";
            void aoEscolher(arquivo);
          }}
        />
      ) : null}

      <Dialog
        aberto={removendo !== null}
        titulo="Remover este arquivo da ficha?"
        descricao="Ele deixa de aparecer na lista, mas continua guardado com segurança."
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
              variant="primary"
              onClick={() => {
                const alvo = removendo;
                setRemovendo(null);
                if (alvo) {
                  void executar(
                    alvo,
                    () => removerDocumentoDoColaborador(colaboradorId, alvo.id),
                    `${rotuloDoDocumento(alvo.categoria, alvo.nome)}: removido.`,
                    depoisDeRemover(alvo.categoria),
                  );
                }
              }}
            >
              Remover
            </Button>
          </FormActions>
        }
      >
        <p className="documentos__texto">
          {removendo
            ? `${rotuloDoDocumento(removendo.categoria, removendo.nome)}${
                removendo.nomeArquivo ? ` (${removendo.nomeArquivo})` : ""
              }`
            : null}
        </p>
      </Dialog>
    </section>
  );
}
