# T156 — Matriz "Evolli atual × referência de mercado"

Status: **investigação concluída; não autoriza implementação.**
Data: 2026-10-13.

**Base auditada:** `origin/main` em `cd80ea9ab8cbae0a25706f1d248dc027a1cd40c2`
(T154, PR #145). **Base de entrega:** `origin/main` em
`25ce08716744f32db04393a9a645787f83d5fe5f` (T155, PR #147).

A auditoria continua válida na base de entrega: o intervalo
`cd80ea9..25ce087` alterou **cinco arquivos, todos de documentação e de Spec
Kit** — nada em `apps/`, `packages/`, `infra/`, `scripts/`, `.github/`,
`package.json` ou `pnpm-lock.yaml`. Nenhuma classificação deste documento
depende de código que tenha mudado entre as duas bases.

## 0. Natureza e limites

Este documento **classifica o estado real** do Evolli contra as capacidades
observadas em referência de mercado, e registra, para cada lacuna, o que falta
decidir antes de qualquer código. Ele:

- **não implementa nada** — nenhum código, schema, rota, tela ou dependência;
- **não altera o padrão visual** — a fundação visual segue congelada pela
  decisão do proprietário registrada na T146;
- **não cria requisito aprovado** — capacidade observada em mercado não vira
  requisito do Evolli por si só;
- **não declara conformidade** com CLT, LGPD, Portaria MTP 671/2021, eSocial
  ou CCT/ACT;
- **não reabre ADR, gate ou decisão** — apenas os referencia.

Coluna "referência de mercado" vem de
[referência funcional de mercado](referencia-funcional-solides-mapa-evolli.md) e
[referências de mercado e diretrizes oficiais](referencias-mercado-diretrizes-oficiais-evolucao-evolli-rh.md).
Coluna "Evolli hoje" foi **derivada do código em `main`**, não de texto anterior.

### Vocabulário de classificação

Usa a legenda já vigente no ledger do Spec Kit, acrescida de **bloqueado**:

| Classe            | Significado operacional                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **funcional**     | Persistência + API + RBAC + tela que lê e grava + teste. Operável de ponta a ponta.              |
| **parcial**       | Existe e é real, mas incompleto: só leitura, API sem tela, tela sem o ciclo todo.                |
| **demonstrativo** | Superfície visual com dados de exemplo no próprio código. Nada é gravado.                        |
| **planejado**     | Previsto em roadmap/ledger, sem código.                                                          |
| **bloqueado**     | Existe decisão ou gate registrado que **impede** avançar. Ausência deliberada, não esquecimento. |

## 1. Fotografia quantitativa de `main`

Contado nesta tarefa, em `apps/web/src/screens/` e `apps/api/src/`:

| Medida                                      | Valor                                |
| ------------------------------------------- | ------------------------------------ |
| Telas-folha `*Screen.tsx`                   | **52**                               |
| — ligadas à API real                        | **13**                               |
| — cascas com `*.fixtures.ts`                | **33**                               |
| — contêineres de abas (moldura, não tela)   | **6**                                |
| Módulos Nest registrados em `app.module.ts` | 13                                   |
| Models/enums no schema Prisma único         | 40                                   |
| Migrations                                  | 14                                   |
| Pacotes `packages/*` com código             | **0** (os quatro têm só `README.md`) |

> **Correção ao inventário da T146.** Aquele registro anunciava 45 telas-folha
> (11 funcionais, 1 parcial, 33 demonstrativas). A contagem está desatualizada:
> `main` tem 52, e a `EquipeScreen` da T153 não entrou naquela conta. A fonte
> única `docs/prototipos/t146/dados.js` precisa convergir — registrado aqui como
> dívida, **não corrigida nesta tarefa**.

**Treze telas que realmente falam com a API:** Contas de acesso, Minha equipe,
Horários, Centros de custo, Estrutura organizacional, Funções e cargos,
Colaboradores, Dados contratuais, Histórico funcional, Pessoas › Documentos,
Horário do colaborador, Pessoas › Solicitações, Visão do período.

## 2. Matriz modular

| #   | Frente                                     | Referência de mercado (observada)                                                            | Evolli em `main`                                                                                                                                                                                                                           | Classe                                                      | Gate / evidência                                                                                     |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | **Base de pessoas**                        | ficha única: cadastro, contatos, documentos, dependentes, vínculo, cargo, jornada, histórico | Colaborador tem **só `nome` e `situacao`**; vínculo, alocação, movimentação e histórico funcionais com rigor de SGBD (exclusion constraint, FK composta, trigger)                                                                          | **parcial**                                                 | Ausência de CPF, nascimento, endereço, salário, família é **deliberada**: `DP-14`/`DP-15` (ADR 0007) |
| 2   | **Estrutura organizacional**               | unidades, departamentos, áreas, equipes, cargos, centros de custo                            | 7 entidades com CRUD real, escopo por empresa e e2e de IDOR                                                                                                                                                                                | **parcial**                                                 | `inativar`/`reativar` existem na API (14 rotas) e **nenhuma tem botão na tela**                      |
| 3   | **Organograma / hierarquia**               | organograma de pessoas, superior direto                                                      | Hierarquia **não-recursiva por decisão**; relação gestor↔subordinado não existe nem estruturalmente                                                                                                                                        | **bloqueado**                                               | ADR 0006 d.8; `DP-16`. Entregar exige ADR nova, não só código                                        |
| 4   | **Admissão**                               | pré-admissão, pendências, etapas, responsáveis, conclusão                                    | Admissão existe como **evento cadastral transacional** (colaborador + vínculo + movimentação numa transação), homologada ponta a ponta na T147                                                                                             | **funcional** (como evento) / **planejado** (como processo) | Processo com etapa/prazo/pendência: `DP-2E-10`, `DP-2E-11`                                           |
| 5   | **Checklists de contratação/desligamento** | modelos separados por evento do ciclo de vida                                                | **Zero código.** Nenhum model, rota ou tela. A investigação da T155 está **integrada em `main`** (PR #147, squash `25ce087`) e não abre implementação                                                                                      | **planejado**                                               | 12 perguntas a RH em [T155](t155-checklists-contratacao-desligamento-pendencias.md)                  |
| 6   | **Gestor / liderança**                     | time, pendências, calendário, férias, aniversários, feedback                                 | Consulta de equipe e detalhe de vínculo funcionais e somente leitura, com escopo à prova de fallback. **A administração desse escopo não tem tela**                                                                                        | **parcial**                                                 | ADR 0015 aprovou tudo; faltam as 9 rotas na interface                                                |
| 7   | **Portal do colaborador (ESS)**            | portal próprio: dados, documentos, solicitações, ponto                                       | 4 telas 100% estáticas. **Não existe login de colaborador**; o papel `colaborador` tem **zero capacidades** no RBAC                                                                                                                        | **demonstrativo** / identidade **bloqueada**                | ADR 0015: `DP-23` resolvido é pré-condição do ESS, **não autorização**                               |
| 8   | **Documentos / GED**                       | repositório, upload, versões, assinatura                                                     | Só **metadado**. Nenhuma coluna capaz de guardar conteúdo — há e2e que verifica isso no catálogo do Postgres                                                                                                                               | **funcional** (metadado) / **bloqueado** (conteúdo)         | ADR 0011 §13 Nível 2 inteiro; R2 aprovado pela ADR 0013 **sem habilitar upload**                     |
| 9   | **Central de solicitações**                | pedidos do colaborador, triagem, aprovação                                                   | Ciclo completo operável **pelo RH**: criar, triar, aprovar/recusar, encaminhar, reabrir; histórico append-only no banco                                                                                                                    | **funcional** (lado RH) / **bloqueado** (lado colaborador)  | `PD-SOL-01..05` aprovadas; sem anexo (`PD-SOL-05`), sem prazo (`PD-SOL-04`)                          |
| 10  | **Jornada e ponto**                        | marcação, ajuste, inconsistência, espelho, fechamento                                        | **Marcação e ajuste persistem e são funcionais**, com `UPDATE`/`DELETE` revogados no banco. Apuração, banco de horas, compensação, fechamento, fila e parser AFD existem como **sete núcleos puros sem rota, sem persistência e sem tela** | **funcional** (marcação) / **parcial** (núcleos)            | `ponto.module.ts` declara: "a ausência é o cumprimento da Baseline, não uma lacuna"                  |
| 11  | **Banco de horas**                         | extrato, limites, DSR, quitação, integração Folha                                            | Motor puro testado, **não ligado a nada**. A tela de Banco de Horas declara que não importa aquele núcleo                                                                                                                                  | **parcial** (puro) / **bloqueado** (efetivo)                | `BH-01..08`, `BH-REG`, `BH-QUIT` — **todos pendentes**                                               |
| 12  | **Importação AFD / REP**                   | leiaute oficial, lote, idempotência                                                          | Parser do leiaute "004" existe (327 linhas, 27 testes), puro. **Nenhuma cadeia de entrega**: sem upload, lote, idempotência ou ator de serviço                                                                                             | **parcial** (parser) / **bloqueado** (importação)           | ADR 0008 d.4; `DP-3J-07`, `DP-3J-09`, `DP-3J-20`; pacote T148                                        |
| 13  | **Férias**                                 | aquisitivo, gozo, programação, abono                                                         | **Nada.** Nenhum model, rota ou tela. Só o valor de enum `ferias` em tipo de solicitação                                                                                                                                                   | **planejado**                                               | **Nenhum gate `DP-` nomeado existe para férias** — lacuna de governança                              |
| 14  | **Afastamentos**                           | registro, motivo, retorno, integração                                                        | Uma tela estática. `SituacaoVinculo` **não tem `suspenso`**, por decisão escrita no schema                                                                                                                                                 | **demonstrativo**                                           | `schema.prisma`: "afastamento está fora desta fatia"                                                 |
| 15  | **Benefícios**                             | catálogo, elegibilidade, beneficiários                                                       | Casca estática defensiva; nenhum registro aparece como "concedido". No backend só existe como **rótulo de pedido**                                                                                                                         | **demonstrativo** / **bloqueado**                           | `DP-14` (dado familiar/benefício/salarial)                                                           |
| 16  | **Relatórios**                             | filtros → tabela → detalhe → exportação                                                      | **9 de 9 telas são estáticas.** Nenhuma faz `fetch`                                                                                                                                                                                        | **demonstrativo**                                           | Fatia 5 do plan exige fórmulas/fontes/periodicidade aprovadas                                        |
| 17  | **Painel / indicadores**                   | painel por perfil com pendências acionáveis                                                  | Números literais em `inicioVisaoGeral.fixtures.ts`                                                                                                                                                                                         | **demonstrativo**                                           | `DP-W-06`: "não pode exibir indicador sem inventar API"                                              |
| 18  | **Recrutamento / ATS**                     | vagas, candidatos, etapas, talentos                                                          | Zero ocorrências em código                                                                                                                                                                                                                 | **planejado**                                               | Etapa 7 do roadmap, sem spec                                                                         |
| 19  | **Clima e engajamento**                    | pesquisa, eNPS, demissional                                                                  | Zero ocorrências em código                                                                                                                                                                                                                 | **planejado**                                               | Etapa 9; constituição exige agregados e separação elegibilidade↔resposta                             |
| 20  | **Desempenho, PDI, competências**          | ciclos, metas, 9-box                                                                         | Zero. _(Atenção: `competencia` no código de ponto é competência mensal `AAAA-MM`, não comportamental.)_                                                                                                                                    | **planejado**                                               | Fatia P3 do plan                                                                                     |
| 21  | **Treinamento**                            | trilhas, progresso, certificados                                                             | Zero em código                                                                                                                                                                                                                             | **planejado**                                               | Etapa 6                                                                                              |
| 22  | **SST**                                    | exames, ASO, riscos, afastamento                                                             | **Zero ocorrências em todo o repositório** — inclusive em `docs/` e `.specify/`. Nem aparece no roadmap                                                                                                                                    | **inexistente**                                             | A frente mais vazia: parte do zero absoluto                                                          |
| 23  | **Folha e eSocial**                        | rubricas, eventos, retornos                                                                  | Zero. Os 47 hits de "eSocial" em `apps/` são **asserções negativas de teste**                                                                                                                                                              | **planejado**                                               | Etapa 4; fora da navegação de propósito                                                              |
| 24  | **Integrações / webhooks**                 | contrato de lote, idempotência, ator de serviço                                              | Zero. Não existe mecanismo de autenticação para ator não humano em rota nenhuma                                                                                                                                                            | **bloqueado**                                               | Pacote T148: `evento_ponto.registrado_por_user_id` aponta para humano; `CsrfGuard` exige sessão      |
| 25  | **Notificações / e-mail**                  | lembretes, avisos ao colaborador                                                             | Interface com **implementação no-op** que só loga um aviso                                                                                                                                                                                 | **demonstrativo**                                           | Recuperação de senha, na prática, não entrega token                                                  |
| 26  | **Identidade, RBAC, auditoria**            | perfis, trilha, segregação                                                                   | 9 papéis; deny-by-default; trilha **append-only no SGBD**; segregação por empresa real no nível de query em todos os módulos                                                                                                               | **funcional**                                               | Ver §3 para as fragilidades                                                                          |
| 27  | **MFA**                                    | segundo fator                                                                                | TOTP completo, cifrado, com anti-bypass — **e desligado por padrão**                                                                                                                                                                       | **parcial**                                                 | `MFA_ENABLED=false`; aceitação de risco registrada (T132)                                            |
| 28  | **Multiempresa**                           | segregação por cliente                                                                       | Real nos domínios; invariantes no SGBD no módulo Gestor                                                                                                                                                                                    | **parcial**                                                 | `access_user.company_id` **não tem FK**; trilha não é confinada por empresa                          |

## 3. Lacunas, uma a uma

Para cada lacuna: objetivo, dados necessários, regras de negócio indefinidas,
dependências, riscos LGPD/CLT e prioridade. Prioridade é **recomendação de
sequência**, não compromisso de prazo.

### L1 — Administração do escopo do gestor não tem interface

- **Objetivo.** Permitir que o RH ligue conta↔colaborador e atribua gestor↔equipe
  pela interface, tornando utilizável a capacidade já entregue na T151/T153.
- **Dados necessários.** Nenhum novo. Os DTOs, as três tabelas e as nove rotas
  existem e são testados.
- **Regras de negócio.** Já decididas: ADR 0015 aprovou as nove recomendações em
  06/10/2026. Única exceção — o **catálogo de `motivoCodigo` das exceções de
  acesso** ainda depende de validação com RH.
- **Dependências.** Nenhuma técnica.
- **Riscos.** LGPD: a tela expõe ao RH o mapa conta↔pessoa da própria empresa —
  classe de dado que o RH já acessa; toda mutação é auditada na mesma transação.
- **Prioridade: alta.** Hoje configurar um gestor exige HTTP cru ou o seed; por
  isso **todo gestor real vê lista vazia**.

### L2 — Inativar e reativar nunca chegaram à tela

- **Objetivo.** Fechar o ciclo de vida dos sete cadastros organizacionais.
- **Dados necessários.** Nenhum. Quatorze rotas com RBAC `manage` e e2e prontos.
- **Regras de negócio.** Já decididas. Três telas inclusive **anunciam em texto**
  que "não é possível excluir, apenas inativar" — e não oferecem o botão.
- **Riscos.** Baixos. Nenhuma exclusão física existe no produto.
- **Prioridade: alta.** O RH enxerga o filtro "inativo" e não tem como pôr nada
  nesse estado.

### L3 — Nenhuma tela funcional pagina

- **Objetivo.** Impedir que a lista minta por omissão.
- **Fato.** A API devolve `{itens, total, pagina, tamanhoPagina}` com padrão 20 e
  máximo 100. **Nenhuma** das treze telas reais monta `pagina`.
- **Consequência literal.** A partir do 21º registro a tela omite dados sem avisar.
- **Riscos.** CLT/operacional: uma conferência feita sobre lista truncada produz
  decisão errada sem deixar sinal.
- **Prioridade: alta.** É defeito de correção, não melhoria.

### L4 — Não existe busca por nome ou matrícula em Colaboradores

- **Objetivo.** Tornar o cadastro usável acima de poucas dezenas de pessoas.
- **Dados necessários.** Campo `busca` no DTO, no service e um índice.
- **Regras indefinidas.** Se a busca por matrícula é exata e a por nome é parcial;
  se busca cruza vínculos encerrados.
- **Riscos.** LGPD: busca textual amplia a superfície de descoberta — deve
  respeitar o mesmo escopo de empresa, sem exceção.
- **Prioridade: média-alta.**

### L5 — Solicitação de documento é um beco sem saída

- **Objetivo.** Permitir registrar que o documento pedido foi recebido.
- **Fato.** `EstadoSolicitacao` tem **um único valor** (`pendente`). Não há
  atender, cancelar nem expirar. A fila cresce monotonicamente.
- **Regras indefinidas.** O que é "atender" sem conteúdo documental; prazo.
- **Dependências.** `DP-2E-06` (prazos); o Nível 2 inteiro para anexo.
- **Prioridade: média.** Sem o Nível 2, "atender" só pode ser confirmação
  estruturada — o que é viável, mas precisa de decisão de RH sobre o significado.

### L6 — Sete núcleos puros de ponto sem nenhuma ligação

- **Objetivo.** Decidir se e quando apuração, banco de horas, compensação,
  fechamento, fila e parser AFD ganham persistência e rota.
- **Dados necessários.** Marcos completos das jornadas 1, 2 e 19 (`DP-3J-22`,
  **não recebidos do RH**); model de feriado, que não existe.
- **Regras indefinidas.** `DP-3J-06` (cálculo de competência), `BH-01` a `BH-08`.
- **Riscos CLT.** `DP-3J-09` (validade legal do controle de jornada) está
  **aberto**. Nenhum documento declara aderência ao art. 74 da CLT ou à
  Portaria 671.
- **Prioridade: bloqueada.** Não avançar enquanto `BH-03..BH-07` estiverem
  pendentes — proibição expressa no pacote de decisão.

### L7 — Férias não tem código **nem gate**

- **Objetivo.** Antes de qualquer código, **criar o identificador de decisão**
  que hoje não existe.
- **Fato.** Todas as outras frentes têm `DP-`, `BH-` ou `PD-` nomeado. Férias não
  tem nenhum, não está no mapa de capacidades e não tem sequer tela.
- **Regras indefinidas.** Período aquisitivo e concessivo, fracionamento, abono
  pecuniário, 1/3 constitucional, prescrição, interação com ponto e folha.
- **Riscos CLT.** Altos e integrais. Nada aqui pode ser inferido de mercado.
- **Prioridade: média — mas a ação imediata é de governança, não de engenharia.**

### L8 — Duas superfícies paralelas para o mesmo domínio

- **Fato.** Os destinos de menu **Documentos** e **Solicitações** servem fixtures,
  enquanto as telas que de fato funcionam estão escondidas em abas de Pessoas.
- **Risco.** Uma demonstração ou homologação feita pela navegação natural
  exercita a maquete e conclui que o produto funciona — ou que não funciona.
- **Agravante.** O `demo-seed` **não cria** tipo documental, metadado nem
  solicitação: quem sobe o ambiente encontra as telas reais vazias e as
  demonstrativas cheias.
- **Prioridade: alta.** É risco de leitura errada do produto, barato de mitigar.

### L9 — `packages/domain` está vazio

- **Fato.** Os quatro pacotes do monorepo têm só `README.md`. O README de
  `domain` diz que cálculos sensíveis "devem ser testados e versionados aqui" —
  e os sete núcleos puros vivem dentro de `apps/api/src/ponto/`.
- **Risco.** A separação entre motor puro e dado real é hoje **convenção, não
  mecanismo**. A mitigação real é o sufixo `Sintetico` nos identificadores
  exportados, que torna a ligação acidental improvável.
- **Prioridade: baixa**, mas deve ser decidida antes de qualquer persistência
  de apuração.

### L10 — Identidade e auditoria ficam fora do confinamento multiempresa

- **Fatos.** `access_user.company_id` não tem FK e `CreateUserDto.companyId` é
  `@IsString()` sem validação de existência — a fronteira de autorização inteira
  é uma string livre. A trilha de auditoria só filtra por empresa **se o cliente
  mandar o parâmetro**; `auditor` e `dpo` mantêm capacidade latente de leitura
  global, hoje inofensiva porque não são provisionáveis.
- **Riscos LGPD.** Diretos, se aqueles papéis vierem a ser semeados.
- **Prioridade: alta** para a FK (dívida que a ADR 0003 condicionou à Etapa 1,
  condição **já cumprida**); média para o confinamento da trilha.

### L11 — Retenção e descarte não existem em lugar nenhum

- **Fato.** Não há job, coluna de expiração nem política. Combinado com o
  `REVOKE DELETE` em ponto, solicitações, gestor e auditoria, o sistema hoje é
  **tecnicamente incapaz de apagar**.
- **Risco LGPD.** Colide com qualquer prazo de retenção que venha a ser decidido
  e com pedido de eliminação do titular. Não há RIPD/DPIA no repositório e não há
  encarregado designado.
- **Prioridade: bloqueante para dado real**, não para construção sintética.

### L12 — O gate-mestre `DS-OPS-01` não tem implementação técnica

- **Fato.** O identificador aparece em código **apenas como texto de aviso em 23
  telas**. Não há flag, guard ou validação de boot que impeça dado real.
- **Defesa real hoje.** A ausência de endpoints de importação, upload e folha —
  ou seja, o gate é sustentado por o produto ainda não saber receber dado real.
- **Prioridade: alta** no plano de governança; não é tarefa de interface.

### L13 — Caminho de bootstrap produz a conta errada

- **Fato.** O bootstrap por CLI cria `admin_tecnico`, papel **despromovido** e hoje
  negado em quase tudo. O `master_tecnico`, que de fato administra, só nasce por
  `INSERT` direto — como faz o seed de demonstração.
- **Prioridade: alta** antes de qualquer instalação fora da máquina do
  desenvolvedor. `CG-PROV-01/02` seguem pendentes.

## 4. Riscos consolidados

As lacunas da §3 trazem o risco caso a caso. Esta seção consolida o que
atravessa módulos, para que nenhuma fatia futura o reencontre por acidente.

### CLT e trabalhista

| Risco                                            | Origem                                                                                            | Situação                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Controle de jornada sem validade legal declarada | `DP-3J-09` aberto; nenhum documento afirma aderência ao art. 74 da CLT ou à Portaria MTP 671/2021 | **Aberto.** Bloqueia qualquer uso real de ponto |
| Apuração sobre jornadas incompletas              | `DP-3J-22`: marcos das jornadas 1, 2 e 19 **não recebidos do RH**                                 | **Aberto.** Bloqueia apurar essas três          |
| Banco de horas sem política                      | `BH-01` a `BH-08`, `BH-REG`, `BH-QUIT` — todos pendentes                                          | **Aberto.** Proibição expressa de avançar       |
| Efeito financeiro de DSR                         | `DP-3J-21` (parte financeira) suspenso até autorização da Diretoria                               | **Aberto**                                      |
| Férias sem fundação **e sem gate**               | Nenhum `DP-` nomeado existe para férias                                                           | **Aberto e não catalogado** — ver L7            |
| Lista truncada em conferência                    | L3: nenhuma tela pagina; a partir do 21º registro omite sem avisar                                | **Defeito ativo**                               |

### LGPD e privacidade

| Risco                                    | Origem                                                                                       | Situação                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nenhum RIPD/DPIA existe                  | Obrigação referenciada nas ADRs 0011 e 0012; nenhum artefato no repositório                  | **Aberto**                                                                      |
| Nenhum encarregado designado             | `CG-GOV-02`; o papel `dpo` existe, está depreciado e não é provisionável                     | **Aberto**                                                                      |
| Incapacidade técnica de apagar           | `REVOKE DELETE` em ponto, solicitações, gestor e auditoria, sem política nem job de retenção | **Aberto** — colide com prazo de retenção e com pedido de eliminação do titular |
| Titular sem meio de se identificar       | Sem ESS e sem rotas de acesso, retificação, portabilidade ou eliminação; `DP-3J-11` aberto   | **Aberto**                                                                      |
| Dado restrito fora de escopo por decisão | `DP-14`/`DP-15`: `Colaborador` tem só `nome` e `situacao`                                    | **Mitigado por ausência deliberada**                                            |
| Trilha não confinada por empresa         | Filtro por empresa só se o cliente enviar; `auditor` e `dpo` têm leitura global latente      | **Aberto**, hoje inofensivo por não serem provisionáveis — ver L10              |
| Dado de saúde por inferência             | `tipo`/`motivo` de solicitação revelam condição — um atestado é diagnóstico implícito        | **Contido** por `PD-SOL-05`, que mantém a projeção fora do gestor               |

### Segurança

| Risco                                         | Origem                                                                                  | Situação               |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| MFA desligado por padrão                      | `MFA_ENABLED=false`; aceitação de risco registrada na T132                              | **Aceito formalmente** |
| Sem step-up para ação sensível                | `DS-MFA-03`; a constante de TTL existe sem consumidor                                   | **Aberto**             |
| Sem cofre de segredos, rotação ou break-glass | `DS-SEC-01` a `DS-SEC-04`; formulário de evidências em branco                           | **Aberto**             |
| Sem backup, RPO, RTO ou restauração testada   | `DS-BKP-01` a `DS-BKP-06`                                                               | **Aberto**             |
| Fronteira de autorização sem integridade      | `access_user.company_id` sem FK; DTO aceita string não validada                         | **Aberto** — ver L10   |
| Bootstrap produz a conta errada               | O CLI cria `admin_tecnico`, despromovido; `master_tecnico` só nasce por `INSERT` direto | **Aberto** — ver L13   |
| Gate-mestre sem controle técnico              | `DS-OPS-01` só existe como aviso em 23 telas                                            | **Aberto** — ver L12   |
| Recuperação de senha não entrega token        | Notificador no-op ligado como implementação ativa                                       | **Aberto**             |

**Nenhum desses riscos é introduzido pela fatia recomendada na §5**, e nenhum é
resolvido por ela. Permanecem como estão.

## 5. Recomendação — uma única próxima fatia

> **Interface de Administração da Liderança (RH): ligação conta↔colaborador e
> atribuição gestor↔equipe.**

### Por que esta

1. **Independe por completo de resposta pendente do RH.** As nove decisões que a
   governam foram aprovadas pelo proprietário em 06/10/2026 e estão na ADR 0015.
   Nada aqui espera RH, Jurídico, DPO ou Diretoria.
2. **Não inventa regra de negócio nenhuma.** Zero model novo, zero migration,
   zero alteração de contrato HTTP, zero decisão trabalhista. É interface sobre
   contrato aprovado, testado e já em `main` — exatamente o padrão da T140 sobre
   a T139.
3. **Destrava capacidade já paga.** A T151 construiu a fundação e a T153 entregou
   a consulta. Sem esta tela, configurar um gestor exige HTTP cru ou o seed, e na
   prática **todo gestor real vê lista vazia**. É a maior distância entre esforço
   investido e valor entregue no repositório hoje.
4. **Escopo fechado e testável.** A API já tem e2e; falta a camada web, que se
   testa como as demais telas funcionais.

### Escopo proposto

**Dentro:**

- listar, criar e encerrar **ligação conta↔colaborador** da própria empresa;
- listar, criar e encerrar **atribuição gestor↔equipe**, com papel principal ou
  substituto e vigência;
- refletir na experiência as recusas que o servidor já aplica (409 de
  sobreposição, 404 anti-enumeração), sem a interface virar autoridade de
  segurança;
- paginação de verdade nas duas listas — não repetir L3 numa tela nova;
- padrão B com `Modal`, sem redesenho nem ampliação da fundação visual.

**Fora, declarado:**

- **exceções de acesso** — a única parte que depende de RH (catálogo de
  `motivoCodigo`); as três rotas ficam sem interface nesta fatia;
- qualquer mutação pelo gestor: ele permanece consultivo;
- `resumoJornada` e `andamentoSolicitacoes`, que seguem `null` por `DP-3J-12` e
  `PD-SOL-05`;
- gestão matricial, departamento inteiro e empresa inteira — não aprovados;
- ESS, portal do colaborador, backend, Prisma, migrations, seed, RBAC e Docker.

### Critérios mínimos de pronto

Todos verificáveis, sem depender de julgamento. A fatia só está pronta quando os
oito forem demonstrados em cenário sintético:

1. O RH cria uma **ligação conta↔colaborador** pela interface, e ela aparece na
   listagem com vigência e autor.
2. O RH cria uma **atribuição gestor↔equipe** para essa conta, como principal.
3. A tela **"Minha equipe"** daquele gestor, hoje vazia, passa a listar o time —
   sem nenhuma chamada HTTP manual e sem reexecutar o seed.
4. **Encerrar** a atribuição devolve a lista do gestor a vazio, e o registro
   encerrado permanece visível no histórico.
5. Tentativa de criar atribuição **sobreposta no tempo** recebe recusa estável
   (409), e a interface a comunica sem inventar mensagem de autorização.
6. Tentativa de alcançar registro de **outra empresa** continua respondendo 404,
   e a interface não revela existência.
7. Toda mutação aparece na **trilha de auditoria**, com ator, empresa e momento.
8. As duas listagens **paginam de verdade**, com total e navegação — o defeito L3
   não se repete em tela nova.

Fora desses oito, nada é critério: nem cobertura percentual, nem aparência.

### Alternativas consideradas e por que perderam

| Alternativa                          | Por que não agora                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Inativar/reativar na interface (L2)  | Boa e independente, mas é fechamento de ciclo em telas existentes, não fatia funcional nova. Candidata natural à seguinte.       |
| Paginação (L3)                       | É **defeito de correção** e merece tarefa própria, não compete como "fatia funcional". Parte dela já entra na fatia recomendada. |
| Relatório de colaboradores funcional | Exigiria filtros novos no backend e decisão sobre exportação — sai do critério de independência.                                 |
| Catálogo de motivos de desligamento  | Depende de RH definir códigos, vigência e semântica. Não independe.                                                              |
| Checklists (T155)                    | Depende das 12 perguntas ao RH, por decisão da própria T155.                                                                     |

## 6. O que esta tarefa **não** faz

- **Não inicia a T157.** A recomendação da §5 é insumo de decisão. Ela só vira
  tarefa quando o proprietário a autorizar, sob identificador próprio e com
  escopo, plano e critérios de aceite registrados antes de qualquer código.
- **Não aprova requisito novo por conta própria.** Nenhuma capacidade observada
  em mercado se torna requisito do Evolli por aparecer nesta matriz.
- **Não reserva identificador** para a implementação recomendada. Reservar antes
  da decisão de escopo já se mostrou fonte de confusão no projeto (ver T137).

## 7. Preservações expressas

- Nenhum código, schema, rota, tela, migration, seed, teste funcional ou
  dependência foi criado ou alterado.
- Docker, banco e lockfile intactos.
- Nenhuma ADR, gate ou decisão foi modificada — apenas referenciadas.
- O padrão visual não foi tocado; a fundação segue congelada pela T146.
- Nenhuma identidade visual, texto, ativo, código ou regra privada de terceiro
  foi copiada. Toda observação de mercado é descrição funcional própria, a partir
  de navegação autorizada somente leitura e de material público.
- Nenhum dado pessoal, credencial, captura de tela ou informação que identifique
  usuário da plataforma de referência consta destes documentos.
- As ressalvas não bloqueantes já registradas no repositório continuam abertas e
  **não foram corrigidas** aqui. Isso inclui a divergência do contador de telas
  em `docs/prototipos/t146/dados.js`, apontada na §1 e deixada como dívida.
- Toda capacidade de origem legal ou trabalhista citada aqui exige validação
  RH + Jurídico antes de qualquer implementação.
