# Ligações pendentes com módulos futuros

Registro de 26/11/2026. Partes do Evolli prontas que dependem de um módulo
(ou de um cadastro) que **ainda não existe**. Cada linha diz o que já está
feito, onde fica o ponto de ligação e o que fazer **na mesma entrega** em que
o módulo for implementado.

## Regra

- Ao abrir a especificação de um módulo desta lista, a ligação entra no
  escopo dele. Não vira tarefa separada nem fica para depois.
- A entrega que fizer a ligação atualiza esta página: marca o item como
  ligado, com a tarefa e o commit.
- Nada daqui começa sem ordem; esta página só garante que a ligação não se
  perde.

## Pendentes

### 2. Contrato intermitente ↔ aviso de convocação (CLT, art. 452-A)

- **Hoje:** o aviso "Intermitente convocado com menos de 3 dias" existe nas
  Regras da escala (ligado por padrão, categoria Atenção), mas nada o
  dispara: o cadastro não tem o tipo de vínculo intermitente (nem a
  referência).
- **Ponto de ligação:** enum `TipoVinculo` em `apps/api/prisma/schema.prisma`;
  chave `intermitente` em `apps/api/src/pessoas/escala/escala-regras.service.ts`,
  `apps/web/src/api/escalaClient.ts` e
  `apps/web/src/screens/horarios/quadro/avisosDaEscala.ts`; texto da linha
  em `RegrasDaEscalaScreen.tsx`.
- **Ao criar o tipo Intermitente no cadastro:**
  - disparar o aviso quando um dia de trabalho de pessoa intermitente for
    publicado com menos de 3 dias corridos de antecedência;
  - trocar o texto "o Evolli ainda não tem contrato intermitente" pela regra;
  - rever os demais avisos e limites que dependem do vínculo (tempo parcial,
    horas por semana, férias);
  - testes do aviso e prova de mutação.

### 3. Aviso da publicação da escala ↔ Portal e e-mail

- **Hoje:** ao publicar, o pedido de avisar as pessoas fica registrado na
  publicação, mas não é enviado: não há Portal do colaborador nem envio de
  e-mail.
- **Ponto de ligação:** `apps/api/src/pessoas/escala/escala-publicacao.service.ts`
  (registro da publicação) e `apps/web/src/screens/horarios/quadro/DialogoPublicar.tsx`
  (opção de avisar).
- **Ao implementar o Portal ou o envio de e-mail:**
  - enviar o aviso às pessoas com dias novos, alterados ou removidos no
    período publicado;
  - mostrar na publicação se o aviso saiu, com falha e reenvio;
  - testes do envio e da trilha de auditoria (sem dado pessoal no log).

### 4. Férias e políticas de férias ↔ Portal do colaborador e do gestor

- **Hoje:** o RH registra e responde ausências (aprovar, sugerir outras
  datas, recusar) e cadastra políticas de férias. Fica gravado, mas sem quem
  use do outro lado: a aprovação pelo gestor (`aprovacao.quem` = gestor ou
  gestor e RH) e o lembrete (`aprovacao.lembreteDias`); o texto da política
  para o colaborador (`textoColaborador`); o bloqueio de pedido fora da
  política (`aprovacao.foraDaPolitica` = bloquear), que vale para o pedido
  do colaborador; e a sugestão de datas (`sugestao_inicio`/`sugestao_fim`),
  que o colaborador ainda não tem onde aceitar.
- **Ponto de ligação:** `apps/api/src/pessoas/ausencias/politicas-ferias.service.ts`
  (`politicaDaPessoa`, `avaliar`), `apps/api/src/pessoas/ausencias/ausencias.service.ts`
  (registrar, sugerir, aprovar, recusar) e
  `apps/web/src/screens/pessoas/ferias/ResponderAusenciaJanela.tsx`.
- **Ao implementar o Portal:**
  - pedido de férias pelo colaborador, conferido pela política (avisar ou
    bloquear) e com o texto da política à vista;
  - fila do gestor quando a política manda o pedido para ele, com o
    lembrete depois dos dias definidos;
  - aceitar ou recusar a sugestão de datas do RH;
  - "Pedido além do saldo: aceitar" segue sem efeito para CLT: o servidor
    recusa férias acima do saldo (regra da lei mantida). Decidir com o RH se
    a opção sai da política ou ganha regra própria (antecipação);
  - testes de cada caminho e da trilha de auditoria.

## Ligados

### 1. Benefícios ↔ Escala — ligado na T215 (módulo Benefícios)

- O servidor calcula os dias de cada pessoa no mês
  (`apps/api/src/pessoas/beneficios/dias-beneficio.ts`): dias úteis sem os
  feriados nacionais, os do estado da empresa e os municipais das Regras da
  escala; "pela escala" usa os dias de trabalho PUBLICADOS no quadro e, sem
  publicação no mês, a proporção do modelo do cadastro (12x36 = 15, 6x1 = 26).
- A ficha (aba Benefícios) mostra o custo de cada benefício; o RH ajusta dias
  e valor por pessoa no mês, no detalhe do benefício.
- Fica pendente com a **Folha de pagamento** (módulo futuro): lançar o
  desconto e o adicional no holerite e fechar a competência ("folhas fechadas
  não mudam"); hoje toda competência é "valores previstos". E com o
  **Portal**: mostrar os benefícios da pessoa (Pausado/Encerrado).
