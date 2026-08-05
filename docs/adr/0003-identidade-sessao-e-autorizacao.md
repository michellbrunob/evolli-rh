# ADR 0003 — Identidade, sessão e autorização

- Status: aceito
- Data: 2026-08-03
- Relacionado: [docs/modules/etapa0-fatia3-identidade-acesso.md](../modules/etapa0-fatia3-identidade-acesso.md), [ADR 0001](0001-fundacao-api.md), [ADR 0002](0002-papeis-postgres-e-migrations.md)

## Contexto

A Etapa 0 — Fatia 3 dá à `apps/api` a primeira identidade real: login,
sessão e autorização. Antes de implementar, era necessário fechar decisões
que, se erradas, são caras de reverter depois: onde a sessão de servidor é
armazenada, se a autenticação é construída internamente ou delegada a um
provedor externo, o que é obrigatório em MFA, os parâmetros mínimos de senha
e hashing, o que exatamente fica no cookie vs. no banco, o mecanismo de CSRF,
como o segredo de MFA é protegido, e como a conta de acesso se relaciona com
"colaborador" (que só existe a partir da Etapa 1).

O produto trata dado de RH/DP, potencialmente sensível (LGPD). O princípio de
menor privilégio, negação por padrão e dependência mínima, já seguido nas
ADRs 0001 e 0002, se estende aqui: a camada de identidade não deve introduzir
infraestrutura nova (Redis, IdP externo) antes de haver necessidade real
comprovada, mas também não pode fechar a porta para essas evoluções — daí a
exigência de desenhar por interface onde a troca futura for previsível.

## Decisão

### 1. Sessão de servidor em PostgreSQL nesta fatia; Redis só por métrica futura

- Sessão armazenada em tabela no schema `app` do PostgreSQL (mesmo
  isolamento de privilégio da ADR 0002), não em Redis nem em JWT stateless.
- **Critério objetivo para migrar a Redis no futuro** (qualquer um):
  - p95 de latência da checagem de sessão em produção ultrapassar um
    orçamento definido pela equipe de performance (ex.: parte relevante do
    orçamento total de latência do endpoint) de forma sustentada, não
    pontual;
  - volume de sessões ativas simultâneas gerar contenção mensurável no
    PostgreSQL de produção (lock, saturação de conexão) atribuível à tabela
    de sessão;
  - necessidade operacional de compartilhar sessão entre múltiplos serviços/
    processos com requisito de latência que o Postgres não atenda.
- Sem uma dessas métricas realmente observadas em produção, a sessão
  permanece em PostgreSQL — a migração para Redis não é feita por
  antecipação.

### 2. Autenticação própria por e-mail/senha, desenhada por interface para OIDC/SSO futuro

- Login por e-mail/senha implementado nesta fatia, com hashing e MFA
  próprios (não delegados a IdP externo).
- A camada de verificação de credencial é isolada atrás de uma interface
  mínima (ex.: `CredentialVerifier`/`AuthenticationStrategy`, nome final na
  implementação) consumida pela emissão de sessão e pela autorização — de
  forma que adicionar OIDC/SSO no futuro seja **trocar/adicionar uma
  implementação dessa interface**, não reescrever sessão (decisão 1) nem o
  avaliador RBAC/ABAC (que opera sobre o usuário já autenticado,
  independente de como ele provou identidade).
- Nenhum IdP externo (Keycloak, Auth0, Azure AD/Entra ID) é integrado nesta
  fatia. Se essa integração vier a ser aprovada no futuro, é decisão
  arquitetural nova, com ADR própria.

### 3. MFA adiado para a próxima fatia de segurança (decisão posterior aprovada)

- **Decisão original desta ADR** (2026-08-03) fechava MFA (TOTP, RFC 6238)
  como obrigatório para todo usuário ativo desde o primeiro login, já
  implementado nesta fatia.
- **Decisão revisada (posterior à aprovação original):** MFA é **adiado**
  para a próxima fatia de segurança. Esta PR/fatia entrega login e sessão
  só com e-mail/senha — nenhuma estrutura de MFA (endpoint, serviço, tabela,
  coluna, dependência, variável de ambiente) é incluída.
- Isso é tratado como **risco aceito conscientemente**, não como
  enfraquecimento silencioso da decisão original: TOTP continua sendo a
  tecnologia decidida para quando MFA for implementado; WebAuthn/passkeys
  seguem como evolução futura além disso.
- **Controles compensatórios** desta entrega (mitigam, não substituem MFA):
  Argon2id (decisão 4), política de senha forte (decisão 4), sessão opaca em
  cookie `HttpOnly`/`Secure`/`SameSite` com só `token_hash` persistido
  (decisão 5), CSRF synchronizer token (decisão 6), logout/revogação de
  sessão sempre disponíveis, rate limiting de tentativas de login, RBAC/ABAC
  com negação por padrão, e proteção contra enumeração de usuário/IDOR/BOLA.
- **Condição de saída do risco aceito:** MFA implementado e **obrigatório
  antes de qualquer piloto com dados reais de RH ou produção** — não é
  aceitável operar piloto com dado real ou produção sem MFA ativo.

### 4. Parâmetros mínimos de senha e hashing

- Senha: mínimo 15 caracteres, máximo suportado de pelo menos 64, Unicode e
  espaço permitidos, sem exigência de composição arbitrária, sem expiração
  periódica forçada, com checagem obrigatória contra lista de senhas
  comuns/vazadas.
- Hash: Argon2id, mínimo 19 MiB de memória, 2 iterações, paralelismo 1 —
  esses valores são um **piso**, não um teto; só podem ser aumentados
  (nunca reduzidos), e qualquer recalibração por ambiente precisa ficar
  documentada (motivo, valor novo, data, responsável) junto à configuração
  daquele ambiente.

### 5. Sessão segura: token opaco no cookie, `token_hash` no banco

- O cookie de sessão carrega um token opaco aleatório de alta entropia,
  gerado no servidor no momento da emissão da sessão.
- O banco armazena **só o hash desse token** (`token_hash`, único) — o token
  bruto nunca é persistido em nenhuma tabela, log ou lugar além do cookie do
  cliente.
- O identificador interno da sessão (chave primária da tabela, usado só para
  referência/join) **não é aceito como credencial** em nenhuma rota — a
  única forma de autenticar uma sessão é apresentar o token do cookie, que o
  servidor rehash e compara contra `token_hash`.
- Rotação de token obrigatória após login (e, futuramente, após conclusão de
  MFA quando implementado); revogação (própria ou de terceiro autorizado)
  sempre disponível e imediata.

### 6. CSRF: synchronizer token

- Toda rota que muda estado exige um token CSRF do tipo synchronizer,
  vinculado à sessão do usuário, validado no servidor.
- `SameSite` do cookie de sessão é camada adicional de defesa em
  profundidade — não substitui o token synchronizer.

### 7. Segredo de MFA cifrado com AES-256-GCM, chave fora do banco (aplica-se quando MFA for implementado)

- Decisão preservada para quando MFA for implementado (decisão 3, adiada):
  o segredo TOTP de cada usuário será cifrado em repouso com AES-256-GCM
  antes de gravar no banco.
- A chave de cifragem viverá fora do banco de dados (variável de
  ambiente/cofre de segredos da plataforma, mesmo padrão de segredo já
  estabelecido nas ADRs 0001/0002 — nunca versionada).
- Rotação de chave será procedimento documentado (não automática); o
  segredo MFA nunca deverá aparecer em log, erro ou resposta de API, em
  nenhuma hipótese.
- Nesta fatia, nenhuma dessas estruturas existe no código/schema — a decisão
  fica registrada como especificação para a implementação futura de MFA.

### 8. `access_user` desacoplado de colaborador

- A entidade de acesso técnico (`access_user`) desta fatia é distinta de
  "colaborador" (Etapa 1) e não tem migration/tabela de colaborador para
  vincular ainda.
- `company_id`/`unit_id`/`team_id` em `access_user` são referências técnicas
  (`uuid`), sem `FOREIGN KEY` reforçada, até a Etapa 1 criar essas entidades
  de fato.
- O vínculo `access_user` ↔ `colaborador` é adicionado por uma migration
  futura própria, revisada no momento em que a Etapa 1 for implementada —
  não antecipado nesta fatia para não acoplar duas etapas ainda não
  homologadas.

## Alternativas descartadas

| Alternativa                                                   | Por que foi descartada                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis para sessão desde o início                              | Introduz dependência de infraestrutura nova sem métrica real que justifique — Postgres já é infraestrutura existente (Fatia 2) e suficiente para o volume esperado do piloto. Descartado por dependência mínima.             |
| JWT stateless para sessão                                     | Impede revogação real (exigida no enunciado): um JWT válido não pode ser invalidado antes de expirar sem uma lista de revogação, que reintroduz o mesmo problema que sessão de servidor já resolve. Descartado.              |
| IdP externo (Keycloak/Auth0/Azure AD) já nesta fatia          | Mudança arquitetural significativa, custo operacional e de integração desproporcional para a Etapa 0; adiado até haver necessidade real (múltiplos sistemas, exigência corporativa de SSO). Descartado por ora.              |
| MFA só para perfis privilegiados                              | Contradiz a decisão de negação por padrão e o perfil de risco de um sistema de RH/DP — qualquer conta comprometida sem MFA já é uma porta de entrada. Descartado em favor de MFA universal (quando implementado, decisão 3). |
| WebAuthn/passkeys nesta fatia                                 | Maior complexidade de implementação e de suporte a dispositivo/navegador do usuário no piloto; TOTP atende o requisito de segundo fator com menor atrito. Adiado como evolução.                                              |
| Guardar o token de sessão em claro no banco (não só o hash)   | Um vazamento do banco (backup, dump, acesso indevido) exporia sessões ativas diretamente, sem precisar do cookie do cliente. Descartado — só `token_hash` é armazenado.                                                      |
| Usar o `id` interno da sessão como credencial                 | Um identificador interno sequencial/previsível (ou mesmo UUID exposto via log/URL) vira vetor de sequestro de sessão se aceito como credencial. Descartado — só o token do cookie autentica.                                 |
| CSRF só por `SameSite`, sem token synchronizer                | `SameSite` sozinho não cobre todos os vetores (navegadores antigos, subdomínios, certas configurações de proxy) — prática recomendada é usar as duas camadas. Descartado usar só uma.                                        |
| Antecipar o vínculo `access_user` ↔ `colaborador` nesta fatia | Acoplaria esta fatia à Etapa 1 antes dela ser especificada/homologada, e obrigaria migration especulativa. Descartado — vínculo fica para quando a Etapa 1 for implementada e revisada.                                      |

## Consequências

- Toda checagem de sessão autenticada faz uma consulta ao PostgreSQL — custo
  de latência aceito nesta fatia, com critério objetivo de quando reavaliar
  (decisão 1).
- A interface de autenticação (decisão 2) adiciona uma camada de abstração
  desde já, mesmo sem OIDC/SSO implementado — trade-off aceito para evitar
  reescrever sessão/autorização se essa evolução for aprovada depois.
- MFA adiado (decisão 3) significa que esta fatia opera com risco aceito —
  conta comprometida por senha vazada/reutilizada não tem segundo fator até
  a próxima fatia de segurança implementar MFA, o que é obrigatório antes de
  qualquer piloto com dado real de RH ou produção (controles compensatórios
  documentados na decisão 3 e na Fatia 3 §11). Quando implementado, MFA
  universal aumentará o atrito de onboarding de todo usuário, exigindo
  processo de suporte a reset (evento de auditoria já especificado na
  Fatia 3).
- Parâmetros de Argon2id (decisão 4) custam CPU por login — piso definido
  conscientemente para resistência a ataque de força bruta offline; ambientes
  com mais capacidade podem aumentar (nunca reduzir), com registro
  documentado.
- Sessão baseada em `token_hash` (decisão 5) exige que toda validação de
  sessão recalcule o hash do token recebido e compare — nenhuma rota pode
  aceitar atalho pelo `id` interno.
- CSRF com synchronizer token (decisão 6) exige que todo formulário/chamada
  de mutação no frontend (Etapa futura) carregue e envie o token — acoplamento
  a ser considerado no contrato de API (Fatia 3, §8).
- Rotação de chave de cifragem do segredo MFA (decisão 7) é procedimento
  manual a documentar quando MFA for implementado — não há automação de
  rotação prevista; será risco operacional aceito conscientemente, a revisar
  se o produto crescer.
- `access_user` desacoplado de colaborador (decisão 8) significa que, até a
  Etapa 1, um usuário de acesso pode existir sem nenhum colaborador
  correspondente (ex.: conta de admin técnico) — isso é esperado, não um bug.

## Riscos

- Interface de autenticação (decisão 2) mal desenhada pode não realmente
  suportar OIDC/SSO sem refatoração relevante quando chegar a hora — mitigado
  mantendo a interface deliberadamente pequena (só verificação de credencial
  - identidade resultante), revisada antes de qualquer integração futura.
- MFA adiado é o risco aceito principal desta fatia — ver decisão 3 e Fatia 3
  §11 para controles compensatórios e condição de saída. Quando MFA for
  implementado, MFA universal sem fluxo de suporte maduro pode travar
  usuário legítimo fora do sistema — mitigação prevista: reset restrito a
  Admin técnico/RH/DP com auditoria (Fatia 3, §4, §10).
- Critérios de migração a Redis (decisão 1) dependem de instrumentação de
  métrica real em produção que ainda não existe (observabilidade é fatia
  futura) — até lá, a decisão de migrar fica sem dado objetivo para embasar,
  o que é aceito como estado inicial esperado.
- Rotação manual da chave de cifragem do segredo MFA (decisão 7, aplicável
  quando MFA for implementado) dependerá de disciplina operacional — sem
  automação, o risco é a rotação nunca acontecer na prática; mitigação fica
  registrada como item de revisão periódica de segurança.

## Responsabilidades

- **Time de desenvolvimento (código):** implementar a interface de
  autenticação de forma realmente substituível (decisão 2); garantir que
  `token_hash` seja o único dado de sessão persistido e que o `id` interno
  nunca sirva de credencial (decisão 5); implementar MFA (decisão 3) na
  próxima fatia de segurança, com fluxo de reset auditado, antes de qualquer
  piloto com dado real ou produção; nunca reduzir os parâmetros mínimos de
  senha/Argon2id (decisão 4) sem registro documentado.
- **TI/Segurança:** priorizar e acompanhar a implementação de MFA (decisão 3) como próxima fatia de segurança; definir e revisar o procedimento de
  rotação da chave de cifragem do segredo MFA (decisão 7) quando MFA for
  implementado; acompanhar a métrica de latência/contenção de sessão que
  dispararia a decisão 1 assim que observabilidade existir.
- **DPO/jurídico:** validar finalidade, base legal e retenção dos dados de
  identidade/sessão tratados (ver Fatia 3, §2), antes de produção; confirmar
  que o risco aceito de MFA adiado (decisão 3) é compatível com qualquer
  piloto com dado real antes de ele ocorrer.
- **Revisor de PR:** bloquear merge que grave token de sessão em claro, use
  `id` interno como credencial, reduza parâmetro mínimo de senha/Argon2id
  sem documentação, logue segredo MFA/senha/token em qualquer forma, ou
  autorize piloto com dado real de RH/produção sem MFA implementado.

## Critérios para futura migração a Redis/IdP externo

- **Redis:** só migrar mediante métrica real observada em produção conforme
  decisão 1 (latência sustentada, contenção de banco, ou requisito de
  compartilhamento entre serviços) — não por antecipação de escala hipotética.
- **IdP externo:** só integrar mediante requisito corporativo real (ex.:
  exigência de SSO por política de TI, múltiplos sistemas exigindo identidade
  federada) — quando isso ocorrer, exige nova ADR cobrindo alternativas de
  provedor, migração de contas existentes e impacto em sessão/MFA já
  implementados.

## Limitações

- Esta ADR **não implementa MFA nesta fatia** (decisão 3, adiada) — o
  código/schema desta entrega não contém nenhuma estrutura de MFA. A
  implementação fica para a próxima fatia de segurança, obrigatória antes de
  qualquer piloto com dado real de RH ou produção.
- Esta ADR não define parâmetros finos ainda pendentes (expiração exata de
  sessão, janela de rate limiting, limiar de bloqueio por força bruta) — ver
  Fatia 3, §11, decisões ainda pendentes.
- Não decide o provedor de envio de e-mail transacional (recuperação de
  senha) — pendência separada, fora de escopo de código.
- Não introduz nenhum modelo de domínio de RH/DP, nem trilha de auditoria
  formal (armazenamento/consulta/retenção) — isso é fatia própria futura.
