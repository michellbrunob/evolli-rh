# T200 — Dossiê: guarda de navegação com edição pendente

**Situação:** decisões G-1 a G-8 aprovadas em 2026-11-03 (seção 11) e
implementadas na mesma branch; a entrega está descrita na seção 14.
**Base:** `main` no squash `6b3d24d` (T199 integrada, PR #192).
**Por que agora:** a guarda global de navegação é o gate de produção do módulo
Pessoas registrado desde a T198 e mantido fora do escopo da T199.

## 1. O problema

A T189 criou um registro explícito de edição pendente e salvamento em
andamento, mas só **dois** caminhos o consultam: a troca de empresa (pelo
seletor desta aba) e a mudança de empresa feita em outra aba. Fora deles, a
proteção existe só dentro de algumas telas, cada uma do seu jeito:

- a trilha da ficha do colaborador ("Colaboradores") pede "Sair da ficha sem
  salvar?" (T198);
- a Nova admissão pede "Descartar esta admissão?" na trilha, em "Cancelar" e
  em "Conferir em Colaboradores";
- o `Modal` pede confirmação ao fechar com alteração (Fechar, Cancelar,
  Escape).

Todas as outras saídas descartam o que foi digitado **sem aviso**: o menu
lateral, o Hub, Sair, voltar/avançar do navegador, a URL digitada, as abas
internas de Pessoas, de Cadastros e do dashboard, recarregar e fechar a aba.

## 2. O que existe hoje

| Peça                                | Onde                                           | O que faz                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RegistroDeEdicoes` (T189)          | `apps/web/src/app/edicoesPendentes.tsx`        | Registro em memória, por aba: cada tela declara `{rótulo, pendente, salvando}` com `useEdicaoEmAndamento`; `useResumoDasEdicoes` lê o resumo reativo. |
| Troca de empresa                    | `SeletorEmpresaAtiva.tsx`                      | Com pendência, pede confirmação listando os rótulos; com salvamento, bloqueia até terminar.                                                           |
| Empresa mudou em outra aba          | `AvisoContextoAlterado.tsx`                    | Com pendência ou salvamento, deixa a tela inerte e oferece voltar à empresa anterior ou continuar (descartando).                                      |
| Aviso entre abas                    | `sincronizacaoDeContexto.ts`                   | `BroadcastChannel` sem dados ("confira"); quem recebe relê `GET /v1/users/me`. Só para contexto de empresa.                                           |
| Descarte no `Modal`                 | `components/Modal.tsx`                         | Com `alterado`, fechar pede confirmação dentro da janela; declara a edição no registro com o título.                                                  |
| Saída da ficha e da Nova admissão   | `FichaColaboradorScreen`, `NovaAdmissaoScreen` | Confirmação própria, só no caminho interno da própria tela.                                                                                           |
| Aviso do navegador (`beforeunload`) | —                                              | **Não existe.** Recarregar ou fechar a aba perde tudo em silêncio.                                                                                    |

O registro já tem o que a guarda precisa saber; falta um **consumidor único**
no shell que todas as saídas consultem.

## 3. Levantamento das telas com edição

"Granularidade" diz quando a tela se declara pendente: **alterado** compara com
o gravado (ou com o vazio); **formulário aberto** marca pendência assim que o
formulário abre, mesmo sem nada digitado.

"Acesso ao destino" vem da tabela de capacidade do shell
(`mapaNavegacao.ts`); dentro do destino, a tela só oferece edição a quem o
RBAC permite, e o servidor decide cada gravação.

| Tela                                                           | Onde abre                                                | Acesso ao destino                            | Declara hoje                                     | Granularidade     | Confirmação própria                         |
| -------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | ----------------- | ------------------------------------------- |
| Nova admissão                                                  | `#/pessoas/nova-admissao`                                | RH, DP                                       | "Nova admissão" (até a admissão gravar)          | alterado          | trilha, Cancelar, Conferir em Colaboradores |
| Ficha do colaborador (nome, contatos, dados pessoais, jornada) | `#/pessoas/colaboradores/:id/:aba`                       | RH, DP, master (master só lê; jornada só RH) | "Ficha do colaborador" (agrega as quatro seções) | alterado          | trilha "Colaboradores"                      |
| Cadastro rápido de referência                                  | diálogo dentro da Nova admissão                          | RH, DP                                       | título da referência                             | alterado          | no próprio diálogo                          |
| Criação inline de referência                                   | diálogo dentro da Nova admissão                          | RH, DP                                       | título da criação                                | formulário aberto | no próprio diálogo                          |
| Horário de trabalho (vínculo de horário)                       | Pessoas › Horário de trabalho e aba Jornada do dashboard | RH, DP, master (só RH opera)                 | "Horário de trabalho"                            | formulário aberto | —                                           |
| Registrar / Retificar movimentação                             | Pessoas › Histórico funcional                            | RH, DP, master                               | dois rótulos                                     | formulário aberto | —                                           |
| Documentos                                                     | Pessoas › Documentos                                     | RH, DP, master                               | "Documentos"                                     | formulário aberto | —                                           |
| Solicitações                                                   | Pessoas › Solicitações                                   | RH, DP, master                               | "Solicitações"                                   | formulário aberto | —                                           |
| Estrutura organizacional, Cargos, Centros de custo             | Cadastros (abas internas)                                | RH, DP, master                               | um rótulo por tela                               | formulário aberto | —                                           |
| Jornadas de trabalho (catálogo)                                | `#/estrutura/jornadas-trabalho`                          | RH, DP, master                               | "Jornadas de trabalho"                           | formulário aberto | —                                           |
| Registro de ponto                                              | Ponto › Visão do período                                 | RH, DP, master                               | "Registro de ponto"                              | formulário aberto | —                                           |
| Contas de acesso                                               | Administração › Contas de acesso                         | RH, DP, master                               | "Contas de acesso"                               | formulário aberto | —                                           |
| Equipe                                                         | Minha equipe                                             | gestor, RH                                   | pelo `Modal` (título)                            | alterado          | no próprio diálogo                          |
| Administração de liderança                                     | Administração                                            | RH                                           | pelo `Modal` (título)                            | alterado          | no próprio diálogo                          |

**Não declaram (e não precisam, salvo decisão):** busca e filtros das listagens
(não são edição); o portal do colaborador "Minhas solicitações" (destino
demonstrativo, sem cliente de API, nada é gravado); o painel de Segurança
(código do segundo fator, efêmero por natureza) — ver G-6.

**Observação de granularidade:** onze telas se declaram pendentes com o
formulário apenas **aberto**. Uma guarda global passaria a perguntar "sair sem
salvar?" também quando nada foi digitado. É seguro (pergunta a mais, nunca a
menos), mas é ruído — ver G-4.

## 4. Mapa das saídas

| Saída                                                       | Mecanismo hoje                                           | Cobertura hoje                                | Pode ser segurada na aplicação?                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Rota interna da própria tela (trilha, Voltar)               | callbacks da tela                                        | só ficha e Nova admissão                      | Sim: a tela chama o shell antes de sair.                                                                                           |
| Abas internas (Pessoas, Cadastros, dashboard)               | estado local (`setAbaAtiva`); o painel anterior desmonta | nenhuma                                       | Sim: a troca de aba passa pela guarda. (As sub-abas da Estrutura só escondem: o formulário fica no estado da tela e não se perde.) |
| Menu lateral e atalhos da Visão geral                       | `irPara` no `App`                                        | nenhuma                                       | Sim: `irPara` passa pela guarda.                                                                                                   |
| Hub                                                         | `onVoltarAoHub` no `AutenticacaoApp`                     | nenhuma                                       | Sim.                                                                                                                               |
| Sair (logout)                                               | `handleLogout`                                           | nenhuma                                       | Sim, antes de chamar o servidor.                                                                                                   |
| Voltar / avançar do navegador                               | `popstate` (a URL já mudou quando o evento chega)        | nenhuma                                       | **Em parte:** não dá para cancelar o evento; dá para **desfazer** a mudança e perguntar (seção 6.3).                               |
| URL digitada ou link com `#/…`                              | `hashchange`                                             | nenhuma                                       | Em parte, como voltar/avançar.                                                                                                     |
| Recarregar, fechar a aba, URL de fora                       | o navegador descarrega a página                          | nenhuma                                       | **Não.** Só o aviso nativo (`beforeunload`), com texto do navegador (seção 5).                                                     |
| Troca de empresa por esta aba                               | `SeletorEmpresaAtiva`                                    | **coberta** (T189)                            | Já segura.                                                                                                                         |
| Empresa mudou em outra aba                                  | `AvisoContextoAlterado`                                  | **coberta** (T189)                            | Já segura (inerte até a escolha).                                                                                                  |
| Rota direta na entrada (recarga com `#/…`)                  | `entradaDaUrl`                                           | não se aplica: a edição de antes já se perdeu | Não há o que segurar; o aviso nativo da recarga é o ponto.                                                                         |
| Sessão encerrada por fora (outra aba, expiração, revogação) | `encerrarSessaoLocalmente`                               | nenhuma                                       | **Não deve:** sem sessão, nada pode ser gravado; o certo é avisar que o que não foi salvo se perdeu (G-7).                         |

## 5. O que a aplicação controla e o que depende do navegador

**Dentro da aplicação** (menu, Hub, Sair, abas internas, rotas próprias, troca
de empresa): a navegação só acontece se o shell deixar. A guarda pode mostrar o
diálogo do produto, com o texto e os rótulos que quiser, foco controlado e
"Continuar editando" como saída padrão.

**Voltar/avançar e URL digitada:** o navegador muda a URL **antes** de avisar.
A guarda não impede; ela desfaz (volta a URL para onde estava, sem empilhar
histórico novo) e então pergunta. Isso exige que cada entrada do histórico
criada pelo shell carregue um índice em `history.state`, para saber quanto
desfazer (`history.go(±n)`). Hoje o shell grava `state` nulo.

**Recarregar, fechar a aba, sair para outro site:** só o `beforeunload`. Limites
que a decisão precisa aceitar:

- o texto é do navegador ("Sair do site? As alterações podem não ser
  salvas"), não do Evolli; não dá para listar o que está pendente;
- só aparece se a pessoa interagiu com a página (ativação do usuário);
- celular e alguns navegadores podem não mostrar nada ao fechar a aba ou o app;
- registrado o tempo todo, impede o cache de voltar/avançar do navegador; deve
  existir **só enquanto houver pendência ou salvamento**.

## 6. Arquitetura proposta (reutilizável, no shell)

### 6.1 Um ponto de decisão

Uma **guarda de navegação** no shell (`AutenticacaoApp`, que já possui o
registro e a região de anúncio, e repassa ao `App`):

- `solicitarSaida(intenção)` — `intenção` descreve para onde se vai ("menu:
  Ponto", "Hub", "Sair", "voltar do navegador", "aba Documentos"). Sem
  pendência nem salvamento, executa na hora. Com pendência, abre o diálogo.
  Com salvamento, não abre escolha de descarte: diz "aguarde o salvamento
  terminar", como a troca de empresa já faz.
- **um único diálogo** do shell para todas as saídas, com os rótulos do
  registro ("Há edição em andamento em: Ficha do colaborador.") e duas ações:
  **Continuar editando** (padrão, recebe o foco) e **Sair sem salvar**.
- as telas **não** ganham lógica nova de navegação: continuam só declarando
  `useEdicaoEmAndamento`. As confirmações próprias que já existem (ficha, Nova
  admissão) passam a usar a mesma guarda, para não haver duas perguntas na
  mesma saída (G-3).

### 6.2 Quem chama a guarda

`irPara` (menu e atalhos), `onVoltarAoHub`, `handleLogout`, a troca de aba de
`PessoasScreen`, de `CadastrosScreen` e do dashboard, e as saídas internas da
ficha e da Nova admissão. A troca de empresa continua com o diálogo próprio da T189
(que já é a mesma regra), ou passa a usar o diálogo comum (G-3).

### 6.3 Voltar/avançar

`aoMudarUrl` consulta a guarda antes de aplicar a rota nova. Com pendência:
desfaz a mudança de URL pelo índice em `history.state`, sem disparar outra
troca de tela, e abre o diálogo com a intenção "voltar do navegador". "Sair
sem salvar" refaz a navegação pedida. É a parte mais delicada (eventos
repetidos, duas mudanças seguidas, a correção de URL no lugar da T199) e a que
mais pede teste.

### 6.4 `beforeunload`

Um efeito no shell registra o ouvinte **só** enquanto o resumo tiver pendência
ou salvamento, e o retira quando o resumo esvazia ou depois de uma saída
confirmada (para o logout não disparar o aviso nativo em cima do diálogo do
produto).

## 7. Acessibilidade

- O diálogo é `role="dialog"` modal (o `Modal` existente), com título e
  descrição ligados por `aria-labelledby` e `aria-describedby`.
- Ao abrir, o foco vai a **Continuar editando**; Tab e Shift+Tab ficam no
  diálogo; **Escape = Continuar editando** (nunca descarta).
- Ao continuar, o foco volta ao controle que pediu a saída (item do menu,
  botão Hub, aba); se ele não existir mais, ao título da tela. **Nunca ao
  `body`**, e nunca a um elemento só para leitor de tela.
- Ao sair sem salvar, o foco segue a regra de destino da tela nova (título).
- O diálogo é lido uma vez ao abrir; não há região viva repetindo o conteúdo.
  Uma saída bloqueada por salvamento é anunciada uma vez na região estável do
  shell (a da T189).
- Voltar/avançar desfeito não move o foco por conta própria: o diálogo é que
  recebe o foco.

## 8. Segurança, concorrência e duas abas

- **Nada antes da escolha:** nenhuma gravação, descarte, troca de empresa ou
  logout acontece antes de a pessoa escolher. "Continuar editando" deixa tudo
  como estava, inclusive a URL.
- **Salvamento em andamento:** a guarda não oferece descartar; a requisição já
  saiu. A saída espera (ou é negada com aviso) até o salvamento terminar.
- **Respostas pendentes:** depois de "Sair sem salvar", a tela que sai é
  desmontada; as respostas atrasadas dela já são descartadas pelos guardas de
  montagem que cada tela tem (`vivaRef`, sequência de pedidos). A guarda não
  muda isso.
- **Duas abas:** o registro é **por aba**, e assim deve continuar: a edição
  pendente de uma aba não segura a navegação da outra. O `BroadcastChannel` da
  T189 continua só para contexto de empresa; a guarda **não** transmite
  edições entre abas (nem rótulos, que poderiam conter nomes de pessoas).
- **Sessão encerrada por fora:** sem sessão não há como salvar; segurar a tela
  só daria a impressão de que ainda é possível. O correto é sair e dizer o que
  se perdeu (G-7).
- **Sem armazenamento:** nada em `localStorage` ou `sessionStorage`; nenhum
  rascunho salvo pela guarda.

## 9. Permissões e testes

A guarda é comportamento de interface: **não muda RBAC nem API**. Vale para
quem consegue editar alguma coisa; para quem só lê, o registro fica vazio e a
guarda nunca aparece.

| Papel                                 | Destinos com edição (onde o RBAC permite gravar)                                                               | Guarda aparece?               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| RH                                    | Pessoas, Nova admissão, Cadastros, Jornadas, Ponto, Minha equipe, Administração de liderança, Contas de acesso | Sim                           |
| DP                                    | Pessoas (sem operar Horário), Nova admissão, Cadastros, Jornadas, Ponto, Contas de acesso                      | Sim                           |
| `master_tecnico`                      | Pessoas (ficha só leitura), Cadastros, Jornadas, Ponto, Contas de acesso — só onde o RBAC permite gravar       | Só nas telas em que ele edita |
| gestor                                | Minha equipe (diálogos com `alterado`)                                                                         | Sim, nos diálogos             |
| financeiro, colaborador, auditor, DPO | nenhuma funcional com edição (financeiro só lê Centros de custo; o portal do colaborador é demonstrativo)      | Não                           |

**Testes previstos (quando houver implementação):**

- unidade da guarda: sem pendência executa direto; com pendência abre o
  diálogo; com salvamento não oferece descarte; Escape continua; foco de
  entrada e de volta;
- integração no `App`/`AutenticacaoApp`: menu, Hub, Sair, abas internas,
  voltar/avançar (URL desfeita sem entrada nova no histórico) e URL digitada,
  cada um com "Continuar editando" e com "Sair sem salvar";
- não regressão da T189 (troca de empresa e aviso de outra aba) e das
  confirmações da ficha e da Nova admissão (uma pergunta só por saída);
- `beforeunload` registrado só com pendência, e retirado depois de uma saída
  confirmada;
- por papel: RH e DP com a guarda; leitores (master na ficha, financeiro) sem
  diálogo nenhum;
- localhost com dados sintéticos: cada saída da seção 4, teclado e leitor de
  tela, 375 px.

## 10. Opções de escopo

### Opção A — Guarda das saídas internas (menor)

Menu, atalhos, Hub, Sair e abas internas passam pela guarda; diálogo único;
`beforeunload` só com pendência. Voltar/avançar e URL digitada ficam como
hoje.

- **Prós:** cobre as saídas mais comuns com pouco risco; não mexe no
  histórico.
- **Riscos:** voltar/avançar continua descartando em silêncio — é o caminho
  mais usado no navegador e o mais difícil de perceber.

### Opção B — Guarda completa no shell (recomendada)

A + voltar/avançar e URL digitada (desfazer e perguntar, com índice em
`history.state`) + migração das confirmações da ficha e da Nova admissão para a
guarda única. A troca de empresa continua com o diálogo da T189, que já segue
a mesma regra.

- **Prós:** fecha o gate de produção de Pessoas: nenhuma saída descarta sem
  escolha explícita, dentro do que o navegador permite; uma pergunta só por
  saída.
- **Riscos:** desfazer `popstate` é delicado (eventos em sequência, correções
  de URL da T198/T199); pede testes de histórico e validação em navegador
  real. Ruído nas telas de granularidade "formulário aberto" (G-4).

### Opção C — B + granularidade fina

B + todas as telas passam a declarar pendência só quando algo foi alterado
(comparação com o estado inicial), não ao abrir o formulário.

- **Prós:** pergunta só quando há o que perder.
- **Riscos:** toca onze telas, cada uma com a sua comparação; amplia muito a
  entrega e o risco de regressão. Melhor como entrega própria depois de B.

**Recomendação:** **Opção B**, em uma entrega, mantendo a granularidade atual
(seguro por excesso) e registrando C como próxima evolução.

## 11. Decisões (aprovadas em 2026-11-03)

As oito decisões foram aprovadas como recomendadas: opção B; aviso nativo só
com pendência ou salvamento; ficha e Nova admissão no diálogo da guarda, troca
de empresa no diálogo da T189; granularidade atual; salvamento em andamento
bloqueia com aviso, sem descarte e sem seguir sozinho; Segurança e portal
demonstrativo fora; sessão encerrada por fora sai e avisa a perda; o diálogo
lista os rótulos das telas.

| Id  | Pergunta                                                                                                             | Recomendação                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| G-1 | Qual opção de escopo: A, B ou C?                                                                                     | B.                                                                                              |
| G-2 | Aceitar o aviso nativo do navegador (`beforeunload`), com texto fixo do navegador, só enquanto houver pendência?     | Sim; é a única proteção possível para recarregar e fechar a aba.                                |
| G-3 | Unificar as confirmações da ficha e da Nova admissão (e, opcionalmente, a da troca de empresa) no diálogo da guarda? | Ficha e Nova admissão: sim. Troca de empresa: manter o diálogo da T189, que já é a mesma regra. |
| G-4 | Aceitar que telas de granularidade "formulário aberto" perguntem mesmo sem nada digitado?                            | Sim nesta entrega (seguro por excesso); refinar na Opção C.                                     |
| G-5 | Com salvamento em andamento: bloquear a saída com aviso, ou esperar e seguir sozinho quando terminar?                | Bloquear com aviso, como a troca de empresa; seguir sozinho surpreende.                         |
| G-6 | Incluir o painel de Segurança (código do segundo fator) e o portal demonstrativo na guarda?                          | Não: um é efêmero, o outro não grava nada.                                                      |
| G-7 | Sessão encerrada por fora com edição pendente: só sair, ou sair e avisar o que se perdeu?                            | Sair e avisar, sem listar conteúdo digitado.                                                    |
| G-8 | Texto do diálogo: listar os rótulos das edições (como a T189) ou só dizer "há alterações não salvas"?                | Listar os rótulos: são nomes de telas, não dados de pessoas.                                    |

## 12. Fora de escopo

Implementação de produto, API, schema, migration, RBAC, auditoria, Docker,
seed, dependências, workflow, rascunho salvo automaticamente, transmissão de
edições entre abas, mudança de granularidade das telas (Opção C), push, PR,
promoção e merge.

## 13. Telas cobertas na implementação (levantamento de 2026-11-03)

As 16 declarações de `useEdicaoEmAndamento` existentes na base passam a ser
cobertas pela guarda do shell, sem lógica nova nas telas — a guarda lê o mesmo
registro da T189:

| #   | Declaração (rótulo)                       | Arquivo                                      | Saídas que a guardam                                                         |
| --- | ----------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | título de qualquer `Modal` com `alterado` | `components/Modal.tsx`                       | todas as do shell (o `Modal` cobre a tela; voltar/avançar e recarregar)      |
| 2   | "Contas de acesso"                        | `administracao/ContasAcessoScreen.tsx`       | menu, Hub, Sair, voltar/avançar, rota digitada, recarregar                   |
| 3   | "Centros de custo"                        | `horarios/CentrosCustoScreen.tsx`            | as do shell e a troca de aba de Cadastros                                    |
| 4   | "Estrutura organizacional"                | `horarios/EstruturaOrganizacionalScreen.tsx` | as do shell e a troca de aba de Cadastros                                    |
| 5   | "Ficha do colaborador"                    | `pessoas/FichaColaboradorScreen.tsx`         | as do shell, a trilha da ficha e voltar/avançar para fora da ficha           |
| 6   | "Registrar movimentação"                  | `pessoas/HistoricoFuncionalScreen.tsx`       | as do shell e a troca de aba de Pessoas                                      |
| 7   | "Retificar movimentação"                  | `pessoas/HistoricoFuncionalScreen.tsx`       | as do shell e a troca de aba de Pessoas                                      |
| 8   | "Cargos"                                  | `horarios/FuncoesCargosScreen.tsx`           | as do shell e a troca de aba de Cadastros                                    |
| 9   | "Jornadas de trabalho"                    | `horarios/JornadasTrabalhoScreen.tsx`        | as do shell                                                                  |
| 10  | título da criação inline                  | `pessoas/ModalCriacaoInline.tsx`             | as do shell (dentro da Nova admissão)                                        |
| 11  | título da referência rápida               | `pessoas/ModalReferenciaRapida.tsx`          | as do shell (dentro da Nova admissão)                                        |
| 12  | "Nova admissão"                           | `pessoas/NovaAdmissaoScreen.tsx`             | as do shell e as saídas próprias da página (trilha, Cancelar, Conferir)      |
| 13  | "Documentos"                              | `pessoas/PessoasDocumentosScreen.tsx`        | as do shell e a troca de aba de Pessoas                                      |
| 14  | "Registro de ponto"                       | `ponto/VisaoPeriodoScreen.tsx`               | as do shell (a troca de aba do Ponto é guardada, mas hoje só há uma aba)     |
| 15  | "Horário de trabalho"                     | `pessoas/PessoasHorarioScreen.tsx`           | as do shell, a troca de aba de Pessoas e a saída da aba Jornada do dashboard |
| 16  | "Solicitações"                            | `pessoas/SolicitacoesScreen.tsx`             | as do shell e a troca de aba de Pessoas                                      |

"As do shell" são: menu lateral e atalhos, Hub, Sair, rota digitada,
voltar/avançar e, pelo aviso nativo, recarregar e fechar a aba. A troca de
empresa continua com o diálogo próprio da T189 (G-3).

**Excluídas (G-6):** o painel de Segurança (código do segundo fator, efêmero),
o portal demonstrativo "Minhas solicitações" (não grava nada) e as buscas e
filtros das listagens (não são edição). A granularidade fina ("só pergunta
depois de alterar") fica fora (G-4, opção C).

## 14. Entrega

**Um ponto no shell.** `app/guardaDeSaida.tsx` expõe `useGuardaDeSaida()` com
`solicitarSaida({ executar, area? })`: sem pendência, `executar` roda na hora;
com pendência, abre o diálogo e só a escolha explícita "Sair sem salvar" roda
`executar`. Quem chama não sabe de diálogo nem de registro. O provedor envolve
o shell autenticado em `AutenticacaoApp` e lê o mesmo registro de edições da
T189 (`edicoesPendentes.tsx`), que não muda de forma: só ganha **áreas**.

**Áreas.** Uma saída que desmonta só parte da tela pergunta só pelas edições
dessa parte. `AreaDeEdicao` marca a subárvore e `useEdicaoEmAndamento`
registra o caminho de áreas; `resumir(area)` filtra. As áreas desta entrega
são: ficha, painel de Pessoas (abas internas), aba Jornada do dashboard,
painel de Cadastros (abas internas) e painel do Ponto. Uma saída sem área
(outro destino, Hub, Sair) pergunta por tudo. Uma saída que desmonta mais de
uma área pergunta por todas elas: com a ficha aberta por cima da aba Jornada,
sair para outra aba da listagem conta a ficha e a Jornada.

**Menu no destino já ativo.** O item do destino que já está na tela não
desmonta nada e sai direto, sem perguntar. A exceção é Colaboradores: o item
fecha a ficha e volta a listagem ao início, então pergunta pela ficha e pela
aba Jornada, se elas forem descartadas.

**Quem chama a guarda.** Menu lateral e atalhos do shell (`irPara`), Hub, Sair,
a trilha e o "voltar" da ficha, as abas internas de Pessoas, Cadastros e Ponto,
a saída da aba Jornada do dashboard, a trilha e o Cancelar da Nova admissão,
voltar/avançar e a rota digitada. As confirmações locais da ficha e da Nova
admissão saíram: as duas usam o diálogo único. A frase da T179 ("Nada da Nova
admissão foi salvo." ou o aviso do envio incerto) passou a ser um `aviso` da
declaração da tela, que o diálogo exibe abaixo da lista.

**Diálogo.** `role="alertdialog"`, modal, com título e descrição ligados por
`aria-labelledby`/`aria-describedby`. A descrição lista os rótulos das telas
(nunca o conteúdo digitado). "Continuar editando" é o padrão: recebe o foco
inicial e responde ao Escape. O foco fica preso no diálogo e o resto da árvore
fica `inert`; o clique no fundo não tira o foco do diálogo, não fecha e não
sai. Ao fechar, o foco volta à origem; se a origem saiu da tela, vai à região
principal: o conteúdo do shell, ou a área do Hub depois de "Sair sem salvar"
para o Hub. Nas saídas do navegador (voltar, avançar, rota digitada), o foco
é decidido só depois que a navegação aceita termina; como o menu, essas
navegações fecham a gaveta do celular. Uma região que esteja dentro de
`[inert]` nunca recebe esse foco. A 375 px os botões ocupam a largura e não
há rolagem horizontal.

**Salvamento em andamento.** O diálogo explica que há um salvamento em curso,
oferece só "Entendi" e não navega sozinho quando ele termina (G-5).

**Voltar/avançar e rota digitada.** Cada entrada do histórico leva o próprio
índice em `history.state` (`evolliIndice`). As que o shell escreve já nascem
com ele, e as correções no lugar o preservam. As que o navegador cria (rota
digitada, âncora da página) o recebem quando chegam ao shell: a aplicada, ao
ser aplicada; a rota digitada que a guarda desfaz, antes de ser desfeita. Ao
chegar uma navegação do navegador que
desmontaria algo pendente, o shell volta o navegador para a entrada que a tela
descreve com `history.go(-passo)` e pergunta. A reversão termina quando o
navegador chega de volta à entrada com o índice da tela; a chegada é
reconhecida pelo índice, nunca pela URL. "Sair sem salvar" leva ao destino
escolhido, marcado como aceito, por um de dois caminhos. A exceção registrada:
se a pessoa navegar de novo enquanto a reversão ainda não chegou, a saída
pendente é descartada. O shell anota as entradas que sabe que ainda existem
(índice e URL); uma entrada nova criada pelo navegador apaga as que estavam à
frente dela.

- **Destino ainda no histórico:** o shell anda até a mesma entrada. O salto é
  contado na hora, do índice em que o navegador está até o índice do destino
  (com o diálogo aberto, uma âncora digitada muda essa posição).
- **Destino apagado ou substituído:** com o diálogo aberto, uma âncora ou
  rota digitada pode ter apagado a entrada de destino que estava à frente, ou
  ocupado o lugar dela. A URL aceita, com caminho, parâmetros e fragmento,
  vira então uma entrada nova da própria aplicação (`pushState`), logo depois
  da atual, já com índice e aceita, e é aplicada na hora, sem perguntar de
  novo. O documento não é recarregado e o aviso nativo não aparece. O mesmo
  vale para destino com ou sem hash: com o `location`, um destino sem hash
  navegaria o documento.

Nos dois casos, `history.go(0)` nunca é usado, e o foco segue o caminho
normal da saída concluída. O `popstate` e o `hashchange` do mesmo passo são
deduplicados (sem desfazer dois passos), e uma escolha feita antes de o
navegador terminar de desfazer espera a reversão chegar. Parâmetros e
fragmento da URL são preservados. Abrir a ficha a partir da listagem não
pergunta (a listagem fica montada); trocar de ficha ou sair dela pergunta pela
área da ficha.

A rota digitada é uma entrada nova que o navegador cria logo depois da atual.
Com pendência, o shell grava nela o índice dessa posição e a desfaz com
`history.go(-1)`: a URL volta à da tela, e a entrada digitada fica no
histórico como entrada de avançar. Como em qualquer navegação, ela ocupa a
posição das entradas que antes estavam à frente. Por isso o histórico não é
restaurado como era — embora o tamanho possa coincidir com o de antes, quando
havia exatamente uma entrada à frente. Avançar até ela, num passo ou num salto
de vários, é uma navegação como outra qualquer e pergunta de novo; "Sair sem
salvar" chega exatamente a ela.

**Pular para o conteúdo.** Os links de salto do shell e do Hub só movem o foco
para a região principal: não seguem a âncora, não mudam a URL e não criam
entrada no histórico. Uma âncora da página aberta de outro jeito (digitada)
não troca a tela; a entrada dela ganha índice, para que voltar e avançar
continuem contando passos certos.

**Recarregar e fechar a aba.** `beforeunload` só fica registrado enquanto há
pendência ou salvamento; o texto é o do navegador. A navegação do navegador
para outro documento (por exemplo, voltar além da primeira entrada do shell)
também só conta com esse aviso.

**Duas abas.** As edições ficam na aba: nada delas vai ao `BroadcastChannel`.
O canal da T189 (contexto empresarial) segue igual, e a troca de empresa
continua com o diálogo próprio da T189.

**Sessão encerrada por fora.** Quando a reconferência recebe 401 (ou a sessão
atual é revogada em Sessões ativas), o shell sai sem tentar salvar. Se havia
pendência ou salvamento, o login mostra "Sua sessão foi encerrada. As
alterações que não tinham sido salvas foram perdidas." (`role="alert"`), que
some no próximo login. Sair por escolha não mostra esse aviso.

**Ponto.** A troca de aba do Ponto está guardada, mas no modo funcional só
existe a aba "Visão do período"; a guarda dessa troca fica dormente até haver
uma segunda aba funcional.

**Sem mudança em:** API, schema, migration, RBAC, auditoria, Docker, seed,
dependências, lockfile e workflows.
