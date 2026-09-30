import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Logger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import { requestIdMiddleware } from "./common/request-id";
import { setupOpenApi } from "./openapi/openapi";
import { resolverHostDeEscuta } from "./config/env.validation";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Precisa ser o primeiro middleware: define req.requestId antes do
  // middleware de log do pino-http e de qualquer outro handler, garantindo
  // uma única fonte para o request_id (header, log e corpo de erro).
  app.use(requestIdMiddleware);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 3000);
  const version = configService.get<string>("APP_VERSION", "0.0.0");

  setupOpenApi(app, version);

  // T141 — no modo de demonstração local a escuta é restrita a 127.0.0.1
  // (`resolverHostDeEscuta`, validado em `validateEnv`). Fora dele, nada muda:
  // `host` é `undefined` e o `app.listen(port)` histórico é preservado.
  const hostConfigurado = configService.get<string>("HOST");
  const host = resolverHostDeEscuta({
    EVOLLI_DEMO_MODE: configService.get<boolean>("EVOLLI_DEMO_MODE", false),
    ...(hostConfigurado !== undefined ? { HOST: hostConfigurado } : {}),
  });

  if (host === undefined) {
    await app.listen(port);
  } else {
    await app.listen(port, host);
  }
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar a aplicação", error);
  process.exit(1);
});
