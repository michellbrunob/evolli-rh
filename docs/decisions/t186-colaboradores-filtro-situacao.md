# Decisão — Filtros de situação nos contadores de Colaboradores (T186)

Status: **escopo definido pela proprietária em 2026-10-26; as três dúvidas
de desenho decididas por ela no mesmo dia, antes da implementação.**
Tarefa que a aplica: T186.
Relacionado: [T184](t184-colaboradores-cargo-departamento.md) e
[T185](t185-colaboradores-jornada.md) (colunas da mesma listagem).

## 1. O pedido

Em Pessoas › Colaboradores, transformar os contadores Ativos e Inativos em
filtros reais e acessíveis — "Todos", "Ativos" e "Inativos" —, com a mesma
regra de situação por empresa da T178. Os contadores continuam mostrando os
totais da empresa ativa, independentemente do filtro e da busca; busca e
filtro funcionam juntos; estados vazios distintos para empresa sem
colaboradores, busca sem resultado, filtro sem resultado e busca com filtro
sem resultado.

## 2. O que já existe (leitura de `main`, `2f5b1cc`)

- `GET /v1/colaboradores` já aceita `situacao=ativo|inativo` e aplica o
  filtro na consulta ao banco, **antes da paginação** (no `where`, junto de
  `skip`/`take`), com a regra da T178:
  - com empresa ativa (RH, DP e master com empresa): **ativo** é ter vínculo
    ativo **na empresa ativa**; **inativo** é não ter;
  - sem empresa ativa (só o master): a situação materializada do
    colaborador, rotulada "No seu escopo".
- A mesma resposta traz `contadores` (ativos e inativos) do escopo inteiro,
  **sem** filtro nem busca, e `total` do conjunto filtrado.
- A tela já tinha um select "Situação" com esse filtro, e os contadores eram
  só texto no cabeçalho.

## 3. Decisões

1. **O select "Situação" sai** (decisão da proprietária): os filtros nos
   contadores passam a ser o único controle de situação. O select "Situação
   do vínculo" continua.
2. **O filtro não vai para a URL** (decisão da proprietária): a rota
   `#/pessoas/colaboradores` segue a mesma, sem parâmetros; recarregar ou
   abrir o link volta a "Todos".
3. **Master sem empresa ativa segue a regra da T178** (decisão da
   proprietária): situação materializada, como hoje nos contadores e no
   filtro. Nenhuma regra nova.
4. **Sem mudança de servidor:** a API já filtra no banco antes da paginação.
   Sem schema, migration, RBAC, seed ou dependência nova. Os testes E2E com
   PostgreSQL real passam a provar a combinação com busca, a paginação do
   conjunto filtrado, os contadores sem filtro e as negações.
5. **Permissões inalteradas:** RH, DP e `master_tecnico` mantêm a leitura;
   gestor, colaborador e financeiro continuam negados pelo servidor.

## 4. Fora de escopo

Banco de horas, ponto, jornadas, escala, folha, compensação, fuso horário;
admissão, desligamento, edição de situação ou mudança de vínculo; campos
pessoais novos, salário, contrato detalhado, documentos, CPF, dados
bancários, dependentes, saúde; importação, exportação e integrações externas.
