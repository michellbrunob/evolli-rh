/**
 * Cobertura dos efeitos reais do `prisma generate` da API (T171, B-1).
 *
 * O núcleo (`executarGeracao`) decide o ambiente sem `INIT_CWD` e confere o
 * destino; aqui fica provado que os efeitos reais ENTREGAM essas decisões ao
 * sistema — que o executor repassa `cwd` e `env` ao `spawnSync` em vez de usar o
 * ambiente do processo, e que a resolução parte da API. Nenhum Prisma roda: o
 * `spawn` é falso.
 *
 * Roda com o test runner embutido do Node (`node --test`): sem dependência nova.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

import {
  DIR_API,
  dataDeModificacao,
  dependenciasReais,
} from "./prisma-generate-api.efeitos.mjs";

test("o executor repassa ao spawnSync o node atual, os argumentos, o cwd e o env recebidos", () => {
  const chamadas = [];
  const retorno = { status: 0, signal: null };
  const deps = dependenciasReais({
    spawn: (...args) => {
      chamadas.push(args);
      return retorno;
    },
  });
  const env = { PATH: "/bin", SEM: "INIT_CWD" };
  const r = deps.executar(["cli.js", "generate"], { cwd: "/api", env });
  assert.equal(r, retorno);
  assert.deepEqual(chamadas, [
    [
      process.execPath,
      ["cli.js", "generate"],
      { cwd: "/api", env, stdio: "inherit" },
    ],
  ]);
});

test("o ambiente entregue ao núcleo é o original do processo (o núcleo é quem tira o INIT_CWD)", () => {
  assert.equal(dependenciasReais().ambiente, process.env);
});

test("a resolução de módulos parte da API e acha o CLI do Prisma e o @prisma/client", () => {
  const deps = dependenciasReais();
  assert.ok(DIR_API.endsWith(join("apps", "api")));
  assert.equal(deps.dirApi, DIR_API);
  const cli = deps.resolverModulo("prisma/build/index.js");
  assert.ok(cli.includes(`${sep}prisma${sep}build${sep}index.js`));
  const pacote = deps.caminhoReal(
    deps.resolverModulo("@prisma/client/package.json"),
  );
  assert.ok(pacote.endsWith(join("@prisma", "client", "package.json")));
});

test("dataDeModificacao: número para arquivo existente, null para ausente", () => {
  const dir = mkdtempSync(join(tmpdir(), "t171-mtime-"));
  try {
    const arquivo = join(dir, "index.d.ts");
    writeFileSync(arquivo, "export {};\n");
    assert.equal(typeof dataDeModificacao(arquivo), "number");
    assert.equal(dataDeModificacao(join(dir, "nao-existe.d.ts")), null);
    assert.equal(
      typeof dependenciasReais().dataDeModificacao(arquivo),
      "number",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("o relógio é o de parede, em ms de época", () => {
  const antes = Date.now();
  const lido = dependenciasReais().agora();
  assert.ok(lido >= antes && lido <= Date.now());
});
