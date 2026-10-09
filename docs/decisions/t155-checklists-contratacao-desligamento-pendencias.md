# T155 — Checklists de contratação e desligamento: investigação e decisões pendentes

- Status: **investigação em curso; não autoriza implementação**.
- Data: 2026-10-09.
- Responsáveis pela decisão: RH (processo e responsáveis), Produto (prioridade e experiência),
  Jurídico/DPO quando houver dado pessoal adicional ou evidência sensível.

## 1. Objetivo

Preparar um checklist operacional para acompanhar tarefas de contratação e desligamento. O objetivo
é dar visibilidade a pendências e responsáveis, sem transformar o checklist em motor trabalhista,
aprovação implícita ou bloqueio automático da vida funcional.

## 2. Contratos existentes confirmados

- A admissão cria, numa transação, colaborador, primeiro vínculo e movimentação de admissão.
- A efetivação da admissão ativa o vínculo; a efetivação do desligamento encerra o vínculo.
- Movimentações são registradas, canceladas antes da efetivação, efetivadas explicitamente ou
  retificadas; não há exclusão física nem workflow genérico de aprovação.
- O domínio atual não possui checklist, modelo de tarefa, template, responsável, prazo ou evento de
  conclusão.
- Documentos existem apenas como metadados. Upload, download e assinatura continuam bloqueados pelas
  decisões de Documentos; o checklist não pode contornar esses portões.

## 3. Recorte proposto para uma V1, ainda não aprovada

Se RH aprovar, a primeira versão deve registrar apenas:

1. um checklist vinculado a uma contratação ou desligamento identificado;
2. uma origem declarada (template escolhido) e itens copiados para preservar o histórico;
3. título operacional, responsável, prazo e estado de cada item;
4. conclusão, dispensa ou reabertura com ator, data/hora e justificativa controlada;
5. visão restrita à empresa e aos papéis aprovados; e
6. auditoria transacional das mutações relevantes.

Não estão propostos nesta V1: anexos, arquivos, assinatura, texto livre sobre saúde, cálculo de aviso,
verbas, folha, eSocial, envio de e-mail, notificações automáticas, integrações, aprovação automática
ou bloqueio da efetivação do vínculo.

## 4. Perguntas para RH decidir

1. Quais são os checklists mínimos de contratação e de desligamento na operação atual?
2. Cada empresa usa o mesmo modelo ou pode manter templates próprios?
3. Quais itens são obrigatórios, quais são opcionais e quais são apenas recomendados?
4. Quem pode ser responsável por cada item: RH, gestor, DP, TI, Financeiro, outra área ou pessoa
   específica?
5. O prazo de cada item é definido manualmente ou relativo à data de admissão/desligamento? Se for
   relativo, qual regra exata e quem a aprova?
6. A efetivação de admissão ou desligamento deve continuar independente do checklist, ou algum item
   deve bloquear esse ato? Se houver bloqueio, qual item, em qual cenário e quem pode autorizar a
   exceção?
7. Quais estados um item pode ter além de pendente e concluído (por exemplo, dispensado, cancelado,
   impedido)? Qual justificativa é obrigatória em cada transição?
8. Quem pode concluir, dispensar, reabrir ou alterar um item? A mesma pessoa pode criar e dispensar?
9. Que evidência é necessária para concluir um item? Ela pode ser somente uma confirmação estruturada
   nesta fase, sem anexos/documentos, ou há dependência de conteúdo documental futuro?
10. Quem pode visualizar cada checklist e seus itens: RH, DP, gestor, colaborador, áreas de apoio?
11. Existem dados que jamais podem aparecer no checklist ou na justificativa, como saúde, CID,
    remuneração ou motivo jurídico do desligamento?
12. Como tratar readmissão, cancelamento antes da efetivação e retificação de movimentação já
    efetivada?

## 5. Critério para iniciar implementação

O código só pode iniciar depois de as respostas acima definirem o fluxo mínimo, a matriz de acesso,
os dados permitidos e a regra explícita de vínculo — ou independência — entre checklist e efetivação.
Essas respostas serão registradas como decisão de RH e convertidas em especificação, plano, modelo de
dados, permissões, auditoria e critérios de aceite próprios.

## 6. Referência de mercado

Pesquisas de mercado podem inspirar a separação visual entre contratação e desligamento e o conceito de
template operacional. Elas não definem regras do Evolli, não autorizam cópia de interface, conteúdo,
código ou regras privadas de terceiros, e não substituem as decisões de RH acima.

O inventário ampliado de capacidades de Gestão de Talentos observadas como
referência está em [Mapa funcional de Gestão de Talentos](t155-mapa-funcional-gestao-talentos-referencia-mercado.md).
Ele mantém a mesma limitação: é insumo para decisão, não requisito aprovado.
