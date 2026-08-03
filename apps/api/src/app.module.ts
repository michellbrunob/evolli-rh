import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "./common/logger/logger.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./health/health.module";
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
  ],
})
export class AppModule {}
