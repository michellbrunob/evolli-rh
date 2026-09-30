# Ambiente local de demonstração

> **Desenvolvimento. Demonstração local. Dados exclusivamente sintéticos.**
> Proibido para informação real de pessoa, empresa ou contrato. **Não equivale
> a homologação nem a produção**, e nada aqui autoriza afirmar prontidão para
> uso real.

Serve para abrir uma cópia estável da `main` e navegar visualmente pelo que já
está integrado, enquanto o desenvolvimento continua em branches isoladas.

O que já dá para navegar, tela a tela, está em
[GUIA-VISUAL-FUNCIONALIDADES.md](./GUIA-VISUAL-FUNCIONALIDADES.md).

## Pré-requisitos

- **Docker Desktop** em execução (o PostgreSQL vem do `docker-compose.yml` da raiz).
- Node 22 e pnpm, como no resto do repositório.

## Preparação (uma vez)

```bash
cp .env.example .env
```

Ajuste em `.env` as credenciais **locais** do container. Depois crie os dois
arquivos de conexão da API, conforme [infra/postgres/README.md](../infra/postgres/README.md):
`apps/api/.env` com `DATABASE_URL` (papel `evolli_app`) e `apps/api/.env.migrate`
com `MIGRATE_DATABASE_URL` (papel `evolli_migrator`). Nenhum dos dois é versionado.

Exporte no shell as senhas locais dos dois papéis — elas nunca entram em arquivo:

```bash
export EVOLLI_MIGRATOR_PASSWORD="uma-senha-local-qualquer"
export EVOLLI_APP_PASSWORD="outra-senha-local-qualquer"
```

## Subir o ambiente

```bash
pnpm demo:up
```

Um comando, oito passos nomeados: pré-requisitos, PostgreSQL, papéis e schema,
migrations, servidores, conta de bootstrap, seed sintético e resumo.

**Nenhuma falha é escondida.** Se qualquer passo falhar, o comando encerra com
código diferente de zero dizendo qual passo quebrou, e o ambiente não é
apresentado como pronto. Senhas e strings de conexão nunca são impressas.

Ao final:

|     |                         |
| --- | ----------------------- |
| Web | <http://127.0.0.1:5173> |
| API | <http://127.0.0.1:3000> |

`Ctrl+C` encerra os servidores; o banco continua de pé.

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

Três travas, todas verificadas em código:

1. O seed exige `EVOLLI_DEMO_SEED="confirmo-ambiente-local"` no ambiente do
   processo. Nenhum pipeline dispara isso sem alguém escrever a frase.
2. A API alvo precisa estar em `127.0.0.1`, `localhost` ou `::1` — conferido no
   CLI **e** dentro do módulo do seed.
3. O `DATABASE_URL` precisa apontar para host local.

Qualquer uma que falhe encerra o seed com erro. Nenhum segredo real é versionado.

## Dados sintéticos criados

Duas empresas (**Demo Alfa** e **Demo Beta**), cada registro com a marca `Demo`
no nome. Na Alfa: unidade, dois departamentos, área, equipe, cargo, centro de
custo e uma tabela de horário. Dois colaboradores — um com **um** vínculo e
outro com **dois** —, que é exatamente a diferença que as telas tratam (um
resolve sozinho; dois exigem escolha explícita). Na Beta, o mínimo para provar
isolamento.

**Não são criados:** conteúdo de documento, anexo, biometria, diagnóstico, CID,
dado clínico, MFA, nem qualquer acesso a serviço externo ou R2.

O seed é **idempotente**: cada passo procura antes de criar e reusa o que achar.
Rodar de novo converge para o mesmo conjunto, sem duplicar. Ele **nunca apaga** —
`solicitacao_pessoa` e `audit_event` têm `DELETE` revogado no banco, e um seed
que apagasse para recriar não conseguiria rodar duas vezes.

Rodar o seed isoladamente, com a API já de pé:

```bash
EVOLLI_DEMO_SEED=confirmo-ambiente-local pnpm --filter @evolli/api run seed:demo
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

```bash
# 1. Trazer a main integrada
git checkout main && git pull --ff-only

# 2. Dependências: só quando o lockfile mudou
git diff --name-only HEAD@{1} HEAD | grep -q pnpm-lock.yaml && pnpm install

# 3. Subir tudo de novo (migrations e seed são idempotentes)
pnpm demo:up

# 4. Conferir a saúde e QUAL SHA está sendo demonstrado
curl -s http://127.0.0.1:3000/v1/health/ready
git rev-parse --short HEAD
```

O passo 3 reaplica migrations pendentes e reexecuta o seed; como ambos são
idempotentes, rodar de novo é seguro. O SHA demonstrado também é impresso pelo
próprio `pnpm demo:up` no passo final.

### Recriar os dados do zero

Destrutivo e **manual por decisão**, nunca automático:

```bash
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
