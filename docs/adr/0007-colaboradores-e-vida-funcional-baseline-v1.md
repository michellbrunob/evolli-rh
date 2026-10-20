# ADR 0007 — Colaboradores e vida funcional: Baseline V1

- Status: **aceito** (com Emendas 1, 2 e 3 — implementacao V1, integridade temporal no banco e admissao atomica, e correcao P1 de cobertura das invariantes —, todas 2026-08-07)
- Data: 2026-08-07
- Relacionado: [docs/modules/etapa1-fatia2-colaboradores-vida-funcional.md](../modules/etapa1-fatia2-colaboradores-vida-funcional.md),
  [docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md](../decisions/etapa1-fatia2-colaboradores-baseline-v1.md)
  (decisão de produto que esta ADR formaliza),
  [ADR 0001](0001-fundacao-api.md), [ADR 0002](0002-papeis-postgres-e-migrations.md),
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md)

## Contexto

A [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md) fixou o
cenário single-tenant e `company_id` como maior limite de autorização. A
[ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md) fixou a
estrutura organizacional interna (Empresa, Unidade, Departamento, Área,
Equipe, Cargo, Centro de Custo) e **endereçou explicitamente a uma fatia
futura** o tratamento de vigência nas associações do colaborador (decisão 9) — sem antecipar, em nenhuma forma, a relação de gestor/subordinado
(decisão 8). A [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
decisão 8, deixou o vínculo entre `access_user` (credencial técnica) e
"colaborador" para "migration futura própria, revisada no momento em que
a Etapa 1 for implementada" — reconhecendo, desde a Fatia 3, que as duas
entidades são conceitualmente distintas.

A Etapa 1 — Fatia 2 (Colaboradores e vida funcional) é essa fatia futura.
É a primeira do produto a tratar dado pessoal de titular pessoa natural
na qualidade de colaborador — todas as fatias anteriores (Fatia 3:
credencial técnica; Fatia 1: estrutura organizacional) puderam declarar,
com verificação objetiva, que não introduziam esse tipo de dado. É também
a primeira em que o sistema precisa responder "qual era a situação
funcional de uma pessoa numa data de referência passada", sem apagar
silenciosamente o registro que valia naquela data.

Uma especificação completa foi produzida (2026-08-06/07), extraindo o
contexto funcional do PRD conforme fornecido pelo responsável de
arquitetura, e levantando 20 decisões pendentes (DP-11 a DP-30) — a
maioria delas de competência de produto, RH, jurídico e DPO, não de
arquitetura. O produto avaliou o levantamento e aprovou, em 2026-08-07,
13 decisões — a **Baseline V1** — registradas em
[docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md](../decisions/etapa1-fatia2-colaboradores-baseline-v1.md).
Esta ADR formaliza a decisão arquitetural correspondente.

## Decisão

A Baseline V1 é aceita como modelo de Colaboradores e Vida Funcional
desta fatia, com as onze decisões estruturais a seguir — cada uma
sustentada por uma ou mais das treze decisões de produto (referenciadas
entre parênteses).

### 1. Colaborador é entidade própria, nunca extensão de `AccessUser`

Nenhuma criação automática de conta de acesso a partir de um cadastro de
colaborador, nem o inverso. Nenhuma correspondência entre os dois é
inferida por igualdade de e-mail, documento ou nome — vínculo de
identidade sem ato de vontade registrado é proibido. O vínculo técnico
entre `AccessUser` e Colaborador **não é materializado nesta fatia**
(spec §3.1, RS-1 a RS-4) — permanece pré-requisito do Portal do
Colaborador, decisão de fatia futura.

### 2. Matrícula é o identificador funcional, pertence ao vínculo, nunca é chave

Matrícula é **campo do vínculo funcional**, não do colaborador — porque
sua unicidade é por Empresa, e Empresa é propriedade do vínculo (Baseline
V1, decisão 2). Documento pessoal (CPF ou qualquer outro) não é chave
primária, natural, de unicidade, nem componente de rota — em nenhuma
hipótese, mesmo que uma fatia futura venha a aprovar sua coleta (spec
§4.2, §7 RI-C1/RI-C2).

### 3. Histórico de vínculos ilimitado; no máximo um em curso por empresa

Um colaborador pode ter qualquer número de vínculos históricos
(`encerrado`), inclusive com empresas diferentes. No máximo um vínculo em
`ativo` ou `suspenso` por par (colaborador, empresa) nesta V1, garantido
por restrição de banco (spec §7, RI-V6) — não apenas validação de
aplicação (Baseline V1, decisão 3).

### 4. Catálogo fechado de tipo de vínculo, sem automação trabalhista

`clt`, `estagio`, `pj`, `temporario`, `outro_controlado` — cinco valores
fechados, o último como escape controlado, não texto livre (Baseline V1,
decisão 4). Nenhum tipo altera comportamento do sistema: sem cálculo de
direito, saldo, período aquisitivo/concessivo, rescisão ou enquadramento
legal, em nenhum tipo (spec §8).

### 5. Dado restrito fica inteiramente fora desta fatia

Salário, dados familiares, saúde, benefícios e documentos pessoais não
são modelados, nem estruturalmente, nesta V1 (Baseline V1, decisão 5). O
desenho de segregação (recurso de autorização próprio, rota própria,
auditoria de leitura fail-safe) permanece preservado na spec (§4.7) como
referência para a fatia futura que os introduzir — não implementado
agora.

### 6. Histórico por sucessão de vigência, nunca por sobrescrita

A situação em qualquer data de referência é leitura direta de linhas que
nunca foram alteradas nem apagadas. Não sobreposição de alocação
(vigência) e não cruzamento de empresa são garantidos **por restrição de
banco**, não por aplicação (spec §4.3, §7 RI-A1/RI-A2). Alocação é
obrigatória antes de o vínculo tornar-se `ativo`; um vínculo em rascunho
(`previsto`) pode existir sem alocação (Baseline V1, decisão 10; spec §7
RI-A6).

### 7. Movimentação efetivada é imutável; correção é retificação

Nenhum campo é alterado após a efetivação, exceto a transição para
`retificada` — evento novo que referencia o original, que permanece
visível na linha do tempo (spec §4.10). Aplicação ao domínio funcional do
mesmo princípio já aceito para a trilha de auditoria
([ADR 0004](0004-auditoria-formal-e-integridade.md), decisão 3).

### 8. Sem workflow de aprovação nesta V1

RH e DP autorizados registram e efetivam alterações diretamente, dentro
do escopo aprovado (própria empresa, cadastro básico e vínculo
funcional), sempre auditadas — sem aprovador distinto do solicitante
(Baseline V1, decisões 7 e 12). O desenho de `AprovacaoMovimentacao` e os
estados `aprovada`/`rejeitada` permanecem preservados na spec (§4.5, §8)
como referência para quando (se) um workflow formal for aprovado em fatia
própria.

### 9. Proibição total de exclusão física

Nenhuma rota `DELETE`, em nenhuma entidade, em nenhum estado — inclusive
movimentação `cancelada` (spec §7, RI-H1, RI-C4, RI-M6). Reafirmado, não
introduzido, pela Baseline V1 (decisão 6).

### 10. `admin_tecnico` não recebe dado pessoal de Colaborador, em nenhuma forma

A exceção temporária de acesso global concedida ao `admin_tecnico` pela
Emenda 1 da [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md#emenda-1-2026-08-06)
foi aprovada sobre um contexto sem dado pessoal (estrutura organizacional
da Fatia 1). Esta Baseline V1 **interpreta essa exceção restritivamente**:
ela não se estende, por herança, a um domínio novo que trata dado
pessoal. `admin_tecnico` não lê, não cria, não altera e não movimenta
nenhum registro de Colaborador, VínculoFuncional, AlocacaoOrganizacional
ou MovimentacaoFuncional (Baseline V1, decisão 8; spec §6). Esta é
resolução **definitiva**, não restrita a esta V1 — não depende de o dado
restrito existir ou não, depende só do alcance interpretado da exceção já
concedida por outra ADR.

### 11. `empresa_id` continua a única fronteira de autorização

Alocar alguém num departamento, área ou equipe **não** cria fronteira de
autorização por departamento, área ou equipe — reafirma
[ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md), decisão 2,
sem alteração (spec §7, RI-O2). O papel `dp` ganha leitura e registro de
alteração de cadastro básico e vínculo funcional, restrito à própria
empresa, sempre auditado (Baseline V1, decisão 12) — sem que isso amplie
a fronteira de escopo em si, só quem pode atuar dentro dela.

## Dados cadastrais mínimos × dados restritos

Distinção central desta ADR, correspondente à decisão 1 e à decisão 5 da
Baseline V1:

| Categoria                    | Conteúdo aprovado nesta V1                                                                                      | Onde vive                         | Acesso                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Dados cadastrais mínimos** | Matrícula (vínculo), nome completo (colaborador), situação (derivada), vínculo funcional (tipo, datas, empresa) | `Colaborador`, `VinculoFuncional` | `rh` e `dp` (própria empresa); nunca `admin_tecnico`, `gestor`, `financeiro`, `colaborador`, `auditor`, `dpo` |
| **Dados restritos**          | Salário, dados familiares, saúde, benefícios, documentos pessoais                                               | **Não existem nesta V1**          | N/A — recurso não implementado (§4.7 da spec, desenho preservado para fatia futura)                           |

Nenhum campo de dado restrito é criado, mesmo parcialmente ou
estruturalmente, por esta ADR. A introdução futura dessas categorias
exige decisão própria de produto, RH, jurídico e DPO (DP-14), com sua
própria ADR ou emenda — não é antecipada aqui.

## Controles de segurança

- **Menor privilégio reforçado, não apenas mantido.** A Baseline V1 nega
  explicitamente `admin_tecnico` a este domínio (decisão 10 acima) —
  reduz, não amplia, a superfície de acesso amplo em relação ao que a
  spec original já propunha.
- **Negação por padrão inalterada.** Papel ou recurso não listado
  continua negado (spec §6, regras A1-A8). Onde a matriz era ambígua na
  spec original (`dp`, `admin_tecnico`), a Baseline V1 resolveu por
  decisão explícita — nunca por interpretação da "opção mais provável".
- **`empresa_id` como única fronteira de autorização, sem exceção nova**
  (decisão 11 acima).
- **Anti-enumeração mantida.** Recurso fora do escopo responde 404
  genérico, nunca 403 (spec §10) — crítico aqui porque um 403 confirmaria
  a existência de uma pessoa numa empresa específica.
- **Segregação de funções onde existe processo a segregar.** RI-M5
  (solicitante ≠ aprovador) permanece registrada para quando o workflow
  de aprovação existir; nesta V1, sem aprovador distinto, a garantia
  operacional é a auditoria de quem registrou cada ação (decisão 8
  acima).

## LGPD

**Esta ADR não declara conformidade LGPD concluída, em nenhum grau.**

- Os quatro dados aprovados (decisão 1 da Baseline V1) autorizam
  **implementação com dados sintéticos** — não autorizam tratamento de
  dado real sem confirmação formal de DPO quanto a base legal e
  finalidade.
- Dado restrito, sensível ou de terceiro (dependente) permanece
  inteiramente fora de escopo — decisão 5. Nenhuma hipótese legal é
  escolhida para nenhuma categoria, porque nenhuma categoria é
  introduzida.
- Retenção, anonimização e descarte (DP-15) permanecem pendentes,
  reclassificados como **gate obrigatório antes de piloto com dado real
  ou produção** — não bloqueiam a implementação sintética, mas bloqueiam
  qualquer uso com dado real (decisão 6 da Baseline V1).
- A tensão entre imutabilidade do histórico (item 9 acima) e um eventual
  dever de eliminação **não é resolvida** por esta ADR — permanece
  registrada como risco aberto (spec §12, RI-F2-3), com anonimização
  seletiva como caminho provável, a confirmar por DPO.

## Auditoria

- Escrita exclusiva via `AuditService.record()`/`recordOrThrow()` — nenhum
  módulo desta fatia escreve diretamente em `audit_event`
  ([ADR 0004](0004-auditoria-formal-e-integridade.md) §2, sem alteração).
- Toda mutação (criação, retificação, admissão, movimentação, alocação)
  é atômica com seu evento — ou os dois persistem, ou nenhum (spec §9).
- Eventos de auditoria seguem a convenção `pessoas.<entidade>.<verbo>`,
  português, minúsculas, separados por ponto — terceira família de
  nomenclatura de evento convivendo com `snake_case` inglês (Etapa 0) e
  `organizacao.*` (Fatia 1), por decisão explícita já herdada da
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md), Emenda 1,
  item 5.
- Os eventos `pessoas.movimentacao.aprovada`/`.rejeitada` e
  `pessoas.dado_restrito.consultado` **não são emitidos nesta V1** — não
  há o que auditar quando a capacidade correspondente (aprovação, dado
  restrito) não está implementada (spec §9).
- Nenhum evento carrega valor de campo pessoal, antes ou depois — mesmo
  princípio já vigente desde a ADR 0004 §5, sem exceção nesta fatia.

## Limites da implementação (o que esta ADR não faz)

- **Não implementa nenhum código, schema, migration, endpoint, DTO,
  teste, dependência ou infraestrutura.** É registro de decisão; a
  implementação correspondente é trabalho posterior, com critério de
  aceite próprio (spec §12).
- **Não cria campo de dado pessoal além dos quatro aprovados.**
  Documento fiscal, documento de identidade, data de nascimento,
  endereço, telefone, dado bancário, salário, dado médico, dado
  familiar/dependente, benefício, nome social e identidade de gênero
  continuam fora de escopo.
- **Não cria o papel `diretoria`** — reafirma DP-20 como não resolvida,
  sem alteração de status (Baseline V1, decisão 13).
- **Não antecipa gestor/subordinado**, nem estruturalmente — a não
  antecipação já decidida na [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md),
  decisão 8, permanece integral.
- **Não introduz `tenant_id`, RLS multitenant, CNPJ, folha, ponto,
  documentos ou benefícios.**
- **Não altera nenhuma das ADRs 0001 a 0006.**
- **Não resolve DP-4, DP-7, DP-8, DP-14, DP-15, DP-16, DP-18, DP-19,
  DP-20, DP-23, DP-24, DP-26 ou DP-27** — todas permanecem pendentes,
  cada uma bloqueando só a extensão que lhe corresponde (spec §12), não a
  implementação do escopo já aprovado por esta ADR.
- **Não declara MFA implementado** — continua obrigatório antes de
  qualquer piloto com dado real ou produção
  ([ADR 0003](0003-identidade-sessao-e-autorizacao.md), decisão 3,
  inalterada).

## Alternativas descartadas

| Alternativa                                                             | Por que foi descartada                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colaborador como extensão/subtipo de `AccessUser`                       | Acopla identidade técnica a pessoa funcional; a maioria dos colaboradores nunca terá login, e contas técnicas não têm pessoa. Contraria ADR 0003, decisão 8                                                  |
| Matrícula como campo do Colaborador (não do vínculo)                    | A unicidade exigida é "por Empresa" (Baseline V1, decisão 2); Empresa é propriedade do vínculo, não do colaborador — manter no colaborador criaria ambiguidade de escopo                                     |
| Vínculo único por colaborador (sem histórico)                           | Perderia a distinção entre "situação atual" e "histórico completo", exigida pelo critério de sucesso da spec (§1) — e contradiria o requisito de admissão/desligamento/readmissão                            |
| Tipo de vínculo em texto livre                                          | Abriria porta para dado não classificado e inconsistência de catálogo entre registros — um catálogo fechado com escape controlado atende ao mesmo requisito sem esse risco                                   |
| Introduzir dado restrito já nesta V1, mesmo que minimamente             | Exigiria decidir, por conta própria, base legal e finalidade de categoria sensível (saúde) sem DPO — exatamente o que a Fatia 1 já havia evitado para CNPJ                                                   |
| Estender a exceção do `admin_tecnico` ao cadastro básico de Colaborador | Ampliaria por inércia uma exceção concedida em contexto sem dado pessoal (Emenda 1 da ADR 0005) — descartada em favor de negação explícita e definitiva                                                      |
| Implementar workflow de aprovação completo já nesta V1                  | A matriz de aprovação (quem aprova o quê) é decisão de governança de RH sem análise concluída — implementar a estrutura sem a regra de negócio correspondente criaria capacidade não utilizável corretamente |
| Retenção "boa o suficiente" definida por arquitetura, sem DPO           | Declarar prazo de retenção sem análise jurídica seria tão errado quanto não ter prazo nenhum — mantido como gate explícito de piloto real, não resolvido por suposição                                       |
| Criar o papel `diretoria` para atender ao enunciado original da tarefa  | O papel não existe no enum (`AccessRole`); criá-lo é mudança de autorização em produção, não ajuste de documento — mantido fora de escopo (DP-20)                                                            |

## Gatilhos de reavaliação

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. **DP-14 for resolvida** (produto/RH/jurídico/DPO decidem introduzir
   dado restrito) — exige desenhar o recurso `dado_restrito_colaborador`,
   sua matriz de acesso e sua rota segregada, hoje só referência
   conceitual na spec.
2. **DP-15 for resolvida** (retenção/descarte definidos) — condição
   necessária, junto de MFA, para qualquer piloto com dado real.
3. **Um workflow de aprovação formal for aprovado** — reativa o desenho
   preservado de `AprovacaoMovimentacao` e os estados
   `aprovada`/`rejeitada`, hoje inertes.
4. **DP-16 for resolvida** (gestor/subordinado especificado) — pode
   exigir revisitar a decisão 11 acima (`empresa_id` como única
   fronteira), caso o escopo do `gestor` precise de departamento/equipe
   como fronteira de autorização.
5. **Reavaliação obrigatória da exceção do `admin_tecnico`** (até
   2026-11-04, Emenda 1 da ADR 0005) — não deve alterar a decisão 10
   acima, já que ela é interpretada como independente daquela exceção;
   registrado aqui só para rastreabilidade cronológica.
6. **O Portal do Colaborador for aprovado** — torna DP-23 (vínculo
   `AccessUser` ↔ Colaborador) bloqueante.
7. **Comercialização multitenant for aprovada** (gatilho já registrado na
   ADR 0005) — exige revisar isolamento de dado pessoal entre clientes,
   incluindo o domínio de Colaboradores.

## Responsabilidades

- **Desenvolvimento:** implementar exatamente o escopo aprovado (decisões
  1-11 acima); não introduzir campo de dado pessoal além dos quatro
  aprovados; garantir RI-V6, RI-A1, RI-A2 e RI-A6 **no banco**, não só em
  aplicação; manter extensões de `AuditAction`/`AuthorizationResource`
  sempre aditivas; não alterar ramos existentes do avaliador RBAC/ABAC;
  provar, por teste, que `admin_tecnico` não acessa nenhum recurso deste
  domínio.
- **Produto:** resolver DP-14, DP-15, DP-16, DP-18, DP-19, DP-20, DP-23,
  DP-24, DP-26, DP-27 quando cada extensão correspondente for priorizada
  — nenhuma delas bloqueia a implementação do escopo já aprovado por esta
  ADR.
- **RH e DP:** operar dentro do escopo aprovado (cadastro básico, vínculo
  funcional, movimentação registrada e efetivada diretamente); acionar
  produto se o volume de erros/retificações sugerir necessidade de
  workflow de aprovação (RI-F2-10).
- **Jurídico e DPO:** definir DP-15 (retenção/descarte) e confirmar base
  legal e finalidade dos quatro dados aprovados **antes de qualquer
  piloto com dado real** — condição que esta ADR não substitui nem
  antecipa.
- **TI/Segurança:** confirmar, antes do merge da implementação, que
  `admin_tecnico` não tem nenhuma rota de acesso a este domínio; que MFA
  segue como pré-condição vinculante de qualquer piloto real.
- **Revisor de PR:** bloquear merge que crie campo de dado pessoal além
  dos quatro aprovados; que conceda `admin_tecnico` a qualquer leitura ou
  escrita deste domínio; que crie conta de acesso automaticamente a
  partir de um colaborador; que introduza relação gestor/subordinado; que
  permita exclusão física; que declare conformidade LGPD ou retenção
  resolvida sem confirmação de DPO/jurídico.

---

## Emenda 1 (2026-08-07) — registro da implementação V1

**Aditivo.** Nenhuma das onze decisões estruturais acima, nem qualquer das
treze decisões de produto da Baseline V1, é alterada, reinterpretada ou
revogada. Esta seção registra **como** a decisão foi implementada e, com o
mesmo peso, **o que ficou de fora**.

Evidência detalhada (arquivos, constraints, endpoints, contagem de testes)
em
[docs/modules/etapa1-fatia2-colaboradores-vida-funcional.md §14](../modules/etapa1-fatia2-colaboradores-vida-funcional.md).

### O que a implementação confirma

- As quatro entidades existem com a nomenclatura aprovada. Migration
  **aditiva**: nenhuma coluna de tabela já mergeada foi alterada; as únicas
  mudanças sobre tabelas existentes são índices únicos novos, criados para
  servir de alvo às FKs compostas.
- **Decisão 2 sustentada no código:** `matricula` vive em
  `vinculo_funcional`, única por empresa. Nenhum documento pessoal existe
  no schema — há teste que falha se qualquer coluna proibida aparecer.
- **Decisão 5 sustentada por ausência:** nenhuma tabela, coluna ou rota de
  dado restrito foi criada; teste verifica que `aprovacao_movimentacao`,
  `anexo_movimentacao` e `dado_restrito_colaborador` não existem.
- **Decisão 6 sustentada:** histórico por sucessão, com `vigente_ate`
  exclusivo; a consulta por data de referência é leitura direta, provada
  nas bordas (antes da admissão, na virada entre alocações, depois do
  desligamento).
- **Decisão 9 sustentada:** nenhuma rota `DELETE` responde, e toda FK usa
  `ON DELETE RESTRICT`.
- **Decisão 10 sustentada, e é a mais visível no código:**
  `admin_tecnico` é negado em todo o domínio, em toda ação e nas duas
  fases da avaliação — provado teste a teste, incluindo a prova de que seu
  acesso à estrutura organizacional da Fatia 1 **não** regrediu.
- **Decisão 11 sustentada:** nenhuma checagem de autorização passou a
  depender de departamento, área ou equipe.

### Decisões de implementação tomadas dentro do que já estava aprovado

Registradas por serem escolhas visíveis, ainda que não ampliem escopo:

1. **`vigente_ate` é exclusivo** — intervalo `[vigente_de, vigente_ate)`.
   Fecha a alocação anterior exatamente onde a nova começa: sem lacuna,
   sem sobreposição, e a consulta por data vira comparação simples.
2. **Toda referência organizacional usa FK composta com `empresa_id`**
   (e, para `area`, com `departamento_id`), de modo que o **banco** —
   não só a aplicação — recuse referência cruzando empresa.
3. **`EscopoPessoas` não tem variante global.** O tipo é
   `{ empresaId: string }`, não uma união com `{ global: true }`: o caso
   "escopo global" não existe no domínio de tipos, então não há como
   esquecer de tratá-lo.
4. **Efetivação serializada por `SELECT ... FOR UPDATE`** na linha do
   vínculo, para que a recusa de efetivação concorrente seja conflito
   previsível, não corrida.
5. **Catálogo de motivos com rótulos organizacionais neutros**, sem
   nenhuma classificação jurídica — coerente com a decisão 10 da ADR
   (nenhuma decisão trabalhista automatizada).

### Restrição de infraestrutura encontrada, não contornada

**A não-sobreposição completa de intervalos de alocação não é garantida
pelo banco.** Exigiria `EXCLUSION CONSTRAINT` com `daterange` +
`btree_gist`, e a extensão **não pode ser criada por `evolli_migrator`**,
que por desenho da ADR 0002 (menor privilégio) não tem `CREATE` na base —
verificado objetivamente: `permission denied to create extension
"btree_gist"`.

Instalar a extensão exige superusuário/owner da base e é **decisão de
infraestrutura**. Ela **não foi tomada por conta própria**, e o modelo de
privilégios da ADR 0002 **não foi enfraquecido** para acomodá-la.

Controles compensatórios efetivamente aplicados, e provados por teste: no
máximo uma alocação **aberta** por vínculo (índice único parcial — é a
abertura que a concorrência ameaça); unicidade de
`(vinculo_id, vigente_de)`; CHECK de intervalo coerente; serialização por
lock de linha; e teste de concorrência real com efetivações simultâneas.

**Pendência de infraestrutura registrada**, a decidir por TI/Segurança:
autorizar (ou não) a instalação de `btree_gist` por operador com
privilégio adequado, como pré-condição de fortalecer RI-A2.

### Escopo reduzido dentro da Baseline V1

Três capacidades descritas na spec **não** foram implementadas, por
dependerem de decisão que a Baseline V1 não tomou:

| Ausente                                                 | Motivo                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ferias`, `afastamento`, `retorno`, `alteracao_jornada` | Férias e afastamento estão na lista de dados proibidos da entrega; jornada depende do módulo de Ponto (Etapa 3). Consequência: `SituacaoVinculo` não tem `suspenso` |
| `aprovada`/`rejeitada` como estado real                 | Sem workflow de aprovação (Baseline V1, item 7) — os valores não entram no enum de banco                                                                            |
| Efetivação automática de movimentação programada        | A spec §4.9 previa a automação como decisão de implementação a registrar; não foi implementada. Efetivar é sempre ato explícito, com executor identificado          |

Também não implementados, por não constarem dos contratos aprovados:
`GET /v1/movimentacoes/:id` e a validação de quais motivos valem para qual
tipo de movimentação (seria inventar regra de RH).

### O que esta emenda não faz

- Não altera nenhuma das onze decisões estruturais nem as treze decisões
  de produto.
- Não introduz dado pessoal além dos quatro aprovados, dado restrito,
  gestor/subordinado, CNPJ, folha, ponto, documentos, benefícios,
  multitenancy ou `tenant_id`.
- Não cria o papel `diretoria`.
- Não materializa o vínculo `AccessUser` ↔ `Colaborador` (DP-23).
- **Não declara conformidade LGPD concluída.** Retenção/descarte (DP-15) e
  a confirmação formal de DPO sobre os quatro dados aprovados continuam
  pendentes e seguem sendo **gate obrigatório antes de qualquer piloto com
  dado real ou produção**.
- **Não satisfaz nem enfraquece a exigência de MFA** (ADR 0003, decisão 3)
  — a implementação é homologada **só para dados sintéticos**.
- Não altera os gatilhos de reavaliação registrados acima, nem o prazo de
  2026-11-04 da Emenda 1 da ADR 0005.

---

## Emenda 2 (2026-08-07) — integridade temporal no banco e admissão atômica

**Aditivo.** Nenhuma das onze decisões estruturais, nenhuma das treze decisões
de produto da Baseline V1 e nada registrado na Emenda 1 é alterado ou
revogado. Esta emenda formaliza **duas decisões aprovadas depois** da
implementação inicial, em resposta a achados concretos registrados na
Emenda 1 — e a redação anterior permanece legível, inclusive as limitações que
estas decisões resolvem.

Registro completo em
[docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md §4](../decisions/etapa1-fatia2-colaboradores-baseline-v1.md).

### Decisão 12 — `btree_gist` é pré-condição gerenciada; RI-A2 passa a ser garantia plena do banco

A Emenda 1 registrou que a não-sobreposição **completa** de intervalos não era
garantida pelo banco, porque `evolli_migrator` não pode criar `btree_gist` —
e que instalar a extensão era decisão de infraestrutura, **não tomada por
conta própria**. Essa decisão foi tomada agora, e a consequência é:

1. **A extensão é pré-condição gerenciada de infraestrutura**, provisionada
   pelo administrador/proprietário da base via
   `infra/postgres/04_extensions.sql` (idempotente), na mesma etapa em que
   `01_create_roles.sql` e `02_schema_and_grants.sql` são aplicados.
2. **A ADR 0002 permanece integral.** Nenhum privilégio novo é concedido a
   `evolli_migrator` ou `evolli_app` — nem `CREATE` na base, nem `SUPERUSER`,
   `CREATEDB`, `CREATEROLE` ou `BYPASSRLS`. Resolver o provisionamento
   ampliando o papel de migration teria enfraquecido permanentemente a
   separação de papéis para atender uma necessidade pontual; foi
   deliberadamente rejeitado. Há teste que falha se isso mudar.
3. **A migration verifica e falha de modo explícito.** Ela começa consultando
   `pg_extension` e aborta com mensagem apontando o script e o README se a
   extensão faltar — sem fallback silencioso, sem criar a tabela com garantia
   mais fraca.
4. **RI-A2 passa a ser garantida plenamente pelo banco**, por
   `EXCLUSION CONSTRAINT` GiST:

   ```sql
   ALTER TABLE "alocacao_organizacional"
       ADD CONSTRAINT "alocacao_organizacional_sem_sobreposicao"
       EXCLUDE USING gist (
           "vinculo_id" WITH =,
           daterange("vigente_de", "vigente_ate", '[)') WITH &&
       );
   ```

   O `daterange` com limite `'[)'` reproduz exatamente a semântica que a
   aplicação já usava (início inclusivo, fim exclusivo). Duas consequências,
   ambas desejadas: períodos **adjacentes** não conflitam — que é o que a
   sucessão de alocações produz —, e `vigente_ate IS NULL` vira limite
   **infinito**, de modo que uma alocação aberta bloqueia qualquer período
   posterior, fechado ou aberto.

5. **Os controles anteriores são preservados, não substituídos:** FKs
   compostas por empresa, CHECKs, unicidade de `(vinculo_id, vigente_de)`,
   índice único parcial de alocação aberta e `SELECT ... FOR UPDATE` na
   efetivação continuam. O índice parcial deixa de ser a garantia principal e
   passa a ser o caminho rápido do caso mais comum, com erro de unicidade
   estável que a aplicação já traduz para 409.
6. **Prisma não expressa `EXCLUDE`.** A constraint vive em SQL explícito na
   migration, documentada em comentário no `schema.prisma` — **nenhuma
   estrutura Prisma falsa é declarada** para simulá-la, e `migrate diff`
   continua reportando drift zero.
7. Como a migration **ainda não estava publicada em `main`**, foi alterada no
   lugar, sem migration corretiva.

### Decisão 13 — `POST /v1/colaboradores` é admissão atômica, com invariante estrutural

A Emenda 1 registrou como **desvio consciente** o fato de a rota criar
colaborador e vínculo juntos. Esse desvio é agora **contrato oficial**:

1. `POST /v1/colaboradores` cria, na mesma transação, `Colaborador`, o
   primeiro `VinculoFuncional` e — quando o vínculo já nasce ativo — a
   primeira `AlocacaoOrganizacional`.
2. **Não existe, e não passa a existir, endpoint de cadastro sem vínculo.**
   `Colaborador` não tem `empresa_id` (decisão 2 da Baseline V1: a empresa é
   propriedade do vínculo), então um cadastro sem vínculo ficaria fora de todo
   escopo de autorização — invisível até para quem o criou.
3. **A invariante deixa de depender do service.** São **duas invariantes**,
   cobertas por **quatro** `CONSTRAINT TRIGGER` `DEFERRABLE INITIALLY
DEFERRED`, que garantem no COMMIT que (a) todo colaborador tem ao menos um
   vínculo e (b) todo vínculo `ativo` tem alocação vigente. A verificação
   diferida é o que permite que a ordem interna da transação continue livre —
   fechar a alocação vigente antes de abrir a sucessora, por exemplo — sem
   recusar estados intermediários legítimos.

   **A contagem difere de propósito** (ver Emenda 3): uma invariante que
   atravessa tabelas só fica garantida se **toda porta** capaz de quebrá-la
   disparar a verificação. Cada trigger é uma porta, não uma regra.

4. **Vínculos posteriores seguem o fluxo próprio** (`POST /v1/vinculos`), sem
   alteração.
5. **Auditoria atômica preservada:** se a gravação em `audit_event` falhar,
   nenhum dos três registros persiste — provado por teste que também verifica
   que nenhum colaborador ficou sem vínculo.

### O que esta emenda não faz

- Não introduz nenhum dado além dos quatro aprovados na Baseline V1 (item 1).
- Não altera a matriz de acesso: `admin_tecnico` continua **negado em todo o
  domínio** (item 8); RH e DP continuam restritos à própria empresa (item 12);
  ambiguidades continuam negadas por padrão.
- Não amplia privilégio de nenhum papel de banco.
- Não instala a extensão em ambiente externo, homologação ou produção — isso é
  ato de operação, no deploy.
- **Não declara conformidade LGPD concluída.** Retenção/descarte (DP-15), a
  confirmação formal de DPO sobre os quatro dados e o MFA (ADR 0003) continuam
  **gates obrigatórios antes de qualquer piloto com dado real ou produção**. A
  implementação segue homologada **só para dados sintéticos**.

---

## Emenda 3 (2026-08-07) — correção P1: cobertura completa das invariantes

**Aditivo e corretivo.** Nenhuma decisão é revogada. Esta emenda registra uma
**lacuna confirmada** nas triggers introduzidas pela Emenda 2 e a correção
aplicada. A redação da Emenda 2 permanece legível — inclusive a contagem "duas
triggers" que esta emenda revisa.

### A lacuna encontrada

As invariantes da Emenda 2 estavam **corretas na intenção e incompletas na
cobertura**. Três buracos, todos exploráveis por escrita direta no banco:

1. **`colaborador_exige_vinculo` disparava só em `INSERT` de `colaborador`.**
   Remover o último vínculo (ou reapontá-lo para outro colaborador) deixava o
   colaborador anterior órfão, sem empresa e sem escopo de autorização — sem
   que nada recusasse.

2. **Nenhuma trigger cobria `DELETE`** de vínculo ou de alocação. Apagar a
   alocação vigente de um vínculo ativo passava.

3. **`COALESCE(NEW.vinculo_id, OLD.vinculo_id)` nunca avaliava `OLD`.** Como a
   coluna é `NOT NULL`, `NEW.vinculo_id` jamais é nulo: num `UPDATE` que
   reaponta a alocação do vínculo A para o B, **só o B era verificado**, e o A
   ficava ativo sem alocação vigente.

O item 3 foi **reproduzido empiricamente** antes da correção: reinstalando a
função antiga e movendo a alocação de um vínculo `ativo` para um `previsto`
(que não colide com a `EXCLUSION CONSTRAINT` nem viola a invariante 2 no
destino), a transação **commitava** e o vínculo de origem terminava `ativo`
com **zero** alocações abertas.

Isso contradizia o contrato da Emenda 2: as invariantes de admissão atômica
devem valer **contra escrita direta**, não só contra o caminho da API.

### A correção

**Duas invariantes, quatro triggers.** A contagem difere de propósito: uma
invariante que atravessa tabelas só fica garantida se **toda porta** capaz de
quebrá-la disparar a verificação. Cada trigger é uma porta, não uma regra.

| Invariante                                         | Portas cobertas                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **1.** Colaborador sempre tem ao menos um vínculo  | `INSERT` de `colaborador`; `UPDATE`/`DELETE` de `vinculo_funcional`                               |
| **2.** Vínculo `ativo` sempre tem alocação vigente | `INSERT`/`UPDATE` de `vinculo_funcional`; `INSERT`/`UPDATE`/`DELETE` de `alocacao_organizacional` |

Triggers resultantes, todas `DEFERRABLE INITIALLY DEFERRED`:

- `colaborador_exige_vinculo`
- `vinculo_removido_exige_colaborador_com_vinculo` _(nova)_
- `vinculo_ativo_exige_alocacao`
- `alocacao_alterada_exige_vinculo_com_alocacao` _(substitui
  `alocacao_encerrada_exige_sucessora`, agora cobrindo `INSERT`/`UPDATE`/`DELETE`)_

**As funções passaram a verificar todos os registros afetados**, montando um
array de alvos a partir de `OLD` **e** `NEW` conforme `TG_OP`:

- em `DELETE`, só `OLD` existe;
- em `UPDATE` que reaponta a FK, **origem e destino** entram no array;
- em `INSERT`, só `NEW`.

A verificação da invariante 1 ignora colaborador que deixou de existir — a
regra é "colaborador sem vínculo", não "colaborador não pode sumir".

### O que continua valendo, sem alteração

`btree_gist` como pré-condição gerenciada, a `EXCLUSION CONSTRAINT` de
não-sobreposição, a separação de privilégios da ADR 0002 (nenhum privilégio
novo a `evolli_migrator` ou `evolli_app`), FKs compostas por empresa, CHECKs,
índices únicos e `SELECT ... FOR UPDATE` na efetivação.

Como a migration **ainda não estava publicada em `main`**, foi alterada no
lugar — sem migration corretiva.

### O que esta emenda não faz

- **Não introduz `DELETE` na API.** Nenhuma rota nova; as FKs seguem
  `ON DELETE RESTRICT`. A cobertura de `DELETE` é defesa em profundidade
  contra SQL direto, manutenção manual e módulo futuro (RI-H1 inalterada).
- Não altera dado, autorização, escopo, privilégio ou qualquer decisão de
  produto.
- **Não declara conformidade LGPD concluída** — retenção/descarte (DP-15),
  confirmação de DPO e MFA continuam gates obrigatórios antes de piloto com
  dado real ou produção.

## Emenda 4 (2026-10-16) — categoria Contatos do colaborador

**Aditivo.** Nenhuma decisão anterior é revogada nem reescrita. Esta emenda
cumpre o que a própria ADR exige para todo dado pessoal além dos quatro
aprovados — decisão própria, com ADR ou emenda — e o que a ADR 0016 (decisão
5.4) exige de cada categoria nova: ficha de tratamento aprovada.

**O que passa a ser permitido:** três campos de contato do colaborador —
**e-mail pessoal**, **celular** e **telefone** —, aprovados pelo proprietário em
2026-10-16 na [ficha de tratamento](../decisions/ficha-tratamento-contatos-colaborador.md).

**Como:** em agregado próprio, **fora** de `Colaborador`, com `empresa_id`
próprio e garantia no banco de que o colaborador tem vínculo naquela empresa
(ADR 0016, decisão 3). `Colaborador` continua com `nome` e `situacao`, e os
"quatro dados aprovados" continuam sendo os únicos do cadastro mínimo.

**O que continua fora:** todo o resto da lista dos Limites desta ADR —
documento, data de nascimento, endereço, dado bancário, salário, dado médico,
dependente, benefício, nome social e identidade de gênero. Endereço e contato
de emergência, embora no mesmo agregado da ADR 0016, **não** fazem parte desta
ficha.

**Para o revisor:** o bloqueio de "campo de dado pessoal além dos quatro
aprovados" passa a ter **uma** exceção, nestes três campos e neste agregado.
Qualquer outro campo continua bloqueado sem ficha e emenda próprias.

## Emenda 5 (2026-10-20) — dados pessoais básicos e endereço

**Aprovada pela proprietária em 2026-10-20**, com a
[ficha de tratamento](../decisions/ficha-tratamento-dados-pessoais-endereco-colaborador.md).
**Aditivo**: nenhuma decisão anterior é revogada nem reescrita.

**O que passa a ser permitido:** os dados pessoais básicos (data
de nascimento, sexo, saudação, estado civil, nacionalidade, naturalidade,
escolaridade, curso, nome do pai e nome da mãe) e o endereço (país, CEP,
logradouro, número, complemento, bairro, cidade e estado), nos termos da
[ficha de tratamento](../decisions/ficha-tratamento-dados-pessoais-endereco-colaborador.md).

**Como:** em dois agregados próprios, `perfil_pessoal_colaborador` e
`endereco_colaborador`, **fora** de `Colaborador`, com `empresa_id` próprio e
garantia no banco de que o colaborador tem vínculo naquela empresa (ADR 0016,
decisão 3), como os contatos da Emenda 4. `Colaborador` continua com `nome` e
`situacao`. Os três contatos seguem na Emenda 4, sem segunda fonte.

**Obrigatoriedade na admissão (decisão da proprietária, 2026-10-20):** nome
completo, data de nascimento, e-mail pessoal, celular e telefone são
**obrigatórios**; os demais campos desta emenda são **opcionais**. O contrato
da API, a tela de Nova admissão e o banco (`data_nascimento` NOT NULL)
expressam a regra campo a campo — tabela na §2 da ficha. Com isso, a admissão
passa a ter **uma** porta: a página de Nova admissão. O formulário transitório
em modal da tela de Colaboradores (T176) é aposentado, porque não coletava os
campos obrigatórios. Colaboradores admitidos antes desta emenda não têm esses
dados gravados e são lidos como `sem_registro`.

**Quem acessa:** `rh` e `dp` na empresa ativa; `master_tecnico` em qualquer
empresa, com empresa ativa só nela ([ADR 0012, Emenda 2](0012-convergencia-governanca-privacidade-e-perfis-globais.md)).
Demais perfis, sem acesso.

**Aprovado com a ficha (2026-10-20):** finalidade — admissão e
administração da relação de trabalho; base legal — execução do contrato e
procedimentos preliminares necessários; classificação — A2, dado pessoal
comum; RIPD — não necessário nesta etapa, a reavaliar quando entrarem
documentos, dados bancários, saúde ou demais dados sensíveis ou restritos.

**Retenção (decisão substitutiva, 2026-10-20):** sem exclusão nem
anonimização automática após o desligamento; os dados ficam bloqueados para uso
operacional, com histórico e auditoria preservados; qualquer alteração futura
exige decisão explícita da proprietária e avaliação de RH/Jurídico.

**O que continua fora:** documento, CPF, dado bancário, salário, dado médico,
dependente, benefício, nome social, identidade de gênero, raça/etnia,
deficiência, foto, contato de emergência e fuso horário.

**Para o revisor:** a exceção ao bloqueio de "dado pessoal além dos aprovados"
passa a valer também para estes campos e agregados, e só para eles.
