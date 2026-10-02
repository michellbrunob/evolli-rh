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
import {
  subirAmbiente,
  FalhaDePasso,
  MS_TIMEOUT_TENTATIVA_HTTP,
} from "./demo-local.core.mjs";

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
 * Encerra um filho e TODOS os descendentes dele.
 *
 * No Windows, `shell: true` faz o filho direto ser o `cmd.exe`; matar só ele
 * deixaria o neto (node do Vite/Nest, ou o `docker`) órfão — daí `taskkill /T`,
 * que derruba a árvore. Fora do Windows, o filho nasce líder de grupo
 * (`detached: true`) e o sinal vai para o grupo inteiro, com o mesmo efeito.
 *
 * Único ponto de encerramento do arquivo: tanto os servidores de longa duração
 * quanto o subprocesso com prazo passam por aqui, para não existirem duas
 * disciplinas de kill divergindo com o tempo.
 */
function matarArvore(filho, sinal = "SIGTERM") {
  if (filho.pid === undefined) return;
  if (EM_WINDOWS) {
    spawnSync("taskkill", ["/pid", String(filho.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return;
  }
  try {
    process.kill(-filho.pid, sinal);
  } catch {
    try {
      filho.kill(sinal);
    } catch {
      // Já morreu: encerrar é melhor-esforço.
    }
  }
}

/**
 * Executa um comando com PRAZO e devolve o resultado, sem bloquear o event
 * loop.
 *
 * Existe porque `executar` é `spawnSync`: ele segura a thread até o filho
 * terminar, então um `docker compose exec ... pg_isready` travado furaria
 * qualquer orçamento, por mais correto que fosse o laço em volta. Aqui o
 * processo é assíncrono e, no estouro do prazo, a ÁRVORE é encerrada e o
 * encerramento é AGUARDADO (`close`, não `exit`): sem processo, listener ou
 * timer sobrando. O estouro vira `expirou: true` com status diferente de zero,
 * que o chamador lê como tentativa sem sucesso.
 */
function executarComPrazo({ comando, args, shell, env, cwd, timeoutMs }) {
  return new Promise((resolver) => {
    const filho = spawn(comando, args, {
      cwd: cwd ? join(RAIZ, cwd) : RAIZ,
      shell,
      ...(EM_WINDOWS ? {} : { detached: true }),
      ...(env ? { env } : {}),
    });

    let saida = "";
    let expirou = false;
    let concluido = false;
    filho.stdout?.on("data", (p) => {
      saida += p.toString();
    });
    filho.stderr?.on("data", (p) => {
      saida += p.toString();
    });

    const prazoMs = Math.max(1, Math.round(timeoutMs));
    const cronometro = setTimeout(() => {
      expirou = true;
      // SIGKILL, não SIGTERM: um subprocesso que já furou o prazo é justamente
      // o que pode estar travado e ignorar o pedido educado de sair.
      matarArvore(filho, "SIGKILL");
    }, prazoMs);
    // O prazo não pode, ele próprio, segurar o processo vivo no fim do
    // comando — nem aparecer como timer residual.
    cronometro.unref?.();

    const terminar = (status) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(cronometro);
      resolver({ status, saida, expirou });
    };

    // `close` e não `exit`: espera a confirmação do encerramento e o
    // fechamento dos fluxos, que é o que garante não sobrar nada atrás.
    filho.on("close", (codigo) => terminar(expirou ? 1 : (codigo ?? 1)));
    filho.on("error", (erro) => {
      saida += erro.message;
      terminar(127);
    });
  });
}

/**
 * Sobe um servidor de desenvolvimento e devolve um manípulo que sabe matar a
 * ÁRVORE inteira.
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
      matarArvore(filho);
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

/**
 * Prazo FINITO por tentativa, não para o orçamento inteiro — `AbortSignal.
 * timeout` encerra a conexão sozinha se ninguém responder dentro do prazo.
 * Sem isto, um servidor que aceita a conexão e nunca responde prenderia esta
 * chamada indefinidamente: o laço de quem chama (`esperar`/
 * `confirmarProntoWeb`) nunca voltaria a checar se o processo morreu, nem a
 * decrementar o orçamento — o diagnóstico "não respondeu em Ns" seria falso,
 * porque na prática ficou preso numa tentativa só.
 *
 * `timeoutMs` é parâmetro, não constante fixa, para que os testes exercitem
 * o comportamento real de timeout com prazos curtos, sem esperar o valor de
 * produção.
 */
export async function buscarHttp(url, timeoutMs = MS_TIMEOUT_TENTATIVA_HTTP) {
  try {
    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
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
    executarComPrazo,
    iniciar,
    buscarHttp,
    portaLivre,
    dormir,
    // Relógio real e MONOTÔNICO: a partir da T145 os prazos dos passos são de
    // parede, e um ajuste de relógio do sistema não pode esticar nem encurtar
    // uma espera já em curso.
    agora: () => performance.now(),
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

// Só executa de verdade quando rodado diretamente (`pnpm demo:up`), nunca ao
// ser importado — é o que permite testar `buscarHttp` (acima) em isolamento,
// sem subir o ambiente inteiro de verdade.
const ehExecucaoDireta = process.argv[1] === fileURLToPath(import.meta.url);

if (ehExecucaoDireta) {
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
}
