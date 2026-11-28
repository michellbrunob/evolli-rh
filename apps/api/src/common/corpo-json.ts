import type { NestExpressApplication } from "@nestjs/platform-express";

/**
 * T216 — limite do corpo JSON. O padrão do Express (100 KB) não comporta uma
 * pesquisa no tamanho máximo do assistente (60 perguntas, até 20 opções de
 * até 200 caracteres cada). 1 MB cobre esse caso com folga sem abrir a porta
 * para corpos arbitrariamente grandes. Os arquivos (fotos, documentos e
 * anexos) não passam por aqui: vão por multipart, com limites próprios.
 */
export const LIMITE_CORPO_JSON = "1mb";

/**
 * Registra o parser JSON com o limite, antes do `init` (o Nest então não
 * registra o padrão). Usado no bootstrap e nos testes e2e que dependem dele.
 */
export function aplicarLimiteDoCorpo(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: LIMITE_CORPO_JSON });
}
