# ADR 0011 — Documentos privados e admissão digital: segregação metadado/conteúdo, quarentena obrigatória e upload desabilitado por construção

- Status: **Aceito**
- Data: 2026-08-14
- Relacionado:
  [docs/modules/etapa2-documentos-admissao-digital-estrutural.md](../modules/etapa2-documentos-admissao-digital-estrutural.md)
  (especificação estrutural que esta ADR formaliza — ver seu §15),
  [docs/decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md)
  (registro das aprovações pendentes que esta ADR **não** resolve),
  [ADR 0001](0001-fundacao-api.md), [ADR 0002](0002-papeis-postgres-e-migrations.md),
  [ADR 0003](0003-identidade-sessao-e-autorizacao.md),
  [ADR 0004](0004-auditoria-formal-e-integridade.md),
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md),
  [ADR 0006](0006-modelo-organizacional-interno-baseline-v1.md),
  [ADR 0007](0007-colaboradores-e-vida-funcional-baseline-v1.md)
- Constituição: v1.3.0, Princípios I, II, III e V; "Mandatory Architecture and Data Constraints".
- PRD: `Sistema RH - Reserva Fiscal - PRD` (Notion `dceacf66-ba47-834d-b3fc-014cc2835594`), módulo de documentos e admissão digital.

> **Nota de convergência (T027, 2026-08-14).** Os portões de **Nível 1** foram
> satisfeitos e esta ADR está **Aceito**; a **T008 (metadados, sem conteúdo)**
> foi implementada e **integrada em `main`** pelo [PR #20](https://github.com/michellbrunob/evolli-rh/pull/20)
> (squash `cdf4a71`), com Quality Gates, E2E PostgreSQL e Migration Smoke
> verdes. Em consequência, os trechos **redigidos antes da promoção** —
> a seção "Por que Proposta e não Aceito" e o parágrafo "Esta ADR não
> autoriza... início de código" logo abaixo — são **históricos**: descrevem
> o estado anterior à aprovação de Nível 1, não o estado atual. **Nível 2 e
> MFA permanecem bloqueando** upload, download e conteúdo real (ver §"Gatilhos
> de reavaliação" e a [decisão de aprovações pendentes](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md)).
> A convergência completa está em
> [docs/decisions/etapa2-documentos-convergencia.md](../decisions/etapa2-documentos-convergencia.md).

## Nota de topologia de branch (rastreabilidade, não decisão)

Esta ADR foi redigida sobre a branch da especificação estrutural
`feature/etapa2-documentos-admissao-estrutural-spec` (commit `c876b48`),
que foi ramificada de `main` no commit `241a73a`. Naquele ponto o
repositório continha ADRs 0001–0007. Em `main`, à frente desta branch,
já existem as ADRs 0008 (jornada/ponto), 0009 (painel web) e 0010
(preparação multiempresa). O número **0011** reserva o slot correto na
sequência de `main`; esta ADR referencia apenas ADRs 0001–0007, das quais
o módulo de documentos genuinamente depende, para não criar links pendentes
enquanto a branch não for integrada. Nenhuma decisão das ADRs 0008–0010 é
alterada, reinterpretada ou dependida por este documento.

## Contexto

O módulo de Documentos e Admissão Digital foi especificado em forma **V1
Estrutural** em
[docs/modules/etapa2-documentos-admissao-digital-estrutural.md](../modules/etapa2-documentos-admissao-digital-estrutural.md)
(status "especificação em revisão", 2026-08-07). Aquela especificação
verificou por inspeção — não por suposição — que **nenhum documento, upload,
storage, bucket, catálogo ou tabela de metadado existe**, e que a capacidade
de armazenar documentos é a de maior impacto de dado pessoal do ecossistema
até agora. Seu §15 descreve a ADR que deveria formalizá-la; **este documento
é essa ADR**.

A `docs/ARCHITECTURE.md` já fixou três compromissos versionados para este
módulo, tratados aqui como **restrições herdadas, não negociáveis**:
armazenamento **privado**, **quarentena**, e **metadados no PostgreSQL**;
e "dados e documentos sensíveis não entram em logs, testes, repositório ou
URLs públicas". A Constituição v1.3.0 (Princípio III) reforça: documentos e
uploads "MUST be stored outside source control, authorized per object,
validated for type, size, and content, protected in transit and at rest, and
recorded with safe metadata. Download links MUST be authenticated or
short-lived and non-public."

O risco central desta fatia é contraintuitivo e está registrado como **O3**
na especificação: **metadado de documento não é dado inócuo.** A simples
existência e o tipo de um documento podem revelar categoria sensível por
inferência (condição de saúde, situação familiar, filiação) sem que nenhum
byte de conteúdo seja armazenado. Toda decisão desta ADR parte disso.

**Esta ADR não autoriza, por si só, início de código, criação de tabela,
migration, endpoint, bucket, credencial, upload ou qualquer infraestrutura.**
Ela fixa a arquitetura de segurança e as fronteiras que qualquer
implementação futura deverá respeitar, e mantém explicitamente pendente tudo
que depende de decisão de produto, RH, DPO/Jurídico, Segurança ou TI
(ver "O que esta ADR mantém explicitamente NÃO decidido" e a
[decisão de aprovações pendentes](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md)).

_(Histórico — pré-promoção. Ver a Nota de convergência no topo: os portões de
Nível 1 foram satisfeitos e a T008 de metadados foi implementada e integrada.
O que continua bloqueado é o **Nível 2** — upload, download e conteúdo real.)_

## Por que Proposta e não Aceito (histórico, pré-promoção)

As ADRs de baseline anteriores (0006–0009) foram aceitas porque
formalizavam decisões de produto **já aprovadas**. Aqui não há aprovação
equivalente: o catálogo documental depende de produto **e DPO** (O3), a
matriz de acesso a metadado e conteúdo não foi decidida por produto, e a
confirmação de finalidade e base legal do tratamento de metadado — inclusive
o risco de inferência — não foi dada pelo DPO. A especificação estrutural
condiciona explicitamente a promoção desta ADR a `aceito` à satisfação dos
**portões de Nível 1** (§13.1 da spec). Enquanto esses portões estiverem
abertos, esta ADR permanece **Proposta**: ela registra a arquitetura para
revisão, sem declará-la aprovada e sem declarar conformidade LGPD.

### Promoção para Aceito - evidência de aprovação de Nível 1

Em **2026-08-14**, o responsável do projeto confirmou possuir autoridade de
Produto, RH, DPO/Jurídico, Segurança e Arquitetura e aprovou as deliberações
abaixo. Esta promoção autoriza exclusivamente a T008 de **metadados**, sem
conteúdo, upload, armazenamento real ou declaração de conformidade LGPD.

| Item         | Deliberação aprovada                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DP-2E-01     | Materializar `DocumentoMetadado`, `SolicitacaoDocumento` e `TipoDocumento`; sem conteúdo, versão de arquivo, upload ou storage.                                        |
| DP-2E-02     | Todo tipo documental inicia como **restrito**; catálogo e alterações exigem RH autorizado e aprovação do DPO.                                                          |
| DP-2E-07     | O sujeito do documento é `Colaborador`, com `empresa_id` próprio no metadado.                                                                                          |
| DP-2E-08     | `upload_desabilitado` é estado sem transição de saída, nunca feature flag.                                                                                             |
| DP-2E-12     | O rótulo do tipo documental não entra na auditoria; registrar somente ação e identificador técnico.                                                                    |
| DP-2E-13     | RH/DP autorizado no escopo da empresa pode consultar, solicitar e substituir metadados; gestor, colaborador e `admin_tecnico` são negados nesta V1.                    |
| DPO/Jurídico | Finalidade: gestão administrativa da relação de trabalho e cumprimento de obrigações legais/regulatórias aplicáveis; metadado é dado pessoal pelo risco de inferência. |
| Segurança    | Controles C1-C7 e C15-C18 da especificação, e decisões 1-10 desta ADR, aprovados.                                                                                      |

### Emenda 1 - catálogo materializado (2026-08-14)

Após a promoção, a autoridade aprovadora confirmou que o catálogo precisa ser
executável e auditável. Portanto, `TipoDocumento` passa a integrar a V1 de
metadados. A entidade começa sempre como **restrita**; somente RH autorizado,
com aprovação do DPO, pode criar ou alterar uma entrada. Esta emenda não
introduz conteúdo, upload, storage, download de conteúdo ou acesso do
colaborador/gestor/admin técnico.

Todos os itens de Nível 2 permanecem pendentes e continuam bloqueando upload,
conteúdo, download de conteúdo e processamento de documentos reais.

## Decisão

As dez decisões abaixo formalizam a arquitetura descrita no §15 da
especificação estrutural. Elas fixam **como** o módulo deverá ser construído
quando — e somente quando — for autorizado; não autorizam a construção.

### 1. Segregação estrutural metadado × conteúdo

Metadado de documento vive em PostgreSQL; o **conteúdo do arquivo vive em
armazenamento privado, fora do banco e fora do controle de versão**. Nenhuma
entidade de metadado carrega bytes, base64, _stream_, _large object_, nem
caminho público de conteúdo — em nenhuma versão futura. A separação é
estrutural, não convenção de código: o caminho padrão de leitura de metadado
**não tem** como retornar conteúdo, porque o conteúdo não está lá.

### 2. Upload desabilitado como estado sem transição de saída, nunca _feature flag_

A desabilitação do upload é expressa como **estado de ciclo de vida
(`upload_desabilitado`) sem transição de saída implementada** — não como
variável de ambiente, _feature flag_, coluna booleana ou configuração de
runtime. Motivo: uma _flag_ pode ser invertida em runtime, sem revisão e sem
rastro no código; um estado sem saída só passa a ter saída por **alteração de
código e migration**, que atravessam PR, revisão humana e CI. Enquanto o
upload estiver desabilitado, **não existe caminho de criação de conteúdo**:
nenhuma rota, serviço ou job produz uma versão de documento. A ausência de
conteúdo é imposta por não existir código que o produza, não por validação.

### 3. Quarentena obrigatória e fail-closed

Todo conteúdo recebido (fluxo futuro) entra em **quarentena** e é
**inentregável** até inspeção antimalware/integridade concluída com
aprovação. O estado de processamento `aprovado` é a **única** porta para
entrega de conteúdo. Falha, timeout ou indisponibilidade do inspetor
**mantêm o conteúdo indisponível** (fail-closed) — nunca "entregar em caso de
dúvida". Conteúdo reprovado **nunca** é servido, a nenhum papel, nem para
diagnóstico.

### 4. Permissão de metadado ≠ permissão de conteúdo

Ver que um documento existe e poder abri-lo são **autorizações distintas**, e
uma nunca implica a outra. A permissão de leitura de metadado não concede
leitura de conteúdo, e vice-versa. Ambas são avaliadas no servidor, por
objeto.

### 5. `empresa_id` como única fronteira de autorização, sem variante global

Todo documento pertence a **exatamente uma empresa**, e `empresa_id` é a
única fronteira de autorização deste módulo — sem variante de acesso global,
seguindo o precedente de `EscopoPessoas` (ADR 0007), onde a ausência do caso
global é garantida **pelo tipo**, não por disciplina. Como `Colaborador` não
possui `empresa_id` próprio (ADR 0007, Baseline V1 item 2), um documento
referente a colaborador carrega `empresa_id` próprio para ser escopável —
mesmo padrão de `AlocacaoOrganizacional`. Escopo nunca vem do cliente: filtro
de empresa em query é filtro, nunca concessão; pedido fora do escopo devolve
**página vazia**, e acesso a identificador fora do escopo responde **404, não
403** — porque um 403 confirmaria a existência de um documento de determinado
tipo para determinada pessoa (vazamento por inferência, O3).

### 6. `admin_tecnico` negado a metadado e conteúdo, por consequência

`admin_tecnico` é negado a **metadado e conteúdo** deste módulo. Isso é
**consequência derivada** da Baseline V1 item 8 (ADR 0007), que o negou de
forma definitiva ao dado pessoal de colaborador — documento sobre colaborador
é dado pessoal desse colaborador. **A exceção temporária de acesso global da
Emenda 1 da ADR 0005 não é ampliada**: ela foi concedida sobre estrutura
organizacional sem dado pessoal e não se estende a este domínio.

### 7. Auditoria de leitura e download, fail-safe

Diferente da maioria dos módulos — onde leitura rotineira não gera evento —
aqui **leitura de metadado e download de conteúdo são auditados**, porque
"quem viu, e quando" é o risco central. A auditoria de leitura/download é
**fail-safe**: se o evento não puder ser gravado, **a leitura não é
respondida**. Toda escrita de trilha ocorre pelo ponto único
`AuditService.record()` (ADR 0004 §2); mutações que exigem auditoria
persistem mudança e evento na mesma transação. Nenhuma escrita direta em
`audit_event`; runtime segue sem `UPDATE`/`DELETE` nessa tabela (ADR 0002).

### 8. Proibição de exclusão física e de sobrescrita de versão inspecionada

Não há exclusão física de metadado, versão ou solicitação, e não há rota
`DELETE` em nenhum recurso deste módulo — "remover" é sempre exclusão lógica,
coerente com a imutabilidade já aceita para vida funcional (ADR 0007, d. 7) e
auditoria (ADR 0004, d. 3). Substituir um documento cria **versão nova**;
nunca sobrescreve nem apaga a anterior. Versão inspecionada é imutável.

### 9. Nunca URL pública, nunca endereço de armazenamento em resposta

Nenhum objeto é publicamente legível, em nenhuma hipótese, nem
"temporariamente" nem "só em homologação". Nenhuma rota devolve
`referencia_conteudo`, caminho, _bucket_, chave ou qualquer endereço de
armazenamento, em nenhuma resposta e para nenhum papel. Se um mecanismo de
acesso temporário for adotado no futuro, é decisão de arquitetura própria
(pendente), com prazo mínimo, escopo mínimo e **auditoria da emissão** — e
continua proibido devolver endereço bruto. `AllExceptionsFilter` (ADR 0001)
não vaza detalhe interno, incluindo nome de provedor, _bucket_, chave ou
caminho.

### 10. A sensibilidade do tipo documental governa a exposição do próprio metadado

O grau de sensibilidade reside no `TipoDocumento` e governa a exposição **do
metadado**, não apenas a do conteúdo. Quando o tipo documental revelar
categoria sensível por inferência (O3), o desenho deve tratar o próprio
metadado — e o rótulo do tipo na trilha — como dado pessoal potencialmente
sensível, sujeito à mesma negação por padrão. Se o rótulo do tipo pode
aparecer na auditoria é decisão de DPO/Segurança, mantida pendente.

## O que esta ADR mantém explicitamente NÃO decidido

Nenhum dos itens abaixo é resolvido, inferido ou autorizado aqui. Todos estão
consolidados, com responsável e nível de bloqueio, na
[decisão de aprovações pendentes](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md)
(esquema `DP-2E-nn` da especificação estrutural, §14.1):

- **Se e o que materializar em banco** na V1 Estrutural (DP-2E-01) — uma
  tabela de metadado que ninguém pode usar seria o "campo especulativo" que
  ADRs anteriores rejeitaram; esta ADR **não** decide criá-la.
- **Catálogo documental e sua classificação de sensibilidade** (DP-2E-02) —
  produto **e DPO**. Esta ADR não nomeia nem enumera nenhum tipo documental.
- **Provedor e forma do armazenamento privado**; mecanismo de acesso
  temporário, se houver (DP-2E-03) — TI/Infra + Segurança.
- **Gestão da credencial de armazenamento**, sem ampliar privilégio de banco
  (DP-2E-04).
- **Limites técnicos**: tamanho máximo, formatos aceitos, metadados técnicos
  coletados (DP-2E-05).
- **Prazos** de validade/expiração de documento e de solicitação (DP-2E-06).
- **Forma do sujeito**: vínculo, colaborador ou empresa (DP-2E-07).
- **Ferramenta de antivírus/quarentena** e política para conteúdo reprovado
  (DP-2E-09).
- **Se documento vira pré-condição de efetivar admissão** (DP-2E-10) e
  **documentos obrigatórios por tipo de vínculo** (DP-2E-11) — RH/Jurídico;
  alterar isso mudaria regra de negócio da Fatia 2, não integração.
- **Se o rótulo do tipo pode aparecer na trilha** (DP-2E-12).
- **Matriz de acesso** a metadado, conteúdo, solicitação e substituição
  (DP-2E-13) e **acesso do titular** aos próprios documentos (DP-2E-14).
- **Retenção, anonimização e descarte**, alcançando o conteúdo no
  armazenamento (DP-2E-15).
- **Assinatura eletrônica** (DP-2E-17) — fora de escopo.

## O que esta ADR não pode fazer

Coerente com o §15 da especificação e com a Constituição:

- **Não declara conformidade LGPD** concluída, em nenhum grau, e não afirma
  que o upload será seguro.
- **Não amplia privilégio de banco** (ADR 0002): `evolli_migrator` e
  `evolli_app` mantêm exatamente seus privilégios. Credencial de provedor de
  storage, se vier a existir, é segredo de infraestrutura fora do banco e
  fora do repositório — nunca um privilégio novo de papel de banco.
- **Não amplia a exceção de `admin_tecnico`** da ADR 0005, Emenda 1.
- **Não altera regra de negócio da Fatia 2** (ADR 0007): a efetivação de
  movimentação não passa a depender de documento.
- **Não introduz dado pessoal** além do já aprovado pela Baseline V1 da
  Fatia 2, e **não reintroduz dado restrito** (salarial etc.) por via de um
  "documento de categoria salarial".
- **Não autoriza** upload, download, storage, bucket, credencial, migration,
  endpoint, dependência ou infraestrutura.

## Alternativas descartadas

| Alternativa                                                                        | Por que foi descartada                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guardar conteúdo (bytes/base64/large object) no PostgreSQL junto do metadado       | Contraria a `ARCHITECTURE.md` ("metadados no PostgreSQL", conteúdo em armazenamento privado) e o Princípio III da Constituição ("stored outside source control"). Colapsar metadado e conteúdo obriga toda leitura de metadado a "lembrar" de não trazer o conteúdo — origem clássica de vazamento. Descartado em favor da segregação estrutural (decisão 1). |
| Desabilitar upload por _feature flag_ / variável de ambiente                       | Invertível em runtime, sem revisão e sem rastro no código. Descartado em favor de estado sem transição de saída (decisão 2), que exige código, migration e PR para ser revertido — auditável.                                                                                                                                                                 |
| Quarentena "fail-open" (liberar conteúdo se o inspetor estiver indisponível)       | "Só desta vez, o antivírus está fora" é como fail-open nasce. Descartado; fail-closed (decisão 3) é inegociável.                                                                                                                                                                                                                                              |
| Permissão única cobrindo metadado e conteúdo                                       | Trataria "ver que existe" e "abrir" como a mesma decisão, ampliando exposição por inferência (O3). Descartado em favor de permissões distintas (decisão 4).                                                                                                                                                                                                   |
| Responder 403 para recurso fora do escopo                                          | Um 403 confirmaria a existência de um documento de determinado tipo para determinada pessoa — vazamento por inferência sem entregar um byte. Descartado em favor de 404 anti-enumeração (decisão 5), coerente com o padrão já usado nas Fatias 1 e 2.                                                                                                         |
| Estender a `admin_tecnico` (ou a exceção da ADR 0005) acesso a documentos          | Documento sobre colaborador é dado pessoal; a Baseline V1 item 8 já o nega de forma definitiva. Descartado; a negação se estende por consequência, não por decisão nova (decisão 6).                                                                                                                                                                          |
| Não auditar leitura/download, para a trilha não virar log de tráfego               | Aqui a leitura **é** o risco; "quem viu, e quando" é a questão central. Descartado; leitura e download são auditados e fail-safe (decisão 7).                                                                                                                                                                                                                 |
| Permitir exclusão física ou sobrescrita de versão para "corrigir"                  | Destruiria a resposta a "o que foi entregue em tal data" e a imutabilidade já aceita no repositório. Descartado; exclusão é sempre lógica, versão nova nunca sobrescreve (decisão 8).                                                                                                                                                                         |
| Devolver URL/endereço de armazenamento (mesmo temporário) ao cliente               | Armazenamento de objetos torna público por descuido de configuração com facilidade; devolver endereço amplia a superfície. Descartado; nunca URL pública, nunca endereço em resposta (decisão 9).                                                                                                                                                             |
| Tratar a classificação de sensibilidade só do conteúdo, deixando metadado "aberto" | "Sem conteúdo, sem problema" é o erro central que O3 refuta. Descartado; a sensibilidade do tipo governa a exposição do próprio metadado (decisão 10).                                                                                                                                                                                                        |
| Nomear/enumerar tipos documentais nesta ADR para "adiantar" o catálogo             | Catalogar tipos é decidir o que o sistema revela por inferência — decisão de produto + DPO, não de arquitetura. Descartado; catálogo permanece pendente (DP-2E-02).                                                                                                                                                                                           |
| Materializar já a tabela de metadado ("V1 estrutural" mínima)                      | Tabela que ninguém pode usar é o "campo especulativo" rejeitado nas ADRs 0003, 0006. Descartado; DP-2E-01 é decisão de produto ainda não tomada.                                                                                                                                                                                                              |

## Consequências

_(Histórico — pré-promoção; ver a Nota de convergência no topo. Os itens
abaixo descrevem as consequências projetadas quando a ADR ainda era Proposta.
Hoje: ADR **Aceito**, **T008 de metadados integrada** em `main` (PR #20,
`cdf4a71`) — as tabelas de metadado e o código do módulo existem. **Upload,
download e conteúdo (Nível 2) seguem bloqueados**, e a linha sobre MFA abaixo
permanece integralmente vigente.)_

- A especificação estrutural
  ([docs/modules/etapa2-documentos-admissao-digital-estrutural.md](../modules/etapa2-documentos-admissao-digital-estrutural.md))
  ganha a ADR que seu §15 previa, em status **Proposta**. As dez decisões de
  arquitetura passam de "proposta descrita" para "decisão registrada, sujeita
  à promoção", **sem** que nenhuma delas autorize código, tabela ou upload.
- **A pendência DP-24 da Fatia 2** (slot `AnexoMovimentacao`) passa a ter
  destino arquitetural definido, mas **não é resolvida**: a associação
  continua inútil na prática enquanto o upload estiver desabilitado, porque
  não haverá documento disponível para associar.
- **A tarefa T008** (implementar publicação e acesso a documentos) passa a
  ter arquitetura de segurança e fronteiras fixadas para revisão. T008
  **não** pode iniciar sem, no mínimo, os portões de Nível 1 satisfeitos e
  esta ADR promovida a `aceito` — ver a
  [decisão de aprovações pendentes](../decisions/etapa2-documentos-admissao-aprovacoes-pendentes.md).
- **Nenhuma tabela, migration, endpoint, dependência, bucket, credencial ou
  linha de código é criada, alterada ou comprometida por esta ADR.**
- **MFA** (ADR 0003, decisão 3) permanece obrigatório antes de dado real e é
  **agravado** por este módulo: documento é o dado de maior impacto do
  ecossistema até aqui. Esta ADR não relaxa esse gate — ele o torna mais
  relevante.

## Controles de segurança

- **Menor privilégio inalterado:** nenhum papel ganha acesso a documento por
  esta ADR; a matriz de acesso permanece pendente e nasce negada.
- **Conteúdo fora do banco e fora do repositório**, sempre; nenhuma coluna de
  bytes.
- **Metadado tratado como dado pessoal** desde o desenho (O3): a
  sensibilidade do tipo governa a exposição do próprio metadado.
- **Anti-enumeração:** 404, não 403, para recurso fora do escopo; listagem
  fora do escopo devolve página vazia.
- **Quarentena fail-closed:** `aprovado` é a única porta para conteúdo;
  inspetor indisponível mantém indisponível.
- **Auditoria de leitura/download fail-safe:** sem evento gravável, sem
  resposta; escrita só por `AuditService.record()`.
- **Sem endereço de armazenamento em resposta ou log**, nem nome de arquivo
  original, trecho, hash de trecho ou texto extraído.
- **Sem ampliação de superfície de banco ou de CORS**; nenhuma credencial de
  storage no repositório.

## Itens fora de escopo desta ADR

- **Código, tabela, migration, endpoint, DTO, guard, bucket, credencial,
  dependência, upload, download ou infraestrutura** — nada disso é criado ou
  autorizado.
- **Escolha de provedor** de storage, antivírus, cloud, CDN ou ferramenta de
  criptografia — decisão operacional formal, pendente (DP-2E-03, DP-2E-09).
- **Catálogo documental, matriz de acesso, retenção/descarte, limites
  técnicos, expiração, assinatura eletrônica** — todos pendentes.
- **Portal do Colaborador** e acesso do titular — não existem (DP-2E-14).
- **Conformidade LGPD, RIPD/DPIA** — avaliação de DPO/Jurídico, não declarada
  aqui.

## Gatilhos de reavaliação

Esta ADR deve ser reaberta — com emenda ou promoção formal — quando
**qualquer** um destes ocorrer:

1. **Portões de Nível 1** (spec §13.1) satisfeitos: decisão de produto sobre
   materialização (DP-2E-01), catálogo + classificação por produto e DPO
   (DP-2E-02), matriz de acesso a metadado (DP-2E-13), confirmação de DPO de
   finalidade/base legal do metadado, e revisão de segurança do modelo →
   promover status para **Aceito**.
2. **Portões de Nível 2** (spec §13.2) satisfeitos: armazenamento privado
   provisionado, quarentena/antimalware operantes, retenção/descarte
   aprovados alcançando o conteúdo, auditoria de leitura/download
   implementada e fail-safe, MFA obrigatório, testes verdes e revisão humana
   de segurança do fluxo de upload → autoriza habilitar upload de documento
   real (fora do escopo desta ADR).
3. Qualquer decisão `DP-2E-nn` resolvida pelo produto/DPO/Segurança/TI —
   pode gerar emenda a esta ADR conforme o escopo.

## Responsabilidades

- **Produto:** resolver DP-2E-01, DP-2E-02 (com DPO), DP-2E-05, DP-2E-06,
  DP-2E-07, DP-2E-10, DP-2E-13, DP-2E-14 conforme a necessidade surgir.
- **DPO/Jurídico:** confirmar finalidade e base legal do tratamento de
  metadado (incluindo o risco de inferência, O3) antes do Nível 1; e de
  conteúdo, retenção, descarte e RIPD/DPIA antes do Nível 2.
- **Segurança:** revisar o modelo contra as decisões 1–10 antes da promoção;
  confirmar fail-closed, fail-safe e anti-enumeração na implementação futura.
- **TI/Infraestrutura:** definir provedor e forma do armazenamento privado,
  gestão de credencial sem ampliar privilégio de banco, e antivírus/quarentena
  (DP-2E-03, DP-2E-04, DP-2E-09) quando a fase Implementar for autorizada.
- **Revisor de PR (quando houver código futuro):** bloquear merge que
  introduza bytes de conteúdo em banco, _feature flag_ de upload, quarentena
  fail-open, permissão única para metadado+conteúdo, 403 no lugar de 404,
  rota `DELETE`, endereço de armazenamento em resposta, ou acesso de papel
  sem autorização correspondente aprovada.

## Limitações

- Esta ADR autoriza somente a T008 de metadados aprovada; não autoriza
  conteúdo, upload, download de conteúdo, bucket, credencial, infraestrutura
  ou processamento de documentos reais.
- Não declara conformidade LGPD nem prontidão para dado real.
- Os itens de Nível 2 permanecem pendentes; novo tipo documental ou alteração
  de acesso exige registro e aprovação conforme esta ADR.
- Não estende nem relaxa MFA (ADR 0003) ou o modelo de auditoria (ADR 0004) —
  ambos permanecem integralmente aplicáveis e, no caso do MFA, agravados.

---

## Nota de convergência (ADR 0012, 2026-08-20)

**Esta nota não altera nem apaga o texto acima; adiciona uma camada de
convergência.** A [ADR 0012](0012-convergencia-governanca-privacidade-e-perfis-globais.md)
formaliza:

- A **"aprovação do DPO"** exigida para criar/alterar o catálogo de tipos
  documentais é a aprovação da **função responsável: RH + Jurídico** — não de um
  usuário com papel `dpo` provisionado (que não existe; DP-7 pendente). O
  mecanismo atual (registrar a **referência de aprovação** + data como
  pré-condição) permanece válido; muda apenas o **responsável nomeado**.
- Os campos hoje rotulados como aprovação de DPO
  (`dpo_aprovacao_referencia`/`dpo_aprovado_em`) serão renomeados para
  **nomenclatura neutra** por **migração expand/contract futura**, com
  preservação integral do histórico — **não agora** (ADR 0012 decisão 5). O
  código/schema de Documentos permanece **congelado** até então.
- As confirmações de finalidade, base legal, RIPD/DPIA e retenção continuam
  **pendentes** e são responsabilidade de **RH + Jurídico** — esta nota não
  declara conformidade.
