/**
 * Cobertura do núcleo do `prisma generate` da API (T171).
 *
 * Por que estes testes existem: no Windows, o client do Prisma ia parar na raiz
 * de `node_modules` durante `pnpm install`, e o `tsc` da API quebrava até um
 * `prisma generate` manual. A causa está na fonte do Prisma 5.22 e é descrita em
 * `prisma-generate-api.core.mjs`; aqui ficam presas as regras da correção.
 *
 * Roda com o test runner embutido do Node (`node --test`): sem dependência nova.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  ARGUMENTOS_GENERATE,
  ambienteParaGerar,
  avaliarGeracao,
  destinoEsperadoDoClient,
} from "./prisma-generate-api.core.mjs";

test("o generate roda sem INIT_CWD — é o que tira o Prisma do ramo que grava na raiz", () => {
  const ambiente = {
    INIT_CWD: "C:\\repo",
    npm_lifecycle_event: "postinstall",
    PATH: "C:\\bin",
    DATABASE_URL: "postgresql://x",
  };
  const resultado = ambienteParaGerar(ambiente);
  assert.equal("INIT_CWD" in resultado, false);
  // O resto do ambiente passa intacto: o generate continua vendo PATH e afins.
  assert.equal(resultado.PATH, "C:\\bin");
  assert.equal(resultado.npm_lifecycle_event, "postinstall");
  assert.equal(resultado.DATABASE_URL, "postgresql://x");
});

test("o ambiente do processo não é alterado", () => {
  const ambiente = { INIT_CWD: "/repo", PATH: "/bin" };
  ambienteParaGerar(ambiente);
  assert.equal(ambiente.INIT_CWD, "/repo");
});

test("os argumentos são os do postinstall anterior", () => {
  assert.deepEqual(
    [...ARGUMENTOS_GENERATE],
    ["generate", "--schema=prisma/schema.prisma", "--allow-no-models"],
  );
});

test("o destino esperado fica ao lado do pacote @prisma/client, não na raiz", () => {
  const pacote = join(
    "repo",
    "node_modules",
    ".pnpm",
    "@prisma+client@5.22.0_prisma@5.22.0",
    "node_modules",
    "@prisma",
    "client",
  );
  assert.equal(
    destinoEsperadoDoClient(pacote),
    join(
      "repo",
      "node_modules",
      ".pnpm",
      "@prisma+client@5.22.0_prisma@5.22.0",
      "node_modules",
      ".prisma",
      "client",
    ),
  );
});

test("client gerado nesta rodada, no destino esperado: aceito", () => {
  assert.deepEqual(
    avaliarGeracao({ destino: "d", geradoEmMs: 10_500, inicioMs: 10_000 }),
    { ok: true, motivo: null },
  );
});

test("client ausente do destino esperado: recusado, com a causa", () => {
  const r = avaliarGeracao({
    destino: "d",
    geradoEmMs: null,
    inicioMs: 10_000,
  });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /não gerou o client em d/);
});

test("sobra de geração anterior no destino não conta como sucesso", () => {
  // O caso do Windows antes da correção: o destino certo tinha um client
  // antigo, e o novo ia para a raiz.
  const r = avaliarGeracao({
    destino: "d",
    geradoEmMs: 1_000,
    inicioMs: 60_000,
  });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /anterior a esta geração/);
});

test("a tolerância de relógio de arquivo é de 2 s, e só isso", () => {
  assert.equal(
    avaliarGeracao({ destino: "d", geradoEmMs: 8_000, inicioMs: 10_000 }).ok,
    true,
  );
  assert.equal(
    avaliarGeracao({ destino: "d", geradoEmMs: 7_999, inicioMs: 10_000 }).ok,
    false,
  );
});
