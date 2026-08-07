import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { PessoasAuditoriaService } from "./pessoas-auditoria.service";
import { ColaboradorController } from "./colaborador/colaborador.controller";
import { ColaboradorService } from "./colaborador/colaborador.service";
import { VinculoController } from "./vinculo/vinculo.controller";
import { VinculoService } from "./vinculo/vinculo.service";
import { MovimentacaoController } from "./movimentacao/movimentacao.controller";
import { MovimentacaoService } from "./movimentacao/movimentacao.service";

/**
 * Etapa 1 — Fatia 2: Colaboradores e Vida Funcional (ADR 0007, Baseline V1).
 *
 * Importa `AuthModule` (sessão, CSRF, autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nem
 * contorna nenhum dos dois: a autorização continua sendo avaliada pelo mesmo
 * `evaluatePermission`, e a auditoria escrita pelo mesmo `AuditService`.
 *
 * Não há controller nem service de dado restrito ou de aprovação — as duas
 * capacidades ficaram fora desta fatia (Baseline V1, itens 5 e 7).
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    ColaboradorController,
    VinculoController,
    MovimentacaoController,
  ],
  providers: [
    PessoasAuditoriaService,
    ColaboradorService,
    VinculoService,
    MovimentacaoService,
  ],
})
export class PessoasModule {}
