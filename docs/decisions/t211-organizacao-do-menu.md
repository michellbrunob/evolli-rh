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

## 6. Plano de testes

- **Menu:** árvore e ordem; Colaboradores com os três destinos e Desenvolvimento; Liderança como
  item único; sem Operação, Estrutura, Jornada, Administração e Demonstração; itens em
  desenvolvimento intactos.
- **Rotas:** URLs novas de ida e volta; URLs antigas iguais; troca de empresa.
- **Configurações:** Equipe e permissões só para quem tem a capacidade.
- **Trilha:** Pessoas › Colaboradores › Escala de trabalho / Organograma; Configurações › Equipe e
  permissões.
- **Papéis no navegador:** RH, DP, master técnico e gestor; 375 px.
- **Gerais:** lint, typecheck, build, Prettier, `spec:check` e `git diff --check`.
