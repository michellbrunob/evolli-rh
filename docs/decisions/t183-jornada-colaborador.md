# Decisão — Jornada de trabalho do colaborador, com vigência (T183)

Status: **escopo definido pela proprietária em 2026-10-26; desenho técnico
registrado nesta decisão.**
Tarefa que a aplica: T183.
Relacionado: [decisão da T182](t182-jornadas-trabalho.md) (catálogo de
Jornadas de trabalho), `.specify/tasks.md` (T037 e T038: tabela de horário e
vínculo com vigência).

## 1. O que a proprietária pediu

Associar uma Jornada de trabalho **existente** ao colaborador, na empresa
ativa, com data de início de vigência e histórico consultável.

| Ponto         | Regra                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RH            | Atribui, troca e encerra a jornada vigente de um colaborador da empresa ativa                                                                                                                                                                                                            |
| DP            | Consulta a jornada e o histórico; não altera                                                                                                                                                                                                                                             |
| Ficha         | Mostra a jornada atual e o histórico de vigências                                                                                                                                                                                                                                        |
| Nova admissão | Permite escolher uma jornada existente; **opcional** nesta entrega                                                                                                                                                                                                                       |
| Seleção       | Só jornadas **ativas** para novos vínculos; o histórico mostra jornadas inativadas, com a indicação                                                                                                                                                                                      |
| Integridade   | Isolamento estrito por empresa; auditoria sem valores; erros por campo sem ecoar dados; digitado preservado                                                                                                                                                                              |
| Fora          | Ponto, batida, banco de horas, cálculo, escala, folga, feriado, adicional noturno, compensação, folha, geolocalização, fuso horário, salário, contrato detalhado, CPF, documentos, banco, dependentes, saúde, dados pessoais novos e qualquer permissão além de RH editar e DP consultar |

## 2. O que já existe (leitura de `main`, `3879656`)

A associação já tem modelo e contrato desde a T037/T038 — o
**`vinculo_horario`** (colaborador, empresa, jornada, `vigencia_inicio`,
`vigencia_fim`), com rotas em `/v1/horarios/vinculos` (criar, listar,
consultar, encerrar) e a aba Pessoas › Horário de trabalho. As garantias de
vigência estão **no banco**:

- **Vigência** é o intervalo `[vigencia_inicio, vigencia_fim)`: o início
  conta, o fim não. `vigencia_fim` nulo é "sem fim" (vigente). CHECK: o fim,
  quando existe, é posterior ao início.
- **Sem sobreposição:** `EXCLUDE USING gist (colaborador, empresa,
daterange(início, fim, '[)') WITH &&)`. Dois períodos do mesmo colaborador
  na mesma empresa nunca se cruzam; períodos **adjacentes** (o fim de um é o
  início do outro) não conflitam — é assim que a troca fecha o anterior.
- **Uma única vigência aberta** por colaborador e empresa (índice único
  parcial em `vigencia_fim IS NULL`).
- **Mesma empresa:** a jornada referencia `(id, empresa_id)` da tabela de
  horário, e um CONSTRAINT TRIGGER exige vínculo funcional do colaborador na
  mesma empresa.
- **Histórico preservado:** o papel da aplicação não tem `DELETE` em
  `vinculo_horario`; encerrar é gravar `vigencia_fim`.

**Por isso a T183 não precisa de migration**: o modelo já representa
vigência e impede sobreposição. O que falta é contrato e interface.

## 3. A decisão técnica

1. **Atribuir e trocar numa operação só:**
   `POST /v1/horarios/vinculos/atribuicoes` com `colaboradorId`,
   `tabelaHorarioId` e `vigenciaInicio`. Sem jornada vigente, cria a
   vigência. Com jornada vigente, **na mesma transação**, encerra a vigente
   no novo início e cria a nova — adjacentes, sem lacuna nem sobreposição.
   - O novo início precisa ser **posterior** ao início da vigente.
   - Trocar para a mesma jornada vigente é recusado.
   - Na trilha: `horarios.vinculo.encerrado` (a anterior, se houver) e
     `horarios.vinculo.criado` (a nova); só ids.
2. **Encerrar** continua em `POST /v1/horarios/vinculos/:id/encerrar`. A data
   informada é o **primeiro dia sem a jornada** (o fim não conta).
3. **Só jornadas ativas** recebem vínculo novo (atribuir, trocar e admissão).
   Jornada inexistente na empresa ativa ou inativa respondem igual —
   `tabelaHorarioId` indisponível — para não revelar o que existe em outra
   empresa.
4. **Erros por campo, sem valor:** recusa de regra responde 422 com
   `erros: [{campo, motivo}]`; vigência que cruza outra responde 409 com o
   campo. Motivos fechados: `indisponivel`, `igual_a_vigente`,
   `fora_de_ordem`, `ja_encerrada`, `sobreposta`.
5. **DP consulta** os vínculos da própria empresa (`vinculo_horario` read),
   como já consulta as jornadas (T182). Criar, trocar e encerrar seguem só do
   RH. Nenhuma outra permissão muda.
6. **A projeção do vínculo traz a jornada** (`id`, `codigo`, `nome`,
   `ativo`), para o histórico mostrar a jornada e se ela foi inativada.
7. **Nova admissão:** campo opcional `tabelaHorarioId`. Informado, a
   admissão cria, **na mesma transação**, a vigência a partir da data de
   admissão. Só o RH o envia — o DP admite, mas não altera jornada; se o
   campo vier de outro papel, a admissão inteira é negada, sem gravar nada.
   A idempotência da admissão confere também a jornada.
8. **Jornada atual na tela:** a vigência que contém o dia de hoje (data civil
   do navegador; fuso horário não faz parte do produto). Uma vigência que
   começa depois de hoje aparece como **programada**.

## 4. Interface

- **Ficha do colaborador:** seção "Jornada de trabalho" com a jornada atual
  (ou programada) e o histórico de vigências, com a indicação de jornada
  inativada. O RH atribui, troca e encerra ali; os demais só consultam.
- **Pessoas › Horário de trabalho:** consulta para quem não opera; criação e
  encerramento só para o RH.
- **Nova admissão:** "Jornada de trabalho (opcional)", só para o RH, com as
  jornadas ativas da empresa.

## 5. Pendências registradas

- A aba Pessoas › Horário de trabalho (T112) continua pedindo, no
  encerramento, o primeiro dia **sem** a jornada ("Encerrar vigência em");
  a ficha pergunta o **último dia** com ela. As duas gravam a mesma coisa;
  alinhar o texto da aba antiga fica para decisão.
- O início da jornada não é comparado à data de admissão: o banco só exige
  vínculo funcional na empresa. Se a jornada deve começar na admissão ou
  depois, é regra a decidir.
- Não há usuário de demonstração do perfil financeiro; a recusa a ele é
  provada nos testes de API.
