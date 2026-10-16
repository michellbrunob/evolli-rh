# ADR 0016 — Modelo e governança dos dados de admissão e perfil do colaborador

- Status: **Aceito** em 2026-10-16, por aprovação do proprietário
  (`DP-ADM-01`); proposto em 2026-10-15. **A aprovação não fecha as demais
  decisões** (`DP-ADM-02` a `DP-ADM-18`) **e não dispensa a ficha de
  tratamento** de cada categoria (decisão 5.4): nenhuma interface, API,
  endpoint, migration, schema, seed ou alteração de RBAC de categoria nova
  nasce desta ADR sem a sua ficha aprovada.
- Data: 2026-10-15
- Tarefa: T166 — etapa **B** da ordem aprovada na T165.
- Relacionado:
  [ADR 0002](0002-papeis-postgres-e-migrations.md) (papéis de banco e
  migrations aditivas),
  [ADR 0004](0004-auditoria-formal-e-integridade.md) (trilha append-only, sem
  antes/depois),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md) (empresa como
  fronteira),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md) (decisão 8 —
  hierarquia fixa),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md) (decisões 2 e
  5 — matrícula, documento nunca é chave, dado restrito fora da V1),
  [ADR 0011](0011-documentos-privados-e-admissao-digital.md) (decisões 1, 2, 3,
  5 e 7 — metadado × conteúdo, upload desabilitado, quarentena, `empresa_id`
  próprio, leitura auditada),
  [ADR 0012](0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (decisão 1 — privacidade é de RH + Jurídico),
  [ADR 0013](0013-armazenamento-privado-cloudflare-r2.md) (conteúdo privado),
  [ADR 0015](0015-escopo-do-gestor-consultivo-e-vinculo-conta-colaborador.md)
  (escopo e projeção do gestor),
  [decisão da T165](../decisions/t165-cadastro-colaborador-rh-bloqueio.md) (§5),
  [diagnóstico da T166](../decisions/t166-dados-admissao-perfil-diagnostico.md),
  [Etapa 1 — Fatia 2](../modules/etapa1-fatia2-colaboradores-vida-funcional.md)
  (§4.7 e §5.5 — segregação do dado restrito e finalidade por campo),
  [decisões de Documentos e Solicitações](../decisions/decisoes-gestao-documentos-e-solicitacoes-v1.md)
  (§2.5 — categorias sensíveis),
  [aprovações pendentes da Etapa 2](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md).
- Constituição: v1.4.0, Princípios I, II, III, IV e V; gates LGPD de
  "Mandatory Architecture and Data Constraints".

## Contexto

A T165 parou por regra declarada: não existia cadastro sem admissão, o papel
pedido não batia com o RBAC, o modelo não tinha dado cadastral além do nome, e
a primeira fatia pedida já existia. O proprietário respondeu com uma decisão
que **não autoriza implementação** e fixa o rumo
([T165, §5](../decisions/t165-cadastro-colaborador-rh-bloqueio.md)):

- o fluxo chama-se **"Admitir colaborador"**, porque criação, primeiro vínculo
  e empresa ativa são atômicos;
- **`rh` e `dp` admitem**; o `master_tecnico` não cria, não edita e não admite
  pessoas; o funcionário não recebe link nem autopreenchimento;
- o formulário será **progressivo, em cinco blocos**: admissão e vínculo;
  dados pessoais e contatos; organização; documentos e dados bancários;
  dependentes e complementos;
- a **empresa vem exclusivamente da sessão ativa**, como contexto não editável;
- CPF, documentos, dados bancários, raça/etnia, deficiência, gênero, foto e
  dependentes exigem **finalidade, acesso restrito, auditoria, retenção e
  contrato próprios** antes de qualquer implementação;
- as imagens de referência servem só para agrupamento e clareza.

**O estado do repositório**, levantado na fonte e detalhado com evidência no
[diagnóstico da T166](../decisions/t166-dados-admissao-perfil-diagnostico.md):

- `Colaborador` guarda **só** `nome`, `situacao` e carimbos de data, e não tem
  `empresa_id` — a empresa é do vínculo (`schema.prisma:958-994`). As
  ausências de CPF, endereço, telefone, e-mail, nascimento, nome social,
  identidade de gênero, salário, dado familiar e dado sensível são
  **deliberadas** e registradas no próprio schema (`schema.prisma:864-883`).
- A ADR 0007 fixou os **quatro dados aprovados** (matrícula, nome, situação e
  vínculo) e mandou o revisor **bloquear** qualquer campo pessoal além deles. O
  desenho para o dado restrito já existe, preservado e não implementado:
  estrutura própria, recurso de autorização próprio, rota própria e leitura
  auditada (Fatia 2, §4.7).
- Nenhuma base legal e nenhum prazo de retenção estão aprovados no repositório
  para qualquer categoria de dado de pessoas. As finalidades escritas são as
  dos dados aprovados na Fatia 2 (§5.1) e a do metadado de documentos (ADR
  0011, tabela de promoção a Aceito). Mesmo essas aguardam confirmação: a ADR
  0007 condiciona o dado real à confirmação formal de finalidade e base legal,
  e a nota de convergência da ADR 0011 as mantém pendentes.

**A referência de mercado** trouxe oito capturas de um formulário de cadastro
com cerca de 80 campos em nove grupos (dados pessoais, endereço, contatos,
dados contratuais, documentos com dados bancários, fuso horário, dados
adicionais, dependentes e ações). Ela é usada **apenas** como inventário do que
foi pedido e como inspiração de agrupamento. Nenhuma marca, texto, identidade
visual, paleta, ícone, layout ou componente é reproduzido.

**O que esta ADR responde:** onde cada dado mora, para que serve, quem o lê e
quem o altera, quando ele pode existir e o que precisa ser decidido antes. Ela
**não** escolhe base legal nem prazo de retenção: onde isso depende de
Jurídico ou do proprietário, registra **decisão pendente**.

## Decisões

### 1. O modelo é da admissão, não do formulário

Um formulário único na tela **não** implica uma tabela única no banco. Cada
dado mora no agregado que responde por ele, com escopo, permissão, auditoria e
retenção próprios. O formulário é uma composição de vários agregados.

A consequência prática é a regra que a Fatia 2 já registrava (§5.5):
**finalidade declarada por campo, antes da coleta**, com módulo consumidor
identificado. "Pode ser útil depois" não é finalidade. Campo da referência sem
finalidade e sem consumidor no Evolli fica **fora de escopo**, e volta só por
emenda a esta ADR.

### 2. `Colaborador` continua mínimo; dado pessoal mora fora dele

O agregado `Colaborador` permanece com `nome` e `situacao`. Ele é lido por
muitos caminhos — listagem, `master_tecnico`, projeção do gestor — e qualquer
campo novo nele seria exposto por todos esses caminhos de uma vez.

Todo dado pessoal novo vive em **agregado próprio**, pelo raciocínio da Fatia
2, §4.7: segregando, o caminho padrão de leitura **não tem como** devolver o
dado restrito. Expô-lo exige rota, recurso e auditoria próprios, nunca uma
projeção condicional que uma consulta esquecida transforma em vazamento.

### 3. Modelo-alvo separado por responsabilidade

| Agregado                     | Responde por                                                                                           | Situação hoje                                                                                    | Classe de acesso (decisão 4)                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Colaborador**              | identidade mínima da pessoa: nome e situação derivada                                                  | existe (`colaborador`)                                                                           | A1                                                                                              |
| **Vínculo e admissão**       | matrícula, tipo de vínculo, data de admissão, ato de admissão e seu histórico                          | existe (`vinculo_funcional`, `movimentacao_funcional` do tipo `admissao`)                        | A1                                                                                              |
| **Organização**              | lotação vigente e histórica — definida na admissão e alterada só por movimentação —; superior derivado | existe (`alocacao_organizacional`; ADR 0015 para o gestor)                                       | A1 para a lotação; o superior derivado lê `gestor_atribuicao`, que hoje só o `rh` lê (ADR 0015) |
| **Horário e jornada**        | a tabela de horário aplicada ao vínculo e sua vigência                                                 | existe no módulo de Horários (`vinculo_horario`), mas ligado ao **colaborador** e não ao vínculo | regime do módulo de Horários (T037)                                                             |
| **Perfil pessoal**           | dados civis comuns: data de nascimento, nacionalidade                                                  | não existe                                                                                       | A2                                                                                              |
| **Contatos e endereço**      | telefones, e-mail pessoal, contato de emergência, endereço residencial                                 | não existe                                                                                       | A2                                                                                              |
| **Identificação documental** | números de documentos (CPF, RG, PIS, CTPS e demais aprovados)                                          | não existe                                                                                       | A3                                                                                              |
| **Documentos (arquivos)**    | o arquivo do documento e seu metadado                                                                  | só metadado (`documento_metadado`); upload desabilitado por construção (ADR 0011)                | conteúdo em A3; metadado no regime da ADR 0011                                                  |
| **Dados bancários**          | banco, agência e conta para pagamento                                                                  | não existe                                                                                       | A3                                                                                              |
| **Declarações sensíveis**    | nome social, gênero, raça/etnia e deficiência, quando aprovados                                        | não existe                                                                                       | A3                                                                                              |
| **Dependentes**              | pessoas dependentes do colaborador e seus dados                                                        | não existe (há só tela sintética de demonstração)                                                | A3                                                                                              |
| **Anexos e foto**            | foto e anexos, **se aprovados**                                                                        | não existe                                                                                       | A3; caminho de arquivo da ADR 0011                                                              |

**"Declarações sensíveis" é nome de agregado, não classificação legal.** O
agregado reúne dados de alto risco para a pessoa; se cada um deles é dado
pessoal sensível no sentido da LGPD é decisão de RH + Jurídico (decisão 5).

**Identificação documental e Documentos são agregados diferentes.** O número
do CPF é um dado estruturado, validável e consultável; a imagem do documento é
um arquivo, que segue o regime da ADR 0011 (metadado no banco, conteúdo fora
dele, quarentena, upload hoje desabilitado). Um não substitui o outro, e o
número nunca é extraído do arquivo por inferência.

**Regras estruturais para todo agregado novo** — o mesmo padrão que a ADR 0011
fixou para documentos e que a ADR 0007 preservou para o dado restrito:

1. **`empresa_id` próprio**, gravado a partir do escopo da sessão, com garantia
   no banco de que o colaborador tem vínculo naquela empresa (o mesmo papel do
   gatilho de `documento_metadado`, ADR 0011, decisão 5). `Colaborador` não
   ganha `empresa_id`.
2. **Recurso de autorização próprio** por categoria — nunca herdado de
   `colaborador`.
3. **Rota própria**, aninhada no colaborador, com a empresa vinda da sessão e
   **sem** `empresaId` no corpo. Fora do escopo, **404**, decidido no service.
   O parâmetro de rota **nunca se chama `id`** — por exemplo,
   `/colaboradores/:colaboradorId/<categoria>` —, porque o guard de
   autorização lê `params.id` como conta de acesso alvo
   (`authorization.guard.ts:125-137`).
4. **Auditoria de escrita** na mesma transação, sem valores, no padrão
   `pessoas.<entidade>.<verbo>` (ADR 0004, ADR 0007).
5. **Nunca** entra na listagem, na projeção do `Colaborador` nem na projeção do
   gestor (ADR 0015, decisão 7, segue inalterada).
6. **Sem exclusão física** enquanto a retenção não for decidida, mas
   **separado o bastante para ser eliminado** sem quebrar o histórico funcional
   quando ela for — a tensão imutabilidade × eliminação (RI-F2-3) se resolve
   melhor com o dado pessoal fora do histórico de vida funcional.
7. **Migration aditiva**, com expand/contract (ADR 0002), sem privilégio novo de
   banco.

**Horário e jornada é agregado próprio, não dado de organização.** Por
orientação do proprietário na T166, o horário fica ligado ao vínculo, e não à
lotação na estrutura. Hoje `vinculo_horario` aponta para (colaborador,
empresa), não para o vínculo funcional (`schema.prisma:1570-1593`), e isso
segue decisões do RH: na T035, o horário é atribuído no cadastro do
colaborador (`DP-3J-19`), e na T037 cada colaborador tem uma tabela de horário
com vigência (`etapa3-jornada-ponto-v1-detalhada.md`, §2.4). O módulo de
Horários tem ainda regime de acesso próprio: só o `rh` opera, o
`master_tecnico` só lê e o `dp` é negado (`rbac.evaluator.ts`,
`evaluateHorarios`). Ligar o horário ao vínculo **reabre** essas decisões do
RH, e por isso é `DP-ADM-17`, não fato. Nenhuma regra de jornada é criada ou
inferida aqui.

**Uma pessoa, várias empresas.** A ADR 0007 admite vínculos de um colaborador
com empresas diferentes, mas a API não consegue reaproveitar o colaborador
entre empresas: sem identificador pessoal, o sistema não reconhece que duas
pessoas são a mesma, e `POST /v1/vinculos` só readmite colaborador já visível
no escopo (Fatia 2, §14.7, item 5). Cada admissão por `POST /v1/colaboradores`
cria um `Colaborador`; a readmissão na mesma empresa reaproveita o existente.
Por isso o dado pessoal fica atrelado a (colaborador, empresa): uma mesma
pessoa admitida em duas empresas terá dois registros de perfil, e unificá-los
é decisão separada.

### 4. Classes de acesso

| Classe                      | Lê                                                                                                 | Altera                          | Negados                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| **A1 — Funcional** (existe) | `rh`, `dp`; `master_tecnico` só leitura; `gestor` só na projeção fechada da ADR 0015               | `rh`, `dp`                      | `admin_tecnico`, `financeiro`, `colaborador`, `auditor`, `dpo` |
| **A2 — Pessoal**            | `rh`, `dp` da empresa ativa                                                                        | `rh`, `dp` da empresa ativa     | `master_tecnico`, `gestor` e todos os demais                   |
| **A3 — Restrito**           | como A2, com **leitura auditada bloqueante**, e a matriz fina por categoria pendente (`DP-ADM-06`) | como A2, sujeito à mesma matriz | `master_tecnico`, `gestor` e todos os demais                   |

- **O funcionário não lê nem altera nada nesta fase**, em nenhuma classe.
- **`master_tecnico` fora de A2 e A3 é proposta**, não fato: hoje ele lê
  pessoas porque só existe A1. A razão é minimização — o perfil técnico não
  precisa de dado pessoal para administrar contas e estrutura. Como a ADR
  0012 (decisão 3) dá ao `master_tecnico` leitura global nos módulos,
  aprovar a exclusão exige **emenda àquela decisão**, além de `DP-ADM-06`.
- **Arquivo de documento e foto ficam em A3.** O metadado de documentos segue
  a ADR 0011. A leitura global de metadado pelo `master_tecnico` vem da T030,
  formalizada na ADR 0012, decisão 3 (`rbac.evaluator.ts`,
  `evaluateDocumentos`). Se essa leitura continua para as
  categorias desta ADR é parte de `DP-ADM-06`.
- **A3 pode estreitar**: a matriz por categoria pode concluir, por exemplo, que
  só um dos dois papéis lê dado bancário. A ADR não decide isso.

### 5. Governança

1. **Quem admite.** `rh` e `dp`, como o contrato já garante em duas camadas
   (`rbac.evaluator.ts` só concede `read` ao `master_tecnico`;
   `resolverEscopoPessoas` recusa com `ForbiddenException`). Nenhuma mudança de
   RBAC é necessária.
2. **Empresa só da sessão.** Contratos novos de dado pessoal **não aceitam**
   empresa no corpo: ela sai do escopo resolvido pela sessão (T163). O contrato
   de admissão existente aceita `empresaId` e apenas o confere — divergência
   produz 404 e o valor gravado é sempre o da sessão. Essa conferência
   **continua**, e não é só redundância: ela é a guarda contra contexto
   vencido. O formulário guarda a empresa ativa ao abrir; se a empresa for
   trocada em outra aba da mesma sessão, hoje o envio volta 404, e sem a
   conferência a admissão cairia em silêncio na outra empresa. Nos contratos
   aninhados no colaborador, a mesma guarda vem do próprio escopo: um
   colaborador de outra empresa responde 404. Na interface, a empresa **nunca**
   é campo editável — o valor exibido e enviado vem do servidor, com a sessão.
3. **O funcionário não preenche.** Nenhum link, convite, autopreenchimento ou
   acesso do papel `colaborador` nesta fase. O portal do colaborador só pode
   abrir, por dado, depois que aquele dado tiver permissão e contrato próprios
   (decisão 8).
4. **Gate por categoria — a ficha de tratamento.** Uma categoria de dado só
   ganha schema e contrato depois de uma **ficha de tratamento aprovada** e da
   **emenda à ADR 0007, ou ADR própria**, que aquela ADR exige para todo dado
   pessoal além dos quatro aprovados — nos seus Limites, nas Responsabilidades
   do revisor e nos Gatilhos de reavaliação, e, para o dado restrito, também
   na decisão 5. A ficha é o inventário
   que a Constituição já exige por módulo:

   | Item da ficha                                                      | Quem responde                                                                                   |
   | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
   | campos exatos e formato                                            | proprietário + RH                                                                               |
   | módulo consumidor                                                  | proprietário + RH                                                                               |
   | finalidade                                                         | **RH + Jurídico**                                                                               |
   | titulares e categorias de titulares, inclusive terceiros e menores | **RH + Jurídico**                                                                               |
   | destinatários e compartilhamentos                                  | **RH + Jurídico**                                                                               |
   | base legal                                                         | **RH + Jurídico**                                                                               |
   | classificação                                                      | **RH + Jurídico**                                                                               |
   | origem e evidência da coleta                                       | RH                                                                                              |
   | perfis que leem e alteram                                          | proprietário + RH                                                                               |
   | retenção, descarte, exportação                                     | **RH + Jurídico**                                                                               |
   | necessidade de RIPD                                                | **RH + Jurídico**                                                                               |
   | autenticação reforçada                                             | Segurança + Produto (`DS-MFA-01`, `DS-MFA-03`)                                                  |
   | proteção em repouso                                                | Segurança — decisão nova (`DP-ADM-13`); a gestão de chaves depende de `DS-SEC-01` e `DS-SEC-02` |

   **Sem ficha aprovada, a categoria não existe** — nem como coluna nula, nem
   como campo escondido na tela. É a regra R7 da ADR 0010 ("nenhum campo
   especulativo") aplicada a dado pessoal.

5. **Auditoria.** Escrita na mesma transação e sem valores. Para A3, a
   **leitura** também é auditada, em regime bloqueante — sem evento gravado,
   sem resposta —, como já ocorre com metadado de documentos (ADR 0011,
   decisão 7). Hoje a leitura de pessoas por `rh`/`dp` não gera evento: para
   A1 isso continua aceito; para A3, não.
6. **Logs, URL, fixtures e cliente.** Nenhum valor de A2 ou A3 em log, URL,
   parâmetro de rota, fixture com dado real ou armazenamento do navegador. A
   redação do logger já cobre `*.cpf` e `*.salario`; cada categoria aprovada
   acrescenta os seus caminhos antes de existir.
7. **Base legal e retenção: nada por suposição.** Esta ADR não escolhe base
   legal nem prazo para nenhuma categoria. Os gates existentes continuam
   abertos — `DP-14`, `DP-15`, `DP-2E-15`, `PD-DOC-03`, retenção de
   `audit_event` — e a ficha de cada categoria os fecha **para aquela
   categoria**, por RH + Jurídico.
8. **Documento nunca é chave.** CPF e qualquer outro documento continuam fora
   de chave primária, chave natural, unicidade e rota (ADR 0007, decisão 2).
   Detectar admissão duplicada por CPF exigiria emenda a essa decisão; até lá,
   a detecção de duplicidade é **decisão pendente** (`DP-ADM-05`).
9. **Autenticação reforçada.** As decisões de Documentos (§2.5) exigem MFA
   imposto para dado bancário e documento pessoal, e o lançamento roda com MFA
   desligado (T132). A ADR não resolve esse conflito: dado bancário e
   documento pessoal — número e conteúdo — ficam **bloqueados** até o MFA estar
   habilitado e imposto no servidor para quem os opera (`DS-MFA-01`) e até
   `DS-MFA-03` dizer quais dessas ações exigem reautenticação (`DP-ADM-07`). A mesma §2.5 exige ainda, cumulativamente, a decisão de acesso restrito por
   categoria, o gate-mestre de dado real `DS-OPS-01`, auditoria comprovada,
   retenção e base legal, e as validações aplicáveis de RH e
   Jurídico/privacidade. Alterar dado bancário é ação de alto impacto no sentido do
   Princípio V.
10. **Dado declarado pelo titular.** Nome social, gênero e raça/etnia são,
    por natureza, **declarados pela própria pessoa**. Nesta fase o titular não
    participa do sistema. Registrar esses dados pelo RH exige decidir como a
    declaração é colhida e evidenciada (`DP-ADM-09`); sem isso, eles não são
    coletados — o RH não infere nem atribui nenhum deles.
11. **Deficiência não é simples autodeclaração.** Ela pode exigir comprovação,
    e a comprovação, conforme o conteúdo, pode revelar dado referente à saúde. **Formato,
    obrigatoriedade, acesso, finalidade, retenção e auditoria** dessa
    informação — e de qualquer comprovação — dependem de decisão e contrato
    próprios (`DP-ADM-16`). Esta ADR não cria nenhuma dessas regras: até lá,
    deficiência não é coletada, nem declarada nem comprovada.

**Sobre classificação legal.** A LGPD (art. 5º, II) lista expressamente, entre
os dados sensíveis, o dado sobre **origem racial ou étnica** e o **dado
referente à saúde**. Gênero e deficiência não aparecem literalmente nessa
lista. A Fatia 2 (§5.3) já classifica internamente a identidade de gênero como
"Sensível", e esta ADR mantém essa classificação **interna**, por precaução,
sem atribuí-la à lei. A informação sobre deficiência, porém, pode revelar dado
referente à saúde, conforme o conteúdo efetivamente tratado. Por isso esta ADR
não conclui que toda informação sobre deficiência seja automaticamente dado
sensível: o enquadramento depende do conteúdo e da decisão de RH + Jurídico.
Até essa decisão, deficiência permanece restrita (A3) e bloqueada, dependente
de finalidade, necessidade, evidência comprobatória, acesso, auditoria,
retenção e contrato aplicável (`DP-ADM-16`). A classificação final de cada
categoria é de RH + Jurídico.
Dados de criança e adolescente, prováveis entre dependentes, seguem o art. 14
da LGPD — melhor interesse e regras específicas. A base legal e as medidas para
cumpri-lo são decisão de RH + Jurídico.

### 6. Matriz de campos

**Como ler.**

- **Bloco** é o dos cinco blocos aprovados na T165: **1** admissão e vínculo,
  **2** dados pessoais e contatos, **3** organização, **4** documentos e dados
  bancários, **5** dependentes e complementos. "—" quando o campo não entra no
  modelo-alvo.
- **Finalidade de negócio.** Nos campos que já existem, é a finalidade já
  registrada na Fatia 2, §5.1. Nos demais, é **proposta** — confirmar
  finalidade é de RH + Jurídico (ADR 0012). Onde nem uma proposta se sustenta,
  a coluna diz isso, e o campo não é coletado.
- **Classe**:
  - **Admissão** — exigido pelo contrato de admissão do Evolli, **não por
    lei**. "≥ 1 de 6": o contrato exige ao menos uma entre seis referências
    organizacionais (unidade, departamento, área, equipe, cargo, centro de
    custo), nenhuma isoladamente;
    - **Complementar** — está no modelo-alvo, tem finalidade proposta e entra
      depois da admissão; se for dado pessoal, só quando sua ficha for aprovada;
  - **Condicional** — está no modelo-alvo, mas só se aplica quando outro dado
    tem certo valor, e a regra da condição ainda não está decidida;
  - **Derivado** — nunca digitado: mostrado a partir de dado que já existe;
    - **Bloqueado** — está no modelo-alvo, mas falta uma decisão **anterior à
      ficha** — finalidade, consumidor, semântica ou caminho técnico —, listada
      em "Depende de". Tomada essa decisão, o campo segue o caminho de
      Complementar, sem emenda a esta ADR;
  - **Fora de escopo** — não entra no modelo-alvo; volta só por emenda a esta
    ADR.
- **Acesso** usa as classes da decisão 4. "Horários" é o regime do módulo de
  Horários (T037: só o `rh` opera, o `master_tecnico` só lê); "Liderança", o
  de `gestor_atribuicao` (ADR 0015: só o `rh` lê e altera); e "Contas", o de
  contas de acesso (ADR 0003).
- **Depende de**: **CTR** contrato novo; **CAT** catálogo de opções; **RET**
  decisão de retenção (`DP-15`, `DP-ADM-03`); **REG** regra adicional; **FT**
  ficha de tratamento aprovada (decisão 5.4); e os identificadores de
  decisões pendentes.
- **Valem para todas as linhas e não se repetem:** o gate-mestre de dado real
  `DS-OPS-01`, que as decisões de Documentos (§2.5) exigem expressamente para
  dado bancário e documento pessoal; e, para todo dado pessoal novo, a extensão
  do conjunto aprovado (`DP-11 (V2)`) com emenda à ADR 0007. Número de
  documento e dado bancário dependem, além disso, da decisão 5.9 (MFA imposto
  e reautenticação, `DP-ADM-07`), que aparece nas linhas.
- **RET aparece até nos campos que já existem.** Nenhum dado de pessoas tem
  retenção decidida, e a ADR 0007 condiciona o dado real à confirmação formal
  de finalidade e base legal dos quatro dados aprovados.
- **"Obrigatório" na referência não é obrigatório aqui.** O asterisco do
  produto de mercado não vira exigência: nenhuma obrigatoriedade legal é
  inferida.

#### 6.1 Dados pessoais

| Campo da referência    | Bloco | Agregado              | Finalidade de negócio                                                             | Acesso | Classe         | Depende de                                                     | Hoje                                            |
| ---------------------- | ----- | --------------------- | --------------------------------------------------------------------------------- | ------ | -------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Nome                   | 1     | Colaborador           | identificar o titular da vida funcional (já registrada na Fatia 2, §5.1)          | A1     | Admissão       | RET; confirmação de finalidade e base legal (ADR 0007)         | existe                                          |
| Nome social            | 2     | Declarações sensíveis | tratar a pessoa pelo nome com que se identifica — proposta                        | A3     | Bloqueado      | FT; CTR; RET; `DP-25 (V2)`; `DP-ADM-09`                        | não existe                                      |
| E-mail                 | —     | —                     | duplicado na referência: desdobrado em e-mail pessoal e e-mail corporativo        | —      | Fora de escopo | —                                                              | —                                               |
| Data de nascimento     | 2     | Perfil pessoal        | identificar a pessoa e conferir documentos — proposta                             | A2     | Complementar   | FT; CTR; RET                                                   | não existe                                      |
| Sexo                   | —     | —                     | sem finalidade nem consumidor identificados                                       | —      | Fora de escopo | finalidade (`DP-ADM-02`)                                       | não existe                                      |
| Gênero                 | 2     | Declarações sensíveis | nenhuma proposta: depende de finalidade                                           | A3     | Bloqueado      | FT; CTR; RET; `DP-25 (V2)`; `DP-ADM-02`; `DP-ADM-09`           | não existe                                      |
| Saudação               | —     | —                     | sem finalidade                                                                    | —      | Fora de escopo | —                                                              | não existe                                      |
| Raça / Etnia           | 2     | Declarações sensíveis | nenhuma proposta: depende de finalidade                                           | A3     | Bloqueado      | emenda à Fatia 2, §5.4; FT; CTR; RET; `DP-ADM-02`; `DP-ADM-09` | não existe                                      |
| Foto                   | 5     | Anexos e foto         | identificação visual interna, se aprovada — proposta; nunca reconhecimento facial | A3     | Bloqueado      | `DP-ADM-11`; upload (ADR 0011, 0013); FT; CTR; RET             | não existe                                      |
| Estado civil           | —     | —                     | sem consumidor no Evolli                                                          | —      | Fora de escopo | módulo consumidor                                              | não existe                                      |
| Escolaridade           | —     | —                     | o consumidor seria desenvolvimento e treinamento, frente futura                   | —      | Fora de escopo | módulo consumidor                                              | não existe; só tela estática de catálogo (T086) |
| Curso                  | —     | —                     | idem                                                                              | —      | Fora de escopo | módulo consumidor                                              | não existe                                      |
| Pessoa com deficiência | 2     | Declarações sensíveis | nenhuma proposta: depende de finalidade                                           | A3     | Bloqueado      | `DP-ADM-16`; `DP-14`; FT; CTR; RET                             | não existe                                      |
| Tipo de deficiência    | 2     | Declarações sensíveis | idem; só existiria com a anterior marcada                                         | A3     | Bloqueado      | `DP-ADM-16`; `DP-14`; FT; CTR; RET; CAT                        | não existe                                      |
| Nacionalidade          | 2     | Perfil pessoal        | identificação civil — proposta                                                    | A2     | Complementar   | FT; CTR; RET; CAT                                              | não existe                                      |
| Naturalidade           | —     | —                     | sem consumidor no Evolli                                                          | —      | Fora de escopo | módulo consumidor                                              | não existe                                      |
| Nome do pai            | —     | —                     | sem consumidor; é dado de terceiro                                                | —      | Fora de escopo | módulo consumidor                                              | não existe                                      |
| Nome da mãe            | —     | —                     | idem                                                                              | —      | Fora de escopo | módulo consumidor                                              | não existe                                      |

**Raça/etnia exige mais que a ficha.** A Fatia 2, §5.4, lista origem racial ou
étnica entre os dados que **não entram em nenhuma forma** no domínio de
pessoas. A decisão do proprietário na T165 a coloca entre os dados futuros, e
as duas coisas se conciliam assim: ela só entra por **emenda àquela spec** e à
ADR 0007, além da ficha. A mesma §5.4 proíbe qualquer dado biométrico — por
isso a foto, se aprovada, nunca serve a reconhecimento facial.

#### 6.2 Endereço

| Campo da referência | Bloco | Agregado            | Finalidade de negócio                                              | Acesso | Classe       | Depende de                | Hoje                                               |
| ------------------- | ----- | ------------------- | ------------------------------------------------------------------ | ------ | ------------ | ------------------------- | -------------------------------------------------- |
| País                | 2     | Contatos e endereço | comunicação formal com a pessoa no endereço residencial — proposta | A2     | Complementar | FT; CTR; RET; CAT         | não existe; só tela estática de localidades (T087) |
| CEP                 | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET; `DP-ADM-12` | não existe                                         |
| Logradouro          | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET              | não existe                                         |
| Número              | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET              | não existe                                         |
| Bairro              | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET              | não existe                                         |
| Cidade              | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET; CAT         | não existe; só tela estática de localidades (T087) |
| Estado              | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET; CAT         | não existe; só tela estática de localidades (T087) |
| Complemento         | 2     | Contatos e endereço | idem                                                               | A2     | Complementar | FT; CTR; RET              | não existe                                         |

O Evolli não tem catálogo de país, UF ou município, e preencher endereço a
partir do CEP por serviço externo é **integração externa**, que a Constituição
proíbe sem aprovação. Ambos são decisão da ficha (`DP-ADM-12`).

#### 6.3 Contatos

| Campo da referência | Bloco | Agregado            | Finalidade de negócio                                                      | Acesso | Classe       | Depende de                           | Hoje                            |
| ------------------- | ----- | ------------------- | -------------------------------------------------------------------------- | ------ | ------------ | ------------------------------------ | ------------------------------- |
| Celular             | 2     | Contatos e endereço | contato operacional com a pessoa — proposta                                | A2     | Complementar | FT; CTR; RET                         | não existe                      |
| Telefone            | 2     | Contatos e endereço | idem                                                                       | A2     | Complementar | FT; CTR; RET                         | não existe                      |
| Emergência          | 2     | Contatos e endereço | acionar alguém em ocorrência com a pessoa no trabalho — proposta           | A2     | Complementar | FT; CTR; RET; dado de terceiro       | não existe                      |
| E-mail pessoal      | 2     | Contatos e endereço | comunicação com a pessoa fora da conta corporativa — proposta              | A2     | Complementar | FT; CTR; RET                         | não existe                      |
| E-mail corporativo  | 2     | conta de acesso     | é o login da conta (ADR 0003), mostrado só quando há conta ligada à pessoa | Contas | Derivado     | ligação conta↔pessoa (ADR 0015); RET | existe como `access_user.email` |

O telefone de emergência, sozinho, não diz a quem se liga. Se a ficha concluir
que é preciso nome ou relação, esses campos passam pela mesma ficha — eles
também são dado de terceiro.

#### 6.4 Aviso entre blocos da referência

O aviso de que avaliações dependem de superior, admissão, departamento, cargo
e e-mail do superior é **fora de escopo**: o Evolli não tem módulo de
avaliação. A lição de UX é outra e está na decisão 7: o Evolli não exibe aviso
sobre módulo que não existe.

#### 6.5 Dados contratuais

| Campo da referência                   | Bloco                         | Agregado           | Finalidade de negócio                                                            | Acesso    | Classe              | Depende de                                       | Hoje                                                                        |
| ------------------------------------- | ----------------------------- | ------------------ | -------------------------------------------------------------------------------- | --------- | ------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Departamento                          | 1                             | Organização        | situação organizacional por data (Fatia 2, §5.1)                                 | A1        | Admissão (≥ 1 de 6) | CAT existe; RET                                  | existe                                                                      |
| Cargo                                 | 1                             | Organização        | idem                                                                             | A1        | Admissão (≥ 1 de 6) | CAT existe; RET                                  | existe                                                                      |
| Tipo de contrato                      | 1                             | Vínculo e admissão | natureza do vínculo ou modalidade contratual — qual das duas, `DP-ADM-10` decide | A1        | Bloqueado           | `DP-ADM-10`; RET                                 | o tipo de vínculo existe e é exigido na admissão; a equivalência é hipótese |
| Filial                                | 1                             | Organização        | depende de saber se filial é a unidade organizacional                            | A1        | Bloqueado           | `DP-ADM-08`; `DP-4`; RET                         | não existe                                                                  |
| Unidade                               | 1                             | Organização        | situação organizacional por data (Fatia 2, §5.1)                                 | A1        | Admissão (≥ 1 de 6) | CAT existe; RET                                  | existe                                                                      |
| Turno                                 | 1 (depois do ato de admissão) | Horário e jornada  | aplicar ao vínculo a tabela de horário cadastrada, nunca texto livre             | Horários  | Complementar        | contrato de Horários existente; `DP-ADM-17`; RET | existe como tabela de horário, ligada ao colaborador                        |
| Moeda                                 | —                             | —                  | só faz sentido com remuneração                                                   | —         | Fora de escopo      | `DP-14`                                          | não existe                                                                  |
| Salário                               | —                             | —                  | remuneração é dado restrito; o consumidor seria a folha                          | —         | Fora de escopo      | `DP-14`; `DP-18`                                 | não existe                                                                  |
| Data de admissão                      | 1                             | Vínculo e admissão | marco inicial do histórico (Fatia 2, §5.1)                                       | A1        | Admissão            | RET                                              | existe                                                                      |
| Período de experiência                | 1                             | Vínculo e admissão | nenhuma proposta: depende da modalidade contratual                               | A1        | Bloqueado           | `DP-ADM-10`; REG; RET                            | não existe                                                                  |
| Matrícula                             | 1                             | Vínculo e admissão | identificação funcional dentro da empresa (Fatia 2, §5.1)                        | A1        | Admissão            | RET                                              | existe; única por empresa; imutável                                         |
| Superior direto                       | 3                             | Organização        | mostrar quem lidera a equipe da pessoa — proposta                                | Liderança | Derivado            | equipe na lotação + atribuição (ADR 0015); RET   | derivável; não existe como campo                                            |
| Grau hierárquico                      | —                             | —                  | hierarquia recursiva vetada                                                      | —         | Fora de escopo      | ADR 0006, decisão 8                              | não existe                                                                  |
| Data do contrato                      | 1                             | Vínculo e admissão | nenhuma proposta: depende da modalidade contratual                               | A1        | Bloqueado           | `DP-ADM-10`; REG; RET                            | não existe                                                                  |
| Duração do contrato                   | 1                             | Vínculo e admissão | nenhuma proposta: depende da modalidade contratual                               | A1        | Bloqueado           | `DP-ADM-10`; REG; RET                            | não existe                                                                  |
| Vencimento do contrato                | 1                             | Vínculo e admissão | nenhuma proposta: depende da modalidade contratual                               | A1        | Bloqueado           | `DP-ADM-10`; REG; RET                            | não existe                                                                  |
| Código externo                        | —                             | —                  | depende de integração, que não está aprovada                                     | —         | Fora de escopo      | camada de integrações                            | não existe                                                                  |
| Duplo vínculo                         | —                             | —                  | semântica trabalhista e fiscal não decidida                                      | —         | Fora de escopo      | REG; `DP-18`                                     | não existe; no máximo um vínculo em curso por (colaborador, empresa)        |
| Data de início no cargo               | 3                             | Organização        | mostrar desde quando a pessoa ocupa o cargo — proposta                           | A1        | Derivado            | histórico de lotação; RET                        | derivável                                                                   |
| Início de vigência                    | 1                             | Vínculo e admissão | vigência do ato de admissão                                                      | A1        | Derivado            | igual à data de admissão na admissão; RET        | existe na movimentação                                                      |
| Periculosidade                        | —                             | —                  | adicional legal e de folha: nenhuma regra é inferida                             | —         | Fora de escopo      | REG (RH + Jurídico); frente de SST e folha       | não existe                                                                  |
| Insalubridade                         | —                             | —                  | idem                                                                             | —         | Fora de escopo      | idem                                             | não existe                                                                  |
| Percentual de insalubridade           | —                             | —                  | idem                                                                             | —         | Fora de escopo      | idem                                             | não existe                                                                  |
| Permitir que o colaborador bata ponto | —                             | —                  | pertence ao módulo de Ponto, onde hoje só RH e DP registram                      | —         | Fora de escopo      | decisão do módulo de Ponto                       | não existe                                                                  |

- **Criação rápida de estrutura dentro da admissão fica de fora.** Criar
  departamento, cargo ou unidade é permissão de `rh`, que o `dp` não tem; um
  botão de criar dentro do formulário de admissão faria uma ação de outro
  recurso como efeito colateral. A admissão escolhe entre o que existe.
- **"Tipo de contrato" não é presumido igual a tipo de vínculo** — por isso
  está bloqueado. O tipo de vínculo do Evolli, que já existe e é exigido na
  admissão, é um catálogo fechado sem enquadramento legal (ADR 0007).
  Modalidade contratual — prazo indeterminado ou determinado, experiência e
  outras — é outra dimensão, e se ela se relaciona com o tipo de vínculo é
  pergunta de `DP-ADM-10`, sem resposta presumida.

#### 6.6 Documentos e dados bancários

| Campo da referência | Bloco | Agregado                 | Finalidade de negócio                                                                                                                                                                  | Acesso | Classe         | Depende de                                                                                | Hoje       |
| ------------------- | ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------- | ----------------------------------------------------------------------------------------- | ---------- |
| CPF                 | 4     | Identificação documental | identificar a pessoa nos atos do vínculo — proposta; consumidor candidato: importação de ponto, cuja identificação por CPF é hipótese registrada na T035 e ainda depende de `DP-3J-20` | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-04`; `DP-ADM-05`; `DP-ADM-13`; `DP-ADM-18`; `DP-ADM-07` | não existe |
| CNPJ                | 4     | Identificação documental | só para vínculo `pj`, cuja regra não está definida                                                                                                                                     | A3     | Condicional    | tipo `pj`; REG; FT; CTR; RET; `DP-ADM-13`; `DP-ADM-07`                                    | não existe |
| Estrangeiro         | 2     | Perfil pessoal           | definiria o conjunto documental, que não está decidido                                                                                                                                 | A2     | Bloqueado      | `DP-2E-11`; REG; FT; CTR; RET                                                             | não existe |
| RG                  | 4     | Identificação documental | registro documental do vínculo, no conjunto que `DP-2E-11` definir — proposta                                                                                                          | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Data de expedição   | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Órgão expedidor     | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; CAT; `DP-ADM-07`                                   | não existe |
| Matrícula eSocial   | —     | —                        | semântica e relação com a matrícula funcional dependem da frente de folha e eSocial, a validar por RH e fiscal                                                                         | —      | Fora de escopo | `DP-18`                                                                                   | não existe |
| CNH                 | 4     | Identificação documental | só quando a função exigir habilitação; não há regra por cargo                                                                                                                          | A3     | Condicional    | REG; FT; CTR; RET; `DP-ADM-13`; `DP-ADM-07`                                               | não existe |
| Reservista          | 4     | Identificação documental | registro documental do vínculo, no conjunto que `DP-2E-11` definir — proposta                                                                                                          | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Título de eleitor   | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Zona eleitoral      | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Seção eleitoral     | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| PIS                 | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| CTPS — número       | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| CTPS — série        | 4     | Identificação documental | idem                                                                                                                                                                                   | A3     | Complementar   | FT; CTR; RET; `DP-2E-11`; `DP-ADM-13`; `DP-ADM-07`                                        | não existe |
| Banco               | 4     | Dados bancários          | pagamento — sem consumidor no Evolli hoje                                                                                                                                              | A3     | Bloqueado      | consumidor aprovado (`DP-18`); FT; CTR; RET; `DP-ADM-07`; `DP-ADM-13`                     | não existe |
| Agência             | 4     | Dados bancários          | idem                                                                                                                                                                                   | A3     | Bloqueado      | consumidor aprovado (`DP-18`); FT; CTR; RET; `DP-ADM-07`; `DP-ADM-13`                     | não existe |
| Conta corrente      | 4     | Dados bancários          | idem                                                                                                                                                                                   | A3     | Bloqueado      | consumidor aprovado (`DP-18`); FT; CTR; RET; `DP-ADM-07`; `DP-ADM-13`                     | não existe |

- **Nenhum documento é exigido por esta ADR.** Qual conjunto se aplica a cada
  tipo de vínculo é `DP-2E-11`, e se o CPF entra como exigência da admissão é
  `DP-ADM-04`.
- **O arquivo do documento** segue o regime da ADR 0011: metadado no banco,
  conteúdo fora, quarentena, e upload hoje desabilitado por construção. O
  número e o arquivo nunca se misturam.
- **Dado bancário sem consumidor é coleta sem finalidade.** O Evolli não tem
  folha nem exportação aprovada para folha. Coletar conta bancária antes de
  existir quem a use contraria a regra da decisão 1, e o dado é alvo
  conhecido de fraude. Ele fica bloqueado até haver consumidor aprovado,
  ficha e a decisão de autenticação reforçada.

#### 6.7 Fuso horário e dados adicionais

| Campo da referência  | Bloco | Agregado | Finalidade de negócio                                                                          | Acesso | Classe         | Depende de                     | Hoje                         |
| -------------------- | ----- | -------- | ---------------------------------------------------------------------------------------------- | ------ | -------------- | ------------------------------ | ---------------------------- |
| País (fuso)          | —     | —        | fuso é da operação, não da pessoa                                                              | —      | Fora de escopo | decisão de produto sobre fuso  | fuso único, fixo no servidor |
| Fuso horário         | —     | —        | idem                                                                                           | —      | Fora de escopo | idem                           | idem                         |
| Quantidade de filhos | —     | —        | sem consumidor; filhos e dependentes são conjuntos diferentes, então não se deriva um do outro | —      | Fora de escopo | módulo consumidor; `DP-ADM-14` | não existe                   |
| Tamanho da camisa    | —     | —        | sem consumidor no Evolli                                                                       | —      | Fora de escopo | módulo consumidor              | não existe                   |

#### 6.8 Dependentes

| Campo da referência  | Bloco | Agregado    | Finalidade de negócio                   | Acesso | Classe    | Depende de                                                                          | Hoje                          |
| -------------------- | ----- | ----------- | --------------------------------------- | ------ | --------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| Adicionar dependente | 5     | Dependentes | nenhuma proposta: depende de finalidade | A3     | Bloqueado | `DP-ADM-14`; `DP-14`; FT; CTR; RET; LGPD, art. 14, se houver criança ou adolescente | não existe; só tela sintética |

Os campos do dependente **não aparecem** nas imagens de referência, e esta ADR
não os inventa. Quais campos, para qual finalidade e com qual base legal é
`DP-ADM-14`. Dependente é dado de **terceiro** (Fatia 2, §5.3), e o tratamento
de dado de criança ou adolescente segue o art. 14 da LGPD.

### 7. UX futuro — registrado, não iniciado

1. **A admissão é o bloco 1, e é atômica.** "Admitir colaborador" envia **só**
   a parte atômica do bloco 1 — nome, matrícula, tipo de vínculo, data de
   admissão e a **lotação completa** —, porque é o que cria colaborador, vínculo e
   movimentação numa transação. A lotação inteira fica no bloco 1, e não só a
   referência mínima: o contrato de admissão já aceita as seis referências
   (`AdmitirColaboradorDto` herda `DestinoOrganizacionalDto`), e não existe
   como "completar a lotação depois". A alocação só nasce da efetivação de uma
   movimentação, grava só o destino dela e exige vigência estritamente
   posterior à anterior (`movimentacao.service.ts:301-315`;
   `validacao-pessoas.util.ts:233-240`). Completá-la depois produziria uma
   transferência ou mudança de cargo fictícia no histórico funcional.
   O horário, ligado ao vínculo, é o complemento do bloco 1: entra **depois**
   do ato de admissão, com salvamento próprio, e só para quem pode operar
   Horários — hoje, só o `rh`; o `dp` admite, mas não vê essa
   etapa enquanto `DP-ADM-17` não disser o contrário.
2. **O bloco 3 é de leitura; os blocos 2, 4 e 5 complementam depois.** O
   bloco 3 mostra o que deriva da lotação — superior direto, data de início no
   cargo, histórico — e mudanças posteriores seguem pelo fluxo de movimentação
   que já existe, com vigência própria. Os blocos 2, 4 e 5 têm, cada um, seu
   salvamento: cada categoria tem permissão, auditoria e ficha próprias, e
   juntá-las numa única transação faria a falha de uma derrubar todas e
   misturaria governanças diferentes. Na ficha do colaborador admitido, cada
   bloco aparece com seu próprio estado.
3. **Contexto de empresa travado.** A empresa ativa aparece no topo do fluxo,
   em leitura, com nome e código, e não há campo de empresa. Hoje a empresa
   ativa aparece na listagem de Colaboradores, mas **não dentro do
   formulário** de Novo colaborador quando só há uma — ali, quem admite não a
   vê. Isso muda na etapa D.
4. **Campos condicionais.** Um campo condicional só aparece quando a condição
   vale (por exemplo, tipo de deficiência só depois de marcada a deficiência,
   se aprovada). Ao desfazer a condição, o valor dependente é descartado e o
   usuário é avisado antes.
5. **Validação acessível.** Erro por campo ligado ao controle
   (`aria-invalid`, `aria-describedby`); **resumo de erros** no topo do bloco,
   com foco movido para ele no envio e links para cada campo; e um único
   anúncio, não um alerta por campo disparando ao mesmo tempo. Hoje o servidor
   devolve só mensagem fixa por status, sem dizer qual campo falhou; o erro
   por campo é mudança de contrato (`DP-ADM-15`, etapa C do plano).
6. **Revisão antes de admitir.** Antes do envio, um resumo só de leitura do
   bloco 1, com a empresa em destaque e um "corrigir" por grupo. A revisão diz
   ao usuário, explicitamente, quais dados são **definitivos**: no contrato
   atual, matrícula, tipo de vínculo e data de admissão não têm correção
   (diagnóstico, D8), e a lotação só muda por movimentação posterior. O
   formulário atual já avisa isso na descrição da janela.
7. **Alerta de saída com dado não salvo.** Cobre fechar a janela, recarregar a
   página e trocar de área dentro do produto, inclusive pelo botão "Cancelar".
   Hoje o Modal já confirma o descarte pelo "Fechar" e pelo Escape, mas o
   "Cancelar" do formulário de Novo colaborador o contorna, e nada cobre o
   recarregamento da página.
8. **Nenhuma seção vazia e nenhum campo sem persistência.** Um bloco só
   aparece quando seu contrato existe; um campo só aparece quando é gravado de
   verdade. Bloco sem contrato não vira seção desabilitada nem "em breve" — é
   a mesma regra da T159 e da T162: **controle aparente é promessa**.

### 8. Plano técnico posterior — não iniciado

A ordem segue as etapas C, D e E aprovadas na T165; o portal do colaborador
fica **fora** dessa ordem, como frente separada. Cada item é tarefa futura,
com escopo, aceite e validação próprios. **Nada aqui começa nesta tarefa.**

| Ordem         | Frente                                 | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Pré-condição                                                                                                                                                                                                                      |
| ------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C             | Contratos e migrations                 | Primeiro, as dívidas do contrato que já existe: restringir `motivoCodigo` a `admissao_inicial` no servidor; devolver vínculo e movimentação na resposta da admissão; erro por campo sem valor (`DP-ADM-15`); catálogos de enums publicados; teste unitário de `resolverEscopoPessoas`; auditar a leitura de pessoas pelo `master_tecnico` também com empresa ativa (diagnóstico, D7); um teste que reproduza ou refute D8 e a decisão sobre como corrigir uma admissão; ligar o horário ao vínculo, se `DP-ADM-17` aprovar. A conferência do `empresaId` na admissão **fica** (decisão 5.2). Depois, por categoria aprovada: ficha → emenda à ADR 0007 ou ADR própria → emenda à ADR 0012, decisão 3, se o `master_tecnico` ficar fora → migration aditiva → recurso RBAC → rota → auditoria → redação de log → testes de caminho permitido e negado. | `DP-ADM-01` — **satisfeita**, aprovada pelo proprietário em 2026-10-16 (ver `Status` e o bloco "Resolvida", na seção 9); para cada categoria, sua ficha                                                                           |
| D             | Admissão mínima                        | A parte atômica do bloco 1, com empresa travada, validação acessível, revisão antes de admitir e alerta de saída; e, como complemento do bloco 1, o horário ligado ao vínculo, se `DP-ADM-17` aprovar. O formulário atual é o ponto de partida (o B4 da T165 continua válido).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Dívidas da etapa C; para o horário, `DP-ADM-17`                                                                                                                                                                                   |
| E1            | Dados pessoais, contatos e organização | Blocos 2 e 3: perfil pessoal, contatos e endereço; organização em leitura (superior derivado, início no cargo, histórico). Por último, e só se desbloqueadas, as declarações sensíveis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Fichas e emendas de Perfil pessoal e de Contatos e endereço; `DP-ADM-06`. Para declarações sensíveis: ficha própria, `DP-ADM-02`, `DP-ADM-09`, `DP-ADM-16` e, para raça/etnia, emenda à Fatia 2, §5.4                             |
| E2            | Documentos e dados bancários           | Bloco 4: identificação documental; arquivos pelo regime da ADR 0011; dados bancários.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fichas e emendas; `DP-ADM-06`; `DP-2E-11`; `DP-ADM-13`; `DS-OPS-01`; MFA imposto (`DS-MFA-01`) e `DP-ADM-07`, para documento pessoal e bancário; upload habilitado (`DP-2E-04`, `-05`, `-09`); para bancário, consumidor aprovado |
| E3            | Dependentes e anexos                   | Bloco 5: dependentes e, se aprovados, foto e anexos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fichas e emendas; `DP-ADM-06`; `DP-ADM-11`; `DP-ADM-14`; upload habilitado                                                                                                                                                        |
| Fora da ordem | Portal do colaborador                  | Leitura e, depois, atualização pelo próprio titular — **dado a dado**, só depois de cada dado ter permissão e contrato próprios. Não faz parte da etapa E aprovada na T165, que é só a expansão dos blocos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Nova decisão do proprietário, que reabriria a T165 §5.2 (sem link e sem autopreenchimento); decisão própria do portal (ADR 0015); `DP-2E-14`; MFA                                                                                 |

### 9. Decisões pendentes abertas por esta ADR

Os responsáveis seguem a ADR 0012: finalidade, base legal, classificação,
retenção e descarte são de **RH + Jurídico**.

**Resolvida.** `DP-ADM-01` — aprovar esta ADR: modelo-alvo, classes de acesso,
matriz e regras de UX (responsável: proprietário) — foi **aprovada pelo
proprietário em 2026-10-16**, por instrução dele na abertura da T168. Ver o
`Status` e a nota de aprovação ao final. A decisão fica registrada aqui, e não
apagada, para preservar o histórico.

**Abertas.** `DP-ADM-02` a `DP-ADM-18`, na tabela abaixo, continuam pendentes e
inalteradas.

| ID          | Decisão pendente                                                                                                                                                                                  | Responsável                    | Liga-se a                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `DP-ADM-02` | Finalidade e base legal de cada categoria, pela ficha de tratamento                                                                                                                               | RH + Jurídico                  | `DP-11 (V2)`, `DP-14`, `DP-25 (V2)`                |
| `DP-ADM-03` | Retenção, descarte e exportação de cada categoria, e se o histórico de valores é guardado                                                                                                         | RH + Jurídico                  | `DP-15`, `DP-2E-15`, `PD-DOC-03`, RI-F2-3          |
| `DP-ADM-04` | Se o CPF passa a ser exigido para admitir                                                                                                                                                         | proprietário + RH + Jurídico   | `DP-2E-11`                                         |
| `DP-ADM-05` | Como detectar admissão duplicada sem usar documento como chave                                                                                                                                    | proprietário + engenharia      | ADR 0007, decisão 2                                |
| `DP-ADM-06` | Matriz fina de A2 e A3 por categoria, inclusive se o `master_tecnico` fica fora — o que exige emenda à ADR 0012, decisão 3                                                                        | proprietário + RH              | `PD-DOC-01`; ADR 0012                              |
| `DP-ADM-07` | MFA imposto e reautenticação para dado bancário e documento pessoal                                                                                                                               | Segurança + Produto            | `DS-MFA-01`, `DS-MFA-03`, `DP-19`                  |
| `DP-ADM-08` | Se filial é a unidade organizacional                                                                                                                                                              | RH                             | `DP-4`                                             |
| `DP-ADM-09` | Como colher e evidenciar dado autodeclarado (nome social, gênero, raça/etnia) enquanto o titular não participa do sistema                                                                         | RH + Jurídico                  | `DP-25 (V2)`                                       |
| `DP-ADM-10` | Modalidade contratual (prazo indeterminado ou determinado, experiência e outras) e se ela se relaciona com o tipo de vínculo; inclui período de experiência e data, duração e término de contrato | RH + Jurídico                  | ADR 0007 (tipo de vínculo sem enquadramento legal) |
| `DP-ADM-11` | Se a foto existe, para quê, e por qual caminho de upload                                                                                                                                          | proprietário + RH + Jurídico   | `DP-2E-04`, `-05`, `-09`                           |
| `DP-ADM-12` | Catálogos de localidade e consulta de endereço por CEP (integração externa)                                                                                                                       | proprietário + Segurança       | Constituição, integrações                          |
| `DP-ADM-13` | Proteção em repouso de identificação documental e dado bancário — decisão nova, sem gate existente equivalente                                                                                    | Segurança + engenharia         | gestão de chaves: `DS-SEC-01`, `DS-SEC-02`         |
| `DP-ADM-14` | Campos, finalidade e base legal de dependentes                                                                                                                                                    | RH + Jurídico                  | `DP-14`                                            |
| `DP-ADM-15` | Formato do erro por campo no contrato HTTP, sem refletir o valor enviado                                                                                                                          | engenharia + Segurança         | filtro global de exceções                          |
| `DP-ADM-16` | Deficiência: se e como se comprova, e formato, obrigatoriedade, acesso, finalidade, retenção e auditoria da informação e da comprovação                                                           | RH + Jurídico                  | `DP-14`, `PD-DOC-02`                               |
| `DP-ADM-17` | Ligar o horário ao vínculo funcional em vez de (colaborador, empresa), reabrindo decisões do RH, e quem opera horário na admissão                                                                 | RH + proprietário + engenharia | `DP-3J-19` (T035); T037                            |
| `DP-ADM-18` | Como associar marcações de ponto ao colaborador pelo CPF sem usá-lo como chave nem unicidade (decisão 5.8), e o regime de auditoria dessa leitura em lote                                         | proprietário + RH + engenharia | `DP-3J-20`; pacote da T148                         |

## O que esta ADR **não** decide

- **Nenhuma base legal e nenhum prazo de retenção**, para nenhuma categoria.
- **Nenhuma obrigatoriedade legal de campo.** "Admissão" na matriz significa
  "exigido pelo contrato do Evolli", não "exigido por lei".
- **Nenhuma regra trabalhista**: nenhuma regra de experiência, contrato por
  prazo, adicionais, jornada ou folha é criada ou inferida. Os campos que
  dependem delas ficam bloqueados ou fora de escopo, conforme a matriz.
- **Nenhuma mudança de RBAC**: as classes A2 e A3 são proposta de recurso novo,
  e A1 descreve o que já existe.
- **Não emenda a ADR 0007.** A lista fechada de quatro dados continua valendo
  até que cada categoria tenha ficha aprovada — e então a categoria entra por
  emenda ou ADR própria, como a ADR 0007 exige.
- **Não habilita upload** nem dado real (ADR 0011, ADR 0013).
- **Não decide o portal do colaborador**, só a condição para que ele avance.

## Consequências

**Positivas.** A próxima tarefa não precisa supor: cada campo pedido tem lugar,
classe, acesso e dependência declarados, e o que falta decidir tem
identificador e responsável. O dado pessoal nasce segregado, o que mantém o
caminho padrão de leitura incapaz de vazá-lo e permite eliminá-lo por
categoria quando a retenção for decidida. A admissão continua atômica e pequena.

**Negativas, aceitas.** O fluxo fica em duas fases — admitir, depois
complementar —, e não num único "Salvar" como na referência. Vários campos da
referência ficam fora, e parte do RH pode sentir falta deles; eles voltam por
emenda quando houver finalidade e consumidor. Cada categoria exige uma ficha,
o que torna o avanço mais lento e mais seguro.

**De manutenção.** Cada agregado novo traz recurso RBAC, rota, auditoria,
redação de log e testes próprios. A matriz desta ADR passa a ser a referência
de revisão: campo que não está nela, ou que está como "Fora de escopo", só entra
por emenda a esta ADR; campo "Bloqueado" só entra depois das decisões
listadas na matriz; e todo dado pessoal novo, qualquer que seja a classe, só com ficha aprovada,
emenda à ADR 0007 ou ADR própria e, se o `master_tecnico` ficar fora, emenda à
ADR 0012, decisão 3.

## Alternativas consideradas

- **Colunas novas em `Colaborador`.** Mais simples, mas expõe todo dado novo
  por todos os caminhos que já leem o colaborador e impede eliminar uma
  categoria sem tocar no cadastro. Rejeitada — é o que a Fatia 2, §4.7, já
  descartava.
- **Um campo livre de "dados adicionais" (JSON).** Flexível, mas sem validação,
  sem classificação, sem acesso por categoria, e porta de entrada para dado
  sensível por texto livre. Rejeitada.
- **Reproduzir o formulário de referência inteiro.** Entregaria campos sem
  finalidade e sem persistência real — contraria a regra R7 da ADR 0010 e a
  decisão da T165 sobre as imagens. Rejeitada.
- **Um único envio com os cinco blocos.** Juntaria categorias com governanças
  diferentes numa só transação, e a falha de uma derrubaria a admissão.
  Rejeitada em favor de admitir pelo bloco 1 e complementar depois.
- **Autopreenchimento pelo funcionário.** Rejeitada pelo proprietário na T165.

## Nota de aprovação (2026-10-16)

O proprietário aprovou esta ADR, resolvendo `DP-ADM-01`: o modelo-alvo, as
classes de acesso A1, A2 e A3, a matriz de campos e as regras de UX. O texto
original foi preservado.

**O que a aprovação não faz.** Não escolhe base legal nem prazo de retenção;
não fecha `DP-ADM-02` a `DP-ADM-18`; não aprova nenhuma ficha de tratamento;
e não dispensa a emenda à ADR 0007 (ou ADR própria) que a decisão 5.4 exige
para todo dado pessoal além dos quatro aprovados. Campo "Complementar" da
matriz continua entrando só depois da ficha da sua categoria.
