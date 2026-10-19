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
export function matarArvore(filho, sinal = "SIGTERM") {
  // Só sinaliza PID real. `0` em POSIX significaria "todo o MEU grupo" e um
  // negativo, "um grupo arbitrário": qualquer um dos dois derrubaria o próprio
  // orquestrador. `undefined` é o que o Node devolve quando o spawn falhou.
  const pid = filho?.pid;
  if (!Number.isInteger(pid) || pid <= 0) return false;

  if (EM_WINDOWS) {
    // `/T` derruba a árvore (com `shell: true` o filho direto é o `cmd.exe`, e
    // matar só ele deixaria o neto órfão); `/F` não dá chance de ignorar. No
    // Windows não há distinção entre pedido e força — as duas fases do
    // encerramento usam o mesmo comando, e a segunda vale como nova tentativa.
    spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return true;
  }
  try {
    // Negativo = grupo do filho, seguro porque ele nasceu líder de grupo
    // (`detached: true`). Nunca o nosso.
    process.kill(-pid, sinal);
    return true;
  } catch {
    try {
      filho.kill(sinal);
      return true;
    } catch {
      // Já morreu, ou não dá para sinalizar: encerrar é melhor-esforço, e quem
      // chamou decide o que fazer com isso.
      return false;
    }
  }
}

/**
 * Carência de cada fase do encerramento. Curta e FIXA: é só o tempo de o
 * sistema operacional derrubar um processo que já recebeu o sinal, não uma
 * nova espera pelo serviço. Duas fases, então a carência total é o dobro.
 */
export const MS_CARENCIA_ENCERRAMENTO = 1000;
/** Teto do que o encerramento pode somar ao prazo da tentativa. */
export const MS_CARENCIA_TOTAL = MS_CARENCIA_ENCERRAMENTO * 2;

/**
 * Executa um comando com PRAZO e devolve o resultado, sem bloquear o event
 * loop.
 *
 * Existe porque `executar` é `spawnSync`: ele segura a thread até o filho
 * terminar, então um `docker compose exec ... pg_isready` travado furaria
 * qualquer orçamento, por mais correto que fosse o laço em volta.
 *
 * MÁQUINA DE ESTADOS DO ENCERRAMENTO. Esperar `close` para sempre depois de
 * mandar matar seria trocar um travamento por outro: se o kill não surtir
 * efeito, ninguém mais acorda esta Promise. Por isso o encerramento é em fases
 * com teto:
 *
 *   1. o prazo expira           → pede o encerramento da árvore (SIGTERM)
 *   2. carência de 1s sem `close` → repete, agora forçado (SIGKILL)
 *   3. carência de 1s sem `close` → desiste de confirmar e devolve
 *      `encerramentoConfirmado: false`, soltando tudo o que prendia o Node
 *
 * O caso 3 NUNCA vira sucesso: o passo falha com mensagem explícita. É melhor
 * reportar "não consegui confirmar o encerramento" do que esperar para sempre
 * por um processo que o sistema operacional se recusa a matar.
 *
 * O prazo da tentativa continua sendo o orçamento real do passo; a carência é
 * um acréscimo fixo de no máximo `MS_CARENCIA_TOTAL`, e só existe no caminho
 * patológico em que o processo não morre.
 */
export function executarComPrazo({
  comando,
  args,
  shell,
  env,
  cwd,
  timeoutMs,
  // Injetáveis para o teste exercitar a máquina de estados sem precisar de um
  // processo que o sistema operacional se recuse a matar — que é justamente o
  // caso impossível de fabricar de propósito.
  matar = matarArvore,
  criar = spawn,
}) {
  return new Promise((resolver) => {
    let filho;
    try {
      filho = criar(comando, args, {
        cwd: cwd ? join(RAIZ, cwd) : RAIZ,
        shell,
        ...(EM_WINDOWS ? {} : { detached: true }),
        ...(env ? { env } : {}),
      });
    } catch (erro) {
      // `spawn` lança de forma SÍNCRONA em opção inválida. Sem este `catch` a
      // Promise rejeitaria e o erro chegaria sem o nome do passo.
      resolver({
        status: 127,
        saida: erro instanceof Error ? erro.message : String(erro),
        expirou: false,
        encerramentoConfirmado: true,
        motivo: "falha_ao_iniciar",
      });
      return;
    }

    let saida = "";
    let expirou = false;
    let concluido = false;
    const cronometros = [];

    const aoSair = (p) => {
      saida += p.toString();
    };
    filho.stdout?.on("data", aoSair);
    filho.stderr?.on("data", aoSair);

    /** Solta tudo o que este `executarComPrazo` instalou. */
    const limpar = () => {
      for (const c of cronometros.splice(0)) clearTimeout(c);
      filho.removeListener("close", aoFechar);
      filho.removeListener("error", aoErrar);
      filho.stdout?.removeListener("data", aoSair);
      filho.stderr?.removeListener("data", aoSair);
    };

    const terminar = (status, motivo, encerramentoConfirmado = true) => {
      if (concluido) return;
      concluido = true;
      limpar();
      resolver({ status, saida, expirou, encerramentoConfirmado, motivo });
    };

    function aoFechar(codigo) {
      // `close` e não `exit`: além da saída do processo, confirma o fechamento
      // dos fluxos — é o que garante não sobrar pipe atrás.
      terminar(
        expirou ? 1 : (codigo ?? 1),
        expirou ? "expirado" : "normal",
        true,
      );
    }
    function aoErrar(erro) {
      saida += erro.message;
      terminar(127, "falha_ao_iniciar", true);
    }
    filho.on("close", aoFechar);
    filho.on("error", aoErrar);

    /** Timer que não pode ser pulado: o watchdog depende dele. */
    const agendar = (ms, acao) => {
      const c = setTimeout(acao, ms);
      cronometros.push(c);
      return c;
    };

    // `timeoutMs` não finito, zero ou negativo vira o mínimo possível, antes
    // de qualquer timer existir — `setTimeout(NaN)` seria "dispare já", com
    // aviso do Node, em vez de um prazo.
    const prazoMs = Number.isFinite(timeoutMs)
      ? Math.max(1, Math.round(timeoutMs))
      : 1;

    const cronometro = agendar(prazoMs, () => {
      expirou = true;
      // Fase 1: pedido. Fase 2: força. (No Windows as duas são `taskkill /T /F`
      // — a segunda vale como nova tentativa, não como escalada de sinal.)
      matar(filho, "SIGTERM");

      agendar(MS_CARENCIA_ENCERRAMENTO, () => {
        matar(filho, "SIGKILL");

        agendar(MS_CARENCIA_ENCERRAMENTO, () => {
          // Nem o forçado confirmou. Em vez de esperar para sempre, solta o
          // que prendia o Node e reporta a condição: pipes destruídos e filho
          // desreferenciado, senão o handle do processo seguraria o event loop
          // vivo mesmo depois de a Promise resolver.
          filho.stdout?.destroy();
          filho.stderr?.destroy();
          filho.stdin?.destroy();
          filho.unref?.();
          terminar(1, "expirado_sem_confirmacao", false);
        });
      });
    });
    // O prazo não pode, ele próprio, segurar o Node vivo: enquanto o filho
    // existe é o handle DELE que mantém o laço, e é isso que garante o disparo.
    cronometro.unref?.();
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
    versaoNode: process.version,
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
