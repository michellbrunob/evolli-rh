#!/usr/bin/env node
/**
 * Ambiente LOCAL de demonstração do Evolli RH (T141).
 *
 * Este arquivo é só a camada de efeitos: processo, rede e disco. A sequência
 * dos oito passos, com todas as travas, vive em `demo-local.core.mjs` e é
 * testada em `demo-local.core.test.mjs` sem Docker.
 *
 * **Não esconde falha.** Cada passo é nomeado; qualquer erro encerra os
 * servidores que este comando subiu, diz qual passo quebrou e qual é o
 * próximo procedimento seguro. Nenhuma senha é impressa.
 *
 * **É desenvolvimento, não homologação nem produção.** Banco, API e web só
 * sobem em 127.0.0.1, e o seed exige `EVOLLI_DEMO_SEED`.
 *
 * Uso: `pnpm demo:up`  (Ctrl+C encerra API e web; o banco continua de pé)
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { subirAmbiente, FalhaDePasso } from "./demo-local.core.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const EM_WINDOWS = process.platform === "win32";

/** Lê um arquivo do repositório; `null` quando não existe. */
function lerArquivo(relativo) {
  const caminho = join(RAIZ, relativo);
  return existsSync(caminho) ? readFileSync(caminho, "utf8") : null;
}

/**
 * Executa e captura. `cwd` viaja pela API do `spawn`, nunca pela linha de
 * comando — é o que faz um caminho com espaço ("C:\\MB\\Sistema RH\\...")
 * funcionar sem depender de aspas.
 */
function executar({ comando, args, shell, env, entrada, cwd }) {
  const resultado = spawnSync(comando, args, {
    // `cwd` relativo à raiz. Ele viaja pela API do spawn, nunca por argv, e é
    // o que permite rodar dentro do pacote sem a camada recursiva do pnpm —
    // que apagaria o código de saída do bootstrap.
    cwd: cwd ? join(RAIZ, cwd) : RAIZ,
    encoding: "utf8",
    shell,
    ...(env ? { env } : {}),
    ...(entrada !== undefined ? { input: entrada } : {}),
  });
  if (resultado.error) {
    return { status: 127, saida: resultado.error.message };
  }
  return {
    status: resultado.status ?? 1,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

/**
 * Sobe um servidor de desenvolvimento e devolve um manípulo que sabe matar a
 * ÁRVORE inteira. No Windows, `shell: true` faz o filho direto ser o
 * `cmd.exe`; matar só ele deixaria o node do Vite/Nest órfão, por isso
 * `taskkill /T`. Fora do Windows, o filho vira líder de grupo (`detached`) e
 * o sinal vai para o grupo.
 */
function iniciar({ nome, comando, args, shell, env }) {
  const filho = spawn(comando, args, {
    cwd: RAIZ,
    stdio: "inherit",
    shell,
    ...(EM_WINDOWS ? {} : { detached: true }),
    ...(env ? { env } : {}),
  });

  let vivo = true;
  filho.on("exit", () => {
    vivo = false;
  });
  filho.on("error", () => {
    vivo = false;
  });

  return {
    nome,
    get pid() {
      return filho.pid;
    },
    /** O orquestrador para de esperar assim que o processo morre. */
    vivo() {
      return vivo;
    },
    matar() {
      if (!vivo || filho.pid === undefined) return;
      vivo = false;
      if (EM_WINDOWS) {
        spawnSync("taskkill", ["/pid", String(filho.pid), "/t", "/f"], {
          stdio: "ignore",
        });
        return;
      }
      try {
        process.kill(-filho.pid, "SIGTERM");
      } catch {
        try {
          filho.kill("SIGTERM");
        } catch {
          // Já morreu: encerrar é melhor-esforço.
        }
      }
    },
  };
}

/** `true` quando dá para abrir a porta — logo, ninguém a está usando. */
function portaLivre(host, porta) {
  return new Promise((resolver) => {
    const servidor = createServer();
    servidor.once("error", () => resolver(false));
    servidor.once("listening", () => {
      servidor.close(() => resolver(true));
    });
    servidor.listen(porta, host);
  });
}

async function buscarHttp(url) {
  try {
    const resposta = await fetch(url);
    return { ok: resposta.ok, status: resposta.status };
  } catch {
    return null;
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function shaAtual() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: RAIZ,
    encoding: "utf8",
  });
  return r.status === 0 ? (r.stdout ?? "").trim() : null;
}

// ---------------------------------------------------------------------------

async function main() {
  const ambiente = await subirAmbiente({
    raiz: RAIZ,
    plataforma: process.platform,
    ambiente: { ...process.env },
    lerArquivo,
    executar,
    iniciar,
    buscarHttp,
    portaLivre,
    dormir,
    registrar: (linha) => process.stdout.write(`${linha}\n`),
    sha: shaAtual(),
  });

  process.stdout.write(`${ambiente.resumo.join("\n")}\n`);

  // A partir daqui o comando fica vivo só para segurar os servidores. Todo
  // caminho de saída — Ctrl+C, SIGTERM, Ctrl+Break, `process.exit` — passa
  // por aqui antes de encerrar, então não sobra órfão.
  let encerrando = false;
  const encerrar = (codigo) => {
    if (encerrando) return;
    encerrando = true;
    process.stdout.write("\nEncerrando API e web. O banco continua de pé.\n");
    ambiente.encerrarProcessos();
    process.exit(codigo);
  };

  for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    try {
      process.on(sinal, () => encerrar(0));
    } catch {
      // Sinal indisponível nesta plataforma: os outros continuam valendo.
    }
  }
  process.on("uncaughtException", (erro) => {
    process.stderr.write(`\nErro inesperado: ${erro.message}\n`);
    encerrar(1);
  });
  process.on("exit", () => ambiente.encerrarProcessos());
}

main().catch((erro) => {
  const passo = erro instanceof FalhaDePasso ? erro.passo : "inicialização";
  const proximo =
    erro instanceof FalhaDePasso && erro.proximoPasso
      ? erro.proximoPasso
      : "Corrija a causa acima e rode `pnpm demo:up` de novo.";
  const motivo = erro instanceof Error ? erro.message : String(erro);

  process.stderr.write(
    `\nFALHOU no passo "${passo}"\n` +
      `  Causa .......... ${motivo}\n` +
      `  Próximo passo .. ${proximo}\n\n` +
      "O ambiente NÃO está pronto, e nada ficou rodando por trás deste erro.\n",
  );
  process.exit(1);
});
