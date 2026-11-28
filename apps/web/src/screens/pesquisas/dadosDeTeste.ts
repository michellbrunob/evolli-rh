/**
 * T216 — dados sintéticos e o serviço falso dos testes de Pesquisas (só os
 * testes importam este arquivo).
 */
import { vi, type Mock } from "vitest";
import type { ListagemColaboradoresApi } from "../../api/colaboradoresClient";
import type {
  AnalisesPesquisa,
  CandidatoPesquisa,
  ListarCandidatosQuery,
  RespostaDetalhe,
  RespostaResumo,
  ListaDePesquisasApi,
  PesquisaDetalhe,
  PesquisaResumo,
  ResultadosPesquisa,
  Secao,
} from "../../api/pesquisasClient";
import type { GruposDaEmpresa, ServicoDePesquisas } from "./servicoDePesquisas";

export const RESUMO: PesquisaResumo = {
  id: "p-1",
  nome: "Clima de novembro",
  modelo: "clima",
  identificacao: "confidencial",
  status: "ativa",
  participantes: 10,
  respostas: 8,
  criadaEm: "2026-11-02T13:00:00Z",
  publicadaEm: "2026-11-03T13:00:00Z",
  encerraEm: null,
  link: "#/p/token-de-teste",
};

export const lista = (
  itens: PesquisaResumo[],
  contagens: Partial<ListaDePesquisasApi["contagens"]> = {},
): ListaDePesquisasApi => ({
  itens,
  pagina: 1,
  tamanhoPagina: 20,
  total: itens.length,
  contagens: {
    todas: itens.length,
    rascunho: 0,
    ativa: 0,
    pausada: 0,
    finalizada: 0,
    cancelada: 0,
    ...contagens,
  },
});

export const SECOES: Secao[] = [
  {
    id: "s-1",
    titulo: "Dia a dia",
    descricao: null,
    perguntas: [
      {
        id: "q-nota",
        tipo: "nota_0_10",
        texto: "Quanto você indicaria a empresa?",
        descricao: null,
        obrigatoria: true,
        config: { enps: true },
        condicao: null,
      },
      {
        id: "q-conc",
        tipo: "concordancia",
        texto: "Tenho clareza das prioridades.",
        descricao: null,
        obrigatoria: true,
        config: {},
        condicao: null,
      },
      {
        id: "q-sim",
        tipo: "sim_nao",
        texto: "Recomendaria a área?",
        descricao: null,
        obrigatoria: true,
        config: { respostaBoa: "sim" },
        condicao: null,
      },
      {
        id: "q-esc",
        tipo: "escolha_unica",
        texto: "Qual canal você prefere?",
        descricao: null,
        obrigatoria: true,
        config: {
          opcoes: [
            { id: "o-1", texto: "Reunião" },
            { id: "o-2", texto: "Mensagem" },
          ],
          outro: true,
        },
        condicao: null,
      },
      {
        id: "q-txt",
        tipo: "paragrafo",
        texto: "Comentários",
        descricao: null,
        obrigatoria: false,
        config: {},
        condicao: { perguntaId: "q-sim", opcaoId: "nao" },
      },
    ],
  },
];

export const DETALHE: PesquisaDetalhe = {
  ...RESUMO,
  boasVindas: "Boas-vindas de teste.",
  secoes: SECOES,
  minimoPorGrupo: 3,
  todos: true,
  participantesLista: [],
  temRespostas: true,
};

export const RESULTADOS: ResultadosPesquisa = {
  pesquisaId: "p-1",
  respostas: 8,
  participantes: 10,
  departamentos: [
    { id: "d-1", nome: "Operações", respostas: 6, visivel: true },
    { id: "d-2", nome: "Financeiro", respostas: 2, visivel: false },
  ],
  filtro: { departamentoId: null, visivel: true },
  perguntas: [
    {
      perguntaId: "q-nota",
      tipo: "nota_0_10",
      respondidas: 8,
      viram: 8,
      enps: { promotores: 5, neutros: 2, detratores: 1, indice: 50 },
      media: 8.4,
      distribuicao: [
        { valor: 6, quantidade: 1 },
        { valor: 8, quantidade: 2 },
        { valor: 10, quantidade: 5 },
      ],
    },
    {
      perguntaId: "q-conc",
      tipo: "concordancia",
      respondidas: 8,
      viram: 8,
      media: 4.25,
      distribuicao: [
        { valor: 4, quantidade: 6 },
        { valor: 5, quantidade: 2 },
      ],
    },
    {
      perguntaId: "q-sim",
      tipo: "sim_nao",
      respondidas: 8,
      viram: 8,
      sim: 6,
      nao: 2,
    },
    {
      perguntaId: "q-esc",
      tipo: "escolha_unica",
      respondidas: 8,
      viram: 8,
      opcoes: [
        { opcaoId: "o-1", quantidade: 5 },
        { opcaoId: "o-2", quantidade: 2 },
      ],
      outros: ["Mural"],
    },
    {
      perguntaId: "q-txt",
      tipo: "paragrafo",
      respondidas: 2,
      viram: 2,
      textos: [
        { texto: "Mais retorno, por favor.", autor: "Pessoa Exemplo" },
        { texto: "Mais clareza.", autor: null },
      ],
    },
  ],
};

export const ATIVOS: ListagemColaboradoresApi = {
  itens: [
    {
      id: "c-1",
      nome: "Ana Exemplo",
      vinculos: [
        {
          lotacaoVigente: {
            cargo: null,
            departamento: { id: "d-1", codigo: "OP", nome: "Operações" },
          },
        },
      ],
    },
    {
      id: "c-2",
      nome: "Bruno Exemplo",
      vinculos: [
        {
          lotacaoVigente: {
            cargo: null,
            departamento: { id: "d-2", codigo: "FI", nome: "Financeiro" },
          },
        },
      ],
    },
  ] as unknown as ListagemColaboradoresApi["itens"],
  pagina: 1,
  tamanhoPagina: 50,
  total: 2,
  contadores: {} as ListagemColaboradoresApi["contadores"],
};

/** Candidatos para "Escolher pessoas" (lotação vigente). */
export const CANDIDATOS: CandidatoPesquisa[] = [
  {
    colaboradorId: "c-1",
    nome: "Ana Exemplo",
    cargo: "Analista",
    departamento: "Operações",
    centroCusto: "Administrativo",
    unidade: "Matriz",
  },
  {
    colaboradorId: "c-2",
    nome: "Bruno Exemplo",
    cargo: null,
    departamento: "Financeiro",
    centroCusto: null,
    unidade: "Filial Sul",
  },
];

const NOME_DO_GRUPO: Readonly<Record<string, string>> = {
  "d-1": "Operações",
  "d-2": "Financeiro",
  "cc-1": "Administrativo",
  "u-1": "Matriz",
  "u-2": "Filial Sul",
};

/** O servidor simulado filtra e pagina como o real. */
export function listarCandidatosFalso(
  todos: readonly CandidatoPesquisa[] = CANDIDATOS,
) {
  return (q: ListarCandidatosQuery = {}) => {
    const casa = (valor: string | null, id?: string) =>
      !id || valor === NOME_DO_GRUPO[id];
    const filtrados = todos.filter(
      (c) =>
        (!q.busca || c.nome.toLowerCase().includes(q.busca.toLowerCase())) &&
        casa(c.departamento, q.departamentoId) &&
        casa(c.centroCusto, q.centroCustoId) &&
        casa(c.unidade, q.unidadeId),
    );
    const pagina = q.pagina ?? 1;
    const tamanho = q.tamanhoPagina ?? 20;
    return Promise.resolve({
      itens: filtrados.slice((pagina - 1) * tamanho, pagina * tamanho),
      pagina,
      tamanhoPagina: tamanho,
      total: filtrados.length,
    });
  };
}

export const GRUPOS: GruposDaEmpresa = {
  departamento: [
    { id: "d-1", nome: "Operações" },
    { id: "d-2", nome: "Financeiro" },
  ],
  centroCusto: [{ id: "cc-1", nome: "Administrativo" }],
  unidade: [
    { id: "u-1", nome: "Matriz" },
    { id: "u-2", nome: "Filial Sul" },
  ],
  area: [{ id: "a-1", nome: "Atendimento" }],
};

export const RESPOSTAS: RespostaResumo[] = [
  {
    id: "r-1",
    numero: 1,
    colaboradorId: "c-1",
    nome: "Ana Exemplo",
    departamento: "Operações",
    respondidaEm: "2026-11-20T14:23:00Z",
    media: 9,
  },
  {
    id: "r-2",
    numero: 2,
    colaboradorId: "c-2",
    nome: "Bruno Exemplo",
    departamento: "Financeiro",
    respondidaEm: "2026-11-21T12:00:00Z",
    media: 5.5,
  },
];

export const RESPOSTA_DETALHE: RespostaDetalhe = {
  ...RESPOSTAS[0]!,
  anteriorId: null,
  proximaId: "r-2",
  posicao: 1,
  total: 2,
  valores: [
    { perguntaId: "q-nota", valor: 10, mediaTime: 8.4 },
    { perguntaId: "q-conc", valor: 5, mediaTime: 4.25 },
    { perguntaId: "q-sim", valor: "sim", mediaTime: null },
    { perguntaId: "q-esc", valor: { outro: "Mural" }, mediaTime: null },
  ],
  indicadores: {
    media: 10,
    mediaTime: 8.5,
    recomendacao: 10,
    enpsTime: 50,
    maior: { perguntaId: "q-conc", valor: 5 },
    menor: { perguntaId: "q-conc", valor: 5 },
    mediaUltimosPulsos: null,
  },
};

export const ANALISES: AnalisesPesquisa = {
  campo: "departamento",
  colunas: [{ perguntaId: "q-conc", rotulo: "Prioridades" }],
  linhas: [
    {
      grupoId: null,
      nome: "Toda a empresa",
      respostas: 8,
      visivel: true,
      media: 8.5,
      medias: [8.5],
    },
    {
      grupoId: "d-1",
      nome: "Operações",
      respostas: 6,
      visivel: true,
      media: 6.1,
      medias: [6.1],
    },
    {
      grupoId: "d-2",
      nome: "Financeiro",
      respostas: 2,
      visivel: false,
      media: null,
      medias: [null],
    },
  ],
  evolucao: [],
};

/** Serviço falso: tudo resolve (nunca `undefined` em efeito). */
export type ServicoFalso = {
  [K in keyof ServicoDePesquisas]: Mock<NonNullable<ServicoDePesquisas[K]>>;
};

export function servicoFalso(
  extra: Partial<ServicoDePesquisas> = {},
): ServicoFalso {
  const base = {
    listarPesquisas: vi.fn(() =>
      Promise.resolve(lista([RESUMO], { ativa: 1 })),
    ),
    criarPesquisa: vi.fn((e) =>
      Promise.resolve({
        ...DETALHE,
        ...e,
        id: "p-novo",
        status: "rascunho",
        link: null,
        temRespostas: false,
        todos: e.participantes.todos,
        participantesLista: [],
      } as PesquisaDetalhe),
    ),
    obterPesquisa: vi.fn(() => Promise.resolve(DETALHE)),
    alterarPesquisa: vi.fn((id: string, e) =>
      Promise.resolve({
        ...DETALHE,
        ...e,
        id,
        status: "rascunho",
        link: null,
        temRespostas: false,
        todos: e.participantes.todos,
        participantesLista: [],
      } as PesquisaDetalhe),
    ),
    publicarPesquisa: vi.fn((id: string) =>
      Promise.resolve({
        ...DETALHE,
        id,
        status: "ativa",
        link: "#/p/token-publicado",
      } as PesquisaDetalhe),
    ),
    alterarStatusDaPesquisa: vi.fn((id: string, status) =>
      Promise.resolve({ ...DETALHE, id, status } as PesquisaDetalhe),
    ),
    duplicarPesquisa: vi.fn(() =>
      Promise.resolve({
        ...DETALHE,
        id: "p-copia",
        nome: "Clima de novembro (cópia)",
        status: "ativa",
      } as PesquisaDetalhe),
    ),
    excluirPesquisa: vi.fn(() => Promise.resolve(undefined)),
    resultadosDaPesquisa: vi.fn(() => Promise.resolve(RESULTADOS)),
    respostasDaPesquisa: vi.fn(() => Promise.resolve(RESPOSTAS)),
    respostaDaPesquisa: vi.fn((_p: string, id: string) =>
      Promise.resolve({ ...RESPOSTA_DETALHE, id }),
    ),
    analisesDaPesquisa: vi.fn(() => Promise.resolve(ANALISES)),
    evolucaoDaPesquisa: vi.fn(() =>
      Promise.resolve({ evolucao: ANALISES.evolucao }),
    ),
    listarAtivos: vi.fn(() => Promise.resolve(ATIVOS)),
    listarCandidatos: vi.fn(listarCandidatosFalso()),
    listarTodosCandidatos: vi.fn(() => Promise.resolve(CANDIDATOS)),
    contagemDoTime: vi.fn(() =>
      Promise.resolve({
        total: 2,
        departamentos: [
          { departamentoId: "d-1", departamento: "Operações", quantidade: 1 },
          { departamentoId: "d-2", departamento: "Financeiro", quantidade: 1 },
        ],
      }),
    ),
    listarTodosAtivos: vi.fn(() => Promise.resolve(ATIVOS.itens)),
    listarGrupos: vi.fn(() => Promise.resolve(GRUPOS)),
    listarEmpresas: vi.fn(() =>
      Promise.resolve([
        { id: "e-1", nome: "Empresa Alfa" },
        { id: "e-2", nome: "Empresa Beta" },
      ]),
    ),
    empresaAtiva: vi.fn(() =>
      Promise.resolve({ id: "e-1", nome: "Empresa Alfa" }),
    ),
    listarDepartamentos: vi.fn(() =>
      Promise.resolve([
        { id: "d-1", codigo: "OP", nome: "Operações" },
        { id: "d-2", codigo: "FI", nome: "Financeiro" },
      ] as never),
    ),
  };
  return { ...base, ...extra } as never;
}
