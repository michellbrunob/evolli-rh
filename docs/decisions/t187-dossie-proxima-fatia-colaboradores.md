# T187 — Dossiê: próxima fatia de Gestão de Pessoas › Colaboradores

Status: **dossiê de preparação de decisão.** Nada aqui decide, aprova ou
autoriza implementação: a escolha é da proprietária.
Data: 2026-10-27. Tarefa: T187.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T174](t174-dossie-decisoes-fatia-0.md), [T176](t176-decisao-dp-flx-04-estados-processo-admissional.md),
[T184](t184-colaboradores-cargo-departamento.md), [T185](t185-colaboradores-jornada.md) e
[T186](t186-colaboradores-filtro-situacao.md)), a ADR 0017, e o código e os testes de
`main` em `d7ab172`, só como evidência.

## 1. Onde a área está

- **Listagem de Colaboradores** (T178 a T186): busca, contadores que filtram por
  situação na empresa, colunas Matrícula, Cargo, Departamento, Jornada de trabalho,
  Situação e Admissão, sempre do vínculo principal.
- **Ficha** (T177 a T183): nome, dados pessoais, endereço, contatos e jornada, com
  edição por RH e DP (jornada só RH). A própria ficha avisa que transferência,
  mudança de cargo, desligamento, reclassificação de vínculo e outros "ainda não têm
  operação nesta tela" (`ColaboradoresScreen.tsx:925`).
- **Histórico funcional** (T115), outra aba de Pessoas: já registra, efetiva,
  cancela e retifica transferência organizacional, mudança de cargo e desligamento
  sobre `GET/POST /v1/movimentacoes` e mostra a linha do tempo do vínculo
  (`GET /v1/vinculos/:id/linha-do-tempo`). RH e DP operam na própria empresa; o
  `master_tecnico` só lê (`rbac.evaluator.ts:355-371`).
- **Gates abertos que limitam a área** (T174): `DP-FLX-04` (processo admissional),
  `DP-FLX-11` (movimentações **ampliadas** e correção), `DP-FLX-12` (desligamento:
  etapas, motivos, checklist), `DP-FLX-05` (CPF), `DP-FLX-14` (documentos por
  vínculo), `DP-FLX-16` (bancário, sindical, dependentes), entre outros. Resolvidos:
  `DP-FLX-01`, `-21` e `-22`.
- **Observação histórica O1 (T186):** o E2E da listagem não cobre `situacaoVinculo`.

## 2. Opções

### A — Vida funcional na ficha (leitura)

- **Objetivo:** a ficha passa a mostrar, para o vínculo principal, a linha do tempo
  de movimentações (admissão, transferências, mudanças de cargo, desligamento, com
  status e vigência) e a lotação vigente; um atalho leva ao Histórico funcional já
  no mesmo vínculo para operar.
- **Valor para RH/DP:** quem abre a ficha entende a trajetória da pessoa sem trocar
  de aba e procurar de novo colaborador e vínculo; é a pergunta mais comum depois de
  "quem é" — "o que aconteceu com ela".
- **Contratos aprovados que bastam:** `GET /v1/vinculos/:id/linha-do-tempo` e
  `GET /v1/vinculos/:id/alocacoes` (já existentes, com auditoria e escopo por
  empresa). **Sem mudança de API, schema, migration ou RBAC.**
- **Dependências:** nenhuma de gate; reutiliza a T115.
- **Riscos:** baixos. Duplicar a tabela do Histórico funcional (mitigar
  reaproveitando a apresentação); carga extra só ao abrir a ficha.
- **Dados pessoais:** nenhum novo. Movimentação traz tipo, motivo codificado,
  datas e destinos organizacionais; nada de salário ou texto livre (BV1, decisão 11).
- **Exige decisão:** só de produto (ver seção 4).

### B — Transferência e mudança de cargo pela ficha (operação)

- **Objetivo:** registrar e efetivar transferência organizacional e mudança de cargo
  a partir da ficha, com reflexo imediato em Cargo e Departamento da listagem (T184).
- **Valor para RH/DP:** a alteração de lotação, rotina frequente, sai do lugar onde
  a pessoa já está.
- **Contratos aprovados:** `POST /v1/movimentacoes` e `.../efetivar` já aceitam os
  dois tipos para RH e DP. Sem schema ou migration.
- **Dependências:** `DP-FLX-11` não bloqueia os tipos existentes, mas qualquer
  justificativa em texto livre, valores antes/depois ou correção ampliada cai nele;
  **desligamento fica fora** enquanto `DP-FLX-12` estiver aberto.
- **Riscos:** médios. Duas portas para a mesma operação (ficha e Histórico
  funcional) com regras de vigência futura e efetivação; alçada RH × DP já aberta no
  servidor, sem aprovação distinta (BV1, itens 7 e 12).
- **Dados pessoais:** nenhum novo.
- **Exige decisão:** de produto e de RH/DP (quem opera pela ficha; se a efetivação
  imediata é oferecida ali).

### C — Filtros por Departamento e Cargo na listagem

- **Objetivo:** filtrar a listagem pela lotação vigente (Departamento e/ou Cargo),
  combinável com busca e situação; inclui o E2E de `situacaoVinculo` (O1).
- **Valor para RH/DP:** achar rapidamente quem está numa área ou cargo; ganha valor
  com o tamanho da empresa.
- **Contratos:** **exige estender** `GET /v1/colaboradores` com novos parâmetros
  (filtro no banco, antes da paginação, pela alocação aberta, T184). Sem schema,
  migration ou RBAC; DP já lê a estrutura organizacional (matriz §8).
- **Dependências:** nenhuma de gate.
- **Riscos:** baixos a médios: mudança de contrato da API, semântica de previsto e
  encerrado (sem lotação vigente) e de referência inativa no catálogo.
- **Dados pessoais:** nenhum novo.
- **Exige decisão:** de produto (semântica do filtro e quais referências listar).

## 3. Comparação

| Opção | Valor RH/DP | Risco       | Contratos prontos  | Gate que bloqueia           | Decisão necessária |
| ----- | ----------- | ----------- | ------------------ | --------------------------- | ------------------ |
| A     | Alto        | Baixo       | Sim, integralmente | Nenhum                      | Produto (2 pontos) |
| B     | Alto        | Médio       | Sim (servidor)     | Parcial (`-11`, `-12` fora) | Produto e RH/DP    |
| C     | Médio-alto  | Baixo-médio | Não (API nova)     | Nenhum                      | Produto            |

## 4. Recomendação

**Opção A — Vida funcional na ficha, somente leitura, com atalho ao Histórico
funcional.** Entrega o maior valor por risco: usa só contratos aprovados e já
auditados, não toca API, schema, migration nem RBAC, não depende de gate aberto e
prepara a opção B, que pode vir depois sobre a mesma seção. O1 continua como
observação, sem correção nesta fatia.

Para seguir com A, a proprietária precisa decidir:

1. **Escopo da seção:** só leitura na ficha, com atalho para operar no Histórico
   funcional já no vínculo (recomendado), ou também registrar e efetivar ali
   (vira a opção B).
2. **O que a linha do tempo mostra:** todos os status, inclusive cancelada e
   retificada, como no Histórico funcional (recomendado, histórico append-only), ou
   só efetivadas e programadas.
