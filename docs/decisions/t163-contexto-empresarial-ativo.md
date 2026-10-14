# T163 — Contexto empresarial ativo: investigação de contratos e desenho

Status: **investigação concluída; desenho aprovado para implementação.**
Data: 2026-10-14.
Base: `61e5f9005e072a7e5583fb2ffbaa722240ea0ff9` (T162, PR #154).

A T162 entregou o Hub **sem** troca de empresa, e declarou o motivo: não havia
contrato. Este documento levanta o que existe hoje, decide o que passa a
existir, e responde a pergunta que autorizava parar a tarefa.

---

## 0. A parada obrigatória: o contexto PODE ser aplicado centralmente

A instrução era parar e reportar se o contexto não pudesse ser aplicado
centralmente sem deixar rota funcional fora da proteção. **Pode.** A medição
que sustenta isso:

| Superfície                                                        | Medida                                         |
| ----------------------------------------------------------------- | ---------------------------------------------- |
| Controladores                                                     | 24, com ~128 rotas                             |
| Resolvedores de escopo                                            | **8**, todos recebendo `AccessUser`            |
| Chamadas a resolvedor                                             | **45**, todas alimentadas por `@CurrentUser()` |
| Serviços de domínio que leem `actor.companyId` **sem** resolvedor | **2 áreas**: `users` e `gestor`                |
| Ponto onde o ator é construído                                    | **1**: `SessionGuard` → `request.authUser`     |

Não há rota funcional que derive empresa de outro lugar. O escopo nunca vem do
cliente: `intersectarEmpresaSolicitada` já reduz `companyId` de query ao escopo
do ator, e um ator escopado que peça outra empresa recebe página vazia — nunca
erro que confirme existência.

A fronteira é única e já é `empresaId` (ADR 0005, decisão 3). Logo, trocar
"empresa da conta" por "empresa ativa da sessão" **no ponto onde o ator é
construído** cobre as 45 chamadas de uma vez, e restam exatamente duas áreas
para alinhar à mão — ambas conhecidas e listadas em §6.

---

## 1. Como a sessão identifica usuário e empresa hoje

```
cookie evolli_session (HttpOnly, opaco)
  → SessionService.validateAndTouch(token)
      · hash do token → access_session
      · recusa revogada, expirada por prazo absoluto, expirada por inatividade
      · recusa usuário não-ativo
      · toca lastSeenAt
  → { session, user }
  → SessionGuard: request.authUser = user ; request.authSession = session
  → @CurrentUser() → AccessUser
  → resolverEscopo*(actor) → { global } | { empresaId }
```

**A empresa é `access_user.company_id` — uma coluna da conta.** Não existe
nada por sessão. Por isso a T162 não tinha o que trocar, e por isso duas abas
da mesma pessoa não têm como divergir de contexto hoje.

`master_tecnico` tem `company_id` nulo e cai em `{ global: true }`: lê todas as
empresas, sem filtro. É o único acesso global standing (ADR 0012).

## 2. Estrutura segura das empresas autorizadas

Tabela nova **`access_user_empresa`**, com concessão e revogação **datadas e
atribuídas** — a associação passa a ser de servidor e auditável, como exige o
princípio 1:

| Coluna                                  | Papel                                  |
| --------------------------------------- | -------------------------------------- |
| `user_id`, `empresa_id`                 | o par autorizado, único por `@@unique` |
| `concedido_em`, `concedido_por_user_id` | quem abriu o acesso, e quando          |
| `revogado_em`, `revogado_por_user_id`   | revogação é **soft**: a linha fica     |

Revogar apagando a linha destruiria a trilha. Vigente é `revogado_em IS NULL`,
e a tabela recebe `REVOKE DELETE` como as demais tabelas historiadas do
projeto (precedente: `20261007120000`).

**Política por papel, explícita:**

| Papel                                                                          | Empresas autorizadas                                                                                             | Pode trocar                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `rh`                                                                           | as vigentes em `access_user_empresa` **∪** a própria `company_id`                                                | sim                            |
| `master_tecnico`                                                               | **todas as empresas ativas** — a política global que já existe (ADR 0012), tornada explícita e coberta por teste | sim                            |
| `dp`, `gestor`, `colaborador`, `financeiro`, `auditor`, `dpo`, `admin_tecnico` | —                                                                                                                | **não**: não listam nem trocam |

A união com a própria `company_id` para `rh` é deliberada: sem ela, ativar esta
tarefa tiraria acesso de quem já trabalha, e migração de dados silenciosa é
pior que regra explícita.

## 3. Onde fica o contexto ativo

Coluna nova **`access_session.empresa_ativa_id`**, nullable.

**Na sessão, não na conta** — é o que satisfaz o princípio 9: duas sessões da
mesma pessoa têm contextos independentes, e revogar uma não mexe na outra.
Nunca em `localStorage`, `sessionStorage`, query string, cookie escrito pelo
frontend ou parâmetro livre de rota.

Nulo significa "sem seleção": o contexto cai no padrão previsível do papel —
`company_id` da conta, que para `master_tecnico` é nulo e portanto preserva o
escopo global de hoje. **Login novo nasce com a coluna nula**, então o
comportamento inicial é exatamente o atual.

## 4. Como é resolvido centralmente

`validateAndTouch` passa a resolver **e revalidar** o contexto a cada
requisição, e o `SessionGuard` entrega aos serviços um ator cuja empresa **é**
a empresa ativa:

```ts
request.authUser = { ...user, companyId: contexto.empresaAtivaId };
```

É isto que cobre as 45 chamadas sem tocá-las: os 8 resolvedores continuam
lendo `actor.companyId`, e esse campo passa a significar, para toda a camada de
aplicação, **"a empresa em que esta requisição opera"**. A conta original
continua disponível como `contaEmpresaId` para quem precisa dela de fato.

A propriedade que torna isso seguro de revisar: **sem seleção, o valor é
idêntico ao de hoje.** Para quem não pode trocar, é sempre idêntico. A única
diferença de comportamento nasce de uma troca explícita e autorizada.

## 5. Sessão com empresa revogada ou inexistente

A autorização é reconferida **a cada requisição**, não só na troca. Se a
associação foi revogada, a empresa foi inativada ou o id não existe mais:

- a sessão **não** é promovida a escopo mais amplo — isso seria transformar
  perda de acesso em ganho de acesso;
- o contexto é **rebaixado** para o padrão do papel e a seleção é limpa;
- o acesso ao recurso da empresa antiga passa a não encontrar linha, e "não
  encontrada" vira **404**, nunca 403 — o padrão anti-enumeração já usado em
  `carregarNoEscopo` e em `intersectarEmpresaSolicitada`.

Na tentativa de **trocar** para empresa não autorizada, inexistente ou
revogada, a resposta é **404** pelo mesmo motivo: 403 confirmaria que a
empresa existe.

## 6. Rotas e telas auditadas contra vazamento entre empresas

Auditei toda a superfície alcançável pelos cartões do Hub. As duas colunas da
direita são o que muda:

| Cartão do Hub              | Controlador                                                                                                                                | Deriva empresa por                                              | Ação              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ----------------- |
| Pessoas                    | `colaboradores`, `vinculos`, `movimentacoes`                                                                                               | `resolverEscopo*Pessoas`                                        | coberto pelo ator |
| Estrutura                  | `empresas`, `unidades-organizacionais`, `departamentos`, `areas`, `equipes`, `cargos`, `centros-de-custo`, `horarios`, `horarios/vinculos` | `resolverEscopo`, `resolverEscopo*Horarios`                     | coberto pelo ator |
| Jornada                    | `pontos`, `vinculos` (ponto)                                                                                                               | `resolverEscopo*Ponto`                                          | coberto pelo ator |
| Minha equipe               | `gestor/administracao` (consulta)                                                                                                          | **`ctx.actor.companyId` direto**                                | **alinhar à mão** |
| Administração da liderança | `gestor/administracao` (admin)                                                                                                             | **`empresaDoAtor()` direto**                                    | **alinhar à mão** |
| Contas de acesso           | `users`                                                                                                                                    | **`actor.companyId` direto** + `resolverEscopoListagemUsuarios` | **alinhar à mão** |

Fora do Hub, pelo mesmo ator: `documentos`, `tipos-documento`,
`solicitacoes-documento`, `solicitacoes-pessoas` — todos por resolvedor,
cobertos. `audit`, `auth`, `auth/mfa` e `health` não são rotas de dado de
empresa; `audit` registra `companyId` como **onde a ação ocorreu**, que passa a
ser o contexto ativo — correto por definição.

As três áreas marcadas "alinhar à mão" já leem `actor.companyId`, então elas
seguem o ator automaticamente; o alinhamento é **de teste e de comentário**,
para que o significado fique declarado e não dependa de sorte.

## 7. O que esta tarefa NÃO faz

Não cria módulo de RH/DP novo, cartão fictício, portal do colaborador nem
superfície demonstrativa. Não muda a tela de login além do contrato de sessão.
Não transforma Demonstração em produto.

**R-2 e R-3 da T162 seguem abertas.** A R-2 só poderá ser declarada resolvida
se o contexto novo entregar a empresa ativa com nome sem a leitura por
montagem — e só com evidência.
