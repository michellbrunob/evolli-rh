import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupOpenApi(app: INestApplication, version: string): void {
  const config = new DocumentBuilder()
    .setTitle("Evolli RH API")
    .setDescription(
      "API corporativa do ecossistema Evolli RH — fundação, sem módulos de domínio.",
    )
    .setVersion(version)
    .addTag("health", "Verificação de disponibilidade da API")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);
}
