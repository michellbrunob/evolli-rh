# T208 — Configurações: Meu Perfil (dossiê de preparação)

- **Estado:** em implementação, **ampliada antes do Ready por decisão de produto** (seção 21). A
  entrega segue na PR #201, em Draft, sem Ready for review e sem merge. O Meu Perfil somente
  leitura das seções 16 a 20 (validado localmente, validação visual aprovada em 2026-11-12) é a
  **base existente, não a entrega final**. As decisões MPA-1 a MPA-11 (seção 21.8) foram
  aprovadas em 2026-11-12, com a MPA-5 corrigida (seção 22). A ampliação — nome de exibição
  editável, com migration, `PATCH /v1/users/me` e auditoria — está **implementada e validada
  localmente** (seções 23 a 26), em commits locais, sem push: a PR #201 ainda aponta para o código
  anterior à ampliação. Aguarda a validação visual humana. A **foto de perfil** é uma ampliação
  **em preparação** (seção 27): só levantamento, decisões FP-1 a FP-8 aguardando aprovação, nada
  implementado. As decisões MP-1 a MP-8 da seção 13 seguem sem alteração.
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

A última coluna registra a proposta de preparação. O comportamento implementado está na seção
16: os nove papéis têm o cartão no Hub e, depois da entrada no shell, o item no menu lateral.

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
- entrada pelo menu lateral para quem tem shell e pelo Hub para os demais papéis (MP-3; na
  implementação, os nove papéis têm o cartão no Hub e o item no menu, seção 16);
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

Sobre a redação de MP-3: a decisão aprovada ("pelo menu quem tem shell; pelo Hub os demais")
não muda. Como toda sessão passa pelo Hub antes do shell, salvo quando abre por uma rota
conhecida na URL, a entrada fica assim para todos os papéis autenticados: o cartão no Hub e,
depois da entrada no shell, o item no menu lateral (seção 16).

## 16. Implementação

- **Rota:** `#/configuracoes/meu-perfil`, na tabela fechada de rotas do shell
  (`apps/web/src/app/rotasDoShell.ts`). O atalho `#/configuracoes` abre a mesma tela, e a URL é
  corrigida no lugar para a forma canônica. Qualquer outro caminho em `#/configuracoes/` não é
  rota.
- **Quem acessa (MP-3):** o destino `configuracoes` entra na capacidade de todos os nove papéis
  conhecidos (`apps/web/src/app/mapaNavegacao.ts`); papel desconhecido continua sem destino
  nenhum. Os nove papéis acessam Configurações pelo cartão no Hub; depois da entrada no shell,
  o item Configurações também está no menu lateral. Para `financeiro`, `colaborador`,
  `auditor`, `dpo` e `admin_tecnico`, Configurações é o único cartão do Hub; para `rh`, `dp`,
  `master_tecnico` e `gestor`, aparece junto dos outros módulos.
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
- **Entrega:** PR Draft #201 contra `main`; Ready for review e merge só com ordem.
- **Contagens finais:** as da seção 18, refeitas no HEAD final da branch: web 133 arquivos,
  3725 testes; API unitária 60 suítes, 1472 testes; E2E serial com PostgreSQL real 20 suítes,
  1017 testes; scripts 182 testes; 22 mutações, todas detectadas.

## 21. Ampliação de Meu Perfil (levantamento, 2026-11-12)

### 21.1 Decisão e estado

- **Ampliação antes do Ready:** por decisão de produto, a T208 foi ampliada antes de ir para
  revisão. Meu Perfil passa a mirar uma tela de perfil com dados de exibição, contato e formas de
  entrada, e não só a consulta das seções 16 a 20.
- **PR #201:** continua em Draft. Nada desta seção foi implementado; esta etapa é só levantamento
  e proposta.
- **Base existente:** o Meu Perfil somente leitura (rota, menu, Hub, quatro dados, foco, 375 px) é
  a base sobre a qual a ampliação será construída. Não é a entrega final da T208.
- **Referência visual:** a experiência proposta usou como inspiração apenas material visual
  privado, consultado localmente. Ele não é registrado, descrito nem citado no repositório; tudo
  aqui usa só identidade, componentes, textos e dados do Evolli.

### 21.2 Experiência proposta (padrões do Evolli)

- Cabeçalho com trilha "Configurações › Meu perfil", título e descrição; navegação interna à
  esquerda, em grupos, só com itens que têm tela (regra das seções 4 e 16).
- O painel de Meu Perfil em seções com título e descrição curta; dentro delas, linhas de rótulo
  (com ajuda) à esquerda e valor ou campo à direita, separadas por divisores; uma coluna abaixo
  de 720 px.
- Rodapé de ações do painel com a data da última alteração do perfil e as ações de descartar e
  salvar, ativas só com mudança pendente e integradas à guarda de saída (T200).
- Campo indisponível não vira controle falso: ou fica fora da tela, ou aparece como texto que diz
  por quê (regra de MP-1 mantida).

### 21.3 Mapa de dados por domínio

| Item                  | Domínio               | Existe hoje                                                                                                                 | Dado real hoje                              | Para exibir ou editar                                                                   |
| --------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Nome de exibição      | Conta                 | Não: `AccessUser` não tem nome (`schema.prisma:57-70`)                                                                      | Não                                         | Coluna nova, migration, rota de edição, auditoria                                       |
| Nome civil            | Colaborador           | `Colaborador.nome`, mantido pelo RH                                                                                         | Sim, só para `rh`, `dp`, `master`           | Vínculo conta↔colaborador (DP-23) e leitura de autoatendimento, hoje inexistente        |
| Foto                  | Conta ou colaborador  | Não: não há storage nem upload no repositório (`documentos.module.ts:12-19`)                                                | Não                                         | Storage, validação de arquivo, retenção e LGPD; tarefa própria                          |
| Cargo                 | Colaborador (lotação) | `AlocacaoOrganizacional.cargoId`, por empresa (`schema.prisma:1143-1188`)                                                   | Sim, mantido pelo RH                        | Leitura de autoatendimento pelo vínculo DP-23; nunca edição pela própria pessoa         |
| Telefone              | Colaborador           | `ContatoColaborador.celular`/`telefone`, por empresa, com trilha LGPD (`schema.prisma:2134`)                                | Sim, mantido pelo RH                        | Na conta não existe; exigiria coluna e finalidade                                       |
| E-mail de acesso      | Autenticação e conta  | `AccessUser.email`, único, identificador de login                                                                           | Sim (já exibido)                            | Troca exige verificação, unicidade, auditoria e sessões; nenhuma rota troca e-mail hoje |
| Confirmação de e-mail | Autenticação          | Não: sem registro de verificação; o envio usa `NoopEmailNotifier`, que não envia nada (`noop-email-notifier.service.ts:12`) | Não                                         | Provedor de e-mail, token de verificação, estado na conta                               |
| Data de alteração     | Conta                 | `AccessUser.updatedAt`, que muda também com senha, papel e desativação (`@updatedAt`)                                       | Não serve como alteração do perfil          | Coluna própria (`perfil_atualizado_em`)                                                 |
| Senha                 | Autenticação          | Só recuperação pública (`auth.controller.ts:284-301`); política de 15 caracteres no mínimo (`password-policy.service.ts:7`) | Sim (só o hash)                             | Rota autenticada de troca, com senha atual, revogação de sessões e auditoria nova       |
| Google                | Autenticação          | Não: só a interface prevista para OIDC/SSO futuro (`credential-verifier.interface.ts:11`)                                   | Não                                         | Integração OIDC completa; tarefa própria                                                |
| Segundo fator (TOTP)  | Autenticação          | Cadastro e confirmação (`mfa.controller.ts:48-76`); `AccessMfaTotp` com estado por conta (`schema.prisma:282`)              | No banco; o contrato só traz `mfaAvailable` | Contrato de estado por conta e desligamento próprio                                     |
| Sessões               | Autenticação          | `GET`/`DELETE /v1/auth/sessions` (`auth.controller.ts:161-232`); painel da barra superior                                   | Sim                                         | Só mudança de lugar (Segurança)                                                         |
| Papel                 | Conta                 | `AccessUser.role`; ninguém altera o próprio (`rbac.evaluator.ts:190-194`)                                                   | Sim (já exibido)                            | Nunca editável aqui                                                                     |
| Empresa ativa         | Sessão e empresa      | `AccessSession.empresaAtivaId`; troca da T189                                                                               | Sim (já exibida)                            | A troca segue no seletor                                                                |

### 21.4 Restrições transversais

- **Privacidade e LGPD:** nome de exibição, foto e telefone são dados pessoais. Coletar exige
  finalidade clara e necessidade (minimização); a conta hoje guarda só o e-mail. Telefone e
  cargo já existem no colaborador, sob regras e trilha do RH; copiá-los para a conta criaria duas
  fontes do mesmo dado.
- **Auditoria:** a trilha é só acréscimo e sem conteúdo antes/depois (`schema.prisma:594-641`).
  `AuditAction` tem senha, sessões e 2º fator, mas **não tem** evento de edição do próprio
  perfil; edição nova exige valor novo no enum (migration).
- **Confirmação de e-mail:** impossível hoje: não há provedor de e-mail integrado (a recuperação
  de senha gera o token, mas o e-mail não sai). Nenhuma tela pode afirmar que o e-mail foi
  confirmado.
- **Upload de foto:** bloqueado por construção no repositório (Documentos é só metadado, ADR
  0011); exige storage, tipo e tamanho validados, retenção e exclusão.
- **Alteração de senha:** não há rota autenticada nem reautenticação em uso (`reauthenticatedAt`
  só é gravado ao criar a sessão, `session.service.ts:81`). A redefinição pública já revoga todas
  as sessões e audita (`auth.service.ts:335`); a troca logada deve seguir o mesmo padrão.
- **RBAC:** `own_account` já permite `read` e `manage` só sobre a própria conta
  (`rbac.evaluator.ts:73-85`), mas nenhuma rota usa `manage`. Papel, e-mail, empresa e situação
  não podem ser alterados pela própria pessoa.
- **Isolamento por empresa:** a conta é global à pessoa, não por empresa; colaborador, cargo e
  contatos são por empresa. Dado da conta não pode trazer dado de colaborador de outra empresa,
  e a listagem administrativa (`GET /v1/users`) não deve ganhar dados de perfil sem decisão.
- **Sessões:** a edição de dados de exibição não precisa revogar sessões; troca de senha e de
  e-mail precisam.

### 21.5 O que existe, o que exige contrato novo e o que fica indisponível

- **Com dados reais hoje, sem contrato novo:** e-mail de acesso, papel, empresa ativa e data de
  criação da conta (a base atual); sessões e cadastro do 2º fator, nos painéis atuais.
- **Exige contrato novo (API, schema, migration, auditoria):** nome de exibição; data da última
  alteração do perfil; estado do 2º fator por conta; troca de senha logada; leitura do cargo ou
  do nome civil pelo vínculo DP-23.
- **Indisponível até integração externa ou decisão própria:** foto (storage); confirmação e troca
  de e-mail (provedor de e-mail); entrada com Google (OIDC); telefone na conta (sem finalidade).

### 21.6 Primeira fatia funcional proposta

**Meu Perfil com nome de exibição editável**, sobre a base atual:

- **API:** migration que acrescenta a `access_user` duas colunas opcionais, `nome_exibicao` e
  `perfil_atualizado_em`, e um valor novo em `AuditAction` para a edição do próprio perfil;
  `PATCH /v1/users/me` com `own_account`/`manage`, alvo sempre a conta da sessão, lista fechada
  de campos (só o nome de exibição), validação (aparar espaços, 2 a 80 caracteres, vazio limpa o
  nome) e concorrência otimista pela data da última alteração (409 em conflito);
  `GET /v1/users/me` passa a devolver o nome de exibição e a data da última alteração; a
  listagem administrativa não muda.
- **Web:** a tela reorganizada nas seções da 21.2 (dados de exibição, contato de acesso e formas
  de entrada), com o nome de exibição editável, iniciais no lugar da foto, e-mail só leitura,
  papel, empresa ativa e criação; rodapé com a última alteração e as ações de descartar e
  salvar; guarda de saída, foco, erros por campo e 375 px.
- **Testes:** unitários (DTO, avaliador e serviço: só a própria conta, campos fora da lista
  recusados, conflito); E2E com PostgreSQL real para todos os papéis (edita a própria conta; não
  altera papel, e-mail, empresa ou situação; CSRF; conta inativa; auditoria gravada sem
  conteúdo; conflito); smoke da migration; web com todos os papéis, guarda de saída, conflito e
  375 px; mutações dos pontos novos.

### 21.7 Verificações necessárias para a fatia

Bateria completa (web, API unitária, E2E serial com PostgreSQL, scripts), smoke da migration em
banco vazio, mutações dos pontos novos, validação no navegador com dados sintéticos para papéis
com e sem empresa ativa, e revisão de privacidade (o nome de exibição não aparece na listagem
administrativa nem em log).

### 21.8 Decisões para aprovação

| Id     | Tema                               | Recomendação                                                                                                                                                                                                                        | Alternativa                                                                   |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| MPA-1  | Nome de exibição                   | Campo próprio da conta, opcional, 2 a 80 caracteres, editável pela própria pessoa; sem nome, a tela usa o e-mail                                                                                                                    | Nome civil do colaborador vinculado, só leitura (não cobre conta sem vínculo) |
| MPA-2  | Foto                               | Indisponível: iniciais do nome de exibição (ou do e-mail), sem botão de envio                                                                                                                                                       | Upload em tarefa própria, com storage e política de retenção                  |
| MPA-3  | Cargo                              | Fora de Meu Perfil: é dado da lotação, mantido pelo RH e por empresa                                                                                                                                                                | Exibir só leitura o cargo do vínculo DP-23 na empresa ativa (contrato novo)   |
| MPA-4  | Telefone                           | Fora: a conta não tem telefone nem finalidade para ele; o contato do colaborador segue com o RH                                                                                                                                     | Coluna de telefone na conta, com finalidade definida                          |
| MPA-5  | E-mail e confirmação               | Só leitura e indisponível para alteração até existir fluxo próprio com verificação; sem selo de confirmação                                                                                                                         | Troca com verificação por e-mail, depois de integrar um provedor              |
| MPA-6  | Senha                              | Em Segurança, tarefa própria: troca logada com senha atual, política vigente, revogação das outras sessões e auditoria nova                                                                                                         | Troca logada já na T208                                                       |
| MPA-7  | Google                             | Indisponível e não exibido (sem OIDC)                                                                                                                                                                                               | Linha informativa de indisponibilidade                                        |
| MPA-8  | Segundo fator                      | Continua no painel atual; estado por conta e desligamento próprio vão para Segurança                                                                                                                                                | Mostrar o estado em Meu Perfil (contrato novo)                                |
| MPA-9  | Sessões                            | Continuam no painel atual; vão para Segurança na tarefa própria                                                                                                                                                                     | Mover já na T208                                                              |
| MPA-10 | Permissões, auditoria e isolamento | `PATCH /v1/users/me` com `own_account`/`manage`, sem id na URL, lista fechada de campos, concorrência otimista, evento de auditoria novo sem conteúdo; nome de exibição global da conta e fora da listagem administrativa           | Expor o nome de exibição também em Contas de acesso                           |
| MPA-11 | Meu Perfil × Segurança             | Meu Perfil: dados de exibição e da conta (nome, iniciais, e-mail, papel, empresa, datas) e, em formas de entrada, só o texto "e-mail e senha". Segurança (senha, 2º fator, sessões): submódulo próprio, no menu interno só com tela | Formas de entrada inteiras só em Segurança                                    |

Aprovadas, as decisões levam a fatia da 21.6 para dentro da T208, que passa a incluir API,
schema, migration, RBAC (uso de `own_account`/`manage`) e auditoria; sem a aprovação, nada disso
começa.

### 21.9 Fora de escopo desta etapa

Implementação de qualquer item da 21.6; produto, API, schema, migration, RBAC, banco, seed,
Docker, dependências, lockfile e workflows; Ready for review e merge.

## 22. Aprovação da ampliação (2026-11-12)

As decisões MPA-1 a MPA-11 foram aprovadas em 2026-11-12, com uma correção: **MPA-5** passa a
dizer que o e-mail é somente leitura e fica indisponível para alteração até existir fluxo próprio
com verificação. Nenhuma tela afirma que a administração consegue trocá-lo (nenhuma rota faz
isso hoje, seção 21.3).

Escopo funcional aprovado para a ampliação:

1. **Nome de exibição:** campo próprio da conta, opcional. Sem valor, a interface usa o e-mail.
   Preenchido, exige texto real de 2 a 80 caracteres após normalização e remoção de espaços nas
   extremidades; valor vazio limpa o nome e restaura o e-mail. A pessoa só edita o próprio.
2. **Persistência e concorrência:** colunas próprias da conta para o nome de exibição e a data da
   última alteração do perfil; migration, contrato, serviço e `PATCH /v1/users/me`, que aceita só
   o nome de exibição, com concorrência otimista (conflito compreensível, sem sobrescrever edição
   concorrente). A data da última alteração do perfil muda só quando o perfil é salvo, não em
   troca de senha, papel ou desativação. Evento de auditoria próprio, sem o conteúdo do nome.
3. **Meu Perfil na web:** seções de identificação, contato e formas de entrada; iniciais no lugar
   da foto, sem envio de arquivo; o nome de exibição é o único campo editável; e-mail, papel,
   empresa ativa, criação da conta e última alteração são dados reais, só leitura; cargo e
   telefone não aparecem; formas de entrada mostram só "e-mail e senha" (sem Google, segundo
   fator ou sessões); rodapé de edição com descartar e salvar só quando há alteração; guarda de
   saída que não pergunta com o formulário limpo, pergunta com o nome alterado e bloqueia a
   saída durante o salvamento; navegação interna só com Meu perfil.
4. **Permissões e isolamento:** `own_account` é a única permissão para editar o próprio perfil;
   todos os papéis só alteram a própria conta; empresa, papel, e-mail e identificadores internos
   não mudam por esta rota; o nome é global da conta, não por empresa, e não entra na listagem
   de Contas de acesso.
5. **Fora:** foto, cargo, telefone, alteração de e-mail, senha, Google, segundo fator e sessões;
   dependências, lockfile, Docker e workflows.

## 23. Implementação da ampliação

- **Migration aditiva** `20261112120000_perfil_proprio_conta`:
  - `access_user.nome_exibicao`, opcional, com CHECK de 2 a 80 caracteres e sem espaço nas
    extremidades;
  - `access_user.perfil_atualizado_em`, opcional;
  - o valor `conta.perfil.atualizado` em `AuditAction`.

  Contas existentes ficam sem nome e sem data. Nenhum privilégio muda.

- **`PATCH /v1/users/me`** (`apps/api/src/users/users.controller.ts`):
  - `own_account`/`manage` é a única permissão, com CSRF;
  - a rota não tem `:id`, então o alvo é sempre a conta da sessão;
  - o corpo aceita só `nomeExibicao` e `perfilAtualizadoEmLido`. Este segundo campo não é dado do
    perfil: é a versão que a tela leu, a pré-condição da concorrência otimista;
  - qualquer outro campo (id, e-mail, papel, empresa, situação) é recusado com 400.
- **Normalização** (`apps/api/src/users/perfil/nome-exibicao.util.ts`):
  - forma NFC, espaços juntados e aparados;
  - vazio limpa o nome;
  - 2 a 80 caracteres contados por caractere, ao menos uma letra, nenhum caractere de controle ou
    invisível.
- **Concorrência:** a condição de versão vai no próprio `UPDATE`. Versão velha ou gravação
  simultânea respondem 409, e nada é sobrescrito.
- **`perfilAtualizadoEm`** muda só quando a própria pessoa salva o perfil.
- **Auditoria:** evento `conta.perfil.atualizado`, na mesma transação, sem o conteúdo do nome (a
  trilha não tem campo de conteúdo).
- **Projeções:** `GET /v1/users/me` passa a devolver `nomeExibicao` e `perfilAtualizadoEm`.
  `toSafeUser`, usado pela listagem de Contas de acesso, não os carrega.
- **Tela** (`apps/web/src/screens/configuracoes/MeuPerfilScreen.tsx`), em três seções:
  - **Identificação:** iniciais no lugar da foto, sem envio de arquivo; nome de exibição
    editável; papel; empresa ativa; criação da conta; última alteração do perfil;
  - **Contato:** e-mail de acesso, só leitura, com o aviso de que a alteração ainda não está
    disponível;
  - **Formas de entrada:** só "e-mail e senha".

  Cargo, telefone, Google, segundo fator e sessões não aparecem. Sem nome, a tela usa o e-mail.

- **Edição:**
  - rodapé com Descartar e Salvar só quando o nome normalizado difere do salvo;
  - validação espelhada antes de enviar;
  - conflito (409) com o texto mantido e a opção de carregar os dados atuais;
  - sessão encerrada (401) com aviso para entrar de novo;
  - demais falhas em alerta;
  - sucesso anunciado uma vez, na região de status.
- **Guarda de saída:**
  - limpo, sair não pergunta;
  - alterado, pergunta (menu, Hub e a confirmação do seletor de empresa);
  - salvando, a saída fica bloqueada.
- **Sessão:** o ator devolvido pelo servidor substitui o da sessão; mesma conta e empresa, então
  a árvore não remonta. Navegação interna só com Meu perfil. Cartão do Hub com a descrição nova.

## 24. Achados da validação no navegador (ampliação)

Validação com dados sintéticos do seed local e o banco local migrado. Cada achado foi corrigido
com teste que falha antes e mutação própria:

1. **Linhas pela largura da janela.** A 1024 px, com o menu aberto, o painel tinha 443 px, e a
   regra de duas colunas espremia o campo do nome em 129 px. As linhas passaram a depender da
   largura do próprio painel (consulta de contêiner, 40rem).
2. **Token CSRF renovado por outra aba.** Com duas abas da mesma sessão, salvar na aba com a
   versão antiga caía em falha genérica (403), em vez de chegar ao conflito. O cliente agora
   descarta o token, renova e reenvia uma vez; reenviar com a mesma versão é seguro.
3. **Sessão encerrada.** Achado na revisão da própria entrega: o 401 mostrava a falha genérica,
   que manda tentar de novo. Passou a dizer para entrar de novo.

Depois das correções, a validação confirmou:

- **RH:**
  - nome salvo normalizado, com anúncio, rodapé recolhido e foco no campo;
  - a guarda pergunta ao sair com o nome alterado, e "Continuar editando" mantém o texto;
  - recarga com o nome persistido e o foco no título;
  - erro de tamanho pelo teclado;
  - conflito entre duas abas, com "Carregar os dados atuais";
  - a 375 px, sem rolagem horizontal, botões de 44 px e rodapé preso ao pé.
- **Colaborador:** Hub só com o cartão Configurações e a descrição nova; abre pelo teclado com
  foco no título; salva o próprio nome.
- **Master técnico sem empresa:** "Nenhuma empresa ativa"; salva o nome.
- **Master técnico com empresa:** com o nome alterado, a troca para a Alfa pede confirmação no
  seletor; "Trocar e descartar" volta com o nome salvo e a empresa nova.
- **Gestor:** abre pelo menu e salva o nome.

## 25. Evidências da ampliação

- **API:**
  - unitários: 39 testes novos (`users/perfil/perfil-proprio.spec.ts`);
  - E2E com PostgreSQL real: suíte nova `perfil-proprio`, com 29 testes. Cobre migration sem
    diferença para o schema, CHECK do banco, os nove papéis, normalização, limpeza, tamanho,
    rota de outra conta, campos proibidos, CSRF e sessão, conflito e gravação simultânea, a data
    do perfil intocada por papel/senha/desativação, conta desativada, nome global na troca de
    empresa e ausência na listagem.
- **Web:**
  - tela: 46 testes;
  - shell: mais 3 de guarda de saída;
  - sessão: mais 3 (ator atualizado sem remontar, recarga, troca de empresa com confirmação);
  - cliente: mais 4 (PATCH, 409, reenvio no CSRF renovado, 403 sem código);
  - Hub: descrição atualizada.
- **Mutações:** 58, todas detectadas: 22 da base (alvos atualizados para a tela nova),
  13 da API, 1 do banco e 22 da web da ampliação.
- **Bateria local:**
  - web 133 arquivos, 3760 testes;
  - API unitária 61 suítes, 1511 testes;
  - E2E serial com PostgreSQL real 21 suítes, 1046 testes;
  - scripts 182 testes;
  - lint sem aviso, typecheck, build, Prettier, `spec:check`, prévia do squash e
    `git diff --check` verdes.

## 26. Limites da ampliação

- **Versão no corpo:** além do nome de exibição, o corpo do `PATCH` leva a versão lida. É a
  pré-condição de concorrência, não um dado alterável.
- **Menu do shell para papéis sem capacidade de trabalho** (anterior à T208, sem mudança):
  - Colaboradores, Estrutura, Jornada e Contas de acesso aparecem para financeiro, colaborador,
    auditor, DPO e administração técnica, e o servidor recusa as leituras;
  - antes, esses papéis já chegavam ao shell pelos itens de Demonstração do Hub; a T208 torna o
    caminho mais comum.

  Corrigir isso muda a navegação de outros papéis e exige decisão própria.

- **Fora desta entrega:** foto, cargo, telefone, alteração de e-mail, senha, Google, segundo fator
  e sessões continuam fora (seção 22).
- **Banco local:** a migration foi aplicada no banco local da prévia para a validação no
  navegador. Isso não é artefato versionado.

## 27. Foto de perfil — levantamento (em preparação, 2026-11-13)

Etapa só de leitura e documentação: nenhum código, schema, migration, dependência ou
configuração foi alterado. A PR #201 continua em Draft. A foto de perfil é uma ampliação
**em preparação** dentro da T208; as decisões FP-1 a FP-8 (27.9) aguardam aprovação.

### 27.1 O que existe hoje

- **Nenhum armazenamento de arquivo em uso.**
  - Documentos é só metadado: "nenhum controller ou service de upload, conteúdo, versão de
    arquivo ou storage existe" (`apps/api/src/documentos/documentos.module.ts:12-19`; ADR 0011).
  - Não há dependência de cliente S3, de processamento de imagem nem de detecção de tipo de
    arquivo (`apps/api/package.json`, `apps/web/package.json`).
  - O `multer` só chega como dependência indireta de `@nestjs/platform-express`, sem tipos
    declarados no projeto.
- **Cloudflare R2 aprovado, mas só para conteúdo documental e ainda fechado** (ADR 0013,
  `docs/adr/0013-armazenamento-privado-cloudflare-r2.md`). Ele depende dos portões de Nível 2
  ainda abertos (`docs/decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md`, tabela
  "Nível 2"):
  - credencial de armazenamento (`DP-2E-04`);
  - limites técnicos (`DP-2E-05`);
  - antivírus e quarentena (`DP-2E-09`);
  - acesso a conteúdo (`DP-2E-13`);
  - retenção e descarte do conteúdo (`DP-2E-15`);
  - MFA obrigatório.

  O `plan.md` (seção 10, item 3) manda manter "anexos, upload, R2" fora de qualquer fatia até
  esses portões fecharem.

- **Regra de introdução de infraestrutura:** "Não introduzir IdP, SSO, Redis, fila, storage ou
  outro provedor por antecipação: cada decisão material exige ADR" (`.specify/plan.md`, seção 2).
- **Regra de dado pessoal:** foto só entra com "finalidade, acesso restrito, auditoria, retenção e
  contrato" declarados (`.specify/execution-status.md`, decisões do cadastro; `.specify/tasks.md`,
  mesma regra).
- **Sessão:** cada requisição autenticada carrega a linha inteira da conta (`include: { user:
true }`, `apps/api/src/auth/session/session.service.ts:93-95`). Bytes de imagem na própria
  `access_user` iriam junto em toda requisição.
- **Entrega HTTP:**
  - o `helmet` padrão já envia `X-Content-Type-Options: nosniff` e
    `Cross-Origin-Resource-Policy: same-origin` (`apps/api/src/main.ts:23`);
  - o corpo JSON tem o limite padrão do Nest (100 kB), sem configuração própria;
  - a web chama a API pela mesma origem.
- **Backup:** o runbook usa `pg_dump` do banco inteiro (`infra/postgres/runbook-backup-restore.md`).
  A retenção de backups é decisão pendente da Etapa 0
  (`docs/decisions/etapa0-seguranca-operacional-pendente.md`).
- **Seed, Docker e CI:** nada de arquivo. O seed não cria conteúdo documental; o Docker sobe só
  o PostgreSQL; a CI roda a mesma bateria com PostgreSQL efêmero.

### 27.2 Opções de persistência

| Opção                                 | Situação                                                                                                      | Leitura                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A. PostgreSQL, tabela própria (bytea) | Sem provedor novo; cabe no backup e na CI atuais; exige ADR própria por ser decisão material de armazenamento | Menor arquitetura para uma foto real nesta T208, se a imagem for pequena e normalizada |
| B. Cloudflare R2 (ADR 0013)           | Aprovado só para conteúdo documental; depende de DP-2E-04, 05, 09, 13, 15 e MFA obrigatório                   | Inviável sem fechar os portões; estender a ADR 0013 à foto também exige decisão        |
| C. Sistema de arquivos do servidor    | Não há volume, caminho nem política; quebra a regra de não introduzir storage                                 | Descartada                                                                             |
| D. Sem foto (só iniciais)             | É o estado atual                                                                                              | Honesto, mas não entrega foto real                                                     |

### 27.3 Desenho mínimo proposto (opção A)

- **Tabela `access_user_foto`**, separada de `access_user`:
  - chave = conta;
  - conteúdo binário;
  - tipo, largura, altura e tamanho, com CHECK;
  - `criada_em`.

  Fica separada para não viajar em toda requisição de sessão. Uma foto por conta; global da
  conta, não por empresa, como o nome de exibição.

- **Formato guardado:** só JPEG 256 × 256 px, até 100 kB.
- **No navegador:** a pessoa escolhe JPEG, PNG ou WebP de até 5 MB e com ao menos 128 × 128 px. O
  navegador faz o corte quadrado central e reduz a imagem para 256 × 256. A reconversão para
  JPEG descarta metadados.
- **Validação real no servidor, sem confiar na extensão nem no tipo declarado:**
  - assinatura JPEG;
  - dimensões lidas do cabeçalho, exatamente 256 × 256;
  - recusa de segmentos de metadado (EXIF/XMP) e de dados após o fim da imagem;
  - limite de bytes aplicado antes de ler o corpo.

  Decodificar e reconverter a imagem no servidor só é possível com uma dependência nova de
  processamento de imagem. Isso muda o lockfile e precisa de aprovação (FP-3).

- **Rotas, todas sobre a própria conta, sem `:id`:**
  - `PUT /v1/users/me/foto`, com corpo binário e versão lida do perfil no cabeçalho;
  - `DELETE /v1/users/me/foto`;
  - `GET /v1/users/me/foto`.

  As gravações usam `own_account`/`manage` e CSRF. A leitura exige só a sessão. O ator ganha a
  data da foto, que versiona a URL.

- **Concorrência:** a foto entra na mesma versão do perfil (`perfilAtualizadoEm`). Versão velha
  responde 409 e nada é sobrescrito, como o nome.
- **Entrega:**
  - só pela API, sem URL pública e sem URL persistida;
  - `Content-Type` fixo;
  - `nosniff`, `Content-Disposition: inline` e CSP `default-src 'none'; sandbox` na resposta;
  - `Cache-Control: private, no-cache` com ETag, de modo que o navegador revalida e recebe 304;
  - a URL leva `?v=` com a data da foto, para trocar na hora.
- **Sem foto ou com falha de carga:** iniciais, como hoje.
- **Quem vê:** só a própria pessoa, em Meu perfil. Listagens, ficha, Hub, gestor e Contas de
  acesso não mostram fotos.

### 27.4 Privacidade, segurança e auditoria

- **Finalidade:** identificação visual da própria conta na interface.
- **Acesso:** só a titular.
- **Retenção:** até a remoção pela própria pessoa ou a desativação da conta (FP-4).
- **Auditoria:** eventos novos de envio e de remoção, na mesma transação, sem conteúdo, hash,
  tamanho, dimensões ou nome do arquivo (a trilha não tem campo de conteúdo).
- **Acesso indevido:** sem rota com `:id`, não há como pedir a foto de outra conta. Sessão
  vencida responde 401 e conta desativada perde a sessão.
- **Backup:** fotos removidas continuam nos backups até a retenção deles, que segue pendente na
  Etapa 0. Isso precisa constar na decisão de retenção.
- **Arquivo malicioso:**
  - a foto só é servida como imagem, com `nosniff` e CSP restritiva, e só para a titular;
  - a validação estrutural reduz o risco;
  - a reconversão no servidor o eliminaria, mas depende de dependência nova (FP-3).

  Essa combinação substitui o antivírus da ADR 0013 só para a foto, e só se aprovada (FP-1).

### 27.5 Interface

- Em Identificação, as iniciais dão lugar à foto quando ela existe.
- **Envio:**
  - um botão "Escolher foto" abre o seletor nativo de arquivo, que tem rótulo e funciona pelo
    teclado;
  - a prévia mostra o corte central, com "Usar esta foto" e "Cancelar";
  - erros por arquivo (tipo, tamanho, dimensões) aparecem em alerta, com o foco voltando ao
    botão.
- **Remoção:** "Remover foto" pede confirmação.
- **Guarda de saída:** prévia não confirmada conta como edição pendente; envio em curso bloqueia
  a saída.
- **Anúncio:** um por desfecho.
- **Layout:** a 375 px, a foto tem tamanho fixo e as ações quebram linha, sem rolagem horizontal.
- **Fluxo próprio:** a foto não entra no rodapé do nome. Gravar foto e nome juntos traria falha
  parcial entre duas requisições.

### 27.6 Impacto

| Área          | Impacto da opção A                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| API           | Três rotas novas, validação estrutural do JPEG, cabeçalhos de entrega e corpo binário com limite próprio                  |
| Schema        | Tabela nova e dois valores novos de auditoria (migration aditiva)                                                         |
| RBAC          | Nenhuma permissão nova: `own_account` (`read`/`manage`)                                                                   |
| Docker e seed | Nenhum                                                                                                                    |
| Dependências  | Nenhuma no desenho com validação estrutural; uma nova se a reconversão no servidor for aprovada (FP-3)                    |
| Testes        | Unitários do validador; E2E com imagens sintéticas geradas no teste; web com seleção de arquivo, prévia, remoção e guarda |
| CI            | Mesma bateria; só muda se entrar dependência nativa nova                                                                  |
| Backup        | `pg_dump` passa a carregar as fotos (até 100 kB por conta)                                                                |

### 27.7 Se a infraestrutura não for aprovada

Sem a opção A aprovada e sem os portões do R2, a tela continua com as iniciais e a frase atual,
sem botão de envio, sem campo inativo e sem promessa de data.

### 27.8 Riscos de prazo

- **Opção A:** sem dependência externa. Os riscos são:
  - a validação estrutural do JPEG (código próprio, com testes);
  - o comportamento do corte e da redução em navegadores com imagens grandes (por isso o limite
    de 5 MB na entrada);
  - a aprovação de retenção.
- **Opção B:** depende de portões que exigem decisões de TI, Segurança, DPO e Jurídico, e de MFA
  obrigatório. Não cabe nesta T208.

### 27.9 Decisões para aprovação

| Id   | Tema                         | Recomendação                                                                                                                                                                                           | Alternativa                                                       |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| FP-1 | Onde armazenar               | PostgreSQL, tabela própria `access_user_foto`, com ADR própria que registra a exceção para foto de conta, fora do conteúdo documental                                                                  | Cloudflare R2, só depois dos portões de Nível 2                   |
| FP-2 | Formatos, tamanho, dimensões | Entrada JPEG/PNG/WebP até 5 MB e ao menos 128 × 128 px; guardado JPEG 256 × 256 até 100 kB                                                                                                             | Guardar WebP (codificação no navegador não é uniforme)            |
| FP-3 | Corte e redimensionamento    | Corte quadrado central e redução no navegador; servidor valida a estrutura e recusa metadados; sem dependência nova                                                                                    | Reconversão no servidor com dependência nova de imagem (lockfile) |
| FP-4 | Remoção e fallback           | A própria pessoa remove a qualquer momento, com exclusão imediata dos bytes; sem foto, iniciais; desativação da conta apaga a foto                                                                     | Manter a foto após a desativação                                  |
| FP-5 | Auditoria                    | Eventos próprios de envio e remoção, sem conteúdo, hash, tamanho ou nome do arquivo                                                                                                                    | Um evento só, "perfil atualizado"                                 |
| FP-6 | Cache e invalidação          | Só pela API, `private, no-cache` com ETag; URL versionada pela data da foto; nada público ou persistido                                                                                                | `private, max-age` curto sem revalidação                          |
| FP-7 | Migração e compatibilidade   | Migration aditiva (tabela e auditoria); contas atuais sem foto; ator ganha só um campo opcional                                                                                                        | —                                                                 |
| FP-8 | Escopo nesta T208            | Entra: enviar, pré-visualizar, substituir e remover a própria foto, vista só pela titular em Meu perfil. Fica fora: foto de colaborador, foto vista por outros, R2, antivírus, editor de enquadramento | Também mostrar a foto no topo do shell para a própria pessoa      |
