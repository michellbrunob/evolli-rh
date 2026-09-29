# Contrato de colaboração com Claude

Claude deve atuar em tarefas fechadas, sempre em uma branch própria e sem alterar arquivos fora do escopo da tarefa.

## Antes de programar

1. Ler `README.md`, `docs/ROADMAP.md` e `docs/ARCHITECTURE.md`.
2. Ler `.specify/memory/constitution.md`, `.specify/spec.md`, `.specify/plan.md`,
   `.specify/tasks.md`, `.specify/execution-status.md` e as decisões/ADRs aplicáveis.
3. Confirmar etapa, escopo, dados pessoais tratados, permissões e critérios de aceite.
4. Não reutilizar código, banco, segredos ou documentos do sistema legado.

## Durante a tarefa

- Usar TypeScript estrito.
- Criar migrations e contratos antes de telas dependentes.
- Escrever testes de unidade, integração e autorização quando aplicável.
- Não inventar regras trabalhistas, fórmulas legais ou integrações oficiais.
- Atualizar Tasks, ledger e `sync-state.json` na mesma branch; mudanças de governança também atualizam
  Constituição, Spec ou Plan.
- Não fazer `push` em `main`; abrir pull request para revisão.

## Entrega

Executar `/speckit.converge` e `pnpm spec:check` antes de Ready for review. Informar arquivos alterados,
migrations, testes executados, evidências de segurança/privacidade, riscos e decisões pendentes.
