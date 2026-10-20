import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { CepController } from "./cep.controller";
import { CepService } from "./cep.service";
import { FORNECEDOR_CEP } from "./cep.types";
import { ViaCepAdapter } from "./viacep.adapter";

/**
 * T178 — preenchimento assistido de endereço por CEP (ViaCEP, autorizado pela
 * proprietária em 2026-10-20). O fornecedor entra por `FORNECEDOR_CEP`; os
 * testes o trocam por um falso, e nenhum teste sai para a rede.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CepController],
  providers: [
    CepService,
    { provide: FORNECEDOR_CEP, useFactory: () => new ViaCepAdapter() },
  ],
})
export class CepModule {}
