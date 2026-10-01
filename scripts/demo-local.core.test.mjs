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
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CODIGO_SAIDA_ADMIN_JA_EXISTE,
  DESTINO_INALCANCAVEL,
  DIRETORIO_API,
  SEGUNDOS_ESPERA_API,
  SEGUNDOS_ESPERA_WEB,
  SEGUNDOS_CONFIRMACAO_FINAL_WEB,
  MS_TIMEOUT_TENTATIVA_HTTP,
  MS_INTERVALO_TENTATIVA,
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
  const timeoutsPedidos = [];

  const arquivos = { ...ARQUIVOS_PADRAO, ...(opcoes.arquivos ?? {}) };
  const portasOcupadas = new Set(opcoes.portasOcupadas ?? []);
  const statusPorComando = opcoes.statusPorComando ?? (() => 0);
  const saidaPorComando = opcoes.saidaPorComando ?? (() => "");
  const httpOk = opcoes.httpOk ?? (() => true);
  /**
   * Quanto tempo CADA tentativa HTTP consome, em ms. Os prazos passaram a ser
   * de parede (T145), então o custo da requisição precisa entrar no relógio —
   * é o que permite provar que uma janela curta não se multiplica pelo timeout
   * individual. O orquestrador encurta o prazo perto do fim, e a tentativa
   * nunca gasta mais do que o prazo que recebeu.
   */
  const custoHttpMs = opcoes.custoHttpMs ?? 0;

  // Relógio falso: nada dorme de verdade, o tempo só anda quando o código sob
  // teste diz que andou. Sem isto, um prazo de parede ou girava sem fim (com
  // `dormir` instantâneo) ou dependeria do relógio da máquina.
  const relogio = { ms: 0 };
  const avancar = (ms) => {
    relogio.ms += ms;
  };

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
    buscarHttp: async (url, timeoutMs) => {
      urlsVerificadas.push(url);
      timeoutsPedidos.push(timeoutMs);
      // Uma tentativa nunca gasta mais do que o prazo que recebeu.
      avancar(Math.min(custoHttpMs, timeoutMs ?? custoHttpMs));
      return httpOk(url) ? { ok: true, status: 200 } : null;
    },
    portaLivre: async (host, porta) => !portasOcupadas.has(porta),
    dormir: async (ms) => avancar(ms ?? 0),
    agora: () => relogio.ms,
    registrar: (linha) => logs.push(linha),
  };

  return {
    deps,
    chamadas,
    iniciados,
    mortos,
    urlsVerificadas,
    timeoutsPedidos,
    logs,
    relogio,
    avancar,
  };
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

// ---------------------------------------------------------------------------
// Subprocesso REAL: o mock de executor não enxerga este defeito
// ---------------------------------------------------------------------------

const RAIZ_REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const COM_SHELL = process.platform === "win32";

/** Roda pnpm de verdade e devolve o código de saída que chegou ao pai. */
function codigoDeSaida(args, cwd) {
  const r = spawnSync("pnpm", args, {
    cwd,
    shell: COM_SHELL,
    stdio: "ignore",
    timeout: 120_000,
  });
  return r.status;
}

test("a invocação do bootstrap preserva o código de saída do filho", () => {
  // O bootstrap sinaliza "já existe um administrador" com o código 3, e o
  // orquestrador precisa distinguir isso de falha real. Rodando DENTRO do
  // pacote, sem a camada recursiva, o código chega intacto.
  const codigo = codigoDeSaida(
    ["exec", "node", "-e", `process.exit(${CODIGO_SAIDA_ADMIN_JA_EXISTE})`],
    join(RAIZ_REPO, DIRETORIO_API),
  );

  assert.equal(
    codigo,
    CODIGO_SAIDA_ADMIN_JA_EXISTE,
    "a invocação escolhida precisa propagar o código real do filho",
  );
});

test("a forma antiga (--filter ... exec) perderia esse código", () => {
  // Controle negativo, e a razão de a invocação ter mudado: o exec recursivo
  // do pnpm normaliza qualquer falha do filho (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL),
  // apagando o 3 e fazendo toda reexecução do ambiente abortar no passo 6/8.
  const codigo = codigoDeSaida(
    [
      "--filter",
      "@evolli/api",
      "exec",
      "node",
      "-e",
      `process.exit(${CODIGO_SAIDA_ADMIN_JA_EXISTE})`,
    ],
    RAIZ_REPO,
  );

  assert.notEqual(
    codigo,
    CODIGO_SAIDA_ADMIN_JA_EXISTE,
    "se o pnpm passar a propagar o código, esta ressalva pode ser revista",
  );
});

test("o bootstrap é invocado dentro do pacote, sem exec recursivo", async () => {
  const c = cenario();
  await executarCenario(c);

  const boot = c.chamadas.find((ch) =>
    ch.args.includes("src/bootstrap/bootstrap-admin.ts"),
  );
  assert.ok(boot, "o passo de bootstrap não rodou");
  assert.equal(boot.cwd, DIRETORIO_API);
  assert.ok(!boot.args.includes("--filter"), "não pode usar exec recursivo");
  assert.deepEqual(boot.args.slice(0, 2), ["exec", "ts-node"]);
});

test("só o código dedicado deixa o bootstrap seguir; outros interrompem", async () => {
  for (const codigo of [1, 2, 4, 127]) {
    const c = cenario({
      statusPorComando: (ch) =>
        ch.args.includes("src/bootstrap/bootstrap-admin.ts") ? codigo : 0,
    });
    const { erro, resultado } = await executarCenario(c);
    assert.equal(resultado, undefined, `código ${codigo} deveria interromper`);
    assert.ok(erro instanceof FalhaDePasso);
    assert.equal(erro.passo, NOMES_PASSOS[5]);
  }
});

test("a espera termina assim que o processo morre, sem gastar o orçamento", async () => {
  let ticks = 0;
  const c = cenario({ httpOk: () => false });
  // A API sobe e morre logo em seguida; a espera não pode ficar batendo.
  const iniciarOriginal = c.deps.iniciar;
  c.deps.iniciar = (spec) => {
    const p = iniciarOriginal(spec);
    return { ...p, vivo: () => false, matar: p.matar };
  };
  c.deps.dormir = async (ms) => {
    ticks += 1;
    c.avancar(ms ?? 0);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[4]);
  assert.match(erro.message, /O processo de A API encerrou/);
  assert.ok(
    ticks < 5,
    `esperou demais para um processo morto (${ticks} ticks)`,
  );
});

test("os orçamentos de espera são finitos e generosos com a subida fria", async () => {
  let esperasApi = 0;
  const c = cenario({ httpOk: (url) => !url.includes("/v1/health/ready") });
  c.deps.dormir = async (ms) => {
    esperasApi += 1;
    c.avancar(ms ?? 0);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.match(erro.message, new RegExp(`dentro de ${SEGUNDOS_ESPERA_API}s`));
  assert.equal(esperasApi, SEGUNDOS_ESPERA_API);
  assert.ok(Number.isFinite(SEGUNDOS_ESPERA_API));
  assert.ok(Number.isFinite(SEGUNDOS_ESPERA_WEB));
  assert.ok(SEGUNDOS_ESPERA_API > 60, "precisa cobrir a compilação fria");
});

// ---------------------------------------------------------------------------
// T144 (hardening): confirmação final (8/8) tolerante a Vite frio, com
// polling LIMITADO e falha imediata se o processo morrer no meio dela.
// ---------------------------------------------------------------------------

test("a confirmação final tolera o Vite frio: responde depois de algumas tentativas, dentro do limite", async () => {
  let chamadasWeb = 0;
  let ticks = 0;
  const c = cenario({
    httpOk: (url) => {
      if (!url.includes(`:${PORTA_WEB}`)) return true; // API sempre pronta
      chamadasWeb += 1;
      // 1ª chamada é o passo 7/8 (esperar): responde de cara. As duas
      // seguintes são a confirmação final (8/8): falham, simulando o Vite
      // ainda terminando a 1ª compilação a frio; a 4ª chamada responde.
      return chamadasWeb === 1 || chamadasWeb >= 4;
    },
  });
  c.deps.dormir = async (ms) => {
    ticks += 1;
    c.avancar(ms ?? 0);
  };

  const { resultado, erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  assert.equal(resultado.verificacoes.web, true);
  // 2 tentativas falhas na confirmação final = 2 esperas de 1s, nunca o
  // orçamento inteiro de SEGUNDOS_CONFIRMACAO_FINAL_WEB.
  assert.equal(ticks, 2);
  assert.ok(
    ticks < SEGUNDOS_CONFIRMACAO_FINAL_WEB,
    `poliu além da tolerância (${ticks} ticks)`,
  );
});

test("a confirmação final falha quando a tolerância se esgota sem resposta", async () => {
  let ticks = 0;
  const c = cenario({
    // A web responde no passo 7/8 (primeira chamada) e nunca mais, na
    // confirmação final — sem morte de processo, só ausência de resposta.
    httpOk: (() => {
      let chamadasWeb = 0;
      return (url) => {
        if (!url.includes(`:${PORTA_WEB}`)) return true;
        chamadasWeb += 1;
        return chamadasWeb === 1;
      };
    })(),
  });
  c.deps.dormir = async (ms) => {
    ticks += 1;
    c.avancar(ms ?? 0);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[7]);
  assert.match(erro.message, /Na verificação final não respondeu: web/);
  // O prazo é de PAREDE (T145): o laço consome exatamente a janela declarada,
  // em intervalos de 1s. Antes da T145 eram 9 ticks porque o laço contava 10
  // VOLTAS e pulava o último intervalo — e, com tentativas lentas, a janela
  // "de 10s" chegava a 39s reais. Agora são 10 intervalos de 1s que somam
  // exatamente os 10s anunciados.
  assert.equal(ticks, SEGUNDOS_CONFIRMACAO_FINAL_WEB);
  assert.equal(c.relogio.ms, SEGUNDOS_CONFIRMACAO_FINAL_WEB * 1000);
  // Falha no 8/8 encerra os processos antes de propagar: sem residual.
  assert.deepEqual(c.mortos, ["Web", "API"]);
});

test("web encerra durante a confirmação final: falha NA HORA, sem esgotar a tolerância", async () => {
  let estaVivo = true;
  let chamadasWeb = 0;
  let ticks = 0;
  const c = cenario({
    httpOk: (url) => {
      if (!url.includes(`:${PORTA_WEB}`)) return true;
      chamadasWeb += 1;
      if (chamadasWeb === 1) return true; // passo 7/8 ok
      estaVivo = false; // "morre" assim que a confirmação final começa
      return false;
    },
  });
  const iniciarOriginal = c.deps.iniciar;
  c.deps.iniciar = (spec) => {
    const p = iniciarOriginal(spec);
    if (spec.nome !== "Web") return p;
    return { ...p, vivo: () => estaVivo, matar: p.matar };
  };
  c.deps.dormir = async (ms) => {
    ticks += 1;
    c.avancar(ms ?? 0);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[7]);
  assert.match(
    erro.message,
    /processo de A interface web encerrou antes da confirmação final/,
  );
  // Falhou na primeira checagem de vida: nenhuma espera consumida.
  assert.equal(ticks, 0, `não deveria esperar após a morte (${ticks} ticks)`);
  // Nenhum processo residual: tudo que subiu foi encerrado, nesta ordem.
  assert.deepEqual(c.mortos, ["Web", "API"]);
});

test("sucesso não mata nenhum processo e devolve exatamente os que subiram, sem residual", async () => {
  const c = cenario();
  const { resultado, erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  // Sucesso devolve os processos vivos para o chamador gerenciar — não há
  // "terceiro" processo nem limpeza automática aqui.
  assert.deepEqual(
    resultado.processos.map((p) => p.nome),
    ["API", "Web"],
  );
  assert.deepEqual(c.mortos, [], "nada deveria ter sido encerrado num sucesso");
});

// ---------------------------------------------------------------------------
// T145 — prazo de PAREDE. O orçamento declarado em segundos é tempo real:
// inclui o que a requisição gasta e o que os intervalos gastam. Antes, o laço
// contava voltas, e uma janela "de 10s" com tentativas de 3s levava 39s.
// O relógio aqui é falso e só anda quando o código sob teste o faz andar.
// ---------------------------------------------------------------------------

test("prazo de parede: uma janela curta NÃO se multiplica pelo timeout individual", async () => {
  // Cada tentativa HTTP custa o timeout individual inteiro (3s) e a web nunca
  // responde na confirmação final. Com o laço antigo, 10 voltas x (3s + 1s)
  // dariam 39s reais para uma janela anunciada de 10s.
  const c = cenario({
    custoHttpMs: MS_TIMEOUT_TENTATIVA_HTTP,
    httpOk: (() => {
      let chamadasWeb = 0;
      return (url) => {
        if (!url.includes(`:${PORTA_WEB}`)) return true;
        chamadasWeb += 1;
        return chamadasWeb === 1; // só o passo 7/8 responde
      };
    })(),
  });

  // Relógio no INÍCIO de cada requisição à web. A 1ª é o passo 7/8; a 2ª é a
  // primeira da confirmação final, e é dela que a janela de 10s começa a
  // contar. (Sentinela `null`, não `0`: o relógio começa em zero.)
  const inicioDeCadaWeb = [];
  const buscarOriginal = c.deps.buscarHttp;
  c.deps.buscarHttp = async (url, timeoutMs) => {
    if (url.includes(`:${PORTA_WEB}`)) inicioDeCadaWeb.push(c.relogio.ms);
    return buscarOriginal(url, timeoutMs);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[7]);
  const inicioDaConfirmacao = inicioDeCadaWeb[1];
  assert.ok(
    inicioDaConfirmacao !== undefined,
    "a confirmação final nem chegou a tentar",
  );
  const gastoNaConfirmacao = c.relogio.ms - inicioDaConfirmacao;
  assert.equal(
    gastoNaConfirmacao,
    SEGUNDOS_CONFIRMACAO_FINAL_WEB * 1000,
    `a janela de ${SEGUNDOS_CONFIRMACAO_FINAL_WEB}s virou ${gastoNaConfirmacao}ms`,
  );
  // Contando VOLTAS, como antes da T145, o mesmo cenário gastaria
  // N x (timeout da tentativa) + (N-1) x intervalo — bem mais que a janela.
  const tetoAntigoContandoVoltas =
    SEGUNDOS_CONFIRMACAO_FINAL_WEB * MS_TIMEOUT_TENTATIVA_HTTP +
    (SEGUNDOS_CONFIRMACAO_FINAL_WEB - 1) * MS_INTERVALO_TENTATIVA;
  assert.ok(
    gastoNaConfirmacao < tetoAntigoContandoVoltas,
    "voltou a contar voltas em vez de tempo",
  );
});

test("prazo de parede: a última tentativa é ENCURTADA para não estourar o orçamento", async () => {
  const c = cenario({
    custoHttpMs: MS_TIMEOUT_TENTATIVA_HTTP,
    httpOk: (() => {
      let chamadasWeb = 0;
      return (url) => {
        if (!url.includes(`:${PORTA_WEB}`)) return true;
        chamadasWeb += 1;
        return chamadasWeb === 1;
      };
    })(),
  });

  await executarCenario(c);

  // Com tentativas de 3s e intervalos de 1s, a janela cabe um número inteiro
  // de ciclos de 4s mais uma sobra — e é essa sobra que a última tentativa
  // recebe, em vez do timeout cheio.
  const janelaMs = SEGUNDOS_CONFIRMACAO_FINAL_WEB * 1000;
  const porCiclo = MS_TIMEOUT_TENTATIVA_HTTP + MS_INTERVALO_TENTATIVA;
  const cheias = Math.floor(janelaMs / porCiclo);
  const daConfirmacao = c.timeoutsPedidos.slice(-(cheias + 1));

  assert.deepEqual(
    daConfirmacao.slice(0, cheias),
    Array(cheias).fill(MS_TIMEOUT_TENTATIVA_HTTP),
    "as tentativas com orçamento folgado pedem o timeout cheio",
  );
  const ultimo = daConfirmacao[cheias];
  assert.ok(
    ultimo < MS_TIMEOUT_TENTATIVA_HTTP && ultimo > 0,
    `a última tentativa deveria ser encurtada; pediu ${ultimo}ms`,
  );
  assert.ok(
    c.timeoutsPedidos.every((t) => t <= MS_TIMEOUT_TENTATIVA_HTTP),
    "nenhuma tentativa pode pedir mais que o timeout individual",
  );
});

test("prazo de parede: relógio parado não vira espera infinita", async () => {
  // Um `agora` que nunca anda é defeito de quem injeta (teste mal montado,
  // ambiente exótico). O laço precisa terminar assim mesmo, em vez de pendurar
  // a suíte — foi o que aconteceu durante o desenvolvimento da T145.
  const c = cenario({ httpOk: (url) => !url.includes("/v1/health/ready") });
  c.deps.agora = () => 0;
  c.deps.dormir = async () => {};

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[4]);
  assert.match(erro.message, new RegExp(`dentro de ${SEGUNDOS_ESPERA_API}s`));
  // Terminou pelo teto de voltas, não pelo relógio: número finito e próximo
  // do orçamento declarado, nunca um laço eterno.
  const tentativasApi = c.urlsVerificadas.filter((u) =>
    u.includes("/v1/health/ready"),
  ).length;
  assert.ok(
    tentativasApi <= SEGUNDOS_ESPERA_API + 2,
    `teto não segurou: ${tentativasApi} tentativas`,
  );
  assert.deepEqual(c.mortos, ["API"], "sem processo residual");
});

test("prazo de parede: resposta dentro do prazo encerra sem consumir o orçamento", async () => {
  const c = cenario({ custoHttpMs: 250 });
  const { resultado, erro } = await executarCenario(c);

  assert.equal(erro, undefined);
  assert.equal(resultado.verificacoes.web, true);
  // Tudo respondeu de primeira: o relógio mal andou, muito longe de qualquer
  // um dos orçamentos (o menor deles é a confirmação final, 10s).
  assert.ok(
    c.relogio.ms < SEGUNDOS_CONFIRMACAO_FINAL_WEB * 1000,
    `gastou ${c.relogio.ms}ms sem precisar`,
  );
});

test("prazo de parede: requisição lenta consome o orçamento global da API", async () => {
  // A API nunca responde e cada tentativa custa o timeout inteiro.
  const c = cenario({
    custoHttpMs: MS_TIMEOUT_TENTATIVA_HTTP,
    httpOk: (url) => !url.includes("/v1/health/ready"),
  });

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(erro.passo, NOMES_PASSOS[4]);
  assert.match(erro.message, new RegExp(`dentro de ${SEGUNDOS_ESPERA_API}s`));
  // O prazo anunciado na mensagem é o prazo realmente gasto.
  assert.equal(c.relogio.ms, SEGUNDOS_ESPERA_API * 1000);
  // Com requisições lentas cabem menos tentativas no mesmo prazo — é o
  // orçamento que manda, não um número fixo de voltas.
  const tentativasApi = c.urlsVerificadas.filter((u) =>
    u.includes("/v1/health/ready"),
  ).length;
  assert.ok(
    tentativasApi < SEGUNDOS_ESPERA_API,
    `requisição lenta deveria caber menos vezes; coube ${tentativasApi}`,
  );
});

test("prazo de parede: nenhuma tentativa nem espera depois do prazo esgotado", async () => {
  const c = cenario({
    custoHttpMs: MS_TIMEOUT_TENTATIVA_HTTP,
    httpOk: (url) => !url.includes("/v1/health/ready"),
  });

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  // Nada foi verificado depois do instante do prazo: o relógio parou nele.
  assert.equal(c.relogio.ms, SEGUNDOS_ESPERA_API * 1000);
  // E a web nunca chegou a subir, porque o passo 5/8 falhou antes.
  assert.deepEqual(
    c.iniciados.map((p) => p.nome),
    ["API"],
  );
  assert.deepEqual(c.mortos, ["API"], "sem processo residual");
});

test("prazo de parede: processo morto encerra a espera sem gastar o orçamento", async () => {
  const c = cenario({
    custoHttpMs: MS_TIMEOUT_TENTATIVA_HTTP,
    httpOk: (url) => !url.includes("/v1/health/ready"),
  });
  const iniciarOriginal = c.deps.iniciar;
  c.deps.iniciar = (spec) => {
    const p = iniciarOriginal(spec);
    return { ...p, vivo: () => false, matar: p.matar };
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.match(erro.message, /O processo de A API encerrou/);
  // Uma única tentativa (3s) e nenhum intervalo: muito longe dos 180s.
  assert.equal(c.relogio.ms, MS_TIMEOUT_TENTATIVA_HTTP);
  assert.ok(c.relogio.ms < SEGUNDOS_ESPERA_API * 1000);
  assert.deepEqual(c.mortos, ["API"], "sem processo residual");
});

test("prazo de parede: o intervalo entre tentativas também sai do orçamento", async () => {
  // Requisição instantânea: o orçamento é consumido só pelos intervalos, e o
  // número de intervalos é exatamente o orçamento dividido pelo intervalo.
  const c = cenario({ httpOk: (url) => !url.includes("/v1/health/ready") });
  let intervalos = 0;
  const dormirOriginal = c.deps.dormir;
  c.deps.dormir = async (ms) => {
    intervalos += 1;
    assert.ok(
      ms <= MS_INTERVALO_TENTATIVA,
      `intervalo não pode passar de ${MS_INTERVALO_TENTATIVA}ms; veio ${ms}`,
    );
    return dormirOriginal(ms);
  };

  const { erro } = await executarCenario(c);

  assert.ok(erro instanceof FalhaDePasso);
  assert.equal(c.relogio.ms, SEGUNDOS_ESPERA_API * 1000);
  assert.equal(
    intervalos,
    (SEGUNDOS_ESPERA_API * 1000) / MS_INTERVALO_TENTATIVA,
  );
});
