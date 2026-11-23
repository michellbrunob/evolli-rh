import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { PessoasAuditoriaService } from "./pessoas-auditoria.service";
import { ColaboradorController } from "./colaborador/colaborador.controller";
import { ColaboradorService } from "./colaborador/colaborador.service";
import { ContratoColaboradorController } from "./colaborador/contrato-colaborador.controller";
import { ContratoColaboradorService } from "./colaborador/contrato-colaborador.service";
import { DesativacaoColaboradorController } from "./colaborador/desativacao-colaborador.controller";
import { DesativacaoColaboradorService } from "./colaborador/desativacao-colaborador.service";
import { VinculoController } from "./vinculo/vinculo.controller";
import { VinculoService } from "./vinculo/vinculo.service";
import { MovimentacaoController } from "./movimentacao/movimentacao.controller";
import { MovimentacaoService } from "./movimentacao/movimentacao.service";
import { ContatoColaboradorController } from "./contatos/contato-colaborador.controller";
import { ContatoColaboradorService } from "./contatos/contato-colaborador.service";
import { DadosPessoaisColaboradorController } from "./dados-pessoais/dados-pessoais.controller";
import { DadosPessoaisColaboradorService } from "./dados-pessoais/dados-pessoais.service";

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
import { RascunhoAdmissaoController } from "./rascunho-admissao/rascunho-admissao.controller";
import { RascunhoAdmissaoService } from "./rascunho-admissao/rascunho-admissao.service";

import { FotoColaboradorController } from "./foto-colaborador/foto-colaborador.controller";
import { FotoColaboradorService } from "./foto-colaborador/foto-colaborador.service";
import { ARMAZENAMENTO_DE_FOTOS } from "./foto-colaborador/armazenamento-de-objetos";
import { escolherArmazenamentoDeFotos } from "./foto-colaborador/escolher-armazenamento";
import { DocumentoColaboradorController } from "./documentos-colaborador/documento-colaborador.controller";
import { DocumentoColaboradorService } from "./documentos-colaborador/documento-colaborador.service";
import {
  ARMAZENAMENTO_DE_DOCUMENTOS,
  escolherArmazenamentoDeDocumentos,
} from "./documentos-colaborador/armazenamento-de-documentos";
import {
  VERIFICADOR_DE_ARQUIVOS,
  escolherVerificadorDeArquivos,
} from "./documentos-colaborador/verificador-de-arquivos";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    ColaboradorController,
    VinculoController,
    MovimentacaoController,
    // T169 — contatos do colaborador, agregado e rotas próprios.
    ContatoColaboradorController,
    // T177 — dados pessoais e endereço, agregados e rotas próprios.
    DadosPessoaisColaboradorController,
    // T209 — rascunho da Nova admissão.
    RascunhoAdmissaoController,
    // T209 — foto do colaborador (ADR 0020).
    FotoColaboradorController,
    // T213 — documentos do colaborador (ADR 0021).
    DocumentoColaboradorController,
    // T215 — contrato do vínculo na edição do colaborador.
    ContratoColaboradorController,
    DesativacaoColaboradorController,
  ],
  providers: [
    PessoasAuditoriaService,
    ColaboradorService,
    VinculoService,
    MovimentacaoService,
    ContatoColaboradorService,
    DadosPessoaisColaboradorService,
    RascunhoAdmissaoService,
    FotoColaboradorService,
    DocumentoColaboradorService,
    ContratoColaboradorService,
    DesativacaoColaboradorService,
    // Produção: Cloudflare R2 privado. Testes trocam por ArmazenamentoEmMemoria.
    {
      provide: ARMAZENAMENTO_DE_FOTOS,
      useFactory: () => escolherArmazenamentoDeFotos(),
    },
    // T213 — R2 privado dos documentos e o antivírus (ClamAV). Sem ClamAV
    // configurado, nada é aprovado (fail-closed).
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
export class PessoasModule {}
