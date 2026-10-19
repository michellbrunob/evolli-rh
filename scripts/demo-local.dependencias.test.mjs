/**
 * O que a CLI da demonstração entrega ao núcleo (T171, B-1).
 *
 * A trava do passo 1/8 confere a versão do Node que o NÚCLEO recebe. Se a CLI
 * deixasse de encaminhá-la, todo teste do núcleo continuaria verde — ele usa
 * dependências falsas — e a demonstração real pararia com "Node desconhecido".
 * Aqui fica provado o encaminhamento, sem subir nada: importar `demo-local.mjs`
 * não executa o ambiente.
 *
 * Roda com o test runner embutido do Node (`node --test`): sem dependência nova.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { dependenciasReais } from "./demo-local.mjs";

test("a CLI encaminha ao núcleo a versão do Node em uso, que a trava confere", () => {
  assert.equal(dependenciasReais().versaoNode, process.version);
});

test("a CLI encaminha a plataforma e a raiz do repositório", () => {
  const deps = dependenciasReais();
  assert.equal(deps.plataforma, process.platform);
  assert.equal(deps.raiz, join(dirname(fileURLToPath(import.meta.url)), ".."));
});
