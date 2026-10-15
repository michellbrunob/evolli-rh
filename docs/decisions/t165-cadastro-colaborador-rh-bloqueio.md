# T165 — Cadastro de colaborador pelo RH: diagnóstico de bloqueio

Status: **parada por regra declarada; decisão do proprietário registrada.**
Nenhuma interface foi escrita.
Data: 2026-10-15.
Base: `9df47566c3741bdeff68ae65bd6ffe1191a3a70b` (T164, PR #156).

> **A decisão chegou, e está na §5.** O diagnóstico das §1–§4 é preservado como
> foi escrito: ele é o que motivou a decisão, e apagá-lo deixaria a escolha sem
> o problema que a explica.

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

## 3. Propostas originais

Nenhuma delas é iniciada aqui. Cada uma precisa de decisão do proprietário.

> **Sobre a numeração.** Esta é a lista **histórica** do diagnóstico, escrita
> antes da decisão da §5. Seus itens são numerados **1 a 5** de propósito: as
> letras **A a E** pertencem **exclusivamente** à sequência aprovada da §5.7, e
> usar as mesmas letras para as duas listas fazia "B" significar, conforme o
> lugar, "cadastro em duas etapas" ou "T166".

### Proposta original 1 — Decisão de papel (sem código)

Resolver o conflito do B2 antes de qualquer tela. Três saídas possíveis, e a
escolha é de negócio:

1. manter o contrato atual (`rh` + `dp`) e ajustar a direção;
2. conceder `create` ao `master_tecnico` — exige emenda à T030/ADR 0012,
   porque hoje ele é leitura e configuração;
3. revogar `create` do `dp` — exige revisar a Baseline V1, item 12, que lhe
   atribui registro e efetivação.

### Proposta original 2 — Cadastro em duas etapas, se for mesmo desejado

Se "cadastrar sem admitir" é requisito de negócio, ele precisa de **decisão de
modelo** antes de código: onde vive um colaborador sem vínculo, e sob qual
escopo de autorização ele é visível. Hoje a resposta é "em lugar nenhum".
Opções que exigiriam ADR: dar `empresa_id` ao colaborador; ou criar um estado
de rascunho com escopo próprio. **Nenhuma deve ser escolhida por suposição.**

### Proposta original 3 — Melhorias no formulário que já existe

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

### Proposta original 4 — Cobrir a negação do `master_tecnico` com teste

Achado colateral do inventário, e o mais barato de resolver: a recusa de
mutação ao `master_tecnico` em pessoas **não tem teste próprio**. Não há
`escopo-pessoas.util.spec.ts`; `rbac.evaluator.master-tecnico.spec.ts` não
exercita `colaborador`/`create`; e nenhum E2E cobre o caso. A garantia existe
em duas camadas de código, e nenhuma delas é guardada — uma edição futura
poderia abrir a mutação sem que nada reprovasse.

> **Nota de correção (T166, 2026-10-15).** Duas das três afirmações acima
> estão erradas: `rbac.evaluator.master-tecnico.spec.ts:73-86` nega `create`,
> `alter` e `manage` ao `master_tecnico` nos quatro recursos de pessoas, e
> `documentos.e2e-spec.ts:1022-1034` espera **403** quando ele tenta
> `POST /v1/colaboradores`. Continua verdadeiro só que `resolverEscopoPessoas`
> não tem teste unitário próprio. Detalhe no
> [diagnóstico da T166](t166-dados-admissao-perfil-diagnostico.md#4-correção-ao-diagnóstico-da-t165).
> O texto original acima foi preservado.

### Proposta original 5 — Projeção própria da listagem

Pendência já registrada na T164: matrícula, cargo, departamento e admissão
vivem no vínculo, e só entrariam na lista por projeção nova no servidor.

---

## 4. O que esta tarefa entregou

Somente o inventário e este diagnóstico, mais a convergência da T164 no Spec
Kit. **Nenhuma linha de interface, endpoint, migration, campo ou regra.**

As dívidas seguem abertas: **R-3** (T162), **R-3 da revisão da T164**, **S2**
(T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157)
e o registro `teste michell`.

---

## 5. A decisão do proprietário

Aprovada em 2026-10-15, em resposta ao diagnóstico acima. **Esta seção não
autoriza implementação** — ela fixa o rumo para que a próxima tarefa não
precise supor.

### 5.1 O fluxo se chama "Admitir colaborador"

O nome muda porque o modelo nunca permitiu outra coisa: criação do
colaborador, primeiro vínculo e empresa ativa são **atômicos**, numa só
transação. Chamar de "cadastro" prometia uma etapa separada que não existe —
era o **B1** deste documento.

Com isso, o B1 deixa de ser bloqueio e passa a ser **premissa**: a tarefa
seguinte parte da admissão, não de um cadastro sem vínculo.

### 5.2 Quem admite

| Papel            | Pode admitir?                                      |
| ---------------- | -------------------------------------------------- |
| `rh`             | **sim**                                            |
| `dp`             | **sim**                                            |
| `master_tecnico` | **não** — não cria, não edita e não admite pessoas |
| funcionário      | **não** — sem link, sem autopreenchimento          |

Isto **resolve o B2** a favor do contrato que já existe: `rh` + `dp` é
exatamente o que o `rbac.evaluator` e o `resolverEscopoPessoas` concedem hoje,
e a negação do `master_tecnico` fica confirmada como regra de produto, não só
como herança da T030. **Nenhuma mudança de RBAC é necessária.**

Permanece verdadeiro o achado da Proposta original 4: essa negação **não tem teste
próprio**. Agora que ela é regra declarada, cobri-la deixa de ser higiene e
passa a ser proteção de uma decisão.

> **Nota de correção (T166, 2026-10-15).** A negação tem teste no avaliador
> (`rbac.evaluator.master-tecnico.spec.ts:73-86`) e de ponta a ponta
> (`documentos.e2e-spec.ts:1022-1034`). Falta só o teste unitário de
> `resolverEscopoPessoas`. Detalhe no
> [diagnóstico da T166](t166-dados-admissao-perfil-diagnostico.md#4-correção-ao-diagnóstico-da-t165).
> O texto original acima foi preservado.

### 5.3 O formulário será progressivo, em cinco blocos

1. **Admissão e vínculo**
2. **Dados pessoais e contatos**
3. **Organização**
4. **Documentos e dados bancários**
5. **Dependentes e complementos**

Só o **bloco 1** tem contrato hoje. Os blocos 2 a 5 dependem do que a §5.5
exige, e nenhum deles pode ser desenhado antes disso.

### 5.4 A empresa vem da sessão

Exclusivamente da **sessão ativa**. Aparece como **contexto não editável** e
**não pode ser forjada no corpo** da requisição.

O servidor já se comporta assim: `dto.empresaId` nunca é persistido — o escopo
sai da sessão, e divergência produz **404**. A decisão alinha a interface ao
que o servidor já garante, em vez de pedir garantia nova.

### 5.5 Dado pessoal exige contrato próprio antes de existir

**CPF, documentos, dados bancários, raça/etnia, deficiência, gênero, foto e
dependentes** exigem, antes de qualquer implementação:

- **finalidade** declarada;
- **acesso restrito**;
- **auditoria**;
- **retenção**;
- **contrato próprio**.

Isto converte o **B3** — "não há dado cadastral para cadastrar" — de bloqueio
em **sequência de trabalho**: os campos faltam porque ainda não foram
decididos, e serão decididos antes de serem criados. Raça/etnia, deficiência e
gênero são dado sensível na LGPD, e dado bancário é alvo de fraude; nenhum
deles entra por conveniência de formulário.

> **Nota de correção (T166, 2026-10-15).** A LGPD (art. 5º, II) lista origem
> racial ou étnica e dado referente à saúde; **gênero e deficiência não
> aparecem literalmente** na lista. A classificação de cada um é de RH +
> Jurídico. Detalhe no
> [diagnóstico da T166](t166-dados-admissao-perfil-diagnostico.md#3-achados-e-contradições),
> achado D10. O texto original acima foi preservado.

### 5.6 As imagens de referência

Servem **apenas** como inspiração de **agrupamento e clareza**. Não se copia
marca, texto, identidade visual, layout, paleta, ícone ou componente.

### 5.7 A ordem aprovada

|       | Etapa                                                   | Natureza                   |
| ----- | ------------------------------------------------------- | -------------------------- |
| **A** | Integrar a decisão documental da T165                   | documentação — **esta PR** |
| **B** | **T166** — ADR de modelo, finalidade e acesso aos dados | decisão                    |
| **C** | Contrato, API e migrations                              | implementação de servidor  |
| **D** | Admissão mínima                                         | primeira tela real         |
| **E** | Expansão progressiva dos blocos                         | iterativo                  |

> **As letras A a E são exclusivas desta sequência.** A lista histórica da §3
> usa numeração **1 a 5** (Propostas originais).

A ordem tem uma propriedade que vale nomear: **nenhuma tela é desenhada antes
do contrato que a sustenta**, e nenhum dado pessoal nasce antes da ADR que
declara sua finalidade. É a mesma disciplina que fez esta tarefa parar.

> **A T166 é apenas a próxima etapa prevista.** Não foi iniciada: sem branch,
> sem PR, sem ADR escrita, sem código. Ela é citada aqui porque a ordem
> aprovada a nomeia — e por isso aparece classificada como
> `Spec-Kit-Nao-Entrega` nos commits desta tarefa, que entrega **somente** a
> etapa A.

### 5.8 O que a decisão faz com cada bloqueio

| Bloqueio                                    | Destino                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **B1** — não existe criação sem admissão    | **vira premissa**: o fluxo passa a se chamar "Admitir colaborador"                          |
| **B2** — papel aprovado não bate com o RBAC | **resolvido** a favor do contrato atual: `rh` + `dp`, sem mudar RBAC                        |
| **B3** — não há dado cadastral              | **vira sequência**: §5.5 define o que precede a criação dos campos                          |
| **B4** — a fatia pedida já existe           | **continua válido**: o formulário atual é o ponto de partida da etapa D, não algo a refazer |

A **refutação** registrada na Proposta original 3 permanece: o seletor de empresa do
formulário atual **não** permite escolher empresa errada, porque
`GET /v1/empresas` devolve só a ativa.
