# Etapa 3 — Contrato da compensação de Banco de Horas (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T053). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código, teste,
  schema, migration, endpoint, API, UI, cálculo com dado real, valor monetário
  ou dado real aqui — apenas o **contrato conceitual** da **compensação
  proposta** de Banco de Horas V1 (fronteira proposta × débito efetivado,
  estados, informações mínimas, invariantes, autorização, relação com o núcleo
  T052, alertas, pendências e cenários sintéticos).
- Data: 2026-08-28 (T053).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T053** (contrato da compensação de
  Banco de Horas V1).
- Base factual (não reaberta — este contrato **consolida**, não decide regra
  trabalhista nova):
  [Contrato do ciclo de vida do Banco de Horas V1](etapa3-banco-horas-ciclo-vida-contrato-v1.md)
  (T051 — movimentos, invariantes, quitação, BH-01..08; fundação T052),
  [Motor de apuração puro V1](etapa3-motor-apuracao-puro-v1.md)
  (T050 — impacto diário; D2/D3),
  [Caderno de homologação da apuração](etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  (T049), [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§2.6 compensação, §2.8 banco), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1). Núcleo de extrato implementado: `apps/api/src/ponto/banco-horas/`
  (T052).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only via `AuditService.record()`, correção por evento
  complementar), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico; `master_tecnico` sem mutação trabalhista),
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

Este documento **especifica o contrato conceitual** da **compensação proposta**
de Banco de Horas V1: como uma proposta de compensação nasce, é revisada,
aprovada, recusada ou cancelada pelo RH, e por que **uma proposta — mesmo
aprovada — não altera saldo nem extrato**. Ele **organiza** o que já foi decidido
(T050/T051/T052) e **delimita** o que segue aberto — **sem** implementar nem
inventar regra trabalhista.

**Invariável neste documento:**

- **Não implementa nada:** sem código, teste, schema, migration, endpoint, API,
  UI, job, dependência ou configuração.
- **Não calcula dinheiro:** nenhum valor monetário, salário, adicional, DSR
  monetário, percentual, pagamento ou integração com Folha.
- **Não inventa regra trabalhista:** saldo disponível, ordem de consumo,
  validade de crédito, política de saldo negativo, alçada definitiva, documento
  e retenção seguem **pendentes** (§8) — nenhum é presumido aqui.
- **Não usa dado real:** nenhum nome, CPF, texto de ponto bruto, arquivo ou
  print. Os exemplos são **sintéticos** (`Empresa A`, `Vínculo V-001`).
- **Não declara conformidade** com a **CCT** nem com a **Portaria MTP 671** e
  **não faz interpretação jurídica**.
- **Não habilita dado real:** MFA (ADR 0003) e `DS-OPS-01` seguem duros;
  retenção/base legal seguem pendentes.

## 1. Decisões já consolidadas (transcrição, não nova decisão)

Registradas como já aprovadas; nenhuma é reaberta aqui.

| #   | Decisão consolidada                                                                               | Origem                   |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| D1  | **Hora extra positiva entra exclusivamente como crédito** no Banco de Horas.                      | T050 D2 / T051 B1        |
| D2  | **Crédito e débito são eventos distintos**; **não existe compensação automática**.                | T050 D2 / T051 B2        |
| D3  | **Saldo é derivado de eventos imutáveis**, nunca "zerado" apagando histórico.                     | T051 B6/§4 / T052        |
| D4  | **RH é o único operador trabalhista**, restrito à própria empresa.                                | T051 B4 / ADR 0008       |
| D5  | **`master_tecnico` não faz mutação trabalhista**; DP, gestor e colaborador são negados.           | ADR 0012 / T051 §6       |
| D6  | **Limites +38h / −24h são somente alertas** — não bloqueiam nem decidem.                          | T049 R5 / T051 B3        |
| D7  | **Pagamento, Folha, dinheiro, salário, adicional e DSR monetário ficam fora do módulo de Ponto.** | T050 D3 / T051 B7        |
| D8  | **Quitação pela Folha é futura e bloqueada** por BH-04, BH-05 e BH-06.                            | T051 B5/B8/§7            |
| D9  | **Não declarar conformidade** com CCT ou Portaria 671.                                            | CCT (nota) / T050 / T051 |

## 2. Fronteira: compensação proposta × débito efetivado

A **compensação proposta** é uma **intenção** do RH de lançar, no futuro, um
débito de compensação no Banco de Horas. Ela é **estritamente separada** do
**débito efetivado**:

| Conceito                            | O que é                                                                                                                  | Efeito no saldo/extrato                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Compensação proposta**            | Registro de uma **intenção** (workflow de proposta, §3), com minutos e período de referência.                            | **Nenhum** — proposta **não** toca saldo nem extrato.             |
| **Débito de compensação efetivado** | Um **movimento** `debito_compensacao` no extrato (núcleo T052), criado por um evento **futuro, explícito e autorizado**. | Entra no extrato como **débito**, alterando o saldo **derivado**. |

- **A proposta não altera saldo nem extrato.** Enquanto está em qualquer estado
  do workflow (§3), inclusive **aprovada**, ela **não** é um movimento e **não**
  aparece no extrato do núcleo T052.
- **Somente um evento futuro autorizado** — o **registro explícito** — poderá
  criar o `debito_compensacao` no extrato. Esse registro é **separado** da
  aprovação (§4 invariante): aprovar a proposta **não** a transforma
  automaticamente em movimento.
- Este contrato cobre a **proposta** e sua fronteira; o **registro** do débito
  usa o núcleo T052 por um adaptador futuro (§6) — **não** implementado aqui.

## 3. Estados conceituais e transições

Estados **conceituais** mínimos da compensação proposta (nomes conceituais,
**não** schema/enum de banco):

| Estado                   | Significado                                                                           | Terminal?                         |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------- |
| `rascunho`               | RH criou a proposta; ainda editável, **sem** revisão.                                 | Não                               |
| `submetida_para_revisao` | RH submeteu a proposta para revisão (alçada a definir, BH-04).                        | Não                               |
| `aprovada_para_registro` | Revisão aprovou a proposta **para futuro registro** — **ainda não é movimento** (§4). | **Sim (do workflow de proposta)** |
| `recusada`               | Revisão recusou a proposta — **não** altera saldo.                                    | **Sim**                           |
| `cancelada`              | RH cancelou a proposta antes de um estado terminal de aprovação/recusa.               | **Sim**                           |

### 3.1 Transições permitidas

```text
rascunho                 ──▶ submetida_para_revisao
rascunho                 ──▶ cancelada
submetida_para_revisao   ──▶ aprovada_para_registro
submetida_para_revisao   ──▶ recusada
submetida_para_revisao   ──▶ cancelada

aprovada_para_registro   ──▶ (nenhuma)   terminal do workflow de proposta
recusada                 ──▶ (nenhuma)   terminal
cancelada                ──▶ (nenhuma)   terminal
```

### 3.2 Regras da máquina de estados

- **`aprovada_para_registro` encerra o workflow de proposta**, mas **não** cria
  movimento: é a autorização para um **registro futuro e explícito** (§2, §6).
- **Terminais não têm saída**: correção é **nova proposta** (nunca mutação do
  estado terminal — mesma imutabilidade da ADR 0004 dec. 3).
- **Toda transição é auditável** (§5): ator, empresa, proposta, estado de/para,
  resultado — sem dado pessoal.

## 4. Informações conceituais da proposta

Campos **conceituais** (sujeitos à modelagem; **não** schema). Só endereçamento
técnico — **sem** nome, CPF, texto de ponto bruto ou dado real:

| Campo (conceitual)     | Papel                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| `id`                   | Identificador **técnico** da proposta, único por empresa.                       |
| `empresaRef`           | Referência **técnica** da empresa (`empresa_id`), nunca razão social real.      |
| `vinculoRef`           | Referência **técnica** do vínculo (`VinculoFuncional`), nunca nome/CPF.         |
| `periodoReferencia`    | Dia/período de referência da compensação, `"AAAA-MM-DD"` (ou faixa técnica).    |
| `minutosPropostos`     | Minutos propostos para o futuro débito (inteiro positivo).                      |
| `justificativaTecnica` | Motivo **codificado** (catálogo controlado, sem texto livre — ADR 0008 dec. 5). |
| `criadorTecnico`       | Ator **técnico** que criou (papel/ID técnico do RH), nunca nome.                |
| `situacao`             | Estado atual (§3).                                                              |
| `refAuditoria`         | Referência técnica ao evento de auditoria da transição (ADR 0004).              |

## 5. Invariantes

1. **Nenhuma aprovação automática.** Toda transição para
   `aprovada_para_registro` é **ação humana do RH** (revisão), nunca inferida
   pelo sistema; limites de banco (§7) **não** aprovam nem recusam sozinhos.
2. **Uma proposta aprovada ainda não é movimento.** `aprovada_para_registro`
   **não** cria `debito_compensacao` no extrato; ela apenas **autoriza** um
   registro futuro (§2, §6).
3. **Somente o registro explícito cria o débito.** Apenas um evento futuro,
   autorizado e explícito, insere o `debito_compensacao` no extrato (núcleo
   T052) — separado da aprovação.
4. **Recusada/cancelada não altera saldo.** Estados terminais de recusa/
   cancelamento **não** produzem movimento e **não** tocam o extrato.
5. **Histórico e auditoria append-only.** Proposta e transições são
   **imutáveis**; correção é **nova proposta**/evento complementar, nunca edição
   (ADR 0004).
6. **Segregação por empresa e vínculo.** Toda proposta é estritamente por
   `empresa_id` (ADR 0006) e por vínculo (ADR 0007).

## 6. Relação com o núcleo T052 (registro futuro)

- O **núcleo de extrato (T052)** já aceita o movimento `debito_compensacao`
  (origem `apuracao_debito_compensacao`) e o mantém **separado** do crédito, sem
  compensar automaticamente ([banco-horas §T052](etapa3-banco-horas-ciclo-vida-contrato-v1.md)).
- Um **futuro adaptador** deverá receber **apenas** a compensação **aprovada e
  registrada** e convertê-la num **movimento de débito** para o núcleo T052.
  Esse adaptador:
  - **não** decide **saldo disponível** (não valida se há crédito suficiente);
  - **não** aplica **ordem de consumo** (FIFO/LIFO/competência);
  - **não** trata **validade/expiração de crédito**;
  - **não** decide **política de saldo negativo** (o núcleo permite saldo
    negativo apenas como resultado matemático — T052);
  - **não** calcula dinheiro, Folha ou pagamento.
- Enquanto o registro não é implementado, a proposta permanece **fora** do
  extrato (§2). **Nada** neste contrato cria movimento.

## 7. Alertas não financeiros (+38h / −24h)

- Os limites **+38h / −24h** são **somente alertas** (D6): sinalizam o saldo
  **derivado** para o RH, **sem** efeito financeiro.
- Um alerta **não bloqueia** a criação/submissão de uma proposta, **não**
  aprova nem recusa automaticamente e **não** cria movimento. A decisão sobre a
  proposta é **sempre humana** (RH), pelos estados do §3.

## 8. Pendências explícitas (RH / Jurídico / Folha)

Aplicam-se as pendências **BH-01..08** do
[contrato do ciclo de vida (T051)](etapa3-banco-horas-ciclo-vida-contrato-v1.md),
em especial:

| ID    | Pendência aplicável à compensação                                                          | Responsável                  |
| ----- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| BH-02 | **Ordem de consumo** dos créditos ao registrar um débito de compensação.                   | RH                           |
| BH-03 | **Possibilidade/tratamento de saldo negativo** ao registrar compensação.                   | RH + Jurídico                |
| BH-04 | **Alçada/aprovação definitiva** da proposta (quem revisa/aprova; segregação de funções).   | RH + Jurídico                |
| BH-05 | **Documento** da compensação (existe? formato? — liga-se a Documentos Nível 2, bloqueado). | RH + Jurídico                |
| BH-06 | **Integração com a Folha** e efeito monetário (fora do Ponto).                             | Folha + Jurídico + Diretoria |
| BH-01 | **Validade/expiração dos créditos** consumidos pela compensação.                           | RH + Jurídico                |
| BH-07 | **Retenção/descarte** das propostas e eventos de compensação.                              | RH + Jurídico (`DP-3J-11`)   |
| BH-08 | **Semântica do ajuste humano** relacionado à compensação.                                  | RH                           |

Herdados e ainda bloqueantes de **dado real**: **MFA** (ADR 0003), `DS-OPS-01`,
`DP-3J-09` (validade legal), `DP-3J-11` (retenção). Enquanto abertos, **nenhum
dado real** entra em nenhum ambiente.

## 9. Autorização e auditoria

- **RH da própria empresa** cria, revisa, aprova, recusa ou cancela a proposta,
  restrito ao **próprio `empresa_id`** (D4).
- **`master_tecnico` não faz mutação trabalhista** (D5; ADR 0012 dec. 3): não
  cria, revisa, aprova, recusa, cancela nem registra compensação.
- **DP, `gestor` e colaborador são negados** para toda operação de compensação
  no V1 — sem acesso por analogia.
- **Isolamento com 404 anti-enumeração** (ADR 0006; Constituição, Princípio II):
  tentativa de operar/consultar proposta de **outra** empresa retorna
  **não encontrado**, sem revelar existência ou metadados.
- **Auditoria append-only** (ADR 0004): criação e cada transição de estado são
  **auditáveis**, sem valor sensível em claro; correção é evento complementar.

## 10. Cenários sintéticos

Valores **fictícios e sintéticos** (sem CPF, nome, empresa real, texto de ponto
bruto ou dado real). Ilustram a **fronteira** proposta × registro.

### 10.1 Proposta aprovada, ainda sem impacto no extrato

`Empresa A`, `Vínculo V-001`:

| Campo                  | Valor sintético                 |
| ---------------------- | ------------------------------- |
| `id`                   | `COMP-DEMO-0001`                |
| `empresaRef`           | `EMP-A` (técnico)               |
| `vinculoRef`           | `V-001` (técnico)               |
| `periodoReferencia`    | `2026-08-10`                    |
| `minutosPropostos`     | `120`                           |
| `justificativaTecnica` | `COMP_MOTIVO_DEMO` (codificado) |
| `situacao`             | `aprovada_para_registro`        |
| `refAuditoria`         | `AUD-DEMO-0001` (ilustrativa)   |

Efeito no extrato do Banco de Horas: **nenhum**. Mesmo `aprovada_para_registro`,
a proposta **não** é movimento; o saldo derivado (núcleo T052) **não muda**
(invariantes §5.2/§5.4).

### 10.2 Registro futuro do débito de compensação (impacto separado, histórico preservado)

Quando o **registro explícito** futuro ocorrer (fora desta fatia), a proposta
aprovada gera **um** movimento de débito no extrato (T052):

| Movimento (T052)   | Natureza | Minutos | Origem                        |
| ------------------ | -------- | ------: | ----------------------------- |
| `COMP-DEMO-0001-R` | débito   |     120 | `apuracao_debito_compensacao` |

Sobre um extrato sintético que já tivesse, por exemplo, `+185` de saldo derivado,
o débito de `120` leva o saldo a `+65` — por **soma assinada derivada**, **sem**
apagar nem fundir nenhum crédito anterior (T051 §4; T052). O crédito e o débito
permanecem **eventos distintos**; a proposta original permanece no histórico como
`aprovada_para_registro`, e o débito é um **movimento separado** — nunca um
"líquido" automático.

## 11. Critérios de aceite (da especificação — não de implementação)

- [ ] Decisões consolidadas (D1–D9) transcritas com origem, sem reabrir.
- [ ] Fronteira proposta × débito efetivado clara: proposta não altera saldo/
      extrato; só registro futuro autorizado o faz (§2).
- [ ] Estados mínimos (`rascunho`, `submetida_para_revisao`,
      `aprovada_para_registro`, `recusada`, `cancelada`) com transições e
      terminais (§3).
- [ ] Informações conceituais da proposta por referências técnicas, sem dado
      real (§4).
- [ ] Invariantes: sem aprovação automática; aprovada ≠ movimento; só registro
      explícito cria débito; recusada/cancelada não altera saldo; append-only
      (§5).
- [ ] Autorização: RH da própria empresa; 404 anti-enumeração; Master/DP/gestor/
      colaborador negados (§9).
- [ ] Relação com T052: adaptador futuro recebe só a compensação aprovada e
      registrada; não decide saldo/ordem/validade/saldo negativo (§6).
- [ ] Alertas +38h/−24h só alertam; não bloqueiam nem decidem (§7).
- [ ] Pendências BH-01..08 aplicáveis explícitas (§8).
- [ ] Dois cenários sintéticos (proposta aprovada sem impacto; registro futuro
      com impacto separado e histórico preservado) (§10).
- [ ] Nenhum valor monetário, Folha, pagamento, schema, endpoint, UI, código ou
      dado real produzido.

## 12. Declaração

Este documento **especifica** o contrato conceitual da compensação proposta de
Banco de Horas V1 — fronteira proposta × débito efetivado, estados e transições,
informações mínimas por referência técnica, invariantes, autorização/auditoria,
relação com o núcleo T052, alertas não financeiros, pendências e cenários
sintéticos. **Nenhuma linha de código, teste, schema, migration, endpoint, API,
UI, cálculo com dado real, valor monetário, salário, adicional, DSR monetário,
integração com Folha, pagamento ou dado real** é criada por este documento. Ele
**não decide regra trabalhista nova**, **não altera** nenhuma decisão existente,
**não** cria movimento no extrato, **não declara** conformidade com a **CCT** ou
a **Portaria MTP 671** e **não faz** interpretação jurídica. A quitação segue
futura e bloqueada por **BH-04/05/06**; as pendências `BH-01..08`, `DP-3J-09`,
`DP-3J-11`, o **cálculo financeiro** de `DP-3J-21`, além de **MFA** e
`DS-OPS-01`, permanecem **exatamente como estavam**. Enquanto esses gates
estiverem abertos, **nenhum dado real** entra em nenhum ambiente.
