# Estado de execução do Spec Kit — Evolli RH

**Última convergência:** 2026-10-01

**Base Git verificada:** `origin/main` em `8c3d8c3` (T140 e T142 integradas)

**Plataforma-base:** Evolli, por decisão de 2026-10-01
([ADR 0014](../docs/adr/0014-evolli-plataforma-base-e-encerramento-do-frappe.md)). O Frappe HR está
encerrado como candidato e permanece apenas como referência conceitual e visual.

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

**Como ler `sync-state.json` quando as integrações chegam fora de ordem.** `lastIntegratedTask` é o
**maior identificador no estado “Integrada”**, isto é, presente em `main` — não o último número
registrado. Uma tarefa de número menor que ainda não entrou fica em `openDeliveries`, com a sua PR,
e **não** puxa o campo para baixo: é o caso da T141, aberta na PR #133 enquanto a T142 já está em
`main`. Uma tarefa “Investigada” (a T143) conta em `lastRecordedTask`, mas não em
`lastIntegratedTask`, porque a legenda a distingue de “Integrada”. `lastRecordedTask` é o maior
identificador registrado em qualquer estado. O verificador só exige `lastRecordedTask ≥
lastIntegratedTask` e a presença literal dos identificadores citados na mudança.

## Marco integrado anterior — T001 a T049

O planejamento detalhado permanece em `tasks.md`, e a evidência técnica está no histórico Git e nos
ADRs/documentos indicados por cada tarefa. T020–T023 estão canceladas porque “Reserva Fiscal” é o nome
da empresa/projeto, não um módulo. T032 alinhou repositório, Spec Kit e PRD ao estado real, e é a
tarefa que mantém `DESIGN-apple.md` intacto byte a byte como referência externa. T049 encerra o
primeiro caderno de homologação de jornada e Banco de Horas.

> **Por que esta seção nomeia tarefas que uma faixa já cobre.** `pnpm spec:check` procura cada
> `T###` citado na mudança por **texto literal** neste arquivo (`scripts/check-spec-kit-sync.mjs`);
> uma faixa como “T001 a T049” não o satisfaz. Em Pull Request o contexto é só o título, mas no push
> para `main` é a mensagem inteira do commit de squash, que concatena os commits da branch — por
> isso T032, T065 e T066 derrubaram a CI de `main` sem nada de errado no código. A regra não foi
> alterada (T144): quem citar um identificador aqui não coberto nominalmente deve nomeá-lo antes.
>
> **Nota histórica — orientação superada pela T149.** O parágrafo acima descreve a regra que
> vigorou até a T148 e a instrução que a T144 deixou. Ambas estão **obsoletas**: desde a T149 o
> verificador fiscaliza a janela de entrega declarada em `sync-state.json`, e **citar um
> identificador em prosa não exige mais nomeá-lo aqui**. O texto permanece por ser o registro
> fiel do que se decidiu na época; não o siga como instrução. Ver a seção da T149.

## Execução integrada — T050 a T073

| Faixa     | Estado    | Resultado convergido                                                                                                                                                                                                                                                                                          |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T050–T060 | Integrada | Motor puro de jornada/Banco de Horas, contratos de extrato/compensação/fechamento, fila Verificar folhas e orquestrador puro de Ponto, sempre limitados às regras homologadas e a dados sintéticos.                                                                                                           |
| T061–T062 | Integrada | Panorama de prontidão operacional e contrato de persistência/auditoria futura de Ponto.                                                                                                                                                                                                                       |
| T063–T070 | Integrada | Superfícies demonstrativas de Ponto, Portal, Central de Solicitações, Banco de Horas e Repositório documental; não equivalem a operações reais. Inclui o contrato conceitual (T065) e o núcleo puro (T066) da Central de Solicitações de Pessoas, depois reconciliados com `PD-SOL-01` e `PD-SOL-03` na T139. |
| T071      | Integrada | Rate limit efetivo na recuperação de senha. Canal real de entrega do token continua fora do contrato operacional.                                                                                                                                                                                             |
| T072–T073 | Integrada | Superfícies demonstrativas de Colaboradores e Estrutura organizacional.                                                                                                                                                                                                                                       |

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

## Solicitações gerais de Pessoas e convergência — T135 a T141

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T135   | Investigada/bloqueada                     | Não existe controller, persistência Prisma nem RBAC real para Solicitações gerais. Nenhum código foi criado.                                                                                                                                                                           |
| T136   | Integrada                                 | `PD-SOL-01..05` aprovadas; ADR 0013 define Cloudflare R2 como provedor privado futuro sem habilitar upload.                                                                                                                                                                            |
| T137   | Não iniciada; substituída                 | Identificador histórico da fundação, substituído pela T139 após a convergência T138; nenhum código funcional foi criado.                                                                                                                                                               |
| T138   | Integrada                                 | Spec Kit versionado, protegido por gate na CI e reconciliado sobre `main` com T136, decisões aprovadas e ADR 0013.                                                                                                                                                                     |
| T139   | Integrada                                 | Fundação backend da Central: módulo NestJS, Prisma/migration, cinco endpoints, RBAC deny-by-default, CSRF, auditoria transacional e E2E. A revisão adversarial achou uma corrida de transições concorrentes, corrigida com lock de linha antes da integração.                          |
| T140   | Integrada                                 | Interface web funcional de Pessoas > Solicitações sobre os cinco endpoints da T139. Cliente tipado, guarda contra respostas obsoletas e RBAC refletido na experiência. Nenhum contrato de backend alterado. Três bloqueios achados em revisão adversarial e corrigidos antes do merge. |
| T141   | **Integrada** (PR #133, squash `8e3c15c`) | Ambiente local de demonstração e guia visual de acompanhamento. **Não é capacidade de RH**: é forma de olhar o que já existe, com dados sintéticos, numa máquina local.                                                                                                                |

## Limites da T139 e da T140 (implementados como limite, não como pendência esquecida)

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
- **Sem ESS na interface.** A T140 consome a mesma fundação: o RH registra em nome do
  colaborador e continua sendo o ator auditado. Nenhum login de colaborador é simulado.
- **A interface não é autoridade de segurança.** Ela esconde o que o servidor recusaria, por
  usabilidade; RBAC, escopo, CSRF e anti-enumeração continuam decididos no backend.
- **Sem anexo na tela.** Nenhum campo de arquivo, URL, conteúdo ou informação clínica é
  renderizado ou coletado — nem para `atestado`.
- **Sem prazo no navegador.** A tela exibe os marcos que o servidor gravou; não conta tempo,
  não calcula prazo e não promete conclusão.
- **Telas demonstrativas vizinhas preservadas.** T067 (Portal) e T068 (Central do RH) seguem
  demonstrativas e fora deste escopo, com teste de não regressão.

## Qualidade visual — T142 (integrada; expansão liberada)

| Tarefa | Estado                                                                                                               | Resultado principal                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T142   | **Integrada** (PR #134, squash `8c3d8c3`); padrão visual B + modais aprovado; expansão **liberada de forma gradual** | Direção visual aprovada: alternativa B com modais. Piloto de `Pessoas › Colaboradores` **integrado em `main`**; a validação do proprietário segue tela a tela. A condição arquitetural caiu em 01/10/2026 (T143, ADR 0014): a expansão é agora **tela por tela, com validação visual antes de ampliar**. **Nada foi expandido até aqui**, e a correção compartilhada do `DataTable` segue fora de escopo. |

**Apoio externo:** skill `ui-ux-pro-max` (MIT, 2.13.0, commit `09170eec`), instalada localmente e
fora do versionamento, usada como **checklist consultivo**. A fonte de verdade de design continua
sendo `DESIGN-apple.md` + `tokens.css` + `src/components/`; nenhuma regra divergente foi criada.

**Limites explícitos:** concluir o piloto **não** significa que o ecossistema foi revisado ou
corrigido. O diagnóstico cobriu as telas funcionais; as demonstrativas não foram avaliadas como
produto. Cada tela da expansão recebe identificador próprio e validação própria; liberar a expansão
não a conclui.

## Decisão arquitetural — T143 (investigada, concluída)

| Tarefa | Estado                      | Resultado principal                                                                                                                                                                                                                                                                                                                          |
| ------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T143   | **Investigada — concluída** | Avaliação do Frappe HR como possível plataforma-base, em ambiente descartável fora do repositório e só com dados sintéticos. **Decisão do proprietário em 01/10/2026 (ADR 0014):** o Evolli permanece como plataforma-base; o Frappe HR está encerrado como candidato e fica só como referência de fluxos, portal, aprovações e experiência. |

**Versões examinadas:** Frappe Framework 16.35.0 (MIT), ERPNext 16.36.0 (GPL-3.0), Frappe HR 16.20.0
(GPL-3.0, tag `v16.20.0` = `c0a04b80eeb7214…d0da041`), construção pelo `frappe_docker` em `f09126b`.
Base do Evolli na comparação: `origin/main` em `f2c1014`.

**Evidência determinante:** uma conta com vários vínculos exige **extensão relevante**; a regra de
"Employee único por conta" aparece em diversos pontos do HRMS e do ERPNext; no protótipo descartável,
10 de 58 tipos de registro ficaram com contexto de vínculo e 48 não; relatórios, compartilhamentos,
notificações e cinco endpoints do portal ainda exigiriam adaptação. Isolamento de queixas e
autoaprovação são corrigíveis, mas não resolvem o ponto estrutural. Estimativa medida para o mesmo
escopo de piloto sobre o Frappe: **≈ 30–50 dias**.

**Limites explícitos:** a decisão **não** afirma que o Frappe é inseguro ou inadequado em geral —
afirma que o custo de adaptação ao modelo do Evolli não compensa neste projeto. **Nenhuma migração**
de dados ou módulos será feita. **Proibido copiar ou adaptar código GPL** (ERPNext e HRMS) sem
análise específica de licença. Nenhum código do Evolli foi alterado nesta investigação, e nada foi
copiado para este repositório. As evidências ficam em `C:/MB/Sistema RH/frappe-prova/`, fora do
versionamento, por tamanho e por conterem um ambiente de execução. O ambiente de prova foi encerrado
operacionalmente em 01/10/2026, com volumes, imagens e evidências preservados.

## Hardening e convergência — T144 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T144   | **Integrada** (PR #135, squash `0699e3d`) | Quita as quatro pendências não bloqueantes da T142 (R1, R2, R3 e O1), fixadas pelo proprietário como **pré-condição da expansão visual**, e converge o ledger para T032, T065 e T066, restaurando a CI de `main`. Nenhuma tela nova recebeu o padrão; a regra do verificador do Spec Kit **não** foi alterada. Base: `main` em `8c3d8c3`. |

**O que mudou.** O `Modal` de detalhe de Colaboradores passou a declarar alteração pendente e
bloqueio durante a gravação, encerrando o descarte silencioso do nome (R1). A confirmação de
descarte virou um `alertdialog` nomeado pelo próprio texto, que recebe o foco ao aparecer e o
devolve a quem editava ao continuar (R2). O comentário que prometia `inert` foi substituído pela
descrição dos três mecanismos reais que deixam o fundo fora de alcance — camada fixa, foco preso e
`aria-modal` (R3). O texto que afirmava ordem inalterada na navegação foi corrigido: a ordem
relativa muda pelo agrupamento, sem perder destino nem permissão (O1).

**Contenção de foco.** A revisão da PR #135 achou que a confirmação declarava `aria-modal` mas deixava
o `Tab` alcançar os campos atrás dela. Enquanto está aberta, o escopo do foco passa a ser só o
`alertdialog`, que abre direto em “Continuar editando”; `Escape` e “Continuar editando” fecham só a
confirmação e devolvem o foco ao elemento anterior.

**Por que a CI de `main` caía.** `pnpm spec:check` procura cada `T###` citado na mudança por texto
literal no ledger. Em Pull Request o contexto é o título; no push para `main` é a mensagem inteira
do commit de squash, que concatena os commits da branch. Três pushes seguidos falharam assim — T065
e T066 na T139, T066 na T140, T032 na T142 — sem nenhum defeito de código. Os três agora são
nomeados nas faixas que já os cobriam.

**Limites explícitos:** a T144 não inicia a expansão visual, não toca a PR #133 nem a branch da
T141, e não trata as observações O2–O5 das revisões, que seguem registradas.

## Hardening pós-T141 — T145 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T145   | **Integrada** (PR #136, squash `bbb7942`) | Quita as duas ressalvas não bloqueantes que a revisão final da PR #133 registrou e que entraram em `main` sem correção: o Spec Kit autocontraditório sobre T141/T144 e o prazo declarado que não era o prazo real. Não toca API, web, Prisma, migrations, seed, credenciais, dependências nem a direção visual. Base: `main` em `8e3c15c`. |

**Prazo de parede.** Os laços de espera contavam ITERAÇÕES, não segundos. Como cada volta gastava
até `MS_TIMEOUT_TENTATIVA_HTTP` (3s) na requisição mais 1s de intervalo, o número anunciado valia
até quatro vezes mais: "180s" da API chegavam a 720s, "90s" da web a 360s e a janela de 10s do
passo 8/8 a 39s — e a mensagem de falha anunciava o prazo menor, o que atrapalhava o diagnóstico.
Agora o orçamento é tempo real: a tentativa HTTP recebe `min(timeout, o que resta)`, o intervalo
sai do mesmo orçamento, nenhuma tentativa nova começa sem orçamento, a morte do processo segue
interrompendo a espera na hora, e um teto de voltas impede que um relógio que não anda vire espera
infinita. `esperar`, `confirmarProntoWeb` e o laço do `pg_isready` passam a compartilhar um único
`aguardarComPrazo`.

**Relógio monotônico e injetável.** O relógio entra por `deps.agora`, com padrão
`performance.now()`: `Date.now()` pode recuar num ajuste de NTP e esticar ou encurtar uma espera de
180s já em curso. A injeção é o que torna o teste determinístico — nenhum milissegundo real é
gasto para provar um orçamento de 180s.

**Tolerância do passo 8/8 recalibrada.** `SEGUNDOS_CONFIRMACAO_FINAL_WEB` passa de 10 para 30: o
número mudou de unidade, não de intenção. O Vite frio aceita a conexão e a segura enquanto
transforma o módulo, então cada tentativa custava o timeout inteiro e as 10 voltas antigas davam
até 39s de tolerância real; mantido em 10, o prazo de parede reprovaria ambiente que antes subia.

**Limites explícitos:** a T145 não reabre T141–T144, não inicia a expansão visual e não trata as
observações O2–O7 e O11 das revisões anteriores, que seguem registradas.

## Arquitetura modular e protótipo do shell — T146 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T146   | **Integrada** (PR #137, squash `2e55837`) | Mapa modular do ecossistema e protótipo navegável do shell, isolados em `docs/prototipos/t146/`. **Não é capacidade de RH e não altera tela funcional alguma**: só documentação e protótipo estático. O proprietário aprovou a evolução visual e congelou a fundação (ver decisão abaixo); a prioridade passa a ser a implementação de módulos funcionais. |

**O que a tarefa é — e o que não é.** A T146 organiza **arquitetura da informação**: quais módulos
existem, como a navegação os agrupa, o que cada workspace mostra e onde entram atalhos, pendências e
listas. Nenhuma tela funcional foi redesenhada, nenhum contrato mudou e nenhuma dependência entrou.
O protótipo é estático: não fala com a API, não grava nada e se identifica permanentemente como
sintético.

**Referência ao Frappe, nos limites da ADR 0014.** Dele vieram **somente conceitos** de arquitetura
da informação — workspace por módulo, agrupamento da navegação, atalhos, listas com filtros, fila de
pendências e visão geral do ecossistema. Nenhum código, HTML, CSS, componente, texto, ícone, imagem
ou ativo foi copiado, e nenhuma dependência foi adicionada. A decisão de plataforma **não** foi
reaberta: o Evolli segue como plataforma-base.

**Inventário real, derivado do código.** O protótipo mostra o estado verdadeiro de cada tela, não
uma promessa. Contado nesta tarefa a partir de `apps/web/src/screens/` e da navegação, não
reaproveitado de texto anterior: **45 telas folha** hoje — **11 funcionais** (leem e gravam pela
API), **1 parcial** (`Pessoas › Dados contratuais`, consulta real sem escrita) e **33
demonstrativas** (dados de exemplo no próprio código). Os módulos do mapa que ainda não têm tela
aparecem como **planejados**. Nenhum indicador sugere produção ou homologação.

**Tela real e capacidade são escalas distintas, e o protótipo nomeia cada uma.** Tela real é
arquivo de tela-folha em `apps/web/src/screens/` — a escala da manchete, com os seis contêineres
de abas descontados. Capacidade é item do mapa proposto: pode ser fluxo dentro de outra tela
(admissão vive dentro de Colaboradores; as marcações, dentro da Visão do período), aparência sem
código atrás, ou plano. Uma capacidade que aponta para uma tela real herda o estado dela, e a
contagem tem fonte única em `docs/prototipos/t146/dados.js` — foi a mistura silenciosa das duas
escalas que fez a 1ª versão anunciar 11 telas funcionais acima de uma lista com 13 nomes.

**Folha, eSocial e obrigações fiscais** aparecem somente numa seção de evolução futura, fora da
navegação operacional, justamente para não serem lidos como capacidade existente.

**Limites explícitos:** a T146 não inicia a expansão do padrão B para outro módulo, não implementa
folha, eSocial, férias, benefícios nem clima, não altera `apps/api`, Prisma, migrations, contratos,
RBAC ou dados, e não toca nas telas funcionais de `apps/web`.

**Decisão do proprietário — aprovação visual e congelamento da fundação.** _"Aprovo a evolução
visual da T146, porém devemos focar agora na entrega dos módulos funcionais e testados, deixando o
acabamento visual final para o fim."_ Interpretação vinculante, registrada por extenso em
[`docs/decisions/t146-arquitetura-modular-shell.md`](../docs/decisions/t146-arquitetura-modular-shell.md):
a arquitetura modular, o shell, os tokens, o padrão B, a sidebar e os modais ficam aprovados como
**fundação visual**, e essa fundação fica **congelada** — sem expansão ou redesenho amplo agora.
Durante a implementação dos módulos, só correção necessária de usabilidade, acessibilidade,
responsividade ou bloqueio operacional pode alterar a interface; refinamento estético e acabamento
visual final ficam para uma etapa posterior. A prioridade passa a ser entregar **módulos
funcionais, testados e homologáveis com dados sintéticos**. A aprovação foi visual; a integração
veio depois, pela PR #137 (squash `2e55837`), com a CI de `main` verde.

## Homologação funcional da Admissão — T147 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T147   | **Integrada** (PR #138, squash `1d7531c`) | Primeira fatia funcional depois do congelamento da fundação visual: homologou a **admissão** (colaborador, vínculo e referência organizacional inicial) de ponta a ponta, com prova de coerência em Colaboradores, Dados contratuais e Histórico funcional. |

**O que a tarefa é.** A T147 não inventa capacidade: ela **endurece e homologa** o fluxo de
admissão sobre os contratos que já existem em `apps/api` e nas telas funcionais de `apps/web`.
O critério de pronto é um cenário sintético completo, provado por teste e verificado em navegador
real — não a existência de código.

**Limites explícitos:** a T147 não implementa importação de ponto/AFD, REP, banco de horas, férias,
benefícios, clima, dependentes, folha, eSocial, obrigações fiscais, R2/anexos, MFA, ESS/MSS; não
redesenha a arquitetura visual; e não copia código ou ativo do Frappe.

**Nota de escopo — investigação anterior sob o mesmo identificador.** Houve uma investigação de
importação de marcações de ponto que **parou no gate técnico** e não produziu branch, commit nem
alteração de Spec Kit. Ela não é entrega e não ocupa o identificador: a importação AFD segue
bloqueada pela ADR 0008 (decisão 4 — origem única manual) e pelas pendências `DP-3J-07`,
`DP-3J-20`, `DP-3J-09`, `DP-3J-11` e `DS-OPS-01`.

**Ressalvas registradas na revisão final, não tratadas na T147:** o banco local de demonstração
ainda refletia o seed anterior (a efetivação só aparece depois de reexecutar `seed:demo`); o
`POST /v1/colaboradores` devolve apenas o colaborador, exigindo dois GETs para alcançar vínculo e
movimentação; e o formulário admite por **uma** referência organizacional, embora a API aceite as
seis.

## Integração de registros de ponto — T148 (pacote de decisão entregue)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T148   | **Integrada** (PR #139, squash `9521e32`) | Convergiu a T147 e avaliou a fundação para receber registros de ponto do sistema atual. A investigação confirmou que os contratos existentes não definem, sem invenção, chave de idempotência nem autenticação de ator não humano — por isso não há implementação: o resultado é um [pacote de decisão](../docs/decisions/pacote-decisao-integracao-registros-ponto.md). |

**Por que não houve implementação.** A regra da tarefa exige que origem, formato, autenticação,
idempotência, relação com empresa/colaborador/vínculo, duplicatas, preservação da marcação original,
auditoria e resposta a erro estejam definidos nos contratos existentes, sem invenção. Dois pontos
fecham o caminho de código, confirmados em código e documento: (1) o único `@@unique` de
`evento_ponto` é `(id, empresaId)` — não serve para deduplicar marcação externa, e o contrato do
lote AFD (T042 §7) proíbe inferir a chave natural; (2) não existe, em nenhuma rota do produto,
mecanismo de autenticação para um ator não humano — `evento_ponto.registrado_por_user_id` é
obrigatório e aponta para `AccessUser` humano, e o `CsrfGuard` exige sessão para emitir o token.
A origem automatizada também segue proibida pela ADR 0008, decisão 4, até ADR nova ou emenda formal.

**Limites explícitos:** a T148 não implementa folha, banco de horas, adicional noturno, DSR,
fechamento, transmissão fiscal, REP-P, PAdES, AEJ nem integração externa real sem contrato e
autorização próprios — nenhum desses limites foi tocado, porque nenhum código foi escrito.

## Verificador do Spec Kit — T149 (hardening da regra de identificadores)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                             |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T149   | **Integrada** (PR #140, squash `078fde5`) | Corrigiu na origem o falso positivo que derrubou a CI de `main` quatro vezes. A regra deixa de exigir registro literal de todo `T###` citado em prosa e passa a fiscalizar a janela de entrega declarada em `sync-state.json`. Primeiros testes do verificador. |

**Prova em produção.** O próprio squash `078fde5` cita em prosa narrativa os identificadores que
derrubavam a CI — as duas referências ao parser AFD, além de T032, T065 e T066 — e a CI de `main`
passou **3/3** (run `37483858437`), com `pnpm spec:check` imprimindo _"Spec Kit sincronizado"_. O
primeiro push real de squash depois da correção é também a demonstração de que ela funciona.

**A decisão da T144 foi revertida, e isto é deliberado.** A T144 escolheu curar os identificadores
já queimados e registrou três vezes — ledger:190, `tasks.md`:677 e `tasks.md`:712 — que **a regra do
verificador não foi alterada**. Aquela escolha não segurou: duas referências históricas ao parser
AFD, citadas em prosa, derrubaram a CI de `main` no push do squash `9521e32` (T148) — a quarta
ocorrência, três integrações depois da advertência. A T149
muda a regra, com autorização explícita do proprietário no enunciado da tarefa, porque o defeito
estava no gerador e não nos identificadores.

**Causa raiz, confirmada em execução e não só por leitura.** Dois defeitos estruturais somados:

1. **Escopo.** `.github/workflows/ci.yml:34` define
   `SPEC_KIT_CHANGE_CONTEXT: ${{ github.event.pull_request.title || github.event.head_commit.message }}`.
   Em Pull Request isso é só o título; no push para `main` é a mensagem inteira do squash, que
   concatena os commits da branch. Toda prosa explicativa virava exigência de registro — citar uma
   tarefa antiga não é entregá-la. É por isso que a PR #139 passou 3/3 em `ea9cea6` e o mesmo
   conteúdo reprovou em `9521e32`.
2. **Busca.** A extração usava fronteira de palavra (`\b`), mas a verificação usava
   `String.includes`, que é substring. Numa faixa `T104–T109` a string `T104` existe e passa,
   `T105` não existe e reprova: **o extremo de uma faixa passava por acidente e o miolo nunca
   passava**. Medido com `String.includes` sobre os artefatos da base `9521e32`, estado em que a
   CI quebrou — e não sobre o head desta branch: **118 dos 149 identificadores reprovariam se
   citados**.

**A regra nova.** "Quais tarefas esta mudança entrega?" não é pergunta para texto livre — é o
próprio Spec Kit que responde, em `sync-state.json`:

- **Tarefas entregues** = a janela `(lastIntegratedTask, lastRecordedTask]`, lida e não inferida.
  Todas continuam obrigatórias nos dois artefatos. Suporta mais de uma entrega aberta e não presume
  que a de maior número seja a corrente.
- **Identificadores citados** no contexto respondem a uma única pergunta: são futuros
  (`> lastRecordedTask`)? Se sim, há trabalho citado e não registrado — reprova. Se não, são
  referência histórica legítima, cujo registro já foi fiscalizado quando aquela tarefa era a
  corrente.
- **Cobertura** passa a expandir faixas (`T104–T109`, `T001 a T049`) e a casar por fronteira de
  palavra — **mais estrito** que `includes`, não menos.
- **Contexto ausente é fail-closed.** Em `workflow_dispatch` os dois lados do `||` são nulos, o
  GitHub injeta `""`, e `??` não caía no fallback: o gate virava **no-op silencioso**. Fechado.

**Por que não enfraquece o gate.** A tarefa efetivamente entregue continua obrigatória nos dois
artefatos; citar tarefa futura continua reprovando; a busca ficou mais rígida. O que deixou de ser
fiscalizado — menção narrativa a tarefa antiga — nunca foi sinal de entrega. Nenhuma lista de
exceções e nenhum identificador tratado como caso especial: as duas referências históricas ao
parser AFD **não** ganharam entrada autônoma neste ledger, nem whitelist, nem qualquer mecanismo
de compatibilidade. Esta seção evita nomeá-las justamente para que o ledger não as registre como
efeito colateral da própria explicação.

**Prova.** `scripts/spec-kit-sync.core.test.mjs` reproduz literalmente a mensagem do squash
`9521e32` e inclui o caso `1b`, que reimplementa a regra anterior e prova que ela reprovava as duas
referências históricas no mesmo texto em que a regra nova passa — os identificadores aparecem lá,
como fixture de regressão, que é o lugar certo para eles. Os testes 2, 3 e 3b provam que tarefa
entregue ausente de um dos artefatos ainda reprova, nomeando o arquivo que falta.

**Estado malformado é fail-closed.** A primeira versão desta tarefa fechou o no-op do contexto e
abriu um equivalente no estado: sem validar `sync-state.json`, um `lastRecordedTask` ausente,
`NaN`, `Infinity`, decimal ou string não numérica fazia `tarefasEntregues` devolver lista vazia e
`numero > NaN` ser sempre falso — **os dois braços do gate desligavam**, e o verificador aprovava
com os dois artefatos vazios. A regra anterior à T149 falhava fechado por acidente, ao procurar o
literal `"Tundefined"`. `validarEstado` é a validação **única**, chamada pelo núcleo antes de
calcular a janela e pelo CLI antes de ler artefato: exige os dois campos, inteiros seguros e não
negativos, com `lastIntegratedTask <= lastRecordedTask`. A mensagem nomeia o campo e o tipo
recusado, nunca o conteúdo nem um stack, e o CLI encerra com código não zero. No caminho, o CLI
deixou de derrubar o processo diante de manifest ou artefato de governança ilegível — agora vira
diagnóstico.

**Limitações conhecidas, deliberadamente não tratadas:** identificador em caixa baixa (`t151`) e
caracteres zero-width entre as letras escapam da detecção de tarefa futura. Valem igualmente para
a regra anterior — nenhuma das duas é regressão desta tarefa.

**Limites explícitos:** a T149 não toca código funcional de RH, banco, seed, Prisma, migrations,
integração de ponto, autenticação, auditoria nem RBAC; não aprova nenhuma decisão do pacote da
T148; e não reescreve nenhuma mensagem de commit já integrada.

**Dívida registrada e não tratada aqui — convergência de atributos do seed.** O seed de
demonstração é idempotente **por existência**: `garantirColaborador` confere se o registro já
existe e, se existir, não aplica o payload declarado. Quando a T147 passou a enviar
`cargoId: analista.id` para `DEMO-A-0001`, o registro já existia de uma execução anterior e o
atributo nunca foi aplicado — a alocação vigente ficou sem cargo, silenciosamente divergente da
intenção do seed atual. Caso conhecido: `DEMO-A-0001` e `cargoId`. Precisa de tarefa própria para
decidir entre convergir atributos de registros preexistentes ou documentar a limitação; **não foi
corrigida na T149**.

## Gestor consultivo — T150 (pacote de decisão entregue)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                                                                                  |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T150   | **Integrada** (PR #141, squash `ba80157`) | Convergiu a T149 e avaliou a fundação para um Portal da Liderança somente leitura. O gate da própria tarefa reprovou a implementação: não existe contrato que determine a equipe de um gestor. Resultado: [pacote de decisão](../docs/decisions/pacote-decisao-escopo-do-gestor.md) reusando `DP-8`. |

**Por que não houve implementação.** A tarefa condiciona o código a já existir contrato seguro e
inequívoco para determinar a equipe do gestor, e proíbe derivá-la de cargo, nome, papel, e-mail,
empresa inteira ou heurística de lotação. Faltam **três elos independentes**, e a ausência de cada
um é decisão registrada, não lacuna:

1. **Nenhuma relação gestor/subordinado existe, nem estruturalmente** — ADR 0006, decisão 8,
   reafirmada nas ADRs 0007, 0008 e 0010 e em dois comentários do próprio schema
   (`schema.prisma:515` e `:765`). Varredura por `gestorId`, `responsavelId`, `liderId`,
   `managerId`, `supervisorId`, `chefeId`, `reportaA` e `parentId` em todo o schema e em todas as
   migrations: **zero campos**.
2. **Nenhum vínculo entre conta e pessoa** — `DP-23`, descrito no schema como "deliberadamente nao
   materializado". O sistema não sabe qual colaborador é o gestor autenticado.
3. **Estrutura não é fronteira de autorização** — `escopo.util.ts:8-9`: `empresaId` é a única
   fronteira. A ADR 0006 antecipou literalmente este caso e determinou que transformar departamento
   ou área em fronteira exige **ADR nova ou emenda formal, com migration própria**.

**O código já recusava, pelo mesmo motivo.** O avaliador RBAC nega o `gestor` em seis ramos,
nominalmente, registrando que "conceder exigiria escolher a fronteira (equipe? departamento?
direto ou indireto?) por conta própria". O RBAC contém **seis testes cujo título nomeia
explicitamente o gestor em cenários de negação** — um deles em um `describe` chamado
`"gestor: negado enquanto DP-8 nao for decidida"` — além de casos parametrizados que o incluem em
listas de papéis negados. **Não há concessão de capacidade ao gestor**: nenhum ramo `case "gestor"`
concessivo existe em `apps/api/src`. Implementar exigiria reverter testes escritos de propósito
para impedir exatamente isso.

**O campo que parece resolver e não resolve.** `AccessUser` tem `unit_id` e `team_id`, mas são
`TEXT` sem FK, aceitos por `@IsString()` sem validação contra a empresa, ausentes do
`AuthorizationSubject` (que tem só `userId`, `role`, `companyId`) e sem semântica definida —
"equipe que lidera" ou "equipe a que pertence" são opostos para efeito de escopo. Usá-los seria
inventar a relação e abrir vetor de vazamento entre empresas. **A ausência de FK é original e
deliberada:** a ADR 0003, decisão 8, a condicionou a _"até a Etapa 1 criar essas entidades de
fato"_. A condição já se cumpriu — `Equipe` e `UnidadeOrganizacional` existem desde as T104–T109 —
mas **a FK nunca foi adicionada**. Dívida de integridade referencial preexistente, registrada aqui
e **não tratada** por esta tarefa.

**Fato novo que a T150 registra.** A ADR 0006 classificou `P8.2` (o escopo do gestor tende a ser
por equipe?) como "genuinamente futura", condicionada a _"quando a entidade colaborador existir"_.
**Essa pré-condição foi satisfeita** — `Colaborador`, `VinculoFuncional` e `AlocacaoOrganizacional`
existem e são funcionais desde as T104–T117 e a T147. `DP-8` deixou de estar bloqueada por ausência
de modelo; está pendente apenas de **decisão de negócio**.

**Limites explícitos:** a T150 não cria endpoint, controller, model, migration, regra de RBAC, ação
de auditoria, alteração de seed nem tela; não afrouxa nenhuma negação vigente; não reinterpreta
campo existente; e não aprova nenhum item do pacote da T148.

## Gestor consultivo — T151 (fundação segura, decisão aprovada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                                                       |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T151   | **Integrada** (PR #142, squash `a356418`) | Formaliza a decisão do proprietário na [ADR 0015](../docs/adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md) e entrega a fundação: três tabelas, RBAC próprio, administração pelo RH e consulta consultiva pelo gestor. |

**A decisão, literalmente.** Em **06/10/2026** o proprietário aprovou:
_"Aprovo as recomendações 1 a 9 para o escopo do gestor e DP-23"_. A ADR 0015 registra as nove
decisões vinculantes; o [pacote da T150](../docs/decisions/pacote-decisao-escopo-do-gestor.md) passa
a **Aprovado**, com o texto original preservado como registro do raciocínio.

**`DP-8` e `DP-23` passam a RESOLVIDAS — e somente no recorte aprovado:** gestão por equipe,
múltiplas equipes por gestor, subordinados diretos, um principal e no máximo um substituto vigentes,
conta ligada explicitamente ao colaborador da mesma empresa, vigência e histórico auditável,
exceções só pelo RH com justificativa e prazo. **Continuam NÃO aprovados e não foram habilitados:**
gestão matricial permanente, departamento inteiro e empresa inteira.

**As invariantes vivem no banco, não na aplicação.** FK composta `(equipe_id, empresa_id)` contra
`equipe(id, empresa_id)`; EXCLUSION CONSTRAINT sobre `daterange` para sobreposição temporal —
inclusive `(equipe, papel, período)`, que é o que permite principal e substituto coexistirem sem
admitir dois principais; índices parciais únicos como complemento, para que a colisão concorrente
devolva 409 estável; CHECK de intervalo coerente e de justificativa não vazia; e CONSTRAINT TRIGGERS
de **duas portas** para o que atravessa tabelas — porque uma invariante entre tabelas só fica
garantida se toda porta capaz de quebrá-la disparar a verificação. Todas foram **provadas contra
PostgreSQL real antes de escrever a primeira linha de service**.

**O escopo nunca cai para "tudo".** A resolução é sessão → `access_user_colaborador` →
`atribuicao_gestor_equipe` → alocação vigente. Em qualquer passo que falhe, o resultado é **lista
vazia** — a função retorna antes de consultar, de modo que o fallback para a empresa inteira é
impossível por construção, não por cuidado no `where`.

**Fora desta entrega, por ausência de contrato seguro e não por esquecimento:** **resumo de jornada**
não existe como dado nem como rota (`DP-3J-12` segue pendente), e **andamento de solicitações** tem
modelo seguro mas `tipo`/`motivo` revelam condição de saúde por inferência — `PD-SOL-05` só autoriza
"informação operacional mínima", que ainda não está definida. Ambos para a **T152**, com decisão
própria. Criar consulta paralela sem contrato seria inventar a fronteira, que é o que a T150 recusou.

**Correções da revisão adversarial (mesma T151, segunda rodada).** A revisão encontrou dois
bloqueios e uma ressalva forte, todos fechados nesta branch:

- **A data de autorização vinha do cliente.** `GET /v1/gestor/equipe` aceitava `?dataReferencia=`, e
  o serviço resolvia com ela a ligação e as atribuições **do próprio ator** — `hoje()` era apenas o
  padrão, nunca um teto. Um gestor encerrado recuperava a equipe informando data da janela antiga, o
  que contradiz a decisão 8 da ADR 0015 (_"Decisões de acesso usam o estado vigente"_). O parâmetro
  foi **removido** das duas rotas consultivas; enviá-lo responde 400, e o dia civil passou a sair de
  `America/Sao_Paulo` em vez de UTC. O teste E2E que cristalizava o comportamento como correto foi
  substituído por cinco que provam o contrário, e eles falham no SHA anterior.
- **A equipe de demonstração estava vazia.** `matriculaNaEquipe` era recebida e nunca usada, nenhuma
  admissão do seed informava `equipeId`, e `gestor.alfa` via lista vazia enquanto o guia afirmava o
  contrário. Entrou `DEMO-A-0201`, único registro sintético com equipe, e o seed agora **confere** a
  composição ao final em vez de só executar os passos.
- **O histórico não era append-only de verdade.** A garantia se apoiava em "não há rota `DELETE`" —
  que protege o pai, não a linha. A migration `20261007120000` revoga `DELETE` de `evolli_app` nas
  três tabelas e adiciona gatilhos que limitam o `UPDATE` ao encerramento, uma vez só.
- **TOCTOU nos três encerramentos.** `findFirst` conferia e `update` escrevia por `id`: dois `PATCH`
  simultâneos sobrescreviam autor e data. O predicado passou para dentro do `updateMany`, o segundo
  recebe 409 genérico e a auditoria da perdedora reverte junto.

**Limites explícitos:** sem interface web; sem alteração na integração de ponto; sem gestão
matricial; sem liberar departamento ou empresa; sem folha, eSocial, benefícios ou documentos.

**Dívidas mantidas, não tratadas aqui:** a FK de `unit_id`/`team_id` que a ADR 0003 postergou
_"até a Etapa 1 criar essas entidades"_ — condição cumprida, FK nunca adicionada; a convergência de
atributos do seed (`DEMO-A-0001`/`cargoId`); as limitações de caixa baixa e zero-width no
verificador; e as decisões do pacote de integração de ponto (T148).

## Verificador do Spec Kit — T152 (hardening, declaração vs. citação)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                   |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| T152   | **Integrada** (PR #143, squash `3f73f4e`) | Separa **declaração de entrega** de **citação em prosa** no verificador, recuperando a CI de `main` sem afrouxar a detecção de tarefa não registrada. |

**Escopo, explicitamente.** A T152 é **somente** o hardening do verificador. O módulo funcional
antes cogitado sob este número — **resumo de jornada** (`DP-3J-12`) e **andamento de solicitações**
(`PD-SOL-05`) — **não foi iniciado**, continua sem contrato seguro e permanece fora.

**O que quebrou, provado por reprodução e não por hipótese.** O squash da T151 (`a356418`) entrou em
`main` com E2E e Migration smoke verdes, e Quality gates vermelho num ponto só: `spec:check` disse
_"T152 aparece na mudança, mas lastRecordedTask=151"_. O workflow injeta
`github.event.pull_request.title || github.event.head_commit.message`. Em Pull Request isso é **uma
linha**; no push para `main` é a **mensagem inteira** — 348 linhas. A regra (b) da T149 varria todo
o texto atrás de identificador futuro, e o corpo do squash cita a T152 exatamente para registrar que
ela **não foi iniciada**. Dizer "isto fica para a T152" virava "estou entregando a T152".

O mesmo commit recebia **três vereditos**: passava no PR, passava na execução local — o fallback do
CLI usa `git log -1 --pretty=%s`, só o assunto — e reprovava no push. Um portão que muda de resposta
conforme o evento não é mais rigoroso; é não determinístico.

**A regra por posição foi tentada e descartada.** A primeira versão tratava a "primeira linha com
identificador" como declaração. A revisão adversarial da PR #143 derrubou com um caso que não exige
má-fé nenhuma:

```
Retoma o critério da T151 e ajusta o verificador   <- 1ª linha, histórico

Esta mudança entrega a T153.                       <- entrega real
```

Com o ledger em T152, a T153 passava sem registro. Citar a tarefa anterior no assunto é padrão aqui
(`T145 — Hardening pós-T141`, `T148 — Convergência da T147`), então o bypass estava a um commit de
distância. **Posição é determinística, mas não é declaração:** "fica para a T153" e "entrega a T153"
ocupam a mesma posição e têm sentidos opostos, e nenhuma heurística de texto os separa.

**O protocolo que a substituiu.** O autor declara, em trailer estruturado e auditável:

```
Spec-Kit-Entrega: T152
Spec-Kit-Nao-Entrega: T153
```

Quando obrigatório: existe exatamente **uma declaração lógica** de entrega — um `Spec-Kit-Entrega`
não vazio, que pode listar uma ou mais tarefas; toda tarefa declarada existe nos **dois** artefatos e
não está acima de `lastRecordedTask`; **todo** identificador acima de `lastRecordedTask`, em
**qualquer** posição, está classificado num dos dois trailers; nenhum aparece nos dois; trailers
**idênticos após normalização em conjunto são idempotentes** (a mesma declaração repetida, não duas
decisões); e trailer **com conteúdo divergente**, vazio, malformado, ausente ou com o mesmo
identificador nas duas classificações **reprova**. O corpo volta a ser varrido inteiro — o bypass
some porque a menção deixa de ser julgada pelo lugar e passa a depender de o autor dizer o que ela é.
Esquecer de classificar falha **fechado**.

**Corte de adoção, objetivo e sem hash:** obrigatório quando `lastRecordedTask >= 152`
(`TAREFA_DE_ADOCAO_DO_PROTOCOLO`). Abaixo disso, **modo histórico** — só a regra (a), porque exigir
trailer de commit que já está em `main` seria exigir reescrita de histórico. Não há lista de hashes
nem exceção por identificador. A constante vive no **código**, não em `sync-state.json`: em estado,
a mesma mudança que deveria ser fiscalizada poderia baixar o corte e desligar o protocolo junto.

**Uma noção só de contexto.** O squash do GitHub monta a mensagem com o título da PR mais as
mensagens dos **commits** — não a descrição da PR; o evento `pull_request` entrega título e
descrição. Os trailers vão, portanto, **na mensagem de commit** e **na descrição da PR**. O workflow
passou a fornecer título + corpo no evento de PR, e o fallback local passou de `--pretty=%s` para
`--pretty=%B`: antes, o mesmo commit tinha veredito diferente local e na CI.

**Duplicidade é união idempotente, não duas decisões.** A mesma declaração chega por canais
diferentes — o evento de PR traz título e descrição; o push traz o squash, que concatena as
mensagens de **todos** os commits. Uma PR de três commits em que dois declaram
`Spec-Kit-Entrega: T152` produz duas linhas iguais, e isso não é contradição. A primeira versão
reprovava qualquer repetição, e isso deixava a PR verde e quebrava `main` no merge — o mesmo modo
de falha que a tarefa existe para eliminar. A regra compara **conjuntos normalizados**: equivalentes
se fundem (inclusive em ordem diferente), divergentes continuam sendo contradição.

**A CI da PR valida também a mensagem PREVISTA do squash.** Duas perguntas distintas, dois passos:
o contexto de revisão (título + descrição) e o texto que existirá depois do merge (título + todas as
mensagens de commit, lidas de `base..HEAD`). Qualquer um que falhe derruba o Quality gate antes do
merge. Título e número chegam por ambiente; o histórico é lido pelo próprio script com argumentos
fixos — conteúdo de PR nunca entra em comando de shell.

**O estado não recua.** O CLI real recusa `lastRecordedTask` abaixo da adoção: ele vive numa árvore
que já contém o protocolo, então um ledger abaixo do corte não é modo histórico, é estado
incoerente. Sem essa guarda, a mesma mudança que entrega uma tarefa nova poderia rebaixar o ledger
e desligar a fiscalização junto. O modo histórico permanece **só no núcleo puro**, para replay de
integrações anteriores à adoção em teste.

**Preso por mutação, nos cinco sentidos.** Voltar a reprovar duplicidade idêntica quebra o contexto
real do squash; aceitar divergência quebra outro; remover a validação do squash na PR quebra a
guarda do workflow; remover a guarda de rebaixamento quebra o teste do CLI; ignorar futura não
classificada quebra um quinto.

**Não tratado, e declarado:** caixa baixa (`t153`) e zero-width continuam escapando de
`IDENTIFICADOR`, exatamente como antes desta tarefa. É dívida anterior, já registrada, com teste
próprio que a torna explícita em vez de silenciosa.

**Proteções da T149 preservadas:** `validarEstado` (estado inválido falha fechado) e o fail-closed
de contexto ausente seguem intactos, com teste próprio nesta tarefa.

**Nada funcional foi tocado:** sem alteração em API de negócio, schema Prisma, migrations de
negócio, seed, Docker ou interface web.

## Interface web do Gestor Consultivo — T153 (somente leitura)

| Tarefa | Estado                                     | Resultado principal                                                                                                          |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| T153   | **Integrada** (PR #144, squash `94bdeded`) | Interface web consultiva do gestor sobre a fundação da T151: lista da equipe autorizada e detalhe em modal, somente leitura. |

**Escopo, explicitamente.** A T153 é **somente a interface web**. Consome os dois endpoints que a
T151 já integrou e **não altera** API, schema Prisma, migration, seed, RBAC, Docker, dependências
ou lockfile. Nenhuma capacidade nova é criada: a tela mostra o que o servidor já autoriza, e só.

**O bloqueio anterior caiu, e isto é registro, não atalho.** Até a T150 o Gestor consultivo estava
fora dos candidatos imediatos porque dependia de `DP-8` e `DP-23`. A T151 **resolveu as duas** pela
[ADR 0015](../docs/adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md), no recorte
aprovado literalmente pelo proprietário em 06/10/2026, e entregou a fundação com as invariantes no
banco. A seção "Próxima ação autorizável" abaixo ainda carregava a leitura anterior à T151 —
corrigida nesta convergência.

**Autorização não é decidida no frontend.** O escopo sai da sessão no servidor; a `dataReferencia`
vem na resposta e é **informativa**. A interface não oferece — e não pode oferecer — parâmetro de
data: a ADR 0015, decisão 8, fixa que decisões de acesso usam o estado vigente, e a rota responde
400 a qualquer query desconhecida. Esconder botão não é controle de acesso; a porta continua sendo
`gestor_equipe` `read` no RBAC. A tela **não infere subordinação** por e-mail, nome, `unit_id`,
`team_id` textual ou lotação: a lista é exatamente o que o servidor devolveu.

**Projeção fechada, sem invenção.** A tela exibe apenas os campos da decisão 7 que a API devolve.
Campo que a API não manda, a tela não mostra — e não preenche com placeholder.

**404 é indisponibilidade, nunca enumeração.** Fora do escopo a API responde 404 (não 403, que
confirmaria existência). A tela apresenta "não disponível", sem distinguir inexistente de alheio,
e **nunca** exibe corpo interno de erro.

**Concorrência por guarda monotônica por carregador.** Resposta obsoleta não atualiza dados, erro
nem carregamento. Troca rápida de vínculo descarta o detalhe anterior; fechar o detalhe invalida
sua requisição; nova tentativa mantém só a mais recente; troca de sessão limpa e invalida tudo.
O risco que isso fecha é concreto: uma resposta tardia fazendo o dado de uma pessoa reaparecer sob
o nome de outra.

**Capacidades ausentes continuam ausentes, e declaradas.** A API devolve `resumoJornada` e
`andamentoSolicitacoes` como `null` **de propósito**, para que o cliente não precise adivinhar se
a capacidade existe e falhou ou se nunca existiu. A interface honra isso: **não** desenha cartão
vazio nem dado fictício. O módulo funcional antes cogitado sob o número da T152 — **resumo de
jornada** (`DP-3J-12`) e **andamento de solicitações** (`PD-SOL-05`) — **não foi iniciado** e segue
sem contrato seguro.

**Contratos consumidos, conferidos na fonte.** `GET /v1/gestor/equipe` devolve
`{ dataReferencia, itens }`; cada item tem os dez campos de `comoItem`.
`GET /v1/gestor/equipe/vinculos/:vinculoId` devolve o item mais `horarioVigente`
e os dois campos declarados `null`. O prefixo `/v1` vem de `enableVersioning`
(URI, `defaultVersion: "1"`), não de `setGlobalPrefix` — detalhe que, errado,
daria 404 em produção e teste verde em jsdom. Datas chegam como ISO completo e
são exibidas por `formatarDia`, que corta os dez primeiros caracteres sem
recalcular fuso.

**Papéis, espelhando o avaliador e nada além dele.** O RBAC concede
`gestor_equipe`/`read` a **dois** papéis, ambos na própria empresa: `gestor` e
`rh`. Negar `rh` na interface seria inventar restrição que o contrato não tem;
conceder a `dp`, `colaborador`, `master_tecnico`, `admin_tecnico`,
`financeiro`, `auditor` ou `dpo` seria conveniência contra o contrato. A
constante `PAPEIS_COM_CONSULTA_DE_EQUIPE` é exportada justamente para que um
teste prenda a lista.

**Prova por mutação, cinco direções.** Remover a guarda monotônica do detalhe
mata `T153.15` e `T153.16`; removê-la da lista mata `T153.14`; liberar `dp`
mata `T153.11`, `T153.12` e `T153.A2`; parar de ocultar o destino condicional
mata `T153.A1` e `T153.A2`.

**A quinta mutação sobreviveu, e isso está registrado em vez de escondido.**
Remover `seqDetalhe.current += 1` de `fecharDetalhe` não quebra teste nenhum.
Investiguei a causa em vez de inventar um teste que a justificasse: com
`vinculoAberto` nulo o modal não renderiza, e **toda** abertura já incrementa o
contador, de modo que a resposta vencida seria descartada de qualquer forma. A
linha permanece como defesa em profundidade — ela é o que mantém a proteção
independente de `abrirDetalhe` continuar recarregando sempre, premissa que um
cache futuro quebraria em silêncio — e o código diz isso com todas as letras.

**375 px não tem teste automatizado, e a razão é do ambiente.** O Vitest roda
em jsdom com `css: false` (`apps/web/vite.config.ts`): não há motor de layout,
e nenhum teste do projeto pode medir largura, `scrollWidth` ou overflow. O que
o teste prende é o **contrato de CSS** que de fato impede o vazamento —
`min-width: 0` na raiz e nos filhos diretos, `position: relative` na tabela —
mais a semântica da região rolável. A medição real fica na verificação visual,
como o guia visual do projeto já estabelece.

**B1 — o papel autorizado aterrissava numa tela proibida.** Achado pela
revisão adversarial, medido em navegador: ao entrar, o `gestor` caía em
"Cadastros › Horários", uma tela rotulada **"Somente RH"**, e recebia dois
`403` em `GET /v1/horarios` antes de qualquer clique. No refresh a ordem era
pior — `/v1/horarios` saía **antes** de `/v1/users/me`, isto é, a requisição
proibida partia antes de o papel sequer ser conhecido.

A causa não era o destino padrão: era a **fronteira de autenticação**. O
`AutenticacaoApp` tinha três estados e tratava "sessão válida" como "pronto",
montando o shell na hora; a leitura do ator corria em paralelo, só para
alimentar `mfaDisponivel`. O shell montava no destino padrão e a tela dele
disparava a consulta antes de existir papel.

Corrigir só a aterrissagem não bastaria: o flash e o 403 já teriam
acontecido. A fronteira passou a ter **cinco estados explícitos** —
`verificando-sessao`, `login`, `resolvendo-ator`, `pronto`, `falha-ator` — e
`<App>` só existe em `pronto`. Enquanto o ator não é conhecido, nada
funcional monta; só um estado de carregamento acessível.

**Falha fechado.** Erro em `GET /v1/users/me` — ou resposta sem `role`
utilizável — não cai no shell com papel desconhecido: cai numa tela segura com
nova tentativa e saída, sem expor corpo interno da API. Papel desconhecido era
precisamente o estado que produzia o 403.

**Destino inicial por papel, síncrono.** Com o ator já resolvido no primeiro
render, `destinoInicialPara` é usado como inicializador de `useState`, não
como efeito: não há destino intermediário, não há correção posterior e,
portanto, não há flash nem requisição da tela errada. O mapa tem **uma
entrada** (`gestor → equipe`) e **não é autorização** — o RBAC decide cada
requisição e a tela reverifica o papel. `rh`, `dp`, `colaborador`,
`master_tecnico` e os demais permanecem em "Cadastros", sem alteração. A ordem
do menu não muda. Quem já navegou nunca é redirecionado, porque não existe
efeito que o faça; trocar de ator remonta o shell (chave por `id`) e recalcula.

**Prova de regressão:** 14 dos 19 testes novos falham na implementação
anterior e passam na corrigida. Os 5 que passam nos dois casos são justamente
os de **preservação** (`rh` e os quatro papéis sem a capacidade) — corretivos e
guardas separados por construção.

**Linha morta removida.** O `seqDetalhe.current += 1` de `fecharDetalhe` era
inobservável: duas rodadas de mutação mostraram que removê-lo não quebrava
nenhum teste, incluindo as sondas de fechar-e-reabrir. A invalidação real mora
em `carregarDetalhe`, que incrementa em toda abertura. Removido em vez de
justificado por teste fabricado — um guarda que não guarda nada cria confiança
falsa.

**Validação visual, em navegador real, contra a API real.** Ambiente local de
demonstração, banco existente reaproveitado — nenhum volume foi destruído ou
recriado. Com `gestor.alfa@evolli.local`: a lista traz **apenas**
`DEMO-A-0201` (Pessoa Demo Alfa Turno A). Estão **ausentes**, conferidos um a
um no DOM: `DEMO-A-0202` (outra equipe), `DEMO-A-0002` (sem equipe),
`DEMO-A-0001` (a pessoa do próprio gestor) e `DEMO-B-0001` (empresa Beta).
Detalhe abre em modal somente leitura; `Escape` fecha e o foco volta ao botão
que abriu. Rede: só `GET /v1/gestor/equipe` e
`GET /v1/gestor/equipe/vinculos/:id`, todas 200, **sem uma única query string**
e **sem uma única mutação**. Sem overflow horizontal da página em 1265 px
(`scrollWidth` 1265 = `clientWidth`) nem em 375 px (375 = 375), com e sem o
modal aberto; a tabela rola por dentro (`scrollWidth` 889 contra 339).

**O papel `rh` foi verificado no ambiente, e confirmou a leitura do contrato.**
Como o RBAC também lhe concede `gestor_equipe`/`read`, ele vê o destino e
recebe 200 — com lista vazia, porque não tem atribuição de equipe. A tela
mostra a explicação que a ADR 0015 exigiu, não "Sem permissão". Negar `rh` na
interface teria sido inventar uma restrição. Já `dp.alfa` vê **nove** destinos:
"Minha equipe" não aparece.

**Defeito próprio encontrado pela validação visual, e corrigido.** Os mapas de
rótulo tinham valores que **não existem** no schema (`efetivo`, `afastado`,
`desligado`), e a tela exibiu o enum cru `clt`. Os enums reais são
`SituacaoVinculo = previsto | ativo | encerrado` e
`TipoVinculo = clt | estagio | pj | temporario | outro_controlado`. Corrigido
contra a fonte, com teste (`T153.24`) que falha se alguém reintroduzir um
valor inventado — inventar rótulo é tão errado quanto exibir o código.

**Observação pré-existente, não tratada:** o shell abre em "Cadastros" para
todo mundo, e um `gestor` recebe 403 em `GET /v1/horarios` logo ao entrar.
É comportamento do shell anterior a esta tarefa; mudar o destino padrão
afetaria todos os papéis e não cabe aqui.

**Fora desta entrega, explicitamente:** banco de horas, espelho de ponto, atestado, diagnóstico,
CID ou qualquer informação de saúde, aprovações, alterações cadastrais, qualquer `POST`, `PATCH`,
`PUT` ou `DELETE`, visão por departamento ou empresa inteira, gestão matricial, exceções
administradas pela interface e ESS.

## Datas no padrão brasileiro — T154 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| T154   | **Integrada** (PR #145, squash `cd80ea9`) | Padroniza a apresentação de datas em `apps/web` para o formato brasileiro, sem tocar transporte nem armazenamento. |

**Escopo, explicitamente.** A T154 é **somente apresentação**, e somente em `apps/web`. Contratos
HTTP, banco e o `value` de `<input type="date">` continuam em ISO (`AAAA-MM-DD`). Nenhuma regra
trabalhista, cálculo, permissão ou migração é tocada.

**A regra vinculante.** Data completa `DD/MM/AAAA`; mês e ano `MM/AAAA`; data e hora
`DD/MM/AAAA às HH:mm` em relógio de **24 horas**; locale `pt-BR`; fuso de negócio
`America/Sao_Paulo` para instantes; ausente exibe `—`; inválido não quebra a tela nem mostra
`Invalid Date`.

**Por que a distinção entre data civil e instante não é cosmética.** `new Date("2026-10-08")` é
lido pela especificação como meia-noite **UTC**. A oeste de Greenwich — onde o Brasil inteiro
está — a mesma data renderizada por `toLocaleDateString` vira **07/10/2026**. Uma admissão, uma
vigência ou a `dataReferencia` que o servidor resolveu deslocam um dia. Isso não é um detalhe de
formatação: é informação funcional errada, na mesma classe do defeito que a T151 corrigiu no
servidor ao trocar `toISOString().slice(0, 10)` por `dataLocalDe` com `FUSO_COMPETENCIA`.

Por isso o utilitário separa os dois casos por **semântica do dado**, não por conveniência:

- **data civil** (`AAAA-MM-DD`, sem hora) — componentes lidos direto da string, sem `Date`;
- **instante** (ISO com hora ou offset) — `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })`,
  porque aqui converter é exatamente o correto;
- **mês de referência** — `MM/AAAA`.

**Um só ponto de formatação.** O `apps/web/src/format/dia.ts`, que já existia e já documentava a
armadilha do fuso, é consolidado e ampliado. `split`, `substring`, `slice` e formatadores próprios
saem das telas: formatação espalhada é como a mesma data chega a aparecer em dois formatos
diferentes em telas vizinhas.

**Guarda de regressão por saída visual.** Um teste recusa ISO cru onde a tela deveria formatar —
sem varredura global ingênua, que bloquearia campo técnico legítimo (`value` de `<input>`,
payload, `key`, `id`), todos os quais **continuam** em ISO por contrato.

**Pendências preservadas.** `DP-3J-12` e `PD-SOL-05` seguem **não iniciados** e sem contrato
seguro. As decisões de negócio e do RH já registradas permanecem abertas, e nada aqui as antecipa.

## Checklists de contratação e desligamento — T155 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                 |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T155   | **Integrada** (PR #147, squash `25ce087`) | Investigação e especificação preliminar do domínio de checklists de contratação e desligamento, mais o mapa funcional de Gestão de Talentos. Documental: nenhum código foi escrito. |

**Ponto de partida confirmado.** Admissão e desligamento já existem como atos de vida funcional:
admissão cria colaborador e vínculo previsto; sua efetivação ativa o vínculo; desligamento efetivado
encerra o vínculo. Não existe domínio, tabela, endpoint, permissão ou tela de checklist operacional.

**Fronteira da investigação.** Checklist é acompanhamento de tarefas do processo, e não condição
automática de validade do vínculo. A T155 não cria, efetiva, bloqueia, cancela ou retifica admissão ou
desligamento; não introduz conteúdo documental, upload, assinatura, folha, eSocial, benefício, saúde,
cálculo trabalhista ou integração externa.

**Gate humano.** Antes de código, RH precisa aprovar templates e itens, responsáveis, prazos,
estados, exceções, evidências permitidas, relação com a efetivação e visibilidade. A decisão será
registrada em documento próprio; enquanto ela faltar, a T155 permanece investigativa e não autoriza
migration, endpoint ou interface.

**Referência de produto registrada.** A navegação somente leitura de uma solução de mercado também
foi consolidada no [mapa funcional de Gestão de Talentos](../docs/decisions/t155-mapa-funcional-gestao-talentos-referencia-mercado.md).
O mapa separa o que foi observado de decisões pendentes e preserva a proibição de copiar código,
marca, interface, textos ou regras privadas. Ele não amplia o escopo implementável da T155.

## Matriz Evolli × referência de mercado — T156 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                                |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T156   | **Integrada** (PR #148, squash `92c5590`) | Matriz de 28 frentes classificadas contra referência de mercado, 13 lacunas com dependências e riscos, e uma única recomendação de próxima fatia funcional. Documental: nenhum código foi escrito. |

**O estado vem do código, não de texto anterior.** A classificação de cada frente foi derivada de
`apps/`, `packages/`, do schema Prisma e das migrations na base `cd80ea9`, e revalidada em
`25ce087` — o intervalo entre as duas bases alterou somente documentação e Spec Kit. Vocabulário:
**funcional**, **parcial**, **demonstrativo** e **planejado**, já vigentes na legenda deste ledger,
mais **bloqueado** para ausência que tem gate registrado.

**Fotografia que a matriz fixa.** 52 telas-folha: **13 ligadas à API**, **33 cascas com fixtures** e
6 contêineres de abas. Os quatro pacotes em `packages/` têm só `README.md`. Sete núcleos puros de
Ponto — apuração, banco de horas, compensação, fechamento, fila, orquestração e parser AFD — existem
testados e **não estão ligados a controller, persistência ou tela**.

**Correção de contagem registrada, não aplicada.** O inventário da T146 anuncia 45 telas-folha e não
inclui a `EquipeScreen` da T153. A fonte única `docs/prototipos/t146/dados.js` precisa convergir;
a T156 **não a corrige** e deixa a dívida registrada.

**Lacuna de governança achada.** Todas as frentes têm identificador de decisão (`DP-`, `BH-`, `PD-`,
`DS-`) — **exceto férias**, que não tem gate nomeado, não está no mapa de capacidades e não tem tela.
A ação imediata ali é de governança, não de engenharia.

**Recomendação única, independente das respostas pendentes do RH.** Interface de **Administração da
Liderança**: ligação conta↔colaborador e atribuição gestor↔equipe, sobre as nove rotas que a T151 já
entregou e que a ADR 0015 já governa. **Exceções de acesso ficam fora** enquanto dependerem do
catálogo de `motivoCodigo` a validar com RH. Hoje configurar um gestor exige HTTP cru ou o seed, e
por isso todo gestor real vê lista vazia — a capacidade das T151/T153 está entregue e inoperante.
A matriz fixa oito critérios mínimos de pronto para essa fatia.

**Referência funcional versionada junto.** `docs/decisions/referencia-funcional-solides-mapa-evolli.md`
sustenta a coluna de comparação e até aqui não estava versionado. Foi auditado antes de entrar: sem
código, captura, dado pessoal, credencial ou conteúdo proprietário copiado; só descrição funcional
própria e links públicos, mesmo padrão das referências de mercado já integradas.

**Limites explícitos:** a T156 não implementa código, UI, API, migration, seed, teste funcional nem
alteração visual; não toca Docker, banco, dependências ou lockfile; não altera ADR, gate ou decisão;
não aprova requisito novo; e **não inicia a T157** — a recomendação é insumo de decisão, e a
implementação depende de autorização própria sob identificador próprio.

## Administração da Liderança — T157 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                                                                        |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T157   | **Integrada** (PR #149, squash `99e3363`) | Interface web de RH para ligação conta↔colaborador e atribuição gestor↔equipe, sobre as rotas administrativas que a T151 já entregou. Torna operável a capacidade que estava inalcançável. |

**O problema que a tarefa resolve.** A T151 entregou as tabelas, o RBAC e as rotas; a T153 entregou
a consulta do gestor. Faltava o elo: **configurar** quem é gestor de qual equipe só era possível por
chamada HTTP crua ou pelo seed de demonstração. Na prática, todo gestor real via lista vazia em
"Minha equipe". A T157 fecha esse elo e não acrescenta capacidade nova.

**Nenhum contrato novo.** As seis rotas usadas já existem e estão cobertas por E2E desde a T151:
`POST`/`GET` e `PATCH …/encerrar` para `ligacoes` e para `atribuicoes`. Nenhum endpoint, campo,
parâmetro de consulta, regra de autorização ou fluxo foi inventado. Backend, Prisma, migrations,
seed, RBAC e contratos HTTP **não foram tocados**.

**Exceções de acesso ficam fora, declaradamente.** As três rotas de `excecoes` existem e continuam
sem interface: o catálogo de `motivoCodigo` depende de validação com RH (ADR 0015, decisão 9), e
oferecer o formulário antes disso seria escolher conteúdo de catálogo por conta própria.

**Paginação: o que o contrato expõe e o que não expõe.** `GET …/ligacoes` e `GET …/atribuicoes`
devolvem **array simples**, sem envelope de paginação — não há página além da primeira, e portanto
nada fica oculto. Já os catálogos de apoio **são paginados** e a tela os consome **até o fim**:
contas por cursor (`nextCursor`), colaboradores e equipes por `pagina`/`tamanhoPagina`. Nenhum
parâmetro foi inventado onde o contrato não o oferece.

**Limites explícitos:** sem gestão matricial, departamento inteiro ou empresa inteira; sem ESS; sem
mutação pelo gestor, que permanece consultivo; sem ponto, férias, folha, saúde ou dado sensível; sem
alteração visual fora das telas desta tarefa, e sem ampliar a fundação congelada na T146.

## Ciclo de vida da estrutura organizacional — T158 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                         |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T158   | **Integrada** (PR #150, squash `3755ae2`) | Expõe na interface as ações de inativar e reativar dos cadastros organizacionais que já têm rota, RBAC e E2E no backend desde as T104–T109. |

**A lacuna que a tarefa fecha.** A T156 registrou que existem rotas de inativação e
reativação para as entidades organizacionais e **nenhuma tela as expõe**. O efeito prático é
que o RH enxerga o filtro de inativos e não tem como colocar nem retirar registro desse
estado — três telas chegam a anunciar em texto que "não é possível excluir, apenas inativar"
sem oferecer o botão.

**Nenhum contrato novo.** As rotas, as capacidades de RBAC e a semântica de estado já
existem. Antes de qualquer código, cada entidade é conferida **na fonte**, uma a uma:
método, caminho, permissão exigida, forma da resposta, tratamento de item já no estado alvo
e eventuais restrições por referência. Semelhança de nome não é presunção de contrato igual.

**Exclusão física continua fora.** Não existe rota `DELETE` no produto, e a interface não
inventa uma. Inativar é transição de estado; o registro permanece.

**Limites explícitos:** sem backend, Prisma, migrations, seed, RBAC, contratos HTTP,
dependências ou lockfile; sem ação em massa; sem alterar regra de negócio. A **paginação
geral das telas existentes (L3) permanece dívida registrada e não é resolvida aqui** — a
tarefa não cria lista nova que a omita, e não inventa parâmetro onde o contrato não o
oferece. Ficam fora exceções de acesso do gestor, ESS, férias, ponto, folha, eSocial e
catálogo de motivos de desligamento. As ressalvas **R-A, R-B e R-C** da T157 seguem abertas
e não são tratadas aqui.

## Navegação modular e funcional — T159 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                    |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| T159   | **Integrada** (PR #151, squash `c849b01`) | Reorganiza a navegação global em módulos coerentes com a capacidade que de fato existe, sem prometer o que não existe. |

**A regra que governa a tarefa.** Menu é promessa: um item na navegação é lido como
capacidade disponível. Hoje 39 superfícies estáticas convivem com as funcionais na mesma
lista, sem distinção — quem navega não tem como saber o que grava e o que é maquete. A T159
separa as duas coisas na arquitetura de informação, **sem** tocar em nenhuma das telas.

**Inventário antes de qualquer menu.** Os destinos são classificados a partir do **código**
— cliente de API real contra `*.fixtures`, permissão exigida e estado. A matriz da T156 é
insumo; onde documento e código divergirem, vale o código, e a divergência fica registrada.

**Evolução visual aprovada em 13/10/2026, depois da primeira prévia.** O proprietário
reviu a navegação já reorganizada e autorizou recompor o shell: barra lateral branca,
estável e espaçosa com a marca própria do Evolli; módulos com ícone SVG **original**,
desenhado no projeto; hierarquia entre módulo, submenu e destino ativo por superfície,
borda indicadora, peso tipográfico e espaço — nunca só por cor; grupo **Demonstração** ao
pé da barra, visualmente secundário e com o aviso em texto; cabeçalho claro com **apenas
as ações que existem** (contexto do ator, Segurança quando o servidor informa MFA, Sessões
ativas e Sair); e, no mobile, **gaveta** com foco preso, `Escape` e botão de abertura
sempre alcançável. A decisão e seus limites estão em
[`docs/decisions/t159-direcao-visual-navegacao.md`](../docs/decisions/t159-direcao-visual-navegacao.md).

**A referência de mercado entra só como princípio.** Arquitetura de informação e composição
visual observadas, sim; marca, logotipo, texto, foto, ilustração, ícone proprietário, paleta
exata, código ou layout pixel a pixel, **nunca**. A identidade, os tokens, os componentes, o
padrão B e os modais continuam sendo do Evolli.

**A tela de login não faz parte desta tarefa.** Será fatia própria: painel institucional
original mais autenticação, sem CPF, captcha, cadastro, registro de ponto ou recuperação de
senha enquanto não houver contrato funcional para cada um.

**Limites explícitos:** sem alterar escopo funcional, regra de negócio, RBAC, rotas, API,
backend, Prisma, migrations, seed, Docker, dependências ou lockfile. Telas internas só mudam
no estritamente necessário para preservar roteamento, título, foco ou navegação. A entrada
direta do gestor em "Minha equipe" é preservada e não pode disparar rota proibida nem 403 na
inicialização — conferido no navegador: o gestor aterrissa em `Minha equipe`, e a única
chamada da aterrissagem é `GET /v1/gestor/equipe` → 200. A dívida **L3** não é iniciada nem
declarada resolvida, e seguem abertas **S-1 a S-4** (T158), **R-A, R-B e R-C** (T157) e o
registro `teste michell`.

## Login institucional — T160 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                                 |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| T160   | **Integrada** (PR #152, squash `0db3d70`) | Renova a tela e o fluxo visual de login com uma experiência institucional própria do Evolli, sem tocar no contrato de autenticação. |

**A CI de `main` ficou 2/3 neste squash.** Quality gates e Migration smoke
verdes; E2E vermelho em **1 de 481** testes, no cenário de concorrência do
gestor — defeito pré-existente da T157, em nada causado pela T160, cujo diff
não toca um único arquivo de backend. Tratado pela T161.

**O que muda.** Só a composição visual da porta de entrada: cartão central,
fundo abstrato **original**, marca Evolli e layout moderno, responsivo e
acessível. A referência de mercado entra como **princípio de composição**;
marca, texto, ilustração, paleta exata, asset, ícone e layout pixel a pixel de
terceiros, nunca — mesma regra registrada na
[decisão visual da T159](../docs/decisions/t159-direcao-visual-navegacao.md).

**O que NÃO muda.** O contrato de autenticação por e-mail e senha, a segunda
etapa de MFA já existente, o comportamento de sessão e o redirecionamento
depois do login. Nada de CPF, CAPTCHA, "lembrar-me", cadastro, recuperação de
senha ou registro de ponto: nenhum desses tem contrato funcional, e oferecê-los
seria a promessa vazia que a T159 passou a tarefa inteira eliminando.

**Acessibilidade obrigatória:** teclado, foco visível, mensagens de erro
acessíveis, contraste, leitor de tela, `prefers-reduced-motion` e ausência de
rolagem horizontal em 375 px. Um `h1` por tela.

**Contrato de movimento da porta de entrada.** A tela tem uma entrada curta — a
marca, a frase e o aviso sobem alguns pixels, e as seis formas do fundo abstrato
entram escalonadas, dando profundidade. Cinco regras, fixadas em teste:

1. **uma execução por carga**, nunca laço — movimento perpétuo acima de cinco
   segundos cairia na WCAG 2.2.2 e exigiria controle de pausa;
2. **tudo atrás de `prefers-reduced-motion: no-preference`**; fora desse bloco
   não há `animation` nem `transform`, de modo que quem pede menos movimento vê
   o painel já no estado final;
3. **nenhum `opacity`, `visibility` ou `translateX`** em regra alguma. Medido no
   navegador: com `opacity: 0` no quadro inicial e `fill-mode: both`, uma
   animação que não avança prende o conteúdo em transparente — a marca some.
   Animando só o deslocamento vertical, o pior caso é alguns pixels de
   diferença em decoração;
4. **sem partícula, brilho pulsante, paralaxe de ponteiro ou reação a scroll**;
5. **sem gradiente, imagem externa, `@import` ou fonte de terceiro** — o fundo é
   SVG embutido, composto só de círculo, retângulo e caminho desenhados aqui.

**Limites:** sem alterar API, Prisma, migrations, seed, Docker, banco,
dependências ou lockfile. Se aparecer necessidade fora disso, a tarefa para e
reporta.

**Hub pós-login (T162): decisão registrada, implementação não autorizada.** Em
[`docs/decisions/t162-hub-pos-login.md`](../docs/decisions/t162-hub-pos-login.md):
empresa ativa e troca de empresa só com validação e autorização do servidor;
subsistemas exibidos conforme permissão real; produto funcional separado de
planejado e demonstrativo. Nada do Hub é implementado agora, e nenhuma
funcionalidade é reservada sem contrato.

**Dívidas preservadas, nenhuma tratada aqui:** **T1, T2 e T3** da revisão final
da T159 (precisão documental e de teste), **L3** (paginação), **S-1 a S-4**
(T158), **R-A, R-B e R-C** (T157) e o registro `teste michell`.

## Concorrência do gestor: diagnóstico antes de correção — T161 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                                 |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| T161   | **Integrada** (PR #153, squash `07cdfca`) | Preserva a regra de conflito que já funciona e faz o erro que escapa dela se identificar no log, sem mascarar nada. |

**O que aconteceu.** No squash `0db3d70`, duas criações simultâneas de gestor
principal devolveram **um 201 e nenhum 409**. O log do runner trazia apenas
`errorName: "PrismaClientUnknownRequestError"` e `statusCode: 500`.

**O que a investigação descartou**, com PostgreSQL real e efêmero:

| Hipótese                                  | Medição                                               | Resultado        |
| ----------------------------------------- | ----------------------------------------------------- | ---------------- |
| Mapeamento de sobreposição ausente        | 23P01, 23505, P2002 e 23514 já viram 409 desde a T157 | **não procede**  |
| Expiração da transação por espera de lock | 9 s de contenção forçada pelo caminho real da API     | devolveu **409** |

**A causa raiz foi encontrada ainda nesta tarefa, pelo próprio diagnóstico
acrescentado:** o perdedor da corrida morre em **deadlock — SQLSTATE
`40P01`**, que chega como `PrismaClientUnknownRequestError` e portanto não é
reconhecido como conflito.

Reproduzido localmente com o cenário repetido: **2 falhas em 8 execuções** do
arquivo, e `40P01` aparece **exatamente** nas duas que falharam, em nenhuma
das seis verdes.

Uma medição intermediária quase descartou a causa certa e vale registro:
deadlock chega como `PrismaClientKnownRequestError` (P2010) **apenas no
caminho de consulta crua**. Pelo caminho tipado, que é o que o service usa,
chega como `Unknown`.

**O que fazer com o `40P01` é decisão de produto, e esta tarefa não a tem.**
Mapeá-lo para 409 é defensável — na disputa por esta invariante, o perdedor é
exatamente quem perdeu a corrida — e é também exatamente o que a decisão
vigente proíbe sem autorização nova. Fica aberto.

**A decisão do proprietário, registrada:** **nenhum SQLSTATE novo vira 409 sem
prova direta.** P2028, P2034, 40P01 e 23000 continuam **500**. Chamar lentidão
ou defeito de "já existe atribuição vigente" seria trocar um problema real por
uma resposta tranquilizadora — o oposto do que o repositório exige.

**O que a tarefa entrega**, então:

1. a regra de conflito **preservada**, extraída para função pura e exercitada
   diretamente;
2. **diagnóstico seguro** no `AllExceptionsFilter` — classe, código do Prisma,
   SQLSTATE e identificador de constraint/trigger. Mora ali, e não nos
   services, porque o E2E roda com `LOG_LEVEL=silent`: o `PinoLogger` não
   escreveria nada justamente na CI;
3. **E2E com diagnóstico**: o cenário concorrente repetido, e um conflito com
   contenção forçada. Quando falham, a mensagem traz status e corpo das duas
   respostas — antes dizia apenas "esperava 1, recebeu 0". O cenário repetido
   **reproduz o defeito fora da CI**, o que o cenário de uma rodada nunca
   fazia.

**Desfecho.** A decisão sobre o `40P01` veio: repetição **limitada a uma**,
só em `criarAtribuicao`, só com o SQLSTATE confirmado, e **sem** traduzir
`40P01` em 409 — na segunda tentativa o vencedor já commitou e o conflito volta
pela EXCLUSION, que o classificador já mapeava. A bateria que reprovava 2 em 8
passou 8 em 8, e a **CI de push em `main` ficou 3/3 verde** no squash
`07cdfca`.

**Ressalva aberta (S2):** o confinamento da repetição a `criarAtribuicao` é
garantido por inspeção — 6 `$transaction` no service, 1 envolvido —, **sem
teste próprio**. Nada impede que uma operação futura seja envolvida por
engano.

**Nunca sai no log:** mensagem do banco, `DETAIL` (que carrega os valores
enviados), parâmetros, conteúdo da requisição ou stack. A resposta HTTP não
muda: segue sem citar Prisma, PostgreSQL ou SQLSTATE.

**Planejados, não iniciados:** o **Hub pós-login (T162)** segue só como decisão
em
[`docs/decisions/t162-hub-pos-login.md`](../docs/decisions/t162-hub-pos-login.md)
— sem branch, sem PR e sem código;
**RH/DP** e **Gestão de Pessoas** seguem apenas planejados. Nenhum deles tem
implementação nesta tarefa.

**Dívidas preservadas:** **R1, R2 e R3** da revisão da T160, **L3**, **S-1 a
S-4** (T158), **R-A, R-B e R-C** (T157) e o registro `teste michell`.

## Hub pós-login — T162 (integrada)

| Tarefa | Estado                                     | Resultado principal                                                                                 |
| ------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| T162   | **Integrada** (PR #154, squash `61e5f900`) | Depois do login, a pessoa entra no Hub — que mostra só o que o servidor autoriza no contexto atual. |

**A regra é a da T159, um nível acima.** Menu é promessa, e cartão de produto
também. O Hub só oferece o que o papel do ator de fato consegue abrir, com
capacidade derivada do `rbac.evaluator` — nunca de lista escrita à mão — e com
produto funcional separado de superfície demonstrativa.

**Contratos levantados na fonte, antes de qualquer interface:**

| Pergunta                    | Contrato                                                                |
| --------------------------- | ----------------------------------------------------------------------- |
| Ator, papel e empresa atual | `GET /v1/users/me` → `id`, `email`, `role`, `companyId`, `mfaAvailable` |
| Empresas acessíveis         | `GET /v1/empresas`, sob `empresa:read` — escopo resolvido no servidor   |
| **Troca de empresa/escopo** | **não existe**                                                          |

**O bloqueio, declarado:** a empresa do ator é `access_user.companyId`, uma
coluna da conta, lida na sessão. Não há rota que troque o escopo, e o
controlador de autenticação tem apenas login, logout, CSRF, sessões e
redefinição de senha. Portanto a empresa aparece como **contexto não
editável** — sem seletor clicável, sem empresa fictícia, sem simulação de
troca. Implementar troca exigiria contrato de servidor que não existe.

**Segunda consequência de contrato:** `empresa:read` é concedido a `rh`, `dp`
e `master_tecnico`. Para `gestor` e `colaborador` **não há como ler o nome da
empresa** — e o Hub não inventa um.

**Limites:** sem alterar login, RBAC, schema, migrations, seed, Docker, banco,
dependências ou lockfile. O frontend não é autorização: cada requisição segue
decidida pelo servidor.

**Desfecho.** Entrou com a CI de push 3/3 verde no squash `61e5f900`. A
revisão adversarial confirmou, contra a API real e com as contas sintéticas:
`rh` vê seis produtos e o nome da própria empresa; `dp` vê três — **sem
Estrutura**, porque `tabela_horario` é exclusivo de RH; `gestor` vê um produto
e **nenhuma** requisição a `/v1/empresas`; `colaborador` vê o aviso de perfil
sem produto. **Zero 403 em toda a sessão.**

**Duas ressalvas ficaram abertas na entrega da T162. Uma delas já foi
resolvida pela T163; a outra continua aberta.**

- **R-2 — RESOLVIDA pela T163.** O que foi encontrado: o Hub lia
  `GET /v1/empresas` a cada montagem, inclusive a cada retorno pelo botão
  "Hub", e `EmpresaService.listar` chama `registrarConsultaAmpla` — um
  registro de auditoria por visita. Era leitura legítima do próprio escopo,
  não vazamento, mas ruído novo na trilha, proporcional à navegação.

  Como foi resolvida, e a evidência de cada parte:

  | O que mudou                                                   | Evidência                                                                            |
  | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
  | O Hub **não chama mais** `/v1/empresas` ao montar             | `HubPosLogin.tsx` não importa `organizacaoClient`                                    |
  | A **empresa ativa** (nome e código) vem de `GET /v1/users/me` | campo `empresaAtiva`, leitura direta por id, sem consulta ampla                      |
  | **Teste-guarda** contra reincidência                          | varre o próprio módulo e reprova se `organizacaoClient` ou `listarEmpresas` voltarem |
  | Medição no navegador                                          | **zero** chamadas a `/v1/empresas` em toda a sessão                                  |

- **R-3 — CONTINUA ABERTA.** `dp` dentro de Jornada ainda pode esbarrar em
  `tabela_horario` por interação. O mount está limpo (medido: 13 requisições,
  todas 200), mas `buscarTabelaHorario` é alcançável dentro da tela. **Não foi
  introduzida pela T162**: o destino `ponto` já era incondicional na barra
  lateral desde a T159. A T163 **não** a tratou.

**Uma divergência registrada em vez de escondida:** a mensagem do squash em
`main` diz "1530 no web, 38 novos"; a contagem correta é **37** (28 + 7 + 2),
e é o que a descrição da PR #154 diz. A mensagem publicada não foi reescrita
por decisão do proprietário.

**Dívidas preservadas:** **S2** (T161), **R1, R2 e R3** (T160), **L3**, **S-1 a
S-4** (T158), **R-A a R-C** (T157) e o registro `teste michell`.

## Contexto empresarial ativo e troca segura — T163 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                    |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| T163   | **Integrada** (PR #155, squash `0da0950`) | A empresa de trabalho passa a ser contexto de sessão resolvido e auditado no servidor. |

**O que a T162 deixou explicitamente em aberto.** O Hub entrou sem troca de
empresa porque **não havia contrato**: a empresa era `access_user.companyId`,
coluna fixa da conta, e o controlador de autenticação só tinha login, logout,
CSRF, sessões e redefinição de senha. A T163 cria o contrato que faltava.

**A regra de negócio aprovada:**

| Quem                        | Pode                                                            |
| --------------------------- | --------------------------------------------------------------- |
| `rh` e `master_tecnico`     | escolher empresa **somente** entre as autorizadas pelo servidor |
| gestor, colaborador, demais | ficam na empresa do próprio vínculo — **não listam nem trocam** |

**Os princípios que a implementação tem de honrar:**

- a associação usuário–empresa é **de servidor e auditável**;
- a empresa ativa vive na **sessão**, nunca em `localStorage`, `sessionStorage`,
  query string, cookie escrito pelo frontend ou parâmetro livre de rota;
- `companyId` vindo do cliente **nunca amplia escopo**;
- toda leitura e toda mutação usam o contexto ativo, resolvido centralmente;
- troca valida autorização, atualiza a sessão e **produz evento de auditoria**;
- empresa não autorizada, inexistente ou revogada segue o padrão
  **anti-enumeração** já usado pelo produto;
- login novo começa em contexto seguro e previsível, e **sessões simultâneas
  mantêm contextos independentes**;
- empresas autorizadas **não são expostas** a perfil sem poder de seleção.

**Parada obrigatória:** se o contexto não puder ser aplicado centralmente sem
deixar rota funcional fora da proteção, a tarefa **para e reporta** antes de
publicar. Nada de seletor ou endpoint fingido.

**Limites:** sem novos módulos de RH/DP, sem cartão fictício, sem portal do
colaborador, sem transformar Demonstração em produto. A tela de login só muda
no estritamente necessário ao contrato de sessão.

**R-2 da T162: resolvida por esta tarefa**, com a evidência registrada na
seção da T162 — o Hub deixou de ler `/v1/empresas` ao montar, a empresa ativa
passou a vir de `/v1/users/me`, há teste-guarda contra o retorno de
`organizacaoClient` e a medição de navegador contou **zero** chamadas à rota.

**Dívidas preservadas, nenhuma tratada aqui:** **R-3** (T162, `dp`/Jornada e
tabela de horário), **S2** (T161, confinamento da repetição pós-deadlock sem
teste próprio), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C**
(T157) e o registro `teste michell`.

**Desfecho.** Entrou com a CI de push 3/3 verde no squash `0da0950`. A revisão
adversarial confirmou, contra a fonte: os **7** resolvedores de leitura ficaram
sob `atorOperaEmEscopoGlobal`, os de **mutação** continuam recusando quem não é
`rh`/`dp`, e nenhum serviço de domínio lê `contaEmpresaId` — logo toda leitura e
toda mutação operam na empresa ativa.

## Colaboradores: primeira fatia operacional — T164 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                              |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| T164   | **Integrada** (PR #156, squash `9df4756`) | A primeira tela de Colaboradores que é produto, e não maquete — e é só consulta. |

**A fatia é exclusivamente de consulta operacional.** Ficam **fora de escopo**,
por decisão do proprietário: novo colaborador, cadastro, edição, exclusão,
admissão, desligamento, importação em massa, exportação, solicitação de
preenchimento, link de preenchimento, autopreenchimento pelo funcionário e
banco de horas na tabela — este último é capacidade de **DP** e depende de
contrato próprio. O **próximo** ciclo é o cadastro, preenchido exclusivamente
pelo RH; o funcionário não preenche dado cadastral nesta etapa.

**O que a tela entrega:** título com a empresa ativa, o **total devolvido pelo
servidor**, os filtros de situação do colaborador e situação do vínculo, tabela
com **Nome, Situação e data de cadastro** em padrão brasileiro, paginação real
e os estados de carregamento, vazio, erro e nova tentativa. Trocar de empresa
no Hub recarrega a tela **sem dado residual**.

### Quatro limitações de contrato, respeitadas em vez de contornadas

Levantadas na fonte antes de desenhar a tela:

| Limitação                                                                                | Consequência na tela                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /v1/colaboradores` **não tem busca** por nome ou matrícula                          | sem caixa de busca                                                  |
| **Não há contagem agregada** por situação — só o `total` do conjunto já filtrado         | sem contadores por faixa                                            |
| A projeção da lista traz **só** `id`, `nome`, `situacao`, `criadoEm`, `atualizadoEm`     | só as colunas que existem                                           |
| Matrícula, cargo, departamento e admissão vivem no **vínculo**, a uma chamada por pessoa | não entram: **N+1 é proibido**, e coluna vazia seria promessa falsa |

A regra é a mesma da T159 e da T162: **controle aparente é promessa**. Desenhar
busca que não filtra, ou contador que não conta, seria pior que não ter. Se
algum desses campos for necessário depois, exigirá **projeção própria no
servidor** — outra tarefa, com contrato próprio.

**Referência visual:** usada apenas como princípio de clareza de tabela e
hierarquia de ações. Sem copiar marca, texto, paleta, layout ou componente de
terceiro.

**Dívidas preservadas:** **R-3** (T162), **S2** (T161), **R1 a R3** (T160),
**L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157) e o registro `teste michell`.

**Desfecho.** Entrou com a CI 3/3 verde no squash `9df4756`, confirmada também
por um disparo manual do workflow sobre `main`. A revisão adversarial levantou
três ressalvas; **R-1 e R-2 foram corrigidas em commit próprio**, com doze
testes que reprovam sem a correção e três mutações verificadas uma a uma:

- **R-1** — a contagem de páginas usava a constante local em vez do
  `tamanhoPagina` da resposta. Corrigida, com recusa de valor inválido de volta
  ao tamanho pedido — sem `NaN`, `Infinity` nem paginação falsa.
- **R-2** — a navegação vivia dentro do ramo que o carregamento substitui, e
  paginar derrubava o foco para o `body`. Corrigida mantendo a navegação
  montada, com `aria-busy`, anúncio de carregamento e `aria-disabled` no lugar
  de `disabled` — um botão desabilitado de verdade perde o foco, que era o
  defeito por outro caminho.
- **R-3 — ABERTA, não bloqueante.** A paginação de múltiplas páginas está
  comprovada por **teste**, não por observação no navegador: o banco de
  demonstração tem 9 registros na Alfa e 1 na Beta, nunca mais de 20, então a
  troca de página não chega a aparecer na prévia.

## Cadastro de colaborador pelo RH — T165 (integrada)

| Tarefa | Estado                                                                                    | Resultado principal                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| T165   | **Integrada** (PR #157, squash `9db194e`): parada por regra declarada, decisão registrada | O contrato não permite cadastro sem admissão. Diagnóstico entregue, decisão do proprietário registrada, interface não escrita. |

**Quem cadastra:** somente `rh` e `master_tecnico`. O funcionário **não**
preenche, **não** recebe link e **não** participa de autopreenchimento — a
decisão do proprietário é explícita, e esta tarefa não abre exceção.

**Fora de escopo:** importação, exportação, admissão, desligamento, banco de
horas e edição.

**O formulário usa apenas o que o servidor oferece.** Nenhum campo, opção ou
regra nasce de suposição: cada entrada precisa de contrato, e cada lista de
opções precisa de rota que o `rh` realmente possa ler.

**A empresa ativa é contexto, e é respeitada.** Aparece na tela, e a criação
acontece dentro dela — sem permitir que o corpo da requisição aponte para
outra empresa. O servidor já recusa isso; a interface não tenta contorná-lo.

### A regra de parada foi acionada

O inventário na fonte encontrou **quatro bloqueios independentes**, cada um
suficiente por si. Nenhuma linha de interface foi escrita. O diagnóstico
completo, com evidência e as cinco propostas originais, está em
[`docs/decisions/t165-cadastro-colaborador-rh-bloqueio.md`](../docs/decisions/t165-cadastro-colaborador-rh-bloqueio.md).

| #      | Bloqueio                                                                                                                                                                            | Evidência                                                                                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** | **Não existe criação sem admissão.** A única rota é `POST /v1/colaboradores` com `AdmitirColaboradorDto`, e quatro dos seis campos obrigatórios são de admissão — que a T165 exclui | `pessoas.dto.ts:123`; o porquê está no próprio DTO: `Colaborador` não tem `empresa_id`, então cadastro sem vínculo ficaria fora de todo escopo de autorização |
| **B2** | **O papel aprovado não bate com o RBAC.** A direção diz `rh` + `master_tecnico`; o contrato diz `rh` + `dp`, negando `master_tecnico` em duas camadas                               | `rbac.evaluator.ts` (só `read`) e `escopo-pessoas.util.ts` (`ForbiddenException`), por decisão registrada na T030                                             |
| **B3** | **Não há dado cadastral para cadastrar.** O modelo guarda `nome`, `situacao` e carimbos — sem CPF, nascimento, contato ou endereço                                                  | `schema.prisma`, `model Colaborador`                                                                                                                          |
| **B4** | **A "primeira fatia" já existe.** O formulário de Novo colaborador já coleta, valida, envia, confirma, trata erro e recarrega a lista                                               | `ColaboradoresScreen.tsx`, com **sete** testes dedicados                                                                                                      |

Honrar a tarefa ao pé da letra exigiria criar endpoint, migration, campo e
regra de RBAC — exatamente o que a regra proíbe. É a mesma disciplina que a
T162 seguiu ao declarar a ausência de contrato de troca de empresa em vez de
desenhar um seletor falso.

**Um achado foi levantado e refutado**, registrado para não voltar: a suspeita
de que o formulário permitiria escolher empresa diferente da ativa. Medido no
navegador com conta autorizada em duas empresas, `GET /v1/empresas` devolve
`total: 1` — só a ativa —, então o seletor nunca aparece. A T163 já havia
fechado esse buraco.

### A decisão do proprietário, registrada

Veio em resposta ao diagnóstico, e **não autoriza implementação** — fixa o rumo
para que a próxima tarefa não precise supor.

**O fluxo passa a se chamar "Admitir colaborador".** Criação, primeiro vínculo
e empresa ativa são **atômicos**; "cadastro" prometia uma etapa separada que o
modelo nunca teve. O **B1 vira premissa**, não bloqueio.

**Quem admite:** `rh` e `dp`. O `master_tecnico` **não** cria, edita ou admite
pessoas; o funcionário **não** recebe link nem autopreenchimento. Isso
**resolve o B2 a favor do contrato que já existe** — nenhuma mudança de RBAC é
necessária, porque `rh` + `dp` é exatamente o que o avaliador concede hoje.

**O formulário será progressivo**, em cinco blocos: admissão e vínculo; dados
pessoais e contatos; organização; documentos e dados bancários; dependentes e
complementos. **Só o primeiro tem contrato hoje.**

**A empresa vem da sessão ativa**, como contexto **não editável**, e não pode
ser forjada no corpo — que é o que o servidor já garante.

**Dado pessoal exige contrato próprio antes de existir.** CPF, documentos,
dados bancários, raça/etnia, deficiência, gênero, foto e dependentes só entram
depois de **finalidade, acesso restrito, auditoria, retenção e contrato**
declarados. Isso converte o **B3** de bloqueio em **sequência**: os campos
faltam porque ainda não foram decididos.

**As imagens de referência** servem só como inspiração de agrupamento e
clareza — sem marca, texto, identidade visual, layout, paleta, ícone ou
componente copiados.

**A ordem aprovada:**

|       | Etapa                                                   | Natureza                                                         |
| ----- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| **A** | Integrar a decisão documental da T165                   | **cumprida**: integrada em `main` pela PR #157, squash `9db194e` |
| **B** | **T166** — ADR de modelo, finalidade e acesso aos dados | decisão — **aberta**, na seção seguinte                          |
| **C** | Contrato, API e migrations                              | servidor                                                         |
| **D** | Admissão mínima                                         | primeira tela real                                               |
| **E** | Expansão progressiva dos blocos                         | iterativo                                                        |

As letras **A a E** são exclusivas desta sequência; a lista histórica do
diagnóstico usa numeração **1 a 5** (Propostas originais). A etapa A **foi
cumprida** com o merge da PR #157, squash
`9db194e6ee5fa25f82017557a8d77be3b6048d58`, com a CI de push 3/3 verde. Até
esse merge, nenhuma implementação da T166 havia começado; ela abre na seção
seguinte.

Nenhuma tela é desenhada antes do contrato que a sustenta, e nenhum dado
pessoal nasce antes da ADR que declara sua finalidade — a mesma disciplina que
fez esta tarefa parar. O **B4 continua válido**: o formulário atual é o ponto
de partida da etapa D, não algo a refazer.

**Dívidas preservadas:** **R-3** (T162), **R-3 da revisão da T164**, **S2**
(T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157)
e o registro `teste michell`.

## Modelo e governança dos dados de admissão e perfil do colaborador — T166 (integrada)

| Tarefa | Estado                                                                               | Resultado principal                                                                                                |
| ------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| T166   | **Integrada** (PR #158, squash `0c00afd`); a ADR 0016 foi **aprovada** em 2026-10-16 | ADR 0016 e diagnóstico técnico do modelo, da finalidade e do acesso aos dados de admissão e perfil do colaborador. |

**É a etapa B da ordem aprovada na T165.** Branch
`codex/t166-adr-dados-colaborador`, a partir do squash
`9db194e6ee5fa25f82017557a8d77be3b6048d58` (T165, PR #157).

**Natureza: ADR e diagnóstico técnico.** Nenhuma interface, API, endpoint,
migration, schema, seed, banco ou alteração de RBAC. O cadastro visual
**não** começa aqui.

**O que a ADR precisa fixar:**

- o **modelo-alvo separado por responsabilidade**: colaborador; vínculo e
  admissão; contatos e endereço; organização; documentos; dados bancários;
  dependentes; anexos e foto, se forem aprovados;
- a **matriz de cada campo** pedido nas referências: bloco, finalidade de
  negócio, perfil que lê e que altera, se é obrigatório para admissão,
  complementar, condicional ou fora de escopo, e de que catálogo, contrato,
  decisão de retenção ou regra adicional depende;
- a **governança**: `rh` e `dp` admitem; `master_tecnico` não cria, edita
  nem admite; a empresa vem exclusivamente da sessão ativa; o funcionário não
  preenche dado nesta fase; dado pessoal sensível, documento, foto e dado
  bancário exigem propósito explícito, acesso restrito, auditoria, retenção e
  contrato próprio;
- o **UX futuro**: admissão progressiva por blocos, contexto de empresa
  travado, campos condicionais, validação acessível, revisão antes de admitir,
  alerta de saída com dado não salvo, e nenhuma seção vazia nem campo sem
  persistência;
- o **plano técnico posterior**, sem iniciá-lo.

**Nada de base legal ou prazo de retenção por suposição.** Onde depender de
decisão jurídica ou do proprietário, a ADR registra **decisão pendente** em
vez de afirmar.

**As imagens de referência** servem só para agrupamento e clareza — sem
identidade, texto, marca, ícone, paleta, layout ou componente de terceiros.

### O que a T166 entregou

A [ADR 0016](../docs/adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md) e o
[diagnóstico técnico](../docs/decisions/t166-dados-admissao-perfil-diagnostico.md). A ADR está **proposta**: aguarda a aprovação
do proprietário (`DP-ADM-01`) e não autoriza implementação. **Atualização
(2026-10-16): a ADR foi aprovada pelo proprietário (`DP-ADM-01`), sem fechar
`DP-ADM-02` a `DP-ADM-18` nem dispensar a ficha de tratamento por categoria.**

- **Modelo-alvo.** `Colaborador` continua mínimo. Todo dado pessoal novo mora
  em agregado próprio — perfil pessoal, contatos e endereço, identificação
  documental, dados bancários, declarações sensíveis, dependentes —, com
  `empresa_id` próprio vindo da sessão, recurso de autorização e rota
  próprios, e fora da listagem e da projeção do gestor. O número do documento
  e o arquivo do documento são agregados diferentes. Horário e jornada é agregado próprio, ligado ao vínculo por orientação do proprietário — o que reabre decisões do RH (`DP-3J-19`, T037) e por isso é `DP-ADM-17`; hoje `vinculo_horario` aponta para o colaborador, e só o `rh` opera Horários.
- **Classes de acesso.** A1 funcional (a que existe), A2 pessoal e A3
  restrito, com leitura auditada bloqueante. O `master_tecnico` fora de A2 e A3
  é proposta, não fato.
- **Matriz de campos.** Cada campo da referência tem bloco, agregado,
  finalidade, acesso, classe e dependência, inclusive retenção. "Admissão"
  quer dizer exigido pelo contrato do Evolli, nunca por lei. Campo sem
  finalidade e sem módulo consumidor fica fora de escopo; o que ainda depende
  de uma decisão anterior à ficha — finalidade, consumidor, semântica ou
  caminho técnico — fica **bloqueado**: nome social, gênero, raça/etnia,
  deficiência, foto, dados bancários, dependentes, filial, estrangeiro, tipo
  de contrato e os campos de modalidade contratual. Nenhuma regra trabalhista é inferida: experiência e contrato
  por prazo ficam fora, e "tipo de contrato" não é presumido igual a tipo de
  vínculo.
- **Governança.** Uma categoria só existe depois de uma **ficha de tratamento**
  aprovada. Nenhuma base legal nem prazo de retenção foi afirmado.
- **UX futuro.** Admitir envia só o bloco 1, de forma atômica, já com a
  lotação completa — completá-la depois criaria movimentação fictícia no
  histórico. O bloco 3 é de leitura; os blocos 2, 4 e 5 complementam depois,
  cada um com seu salvamento.
- **Pendências.** Dezoito decisões (`DP-ADM-01` a `DP-ADM-18`), cada uma com
  responsável; finalidade, base legal, classificação e retenção são de RH +
  Jurídico.
- **Plano técnico.** Etapas C, D e E, nenhuma iniciada.

**Achados registrados, nenhum corrigido aqui** (diagnóstico, §3): a empresa não
aparece no formulário quando só há uma (D1); o "Cancelar" descarta sem
confirmar (D2); o servidor aceita qualquer motivo na admissão (D3); o erro não
diz qual campo falhou (D4); a Spec ainda diz que o gestor inicia admissão
(D5); o conflito de MFA para dado bancário (D6); a leitura do `master_tecnico`
com empresa ativa sem evento (D7); uma possível falta de caminho para corrigir
a admissão, ainda não reproduzida (D8); o Plan desatualizado sobre `DP-23`
(D9); e a classificação legal de gênero e deficiência (D10).

**Correção à T165.** A Proposta original 4 afirmou que a recusa de mutação ao
`master_tecnico` não tinha teste. O avaliador
(`rbac.evaluator.master-tecnico.spec.ts:73-86`) e um E2E
(`documentos.e2e-spec.ts:1022-1034`) já a cobrem; falta só o teste unitário de
`resolverEscopoPessoas`. A T165 também afirmou que gênero e deficiência são
dado sensível "na LGPD", o que a lista do art. 5º, II não diz literalmente.
Três notas aditivas no documento da T165 — na Proposta original 4, na §5.2 e na §5.5 —, texto original preservado.

**Dívidas preservadas:** **R-3** (T162), **R-3 da revisão da T164**, **S2** (T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157) e o registro `teste michell`.

## Admissão mínima segura — T167 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                  |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| T167   | **Integrada** (PR #159, squash `dcef627`) | Contrato existente de admissão estabilizado antes de expandir qualquer dado pessoal. |

**A T166 foi integrada** em `main` pela PR #158, squash
`0c00afdc479193506e80eff0150dc4ddb785a41f`, com a CI de push 3/3 verde. **A
ADR 0016 continuava proposta** — integrar o documento não aprovava o seu
conteúdo —; **o proprietário a aprovou em 2026-10-16 (`DP-ADM-01`)**.

**A T167 trabalha só sobre o contrato que já existe.** Branch
`codex/t167-admissao-minima-segura`. Escopo autorizado pelo proprietário:
admissão atômica preservada; `motivoCodigo` restrito aos motivos válidos para
admissão; resposta de sucesso que confirma colaborador e vínculo sem dado
pessoal novo; formulário com erro por campo, foco no primeiro erro, dados
preservados em falha recuperável, sucesso que confirma e leva a rota coerente,
e aviso antes de descartar; testes de API, E2E e web, com negação explícita a
`master_tecnico`, `gestor` e `colaborador`.

**Regras preservadas:** só `rh` e `dp` admitem; `master_tecnico` não cria, não
edita e não admite; o colaborador não recebe convite, link nem
autopreenchimento; a empresa vem só da sessão ativa; admissão em empresa
divergente do contexto ativo é recusada.

**Fora de escopo:** qualquer campo novo de perfil; schema, migration, seed e
novos agregados; portal do colaborador; RBAC além da admissão atual.

**Regra de parada:** o que o contrato atual não permitir sem inventar regra de
negócio para, com evidência, e espera decisão.

### O que a T167 entregou

- **Motivo da admissão.** `POST /v1/colaboradores` aceita só
  `admissao_inicial` e `outro_controlado`. Os cinco motivos que pressupõem um
  vínculo existente recebem 400 — a admissão sempre cria o primeiro vínculo.
- **Resposta que confirma.** O colaborador continua no topo; entram `vinculo`
  e `movimentacao`, em projeção fechada, só com dado já aprovado e
  identificadores. A lotação é o destino da movimentação: a alocação só nasce
  na efetivação (ADR 0007), e a resposta não finge o contrário.
- **Empresa só da sessão.** O seletor de empresa saiu do formulário. A empresa
  aparece em leitura, e o formulário não envia se o servidor não devolver
  exatamente uma.
- **Formulário.** Recusa do servidor vira erro no campo certo (409 →
  matrícula; 422 → referência organizacional; 404 → empresa ativa mudou), o
  foco vai ao primeiro erro, os dados ficam em falha recuperável, o sucesso
  confirma com o que o servidor gravou e oferece abrir a ficha, e "Cancelar"
  pede confirmação antes de descartar.
- **Testes.** Unitários da API para as duas camadas de autorização e para os
  motivos; E2E com negação explícita a `master_tecnico` (global e com empresa
  ativa), `gestor` e `colaborador`; testes web da tela e do `Modal`.

**Achados da T166 tratados:** D1, D2, D3 e o teste unitário de
`resolverEscopoPessoas`. D4 foi mitigado no cliente; o servidor segue sem erro
por campo (`DP-ADM-15`).

**Decisão pendente do proprietário:** se `outro_controlado` vale para
admissão. Ficou aceito, como já era, porque retirá-lo seria decidir o conteúdo
do catálogo de motivos por tipo, que está com o RH (`DP-29`).

**Fora desta entrega:** a readmissão (`POST /v1/vinculos`) não foi alterada;
D7 e D8 seguem abertos.

**Limitação autorizada de validação: não houve validação em navegador.** A
tarefa proibia iniciar ou alterar a API, o banco de demonstração e os
processos que essa validação exige. É limitação da validação desta entrega,
não defeito do produto: o comportamento da tela está coberto por testes
automatizados (web, API e E2E na CI), e nenhuma verificação visual é
declarada como feita.

**Dívidas preservadas:** **R-3** (T162), **R-3 da revisão da T164**, **S2** (T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157) e o registro `teste michell`.

## Perfil do colaborador: dados de contato — T168 (integrada)

| Tarefa | Estado                                                                     | Resultado principal                                                                           |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T168   | **Integrada** (PR #160, squash `db9b023`), como parada por regra declarada | Nenhum dos quatro campos de contato atende à condição do proprietário; nada foi implementado. |

**A T167 foi integrada** em `main` pela PR #159, squash
`dcef62706399126b934c51e7d2955941cf9f06b3`, com a CI de push 3/3 verde.

**A ADR 0016 foi aprovada pelo proprietário** em 2026-10-16 (`DP-ADM-01`).
**A aprovação não fecha as demais decisões** — `DP-ADM-02` a `DP-ADM-18` seguem abertas — e **não dispensa a ficha de tratamento** de cada categoria (decisão 5.4).

**A T168 começou pela investigação**, antes de qualquer migration ou interface:
só entraria o campo que a ADR classificasse como A2, complementar e não
bloqueado, e cuja finalidade, acesso, auditoria e retenção estivessem definidos
nos artefatos aprovados. Campos pretendidos: e-mail pessoal, e-mail corporativo,
celular e telefone.

**A regra de parada foi acionada nos quatro.** Diagnóstico completo, com a
ficha em branco, em
[`docs/decisions/t168-contatos-bloqueio-ficha.md`](../docs/decisions/t168-contatos-bloqueio-ficha.md).

- **E-mail pessoal, celular e telefone:** A2, Complementar, dependem de `FT`,
  `CTR` e `RET`. **Nenhuma ficha de tratamento existe**, e `DP-ADM-02` e
  `DP-ADM-03` seguem abertas. O acesso (`rh` e `dp` da empresa ativa) e a
  auditoria (escrita sem valores) de A2 já estão definidos; faltam finalidade,
  base legal, classificação e retenção, que são de RH + Jurídico.
- **E-mail corporativo:** **Derivado** da conta de acesso — é o login, não um
  campo de contato —, e o servidor não tem rota que altere o e-mail de uma conta.
  Pede decisão própria do domínio de contas.

**Nada foi implementado:** nenhuma migration, API, interface, teste de produto
ou alteração de RBAC. **Para retomar:** a ficha respondida, a emenda à ADR 0007
e, se o `master_tecnico` fica fora de A2, a emenda à ADR 0012.

**Regras do proprietário preservadas:** `rh` e `dp` consultam e editam na
empresa ativa; `master_tecnico`, `gestor` e `colaborador` não; empresa só da
sessão; nada na listagem, no Hub, no portal ou na liderança; escritas
auditadas; validação no servidor.

**Fora de escopo:** endereço, contato de emergência, documentos, CPF, foto,
nome social, sexo, gênero, raça/etnia, deficiência, nacionalidade, estado
civil, escolaridade, dados bancários, dependentes, dados contratuais, portal
do colaborador, RBAC global.

**Dívidas preservadas:** **R-3** (T162), **R-3 da revisão da T164**, **S2** (T161), **R1 a R3** (T160), **L3**, **S-1 a S-4** (T158), **R-A a R-C** (T157), o registro `teste michell`, a decisão **`DP-29`** (se `outro_controlado` vale para admissão) e a **limitação de validação em navegador da T167**.

## Contatos do colaborador — T169 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                               |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------- |
| T169   | **Integrada** (PR #161, squash `0fa2e1e`) | Agregado próprio de contatos do colaborador — e-mail pessoal, celular e telefone. |

**A T168 foi integrada** em `main` pela PR #160, squash
`db9b023dc11c9fcfa2397b016713939f119c0a6f`, com a CI de push 3/3 verde.

**A ficha de tratamento dos contatos foi aprovada pelo proprietário** em
2026-10-16 e está formalizada em [ficha de tratamento dos contatos](../docs/decisions/ficha-tratamento-contatos-colaborador.md). Ela libera **e-mail pessoal, celular
e telefone**, como A2 restrita, com finalidade, base legal, retenção,
auditoria e perfis definidos. A proteção em repouso foi avaliada antes da
migration e é adequada ao padrão atual do projeto para esta classe, com dado
real ainda barrado pelos gates de segurança operacional.

**Emendas formais:** ADR 0007, Emenda 4; ADR 0012, Emenda 1. Na ADR 0016,
`DP-ADM-02`, `DP-ADM-03` e `DP-ADM-06` ficam resolvidas só para Contatos; as
demais seguem abertas.

**Revisão de decisão anterior, registrada:** a T165 (§5.2) dizia que o
`master_tecnico` não edita pessoas. Para **contatos**, o proprietário decidiu
que ele lê e edita, auditado; para todo o resto, a regra da T165 continua.

### O que a T169 entregou

- **Banco.** Migration `20261016120000_contatos_colaborador`, **criada e não aplicada localmente**:
  `contato_colaborador` (valor vigente por colaborador e empresa, com CHECK da
  normalização e triggers diferidos que exigem vínculo na empresa) e
  `contato_colaborador_evento` (toda consulta, criação e edição, com
  resultado e nomes de campos, nunca valores, append-only). Migration `20261016130000_contatos_auditoria_toda_consulta`,
  também **criada e não aplicada localmente**, permite o evento sem contato e,
  só na empresa ambígua, sem empresa. `Colaborador` não ganhou coluna.
- **API.** `GET` e `PUT /v1/colaboradores/:colaboradorId/contatos`, recurso
  próprio `contato_colaborador`. `rh` e `dp` na empresa ativa;
  `master_tecnico` em qualquer empresa, ou só na ativa quando selecionada;
  `gestor`, `colaborador` e demais negados. A empresa real vem do vínculo e é
  auditada em cada operação. Estados `sem_registro`, `registrado` e
  `bloqueado`. Validação e normalização no servidor, sem presumir país.
- **Trilha de toda consulta.** Com valor, sem registro, bloqueada, o `PUT` sem
  alteração (registrado como leitura) e a tentativa do `master_tecnico` com
  empresa ambígua (sem empresa, `failure`) deixam `audit_event` e evento de
  tratamento, na mesma transação. Nunca valores, corpo nem cabeçalhos brutos.
- **Web.** Seção "Contatos" no detalhe do colaborador: três campos
  obrigatórios, erro por campo, foco no primeiro erro, dados preservados em
  falha, confirmação de sucesso e de descarte.
- **Testes.** Unitários da API, E2E no bloco da T169 de `pessoas.e2e-spec.ts`
  e web.

**Limites registrados:** a eliminação ou anonimização após 2 anos não tem
processo nesta fatia; exportação e exclusão não têm rota; a origem e a
evidência da coleta não foram especificadas pela ficha (lacuna registrada);
os E2E rodam só na CI; sem validação visual em navegador.

**Fora de escopo:** endereço, contato de emergência, CPF, documentos, foto,
nome social, sexo, gênero, raça/etnia, deficiência, escolaridade, dados
bancários, dependentes, dados contratuais, portal do colaborador, e-mail
corporativo persistido e o fluxo de admissão.

**Dívidas preservadas:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167.

## Node 24 LTS — T170 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                               |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------- |
| T170   | **Integrada** (PR #162, squash `2fd19df`) | Migração controlada da política do projeto para Node 24 LTS, com pnpm 10 mantido. |

**A T169 foi integrada** em `main` pela PR #161, squash
`0fa2e1e930bc86f545d37839c42a385b3ed05cfa`, com a CI de push 3/3 verde: contatos do
colaborador (e-mail pessoal, celular e telefone) em agregado próprio, com
trilha de toda consulta.

**Escopo da T170:** `.nvmrc`, `engines`, CI e documentação que declaram ou
executam Node passam a Node 24 LTS. pnpm 10 é mantido. Nenhuma dependência de
produto é atualizada, nenhuma funcionalidade muda, e só se corrige
incompatibilidade comprovadamente causada pelo Node 24. O rollback para Node 22
fica registrado.

**Fora de escopo:** pnpm 11, migration aplicada localmente, seed e banco de
demonstração.

### O que a T170 entregou

- **Política.** `.nvmrc` em `24`; `engines.node` em `>=24 <25` nos três
  `package.json`; a CI lê o `.nvmrc` nos três jobs; README, guia de
  demonstração e `plan.md` atualizados. pnpm `10.0.0`, lockfile e dependências
  inalterados (`@types/node` segue em `^22`).
- **Compatibilidade.** Nenhuma incompatibilidade causada pelo Node 24; nenhuma
  correção de código. Instalação limpa, `argon2`, engines do Prisma, lint,
  typecheck, build e testes passam no Node 24.19.0, sem aviso de depreciação.
  As medições do `tsc` deram o mesmo resultado no Node 22.23.3.
- **Rollback.** Rota preferida, manual: voltar `.nvmrc` e `engines` para Node
  22, atualizar README, guia local, `plan.md` e os três comentários da CI que
  mencionam Node 24 LTS, e reinstalar com `pnpm install --frozen-lockfile`,
  sem tocar o restante do Spec Kit. Rota excepcional, `git revert` do squash:
  não equivale à manual, porque desfaz também a convergência da T169, o
  registro da T170 e o documento de decisão, e exige nova convergência
  documental. Detalhes em [decisão da T170](../docs/decisions/t170-node-24-lts.md).

**Pendência nova, de ambiente:** no Windows, o `prisma generate` do
`postinstall` grava o client na raiz de `node_modules`, e o `tsc` da API
estoura a pilha até rodar `pnpm --filter @evolli/api exec prisma generate`.
Idêntico no Node 22; não aparece na CI em Linux.

**Dívidas preservadas:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. As pendências da T169 seguem abertas: o processo de eliminação ou anonimização após 2 anos do desligamento; as rotas de exportação e exclusão de contatos, cuja auditoria é obrigatória quando existirem; a origem e a evidência da coleta, lacuna da ficha; a validação visual em navegador; e as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço), além da docstring do serviço de contatos que ainda descreve o `resourceId` de forma absoluta.

## Ambiente local Node 24 — T171 (integrada)

| Tarefa | Estado                                    | Resultado principal                                                                                            |
| ------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| T171   | **Integrada** (PR #163, squash `bd860b0`) | Instalação local no Windows em Node 24 e pnpm 10 sem `prisma generate` manual, e prévia validada no navegador. |

**A T170 foi integrada** em `main` pela PR #162, squash `2fd19df9a86427cd3454d8d40ee282641ec83b65`,
com a CI de push 3/3 verde em Node 24: `.nvmrc` em `24` como fonte única,
`engines` em `>=24 <25`, pnpm 10 mantido.

**Escopo da T171:** resolver o fluxo de instalação que hoje exige
`prisma generate` manual no Windows; garantir Node 24 e pnpm 10 reproduzíveis;
subir o ambiente de demonstração local (migrations e seed só no banco local de
demonstração) e validar no navegador login, Hub, troca de empresa autorizada,
colaboradores e contatos.

**Fora de escopo:** atualização de dependências, pnpm 11, mudança funcional de
RH, contatos, RBAC, schema ou migrations de negócio sem necessidade comprovada,
e qualquer ambiente fora do demonstrativo local.

### O que a T171 entregou

- **Causa comprovada** na fonte do Prisma 5.22 (`getDefaultOutdir`): no
  Windows, o teste de caminho com barra normal falha e, no `postinstall`, o
  client vai para `INIT_CWD/node_modules/.prisma/client`, a raiz do
  repositório.
- **Correção sem trocar dependência:** o `postinstall` da API roda o mesmo
  `prisma generate` sem `INIT_CWD` (`scripts/prisma-generate-api.mjs`) e confere
  que o client ficou ao lado do `@prisma/client`, falhando com a causa se não
  ficou. Instalação limpa no Windows: client no lugar certo, `tsc` da API sem
  erro e `require('@prisma/client')` funcionando, sem `generate` manual.
- **Node 24 e pnpm 10 exigidos** no passo 1/8 da demonstração, lidos do
  `.nvmrc` e do `packageManager`.
- **Prévia validada no navegador** em `http://127.0.0.1:5173`: login, Hub,
  colaboradores, contatos e troca de empresa sem resíduo. Detalhes em [decisão da T171](../docs/decisions/t171-ambiente-local-node24.md).

**Pendências novas:** vão vertical de 256 px na seção Contatos (defeito visual
da T169); aviso `[DEP0190]` do Node 24 no orquestrador da demonstração no
Windows, só aviso.

**Dívidas preservadas:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2, N-3 e N-4 da revisão final; e a docstring do serviço de contatos sobre `resourceId`. A
pendência da T170 (client do Prisma na raiz de `node_modules` no Windows) foi o
objeto desta tarefa e está resolvida.

## Correção visual de Contatos — T172 (implementada em Draft)

| Tarefa | Estado                    | Resultado principal                                                          |
| ------ | ------------------------- | ---------------------------------------------------------------------------- |
| T172   | **Implementada em Draft** | Remover o vão vertical de cerca de 256 px do estado vazio da seção Contatos. |

**A T171 foi integrada** em `main` pela PR #163, squash `bd860b0d303c97e59aed0f85f540db8303380092`, com a CI de
push 3/3 verde em Node 24: o `postinstall` da API gera o client do Prisma no
lugar certo no Windows, e a demonstração local exige Node e pnpm nas versões do
repositório.

**Escopo da T172:** o aviso "Nenhum contato registrado" reaproveita
`colaboradores-screen__aviso-texto`, com `flex: 1 1 16rem`, dentro de um
formulário em coluna, e ocupa cerca de 256 px de altura. A correção é de estilo e
estrutura próprios para o estado vazio, sem tocar o estilo compartilhado da
T111, com testes e validação no navegador no ambiente local de demonstração.

### O que a T172 entregou

- **Correção.** O aviso passou a usar a classe própria
  `colaboradores-screen__contatos-aviso`, sem nenhuma propriedade `flex`; a regra
  compartilhada da T111 não foi alterada. No navegador, o aviso do estado vazio
  foi de 256 px para 25 px, e o formulário, de 664 px para 433 px.
- **Achado, mesma causa.** O estado **bloqueado** usava a mesma classe flexível e
  também media 256 px (75 px depois); a correção cobre os dois.
- **Testes.** 3 de componente e 4 de contrato de CSS; 9 mutações reprovam, entre
  elas reintroduzir a classe flexível e "consertar" alterando a regra da T111.
- **Navegador, no ambiente local de demonstração.** Envio vazio mantém erros e
  foco; salvar normaliza e confirma; o estado com contatos segue correto; a troca
  Alfa → Beta segue sem resíduo. Detalhes em [decisão da T172](../docs/decisions/t172-correcao-visual-contatos.md).

**B-1 resolvido por autorização do proprietário (2026-10-19).** A revisão
adversarial da PR #164, no head `7606715`, apontou como único bloqueio a extensão
da correção ao estado bloqueado. O proprietário autorizou: “A T172 pode corrigir o vão vertical do aviso nos dois estados equivalentes da seção Contatos: sem registro e bloqueado. Ambos usam o mesmo padrão inadequado dentro do mesmo componente; a extensão não autoriza outras correções visuais.” O código
revisado não mudou. As observações O-1 a O-5 seguem não bloqueantes e não foram
tratadas.

**Fora de escopo:** qualquer outra pendência; rotas, permissões, auditoria,
normalização, validação, dados, schema, migrations, banco, seed e gravação dos
contatos; Node, pnpm, Prisma e scripts de ambiente.

**Dívidas preservadas:** R-3 (T162), R-3 da revisão da T164, S2 (T161), R1 a R3 (T160), L3, S-1 a S-4 (T158), R-A a R-C (T157), o registro `teste michell`, a decisão `DP-29` (se `outro_controlado` vale para admissão) e a limitação de validação em navegador da T167. Pendências da T169: o processo de eliminação ou anonimização após 2 anos; as rotas de exportação e exclusão de contatos; a origem e a evidência da coleta; a validação visual em navegador; as observações N-2 (criação concorrente de contato que perde na unicidade responde 409 sem trilha), N-3 (`ON UPDATE CASCADE` nas FKs do evento de contato permite reescrita indireta) e N-4 (CHECK do evento mais frouxo que o serviço); e a docstring do serviço de contatos sobre `resourceId`. Pendências
da T171: o aviso `[DEP0190]` do Node 24 no orquestrador da demonstração, no Windows (`shell: true` com argumentos), só aviso; e as observações O-1 (a CLI fina do `prisma generate` não tem teste próprio), O-2 (caminho inválido sem teste explícito) e O-3 (efeitos leves nos testes).

## Próxima ação autorizável

1. ~~**Decidir o pacote da T150**~~ — **cumprido pela T151.** O proprietário aprovou o recorte em
   06/10/2026 e a decisão foi formalizada na
   [ADR 0015](../docs/adr/0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md):
   `DP-8` e `DP-23` estão **resolvidas**, e somente no recorte aprovado. Gestão matricial
   permanente, departamento inteiro e empresa inteira **continuam não aprovados** e seguem
   dependendo de decisão nova.
2. **Decidir o pacote da T148** — levar `docs/decisions/pacote-decisao-integracao-registros-ponto.md`
   a Produto, TI, RH, Jurídico/DPO e, quanto às perguntas ao fornecedor, à RWTech/Secullum. Nenhuma
   implementação de integração de ponto começa antes de §2–§6 desse pacote serem decididos e de a
   ADR 0008 (decisão 4) ser reaberta por ADR nova ou emenda formal.
3. Em paralelo, **escolher a próxima fatia funcional independente de ambos os pacotes**, sob o
   próximo identificador disponível — sem número reservado aqui, porque reservar identificador antes
   da decisão de escopo já se mostrou fonte de confusão (ver T137). A implementação usa a fundação
   visual já congelada, sem reabrir o shell, os tokens, o padrão B ou os modais.
4. Candidatos remanescentes: a validação com RH do catálogo de motivos, cujo mecanismo (código
   fechado) já está aprovado. **O Gestor consultivo saiu desta lista por estar em execução na
   T153** — a leitura anterior, de que ele dependia de `DP-8` e `DP-23`, valia até a T150 e foi
   superada pela ADR 0015. **O autoatendimento do colaborador (ESS) continua fora**: nada na
   ADR 0015 o autoriza, e ele não foi iniciado.
5. Refinamento estético e acabamento visual final da fundação ficam para uma etapa posterior,
   depois dos módulos funcionais.
6. Atualizar este ledger e `sync-state.json` em toda tarefa futura.

## Limites da T141 (ambiente de demonstração)

- **Não é funcionalidade de RH.** A T141 não cria endpoint, regra, permissão ou estado novo: só
  sobe o que já existe e explica, tela a tela, o que está integrado.
- **Local e sintético.** Banco, API e web na própria máquina; o seed recusa host que não seja
  local e exige `EVOLLI_DEMO_SEED` no ambiente do processo.
- **Sem MFA, sem anexo, sem R2, sem serviço externo.** O seed não habilita segundo fator nem cria
  conteúdo documental, biometria ou dado clínico.
- **Não equivale a homologação nem a produção**, e não autoriza dado real.
- **Idempotente e não destrutivo.** O seed procura antes de criar e nunca apaga — `DELETE` é
  revogado no banco em `solicitacao_pessoa` e `audit_event`. A busca varre todas as páginas, então
  a idempotência não acaba no registro 101.
- **Porta da API configurável, nunca silenciosa.** `PORT` decide a porta da API; a web é fixa em 5173. Porta ocupada para o comando no passo 1/8 em vez de escorregar para outra. A demonstração
  desta máquina usa `PORT=3002` porque 3000 e 3001 pertencem a outros serviços do proprietário.
- **Pendência visual aberta (T115, preexistente):** `Pessoas › Histórico funcional` estoura a
  largura da página; medida e evidência no guia visual. Não corrigida nesta tarefa.
- **Nada exposto na rede.** A API só escuta em `127.0.0.1` quando `EVOLLI_DEMO_MODE=true`, decisão
  validada pelo servidor e proibida com `NODE_ENV=production`; a web é presa a `127.0.0.1:5173`
  com porta estrita. Nenhuma credencial trafega em linha de comando.

## Evidência mínima por tarefa futura

- ID, título, estado e pré-condições no `tasks.md`.
- Atualização deste ledger e do manifesto `sync-state.json`.
- Branch e PR dedicadas; Draft inicialmente.
- Testes proporcionais ao risco, typecheck, lint, build, Prettier e `git diff --check`.
- CI remota verde e revisão somente leitura.
- `/speckit.converge` registrado antes de Ready for review.
- Autorizações separadas para Ready, merge e qualquer ação operacional externa.
