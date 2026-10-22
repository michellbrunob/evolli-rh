# Ficha de tratamento — Contatos do colaborador

Status: **aprovada pelo proprietário em 2026-10-16**; retenção alterada pela
proprietária em 2026-10-20 (§7).
Categoria: **Contatos do colaborador** (agregado "Contatos e endereço" da
ADR 0016, recortado aos três campos abaixo; endereço e contato de emergência
**não** fazem parte desta ficha).
Tarefa que a formaliza: T169.
Relacionado:
[ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md)
(decisão 5.4 — a ficha como gate da categoria),
[ADR 0007, Emenda 4](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
(autoriza a categoria além dos quatro dados aprovados),
[ADR 0012, Emenda 1](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
(`master_tecnico` em contatos),
[bloqueio da T168](t168-contatos-bloqueio-ficha.md) (a ficha em branco que
esta preenche).

## 1. A ficha

Cada linha diz **de onde** veio a resposta. "Proprietário" é a aprovação dada
em 2026-10-16; "derivado" é consequência direta de outra linha ou de decisão já
aprovada; "avaliado na T169" é verificação técnica registrada na §2.

| Item                                     | Resposta                                                                                                                                                                                                                                                                                                          | Origem                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Campos                                   | **e-mail pessoal**, **celular** e **telefone**. E-mail corporativo **não** entra: segue derivado de `access_user.email`                                                                                                                                                                                           | proprietário                                                       |
| Formato e normalização                   | regra explícita da §3, sem presumir país                                                                                                                                                                                                                                                                          | avaliado na T169                                                   |
| Finalidade                               | **cadastro e comunicação operacional durante a relação de trabalho**                                                                                                                                                                                                                                              | proprietário                                                       |
| Base legal principal                     | **execução do contrato**                                                                                                                                                                                                                                                                                          | proprietário                                                       |
| Classificação                            | **A2 restrita**                                                                                                                                                                                                                                                                                                   | proprietário                                                       |
| Titulares                                | o próprio colaborador                                                                                                                                                                                                                                                                                             | derivado: "contatos **do próprio** colaborador"                    |
| Destinatários e compartilhamento externo | **inexistente** — nenhuma integração, exportação ou envio a terceiro                                                                                                                                                                                                                                              | proprietário                                                       |
| Módulo consumidor                        | Pessoas — o cadastro do colaborador                                                                                                                                                                                                                                                                               | derivado da finalidade                                             |
| Perfis que leem e alteram                | `rh` e `dp`: leitura e edição **na empresa ativa**. `master_tecnico`: administrador global confiável, com leitura e edição em **qualquer empresa**, auditadas. `gestor`, `colaborador` e demais: **sem acesso**                                                                                                   | proprietário                                                       |
| Retenção                                 | **sem exclusão nem anonimização automática** de dados de funcionários. Após o desligamento, **bloquear o uso operacional**, com os **registros vigentes e a trilha de auditoria preservados**. Qualquer mudança futura desta política exige **decisão explícita da proprietária** e avaliação de RH/Jurídico (§7) | proprietária (alteração de 2026-10-20; antes, 2 anos e eliminação) |
| Histórico de valores                     | **não guardado**: o sistema mantém só o **valor vigente** de cada contato e os **metadados de auditoria** (quem, quando, ação e nomes dos campos), nunca versões anteriores dos valores. A auditoria nunca registra valores                                                                                       | derivado da regra de auditoria                                     |
| Auditoria                                | **criação, leitura, edição, exportação e exclusão**, com metadados e **campos afetados**, **nunca** valores de contato                                                                                                                                                                                            | proprietário                                                       |
| Necessidade de RIPD                      | **não exigido nesta fase**                                                                                                                                                                                                                                                                                        | proprietário                                                       |
| Autenticação reforçada (MFA adicional)   | **não exigida nesta fase**                                                                                                                                                                                                                                                                                        | proprietário                                                       |
| Proteção em repouso                      | adequada ao padrão atual do projeto para dado pessoal A2 — §2                                                                                                                                                                                                                                                     | avaliado na T169                                                   |
| Origem e evidência da coleta             | **não especificadas** pela ficha. O sistema registra **quem** gravou e **quando**, não a evidência documental da coleta                                                                                                                                                                                           | lacuna registrada                                                  |

## 2. Proteção em repouso — avaliação

A tarefa mandava confirmar, **antes** da migration, que os controles existentes
são adequados ao padrão atual do projeto.

- A Constituição exige cifragem em repouso para **dado sensível**, "where
  applicable" (`constitution.md:42-44`). Contato **não é dado sensível** e foi
  classificado como **A2 restrita**.
- A ADR 0016 limitou a proteção em coluna a **identificação documental e dado
  bancário** (A3), em `DP-ADM-13`. Contato não está nessa decisão.
- O padrão atual do projeto para dado pessoal não sensível — nome e matrícula —
  é **coluna em texto**, protegida por papéis de banco segregados
  (`evolli_app` só com DML) e pela autorização no servidor. A única cifra em
  coluna é a do segredo de MFA, que é credencial (ADR 0003, decisão 7).
- A cifra do armazenamento e dos backups (`DS-BKP-02`) e o gate-mestre
  `DS-OPS-01` seguem **pendentes**, e barram **qualquer dado real** em qualquer
  ambiente — para todo dado pessoal igualmente, não só para contatos.

**Conclusão:** os controles são adequados ao padrão atual para esta classe. O
contato fica no mesmo nível do nome do colaborador, e **dado real continua
barrado** pelos gates de segurança operacional.

## 3. Formato e normalização

Não havia padrão de telefone no projeto, e a ficha não fixa país. A regra é
explícita e não presume dado adicional:

- **E-mail pessoal:** espaços das pontas removidos e caixa baixa — o mesmo
  tratamento que o projeto já dá ao e-mail de conta —, formato de e-mail válido
  e até 254 caracteres.
- **Celular e telefone:** aceitam dígitos e, só como separadores, espaço,
  parênteses, hífen e ponto, com `+` opcional apenas no início. A normalização
  remove os separadores e guarda **só os dígitos**, precedidos de `+` quando ele
  foi informado. Ficam entre **8 e 15 dígitos** — 15 é o limite da numeração
  internacional (E.164). **Não** se presume DDD, DDI, país nem distinção de
  formato entre celular e telefone.

## 4. O que esta ficha revê

**A decisão da T165, §5.2, dizia que o `master_tecnico` "não cria, não edita e
não admite pessoas".** Para **contatos**, o proprietário decidiu diferente: ele
lê e edita, em qualquer empresa, com auditoria. A regra da T165 continua valendo
para todo o resto — admissão, vínculo, movimentação —, e a exceção está
formalizada na Emenda 1 da ADR 0012.

## 5. O que fica pendente

- ~~**Eliminação ou anonimização após 2 anos do desligamento**~~ —
  **superada** pela decisão de 2026-10-20 (§7): não há eliminação nem
  anonimização automática, e nenhum processo será construído para isso sem
  nova decisão.
- **Exportação e exclusão:** não há rota de nenhuma das duas nesta fatia, então
  não há evento a auditar. A auditoria delas é obrigatória quando existirem.
- **Origem e evidência da coleta:** lacuna da ficha, registrada na §1.

## 6. Como a T169 aplicou a ficha

Escolhas de implementação. Nenhuma delas muda o que o proprietário aprovou;
onde a ficha é literal, a implementação a segue ao pé da letra.

- **Por colaborador e empresa.** O contato tem `empresa_id` próprio e é único
  por par. Um colaborador com vínculo em duas empresas tem dois registros: o RH
  de uma nunca lê o que o RH da outra gravou.
- **Bloqueio após o desligamento.** Sem vínculo previsto ou ativo na empresa, a
  leitura responde `bloqueado`, sem valor, e a edição é recusada (409). O valor
  continua guardado, como manda a retenção.
- **Trilha de toda consulta.** A ficha audita a leitura sem distinguir leitura
  com valor de leitura sem valor, e a Emenda 1 da ADR 0012 diz que "toda
  leitura e toda edição" são auditadas. Por isso **toda consulta** aos
  contatos deixa trilha, com o resultado explícito:

  | Operação                                                                            | Resultado no evento                          | `audit_event`                                            |
  | ----------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
  | `GET` com valor                                                                     | `valores_devolvidos`                         | `pessoas.contato.consultado`, `success`                  |
  | `GET` sem contato gravado                                                           | `sem_registro`                               | `pessoas.contato.consultado`, `success`                  |
  | `GET` de contato bloqueado                                                          | `bloqueado`                                  | `pessoas.contato.consultado`, `success`                  |
  | `GET` do `master_tecnico` sem empresa ativa, com colaborador em mais de uma empresa | `empresa_ambigua`                            | `pessoas.contato.consultado`, `failure`, **sem empresa** |
  | `PUT` que cria                                                                      | `gravado`                                    | `pessoas.contato.criado`, `success`                      |
  | `PUT` que altera                                                                    | `gravado`                                    | `pessoas.contato.atualizado`, `success`                  |
  | `PUT` sem mudança efetiva (devolve os valores gravados)                             | `sem_alteracao`, registrado como **leitura** | `pessoas.contato.consultado`, `success`                  |
  | `PUT` de contato bloqueado                                                          | `bloqueado`                                  | `pessoas.contato.atualizado`, `failure`                  |
  | `PUT` com empresa ambígua                                                           | `empresa_ambigua`                            | `pessoas.contato.atualizado`, `failure`, **sem empresa** |

  A trilha é gravada na **mesma transação** da operação: se ela falhar, nada é
  devolvido nem gravado. A tentativa com empresa ambígua é registrada **sem
  empresa**, porque nenhuma pôde ser resolvida naquele ponto. Colaborador
  inexistente, fora do escopo ou perfil sem acesso deixam `authorization_denied`,
  pela regra já existente (ADR 0004).

  **Correção registrada.** A primeira versão desta seção, no commit `ae2544c`,
  dizia que só a leitura com valor devolvido era auditada. Esse critério **não
  foi aprovado** pelo proprietário e foi retirado; o modelo de eventos foi
  corrigido pela migration `20261016130000_contatos_auditoria_toda_consulta`.

- **Conteúdo da trilha.** O evento de tratamento (`contato_colaborador_evento`)
  guarda o colaborador, a empresa quando conhecida, o contato quando existe, a
  ação, o resultado, os **nomes** dos campos alcançados, o ator e o
  `request_id`. A trilha formal (`audit_event`) guarda o ator, o papel, a
  empresa real (ou nenhuma, quando não resolvida), a ação, o resultado, o
  recurso `contato_colaborador`, o id do colaborador e o `request_id`. Como em
  todo evento da trilha formal (ADR 0004), ela também guarda o **IP de origem**
  e o **user-agent truncado a 300 caracteres**: metadados de segurança herdados
  da infraestrutura de auditoria, não conteúdo dos contatos nem cabeçalho bruto.
  **Nunca** entram valores de contato, corpo da requisição ou cabeçalhos brutos.
- **Exclusão.** `evolli_app` não tem `DELETE` no contato nem `UPDATE`/`DELETE`
  no evento. Pela decisão de 2026-10-20 (§7), não há processo de eliminação
  previsto; uma mudança futura da política, se decidida, traria o privilégio
  junto com a sua própria auditoria.

Migrations: `20261016120000_contatos_colaborador` e `20261016130000_contatos_auditoria_toda_consulta`, criadas e não aplicadas localmente.

## 7. Retenção — alteração de 2026-10-20

A retenção aprovada em 2026-10-16 (reter por 2 anos após o desligamento e
então eliminar ou anonimizar) foi **substituída pela proprietária em
2026-10-20**, na mesma decisão que fixou a retenção dos dados pessoais e do
endereço ([ficha da T177](ficha-tratamento-dados-pessoais-endereco-colaborador.md), §5):

- **não** excluir nem anonimizar automaticamente dados de funcionários;
- após o desligamento, **bloquear o uso operacional** — o que o sistema já faz:
  com todo vínculo na empresa encerrado, a leitura responde `bloqueado`, sem
  valor, e a edição é recusada, com a tentativa na trilha;
- **preservar** os registros vigentes e a trilha de auditoria;
- o sistema **não** mantém versões históricas dos valores de perfil nem de
  contato: só o valor vigente e os metadados de auditoria;
- qualquer mudança futura desta política exige **decisão explícita da
  proprietária** e avaliação de RH/Jurídico.

Nenhum código muda com esta alteração: o processo de eliminação dos 2 anos
nunca foi implementado.

## 8. Alteração de 2026-10-21 (T179) — telefone brasileiro e e-mail único na empresa

Por decisão da proprietária ([decisão da T179](t179-confirmacao-admissao-duplicidade-telefones.md)), a regra da §3 muda:

- **Celular e telefone:** só números **brasileiros**, gravados em `+55` + DDD +
  número — DDD de dois dígitos de 1 a 9; celular com 9 dígitos iniciado por 9;
  fixo com 8 dígitos iniciado por 2 a 5. A entrada aceita `+55`, `55`,
  parênteses, espaço, hífen e ponto. A tela mostra `(00) 0000-0000` ou
  `(00) 00000-0000`. Número estrangeiro não é aceito nesta etapa.
- **Telefones já gravados:** a migration da T179 converte só o que tem forma
  inequívoca; o que não puder ser convertido com segurança fica como está e
  entra na relação técnica de revisão (`revisao_normalizacao_cadastro`), com o
  registro e o nome do campo, **nunca o valor**.
- **E-mail pessoal:** passa a ser **único na mesma empresa**, por restrição do
  banco; pode repetir em empresa diferente. O conflito responde 409 com o campo
  e sem o valor, e só na empresa ativa.

Finalidade, base legal, classificação, retenção e escopo de acesso não mudam.

## 9. Alteração de 2026-10-21 (T179) — contatos opcionais

Pela [decisão de obrigatoriedade](t179-obrigatoriedade-cadastro-colaborador.md), **e-mail pessoal, celular e
telefone passam a opcionais**, na admissão e na edição. Admissão sem nenhum
contato não cria registro; campo vazio grava `null`. Quando informados, o
formato continua conferido (§3 e §8) e o e-mail pessoal continua único na
empresa (§8). Contato de emergência continua sem campo, opcional quando for
liberado. Finalidade, base legal, classificação, retenção e escopo de acesso
não mudam.

## 10. Alteração de 2026-10-22 (T179) — remoção de todos os contatos

Quando quem já tem contatos limpa e salva os três campos, o registro passa a
**inativo** (`ativo = false`): sem nenhum valor, preservado só para a trilha
de auditoria, e lido como "sem registro" — o mesmo estado de quem nunca teve
contato. **Não há exclusão física**: a rota de exclusão continua inexistente
(§5), `evolli_app` continua sem `DELETE` e os eventos apontam para o registro.
A remoção fica na trilha como **edição**, com os nomes dos campos removidos e
nunca os valores; a leitura posterior registra `sem_registro` apontando para o
registro inativo. Informar um contato depois reativa o mesmo registro. O banco
garante a coerência: registro ativo tem ao menos um contato, e inativo, nenhum
(migration `20261022120000_contato_colaborador_inativo`). Finalidade, base
legal, classificação, retenção e escopo de acesso não mudam.
