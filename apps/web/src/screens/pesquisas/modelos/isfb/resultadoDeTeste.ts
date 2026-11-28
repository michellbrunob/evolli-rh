/**
 * T216 — Saúde financeira: um resultado do time inventado, para os testes
 * das telas (três pessoas, uma resposta de autopercepção).
 */
import type {
  ResultadoDoPainel,
  ResultadoIsfb,
} from "../../../../api/modelosDePesquisaClient";

export const RESULTADO_ISFB_DE_TESTE: ResultadoIsfb = {
  modelo: "isfb",
  pessoas: 3,
  isfb: 53,
  faixa: "baixa",
  diferencaDoBrasil: -3.7,
  mediaDoBrasil: 56.7,
  dimensoes: [
    { id: "seguranca", nota: 51, faixa: "baixa", pessoas: 3 },
    { id: "habilidade", nota: 52, faixa: "baixa", pessoas: 3 },
    { id: "comportamento", nota: 60, faixa: "ok", pessoas: 3 },
    { id: "liberdade", nota: 54, faixa: "baixa", pessoas: 3 },
    { id: "autopercepcao", nota: 80, faixa: "boa", pessoas: 1 },
  ],
  distribuicao: Array.from({ length: 20 }, (_, i) =>
    i === 10 ? 2 : i === 1 ? 1 : 0,
  ),
  saude: {
    baixa: { quantidade: 2, percentual: 66.7 },
    no_limite: { quantidade: 0, percentual: 0 },
    saudavel: { quantidade: 1, percentual: 33.3 },
  },
  sinais: {
    gasta_mais: { quantidade: 1, percentual: 33.3 },
    estresse: { quantidade: 2, percentual: 66.7 },
    apertado: { quantidade: 1, percentual: 33.3 },
    sem_reserva: { quantidade: 1, percentual: 33.3 },
  },
  sinaisAcumulados: [1, 1, 0, 0, 1],
  perfis: {
    estaveis: { quantidade: 2, percentual: 66.7 },
    confortaveis_sem_metodo: { quantidade: 0, percentual: 0 },
    apertados_organizados: { quantidade: 0, percentual: 0 },
    em_risco: { quantidade: 1, percentual: 33.3 },
  },
  pontoDoTime: { seguranca: 51, capacidade: 56 },
  perguntas: [
    {
      id: "Q2",
      respostas: 3,
      favoravel: 33.3,
      desfavoravel: 66.7,
      pontos: [1, 1, 0, 0, 1],
    },
  ],
  produtos: {
    poupanca: { quantidade: 2, percentual: 66.7 },
    seguro_saude: { quantidade: 2, percentual: 66.7 },
  },
  base: {
    semReserva: { quantidade: 1, percentual: 33.3 },
    comPrevidencia: { quantidade: 0, percentual: 0 },
    doisOuMaisFinanciamentos: { quantidade: 1, percentual: 33.3 },
    produtosPorPessoa: 4,
  },
  creditoReserva: {
    creditoSemReserva: 1,
    creditoComReserva: 1,
    semCreditoSemReserva: 0,
    semCreditoComReserva: 1,
  },
  temas: [{ id: "reserva", quantidade: 1, percentual: 33.3 }],
  aberturas: {
    sabem_que_precisam: { quantidade: 1, percentual: 100 },
    ponto_cego: { quantidade: 0, percentual: 0 },
    bem_e_atentos: { quantidade: 0, percentual: 0 },
    bem_mas_desatentos: { quantidade: 0, percentual: 0 },
  },
  comAutopercepcao: 1,
  porRenda: [
    {
      id: "ate_1_5",
      respostas: 1,
      visivel: false,
      oculto: "minimo",
      saude: null,
    },
  ],
};

export const PAINEL_ISFB_DE_TESTE: ResultadoDoPainel = {
  modelo: "isfb",
  respostas: 3,
  visivel: true,
  minimoPorGrupo: 3,
  recortes: [],
  nr1: null,
  isfb: RESULTADO_ISFB_DE_TESTE,
  campo: null,
  grupos: null,
  semGrupo: 0,
};
