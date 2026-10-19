#!/usr/bin/env node
/**
 * `prisma generate` da API, chamado pelo `postinstall` de `apps/api` (T171).
 *
 * Adaptadora fina: liga `executarGeracao` (núcleo, testado) aos efeitos reais
 * (`prisma-generate-api.efeitos.mjs`, testados no encaminhamento) e traduz o
 * resultado em mensagem e código de saída. As regras — e a explicação de por
 * que este arquivo existe — estão em `prisma-generate-api.core.mjs`.
 *
 * Em uma frase: no Windows, o Prisma 5.22 gravava o client na raiz de
 * `node_modules` durante `pnpm install`, e o `tsc` da API quebrava até alguém
 * rodar `prisma generate` à mão. O `generate` roda sem `INIT_CWD` e, no fim, o
 * destino do client é conferido; se estiver errado, a instalação falha com a
 * causa, em vez de seguir quebrada em silêncio.
 */
import { executarGeracao } from "./prisma-generate-api.core.mjs";
import { dependenciasReais } from "./prisma-generate-api.efeitos.mjs";

const resultado = executarGeracao(dependenciasReais());
if (resultado.mensagem) {
  process.stderr.write(resultado.mensagem);
}
if (!resultado.ok) {
  process.exit(resultado.codigo);
}
