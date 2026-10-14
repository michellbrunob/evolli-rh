# Tasks de Desenvolvimento - Evolli RH - Reserva Fiscal

**Base:** Constituição v1.4.0, `.specify/spec.md`, `.specify/plan.md` e
`.specify/execution-status.md`

**Última convergência:** 2026-09-29

> **Glossário vinculante — 20/08/2026:** “Reserva Fiscal” é o nome da empresa e do projeto. Não é
> módulo, produto, serviço nem escopo fiscal. T020–T023, que descreviam uma fatia fiscal por equívoco,
> estão **canceladas** e não devem ser executadas.
> **Regra de execução:** cada item é uma tarefa fechada para uma branch e PR próprios. Claude Code deve
> parar e reportar se uma pré-condição, regra de negócio ou decisão de LGPD/Fiscal não estiver atendida.
> Não usar dados reais; testes usam dados sintéticos ou anonimizados.

## Fase 0 - Fundação e gates transversais

1. **T001 - Verificar baseline de segurança**

   - **Objetivo:** revisar os controles existentes de identidade, sessão, RBAC/ABAC, CSRF, auditoria,
     migrations e CI contra a Constituição; registrar lacunas sem ampliar o escopo funcional.
   - **Arquivos/pastas relevantes:** `.specify/memory/constitution.md`, `.specify/spec.md`,
     `.specify/plan.md`, `docs/adr/0001-fundacao-api.md` a `docs/adr/0010-preparacao-multiempresa-interna.md`,
     `apps/api/src/auth/`, `apps/api/src/audit/`, `.github/workflows/ci.yml`.
   - **Pré-condições:** nenhuma; executar antes de qualquer nova fatia e registrar decisões pendentes.

2. **T002 - Completar endpoint CSRF aprovado**

   - **Objetivo:** implementar e validar o endpoint autenticado de emissão/rotação de token CSRF,
     preservando hash-only na sessão, token somente em memória do cliente, invalidação do anterior,
     resposta sem cache e ausência de vazamento em logs/auditoria.
   - **Arquivos/pastas relevantes:** `apps/api/src/auth/`, `apps/api/test/`,
     `docs/adr/0009-painel-administrativo-web-v1.md`, `docs/modules/painel-administrativo-web-v1.md`.
   - **Pré-condições:** T001 concluída; confirmar que o contrato da ADR 0009 é o baseline vigente.

3. **T003 - Criar shell do painel administrativo web**

   - **Objetivo:** criar o pacote `apps/web` com React, Vite e TypeScript estrito, consumindo a API pela
     mesma origem aprovada e obtendo CSRF apenas em memória; não criar funcionalidades de domínio.
   - **Arquivos/pastas relevantes:** `apps/web/`, `packages/ui/`, `packages/contracts/`,
     `docs/modules/painel-administrativo-web-v1.md`, `turbo.json`, `pnpm-workspace.yaml`.
   - **Pré-condições:** T002 integrada; ADR 0009 e baseline de UX aprovados; nenhuma configuração de
     CORS ou armazenamento persistente de token é permitida.

4. **T004 - Preparar controles de dados reais e operação**

   - **Objetivo:** documentar e implementar somente os controles técnicos aprovados para cofre de
     segredos, MFA, backup/restauração, monitoramento, resposta a incidentes e restrição de rede; emitir
     evidências de gate, sem liberar produção antes das aprovações humanas.
   - **Arquivos/pastas relevantes:** `infra/`, `.env.example`, `docs/`, `.github/workflows/`,
     `apps/api/src/auth/`.
   - **Pré-condições:** decisões de TI/Segurança sobre VPS, VPN/firewall, IAM, cofre, MFA e objetivos de
     recuperação; validação de RH/Jurídico de retenção e descarte.
   - **Formulário de aprovação (T033):** as pré-condições foram convertidas em um pacote de decisão
     objetivo para Produto/TI, RH e Jurídico em
     `docs/decisions/pacote-decisao-seguranca-operacional.md` (identificadores `DS-…`/`CG-PROV-…`,
     reusados do registro de pendências). Nenhuma decisão foi tomada por essa conversão; a fase
     Implementar da T004 só abre por controle após a decisão correspondente ser registrada com evidência.

## Fase 1 - Cadastro e documentos

5. **T005 - Consolidar contratos de Pessoas e vigência**

   - **Objetivo:** revisar e completar contratos de API e domínio para consulta histórica, movimentos
     futuros, retificação e autorização por objeto/escopo, sem alterar regras salariais não aprovadas.
   - **Arquivos/pastas relevantes:** `packages/contracts/`, `packages/domain/`, `apps/api/src/pessoas/`,
     `apps/api/test/pessoas.e2e-spec.ts`, `docs/adr/0007-colaboradores-e-vida-funcional-baseline-v1.md`.
   - **Pré-condições:** T001 concluída; RH aprovou campos, estados, alçadas e dados que podem entrar na
     próxima fatia de Pessoas.

6. **T006 - Implementar retificação de movimento funcional**

   - **Objetivo:** permitir correção de movimento efetivado por evento de retificação vinculado, com
     vigência, justificativa, aprovação e auditoria transacional, preservando o histórico original.
   - **Arquivos/pastas relevantes:** `apps/api/src/pessoas/`, `apps/api/prisma/schema.prisma`,
     `apps/api/prisma/migrations/`, `apps/api/test/pessoas.e2e-spec.ts`, `apps/api/src/audit/`.
   - **Pré-condições:** T005 concluída; RH definiu matriz de aprovação e eventos de alto impacto.

7. **T007 - Definir arquitetura de documentos privados** — **CONCLUÍDA (2026-08-14)**

   - **Objetivo:** criar ADR e contrato para storage privado, classificação, metadados mínimos,
     quarentena/antimalware, retenção, descarte e links de download autenticados/temporários.
   - **Arquivos/pastas relevantes:** `docs/adr/`, `docs/modules/`, `packages/contracts/`, `infra/`,
     `apps/api/src/documents/` (a criar).
   - **Pré-condições:** RH/Jurídico aprovaram categorias documentais, finalidade, base legal,
     retenção, responsáveis e fornecedor de storage; não implementar upload real antes disso.
   - **Entregue:** [ADR 0011](../docs/adr/0011-documentos-privados-e-admissao-digital.md) (status
     **Aceito**) + especificação estrutural + registro de aprovações pendentes. A arquitetura fixou
     upload/storage/quarentena/download como **Nível 2** — a ADR não os autoriza. O módulo real chama-se
     `apps/api/src/documentos/` (português), não `.../documents/`.

8. **T008 - Implementar publicação e acesso a documentos** — **CONCLUÍDA, escopo V1 de metadados
   (2026-08-14). Integrada em `main` via PR #20 (squash `cdf4a71`).**

   - **Objetivo:** implementar metadados, publicação, substituição, cancelamento, visualização/download
     com autorização de objeto e auditoria; bloquear BOLA/IDOR, enumeração e cache público.
   - **Arquivos/pastas relevantes:** `apps/api/src/documents/`, `apps/api/prisma/`,
     `apps/api/test/documents.e2e-spec.ts` (a criar), `packages/contracts/`, `apps/web/`.
   - **Pré-condições:** T007 aprovada e integrada; T004 concluída para dados reais; matriz de acesso por
     categoria documental homologada.
   - **Entregue (V1 de metadados, sem conteúdo):** `TipoDocumento`, `DocumentoMetadado` e
     `SolicitacaoDocumento`; RBAC por empresa (deny-default, duas fases), auditoria fail-safe de leitura,
     404 anti-enumeração, integridade empresa↔colaborador por constraint triggers diferidos. Módulo em
     `apps/api/src/documentos/`; testes `apps/api/test/documentos.e2e-spec.ts`. CI verde (Quality Gates,
     E2E PostgreSQL, Migration Smoke).
   - **Deliberadamente FORA do V1 (Nível 2, ainda bloqueado):** upload, **visualização/download de
     conteúdo**, publicação de conteúdo real, storage, cache. O verbo "publicação/download" do objetivo
     original é Nível 2 — pré-condições em [aprovações pendentes](../docs/decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md)
     e MFA (ADR 0003). Convergência: T027, abaixo.

## Fase 2 - Jornada e ponto V1

9. **T009 - Fechar baseline funcional de Ponto V1**

   - **Objetivo:** registrar decisões e cenários de referência do TXT/REP, identificação por matrícula,
     layouts, escalas, intervalos, feriados, ausências, banco de horas, fechamento e exceções.
   - **Arquivos/pastas relevantes:** `docs/modules/etapa3-jornada-ponto-rastreavel-estrutural.md`,
     `docs/decisions/etapa3-jornada-ponto-baseline-v1.md`, `docs/adr/0008-jornada-ponto-rastreavel-baseline-v1.md`,
     `.specify/spec.md`.
   - **Pré-condições:** RH forneceu TXT anonimizado, documentação do fornecedor/REP e regras
     homologadas; RH/Jurídico/fornecedor validaram aderência aplicável.
   - **Detalhamento documental (T034) e consolidação (T035):** a especificação detalhada da V1
     operável e da fila "Verificar folhas" está em `docs/modules/etapa3-jornada-ponto-v1-detalhada.md`.
     A T035 consolidou decisões do RH que resolvem `DP-3J-13` (tolerância por dia), `DP-3J-15` (limites
     +38/-24h só geram alerta), `DP-3J-16` (almoço livre <1h considera 1h automática), `DP-3J-17`
     (rejeição só da marcação, resto do lote segue) e `DP-3J-19` (horário atribuído no cadastro do
     colaborador); também registrou como decididos: cada empresa só administra suas tabelas de
     horários, jornadas de 9h como requisito operacional recebido (sem declarar conformidade legal),
     entrada do Ponto V1 é arquivo TXT (leiaute técnico AFD/AEJ segue pendente), exemplos visuais como
     referência de apresentação (não substituem DP-3J-18) e ausência de integração técnica com o
     sistema externo observado. A **única pendência bloqueante remanescente** é `DP-3J-14` reduzida ao
     tratamento dos dias 29-31 (não inferido). `DP-3J-18`, `20`, `21`, `22` seguem pendentes sem
     alteração. A alçada operacional do V1 continua RH como único operador
     (importar/visualizar fila/ajustar/aprovar/fechar); DP/gestor/colaborador negados; master_tecnico
     só leitura técnica, sem mutação trabalhista. Nada foi implementado; dado real segue bloqueado
     (MFA, DS-OPS-01, DP-3J-09/11).
   - **Fundação implementada (T038):** cadastro de tabelas de horário por empresa e vínculo histórico
     ao colaborador (com vigência) estão implementados no backend (`apps/api/src/horarios`, migration
     `20260826120000_cadastro_horarios_vigencias`, Prisma models TabelaHorario/PeriodoHorario/
     VinculoHorario). Integridade no banco: EXCLUSION de sobreposição de períodos (int4range) e de
     vigências (daterange) + índice parcial + FK composta de mesma empresa + trigger colaborador↔empresa;
     desativação lógica (sem DELETE); RH único operador (T037), master só leitura, DP/demais negados;
     auditoria sem dado pessoal. Sem cálculo/importação/fechamento/UI; dado real segue bloqueado.
     Testes: unit (RBAC horários, validação de períodos) + E2E PostgreSQL real (isolamento, sobreposição,
     privilégios, trigger, auditoria).
   - **Evidência técnica da entrada AFD (T039):** confirmado que o equipamento de origem é fabricado
     pela RWTech, modelo BLUE BIOPROX-C; as batidas são extraídas manualmente pelo RH no Secullum
     (software de gestão de ponto, não o relógio); a entrada é arquivo TXT em formato AFD, com
     cabeçalho, registros de batida e encerramento observados; Secullum e relógio são somente origem
     de dados, sem integração por API/rede/comunicação direta no V1. `DP-3J-20` resolvida
     **parcialmente** (formato/origem técnica) — leiaute oficial completo, enquadramento na Portaria
     671 e homologação jurídica seguem pendentes. Arquivo real nunca é/será versionado (contém dado
     pessoal); testes futuros usarão exclusivamente AFD sintético. Nenhum código, parser, endpoint,
     migration, UI, importação ou cálculo criado por esta tarefa; dado real segue bloqueado (MFA,
     DS-OPS-01, DP-3J-09/11).
   - **Contrato técnico do parser AFD (T040):** especificação técnica do parser criada em
     `docs/modules/etapa3-parser-afd-contrato-tecnico-v1.md`, a partir da fonte oficial do Ministério
     do Trabalho e Emprego (página REP + anexo "Leiaute do Arquivo Fonte de Dados (AFD)", **versão
     "004"**, referenciada pela **Portaria MTP nº 671/2021**; consulta em 2026-08-27). Define: tipos de
     registro reconhecidos (cabeçalho tipo `1`, marcação de REP-C tipo `3` como fonte de batida da V1,
     trailer tipo `9`, demais reconhecidos sem gerar batida); campos de rastreabilidade da marcação
     (NSR, data/hora com fuso, identificador bruto/CPF, CRC, hash do arquivo, ref. de lote, posição de
     linha) sem copiar valor real; validação estrutural (codificação ISO 8859-1, CR+LF, tipo/tamanho,
     data/hora/fuso no formato oficial, ordenação de NSR, CRC-16, contagens do trailer, duplicidade/
     idempotência); regras **fail-closed** (arquivo desconhecido/truncado/corrompido/incompatível
     rejeitado por inteiro) distintas da **rejeição por marcação** (T035, pendência sem expor CPF);
     separação rígida entre validação técnica do AFD, associação ao colaborador por CPF e regras
     trabalhistas de apuração (fora); auditoria só com IDs técnicos/hash/metadados; fixtures
     **exclusivamente sintéticos** (válidos e inválidos). `DP-3J-20` **avança parcialmente** (leiaute
     oficial identificado e contrato do parser especificado), preservando homologação do fornecedor
     (RWTech, campo a campo com amostra sintética, incl. variante de CRC-16 do REP-C) e validação
     jurídica (DP-3J-09) como pendentes. **Não** implementa parser, upload, endpoint, banco, migration,
     UI, cálculo, integração ou dado real; **não** declara conformidade com a Portaria 671; MFA e
     DS-OPS-01 seguem gates.
   - **Núcleo do parser AFD sintético (T041):** implementado o núcleo **TypeScript puro e isolado** em
     `apps/api/src/ponto/afd/` (`afd-layout.ts`, `afd-parser.types.ts`, `afd-parser.ts`, fixtures
     sintéticas `afd-fixtures.ts`, testes `afd-parser.spec.ts`). `parseAfdSintetico(conteudo: Buffer)`
     interpreta e valida estruturalmente o AFD REP-C conforme o contrato T040: cabeçalho tipo `1`,
     marcações tipo `3` e trailer tipo `9`; valida codificação ISO 8859-1, terminação CR+LF, ausência
     de linha em branco, comprimento por tipo, tipo de registro, NSR (numérico, ordenação crescente,
     duplicidade), versão "004", data/hora/fuso no formato oficial e conferência das contagens do
     trailer. Diferencia **erro estrutural fatal** (fail-closed, sem registros aceitos) de **erro de
     marcação por linha** (pendência técnica; restante do lote segue, decisão RH T035). Devolve em
     memória só os dados mínimos (nsr, momento com fuso preservado, identificador bruto, posição de
     linha) + pendências/erro com **código seguro + posição/NSR**, nunca CPF, nome, conteúdo da linha,
     data/hora bruta ou hash. **Não implementados de propósito (condicionados/pendentes):** CRC-16,
     assinatura, normalização do CPF de 12 posições, política de lacuna de NSR e chave de idempotência.
     26 testes unitários (arquivo válido, cabeçalho/trailer ausente, tipo inválido, linha truncada,
     ordem inválida, marcação inválida, rejeição parcial, erro fatal, não vazamento de identificador).
     **Fora de escopo (inalterado):** endpoint, controller, upload, arquivo salvo, banco, migration,
     Prisma, UI, integração Secullum/RWTech, cadastro/associação de colaborador, cálculo de jornada,
     MFA, dado real. CI local: lint, typecheck, build e 385 testes unitários verdes.
   - **Contrato do lote de importação AFD (T042):** especificação criada em
     `docs/modules/etapa3-lote-importacao-afd-contrato-v1.md` — o envelope de proveniência/estado entre
     o parser puro (T041) e a futura gravação de marcações. Define: finalidade/fronteiras (importação
     manual pelo RH, por empresa, sem integração com Secullum/relógio no V1); **máquina de estados**
     (recebido → validando → rejeitado_estruturalmente | processado_com_pendencias |
     pronto_para_associacao; cancelado; terminais explícitos); **cinco camadas separadas** (integridade
     do arquivo → resultados do parser → associação por CPF → marcações persistidas → apuração
     trabalhista), com handoff explícito; **fail-closed × rejeição parcial** mapeados ao resultado do
     parser (T035/T040); **dados mínimos e proibições** (nada de conteúdo bruto em log; nada de
     CPF/nome/horário/linha em auditoria/erro; hash + IDs técnicos + contadores; não decidir/simular
     retenção/cripto/storage/descarte enquanto DP-3J-11 aberto); **segurança** (RH único operador no
     próprio empresa_id; master_tecnico sem mutação trabalhista; DP/gestor/colaborador negados;
     cross-company → 404 anti-enumeração; auditoria fail-safe append-only via AuditService); idempotência/
     duplicidade/reprocessamento como **pendências** (sem inferência); critérios de aceite + matriz de
     testes futuros (AFD sintético); gates preservados (MFA, DS-OPS-01, retenção/base legal, jurídico,
     normalização de CPF, CRC-16, assinatura, lacunas de NSR, idempotência). **Não** implementa lote,
     endpoint, upload, banco, migration, UI, associação, cálculo, integração ou dado real; **não**
     declara conformidade com a Portaria 671.

10. **T010 - Modelar lote e marcações brutas de ponto**

- **Objetivo:** criar modelo de domínio, contratos, migration e constraints para lote, arquivo
  protegido, hash, layout/versão, marcação bruta, erro e confirmação, sem armazenar dados pessoais
  desnecessários.
- **Arquivos/pastas relevantes:** `packages/domain/`, `packages/contracts/`,
  `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/src/ponto/` (a criar).
- **Pré-condições:** T009 aprovada; arquitetura de documento/storage de T007 disponível para arquivo
  original protegido.

11. **T011 - Implementar parser, prévia e validação TXT**

- **Objetivo:** processar o layout homologado em prévia segura, validar formato/conteúdo/período,
  identificar colaborador por identificador aprovado e apresentar totais, erros e duplicidades antes
  da efetivação.
- **Arquivos/pastas relevantes:** `apps/api/src/ponto/`, `packages/domain/`,
  `apps/api/src/ponto/*.spec.ts` (a criar), `apps/api/test/ponto.e2e-spec.ts` (a criar).
- **Pré-condições:** T010 concluída; amostras anonimizadas e resultados esperados aprovados por RH.

12. **T012 - Efetivar importação idempotente de ponto**

- **Objetivo:** confirmar lote validado em transação, persistir marcações originais sem duplicidade e
  emitir auditoria; reimportação da mesma fonte retorna resultado idempotente.
- **Arquivos/pastas relevantes:** `apps/api/src/ponto/`, `apps/api/src/audit/`,
  `apps/api/test/ponto.e2e-spec.ts`, `apps/api/prisma/migrations/`.
- **Pré-condições:** T011 concluída; regra de unicidade/idempotência homologada; permissões do
  operador e processo de confirmação definidos.

13. **T013 - Implementar apuração versionada e espelho**

- **Objetivo:** apurar jornada por versão de regra aprovada, gerar pendências/espelho e preservar
  insumos e cálculo para reprodução; não introduzir regra legal ausente.
- **Arquivos/pastas relevantes:** `packages/domain/`, `apps/api/src/ponto/`,
  `packages/contracts/`, `apps/api/test/ponto.e2e-spec.ts`, `apps/web/`.
- **Pré-condições:** T012 concluída; regras de jornada, escalas, intervalos, feriados, ausências e
  casos de referência formalmente aprovados por RH/Jurídico.

14. **T014 - Implementar ajuste e fechamento de ponto**

- **Objetivo:** criar fluxo de ajuste adicional, justificativa, aprovação, fechamento mensal e
  exceção posterior, sem modificar marcação original e com auditoria obrigatória.
- **Arquivos/pastas relevantes:** `apps/api/src/ponto/`, `apps/api/src/audit/`,
  `apps/api/test/ponto.e2e-spec.ts`, `packages/contracts/`.
- **Pré-condições:** T013 concluída; RH definiu alçadas, período de fechamento, exceções e impacto na
  futura folha.

15. **T015 - Entregar autorização e UI mínima de Ponto**

- **Objetivo:** disponibilizar prévia/importação para operador autorizado e espelho para colaborador,
  gestor e RH conforme escopo, com testes de autorização positiva/negativa e sem expor dados de outra
  equipe/empresa.
- **Arquivos/pastas relevantes:** `apps/api/src/ponto/`, `apps/api/test/ponto.e2e-spec.ts`,
  `apps/web/`, `packages/contracts/`.
- **Pré-condições:** T014 concluída; T003 integrada; escopo de gestor e telas/mensagens aprovados.

## Fase 3 - Folha de pagamento

16. **T016 - Formalizar catálogo de regras e rubricas de folha**

- **Objetivo:** modelar contrato de regra/rubrica versionada, vigência, fonte, aprovação e cenários
  de referência, sem codificar fórmulas não homologadas.
- **Arquivos/pastas relevantes:** `docs/modules/` (a criar), `packages/domain/`,
  `packages/contracts/`, `apps/api/src/folha/` (a criar).
- **Pré-condições:** DP/Fiscal/Jurídico aprovaram rubricas, incidências, alíquotas, arredondamento,
  férias, 13º, afastamentos, rescisões, competência e responsáveis.

17. **T017 - Implementar prévia e reprodução de folha**

- **Objetivo:** gerar prévia por competência a partir de fontes efetivadas, guardar versão de regra,
  insumos, resultado, divergências e memória de cálculo reproduzível.
- **Arquivos/pastas relevantes:** `apps/api/src/folha/`, `packages/domain/`,
  `apps/api/prisma/`, `apps/api/test/folha.e2e-spec.ts` (a criar).
- **Pré-condições:** T016 concluída; Ponto V1/integração de eventos homologados quando for fonte do
  cálculo; cenários de referência aprovados.

18. **T018 - Implementar fechamento e retificação de folha**

- **Objetivo:** controlar estados de prévia, revisão, aprovação, fechamento, recálculo e retificação,
  com segregação de funções, justificativa e auditoria transacional.
- **Arquivos/pastas relevantes:** `apps/api/src/folha/`, `apps/api/src/audit/`,
  `packages/contracts/`, `apps/api/test/folha.e2e-spec.ts`.
- **Pré-condições:** T017 concluída; matriz de aprovação e processo de exceção fechados por DP/Fiscal.

19. **T019 - Publicar documentos de folha no portal**

- **Objetivo:** conectar o resultado aprovado de folha ao módulo de documentos para disponibilizar
  contracheques, férias e declarações ao titular, mantendo acesso de objeto e auditoria de leitura.
- **Arquivos/pastas relevantes:** `apps/api/src/folha/`, `apps/api/src/documents/`, `apps/web/`,
  `apps/api/test/folha.e2e-spec.ts`, `apps/api/test/documents.e2e-spec.ts`.
- **Pré-condições:** T008 e T018 concluídas; categorias, fonte e periodicidade de documentos aprovadas.

## Fase 4 - Relatórios e encerramento de fatia

24. **T024 - Formalizar catálogo de indicadores e relatórios**

- **Objetivo:** registrar definições, fórmulas, fontes, periodicidade, escopo, atualização,
  agregação, limiares de anonimização e permissão de exportação para cada indicador.
- **Arquivos/pastas relevantes:** `docs/modules/` (a criar), `packages/contracts/`,
  `packages/domain/`, `.specify/spec.md`.
- **Pré-condições:** RH aprovou fórmulas e fontes; RH/Jurídico definiram limiar e
  governança da pesquisa de clima.

25. **T025 - Implementar consultas agregadas e linhagem**

- **Objetivo:** disponibilizar consultas autorizadas que exibam indicador, período, fonte, versão de
  fórmula, última atualização e divergências, impedindo exposição de detalhes pessoais fora do perfil.
- **Arquivos/pastas relevantes:** `apps/api/src/relatorios/` (a criar), `packages/contracts/`,
  `packages/domain/`, `apps/api/test/relatorios.e2e-spec.ts` (a criar), `apps/web/`.
- **Pré-condições:** T024 concluída; fontes operacionais fechadas e testes de agregação aprovados.

26. **T026 - Implementar exportação segura de relatórios**

- **Objetivo:** gerar exportações autorizadas com finalidade, filtros, colunas minimizadas, entrega
  segura, expiração e auditoria, aplicando apenas dados e colunas aprovados.
- **Arquivos/pastas relevantes:** `apps/api/src/relatorios/`, `apps/api/src/audit/`,
  `apps/api/test/relatorios.e2e-spec.ts`, `apps/web/`.
- **Pré-condições:** T025 concluída; política de exportação, retenção e perfis autorizados aprovados
  por RH/Jurídico.

27. **T027 - Convergir e homologar cada fatia**

- **Objetivo:** executar `/speckit.converge`, confrontar implementação com Constituição, Spec, Plan,
  PRD, ADRs e critérios de aceite, atualizar documentação e preparar PR para revisão humana.
- **Arquivos/pastas relevantes:** `.specify/`, `docs/adr/`, `docs/modules/`, `docs/decisions/`,
  `.github/workflows/ci.yml`, testes e migrations da fatia entregue.
- **Pré-condições:** todas as tarefas da fatia atual concluídas; CI verde; evidências de segurança,
  LGPD, testes e homologação disponíveis; decisões pendentes ou desvios explicitamente registrados.
- **Executada para a Fatia 2 (Documentos, V1 de metadados) — 2026-08-14.** Relatório versionado:
  [docs/decisions/etapa2-documentos-convergencia.md](../docs/decisions/etapa2-documentos-convergencia.md).
  Confrontou Constituição v1.3.0, Spec, Plan, ADR 0011 e código integrado (`cdf4a71`, PR #20); CI verde
  (Quality Gates, E2E PostgreSQL, Migration Smoke); marcou como histórico os trechos pré-promoção da
  ADR 0011 e da §15 do módulo estrutural. Convergência das demais fatias segue por fatia.

## Ordem de execução

- T001 é obrigatória antes de novas mudanças. T002 e T003 podem preceder a evolução funcional da UI.
- T005-T008 são independentes do Ponto, mas T008 depende de decisão de storage/privacidade.
- T009-T015 formam a próxima sequência funcional recomendada e devem ser executadas em ordem.
- T016-T019 só começam após as decisões de folha.
- T024-T026 dependem de fórmulas e fontes aprovadas; T027 fecha cada fatia, não apenas o projeto inteiro.

28. **T028 - Auditar e consolidar o isolamento das duas empresas iniciais**

- **Objetivo:** confrontar o modelo integrado de `empresa_id`, RBAC, rotas, buscas, exportações e
  auditoria com a decisão de operação inicial em duas empresas; registrar lacunas e, somente se
  autorizadas, propor correções pequenas e testáveis. O único acesso transversal permitido é a
  perfil `master_tecnico` em conta nominativa autorizada, conforme Constitution; não criar outros
  acessos globais.
- **Arquivos/pastas relevantes:** `apps/api/prisma/schema.prisma`, `apps/api/src/auth/`,
  `apps/api/src/organizacao/`, `apps/api/src/pessoas/`, `apps/api/src/documentos/`,
  `apps/api/src/ponto/`, `apps/api/test/`, `docs/adr/`, `docs/decisions/`.
- **Pré-condições:** decisão registrada de duas empresas iniciais; lista de perfis e ações críticas
  a ser aprovada por RH/Jurídico. Antes de qualquer alteração de código, apresentar o relatório de
  aderência e pedir autorização.

29. **T031 - Convergência de governança de privacidade e perfis globais (documentação)**

    - **Objetivo:** formalizar em ADR 0012 e em documento de decisões pendentes as decisões
      aprovadas: RH+Jurídico como função responsável pela governança de privacidade/LGPD (sem DPO
      provisionado); papel `dpo` formalmente depreciado e não destrutivo; `master_tecnico` como único
      acesso global standing; `admin_tecnico` convergido para bootstrap/histórico (perda futura da
      auto-cunhagem); campos de aprovação documental migram por expand/contract no futuro. Notas de
      convergência em ADR 0005/0010/0011. Somente documentação — nenhum código/schema/teste.
    - **Arquivos/pastas:** `docs/adr/0012-*`, `docs/decisions/convergencia-governanca-perfis-pendente.md`,
      notas em `docs/adr/0005`, `docs/adr/0010`, `docs/adr/0011`. Rastreabilidade versionada em `docs/`.
    - **Entregue:** ADR 0012 e documento de pendências criados; PR de documentação (Draft).

    Tarefas de convergência posteriores (ver `docs/decisions/convergencia-governanca-perfis-pendente.md`),
    a executar com ADR/critério de aceite próprios e sujeitas a MFA/T004:
    - **CG-RBAC** — restringir `admin_tecnico` (fim da auto-cunhagem; uso só de bootstrap; migrar
      operação global standing para `master_tecnico`). Gate: 2026-11-04.
    - **CG-PROV** — runbook nominativo de provisionamento do primeiro `master_tecnico` (MFA, ≥2 contas).
    - **CG-DPO** — depreciar `dpo`/`auditor`; remoção de enum só por expand/contract, sem perder histórico.
    - **CG-DOC** — renomear campos de aprovação documental para nomenclatura neutra (expand/contract).
    - **CG-GOV** — reatribuir gates de privacidade (DP-14/15, DP-3J-09/11, DP-2E-14/15, retenção de
      auditoria, DS-BKP-05) a RH+Jurídico; designação de encarregado é decisão futura do Jurídico.

30. **T032 - Alinhamento documental do repositório, Spec Kit e PRD (somente documentação)**

    - **Objetivo:** alinhar a documentação ao estado integrado real, preservando histórico.
      Rastreabilidade versionada em `docs/`.
    - **Entregue:** README atualizado (stack real, módulos integrados, gates pendentes, RH+Jurídico);
      notas de convergência sobre `admin_tecnico` global (painel-web + 5 módulos); correção do resquício
      "Reserva Fiscal como módulo" em `etapa2-documentos-convergencia.md`; novo
      `docs/decisions/glossario-reserva-fiscal.md` (Reserva Fiscal = empresa, não módulo; T020–T023
      canceladas); nota no ROADMAP separando entregue de gates pendentes (MFA/T004/backup/cofre/runbook/
      retenção-base legal-RIPD).
    - **Fora de escopo:** apps/, schema, migrations, dependências, CI, testes, MFA, Notion; não reescrever
      ADRs (só notas de convergência); não declarar conformidade legal.

31. **T049 - Caderno de homologação da apuração de jornada e banco de horas V1 (somente documentação)**

    - **Objetivo:** transformar os requisitos de jornada e banco de horas já recebidos do RH em casos
      de decisão/teste para uma futura apuração, separando regras decididas, hipóteses e pendências,
      sem implementar, calcular ou inferir resultado não aprovado.
    - **Entregue:** `docs/modules/etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md` —
      classificação decidida/hipótese/pendência (R1–R18, H1–H3, DP-3J-*); tabela de 13 cenários
      sintéticos (CEN-01..CEN-13) com "já pode ser testado" × "depende de decisão"; questões de
      homologação (QH-01/02) ligadas a DP-3J-18; decisões necessárias antes do motor (tolerância,
      três amostras completas, marcos das jornadas 1/2/19, cálculo financeiro DSR/Folha, base
      legal/retenção/gates); 220h/mês como referência de Folha/contrato a validar; recorte da futura
      T050 (motor puro, só dado sintético) × o que continua bloqueado.
    - **Fora de escopo:** código, testes, schema, migration, endpoint, API, UI, parser, importação,
      associação por CPF, persistência, cálculo, banco de horas, DSR, fechamento, espelho, assinatura;
      dados reais; alteração de decisões existentes; declaração de conformidade com a Portaria 671 ou
      interpretação jurídica/trabalhista.
    - **Validação:** Prettier, git diff --check, links relativos verificados. PR de documentação (Draft).
    - **Nota histórica:** este registro nasceu quando `.specify` ainda era local. Desde a convergência
      de 23/09/2026, os artefatos duráveis do Spec Kit são versionados no Git.

## Horizonte atual após a convergência de 29/09/2026

O detalhamento histórico de T050 a T136, incluindo faixas integradas, investigações sem código,
decisões e bloqueios, está no ledger versionado
[`execution-status.md`](execution-status.md). O manifesto legível pela verificação automática está em
[`sync-state.json`](sync-state.json).

32. **T135 - Investigar a funcionalização de Solicitações gerais de Pessoas**

    - **Estado:** investigação concluída; bloqueada corretamente sem código, commit ou PR.
    - **Resultado:** o núcleo de `apps/api/src/solicitacoes/` é TypeScript puro e não possui wiring
      HTTP, persistência Prisma ou RBAC de aplicação. `solicitacoes-documento` e `ajuste_ponto` são
      domínios distintos e não podem ser reutilizados como atalho.
    - **Decisão:** não inventar endpoint, schema, catálogo, estado ou alçada. Preparar pacote humano de
      decisão antes de qualquer fundação de backend.

33. **T136 - Pacote de decisão de Solicitações gerais de Pessoas**

    - **Estado:** integrada em `main` pela PR #129 em 2026-09-29.
    - **Artefatos:** `docs/decisions/pacote-decisao-solicitacoes-pessoas.md` e ADR 0013.
    - **Resultado:** `PD-SOL-01..05` aprovadas; Cloudflare R2 definido como provedor privado futuro,
      sem habilitar conteúdo ou upload.

34. **T137 - Fundação real da Central de Solicitações de Pessoas**

    - **Estado:** não iniciada; identificador histórico substituído pela T139 após a T138 ocupar a
      convergência do Spec Kit.
    - **Resultado:** nenhum código, branch ou PR funcional foi criado sob T137.

35. **T138 - Convergir, versionar e proteger o Spec Kit**

    - **Estado:** integrada em `main` pela PR #130 em 2026-09-29.
    - **Objetivo:** reconciliar Constituição, Spec, Plan e Tasks com o estado integrado até T134, as
      investigações T135/T136 e a política de MFA T131/T132; versionar o scaffold durável e os
      comandos; adicionar um gate de sincronização na CI.
    - **Fora de escopo:** implementar T137, aprovar `PD-SOL-01..05`, alterar regra funcional, schema,
      migration, endpoint, ambiente, segredo, estado da PR #129 ou dado real.
    - **Aceite:** `pnpm spec:check`, Prettier, links/manifesto consistentes, CI verde e revisão somente
      leitura. A PR nasce Draft e não autoriza merge.

36. **T139 - Fundação real da Central de Solicitações de Pessoas**

    - **Estado:** integrada em `main` pela PR #131 em 2026-09-29 (squash `6eaa6f9`). A revisão
      adversarial encontrou uma corrida de transições concorrentes, corrigida na mesma branch com
      `SELECT ... FOR UPDATE` por `id` e `empresa_id` da sessão, antes da integração.
    - **Preparação executada:** `/speckit.specify`, `/speckit.plan` e `/speckit.tasks` em
      `specs/t139-backend-solicitacoes-pessoas/`, antes de qualquer código.
    - **Entregue:** módulo NestJS `solicitacoes-pessoas`; enums, dois modelos Prisma e migration
      aditiva; cinco endpoints (`registrar`, `listar`, `detalhar`, `transicoes`, `historico`); RBAC
      deny-by-default (`solicitacao_pessoa`); CSRF nas mutações; auditoria na mesma transação;
      histórico append-only garantido por privilégio de banco; testes unitários do núcleo, do
      avaliador RBAC e do service, além de E2E com PostgreSQL real.
    - **Reconciliação do núcleo T066 concluída:** catálogo de `PD-SOL-01` (sem `documento`, com
      `atestado` e `beneficios`); `aguardando_informacao → cancelada` removida; ação `reabrir`
      exclusiva do RH de `encaminhada_para_operacao_rh` e `recusada` para `em_revisao_rh`;
      `cancelada` sem saída. Uma única máquina de estados — o service delega ao núcleo. O contrato
      conceitual que originou esse núcleo é o da T065, cujos identificadores foram reusados, não
      recriados (ver `docs/decisions/pacote-decisao-solicitacoes-pessoas.md`).
    - **Limite estrutural registrado:** sem `DP-23` não há ESS; o RH registra em nome do colaborador,
      e a auditoria grava o RH como ator real. Nada foi simulado.
    - **Fora de escopo, preservado:** anexos/upload/R2, correção automática de ponto, efeitos em
      férias, benefícios, cadastro, Banco de Horas, Folha ou fechamento, bloqueio automático de
      fechamento, cronômetro automático de SLA, interface web e dado real.

37. **T140 - Interface web funcional da Central de Solicitações de Pessoas**

    - **Estado:** integrada em `main` pela PR #132 em 2026-09-30 (squash `f2c1014`). A revisão
      adversarial encontrou três bloqueios — vínculo do colaborador anterior sobrevivendo à troca,
      alerta de 404 morrendo junto com o painel e listagem geral exibida sob colaborador escolhido —
      todos corrigidos na própria branch antes da integração.
    - **Preparação executada:** `/speckit.specify`, `/speckit.plan` e `/speckit.tasks` em
      `specs/t140-web-solicitacoes-pessoas/`, antes de qualquer código.
    - **Objetivo:** transformar a aba demonstrativa Pessoas > Solicitações (T091) em interface
      funcional de RH sobre os cinco endpoints reais da T139. Nenhum contrato de backend foi
      alterado; nenhum arquivo de `apps/api/` foi tocado.
    - **Entregue:** cliente HTTP tipado `solicitacoesPessoasClient` (`credentials: "same-origin"`,
      CSRF só nas mutações, nunca repassa corpo de erro do servidor); tela com carregamento, vazio,
      erro com nova tentativa, listagem, filtros, paginação pelo contrato real, detalhe somente
      leitura, histórico cronológico, registro e execução das transições permitidas ao RH; guarda
      determinística contra respostas obsoletas por contador monotônico em cada carregador.
    - **Papéis:** o ator vem de `GET /v1/users/me`, como já fazem T121 e T133 — sem endpoint novo,
      sem sessão paralela e sem Context inédito. Só `rh` muta; `master_tecnico` lê em modo somente
      leitura explícito; `dp`, `gestor` e `colaborador` não recebem ação de mutação. A interface não
      é autoridade de segurança: esconder controle é usabilidade, o servidor decide.
    - **Fora de escopo, preservado:** ESS/MSS e qualquer simulação de `DP-23`; capacidade de RBAC
      para o gestor; anexo, upload, download, preview, assinatura e Cloudflare R2; diagnóstico, CID
      ou descrição clínica; efeito em ponto, férias, cadastro, vínculo, benefícios, Banco de Horas,
      Folha ou fechamento; cronômetro de SLA ou cálculo de prazo no navegador; declaração de
      conformidade legal; roteador de URL, dependência nova e alteração das telas demonstrativas
      T067 e T068.

38. **T141 - Ambiente local de demonstração e guia visual de acompanhamento**

    - **Estado:** **integrada em `main`** pela PR #133 (squash `8e3c15c`), vinda da branch
      `codex/t141-ambiente-demonstracao-local`.
    - **Natureza:** NÃO é capacidade de RH. É forma de olhar o que já existe: nenhum endpoint,
      permissão, estado, regra ou contrato novo, e nenhuma tela de produto alterada.
    - **Entregue:** `pnpm demo:up`, que encadeia PostgreSQL do `docker-compose.yml`, papéis de
      `infra/postgres/`, `prisma migrate deploy`, servidores, bootstrap e seed, com cada passo
      nomeado e falha propagada; seed sintético idempotente (`apps/api/src/seed/`) que cria duas
      empresas de demonstração, estrutura organizacional, horário, colaboradores com um e com dois
      vínculos, e seis perfis de acesso — um por papel que o RBAC distingue; e dois documentos:
      operação do ambiente e guia visual tela a tela.
    - **Prova:** esta máquina não tem Docker, então a garantia não vem de execução manual e sim de
      um E2E com PostgreSQL real (Testcontainers) que roda o seed DUAS vezes, verifica que a segunda
      não cria nada, confere a ausência de duplicatas no banco, autentica cada perfil documentado e
      checa o isolamento entre as duas empresas. Roda na CI a cada push.
    - **Travas de segurança:** o seed exige `EVOLLI_DEMO_SEED="confirmo-ambiente-local"` e recusa
      API ou banco cujo host não seja local. Nenhum segredo real é versionado.
    - **Endurecimento após a revisão somente leitura (mesma branch, sem rebase):** escuta da API
      restrita a `127.0.0.1` por decisão de servidor (`EVOLLI_DEMO_MODE`, validado em
      `env.validation.ts`, recusado em produção); web presa a `127.0.0.1:5173` com porta estrita e
      verificação HTTP antes do "pronto"; encerramento da árvore de processos filhos em qualquer
      falha, Ctrl+C ou sinal; nenhuma credencial em `argv` (as senhas dos papéis vão por stdin do
      `psql`, e o orquestrador recusa argumento não literal sob shell); idempotência do seed por
      varredura completa de páginas, não só a primeira; bootstrap com código de saída dedicado (3)
      para "já existe"; E2E independente de ordem; e CLI do seed fora do artefato de build.
    - **Cobertura nova:** `scripts/demo-local.core.test.mjs` (25 casos, `node --test`, sem
      dependência nova) prova ordem dos passos, parada na primeira falha, limpeza de filhos,
      timeout de API e de web, porta ocupada, endereço permitido, repetição segura, caminho com
      espaço e ausência de segredo em argumento e em log.
    - **Validação operacional real (Windows, Docker Desktop, Node 22 isolado):** os oito passos
      completaram, o seed criou 20 registros na primeira execução, os perfis autenticaram, o
      isolamento entre as duas empresas apareceu na tela e o Ctrl+C encerrou API e web sem deixar
      órfão. A validação encontrou três defeitos, corrigidos em seguida: o `pnpm --filter ... exec`
      normalizava para 1 o código dedicado do bootstrap (toda reexecução abortava no passo 6/8);
      `apps/api/.env.example` trazia `MFA_TOTP_ENCRYPTION_KEY=` vazia, que reprova na validação e
      impedia a API de subir para quem copiasse o arquivo como a documentação manda; e a espera de
      60s pela API não cobria a primeira subida do dia, com o cache de disco frio.
    - **Pendência registrada, não corrigida:** `Pessoas › Histórico funcional` (T115) estoura a
      largura da página em 1280 px e em 375 px. Defeito preexistente, com evidência e medida no
      guia visual; corrigi-lo aqui misturaria escopo.
    - **Fora de escopo, preservado:** MFA, ESS/MSS, anexo, upload, R2, serviço externo, dado real,
      rota de administração exposta no produto, regra de RH nova e alteração de CI.

39. **T142 - Qualidade visual e experiência de uso: diagnóstico e tela-piloto**

    - **Aprovação registrada (visual, do proprietário), 30/09/2026:** "Padrão visual B com modais
      aprovado para o piloto de Colaboradores. Expansão para outras telas condicionada à decisão
      arquitetural sobre o Frappe." Não autoriza merge, produção nem migração.
    - **Condição cumprida em 01/10/2026 (T143, ADR 0014):** o Evolli permanece como plataforma-base
      e o Frappe foi encerrado como candidato. A aprovação visual **continua válida** e a expansão
      passa de "condicionada" a **liberada de forma gradual, tela por tela, com validação visual
      antes de ampliar** — cada tela com identificador próprio. Liberada, não concluída.
    - **Estado:** **direção visual APROVADA** — alternativa B (navegação lateral agrupada,
      densidade confortável, filtros organizados, lista de B) **com modais** no lugar do painel
      lateral e da folha inferior, por escolha explícita do proprietário. A **implementação
      funcional está em validação**: aprovar a direção não aprovou a tela. O primeiro piloto (painel
      contido) havia sido reprovado por não ser proposta, e não foi propagado. **Integrada em
      `main`** pela PR #134 (squash `8c3d8c3`), com a ADR 0014 da T143; a expansão para as demais
      telas está **liberada e ainda não iniciada**.
    - **Decisão registrada em** `docs/decisions/t142-direcao-visual-b-modais.md`. `DESIGN-apple.md`
      NÃO foi editado: é referência externa mantida intacta byte a byte por decisão do projeto
      (T032); as decisões próprias ficam no documento acima e nos tokens/componentes.
    - **Origem:** o proprietário navegou no ambiente local real e relatou falta de organização
      visual, conteúdo fora dos quadros e aparência inconsistente.
    - **Base:** `origin/main` em `f2c1014`. **Não depende** da tarefa do ambiente de demonstração —
      aquele ambiente foi usado apenas como ferramenta de diagnóstico.
    - **Diagnóstico (navegador real, dados sintéticos, 1280 px e 375 px):** dois defeitos de uso com
      causa compartilhada. (1) O botão de criar abre o formulário 301–601 px abaixo da dobra no
      desktop e 678–932 px no celular, sem rolar, sem mover o foco e sem `aria-expanded` — em 5 de 5
      telas funcionais com formulário. (2) A rolagem horizontal da página inteira vem de texto de
      leitor de tela (`position: absolute`) dentro da tabela: como `.evolli-datatable` não é bloco
      contêiner posicionado, esse texto ancora no bloco contêiner inicial e escapa do
      `overflow-x: auto`. Provado em execução: escondê-lo zera o excesso; `position: relative` no
      contêiner também zera.
    - **Piloto:** `Pessoas › Colaboradores`, escolhida por reunir tabela, filtros, formulário e
      detalhe na mesma tela e por ser o pior caso do defeito (1).
    - **Fora de escopo até a aprovação:** correção compartilhada em `DataTable.css`, demais telas,
      novas convenções visuais e qualquer dependência nova.
    - **Apoio externo (consultivo, não normativo):** skill `ui-ux-pro-max`
      (`github.com/nextlevelbuilder/ui-ux-pro-max-skill`, MIT, versão 2.13.0, commit fixado
      `09170eec67eefd46a7ae85de61b40c194020f997`). Instalada **localmente e fora do versionamento**
      em `.claude/skills/ui-ux-pro-max/` da worktree, copiada do tarball do commit fixado — o
      instalador oficial (`npx ui-ux-pro-max-cli init`) **não** foi executado, para não rodar código
      de terceiros nem sobrescrever configuração. Nenhuma dependência da aplicação foi alterada e
      nenhuma skill existente foi substituída. Requisito próprio: Python 3 (presente, 3.14.7).
    - **Fonte de verdade de design continua sendo o projeto:** `DESIGN-apple.md`, `app/tokens.css` e
      `src/components/`. A skill foi usada como checklist consultivo; cada sugestão foi avaliada
      contra esses documentos, e nada dela foi copiado como regra. Nenhuma fonte, biblioteca, efeito
      ou framework externo entrou.
    - **O que a skill acrescentou ao piloto:** confirmação de escrita após admitir (`role="status"`,
      antes a admissão fechava o formulário em silêncio); manutenção do anel de foco no título do
      painel (eu havia suprimido — é antipadrão de acessibilidade de prioridade 1); e o vão vazio de
      ~256 px dentro do painel, causado por reaproveitar uma classe com `flex-grow` pensada para o
      banner de aviso.
    - **Investigação do formulário de admissão (a pedido do proprietário):** confrontada com o
      contrato real. O backend aceita seis referências organizacionais independentes e exige **ao
      menos uma**; `cargoId` está entre elas, então cargo sozinho **é** suficiente. Reproduzido no
      navegador com admissão sintética: o DTO enviado foi `{…, cargoId}` e o servidor aceitou.
      **Não há defeito funcional.** O defeito é de apresentação e foi medido: com o tipo escolhido e
      o registro vazio, o seletor de TIPO (já preenchido) recebia `aria-invalid=true` e a mensagem,
      enquanto o campo realmente vazio ficava sem marcação; e "Cargo" aparecia duas vezes, uma como
      valor da categoria e outra como rótulo mutável do registro. Corrigido com rótulos permanentes
      que separam categoria de registro e erro associado ao campo que precisa ser preenchido, com
      três testes de regressão.
    - **Duas propostas visuais (aguardando escolha):** A — corporativa compacta (navegação em faixa
      superior, densidade alta, detalhe expandindo na própria linha, formulário em duas colunas);
      B — corporativa espaçada (navegação em coluna lateral, densidade confortável, detalhe e
      formulário em painel lateral ao lado da lista, folha inferior no celular). Protótipos
      **estáticos**, sem API e sem gravação, servidos em porta própria.
    - **Diretrizes de design:** nenhuma alteração proposta ainda. Os protótipos usam apenas os
      tokens já existentes, copiados de `tokens.css`. Se a alternativa B for escolhida, a navegação
      em coluna lateral é a única convenção nova a registrar em `DESIGN-apple.md`.
    - **Implementação do piloto (em validação):** componente `Modal` novo (UI-F04) concentrando
      acessibilidade e comportamento de janela — `role="dialog"`, `aria-modal`, foco inicial, foco
      preso, devolução do foco, Escape seguro, fundo sem rolagem, confirmação de descarte dentro da
      própria janela e rolagem só no corpo. Cadastro e detalhe de Colaboradores passaram a abrir
      nele; formulário em duas colunas no desktop e uma no celular, onde a janela ocupa a tela
      inteira. Navegação agrupada em Operação/Consulta/Administração, sem mudar destino nem ordem.
    - **Defeito achado na própria validação e corrigido:** o `disabled` do botão de envio não
      impedia duplicação — medido no navegador, três cliques geravam três requisições, porque o
      estado só chega no render seguinte. Trava síncrona por ref; reverificado: quatro cliques, uma
      requisição.
    - **Preservado:** contratos HTTP, regras, permissões e comportamento funcional; a separação
      entre tipo e registro da referência organizacional; nenhuma tela além da piloto foi alterada.

40. **T143 - Investigação arquitetural: o Frappe HR como possível plataforma-base**

    - **Estado:** **investigada — concluída.** Nenhum código funcional do Evolli foi alterado, e
      nada foi migrado nem copiado. A investigação consumiu duas rodadas em ambiente descartável,
      fora deste repositório, sempre com dados sintéticos.
    - **Decisão do proprietário, 01/10/2026:** "Evolli permanece como plataforma-base. O Frappe HR
      está encerrado como candidato à plataforma e poderá ser usado somente como referência de
      fluxos, portal, aprovações e experiência funcional. O padrão visual B + modais está liberado
      para evolução controlada no Evolli." Registrada na **ADR 0014**
      (`docs/adr/0014-evolli-plataforma-base-e-encerramento-do-frappe.md`).
    - **Versões examinadas:** Frappe Framework 16.35.0 (MIT), ERPNext 16.36.0 (GPL-3.0) e Frappe HR
      16.20.0 (GPL-3.0, tag `v16.20.0` = `c0a04b80eeb7214…d0da041`); construção pelo `frappe_docker`
      em `f09126b`. Base do Evolli na comparação: `origin/main` em `f2c1014`.
    - **Evidência determinante:** uma conta com vários vínculos exige **extensão relevante**. A
      regra de "Employee único por conta" aparece em diversos pontos do HRMS e do ERPNext; no
      protótipo descartável, 10 de 58 tipos de registro ficaram com contexto de vínculo e 48 não;
      relatórios, compartilhamentos, notificações e cinco endpoints do portal ainda exigiriam
      adaptação. Isolamento de queixas e autoaprovação são corrigíveis — o primeiro por configuração
      mais extensão pequena, o segundo só por configuração — mas não resolvem o ponto estrutural.
      Estimativa medida para o mesmo escopo de piloto sobre o Frappe: **≈ 30–50 dias**.
    - **Limite da conclusão:** a decisão **não** afirma que o Frappe é inseguro ou inadequado em
      geral. Ela afirma que o custo de adaptação ao modelo do Evolli não compensa neste projeto.
    - **Licenciamento:** proibido copiar ou adaptar código GPL (ERPNext e HRMS) sem análise
      específica de licença, feita antes de qualquer entrada no repositório.
    - **Evidências:** relatório, resultados JSON, capturas e verificações independentes ficam em
      `C:/MB/Sistema RH/frappe-prova/` (fora do repositório, por tamanho e por conter ambiente de
      execução). Nada de lá foi versionado.
    - **Efeito registrado:** a condição "expansão condicionada à decisão sobre o Frappe" da T142 sai
      e dá lugar a **expansão liberada de forma gradual, tela por tela, com validação visual antes
      de ampliar**. Liberada, não concluída.

41. **T144 - Hardening do Modal e convergência do Spec Kit**

    - **Origem:** as revisões somente leitura da T142 deixaram quatro pendências classificadas como
      não bloqueantes (R1, R2, R3 e O1), e o proprietário as fixou como **pré-condição da expansão
      visual** — nenhuma outra tela recebe o padrão B + modais antes delas. Soma-se a convergência
      do ledger, que vinha derrubando a CI de `main`.
    - **Estado:** **integrada em `main`** pela PR #135 (squash `0699e3d`), vinda da branch
      `codex/t144-hardening-modal-spec-kit`. Não altera direção visual aprovada, contratos HTTP,
      regras, permissões nem a regra do verificador do Spec Kit.
    - **R1 — descarte silencioso no detalhe de Colaboradores.** O `Modal` de detalhe não recebia
      `alterado` nem `bloqueado`: editar o nome e fechar descartava sem aviso, contra a própria
      regra aprovada da T142 ("com alterações não salvas abre confirmação explícita dentro da
      janela"). Um único derivado, `detalheNomeAlterado`, passou a governar a confirmação **e** o
      botão de salvar — se divergissem, a janela fecharia calada com o botão ainda habilitado.
      Durante a retificação a janela fica bloqueada; depois de salvar, o nome gravado passa a ser o
      nome em edição e o estado deixa de ser alterado sozinho.
    - **R2 — `alertdialog` sem nome acessível e sem foco.** A confirmação de descarte não tinha nome
      acessível e não recebia foco: `alertdialog` não tem região viva implícita, então quem usa
      leitor de tela não ficava sabendo que a pergunta existia, e podia concluir que o Escape havia
      falhado. Agora é nomeada pelo próprio texto, recebe o foco ao aparecer e devolve o foco a quem
      o tinha quando se escolhe continuar editando — por botão ou por Escape.
    - **Contenção de foco na confirmação (achado da revisão da PR #135).** A confirmação
      declarava `aria-modal`, mas o `Tab` continuava circulando pela caixa inteira e alcançava os
      campos atrás dela — a mesma classe de defeito do R3, uma afirmação na árvore de
      acessibilidade que o comportamento não sustentava. Enquanto a confirmação está aberta, o
      escopo do `Tab` e do `Shift+Tab` passa a ser **só** o `alertdialog` ("Continuar editando" ↔
      "Descartar alterações"); o foco abre direto na ação segura; o `Escape` e "Continuar
      editando" fecham só a confirmação e devolvem o foco ao elemento anterior; e a referência
      guardada desse elemento é descartada ao concluir a confirmação e ao fechar a janela.
    - **R3 — JSDoc inexato.** O comentário do `Modal` prometia `inert`, que nunca existiu no código.
      Investigado: o fundo **não** estava alcançável — a camada fixa absorve os cliques, o `Tab` é
      preso e `aria-modal` limita o leitor de tela. Era documentação errada, não defeito; o texto
      passou a descrever os três mecanismos reais.
    - **O1 — redação sobre a ordem da navegação.** O agrupamento da T142 dizia não mudar a ordem,
      mas "Solicitações" subiu de 7º para 6º e "Portal do Colaborador" desceu de 6º para 7º, por
      caírem em grupos diferentes. Sem impacto funcional: os nove destinos continuam presentes e
      nenhuma permissão mudou. Corrigido o texto nos dois lugares que o afirmavam.
    - **Convergência do ledger (T032, T065, T066).** `pnpm spec:check` procura cada identificador
      citado na mudança por **texto literal** no ledger; uma faixa como "T001 a T049" não satisfaz.
      Em Pull Request o contexto é só o título, mas no push para `main` é a mensagem inteira do
      commit de squash — por isso a CI de `main` falhou em três pushes seguidos (T065 e T066 na
      T139, T066 na T140, T032 na T142) sem nada de errado no código. Os três passaram a ser
      nomeados nas faixas que já os cobriam, e a armadilha ficou registrada no próprio ledger. **A
      regra do verificador não foi alterada.**
    - **Testes: 20 acrescentados** (12 na entrega original e 8 na correção da contenção de foco),
      mais 1 teste existente da própria T144 reescrito para o novo foco inicial. Na entrega
      original, 7 dos 12 falhavam em `main` em `8c3d8c3` e 5 eram guarda de regressão que passa
      lá também — a descrição da PR dizia "7 novos", o que era impreciso. Na correção, os 8 novos
      mais o reescrito (9 no total) falham no `Modal` de `678b5e3` e passam no atual. Cobrem
      confirmação por botão e por Escape, preservação do texto digitado, devolução do foco,
      descarte sem gravar, bloqueio durante o salvamento, fim do estado alterado após salvar, nome
      acessível do `alertdialog`, foco inicial, ciclo de `Tab` e `Shift+Tab` e nada atrás da
      confirmação recebendo foco.
    - **Fora de escopo:** PR #133 e a branch da T141 não foram tocadas; a expansão visual não foi
      iniciada; as observações O2–O5 das revisões continuam registradas, sem correção.

42. **T145 - Hardening pós-T141: prazo de parede nas esperas e convergência do Spec Kit**

    - **Origem:** a revisão final da PR #133 registrou duas ressalvas não bloqueantes que entraram
      em `main` sem correção. Esta tarefa quita exatamente essas duas, e nada mais.
    - **Estado:** **integrada em `main`** pela PR #136 (squash `bbb7942`), vinda da branch
      `codex/t145-hardening-demo-timeouts`. Base original: `main` em `8e3c15c`.
    - **Ressalva 1 — Spec Kit autocontraditório.** `tasks.md` dava T141 e T144 como "PR Draft,
      aguardando revisão" enquanto o ledger já dava a T144 como Integrada. Ambas estão em `main`
      (T144 pela PR #135, squash `0699e3d`; T141 pela PR #133, squash `8e3c15c`) e passam a ser
      registradas assim nos dois artefatos. É registro do estado terminal real, não reabertura.
    - **Ressalva 2 — prazo declarado não era o prazo real.** Os laços de espera contavam
      ITERAÇÕES, não segundos: cada volta gastava até 3s na requisição mais 1s de intervalo, então
      "180s" valiam até 720s, "90s" até 360s e a janela de 10s do passo 8/8 até 39s — e a mensagem
      de falha anunciava o prazo menor. Agora o orçamento é tempo de parede, lido do relógio a
      cada volta: a tentativa recebe `min(timeout, o que resta)`, o intervalo sai do mesmo
      orçamento, nenhuma tentativa nova começa sem orçamento, a morte do processo segue
      interrompendo na hora, e um teto de voltas impede que um relógio parado vire espera infinita.
      `esperar`, `confirmarProntoWeb` e o laço do `pg_isready` compartilham um só `aguardarComPrazo`.
    - **Relógio monotônico.** O relógio entra por injeção (`deps.agora`) e o padrão é
      `performance.now()`: `Date.now()` pode recuar num ajuste de NTP e esticar ou encurtar uma
      espera de 180s já em curso.
    - **Tolerância do passo 8/8 recalibrada.** `SEGUNDOS_CONFIRMACAO_FINAL_WEB` passa de 10 para 30. O número mudou de unidade, não de intenção: o Vite frio aceita a conexão e a segura
      enquanto transforma o módulo, então cada tentativa custava o timeout inteiro e as 10 voltas
      antigas davam até 39s de tolerância real. Mantido em 10, o prazo de parede reprovaria
      ambiente que antes subia.
    - **Testes:** relógio virtual no `cenario()` — `dormir` avança o tempo pedido e cada tentativa
      HTTP cobra `min(custo, timeout recebido)`. 8 testes novos cobrem resposta no prazo,
      requisição lenta consumindo o orçamento, prazo esgotado, processo morto durante a espera,
      ausência de tentativa ou espera após o prazo, encurtamento da última tentativa, relógio
      parado e a prova de que uma janela curta não se multiplica pelo timeout individual. Uma
      asserção existente mudou de 9 para 10 ticks, pela mudança de semântica. 48/48 passam.
    - **Fora de escopo:** API, web, Prisma, migrations, seed, dados sintéticos, credenciais,
      dependências e lockfile intactos; nenhuma tela recebeu o padrão B + modais; nenhuma outra
      branch ou PR foi tocada. O teste-guarda "sucesso não mata nenhum processo" foi mantido.

43. **T146 - Arquitetura modular e protótipo navegável do shell**

    - **Origem:** a prova do Frappe HR (T143) mostrou maturidade de **arquitetura da informação** —
      workspace por módulo, agrupamento da navegação, atalhos, listas com filtros e fila de
      pendências — que o Evolli ainda não organizou. A ADR 0014 manteve o Evolli como
      plataforma-base e liberou o Frappe **só como referência conceitual**.
    - **Estado:** **Integrada** em `main` pela PR #137 (squash `2e55837`), com a CI de `main`
      verde. A fundação visual foi aprovada e congelada pelo proprietário antes da integração.
      **Nunca funcional**: entregou apenas documentação e protótipo estático. Base: `main` em
      `bbb7942`.
    - **Decisão do proprietário:** _"Aprovo a evolução visual da T146, porém devemos focar agora na
      entrega dos módulos funcionais e testados, deixando o acabamento visual final para o fim."_
      Shell, tokens, padrão B, sidebar e modais ficam aprovados como fundação visual e
      **congelados**: só correção necessária de usabilidade, acessibilidade, responsividade ou
      bloqueio operacional pode tocá-los antes do acabamento final. Prioridade passa a ser entregar
      módulos funcionais, testados e homologáveis com dados sintéticos; nenhuma aparência de
      protótipo é prova de capacidade funcional. Detalhe completo em
      `docs/decisions/t146-arquitetura-modular-shell.md`.
    - **Natureza:** NÃO é capacidade de RH. Nenhum endpoint, permissão, regra, contrato ou tela
      funcional foi criado ou alterado. O protótipo não fala com a API, não grava nada e se
      identifica permanentemente como sintético.
    - **Mapa modular:** Início; Pessoas; Jornada; Ausências; Solicitações; Benefícios; Clima e
      desenvolvimento; Relatórios; Administração. Folha, eSocial e obrigações fiscais ficam numa
      seção de evolução futura, **fora da navegação operacional**, para não serem lidos como
      capacidade existente.
    - **Inventário real (derivado do código nesta tarefa, não reaproveitado):** 45 telas folha —
      **11 funcionais**, **1 parcial** (`Pessoas › Dados contratuais`, consulta sem escrita) e
      **33 demonstrativas**. Módulos do mapa sem tela aparecem como **planejados**.
    - **Referência ao Frappe:** somente conceitos de arquitetura da informação. Nenhum código,
      HTML, CSS, componente, texto, ícone, imagem ou ativo copiado; nenhuma dependência; a decisão
      de plataforma não foi reaberta.
    - **Padrão visual:** tokens, padrão B e regras de modal do Evolli preservados;
      `DESIGN-apple.md` intocado; nenhuma paleta, fonte, raio ou escala nova; nenhuma dependência,
      framework, CDN ou fonte externa.
    - **Fora de escopo:** expansão do padrão para outro módulo; folha, eSocial, férias, benefícios
      e clima; `apps/api`, Prisma, migrations, contratos, RBAC e dados; telas funcionais de
      `apps/web`.

44. **T147 - Homologação funcional de Admissão e vida funcional inicial**

    - **Origem:** com a fundação visual congelada (T146) e a decisão do proprietário de priorizar
      módulos funcionais, a primeira fatia é **homologar** o fluxo que já existe em código — a
      admissão — provando que ela funciona de ponta a ponta com dado sintético, em vez de criar
      capacidade nova.
    - **Estado:** **Integrada** em `main` pela PR #138 (squash `1d7531c`), com a CI de `main`
      verde. Base: `main` em `2e55837`.
    - **Natureza:** endurecimento e homologação sobre contratos existentes. Não inventa
      funcionalidade sem contrato real e não amplia o redesenho visual.
    - **Cenário de aceite:** RH abre `Pessoas › Colaboradores`, registra uma admissão em modal com
      referência organizacional inicial válida, e o registro aparece coerente em **Colaboradores**,
      **Dados contratuais** e **Histórico funcional**, sem recarregar a página inteira.
    - **Segurança provada por teste:** CSRF em toda mutação, `credentials: same-origin`, escopo
      derivado da sessão, isolamento entre empresas, 404 indistinguível entre inexistente e fora de
      escopo, RBAC pelo avaliador real, auditoria com ator real e sem PII.
    - **Identificador reutilizado:** uma investigação anterior de importação de marcações de ponto
      parou no gate técnico sem gerar branch, commit ou alteração de Spec Kit; não é entrega e não
      ocupa o identificador. A importação AFD segue bloqueada pela ADR 0008 (decisão 4) e pelas
      pendências `DP-3J-07`, `DP-3J-20`, `DP-3J-09`, `DP-3J-11` e `DS-OPS-01`.
    - **Fora de escopo:** importação de ponto/AFD, REP, banco de horas, férias, benefícios, clima,
      dependentes, folha, eSocial, obrigações fiscais, R2/anexos, MFA, ESS/MSS, mudança de
      arquitetura visual e cópia de código ou ativo do Frappe.

45. **T148 - Convergência da T147 e fundação segura da integração de registros de ponto**

    - **Origem:** com a admissão homologada e integrada (T147), a pergunta seguinte é como o Evolli
      passa a **receber registros de ponto** do sistema em uso. A T148 não parte do pressuposto de
      que isso é implementável: ela converge o Spec Kit, atualiza o ambiente de demonstração e
      submete a integração a um gate de contrato.
    - **Estado:** **pacote de decisão entregue — sem código**, na branch
      `codex/t148-integracao-registros-ponto`; PR Draft para `main`. Base: `main` em `1d7531c`.
    - **Regra de implementação:** só há código se os contratos existentes definirem, **sem
      invenção**, origem, formato, autenticação, idempotência, relação com empresa/colaborador/
      vínculo, comportamento de duplicatas, preservação da marcação original, auditoria e resposta
      a erro/reprocessamento. Com qualquer item essencial aberto, o resultado é um **pacote de
      decisão** — nenhum endpoint, schema ou regra provisória.
    - **Resultado:** a investigação exaustiva (sete eixos: código de ponto, Prisma, governança,
      origem/formato, segurança de integração, testes E2E, comparação de canais) confirmou que
      faltam, sem invenção possível, a chave de idempotência da marcação (o único `@@unique` de
      `evento_ponto` é `(id, empresaId)`, inútil para deduplicar) e qualquer mecanismo de
      autenticação para um ator não humano (`registrado_por_user_id` é obrigatório e humano; o
      `CsrfGuard` exige sessão). A origem automatizada segue proibida pela ADR 0008, decisão 4.
      Entregue [`docs/decisions/pacote-decisao-integracao-registros-ponto.md`](../docs/decisions/pacote-decisao-integracao-registros-ponto.md)
      com as decisões pendentes, as opções elegíveis, a comparação de canais e as perguntas ao
      fornecedor — **nenhum endpoint, schema, migration ou regra foi criado**.
    - **Comparação de canais exigida:** polling/REST, webhook HTTP, importação de arquivo e
      WebSocket, decididos pelo fluxo real. Registro histórico e durável pede entrega idempotente e
      reprocessável; tempo real pode ser atualização de tela, não o canal oficial de persistência.
      Nenhum dos quatro tem contrato de autenticação ou idempotência definido hoje — a lacuna é
      comum aos quatro, não específica de um canal.
    - **Fora de escopo:** folha, banco de horas, adicional noturno, DSR, fechamento, transmissão
      fiscal, REP-P, PAdES, AEJ e integração externa real sem contrato e autorização próprios —
      nenhum foi tocado, porque nenhum código foi escrito.

46. **T149 - Correção do falso positivo do verificador do Spec Kit e convergência da T148**
    - **Estado:** **Integrada** (PR #140, squash `078fde5`). Branch
      `codex/t149-hardening-spec-check`, a partir do squash
      `9521e324188d8b1ef1a1ca3db662b889738aadc2` (T148, PR #139).
    - **Pré-condição:** a T148 entrou em `main` pela PR #139, mas a CI de `main` ficou vermelha no
      passo _Verificar sincronização do Spec Kit_ — duas referências históricas ao parser AFD,
      citadas em prosa na mensagem do squash, não constavam de `execution-status.md`. Os outros
      dois jobs passaram.
    - **Causa raiz:** dois defeitos somados em `scripts/check-spec-kit-sync.mjs`. (1) **Escopo** —
      `ci.yml:34` passa o título em Pull Request e a **mensagem inteira do squash** no push para
      `main`, então prosa narrativa virava exigência de registro; é por isso que a PR passou 3/3 e
      o mesmo conteúdo reprovou no push. (2) **Busca** — extração com `\b`, mas verificação com
      `String.includes` (substring): numa faixa `T104–T109` os extremos passavam por acidente e o
      miolo nunca passava. Medido **sobre a base `9521e32`**, estado em que a CI quebrou:
      **118 dos 149 identificadores reprovariam se citados**.
    - **Quarta ocorrência.** T065/T066 na T139, T066 na T140, T032 na T142 e, na T148, duas
      referências históricas ao parser AFD. A T144 curou os três primeiros nomeando-os no ledger e
      registrou três vezes que **a regra não seria alterada**. A T149 reverte essa decisão, com
      autorização explícita do proprietário, porque o defeito está no gerador e não nos
      identificadores.
    - **Regra nova:** as tarefas entregues passam a ser a janela `(lastIntegratedTask,
lastRecordedTask]` declarada em `sync-state.json` — lida, não inferida a partir de texto
      livre — e continuam obrigatórias nos dois artefatos. Identificadores citados no contexto só
      reprovam quando são **futuros** (`> lastRecordedTask`), isto é, trabalho citado sem registro.
      A cobertura expande faixas e casa por fronteira de palavra, ficando **mais estrita** que
      `includes`. Contexto ausente ou vazio é **fail-closed** — fecha o no-op silencioso que o
      `workflow_dispatch` produzia.
    - **Nada de whitelist.** As duas referências históricas ao parser AFD **não** ganharam entrada
      autônoma no ledger, nem whitelist, nem mecanismo de compatibilidade, e nenhuma mensagem de
      commit já integrada foi reescrita. A prosa desta entrada evita nomeá-las para não registrá-las
      como efeito colateral da própria explicação; os identificadores vivem onde devem, na fixture
      de regressão do teste.
    - **Testes:** `scripts/spec-kit-sync.core.test.mjs`, os primeiros do verificador em todo o
      projeto. Reproduz literalmente a mensagem do squash `9521e32`; o caso `1b` reimplementa a
      regra anterior e prova que ela reprovava as duas referências históricas no mesmo texto em que
      a nova passa. Cobre tarefa entregue ausente, ausente em só um artefato (nomeando qual),
      referência histórica não registrada, contexto de PR, contexto de push, contexto ausente/vazio
      e duas tarefas na mesma janela.
    - **Estado malformado é fail-closed (B1).** A primeira versão desta tarefa derivava a janela sem
      validar nada: com `lastRecordedTask` ausente, `NaN`, `Infinity`, decimal, string não numérica
      ou o próprio estado nulo, `tarefasEntregues` devolvia `[]` e `numero > NaN` era sempre falso —
      **os dois braços do gate desligavam** e o verificador aprovava até com os dois artefatos
      vazios. `validarEstado` é agora a validação única, aplicada pelo núcleo e pelo CLI: exige os
      dois campos, inteiros seguros e não negativos, com `lastIntegratedTask <= lastRecordedTask`;
      nomeia o campo recusado sem ecoar conteúdo nem stack; e encerra o CLI com código não zero.
      Doze testes cobrem os casos, e o CLI deixou de derrubar o processo diante de manifest ou
      artefato de governança ilegível.
    - **Limitações conhecidas, não tratadas:** identificador em caixa baixa (`t151`) e caracteres
      zero-width entre as letras escapam da detecção de tarefa futura. Valem para a regra anterior
      também; nenhuma das duas é regressão.
    - **Convergência:** T148 registrada como **Integrada** (PR #139, squash `9521e32`),
      `lastIntegratedTask: 148`, `lastRecordedTask: 149`, T148 fora de `openDeliveries`.
    - **Dívida registrada, não tratada aqui:** o seed de demonstração é idempotente por existência
      e **não converge atributos declarados de registros sintéticos preexistentes** — caso
      conhecido `DEMO-A-0001` e `cargoId`, cuja alocação vigente ficou sem cargo. Precisa de tarefa
      própria.
    - **Fora de escopo:** código funcional de RH, banco, seed, Prisma, migrations, integração de
      ponto, autenticação, auditoria, RBAC e qualquer decisão do pacote da T148 — nenhum tocado.

47. **T150 - Gestor consultivo: investigação do escopo e pacote de decisão (`DP-8`)**
    - **Estado:** **Integrada** (PR #141, squash `ba80157`). Branch
      `codex/t150-gestor-consultivo`, a partir do squash
      `078fde5702a6a776d1f9b87e834d96fff4f6a8ba` (T149, PR #140).
    - **Desfecho:** o pacote foi **APROVADO** pelo proprietário em 06/10/2026 e formalizado na
      ADR 0015 pela T151.
    - **Regra de implementação:** só há código se já existir contrato **seguro e inequívoco** para
      determinar a equipe do gestor. É proibido derivar subordinação de cargo, nome, papel, e-mail,
      empresa inteira ou heurística de lotação. Sem o contrato, o resultado é **pacote de decisão**.
    - **Resultado: o gate reprovou.** Faltam três elos independentes, cada um ausente por decisão
      registrada: (1) nenhuma relação gestor/subordinado existe, nem estruturalmente — ADR 0006
      decisão 8, reafirmada nas ADRs 0007, 0008 e 0010 e em dois comentários do schema, com zero
      campos de liderança em todo o modelo e em todas as migrations; (2) nenhum vínculo
      `AccessUser` ↔ `Colaborador` (`DP-23`), de modo que o sistema não sabe qual pessoa é o gestor
      autenticado; (3) estrutura organizacional **não é fronteira de autorização** — `empresaId` é a
      única, e a ADR 0006 antecipou literalmente este caso, exigindo ADR nova ou emenda formal com
      migration própria.
    - **O código já recusava pelo mesmo motivo:** o avaliador RBAC nega o `gestor` em seis ramos,
      nominalmente. O RBAC contém **seis testes cujo título nomeia explicitamente o gestor em
      cenários de negação** — um deles em um `describe` chamado
      `"gestor: negado enquanto DP-8 nao for decidida"` — além de casos parametrizados que o
      incluem em listas de papéis negados. **Não há concessão de capacidade ao gestor**: nenhum
      ramo `case "gestor"` concessivo existe em `apps/api/src`.
    - **Campo que parece resolver e não resolve:** `AccessUser.unit_id`/`team_id` são `TEXT` sem FK,
      aceitos por `@IsString()` sem validação contra a empresa, ausentes do `AuthorizationSubject`
      e sem semântica definida. Usá-los seria inventar a relação e abrir vazamento entre empresas.
      A ausência de FK é original e deliberada — ADR 0003 decisão 8 a condicionou a _"até a Etapa 1
      criar essas entidades de fato"_. A condição já se cumpriu (T104–T109), mas **a FK nunca foi
      adicionada**: dívida de integridade referencial preexistente, registrada e não tratada aqui.
    - **Fato novo registrado:** a ADR 0006 condicionou responder `P8.2` a _"quando a entidade
      colaborador existir"_. **A pré-condição foi satisfeita** pelas T104–T117 e T147 — `DP-8` não
      está mais bloqueada por ausência de modelo, só por decisão de negócio.
    - **Entrega:** [`docs/decisions/pacote-decisao-escopo-do-gestor.md`](../docs/decisions/pacote-decisao-escopo-do-gestor.md),
      reusando `DP-8` e `P8.2` em vez de criar identificadores novos — opções de modelagem,
      recomendação marcada como não aprovada, perguntas para RH/Produto, impacto sobre schema,
      RBAC, auditoria, seed e interface, e critérios de aceite de uma tarefa futura.
    - **Convergência:** T149 registrada como **Integrada** (PR #140, squash `078fde5`), com a CI de
      `main` 3/3 verde no primeiro push de squash depois da correção do verificador.
    - **Limpeza factual:** corrigido o resíduo editorial da entrada 46, que afirmava evitar os
      identificadores históricos do parser AFD enquanto ainda os nomeava. A regra do verificador
      **não** foi alterada.
    - **Mantidas registradas, não corrigidas aqui:** dívida de convergência do seed
      (`DEMO-A-0001`/`cargoId`); limitações de caixa baixa e zero-width no verificador; decisões
      pendentes da integração de ponto (pacote da T148).
    - **Fora de escopo:** nenhum endpoint, controller, model Prisma, migration, regra de RBAC, ação
      de auditoria, alteração de seed ou tela; nenhuma negação vigente afrouxada.

48. **T151 - Formalização e fundação segura do Gestor consultivo (ADR 0015)**
    - **Estado:** **Integrada** em `main` pela PR #142, squash
      `a356418abb34568cf7cdde20348c1cf042a5828f`. Branch
      `codex/t151-fundacao-gestor-consultivo`, a partir do squash
      `ba8015763188e575c97bd2bb088765ac5cd38ae8` (T150, PR #141).
    - **Decisão aprovada, literalmente (06/10/2026):** _"Aprovo as recomendações 1 a 9 para o
      escopo do gestor e DP-23"_. Formalizada na
      [ADR 0015](../docs/adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md).
    - **`DP-8` e `DP-23` RESOLVIDAS** — e somente no recorte aprovado. Gestão matricial permanente,
      departamento inteiro e empresa inteira **continuam não aprovados**.
    - **Modelagem:** três tabelas (`access_user_colaborador`, `atribuicao_gestor_equipe`,
      `excecao_acesso_gestor`) com as invariantes no **banco**: FK composta por empresa, EXCLUSION
      CONSTRAINT sobre `daterange` (inclusive `(equipe, papel, período)`, que permite principal e
      substituto sem admitir dois principais), índices parciais únicos como complemento para 409
      estável, CHECK de intervalo e de justificativa não vazia, e CONSTRAINT TRIGGERS de duas portas
      para o que atravessa tabelas. Provadas contra PostgreSQL real antes do código de aplicação.
    - **RBAC:** dois recursos próprios — `gestor_atribuicao` (administração pelo RH; o gestor é
      negado, pois quem define o escopo não pode ser quem é escopado por ele) e `gestor_equipe`
      (consulta, somente `read`). Primeira capacidade concedida ao papel `gestor` no produto;
      nenhuma negação anterior foi afrouxada, e há teste que prova isso recurso a recurso.
    - **Escopo nunca cai para "tudo":** sessão → ligação conta-pessoa → atribuição vigente →
      alocação vigente. Falha em qualquer passo produz **lista vazia**, com retorno antes da
      consulta — o fallback para a empresa inteira é impossível por construção.
    - **Fora desta entrega, por ausência de contrato seguro:** resumo de jornada (não existe como
      dado nem rota; `DP-3J-12` pendente) e andamento de solicitações (`tipo`/`motivo` revelam
      condição de saúde por inferência; `PD-SOL-05` só autoriza "informação operacional mínima",
      não definida). Ambos para a **T152**.
    - **Limites:** sem interface web, sem redesenho, sem integração de ponto, sem gestão matricial,
      sem departamento ou empresa inteiros, sem folha/eSocial/benefícios/documentos.
    - **Dívidas mantidas, não tratadas:** FK de `unit_id`/`team_id` (ADR 0003, nunca adicionada);
      convergência de atributos do seed (`DEMO-A-0001`/`cargoId`); caixa baixa e zero-width no
      verificador; decisões do pacote de integração de ponto (T148).

49. **T152 - Hardening do verificador do Spec Kit: declaração de entrega vs. citação**
    - **Estado:** **Integrada** em `main` pela PR #143, squash
      `3f73f4ed0e690fe9d020468bba40388be2e6f8f9`, com a CI de `main` 3/3 verde — a primeira vez
      nesta linha de trabalho em que o push para `main` passa no `spec:check` sob o protocolo de
      trailers. Branch `codex/t152-hardening-spec-kit-squash`, a partir do squash
      `a356418abb34568cf7cdde20348c1cf042a5828f` (T151, PR #142).
    - **Escopo:** exclusivamente o verificador e a recuperação da CI de `main`. O módulo funcional
      antes cogitado para a T152 — **resumo de jornada** (`DP-3J-12`) e **andamento de
      solicitações** (`PD-SOL-05`) — **não foi iniciado** e segue sem contrato seguro.
    - **Causa, provada por reprodução.** O workflow injeta
      `github.event.pull_request.title || github.event.head_commit.message`. Em Pull Request isso é
      **uma linha**; no push para `main` é a **mensagem inteira** do squash — 348 linhas no caso da
      T151. A regra (b) da T149 varria todo o texto atrás de identificador futuro, e o corpo do
      squash menciona a T152 justamente para dizer que ela **não foi iniciada**. O fallback local do
      próprio CLI usa `git log -1 --pretty=%s`, só o assunto: o mesmo commit recebia **três
      vereditos** — passava no PR, passava local e reprovava no push.
    - **Regra por posição, tentada e descartada.** A primeira versão tratava a "primeira linha com
      identificador" como declaração. A revisão adversarial derrubou com um caso que não exige
      má-fé: primeira linha cita `T151` (histórico), linha posterior entrega `T153`, ledger em
      `T152` — e passava. Citar a tarefa anterior no assunto é padrão aqui
      (`T145 — Hardening pós-T141`), então o bypass estava a um commit de distância. Posição é
      determinística, mas não é declaração: "fica para a T153" e "entrega a T153" ocupam a mesma
      posição e têm sentidos opostos.
    - **Protocolo estruturado, que a substituiu.** O autor declara, em trailer auditável:
      `Spec-Kit-Entrega: T###` e `Spec-Kit-Nao-Entrega: T###`. Quando obrigatório:
      (1) existe exatamente **uma declaração lógica** de entrega — um `Spec-Kit-Entrega` não vazio,
      que pode listar uma ou mais tarefas; (2) toda tarefa declarada existe em `tasks.md` **e** em
      `execution-status.md` e não está acima de `lastRecordedTask`;
      (3) **todo** identificador acima de `lastRecordedTask`, em **qualquer** posição do contexto,
      está classificado num dos dois trailers; (4) nenhum identificador nos dois ao mesmo tempo;
      (5) trailers **idênticos após normalização em conjunto são idempotentes** (a mesma declaração
      repetida, não duas decisões); trailer **com conteúdo divergente**, vazio, malformado, ausente
      ou com o mesmo identificador nas duas classificações **reprova**.
    - **Corte de adoção, objetivo e sem hash:** obrigatório quando
      `lastRecordedTask >= 152` (`TAREFA_DE_ADOCAO_DO_PROTOCOLO`). Abaixo disso, **modo histórico**:
      só a regra (a), porque exigir trailer de commit que já está em `main` seria exigir reescrita
      de histórico. A constante vive no código, não em `sync-state.json` — em estado, a mesma
      mudança a fiscalizar poderia baixar o corte e desligar o protocolo junto.
    - **Onde os trailers precisam estar:** o squash do GitHub monta a mensagem com o título da PR
      mais as mensagens dos **commits** (não a descrição da PR); o evento `pull_request` entrega
      título e descrição. Como o verificador roda nos dois, os trailers vão **na mensagem de
      commit** e **na descrição da PR**. O workflow passou a fornecer título + corpo no evento de
      PR para que os dois vejam a mesma informação, e o fallback local passou de `--pretty=%s` para
      `--pretty=%B` pelo mesmo motivo: uma noção só de contexto.
    - **Sem perda de detecção:** as 40 integrações de `main` seguem válidas em modo histórico, sem
      hash listado. Entrega declarada acima do ledger **continua reprovando**.
    - **Duplicidade é união idempotente.** A mesma declaração chega por canais diferentes, e o
      squash concatena as mensagens de todos os commits: duas linhas iguais são uma declaração, não
      duas decisões. Conteúdos divergentes continuam falhando como contradição.
    - **A CI da PR valida a mensagem prevista do squash**, além do contexto de revisão. É o que
      impede "PR verde, `main` vermelha" — a forma que já quebrou a `main` duas vezes aqui.
    - **O estado não recua:** o CLI recusa `lastRecordedTask` abaixo da adoção. Modo histórico
      existe só no núcleo puro, para replay em teste.
    - **Não tratado, e declarado:** caixa baixa (`t153`) e zero-width continuam escapando de
      `IDENTIFICADOR`, como antes desta tarefa. Dívida anterior, com teste que a torna explícita.
    - **Preserva a T149:** as proteções contra estado inválido (`validarEstado`) e o fail-closed de
      contexto ausente seguem intactos e têm teste próprio.
    - **Sem whitelist de identificadores** e sem resolver por avanço de `lastRecordedTask`.

50. **T153 - Interface web funcional do Gestor Consultivo (somente leitura)**
    - **Estado:** **Integrada** em `main` pela PR #144, squash
      `94bdededc481d3aa45e6970161090ff4d21da10b`, com a CI de `main` 3/3 verde. Branch
      `codex/t153-web-gestor-consultivo`, a partir do squash
      `3f73f4ed0e690fe9d020468bba40388be2e6f8f9` (T152, PR #143).
    - **Escopo:** exclusivamente a **interface web** sobre a fundação já integrada pela T151.
      Consome os dois endpoints que já existem — `GET /gestor/equipe` e
      `GET /gestor/equipe/vinculos/:vinculoId` — e **não altera** API, schema Prisma, migration,
      seed, RBAC, Docker, dependências ou lockfile.
    - **Por que agora:** a T151 resolveu `DP-8` e `DP-23` pela [ADR 0015](../docs/adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md),
      no recorte aprovado pelo proprietário em 06/10/2026. O ledger ainda listava o Gestor
      consultivo como bloqueado por essas decisões — leitura anterior à T151, corrigida nesta
      convergência.
    - **Entrega:** lista da equipe (carregando, vazio, erro com nova tentativa, busca/filtro
      **local** apenas sobre o que o servidor já devolveu) e **detalhe consultivo em modal** do
      padrão B, somente leitura, restrito à projeção fechada da decisão 7.
    - **Autorização não é decidida no frontend.** O escopo e a `dataReferencia` vêm do servidor; a
      interface **não oferece parâmetro de data**, porque quem pergunta não escolhe em que data é
      autorizado (ADR 0015, decisão 8). Esconder controle não é controle de acesso: a porta
      continua sendo `gestor_equipe` `read` no RBAC, e a tela não infere subordinação por e-mail,
      nome, `unit_id`, `team_id` textual ou lotação.
    - **404 é indisponibilidade, nunca enumeração.** Vínculo fora do escopo responde 404 na API; a
      tela o apresenta como "não disponível", sem distinguir inexistente de alheio e sem exibir
      corpo interno de erro.
    - **Concorrência por guarda monotônica por carregador:** resposta obsoleta não atualiza dados,
      erro nem carregamento. Troca de vínculo, fechamento do detalhe, nova tentativa e troca de
      sessão invalidam o que estava em trânsito — para que dado de uma pessoa nunca reapareça sob
      o nome de outra.
    - **Capacidades ausentes continuam ausentes, e declaradas.** `resumoJornada` e
      `andamentoSolicitacoes` chegam `null` da API de propósito; a interface **não** desenha cartão
      vazio nem dado fictício fingindo que existem. O módulo funcional antes cogitado sob o número
      da T152 — **resumo de jornada** (`DP-3J-12`) e **andamento de solicitações** (`PD-SOL-05`) —
      **não foi iniciado** e segue sem contrato seguro.
    - **Fora de escopo, explicitamente:** banco de horas, espelho de ponto, atestado, diagnóstico,
      CID ou qualquer informação de saúde, aprovações, alterações cadastrais, qualquer `POST`,
      `PATCH`, `PUT` ou `DELETE`, visão por departamento ou empresa inteira, gestão matricial,
      exceções administradas pela interface e ESS.
    - **Dívidas mantidas, não tratadas:** FK de `unit_id`/`team_id` (ADR 0003); convergência de
      atributos do seed; caixa baixa e zero-width no verificador; decisões do pacote de integração
      de ponto (T148); `Pessoas › Histórico funcional` estoura a largura (T115, preexistente).

51. **T154 - Padronização brasileira de datas na interface**
    - **Estado:** **Integrada** em `main` pela PR #145, squash
      `cd80ea9ab8cbae0a25706f1d248dc027a1cd40c2`, com CI de `main` 3/3 verde. Branch
      `codex/t154-datas-padrao-brasileiro`, a partir do squash
      `94bdededc481d3aa45e6970161090ff4d21da10b` (T153, PR #144).
    - **Escopo:** exclusivamente **apresentação** de datas em `apps/web`. Não altera backend,
      Prisma, migrations, regras trabalhistas, cálculos, RBAC, seed, contratos HTTP, dependências
      ou lockfile.
    - **Regra vinculante de interface:**
      (1) data completa `DD/MM/AAAA`; (2) mês e ano `MM/AAAA`;
      (3) data e hora `DD/MM/AAAA às HH:mm`, em relógio de **24 horas**;
      (4) locale `pt-BR`; (5) fuso de negócio `America/Sao_Paulo` para **instantes**;
      (6) valor ausente usa o traço `—`, padrão visual já adotado;
      (7) valor inválido **não quebra a tela** e **nunca** exibe `Invalid Date`.
    - **O que NÃO muda:** contratos HTTP, banco e o `value` de `<input type="date">` continuam em
      ISO (`AAAA-MM-DD`). A alteração é de apresentação, não de armazenamento ou transporte.
    - **A distinção que sustenta a regra é semântica, não cosmética.** Existem dois tipos de valor
      temporal no produto, e tratá-los igual é o defeito:
      - **Data civil** (`AAAA-MM-DD`, sem hora): admissão, desligamento, vigência, `dataReferencia`.
        Os componentes são lidos **diretamente da string**. `new Date("2026-10-08")` é interpretado
        como meia-noite **UTC**, e a oeste de Greenwich exibiria **07/10/2026** — um dia a menos.
        Deslocar o dia de uma admissão ou de uma vigência não é detalhe visual: é informação
        funcional errada.
      - **Instante** (ISO com hora ou offset): criação de registro, trilha de auditoria. Aqui
        converter é exatamente o certo, e a conversão usa `Intl.DateTimeFormat` com
        `timeZone: "America/Sao_Paulo"` — o mesmo fuso de negócio que o `FUSO_COMPETENCIA` do
        ponto já fixa no servidor.
    - **Um só ponto de formatação.** O utilitário existente `apps/web/src/format/dia.ts` é
      consolidado e ampliado; `split`, `substring`, `slice`, `toLocaleDateString` e formatadores
      próprios saem das telas. Formatação espalhada é como a mesma data passou a aparecer em dois
      formatos diferentes em telas vizinhas.
    - **Correção inicial obrigatória:** em "Minha equipe", a frase "data de referência 2026-10-08"
      passa a exibir "data de referência **08/10/2026**". O valor que a API envia continua
      `2026-10-08`.
    - **Guarda de regressão por saída visual:** teste que recusa ISO cru onde a tela deveria usar o
      formatador, **sem** varredura global ingênua — campo técnico legítimo (`value` de input,
      payload, `key`, `id`) continua ISO e não pode ser bloqueado.
    - **Pendências preservadas:** `DP-3J-12` (resumo de jornada) e `PD-SOL-05` (andamento de
      solicitações) seguem **não iniciados** e sem contrato seguro; decisões de negócio e do RH já
      registradas permanecem abertas. `DP-8` e `DP-23` seguem resolvidas apenas no recorte da
      ADR 0015.
    - **Dívidas mantidas, não tratadas:** FK de `unit_id`/`team_id` (ADR 0003); convergência de
      atributos do seed; caixa baixa e zero-width no verificador; decisões do pacote de integração
      de ponto (T148); `Pessoas › Histórico funcional` estoura a largura (T115, preexistente);
      ausência de timeout em `GET /v1/users/me` no portão de sessão (T153).

52. **T155 - Investigação e especificação de checklists de contratação e desligamento**
    - **Estado:** investigação em curso. Branch `codex/t155-checklists-rh`, a partir do squash
      `cd80ea9ab8cbae0a25706f1d248dc027a1cd40c2` (T154, PR #145).
    - **Objetivo:** delimitar um domínio operacional de checklist para contratação e desligamento,
      separado de admissão, movimentação funcional e documentos. A tarefa não cria funcionalidade
      antes de RH aprovar o processo real.
    - **Contrato já confirmado:** a admissão cria colaborador e vínculo previsto; a efetivação da
      movimentação de admissão ativa o vínculo; desligamento é movimentação explícita que encerra o
      vínculo. Nenhum desses atos tem checklist próprio no modelo atual.
    - **Limite obrigatório:** checklist não pode, nesta tarefa, criar, efetivar, bloquear, cancelar
      ou retificar admissão ou desligamento; não materializa documento, upload, assinatura,
      informação de saúde, folha, eSocial, benefício, cálculo ou integração externa.
    - **Decisões necessárias de RH antes de código:** templates por empresa e fluxo; itens,
      responsáveis e prazos; status e exceções; relação com a efetivação do vínculo; evidência
      permitida; visibilidade por papel; reabertura, dispensa e auditoria.
    - **Referência funcional registrada:** o inventário de Pessoas, Estrutura, Registros, Feedbacks,
      Checklists, Saúde, Motivos de desligamento e Métricas foi consolidado em
      `docs/decisions/t155-mapa-funcional-gestao-talentos-referencia-mercado.md`. É referência
      descritiva, não requisito aprovado nem autorização para copiar solução de terceiros.
    - **Aceite desta investigação:** documento de decisão com o inventário de contratos existentes,
      fronteiras de privacidade e perguntas objetivas ao RH; nenhum endpoint, migration, tela ou
      regra de negócio implementada enquanto faltar aprovação.

53. **T156 - Matriz Evolli × referência de mercado e priorização funcional**
    - **Estado:** investigação concluída, em revisão. Branch `codex/t156-matriz-referencia-mercado`,
      a partir do squash `25ce08716744f32db04393a9a645787f83d5fe5f` (T155, PR #147).
    - **Objetivo:** formalizar, módulo a módulo, a diferença entre o que o Evolli faz hoje e as
      capacidades observadas como referência de mercado; registrar cada lacuna com objetivo, dados
      necessários, regras de negócio indefinidas, dependências, riscos e prioridade; e recomendar
      **uma única** próxima fatia funcional independente das respostas pendentes do RH.
    - **Método obrigatório:** o estado de cada frente é **derivado do código** — `apps/`,
      `packages/`, schema Prisma, migrations e navegação da web — nunca de texto anterior. Toda
      classificação cita evidência. Onde não houve verificação, o documento diz que não houve.
    - **Vocabulário:** `funcional`, `parcial`, `demonstrativo` e `planejado`, já vigentes na legenda
      do ledger, mais `bloqueado` para ausência que tem gate registrado. Ausência deliberada não é
      dívida, e o documento não a trata como tal.
    - **Convergência:** registra a T155 como Integrada (PR #147, squash `25ce087`), move
      `lastIntegratedTask` para 155 e `lastRecordedTask` para 156.
    - **Versiona junto** `docs/decisions/referencia-funcional-solides-mapa-evolli.md`, que sustenta
      a coluna de comparação e até aqui não estava versionado, depois de auditado quanto a código,
      captura, dado pessoal, credencial e conteúdo proprietário copiado.
    - **Limite obrigatório:** tarefa documental. Não implementa código, UI, API, migration, seed,
      teste funcional nem alteração visual; não toca Docker, banco, dependências ou lockfile; não
      altera ADR, gate ou decisão; não copia identidade visual, conteúdo ou código de terceiros; e
      **não inicia a T157**. A recomendação é insumo de decisão, não autorização de implementação.
    - **Aceite:** matriz versionada com estado por módulo, lacunas, dependências técnicas e de
      negócio, riscos CLT/LGPD/segurança, prioridade, critérios mínimos de pronto e uma única
      recomendação de próxima fatia; Spec Kit convergido; CI verde.
    - **Pendências preservadas:** `DP-3J-12` (resumo de jornada) e `PD-SOL-05` (andamento de
      solicitações) seguem não iniciados. As decisões de negócio e do RH já registradas permanecem
      abertas, e nada aqui as antecipa.

54. **T157 - Administração da Liderança: vínculos e atribuições de equipe**
    - **Estado:** em implementação. Branch `codex/t157-administracao-lideranca`, a partir do squash
      `92c559081d661306f2d4aef30020e8cbcb8f482c` (T156, PR #148).
    - **Objetivo:** tornar utilizável pela interface web a capacidade administrativa que a T151 já
      entregou e que a ADR 0015 já governa — ligar conta de acesso a colaborador, atribuir gestor a
      equipe com vigência, listar estado vigente e histórico, e encerrar por vigência.
    - **Por que esta fatia:** é a recomendação única da matriz da T156. A T151 entregou a fundação e
      a T153 a consulta, mas configurar um gestor só era possível por HTTP cru ou pelo seed — então
      todo gestor real via lista vazia em `Minha equipe`. A fatia fecha esse elo.
    - **Contratos usados, nenhum criado:** `POST /v1/gestor/administracao/ligacoes`,
      `PATCH /v1/gestor/administracao/ligacoes/:ligacaoId/encerrar`,
      `GET /v1/gestor/administracao/ligacoes`, `POST /v1/gestor/administracao/atribuicoes`,
      `PATCH /v1/gestor/administracao/atribuicoes/:atribuicaoId/encerrar` e
      `GET /v1/gestor/administracao/atribuicoes`. RBAC `gestor_atribuicao` com `create`, `alter` e
      `read`, concedido apenas a `rh` na própria empresa.
    - **Catálogos de apoio, já existentes:** `GET /v1/users` (cursor), `GET /v1/colaboradores` e
      `GET /v1/equipes` (página/tamanho) — consumidos **até o fim**, para que nenhum registro fique
      oculto além da primeira página.
    - **Limite obrigatório:** **exceções de acesso ficam fora**. As três rotas de `excecoes` existem
      e permanecem sem interface enquanto o catálogo de `motivoCodigo` depender de validação com RH
      (ADR 0015, decisão 9). Também fora: gestão matricial, departamento ou empresa inteira, ESS,
      mutação pelo gestor, ponto, férias, folha, saúde e dado sensível.
    - **Sem backend:** não altera `apps/api`, Prisma, migrations, seed, RBAC, contratos HTTP,
      Docker, banco, dependências ou lockfile.
    - **Padrão visual:** alternativa B com modais, já aprovada; sem redesenho e sem ampliar a
      fundação congelada na T146. Datas no padrão brasileiro consolidado pela T154.
    - **Aceite:** o RH liga uma conta a um colaborador e atribui essa conta como gestor de uma
      equipe pela interface; a tela `Minha equipe` daquele gestor, antes vazia, passa a listar o
      time; encerrar devolve a lista a vazio; atribuição sobreposta recebe recusa estável; registro
      de outra empresa continua respondendo 404; toda mutação aparece na trilha.
    - **Pendências preservadas:** `DP-3J-12` e `PD-SOL-05` seguem não iniciados; as decisões de
      negócio e do RH já registradas permanecem abertas.

55. **T158 - Interface de inativação e reativação da estrutura organizacional**
    - **Estado:** em implementação. Branch `codex/t158-ciclo-vida-estrutura-organizacional`,
      a partir do squash `99e3363fd3e2a24e071a5fb240db9cf479713678` (T157, PR #149).
    - **Objetivo:** expor na interface web as ações de inativar e reativar dos cadastros
      organizacionais que já possuem rota, capacidade de RBAC e cobertura E2E no backend
      desde as T104–T109. A T156 registrou que essas rotas existem e que nenhuma tela as
      alcança.
    - **Por que importa:** o RH enxerga o filtro de inativos sem conseguir colocar nem
      retirar registro desse estado. Três telas anunciam em texto que "não é possível
      excluir, apenas inativar" e não oferecem o botão correspondente.
    - **Investigação obrigatória antes do código:** confirmar na fonte, entidade por
      entidade, o método, o caminho, a permissão exigida, a forma da resposta, a semântica
      de estado, o tratamento de item já no estado alvo e eventuais restrições por
      referência. Semelhança de nome não autoriza presumir contrato igual; qualquer
      ambiguidade interrompe a tarefa e vira relato.
    - **Limite obrigatório:** exclusão física permanece fora da interface — não existe rota
      `DELETE` no produto e nenhuma é inventada. Sem ação em massa, sem alteração de regra
      de negócio, sem backend, Prisma, migrations, seed, RBAC, contratos HTTP, dependências
      ou lockfile.
    - **Padrão visual:** alternativa B com os componentes existentes; confirmação acessível
      antes da mutação, com nome claro, foco inicial, `Escape` seguro, devolução de foco e
      mensagem de sucesso ou de erro. Sem redesenho.
    - **Erros:** 403, 404, 409 e falha de rede tratados sem inventar explicação ou regra. O
      servidor continua sendo a autoridade, e o isolamento por empresa é preservado.
    - **Dívida preservada:** a paginação geral das telas existentes (L3, registrada na T156)
      **não** é resolvida aqui. A tarefa não cria lista nova que a omita e não inventa
      parâmetro onde o contrato não o oferece.
    - **Aceite:** cada entidade coberta tem teste de cliente e de tela para sucesso, recusa
      do servidor e erro de rede; prova de que nenhum endpoint de exclusão é chamado;
      acessibilidade do modal e do teclado; typecheck, lint, build, testes, Prettier,
      `spec:check` e `git diff --check` verdes.
    - **Pendências preservadas:** `DP-3J-12` e `PD-SOL-05` seguem não iniciados; as
      ressalvas R-A, R-B e R-C da T157 continuam abertas e não são tratadas aqui.

56. **T159 - Reorganização funcional da navegação e menus**
    - **Estado:** **integrada** em `main` pela PR #151, squash
      `c849b0192390c2db63fb78e0e305e97ab40d1f0f`, com a CI de `main` 3/3 verde.
      Branch `codex/t159-navegacao-modular-funcional` preservada em `06157a4`.
    - **Objetivo:** reorganizar a navegação global em módulos e submenus coerentes com a
      capacidade que de fato existe, usando a matriz da T156 como inventário e a referência
      de mercado apenas como inspiração de arquitetura de informação.
    - **Princípio:** menu é promessa. Item demonstrativo não convive com capacidade
      operacional como se fosse equivalente, e item bloqueado por decisão, LGPD, CLT ou
      contrato pendente não entra como funcionalidade disponível.
    - **Inventário obrigatório antes do código:** cada destino classificado a partir da
      fonte — tela, origem dos dados (API real ou fixture), permissão exigida e estado.
      Onde documento e código divergirem, vale o código; a divergência é registrada, e a
      tarefa para se ela impedir classificar algum destino.
    - **Evolução visual aprovada (13/10/2026, após a primeira prévia):** o proprietário
      autorizou recompor o shell e os menus — barra lateral branca e espaçosa com a marca
      própria, módulos com ícone SVG original, hierarquia entre módulo/submenu/destino
      ativo por superfície, borda indicadora, peso e espaço, grupo Demonstração ao pé da
      barra e cabeçalho só com ações que existem. Registro e limites em
      [`docs/decisions/t159-direcao-visual-navegacao.md`](../docs/decisions/t159-direcao-visual-navegacao.md).
      A referência de mercado entra **apenas** como princípio de arquitetura e composição.
    - **Limite obrigatório:** sem copiar marca, logotipo, texto, foto, ilustração, ícone
      proprietário, paleta exata, código ou layout pixel a pixel de terceiros; sem alterar
      escopo funcional, regra de negócio, RBAC, rotas, API, backend, Prisma, migrations,
      seed, Docker, dependências ou lockfile. Tela interna só muda no estritamente
      necessário para preservar roteamento, título, foco ou navegação.
    - **Tela de login:** fica para fatia própria futura — painel institucional original
      mais autenticação, sem CPF, captcha, cadastro, registro de ponto ou recuperação de
      senha enquanto não houver contrato funcional para cada um deles.
    - **Preservações duras:** a entrada direta do gestor em "Minha equipe" continua
      funcionando e não dispara rota proibida nem 403 na inicialização; os destinos de RH,
      DP, financeiro, colaborador e `master_tecnico` seguem respeitando as permissões reais.
    - **Acessibilidade:** sidebar recolhível e gaveta mobile seguem acessíveis; grupo e
      destino ativos com nome acessível, foco visível e teclado coerente; um `h1` por
      workspace; sem rolagem horizontal em desktop e em 375 px.
    - **Aceite:** testes de mapa de navegação por papel, visibilidade por capacidade,
      destino inicial do gestor, ausência de chamada proibida na inicialização, preservação
      dos destinos funcionais, gaveta mobile e foco por teclado, e garantia de que destino
      demonstrativo não se apresenta como funcional.
    - **Dívida preservada:** L3 não é iniciada nem declarada resolvida. Seguem abertas S-1 a
      S-4 (T158), R-A, R-B e R-C (T157) e o registro `teste michell`.

57. **T160 - Login institucional do Evolli**
    - **Estado:** **integrada** em `main` pela PR #152, squash
      `0db3d7059160b97699ca3077190618e6a972449e`. A CI de `main` ficou 2/3
      nesse squash, por falha pré-existente do E2E de concorrência do gestor —
      tratada pela T161. Branch `codex/t160-login-institucional` preservada.
    - **Objetivo:** renovar somente a tela e o fluxo visual de login, com uma
      experiência institucional própria — cartão central, fundo abstrato
      original, marca Evolli e composição moderna, responsiva e acessível.
    - **Princípio:** a porta de entrada apresenta o produto; ela não pode
      prometer o que o produto não faz. Referência de mercado entra como
      princípio de composição, nunca como material copiado.
    - **Contrato preservado:** autenticação por **e-mail e senha**, a segunda
      etapa de MFA já existente, o comportamento de sessão e o redirecionamento
      após o login. `onLoginSuccess` e o portão `AutenticacaoApp` seguem
      intactos.
    - **Proibido sem contrato funcional:** CPF, CAPTCHA, "lembrar-me", cadastro,
      recuperação de senha, registro de ponto, SSO e qualquer outra ação nova.
    - **Proibido copiar:** marca, logotipo, texto, foto, ilustração, ícone
      proprietário, paleta exata, asset, código ou layout pixel a pixel de
      terceiros.
    - **Limite obrigatório:** sem alterar API, Prisma, migrations, seed, Docker,
      banco, dependências ou lockfile. Necessidade comprovada fora disso para a
      tarefa e vira relato.
    - **Acessibilidade:** teclado, foco visível, mensagens de erro acessíveis
      com `role="alert"`, contraste AA, leitor de tela,
      `prefers-reduced-motion` e nenhuma rolagem horizontal em 375 px; um `h1`
      por tela.
    - **Aceite:** testes que falham antes e passam depois, cobrindo contrato de
      autenticação preservado, ausência das ações proibidas, acessibilidade e
      composição responsiva; validação visual em desktop e 375 px.
    - **Decisão registrada junto, sem implementar:** o Hub pós-login, em
      [`docs/decisions/t162-hub-pos-login.md`](../docs/decisions/t162-hub-pos-login.md).
      Registrado como "T161" na época; renumerado para **T162** na T161, por
      colisão de identificador.
    - **Dívida preservada:** T1, T2 e T3 da revisão final da T159, L3, S-1 a S-4
      (T158), R-A, R-B e R-C (T157) e o registro `teste michell`.

58. **T161 - Concorrência do gestor: diagnóstico antes de correção**
    - **Estado:** **integrada** em `main` pela PR #153, squash
      `07cdfca25fb2b7b5e2dceead94e73c4a2181b659`, com a CI de push 3/3 verde —
      o E2E de concorrência que derrubava `main` voltou ao verde. Branch
      `codex/t161-concorrencia-gestor-409` preservada.
    - **Ressalva aberta (S2):** o confinamento da repetição a `criarAtribuicao`
      é garantido por inspeção, sem teste próprio.
    - **Motivo:** a CI de `main` ficou 2/3 — duas criações simultâneas de
      atribuição de gestor principal devolveram um 201 e nenhum 409, e o log
      trazia só `PrismaClientUnknownRequestError`.
    - **Investigação obrigatória antes de qualquer correção:** PostgreSQL real
      e efêmero, inspeção da forma exata do erro e do nome da constraint. Nada
      de supor código ou mensagem.
    - **O que a investigação descartou:** o mapeamento de 23P01/23505/P2002/
      23514 já existe e funciona; expiração de transação por espera de lock
      devolve 409 mesmo com 9 s de contenção forçada.
    - **Causa raiz encontrada pelo próprio diagnóstico:** o perdedor da corrida
      morre em **deadlock (`40P01`)**, que chega como
      `PrismaClientUnknownRequestError`. Reproduzido localmente em 2 de 8
      execuções, com o SQLSTATE aparecendo só nas que falharam. O que fazer
      com ele é decisão de produto, ainda em aberto.
    - **Decisão do proprietário:** **nenhum SQLSTATE novo vira 409 sem prova
      direta.** P2028, P2034, 40P01 e 23000 continuam 500. Sem retry para
      mascarar a corrida, sem enfraquecer ou remover o E2E existente.
    - **Entrega:** regra preservada em função pura e testada; diagnóstico
      seguro no `AllExceptionsFilter` (classe, código do Prisma, SQLSTATE,
      constraint/trigger); E2E com cenário concorrente repetido e conflito
      com contenção forçada, ambos reportando status e corpo na falha.
    - **Limite de privacidade:** o log nunca carrega mensagem do banco,
      `DETAIL`, parâmetros, conteúdo de requisição ou stack; a resposta HTTP
      não muda.
    - **Planejados, não iniciados:** Hub pós-login (**T162**, registrado em
      [`docs/decisions/t162-hub-pos-login.md`](../docs/decisions/t162-hub-pos-login.md),
      sem branch, sem PR e sem código), RH/DP e Gestão de Pessoas.
    - **Dívida preservada:** R1, R2 e R3 da T160, L3, S-1 a S-4 (T158),
      R-A a R-C (T157) e o registro `teste michell`.

59. **T162 - Hub pós-login do Evolli**
    - **Estado:** **integrada** em `main` pela PR #154, squash
      `61e5f9005e072a7e5583fb2ffbaa722240ea0ff9`, com a CI de push 3/3 verde.
      Branch `codex/t162-hub-pos-login` preservada.
    - **Ressalvas abertas (revisão adversarial):** **R-2** — o Hub lê
      `GET /v1/empresas` a cada montagem, e `registrarConsultaAmpla` grava um
      registro de auditoria por visita; **R-3** — `dp` dentro de Jornada pode
      esbarrar em `tabela_horario` por interação (o mount está limpo; defeito
      pré-existente da tela, não introduzido pela T162). Nenhuma foi corrigida.
    - **Objetivo:** depois do login e da resolução segura do ator, a pessoa
      entra primeiro no Hub, não direto no shell de módulos. O Hub mostra
      **somente** produtos que o servidor autoriza no contexto atual.
    - **Princípio:** o mesmo da T159, um nível acima — cartão de produto é
      promessa. Capacidade por papel derivada do `rbac.evaluator`, nunca de
      lista escrita à mão; funcional separado de demonstrativo.
    - **Contratos levantados antes da interface:** `GET /v1/users/me` (ator,
      papel, `companyId`); `GET /v1/empresas` sob `empresa:read`, com escopo
      resolvido no servidor.
    - **Bloqueio declarado:** **não existe contrato de troca de empresa ou de
      escopo de sessão.** A empresa é `access_user.companyId`, coluna da conta.
      A empresa aparece como contexto **não editável** — sem seletor clicável,
      sem empresa fictícia, sem simulação de troca.
    - **Segunda consequência:** `empresa:read` é de `rh`, `dp` e
      `master_tecnico`; para `gestor` e `colaborador` não há como ler o nome da
      empresa, e o Hub não inventa um.
    - **Proibido:** inventar endpoint, query, cookie, seleção local de empresa
      ou escopo no frontend; anunciar superfície demonstrativa como entregue;
      "em breve", link morto ou produto fictício.
    - **Acessibilidade:** um `h1`, foco visível, teclado integral, nomes
      acessíveis, estados de carregamento/erro/retry e nenhuma rolagem
      horizontal em 375 px e desktop.
    - **Aceite:** redirecionamento pós-login para o Hub; visibilidade por
      papel; ausência de destino não autorizado; empresa atual correta;
      falha e retry sem montar shell indevido; navegação de cartão para
      destino autorizado; retorno ao Hub; 375 px sem overflow.
    - **Limite:** sem alterar login, RBAC, schema, migrations, seed, Docker,
      banco, dependências ou lockfile.
    - **Dívida preservada:** S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158),
      R-A a R-C (T157) e o registro `teste michell`.

60. **T163 - Contexto empresarial ativo e troca segura de empresa**
    - **Estado:** em implementação. Branch
      `codex/t163-contexto-empresarial-ativo`, a partir do squash
      `61e5f9005e072a7e5583fb2ffbaa722240ea0ff9` (T162, PR #154).
    - **Origem:** a T162 entrou **sem** troca de empresa porque não havia
      contrato — a empresa era `access_user.companyId`, coluna fixa da conta.
      Esta tarefa cria o contrato.
    - **Regra aprovada:** `rh` e `master_tecnico` escolhem empresa de trabalho
      somente entre as **autorizadas pelo servidor**; gestor, colaborador e
      demais papéis ficam na empresa do próprio vínculo e **não listam nem
      trocam**, inclusive por requisição forjada.
    - **Princípios:** associação usuário–empresa de servidor e auditável;
      empresa ativa na **sessão**, nunca em `localStorage`, `sessionStorage`,
      query string, cookie de frontend ou parâmetro livre de rota; `companyId`
      do cliente nunca amplia escopo; contexto resolvido **centralmente** em
      leituras e mutações; troca valida no servidor, atualiza a sessão e gera
      **evento de auditoria** sem dado sensível; empresa não autorizada,
      inexistente ou revogada segue o padrão **anti-enumeração**; login novo
      começa em contexto previsível; sessões simultâneas mantêm contextos
      independentes; empresas autorizadas não são expostas a quem não seleciona.
    - **Política do `master_tecnico`:** pode receber as empresas permitidas pela
      política existente, mas isso precisa ficar **explícito e coberto por
      teste** — nunca por lista inventada no frontend.
    - **Hub:** só muda depois de o contrato existir. `rh` e administrador veem a
      empresa ativa e um seletor acessível; a troca recarrega Hub e módulos no
      novo contexto, sem reter dado da empresa anterior; gestor/colaborador
      continuam com texto não editável. **R-2 só pode ser declarada resolvida
      com evidência.**
    - **Prova de isolamento exigida:** duas empresas sintéticas distintas —
      funcionário da empresa B não aparece na D, e o da D não aparece na B.
    - **Parada obrigatória:** se o contexto não puder ser aplicado centralmente
      sem deixar rota funcional desprotegida, parar e reportar antes de
      publicar. Sem seletor ou endpoint fingido.
    - **Limite:** sem novos módulos de RH/DP, cartão fictício, portal do
      colaborador ou funcionalidade demonstrativa; login só muda no
      estritamente necessário ao contrato de sessão.
    - **Dívida preservada:** R-2 e R-3 (T162), S2 (T161), R1 a R3 (T160), L3,
      S-1 a S-4 (T158), R-A a R-C (T157) e o registro `teste michell`.

## Regra obrigatória para as próximas tarefas

1. Criar ou atualizar a entrada da tarefa neste arquivo antes da implementação.
2. Atualizar `execution-status.md` e `sync-state.json` na mesma branch/PR.
3. Se houver mudança de regra, atualizar Spec, Plan e Constituição conforme o impacto semântico.
4. Executar `/speckit.converge` e `pnpm spec:check` antes de promover a PR para Ready for review.
5. Revisão e CI verdes não substituem decisão humana pendente nem autorizam merge ou produção.
6. Citar uma tarefa antiga em prosa **não** exige mais registrá-la: desde a T149 o verificador
   fiscaliza a janela de entrega declarada em `sync-state.json`, não todo `T###` do texto.
