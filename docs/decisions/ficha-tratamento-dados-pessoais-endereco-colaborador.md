# Ficha de tratamento — Dados pessoais básicos e endereço do colaborador

Status: **proposta, aguardando aprovação da proprietária.** O merge da T177
depende desta aprovação, por decisão dela na abertura da tarefa.
Categorias: **Perfil pessoal** e **Endereço** (agregados "Perfil pessoal" e
"Contatos e endereço" da ADR 0016), recortadas aos campos abaixo.
Tarefa que a formaliza: T177 — Módulo 1 do cadastro de colaborador.
Relacionado:
[ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md)
(decisão 5.4 — a ficha como gate da categoria),
[ADR 0007, Emenda 5](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
(proposta: autoriza as categorias além dos dados já aprovados),
[ADR 0012, Emenda 2](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
(`master_tecnico` em dados pessoais e endereço),
[ficha de Contatos](ficha-tratamento-contatos-colaborador.md) (T169; modelo
desta ficha, e a fonte única dos três contatos).

Esta ficha cobre **só o que a T177 implementa**. Contatos (e-mail pessoal,
celular e telefone) continuam na ficha da T169, sem mudança de regra, e nesta
entrega passam a ser coletados na admissão. Os demais campos das referências
visuais estão na matriz de cobertura da PR da T177, cada um com destino.

## 1. A ficha

Cada linha diz **de onde** veio a resposta:

- **proprietária** — decisão já tomada pela proprietária, com a data;
- **proposta** — valor que a T177 implementou ou redigiu e que **só vale
  depois da aprovação da proprietária**; até lá, não é decisão tomada;
- **derivado** — consequência direta de outra linha ou de decisão já aprovada.

| Item                                     | Resposta                                                                                                                                                                                                                                                                                                                                                                                                         | Origem                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Campos — perfil pessoal                  | data de nascimento, sexo, saudação, estado civil, nacionalidade, naturalidade, escolaridade, curso, nome do pai e nome da mãe. **Nome completo** continua sendo o `nome` do colaborador, já aprovado                                                                                                                                                                                                             | proprietária (recorte do Módulo 1, 2026-10-20)                            |
| Campos — endereço                        | país, CEP, logradouro, número, complemento, bairro, cidade e estado                                                                                                                                                                                                                                                                                                                                              | proprietária (recorte do Módulo 1, 2026-10-20)                            |
| Obrigatoriedade — campo a campo          | ver a §2. **Obrigatórios na admissão:** nome completo, data de nascimento, e-mail pessoal, celular e telefone. **Opcionais:** todos os demais campos desta ficha                                                                                                                                                                                                                                                 | proprietária (2026-10-20)                                                 |
| Formato e normalização                   | texto aparado, com espaços repetidos colapsados; vazio é `null`; sem caractere de controle; limites por campo iguais aos CHECKs do banco. Data de nascimento de 01/01/1900 até hoje. CEP com letras, números, espaço e hífen, de 3 a 12 caracteres. Sem presumir país                                                                                                                                            | avaliado na T177                                                          |
| Catálogos                                | **nenhum** nesta entrega: o sistema não tem catálogo canônico de sexo, saudação, estado civil, escolaridade, país, UF ou município, e a T177 não inventa taxonomia. País começa sugerido como "Brasil", editável                                                                                                                                                                                                 | proprietária (país editável, 2026-10-20); o resto, avaliado na T177       |
| Consulta de CEP                          | **nenhuma**: não há integração externa (ADR 0016, `DP-ADM-12`)                                                                                                                                                                                                                                                                                                                                                   | proprietária (2026-10-20)                                                 |
| Finalidade                               | **cadastro do colaborador durante a relação de trabalho**, no mesmo termo da ficha de Contatos                                                                                                                                                                                                                                                                                                                   | **proposta**                                                              |
| Base legal principal                     | **execução do contrato**. O eventual enquadramento de algum campo como dado pessoal sensível é decisão de RH + Jurídico (ADR 0012, decisão 1; ADR 0016, decisão 5)                                                                                                                                                                                                                                               | **proposta**                                                              |
| Classificação                            | **A2 — Pessoal** (ADR 0016, decisão 4), com a mesma diferença já registrada para Contatos: o `master_tecnico` lê e edita (nota de convergência da T177 na ADR 0016). A matriz da ADR 0016 já lista data de nascimento, nacionalidade e endereço como A2; sexo, saudação, estado civil, naturalidade, escolaridade, curso e nome dos pais, ali "Fora de escopo", **só entram como A2 se esta ficha for aprovada** | **proposta**                                                              |
| Titulares                                | o próprio colaborador; nome do pai e nome da mãe identificam **terceiros**, como dado de filiação, sem outro dado deles                                                                                                                                                                                                                                                                                          | derivado dos campos                                                       |
| Destinatários e compartilhamento externo | **inexistente** — nenhuma integração, exportação ou envio a terceiro                                                                                                                                                                                                                                                                                                                                             | derivado: a T177 não cria integração                                      |
| Módulo consumidor                        | Pessoas — o cadastro do colaborador                                                                                                                                                                                                                                                                                                                                                                              | derivado da finalidade                                                    |
| Perfis que leem e alteram                | `rh` e `dp`: leitura e edição **na empresa ativa**. `master_tecnico`: cargo de confiança, com leitura e edição em **qualquer empresa**, auditadas — com empresa ativa, **só nela**; sem empresa ativa, na empresa real do vínculo (§3). `gestor`, `colaborador` e demais: **sem acesso**                                                                                                                         | proprietária (`master_tecnico` acessa tudo, 2026-10-20); demais, derivado |
| Retenção                                 | **enquanto o vínculo estiver ativo**; após o desligamento, **bloquear o uso operacional**, **reter por 2 anos** e então **eliminar ou anonimizar**, no mesmo termo da ficha de Contatos. O bloqueio após o desligamento já está implementado; o processo de eliminação não é desta entrega                                                                                                                       | **proposta**                                                              |
| Histórico de valores                     | **não guardado**: só o valor vigente. A auditoria nunca registra valores                                                                                                                                                                                                                                                                                                                                         | derivado da regra de auditoria                                            |
| Auditoria                                | **criação, leitura e edição**, com metadados e **nomes dos campos** alcançados, **nunca** valores (`audit_event` e `dados_pessoais_colaborador_evento`). Exportação e exclusão não têm rota, e por isso não têm verbo                                                                                                                                                                                            | derivado da regra de auditoria (ficha de Contatos)                        |
| Necessidade de RIPD                      | **não exigido nesta fase**                                                                                                                                                                                                                                                                                                                                                                                       | **proposta**                                                              |
| Autenticação reforçada (MFA adicional)   | **não exigida**: o MFA imposto da ADR 0016 (decisão 5.9) vale para número de documento e dado bancário, e nenhum dos dois está aqui                                                                                                                                                                                                                                                                              | derivado da ADR 0016                                                      |
| Proteção em repouso                      | coluna em texto com papéis de banco segregados, o padrão do projeto para dado pessoal A2 não sensível (mesma avaliação da ficha de Contatos, §2). Dado real segue barrado por `DS-BKP-02` e `DS-OPS-01`                                                                                                                                                                                                          | avaliado na T177                                                          |
| Origem e evidência da coleta             | **não especificadas**. O sistema registra **quem** gravou e **quando**                                                                                                                                                                                                                                                                                                                                           | derivado: nenhuma decisão a respeito                                      |

**O que depende da aprovação:** as linhas marcadas **proposta** — finalidade,
base legal, classificação, retenção e RIPD. Aprovar a ficha as torna decisão;
qualquer ajuste pedido pela proprietária muda a ficha antes do merge.

## 2. Obrigatoriedade, campo a campo

A mesma regra vale no contrato da API (`POST /v1/colaboradores` e
`PUT /v1/colaboradores/:colaboradorId/dados-pessoais`), na tela de Nova
admissão (asterisco e "obrigatório" para leitor de tela; "opcional" no rótulo)
e no banco (`data_nascimento` NOT NULL).

| Campo              | Bloco          | Na admissão     | Observação                                       |
| ------------------ | -------------- | --------------- | ------------------------------------------------ |
| Nome completo      | Dados pessoais | **obrigatório** | o `nome` do colaborador, já aprovado             |
| Data de nascimento | Dados pessoais | **obrigatório** | também na edição: todo perfil gravado tem a data |
| Sexo               | Dados pessoais | opcional        | texto, sem catálogo                              |
| Saudação           | Dados pessoais | opcional        |                                                  |
| Estado civil       | Dados pessoais | opcional        |                                                  |
| Nacionalidade      | Dados pessoais | opcional        |                                                  |
| Naturalidade       | Dados pessoais | opcional        |                                                  |
| Escolaridade       | Dados pessoais | opcional        |                                                  |
| Curso              | Dados pessoais | opcional        |                                                  |
| Nome do pai        | Dados pessoais | opcional        |                                                  |
| Nome da mãe        | Dados pessoais | opcional        |                                                  |
| País               | Endereço       | opcional        | sugerido como "Brasil", editável                 |
| CEP                | Endereço       | opcional        | sem consulta externa                             |
| Logradouro         | Endereço       | opcional        |                                                  |
| Número             | Endereço       | opcional        |                                                  |
| Complemento        | Endereço       | opcional        |                                                  |
| Bairro             | Endereço       | opcional        |                                                  |
| Cidade             | Endereço       | opcional        |                                                  |
| Estado             | Endereço       | opcional        |                                                  |
| E-mail pessoal     | Contatos       | **obrigatório** | ficha da T169; os três contatos vão juntos       |
| Celular            | Contatos       | **obrigatório** | ficha da T169                                    |
| Telefone           | Contatos       | **obrigatório** | ficha da T169                                    |

CPF **não** está nesta ficha nem nesta entrega: é do módulo de documentos (matriz
de cobertura da PR da T177).

**País sugerido:** como a tela de Nova admissão começa com País = "Brasil",
uma admissão em que o RH não toca no endereço grava um endereço só com o país
(e o evento de criação registra o campo `pais`). Para não gravar endereço
nenhum, basta apagar o país. É o comportamento aprovado do país sugerido e
editável, registrado aqui para não parecer dado digitado.

Quem foi admitido **antes** da T177 não tem perfil, endereço nem contato
gravados: as consultas respondem `sem_registro`, sem erro. A obrigatoriedade
vale para cada nova admissão.

## 3. Escopo do `master_tecnico`

Por decisão da proprietária (2026-10-20), o `master_tecnico` é cargo de
confiança e acessa dados pessoais e endereço em qualquer empresa (ADR 0012,
Emenda 2), no mesmo desenho já aprovado para contatos:

- **com empresa ativa**, lê e edita **só nela**: colaborador de outra empresa
  responde 404, como para qualquer perfil fora do escopo;
- **sem empresa ativa**, lê e edita na **empresa real do vínculo** do
  colaborador, e a trilha registra essa empresa;
- **sem empresa ativa, com colaborador vinculado a mais de uma empresa**, nada
  é lido nem gravado: a resposta é 409, e a trilha registra a tentativa sem
  empresa (`empresa_ambigua`), sem campo e sem valor. A empresa se escolhe pelo
  contexto ativo (T163).

A **admissão** em si continua sendo de `rh` e `dp`: a capacidade de admitir
(`colaborador`/`create`) não muda nesta entrega. Ver a Emenda 2 da ADR 0012.

## 4. O que esta ficha não autoriza

Nome social, gênero, raça/etnia, foto, deficiência, contato de emergência,
e-mail corporativo, documentos (CPF, RG, CNH, CTPS, PIS, título de eleitor,
reservista), estrangeiro, dados bancários, dependentes, saúde, dado sindical,
quantidade de filhos, tamanho de camisa, fuso horário e dados contratuais
avançados. Cada um tem destino na matriz de cobertura da T177.
