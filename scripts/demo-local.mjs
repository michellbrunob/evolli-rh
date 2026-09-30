#!/usr/bin/env node
/**
 * Ambiente LOCAL de demonstração do Evolli RH (T141).
 *
 * Sobe, numa sequência única e verificável, o que já existe no repositório:
 * PostgreSQL do `docker-compose.yml`, papéis de `infra/postgres/`, migrations
 * do Prisma, conta de bootstrap, seed sintético e os dois servidores de
 * desenvolvimento (API e web).
 *
 * **Não esconde falha.** Cada passo é nomeado; qualquer erro encerra o
 * processo com código diferente de zero e diz qual passo falhou. Nenhuma senha
 * ou string de conexão é impressa.
 *
 * **É desenvolvimento, não homologação nem produção.** Só aceita banco e API
 * em `127.0.0.1`/`localhost`, e o seed exige `EVOLLI_DEMO_SEED`.
 *
 * Uso: `pnpm demo:up`  (Ctrl+C encerra os servidores; o banco continua de pé)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_DIR = join(RAIZ, "apps", "api");
const PORTA_API = process.env.PORT ?? "3000";
const URL_API = `http://127.0.0.1:${PORTA_API}`;
const URL_WEB = "http://127.0.0.1:5173";
const CONFIRMACAO_SEED = "confirmo-ambiente-local";

let passoAtual = "inicialização";

function passo(nome) {
  passoAtual = nome;
  process.stdout.write(`\n── ${nome}\n`);
}

function falhar(motivo) {
  throw new Error(motivo);
}

/** Executa e propaga a falha com o passo nomeado. Nunca imprime segredo. */
function executar(comando, args, opcoes = {}) {
  const r = spawnSync(comando, args, {
    cwd: RAIZ,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opcoes,
  });
  if (r.error) falhar(`${comando} não pôde ser executado: ${r.error.message}`);
  if (r.status !== 0) falhar(`${comando} terminou com código ${r.status}`);
}

function capturar(comando, args, opcoes = {}) {
  const r = spawnSync(comando, args, {
    cwd: RAIZ,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opcoes,
  });
  return { status: r.status ?? 1, saida: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function lerEnv(caminho) {
  if (!existsSync(caminho)) return {};
  const mapa = {};
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (m) mapa[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return mapa;
}

async function esperar(rotulo, tentar, tentativas = 60, intervaloMs = 1000) {
  for (let i = 1; i <= tentativas; i += 1) {
    if (await tentar()) return;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  falhar(`${rotulo} não ficou disponível a tempo (${tentativas}s).`);
}

// ---------------------------------------------------------------------------

async function main() {
  passo("1/8 Pré-requisitos");
  if (capturar("docker", ["--version"]).status !== 0) {
    falhar(
      "Docker não está disponível no PATH. Instale o Docker Desktop — o " +
        "PostgreSQL local vem do docker-compose.yml da raiz.",
    );
  }
  const envRaiz = lerEnv(join(RAIZ, ".env"));
  if (
    !envRaiz.POSTGRES_DB ||
    !envRaiz.POSTGRES_USER ||
    !envRaiz.POSTGRES_PASSWORD
  ) {
    falhar(
      "Falta o .env da raiz. Copie .env.example para .env e defina " +
        "POSTGRES_DB, POSTGRES_USER e POSTGRES_PASSWORD (valores locais).",
    );
  }
  const envApi = lerEnv(join(API_DIR, ".env"));
  const envMigrate = lerEnv(join(API_DIR, ".env.migrate"));
  const databaseUrl = envApi.DATABASE_URL ?? process.env.DATABASE_URL;
  const migrateUrl =
    envMigrate.MIGRATE_DATABASE_URL ?? process.env.MIGRATE_DATABASE_URL;
  if (!databaseUrl || !migrateUrl) {
    falhar(
      "Faltam as conexões da API. Crie apps/api/.env (DATABASE_URL, papel " +
        "evolli_app) e apps/api/.env.migrate (MIGRATE_DATABASE_URL, papel " +
        "evolli_migrator) conforme infra/postgres/README.md.",
    );
  }
  for (const [rotulo, valor] of [
    ["DATABASE_URL", databaseUrl],
    ["MIGRATE_DATABASE_URL", migrateUrl],
  ]) {
    const host = new URL(valor).hostname.replace(/^\[|\]$/g, "");
    if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
      falhar(
        `${rotulo} aponta para "${host}". A demonstração só roda contra a ` +
          "própria máquina — nunca homologação ou produção.",
      );
    }
  }

  passo("2/8 PostgreSQL local (docker compose)");
  executar("docker", ["compose", "up", "-d"]);
  await esperar("PostgreSQL", async () => {
    const r = capturar("docker", [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      envRaiz.POSTGRES_USER,
      "-d",
      envRaiz.POSTGRES_DB,
    ]);
    return r.status === 0;
  });

  passo("3/8 Papéis, schema e extensões (infra/postgres)");
  const senhaMigrator = process.env.EVOLLI_MIGRATOR_PASSWORD;
  const senhaApp = process.env.EVOLLI_APP_PASSWORD;
  if (!senhaMigrator || !senhaApp) {
    falhar(
      "Exporte EVOLLI_MIGRATOR_PASSWORD e EVOLLI_APP_PASSWORD no shell " +
        "(senhas locais quaisquer, coerentes com apps/api/.env). Elas nunca " +
        "entram em arquivo versionado.",
    );
  }
  const psql = (args, arquivo) =>
    executar("docker", [
      "compose",
      "exec",
      "-T",
      "-e",
      `PGPASSWORD=${envRaiz.POSTGRES_PASSWORD}`,
      "postgres",
      "psql",
      "-U",
      envRaiz.POSTGRES_USER,
      "-d",
      envRaiz.POSTGRES_DB,
      "-v",
      "ON_ERROR_STOP=1",
      ...args,
      "-f",
      `/tmp/${arquivo}`,
    ]);
  for (const arquivo of [
    "01_create_roles.sql",
    "02_schema_and_grants.sql",
    "04_extensions.sql",
  ]) {
    executar("docker", [
      "compose",
      "cp",
      join("infra", "postgres", arquivo),
      `postgres:/tmp/${arquivo}`,
    ]);
  }
  psql(
    [
      "-v",
      `migrator_password=${senhaMigrator}`,
      "-v",
      `app_password=${senhaApp}`,
    ],
    "01_create_roles.sql",
  );
  psql([], "02_schema_and_grants.sql");
  psql([], "04_extensions.sql");

  passo("4/8 Migrations (prisma migrate deploy)");
  executar("pnpm", ["--filter", "@evolli/api", "run", "db:migrate:deploy"]);

  passo("5/8 Servidores de desenvolvimento (API e web)");
  const servidores = spawn("pnpm", ["dev"], {
    cwd: RAIZ,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  servidores.on("exit", (codigo) => {
    if (codigo !== 0 && codigo !== null) {
      process.stderr.write(`\nServidores encerraram com código ${codigo}.\n`);
      process.exitCode = codigo;
    }
  });
  const encerrar = () => servidores.kill();
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);

  await esperar("API", async () => {
    try {
      const r = await fetch(`${URL_API}/v1/health/ready`);
      return r.ok;
    } catch {
      return false;
    }
  });

  passo("6/8 Conta de bootstrap (admin técnico)");
  const bootstrap = capturar(
    "pnpm",
    [
      "--filter",
      "@evolli/api",
      "exec",
      "ts-node",
      "-T",
      "src/bootstrap/bootstrap-admin.ts",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        ADMIN_BOOTSTRAP_EMAIL: "admin.demo@evolli.local",
        ADMIN_BOOTSTRAP_PASSWORD: "Demonstracao-Local-Evolli-2026",
      },
    },
  );
  if (bootstrap.status !== 0 && !/[Jj]á existe/.test(bootstrap.saida)) {
    falhar(`bootstrap do admin falhou:\n${bootstrap.saida}`);
  }

  passo("7/8 Seed sintético (idempotente)");
  executar(
    "pnpm",
    [
      "--filter",
      "@evolli/api",
      "exec",
      "ts-node",
      "-T",
      "src/seed/demo-seed.cli.ts",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        EVOLLI_DEMO_SEED: CONFIRMACAO_SEED,
        EVOLLI_DEMO_API_URL: URL_API,
      },
    },
  );

  passo("8/8 Pronto");
  const sha = capturar("git", ["rev-parse", "--short", "HEAD"]).saida.trim();
  process.stdout.write(
    [
      "",
      "  AMBIENTE LOCAL DE DEMONSTRAÇÃO — dados exclusivamente sintéticos.",
      "  Desenvolvimento. Não é homologação, não é produção, proibido dado real.",
      "",
      `  Web ......... ${URL_WEB}`,
      `  API ......... ${URL_API}`,
      `  SHA ......... ${sha}`,
      "",
      "  Perfis e senha: docs/AMBIENTE-DEMONSTRACAO-LOCAL.md",
      "  O que já dá para navegar: docs/GUIA-VISUAL-FUNCIONALIDADES.md",
      "",
      "  Ctrl+C encerra os servidores. O banco continua de pé.",
      "",
    ].join("\n"),
  );
}

main().catch((erro) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  process.stderr.write(
    `\nFALHOU no passo "${passoAtual}": ${mensagem}\n` +
      "O ambiente NÃO está pronto. Corrija o passo acima e rode de novo.\n",
  );
  process.exit(1);
});
