# Etapa 2 — Documentos e Admissão Digital: V1 Estrutural

Status: **especificação em revisão (2026-08-07)** — nenhuma implementação
existe. Este documento é **somente especificação**: não cria código,
`schema.prisma`, migration, endpoint, DTO, dependência, bucket, integração
externa, upload, segredo, teste, PR ou merge.

Fase do rito SDD: **Especificar**. Aprovar, Implementar, Verificar e
Registrar são fases posteriores, cada uma com ciclo próprio.

**Esta fatia não habilita upload de documento real, e nada nela deve ser
lido como se habilitasse.** O objetivo é decidir a arquitetura de
segurança, o modelo conceitual e as fronteiras **antes** de existir
qualquer arquivo — porque retrofitar controle de acesso depois que o
conteúdo já se espalhou é, historicamente, onde vazamento acontece.
Habilitar upload exige passar por **duas camadas de portões distintas**
(§13), nenhuma delas satisfeita por este documento.

Depende de (tudo já integrado em `main`, commit
`241a73a80ec1770285d243f11d394c9e803e9fc3`):

- [Etapa 0 — Fatia 3 (identidade, sessão e autorização)](etapa0-fatia3-identidade-acesso.md)
- [Etapa 0 — Fatia 4 (auditoria formal)](etapa0-fatia4-auditoria-formal.md)
- [Etapa 1 — Fatia 1 (Núcleo Organizacional Interno V1)](etapa1-nucleo-organizacional.md)
- [Etapa 1 — Fatia 2 (Colaboradores e vida funcional V1)](etapa1-fatia2-colaboradores-vida-funcional.md)
- [ADR 0001](../adr/0001-fundacao-api.md), [ADR 0002](../adr/0002-papeis-postgres-e-migrations.md),
  [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md),
  [ADR 0005](../adr/0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)

## 0. Contexto decisório e observações registradas

As observações abaixo foram **levantadas e registradas, não resolvidas por
suposição**. Cada uma que exige julgamento de produto, RH, jurídico ou DPO
aparece como decisão pendente em §14.

### O1 — Esta fatia é a destinatária de DP-24, que continua pendente

A [spec da Etapa 1 — Fatia 2](etapa1-fatia2-colaboradores-vida-funcional.md)
(§4.6) previu conceitualmente o slot `AnexoMovimentacao` e o declarou
**não implementável**, com esta justificativa literal:

> Anexo de movimentação funcional é, quase por definição, documento com
> dado pessoal (atestado, termo, comprovante). Armazená-lo exige storage
> privado, quarentena e metadados — **exatamente o módulo de Documentos,
> Etapa 2**, que ainda não existe. (…) Tentar resolver isso nesta fatia
> significaria construir um subsistema de documentos por atalho, sem os
> controles que a Etapa 2 vai definir — o caminho mais curto para
> vazamento.

**Esta spec é a destinatária daquela pendência (DP-24)** — mas não a
resolve. Especificar a arquitetura é pré-requisito de resolvê-la, não
substituto. DP-24 permanece pendente até que os portões de §13 sejam
efetivamente satisfeitos.

### O2 — "V1 Estrutural" tensiona um princípio repetidamente aplicado neste repositório

O repositório rejeitou antecipação estrutural **três vezes**, de forma
explícita e registrada:

| Onde                                                                            | O que foi rejeitado                                                        |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md), decisão 8           | Antecipar o vínculo `access_user` ↔ colaborador antes de a Etapa 1 existir |
| [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md), decisão 8 | Antecipar a relação de gestor, **nem mesmo estruturalmente**               |
| [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md), decisão 9 | Introduzir vigência nos nós organizacionais antes de haver colaborador     |

O argumento comum: _"preparar campo especulativo para uma entidade que
ainda não existe"_ é custo permanente por requisito inexistente.

**Uma fatia chamada "V1 Estrutural" precisa explicar por que não é a mesma
coisa — e a explicação não é automática.** Registrado como observação, não
como decisão tomada:

- **O que genuinamente difere:** nos três casos acima, o que se anteciparia
  era _modelagem de domínio_ sobre uma entidade inexistente. Aqui, o que se
  antecipa é a **arquitetura de segurança e as fronteiras de acesso** de uma
  capacidade cujo risco é conhecido e alto. A ordem "decidir controle antes
  de existir dado" é a mesma que a Fatia 2 usou ao segregar dado restrito
  antes de qualquer campo restrito existir — e ali isso foi tratado como
  acerto, não como antecipação.
- **O que continua valendo integralmente:** especificar não autoriza
  implementar. **Se a fase Implementar desta fatia deve criar qualquer
  tabela — ainda que só de metadado — é decisão de produto ainda não
  tomada** (DP-2E-01). Uma tabela de metadado que ninguém pode usar é
  exatamente o "campo especulativo" que as ADRs anteriores rejeitaram, e
  esta spec **não** decide criá-la.

Consequência prática: esta spec entrega **especificação e modelo
conceitual**. A decisão sobre o que, se algo, é materializado em banco na
V1 Estrutural fica para a fase Aprovar.

### O3 — Metadado de documento **não é dado inócuo**

Este é o ponto de segurança mais importante desta fatia, e o mais fácil de
subestimar.

**A existência e o tipo de um documento revelam informação sobre a pessoa,
sem nenhum byte de arquivo.** Um registro que diga apenas _"há um documento
da categoria C associado ao colaborador X"_ pode revelar categoria sensível
por **inferência** — condição de saúde, situação familiar, filiação — sem
que nenhum campo se chame "diagnóstico" e sem que qualquer conteúdo tenha
sido armazenado.

Consequências aplicadas em toda esta especificação:

- **Catalogar tipos documentais é, ele mesmo, uma decisão sobre dado
  pessoal — potencialmente sensível.** Não é tarefa de arquitetura, e não é
  resolvida aqui (DP-2E-02).
- **Esta spec deliberadamente NÃO nomeia nem enumera documentos
  específicos.** Onde um exemplo é necessário para ilustrar risco, ele
  aparece marcado como _ilustração de risco_, nunca como entrada de
  catálogo proposta.
- "Só metadado, sem conteúdo" **não é sinônimo de "sem dado pessoal"** e
  não pode ser usado para dispensar análise de DPO.

### O4 — Divergência de nome de arquivo, registrada

O pedido desta tarefa referenciou `docs/adr/0004-auditoria-formal-e-rastreabilidade.md`.
O arquivo versionado é
[`docs/adr/0004-auditoria-formal-e-integridade.md`](../adr/0004-auditoria-formal-e-integridade.md).
É o mesmo documento — foi ele o lido e referenciado aqui. Registrado para
rastreabilidade, sem alterar nada.

### O5 — A ARCHITECTURE.md já fixou três exigências para este módulo

Não são propostas desta spec; são compromissos já versionados
([docs/ARCHITECTURE.md](../ARCHITECTURE.md)):

> Documentos: armazenamento **privado**, **quarentena** e **metadados no
> PostgreSQL**.

> Dados e documentos sensíveis **não entram em logs, testes, repositório ou
> URLs públicas**.

Esta spec os trata como **restrições herdadas, não negociáveis** (§8), e os
detalha — nunca os relaxa.

## 1. Objetivo, valor, escopo e fora de escopo

### Objetivo

Especificar o módulo de **Documentos e Admissão Digital** em sua forma
**V1 Estrutural**: catálogo conceitual, metadados mínimos sem conteúdo,
ciclo de vida com upload **desabilitado por construção**, relação futura
com Colaborador e VínculoFuncional, e contratos de integração internos
conceituais.

O critério de sucesso desta fase é único e verificável: **ao final, existe
uma arquitetura de segurança e um modelo conceitual revisáveis, e continua
sendo impossível — por desenho, não por configuração — armazenar,
recuperar ou expor qualquer documento real.**

### Valor

- **Destrava a pendência DP-24** da Fatia 2, dando ao slot de anexo um
  destino arquitetural definido em vez de um vazio.
- **Decide controle antes de existir dado.** Mesma ordem que a Fatia 2 usou
  ao segregar dado restrito antes de existir campo restrito: quando o
  conteúdo chegar, o caminho padrão de leitura já **não terá** como
  retorná-lo.
- **Torna os portões explícitos e auditáveis.** Sem esta spec, "habilitar
  upload" seria uma decisão difusa; com ela, é uma lista fechada de
  condições verificáveis (§13).
- **Expõe cedo o risco de inferência por metadado** (O3), que é
  contraintuitivo e caro de descobrir depois que o catálogo já está em uso.

### Escopo — entra (nesta especificação)

- Separação conceitual entre metadado, conteúdo, versão, solicitação e
  estado de processamento (§3).
- Modelo conceitual futuro, **sem tabelas, sem campos pessoais inventados,
  sem catálogo de documentos nomeados** (§4).
- Estados de ciclo de vida, incluindo **`upload_desabilitado`** e a
  ausência deliberada de transição de saída (§5).
- Admissão digital como **fluxo futuro**, descrito sem implementar dado ou
  documento real (§6).
- Contratos de integração internos, **apenas conceituais** (§7).
- Controles inegociáveis do desenho futuro (§8).
- Matriz preliminar de acesso, com **negação por padrão** e o restante
  explicitamente pendente (§9).
- Classificação de dados e limites de LGPD, **sem declarar conformidade**
  (§10).
- Eventos de auditoria conceituais (§11).
- Estratégia futura de testes (§12).
- Portões para sair de "estrutural" (§13).
- Decisões pendentes, riscos, dependências (§14) e proposta de ADR futura
  (§15).

### Escopo — NÃO entra

Nada abaixo entra nesta fatia, em nenhuma forma, nem "só estruturalmente":

**Conteúdo e transporte**

- Upload e download, em qualquer rota, formato ou fluxo.
- Armazenamento de binário, em qualquer lugar — banco, disco, memória,
  fila, cache ou repositório.
- Bucket, S3, provedor externo, CDN, URL assinada, URL pré-assinada ou
  qualquer forma de endereço de conteúdo.

**Processamento**

- Antivírus, antimalware, sandbox, OCR, extração de texto, miniatura,
  conversão, assinatura eletrônica ou validação documental de qualquer
  natureza.

**Dados**

- Documento real, documento pessoal, dado sensível, anexo, imagem ou
  arquivo — de ninguém, em nenhum ambiente, inclusive teste, fixture, seed,
  exemplo de documentação e captura de tela.
- Catálogo de tipos documentais nomeados (O3, DP-2E-02).
- Qualquer dado pessoal além do que a Baseline V1 da Fatia 2 já aprovou.

**Ciclo de vida e integrações**

- Retenção ou descarte definitivo, e qualquer job de expurgo.
- Integração com e-mail, portal do colaborador, folha, ponto, provedor de
  assinatura ou qualquer terceiro.
- Notificação, lembrete ou cobrança de documento pendente.

**Infraestrutura**

- Bucket, credencial, segredo, chave de cifragem, política de IAM,
  dependência nova ou qualquer artefato de infraestrutura.

**Processo**

- Nenhum artefato de implementação: código, `schema.prisma`, migration,
  endpoint, DTO, guard, teste, dependência, PR ou merge.

## 2. Relação com o que já existe

### 2.1 Ativos que este módulo reaproveitará, sem alterar

| Ativo já integrado                                                 | Como este módulo o usaria                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Empresa`                                                          | Raiz do escopo; `empresa_id` continua a **única** fronteira de autorização (ADR 0005, d. 3) |
| `Colaborador`, `VinculoFuncional`                                  | Sujeito a que um documento se refere (§4.4)                                                 |
| `MovimentacaoFuncional`                                            | Ato ao qual um documento pode servir de anexo (DP-24, §7)                                   |
| `evaluatePermission` + `AuthorizationGuard` + `@RequirePermission` | Autorização, estendida por **ramo novo**, nunca alterando ramos existentes                  |
| Padrão de duas fases (capacidade no guard, escopo no service)      | Reaproveitado — o alvo também não é um `AccessUser`                                         |
| `AuditService.record()` / `recordOrThrow()`                        | Ponto único de escrita da trilha (ADR 0004 §2)                                              |
| `SessionGuard`, `CsrfGuard`                                        | Sessão e CSRF em toda mutação                                                               |
| Padrão anti-enumeração (404 público + evento `denied`)             | Reaproveitado integralmente                                                                 |
| Padrão de FK composta com `empresa_id`                             | Garantiria, **no banco**, que documento e sujeito são da mesma empresa                      |
| `EscopoPessoas` sem variante global (ADR 0007)                     | Precedente direto para o escopo deste módulo (§9)                                           |

### 2.2 Extensões que este módulo exigiria — todas aditivas

Nenhuma decisão aprovada é revogada, reinterpretada ou enfraquecida.

| #   | Extensão                                                  | Natureza                             | Altera decisão aprovada?                |
| --- | --------------------------------------------------------- | ------------------------------------ | --------------------------------------- |
| 1   | Novos valores em `AuditAction`                            | Migration **aditiva** de enum        | Não — ADR 0004 §5 já prevê              |
| 2   | Novos recursos em `AuditResource`                         | União no código, **sem migration**   | Não — ADR 0004 §5 já prevê              |
| 3   | Novos recursos em `AuthorizationResource`                 | União no código                      | Não — mesmo padrão de `PessoasResource` |
| 4   | Novo ramo no avaliador RBAC/ABAC                          | Ramo novo, ramos existentes intactos | Não — mesmo padrão de `evaluatePessoas` |
| 5   | Materialização do slot `AnexoMovimentacao` (Fatia 2 §4.6) | Aditiva, quando DP-24 for resolvida  | Não — o slot já foi previsto ali        |

**Nenhuma extensão de privilégio de banco.** `evolli_migrator` e
`evolli_app` mantêm exatamente os privilégios da ADR 0002. Se o
armazenamento vier a exigir credencial de provedor, ela é segredo de
infraestrutura, gerido fora do banco e fora do repositório — nunca um
privilégio novo de papel de banco (§8, DP-2E-04).

### 2.3 O que este módulo NÃO pode assumir da Etapa 1

- **`Colaborador` não tem `empresa_id`** (ADR 0007, Baseline V1 item 2): a
  empresa é propriedade do **vínculo**. Um documento referente a um
  colaborador precisa carregar `empresa_id` próprio para ser escopável —
  mesmo padrão que `AlocacaoOrganizacional` adotou.
- **`admin_tecnico` é negado no domínio de pessoas, de forma definitiva**
  (Baseline V1, item 8). Documento sobre colaborador é dado pessoal desse
  colaborador: a negação **se estende por consequência**, não por decisão
  nova (§9).
- **Dado restrito ficou fora da Fatia 2** (item 5). Este módulo **não pode
  reintroduzi-lo pela porta dos fundos** — um "documento de categoria
  salarial" seria dado remuneratório com outro nome.

## 3. Separação conceitual

Cinco conceitos são rotineiramente colapsados em um só em sistemas de
documentos. Colapsá-los é a origem mais comum de vazamento: quando
metadado e conteúdo vivem na mesma entidade, toda leitura de metadado
precisa lembrar de não trazer o conteúdo.

### 3.1 Metadado ≠ conteúdo

|                          | **Metadado**                                   | **Conteúdo**                                  |
| ------------------------ | ---------------------------------------------- | --------------------------------------------- |
| O que é                  | Fatos _sobre_ o documento                      | O arquivo em si                               |
| Onde vive                | PostgreSQL (ARCHITECTURE.md)                   | Armazenamento privado, **fora do banco** (§8) |
| Existe na V1 Estrutural? | Conceitualmente sim; materialização é DP-2E-01 | **Não. Em nenhuma forma.**                    |
| É dado pessoal?          | **Frequentemente sim, por inferência** (O3)    | Sim, por definição                            |

**A separação é estrutural, não uma convenção de código.** Nenhuma
entidade de metadado carrega bytes, base64, stream ou caminho público de
conteúdo — em nenhuma versão futura.

### 3.2 Documento ≠ versão

- **`DocumentoMetadado`** é o documento **como conceito**: a que se refere,
  de quem é, em que estado do ciclo de vida está.
- **`VersaoDocumento`** é uma **instância concreta** submetida. Substituir
  um documento cria versão nova; **nunca sobrescreve nem apaga a
  anterior** — mesmo princípio de imutabilidade já aceito para a trilha de
  auditoria (ADR 0004, d. 3) e para a vida funcional (ADR 0007, d. 7).

Sem essa separação, "substituir o documento" viraria `UPDATE` destrutivo, e
a pergunta "o que foi entregue em tal data" deixaria de ter resposta.

### 3.3 Solicitação ≠ documento

- **`SolicitacaoDocumento`** é o **pedido** para que algo seja fornecido.
  Existe **antes** de qualquer documento, e pode nunca ser atendida.
- É o que dá sentido à admissão digital (§6): um checklist de pendências é
  um conjunto de solicitações, não um conjunto de documentos vazios.

### 3.4 Estado de ciclo de vida ≠ estado de processamento

Distinção deliberada, e é onde a quarentena vive:

- **Ciclo de vida** (em `DocumentoMetadado`) é **estado de negócio**:
  pendente, disponível, expirado, excluído logicamente.
- **Estado de processamento** (em `VersaoDocumento`) é **estado técnico do
  pipeline**: recebido, em quarentena, inspecionado, aprovado, reprovado.

Colapsar os dois faria "documento existe" e "documento é seguro de
entregar" virarem a mesma pergunta — exatamente o erro que a quarentena
precisa impedir.

### 3.5 Sujeito do documento ≠ ator da operação

- **Sujeito** é a pessoa/entidade a que o documento se refere
  (`Colaborador`/`VinculoFuncional`).
- **Ator** é o `AccessUser` que solicitou, enviou, leu ou baixou.

Confundi-los reproduziria, em outro módulo, o erro que a ADR 0003 (d. 8) e
a ADR 0007 (d. 1) já rejeitaram: tratar credencial técnica como pessoa.

### 3.6 Quadro-resumo

| Conceito                | Natureza                   | Carrega conteúdo?                  | Imutável?              |
| ----------------------- | -------------------------- | ---------------------------------- | ---------------------- |
| `DocumentoMetadado`     | Conceito/estado de negócio | **Nunca**                          | Não (muda de estado)   |
| `VersaoDocumento`       | Instância submetida        | **Referência apenas**, nunca bytes | **Sim, após inspeção** |
| `SolicitacaoDocumento`  | Pedido                     | Nunca                              | Não (muda de estado)   |
| Estado de processamento | Pipeline técnico           | Nunca                              | Não                    |

## 4. Modelo conceitual futuro

Rascunho conceitual, para revisão. **Nenhuma tabela, migration, model
Prisma ou campo é criado nesta fase.** Nenhum documento específico é
nomeado (O3).

Convenção: `[PK]` chave; `[FK]` referência; `?` opcional; **`[DP-…]`**
marca o que **não está decidido**.

Nomenclatura seguiria a convenção aprovada (ADR 0006, Emenda 1): português,
sem acento, `snake_case` em banco.

### 4.1 `DocumentoMetadado`

```text
documento_metadado
  id                 [PK]  identificador tecnico opaco (UUID)
  empresa_id         [FK] -> empresa    (fronteira de autorizacao; proprio,
                                         nao derivado, pelo mesmo motivo de
                                         alocacao_organizacional)
  tipo_documento_id  [FK] -> tipo_documento   [DP-2E-02]
  estado                   ciclo de vida — ver §5
  criado_em / atualizado_em

  -- SEM conteudo, SEM caminho de arquivo, SEM URL, SEM nome de arquivo
  --      original, SEM hash de conteudo, SEM tamanho, SEM MIME.
  -- Todos esses pertencem a VersaoDocumento (§4.2) e nenhum existe na V1.
  --
  -- SEM titulo ou descricao em texto livre: seria o mesmo vetor que a
  -- Fatia 2 fechou ao proibir motivo em texto livre — dado sensivel
  -- digitado em campo nao classificado (Baseline V1, item 11).
```

**`tipo_documento_id` é referência a um catálogo que NÃO existe.** O
catálogo é DP-2E-02 e depende de produto **e** DPO, precisamente porque
nomear tipos é decidir o que o sistema revela por inferência (O3).

### 4.2 `VersaoDocumento` — não materializável na V1

```text
versao_documento                      -- NAO MATERIALIZAVEL NA V1 ESTRUTURAL
  id                    [PK]
  documento_id          [FK] -> documento_metadado
  numero_versao               sequencial por documento
  estado_processamento        pipeline tecnico — ver §5.2
  referencia_conteudo   ?     PONTEIRO OPACO para armazenamento privado
                              [DP-2E-03] — nunca URL, nunca caminho publico,
                              nunca resolvivel pelo cliente
  hash_conteudo         ?     integridade [DP-2E-05]
  tamanho_bytes         ?     [DP-2E-05]
  tipo_midia            ?     [DP-2E-05]
  enviado_por_user_id   [FK] ? -> access_user   (ATOR, nunca o sujeito)
  recebido_em           ?
  inspecionado_em       ?
  criado_em
```

Esta entidade **só passa a fazer sentido depois** dos portões de §13.
Enquanto o upload estiver desabilitado, **nenhuma versão pode existir** —
não há caminho por onde uma seria criada.

`referencia_conteudo` é ponteiro **opaco**: identifica o objeto no
armazenamento privado e **não é devolvido ao cliente em nenhuma resposta**
(§8).

### 4.3 `SolicitacaoDocumento`

```text
solicitacao_documento
  id                     [PK]
  empresa_id             [FK] -> empresa
  tipo_documento_id      [FK] -> tipo_documento        [DP-2E-02]
  sujeito                      ver §4.4
  documento_id           [FK] ? -> documento_metadado  (quando atendida)
  estado                       ver §5.3
  solicitada_em
  solicitante_user_id    [FK] -> access_user           (ATOR)
  prazo                  ?     [DP-2E-06]
  criado_em / atualizado_em

  -- SEM canal de notificacao, SEM destinatario, SEM e-mail: integracao
  -- com e-mail e portal esta fora de escopo (§1).
```

### 4.4 Relação conceitual com empresa, colaborador e vínculo

**Regra estrutural proposta:** todo documento pertence a **exatamente uma
empresa**, e essa empresa é a fronteira de autorização — sem exceção,
mesmo para papéis técnicos (§9).

Quanto ao **sujeito**, três formas são conceitualmente possíveis e **a
escolha não é feita aqui** (DP-2E-07):

| Forma                                                    | Vantagem                                     | Custo                                                          |
| -------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Referência a `VinculoFuncional`                          | Escopo de empresa vem de graça, pelo vínculo | Documento que atravessa vínculos (readmissão) precisa duplicar |
| Referência a `Colaborador` + `empresa_id` próprio        | Documento acompanha a pessoa                 | Exige garantir coerência empresa↔colaborador por FK composta   |
| Referência a `Empresa` apenas (documento organizacional) | Cobre documento sem sujeito pessoal          | Não resolve documento de pessoa                                |

**Recomendação técnica, não decisão:** suportar as três, com o sujeito
expresso por referências mutuamente exclusivas e um CHECK garantindo que
exatamente uma esteja preenchida — padrão já usado nesta base para
`area_id`/`departamento_id` na Fatia 2. Confirmar em DP-2E-07.

### 4.5 `TipoDocumento` — estrutura sem catálogo

```text
tipo_documento                        -- ESTRUTURA; CONTEUDO E DP-2E-02
  id            [PK]
  codigo        [U]  identificador tecnico estavel
  nome               rotulo de exibicao
  classificacao      grau de sensibilidade                [DP-2E-02]
  criado_em / atualizado_em

  -- ESTA SPEC NAO PROPOE NENHUMA LINHA DESTA TABELA.
  -- Enumerar tipos e decidir o que o sistema revela por inferencia (O3):
  -- decisao de produto + DPO, nunca de arquitetura.
```

**Recomendação técnica, não decisão:** o catálogo ser dado (linhas) e não
enum de banco, para que ampliá-lo não exija migration — mas com
`classificacao` restrita a enum fechado, para que o **grau de
sensibilidade** nunca seja texto livre. Confirmar em DP-2E-02.

## 5. Estados de ciclo de vida

### 5.1 `DocumentoMetadado` — estado de negócio

| Estado                 | Significado                                                  | Existe na V1 Estrutural?          |
| ---------------------- | ------------------------------------------------------------ | --------------------------------- |
| `upload_desabilitado`  | Metadado pode existir; **conteúdo não pode ser anexado**     | **Sim — único estado alcançável** |
| `aguardando_envio`     | Upload habilitado; conteúdo ainda não recebido               | Não                               |
| `em_processamento`     | Versão recebida, em quarentena/inspeção (§5.2)               | Não                               |
| `disponivel`           | Versão inspecionada e aprovada; legível sob autorização      | Não                               |
| `rejeitado`            | Versão reprovada na inspeção; conteúdo nunca disponibilizado | Não                               |
| `expirado`             | Fora de validade                                             | Não                               |
| `excluido_logicamente` | Removido do uso corrente; **nunca exclusão física**          | Não                               |

#### `upload_desabilitado` é um estado, não um _feature flag_

**Recomendação técnica central desta spec.** A desabilitação do upload deve
ser expressa como **estado sem transição de saída implementada** — não como
variável de ambiente, _feature flag_, coluna booleana ou configuração.

Motivo: uma _flag_ pode ser invertida em runtime, por quem tiver acesso à
configuração, **sem revisão e sem deixar rastro no código**. Um estado sem
transição de saída só passa a ter saída por **alteração de código e
migration**, que atravessam PR, revisão humana e CI.

O portão deixa de depender de disciplina operacional e passa a depender de
processo de engenharia — o que é auditável. Confirmar em DP-2E-08.

**Enquanto o upload estiver desabilitado, `VersaoDocumento` não tem
caminho de criação: nenhuma rota, nenhum serviço, nenhum job.** A ausência
de conteúdo não é imposta por validação; é imposta por não existir código
que o produza.

### 5.2 `VersaoDocumento` — estado de processamento (todo futuro)

| Estado          | Significado                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| `recebido`      | Bytes recebidos, **em quarentena**, jamais entregáveis                                 |
| `em_inspecao`   | Sob análise antimalware/integridade                                                    |
| `aprovado`      | Inspeção concluída sem achado; **só aqui** o conteúdo pode ser servido                 |
| `reprovado`     | Achado na inspeção; conteúdo **nunca** entregue e tratado conforme política (DP-2E-09) |
| `erro_inspecao` | Falha técnica; **fail-closed** — permanece indisponível                                |

**Regra inegociável:** `aprovado` é a **única** porta para entrega de
conteúdo. Falha, timeout ou indisponibilidade do inspetor **nunca**
degradam para "entregar mesmo assim" (§8).

### 5.3 `SolicitacaoDocumento` — estado do pedido

| Estado      | Significado                                            |
| ----------- | ------------------------------------------------------ |
| `pendente`  | Solicitado, não atendido                               |
| `atendida`  | Documento associado e disponível                       |
| `cancelada` | Retirada antes de atendimento — permanece no histórico |
| `expirada`  | Prazo vencido sem atendimento (DP-2E-06)               |

Na V1 Estrutural, `atendida` é **inalcançável**: exige documento
disponível, que exige upload habilitado.

### 5.4 O que nenhum estado autoriza

Nenhuma transição, em nenhum estado, autoriza: exclusão física de metadado,
versão ou solicitação; sobrescrita de versão inspecionada; entrega de
conteúdo não `aprovado`; ou alteração retroativa de trilha de auditoria.

## 6. Admissão digital — fluxo futuro

Descrito para dar destino arquitetural ao termo do roadmap. **Nada aqui é
implementado, e nenhum dado real ou documento participa.**

### 6.1 O que a admissão digital seria

Um **conjunto de solicitações de documento** vinculado a uma admissão já
registrada na Fatia 2 (`MovimentacaoFuncional` do tipo `admissao`),
permitindo acompanhar o que falta antes de a admissão ser efetivada.

### 6.2 Fronteira com a Fatia 2, que não pode ser cruzada

A Fatia 2 decidiu, e **esta spec não altera**:

- A efetivação de uma movimentação **não depende** de documento. Adicionar
  documento como pré-condição de efetivar admissão seria **mudança de regra
  de negócio da Fatia 2**, não integração — e exigiria decisão própria
  (DP-2E-10).
- **Nenhuma decisão trabalhista é automatizada** (ADR 0007, d. 10). Um
  checklist de documentos **não** decide se alguém pode ser admitido; ele
  registra o que foi pedido e o que foi entregue.
- **Documentos obrigatórios por tipo de vínculo não estão decididos**
  (DP-2E-11) — e definir isso é regra de RH/jurídico, jamais inferida por
  arquitetura.

### 6.3 O que a admissão digital NÃO é nesta fatia

Não é portal, não é autoatendimento, não é envio por e-mail, não é
assinatura eletrônica, não é validação documental, não é integração com
terceiro. Nenhum desses existe, e nenhum é pressuposto.

## 7. Contratos de integração internos — conceituais

Nenhum endpoint, DTO ou controller é criado. As formas abaixo são
**conceituais**, para revisão.

### 7.1 Com a vida funcional (DP-24 da Fatia 2)

O slot `AnexoMovimentacao` (Fatia 2 §4.6) seria materializado como
associação entre `MovimentacaoFuncional` e `DocumentoMetadado`, com:

- `empresa_id` coerente entre os dois lados, garantido por **FK composta**
  no banco — mesmo padrão de `Equipe` e `AlocacaoOrganizacional`;
- **nenhum conteúdo** trafegando pela movimentação;
- a associação continuando **inútil na prática** enquanto o upload estiver
  desabilitado, porque não haverá documento disponível para associar.

### 7.2 Rotas futuras — forma, não contrato fechado

Seguiriam a convenção aprovada (português, plurais, `/v1`), e a lista
abaixo é **ilustrativa**, não aprovada:

| Método   | Rota (ilustrativa)                                    | Existe na V1 Estrutural?       |
| -------- | ----------------------------------------------------- | ------------------------------ |
| GET      | `/v1/tipos-documento`                                 | Depende de DP-2E-01 e DP-2E-02 |
| GET      | `/v1/documentos`                                      | Depende de DP-2E-01            |
| GET      | `/v1/documentos/:documentoId`                         | Depende de DP-2E-01            |
| POST     | `/v1/solicitacoes-documento`                          | Depende de DP-2E-01            |
| **POST** | **`/v1/documentos/:documentoId/versoes`** (upload)    | **NÃO — bloqueada por §13**    |
| **GET**  | **`/v1/documentos/:documentoId/conteudo`** (download) | **NÃO — bloqueada por §13**    |

**Nenhuma rota `DELETE`, em nenhum recurso** — coerente com R6 da Fatia 1 e
RI-H1 da Fatia 2. "Remover" é sempre exclusão lógica.

**Nenhuma rota devolve `referencia_conteudo`, caminho, URL ou qualquer
endereço de armazenamento** — em nenhuma resposta, nem para papel algum.

## 8. Controles inegociáveis do desenho futuro

Estes controles **não são recomendações**. Qualquer implementação futura
que os contrarie deve ser bloqueada em revisão.

### 8.1 Acesso

- **C1 — Negação por padrão.** Papel, ação ou recurso não explicitamente
  concedido é negado. Recurso novo nasce negado.
- **C2 — `empresa_id` é a única fronteira**, sem variante global no escopo
  deste módulo — precedente direto de `EscopoPessoas` (ADR 0007), onde a
  ausência do caso global é garantida **pelo tipo**, não por disciplina.
- **C3 — Escopo nunca vem do cliente.** Filtro de empresa em query é
  filtro, nunca concessão; pedido fora do escopo devolve **página vazia**.
- **C4 — Fora do escopo responde 404, nunca 403.** Aqui é ainda mais
  crítico que na Fatia 2: um 403 confirmaria que **existe um documento de
  determinado tipo** para determinada pessoa — vazamento por inferência
  (O3) sem entregar um único byte.
- **C5 — Prevenção de IDOR/BOLA em toda rota que aceite identificador**,
  incluindo as de metadado — e, quando existir, a de conteúdo.
- **C6 — Autorização por empresa, papel e contexto**, avaliada **no
  servidor**, nunca no cliente e nunca derivada de parâmetro da requisição.
- **C7 — `admin_tecnico` negado por padrão** a conteúdo **e** metadado
  (§9).

### 8.2 Armazenamento

- **C8 — Armazenamento privado, sempre.** Nenhum objeto publicamente
  legível, em nenhuma hipótese, nem "temporariamente", nem "só em
  homologação".
- **C9 — Nunca URL pública.** Se um mecanismo de acesso temporário vier a
  ser adotado, ele é decisão de arquitetura própria (DP-2E-03), com prazo
  mínimo, escopo mínimo e **auditoria da emissão** — e continua proibido
  devolver endereço bruto de armazenamento.
- **C10 — Segregação metadado × conteúdo.** Metadado em PostgreSQL
  (ARCHITECTURE.md); conteúdo **fora do banco**. Nenhuma coluna de bytes,
  base64 ou _large object_.
- **C11 — Nenhuma credencial de armazenamento no repositório**, em
  nenhuma forma (ADR 0002, princípio já vigente).

### 8.3 Processamento

- **C12 — Quarentena obrigatória.** Todo conteúdo recebido entra em
  quarentena e **é inentregável** até inspeção concluída com aprovação.
- **C13 — Fail-closed.** Falha, timeout ou indisponibilidade do inspetor
  mantém o conteúdo **indisponível**. Nunca "liberar em caso de dúvida".
- **C14 — Conteúdo reprovado nunca é servido**, em nenhuma circunstância,
  para nenhum papel, nem para diagnóstico.

### 8.4 Rastreabilidade e vazamento

- **C15 — Auditoria de criação, leitura, download, alteração, expiração e
  exclusão lógica** (§11). **Leitura e download são auditados** — diferente
  da maioria dos módulos, onde leitura rotineira não gera evento.
- **C16 — Nenhum conteúdo documental em log, evento de auditoria ou
  resposta indevida.** Nem trecho, nem hash de trecho, nem nome de arquivo
  original, nem texto extraído.
- **C17 — Trilha sem dado pessoal desnecessário.** O evento registra ator,
  escopo de empresa, ação e **identificador técnico** — nunca nome do
  sujeito, nunca rótulo do tipo documental quando este revelar categoria
  sensível (O3, DP-2E-12).
- **C18 — `AllExceptionsFilter` sem vazamento de detalhe interno**
  (ADR 0001), incluindo nome de provedor, _bucket_, chave ou caminho.

## 9. Matriz preliminar de acesso

**Esta matriz é deliberadamente quase vazia. Isso é o resultado correto de
uma fase de especificação, não uma lacuna.**

Nada sobre acesso a documentos foi decidido por produto. Inventar
concessão aqui — ainda que "óbvia", como RH ver documento de admissão —
seria exatamente o que a Fatia 1 e a Fatia 2 recusaram fazer para `gestor`,
`auditor`, `dpo` e `financeiro`.

Legenda: ❌ negado (decisão derivada de decisão existente) · **⛔ pendente
de decisão** (ausência de decisão que autorize conceder — nunca lido como
concessão).

| Papel           | Metadado | Conteúdo | Solicitar | Substituir | Base                                                                                                                                                                                                                                 |
| --------------- | -------- | -------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `admin_tecnico` | ❌       | ❌       | ❌        | ❌         | **Derivado** da Baseline V1 item 8 (ADR 0007): negado a dado pessoal de colaborador, de forma definitiva. Documento sobre colaborador é dado pessoal desse colaborador — a negação se estende por consequência, não por decisão nova |
| `rh`            | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13                                                                                                                                                                                                                             |
| `dp`            | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13                                                                                                                                                                                                                             |
| `gestor`        | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13; escopo do papel já pendente desde a Fatia 1 (DP-8)                                                                                                                                                                         |
| `financeiro`    | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13                                                                                                                                                                                                                             |
| `colaborador`   | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-14 — depende do Portal, que não existe                                                                                                                                                                                         |
| `auditor`       | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13; escopo já pendente desde a Fatia 1 (DP-7)                                                                                                                                                                                  |
| `dpo`           | ⛔       | ⛔       | ⛔        | ⛔         | DP-2E-13; escopo já pendente desde a Fatia 1 (DP-7)                                                                                                                                                                                  |
| `diretoria`     | ❌       | ❌       | ❌        | ❌         | **O papel não existe** no enum `AccessRole` (Fatia 2, O3) — DP-20                                                                                                                                                                    |

### Regras que valem independentemente do que for decidido

- **A1 — Metadado e conteúdo são permissões distintas.** Ver que um
  documento existe e poder abri-lo são decisões diferentes, e uma nunca
  implica a outra.
- **A2 — Nenhum papel recebe acesso por interpretação de ambiguidade.**
- **A3 — Ninguém amplia o próprio escopo.**
- **A4 — Nenhuma escrita direta na trilha de auditoria** (ADR 0004 §2).
- **A5 — A negação de `admin_tecnico` não é ampliável por herança.** A
  exceção temporária de acesso global da Emenda 1 da ADR 0005 foi
  concedida sobre **estrutura organizacional sem dado pessoal** e **não se
  estende** a este domínio — mesma leitura restritiva já fixada pela
  Baseline V1, item 8.

## 10. Classificação de dados e limites de LGPD

**Esta seção não declara conformidade LGPD, em nenhum grau.** Ela
inventaria, delimita e transfere para DPO e jurídico o que só eles podem
decidir.

### 10.1 O que existiria — e por que nada disso é inócuo

| Elemento                                          | Classificação                                       | Observação                           |
| ------------------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| Identificadores técnicos (UUID)                   | Técnico                                             | Opacos; não derivam de dado pessoal  |
| `empresa_id` e demais referências organizacionais | Organizacional                                      | Já existentes                        |
| Referência ao sujeito (colaborador/vínculo)       | **Pessoal**                                         | Associa o documento a uma pessoa     |
| **Tipo do documento**                             | **Pessoal; potencialmente sensível por inferência** | **O3** — o ponto crítico desta fatia |
| Estados e datas                                   | Pessoal (funcional)                                 | Revelam cronologia de exigências     |
| Ator (`AccessUser`)                               | Pessoal                                             | Já tratado na Fatia 3                |
| **Conteúdo**                                      | **Pessoal, frequentemente sensível**                | **Não existe nesta fatia**           |

### 10.2 O risco de inferência, explicitado

"Só metadado" **não** significa "sem dado pessoal". Saber que existe um
documento de determinada categoria para determinada pessoa pode revelar
condição de saúde, situação familiar ou filiação — **sem nenhum byte de
conteúdo**.

_Ilustração de risco, não catálogo proposto:_ uma categoria documental que
só se aplique a situações de afastamento por saúde tornaria a simples
**existência** do registro um indicador de dado de saúde. É por isso que o
catálogo (DP-2E-02) exige DPO, e não apenas produto.

**Consequência de desenho:** a classificação de sensibilidade precisa
morar no `TipoDocumento` e **governar a exposição do próprio metadado** —
não só a do conteúdo (C17, DP-2E-12).

### 10.3 Minimização, finalidade e acesso

- **Finalidade declarada por tipo documental, antes de qualquer coleta.**
  "Pode ser útil" não é finalidade.
- **Minimização estrutural**, não documental: separar metadado de conteúdo
  (C10) e permissão de metadado de permissão de conteúdo (A1) faz o caminho
  padrão **não conseguir** entregar o que não foi explicitamente
  autorizado.
- **Negação por padrão** (C1, §9).

### 10.4 Retenção e descarte

**Não decididos. DP-2E-15.**

- A [ADR 0004, decisão 4](../adr/0004-auditoria-formal-e-integridade.md) já
  registra que não há job de retenção/expurgo e que eventos persistem
  indefinidamente, aguardando prazo jurídico.
- A Fatia 2 registrou a mesma pendência (DP-15) como **gate obrigatório
  antes de piloto com dado real**.
- Documento acrescenta um problema que os módulos anteriores não tinham:
  **descarte precisa alcançar o conteúdo no armazenamento privado**, não só
  a linha em banco. Um expurgo que apague metadado e deixe o objeto órfão é
  pior que não expurgar — perde-se a rastreabilidade sem eliminar o dado.
  Registrado como **RI-2E-05**, não resolvido.

### 10.5 Declaração explícita

**Nada nesta spec declara conformidade LGPD concluída, e nada nela deve
ser lido como afirmação de que o upload será seguro.** A segurança do
upload depende de controles que **não existem** e de decisões que **não
foram tomadas** (§13).

## 11. Eventos de auditoria — conceituais

Toda ação sensível seria auditada via `AuditService` — ponto único de
escrita (ADR 0004 §2). Verbos seguiriam a convenção aprovada: português,
minúsculas, separados por ponto, com prefixo de módulo a confirmar
(DP-2E-16).

| Evento (conceitual)                                | Quando                             | Atomicidade      |
| -------------------------------------------------- | ---------------------------------- | ---------------- |
| `…documento.metadado_criado`                       | Metadado criado                    | **Transacional** |
| `…documento.metadado_atualizado`                   | Mudança de estado ou de metadado   | **Transacional** |
| `…documento.metadado_consultado`                   | **Leitura de metadado**            | **Fail-safe**    |
| `…documento.conteudo_baixado`                      | **Download** (futuro)              | **Fail-safe**    |
| `…documento.versao_recebida`                       | Conteúdo em quarentena (futuro)    | **Transacional** |
| `…documento.versao_aprovada` / `.versao_reprovada` | Resultado da inspeção (futuro)     | **Transacional** |
| `…documento.expirado`                              | Perda de validade                  | **Transacional** |
| `…documento.excluido_logicamente`                  | Exclusão lógica                    | **Transacional** |
| `…solicitacao.criada` / `.cancelada` / `.expirada` | Ciclo da solicitação               | **Transacional** |
| `authorization_denied`                             | Negação sobre recurso deste módulo | Best-effort      |

### Por que leitura e download são auditados

Diferente dos módulos anteriores — onde leitura rotineira **não** gera
evento, para a trilha não virar log de tráfego — aqui **quem viu, e
quando, é a questão central**. O mesmo raciocínio que tornou a leitura de
dado restrito auditável na Fatia 2, aplicado a um domínio em que a leitura
**é** o risco.

**Fail-safe** significa: se o evento não puder ser gravado, **a leitura não
é respondida**. É a auditoria que torna o acesso aceitável; ela não pode
ser best-effort.

### O que a trilha NUNCA carrega

Conteúdo, trecho, nome de arquivo original, `referencia_conteudo`, URL,
hash de trecho, texto extraído, nome do sujeito — e, quando o tipo
documental revelar categoria sensível, **nem o rótulo do tipo** (C17,
DP-2E-12). Nenhum valor antes/depois (ADR 0004 §5, inalterado).

## 12. Estratégia futura de testes

Regra transversal, sem exceção: **dados exclusivamente sintéticos**.
Nenhum documento real, de ninguém, em nenhum ambiente.

### 12.1 Enquanto o upload estiver desabilitado

- **Prova de impossibilidade**, não de validação: nenhuma rota aceita
  conteúdo, nenhum serviço cria `VersaoDocumento`, nenhum estado transita
  para fora de `upload_desabilitado`.
- Verificação de que **nenhuma coluna de conteúdo** existe no schema —
  padrão já usado na Fatia 2, lendo `information_schema` e falhando se
  aparecer.
- Autorização negativa **papel a papel**, sem presumir negação por ausência
  de teste.

### 12.2 Autorização, IDOR/BOLA e isolamento

- Para **cada** papel negado ou pendente, prova de negação.
- Ator de uma empresa não lê metadado nem conteúdo de outra, em **toda**
  rota com identificador — resposta **404**, nunca 403 nem 200.
- Listagem não vaza; filtro por outra empresa devolve **página vazia**.
- **Permissão de metadado não concede conteúdo**, e vice-versa (A1).
- Tentativa fora de escopo gera evento `denied`.

### 12.3 Ausência de conteúdo onde não deve haver

- Resposta de metadado **não contém** `referencia_conteudo`, URL, caminho,
  nome de arquivo ou bytes — asserção sobre **o corpo inteiro**, não sobre
  campos esperados, para que campo novo introduzido por engano falhe.
- Nenhum log, em nenhum nível (inclusive `debug`), contém conteúdo ou
  referência de armazenamento.
- Nenhum evento de auditoria contém conteúdo, nome de sujeito ou rótulo de
  tipo sensível.

### 12.4 Quarentena e arquivo contaminado — simulação segura

- **Nunca com malware real.** Usar exclusivamente marcador de teste
  padronizado e inerte (do tipo EICAR), **jamais** amostra real, em nenhum
  ambiente.
- Provar que conteúdo reprovado **nunca** é servido, a nenhum papel.
- Provar **fail-closed**: inspetor indisponível, com erro ou em timeout
  mantém o conteúdo indisponível (C13).
- Provar que conteúdo em quarentena **não** é entregável antes da
  aprovação.

### 12.5 Trilha auditável

- Cada evento de §11 gerado com ator, escopo e `request_id` corretos.
- **Atomicidade por rollback real** — padrão já provado nas Fatias 1 e 2.
- **Fail-safe provado**: com escrita de auditoria bloqueada, leitura de
  metadado e download **não retornam 200**.

### 12.6 Retenção e descarte

Testados **somente quando a política for aprovada** (DP-2E-15). Até lá, não
há comportamento correto a verificar — e testar um comportamento não
decidido o transformaria em decisão por via de teste.

## 13. Portões para sair de "estrutural"

**Dois níveis distintos.** Confundi-los faria parecer que implementar
metadado já autoriza upload.

### 13.1 Nível 1 — portões para implementar a V1 Estrutural

Nenhum satisfeito por esta spec.

- [ ] **DP-2E-01** — decisão de produto sobre **se** e **o que** materializar
      em banco na V1 Estrutural (O2). Sem isso, não há o que implementar.
- [ ] **DP-2E-02** — catálogo documental e sua classificação de
      sensibilidade, por produto **e DPO** (O3).
- [ ] **DP-2E-13** — matriz de acesso a **metadado**, por produto e
      segurança.
- [ ] Confirmação de **DPO** de que o tratamento de metadado — incluindo o
      risco de inferência (§10.2) — tem finalidade e base legal definidas.
- [ ] Revisão de segurança do modelo, confirmando C1–C7 e C15–C18.

### 13.2 Nível 2 — portões para habilitar upload de documento real

**Todos** obrigatórios, **além** dos de Nível 1.

- [ ] **Decisão de produto sobre acesso a conteúdo** (DP-2E-13), distinta
      da de metadado (A1).
- [ ] **DPO e jurídico**: base legal, finalidade e confirmação formal para
      **conteúdo documental**, incluindo dado sensível.
- [ ] **Política de retenção, anonimização e descarte aprovada**
      (DP-2E-15), alcançando **conteúdo no armazenamento**, não só metadado
      (RI-2E-05).
- [ ] **Armazenamento privado** provisionado (DP-2E-03), com C8–C11
      verificados: nenhum objeto público, nenhuma URL pública, credencial
      fora do repositório.
- [ ] **Quarentena e antimalware operantes** (DP-2E-09), com C12–C14
      verificados, inclusive **fail-closed**.
- [ ] **Auditoria de leitura e download implementada e fail-safe** (§11).
- [ ] **MFA implementado e obrigatório** — condição já vinculante desde a
      [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md), decisão 3,
      e **agravada** aqui: documento é o dado de maior impacto do
      ecossistema até agora.
- [ ] **Testes de §12 verdes**, incluindo simulação segura de arquivo
      contaminado e prova de ausência de conteúdo em log/trilha/resposta.
- [ ] **Revisão humana de segurança** específica do fluxo de upload,
      registrada.

### 13.3 Declaração

**Enquanto qualquer item de §13.2 estiver aberto, upload permanece
desabilitado — e nada nesta spec afirma ou sugere que ele será seguro
antes disso.** Habilitar upload não é configuração: exige código,
migration, revisão e os portões acima (§5.1).

## 14. Decisões pendentes, riscos, dependências e arquivos previstos

### 14.1 Decisões pendentes

Numeração própria deste módulo (`DP-2E-nn`), para não colidir com a
sequência global das Etapas 0 e 1. Pendências herdadas são referenciadas,
não renumeradas.

| ID       | Decisão                                                                                  | Responsável             | Bloqueia       |
| -------- | ---------------------------------------------------------------------------------------- | ----------------------- | -------------- |
| DP-2E-01 | **Se** e **o que** materializar em banco na V1 Estrutural (O2)                           | Produto + Arquitetura   | Nível 1        |
| DP-2E-02 | Catálogo documental e classificação de sensibilidade (O3)                                | Produto + **DPO**       | Nível 1        |
| DP-2E-03 | Provedor e forma do armazenamento privado; mecanismo de acesso temporário, se houver     | TI/Infra + Segurança    | Nível 2        |
| DP-2E-04 | Gestão da credencial de armazenamento, sem ampliar privilégio de banco (ADR 0002)        | TI/Infra + Segurança    | Nível 2        |
| DP-2E-05 | Tamanho máximo, formatos aceitos e metadados técnicos coletados                          | Produto + Segurança     | Nível 2        |
| DP-2E-06 | Prazo de validade/expiração de documento e de solicitação                                | Produto + RH            | Nível 2        |
| DP-2E-07 | Forma do sujeito: vínculo, colaborador ou empresa (§4.4)                                 | Produto + Arquitetura   | Nível 1        |
| DP-2E-08 | Confirmar `upload_desabilitado` como **estado sem transição**, não _feature flag_ (§5.1) | Segurança + Arquitetura | Nível 1        |
| DP-2E-09 | Ferramenta de antivírus/quarentena e política para conteúdo reprovado                    | TI/Infra + Segurança    | Nível 2        |
| DP-2E-10 | Se documento vira pré-condição de efetivar admissão (§6.2)                               | Produto + RH            | Nível 2        |
| DP-2E-11 | Documentos obrigatórios por tipo de vínculo                                              | RH + Jurídico           | Nível 2        |
| DP-2E-12 | Se o rótulo do tipo documental pode aparecer na trilha (C17, O3)                         | DPO + Segurança         | Nível 1        |
| DP-2E-13 | Quem visualiza metadado, quem baixa conteúdo, quem solicita e quem substitui (§9)        | Produto + Segurança     | Níveis 1 e 2   |
| DP-2E-14 | Acesso do titular aos próprios documentos; depende do Portal                             | Produto + DPO           | Nível 2        |
| DP-2E-15 | Retenção, anonimização e descarte, alcançando o conteúdo                                 | DPO + Jurídico          | Nível 2        |
| DP-2E-16 | Prefixo de módulo para diretório, recursos e eventos                                     | Produto                 | Não bloqueante |
| DP-2E-17 | Assinatura eletrônica: se, quando e com qual provedor                                    | Produto + Jurídico      | Fora de escopo |

**Pendências herdadas, referenciadas sem alteração:** DP-24 (anexos, Fatia 2
— esta spec é a destinatária, O1), DP-15 (retenção, Fatia 2), DP-7 e DP-8
(escopo de `auditor`/`dpo` e `gestor`, Fatia 1), DP-20 (papel `diretoria`),
DP-23 (vínculo `AccessUser` ↔ Colaborador, pré-requisito de DP-2E-14).

### 14.2 Riscos

- **RI-2E-01 — Metadado tratado como inócuo.** O risco mais provável e mais
  contraintuitivo desta fatia (O3): concluir que "sem conteúdo, sem
  problema" e liberar metadado com controle fraco. Mitigação: DP-2E-02 e
  DP-2E-12 exigem DPO **antes** do Nível 1; C4 e C17 tratam o metadado como
  dado pessoal desde o desenho.
- **RI-2E-02 — Desabilitação virar _feature flag_.** Uma variável de
  ambiente pode ser invertida sem revisão nem rastro. Mitigação: DP-2E-08 —
  estado sem transição de saída, exigindo código, migration e PR.
- **RI-2E-03 — Estrutura especulativa.** Criar tabelas que ninguém pode usar
  contraria precedente explícito (O2). Mitigação: DP-2E-01 é o primeiro
  portão do Nível 1, e esta spec **não** decide materializar nada.
- **RI-2E-04 — Vazamento por URL.** Armazenamento de objetos torna público
  por descuido de configuração com facilidade. Mitigação: C8/C9, verificação
  no Nível 2 e proibição de devolver endereço em qualquer resposta.
- **RI-2E-05 — Descarte que não alcança o conteúdo.** Expurgo que apaga
  metadado e deixa o objeto órfão perde rastreabilidade **sem** eliminar o
  dado. Risco **aberto**; DP-2E-15 precisa cobrir os dois lados.
- **RI-2E-06 — Quarentena contornada sob pressão operacional.** "Só desta
  vez, o antivírus está fora" é como fail-open nasce. Mitigação: C13
  fail-closed, provado por teste (§12.4).
- **RI-2E-07 — Fatia 2 alterada por via oblíqua.** Tornar documento
  pré-condição de admissão mudaria regra de negócio já aprovada. Mitigação:
  DP-2E-10 explícito; §6.2 registra a fronteira.
- **RI-2E-08 — MFA continua pendente, agora com o dado de maior impacto.**
  O risco aceito da ADR 0003 não muda de status, mas muda de peso.
  Mitigação: portão explícito no Nível 2.

### 14.3 Dependências

| Dependência                                                               | Status                                      |
| ------------------------------------------------------------------------- | ------------------------------------------- |
| Etapas 0 e 1 integradas em `main`                                         | **Satisfeita** (commit `241a73a`)           |
| `Colaborador` e `VinculoFuncional` existentes                             | **Satisfeita** (Fatia 2)                    |
| Extensão aditiva de `AuditAction`/`AuditResource`/`AuthorizationResource` | Dependência técnica da futura implementação |
| Armazenamento privado provisionado                                        | **Não existe** — DP-2E-03, Nível 2          |
| Antivírus/quarentena                                                      | **Não existe** — DP-2E-09, Nível 2          |
| Política de retenção                                                      | **Não existe** — DP-2E-15, Nível 2          |
| MFA                                                                       | **Pendente** — vinculante no Nível 2        |
| Portal do Colaborador                                                     | **Não existe** — bloqueia DP-2E-14          |
| Confirmação de DPO                                                        | **Pendente** — Níveis 1 e 2                 |

### 14.4 Arquivos previstos (nenhum criado agora)

```text
docs/adr/00NN-<slug>.md                     # ADR proposta em §15
docs/decisions/etapa2-<slug>.md             # registro da decisao de produto
apps/api/src/<modulo>/                      # SOMENTE apos DP-2E-01
apps/api/prisma/migrations/<timestamp>_.../ # SOMENTE apos DP-2E-01
```

**Nenhum caminho de armazenamento, bucket, credencial ou artefato de
infraestrutura é previsto — nem como placeholder.**

## 15. Proposta de ADR futura (descrita, não criada)

**Nenhum arquivo de ADR é criado por esta tarefa.**

### Título proposto

**ADR — Documentos e admissão digital: segregação metadado/conteúdo,
quarentena obrigatória e upload desabilitado por construção**

### Status proposto

`proposta` — a ser redigida e promovida a `aceito` apenas quando os
portões de Nível 1 (§13.1) forem satisfeitos.

### Decisões que a ADR deve fixar

1. **Segregação estrutural metadado × conteúdo** — metadado em PostgreSQL,
   conteúdo em armazenamento privado, nunca bytes em banco.
2. **Upload desabilitado como estado sem transição de saída**, nunca
   _feature flag_ (DP-2E-08).
3. **Quarentena obrigatória e fail-closed** — `aprovado` é a única porta
   para entrega.
4. **Permissão de metadado ≠ permissão de conteúdo.**
5. **`empresa_id` como única fronteira**, sem variante global.
6. **`admin_tecnico` negado a metadado e conteúdo**, por consequência da
   Baseline V1 item 8 — sem ampliar a exceção da ADR 0005.
7. **Auditoria de leitura e download, fail-safe.**
8. **Proibição de exclusão física** e de sobrescrita de versão
   inspecionada.
9. **Nunca URL pública**, nunca endereço de armazenamento em resposta.
10. **Sensibilidade do tipo documental governa a exposição do metadado**,
    não só a do conteúdo (O3).

### O que a ADR deve registrar como NÃO decidido

Catálogo documental (DP-2E-02), provedor de armazenamento (DP-2E-03),
ferramenta de antimalware (DP-2E-09), limites técnicos (DP-2E-05),
expiração (DP-2E-06), retenção e descarte (DP-2E-15), assinatura eletrônica
(DP-2E-17), matriz de acesso (DP-2E-13), acesso do titular (DP-2E-14), e a
própria decisão de materializar algo em banco (DP-2E-01).

### O que a ADR não pode fazer

Declarar conformidade LGPD, afirmar que o upload é seguro, ampliar
privilégio de banco (ADR 0002), ampliar a exceção do `admin_tecnico`
(ADR 0005, Emenda 1), alterar regra de negócio da Fatia 2 (ADR 0007) ou
introduzir dado pessoal além do já aprovado.
