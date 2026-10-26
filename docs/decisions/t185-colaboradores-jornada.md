# Decisão — Jornada de trabalho na listagem de Colaboradores (T185)

Status: **escopo definido pela proprietária em 2026-10-26; as duas dúvidas
de regra decididas por ela no mesmo dia, antes da implementação.**
Tarefa que a aplica: T185.
Relacionado: [T183](t183-jornada-colaborador.md) (jornada do colaborador,
com vigência), [T184](t184-colaboradores-cargo-departamento.md) (Cargo e
Departamento na listagem).

## 1. O pedido

Adicionar a coluna **Jornada de trabalho** em Pessoas › Colaboradores, usando
só o vínculo de jornada da T183: a jornada vigente do vínculo principal de
cada colaborador da empresa ativa, com código e nome; "Sem jornada vigente"
para vínculo sem jornada vigente, previsto, encerrado ou com vigência futura;
jornada inativada com a indicação visual.

## 2. O que já existe (leitura de `main`, `398c70a`)

- A jornada fica no `vinculo_horario`, ligado ao **colaborador e à empresa**
  (não ao vínculo funcional), com vigência `[início, fim)`. O banco garante
  que colaborador e jornada são da mesma empresa e que duas vigências do
  mesmo colaborador na mesma empresa nunca se cruzam.
- A API da T183 **não classifica** vigências: devolve início e fim. Quem diz
  "vigente", "programada" e "encerrada" é a ficha, com o **dia civil do
  navegador** (`diaDeHoje`).
- As regras do servidor que usam "hoje" (status da admissão, efetivação)
  usam a data em UTC, que entre 21h e 0h em Brasília já é o dia seguinte.

## 3. Decisões

1. **"Hoje" é o dia civil do navegador** (decisão da proprietária): a
   listagem escolhe a vigência que contém o dia de hoje do mesmo jeito que a
   ficha, e as duas telas nunca divergem. A API devolve só as vigências que
   tocam o intervalo `[hoje UTC − 1 dia, hoje UTC + 1 dia]` — no máximo três
   por colaborador e empresa —, o suficiente para qualquer fuso do navegador,
   sem mandar o histórico inteiro.
2. **A jornada é a do colaborador na empresa do vínculo principal**
   (decisão da proprietária), quando esse vínculo é **ativo**. Com mais de um
   vínculo na mesma empresa, a jornada é a mesma (só existe uma ali).
3. Vínculo principal **previsto ou encerrado** mostra **"Sem jornada
   vigente"**, mesmo que exista vigência de jornada; a API nem projeta
   vigências para vínculo que não está ativo. Vigência **futura** também
   mostra "Sem jornada vigente".
4. **Jornada inativada** aparece com código e nome e a indicação "Jornada
   inativa"; o histórico continua na ficha.
5. A projeção traz só o necessário: início, fim e a jornada (id, código, nome
   e se está ativa). Matrícula, Cargo, Departamento, Situação e Admissão
   continuam vindo do mesmo vínculo principal.
6. **Nenhuma permissão muda:** os papéis que leem a listagem (RH, DP e
   `master_tecnico`) já leem os vínculos de jornada da empresa (T183).
   **Sem migration.**

## 4. Fora de escopo

Banco de horas, saldo, batidas, ponto, cálculo de horas, escala, folha,
adicional noturno, compensação, feriado, geolocalização, fuso horário; campos
novos de cadastro, salário, contrato detalhado, documentos, CPF, dados
bancários, dependentes, saúde; edição de jornada pela listagem; importação,
exportação e integrações externas.
