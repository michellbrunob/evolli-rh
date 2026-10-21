# Decisão — confirmação da admissão, duplicidade, erros por campo e telefones (T179)

Status: **decidida pela proprietária em 2026-10-21.**
Tarefa que a implementa: T179 — confirmação segura da Nova admissão, prevenção
de duplicidade, erros por campo e base de normalização de telefones.
Relacionado:
[ADR 0016](../adr/0016-modelo-e-governanca-dos-dados-de-admissao-e-perfil-do-colaborador.md)
(`DP-ADM-05`, `DP-ADM-15`, seção 6.7),
[ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md),
[ficha de Contatos](ficha-tratamento-contatos-colaborador.md),
[ficha de dados pessoais e endereço](ficha-tratamento-dados-pessoais-endereco-colaborador.md),
[reconciliação RH/DP](t173-reconciliacao-fluxo-rh-dp.md) (`DP-FLX-22`) e
[Baseline V1 da Fatia 2](etapa1-fatia2-colaboradores-baseline-v1.md) (`DP-28`).

## 1. As decisões

Respostas da proprietária à matriz revisada de Gestão de Pessoas →
Colaboradores, em 2026-10-21:

| #   | Decisão                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | O **e-mail pessoal é único dentro da mesma empresa**; pode se repetir em empresa diferente.                                                                                                                               |
| 2   | O envio da admissão tem **idempotência**, com migration própria. A chave é vinculada ao **ator e à empresa**; o registro de idempotência **nunca guarda dado pessoal**.                                                   |
| 3   | **Telefone só brasileiro**, armazenado normalizado em `+55` + DDD + número. A tela continua exibindo o formato brasileiro.                                                                                                |
| 4   | Uma migration **normaliza os telefones existentes**. O que não puder ser convertido com segurança **não recebe chute**: vai para uma relação técnica de revisão, sem expor valores em log, auditoria, PR ou documentação. |
| 5   | **Departamento, Cargo e Unidade são obrigatórios só na Nova admissão.** Novos vínculos de colaboradores existentes ficam fora deste escopo.                                                                               |
| 6   | O **DP sem referências** disponíveis continua impedido de admitir; a tela explica que o RH precisa cadastrar Departamento, Cargo e Unidade.                                                                               |
| 7   | O botão **"Adicionar" referências é exclusivo do RH**. Nenhuma capacidade nova para o DP.                                                                                                                                 |
| 8   | **Nomes repetidos** de Departamento, Cargo e Unidade são permitidos; o código continua sendo a chave única. Os seletores mostram `CÓDIGO — Nome`.                                                                         |
| 9   | **Fuso horário continua excluído.** O `DP-FLX-22` fica **não aplicável apenas quanto ao fuso**; Dados adicionais (quantidade de filhos e tamanho da camisa) seguem pendentes em item separado (`DP-ADM-19`).              |
| 10  | CEP, telefones, CPF, query, URL e demais valores pessoais **não aparecem** em log, auditoria, mensagem de erro, PR ou documentação.                                                                                       |

## 2. Como a T179 aplica

| Tema                    | Regra                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmação             | "Salvar" valida no navegador; com falha, a página fica e o foco vai ao primeiro campo inválido. Sem falha, abre o modal acessível "Confirmar cadastro de colaborador?", com resumo de empresa ativa, nome, matrícula, tipo de vínculo, data de admissão e lotação — **nunca** contatos, endereço ou nascimento. O modal não grava; só "Confirmar cadastro" envia. |
| Fonte definitiva        | O servidor valida dentro da transação da admissão. Matrícula (já única por empresa) e e-mail pessoal (único por empresa, decisão 1) são garantidos por **restrição do banco**, não por consulta prévia: sem condição de corrida.                                                                                                                                  |
| Erro por campo          | O conflito responde 409 com a lista dos campos e o motivo (`em_uso`), **sem o valor** enviado. Resolve o `DP-ADM-15` para a admissão e a edição de contatos. A checagem é só na empresa ativa: nada confirma a existência de alguém em outra empresa.                                                                                                             |
| Idempotência            | A tela gera uma chave por envio (`Idempotency-Key`). O registro guarda só a chave, o ator, a empresa e os identificadores do que foi criado. Reenvio com a mesma chave devolve a admissão já gravada; a mesma chave com conteúdo diferente é recusada. O conteúdo é comparado com a própria admissão gravada, para que nem um resumo dele fique no registro.      |
| Telefones               | `+55` + DDD (dois dígitos de 1 a 9) + celular de 9 dígitos iniciado por 9, ou fixo de 8 dígitos iniciado por 2 a 5. Aceita na entrada `+55`, `55`, parênteses, espaço, hífen e ponto. A tela mostra `(00) 0000-0000` ou `(00) 00000-0000`.                                                                                                                        |
| Telefones já gravados   | A migration converte só o que tem forma inequívoca (10 ou 11 dígitos nacionais, ou 12 ou 13 dígitos iniciados por `55`). O resto fica como está e entra na relação técnica `revisao_normalizacao_cadastro`, com o registro e o **nome** do campo, nunca o valor.                                                                                                  |
| CEP                     | Com país Brasil, o servidor grava os 8 dígitos (aceita `00000-000`); a tela mostra `00000-000`. CEP brasileiro já gravado com forma inequívoca é convertido; o resto vai para a mesma relação técnica. Outro país segue em texto livre.                                                                                                                           |
| E-mail já repetido      | Se o banco já tiver e-mail pessoal repetido na mesma empresa, a migration **para** com a contagem de grupos repetidos, sem listar valores: a restrição não pode nascer sobre duplicidade, e escolher qual manter seria chute.                                                                                                                                     |
| Lotação                 | Na Nova admissão, Departamento, Cargo e Unidade passam a ser obrigatórios na API e na tela, em seletores próprios com `CÓDIGO — Nome`. Área, Equipe e Centro de custo seguem opcionais. Novo vínculo de colaborador existente (`POST /v1/vinculos`) não muda.                                                                                                     |
| Empresa sem referências | Sem Departamento, Cargo ou Unidade ativos, a página explica o que falta e não envia. O RH é orientado a cadastrá-los em Estrutura; o DP, a pedir ao RH.                                                                                                                                                                                                           |

## 3. Se a migration parar por e-mail pessoal repetido

A migration `20261021120000_confirmacao_admissao_normalizacao` começa
conferindo se já existe e-mail pessoal repetido na mesma empresa. Se existir,
ela para **antes de qualquer mudança** e informa só a quantidade de grupos
repetidos. Essa conferência é o primeiro comando do arquivo, então nada fica
aplicado — o E2E da T179 prova que nem as tabelas novas, nem o índice, nem os
telefones convertidos sobram. O Prisma registra a migration como falha no seu
histórico.

Procedimento seguro, sem expor nenhum valor:

1. **Localizar os grupos só por identificador.** Como o papel de migração, a
   consulta abaixo devolve a empresa e os colaboradores de cada grupo — nunca
   o e-mail:

   ```sql
   SELECT empresa_id,
          array_agg(colaborador_id ORDER BY colaborador_id) AS colaboradores
     FROM app.contato_colaborador
    GROUP BY empresa_id, email_pessoal
   HAVING count(*) > 1;
   ```

2. **Corrigir pelo RH da empresa, na versão em uso.** Qual e-mail vale para
   cada colaborador é decisão do RH, não da migration: ele ajusta o e-mail
   pessoal pela ficha (Contatos), que nessa versão ainda não exige unicidade.
   A comunicação entre quem opera e o RH usa só os identificadores do passo 1;
   nenhum e-mail vai para chamado, log, PR ou documentação.
3. **Repetir a consulta** até ela não devolver nenhuma linha.
4. **Marcar a tentativa como desfeita e aplicar de novo:**

   ```bash
   pnpm --filter @evolli/api exec prisma migrate resolve --rolled-back 20261021120000_confirmacao_admissao_normalizacao
   pnpm --filter @evolli/api exec prisma migrate deploy
   ```

5. **Conferir:** `prisma migrate status` sem pendência, e a relação técnica
   `revisao_normalizacao_cadastro` consultada por contagem (registro e nome do
   campo, sem valores) para tratar os telefones e CEPs que não tinham forma
   inequívoca.

Nunca apague um dos contatos repetidos para destravar a migration: o contato
é dado do colaborador, retido pela ficha de Contatos, e a escolha seria chute.

## 4. O que esta decisão não autoriza

CPF, documentos, dados bancários, dependentes, salário, ponto, adicionais
trabalhistas, horário na admissão, fuso horário, cargo completo, os modais
rápidos de Departamento, Cargo e Unidade, telefone estrangeiro e qualquer
capacidade nova para o DP.
