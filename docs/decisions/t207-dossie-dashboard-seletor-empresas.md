# T207 — Dashboard funcional e seletor de empresas

## 1. Situação

- **Estado:** implementada e validada localmente, sem push, PR, promoção ou merge (seções 16 a
  19). As decisões V-1 a V-6, E-1 a E-4 e P-1 foram aprovadas em 2026-11-10, conforme a
  recomendação (seção 13.1), e a validação visual foi aprovada pela proprietária no mesmo dia. A
  preparação (levantamento e decisões, seções 2 a 15) foi feita antes, sem código de produto.
- **Branch:** `codex/t207-dashboard-seletor-empresas`, a partir do squash
  `512d24914519fed335a900b18cab690832e8f121` (T206 integrada, PR #199).
- **Fora desta preparação:** código de produto, API, schema, migration, RBAC, auditoria, seed,
  Docker, dependências, lockfile, workflow, push, PR, promoção e merge.

## 2. Objetivo

1. Completar o Dashboard como produto funcional: Visão Geral primeiro e as abas Pessoas,
   Movimentação, Remuneração e Clima e saúde navegáveis, cada uma com rota e estado funcional,
   sem aba decorativa e sem número que o contrato não entregue.
2. Evoluir o seletor de empresa ativa: controle compacto, lista das empresas da conta, empresa
   atual, compatível com a troca da T189, com a guarda da T200 e com a faixa lateral da T206
   (expandida, trilho e gaveta do celular).

## 3. O Dashboard hoje (T205)

- **Rota:** `#/dashboard?ano=AAAA` (ano civil; corrente até hoje; mínimo 2000; ausente,
  inválido ou futuro corrigido no lugar, sem entrada nova no histórico) — `rotasDoShell.ts`.
- **Papéis:** `rh`, `dp` e `master_tecnico` (`PAPEIS_DASHBOARD`, `mapaNavegacao.ts`). O
  `master_tecnico` sem empresa ativa vê só a orientação, sem consulta. Gestor aterrissa em Minha
  equipe; demais papéis, no Hub.
- **Elementos:** E-1 período; E-2 resumo (pessoas ativas e em admissão hoje; admissões e
  desligamentos efetivados no ano, em vínculos, e a diferença, com frase); E-3 ativos por tipo de
  vínculo com atalho à listagem; E-4 admissões e desligamentos efetivados por mês (barras em CSS
  e tabela equivalente); E-5 momento da leitura e "Atualizar".
- **Leitura:** `GET /v1/colaboradores?tamanhoPagina=1` (só `contadores`) e
  `GET /v1/movimentacoes?tipo&status=efetivada` paginado de 100 em 100, de trás para frente,
  com teto de 20 páginas por série; acima do teto, aviso e nenhum número parcial
  (`dashboardDados.ts`).
- **Qualidade já garantida:** foco no título, um nó de status, alertas só de falha, nova
  tentativa por bloco, descarte de resposta atrasada e interrupção da paginação obsoleta, troca
  de empresa recria a tela, 375 px sem rolagem horizontal.

## 4. Inventário de dados reais

Regra comum: as listagens de Pessoas paginam com 20 por padrão e 100 no máximo; o isolamento
por empresa vem da sessão (empresa de outra empresa devolve página vazia, não erro). Pessoas
(`colaborador`, `vinculo_funcional`, `movimentacao_funcional`): `rh` e `dp` leem na própria
empresa; `master_tecnico` só lê (global, auditado, sem empresa ativa); `gestor`, `colaborador` e
`admin_tecnico` são negados.

| Indicador                                            | Existe? | Fonte real                                                                                                                          | Limite                                                                                        |
| ---------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Pessoas ativas hoje                                  | Sim     | `GET /v1/colaboradores` → `contadores.ativos`                                                                                       | Empresa inteira; ignora filtros                                                               |
| Em admissão, desligados e inativos hoje              | Sim     | `contadores.emAdmissao`, `desligados`, `inativos`                                                                                   | Idem                                                                                          |
| Ativos por tipo de vínculo                           | Sim     | `contadores.ativosPorTipo` (clt, estágio, pj, temporário, outro controlado)                                                         | Idem                                                                                          |
| Ativos por departamento ou cargo                     | Parcial | `GET /v1/colaboradores?departamentoId` / `cargoId` → `total`, um pedido por nó                                                      | Sem agregado no servidor; sem filtro por unidade, área ou centro de custo                     |
| Admissões e desligamentos por mês                    | Sim     | `GET /v1/movimentacoes?tipo&status=efetivada`, agrupado no cliente por `vigenciaInicio`                                             | Sem filtro de período; teto de 20 páginas por série                                           |
| Transferências e mudanças de cargo por mês           | Sim     | Mesmo contrato, `tipo=transferencia_organizacional` / `mudanca_cargo`                                                               | Idem                                                                                          |
| Pessoas ativas no fim de cada mês (quadro histórico) | Não     | Só reconstruível paginando todos os vínculos por `dataAdmissao`/`dataDesligamento`                                                  | Semântica de `dataDesligamento` não fixada; vínculos previstos com data passada; custo alto   |
| Turnover                                             | Não     | Nada calcula; exige média de ativos do período e fórmula aprovada                                                                   | Sem headcount histórico nem regra                                                             |
| Absenteísmo                                          | Não     | Ponto guarda só marcações brutas; apuração, banco de horas e fechamento não estão ligados a endpoint; não há afastamento nem férias | ADR 0008 proíbe indicador de horas, saldo ou atraso                                           |
| Custo por pessoa / remuneração                       | Não     | Nenhum salário, folha, benefício ou valor no schema; centro de custo é só catálogo                                                  | A folha oficial é sistema externo (ADR 0017); salário é dado restrito não coletado (ADR 0016) |
| Clima e saúde                                        | Não     | Nenhuma pesquisa, eNPS, ASO ou CID; "atestado" é só tipo de solicitação, sem dado de saúde                                          | A T205 proíbe agregar por atestado                                                            |
| Solicitações de pessoas por situação                 | Parcial | `GET /v1/solicitacoes-pessoas?situacao` → `total`                                                                                   | Só `rh` lê (DP negado); toda leitura é auditada                                               |
| Documentos pendentes                                 | Parcial | `GET /v1/solicitacoes-documento` (estado `pendente`)                                                                                | Decisão de produto pendente                                                                   |

## 5. Visão Geral, indicador por indicador

1. **Colaboradores ativos — real.** Pessoas ativas hoje (`contadores.ativos`). O complemento "no
   ano" pode ser o saldo de admissões e desligamentos efetivados no ano, desde que o rótulo diga
   a unidade: **vínculos**, não pessoas (regra da T205).
2. **Turnover — exige definição e contrato.** Não existe média de ativos do período nem fórmula
   aprovada. Também não há motivo jurídico do desligamento (voluntário, involuntário), então nem a
   variante "voluntário" é possível. Mostrar 0,0% seria número falso.
3. **Absenteísmo — indisponível no Evolli.** Não há horas apuradas, faltas nem afastamentos; o
   ponto guarda só marcações. Depende da integração e da apuração do ponto, ainda pendentes.
4. **Custo por pessoa — fora do Evolli hoje.** O Evolli não recebe folha nem salário, e não existe
   "folha fechada" no produto. Não há destino real para uma ação; o estado deve dizer que o custo
   vem da folha, que ainda não está integrada, sem botão.
5. **Quadro de colaboradores e movimentação mensal — parcial.** A movimentação mensal (entradas e
   saídas efetivadas por mês) é real e já existe. A linha de "ativos no fim de cada mês" não tem
   fonte oficial.
6. **Momento da leitura — real** (E-5).
7. **Como calculamos — possível só para o que é real:** fonte, unidade, regra de status e
   vigência, e o teto da série.

## 6. Abas

| Aba           | Dado real hoje                                                                                                                                  | Proposta                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Visão Geral   | Ativos, em admissão, movimentação mensal, ativos por tipo, momento da leitura                                                                   | Pronta na primeira fatia, com os cards sem dado em estado próprio               |
| Pessoas       | Ativos, em admissão, desligados e inativos hoje; ativos por tipo de vínculo; atalhos à listagem; por departamento ou cargo com um pedido por nó | Pronta na primeira fatia (o recorte por departamento depende de V-3)            |
| Movimentação  | Admissões, desligamentos, transferências e mudanças de cargo efetivadas por mês                                                                 | Pronta na primeira fatia, reaproveitando a leitura da T205 para os quatro tipos |
| Remuneração   | Nenhum                                                                                                                                          | Rota e estado "indisponível no Evolli", sem número e sem botão                  |
| Clima e saúde | Nenhum                                                                                                                                          | Rota e estado "indisponível no Evolli", sem número e sem botão                  |

## 7. Requisitos transversais (já exigidos e mantidos)

- Rota por aba e por período, corrigida no lugar quando inválida; voltar, avançar e recarregar
  funcionam (padrão da T205).
- Permissões por papel antes de qualquer consulta; `master_tecnico` sem empresa não consulta.
- Empresa ativa da sessão; troca de empresa recria a tela e foca o título (T189).
- Foco no título ao entrar e ao trocar de aba; abas com padrão de abas acessível (setas, Home,
  End; `aria-selected`; painel rotulado) ou links de navegação, nunca os dois misturados.
- Um nó de status para carregamento e resultado; alerta só para falha; nova tentativa por bloco.
- Resposta atrasada descartada e paginação obsoleta interrompida (T205).
- 375 px sem rolagem horizontal; alvos de 44 px no celular; abas roláveis dentro do próprio quadro.

## 8. Seletor de empresa hoje

- **Componente único** (`SeletorEmpresaAtiva.tsx`) no topo da faixa lateral e no Hub. Mostra
  monograma, nome e código; vira botão só quando o papel troca e há outra empresa; senão é cartão
  de leitura ("Acesso global — todas as empresas" ou "Não disponível para o seu perfil" sem
  empresa).
- **Quem troca:** `rh` (empresas concedidas à conta e a própria) e `master_tecnico` (todas as
  ativas). `GET /v1/auth/contexto/empresas` devolve `{id, codigo, nome}` ordenado por código, sem
  paginação; `POST /v1/auth/contexto/empresa` troca, com CSRF e auditoria na mesma transação; 404
  igual para inexistente, inativa ou não autorizada.
- **Teclado e leitor de tela:** botão com `aria-expanded`/`aria-controls`; seta para baixo abre;
  setas, Home e End percorrem; Escape (na captura, antes da gaveta) fecha e devolve o foco; clique
  fora e Tab para fora fecham; status e alertas próprios.
- **Edição pendente:** salvamento em andamento trava as opções; pendência abre confirmação no
  próprio painel ("Continuar editando" com o foco inicial, "Trocar e descartar"). Com aviso de
  contexto alterado por outra aba, a guarda global fica suspensa (T200).
- **Faixa lateral (T206):** no trilho mostra só o monograma (ou um símbolo, sem empresa); acionar
  expande o menu e abre a lista no mesmo gesto. Na gaveta do celular, o painel abre no fluxo.

## 9. Lacunas do seletor

- **Documento fiscal da empresa:** não existe no schema, na API nem no contrato do seletor
  (pendência DP-4 / DP-M-04); um teste proíbe o termo no componente. Mostrar exigiria decisão,
  migration e ampliação do contrato.
- **Lista longa:** sem paginação nem limite (o `master_tecnico` recebe todas as ativas) e sem
  busca nem rolagem no painel.
- **Adicionar empresa:** a API cria empresa (`POST /v1/empresas`), mas só com escopo global — o
  `master_tecnico` **sem** empresa ativa. Não há cliente web nem tela. No seletor, quase sempre com
  empresa ativa, daria 403.
- **Gerenciar empresas:** a API edita o nome, inativa e reativa; não há tela.
- **Conceder empresas a uma conta:** não há rota nem tela; hoje só pelo seed.
- **Voltar ao acesso global sem novo login:** não existe.

## 10. Proposta visual Evolli

### 10.1 Paleta-base

| Papel        | Cor                              | Uso                                                          | Contraste                                                                                                        |
| ------------ | -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Azul-marinho | `#0B2D5B`                        | Fundo da faixa lateral (se aprovado em P-1), títulos fortes  | Branco sobre ele: alto (texto em qualquer tamanho)                                                               |
| Azul         | `#0066FF`                        | Ação principal, item ativo, foco, links                      | Branco sobre ele e ele sobre branco: acima de 4,5:1 (texto normal)                                               |
| Verde-água   | `#00D4A3`                        | Destaque positivo, marcação de dado novo, ícone de tendência | Sobre branco: abaixo de 3:1 — **nunca como cor de texto nem como único sinal**; texto escuro sobre ele é legível |
| Branco       | `#FFFFFF`                        | Superfícies, cards                                           | —                                                                                                                |
| Preto        | `#000000` (texto em tom próximo) | Texto principal                                              | —                                                                                                                |

**Tons de apoio (decisão interna Evolli, a validar em P-1):** um azul muito claro para superfície
de destaque, um cinza-azulado para fundo da área de conteúdo, um marinho mais claro para
separadores na faixa escura e um verde-água claro para fundo de selo positivo. Todos derivados
das cores-base, com contraste conferido antes do uso.

### 10.2 Componentes

- **Faixa lateral:** marinho, com a empresa ativa num cartão claro no topo; item ativo em azul
  sólido com texto branco, mais a barra/forma e `aria-current` (nunca só cor); rótulos de seção
  em maiúsculas discretas. **Só seções com itens reais** — nenhum item sem rota.
- **Cards de indicador:** mesma altura e grade; rótulo, número grande, unidade explícita
  ("pessoas", "vínculos"), linha de contexto e, quando real, "Como calculamos". Card sem dado
  usa o mesmo molde, com "—" no lugar do número e uma frase própria.
- **Bloco de destaque do resumo:** superfície de azul muito claro, frase com os números reais
  em negrito azul.
- **Abas:** sublinhado azul na aba ativa, com `aria-selected`; roláveis no celular.
- **Seletor:** monograma em quadrado azul com iniciais brancas; nome em negrito e código abaixo;
  ícone de abrir/fechar; lista "Empresas da conta" com a atual marcada por ícone, texto e
  `aria-current`.

### 10.3 Contraste e risco

O azul de ação atual (`#0066cc`) e a faixa branca são da T159. Trocar a cor de ação e a faixa
afeta todas as telas — por isso P-1 propõe introduzir os tokens Evolli e aplicá-los primeiro ao
shell, ao Dashboard e ao seletor, com um teste de contraste por par de cores.

## 11. Riscos

1. **Número falso:** turnover, absenteísmo ou custo como "0,0%" seriam lidos como dado. Mitigação:
   V-2 (estado próprio, "—", texto e nenhuma linha de tendência).
2. **Série histórica frágil:** reconstruir ativos por mês no cliente depende da semântica de
   `dataDesligamento` e lê todos os vínculos. Mitigação: V-1 deixa a linha de fim de mês fora até
   haver agregado no servidor.
3. **Teto da série:** empresas com mais de 2.000 movimentações de um tipo no ano veem o aviso, não
   o número (comportamento da T205).
4. **Auditoria por leitura:** contar solicitações por situação grava um evento por leitura; fica
   fora da primeira fatia.
5. **Identidade visual global:** trocar cor de ação e faixa muda o produto inteiro. Mitigação: P-1
   em etapas, com testes de contraste e validação nas telas existentes.
6. **Botões sem produto:** "Adicionar empresa" e "Gerenciar empresas" levariam a 403 ou a lugar
   nenhum. Mitigação: E-2.
7. **Itens de menu sem rota:** uma faixa com seções completas convida a criar itens vazios.
   Mitigação: só itens com rota e permissão reais.

## 12. Escopo proposto da primeira implementação (após aprovação)

- Rota por aba com período compartilhado; as cinco abas navegáveis.
- Visão Geral com cards de ativos (real), turnover (requer definição), absenteísmo
  (indisponível), custo por pessoa (fora do Evolli), movimentação mensal (real), momento da leitura
  e "Como calculamos" nos indicadores reais.
- Pessoas e Movimentação com dados reais; Remuneração e Clima e saúde com estado próprio.
- Seletor: aparência Evolli, sem mudar contrato nem comportamento da troca; busca local quando a
  lista for longa (E-1).
- Aplicação da paleta conforme P-1.

**Fora de escopo da primeira implementação:** endpoint novo, agregado no servidor, schema,
migration, RBAC, auditoria, seed, documento fiscal da empresa, criação e gestão de empresas,
concessão de empresas a contas, folha, salário, ponto apurado, pesquisas, itens de menu sem rota,
exportação e IA.

## 13. Decisões para aprovação

Cada decisão traz a recomendação primeiro.

### 13.1 Aprovação (2026-11-10)

A proprietária aprovou V-1 a V-6, E-1 a E-4 e P-1 **conforme a recomendação** abaixo. Na
implementação: Pessoas mostra só a distribuição por tipo de vínculo; Movimentação mostra as
quatro movimentações mensais efetivadas; o quadro mensal deixa claro que representa eventos do
período, não pessoas ativas; a paleta Evolli vale só para o menu lateral, o Dashboard e o seletor;
o seletor não mostra documento fiscal nem as ações de adicionar e gerenciar empresas.

### 13.2 Decisões

- **V-1 — recorte da primeira Visão Geral.**
  - **Recomendado (A):** cards de ativos (real), turnover, absenteísmo e custo (estados próprios),
    movimentação mensal (real, a série da T205), ativos por tipo, momento da leitura; sem linha de
    ativos no fim de cada mês.
  - B: A mais a linha de fim de mês reconstruída no cliente, com aviso de método (risco 2).
  - C: só os cards reais, sem os três cards sem dado.
- **V-2 — card sem dado ou contrato.**
  - **Recomendado:** mesmo molde do card real; "—" no lugar do número; selo de estado em texto
    ("Requer definição", "Indisponível no Evolli"); frase que explica o que falta; nenhuma linha
    de tendência, nenhuma porcentagem, nenhum botão sem destino real; leitor de tela ouve o nome
    do indicador, o estado e a frase.
  - Alternativa: esconder o card até haver dado.
- **V-3 — abas prontas agora.**
  - **Recomendado:** Visão Geral, Pessoas e Movimentação com dados reais; Remuneração e Clima e
    saúde com rota e estado "indisponível no Evolli". Turnover, absenteísmo, custo e ativos por mês
    exigem contrato novo (endpoint agregado e fórmula) em tarefa própria.
  - Alternativa: esconder Remuneração e Clima e saúde até haver dado.
  - Sub-decisão: em Pessoas, ativos por departamento com um pedido por departamento (até um
    limite) ou só por tipo de vínculo. Recomendado: só por tipo nesta fatia.
- **V-4 — período e URL.**
  - **Recomendado:** ano civil, como na T205, compartilhado entre as abas; a aba no caminho:
    `#/dashboard?ano=AAAA` (Visão Geral, compatível com a T205) e
    `#/dashboard/<aba>?ano=AAAA` para as demais; aba ou ano inválidos corrigidos no lugar.
  - Alternativas: aba como parâmetro (`?aba=`); granularidade mensal ou trimestral (fica para
    quando houver agregado no servidor).
- **V-5 — "Como calculamos".**
  - **Recomendado:** um "Como calculamos" por indicador **real**, como disclosure acessível (botão
    com `aria-expanded` e texto no fluxo), com fonte, unidade, regra (status efetivada, vigência no
    período), período e limite. Cards sem dado não têm "Como calculamos"; têm a explicação do que
    falta.
  - Alternativa: uma única seção de metodologia no pé da página.
- **V-6 — papéis.**
  - **Recomendado:** `rh`, `dp` e `master_tecnico` com empresa ativa veem todas as abas;
    `master_tecnico` sem empresa vê a orientação de escolher empresa em qualquer aba, sem
    consulta; `gestor` e demais papéis não têm o Dashboard (vão ao destino do próprio papel, como
    na T205).
- **E-1 — conteúdo e comportamento do seletor.**
  - **Recomendado:** monograma, nome e código; lista "Empresas da conta" com a atual marcada
    (ícone, texto e `aria-current`); busca local quando a lista passar de 8 empresas, filtrando a
    lista já carregada; cartão de leitura quando não há troca; sem documento fiscal até decisão de
    DP-4.
  - Alternativa: incluir o documento fiscal (exige decisão, migration e contrato).
- **E-2 — Adicionar e Gerenciar empresas.**
  - **Recomendado:** **não** criar os botões agora. Registrar a lacuna e propor, em tarefa
    própria, uma tela "Empresas" para o `master_tecnico` em acesso global, sobre a API existente
    (criar, renomear, inativar, reativar); só então o seletor ganha "Gerenciar empresas", visível
    só para quem pode. Conceder empresas a contas exige API nova.
  - Alternativa: incluir a tela de empresas nesta entrega (aumenta escopo e risco).
- **E-3 — teclado, foco e responsividade.**
  - **Recomendado:** manter o padrão da T189 (botão com `aria-expanded`, lista de botões, setas,
    Home, End, Escape devolvendo o foco, clique e Tab para fora fechando); no trilho, acionar
    expande e abre (T206); na gaveta, painel no fluxo, alvos de 44 px, nomes longos quebrando
    linha, sem rolagem horizontal a 375 px; busca com rótulo visível e contagem anunciada.
- **E-4 — troca de empresa e edição pendente.**
  - **Recomendado:** nenhuma mudança de comportamento: mesma troca (T189), mesma confirmação com
    pendência, mesma trava com salvamento, guarda global suspensa com aviso de contexto (T200);
    toda mudança visual preserva os testes existentes.
- **P-1 — aplicação da paleta Evolli.**
  - **Recomendado:** introduzir os tokens Evolli (marinho, azul, verde-água e tons de apoio) e
    aplicá-los nesta entrega ao shell (faixa marinho com item ativo azul), ao Dashboard e ao
    seletor, com teste de contraste por par; a troca global da cor de ação nas demais telas fica
    para uma etapa própria.
  - Alternativa A: só Dashboard e seletor, mantendo a faixa branca.
  - Alternativa B: troca global de uma vez.

## 14. Critérios de aceite e testes (para a implementação)

- Nenhum número sem fonte real; cards sem dado nunca mostram 0 nem tendência.
- Cada aba com rota, título, foco ao entrar, estado de carregamento, falha e nova tentativa.
- Testes de rota (aba e ano inválidos), de papel (incluindo `master_tecnico` sem empresa), de troca
  de empresa, de resposta atrasada, de 375 px e de contraste dos tokens.
- Seletor: testes atuais da T189, T200 e T206 intactos; busca local com teclado e anúncio.
- Mutações para cada proteção nova; validação local com dados sintéticos.

## 15. Evidências

- Dashboard: `apps/web/src/screens/dashboard/DashboardScreen.tsx`, `dashboardDados.ts`;
  `apps/web/src/app/rotasDoShell.ts`; `apps/web/src/app/mapaNavegacao.ts`.
- Contratos: `apps/api/src/pessoas/colaborador/colaborador.service.ts` (contadores);
  `apps/api/src/pessoas/dto/pessoas.dto.ts` (filtros de colaboradores e movimentações);
  `apps/api/src/pessoas/movimentacao/movimentacao.service.ts`; `apps/api/prisma/schema.prisma`
  (tipos e status de movimentação, ausência de salário, ponto só com marcações, empresa sem
  documento fiscal).
- RBAC: `apps/api/src/auth/authorization/rbac.evaluator.ts` (Pessoas, ponto, solicitações,
  organização).
- Empresas: `apps/api/src/auth/session/contexto-empresarial.ts`;
  `apps/api/src/auth/contexto-empresarial.service.ts`;
  `apps/api/src/organizacao/empresa/empresa.service.ts`;
  `apps/web/src/api/contextoEmpresarialClient.ts`; `apps/web/src/app/SeletorEmpresaAtiva.tsx`.
- Decisões: T205 (seções 8, 12 e 15), T189, T163, T200, T206; ADRs 0006, 0007, 0008, 0010, 0012,
  0016 e 0017; pacotes de integração do ponto e de banco de horas.

## 16. Entrega

Implementada e validada localmente, com a validação visual aprovada pela proprietária em
2026-11-10. Sem push, PR, promoção ou merge. Só web e testes.

### 16.1 Decisões preservadas

V-1 a V-6, E-1 a E-4 e P-1 valem como aprovadas (seção 13), com estes detalhes da entrega:

- **V-1:** a Visão Geral tem Resumo, os quatro cards, o Quadro de colaboradores, Distribuição do
  time, eNPS, Quem é o time, Tempo de casa, Pessoas hoje e Pessoas ativas por tipo de vínculo.
  Ativos no fim de cada mês não são reconstruídos no navegador.
- **V-2:** turnover, absenteísmo e custo por pessoa no molde do card real, com "—" escondido do
  leitor, selo em texto e o que falta; sem número, porcentagem, tendência ou ação.
- **V-3:** Visão Geral, Pessoas e Movimentação com dados reais; Remuneração e Clima e saúde com
  rota e estado de indisponibilidade, sem consulta.
- **V-4:** `#/dashboard?ano=AAAA` e `#/dashboard/<aba>?ano=AAAA`; aba ou ano inválidos corrigidos
  no lugar; trocar aba ou ano cria uma entrada no histórico.
- **V-5:** "Como calculamos" só em indicador real — disclosure nos cards e blocos, e botão de
  informação junto do título no Quadro de colaboradores.
- **V-6:** `rh`, `dp` e `master_tecnico` com empresa ativa; `master_tecnico` sem empresa vê a
  orientação, sem consulta; `gestor` e os demais papéis vão ao destino do próprio papel.
- **E-1 a E-4:** seletor com monograma, nome e código, lista "Empresas da conta" com a atual
  marcada, busca acima de 8 empresas, sem documento fiscal e sem ações de adicionar ou gerenciar;
  troca, confirmação com pendência e guarda global como na T189 e na T200.
- **P-1:** tokens Evolli no menu lateral, no Dashboard e no seletor; o cabeçalho e as outras
  telas seguem com as cores neutras.

### 16.2 O que a Visão Geral mostra

- **Barra superior:** o nome "Dashboard" junto da área principal, só visual. Acima de 640 px o
  título da tela sai da vista (continua no documento como título e alvo do foco de entrada);
  abaixo disso a barra não tem espaço para o nome e o título aparece.
- **Momento da leitura:** uma vez só em cada aba — na Visão Geral, no card do Resumo, com a marca
  verde-água (decorativa, o texto em tom neutro); em Pessoas e Movimentação, junto de
  "Atualizar".
- **Quadro de colaboradores:** título, subtítulo, botão de informação, pessoas ativas hoje e os
  totais de entradas, saídas e saldo do ano. Duas vistas com os mesmos números:
  - gráfico: um botão por mês (uma parada de Tab; setas, Home e End sem volta; Escape fecha o
    painel e o foco fica no mês); o painel do mês fica ao lado da coluna, dentro do quadro, e é a
    descrição do botão focado, sem região viva;
  - tabela: Mês, Ativos no fim, Entradas, Saídas e Turnover, com total.
- **Menu de ações (reticências):** só nos blocos com dado real (Quadro de colaboradores,
  Distribuição do time e Tempo de casa). "Ver como tabela" ou "Ver como gráfico", "Baixar CSV" e
  "Exportar PDF". Botão de menu com nome e estado; setas com volta, Home, End, Enter e Espaço;
  Escape fecha e devolve o foco ao botão; Tab, clique ou foco fora fecham. O menu fica dentro do
  bloco, abaixo da altura real do cabeçalho fixo.
- **Vista escolhida:** em memória, como a preferência do menu recolhido da T206 — vale nesta aba
  do navegador para a mesma conta na mesma empresa; outra conta, outra empresa ou o logout a
  apagam. Nada em armazenamento do navegador.
- **Distribuição do time e Tempo de casa:** gráfico e tabela, com os grupos e faixas já seguros
  (seção 16.4).

### 16.3 Dados reais e indisponíveis

| Bloco ou coluna                    | Situação                                                          |
| ---------------------------------- | ----------------------------------------------------------------- |
| Colaboradores ativos, Pessoas hoje | Real: contadores da listagem de Colaboradores.                    |
| Pessoas ativas por tipo de vínculo | Real: contadores por tipo.                                        |
| Entradas, Saídas e Saldo (quadro)  | Real: admissões e desligamentos efetivados, por mês de vigência.  |
| Movimentação (quatro tipos)        | Real: movimentações efetivadas, por mês de vigência.              |
| Distribuição do time               | Real: departamento da lotação vigente das pessoas ativas.         |
| Tempo de casa                      | Real: admissão do vínculo principal e o dia de hoje do navegador. |
| Ativos no fim (quadro)             | Indisponível: "—", lido como "indisponível".                      |
| Turnover (quadro e card)           | Indisponível: "—"; o card diz "Requer definição".                 |
| Absenteísmo, Custo por pessoa      | Indisponível no Evolli.                                           |
| eNPS, Quem é o time                | Indisponível, sem número, gráfico, tabela, exportação ou ação.    |
| Remuneração, Clima e saúde         | Abas com estado de indisponibilidade, sem consulta.               |

Nenhum dado ausente aparece como zero ou "0,0%" — nem no gráfico, nem no painel do mês, nem na
tabela, nem no CSV.

### 16.4 Limites de contrato e privacidade

- **Ativos no fim de cada mês:** o vínculo guarda a situação de hoje, mas não quando passou de
  previsto a ativo, e o contrato não define se a data de desligamento é o último dia trabalhado.
  Sem uma regra aprovada (corte do desligamento, vínculos previstos, vínculos sem movimentação de
  admissão, pessoa ou vínculo), o número seria inventado. Exige decisão e leitura própria no
  servidor.
- **Turnover:** sem fórmula aprovada e sem a série de ativos.
- **Distribuição:** só departamento; centro de custo, área e unidade não fazem parte da
  listagem.
- **Quem é o time:** idade, gênero e escolaridade são dados pessoais restritos; exige regra de
  privacidade aprovada.
- **Teto de leitura:** as pessoas ativas de hoje são lidas de 100 em 100 até 2.000; acima disso os
  dois blocos do time mostram só o aviso do limite. Cada tipo de movimentação também para em
  2.000 no ano.
- **Privacidade:** com menos de 3 pessoas ativas, Distribuição e Tempo de casa não são exibidos;
  departamentos com menos de 3 pessoas e quem não tem departamento vigente formam um grupo neutro,
  sem nome; faixa de tempo de casa com 1 ou 2 pessoas se junta à vizinha até ter 3, então todo
  número exibido é exato e nada pode ser deduzido pela diferença para o total. Nenhum nome de
  pessoa aparece no Dashboard nem nos arquivos.

### 16.5 Exportação

- **CSV:** gerado no navegador com os números que o bloco mostra; BOM UTF-8, ponto e vírgula,
  cabeçalho legível, um mês (ou grupo, ou faixa) por linha, "—" no que não tem fonte, sem linha
  de total, sem dado pessoal. O nome do arquivo leva o bloco, a empresa e o ano (ou "hoje").
- **PDF:** a impressão do navegador, que oferece "Salvar como PDF". Antes de abrir, tudo o que não
  é o bloco escolhido (menu lateral, cabeçalho, outros blocos) sai da impressão; a folha leva a
  empresa, o bloco e o período; menu e informação não são impressos; ao fim da impressão a página
  volta como estava. A ação diz, na descrição e no anúncio, que o destino "Salvar como PDF" está
  na impressão. Nenhuma dependência nova e nenhum arquivo gerado fora do navegador.

## 17. Achados corrigidos durante a implementação

Cada um com teste que falhava antes da correção:

1. **Faixa de tempo de casa deduzível:** "menos de 3" ao lado das outras faixas e do total
   entregava a quantidade escondida. Agora a faixa se junta à vizinha; o teste percorre todas as
   composições de 0 a 4 pessoas por faixa.
2. **Alerta duplicado:** a falha da leitura das pessoas ativas gerava dois alertas e duas novas
   tentativas. Agora há um só, na Distribuição; o Tempo de casa diz que depende da mesma leitura.
3. **Painel do mês sobre a barra inspecionada:** passou para o lado da coluna, sem passar da
   borda.
4. **Nome da tela na barra com cor da paleta:** passou à cor neutra do cabeçalho (teste de paleta).
5. **Segundo bloco de 640 px no CSS do shell:** a regra foi para o bloco existente (contrato
   responsivo do shell).
6. **Menu atrás do cabeçalho fixo a 375 px:** a barra quebra e fica mais alta que a nominal; o
   menu passou a rolar pela altura real, mantendo botão e menu à vista.
7. **Título repetido:** o título grande da tela repetia o nome da barra; saiu da vista acima de
   640 px.
8. **Momento da leitura repetido:** aparecia no Resumo e junto de "Atualizar"; agora uma vez por
   aba.
9. **Selo "Atual" no seletor:** quebrava palavras na faixa estreita; foi para baixo do nome.
10. **Informação presa depois de soltar fora** (achado das mutações): pressionar o botão de
    informação e soltar fora dele, sem clique, deixava uma marca de "veio do ponteiro" que impedia
    o foco pelo teclado de abrir o painel depois. A marca foi removida; foco abre, o primeiro
    clique ou Enter fixa e o segundo fecha.
11. **Rolagem sem caixa desenhada** (achado da validação final): o menu tentava rolar a página
    mesmo sem caixa (sem layout). Agora só rola quando há o que mostrar.

## 18. Evidências da entrega

### 18.1 Testes automatizados

- `DashboardScreen.test.tsx` (105 testes): as garantias da T205 reescritas sobre a estrutura nova
  (nenhuma removida); cinco abas, rota e foco; cards honestos; Quadro de colaboradores (título,
  subtítulo, informação por ponteiro, foco, clique e Escape, sem região viva), gráfico com painel
  por mês (teclado, ponteiro, Escape, `aria-describedby`, posição), tabela com "—" lido como
  "indisponível", menu de ações (nome, estado, setas, Home, End, Escape, Tab, clique e foco fora,
  rolagem abaixo do cabeçalho fixo), os mesmos números no gráfico, no painel, na tabela e no CSV,
  CSV real (BOM, separador, cabeçalho, linhas, nome com empresa e ano), impressão só do bloco e
  limpeza depois, Distribuição e Tempo de casa com gráfico, tabela, CSV e impressão, privacidade,
  teto, falha com um único alerta, respostas atrasadas, desmontagem, hora da leitura uma vez por
  aba e o contrato de CSS a 375 px.
- `dashboardTime.test.ts` (18 testes, novo): leitura das pessoas ativas (páginas, teto, repetidos,
  abandono), distribuição com grupo neutro, mediana e faixas, e a composição exaustiva de faixas
  (0 a 4 pessoas em cada uma) sem nenhuma faixa entre 1 e 2.
- `App.dashboard.test.tsx` (34 testes): rota, ano, histórico, papéis, abas no shell, "Dashboard"
  na barra só visual e título único com o foco, vista vinda de quem monta o shell, contrato de
  CSS do nome na barra.
- `AutenticacaoApp.test.tsx` (89 testes, 2 novos): a vista sobrevive à volta pelo Hub, e outra
  conta (depois do logout) ou outra empresa começam no gráfico.
- `rotasDoShell.dashboard.test.ts` (24), `SeletorEmpresaAtiva.test.tsx` (42) e
  `paletaEvolli.test.ts` (14): rota das abas, seletor e paleta, como na primeira implementação.
- Suíte web completa: 128 arquivos, 3598 testes. Numa rodada anterior, um teste de Nova admissão (arquivo que a T207 não
  altera) estourou o limite de 5 s sob carga; sozinho, o arquivo passou com 263 de 263, e a rodada
  seguinte da suíte completa passou inteira. API unitária: 60 suítes, 1472 testes. E2E serial com
  PostgreSQL real: 20 suítes, 1017 testes. Scripts: 182 testes. Lint, typecheck e build verdes. A
  API não mudou; a API unitária e o E2E rodaram como regressão.

### 18.2 Mutações

35 mutações temporárias, todas detectadas:

- privacidade: departamento de 2 pessoas exibido, distribuição com menos de 3 pessoas, faixa
  pequena que não se junta;
- leitura: sem deduplicação entre páginas, página seguinte pedida depois de abandonar, média no
  lugar da mediana;
- quadro: ativos no fim como zero, célula sem fonte sem texto para o leitor, painel do mês sem as
  métricas indisponíveis;
- CSV: sem BOM, vírgula no lugar do ponto e vírgula, indisponível como vazio, nome sem a empresa;
- impressão: irmãos que não saem da impressão, marcação que não é desfeita, impressão com a tela
  já desmontada;
- menu: Escape sem devolver o foco, setas sem volta, clique fora sem fechar, menu atrás do
  cabeçalho fixo, rolagem sem caixa desenhada, menu num bloco sem dados;
- informação: Escape sem fechar, foco sem abrir;
- gráfico: painel sobre a coluna inspecionada, Escape sem fechar o painel;
- tela e shell: hora da leitura repetida ao lado de "Atualizar", vista sem repasse ao shell, vista
  que sobrevive à troca de empresa, nome da barra anunciado ao leitor, cor da paleta no
  cabeçalho, aba inválida aceita na rota;
- seletor e paleta: busca já com 8 empresas, Escape sem fechar, faixa lateral sem o marinho.

Na primeira rodada, duas sobreviveram e foram tratadas: uma era equivalente (a deduplicação usa um
mapa por id, então tirar só o desvio não mudava a contagem) e foi trocada por uma que remove de
fato a deduplicação; a outra revelou o achado 10 da seção 17.

### 18.3 Validação local no navegador

Prévia local da branch, com dados sintéticos (duas empresas, contas de cada papel). Downloads e
impressão foram exercitados interceptando o arquivo e o diálogo na própria página, sem salvar
arquivo nem abrir o diálogo nativo.

| Verificação                  | Resultado                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RH                           | Aterrissa no Dashboard; foco no título uma vez; "Dashboard" na barra; nove blocos na ordem; três menus de ações; hora da leitura uma vez, no Resumo.                                   |
| DP                           | Dashboard com os mesmos blocos e menus.                                                                                                                                                |
| `master_tecnico` sem empresa | Orientação para escolher a empresa, sem consulta.                                                                                                                                      |
| `master_tecnico` com empresa | Seletor abre na empresa atual; Escape fecha e devolve o foco; a escolha anuncia a troca, lê os dados e foca o título.                                                                  |
| Gestor                       | Minha equipe; a rota do Dashboard não abre para o papel.                                                                                                                               |
| Perfis sem shell             | Colaborador e administração técnica ficam no Hub.                                                                                                                                      |
| Troca de empresa             | Conta com duas empresas: tabela escolhida sobrevive ao Hub e volta ao gráfico na outra empresa; totais da empresa nova; foco no título.                                                |
| Privacidade                  | Empresa com uma pessoa ativa: Distribuição e Tempo de casa "Não exibido por privacidade", sem menu.                                                                                    |
| Guarda de edição pendente    | Admissão em rascunho + troca pelo seletor: "Continuar editando" com o foco; rascunho e empresa preservados.                                                                            |
| URL e histórico              | Ano anterior cria entrada; voltar e avançar percorrem os anos com releitura; aba Pessoas com rota própria; recarga mantém a rota.                                                      |
| CSV                          | Quadro e Distribuição: BOM, ponto e vírgula, "—" no que não tem fonte, empresa e ano no nome, sem dado pessoal.                                                                        |
| Impressão/PDF                | Só o quadro, na vista de tabela, com empresa e período no topo; menu lateral e cabeçalho fora; tudo desfeito depois da impressão.                                                      |
| 375 px                       | Sem rolagem horizontal; painel de informação dentro da tela, Escape fecha; menu abaixo do cabeçalho; painel do mês dentro da tela, sem cobrir a coluna; tabela rola no próprio quadro. |

### 18.4 Referências

As referências visuais privadas usadas na conferência ficaram fora do repositório: nenhum nome,
texto, imagem, cor, ícone, dado ou endereço delas entrou em código, teste, commit ou documento.

## 19. Observações

- **Leitor de tela:** os anúncios únicos e a ausência de região viva no gráfico, no painel de
  informação e no menu são garantidos pela estrutura e pelos testes; não houve sessão com leitor
  de tela real.
- **Diálogo de impressão:** o conteúdo impresso é preparado e testado; a geração do PDF é do
  navegador.
- **Vista após recarregar:** volta ao gráfico (seção 16.2).
