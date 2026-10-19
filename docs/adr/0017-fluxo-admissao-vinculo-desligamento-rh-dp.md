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
  (privacidade com RH + Jurídico),
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
alterações, desligamento, documentos e integração. Esta ADR **registra o fluxo
e os conceitos que essas respostas descrevem**, no vocabulário do Evolli. O
diagnóstico de reconciliação, que a acompanha, mostra onde as respostas
confirmam o modelo, onde revelam lacuna e onde **conflitam com decisões já
fechadas**, e lista o que precisa ser decidido antes de qualquer código.

## Decisões

### 1. O fluxo de admissão aprovado pelo RH/DP

A admissão segue oito etapas, nesta ordem (R9):

| #   | Etapa                                 | Quem atua, segundo as respostas                                                                                |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Solicitação da vaga                   | Gestor responsável solicita a contratação (R7).                                                                |
| 2   | Aprovações                            | Gestor solicitante, validação do RH e diretoria quando exigida; financeira conforme alçada da empresa (R8).    |
| 3   | Cadastro prévio do candidato          | RH, com o mínimo do cadastro inicial (R1).                                                                     |
| 4   | Envio e recebimento de documentos     | Conforme checklist configurável por empresa e tipo de vínculo, com exigências adicionais por cargo (R13, R14). |
| 5   | Conferência pelo RH/DP                | RH/DP (R9).                                                                                                    |
| 6   | Procedimentos admissionais aplicáveis | RH/DP, inclusive saúde ocupacional quando aplicável (R13).                                                     |
| 7   | Validação final                       | RH/DP (R9, R11).                                                                                               |
| 8   | Efetivação do vínculo                 | RH/DP confirma; a matrícula definitiva nasce aqui (R10, R11).                                                  |

Em qualquer etapa, o processo pode ser **devolvido para correção**, com motivo
registrado, ou **cancelado** por usuário autorizado, com justificativa e
histórico (R9, R12). Cada etapa tem status acompanhável (R9). Depois da
efetivação, correção segue fluxo específico, com responsável e alteração
registrados (R12).

Os dados são pedidos **por etapa**, não todos de uma vez: o cadastro inicial
pede só o mínimo (R1), e o restante deve estar completo **antes da efetivação**,
conforme o que se aplica a cada contratação (R2).

### 2. Os conceitos, separados

As respostas distinguem conceitos que hoje o modelo junta ou ainda não tem. Esta
ADR os fixa como **conceitos de domínio distintos**; como cada um vira (ou não)
estrutura é decisão posterior, listada no diagnóstico.

| Conceito                            | O que é, segundo as respostas                                                                                                                                                                                      | Fonte         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **Pessoa** (cadastro pessoal único) | Uma só por pessoa, identificável pelo CPF com os cuidados de segurança e proteção de dados; não pertence a empresa.                                                                                                | R4, R37       |
| **Vínculo contratual**              | A relação da pessoa com **uma** empresa, com identificador próprio (matrícula ou código interno), tipo, cargo, remuneração, jornada, gestor e situação próprios. Uma pessoa pode ter mais de um, inclusive ativos. | R4, R5, R37   |
| **Solicitação de admissão**         | O pedido de contratação (a "vaga"), feito pelo gestor, que ainda não é pessoa nem vínculo; passa por aprovação.                                                                                                    | R7, R8, R9    |
| **Admissão em andamento**           | O processo depois de aprovado: cadastro prévio, documentos, conferência e procedimentos, com devolução e cancelamento possíveis. A pessoa **não é colaboradora ativa**.                                            | R9, R11, R12  |
| **Admissão efetivada**              | O ato do RH/DP que confirma a admissão depois da validação final; gera a matrícula definitiva.                                                                                                                     | R10, R11      |
| **Vínculo ativo**                   | O vínculo efetivado **a partir da sua data de início**. Efetivar não é o mesmo que estar ativo.                                                                                                                    | R11           |
| **Movimentação futura**             | Alteração com data de vigência; não muda o dado vigente antes da data; registra solicitação, aprovação e vigência.                                                                                                 | R16, R17, R18 |
| **Correção**                        | Simples (cadastral, fluxo simplificado com registro) ou retroativa (justificada, com valores anterior e posterior e análise do DP quando houver impacto em folha ou eSocial).                                      | R17, R19      |
| **Desligamento**                    | Processo próprio, com solicitação, aprovação e efetivação em **etapas distintas**, checklist e registros por tipo.                                                                                                 | R21 a R28     |

O identificador **provisório**, se existir antes da efetivação, nunca se
confunde com a matrícula definitiva (R10). O CPF identifica a **pessoa**, nunca
sozinho o **vínculo** (R37).

### 3. Papéis no fluxo, segundo as respostas

- **Gestor** solicita contratação (R7), alterações (R17) e desligamento (R21) e
  aprova o que solicitou (R8). Vê só o necessário à sua atuação: status, datas
  previstas, pendências sob sua responsabilidade e tarefas de transição (R29),
  e informações pertinentes à sua equipe (R31).
- **RH** recebe, confere e conduz admissão e desligamento (R7, R22), pode
  devolver para correção (R12) e pode iniciar desligamento quando houver
  solicitação formal da diretoria ou outra situação autorizada (R21).
- **RH/DP** efetivam admissão e desligamento depois das aprovações (R11, R22) e
  analisam correções com impacto em folha, obrigações legais ou eSocial (R19,
  R28).
- **DP** valida a classificação dos motivos de desligamento (R23) e, com o
  jurídico, a tabela de temporalidade (R35).
- **Diretoria** aprova quando as regras internas, o orçamento ou o nível da vaga
  exigirem (R8, R17, R22); a **aprovação financeira** depende da estrutura de
  alçadas de cada empresa (R8).
- **TI** executa o encerramento técnico de acessos mediante comunicação formal
  do RH (R27) e administra acessos técnicos **sem acesso irrestrito ao conteúdo
  de documentos** (R31).

### 4. Princípios que as respostas fixam

1. **Obrigatoriedade variável.** O que é obrigatório varia por tipo de vínculo,
   empresa, cargo e etapa (R1 a R3, R5, R13, R14, R24), e a estrutura
   organizacional é configurável por empresa (R5).
2. **Histórico append-only.** Vínculos, cargos, remunerações, jornadas,
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
5. **Folha como fonte oficial na transição.** Durante a transição, o sistema de
   folha atual continua oficial para os dados da folha e das obrigações legais
   (R40); o Evolli organiza processos, solicitações, aprovações, documentos e
   históricos (R40). A fonte oficial de **cada dado** é definida no plano de
   implantação (R40).

### 5. Declarações expressas desta tarefa

1. **O colaborador não terá autopreenchimento nesta etapa.** O envio e a
   substituição de documentos pelo próprio colaborador são etapa futura (R33),
   e a ADR 0016 (decisão 5.3) segue valendo: nenhum link, convite,
   autopreenchimento ou acesso do papel `colaborador`.
2. **O gestor não recebe acesso a dados pessoais, bancários, médicos ou
   contratuais restritos.** Isso coincide com R29, R31 e R32 e com a ADR 0015
   ("nunca saem" para o gestor remuneração, documentos pessoais e informação
   médica). Que o gestor passe a **solicitar** é outra questão: é conflito com
   a ADR 0015, tratado no diagnóstico, e não está decidido aqui.
3. **Não há, nesta tarefa,** upload documental, integração de folha,
   notificação operacional, exportação ou exclusão.
4. **Nenhuma mudança está autorizada** em RBAC, API, schema, migration, banco,
   seed, Docker ou interface.

## O que esta ADR **não** decide

- Nenhuma emenda às ADRs 0004, 0007, 0011, 0012, 0015 e 0016, à Baseline V1 ou a
  qualquer outra decisão fechada. Onde as respostas conflitam com elas, o
  conflito está nomeado no diagnóstico e depende de decisão própria.
- Nenhuma ficha de tratamento: CPF, data de nascimento, dados bancários,
  sindicais, dependentes, saúde e as demais categorias seguem sem ficha, e
  **sem ficha aprovada a categoria não existe** (ADR 0016, decisão 5.4).
- Nenhum estado, transição, tabela, campo, papel, permissão ou rota.
- Nenhuma base legal, prazo de retenção, classificação jurídica de motivo de
  desligamento ou regra trabalhista.
- Nenhuma alçada concreta de aprovação, nem quem é "diretoria" no sistema.
- Nenhum formato de integração com a folha ou o eSocial.

## Consequências

- O fluxo e os conceitos passam a ter referência única. As próximas decisões
  devem ser tomadas sobre esta ADR e o diagnóstico, um gate por vez.
- Conflitos com decisões fechadas ficam **visíveis**, cada um com o gate que o
  resolve. Nenhum é resolvido por implementação.
- A ordem de fatias proposta no diagnóstico é uma **proposta**: cada fatia só
  começa com os seus gates decididos e com autorização expressa.

## Alternativas consideradas

- **Implementar direto a partir das respostas.** Recusada: várias respostas
  contrariam decisões fechadas (CPF como identificação, aprovação, gestor
  solicitante, múltiplos vínculos ativos), e implementar seria reabrir essas
  decisões por código.
- **Registrar só o diagnóstico, sem ADR.** Recusada: o fluxo e a separação dos
  conceitos são a referência de produto para várias fatias, e uma ADR dá a eles
  status e aceite próprios.
- **Uma ADR que já emendasse as decisões em conflito.** Recusada: cada emenda
  tem responsável, ficha ou gate próprio, e juntá-las numa só ADR esconderia o
  que está sendo reaberto.
