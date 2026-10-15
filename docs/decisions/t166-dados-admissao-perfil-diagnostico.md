# T166 — Dados de admissão e perfil do colaborador: diagnóstico técnico

Status: **diagnóstico concluído; ADR proposta.** Nenhuma interface, API,
endpoint, migration, schema, seed, banco ou RBAC foi alterado.
Data: 2026-10-15.
Base: `9db194e6ee5fa25f82017557a8d77be3b6048d58` (T165, PR #157).
Decisão correspondente:
[ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md).

Este documento guarda a **evidência** que sustenta a ADR 0016: o que existe
hoje na fonte, como cada campo pedido se relaciona com ela e quais achados a
investigação levantou. A ADR guarda as **decisões**; aqui ficam os fatos.

---

## 1. Inventário na fonte

### 1.1 Schema

| Item                     | Estado                                                                                                                                                          | Evidência                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Colaborador`            | `nome`, `situacao` (derivada dos vínculos), carimbos. **Sem `empresa_id`**                                                                                      | `schema.prisma:958-994`                                                         |
| Ausências deliberadas    | CPF, RG, endereço, telefone, e-mail, nascimento, nome social, identidade de gênero; salário, remuneração, benefício, dado familiar, médico ou sensível; arquivo | `schema.prisma:864-883`                                                         |
| `VinculoFuncional`       | `matricula` (única por empresa), `tipo`, `situacao`, `data_admissao`, `data_desligamento`, `empresa_id`                                                         | `schema.prisma:1006-1040`                                                       |
| `AlocacaoOrganizacional` | seis referências opcionais (unidade, departamento, área, equipe, cargo, centro de custo), vigência                                                              | `schema.prisma:1065-1114`                                                       |
| `MovimentacaoFuncional`  | tipos `admissao`, `transferencia_organizacional`, `mudanca_cargo`, `desligamento`; motivo em catálogo fechado                                                   | `schema.prisma:911-948, 1127-1186`                                              |
| Documentos               | só metadado (`tipo_documento`, `documento_metadado`, `solicitacao_documento`); nenhuma coluna de conteúdo; estado inicial `upload_desabilitado`                 | `schema.prisma:1323-1470`                                                       |
| Gestor e conta↔pessoa    | `access_user_colaborador`, `atribuicao_gestor_equipe`, `excecao_acesso_gestor`, com colunas imutáveis por gatilho                                               | `schema.prisma:1855-1969`; migration `20261007120000_gestor_historico_imutavel` |
| Horário                  | `tabela_horario`, `periodo_horario`, `vinculo_horario` — este aponta para colaborador, não para vínculo                                                         | `schema.prisma:1495-1593`                                                       |
| Proteção em coluna       | só o segredo de MFA é cifrado (envelope AES-256-GCM); nada em pessoas ou documentos                                                                             | `schema.prisma:251-274`                                                         |
| Redação de log           | `*.cpf` e `*.salario` já estão na lista do logger                                                                                                               | `apps/api/src/common/logger/logger.module.ts:6-32`                              |

### 1.2 Contrato de admissão

| Item              | Estado                                                                                                                                 | Evidência                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Rota              | `POST /v1/colaboradores`, permissão `colaborador:create`                                                                               | `colaborador.controller.ts:79-95`                    |
| DTO               | `nome` (2..160), `empresaId`, `matricula` (`/^[A-Z0-9_-]{2,32}$/`), `tipo`, `dataAdmissao`, `motivoCodigo`, seis referências opcionais | `pessoas.dto.ts:123-144`                             |
| Referência mínima | o serviço exige ao menos uma referência; área exige departamento                                                                       | `validacao-pessoas.util.ts:74-104`                   |
| Empresa           | o `empresaId` do corpo só é conferido; divergência responde 404; grava-se sempre a empresa da sessão                                   | `colaborador.service.ts:64-75, 105`                  |
| Transação         | cria colaborador, vínculo `previsto` e movimentação de admissão, com três eventos de auditoria na mesma transação                      | `colaborador.service.ts:95-159`                      |
| Resposta          | 201 com **só** o colaborador                                                                                                           | `colaborador.service.ts:158`                         |
| Edição            | `PATCH /colaboradores/:colaboradorId` retifica **só o nome**; vínculo não tem `PATCH` nem `DELETE`; matrícula é imutável               | `pessoas.dto.ts:172-185`; `vinculo.controller.ts:24` |
| Erros             | corpo único `{status_code, message, request_id, timestamp}`, com mensagem fixa por status; **nenhum erro por campo**                   | `http-exception.filter.ts:20-37`                     |
| Catálogos         | estrutura organizacional tem rotas de listagem; enums (tipo de vínculo, motivo) **não** têm rota e são repetidos no web                | `colaboradoresClient.ts:6`                           |

### 1.3 RBAC e escopo

| Item                               | Estado                                                                                                                                                                                            | Evidência                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Quem admite                        | `rh` e `dp`                                                                                                                                                                                       | `escopo-pessoas.util.ts:39-50`                                                |
| `master_tecnico` em pessoas        | só leitura no avaliador; recusa no resolver de mutação                                                                                                                                            | `rbac.evaluator.ts:353-354`; `escopo-pessoas.util.ts:40-43`                   |
| Empresa ativa                      | `aplicarContextoAoAtor` substitui o `companyId` do ator pela empresa ativa a cada requisição                                                                                                      | `auth/session/contexto-empresarial.ts:262-272`                                |
| Controle por campo ou mascaramento | **não existe**; pessoas devolve a entidade inteira, igual para todos os papéis que leem                                                                                                           | `permission.types.ts:151-170`; `colaborador.service.ts:205-211`               |
| Recurso de dado restrito           | planejado e **não criado** (`dado_restrito_colaborador`)                                                                                                                                          | `permission.types.ts:25-27`; Fatia 2, §4.7                                    |
| Leitura auditada                   | metadado de documentos, solicitações de pessoas (T139), ponto, horários e gestor auditam leitura; catálogo e solicitação de documento, e pessoas, auditam só a leitura global do `master_tecnico` | `pessoas-auditoria.service.ts:54-82`; `documento-metadado.service.ts:149-158` |
| Reautenticação                     | `reauthenticated_at` é gravado e **nunca lido**; `DS-MFA-03` pendente                                                                                                                             | `session.service.ts:78-81`; `pacote-decisao-seguranca-operacional.md:119-128` |

### 1.4 Interface web

| Item                           | Estado                                                                                                                   | Evidência                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Formulário de Novo colaborador | em `Modal`, com nome, empresa (só se houver mais de uma), matrícula, tipo, data e uma referência organizacional          | `ColaboradoresScreen.tsx:1207-1506`                               |
| Empresa no formulário          | **não aparece** quando só há uma; o `empresaId` é preenchido em silêncio                                                 | `ColaboradoresScreen.tsx:393-396, 651-652`                        |
| Validação                      | só no envio; erro por campo com `role="alert"` em cada um; **sem resumo de erros** nem foco no primeiro erro             | `ColaboradoresScreen.tsx:594-643`; `FormField.tsx:89-96`          |
| Confirmação de descarte        | o `Modal` confirma em "Fechar" e Escape; o botão **"Cancelar" chama `fecharFormulario` direto** e descarta sem perguntar | `ColaboradoresScreen.tsx:424-426, 1490-1497`; `Modal.tsx:160-170` |
| Guarda de saída da página      | **não existe** (`beforeunload` ou equivalente)                                                                           | busca em `apps/web`                                               |
| Fluxo em etapas e revisão      | **não existe** em nenhuma tela de cadastro                                                                               | busca em `apps/web`                                               |
| Máscaras (CPF, CEP, telefone)  | **não existem**; um teste exige ausência de "cpf" na tela de Colaboradores                                               | `ColaboradoresScreen.test.tsx:872-887`                            |

---

## 2. Os campos pedidos, contra a fonte

A referência trouxe cerca de 80 campos em nove grupos. A matriz completa, com
bloco, finalidade, acesso, classe e dependência, está na
[ADR 0016, decisão 6](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md#6-matriz-de-campos).
O resumo do que **já existe**:

| Situação                   | Campos                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Existe**                 | nome; matrícula; data de admissão; departamento; cargo; unidade; tipo de contrato, **se** equivaler a tipo de vínculo — hipótese, não fato (`DP-ADM-10`)                                                                                                                                                |
| **Existe por equivalente** | início de vigência (na movimentação); superior direto (derivável pela ADR 0015); data de início no cargo (derivável do histórico); e-mail corporativo (é o login da conta)                                                                                                                              |
| **Existe em outro módulo** | turno (Horários, ligado ao colaborador e não ao vínculo)                                                                                                                                                                                                                                                |
| **Não existe**             | permissão de bater ponto por colaborador (no Ponto, só RH e DP registram); arquivo do documento (só o metadado existe, ADR 0011); e todos os demais: dados pessoais além do nome, endereço, contatos, identificação documental, dados bancários, dependentes, foto, remuneração e atributos contratuais |

---

## 3. Achados e contradições

Registrados aqui para não se perderem. **Nenhum foi corrigido nesta tarefa**,
porque todos estão fora de uma ADR documental; cada um indica onde será
tratado.

| #       | Achado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Evidência                                                                                                                                                                                                                        | Onde se trata                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **D1**  | O formulário de Novo colaborador **não mostra a empresa** em que se está admitindo quando só há uma                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `ColaboradoresScreen.tsx:393-396, 1252`                                                                                                                                                                                          | etapa D (admissão mínima)                                                                                                            |
| **D2**  | O botão **"Cancelar"** descarta dado digitado **sem confirmação**, contornando a guarda do `Modal`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `ColaboradoresScreen.tsx:424-426, 1490-1497`; `Modal.tsx:160-170`                                                                                                                                                                | etapa D                                                                                                                              |
| **D3**  | O servidor aceita **qualquer** dos sete motivos na admissão; só o web fixa `admissao_inicial`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `pessoas.dto.ts:142-143`; `ColaboradoresScreen.tsx:660`                                                                                                                                                                          | etapa C                                                                                                                              |
| **D4**  | O erro de validação **não diz qual campo falhou**: a mensagem é fixa por status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `http-exception.filter.ts:20-37`                                                                                                                                                                                                 | etapa C (`DP-ADM-15`)                                                                                                                |
| **D5**  | A especificação diz que o **gestor inicia solicitação de admissão**; a decisão da T165 (só `rh` e `dp` admitem) e `PD-SOL-01` (gestor consultivo) dizem o contrário                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `.specify/spec.md:112-113`                                                                                                                                                                                                       | convergência da Spec, por decisão do proprietário                                                                                    |
| **D6**  | As decisões de Documentos exigem **MFA imposto** para dado bancário e documento pessoal; o lançamento roda com MFA desligado (T132)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `decisoes-gestao-documentos-e-solicitacoes-v1.md:166-180`; Constituição                                                                                                                                                          | `DP-ADM-07` / `DS-MFA-03`                                                                                                            |
| **D7**  | Depois da T163, o `master_tecnico` **com empresa ativa** lê pessoas sem gerar evento, porque o registro depende de `escopo.global`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `colaborador.service.ts:215, 312`                                                                                                                                                                                                | etapa C                                                                                                                              |
| **D8**  | Pela leitura do código (**não reproduzido** — nenhum teste retifica uma admissão), uma admissão efetivada não tem correção viável. A retificação herda o tipo `admissao`, e efetivá-la exige vínculo `previsto`, que já está `ativo`. Agravantes: data anterior à original é recusada já na retificação (422), porque a comparação é com a data errada; nenhum código reescreve `vinculo_funcional.data_admissao` depois da criação; e a admissão original fica `retificada`, estado terminal, com uma correção que só pode ser cancelada                                                                           | `movimentacao.service.ts:258, 404, 413-418, 427-430, 444`; `validacao-pessoas.util.ts:50, 216`; `colaborador.service.ts:109`; `vinculo.service.ts:116`; `pessoas.e2e-spec.ts:821-833` (a retificação testada é de transferência) | etapa C, começando por um teste que reproduza ou refute, e avaliando recusar a retificação de `admissao` antes de alterar a original |
| **D9**  | O plano ainda trata `DP-23` como decisão a tomar, embora a ADR 0015 o tenha resolvido                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `.specify/plan.md:294, 306-308`                                                                                                                                                                                                  | convergência do Plan                                                                                                                 |
| **D10** | A T165 afirmou que raça/etnia, deficiência e gênero são dado sensível "na LGPD". O art. 5º, II lista origem racial ou étnica e dado referente à saúde; **gênero e deficiência não aparecem literalmente**. A informação sobre deficiência pode, conforme o conteúdo efetivamente tratado, revelar dado referente à saúde; o enquadramento depende desse conteúdo e da decisão de RH + Jurídico, e até lá deficiência segue restrita e bloqueada (`DP-ADM-16`). A Fatia 2 (§5.3) classifica internamente identidade de gênero como "Sensível", o que é coerente como classificação interna, não como afirmação legal | `t165-cadastro-colaborador-rh-bloqueio.md`, §5.5; `etapa1-fatia2-colaboradores-vida-funcional.md`, §5.3                                                                                                                          | ADR 0016, decisão 5; nota aditiva na T165, §5.5                                                                                      |

---

## 4. Correção ao diagnóstico da T165

A **Proposta original 4** da T165 sustentou que a recusa de mutação ao
`master_tecnico` em pessoas "não tem teste próprio" com três afirmações, nesta
ordem: não há `escopo-pessoas.util.spec.ts`; o spec do avaliador "não
exercita `colaborador`/`create`"; e "nenhum E2E cobre o caso". A investigação
da T166 mostrou que **a segunda e a terceira estão erradas**:

- `rbac.evaluator.master-tecnico.spec.ts:73-86` nega `create`, `alter` e
  `manage` ao `master_tecnico` em `colaborador`, `vinculo_funcional`,
  `movimentacao_funcional` e `alocacao_organizacional` (lista em `:45-50`);
- `apps/api/test/documentos.e2e-spec.ts:1022-1034` envia `POST
/v1/colaboradores` como `master_tecnico` e espera **403**.

O que continua verdadeiro é só a **primeira** afirmação: a segunda camada,
`resolverEscopoPessoas`, não tem teste unitário próprio — não existe
`escopo-pessoas.util.spec.ts`. A conclusão "não tem teste próprio" também
não se sustenta: a negação tem teste no avaliador e de ponta a ponta. A garantia está coberta no avaliador e de
ponta a ponta; falta a cobertura isolada do resolver. A ADR 0016 inclui esse
teste nas dívidas da etapa C.

O documento da T165 recebeu notas aditivas nas duas passagens que repetem a
afirmação — a Proposta original 4 e a §5.2 —, apontando para esta seção. O
texto original foi preservado, como a Constituição exige.

---

## 5. Uso das imagens de referência

Foram oito capturas do formulário de cadastro de colaborador de um produto de
mercado, mais a captura da listagem já usada na T164. Delas se extraiu
**somente** a lista de campos e o agrupamento em blocos. Nenhuma marca, texto,
identidade visual, paleta, ícone, layout ou componente foi reproduzido, e as
imagens não foram versionadas.

---

## 6. O que esta tarefa não fez

Nenhuma interface, API, endpoint, migration, schema, seed, banco, alteração de
RBAC ou código de persistência. Nenhum achado da §3 foi corrigido. Nenhuma
base legal ou prazo de retenção foi afirmado.
