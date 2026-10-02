/**
 * Prova o `buscarHttp` REAL de `demo-local.mjs` — não o fake injetado em
 * `demo-local.core.test.mjs`. Usa um servidor HTTP local de verdade, sem
 * Docker e sem rede externa, para provar que o timeout é POR TENTATIVA: uma
 * resposta atrasada mas dentro do prazo ainda conta como sucesso, e um
 * servidor que nunca responde aborta perto do prazo configurado, em vez de
 * travar a chamada indefinidamente.
 *
 * `demo-local.mjs` só executa `main()` quando rodado diretamente (ver o
 * guard de entrypoint no próprio arquivo) — importar aqui não sobe o
 * ambiente de verdade.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { buscarHttp } from "./demo-local.mjs";

function subirServidorLocal(handler) {
  return new Promise((resolver) => {
    const servidor = createServer(handler);
    servidor.listen(0, "127.0.0.1", () => resolver(servidor));
  });
}

function encerrar(servidor) {
  return new Promise((resolver) => servidor.close(resolver));
}

function enderecoDe(servidor) {
  const { port } = servidor.address();
  return `http://127.0.0.1:${port}/`;
}

/**
 * Margem alta de propósito. Estes três testes dependem de temporizador REAL, e
 * `node --test` roda os arquivos em paralelo: sob carga, um atraso de dezenas
 * de ms vira centenas, e um limite apertado reprovaria por contenção de CPU em
 * vez de por defeito — foi o que a revisão observou. A prova de cada um não
 * está no número exato, e sim na RELAÇÃO (respondeu dentro do prazo / abortou
 * perto do prazo / falhou muito antes dele), então o teto generoso preserva a
 * prova e remove a flutuação. Nenhum teste fica lento: no caminho normal todos
 * terminam em dezenas de ms.
 */
const TETO_FOLGADO_MS = 10_000;

test("buscarHttp: resposta atrasada, mas dentro do prazo da tentativa, ainda é sucesso", async () => {
  const ATRASO_MS = 50;
  const PRAZO_MS = TETO_FOLGADO_MS; // muito acima do atraso: o prazo não é o limite aqui
  const servidor = await subirServidorLocal((req, res) => {
    setTimeout(() => {
      res.writeHead(200);
      res.end("ok");
    }, ATRASO_MS);
  });
  try {
    const inicio = Date.now();
    const resposta = await buscarHttp(enderecoDe(servidor), PRAZO_MS);
    const duracao = Date.now() - inicio;
    // A prova: uma resposta que demora, mas cabe no prazo, é sucesso — e não
    // foi confundida com timeout.
    assert.equal(resposta?.ok, true);
    assert.equal(resposta?.status, 200);
    assert.ok(
      duracao >= ATRASO_MS,
      `deveria ter esperado o atraso do servidor; levou ${duracao}ms`,
    );
  } finally {
    await encerrar(servidor);
  }
});

test("buscarHttp: servidor que nunca responde estoura o prazo DA TENTATIVA, não trava a chamada", async () => {
  const PRAZO_MS = 150;
  const servidor = await subirServidorLocal(() => {
    // Nunca chama res.end — simula uma conexão aceita que nunca responde,
    // o cenário exato que travaria a chamada sem o timeout por tentativa.
  });
  try {
    const inicio = Date.now();
    const resposta = await buscarHttp(enderecoDe(servidor), PRAZO_MS);
    const duracao = Date.now() - inicio;
    assert.equal(resposta, null);
    // Esperou o prazo (não desistiu antes por outro motivo) e DEVOLVEU
    // (não travou). O teto é folgado porque o que se prova é o retorno, não a
    // pontualidade do relógio da máquina.
    assert.ok(
      duracao >= PRAZO_MS,
      `deveria ter aguardado o prazo de ${PRAZO_MS}ms; levou ${duracao}ms`,
    );
    assert.ok(
      duracao < TETO_FOLGADO_MS,
      `travou na tentativa: ${duracao}ms sem devolver`,
    );
  } finally {
    await encerrar(servidor);
  }
});

test("buscarHttp: recusa de conexão falha rápido, sem esperar o timeout inteiro", async () => {
  // Porta 1 não tem nada escutando: conexão recusada de imediato pelo SO.
  const PRAZO_MS = 60_000; // prazo enorme: só a recusa pode encerrar isto cedo
  const inicio = Date.now();
  const resposta = await buscarHttp("http://127.0.0.1:1/", PRAZO_MS);
  const duracao = Date.now() - inicio;
  assert.equal(resposta, null);
  assert.ok(
    duracao < TETO_FOLGADO_MS,
    `recusa de conexão não deveria esperar o timeout inteiro (${duracao}ms de ${PRAZO_MS}ms)`,
  );
});
