# T197 — Dossiê: criação inline de referências na Nova admissão

**Situação:** implementada (2026-10-29), depois da preparação de decisão; a
entrega está na seção 12. Sem schema, migration, RBAC, seed, Docker ou
dependência.
**Escopo:** criar **Departamento**, **Cargo**, **Unidade** e **Centro de
custo** a partir da busca dos seletores da **etapa 2** da Nova admissão (T195,
T196).
**Diretriz:** uma funcionalidade completa por entrega, com as correções
pequenas e acionáveis resolvidas antes de Ready for review (regras 7 e 8 do
`tasks.md`).
**Origem:** seção 8 do [dossiê da T196](t196-dossie-busca-referencias.md)
(D9) e seção 6.3 do [dossiê da T194](t194-dossie-entrada-de-colaboradores.md)
(alternativas G1 a G4 do código).

## 1. Resumo e recomendação

Hoje o RH cria uma referência na Nova admissão pelo botão "+" ao lado do
seletor (T180): um modal pede **código** e **nome**, e só existe para
Departamento, Cargo e Unidade. Centro de custo não tem cadastro rápido. A
busca da T196 encontra o que existe, mas, quando o termo não existe, o RH
precisa abrir o "+" e digitar de novo, inventando um código.

Recomendação (sujeita às decisões da seção 11):

1. **Servidor:** o `POST` atual das quatro referências passa a aceitar
   `codigo` **opcional**. Sem `codigo`, o servidor gera um a partir do nome
   (maiúsculas ASCII, `_` como separador, sufixos `_2`, `_3`… em colisão) e
   recusa o pedido se a empresa já tiver uma referência com o **mesmo nome**.
   Escopo por empresa, RBAC, CSRF, auditoria e unicidade do código ficam
   como estão.
2. **Web:** quando o termo buscado não corresponde exatamente a uma opção, o
   seletor oferece ao RH a opção "Criar «termo»". Ela abre uma confirmação
   curta; confirmada, a referência é criada na empresa ativa e fica
   **escolhida** pelo mesmo caminho da escolha manual. O DP continua só
   pesquisando e escolhendo.
3. Área e Equipe ficam fora, como importação, admissão digital, documentos,
   upload e R2.

## 2. Estado atual (levantamento no código)

### 2.1 Cadastro rápido da T180

- `apps/web/src/screens/pessoas/ModalReferenciaRapida.tsx`: modal com
  **código** (`/^[A-Z0-9_]{2,32}$/`) e **nome** (até 160), só para
  Departamento, Cargo e Unidade. A empresa é sempre a ativa que a página
  recebeu do servidor.
- O "+" aparece só para o RH (`botaoNovaReferencia`,
  `NovaAdmissaoScreen.tsx:1181`); o DP não o vê.
- Tradução das recusas (`errosDaRecusa`): 403 `csrf_invalido` → página
  desatualizada (o token é descartado e o mesmo pedido pode ser repetido);
  401 → sessão expirada, dados mantidos; rede ou 5xx → envio incerto, a lista
  é relida antes de o RH tentar de novo; 409 → código em uso; 403 → perfil
  sem permissão; 404 → empresa não confirmada; outro 4xx → dados recusados.
- Criada a referência, a página a acrescenta às opções conhecidas
  (`comReferenciaNova`, `NovaAdmissaoScreen.tsx:242`), a escolhe pelo mesmo
  caminho da troca manual (no Departamento, limpa e relê as Áreas) e devolve
  o foco ao seletor. O modal conta como edição em andamento (T189,
  `useEdicaoEmAndamento`).

### 2.2 Contrato de criação

- `POST /v1/departamentos`, `/v1/cargos`, `/v1/unidades-organizacionais` e
  `/v1/centros-de-custo`, cada um com `CsrfGuard`, `AuthorizationGuard` e
  `@RequirePermission(<recurso>, "create")`.
- Corpo: `CodigoNomeDto` (`apps/api/src/organizacao/dto/organizacao.dto.ts`)
  com `codigo` **obrigatório** (`CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/`) e
  `nome` de 1 a 160 caracteres, mais `empresaId` (UUID).
- O serviço resolve a empresa pelo escopo da sessão (`resolverEmpresaPai`);
  empresa fora do escopo responde **404** e registra a negação.

### 2.3 Unicidade e erros

- Unicidade só do código, por empresa: `@@unique([empresaId, codigo])` nos
  quatro modelos, valendo também para referências **inativas**.
- O nome **não** é único: hoje duas referências podem ter o mesmo nome com
  códigos diferentes.
- `P2002` vira **409** sem corpo que indique o campo
  (`apps/api/src/organizacao/prisma-erro.util.ts`).

### 2.4 Auditoria e logs

- A criação grava `organizacao_<recurso>_criado` com ator, papel, empresa,
  recurso e id (`registrarMutacao`, `organizacao-auditoria.service.ts:26`).
  O evento não tem campo de texto livre: o nome **não** vai para a trilha.
- `AuditAction` é enum do banco (`schema.prisma:360`): uma ação nova exigiria
  migration. A criação inline **reusa** as ações atuais.
- O log HTTP serializa só método, rota, status e duração; corpo, query e
  parâmetros nunca entram (`apps/api/src/common/logger/logger.module.ts`).

### 2.5 Permissões (`rbac.evaluator.ts:258`, `evaluateOrganizacao`)

| Perfil           | Criar Departamento, Cargo, Unidade | Criar Centro de custo | Ler as quatro                   |
| ---------------- | ---------------------------------- | --------------------- | ------------------------------- |
| `rh`             | sim, só na própria empresa         | sim, só na própria    | sim, própria empresa            |
| `dp`             | não (403)                          | não (403)             | sim, própria empresa            |
| `financeiro`     | não                                | não                   | só Centro de custo              |
| `master_tecnico` | sim, auditado                      | sim, auditado         | sim; sem acesso à Nova admissão |
| demais           | não                                | não                   | não                             |

### 2.6 Seletor da T196

`SeletorDeReferencia` já tem a busca no servidor, o anúncio único numa região
de status, o descarte de respostas obsoletas (`pedidoRef`), a releitura
forçada (`versao`) e o espaço para uma ação ao lado do campo (`acao`, usado
pelo "+").

### 2.7 Regra R1 do módulo organizacional

`docs/modules/etapa1-nucleo-organizacional.md` (R1): todo nó tem código
obrigatório, estável e imutável. A geração no servidor **mantém** R1 — a
entidade continua sempre com código, e ele não muda depois. Só a **entrada**
deixa de exigir o código quando o servidor o gera. A implementação atualiza o
texto de R1 e a §10 do módulo para dizer isso.

## 3. Inspiração funcional

A referência é só o comportamento: criar uma opção inexistente direto no
campo de busca, sem sair do formulário. Interface, textos, marca e código de
sistemas externos não são copiados; a interface segue os componentes e o
vocabulário do Evolli.

## 4. Contrato proposto (API)

### 4.1 Forma do contrato (D10)

Recomendado: `codigo` **opcional** no `POST` atual. Com `codigo`, nada muda
(Estrutura, Funções e cargos e o "+" da T180 continuam iguais). Sem `codigo`,
o servidor gera o código e aplica a regra de nome repetido (4.3).

Alternativa: rota nova por referência, só com `empresaId` e `nome`. Separa o
caminho automático, mas duplica controlador, guarda e testes nas quatro.

### 4.2 Geração do código (D11)

1. Partir do nome já normalizado (4.5).
2. Decompor e retirar acentos (NFD, sem as marcas combinantes).
3. Passar para maiúsculas.
4. Trocar cada sequência de caracteres fora de `A-Z` e `0-9` por um `_`.
5. Retirar `_` do começo e do fim.
6. Cortar em 32 caracteres.
7. Se sobrarem menos de 2 caracteres (nome curto ou só símbolos), prefixar
   pelo tipo: `DEP`, `CAR`, `UNI` ou `CC` (com `_` antes do que sobrou, se
   sobrou algo).
8. Colisão (qualquer status): tentar `BASE`, `BASE_2`, `BASE_3`…, cortando a
   base para o sufixo caber nos 32. Acima de um limite de tentativas (proposta:
   50), **409** `codigo_indisponivel`.

O código gerado sempre satisfaz `CODIGO_PATTERN` e volta na resposta. Cada
tentativa roda na própria transação (no PostgreSQL, uma violação de
unicidade aborta a transação), ou dentro da trava de 4.3, que torna a busca
do próximo sufixo determinística.

### 4.3 Nome repetido (D12)

Sem `codigo`, antes de criar, o servidor procura na empresa e no mesmo tipo
uma referência com o **mesmo nome** (normalizado como em 4.5, sem
diferenciar maiúsculas, acentos distintos):

- **ativa:** **409** `nome_em_uso`, com `id`, `codigo` e `nome` da existente
  (da própria empresa, que o RH já pode ler). A tela oferece escolhê-la. Isso
  também torna seguro repetir um envio incerto: se o primeiro gravou, o
  segundo devolve a referência criada.
- **inativa:** **409** `nome_inativo`, sem reativar. Reativar continua em
  Estrutura (permissão `manage`).

Uma trava consultiva da transação (`pg_advisory_xact_lock`, por empresa e
tipo) serializa as criações automáticas e fecha a corrida entre dois envios
iguais, sem índice novo nem migration. O caminho com `codigo` não usa a regra
nem a trava.

### 4.4 Respostas

| Situação                                       | Resposta                                    |
| ---------------------------------------------- | ------------------------------------------- |
| criada                                         | 201 com a entidade (inclui o código gerado) |
| nome vazio, longo ou com caractere de controle | 400, mensagem da regra, sem repetir o nome  |
| sem sessão                                     | 401                                         |
| token CSRF desatualizado                       | 403 `csrf_invalido`                         |
| perfil sem `create`                            | 403                                         |
| empresa fora do escopo da sessão               | 404 (negação auditada)                      |
| nome repetido ativo                            | 409 `nome_em_uso` + referência existente    |
| nome repetido inativo                          | 409 `nome_inativo`                          |
| código manual em uso (caminho atual)           | 409, como hoje                              |
| sufixos esgotados                              | 409 `codigo_indisponivel`                   |
| falha do servidor                              | 5xx                                         |

### 4.5 Normalização do nome (D16)

Proposta: aparar e colapsar espaços repetidos; recusar caracteres de
controle; manter maiúsculas, minúsculas e acentos como digitados; limite de 160. É a mesma regra do termo da busca da T196, então "Criar «termo»" grava
exatamente o termo que o RH vê.

### 4.6 Auditoria e logs

- Reusar `organizacao_<recurso>_criado`; o evento continua só com ids. Nada
  do nome vai para a trilha, nem nas negações.
- O nome não entra no log HTTP (corpo nunca é serializado) nem em mensagens
  de erro.
- Testes provam as três coisas (seção 7).

## 5. Interface proposta (etapa 2)

### 5.1 Onde aparece "Criar" (D13)

Proposta: só para o RH, com o termo não vazio depois de normalizado, a busca
concluída (não carregando nem em falha) e nenhuma opção carregada com nome
idêntico ao termo. Aparece como **última opção da lista**, com texto que
deixa claro que cria ("Criar cargo «termo»"), e também no estado vazio.
Alcançável pelas setas como as demais. O servidor continua sendo a
autoridade: um nome repetido em página não carregada volta como
`nome_em_uso`.

### 5.2 Confirmação curta (D14)

Proposta: um diálogo curto com o componente `Modal` já usado pela T180:

- título com o tipo ("Criar cargo");
- o nome exatamente como será gravado;
- a frase "O código será gerado automaticamente.", sem prévia do código (só o
  servidor sabe se haverá sufixo);
- ações "Criar e escolher" e "Voltar à busca".

Alternativa: confirmação dentro do próprio painel do seletor, sem diálogo.

### 5.3 Depois de criar

- A referência entra nas opções conhecidas e fica escolhida pelo mesmo
  caminho da escolha manual; no Departamento, isso limpa e relê as Áreas.
- A busca daquela referência é relida (`versao`).
- O foco volta ao campo, e a região de status anuncia uma vez "«CÓDIGO —
  Nome» criado e escolhido."

### 5.4 Destino do "+" da T180 (D15)

- **A (recomendada):** manter o "+" como está, para quem quer escolher o
  código; a criação inline é o caminho rápido. Centro de custo ganha só a
  criação inline.
- B: retirar o "+" e ficar só com a criação inline.
- C: manter o "+" e acrescentá-lo também a Centro de custo.

### 5.5 Comportamento por situação

| Situação                | Na tela                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| sucesso                 | escolhida, anúncio, foco no campo                                                                                     |
| `nome_em_uso`           | a confirmação explica que já existe e oferece "Escolher «CÓDIGO — Nome»"; nada é criado                               |
| `nome_inativo`          | aviso de que existe inativa e que a reativação é em Estrutura; termo mantido                                          |
| `codigo_indisponivel`   | aviso para usar o "+" (se mantido, D15) ou outro nome                                                                 |
| 400                     | mensagem da regra na confirmação; termo mantido                                                                       |
| 401                     | sessão expirada; termo e formulário mantidos                                                                          |
| 403 `csrf_invalido`     | página desatualizada; o token é descartado e o mesmo pedido pode ser confirmado de novo                               |
| 403                     | perfil sem permissão; a opção "Criar" some                                                                            |
| 404                     | empresa ativa não confirmada; nada escolhido                                                                          |
| rede ou 5xx             | envio incerto: a busca é relida; confirmar de novo é seguro, porque um nome já gravado volta como `nome_em_uso` (4.3) |
| duplo clique em "Criar" | um só pedido: o botão fica ocupado até a resposta                                                                     |
| resposta atrasada       | só vale a do pedido atual; fechar a confirmação durante o envio não cancela a gravação, e o resultado é anunciado     |
| troca de empresa        | a tela remonta (T189); respostas da empresa anterior são descartadas e nada é escolhido na nova                       |

### 5.6 Acessibilidade e teclado

- "Criar «termo»" é uma `option` do `listbox`, com texto próprio e marca
  visual que não depende só de cor.
- Enter nela abre a confirmação; não envia o formulário nem avança a etapa.
- No diálogo: foco inicial no nome confirmado ou na ação principal, foco
  preso, Escape volta à busca com o termo mantido e o foco no campo.
- Anúncios uma vez só, na região de status do seletor.
- 375 px sem rolagem horizontal; controles de 44 px.

### 5.7 Edição em andamento (T189)

A confirmação aberta e o envio em curso contam como edição em andamento, como
o modal da T180, para a troca de empresa avisar antes de descartar.

## 6. Matriz de permissões e isolamento

- RH cria só na empresa da sessão; `empresaId` de outra empresa responde 404,
  com a negação auditada.
- DP não vê "Criar"; um `POST` direto responde 403.
- Financeiro e demais perfis: sem acesso à Nova admissão; `POST` direto
  responde 403.
- `master_tecnico` mantém o que tem hoje na API e continua sem a Nova
  admissão.
- Nenhuma regra de RBAC muda.

## 7. Estratégia de testes

**API (unitários):**

- geração do código: acentos, símbolos, espaços, nome curto, nome só com
  símbolos, corte em 32, sufixos que respeitam 32, colisão com inativa,
  limite de tentativas;
- DTO: `codigo` ausente aceito, presente com a regra atual, nome normalizado,
  recusas sem repetir o valor.

**E2E com PostgreSQL real:**

- as quatro rotas sem `codigo`: 201 com código gerado, colisão com sufixo,
  colisão com inativa;
- nome repetido ativo (409 com a existente) e inativo;
- dois envios simultâneos do mesmo nome: um 201 e um `nome_em_uso`;
- caminho com `codigo` inalterado;
- isolamento entre empresas (404), RH, DP, financeiro, `master_tecnico` e
  perfis negados;
- CSRF e sessão;
- nome ausente da trilha de auditoria e do log de requisições.

**Web:**

- opção "Criar" só para o RH e só sem nome idêntico carregado;
- teclado, Enter sem envio, Escape, foco e anúncios;
- confirmação; escolha automática (Departamento relê Áreas);
- cada linha de 5.5, inclusive duplo clique, resposta atrasada e troca de
  empresa;
- contrato de CSS a 375 px.

**Localhost:** dados sintéticos, RH e DP, sem gravar no banco da prévia fora
do que o teste exigir; se o banco local não estiver disponível, registrar o
limite e apoiar a prova na CI com PostgreSQL real.

## 8. Riscos e limites

- Nome repetido é regra da aplicação, não do banco: fica restrita ao caminho
  automático. Os caminhos com código manual continuam aceitando nomes
  repetidos.
- A trava consultiva serializa as criações automáticas por empresa e tipo; o
  volume esperado é baixo.
- Comparar nomes sem remover acentos segue a regra da T196; dois nomes que só
  diferem por acento são tratados como diferentes.
- O código gerado é imutável (R1): um nome mal digitado pode ser corrigido
  depois, o código não.

## 9. Fora de escopo

Área, Equipe, importação, admissão digital, documentos, upload, R2, edição,
inativação e reativação inline, mudança de schema, migration, RBAC, seed,
Docker e dependências, e as telas fora da Nova admissão.

## 10. Relação com entregas anteriores

- T180: o modal "+" e o tratamento das recusas são a base; o destino do "+"
  é D15.
- T196: o seletor, a busca e a normalização do termo são reusados; a criação
  não muda a paginação nem a contagem.

## 11. Decisões (aprovadas em 2026-10-29)

Todas aprovadas como recomendado abaixo; a trava de D12 ficou por empresa,
tipo **e nome normalizado** (seção 12).

1. **D10 — Forma do contrato:** `codigo` opcional no `POST` atual
   (recomendado) ou rota nova por referência.
2. **D11 — Detalhes da geração do código:** prefixo por tipo para nome curto
   (`DEP`, `CAR`, `UNI`, `CC`), sufixo a partir de `_2` e limite de 50
   tentativas.
3. **D12 — Nome repetido no caminho automático:** recusar com
   `nome_em_uso` (devolvendo a existente) e `nome_inativo`, com trava
   consultiva por empresa e tipo (recomendado), ou permitir nomes repetidos.
4. **D13 — Onde aparece "Criar":** última opção da lista e estado vazio,
   só sem nome idêntico carregado (recomendado), ou só quando a busca não
   encontra nada.
5. **D14 — Formato da confirmação:** diálogo curto com o `Modal` atual
   (recomendado) ou confirmação dentro do painel; sem prévia do código.
6. **D15 — Destino do "+" da T180:** manter (recomendado), retirar, ou
   manter e estender a Centro de custo.
7. **D16 — Normalização do nome criado:** aparar e colapsar espaços,
   recusar caracteres de controle, preservar maiúsculas e acentos
   (recomendado).

## 12. Entrega (implementada em 2026-10-29)

### 12.1 API

- `codigo` passou a ser **opcional** só em `CriarDepartamentoDto`,
  `CriarCargoDto`, `CriarUnidadeOrganizacionalDto` e `CriarCentroCustoDto`
  (`CodigoOpcionalNomeDto`). Ausente, o serviço usa
  `criarComCodigoAutomatico` (`apps/api/src/organizacao/criacao-automatica.ts`);
  vazio ou nulo continuam recusados pela regra do código. Empresa, Área e
  Equipe seguem exigindo código.
- A empresa e a permissão são resolvidas antes, como sempre (sessão,
  `resolverEmpresaPai`, `podeAcessar`): o cliente não decide empresa, código
  final, unicidade nem permissão.
- Nome: extremidades aparadas, espaços repetidos reduzidos a um, recusa de
  caractere de controle e do que passar de 160 (400 sem repetir o valor).
- Numa transação: trava consultiva (`pg_advisory_xact_lock`) por tipo,
  empresa e nome normalizado; procura de nome igual na empresa (sem
  diferenciar maiúsculas, acentos contam); 409 `nome_em_uso` com `id`,
  `codigo` e `nome` da ativa, ou 409 `nome_inativo` sem reativar; primeiro
  código livre entre `BASE`, `BASE_2` … `BASE_50` (de qualquer status), ou
  409 `codigo_indisponivel`; gravação e auditoria.
- Código: ASCII em maiúsculas, sem acento, `_` no lugar de espaço e símbolo,
  até 32; nome sem 2 caracteres úteis usa `DEP`, `CAR`, `UNI` ou `CC`.
- Dois nomes diferentes que geram o mesmo código ao mesmo tempo: a
  unicidade do banco recusa o segundo e a transação inteira roda de novo
  (até 5 vezes), já vendo o código ocupado.
- O 409 com código usa `ConflitoDeReferenciaException`, montado campo a
  campo pelo filtro de exceções. A referência devolvida é sempre da empresa
  da sessão.
- Auditoria: as ações de criação de sempre (`organizacao_*_criad*`), só com
  ids. Nome, código gerado e termo não vão para log, auditoria nem mensagem
  de erro.

### 12.2 Interface

- `SeletorDeReferencia` ganhou `criacao` (só o RH a recebe) e `aviso`. Com
  `criacao`, um termo válido sem nome idêntico entre os resultados oferece
  "Criar «termo»" como última opção, também no vazio; o anúncio da contagem
  diz que a opção está no fim da lista. A oferta só vale para o termo que os
  resultados respondem.
- `ModalCriacaoInline`: confirmação com o `Modal` do Evolli, título com o
  tipo, o nome exato e "O código é gerado automaticamente", sem prévia do
  código. "Criar e escolher" envia uma vez (trava síncrona); durante o envio
  o diálogo não fecha. Cancelar, Escape e Fechar não criam nada e devolvem o
  foco ao campo, com o termo.
- Sucesso: a referência fica escolhida pelo mesmo caminho da escolha manual
  (no Departamento, limpa e relê as Áreas), a busca do seletor é relida e
  limpa, o foco volta ao campo e a região de status anuncia "Criado e escolhido:
  CÓDIGO — Nome." uma vez. Nada da admissão se perde.
- Recusas no diálogo: `nome_em_uso` oferece "Escolher CÓDIGO — Nome";
  `nome_inativo`, `codigo_indisponivel`, 400, 403 e 404 explicam e não
  oferecem nova tentativa; 401, sessão expirada e CSRF desatualizado dizem
  que nada foi criado e permitem confirmar de novo; rede e 5xx não afirmam
  criação, releem a busca e permitem confirmar de novo (um nome já gravado
  volta como `nome_em_uso`).
- A confirmação aberta é edição pendente e o envio, salvamento (T189); a
  troca de empresa remonta a página e descarta respostas atrasadas.
- O "+" da T180 segue para Departamento, Cargo e Unidade; Centro de custo
  ganhou só a criação inline. O DP não recebe a oferta.

- Validação no localhost (banco isolado, dados sintéticos) trouxe dois
  ajustes pequenos, feitos na entrega: a busca passa a ser limpa depois de
  criar ou escolher pela confirmação, como numa escolha da própria lista; e o
  vazio concorda no feminino ("Nenhuma unidade encontrada").

### 12.3 Limites conhecidos

- Nome repetido é regra da aplicação no caminho automático; os caminhos com
  código manual continuam aceitando nomes repetidos.
- Nomes que só diferem por acento são diferentes (mesma regra da T196).
- O código gerado é imutável (R1).
