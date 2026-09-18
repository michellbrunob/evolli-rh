# Pacote de decisão — Segurança operacional (MFA, segredos, backup/recuperação e primeiro `master_tecnico`)

- Status: **parcialmente aprovado** — este é um **formulário de decisão** para os
  responsáveis de **Produto/TI** (inclui Segurança), **RH** e **Jurídico**.
  **`DS-MFA-01` foi aprovada em 2026-09-18** (rollout de MFA — ver §8); **todos
  os demais itens permanecem Pendentes.** O documento **estrutura** as escolhas em
  campos objetivos e num registro por evidência (§7). Ele **não decide, não
  infere e não escolhe** fornecedor, ferramenta, valor (RPO/RTO), prazo, base
  legal ou responsável nominal. Onde um valor específico é necessário, ele
  aparece como **campo a preencher**, nunca como valor sugerido.
- Data de emissão: 2026-08-24 · Última atualização: 2026-09-18 (T128)
- Fase/tarefa: Fase 0 — Fundação e gates transversais; **T004** e
  provisionamento controlado do primeiro `master_tecnico` (**CG-PROV**).
- Relação com o registro de pendências: este pacote é a **forma de aprovação**
  das pendências já catalogadas em
  [decisões de segurança operacional (T004)](etapa0-seguranca-operacional-pendente.md)
  (identificadores `DS-…`) e
  [convergência de governança de perfis](convergencia-governanca-perfis-pendente.md)
  (identificadores `CG-PROV-…`). **Os identificadores são reusados**, não
  recriados: aprovar um item aqui é aprovar a pendência de mesmo ID.
- Âncoras de governança (não reabertas por este pacote):
  [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md) (papéis de banco,
  menor privilégio, credencial fora do Git),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (identidade,
  sessão; **decisão 3**: MFA adiado, **TOTP/RFC 6238** já fixado como tecnologia,
  obrigatório antes de dado real),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (trilha append-only),
  [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (`master_tecnico` como único acesso global permanente; RH + Jurídico como
  função responsável por privacidade; `dpo`/`auditor` depreciados e não
  provisionados; gates antes de dado real).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  MFA obrigatório antes de dado real); Princípio V (auditoria append-only,
  segregação de funções, reautenticação proporcional ao risco); "Mandatory
  Architecture and Data Constraints".

## 0. Como usar este formulário

1. Cada seção (§1–§4) apresenta as **decisões a tomar**, as **opções elegíveis**
   (quando existem, extraídas dos documentos-fonte — nunca inventadas) e a
   **evidência** que torna a aprovação rastreável.
2. A **matriz de aprovação** (§5) diz **quem decide** cada item — TI, RH,
   Jurídico ou decisão **conjunta**.
3. Os **critérios de saída** (§6) dizem **o que precisa estar aprovado e
   comprovado** antes de qualquer dado real e **o que cada decisão desbloqueia**.
4. O **registro de decisão** (§7) tem campos **vazios** para data, responsáveis,
   opção aprovada e referência de evidência. Preenchê-lo é o ato de aprovação;
   até então, o status permanece **Pendente**.

**Limites deste pacote (invioláveis):**

- **Não implementa** MFA, cofre, backup, runbook ou provisionamento; **não cria**
  usuário, credencial, schema, migration, CI ou configuração.
- **Não infere** RPO, RTO, fornecedor, prazo, período de rotação, base legal nem
  responsável não informado.
- **Não declara conformidade legal** (LGPD ou outra) e **não menciona um papel
  `dpo` existente** — a função responsável por privacidade é **RH + Jurídico**
  (ADR 0012). A eventual designação formal de encarregado é decisão futura do
  Jurídico, fora deste pacote.
- **Não relaxa** a negação por padrão nem a obrigação de auditoria.

---

## 1. MFA (autenticação multifator)

**Âncora:** ADR 0003 decisão 3 — TOTP (RFC 6238) já é a tecnologia decidida;
MFA imposto no servidor é **pré-condição de dado real** (gate duro, não é objeto
de decisão). Esta seção decide o que falta para tornar o MFA **operável** e o
gate **verificável**. Referências: `DS-MFA-01..05`.

### 1.1 Quem deve usar (perfis e escopo) — `DS-MFA-01`

- Decisão: para **quais papéis** o MFA é obrigatório e **a partir de quando**.
  Nenhum papel é presumido isento.
- Opções elegíveis (marcar uma; combinações possíveis):
  - [x] Todo usuário ativo, desde o primeiro login (linha da ADR 0003 original).
        **Aprovada em 2026-09-18 (T128) — ver §8.**
  - [ ] Subconjunto por papel/risco: ________________________________________
        (papéis a listar — a preencher, não sugerido aqui).
- Responsável: **Produto + TI/Segurança** (conjunta); **RH consultado** sobre
  quais funções de negócio são alcançadas.
- Evidência: decisão registrada **+ teste de autorização** provando que ação
  sensível sem MFA é **negada** no servidor.
- **Aprovado:** MFA **TOTP obrigatório para todos os usuários** antes do acesso a
  dado real. A **ativação real** permanece **bloqueada** até os gates de segredos
  (§2) e o gate-mestre `DS-OPS-01` (§6) serem satisfeitos — ver §8.

### 1.2 Método a escolher — `DS-MFA-01` (tecnologia herdada)

- Baseline **já fixado** (ADR 0003 decisão 3): **TOTP (RFC 6238)**. Este campo
  **ratifica** o baseline e registra se haverá evolução — **sem** escolher app,
  fornecedor ou biblioteca.
  - [ ] Ratificar **TOTP** como método do MFA.
  - [ ] Evolução futura para **WebAuthn/passkeys** (já citada como evolução não
        decidida na ADR 0003): ( ) sim, em fase própria ( ) não avaliar agora.
- Responsável: **TI/Segurança** (com Produto).
- Evidência: ratificação registrada; qualquer evolução vira decisão própria.

### 1.3 Recuperação de acesso — `DS-MFA-02`

- Decisão: mecanismo quando o fator é perdido. **Requisito inegociável:** a
  recuperação **não pode ser bypass do MFA**, é **auditada** e segue **menor
  privilégio** e **segregação de funções**.
- Opções elegíveis (marcar uma; combinações possíveis):
  - [ ] Códigos de recuperação de **uso único**.
  - [ ] **Reset por papel autorizado** com reautenticação + segregação de funções.
  - [ ] Processo **fora de banda** (aprovação humana registrada).
- Responsável: **TI/Segurança** (conjunta com Produto para a política de uso).
- Evidência: fluxo aprovado **+ evidência de auditoria** do fluxo.

### 1.4 Tempo de elevação para ações sensíveis (step-up) — `DS-MFA-03`

- Decisão: **quais ações** exigem reautenticação/step-up (Constituição V) e o
  **TTL** da elevação. Candidatas já sensíveis (a confirmar, não impor):
  alteração de papel, criação/desativação de conta, operação sobre dado
  restrito/documento.
  - Ações que exigem step-up: ____________________________________________
  - TTL da elevação: __________ **(valor a decidir — não sugerido)**.
- Responsável: **Produto + TI/Segurança** (conjunta).
- Evidência: lista aprovada **+ testes** de que a ação sem step-up é negada.

### 1.5 Evidência de aprovação (MFA habilitado) — `DS-MFA-04`, `DS-MFA-05`

O gate de MFA só fecha quando **todos** verificados (nenhum substitui aprovação
humana):

- [ ] MFA **imposto no servidor** para os papéis exigidos; não contornável pelo
      cliente; provado por teste de autorização.
- [ ] Fluxo de **recuperação** aprovado, auditado e **sem bypass**.
- [ ] **Segredo do fator (TOTP)** protegido em repouso e **ausente** de log,
      trilha, teste e repositório — verificado por inspeção automatizada
      (`DS-MFA-04`).
- [ ] **Revogação** de fator e de sessões associadas funciona e é auditada.
- [ ] Eventos de **auditoria de MFA** especificados, **sem segredo em claro**
      (ADR 0004) — `DS-MFA-05`.
- [ ] **Revisão humana de segurança** do fluxo registrada.

---

## 2. Segredos e credenciais

**Âncora:** ADR 0002 (menor privilégio; credencial fora do Git); Constituição
"Mandatory…". Proibições vigentes **reafirmadas, não relaxadas**: nenhum segredo
em código/Git/log/teste/fixture; `.env` fora do versionamento; `.env.example` só
com nomes de variáveis. Referências: `DS-SEC-01..04`.

### 2.1 Cofre ou mecanismo a escolher — `DS-SEC-01`

- Decisão: onde e como os segredos vivem. **Fornecedor não é escolhido aqui.**
  - [ ] **Cofre de segredos** dedicado.
  - [ ] **Configuração de ambiente protegida** que satisfaça os requisitos abaixo.
- Requisitos que a opção escolhida **deve** satisfazer (checklist de aceite):
  - [ ] Cifrado **em repouso**.
  - [ ] Acesso por **identidade com menor privilégio** e negação por padrão.
  - [ ] **Auditoria** de leitura/escrita/rotação de cada segredo.
  - [ ] Suporte a **rotação** e **revogação**.
  - [ ] **Segregação por ambiente** (segredo de produção inacessível fora dela).
  - [ ] **Nunca** expõe valor bruto em log, UI, erro ou trilha.
  - [ ] Integração via configuração protegida, **sem valor no repositório**.
- Responsável: **TI/Segurança**.
- Evidência: requisitos verificados + decisão registrada.

### 2.2 Separação por ambiente — `DS-SEC-04`

- Decisão: segredos **distintos por ambiente** (desenvolvimento, CI, homologação,
  produção); **nunca** reuso de segredo de produção fora de produção; menor
  privilégio por credencial (precedente: `evolli_app` só DML, `evolli_migrator`
  só DDL — ADR 0002).
- Responsável: **TI/Segurança**.
- Evidência: **inventário por ambiente** (o quê, para quê, quem acessa, fora do
  repositório) + revisão de privilégio.

### 2.3 Rotação — `DS-SEC-02`

- Decisão: política e **periodicidade** de rotação por tipo de segredo, com
  rotação sem indisponibilidade não planejada.
  - Periodicidade por tipo: ______________________________________________
    **(valor a decidir — não sugerido)**.
- Responsável: **TI/Segurança**.
- Evidência: política aprovada + evidência de rotação executada.

### 2.4 Acesso emergencial controlado (break-glass) — `DS-SEC-03`

- Decisão: processo com **aprovação, escopo e tempo limitados** e **auditoria
  obrigatória** de cada uso; revogação imediata em incidente e em desligamento.
  - Aprovador do break-glass (por função): ______________________________
  - Escopo e janela máxima: ______________________________________________
- Responsável: **TI/Segurança**.
- Evidência: processo aprovado + trilha de cada uso.

---

## 3. Backup e recuperação

**Âncora:** Constituição "Mandatory…" (backups segregados, protegidos,
restaurados em teste, com objetivos de recuperação documentados). Referências:
`DS-BKP-01..06`. **Nenhum dado real** entra em backup antes dos gates de dado
real (§6).

### 3.1 Escopo — `DS-BKP-01`

- Decisão: confirmar o escopo de dados protegidos. Candidato (a confirmar):
  - [ ] **Banco PostgreSQL** (transacional, inclui `audit_event` append-only e o
        schema de aplicação).
  - [ ] **Configuração/segredos** do mecanismo de §2 (por processo próprio do
        cofre, **não** junto do dump de dados).
  - [ ] **Conteúdo documental** — **fora de escopo agora** (é Nível 2 e não
        existe; quando existir, backup/descarte é escopo próprio e deve alcançar
        o conteúdo no armazenamento privado — RI-2E-05).
- Responsável: **TI/Segurança + RH + Jurídico** (conjunta — RH/Jurídico pelo
  alcance a dado pessoal).
- Evidência: escopo aprovado.

### 3.2 Criptografia — `DS-BKP-02`

- Decisão: backups **cifrados em repouso** — ou **controle compensatório
  formalmente aprovado**; acesso **segregado** e de menor privilégio.
  - [ ] Cifrado em repouso.
  - [ ] Controle compensatório aprovado: __________________________________
- Responsável: **TI/Segurança**.
- Evidência: configuração verificada + aprovação.

### 3.3 Responsáveis — `DS-BKP-06` (operação e teste)

- Decisão: **quem** opera o backup, **quem** executa e valida o teste de
  restauração, **quem** guarda a evidência — por **área/função**, nunca por nome.
  - Operação do backup: __________________________________________________
  - Execução/validação do teste de restauração: _________________________
  - Guarda da evidência: _________________________________________________
- Responsável: **TI/Segurança**.
- Evidência: papéis atribuídos por função.

### 3.4 Prazo máximo de perda de dados (RPO) e de retorno do sistema (RTO) — `DS-BKP-03`, `DS-BKP-04`

- Decisão: **valores a decidir — não sugeridos** neste pacote.
  - **RPO** (perda máxima aceitável de dados): __________________________
  - **RTO** (tempo máximo de recuperação): _____________________________
- Responsável: **Produto + TI/Segurança** (conjunta — Produto pelo impacto de
  negócio).
- Evidência: valores aprovados e registrados.

### 3.5 Retenção e descarte — `DS-BKP-05`

- Decisão: **período** e **método de descarte** dos backups, alinhados à
  retenção de dado pessoal. **Nenhum período existe hoje no repositório e nenhum
  é inventado aqui.**
  - Período de retenção: _________________________________________________
  - Método de descarte: _________________________________________________
- Responsável: **RH + Jurídico** (com TI para execução).
- Evidência: política aprovada (sem declaração de conformidade neste pacote).

### 3.6 Teste de restauração — `DS-BKP-06`

- Decisão/critério: **restauração testada periodicamente**, com **evidência**
  preservada e integridade comprovada; a restauração **nunca** expõe dado real
  em ambiente não autorizado.
  - [ ] Procedimento de teste definido e periodicidade acordada: __________
  - [ ] Registro de evidência do teste definido.
- Responsável: **TI/Segurança**.
- Evidência: registro de teste de restauração.

---

## 4. Primeiro `master_tecnico`

**Âncora:** ADR 0012 (§Gates item 3) e **CG-PROV-01/02**. O `master_tecnico` é o
**único** perfil de acesso global permanente; seu provisionamento **não** ocorre
por rota comum e **herda** as condições da Emenda 1 da ADR 0005. Esta seção
**não provisiona** ninguém — decide o **runbook** e registra as atestações.

### 4.1 Pré-requisitos obrigatórios (não negociáveis)

Não são objeto de escolha — são condições de gate a **confirmar como
satisfeitas** antes de qualquer provisionamento:

- [ ] **MFA** habilitado e imposto (§1) — gate duro (ADR 0003 decisão 3).
- [ ] **Decisões de segurança operacional (T004)** aprovadas: segredos (§2) e
      backup/recuperação (§3), incluindo o gate-mestre `DS-OPS-01`.

### 4.2 Runbook do provisionamento — `CG-PROV-01`

- Decisão: aprovar o **runbook nominativo** do primeiro `master_tecnico`.
  Conteúdo obrigatório (confirmar cada item):
  - [ ] **Conta nominativa** (identifica uma pessoa; nunca genérica/compartilhada).
  - [ ] Conta **sujeita a MFA**.
  - [ ] Pelo menos **duas contas administrativas nominativas**, separadas de uso
        rotineiro (herda a Emenda 1 da ADR 0005).
  - [ ] **Trilha de auditoria** de cada ação do Master (ADR 0004), sem segredo em
        claro.
  - [ ] **Regra de não uso para rotina de RH**: o Master não aprova fluxos de
        RH/Jurídico nem executa operação trabalhista rotineira (ADR 0012 dec. 3).
  - [ ] **Nenhum bypass** e **nenhuma criação por rota normal** — provisionamento
        só pelo mecanismo controlado de bootstrap.
- Responsável: **TI/Segurança** (com Produto); depende de MFA e T004.
- Evidência: runbook aprovado e versionado (documento próprio, futuro).

### 4.3 Mecanismo de bootstrap — `CG-PROV-02`

- Decisão: avaliar se o `bootstrap` passa a provisionar o **primeiro
  `master_tecnico`** (em vez de `admin_tecnico`), preservando `admin_tecnico`
  apenas para bootstrap/histórico (ADR 0012 dec. 4).
  - [ ] Manter bootstrap atual até o runbook. [ ] Migrar bootstrap para Master.
- Responsável: **TI/Segurança + Desenvolvimento**; depende de `CG-PROV-01` e T004.
- Evidência: decisão registrada; qualquer mudança de RBAC tem ADR/aceite próprios.

---

## 5. Matriz de aprovação

Classifica **quem decide** cada item. "Conjunta" = exige acordo das áreas
listadas. **Segurança** é parte de **TI**. **Não há papel `dpo`**: privacidade,
retenção e descarte são **RH + Jurídico** (ADR 0012).

| ID         | Decisão                                            | TI/Segurança | RH  | Jurídico | Produto | Natureza |
| ---------- | -------------------------------------------------- | :----------: | :-: | :------: | :-----: | -------- |
| DS-MFA-01  | Perfis/escopo e momento do MFA                     |      ●       |  ○  |          |    ●    | Conjunta |
| DS-MFA-02  | Recuperação de acesso (sem bypass)                 |      ●       |     |          |    ○    | TI       |
| DS-MFA-03  | Ações com step-up e TTL                            |      ●       |     |          |    ●    | Conjunta |
| DS-MFA-04  | Proteção do segredo TOTP em repouso                |      ●       |     |          |         | TI       |
| DS-MFA-05  | Eventos de auditoria de MFA                        |      ●       |     |    ○     |         | TI       |
| DS-SEC-01  | Cofre ou config. de ambiente protegida             |      ●       |     |          |         | TI       |
| DS-SEC-02  | Política e periodicidade de rotação                |      ●       |     |          |         | TI       |
| DS-SEC-03  | Acesso emergencial (break-glass)                   |      ●       |     |          |         | TI       |
| DS-SEC-04  | Separação por ambiente / menor privilégio          |      ●       |     |          |         | TI       |
| DS-BKP-01  | Escopo de dados protegidos                         |      ●       |  ●  |    ●     |         | Conjunta |
| DS-BKP-02  | Criptografia / controle compensatório              |      ●       |     |          |         | TI       |
| DS-BKP-03  | RPO (valor a decidir)                              |      ●       |     |          |    ●    | Conjunta |
| DS-BKP-04  | RTO (valor a decidir)                              |      ●       |     |          |    ●    | Conjunta |
| DS-BKP-05  | Retenção e descarte de backups                     |      ○       |  ●  |    ●     |         | RH+Jur.  |
| DS-BKP-06  | Restauração testada + responsáveis                 |      ●       |     |          |         | TI       |
| DS-OPS-01  | Gate-mestre: nenhum dado real antes de todos gates |      ●       |  ●  |    ●     |    ●    | Conjunta |
| CG-PROV-01 | Runbook nominativo do primeiro `master_tecnico`    |      ●       |     |          |    ○    | TI       |
| CG-PROV-02 | Bootstrap provisiona o primeiro Master             |      ●       |     |          |    ○    | TI       |

Legenda: **●** decide / co-decide · **○** consultado. A ausência de marca não
isenta de cumprir o item — indica apenas que a **decisão** não é daquela área.

**Este pacote não declara conformidade legal.** Nomear o responsável (RH +
Jurídico) **não** cumpre a obrigação de base legal/retenção/RIPD — apenas a
atribui (ADR 0012, "Governança não é declaração de conformidade").

---

## 6. Critérios de saída

### 6.1 O que precisa estar aprovado e comprovado antes de dados reais

Enquanto o gate-mestre **`DS-OPS-01`** estiver aberto, **nenhum dado real** entra
em nenhum ambiente ou backup. Para liberar dado real/piloto/produção, **todos**:

- [ ] **MFA** (§1) habilitado, imposto e auditado — `DS-MFA-01..05`.
- [ ] **Segredos** (§2) em cofre/config protegida com rotação, break-glass e
      segregação por ambiente — `DS-SEC-01..04`.
- [ ] **Backup** (§3) cifrado, segregado, com **RPO/RTO decididos** e
      **restauração testada com evidência**; retenção/descarte definidos por
      RH + Jurídico — `DS-BKP-01..06`.
- [ ] **Runbook** do primeiro `master_tecnico` aprovado — `CG-PROV-01`.
- [ ] **Retenção, base legal e RIPD/DPIA por módulo** (RH + Jurídico) —
      pendências herdadas (Pessoas, Ponto, Documentos, `audit_event`), fora do
      escopo deste pacote, mas **bloqueantes** de dado real.

### 6.2 O que cada decisão desbloqueia (tarefas técnicas)

Aprovar **não** implementa; **abre** a fase Implementar do controle específico,
sempre com ADR/aceite próprios:

| Decisão aprovada            | Desbloqueia (fase Implementar)                                              |
| --------------------------- | --------------------------------------------------------------------------- |
| `DS-MFA-01..05`             | Implementar MFA (emenda à ADR 0003) e seus testes de autorização            |
| `DS-SEC-01..04`             | Configurar cofre/segredos, rotação e break-glass (T004, parte de segredos)  |
| `DS-BKP-01..06`             | Implementar backup, política de restauração e teste (T004, parte de backup) |
| `DS-OPS-01`                 | Levanta o gate-mestre — habilita avaliar piloto com dado real               |
| `CG-PROV-01` / `CG-PROV-02` | Executar o runbook e provisionar o primeiro `master_tecnico`                |

Nenhuma dessas tarefas abre antes da respectiva decisão registrada em §7.

---

## 7. Registro de decisão

Campos **vazios**, a preencher no ato de aprovação. **Responsável** é a
**área/função**, nunca pessoa nominada neste documento. Enquanto o campo "Opção
aprovada" estiver vazio, o **Status** é **Pendente**.

| ID         | Data       | Responsáveis (área/função)             | Opção aprovada                                               | Evidência (referência) | Status       |
| ---------- | ---------- | -------------------------------------- | ------------------------------------------------------------ | ---------------------- | ------------ |
| DS-MFA-01  | 2026-09-18 | Produto + TI/Segurança (RH consultado) | TOTP obrigatório para todo usuário ativo, antes de dado real | §8 (T128)              | **Aprovada** |
| DS-MFA-02  |            |                                        |                                                              |                        | Pendente     |
| DS-MFA-03  |            |                                        |                                                              |                        | Pendente     |
| DS-MFA-04  |            |                                        |                                                              |                        | Pendente     |
| DS-MFA-05  |            |                                        |                                                              |                        | Pendente     |
| DS-SEC-01  |            |                                        |                                                              |                        | Pendente     |
| DS-SEC-02  |            |                                        |                                                              |                        | Pendente     |
| DS-SEC-03  |            |                                        |                                                              |                        | Pendente     |
| DS-SEC-04  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-01  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-02  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-03  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-04  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-05  |            |                                        |                                                              |                        | Pendente     |
| DS-BKP-06  |            |                                        |                                                              |                        | Pendente     |
| DS-OPS-01  |            |                                        |                                                              |                        | Pendente     |
| CG-PROV-01 |            |                                        |                                                              |                        | Pendente     |
| CG-PROV-02 |            |                                        |                                                              |                        | Pendente     |

### Declaração

**Somente `DS-MFA-01` está aprovada** (2026-09-18, T128 — ver §8); **todos os
demais itens permanecem Pendentes.** Cada item pendente só passa de Pendente a
decidido mediante **evidência formal** da área responsável, momento em que uma
ADR (ou emenda à ADR 0003, para MFA) a registra e a fase Implementar do controle
correspondente pode abrir. Aprovar `DS-MFA-01` **não habilita** dado real,
produção, exposição externa nem ativa MFA no código; **não** conclui `DS-SEC-01`,
cofre, backup, runbook ou provisionamento; **não declara conformidade legal**; e
**não relaxa** a negação por padrão nem a obrigação de auditoria da Constituição.

---

## 8. Registro de aprovação — rollout de MFA e encaminhamento operacional (T128)

- Data: 2026-09-18 · Decisão: **de produto**, tomada por **Produto + TI/Segurança**
  (RH consultado). Reusa os identificadores já catalogados — **nenhum ID novo é
  criado**.
- Este registro **aprova o rollout** e **encaminha** a execução para TI/Segurança.
  Ele **não** provisiona cofre, **não** cria segredo, **não** altera ambiente
  remoto, **não** ativa MFA obrigatório no código e **não** conclui `DS-SEC-01`.

### 8.1 Decisão aprovada

- MFA **TOTP** será **obrigatório para todos os usuários** antes do acesso a dados
  reais (`DS-MFA-01`).
- A solução deve usar **cofre corporativo**, com **chave independente por
  ambiente**, **acesso restrito e auditável** (diretriz que condiciona
  `DS-SEC-01` e `DS-SEC-04`).
- **Break-glass** exige **duas contas administrativas nominativas com MFA** e
  **dupla autorização** (diretriz que condiciona `DS-SEC-03`).
- Enquanto não houver suporte técnico a **múltiplas versões de chave e
  recifragem**, a **rotação ocorrerá somente em incidente controlado** (diretriz
  interina que condiciona `DS-SEC-02`; ver
  [infra/secrets/README.md, §4](../../infra/secrets/README.md)).
- **Piloto ou produção só poderão exigir MFA** após TI/Segurança **validar**
  cofre, provisionamento, segregação por ambiente e runbook de break-glass
  (reafirma o gate-mestre `DS-OPS-01`).

### 8.2 Estado por responsabilidade

| Item                                         | Referência              | Estado                                  |
| -------------------------------------------- | ----------------------- | --------------------------------------- |
| Decisão de produto (MFA universal, TOTP)     | `DS-MFA-01`             | **Aprovada**                            |
| Escolha do provedor de cofre                 | `DS-SEC-01`             | **Pendente** (TI/Segurança)             |
| Provisionamento segregado por ambiente       | `DS-SEC-01`/`DS-SEC-04` | **Pendente**                            |
| Política de rotação (interina: só incidente) | `DS-SEC-02`             | Diretriz aprovada; execução pendente    |
| Forma do break-glass (2 contas + dupla auth) | `DS-SEC-03`             | Diretriz aprovada; validação pendente   |
| Validação do runbook de break-glass          | `DS-SEC-03`             | **Pendente**                            |
| Ativação real de MFA (piloto/produção)       | `DS-OPS-01`             | **Bloqueada** até evidências concluídas |

As diretrizes acima **condicionam** as decisões `DS-SEC-01/02/03/04`, que
permanecem **Pendentes** quanto à execução e à validação por TI/Segurança.
`DS-SEC-01` **não** é declarado concluído por este registro.

### 8.3 Checklist de encaminhamento para TI/Segurança

Marcável como **pendente**, **validado** ou **bloqueado**. Os critérios
detalhados de cada item já estão na especificação operacional
[infra/secrets/README.md](../../infra/secrets/README.md) — este checklist
**não os reescreve**, apenas encaminha.

- [ ] **Seleção do cofre** corporativo conforme os critérios já aprovados
      ([infra/secrets/README.md, §2.1](../../infra/secrets/README.md); requisitos
      de `DS-SEC-01` em [§2.4](etapa0-seguranca-operacional-pendente.md)).
- [ ] **Responsáveis por função** definidos: operação do segredo, auditoria de
      acesso/rotação e aprovação emergencial (break-glass) — por **área/função**,
      nunca por nome.
- [ ] **Provisionamento segregado por ambiente** (chave independente por
      ambiente; sem reuso cruzado — `DS-SEC-04`;
      [infra/secrets/README.md, §3](../../infra/secrets/README.md)).
- [ ] **Teste de falha fechada** demonstrado em ambiente descartável, **sem
      expor valor** ([infra/secrets/README.md, §3.5](../../infra/secrets/README.md)).
- [ ] **Validação do break-glass**: duas contas administrativas nominativas com
      MFA, dupla autorização, evidência e revisão posterior
      ([infra/secrets/README.md, §5](../../infra/secrets/README.md)).
- [ ] **Evidências mínimas para encerrar `DS-SEC-01`** reunidas
      ([infra/secrets/README.md, §6](../../infra/secrets/README.md)) e a decisão
      `DS-SEC-01` registrada como aprovada em §7.

### 8.4 Condição de liberação

A **ativação real do MFA** (exigi-lo para piloto/produção com dado real) só é
liberada quando **todos** os itens de §8.3 estiverem **validados**, `DS-SEC-01`
registrada como aprovada em §7 e o gate-mestre `DS-OPS-01` satisfeito. Até lá, a
decisão de produto está **aprovada**, mas a **execução permanece bloqueada** —
nenhuma mudança de código torna o MFA obrigatório neste momento.
