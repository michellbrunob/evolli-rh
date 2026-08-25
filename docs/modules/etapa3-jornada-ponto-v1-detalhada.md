# Etapa 3 — Jornada e Ponto V1 (detalhada) e a fila "Verificar folhas"

- Status: **Especificação — fase Registrar decisão** (T034, consolidada pela
  T035). **Nenhuma fase Implementar é aberta ou autorizada por este documento.**
  Não há código, banco, API, UI funcional, importação ou cálculo aqui — apenas
  especificação.
- Data: 2026-08-24 (T034); consolidação de novas decisões do RH em 2026-08-25
  (T035).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T034** (detalhamento da V1 e da nova
  função "Verificar folhas"); **T035** (consolidação de decisões do RH que
  resolvem parte das pendências abertas pela T034).
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
  limite, almoço mínimo, rejeição parcial, atribuição de horário — §2, §8.2),
  mas **não implementa** nenhuma delas. **Não decide** o tratamento dos dias
  29–31, leiaute técnico de arquivo, tipo de REP, base legal ou retenção —
  seguem em §8.
- **Não declara conformidade** legal, trabalhista ou LGPD.
- **Não integra** com folha (Etapa 4), nem trata biometria/geolocalização.

### 1.3 Atores

Matriz **operacional decidida** para o V1 (não é pendência). "Operar o ponto" =
importar batidas, visualizar a fila "Verificar folhas", registrar ajuste,
aprovar e fechar.

| Ator                           | Operar o ponto no V1                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RH**                         | **Único perfil autorizado**: importa batidas, visualiza a fila "Verificar folhas", registra ajuste, aprova e fecha — **restrito à própria empresa**.     |
| **DP**                         | **Negado** para todas essas operações no V1 (a concessão de registrar/consultar da Baseline V1 **não** se estende a operar o ponto aqui).                |
| `gestor`                       | **Negado** (escopo indefinido, DP-8/ADR 0006).                                                                                                           |
| Colaborador                    | **Negado / sem acesso** (Portal do Colaborador fora de escopo — Baseline V1).                                                                            |
| `master_tecnico`               | **Sem mutação trabalhista**: mantém **apenas** os limites técnicos de leitura já aprovados (ADR 0012 dec. 3); **não** importa, ajusta, aprova nem fecha. |
| `admin_tecnico`                | **Negado**, sem exceção (ADR 0008 dec. 6; ADR 0012).                                                                                                     |
| `financeiro`, `auditor`, `dpo` | **Negados** — nenhum recebe acesso por analogia.                                                                                                         |

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
  atribuição (campo, momento, efeito de mudança de horário sobre dias já
  apurados) é detalhe de modelagem futura, não resolvido aqui.
- **Decidido (RH, T035):** cada empresa **visualiza e administra somente as
  próprias tabelas de horários** — mesma fronteira de `empresa_id` (§1.4)
  aplicada especificamente ao catálogo de horários; não há horário
  compartilhado nem visível entre empresas.
- **Requisito operacional recebido (RH, T035):** jornadas planejadas de **nove
  horas** foram **confirmadas pelo RH como previstas** no V1. Este é um
  requisito operacional recebido — **não** uma declaração de conformidade legal
  ou trabalhista; a validade da carga horária permanece sujeita a DP-3J-09
  (validade legal, jurídico).

### 2.5 Apuração diária

- Para um vínculo e um dia, a apuração **compara** as marcações do dia com o
  horário planejado vigente e **classifica** o dia (regular, com pendência, com
  atraso/saída antecipada, com extra, situação registrada, etc.). É a base do
  espelho (§3) e da fila (§5).
- **Nenhum número trabalhista é fixado aqui.** A tolerância de **15 minutos**
  (atraso, saída antecipada e almoço) é **valor aprovado pelo RH**, com
  **semântica decidida (T035 — resolve DP-3J-13): aplicada por dia** — não por
  batida individual nem por período/competência.
- **Período de apuração/fechamento (RH, T035 — resolve parte de DP-3J-14):**
  informado como **dia 1 ao dia 28**. Fica como a **única pendência bloqueante
  remanescente** deste conjunto de decisões (DP-3J-14, escopo reduzido): **o
  tratamento dos dias 29, 30 e 31** — se pertencem ao período seguinte, ficam
  fora da apuração, ou seguem outra regra — **não foi informado e não é
  inferido aqui**.

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
  positivo**, no **dia 28** deve haver **relatório** para possível **desconto ou
  manutenção em banco** (decisão humana, nunca automática).
- **Limites:** **+38h** e **−24h**. **Decidido (RH, T035 — resolve DP-3J-15):**
  ao atingir qualquer um dos limites, o sistema **apenas gera alerta** — **não**
  bloqueia, compensa, desconta ou fecha automaticamente. A ação corretiva
  permanece humana (RH), pelos fluxos próprios.
- **Saldo positivo permanece** em banco; **saldo negativo é avaliado
  mensalmente**.
- **DSR não é descontado** nas faltas usadas no banco **até autorização dos
  diretores** (DP-3J-21) — enquanto não houver autorização, nenhum desconto de
  DSR é aplicado.

> O motor de cálculo do banco **não é implementado nem especificado
> numericamente** aqui — permanece dependente de decisão de produto e do gate de
> validade legal (DP-3J-09), coerente com a Baseline V1 (Decisão 6).

### 2.9 Fechamento mensal

- **Fechamento e prazo de ajustes: dia 28.** O **período informado pelo RH é
  dia 1 ao dia 28** (T035, §2.5) — **decidido** para esse intervalo. O
  tratamento dos **dias 29, 30 e 31** é a **única pendência bloqueante**
  remanescente deste conjunto de decisões (DP-3J-14, §8); não presumir que
  esses dias entram no período corrente, no próximo, ou seguem regra própria.
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
- **Idempotência:** a importação de um mesmo arquivo/lote **não** duplica
  marcações (reprocessar é seguro) — mecanismo (ex.: chave natural do
  registro/assinatura do arquivo) a definir na modelagem.
- **Segurança:** importação é operação **do RH**, **por empresa**, **auditada**;
  o arquivo de origem e seu conteúdo **não** são versionados no repositório nem
  usados como fixture com dado real. Erros (CPF ausente/inválido/sem
  colaborador) **são apontados** e caem na fila (§5) **por marcação** (§2.3),
  nunca descartados em silêncio nem invalidando o lote inteiro.
- **Condicionamento do leiaute técnico:** o **parser** e a validação de
  **layout** ficam **suspensos** até DP-3J-20 (tipo de REP + leiaute) ser
  confirmada; até lá, o leiaute técnico do TXT é **especificação condicional**,
  não alvo de implementação. O **formato TXT em si** (esta decisão) não depende
  dessa confirmação.
- **Fonte de dado (reforço, §0):** o arquivo TXT fornece **somente marcações
  brutas**. Empresa, colaborador e horário permanecem **cadastrados no
  Evolli** — a importação nunca cria ou altera esses cadastros.

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
  `Empresa B`. **Sempre com dado sintético**, nunca real.
- Todos os três **exemplos homologados** (§8, DP-3J-18) viram casos de teste
  **após** homologação — não antes.

> **Esclarecimento (RH, T035 — decisão 10):** os **exemplos visuais** já
> recebidos (dia normal; hora extra/banco de horas; folga) são **referência de
> apresentação** — útil para orientar a UI (§4) e a leitura do espelho (§3) —
> mas **não substituem** os cenários de teste completos exigidos por DP-3J-18,
> que precisam de **entradas e resultados completos** homologados pelo RH, não
> apenas uma representação visual do estado final.

### 7.4 Gates (não relaxados)

- **RH:** definir o **tratamento dos dias 29–31** (§8.1, DP-3J-14) e homologar
  os **três exemplos completos** com entrada e resultado (§8.3, DP-3J-18) —
  tolerância, almoço livre, ação de limite e rejeição parcial já foram
  **decididos** (§8.2), mas seguem sujeitos aos mesmos gates de dado real
  abaixo antes de qualquer implementação com dado sintético virar dado real.
- **Jurídico:** validade legal do controle de jornada e do fechamento
  (DP-3J-09); leiaute AFD/AEJ oficial e enquadramento (DP-3J-20, com fornecedor);
  retenção/descarte e acesso do titular (DP-3J-11) — **RH + Jurídico** como
  função responsável (ADR 0012). **Nenhuma conformidade é declarada aqui.**
- **TI/Segurança:** **MFA** obrigatório antes de dado real (ADR 0003 dec. 3);
  segredos/backup do [pacote de decisão](../decisions/pacote-decisao-seguranca-operacional.md)
  (gate-mestre `DS-OPS-01`); confirmar que autorização não excede RH por empresa.

## 8. Pendências bloqueantes

Continuam a família `DP-3J-*` da spec estrutural (que vai até DP-3J-12). A T035
(RH) **resolveu** DP-3J-13, DP-3J-15, DP-3J-16, DP-3J-17 e DP-3J-19 (§8.2).
**DP-3J-14** foi **reduzida** à única pergunta ainda sem resposta deste
conjunto: o tratamento dos dias 29–31 (§8.1). As demais (DP-3J-18, 20, 21, 22 e
as herdadas de dado real) **não** são resolvidas por este documento.

### 8.1 Pendência bloqueante remanescente (não inferida)

| ID       | Pendência bloqueante                                                                                                                                                                                                                         | Responsável  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| DP-3J-14 | **Tratamento dos dias 29, 30 e 31.** O RH informou o período como "dia 1 ao dia 28" (§2.5, §2.9). Falta definir: esses dias pertencem ao **período seguinte**, ficam **fora da apuração**, ou seguem **outra regra**? **Não inferido aqui.** | RH + Produto |

### 8.2 Decisões da T035 que resolvem pendências anteriores

| ID       | Estava pendente como                                                                 | Resolução (RH, T035)                                                                                                   |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| DP-3J-13 | Semântica da tolerância de 15 min: por batida, por dia ou por período.               | **Resolvida:** aplicada **por dia** (§2.5).                                                                            |
| DP-3J-15 | Ação ao atingir +38h / −24h.                                                         | **Resolvida:** o sistema **apenas alerta** — não bloqueia, compensa, desconta ou fecha automaticamente (§2.8).         |
| DP-3J-16 | Efeito de intervalo de almoço menor que uma hora.                                    | **Resolvida:** a apuração **considera automaticamente uma hora mínima** de intervalo (§2.6).                           |
| DP-3J-17 | Rejeição parcial × total do lote quando um CPF é inválido/ausente/sem colaborador.   | **Resolvida:** rejeição **só da marcação afetada**; cria pendência para o colaborador; **resto do lote segue** (§2.3). |
| DP-3J-19 | Vínculo horário → colaborador/equipe (qual horário se aplica a quem) — não recebido. | **Resolvida quanto ao ponto de atribuição:** o horário é **atribuído no cadastro do colaborador** (§2.4).              |

### 8.3 Pendências não afetadas por este documento

| ID       | Pendência bloqueante                                                                                                                                                                      | Responsável                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| DP-3J-18 | **Três exemplos homologados**: (a) dia normal; (b) atraso + hora extra; (c) falta/feriado/folga/compensação — precisam de entrada e resultado completos, não só referência visual (§7.3). | RH                         |
| DP-3J-20 | **Tipo de REP e leiaute oficial (AFD/AEJ)** do BLUE BIOPROX-C, sob Portaria 671, com CPF — confirmação. Formato de transporte (TXT) já decidido (§6); leiaute técnico segue pendente.     | Fornecedor + Jurídico + TI |
| DP-3J-21 | **Desconto de DSR** nas faltas em banco — suspenso **até autorização dos diretores**.                                                                                                     | Diretoria + RH             |
| DP-3J-22 | **Marcos das jornadas 1 (Horario Reserva Fiscal), 2 (HORARIO LIBERTY) e 19 (ESTAGIARIO)** — não recebidos.                                                                                | RH                         |

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

| Regra                                                               | Classificação                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Sem trabalho inicial em sábados/domingos/feriados/turnos            | **Recebida**                                                                |
| Situações: atestado, folga, férias, compensação, almoço livre       | **Recebida** (catálogo)                                                     |
| Horas extras entram no banco                                        | **Recebida** (cálculo pendente)                                             |
| Atrasos não compensados entram no banco                             | **Recebida** (cálculo pendente)                                             |
| Faltas em banco só com saldo positivo; senão, relatório no dia 28   | **Recebida** (semântica pendente)                                           |
| Saldo positivo permanece; negativo avaliado mensalmente             | **Recebida**                                                                |
| Fechamento e prazo de ajustes: dia 28                               | **Decidida** — período dia 1–28 (T035); **dias 29–31 pendentes** (DP-3J-14) |
| Feriados nacionais iniciais; municipais/pontes/exceções caso a caso | **Recebida**                                                                |
| CPF ausente/inválido/sem colaborador gera erro apontado             | **Decidida (T035):** rejeição só da marcação; resto do lote segue           |
| Tolerância de 15 min (atraso, saída antecipada, almoço)             | **Decidida (T035):** valor 15 min, aplicada **por dia**                     |
| Almoço livre garante ≥ 1h; regra automática exata                   | **Decidida (T035):** intervalo &lt;1h considera automaticamente 1h mínima   |
| Limites +38h / −24h                                                 | **Decidida (T035):** ao atingir, **apenas alerta** — sem ação automática    |
| DSR não descontado até autorização dos diretores                    | **Hipótese/aguarda diretoria** (DP-3J-21)                                   |
| BLUE BIOPROX-C; Portaria 671; CPF como identificador                | **Hipótese** (leiaute técnico — DP-3J-20)                                   |
| Entrada do Ponto V1 é arquivo TXT                                   | **Decidida (T035):** formato de transporte; leiaute técnico segue pendente  |
| Tabela de horários atribuída no cadastro do colaborador             | **Decidida (T035):** ponto de atribuição (DP-3J-19)                         |
| Cada empresa só administra as próprias tabelas de horários          | **Decidida (T035)**                                                         |
| Jornadas planejadas de 9h confirmadas pelo RH como previstas        | **Requisito operacional recebido (T035)** — sem declarar conformidade legal |
| Exemplos visuais (dia normal, hora extra/banco, folga)              | **Recebida como referência de apresentação** — não substitui DP-3J-18       |
| Sistema externo observado é só referência funcional/visual          | **Recebida (T035)** — sem integração técnica, API, sincronização ou cópia   |

## 11. Declaração

Este documento **especifica**, não implementa. A T035 **consolida** decisões
operacionais recebidas do RH (tolerância por dia, alerta em vez de ação
automática nos limites de banco, almoço mínimo automático, rejeição só da
marcação afetada, horário atribuído no cadastro, isolamento de horários por
empresa, jornadas de 9h como requisito operacional, entrada TXT, exemplos
visuais como referência de apresentação, ausência de integração com sistema
externo) — mas **nenhuma linha de código, schema, migration, API, UI, parser,
teste ou dado real** é criada por este documento. A **única pendência
bloqueante remanescente** deste conjunto é o **tratamento dos dias 29, 30 e 31**
(§8.1, DP-3J-14) — **não inferido**. As demais pendências não tratadas por esta
consolidação (DP-3J-18, 20, 21, 22) permanecem exatamente como estavam.
**Não declara** conformidade legal, trabalhista ou LGPD; **não habilita** dado
real, importação, cálculo, fechamento com efeito legal, produção ou exposição
externa; e **não relaxa** MFA (ADR 0003), a auditoria (ADR 0004), a negação por
padrão nem o isolamento por `empresa_id`. Enquanto MFA, `DS-OPS-01`, DP-3J-09 e
DP-3J-11 estiverem abertos, **nenhum dado real** entra em nenhum ambiente.
