# Pacote de decisão — escopo do papel `gestor` (DP-8)

**Status: APROVADO em 06/10/2026.** Decisão do proprietário do produto, registrada literalmente:

> **"Aprovo as recomendações 1 a 9 para o escopo do gestor e DP-23"**

A aprovação foi formalizada na
[ADR 0015](../adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md) e implementada
pela T151. `DP-8` e `DP-23` passam a **resolvidas — e somente no recorte da ADR 0015**: gestão por
equipe, múltiplas equipes por gestor, subordinados diretos, um principal e no máximo um substituto
vigentes. **Continuam NÃO aprovados** e não foram habilitados: gestão matricial permanente,
autorização por departamento inteiro e autorização por empresa inteira.

Dois itens da decisão 7 ficaram **fora da primeira entrega** por ausência de contrato seguro, e não
por esquecimento: **resumo de jornada** (não existe como dado nem como rota; `DP-3J-12` segue
pendente) e **andamento de solicitações** (`tipo` e `motivo` revelam condição de saúde por
inferência, e `PD-SOL-05` só autoriza "informação operacional mínima", ainda não definida).

O texto abaixo é preservado como o **registro do raciocínio que levou à decisão** — inclusive a
recomendação técnica da §8, que era não aprovada quando escrita e foi acolhida. Nada nele é
reescrito retroativamente.

---

**Contexto original (T150).** Este documento não implementava nada, não concedia
permissão e não criava relação organizacional. Ele existe porque a T150 pediu um Portal da Liderança
somente leitura e o gate técnico da própria tarefa reprovou a implementação.

- **Tarefa de origem:** T150 — Gestor consultivo, com escopo real e somente leitura.
- **Base:** `main` em `078fde5702a6a776d1f9b87e834d96fff4f6a8ba`.
- **Pendência reusada:** **`DP-8` — escopo do papel `gestor`**, aberta na ADR 0006 e reafirmada nas
  ADRs 0007, 0008 e 0010. Os identificadores são **reusados, não recriados**: aprovar um item aqui
  é resolver `DP-8` e a sub-pergunta `P8.2`, já registradas.
- **Quem decide:** Produto e RH (quem é a equipe de um gestor), TI e Segurança (como o escopo é
  aplicado), RH + Jurídico (limites de LGPD — por ADR 0012 decisão 1, **não** "DPO", que não é
  papel provisionado).

## 0. Como usar este formulário

As seções §2–§6 apresentam uma **decisão a tomar** e as **opções elegíveis**. §7 lista as perguntas
que só RH e Produto conseguem responder. §8 reúne a **recomendação técnica, claramente marcada como
não aprovada** — é a direção que a engenharia considera mais defensável, não uma escolha feita em
nome de Produto ou RH. §9 traz os critérios de aceite de uma tarefa futura, §10 o impacto estimado.
Nenhuma decisão aqui se efetiva sozinha: cada uma exige registro formal — ADR nova, emenda ou
aprovação datada — antes de autorizar código.

## 1. Por que este pacote existe, e não uma implementação

A T150 condiciona o código a já existir "contrato seguro e inequívoco para determinar a equipe do
gestor". Não existe. E a ausência **não é lacuna de implementação: é decisão registrada**, tomada
três vezes, por motivos diferentes, e reafirmada no código.

**Faltam três elos independentes. Nenhum deles pode ser suprido sem inventar.**

1. **Não há relação gestor ↔ subordinado, nem estruturalmente.** ADR 0006, decisão 8
   ([`0006`](../adr/0006-modelo-organizacional-interno-baseline-v1.md), §8): _"Nenhuma relação de
   gestor, subordinado ou organograma de colaboradores é antecipada — nem estruturalmente. Nenhum
   nó organizacional é tratado como ponto de ancoragem previsto para uma futura FK de
   responsável/gestor."_ O schema repete a decisão em dois comentários
   (`apps/api/prisma/schema.prisma:515` e `:765`), e uma varredura por `gestorId`, `responsavelId`,
   `liderId`, `managerId`, `supervisorId`, `chefeId`, `reportaA` e `parentId` em todo o schema e em
   todas as migrations retorna **zero campos** — só os comentários que negam a existência.

2. **Não há vínculo entre a conta de acesso e a pessoa.** `DP-23`, descrito no schema
   (`:766-768`) como _"vinculo AccessUser &lt;-&gt; Colaborador: nao materializado"_. As FKs
   `solicitante_user_id` e `executor_user_id` identificam o **ator** de uma operação, nunca a
   pessoa registrada. Consequência direta: mesmo que existisse a relação do item 1, o sistema não
   saberia **qual colaborador é o gestor autenticado** — logo, não saberia de qual equipe partir.

3. **Estrutura organizacional não é fronteira de autorização.** ADR 0006, Baseline V1 item 2, e
   `apps/api/src/organizacao/escopo.util.ts:8-9`: `empresaId` é a **única** fronteira;
   _"Departamento, área e equipe são estrutura — nunca delimitam acesso"_. A mesma ADR antecipou
   literalmente o caso desta tarefa: _"Se, no futuro, departamento ou área precisarem virar
   fronteira de autorização (**por exemplo, um `gestor` restrito a ver só o próprio
   departamento**), essa é uma decisão de autorização nova, com sua própria migration e sua
   própria ADR ou emenda — não uma consequência automática de departamento existir como
   estrutura."_

**O código já recusa, nominalmente, pelo mesmo motivo.** O avaliador RBAC
(`apps/api/src/auth/authorization/rbac.evaluator.ts`) nega o `gestor` em seis ramos, e em cada um
explica por quê:

> `gestor` — escopo pendente (DP-8/DP-16); conceder exigiria escolher a fronteira (equipe?
> departamento? direto ou indireto?) por conta própria. — `:364-366`

> `gestor` é negado. `PD-SOL-01` o definiu como **consultivo**, e consultivo não é uma capacidade
> de RBAC: ele não aprova, não recusa e não altera registro trabalhista. Enquanto "consultivo" não
> virar uma capacidade própria e segura (com escopo de equipe decidido), não há o que conceder.
> — `:477-480`

A negação está coberta por teste, e vale distinguir o que é o quê, porque a contagem bruta de
ocorrências da palavra `gestor` nos arquivos de spec **não** é uma contagem de testes:

| Categoria                                                                         | Quantidade | Onde                                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Testes cujo título nomeia o gestor**, em cenário de negação                     | **6**      | `rbac.evaluator.organizacao.spec.ts:234`; `rbac.evaluator.ponto.spec.ts:193` (`describe("gestor: negado enquanto DP-8 nao for decidida")`); `rbac.evaluator.spec.ts:92`, `:164`, `:225`, `:412` |
| **Casos parametrizados** que apenas incluem o gestor numa lista de papéis negados | alguns     | `documentos.spec.ts:163`, `master-tecnico.spec.ts:240`, `pessoas.spec.ts:147`, `solicitacoes-pessoas.spec.ts:86`, `rbac.evaluator.spec.ts:285`                                                  |
| **Ocorrências textuais que não são testes**                                       | restantes  | entradas da constante `TODOS_OS_PAPEIS` em cinco arquivos, e `master-tecnico.spec.ts:133`, onde o gestor aparece como papel **atribuível** — o oposto de uma negação                            |

O que se pode afirmar sem aproximação: **seis testes nomeiam explicitamente o gestor em cenários de
negação**, há ainda casos parametrizados que o incluem em listas de papéis negados, e **não existe
nenhuma concessão de capacidade ao gestor** — uma busca por `case "gestor"`, `=== "gestor"` ou
`role === "gestor"` em `apps/api/src` não retorna nenhum ramo concessivo.

Implementar a T150 exigiria reverter testes escritos de propósito para impedir exatamente isso.

### 1.1 O campo que parece resolver, e por que não resolve

`AccessUser` tem `unitId` e `teamId` (`schema.prisma`, colunas `unit_id`/`team_id`). À primeira
vista são a resposta. Não são, por quatro razões cumulativas — e usá-los seria precisamente o
"inventar relação organizacional" que a tarefa proíbe:

| Problema                        | Evidência                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sem integridade referencial** | Nas migrations são `TEXT` puro. Nenhuma FK para `equipe` ou `unidade_organizacional`, nenhuma relação Prisma declarada.                                                                                                        |
| **Sem validação na entrada**    | `CreateUserDto` declara `@IsOptional() @IsString() teamId?: string`. Aceita **qualquer** string — inclusive o id de uma equipe de **outra empresa**, o que transformaria o campo em vetor de vazamento entre empresas.         |
| **Invisível ao RBAC**           | `AuthorizationSubject` tem exatamente três campos: `userId`, `role`, `companyId` (`permission.types.ts:126-130`). O guard monta o sujeito assim e nunca lê `unitId`/`teamId`. Nenhuma decisão de autorização os consulta hoje. |
| **Semântica indefinida**        | Nada no repositório diz se `teamId` significa "equipe que este usuário **lidera**" ou "equipe a que este usuário **pertence**". São coisas opostas para efeito de escopo, e escolher uma é decidir `DP-8` por conta própria.   |

Além disso o campo não tem vigência nem histórico: uma mudança de lotação o sobrescreveria sem
deixar rastro de quem respondia pelo quê e quando.

**A ausência de FK é original e deliberada, e a dívida continua aberta.** A ADR 0003, decisão 8
([`0003`](../adr/0003-identidade-sessao-e-autorizacao.md), §8), já registrava:

> `company_id`/`unit_id`/`team_id` em `access_user` são referências técnicas (`uuid`), **sem
> `FOREIGN KEY` reforçada**, **até a Etapa 1 criar essas entidades de fato**.

A condição citada **já se cumpriu**: `Equipe` e `UnidadeOrganizacional` existem desde a Etapa 1
(ADR 0006, T104–T109). A FK que a ADR 0003 postergou, porém, **nunca foi adicionada** — as colunas
seguem `TEXT` solto. Isso é uma dívida de integridade referencial preexistente, independente de
`DP-8`: ela não impede nem autoriza o escopo do gestor, mas qualquer decisão que venha a dar
significado a esses campos precisa resolvê-la antes, sob pena de transformar um campo sem validação
em fronteira de autorização.

Registrada aqui como **pendência observada**, não tratada por esta tarefa.

## 2. Decisão — a unidade de subordinação

**A decidir:** o escopo de um gestor é definido por **vínculo com um nó organizacional** ou por
**vínculo com pessoas**?

| Opção                                          | Como seria                                                                | A favor                                                                                    | Contra                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **A — Nó organizacional** (gestor da Equipe X) | FK de responsável no nó, ou tabela de atribuição `(nó, gestor, vigência)` | Acompanha reorganização automaticamente; poucas linhas; casa com a estrutura que já existe | Não representa gestão de pessoa fora da equipe formal; exige decidir qual nível (unidade? departamento? área? equipe?) |
| **B — Pessoa a pessoa** (gestor de Fulano)     | Tabela `(colaborador, gestor, vigência)`                                  | Exato; representa matricial e exceções                                                     | Cresce com o quadro; toda admissão exige atribuir gestor; reorganização vira migração de dados                         |
| **C — Híbrido**                                | Nó como regra geral, pessoa como exceção                                  | Cobre os dois casos reais                                                                  | Duas fontes de verdade para a mesma pergunta — a mais cara de operar e de auditar                                      |

Nenhuma é "a óbvia": é decisão de **negócio**, não de engenharia. A ADR 0006 registrou essa mesma
pergunta como `P8.2` e a classificou explicitamente como _"genuinamente futura"_.

> **Fato novo que a T150 traz.** A ADR 0006 condicionou responder `P8.2` à existência da entidade
> colaborador: _"só poderá ser respondida quando a entidade colaborador existir"_. **Essa
> pré-condição foi satisfeita** — `Colaborador`, `VinculoFuncional` e `AlocacaoOrganizacional`
> existem e são funcionais desde as T104–T117 e a T147. `DP-8` deixou de estar bloqueada por
> ausência de modelo; está pendente apenas de **decisão**.

## 3. Decisão — alcance: direto ou indireto

**A decidir:** o gestor enxerga apenas quem responde diretamente a ele, ou toda a subárvore abaixo?

Pergunta já registrada como aberta na ADR 0006 (§"O que permanece explicitamente futuro"). Tem
consequência estrutural: alcance indireto exige travessia hierárquica, e **a hierarquia recursiva
foi deliberadamente não criada** (ADR 0006, decisão 8). Escolher "indireto" implica também decidir
como representar a árvore — uma segunda decisão, não um detalhe da primeira.

## 4. Decisão — vigência, histórico e casos de exceção

**A decidir:** a responsabilidade é **estado atual** ou **fato historiado**?

O produto já resolveu essa classe de pergunta para alocação, com `vigenteDe`/`vigenteAte` em
`AlocacaoOrganizacional`. Aplicar o mesmo padrão à liderança responde de uma vez:

- o que acontece com o escopo quando o gestor **muda de lotação**;
- o que acontece com o escopo quando o **subordinado** muda de lotação;
- se uma consulta a dado de equipe feita no passado permanece explicável na auditoria;
- como representar **gestão compartilhada, interina ou matricial** (terceira pergunta já aberta na
  ADR 0006).

Sem vigência não há como responder "quem respondia por esta pessoa em março" — e, sem isso, uma
trilha de auditoria de consulta por gestor não é interpretável depois.

## 5. Decisão — identidade do gestor autenticado (`DP-23`)

**A decidir, e é pré-requisito de todas as anteriores:** como o sistema sabe **qual pessoa** é o
usuário logado?

Enquanto `DP-23` estiver aberta, qualquer modelagem das §2–§4 fica inalcançável em tempo de
execução: o servidor teria a relação "gestor ↔ equipe" no banco e ainda assim não conseguiria ligar
a sessão autenticada a um `Colaborador`. As opções são materializar o vínculo
`AccessUser ↔ Colaborador` ou ancorar a liderança diretamente no `AccessUser` — e esta segunda
reintroduz o problema de `teamId` descrito em §1.1, agora em escala maior.

Isto **não** é uma quarta decisão independente: é a dependência que ordena as outras.

## 6. Decisão — que dados um gestor consultivo pode ver

**A decidir:** o conjunto mínimo de campos, por finalidade declarada.

Dois limites **já estão decididos** e não se reabrem aqui:

- **`PD-SOL-05` (aprovada em 2026-09-29):** _"gestor recebe apenas a informação operacional mínima
  e nunca o documento"_ — atestado não expõe diagnóstico, CID nem descrição clínica.
- **`PD-SOL-01` (aprovada em 2026-09-29):** gestor é **consultivo** — _"sem alterar registro
  trabalhista"_. Nenhuma mutação, em nenhuma hipótese.

O que falta decidir é o conjunto positivo. Candidatos a **exibir**: nome, situação do vínculo,
cargo e lotação vigentes, data de admissão. Candidatos a **manter exclusivos de RH/DP**: CPF e
demais documentos, data de nascimento, endereço e contato, remuneração, documentos e anexos,
solicitações de natureza pessoal. A lista precisa de aprovação de RH + Jurídico por **finalidade**,
não por conveniência de tela — a Constituição exige menor privilégio e o schema já registra que
dado sensível está fora da fatia atual.

## 7. Perguntas objetivas para RH e Produto

Sem estas respostas não há implementação segura:

1. Um gestor responde por uma **equipe**, por um **departamento**, por uma **unidade**, ou isso
   varia por pessoa?
2. Um mesmo gestor pode responder por **mais de uma equipe ao mesmo tempo**? Se sim, isso é a
   regra ou a exceção? (a resposta muda a cardinalidade do modelo, e corrigi-la depois custa
   migração de dados)
3. Ele vê apenas **subordinados diretos** ou toda a estrutura abaixo?
4. Existe **gestão compartilhada** — duas ou mais pessoas respondendo pela mesma equipe ao mesmo
   tempo? Existe **gestão interina**, por período determinado, durante férias ou afastamento?
   Existe **gestão matricial**, em que um colaborador responde a dois gestores com finalidades
   diferentes? Cada uma destas três é uma pergunta separada, e cada "sim" acrescenta um caso ao
   modelo.
5. Quando um colaborador **muda de lotação**, o gestor anterior perde o acesso **imediatamente**?
6. Quando um colaborador é **desligado**, o gestor continua vendo o histórico dele?
7. Quem **atribui** a liderança no sistema — RH, e por qual tela?
8. Que campos o gestor precisa ver **para decidir o quê**? (a finalidade justifica o campo, não o
   contrário)
9. O gestor pode ver colaboradores de **outra empresa** do grupo? (resposta esperada: não)

## 8. Recomendação técnica — **não aprovada**

> **ACOLHIDA em 06/10/2026 pela ADR 0015.** O aviso abaixo é o texto original, preservado como
> registro: quando escrito, isto era recomendação e não decisão. As decisões 1 a 9 da ADR 0015
> seguem esta direção.
>
> **Esta seção não é decisão.** É a direção que a engenharia considera mais defensável à luz do
> schema atual e das opções das §2–§6. **Não aprova `DP-8` nem `DP-23`**, não autoriza migration,
> endpoint, regra de RBAC nem interface, depende das respostas de Produto, RH e Jurídico (§7), e
> **poderá ser alterada ou descartada** depois dessas respostas. Nada aqui autoriza código.

### 8.1 `DP-23` — identidade do gestor autenticado

Recomenda-se materializar uma relação **explícita, persistida e auditável** entre `AccessUser` e
`Colaborador`, com:

- **restrição de mesma empresa**, aplicada no banco e não só na aplicação — o padrão de FK composta
  `(id, empresaId)` já usado nos nós organizacionais é o precedente natural;
- **unicidade e cardinalidade definidas** explicitamente: quantos usuários por colaborador e
  quantos colaboradores por usuário (o caso trivial — um para um — precisa ser afirmado, não
  presumido);
- **proibição de inferência**: a pessoa **nunca** pode ser deduzida de e-mail, nome, papel ou
  qualquer campo textual. A igualdade de e-mail entre conta e cadastro não é prova de identidade.

Esse vínculo não serve só ao gestor: é a mesma pré-condição do Portal do Colaborador (ESS). Resolver
`DP-23` uma vez destrava as duas capacidades.

### 8.2 Escopo do gestor

Recomenda-se **atribuição explícita e historiada** do gestor a **uma ou mais equipes**, e não
derivação a partir da estrutura:

- **equipe como unidade inicial**, por ser o menor agrupamento operacional do modelo atual — o que
  mantém o escopo estreito por construção e permite ampliar depois, se o negócio pedir;
- **suporte a múltiplas equipes** desde o início: um gestor pode responder por mais de uma, e
  modelar isso depois custa migração de dados;
- **vigência inicial e final**, no mesmo padrão de `AlocacaoOrganizacional`;
- **substituição temporária** representável pela própria vigência, sem campo especial;
- **gestão compartilhada** (duas pessoas na mesma equipe) suportada **somente se aprovada** em §7 —
  é decisão de negócio, não default técnico;
- **alteração de lotação muda o conjunto visível** pela alocação vigente do colaborador: o escopo é
  calculado no momento da consulta, não materializado;
- **nunca** usar `AccessUser.team_id` ou `unit_id` como autorização, pelas razões de §1.1 — sem FK,
  sem validação de empresa, invisíveis ao RBAC e semanticamente ambíguos.

### 8.3 Exceções

- Atribuição direta por **vínculo ou colaborador** apenas como **exceção formal**, auditada e com
  vigência — para o caso real que a equipe não cobre.
- Essa atribuição direta **não** deve virar o modelo principal sem decisão humana explícita: como
  registrado em §2 opção B, ela cresce com o quadro e transforma reorganização em migração.
- **Nunca** autorizar automaticamente um departamento inteiro, uma unidade inteira ou a empresa
  inteira como consequência de o gestor existir. Ampliar o nível é decisão própria, não
  conveniência de implementação.

### 8.4 Histórico

- Decisões de acesso usam o **estado vigente** — o que vale é quem responde pela equipe agora.
- O **histórico de responsabilidade permanece disponível para auditoria**, para que uma consulta
  feita no passado continue explicável depois.
- **Nenhum escopo retroativo deve ser criado silenciosamente**: inserir uma atribuição com vigência
  no passado não pode ampliar, sem registro, o que alguém já podia ver.

## 9. Critérios de aceite de uma tarefa futura

Uma T1xx que implemente o Portal da Liderança só é aceitável se, cumulativamente:

- `DP-8` estiver resolvida por **ADR nova ou emenda formal**, com a unidade de subordinação (§2),
  o alcance (§3) e a vigência (§4) escolhidos explicitamente;
- `DP-23` estiver resolvida, ou a modelagem escolhida dispensar o vínculo com justificativa escrita;
- a relação tiver **FK real** e índice, e o id de equipe/unidade for validado contra a **mesma
  empresa** — o defeito de `teamId` descrito em §1.1 não pode ser reproduzido;
- o escopo for resolvido **no servidor, a partir da sessão**, nunca de `empresaId`, `teamId` ou
  papel vindos do navegador;
- colaborador fora do escopo responder **404**, nunca 403, mantendo o padrão anti-enumeração;
- o gestor não tiver **nenhuma** rota de mutação, e isso for provado por teste, não por ausência de
  botão;
- RH, DP e `master_tecnico` não sofrerem regressão, com os testes de RBAC existentes preservados;
- os seis testes que hoje nomeiam o gestor em cenários de negação, e os casos parametrizados que o
  incluem em listas de papéis negados, forem **atualizados conscientemente**, um a um, e não
  apagados em bloco;
- o conjunto de campos exibidos for o aprovado em §6, com finalidade registrada.

## 10. Impacto estimado, caso aprovado

| Camada               | Impacto                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema/migration** | Tabela nova de atribuição de liderança (ou FK em nó organizacional), com vigência, FK composta `(id, empresaId)` no padrão já usado, e índice de consulta. Possível materialização de `DP-23`. |
| **RBAC**             | `AuthorizationSubject` ganharia escopo abaixo de empresa — hoje tem três campos e nenhum ramo testa `gestor`. É mudança estrutural no avaliador, não um `case` novo.                           |
| **Auditoria**        | Consulta de dado de terceiro por gestor provavelmente exige trilha. Hoje existe auditoria de mutação; `registrarConsultaGlobal` é o precedente mais próximo, usado por `master_tecnico`.       |
| **Seed**             | Só depois da decisão: criar atribuição de liderança sintética para `gestor.alfa@evolli.local`, que hoje existe **declaradamente** para demonstrar o que **não** é oferecido.                   |
| **Interface**        | Capacidade nova no shell, servida pelo servidor — não um item de menu fixo. Padrão B + modais, conforme a T146.                                                                                |
| **Testes**           | RBAC unitário, E2E com PostgreSQL real, isolamento entre equipes e entre empresas, ausência de mutação, 404 anti-enumeração.                                                                   |

## 11. Declaração

Este pacote **não implementa nada**: nenhum endpoint, controller, model Prisma, migration, regra de
RBAC, ação de auditoria, alteração de seed ou tela. Nenhuma relação organizacional foi inventada,
nenhum campo existente foi reinterpretado e nenhuma negação vigente foi afrouxada. `DP-8` segue
pendente; `DP-23` segue pendente; `PD-SOL-01` e `PD-SOL-05` seguem como os únicos itens aprovados
sobre o papel `gestor`, e nenhum deles autoriza acesso a dados de colaboradores.
