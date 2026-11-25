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
