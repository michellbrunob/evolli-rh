import { Button } from "../../../ui";
import { IconeTentarDeNovo } from "../../../ui/icones";
import {
  enviarDocumentoDoColaborador,
  type EstadoDocumentoColaborador,
} from "../../../api/colaboradoresClient";
import { rotuloDoDocumento } from "./documentosDoColaborador";
import type { DocumentoDaEtapa } from "./EtapaDocumentos";
import { EstadoDoDocumento, LinhaDoDocumento } from "./PecasDosDocumentos";

/**
 * T213 — envio dos documentos escolhidos na etapa 4, DEPOIS de o colaborador
 * ser criado. Um por vez; a falha de um nunca desfaz a admissão nem impede os
 * outros: fica "Não enviado". Só a falha TRANSITÓRIA (rede, servidor ou
 * armazenamento indisponível) oferece "Tentar de novo" — com a mesma chave, a
 * nova tentativa não duplica. Recusa definitiva (formato, tamanho, conteúdo,
 * limite, nome, acesso) diz o que fazer, sem nova tentativa inútil.
 */

export type EnvioDeDocumento =
  | { readonly estado: "enviando" }
  | { readonly estado: EstadoDocumentoColaborador }
  | {
      readonly estado: "nao_enviado";
      readonly motivo: string;
      readonly transitoria: boolean;
    };

export interface FalhaDoEnvio {
  readonly motivo: string;
  /** `true` só quando tentar de novo pode dar certo. */
  readonly transitoria: boolean;
}

const NA_FICHA = "Escolha outro arquivo na ficha do colaborador.";

/** Recusas definitivas, pelo código do servidor. */
const RECUSAS: Readonly<Record<string, string>> = {
  documento_formato_invalido: `O arquivo não é um PDF, JPG ou PNG válido. ${NA_FICHA}`,
  documento_arquivo_malformado: `O arquivo está corrompido ou incompleto. ${NA_FICHA}`,
  documento_arquivo_vazio: `O arquivo está vazio. ${NA_FICHA}`,
  documento_arquivo_grande_demais: `O arquivo passa de 10 MB. ${NA_FICHA}`,
  documento_limite_categoria:
    "Este documento já tem 5 arquivos. Remova um na ficha antes de enviar outro.",
  documento_limite_colaborador:
    "Este cadastro já tem 30 documentos. Remova um na ficha antes de enviar outro.",
  documento_categoria_invalida:
    "Tipo de documento não aceito. Envie pela ficha do colaborador.",
  documento_nome_obrigatorio:
    "Dê um nome ao documento e envie pela ficha do colaborador.",
  documento_nome_invalido:
    "Nome do documento não aceito (até 60 caracteres). Envie pela ficha com outro nome.",
  documento_nome_nao_permitido:
    "Nome não aceito para este tipo de documento. Envie pela ficha do colaborador.",
  idempotencia_conteudo_divergente:
    "Este envio já foi registrado com outro arquivo. Confira na ficha do colaborador.",
};

const TRANSITORIA: FalhaDoEnvio = {
  motivo:
    "Sem confirmação do servidor. Tentar de novo é seguro: o arquivo não é duplicado.",
  transitoria: true,
};

/**
 * Por que o envio não aconteceu, em texto (nunca o conteúdo), e se tentar
 * de novo faz sentido. Lê `status` e `codigo` do erro da API.
 */
export function falhaDoEnvio(erro: unknown): FalhaDoEnvio {
  const { status, codigo } =
    typeof erro === "object" && erro !== null
      ? (erro as { status?: unknown; codigo?: unknown })
      : {};
  if (typeof codigo === "string" && RECUSAS[codigo]) {
    return { motivo: RECUSAS[codigo]!, transitoria: false };
  }
  if (typeof status !== "number") return TRANSITORIA;
  if (status === 413) {
    return {
      motivo: RECUSAS.documento_arquivo_grande_demais!,
      transitoria: false,
    };
  }
  if (status === 415) {
    return { motivo: RECUSAS.documento_formato_invalido!, transitoria: false };
  }
  if (status === 401) {
    return {
      motivo:
        "Sua sessão expirou. Entre de novo e envie pela ficha do colaborador.",
      transitoria: false,
    };
  }
  if (status === 403 || status === 404) {
    return {
      motivo: "Seu acesso não permite enviar documentos para este colaborador.",
      transitoria: false,
    };
  }
  if (status === 408 || status === 429 || status >= 500) return TRANSITORIA;
  return {
    motivo: `O servidor não aceitou o arquivo. ${NA_FICHA}`,
    transitoria: false,
  };
}

/** Compatível com quem só quer o texto (ficha). */
export function motivoDaFalhaDoEnvio(erro: unknown): string {
  return falhaDoEnvio(erro).motivo;
}

/** O que dizer de um envio que chegou, mas não está disponível. */
export const DETALHE_DO_ESTADO: Readonly<Record<string, string>> = {
  em_verificacao: "Aguardando o antivírus. Acompanhe o resultado na ficha.",
  reprovado:
    "O antivírus recusou este arquivo. Ele fica bloqueado e não pode ser baixado.",
};

export async function enviarDocumentoDaEtapa(
  colaboradorId: string,
  documento: DocumentoDaEtapa,
): Promise<EnvioDeDocumento> {
  if (!documento.arquivo || !documento.chaveDeEnvio) {
    return {
      estado: "nao_enviado",
      motivo: "Nenhum arquivo escolhido.",
      transitoria: false,
    };
  }
  try {
    const gravado = await enviarDocumentoDoColaborador(colaboradorId, {
      categoria: documento.categoria,
      ...(documento.nome ? { nome: documento.nome } : {}),
      arquivo: documento.arquivo,
      chaveIdempotencia: documento.chaveDeEnvio,
    });
    return { estado: gravado.estado };
  } catch (erro: unknown) {
    return { estado: "nao_enviado", ...falhaDoEnvio(erro) };
  }
}

/** Há documento escolhido ainda subindo (ou na fila para subir)? */
export function algumEnviando(
  documentos: readonly DocumentoDaEtapa[],
  envios: Readonly<Record<string, EnvioDeDocumento>>,
): boolean {
  return documentos.some(
    (d) =>
      d.arquivo &&
      (envios[d.id] ?? { estado: "enviando" }).estado === "enviando",
  );
}

export interface EnvioDosDocumentosProps {
  readonly documentos: readonly DocumentoDaEtapa[];
  readonly envios: Readonly<Record<string, EnvioDeDocumento>>;
  readonly onTentarDeNovo: (id: string) => void;
}

/** O estado de cada anexo, na confirmação da admissão. */
export function EnvioDosDocumentos({
  documentos,
  envios,
  onTentarDeNovo,
}: EnvioDosDocumentosProps) {
  const comArquivo = documentos.filter((d) => d.arquivo);
  if (comArquivo.length === 0) return null;
  const enviando = algumEnviando(comArquivo, envios);
  return (
    <section
      className="documentos__secao nova-admissao__bloco-gravado"
      aria-labelledby="nova-admissao-documentos-envio"
    >
      <h3
        id="nova-admissao-documentos-envio"
        className="nova-admissao__subtitulo"
      >
        Documentos
      </h3>
      <p className="documentos__texto">
        Arquivos aprovados pelo antivírus ficam disponíveis na ficha. Um arquivo
        não enviado não desfaz o cadastro.
      </p>
      {enviando ? (
        <p
          className="documentos__texto"
          role="status"
          id="nova-admissao-documentos-aguarde"
        >
          Enviando os documentos. Aguarde terminar antes de registrar outra
          admissão.
        </p>
      ) : null}
      <ul className="documentos__lista">
        {comArquivo.map((documento) => {
          const envio = envios[documento.id] ?? { estado: "enviando" };
          const nome = rotuloDoDocumento(documento.categoria, documento.nome);
          return (
            <LinhaDoDocumento
              key={documento.id}
              id={`nova-admissao-documento-${documento.id}`}
              nome={nome}
              detalhe={
                "motivo" in envio
                  ? envio.motivo
                  : DETALHE_DO_ESTADO[envio.estado]
              }
              estado={
                envio.estado === "enviando" ? (
                  <EstadoDoDocumento estado="pendente" rotulo="Enviando…" />
                ) : (
                  <EstadoDoDocumento estado={envio.estado} />
                )
              }
              acoes={
                envio.estado === "nao_enviado" && envio.transitoria ? (
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Tentar de novo o envio de ${nome}`}
                    onClick={() => onTentarDeNovo(documento.id)}
                  >
                    <IconeTentarDeNovo />
                    Tentar de novo
                  </Button>
                ) : null
              }
            />
          );
        })}
      </ul>
    </section>
  );
}
