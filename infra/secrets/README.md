# Gate operacional DS-SEC-01 — cofre, rotação e break-glass para o MFA

Especificação **operacional e auditável** para fechar o gate `DS-SEC-01`
(cofre/mecanismo de segredos) no que ele governa hoje: a chave de cifragem do
segredo TOTP do MFA (`MFA_TOTP_ENCRYPTION_KEY`). Cobre também as partes
correlatas `DS-SEC-02` (rotação) e `DS-SEC-03` (acesso emergencial/break-glass)
na medida em que tocam essa chave.

- Status: **preparação operacional** — este documento descreve _como_ operar o
  controle de forma verificável. Ele **não** habilita MFA obrigatório, **não**
  escolhe fornecedor, **não** insere segredo, **não** altera ambiente remoto,
  **não** cria credencial e **não** declara que um cofre existe. Enquanto o
  registro de decisão (`DS-SEC-01`, `DS-SEC-02`, `DS-SEC-03`, `DS-OPS-01`)
  estiver **Pendente**, nada aqui está aprovado ou executado.
- Data: 2026-09-18
- Fase/tarefa: Fase 0 — gates transversais; **T004** (parte de segredos),
  operacionalizada após o núcleo (T125) e a interface (T126) de MFA.
- Âncoras (não reabertas por este documento):
  - [ADR 0002](../../docs/adr/0002-papeis-postgres-e-migrations.md) — menor
    privilégio, credencial fora do Git, segregação de papéis.
  - [ADR 0003, decisões 3 e 7](../../docs/adr/0003-identidade-sessao-e-autorizacao.md)
    — TOTP (RFC 6238) como tecnologia; MFA obrigatório antes de dado real;
    segredo TOTP cifrado (AES-256-GCM) com a chave fora do banco.
  - [ADR 0004](../../docs/adr/0004-auditoria-formal-e-integridade.md) — trilha
    append-only, sem segredo em claro.
  - [ADR 0012](../../docs/adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
    — `master_tecnico` como único acesso global; privacidade sob RH + Jurídico;
    `dpo`/`auditor` depreciados.
  - Registro de decisões:
    [segurança operacional (T004)](../../docs/decisions/etapa0-seguranca-operacional-pendente.md)
    e [pacote de decisão](../../docs/decisions/pacote-decisao-seguranca-operacional.md)
    (identificadores `DS-…` **reusados**, nunca recriados).
  - Runbook irmão:
    [backup e restauração](../postgres/runbook-backup-restore.md);
    provisionamento de banco em [infra/postgres](../postgres/README.md).
- Constituição: v1.3.0 — Princípio II (segurança/menor privilégio; MFA
  obrigatório antes de dado real); Princípio V (auditoria append-only,
  segregação de funções); "Mandatory Architecture and Data Constraints"
  (segredos em configuração de ambiente ou cofre aprovado; nada de credencial
  no repositório; sem exposição externa/produção antes dos gates).

---

## 1. Escopo e princípio

### 1.1 Fronteira de dado real (não negociável)

- **MFA obrigatório é pré-condição de dado real.** Nenhum piloto com dado real
  de RH, nenhuma exposição externa e nenhuma produção ocorre antes de o gate
  `DS-OPS-01` estar fechado (ADR 0003 decisão 3; Constituição II). Este
  documento **não** fecha esse gate — ele prepara um dos controles (`DS-SEC-01`)
  de que o gate depende.
- Exigir MFA para dado real permanece **decisão de produto** (`DS-MFA-01`), a
  ser tomada depois deste gate, não aqui (ver §7).

### 1.2 Segredo da chave (invariável)

A chave de cifragem do segredo TOTP **nunca** entra em: banco de dados, código,
log, saída de CI, PR, ticket, arquivo de exemplo, captura de tela ou qualquer
documento — inclusive este. Só o **nome** da variável aparece em texto. Esta
regra reafirma controles já vigentes no código:

- `apps/api/src/config/env.validation.ts` valida a presença/formato citando
  **apenas o nome** da variável nas mensagens de erro, nunca o valor.
- `apps/api/src/auth/mfa/crypto/totp-secret-cipher.ts` resolve a chave só a
  partir do ambiente e nunca a registra em log; o segredo TOTP em si é cifrado
  em repouso (AES-256-GCM).
- `apps/api/.env.example` traz **apenas o nome** `MFA_TOTP_ENCRYPTION_KEY=`, sem
  valor; `.env` está fora do versionamento.

### 1.3 Separação de ambientes

Quatro ambientes tratados como **isolados**, cada um com sua própria chave,
gerada e guardada de forma independente:

| Ambiente            | Chave exigida?             | Origem da chave                                     |
| ------------------- | -------------------------- | --------------------------------------------------- |
| **local**           | Opcional (MFA só se usado) | Gerada pelo dev na sua máquina; nunca compartilhada |
| **desenvolvimento** | Opcional                   | Segredo do ambiente, distinto de todos os demais    |
| **homologação**     | Recomendada para ensaiar   | Segredo do ambiente, distinto de produção           |
| **produção**        | **Obrigatória no boot**    | Cofre/plataforma aprovado (`DS-SEC-01`)             |

- **Nunca** reusar a chave de produção fora de produção, nem a de um ambiente em
  outro (`DS-SEC-04`).
- Comportamento por ambiente já implementado: em produção a API **não sobe** sem
  a chave (`env.validation.ts`); em dev/test o `TotpSecretCipher` **falha de
  modo seguro** no primeiro uso se a chave estiver ausente/inválida, sem liberar
  acesso sem fator.

---

## 2. Requisito do cofre

### 2.1 Critérios mínimos (checklist de aceite do mecanismo)

A solução escolhida — cofre dedicado **ou** configuração de ambiente protegida —
deve satisfazer **todos** os itens abaixo (idênticos aos de `DS-SEC-01`, §2.4 do
registro de decisões). São critérios de aceite, marcáveis como
pendente/validado/bloqueado:

- [ ] **Cifrado em repouso** — o segredo nunca é guardado em claro.
- [ ] **Controle de acesso por identidade com menor privilégio** e negação por
      padrão — só quem precisa lê; ninguém lê por padrão.
- [ ] **Trilha de auditoria** de leitura, escrita e rotação de cada segredo.
- [ ] **Rotação** e **revogação** suportadas (base de §4 e §5).
- [ ] **Recuperação controlada** do próprio segredo (não do valor exposto:
      recuperar disponibilidade, não vazar conteúdo).
- [ ] **Segregação por ambiente** — segredo de produção inacessível fora de
      produção.
- [ ] **Nunca** expõe o valor bruto em log, UI, mensagem de erro ou trilha.
- [ ] **Integração via configuração de ambiente protegida**, sem valor no
      repositório (coerente com ADR 0002).

### 2.2 Decisão pendente de provedor

- O **provedor/cofre não é escolhido aqui.** A escolha é `DS-SEC-01` e exige
  aprovação explícita de **TI/Segurança** com evidência dos critérios de §2.1.
- Até a escolha, produção **não** é liberada para dado real: a chave existe
  como **contrato** (`MFA_TOTP_ENCRYPTION_KEY`), mas a origem segura dela é
  justamente o que este gate precisa fechar.
- Registrar a decisão no
  [pacote de decisão](../../docs/decisions/pacote-decisao-seguranca-operacional.md)
  (§2.1, `DS-SEC-01`), não neste arquivo.

### 2.3 Formato exigido pela aplicação

- Variável: `MFA_TOTP_ENCRYPTION_KEY`.
- Valor: **Base64** que decodifica para **exatamente 32 bytes (256 bits)** —
  chave AES-256. Presença/formato são validados em
  `loadTotpEncryptionKey` (`totp-secret-cipher.ts`); tamanho diferente de 32
  bytes é rejeitado.
- **Nenhum valor de exemplo** é registrado aqui — nem sintético, nem
  "placeholder que pareça real". A geração é responsabilidade do cofre/plataforma
  (§3), gerando material aleatório de 32 bytes por ambiente.

---

## 3. Procedimento seguro de provisionamento

Objetivo: colocar uma chave válida em cada ambiente **sem** que o valor
transite por canal inseguro, apareça em log ou seja conhecido além do
estritamente necessário.

### 3.1 Pré-requisitos

- `DS-SEC-01` com provedor **aprovado** (§2.2) para homologação/produção.
- Acesso ao cofre por **identidade nominativa com menor privilégio** (nunca
  conta compartilhada).
- Dupla checagem definida: **duas funções distintas** participam do
  provisionamento de produção (quem provisiona ≠ quem confere), por
  **área/função**, nunca por nome neste documento.

### 3.2 Responsáveis (por função)

| Passo                        | Executa      | Confere (2ª pessoa) |
| ---------------------------- | ------------ | ------------------- |
| Gerar a chave (32 bytes)     | TI/Segurança | —                   |
| Inserir no cofre do ambiente | TI/Segurança | TI/Segurança        |
| Validar presença/formato     | TI/Segurança | TI/Segurança        |
| Provar fail-closed em teste  | TI/Segurança | TI/Segurança        |

### 3.3 Inserção sem exposição

- A chave é **gerada diretamente no cofre/plataforma** ou por ferramenta que a
  **injeta direto** no cofre pelo canal seguro do próprio provedor — sem passar
  por terminal compartilhado, histórico de shell, área de transferência
  persistente ou arquivo intermediário.
- Se a geração local for inevitável, ela deve produzir 32 bytes aleatórios e
  entregá-los **diretamente** ao canal seguro do cofre, **sem ecoar** o valor em
  tela e **sem** gravá-lo em arquivo. Este documento **não** fornece comando que
  imprima um segredo.
- A aplicação recebe a chave **apenas** como variável de ambiente
  `MFA_TOTP_ENCRYPTION_KEY`, injetada pelo cofre/plataforma no processo — nunca
  lida de arquivo versionado.

### 3.4 Validar presença e formato sem revelar o valor

Os comandos abaixo imprimem **somente** um veredito e o comprimento em bytes
(32) — **nunca** o valor. Rodar no ambiente-alvo, onde a variável já está
injetada:

```bash
# Presença (imprime apenas "definida" / "ausente", nunca o conteúdo)
test -n "${MFA_TOTP_ENCRYPTION_KEY:-}" && echo "definida" || echo "ausente"
```

```bash
# Formato: decodifica Base64 e imprime só a contagem de bytes (esperado: 32).
# A contagem não é o segredo; o valor nunca é impresso.
node -e 'const b=Buffer.from(process.env.MFA_TOTP_ENCRYPTION_KEY||"","base64"); console.log("bytes="+b.length+" "+(b.length===32?"OK":"FALHA"))'
```

- Critério de aceite: presença = `definida` e formato = `bytes=32 OK`.
- A própria aplicação faz uma prova de disponibilidade sem expor nada via
  `TotpSecretCipher.selfTest()` (cifra/decifra um valor sintético não secreto e
  confirma o round-trip) — usada em boot/prontidão.

### 3.5 Demonstrar fail-closed (chave ausente/ inválida)

Provar, **em ambiente descartável, sem dado real**, que o sistema falha fechado:

- **Produção-símile (boot):** sem `MFA_TOTP_ENCRYPTION_KEY` e com
  `NODE_ENV=production`, a API **não sobe** — `validateEnv` lança citando só o
  nome da variável (`env.validation.ts`). Evidência: log de boot com a recusa,
  sem qualquer valor.
- **Uso (dev/test):** com a chave ausente ou inválida, a operação de MFA
  **falha de modo seguro** no primeiro uso do `TotpSecretCipher` (carga
  preguiçosa; lança em `loadTotpEncryptionKey`), nunca liberando acesso sem
  fator.
- Cobertura automatizada já existente: `totp-secret-cipher.spec.ts`
  (fail-closed: ausência, Base64 inválido, tamanho incorreto; `selfTest`).

### 3.6 Proibições de manuseio

**Proibido** compartilhar ou transportar a chave por: e-mail, chat, planilha,
documento, `.env` commitado, captura de tela, ticket ou PR. O único caminho
aceito é o **cofre/plataforma → variável de ambiente do processo**.

---

## 4. Rotação de chave (`DS-SEC-02`)

### 4.1 Estado atual (declaração honesta)

- **A rotação de massa ainda NÃO está implementada.** O envelope de cifra
  guarda um `keyVersion` por registro (`CipherEnvelope`), o que **prepara** a
  rotação futura sem downtime; porém, hoje:
  - a versão corrente de escrita é fixa (`MFA_TOTP_KEY_CURRENT_VERSION`);
  - o `TotpSecretCipher` carrega **uma única** chave e o `decrypt` **rejeita**
    qualquer `keyVersion` diferente da corrente.
- Logo, **não há** rotação automatizada, nem capacidade de ler segredos cifrados
  com uma versão antiga enquanto grava na nova. Declarar rotação automatizada
  agora seria falso.

### 4.2 Dependência técnica a validar antes de qualquer rotação de massa

Antes de rotacionar a chave em um ambiente com registros já cifrados, é
**obrigatório** existir e ser validada a capacidade de:

- manter **mais de uma versão de chave** ativa simultaneamente (decifrar com a
  versão do registro, cifrar com a corrente);
- **rerecifrar** todos os registros para a nova versão de forma idempotente,
  retomável e **sem indisponibilidade nem perda** — provada em ambiente de
  teste antes de tocar produção.

Enquanto essa capacidade não existir (requer código novo, com ADR/aceite
próprios), a rotação em ambiente com dados cifrados fica **bloqueada**. Como
ainda não há dado real (gate `DS-OPS-01` aberto), essa limitação **não** bloqueia
o gate DS-SEC-01, mas **precisa** estar resolvida antes de qualquer rotação de
massa em produção.

### 4.3 Gatilhos de rotação

- Suspeita ou confirmação de comprometimento da chave (rotação **imediata**).
- Saída de pessoa com acesso ao cofre daquele ambiente.
- Periodicidade regular — **valor a decidir** por TI/Segurança (`DS-SEC-02`),
  não fixado aqui.

### 4.4 Sequência segura (quando a capacidade de §4.2 existir)

1. Gerar a nova chave no cofre (§3), como nova versão.
2. Publicar a nova versão como corrente de **escrita**, mantendo a anterior
   disponível só para **leitura/decifra**.
3. Rerecifrar os registros para a nova versão (job idempotente e retomável).
4. Confirmar que nenhum registro permanece na versão antiga.
5. **Revogar** a chave antiga no cofre.
6. Registrar evidência (sem valores) na trilha e no ticket de rotação.

### 4.5 Rollback

- **Somente por forward-fix**, coerente com o padrão do repositório (migrations
  e correções não são revertidas destrutivamente): se a rotação falhar no meio,
  a chave antiga **permanece** válida para leitura até a rerecifragem concluir;
  nunca se apaga a versão antiga antes de zerar os registros que dependem dela.

---

## 5. Runbook break-glass (`DS-SEC-03`)

### 5.1 Objetivo estrito

Recuperar **acesso administrativo** durante um **incidente** — por exemplo,
quando administradores perderam o segundo fator e ninguém consegue executar
operações críticas. **Não** é procedimento cotidiano, **não** é bypass de MFA e
**não** desativa MFA de forma silenciosa ou permanente.

### 5.2 Pré-condição antes de exigir MFA obrigatório

- Pelo menos **duas contas administrativas nominativas** (nunca genéricas ou
  compartilhadas), **cada uma com MFA já configurado**, antes de tornar o MFA
  obrigatório. Isso evita que a perda de um único fator tranque toda a
  administração. Alinhado à Emenda 1 da ADR 0005 e ao runbook do primeiro
  `master_tecnico` (`CG-PROV-01`).

### 5.3 Critérios de acionamento e autorização

- **Acionamento:** incidente confirmado de perda de acesso administrativo que
  não se resolve pelos meios normais (§5.4).
- **Autorização em dupla:** duas funções distintas de TI/Segurança aprovam o
  acionamento; nunca uma pessoa só.
- **Registro de incidente** aberto antes do uso, com hora, motivo e aprovadores
  (por função).
- **Uso limitado:** menor escopo e menor janela possíveis para restabelecer o
  acesso; encerrar assim que o acesso normal for restaurado.

### 5.4 Procedimento suportado hoje: reset administrativo de MFA

O caminho **já implementado** para recuperação de acesso administrativo é o
reset de MFA de uma conta (T125/T126), preferível a qualquer manuseio de
segredo:

- Endpoint: `POST /v1/users/:id/mfa/reset`.
- **RBAC (autoridade no backend):** capacidade `mfa/reset` — só
  `master_tecnico` (global) e `rh` (própria empresa); `dp` e demais são negados
  (403 no escopo; 404 anti-enumeração para alvo de outra empresa).
- Efeito: remove o fator, invalida challenges, apaga os códigos de recuperação e
  **revoga todas as sessões** da conta, obrigando novo cadastro. **Nunca** lê,
  gera, exibe ou substitui o segredo TOTP.
- Auditoria: a operação é auditável (ADR 0004), sem segredo em claro.

Ou seja, restaurar acesso de um administrador que perdeu o fator **não** exige
tocar `MFA_TOTP_ENCRYPTION_KEY`: outro administrador autorizado executa o reset,
e a pessoa recadastra o MFA.

### 5.5 Depois do uso

- **Revogação/rotação posterior** do que foi exposto durante o incidente
  (sessões, e — se a chave tiver sido manuseada — rotação por §4).
- **Revisão independente** do incidente por função não envolvida no acionamento.
- Fechamento do registro de incidente com evidência (sem valores sensíveis).

### 5.6 Proibições

- **Proibido:** segredo compartilhado entre pessoas, bypass permanente do MFA,
  desativação silenciosa do MFA, reuso de códigos de recuperação (são de uso
  único, por desenho) e qualquer acesso emergencial sem registro e autorização
  em dupla.

---

## 6. Checklist de aceite DS-SEC-01

Itens objetivos, marcáveis como **pendente**, **validado** ou **bloqueado**.
Separados por natureza para deixar claro **quem** fecha cada um.

### 6.1 Evidência de repositório (já verificável hoje)

- [ ] `MFA_TOTP_ENCRYPTION_KEY` validada por presença/formato (Base64, 32
      bytes) sem expor valor — `env.validation.ts`, `totp-secret-cipher.ts`.
- [ ] Fail-closed provado por teste — `totp-secret-cipher.spec.ts`.
- [ ] `.env.example` só com o nome da variável; `.env` fora do versionamento.
- [ ] Reset administrativo de MFA com RBAC e auditoria — T125/T126.
- [ ] Nenhum segredo/valor de chave em código, teste, fixture, log ou este
      documento — verificável por varredura.

### 6.2 Decisão do dono do produto / responsável

- [ ] `DS-SEC-01`: provedor/cofre (ou config de ambiente protegida) **aprovado**
      com evidência dos critérios de §2.1.
- [ ] `DS-SEC-02`: periodicidade de rotação **decidida**.
- [ ] `DS-SEC-03`: aprovador, escopo e janela do break-glass **decididos**.
- [ ] `DS-MFA-01`: política de exigência de MFA (universal vs. faseada)
      **decidida** — pré-requisito de rollout, não deste gate.

### 6.3 Ação de infraestrutura

- [ ] Chave provisionada em cada ambiente pelo cofre aprovado (§3), com dupla
      checagem e evidência.
- [ ] Segregação por ambiente confirmada (`DS-SEC-04`): sem reuso cruzado.
- [ ] Duas contas administrativas nominativas com MFA configurado antes de
      exigir MFA (§5.2).

### 6.4 Validação em ambiente

- [ ] Presença/formato validados no ambiente-alvo (§3.4): `definida` +
      `bytes=32 OK`.
- [ ] Fail-closed demonstrado em ambiente descartável (§3.5).
- [ ] `selfTest()` verde em boot/prontidão do ambiente.

### 6.5 Critério explícito de conclusão do gate

`DS-SEC-01` é considerado **fechado** quando **todos** os itens de §6.1–§6.4
estão **validados** e a decisão `DS-SEC-01` está registrada como aprovada no
[pacote de decisão](../../docs/decisions/pacote-decisao-seguranca-operacional.md).
Fechar `DS-SEC-01` **libera a avaliação** — não a execução automática — de uma
decisão futura de **rollout de MFA** (`DS-MFA-01`), que depende ainda dos demais
gates (`DS-MFA-*`, `DS-BKP-*`) e do gate-mestre `DS-OPS-01`.

---

## 7. Limites e próximos gates

- **QR Code escaneável** (limitação registrada na T126) e **WebAuthn/passkeys**
  (evolução citada na ADR 0003) são **evoluções distintas** e **não** bloqueiam
  o `DS-SEC-01`. Cada uma segue seu próprio gate/decisão.
- **Exigir MFA universal vs. rollout faseado** permanece **decisão de produto**
  (`DS-MFA-01`), posterior e independente deste gate operacional.
- Este documento é **orientação técnica e operacional**; **não** é aprovação
  jurídica, operacional ou de produção, **não** declara conformidade (LGPD ou
  outra) e **não** habilita dado real. Enquanto `DS-OPS-01` estiver aberto,
  **nenhum dado real** entra em nenhum ambiente ou backup.

### Declaração

Nenhuma decisão `DS-…` é tomada por este documento. Ele descreve como operar e
verificar o controle de `DS-SEC-01` (com `DS-SEC-02`/`DS-SEC-03` no que tocam a
chave do MFA), reusando os identificadores já catalogados. A aprovação formal,
com evidência, ocorre no
[pacote de decisão](../../docs/decisions/pacote-decisao-seguranca-operacional.md);
até lá, o gate permanece **Pendente**.
