import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { PontoAuditoriaService } from "./ponto-auditoria.service";
import { EventoPontoController } from "./evento/evento-ponto.controller";
import { VinculoPontoController } from "./evento/vinculo-ponto.controller";
import { EventoPontoService } from "./evento/evento-ponto.service";

/**
 * Etapa 3 — Jornada e Ponto Rastreável V1 (ADR 0008, Baseline Jornada V1).
 *
 * Importa `AuthModule` (sessão, CSRF, autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nem
 * contorna nenhum dos dois.
 *
 * **Controllers e services que não existem aqui, por decisão registrada:**
 * nenhum de escala/jornada (decisão 1), importação TXT (decisão 3), cálculo
 * (decisão 6), aprovação ou fechamento (decisão 7). A ausência é o
 * cumprimento da Baseline, não uma lacuna a preencher depois.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [EventoPontoController, VinculoPontoController],
  providers: [PontoAuditoriaService, EventoPontoService],
})
export class PontoModule {}
