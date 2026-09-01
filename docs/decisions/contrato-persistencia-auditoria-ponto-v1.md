# Contrato de persistência e auditoria futura — módulo de Ponto V1

Status: **CONTRATO ARQUITETURAL (conceitual)** — não é decisão, não é
autorização, não implementa nada e não declara conformidade.

Relacionado:
[Prontidão para operação real](prontidao-operacao-real-evolli-rh.md) (matriz de
prontidão e bloqueadores),
[Baseline V1 de Jornada e Ponto](etapa3-jornada-ponto-baseline-v1.md),
[Pacote de decisão — Compensação e quitação de Banco de Horas](pacote-decisao-compensacao-quitacao-banco-horas.md);
contratos dos núcleos:
[motor de apuração puro V1](../modules/etapa3-motor-apuracao-puro-v1.md),
[ciclo de vida do Banco de Horas](../modules/etapa3-banco-horas-ciclo-vida-contrato-v1.md),
[compensação de Banco de Horas](../modules/etapa3-banco-horas-compensacao-contrato-v1.md),
[fila "Verificar folhas"](../modules/etapa3-fila-verificar-folhas-contrato-v1.md),
[fechamento e Espelho](../modules/etapa3-fechamento-espelho-contrato-v1.md);
ADRs [0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria append-only),
[0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md) (escopo por
empresa e 404 anti-enumeração),
[0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
(governança de perfis); e a
[especificação detalhada de Jornada/Ponto](../modules/etapa3-jornada-ponto-v1-detalhada.md).

## 0. Natureza e limites deste documento

Este documento é um **contrato arquitetural conceitual**: descreve **como uma
futura persistência e auditoria** do módulo de Ponto V1 **deveria** se comportar,
para que uma fase Implementar futura parta de fronteiras já acordadas — **sem**
antecipar nenhuma decisão pendente.

**O que este documento NÃO faz** (limites inegociáveis):

- **Não implementa nada** — nenhum código, schema, migration, DDL, endpoint,
  API, banco, índice, tabela, coluna, enum de banco ou dependência é criado.
- **Não decide** nenhuma pendência nem levanta nenhum gate: apenas **registra**
  fronteiras e princípios, deixando as decisões para quem é responsável.
- **Não usa dado real** — todos os exemplos são **sintéticos** (ex.: `EMP-A`,
  `V-001`, `PER-2026-08`), sem CPF, nome, empresa real, arquivo, print, valor
  financeiro ou dado pessoal.
- **Não declara conformidade** com a CCT 2026/2027, com a Portaria MTP 671/2021,
  com a LGPD ou com qualquer requisito trabalhista/regulatório.

Os nomes de agregado, campo e evento abaixo são **rótulos conceituais** para
comunicação, **nunca** contratos de banco ou de API. A modelagem real depende de
uma etapa de modelagem revisada (§6), ainda não autorizada.

## 1. Fronteiras conceituais entre os núcleos já integrados

O fluxo já validado com dados sintéticos (orquestração ponta a ponta) tem
fronteiras **rígidas** que uma futura persistência deve preservar:

1. **Apuração diária** — recebe jornada prevista + marcações sintéticas e produz
   componentes **separados** do dia (crédito e débito em minutos, apontamentos
   não financeiros). Não decide saldo acumulado nem dinheiro.
2. **Movimentos / extrato de Banco de Horas** — recebe movimentos **já
   normalizados** (crédito ou débito) derivados da apuração e produz um extrato
   com **saldo derivado**. Crédito e débito **nunca** são colapsados num líquido.
3. **Propostas de compensação** — máquina de estados da proposta (rascunho →
   submetida → aprovada/recusada/cancelada). **Não** cria movimento no extrato.
4. **Fila "Verificar folhas"** — máquina de estados de pendências de revisão,
   **independente do saldo**; a severidade é só priorização recebida.
5. **Fechamento / Espelho** — máquina de estados **linear** do período; **não**
   cria movimento, **não** altera saldo, **não** emite PDF real nem captura
   assinatura.
6. **Auditoria** — trilha **transversal** append-only (ADR 0004): cada transição
   dos itens 1–5 corresponde a um **evento técnico**, sem valores sensíveis.

Regra de ouro das fronteiras: **o saldo é sempre derivado dos movimentos**, e os
movimentos vêm **exclusivamente** da apuração — nunca de proposta, pendência,
fechamento ou ajuste manual.

## 2. Princípios obrigatórios de uma futura persistência

Toda persistência futura do módulo de Ponto **deve** honrar, sem exceção:

1. **Segregação por empresa** — todo registro é vinculado a uma `empresaRef`
   (`empresa_id`, ADR 0006); nenhuma leitura ou escrita cruza empresas.
2. **Referências técnicas e minimização de dados** — só identificadores técnicos
   (`empresaRef`, `vinculoRef`, `periodoReferencia`, ids técnicos); nunca CPF,
   nome, marcação bruta com horário exato desnecessário, arquivo ou dado pessoal
   além do estritamente necessário e decidido.
3. **Histórico append-only** — todo evento é acrescentado, nunca sobrescrito
   (ADR 0004); o passado não é reescrito.
4. **Saldo sempre derivado** — o saldo do Banco de Horas **não** é um campo
   mutável armazenado como verdade; é **derivado** da soma assinada dos
   movimentos preservados.
5. **Nenhuma exclusão física de histórico trabalhista** — não há `DELETE` de
   apuração, movimento, pendência, proposta, fechamento ou evento; retenção e
   descarte seguem pendentes (`DP-3J-11`, `BH-07`) e fora deste documento.
6. **Correção exclusivamente aditiva e rastreável** — uma correção é um **novo
   evento complementar** (nunca a edição do original, ADR 0004 §3), referenciando
   o item corrigido.
7. **404 anti-enumeração** — alvo fora do escopo responde **404** e registra um
   evento `denied` (ADR 0006); nunca revela existência de recurso de outra
   empresa.
8. **Autorização neutra e restrita** — apenas o **RH da própria empresa** opera
   (transições, correções); `master_tecnico` é acesso global **sem mutação**
   trabalhista (ADR 0012); `dp`, `gestor` e `colaborador` são **negados** para
   mutação neste módulo.

## 3. Agregados conceituais futuros

Rótulos conceituais — **sem** tabela, campo definitivo ou DDL. A modelagem real
é uma etapa futura (§6).

1. **Período de apuração** — a competência (ex.: mensal) de um vínculo.
2. **Resultado diário** — a apuração de um dia (componentes separados).
3. **Movimento de Banco de Horas** — um crédito **ou** um débito, em minutos.
4. **Proposta de compensação** — o ciclo de vida de uma proposta.
5. **Pendência de revisão** — um item da fila "Verificar folhas".
6. **Evento de fechamento** — uma transição do período/Espelho.
7. **Referência de Espelho** — o ponteiro conceitual para o Espelho do período
   (nunca o PDF/arquivo real).
8. **Evento de auditoria** — o registro técnico transversal de qualquer transição.

## 4. Detalhamento por agregado

Para cada agregado: **referência técnica mínima** · **eventos que podem ser
persistidos no futuro** · **eventos proibidos ou pendentes** · **dependências**
(retenção/base legal / dado real). Exemplos **sintéticos**.

### 4.1 Período de apuração

- **Referência mínima:** `empresaRef` (`EMP-A`), `vinculoRef` (`V-001`),
  `periodoReferencia` (`PER-2026-08`).
- **Persistível no futuro:** abertura do período, associação ao vínculo.
- **Proibido/pendente:** fechamento automático; qualquer efeito financeiro.
- **Dependências:** `DP-3J-09` (validade legal); dado real bloqueado por
  `DS-OPS-01`/MFA.

### 4.2 Resultado diário

- **Referência mínima:** id técnico do dia (`AP-2026-08-11-V001`),
  `dataReferencia`, componentes em minutos (crédito, débito, apontamentos não
  financeiros).
- **Persistível no futuro:** resultado apurado do dia; recomputo registrado como
  **novo** resultado (aditivo), nunca sobrescrita.
- **Proibido/pendente:** cálculo de dinheiro/DSR financeiro (`DP-3J-21`);
  associação por CPF (`DP-3J-20`); importação real de marcação.
- **Dependências:** `DP-3J-09`; homologação do caderno pelo RH.

### 4.3 Movimento de Banco de Horas

- **Referência mínima:** id técnico do movimento (`AP-2026-08-11-V001-C`),
  natureza (crédito/débito), minutos (inteiro positivo), origem técnica,
  `dataReferencia`.
- **Persistível no futuro:** registro do movimento derivado da apuração; extrato
  e saldo **derivados** (nunca um saldo mutável).
- **Proibido/pendente:** colapsar crédito e débito num líquido; `debito_quitacao`
  e `debito_compensacao` (ver §5); bloquear saldo negativo.
- **Dependências:** política de validade/consumo/saldo negativo pendente
  (`BH-01`..`BH-03`); retenção (`BH-07`).

### 4.4 Proposta de compensação

- **Referência mínima:** id técnico (`PROP-DEMO-0001`), `empresaRef`,
  `vinculoRef`, `periodoReferencia`, minutos propostos, justificativa codificada,
  estado.
- **Persistível no futuro:** transições da máquina de estados (submeter, aprovar,
  recusar, cancelar) como eventos aditivos + evento de auditoria.
- **Proibido/pendente:** **proposta aprovada não gera `debito_compensacao`**
  (§5); registro efetivo pendente (`BH-REG`); alçada/documento pendentes
  (`BH-04`/`BH-05`).
- **Dependências:** `BH-04`..`BH-07`; retenção/base legal.

### 4.5 Pendência de revisão

- **Referência mínima:** id técnico (`PEND-DEMO-0001`), `empresaRef`,
  `vinculoRef`, `periodoReferencia`, tipo, severidade (só priorização), estado,
  motivo codificado.
- **Persistível no futuro:** transições (iniciar revisão, aguardar informação,
  resolver sem alteração, descartar por erro técnico) como eventos aditivos.
- **Proibido/pendente:** severidade **não** decide fechamento nem altera saldo;
  pendência resolvida/descartada **não** altera saldo.
- **Dependências:** semântica de severidade/reabertura (RH + Jurídico).

### 4.6 Evento de fechamento

- **Referência mínima:** id técnico do período (`PER-DEMO-0001`), intervalo de
  referência, estado, papel técnico da transição.
- **Persistível no futuro:** transições lineares (enviar para verificação,
  marcar pronto, fechar operacionalmente, emitir Espelho conceitual, iniciar e
  registrar conferência manual) como eventos aditivos.
- **Proibido/pendente:** reabertura/recusa/correção/retrocesso (pendentes);
  criação de movimento; alteração de saldo; captura de assinatura.
- **Dependências:** `DP-3J-09`; decisões de reabertura (RH + Jurídico).

### 4.7 Referência de Espelho

- **Referência mínima:** ponteiro técnico ao período/estado do Espelho — **nunca**
  o PDF, arquivo, imagem ou assinatura real.
- **Persistível no futuro:** o estado conceitual "Espelho emitido / em
  conferência / conferência registrada".
- **Proibido/pendente:** PDF/arquivo real; assinatura manual (permanece externa)
  e assinatura eletrônica (futura e condicionada — §5).
- **Dependências:** Documentos Nível 2 (ADR 0011); solução de assinatura.

### 4.8 Evento de auditoria

- **Referência mínima:** metadados seguros (ator, papel snapshot, escopo por
  empresa, ação de catálogo fechado, recurso/id, resultado
  `success`/`failure`/`denied`), sem valores antes/depois (ADR 0004 §5).
- **Persistível no futuro:** um evento append-only por transição de qualquer
  agregado, escrito por um ponto único equivalente a `AuditService.record()`.
- **Proibido/pendente:** `dado_anterior`/`dado_novo`; edição/remoção de evento;
  hash encadeado/WORM/exportação/descarte (fora desta versão, ADR 0004 §4).
- **Dependências:** retenção/descarte (`DP-3J-11`); nenhuma nesta versão além do
  já decidido na ADR 0004.

## 5. Preservações expressas

Este contrato **não revoga** nem antecipa nada. Ficam expressamente preservados:

- **Proposta aprovada não gera `debito_compensacao`** — a aprovação é só de
  estado; o registro efetivo do débito permanece pendente (`BH-REG`) e fora deste
  documento.
- **Compensação, quitação e Folha seguem bloqueadas** por `BH-03`..`BH-07`
  (saldo negativo, alçada de aprovação, documento/evidência, integração com a
  Folha, retenção/base legal).
- **Assinatura manual permanece externa**; **assinatura eletrônica** é futura e
  condicionada (Documentos Nível 2, ADR 0011).
- **Nenhuma política é decidida aqui** — saldo negativo, validade/expiração de
  créditos, ordem de consumo, alçada de aprovação e retenção seguem **pendentes**
  (`BH-01`..`BH-08`, `DP-3J-11`), sem decisão por inferência.
- **MFA e `DS-OPS-01`** continuam **pré-condições** para qualquer dado real.
- **Nenhuma conformidade** com a CCT 2026/2027 ou a Portaria MTP 671/2021 é
  declarada.

## 6. Sequência conceitual para futura implementação

Ordem lógica, **sem datas, prazos, percentuais ou compromisso de ativação**.
Cada etapa só começa quando a anterior estiver satisfeita.

1. **Decisões e gates** — resolver os bloqueadores da
   [matriz de prontidão](prontidao-operacao-real-evolli-rh.md) (MFA, `DS-OPS-01`,
   `DP-3J-09/11`, `BH-*`).
2. **Modelagem revisada** — traduzir os agregados conceituais (§3/§4) em um
   modelo real, revisado, respeitando os princípios do §2.
3. **Migration controlada** — criar o schema com papéis segregados (padrão
   ADR 0002), append-only, sem exclusão física.
4. **Serviço / API com RBAC** — expor operações com autorização neutra (RH na
   própria empresa; `master_tecnico` sem mutação; demais negados) e 404
   anti-enumeração.
5. **Auditoria** — ligar cada transição a um evento append-only via ponto único
   (padrão `AuditService.record()`).
6. **Testes com dados sintéticos** — repetir a homologação ponta a ponta na
   camada persistida, ainda **sem dado real**.
7. **Homologação** — validação formal por RH + Jurídico (regras, validade legal,
   retenção).
8. **Piloto autorizado** — só após autorização formal levantando `DS-OPS-01`,
   sem integrar Folha.

## 7. Declaração

Este é um **contrato arquitetural conceitual**, não uma decisão nem uma
autorização. Não foi criado código, schema, migration, DDL, endpoint, API ou
banco; todos os exemplos são **sintéticos**, sem CPF, nome, empresa real,
arquivo, print, valor financeiro ou dado pessoal; e **não** se declara
conformidade com a CCT 2026/2027, com a Portaria MTP 671/2021 ou com qualquer
requisito legal. As fronteiras e princípios aqui registrados **preparam** uma
futura implementação, cuja ativação depende integralmente das decisões, gates e
homologações pendentes.
