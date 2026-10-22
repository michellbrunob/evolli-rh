# Decisão — obrigatoriedade do cadastro de colaborador (T179)

Status: **decidida pela proprietária em 2026-10-21.**
Tarefa que a aplica: T179 (o contrato da admissão muda nesta mesma PR).
Substitui, quanto à obrigatoriedade: a [decisão da T177](ficha-tratamento-dados-pessoais-endereco-colaborador.md)
(e-mail pessoal, celular e telefone obrigatórios) e a decisão 5 da
[decisão da T179](t179-confirmacao-admissao-duplicidade-telefones.md)
(Unidade obrigatória na Nova admissão).
Relacionado: [ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md),
[ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md),
[ficha de Contatos](ficha-tratamento-contatos-colaborador.md),
[Baseline V1 da Fatia 2](etapa1-fatia2-colaboradores-baseline-v1.md).

A referência visual serviu só para a lista de campos e a obrigatoriedade;
nada da identidade visual dela foi copiado.

## 1. A decisão, por seção

| Seção                  | Obrigatório                                              | Opcional                                                                                                                                  | Bloqueado até gate/ficha (obrigatoriedade futura registrada)                                                                                          |
| ---------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dados pessoais         | Nome completo, data de nascimento                        | E-mail pessoal, Sexo (lista fechada), saudação, estado civil, escolaridade, curso, nacionalidade, naturalidade, nome do pai e nome da mãe | **Gênero — obrigatório quando liberado** (`DP-ADM-09`); nome social, raça/etnia, foto, PcD e tipo — opcionais quando liberados                        |
| Endereço               | —                                                        | Todos, inclusive o CEP (o ViaCEP segue só como sugestão)                                                                                  | —                                                                                                                                                     |
| Contatos               | —                                                        | E-mail pessoal, celular e telefone                                                                                                        | Contato de emergência — opcional quando liberado. E-mail corporativo: derivado da conta de acesso, sem campo próprio                                  |
| Dados contratuais      | Departamento, Cargo, data de admissão e tipo de vínculo* | Matrícula, Unidade, Área, Equipe, Centro de custo                                                                                         | Filial (`DP-ADM-08`), turno (`DP-ADM-17`) e os demais contratuais (`DP-ADM-10`) — opcionais quando liberados                                          |
| Documentos             | —                                                        | —                                                                                                                                         | **CPF — obrigatório quando, e somente quando, o módulo de documentos e a sua ficha forem autorizados** (`DP-ADM-04`); os demais documentos, opcionais |
| Bancários, dependentes | —                                                        | —                                                                                                                                         | Bloqueados até as suas fichas (`DP-ADM-13`, `DP-ADM-14`)                                                                                              |

\* A diretriz lista o **tipo de vínculo** como opcional. Ele é obrigatório no
banco e usado por ponto, gestor e solicitações; por decisão da proprietária
(2026-10-21), **continua obrigatório nesta etapa**, e a opcionalidade fica
registrada para uma tarefa própria que revise esses módulos.

**E-mail pessoal.** A diretriz o lista como obrigatório em Dados pessoais e
como opcional em Contatos. No Evolli ele é **um campo só** (em Dados pessoais
desde a T178). A proprietária decidiu (2026-10-21): **opcional**. Quando
informado, continua **único na empresa**.

**Matrícula.** Decisão da proprietária (2026-10-21): **opcional** na Nova
admissão. Quando informada, segue o padrão e continua **única na empresa**. O
novo vínculo de colaborador existente (`POST /v1/vinculos`) não muda.

## 2. Sexo em opções fechadas

| Opção na tela | Valor gravado  |
| ------------- | -------------- |
| Feminino      | `feminino`     |
| Masculino     | `masculino`    |
| Intersexo     | `intersexo`    |
| Não informar  | `nao_informar` |

- **Opcional:** sem seleção, o campo fica vazio (`null`). "Não informar" é uma
  escolha explícita, diferente de não ter escolhido.
- **Sem texto livre:** o cliente e o servidor conferem a mesma lista; outro
  valor enviado direto à API é recusado (400).
- **Na ficha:** sem seleção aparece "Não informado", sem inferir nem preencher
  valor. Um texto livre gravado antes desta decisão aparece como foi gravado;
  nenhum valor antigo é convertido.
- **Gênero é outro dado**, bloqueado até a sua ficha.

## 3. Regras técnicas

- Formato de CEP, telefones, e-mail e matrícula continua conferido **quando o
  valor é informado**; a ausência não bloqueia o cadastro.
- Migration `20261021140000_obrigatoriedade_cadastro_colaborador`: só retira o
  `NOT NULL` de `vinculo_funcional.matricula` e dos três contatos — o mínimo
  indispensável. Os CHECKs de formato e os índices únicos (matrícula e e-mail
  na empresa) seguem valendo para o valor informado; nenhum dado é alterado.
- Sexo não precisou de migration: a lista fechada é regra do servidor.
- Admissão sem nenhum contato não cria registro de contato e não mostra
  aviso, erro nem bloqueio por isso; o reenvio com a mesma chave continua
  reconhecido. Depois, a tela de sucesso e a ficha mostram o estado
  **"Nenhum contato registrado"**, anunciado como status e ligado à seção de
  Contatos, sem campo marcado como inválido. A edição de contatos aceita cada
  campo vazio; com ao menos um preenchido, valem as validações e a
  normalização de sempre.
- **Remover todos os contatos** (decisão de 2026-10-22): quem já tinha
  contatos e salva os três vazios não fica com registro vazio em uso. Sem
  exclusão física (a ficha de contatos não a prevê e a trilha aponta para o
  registro), o registro passa a **inativo**: sem nenhum valor, preservado só
  para a trilha e lido como "sem registro". A ficha volta ao mesmo estado
  "Nenhum contato registrado" de quem nunca teve contato. A remoção é um
  evento de edição com os nomes dos campos removidos, nunca os valores.
  Informar um contato depois reativa o mesmo registro. Migration
  `20261022120000_contato_colaborador_inativo`: coluna `ativo` com CHECK
  (ativo se, e somente se, há ao menos um contato) e coerência dos eventos.
- **Matrícula ausente, `null`, vazia ou só com espaços** é a mesma ausência:
  não é conferida contra outras matrículas e nunca gera conflito.
- **Máscaras:** inserção excedente de telefone ou CEP — tecla, colagem,
  arrastar e soltar, sugestão de teclado, ditado ou IME — é recusada com
  aviso acessível, mantendo valor e cursor; um telefone nacional com DDD 55
  nunca é lido como código de país, e nenhum dígito é cortado em silêncio.
- **Telefone com texto** (ramal, extensão, `x`, rótulos como "Cel" ou
  "WhatsApp", palavras): recusado como formato inválido na tela e no
  servidor. Nenhuma letra é descartada para "achar" um número; o valor que já
  estava no campo fica.
- **Telefone legado** — gravado antes da forma `+55` atual e que não se
  enquadra nela com segurança: aparece exatamente como gravado, sem truncar
  nem reinterpretar. Salvar outro campo não o reenvia nem o regrava; editá-lo
  exige a forma brasileira atual. Para isso, no `PUT` de contatos, **campo
  ausente mantém o valor gravado**, e `null` ou vazio apaga.

## 4. O que esta decisão não autoriza

Gênero, CPF, nome social, raça/etnia, PcD, foto, documentos, dados bancários,
dependentes, contato de emergência, filial e turno continuam bloqueados até os
seus gates e fichas. Nenhum campo novo além do Sexo em lista fechada.
