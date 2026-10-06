# Pacote de decisão — escopo do papel `gestor` (DP-8)

**Status: pendente — nenhum item aprovado.** Este documento não implementa nada, não concede
permissão e não cria relação organizacional. Ele existe porque a T150 pediu um Portal da Liderança
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

As seções §2–§6 apresentam uma **decisão a tomar**, as **opções elegíveis** e, onde aplicável, uma
**recomendação técnica claramente marcada como não aprovada**. §7 lista as perguntas que só RH e
Produto conseguem responder. §8 traz os critérios de aceite de uma tarefa futura. Nenhuma decisão
aqui se efetiva sozinha: cada uma exige registro formal — ADR nova, emenda ou aprovação datada —
antes de autorizar código.

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

Dezoito testes **provam** essa negação, entre eles um `describe` chamado
`"gestor: negado enquanto DP-8 nao for decidida"`. Implementar a T150 exigiria reverter testes
escritos de propósito para impedir exatamente isso.

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
2. Ele vê apenas **subordinados diretos** ou toda a estrutura abaixo?
3. Existe **gestão compartilhada** (duas pessoas respondendo pela mesma equipe)? E **interina**?
   E **matricial** (alguém com dois gestores)?
4. Quando um colaborador **muda de lotação**, o gestor anterior perde o acesso **imediatamente**?
5. Quando um colaborador é **desligado**, o gestor continua vendo o histórico dele?
6. Quem **atribui** a liderança no sistema — RH, e por qual tela?
7. Que campos o gestor precisa ver **para decidir o quê**? (a finalidade justifica o campo, não o
   contrário)
8. O gestor pode ver colaboradores de **outra empresa** do grupo? (resposta esperada: não)

## 8. Critérios de aceite de uma tarefa futura

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
- os dezoito testes que hoje provam a negação do gestor forem **atualizados conscientemente**, um a
  um, e não apagados em bloco;
- o conjunto de campos exibidos for o aprovado em §6, com finalidade registrada.

## 9. Impacto estimado, caso aprovado

| Camada               | Impacto                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schema/migration** | Tabela nova de atribuição de liderança (ou FK em nó organizacional), com vigência, FK composta `(id, empresaId)` no padrão já usado, e índice de consulta. Possível materialização de `DP-23`. |
| **RBAC**             | `AuthorizationSubject` ganharia escopo abaixo de empresa — hoje tem três campos e nenhum ramo testa `gestor`. É mudança estrutural no avaliador, não um `case` novo.                           |
| **Auditoria**        | Consulta de dado de terceiro por gestor provavelmente exige trilha. Hoje existe auditoria de mutação; `registrarConsultaGlobal` é o precedente mais próximo, usado por `master_tecnico`.       |
| **Seed**             | Só depois da decisão: criar atribuição de liderança sintética para `gestor.alfa@evolli.local`, que hoje existe **declaradamente** para demonstrar o que **não** é oferecido.                   |
| **Interface**        | Capacidade nova no shell, servida pelo servidor — não um item de menu fixo. Padrão B + modais, conforme a T146.                                                                                |
| **Testes**           | RBAC unitário, E2E com PostgreSQL real, isolamento entre equipes e entre empresas, ausência de mutação, 404 anti-enumeração.                                                                   |

## 10. Declaração

Este pacote **não implementa nada**: nenhum endpoint, controller, model Prisma, migration, regra de
RBAC, ação de auditoria, alteração de seed ou tela. Nenhuma relação organizacional foi inventada,
nenhum campo existente foi reinterpretado e nenhuma negação vigente foi afrouxada. `DP-8` segue
pendente; `DP-23` segue pendente; `PD-SOL-01` e `PD-SOL-05` seguem como os únicos itens aprovados
sobre o papel `gestor`, e nenhum deles autoriza acesso a dados de colaboradores.
