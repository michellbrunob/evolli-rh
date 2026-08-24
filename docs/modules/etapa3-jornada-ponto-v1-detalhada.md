# Etapa 3 — Jornada e Ponto V1 (detalhada) e a fila "Verificar folhas"

- Status: **Especificação — fase Registrar decisão** (T034). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código, banco,
  API, UI funcional, importação ou cálculo aqui — apenas especificação.
- Data: 2026-08-24
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T034** (detalhamento da V1 e da nova
  função "Verificar folhas").
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
- **PontoTel** é citado **apenas como referência operacional/visual**. **Não há**
  integração, cópia de marca, componentes, textos ou regras proprietárias; nada
  de PontoTel é reproduzido ou importado.

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
- **Não decide** tolerância, período de apuração, ação de limite, leiaute de
  arquivo, tipo de REP, base legal ou retenção — todos ficam em §8.
- **Não declara conformidade** legal, trabalhista ou LGPD.
- **Não integra** com folha (Etapa 4), nem trata biometria/geolocalização.

### 1.3 Atores

| Ator                                          | Papel nesta V1 (a formalizar)                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **RH**                                        | **Único** perfil que importa batidas, ajusta, aprova e fecha o ponto, **restrito à própria empresa**.        |
| Colaborador                                   | **Sem acesso** nesta V1 (Portal do Colaborador fora de escopo — Baseline V1).                                |
| `gestor`                                      | **Negado** (escopo indefinido, DP-8/ADR 0006).                                                               |
| `master_tecnico`                              | **Negado** para mutação de negócio de ponto (ADR 0012 dec. 3); leitura global existe, mas não opera o ponto. |
| `admin_tecnico`                               | **Negado**, sem exceção (ADR 0008 dec. 6; ADR 0012).                                                         |
| `colaborador`, `financeiro`, `auditor`, `dpo` | **Negados** — nenhum recebe acesso por analogia.                                                             |

> **Reconciliação pendente (DP-3J-23).** A Baseline V1 (Decisão 5) concedia
> **registrar/consultar a RH e DP**. A entrada de produto da T034 diz **"RH é o
> único perfil"** para importar/ajustar/aprovar/fechar. A matriz final — se DP
> mantém consulta, e se "aprovar/fechar" (que a Baseline V1 não tinha) passa a
> existir — é **decisão de produto a formalizar**, não resolvida aqui.

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
- **Pendência bloqueante (DP-3J-17):** se a rejeição é **por marcação**
  (rejeição parcial, resto do lote aceito) **ou** invalida o **lote inteiro** —
  a decidir; aqui **não** se assume nenhuma das duas.

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

### 2.5 Apuração diária

- Para um vínculo e um dia, a apuração **compara** as marcações do dia com o
  horário planejado vigente e **classifica** o dia (regular, com pendência, com
  atraso/saída antecipada, com extra, situação registrada, etc.). É a base do
  espelho (§3) e da fila (§5).
- **Nenhum número trabalhista é fixado aqui.** A tolerância de **15 minutos**
  (atraso, saída antecipada e almoço) é **entrada do RH com semântica pendente**
  (aplicada por batida? por dia? por período? — DP-3J-13). O **período exato de
  apuração/fechamento** é pendência (DP-3J-14).

### 2.6 Apontamento (situação do dia)

- Um dia pode carregar uma **situação** codificada (catálogo controlado, sem
  texto livre — ADR 0008 dec. 5): **atestado, folga, férias, compensação,
  almoço livre**. A situação altera a expectativa de apuração do dia.
- **Almoço livre:** deve assegurar **pelo menos uma hora** de intervalo; a
  **regra automática exata** (o que fazer se o intervalo apurado for menor que
  uma hora) **precisa ser homologada** (DP-3J-16).

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
- **Limites:** **+38h** e **−24h**. A **ação ao atingir** cada limite é
  **pendência bloqueante** (DP-3J-15) — não se assume bloqueio, corte ou alerta.
- **Saldo positivo permanece** em banco; **saldo negativo é avaliado
  mensalmente**.
- **DSR não é descontado** nas faltas usadas no banco **até autorização dos
  diretores** (DP-3J-21) — enquanto não houver autorização, nenhum desconto de
  DSR é aplicado.

> O motor de cálculo do banco **não é implementado nem especificado
> numericamente** aqui — permanece dependente de decisão de produto e do gate de
> validade legal (DP-3J-09), coerente com a Baseline V1 (Decisão 6).

### 2.9 Fechamento mensal

- **Fechamento e prazo de ajustes: dia 28.** Após o fechamento de uma
  competência, o RH **não** deveria alterar marcações daquele período por ajuste
  comum; qualquer exceção é decisão de produto a definir.
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

## 6. Importação segura e idempotente de AFD (condicionada ao leiaute)

- **Relógio:** **BLUE BIOPROX-C**. **Hipótese:** enquadramento na **Portaria
  671** e **CPF** como identificador do colaborador. **Pendências bloqueantes
  (DP-3J-20):** o **tipo de REP** e o **leiaute oficial** (AFD/AEJ) **exigem
  confirmação do fornecedor e do Jurídico** — enquanto não confirmados, **nenhum
  parser é especificado nem implementado**.
- **Idempotência:** a importação de um mesmo arquivo/lote **não** duplica
  marcações (reprocessar é seguro) — mecanismo (ex.: chave natural do
  registro/assinatura do arquivo) a definir na modelagem.
- **Segurança:** importação é operação **do RH**, **por empresa**, **auditada**;
  o arquivo de origem e seu conteúdo **não** são versionados no repositório nem
  usados como fixture com dado real. Erros (CPF ausente/inválido/sem
  colaborador) **são apontados** e caem na fila (§5), nunca descartados em
  silêncio.
- **Condicionamento:** toda esta seção fica **suspensa** até DP-3J-20 (tipo de
  REP + leiaute) ser confirmada; até lá, importação AFD é **especificação
  condicional**, não alvo de implementação.

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

### 7.4 Gates (não relaxados)

- **RH:** homologar tolerância, almoço livre, banco/limites, período de
  fechamento e os três exemplos (§8).
- **Jurídico:** validade legal do controle de jornada e do fechamento
  (DP-3J-09); leiaute AFD/AEJ oficial e enquadramento (DP-3J-20, com fornecedor);
  retenção/descarte e acesso do titular (DP-3J-11) — **RH + Jurídico** como
  função responsável (ADR 0012). **Nenhuma conformidade é declarada aqui.**
- **TI/Segurança:** **MFA** obrigatório antes de dado real (ADR 0003 dec. 3);
  segredos/backup do [pacote de decisão](../decisions/pacote-decisao-seguranca-operacional.md)
  (gate-mestre `DS-OPS-01`); confirmar que autorização não excede RH por empresa.

## 8. Pendências bloqueantes

Continuam a família `DP-3J-*` da spec estrutural (que vai até DP-3J-12).
**Responsável** é **área/função**. **Status:** todas **Pendentes**. **Nenhuma é
resolvida por este documento.**

| ID       | Pendência bloqueante                                                                                          | Responsável                |
| -------- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| DP-3J-13 | **Semântica da tolerância de 15 min**: por batida, por dia ou por período (atraso, saída antecipada, almoço). | RH + Produto               |
| DP-3J-14 | **Período exato de apuração/fechamento** (o "dia 28" é prazo; a janela de competência precisa ser definida).  | RH + Produto               |
| DP-3J-15 | **Ação ao atingir +38h / −24h** (bloquear? alertar? só relatar?) — nenhuma assumida.                          | RH + Produto               |
| DP-3J-16 | **Efeito de intervalo de almoço menor que uma hora** (regra automática do "almoço livre") — a homologar.      | RH + Produto               |
| DP-3J-17 | **Rejeição parcial × total do lote** quando um CPF é inválido/ausente/sem colaborador.                        | Produto + TI               |
| DP-3J-18 | **Três exemplos homologados**: (a) dia normal; (b) atraso + hora extra; (c) falta/feriado/folga/compensação.  | RH                         |
| DP-3J-19 | **Vínculo horário → colaborador/equipe** (qual horário se aplica a quem) — hoje **não recebido**.             | RH + Produto               |
| DP-3J-20 | **Tipo de REP e leiaute oficial (AFD/AEJ)** do BLUE BIOPROX-C, sob Portaria 671, com CPF — confirmação.       | Fornecedor + Jurídico + TI |
| DP-3J-21 | **Desconto de DSR** nas faltas em banco — suspenso **até autorização dos diretores**.                         | Diretoria + RH             |
| DP-3J-22 | **Marcos das jornadas 1 (Horario Reserva Fiscal), 2 (HORARIO LIBERTY) e 19 (ESTAGIARIO)** — não recebidos.    | RH                         |
| DP-3J-23 | **Matriz de acesso final**: RH único operador (importar/ajustar/aprovar/fechar) × RH+DP da Baseline V1.       | Produto + RH               |

Herdadas e ainda bloqueantes de **dado real** (spec estrutural §9): **DP-3J-09**
(validade legal), **DP-3J-11** (retenção/descarte/acesso do titular), **MFA**
(ADR 0003 dec. 3) e o gate-mestre de segurança operacional (`DS-OPS-01`).

## 9. Catálogo de horários observado

Registrado **exatamente como observado** (strings verbatim), **sem** calcular
duração ou carga semanal a partir da descrição. Todos do tipo **semanal** e
**aparentemente ativos** — a confirmação de atividade e o **vínculo com
colaborador/equipe são pendência** (DP-3J-19).

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

| Regra                                                               | Classificação                              |
| ------------------------------------------------------------------- | ------------------------------------------ |
| Sem trabalho inicial em sábados/domingos/feriados/turnos            | **Recebida**                               |
| Situações: atestado, folga, férias, compensação, almoço livre       | **Recebida** (catálogo)                    |
| Horas extras entram no banco                                        | **Recebida** (cálculo pendente)            |
| Atrasos não compensados entram no banco                             | **Recebida** (cálculo pendente)            |
| Faltas em banco só com saldo positivo; senão, relatório no dia 28   | **Recebida** (semântica pendente)          |
| Saldo positivo permanece; negativo avaliado mensalmente             | **Recebida**                               |
| Fechamento e prazo de ajustes: dia 28                               | **Recebida** (janela — DP-3J-14)           |
| Feriados nacionais iniciais; municipais/pontes/exceções caso a caso | **Recebida**                               |
| CPF ausente/inválido/sem colaborador gera erro apontado             | **Recebida** (parcial×total — DP-3J-17)    |
| Tolerância de 15 min (atraso, saída antecipada, almoço)             | **Hipótese/semântica pendente** (DP-3J-13) |
| Almoço livre garante ≥ 1h; regra automática exata                   | **Hipótese/homologar** (DP-3J-16)          |
| Limites +38h / −24h                                                 | **Recebida** (ação — DP-3J-15)             |
| DSR não descontado até autorização dos diretores                    | **Hipótese/aguarda diretoria** (DP-3J-21)  |
| BLUE BIOPROX-C; Portaria 671; CPF como identificador                | **Hipótese** (leiaute — DP-3J-20)          |

## 11. Declaração

Este documento **especifica**, não implementa nem decide. **Nenhuma** regra
trabalhista, semântica de tolerância, valor de banco, período de fechamento,
leiaute de arquivo, base legal ou retenção é fixada aqui — todas permanecem
como pendência explícita (§8). **Não declara** conformidade legal, trabalhista
ou LGPD; **não habilita** dado real, importação, cálculo, fechamento com efeito
legal, produção ou exposição externa; e **não relaxa** MFA (ADR 0003), a
auditoria (ADR 0004), a negação por padrão nem o isolamento por `empresa_id`.
Enquanto MFA, `DS-OPS-01`, DP-3J-09 e DP-3J-11 estiverem abertos, **nenhum dado
real** entra em nenhum ambiente.
