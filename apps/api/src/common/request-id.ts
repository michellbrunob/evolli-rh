import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_MAX_LENGTH = 128;

// Allowlist restritiva: letras, dígitos, hífen, underscore e ponto.
// Bloqueia espaços, quebras de linha e caracteres de controle usados em
// ataques de log/header injection.
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

declare module "express" {
  interface Request {
    requestId: string;
  }
}

export function isValidRequestId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
}

/**
 * Única fonte de geração/validação do request_id. Deve ser registrada via
 * `app.use()` antes de qualquer middleware do logger (pino-http), para que
 * o mesmo valor seja usado em header, log estruturado e corpo de erro.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId =
    incoming && isValidRequestId(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
