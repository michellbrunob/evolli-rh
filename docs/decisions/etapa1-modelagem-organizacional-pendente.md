# Modelagem organizacional interna — proposta de decisão

> ## PENDENTE DE APROVAÇÃO DO PRODUTO — NÃO IMPLEMENTAR
>
> Este documento **não decide nada**. Apresenta fatos verificados,
> alternativas, impactos e recomendações técnicas para que o responsável
> pelo produto decida. Nenhuma recomendação aqui pode ser implementada
> antes de aprovação explícita e registrada.

- Fase do rito SDD: **Especificar / Decidir**
- Data do levantamento: 2026-08-06
- Origem: decisões pendentes **DP-1, DP-2, DP-3, DP-5, DP-6, DP-8, DP-9 e
  DP-10** de
  [docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md)
- Relacionado:
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [decisão de escopo de autorização interna](etapa1-escopo-autorizacao-interna-pendente.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)

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

**Não consta das oito decisões solicitadas, mas é requisito declarado do
contexto de produto** ("alterações organizacionais devem ser auditáveis,
ter vigência quando aplicável e não apagar histórico") — F5.

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

## 11. Síntese

### Decisões que bloqueiam a implementação da Fatia 1

Sem elas, não é possível escrever o schema sem decidir por suposição:

| Decisão                                                          | Por que bloqueia                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **D1** — Departamento por empresa / unidade / híbrido            | Define a chave estrangeira e a regra de unicidade de `department`; errar exige migração destrutiva (B→A) |
| **D2** — Equipe vinculada a quê                                  | Define as FKs de `team` e a regra de unicidade                                                           |
| **D3** — Catálogo de cargos por empresa ou compartilhado         | Define se `job_role` tem `company_id`; a opção B conflita com a ADR 0005 e precisa de decisão consciente |
| **D7 (parcial)** — Significado de "área" e de "cargo vs. função" | São questões de **conceito**, não de nome: definem se existem 5, 6 ou 7 entidades                        |

### Decisões que podem ser postergadas sem bloquear a Fatia 1

| Decisão                                                 | Por que pode esperar                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **D4** — Associação estrutural do centro de custo       | A recomendação (só cadastro) é aditiva; associar depois não quebra nada                          |
| **D5** — Fluxo de transferência/reclassificação         | A regra de bloqueio (A) é implementável já; o fluxo de transferência é operação própria, adiável |
| **D6** — Hierarquia recursiva                           | A evolução A→B é aditiva se planejada                                                            |
| **D8** — Escopo do gestor                               | Depende da entidade colaborador, que não existe                                                  |
| **QT-1** — Vigência                                     | Recomendação é não introduzir agora, **mas a decisão deve ser registrada**, não esquecida        |
| **F1** — `department_id` em `access_user`/`audit_event` | Só necessário se departamento virar fronteira de autorização (P1.3)                              |

### Sequência recomendada após a aprovação

1. Responder **P7.1/P7.2** (conceitos de área e cargo/função) — definem
   quantas entidades existem, e tudo depende disso.
2. Responder **P1.1/P1.3** (departamento: dono e se é fronteira de
   autorização) — define o schema de `department` e o gap F1.
3. Responder **P2.1/P2.2** (equipe) — depende de D1.
4. Responder **P3.1/P3.2** (cargos) — independente das anteriores, pode
   correr em paralelo.
5. Registrar **QT-1** (vigência) como decisão explícita, mesmo que seja
   "não agora".
6. Atualizar a spec da Fatia 1 com as decisões aprovadas e **encerrar as
   pendências DP correspondentes**.
7. Só então iniciar a fase Implementar (schema → migration → serviços →
   endpoints → testes).

### Critérios de aceite para a futura implementação

- [ ] Toda decisão desta lista aprovada e registrada antes do primeiro
      commit de schema; nenhuma resolvida por suposição durante a
      implementação.
- [ ] Spec da Fatia 1 atualizada, com as pendências DP encerradas
      referenciando a decisão que as resolveu.
- [ ] Nenhuma entidade de colaborador, vínculo, admissão, salário, folha,
      ponto, documento, benefício ou dado pessoal criada.
- [ ] Nenhum CNPJ introduzido sem finalidade e validação específica.
- [ ] `company_id` permanece a fronteira de autorização; nenhuma entidade
      escapa a ela sem decisão explícita (relevante para D3-B).
- [ ] Exclusão física ausente: nenhuma rota `DELETE` em entidade
      organizacional.
- [ ] Toda mutação organizacional é atômica com seu evento de auditoria
      (ADR 0004) e o enum `AuditAction` é estendido por migration aditiva.
- [ ] Revisão de segurança antes do merge; nenhuma alteração no
      comportamento de autorização já mergeado sem decisão registrada.
- [ ] MFA continua obrigatório antes de piloto com dados reais ou produção
      (ADR 0003) — inalterado.

### Estratégia mínima de testes

**Integridade estrutural**

- Unicidade de `code` no escopo correto (por empresa, por unidade — conforme
  D1/D2), com prova de que a duplicata é rejeitada.
- Imutabilidade de `code` e da empresa de uma entidade (spec R1/R7).
- Recusa de referência cruzando empresas (spec R5): equipe não referencia
  departamento de outra empresa.
- Ausência de ciclo na hierarquia (spec R8).

**Autorização por `company_id`**

- Para cada papel da matriz (spec §8), teste positivo e negativo.
- Ator de uma empresa não lê, não altera e não inativa entidade de outra
  empresa, em toda rota que aceita identificador — resposta **404**, nunca
  403 nem 200 (anti-enumeração, spec §10).
- Bootstrap administrativo continua funcionando com a exceção temporária
  aprovada (decisão de escopo de autorização interna).

**Auditoria**

- Cada evento de §9 da spec é gerado com ator, escopo e `request_id`
  corretos.
- Atomicidade comprovada por **rollback real**: criação/alteração/
  inativação revertem por completo quando a persistência do evento falha
  (padrão já implementado na Fatia 4).
- Tentativa negada gera evento `denied`.

**Inativação**

- Inativar nó com filhos ativos se comporta conforme D5 aprovada
  (recusa ou cascata), com evento por entidade afetada em caso de cascata.
- Entidade inativa não aceita novos vínculos (spec R-INA-3).
- Vínculos preexistentes sobrevivem à inativação (spec R-INA-4).
- Reativação é auditada e revalida a unicidade no escopo (spec R-INA-5).

**Dados de teste:** exclusivamente técnicos/sintéticos. Nenhum dado real
de RH, nenhum dado pessoal, nenhum usuário real.

## 12. Perguntas consolidadas para validação do produto

| #      | Pergunta                                                                   | Bloqueia implementação?                             |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------- |
| P1.1   | Departamento é um só na empresa, ou um por unidade?                        | **Sim**                                             |
| P1.2   | "Área" é sinônimo de departamento, agrupamento acima ou subdivisão abaixo? | **Sim**                                             |
| P1.3   | Departamento limita **acesso**, ou é só informação estrutural?             | **Sim** (define o gap F1)                           |
| P2.1   | Equipe pertence a departamento, unidade ou ambos?                          | **Sim**                                             |
| P2.2   | Existem equipes corporativas sem local físico?                             | **Sim** (define opcionalidade)                      |
| P3.1   | Catálogo de cargos por empresa ou compartilhado?                           | **Sim**                                             |
| P3.2   | Se compartilhado: aceita-se cargo fora da fronteira de `company_id`?       | **Sim**                                             |
| P3.3   | "Cargo" e "função" são um conceito ou dois?                                | **Sim**                                             |
| P4.1   | Basta cadastrar centros de custo, ou já associá-los à estrutura?           | Não                                                 |
| P4.2   | Centro de custo é atributo do setor ou da pessoa/vínculo?                  | Não                                                 |
| P5.1   | Inativar nó com filhos ativos: recusar ou cascata confirmada?              | Não (recomendação A é implementável)                |
| P5.2   | Fluxo de transferência entra nesta fatia?                                  | Não                                                 |
| P6.1   | O organograma real tem subdepartamentos?                                   | Não                                                 |
| P6.2   | Se tiver, é necessário na Fatia 1?                                         | Não                                                 |
| P7.1   | "Área" é conceito distinto de departamento?                                | **Sim** (mesma questão de P1.2)                     |
| P7.2   | "Cargo" e "função" distinguem posição formal de atribuição?                | **Sim** (mesma questão de P3.3)                     |
| P7.3   | "Unidade" é sempre local físico?                                           | Não                                                 |
| P8.1   | Confirma-se nenhuma relação de gestão nesta fatia?                         | Não                                                 |
| P8.2   | O escopo do gestor tende a ser por equipe?                                 | Não (orienta D2)                                    |
| QT-1.1 | É preciso responder "como era a estrutura em data passada"?                | Não, **mas decidir agora evita perda irreversível** |
| QT-1.2 | Vigência vale para os nós ou só para alocações futuras?                    | Não                                                 |
