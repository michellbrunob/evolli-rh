# T209 — Colaboradores (dossiê de preparação)

- **Estado:** **em implementação local**. As decisões C-1 a C-15 (seção 10) foram
  **aprovadas em 2026-11-13**, com a C-10 corrigida (seção 13). O **Bloco C (importação CSV)
  está pausado**: o contrato atual de admissão exige a data de nascimento, que a C-10 corrigida
  exclui da planilha (seção 13.2). Os **Blocos A e B estão implementados e validados
  localmente** (seções 14 a 16), em commits locais, sem push, PR, Ready ou merge, à espera da
  validação visual.
- **Base:** `main` em `5b4c498fe0f44ccdfdf233a25c9568aad94eb8f2` (T208 integrada, PR #201).
- **Objetivo:** levar Colaboradores de uma listagem de consulta a uma **área de trabalho do RH e
  do DP**: listagem operacional, atalhos por pessoa e entrada de várias pessoas de uma vez, numa
  entrega priorizada para o prazo do ecossistema, sem expor dado pessoal além do que a listagem
  já mostra.

Todas as referências abaixo são ao código desta base. Caminhos sem prefixo partem da raiz do
repositório.

## 1. Resumo

- A listagem já tem **indicadores, abas, busca, filtros, paginação, tabela e estados** (T184 a
  T199), com URL canônica e isolamento por empresa. O que falta para o uso diário é **operar**:
  escolher o tamanho da página, saltar entre páginas, ir direto à aba certa da ficha e trazer
  várias pessoas de uma vez.
- **Não existe** endpoint de exportação, importação ou ação em lote, nem ação `export` no RBAC
  (`apps/api/src/auth/authorization/permission.types.ts:171-177`). A tabela não tem seleção nem
  ordenação (`apps/web/src/components/DataTable.tsx:10-11`).
- A **importação por planilha** pode ser feita **sobre o contrato atual de admissão**
  (`POST /v1/colaboradores`, com `Idempotency-Key`), uma admissão por linha — a opção recomendada
  na D11 da T194 —, desde que as decisões D10 a D12 da T194 sejam tomadas agora (aqui, C-7 a
  C-12).
- **CPF, salário e remuneração não existem no schema** (`apps/api/prisma/schema.prisma:956-964`)
  e continuam fora. Exportação de pessoas segue aberta (`DP-ADM-03`) e fica indisponível.
- **Achado de consistência:** o aviso fixo da listagem diz que a consulta gera trilha de
  auditoria, mas a listagem e o detalhe só são auditados na consulta global do master técnico
  (seção 7.1).

## 2. Escopo e método

Levantamento, só em leitura, de rotas, listagem, abas, busca, filtros, paginação, indicadores,
tabela, ficha, permissões, isolamento por empresa, ações, exportações, importação, contratos,
exposição de campos, comportamento por papel, acessibilidade, foco, teclado, URL, respostas
atrasadas, 375 px, guarda de saída e troca de empresa.

Uma referência visual privada foi usada **só localmente**, como lembrete da organização funcional
de uma tela de colaboradores (indicadores, abas, busca, filtros, tabela e ações). **Nada dela é
registrado** aqui, em teste, commit ou PR: nem marca, textos, nomes, dados, imagens ou layout.
Toda proposta abaixo parte do Evolli e das decisões já aprovadas.

## 3. Levantamento

### 3.1 Rotas e URL

- Destinos fixos: `#/pessoas/colaboradores` e `#/pessoas/nova-admissao`
  (`apps/web/src/app/rotasDoShell.ts:44-52`).
- Listagem com estado na URL (T199): `?aba=&pagina=&departamento=&cargo=&tipo=`.
  - Abas `ativos` (inicial), `em-admissao`, `desligados`, `todos` e `jornada`
    (`rotasDoShell.ts:179-185`, `224-230`).
  - Tipos `clt`, `estagio`, `pj`, `temporario` e `outro_controlado` (`rotasDoShell.ts:192-198`).
  - **O texto da busca nunca vai para a URL** (`rotasDoShell.ts:202-205`, `264-265`).
  - Valor inválido cai no padrão; página de 1 a 100.000; departamento e cargo só como UUID
    (`rotasDoShell.ts:267-290`). URL canônica, só com o que difere do padrão
    (`rotasDoShell.ts:296-306`).
  - Departamento e cargo só valem em Ativos e Todos (`rotasDoShell.ts:240-242`); a aba Jornada
    zera página, lotação e tipo (`rotasDoShell.ts:249-258`).
- Ficha: `#/pessoas/colaboradores/:uuid/:aba[/AAAA-MM]` com as abas `dados`, `vida-funcional`,
  `contratuais`, `jornada`, `documentos`, `ponto` e `solicitacoes` (`rotasDoShell.ts:80-88`,
  `138-173`). Para o DP, `solicitacoes` vira `dados` (`apps/web/src/app/mapaNavegacao.ts:154-164`).
- Troca de empresa recria a árvore; a Nova admissão volta à listagem
  (`rotasDoShell.ts:449-471`). O menu devolve a listagem ao estado inicial
  (`apps/web/src/app/App.tsx:1056-1068`).
- As demais abas de Pessoas (Horário, Histórico funcional, Dados contratuais etc.) **não têm URL**
  (`rotasDoShell.ts:23-26`).

### 3.2 Listagem (`apps/web/src/screens/pessoas/ColaboradoresScreen.tsx`)

- **Indicadores** (`:1144-1241`): Ativos, Em admissão, Desligados e Total ("nesta empresa" ou "no
  seu escopo"); "Ativos por tipo de vínculo" com legenda em texto. Valem para o escopo inteiro,
  sem busca, filtro nem aba.
- **Abas** (`:59-76`, `:96-111`): grupos exclusivos (ativo > previsto > encerrado), mais Todos e
  Jornada de trabalho (só o RH opera, `:1295-1304`). Setas, Home e End (`:856-869`); nome
  acessível com o total (`:1267-1271`).
- **Busca** (`:1320-1356`, `:875-893`): "Buscar por nome ou matrícula", só no envio; sem mínimo,
  teto de 160 caracteres.
- **Filtros** (`:1360-1457`): Departamento e Cargo (catálogos ativos, uma página de 100,
  `:709-741`) e Tipo de vínculo; chips removíveis com foco no chip seguinte (`:1473-1530`); id da
  URL conferido no catálogo antes de virar consulta (`:590-624`).
- **Paginação** (`:196`, `:743`, `:1704-1735`): 20 por página, fixo; "Página anterior",
  "Próxima página" e "Página X de Y". Sem seletor de tamanho e sem páginas numeradas.
- **Colunas** (`:993-1108`): Colaborador (iniciais; nome como botão "Abrir ficha de …"),
  Matrícula ("+N" com outros vínculos), Cargo, Departamento, Jornada de trabalho (vigente hoje),
  Tipo, Situação, Admissão e, só em Desligados, Desligamento.
- **Ações:** por linha, só abrir a ficha; no cabeçalho, "Adicionar colaborador" para quem admite
  (`:1121-1139`; o comentário registra "nada de exportar", `:1128`).
- **Estados** (`:914-990`, `:1532-1688`): carregando, erro com "Tentar novamente", vazio por aba,
  vazio da consulta com limpar busca/filtros, página além do fim e anúncios únicos.
- **Respostas atrasadas** (`:483`, `:512`, `:531`, `:560`): número de sequência descarta a
  resposta antiga; **sem `AbortController`** — o cliente `listarColaboradores` não aceita `signal`
  (`apps/web/src/api/colaboradoresClient.ts:399`).

### 3.3 Ficha e entrada

- Ficha (`apps/web/src/screens/pessoas/FichaColaboradorScreen.tsx`): só contratos existentes; a
  aba Dados tem a edição do nome (RH e DP), Dados pessoais e Contatos (`:1015-1079`).
- Painel "Adicionar colaborador" (`apps/web/src/screens/pessoas/PainelAdicionarColaborador.tsx:105-136`):
  cadastro individual disponível; "Importar planilha" e "Admissão digital" desabilitados, com o
  motivo.
- Nova admissão (`NovaAdmissaoScreen.tsx`): quatro etapas (T195), só `rh` e `dp`.

### 3.4 Contratos da API

| Rota                                                                 | Permissão                | Evidência                                 |
| -------------------------------------------------------------------- | ------------------------ | ----------------------------------------- |
| `GET /v1/colaboradores`                                              | `colaborador`/read       | `colaborador.controller.ts:72-85`         |
| `GET /v1/colaboradores/:id`                                          | `colaborador`/read       | `colaborador.controller.ts:87-100`        |
| `POST /v1/colaboradores` (`Idempotency-Key` opcional)                | `colaborador`/create     | `colaborador.controller.ts:102-125`       |
| `PATCH /v1/colaboradores/:id` (só o nome)                            | `colaborador`/alter      | `colaborador.controller.ts:127-143`       |
| `GET /v1/colaboradores/:id/vinculos`                                 | `vinculo_funcional`/read | `colaborador.controller.ts:145-158`       |
| `GET`/`PUT /v1/colaboradores/:id/contatos`                           | ficha de contatos        | `contato-colaborador.controller.ts:36-62` |
| `GET`/`PUT /v1/colaboradores/:id/dados-pessoais`                     | ficha de dados pessoais  | `dados-pessoais.controller.ts:35-61`      |
| `GET`/`POST /v1/movimentacoes` e `:id/{cancelar,efetivar,retificar}` | `rh` e `dp`              | `movimentacao.controller.ts:34-107`       |

Todos os controladores ficam em `apps/api/src/pessoas/`. **Não existe `DELETE`** de colaborador
(`colaborador.controller.ts:53-56`).

- **Query da listagem** (`apps/api/src/pessoas/dto/pessoas.dto.ts`): `pagina` ≥ 1,
  `tamanhoPagina` de 1 a 100, padrão 20 (`:334-347`); `empresaId` só filtra dentro do escopo
  (`:361-363`); `busca` até 160 caracteres, sem mínimo (`:349-385`); `departamentoId`, `cargoId`,
  `grupo` e `tipoVinculo` (`:393-418`). **Ordem fixa** por nome e id (`colaborador.service.ts:1263`).
- **Admissão** (`AdmitirColaboradorDto`, `pessoas.dto.ts:169` em diante): obrigatórios `nome`,
  `empresaId`, `departamentoId`, `cargoId`, `tipo`, `dataAdmissao`, `motivoCodigo`
  (`admissao_inicial` ou `outro_controlado`, `:85-88`) e `perfilPessoal.dataNascimento`; o resto
  é opcional (`dados-pessoais.dto.ts:75` em diante). Matrícula, quando vem, é única na empresa.
- **Auditoria:** consulta global do master auditada (`colaborador.service.ts:1316-1319`,
  `:1460-1467`); mutações auditadas (`:769-785`, `:947`, `:1412`); leitura de contatos auditada
  (`contato-colaborador.service.ts:237-243`). A listagem e o detalhe **não** são auditados para
  RH e DP.

### 3.5 Exportação, importação e lote

- Nenhum endpoint de exportação, importação ou lote em `apps/api/src`.
- O único CSV do produto é **gerado no navegador**, no Dashboard (T207), só com números agregados
  (`apps/web/src/screens/dashboard/exportacao.ts`).
- `RelatorioListagemColaboradoresScreen.tsx` é só demonstração.

## 4. Exposição de campos

| Campo                                                                                 | Listagem hoje | Proposta T209                                         | Base                           |
| ------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------- | ------------------------------ |
| Nome, matrícula, cargo, departamento, jornada, tipo, situação, admissão, desligamento | sim           | mantém                                                | T184–T199                      |
| Data de nascimento                                                                    | não           | **não** (nem na listagem nem na importação; seção 13) | ficha de dados pessoais (T177) |
| E-mail pessoal, celular, telefone                                                     | não           | **não** (nem na importação, C-10)                     | ficha de contatos; T199 §6     |
| Endereço e demais dados pessoais                                                      | não           | **não**                                               | ficha de dados pessoais        |
| CPF                                                                                   | inexistente   | **indisponível**                                      | `DP-ADM-04`, `DP-FLX-05`       |
| Salário e remuneração                                                                 | inexistente   | **indisponível**                                      | DP-14, DP-18                   |

## 5. Comportamento por papel

| Papel                                                          | Listagem e ficha                     | Admitir / importar   | Editar ficha | Exportar   |
| -------------------------------------------------------------- | ------------------------------------ | -------------------- | ------------ | ---------- |
| `rh`                                                           | empresa ativa                        | sim / proposta (C-9) | sim          | não existe |
| `dp`                                                           | empresa ativa (sem aba Solicitações) | sim / proposta (C-9) | sim          | não existe |
| `master_tecnico`                                               | só lê; global sem empresa (auditado) | não                  | não          | não existe |
| `gestor`                                                       | negado; usa "Minha equipe"           | —                    | —            | —          |
| `colaborador`, `financeiro`, `auditor`, `dpo`, `admin_tecnico` | negado                               | —                    | —            | —          |

Fontes: `apps/api/src/auth/authorization/rbac.evaluator.ts:337-392`, `:652-740`, `:820-879`;
`apps/web/src/app/mapaNavegacao.ts:117`, `:542-553`, `:584-624`; escopo em
`apps/api/src/pessoas/escopo-pessoas.util.ts:63-92`.

## 6. Qualidade transversal

| Tema                | Hoje                                                                         | Na T209                                                                                  |
| ------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Teclado e foco      | abas com setas/Home/End; chips devolvem o foco; erro foca "Tentar novamente" | paginação numerada e menu de ações operáveis por teclado; foco previsível após cada ação |
| Leitor de tela      | anúncios únicos (`role="status"`)                                            | anúncio do intervalo exibido e do progresso/resultado da importação                      |
| URL                 | canônica; busca fora                                                         | `tamanho` entra na URL (C-2); busca continua fora                                        |
| Respostas atrasadas | sequência descarta a antiga                                                  | `AbortController` também cancela o pedido antigo                                         |
| 375 px              | abas em grade; tabela rola no quadro                                         | paginação e menu de ações sem rolagem horizontal da página                               |
| Guarda de saída     | só na aba Jornada                                                            | importação com arquivo carregado ou em andamento usa a guarda global (T200)              |
| Troca de empresa    | árvore recriada                                                              | importação em andamento bloqueia a troca pela guarda; ao trocar, o arquivo é descartado  |

## 7. Lacunas e achados

### 7.1 Achados

1. **Aviso de auditoria impreciso** (`ColaboradoresScreen.tsx:1754-1757`): diz que "consulta"
   gera trilha, mas só a consulta global do master e a leitura de contatos são auditadas.
2. **Sem cancelamento de pedido** (seção 3.2): a resposta velha é descartada, mas a requisição
   segue até o fim.
3. **Colisão de identificadores:** a T197 reusou "D10–D12" para a criação inline (aprovadas); as
   D10–D12 da **importação**, na T194, seguem pendentes. Este dossiê as trata como C-8, C-9 e
   C-7 para evitar nova colisão.

### 7.2 Lacunas

| Lacuna                                             | Situação                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Importação por planilha                            | D10–D12 da T194 pendentes; `DP-FLX-17` (origem) aberto; sem ficha de tratamento |
| Ações em lote                                      | sem endpoint e sem seleção na tabela; nenhuma decisão além da D11 da T194       |
| Exportação de pessoas                              | `DP-ADM-03` aberto; sem ação `export` no RBAC nem verbo de auditoria            |
| Ordenação pelo usuário                             | ordem fixa no servidor por regra                                                |
| Filtros por unidade, área, equipe, centro de custo | a API da listagem não os aceita                                                 |
| Catálogos com mais de 100 itens                    | pendência aberta da T190/T199                                                   |
| Abas de Pessoas sem URL                            | limitação conhecida (`rotasDoShell.ts:23-26`)                                   |

## 8. Classificação

### 8.1 Com contratos atuais (só web)

- Seletor de tamanho de página 20/50/100 (a API aceita até 100).
- Paginação numerada, com primeira e última página e "Mostrando X–Y de Z".
- Menu "Ações" por linha com atalhos às abas da ficha permitidas ao papel.
- `AbortController` na listagem (parâmetro `signal` opcional no cliente).
- Texto do aviso de auditoria corrigido.
- **Importação CSV no navegador** sobre `POST /v1/colaboradores`, uma admissão por linha com
  `Idempotency-Key` própria — **desde que** C-7 a C-12 sejam aprovadas.

### 8.2 Exige API, migration, RBAC, auditoria ou decisão de produto

- Verificação da planilha no servidor sem gravar (contrato novo) e lote no servidor.
- Registro da origem "importação" na admissão (`DP-FLX-17`; migration).
- Evento de auditoria do lote, só com contagens (contrato novo).
- Exportação de pessoas: `DP-ADM-03`, ação `export` no RBAC, verbo de auditoria.
- Ações em lote (desligar, transferir, mudar cargo): endpoints e regras por item.
- Ordenação escolhida pelo usuário (parâmetro aditivo e índice).
- Filtros por unidade, área, equipe ou centro de custo.
- Catálogos de filtro com mais de 100 itens.
- Tipo Aprendiz (D16 aprovada, mas exige enum e migration; D21 pendente).
- Desligar a partir da listagem (contrato existe; lugar na tela é decisão de produto).

### 8.3 Deve continuar indisponível

- CPF, salário e remuneração.
- Contatos e dados pessoais na listagem ou na planilha.
- Admissão digital (D13 da T194; ADR 0016 §5.3).
- Férias, ausências e escala (sem modelo; D-5 da T199).
- Organograma (ADR 0006 d.8; `DP-16`).
- Colaboradores para gestor, colaborador, financeiro, auditor, DPO e administração técnica.
- Mutações pelo master técnico.
- Texto da busca na URL.
- Exclusão física de colaborador.

## 9. Proposta da primeira fatia (T209)

Uma entrega, três blocos, **sem API nova, sem migration e sem mudança de RBAC**. O bloco C só
entra se C-7 for aprovada como recomendado; sem ele, a T209 fica com A e B.

### Bloco A — Listagem operacional

1. Seletor "Itens por página" (20, 50, 100), refletido na URL como `tamanho` (só quando difere
   de 20) e voltando à página 1 ao mudar.
2. Paginação numerada com primeira, anterior, janela de páginas, próxima e última; "Mostrando
   X–Y de Z colaboradores"; `aria-current="page"` na atual.
3. `AbortController` na listagem e nos contadores, mantendo o número de sequência.
4. Aviso de auditoria corrigido (C-6).

### Bloco B — Atalhos por pessoa

1. Botão "Ações" por linha (menu acessível, teclado e 375 px) com os atalhos às abas da ficha que
   têm rota e que o papel vê: Dados, Vida funcional, Dados contratuais, Jornada, Documentos,
   Registros de ponto e, para o RH, Solicitações.
2. Nenhuma mutação a partir da linha.

### Bloco C — Importar planilha (condicionado a C-7 a C-12)

1. Habilita "Importar planilha" no painel "Adicionar colaborador" para RH e DP da empresa ativa.
2. Página própria (`#/pessoas/importar`), em três passos: **modelo e arquivo**, **conferência**,
   **resultado**.
3. Modelo CSV UTF-8 gerado no navegador, com cabeçalho fixo e uma linha de exemplo sintética.
4. Arquivo lido só no navegador, **nunca enviado como arquivo nem guardado**; limite de linhas
   (C-9) e de tamanho.
5. Conferência por linha no navegador: obrigatórios, datas, tipo, referências por **código**
   ativas na empresa; erros por linha com campo e motivo, **sem repetir o valor**.
6. "Importar N colaboradores": envio sequencial, uma admissão por linha, com `Idempotency-Key`
   gerada na conferência (reenvio seguro); progresso anunciado; a guarda global segura a saída.
7. Resultado: admitidas, recusadas (motivo do servidor por linha) e "Tentar de novo só as
   recusadas"; relatório de erros baixável no navegador, sem valores.
8. A auditoria por admissão já existe; não há evento de lote nem registro de origem nesta fatia
   (C-11).

### Validação prevista

Testes com falha antes (regra 8), mutações nas regras de conferência e de paginação, E2E serial
com PostgreSQL real para a admissão repetida com a mesma chave, validação no navegador por RH,
DP e master técnico, 375 px, troca de empresa e guarda de saída, e validação visual humana antes
do push.

## 10. Decisões para aprovação

| Id   | Decisão                              | Recomendação                                                                                                                                                                                                                                        | Alternativa                                          |
| ---- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| C-1  | Recorte da T209                      | **Blocos A, B e C** (fatia maior, para o prazo)                                                                                                                                                                                                     | A e B; importação em tarefa própria                  |
| C-2  | Tamanho da página                    | 20, 50 e 100; padrão 20; na URL como `tamanho`                                                                                                                                                                                                      | só 20 e 50; fora da URL                              |
| C-3  | Paginação                            | numerada com primeira/última e "Mostrando X–Y de Z"                                                                                                                                                                                                 | manter anterior/próxima                              |
| C-4  | Ações por linha                      | menu de atalhos às abas da ficha permitidas ao papel; sem mutação                                                                                                                                                                                   | só o nome como hoje                                  |
| C-5  | Desligar a partir da listagem        | **fora** da T209 (segue no Histórico funcional)                                                                                                                                                                                                     | atalho na linha (decisão de produto e URL)           |
| C-6  | Aviso de auditoria                   | "Admissões, alterações e a leitura de contatos geram trilha de auditoria; o suporte técnico apenas consulta."                                                                                                                                       | remover a frase de auditoria                         |
| C-7  | Gravação da importação (D11 da T194) | uma admissão por linha, `POST /v1/colaboradores` com `Idempotency-Key` própria, envio sequencial                                                                                                                                                    | lote e verificação no servidor (contrato novo)       |
| C-8  | Formato (D10 da T194)                | só CSV UTF-8, separador `;` ou `,` detectado, cabeçalho fixo                                                                                                                                                                                        | também .xlsx (dependência nova)                      |
| C-9  | Quem importa e limite (D12 da T194)  | RH e DP da empresa ativa; até 200 linhas e 1 MB por arquivo; master técnico não                                                                                                                                                                     | só RH; outro limite                                  |
| C-10 | Colunas da planilha                  | **corrigida (seção 13):** obrigatórias: nome, tipo de vínculo, data de admissão, departamento e cargo existentes; opcionais: matrícula e unidade existente. Sem data de nascimento, contatos, endereço, CPF, salário ou qualquer outro dado pessoal | incluir e-mail pessoal e celular (ficha de contatos) |
| C-11 | Origem da importação (`DP-FLX-17`)   | **sem registro** nesta fatia; a admissão fica igual à do cadastro individual                                                                                                                                                                        | migration aditiva com a origem                       |
| C-12 | Ficha de tratamento da importação    | escrever na T209, antes do código (arquivo só no navegador, sem guarda, relatório sem valores)                                                                                                                                                      | —                                                    |
| C-13 | Referência inexistente na planilha   | recusar a linha; **sem criação** de departamento ou cargo pela importação                                                                                                                                                                           | criar pelo código (G1 da T197)                       |
| C-14 | Exportação de pessoas                | **indisponível** (`DP-ADM-03` aberto)                                                                                                                                                                                                               | CSV com auditoria e ação `export` (outra tarefa)     |
| C-15 | Seleção, ações em lote e ordenação   | **indisponíveis** na T209                                                                                                                                                                                                                           | tarefa própria com contrato                          |

## 11. Fora de escopo

CPF, salário, remuneração, contatos e dados pessoais na listagem ou na planilha; exportação de
pessoas; ações em lote; ordenação pelo usuário; filtros novos na API; admissão digital; tipo
Aprendiz; férias, ausências, escala e organograma; acesso de outros papéis; mutação pelo master
técnico; API, migration, RBAC, seed, Docker e workflows; Ready for review e merge.

## 12. Próximo passo

Implementar os Blocos A e B nesta branch (`codex/t209-colaboradores`), com testes que falham
antes, e levar à validação visual. O Bloco C só volta com decisão própria (seção 13.2).

## 13. Aprovação (2026-11-13)

### 13.1 Decisões aprovadas

- **C-1 a C-15 aprovadas** como recomendadas na seção 10, com a **C-10 corrigida**: a planilha
  **não tem data de nascimento**. Colunas obrigatórias: nome, tipo de vínculo, data de admissão,
  departamento existente e cargo existente; opcionais: matrícula e unidade existente. Não são
  aceitos CPF, salário, contato, e-mail, telefone, endereço, nascimento, gênero, documento, foto
  nem qualquer outro dado pessoal; arquivo com coluna proibida ou desconhecida é recusado.
- **Bloco A:** tamanho de página 20, 50 e 100 (padrão 20), na URL pelo parâmetro canônico
  `tamanho`; paginação numerada com primeira e última página, preservando filtros e busca;
  "Mostrando X–Y de Z"; cancelamento das requisições antigas ao mudar busca, filtro, aba,
  página, tamanho ou empresa e ao desmontar a tela; aviso de auditoria só com o que é auditado.
- **Bloco B:** menu "Ações" por linha, só com atalhos às abas da ficha que o papel vê; nenhuma
  edição, desligamento, ação em lote ou controle decorativo.

### 13.2 Conferência do contrato para o Bloco C

- **Referências:** Departamento, Cargo e Unidade têm `codigo` **único por empresa** no banco
  (`@@unique([empresaId, codigo])`, `apps/api/prisma/schema.prisma:792`, `:820`, `:917`), e os
  catálogos o expõem com paginação e `total` (`apps/web/src/api/organizacaoClient.ts:27-31`,
  `:132-140`). O mapeamento por código seria seguro, lendo todas as páginas, sem truncar.
- **Bloqueio:** a admissão exige `perfilPessoal.dataNascimento`
  (`apps/api/src/pessoas/dto/pessoas.dto.ts`, `AdmitirColaboradorDto`, `@IsDefined`;
  `apps/api/src/pessoas/dados-pessoais/dados-pessoais.dto.ts:75-80`), e o banco a grava como
  obrigatória (`schema.prisma:2330`). Sem a data na planilha, toda linha seria recusada.
- **Decisão (2026-11-13):** **pausar o Bloco C** e entregar A e B. Não há API nova, mudança da
  obrigatoriedade nem coluna de nascimento. O Bloco C volta só com decisão própria: perfil
  opcional na admissão (mudança de API e de regra da T177/T179) ou outra solução aprovada. A
  entrada "Importar planilha" do painel continua indisponível, com o motivo de hoje.

## 14. Implementação (Blocos A e B)

Só web; **sem API, migration, RBAC, auditoria nova ou dependência**.

- **Tamanho da página (C-2):** seletor "Itens por página" (20, 50, 100) no rodapé da tabela;
  o estado da listagem ganhou `tamanho`, escrito na URL como `tamanho` só quando difere de 20
  e na ordem canônica (`aba`, `pagina`, `tamanho`, `departamento`, `cargo`, `tipo`). Valor fora
  dos três cai em 20 e a URL é corrigida no lugar. Trocar o tamanho volta à página 1 com aba,
  filtros e busca mantidos. A aba Jornada não leva tamanho (paginação própria).
- **Paginação (C-3):** primeira, anterior, janela de até cinco números (o atual com
  `aria-current="page"`), próxima e última; "Mostrando X–Y de Z" com o total do servidor. Os
  botões usam `aria-disabled` nos extremos e durante a carga (o foco não se perde); clicar na
  página atual não relê.
- **Cancelamento:** cada leitura da listagem cancela a anterior (`AbortController`) e
  desmontar a tela (troca de empresa, saída do módulo) cancela a que estiver em voo; a leitura
  mínima dos totais da aba Jornada também. A sequência de pedidos continua descartando resposta
  antiga.
- **Aviso de auditoria (C-6):** "Admissões, alterações e a leitura de contatos geram trilha de
  auditoria; o suporte técnico apenas consulta."
- **Ações por pessoa (C-4):** coluna "Ações" com um botão de menu por linha ("Ações: <nome>"),
  só quando a ficha pode ser aberta. Os atalhos são as abas da ficha que o papel vê, na ordem
  da ficha; "Solicitações" só para quem a lê (RH e master técnico). Teclado: setas (com
  volta), Home, End, Enter; Escape fecha e devolve o foco ao botão; Tab, clique fora ou foco
  fora fecham. Escolher devolve o foco ao botão e abre a ficha na aba (ponto no mês corrente);
  na volta da ficha, o foco está no botão. O menu é preso à janela (a tabela rola e o
  recortaria), abaixo do cabeçalho fixo, e acompanha a rolagem e o tamanho da janela.
- **Arquivos:** `apps/web/src/app/rotasDoShell.ts`, `apps/web/src/app/App.tsx`,
  `apps/web/src/api/colaboradoresClient.ts`, `apps/web/src/screens/pessoas/ColaboradoresScreen.tsx`
  e `.css`, `apps/web/src/screens/pessoas/MenuAcoesDaPessoa.tsx` (novo) e
  `apps/web/src/screens/pessoas/PessoasScreen.tsx`.

## 15. Validação

- **Testes que falham antes:** os 25 testes de tela dos Blocos A e B foram escritos antes da
  implementação e falharam; depois, testes de rota, cliente, funções puras, posição do menu e
  integração com o shell (por papel).
- **Mutações:** 38 mutações nas regras de URL, tamanho, paginação, intervalo, cancelamento,
  aviso, atalhos por papel, teclado e foco do menu, abertura da ficha na aba e cliente — todas
  detectadas.
- **Bateria:** web 134 arquivos, 3863 testes; API unitária 62 suítes, 1544 testes; E2E serial com PostgreSQL real 22 suítes, 1081 testes; scripts 182 testes; 38 mutações, todas detectadas; lint, typecheck, build, Prettier, `spec:check`, prévia do squash e `git diff --check` verdes.
- **Navegador (prévia local com dados sintéticos):**
  - RH: 20, 50 e 100 por página com a URL canônica; páginas numeradas, primeira e última;
    "Mostrando 101–136 de 136"; busca mantida ao paginar e fora da URL; requisição substituída
    cancelada na rede; menu por teclado e mouse, Escape, clique fora; atalho "Documentos" abrindo
    a ficha na aba e a volta devolvendo o foco ao botão "Ações", com busca, aba e tamanho
    mantidos;
  - DP: seis atalhos, sem Solicitações; 100 por página;
  - master técnico: global ("no seu escopo"), só leitura, sete atalhos; com troca de empresa
    pelo seletor, a listagem volta ao estado inicial seguro da empresa escolhida;
  - gestor: sem Colaboradores (vai a Minha equipe), sem menu;
  - RH com duas empresas: a troca mostra só a empresa nova, com o estado inicial;
  - 375 px: sem rolagem horizontal da página; rodapé, paginação e menu dentro da tela; alvos de
    44 px.
- **Massa sintética:** 130 admissões sintéticas foram criadas pela API, como RH, no banco
  isolado da prévia, para exercitar páginas de 50 e 100.

## 16. Limites conhecidos

- **Bloco C pausado** (seção 13.2); "Importar planilha" segue indisponível no painel.
- **Menu e rolagem no navegador:** o acompanhamento da rolagem horizontal da tabela foi
  comprovado por teste unitário com geometria simulada; na prévia, o painel do navegador estava
  oculto (sem pintura nem eventos de rolagem), e as capturas de tela não foram feitas.
- **Troca de empresa** volta a listagem ao estado inicial (tamanho 20), como já fazia com aba,
  filtros e página (T189).
- **Catálogos de filtro** seguem com uma página de 100 e sem cancelamento próprio (só a
  marcação de vigência), como antes.
- **Ambiente local (não é do produto):** com `core.autocrlf`, os arquivos da worktree saem em
  CRLF; dois testes de contrato de CSS do shell (T206), que procuram `\n`, falham nessa
  condição e passam com o arquivo em LF, como no repositório e na CI.

## 17. Refinamento da listagem (ordem de 2026-11-13)

Inspiração local na referência privada, sem copiar marca, textos, dados nem layout. Só
controles e números reais do Evolli.

- **Cabeçalho:** título, descrição curta e só a ação que existe ("Adicionar colaborador",
  para quem admite). **Sem "Exportar"**: não há contrato (C-14).
- **Faixa de indicadores:** dois painéis quando o próprio bloco tem 36rem (um embaixo do outro
  antes): "Ativos" em destaque, com Em admissão, Desligados e Total como fatos menores; ao lado,
  a distribuição dos ativos por tipo de vínculo (barra decorativa e legenda em texto, só tipos
  com gente). **Sem** ausências, salário, CPF, contatos ou qualquer número sem contrato.
- **Abas:** as existentes (Ativos, Em admissão, Desligados, Todos, Jornada de trabalho).
  **Não** foram criadas Férias, Escala, Organograma ou outra aba sem visão real.
- **Busca e filtros:** numa linha alinhada pela base acima de 640 px; no celular, a coluna de
  antes.
- **Teste de guarda:** a tela não mostra ausência, salário, CPF, telefone, e-mail,
  exportação, férias, escala, organograma nem calendário.

## 18. Massa sintética por tipo de vínculo (banco próprio da prévia)

- **Banco próprio da T209:** contêiner Postgres isolado (projeto compose `evolli-t209`),
  com papéis, schema e extensões pelos scripts de `infra/postgres`, migrations do Prisma da
  própria worktree, bootstrap e seed sintético do projeto. A prévia deixou de usar o banco
  da T207. Credenciais locais geradas para ele e guardadas fora do repositório.
- **Pelos fluxos normais** (`POST /v1/colaboradores` como RH, e a efetivação da admissão em
  `POST /v1/movimentacoes/:id/efetivar`), com nomes "Teste T209 …":
  - Empresa Demo Alfa: 25 CLT, 25 PJ e 25 Estágio, admitidos e efetivados (ativos), além de
    130 admissões previstas ("Pessoa Sintética T209 …", em admissão);
  - Empresa Demo Beta: 2 CLT, 2 PJ e 2 Estágio, admitidos e efetivados.
- **Aprendiz não foi criado:** o tipo não existe no contrato (`TipoVinculo`: CLT, Estágio,
  PJ, Temporário e Outro controlado). A D16 da T194 o aprova, mas exige enum e migration
  (seção 8.2); não foi simulado com outro tipo.
- **Validação no navegador (RH da Alfa):** Ativos 79 (4 do seed + 75), distribuição
  "CLT: 29, Estágio: 25, PJ: 25", Todos 209; Ativos em 4 páginas de 20 ("Mostrando 61–79 de
  79"); Todos com 100 por página em 3 páginas; filtro PJ com 25; busca "Teste T209 Alfa
  Estagio" com 25 em 2 páginas, mantida ao paginar e fora da URL; busca "Beta" sem resultado.
  **Isolamento:** o RH da Beta vê só os 7 da Beta ("CLT: 3, Estágio: 2, PJ: 2"); o RH com
  duas empresas vê 79 ativos na Alfa e, depois da troca, só os 7 da Beta.

## 19. Padrão de divisões sutis

- **Tokens** em `apps/web/src/app/tokens.css`, só nomes semânticos sobre valores que já
  existiam (nenhuma cor nova): `--divisor-cor`, `--divisor-cor-forte`,
  `--divisor-cor-sobre-marinho`, `--borda-espessura`, `--divisor`, `--divisor-forte`,
  `--secao-espaco`, `--secao-espaco-compacto`, `--borda-card`, `--borda-tabela`,
  `--borda-painel`, `--estado-hover-superficie`, `--estado-ativo-cor`,
  `--estado-ativo-espessura`, `--estado-selecao-superficie` e `--foco-anel`.
- **Estrutura compartilhada:** cabeçalho superior, menu lateral, rodapé e o pé do menu
  (conta e demonstração) passaram a usar os tokens, com os mesmos pixels; o seletor de empresa
  do menu ganhou um divisor sobre o marinho, separando-o da navegação.
- **Colaboradores:** divisor sob o cabeçalho da página; borda de card na faixa e divisores
  entre os totais menores; abas e área de busca/filtros separadas; tabela com borda, cabeçalho
  e linhas pelos tokens e hover de linha (só nesta tela); rodapé da paginação separado.
- **Sem regressão:** no navegador, os estilos calculados de todo o shell no Dashboard e em
  Configurações foram comparados antes e depois: a única diferença é o divisor do seletor de
  empresa. O componente de tabela compartilhado não mudou.
- **Rollout:** cada módulo recebe as divisões quando for aberto para evolução funcional ou
  visual, trocando literais pelos tokens (mesmos pixels) e acrescentando divisões só onde
  houver blocos independentes, com teste de contrato de CSS e conferência no navegador
  (desktop e 375 px). Telas não revisadas não recebem divisões novas em lote.

## 20. Animação reutilizável dos painéis laterais

- **Onde:** no `Modal` com `posicao="lateral"` (`apps/web/src/components/Modal.tsx` e
  `.css`); qualquer painel lateral futuro herda o padrão, sem copiar CSS ou lógica. Aplicado
  primeiro ao painel "Adicionar colaborador". A janela central não muda.
- **Movimento:** o painel entra deslizando da direita (200 ms) e sai para a direita
  (160 ms); o fundo aparece e some por opacidade; tokens `--movimento-painel-entrada`,
  `--movimento-painel-saida` e `--movimento-curva`.
- **Sem temporizador:** ao fechar, foco devolvido ao gatilho, rolagem destravada e teclado
  solto na hora; o painel fica montado, inerte, fora da árvore acessível e sem receber clique,
  até o `animationend` da própria caixa. Sem animação calculada (`prefers-reduced-motion`),
  sai no mesmo quadro. Reabrir durante a saída a cancela.
- **Fundo:** no painel lateral, clicar no fundo pede o fechamento pelo caminho do "Fechar"
  (pede confirmação com alteração pendente; não fecha durante um envio). Antes da T209, o fundo
  não fechava; na janela central, continua sem fechar.
- **Navegador:** a animação de entrada roda (`evolli-painel-entra`, 0,2 s), o foco vai ao
  título, Escape e o fundo iniciam a saída com foco no gatilho e rolagem livre; a desmontagem
  foi conferida com o `animationend` nativo; em 375 px, tela inteira sem rolagem lateral; a
  gaveta do menu no celular sem regressão.

## 21. Validação desta etapa

- **Testes que falham antes:** refinamento (6), divisões (29) e animação (10) falharam antes da
  implementação; mutações: refinamento 9 de 9, animação 10 de 10 (uma sobrevivente foi
  morta com teste novo).
- **Bateria proporcional (só web mudou):** web 136 arquivos, 3918 testes; lint, typecheck e build da web; Prettier, `spec:check`, prévia do squash e `git diff --check` verdes (API e E2E sem mudança desde a bateria completa).
- **Limite do ambiente:** o painel do navegador estava oculto (sem pintura): as animações não
  avançam e o `animationend` não é despachado por si; a desmontagem foi confirmada com o evento
  nativo. Capturas de tela não foram feitas.

## 22. Aprovações de 2026-11-13 (depois da validação visual)

- **Visual dos blocos atuais da listagem: aprovado** — Blocos A e B, faixa de indicadores,
  barra de filtros, divisões sutis e animação do painel lateral (seções 14 a 21).
- **Fechamento pelo fundo do painel lateral, com a guarda de alterações: aprovado** — o clique
  no fundo pede o fechamento pelo caminho do "Fechar" (confirmação com alteração pendente;
  nada fecha durante um envio). Na janela central, o fundo segue sem fechar.
- **Inclusão de Aprendiz: autorizada como próxima ampliação da T209, a começar pelo
  levantamento** (seção 23). Nenhum código, migration ou dado foi alterado para isso.

## 23. Levantamento: Aprendiz como tipo de vínculo (próxima ampliação)

Retoma a D16 (aprovada) e a D21 (pendente) da T194 (seção 5.1 daquele dossiê). Só leitura.

### 23.1 Onde o tipo de vínculo vive hoje

- **Banco:** `enum TipoVinculo { clt, estagio, pj, temporario, outro_controlado }`, usado só
  em `VinculoFuncional.tipo` (`apps/api/prisma/schema.prisma:986-992`, `:1122`). Incluir um
  valor é migration aditiva (`ALTER TYPE "TipoVinculo" ADD VALUE 'aprendiz'`); o valor novo
  não pode ser usado na mesma transação da migration.
- **API:** a lista fechada `TIPOS_VINCULO` valida admissão, novo vínculo e filtros
  (`apps/api/src/pessoas/dto/pessoas.dto.ts:42-48`); os contadores `ativosPorTipo` têm uma
  chave por tipo (`colaborador.service.ts:328-334`); ponto e solicitações repetem a lista em
  DTOs próprios (`apps/api/src/ponto/dto/ponto.dto.ts`,
  `apps/api/src/solicitacoes/solicitacoes.ts`, `solicitacoes.types.ts`,
  `apps/api/src/solicitacoes-pessoas/dto/solicitacoes-pessoas.dto.ts`).
- **Web:** `TIPOS_DE_VINCULO` (URL e filtros, `rotasDoShell.ts:192-198`); rótulos e cores
  da distribuição (`ColaboradoresScreen`, `DashboardScreen`); opções da Nova admissão; ficha,
  Dados contratuais, Histórico funcional, Equipe, ponto e solicitações, cada um com rótulo
  por tipo; clientes da API (`colaboradoresClient`, `movimentacaoClient`, `pontoClient`,
  `solicitacoesPessoasClient`).
- **Sem prazo no vínculo:** o vínculo tem admissão e desligamento, mas **não** tem data de
  término prevista; o contrato de aprendizagem é por prazo determinado.
- **Data de nascimento:** obrigatória na admissão (perfil pessoal, T177), então a idade na
  admissão é calculável; **deficiência não existe** no Evolli (dado sensível).

### 23.2 Regras legais a confirmar (Jurídico, RH e DP — nada adotado)

Referência geral da CLT (arts. 428 a 433), a confirmar com o Jurídico pela redação vigente:
contrato por prazo determinado e limitado; faixa etária, com exceção para pessoa com
deficiência; jornada reduzida; vínculo com programa e entidade formadora; cota por
estabelecimento; hipóteses próprias de término.

### 23.3 Proposta de fatia (mínima, sem regra legal no sistema)

1. Migration aditiva com `aprendiz` no enum; `TIPOS_VINCULO` e as demais listas da API e da
   web com o novo valor, na ordem CLT, Estágio, **Aprendiz**, PJ, Temporário, Outro
   controlado.
2. Rótulo "Aprendiz" em todos os pontos de 23.1; cor própria na distribuição (Colaboradores e
   Dashboard), de token já existente, com contraste conferido.
3. Contadores `ativosPorTipo` com a chave nova; filtro por tipo e URL (`tipo=aprendiz`).
4. Nova admissão e novo vínculo aceitando Aprendiz, **sem campo extra**.
5. Testes que falham antes, E2E com PostgreSQL real (admissão, listagem, contadores, filtro,
   isolamento e permissões), mutações e validação no navegador; massa sintética de Aprendiz
   no banco próprio da prévia.

### 23.4 Decisões para aprovação

| Id   | Decisão                       | Recomendação                                                                                 | Alternativa                                        |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AP-1 | Escopo da ampliação           | fatia mínima de 23.3: só o tipo, sem regra legal no sistema                                  | tipo com as regras de AP-2 a AP-6                  |
| AP-2 | Prazo determinado             | fora desta fatia; registrar como pendência (exige campo novo e migration)                    | data de término prevista obrigatória para Aprendiz |
| AP-3 | Idade na admissão             | sem validação (bloquear erraria a exceção de deficiência, dado que o Evolli não tem)         | aviso não bloqueante pela data de nascimento       |
| AP-4 | Programa e entidade formadora | fora (dado novo, com ficha de tratamento)                                                    | registrar curso e entidade                         |
| AP-5 | Jornada                       | sem validação; a jornada segue pela tabela de horário existente                              | alerta de jornada acima do limite                  |
| AP-6 | Término e conversão           | pelos fluxos atuais (desligamento; outro tipo = novo vínculo)                                | fluxo próprio de conversão                         |
| AP-7 | Cota                          | fora (relatório futuro)                                                                      | indicador de cota                                  |
| AP-8 | Ordem e rótulo                | "Aprendiz", depois de Estágio                                                                | no fim da lista                                    |
| AP-9 | Onde aparece                  | em todos os pontos de 23.1 (Colaboradores, Dashboard, ficha, histórico, ponto, solicitações) | só Pessoas, com os demais em fatia própria         |

**Fora desta ampliação:** CPF, deficiência, salário, programa de aprendizagem, cota, prazo e
conversão automática; importação (Bloco C segue pausado).

## 24. Aprendiz implementado (fatia mínima, AP-1 a AP-9 aprovadas em 2026-11-13)

- **Migration:** `20261113180000_tipo_vinculo_aprendiz`, só
  `ALTER TYPE "TipoVinculo" ADD VALUE 'aprendiz' AFTER 'estagio'`; nenhum dado existente lido
  ou alterado (teste de E2E confere o SQL e a ordem do enum no PostgreSQL).
- **API:** catálogo controlado `TIPOS_VINCULO` (admissão, novo vínculo e filtro `tipoVinculo`)
  e contadores `ativosPorTipo` com a chave `aprendiz`, na ordem CLT, Estágio, Aprendiz, PJ,
  Temporário, Outro controlado. RBAC e auditoria sem mudança.
- **Web (superfícies atualizadas):** Colaboradores (filtro, coluna Tipo, distribuição, URL
  `tipo=aprendiz` e chip), Nova admissão (opção, sem campo extra), ficha (cabeçalho, Dados
  contratuais, Registros de ponto, Solicitações), Dados contratuais da empresa, Histórico
  funcional, Dashboard (distribuição, link para a listagem filtrada e tabela) e Equipe; cliente
  `colaboradoresClient`. Cor própria `--cor-tipo-aprendiz` (contraste acima de 3:1 sobre o
  branco e o fundo do Dashboard, por teste).
- **Fora (AP-2 a AP-7):** prazo, término, conversão, cota, programa, entidade formadora,
  jornada e idade; nenhuma alegação de conformidade legal. O desligamento de sempre encerra o
  vínculo (provado em E2E).
- **Testes que falham antes:** API unitária, web (19) e o E2E dedicado
  `tipo-vinculo-aprendiz.e2e-spec.ts` (migration, admissão por RH e DP, negação a master
  técnico, gestor e colaborador, outra empresa, variações recusadas, filtro, grupos,
  contadores por empresa, master global e escopado, desligamento).
- **Bateria:** web 137 arquivos, 3937 testes (na rodada completa, 2 testes de tempo da Nova admissão estouraram 5 s sob carga; o arquivo isolado passou 264 de 264); API unitária 62 suítes, 1545 testes; E2E com PostgreSQL real 23 suítes, 1092 testes (com 4 workers); scripts 182 testes; lint, typecheck, build e Prettier verdes.
- **Prévia (banco próprio da T209):** migration aplicada; massa "Teste T209 … Aprendiz": Alfa
  10 ativos por RH, 2 ativos por DP e 2 em admissão; Beta 2 ativos. No navegador: legenda
  "Aprendiz: 12" com a cor própria, filtro com 12 e URL `?tipo=aprendiz`, aba Em admissão com
  2, Dashboard "Aprendiz: 12 pessoas (13%)" e o link levando à listagem filtrada, ficha com
  "Aprendiz" no cabeçalho, em Dados contratuais, Registros de ponto e Solicitações; Nova
  admissão com a opção depois de Estágio, para RH e DP; 375 px sem rolagem horizontal da
  página.
- **Limites:** o Histórico funcional (aba de Pessoas) foi coberto por teste de contrato do
  rótulo, não visto no navegador; testes de tempo da Nova admissão (5 s) oscilam sob carga da
  máquina, sem relação com o Aprendiz.

## 25. Fundação de interface incremental (ADR 0019)

- **Integração:** Tailwind CSS 4 pelo plugin do Vite, **sem preflight**, em camadas de cascata e
  com prefixo `ev` (`apps/web/src/ui/estilos.css`); o CSS atual prevalece e nenhuma variável do
  tema colide com os tokens. Radix para menu, diálogo, painel lateral e tooltip; Lucide para
  ícones; sem TanStack Table (a tabela não ordena, não seleciona e pagina no servidor).
- **Componentes criados (`apps/web/src/ui`):** Button, IconButton, Card, CardSection, Input e
  Select (nativos), Badge, Tabs (próprias, ativação manual), DropdownMenu, Dialog, Sheet,
  Tooltip e primitivas de tabela (TableContainer, Table, TableCaption, TableHeader, TableBody,
  TableRow, TableHead, TableCell).
- **Colaboradores migrado:** painel "Adicionar colaborador" (Sheet), menu "Ações" por linha
  (DropdownMenu, em portal), busca e filtros (Input e Select), "Itens por página" (Select), abas
  (Tabs), indicadores (Card) e tabela (primitivas). Dashboard, Configurações, ficha, ponto e
  solicitações não foram migrados.
- **Comportamentos preservados:** permissões, isolamento por empresa, busca, filtros, tamanho de
  página, paginação, cancelamento, atalhos por linha, guarda de alterações, animação e movimento
  reduzido do painel, foco, Escape e 375 px. Acrescentados ao Radix: foco no título da janela,
  foco devolvido a quem abriu, seta para cima abre o menu no último item, Tab fecha o menu.
- **Dependências:** `@radix-ui/react-dialog` 1.3.1, `@radix-ui/react-dropdown-menu` 2.2.1,
  `@radix-ui/react-tooltip` 1.4.1, `lucide-react` 1.64.0 (produção); `tailwindcss` 4.3.3 e
  `@tailwindcss/vite` 4.3.3 (desenvolvimento) — MIT/ISC, versões exatas publicadas há pelo
  menos duas semanas. `@radix-ui/react-tabs` foi avaliado e retirado.
- **Testes:** 26 contratos dos componentes (`src/ui/ui.test.tsx`), menu da linha, painel,
  integração da tela com a camada e as suítes existentes ajustadas para abrir o menu como no
  navegador. Bateria: web 138 arquivos, 3960 testes (na rodada completa, 3 testes de tempo, 2 da guarda T200 e 1 da Nova admissão, falharam sob carga e passaram isolados); lint, typecheck e build da web verdes; CSS final 26,5 kB comprimido.
- **Navegador (banco próprio da T209):** controles com 44 px e as bordas dos tokens; menu em
  portal (fora da tabela, camada 20), Escape devolve o foco ao botão; painel com foco no título,
  animação de entrada e saída, rolagem travada e a árvore da aplicação oculta ao leitor de tela
  (só regiões `aria-live` ficam, por desenho da biblioteca); 375 px com o painel em tela inteira
  e sem rolagem horizontal; Dashboard e Configurações sem nenhuma classe `ev:` e com os tokens
  inalterados.
- **Limites:** com o painel do navegador oculto (sem pintura), animações e o foco de entrada do
  menu pelo teclado ficam parados; nos testes (jsdom) o foco vai ao primeiro item. No menu do
  Radix, a busca por letra é nova; o resto do teclado segue o que já existia.

## 26. Nova admissão como assistente de etapas

- **Layout:** cabeçalho próprio ("Nova admissão", descrição curta e o botão "Voltar para
  Colaboradores", que segue o mesmo caminho do Cancelar e passa pela guarda de saída); etapas à
  esquerda, fixas ao rolar, quando a página tem pelo menos 52rem (pela largura da própria
  página: o menu lateral aberto estreita o conteúdo); conteúdo da etapa em uma coluna (até
  48rem), organizado por seções; rodapé fixo com o progresso ("Etapa X de 4 · N%" e barra),
  Cancelar, Voltar (a partir da etapa 2) e "Próxima etapa" ou "Concluir". Em 375 px, as etapas
  ficam em linha acima do conteúdo e o rodapé vira uma grade de duas linhas (progresso e
  Cancelar; Voltar e a ação principal larga), sem rolagem horizontal.
- **Etapas com os dados reais** (os títulos pedidos foram usados só onde batem com os campos):
  1. **Dados pessoais** — Dados pessoais: nome completo\*, e-mail pessoal, data de nascimento\*,
     sexo, saudação, estado civil, nacionalidade, naturalidade, escolaridade, curso, nome do pai,
     nome da mãe; Contatos: celular, telefone.
  2. **Dados profissionais e vínculo** — Vínculo: matrícula, tipo de vínculo\*, data de
     admissão\*; Lotação inicial: departamento\*, cargo\*, área, unidade, equipe, centro de
     custo; Jornada de trabalho.
  3. **Endereço** — país, CEP (com sugestão pelo CEP), logradouro, número, complemento, bairro,
     cidade, estado.
  4. **Revisão e conclusão** (no lugar de "Documentos e revisão") — o que foi digitado, por
     bloco, com "Editar"; aviso de que documentos ainda não são pedidos. "Concluir" abre a mesma
     confirmação de antes; só ela grava.
- **Lacunas que exigem decisão (nada foi criado):** CPF e RG não existem no contrato da admissão
  (DP-ADM-04 segue aberto); envio de documentos depende do armazenamento de arquivos (Nível 2);
  não há modelo de foto do colaborador (a foto da conta não é reutilizada); não há rascunho
  persistente (sem "Salvar rascunho"); nome social e gênero não existem no cadastro.
- **Preservado:** contrato da API, validações do servidor, idempotência, CSRF, auditoria,
  permissões (só RH e DP abrem a página; `master_tecnico` não vê), isolamento por empresa,
  validação por etapa com foco no primeiro campo inválido, foco no título de cada etapa, Enter
  como "Próxima etapa", guarda de saída (Cancelar, "Voltar para Colaboradores", trilha, menu,
  navegador) e troca de empresa. Só web: sem API, migration, RBAC ou dependência nova.
- **Testes:** fluxo entre etapas e rodapé por etapa; validação por etapa e foco; Escape na
  pergunta de saída (mantém etapa e dados, foco volta ao botão); "Sair sem salvar"; Enter;
  ausência de foto, CPF, RG, upload e rascunho; RH e DP com o assistente, `master_tecnico` sem;
  contrato de CSS (desktop e 375 px). As suítes antigas foram ajustadas aos rótulos novos.
- **Navegador (banco próprio da T209, RH):** 1440 px com etapas à esquerda (240 px, fixas) e
  conteúdo em 768 px; 1024 px com o menu aberto cai para uma coluna; 375 px sem rolagem
  horizontal, botões de 44 px e rodapé de 131 px; validação da etapa 1 com foco no campo; guarda
  com Escape devolvendo o foco a "Voltar para Colaboradores" e os dados mantidos. DP coberto
  pelos testes de integração (não validado no navegador nesta rodada).

## 27. Tela de abertura institucional (base para a animação oficial em Lottie)

- **Quando aparece:** ao recarregar a página, enquanto a sessão é verificada ("Verificando
  sessão…"), e depois de um login aceito, enquanto o acesso é carregado ("Carregando seu
  acesso…") — até a sessão, o papel, a empresa ativa e a tela inicial estarem prontos. Não
  aparece na navegação interna nem na troca de empresa (que continua com o aviso simples).
- **Sem espera artificial:** some assim que o acesso chega; só uma duração mínima de 300 ms,
  contada desde que apareceu, evita o piscar. Login recusado, sessão expirada e falha ao
  carregar o acesso aparecem na hora, sem esperar por ela.
- **Visual:** a marca aprovada do Evolli (`MarcaEvolli`, o mesmo desenho do menu e do login),
  ampliada, com o nome e a mensagem, e uma transição curta em CSS (opacidade e deslocamento,
  320 ms); com `prefers-reduced-motion`, nada se move. Só tokens; tela inteira também em 375 px.
- **Acessibilidade:** a mensagem é `role="status"`; marca e nome são decorativos
  (`aria-hidden`); nada na abertura recebe foco; o pedido de foco da aterrissagem espera a
  abertura sair e vai ao título da tela inicial.
- **Lottie:** componente `AnimacaoLottie` com o player `lottie_light` (SVG, sem execução de
  expressões), carregado sob demanda junto com o JSON; enquanto carrega, ou se falhar, fica a
  marca estática; com movimento reduzido, a animação fica parada no último quadro. Nenhuma
  animação existe no repositório: nada foi inventado, baixado ou versionado.
- **Onde conectar a animação oficial:** exportar do After Effects pelo Bodymovin (JSON, imagens
  embutidas, sem expressões), salvar em `apps/web/src/app/abertura/animacao-oficial.json` e, em
  `apps/web/src/app/abertura/animacaoOficial.ts`, trocar `null` por
  `() => import("./animacao-oficial.json")`.
- **Dependência:** `lottie-web` 5.13.0 (MIT, produção), versão exata publicada em maio de 2025;
  fora do pacote principal enquanto não há animação (ADR 0019). Sem API, banco, permissão ou rota.
- **Testes:** abertura ao recarregar e no login, com a marca e a mensagem; duração mínima sem
  piscar; foco no título da aterrissagem mesmo com a duração mínima; sessão expirada, login
  recusado e falha do acesso sem espera; papel sem empresa ativa; movimento reduzido; nenhuma
  abertura na navegação interna nem na troca de empresa; o componente Lottie com o player
  simulado (SVG, laço, último quadro com movimento reduzido, destruição ao sair, reserva quando
  o JSON falha); contrato de CSS.
- **Navegador (banco próprio da T209):** recarregar mostra a abertura com "Verificando
  sessão…"; login de DP e de RH mostra a abertura por cerca de 320 ms e aterrissa no Dashboard
  com o foco no título; senha errada mostra o erro em cerca de 120 ms, sem abertura; 375 px com
  a abertura em tela inteira e a marca centralizada, sem rolagem horizontal; navegação interna
  e troca de empresa (conta multiempresa) sem abertura, com o aviso, o anúncio e o foco de
  sempre.

## 28. Menu lateral completo (ordem e aprovação de 2026-11-16)

- **Estrutura:** topo com a marca, o controle de recolher e o seletor de empresa; Dashboard e
  Portal (selo "Beta"); seção **Pessoas** — Colaboradores (expansível, com os subitens
  Colaboradores e Desenvolvimento), Recrutamento (Vagas e Banco de talentos), Pesquisas e
  Calendário; seção **Remuneração** — Folha de Pagamento, Benefícios e Hub de Benefícios (selo
  "Novo"); seção **Operação** com os módulos funcionais que não estavam na estrutura pedida
  (Estrutura, Jornada, Liderança e Contas de acesso); Demonstração; rodapé preso ao pé da faixa
  com Suporte, Roadmap e Configurações. A disposição vive em `apps/web/src/app/menuLateral.ts`;
  os destinos, as rotas e as permissões continuam em `mapaNavegacao.ts`, sem mudança.
- **Itens funcionais:** Dashboard, Colaboradores, Estrutura organizacional, Jornadas de
  trabalho, Jornada, Minha equipe, Administração da liderança, Contas de acesso, as telas de
  Demonstração e Configurações — mesmo comportamento e mesmas permissões de antes.
- **Itens em desenvolvimento (12):** Portal, Desenvolvimento, Recrutamento (Vagas, Banco de
  talentos), Pesquisas, Calendário, Folha de Pagamento, Benefícios, Hub de Benefícios, Suporte e
  Roadmap. Cada um é um `<button>` com `aria-disabled`, nome, o estado "Em desenvolvimento" no
  nome acessível e a explicação "Em desenvolvimento. Esta funcionalidade ainda não está
  disponível." como descrição e como dica (ponteiro e foco; no trilho, com o nome). Clique,
  Enter ou Espaço abrem um aviso pequeno e não modal ao lado do item (abaixo dele na gaveta);
  `Escape` ou "Fechar aviso" fecham e devolvem o foco ao item. Nunca muda a URL nem a tela;
  sem link, sem `href="#"`, sem rota nova, sem entrada em `DESTINOS`. Na gaveta do celular, o
  primeiro `Escape` fecha só o aviso; o segundo, a gaveta.
- **Decisões aprovadas (menu compacto):**
  - A — uma linha por item: o sub-rótulo do destino sai de vista e vira a dica (segue no nome
    acessível).
  - B — o estado de um item em desenvolvimento vira uma marca compacta (relógio, decorativo)
    ao fim da linha; o texto segue no nome acessível e a explicação na descrição, na dica e no
    aviso.
  - C — Recrutamento começa fechado.
  - D — sem divisórias entre as seções no menu expandido; o divisor fica só no trilho, onde o
    título da seção não aparece.
  - E1 — a seção Operação (título vira botão de abrir e fechar) e o módulo Demonstração começam
    fechados, salvo quando a tela aberta está neles; fechados com a tela atual dentro, o título
    carrega a marca (`aria-current`). No trilho, Operação aparece sempre, em ícones.
  - "Folha de Pagamento" com P maiúsculo.
  - Desktop com itens de 36 px; no celular, mínimo de 44 px.
  - Em janelas menores, a faixa lateral pode rolar por dentro.
  - Selos Beta e Novo em 12 px.
- **Pendências registradas (sem decisão):** ícones Lucide nos itens novos ao lado dos desenhos
  próprios dos módulos existentes; a trilha da página continua "Gestão de Pessoas ›
  Colaboradores"; Portal em desenvolvimento enquanto a tela de exemplo "Portal do Colaborador"
  segue em Demonstração.
- **Testes:** `App.menuCompleto.test.tsx` (64), escritos antes da implementação: ordem, seções
  e rodapé; itens funcionais preservados; selos; cada item em desenvolvimento por mouse e por
  teclado (aviso, URL e tela intactas, `Escape`, foco devolvido, um aviso por vez, foco só no
  aviso já visível); item e subitem ativos; Recrutamento, Operação e Demonstração fechados e
  abertos; tela ativa nunca escondida; trilho; gaveta do celular; papel gestor; contrato (sem
  link, sem `href="#"`, sem destino ou rota para item em desenvolvimento, todo grupo do mapa uma
  vez); contrato de CSS (só tokens, rodapé, divisor só no trilho, marca compacta, 44 px no
  celular, sem animação fora de `no-preference`). Os testes antigos que navegam por Operação e
  Demonstração abrem as duas antes (`apps/web/src/test/menuLateral.ts`), inclusive antes das
  verificações de ausência, para não passarem por item escondido. 8 mutações, todas detectadas.
- **Navegador (banco próprio da T209):** desktop 1440 × 1000 — o menu inteiro cabe sem rolagem,
  itens de 36 px numa linha (inclusive "Hub de Benefícios Novo"), sem rolagem horizontal; dica
  do sub-rótulo no Dashboard e da explicação nos itens em desenvolvimento; Enter em Folha de
  Pagamento abre o aviso ao lado, com o foco nele, URL e título intactos, e `Escape` devolve o
  foco; Operação abre e fecha. Trilho — sem o botão da seção, Estrutura, Jornada, Liderança e
  Contas de acesso como ícones com dica. 375 px — gaveta de 300 px que rola por dentro, 16
  alvos de 44 px numa linha, Recrutamento, Operação e Demonstração fechados; Espaço em Roadmap
  abre o aviso dentro da tela; o primeiro `Escape` fecha o aviso e o segundo, a gaveta, com o
  foco em Menu.
- **Validação:** web 140 arquivos, 4062 testes, numa rodada limpa (sem falha nem estouro de
  tempo, 4 workers); lint, typecheck, build, Prettier, `spec:check` e `git diff --check` verdes.
  Só web: sem API, banco, permissão, rota ou dependência nova. Nenhuma imagem ou referência
  externa foi salva ou versionada.
