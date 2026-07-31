import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('Tratamento centralizado de erros (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna 404 estruturado com request_id em rota inexistente, sem stack trace', async () => {
    const response = await request(app.getHttpServer()).get('/v1/rota-que-nao-existe').expect(404);

    expect(response.body).toMatchObject({
      status_code: 404,
      request_id: expect.any(String),
      timestamp: expect.any(String),
    });

    const bodyAsText = JSON.stringify(response.body);
    expect(bodyAsText).not.toContain('at ');
    expect(bodyAsText).not.toContain('.ts:');
    expect(bodyAsText).not.toContain('.js:');
    expect(response.body).not.toHaveProperty('stack');
  });

  it('propaga o x-request-id enviado pelo cliente na resposta de erro', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/rota-que-nao-existe')
      .set('x-request-id', 'teste-correlacao-123')
      .expect(404);

    expect(response.body.request_id).toBe('teste-correlacao-123');
  });
});
