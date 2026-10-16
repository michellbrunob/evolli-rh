# Ficha de tratamento — Contatos do colaborador

Status: **aprovada pelo proprietário em 2026-10-16.**
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

| Item                                     | Resposta                                                                                                                                                                                                        | Origem                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Campos                                   | **e-mail pessoal**, **celular** e **telefone**. E-mail corporativo **não** entra: segue derivado de `access_user.email`                                                                                         | proprietário                                    |
| Formato e normalização                   | regra explícita da §3, sem presumir país                                                                                                                                                                        | avaliado na T169                                |
| Finalidade                               | **cadastro e comunicação operacional durante a relação de trabalho**                                                                                                                                            | proprietário                                    |
| Base legal principal                     | **execução do contrato**                                                                                                                                                                                        | proprietário                                    |
| Classificação                            | **A2 restrita**                                                                                                                                                                                                 | proprietário                                    |
| Titulares                                | o próprio colaborador                                                                                                                                                                                           | derivado: "contatos **do próprio** colaborador" |
| Destinatários e compartilhamento externo | **inexistente** — nenhuma integração, exportação ou envio a terceiro                                                                                                                                            | proprietário                                    |
| Módulo consumidor                        | Pessoas — o cadastro do colaborador                                                                                                                                                                             | derivado da finalidade                          |
| Perfis que leem e alteram                | `rh` e `dp`: leitura e edição **na empresa ativa**. `master_tecnico`: administrador global confiável, com leitura e edição em **qualquer empresa**, auditadas. `gestor`, `colaborador` e demais: **sem acesso** | proprietário                                    |
| Retenção                                 | **enquanto o vínculo estiver ativo**. Após o desligamento, **bloquear o uso operacional**, **reter por 2 anos** e então **eliminar ou anonimizar**, salvo litígio, ordem judicial ou obrigação formal           | proprietário                                    |
| Histórico de valores                     | **não guardado**: só o valor vigente. A auditoria nunca registra valores                                                                                                                                        | derivado da regra de auditoria                  |
| Auditoria                                | **criação, leitura, edição, exportação e exclusão**, com metadados e **campos afetados**, **nunca** valores de contato                                                                                          | proprietário                                    |
| Necessidade de RIPD                      | **não exigido nesta fase**                                                                                                                                                                                      | proprietário                                    |
| Autenticação reforçada (MFA adicional)   | **não exigida nesta fase**                                                                                                                                                                                      | proprietário                                    |
| Proteção em repouso                      | adequada ao padrão atual do projeto para dado pessoal A2 — §2                                                                                                                                                   | avaliado na T169                                |
| Origem e evidência da coleta             | **não especificadas** pela ficha. O sistema registra **quem** gravou e **quando**, não a evidência documental da coleta                                                                                         | lacuna registrada                               |

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

- **Eliminação ou anonimização após 2 anos do desligamento:** a regra está
  aprovada, mas o processo que a executa **não** existe nesta fatia.
- **Exportação e exclusão:** não há rota de nenhuma das duas nesta fatia, então
  não há evento a auditar. A auditoria delas é obrigatória quando existirem.
- **Origem e evidência da coleta:** lacuna da ficha, registrada na §1.
