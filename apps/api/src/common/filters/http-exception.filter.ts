import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { descreverErroDeBanco } from "../diagnostico-banco";
import {
  CamposRecusadosException,
  CodigoDeRecusa,
  ConflitoDeCamposException,
  ErroDeCampo,
  RecusaCsrfException,
  RecusaDeNegocioException,
} from "../erros/recusa-por-campo";

interface ErrorBody {
  status_code: number;
  message: string;
  request_id: string;
  timestamp: string;
  /** T179 — campos recusados e o motivo, sem o valor (`DP-ADM-15`). */
  erros?: readonly ErroDeCampo[];
  /** T179 — código estável de recusa de negócio sem campo próprio. */
  codigo?: CodigoDeRecusa;
}

const DEFAULT_CLIENT_MESSAGE = "Não foi possível processar a requisição.";
const DEFAULT_SERVER_MESSAGE =
  "Erro interno inesperado. Contate o suporte informando o request_id.";

// Mensagens públicas fixas por status HTTP. Nunca derivadas da mensagem da
// exceção — evita vazar SQL, caminho interno, stack trace ou entrada do
// usuário refletida na resposta.
const PUBLIC_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: "Requisição inválida.",
  [HttpStatus.UNAUTHORIZED]: "Não autorizado.",
  [HttpStatus.FORBIDDEN]: "Acesso negado.",
  [HttpStatus.NOT_FOUND]: "Recurso não encontrado.",
  [HttpStatus.METHOD_NOT_ALLOWED]: "Método não permitido.",
  [HttpStatus.CONFLICT]: "Conflito ao processar a requisição.",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "Dados inválidos.",
  [HttpStatus.TOO_MANY_REQUESTS]:
    "Muitas requisições. Tente novamente mais tarde.",
  [HttpStatus.SERVICE_UNAVAILABLE]: "Serviço temporariamente indisponível.",
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId ?? "unknown";

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolvePublicMessage(statusCode);

    if (!isHttpException || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // T161 — o log ganha SQLSTATE e identificador de constraint/trigger.
      //
      // Antes dizia so `errorName`, e isso bastava para saber que algo
      // quebrou, nunca O QUE quebrou: a falha de `main` em `0db3d70` chegou
      // como `PrismaClientUnknownRequestError` e a investigacao parou ali.
      //
      // `descreverErroDeBanco` extrai apenas artefatos de SCHEMA — classe,
      // codigo do Prisma, SQLSTATE, nome da constraint. Mensagem do banco,
      // `DETAIL` (que carrega os valores enviados), parametros e stack NAO
      // entram, e nada disto toca a resposta HTTP.
      this.logger.error({
        msg: "Erro não tratado na requisição",
        requestId,
        statusCode,
        errorName: exception instanceof Error ? exception.name : "UnknownError",
        ...descreverErroDeBanco(exception),
      });
    }

    const body: ErrorBody = {
      status_code: statusCode,
      message,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      // T179 — só os detalhes tipados que a própria aplicação monta: caminho
      // do campo e motivo de uma lista fechada, ou um código fixo. Nada da
      // mensagem da exceção nem do valor enviado.
      ...(exception instanceof ConflitoDeCamposException ||
      exception instanceof CamposRecusadosException
        ? {
            erros: exception.erros.map(({ campo, motivo }) => ({
              campo,
              motivo,
            })),
          }
        : {}),
      ...(exception instanceof RecusaDeNegocioException ||
      exception instanceof RecusaCsrfException
        ? { codigo: exception.codigo }
        : {}),
    };

    response.status(statusCode).json(body);
  }

  private resolvePublicMessage(statusCode: number): string {
    const fixedMessage = PUBLIC_MESSAGES[statusCode];
    if (fixedMessage) {
      return fixedMessage;
    }
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
      ? DEFAULT_SERVER_MESSAGE
      : DEFAULT_CLIENT_MESSAGE;
  }
}
