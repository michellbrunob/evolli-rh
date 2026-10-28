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
    - **Ressalvas da revisão adversarial, e o estado de cada uma:**
      - **R-2 — RESOLVIDA pela T163.** O Hub lia `GET /v1/empresas` a cada
        montagem, e `registrarConsultaAmpla` gravava um registro de auditoria
        por visita. A T163 removeu a leitura: o Hub não importa mais
        `organizacaoClient`, a empresa ativa vem de `GET /v1/users/me`
        (`empresaAtiva`), há teste-guarda que reprova se `organizacaoClient`
        voltar, e a medição de navegador contou **zero** chamadas a
        `/v1/empresas` na sessão.
      - **R-3 — ABERTA.** `dp` dentro de Jornada pode esbarrar em
        `tabela_horario` por interação (o mount está limpo; defeito
        pré-existente da tela, não introduzido pela T162). **A T163 não a
        tratou.**
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
    - **Estado:** **integrada** em `main` pela PR #155, squash
      `0da0950289dfb3d6104206471ade75a74ff2827a`, com a CI de push 3/3 verde.
      Branch `codex/t163-contexto-empresarial-ativo` preservada.
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
      continuam com texto não editável — mas passam a **ver o nome da própria
      empresa**, vindo de `empresaAtiva`; isso não amplia escopo nem autoriza
      troca. **R-2 foi declarada resolvida COM evidência**, conforme exigido:
      ver o estado das ressalvas na entrada da T162 acima.
    - **Prova de isolamento exigida:** duas empresas sintéticas distintas —
      funcionário da empresa B não aparece na D, e o da D não aparece na B.
    - **Parada obrigatória:** se o contexto não puder ser aplicado centralmente
      sem deixar rota funcional desprotegida, parar e reportar antes de
      publicar. Sem seletor ou endpoint fingido.
    - **Limite:** sem novos módulos de RH/DP, cartão fictício, portal do
      colaborador ou funcionalidade demonstrativa; login só muda no
      estritamente necessário ao contrato de sessão.
    - **Resolvida por esta tarefa:** R-2 (T162), com evidência registrada.
    - **Dívida preservada, nenhuma tratada aqui:** R-3 (T162, `dp`/Jornada e
      tabela de horário), S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158),
      R-A a R-C (T157) e o registro `teste michell`.

61. **T164 - Colaboradores: primeira fatia operacional (consulta)**
    - **Estado:** **integrada** em `main` pela PR #156, squash
      `9df47566c3741bdeff68ae65bd6ffe1191a3a70b`, com a CI 3/3 verde — também
      confirmada por disparo manual do workflow sobre `main`. Branch
      `codex/t164-pessoas-colaboradores-operacionais` preservada.
    - **Ressalvas da revisão adversarial:** **R-1** (contagem de páginas pela
      constante local) e **R-2** (foco perdido ao paginar) **resolvidas** em
      commit próprio, com 12 testes que reprovam sem a correção; **R-3
      ABERTA** — paginação de múltiplas páginas comprovada por teste, não
      observada em navegador, porque o banco de demonstração nunca passa de
      20 registros.
    - **Natureza:** **exclusivamente consulta operacional**. É a primeira tela
      de Colaboradores que é produto, e não maquete.
    - **Entrega:** título com a empresa ativa; **total devolvido pelo
      servidor**; filtros de situação do colaborador e situação do vínculo;
      tabela com **Nome, Situação e data de cadastro** em padrão brasileiro;
      paginação real, acessível e sem ocultar registro depois da primeira
      página; estados de carregamento, vazio, erro e nova tentativa;
      recarregamento limpo ao trocar de empresa no Hub, sem dado residual.
    - **Contrato que sustenta a tela:** `GET /v1/colaboradores`, sob
      `colaborador:read`, com `pagina`/`tamanhoPagina` (máx. 100, padrão 20) e
      resposta `{ itens, pagina, tamanhoPagina, total }`.
    - **Quatro limitações levantadas na fonte, respeitadas:** sem busca por
      nome/matrícula; sem contagem agregada por situação (só o `total` do
      conjunto filtrado); projeção da lista restrita a `id`, `nome`,
      `situacao`, `criadoEm`, `atualizadoEm`; matrícula, cargo, departamento e
      admissão vivem no vínculo, a uma chamada por pessoa. Nenhuma é
      contornada — **N+1 é proibido** e controle que não funciona não é
      desenhado.
    - **Fora de escopo, por decisão do proprietário:** novo colaborador,
      cadastro, edição, exclusão, admissão, desligamento, importação em massa,
      exportação, solicitação de preenchimento, link de preenchimento,
      autopreenchimento pelo funcionário e banco de horas na tabela
      (capacidade de DP, contrato próprio). O próximo ciclo é o cadastro,
      preenchido **exclusivamente pelo RH**.
    - **Referência visual:** princípio de clareza de tabela e hierarquia de
      ações, apenas. Sem marca, texto, paleta, layout ou componente de
      terceiro.
    - **Dívida preservada:** R-3 (T162), S2 (T161), R1 a R3 (T160), L3,
      S-1 a S-4 (T158), R-A a R-C (T157) e o registro `teste michell`.

62. **T165 - Cadastro de colaborador pelo RH**
    - **Estado:** **integrada** em `main` pela PR #157, squash
      `9db194e6ee5fa25f82017557a8d77be3b6048d58`, com a CI de push 3/3 verde.
      Encerrada como **parada por regra declarada, com a decisão do
      proprietário registrada**. Branch `codex/t165-cadastro-colaborador-rh`
      preservada, criada a partir do squash
      `9df47566c3741bdeff68ae65bd6ffe1191a3a70b` (T164, PR #156). O inventário
      encontrou **quatro bloqueios independentes** e nenhuma interface foi
      escrita; o diagnóstico está em
      [`docs/decisions/t165-cadastro-colaborador-rh-bloqueio.md`](../docs/decisions/t165-cadastro-colaborador-rh-bloqueio.md).
    - **Bloqueios:** **B1** não existe criação sem admissão (única rota é
      `POST /v1/colaboradores` com `AdmitirColaboradorDto`; `Colaborador` não
      tem `empresa_id`, e cadastro sem vínculo ficaria fora de todo escopo);
      **B2** a direção diz `rh` + `master_tecnico`, o contrato diz `rh` + `dp`
      e nega `master_tecnico` em duas camadas (T030); **B3** não há dado
      cadastral além de `nome`; **B4** o formulário pedido já existe, com sete
      testes.
    - **Propostas originais 1 a 5, nenhuma iniciada:** 1 decisão de papel;
      2 cadastro em duas etapas (exige ADR de modelo); 3 melhorias no
      formulário atual; 4 cobrir com teste a negação de mutação ao
      `master_tecnico`; 5 projeção própria da listagem. Lista histórica do
      diagnóstico, numerada de 1 a 5 de propósito: as letras **A a E**
      pertencem exclusivamente à ordem aprovada, abaixo.
    - **DECISÃO DO PROPRIETÁRIO, registrada (não autoriza implementação):**
      - o fluxo passa a se chamar **"Admitir colaborador"**, porque criação,
        primeiro vínculo e empresa ativa são **atômicos** — o **B1 vira
        premissa**;
      - **`rh` e `dp` admitem**; `master_tecnico` não cria, edita nem admite
        pessoas; o funcionário não recebe link nem autopreenchimento. **Resolve
        o B2 a favor do contrato atual, sem mudar RBAC**;
      - o formulário será **progressivo**, em cinco blocos: admissão e vínculo;
        dados pessoais e contatos; organização; documentos e dados bancários;
        dependentes e complementos. **Só o primeiro tem contrato hoje**;
      - a **empresa vem da sessão ativa**, como contexto não editável, e não
        pode ser forjada no corpo;
      - **CPF, documentos, dados bancários, raça/etnia, deficiência, gênero,
        foto e dependentes** exigem **finalidade, acesso restrito, auditoria,
        retenção e contrato próprios** antes de qualquer implementação — o
        **B3 vira sequência de trabalho**;
      - as imagens de referência servem só para **agrupamento e clareza**, sem
        copiar marca, texto, identidade visual, layout, paleta, ícone ou
        componente.
    - **Ordem aprovada (letras A a E, exclusivas desta sequência):** **A**
      integrar a decisão documental da T165 — **cumprida** pela integração da
      PR #157, squash `9db194e`;
      **B** T166 — ADR de modelo, finalidade e acesso aos dados; **C**
      contrato, API e migrations; **D** admissão mínima; **E** expansão
      progressiva dos blocos. O **B4 continua válido**: o formulário atual é o
      ponto de partida da etapa D, não algo a refazer.
    - **Quem cadastra:** somente `rh` e `master_tecnico`. O funcionário **não**
      preenche, **não** recebe link e **não** participa de autopreenchimento.
    - **Fora de escopo:** importação, exportação, admissão, desligamento,
      banco de horas e edição.
    - **Contrato antes de interface:** inventário na fonte de rota, DTO,
      campos, obrigatoriedade, validações, resposta e RBAC; de como a empresa
      ativa participa da criação; das relações obrigatórias (vínculo
      funcional, cargo, departamento, unidade, equipe); e de qual fluxo de
      admissão já existe e quais campos pertencem a ele.
    - **Regra de parada:** se o contrato não permitir criação correta pelo RH
      sem inventar campo, relação ou regra, **parar** e entregar diagnóstico
      com proposta de fatias. Nenhum endpoint, migration, campo ou regra por
      suposição.
    - **Se houver contrato suficiente:** primeira fatia de "Novo colaborador"
      alcançável da tela atual — formulário do RH, validação de campos, envio
      seguro, sucesso, erro e retorno atualizado à lista.
    - **Empresa ativa:** aparece como contexto e é respeitada; o corpo da
      requisição não pode forjar outra empresa.
    - **Referência visual:** hierarquia e clareza apenas. Sem marca, texto,
      layout, paleta ou componente externo.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161),
      R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157) e o registro
      `teste michell`.

63. **T166 - Modelo e governança dos dados de admissão e perfil do colaborador** - **Estado:** **integrada** em `main` pela PR #158, squash
    `0c00afdc479193506e80eff0150dc4ddb785a41f`, com a CI de push 3/3 verde.
    Branch `codex/t166-adr-dados-colaborador` preservada, criada a partir do
    squash `9db194e6ee5fa25f82017557a8d77be3b6048d58` (T165, PR #157). É a
    **etapa B** da ordem aprovada na T165. **A tarefa foi integrada com a ADR
    0016 ainda proposta; o proprietário a aprovou em 2026-10-16
    (`DP-ADM-01`)**, sem fechar `DP-ADM-02` a `DP-ADM-18` nem dispensar a ficha
    de tratamento por categoria.
    - **Entregas:** [ADR 0016](../docs/adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md), com o modelo-alvo, as classes de
      acesso, a matriz de campos, a governança, o UX futuro, o plano técnico e
      dezoito decisões pendentes (`DP-ADM-01` a `DP-ADM-18`); e o
      [diagnóstico técnico](../docs/decisions/t166-dados-admissao-perfil-diagnostico.md), com a evidência na fonte e os achados
      D1 a D10, nenhum corrigido aqui.
    - **Correção registrada:** a Proposta original 4 da T165 errou duas de
      três afirmações — o avaliador e um E2E já cobrem a recusa de mutação ao
      `master_tecnico`; falta só o teste unitário de `resolverEscopoPessoas`.
      E a afirmação de que gênero e deficiência são dado sensível "na LGPD"
      não tem a lista do art. 5º, II a sustentá-la literalmente. Três notas aditivas no documento da T165 — na Proposta original 4, na §5.2 e na §5.5 —, texto original preservado.
    - **Natureza:** **ADR e diagnóstico técnico**. Nenhuma interface, API,
      endpoint, migration, schema, seed, banco ou alteração de RBAC. O cadastro
      visual não começa aqui.
    - **Investigação na fonte:** schema, contratos atuais, RBAC e a decisão
      da T165.
    - **Modelo-alvo separado por responsabilidade:** colaborador; vínculo e
      admissão; contatos e endereço; organização; documentos; dados bancários;
      dependentes; anexos e foto, se forem aprovados.
    - **Matriz de campos:** para cada campo pedido nas referências, o bloco, a
      finalidade de negócio, o perfil que lê e o que altera, a classificação
      (obrigatório para admissão, complementar, condicional ou fora de escopo)
      e a dependência de catálogo, contrato, decisão de retenção ou regra
      adicional.
    - **Governança:** `rh` e `dp` admitem; `master_tecnico` não cria, edita
      nem admite; empresa exclusivamente da sessão ativa; funcionário não
      preenche dado nesta fase; dado pessoal sensível, documento, foto e dado
      bancário exigem propósito explícito, acesso restrito, auditoria,
      retenção e contrato próprio.
    - **Sem suposição jurídica:** nenhuma base legal nem prazo de retenção é
      afirmado por suposição; o que depender de decisão jurídica ou do
      proprietário vira **decisão pendente**.
    - **UX futuro, só registrado:** admissão progressiva por blocos; contexto
      de empresa travado; campos condicionais; validação acessível; revisão
      antes de admitir; alerta de saída com dado não salvo; nenhuma seção
      vazia nem campo sem persistência.
    - **Plano técnico posterior, não iniciado:** contratos e migrations;
      admissão mínima; dados pessoais, contatos e organização; documentos e
      dados bancários; dependentes e anexos; portal do colaborador só depois
      de cada dado ter permissão e contrato próprios.
    - **Referência visual:** agrupamento e clareza apenas. Sem identidade,
      texto, marca, ícone, paleta, layout ou componente de terceiros.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161),
      R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157) e o registro
      `teste michell`.

64. **T167 - Admissão mínima segura: estabilizar o contrato existente** - **Estado:** **integrada** em `main` pela PR #159, squash
    `dcef62706399126b934c51e7d2955941cf9f06b3`, com a CI de push 3/3 verde.
    Branch `codex/t167-admissao-minima-segura` preservada, criada a partir do
    squash `0c00afdc479193506e80eff0150dc4ddb785a41f` (T166, PR #158).
    - **API:** `motivoCodigo` da admissão aceita só `admissao_inicial` e
      `outro_controlado` (`MOTIVOS_ADMISSAO`); os cinco motivos que pressupõem
      um vínculo existente — mudança de lotação, de cargo, correção e fim de
      vínculo — recebem 400. A resposta de `POST /v1/colaboradores` mantém o
      colaborador no topo e acrescenta `vinculo` e `movimentacao` em projeção
      fechada, sem dado pessoal novo. A admissão continua atômica; a lotação é
      o destino gravado na movimentação, e a alocação só nasce na efetivação
      (ADR 0007).
    - **Web:** a empresa da admissão é só a da sessão — o seletor saiu, a
      empresa aparece em leitura, e o formulário não envia se o servidor não
      devolver exatamente uma. Recusa do servidor vira erro no campo certo
      (409 → matrícula; 422 → referência organizacional; 404 → empresa ativa
      mudou); foco no primeiro erro; dados mantidos em falha recuperável;
      sucesso confirma com o que o servidor gravou e oferece abrir a ficha do
      admitido; "Cancelar" pede confirmação antes de descartar.
    - **Testes:** unitários da API (28: as duas camadas de autorização da
      admissão, incluindo `resolverEscopoPessoas`, e os motivos); E2E da
      admissão (resposta, motivos, `dp`, empresa divergente, negação a
      `master_tecnico` — global e com empresa ativa —, `gestor` e
      `colaborador`); web (tela e `Modal`).
    - **Achados da T166 tratados:** D1 (empresa no formulário), D2
      ("Cancelar"), D3 (motivo na admissão) e o teste unitário de
      `resolverEscopoPessoas`. D4 foi mitigado no cliente: o servidor continua
      sem erro por campo (`DP-ADM-15` aberto).
    - **Decisão pendente:** se `outro_controlado` vale para admissão. Ficou
      aceito, como antes, porque retirá-lo seria decidir o conteúdo do
      catálogo por tipo (`DP-29`, RH).
    - **Fora desta entrega, registrado:** readmissão (`POST /v1/vinculos`) não
      foi alterada; D7 e D8 seguem abertos.
    - **Limitação autorizada de validação:** **não houve validação em
      navegador.** A tarefa proibia iniciar ou alterar a API, o banco de
      demonstração e os processos que essa validação exige. O comportamento
      da tela está coberto por testes automatizados (web, API e E2E na CI);
      nenhuma verificação visual é declarada como feita.
    - **Objetivo:** estabilizar o contrato **que já existe** de admissão de
      colaborador antes de expandir qualquer dado pessoal previsto na ADR 0016.
    - **Escopo autorizado pelo proprietário:**
      - confirmar na fonte o fluxo de `POST /v1/colaboradores` — DTO, serviço,
        RBAC, formulário web e testes;
      - manter a admissão **atômica**: colaborador, primeiro vínculo, lotação e
        movimentação de admissão coerentes na mesma transação;
      - aceitar em `motivoCodigo` **somente** motivos válidos para admissão;
      - fazer a resposta de sucesso confirmar o colaborador e o vínculo
        criados, sem vazar dado pessoal novo ou restrito;
      - melhorar o formulário existente **dentro do contrato atual**: erro
        associado ao campo, foco no primeiro erro, dados preservados em falha
        recuperável, sucesso que confirma e leva a rota coerente, e aviso antes
        de descartar alterações;
      - testes de API, E2E e web proporcionais, incluindo negação explícita a
        `master_tecnico`, `gestor` e `colaborador`.
    - **Regras preservadas:** só `rh` e `dp` admitem; `master_tecnico` não cria,
      não edita e não admite; o colaborador não recebe convite, link nem
      autopreenchimento; a empresa vem só da sessão ativa e nunca de campo
      manipulável; admissão em empresa divergente do contexto ativo é recusada.
    - **Fora de escopo:** qualquer campo novo de perfil (CPF, documentos,
      endereço, contatos, foto, dados bancários, dependentes, deficiência,
      raça/etnia, gênero, nome social); schema, migration, seed e novos
      agregados; portal do colaborador; RBAC além das guardas e testes da
      admissão atual.
    - **Regra de parada:** se o contrato atual não permitir uma correção sem
      inventar regra de negócio, parar naquele ponto, registrar a evidência e
      pedir decisão. Sem dado simulado, sem campo vazio, sem N+1.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161),
      R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157) e o registro
      `teste michell`.

65. **T168 - Perfil do colaborador: dados de contato** - **Estado:** **integrada** em `main` pela PR #160, squash
    `db9b023dc11c9fcfa2397b016713939f119c0a6f`, com a CI de push 3/3 verde,
    como **parada por regra declarada, nos quatro campos**. Branch
    `codex/t168-perfil-colaborador-contatos` preservada, criada a partir do
    squash `dcef62706399126b934c51e7d2955941cf9f06b3` (T167, PR #159). A
    ficha que ela pedia foi aprovada pelo proprietário em 2026-10-16 e é
    formalizada na T169. Nenhuma
    migration, API, interface, teste de produto ou RBAC foi escrito.
    - **Evidência:** [`docs/decisions/t168-contatos-bloqueio-ficha.md`](../docs/decisions/t168-contatos-bloqueio-ficha.md). **E-mail pessoal, celular e telefone** são A2
      e Complementar, e dependem de ficha de tratamento (`FT`), contrato (`CTR`)
      e retenção (`RET`): **não existe ficha aprovada para nenhuma categoria**, e
      `DP-ADM-02` (finalidade e base legal) e `DP-ADM-03` (retenção) seguem
      abertas, com RH + Jurídico. **E-mail corporativo** é **Derivado** da conta
      de acesso (`access_user.email`, o login), não um campo de contato; o
      servidor não tem rota que altere o e-mail de uma conta.
    - **Acesso e auditoria de A2 já estão definidos** (`rh` e `dp` da empresa
      ativa; escrita auditada sem valores). Faltam finalidade, base legal,
      classificação, retenção e contrato, que são de RH + Jurídico.
    - **Para retomar:** a ficha em branco da §4.1 do documento, respondida por RH
      - Jurídico e Segurança; a emenda à ADR 0007; e, se o `master_tecnico` deve
        ficar fora de A2, a emenda à ADR 0012. O e-mail corporativo pede decisão
        própria do domínio de contas.
    - **Objetivo do proprietário:** o primeiro bloco complementar real do
      cadastro — **dados de contato do próprio colaborador**, preenchidos só
      por `rh` ou `dp`, depois da admissão. Campos pretendidos: e-mail
      pessoal, e-mail corporativo, celular e telefone.
    - **Condição:** só entra o campo que a ADR 0016 classificar como A2,
      complementar e **não bloqueado**, e cuja finalidade, acesso, auditoria e
      retenção estejam suficientemente definidos nos artefatos aprovados. Isso
      se **investiga antes** de criar migration ou interface.
    - **Regras do proprietário:** tela parte de colaborador já admitido, sem
      alterar a admissão atômica da T167; `rh` e `dp` consultam e editam na
      empresa ativa; `master_tecnico`, `gestor` e `colaborador` não consultam
      nem alteram; empresa e escopo só da sessão e do vínculo autorizado; nada
      na listagem, no Hub, no portal ou na visão de liderança; escritas
      auditadas no nível que a ADR prevê para A2; validação, limite e
      normalização no servidor; UX com seção própria, erro por campo, foco no
      primeiro erro, dados preservados em falha, confirmação de sucesso e aviso
      antes de descartar.
    - **Fora de escopo:** endereço, contato de emergência, documentos, CPF,
      foto, nome social, sexo, gênero, raça/etnia, deficiência, nacionalidade,
      estado civil, escolaridade, dados bancários, dependentes, dados
      contratuais, portal do colaborador, RBAC global, Docker, banco, seed e
      processos.
    - **Regra de parada:** o campo que ainda depender de finalidade, acesso,
      auditoria, retenção ou contrato não aprovado **não é implementado** nem
      tem regra inventada; registra-se a evidência e para só aquele item.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167.

66. **T169 - Contatos do colaborador**
    - **Estado:** **integrada** em `main` pela PR #161, squash
      `0fa2e1e930bc86f545d37839c42a385b3ed05cfa`, com a CI de push 3/3 verde. Branch
      `codex/t169-contatos-colaborador` preservada, criada a partir do squash
      `db9b023dc11c9fcfa2397b016713939f119c0a6f` (T168, PR #160).
    - **Pendências preservadas:** o processo de eliminação ou anonimização após 2 anos do desligamento; as rotas de exportação e exclusão de contatos, cuja auditoria é obrigatória quando existirem; a origem e a evidência da coleta, lacuna da ficha; a validação visual em navegador; e as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço), além da docstring do serviço de contatos que ainda descreve o `resourceId` de forma absoluta.
    - **Ficha aprovada pelo proprietário em 2026-10-16**, formalizada em
      [ficha de tratamento dos contatos](../docs/decisions/ficha-tratamento-contatos-colaborador.md): e-mail pessoal, celular e telefone; finalidade de cadastro e
      comunicação operacional durante a relação de trabalho; execução do
      contrato; retenção enquanto o vínculo estiver ativo e, após o
      desligamento, uso operacional bloqueado, 2 anos de guarda e então
      eliminação ou anonimização, salvo litígio, ordem judicial ou obrigação
      formal; A2 restrita; sem compartilhamento externo; sem RIPD nem MFA
      adicional nesta fase; auditoria de criação, leitura, edição, exportação e
      exclusão com campos afetados e nunca valores; `rh` e `dp` na empresa
      ativa; `master_tecnico` em qualquer empresa, auditado; `gestor`,
      `colaborador` e demais sem acesso.
    - **Emendas:** ADR 0007, Emenda 4 (a categoria além dos quatro dados
      aprovados); ADR 0012, Emenda 1 (`master_tecnico` em contatos). Na ADR
      0016, `DP-ADM-02`, `DP-ADM-03` e `DP-ADM-06` ficam resolvidas **só para
      Contatos**.
    - **Objetivo:** o agregado próprio de contatos do colaborador, fora de
      `Colaborador`, sem alterar a admissão atômica da T167. E-mail corporativo
      continua derivado de `access_user.email`.
    - **Banco:** migration `20261016120000_contatos_colaborador` **criada e não aplicada localmente**.
      `contato_colaborador` guarda o valor vigente por colaborador **e
      empresa** (`empresa_id` próprio, único por par), com CHECK da
      normalização e CONSTRAINT TRIGGERS diferidos que exigem vínculo do
      colaborador na empresa, nos dois lados. `contato_colaborador_evento`
      registra **toda consulta**, criação e edição, com colaborador, empresa
      quando conhecida, contato quando existe, ação, resultado e **nomes** dos
      campos — nunca valores —, correlacionado a `audit_event` por
      `request_id`; a coerência entre resultado, empresa, contato e campos é
      garantida por CHECK e trigger (migration `20261016130000_contatos_auditoria_toda_consulta`, criada e não aplicada
      localmente). `evolli_app` perde `DELETE` no contato e `UPDATE`/`DELETE`
      no evento. `Colaborador` não ganhou coluna.
    - **API:** `GET` e `PUT /v1/colaboradores/:colaboradorId/contatos`, com
      recurso de autorização próprio `contato_colaborador` (`read`/`alter`):
      `rh` e `dp` na empresa ativa; `master_tecnico` em qualquer empresa sem
      seleção e só na ativa com seleção; demais negados. A empresa real vem do
      vínculo, nunca do navegador. Estados `sem_registro`, `registrado` e
      `bloqueado` (nenhum vínculo previsto ou ativo na empresa: sem valor na
      leitura, 409 na edição). Inexistente e fora do escopo: o mesmo 404.
      Validação e normalização no servidor: e-mail aparado e minúsculo, até 254
      caracteres; celular e telefone só com dígitos, `+` opcional, 8 a 15
      dígitos, sem presumir país. Auditoria `pessoas.contato.criado`,
      `.atualizado` e `.consultado` na mesma transação da operação, para
      **toda consulta** — com valor, sem registro, bloqueada, o `PUT` sem
      alteração (registrado como leitura) e a tentativa do `master_tecnico`
      com empresa ambígua (registrada sem empresa, com `failure`). Nunca
      valores, corpo nem cabeçalhos brutos; IP e user-agent truncado são os
      metadados de segurança herdados da ADR 0004. `no-store` e redação dos
      três campos no logger.
    - **Web:** seção "Contatos" no detalhe do colaborador, com os três campos
      obrigatórios, erro por campo, foco no primeiro erro, dados preservados em
      falha, confirmação de sucesso e confirmação de descarte pelo `Modal`.
      Listagem, Hub, portal e visão do gestor não recebem contato.
    - **Testes:** unitários da API (87: normalização, validação, limite de
      254 do e-mail, matriz nas duas camadas, fase 2 isolada, serviço, trilha
      de cada cenário, auditoria sem valores); E2E no bloco da T169 de
      `pessoas.e2e-spec.ts`; web (11 da tela e 13 da regra no cliente).
    - **Limites:** a eliminação ou anonimização após 2 anos não tem processo
      nesta fatia; exportação e exclusão não têm rota, então ainda não há o que
      auditar; a origem e a evidência da coleta não foram especificadas pela
      ficha (lacuna registrada, sem solução proposta); os E2E rodam só na CI;
      sem validação visual em navegador, porque processos estão fora do
      escopo.
    - **Fora de escopo:** endereço, contato de emergência, CPF, documentos,
      foto, nome social, sexo, gênero, raça/etnia, deficiência, escolaridade,
      dados bancários, dependentes, dados contratuais, portal do colaborador,
      e-mail corporativo persistido no perfil, fluxo de admissão, Docker, banco
      de demonstração, seed e processos.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167.

67. **T170 - Migração controlada para Node 24 LTS**
    - **Estado:** **integrada** em `main` pela PR #162, squash
      `2fd19df9a86427cd3454d8d40ee282641ec83b65`, com a CI de push 3/3 verde em Node 24. Branch
      `codex/t170-node-24-lts` preservada, criada a partir do squash
      `0fa2e1e930bc86f545d37839c42a385b3ed05cfa` (T169, PR #161).
      Detalhes e evidências em [decisão da T170](../docs/decisions/t170-node-24-lts.md).
    - **Entregue:** `.nvmrc` em `24`; `engines.node` em `>=24 <25` nos três
      `package.json`; os três jobs da CI leem a versão do `.nvmrc`
      (`node-version-file`), a fonte única; README, guia de demonstração e
      `plan.md` atualizados. pnpm segue `10.0.0`, o lockfile não muda e nenhuma
      dependência troca de versão — `@types/node` segue em `^22`, como decisão
      separada.
    - **Compatibilidade:** nenhuma incompatibilidade causada pelo Node 24 foi
      encontrada, então não há correção de código. No Node 24.19.0, instalação
      limpa com lockfile congelado, `argon2` nativo e engines do Prisma 5.22
      funcionam; lint, typecheck, build e testes passam (API 968, web 1614,
      scripts 151), sem aviso de depreciação do runtime. As medições do `tsc`
      foram repetidas no Node 22.23.3, com resultado idêntico.
    - **Rollback, rota preferida (manual):** voltar `.nvmrc` e `engines` para
      Node 22 (a CI acompanha o `.nvmrc`); atualizar README, guia local,
      `plan.md` e os três comentários da CI que mencionam Node 24 LTS; refazer
      `pnpm install --frozen-lockfile`. Não toca o restante do Spec Kit — T169 e
      T170 continuam registradas. Não há migration, dado nem dependência a
      desfazer.
    - **Rollback, rota excepcional (`git revert` do squash):** não equivale à
      manual. Desfaz também a convergência da T169, o registro da T170 e o
      documento de decisão, e exige depois uma nova convergência documental
      para preservar a T169 como integrada.
    - **Pendência nova, de ambiente, não causada pelo Node 24:** no Windows, o
      `prisma generate` do `postinstall` grava o client em `node_modules/.prisma`
      na raiz, e o `tsc` da API estoura a pilha até rodar
      `pnpm --filter @evolli/api exec prisma generate`. Idêntico no Node 22; não
      aparece na CI em Linux.
    - **Objetivo:** levar a política do projeto para Node 24 LTS em tudo o que
      declara ou executa Node — `.nvmrc`, `engines`, CI e documentação —,
      mantendo pnpm 10.
    - **Regras:** nenhuma dependência de produto atualizada (Prisma, Nest,
      React, Vite, TypeScript e demais); nenhuma mudança funcional de RH,
      contatos, auditoria, RBAC, schema ou migrations de negócio; só se
      corrige incompatibilidade comprovadamente causada pelo Node 24; a
      estratégia de rollback para Node 22 fica registrada.
    - **Fora de escopo:** pnpm 11, migration aplicada localmente, seed e banco
      de demonstração.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. As pendências da T169 seguem abertas: o processo de eliminação ou anonimização após 2 anos do desligamento; as rotas de exportação e exclusão de contatos, cuja auditoria é obrigatória quando existirem; a origem e a evidência da coleta, lacuna da ficha; a validação visual em navegador; e as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço), além da docstring do serviço de contatos que ainda descreve o `resourceId` de forma absoluta.

68. **T171 - Ambiente local Windows em Node 24 e pnpm 10, com prévia validada**
    - **Estado:** **integrada** em `main` pela PR #163, squash
      `bd860b0d303c97e59aed0f85f540db8303380092`, com a CI de push 3/3 verde em Node 24. Branch
      `codex/t171-ambiente-local-node24`, a partir do squash
      `2fd19df9a86427cd3454d8d40ee282641ec83b65` (T170, PR #162). Detalhes e
      evidências em [decisão da T171](../docs/decisions/t171-ambiente-local-node24.md).
    - **Causa comprovada:** no Prisma 5.22, `getDefaultOutdir` compara o
      caminho com barra normal (falha no Windows) e, no `postinstall`, grava em
      `INIT_CWD/node_modules/.prisma/client` — a raiz do repositório, onde o
      `@prisma/client` não encontra o client.
    - **Correção:** o `postinstall` da API roda o mesmo `prisma generate` por
      `scripts/prisma-generate-api.mjs`, sem `INIT_CWD`, e confere no fim que o
      client desta rodada ficou ao lado do `@prisma/client`; se não ficou, a
      instalação falha com a causa. Nenhuma dependência muda. O passo 1/8 da
      demonstração passou a exigir o Node do `.nvmrc` e o pnpm do
      `packageManager`. Testes em `test:scripts`, sem Prisma real: 16 da execução do
      wrapper com efeitos injetados, 5 dos efeitos reais, 8 da trava e 2 da CLI
      da demonstração; restaurar o `INIT_CWD`, remover a falha de client
      ausente ou antigo e omitir a versão do Node reprovam.
    - **Prévia validada no navegador** em `http://127.0.0.1:5173` (API em
      `127.0.0.1:3100`, banco de demonstração em `127.0.0.1:5433`): oito passos,
      17 migrations do zero e seed sintético; login, Hub, colaboradores, contatos
      (erro por campo, gravação normalizada) e troca de empresa sem resíduo, com
      404 do servidor para o colaborador da empresa anterior.
    - **Pendências novas:** a seção Contatos tem um vão vertical de 256 px
      (defeito visual da T169: o aviso reaproveita `colaboradores-screen__aviso-texto`,
      com `flex: 1 1 16rem`); o Node 24 emite `[DEP0190]` no orquestrador da
      demonstração no Windows (`shell: true` com argumentos), só aviso.
    - **Objetivo:** fazer a prévia local funcionar no Windows com Node 24 e pnpm
      10, sem depender de Node 22 nem de `prisma generate` manual depois da
      instalação, e validar no navegador a versão atual da `main`.
    - **Escopo:** diagnosticar e resolver o fluxo de instalação e preparação
      que hoje exige `prisma generate` manual; garantir uso local reproduzível
      de Node 24 e pnpm 10; alterar scripts, testes e documentação só se
      necessário; subir o ambiente de demonstração local, com migrations e seed
      apenas no banco local de demonstração; validar no navegador login, Hub,
      troca de empresa autorizada, listagem de colaboradores e contatos.
    - **Regras:** nenhuma dependência atualizada; pnpm 11 fora; nenhuma mudança
      em funcionalidade de RH, contatos, RBAC, schema ou migrations de negócio,
      salvo correção estritamente necessária ao ambiente e comprovada; nada de
      produção, credencial real, banco ou Docker externos; `.env`,
      `node_modules`, gerados, credenciais, caches e alterações automáticas de
      `pnpm-workspace.yaml` não são versionados.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2, N-3 e N-4 da revisão final; e a docstring do serviço de contatos sobre `resourceId`. A
      pendência da T170 (client do Prisma na raiz de `node_modules` no Windows)
      foi o objeto desta tarefa e está resolvida.

69. **T172 - Correção visual da seção Contatos do detalhe de Colaborador**
    - **Estado:** **integrada** em `main` pela PR #164, squash
      `ecf3cbebcf8e7dd856750468a42c284c5525755e`, com a CI de push 3/3 verde em Node 24. Branch
      `codex/t172-correcao-visual-contatos`, a partir do squash
      `bd860b0d303c97e59aed0f85f540db8303380092` (T171, PR #163). Detalhes e
      evidências em [decisão da T172](../docs/decisions/t172-correcao-visual-contatos.md).
    - **Entregue:** classe própria `colaboradores-screen__contatos-aviso`, só com
      `margin: 0` e a cor de antes, sem nenhuma propriedade `flex`; a regra
      compartilhada da T111 não foi tocada. Aviso do estado vazio de 256 px para
      25 px e formulário de 664 px para 433 px, medidos no navegador.
    - **B-1 resolvido por autorização do proprietário (2026-10-19):** a revisão
      adversarial no head `7606715` apontou como bloqueio a extensão ao estado
      bloqueado. O proprietário autorizou: “A T172 pode corrigir o vão vertical do aviso nos dois estados equivalentes da seção Contatos: sem registro e bloqueado. Ambos usam o mesmo padrão inadequado dentro do mesmo componente; a extensão não autoriza outras correções visuais.” O código revisado não mudou.
      As observações O-1 a O-5 seguem não bloqueantes e não foram tratadas.
    - **Achado, mesma causa:** o aviso do estado **bloqueado** usava a mesma classe
      flexível na mesma seção em coluna e também media 256 px (75 px depois); a
      correção cobre os dois estados.
    - **Testes:** 3 de componente (vazio, bloqueado e com contatos) e 4 de contrato
      de CSS (a classe própria sem `flex*` nem altura, só token de cor, a regra da
      T111 intacta e a seção ainda coluna flex); 9 mutações reprovam, entre elas
      reintroduzir a classe flexível e "consertar" alterando a regra da T111.
    - **Validação no navegador**, só no ambiente local de demonstração: envio vazio
      mantém erros e foco; salvar normaliza e confirma; o estado com contatos
      continua correto; a troca Alfa → Beta segue sem resíduo, com 404 do servidor
      para as pessoas da Alfa na empresa Beta.
    - **Objetivo:** corrigir o vão vertical de cerca de 256 px que a seção
      Contatos mostra quando não há registro. A causa já está confirmada: o
      aviso reaproveita `colaboradores-screen__aviso-texto`, com
      `flex: 1 1 16rem`, dentro de um formulário em coluna.
    - **Escopo único:** estilo e estrutura próprios, semanticamente adequados
      ao estado vazio de Contatos, sem alterar o estilo compartilhado da T111;
      testes do estado vazio, inclusive que a classe flexível da T111 não é
      usada nele; validação no navegador só no ambiente local de demonstração.
    - **Preservado integralmente:** rotas, permissões, auditoria, normalização,
      validação, dados, schema, migrations, banco, seed e gravação dos
      contatos; as três obrigatoriedades (**substituídas** na T179: contatos
      opcionais) e os erros por campo; isolamento por
      empresa ativa e tratamento do master técnico; Node 24, pnpm 10, Prisma e
      scripts de ambiente.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes).

70. **T173 - Consolidação do fluxo de admissão, vínculo e desligamento conforme respostas RH/DP** - **Estado:** **integrada** em `main` pela PR #165, squash
    `2a9072040d64daa50326aa18f1602bb160eaae30`, com a CI de push 3/3 verde em Node 24. Branch
    `codex/t173-fluxo-admissao-vinculo-desligamento`, a partir do squash
    `ecf3cbebcf8e7dd856750468a42c284c5525755e` (T172, PR #164). A integração
    **não aceita a ADR 0017** nem fecha gate algum.
    - **Natureza:** tarefa **exclusivamente documental**. Fonte primária: as 40
      respostas de RH/DP entregues pelo proprietário na conversa da tarefa, em
      2026-10-19. Sem fonte externa, sem interpretação jurídica e sem código.
    - **Entregas previstas:** uma ADR com o fluxo aprovado e a separação entre
      pessoa, vínculo, solicitação, admissão em andamento, admissão efetivada,
      vínculo ativo, movimentações futuras e desligamento; e um diagnóstico de
      reconciliação que confronta as respostas com os contratos e o modelo
      atuais e lista, sem resolvê-los, os gates anteriores a qualquer
      implementação.
    - **Entregue:** [ADR 0017](../docs/adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md), proposta, com o fluxo de oito etapas, a separação
      dos conceitos que as respostas distinguem (dez linhas na tabela da ADR, sem fixar como domínio os que estão em conflito) e os papéis segundo as respostas; o [diagnóstico de reconciliação](../docs/decisions/t173-reconciliacao-fluxo-rh-dp.md), com a
      matriz por tema, **13 conflitos com decisões fechadas** e **22 gates**
      (`DP-FLX-01` a `DP-FLX-22`), nenhum resolvido; e o [registro literal das respostas](../docs/decisions/t173-respostas-rh-dp.md), R1 a R40.
    - **Conflitos nomeados (13; 5 condicionais; o 13, da diretriz de UX, está no item seguinte):** CPF como identificação da
      pessoa, pela R37 (ADR 0007, decisão 2); matrícula só na efetivação
      (Baseline V1, decisão 15, e matrícula obrigatória do vínculo; a decisão 2
      não é contrariada); mais de um vínculo ativo na **mesma** empresa,
      **condicional**, porque a R4 não o afirma (decisão 3) — em empresas
      diferentes o índice atual já é compatível, e falta só reconhecer a
      pessoa; gestor **registrar** solicitação e **aprovar** (ADR 0015,
      `PD-SOL-01` e a negação na Central), sem nunca criar, editar ou efetivar;
      workflow de aprovação (decisão 7); tipo que determina obrigatoriedade,
      **condicional** à leitura de "comportamento" (ADR 0007, decisão 4); gestor
      como atributo do vínculo, **condicional**; justificativa em texto livre,
      **condicional** (decisão 11); valores antes/depois **na trilha formal**,
      **condicional** (ADR 0004, decisão 5); motivos de desligamento com
      classificação trabalhista; projeção do desligamento ao gestor (ADR 0015,
      decisão 7); documento por vínculo e período (`DP-2E-07`). Fora da lista: a
      correção de nome que sobrescreve é divergência de comportamento, e a
      diretoria como escalonamento fora do sistema é tensão com a R8.
    - **Correção pós-revisão (2026-10-19):** a revisão adversarial no head
      `7059db6` apontou B-1 a B-5 e O-1 a O-7, corrigidos num commit só
      documental, com R1 a R40 de conteúdo literal e semanticamente idêntico, preservadas as normalizações editoriais declaradas. A ADR 0017 passou a
      separar fato recebido, conflito técnico e decisão pendente, e deixou de
      fixar como domínio os conceitos em conflito. O gestor ficou expressamente
      sem mutação até decisão e RBAC próprios. A R31 foi reconciliada com o
      `master_tecnico`: trata de conteúdo documental, que não existe, e a
      exceção dos contatos A2 continua como está. Os gates passaram a separar
      responsável vindo das respostas, de decisão anterior ou a definir, e
      ganharam o `DP-FLX-20`.
    - **Diretriz de UX proposta pelo proprietário (2026-10-19), sem
      autorização de implementação:** cadastro completo e admissão em tela
      própria e rota dedicada, sem modal; modal só para consulta rápida,
      confirmação, seleção curta ou edição pontual autorizada; o mesmo
      princípio nos demais cadastros extensos; admissão progressiva em oito
      grupos de referência, que não autorizam campo; imagens só para
      agrupamento. Conflita com a T142, implementada (cadastro e detalhe em modal); a T146, ainda não integrada, repete a regra
      — conflito 13, `DP-FLX-21` —, e os grupos de fuso e dados adicionais
      ficam em `DP-FLX-22`.
    - **Sequência proposta de fatias:** 0 a 10, só como proposta; cada fatia
      depende dos seus gates e de autorização expressa.
    - **Fora de escopo, declarado:** autopreenchimento pelo colaborador; acesso
      do gestor a dados pessoais, bancários, médicos ou contratuais restritos;
      upload documental, integração de folha, notificação operacional,
      exportação e exclusão; e qualquer mudança em RBAC, API, schema,
      migration, banco, seed, Docker ou interface.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c.

71. **T174 - Dossiê de decisões da Fatia 0 da ADR 0017** - **Estado:** **integrada** em `main` pela PR #166, squash
    `34b95cfde73f33dfc1200f1c846f6b8d7d14a1b8`, com a CI de push 3/3 verde em Node 24. Branch
    `codex/t174-dossie-decisoes-fatia-0`, a partir do squash
    `2a9072040d64daa50326aa18f1602bb160eaae30` (T173, PR #165). A integração
    **não aceita a ADR 0017** nem fecha gate algum.
    - **Natureza:** etapa **exclusivamente decisória e documental**. Fontes
      permitidas: a ADR 0017; o diagnóstico e o registro R1 a R40 da T173; as
      ADRs e os contratos existentes; e o código e os testes atuais, só como
      evidência. Sem fonte externa, sem Notion e sem referência de Sólides além
      do que já está documentado.
    - **Entrega prevista:** um dossiê de decisões que prioriza os gates por
      faixas de decisão, com os fatores e o desempate explicados, e, para cada gate priorizado, traz a
      decisão exata, as alternativas reais, o impacto (regras atuais, dados,
      RBAC, auditoria, UX e migração), o responsável, a evidência e o que
      continua bloqueado. Começa por `DP-FLX-01`, deixando explícito que a ADR
      0017 segue **Proposta** e não pode ser aceita sem autorização expressa do
      proprietário. `DP-FLX-05`, `-09`, `-10`, `-02`, `-03` e `-21` entram como
      decisões candidatas seguintes, **sem serem resolvidas**. Termina com uma
      recomendação de qual decisão tomar primeiro.
    - **Entregue:** o [dossiê de decisões](../docs/decisions/t174-dossie-decisoes-fatia-0.md), com a priorização dos 22 gates por
      **faixas de decisão**, fatores (dependência, risco, insumo externo e
      desbloqueio de comportamento) e desempate explicados, **sem alegar ordenação
      matemática total**, e oito fichas de decisão (`DP-FLX-01`, `-04`, `-21`,
      `-10`, `-02`, `-03`, `-05` e `-09`), cada uma com decisão exata, alternativas
      reais, impacto por alternativa (rotulado como análise técnica do dossiê) em
      regras atuais, dados e migração, RBAC, auditoria e UX, responsável,
      evidência e o que continua bloqueado. 149 citações `caminho:linha` e 63
      conferências de conteúdo foram verificadas por script.
    - **Acréscimo à lista pedida:** o `DP-FLX-04` (estados do processo
      admissional) ganhou ficha própria, porque a análise de dependências o põe
      antes de matrícula, gestor e alçadas.
      - **Correção pós-revisão (2026-10-19):** a revisão adversarial no head
        `54143b4` apontou três bloqueios e três observações, corrigidos sem reescrever
        commits. (1) A regra de priorização passou a descrever o método realmente
        usado, por faixas, com a única exceção de julgamento declarada (`DP-FLX-10`
        na faixa 3), e a afirmação de que só as ordens 12 a 14 tinham portão externo
        foi retirada. (2) O `DP-FLX-06` foi reclassificado como risco Médio: nascimento,
        endereço e contato de emergência são A2 na ADR 0016, e o MFA imposto vale só
        para número de documento e dado bancário; a dependência `DP-FLX-05` →
        `DP-FLX-06` saiu. (3) As perguntas a RH/DP sobre R8 e R7/R17 ficaram abertas,
        sem hipótese embutida, e as de R4 e R10 passaram a citar a resposta. Também: a
        lista de fontes só traz o que as fichas citam, o aceite do `DP-FLX-01` não
        autoriza, por nome, CPF, vínculos múltiplos, matrícula, solicitação ou
        aprovação pelo gestor, alçadas nem UX, e o impacto de cada ficha é rotulado
        como análise técnica.
    - **Recomendação, não decisão:** decidir primeiro o `DP-FLX-01`, aceitando a
      ADR 0017 como está, e depois o `DP-FLX-04`; deixar `DP-FLX-05` e `DP-FLX-09`
      para o fim por risco e portões externos; e levar a RH/DP quatro perguntas de
      esclarecimento (R4, R10, R8 e R7/R17). **Nada foi decidido**, a ADR 0017
      continua **Proposta** e os 13 conflitos e os 22 gates seguem abertos.
    - **Fora de escopo:** criar, editar ou migrar schema; criar endpoint, tela,
      RBAC, teste de produto, seed, Docker, processo ou integração; aceitar a
      ADR 0017; e resolver qualquer gate.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c. Pendências da T173: os 13 conflitos com decisões fechadas (8 firmes e 5 condicionais) e os 22 gates `DP-FLX-01` a `DP-FLX-22`, **todos abertos**; a ADR 0017, que continua **Proposta**; e as observações não bloqueantes O-1 (a linha 9 do corpo da PR diz "mesmo hash", exato só até `fca0fe7`), O-2 (a célula "Reabre ou depende de" do `DP-FLX-21` cita a T146 sem o qualificador "ainda não integrada"), O-3 (quebra de linha curta na ADR) e O-4 ("proposta aprovada" × "fundação visual aprovada" para a T146).

72. **T175 - Aceite da ADR 0017 e resolução do `DP-FLX-01`**
    - **Estado:** **integrada** em `main` pela PR #167, squash
      `3a9ed3b21bbb4254f33750a705edbad89a8a642b`, com a CI de push 3/3 verde em Node 24. Branch
      `codex/t175-aceite-adr-0017`, a partir do squash
      `34b95cfde73f33dfc1200f1c846f6b8d7d14a1b8` (T174, PR #166). A integração
      resolveu só o `DP-FLX-01`; na data dela, seguiam abertos os 13 conflitos e
      os 21 gates `DP-FLX-02` a `DP-FLX-22`.
    - **Natureza:** entrega **exclusivamente documental**. Registra a decisão do
      proprietário, entregue na conversa da tarefa em 2026-10-20: aprovar a ADR
      0017 e resolver o gate `DP-FLX-01`.
    - **Entrega prevista:** o status da ADR 0017 passa de Proposto a Aceito, com a
      data e a referência à aprovação do proprietário e ao `DP-FLX-01`; o
      `DP-FLX-01` fica registrado como resolvido, preservado no histórico de
      decisões; e a ADR, o Spec Kit e a descrição da PR deixam explícito o que o
      aceite **não** faz. O `DP-FLX-04` continua como a próxima decisão de
      conteúdo recomendada, **sem ser resolvido**.
    - **Entregue:** a ADR 0017 passou a **Aceito** em 2026-10-20, por aprovação do
      proprietário, com o `DP-FLX-01` registrado como **resolvido**: no `Status` e
      numa nota de aceite ao final da ADR, preservado o texto proposto, e numa
      atualização datada na seção 4 do diagnóstico da T173, que mantém a linha do
      gate na tabela. O aceite **não fecha** os demais 21 gates (`DP-FLX-02` a
      `DP-FLX-22`), **não resolve** nenhum dos 13 conflitos, **não autoriza
      implementação** e **não aprova** CPF, múltiplos vínculos, matrícula na
      efetivação, solicitação ou aprovação pelo gestor, alçadas, documentos,
      dados sensíveis nem a diretriz de UX. O `DP-FLX-04` continua como a próxima
      decisão de conteúdo recomendada, **sem ser resolvido**.
    - **Correção pós-revisão (2026-10-20):** a revisão adversarial no head
      `0c06781` apontou um bloqueio, corrigido sem reescrever commits: a nota de
      aceite punha as categorias do `DP-FLX-06` entre os dados sensíveis ou
      restritos. Agora esse item cita só o `DP-FLX-15` e o `DP-FLX-16`, com o
      enquadramento legal como sensível a cargo de RH + Jurídico (ADR 0016,
      decisão 5), e o `DP-FLX-06` tem item próprio: data de nascimento, endereço
      e contato de emergência, classe A2 na ADR 0016, ainda sem ficha de
      tratamento aprovada. Também: remissão histórica na seção 6 do diagnóstico
      da T173 e o squash completo da T174 na tabela do `execution-status.md`.
    - **Fora de escopo:** código, API, schema, migration, RBAC, teste de produto,
      Docker, banco, seed, dependência e lockfile; resolver qualquer outro gate ou
      conflito; e autorizar implementação.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c. Pendências da T173: os 13 conflitos com decisões fechadas (8 firmes e 5 condicionais), **todos abertos**; dos 22 gates, o `DP-FLX-01` foi **resolvido** na T175, e os 21 restantes (`DP-FLX-02` a `DP-FLX-22`) seguem **abertos**; a ADR 0017, **aceita** na T175 sem autorizar implementação; e as observações não bloqueantes O-1 (a linha 9 do corpo da PR diz "mesmo hash", exato só até `fca0fe7`), O-2 (a célula "Reabre ou depende de" do `DP-FLX-21` cita a T146 sem o qualificador "ainda não integrada"), O-3 (quebra de linha curta na ADR) e O-4 ("proposta aprovada" × "fundação visual aprovada" para a T146). Pendências da T174: as observações não bloqueantes da revisão final O-1 (a justificativa da faixa 6 diz que `-18` vem antes de `-22` pela consideração 3, quando a ordem se sustenta pela consideração 5), O-2 (o parágrafo de portões externos lista `-14` entre as fichas de RH + Jurídico, quando o insumo da tabela é o Nível 2 da Etapa 2) e O-3 (a lista de fontes diz "que as fichas citam" e inclui a ADR 0004, citada só na tabela da seção 3); e o erro de redação "aliquotas de aprovacao" na mensagem do commit `54143b4`, preservado no squash.

73. **T176 - Preparação da decisão do `DP-FLX-04` e Nova admissão em página própria (trilha acelerada)**
    - **Estado:** **integrada** em `main` pela PR #168, squash
      `58fd37ccc72d12cf21c9739ed6395c6a302bb1ef`, com a CI de push 3/3 verde em Node 24. Branch
      `codex/t176-estados-processo-admissional`, a partir do squash
      `3a9ed3b21bbb4254f33750a705edbad89a8a642b` (T175, PR #167). Na data da
      integração: 13 conflitos, 12 abertos e 1 resolvido; 22 gates, `DP-FLX-01` e
      `DP-FLX-21` resolvidos e 20 abertos.
    - **Natureza na abertura:** entrega **exclusivamente documental**. Fontes permitidas: a
      ADR 0017 aceita; o dossiê da T174; o diagnóstico e as respostas R1 a R40 da
      T173; e as ADRs, os contratos, o código e os testes atuais, só como
      evidência. Sem fonte externa, Notion, dado real ou referência de terceiros.
    - **Mudança de direção (2026-10-20):** a proprietária autorizou a **trilha
      acelerada** de admissão e a evolução dos demais módulos, com entrega
      funcional visível sem liberar dados, regras ou gates pendentes, e pediu que
      a T176 fosse a primeira entrega dessa trilha. Os dois commits documentais
      já feitos foram mantidos, sem reescrever histórico. Na mesma data, ela
      **resolveu o `DP-FLX-21`**: cadastro longo e estruturado de admissão em
      página própria; modal só para consulta, confirmação, seleção curta e edição
      delimitada; a decisão substitui a direção anterior de modal somente para
      esse tipo de cadastro e módulos equivalentes; e não autoriza campo, regra,
      dado ou processo novo. O `DP-FLX-04` continua aberto, com os outros 19
      gates abertos; dos 13 conflitos, 12 seguem abertos e o conflito 13 está
      resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20.
    - **Entrega prevista:** um documento de decisão do `DP-FLX-04` que separa o
      processo admissional do vínculo efetivado; propõe alternativas reais de
      máquina de estados, sem escolher nenhuma; mapeia, para cada uma, estados,
      transições, cancelamento, devolução para correção, responsabilidades,
      auditoria e efeitos sobre matrícula, vínculo, lotação e movimentação; mostra
      a compatibilidade de cada uma com a admissão atômica de hoje; declara o que
      fica proibido até a decisão; e termina com uma pergunta decisória objetiva e
      uma recomendação técnica identificada como análise.
    - **Entregue:** o [documento de decisão](../docs/decisions/t176-decisao-dp-flx-04-estados-processo-admissional.md) do `DP-FLX-04`, com a separação entre processo
      admissional, admissão efetivada, vínculo efetivado e vínculo ativo; a linha
      de base da admissão atômica de hoje; três alternativas de onde o processo
      vive (A, estender a movimentação de admissão; B, processo próprio com tudo
      nascendo na efetivação; C, processo próprio sobre vínculo `previsto` criado
      cedo), cada uma com estados, transições, cancelamento, devolução,
      responsabilidades, auditoria, efeitos sobre matrícula, vínculo, lotação e
      movimentação e compatibilidade com a admissão atômica; as subalternativas de
      ativação (2.i a 2.iii), de quem opera (3.i e 3.ii) e de correção
      pós-efetivação (4.i e 4.ii); o que fica proibido até a decisão; e a pergunta
      decisória. 72 citações `caminho:linha` e 51 conferências de conteúdo
      verificadas por script.
    - **Recomendação, não decisão:** `B; 2.ii; 3.i; 4.i`, identificada como
      análise do documento. **O `DP-FLX-04` continua aberto** e P1 a P4 seguem
      sem resposta.
    - **Entregue na trilha acelerada:** o registro do `DP-FLX-21` como resolvido
      (nota na ADR 0017, atualização datada nas seções 4 e 5 do diagnóstico da
      T173, atualização na decisão visual da T142 e nota no documento do
      `DP-FLX-04`) e a [página de Nova admissão](../apps/web/src/screens/pessoas/NovaAdmissaoScreen.tsx), fora de modal, para `rh` e `dp`, com destino
      próprio na navegação e no Hub e a primeira rota de URL do painel
      (`#/pessoas/nova-admissao`). A página usa só o contrato atual de
      `POST /v1/colaboradores` (admissão atômica: colaborador, vínculo `previsto`
      e movimentação), mostra a empresa ativa só para leitura, ancora os erros nos
      campos e foca o primeiro, preserva os dados na falha, pede confirmação ao
      cancelar com dados, confirma com o que o servidor gravou e oferece abrir a
      ficha do admitido e completar os contatos já aprovados (T169).
    - **Transição:** o formulário de admissão em modal da tela de Colaboradores
      continua existindo nesta entrega, por instrução da proprietária, até a
      página nova ser validada. É transitório, não a solução definitiva.
    - **Correção pós-revisão (2026-10-20):** a revisão adversarial no head `e33bf6e`
      apontou que o Spec Kit mantinha os 13 conflitos como todos abertos, embora a
      decisão do `DP-FLX-21` já tivesse substituído a direção de modal que o conflito
      13 contesta. O conflito 13 passou a resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20, preservado no histórico;
      as contagens são 13 conflitos no total, 12 abertos e 1 resolvido (o conflito 13, resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20); 22 gates no total, com o `DP-FLX-01` e o `DP-FLX-21` resolvidos e 20 abertos. A T146 ganhou nota histórica, sem ser
      apresentada como integrada. Também: a rota recusada mantém a tela atual e devolve
      a URL a ela, com regressão para `master_tecnico`, `gestor` e `colaborador`; e
      ganharam teste a descrição do cartão no Hub, o texto "Nada foi salvo" do
      descarte e o contrato de CSS que impede o vão da confirmação.
    - **Fora de escopo:** resolver o `DP-FLX-04`, o `DP-FLX-10`, o `DP-FLX-02`, o
      `DP-FLX-03` ou qualquer outro gate além do `DP-FLX-21`; entidade de processo
      admissional, matrícula na efetivação, CPF, nascimento, endereço,
      documentos, dados bancários, dependentes, saúde, dado sindical, múltiplos
      vínculos, solicitação ou aprovação pelo gestor, alçadas, ativação
      automática e qualquer dado pessoal novo; API, schema, migration, contrato
      de admissão, RBAC, auditoria, Docker, banco, seed, dependência e lockfile.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c. Pendências da T173: dos 13 conflitos com decisões fechadas (8 firmes e 5 condicionais), **12 seguem abertos** e o conflito 13 está resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20; dos 22 gates, o `DP-FLX-01` foi **resolvido** na T175 e o `DP-FLX-21` na T176, e os 20 restantes (`DP-FLX-02` a `DP-FLX-20` e `DP-FLX-22`) seguem **abertos**; a ADR 0017, **aceita** na T175 sem autorizar implementação; e as observações não bloqueantes O-1 (a linha 9 do corpo da PR diz "mesmo hash", exato só até `fca0fe7`), O-2 (a célula "Reabre ou depende de" do `DP-FLX-21` cita a T146 sem o qualificador "ainda não integrada"), O-3 (quebra de linha curta na ADR) e O-4 ("proposta aprovada" × "fundação visual aprovada" para a T146). Pendências da T174: as observações não bloqueantes da revisão final O-1 (a justificativa da faixa 6 diz que `-18` vem antes de `-22` pela consideração 3, quando a ordem se sustenta pela consideração 5), O-2 (o parágrafo de portões externos lista `-14` entre as fichas de RH + Jurídico, quando o insumo da tabela é o Nível 2 da Etapa 2) e O-3 (a lista de fontes diz "que as fichas citam" e inclui a ADR 0004, citada só na tabela da seção 3); e o erro de redação "aliquotas de aprovacao" na mensagem do commit `54143b4`, preservado no squash. Pendências da T175: as observações não bloqueantes da revisão final O-1 (o item do `DP-FLX-06` na nota de aceite não cita a questão do contato "telefone ou e-mail" frente aos três campos da T169), O-2 (dado sindical sem classe própria na ADR 0016, agrupado com os sensíveis ou restritos só pela ressalva de RH + Jurídico) e O-3 (a CI rodou Node 24 em dois patches, `v24.21.0` e `v24.22.0`, porque o `.nvmrc` fixa só a versão principal).

74. **T177 - Cadastro de colaborador, Módulo 1: Dados pessoais, Endereço e Contatos na Nova admissão**
    - **Estado:** **integrada** em `main` pela PR #169, squash
      `0f573765463b7b6af3ee40a41c4f32636b0151fa`, com a CI de push 3/3 verde em Node 24
      (602 E2E e 1022 unitários). Branch `codex/t177-cadastro-modulo-1` preservada; partiu do
      squash `58fd37ccc72d12cf21c9739ed6395c6a302bb1ef` (T176, PR #168).
    - **Mudança de direção da proprietária (2026-10-20):** o cadastro de
      colaborador passa a ser implementado **módulo por módulo, com entregas
      funcionais**. Todo campo ou grupo das referências visuais e das instruções
      da proprietária deve ser rastreado e atendido, nunca omitido em silêncio.
    - **Entrega prevista:** implementação real do Módulo 1 na página própria de
      Nova admissão, em três blocos — Dados pessoais, Endereço e Contatos —, com
      migration e modelo quando necessário, contrato de API, validação no servidor
      e no cliente, autorização e auditoria, testes unitários, E2E e web, e
      demonstração no navegador com dados sintéticos. Os Contatos reutilizam o
      modelo já aprovado na T169, sem segunda fonte para e-mail, celular e
      telefone. A empresa ativa continua contexto não editável, e RH e DP
      continuam os operadores da admissão.
    - **Ficha de tratamento:** os dados pessoais e o endereço estão na matriz da
      ADR 0016 como "Complementar" (a classificação A2 foi aprovada com a ficha), que exige ficha aprovada (decisão 5.4) e emenda
      à ADR 0007, como foi feito com os Contatos na T169. Por decisão da
      proprietária, a ficha foi redigida **nesta mesma PR**, e o merge dependia
      da aprovação dela — dada em 2026-10-20.
    - **Matriz de cobertura:** cada campo e grupo dos prints que a proprietária
      anexar entra numa matriz no corpo da PR, como implementado, "próximo módulo"
      ou "decisão necessária", com motivo objetivo e módulo previsto.
    - **Recorte confirmado pela proprietária (2026-10-20):** nome social e gênero
      saíram do Módulo 1 e foram para a matriz; país, cidade e estado são texto
      validado nesta primeira entrega, sem consulta externa de CEP. Fuso horário
      **não** foi decidido: fica na matriz como decisão pendente, sem descarte.
    - **Correção da revisão da PR #169 (2026-10-20), por decisão da proprietária:**
      (1) `master_tecnico` é cargo de confiança e acessa dados pessoais e
      endereço em qualquer empresa — com empresa ativa, só nela; sem empresa
      ativa, na empresa real do vínculo; com vínculo em mais de uma empresa, 409
      e trilha sem empresa —, no desenho já aprovado para contatos (Emenda 2 da
      ADR 0012); (2) nome completo, data de nascimento, e-mail pessoal, celular e
      telefone são **obrigatórios** na admissão (**regra substituída** na T179 em
      2026-10-21: e-mail pessoal, celular e telefone opcionais), e os demais campos do Módulo 1,
      opcionais, expressos campo a campo na ficha, no contrato e na tela; (3) a
      matriz não marca fuso horário como descartado. Com a obrigatoriedade no
      servidor, o formulário transitório em modal da tela de Colaboradores foi
      aposentado, também por decisão da proprietária (2026-10-20): "Novo
      colaborador" leva à página de Nova admissão. A ADR 0016 recebeu nota de
      convergência da T177.
    - **Pendências próprias da T177:** o **alcance** do "acessa tudo" do
      `master_tecnico` nos demais recursos (admissão, vínculo, movimentação,
      ponto, documentos, folha, exportação), que a Emenda 2 da ADR 0012 deixa
      para registro próprio; a edição de dados pessoais e endereço existe só na
      API (`PUT`), sem tela nesta entrega; e o endereço gravado só com o país
      sugerido quando o RH não toca no bloco (registrado na ficha).
    - **Entregue:** Dados pessoais básicos (data de nascimento, sexo, saudação, estado
      civil, nacionalidade, naturalidade, escolaridade, curso, nome do pai e nome
      da mãe, além do nome completo já existente), endereço (país, sugerido como
      Brasil e editável, CEP, logradouro, número, complemento, bairro, cidade e
      estado) e os três contatos da T169 (obrigatórios na página — **regra
      substituída** na T179: contatos opcionais), gravados na
      MESMA transação da admissão. Inclui migration
      `20261020120000_dados_pessoais_endereco_colaborador` (dois agregados
      próprios por colaborador e empresa, trilha append-only, CHECKs e gatilhos
      de vínculo), recurso de autorização `dados_pessoais_colaborador` (`rh` e
      `dp` na empresa ativa; `master_tecnico` em qualquer empresa, como nos
      contatos), rotas `GET` e `PUT /v1/colaboradores/:colaboradorId/dados-pessoais`,
      auditoria de criação, leitura e edição sem valor pessoal, a página de Nova
      admissão nos blocos dos prints, a leitura na ficha do colaborador e testes
      unitários, E2E e web. Validado no navegador com dados sintéticos: criação
      completa, obrigatoriedade, erros, rollback atômico real, leitura posterior,
      RH, DP, `master_tecnico` (com e sem empresa ativa), troca de empresa e
      negação a gestor e colaborador.
    - **Contrato:** em `POST /v1/colaboradores`, `perfilPessoal` (com
      `dataNascimento`) e `contatos` (os três campos) são **obrigatórios** (**regra
      substituída** na T179: `contatos` opcional, campo a campo), e
      `endereco` é opcional; no `PUT` dos dados pessoais, o bloco do perfil exige
      a data de nascimento. Os demais campos são opcionais. O banco guarda
      `data_nascimento` como NOT NULL. Quem foi admitido antes da T177 segue sem
      esses dados, lido como `sem_registro`.
    - **Ficha e emenda:** a
      [ficha de tratamento](../docs/decisions/ficha-tratamento-dados-pessoais-endereco-colaborador.md)
      e a Emenda 5 da ADR 0007 foram **aprovadas pela proprietária em
      2026-10-20**: finalidade — admissão e administração da relação de
      trabalho; base legal — execução do contrato e procedimentos preliminares
      necessários; classificação — A2, dado pessoal comum; RIPD — não
      necessário nesta etapa, a reavaliar com documentos, dados bancários, saúde
      ou demais dados sensíveis ou restritos. **Retenção, por decisão
      substitutiva:** sem exclusão nem anonimização automática após o
      desligamento; uso operacional bloqueado, com histórico e auditoria
      preservados; mudança futura só com decisão explícita da proprietária e
      avaliação de RH/Jurídico. A ficha de Contatos da T169 foi **alinhada** à
      mesma regra (§7 dela): a eliminação ou anonimização após 2 anos deixou de
      existir. O sistema mantém só o valor vigente e os metadados de auditoria,
      sem versões históricas dos valores. O bloqueio após o desligamento ganhou
      teste de API (unitário e E2E).
    - **Fora de escopo:** CPF, documentos, dados bancários, dependentes, saúde,
      múltiplos vínculos, alçadas e fluxo de aprovação; campo decorativo,
      desabilitado ou que aparente estar salvo sem persistência real.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos — **superado** em 2026-10-20, retenção alinhada sem eliminação automática; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c. Pendências da T173: dos 13 conflitos com decisões fechadas (8 firmes e 5 condicionais), **12 seguem abertos** e o conflito 13 está resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20; dos 22 gates, o `DP-FLX-01` foi **resolvido** na T175 e o `DP-FLX-21` na T176, e os 20 restantes (`DP-FLX-02` a `DP-FLX-20` e `DP-FLX-22`) seguem **abertos**; a ADR 0017, **aceita** na T175 sem autorizar implementação; e as observações não bloqueantes O-1 (a linha 9 do corpo da PR diz "mesmo hash", exato só até `fca0fe7`), O-2 (a célula "Reabre ou depende de" do `DP-FLX-21` cita a T146 sem o qualificador "ainda não integrada"), O-3 (quebra de linha curta na ADR) e O-4 ("proposta aprovada" × "fundação visual aprovada" para a T146). Pendências da T174: as observações não bloqueantes da revisão final O-1 (a justificativa da faixa 6 diz que `-18` vem antes de `-22` pela consideração 3, quando a ordem se sustenta pela consideração 5), O-2 (o parágrafo de portões externos lista `-14` entre as fichas de RH + Jurídico, quando o insumo da tabela é o Nível 2 da Etapa 2) e O-3 (a lista de fontes diz "que as fichas citam" e inclui a ADR 0004, citada só na tabela da seção 3); e o erro de redação "aliquotas de aprovacao" na mensagem do commit `54143b4`, preservado no squash. Pendências da T175: as observações não bloqueantes da revisão final O-1 (o item do `DP-FLX-06` na nota de aceite não cita a questão do contato "telefone ou e-mail" frente aos três campos da T169), O-2 (dado sindical sem classe própria na ADR 0016, agrupado com os sensíveis ou restritos só pela ressalva de RH + Jurídico) e O-3 (a CI rodou Node 24 em dois patches, `v24.21.0` e `v24.22.0`, porque o `.nvmrc` fixa só a versão principal). Pendências da T176: o formulário de admissão em modal da tela de Colaboradores, mantido como **transitório** até a página própria ser validada — **aposentado na T177**, quando a admissão passou a exigir data de nascimento e contatos (exigência de contatos **substituída** na T179 em 2026-10-21: contatos opcionais); as observações não bloqueantes da revisão final O-1 (na seção 4 do diagnóstico da T173, a frase "O texto a seguir é o original" da nota da T175 ficou antes da nota da T176) e O-2 (o Status da ADR 0017 não cita a nota de decisão do `DP-FLX-21`); e as documentadas N-4 (em desenvolvimento, abrir a página direto pela URL pode acrescentar uma entrada ao histórico) e N-6 (o efeito de abertura da ficha em `ColaboradoresScreen` suprime `react-hooks/exhaustive-deps`).

75. **T178 - Gestão de Pessoas → Colaboradores como porta principal**
    - **Estado:** **integrada**. A T178 foi integrada em `main` pela PR #170, squash `27b4415696560c937a0f22df15d1a882ed5f5c46`, com a CI da `main` 3/3 verde em Node 24 (647 E2E e 1049 unitários; run 39610634615, disparada manualmente porque o GitHub não criou a run de push do merge): "Gestão de Pessoas → Colaboradores" como porta principal, ViaCEP para preenchimento assistido e log geral de requisições sem valores. Branch `codex/t178-colaboradores-porta-principal` preservada.
      Partiu do squash `0f573765463b7b6af3ee40a41c4f32636b0151fa` (T177, PR #169).
    - **Objetivo:** fazer de "Gestão de Pessoas → Colaboradores" a porta principal para
      consultar colaboradores já cadastrados e iniciar uma nova admissão. Implementação
      real, não documental.
    - **Entrega prevista:** agrupamento "Gestão de Pessoas" na navegação, com
      "Colaboradores" em rota própria, navegável por URL e que sobrevive a recarregamento;
      "Nova admissão" acessível a partir da listagem, abrindo a página própria
      `#/pessoas/nova-admissao` (nunca modal), com retorno e cancelamento consistentes à
      listagem; listagem só da empresa ativa, com dados reais da API, estado vazio claro,
      busca por nome e matrícula, contadores reais de ativos e inativos, e nome, matrícula,
      situação e data de admissão; o admitido aparece na listagem depois da admissão; cada
      linha abre a ficha existente. Cargo e departamento só aparecem se resolvidos pelos
      dados existentes, sem inferência; do contrário, ficam fora desta entrega, sem coluna
      enganosa.
    - **Permissões:** o RBAC aprovado é preservado — `rh` e `dp` admitem, e nenhum papel
      ganha capacidade nova por esta tela. A empresa vem só da sessão; não há seletor
      editável nem empresa por parâmetro. Inconsistência comprovada entre API e tela é
      registrada, e a entrega para antes de ampliar acesso.
    - **Referências visuais:** só de agrupamento e jornada, sem reproduzir marca, textos,
      componentes, paleta, ícones ou layout de terceiros. Matriz curta de cobertura no
      corpo da PR.
    - **Prévia:** a T178 abriu com a prévia fixa em `http://127.0.0.1:5173` seguindo a
      `main`. Durante a tarefa, a proprietária pediu a 5173 sempre atualizada com o trabalho
      em andamento, para acompanhar em tempo real: a 5173 passou a servir a branch da T178
      ao vivo (não a `main`), contra o mesmo banco sintético local.
      A prévia leva uma faixa visível "Em desenvolvimento — T178", injetada só pelo lançador
      local (fora do repositório), para não ser confundida com a `main`.
    - **Decisão da proprietária (2026-10-20) — ViaCEP:** "Autorizo ViaCEP para preenchimento
      assistido de endereço, somente para CEP brasileiro, com campos editáveis e cadastro
      manual como alternativa." Registrada em
      [t178-viacep-preenchimento-assistido.md](../docs/decisions/t178-viacep-preenchimento-assistido.md),
      na ficha de dados pessoais e endereço e na ADR 0016 (`DP-ADM-12` resolvido só quanto à
      consulta de CEP; catálogos de localidade seguem abertos).
    - **Estrutura de referência (prints da proprietária):** Colaboradores como entrada de
      Gestão de Pessoas, Nova admissão como subpágina, contadores junto ao título e campos da
      admissão em grade — só como referência de agrupamento e jornada, sem marca, textos,
      paleta, ícones ou layout de terceiros, e sem campo não aprovado (nome social, gênero,
      raça/etnia, foto).
    - **Entregue:** "Gestão de Pessoas → Colaboradores" como porta principal: grupo "Gestão de Pessoas" na barra lateral, com "Colaboradores" (destino `pessoas`) em rota própria `#/pessoas/colaboradores`, que abre direto ao recarregar; "Nova admissão" como subpágina (sai da barra lateral, "Colaboradores" fica marcado enquanto ela está aberta), aberta pela ação da listagem, com trilha "Gestão de Pessoas › Colaboradores › Nova admissão" e retorno consistente (cancelar, "Voltar para Colaboradores", trilha e "voltar" do navegador); listagem real da empresa ativa com nome, matrícula do vínculo principal (+N vínculos), situação NA EMPRESA ATIVA, data de admissão e "Abrir ficha"; busca por nome ou matrícula (só vínculos da empresa ativa; curingas escapados); contadores reais de ativos e inativos do escopo inteiro; estados vazios distintos; admitido aparece ao voltar. API: `GET /v1/colaboradores` com `busca`, `contadores` e projeção fechada com `vinculos`; filtro e situação por empresa ativa (corrige o resíduo de uma empresa na outra: a situação materializada é global). ViaCEP: rota interna `GET /v1/cep/:cep` (só `rh`/`dp`), adaptador isolado, só o CEP sai, timeout de 3 s, limite de 30 consultas por usuário em 10 min, log técnico sem valores, nada persistido; na Nova admissão, "Buscar CEP" e consulta ao sair do campo, preenchendo só campos vazios, com substituição por ação explícita e cadastro manual como alternativa. Página de Nova admissão reorganizada em grade (e-mail pessoal em Dados pessoais, mesma fonte dos contatos), com campos alinhados. Log geral de requisições sem valores (revisão adversarial, bloqueio B1): a URL deixou de ser gravada — só método, padrão da rota, status, duração e `requestId` —, então nem o CEP de `/v1/cep/:cep` nem a `busca` por nome ou matrícula entram no log; negações de autorização seguem gravando `authorization_denied`, sem CEP, endereço, busca ou caminho.
    - **Fora de escopo:** documentos, banco de dados sensível, CPF, salário, dependentes,
      saúde, dados bancários e integrações externas; promoção, merge e a T179.
    - **Dívida preservada:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos — **superado** em 2026-10-20, retenção alinhada sem eliminação automática; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
      da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes). Pendências da T172: as observações não bloqueantes O-1 (descarte protegido sem exercício no navegador), O-2 (contrato de CSS lido por regex), O-3 (banco sintético local alterado na validação), O-4 (outros quatro usos de `colaboradores-screen__aviso-texto` na mesma tela, não medidos) e O-5 (`openDeliveries.pullRequest` nulo com PR aberta), e as de redação O-a a O-c. Pendências da T173: dos 13 conflitos com decisões fechadas (8 firmes e 5 condicionais), **12 seguem abertos** e o conflito 13 está resolvido por decisão posterior: `DP-FLX-21`, em 2026-10-20; dos 22 gates, o `DP-FLX-01` foi **resolvido** na T175 e o `DP-FLX-21` na T176, e os 20 restantes (`DP-FLX-02` a `DP-FLX-20` e `DP-FLX-22`) seguem **abertos**; a ADR 0017, **aceita** na T175 sem autorizar implementação; e as observações não bloqueantes O-1 (a linha 9 do corpo da PR diz "mesmo hash", exato só até `fca0fe7`), O-2 (a célula "Reabre ou depende de" do `DP-FLX-21` cita a T146 sem o qualificador "ainda não integrada"), O-3 (quebra de linha curta na ADR) e O-4 ("proposta aprovada" × "fundação visual aprovada" para a T146). Pendências da T174: as observações não bloqueantes da revisão final O-1 (a justificativa da faixa 6 diz que `-18` vem antes de `-22` pela consideração 3, quando a ordem se sustenta pela consideração 5), O-2 (o parágrafo de portões externos lista `-14` entre as fichas de RH + Jurídico, quando o insumo da tabela é o Nível 2 da Etapa 2) e O-3 (a lista de fontes diz "que as fichas citam" e inclui a ADR 0004, citada só na tabela da seção 3); e o erro de redação "aliquotas de aprovacao" na mensagem do commit `54143b4`, preservado no squash. Pendências da T175: as observações não bloqueantes da revisão final O-1 (o item do `DP-FLX-06` na nota de aceite não cita a questão do contato "telefone ou e-mail" frente aos três campos da T169), O-2 (dado sindical sem classe própria na ADR 0016, agrupado com os sensíveis ou restritos só pela ressalva de RH + Jurídico) e O-3 (a CI rodou Node 24 em dois patches, `v24.21.0` e `v24.22.0`, porque o `.nvmrc` fixa só a versão principal). Pendências da T176: o formulário de admissão em modal da tela de Colaboradores, mantido como **transitório** até a página própria ser validada — **aposentado na T177**, quando a admissão passou a exigir data de nascimento e contatos (exigência de contatos **substituída** na T179 em 2026-10-21: contatos opcionais); as observações não bloqueantes da revisão final O-1 (na seção 4 do diagnóstico da T173, a frase "O texto a seguir é o original" da nota da T175 ficou antes da nota da T176) e O-2 (o Status da ADR 0017 não cita a nota de decisão do `DP-FLX-21`); e as documentadas N-4 (em desenvolvimento, abrir a página direto pela URL pode acrescentar uma entrada ao histórico) e N-6 (o efeito de abertura da ficha em `ColaboradoresScreen` suprime `react-hooks/exhaustive-deps`). Pendências da T177: o **alcance** do "acessa tudo" do `master_tecnico` nos demais recursos (admissão, vínculo, movimentação, ponto, documentos, folha, exportação), para registro próprio; a edição de dados pessoais e endereço só pela API, sem tela; o endereço gravado só com o país sugerido quando o bloco não é tocado; e as observações não bloqueantes da revisão final O-1 (`.specify/tasks.md`, perto da linha 2226, pode ser lido como "Emenda 2 = contatos"), O-2 (ADR 0016, linhas 616-617, ainda diz que `DP-ADM-02` a `-18` continuam todas pendentes), O-3 (12 E2E antigos de dados pessoais dependem da ordem e falham com `--randomize`) e O-4 (linha longa no comentário de `permission.types.ts`). Pendências próprias da T178: cargo, departamento e banco de horas fora da listagem (a lotação ainda não é resolvida nela); as abas internas de Colaboradores (horário, histórico...) não têm rota própria; `GET /v1/colaboradores/:id` e a resposta do `PATCH` ainda trazem a situação materializada (global) — a tela usa a da listagem; a ficha mostra "Salvar nome" e a edição de contatos também ao `master_tecnico`, que o servidor recusa (anterior à T178); o limite de consultas de CEP vive em memória por instância; os demais itens do menu de referência (filiais, departamentos, férias, registros, feedbacks, checklists, aniversariantes, saúde, motivos de demissão, unidades, métricas) não estão em Gestão de Pessoas; e, por pedido da proprietária em 2026-10-20, a prévia em `http://127.0.0.1:5173` passou a mostrar a branch da T178 ao vivo, não a `main`.

76. **T179 - Confirmação segura da Nova admissão, duplicidade, erros por campo e telefones**
    - **Estado:** **integrada** em `main` pela PR #171, squash `60ce990bc6a04bee542b93d494d00d6f48bf8c19`.
      Branch `codex/t179-confirmacao-admissao` preservada; a convergência posterior corrige somente
      o trailer do Spec Kit que entrou literalmente no corpo da mensagem de squash. Partiu do
      squash `27b4415696560c937a0f22df15d1a882ed5f5c46` (T178, PR #170).
    - **Objetivo:** confirmar a admissão antes de gravar, impedir cadastro duplicado (reenvio e
      e-mail pessoal repetido na empresa), devolver conflitos por campo sem valores e fixar a
      base de normalização de telefones e CEP, com máscaras acessíveis.
    - **Decisões da proprietária (2026-10-21):** e-mail pessoal único na mesma empresa;
      idempotência do envio com migration própria, chave ligada ao ator e à empresa e sem dado
      pessoal; telefone só brasileiro em `+55` + DDD + número, com migration que converte só o
      inequívoco e manda o resto para relação técnica de revisão sem valores; Departamento,
      Cargo e Unidade obrigatórios só na Nova admissão (**regra substituída** em 2026-10-21:
      Unidade opcional, ver a obrigatoriedade abaixo); DP sem referências continua impedido de
      admitir, com explicação na tela; "Adicionar" referências só do RH; nomes repetidos de
      referência permitidos, com `CÓDIGO — Nome` nos seletores; fuso fora do produto
      (`DP-FLX-22` não aplicável só quanto ao fuso; Dados adicionais no `DP-ADM-19`); nenhum
      valor pessoal em log, auditoria, erro, PR ou documentação. Registradas em
      [t179-confirmacao-admissao-duplicidade-telefones.md](../docs/decisions/t179-confirmacao-admissao-duplicidade-telefones.md), nas ADRs 0016 e 0017,
      nas fichas de Contatos e de dados pessoais e endereço, na reconciliação RH/DP e na
      Baseline V1 da Fatia 2.
    - **Entrega prevista:** validação local antes da confirmação; modal acessível "Confirmar
      cadastro de colaborador?" com resumo sem contatos, endereço ou nascimento; só "Confirmar
      cadastro" envia, sem duplo envio; servidor valida na transação e responde conflitos por
      campo (matrícula, e-mail pessoal) sem valores; conflito fecha o modal, preserva o
      formulário e foca o primeiro erro; idempotência com reenvio e chave com conteúdo
      divergente; máscaras de CEP e telefone; normalização no servidor; testes unitários, web e
      E2E, inclusive concorrência, isolamento entre empresas e ausência de vazamento em log e
      auditoria.
    - **Contagens:** 13 conflitos, 12 abertos e 1 resolvido; 22 gates, com o `DP-FLX-01`, o
      `DP-FLX-21` e o `DP-FLX-22` resolvidos e 19 abertos.
    - **Fora de escopo:** CPF, documentos, dados bancários, dependentes, salário, ponto,
      adicionais trabalhistas, horário, fuso, cargo completo, modais rápidos de Departamento,
      Cargo e Unidade, telefone estrangeiro, capacidade nova para o DP, promoção, merge e a T180.
    - **Obrigatoriedade do cadastro:** (decisão da proprietária de 2026-10-21, [t179-obrigatoriedade-cadastro-colaborador.md](../docs/decisions/t179-obrigatoriedade-cadastro-colaborador.md)): obrigatórios nome completo, data de nascimento, Departamento, Cargo, data de admissão e tipo de vínculo (este, até tarefa própria); opcionais e-mail pessoal (único na empresa quando informado), Sexo em opções fechadas (Feminino, Masculino, Intersexo, Não informar), matrícula (única na empresa quando informada), Unidade, endereço inteiro (inclusive CEP) e contatos; gênero obrigatório quando o `DP-ADM-09` liberar e CPF obrigatório só quando o módulo de documentos e a sua ficha forem autorizados, sem implementar agora. Migration `20261021140000_obrigatoriedade_cadastro_colaborador` só retira o NOT NULL da matrícula e dos três contatos.
    - **Entregue:** Confirmação segura da Nova admissão: validação local antes de abrir a confirmação, com foco no primeiro campo inválido; modal acessível "Confirmar cadastro de colaborador?" com resumo de empresa ativa, nome, matrícula, tipo de vínculo, data de admissão e lotação (nunca contatos, endereço ou nascimento); "Voltar e revisar" preserva tudo; só "Confirmar cadastro" envia, sem duplo envio, com "Cadastrando…". Idempotência do envio (`Idempotency-Key`, tabela `idempotencia_admissao` sem dado pessoal; reenvio devolve a mesma admissão com `Idempotent-Replayed: true`; mesma chave com conteúdo diferente é 422 `idempotencia_conteudo_divergente`; envios simultâneos resolvidos no banco). Conflitos por campo sem valor (409 com `erros`: matrícula e e-mail pessoal na admissão, e-mail pessoal na edição de contatos), com resumo seguro, campos marcados e foco no primeiro. E-mail pessoal único na mesma empresa por índice do banco. Lotação em seletores `CÓDIGO — Nome`: Departamento e Cargo obrigatórios só na Nova admissão (a Unidade, obrigatória na primeira entrega, passou a opcional — regra substituída na T179 em 2026-10-21); empresa sem Departamento ou Cargo não envia, com orientação ao RH (Estrutura) ou ao DP (pedir ao RH). Telefone só brasileiro, gravado em `+55` + DDD + número; CEP brasileiro em 8 dígitos; máscaras acessíveis e progressivas de CEP e telefone na Nova admissão e na edição de contatos. Migration `20261021120000_confirmacao_admissao_normalizacao`: para com e-mail já repetido na empresa (só a contagem), converte telefones e CEPs só quando inequívocos e lista o resto em `revisao_normalizacao_cadastro`, sem valores. Testes: API unitários, E2E (suíte nova da confirmação e prova da migration sobre dados já gravados; log ligado sem valores) e web. **Estado atual da obrigatoriedade:** obrigatórios nome completo, data de nascimento, Departamento, Cargo, data de admissão e tipo de vínculo; opcionais matrícula, Unidade, e-mail pessoal, contatos (celular e telefone) e endereço, com formato conferido quando informados; matrícula ausente, `null`, vazia ou só com espaços não é conferida nem gera conflito. Sexo em opções fechadas no cliente e no servidor, "Não informado" na ficha quando sem seleção. Admissão sem contatos não cria registro; remover todos os contatos pela edição deixa o registro **inativo** (sem valor, preservado para a trilha, sem exclusão física; migration `20261022120000_contato_colaborador_inativo`), e a ficha e a tela de sucesso mostram o estado único "Nenhum contato registrado". Máscaras: inserção excedente de telefone ou CEP (tecla, colagem, arrastar, sugestão de teclado, ditado) é recusada com aviso acessível, sem reinterpretar DDD 55 como país nem cortar dígitos. Telefone com texto (ramal, extensão, rótulos) é recusado como formato; telefone legado, gravado antes da forma `+55` atual, aparece exatamente como gravado e não é reenviado nem regravado ao salvar outro campo (no `PUT` de contatos, campo ausente mantém o valor gravado). Resposta 5xx (inclusive 500) e falta de resposta são envio incerto (decisão da proprietária de 2026-10-22): a tela não afirma que nada foi salvo, preserva o formulário, orienta a conferir Colaboradores antes de tentar de novo e reconfirma com a mesma chave de idempotência. Sessão expirada (401 ou renovação do token por sessão vencida) não é envio incerto: o formulário fica e a tela orienta entrar de novo. O 403 do CSRF (`csrf_invalido`) chega com sessão válida e token da aba desatualizado: a tela descarta o token local e mostra "Esta página ficou desatualizada…", e confirmar de novo reenvia o mesmo pedido. Depois de um envio incerto, nenhuma falha seguinte afirma que o cadastro não foi gravado. `+` sobre número nacional é recusado (DDD 55 nunca vira país); CEP com letras é recusado. Salvamentos de contatos se serializam (`FOR NO KEY UPDATE`) e leituras se ordenam com eles (`FOR SHARE`).
    - **Pendências:** a chave de idempotência é opcional na API (a tela sempre a envia); os registros de idempotência não têm expiração nem limpeza (retenção dos registros técnicos a decidir); a relação técnica de revisão não tem tela, só consulta técnica; o reenvio de uma admissão já editada depois (nome, contato) é recusado como conteúdo divergente, de propósito; telefone estrangeiro e os modais rápidos de Departamento, Cargo e Unidade ficam para módulos próprios; na prévia, a API roda de build único, sem watch.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T179 ao vivo, identificada
      como desenvolvimento da T179, não a `main`.

77. **T180 - Cadastro rápido de Departamento, Cargo e Unidade na Nova admissão**
    - **Estado:** **integrada** em `main` pela PR #173, squash
      `cf04afcce8bd6a1e3c03f32f668ed7d88d73b6b0`, com a CI de push 3/3 verde (run 39972657182);
      branch preservada. Implementada na branch `codex/t180-referencias-rapidas-admissao`, a partir
      do squash `584a5c0b0c8faf2979a5b1a1838764b31674291d` (convergência da T179, PR #172). A T179
      está integrada (PR #171, squash `60ce990bc6a04bee542b93d494d00d6f48bf8c19`) e convergida.
    - **Objetivo:** na Nova admissão, o RH cadastra Departamento, Cargo e Unidade em modais curtos,
      sem sair do formulário e sem perder nada do que já digitou; a referência criada entra no
      seletor e fica selecionada.
    - **Decisão da proprietária (2026-10-23):** [decisão](../docs/decisions/t180-referencias-rapidas-nova-admissao.md). Botão "+" só
      para RH (o DP seleciona, mas não cria); obrigatoriedade inalterada (Departamento e Cargo
      obrigatórios, Unidade opcional); modais só com os campos mínimos do contrato atual (código e
      nome); empresa sempre da sessão, conferida pelo servidor; cancelar preserva a admissão;
      erro de validação ou de código repetido no campo, sem fechar o modal; permissões e
      auditoria pelo padrão existente da estrutura; sem migration e sem mudança de contrato.
    - **Entrega prevista:** modais acessíveis (foco inicial, Escape, Cancelar, retorno do foco ao
      seletor, sem rolagem horizontal em tela pequena); atualização e seleção automáticas do
      seletor; testes web e E2E de API com PostgreSQL real (RH cria nas três, código repetido,
      outra empresa, DP e demais papéis recusados); validação no navegador como RH e DP.
    - **Fora de escopo:** documentos, CPF, dados bancários, dependentes, saúde, gênero, foto,
      raça/etnia, dados trabalhistas detalhados, horário e fuso, telefone estrangeiro, importação
      em massa, cadastro rápido de Área, Equipe e Centro de custo, mudança de permissões não
      relacionadas, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T180 ao vivo, identificada
      como `[T180 dev]`, não a `main`.
    - **Revisão adversarial (2026-10-23):** corrigida a corrida em que uma recarga lenta do
      seletor, lida antes de uma criação, chegava depois dela e tirava a referência nova da
      lista (a confirmação dizia "Não informado" enquanto a admissão enviava o id): cada
      referência tem versão da lista, a resposta obsoleta é descartada e a referência escolhida
      nunca sai do seletor. A mensagem do envio incerto só diz que a lista foi atualizada
      depois que isso acontece, e diz quando a recarga falha. O E2E passou a conferir a trilha
      `authorization_denied` das recusas 403 e 404 e que o 409 não devolve o código.

78. **T181 - Edição da ficha do colaborador por RH e DP**
    - **Estado:** **integrada** em `main` pela PR #174, squash
      `b6442f3dcbe7107b1044b10ecd5e13bb3d7e0859`, com a CI de push 3/3 verde (run 40012309132);
      branch preservada. Implementada na branch `codex/t181-ficha-edicao-colaborador`, a partir do
      squash `cf04afcce8bd6a1e3c03f32f668ed7d88d73b6b0` (T180 integrada, PR #173).
    - **Objetivo:** em Gestão de Pessoas › Colaboradores, RH e DP completam e atualizam, pela ficha
      do colaborador, os dados já aprovados e já gravados: dados pessoais complementares, endereço
      e contatos.
    - **Decisão da proprietária (2026-10-23):** [decisão](../docs/decisions/t181-edicao-ficha-colaborador.md).
      Edição só na empresa ativa; leitura segura para os perfis sem permissão, sem botão que o
      servidor recusaria; contatos com o estado "Nenhum contato registrado" e as regras da T179
      para adicionar e remover; CEP assistido só pelo servidor, com alternativa manual; máscaras,
      `+55`, validações e mensagens acessíveis já aprovadas; auditoria existente, só com nomes de
      campos; falhas sem perder o digitado e sem afirmar gravação incerta; edição por seção, com
      Salvar e Cancelar.
    - **Entrega prevista:** seções editáveis de dados pessoais e endereço na ficha, Cancelar nos
      contatos, testes de API, web e E2E com PostgreSQL real, validação no navegador como RH e DP,
      recusa dos demais papéis, troca de empresa e 375 px. Sem schema, migration, seed, Docker,
      dependência ou lockfile novos.
    - **Fora de escopo:** CPF, RG, CNH, CTPS, PIS, documentos, dados bancários, dependentes,
      filhos, camisa, saúde, dados sindicais, foto, raça/etnia, gênero, deficiência, dados
      contratuais detalhados, fuso, telefone estrangeiro, importação; nome (fora a correção já
      existente), matrícula, tipo de vínculo, lotação, situação e datas da admissão; promoção e
      merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T181 ao vivo, identificada
      como `[T181 dev]`, não a `main`.
    - **Decisões complementares (2026-10-23):** a edição de dados pessoais, endereço e contatos é
      só de RH e DP, na empresa ativa; o `master_tecnico` mantém a leitura e deixa de editar,
      recusado pelo servidor e sem botões na ficha. Sexo legado (fora da lista fechada) fica
      exatamente como está ao salvar outro campo — sexo ausente do corpo mantém o gravado —,
      aparece como valor legado só para leitura, e mudá-lo exige uma opção da lista atual.

79. **T182 - Catálogo de Jornadas de trabalho em Estrutura**
    - **Estado:** **integrada** em `main` pela PR #175, squash
      `38796565c3eb491e8e838d270d56d3647644e08d`, com a CI de push 3/3 verde (run 40323308350);
      branch preservada. Implementada na branch `codex/t182-jornadas-trabalho`, a partir do squash
      `b6442f3dcbe7107b1044b10ecd5e13bb3d7e0859` (T181 integrada, PR #174).
    - **Objetivo:** em Estrutura › Jornadas de trabalho, RH e DP mantêm o catálogo de jornadas da
      empresa ativa — turnos reutilizáveis, futuramente associados aos colaboradores.
    - **Decisão da proprietária (2026-10-23):** [decisão](../docs/decisions/t182-jornadas-trabalho.md).
      Tela própria com lista, busca, estado vazio e status; RH cria, edita e inativa; DP só
      consulta; código, nome e os dias e horários que o contrato já tem; código único na empresa,
      por migration aditiva; nome e código editáveis, dias e horários imutáveis (T038) — para
      mudar, nova jornada a partir da existente e inativação da antiga; inativação
      lógica; empresa da sessão; auditoria existente, só com ids e nomes de campos. **Fuso horário
      não faz parte do produto.**
    - **Entrega prevista:** migration aditiva do código, edição e busca na API, leitura pelo DP,
      tela própria na web, testes de API, web e E2E com PostgreSQL real e validação no navegador.
    - **Fora de escopo:** associação da jornada ao colaborador (o vínculo de horário existente não
      muda), banco de horas, escala, adicional noturno, folha, compensação, feriado, ponto,
      geolocalização, fuso horário, salário, contrato, CPF, documentos, dados bancários,
      dependentes, saúde, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T182 ao vivo, identificada
      como `[T182 dev]`, não a `main`.

80. **T183 - Jornada de trabalho do colaborador, com vigência**
    - **Estado:** **integrada** em `main` pela PR #176, squash
      `077315604c4ea7f27237bfebbaf3a94c2652f38e`, com a CI de push 3/3 verde (run 40337489015);
      branch preservada. Implementada na branch `codex/t183-jornada-colaborador`, a partir do squash
      `38796565c3eb491e8e838d270d56d3647644e08d` (T182 integrada, PR #175).
    - **Objetivo:** associar uma Jornada de trabalho existente ao colaborador, na empresa ativa,
      com data de início de vigência e histórico consultável.
    - **Decisão:** [decisão](../docs/decisions/t183-jornada-colaborador.md). RH atribui, troca e
      encerra; DP consulta jornada e histórico; a ficha mostra a jornada atual e o histórico; a
      Nova admissão permite escolher uma jornada, opcional; só jornadas ativas para vínculo novo.
      O modelo `vinculo_horario` (T037/T038) já representa a vigência `[início, fim)` e impede
      sobreposição no banco: **sem migration**. Troca atômica (encerra a vigente no novo início e
      cria a nova), erros por campo sem valor, isolamento por empresa e auditoria só com ids.
    - **Entrega prevista:** atribuição e troca na API, leitura pelo DP, jornada na projeção do
      vínculo, jornada opcional na admissão, seção na ficha, testes de API, web e E2E com
      PostgreSQL real e validação no navegador em 375 px.
    - **Fora de escopo:** ponto, batida, banco de horas, cálculo de jornada, escala, folga,
      feriado, adicional noturno, compensação, folha, geolocalização, fuso horário, salário,
      contrato trabalhista detalhado, CPF, documentos, dados bancários, dependentes, saúde, dados
      pessoais novos, qualquer permissão além de RH editar e DP consultar, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T183 ao vivo, identificada
      como `[T183 dev]`, não a `main`.

81. **T184 - Cargo e Departamento na listagem de Colaboradores**
    - **Estado:** **integrada** em `main` pela PR #177, squash
      `398c70ab51e004e89c35181f1a5d2cf68dde603d`, com a CI de push 3/3 verde (run 40369382783);
      branch preservada. Implementada na branch `codex/t184-colaboradores-cargo-departamento`, a
      partir do squash `077315604c4ea7f27237bfebbaf3a94c2652f38e` (T183 integrada, PR #176).
    - **Objetivo:** completar Pessoas › Colaboradores com as colunas reais Cargo e Departamento,
      da lotação vigente do colaborador na empresa ativa.
    - **Decisão da proprietária (2026-10-26):**
      [decisão](../docs/decisions/t184-colaboradores-cargo-departamento.md). Só a lotação vigente
      (a alocação organizacional aberta do vínculo principal); vínculo previsto (admissão não
      efetivada) e vínculo encerrado mostram "Sem lotação vigente". Sem permissão nova, sem
      migration e sem dado de negócio novo.
    - **Entrega prevista:** lotação vigente (id, código e nome de cargo e departamento) na
      projeção da listagem, colunas na web, testes de API, web e E2E com PostgreSQL real e
      validação no navegador em 375 px.
    - **Fora de escopo:** banco de horas, ponto, batidas, cálculos, escala, folha, compensação,
      fuso horário, campos novos de cadastro, salário, contrato detalhado, documentos, CPF, dados
      bancários, dependentes, saúde, edição de cargo ou departamento pela listagem, importação,
      exportação, envio de links, integrações externas, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T184 ao vivo, identificada
      como `[T184 dev]`, não a `main`.

82. **T185 - Jornada de trabalho na listagem de Colaboradores**
    - **Estado:** **integrada** em `main` pela PR #178, squash
      `2f5b1cccedb4bf31ae181ca4af7b64b57da80a2a`, com a CI de push 3/3 verde (run 40385160298);
      branch preservada. Implementada na branch `codex/t185-colaboradores-jornada`, a partir do
      squash `398c70ab51e004e89c35181f1a5d2cf68dde603d` (T184 integrada, PR #177).
    - **Objetivo:** coluna "Jornada de trabalho" em Pessoas › Colaboradores, só com o vínculo de
      jornada da T183: a jornada vigente do vínculo principal na empresa ativa.
    - **Decisão da proprietária (2026-10-26):**
      [decisão](../docs/decisions/t185-colaboradores-jornada.md). "Hoje" é o dia civil do
      navegador (igual à ficha); a jornada é a do colaborador na empresa do vínculo principal
      ativo; previsto, encerrado, sem jornada ou com vigência futura mostram "Sem jornada
      vigente"; jornada inativada com a indicação. Sem permissão nova e sem migration.
    - **Entrega prevista:** vigências de jornada perto de hoje na projeção da listagem (só para
      vínculo ativo), coluna na web, testes de API, web e E2E com PostgreSQL real e validação no
      navegador em 375 px.
    - **Fora de escopo:** banco de horas, saldo, batidas, ponto, cálculo de horas, escala, folha,
      adicional noturno, compensação, feriado, geolocalização, fuso horário, campos novos de
      cadastro, salário, contrato detalhado, documentos, CPF, dados bancários, dependentes,
      saúde, edição de jornada pela listagem, importação, exportação, integrações externas,
      promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T185 ao vivo, identificada
      como `[T185 dev]`, não a `main`.

83. **T186 - Filtros de situação nos contadores de Colaboradores**
    - **Estado:** **integrada** em `main` pela PR #179, squash
      `d7ab1721c19732f19d00bf8d26eaa01d1eb47f1d`, com a CI de push 3/3 verde (run 40396676554);
      branch preservada. Implementada na branch `codex/t186-colaboradores-filtro-situacao`, a
      partir do squash `2f5b1cccedb4bf31ae181ca4af7b64b57da80a2a` (T185 integrada, PR #178).
    - **Observação histórica (O1 da revisão):** o E2E da listagem ainda não cobre
      especificamente `situacaoVinculo` (lacuna anterior à T186, sem correção nela).
    - **Objetivo:** em Pessoas › Colaboradores, transformar os contadores Ativos e Inativos em
      filtros reais e acessíveis ("Todos", "Ativos", "Inativos"), com a mesma regra de situação
      por empresa da T178.
    - **Decisão da proprietária (2026-10-26):**
      [decisão](../docs/decisions/t186-colaboradores-filtro-situacao.md). O select "Situação"
      sai e os filtros nos contadores passam a ser o único controle de situação; o filtro não vai
      para a URL (a rota segue a mesma e recarregar volta a "Todos"); o master sem empresa ativa
      segue a regra da T178. A API já filtra no servidor, antes da paginação: sem mudança de
      servidor, schema, migration nem RBAC.
    - **Entrega prevista:** filtros nos contadores, estados vazios distintos (empresa sem
      colaboradores, busca, filtro, busca com filtro), testes de web e E2E com PostgreSQL real e
      validação no navegador em 375 px.
    - **Fora de escopo:** banco de horas, ponto, jornadas, escala, folha, compensação, fuso
      horário, admissão, desligamento, edição de situação, mudança de vínculo, campos pessoais
      novos, salário, contrato detalhado, documentos, CPF, dados bancários, dependentes, saúde,
      importação, exportação, integrações externas, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T186 ao vivo, identificada
      como `[T186 dev]`, não a `main`.

84. **T187 - Vida funcional na ficha do colaborador**
    - **Estado:** **integrada** em `main` pela PR #180, squash
      `00a94df7c8e9dc25179b8e23bf9fbe9a1466e50f`, com a CI de push 3/3 verde (run 40496328412);
      branch preservada. Implementada na branch `codex/t187-proxima-fatia-colaboradores`, a
      partir do squash `d7ab1721c19732f19d00bf8d26eaa01d1eb47f1d` (T186 integrada, PR #179).
    - **Observação de relatório:** a integração funcional da T187 está concluída; a única
      pendência administrativa era a sua convergência no Spec Kit, resolvida no primeiro commit
      da T188.
    - **Preparação:** [dossiê](../docs/decisions/t187-dossie-proxima-fatia-colaboradores.md) com três opções; a proprietária aprovou a opção A em
      2026-10-27.
    - **Objetivo:** seção "Vida funcional" na ficha, **somente leitura**: lotação vigente e linha
      do tempo de movimentações do vínculo principal, com todos os status (programada,
      efetivada, cancelada e retificada), e atalho para o Histórico funcional já no colaborador e
      no vínculo.
    - **Contratos:** só `GET /v1/vinculos/:id/alocacoes` e `GET /v1/vinculos/:id/linha-do-tempo`,
      com as permissões existentes (RH, DP e `master_tecnico` leem). Sem mudança de API, schema,
      migration, RBAC, auditoria, seed ou dependência.
    - **Entrega prevista:** seção na ficha, atalho com seleção inicial no Histórico funcional,
      testes web e validação no navegador em 375 px; E2E existentes como prova de isolamento e
      permissão dos contratos reutilizados.
    - **Fora de escopo:** registrar, efetivar, cancelar ou retificar movimentação pela ficha,
      transferência, mudança de cargo, desligamento (opções B e C do dossiê), O1 da T186, banco
      de horas, ponto, escala, folha, fuso horário, dados pessoais novos, salário, documentos,
      CPF, dados bancários, dependentes, saúde, importação, exportação, integrações externas,
      promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T187 ao vivo, identificada
      como `[T187 dev]`, não a `main`.

85. **T188 - Abas operacionais de Pessoas sem o teto de 100 colaboradores**
    - **Estado:** **integrada** em `main` pela PR #181, squash
      `9f9a98627f5a5da75cb6c4cf8d1a80a4574c7402`, com a CI de push 3/3 verde (run 40516941977);
      branch preservada. Implementada na branch `codex/t188-proxima-fatia-pessoas`, a partir do
      squash `00a94df7c8e9dc25179b8e23bf9fbe9a1466e50f` (T187 integrada, PR #180).
    - **Observação de relatório:** a integração funcional da T188 está concluída; a única
      pendência administrativa era a sua convergência no Spec Kit, resolvida no primeiro commit
      da T189. Observações da revisão que seguem abertas, sem correção: O1 (Horário resolve nomes
      pela primeira página de 100), O2 (ordenação de movimentações sem desempate por id; exige
      API), O4 (clicar de novo no mesmo colaborador limpa o vínculo), O5 (auditoria de consulta
      global do `master_tecnico` no atalho) e O6 (prévia sem mais de 100 colaboradores).
    - **Preparação:** [dossiê](../docs/decisions/t188-dossie-proxima-fatia-pessoas.md) com três opções; a proprietária aprovou a opção A
      completa em 2026-10-27.
    - **Objetivo:** em Histórico funcional, Dados contratuais e Horário de trabalho, escolher
      qualquer colaborador da empresa ativa por busca (nome ou matrícula) com resultados
      paginados pelo servidor, no lugar do seletor de uma página de 100; paginar a lista de
      movimentações do Histórico funcional; corrigir o transbordamento de largura dessa aba
      (pendência T115).
    - **Contratos:** só `GET /v1/colaboradores` (`busca`, `pagina`, `tamanhoPagina`,
      `situacao`), `GET /v1/colaboradores/:id` e `GET /v1/movimentacoes` (`pagina`,
      `tamanhoPagina`), com as permissões existentes. Sem mudança de API, schema, migration,
      RBAC, auditoria, seed ou dependência.
    - **Entrega prevista:** seletor por busca paginada nas três abas, paginação de
      movimentações, correção de largura, testes web e E2E com PostgreSQL real dos contratos
      reutilizados, validação no navegador em 375 px.
    - **Fora de escopo:** opções B e C do dossiê, O1 da T186, catálogos organizacionais acima
      de 100 itens, a tabela de vínculos de horário (uma página de 100), formulários, dados e
      regras dos módulos, qualquer escrita, papel ou permissão nova, banco de horas, ponto,
      escala, folha, fuso horário, dados pessoais novos, importação, exportação, integrações
      externas, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T188 ao vivo, identificada
      como `[T188 dev]`, não a `main`.

86. **T189 - Seletor de empresa ativa no menu lateral e no Hub**
    - **Estado:** **integrada** em `main` pela PR #182, squash
      `bf9d87cafb7d6676207d5d38c28889a09276dd59`, com a CI de push 3/3 verde (run 40561605036);
      branch preservada. Implementada na branch `codex/t189-seletor-empresa-ativa`, a partir do
      squash `9f9a98627f5a5da75cb6c4cf8d1a80a4574c7402` (T188 integrada, PR #181).
    - **Observação de relatório:** a integração funcional da T189 está concluída; a única
      pendência administrativa era a sua convergência no Spec Kit, resolvida no primeiro commit
      da T190. Observações da revisão que seguem abertas, sem correção: N2 (401 durante a troca
      no seletor aparece como falha genérica; a reconferência seguinte leva ao login), N3 (sem
      teste para navegador sem `BroadcastChannel`, para o aviso entre abas com salvamento em
      andamento e para cada tela ligada ao registro de edições), N4 (o corpo da PR #182 ficou
      com a contagem de testes anterior às correções B1 e N1) e N5 (para RH, saber que a empresa
      é única custa uma leitura da lista). Risco conhecido: a verificação definitiva, no
      servidor, da empresa esperada por requisição segue fora de escopo.
    - **Decisão:** [documento de decisão](../docs/decisions/t189-seletor-empresa-ativa.md), com as decisões aprovadas pela
      proprietária em 2026-10-27.
    - **Objetivo:** um componente único de empresa ativa, no topo do menu lateral e no Hub (no
      lugar do select atual): nome e código interno da empresa ativa; lista das empresas
      autorizadas para quem pode trocar; empresa única e perfis sem troca só para leitura;
      troca que mantém o módulo, na tela inicial segura dele; confirmação diante de edição
      pendente e bloqueio durante salvamento; aviso às outras abas e reconferência ao recuperar
      o foco.
    - **Contratos:** só os da T163 — `GET /v1/users/me`, `GET /v1/auth/contexto/empresas` e
      `POST /v1/auth/contexto/empresa` — com as permissões existentes (trocam só `rh` e
      `master_tecnico`). Sem mudança de API, schema, migration, RBAC, auditoria, seed, Docker
      ou dependência.
    - **Entrega prevista:** componente, registro global de edição pendente e salvamento em
      andamento, sincronização entre abas por `BroadcastChannel`, testes web e E2E com
      PostgreSQL real dos contratos reutilizados, validação no navegador em 375 px.
    - **Fora de escopo:** CNPJ ou outro dado fiscal, "Adicionar empresa", "Gerenciar empresas",
      concessão de empresa à conta, retorno do `master_tecnico` ao acesso global sem novo login,
      verificação definitiva da empresa esperada no servidor, `localStorage`, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T189 ao vivo, identificada
      como `[T189 dev]`, não a `main`.

87. **T190 - Filtros por Departamento e Cargo na listagem de Colaboradores**
    - **Estado:** **integrada** em `main` pela PR #183, squash
      `e148a6117a8e1a84d93ee814c6811577fa5943e3`, com a CI de push 3/3 verde (run 40579253102);
      branch preservada. Implementada na branch `codex/t190-proxima-fatia-pessoas`, a partir do
      squash `bf9d87cafb7d6676207d5d38c28889a09276dd59` (T189 integrada, PR #182).
    - **Observação de relatório:** a integração funcional da T190 está concluída; a única
      pendência administrativa era a sua convergência no Spec Kit, resolvida no primeiro commit
      da T191. Seguem abertas, sem correção: o limite de 100 itens dos catálogos de Departamento
      e Cargo dos filtros; a O1 da T188 (nomes no Horário de trabalho acima de 100
      colaboradores); a linha do tempo do vínculo sem desempate por `id`; a falha de carregamento
      dos catálogos sem anúncio por região viva; e rótulos repetidos entre empresas para o
      `master_tecnico` sem empresa ativa.
    - **Preparação:** [dossiê](../docs/decisions/t190-dossie-proxima-fatia-pessoas.md) com três opções; a proprietária aprovou a opção B
      com o complemento da O2 da T188 em 2026-10-27.
    - **Objetivo:** filtrar a listagem de Colaboradores por Departamento e/ou Cargo pela
      lotação vigente (regra da T184), combináveis com busca, situação e situação do vínculo;
      fechar a O1 da T186 (E2E de `situacaoVinculo`); e a O2 da T188 (ordem estável das
      movimentações paginadas, com `id` como desempate).
    - **Contratos:** `GET /v1/colaboradores` ganha `departamentoId` e `cargoId` opcionais
      (extensão aditiva); `GET /v1/movimentacoes` só ganha o desempate na ordem, sem mudar o
      formato. Catálogos dos filtros pelos contratos existentes (`GET /v1/departamentos`,
      `GET /v1/cargos`, só ativos). Sem schema, migration, RBAC, auditoria, seed, Docker ou
      dependência.
    - **Regras aprovadas:** contadores Todos/Ativos/Inativos sobre a empresa inteira, sem
      filtros; seletor simples, só com referências ativas da empresa ativa; previsto,
      encerrado e sem lotação vigente não aparecem com filtro de lotação.
    - **Fora de escopo:** transferência e mudança de cargo pela ficha, dados pessoais novos,
      documentos, folha, ponto, banco de horas, fuso horário, catálogos acima de 100 itens,
      importação, exportação, integrações externas, promoção e merge.
    - **Fora de escopo, explícito (pós-revisão da PR #183):** a O1 da T188 (nomes no Horário de
      trabalho acima de 100 colaboradores) continua aberta; o desempate por `id` vale só para a
      lista paginada de movimentações — a linha do tempo do vínculo não o recebeu e permanece
      fora desta entrega; os catálogos de Departamento e Cargo carregam no máximo 100 itens
      ativos e, acima disso, opções podem não aparecer no seletor — limite pendente de entrega
      própria.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T190 ao vivo, identificada
      como `[T190 dev]`, não a `main`.

88. **T191 - Horário de trabalho sem o teto de 100 vínculos e nomes**
    - **Estado:** **em implementação**. Branch `codex/t191-proxima-fatia-pessoas`, a partir do
      squash `e148a6117a8e1a84d93ee814c6811577fa5943e3` (T190 integrada, PR #183).
    - **Preparação:** [dossiê](../docs/decisions/t191-dossie-proxima-fatia-pessoas.md) com três opções; a proprietária aprovou a opção B em
      2026-10-27.
    - **Objetivo:** a tabela de vínculos de jornada do Horário de trabalho deixa de limitar
      vínculos e nomes aos primeiros 100: cada vínculo traz o próprio colaborador (`id` e
      `nome`), em lista e detalhe; a tela pagina de 20 em 20, com filtros por colaborador e por
      jornada. Fecha a O1 da T188.
    - **Contratos:** `GET /v1/horarios/vinculos` e `GET /v1/horarios/vinculos/:vinculoId`
      ganham `colaborador: { id, nome }` (extensão aditiva); filtros `colaboradorId` e
      `tabelaHorarioId` já existentes e combináveis. Sem schema, migration, RBAC, auditoria,
      seed, Docker ou dependência; leitura segue com RH, DP e `master_tecnico`.
    - **Fora de escopo:** desempate por `id` na linha do tempo do vínculo funcional, catálogo de
      jornadas acima de 100 itens (filtro e formulário seguem numa página de 100), limite de 100
      dos catálogos de Departamento e Cargo (T190), regras de jornada, dados pessoais novos,
      documentos, folha, ponto, banco de horas, fuso horário, promoção e merge.
    - **Prévia:** `http://127.0.0.1:5173` passa a mostrar a branch da T191 ao vivo, identificada
      como `[T191 dev]`, não a `main`.

## Regra obrigatória para as próximas tarefas

1. Criar ou atualizar a entrada da tarefa neste arquivo antes da implementação.
2. Atualizar `execution-status.md` e `sync-state.json` na mesma branch/PR.
3. Se houver mudança de regra, atualizar Spec, Plan e Constituição conforme o impacto semântico.
4. Executar `/speckit.converge` e `pnpm spec:check` antes de promover a PR para Ready for review.
5. Revisão e CI verdes não substituem decisão humana pendente nem autorizam merge ou produção.
6. Citar uma tarefa antiga em prosa **não** exige mais registrá-la: desde a T149 o verificador
   fiscaliza a janela de entrega declarada em `sync-state.json`, não todo `T###` do texto.
