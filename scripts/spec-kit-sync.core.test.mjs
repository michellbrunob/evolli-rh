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
  TAREFA_DE_ADOCAO_DO_PROTOCOLO,
  lerTrailers,
  protocoloObrigatorio,
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

test("4b. futuro em prosa, ANTES do corte de adocao, nao reprova", () => {
  // Estado da T148 (lastRecordedTask=148) esta abaixo do corte: modo
  // historico, sem exigencia de trailer. Era este o falso positivo da T149.
  const falhas = avaliar({
    contexto: [
      "T148 - convergencia",
      "",
      "Isto prepara a T151, ainda nao registrada.",
    ].join("\n"),
  });
  assert.deepEqual(falhas, []);
});

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

// --------------------------------------------------------------------------
// T152. Protocolo de declaração estruturada, e o bypass de posição que ele
// fecha. A regra por "primeira linha com identificador" foi derrubada na
// revisão da PR #143 e não existe mais.
// --------------------------------------------------------------------------

/**
 * Fixture sanitizada do squash real `a356418` (T151, PR #142).
 *
 * Primeira linha entrega a T151; o corpo cita T150 e T139 como histórico e a
 * T152 como trabalho NÃO iniciado. É este texto que produziu
 * "T152 aparece na mudança, mas lastRecordedTask=151" no push para `main`.
 * Commit anterior ao protocolo: tem de passar em MODO HISTÓRICO.
 */
const SQUASH_T151 = [
  "T151 - Fundacao segura do Gestor consultivo (ADR 0015, resolve DP-8 e DP-23) (#142)",
  "",
  "* feat(gestor): garantir o historico das tres tabelas pelo banco",
  "",
  "esta documentado para a T152: resumo de jornada nao existe como dado nem como",
  "rota, e andamento de solicitacoes nao tem contrato seguro. Ambos ficam fora.",
  "",
  "Converge a T150 como integrada (PR #141, squash ba80157).",
  "",
  "tres estavam fora. A T139 fixou o criterio: append-only garantido pelo BANCO",
].join("\n");

/** Estado no momento daquele squash: ABAIXO do corte de adoção. */
const ESTADO_HISTORICO = { lastIntegratedTask: 150, lastRecordedTask: 151 };
/** Estado a partir da T152: protocolo obrigatório. */
const ESTADO_PROTOCOLO = { lastIntegratedTask: 151, lastRecordedTask: 152 };

const TASKS_T152 = [
  "47. **T150 - Pacote de decisao do escopo do gestor.**",
  "48. **T151 - Fundacao segura do Gestor consultivo.**",
  "49. **T152 - Hardening do verificador do Spec Kit.**",
].join("\n");

const LEDGER_T152 = [
  "| Tarefa | Status | Observacao |",
  "| --- | --- | --- |",
  "| T150 | Integrada | Pacote de decisao. |",
  "| T151 | Integrada | Fundacao segura do Gestor consultivo. |",
  "| T152 | Em revisao | Hardening do verificador. |",
].join("\n");

const comProtocolo = (parcial) =>
  avaliarSincronia({
    state: ESTADO_PROTOCOLO,
    tasks: TASKS_T152,
    ledger: LEDGER_T152,
    contexto: "",
    ...parcial,
  });

// --- corte de adoção -------------------------------------------------------

test("T152.0 o corte de adoção é por número de tarefa, não por hash", () => {
  assert.equal(TAREFA_DE_ADOCAO_DO_PROTOCOLO, 152);
  assert.equal(protocoloObrigatorio({ lastRecordedTask: 151 }), false);
  assert.equal(protocoloObrigatorio({ lastRecordedTask: 152 }), true);
  assert.equal(protocoloObrigatorio({ lastRecordedTask: 999 }), true);
  // Estado inválido não liga o protocolo por acidente; quem reprova é
  // `validarEstado`, antes de qualquer decisão.
  assert.equal(protocoloObrigatorio({ lastRecordedTask: "152" }), false);
});

test("T152.1 squash real a356418 passa em MODO HISTÓRICO", () => {
  const falhas = avaliarSincronia({
    state: ESTADO_HISTORICO,
    tasks: "T151 ok",
    ledger: "| T151 | Integrada |",
    contexto: SQUASH_T151,
  });
  assert.deepEqual(falhas, []);
});

test("T152.1b o mesmo texto, já sob o protocolo, exige declaração", () => {
  // Prova que o modo histórico é um corte, não um buraco permanente.
  const falhas = comProtocolo({ contexto: SQUASH_T151 });
  assert.ok(falhas.some((f) => /Spec-Kit-Entrega ausente/.test(f)));
});

// --- o bypass que a revisão da PR #143 encontrou ---------------------------

test("T152.B1 primeira linha cita T151 e linha posterior entrega T153: FALHA", () => {
  // ESTE é o bloqueio B1. Com a regra por posição, a declaração era a primeira
  // linha (T151, histórica) e a T153 passava sem registro nenhum.
  const falhas = comProtocolo({
    contexto: [
      "Retoma o criterio da T151 e ajusta o verificador",
      "",
      "Esta mudanca entrega a T153: novo modulo de jornada.",
    ].join("\n"),
  });
  assert.ok(falhas.length > 0, "a T153 nao pode passar sem classificacao");
  assert.ok(falhas.some((f) => /Spec-Kit-Entrega ausente/.test(f)));
});

test("T152.B1b nem com trailer, se a T153 for declarada como entrega", () => {
  const falhas = comProtocolo({
    contexto: [
      "Retoma o criterio da T151",
      "",
      "Esta mudanca entrega a T153.",
      "",
      "Spec-Kit-Entrega: T153",
    ].join("\n"),
  });
  assert.ok(
    falhas.some((f) => /^T153 está declarado em Spec-Kit-Entrega/.test(f)),
  );
  assert.ok(falhas.some((f) => /lastRecordedTask=152/.test(f)));
});

// --- protocolo: caminho feliz e cada modo de falha -------------------------

test("T152.2 entrega declarada, registrada nos dois artefatos: passa", () => {
  assert.deepEqual(
    comProtocolo({
      contexto: ["T152 - hardening", "", "Spec-Kit-Entrega: T152"].join("\n"),
    }),
    [],
  );
});

test("T152.3 identificador futuro coberto por Spec-Kit-Nao-Entrega: passa", () => {
  assert.deepEqual(
    comProtocolo({
      contexto: [
        "T152 - hardening",
        "",
        "Resumo de jornada fica para a T153, nao iniciada.",
        "",
        "Spec-Kit-Entrega: T152",
        "Spec-Kit-Nao-Entrega: T153",
      ].join("\n"),
    }),
    [],
  );
});

test("T152.4 identificador futuro citado SEM classificação: falha", () => {
  const falhas = comProtocolo({
    contexto: [
      "T152 - hardening",
      "",
      "Resumo de jornada fica para a T153.",
      "",
      "Spec-Kit-Entrega: T152",
    ].join("\n"),
  });
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /^T153 aparece no contexto/);
  assert.match(falhas[0], /nao foi classificado|não foi classificado/);
});

test("T152.5 referência HISTÓRICA não precisa de classificação", () => {
  // Só o que está acima de `lastRecordedTask` exige declaração; cobrar o
  // passado foi o defeito que a T149 corrigiu e que não volta aqui.
  assert.deepEqual(
    comProtocolo({
      contexto: [
        "T152 - hardening",
        "",
        "Retoma o criterio da T139 e converge a T150.",
        "",
        "Spec-Kit-Entrega: T152",
      ].join("\n"),
    }),
    [],
  );
});

test("T152.6 mesmo identificador em entrega e não-entrega: falha", () => {
  const falhas = comProtocolo({
    contexto: [
      "T152",
      "",
      "Spec-Kit-Entrega: T152",
      "Spec-Kit-Nao-Entrega: T152",
    ].join("\n"),
  });
  assert.ok(falhas.some((f) => /classificação precisa ser uma só/.test(f)));
});

test("T152.7 trailer duplicado: falha", () => {
  const falhas = comProtocolo({
    contexto: [
      "T152",
      "",
      "Spec-Kit-Entrega: T152",
      "Spec-Kit-Entrega: T151",
    ].join("\n"),
  });
  assert.ok(falhas.some((f) => /aparece mais de uma vez/.test(f)));
});

test("T152.8 trailer malformado ou vazio: falha", () => {
  for (const linha of [
    "Spec-Kit-Entrega: 152",
    "Spec-Kit-Entrega: T15",
    "Spec-Kit-Entrega: TASK-152",
    "Spec-Kit-Entrega:",
  ]) {
    const falhas = comProtocolo({ contexto: ["T152", "", linha].join("\n") });
    assert.ok(falhas.length > 0, `devia reprovar: ${linha}`);
  }
});

test("T152.9 trailer ausente depois do corte: falha fechada", () => {
  const falhas = comProtocolo({
    contexto: ["T152 - hardening", "", "corpo sem trailer"].join("\n"),
  });
  assert.ok(falhas.some((f) => /Spec-Kit-Entrega ausente/.test(f)));
});

test("T152.10 várias tarefas numa linha só são aceitas", () => {
  assert.deepEqual(
    comProtocolo({
      contexto: ["T151 e T152", "", "Spec-Kit-Entrega: T151, T152"].join("\n"),
    }),
    [],
  );
});

// --- artefatos, estado e contexto ------------------------------------------

test("T152.11 entrega declarada ausente de execution-status.md: falha", () => {
  const falhas = comProtocolo({
    contexto: ["T152", "", "Spec-Kit-Entrega: T152"].join("\n"),
    ledger: LEDGER_T152.replace(
      "| T152 | Em revisao | Hardening do verificador. |",
      "",
    ),
  });
  assert.ok(falhas.some((f) => /execution-status\.md/.test(f)));
});

test("T152.12 entrega declarada ausente de tasks.md: falha", () => {
  const falhas = comProtocolo({
    contexto: ["T152", "", "Spec-Kit-Entrega: T152"].join("\n"),
    tasks: TASKS_T152.replace(
      "49. **T152 - Hardening do verificador do Spec Kit.**",
      "",
    ),
  });
  assert.ok(falhas.some((f) => /tasks\.md/.test(f)));
});

test("T152.13 estado inválido continua falhando fechado (proteção da T149)", () => {
  for (const state of [
    null,
    {},
    { lastIntegratedTask: 151 },
    { lastIntegratedTask: 151, lastRecordedTask: "152" },
    { lastIntegratedTask: 151, lastRecordedTask: Number.NaN },
    { lastIntegratedTask: 151, lastRecordedTask: 1.5 },
    { lastIntegratedTask: -1, lastRecordedTask: 152 },
    { lastIntegratedTask: 153, lastRecordedTask: 152 },
  ]) {
    const falhas = avaliarSincronia({
      state,
      tasks: TASKS_T152,
      ledger: LEDGER_T152,
      contexto: ["T152", "", "Spec-Kit-Entrega: T152"].join("\n"),
    });
    assert.ok(
      falhas.length > 0,
      `estado invalido devia reprovar: ${JSON.stringify(state)}`,
    );
  }
});

test("T152.14 contexto ausente continua fail-closed (proteção da T149)", () => {
  const falhas = comProtocolo({ contexto: null });
  assert.ok(falhas.some((f) => /Contexto da mudança ausente/.test(f)));
});

test("T152.15 contexto vazio, sob o protocolo, falha por declaração ausente", () => {
  const falhas = comProtocolo({ contexto: "" });
  assert.ok(falhas.some((f) => /Spec-Kit-Entrega ausente/.test(f)));
});

test("T152.16 PR e push com os mesmos metadados dão o MESMO veredito", () => {
  // O workflow passou a fornecer título + corpo nos dois eventos; o squash
  // leva o título e as mensagens dos commits, e o PR leva título e descrição.
  // Com os trailers nos dois, o veredito coincide.
  const titulo = "T152 - Hardening do verificador do Spec Kit";
  const corpo = [
    "Resumo de jornada fica para a T153.",
    "",
    "Spec-Kit-Entrega: T152",
    "Spec-Kit-Nao-Entrega: T153",
  ].join("\n");

  const noPr = [titulo, "", corpo].join("\n");
  const noPush = [
    `${titulo} (#143)`,
    "",
    "* fix(spec-kit): fecha o bypass",
    "",
    corpo,
  ].join("\n");

  assert.deepEqual(comProtocolo({ contexto: noPr }), []);
  assert.deepEqual(comProtocolo({ contexto: noPush }), []);
  assert.deepEqual(
    comProtocolo({ contexto: noPr }),
    comProtocolo({ contexto: noPush }),
  );
});

test("T152.17 assunto '@' do GitHub não atrapalha: o trailer é que declara", () => {
  // Seis integrações reais (#121 a #127) têm assunto literal "@". Com o
  // protocolo isso deixa de importar — a declaração não depende de posição.
  assert.deepEqual(
    comProtocolo({
      contexto: [
        "@ (#143)",
        "",
        "feat(spec): hardening (T152)",
        "",
        "Spec-Kit-Entrega: T152",
      ].join("\n"),
    }),
    [],
  );
});

test("T152.18 caixa baixa e zero-width seguem NÃO tratados, como documentado", () => {
  // Dívida anterior à T152, registrada no ledger. O teste existe para que a
  // limitação seja explícita e para que corrigi-la um dia seja uma mudança
  // consciente, não um efeito colateral.
  assert.deepEqual(identificadoresCitados("t153 minusculo"), []);
  assert.deepEqual(identificadoresCitados("T​153 com zero-width"), []);
});

test("T152.19 lerTrailers é puro e não depende de posição na mensagem", () => {
  const noMeio = ["Spec-Kit-Entrega: T152", "", "T152 - assunto depois"].join(
    "\n",
  );
  assert.deepEqual(lerTrailers(noMeio).entrega, ["T152"]);
  assert.deepEqual(lerTrailers("sem trailer").entrega, []);
  assert.equal(lerTrailers("sem trailer").declarouEntrega, false);
  assert.deepEqual(lerTrailers(null).entrega, []);
});

test("T152.20 exemplo INDENTADO na prosa nao e trailer (coluna zero)", () => {
  // Descoberto fazendo dogfooding: a propria mensagem que documenta o
  // protocolo mostra `Spec-Kit-Entrega: T152` como exemplo indentado. Sem a
  // exigencia de coluna zero, isso contava como segundo trailer e reprovava
  // por duplicidade — ou seja, explicar o protocolo seria proibido.
  const ctx = [
    "T152 - hardening",
    "",
    "O protocolo se declara assim:",
    "",
    "    Spec-Kit-Entrega: T151",
    "",
    "Spec-Kit-Entrega: T152",
  ].join("\n");

  const lido = lerTrailers(ctx);
  assert.deepEqual(lido.entrega, ["T152"], "o indentado e texto, nao trailer");
  assert.deepEqual(lido.falhas, []);
  assert.deepEqual(comProtocolo({ contexto: ctx }), []);
});
