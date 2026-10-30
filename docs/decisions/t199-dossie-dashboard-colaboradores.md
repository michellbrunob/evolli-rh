# T199 — Dossiê: Dashboard de Colaboradores

**Situação:** decisões D-1 a D-6 aprovadas em 2026-10-30 (seção 2); contrato e
telas propostos (seções 5 a 8); decisões novas pendentes (seção 3).
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

## 3. Decisões novas (pendentes, com recomendação)

Pontos que as D-1 a D-6 não cobrem e que mudam o resultado.

1. **N-1 — Grupos exclusivos e precedência.** Um colaborador com vínculo
   previsto e outro encerrado (readmissão em andamento) cairia, pela letra
   das D-1 e D-4, em "Desligados" e em "Em admissão" ao mesmo tempo.
   **Recomendado:** grupos exclusivos, com precedência ativo > previsto >
   encerrado — Ativos (tem vínculo ativo), Em admissão (sem ativo, com
   previsto), Desligados (sem ativo nem previsto, com encerrado). Assim
   Ativos + Em admissão + Desligados = Total no escopo, sempre.
2. **N-2 — Unidade da distribuição por tipo.** Contar **colaboradores
   ativos** pelo tipo do vínculo principal ativo (soma = Ativos), ou contar
   **vínculos ativos** por tipo (soma pode passar de Ativos quando alguém tem
   dois vínculos ativos). **Recomendado:** colaboradores, pelo vínculo
   principal (mesma regra da listagem e da ficha).
3. **N-3 — Abas versus filtros de situação atuais.** As abas Ativos, Em
   admissão, Desligados e Todos fazem o papel dos seletores
   Todos/Ativos/Inativos e do select "Situação do vínculo"; manter os dois
   produziria combinações contraditórias (aba Ativos + "encerrado").
   **Recomendado:** as abas substituem os seletores e o select; ficam busca,
   Departamento, Cargo e o novo Tipo de vínculo. O contrato antigo
   (`situacao`, `situacaoVinculo`) continua aceito pela API.
4. **N-4 — Forma da aba "Jornada de trabalho".** O contêiner Pessoas já tem a
   aba "Horário de trabalho" com essa visão. Opções: (a) a aba do dashboard
   mostra o mesmo componente da visão existente, sem lógica nova; (b) um
   atalho fora das abas que leva a Pessoas › Horário de trabalho.
   **Recomendado:** (a), com o mesmo componente e as mesmas permissões
   (operação só do RH); o rótulo do contêiner ("Horário de trabalho") fica
   como está nesta entrega.
5. **N-5 — Filtro de tipo combinado com a aba.** "Ativos + PJ" pode
   significar "tem vínculo ativo do tipo PJ" ou "está ativo e tem algum
   vínculo PJ". **Recomendado:** o mesmo vínculo — o tipo se aplica ao
   vínculo que define o grupo (ativo em Ativos, previsto em Em admissão,
   encerrado em Desligados; qualquer um em Todos).
6. **N-6 — Aba inicial.** Hoje a listagem abre em "Todos". **Recomendado:**
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

## 5. Contrato proposto (extensão mínima de `GET /v1/colaboradores`)

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
