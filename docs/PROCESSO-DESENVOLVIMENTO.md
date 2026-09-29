# Processo de desenvolvimento do Evolli RH

**Versão:** 1.0

**Data:** 2026-09-29

**Método:** Spec Kit 0.16.3 + branches/PRs pequenas + revisão por evidência

## 1. Fontes e hierarquia

1. Código, migrations, testes e contratos versionados.
2. Constituição do Spec Kit e decisões/ADRs aprovados, considerando sempre a decisão aprovada mais
   recente quando ela revisa uma posição histórica.
3. Spec, Plan, Tasks, ledger e manifesto de sincronização do Spec Kit.
4. PRs, commits e CI como evidência de entrega.
5. Notion como diário operacional e executivo.
6. Chat e anexos como contexto de trabalho, nunca como única fonte durável de uma decisão.

Se uma decisão existir apenas no chat, ela deve ser registrada no repositório antes de autorizar código
dependente. Se duas fontes divergirem, a implementação para e a divergência é resolvida por
`/speckit.converge`.

## 2. Artefatos obrigatórios

- `.specify/memory/constitution.md`: regras duráveis de governança e engenharia.
- `.specify/spec.md`: resultados, limites, critérios e decisões que bloqueiam capacidades.
- `.specify/plan.md`: arquitetura, sequência, gates e estratégia de validação.
- `.specify/tasks.md`: tarefas autorizáveis e suas pré-condições.
- `.specify/execution-status.md`: estado real e evidência de execução.
- `.specify/sync-state.json`: manifesto mínimo validado pela CI.
- `docs/adr/`: decisões arquiteturais históricas.
- `docs/decisions/`: decisões humanas aprovadas ou explicitamente pendentes.
- `docs/modules/`: contratos por domínio.

Esses artefatos são versionados. Apenas ponteiros e configurações estritamente locais listados em
`.specify/.gitignore` ficam fora do Git.

## 3. Fluxo obrigatório por fatia

1. `/speckit.constitution` quando houver mudança de governança, segurança ou processo.
2. `/speckit.specify` para definir resultado, escopo, exclusões, dados, permissões e aceite.
3. `/speckit.plan` para arquitetura, contratos, persistência, testes, riscos e sequência.
4. `/speckit.tasks` para decompor em tarefas pequenas, rastreáveis e dependentes.
5. `/speckit.implement` somente em branch própria e depois dos gates humanos aplicáveis.
6. Validação local proporcional ao risco: testes, typecheck, lint, build, Prettier e diff check.
7. PR em Draft e CI completa.
8. `/speckit.converge` e revisão somente leitura antes de Ready for review.
9. Autorização explícita para Ready; autorização separada para merge.
10. Registro diário no Notion com entregas, evidências, decisões, bloqueios e próximo passo.

## 4. Regra de sincronização

Toda tarefa altera, no mínimo:

- sua entrada ou estado em `.specify/tasks.md`;
- `.specify/execution-status.md`;
- `.specify/sync-state.json`.

Se a tarefa mudar política, domínio, arquitetura ou sequência, também atualiza Constituição, Spec ou
Plan conforme o caso. `pnpm spec:check` verifica a presença e a coerência mínima dos artefatos; a CI
executa esse gate antes dos demais quality gates.

## 5. Stop-and-escalate

A tarefa para sem código quando faltar contrato real, endpoint, schema, permissão, regra de negócio,
decisão de RH/Jurídico/Produto/Segurança ou infraestrutura necessária. O agente documenta o bloqueio e
prepara perguntas ou pacote de decisão; não inventa uma regra para manter a sequência.

## 6. Conteúdo dos comandos enviados ao executor

O texto copiável contém apenas o contrato da tarefa: missão, contexto, escopo, exclusões, arquivos,
aceite, validações e regra de parada. Modelo e esforço são informados separadamente na descrição, nunca
dentro do comando copiável.

## 7. Estado no marco desta versão

- Integrado em `main` até T136.
- T135 concluída como investigação bloqueada, sem código.
- T136 integrada pela PR #129; `PD-SOL-01..05` aprovadas e ADR 0013 aceita.
- T137 não foi iniciada e foi substituída pela T139 no sequenciamento atual.
- T138 é esta convergência e proteção do Spec Kit, atualizada sobre a T136.
- T139 é a próxima fundação funcional, condicionada à integração da T138 e à
  geração de especificação, plano e tarefas próprios antes do código.

O estado detalhado fica em [`.specify/execution-status.md`](../.specify/execution-status.md).
