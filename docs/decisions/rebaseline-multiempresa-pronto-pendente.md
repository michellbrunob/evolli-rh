STATUS: DECISÃO APROVADA (2026-08-11)

# Rebaseline multiempresa preparada — decisão aprovada e pendências

- Data do levantamento: 2026-08-11
- Data da aprovação: 2026-08-11
- Especificação correspondente: [docs/modules/fatia-transversal-multiempresa-pronto.md](../modules/fatia-transversal-multiempresa-pronto.md)
- Formalização arquitetural: [ADR 0010 — Preparação Multiempresa Interna](../adr/0010-preparacao-multiempresa-interna.md)
- Precedente de formato: [etapa1-modelagem-organizacional-pendente.md](etapa1-modelagem-organizacional-pendente.md)
  e [etapa1-escopo-autorizacao-interna-pendente.md](etapa1-escopo-autorizacao-interna-pendente.md)

## 0. O que este documento é, e o que não é

Este documento tem duas partes, e a distinção entre elas é o ponto central:

1. **O que foi aprovado** (§1): a interpretação operacional do gatilho da
   Emenda 1 da ADR 0005, e o conjunto de restrições que a acompanha.
2. **O que segue pendente** (§2): as decisões que **não** foram tomadas,
   agora classificadas pelo que cada uma efetivamente bloqueia.

A formalização arquitetural da parte aprovada está na
[ADR 0010](../adr/0010-preparacao-multiempresa-interna.md).

**Este documento não:**

- altera código, schema Prisma, migration, API, teste, CI, dependência,
  infraestrutura ou qualquer arquivo existente;
- cria banco, bucket, conta, credencial, segredo ou serviço externo;
- **aciona** o gatilho de reavaliação da ADR 0005 — ao contrário: registra
  a decisão de que a preparação arquitetural **não** o aciona (§1.1);
- altera a ADR 0005, sua Emenda 1 ou o prazo de 04/11/2026;
- cria usuário, conta administrativa ou permissão;
- declara conformidade LGPD, segurança validada ou adequação trabalhista;
- inventa requisito de PRD.

## 1. Decisão aprovada

### 1.1 Interpretação do gatilho da Emenda 1 da ADR 0005

**Aprovado (2026-08-11).** A Emenda 1 da
[ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md) previu a
reavaliação da exceção de escopo global do `admin_tecnico` no que ocorrer
primeiro entre
**(a)** o prazo de **04/11/2026** e **(b)** o "início de qualquer processo
de comercialização para terceiros, mesmo que preliminar".

O levantamento original registrou a dúvida — a preparação arquitetural
conta como (b)? — sem resolvê-la. **O produto decidiu: não conta.**

A reavaliação é antecipada **se e somente se** ocorrer, de forma
verificável, qualquer um destes cinco fatos:

| #   | Fato                               |
| --- | ---------------------------------- |
| G1  | Proposta comercial ativa           |
| G2  | Contrato com cliente externo       |
| G3  | Piloto com terceiro                |
| G4  | Provisionamento de cliente externo |
| G5  | Acesso de terceiro ao ecossistema  |

**Sem qualquer um desses fatos, a reavaliação continua obrigatória até
04/11/2026.** O prazo **não é estendido, adiado ou enfraquecido** — a
decisão apenas substitui uma expressão elástica ("mesmo que preliminar")
por cinco fatos observáveis.

### 1.2 Três coisas que esta decisão mantém separadas

Confundi-las seria o erro mais provável de leitura deste documento:

| Conceito                                  | O que é                                                                                                                               | Situação hoje                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preparação arquitetural interna**       | Desenhar a evolução, comparar modelos de isolamento e fixar regras de código que preservem opções futuras. Não envolve terceiro algum | **Aprovada e em vigor** — é o que esta decisão autoriza                                                                                        |
| **Início de processo de comercialização** | Qualquer um dos fatos G1–G5: proposta ativa, contrato, piloto, provisionamento ou acesso de terceiro                                  | **Não ocorreu.** Se ocorrer, antecipa a reavaliação do `admin_tecnico`                                                                         |
| **Ativação de multitenancy**              | Criar camada de cliente contratante e escolher o modelo de isolamento                                                                 | **Não aprovada.** Exige ADR nova (ADR 0005, decisão 5), migration aditiva, teste de isolamento com prova negativa e revisão específica de LGPD |

A ordem importa: preparação **não implica** comercialização, e
comercialização **não implica automaticamente** multitenancy — são três
portas distintas, cada uma com seu gate.

### 1.3 Restrições aprovadas junto com a decisão

- **Nenhum cliente externo** será criado ou atendido agora.
- **Nenhum usuário `auditor` ou `dpo`** será provisionado agora (ver §2,
  DP-M-02 — a decisão de escopo deles permanece bloqueante).
- **O modelo de banco futuro permanece pendente** (§2, DP-M-06) — a
  recomendação técnica condicionada da especificação **não** é preferência
  convertida em decisão.
- **O sistema interno permanece com o PostgreSQL atual** e `company_id`
  como fronteira organizacional e de autorização.
- **A preparação não pode introduzir** `tenant_id`, RLS, base central,
  troca de conexão, CNPJ, Cloudflare R2, bucket, credencial, endpoint ou
  integração.
- **Cloudflare R2 segue apenas como direção futura** para documentos
  privados, condicionada aos gates de segurança, LGPD, DPO, classificação,
  retenção, descarte, auditoria e quarentena/antimalware.
- **MFA continua obrigatório** antes de piloto com dados reais ou produção
  (ADR 0003, decisão 3 — inalterada).

### 1.4 O que passa a valer imediatamente

As regras **R1 a R7** da especificação transversal (§4) tornam-se critério
de revisão de código. Nenhuma exige schema, coluna, tabela ou endpoint —
são disciplina, e é o único efeito prático desta aprovação sobre o dia a
dia do desenvolvimento.

## 2. Decisões pendentes, classificadas pelo que bloqueiam

Nenhum item desta seção está aprovado. A classificação responde à pergunta
que mais importa na prática: **o que cada pendência impede de acontecer?**

| Classificação                               | Significado                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| **BC — Bloqueia comercialização**           | Precisa ser decidida antes de qualquer um dos fatos G1–G5                 |
| **NBP — Não bloqueia o Painel Web interno** | Pode seguir pendente sem impedir a implementação do painel de uso interno |
| **BDR — Bloqueia dados reais / documentos** | Precisa ser decidida antes de dado real, piloto, produção ou upload       |

Uma pendência pode ter mais de uma marca.

| ID      | Pendência                                         | Classificação              |
| ------- | ------------------------------------------------- | -------------------------- |
| DP-M-02 | Escopo de `auditor` e `dpo`                       | BC · NBP                   |
| DP-M-03 | Definição oficial de "Cliente contratante"        | BC · NBP                   |
| DP-M-04 | Cliente pode administrar vários CNPJs             | BC · NBP                   |
| DP-M-05 | Gatilho objetivo para sair do banco único         | BC · NBP                   |
| DP-M-06 | Banco único segregado vs. banco por cliente       | BC · NBP                   |
| DP-M-07 | Contas Master nominativas e recuperação           | BC · BDR · NBP             |
| DP-M-08 | Escopo do prestador de serviço                    | BC · NBP                   |
| DP-M-09 | Critérios para seleção e troca de contexto        | BC · NBP                   |
| DP-M-10 | Produto Cloudflare e avaliação de segurança       | BDR · NBP                  |
| DP-M-11 | Retenção e descarte de documentos                 | BDR · NBP                  |
| DP-M-12 | Aprovação DPO/jurídico e MFA antes de dados reais | BDR · NBP                  |
| DP-M-13 | Numeração de ADR                                  | **Resolvida** — ver abaixo |

**Leitura desta tabela:** nenhuma pendência bloqueia o Painel
Administrativo Web V1 **interno**. Todas as que bloqueiam comercialização
estão concentradas na camada de cliente, que não existe. As que bloqueiam
dado real já eram gates conhecidos, reafirmados aqui.

**DP-M-01 foi resolvida** por esta decisão (§1.1). **DP-M-13 foi
resolvida** pela numeração adotada: `main` contém ADRs de 0001 a 0008, a
numeração **0009 fica reservada** para a ADR do Painel Web (hoje em branch
não integrada) e esta fatia assume **0010**.

**DP-M-07 merece destaque** por ser a única marcada nas três colunas: a
exigência da Emenda 1 da ADR 0005 — ao menos duas contas administrativas
nominativas, separadas de uso rotineiro — **já vale hoje**, independente
de comercialização. Conta compartilhada elimina a prestação de contas que
a trilha de auditoria existe para dar.

### DP-M-02 — Escopo de `auditor` e `dpo` (DP-7, herdada)

**Quem decide:** Produto + TI/Segurança + DPO. **Classificação:** BC · NBP

A Emenda 1 da ADR 0005 (item 3) registrou que `auditor` e `dpo` **não são
cobertos** pela exceção do `admin_tecnico`, e que seu escopo precisa ser
deliberado **antes do primeiro provisionamento**. Hoje o código concede a
esses papéis leitura da trilha de auditoria sem checagem de empresa —
capacidade técnica que nunca foi validada por uso real, porque não há
usuário com esses papéis.

**A decisão aprovada (§1.3) proíbe provisioná-los agora**, o que mantém
essa capacidade **latente, não exercida**. É isso que torna a pendência
aceitável no curto prazo — e é isso que deixaria de valer no instante em
que alguém fosse provisionado sem o escopo decidido antes.

Com uma camada de cliente contratante, "ler a trilha inteira" deixaria de
significar "ler a trilha do escritório" e passaria a significar "ler a
trilha de todos os clientes". **O salto de alcance não é gradual** — por
isso esta pendência é bloqueante antes de cliente externo.

## 3. Detalhamento das demais pendências

### DP-M-03 — Definição oficial de "Cliente contratante"

**Quem decide:** Produto.

O que é, exatamente, um cliente contratante: a pessoa jurídica que
contrata o serviço? O escritório que opera em nome de terceiros? Ambos,
com papéis distintos? A definição determina toda a modelagem futura e não
pode ser derivada por analogia com `Empresa` — que hoje é a raiz
organizacional e **não** tem semântica comercial.

### DP-M-04 — Um cliente pode administrar vários CNPJs?

**Quem decide:** Produto.

Cardinalidade entre cliente contratante e empresa/CNPJ: 1:1, 1:N, ou N:N
(um CNPJ atendido por mais de um contratante ao longo do tempo). A
resposta muda o modelo de dados futuro e o desenho da seleção de contexto.

**Dependência registrada:** CNPJ em `Empresa` é **DP-4 da ADR 0006, ainda
pendente**, e o enunciado desta fatia proíbe criá-lo agora. Portanto esta
decisão pode ser tomada conceitualmente, mas **não materializada**.

### DP-M-05 — Gatilho objetivo para sair do banco interno único

**Quem decide:** Produto + Arquitetura + TI.

A ADR 0005 já tem quatro gatilhos de reavaliação, todos qualitativos.
Falta o critério **objetivo e verificável** que dispara a saída do banco
único: número de clientes? Primeiro cliente externo ao escritório?
Exigência contratual de isolamento? Volume? Perfil de risco?

Sem critério objetivo, a decisão tende a ser tomada tarde — quando o custo
de migrar já é máximo.

### DP-M-06 — Banco único segregado vs. banco por cliente

**Quem decide:** Produto + Arquitetura + TI/Segurança.

Comparação completa e honesta na
[especificação, §3](../modules/fatia-transversal-multiempresa-pronto.md).
Resumo dos eixos: isolamento (lógico vs. físico), backup/restauração
(simples vs. independente por cliente), custo operacional (uma instância
vs. N), migrations (uma vez vs. N vezes com falha parcial), risco de acesso
cruzado (permanente vs. deslocado para o roteamento de conexão) e
complexidade inicial (baixa vs. alta).

**Recomendação técnica condicionada — não decisão:** banco único segregado
se poucos clientes e sem exigência contratual de isolamento; banco por
cliente se houver exigência regulatória/contratual, necessidade de
restauração independente, ou perfis de risco muito distintos.

**Nota que importa mais que a escolha:** as duas alternativas permanecem
abertas enquanto as regras R1–R7 da especificação (§4) forem respeitadas.
A decisão pode ser adiada; a disciplina, não.

### DP-M-07 — Contas Master nominativas e recuperação

**Quem decide:** Produto + TI/Segurança.

Pendente: quantas contas administrativas de alto privilégio existem, como
são nominadas, e qual o procedimento de recuperação quando o titular
perde acesso.

**Restrição já registrada, não negociável por conveniência:** a Emenda 1
da ADR 0005 exige **ao menos duas contas administrativas nominativas** e
**contas `admin_tecnico` separadas de contas de uso rotineiro**. Conta
compartilhada elimina a prestação de contas que a trilha de auditoria
existe para dar — um evento com ator "admin" não responde "quem".

### DP-M-08 — Escopo do prestador de serviço

**Quem decide:** Produto + TI/Segurança.

O que um prestador de serviço pode fazer nos clientes que administra: tudo
o que RH/DP fazem? Um subconjunto? Precisa de consentimento registrado do
cliente? Pode ver dado pessoal de colaborador do cliente, ou só estrutura?

**Observação:** isto **não** é a mesma pergunta que DP-8 da ADR 0006
(escopo do papel `gestor`), que segue pendente e independente.

### DP-M-09 — Critérios para seleção e troca de contexto

**Quem decide:** Produto + TI/Segurança.

Como o operador seleciona e troca de cliente/empresa: exige reautenticação
ao trocar? A seleção fica memorizada na sessão? Cada troca gera evento de
auditoria? Existe limite de contextos simultâneos?

**Restrição técnica já fixada pela especificação (§2.4):** o valor vindo
do navegador é pretensão, nunca concessão — interseccionado no servidor.
Contexto fora do escopo responde 404 (não 403) e gera evento de negação.
**Isso não está em decisão** — é a extensão do padrão já implementado e
testado para `empresaId`.

### DP-M-10 — Produto Cloudflare exato e avaliação de segurança

**Quem decide:** Produto + TI/Segurança + DPO.

R2 é a direção mencionada, mas o produto exato, a região de
armazenamento, o modelo de credencial, o custo e a avaliação de segurança
não estão decididos. Nenhum bucket, chave, endpoint ou SDK existe ou é
autorizado.

**Dependência:** a especificação estrutural de Documentos **não está em
`main`** (branch `feature/etapa2-documentos-admissao-estrutural-spec`) —
é ela que detalha os controles, e precisa ser integrada antes.

### DP-M-11 — Retenção e descarte de documentos

**Quem decide:** Jurídico + DPO.

Prazo, critério de descarte, e o que acontece com metadado quando o
conteúdo é descartado. Já registrado como risco na especificação de
Documentos (não integrada): descartar o objeto e manter o metadado órfão
perde rastreabilidade sem eliminar o dado.

### DP-M-12 — Aprovação DPO/jurídico e MFA antes de dados reais

**Quem decide:** DPO + Jurídico + TI/Segurança.

**Não é decisão nova — é reafirmação de gate já vigente.** MFA continua
obrigatório antes de qualquer piloto com dado real ou produção (ADR 0003,
decisão 3; reafirmado na ADR 0005, decisão 8, e na ADR 0008, decisão 8).

O que **é** novo: a ADR 0005 registra que "dado de cliente terceiro tem
base legal, finalidade e retenção próprias, e nada dessa análise está
feito". A operação para terceiros exige **revisão de LGPD específica**,
distinta da que cobriria o uso interno.

### DP-M-13 — Colisão de numeração de ADR

**Quem decide:** Arquitetura.

A numeração `0009` está usada em branch não integrada
(`feature/web-painel-administrativo-v1-spec`). `main` tem ADRs de 0001 a 0008. Se outra ADR for aceita antes daquele merge, haverá colisão.

Pendente: reservar a numeração, renumerar no merge, ou adotar outro
critério.

## 4. Contexto não integrado — não tratar como vigente

Verificado contra `origin/main` em 2026-08-11. Os documentos abaixo
existem em branches enviadas, **sem PR e sem merge**:

| Documento                                                       | Branch                                               |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `docs/adr/0009-painel-administrativo-web-v1.md`                 | `feature/web-painel-administrativo-v1-spec`          |
| `docs/modules/painel-administrativo-web-v1.md`                  | `feature/web-painel-administrativo-v1-spec`          |
| `docs/decisions/painel-administrativo-web-v1-baseline.md`       | `feature/web-painel-administrativo-v1-spec`          |
| `docs/modules/etapa2-documentos-admissao-digital-estrutural.md` | `feature/etapa2-documentos-admissao-estrutural-spec` |

Consequência prática: a sequência recomendada (especificação, §6.2) coloca
"implementar o endpoint CSRF e o Painel Web V1" como passo 3 — mas esse
passo **depende do merge** dos documentos acima. Implementar contra
decisão não integrada seria construir sobre base que ainda pode mudar.

## 5. Conflitos e tensões com documentos existentes

Registrados, não resolvidos:

| Item                                | Tensão                                                                                                                                | Encaminhamento                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ADR 0005, Emenda 1 (gatilho)        | Planejar operação para terceiros pode ser "comercialização preliminar", antecipando a reavaliação do acesso global do `admin_tecnico` | **DP-M-01** — decisão de produto/segurança                        |
| ADR 0005, decisão 5 e gatilho geral | Exige **ADR nova**, não emenda, quando a multitenancy for acionada                                                                    | Respeitado: **nenhuma ADR é criada nesta fase**                   |
| ADR 0005, Emenda 1, item 3 (DP-7)   | Escopo de `auditor`/`dpo` não decidido; código concede leitura ampla                                                                  | **DP-M-02**                                                       |
| ADR 0006, DP-4                      | CNPJ pendente, mas "múltiplas empresas/CNPJs" é a direção declarada                                                                   | **DP-M-04**, sem materializar — enunciado proíbe criar CNPJ agora |
| ADR 0006, decisão 8 (DP-8)          | Escopo de `gestor` indefinido; papel negado nos três domínios                                                                         | Independente de DP-M-08; segue pendente                           |
| ADR 0003, decisão 2                 | SSO desenhado como troca de implementação de interface                                                                                | Coerente: SSO segue evolução futura, V1 mantém e-mail/senha       |

**Nenhum conflito bloqueante de código foi encontrado.** As tensões acima
são de decisão e prazo, não de implementação — os módulos já entregues
(Organização, Pessoas, Ponto) sobrevivem à camada de cliente de forma
aditiva, conforme demonstrado na especificação (§6.1).

## 6. O que muda hoje, com a decisão aprovada

Deliberadamente pouco:

- **Nada em banco, código ou infraestrutura.**
- Passam a valer, como critério de revisão de código, as regras R1–R7 da
  especificação (§4) — disciplina, não schema.
- A [ADR 0010](../adr/0010-preparacao-multiempresa-interna.md) formaliza a
  interpretação do gatilho; a ADR 0005 permanece **inalterada**.
- O Painel Administrativo Web V1 **interno** deixa de estar bloqueado por
  esta fatia transversal — mas continua dependendo do merge das suas
  próprias decisões documentais, hoje não integradas (§4).

O valor desta fatia não é o que ela constrói; é a opção que ela preserva.
Um sistema que respeita R1–R7 pode escolher entre banco único segregado e
banco por cliente **quando o gatilho comercial chegar**. Um que as viola
descobre, tarde, que a escolha já foi feita por omissão.
