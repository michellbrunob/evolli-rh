import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  status_code: number;
  message: string;
  request_id: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? 'unknown';

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? this.extractMessage(exception)
      : 'Erro interno inesperado. Contate o suporte informando o request_id.';

    if (!isHttpException || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({
        msg: 'Erro não tratado na requisição',
        requestId,
        statusCode,
        errorName: exception instanceof Error ? exception.name : 'UnknownError',
      });
    }

    const body: ErrorBody = {
      status_code: statusCode,
      message,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const msg = (response as { message: unknown }).message;
      return Array.isArray(msg) ? msg.join('; ') : String(msg);
    }
    return exception.message;
  }
}
