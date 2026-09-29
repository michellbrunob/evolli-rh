# Feature Specification: Fundação backend da Central de Solicitações de Pessoas

**Feature Branch**: `codex/t139-backend-solicitacoes-pessoas`

**Created**: 2026-09-29

**Status**: Draft

**Input**: T139 — transformar o núcleo conceitual da Central de Solicitações de Pessoas (T065/T066) em
fundação backend real, estritamente conforme `PD-SOL-01..05` aprovadas em 2026-09-29.

**Fontes vinculantes**: `.specify/memory/constitution.md` v1.4.0;
[pacote de decisão](../../docs/decisions/pacote-decisao-solicitacoes-pessoas.md) §1.1 e §7;
[decisões de documentos e solicitações](../../docs/decisions/decisoes-gestao-documentos-e-solicitacoes-v1.md);
[contrato conceitual T065](../../docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md);
ADRs 0003, 0004, 0006, 0008, 0011, 0012, 0013.

## 1. Resultado pretendido

Um módulo NestJS real, com persistência PostgreSQL/Prisma, que **registra e encaminha** solicitações
de pessoas dentro de uma empresa, sob RBAC deny-by-default, CSRF nas mutações, auditoria fail-safe e
histórico aditivo. A Central **não executa** nenhuma operação trabalhista: encaminhar não é executar.

## 2. Fora de escopo (limites invioláveis)

- Anexo, upload, download, preview, arquivo, URL de objeto, bucket, integração Cloudflare R2.
- Diagnóstico, CID, descrição clínica ou qualquer conteúdo de saúde — inclusive para `atestado`.
- Texto livre em qualquer campo persistido: todo motivo é **código de catálogo fechado**.
- Mutação automática em ponto, férias, cadastro, vínculo, benefícios, Banco de Horas, Folha,
  fechamento ou "Verificar folhas"; nenhum bloqueio automático de fechamento.
- Cronômetro/contador automático de SLA, promessa de conclusão ao colaborador, notificação, e-mail.
- Alteração de `apps/web`, do domínio `solicitacoes-documento` (T133) ou de `ajuste_ponto`.
- Declaração de conformidade legal; habilitação de dado real ou produção.

## 3. Catálogo aprovado (`PD-SOL-01`)

`contestacao_ajuste_ponto`, `ausencia`, `ferias`, `atualizacao_cadastral`, `atestado`, `beneficios`.

O tipo conceitual `documento` do contrato T065 §2 **sai** deste catálogo: solicitação de documento
permanece no fluxo real e separado de `solicitacoes-documento` (T133).

## 4. Atores e autoridade (`PD-SOL-01`)

| Ator             | Autoridade nesta fundação                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------- |
| RH               | Registra, analisa, transiciona e decide. Único papel com mutação e leitura na Central.    |
| Gestor           | Consultivo por decisão; **sem** capacidade de RBAC nesta fundação — negado por padrão.    |
| Diretoria        | Escalonamento excepcional fora do sistema; **nenhum** papel ou endpoint próprio é criado. |
| DP               | Não recebe operação nesta Central (decisão não o contempla) — negado por padrão.          |
| Colaborador      | Sujeito da solicitação; **não** opera (ver §4.1).                                         |
| `master_tecnico` | Sem mutação trabalhista (ADR 0012 dec. 3; contrato T065 §5).                              |

### 4.1 Limite estrutural: não existe ESS autenticado

O schema registra explicitamente que o vínculo `AccessUser ↔ Colaborador` é **deliberadamente não
materializado** (`DP-23`, `apps/api/prisma/schema.prisma`). Sem esse vínculo não há como um
colaborador autenticado provar que uma solicitação é sua.

**Consequência aceita, não simulada:** nesta fundação o RH registra a solicitação **em nome do**
colaborador (identificando o vínculo), exatamente como já ocorre em `solicitacoes-documento` (T133).
As ações de origem do colaborador (`enviar`, `cancelar`) são **registradas pelo RH**, e a auditoria
grava o RH como ator real. A regra de fase aprovada continua valendo integralmente: cancelamento só
antes de `em_revisao_rh`. Autoatendimento do colaborador (ESS) depende de `DP-23` e fica fora da T139.

## 5. Estados e transições reconciliados (`PD-SOL-03`)

Estados (nenhum novo é criado): `rascunho`, `enviada`, `em_revisao_rh`, `aguardando_informacao`,
`encaminhada_para_operacao_rh`, `recusada`, `cancelada`.

"Encerrada" é **termo funcional** que corresponde ao estado terminal `encaminhada_para_operacao_rh`.
Nenhum estado literal `encerrada` existe.

| De                             | Ação                       | Para                           | Regra aprovada                             |
| ------------------------------ | -------------------------- | ------------------------------ | ------------------------------------------ |
| `rascunho`                     | `enviar`                   | `enviada`                      | Intenção do colaborador registrada pelo RH |
| `rascunho`                     | `cancelar`                 | `cancelada`                    | Antes de `em_revisao_rh`                   |
| `enviada`                      | `iniciar_revisao`          | `em_revisao_rh`                | RH                                         |
| `enviada`                      | `cancelar`                 | `cancelada`                    | Antes de `em_revisao_rh`                   |
| `em_revisao_rh`                | `aguardar_informacao`      | `aguardando_informacao`        | RH                                         |
| `em_revisao_rh`                | `encaminhar_para_operacao` | `encaminhada_para_operacao_rh` | RH; handoff, sem mutação                   |
| `em_revisao_rh`                | `recusar`                  | `recusada`                     | RH; motivo codificado                      |
| `aguardando_informacao`        | `retomar_revisao`          | `em_revisao_rh`                | RH                                         |
| `encaminhada_para_operacao_rh` | `reabrir`                  | `em_revisao_rh`                | RH; justificativa codificada auditada      |
| `recusada`                     | `reabrir`                  | `em_revisao_rh`                | RH; justificativa codificada auditada      |
| `cancelada`                    | —                          | —                              | Terminal absoluto; exige nova solicitação  |

**Removido do desenho conceitual anterior:** `aguardando_informacao → cancelada`. Esse estado só é
alcançável **depois** de `em_revisao_rh`, portanto cancelar a partir dele violaria `PD-SOL-03`.

**Derivação registrada:** a decisão aprova _que_ o RH reabre `encaminhada_para_operacao_rh` e
`recusada`, mas não nomeia o estado de destino. O destino adotado é `em_revisao_rh` — único estado
não terminal cujo responsável é o RH. Qualquer outro destino exigiria decisão nova.

## 6. Campos mínimos persistidos (`PD-SOL-05`, contrato T065 §3)

`id`, `empresaId`, `vinculoId`, `tipo`, `periodoReferencia` (opcional, `AAAA-MM-DD`, só quando o tipo
o referencia), `motivo` (codificado), `situacao`, ator registrador, datas técnicas.

Nenhum campo adicional por tipo é criado: a decisão aprovou "campos mínimos por tipo", e a única
variação por tipo já especificada é a aplicabilidade de `periodoReferencia`. `atestado` usa
exatamente a mesma estrutura — sem nenhum campo clínico.

O **mecanismo** de motivo codificado é o já aprovado e em uso (`MotivoMovimentacao`,
`MotivoAjustePonto`): catálogo fechado em enum, com escape `outro_controlado`, nunca texto livre. O
**conteúdo** da lista é detalhe de implementação extensível de forma aditiva, a validar com RH — a
mesma ressalva que o repositório já registra nos dois enums existentes.

## 7. Acompanhamento sem SLA automático (`PD-SOL-04`)

O objetivo aprovado é **primeiro retorno do RH em dois dias úteis**, não conclusão. A V1 registra
datas e eventos que permitem acompanhamento futuro (`criadoEm`, `enviadaEm`, `primeiraRevisaoEm`) e
**não** implementa contador, vencimento, job, alerta ou promessa exibida.

## 8. Histórico auditável

Cada criação e cada transição gravam, na **mesma transação**: a mudança de estado, um evento de
histórico de domínio append-only e o evento formal de auditoria (`AuditService.record`). Falha da
auditoria obrigatória **impede** a mutação. Nenhum evento é editado ou apagado; correção futura é
sempre evento adicional.

## 9. Cenários de aceite

1. **Dado** RH autenticado na empresa A, **quando** registra solicitação para vínculo da empresa A,
   **então** ela nasce em `rascunho`, com auditoria `pessoas.solicitacao.criada` sem dado pessoal.
2. **Dado** solicitação em `em_revisao_rh`, **quando** se tenta cancelar, **então** a transição é
   recusada pelo servidor e o estado permanece inalterado.
3. **Dado** solicitação `cancelada`, **quando** o RH tenta reabrir, **então** é recusada: cancelada
   exige nova solicitação.
4. **Dado** solicitação `recusada`, **quando** o RH reabre com motivo codificado, **então** ela volta
   a `em_revisao_rh` e o histórico preserva todos os eventos anteriores.
5. **Dado** usuário da empresa B, **quando** consulta solicitação da empresa A por id, **então**
   recebe 404 indistinguível de inexistente.
6. **Dado** papel `gestor`, `dp` ou `colaborador`, **quando** tenta qualquer operação, **então** é
   negado por padrão e a negação é auditada conforme o padrão existente.
7. **Dado** mutação sem token CSRF válido, **quando** é enviada, **então** é rejeitada antes do caso
   de uso.

## 10. Critérios mensuráveis

- 100% das transições válidas e inválidas cobertas por teste unitário da máquina de estados.
- 100% dos endpoints com teste E2E de sucesso, negação por papel e isolamento entre empresas (404).
- Zero campo de anexo, arquivo, conteúdo, diagnóstico, CID ou texto livre no schema e nos DTOs.
- Zero efeito colateral em outros módulos: nenhuma escrita fora das tabelas da Central e de
  `audit_event`.

## 11. Limites preservados e decisões ainda abertas

- ESS do colaborador depende de `DP-23` (vínculo `AccessUser ↔ Colaborador`).
- Conteúdo definitivo do catálogo de motivos por tipo depende de validação com RH.
- Anexos/evidência binária dependem dos portões de conteúdo e da ADR 0013 (R2 não habilita upload).
- Notificação, elegibilidade detalhada por tipo, retenção/descarte (`DP-3J-11`) e integrações
  operacionais permanecem fora, conforme contrato T065 §8.
- Esta fundação **não** autoriza dado real, piloto, produção, ESS ou MSS.
