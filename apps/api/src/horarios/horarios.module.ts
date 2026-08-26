import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { HorariosAuditoriaService } from "./horarios-auditoria.service";
import { TabelaHorarioController } from "./tabela/tabela-horario.controller";
import { TabelaHorarioService } from "./tabela/tabela-horario.service";
import { VinculoHorarioController } from "./vinculo/vinculo-horario.controller";
import { VinculoHorarioService } from "./vinculo/vinculo-horario.service";

/**
 * T038 — Cadastros: Tabelas de Horario e vinculo historico ao colaborador.
 *
 * Importa `AuthModule` (sessão, CSRF, autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nenhum.
 *
 * `VinculoHorarioController` (base `horarios/vinculos`) é registrado ANTES de
 * `TabelaHorarioController` (base `horarios`, com `:tabelaId`) para que a rota
 * estática `horarios/vinculos` case antes do parâmetro `horarios/:tabelaId`.
 *
 * **O que este módulo NÃO tem, por decisão registrada (T034/T037):** nenhum
 * cálculo de jornada/tolerância/banco/DSR, importação TXT/REP/AFD, fechamento,
 * espelho, assinatura ou UI. A ausência é o cumprimento do escopo, não lacuna.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [VinculoHorarioController, TabelaHorarioController],
  providers: [
    HorariosAuditoriaService,
    TabelaHorarioService,
    VinculoHorarioService,
  ],
})
export class HorariosModule {}
