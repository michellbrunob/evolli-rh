# Implementation Plan Técnico - Evolli RH - Reserva Fiscal

**Status:** Plano arquitetural consolidado - requer planejamento por fatia antes de implementação

**Data:** 2026-08-13

**Última convergência:** 2026-09-29
**Entradas:** `.specify/memory/constitution.md` v1.4.0, `.specify/spec.md`,
`.specify/execution-status.md`, PRD oficial no Notion, ADRs 0001-0013, decisões versionadas,
`docs/ARCHITECTURE.md`, `docs/CLAUDE_HANDOFF.md`.

> **Glossário vinculante — 20/08/2026:** “Reserva Fiscal” identifica a empresa e integra o nome do
> projeto (**Evolli RH — Reserva Fiscal**). Não é módulo, produto, serviço, política, cálculo, crédito
> ou funcionalidade fiscal. Referências históricas que descrevem uma “Fatia de Reserva Fiscal” estão
> revogadas e não autorizam implementação.

## 1. Estratégia de entrega

O plano não autoriza implementação simultânea de todos os módulos. Cada módulo ou fatia passa por
`/speckit.tasks` somente depois de suas regras de negócio, LGPD, dependências e critérios de aceite
estarem aprovados. O foco de curto prazo é finalizar as fundações necessárias e entregar jornadas
independentes; a folha depende de homologação de regras e responsáveis.

| Ordem  | Fatia                         | Pré-condições para iniciar                                                                                            | Resultado esperado                                                              |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 0      | Segurança e fundação          | ADRs e controles existentes; MFA opcional no lançamento conforme T132; demais gates operacionais continuam explícitos | autenticação, autorização, auditoria, banco segregado e CI confiáveis           |
| 1      | Pessoas e vida funcional      | já integrada; decisões de dados/documentos aprovadas para evoluções                                                   | cadastro, vínculo, alocação e movimentos rastreáveis                            |
| 2      | Documentos e admissão digital | classificação, retenção, storage privado, quarentena e matriz de acesso aprovados                                     | documentos protegidos por objeto e publicação auditada                          |
| 3      | Jornada/ponto TXT             | TXT anonimizado, regras de jornada, REP e fechamento homologados                                                      | importação idempotente, apuração versionada e espelho                           |
| 4      | Folha                         | rubricas, fórmulas, alçadas, integrações e responsáveis aprovados                                                     | cálculo reproduzível, fechamento e retificações auditáveis                      |
| 5      | Relatórios                    | fórmulas, fontes, periodicidade, agregação e exportação aprovadas                                                     | indicadores gerenciais e operacionais com linhagem de dados                     |
| 6 (P3) | Desenvolvimento e Performance | escopo, ciclos, competências, papéis, retenção e governança aprovados por RH/Jurídico                                 | avaliações, PDI, feedback, pesquisas agregadas e indicadores de desenvolvimento |

Nenhuma destas fatias autoriza piloto com dados reais, produção ou exposição externa sem os gates da
Constituição e do PRD.

### 1.1 Operação multiempresa interna inicial

O ecossistema inicia com duas empresas internas. A fronteira obrigatória é `empresa_id`: cada usuário
operacional recebe escopo de uma única empresa e não pode consultar, pesquisar, exportar, aprovar ou
alterar registros da outra. A única exceção é o perfil `master_tecnico`, atribuível somente a contas
nominativas formalmente autorizadas para desenvolvimento e suporte, com visão global e capacidade de
configuração. A interface pode auxiliar a apresentar o contexto, mas o bloqueio é sempre validado no
servidor e no banco quando aplicável.

Qualquer conta com o perfil `master_tecnico` não é usada para rotina de RH e registra em auditoria toda
consulta global, alteração de configuração, criação/desativação de conta e tentativa de ação negada.
O lançamento inicial opera com `MFA_ENABLED=false` sob a aceitação de risco T132; a ativação futura
exige a chave protegida, evidências `DS-SEC-*` e decisão de rollout. O perfil não substitui a alçada de
RH/Jurídico para operações sensíveis: quando o fluxo de aprovação for exigido, o Master só pode
executar a ação após a aprovação aplicável.

Convergência (ADR 0012, `docs/adr/0012-*`): `master_tecnico` é o único acesso global standing;
`admin_tecnico` converge para bootstrap/histórico e deverá perder a capacidade de criar/promover
`admin_tecnico`; o papel técnico `dpo` fica depreciado (mantido no enum/histórico, removível só por
expand/contract, sem provisionamento); a governança de privacidade/LGPD é de RH + Jurídico. Tarefas
posteriores em `docs/decisions/convergencia-governanca-perfis-pendente.md`.

Operações importantes — como efetivação/retificação de vínculo, ajuste de ponto, publicação de
documento, exportação e futuro fechamento de folha — exigem permissão explícita, auditoria e fluxo de
aprovação quando homologado. Enquanto uma alçada não estiver definida, a ação permanece negada.

## 2. Stack tecnológica atual e alvo aprovado

| Camada                   | Atual no repositório                                                 | Uso e diretriz                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Linguagem e monorepo     | Node.js 22, TypeScript 5.7 em modo estrito, pnpm 10, Turborepo 2     | código compartilhado, build e verificações consistentes                                                                              |
| API                      | NestJS 10, API REST versionada em `/v1`, OpenAPI/Swagger             | módulos de domínio, validação, guards e casos de uso                                                                                 |
| Persistência             | PostgreSQL 16, Prisma 5, migrations versionadas                      | fonte transacional; migrations aditivas e revisadas                                                                                  |
| Testes                   | Jest, Supertest, Testcontainers                                      | unitários, E2E/integração e banco PostgreSQL efêmero real                                                                            |
| Segurança                | `argon2`, `helmet`, cookies, `class-validator`, `zod`, `nestjs-pino` | senha/sessão, headers, validação e logs estruturados redigidos                                                                       |
| UI                       | React + TypeScript + TSX; React/Vite                                 | `apps/web` possui o shell inicial do painel V1 e cliente CSRF em memória; telas de negócio dependem das respectivas fatias aprovadas |
| Processamento assíncrono | PostgreSQL no núcleo; Redis/filas somente por necessidade medida     | jobs para importação, relatório e integração exigem idempotência, status e auditoria                                                 |
| Documentos               | Cloudflare R2 aprovado pela ADR 0013; conteúdo ainda desabilitado    | metadados no PostgreSQL; objeto em bucket privado por ambiente, com autorização temporária, quarentena e controle de acesso          |

Sessões permanecem no PostgreSQL até métrica real justificar Redis (ADR 0003). Não introduzir IdP,
SSO, Redis, fila, storage ou outro provedor por antecipação: cada decisão material exige ADR.

## 3. Arquitetura em camadas

```text
UI Web / consumidores autorizados
        │  HTTPS + cookie de sessão + CSRF
        ▼
API REST NestJS (/v1)
  Controllers -> Guards -> DTO validation -> Application use cases
                                           │
                                           ▼
                                  Domain rules and policies
                                           │
                                           ▼
                Repository / integration interfaces (ports)
                       │                    │
                       ▼                    ▼
          PostgreSQL + Prisma          Providers/adapters
          audit_event append-only      TXT, storage, e-mail, ERP, etc.
```

### 3.1 API e apresentação

- Controllers expõem contratos REST versionados, validam DTOs e delegam ao caso de uso. Não contêm
  cálculo trabalhista/fiscal, decisão de autorização ou SQL direto.
- `SessionGuard`, `AuthorizationGuard` e permissões explícitas executam antes de todo acesso protegido.
  A autorização por objeto acontece no servidor, no caso de uso/serviço que conhece o recurso.
- Respostas e erros são genéricos, correlacionados por `request_id` e sem stack trace/dados pessoais.
- UI é consumidor de contratos documentados. Ela não toma decisões de permissão e não armazena token
  de sessão/CSRF em armazenamento persistente. O token CSRF é somente memória, com política aprovada
  de emissão/rotação.

### 3.2 Aplicação e domínio

- Cada módulo possui casos de uso explícitos para comandos e consultas: validar entrada de negócio,
  checar autorização, carregar dependências por interface, iniciar transação quando necessário e emitir
  auditoria aplicável.
- O domínio contém entidades, value objects, regras de vigência, políticas de cálculo e invariantes;
  não depende de NestJS, Prisma, HTTP, componente React ou SDK externo.
- Regras de folha e ponto são dados de negócio versionados e efetivos por período,
  aprovados externamente. Casos de uso recebem a versão aplicável e preservam insumos para reprodução.
- Fluxos de alto impacto aplicam estados explícitos, justificativa, segregação de funções, aprovação e
  confirmação/reautenticação quando definida pela avaliação de risco.

### 3.3 Persistência e infraestrutura

- Prisma implementa repositórios e transações; migrations são a única via de alteração do schema.
  `evolli_migrator` aplica DDL e `evolli_app` executa somente DML necessário.
- Dados temporalmente efetivos usam início/fim de vigência e constraints para impedir sobreposição e
  cruzamento de empresa. Correções seguem eventos de retificação/ajuste, sem destruição de história.
- `AuditService.record()` é o único ponto de escrita em `audit_event`; mutações que exigem auditoria
  persistem mudança e evento na mesma transação. A conta runtime não possui `UPDATE`/`DELETE` nessa
  tabela.
- Adapters externos isolam TXT/REP, e-mail, storage, antivírus, ERP, banco, eSocial e demais serviços.
  Eles validam contrato, prazo, retry seguro, idempotência e reconciliação; não vazam detalhes de
  provedor para o domínio.

## 4. Módulos e comunicação

| Módulo                             | Responsabilidade                                                                 | Consome                                            | Publica/fornece                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Identidade e Acesso                | contas, sessão, RBAC/ABAC, CSRF, rate limit                                      | estrutura organizacional/escopo                    | identidade autenticada e decisão de acesso                                              |
| Auditoria                          | eventos formais append-only e consulta restrita                                  | ações sensíveis dos demais módulos                 | evidência de investigação e correlação                                                  |
| Organização                        | empresa, unidade, área, cargo, equipe e reporte                                  | identidade/escopos                                 | fronteira de escopo e relação hierárquica                                               |
| Pessoas                            | colaborador, vínculo, alocação, movimentos                                       | organização, acesso, auditoria                     | situação funcional efetiva por período                                                  |
| Documentos                         | metadados, publicação, download e retenção                                       | pessoas, acesso, storage                           | documentos autorizados por objeto                                                       |
| Ponto/Jornada                      | lote TXT, marcação bruta, apuração, ajustes e espelho                            | pessoas, regras aprovadas, documentos              | eventos/apuração homologada para folha                                                  |
| Folha                              | rubricas, competência, prévia, fechamento e documentos                           | pessoas, ponto, movimentos e regras                | resultado versionado para documentos e relatórios autorizados                           |
| Relatórios                         | indicadores, agregação, exportação e linhagem                                    | módulos operacionais e regras aprovadas            | visão autorizada, agregada e auditada                                                   |
| Desenvolvimento e Performance (P3) | ciclos de avaliação, competências, feedback, PDI, pesquisas e planos de melhoria | pessoas, organização, identidade/acesso, auditoria | planos individuais e indicadores agregados, sem alimentar folha ou decisões automáticas |

Comunicação entre módulos ocorre por interfaces de aplicação e contratos explícitos. Não é permitido
acessar tabelas internas de outro módulo como atalho. Consultas devem receber somente dados mínimos;
operações que atravessam módulos preservam identificador de correlação, estado e evidência de origem.

### 4.1 Desenvolvimento e Performance (P3)

Este domínio é uma evolução planejada, independente das fatias de Ponto e Folha. Ele
reutiliza somente o colaborador, vínculo, estrutura organizacional e escopo de acesso necessários para
ciclos de desenvolvimento. Resultados de avaliação, feedback ou pesquisa não podem alterar
automaticamente remuneração, jornada, folha, promoção, desligamento ou medida
disciplinar.

Ordem recomendada de entrega: (1) avaliação individual e de experiência; (2) competências, metas e
PDI; (3) feedback estruturado e reuniões 1:1; (4) pesquisas de clima/liderança/gestão anonimizadas;
(5) avaliações 90°, 180° e 360°; (6) indicadores agregados; e (7) plano de melhoria/reversão somente
após aprovação expressa de RH e Jurídico.

- Ciclos, critérios, pesos, escalas, prazos, participantes, visibilidade e retenção são configurações
  versionadas e aprovadas; não devem ser inferidos de modelos de terceiros.
- PDI registra objetivo, ação, responsável, prazo, evidência e progresso. A conclusão deve ter autoria
  e histórico; não pode ser substituída silenciosamente.
- Feedback e 1:1 usam registro estruturado, visibilidade definida e possibilidade de ciência do
  colaborador. Texto livre requer política de moderação, classificação e retenção antes de produção.
- Pesquisas preservam a separação entre elegibilidade/convite e resposta. Resultados são somente
  agregados, com supressão de grupos pequenos e de recortes cuja combinação possa reidentificar alguém.
  O limiar mínimo, a retenção e o método de anonimização dependem de aprovação formal de RH/Jurídico.
- Planos de melhoria/reversão são fluxos sensíveis: exigem finalidade, linguagem não punitiva,
  responsável humano, registro de ciência, alçadas e revisão de RH/Jurídico; nunca são disparados por
  pontuação ou regra automática.

## 5. Modelo de dados e integridade

- Usar UUIDs internos, identificadores externos documentados e chaves compostas/constraints para manter
  coerência por empresa. Não usar nome de pessoa como chave de integração.
- Manter entidades temporalmente relevantes com vigência, origem, autor, aprovação e versão.
- Migrations são aditivas por padrão, revisadas em PR, reproduzíveis em banco vazio e cobertas por
  smoke test. Alteração destrutiva usa expand/contract e forward-fix ou runbook de rollback.
- Importações guardam lote, hash, versão de layout, arquivo original privado, operador, data/hora,
  totais e erros. O modelo impede duplicação efetiva e preserva marcações brutas.
- Cálculos de folha guardam competência, fonte, versão de regra, parâmetros, precisão/arredondamento,
  insumos, memória de cálculo, resultado, aprovação e retificação.
- Documentos e anexos guardam metadados mínimos, classificação, proprietário/escopo, retenção,
  integridade e estado de quarentena; o conteúdo fica em storage privado.

## 6. Segurança, LGPD e compliance

### Controle de acesso e autenticação

- Nega por padrão; concede por papel, empresa, unidade, equipe e objeto. Testar sucesso e negação para
  cada endpoint, download, exportação, anexo e aprovação.
- Sessões usam cookie `HttpOnly`, `Secure`, `SameSite` e token opaco armazenado apenas como hash no
  banco. CSRF synchronizer é obrigatório em mutações. MFA TOTP está implementado e controlado apenas
  por configuração do servidor. O lançamento inicial mantém `MFA_ENABLED=false`; fator ativo falha
  fechado e a futura ativação depende dos gates operacionais aprovados.
- Aplicar rate limiting, proteção contra enumeração/BOLA/IDOR, validação de entrada, headers seguros,
  CORS restritivo ou mesma origem conforme ADR, e reautenticação para ações de alto risco.

### Proteção de dados

- TLS moderno protege tráfego. Banco, backups e documentos devem usar criptografia em repouso ou
  controle compensatório formalmente aprovado. Chaves/segredos vivem em cofre ou configuração de
  ambiente protegida, com rotação documentada.
- Classificar dados pessoais, sensíveis, trabalhistas, financeiros, familiares, médicos e documentais.
  Para cada tratamento: finalidade, base legal, titular, origem, destinatário, retenção, descarte,
  responsável e necessidade de RIPD/DPIA.
- Aplicar minimização e mascaramento em UI, relatório, integração e notificação. Clima usa elegibilidade
  separada da resposta, agregação e supressão abaixo do limiar aprovado.

### Logs, auditoria e operação

- Logs técnicos estruturados têm `request_id` e redigem senha, hash, token, cookie, CPF, salário,
  documento, payload pessoal e segredos. Nunca registrar conteúdo do arquivo ou memória de cálculo
  sensível em texto livre.
- Auditoria formal captura metadados fechados de acesso, mudança, aprovação, exportação e integração;
  não carrega antes/depois em claro sem ADR. Correção é novo evento complementar.
- Backups são segregados, protegidos e testados por restauração. Observabilidade, alertas, resposta a
  incidente e objetivos de recuperação devem existir antes de produção.

## 7. Estratégia de branches, versionamento e GitHub

### Branches e pull requests

- `main` é protegida e recebe somente pull requests revisados. Não há push direto por Claude Code.
- Cada tarefa fechada usa branch própria, preferencialmente `codex/<id>-<descricao>` quando criada neste
  ambiente, ou a convenção já estabelecida no repositório para a fatia. A branch não altera arquivos
  fora do escopo aprovado.
- Antes de programar, Claude Code lê Constituição, Spec, Plan, task atual, ADRs pertinentes, README,
  ROADMAP, ARCHITECTURE e CLAUDE_HANDOFF. Ambiguidade fiscal, legal, LGPD ou de negócio é bloqueio de
  escopo, não autorização para supor uma regra.
- Um PR declara finalidade, arquivos, migrations, contratos, dados tratados, autorização, evidências de
  testes, revisão de segurança/LGPD, riscos, decisões pendentes e plano de rollback/forward-fix quando
  aplicável.

### Versionamento de contratos e banco

- Rotas REST usam `/v1`. Mudança incompatível requer versão/depreciação documentada, plano de migração
  e testes de contrato.
- Contratos compartilhados ficam em `packages/contracts`; conceitos de domínio reutilizáveis ficam em
  `packages/domain`. Pacotes não devem carregar dependência de framework ou infraestrutura.
- Toda migration é versionada e revisável. O schema e migrations devem permanecer sem drift; migração é
  aplicada somente com o papel de migrator em CI/CD/ambientes compartilhados.

### Integração contínua atual

O workflow GitHub Actions (`.github/workflows/ci.yml`) roda em pull requests e em `main`:

1. instalação determinística com `pnpm install --frozen-lockfile`;
2. formatação, lint, typecheck, build e testes unitários;
3. E2E contra PostgreSQL real via Testcontainers;
4. migration smoke em banco vazio, com papéis segregados, verificação de drift e pré-requisitos.

O plano mantém estes gates obrigatórios e adiciona, conforme cada módulo, testes de autorização,
contrato, cálculo de referência, idempotência, segurança de arquivo e reconciliação de integração.

## 8. Estratégia de testes e validação

| Nível          | Evidência mínima                                                                         |
| -------------- | ---------------------------------------------------------------------------------------- |
| Unitário       | regras de domínio, vigência, arredondamento, estados, cálculo aprovado e casos-limite    |
| Integração     | repositórios, transações, constraints, migrations, privilégios e adapters                |
| E2E            | sessão, CSRF, rota, validação, RBAC/ABAC, autorização de objeto e resposta sem vazamento |
| Contrato       | OpenAPI, importação/exportação, TXT/ERP/e-mail/storage conforme aplicável                |
| Segurança/LGPD | BOLA/IDOR, enumeração, logs redigidos, anexos, cache, rate limit, segregação e auditoria |
| Homologação    | regra de negócio, fórmula, fonte, alçada e evidência aprovadas por RH/Fiscal/Jurídico    |

Usar dados sintéticos e anonimizados em desenvolvimento e CI. Não copiar dado legado, credencial,
documento real ou backup para repositório, testes ou ambiente de demonstração.

## 9. Dependências e gates por módulo

| Módulo                         | Gate de negócio/compliance que bloqueia código operacional                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentos                     | credenciais do R2, classificação, retenção, matriz de acesso e quarentena aprovadas                                                                                      |
| Ponto                          | TXT anonimizado, layout REP, jornada, escala, fechamento e exceções homologados                                                                                          |
| Folha                          | rubricas, regras, incidências, alçadas, competência e integração aprovadas                                                                                               |
| Relatórios                     | fórmula, fonte, periodicidade, agregação, acesso e exportação aprovados                                                                                                  |
| Clima                          | limiar, anonimização, retenção e governança definidos por RH/Jurídico                                                                                                    |
| Desenvolvimento e Performance  | ciclos, competências, escalas, participantes, visibilidade, retenção, plano de melhoria e avaliação de impacto aprovados por RH/Jurídico                                 |
| Solicitações gerais de Pessoas | `PD-SOL-01..05` integradas; T139 sem anexos depende da convergência T138 e de especificação/plano/tarefas próprios; conteúdo permanece bloqueado pelos gates documentais |
| Dados reais/produção           | privacidade, retenção/descarte, backup/restauração, infraestrutura, risco crítico zero, reteste e aceites de risco documentados; MFA segue a exceção T132                |

## 10. Próximo ciclo recomendado

1. Concluir e integrar a convergência T138/PR #130 sobre a base que já contém T136 e ADR 0013.
2. Abrir a T139 a partir de `origin/main` atualizado e executar `/speckit.specify`, `/speckit.plan` e
   `/speckit.tasks` específicos para a fundação backend da Central.
3. Na T139, reconciliar o núcleo T066: cancelamento só antes de `em_revisao_rh`; "encerrada" mapeia
   para `encaminhada_para_operacao_rh`; reabertura pelo RH exige justificativa auditada.
4. Manter anexos, upload e efeitos automáticos fora da T139; R2 aprovado não elimina os portões de
   credenciais, limites, quarentena, acesso, retenção e descarte.
5. Rodar `/speckit.converge` antes de toda promoção para Ready for review, comparando código, Spec,
   Constituição, Plan, Tasks, ledger, ADRs, decisões, testes e documentação operacional.

> Nota de convergência (2026-09-29): stack real = NestJS 10 (adaptador Express) + React 18/Vite +
> PostgreSQL/Prisma + pnpm/Turborepo. `admin_tecnico` converge para bootstrap/histórico;
> `master_tecnico` é o único perfil global standing (ADR 0012). Estado de execução: ver
> [`.specify/execution-status.md`](execution-status.md).
