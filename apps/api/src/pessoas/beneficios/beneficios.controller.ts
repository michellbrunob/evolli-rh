import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessUser } from "@prisma/client";
import { Request } from "express";
import { SessionGuard } from "../../auth/session/session.guard";
import { CsrfGuard } from "../../auth/csrf/csrf.guard";
import { AuthorizationGuard } from "../../auth/authorization/authorization.guard";
import { RequirePermission } from "../../auth/authorization/require-permission.decorator";
import { CurrentUser } from "../../auth/session/current-user.decorator";
import { extractRequestMetadata } from "../../auth/request-metadata.util";
import {
  AdicionarPessoasDto,
  AlterarEmLoteDto,
  ConferirImportacaoDto,
  BeneficioDto,
  CompetenciaQueryDto,
  DependenteDto,
  DependentesNoPlanoDto,
  PreviaBeneficioDto,
  SalvarValoresDto,
  SuspenderDto,
} from "./beneficios.dto";
import { BeneficiosService } from "./beneficios.service";
import { DependentesService } from "./dependentes.service";

const ctx = (actor: AccessUser, req: Request) => ({
  actor,
  metadata: extractRequestMetadata(req),
});

/**
 * T215 — Benefícios da empresa ativa (como a referência). `rh` e `dp`
 * operam; o `master_tecnico` só lê. Escritas com CSRF; respostas
 * `no-store`. Nada se apaga.
 */
@ApiTags("pessoas")
@Controller("beneficios")
@UseGuards(SessionGuard)
export class BeneficiosController {
  constructor(private readonly service: BeneficiosService) {}

  @Get()
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Benefícios da empresa na competência" })
  listar(
    @Query() q: CompetenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listar(q.competencia, ctx(actor, req));
  }

  @Post("previa")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Prévia do cálculo (assistente)" })
  previa(
    @Body() dto: PreviaBeneficioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.previa(dto, ctx(actor, req));
  }

  @Post()
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cadastra um benefício (com quem recebe)" })
  criar(
    @Body() dto: BeneficioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.criar(dto, ctx(actor, req));
  }

  @Get(":beneficioId")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "O benefício e o valor de cada pessoa na competência",
  })
  obter(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Query() q: CompetenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.obter(id, q.competencia, ctx(actor, req));
  }

  @Put(":beneficioId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Altera a configuração do benefício" })
  alterar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: BeneficioDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterar(id, dto, ctx(actor, req));
  }

  @Get(":beneficioId/historico")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Histórico de alterações do benefício" })
  historico(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.listarHistorico(id, ctx(actor, req));
  }

  @Get(":beneficioId/candidatos")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Quem ainda não recebe, com o valor previsto" })
  candidatos(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Query() q: CompetenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.candidatos(
      id,
      q.competencia,
      q.incluirDesligados === true,
      ctx(actor, req),
    );
  }

  @Post(":beneficioId/pessoas")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Adiciona pessoas ao benefício" })
  adicionar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: AdicionarPessoasDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.adicionarPessoas(id, dto, ctx(actor, req));
  }

  @Post(":beneficioId/pessoas/:colaboradorId/remover")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove a pessoa do benefício" })
  remover(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.removerPessoa(id, colaboradorId, ctx(actor, req));
  }

  @Get(":beneficioId/pessoas/:colaboradorId/dependentes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Dependentes da pessoa e quem está no plano" })
  dependentesDaPessoa(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Query() q: CompetenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.dependentesDaPessoa(
      id,
      colaboradorId,
      q.competencia,
      ctx(actor, req),
    );
  }

  @Put(":beneficioId/pessoas/:colaboradorId/dependentes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Dependentes no plano a partir de uma competência" })
  dependentesNoPlano(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: DependentesNoPlanoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.dependentesNoPlano(
      id,
      colaboradorId,
      dto,
      ctx(actor, req),
    );
  }

  @Post(":beneficioId/pessoas/:colaboradorId/dependentes/simular")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Impacto de dependentes no plano, sem gravar" })
  simularDependentes(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: DependentesNoPlanoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.simularDependentes(
      id,
      colaboradorId,
      dto,
      ctx(actor, req),
    );
  }

  @Post(":beneficioId/importacao/conferir")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Confere a planilha de valores, sem gravar" })
  conferirImportacao(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: ConferirImportacaoDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.conferirImportacao(
      id,
      {
        competencia: dto.competencia,
        linhas: dto.linhas.map((l) => ({
          linha: l.linha,
          cpf: l.cpf,
          valores: Object.fromEntries(
            Object.entries(l.valores ?? {})
              .filter(([, v]) => v === null || typeof v === "string")
              .map(([k, v]) => [k, v === null ? null : String(v).slice(0, 40)]),
          ),
        })),
      },
      ctx(actor, req),
    );
  }

  @Put(":beneficioId/valores")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Salva os valores digitados no mês" })
  valores(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: SalvarValoresDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.salvarValores(id, dto, ctx(actor, req));
  }

  @Post(":beneficioId/valores/lote")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Altera valor por dia ou dias de várias pessoas" })
  lote(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: AlterarEmLoteDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.alterarEmLote(id, dto, ctx(actor, req));
  }

  @Post(":beneficioId/pausar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Pausa o benefício a partir de uma competência" })
  pausar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: SuspenderDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.suspender(
      id,
      "pausado",
      dto.aPartirDe,
      ctx(actor, req),
    );
  }

  @Post(":beneficioId/encerrar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Encerra o benefício a partir de uma competência" })
  encerrar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @Body() dto: SuspenderDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.suspender(
      id,
      "encerrado",
      dto.aPartirDe,
      ctx(actor, req),
    );
  }

  @Post(":beneficioId/reativar")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Reativa o benefício pausado ou encerrado" })
  reativar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.reativar(id, ctx(actor, req));
  }

  @Post(":beneficioId/excluir")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Exclui o benefício (lógico)" })
  excluir(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.excluir(id, ctx(actor, req));
  }

  @Post(":beneficioId/duplicar")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("beneficio", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Duplica as regras, sem pessoas" })
  duplicar(
    @Param("beneficioId", ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.service.duplicar(id, ctx(actor, req));
  }
}

/**
 * T215 — a aba Benefícios da ficha e os dependentes do colaborador (Editar
 * colaborador › Dependentes).
 */
@ApiTags("pessoas")
@Controller("colaboradores/:colaboradorId")
@UseGuards(SessionGuard)
export class BeneficiosDoColaboradorController {
  constructor(
    private readonly beneficios: BeneficiosService,
    private readonly dependentes: DependentesService,
  ) {}

  @Get("beneficios")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("beneficio", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Benefícios do colaborador na competência (ficha)" })
  daFicha(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Query() q: CompetenciaQueryDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.beneficios.daFicha(
      colaboradorId,
      q.competencia,
      ctx(actor, req),
    );
  }

  @Get("dependentes")
  @UseGuards(AuthorizationGuard)
  @RequirePermission("dependente", "read")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Dependentes do colaborador" })
  listar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.dependentes.listar(colaboradorId, ctx(actor, req));
  }

  @Post("dependentes")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("dependente", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Cadastra um dependente" })
  criar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Body() dto: DependenteDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.dependentes.criar(colaboradorId, dto, ctx(actor, req));
  }

  @Put("dependentes/:dependenteId")
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("dependente", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Altera um dependente" })
  alterar(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("dependenteId", ParseUUIDPipe) dependenteId: string,
    @Body() dto: DependenteDto,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.dependentes.alterar(
      colaboradorId,
      dependenteId,
      dto,
      ctx(actor, req),
    );
  }

  @Post("dependentes/:dependenteId/remover")
  @HttpCode(200)
  @UseGuards(CsrfGuard, AuthorizationGuard)
  @RequirePermission("dependente", "alter")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Remove o dependente (lógico)" })
  remover(
    @Param("colaboradorId", ParseUUIDPipe) colaboradorId: string,
    @Param("dependenteId", ParseUUIDPipe) dependenteId: string,
    @CurrentUser() actor: AccessUser,
    @Req() req: Request,
  ) {
    return this.dependentes.remover(
      colaboradorId,
      dependenteId,
      ctx(actor, req),
    );
  }
}
