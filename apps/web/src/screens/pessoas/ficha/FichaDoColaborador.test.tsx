/**
 * T215 — a ficha do colaborador no desenho da referência: cabeçalho (foto,
 * nome, status, contrato, cargo, ⋯ Mais ações, Exportar ficha, Editar
 * colaborador), a faixa de E-mail, Telefone, Tempo de casa e Carga horária,
 * o Portal do colaborador, as nove abas e a aba "Dados do colaborador" com
 * os quatro cartões.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FichaDoColaborador } from "./FichaDoColaborador";
import {
  buscarColaborador,
  listarVinculosDoColaborador,
} from "../../../api/colaboradoresClient";
import {
  consultarContratoDoColaborador,
  desativarColaborador,
} from "../../../api/edicaoColaboradorClient";
import { consultarDadosPessoaisDoColaborador } from "../../../api/dadosPessoaisClient";
import { consultarContatosDoColaborador } from "../../../api/contatosColaboradorClient";
import { listarAlocacoesVinculo } from "../../../api/vinculoContratualClient";
import { buscarCargo } from "../../../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarUnidades,
} from "../../../api/organizacaoClient";
import { consultarEscalas } from "../../../api/escalaClient";
import {
  efetivarMovimentacao,
  registrarMovimentacao,
} from "../../../api/movimentacaoClient";

vi.mock("../../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/colaboradoresClient")
  >("../../../api/colaboradoresClient");
  return {
    ...actual,
    buscarColaborador: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
  };
});
vi.mock("../../../api/edicaoColaboradorClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/edicaoColaboradorClient")
  >("../../../api/edicaoColaboradorClient");
  return {
    ...actual,
    consultarContratoDoColaborador: vi.fn(),
    desativarColaborador: vi.fn(),
    reativarColaborador: vi.fn(),
  };
});
vi.mock("../../../api/dadosPessoaisClient");
vi.mock("../../../api/contatosColaboradorClient");
vi.mock("../../../api/vinculoContratualClient");
vi.mock("../../../api/cargoClient");
vi.mock("../../../api/organizacaoClient");
vi.mock("../../../api/movimentacaoClient");
vi.mock("../../../api/escalaClient");

const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const GESTORA = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const EMPRESA = "0d9f8e7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c";
const HOJE = "2026-11-23";

function prepararServidor({
  comEmail = true,
}: { readonly comEmail?: boolean } = {}) {
  vi.mocked(buscarColaborador).mockImplementation(async (id) => ({
    id,
    nome: id === GESTORA ? "Gestora Teste" : "Maria Teste Santos",
    situacao: "ativo",
    criadoEm: "2024-01-10T12:00:00.000Z",
    atualizadoEm: "2026-11-01T12:00:00.000Z",
    foto: null,
  }));
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
    {
      id: "v-1",
      colaboradorId: ID,
      empresaId: EMPRESA,
      matricula: "0042",
      tipo: "clt",
      situacao: "ativo",
      dataAdmissao: "2024-01-10",
      dataDesligamento: null,
      criadoEm: "2024-01-10T12:00:00.000Z",
      atualizadoEm: "2024-01-10T12:00:00.000Z",
    },
  ]);
  vi.mocked(consultarContratoDoColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    vinculo: {
      id: "v-1",
      matricula: "0042",
      tipo: "clt",
      situacao: "ativo",
      dataAdmissao: "2024-01-10",
      dataDesligamento: null,
    },
    contrato: {
      nivel: "pleno",
      gestorDiretoId: GESTORA,
      jornadaSemanalHoras: 44,
      escala: "5x2",
      salarioBruto: "5000.00",
      conselhoProfissional: null,
      registroProfissional: null,
      dependentesIrrf: null,
      pensaoAlimenticiaPercentual: null,
    },
    atualizadoEm: null,
    desativado: false,
    desativadoEm: null,
  });
  vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    situacao: "registrado",
    perfilPessoal: {
      dataNascimento: "1990-05-10",
      cpf: "52998224725",
      rg: "12.345.678-9",
      genero: "feminino",
      contatoEmergenciaNome: "João Teste",
      contatoEmergenciaTelefone: "+5511988887777",
      sexo: null,
      saudacao: null,
      estadoCivil: "Casado(a)",
      nacionalidade: null,
      naturalidade: null,
      escolaridade: null,
      curso: null,
      nomePai: null,
      nomeMae: null,
      atualizadoEm: "2026-11-01T12:00:00.000Z",
    },
    endereco: {
      pais: "Brasil",
      cep: "01310100",
      logradouro: "Av. Teste",
      numero: "1000",
      complemento: "Sala 501",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      atualizadoEm: "2026-11-01T12:00:00.000Z",
    },
  });
  vi.mocked(consultarContatosDoColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    situacao: comEmail ? "registrado" : "sem_registro",
    contatos: comEmail
      ? {
          emailPessoal: "maria.teste@example.test",
          celular: "+5511999998888",
          telefone: null,
          atualizadoEm: "2026-11-01T12:00:00.000Z",
        }
      : null,
  });
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
    {
      id: "al-1",
      vinculoId: "v-1",
      empresaId: EMPRESA,
      unidadeOrganizacionalId: "u-1",
      departamentoId: "d-1",
      areaId: null,
      equipeId: null,
      cargoId: "c-1",
      centroCustoId: "cc-1",
      vigenteDe: "2024-01-10",
      vigenteAte: null,
      movimentacaoOrigemId: "m-1",
      criadoEm: "2024-01-10T12:00:00.000Z",
    },
  ]);
  vi.mocked(buscarCargo).mockResolvedValue({
    id: "c-1",
    nome: "Analista de RH",
  } as never);
  vi.mocked(buscarDepartamento).mockResolvedValue({
    id: "d-1",
    nome: "Pessoas",
  } as never);
  vi.mocked(listarAreas).mockResolvedValue({ itens: [] } as never);
  vi.mocked(listarCentrosCusto).mockResolvedValue({
    itens: [{ id: "cc-1", nome: "Administrativo", status: "ativo" }],
  } as never);
  vi.mocked(listarUnidades).mockResolvedValue({
    itens: [{ id: "u-1", nome: "Matriz", status: "ativo" }],
  } as never);
  vi.mocked(registrarMovimentacao).mockResolvedValue({ id: "mov-1" } as never);
  vi.mocked(efetivarMovimentacao).mockResolvedValue({ id: "mov-1" } as never);
  vi.mocked(desativarColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    desativado: true,
    desativadoEm: "2026-11-23T12:00:00.000Z",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prepararServidor();
});

function montar(props: Partial<Parameters<typeof FichaDoColaborador>[0]> = {}) {
  const onEditar = vi.fn();
  const onTrocarAba = vi.fn();
  render(
    <FichaDoColaborador
      colaboradorId={ID}
      aba="dados"
      onTrocarAba={onTrocarAba}
      onVoltar={vi.fn()}
      podeEditar
      onEditar={onEditar}
      hoje={HOJE}
      {...props}
    />,
  );
  return { onEditar, onTrocarAba };
}

const cartao = (titulo: string) => screen.getByRole("region", { name: titulo });

describe("T215 — ficha: cabeçalho, faixa e Portal", () => {
  it("foto, nome, status, contrato, cargo e as ações do topo", async () => {
    montar();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Maria Teste Santos",
      }),
    ).toBeInTheDocument();
    const topo = screen.getByRole("region", { name: "Maria Teste Santos" });
    expect(within(topo).getByText("Ativo")).toBeInTheDocument();
    expect(within(topo).getByText("CLT")).toBeInTheDocument();
    expect(await within(topo).findByText("Analista de RH")).toBeInTheDocument();
    for (const nome of ["Mais ações", "Exportar ficha", "Editar colaborador"]) {
      expect(
        within(topo).getByRole("button", { name: nome }),
      ).toBeInTheDocument();
    }
  });

  it("E-mail, Telefone, Tempo de casa e Carga horária e escala", async () => {
    montar();
    const faixa = await screen.findByRole("list", {
      name: "Resumo do colaborador",
    });
    await waitFor(() =>
      expect(faixa).toHaveTextContent("maria.teste@example.test"),
    );
    expect(faixa).toHaveTextContent("(11) 99999-8888");
    expect(faixa).toHaveTextContent("Tempo de casa2 anos e 10 meses");
    expect(faixa).toHaveTextContent("Carga horária e escala44h semanais · 5x2");
    // E-mail longo fica numa linha, com o endereço inteiro na dica.
    expect(within(faixa).getByText("maria.teste@example.test")).toHaveAttribute(
      "title",
      "maria.teste@example.test",
    );
  });

  it("Portal: com e-mail, não convidada e o convite (em breve)", async () => {
    montar();
    const portal = await screen.findByRole("region", {
      name: "Portal do colaborador",
    });
    expect(
      await within(portal).findByText("Não convidada"),
    ).toBeInTheDocument();
    expect(
      within(portal).getByText(
        "A Maria ainda não tem acesso. Envie o convite para ela criar a conta.",
      ),
    ).toBeInTheDocument();
    expect(
      within(portal).getByRole("button", { name: "Enviar convite" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("Portal: sem e-mail, Adicionar e-mail leva à edição", async () => {
    prepararServidor({ comEmail: false });
    const { onEditar } = montar();
    const portal = await screen.findByRole("region", {
      name: "Portal do colaborador",
    });
    expect(await within(portal).findByText("Sem e-mail")).toBeInTheDocument();
    expect(
      within(portal).getByText(
        "Cadastre um e-mail para poder enviar o convite do portal.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(portal).getByRole("button", { name: "Adicionar e-mail" }),
    );
    expect(onEditar).toHaveBeenCalledWith("dados-basicos");
  });

  it("as nove abas, na ordem da referência", async () => {
    const { onTrocarAba } = montar();
    const abas = within(
      await screen.findByRole("tablist", { name: "Seções da ficha" }),
    ).getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual([
      "Dados do colaborador",
      "Salários",
      "Férias e ausências",
      "Escala",
      "Benefícios",
      "Pesquisas",
      "Documentos",
      "Desenvolvimento",
      "Comentários",
    ]);
    expect(abas[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.click(abas[6]!);
    expect(onTrocarAba).toHaveBeenCalledWith("documentos");
  });
});

describe("T215 — ficha: aba Dados do colaborador", () => {
  it("os quatro cartões, com os dados gravados", async () => {
    montar();
    await waitFor(() =>
      expect(cartao("Dados profissionais")).toHaveTextContent("Pessoas"),
    );
    const prof = cartao("Dados profissionais");
    expect(prof).toHaveTextContent("Área, nível e liderança");
    expect(prof).toHaveTextContent("DepartamentoPessoas");
    expect(prof).toHaveTextContent("NívelPleno");
    await waitFor(() =>
      expect(prof).toHaveTextContent("Gestor diretoGestora Teste"),
    );
    expect(prof).toHaveTextContent("UnidadeMatriz");
    expect(prof).toHaveTextContent("Centro de custoAdministrativo");

    const pessoais = cartao("Dados pessoais");
    expect(pessoais).toHaveTextContent("Documentos e informações civis");
    expect(pessoais).toHaveTextContent("Nome completoMaria Teste Santos");
    expect(pessoais).toHaveTextContent("CPF529.982.247-25");
    expect(pessoais).toHaveTextContent("RG12.345.678-9");
    expect(pessoais).toHaveTextContent("Nascimento10/05/199036 anos");
    expect(pessoais).toHaveTextContent("GêneroFeminino");
    expect(pessoais).toHaveTextContent("Estado civilCasado(a)");

    const endereco = cartao("Endereço");
    expect(endereco).toHaveTextContent("Residência para correspondências");
    expect(endereco).toHaveTextContent("LogradouroAv. Teste, 1000");
    expect(endereco).toHaveTextContent("ComplementoSala 501");
    expect(endereco).toHaveTextContent("CEP01310-100");
    expect(endereco).toHaveTextContent("Cidade/UFSão Paulo - SP");

    const emergencia = cartao("Contato de emergência");
    expect(emergencia).toHaveTextContent("Acionado em caso de urgência");
    expect(emergencia).toHaveTextContent("NomeJoão Teste");
    expect(emergencia).toHaveTextContent("Telefone(11) 98888-7777");
  });

  it("campo vazio: o traço fica apagado, sem o peso do valor", async () => {
    const atual = await vi.mocked(consultarDadosPessoaisDoColaborador)(ID);
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      ...atual,
      perfilPessoal: { ...atual.perfilPessoal!, rg: null },
    } as never);
    montar();
    const pessoais = await screen.findByRole("region", {
      name: "Dados pessoais",
    });
    await waitFor(() => expect(pessoais).toHaveTextContent("RG—"));
    expect(within(pessoais).getByText("—")).toHaveClass(
      "ficha-ref__campo-valor--vazio",
    );
    expect(within(pessoais).getByText("Maria Teste Santos")).not.toHaveClass(
      "ficha-ref__campo-valor--vazio",
    );
  });

  it("cada Editar leva à seção certa; sem permissão, nenhum Editar", async () => {
    const { onEditar } = montar();
    await waitFor(() =>
      expect(cartao("Dados profissionais")).toHaveTextContent("Pessoas"),
    );
    const esperado = [
      ["Dados profissionais", "dados-profissionais"],
      ["Dados pessoais", "dados-basicos"],
      ["Endereço", "endereco"],
      ["Contato de emergência", "dados-basicos"],
    ] as const;
    for (const [titulo, secao] of esperado) {
      fireEvent.click(
        within(cartao(titulo)).getByRole("button", { name: "Editar" }),
      );
      expect(onEditar).toHaveBeenLastCalledWith(secao);
    }
  });

  it("quem só lê não vê Editar nem Editar colaborador", async () => {
    montar({ podeEditar: false });
    await screen.findByRole("heading", {
      level: 1,
      name: "Maria Teste Santos",
    });
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Editar colaborador" }),
    ).toBeNull();
  });
});

describe("T215 — ficha: Mais ações", () => {
  async function abrirMenu() {
    const botao = await screen.findByRole("button", { name: "Mais ações" });
    fireEvent.keyDown(botao, { key: "Enter" });
    return screen.findByRole("menu");
  }

  it("grupos Portal do colaborador e Colaborador", async () => {
    montar();
    await screen.findByText("Analista de RH");
    const menu = await abrirMenu();
    expect(menu).toHaveTextContent("Portal do colaborador");
    expect(menu).toHaveTextContent("Colaborador");
    const itens = within(menu)
      .getAllByRole("menuitem")
      .map((i) => i.textContent);
    expect(itens).toEqual([
      "Enviar convite do portalEla ainda não tem acesso",
      "Registrar ausência",
      "Alterar statusAtivo, férias, afastado…",
      "Desligar colaborador",
      "Desativar colaborador",
    ]);
  });

  it("Desligar: pergunta a data e registra o desligamento", async () => {
    montar();
    await screen.findByText("Analista de RH");
    const menu = await abrirMenu();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Desligar colaborador" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Desligar Maria Teste Santos?",
    });
    expect(
      within(janela).getByText(
        "Ela sai da lista de ativos e perde o acesso ao portal. O histórico continua guardado na aba Desligados.",
      ),
    ).toBeInTheDocument();
    expect(within(janela).getByLabelText("Data do desligamento")).toHaveValue(
      HOJE,
    );
    fireEvent.click(
      within(janela).getByRole("button", { name: "Desligar colaborador" }),
    );
    await waitFor(() =>
      expect(registrarMovimentacao).toHaveBeenCalledWith({
        vinculoId: "v-1",
        tipo: "desligamento",
        motivoCodigo: "encerramento_de_vinculo",
        vigenciaInicio: HOJE,
      }),
    );
    await waitFor(() =>
      expect(efetivarMovimentacao).toHaveBeenCalledWith("mov-1"),
    );
  });

  it("Desativar: confirma e desativa (nada é apagado)", async () => {
    montar();
    await screen.findByText("Analista de RH");
    const menu = await abrirMenu();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Desativar colaborador" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Desativar Maria Teste Santos?",
    });
    fireEvent.click(within(janela).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(desativarColaborador).toHaveBeenCalledWith(ID));
    expect(
      await screen.findByText("Inativo", { selector: "span" }),
    ).toBeInTheDocument();
  });
});

describe("T215 — cabeçalho com a escala da ficha", () => {
  it("a escala vigente definida na ficha vale no lugar da do contrato", async () => {
    vi.mocked(consultarEscalas).mockResolvedValue({
      colaboradorId: ID,
      empresaId: EMPRESA,
      vinculo: { dataAdmissao: "2024-01-01", situacao: "ativo" },
      escalaDoCadastro: "5x2",
      escalas: [
        {
          id: "e1",
          modelo: "6x1",
          turno: null,
          turnoNoite: null,
          folgaSemanal: 7,
          diasTrabalho: [],
          inicioCiclo: null,
          vigenciaInicio: "2024-02-01",
          vigenciaFim: null,
          definidaEm: "2024-02-01T12:00:00.000Z",
          definidaPor: null,
        },
      ],
    });
    montar();
    const faixa = await screen.findByRole("list", {
      name: "Resumo do colaborador",
    });
    await waitFor(() =>
      expect(faixa).toHaveTextContent(
        "Carga horária e escala44h semanais · 6x1",
      ),
    );
    expect(consultarEscalas).toHaveBeenCalledWith(ID);
  });

  it("sem escala na ficha (ou sem acesso a ela), fica a do contrato", async () => {
    vi.mocked(consultarEscalas).mockRejectedValue(new Error("403"));
    montar();
    const faixa = await screen.findByRole("list", {
      name: "Resumo do colaborador",
    });
    await waitFor(() =>
      expect(faixa).toHaveTextContent(
        "Carga horária e escala44h semanais · 5x2",
      ),
    );
  });
});
