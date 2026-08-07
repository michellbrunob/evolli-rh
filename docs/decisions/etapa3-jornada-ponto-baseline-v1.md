# Baseline V1 de Jornada e Ponto Rastreável — decisão aprovada

Status: **DECISÃO APROVADA** (2026-08-07)

Relacionado:
[docs/modules/etapa3-jornada-ponto-rastreavel-estrutural.md](../modules/etapa3-jornada-ponto-rastreavel-estrutural.md)
(spec atualizada para refletir esta decisão),
[ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
(formalização arquitetural), e — pelo padrão já usado nas Fatias 1 e 2 —
[docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md](etapa1-fatia2-colaboradores-baseline-v1.md)
como precedente de formato para este tipo de registro.

## 0. Escopo e limites deste documento

Este documento registra **o que o produto decidiu** em 2026-08-07 para a
Etapa 3 (Jornada e Ponto Rastreável): um conjunto de 8 decisões que
resolve o núcleo mínimo necessário para uma futura fase Implementar
começar **com dados sintéticos**, sem esperar por decisões que
legitimamente seguem fora do alcance de uma decisão de produto isolada —
validade legal, retenção jurídica, tratamento de biometria/geolocalização,
MFA.

**O que este documento não faz:**

- Não implementa nada — nenhum código, schema, migration, endpoint,
  teste, dependência, infraestrutura ou interface é criado aqui.
- Não cria tabela, enum de banco ou contrato de API — os conceitos
  aprovados (§1) continuam existindo só como especificação, até uma fase
  Implementar futura, que não foi autorizada por esta decisão.
- Não altera nenhuma ADR anterior (0001 a 0007) — apenas referencia,
  onde aplicável.
- Não resolve importação TXT, integração com folha, biometria,
  geolocalização, dispositivo, validade legal, retenção/descarte, acesso
  do titular ou escopo do papel `gestor` — todos seguem pendentes, sem
  decisão por inferência (§2).
- Não declara conformidade LGPD, base legal ou validade trabalhista como
  concluídas — ver §2 para a distinção explícita entre o que esta decisão
  libera para uma futura implementação sintética e o que continua
  bloqueando dado real.
- Não cria acesso global, cross-company ou a dado/documento fora deste
  módulo — a concessão a RH e DP (decisão 5) é estritamente limitada ao
  que está descrito nela.

## 1. As 8 decisões aprovadas

Cada decisão preserva, como histórico, o que a especificação estrutural
original (2026-08-07) deixava como pendência — referenciado abaixo, não
duplicado.

### Decisão 1 — Jornada e escala

**Aprovado:** a V1 não implementa escala complexa; mantém somente a
estrutura conceitual já aprovada na especificação (jornada como contrato
de tempo esperado, escala como distribuição concreta no calendário —
spec §3.1, §3.2).

**Contexto preservado (spec original, DP-3J-01):** a especificação
estrutural registrava como pendente "quantos padrões de jornada/escala
existem, e se `Jornada` e `EscalaJornada` são entidades separadas ou uma
só". Esta decisão não escolhe entre essas alternativas — decide apenas
que, **nesta V1**, nenhuma delas precisa ser resolvida, porque nenhuma
escala complexa (turno, revezamento, múltiplos padrões simultâneos) será
implementada. A separação conceitual entre jornada e escala, já registrada
na especificação (§3.6), permanece como referência para quando a
modelagem real for decidida — não é descartada, é apenas **não
implementada** nesta V1.

**Efeito na especificação:** DP-3J-01 permanece pendente quanto ao modelo
final; **esclarecido** que a V1 não depende de resolvê-lo, por não
implementar escala complexa.

### Decisão 2 — Eventos iniciais

**Aprovado:** catálogo fechado de quatro tipos de evento para esta V1:
`entrada`, `saida`, `inicio_pausa`, `fim_pausa`.

**Contexto preservado (spec original, DP-3J-02):** a especificação
deixava em aberto "quais tipos de evento existem, e se o catálogo é fixo
ou versionável". Esta decisão fecha o catálogo desta V1 com os quatro
valores mínimos operacionalmente necessários para registrar uma jornada
básica de entrada/saída com um intervalo. Nenhum outro tipo (ex.: evento
de justificativa, evento de abono) entra nesta V1. Se o catálogo precisar
crescer no futuro, é decisão própria, tratada como **DP-3J-02 (V2)**.

**Efeito na especificação:** resolve **DP-3J-02** para o escopo desta V1.

### Decisão 3 — Origem

**Aprovado:** registro manual interno apenas. Sem importação TXT,
biometria, foto, geolocalização, IP como evidência, dispositivo ou
integração externa.

**Contexto preservado (spec original, DP-3J-03, DP-3J-07, DP-3J-10):** a
especificação já tratava biometria/geolocalização/dispositivo (§5.1) e
importação TXT (§4) como fora de escopo desta fatia, mas como pendências
a decidir, não como exclusões permanentes confirmadas por decisão de
produto. Esta decisão confirma, para esta V1, que a única origem
permitida é o registro manual feito internamente pelo papel autorizado
(decisão 5) — nenhuma das demais origens é implementada nem parcialmente
preparada.

Esta decisão **não resolve** DP-3J-07 (importação TXT futura) nem
DP-3J-10 (tratamento de biometria/geolocalização/dispositivo) — apenas
confirma que nenhuma delas entra nesta V1. As duas seguem pendentes,
exigindo decisão própria de produto/jurídico/DPO quando forem retomadas.

**Efeito na especificação:** resolve **DP-3J-03** para o escopo desta V1;
DP-3J-07 e DP-3J-10 permanecem pendentes, agora com exclusão explícita
confirmada (não apenas "fora do escopo original", mas "fora por decisão
de produto registrada").

### Decisão 4 — Correção

**Aprovado:** o evento original nunca é alterado nem apagado; correção
ocorre por ajuste rastreável, sem campo de texto livre.

**Contexto preservado (spec original §3.3, §3.4):** a especificação já
registrava, como princípio herdado (não decisão nova), que o evento de
ponto é imutável e que qualquer correção deveria ocorrer por um registro
posterior (ajuste), nunca por sobrescrita. Esta decisão confirma esse
princípio como decisão de produto formal para a Baseline V1, e acrescenta
uma restrição não estava fechada antes: o ajuste **não aceita texto
livre** — mesmo princípio já usado para `motivo_codigo` em Movimentação
Funcional (Fatia 2, Decisão 11: "catálogo controlado, nunca texto livre"),
aplicado aqui pela mesma razão — risco de dado sensível digitado sem
classificação num campo de observação. O conteúdo exato do que um ajuste
registra (motivo codificado, referência ao evento original, novo
valor proposto) é detalhe de modelagem, não resolvido aqui.

**Efeito na especificação:** resolve o mecanismo de **DP-3J-04**
(correção é sempre por ajuste, nunca por texto livre); quem pode propor
um ajuste é resolvido pela Decisão 5.

### Decisão 5 — Acesso V1

**Aprovado:** RH e DP, limitados à própria empresa, podem registrar e
consultar. Todos os demais papéis permanecem negados, incluindo
`admin_tecnico`, `gestor`, `colaborador`, `financeiro`, `auditor` e
`dpo`.

**Contexto preservado (spec original §7, matriz quase vazia):** a
especificação deixava a matriz de acesso inteiramente pendente,
incluindo para RH e DP — nenhum papel tinha célula preenchida além de
`admin_tecnico`, negado por consequência de princípio já aprovado em
outros domínios. Esta decisão preenche duas células: RH e DP passam a
poder **registrar** (criar evento e ajuste) e **consultar**, sempre
restritos à própria empresa (mesmo princípio de fronteira de autorização
já usado em todo o sistema — `empresaId`, alcançado via
`VinculoFuncional`). Nenhuma outra ação (aprovar, fechar) é concedida a
ninguém nesta V1, porque nenhuma delas existe (Decisão 7).

**Esta é uma decisão limitada à V1, não uma concessão de acesso global.**
Especificamente:

- Não cria acesso cross-company. RH e DP de uma empresa não acessam
  evento, ajuste, apuração ou dado de Jornada e Ponto de outra empresa —
  mesmo padrão de segregação já obrigatório em Pessoas (Fatia 2) e
  Organização (Fatia 1).
- Não cria acesso a dado ou documento fora deste módulo. A concessão
  vale só para os conceitos de Jornada e Ponto desta especificação —
  não estende, por analogia, acesso de RH/DP a nenhum outro domínio
  (ex.: documentos da Etapa 2, quando existir).
- **`admin_tecnico` permanece negado**, sem exceção — mesmo princípio já
  aplicado em Pessoas (Fatia 2, Decisão 8: a exceção de acesso amplo do
  `admin_tecnico` foi concedida sobre estrutura organizacional, não sobre
  dado pessoal, e não se estende por herança). Jornada e Ponto trata de
  dado de comportamento/presença — pelo menos tão sensível quanto o
  cadastro de Pessoas — logo a mesma negação se aplica, com o mesmo
  raciocínio, não por analogia automática.
- **`gestor` permanece negado**, porque seu escopo segue indefinido
  (DP-8, ADR 0006) — esta decisão não antecipa nem resolve essa pendência,
  apenas confirma que, sem ela resolvida, não há base para conceder
  acesso.
- **`colaborador` permanece negado** — o Portal do Colaborador (consulta
  pelo próprio titular) segue fora de escopo desta fatia (spec §4), sem
  alteração.
- **`financeiro`, `auditor`, `dpo` permanecem negados** — nenhum deles
  recebe acesso por analogia com o que já têm em outros domínios (ex.:
  `auditor`/`dpo` já leem `access_log`, mas isso não se estende a
  Jornada e Ponto sem decisão própria).

**Efeito na especificação:** resolve **DP-3J-05** para o núcleo de
registro e consulta desta V1 (RH e DP); a parte da decisão referente a
"quem aprova e fecha" fica sem objeto, porque aprovação e fechamento não
existem nesta V1 (Decisão 7).

### Decisão 6 — Competência

**Aprovado:** competência mensal, apenas como organização do histórico;
não calcula horas, banco de horas, adicional, jornada legal, folha ou
qualquer regra trabalhista.

**Contexto preservado (spec original §3.5, DP-3J-06):** a especificação
deixava em aberto o conceito de competência/período de apuração. Esta
decisão fecha a granularidade (mensal) mas **não aprova nenhum motor de
cálculo** — a apuração, nesta V1, é só um agrupamento organizacional de
eventos e ajustes por mês, sem produzir nenhum resultado de negócio
(hora extra, banco de horas, adicional noturno, DSR, jornada legal ou
integração com folha). Essas seguem, sem exceção, fora de escopo (spec
§4) e sujeitas a DP-3J-08 (integração com folha) e DP-3J-09 (validade
legal), ambas pendentes.

**Efeito na especificação:** resolve **DP-3J-06** quanto à granularidade
(mensal); reafirma que nenhuma regra de cálculo trabalhista é aprovada
por esta decisão.

### Decisão 7 — Aprovação e fechamento

**Aprovado:** aprovação e fechamento ficam fora da V1; não implementar
workflow de aprovação, aprovação por gestor ou fechamento legal.

**Contexto preservado (spec original §3.6, §4, DP-3J-05):** a
especificação já registrava fechamento como conceito de controle de
estado (§3.6), sem produzir efeito de liquidação financeira, e aprovação
por gestor como explicitamente fora de escopo (§4), bloqueada por DP-8
(ADR 0006). Esta decisão confirma os dois como não implementados nesta
V1 — nenhum `FechamentoPonto` funcional, nenhum workflow de aprovação,
nenhuma segunda revisão humana sobre o que RH/DP registram.

**Risco decorrente, já da mesma natureza do identificado na Fatia 2
(Decisão 7, sem workflow de aprovação):** sem aprovação, um erro de RH/DP
se torna efetivo sem checagem prévia. A mitigação disponível nesta V1 é
a mesma já usada em Pessoas — auditoria de quem registrou e correção por
ajuste rastreável (Decisão 4) — não uma segunda aprovação.

**Efeito na especificação:** confirma que aprovação/fechamento não fazem
parte desta V1; a matriz de "quem aprova e fecha" (parte de DP-3J-05)
permanece sem objeto até uma fatia futura decidir implementar esses
fluxos.

### Decisão 8 — Dados reais

**Aprovado:** dados reais permanecem bloqueados até validação
jurídica/DPO, política de retenção/descarte e MFA. A implementação
futura permanece exclusivamente com dados sintéticos até esses gates
serem cumpridos.

**Contexto preservado (spec original §11, O3):** a especificação já
registrava, como observação (O3), que jornada e ponto são matéria
regulada pela legislação trabalhista, sem declarar aderência a nenhuma
norma específica, e listava os critérios de saída da fase estrutural
(§11): decisão de produto/RH, validação jurídico/DPO, matriz de
autorização, MFA, política de retenção e revisão humana de segurança.
Esta decisão não antecipa nenhum desses gates — apenas os reafirma como
condição de bloqueio explícita, na forma de decisão de produto, não só
de observação de especificação.

**Efeito na especificação:** reafirma os gates do §11 da especificação
original, sem alterá-los; confirma que as decisões 1 a 7 acima autorizam,
no máximo, uma futura implementação com **dados sintéticos** — nunca
dado real, piloto ou produção.

## 2. Implementação com dados sintéticos × gate para dados reais/piloto/produção

Esta é a distinção central que separa "o que esta decisão libera" de "o
que continua bloqueado", e não pode ser confundida em nenhuma direção.
**Importante: esta decisão não autoriza, por si só, o início de uma fase
Implementar.** Ela resolve o núcleo mínimo de decisões de produto que uma
futura fase Implementar exigiria antes de começar — a decisão de
efetivamente iniciar essa fase é ato separado, não coberto por este
documento.

### O que as 8 decisões liberariam, se e quando uma fase Implementar for autorizada

As decisões 1 a 8 acima resolvem, para o núcleo conceitual de Jornada e
Ponto (jornada/escala, evento, ajuste, apuração), decisões de produto que
antes bloqueavam qualquer especificação de schema ou contrato. Se uma
fase Implementar futura for autorizada separadamente, com **dados
exclusivamente sintéticos**, ela poderia se apoiar em:

- Catálogo fechado de quatro tipos de evento (Decisão 2).
- Origem única: registro manual interno (Decisão 3).
- Mecanismo de correção definido: ajuste rastreável, sem texto livre
  (Decisão 4).
- Matriz de acesso mínima resolvida: RH e DP, por empresa, registram e
  consultam; todo o resto negado (Decisão 5).
- Granularidade de competência definida: mensal, sem cálculo (Decisão 6).
- Escopo negativo confirmado: sem escala complexa, sem aprovação, sem
  fechamento legal (Decisões 1 e 7).

### O que continua bloqueado até dados reais, piloto ou produção

Nenhuma das 8 decisões acima resolve os seguintes itens — permanecem
exatamente como estavam na especificação original, e continuam impedindo
qualquer operação com dado real, mesmo que uma futura implementação já
exista e passe em todos os testes com dado sintético:

- **MFA (TOTP)** — obrigatório antes de qualquer piloto com dado real ou
  produção ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  decisão 3). Esta Baseline V1 não altera nem enfraquece essa condição em
  nenhum grau.
- **DP-3J-09 — Validade legal e requisitos regulatórios aplicáveis.**
  Jurídico ainda precisa confirmar qual norma trabalhista se aplica ao
  controle de jornada implementado, e sob quais condições o registro
  produzido tem validade legal.
- **DP-3J-11 — Retenção, descarte e acesso do titular.** DPO e jurídico
  ainda precisam definir prazo, critério de descarte e forma de acesso do
  titular ao próprio histórico de ponto.
- **DP-3J-10 — Biometria, geolocalização e dispositivo.** Confirmado como
  fora desta V1 (Decisão 3), mas o tratamento futuro — se será
  implementado, sob qual base legal, com qual controle técnico — segue
  inteiramente pendente.
- **DP-3J-07 — Importação TXT futura.** Confirmado como fora desta V1
  (Decisão 3), formato/layout/proveniência seguem pendentes.
- **DP-3J-08 — Integração com folha.** Não endereçada por nenhuma das 8
  decisões.
- **DP-3J-12 — Escopo do papel `gestor`.** Segue bloqueado por DP-8
  (ADR 0006), sem relação com esta decisão.
- **Confirmação formal de DPO** de que o núcleo de dado operacional
  (§5.1 da especificação) tem base legal e finalidade adequadas para uso
  com titular real — esta decisão de produto não substitui essa
  confirmação.

### Declaração explícita

**Esta decisão não declara aprovação jurídica, conformidade LGPD ou
validade trabalhista concluídas, em nenhum grau.** Ela resolve um
conjunto fechado de 8 decisões de produto para o núcleo conceitual desta
V1 — nada além disso. Início de código, schema, migration ou qualquer
artefato de implementação real depende de autorização própria, separada
deste documento.

## 3. Rastreabilidade

| Item da tarefa (enunciado original) | Decisão nesta Baseline | Seção da spec atualizada                    |
| ----------------------------------- | ---------------------- | ------------------------------------------- |
| 1. Jornada e escala                 | Decisão 1              | §3.1, §3.2, §9 (DP-3J-01)                   |
| 2. Eventos iniciais                 | Decisão 2              | §3.3, §9 (DP-3J-02)                         |
| 3. Origem                           | Decisão 3              | §4, §5.1, §9 (DP-3J-03, DP-3J-07, DP-3J-10) |
| 4. Correção                         | Decisão 4              | §3.4, §9 (DP-3J-04)                         |
| 5. Acesso V1                        | Decisão 5              | §7, §9 (DP-3J-05)                           |
| 6. Competência                      | Decisão 6              | §3.5, §9 (DP-3J-06)                         |
| 7. Aprovação e fechamento           | Decisão 7              | §3.6, §4, §9 (DP-3J-05)                     |
| 8. Dados reais                      | Decisão 8              | §11                                         |
