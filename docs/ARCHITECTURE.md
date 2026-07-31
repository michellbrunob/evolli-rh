# Arquitetura inicial

## Tecnologias

- Frontend: React + TypeScript + TSX.
- Backend: Node.js + TypeScript, com API REST versionada e OpenAPI.
- Dados: PostgreSQL com migrations versionadas.
- Processamento assíncrono: Redis e filas na etapa de fundação.
- Documentos: armazenamento privado, quarentena e metadados no PostgreSQL.

## Regras de segurança

- Menor privilégio, negação por padrão e acesso contextual por empresa/unidade/equipe.
- Auditoria para acessos, exportações, alterações sensíveis, aprovações e integrações.
- Segredos exclusivamente por variáveis de ambiente/cofre; nunca versionados.
- Dados e documentos sensíveis não entram em logs, testes, repositório ou URLs públicas.

