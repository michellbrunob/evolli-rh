# Etapa 3 — Caderno de homologação da apuração de jornada e banco de horas (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T049). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código,
  teste, schema, migration, endpoint, API, UI, parser, importação, associação
  por CPF, persistência, cálculo, banco de horas, DSR, fechamento, espelho ou
  assinatura aqui — apenas um **caderno de homologação** que transforma os
  requisitos já recebidos do RH em **casos de decisão/teste** para uma futura
  apuração.
- Data: 2026-08-28 (T049).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T049** (caderno de homologação da
  apuração de jornada e banco de horas V1).
- Base factual (não reaberta — este caderno **consolida**, não decide):
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2 modelo conceitual, §3 espelho, §5 fila "Verificar folhas", §8 pendências,
  §10 classificação das regras do RH),
  [Contrato técnico do parser AFD](etapa3-parser-afd-contrato-tecnico-v1.md)
  (T040/T041), [Contrato do lote de importação AFD](etapa3-lote-importacao-afd-contrato-v1.md)
  (T042), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA,
  sessão; decisão 3: MFA obrigatório antes de dado real),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria
  append-only via `AuditService.record()`, sem valor sensível em claro),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico como função responsável por privacidade; `master_tecnico` sem
  mutação trabalhista),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (MFA/segredos/backup — gates de dado real, `DS-OPS-01`),
  [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável; desenvolvedores não inventam);
  Princípio II (segurança/privacidade/menor privilégio; MFA antes de dado real);
  Princípio IV (cenários de referência e resultados esperados fornecidos pelo
  dono de negócio; nenhum código transforma interpretação não confirmada em
  regra de produção); Princípio V (auditoria append-only, segregação de
  funções).

## 0. Natureza e limites deste documento

Este é um **caderno de homologação**: um instrumento para o **RH** (dono de
negócio) transformar os requisitos de jornada e banco de horas **já recebidos**
em **casos de decisão e de teste** — de modo que uma futura fase Implementar de
**motor de apuração** (referida aqui como **T050**, §8) não precise **inferir**
nem **inventar** regra trabalhista. Ele **organiza** o que já existe; **não
cria** regra nova.

**Invariável neste documento:**

- **Não implementa nada:** sem código, teste, schema, migration, endpoint, API,
  UI, parser, importação, job, dependência ou configuração.
- **Não calcula nem infere resultado:** nenhum número trabalhista (horas do dia,
  saldo de banco, extra, atraso, falta, DSR) é produzido, arredondado ou
  antecipado. Onde um cenário precisaria de um resultado, o resultado é marcado
  como **pendente de homologação** (§4), nunca preenchido.
- **Não decide regra nova:** as regras **decididas** (§2.1) são transcritas
  **exatamente como já aprovadas** pelo RH (T035/T036/T037), com o ID da
  decisão de origem. Este caderno **não altera** nenhuma decisão existente.
- **Não usa dado real:** nenhum nome, CPF, empresa real, arquivo, batida ou
  print aparece aqui. Todos os cenários são **sintéticos e estruturais**;
  identificadores são abstratos (`Vínculo V-001`, `Empresa A`/`Empresa B`).
- **Não declara conformidade** legal, trabalhista ou LGPD — **inclusive quanto
  à Portaria MTP 671** (§7) — e **não faz interpretação jurídica/trabalhista**.

> **Relação com a Baseline V1 e com a detalhada.** A
> [Baseline V1 (ADR 0008)](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
> aprovou um núcleo **sem motor de cálculo e sem fechamento**. A
> [detalhada](etapa3-jornada-ponto-v1-detalhada.md) **ampliou** esse núcleo com
> requisitos do RH (tolerância, banco, fechamento, fila "Verificar folhas") —
> **especificados como alvo, não implementados**. Este caderno é o **passo
> seguinte de homologação**: prepara os casos de teste que o RH precisa
> completar (`DP-3J-18`) antes de qualquer motor. Onde a detalhada disse
> "semântica pendente", este caderno **mantém a pendência** e a formula como
> **questão de homologação (QH-\*)**, nunca como decisão nova.

## 1. Objetivo e como usar este caderno

1. **Separar** o que está **decidido**, o que é **hipótese** e o que é
   **pendência** (§2), para que ninguém trate um requisito recebido como regra
   homologada.
2. Oferecer uma **tabela de cenários sintéticos** (§4) que cubra a variedade de
   dias que a apuração terá de tratar, declarando **por cenário** o que **já
   pode ser testado** (estrutura/classificação) e o que **depende de decisão**
   (resultado numérico), **sem calcular**.
3. Consolidar as **questões de homologação (QH-\*)** que o RH precisa responder
   — e as demais decisões (Jurídico, Diretoria, TI) — **antes** de o motor
   (T050) existir (§5).
4. Delimitar com precisão o que a **T050 poderá** implementar **só com dados
   sintéticos** e o que **continuará bloqueado** (§8).

> As **questões de homologação (QH-\*)** deste caderno **não** são decisões nem
> pendências novas de produto: são o **detalhamento operacional** do que
> `DP-3J-18` (três exemplos completos) e as demais pendências abertas já exigem.
> Respondê-las é **ato do dono de negócio** (RH/Jurídico/Diretoria conforme o
> caso), registrado onde a pendência de origem vive — nunca inferido aqui.

## 2. Regras decididas × hipóteses × pendências

Esta separação é a espinha do caderno. Cada linha traz a **classificação** e o
**ID de origem** (decisão do RH por tarefa, ou pendência `DP-3J-*`), coerente
com a [detalhada §8, §10](etapa3-jornada-ponto-v1-detalhada.md).

### 2.1 Regras já aprovadas/decididas (transcrição, não nova decisão)

Registradas **exatamente** como aprovadas pelo RH; nenhuma é reaberta ou
recalibrada aqui.

| #   | Regra decidida                                                                                                                                                                                   | Origem                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| R1  | **Período de apuração de dia 26 a dia 25 do mês seguinte** — todo dia do mês (inclusive 29/30/31) pertence a um período; não há dia órfão.                                                       | T036 (DP-3J-14)                |
| R2  | **Fechamento no dia 25**, cobrindo o período de dia 26 (mês anterior) a dia 25 (mês atual); ação manual do RH, auditada; **efeito legal** não declarado.                                         | T037                           |
| R3  | **Tolerância diária de 15 minutos** (atraso, saída antecipada e almoço), com semântica **aplicada por dia** — não por batida nem por período.                                                    | T035 (DP-3J-13)                |
| R4  | **Almoço livre garante ≥ 1h**: quando o intervalo apurado for **inferior a uma hora**, a apuração **considera automaticamente uma hora mínima**.                                                 | T035 (DP-3J-16)                |
| R5  | **Alerta ao atingir +38h / −24h de banco**: o sistema **apenas gera alerta** — não bloqueia, compensa, desconta nem fecha automaticamente.                                                       | T035 (DP-3J-15)                |
| R6  | **Banco de horas (regras recebidas):** horas extras entram no banco; atrasos não compensados entram no banco; saldo positivo permanece; saldo negativo é avaliado mensalmente.                   | T034/T035 (cálculo pendente)   |
| R7  | **Faltas no banco só com saldo positivo**; sem saldo positivo, **relatório no dia 28** para desconto/manutenção — **decisão humana, nunca automática**.                                          | T034/T035 (semântica pendente) |
| R8  | **Falta não justificada gera apontamento de desconto de DSR** — um sinalizador, **não** cálculo nem desconto financeiro.                                                                         | T037 (DP-3J-21, parcial)       |
| R9  | **Módulo de Ponto não calcula valor financeiro / reflexo salarial / desconto financeiro de DSR** — depende da futura Folha + Jurídico.                                                           | T037                           |
| R10 | **Jornada semanal de referência: 44h** distribuídas de segunda a sexta — **9h de segunda a quinta** e **8h na sexta**. Requisito operacional recebido, **sem** declaração de conformidade legal. | T035/T037 (sujeito a DP-3J-09) |
| R11 | **Sem trabalho inicial em sábados, domingos, feriados ou por turnos.**                                                                                                                           | T034 (recebida)                |
| R12 | **Situações (catálogo controlado, sem texto livre):** atestado, folga, férias, compensação, almoço livre.                                                                                        | T034 (ADR 0008 dec. 5)         |
| R13 | **Rejeição por marcação, nunca por lote:** CPF ausente/inválido/sem colaborador rejeita **só aquela marcação** e cria pendência; o resto do lote segue.                                          | T035 (DP-3J-17)                |
| R14 | **Horário atribuído no cadastro do colaborador, com vigência**; mudança de horário **não altera períodos já apurados** (imutabilidade do dia apurado).                                           | T035/T037 (DP-3J-19)           |
| R15 | **Feriados nacionais iniciais**; municipais, pontes e exceções **cadastrados caso a caso**; calendário **por empresa**, versionado como os horários.                                             | T034 (recebida)                |
| R16 | **Correção sempre por ajuste rastreável** (novo registro, motivo codificado, sem texto livre); marcação/evento original **imutável**.                                                            | ADR 0008 dec. 5                |
| R17 | **Isolamento por `empresa_id`**: toda batida, lote, apuração, banco, fechamento, espelho e item da fila é estritamente por empresa.                                                              | ADR 0006/0008                  |
| R18 | **RH é o único operador do ponto**; DP, `gestor`, colaborador negados; `master_tecnico` sem mutação trabalhista.                                                                                 | T037/ADR 0012                  |

> **Nota sobre "decidida" × "pronta para implementar".** Uma regra **decidida**
> (ex.: R3, tolerância por dia) fixa a **política**; a **semântica exata de
> aplicação** (ex.: como a tolerância de 15 min interage com atraso na entrada
> _e_ saída antecipada no mesmo dia) pode ainda ser **questão de homologação**
> (§5, QH-01). Decidir a política **não** dispensa homologar o resultado
> esperado dos exemplos completos (`DP-3J-18`).

### 2.2 Hipóteses (recebidas, ainda não confirmadas)

| #   | Hipótese                                                         | Status / responsável                                         |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| H1  | **CPF** como identificador do colaborador no arquivo do relógio. | Hipótese (T035/T039); confirmação DP-3J-20                   |
| H2  | Enquadramento do REP na **Portaria 671** (BLUE BIOPROX-C).       | Hipótese; **sem** declarar conformidade (§7)                 |
| H3  | **Valor/desconto financeiro de DSR** nas faltas em banco.        | Aguarda **Diretoria + Folha + Jurídico** (DP-3J-21, cálculo) |

### 2.3 Pendências bloqueantes (não resolvidas por este caderno)

Transcritas da [detalhada §8.2](etapa3-jornada-ponto-v1-detalhada.md); este
caderno **não** as resolve — apenas as **organiza** para homologação (§5).

| ID                    | Pendência                                                                                                            | Responsável                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| DP-3J-18              | **Três exemplos completos** homologados (entrada **e** resultado), não só referência visual.                         | RH                                |
| DP-3J-20              | Homologação do fornecedor (RWTech) do BLUE BIOPROX-C campo a campo e enquadramento jurídico do leiaute AFD.          | Fornecedor + Jurídico + TI        |
| DP-3J-21 (financeiro) | **Valor/desconto financeiro** de DSR em faltas no banco — suspenso até autorização dos diretores + Folha + Jurídico. | Diretoria + RH + Jurídico + Folha |
| DP-3J-22              | **Marcos das jornadas 1 (Horario Reserva Fiscal), 2 (HORARIO LIBERTY) e 19 (ESTAGIARIO)** — não recebidos.           | RH                                |
| DP-3J-09              | **Validade/enquadramento legal** do controle de jornada e do fechamento.                                             | Jurídico                          |
| DP-3J-11              | **Retenção, descarte e acesso do titular** do arquivo e das marcações.                                               | RH + Jurídico                     |
| MFA / `DS-OPS-01`     | Gates de dado real: MFA obrigatório (ADR 0003) e gate-mestre de segurança operacional.                               | TI/Segurança + conjunta           |

## 3. Insumos de apuração já fixados (referência rápida)

Consolidação de leitura, sem nova decisão — todos já constam em §2.1:

- **Janela do período:** dia **26 → 25** (R1); **fechamento no dia 25** (R2);
  **relatório de faltas no dia 28** (R7, regra distinta do fechamento).
- **Tolerância:** **15 min/dia** (R3).
- **Intervalo mínimo:** **1h** quando "almoço livre" e intervalo < 1h (R4).
- **Alertas de banco:** **+38h / −24h** → apenas alerta (R5).
- **Jornada semanal de referência:** **44h** (9h seg–qui, 8h sex) (R10);
  **sáb/dom/feriado sem jornada inicial** (R11).
- **Catálogo de situações:** atestado, folga, férias, compensação, almoço livre
  (R12).
- **220 horas mensais:** **referência de Folha/contrato a validar**, **não**
  resultado automático da apuração diária — ver §6.

## 4. Tabela de cenários sintéticos para homologação

Cada cenário é uma **entrada sintética** (descrição estrutural, sem número real
de resultado) para o RH homologar. Para cada um declaramos:

- **O que já pode ser testado (agora, com dado sintético):** classificação
  **estrutural** do dia e geração de item na fila "Verificar folhas" — **sem**
  produzir número trabalhista.
- **O que depende de decisão (bloqueado até homologação):** o **resultado
  numérico** e a regra exata que o produz. **Este caderno não preenche o
  resultado** — respeita o Princípio I/IV da Constituição.

> **Leitura obrigatória:** a coluna "depende de decisão" **nunca** é preenchida
> com um valor. Onde aparece "resultado pendente", é porque o número **só existe
> após** o RH homologar a regra e o exemplo completo (`DP-3J-18`). Nenhum
> resultado é inferido.

| ID     | Cenário (entrada sintética)                                                                | Já pode ser testado (estrutura, sem número)                                                                                  | Depende de decisão (não calculado aqui)                                                                                      |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CEN-01 | **Dia normal:** 4 batidas casando com os marcos do horário vigente.                        | Dia classifica como **regular**; pares entrada/saída e intervalo reconhecidos; **nenhuma** pendência na fila.                | Total de horas do dia e efeito no banco — **resultado pendente** (regra de contagem/arredondamento não homologada).          |
| CEN-02 | **Atraso:** primeira entrada após o marco planejado, além da tolerância.                   | Dia sinaliza **atraso**; item potencial `fora do padrão` na fila (semântica de limiar pendente).                             | Se o atraso (líquido de 15 min/dia, R3) vira saldo negativo de banco e **quanto** — **resultado pendente** (QH-01).          |
| CEN-03 | **Saída antecipada:** última saída antes do marco planejado, além da tolerância.           | Dia sinaliza **saída antecipada**; classificação estrutural do desvio.                                                       | Interação da tolerância diária única (R3) entre atraso **e** saída antecipada no mesmo dia — **resultado pendente** (QH-01). |
| CEN-04 | **Hora extra:** saída após o marco planejado, além da tolerância, sem situação de exceção. | Dia sinaliza **extra**; distinção estrutural entre "dentro" e "além" da tolerância.                                          | Quanto entra no banco como extra (R6) e como é somado — **resultado pendente** (QH-01, DP-3J-18).                            |
| CEN-05 | **Intervalo < 1h (almoço livre):** batidas de intervalo somam menos de uma hora.           | Dia sinaliza situação **almoço livre** (R12); regra R4 (mínimo de 1h) é **aplicável** e o ajuste automático é **auditável**. | Como o mínimo de 1h aparece no espelho e afeta o total do dia — **resultado pendente** (QH-02).                              |
| CEN-06 | **Batida ausente:** falta uma marcação esperada pelo horário do dia.                       | Item **`batida ausente`** na fila "Verificar folhas"; dia marcado como **jornada incompleta**; **sem** ação automática.      | Efeito no total/banco após ajuste manual do RH — **resultado pendente** (depende do ajuste + regra de contagem).             |
| CEN-07 | **Batida repetida:** duas marcações redundantes no mesmo marco.                            | Item **`batida repetida`** na fila; par correto identificável estruturalmente; original **imutável** (R16).                  | Qual batida prevalece na apuração e como — **resultado pendente** (regra de deduplicação de apuração não homologada).        |
| CEN-08 | **Falta justificada:** dia sem batidas, com situação registrada (ex.: atestado/folga).     | Situação do catálogo (R12) reconhecida; dia **não** entra como falta não justificada.                                        | Efeito no banco/DSR — **resultado pendente**; **não** gera apontamento de DSR (contraste com CEN-09).                        |
| CEN-09 | **Falta não justificada:** dia sem batidas e **sem** situação registrada.                  | **Apontamento de desconto de DSR** (R8) — sinalizador, **auditável**; item de pendência na fila.                             | **Valor/desconto financeiro** — **bloqueado** (H3/DP-3J-21, financeiro): apontamento **não** antecipa cálculo.               |
| CEN-10 | **Folga:** dia com situação **folga** registrada.                                          | Situação **folga** (R12) reconhecida; dia sem expectativa de jornada.                                                        | Interação com banco/DSR, se houver — **resultado pendente**.                                                                 |
| CEN-11 | **Férias:** dia dentro de período de **férias** registrado.                                | Situação **férias** (R12) reconhecida; dia fora da apuração ordinária de jornada.                                            | Efeito de folha/férias — **fora do Ponto** (Etapa 4/Folha); **resultado pendente** e fora de escopo do motor.                |
| CEN-12 | **Feriado:** dia marcado como feriado no calendário por empresa (R15).                     | Dia **sem jornada inicial** (R11); calendário por empresa (R15) aplicado; sem expectativa de batida.                         | Tratamento de trabalho **em** feriado (se ocorrer batida) — **resultado pendente** (regra não recebida).                     |
| CEN-13 | **Compensação:** dia/registro com situação **compensação** (R12).                          | Item **`compensação pendente`** na fila; situação reconhecida; triagem manual do RH.                                         | Como a compensação abate saldo de banco (R6) — **resultado pendente** (semântica de compensação não homologada).             |

> **Isolamento (R17) vale para todos os cenários.** Cada cenário é **por
> empresa**: um teste sintético de `Empresa A` nunca pode expor dado de
> `Empresa B`. Isso **já pode ser testado** estruturalmente (autorização por
> `empresa_id`, 404 anti-enumeração — [lote §6](etapa3-lote-importacao-afd-contrato-v1.md)),
> independente da homologação dos resultados numéricos.

> **Nota sobre "batida ausente/repetida" e o parser.** A detecção estrutural de
> `batida ausente`/`batida repetida` como **item de fila** é da camada de
> apuração (fila "Verificar folhas", [detalhada §5](etapa3-jornada-ponto-v1-detalhada.md)),
> distinta da **rejeição por marcação** do parser (CPF/DH/estrutura inválida —
> [parser §7](etapa3-parser-afd-contrato-tecnico-v1.md)). Um caso não vira o
> outro (fronteira rígida, [lote §4.3](etapa3-lote-importacao-afd-contrato-v1.md)).

## 5. Decisões ainda necessárias antes de implementar o motor

Organizadas como **questões de homologação (QH-\*)** ligadas às pendências de
origem. **Nenhuma é decidida aqui**; cada uma é do respectivo dono de negócio.

### 5.1 Semântica exata da tolerância diária — QH-01 (liga-se a DP-3J-18)

A **política** está decidida: 15 min **por dia** (R3). Falta **homologar a
semântica de aplicação**, por exemplo (perguntas, não respostas):

- A tolerância de 15 min é **um único orçamento diário** compartilhado entre
  atraso na entrada e saída antecipada, ou **por evento**?
- Ela se aplica também ao **excedente** (extra) simetricamente, ou só a
  atraso/saída antecipada e almoço?
- Dentro da tolerância, o desvio é **desconsiderado** (zero) ou **registrado
  sem efeito de banco**?

Sem essa homologação (parte de `DP-3J-18`), CEN-02, CEN-03 e CEN-04 **não têm
resultado numérico** — só classificação estrutural.

### 5.2 Tratamento aprovado das três amostras completas — DP-3J-18

O RH deve fornecer **entrada e resultado completos** de três exemplos (dia
normal; atraso + hora extra; falta/feriado/folga/compensação) — **não** apenas
a referência visual já recebida (T035, decisão 10). Só então os cenários de §4
viram **casos de teste com resultado esperado**. Enquanto abertos, o motor
(T050) **não** pode ter oráculo de resultado.

### 5.3 Marcos completos das jornadas 1, 2 e 19 — DP-3J-22

Os horários **1 (Horario Reserva Fiscal)**, **2 (HORARIO LIBERTY)** e
**19 (ESTAGIARIO)** têm **marcos não recebidos**
([detalhada §9](etapa3-jornada-ponto-v1-detalhada.md)). Sem os marcos, a
apuração desses vínculos **não tem jornada planejada** para comparar — cenários
§4 aplicados a eles ficam **sem base**. (Os demais horários têm marcos
observados, mas sua carga semanal **não** é calculada a partir da string —
[detalhada §9](etapa3-jornada-ponto-v1-detalhada.md).)

### 5.4 Regra de cálculo financeiro / integração futura de DSR e Folha — DP-3J-21 (financeiro)

O **apontamento** de DSR em falta não justificada está decidido (R8), **sem**
cálculo. O **valor/desconto financeiro** permanece **suspenso até autorização
dos diretores** e dependente da **futura Folha** + **Jurídico** (H3). O motor
de Ponto (T050) **não** produz valor financeiro nem reflexo salarial (R9).

### 5.5 Base legal, retenção e demais gates de dado real — DP-3J-09, DP-3J-11, MFA, `DS-OPS-01`

- **Validade/enquadramento legal** do controle de jornada e do fechamento —
  `DP-3J-09` (Jurídico).
- **Retenção, descarte e acesso do titular** do arquivo e das marcações —
  `DP-3J-11` (RH + Jurídico).
- **MFA** obrigatório antes de dado real (ADR 0003 dec. 3) e **`DS-OPS-01`**
  (gate-mestre de segurança operacional — cofre, backup, restauração testada;
  ver [pacote de decisão](../decisions/pacote-decisao-seguranca-operacional.md)).

Enquanto esses gates estiverem abertos, **nenhum dado real** entra em nenhum
ambiente — o motor (T050), quando existir, opera **exclusivamente com dado
sintético** (§8).

## 6. 220 horas mensais é referência de Folha/contrato — não resultado da apuração diária

O valor de **220 horas mensais** é **referência de Folha/contrato** (base
mensal associada à jornada de 44h semanais) e **deve ser validado** pelo
responsável (Folha/DP + Jurídico) **antes** de qualquer uso. Ele **não** é:

- um **resultado automático** que a apuração diária produz ou soma;
- uma **meta** que o motor de Ponto deva "fechar" por período;
- uma **declaração** de carga legal ou de conformidade (a validade da jornada
  segue em `DP-3J-09`, §5.5).

A apuração diária (§4) trabalha **dia a dia** contra o **horário planejado
vigente** (R14) e o **banco de horas** (R6); a relação entre o total apurado e a
referência mensal de 220h é **assunto da Folha** (Etapa 4), **não** do motor de
Ponto. Registrar 220h aqui serve para **evitar** que uma futura implementação
trate esse número como saída automática da apuração.

## 7. Não declaração de conformidade e não interpretação jurídica

Este caderno:

- **não declara** conformidade com a **Portaria MTP 671** nem com qualquer
  norma trabalhista/previdenciária;
- **não faz interpretação jurídica ou trabalhista** — citar período, tolerância,
  jornada de referência ou DSR **descreve requisitos operacionais recebidos do
  RH**, não afirma sua validade legal;
- **não substitui** os gates de `DP-3J-09` (validade legal), `DP-3J-11`
  (retenção/descarte) nem a homologação do fornecedor/Jurídico (`DP-3J-20`);
- **não altera** nenhuma decisão existente (ADR 0008, detalhada, contratos do
  parser/lote) — apenas as **consolida** para homologação.

## 8. Fronteira da futura T050 (motor puro) — o que poderá × o que continua bloqueado

A **T050** é referida aqui como uma **futura fase Implementar de motor de
apuração puro** — análoga ao que a **T041** fez para o parser: um **núcleo
TypeScript puro e isolado**, em memória, **exclusivamente com dado sintético**,
**sem** endpoint/upload/banco/UI/integração/dado real. **Este caderno não abre a
T050**; apenas delimita seu recorte, condicionado às homologações de §5.

### 8.1 A T050 poderá (dentro deste recorte, só com dado sintético)

- Implementar a **classificação estrutural do dia** dos cenários §4 (regular,
  atraso, saída antecipada, extra, jornada incompleta, situação registrada) como
  **função pura** sobre marcações sintéticas × horário planejado vigente (R14).
- Gerar os **itens da fila "Verificar folhas"** por tipo
  ([detalhada §5.1](etapa3-jornada-ponto-v1-detalhada.md)) — `batida ausente`,
  `batida repetida`, `jornada incompleta`, `fora do padrão`,
  `compensação pendente`, `CPF rejeitado`, `bloqueio de fechamento` — como
  **sinalização**, sem ação automática.
- Aplicar as **regras já decididas de forma estrutural**: janela 26→25 (R1),
  situações do catálogo (R12), ausência de jornada em sáb/dom/feriado (R11/R15),
  imutabilidade do dia apurado (R14), rejeição por marcação (R13),
  isolamento por `empresa_id` (R17), correção só por ajuste (R16).
- Emitir **alerta** conceitual ao atingir +38h/−24h (R5) — como **sinal**, sem
  bloquear/compensar/descontar.
- Ter **testes unitários** contra os cenários §4 **assim que** os resultados
  esperados forem homologados (`DP-3J-18`), sempre com dado sintético.

### 8.2 A T050 continua bloqueada de (sem decisão própria/gate)

- **Produzir qualquer número trabalhista homologado** (horas do dia, saldo de
  banco, extra/atraso/falta líquidos, compensação) **antes** de `DP-3J-18` e da
  semântica de tolerância (QH-01) — sem oráculo homologado, não há cálculo.
- **Cálculo financeiro** de DSR, reflexo salarial ou desconto (R9, H3,
  DP-3J-21 financeiro) — permanece com Diretoria + Folha + Jurídico.
- **Fechamento com efeito legal**, **espelho assinado** e **assinatura
  eletrônica** ([detalhada §2.9, §3.1](etapa3-jornada-ponto-v1-detalhada.md)) —
  dependem de `DP-3J-09` e demais gates.
- **Apurar as jornadas 1, 2 e 19** — sem os marcos (`DP-3J-22`), não há base.
- **Importação, associação por CPF, persistência e integração** (camadas 3–5 do
  [lote §2](etapa3-lote-importacao-afd-contrato-v1.md)) — fora do motor puro.
- **Habilitar dado real** — MFA (ADR 0003) e `DS-OPS-01` seguem duros; retenção
  e base legal seguem pendentes (`DP-3J-11`, `DP-3J-09`).

## 9. Critérios de aceite deste caderno (documentação, não implementação)

- [ ] Regras **decididas**, **hipóteses** e **pendências** separadas com ID de
      origem (§2), sem reabrir ou recalibrar nenhuma decisão existente.
- [ ] As regras aprovadas listadas em §2.1 incluem período 26–25, fechamento no
      dia 25, tolerância diária de 15 min, almoço ≥ 1h, alerta +38h/−24h, banco
      de horas, jornada semanal de referência (44h) e ausência de trabalho
      inicial em fins de semana/feriados.
- [ ] Tabela de cenários (§4) cobre dia normal, atraso, saída antecipada, extra,
      intervalo < 1h, batida ausente, batida repetida, falta justificada e não
      justificada, folga, férias, feriado e compensação.
- [ ] Cada cenário declara **o que já pode ser testado** e **o que depende de
      decisão**, **sem** calcular ou inferir resultado não aprovado.
- [ ] Decisões necessárias antes do motor (§5) destacam a semântica da
      tolerância, as três amostras completas, os marcos das jornadas 1/2/19, o
      cálculo financeiro/DSR/Folha e a base legal/retenção/gates de dado real.
- [ ] 220 horas mensais registradas como **referência de Folha/contrato a
      validar**, não resultado automático da apuração diária (§6).
- [ ] **Nenhuma** declaração de conformidade com a Portaria 671 nem
      interpretação jurídica/trabalhista (§7).
- [ ] Recorte da T050 (§8) separa o implementável só com dado sintético do que
      continua bloqueado.
- [ ] Nenhum dado real, nome, CPF, arquivo ou print presente.

## 10. Declaração

Este documento é um **caderno de homologação**: consolida os requisitos de
jornada e banco de horas **já recebidos do RH** em casos de **decisão e de
teste** para uma futura apuração, **separando** o decidido, o hipotético e o
pendente, e **delimitando** o que uma futura **T050 de motor puro** poderá
implementar **somente com dados sintéticos** e o que continuará bloqueado.
**Nenhuma linha de código, teste, schema, migration, endpoint, API, UI, parser,
importação, associação por CPF, persistência, cálculo, banco de horas, DSR,
fechamento, espelho, assinatura ou dado real** é criada por este documento. Ele
**não decide regra trabalhista nova**, **não altera** nenhuma decisão existente,
**não calcula nem infere** resultado não aprovado, **não declara** conformidade
com a **Portaria MTP 671** e **não faz** interpretação jurídica/trabalhista.
As pendências `DP-3J-09`, `DP-3J-11`, `DP-3J-18`, `DP-3J-20`, `DP-3J-22`, o
**cálculo financeiro** de `DP-3J-21`, além de **MFA** e `DS-OPS-01`, permanecem
**exatamente como estavam**. Enquanto esses gates estiverem abertos, **nenhum
dado real** entra em nenhum ambiente.
