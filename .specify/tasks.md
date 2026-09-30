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
      `cancelada` sem saída. Uma única máquina de estados — o service delega ao núcleo.
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

    - **Estado:** implementada na branch `codex/t141-ambiente-demonstracao-local`; **PR #133 Draft**,
      aguardando revisão somente leitura.
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
    - **Fora de escopo, preservado:** MFA, ESS/MSS, anexo, upload, R2, serviço externo, dado real,
      rota de administração exposta no produto, regra de RH nova e alteração de CI.

## Regra obrigatória para as próximas tarefas

1. Criar ou atualizar a entrada da tarefa neste arquivo antes da implementação.
2. Atualizar `execution-status.md` e `sync-state.json` na mesma branch/PR.
3. Se houver mudança de regra, atualizar Spec, Plan e Constituição conforme o impacto semântico.
4. Executar `/speckit.converge` e `pnpm spec:check` antes de promover a PR para Ready for review.
5. Revisão e CI verdes não substituem decisão humana pendente nem autorizam merge ou produção.
