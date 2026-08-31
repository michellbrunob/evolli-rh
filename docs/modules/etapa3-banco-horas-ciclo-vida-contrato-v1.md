# Etapa 3 — Contrato do ciclo de vida do Banco de Horas (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T051). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código, teste,
  schema, migration, endpoint, API, UI, cálculo com dado real, integração com
  Folha, valor monetário ou dado real aqui — apenas o **contrato conceitual** do
  ciclo de vida do Banco de Horas V1 (extrato, movimentos, invariantes,
  quitação futura, autorização e pendências).
- Data: 2026-08-28 (T051).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T051** (contrato do ciclo de vida do
  Banco de Horas V1).
- Base factual (não reaberta — este contrato **consolida**, não decide regra
  trabalhista nova):
  [Motor de apuração puro V1](etapa3-motor-apuracao-puro-v1.md)
  (T050 — impacto diário: crédito/débito separados, D2/D3),
  [Caderno de homologação da apuração](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  (T049 — R5 alerta +38h/−24h, R6/R7 banco),
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2.8 banco conceitual, §2.7 ajuste rastreável),
  [Nota de convergência com a CCT 2026/2027](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md)
  (T050 — referência), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only via `AuditService.record()`, correção por evento
  complementar), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico; `master_tecnico` sem mutação trabalhista),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (`DS-OPS-01`), [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável — não inventada); Princípio III
  (contrato versionado; domínio independente de HTTP/Prisma/UI); Princípio IV
  (cenários sintéticos; sem transformar interpretação não confirmada em regra);
  Princípio V (auditoria append-only, segregação de funções, correção aditiva).

## 0. Natureza e limites deste documento

Este documento **especifica o contrato conceitual** do ciclo de vida do **Banco
de Horas V1**: como os movimentos (crédito, débito, compensação, ajuste,
quitação) nascem, como o saldo é **derivado** deles, quais são as **invariantes**
e os **estados** de uma futura quitação, quem **opera** e o que **permanece
pendente**. Ele **organiza** o que já foi decidido (T049/T050) e **delimita** o
que segue aberto — **sem** implementar nem inventar regra trabalhista.

**Invariável neste documento:**

- **Não implementa nada:** sem código, teste, schema, migration, endpoint, API,
  UI, job, dependência ou configuração.
- **Não calcula dinheiro:** nenhum valor monetário, salário, adicional, DSR
  monetário, percentual ou integração com Folha. O banco trabalha em
  **minutos/horas** e **eventos rastreáveis**.
- **Não inventa regra trabalhista:** prazo de validade dos créditos, ordem de
  consumo, saldo negativo, aprovação, documento de quitação, integração e
  retenção seguem **pendentes** (§7) — nenhum é presumido aqui.
- **Não usa dado real:** nenhum nome, CPF, empresa real, arquivo ou print. Os
  exemplos são **sintéticos** (`Empresa A`/`Empresa B`, `Vínculo V-001`).
- **Não declara conformidade** legal, trabalhista ou LGPD — inclusive quanto à
  **Portaria MTP 671** e à **CCT** (§8) — e **não faz interpretação jurídica**.
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros;
  retenção/base legal seguem pendentes.

## 1. Decisões já confirmadas (transcrição, não nova decisão)

Registradas como já aprovadas nas tarefas de origem; nenhuma é reaberta aqui.

| #   | Decisão confirmada                                                                                                                                                                | Origem                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| B1  | **Créditos positivos de hora extra entram exclusivamente no Banco de Horas** — não viram pagamento nem valor monetário nesta fatia.                                               | T050 D2 (R6 do caderno)    |
| B2  | **Débito e crédito são componentes separados**: o crédito **não** compensa automaticamente atraso ou saída antecipada.                                                            | T050 D2                    |
| B3  | **Limites +38h / −24h apenas alertam** — não bloqueiam, compensam, descontam nem fecham automaticamente.                                                                          | T049 R5 (T035, DP-3J-15)   |
| B4  | **RH é o único operador trabalhista na própria empresa**; DP, `gestor` e colaborador negados; `master_tecnico` sem mutação trabalhista.                                           | T037 / ADR 0008 / ADR 0012 |
| B5  | **Em evolução posterior, o RH poderá decidir a quitação de horas positivas pela Folha** — capacidade futura, não implementada nem habilitada aqui.                                | T050 D3                    |
| B6  | **A quitação nunca apaga o histórico**: deve existir como **evento rastreável**, com **saldo anterior, horas quitadas, saldo posterior, data, responsável e referência técnica**. | T050 D3 / ADR 0004         |
| B7  | **O módulo de Ponto não calcula dinheiro, salário, adicional, DSR monetário ou Folha.**                                                                                           | T050 D3 (R9 do caderno)    |
| B8  | **Qualquer pagamento efetivo permanece fora do escopo**, condicionado a **RH, Jurídico, Folha, MFA e `DS-OPS-01`**.                                                               | T050 / DP-3J-21 / gates    |

## 2. Fronteiras (apuração diária → extrato → compensação → alerta → quitação)

O Banco de Horas é uma **camada de leitura e de eventos** sobre o resultado da
apuração diária; cada fronteira é um **handoff explícito**, nunca um atalho.

| #   | Camada                       | Responsabilidade                                                                                    | Onde vive                                         |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | **Apuração diária**          | Produz o **impacto do dia** (crédito de extra e débito de atraso/saída, separados) — em minutos.    | Motor puro (T050), `apps/api/src/ponto/apuracao/` |
| 2   | **Extrato / saldo de banco** | **Acumula** os impactos diários como **movimentos**; o **saldo é derivado** da soma dos movimentos. | **Este contrato** (conceitual)                    |
| 3   | **Compensação**              | Registra um **débito proposto** (T050 compensação) — **sem** validar saldo nem acordo nesta fatia.  | **Este contrato** (proposta) + RH (decisão)       |
| 4   | **Alerta**                   | Sinaliza saldo em **+38h / −24h** (B3) — **não financeiro**, **não bloqueante**.                    | **Este contrato** (derivado do saldo)             |
| 5   | **Quitação futura (Folha)**  | Evento que **zera/reduz** o saldo positivo pela Folha (B5/B6) — **sem** calcular dinheiro (B7).     | **Futuro/gated** (§5, §7)                         |

- Este contrato cobre as camadas **2, 3 e 4** (extrato, compensação proposta,
  alerta) como **conceito** e prepara a fronteira para a camada **5** (quitação).
- A camada **1** é o motor T050 (já implementado, puro). A camada **5** é
  **futura e gated** (§7): o pagamento efetivo é **externo** ao Ponto (B8).
- **Nenhuma camada calcula dinheiro.** O saldo e os movimentos são **minutos**;
  a conversão em valor é **Folha**, fora daqui (B7).

> **Ponteiro (T056).** O **fechamento operacional** do período e a emissão do
> **Espelho de Ponto V1** — que apenas **lê** crédito/débito separados e o saldo
> **derivado** deste extrato, **sem** criar movimento nem calcular valor — estão
> especificados no
> [contrato do fechamento e do Espelho de Ponto V1](etapa3-fechamento-espelho-contrato-v1.md).
> Fechar/emitir **não** altera o extrato nem apaga histórico.

> **Fundação implementada (T052).** A **camada 2** (extrato/saldo) tem um
> **núcleo TypeScript puro e isolado** em `apps/api/src/ponto/banco-horas/`
> (`banco-horas.ts`, `banco-horas.types.ts`), com fixtures **exclusivamente
> sintéticas** e testes unitários. `gerarExtratoSintetico(movimentos)` recebe
> movimentos **já normalizados e sintéticos** (crédito/débito em minutos, id
> técnico, data de referência, origem técnica) e devolve, **em memória**, o
> extrato na ordem de entrada (nunca reordenada), o **saldo derivado** e os
> **totais separados** de crédito e débito — honrando as invariantes §4 (nunca
> compensar, apagar, reordenar ou fundir movimentos; saldo derivado dos
> eventos). Um adaptador puro (`movimentosDeApuracaoDiaria`) converte o
> resultado diário do motor (T050) em movimentos de crédito e débito separados,
> **sem** reimplementar a apuração. **Fail-closed** para entrada inválida (id
> vazio/duplicado, data inválida, minutos não positivos, natureza/origem
> desconhecidas). **Permanecem fora** (não implementados): compensação
> automática, ordem de consumo, validade de crédito, bloqueio de saldo negativo,
> ajuste humano, aprovação, **`debito_quitacao`** (BH-04/05/06), pagamento,
> Folha, valor monetário e dado real — **sem** NestJS/Prisma/I/O/rede/banco.

> **Ponteiro (T053).** A **compensação proposta** (workflow do RH: `rascunho` →
> `submetida_para_revisao` → `aprovada_para_registro`/`recusada`/`cancelada`) e
> a fronteira entre **proposta** (não altera saldo nem extrato) e **débito de
> compensação efetivado** (só por registro futuro autorizado, via núcleo T052)
> estão especificadas, **somente como documentação**, no
> [contrato da compensação de Banco de Horas V1](etapa3-banco-horas-compensacao-contrato-v1.md).
> Ele **não** implementa, **não** cria movimento e **não** relaxa gates
> (BH-04/05/06 seguem pendentes).

## 3. Modelo conceitual de movimentos

Nomes **conceituais** (sujeitos à modelagem real; **não** são schema/enum de
banco). Todo movimento ancora em `VinculoFuncional` (ADR 0007), **por empresa**.

| Movimento                     | Origem                                                   | Sinal no saldo | Situação                                        |
| ----------------------------- | -------------------------------------------------------- | -------------- | ----------------------------------------------- |
| `credito_extra`               | Apuração diária (T050) — crédito de hora extra           | **+**          | Confirmado (B1/B2)                              |
| `debito_atraso_saida`         | Apuração diária (T050) — débito por atraso/saída         | **−**          | Confirmado (B2)                                 |
| `debito_compensacao_proposta` | Compensação (T050) — débito proposto da jornada prevista | **−**          | **Proposto**, sem validar saldo/acordo (§7)     |
| `ajuste_humano`               | Ação **futura** do RH (correção rastreável, codificada)  | **+/−**        | **Pendente** de semântica (§7; ADR 0008 dec. 5) |
| `debito_quitacao`             | **Quitação futura** para Folha (B5/B6)                   | **−**          | **Futuro/gated** (§5, §7)                       |

- Cada movimento carrega, no mínimo (conceitual): **empresa**, **vínculo**,
  **dia/competência**, **tipo**, **minutos**, **origem** (apuração T050 ou ação
  humana), **referência técnica** e **momento de registro** — **sem** dado
  pessoal além do vínculo, **sem** texto livre (catálogo controlado — ADR 0008
  dec. 5), **sem** valor monetário.
- **Crédito e débito são movimentos distintos** (B2): não existe um movimento
  "líquido" que colapse os dois. O crédito de extra **não** gera, por si, um
  débito compensatório automático.
- O `ajuste_humano` é a porta **futura** para correção pelo RH — **sempre
  aditivo** (novo movimento que referencia o anterior), **nunca** edição/exclusão
  ([detalhada §2.7](etapa3-jornada-ponto-v1-detalhada.md)); sua semântica exata é
  **pendente** (§7).

## 4. Invariantes

1. **Histórico imutável.** Nenhum movimento é editado ou apagado. Correção é
   **novo movimento** que referencia o original (ADR 0004 dec. 3; ADR 0008 dec.
   5; [detalhada §2.7](etapa3-jornada-ponto-v1-detalhada.md)).
2. **Nunca "zerar" apagando movimentos.** "Zerar o saldo" (quitação, B6) é um
   **movimento aditivo** (`debito_quitacao`) que leva o **saldo derivado** a zero
   (ou ao saldo posterior), **preservando** todos os movimentos anteriores. Zerar
   **não** é deletar crédito.
3. **Saldo derivado dos eventos.** O saldo corrente é a **soma assinada** dos
   movimentos (crédito `+`, débitos `−`), **derivada**, não uma verdade mutável
   editada à parte. Um eventual "snapshot" de saldo é **cache derivado**, nunca
   fonte de verdade acima dos movimentos.
4. **Segregação por empresa e colaborador.** Todo movimento, saldo, alerta e
   quitação é **estritamente por `empresa_id`** (ADR 0006) e **por vínculo**
   (ADR 0007). Banco de uma empresa/colaborador **nunca** é visível ou somável
   com o de outro.
5. **Sem dinheiro.** Nenhuma invariante do banco produz valor monetário; o saldo
   é sempre **minutos/horas** (B7).
6. **Auditoria fail-safe.** Todo movimento sensível (inclusive quitação) é
   registrado com sua auditoria de forma transacional: falha de auditoria impede
   a mutação (ADR 0004 dec. 2) — sem movimento órfão.

## 5. Estados e transições conceituais de uma quitação

Estados **conceituais** de uma **quitação futura** (B5/B6) — **sem** definir
schema, endpoint, UI, valor ou integração real. A quitação é a decisão do RH de
**quitar horas positivas pela Folha**; aqui ela é apenas o **evento de banco**
que reduz o saldo, **não** o pagamento (que é externo, B8).

| Estado       | Significado                                                                                                      | Terminal? |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | --------- |
| `proposta`   | RH propõe quitar `N` horas positivas de um vínculo (conceitualmente `N ≤ saldo positivo`).                       | Não       |
| `aprovada`   | Passou pela **alçada aprovada** — **cuja definição é pendente** (§7). Sem alçada modelada, a operação é negada.  | Não       |
| `registrada` | Evento de quitação **gravado** no extrato como `debito_quitacao`, com os campos de B6. Saldo posterior derivado. | **Sim**   |
| `cancelada`  | RH abortou antes do registro.                                                                                    | **Sim**   |

### 5.1 Transições

```text
proposta  ──▶ aprovada        (alçada aprovada — pendente, §7)
proposta  ──▶ cancelada       (aborto do RH antes do registro)
aprovada  ──▶ registrada      (grava debito_quitacao, imutável)
aprovada  ──▶ cancelada       (aborto do RH antes do registro)

registrada ──▶ (nenhuma)      terminal (imutável)
cancelada  ──▶ (nenhuma)      terminal
```

### 5.2 Regras da quitação (conceituais)

- **`registrada` é imutável e aditiva** (invariante 1/2): grava um movimento
  `debito_quitacao` com **saldo anterior, horas quitadas, saldo posterior, data,
  responsável (RH — papel/ID técnico) e referência técnica** (B6). Uma correção
  posterior é **novo evento**, nunca edição.
- **A quitação zera/reduz o saldo derivado**, **preservando** os créditos que a
  originaram (invariante 2).
- **O pagamento pela Folha é externo e gated** (B8): o evento de banco **não**
  calcula nem transporta valor monetário; ele apenas registra que `N` horas
  saíram do saldo para quitação. Quando/como o pagamento ocorre é **Folha +
  Jurídico + Diretoria** (§7; `DP-3J-21`).
- **Aprovação, documento de quitação e integração com Folha são pendentes**
  (§7): enquanto não decididos, a quitação **não** é implementada — este
  contrato apenas fixa a **forma** (evento rastreável), não a **execução**.

## 6. Autorização e auditoria

- **RH é o único operador trabalhista**, restrito ao **próprio `empresa_id`**
  (B4; [detalhada §1.3](etapa3-jornada-ponto-v1-detalhada.md)). Consultar o
  extrato, registrar compensação/ajuste e propor/registrar quitação são
  operações **exclusivas do RH da empresa dona do vínculo**.
- **`master_tecnico` não tem mutação trabalhista** (ADR 0012 dec. 3): no máximo
  os limites técnicos de leitura já aprovados; **não** credita, debita, compensa,
  ajusta nem quita.
- **DP, `gestor` e colaborador são negados** para toda operação de banco no V1 —
  sem acesso por analogia.
- **Isolamento com 404 anti-enumeração** (ADR 0006; Constituição, Princípio II):
  tentativa de acessar banco de **outra** empresa/colaborador retorna
  **não encontrado**, sem revelar existência ou metadados.
- **Auditoria append-only** (ADR 0004): criação de movimento, alerta tratado e
  cada transição de quitação são **auditáveis**, sem valor sensível em claro;
  correção é evento complementar, nunca edição.

## 7. Pendências para RH / Jurídico / Folha

Registradas, **não** resolvidas, e **proibidas de inferência** (Constituição,
Princípio I):

| ID    | Pendência                                                                                           | Responsável                               |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| BH-01 | **Prazo de validade dos créditos** (expiram? quando?).                                              | RH + Jurídico                             |
| BH-02 | **Ordem de consumo** dos créditos/débitos (FIFO, LIFO, por competência…).                           | RH                                        |
| BH-03 | **Possibilidade e tratamento de saldo negativo** (limite −24h só alerta, B3; o resto é pendente).   | RH + Jurídico                             |
| BH-04 | **Alçada/aprovação da quitação** (quem aprova; segregação de funções).                              | RH + Jurídico                             |
| BH-05 | **Documento de quitação** (existe? formato? assinatura? — liga-se a Documentos Nível 2, bloqueado). | RH + Jurídico                             |
| BH-06 | **Integração com a Folha** e o **valor monetário** da quitação (fora do Ponto, B7/B8).              | Folha + Jurídico + Diretoria (`DP-3J-21`) |
| BH-07 | **Retenção/descarte** do extrato e dos eventos de banco.                                            | RH + Jurídico (`DP-3J-11`)                |
| BH-08 | **Semântica do `ajuste_humano`** (motivos codificados, efeito no saldo).                            | RH                                        |

Herdados e ainda bloqueantes de **dado real**: **MFA** (ADR 0003), `DS-OPS-01`
(gate-mestre), `DP-3J-09` (validade legal), `DP-3J-11` (retenção). Enquanto
abertos, **nenhum dado real** entra em nenhum ambiente.

> **Ponteiro (T055).** As pendências BH-01..08 e as decisões de **registro
> efetivo** (proposta aprovada → `debito_compensacao`) e de **quitação futura
> para a Folha** (evento rastreável, sem apagar histórico) são consolidadas para
> aprovação por RH/Jurídico/Folha, como formulário de decisão, no
> [pacote de decisão de compensação/quitação de Banco de Horas](../decisions/pacote-decisao-compensacao-quitacao-banco-horas.md).
> Todas seguem **Pendentes**; o pacote **não** implementa nem decide.

## 8. Relação com a CCT (apenas referência)

A [nota de convergência com a CCT 2026/2027](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md)
é referência **operacional**, **sem** conformidade jurídica: horas extras, DSR e
trabalho em feriado têm efeitos financeiros/condições próprias, mas **cálculo
monetário e Folha continuam fora do Ponto** (C4 da nota; B7). Este contrato
**não** interpreta a CCT, **não** transcreve dado do PDF e **não** declara
conformidade — a validade legal do banco e da quitação segue com o **Jurídico**
(`DP-3J-09`).

## 9. Cenários sintéticos (extrato e quitação)

Valores **fictícios e sintéticos** (sem CPF, nome, empresa real, arquivo ou
print); apenas ilustram a **derivação do saldo** e a **forma** da quitação.

### 9.1 Extrato sintético (saldo derivado dos movimentos)

`Empresa A`, `Vínculo V-001`:

| Competência | Movimento                     | Minutos | Saldo derivado (acumulado) |
| ----------- | ----------------------------- | ------: | -------------------------: |
| 2026-07     | `credito_extra`               |    +120 |                       +120 |
| 2026-07     | `debito_atraso_saida`         |     −25 |                        +95 |
| 2026-07     | `credito_extra`               |     +90 |                       +185 |
| 2026-08     | `debito_compensacao_proposta` |    −180 |                         +5 |

O saldo `+5` é **derivado** da soma dos movimentos — nenhum movimento foi
apagado, e o crédito e o débito permanecem **separados** (invariante 3; B2).

### 9.2 Quitação sintética (evento rastreável, sem dinheiro)

Sobre o extrato acima, o RH propõe quitar as horas positivas correntes:

| Campo (conceitual)   | Valor sintético                 |
| -------------------- | ------------------------------- |
| `estado`             | `registrada`                    |
| `saldo_anterior`     | `+5 min`                        |
| `horas_quitadas`     | `5 min`                         |
| `saldo_posterior`    | `0 min`                         |
| `data`               | `2026-08-25` (sintética)        |
| `responsavel`        | RH (papel/ID técnico, sem nome) |
| `referencia_tecnica` | `QUIT-DEMO-0001` (ilustrativa)  |

O evento **preserva** todos os movimentos anteriores (invariante 2): o saldo vai
a `0` por um **`debito_quitacao` aditivo**, **não** por exclusão dos créditos.
**Nenhum valor monetário** é calculado — o pagamento pela Folha é **externo e
gated** (B7/B8; BH-06).

## 10. Critérios de aceite (da especificação — não de implementação)

- [ ] Decisões confirmadas (B1–B8) transcritas com ID de origem, sem reabrir.
- [ ] Fronteiras apuração → extrato → compensação → alerta → quitação descritas
      com handoff explícito (§2).
- [ ] Modelo de movimentos (crédito, débito, compensação proposta, ajuste
      humano futuro, quitação) descrito sem schema/enum de banco (§3).
- [ ] Invariantes: histórico imutável; nunca zerar apagando; saldo derivado;
      segregação por empresa e colaborador (§4).
- [ ] Estados/transições da quitação conceituais, sem schema/endpoint/UI (§5).
- [ ] Autorização (RH próprio; `master_tecnico` sem mutação; DP/gestor/
      colaborador negados) e auditoria append-only (§6).
- [ ] Pendências para RH/Jurídico/Folha explícitas, incluindo validade dos
      créditos, ordem de consumo, saldo negativo, aprovação, documento de
      quitação, integração com Folha e retenção (§7).
- [ ] CCT apenas como referência, sem conformidade jurídica (§8).
- [ ] Cenários estritamente sintéticos, sem dado real (§9).
- [ ] Nenhum valor monetário, Folha, pagamento, schema, endpoint, UI, código ou
      dado real produzido.

## 11. Declaração

Este documento **especifica** o contrato conceitual do ciclo de vida do Banco de
Horas V1 — decisões confirmadas, fronteiras, modelo de movimentos, invariantes,
estados de quitação, autorização/auditoria, pendências e cenários sintéticos.
**Nenhuma linha de código, teste, schema, migration, endpoint, API, UI, cálculo
com dado real, valor monetário, salário, adicional, DSR monetário, integração
com Folha, pagamento ou dado real** é criada por este documento. Ele **não
decide regra trabalhista nova**, **não altera** nenhuma decisão existente, **não
declara** conformidade com a **Portaria MTP 671** ou a **CCT** e **não faz**
interpretação jurídica/trabalhista. As pendências `BH-01..08`, `DP-3J-09`,
`DP-3J-11`, o **cálculo financeiro** de `DP-3J-21`, além de **MFA** e
`DS-OPS-01`, permanecem **exatamente como estavam**. Enquanto esses gates
estiverem abertos, **nenhum dado real** entra em nenhum ambiente.
