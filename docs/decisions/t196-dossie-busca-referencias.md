# T196 — Dossiê: busca pesquisável nas referências organizacionais da Nova admissão

**Situação:** implementada (2026-10-29), depois da preparação de decisão;
a entrega está na seção 11. Sem schema, migration, índice, extensão de
banco, RBAC, seed ou dependência.
**Escopo:** os quatro seletores de referência da **etapa 2** da Nova admissão
(T195): **Departamento**, **Cargo**, **Unidade** e **Centro de custo**.
**Diretriz:** uma funcionalidade completa por entrega, com as correções
pequenas e acionáveis resolvidas antes de Ready for review (regras 7 e 8 do
`tasks.md`).
**Origem:** fatia 3 do [dossiê da entrada de colaboradores](t194-dossie-entrada-de-colaboradores.md)
(seção 6.2, "Pré-requisito de contrato: busca", e seção 12).

## 1. Resumo e recomendação

Hoje cada seletor da etapa 2 carrega **uma única página de até 100 itens
ativos**, sem busca, e a escolha é feita num `<select>` nativo. Uma empresa
com mais de 100 departamentos, cargos, unidades ou centros de custo ativos
não consegue escolher os que ficam além dessa página — o mesmo teto já
registrado como pendência na T190.

Recomendação (sujeita a **D8**):

1. **Servidor:** parâmetro **aditivo e opcional** `busca` nos quatro `GET` de
   listagem, aplicado ao `where` **antes** da paginação (o `total` passa a
   contar só o que casa), procurando em `codigo` **ou** `nome`, sem
   diferenciar maiúsculas, com os curingas escapados — o mesmo padrão já em
   produção em Colaboradores (T178) e em Horário (T182). Escopo por empresa,
   ordenação por código, RBAC e auditoria **inalterados**.
2. **Web:** um componente único de **seletor pesquisável acessível**
   (padrão combobox com lista), usado pelos quatro campos, com resultados
   paginados pelo servidor, teclado completo, estados de vazio, erro e nova
   tentativa, e a escolha atual sempre preservada.
3. **Entrega seguinte:** criação inline pelo RH ("Criar «termo»"), que
   depende de **D9** (código automático e confirmação) — só proposta aqui.

## 2. Antes da T196 (levantamento no código)

Esta seção registra o código **antes** da T196, como base da decisão. O que
mudou está na seção 11: na etapa 2 da Nova admissão, Departamento, Cargo,
Unidade e Centro de custo **não usam mais a carga fixa de 100 itens** — são
buscados no servidor, de 20 em 20. A carga até 100 continua em Área e
Equipe e nas telas fora da Nova admissão.

### 2.1 Contratos de listagem

| Referência      | Rota                               | Permissão (`read`)       | Serviço `listar`                                                                           |
| --------------- | ---------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| Departamento    | `GET /v1/departamentos`            | `departamento`           | `apps/api/src/organizacao/departamento/departamento.service.ts:91-136`                     |
| Cargo           | `GET /v1/cargos`                   | `cargo`                  | `apps/api/src/organizacao/cargo/cargo.service.ts` (`listar`, mesmo padrão)                 |
| Unidade         | `GET /v1/unidades-organizacionais` | `unidade_organizacional` | `apps/api/src/organizacao/unidade-organizacional/unidade-organizacional.service.ts` (idem) |
| Centro de custo | `GET /v1/centros-de-custo`         | `centro_custo`           | `apps/api/src/organizacao/centro-custo/centro-custo.service.ts` (idem)                     |

- **Query** (`ListarPorEmpresaQueryDto`, `apps/api/src/organizacao/dto/organizacao.dto.ts:99-128`):
  `pagina` (≥ 1), `tamanhoPagina` (1 a **100**, padrão 20 —
  `organizacao.types.ts:43-44`), `status` (`ativo`/`inativo`) e
  `empresaId` (filtro, nunca concessão).
- **Resposta:** `{ itens, pagina, tamanhoPagina, total }`, com cada item
  `{ id, empresaId, codigo, nome, status, criadoEm, atualizadoEm }`.
- **Ordenação:** fixa por `codigo` crescente, decidida no servidor.
- **Busca:** **ausente** nas quatro. O comentário do DTO diz "sem texto
  livre, sem ordenação vinda do cliente" (spec §10). A spec do núcleo
  organizacional (`docs/modules/etapa1-nucleo-organizacional.md`, §10) não
  traz essa frase literal: a restrição é a leitura "apenas o necessário e
  autorizado". A busca da T178 (Colaboradores) e a da T182 (Horário) já
  abriram precedente — por isso D8 pede aprovação explícita e a atualização
  desse comentário e da spec.
- **Detalhe:** `GET /:id` existe nas quatro (mesma permissão `read`, 404 fora
  do escopo) — útil para reexibir a escolha atual.

### 2.2 Dados

- Schema (`apps/api/prisma/schema.prisma`, modelos `Departamento`, `Cargo`,
  `UnidadeOrganizacional`, `CentroCusto`): `empresaId`, `codigo`, `nome`,
  `status` (`StatusOrganizacional`, padrão `ativo`), datas.
- **Unicidade:** `@@unique([empresaId, codigo])` nas quatro. O nome **não** é
  único (dois nomes iguais na mesma empresa são permitidos — o código
  distingue; por isso o rótulo é `CÓDIGO — Nome`).
- **Código:** `^[A-Z0-9_]{2,32}$`, imutável depois de criado; nome de 1 a 160.
- **Índices:** `@@index([empresaId, status])`. Não há índice de texto.
  A única extensão instalada é `btree_gist` (`infra/postgres/04_extensions.sql`):
  sem `pg_trgm` nem `unaccent`.
- **Inativos:** existem e continuam listáveis com `status=inativo`; a etapa 2
  só oferece ativos.

### 2.3 Auditoria

- **Consulta:** `registrarConsultaAmpla` (`organizacao-auditoria.service.ts:103-127`)
  grava `organizacao_estrutura_consultada` **só** quando o ator opera em escopo
  global (o `master_tecnico` sem empresa ativa). Leitura por RH/DP não gera
  evento.
- **Criação, alteração, inativação e reativação:** `registrarMutacao`,
  atômica com a gravação.

### 2.4 Permissões (`rbac.evaluator.ts:258-330`, `evaluateOrganizacao`)

| Perfil                                              | Leitura das quatro                          | Criação         | Observação                                             |
| --------------------------------------------------- | ------------------------------------------- | --------------- | ------------------------------------------------------ |
| `rh`                                                | própria empresa                             | própria empresa | único que usa o "+" da T180                            |
| `dp`                                                | própria empresa                             | **negada**      | admite sem criar referências                           |
| `master_tecnico`                                    | global ou da empresa ativa; global auditado | sim             | **não** tem acesso à Nova admissão (`resolverEntrada`) |
| `financeiro`                                        | só `centro_custo`, própria empresa          | negada          | não usa a Nova admissão                                |
| `gestor`, `auditor`, `dpo`, `admin_tecnico`, demais | negada                                      | negada          | negação por padrão                                     |

### 2.5 Isolamento por empresa (`apps/api/src/organizacao/escopo.util.ts`)

- O escopo vem **da sessão** (`resolverEscopo`), nunca do cliente.
- `intersectarEmpresaSolicitada`: perfil escopado que pede outra empresa
  recebe **página vazia**, não erro (anti-enumeração); detalhe fora do
  escopo é **404**, nunca 403.
- Na admissão, o servidor revalida cada referência como **ativa e da empresa
  da sessão** (`assertDestinoValidoEAtivo`,
  `apps/api/src/pessoas/validacao-pessoas.util.ts:118`) e responde 422 se não
  for. A busca não muda essa autoridade.

### 2.6 Como a etapa 2 carregava e validava antes da T196

- `NovaAdmissaoScreen.tsx:922-948`: um `Promise.all` lê empresas,
  Departamentos, Unidades, Equipes, Cargos e Centros de custo **ativos**, cada
  um com `tamanhoPagina: 100`. Falha em qualquer leitura vira o erro geral
  "Não foi possível carregar a empresa ativa e as opções de lotação…".
- Área: carregada sob demanda pelo Departamento escolhido (`listarAreas`).
- Seletores `<select>` nativos com opções `CÓDIGO — Nome`; Departamento e
  Cargo obrigatórios, Unidade e Centro de custo opcionais.
- T180: o "+" (só RH) abre `ModalReferenciaRapida` para Departamento, Cargo e
  Unidade (código e nome digitados); a referência criada entra na lista
  (`comReferenciaNova`, linha 239) e a escolhida nunca some numa recarga
  (`mantendoEscolhida`, linha 256). Centro de custo ficou **sem** cadastro
  rápido por decisão da T180.
- O mesmo teto de 100 aparece fora da admissão: `ColaboradoresScreen.tsx:526-527`
  (filtros da T190), `DadosContratuaisScreen.tsx:183-188` e
  `HistoricoFuncionalScreen.tsx:307-312`. Fora do escopo da T196: essas telas
  continuam com o teto de 100.

### 2.7 Compatibilidade

- **Troca de empresa (T189):** a tela é remontada pela chave da empresa; a
  busca nasce vazia e só consulta a empresa nova. Pedido em voo da empresa
  antiga precisa ser descartado (mesma técnica do `pedidoAreasRef`).
- **Sessão e CSRF:** a busca é `GET` (sem CSRF). 401 segue o fluxo de sessão
  expirada já existente. A criação inline futura é `POST` e já passa pelo
  `CsrfGuard`.
- **Campos obrigatórios:** a validação por etapa (T195) não muda: só o id
  escolhido conta.
- **375 px:** o componente precisa caber em uma coluna, com opções de 44 px e
  a lista dentro do fluxo da página (sem sobreposição que crie rolagem
  horizontal).

## 3. Arquitetura recomendada da busca no servidor

1. **Parâmetro:** `busca?: string` num DTO próprio das referências
   (por exemplo, `ListarReferenciasQueryDto extends ListarPorEmpresaQueryDto`),
   para não estender a busca a Empresa e Equipe sem decisão.
2. **Normalização:** a mesma da T178/T182 — aparar, colapsar espaços, vazio
   vira ausente, até 160 caracteres, sem caracteres de controle. Recomenda-se
   mover `normalizarBusca` e `escaparCuringas`
   (`colaborador.service.ts:219`) para um utilitário comum, sem mudar o
   comportamento atual.
3. **Consulta:** acrescentar ao `where`, **antes** de `skip`/`take` e do
   `count`:
   `OR: [{ codigo: { contains: termo, mode: "insensitive" } }, { nome: { contains: termo, mode: "insensitive" } }]`.
   O `total` passa a refletir o filtro, e a paginação continua a mesma.
4. **Escopo, RBAC e ordenação:** sem mudança. A busca é filtro dentro do
   escopo da sessão; nunca alarga nada.
5. **Auditoria:** a consulta global do `master_tecnico` segue registrando o
   evento atual. **Não** gravar o termo buscado no evento (texto livre sem
   finalidade de trilha).
6. **Escolha atual:** quando o item escolhido não estiver na página
   corrente, o cliente o mantém em memória; se precisar reler, usa o
   `GET /:id` que já existe.
7. **Documentação:** atualizar o comentário do DTO e a §10 da spec do núcleo
   organizacional com a nova permissão de busca por código ou nome.

Sem schema, migration ou índice nesta proposta (ver os riscos na seção 7).

## 4. Interface acessível proposta (os quatro seletores)

Um componente `SeletorPesquisavel`, usado igualmente por Departamento, Cargo,
Unidade e Centro de custo:

| Aspecto        | Proposta                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Campo de busca | `input` com `role="combobox"`, rótulo visível (o do campo, com "obrigatório"/"opcional"), `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` e `aria-activedescendant`                 |
| Consulta       | ao digitar, com espera curta (cerca de 300 ms) e só a resposta mais recente valendo; sem termo, mostra a primeira página dos ativos                                                              |
| Resultados     | `role="listbox"` com opções `CÓDIGO — Nome` (`role="option"`, `aria-selected`), 20 por página e um botão "Mostrar mais" no fim (sem rolagem infinita); região `role="status"` com "N resultados" |
| Teclado        | ↓/↑ percorrem as opções, Enter escolhe, Escape fecha e devolve o texto da escolha atual, Tab sai sem mudar a escolha; Home/End no campo continuam editando o texto                               |
| Estado vazio   | "Nenhum departamento ativo encontrado para «termo»." (e, na entrega seguinte, a ação de criar para o RH)                                                                                         |
| Erro           | mensagem na própria lista e "Tentar de novo", sem apagar a escolha nem o termo; 401 segue a sessão expirada                                                                                      |
| Escolha atual  | sempre exibida (texto do campo e um resumo abaixo), mantida quando a busca não a inclui; trocar o termo nunca desfaz a escolha — só escolher outra opção ou "Limpar" nos opcionais               |
| Validação      | erro do campo ligado por `aria-describedby`, foco no campo ao falhar (T195)                                                                                                                      |
| 375 px         | coluna única, opções de 44 px, lista no fluxo da página                                                                                                                                          |

Alternativa mais simples, se D8 preferir: manter o `<select>` nativo até um
limite e só mostrar a busca acima dele. Não é a recomendação, porque dois
comportamentos no mesmo campo confundem e o limite vira outro teto.

## 5. Matriz de permissões e isolamento da busca

| Perfil           | Busca nas quatro              | Resultado                  | Auditoria                                   |
| ---------------- | ----------------------------- | -------------------------- | ------------------------------------------- |
| `rh`             | sim, na empresa da sessão     | só a própria empresa       | nenhuma (como hoje)                         |
| `dp`             | sim, na empresa da sessão     | só a própria empresa       | nenhuma                                     |
| `master_tecnico` | sim (não usa a Nova admissão) | global ou da empresa ativa | evento atual da consulta ampla, sem o termo |
| `financeiro`     | só Centro de custo            | própria empresa            | nenhuma                                     |
| demais           | negada (403 no guard)         | —                          | `authorization_denied`, como hoje           |

Isolamento: termo que só casa em outra empresa devolve **página vazia**;
`empresaId` de outra empresa continua devolvendo página vazia; a escolha é
revalidada na admissão (422 se inativa ou de outra empresa).

## 6. Estratégia de testes

- **API, unidade:** normalização (aparar, colapsar, vazio, controle, 160);
  curingas `%` e `_` literais; `OR` em código e nome; `total` coerente com o
  filtro; DTO das referências separado do de Empresa e Equipe.
- **E2E com PostgreSQL real** (`--runInBand`), para as quatro:
  - busca por parte do código e do nome, sem diferenciar maiúsculas;
  - curinga literal não casa com tudo;
  - **mais de 100** itens ativos: o 115º é encontrado pela busca;
  - `status=ativo` com busca não traz inativos;
  - isolamento: RH e DP da empresa A não veem itens da B, mesmo com termo
    exato; `empresaId` alheio devolve página vazia;
  - `master_tecnico` global: busca funciona e gera o evento, sem o termo;
  - perfis negados: 403 e `authorization_denied`;
  - admissão com referência encontrada pela busca grava; com referência
    inativada no meio, 422.
- **Web (Vitest):** papel e nomes acessíveis; teclado completo; espera e
  descarte de resposta obsoleta; "Mostrar mais"; vazio; erro e nova
  tentativa; escolha preservada após buscar outra coisa; obrigatoriedade e
  foco por etapa; troca de empresa remonta e descarta pedido em voo; 401;
  DP sem ação de criar.
- **Localhost (`[T196 dev]` da entrega de produto):** RH, DP, `master_tecnico`
  (negado na rota) e troca de empresa; uma empresa sintética com mais de 100
  itens para provar o teto removido; falha de rede simulada; 375 px; leitor
  de tela no navegador.

## 7. Riscos de desempenho e limites conhecidos

- **`ILIKE '%termo%'` sem índice de texto:** varredura dentro da empresa (o
  índice `[empresaId, status]` reduz ao conjunto da empresa). Adequado para
  milhares de itens por empresa; para volumes maiores, `pg_trgm` com índice
  GIN exigiria extensão e migration — decisão própria, fora desta proposta.
- **Acentos:** sem `unaccent`, um termo digitado sem acento não encontra
  um nome acentuado.
  Aceitar na primeira entrega (os códigos não têm acento) ou decidir
  normalização depois.
- **`count` a cada busca:** dobra a consulta; aceitável no mesmo volume.
  Alternativa futura: "tem mais" sem total.
- **Auditoria do master:** a consulta global gera um evento por página;
  digitação com espera curta limita o volume (e o master não usa a Nova
  admissão).
- **Corrida de respostas:** só a mais recente vale (contador por campo).
- **Teto de 100 fora da admissão:** Colaboradores, Dados contratuais e
  Histórico funcional continuam com ele até uma entrega própria.
- **Nome não único:** o rótulo `CÓDIGO — Nome` continua obrigatório.

## 8. Entrega seguinte: criação inline (só proposta)

- No estado vazio e no fim da lista, só para o RH: "Criar «termo»" para
  Departamento, Cargo e Unidade (e Centro de custo, se aprovado — ver D-CC).
- **D9 — código:** as alternativas G1 a G4 estão no
  [dossiê da T194](t194-dossie-entrada-de-colaboradores.md) (seção 6.3); a
  recomendação lá é **G1** (o servidor deriva do nome, com sufixo em colisão,
  e o 409 passa a indicar o campo `codigo`).
- **D9 — confirmação:** criar só depois de uma confirmação curta na própria
  lista (recomendado) ou criar imediatamente.
- Reuso: `POST` atuais (com `CsrfGuard` e auditoria de mutação),
  `comReferenciaNova`, `mantendoEscolhida` e o tratamento de erro do
  `ModalReferenciaRapida`. A referência criada entra escolhida.
- Pendência de edição (T189): o termo digitado para criar conta como edição
  em andamento enquanto a criação não termina.

## 9. Decisões pendentes

1. **D8 — busca aditiva no servidor** para Departamento, Cargo, Unidade e
   Centro de custo, por código ou nome, antes da paginação, com o padrão da
   T178/T182 e o componente pesquisável único da seção 4. Inclui aprovar a
   atualização do comentário do DTO e da §10 da spec.
2. **D9 — formato do código automático** por empresa quando o RH criar
   referência inline (G1, G2, G3 ou G4).
3. **D9 — confirmação** antes de criar ou criação imediata.
4. **D-CC — Centro de custo nesta etapa.** Levantamento: os contratos para
   **busca e escolha** já existem — listagem e detalhe, RBAC (RH lê e cria;
   DP e financeiro leem), validação na admissão, E2E de CRUD e de isolamento
   (`organizacao.e2e-spec.ts`), cliente web com `criarCentroCusto` e tela
   própria (`CentrosCustoScreen`). O que **falta** é decisão de produto: a
   T180 deixou Centro de custo sem cadastro rápido, e incluí-lo na criação
   inline precisa ser aprovado. Recomendação: entrar na **busca** já na
   primeira entrega; criação inline só com aprovação explícita.

## 10. Fora de escopo desta preparação

Implementação de produto; mudança de API, schema, migration, índice, RBAC,
seed, Docker, dependências ou banco; criação inline; Área e Equipe; o teto
de 100 nas outras telas; push, PR, promoção e merge.

## 11. Entrega (implementada em 2026-10-29)

**Decisões aprovadas pela proprietária:** D8 aprovada — busca aditiva no
servidor para Departamento, Cargo, Unidade e Centro de custo, por código ou
nome, sem diferenciar maiúsculas, antes da paginação; resultados de 20 em 20
com "Mostrar mais"; `CÓDIGO — Nome` visível. **D-CC:** Centro de custo entra
na busca (ele já é campo da etapa 2 da Nova admissão). Criação inline fica
fora; Área continua fora. D9 (código automático e confirmação curta) segue
documentada para a entrega seguinte, sem produto agora.

### 11.1 API

- `busca` opcional nas quatro rotas, num DTO próprio
  (`ListarReferenciasQueryDto`); Empresa, Área e Equipe seguem sem busca.
- O termo casa com parte do **código ou do nome**, sem diferenciar
  maiúsculas. **Regra desta entrega: sem remoção de acentos** — um termo
  digitado sem acento não encontra um nome acentuado.
- Entra no `where` com escopo e situação, antes de `skip`/`take`; o `total`
  conta só o que casa. Termo vazio ou ausente: a listagem de sempre.
- Validação igual à da T178/T182: aparada, espaços colapsados, até 160
  caracteres, sem caractere de controle, só texto; o erro diz a regra, nunca
  o termo. Curingas (`%`, `_`) valem literalmente.
- Escopo por empresa, RBAC, ordenação por código e auditoria inalterados; o
  termo não vai para log (o log de requisições já não leva URL nem query,
  T178), auditoria nem evento. `escaparCuringas` passou a um utilitário comum.

### 11.2 Interface

- Os quatro campos viraram o componente `SeletorDeReferencia` (combobox com
  lista): o campo é a busca; a escolha atual aparece sempre logo abaixo
  ("Escolha atual: CÓDIGO — Nome"), mesmo fora da página exibida.
- Abre só por ação explícita (digitar, clicar, seta para baixo, "Mostrar
  opções"); foco vindo de Tab ou de erro não abre. Setas percorrem, Enter
  escolhe, Escape fecha sem mexer na escolha. Com a lista **fechada**, Enter
  segue o formulário (como nos demais campos de texto, T195). O Enter que
  fica com o próprio seletor (decisão N2 da T195) vale para os seletores
  nativos que restaram (Área, Equipe, jornada).
- Vazio, carregando e falha com "Tentar de novo"; contagem e escolha
  anunciadas uma vez numa região de status; a opção escolhida é marcada por
  texto ("escolha atual"), não só por cor.
- Resposta atrasada, página anterior e componente desmontado (a troca de
  empresa remonta a tela, T189) são descartados.
- Opcionais (Unidade e Centro de custo) têm "Limpar escolha"; obrigatórios
  (Departamento e Cargo) não.
- A lotação passou a duas colunas — Departamento e Cargo; Área (logo abaixo
  do Departamento) e Unidade; Equipe e Centro de custo — para o campo de
  busca caber ao lado dos botões de 44 px.
- Defesa do cliente mantida (`soAtivos`, a mesma de antes da T196): a
  consulta pede só ativos ao servidor e, se ele devolver uma referência
  inativa, ela não vira opção (e sai do total da página).
- A carga inicial não lê mais as quatro listas (o teto de 100): só confere,
  com um item, se a empresa tem Departamento e Cargo ativos (o aviso de
  referências da T179). O "+" do RH (T180) continua para Departamento, Cargo
  e Unidade; depois de uma falha de rede nele, a busca daquela referência é
  relida.
- Validação por etapa, confirmação, idempotência, ViaCEP e etapas sem
  mudança; o servidor continua revalidando cada referência (ativa e da
  empresa da sessão) na gravação.

### 11.3 Limites conhecidos

- Sem remoção de acentos; sem índice de texto (`ILIKE` por empresa).
- O teto de 100 segue em Área e Equipe (listas) e fora da admissão
  (filtros de Colaboradores, Dados contratuais e Histórico funcional).
- O termo digitado é descartado ao fechar a lista (Escape, escolha ou saída
  do campo); a escolha nunca.

### 11.4 Próxima fatia (não implementada)

Criação inline ("Criar «termo»" para o RH), código automático por empresa e
confirmação curta antes de criar (D9) pertencem à entrega seguinte.
