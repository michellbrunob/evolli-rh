# ADR 0014 — Evolli como plataforma-base e encerramento do Frappe HR como candidato

- Status: **Aceito** em 2026-10-01 (01/10/2026), por decisão do proprietário.
- Escopo: escolha da plataforma-base do Evolli RH e encerramento da avaliação do
  Frappe HR como candidato a essa base.
- Relacionado:
  [direção visual B com modais (T142)](../decisions/t142-direcao-visual-b-modais.md),
  [ADR 0009](0009-painel-administrativo-web-v1.md) e
  [ADR 0005](0005-escopo-interno-e-evolucao-multitenant.md).

## Decisão

> **Evolli permanece como plataforma-base. O Frappe HR está encerrado como
> candidato à plataforma e poderá ser usado somente como referência de fluxos,
> portal, aprovações e experiência funcional. O padrão visual B + modais está
> liberado para evolução controlada no Evolli.**

Em consequência:

1. **O Evolli é a plataforma-base oficial** do produto. As fatias seguintes
   continuam sendo construídas sobre a arquitetura já versionada (ADRs 0001–0013).
2. **O Frappe HR está encerrado como candidato à plataforma.** Não há avaliação
   arquitetural aberta sobre ele.
3. **O Frappe permanece disponível como referência conceitual e visual** — fluxos,
   portal do colaborador, cadeia de aprovação e experiência funcional. Referência
   significa ler, comparar e aprender; não significa reaproveitar implementação.
4. **Nenhuma migração** de dados, módulos, esquema ou configuração do Frappe para
   o Evolli será realizada.
5. **Proibido copiar ou adaptar código GPL sem análise específica de licença.** O
   Frappe Framework é MIT, mas **ERPNext e Frappe HR (HRMS) são GPL-3.0**. Qualquer
   reaproveitamento de código, trecho de código, arquivo de definição ou tradução
   dessas bases exige análise jurídica própria **antes** de entrar no repositório.
   Esta ADR não concede essa autorização.

## Contexto

O Frappe HR foi avaliado como possível plataforma-base em duas rodadas, sempre em
ambiente descartável e **somente com dados sintéticos**:

- **Fase 1 (30/09/2026):** instalação isolada, modelo de pessoa e vínculos,
  permissões efetivas, portal, aprovação ponta a ponta e avaliação visual.
- **T143 (01/10/2026):** prova corretiva, para medir se os riscos achados se
  resolviam por configuração ou por extensão pequena, sem alterar o núcleo.

Relatório integral, com evidências, em
`C:/MB/Sistema RH/frappe-prova/RELATORIO-FASE1.md` (fora deste repositório, por
tamanho e por conter ambiente de execução).

### Versões examinadas

| Componente                 | Versão  | Referência                                           |
| -------------------------- | ------- | ---------------------------------------------------- |
| Frappe Framework           | 16.35.0 | MIT                                                  |
| ERPNext                    | 16.36.0 | GPL-3.0                                              |
| Frappe HR (HRMS)           | 16.20.0 | GPL-3.0 — tag `v16.20.0` = `c0a04b80eeb7214…d0da041` |
| frappe_docker (construção) | —       | `f09126b346c5f04a80068d0e34a0ca7c9fdaddb4`           |
| Evolli — base da avaliação | —       | `origin/main` em `f2c1014`                           |

## Evidências determinantes (T143)

1. **Uma conta com vários vínculos exige extensão relevante.** O protótipo
   descartável funcionou sem alterar o núcleo e sem duplicar `user_id`, mas só
   substituindo a resolução global do “Employee da sessão”.
2. **A regra de “Employee único por conta” aparece em vários pontos** do HRMS e do
   ERPNext: retirada automática do papel `Employee` de quem não é `user_id`, guarda
   de rota do portal, trava de autoaprovação, notificações, calendários, avaliação
   de desempenho, transferência de colaborador e relatórios.
3. **Cobertura parcial no protótipo:** 10 de 58 tipos de registro ligados a
   colaborador ficaram restritos ao vínculo selecionado. Os outros 48 continuaram
   sem contexto de vínculo.
4. **Ainda exigiriam adaptação própria:** relatórios, compartilhamentos,
   notificações e cinco endpoints do portal.
5. **Isolamento de queixas e autoaprovação são corrigíveis** — o primeiro por
   configuração mais uma extensão pequena, o segundo só por configuração nativa —
   **mas nenhum dos dois resolve o problema estrutural** do item 1.
6. **Estimativa medida:** aproximadamente **30–50 dias** de desenvolvimento para o
   mesmo escopo de piloto sobre o Frappe.
7. **Ambiente e relatório foram produzidos apenas com dados sintéticos**, em
   instalação isolada publicada só em `127.0.0.1:8080`.

## O que esta decisão NÃO afirma

- **Não afirma que o Frappe HR é inseguro ou inadequado em geral.** O que foi
  medido é o **custo de adaptação ao modelo do Evolli**, que não compensa neste
  projeto. Vários achados da avaliação são próprios do modelo de dados que
  precisávamos impor, e não defeitos do produto para o uso a que ele se destina.
- **Não declara produção, homologação ou conformidade legal** de nenhuma parte do
  Evolli, e não declara o ecossistema concluído.
- **Não autoriza merge, expansão ampla nem alteração de contrato.** Autorizações de
  entrega continuam sendo dadas tarefa a tarefa.
- **Não revoga** nenhuma pendência já registrada (`DP-23`, `BH-01..08`, limiar de
  clima, portões documentais). Folha, eSocial e obrigações fiscais seguem como
  **evoluções futuras**, sem prazo assumido aqui.

## Efeito sobre a direção visual

A aprovação do **padrão visual B + modais**, registrada em
[`docs/decisions/t142-direcao-visual-b-modais.md`](../decisions/t142-direcao-visual-b-modais.md),
**permanece válida** e passa a valer sem a condição arquitetural que a limitava.

A expansão deixa de estar “aguardando decisão sobre o Frappe” e passa a ser
**liberada de forma gradual, tela por tela, com validação visual antes de ampliar**.
Cada tela recebe identificador próprio. `DESIGN-apple.md` continua intocado, como
referência externa (T032).

## Consequências

- O planejamento arquitetural volta a ter uma única base, o que remove a bifurcação
  que condicionava a T142.
- O ambiente de prova do Frappe é encerrado operacionalmente, com volumes, imagens e
  evidências preservados para auditoria.
- Comparações futuras com o Frappe são bem-vindas como **leitura de referência**, e
  cada uma que pretenda reaproveitar implementação volta ao item 5 da Decisão.
