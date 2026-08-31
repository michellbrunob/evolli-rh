# Etapa 3 — Contrato da fila "Ponto > Verificar folhas" (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T058). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código, teste,
  schema, migration, endpoint, API, UI funcional, fila real, importação,
  cálculo, ajuste de marcação, valor monetário ou dado real aqui — apenas o
  **contrato conceitual** da fila operacional de revisão humana "Verificar
  folhas" (fronteiras, tipos de pendência, estrutura, estados, severidade,
  critérios de "pronto para fechamento", autorização, pendências e cenários
  sintéticos).
- Data: 2026-08-31 (T058).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T058** (contrato da fila "Verificar
  folhas" V1).
- Base factual (não reaberta — este contrato **consolida**, não decide regra
  trabalhista nova):
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2.9 fechamento, §5 "Verificar folhas" — tipos, recursos, limites),
  [Motor de apuração puro V1](etapa3-motor-apuracao-puro-v1.md) (T050),
  [Contrato do ciclo de vida do Banco de Horas V1](etapa3-banco-horas-ciclo-vida-contrato-v1.md)
  (T051; extrato T052),
  [Contrato da compensação de Banco de Horas V1](etapa3-banco-horas-compensacao-contrato-v1.md)
  (T053; propostas T054),
  [Contrato do fechamento e do Espelho de Ponto V1](etapa3-fechamento-espelho-contrato-v1.md)
  (T056; núcleo de fechamento T057),
  [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) (Baseline V1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only via `AuditService.record()`, correção por evento
  complementar), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico; `master_tecnico` sem mutação trabalhista),
  [Painel Administrativo Web V1](painel-administrativo-web-v1.md) (UI-F03; tela
  "Verificar folhas" da T045, referência visual),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (`DS-OPS-01`),
  [nota de convergência com a CCT 2026/2027](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md)
  (referência), [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável — não inventada); Princípio III
  (contrato versionado; domínio independente de HTTP/Prisma/UI); Princípio IV
  (cenários sintéticos; sem transformar interpretação não confirmada em regra);
  Princípio V (auditoria append-only, segregação de funções, correção aditiva).

## 0. Natureza e limites deste documento

Este documento **especifica o contrato conceitual** da fila operacional
**"Ponto > Verificar folhas"**: uma **fila de revisão humana do RH** que
**sinaliza** pendências do período **antes** do fechamento — **sem** corrigir,
aprovar, calcular, fechar ou alterar dados automaticamente. Ele **organiza** o
que já foi decidido (detalhada §5; T050/T052/T054/T057) e **delimita** o que
segue aberto — **sem** implementar nem inventar regra trabalhista.

**Invariável neste documento:**

- **Não implementa nada:** sem código, teste, schema, migration, endpoint, API,
  UI funcional, fila real, job, dependência ou configuração.
- **Não corrige nem calcula:** a fila **não** ajusta marcação, **não** aprova
  compensação, **não** calcula jornada/banco, **não** fecha período e **não**
  altera saldo — só **sinaliza** para a revisão humana do RH.
- **Não calcula dinheiro:** nenhum valor monetário, salário, adicional, DSR
  financeiro, desconto, pagamento ou Folha.
- **Não usa dado real:** nenhum nome, CPF, marcação bruta, horário exato,
  arquivo, AFD/TXT ou dado pessoal. Os exemplos são **sintéticos** (`Empresa A`,
  `Vínculo V-001`).
- **Não declara conformidade** com a **CCT** nem com a **Portaria MTP 671** e
  **não faz interpretação jurídica**.
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros.

## 1. Premissas aprovadas (transcrição, não nova decisão)

| #   | Premissa aprovada                                                                                                | Origem                     |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| V1  | **RH é o único operador trabalhista**, limitado à **própria empresa**.                                           | T037 / ADR 0008 / ADR 0012 |
| V2  | **"Verificar folhas" é fila de revisão humana** — não corrige, aprova, calcula, fecha ou altera automaticamente. | detalhada §5.3             |
| V3  | **Período de dia 26 a dia 25**, com **fechamento operacional no dia 25**.                                        | T036/T037 (F1/F2 do T056)  |
| V4  | **Crédito/débito de Banco de Horas seguem separados**; **compensação proposta não é débito efetivado**.          | T050 D2 / T051 / T053      |
| V5  | **Alertas +38h / −24h são somente informativos.**                                                                | T049 R5 / T051 B3          |
| V6  | **O módulo de Ponto não calcula dinheiro, pagamento, salário, adicional, DSR financeiro, desconto ou Folha.**    | T037 / T050 D3 / T051 B7   |
| V7  | **Nenhuma conformidade com a CCT ou a Portaria 671 é declarada.**                                                | CCT (nota) / T050 / T051   |

## 2. Fronteiras e handoffs

A fila é uma **etapa de revisão anterior ao fechamento**; cada fronteira é um
**handoff explícito**, nunca um atalho.

| #   | Camada                              | Papel em relação à fila                                                               | Onde vive                                        |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | **Apuração diária (T050)**          | Origem conceitual das pendências (dia classificado, apontamentos) — em minutos.       | Motor puro T050 (`apps/api/src/ponto/apuracao/`) |
| 2   | **Extrato/saldo (T052)**            | Contexto de leitura (saldo derivado) — a fila **não** o altera.                       | Núcleo T052 (`apps/api/src/ponto/banco-horas/`)  |
| 3   | **Propostas de compensação (T054)** | Uma proposta pendente pode virar item de fila — a fila **não** a aprova nem efetiva.  | Núcleo T054 (`apps/api/src/ponto/compensacao/`)  |
| 4   | **Fila "Verificar folhas"**         | **Revisão humana do RH**: sinaliza pendências; registra resultado técnico da revisão. | **Este contrato** (conceitual)                   |
| 5   | **Fechamento (T057)**               | Consome o resultado da revisão como pré-condição conceitual (não automática).         | Núcleo de fechamento T057 (`.../fechamento/`)    |

- A fila **precede** o fechamento (T057): o RH revisa as pendências e **então**
  decide fechar — a fila **não** dispara o fechamento.
- A fila **lê** o contexto (apuração/extrato/propostas) e **sinaliza**; **não**
  reimplementa nenhum núcleo nem cruza as fronteiras (não ajusta, não aprova, não
  calcula).

## 3. Tipos iniciais de pendência

Tipos **conceituais** (catálogo fechado desta fatia; nomes conceituais, **não**
enum de banco). Alinhados à [detalhada §5.1](etapa3-jornada-ponto-v1-detalhada.md):

| Tipo (conceitual)               | Significado                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `batida_ausente`                | Falta uma marcação esperada pelo horário planejado do dia.                       |
| `batida_fora_do_horario`        | Marcação diverge do horário planejado além da tolerância (semântica pendente).   |
| `jornada_incompleta`            | O conjunto do dia não fecha o par entrada/saída (ou intervalo) esperado.         |
| `compensacao_pendente`          | Uma proposta de compensação (T054) aguarda revisão do RH — **não** é débito.     |
| `dado_importacao_nao_associado` | Marcação importada sem associação a colaborador cadastrado (ex.: CPF rejeitado). |

- **Novos tipos não são regra aprovada.** Qualquer tipo adicional (ex.:
  `batida_repetida`, `bloqueio_de_fechamento`) fica como **pendência** (§8) até
  decisão do RH — **não** é inventado como aprovado aqui.

## 4. Estrutura conceitual mínima de uma pendência

Campos **conceituais** (sujeitos à modelagem; **não** schema), **só referências
técnicas**:

| Campo (conceitual)  | Papel                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| `id`                | Identificador **técnico** da pendência.                                         |
| `empresaRef`        | Referência técnica da empresa (`empresa_id`), nunca razão social real.          |
| `vinculoRef`        | Referência técnica do vínculo (`VinculoFuncional`), nunca nome/CPF.             |
| `periodoReferencia` | Dia/período de referência, `"AAAA-MM-DD"` (ou faixa técnica).                   |
| `tipo`              | Tipo da pendência (§3).                                                         |
| `severidade`        | Priorização operacional (§5) — sem efeito financeiro.                           |
| `origemTecnica`     | De onde veio (ex.: `apuracao`, `compensacao`, `importacao`) — rótulo técnico.   |
| `situacao`          | Estado da pendência (§6).                                                       |
| `motivoCodificado`  | Motivo **codificado** (catálogo controlado, sem texto livre — ADR 0008 dec. 5). |
| `refAuditoria`      | Referência técnica ao evento de auditoria (ADR 0004).                           |

- **Nunca** contém: CPF, nome, marcação bruta, horário exato, arquivo, AFD/TXT
  ou dado pessoal. O detalhamento seguro segue a [detalhada §5.2](etapa3-jornada-ponto-v1-detalhada.md).

## 5. Estados conceituais da pendência e transições

Estados **conceituais** (nomes conceituais, **não** schema/API/UI):

| Estado                               | Significado                                                                    | Terminal? |
| ------------------------------------ | ------------------------------------------------------------------------------ | --------- |
| `aberta`                             | Pendência sinalizada, ainda sem revisão.                                       | Não       |
| `em_revisao_rh`                      | RH está revisando (triagem humana).                                            | Não       |
| `aguardando_informacao`              | RH aguarda informação/insumo externo para decidir.                             | Não       |
| `resolvida_sem_alteracao_automatica` | RH concluiu a revisão; **nenhuma** correção/efeito de saldo é feito pela fila. | **Sim**   |
| `descartada_por_erro_tecnico`        | Pendência descartada como erro técnico (com motivo codificado e auditoria).    | **Sim**   |

### 5.1 Transições conceituais

```text
aberta                 ──▶ em_revisao_rh
em_revisao_rh          ──▶ aguardando_informacao
em_revisao_rh          ──▶ resolvida_sem_alteracao_automatica
em_revisao_rh          ──▶ descartada_por_erro_tecnico
aguardando_informacao  ──▶ em_revisao_rh

resolvida_sem_alteracao_automatica ──▶ (nenhuma)   terminal
descartada_por_erro_tecnico        ──▶ (nenhuma)   terminal
```

- **A fila não define correção trabalhista nem efeito de saldo.**
  `resolvida_sem_alteracao_automatica` significa exatamente isto: a revisão
  humana encerrou o item **sem** a fila alterar marcação, banco ou saldo.
- **Reabertura** de um estado terminal **não** é definida aqui — permanece
  **pendente** (§8).
- **Toda transição é auditável** (§7), sem dado pessoal em claro.

## 6. Severidade e "pronto para fechamento"

### 6.1 Severidade

- **Severidade é apenas priorização operacional** (ex.: informativa / atenção /
  crítica) para ordenar a revisão do RH. **Não** tem cálculo nem efeito
  financeiro e **não** bloqueia automaticamente o fechamento.
- **Os critérios exatos de severidade ficam pendentes para o RH** (§8) — nenhum
  limiar é inventado aqui.

### 6.2 Critérios conceituais para "pronto para fechamento"

- O RH **revisou as pendências aplicáveis** do período e **registrou o resultado
  técnico** (estado terminal de cada item — §5).
- A fila **não aprova compensação** nem **transforma proposta em débito** (V4;
  T053 §2): uma `compensacao_pendente` revisada continua **proposta**.
- **Alertas isolados (+38h/−24h) não são cálculos financeiros** (V5) e não
  determinam, por si, o fechamento.
- **O efeito de uma pendência não resolvida sobre o fechamento é pendente**
  (§8): a fila **sinaliza**; a decisão de fechar (T057) é **humana** e **não**
  automática.

## 7. Autorização e auditoria

- **RH na própria empresa** (V1): visualizar a fila, revisar e transicionar
  pendências são operações **exclusivas do RH da empresa** dona do vínculo.
- **404 anti-enumeração** (ADR 0006; Constituição, Princípio II): acesso a
  pendência de **outra** empresa retorna **não encontrado**, sem revelar
  existência ou metadados.
- **`master_tecnico` sem mutação trabalhista** (ADR 0012 dec. 3): não revisa,
  não transiciona, não descarta.
- **DP, `gestor` e colaborador são negados** para operações da fila no V1.
- **Auditoria append-only** (ADR 0004): abertura, mudança de estado e descarte
  técnico são **auditáveis**, sem dado pessoal/valor sensível em claro; correção
  é evento complementar, nunca edição.

## 8. Pendências explícitas (RH / Jurídico)

| Pendência                                                                          | Responsável   |
| ---------------------------------------------------------------------------------- | ------------- |
| **Critérios exatos de severidade** (limiares informativa/atenção/crítica).         | RH            |
| **Prazo de revisão** das pendências antes do fechamento.                           | RH + Jurídico |
| **Efeito de pendência não resolvida** sobre o fechamento (bloqueia? só sinaliza?). | RH + Jurídico |
| **Motivo e evidência do descarte técnico** (`descartada_por_erro_tecnico`).        | RH            |
| **Reabertura** de item em estado terminal.                                         | RH + Jurídico |
| **Retenção, descarte e base legal** dos itens de fila (`DP-3J-11`).                | RH + Jurídico |
| **Novos tipos de pendência** além do catálogo inicial (§3).                        | RH            |
| **Integração futura** (ex.: notificação, relatório consolidado) — decisão própria. | RH + Produto  |

Herdados e ainda bloqueantes de **dado real**: **MFA** (ADR 0003), `DS-OPS-01`,
`DP-3J-09` (validade legal), `DP-3J-11` (retenção). Enquanto abertos, **nenhum
dado real** entra em nenhum ambiente.

## 9. Cenários sintéticos

Valores **fictícios e sintéticos** (sem CPF, nome, marcação bruta, horário
exato, arquivo ou dado pessoal).

### 9.1 Jornada incompleta revisada pelo RH, sem alterar saldo

`Empresa A`, `Vínculo V-001`, período `2026-08-10`:

- Pendência: `{ id: "PEND-DEMO-0001", tipo: "jornada_incompleta", severidade:
"atencao", origemTecnica: "apuracao", situacao: "aberta",
motivoCodificado: "PAR_INCOMPLETO_DEMO", refAuditoria: "AUD-DEMO-0001" }`.
- Percurso: `aberta` → `em_revisao_rh` → `resolvida_sem_alteracao_automatica`.
- Efeito no Banco de Horas: **nenhum**. A fila **não** ajusta marcação nem altera
  saldo (T052); a resolução é **registro técnico** da revisão humana.

### 9.2 Importação não associada descartada como erro técnico, com histórico preservado

- Pendência: `{ id: "PEND-DEMO-0002", tipo: "dado_importacao_nao_associado",
severidade: "critica", origemTecnica: "importacao", situacao: "aberta",
motivoCodificado: "SEM_VINCULO_DEMO", refAuditoria: "AUD-DEMO-0002" }`.
- Percurso: `aberta` → `em_revisao_rh` → `descartada_por_erro_tecnico`.
- O descarte é **aditivo e auditável** (§7): o item permanece no histórico como
  `descartada_por_erro_tecnico` com motivo codificado — **nada** é apagado, e
  **nenhum** dado bruto de importação (AFD/CPF) é exposto.

## 10. Critérios de aceite (da especificação — não de implementação)

- [ ] Premissas aprovadas (V1–V7) transcritas com origem, sem reabrir.
- [ ] Fronteiras/handoffs: apuração T050 → extrato T052 → propostas T054 → fila →
      fechamento T057, com a fila como revisão anterior ao fechamento (§2).
- [ ] Tipos iniciais conceituais (§3); novos tipos ficam como pendência.
- [ ] Estrutura mínima da pendência só por referências técnicas, sem dado
      pessoal/bruto (§4).
- [ ] Estados/transições conceituais com terminais explícitos, sem correção
      trabalhista nem efeito de saldo (§5).
- [ ] Severidade só como priorização (sem cálculo/efeito, sem bloquear
      fechamento); critérios pendentes (§6.1).
- [ ] Critérios de "pronto para fechamento" conceituais; fila não aprova
      compensação nem vira débito; alerta não é cálculo (§6.2).
- [ ] Autorização (RH próprio; 404 anti-enumeração; `master_tecnico` sem mutação;
      DP/gestor/colaborador negados) e auditoria append-only (§7).
- [ ] Pendências explícitas para RH/Jurídico (§8).
- [ ] Dois cenários sintéticos (§9).
- [ ] Nenhum valor monetário, Folha, ajuste de marcação, código ou dado real.

## 11. Declaração

Este documento **especifica** o contrato conceitual da fila "Ponto > Verificar
folhas" V1 — fronteiras/handoffs, tipos de pendência, estrutura mínima por
referência técnica, estados/transições, severidade como priorização, critérios
conceituais de "pronto para fechamento", autorização/auditoria, pendências e
cenários sintéticos. **Nenhuma linha de código, teste, schema, migration,
endpoint, API, UI funcional, fila real, importação, associação por CPF, ajuste
de marcação, cálculo, Banco de Horas, compensação efetiva, fechamento
automático, PDF/Espelho real, assinatura, Folha, pagamento, valor monetário ou
dado real** é criada por este documento. Ele **não decide regra trabalhista
nova**, **não altera** nenhuma decisão existente, **não corrige nem calcula**
nada (só sinaliza para a revisão humana do RH), **não declara** conformidade com
a **CCT** ou a **Portaria MTP 671** e **não faz** interpretação jurídica. As
pendências (§8), `DP-3J-09`, `DP-3J-11`, **MFA** e `DS-OPS-01` permanecem
**exatamente como estavam**. Enquanto esses gates estiverem abertos, **nenhum
dado real** entra em nenhum ambiente.
