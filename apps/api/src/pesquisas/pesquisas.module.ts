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
import {
  AvaliacoesDoColaboradorController,
  ModelosDePesquisasController,
  ModelosPublicosController,
} from "./modelos/modelos.controller";
import { AvaliacaoService } from "./modelos/avaliacao/avaliacao.service";
import { OnboardingService } from "./modelos/onboarding/onboarding.service";
import { ProcessadorDePesquisas } from "./modelos/processador-de-pesquisas";
import { AgendadorDePesquisas } from "./modelos/agendador-de-pesquisas";
import {
  NOTIFICADOR_DE_PESQUISAS,
  NotificadorSemEmail,
} from "./modelos/notificador-de-pesquisas";
import { AcompanhamentoController } from "./modelos/acompanhamento.controller";
import { AcompanhamentoService } from "./modelos/acompanhamento.service";
import {
  ARMAZENAMENTO_DE_DOCUMENTOS,
  escolherArmazenamentoDeDocumentos,
} from "../pessoas/documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  escolherVerificadorDeArquivos,
} from "../pessoas/documentos-colaborador/verificador-de-arquivos";

/**
 * T216 — Pesquisas (módulo do menu, aba da ficha e a página pública).
 * Mesmos guards de sessão, CSRF e autorização dos demais módulos; a
 * página pública fica num controller próprio, sem sessão.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    // T216 — rotas fixas da avaliação e do onboarding antes de ":pesquisaId".
    ModelosDePesquisasController,
    AvaliacoesDoColaboradorController,
    ModelosPublicosController,
    PesquisasController,
    PesquisasDoColaboradorController,
    PesquisaPublicaController,
    AcompanhamentoController,
  ],
  providers: [
    PesquisasService,
    PesquisaPublicaService,
    AcompanhamentoService,
    PessoasAuditoriaService,
    AvaliacaoService,
    OnboardingService,
    ProcessadorDePesquisas,
    AgendadorDePesquisas,
    { provide: NOTIFICADOR_DE_PESQUISAS, useClass: NotificadorSemEmail },
    // T216 — evidências da NR-1: o mesmo armazenamento privado (R2) e o
    // mesmo antivírus dos documentos do colaborador (ADR 0021).
    {
      provide: ARMAZENAMENTO_DE_DOCUMENTOS,
      useFactory: () => escolherArmazenamentoDeDocumentos(),
    },
    {
      provide: VERIFICADOR_DE_ARQUIVOS,
      useFactory: () => escolherVerificadorDeArquivos(),
    },
  ],
})
export class PesquisasModule {}
