# T161 — Hub pós-login: decisão registrada, implementação não autorizada

Status: **decisão do proprietário, registrada. Não autoriza implementação.**
Data: 2026-10-14.
Registrada na: **T160** (login institucional), antes de qualquer código do Hub.

Este documento existe para que a T160 saiba onde desemboca, sem antecipar nada.
A T160 renova **apenas** a tela de login; o Hub é fatia própria, futura.

## 1. O que o Hub é

A tela que recebe quem acabou de entrar, antes do painel, e que responde a uma
única pergunta: **onde esta pessoa pode trabalhar agora.**

## 2. Empresa ativa — só com o servidor

A empresa ativa e a troca de empresa **só podem existir com validação e
autorização do servidor**. O cliente nunca escolhe escopo por conta própria:

- a lista de empresas que a pessoa pode acessar vem do servidor;
- a troca de empresa é uma operação **do servidor**, que reemite o escopo da
  sessão; não é estado de frontend;
- um identificador de empresa vindo do cliente nunca é aceito como prova de
  escopo — o RBAC continua decidindo cada requisição, com a empresa como a
  única dimensão ABAC, como está desde a Baseline.

Enquanto não houver contrato de servidor para listar e trocar empresa, **não
há seletor de empresa**. Um seletor que o servidor não honra é promessa vazia,
e é exatamente o que a T159 passou a tarefa inteira eliminando.

## 3. Subsistemas por permissão real

Os subsistemas exibidos dependem das **permissões reais** do ator, conferidas
contra o `rbac.evaluator`, não contra uma lista escrita à mão no frontend.
Oferecer um subsistema que responderia 403 é o defeito que a T159 corrigiu na
aterrissagem por papel; o Hub não pode reintroduzi-lo.

## 4. Funcional separado de planejado e demonstrativo

A mesma regra da T159, aplicada um nível acima: **produto funcional não divide
faixa com produto planejado ou demonstrativo como se fossem equivalentes.** O
que é maquete se identifica como maquete, em texto, e o que não existe não
aparece como se existisse.

## 5. O que esta decisão NÃO faz

- **Não implementa o Hub**, nem agora nem na T160.
- **Não reserva funcionalidade sem contrato.** Nada aqui aprova novo endpoint,
  nova permissão, novo estado de sessão ou nova entidade.
- **Não cria multiempresa.** O que existe de escopo por empresa hoje continua
  sendo o que o servidor já faz; esta decisão não amplia.
- **Não altera** regra de negócio, RBAC, API, Prisma, migrations, seed, Docker,
  banco, dependências ou lockfile.

## 6. Pré-condição para abrir a T161

Levantar, a partir do **código**, quais contratos de servidor existem hoje para
empresa ativa e para escopo por empresa — e quais faltam. Onde faltar contrato,
a T161 para e reporta, em vez de inventar. É a mesma disciplina que a T158 e a
T159 seguiram.
