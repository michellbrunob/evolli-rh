/**
 * T216 — dados sintéticos da Avaliação 90°/180° para os testes de tela.
 * Nomes inventados; nenhum dado pessoal.
 */
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import { CATALOGO, COMPETENCIAS, type Competencia } from "./catalogo";
import type {
  AvaliacaoDetalhe,
  NotaDaAvaliacao,
  Organograma,
  PessoaResumida,
  ResultadoDaPessoa,
  ResultadosDaAvaliacao,
} from "./cliente";

export const pessoa = (
  id: string,
  nome: string,
  extra: Partial<PessoaResumida> = {},
): PessoaResumida => ({
  id,
  nome,
  cargo: "Analista",
  departamento: "Operações",
  identificavel: true,
  temEmail: true,
  ...extra,
});

export const GESTORA = pessoa("g1", "Gestora Teste", { cargo: "Coordenadora" });
export const ANA = pessoa("p1", "Ana Teste");
export const BRUNO = pessoa("p2", "Bruno Sem Cpf", { identificavel: false });
export const CAIO = pessoa("p3", "Caio Sem Gestor");
export const DORA = pessoa("p4", "Dora Livre");

export function organogramaFalso(): Organograma {
  return {
    times: [{ gestor: GESTORA, pessoas: [ANA, BRUNO] }],
    semGestor: [
      { pessoa: GESTORA, motivo: "sem_gestor", gestorNome: null },
      { pessoa: CAIO, motivo: "sem_gestor", gestorNome: null },
    ],
    ativos: [GESTORA, ANA, BRUNO, CAIO, DORA],
  };
}

export function detalheFalso(extra: Partial<PesquisaDetalhe> = {}): PesquisaDetalhe {
  return {
    id: "pesq-1",
    nome: "Avaliação 90° – Ciclo 2026.2",
    modelo: "avaliacao90",
    identificacao: "identificada",
    status: "rascunho",
    participantes: 0,
    respostas: 0,
    criadaEm: "2026-11-27T12:00:00.000Z",
    publicadaEm: null,
    encerraEm: null,
    link: null,
    boasVindas: null,
    secoes: [],
    minimoPorGrupo: 3,
    separarPor: [],
    todos: false,
    participantesLista: [],
    naoIdentificaveis: 0,
    participantesTotal: 0,
    responderam: 0,
    pendentes: 0,
    temRespostas: false,
    ...extra,
  } as PesquisaDetalhe;
}

export function avaliacaoDetalheFalsa(): AvaliacaoDetalhe {
  return {
    pesquisaId: "pesq-1",
    modelo: "avaliacao180",
    config: {
      comentarios: "extremos",
      liberarNoPortal: false,
      visibilidade: "depois_do_gestor",
      prazoAutoavaliacao: null,
      lembretes: ["7_dias", "3_dias", "no_dia"],
      envio: "email",
    },
    prazo: "2026-12-28T02:59:00.000Z",
    times: [
      {
        gestor: GESTORA,
        pessoas: [
          { ...ANA, gestorRespondeu: true, autoavaliacao: { respondeu: true } },
          { ...BRUNO, gestorRespondeu: false, autoavaliacao: null },
        ],
      },
    ],
    totais: { gestores: 1, pessoas: 2, autoavaliacoes: 1, respondidas: 2, pendentes: 1 },
    lembretes: [{ lembrete: "7_dias", quando: "2026-12-20T12:00:00.000Z" }],
    convites: { aguardandoEmail: 2, semEmail: 0, enviados: 0 },
  };
}

const todas = (n: number): Record<Competencia, number> =>
  Object.fromEntries(COMPETENCIAS.map((c) => [c, n])) as Record<Competencia, number>;

export const nota = (n: number, extra: Partial<NotaDaAvaliacao> = {}): NotaDaAvaliacao => ({
  competencias: todas(n),
  geral: n,
  entrega: n,
  pessoas: n,
  nivel: n >= 4.5 ? "excepcional" : n >= 4 ? "excelente" : n >= 3 ? "bom" : "em_desenvolvimento",
  quadrante: n >= 4 ? "referencia" : n >= 3 ? "solido" : "precisa_de_apoio",
  grupo: n >= 4 ? "destaque" : n >= 3 ? "esperado" : "apoio",
  ...extra,
});

export function resultadosFalsos(): ResultadosDaAvaliacao {
  return {
    pesquisaId: "pesq-1",
    modelo: "avaliacao180",
    avaliadas: 2,
    previstas: 2,
    autoavaliacoes: { previstas: 1, respondidas: 1 },
    time: {
      avaliadas: 2,
      media: 3.5,
      nivel: "bom",
      competencias: COMPETENCIAS.map((c, i) => ({
        competencia: c,
        media: 4.5 - i * 0.2,
        abaixoDe3: i === 7 ? ["p2"] : [],
        percentualAbaixoDe3: i === 7 ? 50 : 0,
        menorAfirmacao: { itemId: CATALOGO[i]!.itens[0].id, media: 3 },
      })),
      grupos: { destaque: ["p1"], esperado: [], apoio: ["p2"] },
      mapa: {
        referencia: ["p1"],
        forte_na_entrega: [],
        entrega_sozinho: [],
        forte_com_pessoas: [],
        solido: [],
        relacao_a_desenvolver: [],
        conecta_entrega_pouco: [],
        entrega_abaixo: [],
        precisa_de_apoio: ["p2"],
      },
    },
    itens: [],
    pessoas: [
      {
        colaboradorId: "p1",
        nome: "Ana Teste",
        cargo: "Analista",
        departamento: "Operações",
        gestor: { id: "g1", nome: "Gestora Teste" },
        gestorRespondeu: true,
        temAutoavaliacao: true,
        autoavaliacaoRespondida: true,
        nota: nota(4.4),
        autoavaliacao: nota(5),
        diferenca: 0.6,
        alinhamento: "acima",
        alertas: [],
        tempoDeCasa: "1_a_3_anos",
      },
      {
        colaboradorId: "p2",
        nome: "Bruno Sem Cpf",
        cargo: null,
        departamento: null,
        gestor: { id: "g1", nome: "Gestora Teste" },
        gestorRespondeu: true,
        temAutoavaliacao: false,
        autoavaliacaoRespondida: false,
        nota: nota(2.5),
        autoavaliacao: null,
        diferenca: null,
        alinhamento: null,
        alertas: [{ tipo: "linha_reta" }],
        tempoDeCasa: null,
      },
    ],
    calibracao: [
      { avaliadorId: "g1", nome: "Gestora Teste", avaliadas: 2, media: 3.5, diferenca: 0, leitura: "poucas" },
    ],
    recortes: {
      tempoDeCasa: [{ grupo: "1_a_3_anos", avaliadas: 1, media: null, visivel: false }],
      departamento: [{ grupo: "Operações", avaliadas: 1, media: null, visivel: false }],
    },
    comparativo: {
      completas: 1,
      competencias: COMPETENCIAS.map((c) => ({
        competencia: c,
        gestor: 4.4,
        autoavaliacao: 5,
        diferenca: 0.6,
      })),
      acima: 1,
      alinhadas: 0,
      abaixo: 0,
    },
  };
}

export function pessoaFalsa(): ResultadoDaPessoa {
  const notas = Object.fromEntries(CATALOGO.flatMap((c) => c.itens.map((i) => [i.id, 4])));
  return {
    pesquisaId: "pesq-1",
    pesquisa: "Avaliação 180°",
    modelo: "avaliacao180",
    colaboradorId: "p1",
    nome: "Ana Teste",
    cargo: "Analista",
    departamento: "Operações",
    gestor: { id: "g1", nome: "Gestora Teste" },
    temAutoavaliacao: true,
    gestorAvaliacao: {
      respondidaEm: "2026-11-27T12:00:00.000Z",
      nota: nota(4),
      notas,
      comentarios: { lideranca: "Conduz bem as reuniões de equipe." },
      alertas: [],
    },
    autoavaliacao: {
      respondidaEm: "2026-11-27T12:00:00.000Z",
      nota: nota(5),
      notas: { ...notas, lid_1: 5 },
      comentarios: {},
      alertas: [],
    },
    comparativo: {
      competencias: COMPETENCIAS.map((c) => ({
        competencia: c,
        gestor: 4,
        autoavaliacao: c === "lideranca" ? 5 : 4,
        diferenca: c === "lideranca" ? 1 : 0,
        leitura: c === "lideranca" ? "ponto_cego" : "forca_confirmada",
      })),
      gestor: 4,
      autoavaliacao: 4.1,
      diferenca: 0.1,
      alinhamento: "alinhada",
    },
    roteiro: [
      { passo: "forcas_confirmadas", competencias: ["comunicacao"] },
      { passo: "pontos_cegos", competencias: ["lideranca"] },
      { passo: "plano", competencias: [] },
    ],
    desenvolver: [],
    time: { media: 3.5, competencias: todas(3.5) },
  };
}
