# Etapa 3 — Jornada e Ponto Rastreável V1 Estrutural

> **Nota de convergência (T032; [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md), CG-RBAC-01).**
> Onde este documento descreve a assimetria em que o `admin_tecnico` é negado em
> Ponto mas mantém **acesso amplo à estrutura organizacional**, leia-se a segunda
> parte como registro **histórico**: o `admin_tecnico` **convergiu para
> bootstrap/histórico** e passou a ser **negado também na estrutura
> organizacional**. O **único** acesso global permanente é o **`master_tecnico`**
> (ADR 0012, T030). A negação do `admin_tecnico` em Ponto permanece válida; os
> textos abaixo são preservados como história — não reescritos.

- Status: **Baseline V1 aprovada** (2026-08-07) para o núcleo conceitual
  descrito neste documento — fase **Registrar decisão aprovada**. Nenhuma
  fase Implementar foi aberta ou autorizada por esta atualização.
- **Detalhamento (T034), consolidação (T035), correção de período (T036) e
  decisões adicionais (T037):** a especificação detalhada da V1 operável
  (importação do relógio, tolerância, situações, banco de horas, fechamento e
  a fila "Verificar folhas") está em
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md). A T035
  **consolidou** novas decisões do RH que resolvem a maior parte das
  pendências abertas pela T034 (tolerância por dia, alerta nos limites de
  banco, almoço mínimo automático, rejeição só da marcação, horário atribuído
  no cadastro, entrada TXT); a T036 **resolveu `DP-3J-14`**: o período de
  apuração é de **dia 26 a dia 25 do mês seguinte**. A T037 **acrescentou**:
  fechamento no **dia 25**; Espelho de Ponto emitido para **conferência e
  assinatura manual** do colaborador (ciência/assinatura eletrônica
  **bloqueada** como evolução futura); **apontamento** — sem cálculo
  financeiro — de desconto de DSR em falta não justificada (`DP-3J-21`
  resolvida quanto ao apontamento; cálculo financeiro segue pendente); RH
  cadastrando tabelas de horários por empresa; vigência do vínculo
  horário↔colaborador; e a **política de apuração única**, que impede mudança
  de horário de alterar período já apurado. A alçada operacional do V1
  continua **RH como único operador**. **Nenhuma pendência bloqueante deste
  conjunto permanece em aberto**; as demais pendências não tratadas
  (`DP-3J-18`, `20`, `22`, e o cálculo financeiro de `DP-3J-21`) seguem
  inalteradas. **Nada** é implementado; o
  núcleo mínimo desta Baseline permanece inalterado.
- Fase do SDD: Registrar decisão aprovada. Nenhuma implementação, schema,
  migration, endpoint, dependência ou integração externa criada nesta
  fase.
- Depende de: [Etapa 1 — Fatia 2: Colaboradores e vida funcional](etapa1-fatia2-colaboradores-vida-funcional.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md).
- Decisão de produto: [Baseline V1 de Jornada e Ponto Rastreável](../decisions/etapa3-jornada-ponto-baseline-v1.md)
  (8 decisões aprovadas, 2026-08-07) e [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (formalização arquitetural correspondente).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
  [docs/ROADMAP.md](../ROADMAP.md), [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## 0. Contexto decisório e observações registradas

Esta seção regista o que este documento observa e assume ao propor a
Etapa 3 — nenhum item aqui é decisão de produto; são leituras do estado
atual do repositório e tensões explícitas que o leitor precisa ver antes
de avaliar as seções seguintes.

### O1 — Herança direta da Fatia 2: vínculo com `VinculoFuncional`, nunca com `AccessUser`

A Fatia 2 estabeleceu, como regra estrutural (RS-1 a RS-4 da sua
especificação), que **Colaborador nunca é extensão de `AccessUser`** — são
entidades distintas, com propósitos distintos (identidade técnica vs.
pessoa física com vida funcional). Jornada e Ponto herda essa regra sem
exceção: todo evento de ponto, ajuste, apuração ou fechamento se ancora em
`VinculoFuncional` (que já carrega `colaboradorId` e `empresaId`), nunca
diretamente em `AccessUser`. Isso não é uma escolha nova desta fatia — é a
aplicação do mesmo princípio já aprovado, ao próximo domínio que precisa
dele.

### O2 — Esta é a fatia com a maior tensão LGPD até agora

A Fatia 2 introduziu o primeiro dado pessoal de titular (nome, data de
admissão, alocação). A Etapa 2 (Documentos) tratou de metadado que pode
revelar categoria sensível por inferência. A Etapa 3 soma um terceiro
vetor, próprio de jornada e ponto: **dado de comportamento e presença** —
quando alguém registrou entrada/saída, de onde (potencialmente), com qual
dispositivo (potencialmente). Mesmo o núcleo conceitual desta V1
Estrutural (sem biometria, sem geolocalização, sem dispositivo) já lida
com data/hora de evento vinculada a uma pessoa identificável — dado
pessoal, ainda que "só" operacional. A tensão cresce, não diminui, se/
quando localização, biometria ou dispositivo forem aprovados no futuro:
por isso este documento trata "dado operacional" e "dado potencialmente
sensível" como categorias distintas desde já (§3.5, §5).

### O3 — Matéria sujeita a regulação trabalhista, sem que este documento declare aderência

Jornada e apuração de ponto são, por natureza, tema regulado pela
legislação trabalhista brasileira (controle de jornada, guarda de
registro, direito do trabalhador a cópia). Este documento **não afirma**
qual norma específica se aplica, não declara conformidade com nenhuma
delas, e não assume nenhuma regra de cálculo (hora extra, banco de horas,
adicional noturno, DSR) como implementada ou implementável sem decisão
jurídica formal. A confirmação de validade legal e dos requisitos
regulatórios aplicáveis é decisão pendente explícita (§9, DP-3J-09) — não
resolvida, nem contornada, por esta especificação estrutural.

### O4 — Tensão já conhecida: "não antecipar estrutura" vs. "estrutural desde já"

A Etapa 2 (Documentos) já registrou esta mesma tensão contra o precedente
de ADR 0003 (decisão 8: não acoplar `access_user` a colaborador antes da
hora) e ADR 0006 (decisões 8 e 9: não antecipar hierarquia de gestor nem
vigência antes de haver caso de uso real). A Etapa 3 herda a tensão sem
resolvê-la de forma diferente: o que se antecipa aqui é **separação
conceitual e superfície de risco**, não schema. Nenhuma tabela, campo
pessoal adicional ou enum fechado de banco é proposto (§6). Se a fase
Implementar futura decidir que nem a separação conceitual deve virar
tabela ainda, isso é decisão legítima dela, não desta especificação.

### O5 — Dependência não resolvida: o papel `gestor`

`ACCESS_ROLES` já inclui `gestor` desde a Fatia 3 (Etapa 0), mas seu
escopo permanece indefinido — a ADR 0006 (decisão 8, DP-8) deixou
"gestor restrito a quê" como pergunta genuinamente futura, dependente de
contexto que só existiria com Colaborador implementado. A Etapa 1 —
Fatia 2 negou `gestor` em toda a matriz de Pessoas até essa decisão
existir. Jornada e Ponto é, tipicamente, um domínio onde "gestor aprova
ponto da própria equipe" é fluxo natural — mas esta especificação **não
assume** esse fluxo. Aprovação por gestor está explicitamente fora de
escopo desta fatia (§4), e a matriz preliminar (§7) trata `gestor` como
"negado, pendente", igual a todos os demais papéis sem decisão registrada.

### O6 — Relação com a Etapa 2 (Documentos): mencionada, não decidida

Em algum momento futuro, evidência de ponto (ex.: PDF de espelho de
ponto) pode vir a ser um tipo de documento gerido pela Etapa 2. Este
documento **não decide** essa integração, não propõe campo de referência
cruzada, e não assume que ela deva existir. É mencionada aqui só para que
uma futura decisão de produto não trate a sobreposição como surpresa.

### O7 — Nomenclatura

Segue a convenção já aprovada (ADR 0006, Emenda 1): português para
negócio, código, banco, APIs, eventos e documentação técnica;
identificadores técnicos sem acento, espaço, hífen interno ou caractere
especial; tipos em PascalCase, campos em camelCase, tabelas/colunas
futuras em snake_case, rotas futuras em português minúsculo plural,
eventos de auditoria futuros em português separados por ponto. Nenhum
nome de tabela, coluna ou rota é comprometido nesta fase — os nomes
usados neste documento (`EventoPonto`, `AjustePonto` etc.) são
conceituais, sujeitos a revisão na fase de modelagem real.

### O8 — Baseline V1 aprovada: o que muda, o que não muda

**Aditivo — não reescreve O1 a O7.** Em 2026-08-07, o produto avaliou o
levantamento de decisões pendentes (§9, versão original) e aprovou 8
decisões, registradas em
[docs/decisions/etapa3-jornada-ponto-baseline-v1.md](../decisions/etapa3-jornada-ponto-baseline-v1.md)
e formalizadas em
[ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md). As
seções seguintes deste documento foram atualizadas para refletir essa
Baseline — cada atualização está marcada com "(Baseline V1, Decisão N)".

**O que a Baseline resolve:** catálogo fechado de evento (§3.3), origem
única de registro (§4), mecanismo de correção sem texto livre (§3.4),
matriz mínima de acesso para RH e DP (§7), granularidade de competência
(§3.5) e confirmação de que escala complexa, aprovação e fechamento legal
não entram nesta V1 (§3.2, §3.6).

**O que a Baseline não resolve — permanece pendente, sem inferência:**
validade legal (DP-3J-09), retenção/descarte/acesso do titular
(DP-3J-11), tratamento de biometria/geolocalização/dispositivo
(DP-3J-10), importação TXT (DP-3J-07), integração com folha (DP-3J-08) e
escopo do papel `gestor` (DP-3J-12, bloqueada por DP-8 da ADR 0006). Ver
§9 para o estado atualizado de cada decisão pendente.

**O que a Baseline não autoriza:** nenhum código, schema, migration,
endpoint, dependência ou infraestrutura. A Baseline resolve decisões de
produto que uma futura fase Implementar exigiria — não abre essa fase.

## 1. Objetivo, valor de negócio e escopo

### Objetivo desta fatia

Estabelecer a separação conceitual mínima do domínio de Jornada e Ponto —
o que é jornada, o que é escala, o que é evento de registro, o que é
ajuste, o que é apuração, o que é fechamento — e o conjunto de decisões
que precisam ser tomadas por produto, RH/DP e jurídico/DPO antes de
qualquer estrutura real (tabela, endpoint, integração) ser construída.
Não é objetivo desta fatia implementar nada.

### Valor de negócio

- Reduz o risco de a próxima fase de implementação começar sem clareza
  sobre o que é dado operacional e o que é dado sensível, ou sem saber
  quais decisões de produto/jurídico ainda faltam.
- Explicita, antes de qualquer linha de código, que jornada e ponto tocam
  regra trabalhista e potencialmente dado de localização/biometria — dois
  vetores de risco que merecem decisão deliberada, não implementação por
  inércia arquitetural.
- Cria um vocabulário conceitual comum (jornada, escala, evento, ajuste,
  apuração, fechamento) que RH, produto e jurídico podem discutir antes de
  qualquer compromisso técnico.

### Escopo — entra (nesta especificação)

- Separação conceitual, em texto, dos seguintes conceitos, tratados como
  **distintos entre si**, mesmo que a modelagem final os componha de forma
  diferente: **jornada**, **escala**, **evento de ponto**, **ajuste**,
  **apuração** e **fechamento**.
- O princípio de que todo registro de ponto e conceito derivado se
  vincula obrigatoriamente a `VinculoFuncional` (nunca a `AccessUser`
  diretamente) — ver O1.
- O princípio de histórico rastreável, sem exclusão física, com evento
  original imutável e correção feita por **registro posterior**, nunca por
  sobrescrita silenciosa do original — mesmo padrão já aprovado para
  auditoria (ADR 0004, decisão 3) e para retificação de movimentação
  (Fatia 2, §4.10), estendido agora ao próprio evento de ponto.
- Uso exclusivo de dados sintéticos em qualquer exemplo, teste futuro ou
  evidência desta e das próximas fatias, até que produto/jurídico/DPO
  aprovem piloto com dado real (mesmo padrão de todas as fatias
  anteriores).
- Levantamento de decisões pendentes, matriz de acesso preliminar,
  controles de segurança não-ignoráveis e critérios de saída da fase
  estrutural.

### Escopo — não entra (nesta fatia; ver §4 para detalhamento e razão)

Importação TXT, integração com relógio de ponto/REP/terceiros/folha,
biometria, geolocalização, foto, IP, dispositivo, reconhecimento facial,
cálculo de horas extras/banco de horas/adicional noturno/DSR/férias/
afastamento/folha, aprovação por gestor, portal do colaborador, e
qualquer dado real.

## 2. Relação com a Fatia 2 e dependências

### 2.1 O que já existe e seria reaproveitado sem alteração

| Do que já existe                                                              | Como Jornada e Ponto dependeria dele                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `VinculoFuncional` (Fatia 2)                                                  | Ponto de ancoragem obrigatório de todo evento/ajuste/apuração — nunca `AccessUser` (O1)   |
| `Colaborador` (Fatia 2)                                                       | Alcançado só via `VinculoFuncional`, nunca referenciado diretamente pelo domínio de ponto |
| `empresaId` como fronteira de autorização (ADR 0005/0006)                     | Mesmo princípio: nenhuma nova fronteira de autorização é introduzida por esta fatia       |
| `AuditService.record()` (ADR 0004)                                            | Único ponto de escrita de auditoria, se/quando eventos de ponto existirem                 |
| Padrão de correção por registro posterior (ADR 0004 decisão 3; Fatia 2 §4.10) | Modelo já aprovado, estendido ao evento de ponto (§3)                                     |
| Padrão "negação por padrão, matriz explícita" (Fatia 1, Fatia 2)              | Aplicado aqui de forma ainda mais restritiva — matriz quase vazia (§7)                    |

### 2.2 O que esta fatia NÃO pede para acrescentar a nada já mergeado

Diferente da Fatia 2 (que exigiu acréscimos pontuais a `AccessUser`
indiretamente via novo domínio) e da Etapa 2 (que identificou que
`Colaborador` não tem `empresaId` direto), esta especificação **não
identifica nenhuma alteração necessária** em tabela, enum ou tipo já
mergeado. Isso é observação, não garantia permanente — a fase de
modelagem real (fora desta fatia) pode revelar necessidade não visível
aqui.

### 2.3 Dependência explícita e não resolvida: papel `gestor`

Ver O5. Qualquer decisão de produto que aproxime Jornada e Ponto de um
fluxo "gestor aprova/consulta ponto da equipe" depende de DP-8 (ADR 0006)
ser resolvida primeiro — fora do escopo desta fatia e desta decisão.

## 3. Separação conceitual

Estes seis conceitos são tratados como **distintos**, cada um com
responsabilidade própria. A modelagem final pode combiná-los em menos
tabelas ou distribuí-los de forma diferente — o que importa aqui é que
nenhum dos seis seja tratado como sinônimo de outro na discussão de
produto/jurídico que precede a implementação.

### 3.1 Jornada

O contrato de tempo de trabalho esperado de um vínculo funcional — por
exemplo, "8h/dia, 44h/semana", ou um padrão mais complexo. **Não é** a
mesma coisa que escala (3.2): jornada é o contrato; escala é a
distribuição concreta dessa carga no calendário.

### 3.2 Escala

A distribuição concreta da jornada no tempo — em quais dias, em quais
horários, um vínculo é esperado a trabalhar. Pode variar por período,
por padrão (fixo, turno, revezamento) — a variedade de modelos de escala
continua indefinida (§9, DP-3J-01). **(Baseline V1, Decisão 1)**: esta V1
**não implementa escala complexa** — nenhum motor de turno, revezamento
ou múltiplos padrões simultâneos é aprovado. A separação conceitual entre
jornada e escala permanece como referência, não como compromisso de
modelagem.

### 3.3 Evento de ponto

O registro atômico de uma ocorrência. **(Baseline V1, Decisão 2)**:
catálogo fechado de quatro tipos aprovado para esta V1: `entrada`,
`saida`, `inicio_pausa`, `fim_pausa`. Nenhum outro tipo entra nesta V1;
extensão do catálogo é decisão própria futura (DP-3J-02, V2). Um evento
de ponto, uma vez registrado, é **imutável**: não é editado, não é
apagado. Qualquer erro é corrigido por um evento complementar (ajuste,
3.4), nunca por alteração do evento original — o mesmo princípio já
aprovado para auditoria (ADR 0004) e para movimentação funcional
(Fatia 2), aplicado aqui ao dado mais granular do domínio.

### 3.4 Ajuste (retificação de ponto)

Um registro posterior que corrige, complementa ou contesta um evento de
ponto existente — nunca sobrescreve o original. **(Baseline V1, Decisão 4)**: o ajuste **não aceita campo de texto livre** — mesmo princípio já
usado para `motivo_codigo` em Movimentação Funcional (Fatia 2). O
conteúdo exato do que um ajuste registra (motivo codificado, referência
ao evento original) é detalhe de modelagem, não resolvido aqui. **(Baseline
V1, Decisão 5)**: quem pode propor um ajuste é RH ou DP, dentro da
própria empresa (§7) — a mesma matriz mínima aprovada para registrar
evento. Aprovação de ajuste não existe nesta V1 (Decisão 7, §3.6) — não
há papel que aprove, porque não há fluxo de aprovação. O evento original
permanece legível, e a trilha entre evento e ajuste é rastreável.

### 3.5 Apuração (período de competência)

O processo de consolidar eventos de ponto (e seus ajustes) num período de
competência. **(Baseline V1, Decisão 6)**: competência é **mensal**,
apenas como organização do histórico — esta especificação **não define**
nenhum motor de cálculo. Nenhuma regra de hora extra, banco de horas,
adicional noturno, DSR ou jornada legal é assumida (essas são
explicitamente fora de escopo, §4). "Apuração" aqui é só o conceito de
"existe um agrupamento mensal de eventos", não um motor de cálculo.

### 3.6 Fechamento

O estado final de um período de apuração. **(Baseline V1, Decisão 7)**:
aprovação e fechamento ficam **fora desta V1** — nenhum workflow de
aprovação, aprovação por gestor ou fechamento com efeito legal é
implementado. O conceito permanece registrado (controle de estado, sem
implicar cálculo de folha ou integração externa) como referência para uma
fatia futura que decidir implementá-lo.

### 3.7 Quadro-resumo

| Conceito        | Responsabilidade                                         | Depende de              |
| --------------- | -------------------------------------------------------- | ----------------------- |
| Jornada         | Contrato de tempo esperado                               | `VinculoFuncional`      |
| Escala          | Distribuição concreta da jornada no calendário           | Jornada                 |
| Evento de ponto | Registro atômico, imutável, de uma ocorrência            | `VinculoFuncional`      |
| Ajuste          | Correção rastreável de um evento, por registro posterior | Evento de ponto         |
| Apuração        | Consolidação de eventos/ajustes num período              | Evento de ponto, Ajuste |
| Fechamento      | Estado final de um período de apuração                   | Apuração                |

## 4. Fora de escopo desta fatia

Cada item abaixo é fora de escopo **desta fatia especificamente** — não é
julgamento sobre se algum dia existirá, e cada um tem razão registrada.
**(Baseline V1, Decisão 3)** confirma, como decisão de produto, que
importação TXT, integração externa, biometria, foto, geolocalização, IP
e dispositivo não entram nesta V1 — a única origem aprovada é registro
manual interno por RH/DP (§7). **(Baseline V1, Decisão 7)** confirma
aprovação por gestor e fechamento legal como fora desta V1.

| Fora de escopo                                                                                                          | Por que fica de fora agora                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Importação TXT (arquivo de REP)                                                                                         | Formato/estrutura de arquivo é decisão técnica que depende de decisão de produto anterior (qual REP, qual layout) — DP-3J-07                                                               |
| Integração com relógio de ponto, REP, terceiros ou folha                                                                | Nenhuma integração externa entra antes do núcleo conceitual existir e ser aprovado — mesmo princípio de dependência mínima já seguido desde a ADR 0001                                     |
| Biometria, geolocalização, foto, IP, dispositivo, reconhecimento facial                                                 | Cada um é, por si, uma categoria de dado com requisito de segurança e LGPD próprio (§5); nenhum é assumido por conveniência de escopo — DP-3J-10                                           |
| Cálculo de horas extras, banco de horas, adicional noturno, DSR, férias, afastamento, folha ou regra legal automatizada | Depende de decisão jurídica/produto sobre qual regra aplicar e como — nenhuma é assumida por esta especificação (O3, DP-3J-09)                                                             |
| Aprovação por gestor                                                                                                    | Depende de DP-8 (ADR 0006) — escopo do papel `gestor` — não resolvida (O5)                                                                                                                 |
| Portal do colaborador                                                                                                   | Consulta pelo próprio titular é fluxo de acesso próprio, com requisitos de autenticação/autorização não cobertos por esta fatia — mesmo padrão já observado na Fatia 2 (§3.5) e na Etapa 2 |
| Qualquer dado real                                                                                                      | Nenhuma fatia estrutural desta trilha (Etapa 1, Etapa 2, agora Etapa 3) trabalha com dado real antes dos gates de saída (§11) serem cumpridos                                              |

## 5. Segurança e LGPD

### 5.1 Dado operacional vs. dado potencialmente sensível — distinção central desta fatia

- **Dado operacional** (nesta V1 Estrutural, se algo vier a ser
  implementado): identificador do vínculo, tipo de evento, data/hora do
  registro, estado de apuração/fechamento. Já é dado pessoal (associável a
  uma pessoa identificável via `VinculoFuncional`), mas não revela, por si
  só, categoria sensível.
- **Dado potencialmente sensível**: localização, biometria, dispositivo,
  foto, IP, e qualquer evidência equivalente de onde/como/com que
  aparelho um evento foi registrado. Nenhum desses existe nesta fatia
  (§4), e nenhum entra em fatia futura sem decisão específica própria —
  não basta a aprovação genérica de "Jornada e Ponto" para autorizar
  biometria ou geolocalização.
- Um evento de ponto puramente operacional (data/hora + vínculo) já é
  dado pessoal sob a LGPD — a distinção acima não isenta o dado
  operacional de tratamento cuidadoso, só separa dois níveis de
  sensibilidade dentro do domínio.

### 5.2 Acesso negado por padrão

Nenhum papel tem acesso a nenhum recurso de Jornada e Ponto até que uma
matriz explícita seja aprovada (§7). Isso vale inclusive para leitura —
"consultar o próprio ponto" não está implicitamente liberado para
`colaborador` nem para ninguém, até decisão registrada.

### 5.3 Sem acesso global de `admin_tecnico`

Mesma restrição já aplicada em Pessoas (Fatia 2, Baseline V1 item 8):
`admin_tecnico` não recebe acesso amplo a dado de Jornada e Ponto por ser
administrador técnico. **(Baseline V1, Decisão 5)** reafirma essa negação
como decisão de produto explícita, sem exceção — pela mesma lógica já
aplicada em Pessoas: a exceção de acesso amplo do `admin_tecnico` foi
concedida sobre estrutura organizacional (Emenda 1, ADR 0005), não sobre
dado pessoal, e não se estende por herança a este domínio. Se algum
acesso técnico limitado (ex.: suporte a incidente) vier a ser necessário,
é decisão de produto/segurança separada, registrada explicitamente —
nunca herdada por omissão do papel técnico já existir.

### 5.4 Acesso V1 restrito a RH e DP; demais papéis seguem sem matriz aprovada

**(Baseline V1, Decisão 5)**: RH e DP, limitados à própria empresa,
recebem acesso para **registrar** (evento e ajuste) e **consultar** —
única exceção à negação por padrão desta fatia, e limitada exatamente ao
que está descrito em §7. Isso não cria acesso global, cross-company, nem
a dado/documento fora deste módulo — RH e DP de uma empresa continuam sem
acesso ao que pertence a outra empresa, e a concessão não se estende, por
analogia, a nenhum outro domínio.

Gestor, financeiro, auditor, DPO e colaborador **não** recebem acesso a
Jornada e Ponto por analogia com o que já têm em Pessoas, Organização ou
na trilha de auditoria. Cada célula pendente da matriz (§7) segue exigindo
decisão própria — inclusive papéis com acesso amplo em outros domínios
(ex.: `auditor`/`dpo` já leem `access_log`) não herdam acesso automático a
este novo domínio.

### 5.5 Auditoria sem conteúdo pessoal desnecessário

Se/quando implementado, todo evento de auditoria de Jornada e Ponto segue
o modelo já fechado da ADR 0004 (decisão 5): metadados estruturados
(ator, ação, recurso, resultado, escopo), **nunca** valor de campo em
claro. Isso vale com força redobrada aqui: um evento de auditoria que
registrasse "horário de entrada: 08h03" estaria duplicando o próprio dado
de ponto dentro da trilha de auditoria, sem necessidade — a ação (`ponto.
evento.criado`) e o `resource_id` já bastam para rastrear "o quê" e
"quando", sem replicar "o conteúdo".

- Ações candidatas a auditoria (conceituais, não implementadas): criação
  de evento, criação de ajuste, consulta a evento/histórico, apuração de
  período, fechamento de período. Consulta é candidata a evento de
  auditoria pelo mesmo motivo que a leitura da trilha de auditoria já é
  auditada (ADR 0004, decisão 6): ver dado de jornada/ponto de terceiro é,
  em si, ação sensível.

### 5.6 Riscos obrigatórios a tratar quando houver implementação

- **IDOR/BOLA**: acesso a evento/ajuste/apuração de um `VinculoFuncional`
  que não pertence ao escopo do requisitante — mesmo padrão de teste já
  exigido em Pessoas (Fatia 2, §11) e replicável aqui.
- **Segregação por empresa**: `empresaId`, alcançado via
  `VinculoFuncional`, continua sendo a fronteira de autorização — nenhuma
  nova fronteira é proposta por esta fatia (mesmo princípio da ADR 0006,
  decisão 2, aplicado por analogia).
- **Projeção mínima**: qualquer resposta de API futura projeta só os
  campos necessários ao consumidor — nunca o registro bruto por padrão,
  especialmente se/quando dado potencialmente sensível (§5.1) vier a
  existir em fatia futura.

### 5.7 O que esta seção não faz

Não declara conformidade LGPD, não declara validade legal do controle de
jornada proposto, e não autoriza biometria, geolocalização, dispositivo ou
qualquer dado potencialmente sensível — todos permanecem bloqueados até
decisão específica (§9).

## 6. Modelo conceitual futuro

**Nenhuma tabela, migration, model Prisma, campo pessoal adicional ou
enum fechado de banco é proposto nesta seção.** As entidades abaixo são
conceituais — nomes de trabalho para a discussão de produto/jurídico, não
compromisso de schema.

### 6.1 `EventoPonto` — NÃO MATERIALIZÁVEL NESTA FATIA

Representaria o registro atômico de uma ocorrência de ponto. Vincula-se
conceitualmente a `VinculoFuncional`. Imutável por princípio (§3.3) — a
forma exata de garantir essa imutabilidade no banco (ex.: ausência de
`UPDATE`/`DELETE` no privilégio de runtime, análogo ao padrão já usado em
`audit_event` pela ADR 0004) é decisão da fase de modelagem real, não
desta especificação.

### 6.2 `AjustePonto` — NÃO MATERIALIZÁVEL NESTA FATIA

Representaria o registro posterior que corrige/complementa um
`EventoPonto`. Referenciaria o evento original — nunca o substituiria.
Quem pode criar um ajuste é decisão pendente (§9).

### 6.3 `EscalaJornada` — NÃO MATERIALIZÁVEL NESTA FATIA

Representaria a distribuição concreta da jornada no calendário de um
vínculo (§3.2). Sua relação com "jornada" (contrato) enquanto conceito
próprio, ou se os dois se fundem numa única entidade futura, é decisão de
modelagem pendente (§9, DP-3J-01) — este documento propositalmente não
resolve.

### 6.4 `PeriodoApuracao` — NÃO MATERIALIZÁVEL NESTA FATIA

Representaria o período de competência (§3.5) que consolida eventos e
ajustes. O conceito de "competência" (mensal? outro?) é decisão pendente
(§9, DP-3J-06).

### 6.5 `FechamentoPonto` — NÃO MATERIALIZÁVEL NESTA FATIA

Representaria o estado final de um `PeriodoApuracao` (§3.6). Quem pode
fechar, e se existe reabertura, são decisões pendentes (§9).

### 6.6 Dependências entre as entidades conceituais

```
VinculoFuncional (Fatia 2, já implementado)
        │
        ├── EscalaJornada         (depende de Jornada, conceito não materializado)
        │
        └── EventoPonto ──────────┐
                 │                │
                 └── AjustePonto  │
                                  ▼
                          PeriodoApuracao ── FechamentoPonto
```

Este diagrama é conceitual — não implica ordem de implementação, nem que
todas as entidades sejam tabelas separadas na modelagem final.

### 6.7 Dependência explícita da Fatia 2

Toda entidade conceitual acima depende de `VinculoFuncional` já existir e
estar `ativo` para fazer sentido de negócio — não se propõe nenhum
caminho onde jornada/ponto exista para um vínculo inexistente ou
`previsto` (mesmo princípio de RI-V6/RS-1 da Fatia 2, aplicado por
analogia, não reafirmado como regra nova).

### 6.8 Dependência explícita da decisão de `gestor` (DP-8, ADR 0006)

Nenhuma entidade acima pressupõe um campo de "aprovador" ou "gestor
responsável" — essa decisão é inteiramente futura, dependente de DP-8 ser
resolvida primeiro (O5).

## 7. Matriz preliminar de acesso

**(Baseline V1, Decisão 5, 2026-08-07)**: duas células passam a ✅
aprovado — RH e DP, para registrar e consultar, sempre restritos à
própria empresa. Todas as demais permanecem ❌ negado ou ⛔ pendente,
seguindo o mesmo padrão já usado na especificação estrutural da Etapa 2
(Documentos): nenhuma célula é preenchida por analogia com o que o papel
já tem em outro domínio.

| Papel           | Evento de ponto                                                                                                                           | Ajuste                               | Apuração                                                       | Fechamento                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| `admin_tecnico` | ❌ negado (Baseline V1, Decisão 5 — mesmo princípio de §5.3, não decisão nova)                                                            | ❌ negado                            | ❌ negado                                                      | ❌ negado                                    |
| `rh`            | ✅ registrar e consultar, só própria empresa (Baseline V1, Decisão 5)                                                                     | ✅ registrar e consultar (Decisão 4) | ⛔ pendente (agrupamento, DP-3J-06 quanto ao motor de cálculo) | ❌ negado (fechamento fora da V1, Decisão 7) |
| `dp`            | ✅ registrar e consultar, só própria empresa (Baseline V1, Decisão 5)                                                                     | ✅ registrar e consultar (Decisão 4) | ⛔ pendente (idem `rh`)                                        | ❌ negado (idem `rh`)                        |
| `gestor`        | ⛔ pendente (bloqueado por DP-8 antes de qualquer coisa, O5; Baseline V1 não resolve)                                                     | ⛔ pendente                          | ⛔ pendente                                                    | ⛔ pendente                                  |
| `financeiro`    | ⛔ pendente                                                                                                                               | ⛔ pendente                          | ⛔ pendente                                                    | ⛔ pendente                                  |
| `auditor`       | ⛔ pendente (leitura da trilha de auditoria, não do dado, já é escopo de `access_log`; leitura do dado de ponto em si é pendente própria) | —                                    | —                                                              | —                                            |
| `dpo`           | ⛔ pendente (mesma observação de `auditor`)                                                                                               | —                                    | —                                                              | —                                            |
| `colaborador`   | ⛔ pendente (portal do colaborador é explicitamente fora de escopo, §4)                                                                   | ⛔ pendente                          | —                                                              | —                                            |

**Legenda**: ✅ aprovado nesta V1, com o escopo exato descrito na célula
(Baseline V1, Decisão 5) — nunca mais amplo que o texto registrado. ❌
negado por consequência de princípio já aprovado (não é decisão nova
desta fatia). ⛔ pendente de decisão de produto — nenhum acesso deve ser
assumido, inferido ou implementado enquanto a célula estiver neste
estado. Células "—" indicam que o conceito de linha não se aplica
claramente ao papel sem decisão prévia. Nenhuma célula ✅ desta matriz
autoriza código — a matriz descreve o que uma futura fase Implementar
poderia construir, não o que já existe.

## 8. Estratégia futura de testes

Não há código nesta fatia — o que segue é o que a fase de implementação
futura deve garantir, registrado agora para que a matriz de teste não
seja inventada sob pressão de prazo depois.

- **Imutabilidade e correção rastreável**: teste que comprove que um
  `EventoPonto` já persistido não pode ser alterado nem apagado por
  nenhum caminho de aplicação, e que toda correção só existe como um novo
  registro (`AjustePonto`) referenciando o original.
- **Isolamento por empresa**: mesmo padrão de teste cruzado já usado na
  Fatia 2 (dois vínculos de empresas diferentes, tentativa de acesso
  cruzado deve falhar) — replicado para evento, ajuste, apuração e
  fechamento.
- **Autorização e IDOR/BOLA**: para cada papel com acesso aprovado
  (quando a matriz §7 deixar de estar vazia), teste negativo de acesso a
  recurso fora do escopo — 404 sem confirmar existência, com evento de
  negação auditado internamente (mesmo padrão da Fatia 2, §11).
- **Atomicidade com auditoria**: se a decisão de produto futura definir
  que criação de evento/ajuste é ação transacional com o evento de
  auditoria (mesmo padrão da ADR 0004, decisão 2, para ações sensíveis),
  teste de rollback real (não só documentado) comprovando que nenhum dos
  dois persiste sem o outro.
- **Ausência de dado sensível em logs e respostas**: teste que garanta
  que nenhuma resposta de API, log estruturado ou evento de auditoria
  carregue, sem necessidade, o conteúdo do evento de ponto além do
  estritamente necessário à operação solicitada — reforçado quando/se
  dado potencialmente sensível (§5.1) for aprovado no futuro.
- **Validações de período de apuração**: testes de coerência de
  `PeriodoApuracao`/`FechamentoPonto` só devem ser escritos **depois** que
  as regras de negócio subjacentes (o que apura, o que fecha, quem pode
  reabrir) forem aprovadas — escrever teste para regra ainda não decidida
  arriscaria fixar comportamento não aprovado como se fosse requisito.

## 9. Decisões pendentes

**(Baseline V1, 2026-08-07)**: das 12 decisões abaixo, 6 foram
integralmente ou parcialmente resolvidas para o escopo desta V1 — cada
uma marcada com o efeito exato da Baseline. As demais permanecem
pendentes, sem resolução por inferência. Nenhuma resolução aqui equivale
a autorizar código — ver [Baseline V1](../decisions/etapa3-jornada-ponto-baseline-v1.md)
e [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) para o
texto completo de cada decisão.

| ID       | Decisão pendente                                                                                                                            | Quem decide            | Status após Baseline V1                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DP-3J-01 | Modelo de jornada e escala: quantos padrões, como se relacionam, se `Jornada` e `EscalaJornada` são entidades separadas ou uma só           | Produto, RH            | Pendente quanto ao modelo final; **esclarecido** que a V1 não depende de resolvê-lo (Decisão 1: sem escala complexa)                            |
| DP-3J-02 | Tipos de evento de ponto (catálogo fechado): quais existem, e se o catálogo é fixo ou versionável                                           | Produto, RH            | **Resolvida para V1** (Decisão 2): `entrada`, `saida`, `inicio_pausa`, `fim_pausa`. Extensão futura = DP-3J-02 (V2)                             |
| DP-3J-03 | Origem permitida do registro de evento (ex.: manual pelo próprio, manual por RH, importação futura) — nenhuma origem é assumida nesta fatia | Produto, RH            | **Resolvida para V1** (Decisão 3): só registro manual interno, por RH/DP                                                                        |
| DP-3J-04 | Política de ajuste/retificação: quem pode propor, se exige aprovação, prazo para contestar                                                  | Produto, RH, jurídico  | **Mecanismo resolvido** (Decisão 4: ajuste rastreável, sem texto livre); prazo para contestar segue pendente                                    |
| DP-3J-05 | Quem consulta, ajusta, aprova e fecha — a matriz completa de §7, incluindo se `gestor` participa (depende de DP-8, ADR 0006)                | Produto, RH            | **Consultar/ajustar resolvido para V1** (Decisão 5: RH e DP); aprovar/fechar sem objeto nesta V1 (Decisão 7); `gestor` segue bloqueado por DP-8 |
| DP-3J-06 | Conceito de competência/período de apuração (mensal? outro?) e regra de transição de estado                                                 | Produto, RH, jurídico  | **Granularidade resolvida** (Decisão 6: mensal); nenhuma regra de cálculo aprovada                                                              |
| DP-3J-07 | Importação TXT futura: formato, layout, proveniência (qual REP), tratamento de erro/divergência                                             | Produto, TI            | Pendente — confirmado fora da V1 (Decisão 3), sem resolução do formato futuro                                                                   |
| DP-3J-08 | Integração com folha: quando, como, quais dados atravessam a fronteira                                                                      | Produto, Etapa 4       | Pendente — não endereçada pela Baseline V1                                                                                                      |
| DP-3J-09 | Validade legal e requisitos regulatórios aplicáveis ao controle de jornada implementado                                                     | Jurídico               | Pendente — reafirmada como gate de dado real (Decisão 8)                                                                                        |
| DP-3J-10 | Tratamento de biometria, geolocalização e dispositivo: se serão implementados, sob qual base legal, com qual controle técnico               | Produto, jurídico, DPO | Pendente — confirmado fora da V1 (Decisão 3), tratamento futuro não resolvido                                                                   |
| DP-3J-11 | Retenção, descarte e acesso do titular ao próprio histórico de ponto                                                                        | Jurídico, DPO          | Pendente — reafirmada como gate de dado real (Decisão 8)                                                                                        |
| DP-3J-12 | Vínculo futuro com gestor/equipe (aprovação, visibilidade) — bloqueado por DP-8 (ADR 0006) antes de qualquer avanço aqui                    | Produto                | Pendente — inalterada; `gestor` confirmado negado nesta V1 (Decisão 5)                                                                          |

## 10. Riscos

- **Confundir "estrutural" com "sem risco"**: mesmo esta fatia conceitual
  já lida com dado pessoal de comportamento/presença (O2) — tratar a fase
  como isenta de cuidado por não ter código seria erro de percepção, não
  de implementação.
- **Pressão para antecipar biometria/geolocalização "já que está
  desenhando o domínio mesmo"**: rejeitado explicitamente (§4, §5.1,
  DP-3J-10) — cada um exige decisão e base legal próprias, não herdadas
  da aprovação geral de "Jornada e Ponto".
- **Matriz de acesso preenchida por analogia** com o que um papel já tem
  em Pessoas ou Organização, sem decisão própria — mesmo risco já
  registrado na Etapa 2, reafirmado aqui (§7).
- **Auditoria duplicando o próprio dado de ponto** dentro do evento de
  auditoria (§5.5) — risco de projetar "rastreabilidade" como "copiar o
  conteúdo", quando o padrão já aprovado (ADR 0004) é metadado, não
  conteúdo.
- **Regra de cálculo trabalhista implementada antes de decisão jurídica**
  — risco de a fase de implementação, sob pressão de prazo, tratar hora
  extra/banco de horas/adicional noturno como "óbvio o suficiente para
  não esperar decisão" — explicitamente rejeitado (§3.5, §4, DP-3J-09).
- **Importação TXT tratada como only-parsing**: risco de subestimar que
  qualquer importação de arquivo externo é também superfície de ataque
  (arquivo malformado, volume, origem não verificada) — motivo adicional
  para ficar fora desta fatia (DP-3J-07 trata isso como decisão própria,
  não implementação apressada).

## 11. Critérios para sair da fase "estrutural" e iniciar implementação real

Nenhum destes é opcional. Implementação real (mesmo com dado sintético)
só deve começar depois de:

1. **Decisões de produto/RH** resolvidas o suficiente para fechar ao
   menos o núcleo mínimo. **(Baseline V1, 2026-08-07)** este critério está
   **parcialmente satisfeito**: DP-3J-02, DP-3J-03 e DP-3J-06 resolvidas
   para V1; DP-3J-04 e DP-3J-05 resolvidas quanto ao mecanismo/registro;
   DP-3J-01 esclarecida (não bloqueia por não haver escala complexa). Isso
   resolve o critério 1 — **não** os critérios 2 a 6 abaixo, nenhum dos
   quais é satisfeito pela Baseline V1.
2. **Validação jurídico/DPO** confirmando validade legal e requisitos
   regulatórios aplicáveis (DP-3J-09) antes de qualquer controle de
   jornada ser tratado como funcional além de estrutura interna de teste.
3. **Matriz de autorização** aprovada e registrada (substituindo a matriz
   quase vazia de §7) antes de qualquer endpoint de leitura ou escrita
   existir.
4. **MFA implementado e obrigatório** antes de qualquer piloto com dado
   real — mesma condição já registrada na ADR 0003 (decisão 3) para todo o
   sistema, reafirmada aqui por se tratar de dado de jornada/presença.
5. **Política de retenção definida** (DP-3J-11) por jurídico/DPO antes de
   qualquer dado real ser gravado — reter indefinidamente por padrão
   (mesmo comportamento hoje aplicado a `audit_event`, ADR 0004) só é
   aceitável enquanto não há prazo jurídico aprovado; não é substituto
   permanente de uma política real.
6. **Implementação revisada por segurança humana** antes de qualquer dado
   real entrar em ambiente não isolado — mesmo padrão de todas as fatias
   anteriores desta trilha.

Com a Baseline V1, o critério 1 está parcialmente satisfeito (ver acima);
**os critérios 2 a 6 continuam integralmente não satisfeitos**. Este
documento **não declara** aderência legal, conclusão de LGPD, nem
validade trabalhista de nenhum controle de jornada — apenas organiza o
que precisa ser decidido antes de qualquer um desses critérios poder ser
avaliado, e nenhuma decisão registrada até aqui autoriza início de
código.

## 12. Arquivos previstos para a fase Implementar (não criados agora)

```text
# Ilustrativo — nenhum arquivo abaixo existe nesta fase; nomes sujeitos a
# revisão quando as decisões pendentes (§9) forem resolvidas.

apps/api/src/jornada-ponto/                    # módulo futuro, NAO criado
apps/api/prisma/migrations/<data>_jornada_ponto_estrutural/  # NAO criado

# Ja criados na fase "Registrar decisao aprovada" (2026-08-07) — documentais,
# sem nenhum artefato de codigo/schema/infraestrutura:
docs/decisions/etapa3-jornada-ponto-baseline-v1.md            # CRIADO
docs/adr/0008-jornada-ponto-rastreavel-baseline-v1.md         # CRIADO

# Explicitamente NAO previstos nesta V1 Estrutural (bloqueados por
# decisão pendente, ver §9 e §4):
#   apps/api/src/jornada-ponto/importacao-txt/    # DP-3J-07
#   apps/api/src/jornada-ponto/integracao-folha/  # DP-3J-08
#   apps/api/src/jornada-ponto/biometria/         # DP-3J-10
#   apps/api/src/jornada-ponto/geolocalizacao/    # DP-3J-10
#   apps/api/src/jornada-ponto/calculo/           # DP-3J-09, fora de escopo (§4)
```

## 13. Referências

- [Baseline V1 de Jornada e Ponto Rastreável](../decisions/etapa3-jornada-ponto-baseline-v1.md) —
  as 8 decisões de produto aprovadas (2026-08-07) que esta especificação
  reflete.
- [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) —
  formalização arquitetural da Baseline V1.
- [docs/ROADMAP.md](../ROADMAP.md) — Etapa 3 no roadmap geral.
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) — regras de segurança
  transversais (menor privilégio, negação por padrão, auditoria).
- [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) — MFA
  obrigatório antes de piloto com dado real (decisão 3), princípio de não
  antecipar estrutura (decisão 8).
- [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) — modelo de
  evento de auditoria sem valor antes/depois (decisão 5), correção por
  evento complementar (decisão 3).
- [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) —
  princípio de não antecipar hierarquia/gestor (decisão 8), vigência
  (decisão 9), escopo de `gestor` pendente (DP-8).
- [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md) e
  [Etapa 1 — Fatia 2](etapa1-fatia2-colaboradores-vida-funcional.md) —
  `VinculoFuncional` como ponto de ancoragem obrigatório (O1), correção
  por retificação (§4.10), matriz de acesso como padrão de negação por
  default.
