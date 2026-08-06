# Escopo de autorização interna — proposta de decisão

> ## STATUS: PENDENTE DE APROVAÇÃO DO PRODUTO — NÃO IMPLEMENTAR
>
> Este documento **não decide nada**. Ele levanta fatos verificados no
> código atual, mede impactos e apresenta alternativas para que o
> responsável pelo produto decida. Nenhuma das alternativas abaixo pode
> ser implementada antes de aprovação explícita e registrada.

- Fase do rito SDD: **Especificar / Decidir**
- Data do levantamento: 2026-08-06
- Origem: decisão pendente **DP-7** de
  [docs/modules/etapa1-nucleo-organizacional.md](../modules/etapa1-nucleo-organizacional.md)
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md)

## 1. Por que este documento existe

A implementação do Núcleo Organizacional Interno (Etapa 1 — Fatia 1)
depende de uma definição que ainda não foi tomada: **qual é o escopo de
acesso do `admin_tecnico`**, e como tratar `auditor` e `dpo`.

A ADR 0005 (decisão 4) já registrou o **princípio** — acesso amplo interno
deve ser explícito, mínimo e auditado. Mas o princípio não determina, por
si só, a forma técnica. Implementar sem essa definição significaria decidir
por omissão uma regra de segurança em produção.

### Tensão que o produto precisa resolver conscientemente

A ADR 0005, decisão 4, afirma que `admin_tecnico`, `auditor` e `dpo`
"só podem acessar empresas para as quais tenham escopo autorizado".

**A Alternativa A deste documento contradiz essa formulação.** Se o produto
escolher A, a ADR 0005 precisará de emenda ou de ADR sucessora — não basta
implementar A e deixar a ADR dizendo o contrário. Isso está explicitado
aqui porque a contradição deve ser resolvida por decisão, não silenciada.

Este documento **não altera** a ADR 0005 nem a spec da Etapa 1.

## 2. Fatos confirmados no código atual

Tudo nesta seção foi lido no código em `main`, com referência a
arquivo e linha. Nada aqui é suposição.

### 2.1 Papéis existentes

Oito papéis, definidos como enum de banco `AccessRole`
(`apps/api/prisma/schema.prisma`) e espelhados em
`apps/api/src/auth/access-roles.const.ts`:

`admin_tecnico`, `rh`, `dp`, `gestor`, `financeiro`, `colaborador`,
`auditor`, `dpo`.

Nenhum papel de "plataforma" (operador multi-cliente) existe. Nenhum papel
pode ser adicionado ou removido sem migration — o enum é fechado no banco.

### 2.2 Quem recebe acesso amplo à trilha de auditoria

`apps/api/src/auth/authorization/rbac.evaluator.ts:62-74`, função
`evaluateAccessLog`:

```ts
function evaluateAccessLog(
  subject: AuthorizationSubject,
  target: AuthorizationTarget,
): boolean {
  if (target.action !== "read") {
    return false;
  }
  return (
    subject.role === "admin_tecnico" ||
    subject.role === "auditor" ||
    subject.role === "dpo"
  );
}
```

**Fato:** `admin_tecnico`, `auditor` e `dpo` leem a trilha de auditoria
inteira. **Não há nenhuma checagem de empresa** nesta função — o
`companyId` do sujeito sequer é consultado. Os demais cinco papéis são
negados.

Esses papéis são os únicos com acesso aos endpoints `GET /v1/audit/events`
e `GET /v1/audit/events/:eventId`
(`apps/api/src/audit/audit.controller.ts`, via
`@RequirePermission("access_log", "read")`).

### 2.3 Como `admin_tecnico` é tratado hoje

Três fatos independentes, todos verificados:

**(a) Escopo de instância inteira, explícito no código.**
`rbac.evaluator.ts:53-55`, em `evaluateOtherAccount`:

```ts
if (subject.role === "admin_tecnico") {
  return true; // escopo: instância inteira
}
```

Mesmo padrão em `evaluateUserRole` (`rbac.evaluator.ts:89-91`): retorna
`true` sem qualquer comparação de empresa.

**(b) O `admin_tecnico` de bootstrap nasce sem empresa.**
`apps/api/src/bootstrap/bootstrap-admin.ts:77-86` cria o primeiro
administrador com `companyId: null`, `unitId: null`, `teamId: null`.

**(c) Consequência estrutural — restrição de partida.** A função
`isSameCompany` (`rbac.evaluator.ts:103-112`) exige
`subject.companyId !== null`. Portanto, um `admin_tecnico` com
`companyId: null` **não passaria em nenhuma checagem por empresa**.

Isso significa que, hoje, o escopo global do `admin_tecnico` **não é
apenas uma conveniência: é o que torna o bootstrap possível**. Sem ele, o
primeiro administrador não conseguiria criar a primeira empresa nem
atribuir escopo a ninguém — inclusive a si mesmo (bloqueado por
`evaluateUserRole`, que nega alteração do próprio papel/escopo,
`rbac.evaluator.ts:80-84`). Qualquer alternativa precisa responder a esse
problema de partida.

**Proteções que o `admin_tecnico` já tem hoje, e que nenhuma alternativa
deve remover:**

- não altera o próprio papel/escopo (`rbac.evaluator.ts:80-84`);
- não "gerencia" a própria conta via `other_account`
  (`rbac.evaluator.ts:48-52`);
- não existe endpoint HTTP de criação de `admin_tecnico` — só o comando de
  bootstrap, que falha se já houver um administrador
  (`bootstrap-admin.ts:63-73`);
- toda ação passa pela trilha de auditoria (ADR 0004).

### 2.4 Escopos organizacionais: o que existe e o que não existe

**Existe:**

- `AuthorizationSubject` = `{ userId, role, companyId }`
  (`apps/api/src/auth/authorization/permission.types.ts:12-16`).
  **Só `companyId`** — `unitId`, `departmentId` e `teamId` não fazem parte
  do sujeito de autorização.
- `access_user` armazena `companyId`, `unitId`, `teamId`
  (`schema.prisma`), mas como **texto sem chave estrangeira** — não há
  entidade de empresa para referenciar (ADR 0003 §8).
- `isSameCompany` como única comparação de escopo
  (`rbac.evaluator.ts:103-112`).

**Não existe:**

- Nenhuma entidade `company`, `unit`, `department` ou `team` — a Etapa 1
  ainda não foi implementada.
- Nenhum vínculo N:N entre usuário e empresas: o modelo atual comporta
  **uma** empresa por usuário, não um conjunto.
- Nenhuma noção de `tenant` (ADR 0005, decisão 2 — deliberado).
- Nenhum escopo abaixo de empresa em uso na autorização, apesar de
  `unitId`/`teamId` existirem na tabela.

**Implicação direta:** qualquer alternativa que exija "empresas
autorizadas" (plural) para um usuário **precisa de estrutura de dados que
hoje não existe** — é mudança de modelo, não ajuste de condicional.

### 2.5 Testes que comprovam o comportamento atual

Estes testes passam hoje e **falhariam** se o comportamento mudasse — são
a medida objetiva do que está em produção:

| Teste                                                                             | Arquivo:linha                                               | O que comprova                                                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "admin_tecnico gerencia qualquer empresa (escopo instância)"                      | `rbac.evaluator.spec.ts:58`                                 | Admin gerencia conta com `targetCompanyId: "outra-empresa"` → permitido                                      |
| "admin_tecnico altera papel de terceiro em qualquer empresa"                      | `rbac.evaluator.spec.ts:165`                                | Admin altera papel em empresa diferente → permitido                                                          |
| "permite leitura só para admin_tecnico, auditor e dpo"                            | `rbac.evaluator.spec.ts:123`                                | Os três leem a trilha, sem checagem de empresa                                                               |
| "nega leitura para os demais papéis"                                              | `rbac.evaluator.spec.ts:134`                                | Os outros cinco papéis são negados                                                                           |
| "ninguém altera o próprio papel — nem admin_tecnico"                              | `rbac.evaluator.spec.ts:153`                                | Proteção contra autoelevação vale para o admin                                                               |
| "RBAC positivo: auditor e dpo leem a trilha (200)"                                | `audit.e2e-spec.ts:449`                                     | Fim a fim: `dpo` autenticado lê `GET /v1/audit/events`                                                       |
| "RBAC negativo: RH, DP, gestor, financeiro e colaborador não leem a trilha (403)" | `audit.e2e-spec.ts:402`                                     | Fim a fim: cinco papéis recebem 403                                                                          |
| Provisionamento nos e2e                                                           | `audit.e2e-spec.ts:264-275`, `identity.e2e-spec.ts:389-413` | O admin de bootstrap (`companyId: null`) cria usuários em empresas distintas — só possível com escopo global |

**Consequência de teste:** alterar o escopo do `admin_tecnico` quebra, no
mínimo, os dois testes unitários de escopo de instância e **todo o
provisionamento dos testes e2e** de identidade e auditoria, que dependem
de um admin sem empresa criando usuários em empresas diferentes. Não é uma
mudança localizada.

## 3. Alternativas para validação humana

Nenhuma foi escolhida. As três estão descritas com o mesmo nível de
detalhe, deliberadamente.

### Alternativa A — Admin técnico com acesso global interno, sempre auditado

O `admin_tecnico` mantém escopo de instância no ambiente interno. Todo uso
continua registrado na trilha de auditoria.

| Dimensão                                          | Avaliação                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Benefício operacional**                         | Nenhum problema de partida: o bootstrap funciona como hoje. Operação e suporte não travam por escopo mal atribuído. Zero mudança em código, testes e comportamento já homologado.                                                                                                                              |
| **Risco de segurança e LGPD**                     | Concentra poder total em uma conta. Sem MFA (adiado, ADR 0003), o comprometimento dessa conta expõe todo o ambiente. Contraria "mínimo" da ADR 0005 decisão 4 — exige emenda da ADR. Para LGPD, um acesso amplo permanente a dado pessoal futuro precisa de justificativa de necessidade documentada pelo DPO. |
| **Impacto técnico provável**                      | Nenhum. É o estado atual.                                                                                                                                                                                                                                                                                      |
| **Efeito sobre auditoria**                        | Mantido: toda ação já gera evento (ADR 0004). Porém a trilha registra _que_ houve acesso amplo, não o _limita_ — auditoria é detecção, não prevenção.                                                                                                                                                          |
| **Efeito sobre comercialização futura**           | Alto retrabalho quando houver cliente externo: um admin global cruzaria fronteira de cliente, o que é inaceitável em multitenant. A mudança seria obrigatória naquele momento, sobre dado real.                                                                                                                |
| **Dados/decisões adicionais necessários**         | Quantas pessoas terão a conta `admin_tecnico`? Haverá uso rotineiro ou só operação excepcional? DPO aceita acesso amplo permanente quando houver dado pessoal? MFA será antecipado para essa conta?                                                                                                            |
| **Avaliação técnica (recomendação, não decisão)** | Adequada **enquanto o uso for estritamente interno e o número de administradores for muito pequeno**. O risco cresce com: (1) chegada de dado pessoal real, (2) aumento de administradores, (3) qualquer usuário externo. Se escolhida, recomenda-se prazo de revisão explícito, não indefinido.               |

### Alternativa B — Admin técnico limitado às empresas explicitamente atribuídas

O `admin_tecnico` só acessa empresas às quais tenha sido explicitamente
associado.

| Dimensão                                          | Avaliação                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Benefício operacional**                         | Menor privilégio de fato. Um administrador comprometido expõe apenas as empresas atribuídas. Alinha-se diretamente à ADR 0005 decisão 4, sem emenda.                                                                                                                                                                                                                                                                                             |
| **Risco de segurança e LGPD**                     | Menor superfície. Novo risco introduzido: **lockout administrativo** — se ninguém tiver escopo sobre uma empresa (por erro ou por inativação de conta), não há caminho pela aplicação para recuperar, já que ninguém altera o próprio escopo (`rbac.evaluator.ts:80-84`) e o bootstrap falha se já houver admin (`bootstrap-admin.ts:63-73`). Exigiria procedimento de recuperação fora da aplicação.                                            |
| **Impacto técnico provável**                      | **O maior dos três.** Exige: (1) modelo de dados novo para vínculo usuário ↔ empresas (hoje é uma empresa por usuário, texto simples); (2) `AuthorizationSubject` deixa de ter `companyId` e passa a ter um conjunto; (3) reescrita de `evaluateOtherAccount`, `evaluateUserRole`, `evaluateAccessLog` e `isSameCompany`; (4) solução para o admin de bootstrap com `companyId: null` (§2.3c); (5) reescrita do provisionamento de todos os e2e. |
| **Efeito sobre auditoria**                        | Positivo: cada acesso passa a ter escopo declarado, tornando a trilha mais significativa. Exige que o evento registre o escopo efetivo usado.                                                                                                                                                                                                                                                                                                    |
| **Efeito sobre comercialização futura**           | O mais favorável: a estrutura de "escopo atribuído" é justamente o que a multitenancy exigirá. Reduz retrabalho futuro.                                                                                                                                                                                                                                                                                                                          |
| **Dados/decisões adicionais necessários**         | Como o primeiro admin recebe escopo, já que ninguém altera o próprio? Quem atribui escopo a um admin — outro admin? Qual o procedimento de recuperação de lockout? Um admin sem escopo pode criar a primeira empresa?                                                                                                                                                                                                                            |
| **Avaliação técnica (recomendação, não decisão)** | Tecnicamente a mais sólida a longo prazo e a mais alinhada às ADRs. Porém, hoje, **resolve um risco que ainda não existe** (não há múltiplas empresas nem clientes externos) ao custo de complexidade imediata e de um risco novo e concreto (lockout). Recomenda-se **não implementá-la agora isoladamente**, e sim quando houver mais de uma empresa real ou perspectiva concreta de comercialização.                                          |

### Alternativa C — Bootstrap global temporário, com perda de acesso amplo depois

O `admin_tecnico` nasce com acesso global para criar a estrutura
organizacional inicial e, cumprido um gatilho, passa a operar com escopo
restrito.

| Dimensão                                          | Avaliação                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Benefício operacional**                         | Resolve o problema de partida (§2.3c) sem manter privilégio amplo indefinidamente. Conceitualmente, é o meio-termo entre A e B.                                                                                                                                                                                                                                     |
| **Risco de segurança e LGPD**                     | Reduz a janela de exposição. Introduz risco de **estado intermediário mal definido**: se o gatilho de transição for ambíguo ou reversível sem controle, o sistema pode ficar permanentemente em "modo bootstrap" — com o risco da A e a complexidade da B. Um mecanismo de "reativar acesso amplo" mal projetado vira porta dos fundos.                             |
| **Impacto técnico provável**                      | O de B **mais** uma máquina de estados: onde o estado vive, o que dispara a transição, se é reversível, quem pode revertê-la e como isso é auditado. É a alternativa com mais superfície de erro de implementação.                                                                                                                                                  |
| **Efeito sobre auditoria**                        | Exige eventos novos e específicos: entrada em modo bootstrap, saída, e cada eventual reativação — cada um deles é evento de segurança de alta relevância.                                                                                                                                                                                                           |
| **Efeito sobre comercialização futura**           | Neutro a favorável: o estado final é equivalente ao de B; o modo bootstrap precisaria ser reavaliado por tenant.                                                                                                                                                                                                                                                    |
| **Dados/decisões adicionais necessários**         | Qual é exatamente o gatilho de saída (primeira empresa criada? confirmação manual? primeiro usuário não-admin?)? É reversível? Quem autoriza reverter? O que acontece se a estrutura precisar ser recriada depois? Como evitar que a reversão vire acesso amplo permanente disfarçado?                                                                              |
| **Avaliação técnica (recomendação, não decisão)** | Atraente no discurso, **a mais arriscada na prática** para o momento atual: entrega a complexidade de B somada a uma máquina de estados de segurança, para um ambiente que hoje tem um administrador e nenhuma empresa cadastrada. Recomenda-se considerá-la apenas se o produto rejeitar tanto A quanto B, e sempre com o gatilho definido antes da implementação. |

### Síntese das avaliações técnicas (recomendação, não decisão aceita)

Ordenadas por adequação ao **momento atual** (uso interno, um
administrador, nenhuma empresa cadastrada, sem `auditor`/`dpo` ativos):

1. **A**, com prazo de revisão explícito e reavaliação obrigatória quando
   entrar dado pessoal real ou aumentar o número de administradores.
2. **B**, se o produto preferir pagar a complexidade agora para evitar
   retrabalho depois — desde que o procedimento de recuperação de lockout
   seja definido antes.
3. **C**, apenas se A e B forem rejeitadas, e nunca sem o gatilho de
   transição fechado previamente.

Isto é uma **leitura técnica de trade-offs**, não uma decisão. A escolha é
do responsável pelo produto, e qualquer uma das três é implementável.

## 4. `auditor` e `dpo`: capacidade existente, necessidade não aprovada

**Fato:** não há, neste momento, usuários internos com os papéis `auditor`
ou `dpo` (contexto validado pelo produto). O comportamento desses papéis
existe no código (§2.2) e é coberto por testes (§2.5), mas **nunca foi
exercido por um usuário real**.

**Como tratar:** o comportamento atual desses papéis deve ser lido como
**capacidade técnica disponível**, não como **necessidade operacional
aprovada**. A leitura ampla da trilha que eles possuem hoje é resultado da
matriz da Fatia 3, não de um requisito de uso interno validado.

**O que este documento explicitamente não propõe:**

- **Não** propõe remover `auditor` ou `dpo` do enum de papéis. A ausência
  atual de usuários não autoriza remoção: são papéis previstos no plano
  mestre, exigidos por conformidade e cuja remoção exigiria migration
  destrutiva sobre enum de banco.
- **Não** propõe alterar o comportamento deles agora.
- **Não** conclui que o escopo atual deles é adequado — só registra que a
  questão não é urgente enquanto não houver usuário real, e que precisa ser
  respondida antes do primeiro provimento desses papéis.

**Ponto de atenção:** o dia em que o primeiro `auditor` ou `dpo` for
provisionado, ele receberá leitura da trilha inteira automaticamente, sem
nova decisão. Convém que a resposta à pergunta Q5 (§5) preceda esse
provimento.

## 5. Perguntas objetivas para o responsável pelo produto

| #   | Pergunta                                                                                          | Por que importa                                                                |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Q1  | Qual alternativa — A, B ou C — deve ser adotada para o `admin_tecnico`?                           | É a decisão que destrava a implementação da Etapa 1 (DP-7)                     |
| Q2  | Quantas pessoas terão conta `admin_tecnico` no uso interno?                                       | Uma pessoa e cinco pessoas mudam materialmente o risco da alternativa A        |
| Q3  | O `admin_tecnico` será usado rotineiramente ou só em operação excepcional?                        | Uso rotineiro com acesso global aumenta a exposição e enfraquece a trilha      |
| Q4  | Se A for escolhida: qual o prazo ou gatilho de revisão dessa decisão?                             | Evita que "temporário" vire permanente por omissão                             |
| Q5  | `auditor` e `dpo`, quando existirem, devem ler a trilha inteira ou só a das empresas atribuídas?  | Precisa ser respondida **antes** do primeiro provimento desses papéis (§4)     |
| Q6  | Se B ou C: qual o procedimento de recuperação caso ninguém tenha escopo administrativo (lockout)? | Sem isso, existe risco real de ficar sem caminho de recuperação pela aplicação |
| Q7  | Se B ou C: quem atribui escopo a um `admin_tecnico`, dado que ninguém altera o próprio escopo?    | Lacuna estrutural do modelo atual (§2.3c)                                      |
| Q8  | Se C: qual exatamente o gatilho de saída do modo bootstrap, e ele é reversível?                   | Gatilho ambíguo é o principal risco da alternativa C                           |
| Q9  | Se A for escolhida: aprova-se emendar a ADR 0005 (decisão 4), que hoje diz o contrário?           | A contradição precisa ser resolvida por decisão registrada, não silenciada     |
| Q10 | MFA deve ser antecipado para contas `admin_tecnico`, antes do piloto?                             | Acesso amplo sem segundo fator é o cenário de maior impacto de comprometimento |

## 6. Critério de aceite para a futura implementação (após a decisão)

Aplicável **somente depois** de Q1 respondida e registrada:

- [ ] Decisão registrada formalmente (emenda à ADR 0005 ou ADR sucessora),
      com data e responsável identificados.
- [ ] Se a decisão contrariar a ADR 0005 decisão 4 (caso da Alternativa A),
      a ADR foi emendada — nenhuma implementação contradiz ADR vigente.
- [ ] O comportamento implementado corresponde exatamente à alternativa
      aprovada — sem "melhorias" não decididas durante a implementação.
- [ ] Nenhuma proteção existente foi removida: ninguém altera o próprio
      papel/escopo; não há endpoint de criação de `admin_tecnico`; o
      bootstrap continua falhando se já houver administrador.
- [ ] O caminho de partida está resolvido e documentado: existe forma
      comprovada de criar a primeira empresa e atribuir o primeiro escopo.
- [ ] Se B ou C: procedimento de recuperação de lockout documentado em
      runbook, e testado ao menos uma vez.
- [ ] Toda a suíte existente passa, ou cada teste alterado tem justificativa
      explícita ligada à decisão aprovada — nenhum teste é enfraquecido para
      "passar".
- [ ] Todo acesso amplo, se mantido, gera evento de auditoria com escopo
      efetivo registrado.
- [ ] Revisão de segurança aprovada antes do merge, por tocar autorização
      em produção.
- [ ] MFA continua obrigatório antes de piloto com dados reais ou produção
      (ADR 0003) — inalterado por esta decisão.

## 7. Estratégia de testes exigida após a aprovação

Independente da alternativa escolhida:

- **Unidade (`rbac.evaluator.spec.ts`):** cada combinação papel × recurso ×
  ação × escopo, positiva **e** negativa. Os testes hoje existentes
  (§2.5) são o ponto de partida — os que mudarem devem ser reescritos para
  afirmar o novo comportamento aprovado, nunca simplesmente removidos.
- **Regressão de proteções invioláveis:** autoelevação bloqueada; sem
  endpoint de criação de `admin_tecnico`; bootstrap falha com admin
  existente. Precisam continuar verdes em qualquer alternativa.
- **Caminho de partida (e2e):** prova de que, do zero, é possível fazer
  bootstrap, criar a primeira empresa e provisionar usuários — exatamente o
  fluxo que hoje depende do escopo global (§2.5).
- **Se B ou C — prova negativa real:** administrador sem escopo sobre uma
  empresa recebe negação (404 conforme spec §10, nunca 403), em toda rota
  que aceite identificador.
- **Se C — máquina de estados:** teste de entrada e saída do modo
  bootstrap; prova de que a saída não é reversível sem autorização
  explícita; evento de auditoria em cada transição.
- **Auditoria:** todo acesso amplo gera evento com escopo efetivo; toda
  negação gera `authorization_denied`; atomicidade preservada conforme
  ADR 0004.
- **Dados:** exclusivamente técnicos/sintéticos. Nenhum usuário, dado de RH
  ou dado real criado para teste.

## 8. O que este documento não faz

Registro explícito dos limites, para evitar leitura equivocada:

- **Não decide** o escopo do `admin_tecnico`, de `auditor` ou de `dpo`.
- **Não altera** código, testes, schema, migration, endpoint, dependência,
  infraestrutura, ADR existente ou spec existente.
- **Não remove** nem propõe remover os papéis `auditor` e `dpo`.
- **Não declara** decisão arquitetural concluída — a ADR correspondente só
  existirá depois da aprovação.
- **Não declara** conformidade LGPD concluída: a adequação do acesso amplo
  a dado pessoal exige análise do DPO, que não foi feita.
- **Não cria** usuários, dados de RH ou dados reais.
