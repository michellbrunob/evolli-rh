/**
 * CLI do verificador de sincronia do Spec Kit.
 *
 * A decisão sobre tarefas entregues, identificadores citados e cobertura dos
 * artefatos mora em `spec-kit-sync.core.mjs`, que é puro e tem testes. Aqui
 * ficam só os efeitos: ler arquivos, consultar o git, imprimir e encerrar.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  avaliarSincronia,
  resolverContexto,
  validarEstado,
} from "./spec-kit-sync.core.mjs";

const failures = [];
const read = (path) => readFileSync(path, "utf8");

/**
 * Lê um artefato de governança, registrando falha em vez de derrubar o
 * processo. Um arquivo ausente deve virar diagnóstico, não stack trace.
 */
function lerOuVazio(path) {
  try {
    return read(path);
  } catch {
    failures.push(`Artefato de governança ilegível: ${path}`);
    return "";
  }
}

const statePath = ".specify/sync-state.json";
if (!existsSync(statePath)) {
  failures.push(`${statePath} ausente.`);
}

// `lido` separa "não deu para ler/parsear" de "leu e veio null": sem essa
// distinção, um arquivo contendo apenas `null` passaria pelo `if (state)` e
// deixaria o gate inteiro sem executar.
let state;
let lido = false;
try {
  state = JSON.parse(read(statePath));
  lido = true;
} catch {
  // A mensagem do parser pode ecoar trecho do arquivo; o log da CI é público.
  failures.push(`${statePath} ausente ou não é JSON válido.`);
}

// Validação ÚNICA, a mesma que o núcleo aplica: o CLI não pode ter uma noção
// própria de estado válido que divirja da usada para decidir.
const falhasDeEstado = lido ? validarEstado(state) : [];
failures.push(...falhasDeEstado);
const estadoUtilizavel = lido && falhasDeEstado.length === 0;

const durableFiles = [
  ".specify/memory/constitution.md",
  ".specify/spec.md",
  ".specify/plan.md",
  ".specify/tasks.md",
  ".specify/execution-status.md",
  ".specify/sync-state.json",
  ".specify/workflows/speckit/workflow.yml",
  ".chatgpt_cmds/speckit.constitution.md",
  ".chatgpt_cmds/speckit.specify.md",
  ".chatgpt_cmds/speckit.plan.md",
  ".chatgpt_cmds/speckit.tasks.md",
  ".chatgpt_cmds/speckit.implement.md",
  ".chatgpt_cmds/speckit.converge.md",
];

for (const path of durableFiles) {
  if (!existsSync(path)) {
    failures.push(`Artefato durável ausente: ${path}`);
    continue;
  }

  try {
    execFileSync("git", ["ls-files", "--error-unmatch", path], {
      stdio: "ignore",
    });
  } catch {
    failures.push(`Artefato durável não versionado: ${path}`);
  }
}

for (const manifestPath of [
  ".specify/integrations/generic.manifest.json",
  ".specify/integrations/speckit.manifest.json",
]) {
  // Sem este try, um manifest ausente ou corrompido derrubava o processo com
  // stack antes de qualquer falha ser impressa — ruído em vez de diagnóstico.
  let manifest;
  try {
    manifest = JSON.parse(read(manifestPath));
  } catch {
    failures.push(`${manifestPath} ausente ou não é JSON válido.`);
    continue;
  }
  for (const [path, expectedHash] of Object.entries(manifest.files ?? {})) {
    if (!existsSync(path)) {
      failures.push(`Arquivo do manifest ausente: ${path}`);
      continue;
    }
    const normalizedBytes = Buffer.from(
      readFileSync(path, "utf8").replace(/\r\n/g, "\n"),
      "utf8",
    );
    const actualHash = createHash("sha256")
      .update(normalizedBytes)
      .digest("hex");
    if (actualHash !== expectedHash) {
      failures.push(`Hash divergente em ${path} (${manifestPath}).`);
    }
  }
}

if (estadoUtilizavel) {
  const constitution = read(".specify/memory/constitution.md");
  const versionMatch = constitution.match(
    /\*\*Version\*\*:\s*([0-9]+\.[0-9]+\.[0-9]+)/,
  );
  if (!versionMatch || versionMatch[1] !== state.constitutionVersion) {
    failures.push(
      `Versão da Constituição diverge do manifesto: documento=${versionMatch?.[1] ?? "ausente"}, manifesto=${state.constitutionVersion}.`,
    );
  }

  const tasks = read(".specify/tasks.md");
  const ledger = read(".specify/execution-status.md");

  for (const artifact of state.requiredArtifacts ?? []) {
    if (!durableFiles.includes(artifact) || !existsSync(artifact)) {
      failures.push(
        `requiredArtifacts contém item ausente ou não fiscalizado: ${artifact}`,
      );
    }
  }

  const { contexto } = resolverContexto({
    variavelDeAmbiente: process.env.SPEC_KIT_CHANGE_CONTEXT,
    lerSubject: () =>
      execFileSync("git", ["log", "-1", "--pretty=%s"], {
        encoding: "utf8",
      }),
  });

  failures.push(...avaliarSincronia({ state, tasks, ledger, contexto }));
}

const workflow = lerOuVazio(".specify/workflows/speckit/workflow.yml");
if (!workflow.includes("command: speckit.converge")) {
  failures.push("Workflow do Spec Kit não executa speckit.converge.");
}

const activeGovernance = [
  ".specify/memory/constitution.md",
  ".specify/spec.md",
  ".specify/plan.md",
].map(lerOuVazio);
const obsoleteMfaStatements = [
  "MFA MUST be mandatory before any real HR data pilot or production use",
  "MFA é obrigatório antes de dados reais ou produção",
  "MFA TOTP é gate antes de dados reais/produção",
];
for (const statement of obsoleteMfaStatements) {
  if (activeGovernance.some((content) => content.includes(statement))) {
    failures.push(
      `Política de MFA anterior à T132 ainda ativa: "${statement}".`,
    );
  }
}

if (failures.length > 0) {
  console.error("Spec Kit fora de sincronia:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Spec Kit sincronizado: Constituição ${state.constitutionVersion}, integrada até T${String(state.lastIntegratedTask).padStart(3, "0")}, registrada até T${String(state.lastRecordedTask).padStart(3, "0")}.`,
);
