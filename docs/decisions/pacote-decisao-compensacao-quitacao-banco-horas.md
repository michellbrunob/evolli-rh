# Pacote de decisão — Registro efetivo de compensação e futura quitação de Banco de Horas

- Status: **aguardando aprovação** — este é um **formulário de decisão** para
  **RH**, **Jurídico** e **Folha** (com TI/Segurança onde indicado).
  **Nenhum item abaixo está aprovado.** O documento **estrutura** as decisões em
  campos objetivos; ele **não decide, não infere e não preenche** nenhuma
  resposta. Onde um valor é necessário, aparece como **campo a preencher**,
  nunca sugerido.
- Data de emissão: 2026-08-31 (T055).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T055** (pacote de decisão de
  compensação/quitação de Banco de Horas). **Somente documentação — nenhum
  código, schema, endpoint, UI ou dado real.**
- Relação com o registro de pendências: este pacote é a **forma de aprovação**
  das pendências **BH-01..08** já catalogadas no
  [contrato do ciclo de vida do Banco de Horas V1](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md)
  (T051) e no
  [contrato da compensação de Banco de Horas V1](../modules/etapa3-banco-horas-compensacao-contrato-v1.md)
  (T053). **Os identificadores são reusados**, não recriados: aprovar um item
  aqui é aprovar a pendência de mesmo ID.
- Base factual (não reaberta):
  [Motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md) (T050),
  [Contrato do ciclo de vida do Banco de Horas V1](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md)
  (T051; núcleo de extrato T052),
  [Contrato da compensação de Banco de Horas V1](../modules/etapa3-banco-horas-compensacao-contrato-v1.md)
  (T053; núcleo de propostas T054).
- Âncoras de governança (não reabertas): [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md)
  (MFA antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (`empresa_id`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico; `master_tecnico` sem mutação trabalhista),
  [pacote de decisão de segurança operacional](pacote-decisao-seguranca-operacional.md)
  (`DS-OPS-01`), [glossário Reserva Fiscal](glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável — não inventada); Princípio II
  (privacidade/menor privilégio; MFA antes de dado real); Princípio IV (dado
  sintético; sem transformar interpretação não confirmada em regra); Princípio V
  (auditoria append-only, segregação de funções).

## 0. Como usar este formulário

1. Cada decisão (§3) tem campos **vazios**: responsável decisor, consultados,
   opções possíveis, impacto operacional, evidência necessária, data, aprovação
   e **status** (inicia **Pendente**).
2. Preencher os campos e registrar a aprovação é o **ato de decisão**; até lá o
   status permanece **Pendente**.
3. Os **gates** (§4) dizem o que **não** pode ser implementado enquanto certas
   pendências estiverem abertas.

**Limites deste pacote (invioláveis):**

- **Não implementa** `debito_compensacao` persistido, endpoint, UI funcional,
  integração com Folha, schema, migration ou configuração; **não cria** código.
- **Não infere** validade de crédito, ordem de consumo, política de saldo
  negativo, alçada, documento, interface de Folha, retenção ou base legal.
- **Não calcula** dinheiro, valor monetário, salário, adicional, DSR financeiro
  ou Folha; **não declara** conformidade com a **CCT** ou a **Portaria 671**.
- **Não usa dado real:** só referências e exemplos **sintéticos** — sem CPF,
  nome, empresa real, arquivo, print ou dado pessoal.

## 1. Estado atual (o que já existe, tudo sintético)

- **T050** apura a jornada diária **sintética** (motor puro): produz crédito de
  hora extra e débito de atraso/saída **separados**, em minutos, sem dinheiro.
- **T052** gera o **extrato e o saldo derivado sintético** (núcleo puro): saldo é
  a soma assinada de movimentos imutáveis, com crédito e débito separados.
- **T054** controla a **proposta/revisão sintética** de compensação (máquina de
  estados pura): `rascunho` → `submetida_para_revisao` →
  `aprovada_para_registro`/`recusada`/`cancelada`.
- **Nenhuma proposta aprovada cria débito, altera saldo, paga, quita ou integra
  com a Folha.** `aprovada_para_registro` é autorização para um **registro
  futuro** (T053 §2), ainda **não** implementado.

## 2. Regras já aprovadas (preservadas — não reabrir)

| #   | Regra preservada                                                                               | Origem                          |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| P1  | **RH é o operador trabalhista único**, restrito à **própria empresa**.                         | T051 B4 / T053 D4 / ADR 0008    |
| P2  | **`master_tecnico` sem mutação trabalhista**; DP, gestor e colaborador **negados**.            | ADR 0012 / T053 D5              |
| P3  | **Histórico append-only** e **saldo derivado** de eventos imutáveis.                           | T051 §4 / T052 / ADR 0004       |
| P4  | **Proposta aprovada não é movimento** — não altera saldo nem extrato.                          | T053 §2/§5                      |
| P5  | **Crédito e débito permanecem separados** — sem compensação automática.                        | T050 D2 / T051 B2 / T053 D2     |
| P6  | **Limites +38h / −24h somente alertam** — não bloqueiam nem decidem.                           | T049 R5 / T051 B3 / T053 D6     |
| P7  | **Ponto não calcula pagamento, valor monetário, salário, adicional, DSR financeiro ou Folha.** | T050 D3 / T051 B7 / T053 D7     |
| P8  | **Nenhuma conformidade com a CCT ou a Portaria 671 é declarada.**                              | CCT (nota) / T050 / T051 / T053 |

Estas regras **não** são objeto de decisão deste pacote — são âncoras que as
decisões abaixo **devem respeitar**.

## 3. Decisões a tomar (campos vazios — status Pendente)

Cada decisão reusa o ID da pendência de origem. **Nenhuma opção abaixo é
sugerida como correta**; as listas de "opções possíveis" ficam **a preencher**
pelo responsável.

### 3.1 BH-01 — Validade/expiração de créditos

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.2 BH-02 — Ordem de consumo dos créditos

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.3 BH-03 — Política para saldo negativo

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.4 BH-04 — Alçada final para autorizar o registro efetivo

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.5 BH-05 — Documento/evidência de compensação e quitação

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.6 BH-06 — Interface/evento de integração com a Folha

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.7 BH-07 — Retenção, descarte e base legal

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.8 BH-08 — Ajuste humano e seu controle

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.9 BH-REG — Quando uma proposta aprovada vira `debito_compensacao`

Decisão de **quando/como** uma proposta `aprovada_para_registro` (T054) se torna
um **movimento** `debito_compensacao` no extrato (T052) — o **registro efetivo**.

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

### 3.10 BH-QUIT — Como a futura quitação para Folha vira evento rastreável

Decisão de **como** uma quitação futura pela Folha se torna um **evento
rastreável** (saldo anterior, horas quitadas, saldo posterior, data,
responsável, referência técnica — T051 B6), **sem apagar histórico** e **sem**
calcular valor no Ponto.

- Responsável decisor: **\______**
- Consultados: **\______**
- Opções possíveis: **\______**
- Impacto operacional: **\______**
- Evidência necessária: **\______**
- Data: **\______**
- Aprovação: **\______**
- Status: **Pendente**

## 4. Gates (não relaxados)

- **Não implementar** `debito_compensacao` **persistido**, endpoint, **UI
  funcional** ou **integração com a Folha** enquanto **BH-03, BH-04, BH-05,
  BH-06 e BH-07** estiverem **Pendentes**.
- **MFA** (ADR 0003) e **`DS-OPS-01`** (gate-mestre de segurança operacional)
  continuam **pré-condições** para qualquer **dado real**.
- **Validação de RH + Jurídico** permanece **necessária** antes de qualquer
  implementação com efeito trabalhista ou dado real.
- Enquanto os gates acima estiverem abertos, **nenhum dado real** entra em
  nenhum ambiente, e os núcleos existentes (T050/T052/T054) permanecem
  **puros e sintéticos**.

## 5. Registro de decisão (resumo)

| ID      | Decisão                                                  | Status   |
| ------- | -------------------------------------------------------- | -------- |
| BH-01   | Validade/expiração de créditos                           | Pendente |
| BH-02   | Ordem de consumo dos créditos                            | Pendente |
| BH-03   | Política para saldo negativo                             | Pendente |
| BH-04   | Alçada final para autorizar registro efetivo             | Pendente |
| BH-05   | Documento/evidência de compensação e quitação            | Pendente |
| BH-06   | Interface/evento de integração com a Folha               | Pendente |
| BH-07   | Retenção, descarte e base legal                          | Pendente |
| BH-08   | Ajuste humano e seu controle                             | Pendente |
| BH-REG  | Quando proposta aprovada vira `debito_compensacao`       | Pendente |
| BH-QUIT | Como a quitação futura para Folha vira evento rastreável | Pendente |

## 6. Declaração

**Nenhuma decisão deste pacote está aprovada.** Cada item só passa de Pendente a
decidido mediante **evidência formal** da área responsável (RH, Jurídico, Folha,
TI/Segurança conforme o caso). Este documento **não implementa** nada, **não
cria** `debito_compensacao`, endpoint, UI ou integração com Folha, **não
calcula** valor monetário/DSR/salário/Folha, **não declara** conformidade com a
**CCT** ou a **Portaria 671** e **não usa** dado real. As regras já aprovadas
(§2) e os gates (§4) — **MFA**, `DS-OPS-01`, validação RH + Jurídico, e o bloqueio
de registro persistido/UI/Folha enquanto BH-03/04/05/06/07 seguem Pendentes —
permanecem **exatamente como estavam**.
