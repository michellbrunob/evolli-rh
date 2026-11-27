/**
 * T216 — dados sintéticos e o serviço falso dos testes de Pesquisas (só os
 * testes importam este arquivo).
 */
import { vi, type Mock } from "vitest";
import type { ListagemColaboradoresApi } from "../../api/colaboradoresClient";
import type {
  ListaDePesquisasApi,
  PesquisaDetalhe,
  PesquisaResumo,
  ResultadosPesquisa,
  Secao,
} from "../../api/pesquisasClient";
import type { ServicoDePesquisas } from "./servicoDePesquisas";

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

/** Serviço falso: tudo resolve (nunca `undefined` em efeito). */
export type ServicoFalso = {
  [K in keyof ServicoDePesquisas]: Mock<ServicoDePesquisas[K]>;
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
        status: "rascunho",
      } as PesquisaDetalhe),
    ),
    excluirPesquisa: vi.fn(() => Promise.resolve(undefined)),
    resultadosDaPesquisa: vi.fn(() => Promise.resolve(RESULTADOS)),
    respostasDaPesquisa: vi.fn(() => Promise.resolve([])),
    listarAtivos: vi.fn(() => Promise.resolve(ATIVOS)),
    listarDepartamentos: vi.fn(() =>
      Promise.resolve([
        { id: "d-1", codigo: "OP", nome: "Operações" },
        { id: "d-2", codigo: "FI", nome: "Financeiro" },
      ] as never),
    ),
  };
  return { ...base, ...extra } as never;
}
