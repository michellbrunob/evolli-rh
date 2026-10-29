# T198 — Dossiê: ficha unificada do Colaborador

**Situação:** decisões D17 a D24 aprovadas em 2026-10-29 (seção 12) e
primeira fatia implementada (seção 13). Nenhuma API, schema, migration,
permissão, banco, Docker, seed ou dependência mudou.
**Escopo:** a ficha do Colaborador no módulo Pessoas, como ponto central de
consulta e operação do que já tem dados e regras aprovadas.
**Diretriz:** uma funcionalidade completa por entrega, com as correções
pequenas e acionáveis resolvidas antes de Ready for review (regras 7 e 8 do
`tasks.md`).
**Referência funcional:** imagens privadas de um produto de mercado, usadas só
para princípios de experiência e hierarquia. Nenhum dado, texto, marca, cor,
ícone, ilustração ou layout delas entra no Evolli, neste dossiê ou em qualquer
artefato versionado.

## 1. Resumo e recomendação

Hoje a "ficha" do Evolli é um **modal** aberto a partir de uma linha da
listagem de Colaboradores, com seções empilhadas (nome, dados pessoais e
endereço, contatos, jornada, vida funcional do vínculo principal e tabela de
vínculos). Ela não tem endereço próprio, não sobrevive a recarregar a página e
só abre a partir da listagem. Dados contratuais, Histórico funcional e Horário
de trabalho vivem como abas separadas do contêiner Pessoas, cada uma com o seu
próprio seletor de colaborador.

Recomendação (aprovada; decisões na seção 12, entrega na seção 13):

1. A ficha vira **página própria**, com rota por colaborador, aberta pela
   listagem no lugar do modal.
2. A página tem um **cabeçalho consolidado** (nome, situação, vínculo
   principal, cargo e departamento vigentes), um **resumo operacional seguro**
   e uma **navegação interna** com quatro áreas que já têm dados e regras:
   Dados do colaborador, Vida funcional, Dados contratuais e Jornada de
   trabalho.
3. Tudo é composto pelos **contratos atuais**, sem API nova: as seções da
   ficha atual e da aba Dados contratuais são reaproveitadas.
4. Nenhuma aba sem dados aparece como pronta. Foto, portal, salários, férias e
   ausências, benefícios, documentos, pesquisas e comentários ficam num
   roadmap explícito, com critérios de entrada (seção 10).

## 2. Referência funcional → equivalente Evolli

O que a referência mostra é tratado só como **princípio**. A coluna da direita
diz o que o Evolli já tem para cumprir o mesmo princípio, com identidade
própria.

| Princípio observado                                          | Equivalente Evolli                                                                                     | Situação                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Identidade no topo: nome, situação e tipo de contrato juntos | Nome, situação do colaborador e do vínculo principal (`vinculoPrincipal`), tipo de vínculo e matrícula | contratos existem               |
| Função logo abaixo do nome                                   | Cargo e departamento **vigentes** do vínculo principal (alocação sem `vigenteAte`)                     | contratos existem (seção 4.2)   |
| Faixa de indicadores rápidos                                 | Admissão do vínculo principal e jornada vigente; contato só para quem lê contatos (D19)                | contratos existem               |
| Chamada para acesso do colaborador ao portal                 | Portal do colaborador é demonstrativo e o autoatendimento não está autorizado (ADR 0015)               | **fora** — roadmap              |
| Abas por domínio, com a primeira de dados cadastrais         | Navegação interna com Dados do colaborador, Vida funcional, Dados contratuais e Jornada                | proposta (seção 6)              |
| Blocos em cartões com edição por bloco                       | Dados pessoais, endereço e contatos já editáveis por bloco (T181), com Salvar e Cancelar               | existe                          |
| Linha do tempo de alterações                                 | Linha do tempo do vínculo (`GET /vinculos/:id/linha-do-tempo`) e Vida funcional (T187)                 | existe                          |
| Escala e carga horária                                       | Jornada do colaborador com vigências (T183); operação só pelo RH                                       | existe                          |
| Estados vazios que explicam e oferecem a próxima ação        | Mensagens de vazio por seção, com ação só quando o perfil pode agir                                    | padrão a aplicar                |
| Salário, histórico salarial e resumo de reajustes            | Nenhum modelo de remuneração no schema                                                                 | **fora** — roadmap              |
| Saldo de férias e histórico de ausências                     | Afastamentos é aba demonstrativa (fixtures); sem regra de período aquisitivo                           | **fora** — roadmap              |
| Benefícios                                                   | Benefícios é aba demonstrativa                                                                         | **fora** — roadmap              |
| Documentos do colaborador                                    | Metadados existem (aba Documentos); upload desabilitado por construção (ADR 0011)                      | **fora** — roadmap (seção 10.6) |
| Pesquisas e comentários                                      | Sem modelo de dados nem decisão de privacidade                                                         | **fora** — roadmap              |
| Exportar ficha                                               | Sem decisão de formato, minimização e trilha                                                           | **fora** — roadmap              |

## 3. Inventário do que existe

### 3.1 Telas

| Tela                                  | Arquivo                                                 | O que faz hoje                                                                                                       |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Listagem de Colaboradores             | `ColaboradoresScreen.tsx`                               | Busca, filtros (situação, Departamento, Cargo), contadores, paginação; abre a ficha em modal a partir da linha       |
| Ficha (modal)                         | `ColaboradoresScreen.tsx` (`Modal`)                     | Nome editável, dados pessoais e endereço, contatos, jornada, vida funcional do vínculo principal, tabela de vínculos |
| Dados pessoais e endereço             | `DadosPessoaisColaboradorSecao.tsx`                     | Leitura e edição por bloco (T177, T181)                                                                              |
| Contatos                              | `ContatosColaboradorSecao.tsx`                          | Leitura e edição (T179, T181)                                                                                        |
| Jornada do colaborador                | `JornadaColaboradorSecao.tsx`                           | Jornada atual e vigências; atribuir, trocar e encerrar só para o RH (T183)                                           |
| Vida funcional                        | `VidaFuncionalColaboradorSecao.tsx`                     | Linha do tempo do vínculo principal, só leitura, com atalho ao Histórico funcional (T187)                            |
| Histórico funcional                   | `HistoricoFuncionalScreen.tsx`                          | Movimentações do vínculo, com registro e operação para RH e DP                                                       |
| Dados contratuais                     | `DadosContratuaisScreen.tsx`                            | Contrato somente leitura: vínculo, alocação por vigência, horário e movimentações (T134)                             |
| Horário de trabalho                   | `PessoasHorarioScreen.tsx`                              | Vínculos de horário da empresa, com filtros e paginação (T191–T193)                                                  |
| Documentos e Solicitações             | `PessoasDocumentosScreen.tsx`, `SolicitacoesScreen.tsx` | Metadados de documentos e Central de solicitações (funcionais, fora da ficha)                                        |
| Benefícios, Dependentes, Afastamentos | `BeneficiosScreen.tsx` e outros                         | **Demonstrativos** (fixtures), sem servidor                                                                          |

### 3.2 Rotas

- `#/pessoas/colaboradores` abre o contêiner Pessoas na aba Colaboradores;
  `#/pessoas/nova-admissao` abre a Nova admissão (`rotasDoShell.ts`).
- As demais abas de Pessoas e a ficha **não têm rota**: recarregar volta à
  listagem.
- Depois de uma troca de empresa, a Nova admissão volta à listagem
  (`destinoAposTrocaDeEmpresa`); a ficha aberta some porque a página remonta
  (T189).

### 3.3 Contratos de leitura disponíveis (sem API nova)

| Necessidade na ficha                        | Contrato                                                                                                                           | Permissão (`@RequirePermission`)    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Colaborador (nome, situação)                | `GET /v1/colaboradores/:id`                                                                                                        | `colaborador` read                  |
| Vínculos (matrícula, tipo, situação, datas) | `GET /v1/colaboradores/:id/vinculos`                                                                                               | `vinculo_funcional` read            |
| Alocação por vigência (ids das referências) | `GET /v1/vinculos/:id/alocacoes`                                                                                                   | `alocacao_organizacional` read      |
| Situação do vínculo                         | `GET /v1/vinculos/:id/situacao`                                                                                                    | `alocacao_organizacional` read      |
| Linha do tempo                              | `GET /v1/vinculos/:id/linha-do-tempo`                                                                                              | `movimentacao_funcional` read       |
| Nome de cada referência                     | `GET /v1/cargos/:id`, `/departamentos/:id`, `/unidades-organizacionais/:id`, `/areas/:id`, `/equipes/:id`, `/centros-de-custo/:id` | read de cada recurso organizacional |
| Jornada e vigências                         | `GET /v1/horarios/vinculos?colaboradorId=`                                                                                         | `vinculo_horario` read              |
| Dados pessoais e endereço                   | `GET /v1/colaboradores/:id/dados-pessoais`                                                                                         | `dados_pessoais_colaborador` read   |
| Contatos                                    | `GET /v1/colaboradores/:id/contatos`                                                                                               | `contato_colaborador` read          |
| Lotação e jornada vigentes já resolvidas    | `GET /v1/colaboradores` (linha da listagem)                                                                                        | `colaborador` read                  |

Pontos de atenção:

- `GET /colaboradores/:id/vinculos` **não** traz cargo nem departamento. Hoje
  a ficha usa a lotação da **linha** de onde foi aberta (`lotacaoDaLinha`). Uma
  página com rota direta não tem linha: precisa compor pela alocação vigente e
  pelo detalhe de cada referência (D20).
- Dados contratuais e Histórico funcional resolvem nomes pelos catálogos com o
  teto de 100 itens. A ficha **não deve** herdar esse teto: o detalhe por id
  resolve qualquer referência.
- O schema não guarda CPF nem foto, e não há modelo de remuneração.

### 3.4 Edição existente

| Ação                                     | Quem (web)                       | Servidor                               |
| ---------------------------------------- | -------------------------------- | -------------------------------------- |
| Nome, dados pessoais, endereço, contatos | RH e DP (`PAPEIS_EDICAO_FICHA`)  | `alter` para RH e DP na empresa        |
| Atribuir, trocar e encerrar jornada      | RH (`PAPEIS_OPERACAO_JORNADAS`)  | `vinculo_horario` create/alter só RH   |
| Movimentações (Histórico funcional)      | RH e DP                          | `movimentacao_funcional` create/manage |
| Admissão                                 | RH e DP (`PAPEIS_NOVA_ADMISSAO`) | `colaborador` create                   |

## 4. Matriz por perfil

| Perfil           | Ficha unificada hoje                        | Proposta da primeira fatia                                             |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `rh`             | Lê e edita (empresa ativa)                  | Lê tudo da fatia; edita dados, endereço e contatos; opera jornada      |
| `dp`             | Lê e edita dados; jornada só leitura        | Igual ao de hoje: edita dados, endereço e contatos; jornada só leitura |
| `master_tecnico` | Lê (empresa ativa ou global); não edita     | Só leitura, sem ações de escrita; a consulta global continua auditada  |
| `gestor`         | Sem ficha; consulta própria em Minha equipe | Sem acesso à ficha; Minha equipe continua sendo a visão dele           |
| `colaborador`    | Sem acesso                                  | Sem acesso (autoatendimento não autorizado)                            |
| `financeiro`     | Sem acesso a Pessoas                        | Sem acesso                                                             |
| `auditor`        | Sem acesso a Pessoas                        | Sem acesso (nenhuma regra concede)                                     |
| `dpo`            | Sem acesso a Pessoas                        | Sem acesso (nenhuma regra concede)                                     |

Princípio: a interface só oferece o que o servidor aceitaria; quem decide cada
requisição é o servidor, com 404 para recurso fora do escopo.

## 5. Estados que a ficha precisa tratar

| Estado                                  | Comportamento proposto                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Carregando                              | Cabeçalho com marcação de carregamento e anúncio único; abas desabilitadas até o colaborador chegar       |
| Erro de leitura                         | Mensagem com "Tentar de novo" por bloco; um bloco com erro não derruba os outros                          |
| Colaborador fora da empresa ativa / 404 | "Colaborador não encontrado na empresa ativa", sem revelar outra empresa, com retorno à listagem          |
| Sem vínculo                             | Cabeçalho só com nome e situação; Vida funcional, Dados contratuais e Jornada explicam que não há vínculo |
| Vínculo previsto                        | Selo "Previsto" e data de admissão futura; nada calculado sobre o futuro                                  |
| Vínculo ativo                           | Cargo e departamento vigentes no cabeçalho                                                                |
| Vínculo encerrado                       | Selo "Encerrado" com data de desligamento; dados históricos sem ações de alteração                        |
| Vários vínculos                         | Cabeçalho usa o vínculo principal (mesma ordem da listagem); os demais aparecem em lista, sem esconder    |
| Sem lotação vigente                     | "Sem lotação vigente" no lugar de cargo e departamento                                                    |
| Sem jornada                             | "Sem jornada atribuída"; para o RH, a ação de atribuir                                                    |
| Referência inativa                      | Nome com marcação "(inativo)", sem tratá-la como erro                                                     |
| Empresa trocada (nesta ou em outra aba) | Edição pendente pergunta antes (T189); depois da troca, volta à listagem da empresa nova                  |
| Rota direta, recarregar, voltar         | A rota abre a mesma ficha; colaborador de outra empresa cai no estado 404                                 |
| Sessão expirada                         | Fluxo de sessão existente; dados digitados preservados onde já são                                        |

## 6. Primeira fatia recomendada

### 6.1 Escopo

1. **Página própria** da ficha, com rota por colaborador, aberta pelo "Abrir
   ficha" da listagem, que deixa de abrir o modal (D17, D22).
2. **Cabeçalho consolidado:**
   - nome e situação do colaborador;
   - vínculo principal com tipo, matrícula e situação;
   - cargo e departamento vigentes;
   - ações permitidas ao perfil (por exemplo, "Nova movimentação" leva ao
     Histórico funcional com o colaborador escolhido).
3. **Resumo operacional seguro:** data de admissão do vínculo principal e
   jornada vigente. Contatos ficam só na aba de dados (D19). Nenhum valor
   recalculado que o servidor não forneça.
4. **Navegação interna** (abas no padrão ARIA, ativação manual):
   - **Dados do colaborador:** nome, dados pessoais, endereço e contatos,
     reaproveitando as seções atuais, com edição por bloco para RH e DP;
   - **Vida funcional:** a seção da T187, para o vínculo principal, e a lista
     dos outros vínculos;
   - **Dados contratuais:** o conteúdo da aba atual, já filtrado para o
     colaborador e sem o seletor;
   - **Jornada de trabalho:** a seção da T183, com operação só para o RH.
5. **Endereço por aba** na rota (D18), para recarregar e voltar sem perder a
   área.

### 6.2 O que não entra

Foto, portal e convite, salários, férias e ausências, benefícios,
documentos, pesquisas, comentários e exportação. Nenhuma aba aparece desabilitada
ou com "em breve": o que não existe simplesmente não aparece (D21 trata o caso
de mostrar o roadmap fora da navegação).

### 6.3 Sem mudança de contrato

A fatia usa só os contratos da seção 3.3. Cargo e departamento vêm da
alocação vigente mais o detalhe de cada referência por id (sem teto de 100).
Se a decisão D20 preferir um endpoint de resumo, ele vira uma entrega
própria, aditiva e só de leitura.

## 7. Telas, rotas e permissões

| Elemento         | Proposta                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Rota da ficha    | `#/pessoas/colaboradores/:id`, com segmento opcional da aba (`/dados`, `/vida-funcional`, `/contratuais`, `/jornada`) |
| Entrada          | "Abrir ficha" na listagem; atalhos da Nova admissão ("Abrir ficha" do admitido) passam a usar a rota                  |
| Saída            | Trilha de navegação Pessoas → Colaboradores → nome; "voltar" do navegador volta à listagem com o filtro dela          |
| Acesso           | Os mesmos papéis que leem Colaboradores (`rh`, `dp`, `master_tecnico`); os demais não recebem o destino               |
| Troca de empresa | A rota da ficha entra em `destinoAposTrocaDeEmpresa` e volta à listagem                                               |
| Autorização      | Só do servidor; a rota apenas monta a página                                                                          |

A tabela de rotas do shell hoje é fechada e sem parâmetros. A ficha exige o
primeiro segmento variável (o id), validado como UUID antes de qualquer
requisição.

## 8. Acessibilidade e responsividade

- Um único `h1` (nome do colaborador) e foco nele ao abrir; título do
  documento com o nome.
- Abas com `role="tablist"`, setas, Home e End, ativação manual por Enter e
  Espaço; a aba ativa marcada por texto e borda, não só por cor.
- Selos de situação com texto ("Ativo", "Previsto", "Encerrado").
- Anúncios únicos para carregamento, erro e sucesso de edição.
- **375 px:**
  - o cabeçalho empilha;
  - a faixa de indicadores vira lista;
  - as abas rolam na horizontal dentro da própria faixa, sem rolagem da
    página;
  - controles de 44 px.
- Edição pendente em qualquer bloco conta para a troca de empresa e para
  sair da página (T189).

## 9. Riscos e testes necessários

**Riscos:**

- Rota direta para colaborador de outra empresa: o servidor responde 404, e a
  tela não pode sugerir que existe.
- Composição do cabeçalho sem a linha da listagem: cargo e departamento
  precisam vir da alocação vigente, não de um cache da listagem.
- Duas fontes de verdade (modal e página): a fatia substitui o modal para não
  manter duas fichas.
- Quantidade de requisições: carregar cada aba sob demanda, não tudo de uma
  vez.
- Recalcular tempo de empresa ou situação no navegador contrariaria a regra
  de Dados contratuais; a fatia não recalcula nada.

**Testes:**

- Web, rota:
  - abrir pela linha;
  - abrir pela URL;
  - recarregar;
  - voltar;
  - id inválido;
  - 404.
- Web, cabeçalho em cada estado da seção 5:
  - sem vínculo, previsto, ativo, encerrado;
  - sem lotação, sem jornada;
  - referência inativa;
  - vários vínculos.
- Web, perfis:
  - RH e DP editam dados;
  - só o RH opera jornada;
  - `master_tecnico` sem nenhuma ação de escrita;
  - outros papéis sem o destino.
- Web, interação:
  - teclado nas abas;
  - foco inicial;
  - anúncios;
  - contrato de CSS a 375 px.
- Web, troca de empresa:
  - com edição pendente;
  - sem edição pendente;
  - em outra aba.
- E2E: nenhuma mudança de contrato; os E2E atuais de colaborador, vínculo,
  alocação, linha do tempo, jornada, dados pessoais e contatos continuam como
  prova, mais isolamento por empresa no detalhe por id.
- Localhost: banco isolado e dados sintéticos, com RH, DP e
  `master_tecnico`, cobrindo cada estado.

## 10. Roadmap das abas futuras e critérios de entrada

| Capacidade              | Critério de entrada antes de qualquer interface                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 Foto               | Política de armazenamento (R2), consentimento e base legal, tamanho e formatos, antivírus, URLs assinadas de curta duração, retenção e descarte |
| 10.2 Portal e convite   | Decisão sobre autoatendimento (hoje não autorizado, ADR 0015), vínculo conta–colaborador, convite e expiração, MFA                              |
| 10.3 Salários           | Modelo de remuneração e histórico, perfis que leem (financeiro? DP?), minimização, trilha de consulta, relação com Folha                        |
| 10.4 Férias e ausências | Regras de período aquisitivo e concessão, tipos de afastamento, integração com Jornada, aprovação                                               |
| 10.5 Benefícios         | Catálogo, elegibilidade, dependentes e custos; hoje é demonstrativo                                                                             |
| 10.6 Documentos         | Nível 2 da ADR 0011: R2, política de acesso por categoria, retenção, antivírus, categorias documentais, URLs assinadas, trilha de download      |
| 10.7 Pesquisas          | Fora do escopo de Pessoas até haver módulo próprio e regra de anonimato                                                                         |
| 10.8 Comentários        | Modelo de dados, quem escreve e lê, privacidade (dado sensível em texto livre), edição e exclusão, auditoria                                    |
| 10.9 Exportar ficha     | Formato, minimização por perfil, marca d'água ou trilha, e o que nunca sai                                                                      |

Cada uma entra como entrega própria, depois da decisão, nunca como aba vazia.

## 11. Opções de escopo

| Opção | Conteúdo                                                                                            | Prós                                            | Contras                                               |
| ----- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| A     | Modal atual ampliado com cabeçalho e abas, sem rota                                                 | Menor mudança                                   | Continua sem endereço, recarregar perde a ficha       |
| **B** | Página própria com rota por colaborador e por aba, substituindo o modal; sem API nova (recomendada) | Endereço estável, voltar e recarregar funcionam | Exige o primeiro segmento variável na tabela de rotas |
| C     | B mais um endpoint de resumo agregado (cabeçalho em uma requisição)                                 | Menos requisições no cabeçalho                  | Mudança de API; entrega maior                         |

## 12. Decisões (aprovadas em 2026-10-29)

Todas aprovadas como recomendado abaixo: página própria com rota por
colaborador e por aba, admissão e jornada vigente no resumo sem "tempo de
empresa", contatos só na aba de dados, cargo e departamento pela alocação
vigente e detalhe por id, nada do roadmap na tela, o modal substituído,
`master_tecnico` só leitura e as três visões da empresa mantidas com atalho
para a ficha.

1. **D17 — Forma da ficha:** página própria com rota (recomendado) ou modal
   ampliado.
2. **D18 — Endereço por aba:** segmento da aba na rota (recomendado) ou só a
   rota do colaborador.
3. **D19 — Cabeçalho e resumo:**
   - admissão do vínculo principal (recomendado) ou "tempo de empresa"
     calculado;
   - jornada vigente no resumo;
   - contatos só na aba de dados (recomendado) ou também no cabeçalho.
4. **D20 — Composição de cargo e departamento:** alocação vigente mais detalhe
   por id, sem API nova (recomendado), ou endpoint de resumo (opção C).
5. **D21 — Roadmap visível:** não mostrar nada das abas futuras (recomendado)
   ou uma nota fora da navegação, sem aparência de aba.
6. **D22 — Destino do modal atual:** substituir pelo link à página
   (recomendado) ou manter os dois.
7. **D23 — `master_tecnico` na ficha:** só leitura, como hoje (recomendado).
8. **D24 — Abas de Pessoas que já existem** (Dados contratuais, Histórico
   funcional, Horário): continuam como visões da empresa, com atalho para a
   ficha (recomendado), ou deixam de existir quando a ficha cobrir o mesmo
   conteúdo.

## 13. Entrega (implementada em 2026-10-29)

### 13.1 Rotas e shell

- Rota `#/pessoas/colaboradores/:id/:aba`, com as abas `dados`,
  `vida-funcional`, `contratuais` e `jornada` (`fichaDaRota` e `rotaDaFicha`
  em `apps/web/src/app/rotasDoShell.ts`). Sem aba, vale `dados` e a URL é
  corrigida no lugar. Id fora do formato UUID, aba desconhecida ou segmento a
  mais não são rota: nenhuma requisição é feita por eles.
- A ficha pertence ao destino `pessoas`: a mesma capacidade de Colaboradores
  (`rh`, `dp`, `master_tecnico`) decide a entrada pela URL, o "voltar" e o
  "avançar". Quem não abre Colaboradores (gestor, colaborador, financeiro,
  auditor, DPO) não monta a ficha, e a rota recusada não fica na URL.
- Abrir pela linha da listagem empilha a rota da ficha; trocar de aba
  empilha a rota da aba; a rota digitada ou recarregada abre direto, sem
  entrada nova no histórico e sem montar a listagem por baixo.
- Troca de empresa com a ficha aberta: o shell é recriado na listagem de
  Colaboradores da empresa nova, com o foco no título — a ficha da empresa
  anterior não é reaberta. Colaborador de outra empresa pela URL: "não
  encontrado" (o 404 do servidor), sem nome nem dado.

### 13.2 Página da ficha

- `FichaColaboradorScreen` substitui o modal da listagem (D22); a trilha
  volta a Colaboradores, e o foco volta a quem abriu a ficha (ou à aba ativa
  de Pessoas, quando a ficha veio pela URL).
- Cabeçalho: nome (h1, com foco ao abrir), situação **nesta empresa** (ativo
  se houver vínculo ativo nela, nunca a situação global), cargo e
  departamento da lotação vigente, vínculo principal (tipo, matrícula e
  situação, pela mesma regra da listagem), admissão, desligamento quando
  encerrado e jornada vigente. Lotação e jornada só para vínculo principal
  ativo; previsto, encerrado ou sem vínculo dizem "Sem lotação vigente" e
  "Sem jornada vigente" sem consultar. Referência inativa leva "(inativo)";
  jornada inativa, a marca "Jornada inativa".
- Composição (D20): `GET /colaboradores/:id` e `/:id/vinculos`; a alocação
  aberta de `GET /vinculos/:id/alocacoes`; `GET /cargos/:id` e
  `GET /departamentos/:id` pelos ids dela; `GET /horarios/vinculos` do
  colaborador para a jornada. Falha de lotação ou de jornada fica no próprio
  item, com "Tentar de novo".
- Quatro abas funcionais (D21), com `tablist`, `tabpanel`, setas, Home e End
  movendo o foco e a ativação pelo clique ou Enter: Dados do colaborador
  (nome, dados pessoais, endereço e contatos), Vida funcional (linha do tempo
  do vínculo principal, atalho para o Histórico funcional e os outros
  vínculos), Dados contratuais (a tela da empresa fixada no colaborador, sem
  seletor) e Jornada de trabalho. Abas visitadas ficam montadas e escondidas:
  trocar de aba não perde o que foi digitado.
- Edição (D23): as mesmas regras de antes — nome, dados pessoais, endereço e
  contatos para RH e DP; jornada só para o RH; `master_tecnico` só lê. Edição
  pendente pede confirmação ao voltar; durante a gravação, voltar não sai; a
  troca de empresa avisa como antes (T189).
- Respostas atrasadas: a página é remontada por colaborador e descarta
  qualquer resposta de uma montagem anterior — de outro colaborador ou de
  outra empresa.
- Em 375 px, cabeçalho, resumo e painéis encolhem com a tela; as abas rolam
  na própria faixa e as tabelas, no próprio quadro. Nenhuma rolagem
  horizontal da página.

### 13.3 Visões da empresa (D24)

- Dados contratuais e Histórico funcional ganham "Abrir ficha de …" depois de
  escolhido o colaborador; no Horário de trabalho, o nome na linha abre a
  ficha. As três continuam como visões da empresa inteira.

### 13.4 Limites conhecidos

- O cabeçalho faz algumas leituras pequenas por colaborador (colaborador,
  vínculos, alocações, cargo, departamento, jornada); um resumo agregado
  seria a opção C, não aprovada.
- A jornada do cabeçalho lê até 100 vigências do colaborador, como a seção
  de jornada já fazia.
- As demais abas de Pessoas seguem sem URL própria (limitação anterior,
  registrada em `rotasDoShell.ts`).
- Foto, portal, salários, férias e ausências, benefícios, documentos,
  pesquisas, comentários e exportação seguem no roadmap da seção 10, sem
  nada na tela.
