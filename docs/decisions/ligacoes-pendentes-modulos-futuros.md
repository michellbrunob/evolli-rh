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

### 1. Benefícios ↔ Escala

- **Hoje:** a escala calcula os dias de benefício do mês por pessoa (dias
  úteis sem escala, no 5x2 e em "outra"; proporção do modelo nos demais) e os
  mostra na ficha (aba Escala, "Alterar padrão"), na gaveta e no Aplicar
  modelo. Não há módulo de Benefícios no Evolli (o menu prevê Remuneração ›
  Benefícios e Hub de Benefícios).
- **Ponto de ligação:** `diasNoMes` e `beneficioPelosDiasUteis` em
  `apps/web/src/screens/pessoas/ficha/escala/calendarioDaEscala.ts`; uso em
  `AbaEscala.tsx` e `AplicarModeloScreen.tsx`.
- **Ao implementar Benefícios:**
  - os benefícios pagos por dia (vale-transporte, vale-refeição e
    semelhantes) passam a ler os dias da escala da pessoa;
  - decidir com o RH a fonte: o **quadro publicado** (descontando férias e
    ausências aprovadas e feriados) ou a estimativa do padrão, e se o cálculo
    sai do navegador para o servidor;
  - a ficha e o Aplicar modelo passam a mostrar o valor do benefício, não só
    os dias;
  - testes do cálculo com ausência, feriado e troca de escala no meio do mês.

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

## Ligados

Nenhum ainda.
