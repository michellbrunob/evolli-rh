# T211 — Organização do menu

- **Estado:** aberta em 2026-11-18, em implementação local. Branch `codex/t211-organizacao-menu`,
  a partir do squash da T210 em `main` (`053aa3d`, PR #203). Sem push, PR, Ready ou merge.
- **Pedido da proprietária:** reorganizar só a navegação do menu lateral, mantendo marca, temas,
  ícones e identidade próprios do Evolli.

## 1. Escopo

- Mexe só na navegação: menu lateral, navegação interna de Configurações, trilha e as URLs que a
  reorganização exige.
- **Fora desta entrega:**
  - módulos, permissões, dados, migrations, API e dependências novos;
  - mudança funcional nas telas (títulos, abas, ações e conteúdo ficam iguais);
  - Documentos (entrega própria, não iniciada).

## 2. Decisões (proprietária, 2026-11-18)

- **M1 — Colaboradores:** o submenu passa a ter Colaboradores, **Escala de trabalho**,
  **Organograma** e Desenvolvimento (este segue em desenvolvimento).
  - Escala de trabalho é o destino `jornadas-trabalho`, que abre a tela de jornadas de sempre, na
    URL de sempre (`#/estrutura/jornadas-trabalho`).
  - Organograma é o destino `cadastros`, que abre a tela de estrutura organizacional de sempre.
  - O módulo Estrutura deixa de existir no menu.
- **M2 — Equipe e permissões em Configurações:**
  - o destino `contas-acesso` sai do menu lateral;
  - ele vira o item **Equipe e permissões** da navegação interna de Configurações, no grupo
    Empresa, depois de Empresas;
  - ganha a URL `#/configuracoes/equipe-e-permissoes`;
  - aparece para os mesmos papéis de hoje (o shell confere a capacidade);
  - a tela é a mesma.
- **M3 — Ponto fora do menu:** o destino `ponto` sai do menu e ganha a URL `#/jornada/ponto`, com
  a mesma capacidade de hoje.
- **M4 — Administração da liderança fora do menu:** o destino `administracao-lideranca` sai do
  menu e ganha a URL `#/lideranca/administracao`, só para o RH, como hoje.
- **M5 — Liderança como módulo de item único:** Liderança vira um item direto da seção Pessoas,
  depois de Calendário, como Folha de Pagamento e Benefícios. Ele abre Minha equipe, para gestor e
  RH; o gestor continua entrando por Minha equipe.
- **M6 — Sem seção Operação:** com M1 a M5 ela fica vazia e deixa de existir.
- **M7 — Demonstração fora do menu:** as telas de exemplo ficam no código, sem caminho na interface.
- **M8 — Itens em desenvolvimento:** continuam com a indicação acessível de indisponibilidade
  (marca, descrição e aviso), sem rota.

## 3. Árvore do menu

- Dashboard; Portal (Beta, em desenvolvimento).
- **Pessoas:**
  - Colaboradores ▸ Colaboradores, Escala de trabalho, Organograma, Desenvolvimento (em
    desenvolvimento);
  - Recrutamento ▸ Vagas, Banco de talentos (em desenvolvimento);
  - Pesquisas, Calendário (em desenvolvimento);
  - Liderança (abre Minha equipe).
- **Remuneração:** Folha de Pagamento, Benefícios, Hub de Benefícios (Novo), todos em
  desenvolvimento.
- **Rodapé:** Suporte, Roadmap (em desenvolvimento) e Configurações.
- **Configurações › navegação interna:**
  - Sua conta: Meu perfil, Aparência;
  - Empresa: Empresas, Equipe e permissões.

## 4. Permissões e rotas

- Nenhuma capacidade muda: o menu continua filtrando pelos papéis de cada destino, e o shell
  continua conferindo a capacidade ao abrir.
- **URLs que já existiam ficam iguais.**
- **URLs novas** (navegação, sem tela nova):
  - `#/configuracoes/equipe-e-permissoes`;
  - `#/jornada/ponto`;
  - `#/lideranca/administracao`.

## 5. Limites

- **Rótulo × título:** o rótulo de navegação (menu e trilha) muda — Escala de trabalho,
  Organograma, Equipe e permissões —, mas o título dentro das telas fica o de sempre (sem mudança
  funcional nas telas, por escopo).
- **Telas fora do menu:** Ponto e Administração da liderança abrem pela URL própria até ganharem
  lugar definitivo. As telas de exemplo de Demonstração ficam sem caminho na interface.

## 6. Validação no navegador (2026-11-18, prévia local)

- **RH:**
  - a árvore da seção 3, completa;
  - Escala de trabalho abre a tela de jornadas (título "Jornadas de trabalho"), com a URL de
    sempre e a trilha Pessoas › Colaboradores › Escala de trabalho;
  - Organograma abre a estrutura organizacional (trilha Pessoas › Colaboradores › Organograma);
  - Liderança abre Minha equipe (trilha Pessoas › Liderança › Minha equipe);
  - Configurações mostra Meu perfil, Aparência, Empresas e Equipe e permissões;
  - `#/configuracoes/equipe-e-permissoes` abre Contas de acesso, com Configurações marcado;
  - `#/jornada/ponto` e `#/lideranca/administracao` abrem as telas, sem item marcado.
- **DP e master técnico** (sem empresa, acesso global): Colaboradores com Escala de trabalho e
  Organograma, sem Liderança; Equipe e permissões em Configurações.
- **Gestor:**
  - entra direto em Minha equipe, com Liderança marcada;
  - em Configurações, só Meu perfil e Aparência;
  - as URLs de Equipe e permissões e de Administração da liderança são recusadas (fica na tela
    atual).
- **375 px:** a gaveta mostra a árvore nova, todos os alvos com 44 px, sem rolagem horizontal.
- **Comportamento anterior, sem mudança:** destinos sem restrição de papel no mapa (Colaboradores,
  Organograma) aparecem no menu do gestor, e o shell recusa ao abrir. Antes da T211, Estrutura
  organizacional também aparecia para ele, na seção Operação.

## 7. Testes e verificações (2026-11-18)

- **Testes da T211** (`App.organizacaoMenu.test.tsx`, 32): árvore e ordem, Colaboradores com os
  três destinos e Desenvolvimento, Liderança como item único por papel, nada de Operação,
  Estrutura, Jornada, Administração ou Demonstração, URLs novas de ida e volta, URLs antigas
  iguais, trilhas, Equipe e permissões em Configurações por papel, Ponto e Administração da
  liderança pela URL, gestor em Minha equipe.
- **Testes do menu antigo atualizados:**
  - as telas fora do menu passam a abrir pelo destino inicial ou pela URL própria;
  - saem dois testes de "sair e voltar pelo menu" de telas de demonstração (Portal do
    Colaborador e Relatórios), porque esse percurso não existe mais.
- **Suíte web:** 159 arquivos / 4381 testes, sem falhas.
- **Gerais:** lint, typecheck e build da web verdes. A API não mudou.

## 8. Plano de testes

- **Menu:** árvore e ordem; Colaboradores com os três destinos e Desenvolvimento; Liderança como
  item único; sem Operação, Estrutura, Jornada, Administração e Demonstração; itens em
  desenvolvimento intactos.
- **Rotas:** URLs novas de ida e volta; URLs antigas iguais; troca de empresa.
- **Configurações:** Equipe e permissões só para quem tem a capacidade.
- **Trilha:** Pessoas › Colaboradores › Escala de trabalho / Organograma; Configurações › Equipe e
  permissões.
- **Papéis no navegador:** RH, DP, master técnico e gestor; 375 px.
- **Gerais:** lint, typecheck, build, Prettier, `spec:check` e `git diff --check`.
