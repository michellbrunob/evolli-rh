# T171 — Ambiente local Windows em Node 24 e pnpm 10, com prévia validada

Status: **em implementação** (PR Draft).
Data: 2026-10-19.
Base: `2fd19df9a86427cd3454d8d40ee282641ec83b65` (T170, PR #162).

## 1. O problema

No Windows, depois de `pnpm install`, o `tsc` da API estourava a pilha e o
`require('@prisma/client')` falhava em tempo de execução. Só um
`prisma generate` manual resolvia. A T170 registrou o achado, mostrou que ele
era idêntico no Node 22 e o deixou como pendência de ambiente.

## 2. A causa, comprovada na fonte

O client do Prisma 5.22 decide onde gravar o código gerado na função
`getDefaultOutdir`, em `@prisma/client/generator-build/index.js`:

1. Se `outputDir.endsWith("node_modules/@prisma/client")`, grava em
   `outputDir/../../.prisma/client`. A comparação usa **barra normal**: no
   Windows o caminho vem com contrabarra, e o teste falha. No Linux ele
   acerta — por isso a CI nunca teve o problema.
2. Se `INIT_CWD` existe e `npm_lifecycle_event === "postinstall"`, grava em
   `INIT_CWD/node_modules/.prisma/client`. Durante `pnpm install`, `INIT_CWD` é
   a **raiz do repositório**; o client cai em `node_modules/.prisma`, na raiz.
3. Caso contrário, grava em `outputDir/../../.prisma/client`, ao lado do pacote
   `@prisma/client` dentro de `node_modules/.pnpm` — o lugar certo.

O `@prisma/client` real vive em `node_modules/.pnpm/...`. A partir dele, o
client da raiz até é encontrado, mas o `index.js` dele não encontra o
`@prisma/client/runtime` (que não existe na raiz), e os tipos do Prisma não
resolvem: o `tsc` entra em recursão até estourar a pilha. O `generate` manual
funcionava porque, fora do `postinstall`, o ramo 2 não se aplica e o Prisma cai
no ramo 3.

## 3. A correção

Nenhuma dependência muda. O `postinstall` da API passou de
`prisma generate --schema=prisma/schema.prisma --allow-no-models` para
`node ../../scripts/prisma-generate-api.mjs`, que:

- roda o mesmo `prisma generate`, com os mesmos argumentos, **sem `INIT_CWD`** —
  o ramo 2 deixa de valer e o Prisma cai no ramo 3 em qualquer sistema; no
  Linux nada muda, porque o ramo 1 já acertava;
- confere, no fim, que o client desta rodada está ao lado do `@prisma/client` e
  é recente; se não estiver, a instalação **falha com a causa**, em vez de
  seguir com o typecheck quebrado em silêncio.

A lógica — inclusive a execução, com os efeitos injetados (`executarGeracao`) —
fica em `scripts/prisma-generate-api.core.mjs`; os efeitos reais (spawn,
resolução de módulo, `realpath`, data de modificação e relógio), em
`scripts/prisma-generate-api.efeitos.mjs`; e a CLI `scripts/prisma-generate-api.mjs`
só os liga e traduz o resultado em código de saída. Testes, todos em
`test:scripts` e sem Prisma real: `prisma-generate-api.core.test.mjs` (16 casos:
ambiente sem `INIT_CWD`, argumentos oficiais e `cwd` da API entregues ao
executor; falha por código diferente de zero, por sinal, por erro de execução,
por client ausente e por client antigo segundo o relógio; sucesso com client
recente) e `prisma-generate-api.efeitos.test.mjs` (5 casos: o executor repassa
`cwd` e `env` ao `spawnSync`, a resolução parte da API). Mutações conferidas em
cópia isolada: restaurar o `INIT_CWD`, remover a falha de client ausente ou
antigo e deixar de conferir sinal ou erro de execução reprovam.

## 4. Node 24 e pnpm 10 reproduzíveis

`engines` só **avisa**. O passo 1/8 da demonstração (`pnpm demo:up`) passou a
**exigir** o Node do major do `.nvmrc` e o pnpm do major do `packageManager`,
lidos das próprias fontes de verdade — nenhum número fixo no código. Sem a
trava, um runtime errado só aparecia lá na frente, disfarçado de outro erro.
Coberto por 8 casos novos em `scripts/demo-local.core.test.mjs`, e por
`scripts/demo-local.dependencias.test.mjs`, que prova que a CLI da demonstração
encaminha ao núcleo a versão do Node que a trava confere.

## 5. Evidências

**Instalação limpa no Windows, Node 24.19.0 e pnpm 10.0.0, sem `generate`
manual:**

| Verificação                            | Antes                                                    | Depois                                                                        |
| -------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Onde o client foi gerado               | `node_modules/.prisma` (raiz)                            | `node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma` |
| `tsc` da API, sem cache incremental    | estouro de pilha                                         | 0 erros                                                                       |
| `require('@prisma/client')` em runtime | `Cannot find module '@prisma/client/runtime/library.js'` | carrega                                                                       |

**Prévia local, no navegador**, em `http://127.0.0.1:5173`, com a API em
`127.0.0.1:3100` (a 3000 estava ocupada por outro processo da máquina) e um
banco próprio da demonstração em `127.0.0.1:5433`:

- os oito passos de `demo-local` concluíram; as 17 migrations foram aplicadas do
  zero no banco local de demonstração, e o seed criou 2 empresas, 8 contas e 4
  colaboradores sintéticos;
- login com a conta sintética `rh.multi`, que tem acesso às duas empresas;
- Hub "Seu acesso" com conta, perfil e o seletor de empresa;
- Colaboradores da Empresa Demo Alfa: 4 pessoas sintéticas;
- Contatos de "Pessoa Demo Alfa Um": sem registro, três campos obrigatórios;
  envio vazio mostrou erro em cada campo e focou o primeiro; gravação de valores
  formatados confirmou "Contatos salvos." e devolveu os valores normalizados
  pelo servidor;
- troca para a Empresa Demo Beta pelo Hub: a lista passou a ter só "Pessoa Demo
  Beta Um"; nenhum texto da Alfa nem valor de contato na tela; na mesma sessão,
  detalhe e contatos de "Pessoa Demo Alfa Um" responderam 404; o detalhe de
  "Pessoa Demo Beta Um" mostrou contatos sem registro;
- console do navegador sem erro da aplicação: só os 401 da checagem de sessão
  antes do login e os 404 provocados de propósito na verificação de resíduo.

## 6. Limitações e achados

- **Seção Contatos com vão vertical** (defeito visual da T169): o aviso
  "Nenhum contato registrado" usa `colaboradores-screen__aviso-texto`, que tem
  `flex: 1 1 16rem` (regra da T111, feita para layout em linha). Dentro do
  formulário em coluna, ele ocupa 256 px de altura. Não afeta leitura nem
  gravação; fica como pendência, fora do escopo de ambiente desta tarefa.
- **Aviso `[DEP0190]` do Node 24** no orquestrador da demonstração, no Windows:
  `shell: true` com argumentos. É só aviso; os argumentos já são exigidos
  literais em tempo de execução. Fica registrado.
- **O preview integrado do Claude** não herda o diretório global do pnpm no
  `PATH`: a trava nova do passo 1/8 parou a demonstração com "O pnpm não está
  disponível no PATH". No terminal comum, `pnpm demo:up` enxerga o pnpm. A
  validação usou um lançador local, fora do repositório, que só acrescenta esse
  diretório ao `PATH` e escolhe a porta da API.
- O banco de demonstração anterior (`evollirh-postgres-1`, porta 5432) foi
  religado pelo próprio Docker Desktop ao iniciar, por `restart: unless-stopped`,
  e não foi tocado.
