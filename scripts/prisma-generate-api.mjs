#!/usr/bin/env node
/**
 * `prisma generate` da API, chamado pelo `postinstall` de `apps/api` (T171).
 *
 * Camada de efeitos: processo e disco. As regras — e a explicação de por que
 * este arquivo existe — estão em `prisma-generate-api.core.mjs`.
 *
 * Em uma frase: no Windows, o Prisma 5.22 gravava o client na raiz de
 * `node_modules` durante `pnpm install`, e o `tsc` da API quebrava até alguém
 * rodar `prisma generate` à mão. Aqui o `generate` roda sem `INIT_CWD` e, no
 * fim, confere que o client ficou ao lado do `@prisma/client`; se não ficou,
 * a instalação falha com a causa, em vez de seguir quebrada em silêncio.
 */
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARGUMENTOS_GENERATE,
  ambienteParaGerar,
  avaliarGeracao,
  destinoEsperadoDoClient,
} from "./prisma-generate-api.core.mjs";

const DIR_API = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "api",
);
const requireDaApi = createRequire(join(DIR_API, "package.json"));

const inicioMs = Date.now();
const cli = requireDaApi.resolve("prisma/build/index.js");
const resultado = spawnSync(process.execPath, [cli, ...ARGUMENTOS_GENERATE], {
  cwd: DIR_API,
  env: ambienteParaGerar(process.env),
  stdio: "inherit",
});
if (resultado.error) {
  process.stderr.write(
    `prisma generate não executou: ${resultado.error.message}\n`,
  );
  process.exit(1);
}
if (resultado.status !== 0) {
  process.exit(resultado.status ?? 1);
}

const dirPacoteClient = dirname(
  realpathSync(requireDaApi.resolve("@prisma/client/package.json")),
);
const destino = destinoEsperadoDoClient(dirPacoteClient);
let geradoEmMs = null;
try {
  geradoEmMs = statSync(join(destino, "index.d.ts")).mtimeMs;
} catch {
  geradoEmMs = null;
}

const avaliacao = avaliarGeracao({ destino, geradoEmMs, inicioMs });
if (!avaliacao.ok) {
  process.stderr.write(`\n${avaliacao.motivo}\n`);
  process.exit(1);
}
