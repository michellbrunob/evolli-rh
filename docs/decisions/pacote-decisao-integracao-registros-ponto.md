# Pacote de decisão — Integração de registros de ponto (recebimento de marcações do sistema atual)

- Status: **Pendente — nenhum item aprovado.** Este é um **formulário de
  decisão** para os responsáveis de **Produto**, **TI**, **RH**,
  **Jurídico/DPO** e, onde citado, o **fornecedor do equipamento (RWTech)**.
  O documento **estrutura** as escolhas em campos objetivos. Ele **não
  decide, não infere e não escolhe** chave de idempotência, mecanismo de
  autenticação, canal de transporte ou prazo. Onde um valor específico é
  necessário, ele aparece como **campo a preencher**, nunca como valor
  sugerido.
- Data de emissão: 2026-10-06 (T148).
- Fase/tarefa: **T148** — Convergência da T147 e fundação segura da
  integração de registros de ponto. Produzido porque a regra da própria
  tarefa exige implementação **somente se** os contratos existentes
  definirem, sem invenção, origem, formato, autenticação, idempotência,
  relação com empresa/colaborador/vínculo, duplicatas, preservação da
  marcação original, auditoria e resposta a erro — e, como este documento
  demonstra, **nem todos esses itens estão definidos**.
- Relação com o registro de pendências: este pacote **não cria** pendências
  novas. Ele reúne, sob um único formulário de decisão, as pendências já
  catalogadas em:
  - [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) — `DP-3J-07`,
    `DP-3J-08`, `DP-3J-09`, `DP-3J-10`, `DP-3J-11`, `DP-3J-12`;
  - [Contrato técnico do parser AFD](../modules/etapa3-parser-afd-contrato-tecnico-v1.md) (T040) —
    `DP-3J-20` e as pendências internas §2.2, §4.4, §4.7, §4.8, §4.9;
  - [Contrato do lote de importação AFD](../modules/etapa3-lote-importacao-afd-contrato-v1.md) (T042) — §7
    (idempotência, duplicidade, reprocessamento);
  - [Pacote de decisão de segurança operacional](pacote-decisao-seguranca-operacional.md) — `DS-OPS-01`
    (só `DS-MFA-01` está aprovada).
    Os identificadores são **reusados**, não recriados: aprovar um item aqui é
    aprovar a pendência de mesmo ID.
- Âncoras de governança (não reabertas por este pacote):
  [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) (origem única
  manual — decisão 4; reabrir exige **ADR nova ou emenda formal**, um dos
  quatro gatilhos de reavaliação é exatamente "Produto decidir avançar sobre
  importação TXT (`DP-3J-07`)"), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md)
  (auditoria append-only, ação fechada por enum), [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md)
  (MFA obrigatório antes de dado real), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico como função responsável por privacidade).
- Constituição: v1.4.0 — Princípio II (segurança/privacidade/menor privilégio),
  Princípio III (import com proveniência; arquivo como ativo protegido fora do
  controle de versão), Princípio IV (evidência; dado sintético; preservar
  marcações brutas), Princípio V (auditoria append-only, idempotência onde há
  retry).

## 0. Como usar este formulário

Cada seção (§1–§6) apresenta uma **decisão a tomar**, as **opções elegíveis**
e, quando aplicável, uma **recomendação técnica — claramente marcada como não
aprovada**. §7 lista as perguntas que só o fornecedor (RWTech) ou RH/TI
conseguem responder. §8 traz um contrato mínimo de exemplo, sem dado real.
Nenhuma decisão deste documento é efetivada por si só: cada uma exige registro
formal (ADR nova, emenda ou aprovação datada) antes de autorizar código.

## 1. Por que este pacote existe, e não uma implementação

A investigação da T148 confirma, com evidência em código e documento, que a
fundação atual **não permite** receber marcações de fora sem inventar pelo
menos quatro coisas que os próprios contratos proíbem inferir:

1. **Não há chave de idempotência.** O único `@@unique` de `evento_ponto` é
   `(id, empresaId)` sobre um UUID gerado pelo servidor — não serve para
   deduplicar uma marcação que chega de fora. Dois envios idênticos criam duas
   linhas. O contrato do parser (T040 §4.9) e o do lote (T042 §7) tratam a
   chave natural (`empresa + hash_arquivo + nsr`, ou `empresa + identificador +
momento`) como pendência e **proíbem explicitamente** que uma implementação
   a infira.
2. **`UPDATE`/`DELETE` em `evento_ponto` estão revogados no banco** (migration
   `20260810120000_jornada_ponto_rastreavel`, `REVOKE UPDATE, DELETE ON TABLE
"evento_ponto" FROM evolli_app`). Isso é uma força a favor da T148 — a
   marcação original é imutável por construção —, mas também significa que
   **não existe `ON CONFLICT DO UPDATE`** como saída de engenharia para a
   lacuna acima. Sem a chave decidida, não há como inserir com segurança.
3. **Não existe ator não humano.** `evento_ponto.registrado_por_user_id` é
   `NOT NULL` com FK para `AccessUser`. O enum `AuditActorType` já tem o valor
   `system`, mas nenhuma rota HTTP o produz — os três usos existentes são
   internos (login, reset de senha, rate limit). Autenticar um sistema externo
   exigiria um mecanismo (API key, HMAC de webhook, mTLS, client credentials)
   que **não existe em nenhuma rota do produto**: hoje a única porta de
   entrada autenticada é o cookie de sessão humana, e o `CsrfGuard` exige
   `request.authSession` — um integrador sem sessão não consegue sequer obter
   o token CSRF.
4. **A origem automatizada é proibida pela ADR 0008, decisão 4**, de forma
   nominal: "Nenhuma outra origem — importação TXT, biometria, foto,
   geolocalização, IP como evidência, dispositivo, integração externa — é
   aprovada nesta V1." Reabrir isso exige **ADR nova ou emenda formal** — não
   é consequência automática de nenhuma decisão já tomada.

A regra da própria T148 — "se qualquer item essencial estiver em aberto, não
crie endpoint, schema ou regra provisória" — fecha o caminho de implementação
com os quatro pontos acima isoladamente, antes mesmo de qualquer escolha de
canal.

## 2. Decisão — formato e origem (`DP-3J-07`, `DP-3J-20`)

**O que já está confirmado, e não é reaberto aqui:**

- Equipamento: **RWTech BLUE BIOPROX-C**, classificado como REP-C (T039).
- Extração hoje: **manual**, pelo RH, exportando do **Secullum** (o software
  de gestão de ponto — não o relógio). Não há, nem está prevista, automação
  dessa extração.
- Formato de transporte confirmado: **arquivo TXT em leiaute AFD**, versão
  "004" do anexo oficial do MTE, referenciado pela Portaria MTP nº 671/2021
  (consulta em 2026-08-27). O contrato técnico do parser (T040) já transcreve
  campo a campo os registros tipo `1` (cabeçalho), `3` (marcação REP-C) e `9`
  (trailer), e o núcleo (T041) existe em TypeScript puro — mas não está ligado
  a controller, módulo ou rota alguma.

**O que falta decidir:**

| Campo                         | Opções elegíveis                                                                                                                                                                                                       | Recomendação técnica (não aprovada)                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homologação do leiaute        | (a) Aceitar o leiaute oficial T040 como suficiente; (b) Exigir homologação campo a campo do fornecedor RWTech contra amostra sintética, incluindo a variante exata do CRC-16 do REP-C, antes de qualquer implementação | (b) — o próprio contrato T040 exige isso e proíbe a implementação sem ela                                                                                            |
| Normalização do identificador | (a) Aceitar o campo de 12 posições como está (sem casar com cadastro); (b) Definir a regra de normalização 12→11 dígitos e o que fazer com o dígito adicional                                                          | Nenhuma — depende de confirmação do fornecedor sobre o formato exato do campo                                                                                        |
| Reconsulta da fonte oficial   | —                                                                                                                                                                                                                      | **Obrigatória antes de qualquer implementação futura**: o próprio contrato T040 exige reconsultar a página do MTE e confirmar que a versão do leiaute continua "004" |

## 3. Decisão — identidade e credencial de ator não humano

Esta é a lacuna mais grave encontrada: **o assunto nunca foi aberto em nenhum
documento**. Não há identificador de pendência prévio porque a pergunta nunca
foi formulada.

| Campo                                            | Opções elegíveis                                                                                                                                                                                                                                                     | Recomendação técnica (não aprovada)                                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecanismo de autenticação                        | (a) Nenhum — mantém só o RH humano operando por sessão; (b) API key de serviço por empresa; (c) client credentials (OAuth2); (d) HMAC de webhook com segredo por integração; (e) mTLS                                                                                | Nenhuma — depende de qual canal for escolhido (§5) e de quem emite/gira o segredo                                                                                                      |
| Representação do ator no schema                  | (a) Manter `registradoPorUserId` obrigatório e criar uma conta de serviço (`AccessUser` sintético) para o sistema; (b) Tornar o campo opcional e usar `actorType: system` + `actorSystemId`, que já existe no enum de auditoria mas nunca foi usado por nenhuma rota | Nenhuma — (a) preserva a garantia atual de "toda marcação tem um humano por trás"; (b) é o caminho mais limpo para um ator técnico, mas exige decidir o que `actorSystemId` referencia |
| Ação de auditoria para ingestão                  | A lista de `AuditAction` é fechada por design ("Estender exige migration — nunca aceitar ação como texto livre"). Qualquer ingestão externa exige pelo menos uma ação nova (ex.: `ponto.lote.recebido`)                                                              | —                                                                                                                                                                                      |
| Derivação de `empresaId` para um ator sem sessão | (a) Da credencial (cada chave pertence a uma empresa); (b) De um cabeçalho explícito assinado; (c) Do conteúdo do arquivo (CNPJ no AFD)                                                                                                                              | (a) é a única que preserva a regra já escrita no código — "`empresaId` nunca vem do corpo ou da query" — sem reabri-la                                                                 |

## 4. Decisão — chave de idempotência e duplicidade

Transcrição literal do contrato do lote (T042 §7), ainda válida:

> "Chave natural da marcação efetiva (ex.: `empresa + hash_arquivo + nsr`, ou
> `empresa + identificador + momento`) — pendente. Sem ela decidida, o lote
> não grava marcação."

| Campo                                         | Opções elegíveis                                                                                               | Recomendação técnica (não aprovada)                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chave natural                                 | (a) `empresa + hash_arquivo + nsr`; (b) `empresa + identificador + momento`; (c) outra, a definir              | Nenhuma — a escolha tem efeito direto sobre o que conta como "a mesma marcação" e precisa ser decidida por quem entende o comportamento real do REP (ex.: o NSR reinicia? pode repetir entre relógios?) |
| Reimportação do mesmo arquivo (mesmo hash)    | (a) Recusar o lote inteiro; (b) Reconciliar silenciosamente; (c) Vincular ao lote anterior e expor o vínculo   | Nenhuma — pendência explícita do T042 §7                                                                                                                                                                |
| Reprocessamento de um lote                    | (a) Permitido, reaproveitando o mesmo lote; (b) Permitido, sempre como lote novo; (c) Não permitido            | Nenhuma                                                                                                                                                                                                 |
| Duplicidade entre lotes (janelas sobrepostas) | (a) Detectar e rejeitar; (b) Detectar e marcar como pendência para triagem do RH; (c) Não detectar nesta fatia | Nenhuma — "não há regra presumida" (T042 §7)                                                                                                                                                            |

## 5. Decisão — canal de transporte

Comparação objetiva, **sem presumir capacidade do fornecedor** (nenhuma API,
webhook ou exportação programada do Secullum está documentada ou confirmada
no repositório):

| Canal                                                        | O que exigiria do Evolli                                                                                            | O que exigiria do Secullum/RWTech                                                                                                | Estado de prontidão hoje                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Importação de arquivo** (upload manual do AFD pelo RH)     | Endpoint de upload, parser já existe (T041), modelo de lote (inexistente)                                           | Nada — é o fluxo já confirmado pela T039                                                                                         | Mais próximo: parser pronto, mas lote/persistência/idempotência pendentes |
| **Polling/REST** (Evolli consulta um endpoint do fornecedor) | Cliente HTTP de saída (inexistente em `apps/api`), credencial, agendamento (`@nestjs/schedule` não está no projeto) | Um endpoint de consulta do fornecedor — **não documentado, não confirmado**                                                      | Não iniciado: exige primeiro confirmar que o fornecedor oferece essa API  |
| **Webhook HTTP** (fornecedor envia ao Evolli)                | Endpoint de entrada autenticado (mecanismo indefinido, §3), validação de assinatura, idempotência                   | O fornecedor precisaria oferecer webhook — **a palavra não aparece uma única vez no repositório fora do enunciado desta tarefa** | Não iniciado: nenhuma evidência de que o fornecedor suporta isso          |
| **WebSocket**                                                | Gateway (`@nestjs/websockets`, inexistente), conexão persistente, reconexão                                         | Servidor WebSocket do lado do fornecedor — **sem qualquer evidência**                                                            | Não iniciado, e **não recomendado para este fluxo**: ver análise abaixo   |

**Análise que orienta — sem decidir — a escolha:** registro de ponto é
histórico e durável por natureza (é prova de jornada trabalhada), não uma
atualização de tela em tempo real. Esse tipo de dado pede entrega idempotente
e reprocessável, que é exatamente o que falta nos quatro canais acima — a
lacuna não é do canal, é da chave de idempotência (§4) e da autenticação
(§3), comuns a qualquer um deles. **WebSocket resolve atualização de UI em
tempo real; não resolve a pergunta "este registro já foi recebido antes?"**,
que é o problema central aqui. Isso é leitura do fluxo, não recomendação de
canal — a escolha entre importação de arquivo, polling e webhook depende de
qual desses o Secullum efetivamente oferece, informação que só o fornecedor
tem.

## 6. Decisão — gates que bloqueiam qualquer dado real, independente do canal

Nenhuma escolha acima habilita dado real por si só. Seguem bloqueando,
inalterados por este pacote:

| Gate                                                                                            | Dono                                  | Estado                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `DP-3J-09` — validade legal do controle de jornada                                              | Jurídico                              | Pendente                                                                          |
| `DP-3J-11` — retenção, descarte e acesso do titular (inclui o arquivo AFD como ativo protegido) | RH + Jurídico                         | Pendente                                                                          |
| `DP-3J-10` — biometria, geolocalização, dispositivo                                             | Produto + Jurídico + DPO              | Pendente (qualquer origem automatizada reabre este vetor)                         |
| `DP-3J-20` — homologação campo a campo do fornecedor, enquadramento jurídico do REP             | RWTech + Jurídico + TI                | Parcialmente avançada (formato confirmado); homologação e enquadramento pendentes |
| `DS-OPS-01` — gate-mestre de segurança operacional (cofre, backup, restauração testada)         | Diretoria + TI + Segurança + Jurídico | Pendente — só `DS-MFA-01` está aprovada                                           |
| MFA (ADR 0003, decisão 3)                                                                       | Produto + TI                          | `MFA_ENABLED=false` por padrão hoje                                               |

## 7. Perguntas que só o fornecedor ou RH/TI respondem

**Para a RWTech / quem opera o Secullum:**

1. O BLUE BIOPROX-C emite AFD exatamente no leiaute "004"? Homologação campo a
   campo contra uma amostra sintética, incluindo a variante exata do CRC-16.
2. O Secullum oferece alguma forma de exportação automática ou programável
   (API, webhook, pasta monitorada), ou a extração é sempre uma ação manual do
   RH na interface do Secullum?
3. O NSR é reiniciado em algum evento (troca de relógio, reset, nova
   competência)? Pode haver NSR repetido entre arquivos de exportações
   diferentes?
4. Qual é exatamente o conteúdo do campo "identificador" de 12 posições —
   sempre CPF? Há caso de valor não numérico ou de preenchimento diferente?

**Para RH/TI internos:**

5. Com que frequência o RH hoje extrai o arquivo do Secullum? (orienta se
   importação manual periódica já atende, sem qualquer canal automatizado)
6. Qual o volume típico de marcações por exportação, e qual a defasagem
   aceitável entre a batida física e ela aparecer no Evolli?
7. Quem, no RH, deve ter a capacidade de importar um lote — só RH, ou também
   DP? (nota: a matriz RBAC hoje concede `evento_ponto.create` a `rh` **e**
   `dp`, enquanto o contrato do lote AFD já registrado diz "RH é o único
   operador" — essa divergência de alçada precisa ser resolvida antes de
   qualquer implementação, independentemente do canal)
8. Existe, hoje, qualquer arquivo real do Secullum disponível para inspeção
   manual (nunca para ser versionado ou usado como fixture)? Serviria para
   confirmar, informalmente, que a estrutura descrita pela T039 continua
   válida.

## 8. Contrato mínimo de exemplo (sem dado ou credencial reais)

Ilustrativo, não normativo — mostra a FORMA que uma decisão completa das
seções acima produziria, não o conteúdo decidido.

```jsonc
// Exemplo ilustrativo de corpo de requisição — nenhum valor é real,
// nenhum endpoint abaixo existe hoje.
POST /v1/pontos/lotes
Authorization: <mecanismo a decidir — §3>
Content-Type: text/plain; charset=latin1

// corpo: arquivo AFD bruto, formato já confirmado (T040), limite de
// tamanho a definir
```

```jsonc
// Resposta de exemplo — shape ilustrativo, campos a confirmar junto com
// o modelo de lote (T042)
{
  "loteId": "00000000-0000-0000-0000-000000000000",
  "hashArquivo": "sha256:0000...0000",
  "estado": "recebido", // ver máquina de estados do T042 §3
  "totalLinhas": 0,
  "aceitas": 0,
  "pendencias": 0,
}
```

```jsonc
// Estados possíveis do lote (conceituais, do contrato T042 — NÃO
// comprometidos aqui como enum de banco)
"recebido" | "validando" | "rejeitado_estruturalmente"
  | "processado_com_pendencias" | "pronto_para_associacao" | "cancelado"
```

A chave de idempotência, o mecanismo de autenticação e o enum de auditoria de
importação **não aparecem** neste exemplo porque são exatamente os itens em
aberto nas seções 3 e 4 — incluí-los aqui seria inferir o que o próprio
contrato proíbe inferir.

## 9. Declaração

Este pacote **não implementa nada**: nenhum endpoint, controller, model
Prisma, migration, ação de auditoria ou regra de autenticação foi criado.
Ele organiza, sob um formulário único, as decisões que precisam ser tomadas
por Produto, TI, RH, Jurídico/DPO e pelo fornecedor RWTech antes de o Evolli
poder receber uma única marcação de um sistema externo. Nenhum item de §2–§6
está aprovado. A reabertura da ADR 0008 (decisão 4) por ADR nova ou emenda
formal é pré-requisito para qualquer implementação, independentemente da
escolha de canal.
