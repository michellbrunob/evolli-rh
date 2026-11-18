# T210 — Configurações › Aparência e marca oficial do Evolli

- **Estado:** aberta em 2026-11-18, em preparação/implementação local. Branch
  `codex/t210-aparencia`, a partir do HEAD local da T209 (`b81c312`), que segue aberta, aguardando
  publicação. Sem push, PR, Ready ou merge.
- **Pedido da proprietária:** um tema visual por pessoa, gravado na própria conta, e a marca
  oficial do Evolli na interface.

## 1. Escopo

- **Configurações › Aparência**, para todo papel autenticado: quatro temas fechados, escolhidos
  em cartões. Aplicação imediata e gravação na conta (servidor), valendo em qualquer dispositivo.
- **Preferência individual por conta**, não por empresa. Ausente ou inválida, vale **Azul
  Institucional**.
- **Marca oficial** a partir dos três SVGs locais aprovados, sem recriar, redesenhar nem
  recolorir:
  - `apps/web/src/assets/brand/evolli-horizontal.svg`;
  - `evolli-symbol.svg`;
  - `evolli-vertical.svg`.
- **Fora desta entrega:**
  - tema por empresa, logotipo por empresa e personalização livre (seletor de cor);
  - tema escuro;
  - versão branca da marca (não existe arquivo oficial);
  - Documentos (T211, não iniciada).
- **O tema não altera** dados, permissões, relatórios, PDFs, CSVs, impressão ou e-mails: muda só
  as cores da tela.

## 2. Decisões

- **D1 — Persistência:**
  - coluna `tema_aparencia` em `access_user` (migration aditiva, anulável), com CHECK nos quatro
    códigos;
  - nula = Azul Institucional;
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
- **D7 — Menu lateral:**
  - continua marinho em todos os temas (as paletas não definem a cor do menu);
  - o item ativo e os textos sobre o marinho já têm contraste próprio.
- **D8 — Marca:**
  - azul institucional `#0066CC` em todos os temas, sem acompanhar a cor de ação;
  - só sobre superfície clara: a assinatura horizontal na barra superior e na tela de entrada;
    o símbolo no menu, no trilho recolhido e na carga, dentro de uma placa clara;
  - a vertical só na tela de entrada e na carga, onde há espaço;
  - sem filtro, sombra, gradiente, distorção nem cor arbitrária;
  - nome acessível "Evolli"; onde hoje está "Evolli RH", fica a marca "Evolli" (e "RH" só como
    texto, quando necessário, sem repetir a leitura).
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

- **Sem tema escuro:** a marca não tem versão branca oficial; o tema escuro fica para quando
  houver.
- **Superfícies próprias:** o menu marinho e o Dashboard (paleta de gráficos) mantêm as cores
  delas. Os gráficos continuam com a paleta própria em todos os temas.
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
