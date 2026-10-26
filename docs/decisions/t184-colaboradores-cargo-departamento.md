# Decisão — Cargo e Departamento na listagem de Colaboradores (T184)

Status: **escopo definido pela proprietária em 2026-10-26; regra de exibição
decidida por ela no mesmo dia (perguntas sobre vínculo previsto e
encerrado).**
Tarefa que a aplica: T184.
Relacionado: T178 (listagem de Colaboradores), T134 (Dados contratuais),
spec de vida funcional (alocação organizacional com vigência).

## 1. O pedido

Completar Pessoas › Colaboradores com as colunas reais **Cargo** e
**Departamento**: para cada colaborador da empresa ativa, Nome, Matrícula (ou
"Sem matrícula"), Cargo atual, Departamento atual, Situação, Data de admissão
e a ação de abrir a ficha. Cargo e Departamento vêm da lotação vigente do
colaborador, nunca de dado global ou de outra empresa; sem lotação, um estado
claro e neutro.

## 2. Onde o dado já está (leitura de `main`, `0773156`)

- Cargo e Departamento são da **alocação organizacional** do vínculo
  (`alocacao_organizacional`): unidade, departamento, área, equipe, cargo e
  centro de custo, com vigência `[vigente_de, vigente_ate)`.
- A alocação nasce **só na efetivação** de uma movimentação (admissão,
  promoção, transferência…), e a efetivação só acontece quando a vigência já
  chegou. Cada vínculo tem no máximo **uma** alocação aberta. Por isso,
  **lotação vigente = a alocação do vínculo com `vigente_ate` nulo**, a mesma
  leitura da tela de Dados contratuais (T134).
- Cargo e departamento referenciam `(id, empresa_id)`: a alocação nunca aponta
  para cargo ou departamento de outra empresa.
- A listagem (`GET /v1/colaboradores`) devolvia só matrícula, situação e
  datas do vínculo; a lotação só saía por `GET /v1/vinculos/:id/alocacoes`,
  vínculo a vínculo.

## 3. Decisões

1. **Só a lotação vigente** (decisão da proprietária). Vínculo **previsto**
   (admissão registrada e ainda não efetivada) não tem lotação vigente: a
   listagem mostra **"Sem lotação vigente"**. O Departamento e o Cargo
   escolhidos na admissão continuam como destino planejado da movimentação,
   visíveis na ficha, e passam a aparecer na listagem quando a admissão for
   efetivada.
2. **Vínculo encerrado** (desligado) também mostra **"Sem lotação vigente"**
   (decisão da proprietária); a última lotação fica no histórico.
3. As colunas usam o **vínculo principal** do colaborador na empresa ativa —
   o mesmo de Matrícula e Admissão (ativo, depois previsto, depois o mais
   recente).
4. A API passa a projetar, em cada vínculo da listagem, a lotação vigente com
   **só** id, código e nome do cargo e do departamento — nada além do que os
   leitores da listagem (RH, DP e `master_tecnico`) já leem. Lotação vigente
   sem cargo ou sem departamento mostra "Não informado" naquela coluna.
5. **Nenhuma permissão muda.** Os papéis que leem a listagem já leem
   alocação, cargo e departamento; gestor, colaborador e financeiro seguem sem
   acesso à listagem.
6. **Sem migration** e sem dado de negócio novo.

## 4. Fora de escopo

Banco de horas, ponto, batidas, cálculos, escala, folha, compensação, fuso
horário; campos novos de cadastro, salário, contrato detalhado, documentos,
CPF, dados bancários, dependentes, saúde; edição de cargo ou departamento pela
listagem; importação, exportação, envio de links e integrações externas.
