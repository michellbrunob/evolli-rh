import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export function setupOpenApi(
  app: INestApplication,
  version: string,
): OpenAPIObject {
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
    .addTag(
      "documentos",
      "Documentos e admissão digital — V1 de metadados (sem conteúdo): tipo documental, metadado e solicitação",
    )
    .addTag(
      "horarios",
      "Cadastros — Tabelas de horário por empresa e vínculo histórico ao colaborador (sem cálculo de jornada)",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);
  return document;
}
