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
  TAREFA_DE_ADOCAO_DO_PROTOCOLO,
  avaliarSincronia,
  montarContextoDeSquash,
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
  // -------------------------------------------------------------------
  // B3 — o estado não pode recuar para antes da adoção do protocolo.
  //
  // `protocoloObrigatorio` olha só `lastRecordedTask`, e isso basta para o
  // núcleo puro, que precisa reproduzir contextos anteriores à T152 em teste.
  // No CLI REAL a conclusão é outra: este arquivo faz parte da árvore que
  // CONTÉM o protocolo, então um ledger abaixo do corte não é "modo
  // histórico" — é estado incoerente. Sem esta guarda, a mesma mudança que
  // entrega uma tarefa nova poderia baixar `lastRecordedTask` e desligar a
  // fiscalização junto, em silêncio.
  //
  // O modo histórico continua existindo, e só onde tem sentido: no núcleo,
  // para replay de integrações anteriores à adoção.
  // -------------------------------------------------------------------
  if (state.lastRecordedTask < TAREFA_DE_ADOCAO_DO_PROTOCOLO) {
    failures.push(
      `lastRecordedTask=${state.lastRecordedTask} está abaixo da adoção do protocolo (T${TAREFA_DE_ADOCAO_DO_PROTOCOLO}): o estado não pode recuar para antes dela.`,
    );
  }

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

  // -------------------------------------------------------------------
  // Dois contextos, duas perguntas distintas.
  //
  // `--squash-preview` monta a mensagem que o squash desta PR produzirá e a
  // valida ANTES do merge. É o que impede a forma de falha que já quebrou a
  // `main` duas vezes nesta linha de trabalho: PR verde porque o contexto da
  // revisão (título + descrição) não é o contexto do push (título + mensagens
  // de todos os commits).
  //
  // Nada vem de shell: o título chega por ambiente e o histórico é lido pelo
  // próprio script com argumentos FIXOS. Título, descrição e mensagens de
  // commit são conteúdo não confiável e nunca são interpolados num comando.
  // -------------------------------------------------------------------
  const preverSquash = process.argv.includes("--squash-preview");

  let contexto;
  if (preverSquash) {
    const base = process.env.SPEC_KIT_BASE_SHA;
    if (!base) {
      failures.push(
        "SPEC_KIT_BASE_SHA ausente: a previsão do squash precisa da base da PR.",
      );
    } else {
      let mensagens = [];
      try {
        mensagens = execFileSync(
          "git",
          ["log", "--reverse", "--pretty=%B%x00", `${base}..HEAD`],
          { encoding: "utf8" },
        )
          .split("\u0000")
          .map((m) => m.trim())
          .filter(Boolean);
      } catch {
        failures.push(
          "Não foi possível ler o histórico da PR: a previsão do squash exige checkout com histórico (fetch-depth: 0).",
        );
      }
      if (mensagens.length === 0) {
        failures.push(
          "Nenhum commit na faixa base..HEAD: a previsão do squash não tem o que validar.",
        );
      }
      contexto = montarContextoDeSquash({
        titulo: process.env.SPEC_KIT_PR_TITLE ?? "",
        numeroPr: process.env.SPEC_KIT_PR_NUMBER,
        mensagens,
      });
    }
  } else {
    // `%B` (mensagem INTEIRA), não `%s`: o push para `main` injeta
    // `head_commit.message`, que também é a mensagem inteira, e os trailers
    // vivem no CORPO. Com `%s` o verificador local não os enxergava e dava
    // veredito diferente da CI para o mesmo commit.
    contexto = resolverContexto({
      variavelDeAmbiente: process.env.SPEC_KIT_CHANGE_CONTEXT,
      lerSubject: () =>
        execFileSync("git", ["log", "-1", "--pretty=%B"], {
          encoding: "utf8",
        }),
    }).contexto;
  }

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
