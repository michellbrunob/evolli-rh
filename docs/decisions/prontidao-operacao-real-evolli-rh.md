# Prontidão para operação real — Ecossistema Evolli RH (Ponto V1)

Status: **PANORAMA EXECUTIVO E TÉCNICO** — não é decisão, não é autorização e não
declara conformidade.

Relacionado:
[Baseline V1 de Jornada e Ponto](etapa3-jornada-ponto-baseline-v1.md),
[Pacote de decisão — Segurança operacional](pacote-decisao-seguranca-operacional.md),
[Pacote de decisão — Compensação e quitação de Banco de Horas](pacote-decisao-compensacao-quitacao-banco-horas.md),
[Baseline V1 do Painel Administrativo Web](painel-administrativo-web-v1-baseline.md),
[Convergência CCT 2026/2027 — Jornada e Ponto](etapa3-cct-2026-2027-convergencia-jornada-ponto.md);
ADRs [0003](../adr/0003-identidade-sessao-e-autorizacao.md),
[0004](../adr/0004-auditoria-formal-e-integridade.md),
[0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
[0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md),
[0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md),
[0009](../adr/0009-painel-administrativo-web-v1.md),
[0011](../adr/0011-documentos-privados-e-admissao-digital.md),
[0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md);
e a especificação detalhada
[Jornada e Ponto V1 (detalhada)](../modules/etapa3-jornada-ponto-v1-detalhada.md).

## 0. Natureza e limites deste documento

Este documento é um **retrato de prontidão** para a diretoria e para as áreas
técnicas: descreve **onde o Ecossistema Evolli RH está hoje** rumo a uma
operação real de Ponto V1, **o que falta** e **em que ordem segura** avançar.

**O que este documento NÃO faz** (limites inegociáveis):

- **Não implementa nada** — nenhum código, schema, migration, endpoint, API,
  dependência, persistência ou interface é criado por esta tarefa.
- **Não usa nem habilita dado real** — não há colaborador real, CPF, batida
  real, PDF, assinatura real ou importação real neste trabalho.
- **Não decide** nenhuma pendência nem levanta nenhum gate: apenas **registra**
  o estado das decisões e dos bloqueadores, sem resolvê-los.
- **Não atribui datas, prazos, percentuais de conclusão** nem cronograma.
- **Não declara conformidade** com a CCT 2026/2027, com a Portaria MTP 671/2021,
  com a LGPD ou com qualquer requisito trabalhista/regulatório. As referências a
  essas normas são **operacionais**, nunca declarações de aderência.

**Ressalva central:** tudo que hoje está "pronto" está pronto **apenas com dados
sintéticos**, em memória e isolado. **Pronto sintético ≠ operação real ≠
conformidade legal.** Nenhum dado real pode entrar em nenhum ambiente enquanto o
gate-mestre de segurança operacional (`DS-OPS-01`) estiver aberto.

## 1. Status atual

### 1.1 Fundações de governança, RBAC, auditoria e segregação por empresa

Implementadas como **base real do produto** (não sintéticas), porém ainda **sem
dado real de colaborador**:

- **Identidade, sessão e autorização** com papéis segregados
  ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md)); o **MFA**
  permanece como **gate aberto** para operação real.
- **Auditoria formal e integridade** append-only
  ([ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)), com serviço de
  auditoria dedicado do domínio de Ponto.
- **Segregação por empresa** (`empresa_id`) como fronteira estrutural
  ([ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)) e
  **vínculo funcional** do colaborador
  ([ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)).
- **Governança de privacidade e perfis globais** — RH + Jurídico como
  responsáveis, `master_tecnico` como único acesso global standing
  ([ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)).

### 1.2 Painel visual demonstrativo

Há um **painel administrativo web V1** já disponível como baseline visual
([ADR 0009](../adr/0009-painel-administrativo-web-v1.md),
[baseline](painel-administrativo-web-v1-baseline.md)) — demonstrativo, sem operar
sobre dado real de ponto.

### 1.3 Núcleos sintéticos do fluxo de Ponto

Cada núcleo é **TypeScript puro**, isolado, **sem NestJS/Prisma/I/O/banco/rede**,
operando **só sobre dados sintéticos** e **não ligado a nenhum módulo Nest**:

| Núcleo                          | Onde                                   | Contrato                                                                                   |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Apuração diária                 | `apps/api/src/ponto/apuracao/`         | [motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md)                   |
| Extrato/saldo de Banco de Horas | `apps/api/src/ponto/banco-horas/`      | [ciclo de vida do Banco de Horas](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md) |
| Propostas de compensação        | `apps/api/src/ponto/compensacao/`      | [compensação de Banco de Horas](../modules/etapa3-banco-horas-compensacao-contrato-v1.md)  |
| Fila "Verificar folhas"         | `apps/api/src/ponto/verificar-folhas/` | [contrato da fila](../modules/etapa3-fila-verificar-folhas-contrato-v1.md)                 |
| Fechamento/Espelho (conceitual) | `apps/api/src/ponto/fechamento/`       | [fechamento e Espelho](../modules/etapa3-fechamento-espelho-contrato-v1.md)                |
| Orquestração ponta a ponta      | `apps/api/src/ponto/orquestracao/`     | valida os **handoffs** entre os núcleos acima                                              |
| Parser AFD (leiaute técnico)    | `apps/api/src/ponto/afd/`              | [contrato técnico do parser AFD](../modules/etapa3-parser-afd-contrato-tecnico-v1.md)      |

**Isso não equivale a operação real nem a conformidade legal.** É a validação
técnica dos conceitos, com dado inventado, aguardando decisões de negócio,
gates de segurança/jurídico e um desenho de persistência ainda não autorizado.

## 2. Matriz de prontidão por frente

Legenda de **status**: **Pronto sintético** (validado só com dado sintético) ·
**Pendente de decisão** (aguarda decisão de negócio/produto/RH) · **Bloqueado
para dado real** (existe gate de segurança/jurídico impedindo dado real) ·
**Futuro** (evolução não iniciada).

| Frente                                                  | Status                                                             | Evidência / referência técnica                                                                                                                                                                   | Responsável                           | Gate ou decisão necessária                                                   | Próximo passo                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Identidade / MFA                                        | Bloqueado para dado real                                           | RBAC e sessão operantes ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md)); MFA não ativado                                                                                            | TI + Segurança                        | **MFA** (gate de identidade)                                                 | Decidir fator e ativar MFA antes de qualquer dado real                  |
| Segurança operacional (`DS-OPS-01`)                     | Bloqueado para dado real                                           | [Pacote de segurança operacional](pacote-decisao-seguranca-operacional.md)                                                                                                                       | Diretoria + TI + Segurança + Jurídico | **`DS-OPS-01`** (gate-mestre)                                                | Fechar todos os gates dependentes; só então avaliar dado real           |
| Retenção / base legal                                   | Pendente de decisão                                                | `DP-3J-11` (retenção/descarte/acesso do titular); `BH-07`                                                                                                                                        | Jurídico + RH                         | `DP-3J-11`, `BH-07`                                                          | Definir política de retenção, descarte e acesso do titular              |
| Cadastros: empresas, colaboradores, horários, vigências | Pronto sintético                                                   | [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md); catálogo de horários (§9 da detalhada)              | Produto + RH                          | `DP-3J-22` (marcos das jornadas 1/2/19 não recebidos)                        | Receber os marcos faltantes; confirmar vigências antes de dado real     |
| Importação manual TXT / AFD                             | Bloqueado para dado real                                           | [contrato do parser AFD](../modules/etapa3-parser-afd-contrato-tecnico-v1.md), [lote de importação](../modules/etapa3-lote-importacao-afd-contrato-v1.md)                                        | Fornecedor (RWTech) + Jurídico + TI   | `DP-3J-20` (leiaute/homologação), `DP-3J-09` (validade legal)                | Homologar o fornecedor campo a campo contra amostra sintética           |
| Associação por CPF                                      | Bloqueado para dado real                                           | Identificador CPF citado só como hipótese técnica (`DP-3J-20`)                                                                                                                                   | RH + Jurídico + TI                    | `DP-3J-20`, `DP-3J-11`, `DS-OPS-01`                                          | Definir base legal e retenção do CPF antes de associar dado real        |
| Apuração diária                                         | Pronto sintético                                                   | `apps/api/src/ponto/apuracao/`; [motor puro V1](../modules/etapa3-motor-apuracao-puro-v1.md); [caderno de homologação](../modules/etapa3-caderno-homologacao-apuracao-jornada-banco-horas-v1.md) | Produto + RH                          | `DP-3J-09` (validade legal) para dado real                                   | Homologação do caderno pelo RH                                          |
| Banco de Horas                                          | Pronto sintético                                                   | `apps/api/src/ponto/banco-horas/`; [ciclo de vida](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md)                                                                                      | Produto + RH + Jurídico               | `BH-01`..`BH-03`, `BH-08` (validade, consumo, saldo negativo, ajuste humano) | Decidir política de créditos/consumo/saldo negativo                     |
| Compensação                                             | Pronto sintético                                                   | `apps/api/src/ponto/compensacao/`; [compensação](../modules/etapa3-banco-horas-compensacao-contrato-v1.md)                                                                                       | RH + Jurídico                         | `BH-REG` (proposta → `debito_compensacao`), `BH-04`, `BH-05`                 | Decidir alçada, evidência e registro efetivo                            |
| Fila "Verificar folhas"                                 | Pronto sintético                                                   | `apps/api/src/ponto/verificar-folhas/`; [contrato da fila](../modules/etapa3-fila-verificar-folhas-contrato-v1.md)                                                                               | RH                                    | Semântica de severidade/reabertura (RH + Jurídico)                           | Homologar a operação da fila com o RH                                   |
| Fechamento / Espelho                                    | Pronto sintético                                                   | `apps/api/src/ponto/fechamento/`; [fechamento e Espelho](../modules/etapa3-fechamento-espelho-contrato-v1.md)                                                                                    | Produto + RH + Jurídico               | `DP-3J-09`; reabertura/correção (pendentes)                                  | Homologar o ciclo conceitual; sem PDF/assinatura real                   |
| Assinatura manual e assinatura eletrônica               | Pendente de decisão (manual) / Futuro (eletrônica)                 | Assinatura manual como etapa operacional externa (§3.1 da detalhada); eletrônica liga a Documentos Nível 2 ([ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md)), `BH-05`          | RH + Jurídico                         | Documentos Nível 2; solução de assinatura eletrônica                         | Definir formato/evidência da conferência; avaliar assinatura eletrônica |
| Folha / quitação                                        | Bloqueado para dado real / Futuro                                  | `BH-06`, `BH-QUIT`, `DP-3J-21` (efeito financeiro)                                                                                                                                               | Diretoria + Folha + Jurídico + RH     | `BH-06`, `BH-QUIT`, `DP-3J-21` financeiro                                    | Autorização da diretoria; desenhar integração com a Folha               |
| Auditoria e monitoramento                               | Pronto sintético (auditoria) / Pendente de decisão (monitoramento) | [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md); serviço de auditoria de Ponto                                                                                                         | TI + Segurança                        | Monitoramento operacional (parte de `DS-OPS-01`)                             | Definir observabilidade/alarmes para operação real                      |

## 3. Separação por natureza de prontidão

### 3.1 Implementado apenas com sintéticos

Apuração diária, extrato/saldo de Banco de Horas, propostas de compensação, fila
"Verificar folhas", fechamento/Espelho conceitual, orquestração ponta a ponta e
o parser AFD (leiaute) — todos **TypeScript puro**, com fixtures e testes
**exclusivamente sintéticos**, **sem** persistência, API, UI ou dado real.

### 3.2 Documentado, porém não implementado

Importação real via TXT/AFD, associação por CPF, cálculo/efeito financeiro,
compensação efetiva (`debito_compensacao`), quitação, Espelho em PDF, assinatura
(manual formalizada e eletrônica) e integração com a Folha — **especificados
como alvo** nos contratos/detalhada, **sem** código, schema ou API.

### 3.3 Bloqueado por decisão / gate

Qualquer entrada de **dado real** — bloqueada pelo gate-mestre `DS-OPS-01`, pelo
**MFA**, pela **validade legal** (`DP-3J-09`), pela **retenção/base legal**
(`DP-3J-11`, `BH-07`) e pelo **leiaute/homologação AFD** (`DP-3J-20`).

### 3.4 Evolução futura

Assinatura eletrônica, integração com a Folha (`BH-06`, `BH-QUIT`), efeito
financeiro de DSR (`DP-3J-21` financeiro) e observabilidade de produção — não
iniciadas.

## 4. Principais bloqueadores (registro, sem decisão)

Este documento **não decide** nenhum item abaixo; apenas os registra.

- **MFA** — fator de autenticação forte para operação real
  ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md)).
- **`DS-OPS-01`** — gate-mestre de segurança operacional: enquanto aberto,
  nenhum dado real entra em nenhum ambiente.
- **`DP-3J-09`** — validade legal e requisitos regulatórios do controle de
  jornada.
- **`DP-3J-11`** — retenção, descarte e acesso do titular ao próprio histórico.
- **`DP-3J-20`** — tipo de REP e leiaute oficial AFD/AEJ (Portaria 671, com CPF)
  e homologação do fornecedor.
- **`DP-3J-21` financeiro** — valor/desconto financeiro de DSR (aguarda
  diretoria + Folha + Jurídico).
- **`DP-3J-22`** — marcos e regras das jornadas pendentes de homologação,
  conforme documentação de Jornada/Ponto.
- **`BH-01`..`BH-08`** — validade/expiração de créditos, ordem de consumo, saldo
  negativo, alçada de aprovação, documento/evidência, integração com a Folha,
  retenção/descarte e semântica do ajuste humano.
- **`BH-REG`** — quando uma proposta aprovada vira `debito_compensacao`.
- **`BH-QUIT`** — como a quitação futura para a Folha vira evento rastreável.
- **Definição de persistência e de operação com dado real** — desenho de
  banco/persistência e ambiente ainda não autorizado.
- **Validação RH + Jurídico + Folha** — homologação das regras recebidas do RH e
  do enquadramento jurídico/financeiro.
- **Assinatura eletrônica** — solução e base legal (liga a Documentos Nível 2,
  [ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md)).
- **Integração com a Folha** — interface/evento e efeito monetário fora do Ponto.

## 5. Sequência de ativação segura (conceitual)

Ordem lógica, **sem datas, prazos, percentuais ou conformidade**. Cada etapa só
começa quando a anterior estiver satisfeita.

1. **Decisões e gates** — resolver os bloqueadores do §4 (com destaque para MFA,
   `DS-OPS-01`, `DP-3J-09`, `DP-3J-11`, o pacote `BH-*` e a definição de
   persistência).
2. **Desenho de persistência e auditoria** — modelar armazenamento, retenção e
   trilha de auditoria para dado real, respeitando `empresa_id` e a governança
   RH + Jurídico.
3. **Implementação controlada** — construir a camada de aplicação (API,
   persistência, UI) sobre os núcleos já validados, sem revogar as fronteiras.
4. **Testes com dados sintéticos** — repetir a homologação ponta a ponta na
   camada implementada, ainda **sem dado real**.
5. **Homologação RH / Jurídico** — validar formalmente regras de negócio,
   validade legal e retenção.
6. **Piloto sem integrar Folha** — operar um piloto controlado, **sem** efeito
   financeiro e **sem** integração com a Folha.
7. **Autorização formal antes de dado real** — decisão explícita da diretoria +
   RH + Jurídico + Segurança levantando `DS-OPS-01`, condição necessária para
   qualquer dado real.

> **Ponteiro (T062).** O passo 2 (**desenho de persistência e auditoria**) tem um
> **contrato arquitetural conceitual** — fronteiras entre os núcleos, princípios
> obrigatórios (segregação por empresa, referências técnicas/minimização,
> histórico append-only, saldo derivado, sem exclusão física, correção aditiva,
> 404 anti-enumeração, RBAC neutro), agregados conceituais futuros e uma sequência
> de implementação — em
> [contrato de persistência e auditoria do Ponto](contrato-persistencia-auditoria-ponto-v1.md).
> Esse contrato **não** cria schema/migration/DDL/API, **não** decide pendências
> e **não** declara conformidade.

> **Ponteiro (T065).** A frente de **autosserviço do colaborador** tem um
> **contrato conceitual da futura Central de Solicitações do Colaborador** —
> catálogo inicial (contestação de ponto, ausência, férias, atualização
> cadastral, documento), estados/transições em que o encaminhamento **não**
> executa mutação, permissões (colaborador só o próprio; RH da própria empresa;
> `master_tecnico` sem mutação; 404 anti-enumeração) e bloqueio de
> anexos/evidências — em
> [contrato da Central de Solicitações do Colaborador](../modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md).
> Segue **bloqueado para dado real** (MFA, `DS-OPS-01`, base legal/retenção,
> validação RH + Jurídico); esse contrato **não** cria portal/código/UI/
> persistência e **não** declara conformidade.

## 6. Declaração

Este é um **panorama de prontidão**, não uma decisão nem uma autorização. Não foi
criado código, API, schema, migration ou persistência por esta tarefa; não há
dado real, PDF, assinatura real ou importação real; e **não** se declara
conformidade com a CCT 2026/2027, com a Portaria MTP 671/2021 ou com qualquer
requisito legal. O estado "Pronto sintético" descreve **validação técnica com
dado inventado** — a operação real depende, integralmente, das decisões, gates e
homologações registrados acima.
