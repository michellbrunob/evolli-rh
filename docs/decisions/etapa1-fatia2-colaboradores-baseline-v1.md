# Baseline V1 de Colaboradores e Vida Funcional — decisão aprovada

Status: **DECISÃO APROVADA** (2026-08-07; complementada pelas decisões 14 e 15 na mesma data — ver §4)

Relacionado:
[docs/modules/etapa1-fatia2-colaboradores-vida-funcional.md](../modules/etapa1-fatia2-colaboradores-vida-funcional.md)
(spec atualizada para refletir esta decisão),
[ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
(formalização arquitetural), e — pelo padrão já usado na Fatia 1 —
[docs/decisions/etapa1-modelagem-organizacional-pendente.md](etapa1-modelagem-organizacional-pendente.md)
como precedente de formato para este tipo de registro.

## 0. Escopo e limites deste documento

Este documento registra **o que o produto decidiu** em 2026-08-07 para a
Etapa 1 — Fatia 2 (Colaboradores e vida funcional): um conjunto de 13
decisões que resolve a maior parte das pendências bloqueantes levantadas
na especificação original (2026-08-06/07), permitindo que a fase
Implementar comece **com dados sintéticos**, sem esperar por decisões que
seguem legitimamente fora do alcance de uma decisão de produto isolada —
retenção jurídica, base legal de categorias sensíveis, MFA.

**O que este documento não faz:**

- Não implementa nada — nenhum código, schema, migration, endpoint, teste,
  dependência, infraestrutura ou interface é criado aqui.
- Não cria campo real de dado pessoal — os quatro dados aprovados (§1)
  continuam existindo só como especificação, até a fase Implementar.
- Não altera nenhuma ADR de 0001 a 0006.
- Não cria o papel `diretoria`.
- Não antecipa gestor/subordinado, folha, ponto, documentos, benefícios,
  CNPJ, multitenancy, `tenant_id` ou RLS.
- Não declara conformidade LGPD, base legal ou retenção como concluídas —
  ver §2 para a distinção explícita entre o que esta decisão libera para
  implementação sintética e o que continua bloqueando piloto real.

## 1. As 13 decisões aprovadas

Cada decisão preserva, como histórico, as alternativas e riscos que a
motivaram na especificação original — referenciados abaixo, não
duplicados.

### Decisão 1 — Dados iniciais permitidos

**Aprovado:** matrícula, nome completo, situação, vínculo funcional.
**Não incluir:** CPF, RG, endereço, telefone, salário, dados familiares,
médicos, benefícios ou documentos.

**Alternativas e riscos preservados da spec original (§5.1, §5.2):** a
spec havia proposto esse mesmo conjunto mínimo como "funcionalmente
indispensável", sem aprová-lo — reconhecendo que mesmo campos
"plausivelmente indispensáveis" como CPF não deveriam entrar sem
finalidade concreta declarada (a finalidade pertence a módulos que ainda
não existem: folha, Etapa 4; documentos, Etapa 2). O risco identificado
então (**RI-F2-1** — dado pessoal entrando por conveniência de
implementação) é a razão de ser desta decisão: aprovar o conjunto mínimo
explicitamente, em vez de deixá-lo como "proposta" sujeita a ampliação
silenciosa durante a codificação.

**Efeito na especificação:** resolve **DP-11** para o escopo desta V1.
Qualquer campo além destes quatro continua exigindo decisão própria,
tratada como **DP-11 (V2)**.

### Decisão 2 — Matrícula

**Aprovado:** identificador funcional; única por Empresa; nunca usar CPF
como chave.

**Alternativas preservadas (spec original §4.1, §7, RI-C1/RI-C2):** a spec
havia deixado em aberto se a matrícula pertencia ao colaborador (entidade
única, empresa-agnóstica) ou ao vínculo (escopado à empresa), justamente
porque a unicidade "por empresa" só faz sentido inequívoco se o campo
mora onde a empresa é propriedade nativa — o vínculo, não o colaborador.
Esta decisão resolve isso: **matrícula é campo do vínculo**, não do
colaborador. A proibição de CPF como chave (RI-C1) já estava registrada
como princípio inegociável na spec original e é apenas reafirmada aqui,
não alterada.

**Efeito na especificação:** resolve **DP-22**.

### Decisão 3 — Vínculos

**Aprovado:** histórico de vários vínculos é permitido; no máximo um
vínculo funcional ativo por Colaborador e Empresa nesta V1.

**Alternativas preservadas (spec original §3.2, §4.2, RI-V3):** a spec
apresentava a cardinalidade colaborador→vínculo como suportada em 1:N sem
se comprometer com um limite, deixando explícito que "se o produto decidir
vínculo único, isso vira restrição de unicidade adicional, aditiva". Esta
decisão não escolhe "vínculo único" nem "ilimitado sem controle" — escolhe
uma posição intermediária, objetivamente verificável: histórico
ilimitado, mas no máximo um em curso por par (colaborador, empresa).
Nasce daqui uma regra de integridade nova (RI-V6, spec §7) garantida por
restrição de banco, no mesmo padrão de RI-A1/RI-A2 já usado para alocação.

**Efeito na especificação:** resolve **DP-12**.

### Decisão 4 — Tipos de vínculo

**Aprovado:** CLT, estágio, PJ, temporário, outro controlado. Não
automatizar regra trabalhista.

**Alternativas preservadas (spec original §3.2, §4.2, §8):** a spec
listava como não decidido "quais tipos de vínculo existem (CLT, estágio,
PJ, aprendiz, temporário, aposentado, outros) e que regras trabalhistas
cada tipo carrega". Esta decisão fecha o catálogo com cinco valores,
incluindo um valor de escape controlado (`outro_controlado`, não texto
livre) para os casos que não caibam nos quatro tipos nomeados. O princípio
de não automatizar regra trabalhista — já inegociável na spec original
(§8: "o sistema registra decisões, não as toma") — permanece
integralmente, sem exceção por tipo.

**Efeito na especificação:** resolve **DP-13**.

### Decisão 5 — Dados restritos

**Aprovado:** salário, dados familiares, saúde, benefícios e documentos
ficam fora desta fatia.

**Alternativas preservadas (spec original §4.7, §5.3):** a spec já
propunha, como desenho, que dado restrito fosse segregado do cadastro
básico — mas deixava em aberto **quando** essas categorias entrariam,
tratando a introdução delas como bloqueante (**DP-14**) da fase
Implementar como um todo. Esta decisão separa as duas perguntas: a forma
de segregação (se e quando o dado existir) permanece o desenho de
referência da spec original, preservado intacto; a introdução em si é
adiada para fatia própria, deixando de bloquear a implementação do que
já está aprovado (decisões 1-4, 6-13).

O risco identificado na spec original (**RI-F2-2** — vazamento por
projeção esquecida) fica **eliminado nesta V1** simplesmente porque não
há campo restrito a vazar — reaparece, com a mesma mitigação estrutural
já desenhada, no dia em que uma fatia futura introduzir essas categorias.

**Efeito na especificação:** DP-14 permanece pendente, mas **reclassificada
de bloqueante da fase Implementar para "fora de escopo desta V1,
decisão própria de fatia futura"**.

### Decisão 6 — Retenção

**Aprovado:** sem exclusão física de Colaborador, VínculoFuncional ou
movimentação efetivada; política de retenção, anonimização e descarte
permanece obrigatória antes de piloto com dados reais ou produção; esta
decisão não declara aprovação jurídica/LGPD concluída.

**Alternativas preservadas (spec original §5.7, §7, RI-H1/RI-H2, RI-F2-3):**
a proibição de exclusão física (RI-H1, RI-H2, RI-C4, RI-M6) já era
princípio inegociável da spec original — reafirmada aqui, não introduzida
agora. A tensão entre essa imutabilidade e um eventual dever legal de
eliminação (**RI-F2-3**) permanece **exatamente como estava**: registrada,
não resolvida, com o caminho provável (anonimização seletiva preservando
a estrutura do histórico) preservado como hipótese de trabalho para
quando DPO/jurídico decidirem DP-15.

O que esta decisão **acrescenta** é a separação explícita de dois
momentos: a ausência de política de retenção não bloqueia código sobre
dado sintético (não há nada para reter ou descartar), mas continua
bloqueando qualquer piloto com dado real — ver §2 abaixo para o
detalhamento dessa distinção.

**Efeito na especificação:** DP-15 permanece pendente, **reclassificada
de "bloqueante da fase Implementar" para "gate de piloto real/produção,
não bloqueante de implementação sintética"**.

### Decisão 7 — Aprovações

**Aprovado:** não implementar workflow de aprovação nesta V1; RH e DP
autorizados registram alterações dentro do escopo aprovado, sempre
auditadas; nenhuma alteração trabalhista é decidida ou efetivada
automaticamente.

**Alternativas preservadas (spec original §4.5, RI-M5):** a spec havia
desenhado `AprovacaoMovimentacao` como entidade completa, com aprovador
distinto do solicitante e estados `aprovada`/`rejeitada`, mas deixava a
matriz de aprovação (quem aprova o quê, cadeia ou única) como decisão
pendente (**DP-17**) que bloqueava a fase Implementar. Esta decisão não
resolve a matriz de aprovação — **decide que ela não é necessária nesta
V1**, porque não há workflow. O desenho de `AprovacaoMovimentacao` é
preservado integralmente na spec como referência para quando (se) um
workflow formal for aprovado; a regra de segregação de funções RI-M5
(solicitante ≠ aprovador) fica registrada como "inaplicável nesta V1",
não removida.

**Risco novo identificado por esta decisão** (não existia na spec
original, porque a spec original presumia workflow): sem segunda revisão
humana, um erro de RH/DP se torna efetivo sem checagem prévia. A
mitigação (auditoria de quem registrou + retificação corretiva) é descrita
na spec (§12, **RI-F2-10**).

**Efeito na especificação:** resolve **DP-17**.

### Decisão 8 — Admin técnico

**Aprovado:** `admin_tecnico` não acessa dados pessoais de Colaborador; a
exceção temporária de acesso global permanece limitada à estrutura
organizacional; não ampliar essa exceção por herança.

**Alternativas preservadas (spec original §0 O4, §6):** a spec já
alertava, na sua própria observação O4, que a exceção do `admin_tecnico`
(Emenda 1 da [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md#emenda-1-2026-08-06))
havia sido concedida sobre um contexto sem dado pessoal (a Fatia 1), e que
estendê-la automaticamente a este domínio "ampliaria materialmente o
alcance de uma exceção aprovada em outro contexto, por inércia de
implementação". A versão anterior da spec já negava `admin_tecnico` para
**dado restrito** (⛔ DP-21) mas ainda concedia ✅ para **cadastro
básico**. Esta decisão fecha essa lacuna: nega **também** o cadastro
básico — não há mais distinção entre "dado restrito" e "dado pessoal" para
efeito desta negação, porque não é o grau de sensibilidade do dado que
está em jogo, é o **escopo da exceção concedida por outra ADR**.

Esta é a única das 13 decisões marcada como **resolução definitiva**, não
apenas "para esta V1" — porque não depende de o dado restrito existir ou
não; depende só da interpretação do alcance da Emenda 1 da ADR 0005, que
não muda com a evolução do domínio de Colaboradores.

O risco **RI-F2-6** (prazo da exceção do `admin_tecnico`, vencendo em
2026-11-04) fica **parcialmente mitigado**: como o papel não acessa mais
nenhum dado pessoal deste domínio, a reavaliação daquela exceção (que
trata só de estrutura organizacional) deixa de afetar este domínio.

**Efeito na especificação:** resolve **DP-21**, de forma definitiva.

### Decisão 9 — Nome social e identidade de gênero

**Aprovado:** não entram nesta V1; exigem requisito formal de RH e
avaliação específica de privacidade.

**Alternativas preservadas (spec original §4.1, §5.1, §5.3):** a spec
já classificava identidade de gênero como categoria **sensível**
(regime jurídico próprio na LGPD) e listava nome social como campo
pendente de DP-25, ligado à pergunta "se `nome` civil basta". Esta
decisão não inventa resposta a essa pergunta de RH — apenas confirma que,
por ora, a resposta operacional é "não entra", deixando a análise
completa (que envolve avaliação de privacidade específica para dado
sensível) para quando RH formalizar o requisito.

**Efeito na especificação:** resolve **DP-25** para o escopo desta V1;
extensão futura registrada como **DP-25 (V2)**.

### Decisão 10 — Alocação organizacional

**Aprovado:** obrigatória antes de efetivar vínculo ativo; rascunho pode
existir sem alocação.

**Alternativas preservadas (spec original §4.3, RI-A6 novo):** a spec
deixava em aberto (**DP-28**) se alocação era obrigatória, e — mais
granularmente — se cada campo dentro dela (unidade, departamento, equipe,
cargo) era individualmente obrigatório. Esta decisão resolve a primeira
pergunta (alocação, como registro, é obrigatória antes do vínculo entrar
em `ativo`) e explicitamente **não resolve** a segunda (obrigatoriedade
fina de cada campo) — que fica registrada como detalhe de implementação
não bloqueante, a validar com RH durante a implementação. Um vínculo em
`previsto` (rascunho, spec §8) continua podendo existir sem nenhuma
alocação, exatamente como a decisão descreve.

**Efeito na especificação:** resolve **DP-28** no nível de existência do
registro de alocação; a granularidade de campo permanece aberta, sem
bloquear.

### Decisão 11 — Motivos

**Aprovado:** usar catálogo controlado; não aceitar texto livre nesta V1.

**Alternativas preservadas (spec original §4.4, §5.3):** a spec já
identificava o risco concreto de motivo em texto livre (**dado sensível
digitado num campo de observação não classificado** — ex.: diagnóstico
médico num motivo de afastamento) e propunha `motivo_codigo` como
alternativa preferível, sem forçar a escolha. Esta decisão fecha o
mecanismo: só catálogo controlado, nunca texto livre, nesta V1. O
**conteúdo** do catálogo (quais códigos existem por tipo de movimentação)
não é decidido aqui — fica como detalhe de implementação, extensível de
forma aditiva (mesmo padrão de `AuditAction`), a validar com RH.

**Efeito na especificação:** resolve **DP-29** quanto ao mecanismo; o
conteúdo do catálogo permanece aberto, não bloqueante.

### Decisão 12 — Papel DP

**Aprovado:** pode atuar somente na própria Empresa; acesso a cadastro
básico e vínculo funcional; sem acesso a campos restritos, que permanecem
fora da fatia.

**Alternativas preservadas (spec original §6, matriz):** a versão
anterior da matriz de acesso já registrava essa ambiguidade
explicitamente: "DP é a área que operacionalmente executa admissão,
movimentação e desligamento — mas na Fatia 1 `dp` ficou com leitura
apenas. Estender `dp` para escrita no domínio de pessoas é decisão de
governança, não de simetria" — e por isso ficava negado (⛔ DP-30) até
decisão explícita. Esta decisão resolve a ambiguidade em sentido
diferente do que valia na Fatia 1: aqui, `dp` ganha leitura **e** registro
de alteração (combinando com a Decisão 7 — sem aprovador distinto, é
quem registra RH/DP que efetiva a mudança), sempre restrito à própria
empresa e sempre auditado. A ausência de acesso a dado restrito é
consequência automática da Decisão 5 (dado restrito nem existe nesta V1),
não uma restrição adicional imposta especificamente a `dp`.

**Efeito na especificação:** resolve **DP-30**.

### Decisão 13 — Diretoria

**Aprovado:** não criar novo papel agora; registrar que `diretoria` não
existe no enum atual e continua fora do escopo desta V1.

**Alternativas preservadas (spec original §0 O3, §6):** a spec já havia
identificado, por verificação objetiva no código (`AccessRole` tem 8
valores, sem `diretoria`), que o papel pedido no enunciado da tarefa
original não existia — e já registrava essa constatação como **DP-20**,
recusando conceder acesso "por interpretação". Esta decisão não altera
nada tecnicamente; **confirma formalmente**, como decisão de produto (não
apenas como observação de arquitetura), que o papel continua fora de
escopo. Criar o papel `diretoria` seguiria exigindo migration de enum,
alteração do avaliador RBAC/ABAC e decisão de superfície de autorização
em produção — nenhuma dessas ações é autorizada por esta decisão.

**Efeito na especificação:** reafirma **DP-20**, sem alteração de status
(continua pendente, não bloqueante desta V1).

## 2. Implementação com dados sintéticos × gate para dados reais/piloto/produção

Esta é a distinção central que separa "o que esta decisão libera" de "o
que continua bloqueado", e não pode ser confundida em nenhuma direção.

### Aprovado para implementação com dados sintéticos

As decisões 1 a 5 e 7 a 13 (com a decisão 6 no que se refere à proibição
de exclusão física) **liberam a fase Implementar** desta fatia, desde que
**nenhum dado real de pessoa entre em nenhum ambiente** — desenvolvimento,
teste, homologação. Isso significa, concretamente:

- Schema, migration, módulo, controllers, services e DTOs do domínio
  `pessoas` podem ser escritos.
- Testes unitários, de integração (Testcontainers) e e2e podem rodar,
  exclusivamente com dados fictícios (domínio reservado `exemplo.invalid`,
  nomes obviamente sintéticos, nenhum documento real).
- A matriz de acesso resolvida (decisões 8 e 12) pode ser implementada e
  testada, incluindo a negação explícita de `admin_tecnico`.
- O modelo de vigência, histórico e retificação pode ser construído e
  verificado com cenários sintéticos completos.

### Continua bloqueado até dados reais, piloto ou produção

Nenhuma das 13 decisões acima **resolve** os seguintes itens — eles
permanecem exatamente como estavam na spec original, e continuam
impedindo qualquer operação com dado real, mesmo que o código já exista e
passe em todos os testes com dado sintético:

- **MFA (TOTP)** — obrigatório antes de qualquer piloto com dado real ou
  produção ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  decisão 3). Esta Baseline V1 **não altera nem enfraquece** essa
  condição em nenhum grau — inclusive a agrava, por esta ser a primeira
  fatia com dado pessoal de titular real em jogo (quando dado real vier a
  existir).
- **DP-15 — Retenção, anonimização e descarte.** A decisão 6 confirma
  explicitamente que política de retenção "permanece obrigatória antes de
  piloto com dados reais ou produção" — DPO e jurídico ainda precisam
  definir prazo, critério de anonimização e processo de descarte, com
  atenção à tensão já registrada entre esse dever e a imutabilidade do
  histórico (spec §12, RI-F2-3).
- **Confirmação formal de DPO** de que os quatro dados aprovados (decisão
  1. têm base legal e finalidade adequadas para uso com titular real —
     esta decisão de produto **não substitui** essa confirmação. Aprovar o
     que o sistema coleta é uma decisão diferente de confirmar que a coleta
     está juridicamente amparada.
- **Qualquer extensão futura** (dado restrito — DP-14; workflow de
  aprovação — referência da decisão 7; gestor/subordinado — DP-16; novo
  papel — DP-20) exige decisão própria, com o mesmo rigor desta.

### Declaração explícita

**Esta decisão não declara aprovação jurídica ou de conformidade LGPD
concluída, em nenhum grau.** Ela autoriza a construção de código sobre
dado sintético dentro do escopo fechado das 13 decisões acima — nada
além disso.

## 3. Rastreabilidade

| Item da tarefa (enunciado original)   | Decisão nesta Baseline | Seção da spec atualizada |
| ------------------------------------- | ---------------------- | ------------------------ |
| 1. Dados iniciais permitidos          | Decisão 1              | §4.1, §5.1               |
| 2. Matrícula                          | Decisão 2              | §4.2, §7 (RI-C1/RI-C2)   |
| 3. Vínculos                           | Decisão 3              | §3.2, §4.2, §7 (RI-V6)   |
| 4. Tipos de vínculo                   | Decisão 4              | §3.2, §4.2               |
| 5. Dados restritos                    | Decisão 5              | §4.7, §5.3               |
| 6. Retenção                           | Decisão 6              | §5.7, §12                |
| 7. Aprovações                         | Decisão 7              | §4.5, §8                 |
| 8. Admin técnico                      | Decisão 8              | §0 (O6), §6              |
| 9. Nome social e identidade de gênero | Decisão 9              | §4.1, §5.1, §5.3         |
| 10. Alocação organizacional           | Decisão 10             | §4.3, §7 (RI-A6), §8     |
| 11. Motivos                           | Decisão 11             | §4.4, §7 (RI-M7)         |
| 12. Papel DP                          | Decisão 12             | §6                       |
| 13. Diretoria                         | Decisão 13             | §0 (O3), §6              |

## 4. Complemento aprovado (2026-08-07) — decisões 14 e 15

**Aditivo.** Nenhuma das treze decisões acima é alterada, reinterpretada ou
revogada. Esta seção registra duas decisões tomadas **depois** da Baseline V1,
em resposta a achados concretos da fase Implementar, e mantém o histórico
anterior legível — inclusive as limitações que estas decisões resolvem.

### Decisão 14 — `btree_gist` é pré-condição gerenciada de infraestrutura

**Aprovado:** a extensão `btree_gist` passa a ser pré-condição de
infraestrutura da base, provisionada pelo administrador/proprietário antes de
aplicar a migration da Fatia 2, para que o PostgreSQL garanta que períodos de
alocação organizacional de um mesmo vínculo não se sobreponham.

**Contexto (o que motivou).** A primeira entrega da implementação registrou uma
limitação honesta: a não-sobreposição **completa** de intervalos exigiria uma
`EXCLUSION CONSTRAINT` com `daterange` + `btree_gist`, e a extensão **não pode
ser criada por `evolli_migrator`** — verificado objetivamente:
`permission denied to create extension "btree_gist"`. O papel de migration não
tem `CREATE` na base **por desenho** (ADR 0002, menor privilégio): é dono do
schema `app` e nada além disso.

Na ocasião, a implementação **não** contornou a restrição: não ampliou o
privilégio do papel, não instalou a extensão por conta própria, e entregou
controles compensatórios (uma alocação aberta por vínculo, unicidade de
`(vinculo_id, vigente_de)`, CHECK de intervalo, lock de linha). A decisão foi
escalada como pendência de infraestrutura — que é o que esta decisão resolve.

**Consequência.**

- Novo script `infra/postgres/04_extensions.sql`, idempotente, executado pelo
  **admin/owner** — nunca por `evolli_migrator` ou `evolli_app`. Segue a
  convenção numérica já existente em `infra/postgres/`.
- **Nenhum privilégio é concedido a `evolli_migrator` ou `evolli_app`.** A
  ADR 0002 permanece integralmente válida: a separação de papéis não foi
  enfraquecida para acomodar a extensão. Há teste que falha se o papel de
  migration ganhar `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS` ou
  `CREATE` na base.
- A migration **verifica** a pré-condição e **aborta com mensagem explícita**
  se a extensão faltar — nunca cria a tabela sem a restrição, nunca degrada
  em silêncio para uma garantia mais fraca.
- Como a migration ainda **não estava publicada em `main`**, ela foi alterada
  no lugar, sem migration corretiva — o histórico de `main` permanece limpo.

**O que esta decisão não faz:** não autoriza instalar a extensão em ambiente
externo, homologação ou produção como parte desta entrega. Provisionar essas
bases é ato de operação, no momento do deploy, por quem tem o privilégio.

### Decisão 15 — `POST /v1/colaboradores` é oficialmente admissão atômica

**Aprovado:** `POST /v1/colaboradores` é uma **admissão atômica**, que cria, na
mesma transação, `Colaborador`, o primeiro `VinculoFuncional` e — quando o
vínculo já nasce ativo — a primeira `AlocacaoOrganizacional`. **Não pode
existir colaborador órfão**, sem empresa, vínculo ou escopo de autorização.

**Contexto (o que motivou).** A spec §10 descrevia `POST /v1/colaboradores`
como "cria cadastro". A implementação precisou criar cadastro **e** vínculo
juntos, e registrou isso como **desvio consciente** — porque `Colaborador` não
tem `empresa_id` (decisão 2: a empresa é propriedade do vínculo), então um
cadastro sem vínculo ficaria fora de todo escopo de autorização: invisível
inclusive para quem o criou, e impossível de auditar por empresa.

Esta decisão **promove aquele desvio a contrato oficial**, em vez de mantê-lo
como divergência tolerada entre spec e código.

**Consequência.**

- O contrato da spec passa a descrever a operação como admissão atômica. Não
  existe — nem passa a existir — endpoint de cadastro de colaborador sem
  vínculo.
- A invariante deixa de depender do service e passa a ser **estrutural**: duas
  `CONSTRAINT TRIGGER` _deferidas_ garantem, no COMMIT, que (a) todo
  colaborador tem ao menos um vínculo e (b) todo vínculo `ativo` tem alocação
  vigente. Verificação no commit, e não a cada comando, é o que permite que a
  ordem interna da transação continue livre — fechar a alocação vigente antes
  de abrir a sucessora, por exemplo.
- Vínculos posteriores continuam pelo fluxo próprio já existente
  (`POST /v1/vinculos`), sem alteração.
- **Auditoria atômica preservada e reforçada por teste:** se a gravação em
  `audit_event` falhar, nenhum dos registros persiste — e nenhum colaborador
  fica sem vínculo.

**O que esta decisão não faz:** não introduz nenhum dado além dos quatro
aprovados na decisão 1, não altera a matriz de acesso (decisões 8 e 12 —
`admin_tecnico` segue negado em todo o domínio; RH e DP seguem limitados à
própria empresa), e não move nenhum dos gates da §2.

### Atualização da rastreabilidade

| Item                                          | Decisão    | Seção da spec    |
| --------------------------------------------- | ---------- | ---------------- |
| 14. `btree_gist` como pré-condição gerenciada | Decisão 14 | §14.1, §14.7     |
| 15. Admissão atômica                          | Decisão 15 | §4.1, §10, §14.2 |
