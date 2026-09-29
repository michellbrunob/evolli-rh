import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { SolicitacoesPessoasAuditoriaService } from "./solicitacoes-pessoas-auditoria.service";
import { SolicitacaoPessoaController } from "./solicitacao-pessoa.controller";
import { SolicitacaoPessoaService } from "./solicitacao-pessoa.service";

/**
 * T139 — Central de Solicitações de Pessoas (fundação backend).
 *
 * Importa `AuthModule` (sessão, CSRF, autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nem contorna
 * nenhum dos dois.
 *
 * **Nenhum controller ou service de anexo, upload, conteúdo, storage ou
 * notificação existe** — anexo segue bloqueado pelos portões documentais, e a
 * ADR 0013 aprovou o provedor privado futuro (Cloudflare R2), nunca o upload.
 * Também não há integração com Ponto, Férias, Cadastro, Benefícios, Banco de
 * Horas, Folha, fechamento ou "Verificar folhas": a Central encaminha, e
 * encaminhar não é executar.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SolicitacaoPessoaController],
  providers: [SolicitacoesPessoasAuditoriaService, SolicitacaoPessoaService],
})
export class SolicitacoesPessoasModule {}
