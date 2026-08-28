# Etapa 3 — Nota de convergência com a CCT 2026/2027 (Jornada e Ponto V1)

- Status: **Nota de convergência (T050 — complemento).** Registra **apenas
  impactos operacionais** de uma Convenção Coletiva de Trabalho (CCT) 2026/2027
  recebida sobre a especificação de Jornada e Ponto. **Não** declara
  conformidade jurídica, **não** interpreta a CCT e **não** transcreve nenhum
  dado pessoal, assinatura, identificação, número de registro, CNPJ, nome de
  entidade ou cláusula literal do PDF recebido.
- Data: 2026-08-28 (complemento da T050).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T050** (complemento — convergência
  com a CCT recebida).
- Base factual (não reaberta):
  [Jornada e Ponto V1 detalhada](../modules/etapa3-jornada-ponto-v1-detalhada.md),
  [Caderno de homologação da apuração](../modules/etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md)
  (T049), [Motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md)
  (T050), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA
  antes de dado real), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico como função responsável), [pacote de decisão de segurança
  operacional](pacote-decisao-seguranca-operacional.md) (`DS-OPS-01`),
  [glossário Reserva Fiscal](glossario-reserva-fiscal.md).
- Constituição: v1.3.0 — Princípio I (regra trabalhista parametrizada,
  versionada, aprovada pelo responsável — não inventada); Princípio II
  (privacidade/menor privilégio; MFA antes de dado real; sem dado pessoal em
  repositório); Princípio IV (dado sintético; sem transformar interpretação não
  confirmada em regra de produção).

## 0. Natureza e limites desta nota

Uma **CCT 2026/2027** foi recebida em PDF. Esta nota **registra apenas os
impactos operacionais** dessa CCT sobre a especificação de Jornada e Ponto —
para orientar a modelagem e o motor de apuração — **sem**:

- **declarar conformidade jurídica**, validade de jornada, enquadramento do REP
  ou adequação a qualquer norma (isso permanece em `DP-3J-09`, com o Jurídico);
- **interpretar** juridicamente a CCT ou derivar direitos/obrigações dela;
- **transcrever ou copiar** do PDF qualquer **dado pessoal**, **assinatura**,
  **identificação**, número de registro, CNPJ, nome de entidade sindical,
  cláusula literal, valor, percentual ou tabela — **nada** do conteúdo
  identificável é versionado;
- **habilitar dado real**: MFA (ADR 0003) e `DS-OPS-01` seguem duros;
  retenção/base legal seguem pendentes (`DP-3J-11`, `DP-3J-09`).

O **PDF da CCT é um ativo protegido** e **não** é (nem pode ser) versionado no
repositório, usado como fixture ou anexado a esta documentação — mesma regra já
aplicada ao arquivo AFD real
([parser §9](../modules/etapa3-parser-afd-contrato-tecnico-v1.md)).

## 1. Impactos operacionais registrados (somente estes)

| #   | Impacto operacional                                                                         | Efeito na especificação                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **Jornada semanal de 44h distribuída de segunda a sexta.**                                  | Converge com a referência já recebida (R10 do caderno; [detalhada §2.4](../modules/etapa3-jornada-ponto-v1-detalhada.md)): 44h de seg a sex. Sem nova declaração de validade legal.  |
| C2  | **Horário com sábado pode permanecer cadastrado, porém fica inativo/não atribuível no V1.** | Mesmo tratamento da decisão D1 (horário sem base operacional confirmada permanece cadastrado, inativo/não atribuível; desativação lógica; RH habilita/desabilita por empresa).       |
| C3  | **Compensação de sábado durante a semana depende de acordo aplicável.**                     | O sistema **apenas apura a tabela de horário vigente**; **não valida acordo** individual ou coletivo. A existência/validade do acordo é externa ao módulo de Ponto.                  |
| C4  | **Horas extras, DSR e trabalho em feriado possuem efeitos financeiros/condições próprias.** | **Cálculo monetário e Folha continuam fora do módulo de Ponto** (R9; `DP-3J-21`, cálculo financeiro). O Ponto produz **horas e apontamentos**, nunca valor, percentual ou pagamento. |
| C5  | **Atestados têm prazo operacional previsto na CCT.**                                        | Enquanto **não houver conteúdo documental autorizado** (Nível 2 de Documentos, bloqueado), a validação de atestado segue **manual pelo RH**; o Ponto apenas registra a situação.     |
| C6  | **A CCT não substitui os gates.**                                                           | Permanecem: **RH/Jurídico** (base legal, retenção, validade — `DP-3J-09`/`DP-3J-11`), **MFA** (ADR 0003) e a **decisão sobre dado real** (`DS-OPS-01`). A CCT não os dispensa.       |

Nenhum outro impacto é inferido a partir da CCT. O que não está acima **não** é
extraído do PDF nem presumido.

## 2. Efeito no motor puro de apuração (T050)

Coerente com o [motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md),
o núcleo `apps/api/src/ponto/apuracao/`:

- **não calcula percentuais monetários** de hora extra, DSR, salário ou Folha
  (C4) — devolve **minutos** e **apontamentos não financeiros**;
- **não aceita nem valida acordo** individual ou coletivo (C3) — não há
  parâmetro de acordo; compensação gera **débito proposto** da jornada prevista,
  **sem** validar saldo ou acordo;
- **não trata feriado trabalhado como operação regular automática** (C4): em dia
  de feriado o motor **não** apura jornada como regular; se houver marcações,
  emite um **apontamento não financeiro** `feriado_trabalhado_sinalizado` para
  tratamento manual do RH, **sem** cálculo, crédito ou débito;
- mantém os resultados como **horas e apontamentos sintéticos**, **sem** efeito
  financeiro;
- oferece um **alerta não financeiro** de **jornada acima de um limite diário
  configurado** (`alerta_jornada_diaria_excedida`): quando a jornada computada
  ultrapassa um limite **fornecido pelo chamador** (nunca um valor legal fixado
  no código), o motor **sinaliza** — **sem bloquear** e **sem calcular
  pagamento**. O limite é **configuração**, não interpretação da CCT.

## 3. Gates preservados e declaração

Esta nota **não** relaxa nenhum gate: `DP-3J-09` (validade legal), `DP-3J-11`
(retenção/descarte), `DP-3J-18` (exemplos completos), `DP-3J-20`
(fornecedor/leiaute), `DP-3J-22` (marcos dos horários), o **cálculo financeiro**
de `DP-3J-21`, **MFA** (ADR 0003) e `DS-OPS-01` — todos **como estavam**.

Esta nota **registra impactos operacionais** de uma CCT 2026/2027 recebida sobre
Jornada e Ponto e o **efeito não financeiro** no motor puro. **Não declara
conformidade jurídica**, **não interpreta** a CCT, **não transcreve** dado
pessoal, assinatura, identificação ou cláusula do PDF, e **não habilita** dado
real. A validade legal e o enquadramento seguem **exclusivamente** com o
**Jurídico** (`DP-3J-09`); a governança de privacidade é **RH + Jurídico**
(ADR 0012).
