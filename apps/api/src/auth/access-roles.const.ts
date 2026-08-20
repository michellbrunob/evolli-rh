export const ACCESS_ROLES = [
  "admin_tecnico",
  // Perfil global controlado (T030). Presente no modelo de acesso, mas
  // deliberadamente NÃO atribuível pelas rotas comuns de usuário — o avaliador
  // RBAC recusa qualquer criação/alteração cujo papel-alvo seja `master_tecnico`
  // (provisionamento fica para runbook próprio, sujeito a MFA).
  "master_tecnico",
  "rh",
  "dp",
  "gestor",
  "financeiro",
  "colaborador",
  "auditor",
  "dpo",
] as const;
