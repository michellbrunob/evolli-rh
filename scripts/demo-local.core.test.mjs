/**
 * Cobertura do orquestrador do ambiente local (T141).
 *
 * Esta máquina não tem Docker, então a sequência de `pnpm demo:up` era a
 * única parte da entrega sem prova nenhuma. Aqui os executores são injetados:
 * nenhum container sobe, nenhuma porta é aberta, nenhum processo real nasce —
 * e ainda assim dá para provar ordem, parada na primeira falha, limpeza de
 * filhos, timeouts, porta ocupada, endereço permitido, repetição e ausência
 * de segredo em `argv` e em log.
 *
 * Roda com o test runner embutido do Node (`node --test`): sem dependência
 * nova. Não substitui a execução real pelo proprietário — reduz o que ela
 * precisa descobrir.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  CODIGO_SAIDA_ADMIN_JA_EXISTE,
  DESTINO_INALCANCAVEL,
  FalhaDePasso,
  HOST_LOCAL,
  NOMES_PASSOS,
  PORTA_WEB,
  censurar,
  comoLiteralPsql,
  lerEnv,
  senhaDoPapel,
  subirAmbiente,
} from "./demo-local.core.mjs";

/** Raiz com espaço, como a do proprietário. */
const RAIZ = "C:\\MB\\Sistema RH\\Evolli RH";

/** Senhas deliberadamente hostis: espaço, `&`, `^`, `%` e aspas. */
const SENHA_ADMIN = "adm in&senha^local%1";
const SENHA_APP = "app se&nha^local%2'x";
const SENHA_MIGRATOR = "migr ador&^%3\\y";

function urlDe(usuario, senha) {
  return `postgresql://${usuario}:${encodeURIComponent(senha)}@127.0.0.1:5432/evolli_rh_dev?schema=app`;
}

const ARQUIVOS_PADRAO = {
  ".env": [
    "POSTGRES_DB=evolli_rh_dev",
    "POSTGRES_USER=postgres_local_admin",
    `POSTGRES_PASSWORD=${SENHA_ADMIN}`,
  ].join("\n"),
  "apps/api/.env": `DATABASE_URL=${urlDe("evolli_app", SENHA_APP)}`,
  "apps/api/.env.migrate": `MIGRATE_DATABASE_URL=${urlDe("evolli_migrator", SENHA_MIGRATOR)}`,
  "infra/postgres/01_create_roles.sql": "-- cria papeis\n",
  "infra/postgres/02_schema_and_grants.sql": "-- schema\n",
  "infra/postgres/04_extensions.sql": "-- extensoes\n",
};

/**
 * Monta um ambiente falso completo. `opcoes` permite quebrar exatamente um
 * ponto por vez, que é como cada cenário abaixo é construído.
 */
function cenario(opcoes = {}) {
  const chamadas = [];
  const iniciados = [];
  const mortos = [];
  const urlsVerificadas = [];
  const logs = [];

  const arquivos = { ...ARQUIVOS_PADRAO, ...(opcoes.arquivos ?? {}) };
  const portasOcupadas = new Set(opcoes.portasOcupadas ?? []);
  const statusPorComando = opcoes.statusPorComando ?? (() => 0);
  const saidaPorComando = opcoes.saidaPorComando ?? (() => "");
  const httpOk = opcoes.httpOk ?? (() => true);

  const deps = {
    raiz: RAIZ,
    plataforma: opcoes.plataforma ?? "win32",
    ambiente: { PATH: "/usr/bin", ...(opcoes.ambiente ?? {}) },
    tentativas: opcoes.tentativas ?? 3,
    sha: "abc1234",
    lerArquivo: (relativo) => arquivos[relativo] ?? null,
    executar: (chamada) => {
      chamadas.push(chamada);
      const status = statusPorComando(chamada);
      return {
        status,
        saida:
          status === 0
            ? saidaPorComando(chamada)
            : `erro simulado; a senha ${SENHA_MIGRATOR} apareceu na saida`,
      };
    },
    iniciar: (spec) => {
      iniciados.push(spec);
      return {
        nome: spec.nome,
        matar: () => mortos.push(spec.nome),
      };
    },
    buscarHttp: async (url) => {
      urlsVerificadas.push(url);
      return httpOk(url) ? { ok: true, status: 200 } : null;
    },
    portaLivre: async (host, porta) => !portasOcupadas.has(porta),
    dormir: async () => {},
    registrar: (linha) => logs.push(linha),
  };

  return { deps, chamadas, iniciados, mortos, urlsVerificadas, logs };
}

/** Roda e devolve `{ resultado }` ou `{ erro }`, sem estourar o teste. */
async function executarCenario(c) {
  try {
    return { resultado: await subirAmbiente(c.deps) };
  } catch (erro) {
    return { erro };
  }
}

const ehPnpm = (ch, ...trechos) =>
  ch.comando === "pnpm" && trechos.every((t) => ch.args.includes(t));

// ---------------------------------------------------------------------------

test("executa os oito passos na ordem declarada", async () => {
  const c = cenario();
  const { resultado, erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  assert.deepEqual(resultado.passos, NOMES_PASSOS);
  assert.deepEqual(resultado.verificacoes, {
    banco: true,
    api: true,
    web: true,
  });
});

test("para no primeiro passo que falha e não segue adiante", async () => {
  const c = cenario({
    statusPorComando: (ch) => (ehPnpm(ch, "db:migrate:deploy") ? 1 : 0),
  });
  const { resultado, erro } = await executarCenario(c);

  assert.equal(resultado, undefined);
  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[3]);
  assert.deepEqual(c.deps.tentativas && erro.passo, NOMES_PASSOS[3]);
  // Nenhum servidor chegou a subir, e nada além do passo 4 foi executado.
  assert.deepEqual(c.iniciados, []);
  assert.ok(!c.chamadas.some((ch) => ehPnpm(ch, "demo-seed.cli.ts")));
});

test("falha depois da API encerra a API antes de propagar", async () => {
  const c = cenario({
    statusPorComando: (ch) => (ehPnpm(ch, "src/seed/demo-seed.cli.ts") ? 1 : 0),
  });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[5]);
  assert.deepEqual(
    c.iniciados.map((p) => p.nome),
    ["API"],
  );
  assert.deepEqual(c.mortos, ["API"]);
});

test("timeout da API: falha nomeada, sem web, sem órfão", async () => {
  const c = cenario({ httpOk: (url) => !url.includes("/v1/health/ready") });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[4]);
  assert.match(erro.message, /A API não respondeu/);
  assert.deepEqual(
    c.iniciados.map((p) => p.nome),
    ["API"],
  );
  assert.deepEqual(c.mortos, ["API"]);
});

test("timeout da web: falha nomeada e encerra API e web", async () => {
  const c = cenario({ httpOk: (url) => url.includes("/v1/health/ready") });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[6]);
  assert.match(erro.message, /interface web não respondeu/);
  assert.deepEqual(c.mortos, ["Web", "API"]);
});

test("porta da web ocupada falha no passo 1, antes de subir qualquer coisa", async () => {
  const c = cenario({ portasOcupadas: [PORTA_WEB] });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[0]);
  assert.match(erro.message, /5173 \(web\) já está ocupada/);
  assert.match(erro.proximoPasso, /demonstração anterior/);
  assert.deepEqual(c.iniciados, []);
});

test("porta da API ocupada também falha no passo 1", async () => {
  const c = cenario({ portasOcupadas: [3000] });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.match(erro.message, /3000 \(API\) já está ocupada/);
});

test("só verifica endereços em 127.0.0.1 e imprime o que verificou", async () => {
  const c = cenario();
  const { resultado } = await executarCenario(c);

  assert.ok(c.urlsVerificadas.length > 0);
  for (const url of c.urlsVerificadas) {
    assert.ok(
      url.startsWith(`http://${HOST_LOCAL}:`),
      `verificou endereço não local: ${url}`,
    );
  }
  assert.equal(resultado.urlApi, "http://127.0.0.1:3000");
  assert.equal(resultado.urlWeb, `http://127.0.0.1:${PORTA_WEB}`);
  // O endereço exibido é exatamente o verificado.
  const texto = resultado.resumo.join("\n");
  assert.ok(texto.includes(resultado.urlWeb));
  assert.ok(texto.includes(resultado.urlApi));
});

test("recusa banco fora da própria máquina", async () => {
  const c = cenario({
    arquivos: {
      "apps/api/.env":
        "DATABASE_URL=postgresql://evolli_app:x@db.homologacao.exemplo.com:5432/evolli?schema=app",
    },
  });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[0]);
  assert.match(erro.message, /não é local/);
  assert.deepEqual(c.iniciados, []);
});

test("recusa HOST externo herdado do shell", async () => {
  const c = cenario({ ambiente: { HOST: "0.0.0.0" } });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.match(erro.message, /HOST está definido como "0\.0\.0\.0"/);
  assert.deepEqual(c.iniciados, []);
});

test("força modo de demonstração e escuta local no processo da API", async () => {
  const c = cenario();
  await executarCenario(c);

  const api = c.iniciados.find((p) => p.nome === "API");
  assert.equal(api.env.EVOLLI_DEMO_MODE, "true");
  assert.equal(api.env.HOST, HOST_LOCAL);
  // A credencial de DDL nunca entra no processo da API (ADR 0002).
  assert.equal(api.env.MIGRATE_DATABASE_URL, undefined);
});

test("a credencial de DDL não vaza para a API nem quando está no shell", async () => {
  const c = cenario({
    ambiente: {
      MIGRATE_DATABASE_URL: urlDe("evolli_migrator", SENHA_MIGRATOR),
    },
  });
  await executarCenario(c);

  const api = c.iniciados.find((p) => p.nome === "API");
  assert.equal(api.env.MIGRATE_DATABASE_URL, undefined);
});

test("a web sobe presa a 127.0.0.1:5173 com porta estrita", async () => {
  const c = cenario();
  await executarCenario(c);

  const web = c.iniciados.find((p) => p.nome === "Web");
  assert.deepEqual(web.args, [
    "--filter",
    "@evolli/web",
    "exec",
    "vite",
    "--host",
    HOST_LOCAL,
    "--port",
    String(PORTA_WEB),
    "--strictPort",
  ]);
  assert.equal(web.env.VITE_API_PROXY_TARGET, "http://127.0.0.1:3000");
});

test("o resumo só existe depois de banco, API e web responderem", async () => {
  // Banco cai só na verificação final: os sete passos anteriores passaram.
  let jaSemeou = false;
  const c = cenario({
    statusPorComando: (ch) => {
      if (
        ch.comando === "pnpm" &&
        ch.args.includes("src/seed/demo-seed.cli.ts")
      ) {
        jaSemeou = true;
        return 0;
      }
      if (jaSemeou && ch.args.includes("pg_isready")) return 2;
      return 0;
    },
  });
  const { resultado, erro } = await executarCenario(c);

  assert.equal(resultado, undefined);
  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[7]);
  assert.match(erro.message, /não respondeu: banco/);
  // Nenhuma linha de "pronto" foi impressa antes da verificação.
  assert.ok(!c.logs.some((l) => l.includes("AMBIENTE LOCAL")));
  assert.deepEqual(c.mortos, ["Web", "API"]);
});

test("repetição é segura: duas execuções dão o mesmo resultado", async () => {
  const primeira = cenario();
  const segunda = cenario();
  const a = await executarCenario(primeira);
  const b = await executarCenario(segunda);

  assert.deepEqual(a.resultado.passos, b.resultado.passos);
  assert.deepEqual(a.resultado.resumo, b.resultado.resumo);
  assert.deepEqual(
    primeira.chamadas.map((ch) => [ch.comando, ch.args.join(" ")]),
    segunda.chamadas.map((ch) => [ch.comando, ch.args.join(" ")]),
  );
});

test("bootstrap que responde 'já existe' (código 3) não interrompe", async () => {
  const c = cenario({
    statusPorComando: (ch) =>
      ehPnpm(ch, "src/bootstrap/bootstrap-admin.ts")
        ? CODIGO_SAIDA_ADMIN_JA_EXISTE
        : 0,
  });
  const { resultado, erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  assert.deepEqual(resultado.passos, NOMES_PASSOS);
});

test("bootstrap com falha real (código 1) interrompe", async () => {
  const c = cenario({
    statusPorComando: (ch) =>
      ehPnpm(ch, "src/bootstrap/bootstrap-admin.ts") ? 1 : 0,
  });
  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[5]);
  assert.deepEqual(c.mortos, ["API"]);
});

test("caminho com espaço nunca vira argumento de linha de comando", async () => {
  const c = cenario();
  await executarCenario(c);

  const todos = [...c.chamadas, ...c.iniciados];
  for (const chamada of todos) {
    for (const arg of chamada.args) {
      assert.ok(
        !arg.includes(RAIZ),
        `a raiz com espaço foi parar em argv: ${arg}`,
      );
      if (chamada.shell) {
        assert.ok(
          !/\s/.test(arg),
          `argumento com espaço sob shell: ${JSON.stringify(arg)}`,
        );
      }
    }
  }
});

test("nenhum segredo aparece em argv, em log ou em saída de erro", async () => {
  const c = cenario({
    statusPorComando: (ch) => (ehPnpm(ch, "db:migrate:deploy") ? 1 : 0),
  });
  const { erro } = await executarCenario(c);

  const segredos = [SENHA_ADMIN, SENHA_APP, SENHA_MIGRATOR];
  const argv = [...c.chamadas, ...c.iniciados].flatMap((ch) => ch.args);

  for (const segredo of segredos) {
    for (const arg of argv) {
      assert.ok(!arg.includes(segredo), `segredo em argv: ${arg}`);
    }
    for (const linha of c.logs) {
      assert.ok(!linha.includes(segredo), `segredo em log: ${linha}`);
    }
    // A saída do comando que falhou trazia a senha de propósito: a mensagem
    // final precisa tê-la censurado.
    assert.ok(!erro.message.includes(segredo), "segredo na mensagem de erro");
  }
  assert.match(erro.message, /\*\*\*/);
});

test("as senhas dos papéis chegam ao psql por stdin, não por argumento", async () => {
  const c = cenario();
  await executarCenario(c);

  const psql = c.chamadas.filter((ch) => ch.args.includes("psql"));
  assert.equal(psql.length, 3);

  const primeiro = psql[0];
  assert.equal(primeiro.shell, false, "docker roda sem shell");
  assert.ok(primeiro.entrada.includes("\\set migrator_password"));
  assert.ok(primeiro.entrada.includes("\\set app_password"));
  assert.ok(primeiro.entrada.includes("-- cria papeis"));
  assert.ok(primeiro.args.includes("-w"), "psql nunca pode pedir senha");
  // Os outros dois scripts não recebem prelúdio de senha.
  assert.ok(!psql[1].entrada.includes("\\set app_password"));
  assert.ok(!psql[2].entrada.includes("\\set app_password"));
});

test("senha do papel vem do ambiente quando definida, senão da própria URL", () => {
  assert.equal(
    senhaDoPapel("do-ambiente", urlDe("evolli_app", SENHA_APP)),
    "do-ambiente",
  );
  assert.equal(
    senhaDoPapel(undefined, urlDe("evolli_app", SENHA_APP)),
    SENHA_APP,
  );
  assert.equal(senhaDoPapel(undefined, "nao-e-url"), "");
});

test("literal do psql escapa aspas e barra invertida", () => {
  assert.equal(comoLiteralPsql("sen'ha"), "'sen''ha'");
  assert.equal(comoLiteralPsql("sen\\ha"), "'sen\\\\ha'");
  assert.equal(comoLiteralPsql("a&b^c%d e"), "'a&b^c%d e'");
});

test("censurar troca todo segredo conhecido", () => {
  assert.equal(censurar("x abc y abc", ["abc"]), "x *** y ***");
  assert.equal(censurar("nada", [""]), "nada");
});

test("lerEnv aceita CRLF, aspas e valor com caracteres especiais", () => {
  const mapa = lerEnv('A=1\r\nB="dois tres"\r\nC=a&b^c%d\r\n# comentario\n');
  assert.deepEqual(mapa, { A: "1", B: "dois tres", C: "a&b^c%d" });
});

test("fora do Windows nenhum comando usa shell", async () => {
  const c = cenario({ plataforma: "linux" });
  await executarCenario(c);

  for (const chamada of [...c.chamadas, ...c.iniciados]) {
    assert.equal(chamada.shell, false);
  }
});

test("a saída do seed é ecoada para virar evidência, já censurada", async () => {
  const c = cenario({
    saidaPorComando: (ch) =>
      ch.args.includes("src/seed/demo-seed.cli.ts")
        ? `Seed concluido.
  criados agora ..... 17
  senha ${SENHA_APP}
`
        : "",
  });
  const { erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  const texto = c.logs.join("\n");
  assert.match(texto, /criados agora \.+ 17/);
  assert.ok(!texto.includes(SENHA_APP), "a senha vazou para a tela");
  assert.match(texto, /\*\*\*/);
});

test("a migration não recebe a credencial de runtime (ADR 0002)", async () => {
  const c = cenario();
  await executarCenario(c);

  const migration = c.chamadas.find((ch) =>
    ch.args.includes("db:migrate:deploy"),
  );
  assert.ok(migration, "o passo de migration não rodou");
  // A conexão do evolli_app nunca entra no processo que executa DDL.
  assert.equal(migration.env.DATABASE_URL, DESTINO_INALCANCAVEL);
  assert.ok(!migration.env.DATABASE_URL.includes("evolli_app"));
  assert.ok(migration.env.MIGRATE_DATABASE_URL.includes("evolli_migrator"));
  // E a credencial de DDL, por sua vez, nunca entra no processo da API.
  const api = c.iniciados.find((p) => p.nome === "API");
  assert.equal(api.env.MIGRATE_DATABASE_URL, undefined);
  assert.ok(api.env.DATABASE_URL.includes("evolli_app"));
});
