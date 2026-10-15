# T165 — Cadastro de colaborador pelo RH: diagnóstico de bloqueio

Status: **parada por regra declarada.** Nenhuma interface foi escrita.
Data: 2026-10-15.
Base: `9df47566c3741bdeff68ae65bd6ffe1191a3a70b` (T164, PR #156).

A tarefa autorizava parar se o contrato não permitisse uma criação correta
pelo RH **sem inventar campo, relação ou regra**. Não permite — e por quatro
motivos independentes, cada um suficiente por si. Este documento registra o
inventário, os bloqueios e uma proposta de fatias.

---

## 1. O inventário, na fonte

### 1.1 A rota de criação

Existe **uma única** rota de criação de colaborador:

| Item      | Valor                                         | Evidência                      |
| --------- | --------------------------------------------- | ------------------------------ |
| Rota      | `POST /v1/colaboradores`                      | `colaborador.controller.ts:79` |
| Permissão | `@RequirePermission("colaborador", "create")` | `:81`                          |
| DTO       | `AdmitirColaboradorDto`                       | `pessoas.dto.ts:123`           |

### 1.2 O DTO, campo a campo

`AdmitirColaboradorDto` estende `DestinoOrganizacionalDto`:

| Campo                                                                                         | Obrigatório                   | Validação                                             | Natureza     |
| --------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------- | ------------ |
| `nome`                                                                                        | **sim**                       | `@IsString @IsNotEmpty @MinLength(2) @MaxLength(160)` | cadastro     |
| `empresaId`                                                                                   | **sim**                       | `@IsUUID`                                             | escopo       |
| `matricula`                                                                                   | **sim**                       | `@Matches(MATRICULA_PATTERN)`                         | **admissão** |
| `tipo`                                                                                        | **sim**                       | `@IsIn(TIPOS_VINCULO)`                                | **admissão** |
| `dataAdmissao`                                                                                | **sim**                       | `@IsDateString({ strict: true })`                     | **admissão** |
| `motivoCodigo`                                                                                | **sim**                       | `@IsIn(MOTIVOS)`                                      | **admissão** |
| `departamentoId`, `areaId`, `equipeId`, `cargoId`, `centroCustoId`, `unidadeOrganizacionalId` | opcionais **individualmente** | `@IsOptional @IsUUID`                                 | lotação      |

As referências de destino são opcionais no DTO mas **não** na regra:
`assertDestinoCoerente` exige **ao menos uma** quando o movimento produz
alocação, e recusa `areaId` sem `departamentoId` — porque a FK composta
`(area_id, departamento_id)` não é verificada quando há `NULL` na tupla
(`validacao-pessoas.util.ts`).

### 1.3 A empresa ativa na criação

O ator chega com `companyId` **já resolvido para a empresa ativa da sessão**
(T163, `contexto-empresarial.ts`). Em `colaborador.service.ts:66`, o corpo é
confrontado com o escopo:

> `if (dto.empresaId !== escopo.empresaId)` → **404**, nunca 403 — não
> confirma a existência da empresa.

E há um detalhe mais forte: **`dto.empresaId` nunca é persistido**. O service
resolve o escopo na primeira linha, a partir da sessão, e grava
`escopo.empresaId` no vínculo, na movimentação e na auditoria. O campo do corpo
é apenas **asserção de concordância** — divergir produz 404 e um evento
`authorization_denied`.

Ou seja: **o corpo não pode forjar outra empresa**, e isso já está garantido
no servidor. A interface não precisa — e não deve — tentar contornar.

### 1.4 Quem pode criar, de fato

| Papel            | `evaluatePessoas` (capacidade) | `resolverEscopoPessoas` (escopo de mutação) | Pode criar? |
| ---------------- | ------------------------------ | ------------------------------------------- | ----------- |
| `rh`             | sim                            | sim                                         | **sim**     |
| `dp`             | sim                            | sim                                         | **sim**     |
| `master_tecnico` | **só `read`**                  | **`ForbiddenException`**                    | **não**     |
| demais           | não                            | não                                         | não         |

A negação do `master_tecnico` é **deliberada e registrada**, em duas camadas:
T030 define o perfil global como leitura e configuração, **sem mutação de
negócio**, e `resolverEscopoPessoas` repete a recusa como defesa em
profundidade.

---

## 2. Os quatro bloqueios

### B1 — Não existe cadastro sem admissão, e isso é decisão, não lacuna

O próprio código declara o porquê, em `pessoas.dto.ts:115-122`:

> "O cadastro **não** é criado sozinho de propósito. Colaborador não tem
> `empresa_id` (a empresa é do vínculo), então um cadastro sem vínculo ficaria
> fora de qualquer escopo de autorização — invisível a todos, inclusive a quem
> o criou."

Confirmado no schema: `model Colaborador` tem `nome`, `situacao` e carimbos —
**nenhum `empresa_id`**. Quem carrega `empresa_id`, `matricula` e
`dataAdmissao` é `VinculoFuncional`.

A T165 proíbe admissão. Mas a única rota de criação **é** a admissão, e quatro
dos seus seis campos obrigatórios são de admissão. Cumprir a tarefa ao pé da
letra exigiria uma rota nova que cria colaborador sem vínculo — isto é,
inventar endpoint, e criar registros que o modelo de autorização não consegue
enxergar.

### B2 — O papel aprovado não bate com o RBAC

A direção aprovada diz "somente RH e master técnico podem cadastrar". O código
diz `rh` e `dp`, com `master_tecnico` negado por decisão registrada.

Honrar a direção exigiria **duas** mudanças de RBAC: conceder `create` ao
`master_tecnico` — contrariando T030 — e revogá-lo do `dp`, que o tem hoje.
Ambas são regra nova, não implementação.

### B3 — Não há dado cadastral para cadastrar

"Cadastro de colaborador" sugere uma ficha. O modelo não tem uma:
`model Colaborador` guarda **`nome`**, `situacao` (derivada do vínculo, nunca
comandada) e carimbos de tempo. **Não existe CPF, data de nascimento, contato,
endereço, nome social, documento ou remuneração** — em lugar nenhum do schema.

Então "cadastrar pelo RH, sem admitir" se reduziria, hoje, a **digitar um
nome**. Qualquer campo além disso precisaria ser criado — migration, modelo e
decisão de dado pessoal, com as implicações de LGPD que o repositório trata
por ADR. Exatamente o que a regra de parada proíbe fazer por suposição.

### B4 — O que a tarefa pede como "primeira fatia" já existe

`ColaboradoresScreen.tsx` já tem o formulário de "Novo colaborador", com
coleta de nome, matrícula, tipo, data de admissão e destino organizacional,
envio por `admitirColaborador`, confirmação de sucesso, erro da API, retry
preservando os dados e devolução de foco. São **sete** testes dedicados, entre
os 69 do arquivo.

Entregar "formulário RH, validação, envio seguro, sucesso, erro e retorno
atualizado à lista" seria reentregar o que já está em produção.

---

## 3. Proposta de fatias

Nenhuma delas é iniciada aqui. Cada uma precisa de decisão do proprietário.

### Fatia A — Decisão de papel (sem código)

Resolver o conflito do B2 antes de qualquer tela. Três saídas possíveis, e a
escolha é de negócio:

1. manter o contrato atual (`rh` + `dp`) e ajustar a direção;
2. conceder `create` ao `master_tecnico` — exige emenda à T030/ADR 0012,
   porque hoje ele é leitura e configuração;
3. revogar `create` do `dp` — exige revisar a Baseline V1, item 12, que lhe
   atribui registro e efetivação.

### Fatia B — Cadastro em duas etapas, se for mesmo desejado

Se "cadastrar sem admitir" é requisito de negócio, ele precisa de **decisão de
modelo** antes de código: onde vive um colaborador sem vínculo, e sob qual
escopo de autorização ele é visível. Hoje a resposta é "em lugar nenhum".
Opções que exigiriam ADR: dar `empresa_id` ao colaborador; ou criar um estado
de rascunho com escopo próprio. **Nenhuma deve ser escolhida por suposição.**

### Fatia C — Melhorias no formulário que já existe

Sem contrato novo, dentro do que a API já oferece. Três candidatos observados
no inventário, todos a confirmar com o proprietário:

1. **Erros sem ancoragem de campo.** Matrícula duplicada vira `409` nu e
   destino inválido vira `422` nu, nenhum com código ou campo. A tela mostra
   uma mensagem única da API, e quem preencheu não sabe onde corrigir.
2. **O POST não confirma o que criou.** A resposta traz só
   `{ id, nome, situacao, criadoEm, atualizadoEm }`, com `situacao` sempre
   `inativo` — sem matrícula, vínculo ou empresa. A confirmação na tela não
   tem como afirmar o que de fato foi gravado.
3. **`motivoCodigo` aceita os sete motivos numa admissão**, inclusive
   `encerramento_de_vinculo` — enquanto `RegistrarMovimentacaoDto` filtra. É
   assimetria de contrato; restringir só no seletor da interface esconderia o
   problema em vez de resolvê-lo.

**Um candidato foi levantado e REFUTADO**, e vale registrar para não voltar: a
suspeita de que o formulário deixaria escolher empresa diferente da ativa. Ele
de fato tem um seletor de empresa, mas condicionado a
`formulario.empresas.length > 1`, alimentado por `GET /v1/empresas`. Medido no
navegador com a conta autorizada em **duas** empresas: a rota devolve
**`total: 1`** — só a ativa —, então o seletor **nunca** aparece e não há como
escolher errado. A T163 fechou esse buraco sozinha, ao escopar a listagem pela
empresa ativa.

### Fatia D — Cobrir a negação do `master_tecnico` com teste

Achado colateral do inventário, e o mais barato de resolver: a recusa de
mutação ao `master_tecnico` em pessoas **não tem teste próprio**. Não há
`escopo-pessoas.util.spec.ts`; `rbac.evaluator.master-tecnico.spec.ts` não
exercita `colaborador`/`create`; e nenhum E2E cobre o caso. A garantia existe
em duas camadas de código, e nenhuma delas é guardada — uma edição futura
poderia abrir a mutação sem que nada reprovasse.

### Fatia E — Projeção própria da listagem

Pendência já registrada na T164: matrícula, cargo, departamento e admissão
vivem no vínculo, e só entrariam na lista por projeção nova no servidor.

---

## 4. O que esta tarefa entregou

Somente o inventário e este diagnóstico, mais a convergência da T164 no Spec
Kit. **Nenhuma linha de interface, endpoint, migration, campo ou regra.**

As dívidas seguem abertas: **R-3** (T162), **R-3 da revisão da T164**, **S2**
(T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157)
e o registro `teste michell`.
