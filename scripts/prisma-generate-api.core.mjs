/**
 * Núcleo puro do `prisma generate` da API (T171). Sem processo, disco nem rede:
 * a camada de efeitos está em `prisma-generate-api.mjs`, e estas regras são
 * testadas em `prisma-generate-api.core.test.mjs`.
 *
 * O PROBLEMA, comprovado na fonte do Prisma 5.22
 * (`@prisma/client/generator-build/index.js`, função `getDefaultOutdir`):
 *
 *   1. `outputDir.endsWith("node_modules/@prisma/client")` — compara com barra
 *      NORMAL. No Windows o caminho vem com contrabarra e a comparação falha;
 *      no Linux ela acerta, e é por isso que a CI nunca teve o problema.
 *   2. Se `INIT_CWD` existe e o evento é `postinstall`, o client vai para
 *      `INIT_CWD/node_modules/.prisma/client`. Durante `pnpm install`, o
 *      `INIT_CWD` é a RAIZ do repositório — e o client cai na raiz, onde o
 *      `@prisma/client` (que vive em `node_modules/.pnpm`) não o encontra.
 *   3. Fora disso, o client vai para `<pacote @prisma/client>/../../.prisma/client`,
 *      ao lado do pacote — o lugar certo.
 *
 * Com o client na raiz, os tipos do Prisma não resolvem e o `tsc` da API estoura
 * a pilha. O contorno manual (`prisma generate` depois do install) funcionava
 * porque fora do `postinstall` o ramo 2 não se aplica.
 *
 * A CORREÇÃO: rodar o `generate` sem `INIT_CWD`. O ramo 2 deixa de valer e o
 * Prisma cai no ramo 3 em qualquer sistema. No Linux nada muda: o ramo 1 já
 * acertava antes. Nenhuma dependência é alterada.
 */
import { dirname, join } from "node:path";

/** Argumentos do `prisma generate`, iguais aos do `postinstall` anterior. */
export const ARGUMENTOS_GENERATE = Object.freeze([
  "generate",
  "--schema=prisma/schema.prisma",
  "--allow-no-models",
]);

/**
 * Ambiente do `prisma generate`: o do processo, sem `INIT_CWD`. Não altera o
 * objeto recebido.
 */
export function ambienteParaGerar(ambiente) {
  const copia = { ...ambiente };
  delete copia.INIT_CWD;
  return copia;
}

/**
 * Onde o client gerado PRECISA estar para o `@prisma/client` encontrá-lo: ao
 * lado do pacote, como no ramo 3 do Prisma. `dirPacoteClient` é o diretório
 * REAL (sem junction nem symlink) do pacote `@prisma/client`.
 */
export function destinoEsperadoDoClient(dirPacoteClient) {
  return join(dirPacoteClient, "..", "..", ".prisma", "client");
}

/**
 * Decide se o `generate` deixou o client no lugar certo, e fresco.
 *
 * `inicioMs` é o instante (ms de época) em que o `generate` começou, e
 * `geradoEmMs` é a data de modificação do `index.d.ts` no destino esperado, ou
 * `null` se ele não existe. Um arquivo antigo no destino não conta: seria a
 * sobra de uma geração anterior, e o client desta rodada teria ido parar em
 * outro lugar sem ninguém notar.
 */
export function avaliarGeracao({ destino, geradoEmMs, inicioMs }) {
  if (geradoEmMs === null) {
    return {
      ok: false,
      motivo:
        `O Prisma não gerou o client em ${destino}. O @prisma/client não vai ` +
        "encontrá-lo, e o typecheck da API falha.",
    };
  }
  // Tolerância de 2 s: a resolução do relógio de arquivo varia por sistema.
  if (geradoEmMs + 2000 < inicioMs) {
    return {
      ok: false,
      motivo:
        `O client em ${destino} é anterior a esta geração: o Prisma gravou ` +
        "em outro lugar. Os tipos ficariam desatualizados.",
    };
  }
  return { ok: true, motivo: null };
}

/**
 * Executa o `prisma generate` da API e confere o resultado (T171, B-1).
 *
 * Toda a lógica da camada de efeitos vive aqui, com os efeitos INJETADOS, para
 * que o teste prove a correção sem Prisma real: é nesta função que o
 * `INIT_CWD` sai do ambiente e que o destino do client é verificado. A CLI
 * (`prisma-generate-api.mjs`) só liga esta função aos efeitos reais
 * (`prisma-generate-api.efeitos.mjs`) e traduz o resultado em código de saída.
 *
 * Dependências:
 * - `dirApi` — diretório da API (`cwd` do `generate`);
 * - `ambiente` — ambiente ORIGINAL do processo; o `generate` recebe uma cópia
 *   sem `INIT_CWD`;
 * - `executar(args, { cwd, env })` — roda `node <args>` e devolve
 *   `{ status, signal, error }`, como o `spawnSync`;
 * - `resolverModulo(especificador)` — resolve a partir da API;
 * - `caminhoReal(caminho)` — o `realpath`;
 * - `dataDeModificacao(caminho)` — ms de época, ou `null` se não existe;
 * - `agora()` — ms de época.
 *
 * Devolve `{ ok, codigo, mensagem }`: `codigo` é o código de saída do processo,
 * e `mensagem` é o texto a escrever em stderr (ou `null`).
 */
export function executarGeracao({
  dirApi,
  ambiente,
  executar,
  resolverModulo,
  caminhoReal,
  dataDeModificacao,
  agora,
}) {
  const inicioMs = agora();
  const cli = resolverModulo("prisma/build/index.js");
  const resultado = executar([cli, ...ARGUMENTOS_GENERATE], {
    cwd: dirApi,
    env: ambienteParaGerar(ambiente),
  });
  if (resultado.error) {
    return {
      ok: false,
      codigo: 1,
      mensagem: `prisma generate não executou: ${resultado.error.message}\n`,
    };
  }
  // `status` nulo é término por sinal: falha, com código 1.
  if (resultado.status !== 0) {
    return { ok: false, codigo: resultado.status ?? 1, mensagem: null };
  }

  const dirPacoteClient = dirname(
    caminhoReal(resolverModulo("@prisma/client/package.json")),
  );
  const destino = destinoEsperadoDoClient(dirPacoteClient);
  const geradoEmMs = dataDeModificacao(join(destino, "index.d.ts"));
  const avaliacao = avaliarGeracao({ destino, geradoEmMs, inicioMs });
  if (!avaliacao.ok) {
    return { ok: false, codigo: 1, mensagem: `\n${avaliacao.motivo}\n` };
  }
  return { ok: true, codigo: 0, mensagem: null };
}
