/**
 * Portal do Colaborador > Meus documentos (T067) — tela visual estática.
 *
 * Demonstra só metadados de documentos do colaborador. Escopo: PURAMENTE
 * visual. Upload, download, anexo, imagem, PDF e armazenamento **não** estão
 * disponíveis nesta demonstração — nenhum arquivo existe ou é referenciado.
 */
import { DataTable, PageHeader, StatusBadge, Surface } from "../../components";
import type { DataTableColumn } from "../../components";
import {
  DOCUMENTOS_PORTAL_EXEMPLO,
  type DocumentoPortalExemplo,
  ROTULO_SITUACAO_DOCUMENTO,
} from "./meusDocumentos.fixtures";
import "./MeusDocumentosScreen.css";

export const MEUS_DOCUMENTOS_TITULO_ID = "portal-documentos-titulo";

export function MeusDocumentosScreen() {
  const colunas: DataTableColumn<DocumentoPortalExemplo>[] = [
    {
      key: "tipo",
      header: "Tipo documental",
      cell: (linha) => linha.tipoDocumental,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge
          variant={linha.situacao === "disponivel" ? "success" : "neutral"}
        >
          {ROTULO_SITUACAO_DOCUMENTO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
  ];

  return (
    <div className="meus-documentos-screen">
      <PageHeader
        headingLevel={1}
        titleId={MEUS_DOCUMENTOS_TITULO_ID}
        title="Meus documentos"
        description="Metadados demonstrativos dos documentos do colaborador — sem arquivo, imagem ou conteúdo real."
      />

      <Surface
        as="section"
        padding="md"
        className="meus-documentos-screen__aviso"
        aria-labelledby="portal-documentos-aviso-titulo"
      >
        <StatusBadge variant="warning">Ainda não disponível</StatusBadge>
        <p
          id="portal-documentos-aviso-titulo"
          className="meus-documentos-screen__aviso-texto"
        >
          Upload, download, anexo, imagem, PDF e armazenamento de documentos
          ainda não estão disponíveis nesta demonstração — só os metadados
          abaixo são ilustrados.
        </p>
      </Surface>

      <section aria-labelledby="portal-documentos-lista-titulo">
        <h2
          id="portal-documentos-lista-titulo"
          className="meus-documentos-screen__section-title"
        >
          Documentos (exemplo)
        </h2>
        <DataTable
          caption="Meus documentos"
          columns={colunas}
          rows={DOCUMENTOS_PORTAL_EXEMPLO}
          rowKey={(linha) => linha.id}
        />
      </section>
    </div>
  );
}
