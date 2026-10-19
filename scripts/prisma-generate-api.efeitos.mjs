/**
 * Efeitos reais do `prisma generate` da API (T171): processo e disco.
 *
 * Separado da CLI de propósito: importar este módulo não executa nada, então o
 * teste pode provar como cada efeito é ligado — que o executor encaminha `cwd`
 * e `env` ao `spawnSync`, que a resolução parte da API — sem rodar o Prisma.
 * A lógica (ambiente sem `INIT_CWD`, verificação do destino) está em
 * `executarGeracao`, no núcleo.
 */
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DIR_API = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps",
  "api",
);

/** Data de modificação em ms de época, ou `null` se o arquivo não existe. */
export function dataDeModificacao(caminho, stat = statSync) {
  try {
    return stat(caminho).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Dependências reais de `executarGeracao`. `spawn` é injetável só para o teste
 * provar o encaminhamento ao `spawnSync`; em produção é sempre o real.
 */
export function dependenciasReais({ spawn = spawnSync } = {}) {
  const requireDaApi = createRequire(join(DIR_API, "package.json"));
  return {
    dirApi: DIR_API,
    ambiente: process.env,
    executar: (args, { cwd, env }) =>
      spawn(process.execPath, args, { cwd, env, stdio: "inherit" }),
    resolverModulo: (especificador) => requireDaApi.resolve(especificador),
    caminhoReal: (caminho) => realpathSync(caminho),
    dataDeModificacao: (caminho) => dataDeModificacao(caminho),
    agora: () => Date.now(),
  };
}
