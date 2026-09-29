# Tasks: Interface web funcional da Central de Solicitações de Pessoas (T140)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Ordem de execução. Cada bloco termina com o repositório verde.

## Bloco A — Cliente HTTP tipado

- **A1.** Criar `apps/web/src/api/solicitacoesPessoasClient.ts` com `BASE = "/v1"`, `apiFetch`
  (`credentials: "same-origin"`, `clearCsrfToken()` em 401), `jsonOrThrow` que nunca repassa o
  corpo do servidor, `montarQuery` e `getCsrf()`.
- **A2.** Declarar `SolicitacaoPessoaApi` e `SolicitacaoPessoaEventoApi` espelhando o retorno cru do
  Prisma, e os quatro tipos de união dos enums do backend.
- **A3.** Implementar as cinco funções de rota. Os dois POST enviam `x-csrf-token`; os três GET não.
- **A4.** Declarar `ROTULO_TIPO`, `ROTULO_SITUACAO`, `ROTULO_ACAO`, `ROTULO_MOTIVO`,
  `ACOES_POR_SITUACAO` e `ACOES_COM_MOTIVO_OBRIGATORIO`.
- **A5.** `solicitacoesPessoasClient.test.ts`: URL e query montadas, `credentials`, CSRF só nas
  mutações, 201 aceito como sucesso, erro não vaza corpo do servidor, 401 limpa o token.

## Bloco B — Tela funcional

- **B1.** Reescrever `SolicitacoesScreen.tsx` preservando os exports `SOLICITACOES_TITULO_ID` e
  `SolicitacoesScreen`. Sem tocar `PessoasScreen.tsx` nem `index.ts`.
- **B2.** Carregar ator (`obterUsuarioAtual`) e colaboradores na montagem; vínculos ao selecionar
  colaborador (zero bloqueia / uma resolve / várias exigem escolha).
- **B3.** Listagem com filtros (tipo, situação, vínculo) e paginação pelo contrato real
  (`pagina`, `tamanhoPagina`, `total`); mudança de filtro volta à página 1.
- **B4.** Carregando / vazio / erro com "Tentar novamente".
- **B5.** Detalhe somente leitura e histórico cronológico, ambos da API.
- **B6.** Formulário de registro (colaborador, vínculo, tipo, motivo, período opcional).
- **B7.** Transições derivadas da situação, com motivo obrigatório em `recusar` e `reabrir`.
- **B8.** Recarga consistente após mutação; mensagens de sucesso, conflito e erro.
- **B9.** Reescrever `SolicitacoesScreen.css` só com tokens existentes; 375px sem overflow da página.

## Bloco C — Concorrência

- **C1.** Contador monotônico por carregador (`seqVinculos`, `seqLista`, `seqDetalhe`,
  `seqHistorico`), no padrão T134.
- **C2.** Limpar seleção incrementa o contador e invalida cargas em voo.
- **C3.** Conflito de transição não projeta sucesso local: mensagem segura + recarga do servidor.

## Bloco D — Testes de tela

- **D1.** Carregamento, vazio, erro e retry.
- **D2.** Filtros e paginação (query enviada à API; volta à página 1).
- **D3.** Zero, uma e múltiplas opções de colaborador e de vínculo.
- **D4.** Registro, detalhe, histórico e cada ação oferecida pela interface.
- **D5.** Conflito de transição (422) com recarga.
- **D6.** `master_tecnico` lê e não muta; `dp`, `gestor` e `colaborador` sem mutação.
- **D7.** Ausência de upload, anexo, R2, dado clínico e texto livre indevido.
- **D8.** Corridas: colaborador, vínculo, filtros, paginação, detalhe e histórico, com `deferred`.
- **D9.** Não regressão de `PessoasScreen`, `CentralSolicitacoesRHScreen` e `MinhasSolicitacoesScreen`.

## Bloco E — Validação e convergência

- **E1.** `typecheck`, `lint`, `pnpm -w test`, `build`.
- **E2.** Prettier `--check` nos arquivos alterados (`--end-of-line auto`); `git diff --check`.
- **E3.** `node scripts/check-spec-kit-sync.mjs`; varredura de testes desabilitados e de segredos.
- **E4.** Verificação visual em navegador real: desktop e 375px.
- **E5.** `/speckit.converge`: registrar T139 **integrada** e T140 **implementada/em revisão**;
  corrigir `lastIntegratedTask` para 139 e limpar `openDeliveries` da T139.
- **E6.** Commits coerentes, push, PR única em Draft, CI 3/3.

## Fora desta tarefa (não fazer)

- ESS, MSS, autoatendimento do colaborador ou qualquer simulação de `DP-23`.
- Capacidade de RBAC para o gestor.
- Anexo, upload, download, preview, assinatura ou Cloudflare R2.
- Endpoint, campo, estado, transição, papel, motivo ou regra de domínio nova.
- Alterar `CentralSolicitacoesRHScreen`, `MinhasSolicitacoesScreen` ou qualquer backend.
- Roteador de URL, React Context, dependência ou lockfile.
- Cronômetro de SLA, cálculo de prazo ou promessa de conclusão.
- Declaração de conformidade legal.
