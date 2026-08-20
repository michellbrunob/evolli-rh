# ADR 0010 — Preparação Multiempresa Interna

- Status: **Aceito**
- Data: 2026-08-11
- Relacionado: [docs/modules/fatia-transversal-multiempresa-pronto.md](../modules/fatia-transversal-multiempresa-pronto.md),
  [docs/decisions/rebaseline-multiempresa-pronto-pendente.md](../decisions/rebaseline-multiempresa-pronto-pendente.md)
  (decisão de produto que esta ADR formaliza),
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md),
  [ADR 0008](0008-jornada-ponto-rastreavel-baseline-v1.md)

> **Nota de numeração.** `main` contém ADRs de 0001 a 0008. A numeração
> **0009 está reservada** para a ADR do Painel Administrativo Web, hoje
> existente apenas na branch `feature/web-painel-administrativo-v1-spec`,
> **sem PR e sem merge**. Esta ADR assume 0010 deliberadamente, para não
> colidir com aquele documento quando ele for integrado. Isso resolve a
> pendência **DP-M-13**.

## Contexto

A [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md) fixou que o
deployment é single-tenant, para uso interno do escritório, e que
`company_id` é o maior limite organizacional e de autorização. Ela também
registrou dois mecanismos que esta ADR precisa respeitar sem alterar:

1. um **gatilho de reavaliação** da própria multitenancy, que exige
   **ADR nova, não emenda informal**, quando a comercialização for
   decidida;
2. uma **Emenda 1** que concedeu ao `admin_tecnico` acesso global ao
   ambiente interno como exceção temporária, reavaliável no que ocorrer
   primeiro entre **2026-11-04** e o **"início de qualquer processo de
   comercialização para terceiros, mesmo que preliminar"**.

O levantamento em
[docs/decisions/rebaseline-multiempresa-pronto-pendente.md](../decisions/rebaseline-multiempresa-pronto-pendente.md)
identificou que o replanejamento arquitetural para futuro atendimento
comercial **poderia** ser lido como o gatilho (2) — o que anteciparia a
reavaliação da exceção do `admin_tecnico`. O levantamento registrou a
questão sem decidi-la, por ser interpretação de produto e segurança, não
de arquitetura.

O produto avaliou e decidiu. Esta ADR formaliza essa decisão.

**Esta ADR não aciona multitenancy, não inicia comercialização e não
autoriza implementação de camada de cliente.** Ela é uma **interpretação
operacional aprovada** do que já estava escrito na ADR 0005 — mais uma
disciplina de preparação que não exige schema.

## Decisão

### 1. Preparação arquitetural interna não caracteriza início de comercialização

Desenhar a evolução multiempresa, comparar modelos de isolamento e fixar
regras de código que preservem opções futuras **é trabalho de arquitetura
interna**. Não é proposta comercial, não é contrato, não é piloto e não dá
a terceiro nenhum acesso.

Portanto, o gatilho (2) da Emenda 1 da ADR 0005 — "início de qualquer
processo de comercialização para terceiros, mesmo que preliminar" — **não
é considerado acionado** pela produção destes documentos.

### 2. Gatilhos objetivos que antecipam a reavaliação do `admin_tecnico`

A reavaliação da exceção da Emenda 1 é antecipada **se e somente se**
ocorrer, de forma verificável, qualquer um destes cinco fatos:

| #   | Fato                                   | Por que é objetivo                                          |
| --- | -------------------------------------- | ----------------------------------------------------------- |
| G1  | **Proposta comercial ativa**           | Existe uma proposta emitida a um terceiro identificável     |
| G2  | **Contrato com cliente externo**       | Existe instrumento assinado                                 |
| G3  | **Piloto com terceiro**                | Terceiro opera o sistema, ainda que sem contrato definitivo |
| G4  | **Provisionamento de cliente externo** | Existe registro de cliente externo no ambiente              |
| G5  | **Acesso de terceiro ao ecossistema**  | Credencial de alguém fora do escritório passa a existir     |

O ganho desta decisão é **substituir uma expressão elástica ("mesmo que
preliminar") por cinco fatos verificáveis**. Sem qualquer um deles, a
reavaliação permanece obrigatória **até 04/11/2026**, exatamente como a
Emenda 1 já estabelecia — o prazo **não é estendido, adiado ou
enfraquecido** por esta ADR.

### 3. O escopo permanece interno; nenhuma multitenancy é criada

Nada é criado, alterado ou autorizado: `tenant_id`, RLS, base central,
troca dinâmica de conexão, CNPJ, cliente externo, Cloudflare R2, bucket,
credencial, endpoint ou integração. O sistema permanece com **um
PostgreSQL** e `company_id` como fronteira organizacional e de
autorização.

### 4. Nenhum cliente externo, nenhum `auditor`, nenhum `dpo` agora

- Nenhum cliente externo será criado ou atendido nesta fase.
- Nenhum usuário com papel `auditor` ou `dpo` será provisionado nesta fase.

A segunda decisão tem consequência de segurança que precisa ficar
explícita: a Emenda 1 da ADR 0005 (item 3) registrou que o escopo desses
papéis **precisa ser deliberado antes do primeiro provisionamento**, e o
código hoje concede a eles leitura ampla da trilha de auditoria sem
checagem de empresa. **Enquanto ninguém for provisionado, essa capacidade
permanece latente, não exercida** — e é isso que mantém a pendência
aceitável. Provisionar qualquer um dos dois **sem** decidir o escopo antes
seria exercer uma permissão que nunca foi aprovada.

### 5. O modelo de banco futuro permanece pendente

A escolha entre **banco único segregado** e **banco por cliente
contratante** não é feita aqui. A especificação transversal (§3) apresenta
a comparação e uma **recomendação técnica condicionada** — que é
recomendação, não preferência convertida em decisão.

### 6. As regras de preparação valem a partir de agora

As regras **R1 a R7** da especificação transversal (§4) passam a valer como
critério de revisão de código. Nenhuma exige schema, coluna, tabela ou
endpoint. São disciplina: escopo sempre resolvido no servidor, nenhuma
empresa fixa em código ou ambiente, sem acesso cross-company, auditoria
apta a estender-se de forma aditiva, um único mecanismo de isolamento,
integrações externas atrás de interface, e nenhum campo especulativo.

## O que não foi decidido

Explicitamente **fora** desta ADR:

- **Se haverá comercialização** — e quando.
- **Modelo de isolamento futuro** (banco único segregado vs. banco por
  cliente) — decisão 5.
- **Definição de "Cliente contratante"**, cardinalidade com CNPJ, escopo do
  prestador de serviço, critérios de seleção/troca de contexto.
- **Escopo de `auditor` e `dpo`** — permanece bloqueante antes de qualquer
  provisionamento e antes de cliente externo.
- **CNPJ em `Empresa`** (DP-4 da ADR 0006) — segue pendente, e esta ADR
  proíbe materializá-lo agora.
- **Escopo do papel `gestor`** (DP-8 da ADR 0006) — segue pendente.
- **Produto Cloudflare exato**, retenção e descarte de documentos.
- **Contas Master nominativas e recuperação** — a exigência da Emenda 1
  (ao menos duas contas nominativas, separadas de uso rotineiro) continua
  valendo; o procedimento concreto não é definido aqui.

Nenhum desses itens é resolvido por inferência a partir desta ADR.

## Relação com a ADR 0005

Esta ADR **não altera, reescreve ou revoga** nenhuma decisão da ADR 0005,
nem sua Emenda 1. A história daquela ADR permanece legível como foi aceita.

| Elemento da ADR 0005                                           | Efeito desta ADR 0010                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Decisão 1 (deployment interno single-tenant)                   | **Inalterada** e reafirmada                                                             |
| Decisão 2 (nenhuma multitenancy técnica)                       | **Inalterada** e reafirmada                                                             |
| Decisão 3 (`company_id` como fronteira)                        | **Inalterada** e reafirmada                                                             |
| Decisão 5 (comercialização exige etapa e ADR próprias)         | **Inalterada** — esta ADR não é aquela ADR                                              |
| Decisão 8 (MFA obrigatório antes de dado real)                 | **Inalterada** e reafirmada                                                             |
| Gatilho geral de reavaliação (4 itens)                         | **Inalterado**                                                                          |
| Emenda 1, item 1 (acesso global temporário do `admin_tecnico`) | **Inalterado** — segue exceção temporária                                               |
| Emenda 1, item 2 (prazo de 90 dias, até 2026-11-04)            | **Inalterado** — o prazo não é estendido                                                |
| Emenda 1, item 2 (gatilho "comercialização preliminar")        | **Interpretado**, não alterado: os cinco fatos G1–G5 (decisão 2) definem o que o aciona |
| Emenda 1, item 3 (`auditor`/`dpo` não cobertos)                | **Inalterado** e reforçado pela decisão 4                                               |

A única contribuição desta ADR sobre a 0005 é **tornar verificável um
critério que era interpretável**. Onde a Emenda 1 dizia "mesmo que
preliminar", esta ADR enumera cinco fatos observáveis. Isso reduz o espaço
de interpretação — não amplia a exceção nem move o prazo.

## Consequências

- **Nada muda em banco, código ou infraestrutura.** Esta ADR não gera
  migration, dependência, endpoint ou configuração.
- As regras R1–R7 passam a ser critério de revisão de código, a partir de
  agora.
- A reavaliação do acesso global do `admin_tecnico` **continua agendada
  para até 04/11/2026** e passa a ter, além do prazo, cinco gatilhos
  objetivos que a antecipam.
- O Painel Administrativo Web V1 **interno** deixa de estar bloqueado por
  esta fatia transversal — mas continua dependendo do merge das suas
  próprias decisões documentais, hoje não integradas.
- Organização (ADR 0006), Pessoas (ADR 0007) e Ponto (ADR 0008) **não são
  reescritos**. A camada de cliente, quando existir, é aditiva acima de
  `Empresa`, que hoje é raiz sem pai.
- A comercialização futura continua exigindo **ADR nova** (ADR 0005,
  decisão 5), migration aditiva, teste de isolamento com prova negativa e
  revisão específica de LGPD.

## Riscos aceitos

Cada um é aceito **conscientemente**, com o motivo registrado:

1. **A definição de comercialização por enumeração pode não cobrir um caso
   real.** Cinco fatos objetivos são mais verificáveis que "preliminar",
   mas uma situação intermediária — uma conversa exploratória avançada,
   por exemplo — pode não se encaixar em nenhum e ainda assim merecer
   reavaliação. _Mitigação:_ o prazo de 04/11/2026 continua valendo como
   piso, independentemente dos gatilhos.

2. **A capacidade ampla de `auditor`/`dpo` permanece no código, latente.**
   Ela é inofensiva porque ninguém a exerce, e a decisão 4 proíbe
   provisionar. _Mitigação:_ a proibição é explícita, e o escopo deles é
   bloqueante antes de cliente externo. _Risco residual:_ um
   provisionamento feito por engano exerceria uma permissão nunca
   aprovada.

3. **Adiar a escolha do modelo de banco tem custo se as regras R1–R7 forem
   violadas.** Enquanto forem respeitadas, as duas alternativas continuam
   abertas; uma violação silenciosa fecha a porta do "banco por cliente"
   sem que ninguém decida isso. _Mitigação:_ R1–R7 como critério de
   revisão.

4. **O acesso global do `admin_tecnico` continua vigente** até a
   reavaliação. Proporcional a um único ocupante interno; deixaria de ser
   assim que existir fronteira de confiança distinta. _Mitigação:_ os
   gatilhos G1–G5 e o prazo.

5. **Documentos em branch não integrada podem divergir.** ADR 0009 e a
   spec do Painel Web não estão em `main`; o que for implementado antes do
   merge delas estará construindo sobre base que ainda pode mudar.
   _Mitigação:_ a sequência de execução coloca a integração antes da
   implementação.

## Confirmação de escopo

**Esta ADR mantém o escopo interno e não cria multitenancy.** Não há
`tenant_id`, RLS, base central, troca de conexão, cliente externo, CNPJ,
Cloudflare R2, bucket, credencial, endpoint ou integração. Nenhum usuário
ou conta administrativa é criado. Nenhuma permissão existente é alterada.

**Esta ADR não declara conformidade LGPD, segurança validada ou adequação
trabalhista.** MFA continua obrigatório antes de qualquer piloto com dado
real ou produção (ADR 0003, decisão 3; ADR 0005, decisão 8 — ambas
inalteradas).

## Gatilhos de revisão desta ADR

Esta decisão deve ser reaberta — com ADR nova ou emenda formal — quando
**qualquer** um destes ocorrer:

1. Qualquer um dos fatos **G1–G5** (decisão 2) se concretizar.
2. **04/11/2026**, prazo da Emenda 1 da ADR 0005, sem que os gatilhos
   tenham disparado antes.
3. Necessidade de provisionar `auditor` ou `dpo` — exige decidir o escopo
   deles antes (decisão 4).
4. Qualquer um dos quatro gatilhos gerais da ADR 0005 se concretizar — que
   continuam valendo, sem alteração.
5. Constatação de que as regras R1–R7 foram violadas de forma que feche
   uma das alternativas de isolamento sem decisão explícita.

## Responsabilidades

- **Time de desenvolvimento (código):** aplicar R1–R7 como critério de
  revisão; não introduzir `tenant_id`, RLS, troca de conexão, CNPJ ou
  integração externa; não provisionar `auditor`/`dpo`.
- **Produto:** acionar a revisão desta ADR ao primeiro dos fatos G1–G5;
  resolver as decisões pendentes classificadas como bloqueantes de
  comercialização antes de qualquer avanço nesse sentido.
- **TI/Segurança:** conduzir a reavaliação do acesso global do
  `admin_tecnico` no prazo ou no gatilho, o que vier primeiro; verificar as
  condições da Emenda 1 (contas nominativas, separação de uso rotineiro).
- **DPO/jurídico:** conduzir revisão específica de LGPD quando a operação
  para terceiros for aprovada — dado de cliente terceiro tem base legal,
  finalidade e retenção próprias, e essa análise não está feita.
- **Revisor de PR:** bloquear merge que introduza multitenancy técnica,
  cliente externo, integração Cloudflare, provisionamento de
  `auditor`/`dpo`, ou que altere permissões existentes sem ADR própria.

## Limitações

- Esta ADR **não autoriza início de código, endpoint, banco, bucket,
  credencial ou infraestrutura**.
- Não decide comercialização, modelo de isolamento, definição de cliente
  contratante, escopo de prestador, CNPJ, escopo de `gestor`,
  `auditor`/`dpo`, produto Cloudflare, retenção ou descarte.
- Não estende, adia nem enfraquece o prazo de 04/11/2026 da Emenda 1 da
  ADR 0005.
- Não altera nenhuma ADR anterior — apenas referencia e interpreta um
  critério da ADR 0005, sem reescrever sua história.

---

## Nota de convergência (ADR 0012, 2026-08-20)

**Esta nota não altera nem apaga o texto acima; adiciona uma camada de
convergência.** A [ADR 0012](0012-convergencia-governanca-privacidade-e-perfis-globais.md)
formaliza:

- O `admin_tecnico` **deixa de ser** perfil de acesso global operacional
  contínuo e converge para **bootstrap/histórico**; o único acesso global
  **standing** passa a ser o **`master_tecnico`** (Constituição v1.3.0). A
  decisão 4 desta ADR ("nenhum cliente externo, nenhum `auditor`, nenhum `dpo`
  agora") é **reforçada**, e o `dpo` fica **formalmente depreciado** — mantido no
  enum/histórico, removível só por expand/contract.
- As responsabilidades de privacidade/LGPD atribuídas a "DPO/jurídico" passam a
  ser de **RH + Jurídico**; a designação formal de encarregado é decisão futura
  do Jurídico.
- As regras R1–R7 e os gates de MFA/T004 permanecem **inalterados**.
