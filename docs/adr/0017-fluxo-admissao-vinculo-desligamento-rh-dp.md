# ADR 0017 — Fluxo de admissão, vínculo e desligamento conforme respostas de RH/DP

- Status: **Proposto** em 2026-10-19. O aceite cabe ao proprietário
  (`DP-FLX-01`). **O aceite não emenda nenhuma decisão fechada e não autoriza
  implementação**: cada conflito listado no
  [diagnóstico de reconciliação](../decisions/t173-reconciliacao-fluxo-rh-dp.md)
  exige decisão própria, e nada desta ADR nasce como interface, API, schema,
  migration, banco, seed, RBAC ou Docker.
- Data: 2026-10-19
- Tarefa: T173 — tarefa exclusivamente documental.
- Fonte primária: as 40 respostas de RH/DP entregues pelo proprietário em
  2026-10-19, registradas literalmente em
  [t173-respostas-rh-dp.md](../decisions/t173-respostas-rh-dp.md) e citadas
  aqui como **R1** a **R40**. Sem fonte externa e sem interpretação jurídica.
- Relacionado:
  [ADR 0004](0004-auditoria-formal-e-integridade.md) (trilha sem antes/depois),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md) (pessoa e
  vínculo, catálogo de tipos, sem workflow de aprovação),
  [ADR 0011](0011-documentos-privados-e-admissao-digital.md) (documentos só de
  metadado, upload desabilitado),
  [ADR 0012](0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (privacidade com RH + Jurídico; Emenda 1, `master_tecnico` em contatos),
  [ADR 0015](0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md)
  (gestor consultivo, por equipe),
  [ADR 0016](0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md)
  (agregados, classes A1 a A3 e fichas de tratamento),
  [Baseline V1 da Fatia 2](../decisions/etapa1-fatia2-colaboradores-baseline-v1.md),
  [T155](../decisions/t155-checklists-contratacao-desligamento-pendencias.md),
  [T165](../decisions/t165-cadastro-colaborador-rh-bloqueio.md) e
  [T166](../decisions/t166-dados-admissao-perfil-diagnostico.md).

## Contexto

Até aqui, o modelo de Pessoas foi construído com decisões deliberadamente
mínimas: a pessoa só tem nome e situação, o vínculo carrega a empresa, a
matrícula é informada na admissão, não há workflow de aprovação, RH e DP
registram e efetivam diretamente, e o gestor é consultivo. Várias perguntas de
negócio ficaram, de propósito, com o RH: quem inicia, quem aprova, quais tipos
de vínculo, quais dados em cada etapa, como é o desligamento.

Em 2026-10-19 o RH/DP respondeu 40 perguntas sobre cadastro, admissão,
alterações, desligamento, documentos e integração. Esta ADR **registra o fluxo e
os direcionamentos que essas respostas descrevem**, no vocabulário do Evolli. O
diagnóstico de reconciliação, que a acompanha, mostra onde as respostas
confirmam o modelo, onde revelam lacuna e onde **conflitam com decisões já
fechadas**, e lista o que precisa ser decidido antes de qualquer código.

### Como ler esta ADR

Cada afirmação pertence a uma de três camadas, sempre identificada:

| Camada               | O que é                                                                                           | Como aparece                              |
| -------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Fato recebido**    | O que a resposta diz, com o número da resposta.                                                   | "R9", "R37"; trechos literais entre aspas |
| **Conflito técnico** | Onde o fato recebido contraria uma decisão fechada ou o comportamento atual. Não se resolve aqui. | "Conflito", com a decisão citada          |
| **Decisão pendente** | O que precisa ser decidido antes de qualquer código.                                              | o gate `DP-FLX-xx`                        |

Há ainda uma quarta marca, para o que **não** vem literal das respostas: **proposta
de operação**, quando esta ADR sugere como uma etapa seria operada e a resposta
não o diz. Proposta de operação não é atribuição da resposta e não vale como
decisão.

## Decisões

### 1. O fluxo de admissão descrito pelo RH/DP

A sequência das oito etapas é fato recebido, literal da R9. Quem atua em cada
etapa é fato recebido só quando a coluna "Origem" cita a resposta; nos demais
casos, é proposta de operação.

| #   | Etapa (R9)                            | Quem atua                                                                                              | Origem                                                                          |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | Solicitação da vaga                   | Gestor responsável **solicita** a contratação.                                                         | Fato recebido (R7)                                                              |
| 2   | Aprovações                            | Gestor solicitante, validação do RH e diretoria quando exigida; financeira conforme alçada da empresa. | Fato recebido (R8); sujeito a `DP-FLX-02` e `DP-FLX-03`                         |
| 3   | Cadastro prévio do candidato          | RH, com o mínimo do cadastro inicial.                                                                  | Proposta de operação; R1 diz só o mínimo, e R7 que o RH conduz                  |
| 4   | Envio e recebimento de documentos     | Conforme checklist configurável por empresa e tipo de vínculo, com exigências adicionais por cargo.    | Fato recebido (R13, R14); quem envia e quem recebe não é dito                   |
| 5   | Conferência pelo RH/DP                | RH/DP.                                                                                                 | Fato recebido (R9)                                                              |
| 6   | Procedimentos admissionais aplicáveis | RH/DP, inclusive saúde ocupacional quando aplicável.                                                   | Proposta de operação; R13 cita os procedimentos, sem dizer quem os conduz       |
| 7   | Validação final                       | RH/DP.                                                                                                 | Proposta de operação; R11 cita a confirmação pelo RH/DP, sem nomear quem valida |
| 8   | Efetivação do vínculo                 | RH/DP confirma; a matrícula definitiva nasce aqui.                                                     | Fato recebido (R10, R11); sujeito a `DP-FLX-10`                                 |

Também é fato recebido: em qualquer etapa, o processo pode ser **devolvido para
correção**, com motivo registrado, ou **cancelado** por usuário autorizado, com
justificativa e histórico (R9, R12); cada etapa tem status acompanhável (R9);
depois da efetivação, correção segue fluxo específico, com responsável e
alteração registrados (R12); e os dados são pedidos **por etapa** — o cadastro
inicial pede só o mínimo (R1), e o restante deve estar completo **antes da
efetivação**, conforme o que se aplica a cada contratação (R2).

Estados, transições e quem opera cada uma são decisão pendente (`DP-FLX-04`).

### 2. Os conceitos que as respostas distinguem

As respostas distinguem conceitos que hoje o modelo junta ou ainda não tem. Esta
ADR **registra** essa distinção como referência de vocabulário. Ela **não fixa**
nenhum deles como modelo de domínio: onde um conceito contraria decisão fechada,
ele entra como **direcionamento recebido**, sujeito ao gate, e **sem emenda
implícita** da ADR 0007 ou de qualquer outra decisão.

| Conceito                    | Fato recebido                                                                                                                                                                           | Conflito técnico ou lacuna, e decisão pendente                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pessoa**                  | "O cadastro pessoal deverá ser único" (R4). "O CPF poderá ser utilizado para identificar a pessoa, com os cuidados necessários de segurança e proteção de dados" (R37).                 | **Direcionamento recebido.** Usar o CPF para reconhecer a mesma pessoa conflita com a ADR 0007, decisão 2. `DP-FLX-05`, `DP-FLX-09`.                                                                                                              |
| **Vínculo contratual**      | Cada vínculo tem informações contratuais, empresa, cargo, remuneração, jornada, gestor e situação próprios (R4), e identificador próprio, matrícula ou código interno (R37).            | **Lacuna parcial:** remuneração e local de trabalho não existem hoje. **Conflito condicional:** "gestor" próprio do vínculo, se for essa a leitura, contraria a ADR 0015, decisão 1 (o gestor vem da equipe). `DP-FLX-08`.                        |
| **Mais de um vínculo**      | "Sim": a pessoa pode estar vinculada "a mais de uma empresa do grupo ou possua mais de um vínculo, quando aplicável" (R4).                                                              | **Direcionamento recebido, ambíguo.** Em empresas diferentes, já é compatível com o índice atual, desde que a pessoa seja reconhecida (lacuna). Mais de um ativo **na mesma empresa** a R4 não afirma; depende de decisão explícita. `DP-FLX-09`. |
| **Solicitação de admissão** | O gestor "poderá solicitar a contratação" (R7), com aprovações (R8), como primeira etapa (R9).                                                                                          | Não existe; o gestor hoje não registra nem solicitação (conflito). `DP-FLX-02`, `DP-FLX-03`.                                                                                                                                                      |
| **Admissão em andamento**   | O sistema deve diferenciar admissão prevista e admissão em andamento, para que uma pessoa em processo não seja tratada como ativa (R11); há devolução e cancelamento (R12).             | Hoje é só vínculo `previsto` e movimentação `solicitada` (lacuna). `DP-FLX-04`.                                                                                                                                                                   |
| **Admissão efetivada**      | Confirmação da admissão pelo RH/DP (R11); a matrícula é gerada na efetivação (R10).                                                                                                     | A matrícula hoje nasce na admissão (conflito). `DP-FLX-10`.                                                                                                                                                                                       |
| **Vínculo ativo**           | Passa a ativo "respeitando a data de início do vínculo" (R11); admissão efetivada e vínculo ativo são distintos (R11).                                                                  | Hoje a efetivação é recusada antes da vigência e ativa no mesmo ato (lacuna). `DP-FLX-04`.                                                                                                                                                        |
| **Movimentação futura**     | Vigência futura; "não deverá modificar os dados vigentes antes da data"; registra solicitação, aprovação e vigência (R18).                                                              | Convergente na vigência; aprovação não existe (conflito). `DP-FLX-03`, `DP-FLX-11`.                                                                                                                                                               |
| **Correção**                | Correção cadastral simples com fluxo simplificado (R17); retroativa justificada, com motivo, responsável, valores anteriores e posteriores e análise do DP quando houver impacto (R19). | Conflitos condicionais (justificativa e antes/depois). `DP-FLX-11`.                                                                                                                                                                               |
| **Desligamento**            | Solicitação, aprovação e efetivação "deverão ser etapas distintas" (R22), com checklist (R27) e dados por tipo (R24).                                                                   | Conflitos e lacunas. `DP-FLX-12`, `DP-FLX-19`.                                                                                                                                                                                                    |

Também é fato recebido: o identificador **provisório**, se existir antes da
efetivação, "não deverá ser confundido com a matrícula definitiva" (R10); e o CPF
não deve ser "somente" o identificador do vínculo (R37).

### 3. Papéis no fluxo

**Gestor — solicitar não é criar, editar, aprovar nem efetivar.**

- Fato recebido: o gestor **solicita** a contratação (R7), alterações (R17) e o
  desligamento (R21). As respostas não dizem que ele cria, edita ou efetiva
  pessoa, vínculo ou movimentação: isso continua com RH/DP (R7, R11, R22).
- Fato recebido: a R8 inclui a "aprovação do gestor solicitante" entre as
  aprovações. Aprovar é um ato **distinto** de solicitar, e exige decisão
  **específica**, dentro de `DP-FLX-02` e `DP-FLX-03`.
- Conflito técnico: hoje o gestor não registra nem solicitação. A Central de
  Solicitações o nega, porque "consultivo [...] não aprova, não recusa e não
  altera registro trabalhista" (`apps/api/src/auth/authorization/rbac.evaluator.ts:583-586`),
  e a ADR 0015 não aprovou "qualquer mutação pelo gestor"
  (ADR 0015, linhas 197-198).
- **Enquanto não houver decisão e alteração própria de RBAC, o gestor continua
  sem nenhuma mutação**, inclusive registrar solicitação.
- Fato recebido: ele vê só o necessário à sua atuação, como status, data
  prevista, pendências sob sua responsabilidade e tarefas de transição (R29), e
  o pertinente à sua equipe (R31). Ampliar a projeção atual é `DP-FLX-19`.

**RH, RH/DP e DP.** Fato recebido:

- o **RH** recebe, confere e conduz admissão e desligamento (R7, R22), pode
  devolver para correção (R12) e pode iniciar desligamento quando houver
  solicitação formal da diretoria ou outra situação autorizada (R21);
- **RH/DP** efetivam admissão e desligamento depois das aprovações (R11, R22);
- o **DP** analisa correções com impacto em folha, obrigações legais ou eSocial
  (R19, R28) e valida a classificação dos motivos de desligamento (R23);
- a tabela de temporalidade é validada "com o DP e o jurídico" (R35).

**Diretoria.** Fato recebido: aprova quando as regras internas, o orçamento ou o
nível da vaga exigirem (R8, R17, R22); a aprovação financeira depende da
estrutura de alçadas de cada empresa (R8). Conflito técnico: hoje a diretoria
**não existe como papel** e é "escalonamento excepcional [que] acontece fora do
sistema" (`rbac.evaluator.ts:592-593`), coerente com a `PD-SOL-01` ("Diretoria é
escalonamento excepcional"). A R8 a põe como etapa de aprovação. `DP-FLX-03`.

**TI.** Fato recebido:

- a TI executa o encerramento técnico de acessos mediante comunicação formal do
  RH (R27);
- a TI administra acessos técnicos "sem acesso irrestrito ao **conteúdo dos
  documentos** por padrão" (R31).

Reconciliação: a R31 trata de **conteúdo documental**, e hoje não existe conteúdo
documental no Evolli, só metadado (ADR 0011). A exceção já aprovada do
`master_tecnico` — leitura e edição dos **contatos do colaborador**, classe A2,
em qualquer empresa, auditadas (ADR 0012, Emenda 1) — **não é conteúdo
documental** e **continua exatamente como está**: esta ADR não a amplia nem a
revoga. Se o princípio de menor privilégio da R31 exige reavaliá-la no futuro é
decisão pendente, `DP-FLX-20`.

### 4. Princípios recebidos das respostas

São fatos recebidos. Cada um só vira regra do sistema pelo gate correspondente.

1. **Obrigatoriedade variável.** O que é obrigatório varia por tipo de vínculo,
   empresa, cargo e etapa (R1 a R3, R5, R13, R14, R24), e a estrutura
   organizacional é configurável por empresa (R5). `DP-FLX-07`, `DP-FLX-08`.
2. **Histórico sem apagamento.** Vínculos, cargos, remunerações, jornadas,
   gestores, departamentos, empresas, vigências, aprovações, documentos
   contratuais, cancelamentos, devoluções, correções, responsáveis e datas
   nunca são apagados; correção preserva a rastreabilidade (R20).
3. **Menor privilégio.** Cada informação é vista só por quem precisa dela (R31);
   saúde é categoria própria e restrita (R32); dados bancários, sindicais e de
   dependentes têm acesso restrito por função (R6).
4. **Sem automatismo que a regra não validou.** Envio de documento não é
   aprovação (R33); pendência de devolução de equipamento não bloqueia a
   conclusão trabalhista nem gera desconto automático sem regra validada (R26);
   nenhum documento é excluído automaticamente sem política aprovada (R35).
5. **Folha como fonte oficial na transição.** O sistema de folha atual continua
   fonte oficial para os dados da folha e das obrigações legais até a migração
   ser formalmente validada; o Evolli organiza processos, solicitações,
   aprovações, documentos e históricos; e a fonte oficial de cada dado fica no
   plano de implantação (R40). `DP-FLX-17`.

### 5. Declarações expressas desta tarefa

1. **O colaborador não terá autopreenchimento nesta etapa.** O envio e a
   substituição de documentos pelo próprio colaborador são etapa futura (R33),
   e a ADR 0016 (decisão 5.3) segue valendo: nenhum link, convite,
   autopreenchimento ou acesso do papel `colaborador`.
2. **O gestor não recebe acesso a dados pessoais, bancários, médicos ou
   contratuais restritos.** Isso coincide com R29, R31 e R32 e com a ADR 0015
   ("Nunca saem" para o gestor remuneração, documentos pessoais e informação
   médica). Que o gestor passe a **solicitar** é outra questão, tratada como
   conflito no diagnóstico, e não está decidida aqui.
3. **Não há, nesta tarefa,** upload documental, integração de folha,
   notificação operacional, exportação ou exclusão.
4. **Nenhuma mudança está autorizada** em RBAC, API, schema, migration, banco,
   seed, Docker ou interface.

### 6. Diretriz de UX proposta pelo proprietário

**Proposta de UX do proprietário, registrada em 2026-10-19. Não autoriza
implementação.** Ela não vem das respostas de RH/DP: é uma diretriz de
experiência entregue pelo proprietário na mesma tarefa, e entra aqui com
camada própria. Aceitá-la é `DP-FLX-21`; nada nela cria, migra ou remove tela,
rota, modal, campo ou componente.

1. **Cadastro completo e admissão em tela própria.** O cadastro completo de
   colaborador e o fluxo de admissão usam **tela própria, em rota dedicada**;
   não usam modal.
2. **Modal só para o que é curto.** Modal fica restrito a consulta rápida,
   confirmação, seleção curta ou edição pontual autorizada — nunca a formulário
   extenso nem a processo com etapas.
3. **O mesmo princípio nos demais módulos.** Cadastros extensos de horários,
   jornadas, estrutura organizacional e demais módulos também usam tela
   própria.
4. **Admissão progressiva, em grupos de referência.** A futura tela de admissão
   será progressiva e organizada, como **referência funcional**, nestes grupos:
   Dados pessoais; Endereço; Contatos; Dados contratuais; Documentos; Fuso
   horário; Dados adicionais; Dependentes.
5. **Organização não é autorização.** Essa organização **não autoriza criar,
   exibir ou exigir campo algum**. Cada grupo só pode ser materializado depois
   dos seus gates, fichas de tratamento, contratos e decisões aprovadas (ver o
   diagnóstico, 3.13).
6. **Imagens de referência só para agrupamento.** Imagens de referência servem
   apenas para agrupamento, clareza e hierarquia de UX. Não se copia marca,
   texto, identidade visual, paleta, layout, ícone ou componente de terceiros.

**Conflito técnico:** os itens 1 a 3 contrariam a direção visual **aprovada
pelo proprietário** na T142 ("Cadastro, edição e detalhe em janelas modais"),
que está implementada em Colaboradores e é fundamento suficiente do conflito.
A fundação visual da T146 repete a regra, mas é **proposta aprovada e
congelada, ainda não integrada, e não aprova tela alguma**; ela é referência
complementar, não fundamento. Hoje a admissão e o detalhe do colaborador são
modais. Além
disso, o painel web não tem rota por URL: a navegação é estado da aplicação.
Os dois pontos ficam em `DP-FLX-21`. O grupo **Fuso horário** e o grupo
**Dados adicionais** estão "Fora de escopo" na ADR 0016 (6.7) — o fuso é tratado
ali como da operação, não da pessoa —, e ficam em `DP-FLX-22`.

## O que esta ADR **não** decide

- Nenhuma emenda às ADRs 0004, 0007, 0011, 0012, 0015 e 0016, à Baseline V1 ou a
  qualquer outra decisão fechada. Onde as respostas conflitam com elas, o
  conflito está nomeado aqui e no diagnóstico e depende de decisão própria. Em
  particular, o aceite desta ADR **não** faz do CPF um critério de
  identificação da pessoa e **não** autoriza mais de um vínculo ativo na mesma
  empresa.
- Nenhuma ficha de tratamento: CPF, data de nascimento, dados bancários,
  sindicais, dependentes, saúde e as demais categorias seguem sem ficha, e
  **sem ficha aprovada a categoria não existe** (ADR 0016, decisão 5.4).
- Nenhum estado, transição, tabela, campo, papel, permissão ou rota.
- Nenhuma capacidade nova para o gestor, nem para registrar solicitação.
- Nenhuma base legal, prazo de retenção, classificação jurídica de motivo de
  desligamento ou regra trabalhista.
- Nenhuma alçada concreta de aprovação, nem quem é "diretoria" no sistema.
- Nenhum formato de integração com a folha ou o eSocial.
- Nenhuma alteração da exceção do `master_tecnico` em contatos.
- Nenhuma tela, rota, modal ou componente: a diretriz de UX da decisão 6 é
  proposta, e a direção visual da T142, implementada, continua valendo até
  `DP-FLX-21`. Nenhum grupo da futura tela de admissão autoriza campo.

## Consequências

- O fluxo e o vocabulário passam a ter referência única. As próximas decisões
  devem ser tomadas sobre esta ADR e o diagnóstico, um gate por vez.
- Conflitos com decisões fechadas ficam **visíveis**, cada um com o gate que o
  resolve. Nenhum é resolvido por implementação.
- A ordem de fatias proposta no diagnóstico é uma **proposta**: cada fatia só
  começa com os seus gates decididos e com autorização expressa.

## Alternativas consideradas

- **Implementar direto a partir das respostas.** Recusada: várias respostas
  contrariam decisões fechadas (CPF como identificação da pessoa, matrícula na
  efetivação, aprovação, gestor solicitante), e outras são ambíguas (mais de um
  vínculo ativo na mesma empresa). Implementar seria reabrir essas decisões por
  código.
- **Registrar só o diagnóstico, sem ADR.** Recusada: o fluxo e a distinção dos
  conceitos são a referência de produto para várias fatias, e uma ADR dá a eles
  status e aceite próprios.
- **Uma ADR que já emendasse as decisões em conflito.** Recusada: cada emenda
  tem responsável, ficha ou gate próprio, e juntá-las numa só ADR esconderia o
  que está sendo reaberto.
