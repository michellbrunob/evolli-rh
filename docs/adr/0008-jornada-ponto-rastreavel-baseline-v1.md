# ADR 0008 — Jornada e Ponto Rastreável: Baseline V1

- Status: **Aceito**
- Data: 2026-08-07
- Relacionado: [docs/modules/etapa3-jornada-ponto-rastreavel-estrutural.md](../modules/etapa3-jornada-ponto-rastreavel-estrutural.md),
  [docs/decisions/etapa3-jornada-ponto-baseline-v1.md](../decisions/etapa3-jornada-ponto-baseline-v1.md)
  (decisão de produto que esta ADR formaliza),
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md)

## Contexto

A [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md) fixou
`VinculoFuncional` como a entidade de vida funcional do colaborador,
distinta de `AccessUser`, e estabeleceu o padrão de correção por registro
posterior (nunca sobrescrita) para dado de vida funcional. A Etapa 3
(Jornada e Ponto Rastreável) é a fatia seguinte da trilha de RH/DP no
roadmap ([docs/ROADMAP.md](../ROADMAP.md)), e a primeira a tratar dado de
comportamento e presença — quando um vínculo registrou entrada ou saída —
em vez de dado cadastral (Fatia 2) ou estrutural (Fatia 1).

Uma especificação estrutural foi produzida (2026-08-07),
[docs/modules/etapa3-jornada-ponto-rastreavel-estrutural.md](../modules/etapa3-jornada-ponto-rastreavel-estrutural.md),
separando conceitualmente jornada, escala, evento de ponto, ajuste,
apuração e fechamento, sem propor tabela, migration, endpoint ou
integração — e levantando 12 decisões pendentes (DP-3J-01 a DP-3J-12).
O produto avaliou o levantamento e aprovou, em 2026-08-07, 8 decisões — a
**Baseline V1** — registradas em
[docs/decisions/etapa3-jornada-ponto-baseline-v1.md](../decisions/etapa3-jornada-ponto-baseline-v1.md).
Esta ADR formaliza a decisão arquitetural correspondente.

**Esta ADR não autoriza, por si só, o início de uma fase Implementar.**
Ela formaliza o núcleo de decisões de produto que uma futura fase
Implementar exigiria — a decisão de efetivamente iniciar essa fase,
com dados sintéticos, é ato separado.

## Decisão

A Baseline V1 é aceita como modelo conceitual de Jornada e Ponto
Rastreável desta fatia, com as oito decisões a seguir — cada uma
sustentada pela decisão de produto correspondente (referenciada entre
parênteses).

### 1. Vínculo obrigatório com `VinculoFuncional`, nunca com `AccessUser`

Todo evento de ponto, ajuste, apuração e fechamento se ancora em
`VinculoFuncional` — nunca diretamente em `AccessUser`. Mesmo princípio já
estabelecido pela ADR 0007 (decisão 1: Colaborador nunca é extensão de
`AccessUser`), estendido aqui ao próximo domínio que precisa dele. Esta
ADR não introduz nenhuma FK nova — não há schema nesta fase — apenas
fixa o princípio que qualquer modelagem futura deve respeitar.

### 2. Sem escala complexa nesta V1 (Baseline decisão 1)

Nenhum motor de escala (turno, revezamento, múltiplos padrões
simultâneos) é aprovado para implementação nesta V1. A separação
conceitual entre jornada (contrato) e escala (distribuição concreta)
permanece registrada na especificação como referência, não como
compromisso de modelagem.

### 3. Catálogo fechado de quatro eventos nesta V1 (Baseline decisão 2)

`entrada`, `saida`, `inicio_pausa`, `fim_pausa` — únicos tipos de evento
aprovados para esta V1. Qualquer tipo adicional exige decisão própria de
produto, tratada como extensão futura, não implícita nesta Baseline.

### 4. Origem única: registro manual interno (Baseline decisão 3)

Nenhuma outra origem — importação TXT, biometria, foto, geolocalização,
IP como evidência, dispositivo, integração externa — é aprovada nesta V1.
Confirmar essa exclusão como decisão de produto (não apenas como
observação de especificação) fecha a superfície de origem de dado desta
fatia: só o que um usuário autorizado (decisão 6) registra manualmente
dentro do sistema.

### 5. Imutabilidade do evento original; correção só por ajuste rastreável, sem texto livre (Baseline decisão 4)

Nenhuma rota, método de serviço ou privilégio futuro deve permitir
alterar ou apagar um evento de ponto já registrado — mesmo padrão já
estabelecido para `audit_event` (ADR 0004, decisão 1: nenhum papel de
runtime tem privilégio de alterar ou apagar evento gravado) e para
movimentação funcional (ADR 0007: retificação por registro posterior).
Correção é sempre um novo registro (ajuste), nunca edição do original. O
ajuste não aceita campo de texto livre — mesmo princípio já usado para
`motivo_codigo` em Movimentação Funcional (ADR 0007, decisão sustentada
pela Baseline de Colaboradores, decisão 11: catálogo controlado, nunca
texto livre), pela mesma razão: um campo de observação sem classificação
é superfície para dado sensível não identificado entrar sem controle.

### 6. Acesso V1 restrito a RH e DP, por empresa, só para registrar e consultar (Baseline decisão 5)

`empresaId`, alcançado via `VinculoFuncional`, permanece a única
fronteira de autorização — nenhuma nova fronteira é introduzida por esta
ADR (mesmo princípio da ADR 0006, decisão 2, e da ADR 0005). RH e DP
recebem, nesta V1, e apenas nesta V1, a capacidade de registrar (criar
evento e ajuste) e consultar dentro da própria empresa. Nenhuma outra
ação (aprovar, fechar) existe nesta V1 — logo nenhum papel a recebe.

**`admin_tecnico` permanece negado, sem exceção**, pelo mesmo raciocínio
já aplicado em Pessoas (ADR 0007, decisão 8: a exceção de acesso amplo do
`admin_tecnico`, concedida sobre estrutura organizacional pela Emenda 1
da ADR 0005, não se estende por herança a domínio de dado pessoal). Esta
ADR reafirma essa negação para Jornada e Ponto pela mesma lógica — não
por analogia automática, mas porque o domínio (dado de
comportamento/presença) está na mesma categoria de sensibilidade que
motivou a negação em Pessoas.

**`gestor` permanece negado**, porque seu escopo segue indefinido
(ADR 0006, decisão 8, DP-8) — esta ADR não antecipa nem resolve essa
pendência. **`colaborador`, `financeiro`, `auditor` e `dpo` permanecem
negados** — nenhum recebe acesso por analogia com o que já tem em outro
domínio.

**Esta é concessão limitada à V1, não acesso global.** Não cria acesso
cross-company (RH/DP de uma empresa não acessam dado de Jornada e Ponto
de outra), nem acesso a dado ou documento fora deste módulo (a concessão
não se estende, por analogia, a nenhum outro domínio existente ou
futuro).

### 7. Competência mensal, sem motor de cálculo (Baseline decisão 6)

Apuração, nesta V1, é agrupamento organizacional de eventos e ajustes por
mês — nenhum resultado de negócio (hora extra, banco de horas, adicional
noturno, DSR, jornada legal, integração com folha) é produzido ou
aprovado por esta decisão. Essas regras seguem, sem exceção, fora de
escopo (spec §4), sujeitas a decisão jurídica futura (DP-3J-09) e de
produto (DP-3J-08).

### 8. Sem aprovação nem fechamento legal nesta V1 (Baseline decisão 7)

Nenhum workflow de aprovação, aprovação por gestor ou fechamento com
efeito legal é aprovado. O único controle disponível nesta V1 é
auditoria de quem registrou (decisão 6) e correção por ajuste rastreável
(decisão 5) — não uma segunda revisão humana antes do registro produzir
efeito. Este é o mesmo modelo de risco aceito já registrado pela ADR 0007
(Fatia 2, decisão de produto 7: sem workflow de aprovação, RH/DP
autorizados registram, sempre auditado).

## Gate de dados reais (Baseline decisão 8)

Nenhuma das oito decisões acima autoriza dado real, piloto ou produção.
Permanecem bloqueados, sem alteração por esta ADR:

- **MFA (TOTP)**, obrigatório antes de qualquer piloto com dado real ou
  produção (ADR 0003, decisão 3) — esta ADR não relaxa essa condição em
  nenhum grau; a agrava, por Jornada e Ponto tratar de dado de
  comportamento/presença.
- **Validade legal e requisitos regulatórios aplicáveis** (DP-3J-09) —
  decisão exclusivamente jurídica, não endereçada aqui.
- **Retenção, descarte e acesso do titular** (DP-3J-11) — decisão de
  DPO/jurídico, não endereçada aqui.
- **Confirmação formal de DPO** sobre base legal e finalidade do núcleo
  de dado operacional (spec §5.1) para uso com titular real.

## Alternativas descartadas

| Alternativa                                                                                                     | Por que foi descartada                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aprovar já um modelo de escala complexa (turno, revezamento)                                                    | Sem caso de uso real ainda testado, modelar múltiplos padrões de escala nesta V1 seria especulação — mesmo princípio de dependência mínima já seguido desde a ADR 0001. Descartado; escala complexa fica para quando houver necessidade comprovada.                                                                                          |
| Catálogo de eventos aberto/extensível por configuração já nesta V1                                              | Um catálogo aberto sem revisão de produto correria o risco de crescer por conveniência de implementação, repetindo o problema já identificado em Colaboradores (ADR 0007, decisão 1, RI-F2-1: dado entrando por conveniência, não por decisão). Catálogo fechado de quatro valores, extensível só por decisão futura própria, foi preferido. |
| Permitir alguma origem automatizada (ex.: leitura de dispositivo confiável) já nesta V1, mesmo que simplificada | Qualquer origem automatizada introduz superfície de dado de dispositivo/localização, exatamente o vetor que a especificação (§5.1) isolou como "potencialmente sensível" e pendente de decisão própria (DP-3J-10). Descartado — só registro manual interno nesta V1.                                                                         |
| Aceitar campo de observação em texto livre no ajuste, com aviso de não incluir dado sensível                    | Um aviso não é controle — a experiência já registrada em Movimentação Funcional (ADR 0007) mostrou que o risco de dado sensível em campo de observação livre é concreto o suficiente para não repetir o padrão. Descartado em favor de catálogo controlado, mesmo que o catálogo específico do ajuste seja detalhe de modelagem futura.      |
| Conceder leitura a `auditor`/`dpo` nesta V1, por já lerem `access_log`                                          | Ler a trilha de auditoria (`access_log`) é escopo diferente de ler o dado de Jornada e Ponto em si — conceder por analogia repetiria o erro já corrigido em Pessoas, onde nenhum papel recebe acesso por semelhança com o que tem em outro domínio. Descartado.                                                                              |
| Aprovar fechamento como controle de estado simples, sem efeito legal, já nesta V1                               | Mesmo um "fechamento sem efeito legal" exigiria decidir semântica de reabertura, quem fecha e o que acontece com evento/ajuste após o fechamento — decisões não fechadas por esta Baseline (DP-3J-05 quanto a "quem fecha"). Descartado; fechamento fica inteiramente fora da V1.                                                            |
| Tratar esta ADR como liberação para iniciar a fase Implementar                                                  | O enunciado da tarefa que originou esta ADR é explícito: fase "Registrar decisão aprovada", não "Implementar". Autorizar início de código aqui extrapolaria o mandato desta decisão. Descartado — início de implementação exige autorização própria, futura e separada.                                                                      |

## Consequências

- A especificação
  ([docs/modules/etapa3-jornada-ponto-rastreavel-estrutural.md](../modules/etapa3-jornada-ponto-rastreavel-estrutural.md))
  é atualizada para refletir esta Baseline V1: fora de escopo (§4),
  segurança e LGPD (§5), matriz de acesso preliminar (§7), decisões
  pendentes (§9) e critérios de saída (§11) — sem que nenhuma delas passe
  a autorizar código, schema ou infraestrutura.
- Uma futura fase Implementar, se e quando autorizada separadamente, terá
  o núcleo mínimo de decisões de produto resolvido: catálogo de evento,
  origem, mecanismo de correção, matriz de acesso mínima e granularidade
  de competência — sem precisar resolvê-los durante a implementação.
- DP-3J-01 (modelo de jornada/escala), DP-3J-07 (importação TXT),
  DP-3J-08 (integração com folha), DP-3J-09 (validade legal), DP-3J-10
  (biometria/geolocalização/dispositivo), DP-3J-11 (retenção/descarte/
  acesso do titular) e DP-3J-12 (escopo de `gestor`) permanecem
  pendentes, sem resolução por inferência desta ADR.
- Nenhuma tabela, migration, endpoint, model Prisma, dependência ou
  contrato de API é criado, alterado ou comprometido por esta ADR — os
  nomes conceituais usados na especificação (`EventoPonto`, `AjustePonto`
  etc.) continuam sujeitos a revisão na fase de modelagem real.

## Controles de segurança

- **Menor privilégio inalterado:** nenhuma decisão desta ADR concede
  acesso amplo; `empresaId`, via `VinculoFuncional`, continua a única
  fronteira de autorização.
- **Negação por padrão:** a matriz da especificação (§7) passa a ter duas
  células preenchidas (RH e DP, registrar/consultar); todas as demais
  permanecem negadas ou pendentes — nunca preenchidas por analogia.
- **Sem exclusão física:** evento de ponto é imutável por princípio
  (decisão 5); correção é sempre aditiva.
- **Sem novo caminho de dado sensível:** origem única (registro manual) e
  ajuste sem texto livre (decisões 4 e 5) fecham, nesta V1, os dois
  vetores mais óbvios de entrada de dado não classificado.

## Itens fora de escopo desta ADR

- **Schema, migration, endpoint, dependência ou infraestrutura** — nada
  disso é criado, alterado ou autorizado por esta ADR.
- **Escala complexa, aprovação, fechamento legal, cálculo trabalhista,
  importação TXT, integração com folha, biometria, geolocalização,
  dispositivo** — todos permanecem fora desta V1, ver Baseline decisões
  1, 3, 6, 7 e §2 do documento de decisão.
- **Escopo do papel `gestor`** — depende de DP-8 (ADR 0006), não
  endereçada por esta ADR.
- **MFA** — regido integralmente pela ADR 0003, decisão 3, inalterada.

**Esta ADR não declara conformidade LGPD concluída, aprovação jurídica
ou validade trabalhista.** Ela trata exclusivamente de decisões de
produto para o núcleo conceitual desta V1; validade legal, retenção e
tratamento de dado potencialmente sensível continuam registrados como
pendências explícitas, tanto na especificação (§9) quanto no documento de
decisão (§2).

## Gatilhos de reavaliação

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. DP-8 (ADR 0006, escopo de `gestor`) for resolvida e o produto quiser
   avaliar um fluxo de aprovação ou visibilidade de `gestor` sobre
   Jornada e Ponto.
2. Jurídico/DPO confirmarem validade legal (DP-3J-09) e política de
   retenção/descarte (DP-3J-11) — pré-requisito para qualquer decisão
   sobre dado real.
3. Produto decidir avançar sobre importação TXT (DP-3J-07), integração
   com folha (DP-3J-08) ou tratamento de biometria/geolocalização/
   dispositivo (DP-3J-10) — cada um exige decisão própria, não
   consequência automática desta Baseline.
4. Uma fase Implementar for formalmente autorizada — o que, por si só,
   não decorre desta ADR.

## Responsabilidades

- **Time de desenvolvimento (código):** ao iniciar, se e quando
  autorizada, uma fase Implementar, respeitar as oito decisões desta
  Baseline sem ampliar escopo por conveniência de implementação — em
  particular, não introduzir origem automatizada, campo de texto livre em
  ajuste, ou célula de acesso além de RH/DP sem decisão própria.
- **Produto:** resolver DP-3J-01, DP-3J-07, DP-3J-08, DP-3J-10 e
  DP-3J-12 conforme a necessidade surgir; nenhuma delas é bloqueante para
  o núcleo já aprovado desta Baseline.
- **TI/Segurança:** revisar, antes de qualquer fase Implementar, que
  nenhuma checagem de autorização conceda acesso além de RH/DP por
  empresa, e que `admin_tecnico` permaneça negado.
- **DPO/jurídico:** resolver DP-3J-09 (validade legal) e DP-3J-11
  (retenção/descarte/acesso do titular) antes de qualquer piloto com dado
  real — pré-requisito explícito, não relaxado por esta ADR.
- **Revisor de PR (quando houver código futuro):** bloquear merge que
  implemente escala complexa, aprovação, fechamento legal, cálculo
  trabalhista, origem automatizada de evento, texto livre em ajuste, ou
  acesso além de RH/DP por empresa, sem decisão de produto própria e
  registrada.

## Limitações

- Esta ADR **não autoriza início de código, schema, migration,
  endpoint, dependência ou infraestrutura** — nenhuma fase Implementar é
  aberta por este documento.
- Não resolve DP-3J-01 (modelo final de jornada/escala), DP-3J-07
  (importação TXT), DP-3J-08 (integração com folha), DP-3J-09 (validade
  legal), DP-3J-10 (biometria/geolocalização/dispositivo), DP-3J-11
  (retenção/descarte/acesso do titular) nem DP-3J-12 (escopo de
  `gestor`) — todas seguem pendentes.
- Não estende nem relaxa MFA (ADR 0003) ou o modelo de auditoria
  (ADR 0004) — ambos permanecem integralmente aplicáveis quando/se este
  domínio for implementado.
- Não introduz nenhuma tabela, campo pessoal, enum de banco ou contrato de
  API real — os conceitos desta Baseline continuam sendo especificação,
  não implementação.
