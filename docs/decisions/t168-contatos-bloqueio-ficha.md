# T168 — Dados de contato do colaborador: regra de parada acionada

Status: **parada por regra declarada, nos quatro campos.** Nenhuma migration,
API, interface, teste de produto ou RBAC foi escrito.
Data: 2026-10-16.
Base: `dcef62706399126b934c51e7d2955941cf9f06b3` (T167, PR #159).

A tarefa mandava investigar **antes** de criar migration ou interface, e
implementar só o campo que a ADR 0016 classificasse como A2, complementar e não
bloqueado, **com finalidade, acesso, auditoria e retenção suficientemente
definidos nos artefatos aprovados**. Mandava também parar, com evidência, o item
que dependesse de decisão não aprovada, sem inventar regra.

A investigação mostra que **nenhum dos quatro campos atende a essa condição**.
O motivo é um só para três deles e outro para o quarto, e ambos estão escritos
na própria ADR aprovada.

---

## 1. O que a ADR 0016 aprovada diz de cada campo

| Campo pretendido   | Classe           | Agregado            | Depende de (ADR 0016, §6.3)            | Hoje                            | Evidência             |
| ------------------ | ---------------- | ------------------- | -------------------------------------- | ------------------------------- | --------------------- |
| E-mail pessoal     | A2, Complementar | Contatos e endereço | `FT`; `CTR`; `RET`                     | não existe                      | ADR 0016, matriz §6.3 |
| Celular            | A2, Complementar | Contatos e endereço | `FT`; `CTR`; `RET`                     | não existe                      | idem                  |
| Telefone           | A2, Complementar | Contatos e endereço | `FT`; `CTR`; `RET`                     | não existe                      | idem                  |
| E-mail corporativo | **Derivado**     | **conta de acesso** | ligação conta↔pessoa (ADR 0015); `RET` | existe como `access_user.email` | idem                  |

`FT` é ficha de tratamento aprovada, `CTR` é contrato novo e `RET` é decisão de
retenção. Os três primeiros são "Complementar", o que a ADR define como "entra
depois da admissão; **se for dado pessoal, só quando sua ficha for aprovada**".
Nenhum é "Bloqueado": o que falta é a ficha, não uma decisão anterior a ela.

---

## 2. Por que e-mail pessoal, celular e telefone não podem ser implementados

A decisão 5.4 da ADR 0016 é categórica:

> Uma categoria de dado só ganha schema e contrato depois de uma **ficha de
> tratamento aprovada** e da **emenda à ADR 0007, ou ADR própria**. [...] **Sem
> ficha aprovada, a categoria não existe** — nem como coluna nula, nem como campo
> escondido na tela.

Procurei no repositório inteiro (`docs`, `.specify`, ADRs e decisões):

- **Nenhuma ficha de tratamento existe**, para nenhuma categoria. A expressão só
  aparece na própria ADR 0016 e no ledger que a descreve.
- **Nenhuma decisão sobre contatos** do colaborador foi tomada. As únicas
  menções a telefone e e-mail em decisões são a proibição da ADR 0007 e da
  Baseline V1 ("Não incluir: CPF, RG, endereço, telefone…") e redações de
  exemplos fora de Pessoas.
- **`DP-ADM-02` (finalidade e base legal) e `DP-ADM-03` (retenção, descarte e
  exportação) seguem abertas**, com RH + Jurídico como responsáveis. A aprovação
  da ADR, em 2026-10-16, **não as fechou** — a nota de aprovação da própria ADR
  diz isso.
- **O `schema.prisma` segue sem campo de contato.** A ausência está registrada
  como deliberada (`schema.prisma:864-883`).

A condição do proprietário na T168 — "finalidade, acesso, auditoria e retenção
suficientemente definidos nos artefatos aprovados" — fica assim:

| Item                           | Estado                                                                                                                         | Fonte                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Acesso** (quem lê e altera)  | **definido** para A2: `rh` e `dp` da empresa ativa; `master_tecnico`, `gestor` e demais negados                                | ADR 0016, decisão 4; briefing da T168       |
| **Auditoria**                  | **definida** para A2: escrita na mesma transação, sem valores; leitura não é auditada (só A3 tem leitura auditada)             | ADR 0016, decisão 5.5                       |
| **Finalidade**                 | **não aprovada**: a ADR traz só "contato operacional com a pessoa — proposta", e a decisão sobre finalidade é de RH + Jurídico | ADR 0016, §6.3 e decisão 5.4; `DP-ADM-02`   |
| **Retenção**                   | **não decidida**, para nenhuma categoria de dado de pessoas                                                                    | ADR 0016, decisão 5.7; `DP-ADM-03`, `DP-15` |
| **Base legal e classificação** | **não aprovadas**                                                                                                              | idem                                        |
| **Contrato**                   | **não existe**: é justamente o que a ficha e a emenda criam                                                                    | ADR 0016, `CTR`                             |

Dois dos seis itens estão definidos. Os quatro restantes dependem de RH +
Jurídico, e a regra da tarefa é parar sem inventá-los.

---

## 3. Por que o e-mail corporativo não é um campo de contato

O e-mail corporativo **não é atributo do colaborador**. A ADR 0016 o classifica
como **Derivado**, do agregado "conta de acesso": "é o login da conta
(ADR 0003), mostrado só quando há conta ligada à pessoa".

A fonte confirma e acrescenta:

- Um campo digitado por RH ou DP, **gravado** no perfil do colaborador, **criaria
  um segundo e-mail corporativo**, que poderia divergir do login — e a
  igualdade de e-mail não prova identidade, como o próprio `schema.prisma`
  registra (comentário do modelo `AccessUserColaborador`).
- **Não existe rota que altere o e-mail de uma conta.** `users.controller.ts`
  expõe apenas listar, criar, alterar papel, desativar e reiniciar MFA. Mudar o
  login seria um contrato novo no domínio de **contas** (sessões ativas,
  recuperação de acesso, unicidade, auditoria própria), que a T168 não
  autoriza: o RBAC global e as contas estão fora do escopo.
- Mostrá-lo, em leitura, depende da **ligação conta↔pessoa** (ADR 0015), que só
  existe quando o RH a cria, e de decidir quem do RH e do DP pode ler o e-mail
  de uma conta — a matriz de contas (`other_account`) tem regra própria.

O item para: **não é um campo de contato a gravar**, e exibi-lo é decisão do
domínio de contas, não desta fatia.

---

## 4. O que desbloqueia cada item

### 4.1 E-mail pessoal, celular e telefone — uma ficha, uma emenda

A categoria é **"Contatos e endereço"**; endereço e contato de emergência estão
fora desta tarefa, então a ficha pode cobrir **só os três campos**. O modelo
abaixo é a ficha da decisão 5.4 com as respostas **em branco**: nada foi
preenchido por suposição.

| Item da ficha                                                                                                               | Quem responde       | Resposta                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Campos exatos e formato (limites; normalização de e-mail e de telefone; se o telefone é nacional, internacional ou os dois) | proprietário + RH   | **pendente**                                                                                                                                   |
| Módulo consumidor — quem usa o dado, e para quê                                                                             | proprietário + RH   | **pendente**                                                                                                                                   |
| Finalidade                                                                                                                  | **RH + Jurídico**   | **pendente** (hoje só a proposta "contato operacional com a pessoa")                                                                           |
| Titulares e categorias de titulares                                                                                         | **RH + Jurídico**   | **pendente**                                                                                                                                   |
| Destinatários e compartilhamentos (inclui se alguma integração ou notificação os usa)                                       | **RH + Jurídico**   | **pendente**                                                                                                                                   |
| Base legal                                                                                                                  | **RH + Jurídico**   | **pendente**                                                                                                                                   |
| Classificação                                                                                                               | **RH + Jurídico**   | **pendente**                                                                                                                                   |
| Origem e evidência da coleta (o titular não participa do sistema nesta fase)                                                | RH                  | **pendente**                                                                                                                                   |
| Perfis que leem e alteram                                                                                                   | proprietário + RH   | **informado no briefing da T168**: `rh` e `dp` da empresa ativa; `master_tecnico`, `gestor` e `colaborador` negados — **a confirmar na ficha** |
| Retenção, descarte e exportação (e se o histórico de valores é guardado)                                                    | **RH + Jurídico**   | **pendente** (`DP-ADM-03`)                                                                                                                     |
| Necessidade de RIPD                                                                                                         | **RH + Jurídico**   | **pendente**                                                                                                                                   |
| Autenticação reforçada                                                                                                      | Segurança + Produto | **pendente** (`DS-MFA-01`, `DS-MFA-03`)                                                                                                        |
| Proteção em repouso                                                                                                         | Segurança           | **pendente** (`DP-ADM-13`)                                                                                                                     |

Além da ficha, a decisão 5.4 exige a **emenda à ADR 0007**, ou ADR própria, que
autorize a categoria. E há um ponto formal que o briefing da T168 já decide, mas
que ainda não tem emenda: **negar o `master_tecnico` em A2** contraria a decisão
3 da ADR 0012 (leitura global nos módulos), e a ADR 0016 diz que isso "exige
**emenda àquela decisão**" (`DP-ADM-06`).

### 4.2 E-mail corporativo

Duas decisões, ambas do domínio de contas, e nenhuma desta fatia:

1. **se** o perfil do colaborador deve mostrar o e-mail da conta ligada, e a
   quem — o que depende da ligação conta↔pessoa (ADR 0015) e da matriz de
   `other_account`;
2. **se** RH ou DP podem alterar o login de uma conta, com o contrato de contas
   que isso exige.

---

## 5. O que fica pronto para quando a ficha chegar

Nada foi construído, mas as regras que **já estão aprovadas** valem sem nova
decisão e descrevem a implementação, para não precisar de reinterpretação:

- **Modelo** (ADR 0016, decisão 3): agregado próprio **fora** de `Colaborador`,
  com `empresa_id` gravado da sessão e garantia no banco de que o colaborador
  tem vínculo naquela empresa; recurso de autorização próprio; rota aninhada
  (`/colaboradores/:colaboradorId/<categoria>`, nunca `:id`) sem `empresaId` no
  corpo; fora da listagem, do Hub, da projeção do gestor.
- **Auditoria:** escrita na mesma transação, sem valores, no padrão
  `pessoas.<entidade>.<verbo>`.
- **Logs e cliente:** nenhum valor em log, URL, fixture com dado real ou
  armazenamento do navegador; a redação do logger ganha os caminhos antes de o
  campo existir.
- **Migration:** aditiva, com expand/contract, sem privilégio novo de banco.

---

## 6. O que esta tarefa fez e não fez

**Fez:** convergiu a T167; registrou a aprovação da ADR 0016 (`DP-ADM-01`);
abriu a T168; investigou os quatro campos na ADR, no schema, no RBAC e nas
rotas; e entregou este diagnóstico, com a ficha em branco.

**Não fez:** nenhuma migration, API, interface, teste de produto, alteração de
RBAC, seed, Docker, banco ou processo. Nenhum campo foi implementado, porque
**nenhum atende à condição do proprietário**.

**Decisão necessária para retomar:** a ficha da §4.1 respondida por RH +
Jurídico (e por Segurança, nos dois itens que lhe cabem), mais a emenda à
ADR 0007 e, se o `master_tecnico` deve ficar fora de A2, a emenda à ADR 0012.
Com isso, a T168 pode ser retomada para os três campos de contato. O e-mail
corporativo precisa de decisão própria do domínio de contas.
