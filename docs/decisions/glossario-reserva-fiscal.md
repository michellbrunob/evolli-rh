# Glossário vinculante — "Reserva Fiscal"

- Status: **vigente** (decisão de nomenclatura; fonte versionada)
- Data: 2026-08-20 (glossário original em `.specify/tasks.md`); versionado em
  `docs/` pela T032 (2026-08-24)
- Relacionado: [ROADMAP](../ROADMAP.md),
  [convergência da Etapa 2](etapa2-documentos-convergencia.md),
  [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md).

Este documento fixa, na rastreabilidade **versionada** (`docs/`), a decisão de
nomenclatura que antes vivia apenas no scaffold local `.specify/tasks.md` (não
versionado). É registro de **nomenclatura/governança** — não altera código,
schema, migration ou qualquer módulo.

## Decisão

1. **"Reserva Fiscal" é o nome da EMPRESA e do PROJETO** ("Sistema RH — Reserva
   Fiscal"), inclusive no título do PRD no Notion. É o contexto de negócio do
   ecossistema Evolli RH.

2. **"Reserva Fiscal" NÃO é módulo, produto, serviço nem escopo fiscal.** Não
   existe — e não deve ser criado a partir deste nome — nenhum módulo de
   "reserva fiscal" ou "cálculo fiscal" no repositório. Os módulos reais são os
   do [ROADMAP](../ROADMAP.md): Fundação, Core Organizacional, Documentos,
   Jornada/Ponto, Folha e DP, Pagamentos, etc.

3. **As tarefas T020–T023**, que descreviam uma "fatia fiscal" por equívoco de
   interpretação do nome, estão **CANCELADAS** e não devem ser executadas.

4. **A futura Folha (e DP)** — Etapa 4 do ROADMAP (rubricas, férias, 13º,
   afastamentos, rescisão, provisões) — é um módulo legítimo, mas **só avança
   mediante regras trabalhistas/fiscais homologadas** pela área responsável
   (Produto/RH/Jurídico/Fiscal). **Folha não deve ser confundida com "Reserva
   Fiscal"**: uma é um módulo de negócio futuro; a outra é o nome da empresa.

## Onde o nome aparece legitimamente

- No **título do PRD** ("Sistema RH — Reserva Fiscal — PRD") — contexto de
  empresa/produto.
- Em referências a esse PRD nos ADRs/decisões — como fonte de requisito, nunca
  como módulo.

## Resquício corrigido

O relatório de convergência da Etapa 2
([`etapa2-documentos-convergencia.md`](etapa2-documentos-convergencia.md))
listava "Reserva Fiscal (T020+)" como módulo "não iniciado" — resquício do
equívoco já cancelado. A T032 adicionou nota de convergência naquele documento
apontando para este glossário, **sem reescrever** o texto histórico.

## O que este glossário não faz

- Não cria, altera ou autoriza qualquer módulo (inclusive Folha).
- Não declara conformidade legal.
- Não altera o Notion nem o PRD.
