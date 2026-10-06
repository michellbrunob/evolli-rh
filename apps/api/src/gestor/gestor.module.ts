import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import {
  GestorAdminController,
  GestorConsultaController,
} from "./gestor.controller";
import { GestorAdminService } from "./gestor-admin.service";
import { GestorConsultaService } from "./gestor-consulta.service";

/**
 * T151 — Fundacao segura do Gestor consultivo (ADR 0015).
 *
 * Dois controllers com atores opostos de proposito: a ADMINISTRACAO pertence
 * ao RH e a CONSULTA ao gestor. Quem define o escopo nunca e quem e escopado
 * por ele, e separar as superficies torna isso visivel na propria estrutura
 * do modulo — nao so na matriz de permissao.
 *
 * Importa `AuthModule` (sessao, CSRF, autorizacao) e `AuditModule` (ponto
 * unico de escrita da trilha). Nao redefine nem contorna nenhum dos dois.
 *
 * Sem controller de resumo de jornada e de andamento de solicitacoes: os dois
 * itens da decisao 7 ficaram fora da T151 por ausencia de contrato seguro —
 * o primeiro nao existe como dado nem como rota, e o segundo revela condicao
 * de saude por inferencia (`tipo`/`motivo`). Ambos para a T152/T153.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [GestorAdminController, GestorConsultaController],
  providers: [GestorAdminService, GestorConsultaService],
  exports: [GestorConsultaService],
})
export class GestorModule {}
