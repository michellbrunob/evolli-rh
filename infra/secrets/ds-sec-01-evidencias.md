# Formulário de evidências — gate DS-SEC-01 (cofre da chave do MFA)

Formulário **auditável** para TI/Segurança **registrar referências** às evidências
reais que fecham o gate `DS-SEC-01` (cofre/segredos que guarda a chave de cifragem
do segredo TOTP, `MFA_TOTP_ENCRYPTION_KEY`). Complementa a especificação
operacional [README.md](README.md) (§2–§6) e o registro de aprovação em
[pacote de decisão, §8](../../docs/decisions/pacote-decisao-seguranca-operacional.md).

- Estado inicial: **tudo pendente.** Nenhum campo abaixo está preenchido; nenhum
  item está validado; **nenhum gate é marcado como concluído** por este arquivo.
- Data de criação: 2026-09-18 (T129).
- Preenchimento: **exclusivamente por TI/Segurança**, com **referências** de
  evidência — nunca o conteúdo sensível em si.

---

## 1. Finalidade e limites

- **Serve apenas** para registrar **referências** a evidências reais mantidas por
  TI/Segurança (identificador interno de decisão, número de chamado/registro,
  local do log de auditoria do cofre, ata de revisão — sempre **ponteiros**, não
  o conteúdo).
- **Nunca** armazena: segredo, valor de chave, token, URL privada, IP, captura de
  tela, exportação do cofre, credencial ou dado pessoal. Se algum desses for
  necessário como prova, ele fica **no sistema de origem** (cofre, trilha de
  auditoria, sistema de chamados) e aqui entra apenas a **referência**.
- O preenchimento **não encerra automaticamente** o `DS-SEC-01`: a aprovação
  final depende de **revisão independente** (§8) e do registro formal da decisão
  `DS-SEC-01` no [pacote de decisão, §7](../../docs/decisions/pacote-decisao-seguranca-operacional.md).
- Este documento **não** escolhe fornecedor, **não** provisiona cofre, **não**
  cria segredo, **não** habilita MFA obrigatório e **não** declara conformidade.

**Legenda de estado (usar em todo o formulário):** `pendente` · `validado` ·
`bloqueado`. O estado inicial de todos os itens é **`pendente`**.

---

## 2. Registro de decisão do cofre (`DS-SEC-01`)

Referência à decisão aprovada de **qual** cofre corporativo é usado. **Sem
fornecedor pré-preenchido** — o campo "Cofre (referência interna)" recebe apenas
um identificador interno da decisão, não um nome comercial neste formulário.

| Campo                                | Valor (a preencher por TI/Segurança) |
| ------------------------------------ | ------------------------------------ |
| Cofre (referência interna à decisão) |                                      |
| Data de aprovação                    |                                      |
| Função aprovadora                    |                                      |
| Referência de evidência              |                                      |
| Estado                               | pendente                             |

- A escolha deve satisfazer os critérios já aprovados em
  [README.md, §2.1](README.md) e nos requisitos de `DS-SEC-01`
  ([etapa0, §2.4](../../docs/decisions/etapa0-seguranca-operacional-pendente.md)).

---

## 3. Provisionamento por ambiente

- **Cada ambiente exige uma chave independente** (`MFA_TOTP_ENCRYPTION_KEY`
  própria), **sem reuso entre ambientes** (`DS-SEC-04`).
- **O valor da chave nunca consta neste formulário** — apenas a referência de
  evidência do provisionamento (ex.: identificador do segredo no cofre, número do
  registro de auditoria).

| Ambiente        | Estado   | Referência de evidência | Função executora | Função revisora | Observação segura |
| --------------- | -------- | ----------------------- | ---------------- | --------------- | ----------------- |
| Desenvolvimento | pendente |                         |                  |                 |                   |
| Homologação     | pendente |                         |                  |                 |                   |
| Piloto          | pendente |                         |                  |                 |                   |
| Produção        | pendente |                         |                  |                 |                   |

- "Observação segura" é para notas **sem conteúdo sensível** (ex.: "chave rotível
  só por incidente — ver §7"), nunca valor, trecho de chave ou credencial.
- Detalhe do procedimento seguro de inserção em [README.md, §3](README.md).

---

## 4. Controles de acesso e auditoria

Registrar **apenas referências** de evidência (local do log, ata de revisão),
nunca o conteúdo. Estado inicial de cada item: **`pendente`**.

| Controle                                                     | Estado   | Referência de evidência |
| ------------------------------------------------------------ | -------- | ----------------------- |
| Acesso mínimo por identidade nominativa (negação por padrão) | pendente |                         |
| Segregação de funções (quem provisiona ≠ quem revisa)        | pendente |                         |
| Logs de acesso/uso/alteração das chaves no cofre             | pendente |                         |
| Revisão periódica de privilégios                             | pendente |                         |

---

## 5. Validação de falha fechada

Evidenciar que o serviço **não inicia** (produção) ou **não opera** (uso) com a
chave **ausente ou inválida** — **sem** comando que revele segredo e **sem** saída
que contenha valor. Resultado registrado como **aprovado** ou **reprovado**.

| Verificação                                                    | Estado   | Referência de execução | Resultado |
| -------------------------------------------------------------- | -------- | ---------------------- | --------- |
| Boot em produção sem a chave → API não sobe                    | pendente |                        |           |
| Uso com chave ausente/inválida → operação de MFA falha fechada | pendente |                        |           |
| `selfTest` da cifra verde em boot/prontidão                    | pendente |                        |           |

- A parte de **comportamento da aplicação** já tem cobertura automatizada no
  repositório (referência técnica, não substitui a validação em ambiente):
  `apps/api/src/config/env.validation.ts` (boot em produção) e
  `apps/api/src/auth/mfa/crypto/totp-secret-cipher.spec.ts` (ausência, Base64
  inválido, tamanho incorreto, `selfTest`). Ver [README.md, §3.4–§3.5](README.md).
- **Nunca** anexar aqui a saída bruta que contenha o valor da chave; a referência
  aponta para o registro da execução, não para o segredo.

---

## 6. Break-glass (`DS-SEC-03`)

Campos **por função**, nunca por nome de pessoa. Referência de evidência sempre
**segura** (ponteiro para o registro de incidente/ata, nunca segredo).

| Requisito                                                       | Estado   | Função responsável | Referência de evidência |
| --------------------------------------------------------------- | -------- | ------------------ | ----------------------- |
| Duas contas administrativas **nominativas** com MFA configurado | pendente |                    |                         |
| Dupla autorização para acionar o break-glass                    | pendente |                    |                         |
| Registro de incidente aberto antes do uso                       | pendente |                    |                         |
| Revogação/rotação posterior do que foi exposto                  | pendente |                    |                         |
| Revisão independente após o uso                                 | pendente |                    |                         |
| Proibição de bypass permanente / desativação silenciosa de MFA  | pendente |                    |                         |

- Procedimento completo em [README.md, §5](README.md). O caminho suportado hoje
  para recuperação de acesso é o **reset administrativo de MFA** (RBAC e auditoria
  já implementados), que **não** manuseia a chave.

---

## 7. Rotação e limitações (`DS-SEC-02`)

- **Rotação regular permanece bloqueada** enquanto **não** existir suporte técnico
  a **múltiplas versões de chave** e **recifragem** de registros — hoje a cifra
  carrega uma única versão e rejeita as demais (ver [README.md, §4](README.md)).
  Este formulário **não** afirma automação de rotação inexistente.
- Registrar **apenas** a decisão de **rotação por incidente controlado** e sua
  referência de evidência.

| Item                                                                                              | Estado    | Referência de evidência |
| ------------------------------------------------------------------------------------------------- | --------- | ----------------------- |
| Política interina "rotação só em incidente controlado"                                            | pendente  |                         |
| Dependência técnica (multi-versão + recifragem) reconhecida como pré-requisito de rotação regular | bloqueado |                         |

---

## 8. Critério de fechamento

Evidências necessárias (todas em estado inicial **`pendente`**). O fechamento
**separa** três marcos distintos, que **não** são automáticos:

### 8.1 Evidência coletada

- [ ] Decisão do cofre registrada (§2).
- [ ] Provisionamento por ambiente com chave independente (§3).
- [ ] Controles de acesso e auditoria evidenciados (§4).
- [ ] Falha fechada validada sem exposição (§5).
- [ ] Break-glass validado (§6).
- [ ] Política de rotação por incidente registrada (§7).

### 8.2 Revisão independente concluída

- [ ] Revisão por **função não envolvida** no provisionamento confirma as
      evidências de §8.1 (registro/ata referenciado).

### 8.3 Decisão DS-SEC-01 atualizada

- [ ] `DS-SEC-01` registrada como **aprovada** no
      [pacote de decisão, §7](../../docs/decisions/pacote-decisao-seguranca-operacional.md)
      (esta atualização é **outra** tarefa, com revisão própria — **não** ocorre
      neste formulário).

### 8.4 Estado dos gates relacionados

- `DS-MFA-01` (rollout de MFA universal, TOTP): **já aprovada** (decisão de
  produto, T128) — ver [pacote de decisão, §8](../../docs/decisions/pacote-decisao-seguranca-operacional.md).
- `DS-SEC-01`: **pendente** até §8.1–§8.3 concluídos.
- `DS-OPS-01` e a **ativação real de MFA** (exigi-lo para piloto/produção com
  dado real): **bloqueados** enquanto o `DS-SEC-01` não for formalmente encerrado
  (e dependem ainda dos demais gates). Nenhuma mudança de código torna o MFA
  obrigatório enquanto este gate estiver aberto.

---

## 9. Referências

- [infra/secrets/README.md](README.md) — especificação operacional do
  `DS-SEC-01` (cofre, provisionamento, falha fechada, rotação, break-glass,
  checklist de aceite).
- [Pacote de decisão — segurança operacional](../../docs/decisions/pacote-decisao-seguranca-operacional.md)
  — aprovação de `DS-MFA-01` (§8) e registro de decisões (§7).
- [Decisões de segurança operacional (T004)](../../docs/decisions/etapa0-seguranca-operacional-pendente.md)
  — catálogo dos identificadores `DS-…` e requisitos de `DS-SEC-01` (§2.4).
