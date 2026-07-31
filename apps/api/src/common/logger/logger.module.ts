import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { Request } from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.body',
  'req.query',
  'req.params',
  'res.headers["set-cookie"]',
  '*.password',
  '*.senha',
  '*.token',
  '*.cpf',
  '*.salario',
];

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: REDACT_PATHS,
          censor: '[REDACTED]',
        },
        genReqId: (req: IncomingMessage) => (req as Request).requestId,
        customProps: (req: IncomingMessage) => ({
          requestId: (req as Request).requestId,
        }),
        serializers: {
          req: (req: IncomingMessage) => ({
            method: (req as Request).method,
            url: req.url,
          }),
          res: (res: ServerResponse) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
