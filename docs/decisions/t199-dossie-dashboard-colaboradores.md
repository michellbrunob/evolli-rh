# T199 — Dossiê: Dashboard de Colaboradores

**Situação:** decisões D-1 a D-6 e N-1 a N-6 aprovadas em 2026-10-30 (seções
2 e 3); contrato e telas implementados (seções 5 a 8); a entrega, com as
notas de implementação, na seção 12.
**Base:** `main` no squash `cfcd901` (T198 integrada, PR #191): a ficha
unificada em página própria (`#/pessoas/colaboradores/:id/:aba`).
**Escopo:** a porta principal de Gestão de Pessoas › Colaboradores vira um
dashboard com indicadores reais, abas funcionais e tabela que abre a ficha.
**Referência funcional:** imagens privadas de um produto de mercado, usadas só
para hierarquia de informação e clareza de uso. Nenhum dado, texto, marca,
cor, ícone, ilustração ou layout delas entra no Evolli, neste dossiê ou em
qualquer artefato versionado.

## 1. O que existe hoje

- `GET /v1/colaboradores` (T178, T184 a T186, T190): busca por nome ou
  matrícula; filtros `situacao` (ativo/inativo na empresa ativa),
  `situacaoVinculo` (previsto/ativo/encerrado), `departamentoId` e `cargoId`
  pela lotação vigente; paginação no servidor (20 na tela, teto 100);
  contadores `ativos` e `inativos` do escopo inteiro, sem filtros.
- Projeção fechada por vínculo: `id`, `empresaId`, `matricula`, `situacao`,
  `dataAdmissao`, `dataDesligamento`, `lotacaoVigente` (cargo e
  departamento) e `vigenciasDeJornada`. **Sem `tipo`.**
- Tela: seletores Todos/Ativos/Inativos com totais, select "Situação do
  vínculo", Departamento e Cargo, tabela de sete colunas e "Abrir ficha"; o
  rótulo de escopo já diz "no seu escopo" para o `master_tecnico` sem empresa
  ativa. Nenhum estado na URL (decisão da T186, revista pela D-3).
- Pessoas › "Horário de trabalho" (T191 a T193): a visão da empresa dos
  vínculos de horário, paginada, com filtros e o nome que abre a ficha.
- Acesso: RH e DP na empresa ativa; `master_tecnico` só lê (global sem
  empresa ativa); gestor, colaborador, financeiro, auditor e DPO negados.
  Admitir ("Adicionar colaborador"): RH e DP.
- Ausentes: CPF e salário não existem (Baseline V1); contatos só por
  colaborador (T169, ficha de tratamento A2 restrita); férias, ausências e
  escala dependem de Ponto e de regra trabalhista; não há exportação.

## 2. Decisões aprovadas (2026-10-30)

1. **D-1 — Desligados:** colaborador sem vínculo ativo e com vínculo
   encerrado na empresa ativa. Quem foi readmitido aparece em Ativos.
2. **D-2 — Tipo de vínculo:** entra agora na projeção, no filtro e na
   contagem da API, para a distribuição real dos tipos.
3. **D-3 — URL:** aba, página e ids de filtros ficam na URL. O texto da
   busca nunca vai para a URL.
4. **D-4 — Em admissão:** aba própria para vínculos previstos.
5. **D-5 — Jornada de trabalho:** aba apenas como acesso à visão já
   existente da empresa; nada de escala, ausência ou férias fictícias.
6. **D-6 — Escopo global:** para o `master_tecnico` sem empresa ativa, os
   rótulos dizem "no seu escopo", nunca "nesta empresa".

## 3. Decisões novas (aprovadas em 2026-10-30, como recomendadas)

Pontos que as D-1 a D-6 não cobrem e que mudam o resultado. As seis foram
aprovadas na forma recomendada abaixo.

1. **N-1 — Grupos exclusivos e precedência.** Um colaborador com vínculo
   previsto e outro encerrado (readmissão em andamento) cairia, pela letra
   das D-1 e D-4, em "Desligados" e em "Em admissão" ao mesmo tempo.
   **Aprovado:** grupos exclusivos, com precedência ativo > previsto >
   encerrado — Ativos (tem vínculo ativo), Em admissão (sem ativo, com
   previsto), Desligados (sem ativo nem previsto, com encerrado). Assim
   Ativos + Em admissão + Desligados = Total no escopo, sempre.
2. **N-2 — Unidade da distribuição por tipo.** Contar **colaboradores
   ativos** pelo tipo do vínculo principal ativo (soma = Ativos), ou contar
   **vínculos ativos** por tipo (soma pode passar de Ativos quando alguém tem
   dois vínculos ativos). **Aprovado:** colaboradores, pelo vínculo
   principal (mesma regra da listagem e da ficha).
3. **N-3 — Abas versus filtros de situação atuais.** As abas Ativos, Em
   admissão, Desligados e Todos fazem o papel dos seletores
   Todos/Ativos/Inativos e do select "Situação do vínculo"; manter os dois
   produziria combinações contraditórias (aba Ativos + "encerrado").
   **Aprovado:** as abas substituem os seletores e o select; ficam busca,
   Departamento, Cargo e o novo Tipo de vínculo. O contrato antigo
   (`situacao`, `situacaoVinculo`) continua aceito pela API.
4. **N-4 — Forma da aba "Jornada de trabalho".** O contêiner Pessoas já tem a
   aba "Horário de trabalho" com essa visão. Opções: (a) a aba do dashboard
   mostra o mesmo componente da visão existente, sem lógica nova; (b) um
   atalho fora das abas que leva a Pessoas › Horário de trabalho.
   **Aprovado:** (a), com o mesmo componente e as mesmas permissões
   (operação só do RH); o rótulo do contêiner ("Horário de trabalho") fica
   como está nesta entrega.
5. **N-5 — Filtro de tipo combinado com a aba.** "Ativos + PJ" pode
   significar "tem vínculo ativo do tipo PJ" ou "está ativo e tem algum
   vínculo PJ". **Aprovado:** o mesmo vínculo — o tipo se aplica ao
   vínculo que define o grupo (ativo em Ativos, previsto em Em admissão,
   encerrado em Desligados; qualquer um em Todos).
6. **N-6 — Aba inicial.** Hoje a listagem abre em "Todos". **Aprovado:**
   abrir em Ativos (a visão operacional do dia a dia); "Todos" continua a um
   clique e endereçável pela URL.

## 4. Indicadores

Calculados no servidor, pelo escopo inteiro (empresa ativa, ou global para o
`master_tecnico` sem empresa ativa), **sem** busca, filtros nem aba — os
mesmos números com qualquer filtro, como os contadores da T186:

| Indicador       | Regra                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Ativos          | Tem vínculo ativo no escopo                                              |
| Em admissão     | Sem vínculo ativo, com vínculo previsto (N-1)                            |
| Desligados      | Sem vínculo ativo nem previsto, com vínculo encerrado (D-1, N-1)         |
| Total no escopo | Tem algum vínculo no escopo                                              |
| Ativos por tipo | Ativos pelo tipo do vínculo principal ativo (N-2), só tipos com contagem |

Nada de ausentes do dia, tempo de casa, salário, CPF, contatos, férias ou
escala: não há fonte real para nenhum deles.

## 5. Contrato (extensão mínima de `GET /v1/colaboradores`)

Sem endpoint novo, sem schema, migration, RBAC novo, seed ou dependência.

**Query (novos parâmetros, opcionais):**

- `grupo`: `ativos` | `em_admissao` | `desligados` (ausente = todos), com as
  regras da seção 4. Aplicado no `where`, antes da paginação.
- `tipoVinculo`: `clt` | `estagio` | `pj` | `temporario` | `outro_controlado`,
  validado contra o enum; aplicado ao vínculo que define o grupo (N-5).
- `situacao` e `situacaoVinculo` continuam aceitos (compatibilidade).

**Resposta:**

- `VinculoListado` ganha `tipo` (dado aprovado na Baseline V1: "tipo/situação
  do vínculo").
- `contadores` ganha, mantendo `ativos` e `inativos`:
  `emAdmissao`, `desligados`, `total` e `ativosPorTipo`
  (`{ clt, estagio, pj, temporario, outro_controlado }`, zeros incluídos).

**Regras que não mudam:** escopo pela sessão (`resolverEscopoLeituraPessoas`,
`intersectarLeitura`); vínculos e contagens só da empresa ativa para RH e DP;
auditoria da consulta global do `master_tecnico`; projeção fechada; busca com
curingas escapados; filtros antes da paginação; ordenação estável por nome e
id.

## 6. Tela, abas e URL

- **Cabeçalho:** título "Colaboradores", uma frase de contexto própria do
  Evolli e "Adicionar colaborador" (painel da T194, RH e DP). Sem
  exportação.
- **Faixa de indicadores:** cartões com Ativos, Em admissão, Desligados e
  Total no escopo; um cartão de distribuição dos ativos por tipo, com barra
  proporcional e legenda em texto (nunca só cor). Rótulos de escopo pela D-6.
- **Abas (`tablist`, mesmo padrão da ficha):** Ativos · Em admissão ·
  Desligados · Todos, cada uma com o total do grupo; e Jornada de trabalho
  (N-4). Setas, Home e End movem o foco; Enter ativa.
- **Filtros:** busca (fora da URL), Departamento, Cargo e Tipo de vínculo;
  chips dos filtros ativos com remoção individual.
- **Tabela:** avatar neutro por iniciais; nome como botão "Abrir ficha de …"
  (ficha da T198, aba de dados); matrícula; cargo; departamento; jornada
  vigente; tipo; situação; admissão; desligamento só em Desligados. Nunca
  CPF, salário ou contatos.
- **URL:** `#/pessoas/colaboradores?aba=ativos&pagina=2&departamento=<id>&cargo=<id>&tipo=clt`
  — só aba, página e ids. Valor inválido ou de outra empresa cai no padrão,
  sem requisição com ele. A rota da ficha não muda.
- **Ida e volta da ficha:** a listagem fica montada e escondida (T198);
  voltar pela trilha, pelo navegador ou depois de recarregar restaura aba,
  página e filtros pela URL. A busca só sobrevive dentro da sessão.
- **Troca de empresa:** a URL volta a `#/pessoas/colaboradores` (aba padrão,
  sem filtros) e o foco vai ao título.

## 7. Permissões

| Perfil                                        | Dashboard               | Adicionar | Jornada (aba)    |
| --------------------------------------------- | ----------------------- | --------- | ---------------- |
| RH                                            | Empresa ativa           | Sim       | Consulta e opera |
| DP                                            | Empresa ativa           | Sim       | Só consulta      |
| `master_tecnico` com empresa                  | Empresa ativa, lê       | Não       | Só consulta      |
| `master_tecnico` sem empresa                  | Global, "no seu escopo" | Não       | Só consulta      |
| Gestor, colaborador, financeiro, auditor, DPO | Negado (rota e API)     | —         | —                |

## 8. Acessibilidade e 375 px

- Um `h1`; indicadores como lista de definição com texto; números
  anunciados uma vez (sem região viva repetida a cada filtro).
- Abas com nome e total legível ("Ativos, 12"); foco previsível ao trocar de
  aba, página e filtro; o botão do nome devolve o foco ao voltar da ficha.
- 375 px: cabeçalho e indicadores empilham; abas em grade de duas colunas,
  como na ficha; a tabela rola só dentro do quadro; nenhuma rolagem
  horizontal da página.

## 9. Testes previstos

- **API unitária:** `tipo` na projeção; `grupo` com precedência (readmitido em
  Ativos; previsto + encerrado em Em admissão); `tipoVinculo` no mesmo
  vínculo do grupo; contadores do escopo sem filtros; `ativosPorTipo` pelo
  vínculo principal; validação dos enums.
- **E2E (PostgreSQL real):** RH e DP na empresa ativa (sem vínculo de outra
  empresa nos números nem nas linhas); `master_tecnico` com e sem empresa
  ativa; perfis negados (403, sem dado); paginação, busca e filtros
  combinados com cada grupo; readmitido; previsto, ativo e desligado nas abas
  certas.
- **Web:** abas e teclado; URL com aba, página e ids e **sem** a busca;
  recarga, voltar e avançar; valor inválido na URL; troca de empresa limpando
  estado; estados vazios por aba; nome abre a ficha certa e o foco volta;
  "no seu escopo" para o global; 375 px e contrato de CSS por tokens; nada de
  CPF, salário ou contatos na tabela.
- Toda correção pequena encontrada no caminho com teste que falhe sem ela.

## 10. Fora do escopo

Guarda global de navegação do shell, "Referência técnica" em Dados
contratuais, exportação, ausências do dia, férias, escala, organograma, CPF,
salário, contatos na visão coletiva, documentos, R2, foto, portal,
benefícios, pesquisas, comentários, schema, migration, RBAC novo, seed,
Docker, dependências, promoção e merge.

## 11. Riscos

- **Custo das contagens:** quatro contagens e uma distribuição a mais por
  leitura; os índices atuais (`vinculo_funcional` por empresa e situação)
  cobrem os filtros. A distribuição pelo vínculo principal pede consulta
  agregada; medir no E2E.
- **Semântica dos grupos:** sem N-1, os números não fecham com o total.
- **Dado pessoal na URL:** a busca fica fora por regra e por teste.
- **Duas portas para a mesma visão de jornada** (N-4): o rótulo precisa
  deixar claro que é a mesma visão.

## 12. Entrega

**Contrato final de `GET /v1/colaboradores`** (sem endpoint novo):

- Query nova, opcional: `grupo` (`ativos` | `em_admissao` | `desligados`) e
  `tipoVinculo` (enum do vínculo). Valor fora do enum responde **400**, sem
  consulta. Os dois entram no `where` antes da paginação; `situacao`,
  `situacaoVinculo`, `busca`, `departamentoId` e `cargoId` seguem como antes
  e se combinam com eles.
- Grupos (N-1): Ativos = algum vínculo ativo no escopo; Em admissão = nenhum
  ativo e algum previsto; Desligados = nenhum ativo nem previsto e algum
  encerrado. O tipo (N-5) vale para o vínculo que define o grupo; sem grupo,
  para qualquer vínculo do escopo.
- Projeção: cada vínculo ganha `tipo`.
- `contadores`: `ativos`, `inativos` (mantidos), `emAdmissao`, `desligados`,
  `total` e `ativosPorTipo` (os cinco tipos, zeros incluídos), sempre do
  escopo inteiro, sem busca, filtros nem grupo.

**Notas de implementação:**

- **N-2 só pesa no escopo global.** O banco já impede dois vínculos ativos do
  mesmo colaborador na mesma empresa (`vinculo_funcional_ativo_unico`), então,
  para RH e DP, "o vínculo principal ativo" é o único ativo. A regra do
  principal (admissão mais recente, depois a matrícula) decide só para o
  `master_tecnico` sem empresa ativa, com ativos em empresas diferentes; o
  teste unitário cobre esse caso, e o E2E cobre o caso por empresa.
- **Lotação só em Ativos e Todos.** A lotação vigente só existe em vínculo
  ativo (T184, T190): Departamento e Cargo nunca casariam em Em admissão nem
  em Desligados, então lá os dois filtros não aparecem e os ids saem do
  estado e da URL. O Tipo de vínculo vale em todas as abas da tabela.
- **Ids de filtro conferidos antes da consulta.** Um id de Departamento ou
  Cargo vindo da URL só vira consulta depois de conferido nos catálogos da
  empresa ativa (só ativos). Enquanto eles carregam, a tabela espera; se o id
  não está lá (outra empresa, inativo), cai no padrão e a URL é corrigida
  **no lugar** (`replaceState`), para o "voltar" não cair de novo no
  endereço inválido. Se os catálogos falham, o servidor decide — o escopo
  dele nunca devolve outra empresa.
- **URL.** `#/pessoas/colaboradores?aba=…&pagina=…&departamento=…&cargo=…&tipo=…`
  só com o que difere do padrão (Ativos, página 1, sem filtros), em ordem
  fixa. Trocar aba, página ou filtro empilha uma entrada; corrigir valor
  inválido não. A aba Jornada não leva página, lotação nem tipo. Sair pela
  barra lateral e voltar abre o estado inicial; a troca de empresa também.
- **Aba Jornada de trabalho (N-4).** É a visão de Pessoas › Horário de
  trabalho, embutida (título em `h2`), com as mesmas permissões: só o RH
  opera. Os indicadores continuam acima dela, por uma leitura mínima dos
  contadores quando ela é a primeira aba aberta.
- **Tela.** Os seletores Todos/Ativos/Inativos, o select "Situação do
  vínculo" e o aviso "Ainda indisponível" saíram (N-3); a frase do cabeçalho
  descreve o que a tela faz. O nome acessível de cada aba traz o total
  ("Ativos, 12"); o número visível é decorativo para leitor de tela.
- **Estados de exceção.** Lista vazia com total maior que zero (página além
  do fim, vinda da URL, do "voltar" ou de um conjunto que encolheu) mostra
  sempre "Nenhum colaborador nesta página" e "Ir para a primeira página",
  mantendo busca e filtros. "Limpar busca e filtros" é uma única mudança de
  estado. Se os totais não carregam na aba Jornada, um aviso com "Tentar
  novamente" relê só os contadores. Cada aba de tabela tem um título de
  seção (`h2`, só para leitor de tela) acima dos estados vazios e do erro.
