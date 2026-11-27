# Design System Evolli

Fonte oficial de design do Evolli RH. Vale para toda tela nova e para toda
mudança visual em tela existente. O que está aqui é do próprio Evolli: nenhuma
referência visual externa entra no produto.

- Tokens: [`apps/web/src/app/tokens.css`](../apps/web/src/app/tokens.css)
- Temas de Aparência: [`apps/web/src/app/aparencia.ts`](../apps/web/src/app/aparencia.ts)
  e [decisão T210](decisions/t210-temas-de-aparencia.md)
- Marca: [`apps/web/src/app/marca/MarcaEvolli.tsx`](../apps/web/src/app/marca/MarcaEvolli.tsx)
- Ícones: [`apps/web/src/ui/icones.tsx`](../apps/web/src/ui/icones.tsx)
- Componentes: `apps/web/src/ui/` e `apps/web/src/components/`

## Princípios

O Evolli é um sistema interno de RH: dados, tabelas, formulários, avisos e
erros vêm antes de qualquer efeito estético.

- **Funcional** — cada elemento existe para uma tarefa; nada decorativo que
  dispute atenção com o dado.
- **Leve** — superfícies claras, bordas finas, espaço generoso e pouca cor
  além da cor de ação.
- **Corporativo** — tom sóbrio e confiável; textos curtos, em português
  claro, sem gíria nem marketing.
- **Claro** — hierarquia evidente (título, descrição, conteúdo, ação); um
  rótulo visível em todo campo; a consequência de cada ação dita antes.
- **Consistente** — o mesmo problema resolvido do mesmo jeito em todo o
  sistema: mesmos tokens, mesmos componentes, mesmos textos de estado.

## Marca oficial

- Só os SVGs locais de `apps/web/src/assets/brand/`, pelo componente
  `MarcaEvolli`. A marca nunca é redesenhada, recolorida, distorcida ou
  recortada.
- Tons: **azul** sobre superfícies claras; **branco** (mesma geometria) sobre
  superfícies escuras ou sobre a cor de ação.
- Versões por contexto:
  - **horizontal** — topo do menu, barra superior, Hub e login; largura mínima
    de 156 px;
  - **símbolo** — menu recolhido e espaços compactos; nunca abaixo de 24 px;
  - **vertical** — telas institucionais, login e carregamento.
- Nome acessível "Evolli"; quando o nome já está escrito ao lado, a marca é
  decorativa (`alt=""`).
- Usos não permitidos: marca de terceiros, logotipo de cliente no lugar da
  marca Evolli, efeitos (sombra, contorno, gradiente) e fundo que derrube o
  contraste.

## Tipografia

- Fonte **Parkinsans** (`@fontsource/parkinsans`, servida pelo próprio
  produto), com a pilha de fallback de sistema definida em `--font-sans`.
- Escala de tamanhos e pesos só pelos tokens (`--text-*`, `--weight-*`);
  números de tabela e indicadores com `font-variant-numeric: tabular-nums`.
- Campos de formulário herdam a fonte (`font: inherit`), inclusive datas.

## Ícones

- **Iconsax** (`iconsax-react`), um desenho só no produto inteiro, sempre por
  `ui/icones.tsx` — as telas pedem o ícone pelo papel, nunca importam o pacote.
- Variante **Bulk** para módulos, navegação e ações com significado; **Linear**
  para glifos de interface (setas, fechar, mais, visto).
- Ícones são decorativos (`aria-hidden`): o nome vem do texto ao lado ou do
  rótulo do botão.

## Tokens

`apps/web/src/app/tokens.css` é a única origem de cor, espaço, raio, sombra,
tipografia e movimento. CSS de tela usa `var(--…)`; cor literal (hex, `rgb()`)
fora do arquivo de tokens não entra.

- **Cor de ação única** por tema (`--color-action`, `--color-action-hover`)
  para links, botões primários e seleção.
- **Superfícies** claras e neutras (`--surface-*`); superfície escura só de
  forma pontual (dicas, menu marinho).
- **Estados** semânticos (`--status-success-*`, atenção, erro, informação).
- **Espaço** pela escala `--space-*`; **raios** por `--radius-*`.
- **Botões quadrados** — cantos levemente arredondados, pelo token
  `--radius-botao`, em todo botão do sistema. A pílula (`--radius-pill`) fica
  só para selos, chips, barras e marcadores.
- Sem gradientes decorativos; sombra só em camadas flutuantes
  (`--sombra-flutuante`).

## Controles padrão

Valem para o sistema inteiro; a tela não redesenha estes controles.

- **Botão** — sempre pelo componente (`components/Button` ou `ui/Button`):
  altura de 40 px (`--altura-botao`), respiro lateral de 16 px
  (`--space-md`), ícone de 16 px à esquerda com 8 px de distância
  (`--space-xs`), cantos `--radius-botao`. Primário preenchido na cor de ação;
  secundário com contorno.
- **Botão de ícone** (quadrado: fechar, anterior/próximo, ⋯) — 36 × 36 px
  (`--botao-icone`), pelo `IconButton` ou pela regra da tela com o token.
- **Caixa de seleção** — toda `<input type="checkbox">` usa o padrão de
  `tokens.css`: quadrado de 18 px com cantos `--radius-caixa`; marcada na cor
  de ação do tema, visto branco e halo suave; parcial (`indeterminate`) com
  traço; desabilitada a 50%. A tela só ajusta tamanho e margem — nunca
  `accent-color`, borda ou fundo próprios.
- **Interruptor** (liga/desliga) — botão com `role="switch"` e
  `aria-checked`, não caixa de seleção.
- **Status** (situação, estado, selo de andamento) — sempre o `StatusBadge`:
  pílula de fundo suave, sem borda, com ponto de 6 px antes do rótulo e texto
  em peso 500. A variante diz o sentido: sucesso (ativo, aprovado, vigente,
  publicada), atenção (pendente, rascunho, férias), perigo (desligado,
  reprovado, sem dado obrigatório), informação (programada, em admissão, em
  verificação) e neutro (inativo, encerrado, indisponível). Quando o elemento
  precisa ser outro — o gatilho de um menu de status, por exemplo —, ele usa
  `classesDoStatus()` e `PontoDoStatus` do mesmo componente; a tela não cria
  selo de estado com CSS próprio, glifo (✓, ×, !) ou ícone no lugar do ponto.
  A classe extra do `StatusBadge` serve só para posição (margem, grade).
- **Aba sublinhada** — o indicador é a borda de baixo com a espessura
  `--aba-indicador`, e a aba leva a classe `evolli-aba` (o `TabsTrigger` já
  põe): a mesma espessura vai em cima, transparente, e o rótulo fica no centro.

### Texto no centro dos controles

O rótulo de todo botão, aba, pílula, item de menu, campo e célula fica no
centro vertical da caixa, com o mesmo respiro em cima e embaixo e o ícone
alinhado pelo meio. A regra mora na base, não na tela:

- **Entrelinha** — controles e textos herdam `--leading-body` (1,47). A
  altura natural da fonte fica entre 1,43 e 1,46 em; com 1,47 a sobra da
  linha se divide por igual de 11 a 16 px. Número solto (1,3; 1,4; 1,45) em
  controle desloca o texto até 2 px para cima. Botão do componente usa
  entrelinha 1, que também divide por igual.
- **Bordas** — borda que só existe de um lado conta como respiro: a aba
  sublinhada recebe a borda igual em cima; a célula de tabela com linha
  divisória de 1 px tira 1 px do respiro de baixo.
- **Sem quebra** — rótulo de botão, aba e pílula não quebra linha
  (`white-space: nowrap`); se não couber, a tela dá espaço ou rolagem, não
  dois andares dentro do controle.
- **Como conferir** — na prévia, a 1536 px e a 375 px, compare o retângulo
  do texto (`Range.getBoundingClientRect()`) com o do elemento: a diferença
  entre o espaço de cima e o de baixo fica em até 1 px.

## Padrões de página e movimento

Decisão da proprietária (2026-11-25): valem para o sistema inteiro. Toda tela
nova do mesmo tipo usa o mesmo padrão, sem variação local.

Os **próximos módulos já nascem neste padrão**. As medidas são tokens globais
em `app/tokens.css` (nunca números soltos na tela):

| Token                               | Valor    | Uso                                                |
| ----------------------------------- | -------- | -------------------------------------------------- |
| `--altura-botao`                    | 40 px    | botão de texto                                     |
| `--botao-icone`                     | 36 px    | botão quadrado de ícone                            |
| `--pagina-menu-largura`             | 264 px   | coluna do menu de seções                           |
| `--pagina-menu-recuo`               | 24 px    | item do menu a partir da barra lateral             |
| `--pagina-menu-recuo-direito`       | 18 px    | item com 222 px de largura                         |
| `--pagina-conteudo-afastamento`     | 48 px    | conteúdo a partir da linha do menu                 |
| `--pagina-rodape-recuo`             | 48 px    | pontas do rodapé fixo                              |
| `--altura-rodape-pagina`            | 72 px    | altura do rodapé fixo                              |
| `--movimento-curto`                 | 150 ms   | destaque e troca de estado                         |
| `--main-recuo-x` / `--main-recuo-y` | do shell | recuo do conteúdo (para encostar na barra lateral) |

- **Página longa de configuração** — `components/PaginaComSecoes`: menu
  lateral de seções com ícone, encostado na barra lateral principal (coluna
  de 264 px, item a 24 px, conteúdo a 48 px da linha), fixo ao rolar e
  descendo até o rodapé. A seção atual fica marcada (fundo, ícone escuro e a
  barra na borda esquerda, transição de 150 ms) e acompanha a rolagem. O
  clique rola suave até o começo da seção, logo abaixo da barra superior, e
  leva o foco ao título dela. Conteúdo em seções separadas por linha.
- **Linha de formulário** — rótulo e ajuda à esquerda, campo à direita;
  linhas separadas por divisor. Liga/desliga é interruptor à direita.
- **Rodapé fixo da página** (`pagina-secoes__rodape`) — de ponta a ponta da
  área de conteúdo, linha em cima: o estado à esquerda ("Ainda sem
  alterações…", "Alterações não salvas.") e, à direita, Descartar (botão de
  texto) e a ação principal.
- **Cadastro em etapas** — `components/cadastro/CadastroEmEtapas`: etapas à
  esquerda, troca com fade, foco no título da etapa nova, barra de
  "% concluído" e ações no rodapé.
- **Filtros de lista** — busca com ícone e filtros em pílula
  ("Unidade: Todas ▾"), numa linha; tabela num cartão com borda.
- **Período** — `SeletorDePeriodo`: botão com ícone que abre um calendário
  (anterior/próximo, mês, setas do teclado; Esc fecha só o calendário).
- **Lista de escolha** — `ui/ListaDeEscolha` (desde 2026-11-26): campo com
  seta que abre a lista logo abaixo (ou acima, sem espaço), a escolhida com
  visto à direita, segunda linha opcional; teclado completo (setas, Home,
  End, letras sem acento; Esc fecha só a lista). Telas novas usam esta lista,
  não o `<select>` nativo; as telas antigas migram quando forem revisitadas.
- **Prefixo e sufixo** — "R$", "%", "horas por semana" ficam DENTRO da caixa
  do campo (`cadastro-etapas__com-prefixo` / `__com-sufixo`), em cinza.
- **Janelas** — altura estável: trocar opções não muda o tamanho nem
  desloca a janela; enquanto carrega, o conteúdo anterior fica, esmaecido.
- **Movimento** — transições curtas (120–150 ms); quem pede menos movimento
  (`prefers-reduced-motion`) não tem animação nem rolagem suave.

## Temas de Aparência

Quatro temas, escolhidos em Configurações › Aparência. Todos redefinem os
mesmos tokens semânticos em `:root[data-theme="…"]`; nenhuma tela tem cor
própria por tema.

| Tema               | Código               | Caráter                                          |
| ------------------ | -------------------- | ------------------------------------------------ |
| Azul Institucional | `azul_institucional` | Padrão do Evolli, em azul.                       |
| Evolli Claro       | `evolli_claro`       | Magenta sobre fundos claros e quentes.           |
| Verde Petróleo     | `verde_petroleo`     | Verde-azulado sóbrio, fundos levemente frios.    |
| Alto Contraste     | `alto_contraste`     | Texto preto, bordas fortes, máxima legibilidade. |

## Acessibilidade (não negociável)

Acessibilidade tem precedência sobre qualquer escolha estética.

- **Contraste** WCAG AA em todos os temas (texto ≥ 4,5:1; componentes e foco
  ≥ 3:1).
- **Foco visível** em todo elemento interativo, pelo anel global
  (`--foco-anel`, `:focus-visible`); o foco nunca é removido sem substituto.
- **Teclado** — tudo que se faz com o ponteiro se faz com o teclado; Escape
  fecha camadas e devolve o foco a quem as abriu.
- **Leitores de tela** — rótulo em todo controle; erros ligados ao campo
  (`aria-describedby`, `aria-invalid`); avisos em região de status, sem mover
  o foco.
- **Alvo de toque** mínimo de `--touch-target` (44 px).
- **375 px** — toda tela funciona em uma coluna a 375 px, sem rolagem
  horizontal da página e sem largura fixa.
- **`prefers-reduced-motion`** — com a preferência ativa, animações e
  transições são desligadas (`ui/movimento.css`).

## Textos

- Português do Brasil, frases curtas, voz ativa.
- Botão diz a ação ("Salvar padrão", "Cadastrar colaborador").
- Mensagem de erro diz o que fazer ("Informe o salário bruto. Ele é usado na
  folha de pagamento.").
- Nunca exibir senha, token, caminho local, porta ou dado pessoal além do
  necessário à tarefa.
