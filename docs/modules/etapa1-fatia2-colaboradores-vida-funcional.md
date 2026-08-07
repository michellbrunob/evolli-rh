# Etapa 1 — Fatia 2: Colaboradores e vida funcional

Status: **especificação em revisão (2026-08-07)** — nenhuma implementação
existe. Este documento é **somente especificação**: não cria código,
`schema.prisma`, migration, endpoint, DTO, teste, dependência,
infraestrutura, interface, PR ou merge.

Fase do rito SDD: **Especificar**. Aprovar, Implementar, Verificar e
Registrar são fases posteriores, cada uma com seu próprio ciclo. Esta
fatia **não pode entrar em Implementar** enquanto as decisões pendentes
bloqueantes de §12 não forem resolvidas por quem tem competência para
decidi-las — em especial as de dado pessoal, que dependem de DPO e
jurídico, não de arquitetura.

Depende de (tudo já integrado em `main`, commit
`45ce79bfac9d86f100e0958447c83547350748cd`):

- [Etapa 0 — Fatia 3 (identidade, sessão e autorização)](etapa0-fatia3-identidade-acesso.md)
- [Etapa 0 — Fatia 4 (auditoria formal)](etapa0-fatia4-auditoria-formal.md)
- [Etapa 1 — Fatia 1 (Núcleo Organizacional Interno V1)](etapa1-nucleo-organizacional.md)
- [ADR 0001](../adr/0001-fundacao-api.md), [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)

Decisão arquitetural correspondente: **proposta de ADR 0007**, descrita em
§13. O arquivo da ADR **não é criado** por esta tarefa.

## 0. Contexto decisório e observações registradas

As observações abaixo foram **levantadas e registradas, não resolvidas por
suposição**. Cada uma que exige julgamento de produto, RH, jurídico ou DPO
aparece como decisão pendente em §12.

### O1 — Rastreabilidade com o PRD: pendência herdada, agora devida

A Fatia 1 registrou (O1 daquela spec, e ADR 0005 decisão 7) que o PRD
"Sistema RH - Reserva Fiscal" vive no Notion, **não é versionado no
repositório**, e que a rastreabilidade explícita requisito ↔ spec ↔ teste
seria **pendência da próxima fatia funcional**.

**Esta é aquela fatia.** É a primeira em que requisitos de negócio são
derivados diretamente do PRD, e não apenas de fontes técnicas versionadas.

O contexto funcional usado nesta especificação foi **extraído do PRD pelo
responsável de arquitetura e fornecido como enunciado da tarefa** — está
reproduzido integralmente em §1 ("Contexto funcional recebido"), para que
qualquer revisor possa confrontar o que a spec assume contra o que foi de
fato informado. Nada além disso foi inferido, inventado ou atribuído ao
PRD.

Duas consequências práticas, ambas registradas e não resolvidas aqui:

- **A matriz de rastreabilidade continua não existindo.** Reproduzir o
  extrato no corpo da spec mitiga, mas não substitui, uma matriz
  requisito ↔ spec ↔ teste versionada. Registrado como **DP-27**.
- **Onde o extrato é omisso, a spec não decide.** Toda lacuna vira decisão
  pendente com alternativas objetivas (§12), nunca uma escolha silenciosa
  de arquitetura.

### O2 — Esta é a primeira fatia com dado pessoal de titular

Todas as fatias anteriores puderam declarar, com verificação objetiva, que
não tratavam dado pessoal de colaborador:

- A Fatia 3 trata dado pessoal **de conta técnica** (e-mail de login, hash
  de senha, metadado de sessão) — classificado e registrado naquela spec §2.
- A Fatia 1 da Etapa 1 declarou explicitamente (§7) que **não introduz dado
  pessoal de colaborador**: só estrutura organizacional.

**Esta fatia rompe essa condição.** É a primeira a tratar dado pessoal de
titular pessoa natural na qualidade de colaborador — e, dependendo do que
for aprovado em §5, potencialmente dado pessoal **sensível** (categoria com
regime jurídico próprio na LGPD).

Consequências aplicadas em toda a especificação:

- Nenhum campo de dado pessoal é dado como decidido. Mesmo campos
  operacionalmente indispensáveis a um sistema de RH real (documento
  fiscal, endereço, contato, salário) aparecem **exclusivamente** como
  decisão pendente, com finalidade a declarar (§5).
- Leitura de dado restrito é evento auditável (§9) — diferente da Fatia 1,
  onde leitura dentro da própria empresa deliberadamente **não** gerava
  evento.
- **Nenhuma conformidade LGPD é declarada concluída** por este documento,
  em nenhuma seção.

### O3 — O papel `diretoria` não existe no sistema

O enunciado desta tarefa pede matriz de acesso incluindo **diretoria**.
Verificação objetiva no código integrado em `main`:

- `AccessRole` (enum de banco, `schema.prisma`) tem **8 valores**:
  `admin_tecnico`, `rh`, `dp`, `gestor`, `financeiro`, `colaborador`,
  `auditor`, `dpo`.
- `ACCESS_ROLES` (`apps/api/src/auth/access-roles.const.ts`) espelha
  exatamente esses 8 valores.

**Não existe papel `diretoria`.** Criá-lo não é ajuste de matriz: é
alteração de enum de banco (migration aditiva), do avaliador RBAC/ABAC e
da superfície de autorização em produção.

Esta spec **não cria o papel** e **não concede acesso a ele por
interpretação**. `diretoria` aparece na matriz (§6) explicitamente como
**inexistente e negado**, com a criação registrada como **DP-20**.

### O4 — A exceção do `admin_tecnico` foi concedida sobre estrutura, não sobre dado pessoal

A Emenda 1 da [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md#emenda-1-2026-08-06)
concedeu ao `admin_tecnico` acesso global ao ambiente interno como
**exceção temporária e condicionada**, com prazo de 90 dias a partir de
2026-08-06 (ou seja, **até 2026-11-04**), ou até o início de qualquer
comercialização a terceiros — o que ocorrer primeiro.

Duas observações objetivas:

1. **O contexto daquela concessão era estrutura organizacional sem dado
   pessoal.** A ADR 0006 (§"Itens fora de escopo") e a spec da Fatia 1 (§7)
   afirmam, as duas, que aquela fatia não introduzia dado pessoal de
   colaborador. Estender automaticamente a mesma exceção a dado pessoal —
   e potencialmente sensível — de colaborador seria **ampliar
   materialmente o alcance de uma exceção aprovada em outro contexto**, por
   inércia de implementação.

   Esta spec **não faz essa extensão**. O acesso do `admin_tecnico` ao
   cadastro básico do colaborador é proposto; o acesso a **dado restrito**
   fica **negado por padrão** até decisão explícita — **DP-21**.

2. **O prazo corre durante esta fatia.** Na data desta especificação
   (2026-08-07), restam menos de 90 dias para a reavaliação obrigatória. É
   plausível que a implementação desta fatia atravesse esse marco.
   Registrado como risco **RI-F2-6**, não como bloqueio.

### O5 — Nomenclatura: convenção herdada, prefixo de módulo novo

A Emenda 1 da [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md#emenda-1-2026-08-06)
aprovou a convenção de nomenclatura em português (tipos PascalCase, campos
camelCase, tabelas/colunas snake_case sem acento, rotas plurais
minúsculas, eventos separados por ponto). **Essa convenção se estende
naturalmente a esta fatia** — é convenção de forma, não lista fechada de
nomes.

O que **não** está aprovado é o **prefixo de módulo**. A Fatia 1 usa
`organizacao` (diretório `src/organizacao/`, eventos
`organizacao.<entidade>.<verbo>`). Esta spec propõe **`pessoas`** como
prefixo desta fatia — escolha visível, registrada para confirmação em
**DP-26**, não assumida como aprovada.

O que esta decisão **não** faz, em nenhuma hipótese: renomear qualquer
elemento já implementado. `access_user`, `audit_event`,
`company_id`/`unit_id`/`team_id`, `AuthorizationSubject`,
`rbac.evaluator.ts`, `AuditAction`/`AuditResource`, os sete models
organizacionais e seus 29 verbos de auditoria permanecem exatamente como
estão.

## 1. Objetivo, valor de negócio, escopo e fora de escopo

### Contexto funcional recebido

Reproduzido literalmente (O1), como base de confronto para revisores:

- O sistema deve centralizar cadastro de colaboradores, histórico
  funcional, admissões, desligamentos, transferências organizacionais,
  mudanças de cargo, jornada/escala, férias, afastamentos, retornos e
  movimentações futuras.
- Cada movimentação deve registrar tipo, solicitação,
  efetivação/vigência, status, motivo, solicitante, aprovadores, executor
  e anexos autorizados.
- O histórico precisa preservar situação em uma data de referência; nova
  alteração não pode apagar silenciosamente o registro anterior.
- Dados salariais, familiares, médicos, documentos pessoais e benefícios
  são restritos e não podem ser expostos a gestores por padrão.
- Gestor futuramente verá apenas equipe autorizada; essa regra ainda não
  está decidida e não pode ser inventada.
- Documentos, folha, ponto TXT, benefícios, recrutamento, treinamentos,
  dashboard e Portal do Gestor são módulos separados.
- O ambiente continua interno e single-tenant; `company_id` é o maior
  limite de autorização.
- MFA TOTP permanece obrigatório antes de piloto com dados reais ou
  produção.
- Não usar dados reais em desenvolvimento ou testes.

### Objetivo

Especificar o domínio de **colaborador e vida funcional**: quem é a pessoa
vinculada à organização, qual o vínculo funcional que a liga a uma
`Empresa`, onde ela está alocada na estrutura organizacional já entregue
na Fatia 1, e como toda alteração dessa situação ao longo do tempo é
registrada de forma **imutável, datada, autorizada e auditável**.

O critério de sucesso funcional é único e verificável: **o sistema deve
responder, para qualquer data de referência passada, qual era a situação
funcional de um colaborador — e nenhuma alteração posterior pode apagar
silenciosamente o registro que valia naquela data.**

### Valor de negócio

- **Fonte única da vida funcional.** Hoje o histórico de admissão,
  transferência, promoção, afastamento e desligamento vive fora do
  sistema. Centralizá-lo elimina a planilha paralela como fonte de
  verdade.
- **Capacidade de demonstrar o histórico.** Preservar a situação por data
  de referência é o que permite responder, com evidência do próprio
  sistema, "qual era a lotação, o cargo e o status desta pessoa em tal
  data" — sem depender de reconstrução manual.
- **Pré-requisito técnico de quase toda etapa seguinte.** Documentos e
  admissão digital (Etapa 2), ponto (Etapa 3), folha e DP (Etapa 4) e
  Portal (Etapa 10) **não têm a que se ancorar** sem colaborador e vínculo.
  Esta fatia é a dependência que destrava a sequência do roadmap.
- **Segregação de dado restrito desde o desenho.** Definir agora que dado
  salarial/familiar/médico/documental é segregado, autorizado à parte e
  auditado na leitura evita retrofitar controle de acesso depois de o dado
  já estar espalhado — retrofit que, historicamente, é onde vazamento
  acontece.

### Escopo — entra (nesta especificação)

- Separação conceitual entre colaborador, `AccessUser`, vínculo funcional,
  movimentação funcional, alocação organizacional e acesso futuro ao
  Portal do Colaborador (§3).
- Modelo conceitual das entidades, **sem schema, sem migration, sem
  model Prisma** (§4).
- Inventário de dados e classificação LGPD, com finalidade, minimização,
  acesso, logs, retenção e dependências de RH/jurídico/DPO (§5).
- Matriz de acesso inicial por papel, com negação por padrão onde o escopo
  não estiver aprovado (§6).
- Regras de integridade, incluindo matrícula como identificador
  funcional, unicidade, vínculo com estrutura ativa, conflito de
  movimentações futuras, preservação de histórico e proibição de exclusão
  física (§7).
- Estados e transições propostos para cadastro, vínculo e movimentação,
  **sem automatizar nenhuma decisão trabalhista** (§8).
- Eventos obrigatórios de auditoria e regras de atomicidade (§9).
- Contratos de API futuros, **sem criar endpoint** (§10).
- Estratégia de testes, incluindo autorização negativa, IDOR/BOLA,
  histórico e concorrência (§11).
- Critérios de aceite, riscos, dependências, decisões pendentes e arquivos
  previstos (§12).
- Proposta de ADR 0007 descrita no corpo deste documento (§13).

### Escopo — não entra

- **Nenhum artefato de implementação.** Código, `schema.prisma`,
  migration, endpoint, DTO, guard, teste, dependência, infraestrutura,
  interface, PR ou merge. Esta fase é só documento.
- **Nenhum campo de dado pessoal dado como decidido.** Documento fiscal
  (CPF), documento de identidade (RG), endereço, telefone, dado bancário,
  salário, dado médico, dado familiar/dependente e benefício **não são
  criados nesta spec como campo**, nem "conceitualmente obrigatórios" —
  todos aparecem só como decisão pendente (§5, §12).
- **Nenhuma relação gestor ↔ subordinado.** Nem entidade, nem campo, nem
  convenção de nomenclatura reservada, nem "ponto de ancoragem previsto".
  A ADR 0006 decisão 8 proibiu antecipação estrutural na Fatia 1; esta
  spec **não a introduz por conta própria** só porque a entidade
  colaborador agora existe. É decisão de produto (DP-16, DP-8).
- **Nenhuma criação automática de conta de acesso.** Criar colaborador
  nunca cria `AccessUser`; criar `AccessUser` nunca cria colaborador. O
  vínculo técnico entre os dois não é materializado nesta fatia (§3.1,
  DP-23).
- **Nenhuma regra trabalhista automatizada.** Sem cálculo de saldo ou
  direito a férias, sem período aquisitivo/concessivo, sem cálculo de
  rescisão, sem validação legal de tipo de vínculo, sem aviso prévio, sem
  estabilidade. O sistema **registra** o que RH/DP decidiu; não decide por
  eles (§8).
- **Nenhum módulo vizinho.** Documentos e admissão digital, folha, ponto
  TXT, benefícios, recrutamento, treinamentos, dashboard, Portal do Gestor
  e Portal do Colaborador são módulos separados, cada um com sua etapa.
- **Nenhum armazenamento de anexo.** O modelo prevê o _slot_ de anexo
  autorizado numa movimentação (§4.6), mas **não implementa upload,
  storage, quarentena ou metadado de documento** — isso é Etapa 2. Até
  lá, nenhum anexo pode ser efetivamente armazenado (DP-24).
- **Nenhuma multitenancy.** Sem `tenant`, `tenant_id`, RLS multitenant,
  backfill ou migration retroativa (ADR 0005, decisões 2 e 5,
  inalteradas). `company_id`/`empresa_id` continua o maior limite de
  autorização.
- **Nenhum CNPJ.** DP-4 continua pendente e não é resolvida aqui.
- **Nenhuma alteração de decisão aprovada do Núcleo Organizacional.** As
  9 decisões da Baseline V1 e as duas emendas da ADR 0006 permanecem
  integralmente válidas (§2.2 detalha o que é _extensão aditiva_ e por que
  não é alteração).
- **Nenhum dado real**, em nenhuma hipótese — desenvolvimento, teste,
  exemplo, fixture, seed ou documentação. Todo exemplo deste documento é
  sintético e usa domínio reservado (`exemplo.invalid`).
- **MFA** — decisão inalterada (ADR 0003, decisão 3): obrigatório antes de
  piloto com dados reais ou produção. Esta fatia não implementa nem altera
  isso; **herda a obrigação como pré-condição vinculante**, agravada por
  ser a primeira fatia com dado pessoal de titular (§12, RI-F2-5).

## 2. Relação com o Núcleo Organizacional V1 e dependências integradas

### 2.1 O que já existe e é reaproveitado sem alteração

| Ativo já integrado                                                 | Como esta fatia o usa                                                            |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `Empresa`                                                          | Raiz do escopo. Todo vínculo funcional pertence a exatamente uma empresa         |
| `UnidadeOrganizacional`, `Departamento`, `Area`, `Equipe`          | Destinos possíveis de alocação organizacional                                    |
| `Cargo`                                                            | Cargo da alocação (catálogo por empresa, ADR 0006 decisão 5)                     |
| `CentroCusto`                                                      | Rótulo organizacional da alocação, **sem integração financeira** (ADR 0006 d. 6) |
| `StatusOrganizacional` (`ativo`/`inativo`)                         | Consultado para exigir nó ativo na alocação (R-INA-3 análogo)                    |
| `evaluatePermission` + `AuthorizationGuard` + `@RequirePermission` | Autorização, estendida por ramo novo (nunca alterando ramos existentes)          |
| Padrão de duas fases (capacidade no guard, escopo no service)      | Reaproveitado — o alvo desta fatia também não é um `AccessUser`                  |
| `AuditService.record()` / `recordOrThrow()`                        | Ponto único de escrita de auditoria (ADR 0004 §2)                                |
| `SessionGuard`, `CsrfGuard`                                        | Sessão e CSRF em toda mutação                                                    |
| Padrão anti-enumeração (404 público + evento `denied`)             | Reaproveitado integralmente                                                      |
| Padrão de FK composta com `empresa_id`                             | Reaproveitado para garantir alocação dentro da mesma empresa **no banco**        |
| `AccessUser`                                                       | **Permanece desacoplado** de colaborador (ADR 0003 decisão 8) — ver §3.1         |

### 2.2 O que esta fatia exige acrescentar ao que já existe

Tudo abaixo é **aditivo**. Nenhuma decisão aprovada é revogada,
reinterpretada ou enfraquecida.

| #   | Acréscimo                                                                                | Natureza                                       | Altera decisão aprovada?                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Novos valores em `AuditAction`                                                           | Migration **aditiva** de enum                  | Não — ADR 0004 §5 já prevê extensão por migration aditiva                                                                                                                                                        |
| 2   | Novos recursos em `AuditResource`                                                        | União no código, **sem migration**             | Não — ADR 0004 §5 já prevê extensão sem migration                                                                                                                                                                |
| 3   | Novos recursos em `AuthorizationResource`                                                | União no código                                | Não — mesmo padrão dos 7 recursos organizacionais                                                                                                                                                                |
| 4   | Novo ramo no avaliador RBAC/ABAC (`evaluatePessoas` ou equivalente)                      | Ramo novo, ramos existentes intactos           | Não — mesmo padrão de `evaluateOrganizacao`. Os testes das Fatias 3/4 e da Fatia 1 devem seguir verdes **sem edição**                                                                                            |
| 5   | **Inativação de nó organizacional passa a considerar alocação vigente como filho ativo** | Verificação adicional no Núcleo Organizacional | **Não.** ADR 0006 decisão 7 é "inativação bloqueia com elemento ativo vinculado, nunca cascata". Alocação vigente é uma **nova classe de elemento vinculado** — a regra é aplicada, não alterada. Detalhe abaixo |
| 6   | **Vigência** entra no modelo, nas associações do colaborador                             | Entidade nova desta fatia                      | **Não.** ADR 0006 decisão 9 endereçou explicitamente vigência a esta fatia. Detalhe em §2.3                                                                                                                      |

#### Sobre o acréscimo 5 (o único que toca código já mergeado)

Hoje, inativar um `Departamento` é recusado se ele tiver `Area` ou
`Equipe` ativa. Depois desta fatia, precisa ser recusado **também** se
houver alocação vigente apontando para ele — caso contrário o sistema
permitiria que a lotação vigente de uma pessoa apontasse para um nó
inativo, o que R-INA-3 já proíbe na criação e a reativação já valida.

Isso é **extensão do mesmo princípio**, não exceção a ele. Ainda assim, é
alteração em código já mergeado e testado, e por isso:

- Exige teste de regressão explícito provando que o comportamento anterior
  (bloqueio por filho organizacional ativo) continua idêntico (§11).
- Exige que a mensagem/`status` de recusa permaneça a mesma já
  implementada (409), sem revelar **quem** é o dependente — revelar
  "existe colaborador alocado aqui" a um ator que não pode ler pessoas
  seria vazamento por canal lateral (§7, RI-O1).

### 2.3 Vigência: a pendência que a ADR 0006 endereçou a esta fatia

A ADR 0006, decisão 9, é explícita:

> Nenhum campo de vigência (`vigente_de`/`vigente_ate` ou equivalente) é
> introduzido em `department`, `area`, `team`, `job_role` ou `cost_center`
> nesta fatia. **Vigência será tratada futuramente nas associações do
> colaborador** (cargo, equipe, gestor, centro de custo), quando essa
> entidade existir.

Esta é a fatia em que a entidade existe. Portanto:

- Vigência entra **nas associações do colaborador** (alocação
  organizacional, §4.3), exatamente como a ADR 0006 previu.
- Vigência **não** é retroativamente adicionada aos sete nós
  organizacionais. Eles continuam sem `vigente_de`/`vigente_ate`, tal como
  aprovado. Um `Departamento` não tem vigência; a **alocação de uma pessoa
  naquele departamento** tem.
- A expressão "gestor" naquela citação **não autoriza** criar a relação de
  gestor aqui. A decisão 8 da mesma ADR proíbe antecipá-la; a decisão 9
  apenas diz onde a vigência _moraria_ se e quando ela existir. Continua
  pendente (DP-16).

## 3. Separação conceitual

Cinco conceitos são frequentemente confundidos em sistemas de RH — e a
confusão entre eles é a origem mais comum de vazamento de dado pessoal e
de perda de histórico. Esta seção os separa antes de qualquer modelagem.

### 3.1 Colaborador ≠ `AccessUser`

| Aspecto             | `Colaborador` (esta fatia)                               | `AccessUser` (Fatia 3, já existe)                      |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| O que representa    | Pessoa natural com relação funcional com a organização   | Credencial técnica para entrar no sistema              |
| Existe sem o outro? | **Sim** — a maioria dos colaboradores nunca terá login   | **Sim** — ex.: conta de `admin_tecnico` de bootstrap   |
| Cardinalidade       | Indefinida nesta fatia (DP-23)                           | Indefinida nesta fatia (DP-23)                         |
| Ciclo de vida       | Admissão → vida funcional → desligamento; nunca excluído | Criação → uso → desabilitação; independente do vínculo |
| Dado que carrega    | Dado pessoal e funcional                                 | E-mail de login, hash de senha, papel, escopo          |
| Fronteira de acesso | `empresa_id` do vínculo                                  | `company_id` do próprio `AccessUser`                   |

**Regras invioláveis desta separação:**

- **RS-1 — Colaborador nunca é extensão de `AccessUser`.** Não é herança,
  não é tabela filha, não compartilha chave primária. São entidades
  independentes.
- **RS-2 — Nenhuma criação automática, em nenhuma direção.** Criar
  colaborador **não** cria conta de acesso. Criar conta de acesso **não**
  cria colaborador. Provisionar acesso é ato deliberado, autorizado e
  auditado, separado da admissão.
- **RS-3 — Nenhuma correspondência inferida.** O sistema **nunca** deduz
  que um `AccessUser` e um colaborador são a mesma pessoa por coincidência
  de e-mail, de documento ou de nome. Inferência por igualdade de campo é
  proibida: seria criar vínculo de identidade sem ato de vontade
  registrado.
- **RS-4 — O vínculo técnico entre os dois não é materializado nesta
  fatia.** A [ADR 0003, decisão 8](../adr/0003-identidade-sessao-e-autorizacao.md)
  previu que ele viria "por uma migration futura própria, revisada no
  momento em que a Etapa 1 for implementada". Esta spec **não o cria** —
  ele não é necessário para a vida funcional, e é pré-requisito do Portal
  do Colaborador (§3.5), não desta fatia. Registrado como **DP-23**, com
  alternativas.

Consequência aceita e esperada: **nesta fatia, o sistema não sabe "qual
colaborador é o usuário logado"**. Isso não é lacuna — é a mesma postura
de não antecipação já adotada na Fatia 3 (`access_user` desacoplado) e na
Fatia 1 (gestor não antecipado).

### 3.2 Vínculo funcional

O **vínculo funcional** é a relação formal entre um colaborador e uma
`Empresa`. É ele — não o colaborador — que:

- pertence a exatamente uma empresa (e, por isso, define a fronteira de
  autorização daquele conjunto de dados);
- tem início (admissão) e, eventualmente, fim (desligamento);
- é o objeto ao qual se penduram alocação organizacional e movimentações.

Um colaborador é **quem a pessoa é**; um vínculo é **a relação que ela tem
com uma empresa**. Separá-los é o que permite, se aprovado, que a mesma
pessoa tenha mais de um vínculo — e o que garante que o desligamento
encerre a relação sem apagar a pessoa.

**Não decidido nesta spec:** se um colaborador pode ter mais de um vínculo
(simultâneo ou sequencial), quais tipos de vínculo existem (CLT, estágio,
PJ, aprendiz, temporário, aposentado, outros) e que regras trabalhistas
cada tipo carrega. **DP-12** e **DP-13**.

### 3.3 Movimentação funcional

A **movimentação** é o **evento** que altera a vida funcional: admissão,
transferência organizacional, mudança de cargo, alteração de
jornada/escala, férias, afastamento, retorno, desligamento.

Propriedades essenciais:

- É **registro de um ato**, com solicitante, aprovadores e executor
  distintos e nomeados.
- Tem **duas linhas do tempo distintas**: quando foi _solicitada/decidida_
  e quando _passa a valer_ (vigência/efetivação). As duas quase nunca
  coincidem, e confundi-las é o que quebra a consulta por data de
  referência.
- Depois de **efetivada**, é **imutável**. Correção é retificação — evento
  novo que referencia o original (§4.10).
- Pode ser **programada** para o futuro (§4.9).

### 3.4 Alocação organizacional

A **alocação** é o **estado**: onde, na estrutura organizacional entregue
na Fatia 1, aquele vínculo está posicionado — e **durante qual período**.

A distinção movimentação ↔ alocação é o coração do modelo:

- **Movimentação = evento** ("em 2026-09-01 foi aprovada a transferência
  de X para o departamento Y, solicitada por Z, aprovada por W").
- **Alocação = estado vigente em um intervalo** ("de 2026-09-01 em diante,
  X está no departamento Y, cargo K, equipe E").

Uma movimentação efetivada **encerra** a alocação vigente e **abre** uma
nova. Nenhuma linha é sobrescrita. É isso que faz a consulta por data de
referência ser uma leitura simples, e não uma reconstrução de log.

### 3.5 Acesso futuro ao Portal do Colaborador

O Portal do Colaborador (autoatendimento: o titular consulta os próprios
dados, solicita férias, atualiza cadastro) é **módulo separado, de etapa
posterior** (roadmap, Etapa 10). Fora de escopo aqui.

O que esta fatia registra para não travá-lo depois:

- Ele **exige** o vínculo `AccessUser` ↔ colaborador (RS-4, DP-23) —
  sem ele, não há como responder "quais são os meus dados".
- Ele **exige** decidir o direito de acesso do titular aos próprios dados
  restritos, que é pergunta diferente de "quem mais pode ver" e tem
  implicação de direito do titular (LGPD). Não decidida aqui.
- O papel `colaborador` já existe no enum, mas nesta fatia **não recebe
  nenhum acesso** ao domínio (§6) — porque o que ele acessaria seria
  exatamente o Portal, que não existe.

### 3.6 Quadro-resumo

| Conceito                | Natureza       | Pertence a    | Muda no tempo?                     | Imutável após efetivar? |
| ----------------------- | -------------- | ------------- | ---------------------------------- | ----------------------- |
| `Colaborador`           | Identidade     | —             | Dado cadastral pode ser retificado | Não (mas versionado)    |
| `AccessUser`            | Credencial     | —             | Papel/escopo podem mudar           | Não                     |
| Vínculo funcional       | Relação        | Uma `Empresa` | Início e fim                       | Não                     |
| Alocação organizacional | Estado vigente | Um vínculo    | Sim, por sucessão de períodos      | Período fechado, sim    |
| Movimentação funcional  | Evento/ato     | Um vínculo    | Só até ser efetivada               | **Sim**                 |

## 4. Modelo conceitual inicial (sem schema)

Rascunho conceitual, para revisão. **Nenhuma migration, nenhum model
Prisma, nenhuma tabela é criada nesta fase.** Convenção de leitura:
`[PK]` chave; `[FK]` referência; `[U]` participa de unicidade; `?`
opcional; **`[DP-nn]`** marca campo que **não está decidido** e depende da
pendência indicada.

Nomenclatura conforme convenção aprovada (O5): tipos PascalCase, campos
camelCase, tabelas/colunas futuras snake_case sem acento.

### 4.1 `Colaborador`

```text
colaborador
  id                [PK]  identificador interno, não sequencial previsível
                          (UUID, mesmo padrão desde a Fatia 3)
  matricula         [U]   identificador funcional — escopo de unicidade a
                          decidir [DP-22]
  nome                    nome civil completo — DADO PESSOAL (§5)
  nome_social       ?     [DP-25]
  situacao                enum fechado: ver §8
  criado_em / atualizado_em

  -- NENHUM outro campo de dado pessoal é proposto aqui.
  -- Documento fiscal, documento de identidade, data de nascimento,
  -- endereço, telefone, e-mail pessoal, dado bancário, estado civil,
  -- nacionalidade, escolaridade e afins: [DP-11], não decididos.
  -- Dado familiar, médico, salarial e de benefício: [DP-14], não
  -- decididos, e provavelmente não pertencem a esta entidade (§4.7).
```

**Sobre `id` e `matricula` — são coisas diferentes, de propósito:**

- `id` é **técnico**: opaco, gerado pelo servidor, usado em rota, FK e
  auditoria. Nunca carrega significado de negócio.
- `matricula` é **funcional**: o identificador que RH/DP e a pessoa
  reconhecem, usado em documento e conferência.

Separá-los evita o antipadrão de usar identificador de negócio como chave
técnica — que trava correção de erro de cadastro e vaza informação em URL.

**`matricula` é o identificador funcional. Documento pessoal (CPF ou
qualquer outro) NUNCA é chave**, nem primária, nem natural, nem de
unicidade, nem componente de URL — ver RI-C1 (§7). Isso vale mesmo que
DP-11 venha a aprovar a coleta de CPF.

**Situação do colaborador vs. situação do vínculo.** São distintas: a
pessoa pode não ter nenhum vínculo ativo e continuar existindo (histórico,
possível readmissão). Se `colaborador.situacao` é armazenada ou derivada
dos vínculos é decisão de implementação registrada em §13 (recomendação:
derivada, com materialização controlada, para não divergir).

### 4.2 `VinculoFuncional`

```text
vinculo_funcional
  id                    [PK]
  colaborador_id        [FK] -> colaborador
  empresa_id            [FK] -> empresa      (obrigatório, imutável)
  tipo                        [DP-13] — catálogo de tipos não decidido
  matricula_vinculo     ?     [DP-22] — se a matrícula é do colaborador
                                        ou do vínculo depende do escopo
  data_admissao               data de início do vínculo
  data_desligamento     ?     preenchida só quando o desligamento efetiva
  situacao                    enum fechado: ver §8
  criado_em / atualizado_em

  -- Sem salário, sem jornada contratual, sem cláusula, sem rubrica:
  -- [DP-14] e [DP-18]. Jornada/escala é movimentação (§4.4), e seu
  -- catálogo depende do módulo de Ponto (Etapa 3).
```

`empresa_id` aqui **é a fronteira de autorização** de tudo que pende deste
vínculo. É imutável pelo mesmo motivo de R7 da Fatia 1: mover uma pessoa
entre empresas não é `UPDATE`, é processo próprio com trilha dedicada
(e, provavelmente, desligamento + nova admissão — decisão de RH, não de
arquitetura).

**Cardinalidade colaborador → vínculo não é decidida** (DP-12). O modelo
acima **suporta** 1:N sem se comprometer com ele; se o produto decidir
vínculo único, isso vira restrição de unicidade adicional, aditiva.

### 4.3 `AlocacaoOrganizacional`

O núcleo do requisito "preservar a situação em uma data de referência".

```text
alocacao_organizacional
  id                        [PK]
  vinculo_id                [FK] -> vinculo_funcional
  empresa_id                [FK] -> empresa   (redundante por desenho, para
                                               FK composta — ver R5/RI-A1)
  unidade_organizacional_id [FK] ?            obrigatoriedade: [DP-28]
  departamento_id           [FK] ?            obrigatoriedade: [DP-28]
  area_id                   [FK] ?            (opcional por natureza — a
                                               Area é subdivisão opcional)
  equipe_id                 [FK] ?            obrigatoriedade: [DP-28]
  cargo_id                  [FK] ?            obrigatoriedade: [DP-28]
  centro_custo_id           [FK] ?            (opcional — rótulo)
  vigente_de                      data de início da vigência (inclusiva)
  vigente_ate               ?     data de fim (exclusiva ou inclusiva —
                                  decidir na implementação e documentar);
                                  NULL = alocação vigente atual
  movimentacao_origem_id    [FK] -> movimentacao_funcional
                                  qual evento abriu esta alocação
  criado_em
```

**Propriedades que fazem a consulta por data funcionar:**

- **Sucessão, nunca sobrescrita.** Uma transferência fecha a alocação
  vigente (`vigente_ate` = véspera) e insere uma nova (`vigente_de` = data
  de efetivação). A linha anterior permanece intacta.
- **Não sobreposição.** Duas alocações do mesmo vínculo nunca se
  sobrepõem no tempo — garantido **no banco**, não só na aplicação
  (RI-A2).
- **Consulta por data de referência** é leitura direta:
  `vinculo_id = X AND vigente_de <= D AND (vigente_ate IS NULL OR
vigente_ate > D)` — sem reprocessar log, sem reconstruir estado.
- **Rastreabilidade ao ato.** `movimentacao_origem_id` liga todo estado ao
  evento que o produziu. Não existe alocação sem movimentação que a
  justifique.
- **`empresa_id` redundante é intencional**, exatamente como em `Equipe`
  na Fatia 1: permite FK composta `(departamento_id, empresa_id)` etc., de
  forma que o **PostgreSQL** recuse alocação apontando para nó de outra
  empresa mesmo que a validação de aplicação falhe.

**O que é obrigatório numa alocação não está decidido** (DP-28). Uma
pessoa precisa sempre ter departamento? E cargo? Um recém-admitido pode
ficar sem equipe? São perguntas de RH, não de arquitetura.

### 4.4 `MovimentacaoFuncional`

```text
movimentacao_funcional
  id                    [PK]
  vinculo_id            [FK] -> vinculo_funcional
  empresa_id            [FK] -> empresa      (fronteira de autorização)
  tipo                        enum fechado — ver catálogo abaixo
  status                      enum fechado — ver §8
  solicitada_em               quando foi solicitada (timestamp)
  solicitante_user_id   [FK] -> access_user   quem solicitou
  motivo                ?     texto controlado — ver aviso abaixo
  motivo_codigo         ?     [DP-29] catálogo de motivos não decidido
  vigencia_inicio             data em que passa (ou passou) a valer
  vigencia_fim          ?     só para movimentação de duração definida
                              (ex.: férias, afastamento com retorno previsto)
  efetivada_em          ?     timestamp da efetivação (NULL até efetivar)
  executor_user_id      [FK] ? quem efetivou
  retifica_id           [FK] ? -> movimentacao_funcional (§4.10)
  criado_em / atualizado_em
```

**Catálogo de tipos** — derivado do contexto funcional recebido (§1):

`admissao`, `transferencia_organizacional`, `mudanca_cargo`,
`alteracao_jornada`, `ferias`, `afastamento`, `retorno`, `desligamento`.

Cada tipo tem semântica de **registro**, nunca de cálculo: `ferias`
registra que um período de férias foi decidido e efetivado — **não**
calcula direito, saldo, período aquisitivo ou concessivo (§8). O mesmo
vale para `afastamento` (sem classificação de motivo legal) e
`desligamento` (sem cálculo de rescisão ou aviso).

**Aviso sobre `motivo` em texto livre.** Motivo de afastamento e de
desligamento é exatamente onde dado sensível vaza para campo não
classificado (diagnóstico médico digitado num campo de observação). Duas
salvaguardas propostas:

- **Preferir `motivo_codigo`** (catálogo fechado) sobre texto livre
  (DP-29).
- Se texto livre for aprovado, ele é **dado restrito** por classificação
  (§5.3), com o mesmo controle de acesso e auditoria de leitura dos demais
  restritos — nunca campo aberto no cadastro básico.

### 4.5 `AprovacaoMovimentacao`

O contexto funcional exige registrar **aprovadores** (plural). Uma coluna
`aprovador_id` não expressa isso.

```text
aprovacao_movimentacao
  id                [PK]
  movimentacao_id   [FK] -> movimentacao_funcional
  aprovador_user_id [FK] -> access_user
  ordem             ?     posição na cadeia, se houver cadeia [DP-17]
  decisao                 enum fechado: pendente | aprovada | rejeitada
  decidida_em       ?
  justificativa     ?     dado restrito se contiver motivo pessoal
  criado_em
```

**A matriz de aprovação não é decidida aqui** (DP-17): quem aprova o quê,
se há cadeia ou aprovação única, se o aprovador pode ser o próprio
solicitante, se aprovação é obrigatória por tipo de movimentação. São
regras de governança de RH.

Uma restrição de segurança **é** proposta desde já, por não depender
daquela decisão: **RI-M5 — solicitante e aprovador não podem ser o mesmo
`AccessUser`** na mesma movimentação (segregação de funções). Se o produto
quiser exceção, é decisão explícita.

### 4.6 `AnexoMovimentacao` — slot previsto, não implementado

```text
anexo_movimentacao                     -- NÃO IMPLEMENTÁVEL NESTA FATIA
  id                [PK]
  movimentacao_id   [FK] -> movimentacao_funcional
  documento_id      [FK] -> (módulo de Documentos, Etapa 2)  [DP-24]
  criado_em
```

O contexto funcional pede "anexos autorizados". Anexo de movimentação
funcional é, quase por definição, documento com dado pessoal (atestado,
termo, comprovante). Armazená-lo exige storage privado, quarentena e
metadados — **exatamente o módulo de Documentos, Etapa 2**, que ainda não
existe.

Portanto: **o slot é previsto conceitualmente e não é implementado**. Até
a Etapa 2 existir, nenhum anexo pode ser armazenado. Tentar resolver isso
nesta fatia significaria construir um subsistema de documentos por
atalho, sem os controles que a Etapa 2 vai definir — o caminho mais curto
para vazamento. **DP-24.**

### 4.7 Dado restrito — segregado por desenho

O contexto funcional é explícito: dados salariais, familiares, médicos,
documentos pessoais e benefícios **são restritos e não podem ser expostos
a gestores por padrão**.

**Decisão de desenho proposta:** dado restrito **não mora no cadastro
básico do colaborador**. Ele é segregado em estrutura própria, com
autorização própria e auditoria de leitura própria (§9).

Motivo: se o dado restrito estivesse na mesma entidade do cadastro básico,
toda leitura do cadastro precisaria de projeção condicional por papel —
e uma única consulta esquecida vira vazamento. Segregando, o caminho
padrão de leitura **não tem** como retornar o dado restrito; expô-lo exige
rota, permissão e evento de auditoria distintos.

```text
-- Forma da segregação a definir na implementação (§13). NENHUMA das
-- categorias abaixo é criada nesta spec — todas dependem de [DP-14].
--
-- Categorias identificadas no contexto funcional:
--   * remuneratória      (salário, faixa, reajuste)
--   * familiar           (dependentes, estado civil, filiação)
--   * saúde              (atestado, restrição, acomodação)  -> SENSÍVEL
--   * documental pessoal (documento fiscal, identidade)     -> [DP-11]
--   * benefícios         (adesão, plano)                    -> módulo próprio
```

Nenhuma dessas estruturas é especificada em detalhe aqui: sem DP-11 e
DP-14 resolvidas, especificá-las seria decidir por suposição qual dado
pessoal o sistema coleta — precisamente o que este documento não faz.

### 4.8 Linha do tempo e consulta por data de referência

A "linha do tempo" **não é uma entidade**. É a leitura combinada de duas
fontes que já existem no modelo:

| Pergunta                                       | Fonte                                        |
| ---------------------------------------------- | -------------------------------------------- |
| "Qual era a situação em D?"                    | `alocacao_organizacional` vigente em D       |
| "O que aconteceu, quando, por quem e por quê?" | `movimentacao_funcional` ordenada no tempo   |
| "Por que a situação em D era essa?"            | `movimentacao_origem_id` da alocação vigente |

**Garantia central desta fatia (§1):** para qualquer data de referência
passada, a resposta é reconstruível a partir de linhas **que nunca foram
sobrescritas nem apagadas**. Nenhuma alteração posterior — inclusive
retificação (§4.10) — remove a linha que valia naquela data.

### 4.9 Programação de mudanças futuras

Movimentações podem ser aprovadas hoje com `vigencia_inicio` no futuro
(transferência programada, férias agendadas, desligamento com data
marcada).

Modelagem proposta:

- A movimentação fica em `programada` (§8) até a data de vigência.
- **A alocação correspondente só é criada na efetivação**, nunca na
  programação. Criar a alocação futura antecipadamente introduziria linhas
  vigentes "no futuro" que contaminam toda consulta por data e todo
  cálculo de sobreposição.
- A efetivação de movimentação programada é **ato explícito e auditado**,
  com executor identificado — não um efeito colateral silencioso de um
  job. Se houver automação de efetivação por data, ela é ator `system` na
  auditoria (ADR 0004 §5 já suporta `actor_type: system`), e essa
  automação é **decisão de implementação a registrar**, não pressuposta.
- **Conflito entre programadas é recusado** — ver RI-M3 (§7).

### 4.10 Retificação — corrigir sem apagar

Movimentação **efetivada** é imutável (RI-M1). Erro de lançamento é
corrigido por **retificação**: uma movimentação nova, do mesmo tipo, com
`retifica_id` apontando para a original.

- A original **permanece**, com status `retificada`, visível na linha do
  tempo.
- A retificação registra seu próprio solicitante, aprovadores e executor.
- As alocações produzidas pela movimentação retificada são **encerradas ou
  substituídas**, nunca deletadas — e a substituição também gera linha
  nova.
- Isso é o mesmo princípio já aprovado para a trilha de auditoria
  ([ADR 0004, decisão 3](../adr/0004-auditoria-formal-e-integridade.md)):
  "correção por evento complementar, nunca edição do original". Aplicado
  aqui ao domínio funcional.

**Limite honesto:** retificação corrige o **registro**, não reescreve a
história. Se a alocação errada esteve vigente por um período e algo
dependeu dela, essa dependência não é desfeita automaticamente — nem
deveria ser. Efeito em folha/ponto é decisão de outro módulo (DP-18).

## 5. Inventário de dados e classificação LGPD

**Esta seção não declara conformidade LGPD.** Ela inventaria, classifica e
delimita — e transfere explicitamente para DPO e jurídico o que só eles
podem decidir.

### 5.1 Dados mínimos indispensáveis (propostos)

O conjunto mínimo abaixo é o que torna o domínio **funcionalmente
possível**. Qualquer conjunto menor não permite identificar de quem é a
vida funcional registrada.

| Dado                                       | Classificação                     | Finalidade                              | Minimização aplicada                                       |
| ------------------------------------------ | --------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `colaborador.id`                           | Técnico                           | Chave interna, FK, auditoria            | Opaco; não deriva de dado pessoal                          |
| `colaborador.matricula`                    | Pessoal (identificador funcional) | Identificação funcional interna         | Gerado/atribuído pela organização; não é documento oficial |
| `colaborador.nome`                         | **Pessoal**                       | Identificar o titular da vida funcional | Nome apenas; sem filiação, sem documento                   |
| `vinculo.empresa_id`                       | Organizacional                    | Fronteira de autorização                | Já existente (Fatia 1)                                     |
| `vinculo.data_admissao`                    | Pessoal (funcional)               | Marco inicial do histórico              | Data apenas                                                |
| `vinculo.data_desligamento`                | Pessoal (funcional)               | Marco final do histórico                | Data apenas; **sem motivo** neste campo                    |
| Alocação (nós + vigência)                  | Pessoal (funcional)               | Situação organizacional por data        | Referências a nós já existentes; sem dado pessoal novo     |
| Movimentação (tipo, datas, status, atores) | Pessoal (funcional)               | Rastro do ato funcional                 | Atores são `AccessUser` (dado já tratado na Fatia 3)       |

Mesmo esta lista mínima é **proposta**, não aprovada — DP-11 cobre o
conjunto exato, incluindo a pergunta de se `nome` civil basta ou se
`nome_social` é obrigatório (DP-25).

### 5.2 Dados pessoais comuns — todos pendentes

Nenhum dos itens abaixo é criado como campo por esta spec. Todos dependem
de **DP-11**, com finalidade declarada item a item antes de qualquer
coleta:

documento fiscal (CPF), documento de identidade (RG e equivalentes),
data de nascimento, naturalidade/nacionalidade, endereço residencial,
telefone, e-mail pessoal, estado civil, escolaridade, dados bancários,
foto.

**Sobre o CPF em particular.** É plausível que seja indispensável a um
sistema de RH real (integrações fiscais e trabalhistas o exigem). **Isso
não autoriza criá-lo aqui.** Duas razões:

1. A finalidade concreta que o justificaria pertence a módulos que ainda
   não existem (folha, Etapa 4; documentos, Etapa 2). Coletar antes da
   finalidade é o oposto de minimização.
2. Sendo identificador nacional único, ele exige decisão explícita de
   armazenamento, mascaramento em resposta/log e controle de acesso — não
   pode entrar como "mais um campo".

Independentemente de DP-11: **CPF nunca é chave** (RI-C1) e **nunca
aparece em log, URL, mensagem de erro ou evento de auditoria** — o que já
é vedação vigente (ADR 0004 §5, §6), não novidade desta spec.

### 5.3 Categorias sensíveis e restritas — todas pendentes

| Categoria                                         | Natureza                                | Pendência              |
| ------------------------------------------------- | --------------------------------------- | ---------------------- |
| Dado de saúde                                     | **Sensível** (regime jurídico próprio)  | DP-14                  |
| Dado familiar/dependente                          | Pessoal de **terceiro** não colaborador | DP-14                  |
| Dado remuneratório                                | Restrito (alto impacto se vazado)       | DP-14                  |
| Benefícios                                        | Restrito; pode revelar dado de saúde    | DP-14 + módulo próprio |
| Documento pessoal                                 | Restrito                                | DP-11 + DP-24          |
| Identidade de gênero                              | **Sensível**                            | DP-25                  |
| Motivo de afastamento/desligamento em texto livre | Pode conter dado de saúde               | DP-29                  |

Três alertas objetivos, registrados para não se perderem:

- **Dado familiar é dado de terceiro.** Dependente não é o colaborador e
  não tem relação direta com a organização. A base legal, o direito de
  informação e a retenção são análises próprias, não extensão automática
  da análise do titular colaborador.
- **Benefício pode revelar saúde por inferência.** "Plano X, categoria Y"
  ou adesão a auxílio específico pode revelar condição de saúde sem que
  nenhum campo se chame "diagnóstico". A classificação precisa considerar
  a inferência, não só o rótulo do campo.
- **Dado sensível tem regime distinto.** As hipóteses legais de tratamento
  de dado pessoal sensível não são as mesmas do dado pessoal comum. Esta
  spec **não escolhe hipótese legal** para nenhuma categoria — é decisão de
  DPO/jurídico (DP-14).

### 5.4 Dados proibidos nesta fatia

Não entram, **em nenhuma forma**, nem "só estruturalmente", mesmo que uma
decisão futura os aprove para outro módulo:

- Qualquer dado biométrico.
- Origem racial/étnica, convicção religiosa, opinião política, filiação a
  sindicato ou a organização de caráter religioso/filosófico/político,
  dado referente à vida sexual.
- Registro de ponto, marcação, espelho, jornada realizada (Etapa 3).
- Rubrica, verba, cálculo, provisão, holerite (Etapa 4).
- Conteúdo de documento (Etapa 2).
- Avaliação de desempenho, feedback, plano de desenvolvimento,
  treinamento (Etapas 6 e 8).
- Dado de candidato/recrutamento (Etapa 7).
- Dado de clima, pesquisa, resposta anônima (Etapa 9).
- **Dado real de qualquer pessoa**, em qualquer ambiente que não seja
  produção aprovada — inclusive seed, fixture, exemplo de documentação e
  captura de tela.

### 5.5 Finalidade, minimização e acesso

- **Finalidade declarada por campo, antes da coleta.** Nenhum campo entra
  em DP-11/DP-14 sem finalidade concreta e módulo consumidor identificado.
  "Pode ser útil depois" não é finalidade.
- **Minimização estrutural, não apenas documental.** A segregação do dado
  restrito (§4.7) faz com que o caminho padrão de leitura **não consiga**
  retornar dado restrito — minimização imposta pelo desenho, não pela
  disciplina de quem escreve a consulta.
- **Negação por padrão no acesso** (§6): papel sem escopo aprovado não lê,
  nem parcialmente.
- **Nenhuma exposição a gestor por padrão** — exigência explícita do
  contexto funcional. Nesta spec, `gestor` é negado **integralmente** no
  domínio (§6), não apenas nos campos restritos, porque o escopo dele
  sequer está decidido (DP-8, DP-16).

### 5.6 Logs

Herda integralmente, sem alteração, e estende:

- Proibição de senha, hash, token, cookie, CSRF, CPF, salário e conteúdo
  de documento em claro em qualquer log ou evento
  ([ADR 0004 §5/§6](../adr/0004-auditoria-formal-e-integridade.md)).
- `AllExceptionsFilter` sem vazamento de detalhe interno (ADR 0001).
- **Extensão desta fatia:** nenhum log estruturado registra conteúdo de
  campo de dado pessoal ou restrito — nem em nível `debug`. Log de erro
  referencia o `id` técnico da entidade, nunca `nome`, `matricula` ou
  qualquer valor de dado pessoal.
- **Evento de auditoria continua sem valores antes/depois** (ADR 0004 §5,
  decisão inalterada). A trilha registra _que_ houve retificação de
  cadastro, nunca _qual valor_ mudou. Consequência aceita: a trilha não
  serve para reconstruir o valor anterior de um campo pessoal — e não
  deve servir, sob pena de a própria trilha virar repositório de dado
  pessoal fora de controle.

### 5.7 Retenção

**Não decidida. DP-15.**

Registrado, sem que esta spec resolva:

- A [ADR 0004, decisão 4](../adr/0004-auditoria-formal-e-integridade.md)
  já registra que **não há job de retenção/expurgo** e que todo evento de
  auditoria persiste indefinidamente, aguardando prazo jurídico.
- Dado funcional de colaborador tende a exigir retenção longa por
  obrigação legal e prazo prescricional — **mas esta spec não afirma qual
  prazo**, para qual categoria, nem sob qual fundamento. Inventar prazo é
  tão errado quanto não ter nenhum.
- Retenção provavelmente **difere por categoria** (dado funcional × dado
  de saúde × dado de dependente). Um prazo único para tudo é
  simplificação que DPO/jurídico precisam validar ou rejeitar
  explicitamente.
- **Descarte precisa ser compatível com a imutabilidade do histórico.**
  Há tensão real entre "não apagar registro efetivado" (RI-H1) e eventual
  dever de eliminação. Resolvê-la provavelmente exige anonimização
  seletiva preservando a estrutura do histórico — **decisão de DPO com
  arquitetura, não de arquitetura sozinha**. Registrado como **RI-F2-3**.

### 5.8 Dependência de RH, jurídico e DPO

| Quem          | O que precisa decidir antes da fase Implementar                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RH**        | Conjunto de dados do lançamento (DP-11); tipos de vínculo (DP-13); obrigatoriedade da alocação (DP-28); catálogo de motivos (DP-29); matriz de aprovação (DP-17) |
| **Jurídico**  | Tipos de vínculo e implicações trabalhistas (DP-13); prazos de retenção (DP-15)                                                                                  |
| **DPO**       | Base legal e finalidade por categoria (DP-11, DP-14); dado de dependente; retenção e descarte (DP-15); acesso do `admin_tecnico` a dado restrito (DP-21)         |
| **Produto**   | Cardinalidade de vínculos (DP-12); gestor/subordinado (DP-16); papel `diretoria` (DP-20); Portal e vínculo de acesso (DP-23)                                     |
| **Segurança** | Reautenticação para ação de alto impacto (DP-19); DP-21 em conjunto com DPO                                                                                      |

**Nenhum item desta tabela pode ser decidido por implementação.** Se a
fase Implementar começar com qualquer um em aberto, a resposta correta é
implementar a parte não afetada e deixar a afetada de fora — nunca
escolher a opção "que parece razoável".

## 6. Matriz de acesso inicial

Compatível com o RBAC/ABAC já implementado. Os recursos desta fatia
**estendem** `AuthorizationResource` por ramo novo, sem reduzir nem
alterar nada existente (§2.2, acréscimos 3 e 4).

### Recursos propostos

`colaborador`, `vinculo_funcional`, `movimentacao_funcional`,
`alocacao_organizacional`, `dado_restrito_colaborador`.

Ações reaproveitam o vocabulário atual: `read`, `create`, `alter`,
`manage`.

**`dado_restrito_colaborador` é recurso separado de propósito** — é o que
torna possível conceder leitura do cadastro básico sem conceder leitura de
dado restrito, e auditar as duas de formas diferentes (§9).

### Matriz

Legenda: ✅ concedido · ❌ negado · **⛔ negado por pendência** (não é
recusa definitiva; é ausência de decisão que autorize conceder).

| Papel           | Ler cadastro básico      | Ler dado restrito                   | Criar/alterar colaborador e vínculo | Movimentações | Escopo                                                    |
| --------------- | ------------------------ | ----------------------------------- | ----------------------------------- | ------------- | --------------------------------------------------------- |
| `admin_tecnico` | ✅                       | **⛔ DP-21**                        | ✅                                  | ✅            | Instância — exceção temporária, prazo até 2026-11-04 (O4) |
| `rh`            | ✅                       | **⛔ DP-14**                        | ✅                                  | ✅            | Própria empresa                                           |
| `dp`            | ✅                       | **⛔ DP-14**                        | **⛔ DP-30**                        | **⛔ DP-30**  | Própria empresa (leitura)                                 |
| `gestor`        | **⛔ DP-8/DP-16**        | ❌ (contexto funcional é explícito) | ❌                                  | ❌            | Nenhum nesta fatia                                        |
| `financeiro`    | ❌                       | ❌                                  | ❌                                  | ❌            | Nenhum — mantém só `centro_custo` da Fatia 1              |
| `colaborador`   | ❌                       | ❌                                  | ❌                                  | ❌            | Nenhum — depende do Portal (§3.5)                         |
| `auditor`       | **⛔ DP-7**              | **⛔ DP-7**                         | ❌                                  | ❌            | Nenhum — leitura da trilha (`access_log`) **inalterada**  |
| `dpo`           | **⛔ DP-7**              | **⛔ DP-7**                         | ❌                                  | ❌            | Nenhum — leitura da trilha (`access_log`) **inalterada**  |
| `diretoria`     | ❌ **papel inexistente** | ❌                                  | ❌                                  | ❌            | **O papel não existe no sistema** (O3) — criação é DP-20  |

### Justificativa de cada negação — nenhuma é omissão

- **`gestor`.** O contexto funcional diz literalmente que "gestor
  futuramente verá apenas equipe autorizada; essa regra ainda não está
  decidida e não pode ser inventada". Conceder qualquer leitura exigiria
  escolher a fronteira (equipe? departamento? direto ou indireto?) por
  conta própria. **Negado integralmente**, mesmo no cadastro básico.
  Mesma postura já aplicada na Fatia 1 (ADR 0006, Emenda 2).
- **`auditor` e `dpo`.** DP-7 continua pendente desde a Fatia 1 e bloqueia
  o **primeiro provisionamento** desses papéis. Negá-los aqui é coerência,
  não regressão: a leitura da trilha de auditoria que eles já têm
  (`access_log`) permanece **exatamente como está**.
- **`financeiro`.** Na Fatia 1, "estrutura mínima" era ambíguo e ficou
  negado; só `centro_custo` foi concedido. Nada no contexto funcional
  desta fatia indica que financeiro deva ler pessoas. Negado.
- **`colaborador`.** O que ele acessaria é o Portal do Colaborador, que
  não existe (§3.5). Conceder acesso ao domínio sem o Portal seria expor
  dados de terceiros ao titular.
- **`dp`.** Aqui há **ambiguidade real**: DP é a área que
  operacionalmente executa admissão, movimentação e desligamento — mas na
  Fatia 1 `dp` ficou com **leitura apenas**. Estender `dp` para escrita
  no domínio de pessoas é decisão de governança, não de simetria.
  **Negado até decisão** — **DP-30**.
- **`admin_tecnico` e dado restrito.** Ver O4. A exceção temporária foi
  concedida sobre estrutura organizacional sem dado pessoal. **Negado até
  DP-21.**
- **`diretoria`.** Não existe (O3). Não é possível conceder acesso a um
  papel inexistente, e criá-lo é DP-20.

### Regras invioláveis

- **A1 — Escopo de empresa antes de papel.** Herdada da Fatia 1, sem
  alteração. `empresa_id` do **vínculo** é a fronteira; nenhum papel a
  atravessa sem autorização explícita.
- **A2 — Negação por padrão.** Ação ou recurso não listado é negado.
  Recurso novo nasce negado.
- **A3 — Escopo nunca vem do cliente.** `empresaId` em query é filtro, não
  concessão. Ator escopado que peça outra empresa recebe **página vazia**,
  não erro.
- **A4 — Nenhuma escrita direta na trilha de auditoria**, por nenhum papel
  (ADR 0004 §2).
- **A5 — Ninguém amplia o próprio escopo.** Herdada da Fatia 3.
- **A6 — Ler cadastro básico nunca implica ler dado restrito.** São
  recursos distintos, permissões distintas, eventos de auditoria
  distintos. Não há herança entre eles, em nenhuma direção.
- **A7 — Nenhum papel recebe acesso por interpretação de ambiguidade.**
  Onde a matriz é ambígua, aplica-se negação — nunca a leitura "mais
  provável". Ampliar exige decisão registrada de produto/segurança.

## 7. Regras de integridade

### Identidade e cadastro

- **RI-C1 — Matrícula é o identificador funcional; documento pessoal nunca
  é chave.** CPF (ou qualquer documento pessoal) não é chave primária, não
  é chave natural, não participa de restrição de unicidade, não entra em
  URL e não identifica recurso em rota. Vale mesmo se DP-11 aprovar a
  coleta.
- **RI-C2 — Unicidade de matrícula no escopo correto.** O escopo é
  **DP-22**: por empresa (permite a mesma matrícula em empresas
  diferentes) ou global no deployment. Enquanto não decidido, a
  implementação **não pode** escolher — é restrição de banco, cara de
  reverter depois de haver dado.
- **RI-C3 — Colaborador não é criado por extensão de `AccessUser`**, nem
  por inferência de igualdade de campo (RS-1, RS-2, RS-3).
- **RI-C4 — Colaborador nunca é excluído fisicamente.** Nem no
  desligamento, nem por erro de cadastro. Erro de cadastro é retificação
  (§4.10); fim de relação é encerramento de vínculo.

### Vínculo

- **RI-V1 — Vínculo pertence a exatamente uma empresa, e `empresa_id` é
  imutável.** Mesmo princípio de R7 da Fatia 1.
- **RI-V2 — Vínculo só é criado sob `Empresa` ativa.** Análogo direto de
  R-INA-3 da Fatia 1.
- **RI-V3 — Cardinalidade colaborador → vínculo conforme DP-12.** Até a
  decisão, a implementação **não impõe** unicidade nem a **relaxa**
  deliberadamente: o item fica de fora do escopo implementado.
- **RI-V4 — `data_desligamento` nunca é anterior a `data_admissao`.**
- **RI-V5 — Desligamento encerra o vínculo, nunca apaga o colaborador nem
  seu histórico.**

### Alocação

- **RI-A1 — Alocação sempre dentro da mesma empresa do vínculo**, com
  todos os nós referenciados (unidade, departamento, área, equipe, cargo,
  centro de custo) pertencentes a essa mesma empresa. Garantido **por
  restrição de banco** (FK composta com `empresa_id`), não só por
  validação de aplicação — mesmo padrão já provado em `Equipe` na Fatia 1.
- **RI-A2 — Alocações do mesmo vínculo nunca se sobrepõem no tempo.**
  Garantido **no banco** (restrição de exclusão por intervalo ou
  equivalente), não apenas na aplicação — sem isso, duas requisições
  concorrentes produzem histórico ambíguo e a consulta por data passa a
  ter duas respostas (§11, teste de concorrência).
- **RI-A3 — Alocação só referencia nós organizacionais ativos** no momento
  em que passa a vigorar. Análogo de R-INA-3.
- **RI-A4 — Toda alocação tem movimentação de origem.** Não existe
  alteração de estado sem ato registrado que a justifique.
- **RI-A5 — Alocação encerrada é imutável.** Fechar `vigente_ate` é a
  única alteração admitida numa alocação; depois disso, nada nela muda.

### Movimentação

- **RI-M1 — Movimentação efetivada é imutável.** Nenhum campo é alterado
  após `efetivada_em` ser preenchido, exceto a transição para
  `retificada`.
- **RI-M2 — Retificação referencia, nunca apaga** (§4.10).
- **RI-M3 — Conflito de movimentações futuras é recusado.** Duas
  movimentações programadas que afetem a mesma dimensão do mesmo vínculo
  com vigência sobreposta não podem coexistir. Para efetivar a segunda, a
  primeira precisa ser **cancelada explicitamente** — nunca substituída em
  silêncio. Recusa é `409`.
- **RI-M4 — `vigencia_inicio` não pode ser anterior a `data_admissao`** do
  vínculo, nem posterior a `data_desligamento` quando este já existir.
- **RI-M5 — Solicitante e aprovador não podem ser o mesmo `AccessUser`**
  na mesma movimentação (segregação de funções, §4.5).
- **RI-M6 — Movimentação nunca é excluída fisicamente**, em nenhum status
  — inclusive `rejeitada` e `cancelada`. A tentativa recusada faz parte do
  histórico.

### Histórico e integração organizacional

- **RI-H1 — Nenhuma exclusão física em nenhuma entidade desta fatia.**
  Nenhuma rota `DELETE` é exposta, para nenhum recurso. Herdado de R6 da
  Fatia 1 e reforçado: aqui o dado é pessoal e funcional, e apagá-lo
  destruiria evidência.
- **RI-H2 — Nenhuma alteração apaga silenciosamente o registro anterior.**
  Requisito literal do contexto funcional. Toda mudança de estado produz
  linha nova; nenhuma linha anterior é sobrescrita.
- **RI-O1 — Inativação de nó organizacional bloqueia quando há alocação
  vigente apontando para ele** (§2.2, acréscimo 5). Bloqueio, nunca
  cascata — ADR 0006 decisão 7 aplicada a uma nova classe de dependente.
  **A recusa não revela a existência nem a identidade do dependente**: o
  ator que pode inativar estrutura não necessariamente pode ler pessoas, e
  a mensagem de erro não pode virar canal lateral.
- **RI-O2 — Nenhuma checagem de autorização passa a depender de
  `departamento_id`, `area_id` ou `equipe_id`.** ADR 0006 decisão 2
  permanece intacta: `empresa_id` continua a única fronteira. Alocar
  alguém num departamento **não** cria fronteira de autorização por
  departamento.

## 8. Estados e transições

**Princípio inegociável desta seção: o sistema registra decisões, não as
toma.** Nenhuma transição é automática por regra trabalhista. Não há
cálculo de direito a férias, período aquisitivo/concessivo, saldo,
estabilidade, aviso prévio, rescisão ou enquadramento legal de
afastamento. Quem decide é RH/DP; o sistema registra quem decidiu, quando
e com qual efeito.

### Colaborador

| Estado    | Significado                                         |
| --------- | --------------------------------------------------- |
| `ativo`   | Possui ao menos um vínculo em `ativo` ou `suspenso` |
| `inativo` | Não possui vínculo em `ativo` ou `suspenso`         |

Transições: `ativo` ⇄ `inativo`, **sempre como consequência** de mudança
de vínculo — nunca por comando direto. Não existe "inativar colaborador"
como ação isolada; existe encerrar vínculo. Se a situação é armazenada ou
derivada é decisão de implementação (§13).

**Não existe estado "excluído"** (RI-C4).

### Vínculo funcional

| Estado      | Significado                                         |
| ----------- | --------------------------------------------------- |
| `previsto`  | Admissão aprovada e programada; ainda não efetivada |
| `ativo`     | Admissão efetivada; vínculo em curso                |
| `suspenso`  | Afastamento efetivado, com retorno esperado         |
| `encerrado` | Desligamento efetivado                              |

| De         | Para        | Disparada por                    |
| ---------- | ----------- | -------------------------------- |
| —          | `previsto`  | `admissao` programada            |
| `previsto` | `ativo`     | efetivação de `admissao`         |
| `previsto` | —           | cancelamento (vínculo não nasce) |
| `ativo`    | `suspenso`  | efetivação de `afastamento`      |
| `suspenso` | `ativo`     | efetivação de `retorno`          |
| `ativo`    | `encerrado` | efetivação de `desligamento`     |
| `suspenso` | `encerrado` | efetivação de `desligamento`     |

**`encerrado` é terminal.** Readmissão é **vínculo novo**, nunca
reativação do anterior — reativar apagaria a fronteira entre dois
períodos distintos de relação, que é justamente o que o histórico precisa
distinguir. (Contraste deliberado com R-INA-5 da Fatia 1, onde reativar um
nó organizacional faz sentido porque o nó não tem período de relação.)

**Férias não muda o estado do vínculo.** É movimentação com vigência
delimitada, não suspensão. Se isso está correto para o negócio é
confirmação de RH — registrado em **DP-13**.

### Movimentação funcional

| Estado       | Significado                                                     |
| ------------ | --------------------------------------------------------------- |
| `solicitada` | Registrada, aguardando decisão                                  |
| `aprovada`   | Decidida favoravelmente; vigência é hoje ou passada             |
| `programada` | Aprovada com vigência futura (§4.9)                             |
| `rejeitada`  | Decidida desfavoravelmente — **terminal**                       |
| `cancelada`  | Desistência antes da efetivação — **terminal**                  |
| `efetivada`  | Aplicada: alocação/vínculo alterados — **imutável** (RI-M1)     |
| `retificada` | Foi efetivada e depois corrigida por outra movimentação (§4.10) |

| De           | Para         | Observação                                           |
| ------------ | ------------ | ---------------------------------------------------- |
| —            | `solicitada` | Criação                                              |
| `solicitada` | `aprovada`   | Conforme matriz de aprovação (DP-17)                 |
| `solicitada` | `programada` | Aprovada com vigência futura                         |
| `solicitada` | `rejeitada`  | Terminal                                             |
| `solicitada` | `cancelada`  | Terminal                                             |
| `programada` | `cancelada`  | Antes da vigência; libera conflito de RI-M3          |
| `programada` | `efetivada`  | Ato explícito e auditado na data de vigência (§4.9)  |
| `aprovada`   | `efetivada`  | Ato explícito e auditado                             |
| `aprovada`   | `cancelada`  | Antes da efetivação                                  |
| `efetivada`  | `retificada` | **Única transição admitida** a partir de `efetivada` |

**Ausências deliberadas:**

- Não há transição de `rejeitada` ou `cancelada` de volta para
  `solicitada`. Nova tentativa é movimentação nova — a recusa anterior
  permanece no histórico (RI-M6).
- Não há transição que saia de `efetivada` para qualquer estado que não
  seja `retificada`.
- Não há exclusão em nenhum estado.

## 9. Eventos obrigatórios de auditoria

Toda ação sensível é auditada via `AuditService` — **ponto único de
escrita** (ADR 0004 §2), nunca `prisma.auditEvent.create()` direto.

Nomenclatura conforme convenção aprovada (O5, DP-26): português,
minúsculas, separadas por ponto, prefixo `pessoas`.

| Evento                                         | Quando                                                      | `result`  | Atomicidade      |
| ---------------------------------------------- | ----------------------------------------------------------- | --------- | ---------------- |
| `pessoas.colaborador.criado`                   | Cadastro criado                                             | `success` | **Transacional** |
| `pessoas.colaborador.atualizado`               | Retificação de dado cadastral                               | `success` | **Transacional** |
| `pessoas.vinculo.criado`                       | Vínculo criado (admissão programada ou efetivada)           | `success` | **Transacional** |
| `pessoas.vinculo.encerrado`                    | Desligamento efetivado                                      | `success` | **Transacional** |
| `pessoas.vinculo.suspenso` / `.retomado`       | Afastamento / retorno efetivados                            | `success` | **Transacional** |
| `pessoas.movimentacao.solicitada`              | Movimentação registrada                                     | `success` | **Transacional** |
| `pessoas.movimentacao.aprovada` / `.rejeitada` | Decisão de aprovador                                        | `success` | **Transacional** |
| `pessoas.movimentacao.programada`              | Aprovada com vigência futura                                | `success` | **Transacional** |
| `pessoas.movimentacao.efetivada`               | Aplicada ao vínculo/alocação                                | `success` | **Transacional** |
| `pessoas.movimentacao.cancelada`               | Cancelada antes de efetivar                                 | `success` | **Transacional** |
| `pessoas.movimentacao.retificada`              | Efetivada e depois corrigida                                | `success` | **Transacional** |
| `pessoas.alocacao.criada` / `.encerrada`       | Sucessão de alocação                                        | `success` | **Transacional** |
| `pessoas.dado_restrito.consultado`             | **Leitura** de qualquer dado restrito (§4.7)                | `success` | **Fail-safe**    |
| `pessoas.colaborador.consultado`               | Leitura de cadastro **fora do escopo próprio** do ator      | `success` | **Fail-safe**    |
| `authorization_denied`                         | Negação sobre recurso desta fatia, incluindo fora de escopo | `denied`  | Best-effort      |

### Regras de atomicidade

Três regimes distintos, cada um por um motivo específico:

1. **Transacional** — mutação e evento na **mesma transação**: ou os dois
   persistem, ou nenhum (ADR 0004 §2). Vale para **toda** mutação desta
   fatia, sem exceção. Uma admissão registrada sem evento de auditoria é
   pior que uma admissão que falhou.
2. **Fail-safe** (`recordOrThrow`) — se o evento não puder ser gravado, a
   **leitura não é respondida**. Vale para leitura de dado restrito e para
   leitura fora do escopo próprio. Mesmo raciocínio já aplicado na Fatia 1
   à consulta de escopo amplo: é a auditoria que torna o acesso aceitável,
   então ela não pode ser best-effort.
3. **Best-effort** — negação continua negada mesmo se o evento falhar
   (ADR 0004 §2, inalterado).

### Auditoria de leitura — mudança de postura em relação à Fatia 1

Na Fatia 1, leitura dentro da própria empresa **deliberadamente não
gerava evento**, para a trilha não virar log de tráfego. **Aqui isso muda
parcialmente**, e a distinção é intencional:

| Leitura                                        | Gera evento? | Por quê                                                       |
| ---------------------------------------------- | ------------ | ------------------------------------------------------------- |
| Cadastro básico, dentro do escopo do ator      | **Não**      | Rotina de RH; auditar tudo destruiria o sinal da trilha       |
| **Qualquer** dado restrito                     | **Sim**      | Dado sensível/restrito: quem viu e quando é a questão central |
| Cadastro fora do escopo próprio (acesso amplo) | **Sim**      | Mesmo princípio da consulta ampla da Fatia 1                  |
| Tentativa negada                               | **Sim**      | `denied`, mesmo respondendo 404                               |

### Impacto técnico a considerar na implementação

- `AuditAction` é **enum de banco fechado**: cada verbo novo exige
  **migration aditiva** e atualização do array runtime `AUDIT_ACTIONS`.
  O teste de sincronia entre os dois já é **estrutural** (compara com o
  enum gerado pelo Prisma, não com número fixo) — absorve verbos novos sem
  edição manual, e falha se houver divergência.
- **Convivência de padrões de nomenclatura de evento continua**, agora com
  três famílias: `snake_case` inglês (Etapa 0), `organizacao.*` (Fatia 1)
  e `pessoas.*` (esta fatia). Decisão explícita, herdada da ADR 0006
  Emenda 1 item 5 — não é inconsistência não percebida (RI-F2-4).
- `AuditResource` é **união de tipos no código**: os recursos desta fatia
  entram **sem migration**.
- `audit_event` **não recebe campo novo**. Não entram `colaborador_id`,
  `vinculo_id`, `departamento_id` nem `area_id` — `resource`/`resource_id`
  e o escopo `company_id`/`unit_id`/`team_id` já existente bastam. ADR 0006
  decisão 2 permanece intacta.
- **Nenhum valor antes/depois** (ADR 0004 §5, inalterado) — reforçado
  nesta fatia, onde o valor seria dado pessoal (§5.6).

## 10. Contratos de API futuros (sem criar endpoint)

Propostos, **não implementados**. Nenhum endpoint, DTO ou controller é
criado nesta fase. Rotas em português, plurais, minúsculas, sob `/v1`,
conforme convenção aprovada.

| Método | Rota (proposta)                                               | Descrição                                   | Autorização                          |
| ------ | ------------------------------------------------------------- | ------------------------------------------- | ------------------------------------ |
| GET    | `/v1/colaboradores`                                           | Lista paginada do escopo do ator            | `read` · `colaborador`               |
| GET    | `/v1/colaboradores/:colaboradorId`                            | Cadastro básico                             | `read` · `colaborador`               |
| POST   | `/v1/colaboradores`                                           | Cria cadastro (não cria conta de acesso)    | `create` · `colaborador`             |
| PATCH  | `/v1/colaboradores/:colaboradorId`                            | Retifica dado cadastral                     | `alter` · `colaborador`              |
| GET    | `/v1/colaboradores/:colaboradorId/vinculos`                   | Vínculos do colaborador                     | `read` · `vinculo_funcional`         |
| POST   | `/v1/vinculos`                                                | Cria vínculo (via movimentação de admissão) | `create` · `vinculo_funcional`       |
| GET    | `/v1/vinculos/:vinculoId/alocacoes`                           | Histórico completo de alocações             | `read` · `alocacao_organizacional`   |
| GET    | `/v1/vinculos/:vinculoId/situacao?dataReferencia=YYYY-MM-DD`  | **Situação em uma data** (§1)               | `read` · `alocacao_organizacional`   |
| GET    | `/v1/vinculos/:vinculoId/linha-do-tempo`                      | Movimentações ordenadas (§4.8)              | `read` · `movimentacao_funcional`    |
| GET    | `/v1/movimentacoes`                                           | Lista paginada, filtrável por tipo/status   | `read` · `movimentacao_funcional`    |
| POST   | `/v1/movimentacoes`                                           | Solicita movimentação                       | `create` · `movimentacao_funcional`  |
| POST   | `/v1/movimentacoes/:movimentacaoId/aprovar`                   | Registra aprovação                          | `manage` · `movimentacao_funcional`  |
| POST   | `/v1/movimentacoes/:movimentacaoId/rejeitar`                  | Registra rejeição                           | `manage` · `movimentacao_funcional`  |
| POST   | `/v1/movimentacoes/:movimentacaoId/cancelar`                  | Cancela antes de efetivar                   | `manage` · `movimentacao_funcional`  |
| POST   | `/v1/movimentacoes/:movimentacaoId/efetivar`                  | Efetiva; altera vínculo/alocação            | `manage` · `movimentacao_funcional`  |
| POST   | `/v1/movimentacoes/:movimentacaoId/retificar`                 | Cria retificação (§4.10)                    | `manage` · `movimentacao_funcional`  |
| GET    | `/v1/colaboradores/:colaboradorId/dados-restritos/:categoria` | **Rota segregada** (§4.7)                   | `read` · `dado_restrito_colaborador` |

### Regras de contrato

- **Nenhuma rota `DELETE`**, para nenhum recurso desta fatia (RI-H1).
- **Nenhum dado restrito em resposta de rota de cadastro básico**, em
  nenhuma circunstância — nem sob projeção condicional, nem "quando o
  papel permite". Dado restrito só sai pela rota segregada, com permissão
  própria e evento de auditoria próprio (§9, A6).
- **Escopo nunca vem do cliente** — a empresa acessível é sempre derivada
  da sessão e do escopo autorizado. `empresaId` em query é filtro, não
  concessão (A3).
- **Recurso fora do escopo responde `404` genérico, nunca `403`** —
  anti-enumeração, mesmo padrão das Fatias 3 e 1. O evento interno
  registra `denied`; a resposta pública é 404. Aqui isso é ainda mais
  crítico: um 403 confirmaria a **existência de uma pessoa** naquela
  empresa.
- **Toda rota de mutação exige CSRF** e gera evento de auditoria atômico.
- **Parâmetro de rota nunca se chama `id`** — o `AuthorizationGuard`
  resolve `request.params.id` como `AccessUser` alvo. Usar
  `:colaboradorId`, `:vinculoId`, `:movimentacaoId` (lição já registrada
  nas Fatias 1 e 4).
- **Identificador em rota é sempre o `id` técnico, nunca `matricula` nem
  documento pessoal** (RI-C1).
- **Ordenação e paginação fixas no servidor**, com teto de página — mesmo
  padrão já implementado.
- **`dataReferencia` é validada e limitada** — data futura em consulta de
  situação retorna a situação vigente conhecida, nunca projeta alocação
  que ainda não foi efetivada (§4.9).
- **Ações de alto impacto podem exigir reautenticação** — efetivar
  desligamento, ler dado restrito em lote, retificar movimentação. **Não
  decidido: DP-19.**

## 11. Estratégia de testes

Regra transversal, sem exceção: **dados exclusivamente sintéticos**.
Nenhum dado real de pessoa em teste, fixture, seed, snapshot ou exemplo,
em nenhuma hipótese. Domínio reservado (`exemplo.invalid`) para e-mail;
nomes obviamente fictícios; documentos, quando e se DP-11 os aprovar,
gerados como valores inválidos por construção.

### Unidade

- Máquina de estados de vínculo e de movimentação (§8), **célula a
  célula**: cada transição válida permitida, cada transição inválida
  recusada — incluindo toda tentativa de sair de `efetivada` para algo que
  não seja `retificada`.
- Regras de integridade RI-C1..RI-M6, positivas e negativas.
- Cálculo de sucessão de alocação: fechar a vigente e abrir a nova, sem
  sobreposição e sem lacuna.
- Consulta por data de referência: borda inicial, borda final, data
  anterior à admissão, data posterior ao desligamento, data exatamente na
  virada entre duas alocações.
- Avaliador RBAC/ABAC estendido: **cada célula da matriz §6**, nas duas
  fases (capacidade no guard, escopo no service) — incluindo prova de que
  todo papel marcado ⛔ é negado.
- **Prova de não regressão do avaliador:** os specs existentes
  (`rbac.evaluator.spec.ts`, `rbac.evaluator.organizacao.spec.ts`) devem
  passar **sem edição**.

### Integração (Testcontainers, PostgreSQL real — padrão das Fatias 2–4 e 1)

- CRUD real do ciclo completo: admissão → transferência → afastamento →
  retorno → desligamento, com verificação do histórico após cada passo.
- **RI-A1 provada no banco:** `INSERT` cru de alocação apontando para nó
  de outra empresa é recusado pelo PostgreSQL, mesmo contornando a
  aplicação.
- **RI-A2 provada no banco:** `INSERT` cru de alocação sobreposta é
  recusado pelo PostgreSQL.
- **RI-O1:** inativar nó organizacional com alocação vigente é recusado
  (409), e a alocação **permanece vigente** — prova de ausência de
  cascata.
- **Regressão do Núcleo Organizacional:** inativar nó com filho
  organizacional ativo continua recusado exatamente como antes; a suite
  `organizacao.e2e-spec.ts` passa **sem edição**.
- Privilégios: `evolli_app` sem DDL; `audit_event` sem `UPDATE`/`DELETE`.
- Ausência de rota `DELETE` em todos os recursos.

### Autorização negativa e IDOR/BOLA

- Para **cada** papel marcado ❌ ou ⛔ na matriz §6, prova de negação — não
  presunção por ausência de teste.
- Ator da empresa A não lê, não altera, não movimenta e não efetiva nada
  da empresa B, em **toda** rota que aceita identificador. Resposta
  **404**, nunca 403 nem 200.
- Listagem não vaza: filtro por outra empresa devolve **página vazia**.
- **Teste específico de vazamento por dado restrito:** ator autorizado a
  ler cadastro básico e **não** autorizado a dado restrito recebe resposta
  que **não contém nenhum campo restrito** — verificado por asserção sobre
  o corpo inteiro, não por campo esperado.
- **Teste de canal lateral em RI-O1:** ator autorizado a inativar
  estrutura e **não** autorizado a ler pessoas recebe 409 que **não
  revela** a existência ou identidade do colaborador alocado.
- Tentativa fora de escopo gera evento `denied`.

### Auditoria

- Cada evento de §9 é gerado com ator, escopo, `resource_id` e
  `request_id` corretos.
- **Atomicidade por rollback real**: com `INSERT` revogado em
  `audit_event`, toda mutação reverte por completo — admissão,
  movimentação, efetivação, retificação. Mesmo padrão já provado nas
  Fatias 4 e 1.
- **Fail-safe provado:** com `INSERT` revogado, leitura de dado restrito
  **não retorna 200**.
- **Ausência de dado pessoal na trilha:** nenhum evento contém `nome`,
  `matricula`, documento, salário ou qualquer valor de campo — verificado
  por asserção sobre o registro persistido, lido direto do banco.

### Histórico

- Após uma sequência de N movimentações, a consulta por data de
  referência retorna, **para cada data**, a alocação que valia então.
- Retificação: a movimentação original permanece consultável, com status
  `retificada`; a linha do tempo mostra as duas; nenhuma linha
  desapareceu.
- Desligamento não apaga nem torna inacessível o histórico anterior.
- Readmissão cria vínculo novo e **não** funde os históricos.

### Concorrência

Categoria própria porque é onde o histórico silenciosamente corrompe:

- Duas efetivações simultâneas sobre o mesmo vínculo: exatamente uma
  vence; a outra falha com erro claro. **Nunca** duas alocações vigentes.
- Duas movimentações programadas conflitantes criadas em paralelo:
  RI-M3 recusa a segunda mesmo sob corrida — a garantia é do **banco**,
  não de uma verificação prévia em aplicação (que sempre tem janela).
- Efetivação concorrente com inativação do nó organizacional de destino:
  o resultado é consistente nos dois sentidos — ou a alocação existe e a
  inativação foi recusada, ou a inativação passou e a alocação foi
  recusada. **Nunca** alocação vigente apontando para nó inativo.

### Vazamento

- Nenhuma resposta de erro contém stack trace, SQL, nome de tabela,
  constraint ou detalhe interno.
- Nenhum log — em nenhum nível, inclusive `debug` — contém valor de campo
  pessoal ou restrito (§5.6).

## 12. Aceite, riscos, dependências, decisões pendentes e arquivos previstos

### Critérios de aceite desta especificação

- [ ] Produto e RH aprovam o conjunto de dados do lançamento (**DP-11**),
      com finalidade declarada campo a campo.
- [ ] DPO e jurídico aprovam a classificação, a base legal por categoria e
      o tratamento de dado sensível e de dado de terceiro (**DP-14**).
- [ ] DPO e jurídico definem retenção e descarte por categoria, incluindo
      a tensão com a imutabilidade do histórico (**DP-15**, RI-F2-3).
- [ ] Produto decide a cardinalidade de vínculos (**DP-12**) e os tipos de
      vínculo com jurídico (**DP-13**).
- [ ] Produto e segurança decidem **DP-21** (acesso do `admin_tecnico` a
      dado restrito) — **bloqueante**, por ampliar exceção aprovada em
      outro contexto.
- [ ] Produto decide a matriz de aprovação (**DP-17**) e o escopo de `dp`
      (**DP-30**).
- [ ] Revisão de segurança confirma que nenhum campo do modelo (§4), se
      implementado literalmente, permite acesso fora do escopo de empresa
      nem expõe dado restrito por caminho padrão.
- [ ] ADR 0007 (§13) redigida, revisada e aceita **antes** do início da
      fase Implementar.

### Critérios de aceite da futura implementação (para registro)

- [ ] Nenhuma rota `DELETE` em nenhum recurso desta fatia.
- [ ] `matricula` é o identificador funcional; nenhum documento pessoal é
      chave, aparece em URL, log ou evento.
- [ ] Alocações sobrepostas são impossíveis **por restrição de banco**,
      provado por `INSERT` cru recusado.
- [ ] Alocação cruzando empresa é impossível **por restrição de banco**,
      provado por `INSERT` cru recusado.
- [ ] Inativar nó organizacional com alocação vigente é recusado (409),
      sem cascata e sem revelar o dependente.
- [ ] Suites `organizacao.e2e-spec.ts`, `rbac.evaluator.spec.ts` e
      `rbac.evaluator.organizacao.spec.ts` passam **sem edição**.
- [ ] Nenhum papel marcado ⛔/❌ na matriz §6 obtém acesso; provado teste a
      teste.
- [ ] Resposta de cadastro básico não contém nenhum campo restrito,
      provado por asserção sobre o corpo inteiro.
- [ ] Toda mutação é atômica com seu evento; leitura de dado restrito é
      fail-safe. Ambos provados por rollback real.
- [ ] Nenhum evento de auditoria contém valor de campo pessoal.
- [ ] Nenhuma coluna `tenant_id`, RLS multitenant ou migration retroativa.
- [ ] Nenhuma relação gestor/subordinado criada, nem estruturalmente.
- [ ] Nenhuma conta de acesso criada automaticamente por admissão.
- [ ] **MFA implementado antes de qualquer piloto com dados reais ou
      produção** (ADR 0003, decisão 3) — condição vinculante, agravada por
      esta ser a primeira fatia com dado pessoal de titular.

### Riscos

- **RI-F2-1 — Decidir dado pessoal por conveniência de implementação.** O
  risco mais provável desta fatia: a implementação "precisa" de CPF para
  testar algo e o campo entra sem passar por DPO. Mitigação: DP-11 é
  bloqueante e o critério de aceite exige finalidade declarada campo a
  campo; revisor de PR bloqueia campo de dado pessoal sem decisão
  registrada.
- **RI-F2-2 — Vazamento de dado restrito por projeção esquecida.**
  Mitigação estrutural: segregação (§4.7) faz o caminho padrão **não ter**
  o dado; e teste que assere sobre o corpo inteiro da resposta, não sobre
  campos esperados.
- **RI-F2-3 — Tensão entre imutabilidade do histórico e dever de
  eliminação.** RI-H1/RI-H2 exigem não apagar; a LGPD pode exigir
  eliminação. Não resolvida aqui. Provável caminho: anonimização seletiva
  preservando a estrutura do histórico — **decisão de DPO com
  arquitetura**, registrada em DP-15. Risco **aberto**, não mitigado.
- **RI-F2-4 — Três padrões de nomenclatura de evento convivendo.**
  `snake_case` inglês (Etapa 0), `organizacao.*` (Fatia 1), `pessoas.*`
  (esta). Decisão explícita herdada da ADR 0006 Emenda 1 item 5 —
  registrada para que revisões futuras não tratem como erro.
- **RI-F2-5 — MFA continua adiado, agora com dado pessoal de titular em
  jogo.** O risco aceito da ADR 0003 **não muda de status**, mas muda de
  peso: até aqui, uma conta comprometida expunha estrutura organizacional;
  a partir desta fatia, exporia vida funcional de pessoas. Não é
  autorização para relaxar nada — é reforço da condição de saída já
  vinculante.
- **RI-F2-6 — Prazo da exceção do `admin_tecnico` corre durante esta
  fatia.** Vence em 2026-11-04 (O4). A reavaliação obrigatória pode cair
  no meio da implementação, alterando a matriz §6. Mitigação: DP-21 é
  bloqueante e força a discussão antes, não depois.
- **RI-F2-7 — Alteração em código já mergeado do Núcleo Organizacional**
  (§2.2, acréscimo 5). Risco de regressão sobre comportamento testado.
  Mitigação: teste de regressão explícito e exigência de que a suite
  existente passe sem edição.
- **RI-F2-8 — Modelo de vigência mal implementado degrada silenciosamente.**
  Sobreposição ou lacuna de alocação não gera erro visível: gera resposta
  errada numa consulta por data, meses depois. Mitigação: garantia **no
  banco** (RI-A2), não em aplicação, e testes de concorrência dedicados
  (§11).
- **RI-F2-9 — Anexos sem módulo de Documentos.** Pressão operacional para
  "só guardar o PDF" antes da Etapa 2 é previsível. Mitigação: DP-24
  explícito e ausência total de storage nesta fatia.

### Dependências

| Dependência                                                       | Status                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| Fatias 3 e 4 (identidade, autorização, auditoria) em `main`       | **Satisfeita**                                          |
| Núcleo Organizacional V1 em `main`                                | **Satisfeita** (commit `45ce79b`)                       |
| Vigência endereçada a esta fatia (ADR 0006 d. 9)                  | **Satisfeita** — é o mandato desta spec (§2.3)          |
| DP-4 (CNPJ em `Empresa`)                                          | Pendente — não bloqueia esta fatia                      |
| DP-7 (escopo de `auditor`/`dpo`)                                  | Pendente — mantém os dois negados aqui                  |
| DP-8 (escopo do `gestor`)                                         | Pendente — mantém `gestor` negado aqui                  |
| DP-11, DP-14, DP-15, DP-21 (dado pessoal, retenção, acesso amplo) | **Pendentes e bloqueantes** da fase Implementar         |
| Módulo de Documentos (Etapa 2)                                    | **Não existe** — bloqueia anexos (DP-24)                |
| Módulos de Folha (Etapa 4) e Ponto (Etapa 3)                      | **Não existem** — bloqueiam integração (DP-18)          |
| Portal do Colaborador (Etapa 10)                                  | **Não existe** — bloqueia DP-23                         |
| Extensão aditiva de `AuditAction` por migration                   | Dependência técnica da implementação                    |
| MFA (ADR 0003, decisão 3)                                         | Pendente — **vinculante antes de piloto com dado real** |
| Matriz de rastreabilidade PRD ↔ spec ↔ teste                      | **Pendente e devida nesta fatia** (O1, DP-27)           |

### Decisões pendentes

Numeração continua a sequência global. DP-1, DP-2, DP-3, DP-5, DP-6,
DP-9 e DP-10 foram resolvidas na Fatia 1 (Baseline V1 e Emenda 1 da
ADR 0006). DP-4, DP-7 e DP-8 seguem pendentes e são referenciadas, não
renumeradas.

| ID    | Decisão                                                                                                                          | Responsável               | Bloqueia Implementar? |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------- |
| DP-11 | Conjunto exato de dados pessoais do lançamento, com finalidade declarada campo a campo (§5.1, §5.2)                              | RH + DPO + Produto        | **Sim**               |
| DP-12 | Vínculo único ou múltiplos vínculos por colaborador — simultâneos e/ou sequenciais (§3.2, RI-V3)                                 | Produto + RH              | **Sim**               |
| DP-13 | Catálogo de tipos de vínculo (CLT, estágio, PJ, aprendiz, temporário…) e regras trabalhistas associadas (§4.2, §8)               | RH + Jurídico             | **Sim**               |
| DP-14 | Dados familiares, médicos, salariais e de benefício: se entram, quais, base legal por categoria e regime de dado sensível (§5.3) | DPO + Jurídico + RH       | **Sim**               |
| DP-15 | Retenção e descarte por categoria, incluindo a tensão com imutabilidade do histórico (§5.7, RI-F2-3)                             | DPO + Jurídico            | **Sim**               |
| DP-16 | Entidade e semântica da relação gestor ↔ subordinado (direto/indireto) — não antecipada aqui (§1, §3)                            | Produto                   | Não (mantém negado)   |
| DP-17 | Matriz de aprovação por tipo de movimentação: quem aprova, cadeia ou única, obrigatoriedade (§4.5)                               | Produto + RH              | **Sim**               |
| DP-18 | Integração com folha e ponto: contrato, direção, efeito de retificação (§4.10, §5.4)                                             | Produto + RH              | Não (fora de escopo)  |
| DP-19 | Reautenticação para ações de alto impacto — quais ações, qual mecanismo (§10)                                                    | Segurança + Produto       | Não (aditivo)         |
| DP-20 | Criar o papel `diretoria` — enum de banco, avaliador, escopo e matriz (O3, §6)                                                   | Produto + Segurança       | Não (mantém negado)   |
| DP-21 | Acesso do `admin_tecnico` a **dado restrito** de colaborador — ampliação da exceção da Emenda 1 da ADR 0005 (O4, §6)             | Produto + Segurança + DPO | **Sim**               |
| DP-22 | Escopo de unicidade de `matricula`: por empresa ou global; e se é do colaborador ou do vínculo (§4.1, RI-C2)                     | RH + Produto              | **Sim**               |
| DP-23 | Vínculo técnico `AccessUser` ↔ colaborador: se, quando e como (coluna aditiva × tabela de associação com vigência) (§3.1, RS-4)  | Produto + Segurança       | Não (deferido)        |
| DP-24 | Anexos de movimentação — depende do módulo de Documentos (Etapa 2) (§4.6)                                                        | Produto                   | Não (slot vazio)      |
| DP-25 | Nome social e identidade de gênero: coleta, uso e classificação (dado sensível) (§4.1, §5.3)                                     | DPO + RH                  | **Sim**               |
| DP-26 | Confirmação do prefixo de módulo `pessoas` para diretório, recursos e eventos (O5, §9)                                           | Produto                   | Não (cosmético)       |
| DP-27 | Matriz de rastreabilidade PRD ↔ spec ↔ teste — pendência herdada da Fatia 1, devida aqui (O1)                                    | Produto + Arquitetura     | Não (processual)      |
| DP-28 | Obrigatoriedade de cada dimensão da alocação: unidade, departamento, equipe, cargo (§4.3)                                        | RH + Produto              | **Sim**               |
| DP-29 | Catálogo fechado de motivos × texto livre para afastamento e desligamento (§4.4)                                                 | RH + DPO                  | **Sim**               |
| DP-30 | Escopo do papel `dp` neste domínio: leitura apenas (como na Fatia 1) ou escrita operacional (§6)                                 | Produto + RH              | **Sim**               |

**Onze decisões bloqueiam a fase Implementar.** Isso não é sinal de spec
incompleta: é o resultado esperado de especificar o primeiro domínio com
dado pessoal sem inventar as respostas que pertencem a RH, jurídico e DPO.

### Arquivos previstos para a fase Implementar (não criados agora)

```text
apps/api/prisma/schema.prisma                            # models de pessoas + verbos AuditAction
apps/api/prisma/migrations/<timestamp>_colaboradores_vida_funcional/
apps/api/src/pessoas/pessoas.module.ts
apps/api/src/pessoas/pessoas.types.ts
apps/api/src/pessoas/pessoas-auditoria.service.ts
apps/api/src/pessoas/escopo-pessoas.util.ts
apps/api/src/pessoas/vigencia.util.ts                    # sucessão e não sobreposição
apps/api/src/pessoas/transicoes.util.ts                  # máquina de estados (§8)
apps/api/src/pessoas/dto/pessoas.dto.ts
apps/api/src/pessoas/colaborador/                        # controller, service
apps/api/src/pessoas/vinculo/
apps/api/src/pessoas/movimentacao/
apps/api/src/pessoas/alocacao/
apps/api/src/auth/authorization/permission.types.ts      # (alteração) recursos novos
apps/api/src/auth/authorization/rbac.evaluator.ts        # (alteração) ramo novo, ramos existentes intactos
apps/api/src/audit/audit.types.ts                        # (alteração) AuditResource + AUDIT_ACTIONS
apps/api/src/organizacao/validacao.util.ts               # (alteração) RI-O1: alocação vigente como filho ativo
apps/api/test/pessoas.e2e-spec.ts
apps/api/test/pessoas-historico.e2e-spec.ts              # consulta por data de referência
apps/api/test/pessoas-concorrencia.e2e-spec.ts           # RI-A2, RI-M3 sob corrida
docs/adr/0007-<slug>.md                                  # ADR proposta em §13
```

## 13. Proposta de ADR 0007 (descrita, não criada)

**O arquivo `docs/adr/0007-*.md` NÃO é criado por esta tarefa.** Esta
seção descreve o conteúdo proposto, para que a ADR possa ser redigida,
revisada e aceita como ato próprio — antes do início da fase Implementar.

### Título proposto

**ADR 0007 — Vida funcional: histórico imutável, alocação vigente e
separação entre colaborador e conta de acesso**

### Status proposto

`proposta` — a ser promovida a `aceito` somente após as decisões
bloqueantes de §12 serem resolvidas por seus responsáveis.

### Contexto que a ADR deve registrar

A ADR 0005 fixou o cenário single-tenant e `company_id` como maior limite
de autorização. A ADR 0006 fixou a estrutura organizacional (Baseline V1)
e **endereçou explicitamente a esta fatia** o tratamento de vigência nas
associações do colaborador (decisão 9). A ADR 0003, decisão 8, deixou o
vínculo `access_user` ↔ colaborador para "migration futura própria,
revisada no momento em que a Etapa 1 for implementada".

Esta é a primeira fatia com dado pessoal de titular (O2) e a primeira em
que o sistema precisa responder "qual era a situação em uma data".

### Decisões propostas

1. **Colaborador é entidade própria, nunca extensão de `AccessUser`.**
   Nenhuma criação automática em qualquer direção; nenhuma correspondência
   inferida por igualdade de campo. O vínculo técnico entre os dois **não
   é materializado nesta fatia** (RS-1..RS-4, DP-23).
2. **Matrícula é o identificador funcional; documento pessoal nunca é
   chave.** Nem primária, nem natural, nem de unicidade, nem em URL —
   independentemente do que DP-11 aprovar (RI-C1).
3. **Separação evento × estado.** Movimentação é o ato imutável; alocação
   é o estado vigente num intervalo. Toda alocação tem movimentação de
   origem; nenhuma alocação nasce sem ato registrado (§3.4, RI-A4).
4. **Histórico por sucessão de vigência, nunca por sobrescrita.** A
   situação em qualquer data de referência é leitura direta de linhas que
   nunca foram alteradas nem apagadas. Não sobreposição e não cruzamento
   de empresa são garantidos **por restrição de banco**, não por
   aplicação (RI-A1, RI-A2).
5. **Movimentação efetivada é imutável; correção é retificação.** Evento
   novo referenciando o original, que permanece visível. Aplicação ao
   domínio funcional do mesmo princípio já aceito para a trilha de
   auditoria (ADR 0004, decisão 3).
6. **Proibição total de exclusão física** em todas as entidades desta
   fatia, em todos os estados — inclusive `rejeitada` e `cancelada`.
   Nenhuma rota `DELETE` (RI-H1, RI-M6).
7. **Dado restrito é segregado do cadastro básico**, com recurso de
   autorização próprio (`dado_restrito_colaborador`), rota própria e
   **auditoria de leitura fail-safe**. Ler cadastro básico nunca implica
   ler dado restrito (§4.7, A6).
8. **`empresa_id` continua a única fronteira de autorização.** Alocar
   alguém num departamento ou equipe **não** cria fronteira de autorização
   por departamento ou equipe. ADR 0006 decisão 2 permanece intacta
   (RI-O2).
9. **Inativação de nó organizacional passa a considerar alocação vigente
   como elemento ativo vinculado.** Extensão aditiva de ADR 0006 decisão 7
   a uma nova classe de dependente — bloqueia, nunca cascateia, e a recusa
   não revela o dependente (RI-O1, §2.2).
10. **Nenhuma decisão trabalhista é automatizada.** O sistema registra
    quem decidiu, quando e com qual efeito; não calcula direito, saldo,
    período, rescisão ou enquadramento legal (§8).
11. **Nomenclatura:** convenção da ADR 0006 Emenda 1 estendida, com
    prefixo de módulo `pessoas` (a confirmar, DP-26). Nada já implementado
    é renomeado. Três famílias de nomenclatura de evento convivem por
    decisão explícita (RI-F2-4).

### O que a ADR 0007 explicitamente NÃO decide

Deve registrar, com o mesmo peso das decisões, que **não** resolve:

- Nenhum campo de dado pessoal (DP-11), nenhuma categoria sensível ou
  restrita (DP-14), nenhuma base legal, nenhum prazo de retenção (DP-15).
- Cardinalidade de vínculos (DP-12) nem tipos de vínculo (DP-13).
- Relação gestor ↔ subordinado (DP-16) — a não antecipação da ADR 0006
  decisão 8 permanece integral.
- Matriz de aprovação (DP-17), escopo de `dp` (DP-30), criação do papel
  `diretoria` (DP-20).
- Acesso do `admin_tecnico` a dado restrito (DP-21) — **a exceção da
  Emenda 1 da ADR 0005 não é ampliada por esta ADR**.
- Escopo de `auditor`/`dpo` (DP-7) nem do `gestor` (DP-8) — pendências da
  Fatia 1, inalteradas.
- CNPJ (DP-4), multitenancy (ADR 0005 decisões 2 e 5), MFA (ADR 0003
  decisão 3) — todas inalteradas.
- Integração com folha e ponto (DP-18), anexos (DP-24), Portal do
  Colaborador e vínculo de acesso (DP-23).

### Alternativas que a ADR deve registrar como descartadas

| Alternativa                                                           | Por que descartar                                                                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colaborador como extensão/subtipo de `AccessUser`                     | Acopla identidade técnica a pessoa funcional; a maioria dos colaboradores nunca terá login, e contas técnicas não têm pessoa. Contraria ADR 0003 d. 8 |
| Estado atual mutável (`UPDATE` na lotação), com log separado          | Perde a garantia central: histórico vira reconstrução de log, sujeita a lacuna. Consulta por data deixa de ser leitura e vira reprocessamento         |
| Alocação futura criada já na programação                              | Introduz linhas "vigentes no futuro" que contaminam consulta por data e cálculo de sobreposição. Efetivação vira ato explícito e auditado (§4.9)      |
| Dado restrito no cadastro básico, com projeção condicional por papel  | Uma consulta esquecida vira vazamento. Segregar faz o caminho padrão **não conseguir** retornar o dado                                                |
| Não sobreposição garantida só na aplicação                            | Sempre há janela de corrida entre verificar e inserir; o histórico corrompe silenciosamente e só aparece meses depois numa consulta por data          |
| CPF como chave natural ou identificador de rota                       | Trava correção de erro de cadastro, vaza dado pessoal em URL/log, e cria dependência de dado cuja coleta sequer está aprovada (DP-11)                 |
| Reativar vínculo encerrado em vez de criar vínculo novo na readmissão | Apaga a fronteira entre dois períodos distintos de relação — exatamente o que o histórico precisa distinguir                                          |
| Estender a exceção do `admin_tecnico` a dado restrito por inércia     | Ampliaria materialmente exceção aprovada em contexto sem dado pessoal, sem decisão registrada (O4). Fica pendente (DP-21)                             |
| Criar o papel `diretoria` para atender a matriz pedida                | Papel não existe no enum; criá-lo é mudança de autorização em produção, não ajuste de documento (O3, DP-20)                                           |

### Gatilhos de reavaliação que a ADR deve registrar

1. Resolução de DP-11 ou DP-14 que introduza categoria de dado não
   prevista na segregação proposta (decisão 7).
2. Decisão sobre gestor ↔ subordinado (DP-16) que exija departamento,
   área ou equipe como fronteira de autorização — revisita a decisão 8 e a
   ADR 0006 decisão 2.
3. Reavaliação obrigatória da exceção do `admin_tecnico` (até 2026-11-04,
   Emenda 1 da ADR 0005).
4. Aprovação do Portal do Colaborador, que torna DP-23 bloqueante.
5. Especificação de folha ou ponto (DP-18), que pode exigir efeito
   retroativo de retificação hoje deliberadamente não modelado (§4.10).
6. Aprovação da comercialização multitenant (gatilho já registrado na
   ADR 0005), que exige revisar isolamento de dado pessoal entre clientes.

### Responsabilidades que a ADR deve atribuir

- **Desenvolvimento:** não introduzir campo de dado pessoal sem decisão
  registrada; garantir não sobreposição e não cruzamento de empresa **no
  banco**; manter extensões de `AuditAction`/`AuthorizationResource`
  sempre aditivas; não alterar ramos existentes do avaliador RBAC/ABAC.
- **Produto:** resolver as onze pendências bloqueantes antes do início da
  fase Implementar; não pedir concessão de acesso por interpretação de
  ambiguidade.
- **RH e jurídico:** definir dados do lançamento, tipos de vínculo, matriz
  de aprovação e prazos de retenção.
- **DPO:** aprovar classificação, base legal por categoria, tratamento de
  dado sensível e de dado de terceiro, e a estratégia de descarte diante
  da imutabilidade do histórico.
- **TI/Segurança:** revisar DP-19 e DP-21; confirmar que nenhuma checagem
  de autorização passou a depender de departamento, área ou equipe.
- **Revisor de PR:** bloquear merge que crie campo de dado pessoal sem
  decisão registrada; que exponha dado restrito em rota de cadastro
  básico; que crie conta de acesso automaticamente; que introduza relação
  gestor/subordinado; que permita exclusão física; ou que garanta não
  sobreposição apenas em aplicação.
