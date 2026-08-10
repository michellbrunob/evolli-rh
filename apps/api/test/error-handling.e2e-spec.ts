import { INestApplication, VersioningType } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { requestIdMiddleware } from "../src/common/request-id";

/**
 * Esta suíte não sobe banco: ela exercita só o filtro de exceção e o
 * `request-id`. Ainda assim, `AppModule` instancia o `PrismaService`, cujo
 * `onModuleInit` tenta conectar (e engole a falha por desenho, ADR 0002).
 *
 * O timeout explícito cobre essa tentativa: rodando em paralelo com as suítes
 * que sobem PostgreSQL via Testcontainers, o `beforeAll` pode ultrapassar os
 * 5 s padrão do Jest — e falhar por contenção de recurso, não por defeito.
 * Todas as demais suítes e2e já definem o seu; esta passa a seguir a mesma
 * convenção. Um travamento real continua sendo reprovado.
 */
jest.setTimeout(120_000);

describe("Tratamento centralizado de erros (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(requestIdMiddleware);
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna 404 estruturado com request_id e mensagem pública fixa, sem stack trace", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/rota-que-nao-existe")
      .expect(404);

    expect(response.body).toEqual({
      status_code: 404,
      message: "Recurso não encontrado.",
      request_id: expect.any(String),
      timestamp: expect.any(String),
    });

    const bodyAsText = JSON.stringify(response.body);
    expect(bodyAsText).not.toContain("at ");
    expect(bodyAsText).not.toContain(".ts:");
    expect(bodyAsText).not.toContain(".js:");
    expect(response.body).not.toHaveProperty("stack");
  });

  it("aceita x-request-id válido do cliente e usa o mesmo valor no header e no corpo do erro", async () => {
    const validId = "teste-correlacao-123";

    const response = await request(app.getHttpServer())
      .get("/v1/rota-que-nao-existe")
      .set("x-request-id", validId)
      .expect(404);

    expect(response.headers["x-request-id"]).toBe(validId);
    expect(response.body.request_id).toBe(validId);
  });

  it("substitui x-request-id inválido (caractere fora da allowlist) por um novo identificador gerado", async () => {
    const invalidId = 'id com espaço e "aspas"';

    const response = await request(app.getHttpServer())
      .get("/v1/rota-que-nao-existe")
      .set("x-request-id", invalidId)
      .expect(404);

    expect(response.headers["x-request-id"]).not.toBe(invalidId);
    expect(response.body.request_id).not.toBe(invalidId);
    expect(response.body.request_id).toBe(response.headers["x-request-id"]);
  });

  it("substitui x-request-id inválido (acima de 128 caracteres) por um novo identificador gerado", async () => {
    const tooLongId = "a".repeat(129);

    const response = await request(app.getHttpServer())
      .get("/v1/rota-que-nao-existe")
      .set("x-request-id", tooLongId)
      .expect(404);

    expect(response.headers["x-request-id"]).not.toBe(tooLongId);
    expect(response.body.request_id).not.toBe(tooLongId);
    expect(response.body.request_id.length).toBeLessThanOrEqual(128);
  });
});
