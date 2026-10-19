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
  executarGeracao,
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

// ---------------------------------------------------------------------------
// executarGeracao — a camada de efeitos, com efeitos falsos (T171, B-1)
// ---------------------------------------------------------------------------

const PACOTE_REAL = join(
  "repo",
  "node_modules",
  ".pnpm",
  "@prisma+client@5.22.0_prisma@5.22.0",
  "node_modules",
  "@prisma",
  "client",
);
// Caminho pelo link (junction/symlink) que a resolução de módulo devolve; o
// destino só é certo se calculado a partir do caminho REAL.
const PACOTE_LINK = join(
  "repo",
  "apps",
  "api",
  "node_modules",
  "@prisma",
  "client",
);
const DESTINO = destinoEsperadoDoClient(PACOTE_REAL);
const CLI_PRISMA = join("repo", "node_modules", "prisma", "build", "index.js");

function efeitosFalsos({
  status = 0,
  signal = null,
  error = null,
  geradoEmMs = 10_500,
  inicioMs = 10_000,
  // Quanto tempo o generate "leva": o relógio avança quando o executor roda.
  depoisMs = 99_999,
} = {}) {
  const chamadas = [];
  const lidas = [];
  const ambiente = {
    INIT_CWD: "C:\\repo",
    npm_lifecycle_event: "postinstall",
    PATH: "C:\\bin",
    DATABASE_URL: "postgresql://x",
  };
  let tempo = inicioMs;
  const deps = {
    dirApi: join("repo", "apps", "api"),
    ambiente,
    executar: (args, opcoes) => {
      chamadas.push({ args, opcoes });
      tempo = depoisMs;
      return { status, signal, error };
    },
    resolverModulo: (especificador) => {
      if (especificador === "prisma/build/index.js") return CLI_PRISMA;
      if (especificador === "@prisma/client/package.json") {
        return join(PACOTE_LINK, "package.json");
      }
      throw new Error(`resolução inesperada: ${especificador}`);
    },
    caminhoReal: (caminho) =>
      caminho === join(PACOTE_LINK, "package.json")
        ? join(PACOTE_REAL, "package.json")
        : caminho,
    dataDeModificacao: (caminho) => {
      lidas.push(caminho);
      return caminho === join(DESTINO, "index.d.ts") ? geradoEmMs : null;
    },
    // O relógio AVANÇA enquanto o generate roda: se o instante de início fosse
    // lido depois dele, um client recente pareceria antigo e a geração falharia.
    agora: () => tempo,
  };
  return { deps, chamadas, lidas, ambiente };
}

test("o generate roda na API, com os argumentos oficiais e o ambiente original menos INIT_CWD", () => {
  const f = efeitosFalsos();
  executarGeracao(f.deps);
  assert.equal(f.chamadas.length, 1);
  const [{ args, opcoes }] = f.chamadas;
  assert.deepEqual(args, [CLI_PRISMA, ...ARGUMENTOS_GENERATE]);
  assert.deepEqual(args.slice(1), [
    "generate",
    "--schema=prisma/schema.prisma",
    "--allow-no-models",
  ]);
  assert.equal(opcoes.cwd, join("repo", "apps", "api"));
  assert.deepEqual(opcoes.env, {
    npm_lifecycle_event: "postinstall",
    PATH: "C:\\bin",
    DATABASE_URL: "postgresql://x",
  });
  // O ambiente do processo não é alterado.
  assert.equal(f.ambiente.INIT_CWD, "C:\\repo");
});

test("client recente no destino certo (calculado pelo caminho real): sucesso", () => {
  const f = efeitosFalsos();
  assert.deepEqual(executarGeracao(f.deps), {
    ok: true,
    codigo: 0,
    mensagem: null,
  });
  assert.deepEqual(f.lidas, [join(DESTINO, "index.d.ts")]);
});

test("saída diferente de zero falha com o mesmo código, sem conferir o destino", () => {
  for (const status of [1, 3]) {
    const f = efeitosFalsos({ status });
    assert.deepEqual(executarGeracao(f.deps), {
      ok: false,
      codigo: status,
      mensagem: null,
    });
    assert.equal(f.lidas.length, 0);
  }
});

test("término por sinal (status nulo) falha com código 1", () => {
  const f = efeitosFalsos({ status: null, signal: "SIGTERM" });
  assert.deepEqual(executarGeracao(f.deps), {
    ok: false,
    codigo: 1,
    mensagem: null,
  });
});

test("generate que nem executa falha com código 1 e a causa", () => {
  const f = efeitosFalsos({ status: null, error: new Error("spawn EPERM") });
  const r = executarGeracao(f.deps);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 1);
  assert.match(r.mensagem, /prisma generate não executou: spawn EPERM/);
});

test("client ausente do destino falha com código 1 e a causa", () => {
  const f = efeitosFalsos({ geradoEmMs: null });
  const r = executarGeracao(f.deps);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 1);
  assert.match(r.mensagem, /não gerou o client em/);
  assert.ok(r.mensagem.includes(DESTINO));
});

test("client antigo no destino, segundo o relógio injetado, falha", () => {
  const f = efeitosFalsos({ geradoEmMs: 1_000, inicioMs: 60_000 });
  const r = executarGeracao(f.deps);
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 1);
  assert.match(r.mensagem, /anterior a esta geração/);
});

test("a tolerância continua de 2 s também na execução", () => {
  assert.equal(
    executarGeracao(efeitosFalsos({ geradoEmMs: 8_000, inicioMs: 10_000 }).deps)
      .ok,
    true,
  );
  assert.equal(
    executarGeracao(efeitosFalsos({ geradoEmMs: 7_999, inicioMs: 10_000 }).deps)
      .ok,
    false,
  );
});
