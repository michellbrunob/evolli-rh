# Implementation Plan: Interface web funcional da Central de Solicitações de Pessoas (T140)

**Branch**: `codex/t140-web-solicitacoes-pessoas` · **Base**: `main` em `6eaa6f9` (T139 integrada)

**Spec**: [spec.md](./spec.md)

## 1. Estratégia

Reescrever `apps/web/src/screens/pessoas/SolicitacoesScreen.tsx` sobre um cliente HTTP novo e
tipado, imitando linha a linha os precedentes já em `main`. Nenhum arquivo de backend é tocado:
o contrato da T139 não muda, então a cobertura E2E existente continua valendo e não é duplicada.

Três precedentes governam cada decisão de forma:

| Dimensão                    | Precedente imitado                                        |
| --------------------------- | --------------------------------------------------------- |
| Cliente HTTP                | `documentosClient.ts` (T133) — o mais recente e enxuto    |
| Tela funcional de Pessoas   | `PessoasDocumentosScreen.tsx` (T133) — a tela irmã        |
| Guarda de resposta obsoleta | `DadosContratuaisScreen.tsx` (T134) — contador monotônico |

## 2. Cliente `apps/web/src/api/solicitacoesPessoasClient.ts` (novo)

Molde de `documentosClient.ts`: `const BASE = "/v1"`, `apiFetch` com
`credentials: "same-origin"`, `clearCsrfToken()` em 401, `jsonOrThrow(res, fallback)` que **nunca**
repassa o corpo do servidor, `montarQuery` com `URLSearchParams`, `getCsrf()` via
`getCsrfToken() ?? refreshCsrfToken()` e header `x-csrf-token` só nas mutações.

Tipos espelham o retorno **cru do Prisma**, que é o que o backend devolve (sem DTO de saída):

```ts
export interface SolicitacaoPessoaApi {
  id: string;
  empresaId: string;
  vinculoId: string;
  tipo: TipoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa;
  situacao: SituacaoSolicitacaoPessoa;
  periodoReferencia: string | null; // ENTRA "AAAA-MM-DD", SAI ISO datetime
  registradoPorUserId: string;
  enviadaEm: string | null;
  primeiraRevisaoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}
export interface SolicitacaoPessoaEventoApi {
  id: string;
  solicitacaoId: string;
  empresaId: string;
  acao: AcaoSolicitacaoPessoa;
  situacaoDe: SituacaoSolicitacaoPessoa | null; // null só na criação
  situacaoPara: SituacaoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa | null;
  registradoPorUserId: string;
  requestId: string;
  ocorridoEm: string;
}
```

Cinco funções, uma por rota, com as URLs conferidas no controller:

| Função                               | Rota                                           | Sucesso |
| ------------------------------------ | ---------------------------------------------- | ------- |
| `listarSolicitacoesPessoas(query)`   | `GET /v1/solicitacoes-pessoas`                 | 200     |
| `detalharSolicitacaoPessoa(id)`      | `GET /v1/solicitacoes-pessoas/:id`             | 200     |
| `historicoSolicitacaoPessoa(id)`     | `GET /v1/solicitacoes-pessoas/:id/historico`   | 200     |
| `registrarSolicitacaoPessoa(dto)`    | `POST /v1/solicitacoes-pessoas`                | **201** |
| `transicionarSolicitacaoPessoa(...)` | `POST /v1/solicitacoes-pessoas/:id/transicoes` | **201** |

Atenção a duas assimetrias reais do contrato, confirmadas no código:

1. **Os dois POST devolvem 201, não 200** — não há `@HttpCode` no controller.
2. **`periodoReferencia` entra `"AAAA-MM-DD"` e sai ISO datetime** — o Prisma devolve `Date` mesmo
   em coluna `@db.Date`. A tela fatia os 10 primeiros caracteres para reexibir.

Mapas de rótulo (`ROTULO_TIPO`, `ROTULO_SITUACAO`, `ROTULO_ACAO`, `ROTULO_MOTIVO`) e a tabela
`ACOES_POR_SITUACAO` vivem no client, como `ROTULO_ESTADO_DOCUMENTO` já vive em `documentosClient`.

`ACOES_COM_MOTIVO_OBRIGATORIO = ["recusar", "reabrir"]` espelha a constante homônima do backend.

## 3. Tela `SolicitacoesScreen.tsx` (reescrita)

Mantém o contrato de módulo que `PessoasScreen` já consome: `SOLICITACOES_TITULO_ID` e
`SolicitacoesScreen`. Nenhuma mudança em navegação, `index.ts` ou shell.

Estrutura, na ordem do molde T133:

1. `PageHeader headingLevel={1} titleId={SOLICITACOES_TITULO_ID}`.
2. Aviso de escopo (`StatusBadge` + texto) — reescrito: a tela deixa de ser demonstrativa, mas
   continua declarando que **registra e encaminha, não executa**.
3. Região `role="status"` para mensagem de sucesso.
4. Seção **Colaborador**: seletor + vínculos (zero bloqueia / uma resolve / várias exigem escolha).
5. Seção **Solicitações**: filtros (tipo, situação, vínculo), tabela, paginação, ação de registrar.
6. Painel de **detalhe** somente leitura + **histórico** cronológico.
7. Formulário de **registro** e formulário de **transição** (com motivo quando obrigatório).

Estados de carregamento seguem `StatusCarregamento = "carregando" | "erro" | "pronto"` (dialeto das
duas telas mais recentes de Pessoas).

## 4. Guarda de respostas obsoletas

Um `useRef` contador por carregador, exatamente o padrão T134:

```ts
const seqLista = useRef(0);
const carregarLista = useCallback(async (...) => {
  const seq = ++seqLista.current;
  setStatus("carregando");
  try {
    const r = await listarSolicitacoesPessoas(...);
    if (seq !== seqLista.current) return;   // resposta superada: descarta
    ...
  } catch { if (seq !== seqLista.current) return; setStatus("erro"); }
}, []);
```

Contadores: `seqVinculos`, `seqLista`, `seqDetalhe`, `seqHistorico`. Limpar a seleção incrementa o
contador para invalidar cargas em voo. A lista é chave composta (colaborador + filtros + página):
um único contador cobre todas, porque toda mudança passa pelo mesmo carregador — isso generaliza o
precedente, que só cobria troca de seleção, sem inventar mecanismo novo.

## 5. Papel do ator

`obterUsuarioAtual()` no `useEffect` de montagem, como `PessoasDocumentosScreen` faz — **menor
ajuste possível**: zero mudança em `AutenticacaoApp`, `App` ou props, e nenhum Context (que seria
um terceiro padrão, inédito no repositório).

```ts
function podeMutar(ator: SafeAccessUserApi | null): boolean {
  return (
    ator?.role === "rh" &&
    typeof ator.companyId === "string" &&
    ator.companyId.length > 0
  );
}
```

Falha ao obter o ator -> `null` -> sem mutação (fail-closed). `master_tecnico` cai no `false` e
enxerga a tela em modo leitura, com aviso explícito — não um gate binário de "sem permissão", que
esconderia a leitura que o RBAC concede a ele.

## 6. Tratamento de erro

Uma função `mensagemErro(err)` traduz `ApiError.status` para texto público, no molde T133,
distinguindo **404 (escopo/inexistente, indistinguíveis)** de **403 (capacidade)** — são mecanismos
diferentes no backend e confundi-los daria mensagem errada.

Para 404, 409 e 422 em transição, a tela **recarrega** detalhe, histórico e lista: o estado local
pode estar velho, e o servidor é a autoridade.

## 7. Testes (`SolicitacoesScreen.test.tsx` reescrito + `solicitacoesPessoasClient.test.ts` novo)

Molde de mock: `vi.mock` com `importActual` por módulo, `vi.mocked(fn).mockResolvedValue(...)`.
Corridas com o helper `deferred<T>()` copiado do teste T134, resolvendo fora de ordem.

Cobertura mínima conforme spec §10 e §11, mais:

- cliente: URL, query, `credentials`, CSRF só em mutação, 201 aceito, erro sem corpo do servidor;
- ausência de upload/anexo/R2/clínico/texto livre (varredura de DOM e de props enviadas);
- não regressão de `PessoasScreen`, `CentralSolicitacoesRHScreen` e `MinhasSolicitacoesScreen`.

Nenhum E2E de API novo: o contrato não mudou e a T139 já o cobre.

## 8. Validações

`typecheck`, `lint`, `pnpm -w test` (web + api), `build`, Prettier nos arquivos alterados
(`--end-of-line auto`, por causa do `core.autocrlf` do ambiente), `git diff --check`,
`node scripts/check-spec-kit-sync.mjs`, varredura de testes desabilitados e de conteúdo sensível.

Verificação visual no navegador real: desktop e 375px, listagem, criação, detalhe, histórico, uma
transição válida, estado de erro/conflito, master em leitura, ausência de overflow da página.

## 9. Riscos e mitigação

| Risco                                                | Mitigação                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| Tratar 200 como único sucesso e quebrar nas mutações | Cliente aceita qualquer `res.ok`; teste fixa 201 explicitamente.      |
| Reexibir `periodoReferencia` como ISO cru            | Fatiar 10 caracteres; teste cobre ida e volta.                        |
| Duplicar a máquina de estados no frontend            | Tabela única derivada do núcleo, com teste comparando as 7 situações. |
| Projetar sucesso local numa corrida                  | Sempre recarregar do servidor após mutação; teste de 422.             |
| Vazar corpo interno de erro                          | `jsonOrThrow` nunca lê o corpo em falha; teste assere isso.           |
| Quebrar as telas demonstrativas vizinhas             | Testes de não regressão das três telas.                               |
