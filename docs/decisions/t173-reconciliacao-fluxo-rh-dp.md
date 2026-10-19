# T173 — Diagnóstico de reconciliação: admissão, vínculo e desligamento

Status: **diagnóstico documental; não autoriza implementação.**
Data: 2026-10-19.
Base: `ecf3cbebcf8e7dd856750468a42c284c5525755e` (T172, PR #164).
Fonte primária: as 40 respostas de RH/DP de 2026-10-19
([registro literal](t173-respostas-rh-dp.md)), citadas como **R1** a **R40**.
Acompanha a [ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md).

## 1. Método

Cada tema das respostas foi confrontado com o **modelo atual** (schema, DTOs,
validações e matriz RBAC) e com as **decisões registradas** (ADRs, Baseline V1 e
decisões de tarefa). Nenhuma fonte externa foi usada e nenhuma interpretação
jurídica foi feita. Citações de código e documentos seguem o formato
`caminho:linha`.

Cada ponto recebe uma situação:

| Situação                         | Significado                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Convergente**                  | A resposta confirma o que o modelo ou uma decisão já faz.                                                      |
| **Lacuna**                       | O modelo não tem o que a resposta pede, e nenhuma decisão fechada o proíbe.                                    |
| **Conflito**                     | A resposta contraria uma **decisão fechada**. Exige emenda formal antes de qualquer código.                    |
| **Insumo**                       | A resposta informa uma **pendência já aberta**. A pendência continua aberta até decisão formal do responsável. |
| **Conflito condicional**         | Só há conflito numa das leituras possíveis da resposta, ou da decisão. A leitura cabe ao responsável do gate.  |
| **Divergência de comportamento** | A resposta diverge do que o código faz hoje, sem decisão fechada que imponha esse comportamento.               |
| **Tensão**                       | A resposta e uma decisão fechada de outro escopo apontam em direções diferentes, sem contradição direta.       |

O diagnóstico **não resolve** nenhum conflito nem fecha nenhuma pendência. Cada
item aponta o gate (`DP-FLX-xx`, seção 4) que precisa ser decidido.

Abreviações de caminho: `schema` = `apps/api/prisma/schema.prisma`; `dto` =
`apps/api/src/pessoas/dto/pessoas.dto.ts`; `validacao` =
`apps/api/src/pessoas/validacao-pessoas.util.ts`; `rbac` =
`apps/api/src/auth/authorization/rbac.evaluator.ts`; `A7`, `A11`, `A15` e `A16`
= ADRs 0007, 0011, 0015 e 0016 em `docs/adr/`; `BV1` =
`docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md`.

## 2. Os conceitos da ADR 0017 no modelo atual

| Conceito (ADR 0017, decisão 2) | Hoje no modelo                                                                                                                                                                                       | Situação                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Pessoa, cadastro único         | `Colaborador` só com `nome` e `situacao` (`schema:983`). Sem identificador pessoal, a mesma pessoa admitida em duas empresas vira **dois** colaboradores (`A16:184-192`; `dto:166-171`).             | **Conflito** e **Lacuna** (3.1, 3.3)                                                                             |
| Vínculo contratual             | `VinculoFuncional` com empresa, matrícula, tipo, situação e datas (`schema:1038`). Sem remuneração (`schema:896`), sem gestor próprio (gestor vem da equipe, `A15:52-57`) e sem local de trabalho.   | **Lacuna parcial** (remuneração, local de trabalho) e **conflito condicional** (gestor próprio do vínculo) (3.7) |
| Solicitação de admissão        | Não existe. A Central de Solicitações não tem tipo de admissão (`schema:1660`), o gestor não faz mutação (`A15:197-198`) e é negado até na Central (`rbac:583-586`).                                 | **Lacuna** e **Conflito** (3.4)                                                                                  |
| Admissão em andamento          | Representada só por vínculo `previsto` e movimentação `admissao` `solicitada` ou `programada` (`schema:930`, `schema:948`). Não há etapas, devolução nem status por etapa.                           | **Lacuna** (gate `DP-FLX-04`)                                                                                    |
| Admissão efetivada             | A efetivação existe, por ato explícito do RH/DP (`A7:115-118`).                                                                                                                                      | **Convergente**                                                                                                  |
| Vínculo ativo                  | A efetivação é **recusada antes da data de vigência** (`validacao:247-253`) e torna o vínculo `ativo` no mesmo ato. "Efetivada, aguardando início" não é representável.                              | **Lacuna** (gate `DP-FLX-04`)                                                                                    |
| Movimentação futura            | `programada` existe, sem efetivação automática (`A7:424`), e o dado vigente só muda na efetivação.                                                                                                   | **Convergente**; aprovação ausente (3.8)                                                                         |
| Correção                       | Retificação append-only de movimentação (`A7:107-113`). Admissão efetivada sem correção viável (T166, D8). O nome é sobrescrito (`apps/api/src/pessoas/colaborador/colaborador.service.ts:336-338`). | **Convergente**, **Conflito** condicional e **divergência de comportamento** (3.8)                               |
| Desligamento                   | Movimentação `desligamento` com motivo `encerramento_de_vinculo`, registrada e efetivada direto pelo RH/DP.                                                                                          | **Lacuna** e **Conflito** (3.9)                                                                                  |

## 3. Confronto por tema

### 3.1 CPF obrigatório no cadastro inicial

**As respostas:** o cadastro inicial exige nome completo, **CPF**, data de
nascimento, telefone **ou** e-mail e tipo de vínculo pretendido; a abertura de
vínculo exige ainda empresa e cargo (R1). A R1 torna o CPF **obrigatório**; ela
não diz como ele é usado. Quem fala em identificação é só a R37: "O CPF poderá
ser utilizado para identificar a pessoa, com os cuidados necessários de
segurança e proteção de dados", e nunca somente como identificador do vínculo.

**Hoje:**

- CPF, data de nascimento, telefone e e-mail estão fora da lista fechada de
  dados aprovados (`schema:894`; `BV1:43-47`). Qualquer dado além dos quatro
  aprovados exige decisão própria (`BV1:60-62`).
- "Documento pessoal (CPF ou qualquer outro) não é chave primária, natural, **de
  unicidade**, nem componente de rota — em nenhuma hipótese" (`A7:67-70`).
- Na ADR 0016, CPF é **Identificação documental, classe A3, "Complementar"**
  (`A16:483`). Estão pendentes: se o CPF passa a ser exigido para admitir
  (`DP-ADM-04`, `A16:623`); como detectar admissão duplicada sem usar documento
  como chave (`DP-ADM-05`); a proteção em repouso (`DP-ADM-13`); e o MFA
  imposto para documento pessoal (decisão 5.9, `A16:283-292`; `DP-ADM-07`).
- Sem ficha aprovada, a categoria não existe (`A16:261`).
- Data de nascimento é **Perfil pessoal, A2**, também sem ficha (`A16:120-133`).
- Contatos: a ficha da T169 aprovou e-mail pessoal, celular e telefone, e **os
  três são obrigatórios** juntos
  (`apps/api/src/pessoas/contatos/contato-colaborador.dto.ts:20`). Eles são
  registrados **depois** da admissão, nunca nela.

**Situação:**

- **Conflito** com `A7:67-70`, se o CPF for usado para reconhecer a mesma pessoa,
  como a R37 admite e o cadastro pessoal único da R4 pressupõe. Reconhecer é
  tratar o CPF como critério de unicidade da pessoa, e a ADR 0016 já registra
  que detectar duplicidade por CPF "exigiria emenda" (`A16:279-282`). Este
  diagnóstico **não** resolve o conflito: a emenda, se houver, é `DP-FLX-05`.
- **Lacuna**, não conflito, na obrigatoriedade da R1: coletar CPF exige ficha
  aprovada e decisão própria (`BV1:60-62`; `A16:261`), um caminho já previsto.
- **Insumo** para `DP-ADM-04` e `DP-ADM-05`.
- **Divergência** com a T169: R1 pede telefone **ou** e-mail no cadastro inicial;
  hoje o contato não entra na admissão, e quando entra exige os três campos.

**Gates:** `DP-FLX-05` (CPF) e `DP-FLX-06` (demais dados do cadastro inicial).

### 3.2 Matrícula definitiva apenas na efetivação

**As respostas:** a matrícula é gerada na efetivação, conforme a regra do sistema
de folha; um identificador provisório anterior não se confunde com ela (R10). O
vínculo tem identificador próprio, matrícula ou código interno (R37).

**Hoje:**

- A matrícula é **informada pelo RH no ato da admissão** e é obrigatória
  (`dto:143-155`), no formato `^[A-Z0-9_-]{2,32}$` (`dto:31`).
- É única por empresa (`schema:1033`; `BV1`, decisão 2, que resolve DP-22) e
  imutável: o vínculo não tem `PATCH` (`A16:453`; T166).
- É coluna obrigatória do vínculo: "`matricula` vive em `vinculo_funcional`,
  única por empresa" (`A7:352-353`, Emenda 1).
- Não há geração automática, nem regra vinda de outro sistema.
- O vínculo nasce **junto** da admissão, com matrícula, por decisão fechada:
  admissão atômica, sem colaborador órfão (`BV1:441-446`, decisão 15).

**Situação:** **Conflito** com a `BV1` **decisão 15** (admissão atômica, que cria
o vínculo na admissão) somada à matrícula obrigatória do vínculo (`dto:143-155`;
`schema:1033`; `A7:352-353`). Se a matrícula só nasce na efetivação, ou o vínculo
deixa de nascer na admissão, ou passa a existir sem matrícula definitiva; os dois
caminhos reabrem a decisão 15. A **decisão 2** (matrícula funcional, única por
empresa) **não** é contrariada: a R10 muda o momento da matrícula, não a sua
unicidade, e a R37 confirma o identificador próprio do vínculo. A "regra do
sistema de folha" (R10) não é conhecida neste repositório.

**Gate:** `DP-FLX-10`.

### 3.3 Múltiplos vínculos ativos

**As respostas:** à pergunta "Um colaborador poderá possuir mais de um vínculo
ativo?", a R4 responde "Sim" e explica: a pessoa pode estar vinculada "a mais de
uma empresa do grupo ou possua mais de um vínculo, quando aplicável". O cadastro
pessoal é único e cada vínculo tem contrato, empresa, cargo, remuneração,
jornada, gestor e situação próprios (R4, R37).

**A resposta é ambígua quanto à mesma empresa.** O trecho "mais de uma empresa do
grupo" é explícito. O trecho "possua mais de um vínculo, quando aplicável" pode ou não incluir dois
vínculos ativos na **mesma** empresa; a resposta não diz, e este diagnóstico não
presume.

**Hoje:**

- "No máximo um vínculo funcional ativo por Colaborador e Empresa nesta V1"
  (`BV1:83-84`, decisão 3, que resolve DP-12; `A7:74-78`), garantido pelo índice
  único parcial `vinculo_funcional_ativo_unico`
  (`apps/api/prisma/migrations/20260807120000_colaboradores_vida_funcional/migration.sql:340-346`).
- "Duplo vínculo" está **fora de escopo**, porque a semântica trabalhista e
  fiscal não foi decidida (`A16:460`, `DP-18`).
- Entre empresas, a pessoa não é reconhecida: cada admissão cria outro
  `Colaborador`, e "unificá-los é decisão separada" (`A16:184-192`).
- Contatos e perfil ficam atrelados a (colaborador, empresa) (`A16:184-192`). A
  situação do colaborador agrega todos os vínculos e por isso **nunca** sai para
  o gestor (`A15:122-126`).

**Situação:**

- **Em empresas diferentes: compatível com o índice atual, com lacuna.** O
  índice é por (colaborador, empresa), então vínculos ativos da mesma pessoa em
  empresas diferentes **não** o violam. O que falta é **reconhecer** a mesma
  pessoa, sem o que cada empresa cria outro `Colaborador`. Isso depende do gate
  do CPF (3.1, `DP-FLX-05`).
- **Na mesma empresa: hipótese, não afirmação da R4.** Se a decisão vier a
  admitir mais de um vínculo ativo na mesma empresa, ela entra em **conflito**
  com `BV1` decisão 3, `A7:74-78` e o índice `vinculo_funcional_ativo_unico`, e
  esbarra no "duplo vínculo" fora de escopo (`A16:460`). Essa hipótese só existe
  por **decisão explícita**.

**Gate:** `DP-FLX-09`.

### 3.4 Gestor solicita; RH/DP conduz e efetiva; aprovações

**As respostas:** o gestor **solicita** a contratação (R7), alterações (R17) e o
desligamento (R21). O RH recebe, confere e conduz (R7, R22). Há aprovação do
gestor solicitante, validação do RH e diretoria quando exigida; a aprovação
financeira depende da estrutura de alçadas da empresa (R8, R17, R22). RH/DP
efetivam (R11, R22), e solicitação, aprovação e efetivação são etapas distintas
(R22).

**Quatro atos distintos.** As respostas dão ao gestor dois deles e deixam dois
com RH/DP. Este diagnóstico os separa porque cada um tem situação própria:

| Ato do gestor                                       | O que as respostas dizem             | Hoje                                             |
| --------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| **Solicitar** (registrar o pedido)                  | Sim (R7, R17, R21)                   | Negado, inclusive na Central (`rbac:583-586`)    |
| **Aprovar** o que solicitou                         | Sim, como uma das aprovações (R8)    | Negado: consultivo "não aprova" (`rbac:583-586`) |
| **Criar ou editar** pessoa, vínculo ou movimentação | Não dizem; quem conduz é o RH (R7)   | Negado (`rbac:372-378`)                          |
| **Efetivar**                                        | Não; quem efetiva é RH/DP (R11, R22) | Negado; só RH/DP efetivam (`A7:115-118`)         |

**Hoje:**

- O gestor é consultivo. A ADR 0015 lista como não aprovada "**qualquer mutação
  pelo gestor** — `PD-SOL-01` o fixou como consultivo, e nada aqui o altera"
  (`A15:197-198`). A matriz nega `gestor` em toda a superfície administrativa de
  Pessoas (`rbac:372-378`).
- Ele é negado **até na Central de Solicitações**, porque "consultivo não é uma
  capacidade de RBAC: ele não aprova, não recusa e não altera registro
  trabalhista" (`rbac:583-586`). Registrar uma solicitação já é escrita, e hoje
  ele não a tem.
- A T166 já registrou a divergência como achado aberto **D5**: a especificação
  diz que o gestor inicia a solicitação de admissão (`.specify/spec.md:112-113`),
  enquanto a `PD-SOL-01` o fixa como consultivo.
- Aprovação: "não implementar workflow de aprovação nesta V1" (`BV1:165-170`,
  decisão 7, que resolve DP-17; `A7:115-118`). `StatusMovimentacao` não tem
  `aprovada` nem `rejeitada` (`schema:945`).
- Diretoria: "não existe como papel: escalonamento excepcional acontece fora do
  sistema e não vira endpoint nem capacidade" (`rbac:592-593`), coerente com a
  `PD-SOL-01`: "Diretoria é escalonamento excepcional; até matriz mais
  detalhada, a decisão operacional final permanece com RH"
  (`docs/decisions/pacote-decisao-solicitacoes-pessoas.md:108-111`). A
  `PD-SOL-01` foi aprovada em 2026-09-29 por RH, Jurídico, Produto, Diretoria e
  TI/Segurança (mesmo arquivo, linhas 3-6).
- O papel `financeiro` não tem nenhum acesso a Pessoas (`rbac:381-382`).
- RH e DP efetivam: `A7:115-118`; `BV1` decisão 12.

**Situação:**

- **Conflito** com `A15:197-198`, a `PD-SOL-01` e a negação em `rbac:583-586`,
  quanto ao gestor **registrar** solicitação. R7 é **insumo** para fechar o D5 da
  T166.
- **Conflito** com os mesmos três pontos quanto ao gestor **aprovar** (R8). É decisão
  específica, separada da solicitação.
- **Conflito** com `BV1` decisão 7 e `A7:115-118` na aprovação por alçada.
- **Tensão** entre a diretoria como escalonamento excepcional fora do sistema
  (`PD-SOL-01`; `rbac:592-593`) e a diretoria como etapa de aprovação (R8).
- **Lacuna** de alçada financeira.
- **Convergente** em criar, editar e efetivar, que continuam com RH/DP.

**Enquanto não houver decisão e alteração própria de RBAC, o gestor continua sem
nenhuma mutação**, inclusive registrar solicitação.

**Gates:** `DP-FLX-02` (gestor solicitante e gestor aprovador) e `DP-FLX-03`
(alçadas e diretoria).

### 3.5 Tipos iniciais de vínculo

**As respostas:** CLT, estagiário, aprendiz, temporário, autônomo, sócio e
prestador de serviços, conforme os vínculos efetivamente usados. Campos e
documentos obrigatórios variam por tipo (R3).

**Hoje:**

- O catálogo é fechado: `clt`, `estagio`, `pj`, `temporario` e
  `outro_controlado` (`schema:919-925`; `A7:82-86`; `BV1`, decisão 4, que
  resolve DP-13).
- "Nenhum tipo altera comportamento do sistema" (`A7:82-86`).
- A modalidade contratual (prazo, experiência, término) está pendente e não é
  presumida igual ao tipo de vínculo (`DP-ADM-10`, `A16:472-477`).

| Resposta (R3) | No catálogo atual  | Observação                                               |
| ------------- | ------------------ | -------------------------------------------------------- |
| CLT           | `clt`              | —                                                        |
| Estagiário    | `estagio`          | —                                                        |
| Temporário    | `temporario`       | —                                                        |
| Aprendiz      | ausente            | —                                                        |
| Autônomo      | ausente            | —                                                        |
| Sócio         | ausente            | —                                                        |
| Prestador     | `pj`?              | A equivalência não está decidida e não é presumida aqui. |
| —             | `outro_controlado` | Valor de escape; destino não decidido pelas respostas.   |

**Situação:**

- **Lacuna** de três tipos e da equivalência entre prestador e `pj`.
- **Conflito condicional** com `A7:82-86`. A R3 faz o tipo determinar campos e
  documentos obrigatórios. A decisão diz que "nenhum tipo altera comportamento do
  sistema", mas enumera o que entende por isso: "sem cálculo de direito, saldo,
  período aquisitivo/concessivo, rescisão ou enquadramento legal". Se
  obrigatoriedade de campo e de documento estiver dentro desse "comportamento",
  há conflito; se a decisão só alcança os cálculos e enquadramentos enumerados,
  não há. A leitura é do responsável por `DP-FLX-07`, não deste diagnóstico.
- Nota sobre a `DP-29`: nos documentos da Fatia 2, a `DP-29` é o catálogo de
  **motivos** (`BV1`, decisão 11). No Spec Kit, ela aparece como "se
  `outro_controlado` vale para admissão", no catálogo de motivos de admissão
  (`dto:63-76`). As respostas não tratam disso, e a `DP-29` segue como está.

**Gate:** `DP-FLX-07`.

### 3.6 Obrigatoriedade variável por tipo, empresa, cargo e etapa

**As respostas:** o mínimo no cadastro inicial e o restante até a efetivação (R1,
R2). Campos e documentos variam por tipo (R3), a estrutura é configurável por
empresa (R5), o checklist é configurável por empresa e tipo com exigências por
cargo (R13, R14), e os dados do desligamento variam pelo tipo de desligamento
(R24).

**Hoje:**

- Não existe nenhum mecanismo de configuração de obrigatoriedade.
- Quais campos organizacionais são obrigatórios segue aberto (`DP-28`, `dto:104`;
  `BV1`, decisão 10).
- Documentos por tipo de vínculo (`DP-2E-11`) e documento como pré-condição da
  efetivação (`DP-2E-10`) estão pendentes
  (`docs/decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md:120-121`).
- A ADR 0016 exige finalidade declarada por campo antes da coleta
  (`A16:97-105`).

**Situação:** **Lacuna**, e **insumo** para `DP-28`, `DP-2E-10` e `DP-2E-11`.

**Gate:** `DP-FLX-08`.

### 3.7 Empresa, cargo, departamento, gestor, local de trabalho e vínculo

**As respostas:** obrigatórios: empresa, cargo, departamento, gestor
responsável, local de trabalho e tipo de vínculo. Quando aplicáveis: unidade,
equipe, centro de custo, jornada e horário (R5).

**Hoje:**

- Empresa e tipo estão no vínculo.
- Unidade, departamento, área, equipe, cargo e centro de custo estão na alocação
  organizacional, todos opcionais e com ao menos um exigido
  (`schema:1097`; `dto:104`).
- Não existe "local de trabalho". `DP-ADM-08` pergunta só se filial é a unidade
  organizacional.
- O gestor **não é atributo do vínculo**: deriva da equipe, por atribuição
  explícita, e "a unidade de subordinação é a **equipe**" (`A15:52-57`;
  `schema:1930`).
- O horário liga-se a (colaborador, empresa), e ligá-lo ao vínculo é
  `DP-ADM-17`.

**Situação:**

- **Convergente** em empresa, tipo, cargo e departamento, que já existem.
- **Lacuna** em local de trabalho.
- **Conflito** com `A15:52-57`, se "gestor responsável" for um atributo do
  vínculo, e não a equipe.
- **Insumo** para `DP-28` e `DP-ADM-17`.

**Gate:** `DP-FLX-08`.

### 3.8 Alterações futuras, correções retroativas e histórico append-only

**As respostas:** registrar mudanças de cargo, salário, departamento, equipe,
gestor, jornada, horário, unidade, centro de custo, local de trabalho e empresa
contratante, distinguindo correção simples de movimentação com aprovação (R16,
R17). Vigência futura sem alterar o dado vigente antes da data, com datas de
solicitação, aprovação e vigência (R18). Correção retroativa justificada, por
usuário autorizado, com motivo, responsável e **valores anterior e posterior**, e
análise do DP quando afetar folha ou eSocial (R19). Nada do histórico é apagado
(R20).

**Hoje:**

- Os tipos de movimentação são só `transferencia_organizacional`,
  `mudanca_cargo` e `desligamento`, além da admissão (`schema:938-943`).
- Salário está fora (`schema:896`; `A16:450`, `DP-14` e `DP-18`), e alteração de
  jornada também (`A7:422`).
- `programada` existe; nenhuma efetivação é automática (`A7:424`); o histórico
  guarda `registradaEm`, `vigenciaInicio` e `efetivadaEm`
  (`schema:1159-1180`), mas nenhuma data de aprovação, que não existe.
- Retroatividade é admitida dentro de limites: a vigência nunca precede a
  admissão (`validacao:206-221`) e é sempre estritamente posterior à alocação
  vigente (`validacao:233-238`). Admissão efetivada não tem correção viável
  (T166, D8).
- Motivo é só código de catálogo; texto livre é recusado por decisão
  (`BV1`, decisão 11; `schema:956-962`).
- A trilha formal não guarda valores antes/depois (ADR 0004, decisão 5). A
  movimentação retificada permanece visível (`A7:107-113`), mas a correção de
  nome **sobrescreve** o valor (`colaborador.service.ts:336-338`).
- Nenhuma rota `DELETE` em nenhuma entidade (`A7:125-129`).

**Situação:**

- **Convergente** no histórico append-only, na vigência futura e na retificação
  de movimentação.
- **Lacuna** nos tipos de alteração e na data de aprovação.
- **Conflito** com `BV1` decisão 11, se a "justificativa" de R12, R19, R21 e R28
  for texto livre. Pode não ser: a resposta não diz.
- **Regra formal de auditoria — conflito condicional.** A ADR 0004, decisão 5,
  manda a trilha formal guardar metadados seguros, **sem** valores antes/depois.
  Se os "valores anteriores e posteriores" da R19 tiverem de ficar **nessa
  trilha**, há conflito. A R19 não diz onde eles ficam; guardá-los no histórico
  do próprio negócio, como a retificação de movimentação já faz, não conflita
  com a decisão 5.
- **Comportamento atual da correção de nome — divergência, não conflito com
  decisão fechada.** O `PATCH` de nome sobrescreve o valor
  (`colaborador.service.ts:336-338`), e a trilha registra o ato sem o valor
  anterior. Isso diverge da R20 ("alterações cadastrais que afetem os registros
  oficiais" nunca apagadas), mas nenhuma decisão fechada citada aqui exige o
  sobrescrever: é comportamento de código, tratado em `DP-FLX-11`.

**Gate:** `DP-FLX-11`.

### 3.9 Desligamento com solicitação, aprovação, efetivação e checklist

**As respostas:** o gestor solicita com justificativa, e o RH inicia quando
houver solicitação formal da diretoria (R21). Aprovação por alçada; RH/DP
conduzem e efetivam, em etapas distintas (R22). Motivos em lista configurável,
inclusive pedido de demissão, dispensa com e sem justa causa e as demais da
resposta, com classificação validada pelo DP (R23). Campos por tipo: data de
comunicação, último dia trabalhado, aviso-prévio, informações para o cálculo
rescisório (R24). Oito etapas (R25). Pendências legais ou operacionais geram
alerta ou bloqueio específico; devolução de equipamento e encerramento de acesso
ficam no checklist sem bloquear a conclusão trabalhista nem gerar desconto
automático (R26). Checklist com responsável, prazo, status e conclusão; TI
encerra acessos mediante comunicação formal (R27). Cancelamento em andamento e
correção posterior com análise do DP (R28). O gestor vê status, data prevista,
pendências e tarefas de transição (R29).

**Hoje:**

- Desligamento é uma movimentação, registrada e efetivada direto por RH/DP, com
  motivo `encerramento_de_vinculo` e `data_desligamento` no vínculo.
- Os motivos são deliberadamente organizacionais. O comentário do schema, em
  ASCII no original, diz: "Rotulos deliberadamente ORGANIZACIONAIS, nunca
  classificacao juridica", sem "justa causa" nem "pedido de demissao", porque
  isso seria "enquadramento trabalhista" (`schema:956-962`; `A7:388-390`).
- Não há aprovação (3.4), nem campos de aviso-prévio, comunicação ou último dia.
- Não há checklist: "o domínio atual não possui checklist, modelo de tarefa,
  template, responsável, prazo ou evento de conclusão"
  (`docs/decisions/t155-checklists-contratacao-desligamento-pendencias.md:20-21`).
  O recorte da T155 não está aprovado, e exclui de propósito o bloqueio da
  efetivação (`t155:36-38`).
- A projeção do gestor é fechada em nome, matrícula, situação do vínculo,
  vínculo, cargo e lotação, horário, resumo de jornada e andamento de
  solicitações (`A15:104-107`). Status de desligamento, data prevista e
  pendências não estão nela.
- O cancelamento existe para movimentação `solicitada` ou `programada`, e a
  correção depois da efetivação é retificação.

**Situação:**

- **Conflito** com `schema:956-962` e `A7:388-390` nos motivos com classificação
  trabalhista. R23 condiciona a lista à validação do DP.
- **Conflito** com `A15:197-198`, a `PD-SOL-01` e `rbac:583-586` quanto ao gestor
  **registrar** a solicitação de desligamento (R21), e com `BV1` decisão 7 na
  aprovação. Como na admissão (3.4), solicitar não é criar, editar, aprovar nem
  efetivar: a efetivação fica com RH/DP (R22), e o gestor segue sem mutação até
  decisão e RBAC próprios.
- **Conflito** com `A15:104-107` na projeção do desligamento ao gestor.
- **Lacuna** nas etapas, nos campos por tipo e no checklist.
- **Insumo** para as 12 perguntas da T155: R26 responde à pergunta 6 (o
  checklist não bloqueia a efetivação sem regra validada) e R27 à pergunta 4
  (responsáveis).

**Gates:** `DP-FLX-12` e `DP-FLX-19`.

### 3.10 Documentos por categoria, empresa, vínculo e período

**As respostas:**

- Documentos cadastrais, admissionais, contratos, termos, movimentações e
  desligamento, organizados por colaborador, **vínculo**, empresa, **categoria**
  e **período**, com controle de acesso e histórico (R30).
- Menor privilégio; TI sem acesso irrestrito ao conteúdo (R31).
- Saúde em categoria própria e restrita (R32).
- Envio pelo colaborador é etapa futura, sem aprovação automática (R33).
- Validade e alertas configuráveis (R34).
- Nenhuma exclusão automática sem política aprovada (R35).

**Hoje:**

- Só metadado, upload desabilitado por construção (`A11:143-153`;
  `schema:1355-1364`).
- O sujeito do documento é o `Colaborador`, com `empresa_id` próprio
  (`DP-2E-07`, `A11:109`; `schema:1442`). Não há vínculo nem período.
- A classificação tem um único valor, `restrito` (`DP-2E-02`;
  `schema:1372-1374`).
- Atestado não coleta diagnóstico nem CID (`PD-SOL-05`). Uma categoria
  documental separada para saúde não está decidida.
- Validade é `DP-2E-06` e documentos por tipo é `DP-2E-11`, ambos pendentes.
- O `admin_tecnico` não lê Pessoas (`A7`, decisão 10).
- O `master_tecnico`, perfil técnico global, só **lê** metadado de documento
  (`rbac:684-689`). Nos **contatos do colaborador** (classe A2), e só neles, tem
  leitura e edição em qualquer empresa, auditadas, por exceção que o
  proprietário decidiu na ficha de Contatos (ADR 0012, Emenda 1, linhas
  256-276).
- Não há exclusão física (`A11:206-212`), e nenhum fluxo apaga conteúdo antes da
  política (ADR 0013, decisão 12).

**Reconciliação da R31 com o `master_tecnico`:**

- A R31 trata de **conteúdo documental**: a TI administra acessos técnicos "sem
  acesso irrestrito ao conteúdo dos documentos por padrão".
- Hoje **não existe conteúdo documental** no Evolli, só metadado (ADR 0011,
  decisões 1 e 2). Nenhum perfil técnico tem acesso a conteúdo, porque não há
  conteúdo; a R31 é, por ora, **convergente**.
- Contatos não são documento. A exceção do `master_tecnico` em contatos A2
  **continua exatamente como está**: este diagnóstico **não a amplia nem a
  revoga**.
- Se o princípio de menor privilégio da R31, estendido a dado pessoal fora dos
  documentos, exige reavaliar essa exceção no futuro, é decisão pendente
  (`DP-FLX-20`). Até ela, nada muda.

**Situação:**

- **Conflito** com `DP-2E-07`: R30 pede vínculo e período, e o sujeito fechado é
  o colaborador.
- **Lacuna** em categoria e na separação de saúde, que tocam `DP-2E-02`.
- **Insumo** para `DP-2E-06` e `DP-2E-11`.
- **Convergente** na ausência de exclusão automática, no colaborador sem envio
  agora e na R31 frente ao conteúdo documental, que não existe.

**Gates:** `DP-FLX-14`, `DP-FLX-15` e `DP-FLX-20`.

### 3.11 O sistema de folha atual como fonte oficial na transição

**As respostas:** integração com cadastro, empresa, matrícula, cargo,
remuneração, jornada, movimentações e desligamentos, com campos definidos no
levantamento técnico do sistema de folha e status de integração (R36).
Importação da situação atual e do histórico relevante, marcados com origem e
data da carga (R38). Integração automática preferida; enquanto isso, arquivo
periódico ou lançamento manual controlado, sem duplicidade e com conferência
(R39). A folha continua fonte oficial durante a transição, e a fonte de cada dado
fica no plano de implantação (R40).

**Hoje:**

- "O Evolli não tem folha nem exportação aprovada para folha" (`A16:508-510`).
- Matrícula eSocial e código externo estão fora de escopo, dependentes de
  integração não aprovada (`A16:459`, `A16:489`; `DP-18`).
- Folha e eSocial também estão fora do recorte da T155 (`t155:37`).
- Não há registro de origem de carga, importação nem conciliação.

**Situação:**

- **Convergente** com a folha como fonte oficial: o Evolli não pretende ser fonte
  da folha.
- **Lacuna** no plano de fonte oficial por dado, na importação com origem e na
  conciliação.

**Gate:** `DP-FLX-17`.

### 3.12 Temas que as respostas abrem fora da lista principal

- **Dados bancários, sindicais e dependentes (R2, R6).** Bancário e dependentes
  estão **bloqueados** na ADR 0016 (`A16:498-512`, `A16:527-532`; `DP-14`,
  `DP-18`, `DP-ADM-14`). Dado sindical não é coberto por nenhuma decisão
  registrada. **Lacuna**. Gate `DP-FLX-16`.
- **Endereço e contato de emergência (R2).** A2, "Complementar", sem ficha
  (`A16:403-430`). **Insumo** para `DP-ADM-02` e `DP-ADM-03`. Gate `DP-FLX-06`.
- **Notificações (R15).** Não existem; a T155 as exclui do recorte
  (`t155:36-37`). **Lacuna**, fora desta tarefa. Gate `DP-FLX-18`.
- **Retenção e temporalidade (R20, R35).** Nenhum dado de pessoas tem retenção
  decidida (`A16:364-366`). Os gates `DP-15`, `DP-ADM-03`, `DP-2E-15` e
  `PD-DOC-03` seguem abertos (`A16:274-278`; `BV1`, decisão 6). A recomendação
  de uma tabela de temporalidade validada com DP e jurídico (R35) é **insumo**.
  Gate `DP-FLX-13`.
- **Autoatendimento (R33).** **Convergente** com "o funcionário não preenche"
  (`A16:233-236`) e com o Portal do Colaborador como decisão própria e futura
  (`A15:201-202`).

### 3.13 Diretriz de UX proposta pelo proprietário

**A proposta (ADR 0017, decisão 6):** cadastro completo e admissão em tela
própria e rota dedicada, sem modal; modal só para consulta rápida, confirmação,
seleção curta ou edição pontual autorizada; o mesmo princípio para horários,
jornadas, estrutura organizacional e demais cadastros extensos; admissão
progressiva em oito grupos de referência; nenhum grupo autoriza campo; imagens
de referência só para agrupamento, sem copiar nada de terceiros. **Não vem das
respostas de RH/DP** e **não autoriza implementação**.

**Hoje:**

- A direção visual aprovada pelo proprietário na T142 escolheu "**Cadastro,
  edição e detalhe em janelas modais**"
  (`docs/decisions/t142-direcao-visual-b-modais.md:46`), e a fundação visual da
  T146 — proposta aprovada e congelada pelo proprietário, **ainda não integrada,
  que não aprova tela alguma** — repete a regra: "cadastro, detalhe e
  ações operacionais usam modal — nunca drawer, nunca painel lateral, nunca
  folha inferior" (`docs/decisions/t146-arquitetura-modular-shell.md:166-167`).
- A T142 já restringe o modal a não ser usado "para filtro, navegação ou ação
  simples que não precisa de janela" (`t142-direcao-visual-b-modais.md:71-72`),
  mas o usa para cadastro.
- A admissão e o detalhe do colaborador são modais
  (`apps/web/src/screens/pessoas/ColaboradoresScreen.tsx:1294` e `:1395`).
- O painel web não tem roteamento por URL: o destino ativo é estado da
  aplicação (`apps/web/src/app/App.tsx:433`).
- A ADR 0016 já usa uma referência de mercado com os mesmos grupos "apenas como
  inventário do que foi pedido e como inspiração de agrupamento", sem
  reproduzir marca, texto, identidade visual, paleta, ícone, layout ou
  componente (`A16:80-86`). O item 6 da diretriz é **convergente** com isso.

**Os oito grupos frente ao modelo atual.** Nenhum grupo é materializável hoje
por inteiro; o que existe é só o que já foi aprovado antes.

| Grupo             | O que existe hoje                                                                                                 | Gates                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Dados pessoais    | Só o nome. CPF, data de nascimento e os demais estão fora da lista aprovada, sem ficha (3.1).                     | `DP-FLX-05`, `DP-FLX-06`                                 |
| Endereço          | Não existe. A2, "Complementar", sem ficha; CEP por serviço externo depende de `DP-ADM-12` (3.12).                 | `DP-FLX-06`                                              |
| Contatos          | E-mail pessoal, celular e telefone, pela ficha da T169, no detalhe e depois da admissão (3.1).                    | `DP-FLX-06` (contato na admissão)                        |
| Dados contratuais | Empresa, matrícula, tipo, data de admissão e alocação; sem remuneração nem modalidade contratual (3.2, 3.5, 3.7). | `DP-FLX-07`, `-08`, `-10`; `DP-ADM-10`; `DP-14`, `DP-18` |
| Documentos        | Só metadado; upload desabilitado (3.10).                                                                          | `DP-FLX-14`, `DP-FLX-15`; Nível 2 da Etapa 2             |
| Fuso horário      | "Fora de escopo": fuso único no servidor, "fuso é da operação, não da pessoa" (`A16:518-519`).                    | `DP-FLX-22`                                              |
| Dados adicionais  | "Fora de escopo" nos itens que a referência trazia, sem módulo consumidor (`A16:520-521`).                        | `DP-FLX-22`                                              |
| Dependentes       | Bloqueado (`A16:527-532`).                                                                                        | `DP-FLX-16`                                              |

**Situação:**

- **Conflito** com a T142 (item 5), aprovada pelo proprietário e implementada em
  Colaboradores, nos itens 1 a 3 da diretriz. A T146 (seção "Modais") repete a
  regra, mas é fundação visual aprovada e congelada, ainda não integrada, que não
  aprova tela: serve de referência complementar, e a T142 basta como fundamento.
- **Lacuna** de rota por URL no painel web.
- **Tensão** entre os grupos "Fuso horário" e "Dados adicionais" e a ADR 0016
  (6.7), que os põe fora de escopo por falta de decisão de produto e de
  consumidor.
- **Convergente** no item 6 (referência só para agrupamento) e no item 5
  (organização não autoriza campo), que repete a regra da ADR 0016, decisão 5.4.

**Gates:** `DP-FLX-21` e `DP-FLX-22`.

## 4. Gates anteriores a qualquer implementação

Nenhum gate abaixo está resolvido. A coluna **Responsável** separa três origens,
e só elas:

- **Respostas (R)** — quando a própria resposta de RH/DP diz quem decide ou
  valida;
- **Decisão anterior** — quando uma ADR ou decisão já registrada atribui o tema,
  como complemento, distinta do que veio das respostas;
- **Responsável a definir** — quando nem as respostas nem uma decisão anterior
  dizem quem decide.

Instrumentos, regras, planos e critérios citados nas respostas — "estrutura de
alçadas", "regra do sistema de folha", "plano de implantação" — **não são
responsáveis**: ficam na coluna **Insumos**.

| Gate        | Decisão pendente                                                                                                                                                                                                                                                                                                                           | Reabre ou depende de                                                                                                                                        | Responsável                                                                                                                                                                                                                                                                                                          | Insumos                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DP-FLX-01` | Aceite da ADR 0017.                                                                                                                                                                                                                                                                                                                        | —                                                                                                                                                           | Proprietário — **decisão anterior**: status da própria ADR e precedente de aceite da ADR 0016 (`DP-ADM-01`).                                                                                                                                                                                                         | —                                                                                                            |
| `DP-FLX-02` | Gestor **registrar** solicitação de contratação, alteração e desligamento; e, como decisão **separada**, gestor **aprovar** o que solicitou (R8). Em nenhum caso criar, editar ou efetivar. Exige alteração própria de RBAC.                                                                                                               | Emenda à ADR 0015 (`A15:197-198`) e à `PD-SOL-01`; `rbac:583-586`; fecha o D5 da T166.                                                                      | **Responsável a definir.** Decisão anterior, como complemento: a ADR 0015 foi aprovada pelo proprietário (`A15:40`), e a `PD-SOL-01` por RH, Jurídico, Produto, Diretoria e TI/Segurança (`pacote-decisao-solicitacoes-pessoas.md:3-6`).                                                                             | R7, R8, R17, R21, R22                                                                                        |
| `DP-FLX-03` | Alçadas de aprovação: gestor, RH, diretoria e financeira, por empresa; aprovação como etapa distinta da efetivação; e a diretoria, hoje escalonamento excepcional fora do sistema, como etapa de aprovação.                                                                                                                                | Emenda à `BV1` decisão 7 e à `A7` decisão 8; `rbac:592-593`; `PD-SOL-01`.                                                                                   | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | "estrutura de alçadas da empresa" e "regras internas, orçamento ou nível da vaga" (R8); R17, R22             |
| `DP-FLX-04` | Estados e transições do processo admissional: oito etapas, devolução, cancelamento, "efetivada aguardando início", correção pós-efetivação (inclui T166 D8); quem opera cada transição, inclusive as etapas 3, 6 e 7, que a ADR 0017 marca como proposta de operação.                                                                      | `BV1` decisão 15 (admissão atômica); `validacao:247-253`.                                                                                                   | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | R9, R11, R12                                                                                                 |
| `DP-FLX-05` | Ficha de tratamento do CPF: finalidade, base legal, acesso, mascaramento, proteção em repouso, retenção; e se o CPF passa a reconhecer a mesma pessoa.                                                                                                                                                                                     | Emenda à `A7:67-70`; `DP-ADM-04`, `-05`, `-07`, `-13`; ADR 0016, decisões 5.4, 5.8 e 5.9.                                                                   | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: a ficha tem responsáveis por item (`A16:245-259`) — finalidade, base legal, classificação e retenção com RH + Jurídico (ADR 0012, decisão 1); campos e perfis com proprietário + RH; proteção em repouso com Segurança (`DP-ADM-13`). | R1 (obrigatoriedade), R37 ("com os cuidados necessários de segurança e proteção de dados")                   |
| `DP-FLX-06` | Fichas das demais categorias pessoais do cadastro e da admissão: data de nascimento, endereço, contato de emergência; e o contato "telefone ou e-mail" frente aos três campos da T169.                                                                                                                                                     | `BV1:60-62`; `DP-ADM-02`, `-03`; ficha da T169.                                                                                                             | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: a mesma divisão por item da ficha (`A16:245-259`; ADR 0012, decisão 1).                                                                                                                                                               | R1, R2                                                                                                       |
| `DP-FLX-07` | Catálogo de tipos de vínculo: aprendiz, autônomo, sócio, prestador frente a `pj`, destino de `outro_controlado`; e se o tipo passa a determinar obrigatoriedade, conforme a leitura de "comportamento" na `A7:82-86`.                                                                                                                      | Emenda à `A7:82-86`, se for conflito, e à `BV1` decisão 4; `DP-ADM-10`.                                                                                     | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | "conforme os vínculos efetivamente utilizados pelas empresas" (R3)                                           |
| `DP-FLX-08` | Catálogo de campos e regras por tipo, empresa, cargo e etapa, inclusive local de trabalho e gestor por vínculo ou por equipe.                                                                                                                                                                                                              | `DP-28`; `DP-2E-10`, `-11`; `DP-ADM-08`, `-17`; `A15:52-57`.                                                                                                | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | R1 a R3, R5, R13, R14, R24                                                                                   |
| `DP-FLX-09` | Vínculos múltiplos, em duas questões separadas: (a) reconhecer a mesma pessoa em empresas diferentes, já compatível com o índice atual; (b) só por decisão explícita, se cabe mais de um vínculo ativo na **mesma** empresa — hipótese que a R4 não afirma.                                                                                | (a) depende de `DP-FLX-05` e de `A16:184-192`; (b) emenda à `BV1` decisão 3, à `A7:74-78` e ao índice `vinculo_funcional_ativo_unico`; `A16:460` (`DP-18`). | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | R4 ("quando aplicável"), R37                                                                                 |
| `DP-FLX-10` | Transição da matrícula informada na admissão para matrícula gerada na efetivação; identificador provisório; tratamento das matrículas já existentes.                                                                                                                                                                                       | `BV1` decisão 15; `dto:143-155`; `schema:1033`; `A7:352-353`. A `BV1` decisão 2 (unicidade por empresa) permanece compatível.                               | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | "conforme a regra do sistema de folha" (R10), regra não conhecida neste repositório; R37                     |
| `DP-FLX-11` | Movimentações ampliadas e correção: tipos novos, correção simples × movimentação com aprovação, forma da justificativa, onde ficam os valores antes/depois, análise do DP com impacto em eSocial, e a correção de nome que sobrescreve.                                                                                                    | `BV1` decisão 11; ADR 0004 decisão 5, se os valores tiverem de ir à trilha formal; `A7:422`; `DP-14`, `DP-18`; `colaborador.service.ts:336-338`.            | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | R16 a R20; "etapa de análise pelo DP antes da conclusão" (R19), que é etapa do processo, não decisão do gate |
| `DP-FLX-12` | Desligamento: etapas, campos por tipo, motivos com classificação trabalhista e o checklist da T155.                                                                                                                                                                                                                                        | `schema:956-962`; `A7:388-390`; T155 (perguntas 1 a 12).                                                                                                    | **Respostas (R23)**, só para a classificação dos motivos: "deverá ser validada pelo DP". Etapas, campos e checklist: **responsável a definir**.                                                                                                                                                                      | R21 a R28                                                                                                    |
| `DP-FLX-13` | Retenção, temporalidade e descarte: tabela por documento e informação, marco inicial, suspensões e descarte seguro.                                                                                                                                                                                                                        | `DP-15`, `DP-ADM-03`, `DP-2E-15`, `PD-DOC-03`, retenção de `audit_event`.                                                                                   | **Respostas (R35)**: a tabela é "validada com o DP e o jurídico". Decisão anterior, como complemento: retenção e descarte são de RH + Jurídico (ADR 0012, decisão 1; `A16:245-259`). As duas origens não coincidem, e este diagnóstico não escolhe.                                                                  | R20, R35                                                                                                     |
| `DP-FLX-14` | Documentos por vínculo, categoria e período; validade e alertas; checklist documental por tipo; upload.                                                                                                                                                                                                                                    | Emenda a `DP-2E-07`; `DP-2E-02`, `-06`, `-10`, `-11`; Nível 2 da Etapa 2; ADR 0013.                                                                         | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: `DP-2E-11` está com RH + Jurídico (`etapa2-documentos-admissao-aprovacoes-pendentes.md:121`), e classificação com RH + Jurídico (ADR 0012, decisão 1).                                                                                | R13, R14, R30, R33, R34                                                                                      |
| `DP-FLX-15` | Saúde ocupacional: categoria própria para atestados, exames e ASO, e quem acessa.                                                                                                                                                                                                                                                          | `DP-2E-02`; `PD-SOL-05`; `PD-DOC-02`; ADR 0016 (declarações sensíveis, A3).                                                                                 | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: classificação e base legal com RH + Jurídico (ADR 0012, decisão 1).                                                                                                                                                                   | R13, R32                                                                                                     |
| `DP-FLX-16` | Dados bancários, sindicais e de dependentes: campos, finalidade, base legal e acesso.                                                                                                                                                                                                                                                      | ADR 0016 (bloqueados); `DP-14`, `DP-18`, `DP-ADM-07`, `-13`, `-14`.                                                                                         | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: finalidade e base legal com RH + Jurídico (ADR 0012, decisão 1).                                                                                                                                                                      | "A obrigatoriedade e os campos específicos devem seguir os requisitos do DP e do sistema de folha" (R6); R2  |
| `DP-FLX-17` | Integração com a folha e o eSocial: fonte oficial de cada dado, importação com origem, conciliação e plano de implantação.                                                                                                                                                                                                                 | `DP-18`; `A16:459`, `A16:489`, `A16:508-510`.                                                                                                               | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | levantamento técnico do sistema de folha (R36); plano de implantação "com responsáveis" (R40); R38, R39      |
| `DP-FLX-18` | Notificações: eventos, destinatários e conteúdo mínimo por permissão.                                                                                                                                                                                                                                                                      | Exclusão da T155 (`t155:36-37`); pendência não numerada da Central.                                                                                         | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | R15                                                                                                          |
| `DP-FLX-19` | Projeção do gestor para admissão e desligamento: status, datas previstas, pendências e tarefas sob sua responsabilidade.                                                                                                                                                                                                                   | Emenda à `A15:104-107` (decisão 7).                                                                                                                         | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: a ADR 0015 foi aprovada pelo proprietário (`A15:40`).                                                                                                                                                                                 | R29, R31                                                                                                     |
| `DP-FLX-20` | Se o menor privilégio da R31 exige, no futuro, reavaliar a exceção do `master_tecnico` em contatos A2. Até a decisão, a exceção permanece **exatamente** como está.                                                                                                                                                                        | ADR 0012, Emenda 1; ficha de Contatos.                                                                                                                      | **Responsável a definir pelas respostas.** Decisão anterior, como complemento: a exceção foi decidida pelo proprietário na ficha de Contatos (ADR 0012, Emenda 1).                                                                                                                                                   | R31                                                                                                          |
| `DP-FLX-21` | Aceite da diretriz de UX: cadastro completo e admissão em tela própria e rota dedicada; modal só para o que é curto; o mesmo princípio nos demais módulos. Inclui emendar a direção visual da T142 e, se for o caso, da fundação visual da T146 (ainda não integrada), criar rota por URL no painel e decidir o destino dos modais atuais. | T142, item 5 (`t142-direcao-visual-b-modais.md:46`); T146, "Modais" (`t146-arquitetura-modular-shell.md:166-167`); `App.tsx:433`.                           | Proprietário — **decisão anterior**: a T142 foi aprovada pelo proprietário e a diretriz é proposta dele; a T146 é fundação visual aprovada e congelada, ainda não integrada.                                                                                                                                         | Diretriz de UX (ADR 0017, decisão 6)                                                                         |
| `DP-FLX-22` | Grupos "Fuso horário" e "Dados adicionais" da futura tela de admissão: se existe dado de fuso por pessoa ou por vínculo, e qual dado adicional tem finalidade e consumidor.                                                                                                                                                                | ADR 0016, 6.7 (`A16:518-521`).                                                                                                                              | **Responsável a definir.**                                                                                                                                                                                                                                                                                           | Diretriz de UX do proprietário (ADR 0017, decisão 6)                                                         |

## 5. Conflitos com decisões fechadas

O conflito 13 vem da diretriz de UX do proprietário; os demais, das respostas.
Lista consolidada, para que nenhum fique escondido em uma seção. Os itens
marcados **condicional** só são conflito numa das leituras possíveis da resposta;
a leitura cabe ao responsável do gate, não a este diagnóstico.

| #   | Resposta                                                                                                    | Decisão que contraria                                                                                        | Tipo        | Seção    | Gate                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | -------- | ------------------------ |
| 1   | CPF como identificação da pessoa (R37)                                                                      | `A7:67-70`: documento "não é chave [...] de unicidade [...] em nenhuma hipótese"                             | firme       | 3.1      | `DP-FLX-05`              |
| 2   | Matrícula só na efetivação (R10)                                                                            | `BV1` decisão 15 (admissão atômica) e matrícula obrigatória do vínculo (`dto:143-155`; `A7:352-353`)         | firme       | 3.2      | `DP-FLX-04`, `DP-FLX-10` |
| 3   | Mais de um vínculo ativo na **mesma** empresa, se vier a ser decidido — a R4 não o afirma                   | `BV1` decisão 3, `A7:74-78` e o índice `vinculo_funcional_ativo_unico`                                       | condicional | 3.3      | `DP-FLX-09`              |
| 4   | Gestor **registrar** solicitação (R7, R17, R21) e **aprovar** (R8)                                          | `A15:197-198`, `PD-SOL-01` e `rbac:583-586`                                                                  | firme       | 3.4, 3.9 | `DP-FLX-02`              |
| 5   | Aprovação por alçada (R8, R17, R22)                                                                         | `BV1` decisão 7 e `A7:115-118`                                                                               | firme       | 3.4, 3.9 | `DP-FLX-03`              |
| 6   | Tipo de vínculo que determina campos e documentos (R3)                                                      | `A7:82-86`, conforme a leitura de "comportamento"                                                            | condicional | 3.5      | `DP-FLX-07`              |
| 7   | Gestor como atributo do vínculo, se for essa a leitura de R5                                                | `A15:52-57`                                                                                                  | condicional | 3.7      | `DP-FLX-08`              |
| 8   | Justificativa em texto livre, se for essa a leitura de R12, R19, R21 e R28                                  | `BV1` decisão 11                                                                                             | condicional | 3.8      | `DP-FLX-11`              |
| 9   | Valores antes/depois **na trilha formal**, se a R19 o exigir                                                | ADR 0004, decisão 5                                                                                          | condicional | 3.8      | `DP-FLX-11`              |
| 10  | Motivos de desligamento com classificação trabalhista (R23)                                                 | `schema:956-962` e `A7:388-390`                                                                              | firme       | 3.9      | `DP-FLX-12`              |
| 11  | Projeção do desligamento ao gestor (R29)                                                                    | `A15:104-107`                                                                                                | firme       | 3.9      | `DP-FLX-19`              |
| 12  | Documento por vínculo e período (R30)                                                                       | `DP-2E-07`                                                                                                   | firme       | 3.10     | `DP-FLX-14`              |
| 13  | Cadastro completo e admissão em tela própria, sem modal (diretriz de UX do proprietário, não das respostas) | T142, item 5: cadastro, edição e detalhe em modal, implementada; a T146, ainda não integrada, repete a regra | firme       | 3.13     | `DP-FLX-21`              |

**Fora da lista, por não serem conflito com decisão fechada:**

- vínculos ativos em **empresas diferentes**: compatíveis com o índice atual, com
  lacuna de reconhecimento da pessoa (3.3);
- a correção de nome que sobrescreve o valor: **divergência de comportamento** de
  código em relação à R20 (3.8);
- a diretoria como escalonamento excepcional fora do sistema (`PD-SOL-01`, que
  trata da Central de Solicitações; `rbac:592-593`) frente à diretoria como
  etapa de aprovação (R8): **tensão**, tratada em `DP-FLX-03` (3.4);
- a R31 frente à exceção do `master_tecnico` em contatos: **convergente** hoje,
  com reavaliação futura em `DP-FLX-20` (3.10);
- os grupos "Fuso horário" e "Dados adicionais" frente à ADR 0016, 6.7:
  **tensão**, tratada em `DP-FLX-22` (3.13).

## 6. Sequência proposta de fatias

**É proposta, não autorização.** Nenhuma fatia começa automaticamente: cada uma
só começa com os seus gates decididos **e** com pedido expresso do proprietário.
A ordem põe primeiro o que reorganiza o processo sem dado pessoal novo, e deixa
para o fim o que depende de upload, de fichas de categorias A3 ou de integração
externa.

| Ordem | Fatia                                                                                                                                                                                                                                                                | Gates prévios                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Decisões, sem código: aceite da ADR 0017 e a decisão de cada um dos 13 conflitos da seção 5 (emenda, recusa ou leitura que dissolva o condicional).                                                                                                                  | `DP-FLX-01`; e os gates dos conflitos: `-02`, `-03`, `-04`, `-05`, `-07`, `-08`, `-09`, `-10`, `-11`, `-12`, `-14`, `-19`, `-21` |
| 1     | Processo de admissão como entidade própria, separada do vínculo, com etapas, devolução e cancelamento, operado só por RH/DP.                                                                                                                                         | `DP-FLX-01`, `-04`                                                                                                               |
| 2     | Identificador provisório e matrícula definitiva na efetivação; "efetivada, aguardando início" distinta de vínculo ativo.                                                                                                                                             | `DP-FLX-04`, `-10`                                                                                                               |
| 3     | Solicitação pelo gestor — registro do pedido, sem criar, editar nem efetivar — e aprovações por alçada, inclusive a do gestor solicitante se for decidida; com alteração própria de RBAC.                                                                            | `DP-FLX-02`, `-03`, `-19`                                                                                                        |
| 4     | Catálogo de tipos de vínculo e regras de obrigatoriedade configuráveis por tipo, empresa, cargo e etapa.                                                                                                                                                             | `DP-FLX-07`, `-08`                                                                                                               |
| 5     | CPF e demais dados do cadastro inicial, cada um com a sua ficha aprovada e o MFA imposto onde a ADR 0016 exige.                                                                                                                                                      | `DP-FLX-05`, `-06`; `DP-ADM-07`                                                                                                  |
| 6     | Mesma pessoa reconhecida entre empresas, com cadastro pessoal único e vínculos ativos em empresas diferentes. Mais de um ativo na **mesma** empresa só entra se `DP-FLX-09` o decidir explicitamente.                                                                | `DP-FLX-05`, `-09`; depois da fatia 5                                                                                            |
| 7     | Movimentações ampliadas (gestor, local de trabalho, jornada, empresa contratante), com aprovação e correção rastreável; salário só depois de `DP-14` e `DP-18`.                                                                                                      | `DP-FLX-03`, `-11`                                                                                                               |
| 8     | Desligamento com solicitação, aprovação, efetivação e campos por tipo.                                                                                                                                                                                               | `DP-FLX-02`, `-03`, `-12`, `-19`                                                                                                 |
| 9     | Checklists de admissão e desligamento (T155), sem bloqueio automático da efetivação sem regra validada.                                                                                                                                                              | `DP-FLX-08`, `-12`                                                                                                               |
| 10    | Bloqueados por portões externos: documentos por vínculo e categoria, upload, saúde ocupacional, bancário, sindical, dependentes, notificações, integração com folha e eSocial, autoatendimento, e os grupos "Fuso horário" e "Dados adicionais" da tela de admissão. | `DP-FLX-13` a `-18` e `DP-FLX-22`; Nível 2 da Etapa 2; Portal do Colaborador                                                     |

`DP-FLX-22` fica na fatia 10 porque fuso horário e dados adicionais não têm
decisão de produto nem módulo consumidor (ADR 0016, 6.7): é o mesmo perfil dos
itens bloqueados por portão externo. `DP-FLX-21` condiciona a forma de todas as
fatias com tela (1, 3, 5 e 8) e entra também na fatia 0.

`DP-FLX-20` não condiciona nenhuma fatia: é reavaliação futura de uma exceção
que continua valendo como está.

**Diretriz de UX.** Se `DP-FLX-21` for aceito, as fatias 1, 3, 5 e 8 passam a
usar tela própria em rota dedicada, e a admissão progressiva só ganha cada um
dos oito grupos quando os gates daquele grupo estiverem decididos (3.13). Até
lá, nenhuma tela é criada ou migrada, e os modais atuais continuam como a T142,
implementada, os aprovou.

## 7. Declarações desta tarefa

- A diretriz de UX (3.13) é **proposta do proprietário, sem autorização de
  implementação**: não cria, migra nem remove tela, rota, modal, campo ou
  componente.
- O colaborador **não** tem autopreenchimento nesta etapa.
- O gestor **não** recebe acesso a dados pessoais, bancários, médicos ou
  contratuais restritos.
- Não há, nesta tarefa, upload documental, integração de folha, notificação
  operacional, exportação ou exclusão.
- Nenhuma mudança está autorizada em RBAC, API, schema, migration, banco, seed,
  Docker ou interface.

## 8. Limites deste diagnóstico

- Lidos: o schema, os DTOs, as validações e a matriz RBAC de Pessoas; as ADRs
  0004, 0007, 0011, 0012, 0013, 0015 e 0016; a Baseline V1; e as decisões da
  T155, T165, T166, a ficha de Contatos e os pacotes do gestor e da Central.
  Nenhuma outra fonte.
- Onde uma resposta admite mais de uma leitura (por exemplo, se "justificativa"
  é texto livre, ou se "gestor responsável" é atributo do vínculo), o
  diagnóstico registra as leituras e o conflito condicional, sem escolher uma.
- A "regra do sistema de folha" para a matrícula (R10) e os campos do
  levantamento técnico (R36) não estão neste repositório.
- Nenhuma afirmação deste documento é interpretação jurídica, e nenhuma lista de
  motivo, documento ou prazo foi validada aqui.
