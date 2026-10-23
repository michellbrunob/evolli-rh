# Decisão — catálogo de Jornadas de trabalho em Estrutura (T182)

Status: **decidida pela proprietária em 2026-10-23.**
Tarefa que a aplica: T182.
Relacionado: [decisão da T179](t179-confirmacao-admissao-duplicidade-telefones.md)
(decisão 9: fuso horário excluído),
[reconciliação RH/DP](t173-reconciliacao-fluxo-rh-dp.md) (`DP-FLX-22`),
`.specify/tasks.md` (T037: RH único operador de horários).

## 1. A decisão

Em **Estrutura › Jornadas de trabalho**, RH e DP passam a ter um catálogo de
jornadas da empresa ativa: turnos reutilizáveis que, no futuro, serão
associados aos colaboradores.

| Ponto              | Regra                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tela               | Própria, em Estrutura › Jornadas de trabalho; lista da empresa ativa, com busca, estado vazio e status ativo/inativo                                         |
| Quem opera         | **RH** cria, edita e inativa jornadas da própria empresa                                                                                                     |
| DP                 | **Consulta** as jornadas da própria empresa; não cria, não edita, não inativa                                                                                |
| Campos             | Código, nome e a configuração de dias e horários que o contrato já tem (períodos por dia da semana, com início e fim). Nada além disso                       |
| Código             | Obrigatório ao criar e ao editar; letras maiúsculas, dígitos e `_`, de 2 a 32 caracteres; único na empresa. Repetido: erro no campo Código, sem eco do valor |
| Edição de horários | Nome e código sempre editáveis. Dias e horários só enquanto a jornada não tiver **nenhum** vínculo com colaborador; com vínculo, cria-se nova jornada        |
| Inativação         | Lógica, preserva o histórico; nada é excluído fisicamente                                                                                                    |
| Empresa            | Sempre a da sessão; nenhuma jornada vaza entre empresas                                                                                                      |
| Auditoria          | A existente, só com ids e nomes de campos                                                                                                                    |
| Fora               | Associação ao colaborador, banco de horas, escala, adicional noturno, folha, compensação, feriado, ponto, geolocalização e fuso horário                      |

## 2. Fuso horário não faz parte do produto

Decisão da proprietária, já aplicada ao cadastro na T179 (decisão 9) e no
`DP-FLX-22`, e agora estendida às jornadas: **fuso horário não faz parte do
produto**. Horários de jornada são horas locais da operação da empresa, sem
fuso por jornada, por pessoa ou por vínculo, e sem conversão.

## 3. O que já existe e o que muda

Leitura do código em `main` (`b6442f3`):

- O contrato de jornada é a `tabela_horario` (T037): nome, `ativo` e períodos
  (`periodo_horario`: dia da semana de 1 a 7 e minutos de início e fim).
  Rotas em `/v1/horarios`: criar, listar, consultar, desativar e reativar.
  Até aqui havia a aba **Estrutura › Horários**.
- A associação ao colaborador **já existe** (`vinculo_horario`, em Pessoas ›
  Horário). A T182 não a altera.
- **Código** não existia. Decisão da proprietária: **migration aditiva**, com
  coluna `codigo` anulável (as tabelas já gravadas não são tocadas), restrição
  de forma e unicidade por empresa; a tela o exige ao criar e ao editar.
- **Edição** não existia. A T182 cria a edição de nome, código e — só sem
  vínculo — dias e horários.
- **DP** era negado inclusive na leitura de horários (T037). Decisão da
  proprietária: o DP **consulta** as jornadas da própria empresa; criar,
  editar, inativar e reativar continuam só do RH. O `master_tecnico` mantém a
  leitura que já tinha, sem operar.
