# ADR 0007 — Colaboradores e vida funcional: Baseline V1

- Status: **aceito**
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
