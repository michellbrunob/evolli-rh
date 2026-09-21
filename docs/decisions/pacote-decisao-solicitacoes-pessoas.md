# Pacote de decisão — Solicitações gerais de Pessoas (T136)

- Status: **aguardando aprovação** — este é um **formulário de decisão** para
  **RH**, **Jurídico** e **Produto**. **Nenhum item abaixo está aprovado.** O
  documento **estrutura** as escolhas em campos objetivos e num registro por
  evidência (§8). Ele **não decide, não infere e não escolhe** catálogo final,
  alçada, prazo, evidência aceitável ou responsável, nem declara conformidade
  legal. Onde uma **recomendação técnica** aparece, ela é isso — uma proposta
  não aprovada — nunca um valor já decidido.
- Data de emissão: 2026-09-21 (T136).
- Fase/tarefa: preparação de decisões de produto para a futura **Central de
  Solicitações do Colaborador** (Pessoas > Solicitações), antes de qualquer
  fundação de backend (T137, que **não** deve iniciar antes do fechamento
  formal deste pacote).
- Relação com os registros-fonte: este pacote **operacionaliza**, em forma de
  formulário preenchível, as pendências **já catalogadas** em
  [decisões — Gestão de documentos e solicitações do colaborador](decisoes-gestao-documentos-e-solicitacoes-v1.md)
  §5 (identificadores `PD-SOL-…`) e as fronteiras já especificadas em
  [contrato conceitual da Central de Solicitações](../modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md)
  (T065) §2, §4, §8. **Os identificadores são reusados, não recriados** —
  aprovar um item aqui é aprovar a pendência de mesmo ID naqueles documentos.
- Investigação técnica de base: T135 (sem PR — investigação encerrada por
  ausência de contrato seguro), que confirmou por inspeção do código: (a) o
  núcleo `apps/api/src/solicitacoes/` é **TypeScript puro**, sem NestJS, sem
  import por nenhum controller/module; (b) não existe model Prisma genérico de
  `Solicitacao` (só `SolicitacaoDocumento`); (c) o único endpoint HTTP real com
  "solicitação" no nome é `solicitacoes-documento` (T133).
- Relacionado: [contrato "Verificar folhas"](../modules/etapa3-fila-verificar-folhas-contrato-v1.md)
  (taxonomia de pendências de Ponto, para `PD-SOL-02`),
  [mapa de capacidades de Ponto](mapa-capacidades-implantacao-ponto-v1.md)
  (papel do gestor), ADRs
  [0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA/sessão),
  [0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria append-only),
  [0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) (escopo por
  empresa, 404 anti-enumeração),
  [0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) (motivo
  codificado, decisão 5),
  [0011](../adr/0011-documentos-privados-e-admissao-digital.md) (documentos,
  metadado sem conteúdo),
  [0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (governança de perfis; RH único operador trabalhista).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  negação por padrão); Princípio V (auditoria append-only, segregação de
  funções); "Mandatory Architecture and Data Constraints" (nada de dado
  real/pessoal antes dos gates; nenhuma regra trabalhista inventada).

---

## 0. Como usar este formulário

1. **Não crie identificadores novos.** Toda decisão aqui usa `PD-SOL-01` a
   `PD-SOL-05`, já catalogados no registro-fonte (§5 daquele documento).
2. Cada seção de decisão (§2) traz o **contexto já especificado**, **opções
   elegíveis** (quando existem, extraídas dos documentos-fonte — nunca
   inventadas) e uma **recomendação técnica**, claramente rotulada como **não
   aprovada**.
3. O **quadro por tipo de solicitação** (§3) separa, para cada tipo, o que **já
   está especificado** (contrato T065 ou diretriz já recebida do RH) do que
   **exige decisão humana** — sem preencher a segunda coluna por conta própria.
4. O **registro de decisão** (§8) tem campos **vazios**. Preenchê-lo é o ato de
   aprovação; até então, o status de todo item permanece **Pendente**.
5. Este pacote **não** libera a T137 (fundação de backend). O efeito de cada
   decisão sobre essa fundação está mapeado em §6.

**Limites deste pacote (invioláveis):**

- **Não implementa nada:** sem API, endpoint, schema, migration, UI funcional,
  dependência ou configuração.
- **Não decide regra trabalhista, cronograma, fornecedor ou base legal.**
- **Não confunde domínios.** Este pacote trata **exclusivamente** da futura
  Central de Solicitações do Colaborador (Pessoas > Solicitações, tipos gerais
  como férias/ausência/contestação de ponto/atualização cadastral). Ele **não**
  é sobre:
  - `solicitacoes-documento` / `documento_metadado` — **já funcional** (T133),
    com endpoint, RBAC, CSRF e auditoria reais. Nenhuma decisão deste pacote
    reabre, altera ou substitui esse contrato.
  - `ajuste_ponto` — correção **direta do RH** sobre uma marcação de ponto
    (`POST /pontos/:id/ajustes`), já implementada; não é um fluxo de
    solicitação/aprovação iniciado pelo colaborador.
  - a fila **"Verificar folhas"** — objeto técnico do RH sobre uma marcação já
    existente (núcleo T059), com taxonomia e ciclo de vida **próprios**,
    distintos dos desta Central (ver §3.1, coluna "contestação de ponto").
- **Não declara conformidade legal** (CCT, Portaria MTP 671, LGPD, eSocial ou
  qualquer outra norma) e **não faz interpretação jurídica**.
- **Não relaxa** a negação por padrão nem a obrigação de auditoria.

---

## 1. Escopo e diferenciação de domínios (evidência técnica, não decisão)

| Domínio                                             | Status                     | Endpoint real                         | Persistência                    | RBAC de aplicação            | Iniciado por                        |
| --------------------------------------------------- | -------------------------- | ------------------------------------- | ------------------------------- | ---------------------------- | ----------------------------------- |
| **Central de Solicitações (Pessoas)** — este pacote | **Conceitual** (T065/T066) | Nenhum                                | Nenhuma (sem model Prisma)      | Nenhum (núcleo puro)         | Colaborador (futuro)                |
| Solicitação de documento (`solicitacoes-documento`) | **Real, funcional** (T133) | `POST/GET /v1/solicitacoes-documento` | `SolicitacaoDocumento` (Prisma) | Sim (`rh`/`dp`, por empresa) | RH/DP, em nome do colaborador       |
| Ajuste de ponto (`ajuste_ponto`)                    | **Real, funcional**        | `POST/GET /v1/pontos/:id/ajustes`     | Tabela de ajuste (Prisma)       | Sim (`ajuste_ponto`, RH)     | RH (correção direta, sem workflow)  |
| Pendência de "Verificar folhas"                     | **Conceitual** (T059)      | Nenhum                                | Nenhuma                         | Nenhum (núcleo puro)         | Sistema (detecção), revisada por RH |

Esta tabela é **evidência de código**, não decisão — reproduz o resultado da
investigação T135. Nenhuma linha muda de status por este pacote.

---

## 2. Decisões pendentes (`PD-SOL-01` a `PD-SOL-05`)

### 2.1 Matriz RH/gestor/Diretoria, catálogo final e alçadas — `PD-SOL-01`

**Já especificado (não reaberto):**

- RH recebe e analisa toda solicitação, na própria empresa (papel exclusivo já
  registrado; ADR 0012).
- Gestor é **negado** por padrão em toda operação trabalhista de Ponto/
  Solicitações até decisão formal (mapa de capacidades §2.3): "quando seu
  escopo for decidido, [o gestor] valida ou recomenda — **nunca** altera a
  marcação bruta. Toda mutação trabalhista continua exclusiva do RH."
- Diretoria participa só como **escalonamento excepcional**, fora da rotina.
- Catálogo inicial do contrato T065 §2 (5 tipos): `contestacao_ajuste_ponto`,
  `ausencia`, `ferias`, `atualizacao_cadastral`, `documento`.

**Decisão a tomar (RH + Jurídico):**

- [ ] Catálogo final de tipos: manter os 5 tipos do contrato T065, ou incluir
      `atestado` e/ou `benefícios` (direcionamento recebido do RH, ainda não
      aprovado)?
      Observação técnica: `atestado` é potencialmente **dado de saúde** — se
      incluído, herda também `PD-DOC-02` (base legal e minimização para
      documento médico/ocupacional). `benefícios` **não tem módulo
      operacional real** no sistema hoje — incluí-lo no catálogo, sem um
      destino operacional, deixaria a solicitação sem fluxo de encaminhamento
      possível.
      Observação técnica adicional sobre `documento`: este tipo é
      **homônimo**, não idêntico, ao fluxo já funcional de T133
      (`solicitacoes-documento`). Antes de mantê-lo no catálogo, vale decidir
      se ele ainda tem função própria (ex.: "preciso de um documento que a
      empresa ainda não tem cadastrado", diferente de "quero cópia de um
      documento já com metadado registrado") ou se é redundante e deve ser
      **removido** do catálogo conceitual para não coexistir com um fluxo já
      real.
- [ ] Papel do gestor: nenhuma participação / só "ciente" não-vinculante / voto
      consultivo sem poder de aprovar-recusar / aprovação em alçada inicial
      para subconjunto de tipos (especificar quais).
- [ ] Alçada por tipo: única (RH) para todos os tipos, ou diferenciada por
      tipo/valor de impacto (especificar matriz)?
- [ ] Papel da Diretoria: em quais tipos e sob quais condições ela é
      acionada (ex.: recusa contestada, exceção de política)?

**Alternativas consideradas:**

1. RH único aprovador para todos os tipos; gestor sem qualquer participação
   até decisão própria (status quo herdado, mais restritivo).
2. RH aprovador padrão; gestor com papel **consultivo não-vinculante** (ex.:
   "ciente"/comentário) em tipos de organização de equipe (férias, ausência),
   sem poder de aprovar ou recusar.
3. RH aprovador padrão; gestor com **poder de aprovação** em alçada inicial
   para um subconjunto restrito de tipos; Diretoria só em escalonamento.

**Recomendação técnica (não aprovada):** alternativa 2, como primeiro passo.
Preserva a segregação de funções já registrada (o gestor nunca "opera"
trabalhistamente; ADR/mapa de capacidades), evita criar uma nova capacidade de
RBAC/auditoria (aprovação por terceiro não-RH) antes de o escopo exato do
gestor ser definido, e é **expansível** para a alternativa 3 no futuro sem
retrabalho de modelagem. A alternativa 3 exigiria RBAC e trilha de auditoria
adicionais hoje não cobertos por nenhuma ADR. Sobre o catálogo: recomendo
**manter os 5 tipos** do contrato T065 nesta primeira rodada (menor
superfície) e tratar `atestado`/`benefícios` como decisão de fase 2,
condicionada também a `PD-DOC-02` (no caso de `atestado`).

- Responsável: **RH + Jurídico**.
- Evidência: matriz de decisão registrada + catálogo final confirmado.

### 2.2 Conciliação com a taxonomia de "Verificar folhas" — `PD-SOL-02`

**Já especificado (não reaberto):**

- "Verificar folhas" tem catálogo **fechado** e **próprio**: `batida_ausente`,
  `batida_fora_do_horario`, `jornada_incompleta`, `compensacao_pendente`,
  `dado_importacao_nao_associado` — objeto técnico do RH sobre uma marcação já
  existente, sem participação do colaborador.
- A Central de Solicitações tem seu próprio catálogo (§2.1) — objeto de
  **intenção do colaborador**, sem RBAC/mutação.
- Um tipo de "bloqueio de fechamento" é citado em ambos os contratos como
  **ainda não aprovado** em nenhum dos dois — não deve ser assumido como
  existente em nenhuma das duas taxonomias.

**Decisão a tomar (RH + Produto):**

- [ ] As duas taxonomias permanecem **totalmente separadas** (nenhuma
      referência cruzada), com o RH decidindo manualmente, fora do sistema, se
      uma contestação de ponto do colaborador gera uma pendência formal em
      "Verificar folhas"?
- [ ] Ou deve existir uma **referência técnica** (link) entre uma solicitação
      `contestacao_ajuste_ponto` `encaminhada_para_operacao_rh` e uma
      pendência de "Verificar folhas", preservando os dois ciclos de vida
      distintos (sem fundir os modelos)?
- [ ] O tipo "bloqueio de fechamento" (citado como pendente nos dois
      contratos) deve ser decidido **uma única vez**, valendo para as duas
      taxonomias, para não coexistirem duas definições divergentes?

**Alternativas consideradas:**

1. Taxonomias totalmente separadas, sem link técnico — RH concilia manualmente
   fora do sistema.
2. Taxonomias separadas, com uma referência técnica (id cruzado) entre uma
   solicitação encaminhada e uma pendência criada em resposta a ela.
3. Unificar os dois modelos em um único conceito.

**Recomendação técnica (não aprovada):** alternativa 1 para esta fase (zero
acoplamento = zero risco de regra inventada), evoluindo para a alternativa 2
somente se o Produto decidir, mais adiante, que rastrear a ligação vale o
custo de modelagem adicional. A alternativa 3 é **desaconselhada**: as duas
fronteiras já registradas são propositalmente distintas (uma é intenção do
colaborador sem RBAC; a outra é objeto técnico do RH sobre dado já existente),
e um dos dois catálogos ainda tem um tipo não aprovado pendente — fundir os
modelos multiplicaria esse risco.

- Responsável: **RH + Produto**.
- Evidência: decisão registrada sobre separação/link + definição única do tipo
  "bloqueio de fechamento".

### 2.3 Marco de início da análise e cancelamento posterior — `PD-SOL-03`

**Já especificado (não reaberto):** a máquina de estados do núcleo T066
**já implementa**, por desenho atual, que `cancelar` só existe nas transições
saindo de `rascunho`, `enviada` e `aguardando_informacao` — **não** existe
`cancelar` saindo de `em_revisao_rh`. Ou seja, tecnicamente, "início da
análise" já se comporta, no código hoje existente, como o instante em que a
solicitação entra em `em_revisao_rh`.

**Decisão a tomar (RH + Jurídico):**

- [ ] Ratificar esse comportamento já existente como a regra formal (marco de
      início = entrada em `em_revisao_rh`; sem cancelamento direto a partir
      daí, só via devolução para `aguardando_informacao`)?
- [ ] Ou definir uma janela de cancelamento diferente (ex.: um período de
      tempo após o envio, independente do estado)?
- [ ] Reabertura de estado terminal (`encaminhada_para_operacao_rh`,
      `recusada`, `cancelada`) — permitida por algum papel, ou nunca?

**Recomendação técnica (não aprovada):** ratificar o comportamento já
implementado no núcleo (marco = entrada em `em_revisao_rh`) — fechar esta
pendência **não exigiria** mudança de modelo, apenas a confirmação formal de
RH + Jurídico de que essa semântica já registrada é aceitável. Reabertura de
terminal: recomendo **não permitir** nesta fase (uma nova solicitação é mais
simples e mais auditável do que reabrir um registro terminal).

- Responsável: **RH + Jurídico**.
- Evidência: marco confirmado + regra de reabertura registrada.

### 2.4 Responsável e forma de contagem do prazo/SLA — `PD-SOL-04`

**Já especificado (não reaberto):** o valor "até dois dias úteis" mencionado
pelo RH é tratado, nos documentos-fonte, como **sugestão inicial, não regra
aprovada**. Nenhum módulo do sistema hoje calcula dias úteis, feriados ou
calendário por empresa.

**Decisão a tomar (RH + Produto):**

- [ ] Existe algum SLA nesta fase, ou a fila é medida só por relatório manual
      do RH (sem cronômetro no sistema)?
- [ ] Se existir SLA: quem é o responsável pela contagem, qual calendário
      (nacional? por empresa?) e quais exceções (tipos que dependem de
      terceiros)?

**Alternativas consideradas:**

1. Nenhum prazo nesta fase — sem cronômetro no sistema.
2. SLA fixo de "2 dias úteis" (sugestão do RH), calendário nacional padrão,
   sem exceções.
3. SLA parametrizável por tipo, decidido caso a caso.

**Recomendação técnica (não aprovada):** alternativa 1, para a primeira
fundação de backend. Codificar um contador de dias úteis exigiria definir
feriados/calendário por empresa — algo que **não existe em nenhum módulo do
sistema hoje** — e fazer isso sem essa definição seria inventar uma regra de
negócio não coberta por nenhuma decisão. As alternativas 2/3 ficam para uma
fase 2, após RH + Produto decidirem calendário e exceções.

- Responsável: **RH + Produto**.
- Evidência: decisão registrada (com ou sem SLA) + calendário/exceções, se
  houver.

### 2.5 Critérios de evidência por tipo — `PD-SOL-05`

**Já especificado (não reaberto):** nenhuma evidência, anexo, atestado, imagem
ou texto livre é aceito, anexado ou armazenado nesta fase, **independentemente
do tipo** (contrato T065 §6) — bloqueio válido até que **todos**,
cumulativamente, estejam resolvidos: base legal, retenção, minimização,
segurança, auditoria, MFA e validação RH + Jurídico. Hoje o MFA está desativado
por padrão (`MFA_ENABLED=false`, T131/T132) e `DS-OPS-01` segue aberto — logo
o pré-requisito de MFA/gate-mestre **não está satisfeito**.

**Decisão a tomar (RH + Jurídico + Segurança):**

- [ ] Quais tipos, quando o bloqueio for levantado, exigirão evidência
      obrigatória, e quais não exigirão nenhuma?
- [ ] O que conta como evidência aceitável por tipo (texto codificado? campo
      estruturado? arquivo?) — sem antecipar upload/anexo de arquivo, que
      segue bloqueado por outros gates (ADR 0011, `DS-OPS-01`).

**Alternativas consideradas:**

1. Nenhuma evidência em nenhum tipo, nesta fase — mantém o bloqueio íntegro do
   contrato T065 §6 até todos os pré-requisitos cumulativos fecharem.
2. Habilitar evidência **textual codificada** (não-arquivo) desde já para
   alguns tipos, mantendo upload de arquivo bloqueado.
3. Habilitar evidência com anexo de arquivo desde já.

**Recomendação técnica (não aprovada):** alternativa 1, estritamente. É o
único caminho coerente com o estado atual dos gates: MFA está desativado por
decisão de produto (não por acidente) e `DS-OPS-01` segue aberto (`infra/secrets/README.md`,
`ds-sec-01-evidencias.md`). A alternativa 3 está **bloqueada tecnicamente**
hoje (nenhum módulo do sistema implementa upload/storage de conteúdo — nem
mesmo T133, que trata só metadado). A alternativa 2 é tecnicamente possível,
mas **ainda exigiria** que RH + Jurídico + Segurança decidissem, por tipo, o
que conta como "evidência aceitável" mesmo sendo só texto — não é uma decisão
que este pacote pode tomar por conta própria.

- Responsável: **RH + Jurídico + Segurança**.
- Evidência: critérios por tipo registrados (mesmo que a decisão seja "nenhum,
  por ora").

---

## 3. Quadro por tipo de solicitação

Para cada tipo, a coluna **"Já especificado"** reproduz o contrato T065 ou uma
diretriz já recebida do RH (§3 do registro-fonte); a coluna **"Decisão
pendente"** aponta o `PD-SOL-…` correspondente — nunca um valor sugerido como
se fosse aprovado.

### 3.1 `contestacao_ajuste_ponto`

| Dimensão                       | Já especificado                                                                                                                                                 | Decisão pendente                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Finalidade                     | Colaborador contesta/solicita ajuste de um registro de ponto — **não corrige nada** por si só.                                                                  | —                                                                                   |
| Ator que inicia                | Colaborador (futuro), no próprio vínculo.                                                                                                                       | —                                                                                   |
| Responsável por análise        | RH, na própria empresa.                                                                                                                                         | Participação do gestor — `PD-SOL-01`.                                               |
| Responsável por decisão        | RH (encaminhar/recusar).                                                                                                                                        | Alçada exata (RH único vs. gestor vs. Diretoria) — `PD-SOL-01`.                     |
| Alçadas                        | —                                                                                                                                                               | Matriz RH/gestor/Diretoria — `PD-SOL-01`.                                           |
| Estados/transições pretendidos | `rascunho→enviada→em_revisao_rh→{aguardando_informacao, encaminhada_para_operacao_rh, recusada}`; cancelamento em `rascunho`/`enviada`/`aguardando_informacao`. | Janela de cancelamento pós-início de análise; reabertura de terminal — `PD-SOL-03`. |
| Prazo / ausência de prazo      | Nenhum prazo é regra aprovada; "2 dias úteis" é só sugestão do RH.                                                                                              | Existência, responsável e forma de contagem — `PD-SOL-04`.                          |
| Evidências necessárias         | Bloqueadas nesta fase — nenhuma aceita/anexada/armazenada.                                                                                                      | Critérios por tipo, quando habilitado — `PD-SOL-05`.                                |
| Visibilidade                   | Motivo de recusa deve ser visível ao colaborador (direção já recebida); depende do Portal do Colaborador existir.                                               | Canal/conteúdo mínimo de notificação — pendência não numerada (T065 §8).            |
| Auditoria                      | Toda transição gera evento técnico de auditoria (ADR 0004), sem dado pessoal em claro.                                                                          | —                                                                                   |
| Relação com "Verificar folhas" | Encaminhamento é **handoff** — não altera marcação nem saldo; a correção real (se houver) é o ajuste rastreável do RH, fora da Central.                         | Separação vs. referência cruzada entre as duas taxonomias — `PD-SOL-02`.            |
| Consequências operacionais     | "Encaminhar não é executar" — nenhuma mutação automática em ponto/saldo/Banco de Horas.                                                                         | —                                                                                   |

### 3.2 `ausencia`

| Dimensão                       | Já especificado                                                                                                       | Decisão pendente                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Finalidade                     | Colaborador registra uma solicitação relacionada a ausência.                                                          | Elegibilidade/tipos de ausência cobertos — `PD-SOL-01`.         |
| Ator que inicia                | Colaborador (futuro), no próprio vínculo.                                                                             | —                                                               |
| Responsável por análise        | RH, na própria empresa.                                                                                               | Participação do gestor (organização de equipe) — `PD-SOL-01`.   |
| Responsável por decisão        | RH (encaminhar/recusar).                                                                                              | Alçada — `PD-SOL-01`.                                           |
| Alçadas                        | —                                                                                                                     | Matriz RH/gestor/Diretoria — `PD-SOL-01`.                       |
| Estados/transições pretendidos | Mesma máquina de estados genérica do contrato T065 (§4).                                                              | Janela de cancelamento pós-início — `PD-SOL-03`.                |
| Prazo / ausência de prazo      | Nenhum prazo aprovado.                                                                                                | `PD-SOL-04`.                                                    |
| Evidências necessárias         | Bloqueadas nesta fase.                                                                                                | `PD-SOL-05` — inclui se "ausência" por saúde herda `PD-DOC-02`. |
| Visibilidade                   | Motivo de recusa visível (direção recebida).                                                                          | Canal de notificação (T065 §8).                                 |
| Auditoria                      | Evento técnico por transição (ADR 0004).                                                                              | —                                                               |
| Relação com "Verificar folhas" | **Nenhuma** — "Verificar folhas" é exclusivo do domínio Ponto (pendência técnica sobre marcação, não sobre ausência). | —                                                               |
| Consequências operacionais     | Nenhum efeito financeiro, de Folha ou de Banco de Horas é produzido pela Central.                                     | —                                                               |

### 3.3 `ferias`

| Dimensão                       | Já especificado                                                                                                                                               | Decisão pendente                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Finalidade                     | Colaborador registra uma solicitação relacionada a férias.                                                                                                    | —                                                             |
| Ator que inicia                | Colaborador (futuro), no próprio vínculo.                                                                                                                     | —                                                             |
| Responsável por análise        | RH, na própria empresa.                                                                                                                                       | Participação do gestor (organização de equipe) — `PD-SOL-01`. |
| Responsável por decisão        | RH (encaminhar/recusar).                                                                                                                                      | Alçada — `PD-SOL-01`.                                         |
| Alçadas                        | —                                                                                                                                                             | Matriz RH/gestor/Diretoria — `PD-SOL-01`.                     |
| Estados/transições pretendidos | Mesma máquina de estados genérica do contrato T065 (§4).                                                                                                      | Janela de cancelamento pós-início — `PD-SOL-03`.              |
| Prazo / ausência de prazo      | Nenhum prazo aprovado.                                                                                                                                        | `PD-SOL-04`.                                                  |
| Evidências necessárias         | Bloqueadas nesta fase.                                                                                                                                        | `PD-SOL-05`.                                                  |
| Visibilidade                   | Motivo de recusa visível (direção recebida).                                                                                                                  | Canal de notificação (T065 §8).                               |
| Auditoria                      | Evento técnico por transição (ADR 0004).                                                                                                                      | —                                                             |
| Relação com "Verificar folhas" | **Nenhuma** — domínios distintos.                                                                                                                             | —                                                             |
| Consequências operacionais     | **Sem** efeito financeiro, de Folha ou de Banco de Horas pela Central — cálculo de período aquisitivo/direito a férias não é feito aqui, em nenhuma hipótese. | —                                                             |

### 3.4 `atualizacao_cadastral`

| Dimensão                                                       | Já especificado                                                                                                                                                                       | Decisão pendente                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Finalidade                                                     | Colaborador solicita atualização de um dado cadastral próprio.                                                                                                                        | Quais campos cadastrais são elegíveis — `PD-SOL-01`. |
| Ator que inicia                                                | Colaborador (futuro), no próprio vínculo.                                                                                                                                             | —                                                    |
| Responsável por análise                                        | RH, na própria empresa.                                                                                                                                                               | —                                                    |
| Responsável por decisão                                        | RH (encaminhar/recusar) — a atualização em si é feita no fluxo próprio do RH (ex.:                                                                                                    |
| `PATCH /colaboradores/:id`), a Central só registra a intenção. | Alçada — `PD-SOL-01`.                                                                                                                                                                 |
| Alçadas                                                        | —                                                                                                                                                                                     | `PD-SOL-01`.                                         |
| Estados/transições pretendidos                                 | Mesma máquina de estados genérica do contrato T065 (§4).                                                                                                                              | Janela de cancelamento pós-início — `PD-SOL-03`.     |
| Prazo / ausência de prazo                                      | Nenhum prazo aprovado.                                                                                                                                                                | `PD-SOL-04`.                                         |
| Evidências necessárias                                         | Bloqueadas nesta fase.                                                                                                                                                                | `PD-SOL-05`.                                         |
| Visibilidade                                                   | Motivo de recusa visível (direção recebida).                                                                                                                                          | Canal de notificação (T065 §8).                      |
| Auditoria                                                      | Evento técnico por transição (ADR 0004).                                                                                                                                              | —                                                    |
| Relação com "Verificar folhas"                                 | **Nenhuma.**                                                                                                                                                                          | —                                                    |
| Consequências operacionais                                     | "Encaminhar não é executar" — a Central nunca altera o cadastro diretamente; a retificação real segue o fluxo já existente e autorizado (`RetificarColaboradorDto`), fora da Central. | —                                                    |

### 3.5 `documento` (conceitual, T065) — **não confundir com `solicitacoes-documento` (T133, real)**

| Dimensão                       | Já especificado                                                                                                                                                | Decisão pendente                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Finalidade                     | Colaborador solicita um documento — conceito **homônimo**, não idêntico, ao fluxo já real de T133.                                                             | **Se este tipo ainda tem função própria** dado o overlap com T133, ou se deve ser removido do catálogo — `PD-SOL-01`. |
| Ator que inicia                | Colaborador (futuro), no próprio vínculo.                                                                                                                      | —                                                                                                                     |
| Responsável por análise        | RH, na própria empresa.                                                                                                                                        | —                                                                                                                     |
| Responsável por decisão        | RH (encaminhar/recusar).                                                                                                                                       | Alçada — `PD-SOL-01`.                                                                                                 |
| Alçadas                        | —                                                                                                                                                              | `PD-SOL-01`.                                                                                                          |
| Estados/transições pretendidos | Mesma máquina de estados genérica do contrato T065 (§4) — **distinta** da máquina de estados de `SolicitacaoDocumento` (T133), que só tem o estado `pendente`. | Janela de cancelamento — `PD-SOL-03`.                                                                                 |
| Prazo / ausência de prazo      | Nenhum prazo aprovado.                                                                                                                                         | `PD-SOL-04`.                                                                                                          |
| Evidências necessárias         | Bloqueadas nesta fase — anexo/arquivo já bloqueado também em T133 (metadado sem conteúdo).                                                                     | `PD-SOL-05`.                                                                                                          |
| Visibilidade                   | Motivo de recusa visível (direção recebida).                                                                                                                   | Canal de notificação (T065 §8).                                                                                       |
| Auditoria                      | Evento técnico por transição (ADR 0004) — **separado** da auditoria já existente de `solicitacoes-documento` (T133).                                           | —                                                                                                                     |
| Relação com "Verificar folhas" | **Nenhuma.**                                                                                                                                                   | —                                                                                                                     |
| Consequências operacionais     | Nunca cria, altera ou substitui um `documento_metadado`; qualquer registro real de metadado segue exclusivamente o contrato já funcional de T133.              | —                                                                                                                     |

### 3.6 `atestado` (proposto pelo RH — catálogo ainda não aprovado)

| Dimensão                        | Já especificado                                                                                                                                                        | Decisão pendente                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Finalidade                      | Direcionamento recebido do RH; **ainda não incorporado** ao catálogo do contrato T065.                                                                                 | Inclusão no catálogo final — `PD-SOL-01`.                                                             |
| Ator que inicia                 | Colaborador (futuro), no próprio vínculo — **se** aprovado.                                                                                                            | —                                                                                                     |
| Responsável por análise/decisão | Presumivelmente RH, como os demais tipos — **não decidido** para este tipo específico.                                                                                 | `PD-SOL-01`.                                                                                          |
| Alçadas                         | —                                                                                                                                                                      | `PD-SOL-01`.                                                                                          |
| Estados/transições pretendidos  | Não especificados para este tipo (fora do catálogo T065 §2).                                                                                                           | Dependem da inclusão no catálogo — `PD-SOL-01`.                                                       |
| Prazo / ausência de prazo       | Não especificado.                                                                                                                                                      | `PD-SOL-01` + `PD-SOL-04`.                                                                            |
| Evidências necessárias          | Um atestado é, por natureza, um documento — bloqueado por T065 §6 como qualquer outro anexo.                                                                           | `PD-SOL-05` **+ `PD-DOC-02`** (dado de saúde: base legal, minimização e informação mínima ao gestor). |
| Visibilidade                    | Não especificada.                                                                                                                                                      | `PD-SOL-01`.                                                                                          |
| Auditoria                       | Se implementado, seguiria o mesmo padrão de evento técnico sem dado sensível (ADR 0004).                                                                               | —                                                                                                     |
| Relação com "Verificar folhas"  | **Nenhuma.**                                                                                                                                                           | —                                                                                                     |
| Consequências operacionais      | Não especificadas — **é o tipo com maior sensibilidade de dado pessoal** do catálogo proposto (dado de saúde), exigindo decisão adicional antes de qualquer modelagem. | `PD-SOL-01` + `PD-DOC-02`.                                                                            |

### 3.7 `benefícios` (proposto pelo RH — catálogo ainda não aprovado; **sem módulo operacional real hoje**)

| Dimensão                        | Já especificado                                                                                                                                                                                                                | Decisão pendente                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Finalidade                      | Direcionamento recebido do RH; **ainda não incorporado** ao catálogo do contrato T065.                                                                                                                                         | Inclusão no catálogo final — `PD-SOL-01`.                                                |
| Ator que inicia                 | Colaborador (futuro) — **se** aprovado.                                                                                                                                                                                        | —                                                                                        |
| Responsável por análise/decisão | Não decidido.                                                                                                                                                                                                                  | `PD-SOL-01`.                                                                             |
| Alçadas                         | —                                                                                                                                                                                                                              | `PD-SOL-01`.                                                                             |
| Estados/transições pretendidos  | Não especificados.                                                                                                                                                                                                             | `PD-SOL-01`.                                                                             |
| Prazo / ausência de prazo       | Não especificado.                                                                                                                                                                                                              | `PD-SOL-01` + `PD-SOL-04`.                                                               |
| Evidências necessárias          | Não especificadas.                                                                                                                                                                                                             | `PD-SOL-05`.                                                                             |
| Visibilidade                    | Não especificada.                                                                                                                                                                                                              | `PD-SOL-01`.                                                                             |
| Auditoria                       | Não especificada.                                                                                                                                                                                                              | —                                                                                        |
| Relação com "Verificar folhas"  | **Nenhuma.**                                                                                                                                                                                                                   | —                                                                                        |
| Consequências operacionais      | **Confirmado por inspeção do código (T136): não existe módulo de benefícios** (nenhum model Prisma, nenhum controller) no sistema hoje. Uma solicitação deste tipo ficaria **sem destino operacional real** para "encaminhar". | `PD-SOL-01` — decidir se este tipo entra no catálogo antes de existir onde encaminhá-lo. |

---

## 4. Perguntas objetivas para RH, Jurídico e Produto

Organizadas por área principal (algumas se repetem quando a decisão é
conjunta).

**Para RH:**

1. O catálogo final de tipos é o dos 5 do contrato T065, ou inclui `atestado`
   e/ou `benefícios`? (`PD-SOL-01`)
2. Qual o escopo exato do gestor — nenhuma participação, "ciente" consultivo,
   ou aprovação em alçada inicial para quais tipos? (`PD-SOL-01`)
3. A Diretoria participa em quais situações de escalonamento? (`PD-SOL-01`)
4. O marco "início da análise" pode ser ratificado como a entrada em
   `em_revisao_rh` (comportamento já existente no núcleo)? (`PD-SOL-03`)
5. Existe algum SLA nesta fase, ou a fila é medida só por relatório manual?
   Se existir, qual calendário e quais exceções? (`PD-SOL-04`)

**Para Jurídico:**

6. Confirma que nenhuma evidência/anexo deve ser habilitada enquanto MFA e
   `DS-OPS-01` não estiverem satisfeitos? (`PD-SOL-05`)
7. Se `atestado` for incluído no catálogo, qual a base legal e a informação
   mínima que pode ser repassada ao gestor sem expor o documento? (`PD-DOC-02`)
8. Reabertura de um estado terminal (`encaminhada_para_operacao_rh`,
   `recusada`, `cancelada`) deve ser permitida a algum papel, ou nunca?
   (`PD-SOL-03`)

**Para Produto:**

9. As taxonomias de "Solicitações" e "Verificar folhas" devem permanecer
   totalmente separadas, ou deve existir uma referência técnica cruzada?
   (`PD-SOL-02`)
10. O tipo "bloqueio de fechamento" (pendente nos dois contratos) deve ser
    definido uma única vez, valendo para ambas as taxonomias? (`PD-SOL-02`)
11. O tipo `documento` (conceitual) ainda tem função própria dado que
    `solicitacoes-documento` (T133) já é real e funcional — ou deve ser
    removido do catálogo da Central? (`PD-SOL-01`)
12. `benefícios` deve entrar no catálogo mesmo sem módulo operacional real
    para receber o encaminhamento? Se sim, qual seria o destino? (`PD-SOL-01`)

---

## 5. Matriz de aprovação

| ID          | Decisão                                                        | RH  | Jurídico | Produto | Segurança | Natureza |
| ----------- | -------------------------------------------------------------- | :-: | :------: | :-----: | :-------: | -------- |
| `PD-SOL-01` | Matriz RH/gestor/Diretoria, catálogo final, alçadas            |  ●  |    ●     |    ○    |           | Conjunta |
| `PD-SOL-02` | Conciliação de taxonomia com "Verificar folhas"                |  ●  |          |    ●    |           | Conjunta |
| `PD-SOL-03` | Marco de início da análise e cancelamento posterior            |  ●  |    ●     |         |           | Conjunta |
| `PD-SOL-04` | Responsável e forma de contagem do SLA                         |  ●  |          |    ●    |           | Conjunta |
| `PD-SOL-05` | Critérios de evidência por tipo                                |  ●  |    ●     |         |     ●     | Conjunta |
| `PD-DOC-02` | (referência) Tratamento de `atestado`, se incluído no catálogo |  ●  |    ●     |         |           | Conjunta |

Legenda: **●** decide/co-decide · **○** consultado.

---

## 6. Efeito de cada decisão sobre a fundação de backend futura (T137)

| Decisão     | O que ela desbloqueia/condiciona em T137                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PD-SOL-01` | Define o **catálogo final** (enum de banco), o **RBAC** necessário (se o gestor ganhar alguma capacidade, é um `RequirePermission` novo) e a **matriz de alçada** que o `AuthorizationGuard`/service precisam aplicar. Sem isso, não há enum nem regra de autorização para codificar. |
| `PD-SOL-02` | Decide se o schema de solicitação precisa de uma **FK opcional** para uma pendência de "Verificar folhas", ou se os dois módulos ficam sem qualquer referência cruzada no banco.                                                                                                      |
| `PD-SOL-03` | Confirma (ou não) que a guarda de transição `cancelar` do núcleo T066 já reflete a regra aprovada — se sim, **nenhuma mudança de lógica de transição** é necessária em T137, só a persistência.                                                                                       |
| `PD-SOL-04` | Decide se T137 precisa de um campo de **prazo/vencimento** no schema e de um job/consulta de SLA, ou se nenhum desses existe nesta fase (reduzindo o escopo de T137).                                                                                                                 |
| `PD-SOL-05` | Decide se T137 inclui **qualquer** campo de evidência (mesmo texto) no schema, ou se o schema fica idêntico à estrutura mínima do contrato T065 §3 (sem nenhum campo de evidência).                                                                                                   |

Enquanto todas as linhas acima permanecerem **Pendente** em §7, a T137 não tem
uma definição estável de catálogo, RBAC ou schema para implementar sem
inventar regra — por isso a T137 **não deve iniciar** antes do fechamento
formal deste pacote.

---

## 7. Registro de decisão

Campos **vazios**, a preencher no ato de aprovação. **Responsável** é a
**área/função**, nunca pessoa nomeada. Enquanto "Opção aprovada" estiver
vazio, o **Status** é **Pendente**.

| ID          | Data | Responsáveis (área/função) | Opção aprovada | Evidência (referência) | Status   |
| ----------- | ---- | -------------------------- | -------------- | ---------------------- | -------- |
| `PD-SOL-01` |      |                            |                |                        | Pendente |
| `PD-SOL-02` |      |                            |                |                        | Pendente |
| `PD-SOL-03` |      |                            |                |                        | Pendente |
| `PD-SOL-04` |      |                            |                |                        | Pendente |
| `PD-SOL-05` |      |                            |                |                        | Pendente |

### Declaração

**Nenhuma decisão deste pacote está aprovada.** Cada item só passa de
Pendente a decidido mediante **evidência formal** da área responsável,
registrada nesta tabela. Este documento **não implementa** nada, **não
decide** regra trabalhista, **não confunde** este domínio com
`solicitacoes-documento` (T133, já funcional) nem com `ajuste_ponto` (correção
direta do RH), **não declara conformidade legal** e **não libera** a T137
(fundação de backend), que depende do fechamento formal deste pacote.
