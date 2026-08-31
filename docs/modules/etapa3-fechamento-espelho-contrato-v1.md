# Etapa 3 — Contrato do fechamento da apuração e do Espelho de Ponto (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T056). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código, teste,
  schema, migration, endpoint, API, UI, cálculo com dado real, valor monetário,
  PDF, assinatura ou dado real aqui — apenas o **contrato conceitual** do
  **fechamento operacional** da apuração de Ponto e da **emissão do Espelho de
  Ponto V1** (fronteiras, estados, pré-condições, conteúdo mínimo, imutabilidade,
  autorização, assinatura manual, pendências e cenários sintéticos).
- Data: 2026-08-31 (T056).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T056** (contrato do fechamento e do
  Espelho de Ponto V1).
- Base factual (não reaberta — este contrato **consolida**, não decide regra
  trabalhista nova):
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2.5 apuração, §2.9 fechamento, §3 espelho, §3.1 conferência/assinatura
  manual, §5 "Verificar folhas"),
  [Motor de apuração puro V1](etapa3-motor-apuracao-puro-v1.md) (T050),
  [Contrato do ciclo de vida do Banco de Horas V1](etapa3-banco-horas-ciclo-vida-contrato-v1.md)
  (T051; extrato T052),
  [Contrato da compensação de Banco de Horas V1](etapa3-banco-horas-compensacao-contrato-v1.md)
  (T053; propostas T054),
  [Caderno de homologação da apuração](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  (T049), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only via `AuditService.record()`, correção por evento
  complementar), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md)
  (documento como ativo protegido; Nível 2 bloqueado),
  [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico; `master_tecnico` sem mutação trabalhista),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (`DS-OPS-01`),
  [nota de convergência com a CCT 2026/2027](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md)
  (referência), [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável — não inventada); Princípio III
  (contrato versionado; documento/exportação como ativo protegido); Princípio IV
  (cenários sintéticos; sem transformar interpretação não confirmada em regra);
  Princípio V (auditoria append-only, segregação de funções, correção aditiva).

## 0. Natureza e limites deste documento

Este documento **especifica o contrato conceitual** do **fechamento operacional**
da apuração de Ponto e da **emissão do Espelho de Ponto V1**: quais estados o
período percorre, quais pré-condições conceituais o fechamento exige, o que o
Espelho contém (só referências técnicas), por que fechar e emitir **não apagam
histórico**, e por que a **assinatura V1 é manual e externa** ao sistema. Ele
**organiza** o que já foi decidido (T037/T049/T050/T051/T052/T053/T054) e
**delimita** o que segue aberto — **sem** implementar nem inventar regra
trabalhista.

**Invariável neste documento:**

- **Não implementa nada:** sem código, teste, schema, migration, endpoint, API,
  UI, job, dependência ou configuração.
- **Não calcula dinheiro:** nenhum valor monetário, salário, adicional, DSR
  financeiro, desconto, percentual ou integração com Folha.
- **Não gera documento real:** **sem** PDF, imagem, arquivo, assinatura
  capturada ou validação de documento físico (§7).
- **Não declara "efeito legal" do fechamento:** o efeito legal depende de
  `DP-3J-09` (validade legal), com o Jurídico — **não** declarado aqui.
- **Não usa dado real:** nenhum nome, CPF, arquivo AFD, print ou dado pessoal.
  Os exemplos são **sintéticos** (`Empresa A`, `Vínculo V-001`).
- **Não declara conformidade** com a **CCT** nem com a **Portaria MTP 671** e
  **não faz interpretação jurídica**.
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros.

## 1. Decisões já aprovadas (transcrição, não nova decisão)

| #   | Decisão aprovada                                                                                                                                                   | Origem                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| F1  | **Período de apuração de dia 26 (mês anterior) a dia 25 (mês corrente).**                                                                                          | T036 (DP-3J-14)            |
| F2  | **Fechamento operacional no dia 25**; ação manual do RH, auditada; **efeito legal não declarado**.                                                                 | T037                       |
| F3  | **RH é o único operador trabalhista**, restrito à **própria empresa**.                                                                                             | T037 / ADR 0008 / ADR 0012 |
| F4  | **Espelho de Ponto V1 é emitido para conferência e assinatura manual do colaborador** (fora do sistema).                                                           | T037 (detalhada §3.1)      |
| F5  | **Assinatura eletrônica é evolução futura bloqueada** por validação Jurídica, normas aplicáveis, MFA, integridade documental, auditoria e controles de documentos. | T037 (detalhada §3.1)      |
| F6  | **Falta não justificada gera apontamento não financeiro de DSR** — sem cálculo monetário.                                                                          | T037 / T050                |
| F7  | **Crédito/débito de Banco de Horas permanecem separados**; o **saldo é derivado** de eventos imutáveis.                                                            | T050 D2 / T051 §4 / T052   |
| F8  | **O módulo de Ponto não calcula dinheiro, salário, adicional, DSR financeiro, desconto ou Folha.**                                                                 | T037 / T050 D3 / T051 B7   |
| F9  | **Não declarar conformidade** com a CCT ou a Portaria 671.                                                                                                         | CCT (nota) / T050 / T051   |

## 2. Fronteiras (apuração → extrato → compensação → verificar folhas → fechamento → espelho)

Cada fronteira é um **handoff explícito**, nunca um atalho.

| #   | Camada                            | Responsabilidade                                                                                       | Onde vive                                        |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | **Apuração diária**               | Impacto do dia (crédito/débito separados, apontamentos) — em minutos.                                  | Motor puro T050 (`apps/api/src/ponto/apuracao/`) |
| 2   | **Extrato / saldo**               | Acumula movimentos; saldo **derivado**.                                                                | Núcleo T052 (`apps/api/src/ponto/banco-horas/`)  |
| 3   | **Propostas de compensação**      | Workflow de proposta (não altera saldo/extrato).                                                       | Núcleo T054 (`apps/api/src/ponto/compensacao/`)  |
| 4   | **Verificar folhas (pendências)** | Triagem do RH das pendências do período — **sem** ação automática (detalhada §5).                      | Fila do RH (spec)                                |
| 5   | **Fechamento operacional**        | RH declara o período fechado (dia 25, F1/F2) após revisar pendências — **sem** efeito legal declarado. | **Este contrato** (conceitual)                   |
| 6   | **Emissão do Espelho**            | Superfície de leitura consolidada do período, emitida para conferência/assinatura **manual** (F4).     | **Este contrato** (conceitual)                   |

- O fechamento **consome** os resultados das camadas 1–4; **não** os recalcula.
- **Compensações ainda propostas (T054) não viram débito** ao fechar (§3); só um
  registro futuro autorizado o faria (T053/T055, pendente).
- **Alertas +38h/−24h** (T051 B3) são **sinal não financeiro**; **não** são
  cálculo nem bloqueiam o fechamento por si.

> **Ponteiro (T058).** A camada 4 (**Verificar folhas**) — fila de **revisão
> humana** anterior ao fechamento, com tipos de pendência, estados conceituais e
> severidade só como priorização (sem cálculo, sem bloquear automaticamente o
> fechamento) — está especificada no
> [contrato da fila "Verificar folhas" V1](etapa3-fila-verificar-folhas-contrato-v1.md).
> A fila **sinaliza**; a decisão de fechar (T057) é humana e não automática.

## 3. Estados conceituais do período e transições

Estados **conceituais** (nomes conceituais, **não** schema/enum de banco, **não**
API/UI). Descrevem o percurso do período; a modelagem real é futura.

| Estado                          | Significado                                                                                           | Natureza                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| `em_apuracao`                   | Período aberto; apuração diária (T050) acumula impactos no extrato (T052).                            | Conceitual                 |
| `em_verificacao_rh`             | RH triando pendências na fila "Verificar folhas" (detalhada §5).                                      | Conceitual                 |
| `pronto_para_fechamento`        | Pendências revisadas pelo RH; período delimitado e resultados disponíveis (§4).                       | Conceitual                 |
| `fechado_operacionalmente`      | RH fechou o período (F2) — **sem** efeito legal declarado; imutável (§5).                             | Conceitual                 |
| `espelho_emitido`               | Espelho consolidado emitido para conferência (F4).                                                    | Conceitual                 |
| `conferencia_manual_pendente`   | Espelho aguardando conferência/assinatura **manual** do colaborador, **fora do sistema** (§7).        | Conceitual (etapa externa) |
| `conferencia_manual_registrada` | RH registra **operacionalmente** que a conferência manual ocorreu — **sem** capturar assinatura (§7). | Conceitual (etapa externa) |

### 3.1 Transições conceituais

```text
em_apuracao                  ──▶ em_verificacao_rh
em_verificacao_rh            ──▶ pronto_para_fechamento
em_verificacao_rh            ──▶ em_apuracao            (reabertura da triagem — pendente §8)
pronto_para_fechamento       ──▶ fechado_operacionalmente
fechado_operacionalmente     ──▶ espelho_emitido
espelho_emitido              ──▶ conferencia_manual_pendente
conferencia_manual_pendente  ──▶ conferencia_manual_registrada
```

- **Todos os estados e transições acima são apenas conceituais** — **não** há
  schema, enum de banco, endpoint, rota ou UI comprometidos por este documento.
- **Reabertura após `fechado_operacionalmente`** (correção posterior) **não** é
  definida aqui: permanece **pendente** de decisão RH/Jurídico (§5, §8).
- **Toda transição é auditável** (§6), sem dado pessoal em claro.

> **Fundação implementada (T057).** A **máquina de estados** desta seção tem um
> **núcleo TypeScript puro e isolado** em `apps/api/src/ponto/fechamento/`
> (`fechamento.ts`, `fechamento.types.ts`), com fixtures **exclusivamente
> sintéticas** e testes unitários. `transicionarPeriodo(periodo, acao, papel,
refAuditoriaNova)` aplica apenas as transições lineares do §3.1 (sempre por
> ação humana sintética do RH), retornando a cada passo uma **nova versão** do
> período + um **evento técnico de auditoria** (imutável — não muta a entrada;
> `aplicarSequenciaPeriodo` acumula o histórico). O núcleo é **neutro de
> autorização** (permite só `rh`; nega `master_tecnico`/`dp`/`gestor`/
> `colaborador`) e **fail-closed** (campos vazios, data inválida, intervalo
> invertido, estado/ação desconhecidos, papel negado, transição fora de ordem,
> tentativa após terminal). **Permanece fora** (não implementado): reabertura/
> recusa/correção/retrocesso, emissão de PDF/Espelho real/assinatura, movimento
> de Banco de Horas, chamada a T050/T052/T054, saldo, pagamento/Folha — **sem**
> NestJS/Prisma/I/O/rede/banco/dado real.

## 4. Pré-condições conceituais para o fechamento

Para o período ir a `fechado_operacionalmente` (conceitualmente):

- **Período delimitado** pela janela dia 26 → 25 (F1).
- **Pendências revisadas pelo RH** na fila "Verificar folhas" (detalhada §5) —
  a revisão é **humana**; a fila **não** resolve nada automaticamente.
- **Resultados de apuração disponíveis** (T050) e refletidos no extrato (T052).
- **Compensações ainda propostas (T054) não se tornam débito automaticamente** —
  fechar o período **não** registra `debito_compensacao` (T053 §2; T055 pendente).
- **Alertas não financeiros** (+38h/−24h) são **sinal**, **não** cálculo
  financeiro, e **não** decidem o fechamento por si.
- **Bloqueio de fechamento**: pendências abertas de um colaborador/dia geram o
  tipo `bloqueio de fechamento` na fila (detalhada §2.9) — **sinaliza** que o
  período não está pronto, sem impedir ou executar nada automaticamente.

O fechamento é **ação manual do RH** (F2/F3); **nenhuma** dessas pré-condições é
verificada por código neste documento — são conceito para modelagem futura.

## 5. Conteúdo mínimo conceitual do Espelho

O Espelho é uma **superfície de leitura** consolidada do período, por vínculo e
por empresa. Conteúdo **conceitual** (sujeito à modelagem; **não** schema/UI),
**só referências técnicas**:

| Item (conceitual)            | Descrição                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Identificação                | **Referências técnicas** (`empresa_id`, `VinculoFuncional`) — **nunca** nome/CPF.               |
| Período                      | Janela dia 26 → 25 (F1).                                                                        |
| Jornada prevista/computada   | Marcos previstos e jornada computada (T050) — em minutos.                                       |
| Marcações consolidadas       | Resultado consolidado do dia — **sem** conteúdo bruto do arquivo AFD/TXT nem horário em imagem. |
| Apontamentos não financeiros | Ex.: DSR sinalizado em falta não justificada (F6) — **sinalizador**, sem valor.                 |
| Crédito/débito de banco      | Componentes **separados** (F7), em minutos.                                                     |
| Saldo de banco               | **Derivado** dos eventos do extrato (T052) — em minutos.                                        |

- **Não inclui**: CPF, nome, arquivo AFD, imagem, documento real, PDF, assinatura
  ou **valor monetário** (F8).
- O Espelho **não executa** ação (não fecha, não ajusta, não registra
  compensação); é **leitura** (coerente com a detalhada §3).

## 6. Imutabilidade, autorização e auditoria

### 6.1 Imutabilidade

- **Fechar e emitir o Espelho não apagam histórico.** O fechamento é um **evento
  aditivo**; o Espelho é uma **leitura** derivada — nenhum apaga apuração,
  movimento de banco ou pendência.
- **Correções futuras devem ser aditivas e rastreáveis** (novo evento que
  referencia o anterior — ADR 0004 dec. 3; T051 §4). **Reabertura/correção
  posterior** ao fechamento permanece **pendente** de decisão RH/Jurídico (§8).

### 6.2 Autorização e auditoria

- **RH somente na própria empresa** (F3): fechar o período e emitir/registrar a
  conferência do Espelho são operações **exclusivas do RH da empresa** dona do
  vínculo.
- **404 anti-enumeração** (ADR 0006; Constituição, Princípio II): acesso a
  período/espelho de **outra** empresa retorna **não encontrado**, sem revelar
  existência ou metadados.
- **`master_tecnico` sem mutação trabalhista** (ADR 0012 dec. 3): não fecha, não
  emite, não registra conferência.
- **DP, `gestor` e colaborador são negados** para essas operações no V1.
- **Auditoria append-only** (ADR 0004): fechamento, emissão e registro de
  conferência são **auditáveis**, sem dado pessoal/valor sensível em claro.

## 7. Assinatura manual V1 (etapa operacional externa)

- No V1, a **conferência e assinatura do colaborador** são **manuais e externas**
  ao sistema (F4; detalhada §3.1): impressão/processo manual equivalente.
- O sistema **não captura assinatura**, **não armazena imagem**, **não emite PDF
  real** e **não valida documento físico**. O estado
  `conferencia_manual_registrada` (§3) é apenas um **registro operacional** de
  que a etapa externa ocorreu — **sem** conteúdo documental.
- **Assinatura eletrônica é evolução futura bloqueada** (F5) por: validação
  Jurídica, normas aplicáveis, **MFA**, integridade documental, auditoria e
  controles de documentos (Documentos Nível 2, bloqueado — ADR 0011). Nenhum
  desses gates é satisfeito aqui.

## 8. Pendências explícitas (RH / Jurídico / Folha / TI)

| Pendência                                                                               | Responsável             |
| --------------------------------------------------------------------------------------- | ----------------------- |
| **Reabertura/correção** de período `fechado_operacionalmente`.                          | RH + Jurídico           |
| **Prazo de conferência** do Espelho pelo colaborador.                                   | RH + Jurídico           |
| **Tratamento de recusa/discordância** do colaborador na conferência.                    | RH + Jurídico           |
| **Retenção, descarte e base legal** do fechamento e do Espelho (`DP-3J-11`).            | RH + Jurídico           |
| **Formato do Espelho** (layout, campos exibidos).                                       | RH                      |
| **Documento assinado** do Espelho (existência/formato — Documentos Nível 2, bloqueado). | RH + Jurídico           |
| **Assinatura eletrônica** do colaborador (F5).                                          | Jurídico + TI + RH      |
| **Integração com a Folha** e efeito monetário (fora do Ponto, F8).                      | Folha + Jurídico        |
| **Efeito/validade legal** do fechamento (`DP-3J-09`).                                   | Jurídico                |
| **MFA** (ADR 0003) e **`DS-OPS-01`** — pré-condições de dado real.                      | TI/Segurança + conjunta |

Enquanto abertos, **nenhum dado real** entra em nenhum ambiente; o fechamento e o
Espelho permanecem **conceito**, sem implementação.

## 9. Cenários sintéticos

Valores **fictícios e sintéticos** (sem CPF, nome, empresa real, arquivo, print
ou dado pessoal).

### 9.1 Período pronto para fechamento e espelho emitido

`Empresa A`, `Vínculo V-001`, período `2026-07-26`–`2026-08-25`:

- Estado: `pronto_para_fechamento` → (RH fecha) → `fechado_operacionalmente` →
  `espelho_emitido`.
- Espelho (conceitual): período `26/07`–`25/08`; jornada prevista/computada em
  minutos; crédito de banco `+90` e débito `−25` **separados**; saldo derivado
  `+65` (T052); apontamento `dsr_desconto_sinalizado` num dia de falta não
  justificada (F6), **sem** valor.
- Efeito financeiro: **nenhum**. Nenhum `debito_compensacao` é criado ao fechar;
  o saldo continua **derivado** dos eventos; **nada** de dinheiro/Folha.

### 9.2 Espelho em conferência manual, sem impacto financeiro nem alteração de saldo

- Estado: `espelho_emitido` → `conferencia_manual_pendente` (etapa externa).
- O sistema **não** captura assinatura, **não** armazena imagem, **não** emite
  PDF real (§7). Quando a conferência manual ocorre fora do sistema, o RH pode
  registrar `conferencia_manual_registrada` — um **registro operacional**, **sem**
  conteúdo documental.
- Impacto no Banco de Horas: **nenhum**. Conferir/assinar manualmente **não**
  altera saldo, **não** cria movimento e **não** calcula valor. O histórico
  permanece **imutável** (§6.1).

## 10. Critérios de aceite (da especificação — não de implementação)

- [ ] Decisões aprovadas (F1–F9) transcritas com origem, sem reabrir.
- [ ] Fronteiras apuração → extrato → compensação → verificar folhas →
      fechamento → espelho, com handoff explícito (§2).
- [ ] Estados mínimos do período (`em_apuracao` … `conferencia_manual_registrada`)
      declarados **apenas conceituais**, sem schema/API/UI (§3).
- [ ] Pré-condições do fechamento: período delimitado; pendências revisadas;
      resultados disponíveis; compensação proposta não vira débito; alerta não é
      cálculo (§4).
- [ ] Conteúdo mínimo do Espelho só por referências técnicas, sem CPF/nome/AFD/
      imagem/documento/valor (§5).
- [ ] Imutabilidade: fechamento/espelho não apagam histórico; correção aditiva;
      reabertura pendente (§6.1).
- [ ] Autorização (RH próprio; 404 anti-enumeração; `master_tecnico` sem mutação;
      DP/gestor/colaborador negados) e auditoria append-only (§6.2).
- [ ] Assinatura manual V1 como etapa externa; sem captura/imagem/PDF/validação
      física (§7).
- [ ] Pendências explícitas listadas (§8).
- [ ] Dois cenários sintéticos (§9).
- [ ] Nenhum valor monetário, Folha, PDF, assinatura, código ou dado real.

## 11. Declaração

Este documento **especifica** o contrato conceitual do fechamento operacional da
apuração de Ponto e da emissão do Espelho de Ponto V1 — fronteiras, estados
conceituais, pré-condições, conteúdo mínimo por referência técnica,
imutabilidade, autorização/auditoria, assinatura manual externa, pendências e
cenários sintéticos. **Nenhuma linha de código, teste, schema, migration,
endpoint, API, UI, cálculo com dado real, valor monetário, PDF, assinatura,
integração com Folha ou dado real** é criada por este documento. Ele **não decide
regra trabalhista nova**, **não altera** nenhuma decisão existente, **não declara
efeito/validade legal** do fechamento (`DP-3J-09`), **não declara** conformidade
com a **CCT** ou a **Portaria MTP 671** e **não faz** interpretação jurídica. A
assinatura eletrônica segue **bloqueada** (F5); reabertura/correção pós-fechamento
segue **pendente**; e as demais pendências (§8), `DP-3J-09`, `DP-3J-11`, **MFA** e
`DS-OPS-01` permanecem **exatamente como estavam**. Enquanto esses gates
estiverem abertos, **nenhum dado real** entra em nenhum ambiente.
