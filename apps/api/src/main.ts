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

  await app.listen(port);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Falha ao iniciar a aplicação", error);
  process.exit(1);
});
