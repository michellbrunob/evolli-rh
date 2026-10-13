# T159 — Direção visual da navegação e limites de referência de mercado

Status: **decisão do proprietário, registrada e vigente.**
Data: 2026-10-13.
Vinculada à: **T159** (reorganização funcional da navegação) e à PR #151.

Esta decisão complementa, e não substitui, a direção visual registrada na
[T142](t142-direcao-visual-b-modais.md) e a fundação de tokens da T146. Nada
aqui altera escopo funcional, RBAC, rotas, backend, banco ou dependências.

## 1. O que pode ser usado de referência de mercado

Apenas **princípios de arquitetura de informação e de composição visual**
observados: como um produto separa módulo de submenu, onde ancora a marca,
quanto respiro dá à navegação, como sinaliza o item ativo, como trata a área
de conteúdo. Princípio é conhecimento geral de ofício; não é propriedade de
ninguém.

## 2. O que não pode, em nenhuma hipótese

Nenhum ativo nem expressão de terceiros entra no Evolli:

| Proibido | Inclui                                       |
| -------- | -------------------------------------------- |
| Marca    | nome, logotipo, monograma, assinatura visual |
| Texto    | rótulos, microcópia, slogans, descrições     |
| Imagem   | fotos, ilustrações, mascotes                 |
| Ícone    | qualquer conjunto proprietário               |
| Cor      | paleta exata ou derivada por amostragem      |
| Código   | HTML, CSS, componentes, tokens               |
| Layout   | reprodução pixel a pixel de qualquer tela    |

**Teste prático:** se a resposta a "de onde veio este valor/arquivo/palavra?"
for um produto de terceiro, ele não entra. Ícones são SVG originais
desenhados aqui, com geometria elementar; a marca é própria; a paleta continua
sendo a de `tokens.css`.

## 3. O que continua sendo do Evolli

Identidade, tokens, componentes, linguagem, padrão B e os modais existentes.
A evolução visual é **recomposição do que já existe** — espaço, hierarquia,
peso tipográfico, superfície e indicador de seleção —, nunca a importação de
um sistema visual alheio.

## 4. Tela de login — fatia própria, futura

A tela de login **não** faz parte da T159. Quando for feita, será painel
institucional **original** + autenticação, e nada além disso.

Ficam **fora** enquanto não houver contrato funcional aprovado:

- CPF como identificador de acesso;
- captcha;
- cadastro ou autosserviço de criação de conta;
- registro de ponto a partir da tela de entrada;
- recuperação de senha.

Cada um desses itens implica contrato que hoje não existe — de dado pessoal,
de antifraude, de provisionamento de conta, de prova de jornada ou de canal de
recuperação. Oferecê-los antes do contrato seria exatamente a promessa vazia
que a T159 existe para eliminar.

## 5. Direção aprovada para o shell (aplicada nesta tarefa)

1. Barra lateral branca, estável e espaçosa no desktop, com a marca Evolli
   própria.
2. Módulos como itens claros: ícone SVG original, texto, estado ativo e
   affordance de expansão quando o módulo tem mais de um destino.
3. Hierarquia entre módulo, submenu e destino ativo por **superfície, borda
   indicadora, peso tipográfico e espaço** — nunca só por cor.
4. Grupo **Demonstração** ao pé da barra, visualmente secundário, com o aviso
   explícito de que nada ali grava, consulta o servidor ou representa
   capacidade disponível.
5. Cabeçalho com **apenas ações que existem**: contexto do ator, Segurança
   (quando o servidor informa MFA disponível), Sessões ativas e Sair. Sem
   marketplace, favoritos, busca global, suporte, notificações ou atalhos
   fictícios.
6. Área de conteúdo em fundo neutro, largura confortável e hierarquia clara,
   sem banner de marketing, métrica inventada ou card sem dado.
7. No mobile, gaveta acessível: botão de abertura sempre alcançável, foco
   preso enquanto aberta, `Escape` fecha e devolve o foco, e nenhuma rolagem
   horizontal.

## 6. Invariantes preservados

Os seis grupos aprovados; a separação completa entre funcional e
demonstrativo; a entrada direta do gestor em "Minha equipe" sem 403; os
destinos e permissões por perfil; um `h1` por workspace; o padrão B e os
modais existentes; acessibilidade por teclado, nomes acessíveis, foco visível
e contraste.

## 7. Limites desta decisão

Não autoriza nova capacidade funcional, não aprova requisito novo, não inicia
a dívida **L3** (paginação) e não abre tarefa nova. A tela de login segue
pendente de fatia própria.
