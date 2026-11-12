# T208 — Configurações: Meu Perfil (dossiê de preparação)

- **Estado:** implementada e validada localmente, com a validação visual humana aprovada em
  2026-11-12 (seção 20); em branch local, sem push, PR, revisão de PR, promoção ou merge. As
  decisões MP-1 a MP-8 da seção 13 foram aprovadas (seção 15), seguem sem alteração e a primeira
  fatia está descrita nas seções 16 a 20. Só web: nenhuma mudança de API, schema, migration, RBAC,
  auditoria, seed, Docker, dependência, lockfile ou workflow.
- **Base:** `main` em `25903aa742d8f3f304dd7b3597eaed12ed83649a` (T207 integrada, PR #200).
- **Objetivo:** começar o módulo **Configurações** pelo submódulo **Meu Perfil** — o que a própria
  pessoa logada vê (e, no futuro, ajusta) da sua conta de acesso —, numa entrega por vez.
  **Segurança**, **Empresas** e **Equipe e permissões** ficam só inventariados (seção 9).

Todas as referências abaixo são ao código desta base (`apps/web/src` e `apps/api`).

## 1. Resumo

- A conta de acesso (`AccessUser`) guarda **só o e-mail** como dado pessoal: não há nome, telefone,
  foto, idioma, fuso nem preferências (`apps/api/prisma/schema.prisma:57-70`).
- O único contrato do próprio usuário é **`GET /v1/users/me`**, só leitura, para qualquer papel
  autenticado (`apps/api/src/users/users.controller.ts:64-82`). **Não existe** rota para a pessoa
  editar nome, e-mail, telefone, senha ou preferências.
- A permissão `own_account` (ler e gerenciar a própria conta) já existe no avaliador de RBAC
  (`apps/api/src/auth/authorization/rbac.evaluator.ts:73-85`), mas nenhuma rota de edição a usa.
- Na web não há tela, rota, item de menu nem cartão de Configurações ou Meu Perfil; o mapa de
  navegação registra explicitamente que "não há tela" (`apps/web/src/app/mapaNavegacao.ts:328-330`).
  "Segurança" (2º fator) e "Sessões ativas" existem como **painéis da barra superior do shell**, não
  como rotas (`apps/web/src/app/App.tsx:1757-1782`).
- **Conclusão:** a menor fatia funcional possível **sem API nova** é um **Meu Perfil somente
  leitura**, com o que `/users/me` já devolve. Qualquer edição exige contrato novo e decisão.

## 2. Escopo da preparação

Levantamento, só em leitura, de rotas, shell, autenticação, sessão, conta, permissões, contratos,
campos disponíveis, comportamento por papel, acessibilidade, foco, guarda de saída, troca de
empresa, URL e 375 px; delimitação de Meu Perfil; matriz de campos, papéis e contratos; separação
do que é possível agora e do que depende de decisão; proposta da menor primeira fatia; decisões
para aprovação.

## 3. Levantamento

### 3.1 Shell, rotas e navegação (web)

- Rotas por hash numa tabela fechada (`ROTA_POR_DESTINO`, `app/rotasDoShell.ts:44-50`), com rotas
  analisadas à parte para a ficha (`:129-154`), a listagem (`:258-281`) e o Dashboard (`:362-392`),
  reunidas em `destinoDaRota` (`:414-422`). Histórico próprio com `pushState`/`replaceState`, e
  escuta de `popstate` e `hashchange` (`App.tsx:838-873`, `:1161-1199`, `:1475-1479`).
- Destinos e menu em `GRUPOS` (`app/mapaNavegacao.ts:220-390`): Dashboard, Gestão de Pessoas,
  Estrutura, Jornada, Liderança, Administração (Contas de acesso) e Demonstração.
- Padrão para um destino novo: item em `GRUPOS`; id em `CAPACIDADE_FUNCIONAL_POR_PAPEL`
  (`mapaNavegacao.ts:555-587`); ramo em `conteudoDoDestino` (`App.tsx:393`); id do título em
  `TITULO_ID_POR_DESTINO` (`App.tsx:252-261`); rota e descrição do cartão do Hub, quando houver
  (`HubPosLogin.tsx:110-128`). A entrada é validada em `resolverEntrada` (`App.tsx:630-642`).
- Destino inicial e pós-login por papel: `destinoInicialPara` e `destinoPosLoginPara`
  (`mapaNavegacao.ts:462-490`; `AutenticacaoApp.tsx:288-297`).

### 3.2 Autenticação e sessão (web e API)

- Fluxo do cliente: verificação da sessão por `GET /v1/auth/csrf`, ator por `GET /v1/users/me`
  (`AutenticacaoApp.tsx:118-128`, `:250-262`, `:278`; `api/usersClient.ts:144-147`).
- Login e 2º fator: `POST /v1/auth/login` e `POST /v1/auth/mfa/verify` (`api/authClient.ts:47`,
  `:94`); logout: `POST /v1/auth/logout` (`:129`; `AutenticacaoApp.tsx:540-550`).
- Sessões ativas: `GET /v1/auth/sessions` e `DELETE /v1/auth/sessions/:id`, só da própria conta
  para quem não administra contas (`apps/api/src/auth/auth.controller.ts:161-232`); painel
  `SessoesAtivasPanel`, aberto por botão da barra superior.
- 2º fator (TOTP): cadastro por `POST /v1/auth/mfa/totp/enroll` e `.../confirm`, só com o
  interruptor de servidor ligado (`mfa.controller.ts:41-58`); painel `SegurancaMfaPanel`. Não há
  rota para a própria pessoa desligar o 2º fator (só o reset administrativo).
- Senha: só recuperação pública por e-mail (`POST /v1/auth/password/forgot` e `/reset`,
  `auth.controller.ts:284-301`). **Não existe** troca de senha estando logado nem reautenticação
  explícita.
- Troca de empresa ativa: `GET /v1/auth/contexto/empresas` e `POST /v1/auth/contexto/empresa`, só
  `rh` e `master_tecnico` (`apps/api/src/auth/session/contexto-empresarial.ts:57`); na web, o
  `SeletorEmpresaAtiva` no topo do menu e no Hub. A árvore remonta pela chave conta+empresa
  (`AutenticacaoApp.tsx:634`).

### 3.3 A conta de acesso e o contrato `GET /v1/users/me`

- `AccessUser`: `id`, `email` (único), `passwordHash`, `role`, `companyId`/`unitId`/`teamId`
  (texto, sem chave estrangeira), `status`, `createdAt`, `updatedAt` (`schema.prisma:57-70`).
- `GET /v1/users/me` devolve a projeção segura `toSafeUser` (`apps/api/src/auth/safe-user.util.ts`)
  — `id`, `email`, `role`, `companyId` (a empresa ativa da sessão), `unitId`, `teamId`, `status`,
  `createdAt` — mais `mfaAvailable` (interruptor do servidor), `podeTrocarEmpresa` e
  `empresaAtiva {id, codigo, nome}` (`users.controller.ts:64-82`). Nunca traz o hash da senha.
- **Não traz:** nome, estado do 2º fator **da conta** (só se o recurso está ligado no servidor),
  vínculo com colaborador, unidade e equipe por nome, preferências.

### 3.4 Papéis e permissões

- Papéis: `master_tecnico`, `admin_tecnico`, `rh`, `dp`, `gestor`, `financeiro`, `colaborador`,
  `auditor`, `dpo` (`schema.prisma:26-46`; `apps/web/src/api/usersClient.ts:73-83`).
- Decisão de acesso na API: avaliador puro com negação por padrão e `@RequirePermission`
  (`rbac.evaluator.ts:23-71`). Ninguém altera o próprio papel (`:190-194`); `master_tecnico` não é
  atribuível por rota (`:213-220`).
- Na web, só `rh`, `dp`, `master_tecnico` e `gestor` têm capacidade funcional no shell;
  `financeiro`, `colaborador`, `auditor`, `dpo` e `admin_tecnico` aterrissam no Hub
  (`mapaNavegacao.ts:546-550`).

### 3.5 Conta e colaborador

- A conta é desacoplada do colaborador (ADR 0003; `schema.prisma:54`). A ligação conta↔colaborador
  (DP-23) existe em `AccessUserColaborador`, criada só pelo RH, nunca deduzida por e-mail
  (`schema.prisma:1931-1970`).
- Nome, contatos, dados pessoais e endereço vivem no colaborador e são lidos só por `rh`, `dp` e
  `master_tecnico` (`rbac.evaluator.ts:663-731`). Não há autoatendimento do colaborador.

### 3.6 Auditoria e privacidade

- `AuditService.record` e o enum fechado `AuditAction`; a trilha é só acréscimo, sem conteúdo
  antes/depois (`schema.prisma:340-344`, `:594-641`). Login, logout, sessões, senha, 2º fator,
  troca de contexto e contas já geram eventos.
- A conta guarda só o e-mail como dado pessoal; os dados pessoais do colaborador têm trilha
  própria. Não há mascaramento no código.

### 3.7 O que existe hoje de Configurações

| Área                | Hoje                                                                                                                      | Tela     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| Configurações       | Nada; o mapa de navegação registra que não há tela                                                                        | Não      |
| Meu Perfil          | Nada; o Hub mostra "Conta" (e-mail) e "Perfil" (o rótulo do papel) (`HubPosLogin.tsx:321-345`)                            | Não      |
| Segurança           | Painel de 2º fator na barra superior do shell (`SegurancaMfaPanel`) e painel "Sessões ativas"                             | Painéis  |
| Empresas            | API `/v1/empresas` (ler; criar só `master_tecnico`; alterar `master_tecnico` ou `rh` na própria empresa); seletor da T189 | Não      |
| Equipe e permissões | "Contas de acesso" (listar, criar, alterar papel, desativar, resetar 2º fator); Administração da liderança                | Em parte |

### 3.8 Infraestrutura de UX reaproveitável

- Foco no título ao abrir um destino (`focarTituloAoAbrir`, `App.tsx:1585-1600`); região viva
  fora da árvore que remonta (`AutenticacaoApp.tsx:558-565`).
- Guarda global de edição pendente e de saída (`app/edicoesPendentes.tsx:197-222`,
  `app/guardaDeSaida.tsx:55-91`), já usada pelo menu, pelo Hub e por Sair.
- Formulários: `useEdicaoDoBloco` (Editar/Salvar/Cancelar, erros por campo, `atualizadoEm`) e os
  componentes `Button`, `FormField`, `FormActions`, `PageHeader`, `TrilhaNavegacao`
  (`components/index.ts`).
- Celular: abaixo de 835 px o menu vira gaveta modal com foco preso (`app-shell.css:428-482`;
  `App.tsx:1639-1649`).

## 4. Delimitação de Meu Perfil

**Meu Perfil é a conta de acesso da própria pessoa logada**, não o cadastro de colaborador:

- mostra quem está logado, com qual papel e em qual empresa ativa;
- não mostra nem edita dados do colaborador (nome civil, documentos, contatos, endereço), que são
  dados de RH com regras próprias;
- não administra outras contas, papéis, empresas nem permissões (submódulos futuros);
- 2º fator, sessões e senha pertencem a **Segurança** (seção 9).

## 5. Matriz de campos

| Campo                          | Fonte hoje                              | Exibir na 1ª fatia         | Editar na 1ª fatia | Depende de                                                |
| ------------------------------ | --------------------------------------- | -------------------------- | ------------------ | --------------------------------------------------------- |
| E-mail de acesso               | `email` em `/users/me`                  | Sim                        | Não                | Fluxo de verificação, auditoria e unicidade (MP-6)        |
| Papel                          | `role` em `/users/me` (rótulo da web)   | Sim                        | Não                | Ninguém altera o próprio papel (regra do RBAC)            |
| Empresa ativa                  | `empresaAtiva {nome, codigo}`           | Sim, ou "nenhuma empresa"  | Não                | A troca segue no seletor da T189 (`rh`, `master_tecnico`) |
| Conta criada em                | `createdAt`                             | Sim (data)                 | Não                | —                                                         |
| Situação da conta              | `status`                                | Não (sempre ativa logado)  | Não                | —                                                         |
| Unidade e equipe               | `unitId`, `teamId` (só identificadores) | Não                        | Não                | API com nomes                                             |
| Identificador interno          | `id`, `companyId`                       | Não                        | Não                | —                                                         |
| Nome de exibição               | Não existe na conta                     | Não                        | Não                | Decisão MP-5 (API e, talvez, schema)                      |
| Telefone, foto, idioma, fuso   | Não existem                             | Não                        | Não                | Schema, migration e decisão                               |
| Dados do colaborador vinculado | `AccessUserColaborador` + colaborador   | Não                        | Não                | RBAC de autoatendimento (DP-23), API e decisão            |
| 2º fator da conta              | Só `mfaAvailable` (servidor)            | Não (fica no painel atual) | —                  | Segurança                                                 |
| Sessões                        | `GET /v1/auth/sessions`                 | Não (fica no painel atual) | —                  | Segurança                                                 |
| Senha                          | Só recuperação pública                  | Não                        | Não                | Segurança (rota nova com reautenticação)                  |

## 6. Matriz por papel

| Papel            | Hoje: entrada                         | Shell funcional | Troca de empresa | Meu Perfil proposto (MP-3) |
| ---------------- | ------------------------------------- | --------------- | ---------------- | -------------------------- |
| `rh`             | Dashboard                             | Sim             | Sim              | Pelo menu lateral          |
| `dp`             | Dashboard                             | Sim             | Não              | Pelo menu lateral          |
| `master_tecnico` | Dashboard (ou orientação sem empresa) | Sim             | Sim              | Pelo menu lateral          |
| `gestor`         | Minha equipe                          | Sim             | Não              | Pelo menu lateral          |
| `colaborador`    | Hub                                   | Não             | Não              | Pelo Hub                   |
| `financeiro`     | Hub                                   | Não             | Não              | Pelo Hub                   |
| `auditor`, `dpo` | Hub                                   | Não             | Não              | Pelo Hub                   |
| `admin_tecnico`  | Hub (bootstrap)                       | Não             | Não              | Pelo Hub                   |

`GET /v1/users/me` não exige papel; `own_account` vale para todos. Quem não tem empresa ativa
(`master_tecnico` em modo global) vê "nenhuma empresa ativa".

## 7. Contratos

| Contrato                 | Uso na 1ª fatia                                     | Muda?                       |
| ------------------------ | --------------------------------------------------- | --------------------------- |
| `GET /v1/users/me`       | Fonte de todos os campos exibidos                   | Não                         |
| Ator já carregado na web | Mesmo objeto do `AutenticacaoApp`; sem leitura nova | Não                         |
| Troca de empresa (T189)  | Remonta a árvore; Meu Perfil mostra a nova          | Não                         |
| Sessões e 2º fator       | Continuam nos painéis atuais                        | Não                         |
| Edição da própria conta  | Não existe                                          | Só com decisão (MP-5, MP-6) |

## 8. Possível agora × depende de decisão

**Possível agora, só na web, sem API, schema, RBAC, auditoria ou seed:**

- rota e destino de Configurações com o submódulo Meu Perfil;
- exibição de e-mail, papel, empresa ativa e data de criação da conta, a partir do ator já
  carregado;
- foco no título, URL própria, histórico, troca de empresa, gaveta a 375 px e acesso para todos
  os papéis autenticados.

**Depende de decisão e, em geral, de API, schema, RBAC ou auditoria:**

- nome de exibição (do colaborador vinculado ou campo próprio da conta);
- editar e-mail (identificador de login: verificação, unicidade, auditoria, sessões);
- trocar senha logado (rota nova com reautenticação, auditoria e revogação de sessões);
- foto, telefone, idioma, fuso e preferências (campos novos);
- estado do 2º fator da conta no perfil (contrato novo);
- dados do colaborador vinculado em autoatendimento (RBAC e privacidade);
- mudar "Segurança" e "Sessões ativas" da barra superior para dentro de Configurações.

## 9. Próximos submódulos (fora de escopo da T208)

- **Segurança:** 2º fator (cadastro existente; falta estado e desligamento próprio), sessões
  ativas (existente), troca de senha logado (inexistente), reautenticação (inexistente).
- **Empresas:** API `/v1/empresas` existente (`apps/api/src/organizacao/empresa/empresa.controller.ts`),
  sem tela; empresas autorizadas por conta (`AccessUserEmpresa`) sem rota de concessão.
- **Equipe e permissões:** "Contas de acesso" existente (papel único por conta, sem permissões
  granulares); Administração da liderança existente; não há tabela de permissões.

Cada um vira uma tarefa própria, só com ordem.

## 10. Menor primeira fatia proposta

**Configurações › Meu Perfil, somente leitura, só web:**

- rota `#/configuracoes/meu-perfil` (e `#/configuracoes` levando a ela), com título
  "Configurações", subtítulo próprio e trilha "Configurações › Meu perfil";
- navegação interna com o grupo "Sua conta" e um único item, **Meu perfil** — nenhum item sem
  tela;
- bloco "Conta de acesso": e-mail, papel, empresa ativa (nome e código, ou "nenhuma empresa
  ativa") e "conta criada em";
- texto honesto de que a edição dos dados da conta ainda não está disponível, sem botão
  desabilitado nem campo falso;
- entrada pelo menu lateral para quem tem shell e pelo Hub para os demais papéis (MP-3);
- sem leitura nova à API: usa o ator já carregado; a troca de empresa atualiza pela remontagem.

## 11. Acessibilidade, foco, guarda, troca de empresa, URL e 375 px

- Foco no título ao abrir, como os demais destinos; uma região viva só para mudanças relevantes.
- Sem edição na 1ª fatia, a guarda de edição pendente não se aplica; a guarda de saída existente
  continua valendo ao sair de outras telas para Configurações.
- URL própria e histórico (voltar e avançar), com rota inválida corrigida no lugar.
- Troca de empresa: a remontagem já atualiza a empresa ativa exibida.
- 375 px: gaveta do menu existente; a navegação interna passa a ficar acima do conteúdo, sem
  rolagem horizontal; alvos de 44 px.

## 12. Riscos

- **"Perfil" já significa papel no Hub** (`HubPosLogin.tsx:327`): ao lado de "Meu perfil", o mesmo
  termo com dois sentidos confunde (MP-8).
- **"Segurança" já é um botão da barra superior:** um submódulo futuro com o mesmo nome deve
  absorvê-lo, não duplicá-lo (MP-7).
- **Expectativa de edição:** um perfil sem edição pode parecer incompleto; o texto honesto e a
  ausência de controles falsos reduzem o risco.
- **Nome ausente:** sem nome na conta, o cabeçalho do perfil usa o e-mail; inventar nome viola a
  regra de só dado real.

## 13. Decisões para aprovação

| Id   | Decisão                    | Recomendação                                                                                                | Alternativas                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| MP-1 | Escopo da 1ª fatia         | Meu Perfil **somente leitura**, só web, com `/users/me`                                                     | Incluir edição (exige API, schema ou RBAC)    |
| MP-2 | Lugar de Configurações     | Item próprio no menu lateral, separado dos grupos de trabalho, com rota `#/configuracoes/meu-perfil`        | Dentro do grupo Administração; só pelo Hub    |
| MP-3 | Quem acessa                | Todos os papéis autenticados: pelo menu quem tem shell; pelo Hub os demais                                  | Só papéis com shell                           |
| MP-4 | Campos exibidos            | E-mail, papel, empresa ativa e conta criada em; sem identificadores internos, situação, unidade e equipe    | Incluir unidade e equipe (exige nomes na API) |
| MP-5 | Nome de exibição           | Fora da 1ª fatia; decidir depois entre o nome do colaborador vinculado (DP-23) e um campo próprio da conta  | Decidir agora                                 |
| MP-6 | Edição de e-mail e senha   | Fora da 1ª fatia; senha vai para Segurança; e-mail só com fluxo de verificação aprovado                     | Edição de e-mail já na T208                   |
| MP-7 | Segurança e Sessões ativas | Permanecem nos painéis atuais da barra superior; migram para Configurações › Segurança no submódulo próprio | Mover já na T208                              |
| MP-8 | Rótulo "Perfil" no Hub     | Trocar por "Papel" no Hub, para não colidir com "Meu perfil"                                                | Manter                                        |

## 14. Fora de escopo desta preparação

Código de produto, API, schema, migration, RBAC, auditoria, seed, Docker, dependências, lockfile,
workflow, push, PR, promoção e merge; Segurança, Empresas e Equipe e permissões (seção 9).

## 15. Decisões aprovadas

As decisões MP-1 a MP-8 foram aprovadas em 2026-11-12 como recomendadas na seção 13, sem
alternativa. A implementação seguiu esse recorte; nenhuma decisão nova foi tomada nela.

## 16. Implementação

- **Rota:** `#/configuracoes/meu-perfil`, na tabela fechada de rotas do shell
  (`apps/web/src/app/rotasDoShell.ts`). O atalho `#/configuracoes` abre a mesma tela, e a URL é
  corrigida no lugar para a forma canônica. Qualquer outro caminho em `#/configuracoes/` não é
  rota.
- **Quem acessa (MP-3):** o destino `configuracoes` entra na capacidade de todos os nove papéis
  conhecidos (`apps/web/src/app/mapaNavegacao.ts`); papel desconhecido continua sem destino
  nenhum. Quem tem o shell vê o item no menu; os demais papéis, o cartão no Hub.
- **Menu (MP-2):** grupo próprio da conta, numa lista separada, abaixo dos módulos de trabalho e
  acima de Demonstração, com ícone próprio. No menu recolhido vira ícone do trilho com a dica;
  na gaveta do celular, escolher o item fecha a gaveta.
- **Tela (MP-1, MP-4):** `apps/web/src/screens/configuracoes/MeuPerfilScreen.tsx`, somente
  leitura. Trilha "Configurações › Meu perfil", título "Configurações", navegação interna com um
  único item ("Meu perfil", atual) e quatro dados: e-mail de acesso, papel (pelo rótulo), empresa
  ativa (nome e código, ou "Nenhuma empresa ativa") e data de criação da conta (só a data). Um
  aviso diz que a edição ainda não está disponível. Não há botão, campo, item inativo nem
  identificador interno, CPF, contato, dado de colaborador, foto, telefone, idioma ou
  preferência.
- **Dados:** os quatro valores vêm da sessão já carregada por `GET /v1/users/me`; a tela não faz
  chamada nova.
- **Foco:** quando a tela abre com o pedido de foco do shell ou sem nada focado (recarga), o
  título recebe o foco; quem chega pelo menu mantém o foco no item do menu. O `main` é nomeado
  pelo título.
- **Hub (MP-8):** o rótulo "Perfil" passou a "Papel", e os textos de apoio dizem "seu papel".
- **Segurança e Sessões ativas (MP-7):** continuam nos painéis da barra superior, sem mudança.
- **Gaveta do celular (defeito anterior, da T206):** a gaveta não tinha altura presa à tela,
  porque o navegador aplica a caixas fixas o `align-self: flex-start` do desktop; ela crescia
  com o conteúdo e o pé do menu (Configurações e Demonstração) ficava fora de alcance a 375 px.
  A regra móvel da barra lateral ganhou `align-self: stretch`
  (`apps/web/src/app/app-shell.css`); a gaveta passa a ter a altura da tela e rola.

## 17. Achados da validação no navegador

Com dados sintéticos do seed local, a validação no navegador encontrou três defeitos; cada um foi
corrigido com teste que falha antes e com mutação própria:

1. Na recarga da rota, o foco ficava no documento, e não no título.
2. O item atual da navegação interna tinha o mesmo tom do fundo da página e não se distinguia;
   ganhou fundo de contraste, borda de ação à esquerda e peso de texto.
3. A gaveta do celular crescia além da altura da tela (seção 16).

Depois das correções, a validação confirmou:

- **RH:** item no menu, na lista da conta, marcado como atual; os quatro dados; nenhum controle;
  voltar e avançar; recarga com foco no título; a 375 px, sem rolagem horizontal e com alvo de
  44 px; gaveta com a altura da tela, rolável, que fecha ao escolher Configurações e devolve o
  foco ao botão Menu; Hub com "Papel" e o cartão de Configurações.
- **Master técnico:** sem empresa, "Nenhuma empresa ativa"; ao trocar de empresa pelo seletor, a
  tela é remontada em Meu perfil, com anúncio e foco no título.
- **Gestor:** item no menu e dados corretos.
- **Colaborador:** Hub só com o cartão de Configurações; abre pelo teclado, com foco no título;
  nenhum dado proibido.
- **Menu recolhido:** ícone no trilho, com dica e marcação de atual.
- **URL:** caminho inválido leva ao destino inicial do papel; `#/configuracoes` vira a rota
  canônica.

## 18. Evidências

- **Testes novos (68):** rota e atalho (10); tela, dados proibidos, ausência de controles e CSS
  (21); shell com todos os papéis, menu, histórico, recarga, foco, link de pular, teclado, menu
  recolhido, gaveta, CSS da gaveta e guarda de saída (32); sessão, Hub, master com e sem
  empresa e troca de empresa (5). Testes existentes de menu, Hub e shell foram ajustados ao
  novo grupo, ao novo cartão e ao rótulo "Papel".
- **Mutações:** 22, todas detectadas (rota, atalho, capacidade por papel, menu, título e foco,
  conta da sessão, rótulo do Hub, conteúdo da tela, dado proibido, botão inativo, item
  decorativo, gaveta e CSS de 375 px).
- **Bateria local:** web 133 arquivos, 3725 testes; API unitária 60 suítes, 1472 testes; E2E
  serial com PostgreSQL real 20 suítes, 1017 testes; scripts 182 testes; lint sem aviso,
  typecheck, build, Prettier, `spec:check`, prévia do squash e `git diff --check` verdes.

## 19. Limites

- **Fragmento desconhecido na URL:** um caminho que não é rota leva ao destino inicial do papel,
  mas, quando esse destino não tem rota própria, o fragmento digitado permanece na barra de
  endereço. É o comportamento anterior à T208, não alterado.
- **Sem edição:** nome de exibição (MP-5), e-mail e senha (MP-6) seguem fora; Segurança, Empresas
  e Equipe e permissões continuam só inventariados (seção 9).
- **Gaveta do celular:** a correção da seção 16 vale para todo o menu móvel, não só para
  Configurações.

## 20. Validação final

- **Validação visual:** aprovada pela validação humana em 2026-11-12, na prévia local com dados
  sintéticos, sobre o código desta branch (seção 17).
- **Perfis e cenários verificados no navegador:** RH (menu, voltar e avançar, recarga, 375 px,
  gaveta do celular, Hub); master técnico sem empresa e com empresa, com troca pelo seletor;
  gestor (menu); colaborador (Hub e teclado); menu recolhido; URL inválida e atalho
  `#/configuracoes`. Os nove papéis conhecidos e o papel desconhecido estão cobertos nos testes
  (seção 18).
- **Correções encontradas na validação:** as três da seção 17 (foco na recarga, item atual da
  navegação interna e gaveta do celular), cada uma com teste que falha antes e mutação própria.
- **Decisões:** MP-1 a MP-8 conferidas no código e sem alteração desde a preparação: tela sem
  chamada nova e sem mudança na API (MP-1); rota própria (MP-2); os nove papéis com o destino
  (MP-3); só os quatro dados (MP-4); nenhum campo, botão ou controle de edição (MP-5, MP-6);
  Segurança e Sessões ativas intocadas (MP-7); "Papel" no Hub (MP-8).
- **Limites conhecidos:** os da seção 19.
- **Contagens finais:** as da seção 18, refeitas no HEAD final da branch: web 133 arquivos,
  3725 testes; API unitária 60 suítes, 1472 testes; E2E serial com PostgreSQL real 20 suítes,
  1017 testes; scripts 182 testes; 22 mutações, todas detectadas.
