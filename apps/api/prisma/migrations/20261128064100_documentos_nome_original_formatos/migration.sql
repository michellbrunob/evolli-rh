-- T217 — Documentos da ficha: nome original do arquivo e formatos DOC, DOCX
-- e WebP (decisão da proprietária de 2026-11-28).
--
-- Aditiva: o nome original é só metadado de exibição, saneado pela API (até
-- 255 caracteres, sem caminho nem caracteres invisíveis); nulo nas versões
-- anteriores. Os formatos novos passam pela mesma conferência de extensão,
-- tipo e conteúdo e pelo antivírus; DOC e DOCX com macro são recusados.
ALTER TYPE "FormatoDocumentoColaborador" ADD VALUE 'doc';
ALTER TYPE "FormatoDocumentoColaborador" ADD VALUE 'docx';
ALTER TYPE "FormatoDocumentoColaborador" ADD VALUE 'webp';

ALTER TABLE "versao_documento_colaborador" ADD COLUMN "nome_original" VARCHAR(255);
