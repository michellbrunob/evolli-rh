import { Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import { Request } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Options } from "pino-http";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  "req.body",
  "req.query",
  "req.params",
  'res.headers["set-cookie"]',
  "*.password",
  "*.newPassword",
  "*.senha",
  "*.token",
  "*.tokenHash",
  "*.csrfToken",
  "*.csrfTokenHash",
  "*.cpf",
  "*.salario",
  // T125 — MFA TOTP: nenhum segredo/material de fator pode aparecer em log.
  "*.secret",
  "*.secretBase32",
  "*.otpauthUri",
  "*.recoveryCodes",
  "*.recoveryCode",
  "*.challengeToken",
  "*.code",
  "*.mfaCode",
  // T169 — contatos do colaborador: nenhum valor de contato aparece em log,
  // nem se um objeto que o contenha for logado por engano.
  "*.emailPessoal",
  "*.celular",
  "*.telefone",
];

/**
 * T178 — padrão da rota atendida (ex.: `/v1/cep/:cep`), nunca a URL. Caminho
 * inexistente cai na rota curinga do Nest (`/*`); sem rota nenhuma, `null`. O
 * caminho pedido pode carregar qualquer valor e nunca é gravado.
 */
export function rotaDaRequisicao(req: IncomingMessage): string | null {
  const { route, baseUrl } = req as Request;
  const padrao: unknown = route?.path;
  return typeof padrao === "string" ? `${baseUrl ?? ""}${padrao}` : null;
}

/**
 * Opções do log geral de requisições (pino-http).
 *
 * T178 — **nenhum valor da requisição entra no log**: nem a URL, que carrega
 * parâmetros de rota (o CEP em `/v1/cep/:cep`) e a query (a `busca` por nome ou
 * matrícula), nem corpo, query ou parâmetros. Ficam só metadados técnicos:
 * método e `requestId` em toda linha do contexto da requisição; padrão da
 * rota, status e duração (`responseTime`) na linha de conclusão.
 *
 * A linha `req` é serializada no INÍCIO da requisição, antes do roteamento —
 * por isso o padrão da rota entra só na conclusão, quando já é conhecido.
 */
export function opcoesDoLogHttp(level: string): Options {
  return {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    genReqId: (req: IncomingMessage) => (req as Request).requestId,
    customProps: (req: IncomingMessage) => ({
      requestId: (req as Request).requestId,
    }),
    customSuccessObject: (req, _res, valor: object) => ({
      ...valor,
      rota: rotaDaRequisicao(req),
    }),
    customErrorObject: (req, _res, _erro, valor: object) => ({
      ...valor,
      rota: rotaDaRequisicao(req),
    }),
    serializers: {
      req: (req: IncomingMessage) => ({
        method: (req as Request).method,
      }),
      res: (res: ServerResponse) => ({
        statusCode: res.statusCode,
      }),
    },
  };
}

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: opcoesDoLogHttp(process.env.LOG_LEVEL ?? "info"),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
