# Decisões — Gestão de Documentos e Solicitações do Colaborador (V1, consolidação)

Status: **DECISÕES DE SOLICITAÇÕES APROVADAS; DECISÕES DOCUMENTAIS PARCIAIS**.
Os itens `PD-SOL-01..05` foram fechados em 2026-09-29 no
[pacote de decisão da Central](pacote-decisao-solicitacoes-pessoas.md) §7.
As pendências `PD-DOC-*` não resolvidas continuam bloqueando conteúdo real.

Data: 2026-09-10 (T082).

Relacionado (contexto interno, sem alteração):
[ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md)
(documentos privados),
[ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
(RH + Jurídico como responsáveis por privacidade; `master_tecnico` sem mutação
trabalhista),
[ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria
append-only),
[ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (identidade/MFA),
[ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) (escopo
por empresa e 404 anti-enumeração),
[ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
(vínculo funcional);
[especificação estrutural de Documentos — Etapa 2](../modules/etapa2-documentos-admissao-digital-estrutural.md),
[aprovações pendentes de Documentos (Nível 1/Nível 2)](etapa2-documentos-admissao-aprovacoes-pendentes.md),
[convergência de Documentos — Etapa 2](etapa2-documentos-convergencia.md),
[Contrato da Central de Solicitações do Colaborador](../modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md),
[Contrato da fila "Verificar folhas"](../modules/etapa3-fila-verificar-folhas-contrato-v1.md),
[Contrato do fechamento e do Espelho de Ponto](../modules/etapa3-fechamento-espelho-contrato-v1.md),
[Pacote de decisão — Segurança operacional](pacote-decisao-seguranca-operacional.md)
(`DS-OPS-01`, MFA),
[Mapa de capacidades e roteiro de implantação do Ponto V1](mapa-capacidades-implantacao-ponto-v1.md).

## Atualização de decisão — 2026-09-29

- Catálogo aprovado da Central: ponto, ausência, férias, atualização
  cadastral, atestado e benefícios. Solicitação de documento permanece no
  fluxo específico de `solicitacoes-documento`.
- RH decide; gestor participa de modo consultivo em temas de equipe; Diretoria
  é escalonamento excepcional. Nenhum deles altera automaticamente ponto,
  férias, cadastro ou benefício pela existência da solicitação.
- Solicitações e "Verificar folhas" mantêm objetos separados, com referência
  futura opcional e sem bloqueio automático de fechamento na primeira versão.
- Cancelamento, reabertura e objetivo de primeiro retorno seguem o registro
  aprovado do pacote §7.
- Critérios mínimos de evidência foram aprovados, mas anexos continuam
  dependentes dos portões de conteúdo. O provedor aprovado para armazenamento
  privado futuro é o Cloudflare R2, conforme
  [ADR 0013](../adr/0013-armazenamento-privado-cloudflare-r2.md).
- A aprovação das decisões permite especificar e implementar a fundação da
  Central sem anexos. Ela não autoriza upload, dado real ou produção.

## 0. Natureza e limites deste documento

Este documento **consolida** direcionamentos recebidos do RH sobre dois temas —
**Gestão de documentos** e **Solicitações do colaborador** — separando o que foi
**definido**, o que continua **limitado** pelos gates já registrados, o que
**depende de confirmação formal**, quem **depende de quem** entre as áreas
envolvidas e uma **sequência recomendada** de avanço.

**O que este documento NÃO faz** (limites inegociáveis):

- **Não cria operação real, integração, permissão, SLA obrigatório, política de
  retenção, assinatura eletrônica ou regra trabalhista.** Todo direcionamento
  recebido aqui é um **sinal de intenção do RH** — não uma regra pronta. Uma
  regra só existe depois de confirmação formal e da satisfação dos gates já
  registrados (ADR 0011, ADR 0003, `DS-OPS-01`).
- **Não declara conformidade** com a **CLT**, com nenhuma **CCT/ACT**, com a
  **Portaria MTP 671**, com a **LGPD**, com o **eSocial** ou com qualquer outra
  norma. Toda referência normativa é **informativa**, nunca uma declaração de
  aderência.
- **Não usa dado real:** nenhum nome de pessoa, nome de empresa, e-mail,
  telefone, CPF, documento, dado médico, valor monetário, IP ou marca de
  terceiros aparece em nenhuma linha deste documento. Toda referência é
  **conceitual ou de categoria**, nunca uma instância real.
- **Não implementa nada:** nenhum código, teste, schema, migration, endpoint,
  API, dependência, configuração ou arquivo de UI é criado por este documento.
- **Não decide nenhuma pendência já registrada** nos documentos relacionados
  acima e **não reabre** nenhum gate — apenas organiza os direcionamentos novos
  e aponta onde eles precisam **conciliar** com o que já existe.
- **Não substitui validação de RH, Jurídico/privacidade, Folha/DP, saúde
  ocupacional ou TI/Segurança** — cada pendência registrada (§5) continua
  exigindo essa validação, sem exceção.

## 1. Como ler este documento

Cada direcionamento recebido é classificado em um destes quatro grupos:

| Grupo                              | Significado                                                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Definição recebida**             | O RH indicou uma direção clara de produto (ex.: quais categorias existem, quais tipos de solicitação existem) — ainda **não** é regra aprovada nem gate liberado. |
| **Limite preservado**              | Um limite já registrado em ADR/contrato existente que continua valendo e que este documento **reafirma**, sem alterá-lo.                                          |
| **Pendente de confirmação formal** | Um ponto que **precisa** de decisão formal de uma ou mais áreas antes de qualquer implementação — registrado com responsável (§5).                                |
| **Dependência entre áreas**        | Uma relação de "só avança depois que" entre RH, Folha/DP, Jurídico/privacidade, saúde ocupacional e TI (§6).                                                      |

## 2. Gestão de documentos — direcionamentos recebidos

### 2.1 Categorias documentais (definição recebida)

O RH indicou as seguintes categorias como o **catálogo inicial de referência**
para a Gestão de documentos. Nomes **conceituais** — não são enum de banco nem
tipo aprovado; a materialização e a classificação de sensibilidade seguem como
pendência própria da Etapa 2
([DP-2E-01](etapa2-documentos-admissao-aprovacoes-pendentes.md), DP-2E-02).

| Categoria (conceitual) | Observação                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| Admissional            | Documentos ligados ao início do vínculo.                                |
| Contratos/aditivos     | Contrato de trabalho e aditivos contratuais.                            |
| Cadastrais             | Documentos de identificação/atualização cadastral do colaborador.       |
| Ocupacionais           | **Categoria sensível** (§2.5) — inclui documentos de saúde ocupacional. |
| Férias                 | Documentos ligados ao ciclo de férias.                                  |
| Disciplinares          | Documentos de medidas disciplinares.                                    |
| Desempenho             | Documentos de avaliação/gestão de desempenho.                           |
| Benefícios             | Documentos ligados à adesão/uso de benefícios.                          |
| Comprovantes           | Comprovantes diversos solicitados ao colaborador ou emitidos para ele.  |
| Desligamento           | Documentos ligados ao encerramento do vínculo.                          |

**Todas** essas categorias permanecem sujeitas ao Nível 1/Nível 2 já registrados
(ADR 0011; [aprovações pendentes](etapa2-documentos-admissao-aprovacoes-pendentes.md)):
nenhuma delas autoriza upload, conteúdo ou dado real por si só.

### 2.2 Finalidades (definição recebida)

O RH indicou as seguintes finalidades para um documento dentro de uma
categoria — também **conceituais**, sem regra de prazo, alçada ou efeito
definida:

- **Consulta** — o documento existe para ser consultado (metadado e,
  eventualmente, conteúdo).
- **Comprovação** — o documento serve como comprovante de um fato (ex.: um
  comprovante de categoria "Comprovantes").
- **Assinatura** — o documento é objeto de assinatura, manual ou eletrônica
  (a assinatura eletrônica permanece **bloqueada**, §4; a manual segue como
  etapa externa, coerente com o
  [contrato do fechamento e do Espelho de Ponto](../modules/etapa3-fechamento-espelho-contrato-v1.md) §7).
- **Vencimento** — o documento tem uma validade e pode vencer (§2.8).
- **Encaminhamento para processamento da Folha/DP** — o documento é insumo
  para um processamento futuro na Folha/DP, sempre **manual** nesta etapa
  (§2.10, §4).

### 2.3 Documentos que poderão ser visualizados pelo colaborador (definição recebida)

O RH indicou a intenção de que **parte** do catálogo documental seja
visualizável pelo próprio colaborador, no futuro. **Qual** parte, exatamente,
é a **matriz de acesso** — que permanece pendente (§5, PD-DOC-01) e depende do
Portal do Colaborador, hoje só protótipo visual (coerente com
[DP-2E-14](etapa2-documentos-admissao-aprovacoes-pendentes.md)).

### 2.4 Grupos restritos ao RH e perfis de acesso mínimo (definição recebida)

O RH indicou que deve existir:

- um **grupo de documentos restrito ao RH** (nunca visível ao colaborador nem
  a outros perfis sem decisão própria); e
- **perfis que podem acessar somente o necessário** por categoria — ou seja,
  acesso não é "tudo ou nada" por perfil, mas recortado por categoria
  documental.

Essa intenção é coerente com o princípio de **menor privilégio** já fixado
(ADR 0011, decisões 4–6; ADR 0012). A **matriz completa** — quem visualiza,
quem solicita, quem substitui, por categoria e por perfil — permanece
pendente (§5, PD-DOC-01), reusando o espírito de
[DP-2E-13 (metadado)](etapa2-documentos-admissao-aprovacoes-pendentes.md) sem
renumerá-lo.

### 2.5 Categorias sensíveis — saúde, dados bancários e documentos pessoais (limite preservado + pendência)

**Nenhum documento de saúde, dado bancário ou documento pessoal é tratado como
dado liberado por este documento.** Eles são registrados como **categorias
sensíveis**, e permanecem **bloqueados** até que exista, cumulativamente:

- decisão de **acesso restrito** (quem, por categoria, pode sequer saber que o
  documento existe);
- **MFA** habilitado e imposto no servidor (ADR 0003, decisão 3);
- o gate-mestre **`DS-OPS-01`** resolvido
  ([pacote de segurança operacional](pacote-decisao-seguranca-operacional.md));
- **auditoria** comprovada (ADR 0004);
- **retenção e base legal** definidas (RH + Jurídico/privacidade); e
- as **validações aplicáveis** de RH, Jurídico/privacidade e, no caso de
  documento ocupacional, **saúde ocupacional**.

Isso **não** é uma pendência nova: é a aplicação, a esta categoria específica,
do mesmo Nível 2 já bloqueado para todo o módulo de Documentos (ADR 0011;
[aprovações pendentes](etapa2-documentos-admissao-aprovacoes-pendentes.md)).
O tratamento específico de documento ocupacional/médico — inclusive **o que, no
mínimo, pode chegar ao gestor** (nunca o documento em si) — é registrado como
pendência própria (§5, PD-DOC-02).

### 2.6 Envio documental futuro pelo colaborador (definição recebida)

O RH indicou a **possibilidade futura** de o colaborador enviar documentos
(upload). Esse envio é, por construção, **conteúdo** — permanece dentro do
**Nível 2**, já bloqueado (ADR 0011, decisão 2: `upload_desabilitado` é estado
sem transição de saída) até que os itens de Nível 2 estejam aprovados,
incluindo MFA.

### 2.7 Histórico quando houver substituição (definição recebida, coerente com o já implementado)

O RH confirmou a necessidade de **manter histórico** quando um documento for
substituído por uma versão mais nova. Esse comportamento **já existe** como
fundação real de metadado: a substituição gera um **novo registro**, e o
anterior muda para o estado `substituido` — nunca é apagado nem sobrescrito
(coerente com a
[convergência de Documentos — Etapa 2](etapa2-documentos-convergencia.md), §1).
Este documento **reafirma** esse comportamento como direção válida para
qualquer evolução futura de conteúdo (Nível 2).

### 2.8 Documentos com possível controle de validade (definição recebida)

O RH indicou que alguns documentos podem ter uma **data de validade/vencimento**
controlável pelo sistema. **Nenhum prazo é definido aqui.** Isso reforça, sem
resolver, a pendência já registrada
([DP-2E-06](etapa2-documentos-admissao-aprovacoes-pendentes.md) — prazos de
validade/expiração de documento e de solicitação).

### 2.9 Bloqueio do acesso do colaborador após desligamento (definição recebida)

O RH indicou que o **acesso do colaborador aos próprios documentos deve ser
bloqueado após o desligamento**. A **regra exata** — o que acontece com os
documentos em si (retenção, arquivamento, descarte) e por quanto tempo o
bloqueio de acesso é imediato ou gradual — permanece pendente (§5, PD-DOC-03),
e depende, cumulativamente, do Portal do Colaborador existir de fato e da
matriz de retenção por categoria estar decidida.

### 2.10 Relatórios documentais esperados (definição recebida)

O RH indicou a expectativa de relatórios documentais — por exemplo, situação do
catálogo por categoria, documentos com vencimento próximo e documentos
pendentes de RH. Nenhum desses relatórios existe hoje além de protótipos
visuais isolados (coerente com o
[mapa de capacidades](mapa-capacidades-implantacao-ponto-v1.md) §2.4: "Relatório
de exceções/pendências" e afins classificados como **próximo passo
visual/documental**). O desenho concreto de cada relatório fica para uma
especificação própria, fora deste documento.

## 3. Solicitações do colaborador — direcionamentos recebidos

### 3.1 Tipos iniciais (definição recebida — amplia o catálogo conceitual já existente)

O RH indicou os seguintes tipos iniciais de solicitação: **contestação de
ponto, férias, ausência, atestado, atualização cadastral, documentos e
benefícios**.

O [contrato conceitual da Central de Solicitações do Colaborador](../modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md)
§2 registrava um catálogo inicial menor. A decisão `PD-SOL-01`, aprovada no
[pacote de decisão da Central](pacote-decisao-solicitacoes-pessoas.md) §1.1 e
§7, consolidou o catálogo com `contestacao_ajuste_ponto`, `ausencia`,
`ferias`, `atualizacao_cadastral`, `atestado` e `beneficios`. O tipo
`documento` ficou fora da Central e permanece no fluxo específico já
funcional de `solicitacoes-documento`.

### 3.2 Papéis por tipo de solicitação (definição recebida)

- **RH recebe e analisa** toda solicitação, na própria empresa — coerente com
  o papel exclusivo do RH já registrado (contrato §5; ADR 0012).
- **Gestor participa somente de forma consultiva em temas de organização da
  equipe**, sem aprovar, recusar ou alterar registro trabalhista. Esse limite
  foi aprovado em `PD-SOL-01`; a autorização operacional continua
  deny-by-default e depende do RBAC previsto para a fundação real.
- **Diretoria é escalonamento excepcional** — participação **fora da rotina**,
  só quando o fluxo RH/gestor não resolve. Até existir matriz mais detalhada,
  a decisão operacional final permanece com o RH, conforme `PD-SOL-01`.

### 3.3 Exigência de justificativa/evidência conforme o tipo (definição recebida)

`PD-SOL-05` aprovou a coleta somente dos **campos mínimos por tipo**. Anexos
são permitidos pela política, mas continuam desabilitados até o fechamento
dos portões técnicos e jurídicos de conteúdo. Para `atestado`, o fluxo não
coleta diagnóstico, CID ou descrição clínica; o gestor recebe apenas a
informação operacional mínima e nunca o documento. A aprovação do Cloudflare
R2 como armazenamento privado futuro não habilita upload por si só.

### 3.4 Motivo de recusa visível ao colaborador (definição recebida, coerente com o já registrado)

O RH confirmou que o **motivo de recusa deve ser visível** ao colaborador.
Isso é coerente com a estrutura conceitual já registrada: o estado `recusada`
já prevê **motivo codificado e auditoria** (contrato §4, §4.1). Este
documento **reafirma** essa direção — a visibilidade ao colaborador depende
do Portal do Colaborador existir de fato.

### 3.5 Cancelamento antes da análise (decisão aprovada)

`PD-SOL-03` definiu que o colaborador pode cancelar somente antes de
`em_revisao_rh`. Depois desse marco, não há cancelamento livre. RH pode reabrir
`encaminhada_para_operacao_rh` ou `recusada`, com justificativa auditada;
`cancelada` exige uma nova solicitação.

### 3.6 Aprovação do RH e assinatura do colaborador (necessidades apontadas)

O RH apontou **aprovação do RH** e **assinatura do colaborador** como
necessidades para (ao menos) parte das solicitações. Nenhuma das duas é
implementada ou modelada aqui:

- **Aprovação do RH** é coerente com o papel exclusivo já registrado (RH
  encaminha/recusa, contrato §4); `PD-SOL-01` confirmou que a decisão
  operacional final permanece com o RH.
- **Assinatura do colaborador** depende da mesma solução de assinatura
  bloqueada para Documentos (§4; §5, PD-DOC-04) — não é resolvida aqui nem
  antecipada para Solicitações.

### 3.7 Objetivo de primeiro retorno em dois dias úteis (decisão aprovada)

`PD-SOL-04` aprovou o objetivo de **primeiro retorno do RH em dois dias úteis**,
não de conclusão. A contagem pode ser pausada enquanto a solicitação aguarda
informação do colaborador ou de outra área. Na primeira versão, datas e
eventos serão registrados para acompanhamento interno, sem cronômetro
automático nem promessa de conclusão exibida ao colaborador.

## 4. Limites obrigatórios (reafirmados, não alterados)

Nenhum destes limites é criado por este documento — cada um já está registrado
em ADR, contrato ou pacote de decisão existente. Este documento apenas os
**reafirma** no contexto de Gestão de documentos e Solicitações:

- **Marcações originais nunca são apagadas ou sobrescritas.** Toda apuração,
  ajuste, pendência ou evento de fechamento é histórico append-only (ADR 0004
  decisão 3; [mapa de capacidades](mapa-capacidades-implantacao-ponto-v1.md) §3).
- **Ajustes são aditivos, identificados e auditáveis** — nunca uma edição do
  registro original.
- **O gestor não edita marcações, não efetiva ajustes e não fecha período.**
  Toda mutação trabalhista continua exclusiva do RH da própria empresa, mesmo
  quando o escopo do gestor (§3.2) for decidido para organização de equipe.
- **O módulo de Ponto não calcula salário, DSR financeiro, pagamento, desconto
  ou quitação.** Qualquer efeito monetário pertence à Folha/DP, fora do Ponto
  ([contrato do fechamento e do Espelho](../modules/etapa3-fechamento-espelho-contrato-v1.md)
  F8).
- **O saldo de Banco de Horas não cria lançamento automático na Folha/DP.**
  Uma proposta de compensação aprovada **não** cria débito efetivo
  automaticamente; o registro efetivo depende de decisão formal própria.
- **Um documento ou uma solicitação não concede automaticamente abono, ajuste,
  férias, benefício, pagamento, desconto ou aprovação.** A existência de um
  documento ou de uma solicitação é só **referência** — nunca decisão (coerente
  com o contrato da Central de Solicitações §1: "encaminhar não é executar").
- **A integração com a Folha/DP permanece manual e futura, nunca automática
  nesta etapa.** "Encaminhar para processamento da Folha/DP" (§2.2, §5
  PD-DOC-05) é, no máximo, um sinal para um fluxo humano — não uma chamada de
  sistema.
- **Dados reais e documentos sensíveis continuam bloqueados** pelos gates de
  segurança e governança já registrados: MFA (ADR 0003), o gate-mestre
  `DS-OPS-01` ([pacote de segurança operacional](pacote-decisao-seguranca-operacional.md)),
  auditoria (ADR 0004) e retenção/base legal (RH + Jurídico/privacidade,
  ADR 0012).

## 5. Pendências formais remanescentes

Os itens `PD-SOL-01..05` foram removidos desta lista porque estão aprovados no
pacote §7. Cada pendência documental abaixo **requer confirmação formal** da
área responsável antes de conteúdo real.

| ID        | Pendência                                                                                                                                                           | Responsável                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| PD-DOC-01 | Matriz de acesso detalhada por tipo/categoria documental e por perfil — quem visualiza, quem solicita, quem substitui, o que é visível ao colaborador (§2.3, §2.4). | RH + Jurídico/privacidade + TI/Segurança      |
| PD-DOC-02 | Tratamento de documentos médicos/ocupacionais: base legal, minimização e **informação mínima ao gestor** (nunca o documento em si) (§2.5).                          | RH + Jurídico/privacidade + saúde ocupacional |
| PD-DOC-03 | Retenção por categoria documental e destinação (arquivamento/descarte) após desligamento (§2.9).                                                                    | RH + Jurídico/privacidade                     |
| PD-DOC-04 | Solução, escopo e evidência de assinatura digital — se, quando e com qual mecanismo, sem antecipar fornecedor (§2.2, §3.6).                                         | Jurídico + TI/Segurança + RH                  |
| PD-DOC-05 | Definição de "encaminhar para processamento da Folha/DP" na fase inicial — o que exatamente é encaminhado, em que formato, para quem, sempre manual (§2.2, §4).     | RH + Folha/DP                                 |

## 6. Dependências entre áreas

- **RH** é o dono dos direcionamentos deste documento e o único operador que
  recebe, analisa, encaminha ou recusa — na própria empresa (ADR 0012).
- **Folha/DP** só participa por **encaminhamento manual** (§2.2, §4,
  PD-DOC-05) — nenhum lançamento é automático; a Folha/DP decide, em seu
  próprio fluxo, o que fazer com o que foi encaminhado.
- **Jurídico/privacidade** é responsável, junto com o RH, por base legal,
  retenção, classificação de sensibilidade e por qualquer solução de
  assinatura (ADR 0012; PD-DOC-01 a PD-DOC-04; PD-SOL-01, PD-SOL-03, PD-SOL-05).
- **Saúde ocupacional** participa especificamente do tratamento de
  documentos ocupacionais/médicos (§2.5, PD-DOC-02) — inclusive definindo o
  que, no mínimo, pode ser informado ao gestor sem expor o documento.
- **TI/Segurança** é responsável pelos gates transversais que continuam
  bloqueando qualquer dado real independentemente destes direcionamentos:
  MFA, o gate-mestre `DS-OPS-01`, armazenamento seguro e auditoria (§4;
  [pacote de segurança operacional](pacote-decisao-seguranca-operacional.md)).

Nenhuma dessas dependências autoriza uma área a agir sozinha sobre as
pendências do §5 — cada uma exige a combinação de responsáveis indicada.

## 7. Roteiro recomendado (sem cronograma)

Ordem lógica; nenhuma data, prazo, percentual ou estimativa é atribuída.
Cada passo só avança quando o anterior estiver satisfeito:

1. **Consolidar a matriz documental de acesso** — `PD-SOL-01` está fechada;
   `PD-DOC-01` continua necessária antes de conteúdo real.
2. **Definir segurança, retenção e auditoria** — resolver PD-DOC-02,
   PD-DOC-03 e os gates transversais já registrados (MFA, `DS-OPS-01`) antes
   de habilitar qualquer conteúdo ou evidência real.
3. **Manter protótipos visuais e dados sintéticos** — continuar demonstrando
   as telas de Documentos e Solicitações só com dados sintéticos enquanto os
   passos 1 e 2 não estiverem fechados.
4. **Estruturar um repositório documental controlado** — avançar Documentos
   além do metadado (Nível 2) apenas depois dos passos 1 e 2, mantendo a
   segregação entre metadado e conteúdo já fixada (ADR 0011).
5. **Estruturar a fila de solicitações** — `PD-SOL-01..05` estão fechadas e a
   fundação sem anexos pode avançar. Evidência binária permanece bloqueada
   pelos portões documentais e pela ADR 0013.
6. **Definir assinatura e a interface manual com a Folha/DP** — resolver
   PD-DOC-04 e PD-DOC-05 como decisões formais próprias, sempre manuais nesta
   etapa.
7. **Só então avaliar automações futuras** — qualquer integração automática,
   assinatura eletrônica ou expansão de catálogo é avaliada **depois** de
   todos os passos anteriores homologados, sempre como decisão de produto
   própria.

## 8. Declaração

Este documento **registra** direcionamentos recebidos do RH sobre Gestão de
Documentos e Solicitações do Colaborador, separando decisões aprovadas,
limites preservados, pendências documentais, dependências entre áreas e um
roteiro sem cronograma. **Nenhuma linha de código, teste, schema, migration,
endpoint, API, UI funcional, integração, permissão, SLA obrigatório, política
de retenção ou assinatura eletrônica** é criada por este documento. Ele **não
declara conformidade** com a **CLT**, a **CCT/ACT**, a **Portaria MTP 671**, a
**LGPD**, o **eSocial** ou qualquer outra norma, e **não faz** interpretação
jurídica. Nenhum dado real, nome de pessoa, nome de empresa, e-mail, telefone,
CPF, documento, dado médico, valor monetário, IP ou marca de terceiros consta
em nenhuma linha acima. Todas as pendências do §5 permanecem **abertas** até
confirmação formal das áreas responsáveis; enquanto os gates transversais já
registrados (MFA, `DS-OPS-01`, retenção/base legal) estiverem abertos,
**nenhum dado real** entra em nenhum ambiente.
