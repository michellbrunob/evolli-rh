import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { DocumentosAuditoriaService } from "./documentos-auditoria.service";
import { TipoDocumentoController } from "./tipo-documento/tipo-documento.controller";
import { TipoDocumentoService } from "./tipo-documento/tipo-documento.service";
import { DocumentoMetadadoController } from "./documento-metadado/documento-metadado.controller";
import { DocumentoMetadadoService } from "./documento-metadado/documento-metadado.service";
import { SolicitacaoDocumentoController } from "./solicitacao/solicitacao-documento.controller";
import { SolicitacaoDocumentoService } from "./solicitacao/solicitacao-documento.service";

/**
 * Etapa 2 — Documentos e Admissão Digital: V1 de METADADOS (ADR 0011, T008).
 *
 * Importa `AuthModule` (sessão, CSRF, autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nem contorna
 * nenhum dos dois. **Nenhum controller ou service de upload, conteúdo, versão
 * de arquivo ou storage existe** — upload é Nível 2, bloqueado por construção
 * (§13 da spec; ADR 0011, decisões 1 e 2).
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    TipoDocumentoController,
    DocumentoMetadadoController,
    SolicitacaoDocumentoController,
  ],
  providers: [
    DocumentosAuditoriaService,
    TipoDocumentoService,
    DocumentoMetadadoService,
    SolicitacaoDocumentoService,
  ],
})
export class DocumentosModule {}
