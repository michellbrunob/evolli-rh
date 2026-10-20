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
[ficha de Contatos](ficha-tratamento-contatos-colaborador.md) (T169; modelo
desta ficha, e a fonte única dos três contatos).

Esta ficha cobre **só o que a T177 implementa**. Contatos (e-mail pessoal,
celular e telefone) continuam na ficha da T169, sem mudança. Os demais campos
das referências visuais estão na matriz de cobertura da PR da T177, cada um
com destino.

## 1. A ficha

"Proposta" é o valor que a T177 implementou e que depende de aprovação;
"derivado" é consequência de decisão já aprovada.

| Item                                     | Resposta                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campos — perfil pessoal                  | data de nascimento, sexo, saudação, estado civil, nacionalidade, naturalidade, escolaridade, curso, nome do pai e nome da mãe. **Nome completo** continua sendo o `nome` do colaborador, já aprovado                                                                  |
| Campos — endereço                        | país, CEP, logradouro, número, complemento, bairro, cidade e estado                                                                                                                                                                                                   |
| Obrigatoriedade                          | **todos opcionais** (proposta). A ADR 0016 os classifica como "Complementar": não são exigidos para admitir                                                                                                                                                           |
| Formato e normalização                   | texto aparado, com espaços repetidos colapsados; vazio é `null`; sem caractere de controle; limites por campo iguais aos CHECKs do banco. Data de nascimento de 01/01/1900 até hoje. CEP com letras, números, espaço e hífen, de 3 a 12 caracteres. Sem presumir país |
| Catálogos                                | **nenhum** nesta entrega: o sistema não tem catálogo canônico de sexo, saudação, estado civil, escolaridade, país, UF ou município, e a T177 não inventa taxonomia. País começa sugerido como "Brasil", editável                                                      |
| Consulta de CEP                          | **nenhuma**: não há integração externa (ADR 0016, `DP-ADM-12`)                                                                                                                                                                                                        |
| Finalidade                               | **cadastro do colaborador durante a relação de trabalho** (proposta, no mesmo termo da ficha de Contatos)                                                                                                                                                             |
| Base legal principal                     | **execução do contrato** (proposta). O eventual enquadramento de algum campo como dado pessoal sensível é decisão de RH + Jurídico (ADR 0012, decisão 1; ADR 0016, decisão 5)                                                                                         |
| Classificação                            | **A2 — Pessoal** (ADR 0016, decisão 4). Data de nascimento, nacionalidade e endereço já são A2 na matriz da ADR 0016; sexo, saudação, estado civil, naturalidade, escolaridade, curso e nome dos pais, ali "Fora de escopo", entram como A2 por esta ficha            |
| Titulares                                | o próprio colaborador; nome do pai e nome da mãe identificam **terceiros**, como dado de filiação, sem outro dado deles                                                                                                                                               |
| Destinatários e compartilhamento externo | **inexistente** — nenhuma integração, exportação ou envio a terceiro                                                                                                                                                                                                  |
| Módulo consumidor                        | Pessoas — o cadastro do colaborador                                                                                                                                                                                                                                   |
| Perfis que leem e alteram                | `rh` e `dp`: leitura e edição **na empresa ativa**. `master_tecnico`: **sem acesso** — a exceção aprovada para ele vale só para contatos (Emenda 1 da ADR 0012). `gestor`, `colaborador` e demais: **sem acesso**                                                     |
| Retenção                                 | **enquanto o vínculo estiver ativo**; após o desligamento, **bloquear o uso operacional** (implementado), **reter por 2 anos** e então **eliminar ou anonimizar** (proposta, no mesmo termo da ficha de Contatos; o processo de eliminação não é desta entrega)       |
| Histórico de valores                     | **não guardado**: só o valor vigente. A auditoria nunca registra valores                                                                                                                                                                                              |
| Auditoria                                | **criação, leitura e edição**, com metadados e **nomes dos campos** alcançados, **nunca** valores (`audit_event` e `dados_pessoais_colaborador_evento`). Exportação e exclusão não têm rota, e por isso não têm verbo                                                 |
| Necessidade de RIPD                      | **não exigido nesta fase** (proposta)                                                                                                                                                                                                                                 |
| Autenticação reforçada (MFA adicional)   | **não exigida**: o MFA imposto da ADR 0016 (decisão 5.9) vale para número de documento e dado bancário, e nenhum dos dois está aqui                                                                                                                                   |
| Proteção em repouso                      | coluna em texto com papéis de banco segregados, o padrão do projeto para dado pessoal A2 não sensível (mesma avaliação da ficha de Contatos, §2). Dado real segue barrado por `DS-BKP-02` e `DS-OPS-01`                                                               |
| Origem e evidência da coleta             | **não especificadas**. O sistema registra **quem** gravou e **quando**                                                                                                                                                                                                |

## 2. O que esta ficha não autoriza

Nome social, gênero, raça/etnia, foto, deficiência, contato de emergência,
e-mail corporativo, documentos (CPF, RG, CNH, CTPS, PIS, título de eleitor,
reservista), estrangeiro, dados bancários, dependentes, saúde, dado sindical,
quantidade de filhos, tamanho de camisa e dados contratuais avançados. Cada um
tem destino na matriz de cobertura da T177.
