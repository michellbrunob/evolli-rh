# T209 — Colaboradores (dossiê de preparação)

- **Estado:** em preparação. Este dossiê traz o levantamento, só em leitura, do módulo
  Colaboradores e propõe a primeira fatia funcional da T209, com as decisões C-1 a C-15
  (seção 10) **pendentes de aprovação**. Nenhum código de produto foi alterado.
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

| Campo                                                                                 | Listagem hoje | Proposta T209                                                      | Base                           |
| ------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------ | ------------------------------ |
| Nome, matrícula, cargo, departamento, jornada, tipo, situação, admissão, desligamento | sim           | mantém                                                             | T184–T199                      |
| Data de nascimento                                                                    | não           | **não** na listagem; só entra na importação, como exige o cadastro | ficha de dados pessoais (T177) |
| E-mail pessoal, celular, telefone                                                     | não           | **não** (nem na importação, C-10)                                  | ficha de contatos; T199 §6     |
| Endereço e demais dados pessoais                                                      | não           | **não**                                                            | ficha de dados pessoais        |
| CPF                                                                                   | inexistente   | **indisponível**                                                   | `DP-ADM-04`, `DP-FLX-05`       |
| Salário e remuneração                                                                 | inexistente   | **indisponível**                                                   | DP-14, DP-18                   |

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

| Id   | Decisão                              | Recomendação                                                                                                                                                                                                                         | Alternativa                                          |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| C-1  | Recorte da T209                      | **Blocos A, B e C** (fatia maior, para o prazo)                                                                                                                                                                                      | A e B; importação em tarefa própria                  |
| C-2  | Tamanho da página                    | 20, 50 e 100; padrão 20; na URL como `tamanho`                                                                                                                                                                                       | só 20 e 50; fora da URL                              |
| C-3  | Paginação                            | numerada com primeira/última e "Mostrando X–Y de Z"                                                                                                                                                                                  | manter anterior/próxima                              |
| C-4  | Ações por linha                      | menu de atalhos às abas da ficha permitidas ao papel; sem mutação                                                                                                                                                                    | só o nome como hoje                                  |
| C-5  | Desligar a partir da listagem        | **fora** da T209 (segue no Histórico funcional)                                                                                                                                                                                      | atalho na linha (decisão de produto e URL)           |
| C-6  | Aviso de auditoria                   | "Admissões, alterações e a leitura de contatos geram trilha de auditoria; o suporte técnico apenas consulta."                                                                                                                        | remover a frase de auditoria                         |
| C-7  | Gravação da importação (D11 da T194) | uma admissão por linha, `POST /v1/colaboradores` com `Idempotency-Key` própria, envio sequencial                                                                                                                                     | lote e verificação no servidor (contrato novo)       |
| C-8  | Formato (D10 da T194)                | só CSV UTF-8, separador `;` ou `,` detectado, cabeçalho fixo                                                                                                                                                                         | também .xlsx (dependência nova)                      |
| C-9  | Quem importa e limite (D12 da T194)  | RH e DP da empresa ativa; até 200 linhas e 1 MB por arquivo; master técnico não                                                                                                                                                      | só RH; outro limite                                  |
| C-10 | Colunas da planilha                  | obrigatórias: nome, data de nascimento, tipo de vínculo, data de admissão, código do departamento, código do cargo; opcionais: matrícula e código da unidade. Motivo fixo `admissao_inicial`. Sem contatos, endereço, CPF ou salário | incluir e-mail pessoal e celular (ficha de contatos) |
| C-11 | Origem da importação (`DP-FLX-17`)   | **sem registro** nesta fatia; a admissão fica igual à do cadastro individual                                                                                                                                                         | migration aditiva com a origem                       |
| C-12 | Ficha de tratamento da importação    | escrever na T209, antes do código (arquivo só no navegador, sem guarda, relatório sem valores)                                                                                                                                       | —                                                    |
| C-13 | Referência inexistente na planilha   | recusar a linha; **sem criação** de departamento ou cargo pela importação                                                                                                                                                            | criar pelo código (G1 da T197)                       |
| C-14 | Exportação de pessoas                | **indisponível** (`DP-ADM-03` aberto)                                                                                                                                                                                                | CSV com auditoria e ação `export` (outra tarefa)     |
| C-15 | Seleção, ações em lote e ordenação   | **indisponíveis** na T209                                                                                                                                                                                                            | tarefa própria com contrato                          |

## 11. Fora de escopo

CPF, salário, remuneração, contatos e dados pessoais na listagem ou na planilha; exportação de
pessoas; ações em lote; ordenação pelo usuário; filtros novos na API; admissão digital; tipo
Aprendiz; férias, ausências, escala e organograma; acesso de outros papéis; mutação pelo master
técnico; API, migration, RBAC, seed, Docker e workflows; Ready for review e merge.

## 12. Próximo passo

Com C-1 a C-15 aprovadas, a implementação começa nesta branch (`codex/t209-colaboradores`),
pela ficha de tratamento (se C-12) e pelos testes com falha antes. Sem aprovação, nada de
produto é alterado.
