# Evolli RH

Ecossistema corporativo de RH e Departamento Pessoal, modular e multiempresa.

## Princípios

- Segurança, privacidade e auditoria desde o desenho.
- LGPD por padrão, com validação formal do DPO/jurídico onde aplicável.
- Evolução por módulos: nenhum módulo avança sem testes, revisão de segurança e homologação.
- Código TypeScript, APIs documentadas, PostgreSQL e integrações auditáveis.

## Estrutura

- `apps/web`: portal administrativo e, futuramente, autoatendimento.
- `apps/api`: API corporativa e módulos de domínio.
- `packages/domain`: regras de negócio puras e testes de cálculo.
- `packages/database`: schema, migrations e acesso ao PostgreSQL.
- `packages/contracts`: contratos, DTOs e especificação OpenAPI.
- `packages/ui`: design system acessível.
- `docs`: decisões, requisitos, compliance e especificações de módulos.

## Próxima etapa

Implementar a fundação: ambiente local, API TypeScript, PostgreSQL, autenticação, autorização, auditoria e CI completo. Consulte [docs/ROADMAP.md](docs/ROADMAP.md).

