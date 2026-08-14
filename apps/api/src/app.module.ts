import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "./common/logger/logger.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AuditModule } from "./audit/audit.module";
import { OrganizacaoModule } from "./organizacao/organizacao.module";
import { PessoasModule } from "./pessoas/pessoas.module";
import { PontoModule } from "./ponto/ponto.module";
import { DocumentosModule } from "./documentos/documentos.module";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AuditModule,
    OrganizacaoModule,
    PessoasModule,
    PontoModule,
    DocumentosModule,
  ],
})
export class AppModule {}
