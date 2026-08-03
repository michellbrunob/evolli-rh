# Etapa 0 — Fatia 3: Identidade, sessões seguras e autorização

Status: **especificação aprovada — decisões fechadas, implementação ainda não iniciada**

Depende de: [Fatia 1 — fundação da API](etapa0-fundacao-api.md),
[Fatia 2 — PostgreSQL/migrations](etapa0-fatia2-postgres-migrations.md),
[ADR 0001](../adr/0001-fundacao-api.md), [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md).

Decisão arquitetural registrada em
[docs/adr/0003-identidade-sessao-e-autorizacao.md](../adr/0003-identidade-sessao-e-autorizacao.md).

## 1. Objetivo e escopo

### Objetivo

Dar à `apps/api` identidade real: autenticação de usuário, sessão segura em
cookie, MFA obrigatório para todo usuário e autorização RBAC/ABAC por
empresa/unidade/equipe/recurso/ação/classificação do dado, com negação por
padrão — sem ainda expor nenhum dado ou processo de RH/DP.

### Escopo — entra

- Cadastro técnico de usuário de acesso ao sistema (login), **desacoplado**
  de "colaborador" (que só existe a partir da Etapa 1 — core organizacional).
  Nesta fatia, o usuário de acesso é uma entidade própria e mínima (e-mail,
  hash de senha, papel, empresa/unidade/equipe de escopo), sem dado de RH.
- Login por e-mail/senha (autenticação própria — decisão fechada, ver ADR
  0003), política de senha, fluxo de recuperação de acesso. Camada de
  autenticação desenhada por interface, para permitir OIDC/SSO no futuro
  sem reescrever sessão nem autorização (ver §4, §11) — nenhum IdP externo
  é integrado nesta fatia.
- MFA (TOTP) **obrigatório para todo usuário ativo desde o primeiro acesso**
  — não só perfis privilegiados (decisão fechada). WebAuthn/passkeys fica
  como evolução futura, fora de escopo desta fatia.
- Sessão de servidor com cookie `httpOnly`/`Secure`/`SameSite`, expiração,
  renovação (rotação de sessão), logout e revogação (individual e em massa).
- Proteção CSRF para toda rota que muda estado.
- Modelo de autorização RBAC/ABAC: papel + escopo (empresa/unidade/equipe) +
  recurso + ação + classificação do dado, negação por padrão.
- Estratégias de prevenção: IDOR/BOLA, elevação de privilégio, fixação de
  sessão, força bruta, enumeração de usuário, vazamento em erro/log.
- Guards/decorators de autorização reutilizáveis por qualquer módulo futuro.
- Rate limiting nas rotas de autenticação.

### Escopo — não entra

- Qualquer tabela/tela/processo de RH/DP (colaborador, cargo, folha, ponto
  etc.) — a entidade "usuário de acesso" desta fatia **não é** "colaborador".
- Auditoria imutável completa (armazenamento, consulta, retenção) — esta
  fatia só define os **eventos mínimos** que a próxima fatia de auditoria
  deve capturar (§10). Login/logout podem gerar log estruturado técnico
  (já existente via `nestjs-pino`), mas trilha de auditoria formal (WORM,
  consulta, retenção) é fatia própria.
- Integração real com SSO/IdP externo (Keycloak, Auth0, Azure AD/Entra ID) —
  decisão fechada: **não** integrar nesta fatia (ADR 0003). A camada de
  autenticação só é desenhada para não exigir reescrever sessão/autorização
  quando isso for decidido no futuro.
- Cadastro de empresas/unidades/equipes em si (isso é Etapa 1 — core
  organizacional); esta fatia assume que esses identificadores existem como
  referência mínima (IDs) para escopo de permissão, sem CRUD próprio.
- Redefinição de senha por e-mail transacional real (SMTP/provedor) — o
  fluxo é especificado, mas o envio efetivo de e-mail é integração externa
  fora de escopo de código desta fatia (ver §8, §11).
- Qualquer dado real ou fictício de colaborador em teste/exemplo.

## 2. Dados pessoais tratados, classificação e medidas LGPD

### Dados tratados nesta fatia

| Dado                                                           | Classificação                                          | Finalidade                               | Base legal (proposta, sujeita a validação DPO/jurídico)                         |
| -------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------- |
| E-mail de login                                                | Pessoal                                                | Identificação/autenticação               | Execução de contrato de trabalho/prestação de serviço (uso interno corporativo) |
| Hash de senha (nunca a senha em claro)                         | Pessoal sensível operacional (segredo de autenticação) | Autenticação                             | Idem                                                                            |
| Segredo MFA (TOTP secret)                                      | Pessoal sensível operacional                           | Segundo fator de autenticação            | Idem                                                                            |
| Metadado de sessão (IP, user-agent, timestamp de login/logout) | Pessoal                                                | Segurança, detecção de anomalia, suporte | Legítimo interesse de segurança da informação                                   |
| Papel/escopo de acesso (empresa/unidade/equipe/perfil)         | Pessoal (associado ao usuário)                         | Autorização                              | Execução de contrato                                                            |

**Nenhum** dado de RH/DP (CPF completo, salário, saúde, dado de dependente,
etc.) é tratado nesta fatia — a entidade "usuário de acesso" é técnica.

### Medidas LGPD desta fatia

- Minimização: só e-mail, hash, papel/escopo e metadado técnico de sessão —
  nenhum campo de RH.
- Senha nunca armazenada em claro (hash com `argon2id`, parâmetros mínimos
  fechados no §4); segredo MFA cifrado em repouso com **AES-256-GCM**, chave
  de cifragem fora do banco, com rotação de chave documentada — decisão
  fechada (ADR 0003). Segredo MFA nunca aparece em log, em nenhuma hipótese.
- Nenhum dado sensível (senha, hash, segredo MFA, token de sessão) em log —
  reaproveita o padrão já existente de `redact` do `nestjs-pino` (ADR 0001),
  estendido para os novos campos (§6).
- Direito do titular: usuário pode encerrar as próprias sessões (logout/
  revogação); exclusão/anonimização de conta de acesso é tratada como parte
  do desligamento de colaborador, fora do escopo desta fatia (fica registrado
  como decisão pendente, §11).
- Esta fatia trata dado de **identidade técnica de acesso**, não dado de RH —
  ainda assim, por ser dado pessoal, segue exigindo validação formal do
  DPO/jurídico antes de produção (finalidade, retenção de log de sessão,
  aviso de privacidade), conforme já registrado no plano mestre.

## 3. Atores e matriz inicial de permissões

Atores (conforme `PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`, §7):
**administrador técnico, RH, DP, gestor, financeiro, colaborador, auditor,
DPO**.

### MFA e classificação de privilégio

**Decisão fechada:** MFA é obrigatório para **todo** usuário ativo desde o
primeiro acesso, sem exceção por papel (ver §4) — não é mais um recorte por
"perfil privilegiado". A classificação de privilégio abaixo continua
relevante para **escopo de gestão de conta** e **acesso à trilha de
acesso/log** (§3, matriz de permissões), não mais para exigência de MFA.

| Papel                 | Justificativa do nível de privilégio                     |
| --------------------- | -------------------------------------------------------- |
| Administrador técnico | Acesso irrestrito a configuração/infra da aplicação      |
| RH                    | Acesso amplo a dado de colaborador em etapas futuras     |
| DP                    | Acesso a dado de folha/DP em etapas futuras              |
| Financeiro            | Acesso a dado de pagamento em etapas futuras             |
| Auditor               | Acesso de leitura ampla a trilha de auditoria e dados    |
| DPO                   | Acesso a dado pessoal para fins de compliance            |
| Gestor                | Acesso a dado de subordinado a partir da Etapa 1+        |
| Colaborador           | Acesso restrito ao próprio dado (autoatendimento futuro) |

### Matriz inicial de permissões (por recurso desta fatia)

Nesta fatia os únicos "recursos" existentes são a própria conta de acesso e a
sessão. A matriz abaixo é a base do modelo — será estendida por recurso a
cada fatia futura (colaborador, documento, ponto, folha etc.), nunca
reduzida.

| Recurso                                                | Ação          | Admin técnico                 | RH                                                                        | DP                           | Gestor | Financeiro | Colaborador | Auditor                      | DPO                                   |
| ------------------------------------------------------ | ------------- | ----------------------------- | ------------------------------------------------------------------------- | ---------------------------- | ------ | ---------- | ----------- | ---------------------------- | ------------------------------------- |
| Própria conta (perfil, senha, MFA, sessões)            | ler/gerenciar | ✅                            | ✅                                                                        | ✅                           | ✅     | ✅         | ✅          | ✅                           | ✅                                    |
| Conta de outro usuário (criar, desativar, resetar MFA) | gerenciar     | ✅ (escopo: toda a instância) | ✅ (escopo: própria empresa)                                              | ✅ (escopo: própria empresa) | ❌     | ❌         | ❌          | ❌ (só leitura, ver abaixo)  | ❌                                    |
| Log/trilha de acesso (login, sessão)                   | ler           | ✅                            | ❌                                                                        | ❌                           | ❌     | ❌         | ❌          | ✅ (leitura, todas empresas) | ✅ (leitura, para fins de compliance) |
| Papel/escopo de outro usuário                          | alterar       | ✅                            | ✅ (dentro da própria empresa, não pode se auto-promover a admin técnico) | ❌                           | ❌     | ❌         | ❌          | ❌                           | ❌                                    |

Regras adicionais de negação por padrão:

- Ninguém altera o **próprio** papel/escopo (previne elevação de privilégio
  por auto-edição) — só um papel com permissão de gestão de conta de
  terceiros pode alterar o papel de outro usuário, e nunca o próprio.
- RH/DP só gerenciam conta dentro da própria empresa (escopo `empresa_id`);
  Admin técnico é o único escopo "instância inteira".
- Toda ação fora da matriz acima é **negada** até ser explicitamente
  adicionada em fatia futura — não existe permissão implícita.

## 4. Autenticação, sessão, MFA e proteção CSRF

### Autenticação

- Login por e-mail + senha. Endpoint dedicado (contrato em §8), rate limited
  (ver §6).
- **Hash de senha (decisão fechada):** `argon2id`, parâmetros mínimos —
  memória **19 MiB**, **2** iterações, paralelismo **1**. Recalibração desses
  parâmetros só é permitida documentada por ambiente (ex.: hardware de
  produção com mais capacidade), nunca reduzida abaixo do mínimo fixado
  aqui.
- **Política de senha (decisão fechada):** mínimo **15 caracteres**, máximo
  suportado de pelo menos **64**, Unicode e espaço permitidos (favorece
  passphrase), **sem** exigência de composição arbitrária (maiúscula/
  símbolo etc. — desencorajado pelo NIST 800-63B em favor de comprimento) e
  **sem** expiração periódica forçada. Checagem obrigatória contra lista de
  senhas comuns/vazadas (ex.: dataset local, nunca enviando a senha em claro
  a serviço externo).
- **Recuperação de acesso:** fluxo de "esqueci minha senha" por link de uso
  único, expiração curta (ex.: 15–30 min, valor final na implementação),
  token opaco de alta entropia (não JWT previsível), invalidado após uso ou
  ao gerar um novo pedido. Envio do e-mail é integração externa fora de
  escopo de código desta fatia (§1) — o contrato/fluxo é especificado, a
  implementação do envio real é decisão pendente (§11).
- Nenhuma mensagem de erro do fluxo de login/recuperação revela se o e-mail
  existe ou não (§6 — enumeração).

### MFA

- **Decisão fechada:** TOTP (RFC 6238) implementado nesta fatia, compatível
  com apps padrão (Google Authenticator, Authy etc.) — sem dependência de
  SMS (custo, spoofing de SIM, não recomendado para o perfil de risco deste
  produto). WebAuthn/passkeys registrado como evolução futura (ADR 0003),
  não implementado agora.
- **Obrigatório para todo usuário ativo desde o primeiro acesso** (decisão
  fechada — substitui o recorte por "perfil privilegiado" da versão anterior
  desta spec) — login não concede sessão completa sem MFA configurado e
  verificado.
- Segredo TOTP armazenado cifrado com **AES-256-GCM**, chave fora do banco,
  rotação de chave documentada, nunca logado (§2, §7).
- Códigos de recuperação (backup codes) de uso único, gerados na ativação,
  armazenados com hash (não em claro).
- Reset de MFA de um usuário só por Admin técnico (ou RH/DP dentro do próprio
  escopo), sempre gerando evento de auditoria (§10) — nunca autoatendimento
  sem verificação adicional, para não virar vetor de bypass.

### Sessão

- Sessão de **servidor** (não JWT stateless) — permite revogação real
  (exigida no enunciado), essencial para "logout em todos os dispositivos" e
  para resposta a incidente (revogar sessão comprometida imediatamente).
- Cookie: `httpOnly`, `Secure` (HTTPS obrigatório fora de local), `SameSite=Lax`
  como padrão (ou `Strict` para rotas mais sensíveis, a avaliar na
  implementação).
- **Token de sessão (decisão fechada):** o cookie recebe um **token opaco
  aleatório de alta entropia**, gerado no servidor. O banco armazena
  **somente `token_hash`** (hash do token, único) — o token bruto nunca é
  persistido em nenhuma tabela. O `id` interno da sessão (chave primária,
  usado só para referência/join interno) **não é aceito como credencial**
  em nenhuma rota — só o token do cookie, validado contra `token_hash`,
  autentica uma sessão (ver §7).
- **Armazenamento da sessão (decisão fechada):** PostgreSQL nesta fatia
  (schema `app`, mesmo isolamento de privilégio da ADR 0002). Redis só entra
  em evolução futura, condicionada a métrica real de escala/latência (ver
  ADR 0003 para os critérios de gatilho dessa migração) — não é decisão
  desta fatia.
- **Expiração:** tempo de vida absoluto (ex.: 8–12h, valor final na
  implementação) + tempo de vida por inatividade (ex.: 30 min), o que
  ocorrer primeiro.
- **Rotação (decisão fechada):** o token de sessão é rotacionado (novo token
  emitido, token anterior invalidado) após login e após conclusão do MFA —
  nenhum token emitido antes da autenticação completa continua válido depois
  dela. Mitiga fixação de sessão (§6).
- **Logout:** invalida a sessão no servidor (não só remove cookie no
  cliente).
- **Revogação (obrigatória, decisão fechada):** usuário lista e encerra as
  próprias sessões ativas; Admin técnico (ou RH/DP no próprio escopo) revoga
  sessão de terceiro (ex.: desligamento, incidente). Revogação é sempre
  possível e imediata (marca a sessão inválida no servidor) — gera evento de
  auditoria (§10).

### CSRF

- **Decisão fechada:** padrão **synchronizer token**, vinculado à sessão do
  usuário e validado no servidor, exigido em toda rota que altera estado
  (não-GET), além do cookie de sessão. `SameSite=Lax/Strict` no cookie é
  **defesa adicional, não substituta** do token synchronizer.

## 5. Modelo RBAC/ABAC

- **RBAC** define o conjunto de ações permitidas por papel (`administrador
técnico`, `rh`, `dp`, `gestor`, `financeiro`, `colaborador`, `auditor`,
  `dpo`) sobre um recurso.
- **ABAC** refina por atributo contextual: `empresa_id`, `unidade_id`,
  `equipe_id` do usuário vs. do recurso acessado, e `classificação do dado`
  do recurso (ex.: público interno, pessoal, pessoal sensível, financeiro).
- Avaliação: **negar por padrão**; uma ação só é permitida se existir regra
  explícita casando papel + escopo (empresa/unidade/equipe) + recurso + ação
  - classificação compatível com o nível que aquele papel pode tocar.
- Implementado como guard/decorator reutilizável na API (ex.:
  `@RequirePermission(resource, action)` + interceptor que resolve escopo do
  usuário autenticado vs. escopo do recurso da requisição) — para que módulos
  futuros (Etapa 1+) só declarem a permissão exigida, sem reimplementar a
  checagem.
- Escopo "instância inteira" existe só para Admin técnico; todo outro papel
  tem escopo obrigatoriamente restrito a pelo menos `empresa_id`.

## 6. Prevenção de vulnerabilidades específicas

| Risco                  | Estratégia                                                                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDOR/BOLA              | Todo endpoint que recebe identificador de recurso (`:id`) valida, no servidor, que o recurso pertence ao escopo (empresa/unidade/equipe) do usuário autenticado — nunca confia em ID vindo do cliente sem checagem de posse/escopo. Testado explicitamente (§9). |
| Elevação de privilégio | Ninguém altera o próprio papel/escopo (§3); alteração de papel de terceiro é auditada; guard de autorização roda no servidor, nunca decisão só no cliente.                                                                                                       |
| Fixação de sessão      | Identificador de sessão rotacionado após autenticação completa (login + MFA quando aplicável); nenhum identificador de sessão é aceito se criado antes do login.                                                                                                 |
| Força bruta            | Rate limiting por IP e por conta nas rotas de login/recuperação/MFA; backoff progressivo; bloqueio temporário de conta após N tentativas malsucedidas, com mensagem genérica.                                                                                    |
| Enumeração de usuário  | Resposta idêntica (tempo e conteúdo) para "e-mail não existe" e "senha errada"; fluxo de recuperação de senha nunca confirma existência do e-mail.                                                                                                               |
| Vazamento em erro/log  | Reaproveita `AllExceptionsFilter` (ADR 0001): mensagem pública fixa por status HTTP, nunca stack trace/SQL/detalhe interno. `redact` do `nestjs-pino` estendido para nunca logar senha, hash, segredo MFA, token de sessão/CSRF, código de recuperação.          |

## 7. Modelo de dados necessário (futuro — sem migration nesta fatia)

Rascunho conceitual, para revisão — **nenhuma migration criada nesta fatia**:

```text
app.access_user
  id                  uuid PK
  email               citext UNIQUE NOT NULL
  password_hash       text NOT NULL
  role                text NOT NULL           -- enum: admin_tecnico | rh | dp | gestor | financeiro | colaborador | auditor | dpo
  company_id          uuid NULL               -- NULL só para admin_tecnico (escopo instância)
  unit_id             uuid NULL
  team_id             uuid NULL
  mfa_enabled         boolean NOT NULL DEFAULT false
  mfa_secret_encrypted bytea NULL
  status              text NOT NULL           -- enum: active | disabled | locked
  created_at          timestamptz NOT NULL DEFAULT now()
  updated_at          timestamptz NOT NULL DEFAULT now()

app.access_mfa_recovery_code
  id                  uuid PK
  user_id             uuid FK -> access_user
  code_hash           text NOT NULL
  used_at             timestamptz NULL
  created_at          timestamptz NOT NULL DEFAULT now()

app.access_session
  id                  uuid PK               -- identificador interno; NUNCA aceito como credencial
  token_hash          text UNIQUE NOT NULL  -- hash do token opaco enviado no cookie; token bruto nunca é persistido
  user_id             uuid FK -> access_user
  created_at          timestamptz NOT NULL DEFAULT now()
  last_seen_at        timestamptz NOT NULL DEFAULT now()
  expires_at          timestamptz NOT NULL
  ip                  inet NULL
  user_agent          text NULL
  revoked_at          timestamptz NULL
  revoked_reason      text NULL

app.access_password_reset_token
  id                  uuid PK
  user_id             uuid FK -> access_user
  token_hash          text NOT NULL
  expires_at          timestamptz NOT NULL
  used_at             timestamptz NULL
  created_at          timestamptz NOT NULL DEFAULT now()

app.access_login_attempt          -- suporte a rate limiting/lockout (§6)
  id                  uuid PK
  email_attempted     text NOT NULL
  ip                  inet NULL
  succeeded           boolean NOT NULL
  created_at          timestamptz NOT NULL DEFAULT now()
```

Notas para a implementação futura:

- **Decisão fechada:** `access_user` permanece desacoplado de "colaborador".
  `company_id`/`unit_id`/`team_id` são referências técnicas (`uuid`), **sem
  FK enforced**, até a Etapa 1 (core organizacional) criar essas entidades de
  fato. O vínculo `access_user` ↔ `colaborador` é adicionado por migration
  futura própria, revisada quando a Etapa 1 chegar — não antecipado aqui.
- Toda tabela fica no schema `app`, criada só por `evolli_migrator`,
  consumida em runtime só por `evolli_app` (DML), conforme ADR 0002.
- Nenhum campo de senha/segredo em texto claro; `password_hash`,
  `code_hash` e `token_hash` (de `access_session` e
  `access_password_reset_token`) sempre hash — o token/segredo bruto nunca é
  persistido. `mfa_secret_encrypted` sempre cifrado com AES-256-GCM, chave
  fora do banco (decisão fechada, §4, ADR 0003).
- `access_session.id` (chave interna) nunca é aceito como credencial em
  nenhuma rota — só `token_hash` (derivado do token do cookie) autentica.

## 8. Contratos de API necessários (futuro — não implementados nesta fatia)

| Método | Rota (proposta, sob `/v1`) | Descrição                                                 | Rate limit |
| ------ | -------------------------- | --------------------------------------------------------- | ---------- |
| POST   | `/v1/auth/login`           | E-mail + senha → sessão (ou desafio MFA)                  | Sim        |
| POST   | `/v1/auth/mfa/verify`      | Completa login com código TOTP                            | Sim        |
| POST   | `/v1/auth/logout`          | Encerra a sessão atual                                    | —          |
| GET    | `/v1/auth/sessions`        | Lista sessões ativas do usuário autenticado               | —          |
| DELETE | `/v1/auth/sessions/:id`    | Revoga uma sessão própria (ou de terceiro, se autorizado) | —          |
| POST   | `/v1/auth/password/forgot` | Inicia recuperação de senha (resposta genérica sempre)    | Sim        |
| POST   | `/v1/auth/password/reset`  | Conclui troca de senha via token                          | Sim        |
| POST   | `/v1/auth/mfa/enroll`      | Inicia configuração de MFA (gera QR/segredo)              | Sim        |
| POST   | `/v1/auth/mfa/confirm`     | Confirma ativação de MFA com primeiro código válido       | Sim        |
| POST   | `/v1/auth/mfa/reset`       | Admin técnico/RH/DP reseta MFA de terceiro (auditado)     | Sim        |
| GET    | `/v1/users/me`             | Perfil do usuário autenticado (sem dado de RH)            | —          |
| POST   | `/v1/users`                | Cria conta de acesso de terceiro (escopo conforme §3)     | Sim        |
| PATCH  | `/v1/users/:id/role`       | Altera papel/escopo de terceiro (nunca o próprio)         | Sim        |
| POST   | `/v1/users/:id/disable`    | Desativa conta de terceiro                                | Sim        |

Todas exigem CSRF (exceto onde N/A por não mudar estado) e todas as de
autenticação/gestão de conta são candidatas a rate limiting (§6). Contratos
completos (schema de request/response, `HttpStatus`, mensagens de erro fixas
seguindo o padrão do `AllExceptionsFilter`) ficam para a implementação.

## 9. Estratégia de testes

- **Unitários:** hashing/verificação de senha, geração/validação de TOTP,
  política de senha, geração/validação de token opaco (reset), lógica pura
  do avaliador RBAC/ABAC (papel + escopo + recurso + ação + classificação →
  permitir/negar), isolados de banco/HTTP.
- **Integração (Testcontainers, seguindo padrão da Fatia 2):** login com
  banco real, criação/expiração/revogação de sessão persistida, fluxo
  completo de MFA (enroll → confirm → login exige código), reset de senha
  fim a fim.
- **Autorização (por recurso/ação):** para cada entrada da matriz (§3), teste
  automatizado positivo (permite quando deveria) e negativo (nega quando não
  deveria) — inclusive escopo cruzado (usuário da empresa A não acessa/gerencia
  conta da empresa B).
- **Cenários de ataque (obrigatórios, e2e):**
  - IDOR: usuário autenticado tenta acessar/gerenciar recurso de outro
    escopo via manipulação de `:id` — espera 403/404 genérico, nunca 200.
  - Elevação de privilégio: usuário tenta alterar o próprio papel — espera
    negação; usuário tenta se auto-conceder escopo maior — espera negação.
  - Fixação de sessão: identificador de sessão pré-login é invalidado/trocado
    após autenticação bem-sucedida.
  - Força bruta: N tentativas de senha errada resultam em bloqueio/backoff;
    resposta idêntica para conta existente vs. inexistente.
  - Enumeração: comparação de timing/corpo de resposta entre e-mail
    existente e inexistente no login e na recuperação de senha.
  - CSRF: requisição de mudança de estado sem token CSRF válido é rejeitada
    mesmo com cookie de sessão válido.
  - Vazamento em erro: nenhuma resposta de erro do módulo de auth contém
    stack trace, SQL, hash, segredo MFA ou token — mesmo padrão de teste já
    usado em `http-exception.filter.spec.ts` (ADR 0001), estendido aos novos
    endpoints.

## 10. Eventos mínimos para auditoria (próxima fatia)

A trilha de auditoria formal é fatia própria (fora de escopo aqui), mas esta
fatia precisa gerar, no mínimo, estes eventos (quem, quando, de onde, ação,
resultado) para consumo futuro:

- Login bem-sucedido / login malsucedido (com motivo genérico: credencial
  inválida, MFA inválido, conta bloqueada).
- Logout.
- Criação de conta de acesso de terceiro.
- Alteração de papel/escopo de terceiro (valor anterior → novo, quem alterou).
- Desativação/reativação de conta.
- Ativação, reset ou desativação de MFA (próprio ou de terceiro).
- Início e conclusão de fluxo de recuperação de senha (sem o token em si).
- Revogação de sessão (própria ou de terceiro), com motivo.
- Bloqueio de conta por força bruta.

Nenhum desses eventos registra senha, hash, segredo MFA, token de sessão/
reset/CSRF ou código de recuperação — só metadado da ação.

## 11. Riscos, decisões pendentes e critérios de aceite

### Riscos

- MFA obrigatório para todo usuário desde o primeiro acesso pode gerar
  atrito operacional no piloto se não houver processo de suporte para reset
  — mitigado pelo evento de auditoria e fluxo de reset restrito (§4).
- Sessão em Postgres adiciona carga de leitura por requisição autenticada;
  os critérios objetivos de quando migrar para Redis estão na ADR 0003 —
  sem métrica real de escala/latência que os dispare, a fatia não migra.
- Envio real de e-mail (recuperação de senha) depende de provedor ainda não
  escolhido — sem isso, o fluxo de recuperação não é utilizável em produção
  (mitigação: pode ficar restrito a reset manual por Admin técnico até o
  provedor ser decidido).
- Desenhar a autenticação por interface (para permitir OIDC/SSO futuro sem
  reescrever sessão/autorização) adiciona uma camada de abstração desde já —
  risco de over-engineering se essa evolução nunca ocorrer; mitigado por
  manter a interface mínima (só o necessário para trocar o provedor de
  verificação de credencial, não um framework de plugins genérico).

### Decisões fechadas nesta validação (ver ADR 0003 para contexto completo)

1. **Sessão:** PostgreSQL nesta fatia. Redis só em evolução futura,
   condicionada a métrica de escala/latência (critérios na ADR 0003).
2. **Autenticação:** própria, por e-mail/senha, nesta fatia — desenhada por
   interface para permitir OIDC/SSO futuro sem reescrever sessão/autorização.
   Nenhum IdP externo integrado agora.
3. **MFA:** obrigatório para todo usuário ativo desde o primeiro acesso.
   TOTP implementado nesta fatia; WebAuthn/passkeys é evolução futura.
4. **Senha:** mínimo 15 caracteres, máximo ≥ 64, Unicode/espaço permitidos,
   sem composição arbitrária, sem expiração periódica, bloqueio de senha
   comum/vazada. Argon2id com mínimo 19 MiB / 2 iterações / paralelismo 1,
   só recalibrável de forma documentada por ambiente.
5. **Sessão segura:** cookie com token opaco de alta entropia; banco guarda
   só `token_hash`; `id` interno da sessão nunca é credencial; rotação
   após login/MFA; revogação sempre disponível.
6. **CSRF:** synchronizer token vinculado à sessão, validado no servidor,
   em toda operação que muda estado; `SameSite` é defesa adicional.
7. **Segredo MFA:** cifrado com AES-256-GCM, chave fora do banco, rotação de
   chave documentada, nunca em log.
8. **Escopo organizacional:** `access_user` desacoplado de colaborador até a
   Etapa 1; `company_id`/`unit_id`/`team_id` sem FK enforced até lá; vínculo
   com colaborador entra por migration futura revisada.

### Decisões ainda pendentes (aguardando aprovação)

1. **Provedor de envio de e-mail transacional** (recuperação de senha,
   notificação de segurança) — não decidido, fora de escopo de código desta
   fatia. Até ser decidido, recuperação de senha pode ficar restrita a reset
   manual por Admin técnico.
2. **Parâmetros finos ainda não fixados:** expiração de sessão (absoluta e
   por inatividade), janela de rate limiting e limiar exato de bloqueio de
   conta por força bruta — valores de referência em §4/§6, a fechar na
   implementação com aprovação de segurança (senha e Argon2id já têm
   parâmetro mínimo fixado na decisão 4 acima, não são mais pendência).
3. **Prazo/gatilho de avaliação de WebAuthn/passkeys** como complemento ou
   substituto do TOTP — não decidido, registrado como evolução futura
   (ADR 0003).

### Dependências de DPO/jurídico

- Validar finalidade e base legal do tratamento de e-mail corporativo, hash
  de senha e metadado de sessão (§2).
- Validar política de retenção de log de login/sessão (quanto tempo guardar
  IP/user-agent de login).
- Confirmar se aviso de privacidade específico é necessário para o
  cadastro de acesso técnico (distinto do aviso de dado de RH, que virá na
  Etapa 1).

### Critérios de aceite (para a implementação futura, não desta tarefa)

- [ ] Nenhuma senha, hash, segredo MFA, token de sessão/reset/CSRF ou código
      de recuperação aparece em log, erro HTTP ou resposta de API.
- [ ] Todo endpoint autenticado exige sessão válida; toda ação exige
      permissão explícita da matriz RBAC/ABAC — nada permitido por omissão.
- [ ] MFA obrigatório e verificado antes de conceder sessão completa para
      todo papel privilegiado (§3).
- [ ] Todos os cenários de ataque do §9 cobertos por teste automatizado e
      verdes.
- [ ] IDOR/BOLA: teste automatizado prova que usuário de um escopo não lê
      nem altera recurso de outro escopo, em toda rota que aceita `:id`.
- [ ] Elevação de privilégio: teste automatizado prova que ninguém altera o
      próprio papel/escopo.
- [ ] Revisão de segurança e LGPD (DPO/jurídico) aprovada antes de considerar
      a fatia concluída, conforme rito do plano mestre.

## 12. Arquivos que seriam alterados na implementação futura

```text
apps/api/prisma/schema.prisma                     # models access_user, access_session, etc.
apps/api/prisma/migrations/<timestamp>_identidade/ # migration real (não criada nesta fatia)
apps/api/src/auth/                                 # novo módulo: controller, service, guards, DTOs
apps/api/src/auth/password.service.ts              # hashing (argon2id), política de senha
apps/api/src/auth/mfa.service.ts                   # TOTP, códigos de recuperação
apps/api/src/auth/session.service.ts                # criação/validação/revogação de sessão
apps/api/src/auth/authorization/                    # avaliador RBAC/ABAC, guard/decorator reutilizável
apps/api/src/auth/rate-limit/                        # limitação de tentativas (login, recuperação, MFA)
apps/api/src/users/                                  # gestão de conta de acesso (CRUD limitado por escopo)
apps/api/src/common/logger/logger.module.ts          # extensão do redact para novos campos sensíveis
apps/api/src/app.module.ts                           # registro dos novos módulos
apps/api/.env.example                                # novas variáveis (ex.: chave de cifra MFA, parâmetros de sessão)
apps/api/test/auth.e2e-spec.ts                       # e2e de autenticação/sessão/MFA
apps/api/test/authorization.e2e-spec.ts              # e2e de RBAC/ABAC e cenários de ataque
docs/modules/etapa0-fatia3-identidade-acesso.md      # este documento, atualizado para "implementado"
```
