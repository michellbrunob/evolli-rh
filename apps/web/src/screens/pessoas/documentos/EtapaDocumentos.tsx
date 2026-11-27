import { useId, useRef, useState } from "react";
import { Button, Input } from "../../../ui";
import {
  IconeEnviarArquivo,
  IconeMais,
  IconeRemover,
  IconeVer,
} from "../../../ui/icones";
import type { CategoriaDocumentoColaborador } from "../../../api/colaboradoresClient";
import {
  ACEITA_NO_CAMPO,
  CATEGORIAS_PRINCIPAIS,
  NOME_DE_OUTROS_MAXIMO,
  ROTULO_DA_CATEGORIA,
  conferirArquivoEscolhido,
  conferirNomeDeOutros,
  rotuloDoDocumento,
  tamanhoLegivel,
} from "./documentosDoColaborador";
import {
  ArquivoDaLinha,
  EstadoDoDocumento,
  LinhaDoDocumento,
  MenuDoArquivo,
  naLinha,
  useFocoDepois,
} from "./PecasDosDocumentos";

/** Abre o arquivo escolhido (ainda só no navegador) numa aba nova. */
function verArquivoLocal(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  window.open(url, "_blank", "noopener");
  // A aba nova já leu o endereço temporário; ele não precisa ficar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * T213 — etapa 4 "Documentos" do Novo colaborador (ADR 0021).
 *
 * Opcional: escolher arquivo aqui só o prepara; nada sobe antes de o cadastro
 * ser concluído, e a falta de arquivo nunca impede a admissão. O arquivo fica
 * só na memória desta aba (nunca no rascunho).
 */

export interface DocumentoDaEtapa {
  /** Id local da linha. */
  readonly id: string;
  readonly categoria: CategoriaDocumentoColaborador;
  /** Só em "outros". */
  readonly nome?: string;
  readonly arquivo: File | null;
  /** Uma por arquivo escolhido: a nova tentativa não duplica. */
  readonly chaveDeEnvio: string | null;
}

export function documentosIniciais(): DocumentoDaEtapa[] {
  return CATEGORIAS_PRINCIPAIS.map((categoria) => ({
    id: categoria,
    categoria,
    arquivo: null,
    chaveDeEnvio: null,
  }));
}

export interface EtapaDocumentosProps {
  readonly documentos: readonly DocumentoDaEtapa[];
  readonly onEscolherArquivo: (id: string, arquivo: File) => void;
  readonly onTirarArquivo: (id: string) => void;
  readonly onAdicionarOutro: (nome: string) => void;
  readonly onRemoverOutro: (id: string) => void;
}

export function EtapaDocumentos({
  documentos,
  onEscolherArquivo,
  onTirarArquivo,
  onAdicionarOutro,
  onRemoverOutro,
}: EtapaDocumentosProps) {
  const prefixo = useId();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [novoNome, setNovoNome] = useState("");
  const [erroDoNome, setErroDoNome] = useState<string | null>(null);
  const campos = useRef(new Map<string, HTMLInputElement>());
  const focar = useFocoDepois();
  /** A linha de um documento (o mesmo id do `LinhaDoDocumento`). */
  const idDaLinha = (id: string) => `${prefixo}-${id}`;
  /** Depois de mexer no arquivo: "Ver" se há arquivo; senão "Enviar arquivo". */
  const focarNaLinha = (id: string) =>
    focar(naLinha(idDaLinha(id), "ver", "enviar"));

  const principais = documentos.filter((d) => d.categoria !== "outros");
  const outros = documentos.filter((d) => d.categoria === "outros");
  const escolhidos = principais.filter((d) => d.arquivo).length;

  function escolher(id: string, arquivo: File | undefined) {
    if (!arquivo) return;
    const erro = conferirArquivoEscolhido(arquivo);
    setErros((atual) => {
      const resto = { ...atual };
      delete resto[id];
      return erro ? { ...resto, [id]: erro } : resto;
    });
    if (!erro) onEscolherArquivo(id, arquivo);
    focarNaLinha(id);
  }

  /** A linha de um Outro saiu: o foco vai ao campo "Novo documento". */
  const focarNoNovo = () =>
    focar(() => document.getElementById(`${prefixo}-novo`));

  function adicionar() {
    const erro = conferirNomeDeOutros(
      novoNome,
      outros.map((o) => o.nome ?? ""),
    );
    setErroDoNome(erro);
    if (erro) return;
    onAdicionarOutro(novoNome.trim());
    setNovoNome("");
  }

  const linha = (documento: DocumentoDaEtapa) => {
    const nome = rotuloDoDocumento(documento.categoria, documento.nome);
    const idCampo = `${prefixo}-${documento.id}-arquivo`;
    return (
      <LinhaDoDocumento
        key={documento.id}
        id={idDaLinha(documento.id)}
        nome={nome}
        estado={
          documento.arquivo ? (
            <ArquivoDaLinha
              nome={documento.arquivo.name}
              tamanho={tamanhoLegivel(documento.arquivo.size)}
            />
          ) : (
            <EstadoDoDocumento estado="pendente" />
          )
        }
        erro={erros[documento.id] ?? null}
        acoes={
          <>
            <input
              ref={(el) => {
                if (el) campos.current.set(documento.id, el);
                else campos.current.delete(documento.id);
              }}
              id={idCampo}
              type="file"
              className="documentos__campo-oculto"
              accept={ACEITA_NO_CAMPO}
              aria-label={`Arquivo de ${nome}`}
              onChange={(evento) => {
                const campo = evento.currentTarget;
                const arquivo = campo.files?.[0];
                campo.value = "";
                escolher(documento.id, arquivo);
              }}
            />
            {documento.arquivo ? (
              <>
                <button
                  type="button"
                  className="documentos__botao-icone"
                  aria-label={`Ver o arquivo de ${nome}`}
                  data-foco="ver"
                  onClick={() => verArquivoLocal(documento.arquivo!)}
                >
                  <IconeVer />
                </button>
                <MenuDoArquivo
                  nome={nome}
                  acoes={[
                    {
                      id: "trocar",
                      rotulo: "Trocar arquivo",
                      aoEscolher: () =>
                        campos.current.get(documento.id)?.click(),
                    },
                    {
                      id: "remover",
                      rotulo: "Remover arquivo",
                      aoEscolher: () => {
                        onTirarArquivo(documento.id);
                        focarNaLinha(documento.id);
                      },
                    },
                    ...(documento.categoria === "outros"
                      ? [
                          {
                            id: "tirar-da-lista",
                            rotulo: "Tirar da lista",
                            aoEscolher: () => {
                              onRemoverOutro(documento.id);
                              focarNoNovo();
                            },
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                aria-label={`Enviar arquivo de ${nome}`}
                data-foco="enviar"
                onClick={() => campos.current.get(documento.id)?.click()}
              >
                <IconeEnviarArquivo />
                Enviar arquivo
              </Button>
            )}
            {documento.categoria === "outros" && !documento.arquivo ? (
              <Button
                type="button"
                variant="subtle"
                aria-label={`Remover ${nome} da lista`}
                onClick={() => {
                  onRemoverOutro(documento.id);
                  focarNoNovo();
                }}
              >
                <IconeRemover />
                Remover
              </Button>
            ) : null}
          </>
        }
      />
    );
  };

  return (
    <div className="documentos">
      <section
        className="documentos__secao"
        aria-labelledby={`${prefixo}-principais`}
      >
        <h3 className="documentos__titulo" id={`${prefixo}-principais`}>
          Documentos obrigatórios
        </h3>
        <p className="documentos__texto" role="status">
          {escolhidos} de {principais.length} enviados.
        </p>
        <ul className="documentos__lista">{principais.map(linha)}</ul>
      </section>

      <section
        className="documentos__secao"
        aria-labelledby={`${prefixo}-outros`}
      >
        <h3 className="documentos__titulo" id={`${prefixo}-outros`}>
          Outros documentos
        </h3>
        <p className="documentos__texto">
          Contratos, laudos, atestados e demais arquivos.
        </p>
        {outros.length > 0 ? (
          <ul className="documentos__lista">{outros.map(linha)}</ul>
        ) : null}
        <div className="documentos__novo">
          <div className="documentos__identificacao">
            <label className="documentos__nome" htmlFor={`${prefixo}-novo`}>
              Novo documento
            </label>
            <span className="documentos__detalhe" id={`${prefixo}-novo-ajuda`}>
              Dê um nome e envie o arquivo.
            </span>
          </div>
          <Input
            id={`${prefixo}-novo`}
            type="text"
            value={novoNome}
            maxLength={NOME_DE_OUTROS_MAXIMO}
            placeholder="Ex.: Atestado médico"
            aria-describedby={`${prefixo}-novo-ajuda${erroDoNome ? ` ${prefixo}-novo-erro` : ""}`}
            aria-invalid={erroDoNome ? true : undefined}
            onChange={(e) => {
              setNovoNome(e.target.value);
              setErroDoNome(null);
            }}
            onKeyDown={(e) => {
              // Enter adiciona, sem enviar o formulário do cadastro.
              if (e.key === "Enter") {
                e.preventDefault();
                adicionar();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={novoNome.trim() === ""}
            onClick={adicionar}
          >
            <IconeMais />
            Adicionar
          </Button>
          {erroDoNome ? (
            <p
              className="documentos__erro"
              id={`${prefixo}-novo-erro`}
              role="alert"
            >
              {erroDoNome}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export { ROTULO_DA_CATEGORIA };
