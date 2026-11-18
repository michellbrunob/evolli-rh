# T210 — Configurações › Aparência e marca oficial do Evolli

- **Estado:** fechada localmente em 2026-11-18. Branch `codex/t210-aparencia`, a partir do HEAD
  local da T209 (`b81c312`), que segue aberta, aguardando publicação. Sem push, PR, Ready ou merge.
- **Pedido da proprietária:** um tema visual por pessoa, gravado na própria conta, e a marca
  oficial do Evolli na interface.

## 1. Escopo

- **Configurações › Aparência**, para todo papel autenticado: quatro temas fechados, escolhidos
  em cartões. Aplicação imediata e gravação na conta (servidor), valendo em qualquer dispositivo.
- **Preferência individual por conta**, não por empresa. Ausente ou inválida, vale **Azul
  Institucional**.
- **Marca oficial** a partir dos três SVGs locais aprovados, sem recriar nem redesenhar:
  - `apps/web/src/assets/brand/evolli-horizontal.svg`;
  - `evolli-symbol.svg`;
  - `evolli-vertical.svg`;
  - e as versões brancas (negativas) `*-branco.svg`, geradas dos oficiais com a mesma geometria
    e só o preenchimento branco, como a prancha da marca define (decisão da proprietária,
    2026-11-18).
- **Fora desta entrega:**
  - tema por empresa, logotipo por empresa e personalização livre (seletor de cor);
  - tema escuro;
  - Documentos (T212, não iniciada; a T211 passou a ser o menu lateral pela árvore da
    referência, decisão da proprietária de 2026-11-18).
- **O tema não altera** dados, permissões, relatórios, PDFs, CSVs, impressão ou e-mails: muda só
  as cores da tela.

## 2. Decisões

- **D1 — Persistência:**
  - coluna `tema_aparencia` em `access_user` (migration aditiva, anulável), com CHECK nos quatro
    códigos;
  - nula = Azul Institucional. **Toda conta ou acesso novo nasce com o Azul Institucional**
    (regra da proprietária, 2026-11-18): a coluna nasce nula e nada a preenche na criação;
  - sem auditoria, como pedido;
  - nada em `localStorage` nem `sessionStorage`.
- **D2 — Contrato:**
  - `GET /v1/users/me` passa a trazer `temaAparencia` (o código, ou `null`);
  - `PATCH /v1/users/me/aparencia` com `{ "tema": "<código>" }` grava o tema **da própria
    conta**: sessão e CSRF, qualquer papel, sem identificador de outra pessoa na rota ou no
    corpo;
  - valor fora da lista: 400;
  - a resposta é o ator atualizado, como em Meu perfil.
- **D3 — Códigos:** `azul_institucional`, `evolli_claro`, `verde_petroleo` e `alto_contraste`.
- **D4 — Aplicação:**
  - atributo global `data-theme` no `<html>`;
  - a página começa no padrão (sem atributo) e recebe o tema logo depois da identidade da sessão
    (`/users/me`);
  - na saída da sessão, volta ao padrão;
  - os tokens semânticos (`tokens.css`) são redefinidos por `[data-theme="…"]`.
- **D5 — Tokens de cada tema:**
  - ação, hover, tinta, texto secundário, canvas, fundo neutro, superfície clara, borda, divisor
    e foco, como na seção 3;
  - os tokens de marca de interface que hoje fazem papel de ação (`--evolli-azul`,
    `--evolli-azul-escuro` e `--evolli-azul-suave`) passam a seguir o tema;
  - os estados semânticos (sucesso, atenção, erro e informação) ficam iguais em todos os temas.
- **D6 — Contorno de campos:**
  - a "borda" da paleta tem menos de 3:1 contra o fundo em três temas (1,30 a 1,51:1); serve a
    divisores e cartões, não a contorno de campo;
  - os campos de formulário usam o token derivado `--borda-controle`, com pelo menos 3:1
    (seção 3).
- **D7 — Menu lateral (revista em 2026-11-18, decisão da proprietária pela prancha da marca):**
  - o menu deixa o marinho fixo da T207 e fica **claro, no tema da conta**;
  - fundo com um tom bem leve da ação do tema (`--menu-fundo`: 4% da ação sobre o canvas);
  - item ativo na cor de ação sobre 12% da ação, com peso e barra indicadora, além do
    `aria-current`;
  - hover: 6% da tinta sobre o fundo do menu (existe também no Alto Contraste, onde neutro =
    canvas);
  - textos na tinta e no secundário do tema; foco no token de foco do tema;
  - nenhuma cor nova: tudo derivado da paleta (tokens `--menu-*`).
- **D8 — Marca (componente `MarcaEvolli`):**
  - azul institucional `#0066CC` em todos os temas, sem acompanhar a cor de ação; cada tom é um
    arquivo (azul ou branco), nada é recolorido em CSS;
  - horizontal azul: topo do menu, barra superior (celular), Hub e acesso temporário;
  - símbolo azul: menu recolhido (trilho) e ícone da página (favicon);
  - vertical azul: tela de abertura (carregamento);
  - horizontal branca: painel institucional do login, que fica na cor de ação;
  - largura pela proporção do próprio arquivo; mínimos da prancha: símbolo 24 px, horizontal
    156 px de largura;
  - sem filtro, sombra, gradiente, distorção nem cor arbitrária (`object-fit: contain`);
  - nome acessível "Evolli" (`alt`), ou decorativa onde o nome já está ao lado; "Evolli RH" saiu
    dos pontos de marca e dos textos.
- **D10 — Aparência fora do Hub:** é preferência da conta, não produto; abre pela navegação
  interna de Configurações (o cartão Configurações já leva lá).
- **D9 — Movimento:** nenhuma transição decorativa de cor na troca de tema; `prefers-reduced-motion`
  continua respeitado.

## 3. Paletas

| Token                  | Azul Institucional (padrão) | Evolli Claro | Verde Petróleo | Alto Contraste |
| ---------------------- | --------------------------- | ------------ | -------------- | -------------- |
| ação                   | #0066CC                     | #B42362      | #006D77        | #0046AD        |
| hover                  | #004F9E                     | #961C51      | #005963        | #003780        |
| tinta                  | #1D1D1F                     | #25151E      | #132B2D        | #000000        |
| texto secundário       | #475467                     | #5D4553      | #40595B        | #1A1A1A        |
| canvas                 | #FFFFFF                     | #FFFDFE      | #FCFEFE        | #FFFFFF        |
| fundo neutro           | #F5F5F7                     | #F8F7F9      | #F2F8F8        | #FFFFFF        |
| superfície clara       | #FAFAFC                     | #FFF8FB      | #F7FBFB        | #FFFFFF        |
| borda                  | #D2D2D7                     | #E8DDE4      | #CDE0E0        | #1A1A1A        |
| divisor                | #E8E8ED                     | #F1E7EC      | #E0EEEE        | #666666        |
| foco                   | #0066CC                     | #B42362      | #006D77        | #0046AD        |
| contorno de campo (D6) | #86868B                     | #9A7A8B      | #6B8C8E        | #1A1A1A        |

### 3.1 Contrastes calculados (WCAG 2.x)

| Tema               | Tinta       | Texto secundário | Ação no fundo | Branco sobre a ação | Contorno de campo |
| ------------------ | ----------- | ---------------- | ------------- | ------------------- | ----------------- |
| Azul Institucional | 15,46–16,83 | 7,06–7,69        | 5,11–5,57     | 5,57                | 3,33–3,62         |
| Evolli Claro       | 16,32–17,21 | 8,05–8,49        | 5,86–6,18     | 6,25                | 3,56–3,75         |
| Verde Petróleo     | 13,86–14,70 | 6,99–7,41        | 5,66–6,01     | 6,08                | 3,39–3,60         |
| Alto Contraste     | 21,00       | 17,40            | 8,47          | 8,47                | 17,40             |

Faixas: menor e maior valor sobre canvas, fundo neutro e superfície clara.

## 4. Regras de acessibilidade

- **Contraste:**
  - texto normal com pelo menos 4,5:1; texto grande e controles com pelo menos 3:1;
  - foco de teclado com pelo menos 3:1 contra o entorno;
  - os testes calculam os contrastes a partir dos próprios tokens.
- **Cor nunca é o único indicador:**
  - todo estado mantém texto, ícone ou rótulo;
  - o cartão do tema escolhido mostra "Em uso" em texto e `aria-checked`.
- **Os cartões de tema:**
  - um `radiogroup` com rótulo, operado por teclado (setas, Tab, Espaço);
  - feedback por região viva: tema aplicado e salvo, ou falha com o tema anterior restaurado.
- **375 px:** sem rolagem horizontal.

## 5. Limites

- **Sem tema escuro:** fora do pedido; a versão branca da marca já existe para quando houver.
- **Superfícies próprias:** o Dashboard (paleta de gráficos e títulos em marinho) mantém as cores
  dele em todos os temas.
- **Respiro da marca** (x = ¼ da altura do símbolo, prancha): seguido pelo espaçamento dos
  contêineres, sem regra automática.
- **Tema da empresa:** fica para entrega futura, com o logotipo por empresa e a personalização
  livre.

## 6. Plano de testes

- **API (E2E com PostgreSQL real):**
  - valor padrão (`null`);
  - gravação da própria conta e leitura em nova sessão;
  - valor inválido (400);
  - sem CSRF (403);
  - isolamento entre contas (a gravação de uma não muda a outra);
  - todos os papéis podem gravar a própria preferência;
  - CHECK no banco.
- **Web:**
  - aplicação do `data-theme` depois da identidade;
  - persistência em nova sessão (o tema vem do servidor);
  - falha (volta ao tema anterior e avisa);
  - teclado e leitor de tela nos cartões;
  - 375 px;
  - padrão para valor ausente ou inválido.
- **Marca:**
  - versão certa em cada contexto;
  - nome acessível "Evolli";
  - nenhuma imagem quebrada;
  - símbolo legível em 24 px.
- **Contraste:** cálculo nos tokens de cada tema (texto, secundário, ação, branco sobre a ação,
  foco e contorno de campo).
- **Gerais:**
  - lint, typecheck, build, smoke de migration e testes focados;
  - validação no navegador dos quatro temas em Configurações, Dashboard, Colaboradores,
    formulário e tabela.

## 7. Resultados (2026-11-18)

- **API:** E2E `aparencia` 18/18 (padrão nulo, gravação e nova sessão, inválidos 400, sem CSRF 403,
  sem sessão 401, isolamento, todos os papéis, CHECK no banco, sem auditoria); bateria E2E serial
  29 suítes / 1207 testes, com as migrations do zero (smoke da migration); unitária 68 / 1604.
- **Web:** 158 arquivos / 4359 testes; um teste de temporização da T189 estourou 5 s na suíte
  completa e passou isolado (instabilidade conhecida). Inclui temas (paletas, contrastes dos
  quatro temas, menu, contorno de campo, nenhuma cor fixa), `MarcaEvolli`, Aparência (tela, rota,
  sessão, falha, sessão expirada, teclado, descrições acessíveis) e Hub sem o cartão.
- **Gerais:** lint, typecheck e build limpos; `spec:check` e `git diff --check` limpos.
- **Navegador:** quatro temas em Configurações, Dashboard, Colaboradores (tabela e filtros) e
  Novo colaborador (formulário): ação, menu, item ativo, contorno de campo e texto seguem o tema;
  marca carregada; troca gravada e restaurada na conta de demonstração. 375 px sem rolagem
  horizontal em cinco telas; na barra, o símbolo de 28 px até 400 px.
- **Limites para o tema da empresa (futuro):** a preferência é da conta; um tema por empresa
  precisaria de coluna e regra de precedência próprias (empresa × conta), logotipo por empresa
  com armazenamento e validação de arquivo, e a mesma checagem de contraste para cores livres.
