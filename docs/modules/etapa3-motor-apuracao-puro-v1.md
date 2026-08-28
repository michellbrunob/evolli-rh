# Etapa 3 — Motor puro de apuração diária de jornada e banco de horas (Ponto V1)

- Status: **Decisões registradas + núcleo puro implementado (T050).** O documento
  registra três decisões novas (§2) e especifica o **contrato do motor puro**
  (§3–§6) cujo núcleo TypeScript foi implementado em
  `apps/api/src/ponto/apuracao/` **exclusivamente com dados sintéticos**.
  Permanecem **fora** e como gates: parser AFD, lote de importação, associação
  por CPF, banco/persistência, endpoint, API, UI, cálculo financeiro,
  quitação/pagamento de banco, fechamento, espelho, assinatura e dado real.
- Data: 2026-08-28 (T050).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T050** (motor puro de apuração diária,
  só dado sintético).
- Base factual (não reaberta):
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2 modelo conceitual, §2.5 apuração, §2.6 apontamento/almoço, §2.8 banco),
  [Caderno de homologação da apuração](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  (T049 — §2 regras decididas/hipóteses/pendências, §4 cenários, §5 QH-01, §8
  recorte da T050), [Contrato técnico do parser AFD](etapa3-parser-afd-contrato-tecnico-v1.md)
  (T040/T041 — padrão de núcleo puro),
  [Contrato do lote de importação AFD](etapa3-lote-importacao-afd-contrato-v1.md)
  (T042), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1),
  [Nota de convergência com a CCT 2026/2027](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md)
  (T050 — complemento). Fundação de horários: `apps/api/src/horarios/` (T038).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only — não tocada por um núcleo puro),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (`empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico), [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (`DS-OPS-01`), [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, testável, aprovada pelo responsável); Princípio III (domínio e
  cálculo no limite domínio/aplicação, independente de HTTP/Prisma/UI);
  Princípio IV (cenários determinísticos, dado sintético, sem transformar
  interpretação não confirmada em regra de produção); Princípio II/V (MFA,
  auditoria e gates de dado real preservados).

## 0. Natureza e limites deste documento

Este documento faz duas coisas: **(a)** registra **três decisões** recebidas
para a apuração de jornada e banco de horas (§2); **(b)** especifica o
**contrato de um motor puro de apuração diária** (§3–§6), cujo **núcleo** foi
implementado como **módulo TypeScript puro** em `apps/api/src/ponto/apuracao/`,
seguindo o mesmo padrão do parser AFD (T041): **sem NestJS, Prisma, I/O, banco,
rede, log ou variáveis de ambiente**, operando **somente sobre dados
sintéticos** fornecidos em memória.

**Invariável neste documento e no núcleo implementado:**

- **Não calcula dinheiro:** nenhum valor monetário, DSR financeiro, reflexo
  salarial, quitação/pagamento de banco, integração com Folha, fechamento,
  espelho ou assinatura é produzido. O motor devolve **minutos** e
  **apontamentos não financeiros**.
- **Não persiste, não integra, não faz I/O:** o motor não grava banco de horas,
  não lê arquivo, não chama parser/lote/rede, não associa CPF a colaborador e
  não mantém saldo acumulado — apenas o **impacto diário proposto** (crédito e
  débito do dia, componentes separados).
- **Não usa dado real:** nenhum nome, CPF, empresa real, arquivo ou print.
  Marcações, faixas e classificações são **sintéticas**.
- **Não declara conformidade** com a **Portaria MTP 671** nem faz interpretação
  jurídica/trabalhista. A **semântica de apuração** definida aqui é a **regra do
  motor V1 para dado sintético** — candidata à homologação (QH-01,
  [caderno §5.1](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)) —,
  **não** uma declaração de validade legal (validade legal segue em `DP-3J-09`).
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros;
  retenção/base legal seguem pendentes (`DP-3J-11`, `DP-3J-09`).

## 1. Relação com a Baseline, a detalhada e o caderno

A [Baseline V1 (ADR 0008)](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
aprovou "competência mensal **sem motor de cálculo**". A
[detalhada](etapa3-jornada-ponto-v1-detalhada.md) e o
[caderno de homologação (T049)](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
especificaram as regras como **alvo** e prepararam os **cenários** e as
**questões de homologação**. Esta T050 implementa um **motor puro** que executa
essas regras **sobre dado sintético**, coerente com o recorte do
[caderno §8](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
("a T050 poderá implementar a classificação e o cálculo estrutural, só com dado
sintético; permanece bloqueada de dinheiro, importação, associação por CPF,
persistência e dado real"). O motor **não** revoga a Baseline: nenhum resultado
entra em produção, em Folha ou em dado real — é um **núcleo determinístico e
testável**, isolado.

## 2. Decisões registradas nesta tarefa

### D1 — Horário 2 permanece cadastrado, inicialmente inativo/não atribuível no V1

- O horário **2 (HORARIO LIBERTY)** — cujos **marcos não foram recebidos**
  (`DP-3J-22`, [detalhada §9](etapa3-jornada-ponto-v1-detalhada.md)) — **permanece
  cadastrado**, porém **inicialmente inativo / não atribuível** no V1. Sem marcos,
  ele não tem jornada planejada para a apuração comparar, então **não** pode ser
  atribuído a colaborador até que seus marcos sejam recebidos e homologados.
- **RH pode habilitar/desabilitar tabelas de horário por empresa**, respeitando
  a fronteira `empresa_id` ([detalhada §1.4, §2.4](etapa3-jornada-ponto-v1-detalhada.md)).
  A **desativação é lógica** (sem exclusão física), coerente com a fundação de
  horários já implementada (T038, [detalhada §2.4](etapa3-jornada-ponto-v1-detalhada.md)).
- **Habilitar/desabilitar uma tabela não reabre períodos já apurados**: a
  imutabilidade do dia apurado (R14 do
  [caderno §2.1](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md);
  [detalhada §2.4](etapa3-jornada-ponto-v1-detalhada.md)) permanece — a mudança
  de estado de uma tabela vale **dali em diante**, nunca retroativamente.
- **Escopo desta decisão:** registro de política. Os **marcos** dos horários
  **1, 2 e 19** seguem **pendentes** (`DP-3J-22`); D1 não os recebe nem os
  infere — apenas fixa que o horário 2 fica **inativo/não atribuível** enquanto
  isso. Nenhuma alteração de schema, migration ou código de `horarios` é feita
  por esta decisão (a desativação lógica já é suportada pela fundação T038).

### D2 — Hora extra positiva entra exclusivamente no banco de horas

- O **crédito de hora extra** (diferença positiva do dia) entra
  **exclusivamente no banco de horas** — **não** vira pagamento, valor monetário
  ou reflexo em Folha nesta fatia (coerente com R6/R9 do
  [caderno §2.1](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  e [detalhada §2.8](etapa3-jornada-ponto-v1-detalhada.md)).
- O crédito de hora extra **não compensa nem apaga** débito de atraso/saída
  antecipada: crédito e débito são **componentes separados** do impacto diário
  (§4.3). O saldo corrente do banco é consequência da soma dos movimentos ao
  longo do tempo — **fora** do escopo deste motor diário.

### D3 — Pagamento futuro de saldo positivo zera o saldo corrente, preservando histórico auditável

- Um **eventual pagamento futuro** de saldo positivo de banco de horas **zera o
  saldo corrente**, mas **preserva o histórico auditável** dos movimentos que o
  compuseram (movimento de quitação é **aditivo**, nunca apaga histórico —
  mesmo princípio de imutabilidade da ADR 0004 e da R16 do caderno).
- Este pagamento **não calcula valor monetário nem integra Folha** (R9). O
  **valor** de uma eventual quitação depende da futura **Folha** + **Jurídico** +
  autorização da **Diretoria** (`DP-3J-21`, cálculo financeiro — inalterado).
- **Escopo:** decisão de **ciclo de vida do banco**, registrada para orientar
  modelagem futura. **Não** é implementada por este motor: o motor diário
  produz apenas o **impacto do dia**, **nunca** o saldo acumulado, a quitação ou
  o pagamento (§6.2).

> As decisões D2 e D3 **detalham** o banco de horas já recebido
> ([detalhada §2.8](etapa3-jornada-ponto-v1-detalhada.md); R6/R7 do
> [caderno](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)) e
> **não** reabrem `DP-3J-21` (cálculo financeiro), que segue com Diretoria +
> Folha + Jurídico. D1 **não** resolve `DP-3J-22` (marcos dos horários), que
> segue com o RH.

> **Ponteiro (T051).** O **ciclo de vida** do Banco de Horas (extrato, saldo
> derivado, movimentos, invariantes e os estados conceituais da **quitação
> futura** que materializa D3 — evento rastreável que zera o saldo sem apagar
> movimentos) está especificado, **somente como documentação**, no
> [contrato do ciclo de vida do Banco de Horas V1](etapa3-banco-horas-ciclo-vida-contrato-v1.md).
> Este motor continua produzindo apenas o **impacto do dia**; saldo, quitação e
> pagamento seguem **fora** dele.

## 3. Contrato do motor puro — entrada

O motor recebe, **por dia e por vínculo** (o chamador já resolveu empresa,
colaborador e a versão de horário vigente — fora deste núcleo), uma estrutura
sintética com:

- **Jornada prevista por faixas de trabalho** (`faixasPrevistas`): lista
  ordenada de faixas `{ inicio, fim }` em `"HH:MM"` 24h, cada faixa um bloco de
  trabalho previsto (o intervalo entre faixas é a pausa, ex.: almoço).
- **Marcações sintéticas** (`marcacoes`): lista **cronológica** de instantes
  `"HH:MM"`, pareados sequencialmente (1ª entrada, 2ª saída, 3ª entrada, …). Não
  há marca de tipo entrada/saída — o pareamento é por ordem (como num REP).
- **Classificação sintética do dia** (`classificacao`): um valor do catálogo
  fechado (§5) — a classificação é **entrada** do motor, **não** é inferida por
  ele.
- **Almoço livre** (`almocoLivre`, opcional): quando verdadeiro, aplica a regra
  de intervalo mínimo de 1h (§4.4).

O motor **não** recebe empresa, CPF, nome, arquivo, hash ou qualquer dado real —
só as estruturas sintéticas acima.

## 4. Contrato do motor puro — cálculo

Todas as durações são em **minutos** (inteiros). O motor calcula, **de forma
determinística e separada**:

### 4.1 Tempo efetivo trabalhado e jornada computada

- **Tempo efetivo trabalhado** = soma dos blocos reais trabalhados
  `Σ (saída_k − entrada_k)`, a partir das marcações **como vieram** (sem ajuste
  de almoço).
- **Jornada computada** = tempo trabalhado **após** o ajuste de almoço livre
  (§4.4). Sem almoço livre (ou com intervalo ≥ 1h), jornada computada = tempo
  efetivo trabalhado.

### 4.2 Desvios por faixa (base do crédito e do débito)

Para cada faixa prevista `i` `[iniPrev_i, fimPrev_i]` e o par de marcações
correspondente `[ent_i, sai_i]` (usando a **entrada efetiva** `ent'_i` do §4.4):

- **débito parcial** `= max(0, ent'_i − iniPrev_i)` (atraso) `+ max(0, fimPrev_i − sai_i)` (saída antecipada);
- **crédito parcial** `= max(0, iniPrev_i − ent'_i)` (entrada/retorno adiantado) `+ max(0, sai_i − fimPrev_i)` (saída após o previsto).

`diferençaNegativaBruta` = soma dos débitos parciais do dia.
`créditoHoraExtra` = soma dos créditos parciais do dia.

### 4.3 Tolerância de 15 minutos por dia (semântica exata)

Aplicada **por dia**, sobre a **soma** de atrasos e saídas antecipadas
(`diferençaNegativaBruta`), coerente com R3 do
[caderno](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md):

- **Se `diferençaNegativaBruta ≤ 15`** → **sem débito** (débito = 0) e o dia é
  computado como **jornada regular** (tolerância absorve o desvio).
- **Se `diferençaNegativaBruta > 15`** → **débito sobre toda a diferença
  negativa do dia** (o valor inteiro), **não** apenas sobre o excedente aos 15
  minutos.
- **Hora extra não compensa nem apaga atraso:** o crédito de hora extra (§4.2)
  **não** é abatido do débito nem o reduz. `créditoHoraExtra` e
  `débitoAtrasoSaídaAntecipada` permanecem **componentes separados** do impacto
  diário — nunca colapsados num único líquido que esconda um deles.

### 4.4 Almoço livre (intervalo mínimo de 1h)

Quando `almocoLivre` é verdadeiro, cada **intervalo entre faixas consecutivas**
com duração real **inferior a 1h** é **considerado 1h para a apuração**
([detalhada §2.6](etapa3-jornada-ponto-v1-detalhada.md); R4 do caderno). A
implementação empurra a **entrada efetiva** do bloco seguinte para
`max(entrada_k, saída_{k−1} + 60min)`, de modo que o tempo "trabalhado" durante
o almoço curto **sai** da jornada computada e reaparece, pela conta de desvios
(§4.2), como menos crédito ou mais atraso — **sem** regra de compensação
inventada. (Para dias de faixa única não há intervalo entre faixas; a regra não
tem efeito.)

### 4.5 Alerta não financeiro de jornada acima do limite diário configurado

Quando o chamador fornece `limiteJornadaDiariaMinutos`, o motor **sinaliza** —
com o apontamento não financeiro `alerta_jornada_diaria_excedida` — os dias
`regular` cuja **jornada computada** ultrapassa esse limite. O limite é
**configuração do chamador**, **nunca** um valor legal fixado no código
(coerente com a [nota de convergência com a CCT](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md),
C4/C6): o motor **não interpreta** a CCT nem declara limite legal. O alerta
**não bloqueia**, **não calcula pagamento** e **não** altera crédito/débito —
apenas acrescenta um sinalizador para tratamento humano.

## 5. Classificações sintéticas do dia

Catálogo **fechado** (sem texto livre; alinhado a R12 do caderno e à ADR 0008
dec. 5). A classificação é **entrada** do motor:

| Classificação         | Débito de banco                                             | Crédito | Apontamento                                                                |
| --------------------- | ----------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `regular`             | Conforme §4.3 (tolerância; toda a diferença > 15)           | §4.2    | —                                                                          |
| `falta_justificada`   | **Sem débito**                                              | —       | —                                                                          |
| `falta_injustificada` | **Débito da jornada prevista**                              | —       | **Sinalizador não financeiro de DSR**                                      |
| `feriado`             | **Sem débito**                                              | —       | **Sinalizador não financeiro de feriado trabalhado** (se houver marcações) |
| `folga`               | **Sem débito**                                              | —       | —                                                                          |
| `ferias`              | **Sem débito**                                              | —       | —                                                                          |
| `compensacao`         | **Débito proposto da jornada prevista** (sem validar saldo) | —       | —                                                                          |

- **`falta_injustificada`:** débito igual à **jornada prevista** total do dia +
  um **apontamento não financeiro** de desconto de DSR (sinalizador, coerente
  com R8; **nunca** valor financeiro — R9, `DP-3J-21`).
- **`compensacao`:** gera **débito proposto** da jornada prevista no banco,
  **sem validar saldo disponível** nesta tarefa (a validação de saldo e a
  semântica de compensação seguem para modelagem futura — [caderno §4, CEN-13](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)).
- **`feriado`/`folga`/`ferias`/`falta_justificada`:** **sem débito de banco**;
  o motor não credita nem debita. Em **feriado**, o motor **não** trata o dia
  como operação regular automática (trabalho em feriado é pendente —
  [caderno §4, CEN-12](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)):
  se houver marcações, emite o apontamento não financeiro
  `feriado_trabalhado_sinalizado` para tratamento manual do RH, **sem** calcular
  crédito, débito ou qualquer valor (nota de convergência com a CCT, C4).

## 6. Saída, falha segura e o que permanece fora

### 6.1 Saída

Resultado como **união discriminada** por `status`:

- `{ status: "invalido", erro }` — entrada malformada (§6.3), falha segura.
- `{ status: "apurado", … }` — com os componentes **separados**: jornada
  prevista, tempo efetivo trabalhado, jornada computada, crédito de hora extra,
  débito por atraso/saída antecipada, diferença negativa bruta (pré-tolerância),
  indicador de tolerância aplicada, **impacto diário ao banco**
  (`{ créditoMinutos, débitoMinutos }` — separados) e **apontamentos** não
  financeiros (catálogo, sem texto livre).

### 6.2 O que o motor **não** produz (fora de escopo, por decisão)

- **Saldo acumulado** de banco, **quitação/pagamento** (D3), **fechamento**,
  **espelho** e **assinatura** — o motor devolve apenas o **impacto do dia**.
- **Valor monetário**, **DSR financeiro**, **Folha** — nunca (R9, `DP-3J-21`).
- **Associação por CPF, parser AFD, lote de importação, persistência, endpoint,
  API, UI** — o motor recebe estruturas já sintéticas e devolve estruturas em
  memória; não cruza nenhuma dessas fronteiras
  ([lote §2](etapa3-lote-importacao-afd-contrato-v1.md), camadas 3–5).

### 6.3 Falha segura (entrada inválida)

O motor **rejeita com segurança** (`status: "invalido"`), sem lançar exceção não
tratada, quando: horário fora de `"HH:MM"`; faixa com fim ≤ início; faixas
sobrepostas ou fora de ordem; marcação fora de `"HH:MM"`; marcações fora de
ordem cronológica ou repetidas; em dia `regular`, número de marcações
incompatível com as faixas (não pareável); ou intervalo de almoço que, após o
ajuste de 1h, inverteria um bloco. O erro carrega apenas um **código seguro** —
**nunca** dado sensível (não há dado pessoal neste núcleo, por construção).

## 7. Testes (todos sintéticos)

O núcleo tem testes unitários (`apuracao.spec.ts`) cobrindo:

- os **três cenários homologados** recebidos (dia normal; atraso + hora extra;
  falta/feriado/folga/compensação), como estruturas sintéticas;
- **tolerância de 15 min** e **ultrapassagem** (débito sobre toda a diferença);
- **atraso + hora extra** sem compensação automática (crédito e débito separados);
- **almoço livre** com intervalo inferior a 1h;
- **todas as classificações** do dia (§5);
- **faixas múltiplas**;
- **entradas inválidas / ordem inválida**, com **falha segura**;
- **ausência de dependências de framework** e de dados reais (o núcleo importa
  apenas seus próprios tipos; sem NestJS/Prisma/I/O).

## 8. Gates preservados

Nenhum gate é relaxado por esta tarefa. Permanecem **exatamente como estavam**:
`DP-3J-09` (validade legal), `DP-3J-11` (retenção/descarte), `DP-3J-18` (três
exemplos completos — a semântica do motor é candidata, não homologação legal),
`DP-3J-20` (fornecedor/leiaute), `DP-3J-22` (marcos dos horários 1/2/19), o
**cálculo financeiro** de `DP-3J-21`, além de **MFA** (ADR 0003) e `DS-OPS-01`.
Enquanto abertos, **nenhum dado real** entra em nenhum ambiente.

## 9. Declaração

Esta T050 **registra três decisões** (horário 2 inativo/não atribuível com
habilitação por empresa sem reabrir apurações; hora extra positiva exclusivamente
no banco; pagamento futuro de saldo positivo zera o saldo corrente preservando
histórico, sem calcular dinheiro nem integrar Folha) e **implementa um motor
puro de apuração diária** em `apps/api/src/ponto/apuracao/`, **TypeScript puro,
só com dados sintéticos**, que calcula — separadamente — tempo efetivo, jornada
computada, crédito de hora extra, débito por atraso/saída antecipada, impacto
diário ao banco e apontamentos não financeiros, aplicando a tolerância de 15
minutos por dia e o almoço livre conforme especificado. **Nenhum valor
monetário, DSR financeiro, Folha, quitação/pagamento de banco, saldo acumulado,
fechamento, espelho, assinatura, parser, lote, associação por CPF, persistência,
endpoint, API, UI ou dado real** é produzido. **Não declara** conformidade com a
**Portaria MTP 671** nem faz interpretação jurídica/trabalhista; a semântica do
motor é **candidata à homologação** (QH-01), não validade legal. **Não altera**
`apps/web`, schema, migrations, dependências, MFA ou `DESIGN-apple.md`, e **não
relaxa** nenhum gate de dado real.
