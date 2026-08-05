# Etapa 0 — Fatia 4: Auditoria formal e rastreabilidade

Status: **especificação — aguardando aprovação** (nenhum código, migration,
dependência ou endpoint implementado nesta fatia)

## 0. Contexto e ordem no roadmap

Esta é a fatia que sucede a Etapa 0 — Fatia 3 (identidade, sessão e
autorização, PR #11, **mergeada em `main`**). A prioridade de implementação
após a Fatia 3 é a **auditoria formal**, não a importação de ponto por TXT —
auditoria é pré-requisito transversal para todo pilar seguinte (Núcleo
Organizacional, Colaboradores, Documentos e workflows), pois cada um desses
pilares precisa emitir eventos auditáveis desde o primeiro CRUD, e retrofitar
auditoria depois de existirem dados reais é mais caro e arriscado do que
construir o serviço primeiro.

Esta fatia é só **especificação**: define modelo conceitual, regras e
contratos futuros. Não cria migration, não adiciona dependência, não expõe
endpoint, não altera `apps/api` em código. Segue o rito leve do ecossistema:
Especificar → Aprovar → Implementar → Verificar → Registrar — este documento
cobre apenas o primeiro passo.

## 1. Objetivo, escopo e fora de escopo

### Objetivo

Especificar um serviço de auditoria formal, imutável e consultável, que
registre quem fez o quê, quando, de onde e com qual resultado, para toda ação
sensível do ecossistema — hoje só identidade/sessão (Fatia 3), no futuro
Núcleo Organizacional, Colaboradores, Documentos e demais pilares — sem
depender de log técnico de aplicação (que é observabilidade, não trilha de
auditoria: propósito, retenção e nível de garantia de imutabilidade
diferentes).

### Escopo — entra (nesta especificação)

- Modelo conceitual de evento de auditoria (§3), sem migration.
- Lista de eventos mínimos a capturar nesta fatia e no que já existe da
  Fatia 3 (§4).
- Regras de imutabilidade, integridade, retenção, consulta, exportação e
  descarte — identificando o que é decisão de engenharia vs. o que depende de
  DPO/jurídico/TI (§5).
- Política de dado nunca registrado em claro (§6).
- Matriz de acesso ao histórico de auditoria (§7).
- Estratégia de integridade contra alteração indevida (§8).
- Contratos de API futuros, sem criar endpoint (§9).
- Estratégia de testes futura (§10).
- Riscos, dependências, decisões pendentes e critérios de aceite (§11).
- Proposta de ADR 0004, dentro deste documento, **não criada como ADR
  formal** — depende de aprovação das decisões de retenção, integridade e
  acesso (§13).

### Escopo — não entra

- Qualquer migration, model Prisma, endpoint HTTP, serviço, guard ou
  dependência nova em `apps/api`. Esta fatia é só documento.
- Qualquer tabela/tela/processo de RH/DP (colaborador, cargo, folha, ponto,
  documento) — auditoria nesta fatia audita apenas o que já existe:
  identidade/sessão/autorização da Fatia 3.
- Importação de ponto por TXT — adiada, não é a prioridade atual (decisão
  registrada nesta especificação).
- MFA TOTP — permanece risco aceito registrado na Fatia 3/ADR 0003;
  obrigatório antes de qualquer piloto com dado real de RH ou produção. Esta
  fatia não implementa MFA nem altera essa decisão; apenas herda a
  obrigação como pré-condição de piloto (§11).
- Definição de prazo legal de retenção específico (ex.: "5 anos") — os
  prazos ficam como pendência de DPO/jurídico (§5), esta especificação só
  define o _mecanismo_ de retenção configurável.
- Painel visual/dashboard de auditoria — só o contrato de consulta (§9); UI é
  fatia de frontend futura.
- Qualquer decisão de infraestrutura de armazenamento externo (WORM storage,
  SIEM, exportação para data lake) — registrada como decisão pendente (§11),
  não fechada aqui.

## 2. Relação com o PRD, LGPD, ADRs anteriores e a camada de Identidade e Acesso

- **PRD "Sistema RH - Reserva Fiscal"**: fonte **complementar e obrigatória**
  de requisitos funcionais, segurança, LGPD e critérios de aceite do Evolli
  RH — não é um documento à parte, dispensável ou de prioridade menor que o
  roadmap técnico. O roadmap comercial do Evolli RH define a **sequência de
  implementação** por dependência técnica (por isso auditoria formal vem
  antes de ponto por TXT, §0), mas não sobrepõe nem rebaixa requisito já
  registrado no PRD. Caso um requisito, prioridade ou item de escopo desta
  especificação pareça conflitar com o PRD, esse conflito deve ser
  **registrado como decisão explícita** (quem decidiu, por quê, o que foi
  priorizado e o que ficou para depois) — nunca ignorado ou rebaixado
  silenciosamente. Nenhum conflito foi identificado entre este documento e o
  PRD até o momento; nenhuma regra de negócio deste documento foi inferida
  diretamente do PRD, apenas do plano mestre técnico (§3 abaixo) e dos ADRs
  já aceitos.
- **`PLANO_E_PROMPT_ECOSSISTEMA_RH_NOVO.md`** (§3, princípios inegociáveis):
  já registra "auditoria imutável" como princípio de fundação, exigindo
  registrar quem/quando/de onde/qual ação, especialmente consulta/download/
  exportação, mudanças salariais, permissões, cálculos, aprovações,
  integrações e exclusões lógicas — e nunca registrar senha, token, CPF
  completo, salário ou conteúdo de documento nos logs técnicos. Esta fatia
  operacionaliza esse princípio em modelo concreto.
- **LGPD**: a trilha de auditoria em si trata dado pessoal (ator, IP,
  metadado de ação sobre titular) — sujeita aos mesmos princípios de
  minimização e base legal já aplicados à Fatia 3 (§2 daquele documento).
  Adicionalmente, auditoria é o mecanismo que **evidencia** conformidade
  (quem acessou/exportou/alterou dado pessoal), o que cria tensão entre
  "minimizar dado tratado" e "reter evidência suficiente para prestar contas"
  — tensão explicitamente registrada como decisão pendente de DPO/jurídico
  (§5, §11), não resolvida por engenharia sozinha.
- **ADR 0001** (fundação da API): já define `request_id`, logging estruturado
  com `redact` e `AllExceptionsFilter` sem vazamento de detalhe interno —
  esta fatia reaproveita `request_id`/`correlation_id` como campo de
  correlação entre log técnico e evento de auditoria (§3), mas trata os dois
  como sistemas distintos (log técnico = observabilidade/depuração, rotativo,
  não fonte de verdade legal; auditoria = trilha formal, retenção própria,
  não substituível por log).
- **ADR 0002** (papéis de PostgreSQL e migrations): o princípio de menor
  privilégio e dois papéis de banco (`evolli_migrator`/`evolli_app`) se
  estende à tabela de auditoria — nenhum papel de aplicação em runtime deve
  ter privilégio de `UPDATE`/`DELETE` sobre o registro de auditoria (§8);
  a migration real desta fatia (quando aprovada e implementada) segue o
  mesmo padrão de `prisma migrate diff --from-empty` já usado na Fatia 3
  (schema sem shadow DB disponível).
- **ADR 0003** (identidade, sessão e autorização — Fatia 3, PR #11 **já
  mergeada em `main`**): é a primeira e única fonte de eventos que esta
  fatia audita hoje — login, logout, sessão, CSRF, RBAC/ABAC, rate limit,
  recuperação de senha (§4). Auditoria formal depende do `AccessUser`/
  `AccessSession`/`evaluatePermission` já especificados ali para saber
  "quem" e "com qual papel/escopo" agiu. Esta fatia **não** duplica nem
  substitui os eventos técnicos já logados via `nestjs-pino` (ADR 0001) —
  cria uma trilha formal paralela, com garantias diferentes (§5, §8).
- **Camada de Identidade e Acesso (já integrada em `main`)**: com a Fatia 3
  mergeada, o serviço de auditoria passa a ser o consumidor natural dos
  eventos de autenticação/autorização já emitidos pelo `AuthService`/
  `AuthorizationGuard`. Essa integração deixa de ser uma dependência futura
  e passa a ser uma **pré-condição já satisfeita** — a implementação desta
  fatia pode começar assim que a especificação for aprovada, sem precisar
  aguardar merge ou homologação adicional de identidade, pois já existe
  identidade de ator estável para registrar.

## 3. Modelo conceitual de evento de auditoria (sem migration)

Rascunho conceitual, para revisão — **nenhuma migration criada nesta fatia**.
Nomes de campo são propostas, não contrato fechado.

```text
evento_auditoria (conceitual)
  id                  identificador único, não sequencial previsível (mesmo
                      padrão de token opaco/UUID já usado na Fatia 3 — evita
                      enumeração de volume/ordem de eventos por terceiro)
  ocorrido_em         data/hora em UTC, gerada no servidor no momento do
                      evento (nunca aceita do cliente)
  ator_user_id        referência ao AccessUser que executou a ação (nulo só
                      para ações de sistema/automação, que devem se
                      identificar por um ator técnico próprio, nunca "nulo
                      silencioso")
  ator_papel          papel do ator no momento da ação (snapshot — papel pode
                      mudar depois; o evento preserva o papel vigente na hora)
  empresa_id          escopo organizacional do ator/recurso, quando aplicável
                      (nulo para ações de escopo "instância inteira", ex.:
                      admin técnico)
  unidade_id          escopo, quando aplicável
  equipe_id           escopo, quando aplicável
  acao                verbo controlado por lista fechada (ex.: login_sucesso,
                      login_falha, logout, sessao_revogada, senha_redefinida,
                      usuario_criado, papel_alterado, acesso_negado — ver §4
                      para a lista mínima); nunca string livre digitada pelo
                      chamador
  recurso              tipo do recurso afetado (ex.: access_user,
                      access_session, "documento" quando existir em fatia
                      futura)
  recurso_id           identificador do recurso afetado, quando existir
  origem_ip            IP de origem da requisição, mesmo padrão já capturado
                      na Fatia 3 (SessionRequestMetadata)
  origem_user_agent    user-agent, mesmo padrão da Fatia 3
  resultado            enum fechado: sucesso | falha | negado (não texto
                      livre — mensagem de erro nunca entra aqui, só a
                      classificação, consistente com AllExceptionsFilter/
                      ADR 0001 nunca vazar detalhe interno)
  request_id           correlação com o log técnico estruturado (ADR 0001) —
                      permite cruzar evento de auditoria com log de aplicação
                      da mesma requisição sem duplicar conteúdo
  correlation_id        opcional, para correlacionar múltiplos eventos de um
                      mesmo fluxo lógico que atravessa mais de uma
                      requisição (ex.: fluxo de recuperação de senha:
                      solicitação → redefinição)
  dado_anterior         somente quando a ação é uma alteração e a política de
                      minimização (§6) permite registrar — nunca campo
                      sensível em claro; quando o campo alterado for
                      sensível, registra-se só que "o campo X mudou", não os
                      valores (ver §6)
  dado_novo             mesma regra de dado_anterior
  criado_em             timestamp de inserção no armazenamento de auditoria
                      (pode divergir de ocorrido_em em milissegundos, mas
                      nunca deve divergir de forma que permita reescrever
                      história — ver §8)
```

Notas de modelagem (para a implementação futura avaliar, não decisão
fechada):

- `dado_anterior`/`dado_novo` são o campo de maior risco de vazamento — a
  decisão de **o que** pode entrar ali (nome de campo alterado? valor
  mascarado? nada?) é pendência de segurança a fechar antes de implementar
  (§11), não assumida aqui.
- O par `request_id`/`correlation_id` é o mecanismo de rastreabilidade entre
  camadas (log técnico ↔ evento de auditoria ↔ eventual chamada externa)
  sem duplicar payload entre elas.

## 4. Eventos mínimos

### Já cobertos pela Fatia 3 (a auditar assim que o serviço existir)

- Login bem-sucedido / login malsucedido (motivo genérico: credencial
  inválida, conta desativada, conta bloqueada — nunca detalhe que ajude
  enumeração).
- Logout.
- Revogação de sessão (própria ou de terceiro), com motivo (`logout`,
  `expired_absolute`, `expired_inactivity`, `rotated`, `revoked_by_self`,
  `revoked_by_admin`, `password_reset` — mesmo vocabulário já usado em
  `SessionService`/`AuthController` na Fatia 3).
- Início e conclusão de fluxo de recuperação/redefinição de senha (nunca o
  token em si).
- Criação de conta de acesso de terceiro.
- Alteração de papel/escopo de terceiro (valor anterior → novo, quem
  alterou) — sujeito à política de mascaramento (§6) quando o campo for
  sensível.
- Desativação/reativação/bloqueio de conta.
- Acesso negado relevante: tentativa de IDOR/BOLA, autoelevação, ação fora da
  matriz RBAC/ABAC (403 gerado pelo `AuthorizationGuard`) — não _todo_ 403
  (ex.: erro de validação de formulário não é evento de auditoria), só
  negação de autorização sobre recurso/ação protegidos.
- Bloqueio por força bruta (rate limit acionado).

### Fora de escopo hoje, já previstos para fatias futuras (não implementar agora)

- Acesso e alteração de documentos (Fatia "Documentos e admissão").
- Exportações de dado (relatórios, People Analytics, download de documento).
- Ações administrativas amplas fora de identidade (ex.: alteração de dado
  cadastral organizacional, mudança salarial, aprovação de fluxo) — entram
  quando os respectivos pilares existirem; o modelo de evento (§3) já é
  genérico o suficiente para cobri-los sem redesenho.

## 5. Imutabilidade, integridade, retenção, consulta, exportação e descarte

| Tema          | Regra de engenharia proposta                                                                                                                           | Depende de DPO/jurídico/TI                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imutabilidade | Nenhuma rota de aplicação expõe `UPDATE`/`DELETE` sobre evento de auditoria; correção é sempre por evento complementar, nunca edição do original (§8). | — decisão de engenharia, não pendente.                                                                                                                                                            |
| Integridade   | Escrita exclusiva pelo serviço de auditoria (§8); avaliar mecanismo adicional (assinatura/hash encadeado) como evolução, não fechado nesta fatia.      | TI (infraestrutura de proteção adicional, se aprovada).                                                                                                                                           |
| Retenção      | Mecanismo técnico deve ser **configurável por classe de evento** (não um prazo único fixo no código) — decisão de engenharia.                          | **Sim** — prazo exato por classe de evento (ex.: evento de acesso vs. evento de alteração de dado sensível) depende de DPO/jurídico; esta especificação não assume nenhum prazo legal específico. |
| Consulta      | Só via API própria, autorizada pela matriz (§7); nunca acesso direto a banco por perfil de negócio.                                                    | — decisão de engenharia.                                                                                                                                                                          |
| Exportação    | Contrato de API previsto (§9); toda exportação de trilha de auditoria é, ela mesma, um evento de auditoria (auto-referência).                          | DPO/jurídico define quem pode solicitar exportação formal (ex.: para autoridade, para auditoria externa) e sob qual processo.                                                                     |
| Descarte      | Mecanismo técnico de expurgo por classe/idade deve existir (job controlado, nunca `DELETE` manual ad-hoc) — decisão de engenharia.                     | **Sim** — se/quando descartar é decisão de retenção legal (DPO/jurídico); "nunca descartar" também é uma decisão possível, mas tem custo de armazenamento a avaliar com TI.                       |

Esta fatia não assume nenhum prazo legal (ex.: "5 anos", "10 anos") — todo
prazo é parâmetro de configuração a ser preenchido após validação formal,
nunca hardcoded.

## 6. Política de não registrar dado sensível em claro

Nunca registrado em claro em nenhum campo de evento de auditoria, nem em log
técnico correlato (mesma lista já usada no `redact` do `nestjs-pino`, ADR
0001, e no vocabulário de segurança da Fatia 3):

- Senha, hash de senha.
- Token de sessão, `token_hash`, cookie de sessão.
- Token CSRF, `csrf_token_hash`.
- Segredo MFA (quando existir, na fatia futura de MFA).
- CPF completo (mascaramento parcial, quando necessário referenciar, é
  decisão a fechar com DPO — ex.: só os 3 últimos dígitos).
- Salário e qualquer dado financeiro pessoal.
- Documento pessoal (RG, CTPS, comprovantes) ou seu conteúdo.
- Qualquer conteúdo de documento armazenado (Fatia "Documentos"), mesmo que
  o evento registre _que_ houve acesso/alteração.

Quando um evento precisa expressar "o quê" mudou sem expor o valor sensível,
a regra é registrar **metadado da mudança** (ex.: "campo salário foi
alterado por X em Y"), nunca o valor antes/depois quando esse valor for
sensível — consistente com `dado_anterior`/`dado_novo` do §3 sendo
condicionados à política de minimização, não um campo genérico livre.

## 7. Matriz de acesso ao histórico de auditoria

Negação por padrão — mesmo modelo RBAC/ABAC já especificado na Fatia 3
(`evaluatePermission`), aplicado a um novo recurso (`audit_log` ou
equivalente, nome final na implementação):

| Ator          | Ler trilha de auditoria                                | Escopo                                                |
| ------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Admin técnico | ✅                                                     | Instância inteira                                     |
| RH            | ❌ (salvo decisão futura explícita, não assumida aqui) | —                                                     |
| DP            | ❌ (idem)                                              | —                                                     |
| Gestor        | ❌                                                     | —                                                     |
| Financeiro    | ❌                                                     | —                                                     |
| Colaborador   | ❌                                                     | —                                                     |
| Auditor       | ✅ (leitura)                                           | Todas as empresas — papel existe exatamente para isso |
| DPO           | ✅ (leitura, para fins de compliance)                  | Todas as empresas                                     |

Regras adicionais:

- Nenhum ator, incluindo Admin técnico, tem rota de escrita direta sobre
  evento de auditoria — só o serviço de auditoria escreve (§8).
- RH/DP não têm acesso à trilha de auditoria nesta proposta inicial — diverge
  deliberadamente da matriz de gestão de conta da Fatia 3 (onde RH/DP
  gerenciam conta dentro da própria empresa), porque "ver o que outros
  fizeram" é um privilégio de nível diferente de "gerenciar a própria
  conta de terceiro"; se essa decisão precisar mudar, é decisão de produto/
  segurança explícita, não herdada por analogia (§11, decisão pendente).
- Toda leitura de trilha de auditoria por Auditor/DPO/Admin técnico é, ela
  mesma, registrada como evento de auditoria (consulta a trilha sensível é
  ação auditável).

## 8. Estratégia de integridade

- **Append-only por construção**: a tabela/armazenamento de evento de
  auditoria nunca recebe `UPDATE` nem `DELETE` de nenhum papel de aplicação
  em runtime — mesmo princípio de menor privilégio já aplicado a
  `evolli_app` (ADR 0002), estendido: nem mesmo o papel de runtime da API
  tem esse privilégio sobre a tabela de auditoria.
- **Autorização de escrita exclusiva pelo serviço de auditoria**: nenhum
  módulo de domínio escreve diretamente na tabela de auditoria — todos
  publicam o evento através de uma interface/serviço único (ex.:
  `AuditService.record(evento)`), análogo ao papel do `CredentialVerifier`
  na Fatia 3 (ponto único, testável, substituível). Isso evita duplicação de
  regra de mascaramento (§6) espalhada por múltiplos módulos.
- **Correções por evento complementar**: nunca se edita um evento já
  gravado. Um registro incorreto é corrigido emitindo um novo evento que
  referencia o original (ex.: campo `evento_corrigido_id` ou equivalente,
  nome final na implementação) — preserva o histórico completo, inclusive do
  erro original.
- **Opções de proteção adicional contra alteração indevida (a avaliar, não
  decidido nesta fatia)**:
  - Hash encadeado (cada evento inclui hash do evento anterior, estilo
    log de auditoria "tamper-evident") — aumenta garantia sem exigir
    infraestrutura nova, mas adiciona complexidade operacional (recalcular
    cadeia em caso de reprocessamento).
  - Armazenamento em storage WORM (write-once-read-many) externo, além do
    PostgreSQL — depende de decisão de TI/infraestrutura sobre provedor,
    fora do escopo de código desta fatia (mesma categoria de pendência já
    registrada na ADR 0002 para backup gerenciado).
  - Export periódico assinado para armazenamento externo imutável — mesma
    dependência de infraestrutura.
  - Nenhuma dessas três é adotada por esta especificação; ficam registradas
    como opção a avaliar quando a ADR 0004 for de fato aprovada (§13).

## 9. Contratos de API futuros (sem criar endpoint nesta fatia)

| Método | Rota (proposta, sob `/v1`) | Descrição                                                                                                  | Autorização                                            |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/v1/audit/events`         | Lista eventos de auditoria, paginado, filtrável por ator/empresa/ação/período                              | `RequirePermission(audit_log, read)`, matriz §7        |
| GET    | `/v1/audit/events/:id`     | Detalhe de um evento                                                                                       | Idem                                                   |
| POST   | `/v1/audit/exports`        | Solicita exportação formal de um intervalo/filtro (processo assíncrono, nunca síncrono para volume grande) | Idem, e a própria solicitação gera evento de auditoria |
| GET    | `/v1/audit/exports/:id`    | Consulta status/resultado de uma exportação solicitada                                                     | Idem                                                   |

Nenhuma rota de escrita direta de evento é exposta publicamente — eventos só
são criados internamente pelo `AuditService` (§8), nunca por chamada HTTP
externa de um módulo de domínio tentando "declarar" um evento arbitrário.
Contratos completos (schema de request/response, `HttpStatus`, mensagens de
erro fixas seguindo o padrão do `AllExceptionsFilter`) ficam para a
implementação, quando aprovada.

## 10. Estratégia de testes (futura)

- **Unidade**: regra de mascaramento (§6) — dado nenhuma combinação de
  entrada produz campo sensível em claro no evento gerado; validação de enum
  fechado de `acao`/`resultado` (rejeita valor fora da lista controlada).
- **Integração**: `AuditService.record()` contra banco real (Testcontainers,
  mesmo padrão da Fatia 2/3) — evento persistido, consulta paginada,
  filtro por ator/empresa/ação/período.
- **Autorização negativa**: para cada papel fora da matriz (§7), prova que
  `GET /v1/audit/events` retorna 403 — inclusive RH/DP (que têm outros
  privilégios de gestão de conta, mas não este).
- **Tentativa de alteração/exclusão**: prova, a nível de banco (privilégio de
  role) e a nível de aplicação (nenhuma rota exposta), que não é possível
  alterar ou apagar um evento já gravado — mesmo padrão de teste "prova
  negativa" já usado na Fatia 2 para `evolli_app` sem DDL.
- **Vazamento em log/erro**: nenhuma resposta de erro do módulo de auditoria
  contém stack trace, SQL ou dado sensível — mesmo padrão de
  `http-exception.filter.spec.ts` (ADR 0001), estendido aos novos endpoints.
- **Correlação por `request_id`**: prova que um evento de auditoria gerado
  dentro de uma requisição carrega o mesmo `request_id` do log técnico
  estruturado daquela requisição (rastreabilidade ponta a ponta).

## 11. Dependências, riscos, decisões pendentes e critérios de aceite

### Dependências

- Dependia da Fatia 3 (identidade/sessão/autorização) estar **mergeada**
  antes de iniciar implementação — **satisfeita**: PR #11 já está integrada
  em `main`. Homologação/verificação contínua da Fatia 3 segue seu próprio
  rito, mas não bloqueia mais o início desta fatia.
- **Não depende** de aprovação prévia de DPO/jurídico para iniciar a
  implementação técnica inicial — minimização de dado e proibição de dado
  sensível em claro (§6) são regras de engenharia já fechadas nesta
  especificação, aplicáveis desde o primeiro commit de código, com dado
  sintético (nunca dado real de RH) e sem popular `dado_anterior`/
  `dado_novo` com valor sensível algum (§3, §6).
- **Depende** de decisão de DPO/jurídico, especificamente, antes de:
  - usar a trilha de auditoria com **dado real** de RH ou em **produção**;
  - fechar o **prazo jurídico exato** de retenção por classe de evento (§5);
  - executar **descarte definitivo** de qualquer evento (o mecanismo técnico
    de expurgo pode existir e ser testado com dado sintético antes disso,
    mas não deve ser acionado contra dado real sem essa aprovação);
  - fechar a **política fina de mascaramento** de CPF/campos sensíveis
    quando referenciados por identificador em `dado_anterior`/`dado_novo`
    (§3, §6) — até essa aprovação, esses dois campos permanecem _não
    implementados_ (não "implementados com valor sensível temporário").

### Riscos

- Auditoria mal desenhada pode ela mesma se tornar superfície de vazamento
  de dado sensível (ex.: registrar valor antes/depois de campo sensível sem
  querer) — mitigado pela política de minimização (§6), mas exige revisão de
  segurança específica antes de merge da implementação futura.
- Volume de eventos pode crescer rápido (todo login, toda ação RBAC negada)
  — sem estratégia de retenção/particionamento definida, tabela pode
  degradar performance de consulta; critério objetivo de quando particionar/
  arquivar fica como decisão pendente, análogo ao critério de migração a
  Redis já registrado na ADR 0003 para sessão (medir antes de otimizar por
  antecipação).
- Matriz de acesso restritiva (só Admin técnico/Auditor/DPO) pode gerar
  atrito operacional se RH precisar investigar incidente do próprio time —
  mitigação possível é solicitar a um Admin técnico, mas isso é decisão de
  processo, não implementada nesta fatia.
- MFA TOTP continua como risco aceito (Fatia 3/ADR 0003) — esta fatia não
  muda esse status; reforça que MFA é condição obrigatória antes de qualquer
  piloto com dado real de RH ou produção, independente do avanço da
  auditoria.

### Decisões pendentes (aguardando aprovação)

1. Prazo de retenção por classe de evento — DPO/jurídico.
2. Política exata de mascaramento de CPF/campos sensíveis quando referenciados
   por identificador (não valor) em evento de auditoria — DPO.
3. Se/quando adotar hash encadeado ou storage WORM externo (§8) — TI/
   segurança, com custo-benefício a avaliar, não decidido aqui.
4. Se RH/DP devem ganhar acesso de leitura restrito à trilha do próprio
   escopo em fatia futura — produto/segurança, não decidido aqui (§7).
5. Nome final de campos/tabela (`evento_auditoria` é nome de trabalho neste
   documento, não contrato fechado).

### Critérios de aceite (desta especificação, não da implementação futura)

- [ ] Aprovação humana explícita do modelo conceitual (§3) antes de qualquer
      migration ser criada.
- [ ] Revisão de segurança confirma que nenhum campo do modelo conceitual, se
      implementado literalmente, vazaria dado sensível em claro — minimização
      e proibição de dado sensível em claro (§6) são obrigatórias **já na
      implementação inicial**, não uma condição futura.
- [x] PR #11 (Fatia 3) mergeada antes do início da implementação desta fatia.
- [ ] Implementação técnica inicial pode prosseguir **sem** aprovação prévia
      de DPO/jurídico, desde que: use somente dado sintético (nunca dado real
      de RH); trate a retenção como parâmetro configurável, sem prazo fixo
      no código; e não popule `dado_anterior`/`dado_novo` com nenhum valor
      sensível (§3, §6).
- [ ] Aprovação de DPO/jurídico sobre prazo de retenção, descarte definitivo
      e política fina de mascaramento (§5, §6) é obrigatória antes de: usar
      a trilha com dado real de RH; operar em produção; ou executar qualquer
      descarte definitivo de evento.

## 12. Arquivos futuros previstos para implementação (não criados nesta fatia)

```text
apps/api/prisma/schema.prisma                       # novo model de evento de auditoria
apps/api/prisma/migrations/<timestamp>_auditoria_formal/
apps/api/src/audit/audit.module.ts
apps/api/src/audit/audit.service.ts                  # AuditService.record(), ponto único de escrita
apps/api/src/audit/audit.controller.ts                # GET /v1/audit/events, /v1/audit/exports (§9)
apps/api/src/audit/dto/                                # DTOs de consulta/exportação
apps/api/src/audit/mask/                               # regras de mascaramento (§6)
apps/api/test/audit.e2e-spec.ts
docs/adr/0004-auditoria-formal-e-integridade.md        # ADR formal, só após aprovação (§13)
```

## 13. Proposta de ADR 0004 (não criada — depende de aprovação)

O texto abaixo é a **proposta** de conteúdo para `docs/adr/0004-auditoria-
formal-e-integridade.md`, mantida dentro deste documento porque a ADR formal
só deve ser criada como arquivo próprio depois que as decisões de retenção
(§5), integridade (§8) e acesso (§7) estiverem aprovadas — criar a ADR antes
disso registraria uma decisão que ainda não foi tomada.

> ### ADR 0004 — Auditoria formal e integridade (proposta)
>
> - Status: **proposto, não aceito**
> - Relacionado: este documento (`docs/modules/etapa0-fatia4-auditoria-formal.md`), ADR 0001, ADR 0002, ADR 0003
>
> **Contexto (proposto):** a Etapa 0 precisa de uma trilha de auditoria
> formal, distinta de log técnico de observabilidade, para toda ação sensível
> do ecossistema, começando pelos eventos já existentes na Fatia 3.
>
> **Decisão (a fechar quando aprovada):**
>
> 1. Armazenamento: PostgreSQL nesta fatia, mesmo padrão de isolamento de
>    privilégio da ADR 0002 — critério objetivo de quando avaliar storage
>    externo/WORM fica pendente (§8, §11).
> 2. Escrita exclusiva via `AuditService`, nunca `UPDATE`/`DELETE` por nenhum
>    papel de runtime — append-only por construção.
> 3. Correção por evento complementar, nunca edição do original.
> 4. Retenção configurável por classe de evento, prazo a definir por DPO/
>    jurídico — não hardcoded.
> 5. Acesso de leitura restrito a Admin técnico, Auditor e DPO por padrão
>    (§7) — negação por padrão para os demais papéis.
> 6. Nenhum dado sensível em claro (§6), reaproveitando a lista de campos já
>    protegida pelo `redact` da ADR 0001.
>
> **Esta ADR não é aceita até que:** as decisões pendentes listadas no §11
> deste documento estejam resolvidas e a especificação (este arquivo) esteja
> aprovada por quem de direito no rito Especificar → Aprovar.
