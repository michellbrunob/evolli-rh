# T193 — Dossiê: próxima fatia de Gestão de Pessoas

Status: **decidido pela proprietária em 2026-10-28: opção A** (seção 5).
As seções 1 a 4 registram o dossiê como foi apresentado.
Data: 2026-10-28. Tarefa: T193.
Fontes, e só elas: `.specify`, as decisões em `docs/decisions` (em especial
[T190](t190-dossie-proxima-fatia-pessoas.md),
[T191](t191-dossie-proxima-fatia-pessoas.md) e
[T192](t192-dossie-proxima-fatia-pessoas.md)), e o código e os testes de
`main` em `5908912`, só como evidência.

## 1. Onde a área está — as observações da T192

A T192 deu à aba **Horário de trabalho** foco estável no filtro de
colaborador e na paginação, anúncio da carga e da página, nova tentativa na
página que falhou e falha do catálogo de jornadas sem esconder a tabela. A
revisão final aprovou a entrega e deixou observações não bloqueantes.
Conferidas no código de `main`
(`apps/web/src/screens/pessoas/PessoasHorarioScreen.tsx`):

- **Foco e tabela anterior durante "Tentar novamente".** Na falha, a tela
  guarda as linhas da última leitura (o `catch` de `carregarVinculos`, linha
  246, não as limpa). Na nova tentativa, o estado volta a "carregando" com
  linhas na memória, e a regra de exibição (linha 782) mostra de novo a
  tabela antiga, ocupada, com a posição da página anterior. O botão "Tentar
  novamente" some, e o foco passa pelo `<body>` até a resposta. No fim o foco
  vai certo (título da lista, ou o novo "Tentar novamente").
- **Anúncios duplicados.** Dois casos:
  - ao trocar de filtro a partir de um estado vazio, falam juntos o
    "Carregando vínculos de horário…" visível (linha 783, `role="status"`) e
    a região viva da T192 (linha 666);
  - com o formulário aberto, uma nova falha do catálogo remonta os **dois**
    avisos (filtro e formulário), que compartilham a mesma chave (linha
    1177), e os dois são anunciados.
- **Catálogo recuperado sem jornada ativa, com o formulário aberto.** A
  validação só exige a jornada quando há mais de uma ativa (linha 453), e o
  botão de salvar só olha se o catálogo carregou (linha 1143). Se a nova
  tentativa traz o catálogo sem nenhuma jornada ativa, "Criar vínculo" fica
  habilitado e envia sem jornada; o servidor recusa e a tela mostra uma
  mensagem genérica. Antes da T192 isso não acontecia, porque "Novo vínculo"
  ficava desabilitado nesse caso — e continua ficando, quando o formulário
  ainda não está aberto.
- **Contagem de ativos sem nova tentativa.** A falha da contagem
  (`carregarAtivos`, linha 280) só marca a falha (linha 296); o formulário
  passa a mostrar a busca de colaborador, mas nada tenta a contagem de novo
  até a tela ser remontada.
- **Foco depois de criar um vínculo.** Ao criar, o formulário fecha (linha 491) e a tabela relê a página 1; o botão "Criar vínculo" some e o foco
  passa a lugar nenhum. É o comportamento anterior à T192, registrado como
  fora do escopo dela.
- **Rótulos ambíguos do `master_tecnico` global.** Sem empresa ativa, o
  master lê o escopo global: o filtro de jornada do Horário (linha 737), a
  busca de colaborador da T188 e os filtros de Departamento e Cargo de
  Colaboradores (T190) misturam empresas, e itens com o mesmo nome aparecem
  iguais. Os catálogos trazem `empresaId`; o colaborador o traz em cada
  vínculo funcional; o nome da empresa vem da lista de empresas que o seletor
  da T189 já lê (`GET /v1/auth/contexto/empresas`).

**Outras pendências registradas:** o E2E do master com empresa ativa compara
com o RH só o total, não o corpo; o catálogo de jornadas numa página de 100
no filtro e no formulário (o contrato de jornadas já tem `busca`, T182); a
linha do tempo do vínculo funcional sem desempate por `id`; o limite de 100
itens dos catálogos de Departamento e Cargo, sem busca no contrato (T190); a
falha de catálogo de lotação sem região viva (T190).

## 2. Opções

### A — Horário de trabalho: recuperação, anúncios e formulário sem arestas (só web)

- **Problema e valor:** fecha as cinco observações de uso da T192 na mesma
  tela. A nova tentativa deixa de mostrar dados antigos e de soltar o foco;
  o leitor de tela ouve cada coisa uma vez; o formulário não envia um
  vínculo que o servidor vai recusar; a contagem de ativos se recupera; e
  quem cria um vínculo não perde o lugar.
- **Contratos e telas:** nenhum contrato muda. Só a aba Horário de trabalho
  (`PessoasHorarioScreen`):
  - nova tentativa com o aviso de erro à vista e o botão indisponível
    durante a repetição (o mesmo recurso da T192), sem reexibir a tabela
    anterior;
  - um anúncio por evento: o texto visível de carga deixa de ser região
    viva quando a região estável já anuncia; com o formulário aberto, só o
    aviso do formulário é anunciado;
  - formulário sem jornada ativa depois da nova tentativa: aviso específico
    ("Nenhuma tabela de horário ativa…") e salvar bloqueado, como já é antes
    de abrir;
  - nova tentativa da contagem de ativos, junto da do catálogo ou própria;
  - foco definido depois de criar um vínculo;
  - E2E do master com empresa ativa comparando o corpo inteiro com o do RH
    (só teste).
- **Dependências:** nenhuma de gate. Sem API, schema, migration, RBAC,
  auditoria, seed ou dependência.
- **Risco e escopo:** baixo, escopo pequeno e numa tela só.
- **Decisões necessárias:** (1) para onde vai o foco depois de criar um
  vínculo — no botão "Novo vínculo" (recomendado: é de onde a pessoa veio e
  continua à vista) ou no título da lista; (2) se a nova tentativa da
  contagem de ativos fica no mesmo botão do catálogo ("Tentar carregar
  novamente" para os dois) ou num aviso próprio (recomendado: aviso próprio,
  só quando ela falha, para não misturar as causas).

### B — Rótulos sem ambiguidade para o `master_tecnico` global

- **Problema e valor:** o master sem empresa ativa deixa de ver, nos filtros,
  dois itens iguais que pertencem a empresas diferentes — e de filtrar pela
  empresa errada sem perceber. Observação aberta desde a T190.
- **Contratos e telas:** sem contrato novo. A tela lê as empresas do contexto
  (`GET /v1/auth/contexto/empresas`, já usado pelo seletor da T189) e
  acrescenta a empresa ao rótulo **só** no escopo global:
  - jornada no filtro do Horário de trabalho;
  - colaborador na busca da T188 (Horário de trabalho, Histórico funcional e
    Dados contratuais);
  - Departamento e Cargo nos filtros de Colaboradores (T190).

  RH, DP e o master com empresa ativa não veem diferença.

- **Dependências:** os dados de empresa já vêm nos itens (`empresaId`).
  Decidir a forma do rótulo.
- **Risco e escopo:** baixo-médio, escopo médio: toca três telas e o seletor
  compartilhado da T188. Se a lista de empresas falhar, o rótulo fica como
  hoje — não pode bloquear a tela.
- **Decisões necessárias:** (1) forma do rótulo — "Nome · Empresa" ou só o
  código da empresa; (2) se a mesma regra vale para as colunas das tabelas no
  escopo global, além dos filtros.

### C — Jornada por busca no Horário de trabalho, sem o teto de 100

- **Problema e valor:** numa empresa com mais de 100 jornadas, parte delas
  não aparece no filtro nem no formulário de novo vínculo. Fecha o limite
  registrado na T191 para o Horário.
- **Contratos e telas:** o contrato de jornadas já tem `busca`, `pagina` e
  `tamanhoPagina` (`GET /v1/horarios`, T182): filtro e formulário passam a
  escolher a jornada por busca paginada, como o colaborador (T188). Sem
  contrato novo. Departamento e Cargo (T190) **não** entram: não têm busca no
  contrato.
- **Dependências:** E2E com PostgreSQL real acima de 100 jornadas; decidir
  se o select simples continua quando o catálogo cabe numa página.
- **Risco e escopo:** médio, escopo médio: muda a forma de dois controles
  recém-ajustados pela T192 (filtro e formulário) e o aviso de falha do
  catálogo. O valor só aparece em empresas grandes, que a base de
  demonstração não tem.
- **Decisões necessárias:** (1) busca sempre ou só acima de uma página;
  (2) se as jornadas inativas continuam no filtro (hoje sim, marcadas).

## 3. Comparação

| Opção | Valor no dia a dia                                                | Risco       | Contratos  | Gate   | Decisões           |
| ----- | ----------------------------------------------------------------- | ----------- | ---------- | ------ | ------------------ |
| A     | Alto para teclado e leitor de tela; formulário sem envio inválido | Baixo       | Nenhum     | Nenhum | Produto (2 pontos) |
| B     | Médio, só para o `master_tecnico` global                          | Baixo-médio | Existentes | Nenhum | Produto (2 pontos) |
| C     | Alto só em empresas com mais de 100 jornadas                      | Médio       | Existentes | Nenhum | Produto (2 pontos) |

## 4. Recomendação

**Opção A — recuperação, anúncios e formulário sem arestas no Horário de
trabalho.** São as observações de uso da revisão final da T192, todas na
mesma tela, sem contrato novo e com risco baixo; uma delas (envio sem
jornada) é uma regressão de borda introduzida pela própria T192. A opção B é
útil, mas só para o master global e toca três telas; pode vir em seguida. A
opção C resolve um limite que a base atual não exercita e mexe de novo em
controles que acabaram de estabilizar.

Para seguir com A, a proprietária precisa decidir:

1. **Foco depois de criar um vínculo:** no botão "Novo vínculo"
   (recomendado) ou no título da lista.
2. **Nova tentativa da contagem de ativos:** aviso próprio, só quando ela
   falha (recomendado), ou junto da nova tentativa do catálogo.
3. **Incluir os rótulos do master global (opção B)** na mesma entrega
   (opcional; recomendado: não, para manter a fatia numa tela).

## 5. Decisão da proprietária (2026-10-28)

**Opção A aprovada**, só na aba Horário de trabalho. Respostas às decisões:

1. **Foco depois de criar um vínculo:** volta ao botão "Novo vínculo".
2. **Contagem de colaboradores ativos:** aviso e nova tentativa próprios.
3. **Rótulos do `master_tecnico` global (opção B):** não entram.

Também fica de fora o limite de 100 jornadas (opção C).

Comportamento aprovado:

- **Nova tentativa de página:** o aviso de falha fica montado e o botão de
  nova tentativa à vista, indisponível enquanto carrega; nenhuma linha da
  página anterior reaparece; o foco não passa pelo `<body>`. No sucesso, o
  foco vai ao título da lista; numa nova falha, fica no aviso e no botão.
  Página e filtros exatos.
- **Anúncios:** cada carga, falha ou recuperação é anunciada uma só vez, sem
  duplicar texto visível e região viva; com o formulário aberto, a falha ou a
  recuperação do catálogo tem um único anúncio útil; a carga inicial segue
  sem anúncio.
- **Catálogo sem jornada ativa:** o formulário informa o motivo, e "Criar
  vínculo" não envia sem jornada nem depende do 400 do servidor; o formulário
  e o foco se preservam se a lista for recuperada ou continuar vazia.
- **Contagem de ativos:** aviso e nova tentativa próprios, sem reiniciar
  tabela, página, filtros ou catálogo; a busca de colaborador continua
  enquanto a contagem estiver indisponível.
- **Criação:** no sucesso, o formulário fecha e o foco volta a "Novo
  vínculo"; RH opera, DP e `master_tecnico` só consultam.
- **E2E:** `master_tecnico` com empresa ativa comparando o corpo inteiro com
  o resultado do RH.

## 6. O que foi entregue

- **Nova tentativa de página:** ao repetir uma página que falhou, o aviso de
  falha segue montado, com o texto inalterado, e "Tentar novamente" à vista,
  indisponível por `aria-disabled` durante a carga — o foco fica nele. Na
  falha, as linhas da leitura anterior saem da tela e não reaparecem, nem na
  repetição nem numa troca de filtro. No sucesso, o foco vai ao título da
  lista; numa nova falha, fica no botão, e a região estável anuncia a nova
  falha uma vez. "Ir para a primeira página" segue o mesmo padrão. Página e
  filtros exatos.
- **Anúncios únicos:** o texto visível de carga e o aviso de "sem opções" da
  lista deixam de ser região viva — a carga inicial segue sem anúncio. Com o
  formulário aberto, só o aviso do catálogo no formulário é anunciado (o do
  filtro continua à vista). A nova tentativa do catálogo e da contagem
  anuncia a carga e a recuperação uma vez cada; o botão não muda de nome.
- **Sem jornada ativa (ou sem colaborador ativo) com o formulário aberto:**
  o motivo fica à vista e recebe o foco quando a nova tentativa traz a lista
  vazia; "Criar vínculo" fica indisponível, e o envio nunca sai sem jornada
  ou colaborador (guarda dupla no envio). O formulário preserva o que já foi
  preenchido.
- **Contagem de colaboradores ativos:** aviso e nova tentativa próprios no
  formulário; a busca de colaborador continua enquanto a contagem falha;
  tabela, página, filtros e catálogo não reiniciam. Recuperada com mais de um
  ativo, o foco vai à busca; com um só, ele vem escolhido e o foco vai ao
  início da vigência. DP e `master_tecnico` não veem o aviso (não têm
  formulário).
- **Criação:** o formulário fecha e o foco volta a "Novo vínculo", que não
  depende mais da carga da tabela (só da contagem e do catálogo); a criação é
  anunciada junto da releitura.
- **Testes:** web — 16 novos (nova tentativa com aviso e foco, nova falha,
  linhas antigas, página vazia, carga inicial sem anúncio, anúncio único,
  catálogo com o formulário aberto, catálogo vazio, catálogo que segue
  falhando, contagem falha, de novo e recuperada, DP, criação, CSS). E2E com
  PostgreSQL real — o `master_tecnico` com empresa ativa recebe exatamente o
  corpo do RH em todas as páginas, num filtro, num filtro combinado e no
  detalhe.

## 7. Fora do escopo desta entrega e limites conhecidos

- **Rótulos sem ambiguidade do `master_tecnico` global** (opção B): não
  entram, por decisão.
- **Catálogos acima de 100 itens** (opção C e T190): inalterados.
- **Linha do tempo do vínculo funcional** sem desempate por `id`.
- **Painel "Adicionar colaborador", importação em lote e admissão por
  convite:** fora desta entrega; avaliados à parte, sem registro no Spec Kit
  até a decisão da proprietária.
