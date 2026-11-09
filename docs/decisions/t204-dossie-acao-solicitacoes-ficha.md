# T204 — Dossiê: primeira ação operacional em Solicitações na ficha

**Situação:** decisões A-1 a A-6 aprovadas pela proprietária em
2026-11-09; a "Nova solicitação" (registrar e enviar pela ficha) está em
implementação, em commits locais, sem push e sem PR — ver a seção 12. Sem API,
schema, migration, RBAC, auditoria, Docker, seed, dependência, lockfile ou
workflow novos.

**Base:** `main` em `e086d1c` (T203 integrada, PR #196). A ficha individual
tem sete abas reais; a aba Solicitações é só leitura
([dossiê da T203](t203-dossie-solicitacoes-pessoas-ficha.md)).

**Decisões que já valem:**

- solicitações **de documento** ficam na aba Documentos (T201);
- a aba Solicitações existe só para RH e `master_tecnico`; o DP não a vê e a
  URL dela é corrigida para "Dados do colaborador" (S-3 da T203);
- a tela coletiva Pessoas › Solicitações é o lugar operacional atual;
- todo formulário ou gravação em curso fica sob a guarda global da T200;
- nenhuma das oito transições é presumida para a ficha.

## 1. Resumo e recomendação

**Recomendação: opção 3, restrita à entrada do pedido.** O RH registra e
envia uma solicitação da pessoa na própria ficha ("Nova solicitação" →
confirmar → `rascunho` → `enviada`). Uma solicitação que ficar em `rascunho`
mostra "Enviar" no detalhe. As outras seis ações (revisar, aguardar
informação, retomar, encaminhar, recusar e reabrir) e o cancelamento continuam
só na tela coletiva.

Por quê:

- **Só contratos existentes:** `POST /v1/solicitacoes-pessoas` e a transição
  `enviar`, ambos já auditados, com CSRF e cobertos por E2E. Nada muda na API.
- **Sem rascunho sem saída:** o que nasce na ficha sai dela enviado. Se o
  envio falhar depois do registro, o próprio detalhe oferece "Enviar".
- **Não duplica a tela coletiva:** a análise do RH (seis ações, motivo
  obrigatório, decisões terminais) fica onde está.
- **Tem precedente:** a aba Documentos (T201) já registra documento e
  solicitação de documento na ficha, com guarda, foco e falhas no lugar.
- A opção 2 (registrar e voltar à tela coletiva) depende de mudar a tela
  coletiva: ela não tem URL, não aceita pré-seleção e só lista os 100
  primeiros colaboradores no seletor (seção 2.5).

## 2. Estado atual (evidência)

### 2.1 A aba da ficha (T203)

- `SolicitacoesColaboradorSecao` lê a lista por vínculo (todas as páginas de
  100), o detalhe e o histórico; um bloco por vínculo da pessoa na empresa
  ativa, o principal primeiro, inclusive encerrados.
- **Sem escrita:** não recebe `onAlteradoChange` nem `onSalvandoChange`, e o
  aviso fixo diz que registrar e dar andamento continuam em Pessoas ›
  Solicitações.
- **Limitação prática:** para registrar um pedido da pessoa aberta, o RH sai
  da ficha, vai a Pessoas › Solicitações, escolhe de novo a pessoa e o vínculo,
  registra, abre o detalhe e envia. Depois volta à ficha.

### 2.2 Contratos de escrita

| Rota (`/v1`)                                           | Permissão       | Corpo                                                                           | Efeito                                                                      |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POST /solicitacoes-pessoas`                           | `create` + CSRF | `empresaId`, `vinculoId`, `tipo`, `motivo`, `periodoReferencia?` (`AAAA-MM-DD`) | Cria em `rascunho`, evento `criar` e auditoria `pessoas_solicitacao_criada` |
| `POST /solicitacoes-pessoas/:solicitacaoId/transicoes` | `alter` + CSRF  | `acao`, `motivo?`                                                               | Aplica a ação; `enviar` grava `enviadaEm` e `pessoas_solicitacao_enviada`   |

Evidência:

- controller `apps/api/src/solicitacoes-pessoas/solicitacao-pessoa.controller.ts:93-128`;
- DTOs `dto/solicitacoes-pessoas.dto.ts:103-140`;
- service `solicitacao-pessoa.service.ts:80-288`;
- cliente web `apps/web/src/api/solicitacoesPessoasClient.ts:298-330`.

Regras do servidor que importam aqui:

- `empresaId` do corpo é **conferido** contra a sessão; outra empresa é
  negada e auditada (`service.ts:86-90`).
- O vínculo é conferido dentro da empresa antes de criar; vínculo de outra
  empresa responde 404, sem criar nada (`service.ts:113-122`; E2E
  `solicitacoes-pessoas.e2e-spec.ts:1144-1165`).
- **Qualquer** situação de vínculo é aceita (ativo, previsto, encerrado), e o
  motivo **não** é amarrado ao tipo.
- Dia inexistente no calendário responde 422 (`service.ts:101-108`).
- **Registro e envio são duas requisições e duas transações.** Não existe
  "registrar já enviado": a situação nunca vem do cliente (E2E `:593`).
- **Sem chave de idempotência:** repetir o `POST` de registro cria outro
  registro. O cliente não repete sozinho (`solicitacoesPessoasClient.ts:192-208`).
- **Transição concorrente** é serializada com `FOR UPDATE`; a perdedora valida
  contra o estado novo e recebe 422 (`service.ts:186-244`; E2E `:885-1035`).
  Por isso `enviar` repetido não tem efeito duplo: o segundo recebe 422.
- Falha da auditoria desfaz a gravação (E2E `:1232`).

### 2.3 Máquina de estados

| Situação                       | Ações (destino)                                                             | Origem      |
| ------------------------------ | --------------------------------------------------------------------------- | ----------- |
| `rascunho`                     | enviar (`enviada`), cancelar (`cancelada`)                                  | colaborador |
| `enviada`                      | iniciar revisão (`em_revisao_rh`), cancelar (`cancelada`)                   | RH / colab. |
| `em_revisao_rh`                | aguardar informação, encaminhar para operação, recusar (motivo obrigatório) | RH          |
| `aguardando_informacao`        | retomar revisão (`em_revisao_rh`)                                           | RH          |
| `encaminhada_para_operacao_rh` | reabrir (`em_revisao_rh`, motivo obrigatório)                               | RH          |
| `recusada`                     | reabrir (`em_revisao_rh`, motivo obrigatório)                               | RH          |
| `cancelada`                    | nenhuma (terminal; exige nova solicitação)                                  | —           |

- Núcleo `apps/api/src/solicitacoes/solicitacoes.ts:121-146`; espelho no web
  `ACOES_POR_SITUACAO` (`solicitacoesPessoasClient.ts:109`).
- As ações de origem "colaborador" (enviar e cancelar) são executadas pelo RH
  em nome da pessoa: não há ligação conta↔colaborador (DP-23) nem
  autoatendimento (ADR 0015). O Portal do Colaborador › Minhas solicitações é
  só visual (T067), sem chamada à API.
- `PD-SOL-03`: cancelar só antes de `em_revisao_rh`. `PD-SOL-04`: objetivo
  de primeiro retorno do RH em dois dias úteis, sem cronômetro automático; o
  servidor grava `enviadaEm` e `primeiraRevisaoEm` para acompanhamento.

### 2.4 Permissões e auditoria

| Perfil                             | Lê na ficha        | Registra e transiciona     |
| ---------------------------------- | ------------------ | -------------------------- |
| `rh` com empresa                   | sim                | sim, só na própria empresa |
| `master_tecnico` com empresa ativa | sim                | **não** (servidor nega)    |
| `master_tecnico` sem empresa ativa | não consulta (S-2) | não                        |
| `dp`                               | sem aba            | negado                     |
| demais perfis                      | sem ficha          | negado                     |

- `rbac.evaluator.ts:602-630`; a tela coletiva espelha com `podeMutar`
  (`SolicitacoesScreen.tsx:118-125`: só `rh` com `companyId`).
- **Auditoria por ação:** `pessoas_solicitacao_criada`,
  `pessoas_solicitacao_enviada` e as demais
  (`solicitacoes-pessoas.types.ts:26-37`), na mesma transação da gravação; o
  evento nunca leva tipo, vínculo nem motivo. Cada releitura da lista grava
  `pessoas_solicitacao_consultada` por vínculo e página.

### 2.5 A tela coletiva (Pessoas › Solicitações)

`apps/web/src/screens/pessoas/SolicitacoesScreen.tsx`:

- **Sem URL própria:** a aba de Pessoas não tem rota (`rotasDoShell.ts`).
  Não aceita pessoa, vínculo nem solicitação pré-selecionados.
- **Seletor de colaborador só com a primeira página:**
  `listarColaboradores({ tamanhoPagina: 100 })` (`:243`). Numa empresa com
  mais de 100 colaboradores, parte das pessoas não pode ser escolhida.
- **Visão geral** ("Todos (sem filtro por pessoa)", `:850`): lista a empresa
  inteira, filtrável por tipo e situação, mas sem coluna de pessoa ou vínculo
  — a linha mostra só a referência curta do id (`:712`).
- **Registro** (`:513-553`): tipo, os **12** motivos e dia opcional; nasce em
  rascunho com "Solicitação registrada em rascunho." Para enviar, abre-se o
  detalhe, "Enviar" e "Confirmar" (formulário de transição, `:555-612`).
- **Erros** (`:474-494`): 404 fecha o painel; 409 e 422 releem o estado; falha
  de rede pede nova tentativa.
- **Guarda:** `useEdicaoEmAndamento("Solicitações", …)` (`:191`): formulário
  aberto é edição pendente; envio em curso é salvamento.

### 2.6 Precedente na ficha: aba Documentos (T201)

`DocumentosColaboradorSecao.tsx` registra documento, corrige o tipo e
registra solicitação de documento na ficha:

- `onAlteradoChange` e `onSalvandoChange` compostos pela ficha
  (`FichaColaboradorScreen.tsx:333-352` e `:1129-1135`);
- falha sem resposta: "Não foi possível confirmar se a solicitação foi
  registrada. Atualize a lista para conferir antes de tentar de novo."
  (`:141-160`), sem repetição automática;
- sucesso: aviso de status novo por gravação e releitura das listas com o
  foco no bloco alterado (`:470-545`).

## 3. Matriz de ações e transições

| Ação                     | De → para                                   | Motivo          | Irreversível?                  | Opção 1 | Opção 2       | Opção 3 (recomendada)    | Opção 4 |
| ------------------------ | ------------------------------------------- | --------------- | ------------------------------ | ------- | ------------- | ------------------------ | ------- |
| Registrar                | — → `rascunho`                              | do registro     | não                            | —       | ficha         | ficha (junto com enviar) | ficha   |
| Enviar                   | `rascunho` → `enviada`                      | opcional        | não (cancelável até a revisão) | —       | tela coletiva | ficha                    | ficha   |
| Cancelar                 | `rascunho`/`enviada` → `cancelada`          | opcional        | **sim** (terminal)             | —       | tela coletiva | tela coletiva            | ficha   |
| Iniciar revisão          | `enviada` → `em_revisao_rh`                 | opcional        | encerra o cancelamento         | —       | tela coletiva | tela coletiva            | ficha   |
| Aguardar informação      | `em_revisao_rh` → `aguardando…`             | opcional        | não                            | —       | tela coletiva | tela coletiva            | ficha   |
| Retomar revisão          | `aguardando…` → `em_revisao_rh`             | opcional        | não                            | —       | tela coletiva | tela coletiva            | ficha   |
| Encaminhar para operação | `em_revisao_rh` → `encaminhada…`            | opcional        | só por reabertura              | —       | tela coletiva | tela coletiva            | ficha   |
| Recusar                  | `em_revisao_rh` → `recusada`                | **obrigatório** | só por reabertura              | —       | tela coletiva | tela coletiva            | ficha   |
| Reabrir                  | `encaminhada…`/`recusada` → `em_revisao_rh` | **obrigatório** | não                            | —       | tela coletiva | tela coletiva            | ficha   |

## 4. Comparação das quatro opções

### 4.1 Opção 1 — sem ação (manter só leitura)

- **Contratos e estados:** só as três leituras; nada muda.
- **Rascunho:** não cria.
- **Permissões:** como hoje.
- **Vínculo, tipo, motivo:** não se aplica.
- **Ativo, previsto, encerrado:** só leitura de todos.
- **Auditoria, idempotência, concorrência, rede:** só leituras.
- **Guarda:** não participa.
- **Isolamento, URL, foco, 375 px:** já entregues na T203.
- **Custo:** zero. **Problema:** o pedido da pessoa aberta continua exigindo a
  tela coletiva, que não tem URL nem pré-seleção e só alcança os 100
  primeiros colaboradores no seletor.
- **Decisões pendentes:** nenhuma.

### 4.2 Opção 2 — registrar na ficha e voltar à tela coletiva

- **Contratos e estados:** `POST /solicitacoes-pessoas` (nasce `rascunho`);
  envio e o resto na tela coletiva.
- **Rascunho:** **sempre** cria. A pessoa o encontra:
  - na ficha, como linha "Rascunho" (sem ação, porque a ficha é só leitura);
  - na tela coletiva, escolhendo pessoa e vínculo (só se a pessoa estiver
    entre os 100 do seletor) ou na visão geral, onde a linha não identifica a
    pessoa.
    Se o RH não completar o caminho, o rascunho fica parado: é exatamente o
    "rascunho sem saída" a evitar.
- **Para "abrir a solicitação na visão coletiva"** seria preciso mudar a tela
  coletiva: rota ou estado de entrada com pessoa, vínculo e solicitação, e o
  seletor sem teto de 100. Isso altera a tela coletiva, fora do limite desta
  tarefa.
- **Permissões:** RH registra; `master_tecnico` lê; DP sem aba.
- **Vínculo, tipo, motivo:** como na opção 3.
- **Auditoria:** `pessoas_solicitacao_criada`; o envio fica para depois.
- **Idempotência e rede:** registro não idempotente (seção 2.2).
- **Guarda:** formulário na ficha; a navegação para a tela coletiva sai da
  ficha (pergunta se houver formulário aberto).
- **URLs e foco:** troca de rota para Pessoas › Solicitações, que hoje não tem
  rota — o foco e o "voltar" do navegador ficam sem destino definido.
- **Decisões pendentes:** as da opção 3, mais a forma de entrada na tela
  coletiva.
- **Avaliação:** a mais frágil. Divide a mesma tarefa em duas telas e depende
  de mudanças na tela coletiva.

### 4.3 Opção 3 — registrar e enviar pela ficha (recomendada)

- **Contratos e estados:** `POST /solicitacoes-pessoas` e, em seguida,
  `POST /:id/transicoes` com `acao: "enviar"`. Resultado: `enviada`, com dois
  eventos (`criar`, `enviar`) e duas auditorias.
- **Rascunho:** só existe se o envio falhar depois do registro. Nesse caso:
  - a ficha relê a lista, avisa "Solicitação registrada, mas não enviada" e o
    detalhe da linha mostra "Enviar";
  - qualquer rascunho que a ficha mostra (inclusive os criados na tela
    coletiva) tem "Enviar" no detalhe — nenhum fica sem saída na ficha.
- **Permissões:** só `rh` com empresa vê "Nova solicitação" e "Enviar"
  (mesma regra de `podeMutar`); `master_tecnico` continua só leitura, sem
  nenhum controle; DP sem aba; o servidor decide cada requisição.
- **Campos:** vínculo, tipo, motivo e dia de referência opcional.
  - vínculo: pré-selecionado no principal; seletor só quando a pessoa tem mais
    de um vínculo na empresa, com a situação no rótulo (A-3);
  - tipo: os seis tipos;
  - motivo: o motivo natural do tipo pré-selecionado (A-4);
  - dia de referência: opcional para todos os tipos (A-6).
- **Ativo, previsto, encerrado:** o servidor aceita os três, como a tela
  coletiva. A recomendação A-3 mantém os três, com a situação à vista.
- **Auditoria:** `pessoas_solicitacao_criada` e `pessoas_solicitacao_enviada`
  na ordem; nenhuma auditoria nova.
- **Idempotência e falhas de rede:**
  - registro sem resposta (rede): "Não foi possível confirmar se a solicitação
    foi registrada. Atualize a lista para conferir antes de tentar de novo."
    O formulário fica aberto, o envio não é tentado e nada é repetido sozinho
    (padrão da aba Documentos);
  - registro recusado (400, 403, 404, 422): mensagem da recusa, nada criado;
  - envio sem resposta ou recusado depois do registro: o formulário fecha, a
    lista é relida, e o aviso indica o rascunho e o "Enviar" no detalhe;
  - envio repetido ou concorrente (alguém enviou ou cancelou na tela
    coletiva): 422, mensagem "Esta ação não é mais possível para a situação
    atual" e releitura — sem efeito duplo.
- **Concorrência:** a do servidor (`FOR UPDATE`); a ficha nunca projeta a
  situação localmente, sempre relê.
- **Guarda T200:** formulário com algum campo alterado é edição pendente;
  as duas requisições em curso são salvamento (a guarda espera). Sair da
  ficha, trocar de pessoa ou de empresa pergunta antes. As abas da ficha ficam
  montadas, então trocar de aba não descarta o formulário.
- **Isolamento:** o vínculo vem só de `vinculosDaEmpresa` (pessoa + empresa
  da sessão); `empresaId` é o da sessão; o servidor confere os dois (404 fora
  do escopo). Troca de empresa remonta a árvore depois da guarda.
- **URL:** nenhuma nova. O formulário e o detalhe não vão à URL; recarregar
  com o formulário aberto passa pela guarda do navegador da T200.
- **Foco e anúncios:**
  - "Nova solicitação" leva o foco ao título do formulário;
  - "Revisar" mostra o resumo e leva o foco ao título da confirmação;
    "Voltar" volta ao formulário com os valores; "Confirmar e enviar" grava;
  - sucesso: aviso de status "Solicitação de {tipo} registrada e enviada." e
    o foco no título do bloco do vínculo;
  - erro: alerta único no lugar, foco no alerta;
  - "Cancelar" (fecha o formulário, não é a transição) devolve o foco a
    "Nova solicitação";
  - o anúncio da lista segue a regra do B1 da T203 (uma vez por leitura).
- **375 px:** campos empilhados, botões de 44 px, resumo em lista de
  definição, sem rolagem horizontal.
- **Decisões pendentes:** A-1 a A-6 (seção 9).
- **Tamanho:** médio — a seção ganha um formulário com confirmação e uma ação
  no detalhe; nenhum contrato novo.

### 4.4 Opção 4 — fluxo completo pela ficha (só estimativa)

- **Contratos:** os mesmos, com as oito ações.
- **Exigiria:** ações por situação, motivo obrigatório em recusar e reabrir,
  confirmação para as ações terminais (cancelar, recusar, encaminhar),
  tratamento de 404/409/422 por ação e mensagens próprias — o equivalente às
  cerca de 1.400 linhas da tela coletiva dentro da ficha.
- **Problema:** duplica a fila do RH em dois lugares, com dois conjuntos de
  testes e regras que podem divergir; a análise do RH é trabalho de fila, não
  de ficha.
- **Avaliação:** grande; **fora de escopo**. Só faria sentido se a tela
  coletiva deixasse de existir, o que nenhuma decisão prevê.

### 4.5 Quadro-resumo

| Critério                | 1. Sem ação | 2. Registrar e voltar               | 3. Registrar e enviar       | 4. Fluxo completo       |
| ----------------------- | ----------- | ----------------------------------- | --------------------------- | ----------------------- |
| Contratos novos         | nenhum      | nenhum na API; muda a tela coletiva | nenhum                      | nenhum                  |
| Cria rascunho           | não         | sempre                              | só se o envio falhar        | sim                     |
| Rascunho tem saída?     | —           | só na tela coletiva (com limites)   | sim, "Enviar" na ficha      | sim                     |
| Ações irreversíveis     | nenhuma     | nenhuma na ficha                    | nenhuma                     | cancelar, recusar       |
| Guarda T200             | não         | sim                                 | sim                         | sim, vários formulários |
| Duplica a tela coletiva | não         | parcialmente (entrada)              | não (2 de 9 ações, entrada) | sim                     |
| Completa sozinha        | sim         | não                                 | sim                         | sim                     |
| Tamanho                 | zero        | médio + tela coletiva               | médio                       | grande                  |

## 5. Proposta da primeira fatia (opção 3)

### 5.1 Escopo

- **Na aba Solicitações, só para `rh` com empresa:**
  - botão "Nova solicitação" acima dos blocos;
  - formulário: vínculo (quando houver mais de um), tipo, motivo e dia de
    referência opcional;
  - passo de confirmação com o resumo e "Confirmar e enviar";
  - gravação: registro e envio em sequência, sem repetição automática;
  - no detalhe de uma solicitação em `rascunho`: "Enviar", com confirmação.
- **Aviso fixo atualizado:** "Registrar e enviar pedidos da pessoa pode ser
  feito aqui. Analisar, encaminhar, recusar, reabrir e cancelar continuam em
  Pessoas › Solicitações."
- **`master_tecnico`:** sem nenhum controle de escrita.
- **DP:** sem aba (como hoje).
- **Sem mudança** na tela coletiva, na API e nas demais abas.

### 5.2 Contratos reaproveitados

- `GET /v1/users/me` (papel e empresa);
- os vínculos que a ficha já lê;
- `GET /v1/solicitacoes-pessoas?vinculoId=`, detalhe e histórico (T203);
- `POST /v1/solicitacoes-pessoas` e
  `POST /v1/solicitacoes-pessoas/:solicitacaoId/transicoes` (`enviar`).

**Mudanças necessárias:** nenhuma na API. No web: a seção recebe
`onAlteradoChange`/`onSalvandoChange` (como Documentos), o papel do ator para
decidir os controles, e a ficha compõe os dois sinais na guarda.

**Testes de API a acrescentar (só do contrato existente):** registrar e
enviar em sequência para vínculo ativo, previsto e encerrado da mesma pessoa;
`master_tecnico` com empresa ativa recebendo 403 no registro e no envio, sem
nada gravado.

### 5.3 O que não entra

- cancelar, iniciar revisão, aguardar informação, retomar, encaminhar,
  recusar e reabrir na ficha;
- "só registrar" (rascunho de propósito) na ficha;
- anexo, CID, texto livre, arquivo, foto, upload, download e visualização;
- solicitações de documento (aba Documentos);
- mudança na tela coletiva (URL, pré-seleção, seletor sem teto de 100);
- chave de idempotência ou qualquer mudança de API.

## 6. Critérios de aceite

1. "Nova solicitação" aparece só para `rh` com empresa ativa; nunca para
   `master_tecnico`; a aba continua ausente para o DP.
2. O formulário oferece só os vínculos da pessoa na empresa ativa, com o
   principal pré-selecionado e a situação no rótulo.
3. "Confirmar e enviar" registra e envia; a lista relida mostra a solicitação
   como "Enviada" no bloco do vínculo escolhido, com dois eventos na linha do
   tempo.
4. Registro sem resposta não tenta o envio, não repete sozinho e orienta a
   conferir a lista; registro recusado não cria nada.
5. Envio que falha depois do registro deixa o rascunho visível com "Enviar" no
   detalhe; enviar repetido ou concorrente recebe a mensagem de situação
   alterada e a lista relida.
6. Formulário alterado e gravação em curso acionam a guarda T200 ao sair da
   ficha, trocar de pessoa ou de empresa; sem alteração, nada pergunta.
7. Foco e anúncios conforme a seção 4.3; um anúncio por evento.
8. A 375 px não há rolagem horizontal da página.
9. Nenhuma outra ação da máquina de estados aparece na ficha.

## 7. Plano de testes

- **Unidade (web), seção:**
  - controles por papel (`rh` com e sem empresa, `master_tecnico`);
  - vínculos oferecidos (só pessoa + empresa; principal primeiro; situação);
  - confirmação, "Voltar" sem perder valores e "Cancelar";
  - sucesso com as duas chamadas na ordem e o corpo exato (empresa da sessão);
  - registro sem resposta: sem envio, sem repetição, mensagem;
  - registro recusado (400, 403, 404, 422);
  - envio falhando depois do registro: rascunho com "Enviar";
  - "Enviar" no detalhe: sucesso, 422 concorrente, 404;
  - guarda: `onAlteradoChange` e `onSalvandoChange` nos momentos certos;
  - respostas atrasadas e desmontagem durante a gravação;
  - foco e anúncios.
- **Shell (`App.ficha.test.tsx`):** guarda ao sair da ficha com o formulário
  alterado; troca de empresa durante a gravação; `master_tecnico` sem
  controles; DP sem aba.
- **API (só testes):** os da seção 5.2.
- **Prova de falha** para cada proteção, como nas T201 a T203.
- **Localhost** com dados sintéticos: RH registra e envia nos vínculos ativo
  e encerrado; falha simulada no envio; conferência na tela coletiva;
  `master_tecnico`; DP; teclado; 375 px.
- **Bateria completa:** web, API unitária, E2E com PostgreSQL real, scripts,
  lint, typecheck, build, Prettier, `spec:check`, prévia do squash e
  `git diff --check`.

## 8. Riscos

| Risco                                 | Cuidado                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Registro duplicado                    | Sem repetição automática; botão desabilitado durante a gravação; registro sem resposta orienta conferir a lista antes de tentar de novo |
| Rascunho órfão                        | Envio em seguida ao registro; falha do envio deixa "Enviar" no detalhe; todo rascunho visível na ficha tem "Enviar"                     |
| Envio concorrente com a tela coletiva | 422 do servidor, mensagem e releitura; nada projetado localmente                                                                        |
| Isolamento                            | Vínculo só de `vinculosDaEmpresa`; `empresaId` da sessão; servidor confere (404); troca de empresa remonta depois da guarda             |
| `master_tecnico` agindo               | Nenhum controle; o servidor nega com 403 e auditoria                                                                                    |
| Perda de edição                       | Guarda T200 com pendente e salvando; abas montadas                                                                                      |
| Motivo inadequado                     | Motivo natural pré-selecionado (A-4); motivos de decisão do RH fora do formulário                                                       |
| Dado sensível (Atestado)              | Só tipo, motivo e datas; sem anexo, CID ou texto; a auditoria não leva o tipo                                                           |
| Auditoria de leitura em volume        | Releitura só depois de gravar; não reler ao abrir ou fechar o formulário                                                                |
| Divergência com a tela coletiva       | Mesmos contratos, rótulos e mensagens do cliente; o servidor é a autoridade                                                             |

## 9. Decisões (aprovadas em 2026-11-09)

A-1 a A-6 aprovadas como recomendado.

| Id  | Pergunta                                          | Recomendação                                                                                                                                           |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-1 | Qual opção entra?                                 | **Opção 3**: registrar e enviar pela ficha, mais "Enviar" no detalhe de rascunho; o resto na tela coletiva                                             |
| A-2 | Registrar e enviar juntos ou em passos separados? | **Juntos**, num só "Confirmar e enviar" com resumo antes; sem "só registrar" na ficha, para não nascer rascunho de propósito                           |
| A-3 | Quais vínculos o formulário oferece?              | **Todos os da pessoa na empresa ativa**, como o servidor e a tela coletiva; principal pré-selecionado; situação (ativo, previsto, encerrado) no rótulo |
| A-4 | Motivo no registro                                | **Motivo natural do tipo pré-selecionado**, com "Outro (controlado)" como única alternativa; os motivos de decisão do RH ficam fora do formulário      |
| A-5 | Cancelar rascunho ou enviada na ficha?            | **Não nesta fatia**: cancelar é terminal e continua na tela coletiva; o rascunho tem saída pelo "Enviar"                                               |
| A-6 | Dia de referência                                 | **Opcional para todos os tipos**, como no servidor; nenhuma regra por tipo inventada                                                                   |

## 10. Observações fora desta tarefa

- **O-1 — seletor da tela coletiva limitado a 100 colaboradores**
  (`SolicitacoesScreen.tsx:243`): numa empresa maior, parte das pessoas não
  pode ser escolhida em Pessoas › Solicitações. Não muda aqui; registrado para
  uma tarefa própria.
- **O-2 — registro sem chave de idempotência:** a proteção contra duplicidade
  é só do cliente. Uma chave no servidor exigiria mudança de API e de schema.

## 11. Limites e fora de escopo

- **Nesta preparação:** nenhum código de produto, API, schema, migration,
  RBAC, auditoria, Docker, seed, dependências, lockfile ou workflow; sem push
  e sem PR.
- **Na fatia recomendada:** só web na aba Solicitações, mais testes de API do
  contrato existente; sem mudança na tela coletiva.
- **Sempre:** solicitações de documento na aba Documentos; sem anexo, CID,
  texto livre ou dado clínico; nenhuma ação além de registrar e enviar.

## 12. Entrega da primeira fatia

### 12.1 O que foi feito

- **"Nova solicitação"** na aba Solicitações, só para `rh` com empresa ativa
  (o papel e a empresa vêm de `GET /v1/users/me`, como na tela coletiva). Não
  aparece para `master_tecnico`, com a lista em falha nem sem vínculo na
  empresa; o DP continua sem a aba.
- **Janela do Evolli** (`NovaSolicitacaoModal`, sobre o `Modal`): foco no
  título ao abrir, foco preso, Escape e "Cancelar" pelo mesmo caminho, e
  confirmação de descarte quando há alteração.
  - **Formulário:** tipo (os seis), vínculo (todos os da pessoa na empresa
    ativa, o principal pré-selecionado, situação no rótulo), motivo (o natural
    do tipo, com "Outro (controlado)" como única alternativa —
    `MOTIVO_NATURAL_POR_TIPO`) e dia de referência opcional, validado (ano de
    1900 a 2100 e dia existente).
  - **Revisão:** "Confira antes de enviar", com tipo, vínculo, motivo e o dia
    quando preenchido; "Voltar" mantém os valores; uma só ação, "Confirmar e
    enviar".
- **Gravação:** `POST /v1/solicitacoes-pessoas` e, em seguida,
  `POST /:id/transicoes` com `enviar`, uma vez cada, com trava síncrona contra
  clique repetido e sem repetição automática.
  - **Registro recusado** (400, 403, 404, 409, 422, sessão expirada): aviso de
    que nada foi registrado; o formulário volta com os valores; nada é
    enviado.
  - **Registro incerto** (rede ou 5xx): aviso de que não foi possível
    confirmar; nada é enviado nem repetido; ao fechar a janela, a lista é
    relida para conferir.
  - **Envio falhando depois do registro:** a janela fecha, a lista é relida e
    o detalhe daquele rascunho abre com o aviso e **"Enviar" — só para ele**
    (o rascunho que esta ficha registrou e não enviou; por instrução da
    implementação, nenhum outro rascunho ganha ação na ficha).
  - **"Enviar" repetido ou concorrente:** a resposta do servidor (422 ou 404)
    vira aviso no detalhe, e a situação é relida — sem efeito duplo.
  - **Desmontagem entre o registro e o envio:** o envio do registro
    recém-criado acontece mesmo assim (a pessoa confirmou), sem atualizar a
    tela.
- **Sucesso:** a janela fecha, a lista é relida sem "Carregando…" (no lugar)
  e mostra a solicitação "Enviada"; o foco vai ao título do bloco do vínculo;
  o nó de status anuncia "Solicitação de {tipo} registrada e enviada." uma
  vez (um `span` novo no mesmo nó), sem repetir o anúncio da lista (B1 da
  T203).
- **Guarda T200 e troca de empresa:** a janela se declara "Nova solicitação"
  enquanto houver alteração (pendente) ou gravação (salvando); o envio pelo
  detalhe se declara "Envio da solicitação" (salvando).
- **Aviso fixo** para o RH: "Registro e envio" — analisar, encaminhar,
  recusar, reabrir e cancelar continuam em Pessoas › Solicitações. O
  `master_tecnico` continua com "Somente consulta".
- **375 px:** formulário e revisão empilhados numa coluna que encolhe; campos
  e botões com o alvo de toque do Evolli.
- **Sem mudança** na API, na tela coletiva e nas demais abas. Cancelar e as
  seis transições de análise não aparecem na ficha.

### 12.2 Testes e validação

- **Web:**
  - `SolicitacoesColaboradorSecao.registro.test.tsx` (28 casos): quem vê;
    vínculos e rótulos; tipos e motivos; validação; revisão e "Voltar";
    Escape e descarte; sucesso (corpo exato, ordem, lista, foco, um anúncio,
    mesmo nó de status); dia vazio e vínculo previsto; clique repetido e
    Escape durante o envio; registro recusado (5 status) e incerto (rede e
    5xx); envio falhando depois do registro e "Enviar"; "Enviar" concorrente;
    rascunho que a ficha não criou; nenhuma transição fora de escopo;
    desmontagem; registro de edições (pendente e salvando); 375 px;
  - `SolicitacoesColaboradorSecao.test.tsx` (24 casos): o caso "só leitura"
    agora cobre `master_tecnico` e um papel sem escrita;
  - `App.ficha.test.tsx` (4 casos T204): guarda ao sair da ficha com a janela
    alterada, com o registro em curso e sem alteração; `master_tecnico` sem
    o botão;
  - `AutenticacaoApp.test.tsx`: troca de empresa com a janela alterada.
- **API (só testes, `solicitacoes-pessoas.e2e-spec.ts`, 9 casos):** registrar
  e depois enviar em vínculo ativo, previsto e encerrado (criados pelos
  fluxos reais de admissão e desligamento), com os eventos e as auditorias;
  escopo entre empresas; `master_tecnico` com empresa e DP negados; envio
  repetido e simultâneo (um 201 e um 422, um evento, uma auditoria); envio
  depois de cancelada; registro não idempotente.
- **Prova de falha:** cada mutação abaixo derruba ao menos um teste:
  - qualquer papel com empresa registra;
  - sem trava contra clique repetido (confirmação);
  - registro recusado ainda envia;
  - registro incerto repetido automaticamente;
  - envio falho sem "Enviar" no rascunho;
  - "Enviar" para qualquer rascunho;
  - motivo natural trocado;
  - vínculo pré-selecionado diferente do principal;
  - janela que não se declara alterada (guarda e descarte);
  - releitura silenciosa apagando o aviso de sucesso;
  - sucesso sem foco no bloco do vínculo;
  - desmontagem abandonando o rascunho;
  - dia fora do calendário aceito;
  - envio falho sem abrir o detalhe;
  - "Enviar" do detalhe sem trava contra clique repetido.
- **Achados na própria entrega e corrigidos:** o foco depois de um erro de
  registro caía no título do passo que saía (ids de título distintos por
  passo); duas chamadas redundantes ao sinal do anúncio da lista (mutação
  equivalente) foram removidas; a fixture de vínculo ativo por SQL foi
  trocada pelos fluxos reais de admissão e desligamento.
- **Resultados:** web 3309 testes; API unitária 1472; E2E com PostgreSQL real
  1013 testes (20 suítes); scripts 182; lint, typecheck, build, Prettier, `spec:check`,
  prévia do squash e `git diff --check`: verdes.
- **Localhost:** pendente — a prévia está no ar (web 5173 e API 3204 da T204, no banco sintético isolado da T203), mas a entrada com a conta sintética de RH precisa ser feita pela proprietária no navegador; o fluxo ainda não foi exercitado no localhost.
