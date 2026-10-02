/**
 * Máquina de estados do encerramento do subprocesso com prazo (T145).
 *
 * O caso que estes testes cobrem — o sistema operacional não matar o processo
 * — é impossível de fabricar de propósito e perigoso de tentar: um processo
 * realmente imatável penduraria o runner. Por isso `executarComPrazo` recebe
 * `matar` e `criar` injetáveis, e aqui tudo é simulado: nenhum processo real
 * nasce, nenhum sinal real é enviado.
 *
 * As fases provadas:
 *   1. prazo expira            → pede o encerramento (SIGTERM)
 *   2. 1ª carência sem `close` → repete forçado (SIGKILL)
 *   3. 2ª carência sem `close` → desiste de confirmar, sem travar
 */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  executarComPrazo,
  matarArvore,
  MS_CARENCIA_ENCERRAMENTO,
  MS_CARENCIA_TOTAL,
} from "./demo-local.mjs";

/**
 * Todo teste tem teto externo: nenhum pode pendurar o runner.
 *
 * O temporizador do teto NÃO é `unref`, e isso é deliberado. Num cenário real
 * é o handle do processo filho que mantém o event loop vivo enquanto o prazo
 * corre; aqui o filho é um `EventEmitter` e não segura nada, então sem um
 * temporizador referenciado o Node concluiria que não há mais trabalho e o
 * runner cancelaria o teste com "event loop has already resolved" — foi o que
 * aconteceu no Linux da CI. Ele é sempre limpo no `finally`, então não segura
 * a suíte depois que o teste termina.
 */
const TETO_EXTERNO_MS = 15_000;
function comTeto(promessa, rotulo) {
  let cronometro;
  const teto = new Promise((_, rejeitar) => {
    cronometro = setTimeout(
      () => rejeitar(new Error(`PENDUROU: ${rotulo}`)),
      TETO_EXTERNO_MS,
    );
  });
  return Promise.race([promessa, teto]).finally(() => clearTimeout(cronometro));
}

/** Fluxo falso que registra se foi destruído, como um pipe de verdade. */
function fluxoFalso() {
  const f = new EventEmitter();
  f.destruido = false;
  f.destroy = () => {
    f.destruido = true;
  };
  return f;
}

/**
 * Filho falso. `morrerApos` diz em qual tentativa de kill ele emite `close`
 * (1 = na primeira, 2 = só na segunda, `Infinity` = nunca).
 */
function filhoFalso({ pid = 4242 } = {}) {
  const filho = new EventEmitter();
  filho.pid = pid;
  filho.stdout = fluxoFalso();
  filho.stderr = fluxoFalso();
  filho.stdin = fluxoFalso();
  filho.desreferenciado = false;
  filho.unref = () => {
    filho.desreferenciado = true;
  };
  return filho;
}

function cenarioEncerramento({ morrerApos = Infinity, pid = 4242 } = {}) {
  const filho = filhoFalso({ pid });
  const kills = [];
  const matar = (alvo, sinal) => {
    kills.push({ pid: alvo.pid, sinal });
    if (kills.length >= morrerApos) {
      setImmediate(() => filho.emit("close", null));
    }
    return true;
  };
  return { filho, kills, matar, criar: () => filho };
}

const rodar = (c, timeoutMs = 20) =>
  comTeto(
    executarComPrazo({
      comando: "falso",
      args: [],
      shell: false,
      timeoutMs,
      matar: c.matar,
      criar: c.criar,
    }),
    "executarComPrazo",
  );

// ---------------------------------------------------------------------------

test("encerramento: kill funciona e `close` chega na primeira carência", async () => {
  const c = cenarioEncerramento({ morrerApos: 1 });
  const r = await rodar(c);

  assert.equal(r.expirou, true);
  assert.equal(r.encerramentoConfirmado, true);
  assert.equal(r.motivo, "expirado");
  assert.equal(r.status, 1, "expiração nunca pode virar sucesso");
  assert.deepEqual(
    c.kills.map((k) => k.sinal),
    ["SIGTERM"],
    "bastou o pedido; não deveria escalar",
  );
});

test("encerramento: 1ª tentativa não funciona, a 2ª funciona", async () => {
  const c = cenarioEncerramento({ morrerApos: 2 });
  const r = await rodar(c);

  assert.equal(r.encerramentoConfirmado, true);
  assert.equal(r.motivo, "expirado");
  assert.deepEqual(
    c.kills.map((k) => k.sinal),
    ["SIGTERM", "SIGKILL"],
    "deveria escalar para o forçado antes de desistir",
  );
});

test("encerramento: nenhum kill funciona e a Promise termina após a carência total", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  const inicio = Date.now();
  const r = await rodar(c, 20);
  const duracao = Date.now() - inicio;

  assert.equal(r.expirou, true);
  assert.equal(r.encerramentoConfirmado, false);
  assert.equal(r.motivo, "expirado_sem_confirmacao");
  assert.equal(r.status, 1, "não confirmado NUNCA é sucesso");
  assert.deepEqual(
    c.kills.map((k) => k.sinal),
    ["SIGTERM", "SIGKILL"],
  );
  // Terminou, e dentro da carência declarada (com folga para a máquina).
  assert.ok(duracao >= MS_CARENCIA_TOTAL, `desistiu cedo demais: ${duracao}ms`);
  assert.ok(
    duracao < MS_CARENCIA_TOTAL + 10_000,
    `demorou muito além da carência: ${duracao}ms`,
  );
});

test("encerramento: ao desistir, solta os pipes e desreferencia o filho", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  await rodar(c);

  // Sem isto, o handle do processo e os pipes manteriam o Node vivo mesmo
  // depois de a Promise resolver.
  assert.equal(c.filho.stdout.destruido, true, "stdout deveria ser destruído");
  assert.equal(c.filho.stderr.destruido, true, "stderr deveria ser destruído");
  assert.equal(c.filho.stdin.destruido, true, "stdin deveria ser destruído");
  assert.equal(c.filho.desreferenciado, true, "o filho deveria ser unref");
});

test("encerramento: listeners são removidos ao terminar", async () => {
  const c = cenarioEncerramento({ morrerApos: 1 });
  await rodar(c);

  for (const evento of ["close", "error"]) {
    assert.equal(
      c.filho.listenerCount(evento),
      0,
      `sobrou listener de "${evento}"`,
    );
  }
  for (const fluxo of ["stdout", "stderr"]) {
    assert.equal(
      c.filho[fluxo].listenerCount("data"),
      0,
      `sobrou listener de data em ${fluxo}`,
    );
  }
});

test("encerramento: `close` tardio depois da desistência não produz segundo settle", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  const r = await rodar(c, 20);
  assert.equal(r.encerramentoConfirmado, false);

  // O processo "morre" tarde, depois de a Promise já ter resolvido.
  c.filho.emit("close", 0);
  await new Promise((s) => setTimeout(s, 30));
  // Se houvesse segundo settle, o valor resolvido mudaria — não muda.
  assert.equal(r.motivo, "expirado_sem_confirmacao");
  assert.equal(r.status, 1);
});

test("encerramento: caminho normal não chama kill nenhum", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  const promessa = rodar(c, 10_000);
  setImmediate(() => c.filho.emit("close", 0));
  const r = await promessa;

  assert.equal(r.status, 0);
  assert.equal(r.expirou, false);
  assert.equal(r.motivo, "normal");
  assert.equal(r.encerramentoConfirmado, true);
  assert.deepEqual(c.kills, [], "não deveria matar nada no caminho normal");
});

test("encerramento: corrida `error` + `close` dá settle único", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  const promessa = rodar(c, 10_000);
  setImmediate(() => {
    c.filho.emit("error", new Error("ENOENT simulado"));
    c.filho.emit("close", -4058); // o Node emite os dois num spawn falho
  });
  const r = await promessa;

  assert.equal(r.status, 127);
  assert.equal(r.motivo, "falha_ao_iniciar");
  assert.match(r.saida, /ENOENT simulado/);
});

test("encerramento: corrida `close` imediatamente antes do prazo", async () => {
  const c = cenarioEncerramento({ morrerApos: Infinity });
  const promessa = rodar(c, 25);
  setTimeout(() => c.filho.emit("close", 0), 1);
  const r = await promessa;

  assert.equal(r.expirou, false);
  assert.equal(r.motivo, "normal");
  assert.deepEqual(c.kills, []);
});

test("encerramento: `spawn` que lança sincronamente vira falha identificada", async () => {
  const r = await comTeto(
    executarComPrazo({
      comando: "falso",
      args: [],
      shell: false,
      timeoutMs: 1000,
      criar: () => {
        throw new Error("opção inválida simulada");
      },
    }),
    "spawn síncrono",
  );

  assert.equal(r.status, 127);
  assert.equal(r.motivo, "falha_ao_iniciar");
  assert.equal(r.encerramentoConfirmado, true);
  assert.equal(r.expirou, false);
  assert.match(r.saida, /opção inválida simulada/);
});

test("encerramento: prazo não finito, zero ou negativo não cria comportamento indefinido", async () => {
  for (const prazo of [
    0,
    -5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    undefined,
  ]) {
    const c = cenarioEncerramento({ morrerApos: 1 });
    const r = await rodar(c, prazo);
    assert.equal(r.expirou, true, `prazo ${String(prazo)} deveria expirar já`);
    assert.equal(r.status, 1);
    assert.equal(r.encerramentoConfirmado, true);
  }
});

// ---------------------------------------------------------------------------
// Segurança do PID: um sinal para `0` em POSIX atinge o PRÓPRIO grupo, e um
// negativo, um grupo arbitrário. Nenhum dos dois pode sair daqui.
// ---------------------------------------------------------------------------

test("matarArvore: PID ausente, zero, negativo ou inválido nunca é sinalizado", () => {
  for (const pid of [undefined, null, 0, -1, -4242, 1.5, Number.NaN, "123"]) {
    const filho = {
      pid,
      kill: () => assert.fail(`sinalizou um PID inválido: ${String(pid)}`),
    };
    assert.equal(
      matarArvore(filho, "SIGTERM"),
      false,
      `PID ${String(pid)} deveria ser recusado`,
    );
  }
  assert.equal(matarArvore(undefined), false, "sem filho, sem sinal");
  assert.equal(matarArvore({}), false, "sem pid, sem sinal");
});

test("matarArvore: chamadas repetidas são idempotentes", () => {
  // De propósito NÃO se usa um PID numérico "provavelmente livre" aqui: em
  // POSIX a primeira via é `process.kill(-pid)`, e um palpite que por acaso
  // exista sinalizaria o grupo de processos de outra pessoa na máquina de CI.
  // A idempotência é exercida pela via que nunca chega ao sistema operacional.
  const invalido = { pid: 0, kill: () => assert.fail("não deveria sinalizar") };
  for (let i = 0; i < 3; i += 1) {
    assert.equal(
      matarArvore(invalido, "SIGTERM"),
      false,
      "repetir não pode lançar nem mudar o resultado",
    );
  }
  // A via que chega ao SO é coberta pelos testes da máquina de estados, onde
  // `matar` é injetado e observado (SIGTERM e depois SIGKILL).
});

test("encerramento: a carência total é curta, fixa e declarada", () => {
  assert.equal(MS_CARENCIA_TOTAL, MS_CARENCIA_ENCERRAMENTO * 2);
  assert.ok(Number.isFinite(MS_CARENCIA_TOTAL));
  assert.ok(
    MS_CARENCIA_TOTAL <= 5000,
    "a carência não pode virar uma segunda espera longa",
  );
});
