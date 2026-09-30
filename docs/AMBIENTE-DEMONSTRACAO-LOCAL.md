# Ambiente local de demonstração

> **Desenvolvimento. Demonstração local. Dados exclusivamente sintéticos.**
> Proibido para informação real de pessoa, empresa ou contrato. **Não equivale
> a homologação nem a produção**, e nada aqui autoriza afirmar prontidão para
> uso real.

Serve para abrir uma cópia estável da `main` e navegar visualmente pelo que já
está integrado, enquanto o desenvolvimento continua em branches isoladas.

O que já dá para navegar, tela a tela, está em
[GUIA-VISUAL-FUNCIONALIDADES.md](./GUIA-VISUAL-FUNCIONALIDADES.md).

**Nada é publicado na rede.** Banco, API e web escutam só em `127.0.0.1`. A
restrição da API é verificada pelo próprio servidor (`EVOLLI_DEMO_MODE`), não
pela documentação: com o modo de demonstração ligado, qualquer host diferente
de `127.0.0.1` impede a API de subir, e o modo é recusado com
`NODE_ENV=production`.

## Pré-requisitos

- **Docker Desktop** em execução (o PostgreSQL vem do `docker-compose.yml` da raiz).
- Node 22 e pnpm, como no resto do repositório.
- As portas **3000** e **5173** livres. Elas são fixas de propósito: subir
  calado em outra porta esconderia qual ambiente está aberto.

## Preparação (uma vez) — Windows / PowerShell

Todos os comandos rodam na raiz do repositório. O caminho pode ter espaço
(`C:\MB\Sistema RH\Evolli RH`) — nenhum passo depende de aspas manuais.

```powershell
Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\api\.env.migrate.example apps\api\.env.migrate
```

Agora escolha **duas senhas locais quaisquer** — uma para `evolli_migrator`,
outra para `evolli_app` — e edite os três arquivos. Eles não são versionados.

| Arquivo                 | Linha a ajustar                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.env`                  | `POSTGRES_PASSWORD=` senha do usuário administrador do container                                           |
| `apps\api\.env`         | `DATABASE_URL=postgresql://evolli_app:SENHA_APP@127.0.0.1:5432/evolli_rh_dev?schema=app`                   |
| `apps\api\.env.migrate` | `MIGRATE_DATABASE_URL=postgresql://evolli_migrator:SENHA_MIGRATOR@127.0.0.1:5432/evolli_rh_dev?schema=app` |

**Não é preciso exportar nada no shell.** O comando descobre as senhas dos dois
papéis a partir dessas URLs, o que também impede que o papel do banco e o
arquivo da API fiquem com senhas diferentes. Se a senha tiver caractere
especial (`&`, `^`, `%`, espaço), escreva-a **percent-encoded** na URL — por
exemplo `a&b` vira `a%26b`. Se preferir, defina `EVOLLI_MIGRATOR_PASSWORD` e
`EVOLLI_APP_PASSWORD` no ambiente do processo e elas têm precedência:

```powershell
$env:EVOLLI_MIGRATOR_PASSWORD = "uma-senha-local-qualquer"
$env:EVOLLI_APP_PASSWORD      = "outra-senha-local-qualquer"
```

Nenhuma senha vai para a linha de comando em nenhum passo: as credenciais dos
papéis chegam ao `psql` por **entrada padrão**, e o orquestrador recusa, em
tempo de execução, qualquer argumento que não seja literal.

<details>
<summary>Alternativa: bash / zsh (Linux, macOS, Git Bash)</summary>

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/api/.env.migrate.example apps/api/.env.migrate
# opcional, só se não quiser a senha dentro das URLs:
export EVOLLI_MIGRATOR_PASSWORD="uma-senha-local-qualquer"
export EVOLLI_APP_PASSWORD="outra-senha-local-qualquer"
```

</details>

## Subir o ambiente

```powershell
pnpm demo:up
```

Um comando, oito passos nomeados:

| Passo | O que faz                                                                |
| ----- | ------------------------------------------------------------------------ |
| 1/8   | Pré-requisitos: Docker, arquivos de conexão, hosts locais, portas livres |
| 2/8   | PostgreSQL local (`docker compose up -d`) e espera ficar pronto          |
| 3/8   | Papéis, schema e extensões (`infra/postgres/`)                           |
| 4/8   | Migrations (`prisma migrate deploy`)                                     |
| 5/8   | API em `127.0.0.1:3000` e espera `/v1/health/ready`                      |
| 6/8   | Conta de bootstrap e seed sintético                                      |
| 7/8   | Web em `127.0.0.1:5173`, com porta estrita, e verificação HTTP           |
| 8/8   | Verificação final: banco, API e web respondendo — só então "pronto"      |

**Nenhuma falha é escondida.** Qualquer passo que quebre encerra o comando com
código diferente de zero dizendo **qual passo**, **qual causa** e **qual é o
próximo procedimento seguro** — e encerra API e web antes de sair, para não
deixar processo órfão. Senhas e strings de conexão nunca são impressas.

Ao final, e só depois das três verificações:

|     |                         |
| --- | ----------------------- |
| Web | <http://127.0.0.1:5173> |
| API | <http://127.0.0.1:3000> |

## Encerrar

A janela em que você rodou `pnpm demo:up` **fica ocupada** enquanto o ambiente
está no ar: é ela que segura a API e a web, e é nela que aparecem os logs dos
dois servidores.

- **`Ctrl+C` nessa janela** encerra API e web, inclusive os processos filhos
  (no Windows a árvore inteira é encerrada, não só o `cmd.exe` intermediário).
- **O banco continua de pé** de propósito, para a próxima subida ser rápida.
  Para pará-lo também:

  ```powershell
  docker compose stop
  ```

- Se por algum motivo sobrar algo escutando, confira e encerre:

  ```powershell
  Get-NetTCPConnection -LocalPort 3000,5173 -State Listen | Select-Object LocalPort, OwningProcess
  ```

Subir de novo depois disso é só rodar `pnpm demo:up`. Se uma das portas ainda
estiver ocupada, o passo 1/8 avisa e não sobe nada — de propósito.

## Perfis sintéticos

Senha única para todos: **`Demonstracao-Local-Evolli-2026`**

O domínio `evolli.local` é reservado e não roteável — nenhum destes e-mails
existe. A senha é deliberadamente autodescritiva: quem a vir num log sabe que é
de demonstração.

| E-mail                          | Papel            | Empresa    | Para que serve                                                            | Limite esperado                                                                               |
| ------------------------------- | ---------------- | ---------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `master.demo@evolli.local`      | `master_tecnico` | — (global) | Criar empresas e contas; enxergar as duas empresas                        | Nas Solicitações de Pessoas, lê e **não muta**                                                |
| `rh.alfa@evolli.local`          | `rh`             | Demo Alfa  | Papel operador da maior parte das telas funcionais                        | Só enxerga a Alfa                                                                             |
| `rh.beta@evolli.local`          | `rh`             | Demo Beta  | Contraprova de isolamento: mesmas telas, outro escopo                     | Recursos da Alfa respondem 404, nunca 403                                                     |
| `dp.alfa@evolli.local`          | `dp`             | Demo Alfa  | Diferença de capacidade entre DP e RH                                     | Sem capacidade nas Solicitações de Pessoas                                                    |
| `gestor.alfa@evolli.local`      | `gestor`         | Demo Alfa  | Papel consultivo (`PD-SOL-01`) — serve para ver o que **não** é oferecido | Sem capacidade nas Solicitações de Pessoas                                                    |
| `colaborador.alfa@evolli.local` | `colaborador`    | Demo Alfa  | Demonstrar a negação por papel                                            | **Não é autoatendimento**: não existe vínculo autenticado entre conta e colaborador (`DP-23`) |

Há ainda `admin.demo@evolli.local` (`admin_tecnico`), criada pelo bootstrap. Ela
existe por exigência do provisionamento e **não** cria empresas.

### Por que estas credenciais não vazam para produção

Quatro travas, todas verificadas em código:

1. O seed exige `EVOLLI_DEMO_SEED="confirmo-ambiente-local"` no ambiente do
   processo. Nenhum pipeline dispara isso sem alguém escrever a frase.
2. A API alvo precisa estar em `127.0.0.1`, `localhost` ou `::1` — conferido no
   CLI **e** dentro do módulo do seed.
3. O `DATABASE_URL` precisa apontar para host local.
4. `EVOLLI_DEMO_MODE=true` é **recusado** com `NODE_ENV=production`, e com ele
   ligado a API só aceita escutar em `127.0.0.1`.

Qualquer uma que falhe encerra o processo com erro. Nenhum segredo real é
versionado, e o CLI do seed é excluído do artefato de build da API
(`tsconfig.build.json`), então não viaja para `dist/`.

## Dados sintéticos criados

Duas empresas (**Demo Alfa** e **Demo Beta**), cada registro com a marca `Demo`
no nome. Na Alfa: unidade, dois departamentos, área, equipe, cargo, centro de
custo e uma tabela de horário. Dois colaboradores — um com **um** vínculo e
outro com **dois** —, que é exatamente a diferença que as telas tratam (um
resolve sozinho; dois exigem escolha explícita). Na Beta, o mínimo para provar
isolamento.

**Não são criados:** conteúdo de documento, anexo, biometria, diagnóstico, CID,
dado clínico, MFA, nem qualquer acesso a serviço externo ou R2.

O seed é **idempotente**: cada passo procura antes de criar e reusa o que achar,
varrendo **todas** as páginas da listagem — inclusive depois que o banco local
passar de 100 registros de algum tipo, por causa dos cadastros que você mesmo
fizer navegando. Rodar de novo converge para o mesmo conjunto, sem duplicar, e
sem tocar em nada que não seja do conjunto sintético. Ele **nunca apaga** —
`solicitacao_pessoa` e `audit_event` têm `DELETE` revogado no banco, e um seed
que apagasse para recriar não conseguiria rodar duas vezes.

Rodar o seed isoladamente, com a API já de pé:

```powershell
$env:EVOLLI_DEMO_SEED = "confirmo-ambiente-local"
pnpm --filter @evolli/api run seed:demo
```

## Separação entre demonstração e desenvolvimento

- A demonstração **sempre** usa uma cópia estável da `main`.
- O desenvolvimento acontece em branch ou worktree isolada, nunca no diretório
  que está sendo demonstrado.
- Mudança em branch **não aparece** na demonstração antes do merge.
- Depois de cada merge, a demonstração é atualizada pelo procedimento abaixo —
  nunca por edição manual do banco.
- Recriar dados é **operação explícita** (ver o final desta seção), jamais
  automática.

### Atualizar depois de um merge

Encerre o ambiente (`Ctrl+C`) e, na mesma janela:

```powershell
git checkout main
git pull --ff-only
pnpm install
pnpm demo:up
```

`pnpm install` é barato quando nada mudou; rodá-lo sempre evita o erro de
esquecer que o lockfile mudou. O passo 4/8 reaplica migrations pendentes e o
6/8 reexecuta o seed; como ambos são idempotentes, rodar de novo é seguro.

O SHA demonstrado é impresso pelo próprio `pnpm demo:up` no passo final. Para
conferir separadamente:

```powershell
git rev-parse --short HEAD
Invoke-RestMethod http://127.0.0.1:3000/v1/health/ready
```

### Recriar os dados do zero

Destrutivo e **manual por decisão**, nunca automático:

```powershell
docker compose down -v   # apaga o volume do Postgres LOCAL de demonstração
pnpm demo:up
```

Confira antes que o `docker compose` em uso é o da raiz deste repositório. Não
existe nenhum comando neste projeto que apague banco sem ser explicitamente
chamado por uma pessoa, e nenhum aponta para host que não seja local.

## Limitações conhecidas

- **Nem tudo que aparece no menu é funcional.** A maior parte das telas ainda é
  demonstrativa, sem persistência. O
  [guia visual](./GUIA-VISUAL-FUNCIONALIDADES.md) diz, tela a tela, o que é o quê.
- **Sem MFA.** O seed não habilita segundo fator para nenhuma conta.
- **Sem ESS/MSS.** Não há autoatendimento do colaborador nem visão de gestor:
  depende de `DP-23`, que é decisão em aberto.
- **Sem anexo, upload ou R2.** Continuam bloqueados pelos portões de conteúdo.
- **Sem dado real, em nenhuma hipótese.**
