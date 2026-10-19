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

| Situação        | Significado                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| **Convergente** | A resposta confirma o que o modelo ou uma decisão já faz.                                                      |
| **Lacuna**      | O modelo não tem o que a resposta pede, e nenhuma decisão fechada o proíbe.                                    |
| **Conflito**    | A resposta contraria uma **decisão fechada**. Exige emenda formal antes de qualquer código.                    |
| **Insumo**      | A resposta informa uma **pendência já aberta**. A pendência continua aberta até decisão formal do responsável. |

O diagnóstico **não resolve** nenhum conflito nem fecha nenhuma pendência. Cada
item aponta o gate (`DP-FLX-xx`, seção 4) que precisa ser decidido.

Abreviações de caminho: `schema` = `apps/api/prisma/schema.prisma`; `dto` =
`apps/api/src/pessoas/dto/pessoas.dto.ts`; `validacao` =
`apps/api/src/pessoas/validacao-pessoas.util.ts`; `rbac` =
`apps/api/src/auth/authorization/rbac.evaluator.ts`; `A7`, `A11`, `A15` e `A16`
= ADRs 0007, 0011, 0015 e 0016 em `docs/adr/`; `BV1` =
`docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md`.

## 2. Os conceitos da ADR 0017 no modelo atual

| Conceito (ADR 0017, decisão 2) | Hoje no modelo                                                                                                                                                                                       | Situação                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Pessoa, cadastro único         | `Colaborador` só com `nome` e `situacao` (`schema:983`). Sem identificador pessoal, a mesma pessoa admitida em duas empresas vira **dois** colaboradores (`A16:184-192`; `dto:166-171`).             | **Conflito** e **Lacuna** (3.1, 3.3)     |
| Vínculo contratual             | `VinculoFuncional` com empresa, matrícula, tipo, situação e datas (`schema:1038`). Sem remuneração (`schema:896`), sem gestor próprio (gestor vem da equipe, `A15:52-57`) e sem local de trabalho.   | **Lacuna** parcial (3.7)                 |
| Solicitação de admissão        | Não existe. A Central de Solicitações não tem tipo de admissão (`schema:1660`), e o gestor não faz mutação (`A15:197-198`).                                                                          | **Lacuna** e **Conflito** (3.4)          |
| Admissão em andamento          | Representada só por vínculo `previsto` e movimentação `admissao` `solicitada` ou `programada` (`schema:930`, `schema:948`). Não há etapas, devolução nem status por etapa.                           | **Lacuna** (gate `DP-FLX-04`)            |
| Admissão efetivada             | A efetivação existe, por ato explícito do RH/DP (`A7:115-118`).                                                                                                                                      | **Convergente**                          |
| Vínculo ativo                  | A efetivação é **recusada antes da data de vigência** (`validacao:247-253`) e torna o vínculo `ativo` no mesmo ato. "Efetivada, aguardando início" não é representável.                              | **Lacuna** (gate `DP-FLX-04`)            |
| Movimentação futura            | `programada` existe, sem efetivação automática (`A7:424`), e o dado vigente só muda na efetivação.                                                                                                   | **Convergente**; aprovação ausente (3.8) |
| Correção                       | Retificação append-only de movimentação (`A7:107-113`). Admissão efetivada sem correção viável (T166, D8). O nome é sobrescrito (`apps/api/src/pessoas/colaborador/colaborador.service.ts:336-338`). | **Convergente** e **Conflito** (3.8)     |
| Desligamento                   | Movimentação `desligamento` com motivo `encerramento_de_vinculo`, registrada e efetivada direto pelo RH/DP.                                                                                          | **Lacuna** e **Conflito** (3.9)          |

## 3. Confronto por tema

### 3.1 CPF obrigatório no cadastro inicial

**As respostas:** o cadastro inicial exige nome completo, **CPF**, data de
nascimento, telefone **ou** e-mail e tipo de vínculo pretendido; a abertura de
vínculo exige ainda empresa e cargo (R1). O CPF identifica a **pessoa**, com os
cuidados de segurança e proteção de dados, e nunca sozinho o vínculo (R37).

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
  o que R4 e R37 pedem. Reconhecer é tratar o CPF como critério de unicidade da
  pessoa, e a ADR 0016 já registra que detectar duplicidade por CPF "exigiria
  emenda" (`A16:279-282`).
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
- Não há geração automática, nem regra vinda de outro sistema.
- O vínculo nasce **junto** da admissão, com matrícula, por decisão fechada:
  admissão atômica, sem colaborador órfão (`BV1:441-446`).

**Situação:** **Conflito** com a admissão atômica e com a obrigatoriedade da
matrícula na criação. Se o vínculo só pode ter matrícula na efetivação, ou o
vínculo deixa de nascer na admissão, ou passa a existir sem matrícula definitiva.
Qualquer dos dois caminhos reabre `BV1` (decisões 2 e 15). A "regra do sistema de
folha" (R10) não é conhecida neste repositório.

**Gate:** `DP-FLX-10`.

### 3.3 Múltiplos vínculos ativos

**As respostas:** uma mesma pessoa pode estar vinculada a mais de uma empresa do
grupo **ou ter mais de um vínculo**, quando aplicável. O cadastro pessoal é único
e cada vínculo tem contrato, empresa, cargo, remuneração, jornada, gestor e
situação próprios (R4, R37).

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

- **Conflito** com `BV1` decisão 3 e `A7:74-78`, para mais de um vínculo ativo
  na **mesma** empresa.
- **Lacuna** para a mesma pessoa em empresas diferentes. Depende do gate do CPF
  (3.1), porque sem identificador pessoal não há como reconhecê-la.

**Gate:** `DP-FLX-09`.

### 3.4 Gestor solicita; RH/DP conduz e efetiva; aprovações

**As respostas:** o gestor solicita contratação (R7), alterações (R17) e
desligamento (R21). O RH recebe, confere e conduz (R7, R22). Há aprovação do
gestor solicitante, validação do RH e diretoria quando exigida; a aprovação
financeira depende da estrutura de alçadas da empresa (R8, R17, R22). RH/DP
efetivam (R11, R22), e solicitação, aprovação e efetivação são etapas distintas
(R22).

**Hoje:**

- O gestor é consultivo. A ADR 0015 lista como não aprovada "**qualquer mutação
  pelo gestor** — `PD-SOL-01` o fixou como consultivo, e nada aqui o altera"
  (`A15:197-198`). A matriz nega `gestor` em toda a superfície administrativa de
  Pessoas (`rbac:372-378`).
- Só `rh` e `dp` admitem (T165, §5.2).
- A T166 já registrou a divergência como achado aberto **D5**: a especificação
  diz que o gestor inicia a solicitação de admissão (`.specify/spec.md:112-113`),
  e a T165 e a `PD-SOL-01` dizem o contrário.
- Aprovação: "não implementar workflow de aprovação nesta V1" (`BV1:165-170`,
  decisão 7, que resolve DP-17; `A7:115-118`). `StatusMovimentacao` não tem
  `aprovada` nem `rejeitada` (`schema:945`).
- Não existe papel de diretoria (`schema:26-46`). O papel `financeiro` não tem
  nenhum acesso a Pessoas (`rbac:381-382`).
- A única máquina de estados com análise do RH é a Central de Solicitações, e
  nela o RH decide e "encaminhar não é executar"
  (`docs/decisions/pacote-decisao-solicitacoes-pessoas.md:108-111`).
- RH e DP efetivam: `A7:115-118`; `BV1` decisão 12.

**Situação:**

- **Conflito** com `A15:197-198`, `PD-SOL-01` e T165 §5.2 no gestor solicitante.
  R7 é **insumo** para fechar o D5 da T166.
- **Conflito** com `BV1` decisão 7 e `A7:115-118` na aprovação.
- **Lacuna** de papel para "diretoria" e de alçada financeira.
- **Convergente** na efetivação por RH/DP.

**Gates:** `DP-FLX-02` (gestor solicitante) e `DP-FLX-03` (alçadas).

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
- **Conflito** com `A7:82-86`: R3 faz o tipo determinar campos e documentos, e a
  decisão diz que nenhum tipo altera comportamento.
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
- **Conflito** com a ADR 0004, decisão 5, se "valores anteriores e posteriores"
  (R19) tiverem de ficar na trilha formal.
- **Conflito** com o comportamento atual da correção de nome, que perde o valor
  anterior que R20 manda preservar.

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
- Os motivos são deliberadamente organizacionais: "não há 'justa causa',
  'pedido de demissão' ou equivalente, porque isso seria enquadramento
  trabalhista" (`schema:956-962`; `A7:388-390`).
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
- **Conflito** com `A15:197-198` no gestor solicitante, e com `BV1` decisão 7 na
  aprovação.
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
- Não há exclusão física (`A11:206-212`), e nenhum fluxo apaga conteúdo antes da
  política (ADR 0013, decisão 12).

**Situação:**

- **Conflito** com `DP-2E-07`: R30 pede vínculo e período, e o sujeito fechado é
  o colaborador.
- **Lacuna** em categoria e na separação de saúde, que tocam `DP-2E-02`.
- **Insumo** para `DP-2E-06` e `DP-2E-11`.
- **Convergente** na ausência de exclusão automática e no colaborador sem envio
  agora.

**Gates:** `DP-FLX-14` e `DP-FLX-15`.

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

## 4. Gates anteriores a qualquer implementação

Nenhum gate abaixo está resolvido. "Quem decide" registra só o que as próprias
respostas atribuem; onde elas não atribuem, a decisão é do proprietário.

| Gate        | Decisão pendente                                                                                                                                                                     | Reabre ou depende de                                                                                 | Quem decide, segundo as respostas           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `DP-FLX-01` | Aceite da ADR 0017.                                                                                                                                                                  | —                                                                                                    | Proprietário                                |
| `DP-FLX-02` | Gestor como solicitante de contratação, alteração e desligamento, e o que ele vê do processo.                                                                                        | Emenda à ADR 0015 (`A15:197-198`) e à `PD-SOL-01`; T165 §5.2; fecha T166 D5; RBAC novo.              | Proprietário                                |
| `DP-FLX-03` | Alçadas de aprovação: gestor, RH, diretoria e financeira, por empresa; quem é "diretoria" no sistema; aprovação como etapa distinta da efetivação.                                   | Emenda à `BV1` decisão 7 e à `A7` decisão 8; papel inexistente.                                      | Estrutura de alçadas da empresa (R8)        |
| `DP-FLX-04` | Estados e transições do processo admissional: oito etapas, devolução, cancelamento, "efetivada aguardando início", correção pós-efetivação (inclui T166 D8).                         | `BV1` decisões 2 e 15 (admissão atômica); `validacao:247-253`.                                       | Proprietário                                |
| `DP-FLX-05` | Ficha de tratamento do CPF: finalidade, base legal, acesso, mascaramento, proteção em repouso, retenção; e o uso do CPF para reconhecer a mesma pessoa.                              | Emenda à `A7:67-70`; `DP-ADM-04`, `-05`, `-07`, `-13`; ADR 0016, decisões 5.4, 5.8 e 5.9.            | RH + Jurídico (ADR 0012, decisão 1)         |
| `DP-FLX-06` | Fichas das demais categorias pessoais do cadastro e da admissão: data de nascimento, endereço, contato de emergência, e contato "telefone ou e-mail" frente aos três campos da T169. | `BV1:60-62`; `DP-ADM-02`, `-03`; ficha da T169.                                                      | RH + Jurídico                               |
| `DP-FLX-07` | Catálogo de tipos de vínculo: aprendiz, autônomo, sócio, prestador frente a `pj`, destino de `outro_controlado`; e se o tipo passa a determinar obrigatoriedade.                     | Emenda à `A7:82-86` e à `BV1` decisão 4; `DP-ADM-10`.                                                | Proprietário, com RH/DP                     |
| `DP-FLX-08` | Catálogo de campos e regras por tipo, empresa, cargo e etapa, inclusive local de trabalho e gestor por vínculo ou por equipe.                                                        | `DP-28`; `DP-2E-10`, `-11`; `DP-ADM-08`, `-17`; `A15:52-57`.                                         | RH/DP                                       |
| `DP-FLX-09` | Modelo de múltiplos vínculos ativos: na mesma empresa e entre empresas, com cadastro pessoal único.                                                                                  | Emenda à `BV1` decisão 3 e à `A7:74-78`; `A16:460` (`DP-18`); `A16:184-192`; depende de `DP-FLX-05`. | Proprietário                                |
| `DP-FLX-10` | Transição da matrícula informada na admissão para matrícula gerada na efetivação; identificador provisório; regra do sistema de folha; tratamento das matrículas já existentes.      | `BV1` decisões 2 e 15; `dto:143-155`; `schema:1033`; regra de folha não conhecida.                   | Regra do sistema de folha (R10)             |
| `DP-FLX-11` | Movimentações ampliadas e correção: tipos novos, correção simples × movimentação com aprovação, forma da justificativa, valores antes/depois, análise do DP com impacto em eSocial.  | `BV1` decisão 11; ADR 0004 decisão 5; `A7:422`; `DP-14`, `DP-18`; correção de nome.                  | Proprietário; análise do DP (R19)           |
| `DP-FLX-12` | Desligamento: etapas, campos por tipo, motivos com classificação trabalhista e o checklist da T155.                                                                                  | `schema:956-962`; `A7:388-390`; T155 (perguntas 1 a 12).                                             | Classificação validada pelo DP (R23)        |
| `DP-FLX-13` | Retenção, temporalidade e descarte: tabela por documento e informação, marco inicial, suspensões e descarte seguro.                                                                  | `DP-15`, `DP-ADM-03`, `DP-2E-15`, `PD-DOC-03`, retenção de `audit_event`.                            | DP e jurídico (R35)                         |
| `DP-FLX-14` | Documentos por vínculo, categoria e período; validade e alertas; checklist documental por tipo; upload.                                                                              | Emenda a `DP-2E-07`; `DP-2E-02`, `-06`, `-10`, `-11`; Nível 2 da Etapa 2; ADR 0013.                  | Proprietário, RH + Jurídico                 |
| `DP-FLX-15` | Saúde ocupacional: categoria própria para atestados, exames e ASO, e quem acessa.                                                                                                    | `DP-2E-02`; `PD-SOL-05`; `PD-DOC-02`; ADR 0016 (declarações sensíveis, A3).                          | RH + Jurídico                               |
| `DP-FLX-16` | Dados bancários, sindicais e de dependentes: campos, finalidade, base legal e acesso.                                                                                                | ADR 0016 (bloqueados); `DP-14`, `DP-18`, `DP-ADM-07`, `-13`, `-14`.                                  | Requisitos do DP e do sistema de folha (R6) |
| `DP-FLX-17` | Integração com a folha e o eSocial: fonte oficial de cada dado, importação com origem, conciliação e plano de implantação.                                                           | `DP-18`; `A16:459`, `A16:489`, `A16:508-510`; levantamento técnico (R36).                            | Plano de implantação (R40)                  |
| `DP-FLX-18` | Notificações: eventos, destinatários e conteúdo mínimo por permissão.                                                                                                                | Exclusão da T155 (`t155:36-37`); pendência não numerada da Central.                                  | Proprietário                                |
| `DP-FLX-19` | Projeção do gestor para admissão e desligamento: status, datas previstas, pendências e tarefas sob sua responsabilidade.                                                             | Emenda à `A15:104-107` (decisão 7).                                                                  | Proprietário                                |

## 5. Conflitos com decisões fechadas

Lista consolidada, para que nenhum fique escondido em uma seção:

1. **CPF como identificação da pessoa** × `A7:67-70` ("não é chave [...] de
   unicidade [...] em nenhuma hipótese") — 3.1.
2. **Matrícula só na efetivação** × admissão atômica com matrícula obrigatória
   (`BV1`, decisões 2 e 15; `dto:143-155`) — 3.2.
3. **Mais de um vínculo ativo na mesma empresa** × `BV1` decisão 3, `A7:74-78`
   e o índice `vinculo_funcional_ativo_unico` — 3.3.
4. **Gestor solicitante** × `A15:197-198`, `PD-SOL-01` e T165 §5.2 — 3.4 e 3.9.
5. **Workflow de aprovação** × `BV1` decisão 7 e `A7:115-118` — 3.4 e 3.9.
6. **Tipo de vínculo que determina obrigatoriedade** × `A7:82-86` — 3.5.
7. **Gestor como atributo do vínculo**, se for essa a leitura de R5 ×
   `A15:52-57` — 3.7.
8. **Justificativa em texto livre**, se for essa a leitura de R12, R19, R21 e
   R28 × `BV1` decisão 11 — 3.8.
9. **Valores antes/depois na trilha** × ADR 0004 decisão 5; e a correção de nome
   que sobrescreve o valor × R20 — 3.8.
10. **Motivos de desligamento com classificação trabalhista** ×
    `schema:956-962` e `A7:388-390` — 3.9.
11. **Projeção do desligamento ao gestor** × `A15:104-107` — 3.9.
12. **Documento por vínculo e período** × `DP-2E-07` — 3.10.

## 6. Sequência proposta de fatias

**É proposta, não autorização.** Cada fatia só começa com os seus gates decididos
e com pedido expresso do proprietário. A ordem põe primeiro o que reorganiza o
processo sem dado pessoal novo, e deixa para o fim o que depende de upload, de
fichas de categorias A3 ou de integração externa.

| Ordem | Fatia                                                                                                                                                                                           | Gates prévios                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 0     | Decisões, sem código: aceite da ADR 0017 e as emendas dos conflitos 1 a 12.                                                                                                                     | `DP-FLX-01` a `-03`, `-05`, `-07`, `-09`, `-10`                |
| 1     | Processo de admissão como entidade própria, separada do vínculo, com etapas, devolução e cancelamento, operado só por RH/DP.                                                                    | `DP-FLX-01`, `-04`                                             |
| 2     | Identificador provisório e matrícula definitiva na efetivação; "efetivada, aguardando início" distinta de vínculo ativo.                                                                        | `DP-FLX-04`, `-10`                                             |
| 3     | Solicitação de admissão pelo gestor e aprovações por alçada.                                                                                                                                    | `DP-FLX-02`, `-03`, `-19`                                      |
| 4     | Catálogo de tipos de vínculo e regras de obrigatoriedade configuráveis por tipo, empresa, cargo e etapa.                                                                                        | `DP-FLX-07`, `-08`                                             |
| 5     | CPF e demais dados do cadastro inicial, cada um com a sua ficha aprovada e o MFA imposto onde a ADR 0016 exige.                                                                                 | `DP-FLX-05`, `-06`; `DP-ADM-07`                                |
| 6     | Múltiplos vínculos ativos, com cadastro pessoal único entre empresas.                                                                                                                           | `DP-FLX-09`, depois da fatia 5                                 |
| 7     | Movimentações ampliadas (gestor, local de trabalho, jornada, empresa contratante), com aprovação e correção rastreável; salário só depois de `DP-14` e `DP-18`.                                 | `DP-FLX-03`, `-11`                                             |
| 8     | Desligamento com solicitação, aprovação, efetivação e campos por tipo.                                                                                                                          | `DP-FLX-02`, `-03`, `-12`, `-19`                               |
| 9     | Checklists de admissão e desligamento (T155), sem bloqueio automático da efetivação sem regra validada.                                                                                         | `DP-FLX-08`, `-12`                                             |
| 10    | Bloqueados por portões externos: documentos por vínculo e categoria, upload, saúde ocupacional, bancário, sindical, dependentes, notificações, integração com folha e eSocial, autoatendimento. | `DP-FLX-13` a `-18`; Nível 2 da Etapa 2; Portal do Colaborador |

## 7. Declarações desta tarefa

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
