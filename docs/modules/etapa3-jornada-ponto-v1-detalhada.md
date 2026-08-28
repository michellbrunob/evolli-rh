# Etapa 3 — Jornada e Ponto V1 (detalhada) e a fila "Verificar folhas"

- Status: **Especificação — fase Registrar decisão** (T034, consolidada pela
  T035, corrigida pela T036, ampliada pela T037, complementada pela T039 com
  evidência técnica da entrada AFD e pela T040 com o contrato técnico do
  parser AFD). **Nenhuma fase Implementar é aberta ou autorizada por este
  documento.** Não há código, banco, API, UI funcional, importação ou cálculo
  aqui — apenas especificação.
- Data: 2026-08-24 (T034); consolidação de novas decisões do RH em 2026-08-25
  (T035); correção do período de apuração em 2026-08-25 (T036); decisões
  adicionais (fechamento, espelho assinado, DSR, horários) em 2026-08-25
  (T037); evidência técnica da entrada AFD (fabricante, modelo, extração
  manual via Secullum, estrutura observada) em 2026-08-27 (T039); contrato
  técnico do parser AFD a partir da fonte oficial do MTE (leiaute AFD versão
  "004", Portaria MTP 671/2021) em 2026-08-27 (T040); contrato do lote de
  importação AFD e rastreabilidade em 2026-08-27 (T042).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T034** (detalhamento da V1 e da nova
  função "Verificar folhas"); **T035** (consolidação de decisões do RH que
  resolvem parte das pendências abertas pela T034); **T036** (correção do
  período de apuração para dia 26 a dia 25 do mês seguinte, resolvendo
  `DP-3J-14`); **T037** (fechamento no dia 25, espelho para assinatura manual,
  apontamento de DSR, cadastro/vigência de horários e referência semanal de
  9h/8h); **T039** (evidência técnica confirmada da entrada de Ponto V1:
  fabricante RWTech, modelo BLUE BIOPROX-C, extração manual pelo RH no
  Secullum, arquivo TXT em formato AFD com cabeçalho/batidas/encerramento —
  **não** substitui homologação jurídica nem demais gates, `DP-3J-20`
  parcialmente resolvida); **T040** (contrato técnico do parser AFD a partir da
  fonte oficial do MTE — tipos de registro, campos de rastreabilidade,
  validação estrutural, fail-closed, erro por linha sem expor CPF, auditoria e
  fixtures sintéticos; `DP-3J-20` avança parcialmente — leiaute oficial "004"
  identificado —, preservando homologação do fornecedor e validação jurídica;
  ver [contrato técnico do parser AFD](etapa3-parser-afd-contrato-tecnico-v1.md));
  **T042** (contrato do lote de importação AFD e rastreabilidade — máquina de
  estados, fail-closed × rejeição parcial, cinco camadas separadas, dados
  mínimos/proibições, autorização e gates; ver
  [contrato do lote de importação AFD](etapa3-lote-importacao-afd-contrato-v1.md)).
- Base conceitual (não reaberta): [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  e [Baseline V1 de Jornada e Ponto](../decisions/etapa3-jornada-ponto-baseline-v1.md)
  (8 decisões, 2026-08-07), detalhadas na
  [spec estrutural da Etapa 3](etapa3-jornada-ponto-rastreavel-estrutural.md).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA,
  sessão), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (trilha
  append-only), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresaId`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (perfis; RH + Jurídico como função responsável por privacidade),
  [Painel Administrativo Web V1](painel-administrativo-web-v1.md) (UI-F01/F02/F03),
  [glossário Reserva Fiscal](../decisions/glossario-reserva-fiscal.md),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (MFA/segredos/backup — gates de dado real).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  MFA antes de dado real); Princípio V (auditoria append-only, segregação de
  funções); "Mandatory Architecture and Data Constraints".

## 0. Natureza deste documento e relação com a Baseline V1

A **Baseline V1** (ADR 0008) aprovou um núcleo **deliberadamente mínimo**:
registro manual, catálogo fechado de quatro eventos, correção só por ajuste,
acesso a RH/DP por empresa, competência mensal **sem motor de cálculo** e **sem
aprovação nem fechamento**. Esta T034 **detalha e amplia** esse núcleo com
**entradas de produto/RH** que vão **além** da Baseline V1 — importação de
batidas do relógio, tolerância, situações, banco de horas, fechamento mensal e a
fila "Verificar folhas".

Consequência de disciplina, **inviolável neste documento**:

- Cada capacidade nova além da Baseline V1 (importação, cálculo, banco,
  aprovação, fechamento) é **especificada como alvo**, **não decidida nem
  implementada**. Onde a Baseline V1 dizia "sem cálculo/sem fechamento", esta
  spec **não revoga** aquela decisão — registra que a ampliação **exige decisão
  de produto própria e o gate de validade legal** (DP-3J-09) antes de qualquer
  implementação com dado real.
- As **regras recebidas do RH** (§2, §7) são **requisitos a homologar**, não
  regras homologadas: onde o RH pediu que "a semântica permaneça pendente" ou
  que "a regra automática seja homologada", a **semântica exata é pendência
  bloqueante** (§8), nunca fixada aqui.
- **Nada de dado pessoal real**: este documento (e qualquer fixture/teste
  futuro) **não contém** nome de colaborador, CPF, conteúdo de PDF, screenshot
  ou batida real. Identificadores são abstratos e sintéticos (ex.: `Vínculo
V-001`, `Empresa A`/`Empresa B`).
- **O sistema externo observado (PontoTel) é citado apenas como referência
  operacional/funcional/visual.** **Não existe** integração técnica, API,
  sincronização, scraping, cópia de interface, marca, componente, texto, regra
  proprietária ou dependência com ele no V1 — nem parcial, nem futura por
  inferência. Qualquer eventual integração oficial é decisão própria, futura e
  condicionada (§6.1).
- **Evolli é a fonte de empresas, colaboradores e horários.** O cadastro
  organizacional, o cadastro de colaboradores (Fatia 2) e o catálogo de
  horários (§2.4, §9) são mantidos **no Evolli**, nunca importados de um
  sistema externo. Uma futura integração externa, se e quando decidida, só
  poderia fornecer **marcações brutas** (batidas) — nunca empresa, colaborador,
  horário, cargo ou estrutura, que continuam sendo dado de origem do Evolli.

## 1. Objetivo, limites, atores e isolamento

### 1.1 Objetivo

Especificar, em detalhe e sem implementar, a **V1 operável** de Jornada e Ponto
do Evolli: importar batidas do relógio de forma segura, apurar o dia contra um
horário planejado, expor pendências, manter um banco de horas conceitual e
oferecer um **fechamento mensal** — tudo sob controle **exclusivo do RH** e com
correção **sempre rastreável** (nunca sobrescrita), preservando os princípios da
Baseline V1.

### 1.2 Limites (o que este documento NÃO faz)

- **Não implementa** nada: sem schema, migration, endpoint, model, UI funcional,
  parser de arquivo, job, dependência ou configuração.
- **Não calcula**: nenhum resultado numérico de horas, banco, extra, falta ou
  DSR é produzido aqui; os exemplos são **estruturas a homologar** (§8, DP-3J-18).
- **Consolida** decisões operacionais já recebidas do RH (tolerância, ação de
  limite, almoço mínimo, rejeição parcial, atribuição/vigência de horário,
  período de apuração e dia de fechamento, apontamento de DSR, emissão do
  espelho para assinatura manual — §2, §3, §8.1), mas **não implementa**
  nenhuma delas. **Não decide** leiaute técnico de arquivo, tipo de REP, base
  legal, retenção, cálculo financeiro de DSR ou assinatura eletrônica — seguem
  em §8.
- **Não declara conformidade** legal, trabalhista ou LGPD — inclusive quanto
  à Portaria 671.
- **Não integra** com folha (Etapa 4), nem trata biometria/geolocalização.

### 1.3 Atores

Matriz **operacional decidida** para o V1 (não é pendência). "Operar o ponto" =
cadastrar tabela de horários, importar batidas, visualizar a fila "Verificar
folhas", registrar ajuste, aprovar e fechar (cadastro de horários confirmado
na T037, §2.4).

| Ator                           | Operar o ponto no V1                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RH**                         | **Único perfil autorizado**: cadastra tabela de horários, importa batidas, visualiza a fila "Verificar folhas", registra ajuste, aprova e fecha — **restrito à própria empresa**. |
| **DP**                         | **Negado** para todas essas operações no V1 (a concessão de registrar/consultar da Baseline V1 **não** se estende a operar o ponto aqui).                                         |
| `gestor`                       | **Negado** (escopo indefinido, DP-8/ADR 0006).                                                                                                                                    |
| Colaborador                    | **Negado / sem acesso** (Portal do Colaborador fora de escopo — Baseline V1).                                                                                                     |
| `master_tecnico`               | **Sem mutação trabalhista**: mantém **apenas** os limites técnicos de leitura já aprovados (ADR 0012 dec. 3); **não** importa, ajusta, aprova nem fecha.                          |
| `admin_tecnico`                | **Negado**, sem exceção (ADR 0008 dec. 6; ADR 0012).                                                                                                                              |
| `financeiro`, `auditor`, `dpo` | **Negados** — nenhum recebe acesso por analogia.                                                                                                                                  |

> **Alçada operacional definida (não é pendência do V1).** O requisito aprovado
> pelo RH é inequívoco: **RH é o único perfil** que importa, visualiza a fila
> "Verificar folhas", registra ajuste, aprova e fecha o ponto no V1. **DP,
> `gestor` e colaborador são negados** para essas operações no V1; o
> `master_tecnico` mantém **apenas** os limites técnicos de leitura já aprovados,
> **sem** mutação trabalhista. Qualquer alteração futura de alçada (por exemplo,
> conceder consulta a DP) **exige decisão de produto nova** — **não** é pendência
> em aberto desta V1 e **não** abre a possibilidade de DP operar o ponto no V1.

### 1.4 Isolamento entre empresas

O Evolli inicia com **duas empresas internas** (`Empresa A`, `Empresa B`),
**isoladas por `empresa_id`**, alcançado via `VinculoFuncional` (ADR 0007) — a
**única** fronteira de autorização (ADR 0006). Toda batida, lote, apuração,
banco, fechamento, espelho e item da fila "Verificar folhas" é **estritamente
por empresa**: RH de uma empresa **nunca** vê dado da outra. Não há acesso
cross-company nem global de negócio nesta V1.

## 2. Modelo conceitual

Nomes conceituais (sujeitos a revisão na modelagem real; **não** são schema).
Todos os registros de comportamento/presença ancoram em `VinculoFuncional`,
nunca em `AccessUser` (ADR 0008 dec. 1).

### 2.1 Marcação bruta (batida)

- Registro **imutável** de um instante marcado (data/hora) associado a um
  identificador do colaborador no relógio. A **hipótese** de identificador é o
  **CPF** (§6); a marcação bruta preserva o identificador **como veio**, sem
  normalização destrutiva.
- Origem nesta V1: **importação do relógio** (§6) e **registro manual do RH**
  (Baseline V1, dec. 3, estendida à importação). Sem biometria/geolocalização.
- Nunca é editada ou apagada; correção é por **ajuste** (§2.7).

### 2.2 Lote de importação

- Unidade de importação de um arquivo do relógio: agrupa as marcações brutas de
  uma carga, com **metadados de proveniência** (origem, momento da importação,
  quem importou, contagem) e **resultado** (aceitas, rejeitadas, motivos).
- **Idempotente** (§6): reimportar o mesmo arquivo **não duplica** marcações.
- Auditável (ADR 0004): a importação é uma operação sensível registrada.

### 2.3 Rejeição

- Uma marcação é **rejeitada** quando o identificador (CPF hipotético) está
  **ausente, inválido, ou sem colaborador cadastrado** naquela empresa. O
  sistema **aponta o erro** (não descarta em silêncio) e o expõe na fila
  "Verificar folhas" (tipo `CPF rejeitado`).
- **Decidido (RH, T035 — resolve DP-3J-17):** a rejeição é **por marcação**,
  **nunca** por lote inteiro. Quando um CPF está ausente, inválido ou sem
  colaborador cadastrado, **somente aquela marcação** é rejeitada; cria-se uma
  **pendência** para o colaborador/dia afetado (tipo `CPF rejeitado` na fila,
  §5); o **restante do lote** continua sendo processado normalmente.

### 2.4 Horário planejado (versionado)

- Um **horário** descreve a jornada planejada (marcos de entrada/saída e
  intervalo) de um vínculo/equipe. É **versionado**: mudanças criam nova versão,
  preservando o histórico — a apuração de um dia usa a **versão vigente naquele
  dia**.
- Todos os horários observados são do tipo **semanal** e aparentemente ativos
  (§9). **Não há trabalho inicial** aos sábados, domingos, feriados ou por
  turnos (regra do RH).
- **Não se calcula** duração ou carga semanal a partir da descrição textual do
  horário (§9). Os marcos de alguns horários **ainda não foram recebidos** (§9).
- **Decidido (RH, T035 — resolve DP-3J-19):** o horário é **atribuído no
  cadastro do colaborador** — o vínculo entre horário e colaborador/equipe se
  formaliza ali, não por uma tela ou regra separada. O **detalhamento** dessa
  atribuição (campo, momento específico da interface) é detalhe de modelagem
  futura, não resolvido aqui.
- **Decidido (RH, T037):** **RH cadastra as tabelas de horários por empresa**
  — o cadastro de horários é, junto de importar/ajustar/aprovar/fechar (§1.3),
  operação exclusiva do RH, restrita à própria empresa.
- **Decidido (RH, T035):** cada empresa **visualiza e administra somente as
  próprias tabelas de horários** — mesma fronteira de `empresa_id` (§1.4)
  aplicada especificamente ao catálogo de horários; não há horário
  compartilhado nem visível entre empresas.
- **Decidido (RH, T037):** **cada colaborador possui uma tabela de horário
  vinculada, com vigência** — o vínculo horário↔colaborador (decisão anterior)
  é datado: uma nova vigência substitui a anterior **dali em diante**, nunca
  retroativamente.
- **Decidido (RH, T037 — resolve o efeito de mudança de horário sobre dias já
  apurados, deixado em aberto pela T035):** a **política de apuração do V1 é
  única para todos** os vínculos/horários; **mudanças de horário não podem
  alterar períodos já apurados** — a apuração de um dia permanece a que foi
  calculada com a versão de horário vigente **naquele dia** (reforça a
  imutabilidade já descrita acima), mesmo após uma nova vigência de horário
  entrar em vigor para o colaborador.
- **Requisito operacional recebido (RH, T035; detalhado em T037):** jornadas
  planejadas de **nove horas** foram **confirmadas pelo RH como previstas** no
  V1. A **referência semanal recebida** distribui **44 horas entre segunda e
  sexta**: jornadas previstas de **nove horas de segunda a quinta** e **oito
  horas na sexta**; **sábado e domingo permanecem sem jornada inicial**
  (coerente com "sem trabalho inicial aos sábados/domingos", §2.4 acima). Este
  é um requisito operacional recebido — **não** uma declaração de conformidade
  legal ou trabalhista (inclusive quanto à Portaria 671, §6); a validade da
  carga horária permanece sujeita a DP-3J-09 (validade legal, jurídico).

> **Decisão registrada (T050 — D1).** O horário **2 (HORARIO LIBERTY)**, cujos
> marcos não foram recebidos (DP-3J-22, §9), **permanece cadastrado, porém
> inicialmente inativo/não atribuível** no V1; **RH pode habilitar/desabilitar
> tabelas por empresa** (desativação lógica), e essa mudança **não reabre
> períodos já apurados** (reforça a imutabilidade acima). Ver
> [motor de apuração puro V1 §2](etapa3-motor-apuracao-puro-v1.md). Os marcos
> dos horários 1/2/19 seguem pendentes (DP-3J-22).

> **Convergência com a CCT 2026/2027 (T050 — complemento).** Impactos
> operacionais registrados **sem** declarar conformidade jurídica e **sem**
> copiar dado pessoal/assinatura/identificação do PDF: 44h de seg a sex;
> **horário com sábado pode permanecer cadastrado, porém inativo/não atribuível
> no V1**; compensação de sábado depende de acordo aplicável e **o sistema não
> valida acordo** (apenas apura a tabela vigente); horas extras/DSR/feriado têm
> efeitos financeiros próprios, mas **cálculo monetário e Folha seguem fora do
> Ponto**; atestados com prazo da CCT seguem em **validação manual do RH**
> enquanto não houver conteúdo documental autorizado; e a CCT **não substitui**
> os gates de RH/Jurídico, MFA, retenção/base legal ou a decisão sobre dado
> real. Ver
> [nota de convergência com a CCT](../decisions/etapa3-cct-2026-2027-convergencia-jornada-ponto.md).

> **Fundação implementada (T038).** A **base de cadastro** dos horários acima já
> está implementada no backend (`apps/api`, módulo `horarios`), estritamente
> como fundação: **tabela de horário por empresa** (grade semanal de períodos
> por dia, definição imutável — "alterar" é criar uma **revisão**; desativação
> **lógica**, sem exclusão física) e **vínculo histórico ao colaborador com
> vigência** (início e fim opcional). As garantias de integridade estão **no
> banco, não só no serviço**: sem sobreposição de períodos no mesmo dia
> (EXCLUSION `int4range`), sem duas tabelas vigentes para o mesmo colaborador na
> mesma empresa (EXCLUSION `daterange` + índice parcial), vínculo sempre da
> mesma empresa (FK composta + trigger de integridade colaborador↔empresa).
> **RH é o único operador** (T037); `master_tecnico` só lê; DP/gestor/colaborador
> negados. Tudo auditado sem dado pessoal na trilha. **Fora desta fundação e
> inalterado:** cálculo de jornada/tolerância/banco/DSR, importação
> TXT/REP/AFD, fechamento, espelho, assinatura e UI (§6, §8) — nenhum deles é
> tocado pela T038, que **não** implementa apuração nem habilita dado real
> (MFA, `DS-OPS-01`, DP-3J-09/11 seguem gates).

### 2.5 Apuração diária

- Para um vínculo e um dia, a apuração **compara** as marcações do dia com o
  horário planejado vigente e **classifica** o dia (regular, com pendência, com
  atraso/saída antecipada, com extra, situação registrada, etc.). É a base do
  espelho (§3) e da fila (§5).
- **Nenhum número trabalhista é fixado aqui.** A tolerância de **15 minutos**
  (atraso, saída antecipada e almoço) é **valor aprovado pelo RH**, com
  **semântica decidida (T035 — resolve DP-3J-13): aplicada por dia** — não por
  batida individual nem por período/competência.
- **Período de apuração (RH, T036 — resolve DP-3J-14):** o período de apuração
  **começa no dia 26 de um mês e termina no dia 25 do mês seguinte**. Todos os
  dias do mês (inclusive 29, 30 e 31, quando existirem) pertencem a algum
  período de apuração por essa regra de intervalo — não há dia órfão.

### 2.6 Apontamento (situação do dia)

- Um dia pode carregar uma **situação** codificada (catálogo controlado, sem
  texto livre — ADR 0008 dec. 5): **atestado, folga, férias, compensação,
  almoço livre**. A situação altera a expectativa de apuração do dia.
- **Almoço livre:** deve assegurar **pelo menos uma hora** de intervalo.
  **Decidido (RH, T035 — resolve DP-3J-16):** quando o intervalo apurado for
  **inferior a uma hora**, a apuração **considera automaticamente uma hora
  mínima** de intervalo (não o valor efetivamente apurado). O detalhe de
  implementação desse ajuste automático (onde ele aparece no espelho, como é
  auditado) é detalhe de modelagem futura.

### 2.7 Ajuste (correção rastreável)

- Toda correção é um **novo registro** que referencia o original, com **motivo
  codificado** e **sem texto livre** (ADR 0008 dec. 5). O original permanece
  imutável. Ajuste é ação **manual do RH**, auditada.

### 2.8 Banco de horas (conceitual)

Regras recebidas do RH, **a homologar** (semântica e cálculo pendentes):

- **Horas extras** entram no banco.
- **Atrasos não compensados** na jornada entram no banco.
- **Faltas** entram no banco **apenas se houver saldo positivo**; **sem saldo
  positivo**, no **dia 28** (regra recebida separadamente do fechamento — §2.9
  — não corrigida por este documento) deve haver **relatório** para possível
  **desconto ou manutenção em banco** (decisão humana, nunca automática).
- **Limites:** **+38h** e **−24h**. **Decidido (RH, T035 — resolve DP-3J-15):**
  ao atingir qualquer um dos limites, o sistema **apenas gera alerta** — **não**
  bloqueia, compensa, desconta ou fecha automaticamente. A ação corretiva
  permanece humana (RH), pelos fluxos próprios.
- **Saldo positivo permanece** em banco; **saldo negativo é avaliado
  mensalmente**.
- **Decidido (RH, T037):** falta **não justificada** deve gerar um
  **apontamento** de desconto de DSR — um sinalizador/marcação, **não** um
  cálculo ou desconto financeiro. O **módulo de Ponto não calcula valor
  financeiro, reflexo salarial nem desconto financeiro de DSR**; isso continua
  **dependente da futura Folha e de validação do Jurídico** (decisão 5, T037).
  O desconto de DSR usado em faltas do banco **permanece suspenso até
  autorização dos diretores** (DP-3J-21) quanto ao seu **efeito financeiro** —
  o apontamento não antecipa nem substitui essa autorização.

> O motor de cálculo do banco **não é implementado nem especificado
> numericamente** aqui — permanece dependente de decisão de produto e do gate de
> validade legal (DP-3J-09), coerente com a Baseline V1 (Decisão 6).

> **Decisões registradas (T050 — D2/D3).** **D2:** a **hora extra positiva entra
> exclusivamente no banco de horas** — não vira pagamento nem valor monetário
> nesta fatia — e **não compensa nem apaga** débito de atraso/saída antecipada
> (crédito e débito são componentes separados). **D3:** um **pagamento futuro**
> de saldo positivo **zera o saldo corrente preservando o histórico auditável**,
> **sem** calcular valor monetário nem integrar Folha (o valor segue em
> DP-3J-21, cálculo financeiro). Um **motor puro de apuração diária** (só dado
> sintético, sem dinheiro/persistência/Folha) foi implementado na T050 — ver
> [motor de apuração puro V1](etapa3-motor-apuracao-puro-v1.md).

### 2.9 Fechamento mensal

- **Decidido (RH, T037):** o **fechamento do ponto ocorre no dia 25 de cada
  mês**, cobrindo o **período de apuração do dia 26 do mês anterior ao dia 25
  do mês atual** — coerente com o período decidido em T036 (§2.5, DP-3J-14).
  Após o fechamento de uma competência, o RH **não** deveria alterar marcações
  daquele período por ajuste comum; qualquer exceção é decisão de produto a
  definir.
- O fechamento é **ação manual do RH** e **auditada**. **Efeito legal** do
  fechamento depende de DP-3J-09 (validade legal) — **não declarado** aqui. Esta
  capacidade **estende** a Baseline V1 (que não tinha fechamento) e exige
  formalização própria.
- **Bloqueio de fechamento:** pendências abertas de um colaborador/dia geram o
  tipo `bloqueio de fechamento` na fila (§5), sinalizando que o período **não
  está pronto** — sem impedir ou executar nada automaticamente.

### 2.10 Feriados

- **Feriados nacionais** iniciais; **municipais, pontes e exceções** são
  **cadastrados caso a caso** (entrada do RH). Um dia de feriado **não** tem
  trabalho inicial previsto (regra do RH).
- O **calendário de feriados é por empresa** (ou compartilhado por
  localidade — a confirmar na modelagem), versionado como os horários.

## 3. Cartão / Espelho mensal

Visão **de leitura** por vínculo e competência, **por empresa**. Consolida, para
cada dia do mês:

- **Jornada planejada** (marcos do horário vigente no dia).
- **Marcações** do dia (brutas + efetivas após ajustes), com **original e
  efetivo distintos** (nunca substituídos — ADR 0008 dec. 5).
- **Intervalo** (ex.: almoço) apurado.
- **Horas** do dia (apuradas) e **extras**, quando houver — **exibidas como
  apuração pendente** enquanto o motor de cálculo não for homologado.
- **Banco** (saldo do período) — **conceitual**, sem número fixado aqui.
- **Eventos/situações** do dia (atestado, folga, férias, compensação, almoço
  livre).
- **Pendências** do dia (as mesmas que alimentam a fila §5), com severidade.

O espelho **não executa** ação (não ajusta, não fecha) — é superfície de
consulta; as ações ficam nos fluxos próprios do RH, sempre manuais e auditadas.

### 3.1 Conferência e assinatura manual do colaborador

- **Decidido (RH, T037):** no V1, o **Espelho de Ponto será emitido para
  conferência e assinatura manual do colaborador** — um documento/impressão do
  espelho, conferido e assinado **fora do sistema** (papel ou processo manual
  equivalente). O sistema **não** captura, valida nem armazena essa assinatura
  nesta V1.
- **Bloqueado como evolução futura (RH, T037 — não autorizado agora):**
  **ciência ou assinatura eletrônica do colaborador** é evolução futura,
  **condicionada** a: validação do **Jurídico**, **normas coletivas
  aplicáveis**, **MFA**, **integridade documental**, **auditoria** e
  **controles de documentos**. Nenhum desses gates é satisfeito por este
  documento; nenhuma captura de ciência/assinatura eletrônica é especificada
  em detalhe ou implementada aqui.

## 4. Requisitos visuais para telas futuras (UI-F01/F02/F03)

Requisitos **visuais/estruturais**, não implementação. As telas futuras devem
reutilizar a fundação já entregue, herdando acessibilidade (foco visível,
contraste AA, alvos de 44px, `prefers-reduced-motion`, sem sombra/gradiente) e
seguindo o [`DESIGN-apple.md`](../../DESIGN-apple.md) como referência de tokens.

| Superfície                        | Componentes reutilizados                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shell/base**                    | UI-F01: `tokens.css`, shell semântico (banner único, `main`, rodapé), skip-link.                                                                                                                                                   |
| **Cabeçalho e ações**             | UI-F02: `PageHeader` (título/descrição/ações), `Button` (primária/secundária/discreta), `EmptyState`, `StatusBadge`.                                                                                                               |
| **Espelho mensal**                | UI-F03: `DataTable` (dias × colunas) com rolagem horizontal **contida**; `StatusBadge` para pendência/situação; `Surface` para blocos de resumo.                                                                                   |
| **Verificar folhas (fila)**       | UI-F03: `DataTable` (colaborador × dia × tipo); `StatusBadge` para **severidade** (neutra/atenção/erro) — **cor nunca é o único sinal** (texto + glifo); `FormField`/`FormActions` para **filtros** e para as ações manuais do RH. |
| **Estados vazio/carregando/erro** | UI-F02 `EmptyState` + mensagens neutras; erro com `request_id`, sem detalhe interno (padrão do painel §3.4).                                                                                                                       |

Regras visuais herdadas (não negociáveis): semântica de tabela (`caption`,
`th scope="col"`), rótulo↔controle nos filtros, erro por **texto + ícone +
semântica** (não só cor), responsividade sem rolagem horizontal de página.

## 5. Verificar folhas (nova função)

Fila de trabalho **do RH**, **por colaborador e por dia**, **por empresa**, que
**expõe** o que precisa de atenção antes de um fechamento — **sem** ajustar,
descontar, compensar ou fechar **automaticamente**. É superfície de **triagem e
consulta**; toda ação corretiva permanece manual, auditada e em fluxo próprio.

### 5.1 Tipos iniciais de item

| Tipo                     | Significado (a detalhar na modelagem)                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| `batida ausente`         | Falta uma marcação esperada pelo horário planejado do dia.                     |
| `batida repetida`        | Marcação duplicada/redundante no mesmo marco.                                  |
| `jornada incompleta`     | Conjunto do dia não fecha o par entrada/saída (ou intervalo) esperado.         |
| `fora do padrão`         | Marcação diverge do horário planejado além da tolerância (semântica pendente). |
| `compensação pendente`   | Situação de compensação registrada aguardando tratamento do RH.                |
| `CPF rejeitado`          | Marcação importada sem CPF válido / sem colaborador cadastrado (§2.3).         |
| `bloqueio de fechamento` | Há pendência aberta que sinaliza que o período não está pronto (§2.9).         |

### 5.2 Recursos da fila

- **Filtros:** por empresa (obrigatório), colaborador (vínculo), dia/competência,
  tipo, **severidade** e **estado**.
- **Severidade:** classificação (ex.: informativa / atenção / crítica) — mapeada
  a `StatusBadge` com **texto + glifo**, nunca só cor. Os limiares exatos de
  severidade são detalhe a definir na modelagem.
- **Estado do item:** ex.: aberto / em análise / resolvido (por ação manual do
  RH) — transição **sempre** registrada.
- **Detalhamento seguro:** o detalhe de um item mostra **apenas** o necessário
  (dia, tipo, marcações efetivas), **sem** expor dado pessoal além do
  estritamente operacional e **sem** conteúdo sensível; nada de PDF/screenshot.
- **Auditoria:** abertura, mudança de estado e resolução de cada item são
  **auditáveis** (ADR 0004), sem segredo/valor sensível em claro.

### 5.3 Limites explícitos

A fila **não** ajusta batida, **não** desconta, **não** compensa e **não** fecha
período — **em nenhuma hipótese automaticamente**. Ela **sinaliza**; a decisão e
a ação são **humanas (RH)** e passam pelos fluxos próprios, auditados.

## 6. Importação segura e idempotente via arquivo TXT (leiaute técnico condicionado)

- **Decidido (RH, T035 — resolve parte de DP-3J-20):** a **entrada do Ponto V1
  é arquivo TXT**. Isso fixa o **formato de transporte**, não o **leiaute
  técnico**: **relógio BLUE BIOPROX-C**; **hipótese** de enquadramento na
  **Portaria 671** e **CPF** como identificador do colaborador. O **tipo de
  REP** e o **leiaute oficial** (AFD/AEJ ou outro aplicável) **continuam
  dependentes de confirmação do fornecedor e do Jurídico** — enquanto não
  confirmados, **nenhum parser é especificado nem implementado**.
- **Evidência técnica confirmada (T039 — resolve parcialmente DP-3J-20,
  apenas quanto a formato/origem técnica):**
  - O equipamento de origem é **fabricado pela RWTech**; o modelo do REP é o
    já citado **BLUE BIOPROX-C** (fabricante confirmado, não apenas hipótese
    de modelo).
  - As **batidas do V1 são extraídas manualmente pelo RH no Secullum** — o
    Secullum é o **software de gestão de ponto** de onde o RH exporta o
    arquivo; **não** é o relógio físico. Não há automação da extração nesta
    V1.
  - A **entrada é um arquivo TXT no formato AFD** — isso confirma o **formato
    do arquivo** (AFD), não ainda o **leiaute/versão oficial completa** exigida
    pela Portaria 671 nem seu enquadramento jurídico.
  - A **exportação observada possui cabeçalho, registros de batida e
    encerramento** — estrutura de alto nível observada num arquivo de
    exemplo/amostra; **não** é, por si só, a especificação campo a campo do
    leiaute AFD, que segue pendente de confirmação formal do fornecedor e do
    Jurídico.
  - **Secullum e o relógio são somente origem de dados nesta V1**: **não**
    há, nem está prevista, integração por API, rede ou qualquer comunicação
    direta com o equipamento ou com o Secullum. O RH extrai o arquivo TXT
    manualmente e o importa pelo fluxo próprio do Evolli (§6, quando
    implementado) — reforça o princípio já registrado em §0 e §6 de que a
    fonte externa fornece **apenas marcações brutas**, nunca por
    sincronização automática.
  - **Nenhum arquivo real é ou pode ser versionado**: o arquivo AFD real
    contém **dados pessoais** (batidas associadas a CPF/colaborador) e
    **nunca** pode ser copiado para o repositório, para esta ou qualquer
    outra documentação, para fixtures ou para testes — nem mesmo
    temporariamente. **Testes futuros usarão exclusivamente AFD sintético**,
    construído a partir da estrutura observada (cabeçalho, batidas,
    encerramento), sem qualquer dado pessoal real.
  - **Esta confirmação é técnica, não jurídica**: confirmar fabricante,
    modelo, canal de extração e formato de arquivo **não declara** que o
    Evolli está adequado ou em conformidade com a **Portaria MTP 671**, nem
    substitui a avaliação jurídica do enquadramento (DP-3J-09, DP-3J-20),
    a definição de retenção/descarte (DP-3J-11), o gate de **MFA** (ADR 0003)
    ou os demais controles operacionais (`DS-OPS-01`, pacote de decisão de
    segurança operacional). Nenhum desses gates é satisfeito por esta seção.
- **Idempotência:** a importação de um mesmo arquivo/lote **não** duplica
  marcações (reprocessar é seguro) — mecanismo (ex.: chave natural do
  registro/assinatura do arquivo) a definir na modelagem.
- **Segurança:** importação é operação **do RH**, **por empresa**, **auditada**;
  o arquivo de origem e seu conteúdo **não** são versionados no repositório nem
  usados como fixture com dado real. Erros (CPF ausente/inválido/sem
  colaborador) **são apontados** e caem na fila (§5) **por marcação** (§2.3),
  nunca descartados em silêncio nem invalidando o lote inteiro.
- **Contrato técnico do parser identificado (T040 — avança parcialmente
  DP-3J-20):** o **leiaute oficial do AFD** foi **identificado e citado** da
  fonte oficial do Ministério do Trabalho e Emprego — **AFD versão "004"**,
  referenciado pela **Portaria MTP nº 671/2021**. O **contrato técnico do
  parser** (tipos de registro reconhecidos — cabeçalho tipo `1`, marcação de
  REP-C tipo `3`, trailer tipo `9`; campos de rastreabilidade; validação
  estrutural; regras fail-closed; erro por linha sem expor CPF; auditoria e
  fixtures sintéticos) está especificado em
  [Contrato técnico do parser AFD](etapa3-parser-afd-contrato-tecnico-v1.md).
  **Permanecem pendentes** (não resolvidos pela T040): a **homologação do
  fornecedor (RWTech)** de que o BLUE BIOPROX-C emite AFD conforme o leiaute
  "004", campo a campo contra amostra sintética (incluindo a variante exata de
  CRC-16 do REP-C), e a **validade/enquadramento jurídico** (`DP-3J-09`).
- **Condicionamento do leiaute técnico:** o **parser** e a validação de
  **layout** permanecem **suspensos como implementação** até a homologação do
  fornecedor e a validação jurídica (DP-3J-20/DP-3J-09); o
  [contrato técnico](etapa3-parser-afd-contrato-tecnico-v1.md) é
  **especificação para uso futuro com AFD sintético**, não alvo de
  implementação agora. O **formato TXT/AFD em si** (decisões T035/T039) não
  depende dessa confirmação.
- **Fonte de dado (reforço, §0):** o arquivo TXT fornece **somente marcações
  brutas**. Empresa, colaborador e horário permanecem **cadastrados no
  Evolli** — a importação nunca cria ou altera esses cadastros.
- **Contrato do lote de importação (T042):** o **envelope de proveniência e
  estado** que ligará o parser puro (T041) à futura gravação de marcações está
  especificado em
  [Contrato do lote de importação AFD](etapa3-lote-importacao-afd-contrato-v1.md)
  — máquina de estados do lote, fail-closed × rejeição parcial, cinco camadas
  separadas (integridade do arquivo → resultados do parser → associação por CPF
  → marcações persistidas → apuração), dados mínimos/proibições, autorização
  (RH único operador por empresa; 404 anti-enumeração), idempotência como
  pendência e gates preservados. **Não** implementa lote, endpoint, upload,
  banco, associação ou cálculo.

### 6.1 Referências futuras (não autorizadas para implementação agora)

Registradas como **referência de produto**, para eventual priorização futura.
**Nenhuma delas é autorizada, especificada em detalhe ou implementada por este
documento:**

- **Painel de histórico de importação/processamento** — visão consolidada de
  lotes importados ao longo do tempo.
- **Fila de marcações rejeitadas** — superfície dedicada além do tipo
  `CPF rejeitado` já previsto em "Verificar folhas" (§5).
- **Relatório de inconsistências** — relatório consolidado, distinto do
  detalhamento por item da fila.
- **Justificativas e fechamento auditáveis** — workflow de justificativa
  formal associado ao fechamento (além da auditoria já prevista para a ação
  manual de fechar, §2.9).
- **Status técnico do equipamento** (relógio) — desde que **sem expor rede,
  IP, credencial ou informação sensível de infraestrutura**.
- **Eventual integração oficial futura** com o sistema/fornecedor do relógio —
  **condicionada** a: documentação oficial do fornecedor, decisão de produto
  própria, revisão de segurança e **menor privilégio**. Não é assumida, não é
  planejada em prazo, e não altera o princípio de que o arquivo/integração só
  fornece marcações brutas (§0).

## 7. Critérios de aceite, riscos, testes e gates

### 7.1 Critérios de aceite (da especificação — não de implementação)

- [ ] Todo conceito (marcação, lote, rejeição, horário versionado, apuração,
      apontamento, ajuste, banco, fechamento, feriado, fila) descrito **sem**
      schema/endpoint e **sem** número trabalhista fixado.
- [ ] Toda regra do RH registrada com status explícito: **recebida**,
      **hipótese** ou **pendente de homologação**.
- [ ] Isolamento por `empresa_id` afirmado em cada superfície.
- [ ] "Verificar folhas" descrita como **triagem sem ação automática**.
- [ ] Nenhum dado pessoal real, CPF, nome, PDF ou screenshot presente.

### 7.2 Riscos

| Risco                                                                | Mitigação registrada                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Fixar semântica trabalhista (tolerância, banco, DSR) sem homologação | Todas marcadas como pendência bloqueante (§8); nenhuma implementada.       |
| Importar leiaute AFD/AEJ errado                                      | Importação suspensa até DP-3J-20 (fornecedor + Jurídico).                  |
| Vazamento cross-company                                              | `empresa_id` como única fronteira, afirmado em cada superfície.            |
| Dado pessoal em log/fila/fixture                                     | Detalhamento seguro; sem dado real; auditoria sem valor sensível em claro. |
| Ação automática indevida (ajuste/fechamento)                         | Fila só sinaliza; toda ação é manual e auditada.                           |
| Fechamento com efeito legal presumido                                | Efeito legal condicionado a DP-3J-09; não declarado.                       |

### 7.3 Testes previstos (para uma futura fase Implementar, com dado sintético)

- **Unitários:** classificação de apuração diária (regular/atraso/extra/situação)
  contra horário versionado; idempotência do lote; rejeição de CPF
  inválido/ausente/sem colaborador; geração de itens da fila por tipo;
  transição de estado do item; segregação por `empresa_id`.
- **E2E:** importar lote sintético → apurar → itens surgem na fila → RH ajusta
  (novo registro, original imutável) → item resolve → tentativa de fechar com
  pendência gera `bloqueio de fechamento`; RH de `Empresa A` **não** vê nada de
  `Empresa B`. **Sempre com dado sintético**, nunca real — inclusive o próprio
  arquivo AFD de teste, que será **exclusivamente sintético** (T039), nunca o
  arquivo real extraído do Secullum.
- Todos os três **exemplos homologados** (§8, DP-3J-18) viram casos de teste
  **após** homologação — não antes.

> **Esclarecimento (RH, T035 — decisão 10):** os **exemplos visuais** já
> recebidos (dia normal; hora extra/banco de horas; folga) são **referência de
> apresentação** — útil para orientar a UI (§4) e a leitura do espelho (§3) —
> mas **não substituem** os cenários de teste completos exigidos por DP-3J-18,
> que precisam de **entradas e resultados completos** homologados pelo RH, não
> apenas uma representação visual do estado final.

### 7.4 Gates (não relaxados)

- **RH:** homologar os **três exemplos completos** com entrada e resultado
  (§8.2, DP-3J-18) — tolerância, almoço livre, ação de limite, rejeição
  parcial e período de apuração já foram **decididos** (§8.1), mas seguem
  sujeitos aos mesmos gates de dado real abaixo antes de qualquer
  implementação com dado sintético virar dado real.
- **Jurídico:** validade legal do controle de jornada e do fechamento
  (DP-3J-09); leiaute AFD/AEJ oficial e enquadramento (DP-3J-20, com fornecedor);
  retenção/descarte e acesso do titular (DP-3J-11); **normas coletivas
  aplicáveis** e viabilidade de **ciência/assinatura eletrônica** do
  colaborador, quando essa evolução futura for avaliada (§3.1) — **RH +
  Jurídico** como função responsável (ADR 0012). **Nenhuma conformidade é
  declarada aqui**, inclusive quanto à Portaria 671.
- **TI/Segurança:** **MFA** obrigatório antes de dado real (ADR 0003 dec. 3);
  segredos/backup do [pacote de decisão](../decisions/pacote-decisao-seguranca-operacional.md)
  (gate-mestre `DS-OPS-01`); confirmar que autorização não excede RH por empresa.

## 8. Pendências bloqueantes

Continuam a família `DP-3J-*` da spec estrutural (que vai até DP-3J-12). A T035
(RH) **resolveu** DP-3J-13, DP-3J-15, DP-3J-16, DP-3J-17 e DP-3J-19; a T036
(RH) **resolveu DP-3J-14** (período de apuração); a T037 (RH) **refina** o
fechamento (dia 25, §2.9), o vínculo horário↔colaborador com vigência e a
imutabilidade de períodos já apurados (§2.4), e **resolve parcialmente
DP-3J-21** quanto ao **apontamento** de DSR (§2.8) — ver §8.1. As demais
pendências (DP-3J-18, 20, 22, o **cálculo financeiro** de DP-3J-21 e as
herdadas de dado real) **não** são resolvidas por este documento — ver §8.2.

### 8.1 Decisões que resolvem pendências anteriores (T035/T036/T037)

| ID                     | Estava pendente como                                                                 | Resolução (RH)                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DP-3J-13               | Semântica da tolerância de 15 min: por batida, por dia ou por período.               | **Resolvida (T035):** aplicada **por dia** (§2.5).                                                                                                                     |
| DP-3J-14               | Período exato de apuração/fechamento; tratamento dos dias 29, 30 e 31.               | **Resolvida (T036/T037):** período de **dia 26 a dia 25 do mês seguinte**, com **fechamento no dia 25** (§2.5, §2.9).                                                  |
| DP-3J-15               | Ação ao atingir +38h / −24h.                                                         | **Resolvida (T035):** o sistema **apenas alerta** — não bloqueia, compensa, desconta ou fecha automaticamente (§2.8).                                                  |
| DP-3J-16               | Efeito de intervalo de almoço menor que uma hora.                                    | **Resolvida (T035):** a apuração **considera automaticamente uma hora mínima** de intervalo (§2.6).                                                                    |
| DP-3J-17               | Rejeição parcial × total do lote quando um CPF é inválido/ausente/sem colaborador.   | **Resolvida (T035):** rejeição **só da marcação afetada**; cria pendência para o colaborador; **resto do lote segue** (§2.3).                                          |
| DP-3J-19               | Vínculo horário → colaborador/equipe (qual horário se aplica a quem) — não recebido. | **Resolvida (T035/T037):** horário **atribuído no cadastro do colaborador**, **com vigência**; mudança de horário **não** altera períodos já apurados (§2.4).          |
| DP-3J-21 (apontamento) | Se e como o desconto de DSR nas faltas em banco é sinalizado.                        | **Resolvida (T037):** falta não justificada gera **apontamento** de desconto de DSR — sem cálculo financeiro (§2.8). O **efeito financeiro** segue pendente, ver §8.2. |

### 8.2 Pendências não afetadas por este documento

| ID                            | Pendência bloqueante                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Responsável                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| DP-3J-18                      | **Três exemplos homologados**: (a) dia normal; (b) atraso + hora extra; (c) falta/feriado/folga/compensação — precisam de entrada e resultado completos, não só referência visual (§7.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | RH                                |
| DP-3J-20                      | **Tipo de REP e leiaute oficial (AFD/AEJ)** do BLUE BIOPROX-C, sob Portaria 671, com CPF — confirmação. Formato de transporte (TXT) já decidido (§6); **fabricante (RWTech), modelo (BLUE BIOPROX-C), canal de extração (Secullum, manual pelo RH) e formato do arquivo (AFD, com cabeçalho/batidas/encerramento) confirmados (T039)**; **leiaute oficial identificado e contrato técnico do parser especificado (T040): AFD versão "004", Portaria MTP 671/2021, registro de marcação REP-C tipo `3` — ver [contrato técnico](etapa3-parser-afd-contrato-tecnico-v1.md)**. **Ainda pendentes:** homologação do fornecedor (RWTech) do BLUE BIOPROX-C campo a campo contra amostra sintética (inclui variante de CRC-16 do REP-C) e enquadramento/validade jurídica (liga-se a DP-3J-09). | Fornecedor + Jurídico + TI        |
| DP-3J-21 (cálculo financeiro) | **Valor/desconto financeiro de DSR** nas faltas em banco — suspenso **até autorização dos diretores** e dependente da futura **Folha** + validação do **Jurídico** (o apontamento, não financeiro, já foi decidido — §8.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Diretoria + RH + Jurídico + Folha |
| DP-3J-22                      | **Marcos das jornadas 1 (Horario Reserva Fiscal), 2 (HORARIO LIBERTY) e 19 (ESTAGIARIO)** — não recebidos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | RH                                |

> **DP-3J-23 — reclassificada (resolvida para o V1; não bloqueante, herdada da
> T034).** A alçada
> operacional do V1 está **decidida**: **RH é o único perfil** que opera o ponto
> (§1.3). **DP, `gestor` e colaborador ficam negados** para essas operações no
> V1. Portanto DP-3J-23 **deixa de ser pendência bloqueante** — não há matriz "em
> aberto" e **não** existe possibilidade de DP operar o ponto no V1. Qualquer
> **expansão futura** de alçada além do RH é **decisão de produto nova**, tratada
> quando/se surgir — **fora do escopo do V1**, não uma pendência dele.

Herdadas e ainda bloqueantes de **dado real** (spec estrutural §9): **DP-3J-09**
(validade legal), **DP-3J-11** (retenção/descarte/acesso do titular), **MFA**
(ADR 0003 dec. 3) e o gate-mestre de segurança operacional (`DS-OPS-01`).

## 9. Catálogo de horários observado

Registrado **exatamente como observado** (strings verbatim), **sem** calcular
duração ou carga semanal a partir da descrição. Todos do tipo **semanal** e
**aparentemente ativos**. O **vínculo com colaborador/equipe** é atribuído no
**cadastro do colaborador** (decidido, T035 — §2.4, §8.2, DP-3J-19); o detalhe
de modelagem dessa atribuição e a confirmação de quais destes horários seguem
ativos permanecem para a fase de modelagem futura.

|  Nº | Horário observado         | Observação                          |
| --: | ------------------------- | ----------------------------------- |
|   1 | Horario Reserva Fiscal    | **Marcos não recebidos** (DP-3J-22) |
|   2 | HORARIO LIBERTY           | **Marcos não recebidos** (DP-3J-22) |
|   3 | 08:00/12:30 - 14:00/18:30 | marcos como observados              |
|   4 | 07:00-12:00/14:00-18:00   | marcos como observados              |
|   5 | 07:30-12:00/13:30-18:00   | marcos como observados              |
|   6 | 07:30-12:00/14:00-18:30   | marcos como observados              |
|   7 | 08:00-13:00/14:00-18:00   | marcos como observados              |
|   8 | 07:00-11:00/13:00-17:00   | marcos como observados              |
|   9 | 08:00-13:00/14:00-18:00   | marcos como observados              |
|  10 | 08:00-12:00/13:30-18:18   | marcos como observados              |
|  11 | 07:30-12:00/14:00-18:30   | marcos como observados              |
|  12 | 07:30-12:00/14:00-18:18   | marcos como observados              |
|  13 | 07:00-12:00/14:00-18:00   | marcos como observados              |
|  14 | 08:00-12:00/14:00-19:00   | marcos como observados              |
|  15 | 07:12-12:00/14:00-18:00   | marcos como observados              |
|  16 | 07:30-12:30/14:00-18:00   | marcos como observados              |
|  17 | 08:00-13:00/14:00-17:00   | marcos como observados              |
|  18 | 08:00-13:00/14:00-18:00   | marcos como observados              |
|  19 | ESTAGIARIO                | **Marcos não recebidos** (DP-3J-22) |
|  20 | 07:30-12:18/14:00-18:00   | marcos como observados              |
|  21 | 08:00-12:00/13:30-18:18   | marcos como observados              |
|  22 | 08:00-12:00/13:00-18:00   | marcos como observados              |
|  23 | 07:40-12:40/14:00-18:00   | marcos como observados              |

> A string "Horario Reserva Fiscal" (nº 1) é um **rótulo de horário observado**,
> não um módulo — "Reserva Fiscal" é o nome da empresa/projeto
> ([glossário](../decisions/glossario-reserva-fiscal.md)). Nenhum significado é
> inferido além do rótulo.

## 10. Regras recebidas do RH — classificação

| Regra                                                                                                                                                                                                  | Classificação                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem trabalho inicial em sábados/domingos/feriados/turnos                                                                                                                                               | **Recebida**                                                                                                                                                                                                                                  |
| Situações: atestado, folga, férias, compensação, almoço livre                                                                                                                                          | **Recebida** (catálogo)                                                                                                                                                                                                                       |
| Horas extras entram no banco                                                                                                                                                                           | **Recebida** (cálculo pendente)                                                                                                                                                                                                               |
| Atrasos não compensados entram no banco                                                                                                                                                                | **Recebida** (cálculo pendente)                                                                                                                                                                                                               |
| Faltas entram no banco só com saldo positivo; senão, relatório no dia 28                                                                                                                               | **Recebida** (semântica pendente; regra de relatório distinta do fechamento — não corrigida)                                                                                                                                                  |
| Saldo positivo permanece; negativo avaliado mensalmente                                                                                                                                                | **Recebida**                                                                                                                                                                                                                                  |
| Fechamento no dia 25, cobrindo período de dia 26 (mês anterior) a dia 25 (mês atual)                                                                                                                   | **Decidida (T036/T037):** período e dia de fechamento (DP-3J-14)                                                                                                                                                                              |
| Feriados nacionais iniciais; municipais/pontes/exceções caso a caso                                                                                                                                    | **Recebida**                                                                                                                                                                                                                                  |
| CPF ausente/inválido/sem colaborador gera erro apontado                                                                                                                                                | **Decidida (T035):** rejeição só da marcação; resto do lote segue                                                                                                                                                                             |
| Tolerância de 15 min (atraso, saída antecipada, almoço)                                                                                                                                                | **Decidida (T035):** valor 15 min, aplicada **por dia**; aplicação exata pendente                                                                                                                                                             |
| Almoço livre garante ≥ 1h; regra automática exata                                                                                                                                                      | **Decidida (T035):** intervalo &lt;1h considera automaticamente 1h mínima                                                                                                                                                                     |
| Limites +38h / −24h                                                                                                                                                                                    | **Decidida (T035):** ao atingir, **apenas alerta** — sem ação automática                                                                                                                                                                      |
| Falta não justificada gera apontamento de desconto de DSR                                                                                                                                              | **Decidida (T037):** apontamento, **sem** cálculo financeiro (DP-3J-21, parcial)                                                                                                                                                              |
| Módulo de Ponto não calcula valor financeiro/reflexo salarial/desconto de DSR                                                                                                                          | **Decidida (T037):** depende de futura Folha + Jurídico                                                                                                                                                                                       |
| Valor/desconto financeiro de DSR aguarda autorização dos diretores                                                                                                                                     | **Hipótese/aguarda diretoria + Folha + Jurídico** (DP-3J-21, cálculo financeiro)                                                                                                                                                              |
| BLUE BIOPROX-C; Portaria 671; CPF como identificador                                                                                                                                                   | **Hipótese** (leiaute técnico — DP-3J-20); sem declarar conformidade com a Portaria 671                                                                                                                                                       |
| Fabricante RWTech; modelo BLUE BIOPROX-C; extração manual pelo RH no Secullum; entrada TXT em formato AFD (cabeçalho/batidas/encerramento); Secullum/relógio só origem, sem API/rede/integração direta | **Confirmada (T039)** — evidência técnica de formato/origem; **não** declara conformidade com a Portaria 671 nem substitui homologação jurídica/DP-3J-20 completa                                                                             |
| Leiaute oficial do AFD (versão "004", Portaria MTP 671/2021) e contrato técnico do parser (registro de marcação REP-C tipo `3`, validação estrutural, fail-closed, fixtures sintéticos)                | **Especificada (T040)** a partir da fonte oficial do MTE — ver [contrato técnico](etapa3-parser-afd-contrato-tecnico-v1.md); **não** declara conformidade com a Portaria 671; homologação do fornecedor e validação jurídica seguem pendentes |
| Entrada do Ponto V1 é arquivo TXT                                                                                                                                                                      | **Decidida (T035):** formato de transporte; leiaute técnico segue pendente                                                                                                                                                                    |
| RH cadastra tabelas de horários por empresa                                                                                                                                                            | **Decidida (T037)**                                                                                                                                                                                                                           |
| Tabela de horários atribuída no cadastro do colaborador, com vigência                                                                                                                                  | **Decidida (T035/T037):** ponto de atribuição e vigência (DP-3J-19)                                                                                                                                                                           |
| Cada empresa só administra as próprias tabelas de horários                                                                                                                                             | **Decidida (T035)**                                                                                                                                                                                                                           |
| Política de apuração única para todos; mudança de horário não altera período já apurado                                                                                                                | **Decidida (T037)**                                                                                                                                                                                                                           |
| Jornadas de 9h (seg–qui) e 8h (sex), 44h semanais; sáb/dom sem jornada inicial                                                                                                                         | **Requisito operacional recebido (T035/T037)** — sem declarar conformidade legal                                                                                                                                                              |
| Exemplos visuais (dia normal, hora extra/banco, folga)                                                                                                                                                 | **Recebida como referência de apresentação** — não substitui DP-3J-18                                                                                                                                                                         |
| Sistema externo observado é só referência funcional/visual                                                                                                                                             | **Recebida (T035)** — sem integração técnica, API, sincronização ou cópia                                                                                                                                                                     |
| Espelho de Ponto emitido para conferência e assinatura manual do colaborador                                                                                                                           | **Decidida (T037)**                                                                                                                                                                                                                           |
| Ciência/assinatura eletrônica do colaborador                                                                                                                                                           | **Bloqueada como evolução futura (T037)** — Jurídico, normas coletivas, MFA, integridade, auditoria, controles de documentos                                                                                                                  |

## 11. Declaração

Este documento **especifica**, não implementa. A T035, a T036, a T037 e a T039
**consolidam** decisões e evidências operacionais recebidas do RH/RWTech
(tolerância por dia,
alerta em vez de ação automática nos limites de banco, almoço mínimo
automático, rejeição só da marcação afetada, horário atribuído no cadastro
com vigência, isolamento de horários por empresa, RH cadastrando as tabelas de
horários, jornadas de 9h/8h e 44h semanais como requisito operacional, entrada
TXT, exemplos visuais como referência de apresentação, ausência de integração
com sistema externo, o **período de apuração de dia 26 a dia 25 do mês
seguinte com fechamento no dia 25**, a **imutabilidade de períodos já
apurados** mesmo após mudança de horário, o **apontamento** — sem cálculo
financeiro — de desconto de DSR em falta não justificada, a **emissão do
Espelho para conferência e assinatura manual do colaborador**, e a
**evidência técnica confirmada da entrada AFD** — fabricante RWTech, modelo
BLUE BIOPROX-C, extração manual pelo RH no Secullum, arquivo TXT em formato
AFD com cabeçalho/batidas/encerramento, e ausência de integração técnica com
Secullum ou relógio) — mas **nenhuma linha de código, schema, migration, API,
UI, parser, teste ou dado real** é criada por este documento. **Nenhuma pendência bloqueante deste
conjunto permanece em aberto** (§8.1). As pendências não tratadas por esta
consolidação (DP-3J-18, 20, 22, o **cálculo financeiro** de DP-3J-21) e os
gates herdados permanecem exatamente como estavam. **Não declara**
conformidade legal, trabalhista ou LGPD — inclusive quanto à **Portaria 671**;
**não habilita** dado real, importação, cálculo financeiro, fechamento com
efeito legal, ciência/assinatura eletrônica, produção ou exposição externa; e
**não relaxa** MFA (ADR 0003), a auditoria (ADR 0004), a negação por padrão
nem o isolamento por `empresa_id`. Enquanto MFA, `DS-OPS-01`, DP-3J-09 e
DP-3J-11 estiverem abertos, **nenhum dado real** entra em nenhum ambiente.
