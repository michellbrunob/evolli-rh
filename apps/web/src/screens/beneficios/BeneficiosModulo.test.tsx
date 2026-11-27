/**
 * T215 — módulo Benefícios (como a referência): lista por competência,
 * assistente de 4 etapas, detalhe com os valores do mês e "Adicionar
 * pessoas". O servidor é simulado; dados sintéticos.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BeneficioApi,
  CalculoApi,
  DetalheDoBeneficioApi,
  PessoaDoBeneficioApi,
  PreviaApi,
} from "../../api/beneficiosClient";
import { baixarArquivo } from "../dashboard/exportacao";
import { lerAbasXlsx } from "../pessoas/importacao/planilhaXlsx";
import { BeneficiosModulo } from "./BeneficiosModulo";
import type { ServicoDeBeneficios } from "./servicoDeBeneficios";

vi.mock("../dashboard/exportacao", async (original) => {
  const actual = await original<typeof import("../dashboard/exportacao")>();
  return { ...actual, baixarArquivo: vi.fn() };
});

const CALC: CalculoApi = {
  dias: 19,
  origemDias: "uteis",
  valorDia: 3000,
  faixa: null,
  dependentesNoPlano: 0,
  valor: 57000,
  empresa: 45600,
  desconto: 11400,
  adicional: 0,
  parteColaborador: 0,
  pendencia: null,
  observacao: null,
};

const pessoa = (
  id: string,
  nome: string,
  extra: Partial<PessoaDoBeneficioApi> = {},
): PessoaDoBeneficioApi => ({
  ...CALC,
  colaboradorId: id,
  nome,
  cpf: null,
  cargo: "Analista",
  departamento: "Operações",
  departamentoId: "dep-1",
  contrato: "clt",
  escala: "5x2",
  planoId: null,
  valorIndividual: null,
  ajustado: false,
  coparticipacao: null,
  antecipado: null,
  dependentesCadastrados: 0,
  desligado: false,
  ...extra,
});

const ANA = pessoa("c-1", "Ana Teste");
const BIA = pessoa("c-2", "Bia Teste", {
  contrato: "estagio",
  empresa: 57000,
  desconto: 0,
  observacao: "estagio_sem_desconto",
});

const BENEFICIO: BeneficioApi = {
  id: "b-1",
  nome: "VR teste",
  categoria: "alimentacao",
  folha: "desconto",
  tipoValor: "dia_util",
  inicio: "2026-11-01",
  fim: null,
  observacao: null,
  regras: {
    categoria: "alimentacao",
    folha: "desconto",
    tipoValor: "dia_util",
    valorMensal: null,
    valorDia: 30,
    diasModo: "uteis",
    individualModo: "livre",
    planos: [],
    faixas: [],
    colaboradorPaga: { calculo: "percentual", titular: 0, dependente: 0 },
    coparticipacao: false,
    quemPaga: { modo: "empresa_parte", calculo: "percentual", empresa: 80 },
    vt: { percentualSalario: 6, empresaCusteiaTudo: false },
    antecipacao: null,
  },
  situacao: "ativo",
  suspensoAPartirDe: null,
  criadoEm: "2026-11-26T15:00:00Z",
  atualizadoEm: "2026-11-26T15:00:00Z",
};

const DETALHE: DetalheDoBeneficioApi = {
  beneficio: BENEFICIO,
  competencia: "2026-11",
  diasUteis: 19,
  totais: {
    pessoas: 2,
    comPendencia: 0,
    dependentes: 0,
    valor: 114000,
    empresa: 102600,
    desconto: 11400,
    adicional: 0,
  },
  pessoas: [ANA, BIA],
  historico: 1,
};

const PREVIA: PreviaApi = {
  competencia: "2026-11",
  diasUteis: 19,
  exemplo: { ...CALC },
  exemplosVt: [],
  ans: null,
  pat: { percentualColaborador: 20, dentro: true },
  pessoas: [ANA, BIA],
  totais: DETALHE.totais,
};

function servico(
  over: Partial<Record<keyof ServicoDeBeneficios, unknown>> = {},
) {
  const s = {
    listarBeneficios: vi.fn(async () => ({
      competencia: "2026-11",
      beneficios: [
        {
          id: "b-1",
          nome: "VR teste",
          categoria: "alimentacao",
          situacao: "ativo",
          suspensoAPartirDe: null,
          pessoas: 2,
          dependentes: 0,
          empresa: 102600,
          desconto: 11400,
        },
        {
          id: "b-3",
          nome: "Saúde teste",
          categoria: "saude",
          situacao: "ativo",
          suspensoAPartirDe: null,
          pessoas: 1,
          dependentes: 1,
          empresa: 21400,
          desconto: 6600,
        },
        {
          id: "b-2",
          nome: "Academia teste",
          categoria: "bem_estar",
          situacao: "pausado",
          suspensoAPartirDe: "2026-12",
          pessoas: 1,
          dependentes: 0,
          empresa: 0,
          desconto: 0,
        },
      ],
      resumo: {
        pessoas: 2,
        comDesconto: 1,
        empresa: 124000,
        desconto: 18000,
        beneficiosAtivos: 2,
        ativos: 5,
        semBeneficio: [
          { colaboradorId: "c-7", nome: "Davi Teste", cargo: "Vendedor" },
          { colaboradorId: "c-8", nome: "Eva Teste", cargo: null },
          { colaboradorId: "c-9", nome: "Fabi Teste", cargo: "Estagiária" },
        ],
      },
    })),
    previaDoBeneficio: vi.fn(async () => PREVIA),
    criarBeneficio: vi.fn(async () => ({ ...BENEFICIO })),
    obterBeneficio: vi.fn(async () => DETALHE),
    alterarBeneficio: vi.fn(async () => BENEFICIO),
    historicoDoBeneficio: vi.fn(async () => ({
      itens: [
        {
          id: "h-1",
          tipo: "criado",
          aPartirDe: "2026-11",
          descricao: "Benefício criado com 2 pessoas.",
          criadoEm: "2026-11-26T15:00:00Z",
        },
      ],
    })),
    candidatosDoBeneficio: vi.fn(async () => ({
      competencia: "2026-11",
      pessoas: [pessoa("c-3", "Caio Teste")],
    })),
    adicionarPessoasAoBeneficio: vi.fn(async () => ({ adicionadas: 1 })),
    removerPessoaDoBeneficio: vi.fn(async () => ({ removida: true as const })),
    salvarValoresDoBeneficio: vi.fn(async () => ({ alteradas: 1 })),
    conferirImportacaoDoBeneficio: vi.fn(async () => ({
      competencia: "2026-11",
      colunas: ["dias", "valorDia"],
      linhas: [],
    })),
    simularDependentesNoPlano: vi.fn(async () => ({
      competencia: "2026-11",
      antes: { valor: 18000, empresa: 14400, desconto: 3600 },
      depois: { valor: 28000, empresa: 21400, desconto: 6600 },
    })),
    alterarValoresEmLote: vi.fn(async () => ({ alteradas: 2 })),
    dependentesDaPessoaNoBeneficio: vi.fn(async () => ({ dependentes: [] })),
    salvarDependentesNoPlano: vi.fn(async () => ({ noPlano: 0 })),
    pausarBeneficio: vi.fn(async () => BENEFICIO),
    encerrarBeneficio: vi.fn(async () => BENEFICIO),
    reativarBeneficio: vi.fn(async () => BENEFICIO),
    excluirBeneficio: vi.fn(async () => ({ excluido: true as const })),
    duplicarBeneficio: vi.fn(async () => ({
      ...BENEFICIO,
      id: "b-9",
      nome: "VR teste (cópia)",
    })),
    ...over,
  };
  return s as typeof s & ServicoDeBeneficios;
}

const montar = (s = servico(), podeEditar = true) => {
  const onAbrirFicha = vi.fn();
  render(
    <BeneficiosModulo
      servico={s}
      podeEditar={podeEditar}
      onAbrirFicha={onAbrirFicha}
    />,
  );
  return { s, onAbrirFicha };
};

const abrirMenu = (nome: string) =>
  fireEvent.pointerDown(screen.getByRole("button", { name: nome }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Benefícios (T215) — lista", () => {
  it("vazio: o convite e os 3 passos", async () => {
    montar(
      servico({
        listarBeneficios: vi.fn(async () => ({
          competencia: "2026-11",
          beneficios: [],
          resumo: {
            pessoas: 0,
            comDesconto: 0,
            empresa: 0,
            desconto: 0,
            beneficiosAtivos: 0,
            ativos: 3,
            semBeneficio: [],
          },
        })),
      }),
    );
    expect(
      await screen.findByText("Nenhum benefício cadastrado ainda"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cadastrar primeiro benefício/ }),
    ).toBeInTheDocument();
    for (const t of [
      "Escolha o benefício",
      "Defina quem paga o quê",
      "Vincule as pessoas",
    ]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it("abas por situação, custos da competência e o menu ⋯", async () => {
    const { s } = montar();
    const tabela = await screen.findByRole("table", { name: "Benefícios" });
    // Cabeçalho, 2 benefícios ativos e o total da competência.
    expect(within(tabela).getAllByRole("row")).toHaveLength(4);
    const linha = within(tabela).getAllByRole("row")[1]!;
    expect(linha).toHaveTextContent("VR teste");
    expect(linha).toHaveTextContent("Alimentação");
    expect(linha).toHaveTextContent("R$ 1.026,00");
    expect(linha).toHaveTextContent("R$ 114,00");
    expect(screen.getByRole("tab", { name: "Pausados 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Pausados 1" }));
    expect(
      screen.getByText(/pausado a partir de 12\/2026/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Ativos 2" }));
    abrirMenu("Ações de VR teste");
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual([
      "Ver valores e pessoas",
      "Editar configuração",
      "Duplicar benefício",
      "Pausar",
      "Encerrar",
      "Excluir",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Pausar" }));
    const janela = screen.getByRole("dialog", { name: "Pausar VR teste?" });
    expect(janela).toHaveTextContent(
      "2 pessoas deixam de ter o benefício e o desconto em folha (R$ 114,00 por mês, somando todos)",
    );
    await act(async () => {
      fireEvent.click(
        within(janela).getByRole("button", { name: "Pausar benefício" }),
      );
    });
    expect(s.pausarBeneficio).toHaveBeenCalledWith(
      "b-1",
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
    expect(
      await screen.findByText(/VR teste pausado a partir de/),
    ).toBeInTheDocument();
  });

  it("pessoas com dependentes, total da competência e colunas de número à direita", async () => {
    montar();
    const tabela = await screen.findByRole("table", { name: "Benefícios" });
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas[2]).toHaveTextContent("Saúde teste");
    expect(within(linhas[2]!).getByText("+ 1 dep.")).toBeInTheDocument();
    const total = linhas[3]!;
    expect(total).toHaveTextContent("Total da competência");
    expect(total).toHaveTextContent("2 benefícios ativos · 2 pessoas");
    expect(total).toHaveTextContent("R$ 1.240,00");
    expect(total).toHaveTextContent("R$ 180,00");
    for (const nome of ["Pessoas", "Custo da empresa", "Desconto em folha"]) {
      expect(
        within(tabela).getByRole("columnheader", { name: nome }),
      ).toHaveClass("beneficios__numero");
    }
  });

  it("resumo: investimento, descontado e cobertura; Ver quem lista quem está sem benefício", async () => {
    const { onAbrirFicha } = montar();
    const resumo = await screen.findByRole("region", {
      name: "Resumo da competência",
    });
    expect(resumo).toHaveTextContent("Investimento da empresaR$ 1.240,00/mês");
    expect(resumo).toHaveTextContent(
      "Competência 11/2026 · 2 benefícios ativos",
    );
    expect(resumo).toHaveTextContent("Descontado em folhaR$ 180,00");
    expect(resumo).toHaveTextContent(
      "Parte paga pelos colaboradores · 1 pessoa",
    );
    expect(resumo).toHaveTextContent("Cobertura do time");
    expect(resumo).toHaveTextContent("2de 5 ativos");
    expect(resumo).toHaveTextContent("3 sem nenhum benefício");
    expect(within(resumo).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    fireEvent.click(within(resumo).getByRole("button", { name: "Ver quem" }));
    const gaveta = screen.getByRole("dialog", { name: "Sem nenhum benefício" });
    expect(gaveta).toHaveTextContent("3 pessoas ativas em 11/2026");
    expect(gaveta).toHaveTextContent("Davi TesteVendedor");
    fireEvent.click(within(gaveta).getByRole("button", { name: /Eva Teste/ }));
    expect(onAbrirFicha).toHaveBeenCalledWith("c-8");
  });

  it("abas vazias com o texto de cada situação", async () => {
    montar();
    await screen.findByRole("table", { name: "Benefícios" });
    fireEvent.click(screen.getByRole("tab", { name: "Encerrados 0" }));
    expect(screen.getByText("Nenhum benefício encerrado")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Benefícios encerrados ficam aqui com todo o histórico de valores.",
      ),
    ).toBeInTheDocument();
    // O resumo continua.
    expect(
      screen.getByRole("region", { name: "Resumo da competência" }),
    ).toBeInTheDocument();
  });

  it("Exportar: Excel com os custos e descontos; PDF com o relatório", async () => {
    vi.mocked(baixarArquivo).mockClear();
    montar();
    await screen.findByRole("table", { name: "Benefícios" });
    abrirMenu("Exportar");
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveTextContent("Exportar em PDFRelatório da competência");
    expect(menu).toHaveTextContent(
      "Exportar em ExcelPlanilha com custos e descontos",
    );
    expect(menu).toHaveTextContent("Competência 11/2026.");
    await act(async () => {
      fireEvent.click(
        within(menu).getByRole("menuitem", { name: /Exportar em Excel/ }),
      );
    });
    expect(baixarArquivo).toHaveBeenCalledTimes(1);
    const [bytes, nome] = vi.mocked(baixarArquivo).mock.calls[0]!;
    expect(nome).toBe("beneficios-2026-11.xlsx");
    const abas = await lerAbasXlsx(bytes as Uint8Array);
    expect(abas["Benefícios"]![0]).toEqual([
      "Benefício",
      "Categoria",
      "Situação",
      "Pessoas",
      "Dependentes",
      "Custo da empresa",
      "Desconto em folha",
    ]);
    expect(abas["Benefícios"]![1]).toEqual([
      "VR teste",
      "Alimentação",
      "Ativo",
      "2",
      "0",
      "1026",
      "114",
    ]);
    expect(abas["Benefícios"]!.at(-1)).toEqual([
      "Total da competência",
      "",
      "",
      "2",
      "",
      "1240",
      "180",
    ]);
    expect(abas["Sem benefício"]![1]).toEqual(["Davi Teste", "Vendedor"]);

    abrirMenu("Exportar");
    await act(async () => {
      fireEvent.click(
        within(await screen.findByRole("menu")).getByRole("menuitem", {
          name: /Exportar em PDF/,
        }),
      );
    });
    const [pdf, nomePdf, tipo] = vi.mocked(baixarArquivo).mock.calls[1]!;
    expect(nomePdf).toBe("beneficios-2026-11.pdf");
    expect(tipo).toBe("application/pdf");
    expect(new TextDecoder().decode((pdf as Uint8Array).slice(0, 5))).toBe(
      "%PDF-",
    );
  });

  it("sem permissão: sem Novo benefício nem ⋯", async () => {
    montar(servico(), false);
    await screen.findByRole("table", { name: "Benefícios" });
    expect(screen.queryByRole("button", { name: /Novo benefício/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Ações de VR teste" }),
    ).toBeNull();
  });
});

describe("Benefícios (T215) — assistente", () => {
  async function abrirNovo(s = servico()) {
    montar(s);
    fireEvent.click(
      await screen.findByRole("button", { name: /Novo benefício/ }),
    );
    return s;
  }

  it("dados básicos: o que falta, a regra da categoria e a folha padrão", async () => {
    await abrirNovo();
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Faltam 2 informações para continuar",
    );
    expect(screen.getByText("Escolha a categoria.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Benefício *"), {
      target: { value: "Seguro teste" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.click(screen.getByRole("option", { name: /^Seguro de vida/ }));
    expect(
      screen.getByText(
        "Seguro de vida em grupo costuma ser pago pela empresa e não entrar na folha.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /^Não entra na folha/ }),
    ).toHaveAttribute("aria-checked", "true");
    // Planos e seguros pedem o término.
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falta 1 informação para continuar",
    );
    expect(
      screen.getByText(
        "Informe o término do contrato: obrigatório para planos de saúde e seguros.",
      ),
    ).toBeInTheDocument();
  });

  it("valores: o tipo já vem marcado; a prévia do servidor traz o resumo e o PAT", async () => {
    const s = servico({
      previaDoBeneficio: vi.fn(async () => ({
        ...PREVIA,
        exemplo: {
          ...CALC,
          valor: 60000,
          empresa: 0,
          desconto: 60000,
          dias: null,
          valorDia: null,
        },
        pat: { percentualColaborador: 100, dentro: false },
      })),
    });
    await abrirNovo(s);
    fireEvent.change(screen.getByLabelText("Benefício *"), {
      target: { value: "VR teste" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.click(screen.getByRole("option", { name: /^Alimentação/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    expect(
      screen.getByRole("radio", { name: /^Valor fixo mensal/ }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.change(screen.getByLabelText("Valor do benefício"), {
      target: { value: "600" },
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => expect(s.previaDoBeneficio).toHaveBeenCalled());
    const resumo = await screen.findByRole("region", {
      name: "Resumo por pessoa",
    });
    expect(resumo).toHaveTextContent("Acima do limite");
    expect(resumo).toHaveTextContent(
      "Com a empresa pagando 80%, o desconto cai para R$ 120,00.",
    );
    fireEvent.click(
      within(resumo).getByRole("button", { name: "Ajustar para 80%" }),
    );
    expect(screen.getByLabelText("Empresa paga (% do valor)")).toHaveValue(
      "80",
    );
    const ultimo = vi.mocked(s.previaDoBeneficio).mock.calls.at(-1)?.[0] as
      { regras: { valorMensal: number } } | undefined;
    expect(ultimo?.regras.valorMensal).toBe(600);
  });

  it("colaboradores e revisão: marca, soma e salva com as pessoas", async () => {
    const s = await abrirNovo();
    fireEvent.change(screen.getByLabelText("Benefício *"), {
      target: { value: "VR teste" },
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Categoria" }));
    fireEvent.click(screen.getByRole("option", { name: /^Alimentação/ }));
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^Por dia útil/ }));
    fireEvent.change(screen.getByLabelText("Valor por dia"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Empresa paga (% do valor)"), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    const tabela = await screen.findByRole("table", { name: "Quem recebe" });
    fireEvent.click(
      within(tabela).getByRole("checkbox", { name: "Marcar Ana Teste" }),
    );
    fireEvent.click(
      within(tabela).getByRole("checkbox", { name: "Marcar Bia Teste" }),
    );
    expect(screen.getByText("2 pessoas marcadas")).toBeInTheDocument();
    expect(
      within(tabela).getByText("Estágio: sem desconto"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Empresa R\$ 1\.026,00 · Descontos R\$ 114,00 por mês/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));
    expect(
      screen.getByRole("region", { name: "O benefício" }),
    ).toHaveTextContent("Alimentação (VA/VR) · segue as regras do PAT");
    expect(
      screen.getByRole("region", { name: "Como o valor é calculado" }),
    ).toHaveTextContent("R$ 30,00 por dia trabalhado");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar benefício" }));
    });
    expect(s.criarBeneficio).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "VR teste",
        categoria: "alimentacao",
        folha: "desconto",
        tipoValor: "dia_util",
        regras: expect.objectContaining({
          valorDia: 30,
          quemPaga: {
            modo: "empresa_parte",
            calculo: "percentual",
            empresa: 80,
          },
        }),
        pessoas: [
          { colaboradorId: "c-1", planoId: null, valorIndividual: null },
          { colaboradorId: "c-2", planoId: null, valorIndividual: null },
        ],
      }),
    );
    // Depois de salvar, abre o detalhe com o aviso.
    expect(
      await screen.findByText(
        /VR teste cadastrado\. 2 pessoas recebem a partir de/,
      ),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("evolli-beneficio-rascunho")).toBeNull();
  });

  it("sair sem concluir: o rascunho fica no navegador", async () => {
    await abrirNovo();
    fireEvent.change(screen.getByLabelText("Benefício *"), {
      target: { value: "Rascunho teste" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Benefícios" }),
    );
    const janela = screen.getByRole("dialog", {
      name: "Sair sem concluir o benefício?",
    });
    fireEvent.click(
      within(janela).getByRole("button", { name: "Sair e manter rascunho" }),
    );
    expect(
      JSON.parse(window.localStorage.getItem("evolli-beneficio-rascunho")!),
    ).toMatchObject({ nome: "Rascunho teste" });
    fireEvent.click(
      await screen.findByRole("button", { name: /Novo benefício/ }),
    );
    expect(screen.getByLabelText("Benefício *")).toHaveValue("Rascunho teste");
  });
});

describe("Benefícios (T215) — detalhe", () => {
  async function abrirDetalhe(s = servico()) {
    montar(s);
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver mais sobre VR teste" }),
    );
    await screen.findByRole("table", { name: "Pessoas do benefício" });
    return s;
  }

  it("números da competência, estágio e valores do mês salvos", async () => {
    const s = await abrirDetalhe();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "VR teste",
    );
    expect(screen.getByText("R$ 1.026,00")).toBeInTheDocument();
    expect(screen.getByText("Estágio: sem desconto")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dias de Ana Teste"), {
      target: { value: "15" },
    });
    const barra = screen.getByRole("region", { name: "Alterações não salvas" });
    expect(barra).toHaveTextContent("1 alteração não salva em 11/2026");
    await act(async () => {
      fireEvent.click(
        within(barra).getByRole("button", { name: "Salvar valores" }),
      );
    });
    expect(s.salvarValoresDoBeneficio).toHaveBeenCalledWith("b-1", "2026-11", [
      { colaboradorId: "c-1", dias: 15 },
    ]);
    expect(
      await screen.findByText("Valores de 11/2026 salvos para 1 pessoa."),
    ).toBeInTheDocument();
  });

  it("alterar valor por dia: reajuste só no mês", async () => {
    const s = await abrirDetalhe();
    fireEvent.click(
      screen.getByRole("button", { name: /Alterar valor por dia/ }),
    );
    const gaveta = screen.getByRole("dialog", {
      name: "Alterar valor por dia",
    });
    fireEvent.click(
      within(gaveta).getByRole("radio", { name: "Reajuste em %" }),
    );
    fireEvent.change(within(gaveta).getByLabelText("Reajuste em %"), {
      target: { value: "10" },
    });
    await act(async () => {
      fireEvent.click(
        within(gaveta).getByRole("button", { name: /Aplicar em 2 pessoas/ }),
      );
    });
    expect(s.alterarValoresEmLote).toHaveBeenCalledWith("b-1", {
      competencia: "2026-11",
      para: "todos",
      reajustePercentual: 10,
      duracao: "mes",
    });
  });

  it("histórico e Ver colaborador", async () => {
    const s = servico();
    const { onAbrirFicha } = montar(s);
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver mais sobre VR teste" }),
    );
    await screen.findByRole("table", { name: "Pessoas do benefício" });
    abrirMenu("Ações de Ana Teste");
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Ver colaborador" }),
    );
    expect(onAbrirFicha).toHaveBeenCalledWith("c-1");
    fireEvent.click(
      screen.getByRole("tab", { name: /Histórico de alterações/ }),
    );
    const lista = await screen.findByRole("list", {
      name: "Histórico de alterações",
    });
    expect(lista).toHaveTextContent("Benefício criado");
    expect(lista).toHaveTextContent("a partir de 11/2026");
  });

  it("adicionar pessoas: marca e adiciona a partir do mês", async () => {
    const s = await abrirDetalhe();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar pessoas/ }));
    const tabela = await screen.findByRole("table", {
      name: "Pessoas que ainda não recebem",
    });
    fireEvent.click(
      within(tabela).getByRole("checkbox", { name: "Marcar Caio Teste" }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Adicionar 1 pessoa" }),
      );
    });
    expect(s.adicionarPessoasAoBeneficio).toHaveBeenCalledWith(
      "b-1",
      expect.stringMatching(/^\d{4}-\d{2}$/),
      [{ colaboradorId: "c-3" }],
    );
    expect(
      await screen.findByText(/1 pessoa adicionada a partir de/),
    ).toBeInTheDocument();
  });
});
