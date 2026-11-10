# T206 — Shell com menu lateral fixo e recolhível

## 1. Situação

- **Estado:** em implementação, validada localmente.
- **Branch:** `codex/t206-shell-menu-lateral`, a partir do squash
  `c2c83622fd84bba9af73da3af96a4d5cb255b6a3` (T205 integrada, PR #198).
- **Natureza:** só shell e navegação na web. Nenhuma mudança em API, schema, migration, RBAC,
  auditoria, seed, Docker, dependências, lockfile ou workflows. Nenhuma regra de módulo
  (Dashboard, Colaboradores, fichas) foi tocada.

## 2. Problema

O shell centralizava o corpo inteiro numa trava de largura (`--shell-max`, 1440 px) e ainda
limitava a área principal a cerca de 1170 px. Medido numa janela de 1600 px:

- a barra lateral começava em x = 73, com uma faixa vazia à esquerda dela;
- o conteúdo terminava em x = 1513, com outra faixa vazia à direita;
- a barra ficava abaixo do cabeçalho e não acompanhava a altura da janela.

O resultado era o vazio branco junto à navegação que esta tarefa remove.

## 3. Princípios adotados

1. O menu é uma faixa presa à borda esquerda, da altura da janela, integrada ao shell inteiro.
2. Expandido, ele é útil por si: marca, controle de recolher, empresa ativa, módulos, submenus e o
   grupo Demonstração ao pé.
3. Recolhido, ele não desaparece: vira um trilho compacto de ícones funcionais, ainda preso à
   esquerda.
4. O conteúdo ocupa o espaço que o menu libera — nada fica entre a navegação e o conteúdo.
5. Nada é decorativo: todo item mantém o destino que já tinha, e nenhum item, seção ou rota nova
   foi criado. A identidade visual é a do Evolli (tokens, marca e ícones próprios já existentes).

## 4. Arquitetura do shell

```
.app-shell
├── link "Pular para o conteúdo"
└── .app-shell__body                (linha: faixa + coluna)
    ├── fundo da gaveta              (só no celular, com a gaveta aberta)
    ├── .app-shell__sidebar          (faixa lateral; diálogo modal só como gaveta)
    │   ├── .app-shell__cabecalho-lateral  (marca + botão de recolher)
    │   ├── seletor de empresa ativa (T189)
    │   ├── <nav> Navegação do painel
    │   └── dica visual do trilho
    └── .app-shell__coluna           (coluna à direita da faixa)
        ├── cabeçalho (papel, Segurança, Sessões ativas, Hub, Sair)
        ├── painéis de Segurança e Sessões ativas
        ├── <main>
        └── rodapé
```

- **Antes:** cabeçalho, corpo (barra + conteúdo) e rodapé empilhados, o corpo centralizado numa
  trava de largura. **Agora:** a faixa vem primeiro, colada à esquerda, e o resto forma a coluna à
  direita. Não há mais trava de largura nem centralização no corpo, no cabeçalho, no conteúdo ou no
  rodapé.
- **Faixa:** `position: sticky; top: 0; height: 100vh`. Fica no lugar enquanto a página rola e rola
  por dentro quando a lista é mais alta que a janela.
- **Largura:** uma variável só, `--largura-lateral`. Expandida, vale `--sidebar-width` (272 px);
  recolhida, `--largura-trilho` (72 px). A coluna (`flex: 1 1 auto; min-width: 0`) ocupa o resto.
- **Breakpoint:** o mesmo de antes (835 px). As regras do trilho moram num bloco
  `@media (min-width: 835px)` — segunda barreira, além de o shell nem aplicar a classe do trilho no
  modo gaveta.
- **Ordem de foco:** com a faixa antes da coluna no documento, o Tab percorre marca/recolher,
  empresa e navegação antes das ações do cabeçalho, na mesma ordem em que aparecem da esquerda para a
  direita. No celular a faixa fechada é `display: none`, então a ordem continua começando no "Menu".

## 5. Menu expandido (desktop)

- Faixa branca de 272 px, da borda superior à inferior, com a marca Evolli e o botão de recolher no
  topo.
- Seletor de empresa da T189 logo abaixo, sem mudança de comportamento.
- Módulos, submenus e o grupo Demonstração ao pé, exatamente como antes (T159/T178).
- O item ativo soma `aria-current="page"`, superfície, peso e barra indicadora.
- As ações do cabeçalho (papel, Segurança, Sessões ativas, Hub, Sair) continuam no cabeçalho, que
  agora fica à direita da faixa. **Decisão:** não foram movidas para o pé da faixa. O pé da faixa já
  é do grupo Demonstração, e mover ações de conta mudaria o shell além do pedido.

## 6. Menu recolhido — o trilho (desktop)

- **Os mesmos botões, não uma segunda navegação.** Recolher não monta outra lista: a mesma `<nav>`
  ganha a classe `painel-nav--trilho`, e o texto de cada item fica visualmente oculto (recorte), não
  removido. Por isso o nome acessível de cada ícone continua sendo o rótulo do item.
- **Destino direto** (Dashboard, Jornada, Minha equipe…): o ícone navega, e o menu continua
  recolhido.
- **Módulo com submenu** (Gestão de Pessoas, Estrutura, Liderança, Demonstração). **Decisão:** no
  trilho, o cabeçalho do módulo expande o menu e abre o módulo no mesmo gesto, e o foco fica no
  próprio cabeçalho, agora com o submenu visível logo abaixo. Nenhuma rota fica escondida: todo
  sub-item está a um passo.
  - `aria-expanded` continua verdadeiro: no trilho o botão anuncia "recolhido" e, acionado, revela
    exatamente a região que controla.
  - Painel flutuante (menu suspenso ao lado do ícone) foi descartado. Ele exigiria um padrão de
    menu novo (foco preso, setas, fechamento, camada) sem precedente no shell, e esconderia o
    submenu atrás de um segundo nível.
- **Empresa ativa:** o seletor vira compacto e mostra só o monograma. Sem empresa (acesso global do
  `master_tecnico`), aparece um símbolo próprio. Os textos ficam visualmente ocultos e seguem no
  nome do botão. Acionar (clique, Enter, Espaço ou seta para baixo) expande o menu e abre a lista no
  mesmo gesto, com o foco na empresa atual, como no menu expandido. Para quem só lê, o cartão
  mostra o monograma e a dica com o nome.
- **Grupo Demonstração:** continua ao pé, separado por um filete, e se comporta como os demais
  módulos com submenu.
- **Nada focável fica oculto:** no trilho todos os submenus estão em regiões `hidden`, fora da
  tabulação e da árvore de acessibilidade. Todo controle alcançável da faixa é um ícone com nome e
  dica.

## 7. Botão "Recolher menu" / "Expandir menu"

- Um único `<button type="button">` nos dois estados. O nome vem do texto do próprio botão
  (visualmente oculto), não de `aria-label` nem da dica: "Recolher menu" quando expandido, "Expandir
  menu" quando recolhido.
- O estado é exposto por `aria-expanded` (verdadeiro quando expandido), e `aria-controls` aponta
  para a `<nav>`.
- Como é um botão nativo, Enter e Espaço funcionam. O foco **fica no mesmo nó** ao alternar: o
  botão nunca é desmontado nem trocado.
- **Anúncio único:** nenhuma região viva é escrita ao alternar. Quem usa leitor de tela ouve a
  mudança uma vez, pelo próprio botão focado (nome e estado), sem duplicação.
- No celular o botão sai da tabulação (`hidden`): a gaveta é sempre o menu inteiro.

## 8. Dica visual

- Cada item do trilho declara `data-dica`. Um único elemento fixo (`DicaDoTrilho`) mostra a dica
  ao lado do item ao passar o ponteiro e ao receber foco. O botão de recolher também tem dica.
- A dica é `aria-hidden`: o nome já vem do texto do item, e a dica nunca é a única fonte dele.
- Some ao sair o ponteiro, ao perder o foco, com Escape, com clique, com rolagem e com o
  redimensionamento da janela.
- O ponteiro pode passar do item para a dica sem que ela suma (critério 1.4.13): o afastamento é
  desenhado por dentro da própria dica.
- Ela é remedida ao fim da transição de largura da faixa: um item focado enquanto a largura ainda
  anda seria medido na posição errada (achado da validação local, seção 13).
- **Camada:** a dica mora dentro da faixa, que é `sticky` e forma um contexto de empilhamento
  próprio. Por isso, no desktop, a faixa tem `z-index: 31`, acima do cabeçalho (30) e abaixo do link
  de pular (60), da gaveta do celular (40), do modal (100) e da guarda e do aviso de contexto (110).
  Sem isso, a dica do botão "Recolher menu", no menu expandido, ficava atrás do cabeçalho (achado da
  revisão, seção 13).

## 9. Item ativo nos dois estados

- **Destino direto:** `aria-current="page"`, superfície, peso e barra indicadora, expandido e no
  trilho.
- **Destino dentro de um submenu oculto** (no trilho, ou com o módulo fechado à mão): o cabeçalho do
  módulo herda a marca visual (superfície e barra) **e a semântica** (`aria-current="true"`), porque
  o botão marcado como página está oculto.
- Nenhuma marca depende só de cor: forma (barra) e superfície somam com a semântica.

## 10. Preferência de recolhido

- **Onde mora:** só em memória da aba, no `AutenticacaoApp`, junto com a chave da árvore
  (`conta:empresa`). Nenhum `localStorage`, `sessionStorage`, cookie ou URL. **Decisão:** o projeto
  não tem mecanismo de persistência em navegador e proíbe guardar estado de sessão nele (`authClient`,
  `csrfClient`, `edicoesPendentes`), então a preferência fica só na memória da aba.
- **Sobrevive** à navegação entre telas e à volta pelo Hub (que desmonta o shell).
- **Some** na troca de conta, na troca de empresa (nesta aba ou por outra aba) e no logout. Ao
  mudar a chave, a preferência anterior é apagada, não só ignorada: voltar à empresa antiga não a
  traz de volta.
- **Não sobrevive à recarga da página:** é a consequência de não usar armazenamento.
- No celular a preferência é guardada mas não vale; ao voltar ao desktop o trilho volta.

## 11. Celular e responsividade

- **Gaveta preservada** abaixo de 835 px: botão "Menu", diálogo modal, fundo inerte (`inert` e
  `aria-hidden`), foco preso, Escape e devolução de foco, e a gaveta fecha ao navegar (UI-F04, T159,
  T200).
- **Travessia do breakpoint:** se o foco estava em algo que sumiu, ele vai à entrada equivalente,
  nunca ao `body`. Algo da faixa vai ao "Menu" no celular; o "Menu" vai ao "Recolher menu" no
  desktop. Como o navegador tira o foco já no redimensionamento (o CSS esconde a faixa antes de o
  React saber do breakpoint), o shell guarda o último elemento focado e trata um foco perdido que
  estava ali como estando ali. Foco fora da faixa não é movido.
- **Alvos de toque:** na gaveta todo controle tem 44 px de altura, inclusive os sub-itens, que antes
  tinham 38 px (achado da validação local, seção 13).
- **Sem rolagem horizontal** a 375 px, a 900 px e no desktop (seção 12).
- **Movimento:** a faixa anima a largura só com `prefers-reduced-motion: no-preference`.

## 12. Evidências

### 12.1 Testes automatizados

- `App.menuLateral.test.tsx` (novo, 46 testes): botão, nome, ARIA, foco e anúncio único; trilho com nome, dica
  e destino de cada item; submenus, empresa e Demonstração no trilho; item ativo nos dois estados;
  dica (foco, ponteiro, 1.4.13, Escape, clique, transição, redimensionamento); guarda T200 a partir
  do trilho; gaveta, fundo inerte, foco e travessia do breakpoint; contrato de CSS (sem trava de
  largura, faixa da altura da janela, largura variável só no desktop, texto oculto por recorte,
  alvos de 44 px, transição só sem redução de movimento, sem deslocamento horizontal, e a camada da
  faixa acima do cabeçalho e abaixo do link de pular, da gaveta, do modal e da guarda).
- `AutenticacaoApp.test.tsx` (9 testes novos): a preferência sobrevive à volta pelo Hub e é
  apagada na troca de empresa e no logout; ao abrir um produto pelo Hub (Dashboard, Colaboradores e,
  para o gestor, Minha equipe), o foco vai ao título — uma vez só, fora de região oculta ou inerte —,
  sem mudar a preferência do menu e sem quebrar a guarda de edição pendente; a aterrissagem depois do
  login também foca o título uma vez só.
- `App.test.tsx`: um teste da ordem da faixa (T189) ajustado à marca dentro do cabeçalho da faixa.
  Nenhuma asserção foi removida.
- Suíte web completa: 126 arquivos, 3449 testes. API unitária: 60 suítes, 1472 testes. Scripts: 182
  testes. Lint, typecheck e build verdes. A API não mudou;
  o E2E serial com PostgreSQL real (20 suítes, 1017 testes) passou como regressão.

### 12.2 Mutações

31 mutações temporárias, todas detectadas:

- nome do botão, `aria-expanded` fixo, botão remontado ao alternar;
- trilho sem trocar a largura, conteúdo com teto de largura, corpo centralizado;
- texto do trilho removido do DOM, itens sem dica, cabeçalho sem `aria-current`, submenu visível no
  trilho, cabeçalho que só alterna, empresa compacta que não expande;
- dica não percorrível, sem reposicionar, sobrando após redimensionar, Escape sem efeito;
- trilho na gaveta, botão de recolher alcançável na gaveta, foco no `body` no breakpoint, foco
  perdido ignorado, só o botão (não a faixa) considerado;
- sub-itens de 38 px no celular;
- preferência que não sobrevive ao Hub, que sobrevive à troca de empresa ou ao logout, e gravação em
  `sessionStorage`;
- Hub sem pedir foco ao abrir o produto, shell sem o foco de montagem, e foco duplicado permitido;
- faixa sem `z-index` no desktop e faixa acima do modal.

### 12.3 Validação local no navegador

Prévia local da branch, com dados sintéticos.

| Verificação                    | Resultado                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faixa e conteúdo a 1366 px     | Faixa em x = 0, da altura da janela; nenhum vão entre faixa e conteúdo nem à direita. Conteúdo com 1079 px expandido e 1279 px recolhido.                                                                                                                                                                               |
| Faixa e conteúdo a 1600 px     | Conteúdo de 1313 px para 1513 px ao recolher.                                                                                                                                                                                                                                                                           |
| Largura intermediária (900 px) | Conteúdo de 613 px para 813 px; sem rolagem horizontal.                                                                                                                                                                                                                                                                 |
| 375 px                         | Sem rolagem horizontal; gaveta modal, fundo inerte, foco no primeiro controle, Escape devolve ao "Menu"; todo alvo com 44 px.                                                                                                                                                                                           |
| RH                             | Aterrissa no Dashboard; trilho com Dashboard, Gestão de Pessoas, Estrutura, Jornada, Liderança, Contas de acesso e Demonstração, todos com nome e dica.                                                                                                                                                                 |
| DP                             | Dashboard; trilho sem Liderança, como o menu expandido.                                                                                                                                                                                                                                                                 |
| `master_tecnico`               | Dashboard; empresa compacta com o símbolo e o nome do acesso global.                                                                                                                                                                                                                                                    |
| Gestor                         | Minha equipe; Estrutura organizacional e Minha equipe como destinos diretos.                                                                                                                                                                                                                                            |
| Perfis sem acesso ao shell     | Colaborador e administração técnica ficam no Hub, sem mudança. Pelo Hub o colaborador abre o shell de Demonstração, e o grupo herda `aria-current` no trilho.                                                                                                                                                           |
| Dashboard, Hub e Colaboradores | Dashboard nos dois estados; volta pelo Hub preserva o recolhido; Colaboradores aberto pelo submenu a partir do trilho.                                                                                                                                                                                                  |
| Submenu                        | Gestão de Pessoas, Estrutura e Demonstração no trilho expandem o menu e abrem o módulo, com o foco no cabeçalho.                                                                                                                                                                                                        |
| Troca de empresa               | Pelo trilho: o seletor compacto expande e abre a lista na empresa atual; a troca recria a tela expandida, anuncia e foca o título.                                                                                                                                                                                      |
| Edição pendente                | Com o menu recolhido e uma admissão em rascunho, o ícone do trilho abre "Sair sem salvar?". O trilho fica inerte e o foco vai a "Continuar editando"; continuar mantém o rascunho e devolve o foco ao ícone.                                                                                                            |
| Teclado                        | Enter recolhe e mantém o foco no botão; Tab percorre empresa e ícones com a dica ao focar; Escape esconde a dica sem mover o foco.                                                                                                                                                                                      |
| Hub → produto                  | Em 1366 e 375 px: Hub → Dashboard e Hub → Colaboradores (RH) e Hub → Minha equipe (gestor) aplicam a rota e levam o foco ao título, fora de região oculta ou inerte, sem rolagem horizontal; com o menu recolhido, o recolhido é preservado.                                                                            |
| Camadas (1366 px)              | Menu expandido: a dica de "Recolher menu" aparece por cima do cabeçalho, pelo mouse e pelo teclado. No trilho, as dicas de Dashboard, Gestão de Pessoas, Estrutura, Jornada e "Expandir menu" ficam visíveis. Modal, guarda de saída e link de pular continuam acima da faixa; a gaveta do celular mantém a sua camada. |
| Travessia do breakpoint        | Com o foco no "Recolher menu", ir a 375 px leva o foco ao "Menu"; voltar ao desktop leva ao "Expandir menu", com o trilho de volta.                                                                                                                                                                                     |

## 13. Achados da validação local, corrigidos dentro da entrega

1. **Dica fora do lugar:** com o foco chegando ao item enquanto a largura da faixa ainda andava, a
   dica era medida na posição da faixa larga, e sobrava na posição antiga depois de redimensionar a
   janela. Agora ela é remedida ao fim da transição e some no redimensionamento.
2. **Foco no `body` ao atravessar o breakpoint:** o navegador real tira o foco já no
   redimensionamento. O teste original não reproduzia isso; o novo reproduz (o foco é perdido antes
   da mudança de largura), e a correção usa o último elemento focado.
3. **Alvos de 38 px na gaveta:** os sub-itens do menu passaram a 44 px no celular.
4. **Foco no `body` ao abrir um produto pelo Hub** (anterior a esta entrega, corrigido por ordem da
   proprietária): o cartão clicado some com o Hub, e o shell que nascia não pedia foco. Agora o Hub
   abre o destino com o mesmo pedido de uma montagem só da aterrissagem e da troca de empresa, e o
   shell leva o foco ao título da tela (ou à região principal). O shell também deixou de focar de
   novo um título que a própria tela já focou ao montar (o Dashboard faz isso), o que antes gerava
   um foco duplicado na aterrissagem. Os testes falhavam no head anterior (4 de 5) e as três
   mutações (sem o pedido no Hub, sem o foco de montagem, foco duplicado) foram detectadas.
5. **Dica de "Recolher menu" atrás do cabeçalho** (achado da revisão): com o menu expandido, a dica
   do botão ficava encoberta pelo cabeçalho, porque a faixa `sticky` forma um contexto de
   empilhamento próprio e não tinha camada. A faixa ganhou `z-index: 31` no desktop (seção 8). O
   teste de contrato de CSS falhava no head anterior, e as mutações (sem a camada; faixa acima do
   modal) foram detectadas.

## 14. Limites e observações

- **Foco ao aterrissar no Hub depois do login:** continua como na observação 5 da T205 (sem
  mudança); a abertura de um produto pelo Hub foi corrigida (seção 13, item 4).
- **Preferência após recarregar:** volta ao expandido (seção 10).
- **Leitor de tela:** o anúncio único é garantido pela estrutura (botão nativo focado, nome e
  `aria-expanded`, nenhuma região viva escrita) e pelos testes. Não houve sessão com leitor de tela
  real.
- **Prévia com o painel oculto:** o navegador não desenha quadros nem entrega `resize` e eventos de
  foco a uma página oculta. As medidas e a travessia do breakpoint foram refeitas com quadros
  forçados e foco real.

## 15. Fora de escopo

- API, schema, migration, RBAC, auditoria, seed, Docker, dependências, lockfile e workflows.
- Regras do Dashboard, de Colaboradores e das fichas.
- Identidade visual, ativos de marca e logotipo.
- Item, seção, trilha de navegação, exportação, IA ou tela sem contrato real.
- Ações de conta no pé da faixa (seção 5).
- Promoção e merge.
