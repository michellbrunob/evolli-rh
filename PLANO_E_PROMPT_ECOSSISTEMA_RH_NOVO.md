# Ecossistema RH — Prompt mestre e plano de desenvolvimento

**Decisão:** abandonar o código do sistema atual e iniciar um produto novo, versionado desde o primeiro dia no GitHub. O sistema legado será usado somente como fonte de inventário, regras e cenários de homologação; não haverá cópia de código, banco SQLite, segredos, sessões ou documentos.

## 1. Objetivo do produto

Construir um ecossistema corporativo de RH e Departamento Pessoal, multiempresa e modular, que cubra o ciclo de vida do colaborador: atração, admissão, cadastro, jornada, folha e pagamentos, benefícios, desenvolvimento, comunicação, desligamento, documentos, indicadores e conformidade.

A referência funcional inclui a família TOTVS RH (Folha/eSocial, Ponto Eletrônico, Orçamento, Admissão Digital, Atração de Talentos e aprendizagem), porém o produto terá domínio, experiência e implementação próprios. A página da TOTVS confirma essas linhas de produto, incluindo RH Protheus/eSocial, Ponto, Orçamento, Admissão Digital e Atração de Talentos: <https://centraldeatendimento.totvs.com/hc/pt-br/categories/1500000346941-TOTVS-RH>.

## 2. Inventário consolidado

### 2.1 Módulos ativos/mapeados no legado

| Domínio | Módulos encontrados |
|---|---|
| Base organizacional | empresas, cadastros, colaboradores CLT, estagiários, PJ, perfis, parâmetros, feriados e CCT |
| DP e folha | rubricas, lançamentos, folha, fechamento de competência, pagamentos avulsos, 13º, férias, atestados/afastamentos, empréstimos, rescisão, provisões, contas a pagar e contábil |
| Jornada | ponto, banco de horas e ponto digital |
| Gestão de pessoas | admissão/onboarding, documentos, advertências, desempenho/PDI, treinamentos, trilhas, tarefas, projetos, aniversariantes e manuais |
| Comunicação | mural/avisos, comunicação, solicitações, e-mails, WhatsApp e notificações |
| Inteligência e operação | painel, relatórios, IA, histórico/atividade, backup, manutenção, integrações e migração |

### 2.2 Requisitos novos já registrados, separados do legado

1. **Ponto confiável:** importação TXT configurável, staging, hash/idempotência, preservação de marcações originais, ajustes justificados, espelho, banco de horas, fechamento e exportação controlada para a folha.
2. **ATS/Recrutamento:** caixa de e-mail exclusiva, captura de currículos e anexos, pipeline de candidatos, agenda, devolutivas revisáveis e retenção/descarte de currículos.
3. **People Analytics executivo:** headcount, admissões, desligamentos, turnover, absenteísmo, vagas, tempo de recrutamento, clima e treinamentos; filtros, qualidade do dado, fórmulas versionadas e exportação controlada.
4. **Clima anônimo:** campanhas, elegibilidade separada das respostas, limiar mínimo de anonimato, proteção contra reidentificação e planos de ação.
5. **Treinamentos e compliance:** catálogo, obrigatoriedade por público, prazos, reciclagem, escalonamento, certificados e evidência imutável.

## 3. Princípios inegociáveis

- **Segurança por desenho:** menor privilégio, negar por padrão, MFA para perfis privilegiados, sessões seguras em cookie, proteção contra CSRF, rate limit, cabeçalhos de segurança, logs estruturados e tratamento de erro sem vazamento de detalhes.
- **LGPD por desenho e por padrão:** finalidade e minimização de dados, classificação da informação, base legal/avisos de privacidade, retenção e descarte, atendimento aos direitos do titular, registros de operação e revisão com DPO/jurídico. A conformidade jurídica final depende de validação formal do DPO e do jurídico.
- **Auditoria imutável:** registrar quem, quando, de onde e qual ação realizou; especialmente consulta/download/exportação de dados, mudanças salariais, permissões, cálculos, aprovações, integrações e exclusões lógicas. Nunca registrar senha, token, CPF completo, salário ou conteúdo de documento nos logs técnicos.
- **Dados financeiros e legais versionados:** tabelas legais, fórmulas, regras de cálculo, convenções coletivas e layouts de integração terão vigência, versão, aprovador e trilha de auditoria. Não codificar alíquotas diretamente no código.
- **Portas de qualidade:** um módulo só avança quando seus critérios funcionais, de segurança, privacidade, acessibilidade, desempenho e homologação forem aprovados.

## 4. Arquitetura-alvo

### Stack definida

- **Monorepo GitHub:** `pnpm` + Turborepo; repositório privado, proteção de `main`, revisão obrigatória, CODEOWNERS e GitHub Actions.
- **Frontend:** React, TypeScript, JSX/TSX, Vite, React Router, TanStack Query, formulários com validação e componentes acessíveis.
- **Backend:** Node.js + TypeScript, NestJS ou Fastify modular (decidir no kick-off; preferência: NestJS para domínio, DI e padrões corporativos), REST versionada com OpenAPI.
- **Banco:** PostgreSQL, Prisma ou Drizzle (decidir no kick-off), migrações versionadas e usuário de banco sem privilégios administrativos.
- **Assíncrono:** Redis + fila (BullMQ) para e-mails, importações, relatórios, notificações, antimalware e integrações; tarefas agendadas auditáveis.
- **Documentos:** object storage privado compatível com S3, criptografia em repouso, metadados no PostgreSQL, quarentena e verificação antimalware. Nunca Base64 no banco nem arquivos no repositório.
- **Observabilidade:** logs JSON sem dados sensíveis, métricas, rastreamento por `request_id`, alertas e painel de auditoria.
- **Ambientes:** desenvolvimento, homologação e produção isolados; segredos em cofre/GitHub Environments, HTTPS, backup criptografado, teste de restauração e plano de rollback.

### Organização recomendada

```text
apps/
  web/                 # portal administrativo e, depois, autoatendimento
  api/                 # API Node TypeScript
packages/
  domain/              # regras de negócio puras e testes de cálculo
  database/            # schema, migrações e repositórios
  contracts/           # DTOs, OpenAPI e tipos compartilhados
  ui/                  # design system acessível
  config/              # lint, testes e TypeScript compartilhados
docs/
  adr/                 # decisões arquiteturais
  compliance/          # ROPA, retenção, matriz de acesso, evidências
  modules/             # escopo e critérios de aceite de cada módulo
```

## 5. Ordem de desenvolvimento e portões de aprovação

| Etapa | Entrega | Dependências | Só avança quando |
|---|---|---|---|
| 0. Fundação | monorepo, CI, ambientes, PostgreSQL, migrations, observabilidade, design system, autenticação/MFA, RBAC/ABAC, auditoria, gestão de documentos, LGPD e backup | decisões de papéis, empresas e DPO | testes de segurança, restore, auditoria e matriz de acessos aprovados |
| 1. Core organizacional | empresa/unidade/departamento/cargo, pessoas, vínculos CLT/estágio/PJ, colaboradores, perfis e dados cadastrais | etapa 0 | CRUD, segregação por empresa e escopo, auditoria e homologação RH aprovados |
| 2. Documentos e admissão | cofre documental, documentos admissionais, coleta segura, onboarding e aprovações | etapas 0–1 | upload/quarentena, acesso por escopo, retenção e fluxo admissional aprovados |
| 3. Jornada e ponto | escalas, feriados, importação TXT em staging, marcação imutável, ajustes, espelho, banco de horas e fechamento | etapas 0–1 e layout do relógio | arquivo homologado reimporta sem duplicar; cálculos conciliados; RBAC e auditoria aprovados |
| 4. Folha e DP operacional | rubricas, parâmetros versionados, lançamentos, férias, 13º, afastamentos, empréstimos, rescisão, provisões e fechamento | etapas 1 e 3; regras legais aprovadas | testes de cálculo, competência travada, dupla conferência e relatórios aprovados |
| 5. Pagamentos e integrações financeiras | relatórios de pagamento, aprovações, PJ/avulsos, CNAB/contábil conforme fornecedor | etapa 4 | reconciliação, segregação de funções, exportação auditada e homologação financeira |
| 6. Treinamentos e compliance | catálogo, trilhas, obrigatoriedade, certificação, alertas e relatórios de conformidade | etapas 0–2 | atribuição automática, visão do gestor limitada e evidência de conclusão validada |
| 7. ATS/Recrutamento | vagas, candidatos, e-mail de recrutamento, currículos, pipeline, entrevistas e devolutivas | etapas 0 e 2 | retenção, acesso restrito, anexos seguros e trilha de comunicação aprovados |
| 8. Analytics executivo | métricas com dicionário, qualidade do dado, filtros, agregação e limiar de anonimato | módulos fonte homologados | fórmulas aprovadas, sem vazamento de dados e exportação controlada |
| 9. Clima e engajamento | campanhas anônimas, respostas separadas, agregação, planos de ação | etapas 0, 1 e 8 | nenhum vínculo resposta-pessoa; limiar de anonimato e DPO aprovados |
| 10. Ecossistema e automação | portal do colaborador/gestor, comunicação, solicitações, integrações externas e IA com governança | core estabilizado | cada integração possui contrato, consentimento/base legal quando aplicável, monitoramento e plano de falha |

## 6. Rito obrigatório para cada módulo

1. Criar especificação curta: objetivo, atores, fluxos, dados tratados, regras, permissões, retenção, APIs, telas e critérios de aceite.
2. Registrar ADR quando houver decisão de arquitetura ou integração relevante.
3. Modelar migrations e contratos de API antes das telas; implementar por histórias pequenas e revisáveis.
4. Escrever testes unitários para regras, integração para API/banco, autorização (BOLA/IDOR), segurança e fluxo ponta a ponta.
5. Executar CI: lint, tipos, testes, scan de segredos, SCA, testes de autorização e build.
6. Homologar com RH/DP em dados fictícios ou anonimizados; registrar evidências, pendências e aceite.
7. Liberar somente após checklist assinado por Produto/RH, TI/Segurança e DPO quando houver dados pessoais/sensíveis.

## 7. Decisões pendentes antes de iniciar a etapa 0

- Quais empresas/unidades e perfis existirão no primeiro piloto.
- Matriz de funções e acessos: administrador técnico, RH, DP, gestor, financeiro, colaborador, auditor e DPO.
- Responsáveis RH, TI/Segurança, Financeiro e DPO/jurídico.
- Política de retenção e descarte por classe de dado, especialmente currículos, documentos, saúde/atestados e logs.
- Fornecedor e layout anonimizado do ponto; regras de jornada, tolerância e banco de horas.
- Fórmulas oficiais de turnover e absenteísmo e limiar de anonimato da pesquisa.
- Escopo regulatório e integrações prioritárias: eSocial, FGTS Digital, DCTFWeb, banco/CNAB, e-mail, mensageria e contabilidade.

## 8. Prompt mestre para desenvolvimento

> Você é o líder técnico e desenvolvedor full stack sênior de um novo ecossistema corporativo de RH e Departamento Pessoal. Trabalhe como arquiteto de software, engenheiro de segurança, especialista em PostgreSQL, Node.js/TypeScript e React/TSX, com visão de produto de RH brasileiro. O código legado existe apenas como inventário funcional e referência de regras; não reutilize seu código, banco, segredos, arquivos ou arquitetura.
>
> Construa o novo produto em um monorepo privado no GitHub com Node.js, TypeScript, React/TSX e PostgreSQL. Organize-o em `apps/web`, `apps/api` e pacotes compartilhados de domínio, banco, contratos e UI. A API deve ser versionada, documentada com OpenAPI e desenhada por módulos de domínio. Use migrations versionadas, testes automatizados e filas assíncronas para operações demoradas. Toda integração externa deve possuir contrato, timeout, retry seguro, idempotência, logs e plano de falha.
>
> Aplique segurança e LGPD desde o desenho: autenticação forte com MFA para perfis privilegiados; sessão segura; RBAC/ABAC por empresa, unidade, equipe, recurso, ação e classificação de dado; menor privilégio e negação por padrão. Implemente trilha de auditoria imutável para acessos, downloads, exportações, aprovações, alterações sensíveis, cálculos, permissões e integrações. Mantenha documentos em storage privado, com quarentena, validação de tipo por assinatura, limite de tamanho, antimalware e retenção; nunca aceite documentos em Base64 no banco ou no repositório. Não registre dados sensíveis, senhas, tokens ou documentos nos logs. Trate LGPD como requisito de engenharia, mas solicite validação do DPO/jurídico para finalidade, base legal, retenção e direitos dos titulares.
>
> Siga estritamente o desenvolvimento por etapas. Não inicie a próxima etapa sem que a atual tenha especificação aprovada, critérios de aceite atendidos, testes verdes, revisão de segurança/privacidade e homologação registrada. Para cada tarefa, primeiro apresente: objetivo, escopo que entra e não entra, dados pessoais tratados, atores/permissões, regras de negócio, modelo de dados, APIs, estratégia de teste, riscos e critérios de aceite. Depois implemente apenas a menor fatia vertical viável, rode os testes e entregue evidências. Se houver requisito ambíguo, pare e liste a decisão necessária; não invente regra legal, cálculo trabalhista, integração oficial ou base legal.
>
> Priorize as etapas nesta ordem: (0) fundação segura e compliance; (1) core organizacional e colaboradores; (2) documentos e admissão; (3) ponto confiável com importação TXT rastreável; (4) folha e DP; (5) pagamentos e integrações financeiras; (6) treinamentos/compliance; (7) ATS; (8) analytics; (9) clima anônimo; (10) autoatendimento, integrações e IA governada.
>
> Requisitos específicos a preservar: o ponto deve conservar marcações brutas, ser idempotente por hash/identificador externo e aceitar ajustes somente justificados e auditáveis; fórmulas e parâmetros trabalhistas devem possuir vigência, versão e aprovador; competência fechada deve bloquear alteração; dashboards devem expor agregados e suprimir grupos abaixo do limiar de anonimato aprovado; currículos têm acesso restrito e descarte controlado; trilhas obrigatórias precisam gerar evidência de atribuição, conclusão e certificado.
>
> Antes de alterar qualquer arquivo, inspecione a estrutura existente e o status do Git. Não apague nem sobrescreva dados ou mudanças não relacionadas. Faça commits pequenos, com mensagem clara, e não publique nada fora do repositório sem autorização explícita. Ao final de cada etapa, entregue um resumo objetivo: funcionalidades concluídas, arquivos alterados, migrations, testes executados e resultado, evidências de segurança/LGPD, pendências, riscos e a decisão necessária para prosseguir.

## 9. Primeira execução recomendada

Iniciar somente a etapa 0, nesta ordem: criar repositório novo e privado; registrar o documento de visão e decisões pendentes; criar monorepo TypeScript; configurar PostgreSQL local/homologação, migrations, CI e scan de segredos; implementar identidade, MFA, autorização, auditoria e gestão segura de documentos; criar matriz de dados, retenção e ROPA inicial; validar backup/restauração. Só então iniciar o cadastro organizacional e de colaboradores.

