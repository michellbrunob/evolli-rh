# Etapa 3 — Contrato técnico do parser AFD (Ponto V1)

- Status: **Contrato técnico (T040) + fundação do núcleo implementada (T041).**
  O documento em si **não** implementa nada; a **fundação do parser** (núcleo
  TypeScript puro de interpretação/validação estrutural com AFD **sintético**)
  foi implementada na T041 (ver "Fundação implementada" abaixo). Permanecem
  **fora** e como gates: upload, endpoint, banco, migration, UI, cálculo,
  integração e dado real.
- Data: 2026-08-27 (T040 — contrato; T041 — fundação do núcleo).
- Fase/tarefa: Fase 3 — Jornada e Ponto; **T040** (especificação técnica oficial
  do parser AFD, para uso futuro com dados sintéticos); **T041** (núcleo do
  parser AFD sintético — interpretação e validação estrutural do perfil REP-C,
  sem endpoint/upload/banco/regra trabalhista).
- Base factual (não reaberta): [Jornada e Ponto V1 detalhada](etapa3-jornada-ponto-v1-detalhada.md)
  (§6, formato TXT/AFD e evidência técnica T039), [ADR 0008](../adr/0008-jornada-ponto-rastreavel-baseline-v1.md)
  (Baseline V1), [spec estrutural da Etapa 3](etapa3-jornada-ponto-rastreavel-estrutural.md).
- Fonte oficial do leiaute: **Ministério do Trabalho e Emprego (MTE)** — página
  de **Registro Eletrônico de Ponto (REP)** e o anexo **Leiaute do Arquivo Fonte
  de Dados (AFD)** (§1).
- Relacionado: [ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md) (MFA,
  sessão), [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (auditoria
  append-only, sem valor sensível em claro), [ADR 0006](../adr/0006-modelo-organizacional-interno-baseline-v1.md)
  (fronteira `empresaId`), [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)
  (`VinculoFuncional`), [ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)
  (RH + Jurídico como função responsável por privacidade),
  [pacote de decisão de segurança operacional](../decisions/pacote-decisao-seguranca-operacional.md)
  (MFA/segredos/backup — gates de dado real, `DS-OPS-01`).
- Constituição: v1.3.0 — Princípio II (segurança/privacidade/menor privilégio;
  MFA antes de dado real), Princípio III (contrato versionado, import com
  proveniência), Princípio IV (evidência, dado sintético), Princípio V
  (auditoria sem conteúdo sensível).

## 0. Natureza e limites deste documento

Este documento **especifica o contrato técnico** do parser do Arquivo Fonte de
Dados (AFD) — o que o parser deverá **reconhecer, validar e rejeitar** — para
que uma futura fase Implementar não precise inferir o leiaute nem inventar
regras. Ele é a evolução técnica direta da T039 (que confirmou fabricante
**RWTech**, modelo **BLUE BIOPROX-C**, extração **manual pelo RH no Secullum** e
formato de arquivo **TXT/AFD** — ver [detalhada §6](etapa3-jornada-ponto-v1-detalhada.md)).

**Invariável neste documento:**

- **Não implementa nada:** sem parser, upload, endpoint, schema, migration, job,
  UI, dependência ou configuração.
- **Não calcula jornada:** nenhuma regra trabalhista (tolerância, banco de horas,
  DSR, extra, falta, fechamento, espelho, assinatura) é definida ou tocada aqui
  — todas permanecem em [detalhada §2, §8](etapa3-jornada-ponto-v1-detalhada.md).
- **Não usa dado real:** nenhum valor real (CPF, nome, batida, número de
  fabricação, CNPJ do empregador) é copiado deste ou de qualquer arquivo real
  para o repositório, documentação, fixture ou teste. Os exemplos abaixo são
  **estruturais e sintéticos**; onde aparece um valor, ele é ilustrativo e
  inventado para fins de leiaute, nunca extraído de arquivo real.
- **Não declara conformidade** legal, trabalhista ou LGPD — inclusive quanto à
  **Portaria MTP 671** (§10). Citar o leiaute oficial **não** adéqua o Evolli à
  Portaria.

> **Fundação implementada (T041).** O **núcleo do parser** deste contrato está
> implementado no backend como **módulo TypeScript puro e isolado**, em
> `apps/api/src/ponto/afd/` (`afd-layout.ts`, `afd-parser.types.ts`,
> `afd-parser.ts`), com fixtures **exclusivamente sintéticas**
> (`afd-fixtures.ts`) e testes unitários completos (`afd-parser.spec.ts`). A
> função `parseAfdSintetico(conteudo: Buffer)` interpreta e valida
> estruturalmente o AFD de **REP-C** (cabeçalho tipo `1`, marcação tipo `3`,
> trailer tipo `9`), aplicando **fail-closed** para erro estrutural (§5) e
> **rejeição por marcação** (§7) para linha de tipo `3` inválida, e devolve
> **em memória** apenas os dados mínimos das marcações aceitas e as pendências
> técnicas — **sem** log, persistência, upload, endpoint, banco, Prisma,
> NestJS, associação CPF↔colaborador ou qualquer regra trabalhista. Os erros
> expõem **apenas** código seguro + `posicaoLinha`/`nsr` técnico, **nunca** CPF,
> nome, conteúdo da linha, data/hora bruta ou hash (§8). **Permanecem
> deliberadamente não implementados** (condicionados/pendentes, sem inventar
> regra): **CRC-16** (§4.7), **validação de assinatura** (§4.8), **normalização
> do CPF de 12 posições** (§2.2), **política definitiva de lacuna de NSR**
> (§4.4) e **chave de idempotência** (§4.9). **Nada** de dado real, MFA,
> `DS-OPS-01` ou conformidade com a Portaria 671 é habilitado pela T041 — todos
> os gates de §10 seguem intactos.

## 1. Fonte oficial, versão e escopo aplicável

### 1.1 Fonte oficial consultada

- **Órgão:** Ministério do Trabalho e Emprego (MTE) — Inspeção do Trabalho /
  Fiscalização do Trabalho.
- **Página oficial (REP):**
  <https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep>
- **Anexo técnico consultado (leiaute AFD):**
  <https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf>
- **Norma de referência citada pela página oficial:** **Portaria MTP nº 671, de
  08 de novembro de 2021** (o leiaute do AFD é referenciado no art. 81).
- **Data de consulta:** 2026-08-27. **Última atualização do anexo na origem
  (informada pela página):** 31/07/2026.
- **Versão do leiaute AFD:** **"004"** (valor fixo do campo de versão no registro
  de cabeçalho — §2.1).

> **Verificação de vigência é obrigatória antes de implementar.** A fonte oficial
> pode ser atualizada. Qualquer fase Implementar futura **deve reconsultar** a
> página oficial e confirmar que a versão do leiaute continua "004" (ou tratar a
> nova versão como mudança de contrato). Este documento fixa o contrato **como
> observado na data de consulta**, não em caráter permanente.

### 1.2 Escopo aplicável a esta V1

- O equipamento confirmado (T039) é o **BLUE BIOPROX-C**, um **REP-C**
  (Registro Eletrônico de Ponto Convencional). Portanto, o AFD relevant para a
  V1 é o **AFD gerado por REP-C**.
- A **marcação de ponto** de um REP-C é o **registro do tipo "3"** (§2.2). É a
  única fonte de batida que o parser precisa **extrair** para a V1.
- Os demais tipos de registro (cabeçalho, empresa, ajuste de relógio, empregado,
  eventos sensíveis, trailer, assinatura) são **reconhecidos e validados
  estruturalmente**, mas **não** produzem batida na V1 (§2, §6).
- **Fora do escopo da V1 (não inventar):** AEJ (Arquivo Eletrônico de Jornada),
  registros de marcação de REP-P (tipo "7") e regras específicas de REP-A/REP-P.
  O parser da V1 mira o **AFD de REP-C**; outras origens são decisão futura
  própria.

## 2. Tipos de registro reconhecidos pelo parser

O AFD é um arquivo **texto de posição fixa**, uma linha por registro, cada linha
terminada pelos caracteres ASCII 13 e 10 (CR+LF), codificado em **ASCII ISO
8859-1**, **ordenado pelo NSR** (Número Sequencial de Registro) e **sem linhas em
branco** (regras gerais do anexo oficial). O primeiro campo de cada registro
(posições 001-009) é o NSR, exceto no cabeçalho e no trailer, que usam sentinelas
fixas.

O parser deve **reconhecer** os tipos abaixo. A coluna "Papel no parser V1"
indica o tratamento nesta fatia. As posições/tamanhos são **transcritos do
leiaute oficial** (versão "004"); onde não transcrito, é porque não é necessário
à V1 — **não inventar**.

| Tipo | Nome (oficial)                                 | Papel no parser V1                                                   |
| ---- | ---------------------------------------------- | -------------------------------------------------------------------- |
| `1`  | Cabeçalho                                      | **Obrigatório**; valida abertura, versão e período (§2.1).           |
| `2`  | Inclusão/alteração da identificação da empresa | Reconhecido; **não** gera batida; contado para conferência.          |
| `3`  | **Marcação de ponto (REP-C e REP-A)**          | **Fonte de batida da V1** (§2.2).                                    |
| `4`  | Ajuste do relógio                              | Reconhecido; **não** gera batida; relevante como sinal de auditoria. |
| `5`  | Inclusão/alteração/exclusão de empregado       | Reconhecido; **não** gera batida; **contém nome** (dado pessoal).    |
| `6`  | Eventos sensíveis do REP                       | Reconhecido; **não** gera batida; contado para conferência.          |
| `7`  | Marcação de ponto (REP-P)                      | Reconhecido; **fora do escopo de batida da V1** (não é REP-C).       |
| `9`  | Trailer (encerramento)                         | **Obrigatório**; valida contagens e encerramento (§2.3).             |
| —    | Assinatura digital                             | Registro final de 100 posições; reconhecido, não gera batida.        |

### 2.1 Registro tipo "1" — Cabeçalho (abertura)

Campos do leiaute oficial (versão "004") relevantes ao parser:

| Ref | Posição | Tam. | Tipo | Conteúdo                                                 |
| --: | ------- | ---: | ---- | -------------------------------------------------------- |
|   1 | 001-009 |    9 | N    | Sentinela fixa `000000000`.                              |
|   2 | 010-010 |    1 | N    | Tipo do registro. Valor `1`.                             |
|   3 | 011-011 |    1 | N    | Tipo de identificador do empregador (`1`=CNPJ, `2`=CPF). |
|   4 | 012-025 |   14 | A    | CNPJ ou CPF do empregador.                               |
|  11 | 251-253 |    3 | N    | **Versão do leiaute do AFD** — valor `004`.              |
|  15 | 299-302 |    4 | A    | CRC-16 do registro (hexadecimal, sem `0x`).              |

> O cabeçalho ainda transporta, no leiaute oficial, número de fabricação/registro,
> razão social, datas inicial/final dos registros, data-hora de geração e
> identificação do fabricante/modelo. O parser **lê** o que precisa para validar
> abertura, **versão** e **janela de datas**; **não** persiste conteúdo pessoal do
> empregador em log/auditoria (§8). Campos não listados acima existem no leiaute,
> mas não são requisitos de contrato da V1 e **não são inventados** aqui.

### 2.2 Registro tipo "3" — Marcação de ponto (REP-C) — fonte de batida da V1

Este é o **único registro que produz batida** na V1. Leiaute oficial completo:

| Ref | Posição | Tam. | Tipo | Conteúdo                                                  |
| --: | ------- | ---: | ---- | --------------------------------------------------------- |
|   1 | 001-009 |    9 | N    | **NSR** (Número Sequencial de Registro).                  |
|   2 | 010-010 |    1 | N    | Tipo do registro. Valor `3`.                              |
|   3 | 011-034 |   24 | DH   | **Data e hora da marcação de ponto** (formato DH — §4.3). |
|   4 | 035-046 |   12 | N    | **CPF do empregado** (identificador do trabalhador).      |
|   5 | 047-050 |    4 | A    | CRC-16 do registro (hexadecimal, sem `0x`).               |

> **Nota sobre o campo CPF (035-046, tamanho 12).** O leiaute oficial define o
> campo com **12 posições numéricas**. A forma exata de interpretar/normalizar
> esse campo para o CPF de 11 dígitos usado no cadastro do Evolli é **detalhe de
> modelagem** (a confirmar na fase Implementar, com AFD sintético) — **não é
> inventada aqui**. O parser preserva o identificador **como veio** (§ evidência
> T039: "sem normalização destrutiva") e a associação ao colaborador é etapa
> separada (§6).

### 2.3 Registro tipo "9" — Trailer (encerramento)

| Ref | Posição | Tam. | Tipo | Conteúdo                             |
| --: | ------- | ---: | ---- | ------------------------------------ |
|   1 | 001-009 |    9 | N    | Sentinela fixa `999999999`.          |
|   2 | 010-018 |    9 | N    | Quantidade de registros do tipo `2`. |
|   3 | 019-027 |    9 | N    | Quantidade de registros do tipo `3`. |
|   4 | 028-036 |    9 | N    | Quantidade de registros do tipo `4`. |
|   5 | 037-045 |    9 | N    | Quantidade de registros do tipo `5`. |
|   6 | 046-054 |    9 | N    | Quantidade de registros do tipo `6`. |
|   7 | 055-063 |    9 | N    | Quantidade de registros do tipo `7`. |
|   8 | 064-064 |    1 | N    | Tipo do registro. Valor `9`.         |

O trailer é a **prova de encerramento e completude**: declara quantos registros
de cada tipo o arquivo contém. O parser **confere** as contagens declaradas
contra as efetivamente lidas (§4.8).

## 3. Campos necessários para rastrear uma marcação (sem valor real)

Para cada marcação (tipo "3") que o parser aceitar, a modelagem futura deverá
preservar **rastreabilidade** com o **mínimo** de dado. Os campos abaixo são o
**contrato de rastreabilidade** — descritos por **papel**, nunca com valor real:

| Campo (conceitual)    | Origem no AFD                  | Papel                                                                        |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `nsr`                 | tipo 3, campo 1 (001-009)      | Ordem/identidade do registro dentro do arquivo; base de idempotência.        |
| `momento_marcacao`    | tipo 3, campo 3 (011-034, DH)  | Instante da batida, com fuso (§4.3). É o dado temporal da marcação.          |
| `identificador_bruto` | tipo 3, campo 4 (035-046)      | Identificador do trabalhador **como veio** (CPF); insumo da associação (§6). |
| `crc_registro`        | tipo 3, campo 5 (047-050)      | Verificação de integridade do registro (§4.7).                               |
| `hash_arquivo`        | derivado do arquivo inteiro    | Impressão digital do lote (proveniência/idempotência — §8, §4).              |
| `ref_lote`            | metadado do lote de importação | Vincula a marcação ao lote/proveniência (empresa, operador, momento).        |
| `posicao_linha`       | número da linha no arquivo     | Endereço técnico para diagnóstico/pendência **sem** expor conteúdo.          |

- **Não** faz parte do registro de marcação: nome do empregado, razão social do
  empregador, número de fabricação, ou qualquer conteúdo dos tipos 1/2/5. Esses
  existem no arquivo, mas **não** são copiados para a marcação nem para logs.
- O **arquivo original** é tratado como **ativo protegido** (Constituição,
  Princípio III): armazenado fora do repositório, autorizado por objeto, com
  proveniência e hash — **decisão de storage é da fase Implementar**, não aqui.

## 4. Regras de validação estrutural

Todas as validações abaixo são **estruturais/técnicas** (do arquivo AFD), nunca
trabalhistas (§6). Ordem sugerida: arquivo → abertura → linha a linha →
encerramento.

### 4.1 Codificação e terminação de linha

- Arquivo em **texto ASCII ISO 8859-1**. Byte fora do conjunto esperado →
  arquivo **incompatível** (§5).
- Cada linha termina com **CR+LF** (ASCII 13 seguido de 10). Terminação ausente
  ou divergente na última linha → arquivo **truncado/corrompido** (§5).
- **Sem linhas em branco** — linha vazia é violação estrutural.

### 4.2 Tipo de registro e tamanho da linha

- O **tipo** é lido na posição 010-010 (ou pelas sentinelas 001-009 =
  `000000000` para cabeçalho e `999999999` para trailer).
- Tipo **desconhecido** (fora de `1,2,3,4,5,6,7,9` + assinatura) → linha
  inválida; arquivo com tipo desconhecido é tratado como **incompatível** (§5),
  não "melhor esforço".
- Cada tipo tem **comprimento fixo esperado** conforme o leiaute (ex.: tipo 3
  termina na posição 050; cabeçalho na 302). Linha com comprimento divergente do
  esperado para o seu tipo → **registro inválido** (§7) e, se o desalinhamento
  impedir interpretar o arquivo, **incompatível** (§5).

### 4.3 Datas, horas e fuso (campos D e DH)

- **D (data):** formato `AAAA-MM-dd`. Ano/mês/dia sintaticamente válidos e data
  de calendário existente.
- **DH (data e hora):** formato `AAAA-MM-ddThh:mm:00ZZZZZ`, onde:
  - `T` é literal fixo; `hh` ∈ 00–23; `mm` ∈ 00–59; os **segundos são fixos
    `00`**;
  - `ZZZZZ` é o **fuso horário**: **1º caractere é o sinal** (`+`/`-`) e os
    **quatro dígitos seguintes** são hora e minutos do deslocamento
    (ex. ilustrativo, sintético: `2021-04-27T16:44:00-0300`).
- Qualquer desvio de formato (posição do `T`, segundos ≠ `00`, fuso mal formado,
  data inexistente) → **registro inválido** (§7).
- O parser **preserva o fuso** informado; **não** converte silenciosamente para
  outro fuso nem descarta o deslocamento. Normalização temporal para apuração é
  **etapa trabalhista futura** (§6), não do parser.

### 4.4 NSR e sequência

- O NSR (001-009) é numérico. O anexo oficial exige o arquivo **ordenado por
  NSR**. O parser valida que os registros com NSR (tipos 2–7) estão em ordem
  **não decrescente/consistente** conforme o leiaute; quebra de ordem →
  **inconsistência estrutural** do arquivo (§5), pois indica arquivo adulterado
  ou concatenado indevidamente.
- **Não inventar** regra de continuidade (ex.: "NSR sempre +1 sem lacunas"): o
  anexo exige ordenação, não ausência de lacunas. O parser valida **ordenação**;
  qualquer política adicional sobre lacunas é decisão futura, não presumida aqui.

### 4.5 Cabeçalho obrigatório

- A **primeira linha** deve ser um **cabeçalho válido** (tipo `1`, sentinela
  `000000000`, versão `004`). Ausência/invalidez do cabeçalho → arquivo
  **rejeitado** (§5): sem cabeçalho válido não há arquivo AFD a processar.
- **Versão do leiaute** (251-253) diferente de `004` → arquivo **incompatível**
  (§5): o parser **não** tenta processar um leiaute que não conhece.

### 4.6 Identificador do trabalhador (CPF)

- Presença: o campo 035-046 do tipo 3 deve estar **preenchido** e **numérico**.
- Ausente, não numérico ou vazio → **marcação inválida por identificador**
  (§7), tratada por linha, **sem** expor o valor.
- **Validação de existência do CPF no cadastro do Evolli não é etapa do parser**
  — é a **associação** ao colaborador (§6). O parser valida **forma**, não
  **vínculo**.

### 4.7 Integridade por registro (CRC-16) e hash (tipo 7)

- Os registros dos tipos `1` a `5` carregam **CRC-16** do próprio registro
  (hexadecimal, sem `0x`). O parser **verifica** o CRC-16 dos registros que
  processa; CRC divergente → **registro inválido/corrompido** (§7).
- **Variante exata do CRC-16 para REP-C: pendente de confirmação.** O anexo
  oficial só fixa explicitamente o padrão **CRC-16 CCITT-TRUE (CRC-16/KERMIT)**
  para o **AFD gerado por REP-A ou REP-P**. Para o **REP-C** (nosso caso), a
  variante exata **não** está pinada por este anexo — deve ser **confirmada com
  o fornecedor (RWTech)** contra **amostra sintética** antes de implementar a
  verificação de CRC. Até lá, a checagem de CRC do REP-C é **especificação
  condicional**, não alvo de implementação — **não inventar** a variante.
- O registro tipo `7` (REP-P, fora do escopo de batida da V1) usa **SHA-256** no
  campo de hash encadeado; registrado aqui apenas para completude do leiaute.

### 4.8 Encerramento (trailer) e conferência de contagens

- A **última linha de dados** deve ser um **trailer válido** (tipo `9`,
  sentinela `999999999`). Ausência → arquivo **truncado** (§5).
- As **contagens declaradas** no trailer (tipos 2–7) devem **bater** com as
  efetivamente lidas. Divergência → arquivo **inconsistente** (§5): o lote não é
  confiável e não é efetivado.
- Quando presente, o registro de **assinatura digital** (100 posições) é o
  fecho físico do arquivo; sua **validação criptográfica** (cadeia/certificado)
  é **decisão futura** (depende de Jurídico/segurança) e **não** é presumida
  como implementada por este contrato.

### 4.9 Duplicidade e idempotência

- **Dentro do arquivo:** dois registros de marcação com o **mesmo NSR** são
  violação estrutural (NSR é sequencial) → arquivo **inconsistente** (§5).
- **Entre arquivos (reimportação):** reimportar o **mesmo lote** (mesmo
  `hash_arquivo`) **não** pode duplicar marcações — o resultado é
  **idempotente** (a mesma fonte retorna o estado já efetivado). A **chave
  natural** exata da marcação efetiva (ex.: `empresa + hash_arquivo + nsr`, ou
  `empresa + identificador + momento_marcacao`) é **detalhe de modelagem** a
  homologar na fase Implementar — **não fixada aqui** para não presumir regra.
- Esta regra reafirma a idempotência já exigida em
  [detalhada §6](etapa3-jornada-ponto-v1-detalhada.md) (e o critério de sucesso
  de que a mesma fonte reenviada não cria marcação duplicada), sem alterá-la.

## 5. Regras fail-closed (rejeição segura)

O parser opera **fail-closed**: na dúvida, **rejeita com segurança**, nunca
processa "no melhor esforço". Um arquivo é **rejeitado integralmente** (o lote
**não** é efetivado) quando:

- **Formato/codificação desconhecido:** não é texto ASCII ISO 8859-1, ou contém
  tipo de registro fora do conjunto conhecido (§4.2).
- **Versão de leiaute não suportada:** campo de versão ≠ `004` (§4.5).
- **Cabeçalho ausente/invalido** ou **trailer ausente/inválido** (§4.5, §4.8).
- **Truncamento/corrupção:** terminação de linha inválida, arquivo cortado,
  linha em branco, comprimento global incoerente (§4.1, §4.2).
- **Inconsistência de contagem** trailer × lido, ou **quebra de ordenação de
  NSR**, ou **NSR duplicado** (§4.4, §4.8, §4.9).

Distinção essencial:

- **Rejeição do arquivo (fail-closed, §5)** é para falha **estrutural** que torna
  o arquivo inteiro não confiável — o lote **não entra**.
- **Rejeição por marcação (§7)** é para uma **linha de marcação** individual
  inválida num arquivo **estruturalmente válido** — a marcação vira **pendência**
  e o **restante do lote segue** (decisão do RH, T035).

Toda rejeição (de arquivo ou de linha) produz **erro seguro**: mensagem sem dado
pessoal, com `request_id`/identificador técnico e endereço técnico (posição/
linha), nunca com CPF, nome ou horário em claro (§8).

## 6. Três responsabilidades separadas (fronteiras rígidas)

Este contrato **separa** três responsabilidades que **não** podem se misturar:

1. **Validação técnica do AFD (escopo do parser, este documento):** codificação,
   tipos, posições, datas/horas/fuso, NSR/ordem, CRC, contagens, trailer,
   fail-closed. Trabalha sobre **forma**, não sobre pessoa nem sobre jornada.
2. **Associação da marcação ao colaborador pelo CPF (etapa seguinte, fora do
   parser):** casar o `identificador_bruto` (CPF do tipo 3) com um colaborador
   **cadastrado no Evolli**, **por empresa** (`empresaId` via `VinculoFuncional`,
   [ADR 0007](../adr/0007-colaboradores-e-vida-funcional-baseline-v1.md)). CPF
   ausente/inválido/sem colaborador **não** invalida o lote — gera **pendência
   por marcação** (§7), conforme [detalhada §2.3](etapa3-jornada-ponto-v1-detalhada.md)
   (T035). A **hipótese** de o identificador ser o CPF é da T035/T039; a forma
   exata de match é modelagem futura, não inventada aqui.
3. **Regras trabalhistas de apuração (fora desta tarefa, permanecem gates):**
   tolerância, intervalo mínimo, banco de horas, DSR, extra, falta, período de
   apuração, fechamento, espelho e assinatura vivem em
   [detalhada §2, §3, §8](etapa3-jornada-ponto-v1-detalhada.md) e dependem de
   `DP-3J-09` (validade legal) e demais gates. **O parser não apura nem calcula
   nada.**

Cruzar essas fronteiras (ex.: o parser "decidir" atraso, ou a apuração "confiar"
num arquivo não validado) é **proibido** por este contrato.

## 7. Tratamento de erros por linha (pendência sem expor CPF)

Num arquivo **estruturalmente válido** (§4, §5), uma **marcação individual**
pode ainda ser inválida. O tratamento respeita a decisão do RH (T035 — rejeição
**por marcação**, nunca por lote):

- **Marcação inválida** (identificador ausente/mal formado, DH inválida, CRC
  divergente do registro): a marcação **não** é efetivada, mas o **lote segue**.
- Cada marcação inválida gera um **item de pendência** na fila **"Verificar
  folhas"** ([detalhada §5](etapa3-jornada-ponto-v1-detalhada.md)) — por exemplo
  o tipo `CPF rejeitado` quando o identificador não casa com colaborador.
- A pendência referencia a marcação por **endereço técnico** (`nsr`,
  `posicao_linha`, `ref_lote`) — **nunca** exibindo o CPF, nome ou horário em
  claro. O detalhamento seguro segue [detalhada §5.2](etapa3-jornada-ponto-v1-detalhada.md).
- **Nada é descartado em silêncio:** toda marcação rejeitada é **apontada** e
  **auditável** (§8). A resolução é **ação humana do RH**, pelos fluxos próprios
  — o parser apenas **sinaliza**.

## 8. Requisitos de auditoria e de log

Alinhado a [ADR 0004](../adr/0004-auditoria-formal-e-integridade.md) (append-only,
sem valor sensível em claro) e ao Princípio V da Constituição:

- **Auditoria da importação** (operação sensível) registra **apenas metadados
  técnicos**: ator (papel/ID técnico), empresa (`empresaId`), ação
  (ex. `ponto.afd.importado`), `ref_lote`, `hash_arquivo`, versão de leiaute
  (`004`), contagens por tipo, quantidade de marcações aceitas/rejeitadas,
  resultado e correlação (`request_id`). **Nunca** CPF, nome, horário de batida,
  número de fabricação, CNPJ do empregador ou conteúdo bruto de linha.
- **Logs técnicos** são estruturados e **redigidos**: diagnóstico por
  `nsr`/`posicao_linha`, **jamais** o conteúdo do campo. Uma linha de log que
  dissesse "CPF 000… às 08:03" **duplicaria** dado pessoal no log — proibido.
- **Pendências** (§7) e mudanças de estado de item são **auditáveis**, também
  sem valor sensível em claro.
- O **arquivo original** é ativo protegido (§3): sua guarda, retenção e descarte
  dependem de decisão de RH + Jurídico (`DP-3J-11`) e da política de storage —
  **não** definidos aqui.

## 9. Estratégia de fixtures (somente AFD sintético)

- **Todo** insumo de teste é **AFD sintético**, construído a partir **deste
  leiaute** (§2), com valores **inventados** (CPF fictício, CNPJ fictício,
  número de fabricação fictício, nomes fictícios). **Nunca** o arquivo real
  extraído do Secullum, nem trechos dele, nem "anonimização" de arquivo real —
  reafirma T039 e a Constituição (Princípio IV).
- **Casos válidos (mínimos):** cabeçalho `004` + N marcações tipo 3 em ordem de
  NSR + trailer com contagens corretas; incluir ao menos um arquivo com tipos
  2/4/5/6 presentes (para provar que são reconhecidos sem virar batida).
- **Casos inválidos (fail-closed, §5):** versão ≠ `004`; cabeçalho ausente;
  trailer ausente; contagem do trailer divergente; NSR fora de ordem; NSR
  duplicado; linha truncada/sem CR+LF; tipo de registro desconhecido;
  codificação inválida.
- **Casos de pendência por linha (§7):** arquivo válido com uma marcação de CPF
  ausente/mal formado; marcação com DH inválida; marcação com CRC divergente —
  cada um deve **gerar pendência** e **preservar o restante do lote**.
- **Isolamento por empresa:** fixtures cobrindo `Empresa A`/`Empresa B` provando
  que RH de uma empresa não vê marcação da outra ([detalhada §1.4](etapa3-jornada-ponto-v1-detalhada.md)).
- Os fixtures **só** viram caso de teste real **após** a fase Implementar ser
  autorizada; este documento **não** cria nenhum arquivo de fixture.

## 10. Limites explícitos e gates preservados

- **Não declara adequação à Portaria MTP 671.** Citar e transcrever o leiaute
  oficial do AFD confirma **o formato de entrada** e o **contrato técnico do
  parser** — **não** afirma conformidade legal, validade do controle de jornada,
  enquadramento do REP, retenção legal ou base legal. Isso permanece avaliação
  **do Jurídico** (`DP-3J-09`, `DP-3J-11`).
- **Não habilita dado real.** Nenhum arquivo real entra em nenhum ambiente. O
  gate-mestre `DS-OPS-01` e o **MFA** ([ADR 0003](../adr/0003-identidade-sessao-e-autorizacao.md))
  seguem **duros**; retenção/descarte e base legal seguem pendentes com RH +
  Jurídico ([ADR 0012](../adr/0012-convergencia-governanca-privacidade-e-perfis-globais.md)).
- **Não implementa** parser, upload, endpoint, banco, migration, UI, cálculo de
  jornada, banco de horas, DSR, fechamento, espelho, assinatura, integração
  externa ou uso de dado real.
- **Não integra** com Secullum/relógio: **sem** API, rede ou comunicação direta
  (T039). O RH extrai o TXT/AFD **manualmente**; o Evolli apenas **lê** o
  arquivo, quando a importação for implementada.
- **Não inventa** o que a fonte oficial não fixa: variante de CRC-16 do REP-C
  (§4.7), normalização do campo CPF de 12 posições (§2.2), chave natural de
  idempotência (§4.9), regra de lacuna de NSR (§4.4) e validação criptográfica
  da assinatura (§4.8) permanecem **pendentes/condicionais**, a resolver com
  fornecedor/Jurídico contra **amostra sintética**.

## 11. Efeito sobre DP-3J-20 (parcial) e pendências preservadas

- **DP-3J-20 — avanço parcial (T040):** o **leiaute oficial do AFD** deixa de ser
  "a confirmar" e passa a **identificado e citado** da fonte oficial do MTE —
  **AFD versão "004"**, referenciado pela **Portaria MTP nº 671/2021** (§1). Com
  a T039 (REP-C BLUE BIOPROX-C, TXT/AFD), o **contrato técnico do parser** para
  a marcação de REP-C (registro tipo "3") está **especificado** (§2–§9).
- **DP-3J-20 — o que permanece pendente (não resolvido aqui):**
  - **Homologação do fornecedor (RWTech):** confirmação formal de que o **BLUE
    BIOPROX-C** emite AFD **conforme o leiaute "004"**, verificada campo a campo
    contra **amostra sintética**, incluindo a **variante exata de CRC-16 do
    REP-C** (§4.7).
  - **Enquadramento/validade legal (Jurídico):** aderência à Portaria 671 e
    validade do controle de jornada — permanece em `DP-3J-09`.
- **Demais pendências inalteradas:** `DP-3J-09` (validade legal), `DP-3J-11`
  (retenção/descarte/acesso do titular), `DP-3J-18` (três exemplos homologados),
  `DP-3J-22` (marcos de horários), o **cálculo financeiro** de `DP-3J-21`, além
  de **MFA** e `DS-OPS-01` — todos **preservados como estavam**.

## 12. Declaração

Este documento **especifica o contrato técnico** do parser AFD a partir da
**fonte oficial do MTE** (leiaute AFD versão "004", Portaria MTP 671/2021) e da
evidência técnica da T039 (RWTech, BLUE BIOPROX-C, extração manual via Secullum,
TXT/AFD). Ele define tipos de registro reconhecidos, campos de rastreabilidade,
validação estrutural, regras fail-closed, a separação entre validação técnica /
associação por CPF / apuração trabalhista, o tratamento de erro por linha sem
expor CPF, os requisitos de auditoria e a estratégia de fixtures **exclusivamente
sintéticos**. **Nenhuma linha de código, parser, upload, endpoint, schema,
migration, UI, cálculo, integração ou dado real** é criada por este documento.
Ele **avança parcialmente `DP-3J-20`** (leiaute oficial identificado e contrato
técnico especificado), **preservando** a homologação do fornecedor e a validação
jurídica como pendências, e **não relaxa** MFA, `DS-OPS-01`, retenção, base legal
ou o isolamento por `empresaId`. **Não declara** conformidade com a **Portaria
MTP 671** nem habilita dado real.
