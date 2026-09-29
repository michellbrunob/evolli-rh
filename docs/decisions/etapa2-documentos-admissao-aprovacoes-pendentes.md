# Etapa 2 — Documentos e Admissão Digital: aprovações pendentes

- Status: **Nível 1 resolvido em 2026-08-14; Nível 2 parcialmente resolvido
  em 2026-09-29.** Este
  documento registra aprovações e bloqueios remanescentes; não declara
  conformidade LGPD nem habilita upload.
- Data: 2026-08-14
- Relacionado:
  [ADR 0011 (Aceito)](../adr/0011-documentos-privados-e-admissao-digital.md),
  [especificação estrutural Etapa 2](../modules/etapa2-documentos-admissao-digital-estrutural.md)
  (esquema `DP-2E-nn` em seu §14.1),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0013](../adr/0013-armazenamento-privado-cloudflare-r2.md).
- Constituição v1.3.0: Princípio I (rastreabilidade e aprovação por dono de
  negócio), Princípio II (privacidade/menor privilégio), "Mandatory
  Architecture and Data Constraints" (inventário de tratamento por módulo
  antes de dado real).
- PRD: `Sistema RH - Reserva Fiscal - PRD` (Notion `dceacf66-ba47-834d-b3fc-014cc2835594`).

## Propósito

A [ADR 0011](../adr/0011-documentos-privados-e-admissao-digital.md) fixou a
arquitetura de segurança do módulo de documentos. Os itens de **Nível 1**
foram resolvidos em 2026-08-14 (ver "Registro de resolução de Nível 1"
abaixo) e a ADR foi promovida a **Aceito**, autorizando a tarefa **T008**
apenas para **metadados**, sem conteúdo. Os itens de **Nível 2** — que
dependem de decisões de produto, RH, DPO/Jurídico, Segurança e TI —
permanecem pendentes e seguem bloqueando upload e conteúdo real. Este
documento consolida ambos em um único lugar, com responsável e impacto de
bloqueio, para que a obtenção das aprovações seja um processo verificável e
não uma decisão difusa.

A numeração `DP-2E-nn` é a da especificação estrutural (§14.1); é
**reutilizada, não renumerada**, para preservar rastreabilidade. Nenhuma
pendência nova é criada aqui.

## Dois níveis de bloqueio

A especificação estrutural (§13) separa dois conjuntos de portões, e
confundi-los faria parecer que implementar metadado já autoriza upload:

- **Nível 1 — habilitar a fase Implementar da V1 Estrutural** (metadado, sem
  conteúdo). Também é o conjunto cuja satisfação **promove a ADR 0011 de
  Proposta para Aceito**.
- **Nível 2 — habilitar upload de documento real** (conteúdo). Exige **todos**
  os itens do Nível 1 **mais** os do Nível 2.

**Upload permanece desabilitado enquanto qualquer item de Nível 2 estiver
aberto** — e por construção, não por configuração (ADR 0011, decisão 2).

## Registro de resolução de Nível 1 - 2026-08-14

As linhas Nível 1 abaixo são histórico do gate. Foram resolvidas pela
autoridade de Produto, RH, DPO/Jurídico, Segurança e Arquitetura confirmada
na decisão do projeto e registradas na ADR 0011, agora **Aceito**.

| ID                  | Resultado aprovado                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| DP-2E-01            | `DocumentoMetadado`, `SolicitacaoDocumento` e `TipoDocumento`, sem conteúdo/versão/upload/storage.        |
| DP-2E-02            | Tipos iniciam restritos; catálogo por RH autorizado com aprovação do DPO.                                 |
| DP-2E-07            | Sujeito `Colaborador` com `empresa_id` próprio.                                                           |
| DP-2E-08            | Upload desabilitado é estado sem saída.                                                                   |
| DP-2E-12            | Sem rótulo do tipo na auditoria.                                                                          |
| DP-2E-13 (metadado) | RH/DP autorizado no escopo consulta, solicita e substitui; gestor, colaborador e `admin_tecnico` negados. |
| DPO/Jurídico        | Finalidade administrativa e obrigações aplicáveis; metadado tratado como dado pessoal por inferência.     |
| Segurança           | C1-C7 e C15-C18, e decisões 1-10 da ADR 0011, aprovados.                                                  |

**Efeito:** T008 fica autorizada somente para metadados. O Nível 2 e MFA
continuam bloqueando conteúdo e upload real.

### Emenda 1 - catálogo materializado (2026-08-14)

`TipoDocumento` foi aprovado como terceira entidade da V1 de metadados para
permitir catálogo executável e auditável. Toda entrada inicia restrita e só RH
autorizado, com aprovação do DPO, pode criar ou alterar o catálogo.

### Emenda 2 - armazenamento privado aprovado (2026-09-29)

O item `DP-2E-03` foi aprovado com o **Cloudflare R2** como provedor de
armazenamento privado e o desenho técnico registrado na
[ADR 0013](../adr/0013-armazenamento-privado-cloudflare-r2.md): metadados no
PostgreSQL, conteúdo binário em buckets privados separados por ambiente,
credenciais somente no servidor e acesso temporário após autorização da API.

Esta aprovação resolve apenas a escolha do provedor e a forma arquitetural de
armazenamento. Ela **não habilita upload ou conteúdo real**: gestão de
credenciais, limites técnicos, antivírus/quarentena, acesso ao conteúdo,
retenção e descarte continuam pendentes no Nível 2.

## Decisões pendentes por nível e responsável

Legenda de impacto: **N1** bloqueia a promoção da ADR e a fase Implementar da
V1 Estrutural; **N2** bloqueia habilitar upload de conteúdo real; **—** não
bloqueia.

### Nível 1 — necessárias para promover a ADR 0011 e implementar metadado

| ID                       | Decisão pendente                                                                                                                 | Responsável             | Impacto |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- |
| DP-2E-01                 | **Se** e **o que** materializar em banco na V1 Estrutural — inclusive a opção de não materializar nada até o Nível 2             | Produto + Arquitetura   | N1      |
| DP-2E-02                 | Catálogo documental e sua **classificação de sensibilidade** — nomear tipos é decidir o que o sistema revela por inferência (O3) | Produto **+ DPO**       | N1      |
| DP-2E-07                 | Forma do **sujeito** do documento: vínculo, colaborador (com `empresa_id` próprio) ou empresa                                    | Produto + Arquitetura   | N1      |
| DP-2E-08                 | Confirmar `upload_desabilitado` como **estado sem transição de saída**, não _feature flag_                                       | Segurança + Arquitetura | N1      |
| DP-2E-12                 | Se o **rótulo do tipo documental** pode aparecer na trilha de auditoria                                                          | DPO + Segurança         | N1      |
| DP-2E-13 (metadado)      | **Matriz de acesso a metadado**: quem visualiza, quem solicita, quem substitui                                                   | Produto + Segurança     | N1 e N2 |
| — (confirmação DPO)      | Confirmação formal de **finalidade e base legal** do tratamento de **metadado**, incluindo o risco de inferência (§10.2 da spec) | DPO/Jurídico            | N1      |
| — (revisão de segurança) | Revisão de segurança do modelo confirmando os controles C1–C7 e C15–C18 da spec (decisões 1–10 da ADR 0011)                      | Segurança               | N1      |

### Nível 2 — necessárias, além do Nível 1, para habilitar upload real

| ID                  | Decisão pendente                                                                                                | Responsável          | Impacto |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- | ------- |
| DP-2E-04            | Gestão da **credencial de armazenamento**, sem ampliar privilégio de banco (ADR 0002)                           | TI/Infra + Segurança | N2      |
| DP-2E-05            | **Limites técnicos**: tamanho máximo, formatos aceitos, metadados técnicos coletados                            | Produto + Segurança  | N2      |
| DP-2E-06            | **Prazos** de validade/expiração de documento e de solicitação                                                  | Produto + RH         | N2      |
| DP-2E-09            | Ferramenta de **antivírus/quarentena** e política para conteúdo reprovado                                       | TI/Infra + Segurança | N2      |
| DP-2E-10            | Se documento vira **pré-condição de efetivar admissão** (mudaria regra da Fatia 2)                              | Produto + RH         | N2      |
| DP-2E-11            | **Documentos obrigatórios por tipo de vínculo**                                                                 | RH + Jurídico        | N2      |
| DP-2E-13 (conteúdo) | **Acesso a conteúdo**: quem baixa — decisão distinta da de metadado                                             | Produto + Segurança  | N2      |
| DP-2E-14            | Acesso do **titular** aos próprios documentos; depende do Portal do Colaborador, que não existe                 | Produto + DPO        | N2      |
| DP-2E-15            | **Retenção, anonimização e descarte**, alcançando o **conteúdo** no armazenamento, não só o metadado (RI-2E-05) | DPO + Jurídico       | N2      |
| MFA                 | MFA implementado e **obrigatório** — vinculante desde a ADR 0003, d. 3; agravado por este módulo                | Segurança + Produto  | N2      |

### Não bloqueantes

| ID       | Decisão                                               | Responsável        | Impacto            |
| -------- | ----------------------------------------------------- | ------------------ | ------------------ |
| DP-2E-16 | Prefixo de módulo para diretório, recursos e eventos  | Produto            | —                  |
| DP-2E-17 | Assinatura eletrônica: se, quando e com qual provedor | Produto + Jurídico | — (fora de escopo) |

## Pendências herdadas, referenciadas sem alteração

Registradas em outras fatias e apenas apontadas aqui, sem renumeração:

- **DP-24** (Fatia 2) — slot `AnexoMovimentacao`. Esta Etapa é a destinatária
  (spec O1); a associação segue inútil enquanto o upload estiver desabilitado.
- **DP-15** (Fatia 2) — retenção, gate antes de piloto com dado real.
- **DP-7 / DP-8** (Fatia 1) — escopo de `auditor`/`dpo` e `gestor`, ainda
  pendentes; condicionam a matriz de acesso deste módulo.
- **DP-20** — papel `diretoria` não existe no enum `AccessRole`.
- **DP-23** — vínculo `AccessUser` ↔ Colaborador, pré-requisito de DP-2E-14.

## Riscos registrados (da spec §14.2), não resolvidos

- **RI-2E-01** — metadado tratado como inócuo (o risco mais provável e
  contraintuitivo). Mitigado no desenho por DP-2E-02/DP-2E-12 exigirem DPO
  antes do Nível 1 e pela ADR 0011 tratar metadado como dado pessoal.
- **RI-2E-05** — descarte que apaga metadado e deixa o objeto de conteúdo
  órfão perde rastreabilidade **sem** eliminar o dado. DP-2E-15 precisa cobrir
  os dois lados. **Aberto.**
- **RI-2E-08** — MFA ainda pendente, agora com o dado de maior impacto do
  ecossistema.

## Recomendação objetiva: qual aprovação obter antes da T008

A T008 (implementar publicação e acesso a documentos) **não pode iniciar**
sem, no mínimo, os itens de **Nível 1** aprovados e a **ADR 0011 promovida a
Aceito**. Ordem de obtenção recomendada, do gargalo mais a montante para o
mais a jusante:

1. **DPO — finalidade e base legal do tratamento de metadado, incluindo o
   risco de inferência (O3), e DP-2E-12 (rótulo do tipo na trilha).** É o
   gargalo real: sem a leitura do DPO de que "só metadado" ainda é dado
   pessoal, nada abaixo pode ser decidido com segurança.
2. **Produto + DPO — DP-2E-02 (catálogo documental e classificação de
   sensibilidade).** Depende de (1); é o que dá corpo a tudo que vem depois.
3. **Produto + Arquitetura — DP-2E-01 (se/o que materializar) e DP-2E-07
   (forma do sujeito).** Definem o que T008 sequer teria para implementar.
4. **Produto + Segurança — DP-2E-13 (matriz de acesso a metadado) e DP-2E-08
   (confirmar estado sem transição).**
5. **Segurança — revisão do modelo (decisões 1–10 da ADR 0011)** e, ao final,
   **promoção da ADR 0011 a Aceito.**

Somente após esses cinco passos a fase Implementar da V1 Estrutural (metadado,
sem conteúdo) fica autorizada. **Habilitar upload real permanece bloqueado**
por todo o Nível 2, incluindo MFA (ADR 0003) e retenção que alcance o
conteúdo (DP-2E-15) — nenhum deles é pré-requisito de T008 sobre metadado,
mas todos são pré-requisito de qualquer upload.

## Declaração

Este documento registra duas aprovações específicas: a materialização do
catálogo (Emenda 1) e o armazenamento privado no Cloudflare R2 (Emenda 2).
Ele **não infere prazo, base legal, categoria documental ou matriz de acesso,
e não declara conformidade LGPD.** Os demais itens de Nível 2 continuam
pendentes e o upload permanece desabilitado até que todos sejam formalmente
resolvidos.
