# Estado de execução do Spec Kit — Evolli RH

**Última convergência:** 2026-09-29

**Base Git verificada:** `origin/main` em `2142c80` (T138 integrada)

**Constituição:** v1.4.0

**Finalidade:** manter a diferença explícita entre planejado, investigado, implementado, integrado,
bloqueado e cancelado.

Este ledger complementa `tasks.md`; não substitui o histórico do Git, os ADRs nem as decisões
versionadas. A condição de integração é comprovada por `main`, não por relato de chat ou por PR aberta.

## Legenda

- **Integrada:** código/documentação presente em `main` e validado pela CI correspondente.
- **Implementada:** entrega existe em branch/PR, mas ainda não está em `main`.
- **Investigada:** análise concluída sem alteração de código; resultado registrado aqui ou em documento.
- **Bloqueada:** pré-condição humana, contratual, de segurança ou infraestrutura ainda ausente.
- **Cancelada:** tarefa retirada formalmente do escopo.
- **Demonstrativa:** superfície visual sem capacidade operacional real.

## Marco integrado anterior — T001 a T049

O planejamento detalhado permanece em `tasks.md`, e a evidência técnica está no histórico Git e nos
ADRs/documentos indicados por cada tarefa. T020–T023 estão canceladas porque “Reserva Fiscal” é o nome
da empresa/projeto, não um módulo. T049 encerra o primeiro caderno de homologação de jornada e Banco
de Horas.

## Execução integrada — T050 a T073

| Faixa     | Estado    | Resultado convergido                                                                                                                                                                                |
| --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T050–T060 | Integrada | Motor puro de jornada/Banco de Horas, contratos de extrato/compensação/fechamento, fila Verificar folhas e orquestrador puro de Ponto, sempre limitados às regras homologadas e a dados sintéticos. |
| T061–T062 | Integrada | Panorama de prontidão operacional e contrato de persistência/auditoria futura de Ponto.                                                                                                             |
| T063–T070 | Integrada | Superfícies demonstrativas de Ponto, Portal, Central de Solicitações, Banco de Horas e Repositório documental; não equivalem a operações reais.                                                     |
| T071      | Integrada | Rate limit efetivo na recuperação de senha. Canal real de entrega do token continua fora do contrato operacional.                                                                                   |
| T072–T073 | Integrada | Superfícies demonstrativas de Colaboradores e Estrutura organizacional.                                                                                                                             |

## Execução integrada — T074 a T103

| Faixa     | Estado                   | Resultado convergido                                                                                                               |
| --------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| T074      | Integrada                | Mapa de capacidades e roteiro seguro de implantação do Ponto V1.                                                                   |
| T075–T081 | Integrada, demonstrativa | Relatórios > Exceções, Calendário, Ajustes, Políticas de Banco de Horas, Fechamento/Espelho, Funções/Cargos e Motivos de ausência. |
| T082      | Integrada                | Direcionamentos de RH sobre documentos e solicitações; não criou backend genérico de solicitações.                                 |
| T083–T103 | Integrada, demonstrativa | Ampliação visual de Cadastros, Pessoas, Ponto e Relatórios, com limites explícitos de não persistência e ausência de dados reais.  |

## Fundação funcional integrada — T104 a T117

| Tarefa    | Estado    | Resultado principal                                                                                                                    |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| T104–T109 | Integrada | Estrutura organizacional, cargos, departamentos, áreas, equipes e centros de custo funcionais, com escopo de empresa e testes de IDOR. |
| T110      | Integrada | Tabelas de horário funcionais.                                                                                                         |
| T111      | Integrada | Colaboradores funcionais dentro dos contratos existentes.                                                                              |
| T112      | Integrada | Vínculo de horário por vigência.                                                                                                       |
| T113      | Integrada | Marcações e ajustes aditivos de Ponto em Visão do período.                                                                             |
| T114      | Integrada | Horário de referência somente leitura em Ponto, com proteção contra respostas obsoletas.                                               |
| T115      | Integrada | Histórico funcional real: registrar, efetivar, cancelar e retificar movimentações permitidas.                                          |
| T116      | Integrada | Autenticação web real por e-mail/senha e portão de sessão.                                                                             |
| T117      | Integrada | Painel de sessões ativas e revogação de sessão.                                                                                        |

## Segurança de contas e MFA — T118 a T132

| Tarefa    | Estado      | Resultado principal                                                                                                                             |
| --------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T118      | Investigada | Recuperação de senha analisada; fluxo não é utilizável sem canal real de entrega. Gestão de contas foi indicada como próxima capacidade segura. |
| T119      | Investigada | Contrato de segurança da gestão de contas; identificou a necessidade de `GET /v1/users` paginado e escopado.                                    |
| T120      | Integrada   | API de listagem segura de contas de acesso.                                                                                                     |
| T121      | Integrada   | Interface funcional de Contas de acesso.                                                                                                        |
| T122      | Investigada | Arquitetura de MFA TOTP, recovery codes, criptografia, RBAC e rollout analisada.                                                                |
| T123      | Investigada | Especificação operacional de cofre e break-glass; distinguiu `DS-SEC-*` de `DS-OPS-01`.                                                         |
| T124      | Investigada | Inventário confirmou ausência de cofre/deploy gerenciado e aptidão apenas de dev/CI naquele marco.                                              |
| T125      | Integrada   | Núcleo backend de MFA TOTP e hardening concorrente de recovery code.                                                                            |
| T126      | Integrada   | Interface web do segundo fator, enrollment e reset administrativo.                                                                              |
| T127–T130 | Integrada   | Runbook, decisão de rollout, formulário de evidências e sincronização documental dos gates de MFA.                                              |
| T131      | Integrada   | `MFA_ENABLED` controlado pelo servidor, padrão desativado, com anti-bypass para fator já ativo.                                                 |
| T132      | Integrada   | Aceitação de risco: lançamento inicial sem MFA obrigatório; alvo universal preservado e ativação condicionada aos gates operacionais.           |

## Pessoas — T133 a T134

| Tarefa | Estado    | Resultado principal                                                                                              |
| ------ | --------- | ---------------------------------------------------------------------------------------------------------------- |
| T133   | Integrada | Pessoas > Documentos funcional para metadados e solicitações documentais, sem upload/download inventado.         |
| T134   | Integrada | Pessoas > Dados contratuais somente leitura, com guardas determinísticas contra respostas assíncronas obsoletas. |

## Solicitações gerais de Pessoas e convergência — T135 a T139

| Tarefa | Estado                      | Resultado principal                                                                                                                                                                             |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T135   | Investigada/bloqueada       | Não existe controller, persistência Prisma nem RBAC real para Solicitações gerais. Nenhum código foi criado.                                                                                    |
| T136   | Integrada                   | `PD-SOL-01..05` aprovadas; ADR 0013 define Cloudflare R2 como provedor privado futuro sem habilitar upload.                                                                                     |
| T137   | Não iniciada; substituída   | Identificador histórico da fundação, substituído pela T139 após a convergência T138; nenhum código funcional foi criado.                                                                        |
| T138   | Integrada                   | Spec Kit versionado, protegido por gate na CI e reconciliado sobre `main` com T136, decisões aprovadas e ADR 0013.                                                                              |
| T139   | Implementada; PR #131 Draft | Fundação backend da Central: módulo NestJS, Prisma/migration, cinco endpoints, RBAC deny-by-default, CSRF, auditoria transacional e E2E. Sem anexos e sem efeito automático em outros domínios. |

## Limites da T139 (implementados como limite, não como pendência esquecida)

- **Sem ESS.** Não existe vínculo autenticado `AccessUser <-> Colaborador`
  (`DP-23`, deliberadamente não materializado). O RH registra em nome do colaborador, como já ocorre em
  `solicitacoes-documento`; autoatendimento do colaborador depende de `DP-23` e não foi simulado.
- **Gestor sem capacidade de RBAC.** `PD-SOL-01` o definiu como consultivo, e consultivo não é uma
  capacidade: enquanto o escopo de equipe não for decidido, ele permanece negado por padrão.
- **Sem anexo, upload ou R2.** Continuam bloqueados pelos portões de conteúdo; a ADR 0013 aprovou o
  provedor privado futuro, nunca o upload.
- **Sem efeito automático.** Nada em ponto, férias, cadastro, vínculo, benefícios, Banco de Horas,
  Folha, fechamento ou "Verificar folhas"; sem bloqueio automático de fechamento.
- **Sem cronômetro de SLA.** Só marcos de acompanhamento (`enviada_em`, `primeira_revisao_em`).
- **Catálogo de motivos a validar com RH.** O mecanismo (código fechado, sem texto livre) é o que está
  aprovado; o conteúdo da lista é extensível de forma aditiva, como em `MotivoMovimentacao`.
- **Sem interface web.** A T139 é backend; nenhuma tela foi alterada.

## Próxima ação autorizável

1. Revisão somente leitura e integração da T139/PR #131.
2. Só depois disso abrir a próxima fatia, sob o próximo identificador disponível — sem número
   reservado aqui, porque reservar identificador antes da decisão de escopo já se mostrou fonte de
   confusão (ver T137).
3. Candidatos naturais da próxima fatia, todos dependentes de decisão própria: interface web da
   Central sobre esta API; capacidade de RBAC para o gestor consultivo; e `DP-23` como pré-condição de
   qualquer autoatendimento do colaborador.
4. Atualizar este ledger e `sync-state.json` em toda tarefa futura.

## Evidência mínima por tarefa futura

- ID, título, estado e pré-condições no `tasks.md`.
- Atualização deste ledger e do manifesto `sync-state.json`.
- Branch e PR dedicadas; Draft inicialmente.
- Testes proporcionais ao risco, typecheck, lint, build, Prettier e `git diff --check`.
- CI remota verde e revisão somente leitura.
- `/speckit.converge` registrado antes de Ready for review.
- Autorizações separadas para Ready, merge e qualquer ação operacional externa.
