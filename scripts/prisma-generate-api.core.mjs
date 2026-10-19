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
import { join } from "node:path";

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
