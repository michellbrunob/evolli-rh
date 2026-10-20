# T176 — Decisão do `DP-FLX-04`: estados e transições do processo admissional

- Status: **documento de preparação de decisão.** O `DP-FLX-04` continua
  **aberto**. Nada aqui decide, aprova ou autoriza implementação: a resposta é
  do proprietário.
- Data: 2026-10-20
- Tarefa: T176. Este documento é a parte **documental** da T176; a
  mesma tarefa entrega também a página de Nova admissão (ver abaixo).
- **Atualização da mesma data.** Depois de escrito este documento, a
  proprietária resolveu o `DP-FLX-21`: cadastro longo de admissão em página
  própria, modal só para o que é curto. As menções ao `DP-FLX-21` como gate
  aberto, nas seções 1, 6, 9 e 11, ficam superadas por essa decisão; a
  tela própria deixa de ser pendência e passa a ser a direção. **P1 a P4
  continuam sem resposta** e o `DP-FLX-04` continua aberto.
- Fontes, e só elas: a [ADR 0017](../adr/0017-fluxo-admissao-vinculo-desligamento-rh-dp.md),
  aceita na T175; o [dossiê da T174](t174-dossie-decisoes-fatia-0.md); o
  [diagnóstico](t173-reconciliacao-fluxo-rh-dp.md) e as
  [respostas R1 a R40](t173-respostas-rh-dp.md) da T173; e as ADRs, os
  contratos, o código e os testes atuais, **só como evidência**. Sem fonte
  externa, Notion, dado real ou referência de terceiros.

## 1. O que está em decisão

O gate, como o diagnóstico o registra (`DIAG:640`): "Estados e transições do
processo admissional: oito etapas, devolução, cancelamento, 'efetivada
aguardando início', correção pós-efetivação (inclui T166 D8); quem opera cada
transição, inclusive as etapas 3, 6 e 7". A decisão contraria hoje a decisão 15
da Baseline V1 e a recusa de efetivar antes da vigência (`DIAG:640`), e é um
dos dois gates do conflito 2, o da matrícula (`DIAG:670`).

A decisão tem quatro partes, que este documento separa:

| Parte  | Pergunta                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| **P1** | Onde o processo admissional vive, e quando nascem Colaborador, vínculo e matrícula (alternativas A, B e C, seção 6). |
| **P2** | "Admissão efetivada, aguardando início" passa a existir? Quem torna o vínculo ativo na data de início (seção 7)?     |
| **P3** | Quem opera cada transição, em especial as etapas 3, 6 e 7 e o cancelamento (seção 5.4).                              |
| **P4** | Onde fica a correção da admissão já efetivada, que a R12 exige e o achado D8 da T166 mostra inviável hoje (seção 8). |

**Fora desta decisão**, cada um com o seu gate, que continua aberto:

- as etapas 1 e 2 da R9 (solicitação e aprovações) e qualquer papel do gestor
  (`DP-FLX-02`, `DP-FLX-03`);
- a regra da matrícula definitiva e o identificador provisório (`DP-FLX-10`);
- os dados de cada etapa (`DP-FLX-05`, `-06`, `-08`) e os documentos
  (`DP-FLX-14`);
- a forma do motivo de devolução e de cancelamento, se texto livre (conflito 8,
  `DP-FLX-11`; `DIAG:676`);
- a tela do processo (`DP-FLX-21`).

## 2. Como ler

Cada afirmação está numa de três camadas:

| Camada                   | O que é                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| **Fato recebido**        | O que as respostas de RH/DP dizem, citado pelo número (R1 a R40).     |
| **Comportamento atual**  | O que o código, o schema e os testes fazem hoje, com `caminho:linha`. |
| **Análise do documento** | Proposta ou avaliação técnica deste documento. Não é decisão.         |

Os estados das alternativas são **análise do documento**: nomes de trabalho
para comparar modelos, não nomes de enum aprovados.

**Abreviações de caminho.** `RESP` = `docs/decisions/t173-respostas-rh-dp.md`;
`DIAG` = `docs/decisions/t173-reconciliacao-fluxo-rh-dp.md`; `DOS` =
`docs/decisions/t174-dossie-decisoes-fatia-0.md`; `A7` e `A17` = ADRs 0007 e
0017 em `docs/adr/`; `BV1` =
`docs/decisions/etapa1-fatia2-colaboradores-baseline-v1.md`; `T166` =
`docs/decisions/t166-dados-admissao-perfil-diagnostico.md`; `schema` =
`apps/api/prisma/schema.prisma`; `mig` =
`apps/api/prisma/migrations/20260807120000_colaboradores_vida_funcional/migration.sql`;
`dto` = `apps/api/src/pessoas/dto/pessoas.dto.ts`; `validacao` =
`apps/api/src/pessoas/validacao-pessoas.util.ts`; `comum` =
`apps/api/src/pessoas/pessoas-comum.util.ts`; `colab.service.ts` =
`apps/api/src/pessoas/colaborador/colaborador.service.ts`; `mov.service.ts` =
`apps/api/src/pessoas/movimentacao/movimentacao.service.ts`;
`vinculo.service.ts` = `apps/api/src/pessoas/vinculo/vinculo.service.ts`;
`rbac` = `apps/api/src/auth/authorization/rbac.evaluator.ts`; `audit` =
`apps/api/src/audit/audit.types.ts`; `e2e` = `apps/api/test/pessoas.e2e-spec.ts`.

## 3. Processo admissional × vínculo efetivado

**Fato recebido.** A R11 pede que o sistema diferencie quatro situações —
"admissão prevista, admissão em andamento, admissão efetivada e vínculo ativo" —
"para que uma pessoa ainda em processo não seja tratada como colaboradora ativa
antes do momento correto" (`RESP:90-95`). O vínculo passa a ativo depois das
validações e da confirmação pelo RH/DP, "respeitando a data de início do
vínculo" (`RESP:90-95`). A R9 dá a sequência de oito etapas e pede devolução e
status por etapa (`RESP:77-82`); a R12, devolução com motivo e cancelamento com
justificativa e histórico (`RESP:97-102`).

**Separação proposta** (análise do documento), usada em todas as alternativas:

| Conceito                 | O que é                                                                                                | Termina quando                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Processo admissional** | A condução das etapas da R9 até a efetivação: conferência, devolução, cancelamento e status por etapa. | É efetivado ou cancelado.               |
| **Admissão efetivada**   | O ato de RH/DP que confirma a admissão (R11). É o fim do processo.                                     | É um ato, não um período.               |
| **Vínculo efetivado**    | O vínculo funcional que resulta da efetivação, com empresa, tipo, matrícula e data de início.          | Continua existindo; é encerrado depois. |
| **Vínculo ativo**        | O vínculo efetivado a partir da data de início (R11).                                                  | É encerrado por desligamento.           |

**Ambiguidade das respostas, não resolvida aqui.** A R11 distingue "admissão
prevista" de "admissão em andamento", mas nenhuma resposta diz o que separa as
duas. Uma leitura possível é que "prevista" seja o pedido ainda não aprovado
(etapas 1 e 2), que depende do `DP-FLX-02` e do `DP-FLX-03`. Outra é que seja o
processo com data de início futura. As alternativas abaixo funcionam com
qualquer das duas; a pergunta pode ir a RH/DP.

**Comportamento atual.** Hoje processo e vínculo são o **mesmo objeto**: a
admissão "em andamento" é só o vínculo `previsto` com a movimentação de admissão
`solicitada` ou `programada` (`DIAG:47`), e a efetivação ativa o vínculo no mesmo
ato (seção 4).

## 4. Linha de base: a admissão atômica de hoje

**Comportamento atual**, com evidência:

- **Admitir é um ato atômico.** `POST /v1/colaboradores` cria, numa transação, o
  Colaborador `inativo`, o vínculo `previsto` com a matrícula informada e a
  movimentação de admissão (`colab.service.ts:143-177`), mais três eventos de
  auditoria (`colab.service.ts:179-201`). A movimentação nasce `programada` se a
  data de admissão é futura e `solicitada` se não (`colab.service.ts:139-140`).
- **É decisão aprovada.** A decisão 15 da Baseline V1 fez da operação "admissão
  atômica" e proibiu colaborador órfão (`BV1:441-446`), porque o Colaborador não
  tem `empresa_id` e ficaria fora de todo escopo (`BV1:448-453`). Dois gatilhos
  deferidos garantem, no COMMIT, que todo colaborador tem vínculo e todo vínculo
  `ativo` tem alocação vigente (`BV1:458-470`), e há testes para isso
  (`e2e:1389-1416`, `e2e:1796`, `e2e:1827`).
- **A matrícula nasce na admissão**, obrigatória no contrato (`dto:153-154`) e
  única por empresa (`schema:1065`).
- **Estados.** O vínculo tem `previsto`, `ativo` e `encerrado` (`schema:930-934`).
  A movimentação tem `solicitada`, `programada`, `efetivada`, `cancelada` e
  `retificada` (`schema:948-954`).
- **Transições da movimentação** (`validacao:24-32`): `solicitada` e `programada`
  vão só a `efetivada` ou `cancelada`; `efetivada`, só a `retificada`;
  `cancelada` e `retificada` são terminais. **Não existe devolução** nem estado
  intermediário.
- **Efetivar** é ato explícito, com executor identificado, e "nenhum job efetiva
  sozinho" (`mov.service.ts:224-225`, `mov.service.ts:362`; `A7:424`). É recusado
  antes da vigência (`mov.service.ts:250`; `validacao:247-255`; teste em
  `e2e:2011`) e exige vínculo `previsto` para a admissão (`validacao:49-54`). No
  mesmo ato cria a primeira alocação — a lotação (`mov.service.ts:301-311`) —,
  torna o vínculo `ativo` (`mov.service.ts:326-338`) e recalcula a situação do
  Colaborador (`mov.service.ts:374`; `comum:83-98`). Antes disso não há alocação
  (`e2e:467`); o destino fica gravado na movimentação e é revalidado na
  efetivação (`mov.service.ts:269-271`).
- **Cancelar** só muda o status da movimentação (`mov.service.ts:196-212`). **Pelo
  código** (não encontrei teste que cancele uma admissão), cancelar a admissão
  deixa o vínculo `previsto` e a matrícula ocupada, sem caminho de volta: nenhuma
  nova movimentação de admissão pode ser registrada sobre um vínculo existente
  (`mov.service.ts:60-63`; `dto:213-214`).
- **Correção da admissão efetivada** não é viável, pelo achado D8 da T166, não
  reproduzido (`T166:104`).
- **Quem opera:** só `rh` e `dp`, na própria empresa (`rbac:363-367`). O gestor é
  negado na superfície administrativa de Pessoas (`rbac:371-377`).
- **Auditoria:** uma ação por mutação, entre elas `pessoas_colaborador_criado`,
  `pessoas_vinculo_ativado` e `pessoas_movimentacao_efetivada` e `_cancelada`
  (`audit:70-81`).

**O que falta frente às respostas:** etapas e status por etapa (R9), devolução
com motivo (R12), cancelamento com justificativa (R12; hoje só o motivo de
criação, de catálogo, existe), a diferença entre efetivada e ativa (R11) e a
correção pós-efetivação (R12).

## 5. Elementos comuns às três alternativas

Análise do documento. Valem para A, B e C, salvo onde a alternativa diz o
contrário.

### 5.1 Etapas cobertas

O modelo cobre as etapas **3 a 8** da R9: cadastro prévio, documentos,
conferência, procedimentos, validação final e efetivação (`A17:65-91`). As
etapas 1 e 2 (solicitação e aprovações) **não entram** até o `DP-FLX-02` e o
`DP-FLX-03`. Até lá, o processo começa no cadastro prévio, aberto por RH/DP,
como a admissão começa hoje.

### 5.2 Devolução para correção

**Fato recebido:** "O RH poderá devolver o processo para correção, registrando o
motivo" (`RESP:97-102`). Proposta do documento: a devolução é uma transição
para um estado de espera, com motivo obrigatório, que volta a uma etapa
anterior ou à mesma. Pela regra atual, motivo é **catálogo controlado**, nunca
texto livre (`DIAG:676`, conflito 8, que é do `DP-FLX-11`); o catálogo de
motivos de devolução seria novo.

### 5.3 Cancelamento

**Fato recebido:** cancelar é permitido "aos usuários autorizados, com
justificativa e histórico da ação" (`RESP:97-102`). Proposta do documento:
cancelar é terminal, com justificativa por catálogo pela mesma regra, e o
registro nunca desaparece, como o cancelamento de hoje (`e2e:2042`).

### 5.4 Quem opera (P3)

**Fato recebido:** o RH recebe, confere e conduz (R7, `RESP:67-69`) e devolve
(R12); RH/DP conferem (etapa 5, R9) e confirmam a efetivação (R11). As etapas 3,
6 e 7 e o cancelamento não têm responsável nas respostas: a ADR as marca como
proposta de operação (`A17:65-91`), e "usuários autorizados" não diz quem. O
gestor continua sem mutação nenhuma (`A17:117-169`).

| Id       | Subalternativa                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **3.i**  | `rh` e `dp` operam todas as transições das etapas 3 a 8, inclusive devolver e cancelar, como hoje operam a admissão inteira. |
| **3.ii** | Distribuir as transições por papel, etapa a etapa, com RH/DP como insumo. Exige perguntar a RH/DP quem faz cada etapa.       |

### 5.5 Auditoria

Proposta do documento: cada transição do processo é um evento de auditoria
próprio, com ator e alvo, na trilha atual, que não guarda valores antes e
depois (`DIAG:677`, conflito 9). O status por etapa da R9 vem da sequência
desses eventos, ou de uma linha do tempo do processo. Cada alternativa diz que
eventos novos exige.

## 6. Alternativas para onde o processo vive (P1)

### 6.1 Alternativa A — estender a movimentação de admissão

A "admissão em andamento" passa a ser **estados novos da própria movimentação
de admissão**. Colaborador, vínculo `previsto` e matrícula continuam nascendo no
início, pelo `POST /v1/colaboradores` atômico de hoje.

| Aspecto               | Como fica                                                                                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estados**           | Da movimentação de admissão: `em_andamento` (com a etapa atual, 3 a 7), `devolvida`, `pronta_para_efetivar`, `efetivada`, `cancelada`, `retificada`. O vínculo segue `previsto` até a ativação.                                                                                                             |
| **Transições**        | `em_andamento` → próxima etapa; `em_andamento` → `devolvida` → `em_andamento`; etapa 7 concluída → `pronta_para_efetivar` → `efetivada`; qualquer estado não terminal → `cancelada`. A máquina atual, que é **uma só para todos os tipos** (`validacao:24-32`), passaria a ter um ramo próprio da admissão. |
| **Cancelamento**      | Cancela a movimentação. **O vínculo `previsto` e a matrícula ficam presos**, como hoje (seção 4). Resolver isso exige um destino para o vínculo nunca ativado — situação nova, migration aditiva —, porque `encerrado` com data de desligamento não descreve vínculo que não começou.                       |
| **Devolução**         | Transição nova da movimentação (seção 5.2).                                                                                                                                                                                                                                                                 |
| **Responsabilidades** | Como hoje: recurso `movimentacao_funcional`, `rh` e `dp` (`rbac:363-367`), com 3.i ou 3.ii.                                                                                                                                                                                                                 |
| **Auditoria**         | Reaproveita `pessoas_movimentacao_*` (`audit:70-81`) e acrescenta ações para avançar etapa, devolver e retomar.                                                                                                                                                                                             |
| **Matrícula**         | Informada no início, como hoje. **Mantém o conflito 2** (`DIAG:670`): matrícula só na efetivação exige identificador provisório ou matrícula opcional no vínculo, o que é do `DP-FLX-10`.                                                                                                                   |
| **Vínculo**           | Existe desde o início, `previsto`. A pessoa em processo já é um Colaborador `inativo`.                                                                                                                                                                                                                      |
| **Lotação**           | Inalterada: o destino fica na movimentação e a alocação nasce na efetivação (`mov.service.ts:301-311`).                                                                                                                                                                                                     |
| **Movimentação**      | A movimentação de admissão **é** o processo.                                                                                                                                                                                                                                                                |
| **Admissão atômica**  | **Compatível, sem mudança**: a decisão 15 e os gatilhos ficam como estão.                                                                                                                                                                                                                                   |

### 6.2 Alternativa B — processo próprio; tudo nasce na efetivação

O processo admissional é uma **entidade própria, com `empresa_id`**. Colaborador,
vínculo, matrícula e movimentação de admissão só nascem quando o processo é
efetivado. O ato atômico de hoje passa a ser o ato de efetivação.

| Aspecto                | Como fica                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estados**            | Do processo: `em_andamento` (com a etapa atual, 3 a 7), `devolvido`, `pronto_para_efetivar`, `efetivado`, `cancelado`. Depois de `efetivado`, valem os estados do vínculo e da movimentação que já existem.                                                                      |
| **Transições**         | As mesmas da A, mas na máquina do processo, que não se mistura com a das outras movimentações. `pronto_para_efetivar` → `efetivado` executa o ato atômico.                                                                                                                       |
| **Cancelamento**       | **Limpo**: cancela só o processo. Não há Colaborador, vínculo nem matrícula para desfazer.                                                                                                                                                                                       |
| **Devolução**          | Transição do processo (seção 5.2).                                                                                                                                                                                                                                               |
| **Responsabilidades**  | Recurso de autorização **novo** para o processo, concedido a `rh` e `dp` (3.i ou 3.ii); gestor negado até o `DP-FLX-02`.                                                                                                                                                         |
| **Auditoria**          | Ações novas, uma por transição do processo, mais as de hoje no ato de efetivação (`audit:70-81`). O histórico das etapas fica no processo, porque antes da efetivação não há vínculo com linha do tempo.                                                                         |
| **Matrícula**          | Nasce na efetivação, o que é o que a R10 pede (`RESP:84-88`). **Dissolve o conflito 2** quanto ao momento (`DOS:915-923`), mas a regra de geração e o identificador provisório continuam no `DP-FLX-10`.                                                                         |
| **Vínculo**            | Não existe antes da efetivação. A pessoa em processo **não é Colaborador**, o que atende a R11 pela estrutura, não só pelo estado.                                                                                                                                               |
| **Lotação**            | O destino fica no processo e é revalidado na efetivação, como hoje (`mov.service.ts:269-271`); a alocação nasce no mesmo ponto em que nasce hoje.                                                                                                                                |
| **Movimentação**       | A movimentação de admissão nasce na efetivação. Com 2.i, já efetivada; com 2.ii, `programada`, e a ativação é a efetivação dela (seção 7).                                                                                                                                       |
| **Admissão atômica**   | **Compatível com a invariante** (não há Colaborador órfão: o processo não é Colaborador e tem empresa própria), mas **muda o momento** da decisão 15: exige emenda à Baseline V1. As admissões `previsto` que já existem não têm processo e precisam de tratamento de transição. |
| **Dados do candidato** | Antes da efetivação só o nome está aprovado. Cada dado a mais do candidato exige ficha (ADR 0016, decisão 5.4; `DOS:301-392`). Análise não verificada: os contatos aprovados na T169 são do **Colaborador**, que em B não existe antes da efetivação.                            |
| **Readmissão**         | Processo para pessoa que já é Colaborador precisaria referenciá-la. Como reconhecer a mesma pessoa é do `DP-FLX-05` e do `DP-FLX-09`; hoje a readmissão é vínculo novo de Colaborador visível no escopo (`vinculo.service.ts:41-51`).                                            |

### 6.3 Alternativa C — processo próprio sobre vínculo `previsto` criado cedo

O processo é uma entidade própria, mas **referencia Colaborador e vínculo
`previsto` criados no cadastro prévio** (etapa 3), pelo ato atômico de hoje. A
efetivação do processo efetiva a movimentação de admissão que já existe.

| Aspecto               | Como fica                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Estados**           | Do processo, como na B. O vínculo fica `previsto` e a movimentação `solicitada` ou `programada` enquanto o processo anda.              |
| **Transições**        | Como na B, mas `pronto_para_efetivar` → `efetivado` efetiva a movimentação de admissão existente.                                      |
| **Cancelamento**      | Cancela o processo e a movimentação. **O vínculo `previsto` e a matrícula ficam presos**, como na A.                                   |
| **Devolução**         | Transição do processo (seção 5.2).                                                                                                     |
| **Responsabilidades** | Recurso novo para o processo, `rh` e `dp` (3.i ou 3.ii); o vínculo já tem escopo pela empresa.                                         |
| **Auditoria**         | Ações novas do processo, mais as de vínculo e movimentação que já existem.                                                             |
| **Matrícula**         | Exigida no cadastro prévio, porque o vínculo já existe e a matrícula é obrigatória (`dto:153-154`). **Mantém o conflito 2**, como a A. |
| **Vínculo**           | Existe desde a etapa 3, `previsto`. A pessoa em processo já é Colaborador `inativo`.                                                   |
| **Lotação**           | Como hoje: destino na movimentação, alocação na efetivação.                                                                            |
| **Movimentação**      | Nasce na etapa 3 e é efetivada no fim do processo.                                                                                     |
| **Admissão atômica**  | **Compatível**: a decisão 15 vale como está, só que usada na etapa 3. O processo é um agregado a mais, ao lado do vínculo.             |

### 6.4 Comparação

Análise do documento.

| Critério                                                 | A                   | B                              | C              |
| -------------------------------------------------------- | ------------------- | ------------------------------ | -------------- |
| Pessoa em processo deixa de ser Colaborador (R11)        | Não                 | **Sim**                        | Não            |
| Matrícula só na efetivação (R10) sem identificador extra | Não                 | **Sim**, quanto ao momento     | Não            |
| Cancelamento sem vínculo e matrícula presos              | Não                 | **Sim**                        | Não            |
| Máquina da admissão separada das outras movimentações    | Não                 | Sim                            | Sim            |
| Decisão 15 da Baseline V1 sem emenda                     | **Sim**             | Não: emenda do momento         | **Sim**        |
| Agregado novo e recurso de RBAC novo                     | Não                 | Sim                            | Sim            |
| Tratamento das admissões `previsto` existentes           | Não precisa         | Precisa                        | Opcional       |
| Dados do candidato antes da efetivação                   | Do Colaborador      | Do processo, cada um com ficha | Do Colaborador |
| Depende de tela própria (`DP-FLX-21`)                    | Não necessariamente | Sim                            | Sim            |

## 7. Ativação na data de início (P2)

Os nomes vêm do dossiê (`DOS:301-392`). Combinam com A, B ou C.

| Id        | Subalternativa                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2.i**   | Manter o de hoje: só se efetiva a partir da data de início, e efetivar ativa no mesmo ato. "Efetivada" e "ativa" continuam sendo o mesmo momento, o que **não** atende a distinção da R11.                                                  |
| **2.ii**  | Efetivar antes da data de início, e tornar o vínculo ativo por **ato explícito** de RH/DP na data ou depois dela. Mantém "nenhum job efetiva sozinho" (`A7:424`). A alocação nasce na ativação, para que todo vínculo ativo tenha alocação. |
| **2.iii** | Ativar **automaticamente** na data, por job. Reabre a decisão de que efetivar é sempre ato explícito, com executor identificado (`A7:424`; `mov.service.ts:224-225`).                                                                       |

**Análise do documento:** em B com 2.ii, o mecanismo de hoje se encaixa sem
mudar de sentido: efetivar o processo faz o ato atômico (Colaborador, vínculo
`previsto`, matrícula e movimentação `programada`), e ativar é a efetivação
explícita dessa movimentação, que já é recusada antes da vigência
(`validacao:247-255`). "Admissão efetivada, aguardando início" vira processo
`efetivado` com vínculo `previsto`.

## 8. Correção depois da efetivação (P4)

**Fato recebido:** depois da efetivação, a correção segue "um fluxo específico,
com registro do responsável e da alteração realizada" (`RESP:97-102`).
**Comportamento atual:** pelo achado D8 da T166, não reproduzido, retificar uma
admissão efetivada não tem saída viável (`T166:104`).

| Id       | Subalternativa                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **4.i**  | Esta decisão só registra o requisito, e o fluxo de correção fica com o `DP-FLX-11` (movimentações ampliadas e correção), junto do achado D8. |
| **4.ii** | Esta decisão define também a correção da admissão efetivada, antes do `DP-FLX-11`.                                                           |

## 9. O que fica proibido até a decisão

Até o `DP-FLX-04` ser decidido, e mesmo depois, até cada gate próprio e pedido
expresso:

- **endpoint** novo ou alterado para processo, etapa, devolução, ativação ou
  cancelamento de admissão;
- **schema e migration**: entidade de processo, estado novo de vínculo ou de
  movimentação, catálogo de motivos de devolução;
- **tela** de processo ou de admissão por etapas (também `DP-FLX-21`);
- **RBAC**: recurso ou permissão nova para o processo;
- **matrícula na efetivação**, identificador provisório ou matrícula opcional
  (`DP-FLX-10`);
- **solicitação pelo gestor** e qualquer mutação dele (`DP-FLX-02`);
- **aprovações** e alçadas (`DP-FLX-03`);
- **ativação automática** por job (seria a 2.iii, que reabre `A7:424`).

O comportamento atual (seção 4) continua valendo como está.

## 10. Pergunta decisória

**Para o `DP-FLX-04`, qual combinação você aprova?**

- **P1** — onde vive o processo: **A**, **B** ou **C**;
- **P2** — ativação: **2.i**, **2.ii** ou **2.iii**;
- **P3** — quem opera: **3.i** ou **3.ii**;
- **P4** — correção pós-efetivação: **4.i** ou **4.ii**.

Uma linha basta, por exemplo: `DP-FLX-04: B; 2.ii; 3.i; 4.i.` A resposta vira um
registro documental em tarefa própria (emenda à Baseline V1 ou ADR do processo
admissional) e **não autoriza código** por si só.

## 11. Recomendação técnica

**Esta recomendação é análise do documento. Não é decisão, não resolve o
`DP-FLX-04` e não autoriza nada.**

**B; 2.ii; 3.i; 4.i.** Por quê:

1. **B** é a única em que a pessoa em processo não é Colaborador, em que o
   cancelamento não deixa vínculo e matrícula presos e em que a matrícula nasce
   na efetivação sem identificador extra no vínculo (seção 6.4). A e C deixam as
   três lacunas e o conflito 2 como estão.
2. O custo de B é real: agregado novo com `empresa_id`, recurso de RBAC novo,
   emenda ao momento da decisão 15, tratamento das admissões `previsto`
   existentes, tela própria (`DP-FLX-21`) e, para cada dado do candidato além do
   nome, ficha de tratamento. Se esse custo pesar mais agora, **C** é a
   alternativa de menor mudança que ainda separa a máquina do processo.
3. **2.ii** é a única que atende a R11 ao pé da letra, com efetivada e ativa
   distintas, sem reabrir a regra de que nenhum job efetiva sozinho. Com B, ela
   reaproveita a efetivação explícita de hoje (seção 7).
4. **3.i** repete o que o RBAC de hoje já concede a `rh` e `dp` e não cria
   permissão para ninguém novo. A 3.ii pode vir depois, com insumo de RH/DP.
5. **4.i** mantém esta decisão do tamanho do gate e põe a correção junto do
   `DP-FLX-11`, que já trata de correção simples e movimentação.

## 12. O que esta decisão não resolve

Nenhum gate é resolvido por este documento. Seguem **abertos** 20 gates —
`DP-FLX-02` a `DP-FLX-20` e `DP-FLX-22`, inclusive o próprio `DP-FLX-04`, o
`DP-FLX-10`, o `DP-FLX-02` e o `DP-FLX-03` —, e 12 dos 13 conflitos com
decisões fechadas. O `DP-FLX-21` foi resolvido pela proprietária na mesma
data, fora deste documento, e com ele o conflito 13, por decisão posterior. Mesmo
decidido, o `DP-FLX-04` não decide a regra da matrícula (`DP-FLX-10`), o papel do
gestor (`DP-FLX-02`), as alçadas (`DP-FLX-03`), os dados de cada etapa
(`DP-FLX-05`, `-06`, `-08`), os documentos (`DP-FLX-14`), a forma dos motivos
(`DP-FLX-11`) nem a tela (`DP-FLX-21`).

## 13. Limites

- Os estados e transições das alternativas são **análise do documento**, para
  comparar modelos. Não são nomes nem enums aprovados.
- O efeito de cancelar uma admissão (vínculo `previsto` preso) vem da **leitura
  do código**; não encontrei teste que cancele uma admissão.
- Não verifiquei como as listagens e a projeção do gestor tratam um Colaborador
  `inativo` com vínculo `previsto`; isso pesa na leitura da R11 para A e C.
- A ambiguidade entre "admissão prevista" e "admissão em andamento" (R11) não é
  resolvida aqui.
- Não verifiquei ambiente de produção nem a existência de admissões `previsto`
  reais.
