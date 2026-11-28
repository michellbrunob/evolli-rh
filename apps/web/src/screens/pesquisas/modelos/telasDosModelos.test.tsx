/**
 * T216 — telas da NR-1 e da saúde financeira: catálogo e autopercepção no
 * assistente, resultados (Visão geral pelo registro e as abas próprias),
 * plano de ação, conformidade, resultado individual, planilha e a escala
 * com rótulos na resposta pelo link.
 */
import {
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  AcompanhamentoNr1,
  DimensaoNr1Resultado,
  NivelNr1,
  PessoaIsfb,
  ResultadoIsfb,
  ResultadoNr1,
  ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import type {
  PesquisaDetalhe,
  RespostaDetalhe,
  ResultadosPesquisa,
} from "../../../api/pesquisasClient";
import { CampoDaPergunta } from "../../publico/CampoDaPergunta";
import {
  DETALHE,
  RESPOSTA_DETALHE,
  RESULTADOS,
  servicoFalso,
} from "../dadosDeTeste";
import { modeloDaGaleria, secoesDoModelo } from "../modelosDePesquisa";
import { ResultadosDaPesquisa } from "../ResultadosDaPesquisa";
import { DIMENSOES_NR1, ITENS_NR1 } from "./copsoq/definicao";
import { abasDoModelo } from "./exportacao";
import {
  InterruptorDaAutopercepcao,
  comAutopercepcao,
  temAutopercepcao,
} from "./isfb/Autopercepcao";
import { ITENS_ISFB } from "./isfb/definicao";
import { IndividualIsfb, leituraAutomatica } from "./isfb/VisaoGeralIsfb";
import { PainelDoModelo, VisaoGeralNr1DoRegistro } from "./registro";
import { resultadoIndividualDoModelo, visaoGeralDoModelo } from "./resultados";

// Os recortes carregam um resultado por grupo: folga na suíte cheia.
configure({ asyncUtilTimeout: 4000 });

const NIVEIS_DE_TESTE: Record<string, NivelNr1> = {
  exigencias_quantitativas: "critico",
  ritmo_trabalho: "alto",
  apoio_social_colegas: "alto",
  burnout: "medio",
};

function dimensao(id: string): DimensaoNr1Resultado {
  const d = DIMENSOES_NR1.find((x) => x.id === id)!;
  const nivel = NIVEIS_DE_TESTE[id] ?? "baixo";
  const risco = nivel === "critico" ? 3 : nivel === "alto" ? 2 : 0;
  return {
    id,
    dominio: d.dominio,
    tipo: d.tipo,
    pessoas: 4,
    escore: nivel === "critico" ? 4.25 : 3,
    tercil: nivel === "critico" ? 3 : 2,
    faixa: risco ? "risco" : "intermediario",
    distribuicao: { risco, intermediario: 4 - risco, favoravel: 0 },
    percentuais: {
      risco: risco * 25,
      intermediario: (4 - risco) * 25,
      favoravel: 0,
    },
    severidade: nivel === "critico" ? 4 : 3,
    prevalencia: nivel === "critico" ? 4 : nivel === "alto" ? 3 : 1,
    nivel,
    regraDeProtecao: false,
  };
}

const DIMENSOES = DIMENSOES_NR1.map((d) => dimensao(d.id));
const PRIORIDADES = [
  "exigencias_quantitativas",
  "apoio_social_colegas",
  "ritmo_trabalho",
  "burnout",
  ...DIMENSOES_NR1.map((d) => d.id).filter((id) => !(id in NIVEIS_DE_TESTE)),
];

const MODELO_NR1: ResultadoNr1 = {
  modelo: "copsoq",
  respostas: 4,
  dimensoes: DIMENSOES,
  prioridades: PRIORIDADES,
  niveis: { critico: 1, alto: 2, medio: 1, baixo: 25 },
  precisamDeAcao: 3,
  matriz: [
    [[], [], [], ["exigencias_quantitativas"]],
    [[], [], ["apoio_social_colegas", "ritmo_trabalho"], []],
    [[], [], [], []],
    [["burnout"], [], [], []],
  ],
  dominios: [
    {
      id: "exigencias_laborais",
      dimensoes: 4,
      precisamDeAcao: 2,
      percentualEmRisco: 31.3,
    },
  ],
  saude: [
    {
      id: "burnout",
      pessoasEmRisco: 1,
      pessoas: 4,
      percentualEmRisco: 25,
      nivel: "medio",
    },
  ],
  ofensivos: {
    pessoas: 4,
    relataram: null,
    percentual: null,
    tipos: [
      {
        id: "Q73",
        raramente: null,
        asVezes: 0,
        frequentementeOuSempre: 0,
        relataram: null,
      },
    ],
  },
  pressao: 3.31,
  recursos: 2.9,
};

const ACOMPANHAMENTO: AcompanhamentoNr1 = {
  etapas: [
    {
      id: "mapear",
      itens: [],
      evidencias: null,
      concluidaEm: null,
      concluida: true,
      automatica: true,
    },
    {
      id: "plano",
      itens: [],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: true,
    },
    {
      id: "comunicar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "validar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "treinar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "implementar",
      itens: [false, false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
    {
      id: "revisar",
      itens: [false, false],
      evidencias: null,
      concluidaEm: null,
      concluida: false,
      automatica: false,
    },
  ],
  plano: [],
  profissionalSst: { nome: null, registro: null },
  atualizadoEm: null,
  concluidas: 1,
  proxima: "plano",
  revisarEm: "2027-11",
};

const ISFB: ResultadoIsfb = {
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
  produtos: { poupanca: { quantidade: 2, percentual: 66.7 } },
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

/** Os resultados da pesquisa com o resultado do modelo. */
const GERAL_NR1: ResultadosPesquisa = {
  ...RESULTADOS,
  respostas: 4,
  recortes: ["departamento"],
  grupos: {
    departamento: [
      {
        id: "g1",
        nome: "Comercial",
        respostas: 3,
        visivel: true,
        oculto: null,
      },
      {
        id: "g2",
        nome: "Financeiro",
        respostas: 1,
        visivel: false,
        oculto: "minimo",
      },
    ],
  },
  modelo: MODELO_NR1,
};
const GERAL_ISFB: ResultadosPesquisa = {
  ...GERAL_NR1,
  respostas: 3,
  modelo: ISFB,
};

function servicoDosModelos(
  extra: Partial<ServicoDosModelos> = {},
): ServicoDosModelos {
  return {
    acompanhamentoNr1: vi.fn(() => Promise.resolve(ACOMPANHAMENTO)),
    gravarAcompanhamentoNr1: vi.fn((_id, e) =>
      Promise.resolve({
        ...ACOMPANHAMENTO,
        plano: e.plano,
        concluidas: e.plano.length ? 2 : 1,
      }),
    ),
    ...extra,
  };
}

const NR1: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "copsoq",
  identificacao: "anonima",
  separarPor: ["departamento"],
};
const SAUDE_FIN: PesquisaDetalhe = {
  ...DETALHE,
  modelo: "isfb",
  identificacao: "anonima",
  separarPor: ["departamento"],
};

describe("catálogo e autopercepção no assistente", () => {
  it("NR-1: 76 perguntas com a chave do item, em 8 domínios, e o selo da escala", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("copsoq"));
    expect(secoes).toHaveLength(8);
    const perguntas = secoes.flatMap((s) => s.perguntas);
    expect(perguntas.map((p) => p.chave)).toEqual(ITENS_NR1.map((i) => i.id));
    expect(perguntas[63]!.config.rotulos).toEqual([
      "Excelente",
      "Muito boa",
      "Boa",
      "Regular",
      "Fraca",
    ]);
    expect(perguntas.every((p) => p.obrigatoria)).toBe(true);
    expect(perguntas.every((p) => p.texto.length <= 300)).toBe(true);
    expect(perguntas.every((p) => (p.rotulo ?? "").length <= 40)).toBe(true);
    expect(modeloDaGaleria("copsoq").fixo).toBe(true);
  });

  it("saúde financeira: 18 perguntas, opções na ordem do modelo", () => {
    const perguntas = secoesDoModelo(modeloDaGaleria("isfb")).flatMap(
      (s) => s.perguntas,
    );
    expect(perguntas.map((p) => p.chave)).toEqual(ITENS_ISFB.map((i) => i.id));
    const q13 = perguntas.find((p) => p.chave === "Q13")!;
    expect(q13.tipo).toBe("multipla_escolha");
    expect(q13.obrigatoria).toBe(true);
    expect(q13.config.opcoes).toHaveLength(14);
    expect(q13.config.opcoes![3]!.texto).toBe("Poupança");
    expect(perguntas.find((p) => p.chave === "Q2")!.config).toMatchObject({
      minimo: 0,
      maximo: 4,
      somenteRotulos: true,
    });
    // As 15 da nota; só a autopercepção é opcional.
    expect(perguntas.filter((p) => p.obrigatoria)).toHaveLength(15);
  });

  it("o interruptor tira e volta a autopercepção", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("isfb"));
    const onMudar = vi.fn();
    render(
      <InterruptorDaAutopercepcao
        secoes={secoes}
        travado={false}
        onMudar={onMudar}
      />,
    );
    const interruptor = screen.getByRole("switch", {
      name: "Incluir autopercepção",
    });
    expect(interruptor).toHaveAttribute("aria-checked", "true");
    fireEvent.click(interruptor);
    const sem = onMudar.mock.calls[0]![0];
    expect(temAutopercepcao(sem)).toBe(false);
    expect(
      sem.flatMap((s: { perguntas: unknown[] }) => s.perguntas),
    ).toHaveLength(15);
    const com = comAutopercepcao(sem, true);
    expect(temAutopercepcao(com)).toBe(true);
    expect(
      com
        .flatMap((s) => s.perguntas)
        .map((p) => p.chave)
        .slice(-3),
    ).toEqual(["O1", "O2", "O3"]);
  });
});

describe("resultados da NR-1", () => {
  it("abas próprias e a visão geral pelo registro", async () => {
    const servico = servicoFalso({
      obterPesquisa: vi.fn(() => Promise.resolve(NR1)),
      resultadosDaPesquisa: vi.fn(() => Promise.resolve(GERAL_NR1)),
    });
    render(
      <ResultadosDaPesquisa
        servico={servico}
        servicoDosModelos={servicoDosModelos()}
        pesquisaId="p-1"
        podeEditar
        onVoltar={vi.fn()}
        onEditar={vi.fn()}
      />,
    );
    const abas = await screen.findAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual([
      "Visão geral",
      "Por grupo",
      "Plano de ação",
      "Conformidade NR-1",
      expect.stringMatching(/^Respostas/),
    ]);
    expect(
      await screen.findByText("de 29 dimensões precisam de ação"),
    ).toBeInTheDocument();
    const matriz = screen.getByRole("table", { name: /Matriz de risco/ });
    expect(
      within(matriz).getAllByText("Exigências Quantitativas").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("1 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima dimensão" }));
    expect(
      screen.getByText("2 de 3 em risco alto ou crítico"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/menos de 3 pessoas/).length).toBeGreaterThan(0);
    const ranking = screen.getByRole("region", {
      name: "Ranking de prioridades",
    });
    expect(within(ranking).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(within(ranking).getByRole("button", { name: /Todas/ }));
    expect(within(ranking).getAllByRole("row")).toHaveLength(30);
  }, 20_000);

  it("a visão geral mostra o andamento da conformidade", async () => {
    render(
      <VisaoGeralNr1DoRegistro
        detalhe={NR1}
        geral={GERAL_NR1}
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    expect(await screen.findByText("1 de 7 etapas")).toBeInTheDocument();
    expect(screen.getByText("0 medidas")).toBeInTheDocument();
  });

  it("sem o resultado do modelo, a visão geral do registro não aparece", () => {
    expect(visaoGeralDoModelo(NR1, { ...GERAL_NR1, modelo: null })).toBeNull();
  });

  it("plano de ação: o RH escreve a medida e salva", async () => {
    const sm = servicoDosModelos();
    render(
      <PainelDoModelo
        detalhe={NR1}
        geral={GERAL_NR1}
        servico={servicoFalso()}
        aba="plano"
        podeEditar
        servicoDosModelos={sm}
      />,
    );
    expect(
      await screen.findByRole("region", {
        name: "Medidas de Exigências Quantitativas",
      }),
    ).toBeInTheDocument();
    const salvar = await screen.findByRole("button", { name: "Salvar plano" });
    expect(salvar).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar medida" }));
    fireEvent.change(screen.getByLabelText("O que fazer"), {
      target: { value: "Rever a carga" },
    });
    fireEvent.change(screen.getByLabelText("Controle"), {
      target: { value: "eliminacao" },
    });
    fireEvent.click(salvar);
    await waitFor(() =>
      expect(sm.gravarAcompanhamentoNr1).toHaveBeenCalledTimes(1),
    );
    const [, entrada] = vi.mocked(sm.gravarAcompanhamentoNr1).mock.calls[0]!;
    expect(entrada.plano).toEqual([
      expect.objectContaining({
        dimensaoId: "exigencias_quantitativas",
        titulo: "Rever a carga",
        controle: "eliminacao",
        situacao: "planejada",
      }),
    ]);
  });

  it("plano sem permissão: só leitura", async () => {
    render(
      <PainelDoModelo
        detalhe={NR1}
        geral={GERAL_NR1}
        servico={servicoFalso()}
        aba="plano"
        podeEditar={false}
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    await screen.findByRole("region", { name: /Medidas de/ });
    expect(
      screen.queryByRole("button", { name: "+ Adicionar medida" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar plano" })).toBeNull();
  });

  it("conformidade: concluir exige um item marcado e grava a etapa", async () => {
    const sm = servicoDosModelos();
    render(
      <PainelDoModelo
        detalhe={NR1}
        geral={GERAL_NR1}
        servico={servicoFalso()}
        aba="conformidade"
        podeEditar
        servicoDosModelos={sm}
      />,
    );
    expect(
      await screen.findByRole("img", { name: "1 de 7 etapas concluídas" }),
    ).toBeInTheDocument();
    const comunicar = screen
      .getByText("Comunicar os resultados às pessoas")
      .closest("li")!;
    const concluir = within(comunicar).getByRole("button", {
      name: "Concluir etapa",
    });
    expect(concluir).toBeDisabled();
    fireEvent.click(
      within(comunicar).getByLabelText(
        "Registrar a ata com a lista de presença",
      ),
    );
    expect(concluir).toBeEnabled();
    fireEvent.click(concluir);
    await waitFor(() =>
      expect(sm.gravarAcompanhamentoNr1).toHaveBeenCalledTimes(1),
    );
    const [, entrada] = vi.mocked(sm.gravarAcompanhamentoNr1).mock.calls[0]!;
    expect(entrada.etapas.find((e) => e.id === "comunicar")).toEqual({
      id: "comunicar",
      itens: [false, false, true],
      evidencias: null,
      concluida: true,
    });
    expect(entrada.etapas.map((e) => e.id)).not.toContain("mapear");
    expect(screen.getByText("Prevista para 11/2027")).toBeInTheDocument();
  });

  it("confidencial abaixo do mínimo: nada aparece", () => {
    render(
      <PainelDoModelo
        detalhe={{ ...NR1, identificacao: "confidencial", respostas: 2 }}
        geral={{
          ...GERAL_NR1,
          modelo: null,
          filtro: { ...GERAL_NR1.filtro, visivel: false },
        }}
        servico={servicoFalso()}
        aba="analises"
        podeEditar
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    expect(
      screen.getByText("Poucas respostas para mostrar"),
    ).toBeInTheDocument();
  });

  it("por grupo: um resultado por grupo visível; o pequeno fica oculto", async () => {
    const doGrupo: ResultadosPesquisa = {
      ...GERAL_NR1,
      respostas: 3,
      modelo: { ...MODELO_NR1, pressao: 3.6, recursos: 2.5, precisamDeAcao: 1 },
    };
    const resultadosDaPesquisa = vi.fn(() => Promise.resolve(doGrupo));
    render(
      <PainelDoModelo
        detalhe={NR1}
        geral={GERAL_NR1}
        servico={servicoFalso({ resultadosDaPesquisa })}
        aba="analises"
        podeEditar
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    expect(
      await screen.findByText("Mais pressão e menos recursos"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    expect(resultadosDaPesquisa).toHaveBeenCalledTimes(1);
    expect(resultadosDaPesquisa).toHaveBeenCalledWith("p-1", {
      campo: "departamento",
      grupoId: "g1",
    });
  });
});

describe("resultados da saúde financeira", () => {
  it("nota do time, faixa, sinais e renda oculta", () => {
    render(<>{visaoGeralDoModelo(SAUDE_FIN, GERAL_ISFB)}</>);
    // Só a nota do time leva o intervalo; as dimensões mostram só a faixa.
    expect(screen.getAllByText("Baixa · 50 a 56")).toHaveLength(1);
    expect(screen.getByText("Brasil 56,7 · −3,7")).toBeInTheDocument();
    expect(
      screen.getByText("67% dizem que dinheiro gera estresse em casa"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oculto · menos de 3 respostas"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Nota do time: 53 de 100/ }),
    ).toBeInTheDocument();
  });

  it("a Visão geral da aba geral leva às Análises", () => {
    const ir = vi.fn();
    render(<>{visaoGeralDoModelo(SAUDE_FIN, GERAL_ISFB, ir)}</>);
    fireEvent.click(
      screen.getByRole("button", { name: "Ver análises do time ›" }),
    );
    expect(ir).toHaveBeenCalledWith("analises");
  });

  it("análises: sinais acumulados, crédito × reserva e abertura a apoio", async () => {
    const resultadosDaPesquisa = vi.fn(() =>
      Promise.resolve({ ...GERAL_ISFB, respostas: 3 }),
    );
    render(
      <PainelDoModelo
        detalhe={SAUDE_FIN}
        geral={GERAL_ISFB}
        servico={servicoFalso({ resultadosDaPesquisa })}
        aba="analises"
        podeEditar
        servicoDosModelos={servicoDosModelos()}
      />,
    );
    expect(screen.getByText("1 pessoa com 3 ou 4 sinais")).toBeInTheDocument();
    expect(screen.getByText("Risco de dívida cara")).toBeInTheDocument();
    expect(screen.getByText("Sabem que precisam")).toBeInTheDocument();
    expect(await screen.findByText("Comercial")).toBeInTheDocument();
  });

  it("leitura automática por regras", () => {
    expect(leituraAutomatica(ISFB)).toEqual({
      urgente: "67% dizem que dinheiro gera estresse em casa.",
      atencao: "Segurança é a dimensão mais baixa (51 de 100).",
      pontoForte: "Comportamento é a dimensão mais alta (60 de 100).",
    });
  });

  it("resultado individual pelo registro", () => {
    const pessoa: PessoaIsfb = {
      modelo: "isfb",
      isfb: 96,
      faixa: "otima",
      saude: "saudavel",
      dimensoes: {
        seguranca: 96,
        habilidade: 96,
        comportamento: 96,
        liberdade: 94,
      },
      autopercepcao: null,
      baseBaixa: false,
      perfil: "estaveis",
      sinais: [],
      abertura: null,
      produtos: [],
      pontos: {},
      renda: 6,
      isfbDoTime: 53,
      mediaDoBrasil: 56.7,
      dimensoesDoTime: { seguranca: 51 },
    };
    render(
      <>
        {resultadoIndividualDoModelo({ ...RESPOSTA_DETALHE, modelo: pessoa })}
      </>,
    );
    expect(screen.getByText("Ótima · 83 a 100")).toBeInTheDocument();
    expect(
      screen.getByText(/\+39,3 pontos em relação à média do Brasil/),
    ).toBeInTheDocument();
    expect(screen.getByText("Estáveis")).toBeInTheDocument();
    render(<IndividualIsfb p={{ ...pessoa, sinais: ["sem_reserva"] }} />);
    expect(screen.getByText("Sem reserva")).toBeInTheDocument();
  });
});

describe("planilha", () => {
  const RESPOSTA: RespostaDetalhe = {
    ...RESPOSTA_DETALHE,
    nome: null,
    numero: 2,
    valores: [{ perguntaId: "q-Q1", valor: 4, mediaTime: null }],
  };

  it("NR-1: dimensões, matriz, domínios, destaques e metodologia", () => {
    const abas = abasDoModelo(GERAL_NR1, "Empresa Sintética", "NR-1", {
      minimoPorGrupo: 3,
    });
    expect(abas.map((a) => a.nome)).toEqual([
      "Dimensões NR-1",
      "Matriz Psicossocial",
      "Domínios",
      "Destaques",
      "Metodologia e NR-1",
    ]);
    const linha = abas[0]!.linhas.find(
      (l) => l[1] === "Exigências Quantitativas",
    )!;
    expect(linha[3]).toBe("Risco");
    expect(linha[9]).toBe("Crítico");
    expect(linha[10]).toEqual({ numero: 0.75, formato: "percentual" });
    const destaques = abas[3]!.linhas;
    expect(destaques).toContainEqual([
      "Relataram ao menos um tipo",
      "Menos de 3",
      "—",
    ]);
  });

  it("saúde financeira: índice, pessoas (com a nota) e perguntas", () => {
    const secoes = secoesDoModelo(modeloDaGaleria("isfb"));
    const abas = abasDoModelo(GERAL_ISFB, "Empresa Sintética", "SF", {
      minimoPorGrupo: 3,
      respostas: [RESPOSTA],
      secoes,
    });
    expect(abas.map((a) => a.nome)).toEqual([
      "Saúde financeira",
      "Pessoas",
      "Perguntas",
      "Abertura a apoio",
    ]);
    expect(abas[0]!.linhas).toContainEqual([
      "Nota do time (0 a 100)",
      53,
      "Baixa",
    ]);
    expect(abas[0]!.linhas).toContainEqual([
      "Média do Brasil (referência nacional, 2024)",
      { numero: 56.7, formato: "decimal" },
    ]);
    expect(abas[1]!.linhas[0]!.slice(11, 13)).toEqual(["Q1", "Q2"]);
    expect(abas[1]!.linhas[1]![0]).toBe("Resposta #2");
    expect(abas[1]!.linhas[1]![2]).toBe("—");
    expect(abas[2]!.linhas[1]).toEqual([
      "Q2",
      "Dinheiro não gera estresse em casa",
      { numero: 0.333, formato: "percentual" },
      { numero: 0.667, formato: "percentual" },
      1,
      1,
      0,
      0,
      1,
    ]);
    // Confidencial: sem a aba de pessoas.
    expect(
      abasDoModelo(GERAL_ISFB, "E", "SF", { respostas: null }).map(
        (a) => a.nome,
      ),
    ).not.toContain("Pessoas");
  });
});

describe("escala com o rótulo de cada ponto (resposta pelo link)", () => {
  it("NR-1: número e rótulo; saúde financeira: só os rótulos, em lista", () => {
    const [q1] = secoesDoModelo(modeloDaGaleria("copsoq"))[0]!.perguntas;
    const aoMudar = vi.fn();
    const { unmount } = render(
      <CampoDaPergunta
        pergunta={q1!}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /5\s*Sempre/ }));
    expect(aoMudar).toHaveBeenCalledWith(5);
    unmount();
    const q2 = secoesDoModelo(modeloDaGaleria("isfb"))[0]!.perguntas[1]!;
    render(
      <CampoDaPergunta
        pergunta={q2}
        valor={undefined}
        erro={null}
        aoMudar={aoMudar}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Nada" }));
    expect(aoMudar).toHaveBeenLastCalledWith(0);
    expect(
      screen.getByRole("radio", { name: "Totalmente" }),
    ).toBeInTheDocument();
  });
});
