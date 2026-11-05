# T203 — Dossiê: Solicitações de Pessoas na ficha do colaborador

**Situação:** decisões S-1 a S-5 aprovadas pela proprietária em 2026-11-05;
a aba Solicitações (só leitura) está em implementação, com a entrega em PR
Draft — ver a seção 11. Sem API, schema, migration, RBAC, auditoria, seed ou dependência
nova.

**Base:** `main` em `adc1123` (T202 integrada, PR #195). A ficha individual tem
seis abas reais: Dados do colaborador, Vida funcional, Dados contratuais,
Jornada de trabalho, Documentos e Registros de ponto
([dossiê da T202](t202-dossie-proxima-aba-ficha-colaborador.md)).

**Decisões que já valem:**

- solicitações **de documento** pertencem à aba Documentos (T201) e não se
  repetem aqui;
- esta tarefa trata a **Central de Solicitações de Pessoas** (T139/T140);
- o DP é negado pelo servidor neste domínio: se a aba entrar, ela some para o
  DP (F-6 da T201);
- nenhuma escrita é presumida para RH nem para `master_tecnico`;
- nada de aba decorativa;
- qualquer ação que abra edição pendente fica sob a guarda global da T200.

## 1. Resumo e recomendação

**Recomendação: alternativa 1, aba "Solicitações" só leitura.** Lista as
solicitações da pessoa na empresa ativa, um bloco por vínculo (principal
primeiro), com o detalhe e o histórico de cada uma. RH e `master_tecnico`
leem; a aba não existe para o DP; registrar e transicionar continuam na
Central (Pessoas › Solicitações).

Por quê:

- é a única alternativa completa sem decisão de produto nova: as ações exigem
  regras que o servidor não define (qual vínculo, qual motivo para cada tipo,
  se o rascunho criado na ficha precisa ser enviado na própria ficha);
- não tem ação irreversível nem edição pendente, então não depende da guarda;
- reaproveita só leituras que existem e já são auditadas;
- deixa a ação inicial (alternativa 2) para uma fatia própria, depois das
  decisões da seção 9.

## 2. Estado atual do domínio (evidência)

### 2.1 Contratos

| Rota (todas em `/v1`)                                  | Permissão                 | O que faz                                                                                 |
| ------------------------------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /solicitacoes-pessoas`                            | `solicitacao_pessoa:read` | Lista paginada (20 por padrão, 100 no máximo), ordem fixa `criadoEm desc, id`             |
| `GET /solicitacoes-pessoas/:solicitacaoId`             | `read`                    | Detalhe                                                                                   |
| `GET /solicitacoes-pessoas/:solicitacaoId/historico`   | `read`                    | Linha do tempo dos eventos (`acao`, `situacaoDe`, `situacaoPara`, `motivo`, `ocorridoEm`) |
| `POST /solicitacoes-pessoas`                           | `create` + CSRF           | Registra; nasce sempre `rascunho`                                                         |
| `POST /solicitacoes-pessoas/:solicitacaoId/transicoes` | `alter` + CSRF            | Aplica uma ação da máquina de estados                                                     |

Evidência: `apps/api/src/solicitacoes-pessoas/solicitacao-pessoa.controller.ts:39-128`.
Não existe PATCH nem DELETE; a exclusão física é revogada no banco.

**Filtros da lista:** `empresaId`, `vinculoId`, `tipo`, `situacao`, `pagina` e
`tamanhoPagina` (`dto/solicitacoes-pessoas.dto.ts:142-158`). **Não há filtro
por pessoa nem por período**: parâmetro desconhecido responde 400
(`apps/api/src/main.ts:26-28`). Na ficha, a leitura é uma consulta por vínculo.

### 2.2 Dados de uma solicitação

`id`, `empresaId`, `vinculoId`, `tipo`, `motivo` (catálogo fechado),
`situacao`, `periodoReferencia` (dia, opcional), `registradoPorUserId`,
`enviadaEm`, `primeiraRevisaoEm`, `criadoEm`, `atualizadoEm`
(`apps/api/prisma/schema.prisma:1796-1841`).

- **Sem** `colaboradorId`, nome, texto livre, anexo, diagnóstico ou CID: a
  pessoa é alcançada pelo vínculo, e o registro não aceita esses campos
  (`dto/solicitacoes-pessoas.dto.ts:92-123`).
- O registro é sempre feito pelo RH em nome da pessoa: não há ligação entre
  conta de acesso e colaborador (DP-23), e o autoatendimento não está
  autorizado (ADR 0015).
- `registradoPorUserId` é só o id da conta; mostrar quem registrou exigiria
  outra leitura.

### 2.3 Máquina de estados

| Situação                       | Ações possíveis (destino)                                                                                                      | Origem da intenção |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `rascunho`                     | enviar (`enviada`), cancelar (`cancelada`)                                                                                     | colaborador        |
| `enviada`                      | iniciar revisão (`em_revisao_rh`), cancelar (`cancelada`)                                                                      | RH / colaborador   |
| `em_revisao_rh`                | aguardar informação (`aguardando_informacao`), encaminhar para operação (`encaminhada_para_operacao_rh`), recusar (`recusada`) | RH                 |
| `aguardando_informacao`        | retomar revisão (`em_revisao_rh`)                                                                                              | RH                 |
| `encaminhada_para_operacao_rh` | reabrir (`em_revisao_rh`)                                                                                                      | RH                 |
| `recusada`                     | reabrir (`em_revisao_rh`)                                                                                                      | RH                 |
| `cancelada`                    | nenhuma (terminal absoluto)                                                                                                    | —                  |

- Evidência: núcleo puro `apps/api/src/solicitacoes/solicitacoes.ts:121-146`,
  espelhado no cliente web (`apps/web/src/api/solicitacoesPessoasClient.ts:100-125`).
- **Motivo obrigatório** só para recusar e reabrir
  (`solicitacoes-pessoas.types.ts:74-77`; 422 sem ele).
- Transição fora de ordem responde 422; transições concorrentes são
  serializadas com `FOR UPDATE` (E2E dedicado).
- "Encaminhar para operação" **não executa nada**: a solicitação registra a
  intenção, nunca a operação (E2E "sem efeitos operacionais").
- Todas as ações são executadas pelo RH, inclusive as de origem do colaborador
  (`ACAO_ORIGEM`, `solicitacoes-pessoas.types.ts`).

### 2.4 Permissões, escopo e auditoria

| Perfil                                                       | Lista, detalhe, histórico   | Registrar e transicionar  |
| ------------------------------------------------------------ | --------------------------- | ------------------------- |
| `rh` (com empresa)                                           | sim, só a própria empresa   | sim, só a própria empresa |
| `master_tecnico` com empresa ativa                           | sim, só a empresa escolhida | não                       |
| `master_tecnico` sem empresa ativa                           | sim, **todas as empresas**  | não                       |
| `dp`                                                         | **negado** (403)            | negado                    |
| gestor, colaborador, financeiro, admin técnico, auditor, DPO | negado                      | negado                    |

- Evidência: `apps/api/src/auth/authorization/rbac.evaluator.ts:602-630`;
  escopo em `escopo-solicitacoes-pessoas.util.ts:31-87`.
- Recurso de outra empresa responde 404 (anti-enumeração); `empresaId` de
  outra empresa na query devolve página vazia.
- **Auditoria:** toda leitura (lista, detalhe, histórico) grava
  `pessoas_solicitacao_consultada`, e a leitura falha se a auditoria falhar;
  cada transição grava a sua ação na mesma transação; o evento nunca carrega
  tipo, vínculo nem motivo (`solicitacoes-pessoas-auditoria.service.ts:15-87`).

### 2.5 Telas e testes

- **Central em Pessoas** (`apps/web/src/screens/pessoas/SolicitacoesScreen.tsx`):
  - escolhe pessoa e **um** vínculo, lista, filtra por tipo e situação;
  - detalhe com histórico;
  - ações só para `rh` com empresa (`:113-125`);
  - guarda com o rótulo "Solicitações" (`:188-195`);
  - sem URL própria (estado local da aba de Pessoas).
- **Cliente web:** `listarSolicitacoesPessoas`, `detalharSolicitacaoPessoa`,
  `historicoSolicitacaoPessoa`, `registrarSolicitacaoPessoa`,
  `transicionarSolicitacaoPessoa` (`solicitacoesPessoasClient.ts:251-316`).
- **Testes:** E2E do domínio (`apps/api/test/solicitacoes-pessoas.e2e-spec.ts`),
  RBAC, serviço, núcleo, cliente e tela. **Lacunas:** nenhum teste do
  `master_tecnico` com empresa ativa neste domínio; nenhum teste da ficha
  tocando solicitações de pessoas.

## 3. Matriz por tipo

Todos os tipos têm **a mesma estrutura**: tipo, motivo, dia de referência
opcional e situação. Não há campo próprio de nenhum tipo, e a máquina de
estados é a mesma.

| Tipo (`tipo`)                                               | Motivo natural do registro   | O que a solicitação representa | Cuidado                                                                        |
| ----------------------------------------------------------- | ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Contestação de ajuste de ponto (`contestacao_ajuste_ponto`) | Divergência de marcação      | Pedido de revisão de marcação  | Não altera o ponto; o ajuste segue em Jornada › Visão do período               |
| Ausência (`ausencia`)                                       | Ausência programada          | Intenção de ausência           | Não há registro de afastamento no Evolli (bloqueado na T201)                   |
| Férias (`ferias`)                                           | Período de férias            | Intenção de férias             | Não há período aquisitivo nem concessão no Evolli                              |
| Atualização cadastral (`atualizacao_cadastral`)             | Dado cadastral desatualizado | Pedido de correção de cadastro | A correção em si é feita na aba Dados do colaborador                           |
| Atestado (`atestado`)                                       | Atestado apresentado         | Registro de que houve atestado | Sensível por inferência: o tipo nunca vai à auditoria; sem anexo, CID ou texto |
| Benefícios (`beneficios`)                                   | Benefício solicitado         | Pedido de benefício            | Não há catálogo de benefícios no Evolli                                        |

- **Motivo não é amarrado ao tipo** no servidor nem na tela: o registro
  aceita qualquer um dos 12 motivos, inclusive os de decisão do RH
  ("duplicidade", "informação insuficiente"). Só importa para a alternativa 2.
- **Dia de referência** é opcional para todos os tipos; nenhuma decisão fixou
  quais tipos o exigem.
- O registro aceita vínculo `ativo`, `previsto` ou `encerrado` da empresa: não
  há regra de situação do vínculo.

## 4. Alternativas

| Critério                   | 1. Só leitura                             | 2. Leitura + uma ação inicial ("Registrar")                                         | 3. Fluxo completo                                                            |
| -------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| O que entrega              | Lista por vínculo, detalhe e histórico    | Item 1 + registrar solicitação em nome da pessoa (nasce `rascunho`)                 | Item 2 + as 8 transições no detalhe                                          |
| Contratos                  | 3 leituras existentes                     | + `POST /solicitacoes-pessoas`                                                      | + `POST /:solicitacaoId/transicoes`                                          |
| Quem vê / quem age         | RH e master leem; DP sem aba              | RH age; master lê; DP sem aba                                                       | RH age; master lê; DP sem aba                                                |
| Edição pendente e guarda   | Não há                                    | Formulário de registro na área `ficha`                                              | Formulários de registro e de transição com motivo                            |
| Ações irreversíveis        | Nenhuma                                   | Nenhuma (rascunho pode ser cancelado)                                               | Cancelar é terminal; recusar e encaminhar mudam o fluxo do RH                |
| Decisões novas necessárias | Só as de apresentação (seção 9)           | Vínculo do registro; motivo por tipo; vínculo encerrado; o que fazer com o rascunho | As da 2 + confirmação para ações terminais e conflitos de concorrência (422) |
| Completa sozinha?          | Sim: consulta da pessoa, ações na Central | Parcial: o rascunho criado precisa ser enviado na Central (ou a ficha também envia) | Sim, mas duplica a Central inteira dentro da ficha                           |
| Tamanho                    | Pequeno                                   | Médio                                                                               | Grande                                                                       |

## 5. Proposta da primeira fatia (alternativa 1)

### 5.1 Escopo

- **Aba nova `solicitacoes`** em `ABAS_DA_FICHA`, depois de `ponto`, com o
  rótulo **"Solicitações"** e a rota
  `#/pessoas/colaboradores/:colaboradorId/solicitacoes`.
- **Some para o DP** (F-6): a aba não aparece na lista, o teclado não passa
  por ela, e a URL digitada pelo DP é corrigida no lugar para a aba de dados,
  sem nenhuma consulta (S-3).
- **Conteúdo, um bloco por vínculo da pessoa na empresa ativa**, o principal
  primeiro, inclusive encerrados (S-4):
  - colunas: tipo, situação (selo), motivo, dia de referência e "registrada
    em";
  - "Ver detalhe" abre o painel da solicitação com os campos e a linha do
    tempo (`historico`), só leitura;
  - a lista lê todas as páginas (100 por página) pelo `total`.
- **Aviso fixo:** registrar e dar andamento às solicitações continua em
  Pessoas › Solicitações; a ficha só consulta.
- **`master_tecnico` sem empresa ativa:** orientação e nenhuma consulta (S-2,
  padrão de F-4 e P-2).
- **Sem escrita**, sem formulário e sem edição pendente.

### 5.2 Contratos

- **Reaproveitados, sem mudança:** `GET /v1/users/me`, os vínculos que a ficha
  já lê, `GET /v1/solicitacoes-pessoas?vinculoId=&pagina=&tamanhoPagina=100`,
  `GET /v1/solicitacoes-pessoas/:solicitacaoId` e `/historico`.
- **Mudança só no web:** o papel do ator chega à ficha para esconder a aba do
  DP; `fichaDaRota` segue sem conhecer papel, e o shell corrige a rota.
- **Testes de API a acrescentar (só do contrato existente):** `master_tecnico`
  com empresa ativa neste domínio (só a empresa; a outra é 404) e leitura por
  vínculo com paginação pelo total.

### 5.3 O que não entra

- Registrar, enviar, cancelar ou qualquer transição na ficha.
- Filtros por tipo e situação (poucos itens por pessoa).
- Detalhe com endereço próprio na URL.
- Nome de quem registrou.
- Mudança na Central de Pessoas.

## 6. Riscos

| Risco                     | Cuidado na implementação                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Isolamento entre empresas | Vínculos e solicitações só do escopo da sessão; descartar item cujo `vinculoId` ou `empresaId` não seja do bloco; sem empresa ativa, nada é lido; troca de empresa remonta a árvore |
| DP                        | Aba fora da lista e do teclado; URL digitada corrigida para "dados" sem consulta; teste de que o DP nunca chama a lista                                                             |
| Auditoria                 | Cada abertura grava uma linha por vínculo e página; detalhe e histórico gravam ao abrir; não reler ao voltar à aba nem ao fechar o detalhe                                          |
| Respostas atrasadas       | Geração por leitura (pessoa, vínculo, detalhe): detalhe atrasado de outra solicitação nunca substitui o painel                                                                      |
| Guarda de saída           | Sem formulário, a aba não cria edição pendente; teste de que sair da ficha pela aba não pergunta                                                                                    |
| URL                       | `solicitacoes` em `ABAS_DA_FICHA`; recarga, voltar e avançar como as demais abas; o detalhe não vai à URL                                                                           |
| Ações irreversíveis       | Nenhuma nesta fatia                                                                                                                                                                 |
| Dado sensível             | "Atestado" aparece como tipo, com a mesma exposição da Central e a mesma permissão; nada além do tipo, motivo e datas                                                               |
| Foco e anúncios           | Rota direta: foco no título da ficha; "Ver detalhe" leva o foco ao título do painel e "Fechar" devolve ao botão de origem; um só nó de status; falha com nova tentativa no lugar    |
| 375 px                    | Sete abas na grade de duas colunas (a sétima ocupa a linha inteira, regra da T201); tabelas rolam no quadro posicionado; painel de detalhe empilhado; controles com 44 px           |

## 7. Critérios de aceite

1. A aba "Solicitações" aparece para RH e `master_tecnico`; não aparece para o
   DP, e a URL dela digitada pelo DP abre "Dados do colaborador" sem consulta.
2. `…/solicitacoes` abre a ficha na aba; recarregar, voltar e avançar
   funcionam como nas outras abas.
3. Só aparecem solicitações da pessoa, na empresa ativa, de todos os vínculos
   dela nessa empresa, um bloco por vínculo, o principal primeiro.
4. `master_tecnico` sem empresa ativa vê a orientação, sem consulta; com
   empresa, lê só aquela empresa.
5. O detalhe mostra os campos e a linha do tempo, só leitura.
6. Nenhum controle de registro ou transição na aba.
7. Estados de carga, vazio ("Nenhuma solicitação registrada para a pessoa"),
   falha e nova tentativa, com foco e um anúncio por evento.
8. A 375 px não há rolagem horizontal da página.

## 8. Plano de testes

- **Unidade (web):** seção com vínculos, filtro defensivo, todas as páginas,
  detalhe e histórico, sem empresa, perfis, carga, vazio, falha, nova
  tentativa, respostas atrasadas, foco ao abrir e fechar o detalhe, ausência
  de escrita.
- **Shell (`App.ficha.test.tsx`):** rota direta, recarga, histórico, aba
  ausente para o DP, URL do DP corrigida sem consulta, perfis negados, troca
  de empresa, saída sem pergunta.
- **API (só testes):** `master_tecnico` com empresa ativa; leitura por vínculo
  paginada; isolamento correspondente.
- **Prova de falha** para cada proteção, como nas T201 e T202.
- **Localhost** com dados sintéticos registrados pela Central (Pessoas ›
  Solicitações): RH, DP, `master_tecnico` com e sem empresa, gestor; teclado;
  375 px.
- **Bateria completa** (web, API unitária, E2E com PostgreSQL real, scripts,
  lint, typecheck, build, Prettier, `spec:check`, prévia do squash e
  `git diff --check`).

## 9. Decisões (aprovadas em 2026-11-05)

S-1 a S-5 aprovadas como recomendado.

| Id  | Pergunta                            | Recomendação                                                                                                |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| S-1 | Qual alternativa entra primeiro?    | **1, só leitura**: completa sem decisão de produto nova, sem ação irreversível e sem guarda                 |
| S-2 | `master_tecnico` sem empresa ativa  | **Orientação sem consulta**, como Documentos (F-4) e Registros de ponto (P-2)                               |
| S-3 | DP com a URL da aba                 | **Corrigir no lugar para "Dados do colaborador"**, sem consulta e sem aviso de "sem permissão"              |
| S-4 | Quais vínculos                      | **Todos os da pessoa na empresa ativa**, o principal primeiro, inclusive encerrados (mesmo critério de P-3) |
| S-5 | O tipo "Atestado" aparece na ficha? | **Sim, como na Central**: mesma permissão, só tipo, motivo e datas, sem anexo, CID ou texto                 |

**Decisões para a alternativa 2, quando ela vier** (não bloqueiam a fatia 1):

- em qual vínculo o RH registra quando a pessoa tem mais de um;
- se o motivo do registro fica restrito ao motivo natural de cada tipo;
- se a ficha registra para vínculo encerrado ou previsto;
- se o rascunho criado na ficha também pode ser enviado nela.

## 10. Limites e fora de escopo

- **Na etapa de preparação (histórico):** nenhum código de produto, API,
  schema, migration, RBAC, auditoria, Docker, seed, dependências, lockfile ou
  workflow; sem push e sem PR. Isso valeu só para a preparação.
- **Na entrega:** sem API, schema, migration, RBAC, auditoria, Docker, seed,
  dependências, lockfile ou workflow; os testes de API novos só exercitam o
  contrato existente.
- **Na primeira fatia:** só leitura. Ficam de fora registro e transições na
  ficha, filtros, detalhe na URL, nome de quem registrou e mudança na Central.
- **Sempre:** solicitações de documento seguem na aba Documentos; nada de aba
  decorativa; nenhum anexo, texto livre, CID ou dado clínico.

## 11. Entrega da primeira fatia

### 11.1 O que foi feito

- **Aba `solicitacoes`** em `ABAS_DA_FICHA`, depois de `ponto`, com o rótulo
  "Solicitações", ícone próprio e a rota
  `#/pessoas/colaboradores/:colaboradorId/solicitacoes` (recarga, voltar e
  avançar como as demais abas).
- **Papel (S-3):**
  - `podeLerSolicitacoesPessoas` (`mapaNavegacao.ts`) espelha
    `evaluateSolicitacoesPessoas`: `rh` e `master_tecnico` leem; `dp` e os
    demais, não;
  - a ficha só lista a aba para quem lê (`podeVerSolicitacoes`), e o teclado
    percorre só as abas visíveis;
  - `fichaParaOPapel` troca a aba pedida por "dados" para o DP, na entrada e
    no voltar/avançar; o shell corrige a URL no lugar, sem entrada nova e sem
    nenhuma consulta de solicitações.
- **Seção nova `SolicitacoesColaboradorSecao`**, só com contratos existentes:
  - empresa ativa por `GET /v1/users/me`; sem ela, orientação e nenhuma
    leitura (S-2);
  - vínculos da ficha filtrados pela pessoa e pela empresa da sessão, o
    principal primeiro, encerrados incluídos (S-4);
  - `GET /v1/solicitacoes-pessoas?vinculoId=` por vínculo, todas as páginas
    de 100 pelo `total`, sem repetir e descartando o que não for do vínculo
    ou da empresa;
  - tabela por vínculo com tipo, situação, motivo, dia de referência e
    "registrada em"; "Atestado" como os demais (S-5);
  - "Ver detalhe" lê `/:id` e `/:id/historico`; o detalhe só vale se for o
    pedido, da empresa da sessão e de um vínculo da pessoa; a linha do tempo
    só com eventos dele, em ordem de ocorrência; 404 ou fora do escopo
    mostram "não está disponível na empresa ativa";
  - só leitura: o único controle por linha é "Ver detalhe", e no painel só
    "Fechar detalhe".
- **Foco e anúncios:** rota direta com o foco no título da ficha; "Ver
  detalhe" leva o foco ao título do painel e "Fechar detalhe" o devolve ao
  botão de origem; um só nó de status (sessão, lista e carga do detalhe),
  sem temporizador; o resultado da lista é anunciado uma vez por leitura
  real da lista, e abrir, concluir, falhar ou fechar o detalhe não o repete
  (correção B1 da revisão); falhas com alerta e "Tentar de novo" no lugar.
- **Respostas atrasadas e desmontagem:** geração própria para a lista e para
  o detalhe; troca de empresa remonta a árvore.
- **Sem edição pendente:** sem formulário, a guarda da T200 não pergunta ao
  sair nem na troca de empresa.
- **375 px:** sete abas na grade de duas colunas (a sétima na linha inteira);
  tabelas no quadro posicionado; painel de detalhe empilhado.
- **Pessoas › Solicitações** (a Central) não mudou.

### 11.2 Testes e validação

- **Web:**
  - `SolicitacoesColaboradorSecao.test.tsx` (24 casos): vínculos, pessoa e
    empresa; os seis tipos com Atestado; master sem e com empresa; RH sem
    escrita; todas as páginas e deduplicação; falha numa página seguinte;
    detalhe e linha do tempo com defesa de escopo; detalhe indisponível;
    falha e nova tentativa do detalhe; detalhe atrasado; um só nó de status;
    anúncio da lista sem repetição ao abrir, concluir, fechar ou falhar o
    detalhe, e de novo uma vez numa releitura real da lista; vazio; falha da lista; falha ao conferir o acesso; lista atrasada de
    outra pessoa; desmontagem; 375 px;
  - `App.ficha.test.tsx` (13 casos T203): rota direta e recarga; DP com a
    URL da aba na entrada e no voltar/avançar (Dados, URL corrigida, zero
    consulta); master com e sem empresa; troca de aba com voltar e avançar;
    outra pessoa pela URL; fora da empresa; perfis negados; saída sem
    pergunta com o detalhe aberto;
  - `AutenticacaoApp.test.tsx`: troca de empresa com a leitura em curso;
  - `FichaColaboradorScreen.test.tsx`: sete abas com permissão, seis sem, e
    o teclado;
  - `mapaNavegacao.solicitacoes.test.ts`: papéis e correção da rota.
- **API (só testes, `solicitacoes-pessoas.e2e-spec.ts`, 4 casos):** leitura
  por vínculo paginada e isolada; Atestado sem campo a mais; `master_tecnico`
  com empresa ativa (lista, detalhe e histórico só da empresa; a outra vazia
  ou 404; sem escrita); auditoria `pessoas_solicitacao_consultada` de cada
  leitura do master com o papel e a empresa.
- **Prova de falha:** cada mutação abaixo derruba ao menos um teste:
  - filtro defensivo da lista;
  - master sem empresa consultando;
  - só a primeira página;
  - sem deduplicar;
  - sem geração da lista;
  - principal fora do primeiro lugar;
  - vínculo de outra empresa;
  - detalhe sem defesa de escopo;
  - linha do tempo sem filtro;
  - sem geração do detalhe;
  - fechar sem devolver o foco;
  - status do detalhe voltando ao anúncio da lista (estado anterior à
    correção B1);
  - releitura da lista sem voltar a anunciar;
  - DP sem correção na entrada;
  - DP sem correção no voltar/avançar;
  - auditoria do master sem a empresa (mutação temporária do serviço,
    desfeita).
- **Achados na própria entrega e corrigidos:**
  - o teste de paginação da API dependia de registros de outros blocos;
    passou a registrar as suas próprias solicitações;
  - o teste de arquitetura de formatação (T154) tomou um auxiliar de teste
    por formatador de data local; o auxiliar deixou de recortar texto.
- **Localhost** (banco isolado, dados sintéticos; pessoa e vínculos pela API
  de Pessoas; solicitações e transições pela Central):
  - uma pessoa com vínculo CLT ativo (contestação de ajuste de ponto,
    férias encaminhada, atestado recusado e benefícios) e vínculo de estágio
    encerrado (ausência e atualização cadastral);
  - RH: rota direta, seis tipos nos dois blocos, detalhe e linha do tempo do
    atestado pelo teclado (foco no título do painel e de volta ao botão),
    sem anexo nem CID;
  - DP: URL da aba corrigida para "dados", seis abas, zero requisições de
    solicitações;
  - `master_tecnico`: sem empresa, orientação e nenhuma consulta; com a
    Alfa, só leitura; trocando para a Beta, volta à listagem e a pessoa da
    Alfa dá "não encontrado";
  - gestor: sem ficha e sem requisição;
  - 375 px sem rolagem horizontal, com o painel de detalhe aberto.
