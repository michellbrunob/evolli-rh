import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

function createHost(req: unknown, res: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  it('nunca expõe a mensagem interna da exceção, apenas mensagem pública fixa por status', () => {
    const filter = new AllExceptionsFilter();
    const req = { requestId: 'req-teste-1' };
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const res = { status: statusMock };

    const sensitiveDetail =
      'SELECT senha FROM usuarios WHERE cpf = 12345678900 -- falha em /app/src/internal/query.ts:42';
    const exception = new BadRequestException(sensitiveDetail);

    filter.catch(exception, createHost(req, res));

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = jsonMock.mock.calls[0][0];

    expect(body).toEqual({
      status_code: HttpStatus.BAD_REQUEST,
      message: 'Requisição inválida.',
      request_id: 'req-teste-1',
      timestamp: expect.any(String),
    });

    const bodyAsText = JSON.stringify(body);
    expect(bodyAsText).not.toContain('senha');
    expect(bodyAsText).not.toContain('cpf');
    expect(bodyAsText).not.toContain('/app/src');
    expect(bodyAsText).not.toContain(sensitiveDetail);
  });
});
