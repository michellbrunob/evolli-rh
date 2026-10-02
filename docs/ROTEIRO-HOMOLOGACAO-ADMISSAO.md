# Roteiro de homologação — Admissão (T147)

Roteiro curto para o proprietário conferir, no ambiente local, que a admissão
funciona de ponta a ponta e que o registro aparece **coerente** nas três telas
que falam dele.

> **Dado sintético, ambiente local.** Nada aqui toca produção ou homologação, e
> nenhum nome, CPF, PIS ou matrícula real é usado. O ambiente escuta só em
> `127.0.0.1`.

## Antes de começar

Suba o ambiente conforme
[Ambiente local de demonstração](AMBIENTE-DEMONSTRACAO-LOCAL.md):

```bash
pnpm demo:up
```

| Item             | Valor                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Endereço da web  | `http://127.0.0.1:5173`                                                           |
| Endereço da API  | `http://127.0.0.1:3000` (ou a `PORT` que você escolheu)                           |
| Perfil de acesso | `rh.alfa@evolli.local`                                                            |
| Senha            | a senha única dos perfis sintéticos, em **Perfis sintéticos** no guia do ambiente |

Use **RH**, não DP: criar colaborador é capacidade de `rh`.

## O que você deve saber antes (e evita um falso defeito)

**Admitir não ativa ninguém.** Por contrato, `POST /v1/colaboradores` cria o
colaborador como **Inativo**, o vínculo como **Previsto** e registra a
movimentação de **Admissão** como _Solicitada_. O cargo e a lotação vigentes —
a **alocação organizacional** — só passam a existir quando a admissão é
**efetivada** no Histórico funcional.

Isso é desenho, não falha: a admissão é um ato em duas etapas.

## Passo 1 — Admitir

1. Entre como `rh.alfa@evolli.local`.
2. Vá em **Pessoas › Colaboradores**.
3. Clique em **Novo colaborador**.
4. Preencha:

| Campo                             | Valor sugerido                   |
| --------------------------------- | -------------------------------- |
| Nome completo                     | `Pessoa Demo Homologacao`        |
| Matrícula                         | `DEMO-A-0100`                    |
| Tipo de vínculo                   | `CLT`                            |
| Data de admissão                  | **uma data de hoje ou anterior** |
| Tipo de referência organizacional | `Cargo`                          |
| Registro da referência            | `ANALISTA — Analista Demo`       |

> **A data precisa ser passada ou hoje.** Com data futura a movimentação nasce
> _Programada_ e a efetivação do passo 3 é recusada com conflito — você não
> chegaria a ver cargo e lotação vigentes.

5. Clique em **Admitir colaborador**.

**Resultado esperado:** uma confirmação aparece dizendo que o colaborador foi
admitido. Se os filtros da lista estiverem em "Ativo", a própria mensagem avisa
que ele **não** aparece na lista e explica por quê — ela não afirma mais que o
registro está visível quando não está.

A lista é atualizada **sem recarregar a página**.

## Passo 2 — Conferir que o registro existe

Ainda em **Pessoas › Colaboradores**, com o filtro de situação em **Todos**:

- o colaborador aparece na lista, com situação **Inativo**;
- clique em **Ver detalhes**: o vínculo aparece com matrícula `DEMO-A-0100`,
  tipo **CLT**, situação **Previsto** e a data de admissão **no formato de dia**
  (`AAAA-MM-DD`), não como data e hora.

## Passo 3 — Efetivar a admissão

1. Vá em **Pessoas › Histórico funcional**.
2. No filtro de colaborador, escolha `Pessoa Demo Homologacao`.
3. Na linha do tempo, localize a movimentação **Admissão / Solicitada**.
4. Clique em **Efetivar**.

**Resultado esperado:** a movimentação passa a **Efetivada**, o vínculo passa a
**Ativo** e o colaborador passa a **Ativo**.

## Passo 4 — Conferir a coerência nas três telas

| Tela                              | O que conferir                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pessoas › Colaboradores**       | Situação **Ativo**; no detalhe, vínculo **Ativo** e a data de admissão como dia                                                              |
| **Pessoas › Dados contratuais**   | Selecione o colaborador: **Cargo vigente** mostra `ANALISTA — Analista Demo` e a alocação aparece com vigência iniciando na data de admissão |
| **Pessoas › Histórico funcional** | A admissão aparece **Efetivada**, com a mesma vigência, no mesmo formato de dia                                                              |

**O ponto da homologação:** a data de admissão tem de aparecer **igual** nas
três telas. Antes desta tarefa, duas delas mostravam `2026-01-05T00:00:00.000Z`
e a terceira `2026-01-05`.

## Passo 5 — Casos de recusa (opcional, mas vale)

| Tente                                                   | Esperado                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admitir de novo com a matrícula `DEMO-A-0100`           | Recusa por conflito. **Corrija a matrícula e observe que a mensagem de erro continua na tela enquanto você digita** — antes ela sumia ao primeiro caractere |
| Deixar o nome vazio e enviar                            | O erro marca o campo **Nome**                                                                                                                               |
| Escolher o tipo de referência e deixar o registro vazio | O erro marca o **Registro**, não o tipo                                                                                                                     |
| Fechar o modal com dados preenchidos                    | Pede confirmação de descarte; "Continuar editando" preserva o texto                                                                                         |
| Clicar duas vezes rápido em **Admitir colaborador**     | Uma única admissão é criada                                                                                                                                 |

## Passo 6 — Isolamento entre empresas

Saia e entre como `rh.beta@evolli.local`. Em **Pessoas › Colaboradores**, o
colaborador criado na Alfa **não** aparece — e qualquer tentativa de alcançá-lo
diretamente responde "não encontrado", nunca "sem permissão". É deliberado: a
negação não revela que o registro existe.

## Conjunto sintético já pronto

Se preferir conferir sem criar nada, o seed já entrega admissões **efetivadas**:

| Matrícula     | Estado               | Serve para mostrar                               |
| ------------- | -------------------- | ------------------------------------------------ |
| `DEMO-A-0001` | Ativo, **com cargo** | Cargo e lotação vigentes preenchidos             |
| `DEMO-A-0002` | Ativo                | Colaborador com dois vínculos                    |
| `DEMO-A-0003` | **Previsto**         | Vínculo ainda não efetivado, ao lado de um ativo |
| `DEMO-B-0001` | Ativo, na Demo Beta  | Contraprova de isolamento                        |

## O que esta tarefa não entrega

Importação de ponto ou AFD, REP, banco de horas, férias, benefícios, clima,
dependentes, folha, eSocial, obrigações fiscais, anexos/R2, MFA e
autoatendimento do colaborador continuam fora. A admissão por mais de uma
referência organizacional ao mesmo tempo também não existe na tela: a API
aceita, o formulário oferece uma.
