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

test("buscarHttp: resposta atrasada, mas dentro do prazo da tentativa, ainda é sucesso", async () => {
  const servidor = await subirServidorLocal((req, res) => {
    setTimeout(() => {
      res.writeHead(200);
      res.end("ok");
    }, 50);
  });
  try {
    const resposta = await buscarHttp(enderecoDe(servidor), 500);
    assert.equal(resposta?.ok, true);
  } finally {
    await encerrar(servidor);
  }
});

test("buscarHttp: servidor que nunca responde estoura o prazo DA TENTATIVA, não trava a chamada", async () => {
  const servidor = await subirServidorLocal(() => {
    // Nunca chama res.end — simula uma conexão aceita que nunca responde,
    // o cenário exato que travaria a chamada sem o timeout por tentativa.
  });
  try {
    const inicio = Date.now();
    const resposta = await buscarHttp(enderecoDe(servidor), 100);
    const duracao = Date.now() - inicio;
    assert.equal(resposta, null);
    assert.ok(
      duracao < 1000,
      `deveria abortar perto de 100ms; levou ${duracao}ms (travou na tentativa)`,
    );
  } finally {
    await encerrar(servidor);
  }
});

test("buscarHttp: recusa de conexão falha rápido, sem esperar o timeout inteiro", async () => {
  // Porta 1 não tem nada escutando: conexão recusada de imediato pelo SO.
  const inicio = Date.now();
  const resposta = await buscarHttp("http://127.0.0.1:1/", 2000);
  const duracao = Date.now() - inicio;
  assert.equal(resposta, null);
  assert.ok(
    duracao < 2000,
    `recusa de conexão não deveria esperar o timeout inteiro (${duracao}ms)`,
  );
});
