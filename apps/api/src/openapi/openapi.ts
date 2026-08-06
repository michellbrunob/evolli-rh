import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupOpenApi(app: INestApplication, version: string): void {
  const config = new DocumentBuilder()
    .setTitle("Evolli RH API")
    .setDescription(
      "API corporativa do ecossistema Evolli RH — fundação e núcleo organizacional interno.",
    )
    .setVersion(version)
    .addTag("health", "Verificação de disponibilidade da API")
    .addTag(
      "organizacao",
      "Núcleo organizacional interno: empresa, unidade organizacional, departamento, área, equipe, cargo e centro de custo",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);
}
