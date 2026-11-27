/**
 * T215 — página "Editar colaborador": cabeçalho (voltar, foto, nome, Status e
 * lixeira), menu lateral com as 8 seções, a seção atual e o rodapé fixo com
 * "Descartar" e "Salvar alterações". Textos iguais aos da referência.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditarColaboradorScreen } from "./EditarColaboradorScreen";
import {
  ApiError,
  buscarColaborador,
  listarColaboradores,
  listarDocumentosDoColaborador,
  listarVinculosDoColaborador,
  retificarColaborador,
  consultarCpfEmUso,
  type DocumentoColaboradorApi,
} from "../../../api/colaboradoresClient";
import {
  consultarContratoDoColaborador,
  desativarColaborador,
  reativarColaborador,
  registrarContratoDoColaborador,
} from "../../../api/edicaoColaboradorClient";
import { listarAlocacoesVinculo } from "../../../api/vinculoContratualClient";
import { buscarCargo } from "../../../api/cargoClient";
import {
  buscarDepartamento,
  listarAreas,
  listarCentrosCusto,
  listarUnidades,
} from "../../../api/organizacaoClient";
import {
  consultarDadosPessoaisDoColaborador,
  registrarDadosPessoaisDoColaborador,
} from "../../../api/dadosPessoaisClient";
import {
  consultarContatosDoColaborador,
  registrarContatosDoColaborador,
} from "../../../api/contatosColaboradorClient";

vi.mock("../../../api/colaboradoresClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/colaboradoresClient")
  >("../../../api/colaboradoresClient");
  return {
    ...actual,
    buscarColaborador: vi.fn(),
    consultarCpfEmUso: vi.fn(),
    listarColaboradores: vi.fn(),
    listarDocumentosDoColaborador: vi.fn(),
    listarVinculosDoColaborador: vi.fn(),
    retificarColaborador: vi.fn(),
  };
});
vi.mock("../../../api/edicaoColaboradorClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/edicaoColaboradorClient")
  >("../../../api/edicaoColaboradorClient");
  return {
    ...actual,
    consultarContratoDoColaborador: vi.fn(),
    registrarContratoDoColaborador: vi.fn(),
    desativarColaborador: vi.fn(),
    reativarColaborador: vi.fn(),
  };
});
vi.mock("../../../api/vinculoContratualClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/vinculoContratualClient")
  >("../../../api/vinculoContratualClient");
  return { ...actual, listarAlocacoesVinculo: vi.fn() };
});
vi.mock("../../../api/cargoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/cargoClient")
  >("../../../api/cargoClient");
  return { ...actual, buscarCargo: vi.fn() };
});
vi.mock("../../../api/organizacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/organizacaoClient")
  >("../../../api/organizacaoClient");
  return {
    ...actual,
    buscarDepartamento: vi.fn(),
    listarAreas: vi.fn(),
    listarCentrosCusto: vi.fn(),
    listarUnidades: vi.fn(),
  };
});
vi.mock("../../../api/dadosPessoaisClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/dadosPessoaisClient")
  >("../../../api/dadosPessoaisClient");
  return {
    ...actual,
    consultarDadosPessoaisDoColaborador: vi.fn(),
    registrarDadosPessoaisDoColaborador: vi.fn(),
  };
});
// T215 — a seção Dependentes lê do servidor: sem ninguém cadastrado.
vi.mock("../../../api/beneficiosClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/beneficiosClient")
  >("../../../api/beneficiosClient");
  return {
    ...actual,
    listarDependentes: vi.fn(async () => ({ dependentes: [] })),
  };
});
vi.mock("../../../api/contatosColaboradorClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../../api/contatosColaboradorClient")
  >("../../../api/contatosColaboradorClient");
  return {
    ...actual,
    consultarContatosDoColaborador: vi.fn(),
    registrarContatosDoColaborador: vi.fn(),
  };
});

const ID = "8f0c2a4e-1b2c-4d3e-8f4a-5b6c7d8e9f01";
const EMPRESA = "0d9f8e7c-6b5a-4f3e-8d2c-1b0a9f8e7d6c";
// CPF sintético com dígitos verificadores válidos.
const CPF = "52998224725";

const PERFIL = {
  dataNascimento: "1990-05-10",
  cpf: CPF,
  rg: "12.345.678-9",
  genero: "masculino",
  contatoEmergenciaNome: "Ana Teste",
  contatoEmergenciaTelefone: "+5511987654321",
  sexo: null,
  saudacao: null,
  estadoCivil: "Solteiro(a)",
  nacionalidade: "Brasileira",
  naturalidade: null,
  escolaridade: null,
  curso: null,
  nomePai: null,
  nomeMae: null,
  atualizadoEm: "2026-11-16T15:00:00.000Z",
};
const ENDERECO = {
  pais: "Brasil",
  cep: "01001000",
  logradouro: "Praça da Sé, 100",
  numero: null,
  complemento: null,
  bairro: "Sé",
  cidade: "São Paulo",
  estado: "SP",
  atualizadoEm: "2026-11-10T15:00:00.000Z",
};

const GESTORA = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a99";
const CARGO = "c1c1c1c1-1111-4111-8111-111111111111";
const DEPTO = "d2d2d2d2-2222-4222-8222-222222222222";
const AREA = "a3a3a3a3-3333-4333-8333-333333333333";
const CENTRO = "e4e4e4e4-4444-4444-8444-444444444444";
const UNIDADE = "f5f5f5f5-5555-4555-8555-555555555555";

const CONTRATO = {
  nivel: "pleno",
  gestorDiretoId: GESTORA,
  jornadaSemanalHoras: 44,
  escala: "5x2",
  salarioBruto: "5000.00",
  conselhoProfissional: "crc",
  registroProfissional: "123456/SP",
  dependentesIrrf: 1,
  pensaoAlimenticiaPercentual: null as string | null,
};

function respostaDoContrato(
  contrato = CONTRATO,
  matricula: string | null = "0042",
) {
  return {
    colaboradorId: ID,
    empresaId: EMPRESA,
    vinculo: {
      id: "v-1",
      matricula,
      tipo: "clt" as const,
      situacao: "ativo" as const,
      dataAdmissao: "2026-01-05",
      dataDesligamento: null,
    },
    contrato,
    atualizadoEm: "2026-11-05T12:00:00.000Z",
  };
}

function prepararServidor() {
  vi.mocked(listarDocumentosDoColaborador).mockResolvedValue([]);
  vi.mocked(desativarColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    desativado: true,
    desativadoEm: "2026-11-23T18:00:00.000Z",
  });
  vi.mocked(reativarColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    desativado: false,
    desativadoEm: null,
  });
  vi.mocked(consultarContratoDoColaborador).mockResolvedValue(
    respostaDoContrato(),
  );
  vi.mocked(registrarContratoDoColaborador).mockImplementation(
    async (_id, dto) => {
      const { matricula, ...contrato } = dto;
      return {
        ...respostaDoContrato(
          { ...CONTRATO, ...contrato } as typeof CONTRATO,
          matricula === undefined ? "0042" : matricula,
        ),
        atualizadoEm: "2026-11-23T12:00:00.000Z",
      };
    },
  );
  vi.mocked(listarAlocacoesVinculo).mockResolvedValue([
    {
      id: "al-1",
      vinculoId: "v-1",
      empresaId: EMPRESA,
      unidadeOrganizacionalId: UNIDADE,
      departamentoId: DEPTO,
      areaId: AREA,
      equipeId: null,
      cargoId: CARGO,
      centroCustoId: CENTRO,
      vigenteDe: "2026-01-05",
      vigenteAte: null,
      movimentacaoOrigemId: "m-1",
      criadoEm: "2026-01-05T12:00:00.000Z",
    },
  ]);
  vi.mocked(buscarCargo).mockResolvedValue({
    id: CARGO,
    nome: "Analista de RH",
  } as never);
  vi.mocked(buscarDepartamento).mockResolvedValue({
    id: DEPTO,
    nome: "Pessoas",
  } as never);
  vi.mocked(listarAreas).mockResolvedValue({
    itens: [{ id: AREA, nome: "Departamento Pessoal", status: "ativo" }],
  } as never);
  vi.mocked(listarCentrosCusto).mockResolvedValue({
    itens: [{ id: CENTRO, nome: "Administrativo", status: "ativo" }],
  } as never);
  vi.mocked(listarUnidades).mockResolvedValue({
    itens: [{ id: UNIDADE, nome: "Matriz", status: "ativo" }],
  } as never);
  vi.mocked(listarColaboradores).mockResolvedValue({
    itens: [
      { id: GESTORA, nome: "Gestora Teste", vinculos: [] },
      { id: ID, nome: "Pedro Teste", vinculos: [] },
    ],
    pagina: 1,
    tamanhoPagina: 100,
    total: 2,
  } as never);
  vi.mocked(buscarColaborador).mockResolvedValue({
    id: ID,
    nome: "Pedro Teste",
    situacao: "ativo",
    criadoEm: "2026-11-01T12:00:00.000Z",
    atualizadoEm: "2026-11-12T12:00:00.000Z",
    foto: null,
  });
  vi.mocked(listarVinculosDoColaborador).mockResolvedValue([
    {
      id: "v-1",
      colaboradorId: ID,
      empresaId: EMPRESA,
      matricula: "0042",
      tipo: "clt",
      situacao: "ativo",
      dataAdmissao: "2026-01-05",
      dataDesligamento: null,
      criadoEm: "2026-01-05T12:00:00.000Z",
      atualizadoEm: "2026-01-05T12:00:00.000Z",
    },
  ]);
  vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    situacao: "registrado",
    perfilPessoal: PERFIL,
    endereco: ENDERECO,
  });
  vi.mocked(consultarContatosDoColaborador).mockResolvedValue({
    colaboradorId: ID,
    empresaId: EMPRESA,
    situacao: "registrado",
    contatos: {
      emailPessoal: "pedro.teste@example.test",
      celular: "+5511912345678",
      telefone: null,
      atualizadoEm: "2026-11-02T12:00:00.000Z",
    },
  });
  vi.mocked(retificarColaborador).mockImplementation(async (_id, dto) => ({
    id: ID,
    nome: dto.nome,
    situacao: "ativo",
    criadoEm: "2026-11-01T12:00:00.000Z",
    atualizadoEm: "2026-11-23T12:00:00.000Z",
  }));
  vi.mocked(registrarDadosPessoaisDoColaborador).mockImplementation(
    async (_id, dto) => ({
      colaboradorId: ID,
      empresaId: EMPRESA,
      situacao: "registrado",
      perfilPessoal: dto.perfilPessoal
        ? {
            ...PERFIL,
            ...dto.perfilPessoal,
            atualizadoEm: "2026-11-23T12:00:00.000Z",
          }
        : PERFIL,
      endereco: dto.endereco
        ? {
            ...ENDERECO,
            ...dto.endereco,
            atualizadoEm: "2026-11-23T12:00:00.000Z",
          }
        : ENDERECO,
    }),
  );
  vi.mocked(registrarContatosDoColaborador).mockImplementation(
    async (_id, dto) => ({
      colaboradorId: ID,
      empresaId: EMPRESA,
      situacao: "registrado",
      resultado: "atualizado",
      contatos: {
        emailPessoal: dto.emailPessoal ?? null,
        celular: dto.celular ?? null,
        telefone: null,
        atualizadoEm: "2026-11-23T12:00:00.000Z",
      },
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prepararServidor();
});
afterEach(() => {
  vi.clearAllMocks();
});

function montar(
  secao: Parameters<
    typeof EditarColaboradorScreen
  >[0]["secao"] = "dados-basicos",
) {
  const onTrocarSecao = vi.fn();
  const onVoltar = vi.fn();
  const utils = render(
    <EditarColaboradorScreen
      colaboradorId={ID}
      secao={secao}
      onTrocarSecao={onTrocarSecao}
      onVoltar={onVoltar}
    />,
  );
  return { ...utils, onTrocarSecao, onVoltar };
}

const rodape = () => screen.getByRole("region", { name: "Ações da edição" });
const campo = (nome: string | RegExp) => screen.getByLabelText(nome);

/** Lista de escolha própria: abre e escolhe a opção pelo nome. */
function escolher(nome: string, opcao: string) {
  fireEvent.click(campo(nome));
  fireEvent.click(screen.getByRole("option", { name: opcao }));
}

describe("T215 — Editar colaborador: moldura", () => {
  it("cabeçalho com título, nome, Status e lixeira; menu com as 8 seções", async () => {
    const { onVoltar } = montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Editar colaborador" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Pedro Teste")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Status: Ativo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar colaborador" }),
    ).toBeInTheDocument();

    const menu = screen.getByRole("navigation", {
      name: "Seções do colaborador",
    });
    const itens = within(menu).getAllByRole("link");
    expect(itens.map((i) => i.textContent)).toEqual([
      "Dados básicos",
      "Dados profissionais",
      "Endereço",
      "Dependentes",
      "Documentos",
      "Dados bancários",
      "Formação acadêmica",
      "Campos extras",
    ]);
    expect(itens[0]).toHaveAttribute("aria-current", "page");
    expect(itens[2]).toHaveAttribute(
      "href",
      `#/pessoas/colaboradores/${ID}/editar/endereco`,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it("trocar de seção pede a seção ao shell e mantém o que foi digitado", async () => {
    const { onTrocarSecao, rerender } = montar();
    const nome = await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(nome, { target: { value: "Pedro Teste Silva" } });
    fireEvent.click(screen.getByRole("link", { name: "Endereço" }));
    expect(onTrocarSecao).toHaveBeenCalledWith("endereco");
    rerender(
      <EditarColaboradorScreen
        colaboradorId={ID}
        secao="endereco"
        onTrocarSecao={onTrocarSecao}
        onVoltar={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Endereço" }),
    ).toBeInTheDocument();
    expect(
      within(rodape()).getByText("Você tem alterações não salvas"),
    ).toBeInTheDocument();
  });

  it("rodapé: última alteração sem mudanças; Descartar volta ao gravado", async () => {
    montar();
    const nome = await screen.findByDisplayValue("Pedro Teste");
    expect(
      within(rodape()).getByText("Última alteração em 16/11/2026"),
    ).toBeInTheDocument();
    fireEvent.change(nome, { target: { value: "Outro Nome" } });
    expect(
      within(rodape()).getByText("Você tem alterações não salvas"),
    ).toBeInTheDocument();
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Descartar" }),
    );
    expect(campo("Nome completo")).toHaveValue("Pedro Teste");
    expect(
      within(rodape()).getByText("Última alteração em 16/11/2026"),
    ).toBeInTheDocument();
  });
});

describe("T215 — Editar colaborador: como a referência (2026-11-26)", () => {
  it("Descartar e Salvar só se acendem com alguma alteração", async () => {
    montar();
    const nome = await screen.findByDisplayValue("Pedro Teste");
    const salvar = within(rodape()).getByRole("button", {
      name: "Salvar alterações",
    });
    const descartar = within(rodape()).getByRole("button", {
      name: "Descartar",
    });
    expect(salvar).toBeDisabled();
    expect(descartar).toBeDisabled();
    fireEvent.change(nome, { target: { value: "Outro Nome" } });
    expect(salvar).toBeEnabled();
    expect(descartar).toBeEnabled();
    fireEvent.click(descartar);
    expect(salvar).toBeDisabled();
    expect(descartar).toBeDisabled();
  });

  it("cabeçalho da seção: a descrição logo abaixo do título", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    const titulo = screen.getByRole("heading", {
      level: 2,
      name: "Dados básicos",
    });
    expect(titulo.parentElement).toHaveClass("cadastro-etapas__etapa-textos");
    expect(titulo.nextElementSibling).toHaveTextContent(
      "Informações pessoais e de contato de Pedro.",
    );
  });

  it("R$ e % ficam dentro do campo", async () => {
    montar("dados-profissionais");
    await screen.findByDisplayValue("5.000,00");
    for (const nome of ["Salário bruto", "Salário líquido"]) {
      const caixa = campo(nome).parentElement!;
      expect(caixa, nome).toHaveClass("cadastro-etapas__com-prefixo");
      expect(caixa.firstElementChild, nome).toHaveTextContent("R$");
    }
    const pensao = campo("Pensão alimentícia").parentElement!;
    expect(pensao).toHaveClass("cadastro-etapas__com-sufixo");
    expect(pensao.lastElementChild).toHaveTextContent("%");
  });

  it("Endereço: CEP curto e o exemplo do complemento", async () => {
    montar("endereco");
    await screen.findByDisplayValue("Sé");
    expect(campo("CEP").closest(".editar-colaborador__cep")).not.toBeNull();
    expect(campo("Complemento")).toHaveAttribute(
      "placeholder",
      "Apto, bloco, sala…",
    );
  });

  it("ponto em Documentos enquanto faltar documento obrigatório", async () => {
    const enviado = (
      categoria: DocumentoColaboradorApi["categoria"],
    ): DocumentoColaboradorApi => ({
      id: `d-${categoria}`,
      categoria,
      nome: null,
      estado: "aprovado",
      formato: "pdf",
      tamanhoBytes: 1024,
      versao: 1,
      enviadoEm: "2026-11-19T12:00:00.000Z",
      verificadoEm: "2026-11-19T12:00:01.000Z",
    });
    vi.mocked(listarDocumentosDoColaborador).mockResolvedValueOnce([
      enviado("rg"),
    ]);
    const { unmount } = montar();
    await screen.findByDisplayValue("Pedro Teste");
    const documentos = () => screen.getByRole("link", { name: "Documentos" });
    await waitFor(() =>
      expect(documentos()).toHaveAccessibleDescription(
        "Documentos obrigatórios pendentes",
      ),
    );
    expect(
      documentos().querySelector(".editar-colaborador__pendencia"),
    ).not.toBeNull();
    unmount();

    vi.mocked(listarDocumentosDoColaborador).mockResolvedValueOnce(
      (
        [
          "rg",
          "cpf",
          "comprovante_endereco",
          "carteira_trabalho",
          "certidoes",
        ] as const
      ).map(enviado),
    );
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    await waitFor(() =>
      expect(listarDocumentosDoColaborador).toHaveBeenCalledTimes(2),
    );
    expect(documentos()).not.toHaveAccessibleDescription(
      "Documentos obrigatórios pendentes",
    );
    expect(
      documentos().querySelector(".editar-colaborador__pendencia"),
    ).toBeNull();
  });
});

describe("T215 — Editar colaborador: Dados básicos", () => {
  it("textos e campos da referência, preenchidos com o gravado", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    expect(
      screen.getByRole("heading", { level: 2, name: "Dados básicos" }),
    ).toBeInTheDocument();
    for (const texto of [
      "Informações pessoais e de contato de Pedro.",
      "Identificação",
      "Aparecem no perfil, nos documentos e no eSocial.",
      "Aparece na lista de colaboradores e no perfil.",
      "PNG ou JPG, até 5 MB.",
      "Como está nos documentos oficiais.",
      "Usados na folha e no eSocial.",
      "Contato",
      "Canais pessoais para falar com a pessoa.",
      "Diferente do e-mail corporativo.",
      "Com DDD.",
      "Contato de emergência",
      "Acionado apenas em situações de urgência.",
    ]) {
      expect(screen.getByText(texto), texto).toBeInTheDocument();
    }
    expect(campo("CPF")).toHaveValue("529.982.247-25");
    expect(campo("RG")).toHaveValue("12.345.678-9");
    expect(campo("Data de nascimento")).toHaveValue("1990-05-10");
    expect(campo("Gênero")).toHaveTextContent("Masculino");
    expect(campo("Estado civil")).toHaveTextContent("Solteiro(a)");
    expect(campo("E-mail pessoal")).toHaveValue("pedro.teste@example.test");
    expect(campo("Telefone pessoal")).toHaveValue("(11) 91234-5678");
    expect(campo("Nome do contato")).toHaveValue("Ana Teste");
    expect(campo("Telefone do contato")).toHaveValue("(11) 98765-4321");
    expect(
      screen.getByRole("button", { name: "Enviar foto" }),
    ).toBeInTheDocument();
  });

  it("salvar envia só os blocos alterados, preservando o restante do perfil", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("Nome completo"), {
      target: { value: "Pedro Teste Silva" },
    });
    escolher("Estado civil", "Casado(a)");
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(retificarColaborador).toHaveBeenCalledWith(ID, {
        nome: "Pedro Teste Silva",
      }),
    );
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalledTimes(1),
    );
    const [, dto] = vi.mocked(registrarDadosPessoaisDoColaborador).mock
      .calls[0]!;
    expect(dto.endereco).toBeUndefined();
    expect(dto.perfilPessoal).toMatchObject({
      estadoCivil: "Casado(a)",
      cpf: CPF,
      nacionalidade: "Brasileira",
      contatoEmergenciaTelefone: "+5511987654321",
    });
    expect(dto.perfilPessoal).not.toHaveProperty("sexo");
    expect(registrarContatosDoColaborador).not.toHaveBeenCalled();
    expect(
      await within(rodape()).findByText("Última alteração em 23/11/2026"),
    ).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Alterações salvas.",
    );
  });

  it("telefone pessoal vai aos contatos, no formato do servidor", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("Telefone pessoal"), {
      target: { value: "(21) 99876-5432" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(registrarContatosDoColaborador).toHaveBeenCalledWith(ID, {
        emailPessoal: "pedro.teste@example.test",
        celular: "+5521998765432",
      }),
    );
    expect(retificarColaborador).not.toHaveBeenCalled();
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });

  it("validação ao salvar: mensagem embaixo do campo, foco nele e nada enviado", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("Nome completo"), { target: { value: "Pe" } });
    fireEvent.change(campo("CPF"), { target: { value: "111.111.111-11" } });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText("Informe o nome completo (pelo menos 3 letras)."),
    ).toBeInTheDocument();
    expect(screen.getByText("Informe um CPF válido.")).toBeInTheDocument();
    expect(campo("Nome completo")).toHaveFocus();
    expect(campo("Nome completo")).toHaveAttribute("aria-invalid", "true");
    expect(retificarColaborador).not.toHaveBeenCalled();
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });
});

describe("T215 — Editar colaborador: revisão (telefone antigo, recusas, CPF, nascimento)", () => {
  it("celular antigo, fora do formato, não impede salvar o e-mail e não é enviado", async () => {
    vi.mocked(consultarContatosDoColaborador).mockResolvedValue({
      colaboradorId: ID,
      empresaId: EMPRESA,
      situacao: "registrado",
      contatos: {
        emailPessoal: "pedro.teste@example.test",
        celular: "33334444",
        telefone: null,
        atualizadoEm: "2026-11-02T12:00:00.000Z",
      },
    });
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("E-mail pessoal"), {
      target: { value: "pedro.novo@example.test" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(registrarContatosDoColaborador).toHaveBeenCalledWith(ID, {
        emailPessoal: "pedro.novo@example.test",
      }),
    );
  });

  it("e-mail já usado na empresa: a recusa do servidor aparece no campo", async () => {
    vi.mocked(registrarContatosDoColaborador).mockRejectedValueOnce(
      new ApiError(422, "x", {
        erros: [{ campo: "emailPessoal", motivo: "em_uso" }],
      }),
    );
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("E-mail pessoal"), {
      target: { value: "outra.pessoa@example.test" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText(
        "Este e-mail já é usado por outra pessoa desta empresa.",
      ),
    ).toBeInTheDocument();
    expect(campo("E-mail pessoal")).toHaveAttribute("aria-invalid", "true");
  });

  it("sem CPF gravado (veio da planilha), dá para salvar outro dado sem CPF; nascimento futuro não", async () => {
    vi.mocked(consultarDadosPessoaisDoColaborador).mockResolvedValue({
      colaboradorId: ID,
      empresaId: EMPRESA,
      situacao: "registrado",
      perfilPessoal: { ...PERFIL, cpf: null },
      endereco: ENDERECO,
    });
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    fireEvent.change(campo("RG"), { target: { value: "11.222.333-4" } });
    fireEvent.change(campo("Data de nascimento"), {
      target: { value: "2999-01-01" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText(
        "Informe uma data de nascimento entre 01/01/1900 e hoje.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Informe o CPF.")).toBeNull();
    fireEvent.change(campo("Data de nascimento"), {
      target: { value: "1990-05-10" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalled(),
    );
  });
});

describe("T215 — Editar colaborador: Endereço", () => {
  it("textos da referência; salvar grava o bloco do endereço", async () => {
    montar("endereco");
    await screen.findByText("Pedro Teste");
    expect(
      screen.getByText("Residência usada em correspondências e no eSocial."),
    ).toBeInTheDocument();
    expect(screen.getByText("Endereço residencial")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Preenchemos o restante automaticamente a partir do CEP.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Sé")).toBeInTheDocument();
    fireEvent.change(campo("Complemento"), { target: { value: "Apto 12" } });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(registrarDadosPessoaisDoColaborador).toHaveBeenCalledTimes(1),
    );
    const [, dto] = vi.mocked(registrarDadosPessoaisDoColaborador).mock
      .calls[0]!;
    expect(dto.perfilPessoal).toBeUndefined();
    expect(dto.endereco).toMatchObject({
      complemento: "Apto 12",
      bairro: "Sé",
      cidade: "São Paulo",
      estado: "SP",
    });
  });
});

describe("T215 — Editar colaborador: seções ainda sem cadastro", () => {
  it.each([
    [
      "dependentes",
      "Dependentes",
      "Pessoas vinculadas para IRRF, plano de saúde e benefícios.",
      "Nenhum dependente cadastrado",
    ],
    [
      "dados-bancarios",
      "Dados bancários",
      "Contas usadas para pagamento de salário e reembolsos.",
      "Nenhuma conta cadastrada",
    ],
    [
      "formacao-academica",
      "Formação acadêmica",
      "Grau de instrução, graduação, pós e cursos complementares.",
      "Nenhuma formação cadastrada",
    ],
    [
      "campos-extras",
      "Campos extras",
      "Informações personalizadas pela sua empresa.",
      "Nenhum campo extra criado",
    ],
  ] as const)(
    "%s: título, descrição e estado vazio",
    async (secao, titulo, descricao, vazio) => {
      montar(secao);
      await screen.findByText("Pedro Teste");
      expect(
        screen.getByRole("heading", { level: 2, name: titulo }),
      ).toBeInTheDocument();
      expect(screen.getByText(descricao)).toBeInTheDocument();
      expect(await screen.findByText(vazio)).toBeInTheDocument();
    },
  );
});

describe("T215 — Editar colaborador: Dados profissionais", () => {
  it("textos da referência; lotação vigente, contrato e remuneração gravados", async () => {
    montar("dados-profissionais");
    expect(
      await screen.findByText("Cargo, contrato e remuneração de Pedro."),
    ).toBeInTheDocument();
    for (const texto of [
      "Cargo e estrutura",
      "Onde a pessoa está na organização.",
      "Filial, loja ou local de trabalho.",
      "Recebe as solicitações da pessoa.",
      "Tipo de vínculo, admissão, jornada, escala e matrícula.",
      "Vale só quando não há escala definida na aba Escala da ficha (lá ela manda no quadro e nos benefícios). Sem nenhuma, os benefícios usam os dias úteis do mês.",
      "Remuneração",
      "Valores mensais usados na folha.",
      "Calculado a partir do bruto.",
      "Informações adicionais",
      "Registro profissional e deduções.",
      "Obrigatório para algumas profissões.",
    ]) {
      expect(screen.getByText(texto), texto).toBeInTheDocument();
      // Gestor direto: só pessoas ativas (desligado não vira gestor).
      expect(listarColaboradores).toHaveBeenCalledWith(
        expect.objectContaining({ grupo: "ativos", pagina: 1 }),
      );
    }
    expect(
      await screen.findByDisplayValue("Analista de RH"),
    ).toBeInTheDocument();
    expect(campo("Cargo")).toHaveAttribute("readonly");
    expect(
      await screen.findByDisplayValue("Departamento Pessoal"),
    ).toBeInTheDocument();
    expect(campo("Departamento")).toHaveValue("Pessoas");
    expect(campo("Centro de custo")).toHaveValue("Administrativo");
    expect(campo("Unidade")).toHaveValue("Matriz");
    expect(campo("Nível")).toHaveTextContent("Pleno");
    await waitFor(() =>
      expect(campo("Gestor direto")).toHaveTextContent("Gestora Teste"),
    );
    fireEvent.click(campo("Gestor direto"));
    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).not.toContain("Pedro Teste");
    fireEvent.keyDown(campo("Gestor direto"), { key: "Escape" });
    expect(campo("Tipo de contratação")).toHaveValue("CLT");
    expect(campo("Data de admissão")).toHaveValue("05/01/2026");
    expect(campo("Jornada de trabalho")).toHaveValue("44");
    expect(campo("Escala de trabalho")).toHaveTextContent("5x2");
    expect(campo("Matrícula")).toHaveValue("0042");
    expect(campo("Salário bruto")).toHaveValue("5.000,00");
    expect(campo("Salário líquido")).not.toHaveValue("");
    expect(campo("Conselho")).toHaveTextContent("CRC");
    expect(campo("Número do registro")).toHaveValue("123456/SP");
    expect(campo("Dependentes (IRRF)")).toHaveValue("1");
  });

  it("salário bruto é só leitura, com o atalho para a aba Salários", async () => {
    montar("dados-profissionais");
    await screen.findByDisplayValue("5.000,00");
    expect(campo("Salário bruto")).toHaveAttribute("readonly");
    expect(screen.getByRole("link", { name: "aba Salários" })).toHaveAttribute(
      "href",
      `#/pessoas/colaboradores/${ID}/salarios`,
    );
  });

  it("salário recusado pelo servidor: a mensagem fica embaixo do campo", async () => {
    vi.mocked(registrarContratoDoColaborador).mockRejectedValueOnce(
      new ApiError(422, "Erro na requisição.", {
        erros: [{ campo: "salarioBruto", motivo: "nao_se_aplica" }],
      }),
    );
    montar("dados-profissionais");
    await screen.findByDisplayValue("5.000,00");
    escolher("Nível", "Sênior");
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText(
        "O salário mudou na aba Salários depois que esta página abriu. Recarregue para ver o valor atual.",
      ),
    ).toBeInTheDocument();
    expect(campo("Salário bruto")).toHaveAttribute("aria-invalid", "true");
  });

  it("matrícula fora da regra da API é recusada antes de enviar", async () => {
    montar("dados-profissionais");
    await screen.findByDisplayValue("0042");
    fireEvent.change(campo("Matrícula"), { target: { value: "MAT 42" } });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText(
        "Use de 2 a 32 caracteres: letras sem acento, números, hífen ou sublinhado.",
      ),
    ).toBeInTheDocument();
    expect(registrarContratoDoColaborador).not.toHaveBeenCalled();
  });

  it("salvar grava o bloco inteiro do contrato, com a matrícula (sem o salário)", async () => {
    montar("dados-profissionais");
    await screen.findByDisplayValue("5.000,00");
    escolher("Nível", "Sênior");
    fireEvent.change(campo("Pensão alimentícia"), {
      target: { value: "12,5" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(registrarContratoDoColaborador).toHaveBeenCalledWith(ID, {
        nivel: "senior",
        gestorDiretoId: GESTORA,
        jornadaSemanalHoras: 44,
        escala: "5x2",
        conselhoProfissional: "crc",
        registroProfissional: "123456/SP",
        dependentesIrrf: 1,
        pensaoAlimenticiaPercentual: "12.5",
        matricula: "0042",
      }),
    );
    expect(retificarColaborador).not.toHaveBeenCalled();
    expect(
      await within(rodape()).findByText("Última alteração em 23/11/2026"),
    ).toBeInTheDocument();
  });

  it("matrícula em uso: a mensagem fica embaixo do campo, sem repetir o valor", async () => {
    vi.mocked(registrarContratoDoColaborador).mockRejectedValueOnce(
      new ApiError(409, "Erro na requisição.", {
        erros: [{ campo: "matricula", motivo: "em_uso" }],
      }),
    );
    montar("dados-profissionais");
    await screen.findByDisplayValue("0042");
    fireEvent.change(campo("Matrícula"), { target: { value: "0007" } });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText(
        "Esta matrícula já é usada por outra pessoa da empresa.",
      ),
    ).toBeInTheDocument();
    expect(campo("Matrícula")).toHaveAttribute("aria-invalid", "true");
    expect(
      within(rodape()).getByText("Você tem alterações não salvas"),
    ).toBeInTheDocument();
  });

  it("jornada fora de 1 a 80 horas é recusada antes de enviar", async () => {
    montar("dados-profissionais");
    await screen.findByDisplayValue("0042");
    fireEvent.change(campo("Jornada de trabalho"), {
      target: { value: "90" },
    });
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    expect(
      await screen.findByText("Informe de 1 a 80 horas por semana."),
    ).toBeInTheDocument();
    expect(registrarContratoDoColaborador).not.toHaveBeenCalled();
  });
});

describe("T215 — Editar colaborador: desativar e reativar", () => {
  async function abrirStatus() {
    const botao = await screen.findByRole("button", { name: /^Status: / });
    fireEvent.keyDown(botao, { key: "Enter" });
    return screen.findByRole("menu");
  }

  it("lixeira: pede confirmação; Cancelar não desativa", async () => {
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    await screen.findByRole("button", { name: "Status: Ativo" });
    fireEvent.click(
      screen.getByRole("button", { name: "Desativar colaborador" }),
    );
    const janela = await screen.findByRole("dialog", {
      name: "Desativar Pedro Teste?",
    });
    expect(
      within(janela).getByText(
        "A pessoa sai das listas de ativos. Os dados e o histórico ficam guardados, e dá para reativar depois.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(janela).getByRole("button", { name: "Cancelar" }));
    expect(desativarColaborador).not.toHaveBeenCalled();
  });

  it("confirmar desativa: Status vira Inativo e a lixeira some", async () => {
    montar();
    await screen.findByRole("button", { name: "Status: Ativo" });
    fireEvent.click(
      screen.getByRole("button", { name: "Desativar colaborador" }),
    );
    const janela = await screen.findByRole("dialog");
    fireEvent.click(within(janela).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(desativarColaborador).toHaveBeenCalledWith(ID));
    expect(
      await screen.findByRole("button", { name: "Status: Inativo" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar colaborador" }),
    ).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Colaborador desativado.",
    );
  });

  it("Status Inativo pela lista também pede a confirmação da desativação", async () => {
    montar();
    const menu = await abrirStatus();
    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Inativo" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Desativar Pedro Teste?" }),
    ).toBeInTheDocument();
  });

  it("já desativado: Status Inativo; escolher Ativo pede a reativação", async () => {
    vi.mocked(consultarContratoDoColaborador).mockResolvedValue({
      ...respostaDoContrato(),
      desativado: true,
      desativadoEm: "2026-11-20T12:00:00.000Z",
    });
    montar();
    expect(
      await screen.findByRole("button", { name: "Status: Inativo" }),
    ).toBeInTheDocument();
    const menu = await abrirStatus();
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: "Ativo" }));
    const janela = await screen.findByRole("dialog", {
      name: "Reativar Pedro Teste?",
    });
    fireEvent.click(within(janela).getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(reativarColaborador).toHaveBeenCalledWith(ID));
    expect(
      await screen.findByRole("button", { name: "Status: Ativo" }),
    ).toBeInTheDocument();
  });

  it("Férias, Afastado e Desligado não mudam o status: dizem onde se registram", async () => {
    montar();
    const menu = await abrirStatus();
    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Férias" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Férias e afastamentos são registrados na ficha: Mais ações › Registrar ausência.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(desativarColaborador).not.toHaveBeenCalled();
  });
});

describe("T215 — Editar colaborador: CPF já cadastrado, ao digitar", () => {
  it("o CPF gravado não consulta; outro já usado avisa no campo e não salva", async () => {
    vi.mocked(consultarCpfEmUso).mockResolvedValue(true);
    montar();
    await screen.findByDisplayValue("Pedro Teste");
    await new Promise((r) => setTimeout(r, 600));
    expect(consultarCpfEmUso).not.toHaveBeenCalled();
    fireEvent.change(campo("CPF"), { target: { value: "111.444.777-35" } });
    await waitFor(() =>
      expect(campo("CPF")).toHaveAccessibleDescription(
        "Este CPF já está cadastrado nesta empresa.",
      ),
    );
    expect(consultarCpfEmUso).toHaveBeenCalledWith("11144477735", ID);
    fireEvent.click(
      within(rodape()).getByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() => expect(campo("CPF")).toHaveFocus());
    expect(registrarDadosPessoaisDoColaborador).not.toHaveBeenCalled();
  });
});
