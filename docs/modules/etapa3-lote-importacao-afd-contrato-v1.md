# Etapa 3 — Contrato do lote de importação AFD e rastreabilidade (Ponto V1)

- Status: **Especificação — fase Registrar decisão** (T042). **Nenhuma fase
  Implementar é aberta ou autorizada por este documento.** Não há código,
  endpoint, upload, banco, migration, Prisma, UI, associação, cálculo,
  integração ou dado real aqui — apenas o **contrato** do futuro lote de
  importação, entre o **parser puro já implementado (T041)** e a **futura
  gravação de marcações**.
- Data: 2026-08-27 (T042).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T042** (especificação do lote de
  importação AFD e rastreabilidade).
- Base factual (não reaberta):
  [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md) (§5 fila
  "Verificar folhas", §6 importação TXT/AFD, evidência T039),
  [Contrato técnico do parser AFD](etapa3-parser-afd-contrato-tecnico-v1.md)
  (T040 + fundação do núcleo T041),
  [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md) (Baseline V1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA,
  sessão), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria
  append-only via `AuditService.record()`, sem valor sensível em claro),
  [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresa_id`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico como função responsável por privacidade; `master_tecnico` sem
  mutação sensível de negócio),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (MFA/segredos/backup — gates de dado real, `DS-OPS-01`).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  MFA antes de dado real), Princípio III (import com proveniência; arquivo como
  ativo protegido fora do controle de versão), Princípio IV (evidência; dado
  sintético; preservar marcações brutas), Princípio V (auditoria append-only,
  segregação de funções, idempotência onde há retry).

## 0. Natureza e limites deste documento

Este documento **especifica o contrato** do **lote de importação AFD** — a
unidade de trabalho que, no futuro, receberá um arquivo AFD/TXT extraído
manualmente pelo RH, o submeterá ao **parser puro (T041)** e conduzirá o
resultado até o ponto de **handoff** para a etapa (futura) de associação ao
colaborador. Ele fica **entre** duas coisas que **não** são seu escopo: o
parser (já implementado, puro, em memória) e a **gravação de marcações no
banco** (não especificada aqui).

**Invariável neste documento:**

- **Não implementa nada:** sem endpoint, upload, controller, serviço, schema,
  migration, Prisma, job, UI, dependência ou configuração.
- **Não associa nem calcula:** não casa CPF com colaborador, não apura jornada,
  banco de horas, DSR, fechamento, espelho ou assinatura — tudo isso permanece
  em [detalhada §2, §3, §8](etapa3-jornada-ponto-v1-detalhada.md) e fora daqui.
- **Não usa dado real:** nenhum valor real (CPF, nome, batida, número de
  fabricação, CNPJ do empregador) é citado, copiado ou simulado. Onde houver
  exemplo, é **estrutural e sintético**.
- **Não decide** retenção, criptografia, storage, descarte, base legal ou
  assinatura — todos permanecem **gates abertos** (§9). Este documento **não
  antecipa nem simula** essas decisões.
- **Não declara conformidade** legal, trabalhista ou LGPD — inclusive quanto à
  **Portaria MTP 671**.

Os nomes de estado, evento e campo abaixo são **conceituais** (sujeitos à
modelagem real); não comprometem schema, enum de banco, rota ou contrato de API.

## 1. Finalidade e fronteiras

### 1.1 Finalidade

Definir como um **lote de importação AFD** nasce, é validado e chega a um estado
de **handoff rastreável**, preservando proveniência e sem adulterar a marcação
de origem — a unidade que dá **rastreabilidade** (Constituição, Princípio III) à
entrada de ponto do V1.

### 1.2 Fronteiras (o que é e o que não é)

- **Importação manual pelo RH.** O RH extrai o arquivo AFD/TXT **manualmente**
  do Secullum (T039) e o fornece ao Evolli. **Não há** integração por API, rede
  ou comunicação direta com o Secullum ou com o relógio no V1 — o Evolli apenas
  **lê** o arquivo fornecido.
- **Por empresa.** Todo lote pertence a **uma** empresa (`empresa_id`, via
  `VinculoFuncional`/ADR 0006–0007). Não há lote cross-company nem global de
  negócio (§6).
- **A fonte fornece apenas marcações brutas.** Empresa, colaborador e horário
  permanecem **cadastrados no Evolli** (detalhada §0); a importação **nunca**
  cria ou altera esses cadastros.
- **O lote não é o parser nem o banco.** O parser (T041) é função pura em
  memória; a gravação de marcações é etapa futura. O lote é o **envelope de
  proveniência e estado** que liga um ao outro.

## 2. Cinco camadas separadas (fronteiras rígidas)

O contrato **separa** cinco responsabilidades que **não** podem se confundir.
Cada seta é um **handoff explícito**, nunca um atalho.

| #   | Camada                                | Responsabilidade                                                                           | Escopo                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | **Integridade do arquivo**            | O arquivo é um AFD íntegro? (codificação, terminação, cabeçalho/trailer, ordem, contagens) | Parser T041 (§4.1–§4.8 do T040)     |
| 2   | **Resultados do parser**              | Marcações aceitas (em memória) + pendências por linha + erro estrutural fatal              | Parser T041 → **este lote**         |
| 3   | **Associação por CPF ao colaborador** | Casar o identificador bruto (CPF) com um colaborador cadastrado, **por empresa**           | **Futuro** (fora deste doc)         |
| 4   | **Marcações persistidas**             | Gravar marcação bruta + proveniência no banco, sem duplicar                                | **Futuro** (fora deste doc)         |
| 5   | **Apuração trabalhista**              | Tolerância, banco de horas, DSR, fechamento, espelho, assinatura                           | **Futuro/gated** (detalhada §2, §8) |

- **Este documento cobre a camada 1→2** (integridade + resultados do parser) e o
  **envelope de lote** que os carrega até o **handoff** para a camada 3.
- As camadas **3, 4 e 5 são explicitamente fora de escopo** e permanecem
  **gated** (§9). O lote **prepara** o handoff; **não** executa associação,
  persistência nem apuração.
- **Nenhuma camada confia na anterior sem o handoff explícito:** a apuração
  (5) nunca lê um lote que não chegou a um estado de handoff válido (§3); a
  associação (3) nunca ocorre sobre um lote rejeitado estruturalmente (§4).

## 3. Máquina de estados do lote

Os estados abaixo partem da sugestão da tarefa; foram mantidos os seis, com as
transições e terminais explícitos. Nomes **conceituais**.

| Estado                      | Significado                                                                                          | Terminal?                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| `recebido`                  | Lote criado pelo RH com o arquivo em mãos; ainda não validado.                                       | Não                              |
| `validando`                 | Parser (T041) em execução: validação estrutural do arquivo.                                          | Não                              |
| `rejeitado_estruturalmente` | Erro estrutural fatal (fail-closed, §4): **nenhuma** marcação aceita.                                | **Sim**                          |
| `processado_com_pendencias` | Arquivo estruturalmente válido; há marcações aceitas **e** ≥1 pendência por linha (§4).              | **Sim (do ciclo de importação)** |
| `pronto_para_associacao`    | Arquivo estruturalmente válido; marcações aceitas **sem** pendências. Handoff limpo para a camada 3. | **Sim (do ciclo de importação)** |
| `cancelado`                 | RH abortou o lote antes de um estado de handoff.                                                     | **Sim**                          |

### 3.1 Transições permitidas

```text
recebido ──▶ validando
recebido ──▶ cancelado
validando ──▶ rejeitado_estruturalmente     (erro estrutural fatal, §4)
validando ──▶ processado_com_pendencias      (válido + pendências por marcação)
validando ──▶ pronto_para_associacao         (válido, zero pendências)
validando ──▶ cancelado                      (aborto do RH durante a validação)

rejeitado_estruturalmente ──▶ (nenhuma)      terminal
cancelado                 ──▶ (nenhuma)      terminal
```

### 3.2 Regras da máquina de estados

- **`validando` é transitório e determinístico:** produz exatamente um dos três
  desfechos (`rejeitado_estruturalmente`, `processado_com_pendencias`,
  `pronto_para_associacao`), espelhando o resultado do parser (T041): `status:
"rejeitado"` → rejeição; `status: "processado"` com pendências → pendências;
  `status: "processado"` sem pendências → pronto.
- **Terminais de rejeição/cancelamento** (`rejeitado_estruturalmente`,
  `cancelado`) **não** têm saída — correção é **novo lote**, nunca mutação do
  estado terminal (mesmo princípio de imutabilidade da ADR 0004, decisão 3).
- **`processado_com_pendencias` e `pronto_para_associacao` encerram o ciclo de
  importação** (handoff). O que acontece **depois** — se um lote com pendências
  pode avançar para associação após triagem do RH na fila "Verificar folhas"
  (detalhada §5), e como pendências são resolvidas — é **pendência de decisão**
  (§7), **não** definida aqui e **não** inferida.
- **Toda transição é auditável** (§5, §6): ator, empresa, lote, estado de/para,
  resultado — sem dado pessoal.

## 4. Política fail-closed e rejeição parcial

O lote herda, sem alterar, a distinção já fixada no contrato do parser (T040 §5,
§7) e reafirmada pela decisão do RH (T035 — rejeição **por marcação**).

### 4.1 Fail-closed (rejeita o lote inteiro)

Quando o parser retorna `status: "rejeitado"` (erro estrutural fatal — arquivo
vazio, codificação incompatível, terminação inválida, linha em branco,
cabeçalho/trailer ausente/inválido, versão não suportada, tipo de registro
desconhecido, NSR inválido/fora de ordem/duplicado, contagem do trailer
divergente), o lote vai para **`rejeitado_estruturalmente`**:

- **Nenhuma** marcação é aceita; **nenhuma** é entregue à camada 3/4.
- O lote registra **apenas** o **código seguro** do erro e o endereçamento
  técnico (posição de linha / NSR técnico), nunca conteúdo (§5).
- Correção é **reenvio como novo lote** (arquivo corrigido na origem) — o lote
  rejeitado permanece como evidência imutável.

### 4.2 Rejeição parcial (mantém o lote com pendências)

Quando o arquivo é **estruturalmente válido** mas uma **marcação individual**
(tipo 3) é inválida (tamanho, data/hora ou identificador), o parser emite
**pendência por linha** e **preserva o restante do lote** (T035):

- As marcações válidas seguem para o handoff; as inválidas viram **pendência
  técnica**, expostas na fila **"Verificar folhas"** (detalhada §5) por
  endereçamento técnico, **sem** expor CPF/horário (§5).
- O lote vai para **`processado_com_pendencias`**.
- **Nada é descartado em silêncio:** toda pendência é apontada e auditável (§6).
  A resolução é **ação humana do RH** pelos fluxos próprios; o lote apenas
  **sinaliza**.

### 4.3 Fronteira inviolável

**Erro estrutural nunca vira rejeição parcial**, e **rejeição parcial nunca
promove um arquivo estruturalmente inválido**. A escolha entre §4.1 e §4.2 é
**determinada pelo parser**, não por configuração do lote.

## 5. Dados mínimos e proibições

### 5.1 O que o lote registra (metadados mínimos, sem dado pessoal)

- **Identificadores técnicos:** id do lote (técnico), `empresa_id`, ator
  (papel/id técnico), estado atual e histórico de transições.
- **Proveniência do arquivo:** **hash** do arquivo (impressão digital técnica),
  versão de leiaute observada (`004`), momento da importação, nome/origem
  lógica do lote — **sem** conteúdo do arquivo.
- **Contadores:** total de linhas, marcações aceitas, marcações rejeitadas,
  contagens por tipo de registro conferidas contra o trailer.
- **Endereçamento de pendência/erro:** **código seguro** + **posição de linha**
  e/ou **NSR técnico** — e nada além disso.

### 5.2 Proibições absolutas (herdadas de ADR 0004 e do contrato T040 §8)

- **Nenhum conteúdo bruto do AFD em log** — nem linha, nem campo, nem trecho.
- **Nenhum CPF, nome, horário/data-hora bruta ou linha completa** em auditoria,
  mensagem de erro, pendência ou log técnico. O endereçamento é **técnico**
  (hash, id de lote, posição de linha, NSR, contadores).
- **Auditoria append-only** e escrita exclusiva via `AuditService.record()`
  (ADR 0004, decisões 1–2): correção é evento complementar, nunca edição.
- **Não decidir nem simular** retenção, criptografia, storage privado ou
  descarte do arquivo enquanto `DP-3J-11` e os gates correspondentes (§9)
  estiverem abertos. O arquivo é **ativo protegido** (Constituição, Princípio
  III); **onde** e **por quanto tempo** ele vive é decisão futura de RH +
  Jurídico + TI, **fora deste documento**. Este contrato **não** presume
  storage, criptografia ou prazo — apenas registra que **existirão** como gate.

> **Eventos de auditoria — nomes conceituais (não decididos).** Seguindo a
> convenção já usada em Ponto (`ponto.evento.registrado`,
> `ponto.ajuste.registrado`, `ponto.consultado`), uma futura implementação
> poderia registrar ações como `ponto.lote.recebido`,
> `ponto.lote.rejeitado`, `ponto.lote.processado` — **nomes ilustrativos**,
> sujeitos à modelagem, nunca comprometidos aqui como enum de banco.

## 6. Segurança e autorização

- **RH é o único operador**, restrito ao **próprio `empresa_id`** (detalhada
  §1.3; ADR 0008; T037). Criar, validar, cancelar e consultar lote são
  operações **exclusivas do RH da empresa dona do lote**.
- **`master_tecnico` não tem mutação trabalhista** (ADR 0012, decisão 3):
  mantém, no máximo, os limites técnicos de leitura já aprovados; **não** cria,
  valida, cancela nem processa lote.
- **DP, `gestor` e colaborador são negados** para toda operação de lote no V1
  (detalhada §1.3) — sem acesso por analogia.
- **Isolamento por empresa com 404 anti-enumeração:** qualquer tentativa de um
  ator de acessar lote de **outra** empresa retorna **404** (recurso não
  encontrado), **sem** revelar existência ou metadados do lote (Constituição,
  Princípio II; padrão BOLA/IDOR já aplicado em Ponto). A negação **não**
  distingue "não existe" de "existe, mas fora do seu escopo".
- **Autorização por objeto no servidor:** o escopo (`empresa_id`) é validado no
  servidor a cada operação; filtro de cliente ou id não adivinhável **não** é
  autorização (defesa em profundidade apenas).
- **Auditoria fail-safe e append-only:** a **mutação sensível** do lote (criação
  e transição de estado) e seu evento de auditoria são **transacionais** — se a
  auditoria falhar, a mutação **não** é efetivada (ADR 0004, decisão 2; sem
  mutação órfã). Consultas ao lote são auditáveis como leitura, sem valor
  sensível em claro.

## 7. Idempotência, duplicidade e reprocessamento

Estas são **pendências de decisão** — registradas, **não** resolvidas, e
**proibidas de inferência** (contrato T040 §4.9; T041 não implementou chave de
idempotência):

- **Chave natural da marcação efetiva** (ex.: `empresa + hash_arquivo + nsr`, ou
  `empresa + identificador + momento`) — **pendente**. Sem ela decidida, o lote
  **não** grava marcação (a persistência é camada 4, futura).
- **Reimportação do mesmo arquivo** (mesmo `hash`): o resultado **deve** ser
  idempotente (reprocessar não duplica) — **como** garantir isso (recusar
  lote duplicado? reconciliar? vincular ao lote anterior?) é **pendente**.
- **Reprocessamento de um lote** (ex.: rerodar a validação): permitido? gera
  novo lote ou reusa o mesmo? — **pendente**.
- **Detecção de duplicidade entre lotes** (janelas de período sobrepostas):
  **pendente**; não há regra presumida.

> Enquanto essas decisões estiverem abertas, uma futura implementação **não
> pode inferir** chave, política de duplicidade ou reprocessamento — deve
> **parar e escalar** (Constituição, Protocolo de Prompt; ADR 0008).

## 8. Critérios de aceite e matriz de testes futuros

Todos os testes futuros usam **AFD sintético** (contrato T040 §9; T041), nunca
arquivo real, nem "anonimização" de arquivo real.

### 8.1 Critérios de aceite (da especificação — não de implementação)

- [ ] Máquina de estados descrita com transições e terminais explícitos (§3),
      sem estado alcançável sem transição definida.
- [ ] Fail-closed × rejeição parcial mapeados 1:1 ao resultado do parser (§4).
- [ ] Cinco camadas separadas, com handoff explícito e sem atalho (§2).
- [ ] Proibições de dado pessoal em log/auditoria/erro afirmadas (§5).
- [ ] RH como único operador por empresa; 404 anti-enumeração; auditoria
      append-only/fail-safe (§6).
- [ ] Idempotência/duplicidade/reprocessamento como pendências, sem inferência
      (§7).
- [ ] Nenhum dado real, CPF, nome, horário ou linha bruta presente.

### 8.2 Matriz de testes futuros (com AFD sintético)

| Cenário                                                      | Estado esperado             | Verifica                                                |
| ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------- |
| AFD sintético válido, zero pendências                        | `pronto_para_associacao`    | Handoff limpo; contadores corretos                      |
| AFD válido com ≥1 marcação inválida                          | `processado_com_pendencias` | Rejeição parcial; restante preservado                   |
| AFD com erro estrutural (fail-closed)                        | `rejeitado_estruturalmente` | Nenhuma marcação aceita                                 |
| RH cancela antes do handoff                                  | `cancelado`                 | Terminal; sem efeito na camada 3/4                      |
| Ator de outra empresa acessa o lote                          | (bloqueado)                 | **404** anti-enumeração, sem metadados                  |
| DP / `gestor` / colaborador / `master_tecnico` tentam operar | (bloqueado)                 | Negado; sem mutação trabalhista                         |
| Falha ao gravar auditoria da transição                       | (transição não efetivada)   | Sem mutação órfã (ADR 0004)                             |
| Erro/pendência inspecionados                                 | —                           | Sem CPF/nome/horário/linha bruta/hash em claro indevido |
| Reimportação do mesmo arquivo (mesmo hash)                   | **pendente**                | Marca a pendência de idempotência (§7)                  |

## 9. Dependências e gates preservados

Nenhum destes é relaxado por este documento; todos permanecem **bloqueando dado
real**:

- **MFA** obrigatório antes de dado real (ADR 0003, decisão 3).
- **`DS-OPS-01`** — gate-mestre de segurança operacional (cofre, backup,
  restauração testada); ver
  [pacote de decisão](../decisions/pacote-decisao-seguranca-operacional.md).
- **Retenção, descarte e base legal** do arquivo e das marcações — `DP-3J-11`,
  RH + Jurídico (ADR 0012). **Não decididos, não simulados** (§5.2).
- **Validade/enquadramento jurídico** do controle de jornada — `DP-3J-09`.
- **Normalização do CPF de 12 posições** — pendente (contrato T040 §2.2).
- **CRC-16** (variante do REP-C), **validação de assinatura**, **política de
  lacuna de NSR** e **chave de idempotência** — pendentes (contrato T040 §4.4,
  §4.7, §4.8, §4.9; não implementados na T041).

## 10. O que a próxima implementação poderá fazer × o que permanece proibido

### 10.1 Poderá (dentro deste contrato, com AFD sintético)

- Modelar o **envelope de lote** (id técnico, `empresa_id`, hash, contadores,
  estado) e sua **máquina de estados** (§3), com auditoria append-only.
- Orquestrar o **parser puro (T041)** e mapear seu resultado aos estados (§3.2)
  e às pendências (§4.2).
- Impor **autorização** (RH único operador por empresa; 404 anti-enumeração;
  `master_tecnico`/DP/gestor/colaborador negados — §6).
- Expor as **pendências** à fila "Verificar folhas" por endereçamento técnico
  seguro (§5).

### 10.2 Permanece proibido (sem decisão própria/gate)

- **Associar CPF a colaborador**, **persistir marcação** no banco e **apurar
  jornada** (camadas 3, 4, 5 — §2).
- **Upload/endpoint/integração** com Secullum ou relógio; qualquer rede/API
  externa (§1.2).
- **Decidir/simular** retenção, criptografia, storage ou descarte (§5.2, §9).
- **Inferir** chave de idempotência, política de duplicidade ou reprocessamento
  (§7).
- **Implementar** CRC-16, assinatura, normalização de CPF ou regra de lacuna de
  NSR (§9).
- **Cálculo** trabalhista, banco de horas, DSR, fechamento, espelho, assinatura
  eletrônica (detalhada §2, §3, §8).
- **Habilitar dado real** ou **declarar conformidade** com a Portaria MTP 671.

## 11. Declaração

Este documento **especifica** o contrato do lote de importação AFD e sua
rastreabilidade — finalidade e fronteiras, cinco camadas separadas, máquina de
estados, política fail-closed × rejeição parcial, dados mínimos e proibições,
segurança/autorização, idempotência como pendência, critérios de aceite e matriz
de testes sintéticos, gates preservados e o recorte do que a próxima
implementação poderá ou não fazer. **Nenhuma linha de código, endpoint, upload,
banco, migration, UI, associação CPF↔colaborador, cálculo, integração ou dado
real** é criada por este documento. Ele **não relaxa** MFA, `DS-OPS-01`,
retenção/base legal, validação jurídica, normalização de CPF, CRC-16,
assinatura, lacuna de NSR ou idempotência — todos **preservados como gates/
pendências** — e **não declara** conformidade com a **Portaria MTP 671**.
