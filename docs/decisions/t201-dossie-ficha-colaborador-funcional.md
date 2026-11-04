# T201 — Dossiê: ficha do colaborador funcional

**Situação:** preparação de decisão (2026-11-04). Nenhum código de produto,
API, schema, migration, RBAC, auditoria, seed ou dependência muda nesta etapa.

**Base:** `main` em `9fd3427` (T200 integrada, PR #193). A ficha individual
nasceu na T198 ([dossiê](t198-dossie-ficha-unificada-colaborador.md)) e recebeu
a guarda de saída da T200
([dossiê](t200-dossie-guarda-navegacao-edicao-pendente.md)).

## 1. Resumo e recomendação

**Objetivo de produto.** A ficha concentra o que é de uma pessoa: dados,
contrato, vida funcional, jornada e as operações individuais que já têm
contrato real. A listagem e os dashboards de Colaboradores continuam
coletivos e enxutos: indicadores, filtros e abertura da ficha.

**O que dá para entregar sem API nova.** Além das quatro abas que já existem,
três domínios têm contrato real filtrável por pessoa:

- documentos, só metadados (`colaboradorId`);
- solicitações de pessoas (`vinculoId`);
- registros de ponto (`vinculoId` e competência).

Todo o resto (foto, arquivos, salários, benefícios, férias e ausências como
registro, pesquisas, comentários, portal e convite, novos dados pessoais) não
tem modelo nem endpoint e continua fora.

**Recomendação.** A primeira fatia é uma única aba nova, **Documentos**, na
ficha:

- metadados dos documentos do colaborador e as solicitações de documento dele;
- as mesmas ações que a tela de Documentos de Pessoas já oferece, para os
  mesmos papéis.

A matriz de permissões desse domínio é a mesma da ficha (RH e DP leem e
registram; `master_tecnico` só lê). Por isso a fatia é pequena, completa e
testável, sem regra nova de visibilidade por papel. Solicitações e Ponto
ficam registradas como candidatas, com o que cada uma exige antes de entrar
(seção 4.2).

## 2. Estado atual da ficha

### 2.1 Página, rotas e abas

| Item       | Hoje                                                                                                                                                                                   | Evidência                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Página     | Página própria, aberta pela linha da listagem, pela URL ou pelas visões da empresa                                                                                                     | `apps/web/src/screens/pessoas/FichaColaboradorScreen.tsx:1-26`        |
| Rota       | `#/pessoas/colaboradores/:colaboradorId/:aba`; sem aba vale `dados`; id ou aba fora do formato não é rota                                                                              | `apps/web/src/app/rotasDoShell.ts:69-95`                              |
| Abas       | `dados`, `vida-funcional`, `contratuais`, `jornada`, nessa ordem                                                                                                                       | `apps/web/src/app/rotasDoShell.ts:61-67`                              |
| Rótulos    | Dados do colaborador, Vida funcional, Dados contratuais, Jornada de trabalho                                                                                                           | `FichaColaboradorScreen.tsx:82-87`                                    |
| Cabeçalho  | Nome, situação, tipo de vínculo, matrícula, cargo e departamento vigentes, admissão, jornada vigente. Sem "tempo de empresa" e sem contatos (D19)                                      | `FichaColaboradorScreen.tsx:16-20`                                    |
| Edição     | Dados pessoais, endereço e contatos: RH e DP. Jornada: só RH. `master_tecnico`: só leitura (D23)                                                                                       | `apps/web/src/app/mapaNavegacao.ts:120-147`                           |
| Navegação  | `tablist` com setas, Home e End; cada aba tem `id` e painel próprios; painéis visitados ficam montados, escondidos                                                                     | `FichaColaboradorScreen.tsx:250-269, 500-517`                         |
| Guarda     | A ficha é a área `ficha` da guarda de saída (T200); trocar de aba não desmonta nada e não pergunta                                                                                     | dossiê T200, seção 14                                                 |
| Vida func. | Somente leitura: lotação vigente e linha do tempo do vínculo principal; registrar, efetivar, cancelar e retificar ficam no Histórico funcional (decisão da proprietária de 2026-10-27) | `apps/web/src/screens/pessoas/VidaFuncionalColaboradorSecao.tsx:1-22` |

### 2.2 Visões da empresa em Pessoas (D24)

As abas funcionais de Pessoas são Colaboradores, Horário de trabalho,
Histórico funcional, Dados contratuais, Documentos e Solicitações
(`apps/web/src/screens/pessoas/PessoasScreen.tsx:97-140`). Benefícios,
Dependentes e Afastamentos são demonstrativas (fixtures, sem API). Pela D24
(T198), Dados contratuais, Histórico funcional e Horário continuam como visões
da empresa, com atalho para a ficha. Documentos e Solicitações também são
visões da empresa, com seletor de colaborador.

### 2.3 Testes atuais da ficha

- `FichaColaboradorScreen.test.tsx`: 62 casos (cabeçalho, estados, abas,
  edição, foco).
- `App.ficha.test.tsx`: 53 casos (rota, recarga, voltar e avançar, guarda de
  saída).
- Seções: `DadosPessoaisColaboradorSecao` (25), `VidaFuncionalColaboradorSecao`
  (13), `JornadaColaboradorSecao` (11).

## 3. Matriz de dados e permissões por perfil

Legenda: **L** lê, **E** escreve, **—** negado. Os perfis `gestor`,
`colaborador`, `financeiro`, `admin_tecnico`, `auditor` e `dpo` não têm acesso
a nenhum domínio da tabela; o `gestor` usa a visão própria de Minha equipe.

| Domínio (contrato)                                                         | `rh` | `dp` | `master_tecnico` | Por pessoa                  | Auditoria de leitura                     |
| -------------------------------------------------------------------------- | ---- | ---- | ---------------- | --------------------------- | ---------------------------------------- |
| Colaborador e vínculos (`/colaboradores/:colaboradorId`, `/vinculos`)      | L/E  | L/E  | L                | sim                         | só a consulta global do `master_tecnico` |
| Dados pessoais e endereço (`/colaboradores/:colaboradorId/dados-pessoais`) | L/E  | L/E  | L                | sim                         | toda leitura, na mesma transação         |
| Contatos (`/colaboradores/:colaboradorId/contatos`)                        | L/E  | L/E  | L                | sim                         | toda leitura, na mesma transação         |
| Alocações e linha do tempo (`/vinculos/:vinculoId/...`)                    | L    | L    | L                | por vínculo                 | só a consulta global                     |
| Movimentações (`/movimentacoes`)                                           | L/E  | L/E  | L                | por vínculo                 | escrita auditada                         |
| Jornada do colaborador (`/horarios/vinculos?colaboradorId=`)               | L/E  | L    | L                | sim                         | toda leitura                             |
| Documentos, metadados (`/documentos?colaboradorId=`)                       | L/E  | L/E  | L                | sim                         | toda leitura                             |
| Solicitações de documento (`/solicitacoes-documento?colaboradorId=`)       | L/E  | L/E  | L                | sim                         | toda leitura                             |
| Solicitações de pessoas (`/solicitacoes-pessoas?vinculoId=`)               | L/E  | —    | L                | por vínculo                 | toda leitura                             |
| Ponto (`/vinculos/:vinculoId/pontos?competencia=`)                         | L/E  | L/E  | L                | por vínculo e competência   | toda leitura                             |
| Conta de acesso ligada à pessoa (`/gestor/administracao/ligacoes`)         | L/E  | —    | —                | não (lista da empresa toda) | —                                        |

Evidências: matriz em `apps/api/src/auth/authorization/rbac.evaluator.ts`
(Pessoas `:348-392`, Ponto `:512-553`, Solicitações `:602-630`, Contatos
`:652-687`, Dados pessoais `:705-740`, Documentos `:742-799`, Horários
`:820-879`, ligações do gestor `:420-460`). O catálogo de tipos de documento
só o RH altera.

**Isolamento entre empresas.**

- A empresa vem sempre da sessão, reconferida a cada requisição
  (`apps/api/src/auth/session/session.service.ts:122-149`), nunca do corpo ou
  da query.
- Recurso de outra empresa e recurso inexistente respondem 404 (anti-enumeração).
- Leitura global só existe para `master_tecnico` sem empresa ativa, e é
  auditada.

## 4. Inventário de abas

### 4.1 Reais (já na ficha, preservadas)

| Aba                  | Conteúdo                                                        | Escrita                                 |
| -------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Dados do colaborador | Dados pessoais, endereço e contatos, editáveis por bloco (T181) | RH e DP                                 |
| Vida funcional       | Lotação vigente e linha do tempo do vínculo principal (T187)    | nenhuma (atalho ao Histórico funcional) |
| Dados contratuais    | Vínculos, alocações por vigência, horário e movimentações       | nenhuma (somente leitura)               |
| Jornada de trabalho  | Jornada vigente e vigências (T183)                              | só RH                                   |

### 4.2 Candidatas (contrato real, sem API nova)

| Candidata               | Contrato                                                                                                                          | O que mostraria                                                                                                             | Condição para entrar                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Documentos**          | `GET/POST /documentos`, `POST /documentos/:documentoId/substituicoes`, `GET/POST /solicitacoes-documento`, `GET /tipos-documento` | Documentos registrados (tipo, estado, datas) e solicitações pendentes                                                       | Nenhuma decisão de política nova; só F-1 a F-4 (seção 9). Texto explícito de que o Evolli não guarda o arquivo (ADR 0011)                              |
| Solicitações            | `GET/POST /solicitacoes-pessoas?vinculoId=`, `/:solicitacaoId/historico`, `/:solicitacaoId/transicoes`                            | Pedidos da pessoa (ajuste de ponto, ausência, férias, atualização cadastral, atestado, benefícios) e o histórico de cada um | Regra de visibilidade por papel: o DP é negado no servidor. Decidir se a aba some para o DP ou aparece com aviso. Uma consulta por vínculo da pessoa   |
| Ponto                   | `GET /vinculos/:vinculoId/pontos?competencia=`, `GET /pontos/:pontoId/ajustes`, `POST /pontos`, `POST /pontos/:pontoId/ajustes`   | Registros do mês escolhido e os ajustes                                                                                     | Escolha da competência na rota ou no estado; sem saldo nem cálculo de horas (o servidor não calcula); decidir se a ficha registra ponto ou só consulta |
| Vida funcional operável | `POST /movimentacoes` e `/:movimentacaoId/{efetivar,cancelar,retificar}`                                                          | Registrar e operar movimentações dentro da ficha                                                                            | Rever a decisão da proprietária de 2026-10-27, que manteve a operação no Histórico funcional                                                           |

### 4.3 Bloqueadas (sem dado, contrato ou política aprovada)

| Capacidade                                   | Por que está bloqueada                                                                                                                           | O que exige                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Foto                                         | Nenhum modelo nem endpoint; o ponto também não guarda foto nem biometria (`schema.prisma:1276-1279`)                                             | Política de armazenamento (R2), consentimento e base legal, formatos, antivírus, URLs assinadas, retenção |
| Documentos com arquivo e upload              | Só metadados existem; não há código de upload, URL ou storage (`schema.prisma:1405-1415`; ADR 0011)                                              | Nível 2 da ADR 0011: R2, acesso por categoria, retenção, antivírus, trilha de download                    |
| Salários                                     | Nenhum modelo de remuneração (`schema.prisma:924-936`)                                                                                           | Modelo e histórico, perfis que leem, minimização, trilha, relação com Folha                               |
| Benefícios                                   | Nenhum modelo; a aba de Pessoas é demonstrativa. Só existe como tipo de solicitação                                                              | Catálogo, elegibilidade, dependentes, custos                                                              |
| Férias e ausências                           | Nenhum registro de afastamento nem estado de ausência no vínculo (`schema.prisma:958-965`); só existem como tipo de solicitação                  | Regras de período aquisitivo e concessão, tipos de afastamento, integração com Jornada                    |
| Pesquisas                                    | Nenhum modelo                                                                                                                                    | Módulo próprio e regra de anonimato                                                                       |
| Comentários                                  | Nenhum modelo                                                                                                                                    | Quem escreve e lê, dado sensível em texto livre, edição e exclusão, auditoria                             |
| Portal e convite                             | Não há fluxo de convite na API; o autoatendimento não está autorizado (ADR 0015); a ligação conta–colaborador é só do RH e sem filtro por pessoa | Decisão sobre autoatendimento, convite e expiração, MFA                                                   |
| Contato de emergência e novos dados pessoais | Fora do modelo por decisão (`schema.prisma:2071-2072`)                                                                                           | Base legal, minimização, auditoria e migration                                                            |
| Tempo de casa e carga horária no resumo      | Não há campo nem cálculo no servidor; a D19 decidiu não calcular "tempo de empresa" na tela                                                      | Revisão da D19 (F-5)                                                                                      |

Nenhuma capacidade bloqueada aparece na tela, nem como aba vazia (D21).

## 5. Proposta da primeira fatia

### 5.1 Escopo

- **Aba nova `documentos`** em `ABAS_DA_FICHA`, depois de `jornada`, com rótulo
  "Documentos" e rota `#/pessoas/colaboradores/:colaboradorId/documentos`.
- **Conteúdo, sempre deste colaborador:**
  - lista de documentos (`GET /documentos?colaboradorId=`), com tipo, estado e
    datas;
  - lista de solicitações de documento (`GET /solicitacoes-documento?colaboradorId=`);
  - detalhe só leitura de cada item.
- **Ações para RH e DP**, as mesmas da tela de Documentos de Pessoas:
  - registrar documento (metadado);
  - corrigir o tipo (substituição, que preserva o histórico);
  - solicitar documento.

  O `master_tecnico` só lê.

- **Texto honesto:** o Evolli registra o documento, mas não guarda o arquivo
  (ADR 0011). Nenhum botão de envio, download ou visualização.
- **Reaproveitamento:** a tela de Documentos de Pessoas fixada no colaborador,
  como já foi feito com Dados contratuais na T198. O seletor de colaborador
  some e o colaborador vem da rota.
- **Guarda de saída:** o formulário declara "Documentos" no registro de
  edições (já é uma das 16 declarações da T200). Dentro da ficha, a aba fica na
  área `ficha`: sair da ficha com o formulário aberto pergunta; trocar de aba
  não desmonta e não pergunta.

### 5.2 O que não entra

- Solicitações, Ponto e Vida funcional operável (candidatas da seção 4.2).
- Tudo da seção 4.3.
- Mudança no cabeçalho (D19 mantida).
- Mudança nas visões da empresa em Pessoas (D24 mantida).

### 5.3 Contratos

Nenhuma mudança: os endpoints da seção 4.2 (linha Documentos) já existem,
filtram por `colaboradorId` no escopo da sessão e já são usados pela tela de
Documentos de Pessoas.

## 6. Riscos

| Risco                        | Cuidado na implementação                                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolamento entre empresas    | O colaborador vem só da rota e todo pedido leva `colaboradorId`; o servidor filtra pela empresa da sessão e responde 404 fora do escopo. A troca de empresa remonta a árvore (T163) e a guarda da T189 continua valendo. Nenhum dado de outra empresa pode ficar em cache entre montagens |
| `master_tecnico` sem empresa | A leitura global de documentos não filtra por empresa. Na ficha, isso misturaria documentos de empresas diferentes da mesma pessoa. Decidir em F-4 (recomendado: pedir empresa ativa para a aba)                                                                                          |
| Foco                         | Abrir a aba pela URL foca o painel, como as demais. Fechar um formulário devolve o foco a quem o abriu. Nunca foco no `body` nem em `[inert]` (regras da T200)                                                                                                                            |
| URL por aba                  | `documentos` entra em `ABAS_DA_FICHA`, e a rota antiga continua válida. Uma aba desconhecida não é rota (cai na correção no lugar). Voltar e avançar entre abas seguem a T200                                                                                                             |
| Acessibilidade               | A aba nova entra no `tablist` com setas, Home e End. Tabelas com legenda, estados vazios que explicam e oferecem a próxima ação só a quem pode agir, e mensagens de erro anunciadas                                                                                                       |
| 375 px                       | Com cinco abas a faixa precisa rolar dentro do quadro, sem rolagem horizontal da página. As tabelas usam o padrão responsivo de `DataTable`                                                                                                                                               |
| Expectativa de arquivo       | O nome "Documentos" sugere arquivo. O estado `upload_desabilitado` precisa ser dito em linguagem simples, sem parecer erro                                                                                                                                                                |

## 7. Critérios de aceite

1. A aba Documentos aparece na ficha para RH, DP e `master_tecnico` (com
   empresa ativa). O gestor e os demais perfis continuam sem ficha.
2. A URL `…/:colaboradorId/documentos` abre a ficha nessa aba; recarregar,
   voltar e avançar funcionam como nas outras abas.
3. A lista mostra só documentos e solicitações deste colaborador, na empresa
   ativa; colaborador de outra empresa dá "não encontrado".
4. RH e DP registram, corrigem o tipo e solicitam; o `master_tecnico` não vê
   ação de escrita; recusa do servidor vira mensagem, sem dado.
5. Nenhum controle de arquivo (envio, download, visualização) existe na aba.
6. Formulário aberto e saída da ficha pedem confirmação; troca de aba não pede.
7. A 375 px não há rolagem horizontal da página; foco e anúncios corretos.
8. As visões da empresa em Pessoas continuam iguais.

## 8. Plano de testes

- **Unidade (web):**
  - aba fixada no colaborador (sem seletor);
  - lista, vazio, erro e nova tentativa;
  - 403 e 404;
  - ações por papel;
  - texto de "sem arquivo";
  - formulário declarando edição.
- **Shell (`App.ficha.test.tsx`):**
  - rota da aba nova;
  - aba desconhecida;
  - voltar e avançar entre abas;
  - formulário aberto e saída da ficha (guarda);
  - troca de aba sem pergunta;
  - papel sem acesso.
- **Prova de falha:** cada teste novo falha sem a mudança correspondente.
- **API:** sem mudança. A suíte E2E existente de documentos continua cobrindo
  o escopo por empresa.
- **Localhost com dados sintéticos:**
  - RH, DP, `master_tecnico` com e sem empresa ativa, e gestor;
  - desktop e 375 px.
- **Bateria completa:** web, API unitária, E2E com PostgreSQL real
  (`--runInBand`), scripts, lint, typecheck, build, Prettier, `spec:check`,
  prévia do squash e `git diff --check`.

## 9. Decisões pendentes

| Id  | Pergunta                                                                                          | Recomendação                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-1 | Qual é a primeira fatia: Documentos, Solicitações ou Ponto?                                       | **Documentos**: mesma matriz de papéis da ficha, sem regra nova de visibilidade, contrato filtrável por pessoa e tela pronta para fixar no colaborador |
| F-2 | Na aba Documentos, só leitura ou também as ações de hoje (registrar, corrigir o tipo, solicitar)? | **As ações de hoje**, para RH e DP, como na visão da empresa; `master_tecnico` só lê                                                                   |
| F-3 | Documentos e Solicitações continuam também como visões da empresa em Pessoas?                     | **Sim, nesta fatia** (D24): servem como fila da empresa. Rever depois de a ficha cobrir os dois                                                        |
| F-4 | `master_tecnico` sem empresa ativa na aba Documentos                                              | **Pedir empresa ativa** na aba (aviso, sem dado), para não misturar documentos de empresas diferentes da mesma pessoa                                  |
| F-5 | O resumo do cabeçalho ganha carga horária semanal e tempo de casa?                                | **Não** (manter D19): nenhum dos dois existe no servidor; calcular na tela cria regra nova sem decisão                                                 |
| F-6 | Quando Solicitações entrar, a aba some para o DP (negado no servidor) ou aparece com aviso?       | **Some** para quem o servidor nega: a ficha só oferece o que o servidor aceita                                                                         |
| F-7 | Quando Ponto entrar, a ficha registra ponto ou só consulta?                                       | **Só consulta** na primeira vez, com a competência na rota; registro e ajuste seguem no módulo de Ponto                                                |
| F-8 | A Vida funcional passa a operar movimentações dentro da ficha?                                    | **Não por ora**: mantém a decisão de 2026-10-27; rever com dados de uso                                                                                |

## 10. Limites e fora de escopo

- **Nesta etapa:** nenhum código de produto, API, schema, migration, RBAC,
  auditoria, Docker, seed, dependências, lockfile ou workflow; sem push e sem PR.
- **Na primeira fatia:** só a aba Documentos (seção 5). Ficam de fora:
  - as candidatas Solicitações, Ponto e Vida funcional operável;
  - tudo o que está bloqueado na seção 4.3;
  - mudança no cabeçalho e nas visões da empresa.
- **Sempre:** nada do que está bloqueado aparece na tela, nem como aba vazia ou
  aviso de "em breve".
