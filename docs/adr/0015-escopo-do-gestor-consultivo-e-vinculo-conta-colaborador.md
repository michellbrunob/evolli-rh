# ADR 0015 — Escopo do gestor consultivo por equipe atribuída e vínculo explícito entre conta de acesso e colaborador (resolve `DP-8` e `DP-23`)

- Status: **Aceito**
- Data: 2026-10-06
- Relacionado:
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md) (decisão 8 — `access_user`
  desacoplado de colaborador),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md) (decisão 3 — empresa
  como fronteira),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md) (decisão 8 —
  hierarquia fixa; `DP-8`),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md) (`DP-23`),
  [ADR 0012](0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (decisão 1 — privacidade é de RH + Jurídico),
  [pacote de decisão do escopo do gestor (T150)](../decisions/pacote-decisao-escopo-do-gestor.md),
  [decisões de Solicitações de Pessoas](../decisions/decisoes-gestao-documentos-e-solicitacoes-v1.md)
  (`PD-SOL-01`, `PD-SOL-05`).
- Constituição: v1.4.0, Princípios I, II e IV.

## Contexto

A T150 investigou a fundação para um Portal da Liderança e concluiu que ela não
existia — não por lacuna de implementação, mas por três decisões registradas que
se somavam: nenhuma relação gestor/subordinado, nem estruturalmente (ADR 0006,
decisão 8); nenhum vínculo entre conta de acesso e pessoa (`DP-23`); e estrutura
organizacional explicitamente recusada como fronteira de autorização, com
`empresaId` como a única. O resultado foi um
[pacote de decisão](../decisions/pacote-decisao-escopo-do-gestor.md), sem código.

A ADR 0006 havia classificado a sub-pergunta `P8.2` — "o escopo do gestor tende
a ser por equipe?" — como _"genuinamente futura"_, condicionada a _"quando a
entidade colaborador existir"_. **Essa pré-condição foi satisfeita**:
`Colaborador`, `VinculoFuncional` e `AlocacaoOrganizacional` existem e são
funcionais desde as T104–T117 e a T147. `DP-8` deixou de estar bloqueada por
ausência de modelo e passou a depender apenas de decisão de negócio.

Em **06/10/2026**, o proprietário do produto decidiu, literalmente:

> **"Aprovo as recomendações 1 a 9 para o escopo do gestor e DP-23"**

Esta ADR formaliza essa decisão. É uma decisão de **governança e de autorização**
— e, por consequência direta, de schema: a ADR 0006 já determinava que
transformar estrutura em fronteira de autorização exigiria _"uma decisão de
autorização nova, com sua própria migration e sua própria ADR ou emenda"_. Esta
é essa ADR, e a migration é a `20261006120000_fundacao_gestor_consultivo`.

## Decisões

### 1. Gestão por **equipe**

A unidade de subordinação é a **equipe** — o menor agrupamento operacional do
modelo atual. O escopo de um gestor é o conjunto de pessoas cuja **alocação
vigente** aponta para uma equipe que ele gerencia naquela data.

Departamento, área e unidade **não** viram fronteira de autorização por esta
ADR. A decisão 2 da Baseline V1 continua valendo para todos eles.

### 2. Um gestor pode responder por **múltiplas equipes**

A atribuição é uma linha por `(gestor, equipe, papel, período)`. Um gestor com
três equipes tem três linhas, e enxerga a união das três. Modelar isso depois
custaria migração de dados, e o custo de suportá-lo desde o início é nenhum.

### 3. Somente subordinados **diretos** das equipes atribuídas

Não há alcance indireto nem travessia de subárvore. Hierarquia recursiva
continua inexistente (ADR 0006, decisão 8), e esta ADR **não** a cria: alcance
indireto exigiria representar a árvore, que é decisão própria e não foi tomada.

### 4. Substituição temporária com início e término

A substituição é representada pela **própria vigência** da atribuição, sem campo
especial e sem estado. O substituto enxerga **exatamente o mesmo** que o
principal: cobertura que enxerga menos não cobre. A diferença entre os dois é de
registro e auditoria — quem respondia pela equipe, em que período —, nunca de
visibilidade.

### 5. Piloto **sem gestão matricial permanente**

Por equipe, no máximo **um principal** e, opcionalmente, **um substituto**
vigentes ao mesmo tempo. Gestão matricial permanente — um colaborador
respondendo a dois gestores com finalidades diferentes — **não** é aprovada
neste piloto e **não** é habilitada por esta ADR. Reabrir exige decisão nova.

A invariante é garantida pelo banco, não pela aplicação: EXCLUSION CONSTRAINT
sobre `(equipe, papel, daterange)`.

### 6. Conta ligada explicitamente ao colaborador **da mesma empresa** (`DP-23`)

O vínculo `AccessUser ↔ Colaborador` passa a ser **materializado**, revertendo a
decisão 8 da ADR 0003 no ponto específico em que ela o adiava _"até a Etapa 1
criar essas entidades de fato"_ — condição já cumprida.

A ligação é **sempre explícita**, criada pelo RH. A pessoa **nunca** é inferida
de e-mail, nome, cargo, papel ou qualquer campo textual: igualdade de e-mail
entre conta e cadastro não é prova de identidade. A mesma empresa é garantida no
banco por CONSTRAINT TRIGGER, em duas direções — o colaborador precisa ter
vínculo na empresa, e a conta precisa pertencer a ela.

Contas técnicas e globais simplesmente **não têm linha**: o vínculo é opcional
por ausência, nunca por empresa indefinida.

### 7. Projeção fechada do que o gestor vê

Nome, matrícula, situação do vínculo, vínculo (tipo e datas), cargo e lotação
vigentes, horário, resumo de jornada e andamento de solicitações.

**Dois destes ficam fora da primeira entrega, por ausência de contrato seguro**:

- **resumo de jornada** — não existe como dado persistido nem como rota; o
  núcleo de ponto é puro e não está ligado a nenhum controller. `DP-3J-12`
  (escopo de ponto do gestor) segue pendente;
- **andamento de solicitações** — o modelo é seguro, mas `tipo` e `motivo`
  revelam condição de saúde por inferência (um `atestado` é um diagnóstico
  implícito), e `PD-SOL-05` só autoriza _"informação operacional mínima"_, que
  ainda não está definida.

Ambos ficam para tarefa própria. Criar uma consulta paralela "só para o gestor",
sem o contrato, seria inventar a fronteira — exatamente o que a T150 recusou.

**Nunca saem** para o gestor, em nenhuma hipótese: remuneração, documentos
pessoais, informação médica, diagnóstico, MFA, segredo, e a `situacao` do
**colaborador** (que é agregada de todos os vínculos, inclusive de outras
empresas, e vazaria vínculo alheio por inferência — o gestor recebe a situação
do **vínculo**).

### 8. Atribuições com vigência e **histórico auditável**

Toda atribuição tem início e, quando encerrada, fim. **Encerrar nunca apaga**:
não há rota `DELETE`, toda FK é `ON DELETE RESTRICT`, e o histórico permanece
legível. Decisões de acesso usam o **estado vigente**; o histórico existe para
que uma consulta feita no passado continue explicável depois.

Nenhum escopo retroativo é criado silenciosamente: inserir atribuição com
vigência passada colide com a EXCLUSION se houver sobreposição, e qualquer
criação gera evento de auditoria na mesma transação.

### 9. Exceções individuais somente pelo RH, com justificativa, prazo e auditoria

A exceção alcança um **vínculo** nominal fora das equipes do gestor. Exige
motivo de catálogo fechado, justificativa não vazia e **prazo obrigatório** —
`vigencia_fim` é `NOT NULL`, porque exceção sem prazo vira regra permanente por
inércia. Só o RH concede; `dp` e o próprio gestor são negados.

Revogar antes do prazo encurta o alcance sem reescrever o período concedido: o
que foi decidido e quando mudou continuam ambos na trilha.

## O que esta ADR **não** decide

Registrado explicitamente para que o recorte não seja ampliado por leitura:

- **gestão matricial permanente** — não aprovada (decisão 5);
- **departamento, área ou unidade como fronteira** — não aprovados; a decisão 2
  da Baseline V1 segue íntegra;
- **empresa inteira como escopo de gestor** — jamais; a ausência de atribuição
  produz lista **vazia**, nunca fallback;
- **qualquer mutação pelo gestor** — `PD-SOL-01` o fixou como consultivo, e nada
  aqui o altera;
- **resumo de jornada e andamento de solicitações** — fora da primeira entrega
  (decisão 7); `DP-3J-12` segue pendente;
- **Portal do Colaborador (ESS)** — `DP-23` resolvido aqui é pré-condição dele,
  não autorização: o autoatendimento tem decisão própria;
- **`AccessUser.team_id`/`unit_id`** — continuam sem qualquer uso de
  autorização. São `TEXT` sem FK, sem validação de empresa e sem semântica
  definida (ADR 0003, decisão 8). A FK que aquela ADR postergou **nunca foi
  adicionada**, e isso segue como dívida registrada, independente desta decisão.

## Consequências

**Positivas.** `DP-8` e `DP-23` saem de pendentes, no recorte acima. A primeira
capacidade do papel `gestor` em todo o produto passa a existir, com escopo
provado no banco e não por disciplina de aplicação. O elo conta↔pessoa destrava
também o Portal do Colaborador, quando ele for decidido.

**Negativas, aceitas.** O RH ganha trabalho de configuração: ligar contas,
atribuir equipes e manter vigências. Essa é a contrapartida de não inferir
subordinação — e inferir era justamente o que a T150 demonstrou ser inseguro.
Um gestor sem atribuição vê lista vazia, o que parecerá "quebrado" até o RH
configurar; é o comportamento correto, e a interface precisará explicá-lo.

**De manutenção.** Seis ramos do avaliador RBAC passam a citar esta ADR em vez
de `DP-8` como motivo de negação. O `gestor` continua negado em todos eles — o
que mudou é a razão: não é mais "falta decidir", é "decidido, e o recorte é
outro recurso".

## Alternativas consideradas

- **Atribuição pessoa a pessoa** (gestor de Fulano). Exata e representa casos
  matriciais, mas cresce com o quadro e transforma reorganização em migração de
  dados. Rejeitada como modelo principal; sobrevive como **exceção individual**
  (decisão 9), que é onde ela de fato é necessária.
- **Usar `AccessUser.team_id`.** Parecia pronta e teria sido a mais barata.
  Rejeitada: sem FK, sem validação contra a empresa, invisível ao
  `AuthorizationSubject` e semanticamente ambígua entre "equipe que lidera" e
  "equipe a que pertence". Teria transformado um campo sem validação em
  fronteira de autorização, com vetor de vazamento entre empresas.
- **Hierarquia recursiva com alcance indireto.** Mais poderosa, e provavelmente
  o destino futuro. Rejeitada agora por exigir decidir a representação da árvore
  — decisão própria, sem demanda registrada, e que a ADR 0006 já havia recusado
  antecipar.
- **Inferir o colaborador pelo e-mail da conta.** Rejeitada sem contraparte:
  e-mail não é prova de identidade, e uma coincidência de endereço daria a
  alguém o escopo de outra pessoa.
