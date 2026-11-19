import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormActions } from "../../../components";
import { formatarDiaCivil } from "../../../format/data";
import { Button, Dialog, Input } from "../../../ui";
import { IconeEnviarArquivo, IconeMais, IconeVer } from "../../../ui/icones";
import {
  baixarDocumentoDoColaborador,
  enviarDocumentoDoColaborador,
  listarDocumentosDoColaborador,
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
  rotuloDoDocumento,
  tamanhoLegivel,
} from "./documentosDoColaborador";
import { motivoDaFalhaDoEnvio } from "./EnvioDosDocumentos";
import {
  ArquivoDaLinha,
  EstadoDoDocumento,
  LinhaDoDocumento,
  MenuDoArquivo,
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
    const erro = conferirArquivoEscolhido(arquivo);
    marcarErro(chave, erro);
    if (erro) return;
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
    } catch (falha: unknown) {
      marcarErro(chave, motivoDaFalhaDoEnvio(falha));
    } finally {
      setOcupado(null);
    }
  }

  async function executar(
    documento: DocumentoColaboradorApi,
    acao: () => Promise<unknown>,
    sucesso?: string,
  ) {
    setOcupado(documento.id);
    marcarErro(documento.id, null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      await carregar();
    } catch {
      marcarErro(
        documento.id,
        "Não foi possível concluir agora. Tente de novo.",
      );
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
    const acoes: AcaoDoMenu[] = podeOperar
      ? [
          ...(aprovado
            ? [
                {
                  id: "baixar",
                  rotulo: "Baixar",
                  aoEscolher: () =>
                    void executar(documento, () =>
                      baixarDocumentoDoColaborador(colaboradorId, documento.id),
                    ),
                },
              ]
            : []),
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
        id={`${prefixo}-${documento.id}`}
        nome={nome}
        estado={
          <ArquivoDaLinha
            nome={`${documento.formato.toUpperCase()} · ${dataCurta(documento.enviadoEm)}`}
            tamanho={tamanhoLegivel(documento.tamanhoBytes)}
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
              {aprovado ? (
                <button
                  type="button"
                  className="documentos__botao-icone"
                  aria-label={`Ver o arquivo de ${nome}`}
                  onClick={() =>
                    void executar(documento, () =>
                      verDocumentoDoColaborador(colaboradorId, documento.id),
                    )
                  }
                >
                  <IconeVer />
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
        id={`${prefixo}-pendente-${categoria}`}
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
          Arquivos do colaborador
        </h3>
        <p className="documentos__texto">
          Só arquivos aprovados pelo antivírus podem ser vistos ou baixados.
        </p>
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
            <h4 className="documentos__titulo">Outros documentos</h4>
            {outros.length > 0 ? (
              <ul className="documentos__lista" aria-label="Outros documentos">
                {outros.map(linhaDoDocumento)}
              </ul>
            ) : (
              <p className="documentos__texto">Nenhum outro documento.</p>
            )}
            {podeOperar ? (
              <div className="documentos__novo">
                <div className="documentos__identificacao">
                  <label
                    className="documentos__nome"
                    htmlFor={`${prefixo}-novo`}
                  >
                    Novo documento
                  </label>
                  <span
                    className="documentos__detalhe"
                    id={`${prefixo}-novo-ajuda`}
                  >
                    Dê um nome e escolha o arquivo.
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
        titulo="Remover documento?"
        descricao="Ele sai da lista e não pode mais ser visto nem baixado por aqui."
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
            ? rotuloDoDocumento(removendo.categoria, removendo.nome)
            : null}
        </p>
      </Dialog>
    </section>
  );
}
