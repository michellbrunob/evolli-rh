/**
 * Cobertura do núcleo do verificador de sincronia do Spec Kit (T149).
 *
 * Por que estes testes existem: a regra anterior derrubou a CI de `main` quatro
 * vezes — T065/T066 na T139, T066 na T140, T032 na T142, T040/T041 na T148 —
 * e entrou no projeto sem nenhum teste. A T144 curou os três identificadores já
 * queimados e registrou que a regra não mudaria; três integrações depois o
 * mesmo defeito reapareceu. Aqui a regra nova fica presa por casos
 * determinísticos, com o caso real da T148 reproduzido literalmente.
 *
 * Roda com o test runner embutido do Node (`node --test`): sem dependência nova.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  avaliarSincronia,
  coberturaDeTarefas,
  identificadoresCitados,
  resolverContexto,
  tarefasEntregues,
  validarEstado,
} from "./spec-kit-sync.core.mjs";

/**
 * Mensagem real do squash `9521e32` (T148), reduzida às linhas que importam:
 * a primeira linha declara a entrega e o corpo cita T040/T041/T042 em prosa.
 * É exatamente este texto que reprovava antes desta tarefa.
 */
const SQUASH_T148 = [
  "T148 — Convergência da T147 e fundação segura da integração de registros de ponto (#139)",
  "",
  "* docs(spec-kit): converge T147 como integrada e registra a T148",
  "",
  "T147 entrou em main pela PR #138 (squash 1d7531c), com a CI de main verde.",
  "",
  "implementacao, nao por falta de contrato de formato — o AFD esta",
  "transcrito e o parser (T040/T041) existe e e solido — mas por duas",
  "",
  "O contrato do lote AFD (T042 paragrafo 7) proibe explicitamente",
  "inferir essa chave.",
].join("\n");

/** Ledger no formato real: faixas comprimidas no histórico, linha própria no recente. */
const LEDGER = [
  "## Marco integrado anterior — T001 a T049",
  "",
  "| Tarefa | Status | Observação |",
  "| --- | --- | --- |",
  "| T050–T060 | Integrada | Motor puro de jornada. |",
  "| T104–T109 | Integrada | Estrutura organizacional. |",
  "| T147 | Integrada | Homologação funcional de Admissão. |",
  "| T148 | Integrada | Pacote de decisão de integração de ponto. |",
].join("\n");

const TASKS = [
  "44. **T147 — Homologação funcional de Admissão.**",
  "45. **T148 — Convergência e pacote de decisão.**",
  "   - Contrato técnico do parser AFD (T040) e núcleo do parser (T041).",
  "   - Faixa histórica T104–T109 registrada em bloco.",
].join("\n");

const ESTADO_T148 = { lastIntegratedTask: 147, lastRecordedTask: 148 };

/** Atalho: avalia e devolve só as mensagens de falha. */
const avaliar = (parcial) =>
  avaliarSincronia({
    state: ESTADO_T148,
    tasks: TASKS,
    ledger: LEDGER,
    contexto: "",
    ...parcial,
  });

// --------------------------------------------------------------------------
// 1. Reprodução exata do squash da T148 — o caso que quebrou a CI de `main`.
// --------------------------------------------------------------------------

test("1. squash real da T148 passa: T148 entregue e registrada, T040/T041 só em narrativa", () => {
  const falhas = avaliar({ contexto: SQUASH_T148 });
  assert.deepEqual(falhas, []);
});

test("1b. a regra ANTERIOR reprovaria o mesmo texto — prova da regressão", () => {
  // Reimplementação literal da regra que vigorava até a T148, para provar que
  // os testes novos falhariam contra ela. Extraía todo T### e exigia presença
  // literal (String.includes) nos dois artefatos.
  const regraAntiga = (contexto) => {
    const falhas = [];
    for (const m of contexto.matchAll(/\bT(\d{3})\b/g)) {
      if (!TASKS.includes(m[0]))
        falhas.push(`${m[0]} aparece na mudança, mas não em tasks.md.`);
      if (!LEDGER.includes(m[0]))
        falhas.push(`${m[0]} aparece na mudança, mas não no ledger.`);
    }
    return falhas;
  };

  const antes = regraAntiga(SQUASH_T148);
  assert.ok(
    antes.some((f) => f.includes("T040")) &&
      antes.some((f) => f.includes("T041")),
    `a regra anterior deveria reprovar T040 e T041; reprovou: ${JSON.stringify(antes)}`,
  );
  // E a regra nova, sobre o mesmo texto, não reprova nada.
  assert.deepEqual(avaliar({ contexto: SQUASH_T148 }), []);
});

// --------------------------------------------------------------------------
// 2. Tarefa efetivamente entregue ausente do ledger → reprova.
// --------------------------------------------------------------------------

test("2. tarefa entregue ausente dos artefatos reprova", () => {
  const falhas = avaliar({
    state: { lastIntegratedTask: 148, lastRecordedTask: 149 },
    contexto: "T149 — hardening do verificador",
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /^T149 é tarefa entregue/);
  assert.match(falhas[0], /tasks\.md nem em execution-status\.md/);
});

// --------------------------------------------------------------------------
// 3. Presente em só um dos artefatos → reprova e identifica qual falta.
// --------------------------------------------------------------------------

test("3. tarefa entregue presente só em tasks.md reprova e nomeia o ledger", () => {
  const falhas = avaliar({
    state: { lastIntegratedTask: 148, lastRecordedTask: 149 },
    tasks: `${TASKS}\n46. **T149 — hardening.**`,
    contexto: "T149 — hardening",
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /T149/);
  assert.match(falhas[0], /não está registrada em execution-status\.md/);
  assert.ok(
    !falhas[0].includes("tasks.md"),
    "não deve acusar tasks.md, que contém a tarefa",
  );
});

test("3b. presente só no ledger reprova e nomeia tasks.md", () => {
  const falhas = avaliar({
    state: { lastIntegratedTask: 148, lastRecordedTask: 149 },
    ledger: `${LEDGER}\n| T149 | Integrada | hardening. |`,
    contexto: "T149 — hardening",
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /não está registrada em tasks\.md/);
});

// --------------------------------------------------------------------------
// 4. Referência histórica ausente dos artefatos, citada só em narrativa.
// --------------------------------------------------------------------------

test("4. referência histórica não registrada, citada em prosa, não cria falso positivo", () => {
  // T033 não aparece em nenhum dos dois artefatos de teste.
  assert.ok(!TASKS.includes("T033") && !LEDGER.includes("T033"));
  const falhas = avaliar({
    contexto: `${SQUASH_T148}\n\nO comportamento vem da T033, nunca revisada.`,
  });
  assert.deepEqual(falhas, []);
});

test("4b. tarefa FUTURA citada em prosa continua reprovando", () => {
  const falhas = avaliar({
    contexto:
      "T148 — convergência\n\nIsto prepara a T151, ainda não registrada.",
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /^T151 aparece na mudança/);
  assert.match(falhas[0], /lastRecordedTask=148/);
});

// --------------------------------------------------------------------------
// 5 e 6. Mesmo veredito em contexto de PR e de push do squash.
// --------------------------------------------------------------------------

test("5. contexto de PR (só o título) passa", () => {
  const titulo =
    "T148 — Convergência da T147 e fundação segura da integração de registros de ponto";
  assert.deepEqual(avaliar({ contexto: titulo }), []);
});

test("6. contexto de push (mensagem inteira do squash) dá o MESMO veredito do PR", () => {
  const titulo =
    "T148 — Convergência da T147 e fundação segura da integração de registros de ponto";
  assert.deepEqual(
    avaliar({ contexto: SQUASH_T148 }),
    avaliar({ contexto: titulo }),
    "PR e push do mesmo conteúdo não podem divergir",
  );
});

// --------------------------------------------------------------------------
// 7. Contexto ausente ou vazio → fail-closed.
// --------------------------------------------------------------------------

test("7. contexto ausente reprova explicitamente (fail-closed)", () => {
  const falhas = avaliar({ contexto: null });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /Contexto da mudança ausente/);
});

test("7b. variável vazia cai no fallback do git, não vira no-op silencioso", () => {
  // Era o buraco de `workflow_dispatch`: os dois lados do `||` do workflow são
  // nulos, o GitHub injeta "", e `??` não caía no fallback.
  const resolvido = resolverContexto({
    variavelDeAmbiente: "   ",
    lerSubject: () => "T148 — convergência\n",
  });
  assert.equal(resolvido.origem, "git");
  assert.equal(resolvido.contexto, "T148 — convergência");
});

test("7c. sem variável e sem git, o contexto é ausente (e o gate reprova)", () => {
  const resolvido = resolverContexto({
    variavelDeAmbiente: undefined,
    lerSubject: () => {
      throw new Error("não é um repositório git");
    },
  });
  assert.equal(resolvido.contexto, null);
  assert.match(avaliar({ contexto: resolvido.contexto })[0], /ausente/);
});

test("7d. a variável tem precedência sobre o git quando está preenchida", () => {
  const resolvido = resolverContexto({
    variavelDeAmbiente: "T148 — da esteira",
    lerSubject: () => "T001 — do git",
  });
  assert.equal(resolvido.origem, "esteira");
  assert.equal(resolvido.contexto, "T148 — da esteira");
});

// --------------------------------------------------------------------------
// 8. Mais de uma tarefa entregue na mesma janela.
// --------------------------------------------------------------------------

test("8. duas tarefas abertas na janela são ambas exigidas", () => {
  assert.deepEqual(
    tarefasEntregues({ lastIntegratedTask: 147, lastRecordedTask: 149 }),
    ["T148", "T149"],
  );

  const falhas = avaliar({
    state: { lastIntegratedTask: 147, lastRecordedTask: 149 },
    contexto: "T148 e T149 entregues juntas",
  });
  assert.equal(falhas.length, 1, JSON.stringify(falhas));
  assert.match(falhas[0], /^T149 é tarefa entregue/);
});

test("8b. janela fechada ainda fiscaliza a última registrada", () => {
  // Convergir tudo não pode desligar a verificação.
  assert.deepEqual(
    tarefasEntregues({ lastIntegratedTask: 148, lastRecordedTask: 148 }),
    ["T148"],
  );
  const falhas = avaliar({
    state: { lastIntegratedTask: 150, lastRecordedTask: 150 },
    contexto: "T150 — outra coisa",
  });
  assert.match(falhas[0], /^T150 é tarefa entregue/);
});

test("8c. lastIntegratedTask maior que lastRecordedTask reprova", () => {
  const falhas = avaliar({
    state: { lastIntegratedTask: 148, lastRecordedTask: 147 },
    contexto: "T147 — regressão de estado",
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /lastIntegratedTask \(148\) não pode ser maior/);
});

// --------------------------------------------------------------------------
// Cobertura: faixas e fronteira de palavra.
// --------------------------------------------------------------------------

test("cobertura expande faixa com travessão, incluindo o miolo", () => {
  const cobertas = coberturaDeTarefas("| T104–T109 | Integrada |");
  for (const id of ["T104", "T105", "T106", "T107", "T108", "T109"]) {
    assert.ok(cobertas.has(id), `${id} deveria estar coberto pela faixa`);
  }
  assert.ok(!cobertas.has("T110"));
});

test("cobertura expande a forma textual usada nos títulos do ledger", () => {
  const cobertas = coberturaDeTarefas(
    "## Marco integrado anterior — T001 a T049",
  );
  assert.ok(
    cobertas.has("T001") && cobertas.has("T025") && cobertas.has("T049"),
  );
  assert.ok(!cobertas.has("T050"));
});

test("cobertura casa por fronteira de palavra, não por substring", () => {
  // `String.includes("T104")` acharia "T1040"; a regra nova não.
  const cobertas = coberturaDeTarefas("menção a T1040 e a T104x");
  assert.ok(!cobertas.has("T104"));
});

test("faixa invertida ou absurda não é expandida", () => {
  // Conjunto EXATO, não só a ausência do miolo: sem a guarda `ate < de` o
  // trecho é consumido pelo replace e nem os extremos sobrevivem, e uma
  // asserção que olhasse apenas `T106` passaria nos dois casos.
  assert.deepEqual([...coberturaDeTarefas("T109–T104")].sort(), [
    "T104",
    "T109",
  ]);
  assert.deepEqual([...coberturaDeTarefas("T001–T999")].sort(), [
    "T001",
    "T999",
  ]);
  // E a faixa no limite ainda expande, para que a guarda de tamanho não possa
  // ser trocada por uma recusa geral.
  assert.ok(coberturaDeTarefas("T001–T201").has("T100"));
});

test("identificadores citados não repetem e preservam a ordem", () => {
  assert.deepEqual(
    identificadoresCitados("T148 cita T040, depois T040 de novo, e T041").map(
      (c) => c.id,
    ),
    ["T148", "T040", "T041"],
  );
});

// --------------------------------------------------------------------------
// B1 — estado malformado é fail-closed.
//
// A primeira versão da T149 derivava a janela sem validar nada. Com o campo
// ausente, NaN, Infinity, string não numérica ou o próprio estado nulo,
// `tarefasEntregues` devolvia [] e `numero > NaN` era sempre falso: o gate
// aprovava com os DOIS artefatos vazios. Seis dos casos abaixo passavam
// silenciosamente antes desta correção.
// --------------------------------------------------------------------------

/** Avalia com artefatos vazios e um id futuro: só um estado válido salva. */
const comEstado = (state) =>
  avaliarSincronia({ state, tasks: "", ledger: "", contexto: "T999 futura" });

const INVALIDOS = [
  [
    "B1.1 lastRecordedTask ausente",
    { lastIntegratedTask: 148 },
    /lastRecordedTask ausente/,
  ],
  [
    "B1.2 lastRecordedTask null",
    { lastIntegratedTask: 148, lastRecordedTask: null },
    /lastRecordedTask deve ser um inteiro seguro.*null/,
  ],
  [
    "B1.3 string numérica",
    { lastIntegratedTask: 148, lastRecordedTask: "149" },
    /lastRecordedTask deve ser um inteiro seguro.*string/,
  ],
  [
    "B1.4 string não numérica",
    { lastIntegratedTask: 148, lastRecordedTask: "abc" },
    /lastRecordedTask deve ser um inteiro seguro.*string/,
  ],
  [
    "B1.5 decimal",
    { lastIntegratedTask: 148, lastRecordedTask: 149.5 },
    /lastRecordedTask deve ser um inteiro seguro.*número decimal/,
  ],
  [
    "B1.6 negativo",
    { lastIntegratedTask: -1, lastRecordedTask: 149 },
    /lastIntegratedTask não pode ser negativo/,
  ],
  [
    "B1.7 lastIntegratedTask ausente",
    { lastRecordedTask: 149 },
    /lastIntegratedTask ausente/,
  ],
  [
    "B1.8 lastIntegratedTask > lastRecordedTask",
    { lastIntegratedTask: 149, lastRecordedTask: 148 },
    /lastIntegratedTask \(149\) não pode ser maior que lastRecordedTask \(148\)/,
  ],
  [
    "B1.x NaN",
    { lastIntegratedTask: 148, lastRecordedTask: NaN },
    /lastRecordedTask deve ser um inteiro seguro.*número não finito/,
  ],
  [
    "B1.x Infinity",
    { lastIntegratedTask: 148, lastRecordedTask: Infinity },
    /número não finito/,
  ],
  ["B1.x estado null", null, /não contém um objeto de estado.*null/],
  ["B1.x estado lista", [148, 149], /não contém um objeto de estado.*lista/],
];

for (const [nome, estado, mensagem] of INVALIDOS) {
  test(`${nome} reprova, sem liberar o gate`, () => {
    const falhas = comEstado(estado);
    assert.ok(
      falhas.length > 0,
      `estado inválido não pode produzir zero falhas: ${JSON.stringify(falhas)}`,
    );
    assert.ok(
      falhas.some((f) => mensagem.test(f)),
      `nenhuma falha casou ${mensagem}; vieram: ${JSON.stringify(falhas)}`,
    );
    // Nenhuma mensagem pode carregar stack ou conteúdo de arquivo.
    for (const f of falhas) {
      assert.ok(!/\n\s+at\s/.test(f), `mensagem com stack: ${f}`);
    }
  });
}

test("B1.9 estado válido com janela fechada (integrada == registrada) é aceito", () => {
  assert.deepEqual(
    validarEstado({ lastIntegratedTask: 149, lastRecordedTask: 149 }),
    [],
  );
  assert.deepEqual(
    tarefasEntregues({ lastIntegratedTask: 149, lastRecordedTask: 149 }),
    ["T149"],
  );
});

test("B1.10 estado válido com janela de uma tarefa é aceito", () => {
  assert.deepEqual(
    validarEstado({ lastIntegratedTask: 148, lastRecordedTask: 149 }),
    [],
  );
  assert.deepEqual(
    tarefasEntregues({ lastIntegratedTask: 148, lastRecordedTask: 149 }),
    ["T149"],
  );
});

test("B1.11 estado inválido + artefatos vazios + T999 no contexto reprova", () => {
  // O caso exato do fail-open: antes desta correção, zero falhas.
  const falhas = avaliarSincronia({
    state: {},
    tasks: "",
    ledger: "",
    contexto: "T999 tarefa futura inexistente",
  });
  assert.ok(falhas.length >= 2, JSON.stringify(falhas));
  assert.ok(falhas.every((f) => /sync-state\.json/.test(f)));
});

test("B1.12 o CLI reprova sync-state.json inválido, sem vazar o conteúdo", () => {
  const raiz = mkdtempSync(join(tmpdir(), "spec-kit-"));
  try {
    mkdirSync(join(raiz, ".specify"), { recursive: true });
    writeFileSync(
      join(raiz, ".specify", "sync-state.json"),
      '{ "lastRecordedTask": 149, SEGREDO_NAO_DEVE_VAZAR',
      "utf8",
    );
    const cli = fileURLToPath(
      new URL("./check-spec-kit-sync.mjs", import.meta.url),
    );
    const r = spawnSync(process.execPath, [cli], {
      cwd: raiz,
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0, "o CLI precisa encerrar com código não zero");
    const saida = `${r.stdout}${r.stderr}`;
    assert.match(saida, /não é JSON válido/);
    assert.ok(
      !saida.includes("SEGREDO_NAO_DEVE_VAZAR"),
      "a mensagem não pode ecoar o conteúdo do arquivo",
    );
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
});
