# ADR 0012 — Convergência de governança de privacidade e de perfis globais: RH+Jurídico responsáveis, `master_tecnico` como único acesso global standing, `admin_tecnico` para bootstrap/histórico, depreciação não destrutiva do papel `dpo`

- Status: **Aceito**
- Data: 2026-08-20
- Relacionado:
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md)
  (Emenda 1 — exceção temporária do `admin_tecnico`),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0008](0008-jornada-ponto-rastreavel-baseline-v1.md),
  [ADR 0010](0010-preparacao-multiempresa-interna.md),
  [ADR 0011](0011-documentos-privados-e-admissao-digital.md),
  [decisões pendentes de convergência](../decisions/convergencia-governanca-perfis-pendente.md),
  [decisões pendentes de segurança operacional (T004)](../decisions/etapa0-seguranca-operacional-pendente.md),
  [escopo de autorização interna pendente (DP-7)](../decisions/etapa1-escopo-autorizacao-interna-pendente.md).
- Constituição: v1.3.0, Princípios I, II e IV; "Mandatory Architecture and Data
  Constraints"; "Governance".

## Contexto

A T028 (auditoria de isolamento) e a auditoria de segurança subsequente
constataram três fatos que esta ADR formaliza — todos já resolvidos, em
princípio, pela Constituição vigente, mas ainda não refletidos nas ADRs
anteriores:

1. **Divergência terminológica de perfil global.** A Constituição v1.3.0
   (Princípio II) já nomeia **`master_tecnico`** como _"the sole permitted
   exception"_ de acesso global. As ADRs 0005 (Emenda 1) e 0010 ainda concedem
   acesso global **standing** ao `admin_tecnico`, como exceção temporária. Com a
   introdução do `master_tecnico` (T030), passaram a coexistir **dois** perfis
   globais — o que contraria o "único" da Constituição e amplia a superfície de
   privilégio.

2. **DPO nunca provisionado; responsabilidade já é de RH/Jurídico.** O papel
   técnico `dpo` existe no enum de acesso apenas como **capacidade latente**
   (lê a trilha de auditoria), nunca provisionado — seu escopo é a decisão
   pendente **DP-7** (ADR 0005 Emenda 1 item 3; ADR 0010 decisão 4). A própria
   Constituição registra que "não há papel DPO provisionado; a designação de um
   encarregado é decisão do Jurídico", e a especificação já atribui privacidade
   e LGPD a **RH/Jurídico**. Os ADRs/módulos mais antigos, porém, ainda usam o
   rótulo "DPO/jurídico" como responsável.

3. **"Aprovação de DPO" em documentos é rótulo de evidência, não workflow.** O
   catálogo de tipos documentais exige uma **referência de aprovação registrada**
   (evidência), não uma ação de um usuário com papel `dpo` provisionado — a
   convergência de Documentos já registrou isso.

O responsável do produto avaliou esses fatos e **aprovou as cinco decisões**
abaixo. Esta ADR as formaliza. **É uma decisão de governança e de sequência de
convergência — não é implementação, não altera código/schema/migration, e não
declara conformidade legal** (ver seção "Governança não é declaração de
conformidade").

## Decisão

### 1. RH + Jurídico são a função responsável pela governança de privacidade

RH e Jurídico são, em conjunto, a **função de negócio/legal responsável**
(_accountable business/legal function_, Constituição Princípio I) pela
governança de privacidade e LGPD: finalidade, **base legal**, **classificação**,
**retenção e descarte**, atendimento a direitos de titulares e necessidade de
**RIPD/DPIA**. **Não existe DPO provisionado** e nenhum é criado por esta ADR. A
eventual designação formal de **encarregado (DPO)** permanece **decisão do
Jurídico**, futura e fora do escopo desta ADR.

Onde ADRs e módulos anteriores dizem "DPO/jurídico" como responsável por gates
de privacidade (base legal, retenção, RIPD), **leia-se "RH + Jurídico"** a
partir desta ADR. As atribuições técnicas dos gates (DP-14/DP-15 em Pessoas,
DP-3J-09/11 em Ponto, DP-2E-14/15 em Documentos, retenção de `audit_event`,
DS-BKP-05 em Backups) **permanecem pendentes** — muda o **responsável nomeado**,
não o conteúdo, o status ou o prazo de cada gate.

### 2. Papel técnico `dpo`: depreciado, não destrutivo, proibido de provisionamento

O papel `dpo` do enum `AccessRole` fica **formalmente depreciado** e **proibido
de provisionamento** (reafirmando a ADR 0010 decisão 4). Permanece **no banco e
no histórico** por enquanto — **não é removido do enum agora** — para preservar
integridade referencial e rastreabilidade (inclusive a possibilidade de a trilha
de auditoria vir a referenciá-lo). A leitura da trilha que ele concederia
(`evaluateAccessLog`) torna-se redundante: o `master_tecnico` já cobre a leitura
global da auditoria (T030).

Qualquer remoção futura do valor de enum **só** por **expand/contract**, após
verificar que nenhum `audit_event.actor_role` o referencia — nunca por alteração
destrutiva. O mesmo racional se aplica ao papel `auditor`, cujo escopo continua
pendente (DP-7) e que também não é provisionado.

### 3. `master_tecnico` é o único perfil global permanente (standing)

`master_tecnico` é o **único** perfil de **acesso global permanente** de operação
técnica, suporte e configuração do ecossistema — a "sole permitted exception" da
Constituição. Seu comportamento é o já implementado na T030: leitura global nos
módulos, administração global de contas e de papéis **comuns** e da estrutura
organizacional; **negação** de toda mutação sensível de negócio (admissão,
efetivação/retificação de vínculo, ponto, documentos, folha, exportação) e de
qualquer atribuição do próprio `master_tecnico`. **Não aprova fluxos de
RH/Jurídico nem executa operações trabalhistas** — quando uma alçada for exigida,
o Master só executa após a aprovação aplicável.

### 4. `admin_tecnico`: convergido para bootstrap/histórico

`admin_tecnico` **deixa de ser** perfil de acesso global **operacional
contínuo**. Converge, de forma gradual e não destrutiva, para dois papéis
residuais:

- **Bootstrap**: a identidade que cria a primeira empresa/estrutura e provisiona
  o primeiro `master_tecnico`, quando não há ainda nenhum ator autenticado.
- **Histórico**: o `actor_role` de eventos de auditoria já registrados —
  motivo pelo qual **permanece no enum** e **não é removido**.

Como convergência futura (tarefas em documento próprio, não nesta ADR):
`admin_tecnico` **deverá perder a capacidade de criar ou promover
`admin_tecnico`** (fim da auto-perpetuação) e ter seu uso rotineiro migrado para
`master_tecnico`. A exceção temporária da **Emenda 1 da ADR 0005** (prazo
**2026-11-04**) passa a ter, como desfecho aprovado, **esta convergência** — o
prazo continua vinculante como gate de decisão, não é estendido nem enfraquecido.

### 5. Campos documentais de "aprovação de DPO": migração futura, não agora

Os campos hoje rotulados como aprovação de DPO no catálogo de documentos
(`TipoDocumento`) serão tratados **futuramente** por **migração expand/contract**,
com **nomenclatura neutra** (referência de aprovação da função responsável,
RH+Jurídico) e **preservação integral do histórico** (coluna nova + backfill +
descontinuação da antiga, sem apagar dado). **Esta migração não é feita agora** —
o mecanismo atual (registrar referência + data de uma aprovação como
pré-condição do catálogo) permanece válido; muda apenas, na governança, **quem
aprova**: RH + Jurídico, não um papel `dpo`.

## Governança não é declaração de conformidade

Esta ADR **decide governança** — nomeia **quem é responsável** e **como os
perfis convergem**. Ela **não declara conformidade legal** e **não afirma** que:

- o tratamento de dados esteja adequado à LGPD;
- base legal, finalidade, retenção, descarte ou RIPD estejam definidos ou
  corretos;
- exista prontidão para dado real ou produção.

Esses continuam sendo **entregas pendentes de RH + Jurídico** (e de Segurança/TI
onde aplicável), com base em evidência formal — **nunca por inferência** e nunca
declaradas por esta ADR. Nomear o responsável **não** cumpre a obrigação; apenas
a atribui.

## Gates e pré-requisitos antes de produção ou dado real

Nenhum módulo com dado real entra em produção, e nenhuma funcionalidade é
exposta externamente, até que **todos** os itens abaixo estejam satisfeitos com
evidência (Constituição, "Mandatory Architecture and Data Constraints"):

1. **MFA** implementado e **obrigatório** antes de qualquer piloto com dado real
   ou produção (ADR 0003 decisão 3). **Gate duro, inalterado.**
2. **Decisões operacionais de segurança (T004):** cofre de segredos, rotação,
   break-glass; **backup segregado, protegido e com restauração testada**
   (objetivos RPO/RTO documentados); gate-mestre **`DS-OPS-01`**. Ver
   [decisões de segurança operacional](../decisions/etapa0-seguranca-operacional-pendente.md).
3. **Runbook nominativo de provisionamento do primeiro `master_tecnico`**:
   conta nominativa, sujeita a MFA, com pelo menos **duas contas administrativas
   nominativas**, separadas de uso rotineiro (herda as condições da Emenda 1 da
   ADR 0005). O provisionamento **não** ocorre por rota comum.
4. **Retenção, base legal e RIPD/DPIA por módulo** definidos por **RH +
   Jurídico**: DP-14/DP-15 (Pessoas), DP-3J-09/DP-3J-11 (Ponto),
   DP-2E-14/DP-2E-15 (Documentos), política de retenção de `audit_event`
   (ADR 0004), DS-BKP-05 (Backups). **Bloqueiam dado real.**

Esta ADR **não** satisfaz nenhum desses gates — apenas os consolida e nomeia os
responsáveis.

## O que esta ADR não faz

- **Não altera** código, schema, migration, dependência, teste de aplicação,
  endpoint ou configuração. É documento de governança e planejamento.
- **Não remove** o papel `dpo` (nem `auditor`) do enum; não os provisiona.
- **Não implementa** a restrição do `admin_tecnico` nem o fim da auto-cunhagem —
  registra a direção; a mudança de RBAC é tarefa futura, com ADR/critério de
  aceite próprios se alterar autorização em produção.
- **Não executa** a migração expand/contract dos campos de aprovação documental.
- **Não provisiona** o primeiro `master_tecnico` nem cria qualquer usuário real.
- **Não declara** conformidade LGPD, adequação trabalhista/fiscal ou prontidão
  de produção.
- **Não define** base legal, retenção, descarte ou RIPD — só nomeia o
  responsável (RH + Jurídico).
- **Não estende, adia nem enfraquece** o prazo de 2026-11-04 da Emenda 1 da
  ADR 0005, nem os gates de MFA/T004.

## Relação com ADRs anteriores (convergência, não reescrita)

Esta ADR **não reescreve nem apaga** a história das ADRs anteriores; adiciona uma
camada de convergência sobre elas, referenciada por notas nos documentos
afetados.

| Elemento anterior                                                  | Efeito desta ADR 0012                                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ADR 0005 Emenda 1 — acesso global temporário do `admin_tecnico`    | **Convergido**: desfecho aprovado é migrar o uso standing para `master_tecnico`; prazo 2026-11-04 mantido  |
| ADR 0005/0010 — `auditor`/`dpo` não provisionados (DP-7)           | **Reforçado**: `dpo` formalmente depreciado; DP-7 segue pendente para `auditor`                            |
| ADR 0010 — `admin_tecnico` global como exceção interna             | **Convergido**: exceção passa a ser bootstrap/histórico, não operação contínua                             |
| ADR 0011 — catálogo exige "aprovação do DPO"                       | **Reinterpretado**: a aprovação é da função responsável **RH + Jurídico**; rótulo de campo migra no futuro |
| ADR 0003/0004/0007/0008 — "DPO/jurídico" como responsável de gates | **Reatribuído**: leia-se **RH + Jurídico**; conteúdo/status dos gates inalterados                          |
| Constituição — `master_tecnico` como "sole permitted exception"    | **Alinhado**: ADRs e código passam a refletir o vocabulário da Constituição                                |

## Consequências

- Passa a existir **um único** perfil global standing (`master_tecnico`),
  reduzindo superfície de privilégio e ambiguidade de autoridade.
- `admin_tecnico` fica reservado a bootstrap/histórico; sua restrição efetiva de
  RBAC é trabalho futuro, agendado no documento de decisões pendentes.
- O papel `dpo` fica marcado como depreciado; nenhum fluxo ativo depende dele
  (a "aprovação de DPO" em documentos já é evidência registrada por RH).
- A governança de privacidade tem responsável nomeado (RH + Jurídico), o que
  **não** antecipa nem substitui as entregas de base legal/retenção/RIPD.
- A rastreabilidade versionada vive em `docs/` (esta ADR + o documento de
  decisões pendentes); o scaffold local `.specify/` reflete o mesmo, sem ser
  versionado.

## Responsabilidades

- **Produto:** dono das cinco decisões aqui formalizadas; aciona a revisão da
  convergência do `admin_tecnico` no prazo/gatilho.
- **Segurança + Produto:** aprovar, via ADR futura, a restrição de RBAC do
  `admin_tecnico` (fim da auto-cunhagem; uso limitado a bootstrap) antes de
  2026-11-04; conduzir o runbook de provisionamento do primeiro `master_tecnico`.
- **RH + Jurídico:** função responsável pela governança de privacidade/LGPD;
  entregar base legal, retenção, descarte e RIPD por módulo (gates de dado real);
  o Jurídico decide sobre a designação formal de encarregado.
- **Time de desenvolvimento:** não provisionar `dpo`/`auditor`; tratar `dpo` como
  depreciado; qualquer remoção de enum ou renomeação de campo só por
  expand/contract, com preservação de histórico.
- **Revisor de PR:** bloquear merge que provisione `dpo`/`auditor`, que conceda
  novo acesso global standing além de `master_tecnico`, ou que declare
  conformidade LGPD sem a revisão específica.

## Gatilhos de revisão

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. **2026-11-04**, prazo da Emenda 1 da ADR 0005, para formalizar a restrição de
   RBAC do `admin_tecnico`.
2. Necessidade de provisionar o primeiro `master_tecnico` (aciona o runbook e os
   gates de MFA/T004).
3. Necessidade de provisionar `auditor` (DP-7 segue pendente e bloqueante).
4. Decisão do Jurídico de designar formalmente um encarregado (DPO).
5. Início de comercialização para terceiros (ADR 0005 decisão 5; ADR 0010).

## Limitações

- Esta ADR **não autoriza** início de código, provisionamento, migration ou
  infraestrutura.
- **Não decide** base legal, retenção, descarte, RIPD, nem a forma técnica do
  escopo de `auditor` (DP-7).
- **Não declara** conformidade LGPD, segurança validada ou adequação trabalhista.
- **Não altera** o comportamento atual de `master_tecnico` (T030) nem de
  `admin_tecnico` — a convergência de RBAC é trabalho posterior, com aceite
  próprio.

## Emenda 1 (2026-10-16) — `master_tecnico` em contatos do colaborador

**Aditivo e restrito a uma categoria.** A decisão 3 desta ADR dá ao
`master_tecnico` leitura global nos módulos e **nega** toda mutação sensível de
negócio. O proprietário decidiu, na
[ficha de tratamento dos contatos](../decisions/ficha-tratamento-contatos-colaborador.md), que **nos contatos do
colaborador** — e-mail pessoal, celular e telefone — o `master_tecnico` é
administrador global confiável, com **leitura e edição em qualquer empresa**.

**Condições da exceção:**

- vale **só** para o recurso de contatos do colaborador;
- toda leitura e toda edição identificam a **empresa real do colaborador** e
  são **auditadas** com ela;
- com empresa ativa selecionada, o `master_tecnico` atua dentro dela, como em
  todo o resto (T163); sem seleção, atua na empresa do vínculo do colaborador.

**O que não muda:** a negação de mutação ao `master_tecnico` em admissão,
vínculo, movimentação, ponto, documentos, folha, exportação e qualquer outro
recurso. A decisão da T165 (§5.2) — "o `master_tecnico` não cria, não edita e
não admite pessoas" — continua valendo para tudo, **exceto** os contatos.

## Emenda 2 (2026-10-20) — `master_tecnico` em dados pessoais e endereço do colaborador

**Aditivo.** A proprietária decidiu que o `master_tecnico`, por ser cargo de
confiança, pode acessar tudo. Esta emenda aplica a decisão ao recorte da T177:
**dados pessoais básicos e endereço do colaborador**
([ficha de tratamento](../decisions/ficha-tratamento-dados-pessoais-endereco-colaborador.md),
em aprovação). Nessas categorias, o `master_tecnico` tem **leitura e edição em
qualquer empresa**, como já tinha nos contatos (Emenda 1).

**Condições — as mesmas da Emenda 1:**

- toda leitura e toda edição identificam a **empresa real do colaborador** e
  são **auditadas** com ela, sem registrar valor pessoal;
- com empresa ativa selecionada, o `master_tecnico` atua **dentro dela**, como
  em todo o resto (T163);
- sem seleção, atua na empresa do vínculo do colaborador; se houver vínculo em
  mais de uma empresa, nada é lido nem gravado (409), e a tentativa fica na
  trilha sem empresa.

**Alcance desta emenda:** os recursos de dados pessoais e endereço. A T177 não
muda, por esta emenda, o acesso do `master_tecnico` a outros recursos —
admissão, vínculo, movimentação, ponto, documentos, folha e exportação seguem
como a Emenda 1 os descreve. Levar a decisão "acessa tudo" a cada um desses
recursos é registro próprio, a ser feito quando a proprietária confirmar o
alcance.
