# Etapa 0 — Segurança operacional (MFA, segredos e backup/recuperação): decisões pendentes (T004)

- Status: **parcialmente aprovado** — este é um **pacote de decisão** para TI,
  Segurança, DPO e Produto. **`DS-MFA-01` foi aprovada em 18/09/2026** (rollout
  de MFA — registrada no
  [pacote de decisão, §7–§8](pacote-decisao-seguranca-operacional.md)); **todas
  as demais decisões abaixo permanecem pendentes ou bloqueadas.** O documento
  **registra** o que precisa ser decidido, por qual área, com qual evidência,
  e o que cada pendência bloqueia. Não decide, não infere, não escolhe
  fornecedor e não declara conformidade.
- Data: 2026-08-18 · Última atualização: 18/09/2026 (T130 — sincronização do
  espelho de `DS-MFA-01`; T132 — revisão de lançamento sem MFA obrigatório, §1.1)
- **Formulário de aprovação (T033):** as pendências deste registro
  (identificadores `DS-…`) foram convertidas em um **pacote de decisão** objetivo
  para Produto/TI, RH e Jurídico —
  [pacote de decisão de segurança operacional](pacote-decisao-seguranca-operacional.md).
  Os identificadores são **reusados**; aprovar um item lá é aprovar a pendência
  de mesmo ID aqui. Nenhuma decisão foi tomada por essa conversão.
- Fase/tarefa: Fase 0 — Fundação e gates transversais; **T004** (`.specify/tasks.md`).
- Relacionado:
  [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md) (papéis de banco,
  menor privilégio, credencial fora do Git),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (identidade,
  sessão; **decisão 3**: MFA adiado para a próxima fatia de segurança — que é
  esta),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (trilha append-only),
  [aprovações pendentes da Etapa 2](etapa2-documentos-admissao-aprovacoes-pendentes.md)
  (retenção/descarte que alcança conteúdo — RI-2E-05, dependência de backup
  futuro).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  MFA obrigatório antes de dado real); Princípio V (auditoria append-only,
  segregação de funções, reautenticação proporcional ao risco); "Mandatory
  Architecture and Data Constraints" (segredos em configuração de ambiente ou
  cofre aprovado; nada de credencial/dado real no repositório; backups
  segregados, protegidos e restaurados em teste, com objetivos de recuperação
  documentados; nenhuma exposição externa/produção antes dos gates).
- PRD: `Sistema RH - Reserva Fiscal - PRD` (Notion `dceacf66-ba47-834d-b3fc-014cc2835594`).

## 0. Propósito, limites e por que não há ADR

### O que este documento é

O pré-requisito da T004 é **decisão humana** de TI/Segurança sobre MFA, cofre
de segredos e objetivos de recuperação, e de DPO/Jurídico sobre retenção e
descarte (`.specify/tasks.md`, T004, pré-condições). Este documento estrutura
essas decisões em requisitos verificáveis e num registro único (§4), para que
a aprovação seja um ato **rastreável e por evidência**, não difuso.

### O que este documento NÃO faz

- **Não implementa** nada: sem MFA, provedor de identidade, cofre, backup,
  credencial, infraestrutura, variável real, pipeline, migration ou código.
- **Não escolhe** fornecedor, ferramenta, prazo, período de rotação, RPO, RTO,
  responsável nominal, aprovação ou nível de conformidade. Onde um valor
  específico é necessário, ele aparece como **decisão a tomar**, nunca como
  valor proposto.
- **Não altera** `apps/api`, `apps/web`, migrations, dependências, CI,
  `.env.example` ou qualquer configuração de execução.
- **Não toca** upload documental (Nível 2, bloqueado), Ponto, Folha, Reserva
  Fiscal ou Relatórios.
- **Não contém** dado pessoal, token, chave, URL privada ou exemplo de
  credencial.

### Por que nenhuma ADR é criada aqui

Uma ADR registra uma **decisão de arquitetura tomada**. Aqui, nada foi
decidido — as escolhas pertencem a TI/Segurança/DPO/Produto e ainda não
existem. Criar uma ADR agora fixaria como aceito o que não foi aprovado.
Quando as decisões de MFA (perfis, recuperação, step-up), de cofre e de
RPO/RTO forem **formalmente aprovadas com evidência**, cada uma promove uma
ADR (ou emenda à ADR 0003, no caso do MFA) — e só então a fase Implementar da
T004 abre. Até lá, este registro de pendências é o artefato correto, no mesmo
padrão dos demais `*-pendente.md` do repositório.

### Princípios preservados (não relaxados por este documento)

- **Negação por padrão** (Constituição II; ADR 0002/0003): nenhuma capacidade,
  acesso a segredo ou recuperação nasce concedida.
- **Auditoria obrigatória** (Constituição V; ADR 0004): toda operação sensível
  de segurança (desafio/uso de MFA, acesso/rotação de segredo, restauração de
  backup) é auditável, e nenhum segredo/valor sensível entra em claro na
  trilha.

## 1. MFA (autenticação multifator)

**Contexto herdado (não reaberto):** a [ADR 0003, decisão 3](../adr/0003-identidade-sessao-e-autorizacao.md)
adiou o MFA para "a próxima fatia de segurança" como **risco aceito
conscientemente**, fixou **TOTP (RFC 6238)** como a tecnologia decidida (com
WebAuthn/passkeys como evolução futura, não decidida) e definiu a **condição
de saída do risco**: MFA implementado e **obrigatório antes de qualquer piloto
com dado real de RH ou produção**. Esta seção não reabre a tecnologia; ela
estrutura o que falta decidir para tornar o MFA operável e o gate verificável.

### 1.1 Gatilho obrigatório

- MFA ativo é **pré-condição de dado real**: nenhum piloto com dado real de RH,
  nenhuma exposição externa e nenhuma produção ocorre sem MFA imposto no
  servidor (Constituição II e "Mandatory…"; ADR 0003 decisão 3). Este gatilho
  **não é negociável** e não é objeto de decisão — é a fronteira que as
  decisões abaixo precisam viabilizar.

> **Revisão de produto (T132):** o **lançamento inicial** ocorrerá **sem MFA
> obrigatório** (`MFA_ENABLED=false`), como **aceitação de risco** por
> indisponibilidade temporária de orçamento para o cofre. O alvo (MFA universal)
> permanece; a exigência é **adiada** até `DS-SEC-01` encerrado, chave
> provisionada via cofre e decisão de rollout. Registro canônico:
> [pacote de decisão, §8.5](pacote-decisao-seguranca-operacional.md). Isto é
> aceitação de risco — **não** comprovação de segurança nem conformidade.

### 1.2 Decisões pendentes (TI/Segurança/Produto)

| Tema                             | Decisão a tomar (não decidida aqui)                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Perfis e escopo**              | Para quais papéis o MFA é obrigatório e a partir de quando (ex.: todo usuário ativo desde o primeiro login, como a decisão original da ADR 0003 previa, ou subconjunto por papel/risco). Nenhum papel é presumido isento.                                                                                                                         |
| **Recuperação de acesso**        | Mecanismo quando o fator é perdido (ex.: códigos de recuperação de uso único, reset por papel autorizado com reautenticação e segregação de funções, processo fora de banda). Requisito inegociável: a recuperação **não pode ser bypass do MFA**, é auditada e segue menor privilégio.                                                           |
| **Sessões e step-up**            | Relação MFA ↔ sessão: o desafio no login estabelece a sessão; a Constituição V exige **reautenticação/step-up proporcional ao risco** para ações de alto impacto. Definir **quais ações** exigem step-up (candidatas já sensíveis: alteração de papel, criação/desativação de conta, operações sobre dado restrito/documento) e o TTL do step-up. |
| **Revogação**                    | Revogar o fator; revogar sessões ativas ao trocar/revogar fator; revogar em incidente ou desligamento. Alinhar com a revogação de sessão já existente (ADR 0003 decisão 5).                                                                                                                                                                       |
| **Proteção do segredo do fator** | Como o segredo TOTP é protegido **em repouso** (cifrado/derivado; a ADR 0003 já lista "como o segredo de MFA é protegido" como questão em aberto) e a garantia de que **nunca** aparece em log, trilha, teste, fixture ou repositório.                                                                                                            |
| **Trilha de auditoria de MFA**   | Eventos a registrar (fator habilitado, desafio emitido, sucesso/falha, recuperação usada, fator revogado), sempre **sem segredo em claro** (ADR 0004). Metadados fechados, no padrão da trilha formal.                                                                                                                                            |

### 1.3 Critérios objetivos para considerar "MFA habilitado"

Todos verificáveis; nenhum substitui aprovação humana. O gate só fecha quando:

- [ ] MFA é **imposto no servidor** para todos os papéis exigidos (§1.2), não
      contornável pelo cliente, e provado por **teste de autorização** de que
      ação sensível sem MFA é **negada**.
- [ ] Existe **fluxo de recuperação** aprovado, **auditado** e **sem bypass**
      do fator.
- [ ] O **segredo do fator** é protegido em repouso e **ausente** de log,
      trilha, teste e repositório — verificado por inspeção automatizada.
- [ ] **Revogação** de fator e de sessões associadas funciona e é auditada.
- [ ] **Revisão humana de segurança** do fluxo de MFA registrada.

_(Nenhum prazo é fixado aqui — cronograma é decisão de Produto/TI.)_

## 2. Segredos e credenciais

### 2.1 Proibições (já vigentes; reafirmadas, não relaxadas)

- **Nenhum segredo, credencial, token ou chave** em código, Git, log, teste,
  fixture, exemplo de documentação ou qualquer arquivo versionado
  (Constituição II e "Mandatory…"; ADR 0002). `.env` permanece fora do
  versionamento; `.env.example` contém **apenas nomes de variáveis**, nunca
  valores reais.
- **Nenhum dado, credencial ou backup real** é reusado do sistema legado
  (Constituição; `docs/CLAUDE_HANDOFF.md`).
- Logs técnicos **redigem** credencial, token de sessão e segredo (Constituição
  II; padrão já vigente do logger).

### 2.2 Separação por ambiente e menor privilégio

- Segredos **distintos por ambiente** (desenvolvimento, CI, homologação,
  produção); **nunca** reuso de segredo de produção fora de produção.
- **Menor privilégio** por credencial — precedente já aplicado no banco:
  `evolli_app` só DML, `evolli_migrator` só DDL de schema (ADR 0002).
  Credenciais de integração externa recebem o **mínimo** necessário
  (Constituição "Mandatory…", integrações com menor privilégio).

### 2.3 Decisões pendentes (TI/Segurança)

| Tema                                 | Decisão a tomar (não decidida aqui)                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mecanismo de armazenamento**       | Cofre de segredos **ou** configuração de ambiente protegida que satisfaça os requisitos de §2.4. **Fornecedor não é escolhido aqui.**             |
| **Rotação**                          | Política e **periodicidade** de rotação por tipo de segredo (período é decisão — não inventado), com rotação sem indisponibilidade não planejada. |
| **Revogação**                        | Revogação imediata em incidente e em desligamento de acesso.                                                                                      |
| **Acesso emergencial (break-glass)** | Processo com aprovação, escopo e tempo limitados, e **auditoria obrigatória** de cada uso.                                                        |
| **Inventário**                       | Inventário de segredos por ambiente (o quê, para quê, quem acessa), mantido fora do repositório.                                                  |

### 2.4 Requisitos que o cofre/mecanismo escolhido deve satisfazer (sem escolher fornecedor)

- [ ] Armazenamento **cifrado em repouso**.
- [ ] Acesso por **identidade com menor privilégio** e negação por padrão.
- [ ] **Auditoria** de leitura/escrita/rotação de cada segredo.
- [ ] Suporte a **rotação** e **revogação**.
- [ ] **Segregação por ambiente** (segredo de produção inacessível fora de
      produção).
- [ ] **Nunca** expõe o valor bruto em log, UI, mensagem de erro ou trilha.
- [ ] Integração via **configuração de ambiente protegida**, sem valor no
      repositório (coerente com ADR 0002).
- [ ] Disponibilidade compatível com o **RTO** a ser definido (§3).

## 3. Backup e recuperação

### 3.1 Escopo de dados a proteger (a confirmar)

Escopo **candidato**, a ser confirmado por TI/Segurança/DPO:

- **Banco PostgreSQL** — fonte transacional, incluindo `audit_event`
  (append-only; ADR 0004) e o schema de aplicação.
- **Configuração/segredos** do mecanismo de §2 (por processo próprio do cofre,
  não junto do dump de dados).
- **Conteúdo documental** — **fora de escopo agora**: o conteúdo é Nível 2 e
  **não existe** (Etapa 2 é metadados sem conteúdo). Quando existir, seu backup
  e descarte são escopo próprio e precisam **alcançar o conteúdo no
  armazenamento privado**, não só o metadado (RI-2E-05, em
  [aprovações pendentes da Etapa 2](etapa2-documentos-admissao-aprovacoes-pendentes.md)).
- **Nenhum dado real** entra em qualquer backup antes dos gates de dado real
  (MFA, LGPD, retenção) estarem satisfeitos.

### 3.2 Requisitos de proteção e restauração

- [ ] Backups **cifrados em repouso** — ou controle compensatório **formalmente
      aprovado** (Constituição "Mandatory…").
- [ ] **Segregados**: isolados do ambiente de origem, com acesso separado e de
      menor privilégio.
- [ ] **Restauração testada** periodicamente, com **evidência** preservada de
      cada teste (integridade comprovada).
- [ ] A restauração **nunca expõe dado real em ambiente não autorizado**
      (Constituição §8, cenário de aceite 3).
- [ ] **Retenção e descarte** conforme política de DPO/Jurídico — período **não
      inventado** aqui (ver §3.3).

### 3.3 Decisões pendentes (TI/Segurança + DPO/Jurídico + Produto)

| Tema                                      | Decisão a tomar (não decidida aqui)                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RPO** (perda máxima aceitável de dados) | **Valor não inventado.** Decisão de Produto (impacto de negócio) + TI/Segurança.                                                                                                  |
| **RTO** (tempo máximo de recuperação)     | **Valor não inventado.** Decisão de Produto + TI/Segurança.                                                                                                                       |
| **Retenção/descarte**                     | Período e método de descarte dos backups — DPO/Jurídico, alinhado à retenção de dado pessoal (nenhum período existe no repositório hoje; pendência herdada da Etapa 2, DP-2E-15). |
| **Escopo final**                          | Confirmação do escopo de §3.1.                                                                                                                                                    |
| **Responsabilidades**                     | Quem opera o backup, quem executa e valida o teste de restauração, quem guarda a evidência — por **área/função**, não por nome.                                                   |

### 3.4 Critérios de aceite (backup/recuperação)

O gate só fecha quando: backup **cifrado e segregado**; **restauração testada
com evidência** dentro do **RTO decidido**; **retenção** conforme política de
DPO; e prova de que a restauração **não expôs dado real** em ambiente não
autorizado.

## 4. Registro consolidado de decisões

Identificadores `DS-…` (Decisão de Segurança operacional). **Responsável** é a
**área/função**, nunca pessoa nomeada. **Status:** somente **`DS-MFA-01` está
Aprovada** (18/09/2026 — ver [pacote de decisão, §7–§8](pacote-decisao-seguranca-operacional.md));
**todas as demais permanecem Pendentes**. **Bloqueia** indica o que não pode
ocorrer enquanto a decisão estiver aberta.

| ID        | Decisão necessária                                                                                                         | Responsável (área)        | Evidência esperada                               | Impacto                                               | Bloqueia                              | Status                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------ | ----------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| DS-MFA-01 | Perfis/papéis e momento em que o MFA é obrigatório (alvo: universal; lançamento inicial opcional/desativado — pacote §8.5) | Segurança + Produto       | Decisão registrada + teste de autorização        | Fronteira de quem precisa de MFA                      | Dado real / piloto / produção         | **Aprovada (18/09/2026; revisada T132)** |
| DS-MFA-02 | Mecanismo de recuperação de acesso sem bypass do fator                                                                     | Segurança + TI            | Fluxo aprovado + evidência de auditoria do fluxo | Bloqueio permanente de usuário vs. brecha             | Dado real / piloto / produção         | Pendente                                 |
| DS-MFA-03 | Ações que exigem step-up e TTL do step-up                                                                                  | Segurança + Produto       | Lista aprovada + testes                          | Reautenticação proporcional ao risco (Constituição V) | Ações de alto impacto sobre dado real | Pendente                                 |
| DS-MFA-04 | Proteção do segredo TOTP em repouso e ausência em log/trilha/repo                                                          | Segurança + TI            | Inspeção automatizada + revisão                  | Exposição de segredo de fator                         | Dado real / piloto / produção         | Pendente                                 |
| DS-MFA-05 | Eventos de auditoria de MFA (sem segredo em claro)                                                                         | Segurança + DPO           | Especificação + verificação na trilha            | Rastreabilidade de acesso                             | Dado real / piloto / produção         | Pendente                                 |
| DS-SEC-01 | Cofre de segredos **ou** configuração de ambiente protegida (requisitos §2.4)                                              | TI + Segurança            | Requisitos §2.4 atendidos e verificados          | Onde e como segredos vivem                            | Dado real / produção                  | Pendente                                 |
| DS-SEC-02 | Política e periodicidade de rotação por tipo de segredo                                                                    | TI + Segurança            | Política aprovada + evidência de rotação         | Janela de uso de segredo comprometido                 | Produção                              | Pendente                                 |
| DS-SEC-03 | Processo de acesso emergencial (break-glass) auditado                                                                      | Segurança + TI            | Processo aprovado + trilha de uso                | Uso indevido de acesso privilegiado                   | Produção                              | Pendente                                 |
| DS-SEC-04 | Separação de segredos por ambiente e menor privilégio por credencial                                                       | TI + Segurança            | Inventário por ambiente + revisão de privilégio  | Vazamento cruzado entre ambientes                     | Dado real / produção                  | Pendente                                 |
| DS-BKP-01 | Escopo final de dados protegidos por backup                                                                                | TI + Segurança + DPO      | Escopo aprovado                                  | O que é (e não é) protegido                           | Piloto / produção                     | Pendente                                 |
| DS-BKP-02 | Criptografia (ou controle compensatório aprovado) e segregação de acesso                                                   | TI + Segurança            | Configuração verificada + aprovação              | Confidencialidade do backup                           | Dado real / produção                  | Pendente                                 |
| DS-BKP-03 | **RPO** (valor a decidir)                                                                                                  | Produto + TI/Segurança    | Valor aprovado                                   | Perda máxima aceitável de dados                       | Produção                              | Pendente                                 |
| DS-BKP-04 | **RTO** (valor a decidir)                                                                                                  | Produto + TI/Segurança    | Valor aprovado                                   | Tempo máximo de indisponibilidade                     | Produção                              | Pendente                                 |
| DS-BKP-05 | Retenção e descarte de backups                                                                                             | DPO/Jurídico + TI         | Política aprovada                                | Conformidade LGPD do backup                           | Dado real / produção                  | Pendente                                 |
| DS-BKP-06 | Restauração testada com evidência periódica                                                                                | TI + Segurança            | Registro de teste de restauração                 | Confiabilidade da recuperação                         | Produção                              | Pendente                                 |
| DS-OPS-01 | Confirmação de que nenhum dado real entra em qualquer ambiente/backup antes de todos os gates                              | Segurança + DPO + Produto | Declaração formal + verificação                  | Gate-mestre de dado real                              | Todo dado real                        | Pendente                                 |

## 5. Declaração

**Somente `DS-MFA-01` está aprovada** (18/09/2026, registrada no
[pacote de decisão, §7–§8](pacote-decisao-seguranca-operacional.md)); **todas as
demais decisões deste documento permanecem pendentes ou bloqueadas.** Cada item
pendente só passa de Pendente a decidido mediante **evidência formal** da área
responsável, momento em que uma ADR (ou emenda à ADR 0003, para MFA) a registra e
a fase Implementar da T004 pode abrir **para aquele controle específico**.

Aprovar `DS-MFA-01` (decisão de produto sobre o escopo do rollout) **não habilita**
dado real, produção, exposição externa, upload de conteúdo, ativação de MFA no
código, cofre, backup ou qualquer credencial; em particular, **`DS-SEC-01`,
`DS-SEC-02`, `DS-SEC-03`, `DS-SEC-04` e `DS-OPS-01` seguem pendentes/bloqueados**.
Este documento **não relaxa** a negação por padrão nem a obrigação de auditoria da
Constituição. Enquanto `DS-OPS-01` estiver aberto, **nenhum dado real** entra em
nenhum ambiente.
