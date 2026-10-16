# T170 — Migração controlada para Node 24 LTS

Status: **em implementação** (PR Draft).
Data: 2026-10-16.
Base: `0fa2e1e930bc86f545d37839c42a385b3ed05cfa` (T169, PR #161).

## 1. Decisão

A política de runtime do projeto passa de Node 22 para **Node 24 LTS**. O
pnpm continua na linha **10** (`packageManager: pnpm@10.0.0`), e nenhuma
dependência muda de versão.

A versão passa a ter **uma fonte única**: o `.nvmrc`. A CI deixa de fixar o
número em cada job e lê o arquivo (`node-version-file: .nvmrc`).

## 2. O que mudou

| Arquivo                                                                           | Antes              | Depois                      |
| --------------------------------------------------------------------------------- | ------------------ | --------------------------- |
| `.nvmrc`                                                                          | `22`               | `24`                        |
| `package.json`, `apps/api/package.json`, `apps/web/package.json` (`engines.node`) | `>=22 <23`         | `>=24 <25`                  |
| `.github/workflows/ci.yml` (Quality gates, E2E, Migration smoke)                  | `node-version: 22` | `node-version-file: .nvmrc` |
| `README.md` (pré-requisitos)                                                      | Node.js 22 LTS     | Node.js 24 LTS              |
| `docs/AMBIENTE-DEMONSTRACAO-LOCAL.md` (pré-requisitos)                            | Node 22            | Node 24 LTS e pnpm 10       |
| `.specify/plan.md` (stack)                                                        | Node.js 22         | Node.js 24 LTS              |

Não há Dockerfile de Node no repositório: o `docker-compose.yml` sobe só o
PostgreSQL, e os scripts (`scripts/*.mjs`) não verificam versão de Node. Não
havia mais nada que declarasse ou executasse uma versão específica.

## 3. O que não mudou, de propósito

- **pnpm 10.** `packageManager` segue `pnpm@10.0.0`; pnpm 11 está fora do
  escopo.
- **Lockfile.** `pnpm install --frozen-lockfile` passa sem alterar
  `pnpm-lock.yaml`: mudar `engines` não muda a resolução.
- **Dependências.** Prisma, Nest, React, Vite, TypeScript e as demais seguem
  nas mesmas versões. `@types/node` segue em `^22`: são tipos, não runtime, e
  atualizá-los seria trocar dependência, o que esta tarefa não autoriza. Fica
  como decisão separada.
- **Funcionalidade.** Nenhuma linha de código de produto, schema, migration,
  seed ou banco de demonstração foi tocada.

## 4. Compatibilidades verificadas

Ambiente local: Windows, **Node 24.19.0** e pnpm 10.0.0. Para separar o que é do
Node 24 do que é do ambiente, as mesmas medições foram repetidas com o
**Node 22.23.3** portátil já existente na máquina (o "Node 22 isolado" usado na
validação da T141), sobre o mesmo `node_modules`.

| Verificação                                                                           | Node 24                      | Node 22                 |
| ------------------------------------------------------------------------------------- | ---------------------------- | ----------------------- |
| `pnpm install --frozen-lockfile` limpo                                                | passa, lockfile intacto      | passa, lockfile intacto |
| `argon2` (módulo nativo, N-API) — hash e verificação                                  | funciona (ABI 137, N-API 10) | —                       |
| Engines do Prisma 5.22 (Node-API)                                                     | carregam                     | —                       |
| `tsc` da API, sem cache, com o client do Prisma na raiz (como sai do `postinstall`)   | estouro de pilha             | **estouro de pilha**    |
| `tsc` da API, sem cache, com o client ao lado do pacote (depois de `prisma generate`) | 0 erros                      | 0 erros                 |

O resultado da validação completa no Node 24 — lint, typecheck, build, testes e
testes de scripts — e o da CI estão no relatório da PR.

**Nenhuma incompatibilidade causada pelo Node 24 foi encontrada.** Por isso não
há correção de código nesta tarefa.

## 5. Achado preexistente, não causado pelo Node 24

No Windows, o `prisma generate` disparado pelo `postinstall` da API grava o
client em `node_modules/.prisma`, na raiz, e não ao lado do pacote
`@prisma/client` dentro de `node_modules/.pnpm`. Com o client ali, o `tsc` da
API estoura a pilha (ou, com `--stack-size` maior, mostra cerca de 215 erros de
tipos do Prisma). Rodar `prisma generate` de novo dentro de `apps/api` grava no
lugar certo e resolve.

O comportamento é **idêntico no Node 22.23.3**, então não é efeito desta
migração. Na CI, em Linux, ele não aparece. Fica registrado como pendência de
ambiente local, sem correção aqui.

Contorno local, depois de `pnpm install`:

```bash
pnpm --filter @evolli/api exec prisma generate --schema=prisma/schema.prisma
```

O `incremental: true` do `tsconfig` da API guarda o estado em
`apps/api/dist/*.tsbuildinfo`; para medir o `tsc` sem herdar resultado anterior,
esses arquivos foram apagados antes de cada medição.

## 6. Rollback para Node 22

A migração não toca dependência, lockfile, código, schema ou dados, então
voltar é só desfazer a política:

1. **Pela história:** `git revert` do squash desta tarefa em `main`.
2. **Ou à mão**, com o mesmo efeito:
   - `.nvmrc` volta a `22`; a CI acompanha sozinha, porque lê o arquivo;
   - `engines.node` volta a `>=22 <23` nos três `package.json`;
   - README, guia de demonstração e `plan.md` voltam a dizer Node 22.
3. Em cada máquina: trocar o runtime para Node 22 e refazer
   `pnpm install --frozen-lockfile`.

Não há migration, dado ou artefato a desfazer. O Node 22 já foi validado pela
CI da `main` até o squash `0fa2e1e`, e as medições da §4 mostram que o
comportamento local é o mesmo nos dois runtimes.

**Quando acionar:** uma falha na CI ou em execução cuja causa comprovada seja o
Node 24, sem correção pequena e segura dentro do escopo.
