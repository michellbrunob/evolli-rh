# T189 — Seletor de empresa ativa no menu lateral e no Hub

Status: **decidido pela proprietária em 2026-10-27.**
Data: 2026-10-27. Tarefa: T189.
Fontes: o dossiê de preparação apresentado na conversa da T188 (análise do
código de `main`), as decisões da T163 (contexto empresarial ativo) e o código
de `main` em `9f9a986`, só como evidência. Dois prints de um produto de mercado
serviram **exclusivamente** como referência de interação e hierarquia; nada da
marca, das cores, dos textos, dos ícones ou da identidade visual dele entra no
Evolli.

## 1. Onde o produto está

- **A empresa ativa vive na sessão** (`access_session.empresa_ativa_id`, T163)
  e é reconferida a cada requisição; revogação rebaixa o contexto ao padrão do
  papel. O navegador nunca é autoridade: nada de `localStorage`,
  `sessionStorage`, query string ou cookie escrito por script.
- **Contratos existentes:** `GET /v1/users/me` (`empresaAtiva` com `id`,
  `codigo`, `nome`; `podeTrocarEmpresa`), `GET /v1/auth/contexto/empresas`
  (403 para quem não troca) e `POST /v1/auth/contexto/empresa` (404 igual para
  inexistente, inativa ou não autorizada; troca auditada).
- **Hoje** a troca existe só no Hub, num `<select>`; o menu lateral do shell
  não mostra empresa. A troca recria toda a árvore (chave com a empresa ativa)
  e devolve a pessoa ao Hub.
- **Não existe** CNPJ ou outro identificador fiscal no cadastro de empresa,
  nem rota para conceder empresa a uma conta, nem tela de empresas na web.

## 2. Decisões aprovadas

1. **Componente único de empresa ativa**, no topo do menu lateral (abaixo da
   marca Evolli) e no Hub, substituindo o select atual.
   - Fechado: nome e **código interno** da empresa ativa, com indicador de
     expansão.
   - Aberto: empresas autorizadas, a atual marcada de forma visual e
     semântica; estados de carregamento, erro com "Tentar novamente", troca em
     andamento e empresa indisponível.
   - **Sem CNPJ, CPF ou identificador fiscal novo.**
2. **Empresa única:** só leitura — sem seta, sem lista, sem requisição
   desnecessária.
3. **Permissões:** trocam só `rh` e `master_tecnico`, pelas rotas e
   permissões existentes. `dp`, `gestor`, `colaborador`, `financeiro`,
   `auditor`, `dpo`, `admin_tecnico` e demais veem o contexto só para leitura e
   **não requisitam** a lista de empresas. `master_tecnico` sem empresa ativa
   mostra "Acesso global — todas as empresas".
4. **Depois da troca bem-sucedida:**
   - a pessoa **permanece no mesmo módulo**, na tela inicial segura dele;
   - a rota é reduzida ao nível do módulo — sem ficha, filtros, parâmetros ou
     seleção antigos;
   - a permissão é revalidada antes de abrir o destino;
   - buscas, filtros, seleções, ficha e estados da empresa anterior somem pela
     recriação da árvore que já existe;
   - a gaveta lateral fecha em 375 px;
   - a troca é anunciada ao leitor de tela e o foco vai para o título da tela
     de destino.
5. **Edição não salva e salvamento em andamento:** um mecanismo global e
   explícito em que telas e editores informam edição pendente e salvamento em
   andamento.
   - Edição pendente: confirmação antes de trocar; cancelar mantém a empresa e
     todo o conteúdo.
   - Salvamento em andamento: a troca fica bloqueada até concluir.
   - Nada é descartado em silêncio.
6. **Várias abas:** `BroadcastChannel` avisa as outras abas depois de uma
   troca; ao receber o aviso ou recuperar o foco, a aba reconfere o usuário
   atual e recria a tela no contexto correto. Sem `localStorage`. É
   **mitigação no navegador**, não substitui a verificação definitiva no
   servidor (fora desta tarefa).
7. **Acessibilidade e responsividade:** Enter/Espaço abre, Esc fecha e
   devolve o foco ao botão, Tab percorre de forma previsível; avisos de
   carregamento, erro e troca anunciados; alvos de toque de 44 px; nomes
   longos quebram linha; em 375 px sem rolagem horizontal e a lista abre
   dentro da gaveta.

## 3. Matriz de perfis

| Perfil                                                                                  | Vê a empresa ativa                                                   | Lista de empresas          | Troca                      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------- | -------------------------- |
| `rh`                                                                                    | sim                                                                  | sim (própria + concedidas) | sim, se houver mais de uma |
| `master_tecnico`                                                                        | sim; sem seleção, "Acesso global — todas as empresas"                | sim (todas as ativas)      | sim                        |
| `dp`, `gestor`, `colaborador`, `financeiro`, `auditor`, `dpo`, `admin_tecnico` e demais | só leitura; sem empresa na conta, "Não disponível para o seu perfil" | **não requisita**          | não                        |

## 4. Fora de escopo

- API, schema, migration, RBAC do servidor, auditoria nova, seed, Docker,
  dependências e lockfile.
- CNPJ ou qualquer dado fiscal novo.
- "Adicionar empresa", "Gerenciar empresas" e concessão de empresa à conta —
  sem rota de concessão, sem tela de empresas e sem fluxo aprovado.
- Rota para o `master_tecnico` voltar ao acesso global sem novo login.
- Verificação definitiva, no servidor, da empresa esperada por requisição.

## 5. Riscos conhecidos e tratamento

- **Várias abas compartilham a mesma sessão.** Trocar numa aba muda o
  contexto do servidor para todas. Mitigação desta tarefa: aviso entre abas e
  reconferência ao foco. Correção definitiva (empresa esperada por requisição,
  recusada pelo servidor quando divergir) fica para tarefa própria, porque
  muda a API.
- **Salvamento em voo durante a troca.** Mitigado pelo bloqueio da troca
  enquanto houver salvamento registrado; edições que apontam para registro da
  empresa anterior já falham com 404 no servidor.
- **Nome desatualizado depois de revogação.** A reconferência ao foco atualiza
  o contexto exibido.
