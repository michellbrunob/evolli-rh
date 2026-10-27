# T190 — Dossiê: próxima fatia de Gestão de Pessoas

Status: **dossiê de preparação de decisão.** Nada aqui decide, aprova ou
autoriza implementação: a escolha é da proprietária.
Data: 2026-10-27. Tarefa: T190.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T174](t174-dossie-decisoes-fatia-0.md), [T187](t187-dossie-proxima-fatia-colaboradores.md),
[T188](t188-dossie-proxima-fatia-pessoas.md) e
[T189](t189-seletor-empresa-ativa.md)), e o código e os testes de `main` em
`bf9d87c`, só como evidência.

## 1. Onde a área está

- **Colaboradores** (T178 a T187): listagem com busca por nome ou matrícula,
  paginação no servidor, filtros de situação (Todos, Ativos, Inativos),
  colunas de lotação vigente (cargo e departamento) e jornada; ficha com dados
  pessoais, contatos, jornada e "Vida funcional" só leitura, com atalho para o
  Histórico funcional.
- **Abas operacionais** (T188): Histórico funcional, Dados contratuais e
  Horário de trabalho escolhem qualquer colaborador por busca paginada; a
  lista de movimentações do Histórico funcional pagina de 20 em 20.
- **Empresa ativa** (T189): seletor no menu lateral e no Hub; a troca recria a
  tela no mesmo módulo.
- **Pendências registradas que tocam a área:**
  - **O2 da T188:** `GET /v1/movimentacoes` ordena por
    `[vigenciaInicio desc, registradaEm desc]`, sem desempate
    (`apps/api/src/pessoas/movimentacao/movimentacao.service.ts:159`). Com
    paginação, duas movimentações com a mesma chave podem trocar de página
    entre leituras — uma some e outra se repete. A linha do tempo do vínculo
    tem a mesma falta de desempate (`vinculo/vinculo.service.ts:294`), sem
    paginação.
  - **O1 da T188:** a tabela de vínculos de horário pede uma página de 100 e
    resolve nomes pela primeira página de 100 colaboradores
    (`apps/web/src/screens/pessoas/PessoasHorarioScreen.tsx:119-120`): acima
    disso, vínculo sem nome na tela.
  - **Opção C da T188 (não escolhida):** filtros por Departamento e Cargo na
    listagem; e a **O1 da T186**: o E2E da listagem não cobre
    `situacaoVinculo`.
  - **Opção B da T188 (não escolhida):** transferência e mudança de cargo pela
    ficha.
  - **Gates abertos** (T174): `DP-FLX-11` (movimentações ampliadas e correção)
    e `DP-FLX-12` (desligamento), entre outros.

## 2. Opções

### A — Ordenação estável e nomes completos nas abas operacionais

- **Problema e valor:** fecha as duas pendências de consistência da T188. O
  Histórico funcional passa a paginar movimentações sem repetir nem pular
  registro, e o Horário de trabalho mostra o nome de todo vínculo, em empresa
  de qualquer tamanho. É correção: o que RH e DP veem passa a ser sempre a
  lista inteira e na mesma ordem.
- **Contratos e telas:** `GET /v1/movimentacoes` e a linha do tempo do vínculo
  ganham `id` como último critério de ordenação — o formato da resposta não
  muda. No Horário, a tabela de vínculos passa a resolver os nomes da página
  exibida pelos contratos existentes (`GET /v1/colaboradores/:id` ou a
  própria busca), sem o dicionário de 100. Telas: Histórico funcional, ficha
  (Vida funcional) e Horário de trabalho.
- **Dependências:** nenhuma de gate. Sem schema, migration ou RBAC; a mudança
  de API é só de ordenação.
- **Risco e escopo:** baixo, escopo pequeno. Ponto de atenção: provar no E2E
  a ordem com movimentações de chave igual, criadas pelo banco de teste.
- **Decisões necessárias:** só se a tabela de vínculos de horário também
  passa a paginar (hoje é uma página de 100) ou fica só com os nomes
  corrigidos.

### B — Filtros por Departamento e Cargo na listagem de Colaboradores

- **Problema e valor:** achar rapidamente quem está numa área ou num cargo é a
  pergunta diária de RH e DP que a listagem ainda não responde — hoje só há
  busca por nome ou matrícula e situação. O valor cresce com o tamanho da
  empresa, e as colunas de cargo e departamento (T184) já mostram o que seria
  filtrado.
- **Contratos e telas:** `GET /v1/colaboradores` ganha `departamentoId` e
  `cargoId` opcionais, aplicados no banco, antes da paginação, pela alocação
  ABERTA (`vigente_ate` nulo) de um vínculo no escopo da sessão — a mesma
  regra das colunas da T184. Os índices já existem
  (`alocacao_organizacional`: `departamento_id`, `cargo_id`): **sem schema nem
  migration**. A tela de Colaboradores ganha dois filtros combináveis com a
  busca e a situação, com os catálogos que a Nova admissão já lê
  (`GET /v1/departamentos`, `GET /v1/cargos`). Junto, o E2E de
  `situacaoVinculo` (O1 da T186).
- **Dependências:** nenhuma de gate. Extensão aditiva da API de listagem, com
  as permissões atuais (RH, DP e `master_tecnico` no alcance já autorizado;
  demais negados).
- **Risco e escopo:** baixo a médio, escopo médio. Pontos de atenção:
  colaborador previsto ou encerrado não tem lotação aberta e sai do resultado
  filtrado; catálogos seguem numa página de 100 (limite já registrado);
  filtros somem na troca de empresa (T189), como a busca.
- **Decisões necessárias:**
  1. os contadores Todos/Ativos/Inativos continuam sobre o escopo inteiro
     (regra da T178) ou passam a refletir os filtros;
  2. catálogo com itens ativos e inativos ou só ativos;
  3. filtros em seletor simples (recomendado, com os catálogos atuais) ou com
     busca.

### C — Transferência e mudança de cargo pela ficha

- **Problema e valor:** registrar transferência organizacional e mudança de
  cargo na própria ficha, onde a pessoa já está, com reflexo nas colunas da
  listagem (T184) e na Vida funcional (T187).
- **Contratos e telas:** `POST /v1/movimentacoes`
  (`transferencia_organizacional`, `mudanca_cargo`) e `.../efetivar`, já usados
  pelo Histórico funcional, com as permissões atuais (RH e DP na própria
  empresa). A seção Vida funcional deixa de ser só leitura.
- **Dependências:** `DP-FLX-11` está aberto. Ele não bloqueia os dois tipos
  existentes, mas justificativa em texto livre, valores antes e depois e
  correção ampliada caem nele. Desligamento fica fora enquanto `DP-FLX-12`
  estiver aberto.
- **Risco e escopo:** médio, escopo médio. Duas portas para a mesma operação
  (ficha e Histórico funcional), vigência futura e efetivação, alçada RH × DP
  sem aprovação distinta. Escrita nova na ficha, com auditoria já existente.
- **Decisões necessárias:** produto e RH/DP — quem opera pela ficha, se a
  efetivação imediata é oferecida ali, como a ficha mostra o que ficou
  programado.

## 3. Comparação

| Opção | Valor no dia a dia                       | Risco       | Contratos                      | Gate que bloqueia           | Decisões           |
| ----- | ---------------------------------------- | ----------- | ------------------------------ | --------------------------- | ------------------ |
| A     | Médio: correção de consistência          | Baixo       | Existentes (só ordenação muda) | Nenhum                      | Produto (1 ponto)  |
| B     | Alto: localizar por área e cargo         | Baixo-médio | Listagem estendida (aditiva)   | Nenhum                      | Produto (3 pontos) |
| C     | Alto: operar a lotação sem sair da ficha | Médio       | Existentes (escrita)           | Parcial (`-11`; `-12` fora) | Produto e RH/DP    |

## 4. Recomendação

**Opção B — filtros por Departamento e Cargo na listagem de Colaboradores.**
É a que mais aumenta o uso diário do módulo Colaboradores com regras já
aprovadas: reaproveita a regra de lotação vigente da T184, as permissões da
listagem e os catálogos existentes; não depende de gate aberto, não toca
schema, migration nem RBAC, e não envolve dado pessoal novo. Fecha também a
O1 da T186. A opção A é pequena e pode vir logo depois — ou entrar junto, se a
proprietária preferir corrigir a ordenação (O2) na mesma entrega. A opção C
depende de decisões de RH e DP ainda não tomadas.

Para seguir com B, a proprietária precisa decidir:

1. **Contadores:** sobre o escopo inteiro, como hoje (recomendado), ou
   refletindo os filtros.
2. **Catálogos:** só departamentos e cargos ativos (recomendado) ou também
   os inativos.
3. **Forma dos filtros:** seletor simples com os catálogos atuais
   (recomendado) ou com busca.
4. **Alcance:** só os filtros e o E2E de `situacaoVinculo` (recomendado), ou
   também a correção de ordenação das movimentações (O2 da opção A).
