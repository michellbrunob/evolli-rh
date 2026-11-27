import type { ValorRespondido } from "../../pesquisas.types";
import {
  aberturaDe,
  calcularIsfb,
  calcularPessoaIsfb,
  CORTES_DAS_DIMENSOES,
  faixaDaNota,
  notaDaTabela,
  perfilDe,
  pontosDaEscala,
  pontosDosProdutos,
  saudeDaNota,
  TABELA_GLOBAL,
  TABELAS_DAS_DIMENSOES,
  temasDa,
} from "./calculo";
import { ESTRUTURA_ISFB, PRODUTOS } from "./definicao";

/** T216 — saúde financeira: estrutura, tabelas e resultado do time. */

interface Pessoa {
  q1: string;
  /** Posições (0 a 4) de Q2 a Q12. */
  escalas: number[];
  produtos: string[];
  renda: string;
  escolaridade: string;
  auto?: [number, number, number];
}

function valores(p: Pessoa): ValorRespondido[] {
  const v: ValorRespondido[] = [
    { perguntaId: "Q1", valor: { opcao: p.q1 } },
    ...p.escalas.map((x, i) => ({ perguntaId: `Q${i + 2}`, valor: x })),
    { perguntaId: "Q13", valor: { opcoes: p.produtos } },
    { perguntaId: "Q14", valor: { opcao: p.renda } },
    { perguntaId: "Q15", valor: { opcao: p.escolaridade } },
  ];
  if (p.auto) {
    p.auto.forEach((x, i) => v.push({ perguntaId: `O${i + 1}`, valor: x }));
  }
  return v;
}

/** Tudo no melhor ponto, base alta. */
const OTIMA: Pessoa = {
  q1: "muito_menores",
  escalas: [0, 0, 0, 4, 4, 4, 4, 4, 4, 4, 4],
  produtos: PRODUTOS.slice(0, 9) as unknown as string[],
  renda: "renda_7",
  escolaridade: "esc_6",
};
/** Tudo no pior ponto, base baixa. */
const RUIM: Pessoa = {
  q1: "muito_maiores",
  escalas: [4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0],
  produtos: [],
  renda: "renda_1",
  escolaridade: "esc_1",
};
/** Meio da escala, base baixa (5 pontos), com autopercepção. */
const MEIO: Pessoa = {
  q1: "iguais",
  escalas: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  produtos: ["conta_corrente", "cartao_credito", "poupanca"],
  renda: "renda_3",
  escolaridade: "esc_4",
  auto: [3, 3, 3],
};

describe("estrutura da saúde financeira", () => {
  it("tem 15 perguntas obrigatórias e 3 de autopercepção opcionais", () => {
    const todas = ESTRUTURA_ISFB.secoes.flatMap((s) => s.perguntas);
    expect(todas.map((p) => p.id)).toEqual([
      ...Array.from({ length: 15 }, (_, i) => `Q${i + 1}`),
      "O1",
      "O2",
      "O3",
    ]);
    expect(ESTRUTURA_ISFB.secoes.map((s) => s.id)).toEqual([
      "seguranca",
      "habilidade",
      "comportamento",
      "liberdade",
      "base",
      "autopercepcao",
    ]);
    expect(ESTRUTURA_ISFB.secoes[5]!.opcional).toBe(true);
    expect(todas.find((p) => p.id === "Q13")!.opcoes).toHaveLength(14);
    expect(todas.find((p) => p.id === "Q14")!.opcoes).toHaveLength(7);
    expect(todas.find((p) => p.id === "Q15")!.opcoes).toHaveLength(6);
    const q2 = todas.find((p) => p.id === "Q2")!;
    expect(q2.config.rotulos).toEqual([
      "Nada",
      "Pouco",
      "Mais ou menos",
      "Muito",
      "Totalmente",
    ]);
    expect(q2.config.minimo).toBe(0);
    expect(todas.find((p) => p.id === "O1")!.config.rotulos![4]).toBe("Sempre");
  });

  it("as tabelas cobrem cada soma possível", () => {
    expect(TABELA_GLOBAL).toHaveLength(49);
    expect(TABELAS_DAS_DIMENSOES.seguranca).toHaveLength(17);
    expect(TABELAS_DAS_DIMENSOES.habilidade).toHaveLength(13);
    expect(TABELAS_DAS_DIMENSOES.comportamento).toHaveLength(13);
    expect(TABELAS_DAS_DIMENSOES.liberdade).toHaveLength(9);
    expect(TABELAS_DAS_DIMENSOES.autopercepcao).toHaveLength(13);
  });
});

describe("regras da nota", () => {
  it("espelha só os itens negativos e recusa fora de 0 a 4", () => {
    expect(pontosDaEscala("Q2", 0)).toBe(4);
    expect(pontosDaEscala("Q4", 3)).toBe(1);
    expect(pontosDaEscala("Q5", 3)).toBe(3);
    expect(pontosDaEscala("Q5", 5)).toBeNull();
    expect(pontosDaEscala("Q5", -1)).toBeNull();
    expect(pontosDaEscala("Q5", 1.5)).toBeNull();
  });

  it("converte a soma pela coluna da base, com arredondamento e limite", () => {
    expect(notaDaTabela(TABELA_GLOBAL, 24, true)).toBe(56);
    expect(notaDaTabela(TABELA_GLOBAL, 24, false)).toBe(42);
    expect(notaDaTabela(TABELA_GLOBAL, 23.6, true)).toBe(56);
    expect(notaDaTabela(TABELA_GLOBAL, 60, false)).toBe(96);
    expect(notaDaTabela(TABELA_GLOBAL, -3, true)).toBe(8);
  });

  it("pontua os produtos por quantidade", () => {
    expect([0, 1, 2, 3, 5, 6, 8, 9, 14].map(pontosDosProdutos)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it("faixas globais e por dimensão", () => {
    expect(faixaDaNota(36)).toBe("ruim");
    expect(faixaDaNota(37)).toBe("muito_baixa");
    expect(faixaDaNota(49)).toBe("muito_baixa");
    expect(faixaDaNota(50)).toBe("baixa");
    expect(faixaDaNota(56)).toBe("baixa");
    expect(faixaDaNota(57)).toBe("ok");
    expect(faixaDaNota(60)).toBe("ok");
    expect(faixaDaNota(61)).toBe("boa");
    expect(faixaDaNota(82)).toBe("muito_boa");
    expect(faixaDaNota(83)).toBe("otima");
    expect(faixaDaNota(32, CORTES_DAS_DIMENSOES.habilidade)).toBe(
      "muito_baixa",
    );
    expect(faixaDaNota(19, CORTES_DAS_DIMENSOES.habilidade)).toBe("ruim");
    expect(faixaDaNota(96, CORTES_DAS_DIMENSOES.liberdade)).toBe("otima");
  });

  it("saúde em 3 grupos, perfis e abertura", () => {
    expect(saudeDaNota(56)).toBe("baixa");
    expect(saudeDaNota(57)).toBe("no_limite");
    expect(saudeDaNota(60)).toBe("no_limite");
    expect(saudeDaNota(61)).toBe("saudavel");
    expect(perfilDe(50, 50)).toBe("estaveis");
    expect(perfilDe(50, 49.5)).toBe("confortaveis_sem_metodo");
    expect(perfilDe(49, 50)).toBe("apertados_organizados");
    expect(perfilDe(49, 49)).toBe("em_risco");
    expect(aberturaDe(56, 71)).toBe("sabem_que_precisam");
    expect(aberturaDe(56, 70)).toBe("ponto_cego");
    expect(aberturaDe(57, 71)).toBe("bem_e_atentos");
    expect(aberturaDe(57, 70)).toBe("bem_mas_desatentos");
  });
});

describe("nota de uma pessoa", () => {
  it("melhor caso: 96, ótima, estável e sem sinais", () => {
    const p = calcularPessoaIsfb(valores(OTIMA))!;
    expect(p.baseBaixa).toBe(false);
    expect(p.isfb).toBe(96);
    expect(p.faixa).toBe("otima");
    expect(p.dimensoes).toEqual({
      seguranca: 96,
      habilidade: 96,
      comportamento: 96,
      liberdade: 94,
    });
    expect(p.perfil).toBe("estaveis");
    expect(p.sinais).toEqual([]);
    expect(p.autopercepcao).toBeNull();
    expect(p.abertura).toBeNull();
  });

  it("pior caso: 8 (base baixa compensa), ruim, 4 sinais", () => {
    const p = calcularPessoaIsfb(valores(RUIM))!;
    expect(p.baseBaixa).toBe(true);
    expect(p.isfb).toBe(8);
    expect(p.faixa).toBe("ruim");
    expect(p.dimensoes).toEqual({
      seguranca: 0,
      habilidade: 4,
      comportamento: 4,
      liberdade: 11,
    });
    expect(p.perfil).toBe("em_risco");
    expect(p.sinais).toEqual([
      "gasta_mais",
      "estresse",
      "apertado",
      "sem_reserva",
    ]);
  });

  it("meio: 56, autopercepção 80 e 'sabem que precisam'", () => {
    const p = calcularPessoaIsfb(valores(MEIO))!;
    expect(p.baseBaixa).toBe(true);
    expect(p.isfb).toBe(56);
    expect(p.saude).toBe("baixa");
    expect(p.dimensoes.seguranca).toBe(57);
    expect(p.dimensoes.liberdade).toBe(58);
    expect(p.perfil).toBe("estaveis");
    expect(p.autopercepcao).toBe(80);
    expect(p.abertura).toBe("sabem_que_precisam");
    expect(p.sinais).toEqual([]);
    expect(temasDa(p)).toEqual([]);
  });

  it("base no limite: 6 pontos ainda é base baixa; 7 já é alta", () => {
    const seis = calcularPessoaIsfb(
      valores({ ...MEIO, renda: "renda_4", escolaridade: "esc_4" }),
    )!;
    expect(seis.baseBaixa).toBe(true);
    const sete = calcularPessoaIsfb(
      valores({ ...MEIO, renda: "renda_6", escolaridade: "esc_4" }),
    )!;
    expect(sete.baseBaixa).toBe(false);
    expect(sete.isfb).toBe(42);
  });

  it("sem a parte que forma a nota não há resultado", () => {
    const sem = valores(MEIO).filter((v) => v.perguntaId !== "Q7");
    expect(calcularPessoaIsfb(sem)).toBeNull();
    const semRenda = valores(MEIO).filter((v) => v.perguntaId !== "Q14");
    expect(calcularPessoaIsfb(semRenda)).toBeNull();
    // Q13 é opcional: sem produtos vale 0.
    const semProdutos = valores(MEIO).filter((v) => v.perguntaId !== "Q13");
    expect(calcularPessoaIsfb(semProdutos)!.sinais).toEqual(["sem_reserva"]);
  });

  it("temas de educação financeira", () => {
    const p = calcularPessoaIsfb(valores(RUIM))!;
    expect(temasDa(p)).toEqual([
      "orcamento",
      "reserva",
      "aposentadoria",
      "investimentos",
      "decidir",
    ]);
    const credito = calcularPessoaIsfb(
      valores({ ...MEIO, produtos: ["cartao_credito"] }),
    )!;
    expect(temasDa(credito)).toEqual(["reserva", "dividas"]);
  });
});

describe("resultado do time", () => {
  const r = calcularIsfb([
    { valores: valores(OTIMA) },
    { valores: valores(RUIM) },
    { valores: valores(MEIO) },
    { valores: [{ perguntaId: "Q1", valor: { opcao: "iguais" } }] },
  ]);

  it("média, faixa e diferença para o Brasil", () => {
    expect(r.pessoas).toBe(3);
    expect(r.isfb).toBe(53);
    expect(r.faixa).toBe("baixa");
    expect(r.diferencaDoBrasil).toBe(-3.7);
    const dims = Object.fromEntries(r.dimensoes.map((d) => [d.id, d]));
    expect(dims.seguranca!.nota).toBe(51);
    expect(dims.autopercepcao).toEqual({
      id: "autopercepcao",
      nota: 80,
      faixa: "boa",
      pessoas: 1,
    });
  });

  it("distribuição, saúde, sinais e perfis", () => {
    expect(r.distribuicao).toHaveLength(20);
    expect(r.distribuicao[1]).toBe(1);
    expect(r.distribuicao[11]).toBe(1);
    expect(r.distribuicao[19]).toBe(1);
    expect(r.saude.baixa).toEqual({ quantidade: 2, percentual: 66.7 });
    expect(r.saude.saudavel.quantidade).toBe(1);
    expect(r.sinais.sem_reserva).toEqual({ quantidade: 1, percentual: 33.3 });
    expect(r.sinaisAcumulados).toEqual([2, 0, 0, 0, 1]);
    expect(r.perfis.estaveis.quantidade).toBe(2);
    expect(r.perfis.em_risco.quantidade).toBe(1);
    expect(r.pontoDoTime).toEqual({ seguranca: 51, capacidade: 52 });
  });

  it("perguntas com favorável e desfavorável (já espelhadas)", () => {
    const q2 = r.perguntas.find((p) => p.id === "Q2")!;
    expect(q2.pontos).toEqual([1, 0, 1, 0, 1]);
    expect(q2.favoravel).toBe(33.3);
    expect(q2.desfavoravel).toBe(33.3);
    expect(r.perguntas.find((p) => p.id === "O1")!.respostas).toBe(1);
  });

  it("base financeira, crédito × reserva e temas", () => {
    expect(r.produtos.poupanca.quantidade).toBe(2);
    expect(r.base.semReserva.quantidade).toBe(1);
    expect(r.base.doisOuMaisFinanciamentos.quantidade).toBe(1);
    expect(r.base.produtosPorPessoa).toBe(4);
    expect(r.creditoReserva).toEqual({
      creditoSemReserva: 0,
      creditoComReserva: 2,
      semCreditoSemReserva: 1,
      semCreditoComReserva: 0,
    });
    expect(r.temas[0]!.quantidade).toBe(1);
    expect(r.aberturas.sabem_que_precisam).toEqual({
      quantidade: 1,
      percentual: 100,
    });
    expect(r.comAutopercepcao).toBe(1);
  });

  it("renda da casa: oculta abaixo do mínimo e protege o grupo menor", () => {
    expect(r.porRenda.every((g) => !g.visivel)).toBe(true);
    const tres = (renda: string) =>
      Array.from({ length: 3 }, () => ({
        valores: valores({ ...MEIO, renda }),
      }));
    const x = calcularIsfb([
      ...tres("renda_1"),
      ...tres("renda_4"),
      { valores: valores({ ...MEIO, renda: "renda_7" }) },
    ]);
    const grupo = (id: string) => x.porRenda.find((g) => g.id === id)!;
    expect(grupo("acima_28_2").oculto).toBe("minimo");
    // Só uma parte oculta: o menor visível também some.
    expect(grupo("ate_1_5").oculto).toBe("protege_grupo_menor");
    expect(grupo("de_4_2_a_14_1").visivel).toBe(true);
    expect(grupo("de_4_2_a_14_1").saude).toEqual({
      baixa: 3,
      no_limite: 0,
      saudavel: 0,
    });
  });

  it("sem pessoas: tudo vazio", () => {
    const v = calcularIsfb([]);
    expect(v.isfb).toBeNull();
    expect(v.faixa).toBeNull();
    expect(v.pontoDoTime).toBeNull();
    expect(v.base.produtosPorPessoa).toBeNull();
  });
});
