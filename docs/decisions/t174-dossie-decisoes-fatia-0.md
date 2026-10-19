# T174 — Dossiê de decisões da Fatia 0 (ADR 0017)

Status: **dossiê decisório. Não decide nenhum gate, não aceita a ADR 0017 e não
autoriza implementação.**
Data: 2026-10-19.
Base: `2a9072040d64daa50326aa18f1602bb160eaae30` (T173, PR #165).
Para: o proprietário, que é quem decide.

A [ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md) continua
**Proposta**. Este dossiê só prepara as decisões que a sua Fatia 0 pede: ordena
os gates, e para cada gate priorizado mostra o que exatamente precisa ser
decidido, as alternativas, o que cada uma custa, quem decide, a evidência e o que
fica parado enquanto não houver resposta. **A resposta é sua.**

## 1. O que este dossiê é e não é

| É                                                                                       | Não é                                                                                               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Uma priorização dos 22 gates, com critérios explícitos e verificáveis.                  | Uma decisão. Nenhum gate foi resolvido, e nenhuma alternativa foi escolhida por você.               |
| Oito fichas de decisão, cada uma com alternativas reais e impacto por alternativa.      | A aceitação da ADR 0017: o status dela não mudou, e só você pode mudá-lo.                           |
| Uma recomendação de qual decisão tomar primeiro (seção 6), claramente marcada como tal. | Autorização de schema, endpoint, tela, RBAC, teste de produto, seed, Docker ou integração.          |
| Documentação: um arquivo novo, mais o Spec Kit.                                         | Parecer jurídico. Onde há tema trabalhista, fiscal ou de proteção de dados, ele aponta quem decide. |

**Fontes usadas, e só elas:**

- a ADR 0017;
- o [diagnóstico de reconciliação](t173-reconciliacao-fluxo-rh-dp.md) e o
  [registro R1 a R40](t173-respostas-rh-dp.md) da T173;
- as ADRs e os contratos existentes (ADRs 0004, 0005, 0007, 0011, 0012, 0013,
  0014, 0015 e 0016, a Baseline V1, as decisões T142, T146, T165, T166 e a
  `PD-SOL-01`);
- o código e os testes atuais, **só como evidência** do que existe hoje.

**Não usei:** fonte externa, Notion, nem a referência de Sólides. Nenhum arquivo
de produto, teste, schema, seed ou configuração foi alterado.

## 2. Como ler

### Campos de cada ficha

| Campo                        | O que contém                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Decisão exata**            | A pergunta que você precisa responder, sem subentendidos, e o que ela **não** decide.                                                      |
| **Alternativas reais**       | Opções que o repositório permite, inclusive "não mudar nada". Nenhuma é uma opção de palha.                                                |
| **Impacto por alternativa**  | Regras atuais, dados e migração, RBAC, auditoria e UX. É análise do dossiê, apoiada na evidência da ficha.                                 |
| **Responsável pela decisão** | Origem do responsável (respostas, decisão anterior ou a definir) e, quando falta, uma **proposta de decisor**, que você confirma ou troca. |
| **Evidência**                | Onde o conflito ou a lacuna está provado, em `caminho:linha`.                                                                              |
| **O que continua bloqueado** | O que não pode começar enquanto não houver resposta.                                                                                       |
| **Como seria registrada**    | O instrumento documental que formaliza a resposta.                                                                                         |

### Risco da decisão

| Nível     | Significa                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------ |
| **Baixo** | Decisão documental ou de processo. Sem dado pessoal novo; não exige, por si só, mudar schema nem RBAC. |
| **Médio** | Muda schema, RBAC ou reabre decisão fechada, sem dado pessoal restrito.                                |
| **Alto**  | Dado pessoal restrito (classe A3) ou semântica trabalhista ou fiscal, com portão externo ainda aberto. |

### Abreviações de caminho

`schema` = `apps/api/prisma/schema.prisma`; `dto` =
`apps/api/src/pessoas/dto/pessoas.dto.ts`; `validacao` =
`apps/api/src/pessoas/validacao-pessoas.util.ts`; `rbac` =
`apps/api/src/auth/authorization/rbac.evaluator.ts`; `colab.service.ts` =
`apps/api/src/pessoas/colaborador/colaborador.service.ts`; Arquivos de `apps/api/src`: `pessoas-auditoria.service.ts` =
`pessoas/pessoas-auditoria.service.ts`; `vinculo.service.ts` =
`pessoas/vinculo/vinculo.service.ts`; `gestor-consulta.service.ts` =
`gestor/gestor-consulta.service.ts`; `audit.types.ts` = `audit/audit.types.ts`;
`logger.module.ts` = `common/logger/logger.module.ts`; `mfa-config.service.ts` =
`auth/mfa/mfa-config.service.ts`. `A7`, `A11`, `A12`,
`A13`, `A15`, `A16` e `A17` = ADRs 0007, 0011, 0012, 0013, 0015, 0016 e 0017 em
`docs/adr/`; `BV1` = `docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md`;
`T142` = `docs/decisions/t142-direcao-visual-b-modais.md`; `T146` =
`docs/decisions/t146-arquitetura-modular-shell.md`; `T166` =
`docs/decisions/t166-dados-admissao-perfil-diagnostico.md`; `SOL` =
`docs/decisions/pacote-decisao-solicitacoes-pessoas.md`; `DIAG` = o diagnóstico
da T173.

## 3. Priorização dos 22 gates

**Critérios, nesta ordem de peso:**

1. **Desbloqueio técnico** — quantas fatias da sequência proposta dependem do
   gate (`DIAG`, seção 6).
2. **Risco** — pela tabela da seção 2.
3. **Insumo externo** — se a decisão depende de informação que não está no
   repositório (regra da folha, alçadas das empresas, ficha de RH + Jurídico).
4. **Reabre decisão fechada** — se qualquer alternativa exige emenda.

Um gate vem antes de outro quando desbloqueia mais, ou o mesmo, com menos risco,
ou quando o outro depende dele.

| Ordem | Gate        | Tema                                                | Desbloqueia                    | Risco | Insumo externo                                         | Reabre decisão fechada?                        |
| ----- | ----------- | --------------------------------------------------- | ------------------------------ | ----- | ------------------------------------------------------ | ---------------------------------------------- |
| 1     | `DP-FLX-01` | Aceite da ADR 0017                                  | pré-condição da Fatia 0 e da 1 | Baixo | nenhum                                                 | não                                            |
| 2     | `DP-FLX-04` | Estados e transições do processo admissional        | fatias 1 e 2                   | Baixo | nenhum                                                 | só nas alternativas B e C (BV1, decisão 15)    |
| 3     | `DP-FLX-21` | Tela própria × modal                                | forma das fatias 1, 3, 5, 8    | Baixo | nenhum                                                 | T142 (item 5); T146, ainda não integrada       |
| 4     | `DP-FLX-10` | Matrícula na efetivação                             | fatia 2                        | Médio | **regra da folha para a matrícula**                    | BV1, decisão 15; matrícula imutável            |
| 5     | `DP-FLX-02` | Gestor solicitante                                  | fatias 3 e 8                   | Médio | nenhum para a alternativa A                            | A15 e `PD-SOL-01`, nas alternativas B e C      |
| 6     | `DP-FLX-03` | Alçadas de aprovação                                | fatias 3, 7 e 8                | Médio | **alçadas de cada empresa**                            | BV1, decisão 7; A7, decisão 8                  |
| 7     | `DP-FLX-19` | Projeção do gestor no processo                      | fatias 3 e 8                   | Médio | nenhum                                                 | A15, decisão 7                                 |
| 8     | `DP-FLX-07` | Catálogo de tipos de vínculo                        | fatia 4                        | Médio | tipos realmente usados pelas empresas                  | A7, decisão 4, conforme a leitura              |
| 9     | `DP-FLX-08` | Catálogo de campos e regras por tipo e etapa        | fatias 4 e 9                   | Médio | RH/DP: obrigatoriedade por campo                       | `DP-28`; A15, decisão 1, se gestor por vínculo |
| 10    | `DP-FLX-11` | Movimentações ampliadas e correção                  | fatia 7                        | Médio | DP: impacto em folha e eSocial                         | BV1, decisão 11, e ADR 0004, conforme leitura  |
| 11    | `DP-FLX-12` | Desligamento: etapas, campos, motivos, checklist    | fatias 8 e 9                   | Alto  | **DP valida a classificação dos motivos**              | catálogo neutro de motivos                     |
| 12    | `DP-FLX-05` | CPF                                                 | fatias 5 e 6                   | Alto  | **ficha de RH + Jurídico; MFA imposto**                | A7, decisão 2                                  |
| 13    | `DP-FLX-06` | Demais categorias do cadastro inicial               | fatia 5                        | Alto  | ficha por categoria (RH + Jurídico)                    | BV1, decisão 1                                 |
| 14    | `DP-FLX-09` | Múltiplos vínculos                                  | fatia 6                        | Alto  | depende de `DP-FLX-05`; semântica trabalhista e fiscal | BV1, decisão 3; A7, decisão 3                  |
| 15    | `DP-FLX-14` | Documentos por vínculo, categoria e período         | fatia 10                       | Alto  | Nível 2 da Etapa 2                                     | `DP-2E-07`                                     |
| 16    | `DP-FLX-15` | Saúde ocupacional                                   | fatia 10                       | Alto  | RH + Jurídico                                          | `DP-2E-02`                                     |
| 17    | `DP-FLX-16` | Bancário, sindical e dependentes                    | fatia 10                       | Alto  | requisitos do DP e da folha                            | ADR 0016 (bloqueados)                          |
| 18    | `DP-FLX-13` | Retenção, temporalidade e descarte                  | fatia 10                       | Alto  | DP e jurídico                                          | `DP-15` e correlatos                           |
| 19    | `DP-FLX-17` | Folha e eSocial                                     | fatia 10                       | Alto  | levantamento técnico da folha                          | `DP-18`                                        |
| 20    | `DP-FLX-18` | Notificações                                        | fatia 10                       | Médio | nenhum                                                 | exclusão da T155                               |
| 21    | `DP-FLX-22` | Grupos "Fuso horário" e "Dados adicionais"          | fatia 10                       | Médio | decisão de produto e consumidor                        | ADR 0016, 6.7 (fora de escopo)                 |
| 22    | `DP-FLX-20` | Reavaliar a exceção do `master_tecnico` em contatos | nenhuma                        | Médio | RH + Jurídico                                          | ADR 0012, Emenda 1                             |

**Leitura da ordem.**

- **Ordens 1 a 3** não tocam dado pessoal, não precisam de insumo externo e
  dependem só de você. Fixam vocabulário, modelo de processo e forma de tela.
- **Ordens 4 a 7** mexem em identificador, papéis e aprovação. São decididas
  melhor depois da ordem 2, porque a `DP-FLX-04` define onde essas coisas moram.
- **Ordens 8 a 11** são catálogos e regras que RH/DP precisam alimentar.
- **Ordens 12 a 14** são as de maior risco e as únicas com **portão duro
  externo** (MFA imposto, ficha de RH + Jurídico). Resolvê-las cedo não
  desbloqueia nada além das fatias 5 e 6.
- **Ordens 15 a 22** só destravam a fatia 10, já bloqueada por portões externos,
  ou não condicionam fatia alguma.

**Dependências entre gates** (o que precisa estar decidido antes de quê):

- `DP-FLX-04` → `DP-FLX-10` (a alternativa D da matrícula depende do modelo de
  processo). **Análise do dossiê:** a `DP-FLX-04` também condiciona a fatia 3,
  porque a solicitação é a etapa 1 do processo; isso **não consta** entre os gates
  prévios da fatia 3 no diagnóstico.
- `DP-FLX-02` → `DP-FLX-19` (o que o gestor vê do processo só faz sentido depois
  de saber se ele solicita).
- `DP-FLX-05` → `DP-FLX-09`, parte (a), e → `DP-FLX-06`.
- `DP-FLX-21` condiciona a forma das telas das fatias 1, 3, 5 e 8, mas **não**
  o comportamento delas.

**Não incluí `DP-FLX-04` na sua lista de candidatas, e o dossiê o prioriza em
segundo lugar.** Você listou CPF, múltiplos vínculos, matrícula, gestor e
alçadas, e UX. A análise de dependências coloca o `DP-FLX-04` antes de três
delas (matrícula, gestor e alçadas), e ele é o de menor risco com maior
desbloqueio. Por isso tem ficha própria (4.2). Se preferir ficar só com a sua
lista, as demais fichas continuam valendo, na ordem 1, 3, 4, 5, 6, 12 e 14.

## 4. Fichas de decisão

### 4.1 `DP-FLX-01` — Aceite da ADR 0017

#### Decisão exata

**Aceitar, ou não, a ADR 0017 — hoje "Proposto" (`A17:3`) — como a referência de
fluxo e de vocabulário da admissão, do vínculo e do desligamento.**

O que o aceite **é**: marcar a ADR como Aceita por uma nota de aprovação, no
mesmo formato da que a ADR 0016 recebeu (`A16:694-705`).

O que o aceite **não é**, pelo texto da própria ADR:

- não emenda nenhuma decisão fechada (`A17:3-8`, `A17:251-272`);
- não aceita a diretriz de UX da decisão 6, cujo aceite é `DP-FLX-21`
  (`A17:210-250`);
- não faz do CPF um critério de identificação da pessoa nem autoriza mais de um
  vínculo ativo na mesma empresa (`A17:251-272`);
- não resolve nenhum dos 13 conflitos nem os outros 21 gates;
- não autoriza código.

#### Alternativas reais

| Id    | Alternativa                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| **A** | Aceitar a ADR como está.                                                                                               |
| **B** | Aceitar depois de ajustes de redação que você apontar. O ajuste e a nota de aprovação saem no mesmo commit documental. |
| **C** | Adiar o aceite e aceitar junto com as decisões `DP-FLX-04` e `DP-FLX-21`.                                              |
| **D** | Não aceitar; devolver a pontos ambíguos de RH/DP (R4, R7/R8, R10) e só então voltar à ADR.                             |

#### Impacto por alternativa

**Em nenhuma alternativa muda regra atual, dado, RBAC, auditoria, UX ou
migração.** A ADR é documental. A diferença está só no repositório e no ritmo:

| Alternativa | O que muda no repositório                                  | O que passa a ser possível                                                             | Risco                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**       | O status da ADR, numa nota de aprovação, em tarefa futura. | A Fatia 0 deixa de ter a pré-condição formal pendente; as fatias citam uma ADR aceita. | Alguém ler o aceite como endosso de CPF ou de vínculos múltiplos. A ADR já nega isso por escrito: no status (`A17:3-8`), na decisão 2, onde os dois aparecem como direcionamentos (`A17:92-116`), e em "O que esta ADR não decide" (`A17:251-272`). |
| **B**       | Pequena revisão da ADR, mais a nota.                       | O mesmo que A, com o texto como você quer.                                             | Atraso curto; nenhum risco novo.                                                                                                                                                                                                                    |
| **C**       | Nada.                                                      | Aceitar tudo de uma vez.                                                               | A Fatia 0 não avança até a `DP-FLX-04` e a `DP-FLX-21` estarem decididas; a `DP-FLX-01` fica sem dono de calendário.                                                                                                                                |
| **D**       | Nada, até chegarem respostas novas.                        | Esclarecer R4, R7, R8 e R10 antes de fixar vocabulário.                                | Reabre rodada com RH/DP. As R1 a R40 continuam a fonte, e respostas novas viram um registro novo, não edição do atual.                                                                                                                              |

#### Responsável pela decisão

**Proprietário.** Origem: **decisão anterior**. A ADR 0016 foi aceita por
aprovação do proprietário (`A16:3-8`, `A16:694`) e a ADR 0015, idem (`A15:38-41`).
Não é preciso RH nem Jurídico para aceitar vocabulário, porque o aceite não fecha
ficha, base legal nem prazo (`A16:700-705`, mesmo critério).

#### Evidência

- `A17:3-8`: "Proposto em 2026-10-19. O aceite cabe ao proprietário
  (`DP-FLX-01`). O aceite não emenda nenhuma decisão fechada e não autoriza
  implementação".
- `A17:48-62`: a seção "Como ler esta ADR" separa fato recebido, conflito técnico,
  decisão pendente e proposta de operação.
- `A17:210-250`: a decisão 6 diz que a diretriz de UX não vem das respostas e que
  aceitá-la é `DP-FLX-21`.
- `A16:694-705`: precedente de nota de aprovação que lista "o que a aprovação não
  faz".
- `DIAG` seções 5 e 6: 13 conflitos e 22 gates, todos abertos.

#### O que continua bloqueado sem resposta

- O aceite continua pendente, e a Fatia 0 fica sem a sua pré-condição formal.
- Nenhuma fatia da sequência pode começar: a fatia 1 lista `DP-FLX-01` entre os
  gates prévios (`DIAG`, seção 6).
- As decisões seguintes podem ser tomadas, mas sobre uma ADR ainda Proposta.

#### Como a decisão seria registrada

Uma **nota de aprovação** na própria ADR 0017, com a citação literal da sua
autorização e a lista do que o aceite não faz, em commit documental de uma
tarefa futura. **A T174 não altera o status da ADR.**

### 4.2 `DP-FLX-04` — Estados e transições do processo admissional

#### Decisão exata

**Qual é o modelo de estados da admissão — as oito etapas da R9, a devolução e o
cancelamento (R12), e a diferença entre "admissão efetivada" e "vínculo ativo"
(R11) — e onde esse modelo vive.**

Três perguntas dentro dela:

1. O processo existe **antes** de existirem Colaborador e vínculo, ou eles são
   criados cedo e o processo só os acompanha?
2. "Efetivada, aguardando início": passa a existir? Se sim, quem torna o vínculo
   `ativo` na data de início — ato explícito de RH/DP ou automação?
3. Quem opera cada transição, em especial as etapas 3, 6 e 7, que a R9 não
   atribui a ninguém (`A17:65-91`, "proposta de operação").

Não decide: quais dados cada etapa coleta (`DP-FLX-05`, `-06`, `-08`), nem as
alçadas (`DP-FLX-03`).

#### Alternativas reais

| Id    | Alternativa                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Estender o modelo atual.** `POST /v1/colaboradores` segue atômico (Colaborador, vínculo `previsto` e movimentação); a "etapa" vira estado ou atributo da movimentação de admissão.                                |
| **B** | **Entidade própria de processo de admissão.** Colaborador, vínculo e matrícula só nascem na efetivação; o atômico de hoje passa a ser o ato de efetivação, e a decisão 15 da Baseline V1 fica preservada nesse ato. |
| **C** | **Entidade própria que referencia Colaborador e vínculo `previsto` criados cedo**, no cadastro prévio; a efetivação ativa o vínculo.                                                                                |

Subalternativas para a pergunta 2, combináveis com qualquer das três:

| Id        | Subalternativa                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| **2.i**   | Manter proibido: efetivar só a partir da vigência (como hoje).                                                |
| **2.ii**  | Permitir efetivar antes da vigência e exigir **ato explícito** de ativação, por RH/DP, na data de início.     |
| **2.iii** | Ativar **automaticamente** na data, por job. Reabre a decisão de que "nenhum job efetiva sozinho" (`A7:424`). |

#### Impacto por alternativa

| Alternativa | Regras atuais                                                                                                                                                          | Dados e migração                                                                                                                                                                                                | RBAC                                                                                           | Auditoria                                                                                           | UX                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A**       | Preserva a decisão 15 e a RI-V6. `SITUACAO_EXIGIDA` (admissão exige vínculo `previsto`) continua. Subalternativas 2.ii e 2.iii exigem mudar `assertVigenciaAlcancada`. | Novos estados em `StatusMovimentacao` (migration aditiva) ou atributo novo. Admissões existentes não precisam migrar.                                                                                           | Sem recurso novo: segue `movimentacao_funcional` e `vinculo_funcional`, só `rh` e `dp`.        | Reaproveita `pessoas.movimentacao.*`; devolução e retomada pedem ações novas no enum `AuditAction`. | O fluxo com etapas caberia no modal atual, mas processo com etapas é justamente o que a diretriz de UX tira do modal (`DP-FLX-21`). |
| **B**       | **Reinterpreta** a decisão 15: o atômico passa a ser a efetivação. O vínculo `previsto` deixa de existir antes dela, e `SITUACAO_EXIGIDA` perde o sentido atual.       | Novo agregado, com `empresa_id` próprio, guardando o candidato **antes** de existir Colaborador. Cada dado do candidato além do nome exige ficha (A16, decisão 5.4). Mapear as admissões `previsto` existentes. | Recurso novo de autorização para o processo (`rh`, `dp`); gestor segue negado até `DP-FLX-02`. | Ações novas no enum `AuditAction`, uma por transição.                                               | Exige tela própria para o processo, e depende de `DP-FLX-21`.                                                                       |
| **C**       | Preserva a criação atômica, mas **mais cedo**: ela passa para o cadastro prévio. A decisão 15 vale, com outro momento.                                                 | Novo agregado de processo; Colaborador e vínculo já existem, então só o nome está aprovado. Dados novos (CPF etc.) vão a agregados próprios, cada um com ficha.                                                 | Recurso novo para o processo. O vínculo `previsto` já tem escopo.                              | Ações novas no enum, mais as de vínculo existentes.                                                 | Como em B.                                                                                                                          |

#### Responsável pela decisão

**A definir.** Origem: nada nas respostas atribui; o diagnóstico registra o gate
como "responsável a definir". **Proposta de decisor (a confirmar):** você, com
RH/DP para as etapas e para quem opera cada uma (a sequência é da R9 e da R11).
Não há dado pessoal nem tema jurídico na pergunta, então não vejo necessidade de
RH + Jurídico aqui.

#### Evidência

- `colab.service.ts:139-165`: `admitir` cria, numa transação, o colaborador
  `inativo`, o vínculo `previsto` e a movimentação de admissão, `programada` se a
  data é futura e `solicitada` se não.
- `validacao:24-33`: `solicitada` e `programada` vão só a `efetivada` ou
  `cancelada`; `efetivada` só a `retificada`. **Não existe devolução** nem estado
  intermediário.
- `validacao:49-63`: a admissão só é efetivada sobre vínculo `previsto`.
- `validacao:247-253`: a efetivação é recusada antes da vigência. Logo
  "efetivada, aguardando início" **não é representável**.
- `schema:930` e `schema:948`: `SituacaoVinculo` (`previsto`, `ativo`,
  `encerrado`) e `StatusMovimentacao` (`solicitada`, `programada`, `efetivada`,
  `cancelada`, `retificada`).
- `A7:424`: "Efetivação automática de movimentação programada" não foi
  implementada; efetivar é ato explícito, com executor identificado.
- `BV1:441-446`: decisão 15, `POST /v1/colaboradores` é admissão atômica.
- `T166:104`: achado D8, admissão efetivada sem correção viável (não reproduzido).
- R9, R11 e R12 em `t173-respostas-rh-dp.md`.

#### O que continua bloqueado sem resposta

- **Fatias 1 e 2.** A entidade de processo e a "efetivada, aguardando início" não
  têm modelo.
- A decisão `DP-FLX-10` perde a sua alternativa mais limpa (D), que depende do
  modelo de processo.
- **Análise do dossiê:** a solicitação da vaga (etapa 1 da R9, fatia 3) fica sem
  lugar no modelo, embora a `DP-FLX-04` não conste entre os gates prévios da
  fatia 3 no diagnóstico.
- O achado D8 da T166 (correção de admissão efetivada) segue aberto.

#### Como a decisão seria registrada

Uma **emenda à Baseline V1** (decisão 15, se B ou C) ou uma **ADR de modelo de
processo admissional**, com a alternativa escolhida e a subalternativa 2.i, 2.ii
ou 2.iii.

### 4.3 `DP-FLX-21` — Tela própria × modal

#### Decisão exata

**Adotar, ou não, como regra de UX do Evolli, tela própria em rota dedicada para o
cadastro completo e para a admissão — e para os demais cadastros extensos —,
restringindo o modal a consulta rápida, confirmação, seleção curta e edição
pontual; e, se sim, como isso emenda a direção visual da T142 e, se for o caso, a
fundação visual da T146.**

Três perguntas dentro dela:

1. **Escopo:** só a admissão e o cadastro de colaborador, ou todos os cadastros
   extensos?
2. **Rota:** como a URL é resolvida, já que hoje o painel não tem roteamento e a
   T142 diz "nenhuma dependência nova"?
3. **O que acontece com os dois modais atuais** de Colaboradores, o de detalhe e o
   de novo colaborador.

Não decide: nenhum campo, nenhum dado e nenhum dos oito grupos da futura tela de
admissão (`DP-FLX-22` e os demais gates continuam valendo).

#### Alternativas reais

| Id    | Alternativa                                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Manter os modais como estão. A diretriz fica registrada e **não** é adotada.                                                                                           |
| **B** | Tela própria **só para a futura admissão** (processo com etapas). O cadastro e o detalhe atuais continuam modais até a fatia correspondente.                           |
| **C** | Tela própria para o cadastro completo de colaborador e para a admissão, e **migração gradual** dos demais cadastros extensos, tela por tela, como a ADR 0014 já manda. |
| **D** | C, mais URL por tela em todo o shell, com links diretos.                                                                                                               |

Subalternativas de rota, combináveis com B, C e D:

| Id      | Subalternativa                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| **r.x** | Trocar de tela por estado interno, sem URL (como hoje).                                                                |
| **r.y** | Roteamento mínimo próprio, sobre a API `history` do navegador, **sem dependência nova**.                               |
| **r.z** | Biblioteca de roteamento: é **dependência nova**, e pede decisão própria (a T142 recusou dependência nova, `T142:83`). |

#### Impacto por alternativa

| Alternativa | Regras atuais                                                                                                                                                                           | Dados e migração                                                                                                                            | RBAC                                                                                                            | Auditoria | UX                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A**       | Nenhuma.                                                                                                                                                                                | Nenhum.                                                                                                                                     | Nenhum.                                                                                                         | Nenhuma.  | Sem mudança. Processo com etapas continuaria dentro de modal.                                                                       |
| **B**       | Emenda à T142 (item 5) só para a admissão. A guarda de descarte do `Modal` (foco preso, confirmação ao fechar com alteração) precisa de equivalente em página, que **não existe hoje**. | Nenhum dado. Código novo de tela e testes.                                                                                                  | Nenhum. A rota nova precisa respeitar a permissão por papel que o shell já aplica (não verifiquei o mecanismo). | Nenhuma.  | Navegação nova, retorno à lista e foco. Em 375 px o modal já ocupa a tela inteira (`T142`), então a diferença no celular é pequena. |
| **C**       | B, para o cadastro de colaborador e para cada tela migrada. A ADR 0014 exige validação visual antes de ampliar, **uma tela por vez** (`T142:76-81`).                                    | Nenhum dado. Reescrever os dois modais de Colaboradores e os testes da tela (o arquivo tem 103 testes; não medi quantos dependem do modal). | Nenhum.                                                                                                         | Nenhuma.  | Mudança de padrão visível ao usuário em várias telas, em sequência.                                                                 |
| **D**       | C, mais política de URL (o que é link, o que é estado).                                                                                                                                 | Nenhum dado. Muda como o shell resolve o destino ativo.                                                                                     | Nenhum, mas qualquer link direto precisa conferir permissão no carregamento.                                    | Nenhuma.  | Links compartilháveis e botão "voltar" do navegador, que hoje não têm efeito.                                                       |

#### Responsável pela decisão

**Proprietário.** Origem: **decisão anterior**. A direção de modais foi aprovada
por você na T142, e a diretriz nova é proposta sua. Não há terceiro obrigatório.
A ADR 0014 pede validação visual por tela, o que cabe ao seu critério.

#### Evidência

- `T142:46`: "Cadastro, edição e detalhe em janelas modais" (item 5 da direção
  aprovada). `T142:71-72`: modal não serve para filtro, navegação ou ação simples.
  `T142:76-81`: expansão tela por tela, com validação visual. `T142:83`:
  "Nenhuma dependência nova".
- `T146:3-7` e `T146:166-167`: a T146 repete a regra de modais, mas é **fundação
  visual aprovada e congelada, ainda não integrada, e não aprova tela alguma**. A
  T142 basta como fundamento do conflito.
- `apps/web/src/screens/pessoas/ColaboradoresScreen.tsx:1294` (detalhe) e `:1395`
  (novo colaborador): os dois modais de Colaboradores.
- `Modal` aparece em 4 arquivos de produção da web e 7 usos:
  `AdministracaoLiderancaScreen.tsx` (3), `EquipeScreen.tsx` (1), `AcaoSituacao.tsx`
  (1) e `ColaboradoresScreen.tsx` (2). O cadastro de horários
  (`CadastroHorariosScreen.tsx`) **não usa `Modal`**, mas também não tem rota
  própria.
- `apps/web/src/app/App.tsx:433`: o destino ativo é estado (`destinoAtivoId`), sem
  URL.
- `apps/web/package.json`: as únicas dependências são `react` e `react-dom`. Não há
  roteador.
- `A17:210-250`: a decisão 6 e o conflito 13 do diagnóstico.

#### O que continua bloqueado sem resposta

- A **forma** das telas das fatias 1, 3, 5 e 8: nenhuma tela de admissão pode ser
  desenhada.
- O desenho do **comportamento** da fatia 1 não depende desta decisão; o da
  **interface**, sim.
- Os modais atuais seguem como a T142 os aprovou, e **nada é migrado**.

#### Como a decisão seria registrada

Uma **nota de superseção parcial na T142** (e na T146, se for o caso), mais, se
houver rota, uma **ADR curta de navegação** com a subalternativa escolhida. Se
`r.z`, a ADR trata também da dependência nova.

### 4.4 `DP-FLX-10` — Matrícula na efetivação

#### Decisão exata

**Quando nasce a matrícula definitiva e quem a produz. A R10 diz: na efetivação,
"conforme a regra do sistema de folha", e um identificador provisório não se
confunde com ela.**

Três perguntas dentro dela:

1. **Momento e modelo** — a matrícula definitiva passa a nascer na efetivação, com
   algo no lugar dela antes? (decidível agora)
2. **Regra de geração** — informada pelo RH ou gerada pelo Evolli, e em que
   formato? (depende da regra da folha, **que não está no repositório**)
3. **Matrículas existentes** — o que acontece com elas.

Não decide: o que a folha faz, nem a integração (`DP-FLX-17`).

#### Alternativas reais

| Id    | Alternativa                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Manter: matrícula informada pelo RH na admissão. A R10 fica registrada como direcionamento futuro até a regra da folha ser conhecida.                     |
| **B** | Identificador provisório gerado na admissão + matrícula definitiva **informada** pelo RH na efetivação.                                                   |
| **C** | Identificador provisório + matrícula definitiva **gerada** pelo Evolli na efetivação (sequência por empresa), seguindo a regra da folha quando conhecida. |
| **D** | O vínculo e a matrícula só nascem na efetivação (exige `DP-FLX-04`, alternativa B); o processo tem o seu próprio código.                                  |

#### Impacto por alternativa

| Alternativa  | Regras atuais                                                                                                                                                                                                                                                                                | Dados e migração                                                                                                                                                                                                                                                                                                       | RBAC                 | Auditoria                                                                                                                                                                                          | UX                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A**        | Nenhuma.                                                                                                                                                                                                                                                                                     | Nenhum.                                                                                                                                                                                                                                                                                                                | Nenhum.              | Nenhuma.                                                                                                                                                                                           | Nenhuma.                                                                                                                                                                                   |
| **B**, **C** | O vínculo nasce sem matrícula definitiva, o que reinterpreta a decisão 15. A matrícula é **imutável** (`T166:43`; `A16:453`): trocar provisório por definitivo exige "escrita única", ou duas colunas. A decisão 2 (funcional, única por empresa, nunca derivada de documento) **continua**. | Hoje `matricula TEXT NOT NULL`, única por empresa (`schema:1042`, `schema:1065`; migration `20260807120000`, linhas 141 e 207). Tornar anulável ou criar coluna nova: migration aditiva, com backfill. `AdmitirColaboradorDto` exige matrícula (`dto:143-155`). Em C, sequência por empresa: cuidado com concorrência. | Nenhum.              | A trilha **não** registra matrícula (`pessoas-auditoria.service.ts:12`; `audit.types.ts:170`), então a mudança não a expõe. A ativação do vínculo já tem ação própria (`pessoas.vinculo.ativado`). | O formulário de admissão deixa de pedir a matrícula. O gestor hoje **vê e ordena por matrícula** (`gestor-consulta.service.ts:245`, `:274`; `A15`, decisão 7): decidir se vê o provisório. |
| **D**        | Depende de `DP-FLX-04`, alternativa B. Dissolve o conflito 2 do diagnóstico.                                                                                                                                                                                                                 | Sem coluna provisória no vínculo; o processo carrega o código. Migrar as admissões `previsto` existentes.                                                                                                                                                                                                              | Como em `DP-FLX-04`. | Como em `DP-FLX-04`.                                                                                                                                                                               | Como em `DP-FLX-04`.                                                                                                                                                                       |

**Alcance medido** (arquivos que citam matrícula, no commit da base): **7 de
produção na API** (`audit.types`, `gestor-consulta.service`, `colab.service`,
`dto`, `pessoas-auditoria.service`, `vinculo.service`, `demo-seed`), **9 de
produção na web** (os dois clientes e as telas de Colaboradores, Equipe, Dados
contratuais, Histórico funcional, Documentos, Solicitações e Visão do período) e
**25 de testes** (10 na API, 15 na web).

#### Responsável pela decisão

**A definir.** Origem: a R10 remete à "regra do sistema de folha", **sem nomear**
quem a conhece. **Proposta de decisor (a confirmar):** o DP informa a regra da
folha (**insumo**, não decisão), e você decide o modelo, depois da `DP-FLX-04`.

#### Evidência

- `dto:27-30` e `dto:143-155`: a matrícula é identificador funcional, único por
  empresa, "nunca é, nem deriva de, documento pessoal" (RI-C1), e é obrigatória
  na admissão.
- `schema:1042`, `schema:1065`; `migration.sql` (20260807120000) linhas 141 e 207:
  `NOT NULL` e índice único `(empresa_id, matricula)`.
- `A7:352-353` (Emenda 1): a matrícula vive em `vinculo_funcional`, única por
  empresa. `BV1:64-80`: decisão 2. `BV1:441-446`: decisão 15.
- `T166:43` e `A16:453`: a matrícula é imutável; o vínculo não tem `PATCH`.
- `gestor-consulta.service.ts:245`, `:274`, `:438`, `:457`: o gestor lê e ordena
  por matrícula.
- `pessoas-auditoria.service.ts:12` e `audit.types.ts:170`: a trilha não carrega
  matrícula.
- R10 e R37. **A regra da folha para matrícula não está no repositório.**

#### O que continua bloqueado sem resposta

- A **fatia 2** (identificador provisório e matrícula na efetivação).
- A pergunta 2 (regra de geração) depende de informação do DP, mesmo que você
  decida a 1.
- Qualquer integração que dependa da matrícula (fatia 10).
- Não verifiquei o que existe em ambiente de produção. O estado dos dados reais é
  insumo seu para dimensionar a pergunta 3.

#### Como a decisão seria registrada

Uma **emenda à Baseline V1** (decisões 2 e 15) e à regra de imutabilidade da
matrícula, com a alternativa e a regra de geração, **depois** de o DP informar a
regra da folha.

### 4.5 `DP-FLX-02` — Gestor solicitante

#### Decisão exata

**O gestor passa a poder _registrar_ no Evolli a solicitação de contratação, de
alteração e de desligamento (R7, R17, R21)? E, como decisão separada, passa a
_aprovar_ o que solicitou (R8)?**

Em nenhum caso a pergunta inclui criar, editar ou efetivar pessoa, vínculo ou
movimentação: as respostas deixam isso com RH/DP (R7, R11, R22).

Há uma ambiguidade da R8 que a decisão precisa fechar: "aprovação do gestor
solicitante" pode ser o gestor confirmar o próprio pedido, ou o gestor dele
aprovar o pedido de um subordinado. As respostas não dizem.

#### Alternativas reais

| Id    | Alternativa                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | O gestor **segue consultivo**. A solicitação acontece fora do sistema, e o RH a registra, informando **quem solicitou**. O gestor é identificado como pessoa pela ligação conta↔colaborador (`DP-23`). |
| **B** | O gestor **registra** a solicitação, num recurso novo, com escopo por equipe e sem criar, editar ou efetivar. O RH recebe e conduz.                                                                    |
| **C** | B, e o gestor também **aprova** o que solicitou (R8), conforme a leitura que você der à ambiguidade acima.                                                                                             |

Subpergunta de B e C: reaproveitar a Central de Solicitações, ou entidade própria.
A Central tem 6 tipos e nenhum é de admissão ou desligamento (`schema:1660-1667`),
e foi desenhada para o colaborador pedir ao RH, o que muda o domínio.

#### Impacto por alternativa

| Alternativa | Regras atuais                                                                                                                                          | Dados e migração                                                                                                                                                 | RBAC                                                                                                                            | Auditoria                                                                       | UX                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A**       | Compatível com `A15:197-198` e `PD-SOL-01`. Fecha o D5 da T166 a favor do consultivo.                                                                  | Um campo novo de "solicitante" (referência ao gestor como pessoa) na solicitação ou no processo.                                                                 | Nenhuma mudança para `gestor`.                                                                                                  | A ação existente, sem valor; o solicitante é um identificador, não texto livre. | O RH digita, sem tela nova para o gestor.                                    |
| **B**       | Emenda à ADR 0015 ("qualquer mutação pelo gestor" não aprovada) e à `PD-SOL-01`, que foi aprovada por RH, Jurídico, Produto, Diretoria e TI/Segurança. | Entidade nova de solicitação (ou tipos novos na Central). Escopo por equipe pela atribuição existente (`A15`, decisões 1 a 5). Sem migração de dados existentes. | Capacidade nova para `gestor`, **hoje negado até na Central** (`rbac:583-586`); recurso novo, rota própria, 404 fora do escopo. | Novas ações no enum `AuditAction`; decidir se a leitura do gestor é auditada.   | Ação "solicitar" na área do gestor ("Minha equipe"); depende de `DP-FLX-21`. |
| **C**       | B, mais emenda à `BV1` decisão 7 (sem workflow de aprovação) e à `A7` decisão 8, no ponto da aprovação.                                                | B, mais um registro de aprovação por solicitação.                                                                                                                | B, mais a distinção entre solicitar e aprovar na matriz.                                                                        | B, mais uma ação por aprovação ou recusa.                                       | B, mais a tela de aprovação.                                                 |

#### Responsável pela decisão

**A definir.** Origem: as respostas não atribuem. **Decisão anterior,
complementar:** a ADR 0015 foi aprovada por você (`A15:38-41`), e a `PD-SOL-01`,
por RH, Jurídico, Produto, Diretoria e TI/Segurança (`SOL:3-6`). **Proposta de
decisor (a confirmar):** você, e, nas alternativas B e C, as áreas que aprovaram a
`PD-SOL-01`, porque a emenda altera uma decisão delas.

#### Evidência

- `rbac:372-378`: `gestor` é negado na superfície administrativa de Pessoas.
- `rbac:583-586`: `gestor` é negado na Central, porque "consultivo não é uma
  capacidade de RBAC: ele não aprova, não recusa e não altera registro
  trabalhista".
- `rbac:589-591`: "O RH registra em nome do colaborador", padrão que a
  alternativa A reaproveita.
- `A15:197-198`: "qualquer mutação pelo gestor" não aprovada. `A15:89-103`: a conta é
  ligada ao colaborador de forma explícita (`DP-23`).
- `SOL:3-6` e `SOL:108-111`: a `PD-SOL-01` e o gestor consultivo.
- `BV1:165-170` e `A7:115-118`: sem workflow de aprovação.
- `T166:101`: o achado D5, a especificação diz que o gestor inicia a solicitação.
- `schema:1660-1667`: os 6 tipos da Central. `schema:1887`: a ligação
  conta↔colaborador.
- R7, R8, R17 e R21.

#### O que continua bloqueado sem resposta

- As **fatias 3 e 8**, em conjunto com `DP-FLX-03` e `DP-FLX-19`.
- O D5 da T166 segue aberto.
- Enquanto não houver decisão **e** alteração de RBAC, o gestor segue sem nenhuma
  mutação, inclusive registrar solicitação.

#### Como a decisão seria registrada

Uma **emenda à ADR 0015** (e, em B ou C, à `PD-SOL-01`), com a alternativa e a
leitura da R8.

### 4.6 `DP-FLX-03` — Alçadas de aprovação

#### Decisão exata

**Quais aprovações existem no Evolli, em que ordem, por quem e em função de quê:
gestor, RH, diretoria e financeira (R8, R17, R22); se são fixas ou configuráveis
por empresa; e se a diretoria passa a existir como papel no sistema.**

Não decide: se o gestor registra a solicitação (`DP-FLX-02`).

#### Alternativas reais

| Id    | Alternativa                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Sem alçadas no sistema.** A aprovação acontece fora, e a diretoria segue como "escalonamento excepcional" (`PD-SOL-01`). O RH registra "aprovado por X em data" como evidência, sem papel novo. |
| **B** | **Alçada fixa e única**: gestor → RH → diretoria, sempre, com papel ou capacidade nova para a diretoria.                                                                                          |
| **C** | **Alçadas configuráveis por empresa**, por tipo de movimentação, nível da vaga ou orçamento.                                                                                                      |

#### Impacto por alternativa

| Alternativa | Regras atuais                                                                                                                                               | Dados e migração                                                                                                | RBAC                                                                                                                                             | Auditoria                                                          | UX                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------- |
| **A**       | Registra uma evidência, sem criar workflow. É o caso mais próximo da `BV1` decisão 7, mas ainda exige confirmar que "registrar a evidência" não é workflow. | Campos de evidência (quem aprovou, quando) no processo ou na movimentação.                                      | Nenhum.                                                                                                                                          | Uma ação de registro.                                              | Uma linha ou campo na tela do RH.              |
| **B**       | Emenda à `BV1` decisão 7 e à `A7` decisão 8.                                                                                                                | Registro de aprovação por etapa.                                                                                | Papel novo para diretoria (`AccessRole` não tem; enum com 9 valores, `schema:26-46`). `financeiro` hoje **não** acessa Pessoas (`rbac:381-382`). | Ações por aprovação e recusa, valores novos no enum `AuditAction`. | Fila de aprovação para a diretoria: tela nova. |
| **C**       | B, mais configuração por empresa. **"Nível da vaga" e "orçamento" não existem no modelo** (nenhuma entidade de vaga, orçamento ou alçada no schema).        | B, mais entidade de regra de alçada e **dados de negócio novos** (vaga, orçamento) que nenhuma decisão aprovou. | B, mais quem administra as alçadas.                                                                                                              | B, mais a mudança de regra.                                        | B, mais a tela de configuração.                |

#### Responsável pela decisão

**A definir.** Origem: a R8 manda seguir "a estrutura de alçadas da empresa",
**sem nomeá-la**. **Proposta de decisor (a confirmar):** você, com a Diretoria,
porque as alçadas são das empresas, e porque a `PD-SOL-01` foi aprovada com a
Diretoria.

#### Evidência

- `rbac:592-593`: "Diretoria não existe como papel: escalonamento excepcional
  acontece fora do sistema".
- `SOL:108-111`: "Diretoria é escalonamento excepcional; até matriz mais
  detalhada, a decisão operacional final permanece com RH".
- `schema:26-46`: `AccessRole`, sem diretoria. Busca no `schema` por vaga,
  orçamento e alçada: só um comentário sobre alçada de RH e Jurídico
  (`schema:40`).
- `BV1:165-170`; `A7:115-118`.
- R8, R17 e R22.

#### O que continua bloqueado sem resposta

- As **fatias 3, 7 e 8**.
- Aprovação financeira e de diretoria no sistema.
- **Insumo necessário:** a estrutura de alçadas de cada empresa, que não está no
  repositório.

#### Como a decisão seria registrada

Uma **emenda à Baseline V1** (decisão 7) e à ADR 0007 (decisão 8), mais, em B ou C,
uma **ADR de alçadas** com o papel novo.

### 4.7 `DP-FLX-05` — CPF

#### Decisão exata

**Quatro perguntas, em ordem:**

1. O CPF passa a ser **coletado** e **exigido** no cadastro inicial (R1)?
2. Como é **tratado**: classe, acesso, proteção, auditoria?
3. Ele serve para **reconhecer a mesma pessoa** (R37) e em que grau: alerta de
   possível duplicidade, ou critério de unicidade?
4. Em que momento da sequência?

Não decide: as outras categorias do cadastro inicial (`DP-FLX-06`) nem os vínculos
múltiplos (`DP-FLX-09`).

#### Alternativas reais

| Id    | Alternativa                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | **Não coletar por ora.** A R1 fica como direcionamento. Segue assim até o MFA e a ficha estarem prontos.                                                                                                       |
| **B** | Coletar como atributo **A3**, em agregado próprio, **obrigatório** na admissão, **sem** qualquer papel de identificação ou unicidade. A ADR 0007, decisão 2, fica intacta. A duplicidade é conferência humana. |
| **C** | B, e o CPF **alerta** o RH sobre possível pessoa já cadastrada (busca assistida), sem unicidade nem chave. A ADR 0016 diz que detectar duplicidade por CPF exigiria emenda à decisão 2.                        |
| **D** | CPF como **critério de unicidade e reconhecimento** da pessoa (R37). Emenda à ADR 0007, decisão 2, índice único e unificação de Colaborador entre empresas.                                                    |

#### Impacto por alternativa

| Alternativa | Regras atuais                                                                                                                                                         | Dados e migração                                                                                                                                                                               | RBAC                                                                                                                                                                                                                            | Auditoria                                                                                   | UX                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **A**       | Nenhuma.                                                                                                                                                              | Nenhum.                                                                                                                                                                                        | Nenhum.                                                                                                                                                                                                                         | Nenhuma.                                                                                    | Nenhuma.                                                                                              |
| **B**       | Categoria nova exige **ficha de tratamento aprovada** e emenda à ADR 0007 (ou ADR própria), porque está fora dos quatro dados aprovados (`BV1:60-62`; `A16:237-262`). | Agregado A3 novo, com `empresa_id` próprio, rota própria e 404, auditoria sem valores (`A16:145-169`). **Proteção em repouso** é decisão nova (`DP-ADM-13`). Sem migração de dados existentes. | A3: `rh` e `dp` da empresa ativa, com **leitura auditada bloqueante**. `master_tecnico` não consta de A2 nem de A3 (`A16:196-200`), e a posição dele em A3 é `DP-ADM-06`, que exige emenda à ADR 0012, decisão 3. Gestor nunca. | **Toda leitura** auditada, sem o valor. O logger já redige `*.cpf` (`logger.module.ts:21`). | Campo obrigatório no cadastro. **Não existem** máscara nem controle por campo (`T166:54`, `T166:69`). |
| **C**       | B, mais emenda à decisão 2 da ADR 0007, no ponto do reconhecimento.                                                                                                   | B, mais consulta por CPF, que exige índice de busca sobre dado A3.                                                                                                                             | B, mais: o resultado do alerta pode revelar pessoa de **outra empresa**, o que fura o isolamento por empresa ativa.                                                                                                             | B, mais auditoria da consulta.                                                              | B, mais o alerta.                                                                                     |
| **D**       | Reabre a decisão 2 da ADR 0007 e a `BV1` ("nunca usar CPF como chave").                                                                                               | B, mais índice único e **unificação de Colaboradores**. Como cada agregado pessoal é por (colaborador, empresa) (`A16:184-192`), unificar é migração de dados.                                 | C, e a pessoa passa a ser visível entre empresas: reabre ADR 0005, decisão 3.                                                                                                                                                   | C.                                                                                          | C.                                                                                                    |

**Portão duro, para B, C e D:** o número do CPF é "documento pessoal" e fica
**bloqueado até o MFA estar habilitado e imposto** (`A16:283-292`, decisão 5.9),
além de `DS-MFA-01`, `DS-MFA-03`, `DP-ADM-07` e `DS-OPS-01`. O lançamento roda com
`MFA_ENABLED=false` (`A13:82-83`), e o MFA depende dessa variável
(`mfa-config.service.ts:27`).

#### Responsável pela decisão

Quem decide o quê, **segundo a ADR 0016** (`A16:245-259`), e não segundo as
respostas, que não atribuem:

| Item                                                      | Quem responde                                  |
| --------------------------------------------------------- | ---------------------------------------------- |
| Coletar ou não, e quando                                  | **Proprietário** (proposta de decisor)         |
| Finalidade, base legal, classificação, retenção, descarte | **RH + Jurídico** (ADR 0012, decisão 1)        |
| Campos exatos e quem lê e altera                          | Proprietário + RH                              |
| Autenticação reforçada                                    | Segurança + Produto (`DS-MFA-01`, `DS-MFA-03`) |
| Proteção em repouso                                       | Segurança (`DP-ADM-13`)                        |

#### Evidência

- `A7:67-70`: documento pessoal "não é chave primária, natural, de unicidade, nem
  componente de rota — em nenhuma hipótese".
- `BV1:43-47`, `BV1:60-62`, `BV1:66-67`: dados aprovados, regra de campo novo e
  "nunca usar CPF como chave".
- `A16:261`: "Sem ficha aprovada, a categoria não existe". `A16:279-282`:
  detectar duplicidade por CPF exigiria emenda. `A16:283-292`: o bloqueio por MFA.
  `A16:483`: CPF é "Identificação documental", classe A3. `A16:502-504`: exigir CPF
  na admissão é `DP-ADM-04`.
- `schema:894`: o CPF está entre as ausências deliberadas. O DTO de admissão não
  tem CPF.
- `logger.module.ts:21`; `T166:54`; `T166:69`.
- R1 (obrigatoriedade) e R37 ("poderá ser utilizado para identificar a pessoa").

#### O que continua bloqueado sem resposta

- As **fatias 5 e 6**.
- **Nenhum dado de CPF pode ser coletado**, nem em ambiente de teste com valor
  real, enquanto o portão do MFA não for atendido.
- A `DP-FLX-06` (demais categorias) e a `DP-FLX-09`, parte (a).

#### Como a decisão seria registrada

Uma **ficha de tratamento do CPF**, no formato da de Contatos, mais a **emenda à
ADR 0007** (ou ADR própria) que a ADR 0016 exige. Se C ou D, a emenda alcança a
decisão 2.

### 4.8 `DP-FLX-09` — Múltiplos vínculos

#### Decisão exata

**Duas decisões independentes, que a R4 mistura:**

- **(a) Reconhecer a mesma pessoa em empresas diferentes**, com cadastro pessoal
  único. Depende de `DP-FLX-05`.
- **(b) Se, e em que condições, cabe mais de um vínculo ativo na _mesma_ empresa.**
  A R4 diz "mais de uma empresa do grupo ou possua mais de um vínculo, quando
  aplicável" e **não afirma** a mesma empresa. A ambiguidade é do texto, e o
  diagnóstico não a resolve.

Não decide: o CPF (`DP-FLX-05`) nem a semântica trabalhista e fiscal do duplo
vínculo (`A16:460`).

#### Alternativas reais

**(a) Reconhecer a pessoa entre empresas**

| Id     | Alternativa                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **a1** | Manter: cada admissão cria um Colaborador, sem reconhecimento entre empresas.                                                            |
| **a2** | Reconhecimento **assistido**: o RH vincula o novo vínculo a um Colaborador que existe em outra empresa (depende de `DP-FLX-05`, C ou D). |
| **a3** | Unificação **automática** por CPF (depende de `DP-FLX-05`, D).                                                                           |

**(b) Mais de um ativo na mesma empresa**

| Id     | Alternativa                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| **b1** | Manter um ativo por (colaborador, empresa).                                                                   |
| **b2** | Permitir vários, distinguíveis por um discriminador (por exemplo, tipo de vínculo ou cargo) que você definir. |
| **b3** | Permitir vários, sem restrição.                                                                               |

#### Impacto por alternativa

| Alternativa    | Regras atuais                                                                                                                                                                                                    | Dados e migração                                                                                                                                                                                                  | RBAC                                                                                                                                                                                                                                 | Auditoria                                                                       | UX                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **a1**         | Nenhuma.                                                                                                                                                                                                         | Nenhum.                                                                                                                                                                                                           | Nenhum.                                                                                                                                                                                                                              | Nenhuma.                                                                        | Nenhuma.                                                                   |
| **a2**, **a3** | `Colaborador` deixa de ser por empresa na prática. A readmissão só alcança colaborador visível no escopo (`vinculo.service.ts:41-52`; `dto:166-171`), e isso muda.                                               | Contatos e perfil já são por (colaborador, empresa) (`A16:184-192`), então unificar a pessoa **não** obriga unificar o perfil. Colaboradores duplicados existentes teriam de ser unificados.                      | O escopo de leitura é derivado dos vínculos. Reconhecer entre empresas **fura o isolamento por empresa ativa** (ADR 0005, decisão 3; T163). A situação do colaborador agrega vínculos e **nunca** sai para o gestor (`A15:122-126`). | Leitura entre empresas precisa ser auditada com a empresa real.                 | O RH precisa de uma tela de reconhecimento e confirmação.                  |
| **b1**         | Nenhuma.                                                                                                                                                                                                         | Nenhum.                                                                                                                                                                                                           | Nenhum.                                                                                                                                                                                                                              | Nenhuma.                                                                        | Nenhuma.                                                                   |
| **b2**, **b3** | Emenda à `BV1` decisão 3 e à `A7:74-78`; reabre o índice `vinculo_funcional_ativo_unico` e os testes da RI-V6. "Duplo vínculo" está fora de escopo, com semântica trabalhista e fiscal não decidida (`A16:460`). | Migration que altera ou troca o índice (`migration.sql` linhas 340-346). O horário liga-se a (colaborador, empresa), não ao vínculo: **não distingue** dois ativos na mesma empresa (`DP-ADM-17`; `schema:1602`). | Nenhum direto.                                                                                                                                                                                                                       | Nenhuma nova, mas a trilha por vínculo passa a ser a única forma de distinguir. | Telas que hoje assumem um vínculo ativo por pessoa precisam escolher qual. |

#### Responsável pela decisão

**A definir.** Origem: a R4 é de RH/DP, mas as respostas não atribuem a decisão.
**Proposta de decisor (a confirmar):** você, com RH/DP, e **Jurídico** para o
caso (b), que toca semântica trabalhista e fiscal. O caso (a) herda os
responsáveis de `DP-FLX-05`.

#### Evidência

- R4 ("quando aplicável") e R37.
- `BV1:83-84` e `A7:74-78`: um vínculo ativo por colaborador e empresa.
- `apps/api/prisma/migrations/20260807120000_colaboradores_vida_funcional/migration.sql:340-346`:
  o índice `vinculo_funcional_ativo_unico`.
- `apps/api/test/pessoas.e2e-spec.ts:932` e `:963`: a RI-V6 é recusada na
  aplicação e **no banco**, com `INSERT` cru.
- `vinculo.service.ts:41-52` e `dto:166-171`: a readmissão alcança só quem é
  visível no escopo, e o vínculo anterior não é reaberto.
- `A16:184-192`: uma pessoa, várias empresas; cada admissão cria um Colaborador.
  `A16:460`: "Duplo vínculo", fora de escopo. `A16:636`: `DP-ADM-17`.
- `schema:1602`: `VinculoHorario` por (colaborador, empresa).
- `A15:122-126`: a situação do colaborador agrega os vínculos.

#### O que continua bloqueado sem resposta

- A **fatia 6**.
- Reconhecer a mesma pessoa entre empresas e mais de um ativo na mesma empresa.
- Hoje já são compatíveis com o índice atual os vínculos ativos da mesma pessoa em
  **empresas diferentes**; o que falta é o reconhecimento.

#### Como a decisão seria registrada

Para (a): **emenda à ADR 0007** (decisão 3), junto com a de `DP-FLX-05`. Para (b):
**emenda à Baseline V1** (decisão 3) e **migration** do índice, só depois de RH/DP
e Jurídico dizerem se o caso existe.

## 5. Gates fora das fichas: por que esperam

| Gate        | Por que não tem ficha agora                                                                                                                                | O que precisa existir antes                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `DP-FLX-19` | Depende de `DP-FLX-02`: o que o gestor vê do processo só faz sentido depois de saber se ele solicita.                                                      | `DP-FLX-02`.                                                        |
| `DP-FLX-07` | Catálogo vem de RH/DP: quais tipos as empresas usam (R3). A leitura de "comportamento" na ADR 0007, decisão 4, também precisa ser definida.                | Lista de tipos efetivamente usados; leitura da decisão 4.           |
| `DP-FLX-08` | Depende do catálogo de tipos e do modelo de processo.                                                                                                      | `DP-FLX-04`, `DP-FLX-07`.                                           |
| `DP-FLX-11` | Depende das alçadas, e salário depende de `DP-14` e `DP-18`.                                                                                               | `DP-FLX-03`, `DP-FLX-04`.                                           |
| `DP-FLX-12` | O DP valida a classificação dos motivos (R23), e o checklist da T155 tem 12 perguntas, das quais R26 e R27 respondem duas.                                 | Validação do DP; `DP-FLX-02`, `-03`.                                |
| `DP-FLX-06` | Uma ficha por categoria (data de nascimento, endereço, contato de emergência), e todas ficam atrás do mesmo portão do CPF.                                 | `DP-FLX-05` e o portão do MFA.                                      |
| `DP-FLX-14` | Documentos exigem o Nível 2 da Etapa 2 (upload) e emenda ao sujeito do documento (`DP-2E-07`).                                                             | Nível 2 da Etapa 2; ADR 0013.                                       |
| `DP-FLX-15` | Saúde ocupacional exige categoria própria e decisão de RH + Jurídico sobre classificação.                                                                  | `DP-2E-02`; `PD-SOL-05`.                                            |
| `DP-FLX-16` | Bancário, sindical e dependentes estão **bloqueados** na ADR 0016, sem consumidor no Evolli.                                                               | `DP-ADM-07`, `-13`, `-14`; requisitos do DP e da folha.             |
| `DP-FLX-13` | Tabela de temporalidade é de DP e jurídico (R35); nenhum dado de pessoas tem retenção decidida (`A16:364-366`).                                            | Tabela de temporalidade; `DP-15`, `DP-ADM-03`.                      |
| `DP-FLX-17` | Depende do levantamento técnico da folha (R36), que não está no repositório.                                                                               | Levantamento técnico; plano de implantação (R40).                   |
| `DP-FLX-18` | Notificação está fora do recorte da T155 e não tem decisão de eventos nem de conteúdo.                                                                     | Decisão de eventos e destinatários.                                 |
| `DP-FLX-22` | "Fuso horário" e "Dados adicionais" estão fora de escopo na ADR 0016 (6.7): o fuso é da operação, não da pessoa, e os dados adicionais não têm consumidor. | Decisão de produto sobre fuso; consumidor para cada dado adicional. |
| `DP-FLX-20` | Não condiciona fatia alguma. A exceção do `master_tecnico` em contatos continua exatamente como está.                                                      | Nada. É reavaliação futura da R31.                                  |

## 6. Recomendação: qual decisão tomar primeiro

**Decida primeiro `DP-FLX-01`, na alternativa A: aceitar a ADR 0017 como está.**

Por quê:

1. É a **única** decisão que depende só de você, e de nada externo.
2. Tem **custo e risco zero** em regra, dado, RBAC, auditoria, UX e migração.
   Muda o status de um arquivo, e uma emenda pode reverter.
3. O próprio texto da ADR já fecha os dois riscos que um aceite poderia abrir: ela
   diz que o aceite não emenda decisão fechada (`A17:3-8`), que a diretriz de UX é
   proposta (`A17:210-250`) e que CPF e vínculos múltiplos são direcionamentos, não
   decisões (`A17:251-272`).
4. É a pré-condição formal que a Fatia 0 e a fatia 1 citam.
5. Dá um vocabulário fixo para decidir todos os outros.

Se preferir não aceitar já, a alternativa B (ajustes de redação) é a mais barata. As
observações O-1 a O-4 que sobraram da T173 são só de redação e não mudam sentido.

**A primeira decisão _de conteúdo_, depois dela, é `DP-FLX-04`.**

- Desbloqueia as fatias **1 e 2**.
- Não toca dado pessoal, não precisa de LGPD nem de insumo externo, e depende só de
  você.
- Define **como** a `DP-FLX-10` pode ser resolvida. Na alternativa B do
  `DP-FLX-04`, o conflito 2 do diagnóstico (matrícula) deixa de existir como
  conflito com a decisão 15.
- Lembro que ela **não estava na sua lista de candidatas**. Incluí por causa da
  análise de dependências (seção 3).

**O que eu não decidiria cedo: `DP-FLX-05` e `DP-FLX-09`.** São as de maior risco,
têm portões duros externos (MFA imposto, ficha de RH + Jurídico, `DS-OPS-01`), e
resolvê-las antes das outras não destrava nada além das fatias 5 e 6.

**Ordem sugerida, para você confirmar ou trocar:**
`DP-FLX-01` → `DP-FLX-04` → `DP-FLX-21` → `DP-FLX-10` (pergunta 1) → `DP-FLX-02` →
`DP-FLX-03` → catálogos (`-07`, `-08`, `-11`, `-12`) → `DP-FLX-05` → `DP-FLX-09`.

**Quatro perguntas de esclarecimento a RH/DP**, que **não dependem de decisão
sua** e que destravam fichas deste dossiê. Elas não são fonte nova, são pedidos de
esclarecimento:

| Pergunta                                                                                                                               | Destrava                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| R4: existe caso real de **dois vínculos ativos na mesma empresa** para a mesma pessoa?                                                 | `DP-FLX-09`, parte (b)       |
| R10: a matrícula da folha é informada ou gerada pela folha? Em que formato, e existe matrícula provisória na folha?                    | `DP-FLX-10`, perguntas 2 e 3 |
| R8: "aprovação do gestor solicitante" é o gestor **confirmar o próprio pedido**, ou o **gestor dele aprovar** o pedido do subordinado? | `DP-FLX-02` e `DP-FLX-03`    |
| R7 e R17: "o gestor solicita" significa **registrar no sistema**, ou comunicar ao RH, que registra?                                    | `DP-FLX-02`                  |

## 7. Como responder

Para cada gate, uma resposta curta basta. O dossiê não exige formato, mas este
evita ambiguidade:

```text
DP-FLX-01: alternativa A (aceitar como está).
DP-FLX-04: alternativa B; subalternativa 2.i.
DP-FLX-21: alternativa C; rota r.y.
```

Cada resposta vira um registro documental (nota de aprovação, emenda, ficha ou
ADR, como cada ficha indica), numa tarefa própria. **Nenhuma resposta autoriza
código por si só**: o código de cada fatia só começa com os gates dela decididos e
com pedido expresso.

## 8. Limites deste dossiê

- **Nada foi decidido.** A ADR 0017 continua Proposta, e os 13 conflitos e os 22
  gates continuam abertos.
- A análise de **impacto** é minha, a partir da evidência citada. Onde não pude
  verificar, digo (por exemplo, o mecanismo de permissão por rota do shell).
- As **contagens de arquivos** foram medidas com busca textual no commit da base
  (`2a90720`).
- **Não verifiquei ambiente de produção**, nem a existência de dados reais. O
  repositório registra dado real bloqueado por `DS-OPS-01`, mas isso é uma
  decisão de portão, não uma verificação do ambiente.
- A **regra da folha** (R10), o **levantamento técnico** (R36) e as **alçadas das
  empresas** (R8) não estão no repositório. Os gates que dependem deles dependem
  de insumo seu ou de RH/DP.
- Nada aqui é **parecer jurídico**. Onde o tema é trabalhista, fiscal ou de
  proteção de dados, o dossiê só aponta quem decide.
