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

| Tarefa | Estado         | Resultado principal                                                                                                                                                                                                                                             |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T149   | **Em revisão** | Corrigiu na origem o falso positivo que derrubou a CI de `main` quatro vezes. A regra deixa de exigir registro literal de todo `T###` citado em prosa e passa a fiscalizar a janela de entrega declarada em `sync-state.json`. Primeiros testes do verificador. |

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

## Próxima ação autorizável

1. **Decidir o pacote da T148** — levar `docs/decisions/pacote-decisao-integracao-registros-ponto.md`
   a Produto, TI, RH, Jurídico/DPO e, quanto às perguntas ao fornecedor, à RWTech/Secullum. Nenhuma
   implementação de integração de ponto começa antes de §2–§6 desse pacote serem decididos e de a
   ADR 0008 (decisão 4) ser reaberta por ADR nova ou emenda formal.
2. Em paralelo, **escolher a próxima fatia funcional independente da integração de ponto**, sob o
   próximo identificador disponível — sem número reservado aqui, porque reservar identificador antes
   da decisão de escopo já se mostrou fonte de confusão (ver T137). A implementação usa a fundação
   visual já congelada, sem reabrir o shell, os tokens, o padrão B ou os modais.
3. Candidatos naturais, todos dependentes de decisão própria: capacidade de RBAC para o gestor
   consultivo; `DP-23` como pré-condição de qualquer autoatendimento do colaborador; e a validação
   com RH do catálogo de motivos, cujo mecanismo (código fechado) já está aprovado.
4. Refinamento estético e acabamento visual final da fundação ficam para uma etapa posterior,
   depois dos módulos funcionais.
5. Atualizar este ledger e `sync-state.json` em toda tarefa futura.

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
