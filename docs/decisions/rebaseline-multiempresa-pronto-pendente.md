STATUS: PENDENTE DE APROVAÇÃO DO PRODUTO — NÃO IMPLEMENTAR

# Rebaseline multiempresa preparada — decisões pendentes

- Data do levantamento: 2026-08-11
- Especificação correspondente: [docs/modules/fatia-transversal-multiempresa-pronto.md](../modules/fatia-transversal-multiempresa-pronto.md)
- Precedente de formato: [etapa1-modelagem-organizacional-pendente.md](etapa1-modelagem-organizacional-pendente.md)
  e [etapa1-escopo-autorizacao-interna-pendente.md](etapa1-escopo-autorizacao-interna-pendente.md)
  — levantamentos que apresentam alternativas sem decidir.

## 0. O que este documento é, e o que não é

Este é um **levantamento de decisões pendentes**, não uma decisão. Nenhum
item abaixo está aprovado. Nenhuma ADR é criada nesta fase — a
[ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md) exige
**ADR nova, não emenda informal**, quando a multitenancy for acionada, e
essa etapa é posterior à aprovação registrada aqui.

**Este documento não:**

- altera código, schema Prisma, migration, API, teste, CI, dependência,
  infraestrutura ou qualquer arquivo existente;
- cria banco, bucket, conta, credencial, segredo ou serviço externo;
- aciona o gatilho de reavaliação da ADR 0005 — apenas registra que ele
  **pode** ter sido acionado (DP-M-01);
- declara conformidade LGPD, segurança validada ou adequação trabalhista;
- inventa requisito de PRD.

## 1. Achados que exigem decisão humana antes do restante

Os dois primeiros itens não são "mais uma pendência da lista": eles afetam
autorização em ambiente já operante e, por isso, vêm primeiro.

### DP-M-01 — O gatilho da Emenda 1 da ADR 0005 disparou?

**Quem decide:** Produto + TI/Segurança.

A Emenda 1 da ADR 0005 concedeu ao `admin_tecnico` acesso global ao
ambiente interno como exceção temporária, reavaliável no que ocorrer
primeiro entre **(a)** 90 dias a partir de 2026-08-06 — isto é, até
**2026-11-04** — e **(b)** **"início de qualquer processo de
comercialização para terceiros, mesmo que preliminar"**.

O replanejamento que originou esta especificação assume, como direção de
produto, que prestadores de serviço administrarão múltiplos clientes.
**Isso é plausivelmente um processo de comercialização preliminar.** Se
for, a reavaliação da exceção é **devida agora**, não em novembro.

**A pergunta a responder:** o gatilho (b) disparou?

| Resposta | Consequência                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sim**  | A reavaliação do acesso global do `admin_tecnico` passa a ser devida imediatamente, com as condições da Emenda 1 (contas nominativas, separação de uso rotineiro, auditoria) verificadas antes de qualquer avanço comercial |
| **Não**  | O prazo de 2026-11-04 continua valendo, e a reavaliação segue agendada — mas o produto assume explicitamente que planejar a operação para terceiros não conta como "preliminar"                                             |

**Esta especificação não escolhe entre as duas.** Interpretar o alcance da
própria exceção é decisão de produto e segurança.

### DP-M-02 — Escopo de `auditor` e `dpo` (DP-7, herdada e agravada)

**Quem decide:** Produto + TI/Segurança + DPO.

A Emenda 1 da ADR 0005 (item 3) registrou que `auditor` e `dpo` **não são
cobertos** pela exceção do `admin_tecnico`, e que seu escopo precisa ser
deliberado **antes do primeiro provisionamento**. Hoje o código concede a
esses papéis leitura da trilha de auditoria sem checagem de empresa —
capacidade técnica que nunca foi validada por uso real, porque não há
usuário com esses papéis.

Com uma camada de cliente contratante, "ler a trilha inteira" deixaria de
significar "ler a trilha do escritório" e passaria a significar "ler a
trilha de todos os clientes". **O salto de alcance não é gradual.**

Decisão pendente: qual o escopo de `auditor` e `dpo` — hoje, e sob a
camada de cliente.

## 2. Decisões pendentes do rebaseline comercial

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

## 3. Contexto não integrado — não tratar como vigente

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

## 4. Conflitos e tensões com documentos existentes

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

## 5. O que muda hoje se esta decisão for aprovada

Deliberadamente pouco:

- **Nada em banco, código ou infraestrutura.**
- Passam a valer, como critério de revisão de código, as regras R1–R7 da
  especificação (§4) — disciplina, não schema.
- O roadmap e as ADRs são atualizados **somente após** a aprovação
  (especificação, §6.2, passo 2).

O valor desta fatia não é o que ela constrói; é a opção que ela preserva.
Um sistema que respeita R1–R7 pode escolher entre banco único segregado e
banco por cliente **quando o gatilho comercial chegar**. Um que as viola
descobre, tarde, que a escolha já foi feita por omissão.
