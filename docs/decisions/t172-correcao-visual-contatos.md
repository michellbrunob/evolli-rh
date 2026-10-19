# T172 — Correção visual da seção Contatos

Status: **em implementação** (PR Draft).
Data: 2026-10-19.
Base: `bd860b0d303c97e59aed0f85f540db8303380092` (T171, PR #163).

## 1. O defeito

No detalhe do colaborador, a seção Contatos abria um vão vertical de cerca de
256 px entre o aviso "Nenhum contato registrado" e o primeiro campo. A T171
registrou o defeito, com a causa já identificada, e o deixou como pendência.

## 2. A causa

O aviso reaproveitava `colaboradores-screen__aviso-texto`, regra da T111 com
`flex: 1 1 16rem`. Essa regra foi feita para o banner de aviso, onde o texto
divide uma **linha** com o selo: ali, `16rem` é largura. A seção Contatos e o
formulário dela são **colunas** flex (`flex-direction: column`), e numa coluna o
`flex-basis` vira **altura**: o parágrafo ocupava 256 px, de 10 linhas de espaço
para 1 de texto.

O próprio CSS já documentava o mesmo defeito e a mesma solução no painel de
admissão (`colaboradores-screen__painel-descricao`, que "NÃO reaproveita
`__aviso-texto`"). A seção Contatos, da T169, não seguiu esse registro.

## 3. A correção

- Classe própria, `colaboradores-screen__contatos-aviso`, com só `margin: 0` e a
  mesma cor de antes (`var(--color-ink)`). Sem nenhuma propriedade `flex`, de
  modo que o parágrafo tem a altura do próprio texto.
- A regra compartilhada `colaboradores-screen__aviso-texto` (T111) **não foi
  alterada**.
- Mesma tag (`<p>`), mesmo texto e mesmo `role`: o aviso de bloqueado continua
  `role="status"`, e o de vazio continua sem papel, como antes.

**Achado, mesma causa e mesma correção.** Na validação de navegador, o aviso do
estado **bloqueado** (colaborador desligado) usava a mesma classe flexível, na
mesma seção em coluna, e media os mesmos 256 px. Como é o mesmo defeito, do mesmo
arquivo e da mesma classe, a correção cobre os dois estados. Deixar um dos dois
com o defeito conhecido seria incoerente, e a mudança é só o nome da classe.

## 4. Testes

jsdom não mede layout, então o teste prende o que causa o vão:

- **Componente** (3 casos): no estado vazio e no bloqueado, o aviso usa a classe
  própria, não usa `aviso-texto`, e nenhum elemento da seção usa `aviso-texto`;
  o aviso de bloqueado mantém `role="status"`; com contatos, não há aviso de
  vazio.
- **Contrato de CSS** (4 casos): a classe própria existe e **não tem propriedade
  `flex*`**, nem `height`/`min-height`; usa só token de cor e `margin: 0`; a
  regra compartilhada da T111 continua com `flex: 1 1 16rem` e a cor de antes; e
  a seção e o formulário continuam colunas flex, a premissa do defeito.

Mutações conferidas em cópia isolada, todas reprovam: voltar a usar
`aviso-texto` no vazio ou no bloqueado; dar `flex`, `flex-basis` ou `min-height`
à classe nova; usar cor fora do token; "consertar" alterando a regra da T111 (tirando
o `flex` ou trocando por `flex: 0 0 auto`); e fazer a seção deixar de ser coluna.

## 5. Evidência de navegador

Ambiente local de demonstração, só com dados sintéticos: web em
`http://127.0.0.1:5173`, API em `127.0.0.1:3100`, banco **próprio** em
`127.0.0.1:5434` (projeto compose `evolli-t172`, volume novo). As instâncias da
T171 (5433) e a anterior (5432) não foram tocadas. Login com a conta sintética
`rh.multi`.

| Estado                              | Altura do aviso, antes                | Depois                                                               | Observação                                                                       |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Sem registro (Alfa Um)              | 256 px (`flex: 1 1 256px`, 10 linhas) | 25 px (`flex: 0 1 auto`, 1 linha)                                    | formulário de 664 px para 433 px; espaço até o primeiro campo = o `gap` de 12 px |
| Bloqueado (Alfa Turno B, desligada) | 256 px                                | 75 px (3 linhas)                                                     | seção de 303 px para 122 px                                                      |
| Com contatos (Alfa Um)              | —                                     | sem aviso de vazio; valores carregados; botão de salvar desabilitado | formulário de 396 px                                                             |

Comportamento preservado, verificado na mesma sessão:

- **Envio vazio:** três erros por campo e foco no primeiro (`E-mail pessoal`); o
  aviso continua com 25 px.
- **Salvar:** `Alfa.Um@Example.TEST`, `+55 (11) 98765-0001` e `(11) 3333-0001`
  voltaram como `alfa.um@example.test`, `+5511987650001` e `1133330001`, com a
  confirmação "Contatos salvos."; ao reabrir, os valores vêm do servidor.
- **Troca Alfa → Beta pelo Hub:** a lista passa a ter só "Pessoa Demo Beta Um",
  sem nenhum texto, e-mail ou telefone da Alfa na tela; com os ids reais, o
  detalhe **e** os contatos das três pessoas da Alfa respondem `404` com a
  mensagem fixa e sem valor; "Beta Um" mostra o estado vazio com 25 px, na empresa
  Beta.
- **Console:** nenhum erro da aplicação; só respostas provocadas pelas sondas
  (401 antes do login, 409 das tentativas de efetivar, 400 de ids indefinidos e
  404 do isolamento).

## 6. Dados criados só no banco sintético local

Para obter o estado "bloqueado" foi preciso desligar uma pessoa do seed:
"Pessoa Demo Alfa Turno B" teve um desligamento efetivado (vínculo encerrado). No
caminho, uma tentativa errada atingiu o vínculo **previsto** de "Pessoa Demo Alfa
Dois" e criou ali um desligamento pendente; ele foi **cancelado**. O histórico de
movimentações é imutável por desenho, então o registro cancelado permanece. Tudo
isso é dado sintético do banco local da T172, descartável com
`docker compose down -v` no worktree, e não tem relação com a PR.

## 7. O que não mudou

Rotas, permissões, auditoria, normalização, validação, dados, schema,
migrations, banco, seed e gravação dos contatos; as três obrigatoriedades e os
erros por campo; isolamento por empresa ativa e tratamento do master técnico;
Node 24, pnpm 10, Prisma e os scripts de ambiente. Nenhuma outra pendência foi
corrigida.
