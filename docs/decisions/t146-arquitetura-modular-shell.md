# Arquitetura modular e shell do Evolli RH (T146)

**Estado:** **protótipo em validação visual**. Este documento registra a
arquitetura da informação proposta e o protótipo que a demonstra. **Não aprova
tela alguma, não autoriza implementação, merge, produção nem dado real.**

> **Aprovar o mapa modular não aprova nenhuma tela.** O protótipo mostra como o
> ecossistema se organiza, não o que ele já faz. O que cada tela faz hoje está
> no inventário real, mais abaixo, e aparece marcado dentro do próprio
> protótipo.

## Decisão a ser validada pelo proprietário

Organizar os módulos, a navegação e as janelas do Evolli com a maturidade de
arquitetura da informação observada na prova do Frappe HR (T143), **preservando
integralmente a identidade Evolli, o padrão visual B e o uso de modais já
aprovados** na [decisão da T142](./t142-direcao-visual-b-modais.md).

Esta tarefa cria **somente documentação e protótipo isolado**. Nenhuma tela
funcional foi redesenhada ou alterada.

## O Frappe como referência conceitual, nos limites da ADR 0014

A [ADR 0014](../adr/0014-evolli-plataforma-base-e-encerramento-do-frappe.md)
mantém o **Evolli como plataforma-base** e encerra o Frappe HR como candidato,
liberando-o apenas como referência de fluxos e experiência. Esta tarefa opera
dentro desse limite, e **não reabre a decisão de plataforma**.

**O que foi aproveitado — conceitos, e só conceitos:**

- workspace próprio por módulo, em vez de uma lista plana de telas;
- agrupamento da navegação por natureza de uso;
- atalhos para as ações mais frequentes do módulo;
- listas com filtros organizados em bloco próprio;
- fila de pendências visível no workspace;
- visão geral do ecossistema como porta de entrada.

**O que não foi aproveitado, e não poderia ser:** nenhum código, HTML, CSS,
componente, texto, ícone, imagem ou ativo. Nenhuma dependência de Frappe,
ERPNext ou qualquer outra foi adicionada. A ADR 0014 lembra que ERPNext e
Frappe HR são **GPL-3.0** e que reaproveitar qualquer artefato dessas bases
exigiria análise jurídica própria — análise que esta tarefa não pede nem
dispensa, porque simplesmente não copia nada.

## Mapa modular

Nove módulos operacionais. A ordem é de uso, não de importância.

| #   | Módulo                      | Submódulos                                                                                         |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Início**                  | visão geral do ecossistema                                                                         |
| 2   | **Pessoas**                 | Colaboradores · Admissão · Dados contratuais e vínculos · Histórico funcional · Documentos         |
| 3   | **Jornada**                 | Marcações · Visão do período · Horários e escalas · Ajustes · Banco de horas · Espelho de ponto    |
| 4   | **Ausências**               | Férias · Afastamentos · Atestados · Licenças                                                       |
| 5   | **Solicitações**            | Central · Fila de análise · Histórico                                                              |
| 6   | **Benefícios**              | —                                                                                                  |
| 7   | **Clima e desenvolvimento** | —                                                                                                  |
| 8   | **Relatórios**              | —                                                                                                  |
| 9   | **Administração**           | Estrutura organizacional · Cargos · Centros de custo · Horários · Contas e acessos · Configurações |

### Fora da navegação operacional

**Folha de pagamento, eSocial e obrigações fiscais** aparecem somente numa seção
de **evolução futura**, separada da navegação. A separação é deliberada: um item
no menu é lido como capacidade existente, e nenhum desses três existe. Colocá-los
na navegação criaria expectativa que o produto não sustenta.

## Inventário real

Derivado **nesta tarefa** a partir de `apps/web/src/screens/` e da navegação —
não reaproveitado de texto anterior. O critério é objetivo: a tela fala com a API
real ou usa dados de exemplo no próprio código.

| Estado            | Quantidade | Significado                                                                                  |
| ----------------- | ---------- | -------------------------------------------------------------------------------------------- |
| **Funcional**     | **11**     | Lê e grava pela API real, persiste no banco e respeita RBAC do servidor.                     |
| **Parcial**       | **1**      | Consulta real, sem operação de escrita nesta fatia.                                          |
| **Demonstrativo** | **33**     | Superfície visual com dados de exemplo no próprio código. Não persiste e não consulta a API. |
| **Planejado**     | —          | Módulo previsto no mapa que ainda não tem tela.                                              |

**Total de telas folha hoje: 45.**

As 11 funcionais: `Pessoas › Colaboradores`, `Horário de trabalho`,
`Histórico funcional`, `Documentos` e `Solicitações`; `Jornada › Visão do
período`; `Administração › Estrutura organizacional`, `Cargos`,
`Centros de custo` e `Horários`; e `Contas e acessos`.

A única parcial é `Pessoas › Dados contratuais`: lê vínculos, alocações e linha
do tempo pela API, mas não grava nesta fatia.

**Nenhum indicador do protótipo sugere produção ou homologação.** A legenda é
escrita para quem não é técnico, e a identificação "Protótipo sintético — não
grava dados" é permanente em todas as telas.

## Padrões adotados

### Workspace de módulo

Cada módulo tem uma página própria com, nesta ordem:

1. **cabeçalho** com o nome do módulo e uma frase do que ele resolve;
2. **estado real** do módulo, somando as telas por estado;
3. **atalhos** para as ações mais frequentes;
4. **pendências** — o que espera ação de alguém;
5. **lista** das telas do módulo, cada uma com o seu estado.

A ordem não é arbitrária: quem abre um módulo quer primeiro saber o que precisa
de ação, e só depois navegar.

### Listas

Filtros em bloco próprio acima da lista, como na T142. Densidade confortável,
menos colunas visíveis e mais respiro por linha. A lista de Colaboradores do
protótipo é navegável de verdade: filtra e abre detalhe.

### Modais

Mantidos exatamente como a T142 aprovou e a T144 endureceu:

- **cadastro, detalhe e ações operacionais usam modal** — nunca drawer, nunca
  painel lateral, nunca folha inferior;
- **centralizado no desktop**, tela cheia em 375 px;
- nome acessível, foco inicial na janela, **foco preso** e devolução ao
  acionador;
- `Escape` fecha, mas com alteração não salva abre **confirmação de descarte
  dentro da própria janela**;
- clique no fundo **não** descarta trabalho;
- fundo sem rolagem e fora de alcance; conteúdo longo rola **dentro** do modal.

## Estado funcional ≠ aparência do protótipo

Esta é a distinção que o documento existe para fixar.

O protótipo desenha **todos** os módulos do mapa, inclusive os que não têm uma
linha de código. Isso é proposital: é assim que se discute arquitetura da
informação. Mas significa que **a aparência do protótipo não é evidência de
capacidade**.

Por isso cada tela e cada módulo carregam o seu estado real, a legenda explica
os quatro estados em linguagem comum, e a identificação de protótipo sintético
nunca sai da tela. Um módulo pode parecer completo no protótipo e estar marcado
como **Planejado** — e as duas coisas são verdadeiras ao mesmo tempo.

## Regras para incluir um módulo no futuro

Um módulo novo entra na navegação operacional quando, e somente quando:

1. tiver **identificador próprio** de tarefa e decisão registrada;
2. tiver ao menos uma tela **funcional** — API real, persistência e RBAC do
   servidor;
3. tiver passado por **validação visual** do proprietário;
4. tiver o seu estado refletido no inventário e no guia visual.

Até lá, ele vive na seção de evolução futura. **Nunca** se antecipa um módulo na
navegação "para já deixar pronto": o menu é leitura de capacidade.

## Estratégia de expansão

**Uma tela funcional por vez, com aprovação visual antes da seguinte.** É a mesma
regra da T142, e ela não muda aqui. A T146 não escolhe a próxima tela e não
inicia expansão alguma — ela organiza o mapa para que essa escolha seja
informada.

## Critérios de aceite

- [ ] O mapa modular representa os nove módulos e os submódulos listados.
- [ ] Folha, eSocial e obrigações fiscais ficam fora da navegação operacional.
- [ ] Todo módulo e toda tela exibem estado real, com legenda compreensível.
- [ ] O protótipo navega entre todos os módulos, com sidebar recolhível e
      navegação móvel.
- [ ] Ao menos uma lista é navegável de verdade, com filtro e detalhe.
- [ ] Cadastro, detalhe e confirmação acontecem em modal, com foco preso,
      devolução de foco e confirmação de descarte.
- [ ] Sem rolagem horizontal em 1280 px e 375 px.
- [ ] Nenhuma dependência, framework, CDN, fonte ou ativo externo.
- [ ] Nenhuma chamada de rede, nenhuma persistência, nenhum dado real.
- [ ] Identificação de protótipo sintético permanente.
- [ ] Nenhuma tela funcional de `apps/web` alterada.

## Segunda versão visual — auditoria com o UI UX Pro Max

### Referência metodológica

A 2ª versão do protótipo passou por auditoria usando a skill
[`ui-ux-pro-max`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT)
como **ferramenta de consulta**, instalada fora do versionamento desde a T142.
Ela foi usada **somente em leitura**, pelo buscador local, nas consultas de
painel corporativo de RH, admin B2B, densidade de dados, navegação lateral,
tabelas e filtros responsivos, modal e validação acessíveis, estouro de selo,
estados vazios, aplicação móvel e acessibilidade.

**Ela não virou dependência do projeto**, nenhum arquivo dela foi versionado e o
design system que ela gera **não foi persistido**. Cada recomendação passou pelo
filtro das decisões já vinculantes do Evolli antes de virar código.

### Princípios aceitos

- **Acessibilidade em primeiro lugar** — contraste, foco visível, operação por
  teclado e alvo de toque adequado valem mais que qualquer escolha estética.
- **Rótulo compacto não quebra linha** — selo e contador ficam numa linha só,
  com o texto completo disponível, em vez de embolar em duas.
- **Erro junto do campo**, validado ao sair dele, não só ao enviar.
- **Estado vazio orienta** — diz o que aconteceu e oferece a saída, em vez de
  deixar a área em branco.
- **Tabela larga vira lista no celular**, em vez de empurrar rolagem lateral.
- **Densidade de painel operacional** — menos moldura, mais informação por tela,
  cabeçalho de tabela fixo, tipografia compacta mas legível.
- **Rótulo visível em todo campo**, nunca só `placeholder`.
- **Ícone nunca sozinho** — sempre acompanha texto, e nunca é emoji.

### Sugestões rejeitadas, e por quê

- **Adotar os tokens e componentes do Shopify Polaris** (resultado de maior
  pontuação para "admin B2B"): importaria a identidade de outro produto. O
  Evolli tem tokens próprios, e a ADR 0014 e a decisão da T142 são vinculantes.
- **Modo escuro (OLED)** como estilo secundário: os tokens do Evolli declaram
  `color-scheme: light`. Mudar isso é decisão de produto, não de protótipo.
- **Paleta de dados para gráficos**: não há gráfico no escopo, e cores novas
  violariam a paleta aprovada.
- **"Export functionality"** da lista do estilo data-dense: o protótipo não
  exporta nada, e sugerir isso daria aparência de capacidade inexistente.
- **Presets de animação GSAP**: dependência externa, proibida aqui.
- **Ações em massa com seleção múltipla**: útil num produto real, mas no
  protótipo seria encenação de operação que não existe.

### Critérios visuais da 2ª versão

1. **Hierarquia por peso e espaço, não por moldura.** A 1ª versão embrulhava
   tudo em cartão com borda e o olho não tinha onde pousar. A borda virou
   exceção.
2. **Um número manda.** O que já funciona ganha escala tipográfica própria; o
   restante é contexto, com barra de proporção e legenda — não três caixas de
   mesmo peso.
3. **Ordem por prontidão.** Os módulos aparecem na ordem do que dá para usar,
   não em grade alfabética uniforme, e o que tem tela funcional ganha realce.
4. **Uma ação primária por contexto**, no cabeçalho, sem competir com atalhos.
5. **Ícones de sistema.** Os glifos tipográficos (◉ ◎ ◷) viraram SVG em traço,
   desenhados no próprio protótipo, na mesma caixa e no mesmo peso.
6. **Contadores na navegação** (funcionais/total) para o estado ser legível sem
   entrar no módulo.
7. **Espaço horizontal aproveitado** — a grade acompanha a largura em vez de
   espremer colunas iguais num contêiner estreito.
8. **375 px tem solução própria**, não é o desktop encolhido: a tabela dá lugar
   a cartões.

### Nada externo foi incorporado

Nenhuma identidade, código, CSS, componente, ícone, imagem, fonte ou ativo de
terceiros entrou no protótipo. Os ícones são SVG desenhados aqui; os tokens vêm
do próprio Evolli; não há dependência, framework, CDN ou fonte externa. A skill
foi consultada e descartada depois do uso.

## Decisão do proprietário — aprovação visual e congelamento da fundação

> "Aprovo a evolução visual da T146, porém devemos focar agora na entrega dos
> módulos funcionais e testados, deixando o acabamento visual final para o
> fim."

**Interpretação vinculante:**

- a arquitetura modular, o shell, os tokens, o padrão B, a sidebar e os modais
  ficam **aprovados como fundação visual**;
- a fundação visual fica **congelada**;
- não haverá expansão ou redesenho amplo agora;
- durante a implementação dos módulos, somente correções necessárias de
  usabilidade, acessibilidade, responsividade ou bloqueio operacional poderão
  alterar a interface;
- refinamento estético, uniformização completa e acabamento visual final ficam
  para uma etapa posterior;
- a prioridade passa a ser entregar **módulos funcionais, testados e
  homologáveis com dados sintéticos**;
- **nenhuma aparência de protótipo constitui prova de capacidade funcional** —
  o inventário real (11 funcionais, 1 parcial, 33 demonstrativas) continua
  sendo a única fonte da verdade sobre o que já funciona.

Esta aprovação é **visual**, não de integração: a T146 segue **não integrada**
e a PR #137 segue **Draft**, aguardando a revisão final. O protótipo isolado em
`docs/prototipos/t146/` não muda com esta decisão — ela só congela o que já
existe como base e redireciona o esforço seguinte para módulos funcionais.

## Limites e fora de escopo

- **Não implementa** folha, eSocial, férias, benefícios ou clima.
- **Não inicia** a expansão do padrão B para outro módulo.
- **Não altera** `apps/api`, Prisma, migrations, contratos HTTP, regras, RBAC
  ou dados.
- **Não altera** nenhuma tela funcional de `apps/web`.
- **Não altera** `DESIGN-apple.md`, que segue intacto por decisão da T032.
- **Não habilita** dado real, produção ou homologação.
- **Não reabre** a decisão de plataforma da ADR 0014.
- **Não reabre** a fundação visual aprovada acima: só correção necessária de
  usabilidade, acessibilidade, responsividade ou bloqueio operacional a
  altera antes do acabamento final.
