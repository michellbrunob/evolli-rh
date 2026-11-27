import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { PessoasAuditoriaService } from "../pessoas/pessoas-auditoria.service";
import {
  PesquisaPublicaController,
  PesquisasController,
  PesquisasDoColaboradorController,
} from "./pesquisas.controller";
import { PesquisasService } from "./pesquisas.service";
import { PesquisaPublicaService } from "./pesquisa-publica.service";

/**
 * T216 — Pesquisas (módulo do menu, aba da ficha e a página pública).
 * Mesmos guards de sessão, CSRF e autorização dos demais módulos; a
 * página pública fica num controller próprio, sem sessão.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    PesquisasController,
    PesquisasDoColaboradorController,
    PesquisaPublicaController,
  ],
  providers: [
    PesquisasService,
    PesquisaPublicaService,
    PessoasAuditoriaService,
  ],
})
export class PesquisasModule {}
