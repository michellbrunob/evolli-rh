# Modelagem organizacional interna — decisão aprovada (Baseline V1)

> ## STATUS: DECISÃO APROVADA — Baseline V1
>
> As nove decisões descritas na seção "Baseline V1" abaixo foram aprovadas pelo produto em
> 2026-08-06. Em seguida, na mesma data, o produto também aprovou a
> **nomenclatura em português** do Núcleo Organizacional, resolvendo
> **DP-9** — ver a seção "Nomenclatura aprovada" dentro de D7 (§8). Este
> documento preserva **integralmente** o levantamento de fatos, as
> alternativas avaliadas, as tabelas de impacto e as recomendações
> técnicas originais como **histórico** — nada foi apagado ou reescrito.
> Cada seção D1–D8/QT-1 recebeu uma anotação de resolução logo após o
> título, indicando o que foi decidido e remetendo à Baseline V1. A
> formalização arquitetural está em
> [ADR 0006 — Modelo organizacional interno, Baseline V1](../adr/0006-modelo-organizacional-interno-baseline-v1.md).

- Fase do rito SDD: **Especificar / Decidir → Registrar**
- Data do levantamento: 2026-08-06
- **Data da aprovação: 2026-08-06**
- Origem: decisões pendentes **DP-1, DP-2, DP-3, DP-5, DP-6, DP-8, DP-9 e
  DP-10** de
  [docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md)
  (todas resolvidas ou reclassificadas por esta decisão — ver §0-A)
- Relacionado:
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md) (e sua
  Emenda 1),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
  [decisão de escopo de autorização interna](etapa1-escopo-autorizacao-interna-pendente.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)

## Baseline V1 — registro formal da decisão aprovada

**Status:** DECISÃO APROVADA
**Data:** 2026-08-06
**Aprovada por:** responsável pelo produto (conforme instrução de
execução desta tarefa)

As nove decisões abaixo foram aprovadas e são a fonte de verdade desta
Baseline V1. Cada uma resolve ou reclassifica uma ou mais das perguntas
levantadas nas seções D1–D8/QT-1 (§2–§10) — a referência cruzada exata
está registrada dentro de cada seção.

1. **Departamento e área são entidades distintas.** Departamento é o
   nível organizacional principal; área é uma subdivisão **opcional** do
   departamento — não um sinônimo, não um agrupamento acima dele.
2. **Departamento e área não são novas fronteiras de autorização nesta
   fatia.** `company_id` permanece o maior limite de autorização; unidade
   e equipe mantêm os escopos organizacionais já previstos;
   **`department_id` não é introduzido** em identidade, sessão ou
   auditoria nesta fase.
3. **Equipe pertence obrigatoriamente a um departamento** e pode ser
   vinculada **opcionalmente** a uma unidade.
4. **Nesta fatia existe apenas cargo.** Função fica para a futura vida
   funcional do colaborador — nenhuma entidade, campo ou regra para
   função é criada agora.
5. **O catálogo de cargos é por empresa**, com código padronizável para
   futura consolidação entre empresas.
6. **Centro de custo é cadastrado por empresa**, sem associação a
   unidade, departamento, área ou equipe nesta fatia.
7. **Inativação:** bloquear quando houver elementos ativos vinculados;
   **nunca** cascata; transferência/reclassificação é fluxo futuro, não
   desta fatia.
8. **Hierarquia organizacional é fixa nesta versão.** Sem árvore
   recursiva; **nenhuma** relação de gestor, subordinados ou organograma
   de colaboradores é antecipada — nem estruturalmente.
9. **Vigência não se aplica aos nós organizacionais agora.** Vigência
   será tratada futuramente nas associações do colaborador (cargo,
   equipe, gestor, centro de custo), não nos nós desta fatia.

### O que permanece pendente após esta decisão

Ver síntese atualizada em §11 e tabela de perguntas em §12. Em resumo:
`DP-4` (CNPJ, LGPD) e as perguntas genuinamente futuras da fatia de
colaboradores (escopo do gestor por equipe, "unidade é sempre local
físico"). `DP-9` (nomenclatura) foi **integralmente resolvida** em
2026-08-06 — ver "Nomenclatura aprovada" em D7 (§8).

## 0. Escopo e limites deste documento

**Contexto de produto recebido** (consolidado pelo responsável de
arquitetura a partir do PRD; este documento **não acessa o Notion** e não
infere requisito além do que foi fornecido):

- Ambiente interno, single-tenant; `company_id` é o maior limite
  organizacional e de autorização da fase atual (ADR 0005).
- A estrutura deve viabilizar no futuro: organograma, histórico funcional,
  Portal do Gestor, documentos, ponto TXT, treinamentos, dashboards e
  solicitações.
- Entidades exigidas: empresa, unidade, departamento, área, cargo/função,
  centro de custo quando aplicável, e relação futura de reporte.
- Alterações organizacionais devem ser **auditáveis**, ter **vigência
  quando aplicável** e **não apagar histórico**.
- Sem entidade de colaborador nesta fatia; sem admissão, salário, vínculo,
  folha, ponto, documentos, benefícios ou dados pessoais.
- Sem CNPJ nesta fatia (CNPJ de MEI pode ser dado pessoal — não introduzir
  sem finalidade e validação específica).
- Gestor, subordinados diretos/indiretos e relações de reporte pertencem a
  fatia futura, quando colaborador existir.

**Este documento não faz:** não altera nenhum arquivo existente; não cria
código, schema, migration, endpoint, dependência ou teste; não resolve
nenhuma pendência sem aprovação humana; não declara conformidade LGPD.

## 1. Fatos verificados que condicionam todas as decisões

Lidos no código e nos documentos em `main`. Não são suposição.

### F1 — `department_id` não existe nas tabelas de escopo já mergeadas

`access_user` e `audit_event` possuem `company_id`, `unit_id` e `team_id`
(`apps/api/prisma/schema.prisma`) — **nenhuma das duas possui
`department_id`**.

**Consequência direta:** se departamento se tornar um nó de escopo
relevante para autorização ou auditoria, ambas as tabelas precisarão de
coluna nova (migration aditiva). Isso afeta as decisões D1, D2 e D8. Se
departamento existir apenas como informação estrutural — sem servir de
fronteira de autorização nem de escopo auditado — nenhuma alteração é
necessária.

Esta é a pergunta implícita mais cara deste documento: **departamento é um
nó de escopo ou apenas um atributo organizacional?** Ela atravessa D1, D2,
D8 e a auditoria (§9 da spec).

### F2 — O sujeito de autorização só conhece empresa

`AuthorizationSubject` = `{ userId, role, companyId }`
(`apps/api/src/auth/authorization/permission.types.ts`), e `isSameCompany`
é a única comparação de escopo existente
(`apps/api/src/auth/authorization/rbac.evaluator.ts`).

Qualquer escopo abaixo de empresa (unidade, departamento, equipe) **não
existe hoje na autorização** — introduzi-lo é mudança do avaliador
RBAC/ABAC, não configuração.

### F3 — Nenhuma entidade organizacional existe ainda

Não há `company`, `unit`, `department`, `team`, `job_role` ou
`cost_center` no schema. Todas as decisões deste documento são sobre
estrutura **a criar** — nenhuma exige migração de dado existente, o que
reduz materialmente o custo de decidir agora e o de errar.

### F4 — Auditoria: verbos são enum fechado, recursos são união no código

`AuditAction` é enum de banco (estender exige migration); `AuditResource`
é união de tipos no código (estender não exige migration) —
`apps/api/src/audit/audit.types.ts`, ADR 0004 §5. Cada entidade
organizacional nova gera verbos novos (`company_created`, etc.), portanto
**migration aditiva de enum** é dependência certa da implementação,
independentemente das decisões abaixo.

### F5 — Vigência temporal não existe em nenhum lugar do modelo atual

O contexto de produto exige que alterações organizacionais "tenham
vigência quando aplicável". O modelo hoje proposto na spec (§3) usa apenas
`status` (`active` | `inactive`) — um estado **booleano e atemporal**.

Vigência (`vigente_de` / `vigente_ate`) é conceito distinto de status:
permite responder "como era a estrutura em 1º de março?", necessário para
histórico funcional, relatórios retroativos e conciliação de ponto/folha
por competência. **Nenhuma das oito decisões solicitadas cobre esse tema**
— ele é levantado aqui como **questão transversal QT-1** (§10), por ser
requisito declarado do PRD sem decisão correspondente.

### F6 — "Área" e "cargo/função" podem ser um ou dois conceitos cada

O contexto lista as entidades exigidas como "empresa, unidade,
**departamento, área**, **cargo/função**, centro de custo". A spec atual
trata "área ou departamento" como sinônimos (§3.3) e "cargo/função" como
um único conceito (§3.5).

São duas ambiguidades reais e independentes, tratadas em D1 e D7. Não
foram resolvidas por suposição.

## 2. D1 — Departamento e área

**Pendência de origem:** DP-1.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), itens 1 e 2.** Departamento e
> área são entidades distintas: departamento é o nível organizacional
> principal (**Alternativa A abaixo — por empresa —, a recomendada**);
> área é uma subdivisão **opcional do departamento**, não modelada nas
> alternativas A/B/C originais (que tratavam só do vínculo do
> departamento, não da existência de área como entidade própria). Resolve
> também P1.1, P1.2, P1.3 e a parte de F6 relativa a "área". Departamento
> e área **não** se tornam fronteira de autorização — `company_id`
> permanece o maior limite, e `department_id` **não** é introduzido em
> `access_user`/`audit_event` (resolve F1 definitivamente: **não**).
> Alternativas, tabela de impacto e recomendação abaixo preservadas como
> histórico da análise que fundamentou a escolha.

### Alternativas

| #   | Alternativa                                           | Descrição                                                                                              |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A   | Departamento por empresa                              | `department.company_id` obrigatório, sem vínculo com unidade. "Financeiro" é um só, atravessa unidades |
| B   | Departamento vinculado obrigatoriamente a uma unidade | `department.unit_id` obrigatório. Cada unidade tem seu próprio "Financeiro"                            |
| C   | Híbrido                                               | Departamento pertence à empresa, com associação **opcional** a uma ou mais unidades                    |

### Avaliação

| Dimensão                      | A — por empresa                                                                                                                                | B — por unidade                                                                                                                            | C — híbrido                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Benefício operacional**     | Cadastro único por função; relatórios consolidados naturais; menos registros a manter                                                          | Reflete diretamente estruturas onde cada filial se organiza sozinha; escopo local sem ambiguidade                                          | Cobre os dois casos; permite departamento corporativo e local no mesmo modelo                                          |
| **Risco e custo de reversão** | **Baixo.** A→C é **aditivo** (acrescenta tabela de associação, nada é destruído). A→B exige criar registros por unidade e remapear referências | **Alto.** B→A exige deduplicar ("qual dos 3 Financeiros é o canônico?") — decisão sem resposta automática, com risco de perda de histórico | Médio. C já é o superconjunto; reverter para A é ignorar associações, mas a complexidade já foi paga                   |
| **Segurança / autorização**   | Escopo de departamento é único e não ambíguo (um departamento → uma empresa)                                                                   | Escopo herda a unidade; consistente, mas exige garantir que unidade e empresa não divirjam                                                 | **Ambíguo:** um departamento em N unidades não tem escopo único — qual unidade governa o acesso? Exige regra adicional |
| **Auditoria / LGPD**          | Se departamento virar escopo auditado, exige `department_id` em `audit_event` (F1)                                                             | Idem A; `unit_id` já existe, o que reduz o gap se o escopo auditado for a unidade                                                          | Idem A, com o agravante de o evento não poder registrar "a" unidade quando houver várias                               |
| **Organograma**               | Organograma funcional consolidado por empresa; a dimensão geográfica (unidade) fica separada — duas visões independentes                       | Organograma por unidade, natural para visão local; visão funcional consolidada exige agrupar por nome/código, o que é frágil               | Suporta as duas visões, ao custo de o organograma precisar decidir qual exibir por padrão                              |
| **Portal do Gestor (futuro)** | Gestor de departamento veria pessoas de várias unidades — pode ser desejado ou não; exige decisão futura de recorte                            | Escopo do gestor é naturalmente local e sem ambiguidade                                                                                    | Escopo do gestor precisa de regra explícita: departamento inteiro ou departamento naquela unidade?                     |
| **Outros módulos futuros**    | Treinamentos e dashboards por função ficam simples; ponto TXT (por local) precisa da unidade separadamente                                     | Ponto TXT alinhado ao local; treinamentos por função exigem consolidação manual                                                            | Cobre ambos, com maior custo de consulta                                                                               |

### Recomendação técnica (recomendação, não decisão)

**Alternativa A — departamento por empresa**, pelo argumento de
**assimetria de reversibilidade**: A→C é uma evolução aditiva (basta
acrescentar a associação a unidades quando o caso de uso aparecer),
enquanto B→A é destrutiva e ambígua. Num ambiente interno com poucas
empresas e poucas unidades, A entrega o organograma funcional exigido com
o menor custo e mantém aberta a porta para C.

Recomendação complementar: **não** tornar departamento um nó de escopo de
autorização nesta fatia (mantendo `company_id` como fronteira, ADR 0005) —
o que evita a migration em `access_user`/`audit_event` (F1) e permite
introduzi-la depois, se o Portal do Gestor exigir.

### Pergunta objetiva para o produto

**P1.1:** Um departamento (ex.: "Financeiro") é **um só na empresa**,
atravessando unidades, ou **um por unidade**?

**P1.2:** "Área" é sinônimo de departamento, um **agrupamento acima** dele
(ex.: "Área Administrativa" contendo vários departamentos), ou uma
**subdivisão abaixo** dele? (F6 — hoje a spec trata como sinônimo.)

**P1.3:** O departamento precisa limitar **acesso** (ser fronteira de
autorização), ou é apenas informação estrutural para organograma e
relatórios?

## 3. D2 — Equipe

**Pendência de origem:** DP-2.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), item 3.** Equipe pertence
> **obrigatoriamente** a um departamento e pode ser vinculada
> **opcionalmente** a uma unidade — coincide com a **Alternativa C**
> abaixo (departamento obrigatório, unidade opcional), a recomendada.
> Resolve P2.1. Alternativas e avaliação preservadas como histórico.

### Alternativas

| #   | Alternativa                         | Descrição                                                               |
| --- | ----------------------------------- | ----------------------------------------------------------------------- |
| A   | Equipe → departamento               | Equipe pertence a um departamento; a unidade não é registrada na equipe |
| B   | Equipe → unidade                    | Equipe pertence a uma unidade; a função (departamento) não é registrada |
| C   | Equipe → departamento **e** unidade | Equipe carrega as duas dimensões (funcional e local)                    |

Sub-variação de C, a decidir junto: a unidade é **obrigatória** ou
**opcional** na equipe?

### Avaliação

| Dimensão                      | A — por departamento                                                                                         | B — por unidade                                                                       | C — ambos                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Benefício operacional**     | Simples; equipe herda a função do departamento                                                               | Simples; equipe herda o local                                                         | Equipe totalmente qualificada: "Equipe de Cobrança, unidade Centro"                              |
| **Risco e custo de reversão** | Baixo; A→C é aditivo (acrescentar `unit_id` opcional)                                                        | Baixo em estrutura, mas perde-se a função — recuperar exige reclassificar manualmente | Médio; é o superconjunto, já paga a complexidade                                                 |
| **Segurança / autorização**   | Escopo derivado do departamento (que, na rec. de D1, não é escopo) → equipe fica sem fronteira própria clara | Escopo derivado da unidade; `unit_id` já existe em `access_user`/`audit_event`        | Duas dimensões de escopo possíveis — exige regra explícita de qual prevalece                     |
| **Auditoria / LGPD**          | Evento registra `team_id` (já existe) mas não consegue registrar departamento (F1)                           | `team_id` e `unit_id` já existem — **melhor cobertura sem migration**                 | Idem, com o gap de departamento (F1)                                                             |
| **Portal do Gestor (futuro)** | Gestor de equipe tem escopo claro (a equipe), independente da dimensão                                       | Idem                                                                                  | Idem — em todos os casos a equipe é o nó mais granular e serve bem de âncora de escopo do gestor |
| **Outros módulos futuros**    | Treinamento por equipe ok; ponto TXT precisa da unidade por outro caminho                                    | Ponto TXT natural; visão funcional prejudicada                                        | Cobre ponto TXT (unidade) e treinamento/indicador funcional (departamento)                       |

### Recomendação técnica (recomendação, não decisão)

**Alternativa C, com departamento obrigatório e unidade opcional.**
Justificativa: a equipe é o nó mais granular e o mais provável ponto de
ancoragem do escopo do gestor (D8); qualificá-la nas duas dimensões custa
uma coluna opcional agora e evita reclassificação em massa depois.
`unit_id` opcional cobre equipes corporativas sem local definido, sem
forçar preenchimento artificial.

Ressalva: exige regra de integridade garantindo que o departamento e a
unidade da equipe pertençam à **mesma empresa** (R5 da spec).

### Pergunta objetiva para o produto

**P2.1:** Uma equipe pertence a um departamento, a uma unidade, ou às
duas coisas?

**P2.2:** Existem equipes sem local físico definido (corporativas)? Se
sim, a unidade precisa ser opcional.

## 4. D3 — Cargo/função

**Pendência de origem:** DP-3.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), itens 4 e 5.** Nesta fatia
> existe **apenas cargo** — função fica para a futura vida funcional do
> colaborador, sem entidade, campo ou regra criada agora (resolve P3.3: a
> resposta é "por ora, um conceito só — cargo"). O catálogo de cargos é
> **por empresa** (**Alternativa A abaixo**, a recomendada), com código
> padronizável para consolidação futura entre empresas (resolve P3.1;
> P3.2 fica sem objeto, já que B não foi adotada). Alternativas e
> avaliação preservadas como histórico.

### Alternativas

| #   | Alternativa                                       | Descrição                                                                 |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| A   | Catálogo por empresa                              | `job_role.company_id` obrigatório; cada empresa tem seu catálogo          |
| B   | Catálogo compartilhado no ambiente interno        | Catálogo único, sem `company_id`; todas as empresas usam os mesmos cargos |
| C   | Catálogo por empresa com modelo-base reutilizável | Modelos globais + instâncias por empresa derivadas deles                  |

### Avaliação

| Dimensão                            | A — por empresa                                                                                             | B — compartilhado                                                                                                                                 | C — modelo-base                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Benefício operacional**           | Cada empresa descreve seus cargos livremente                                                                | Cadastro único; consolidação trivial em relatórios e treinamentos                                                                                 | Padroniza sem impedir customização por empresa                                                |
| **Risco e custo de reversão**       | Baixo. A→B exigiria deduplicar cargos homônimos (ambíguo); A→C é **aditivo** (acrescentar camada de modelo) | **Alto.** B→A exige clonar o catálogo por empresa e remapear todas as referências (histórico funcional futuro incluído)                           | Médio-alto: é a mais complexa a construir, mas a mais estável a longo prazo                   |
| **Segurança / autorização**         | Consistente com `company_id` como fronteira (ADR 0005)                                                      | **Conflita com a ADR 0005:** um cargo sem `company_id` fica fora do modelo de escopo — RH da empresa A poderia alterar cargo usado pela empresa B | Instância por empresa preserva o escopo; o modelo global exige regra própria de quem o mantém |
| **Auditoria / LGPD**                | Evento de alteração de cargo tem escopo de empresa definido                                                 | Evento de alteração de cargo compartilhado **não tem empresa** — prejudica a prestação de contas por empresa                                      | Escopo claro na instância; alteração de modelo exige evento próprio                           |
| **Treinamentos por cargo (futuro)** | Treinamento atribuído por cargo precisa ser replicado por empresa                                           | Um treinamento cobre todas as empresas — o cenário mais simples                                                                                   | Treinamento pode ser atribuído ao modelo e herdado pelas instâncias                           |
| **Histórico funcional (futuro)**    | Referência estável por empresa; histórico não ambíguo                                                       | Se um cargo compartilhado for renomeado, o histórico de todas as empresas muda de uma vez                                                         | Modelo pode evoluir sem alterar a instância registrada no histórico — o melhor dos três       |
| **Relatórios/dashboards**           | Consolidação entre empresas exige padronizar códigos manualmente                                            | Consolidação nativa                                                                                                                               | Consolidação pelo modelo, com granularidade pela instância                                    |

### Recomendação técnica (recomendação, não decisão)

**Alternativa A — catálogo por empresa**, por ser a única das três
plenamente consistente com a decisão já registrada de que `company_id` é o
maior limite organizacional e de autorização (ADR 0005, decisão 3).

A vantagem operacional de B (consolidação de treinamentos e relatórios)
pode ser obtida **sem** entidade compartilhada, padronizando o `code` do
cargo entre empresas e agrupando por ele nos relatórios. Adotar B agora
criaria uma exceção ao modelo de escopo — a primeira do sistema — por uma
conveniência que tem alternativa.

C permanece a evolução natural se a duplicação virar custo real; A→C é
aditivo.

Observação relevante para o histórico funcional: qualquer que seja a
escolha, o histórico futuro deve referenciar o cargo por **identificador
imutável**, nunca por nome — para que renomear um cargo não reescreva o
passado.

### Pergunta objetiva para o produto

**P3.1:** As empresas do ambiente interno compartilham a mesma tabela de
cargos, ou cada uma tem a sua?

**P3.2:** Se compartilharem: aceita-se que um cargo não pertença a nenhuma
empresa, ficando fora da fronteira de autorização por `company_id`?

**P3.3:** "Cargo" e "função" são o mesmo conceito neste contexto, ou são
distintos — cargo como posição formal e função como atribuição exercida?
(F6; a distinção é comum em RH brasileiro e muda a modelagem.)

## 5. D4 — Centro de custo

**Pendência de origem:** DP-5.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), item 6.** Centro de custo é
> cadastrado por empresa, **sem associação** a unidade, departamento,
> área ou equipe nesta fatia — **Alternativa A abaixo**, a recomendada.
> Resolve P4.1 (basta o cadastro). P4.2 fica sem objeto para esta fatia:
> a resposta da Baseline V1 é "nenhuma associação estrutural agora",
> independentemente de o centro de custo ser, no uso real, atributo do
> setor ou da pessoa — essa distinção só importará quando a associação
> for revisitada (não nesta fatia). Alternativas e avaliação preservadas
> como histórico.

### Alternativas

| #   | Alternativa                                                        | Descrição                                                          |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| A   | Por empresa, sem associação estrutural nesta fatia                 | Cadastro simples: código, nome, status, empresa                    |
| B   | Por empresa, com associação opcional a unidade/departamento/equipe | Além do cadastro, o centro de custo é ligado a nós organizacionais |
| C   | Outro modelo, só se tecnicamente necessário                        | Ex.: hierarquia de centros de custo, rateio                        |

### Avaliação

| Dimensão                      | A — só cadastro                                                                                                                                                                  | B — com associação                                                                                      | C — outro                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Benefício operacional**     | Entrega o cadastro exigido com custo mínimo                                                                                                                                      | Permite responder "qual centro de custo desta equipe?" já nesta fatia                                   | Só se houver requisito real; nenhum foi apresentado               |
| **Risco e custo de reversão** | **Muito baixo.** A→B é aditivo (coluna FK opcional ou tabela de associação)                                                                                                      | Médio: decidir **a que** associar sem caso de uso corre risco de escolher o nó errado e ter de remapear | Alto: hierarquia/rateio sem requisito é complexidade especulativa |
| **Segurança / autorização**   | Escopo por empresa, consistente                                                                                                                                                  | Idem, mas a associação múltipla exige validação de mesma empresa em cada ponta                          | —                                                                 |
| **Auditoria / LGPD**          | Eventos simples de criação/alteração/inativação                                                                                                                                  | Cada mudança de associação vira evento adicional                                                        | —                                                                 |
| **Módulos futuros**           | Quando houver colaborador/folha, a associação natural pode ser **ao colaborador ou ao vínculo**, não ao nó organizacional — o que tornaria a associação estrutural desnecessária | Se a associação correta for ao colaborador, o que foi construído aqui vira peso morto                   | —                                                                 |

### Recomendação técnica (recomendação, não decisão)

**Alternativa A — cadastro por empresa, sem associação estrutural.**
O argumento decisivo é o da última linha: em sistemas de RH, o centro de
custo costuma ser atributo do **vínculo do colaborador**, não do nó
organizacional — e o colaborador não existe nesta fatia. Associar agora a
unidade/departamento/equipe é decidir sem o caso de uso, com risco de
escolher o ponto errado.

A é o mínimo que cumpre o requisito ("centro de custo quando aplicável") e
mantém A→B totalmente aditivo.

Reforço da restrição já vigente: **nenhuma** integração financeira,
contábil, orçamentária, de rateio ou de folha entra nesta fatia.

### Pergunta objetiva para o produto

**P4.1:** Nesta fase, basta cadastrar centros de custo, ou já é necessário
saber a que unidade/departamento/equipe cada um pertence?

**P4.2:** No uso real do escritório, o centro de custo é atributo do
**setor** ou da **pessoa/vínculo**? (A resposta determina se a associação
estrutural chega a ser necessária.)

## 6. D5 — Inativação com filhos ou referências ativas

**Pendência de origem:** DP-6 (e R-INA-2 da spec).

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), item 7.** Bloquear
> inativação quando houver elementos ativos vinculados (**Alternativa A
> abaixo**); **cascata (Alternativa C) não é adotada, em nenhuma
> hipótese**; transferência/reclassificação (Alternativa B) fica como
> **fluxo futuro**, fora desta fatia — mais conservador que a
> recomendação original (que sugeria B já nesta fatia como fluxo
> operacional). Resolve P5.1 e P5.2. Alternativas e avaliação preservadas
> como histórico.

### Alternativas

| #   | Alternativa                                                   | Descrição                                                               |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A   | Bloquear inativação enquanto houver filhos/referências ativos | A operação falha com mensagem indicando o que impede                    |
| B   | Exigir transferência/reclassificação prévia dos filhos        | Fluxo operacional próprio move os filhos antes de permitir a inativação |
| C   | Cascata explícita confirmada                                  | Uma ação inativa o nó e seus descendentes, com evento por entidade      |

### Avaliação

| Dimensão                      | A — bloquear                                                                                                 | B — transferir antes                                                                      | C — cascata                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Benefício operacional**     | Simples e previsível; força o operador a agir de baixo para cima                                             | Evita nós órfãos e preserva a operação: os filhos continuam ativos em outro pai           | Conveniente para reorganizações grandes                                                                              |
| **Risco e custo de reversão** | Muito baixo; é a regra mais conservadora                                                                     | Baixo, mas exige construir o fluxo de transferência (fora do CRUD básico)                 | **Alto risco operacional:** uma cascata acidental inativa uma subárvore inteira; desfazer exige reativar item a item |
| **Segurança / auditoria**     | Nenhum efeito colateral não auditado                                                                         | Cada transferência é um evento próprio — trilha rica                                      | Exige um evento por entidade afetada (R-INA-2), sob pena de a trilha não explicar o que aconteceu                    |
| **LGPD**                      | Neutro nesta fatia (sem dado pessoal)                                                                        | Neutro                                                                                    | Neutro                                                                                                               |
| **Módulos futuros**           | Quando houver colaborador, "filho ativo" passa a incluir pessoas alocadas — bloquear evita colaborador órfão | O fluxo de transferência já existiria, e é exatamente o necessário para remanejar pessoas | Cascata sobre nós com pessoas alocadas seria perigoso                                                                |

### Recomendação técnica (recomendação, não decisão)

**Alternativa A como regra do CRUD** (inativar recusa enquanto houver
filhos ou referências ativas, com mensagem clara sobre o que impede),
**mais B como fluxo operacional separado** — transferência/reclassificação
é uma operação própria, auditada, que precede a inativação. **C não é
recomendada** nesta fatia: o ganho de conveniência não compensa o risco de
inativação acidental em massa, ainda mais quando a mesma estrutura passará
a conter pessoas.

Reforço das regras já registradas na spec: exclusão física permanece
proibida (R6); inativação nunca apaga histórico; reativação é operação
explícita e auditada.

### Pergunta objetiva para o produto

**P5.1:** Ao inativar um departamento/unidade com equipes ativas, o
sistema deve **recusar** a operação, ou **inativar tudo junto** mediante
confirmação?

**P5.2:** O fluxo de "transferir equipes de um departamento para outro"
deve existir já nesta fatia, ou pode vir com a fatia de colaboradores?

## 7. D6 — Hierarquia

**Pendência de origem:** DP-10.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), item 8.** Hierarquia
> organizacional é **fixa** nesta versão — **Alternativa A abaixo**, sem
> árvore recursiva (B). A Baseline V1 é mais estrita que a recomendação
> original (que sugeria C — fixa com evolução planejada): aqui **nenhuma**
> relação de gestor, subordinados ou organograma de colaboradores é
> antecipada, nem estruturalmente. Resolve P6.1/P6.2 (ficam sem objeto —
> não há decisão sobre subdepartamento a fazer, pois recursão não é
> adotada) e reforça a decisão de D8 (§9) de não antecipar nada da relação
> de gestão. Alternativas e avaliação preservadas como histórico.

### Alternativas

| #   | Alternativa                        | Descrição                                                    |
| --- | ---------------------------------- | ------------------------------------------------------------ |
| A   | Estrutura fixa de níveis           | Empresa > unidade > departamento > equipe, profundidade fixa |
| B   | Estrutura recursiva                | Nós se referenciam (`parent_id`), profundidade arbitrária    |
| C   | Fixa agora, com evolução planejada | A da fase atual, desenhada para não impedir B depois         |

### Avaliação

| Dimensão                      | A — fixa                                                                                                  | B — recursiva                                                                                           | C — fixa com evolução                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Benefício operacional**     | Consultas triviais (joins diretos); organograma previsível; validação simples                             | Modela qualquer organograma real, inclusive subdepartamentos de N níveis                                | Entrega A hoje sem fechar a porta para B                              |
| **Risco e custo de reversão** | A→B é aditivo se planejado (acrescentar `parent_id` anulável); sem planejamento, exige repensar consultas | Alto custo imediato: consultas recursivas (CTE), detecção de ciclo, profundidade máxima, performance    | Baixo — é A com a evolução mapeada                                    |
| **Segurança / autorização**   | Escopo é direto: cada nó tem caminho único até a empresa                                                  | **Escopo por subárvore** exige percorrer a hierarquia a cada checagem — mais caro e mais fácil de errar | Igual a A hoje                                                        |
| **Auditoria**                 | Escopo do evento é resolvido sem recursão                                                                 | Registrar "escopo efetivo" de uma subárvore é ambíguo                                                   | Igual a A hoje                                                        |
| **Módulos futuros**           | Se o organograma real exigir subdepartamento, faltará expressividade                                      | Suporta "subordinados indiretos" (D8) naturalmente                                                      | Suficiente hoje; a expressividade extra entra quando houver requisito |
| **Portal do Gestor**          | "Subordinados indiretos" exigiriam níveis fixos conhecidos                                                | É a forma natural de responder "toda a subárvore abaixo do gestor"                                      | A decisão fica junto com a de gestor, na fatia certa                  |

### Recomendação técnica (recomendação, não decisão)

**Alternativa C — estrutura fixa agora, evolução planejada.** A recursão
é a resposta certa para organogramas complexos, mas cobra caro
antecipadamente: CTEs, prevenção de ciclo, custo de checagem de escopo por
subárvore — tudo isso para um ambiente interno cujo organograma real ainda
não foi mapeado.

Recomenda-se registrar explicitamente, na spec, que a evolução para
recursão é **aditiva** (introdução de `parent_id` anulável em
departamento) e que as consultas devem ser escritas de forma a não
impedir essa evolução.

Coerente com o pedido: a relação gestor–colaborador **não** é antecipada
aqui (D8).

### Pergunta objetiva para o produto

**P6.1:** O organograma real do escritório tem subdepartamentos (níveis
além de empresa > unidade > departamento > equipe)?

**P6.2:** Se tiver, isso é necessário na Fatia 1 ou pode aguardar?

## 8. D7 — Nomenclatura

**Pendência de origem:** DP-9. **Não define nomes definitivos de tabela** —
isso permanece decisão da fase Implementar.

> **🟡 PARCIALMENTE RESOLVIDO — Baseline V1 (2026-08-06).** As duas
> ambiguidades de **conceito** (não de nome de coluna) estão fechadas:
> "área" é subdivisão opcional de departamento, não sinônimo nem
> agrupamento acima (item 1, resolve P7.1 — mesma resposta de D1);
> "cargo" e "função" são, por ora, **um conceito só** — cargo — com
> função explicitamente adiada para a vida funcional futura (item 4,
> resolve P7.2 — mesma resposta de D3). **P7.3 ("unidade é sempre local
> físico?") permanece em aberto** — não foi endereçada pela Baseline V1;
> ver §12. Vocabulário e tabela abaixo preservados como histórico, com a
> coluna "Ambiguidade a resolver" ainda válida para "unidade". **Os nomes
> técnicos definitivos foram decididos separadamente — ver "Nomenclatura
> aprovada" logo abaixo.**

> **✅ NOMENCLATURA APROVADA — 2026-08-06 (resolve DP-9 integralmente).**
> O produto decidiu, em ciclo próprio, que a nomenclatura de negócio,
> código, banco, APIs, eventos e documentação técnica do Núcleo
> Organizacional é **em português**. Identificadores técnicos não usam
> acento, espaço, hífen interno nem caractere especial. Isso substitui a
> coluna "Termo técnico sugerido (en)" da tabela de vocabulário abaixo —
> preservada como histórico do raciocínio original, não como nome final.
>
> Nomes aprovados (tipo/model em PascalCase):
>
> | Conceito        | Tipo/model              | Tabela futura            |
> | --------------- | ----------------------- | ------------------------ |
> | Empresa         | `Empresa`               | `empresa`                |
> | Unidade         | `UnidadeOrganizacional` | `unidade_organizacional` |
> | Departamento    | `Departamento`          | `departamento`           |
> | Área            | `Area`                  | `area`                   |
> | Equipe          | `Equipe`                | `equipe`                 |
> | Cargo           | `Cargo`                 | `cargo`                  |
> | Centro de custo | `CentroCusto`           | `centro_custo`           |
>
> Convenções de forma: tipos/classes em PascalCase português; campos e
> variáveis em camelCase português (ex.: `empresaId`, `centroCustoId`);
> tabelas/colunas físicas futuras em snake_case português (ex.:
> `unidade_organizacional`, `empresa_id`); rotas futuras em português,
> minúsculas, plurais (ex.: `/v1/empresas`,
> `/v1/unidades-organizacionais`, `/v1/centros-de-custo`); eventos de
> auditoria futuros em português, minúsculas, separados por ponto (ex.:
> `organizacao.empresa.criada`). **"Cargo", nunca "Role"** — o domínio de
> autorização já usa "papel" (`AuthorizationSubject.role`) para outro
> conceito; usar "Role" para cargo colidiria.
>
> **Não renomeia nada já implementado.** `access_user`, `audit_event`,
> `company_id`/`unit_id`/`team_id`, `AuthorizationSubject`,
> `rbac.evaluator.ts`, `AuditAction`/`AuditResource` — tudo já mergeado
> nas Fatias 3 e 4 permanece em inglês, exatamente como está. A decisão
> vale só para o que o Núcleo Organizacional ainda vai criar.
>
> Formalização completa em
> [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) e
> na spec, [docs/modules/etapa1-nucleo-organizacional.md §3](../modules/etapa1-nucleo-organizacional.md).

### Vocabulário de negócio proposto (a validar)

| Termo (pt-BR de negócio) | Termo técnico sugerido (en) | Definição proposta                                                                          | Ambiguidade a resolver                                                     |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Empresa                  | `company`                   | Pessoa jurídica; maior limite organizacional e de autorização (ADR 0005)                    | Nenhuma                                                                    |
| Unidade                  | `unit`                      | Estabelecimento/local: filial, escritório, planta. Dimensão **geográfica**                  | Confirmar se "unidade" pode ser não-física (ex.: unidade de negócio)       |
| Departamento             | `department`                | Divisão **funcional** da empresa (Financeiro, Fiscal, RH)                                   | **Relação com "área"** (F6)                                                |
| Área                     | (a definir)                 | Não modelada separadamente na spec atual                                                    | **Sinônimo de departamento? Agrupamento acima? Subdivisão abaixo?** (P1.2) |
| Equipe                   | `team`                      | Grupo operacional dentro de um departamento; nó mais granular                               | Confirmar se há "subequipe"                                                |
| Cargo / função           | `jobRole` (ou `position`)   | Catálogo de posições/atribuições                                                            | **"Cargo" e "função" são um ou dois conceitos?** (P3.3)                    |
| Centro de custo          | `costCenter`                | Rótulo organizacional para agrupamento gerencial, **sem** integração financeira nesta fatia | Confirmar se o termo local é "centro de custo" ou outro                    |

### Avaliação

| Dimensão                         | Impacto                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Benefício operacional**        | Vocabulário estável evita que o mesmo conceito receba nomes diferentes em tela, API, banco e relatório — a principal fonte de retrabalho em sistemas de RH                                                                   |
| **Risco e custo de reversão**    | **Alto se decidido tarde.** Renomear conceito depois de existirem telas, endpoints, relatórios e treinamento de usuário custa muito mais que decidir agora. Renomear apenas a coluna é barato; renomear o **conceito** não é |
| **Segurança / auditoria / LGPD** | Indireto, porém real: `AuditResource` (F4) registra o tipo de recurso afetado — nome ambíguo produz trilha ambígua                                                                                                           |
| **Módulos futuros**              | Todos os módulos herdam este vocabulário; divergência aqui se propaga a organograma, Portal do Gestor, ponto, treinamentos e dashboards                                                                                      |

### Recomendação técnica (recomendação, não decisão)

Adotar o vocabulário de negócio da tabela acima como **glossário oficial**,
e resolver as duas ambiguidades de conceito (área; cargo vs. função)
**antes** da implementação — são questões de significado, não de nome de
coluna, e mudá-las depois é caro.

Recomenda-se ainda: nomes técnicos em inglês no código (coerente com o
código existente) e português de negócio na interface e na documentação —
padrão já praticado no repositório.

### Pergunta objetiva para o produto

**P7.1:** "Área" é um conceito distinto de "departamento" no vocabulário
do escritório? Se sim, está acima ou abaixo dele?

**P7.2:** "Cargo" e "função" são usados como sinônimos, ou distinguem
posição formal de atribuição exercida?

**P7.3:** "Unidade" é sempre um local físico, ou pode ser unidade de
negócio sem endereço?

## 9. D8 — Escopo futuro do gestor

**Pendência de origem:** DP-8. **Nada de relação de gestor é implementado
ou modelado nesta fatia** — a entidade colaborador não existe.

> **✅ RESOLVIDO (quanto ao princípio) — Baseline V1 (2026-08-06), item 8.**
> Confirmado: **nenhuma** relação de gestor, subordinados ou organograma
> de colaboradores é antecipada nesta fatia — **nem estruturalmente**.
> Resolve P8.1 (confirmado: sim, nenhuma relação de gestão nesta fatia).
> Isso é mais estrito que a recomendação original, que sugeria preparar
> certas propriedades (id imutável, hierarquia navegável, equipe
> granular) especificamente em função do gestor futuro. Essas
> propriedades **continuam existindo** no modelo — mas como consequência
> de outras decisões já tomadas por outros motivos (R1, D2, D6), nunca
> como preparação deliberada para gestão. A tabela abaixo é preservada
> como **registro histórico do raciocínio**, não como lista de itens
> "a construir para o gestor". **P8.2 (o escopo do gestor tende a ser por
> equipe?) permanece genuinamente futura** — não foi respondida pela
> Baseline V1 e só poderá ser respondida quando a entidade colaborador
> existir; ver §12.

### O que permanece explicitamente futuro

- Se o gestor enxerga **apenas subordinados diretos** ou também
  **indiretos** (toda a subárvore abaixo dele).
- Se o vínculo de gestão é com a **pessoa** (gestor de fulano) ou com o
  **nó organizacional** (gestor da equipe X).
- Como se representa gestão compartilhada, interina ou matricial.

Nenhuma dessas perguntas pode ser respondida sem a entidade colaborador —
tentar respondê-las agora seria especular sobre a modelagem da fatia
seguinte.

### O que o Núcleo Organizacional precisa oferecer para suportá-las depois

| Requisito de preparação                            | Por quê                                                                                                  | Já contemplado?                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Nós organizacionais com **identificador imutável** | Servirão de âncora estável do escopo de gestão; se o identificador mudar, o histórico de gestão se perde | Sim — spec R1 (código imutável) e id UUID                |
| **Hierarquia navegável** entre nós                 | "Subordinados indiretos" é, estruturalmente, "tudo abaixo deste nó" — exige navegar da raiz às folhas    | Sim, se D6 = A/C (navegação trivial); com B exigiria CTE |
| **Equipe como nó mais granular**                   | É o ponto de ancoragem mais provável do escopo de um gestor                                              | Depende de D2                                            |
| **Inativação sem perda de histórico**              | Um gestor de equipe inativa precisa continuar auditável no passado                                       | Sim — spec R6/R-INA-4                                    |
| **Vigência** dos nós                               | Para responder "quem geria o quê em determinada data"                                                    | **Não** — ver QT-1 (§10)                                 |
| `department_id` em `access_user`/`audit_event`     | Só necessário se o escopo do gestor for por departamento                                                 | **Não existe** (F1) — decisão adiável                    |

### Recomendação técnica (recomendação, não decisão)

Não antecipar nada da relação de gestão. Garantir apenas os cinco itens
"já contemplados" da tabela e **decidir QT-1 (vigência)**, que é o único
requisito de preparação hoje ausente e cuja introdução tardia seria cara
(exigiria reconstruir histórico que não foi capturado).

### Pergunta objetiva para o produto

**P8.1:** Confirma-se que nenhuma relação de gestão será modelada nesta
fatia, ficando integralmente para a fatia de colaboradores?

**P8.2:** É provável que o escopo do gestor venha a ser por **equipe** (e
não por departamento ou unidade)? A resposta orienta D2 e o gap de
`department_id` (F1), sem exigir implementação agora.

## 10. QT-1 — Questão transversal: vigência temporal

**Não constava das oito decisões originalmente solicitadas, mas é
requisito declarado do contexto de produto** ("alterações organizacionais
devem ser auditáveis, ter vigência quando aplicável e não apagar
histórico") — F5.

> **✅ RESOLVIDO — Baseline V1 (2026-08-06), item 9.** Vigência **não** se
> aplica aos nós organizacionais desta fatia — coincide com a
> **Alternativa A abaixo** para o cadastro em si. A Baseline V1 confirma
> explicitamente que vigência será tratada **futuramente nas associações
> do colaborador** (cargo, equipe, gestor, centro de custo) — o mesmo
> raciocínio da recomendação original (Alternativa C: vigência importa
> nas associações que mudam no tempo, não no cadastro estrutural).
> Resolve QT-1.1 e QT-1.2 — a decisão fica registrada, evitando o risco
> apontado de introdução tardia impedir reconstrução de histórico.
> Alternativas preservadas como histórico.

### O problema

`status` (`active` | `inactive`) responde "isto vale agora?". **Não**
responde "como era a estrutura em 1º de março?". Histórico funcional,
relatórios retroativos e conciliação de ponto/folha por competência
dependem da segunda pergunta.

### Alternativas

| #   | Alternativa                       | Descrição                                                                                |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| A   | Só `status`, sem vigência         | Modelo atual da spec; a trilha de auditoria é a única fonte de histórico                 |
| B   | Vigência em todas as entidades    | `vigente_de`/`vigente_ate` em cada nó                                                    |
| C   | Vigência só onde houver requisito | Ex.: apenas em associações que mudam com o tempo (lotação, cargo), não no cadastro em si |

### Avaliação resumida

| Dimensão                       | A                                                                                                 | B                                                        | C                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| **Custo agora**                | Nenhum                                                                                            | Alto: toda consulta passa a precisar de recorte temporal | Médio                   |
| **Custo de introduzir depois** | **Alto:** o histórico não capturado não pode ser reconstruído retroativamente                     | —                                                        | Médio                   |
| **Auditoria**                  | A trilha registra que houve mudança, mas reconstruir o estado numa data exige reprocessar eventos | Estado em qualquer data é consultável diretamente        | Depende do recorte      |
| **Módulos futuros**            | Histórico funcional e relatórios retroativos ficam limitados                                      | Plenamente suportados                                    | Suportados onde importa |

### Recomendação técnica (recomendação, não decisão)

**Alternativa C.** O cadastro organizacional em si (nome, código de uma
unidade) raramente precisa de consulta retroativa — a trilha de auditoria
já cobre "quem mudou o quê e quando". O que realmente exige vigência são
as **associações que mudam no tempo** (a lotação de um colaborador, o
cargo que ele ocupa) — e essas pertencem à fatia de colaboradores.

Recomenda-se, portanto: **não** introduzir vigência nos nós
organizacionais nesta fatia, e **decidir explicitamente** que a vigência
será modelada nas associações da fatia seguinte — registrando a decisão
para que não seja esquecida, já que introduzi-la tarde impede reconstruir
o passado.

### Pergunta objetiva para o produto

**QT-1.1:** É necessário responder "como era a estrutura organizacional em
uma data passada", ou basta saber a estrutura atual mais a trilha de
auditoria das mudanças?

**QT-1.2:** Se for necessário, isso vale para o cadastro dos nós, ou
apenas para as alocações de pessoas (fatia futura)?

## 11. Síntese (atualizada pós-aprovação da Baseline V1)

### Decisões que bloqueavam a implementação da Fatia 1 — todas resolvidas

| Decisão                                                                    | Por que bloqueava                                                                                        | Resolução (Baseline V1)                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **D1** — Departamento por empresa / unidade / híbrido                      | Define a chave estrangeira e a regra de unicidade de `department`; errar exige migração destrutiva (B→A) | Departamento por empresa; área = subdivisão opcional do departamento (itens 1–2)                                     |
| **D2** — Equipe vinculada a quê                                            | Define as FKs de `team` e a regra de unicidade                                                           | Equipe → departamento obrigatório, unidade opcional (item 3)                                                         |
| **D3** — Catálogo de cargos por empresa ou compartilhado                   | Define se `job_role` tem `company_id`; a opção B conflita com a ADR 0005                                 | Catálogo por empresa; só cargo, sem função nesta fatia (itens 4–5)                                                   |
| **D7** — Significado de "área" e de "cargo vs. função"; nomenclatura final | São questões de **conceito** (existem 5, 6 ou 7 entidades?) e de **nome** (DP-9)                         | Conceitos definidos pelos itens 1 e 4; nomenclatura em português aprovada em 2026-08-06 (resolve DP-9 integralmente) |

Nenhuma decisão bloqueante permanece pendente. `DP-9` (nomenclatura), que
constava como parcialmente resolvida na primeira aprovação, foi
**integralmente resolvida** em 2026-08-06 — ver "Nomenclatura aprovada"
em D7 (§8). P7.3 ("unidade é sempre local físico?") continua em aberto,
como questão de conceito genuinamente futura, não de nome.

### Decisões que podiam ser postergadas — status após a Baseline V1

| Decisão                                                 | Status                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D4** — Associação estrutural do centro de custo       | **Resolvida** (item 6): sem associação nesta fatia                                                                                                                         |
| **D5** — Fluxo de transferência/reclassificação         | **Resolvida** (item 7): bloquear inativação com vínculo ativo; **sem cascata em nenhuma hipótese**; transferência fica para fluxo futuro                                   |
| **D6** — Hierarquia recursiva                           | **Resolvida** (item 8): fixa nesta versão, sem recursão, sem preparação estrutural para gestor                                                                             |
| **D8** — Escopo do gestor                               | Princípio resolvido (item 8: nenhuma antecipação, nem estrutural); a pergunta de fundo (escopo por equipe?) segue **genuinamente futura**, depende da entidade colaborador |
| **QT-1** — Vigência                                     | **Resolvida** (item 9): não se aplica aos nós agora; entra nas futuras associações do colaborador                                                                          |
| **F1** — `department_id` em `access_user`/`audit_event` | **Resolvida** (item 2): não introduzido nesta fase — departamento/área não são fronteira de autorização nem entram no evento de auditoria                                  |

### Sequência executada (histórico — substitui a sequência originalmente recomendada)

A sequência original sugeria responder as perguntas em passos distintos
(P7.1/P7.2 → P1.1/P1.3 → P2.1/P2.2 → P3.1/P3.2). O produto aprovou a
Baseline V1 como pacote único em 2026-08-06, respondendo todas de uma vez.
Passos concluídos neste ciclo de registro:

1. Baseline V1 aprovada pelo produto.
2. Este documento atualizado: status, alternativas preservadas como
   histórico, anotações de resolução em cada seção D1–D8/QT-1.
3. Spec da Fatia 1
   ([docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md))
   atualizada para refletir a Baseline V1.
4. ADR 0006 criada
   ([docs/adr/0006-modelo-organizacional-interno-baseline-v1.md](../adr/0006-modelo-organizacional-interno-baseline-v1.md)).
5. Próximo passo, fora do escopo deste registro: iniciar a fase
   Implementar (schema → migration → serviços → endpoints → testes),
   sujeita aos critérios de aceite abaixo.

### Critérios de aceite para a futura implementação

- [x] Toda decisão bloqueante aprovada e registrada antes do primeiro
      commit de schema (Baseline V1, 2026-08-06).
- [x] Spec da Fatia 1 atualizada, com as pendências DP encerradas
      referenciando a decisão que as resolveu.
- [ ] Nenhuma entidade de colaborador, vínculo, admissão, salário, folha,
      ponto, documento, benefício ou dado pessoal criada.
- [ ] Nenhum CNPJ introduzido sem finalidade e validação específica
      (DP-4, ainda pendente — fora da Baseline V1).
- [ ] `company_id` permanece a única fronteira de autorização; nenhuma
      entidade organizacional, incluindo `department`/`area`, introduz
      escopo próprio de acesso; `department_id` não é introduzido em
      `access_user` nem `audit_event` (item 2).
- [ ] Exclusão física ausente: nenhuma rota `DELETE` em entidade
      organizacional.
- [ ] Inativação bloqueia quando há elementos ativos vinculados; nenhuma
      cascata é implementada em nenhuma hipótese (item 7).
- [ ] Nenhuma entidade, campo ou regra de "função" distinta de cargo é
      criada nesta fatia (item 4).
- [ ] Nenhum campo de vigência é introduzido nos nós organizacionais
      (item 9).
- [ ] Nenhuma relação de gestor, subordinado ou organograma de
      colaboradores é criada, nem estruturalmente (item 8).
- [ ] Toda mutação organizacional é atômica com seu evento de auditoria
      (ADR 0004) e o enum `AuditAction` é estendido por migration aditiva.
- [ ] Revisão de segurança antes do merge; nenhuma alteração no
      comportamento de autorização já mergeado sem decisão registrada.
- [ ] MFA continua obrigatório antes de piloto com dados reais ou produção
      (ADR 0003) — inalterado.

### Estratégia mínima de testes

**Integridade estrutural**

- Unicidade de `code` no escopo correto (departamento por empresa, equipe
  por departamento, cargo por empresa — conforme Baseline V1), com prova
  de que a duplicata é rejeitada.
- Imutabilidade de `code` e da empresa de uma entidade (spec R1/R7).
- Recusa de referência cruzando empresas (spec R5): equipe não referencia
  departamento de outra empresa.
- Hierarquia fixa nesta versão (item 8): sem árvore recursiva, logo sem
  risco de ciclo por construção — não requer teste de ciclo nesta fatia.

**Autorização por `company_id`**

- Para cada papel da matriz (spec §8), teste positivo e negativo.
- Ator de uma empresa não lê, não altera e não inativa entidade de outra
  empresa, em toda rota que aceita identificador — resposta **404**, nunca
  403 nem 200 (anti-enumeração, spec §10).
- Bootstrap administrativo continua funcionando com a exceção temporária
  aprovada (decisão de escopo de autorização interna).
- Departamento e área não aparecem no sujeito de autorização nem
  restringem consulta (item 2) — teste negativo confirmando ausência de
  filtro por `department_id`.

**Auditoria**

- Cada evento de §9 da spec é gerado com ator, escopo e `request_id`
  corretos, sem `department_id`/`area_id` no evento (item 2).
- Atomicidade comprovada por **rollback real**: criação/alteração/
  inativação revertem por completo quando a persistência do evento falha
  (padrão já implementado na Fatia 4).
- Tentativa negada gera evento `denied`.

**Inativação**

- Inativar nó com filhos ativos é sempre recusado (item 7) — nenhum teste
  de cascata, pois cascata não é implementada em nenhuma hipótese.
- Entidade inativa não aceita novos vínculos (spec R-INA-3).
- Vínculos preexistentes sobrevivem à inativação (spec R-INA-4).
- Reativação é auditada e revalida a unicidade no escopo (spec R-INA-5).

## 12. Perguntas consolidadas — apenas as genuinamente futuras

Todas as demais perguntas originalmente listadas (P1.1–P6.2, P7.1, P7.2,
P8.1, QT-1.1, QT-1.2) foram respondidas pela Baseline V1 e estão
registradas na seção 11. Restam apenas as perguntas que a Baseline V1 não
endereçou e que continuam genuinamente em aberto:

| #    | Pergunta                                   | Situação                                                                          |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| P7.3 | "Unidade" é sempre local físico?           | Não coberta pela Baseline V1; permanece futura (ver D7 §8)                        |
| P8.2 | O escopo do gestor tende a ser por equipe? | Depende da entidade colaborador, ainda não modelada; permanece futura (ver D8 §9) |

Pendência não modelada por pergunta P-numerada, mas que também segue em
aberto (ver Baseline V1 — "O que permanece pendente"): DP-4 (CNPJ da
empresa). `DP-9` (nomenclatura) foi **integralmente resolvida** em
2026-08-06 — ver "Nomenclatura aprovada" em D7 (§8) — e não é mais
pergunta pendente.
