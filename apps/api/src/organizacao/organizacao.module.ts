import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { OrganizacaoAuditoriaService } from "./organizacao-auditoria.service";
import { EmpresaController } from "./empresa/empresa.controller";
import { EmpresaService } from "./empresa/empresa.service";
import { UnidadeOrganizacionalController } from "./unidade-organizacional/unidade-organizacional.controller";
import { UnidadeOrganizacionalService } from "./unidade-organizacional/unidade-organizacional.service";
import { DepartamentoController } from "./departamento/departamento.controller";
import { DepartamentoService } from "./departamento/departamento.service";
import { AreaController } from "./area/area.controller";
import { AreaService } from "./area/area.service";
import { EquipeController } from "./equipe/equipe.controller";
import { EquipeService } from "./equipe/equipe.service";
import { CargoController } from "./cargo/cargo.controller";
import { CargoService } from "./cargo/cargo.service";
import { CentroCustoController } from "./centro-custo/centro-custo.controller";
import { CentroCustoService } from "./centro-custo/centro-custo.service";

/**
 * Etapa 1 — Fatia 1: Núcleo Organizacional Interno (ADR 0006, Baseline V1).
 *
 * Importa `AuthModule` (guards de sessão, CSRF e autorização) e `AuditModule`
 * (`AuditService`, ponto único de escrita da trilha). Não redefine nem
 * contorna nenhum dos dois: a autorização continua sendo avaliada pelo mesmo
 * `evaluatePermission`, e a auditoria escrita pelo mesmo `AuditService`.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    EmpresaController,
    UnidadeOrganizacionalController,
    DepartamentoController,
    AreaController,
    EquipeController,
    CargoController,
    CentroCustoController,
  ],
  providers: [
    OrganizacaoAuditoriaService,
    EmpresaService,
    UnidadeOrganizacionalService,
    DepartamentoService,
    AreaService,
    EquipeService,
    CargoService,
    CentroCustoService,
  ],
})
export class OrganizacaoModule {}
