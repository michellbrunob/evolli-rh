import { INestApplication, VersioningType } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { requestIdMiddleware } from "../src/common/request-id";

describe("GET /v1/health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna status ok, versão e timestamp UTC, sem dados sensíveis", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/health")
      .expect(200);

    expect(response.body).toEqual({
      status: "ok",
      version: expect.any(String),
      timestamp: expect.any(String),
    });

    expect(new Date(response.body.timestamp).toISOString()).toBe(
      response.body.timestamp,
    );

    const forbiddenKeys = [
      "password",
      "senha",
      "token",
      "cpf",
      "salario",
      "database_url",
    ];
    const bodyAsText = JSON.stringify(response.body).toLowerCase();
    forbiddenKeys.forEach((key) => {
      expect(bodyAsText).not.toContain(key);
    });
  });

  it("inclui x-request-id na resposta", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/health")
      .expect(200);

    expect(response.headers["x-request-id"]).toBeDefined();
  });
});
