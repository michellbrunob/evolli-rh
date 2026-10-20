/**
 * Nova admissão (T176) — a página própria da admissão.
 *
 * Prende o que a decisão do `DP-FLX-21` e o contrato da T167 exigem: página
 * fora de modal, empresa só para leitura, só os campos que o contrato já
 * aceita, erro ancorado no campo com foco no primeiro, dados preservados na
 * falha, descarte confirmado e confirmação com o que o SERVIDOR gravou.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NovaAdmissaoScreen } from "./NovaAdmissaoScreen";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  admitirColaborador,
} from "../../api/colaboradoresClient";
import {
  type DepartamentoApi,
  type EmpresaApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { listarCargos } from "../../api/cargoClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const empresa: EmpresaApi = {
  id: "44444444-4444-4444-4444-444444444444",
  codigo: "EMP1",
  nome: "Empresa Sintética (teste)",
  status: "ativo",
};

const departamento: DepartamentoApi = {
  id: "55555555-5555-5555-5555-555555555555",
  codigo: "DEP1",
  nome: "Departamento Sintético (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

/** Resposta do servidor: a matrícula GRAVADA difere da digitada de propósito. */
const resposta: AdmissaoRegistradaApi = {
  id: "11111111-1111-4111-8111-111111111111",
  nome: "Pessoa Sintética Nova",
  situacao: "inativo",
  criadoEm: "2026-10-20T12:00:00.000Z",
  atualizadoEm: "2026-10-20T12:00:00.000Z",
  vinculo: {
    id: "abababab-abab-4bab-8bab-abababababab",
    empresaId: empresa.id,
    matricula: "MAT-SRV1",
    tipo: "clt",
    situacao: "previsto",
    dataAdmissao: "2026-11-03T00:00:00.000Z",
  },
  movimentacao: {
    id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
    tipo: "admissao",
    status: "programada",
    vigenciaInicio: "2026-11-03T00:00:00.000Z",
    destino: {
      unidadeOrganizacionalId: null,
      departamentoId: departamento.id,
      areaId: null,
      equipeId: null,
      cargoId: null,
      centroCustoId: null,
    },
  },
};

function recusa(status: number): ApiError {
  const erro = new ApiError(status, "recusado");
  Object.assign(erro, { status, message: "recusado" });
  return erro;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([empresa]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([]));
  vi.mocked(admitirColaborador).mockResolvedValue(resposta);
});

function montar() {
  const onSair = vi.fn();
  const onAbrirAdmitido = vi.fn();
  render(
    <NovaAdmissaoScreen onSair={onSair} onAbrirAdmitido={onAbrirAdmitido} />,
  );
  return { onSair, onAbrirAdmitido };
}

async function aguardarEmpresa() {
  await screen.findByText("Empresa Sintética (teste)");
}

const nome = () => screen.getByLabelText(/Nome completo/);
const matricula = () => screen.getByLabelText(/^Matrícula/);
const tipo = () => screen.getByLabelText(/Tipo de vínculo/);
const data = () => screen.getByLabelText(/Data de admissão/);
const tipoDestino = () =>
  screen.getByLabelText(/Tipo de referência organizacional/);
const destino = () =>
  screen.getByLabelText(/Registro da referência organizacional/);
const admitir = () =>
  screen.getByRole("button", { name: "Admitir colaborador" });

function preencherValido() {
  fireEvent.change(nome(), { target: { value: "  Pessoa Sintética Nova " } });
  fireEvent.change(matricula(), { target: { value: "mat-0900" } });
  fireEvent.change(tipo(), { target: { value: "clt" } });
  fireEvent.change(data(), { target: { value: "2026-11-03" } });
  fireEvent.change(tipoDestino(), { target: { value: "departamento" } });
  fireEvent.change(destino(), { target: { value: departamento.id } });
}

describe("Nova admissão — página própria", () => {
  it("é página com h1 próprio, e o formulário não está em modal", async () => {
    montar();
    await aguardarEmpresa();
    expect(
      screen.getByRole("heading", { level: 1, name: "Nova admissão" }),
    ).toBeInTheDocument();
    const form = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    expect(form.closest("[role='dialog']")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra a empresa ativa só para leitura, sem controle para trocá-la", async () => {
    montar();
    await aguardarEmpresa();
    const empresaBloco = document.getElementById("nova-admissao-empresa")!;
    expect(empresaBloco).toHaveTextContent("Empresa Sintética (teste) (EMP1)");
    expect(empresaBloco).toHaveTextContent(/Não é editável aqui/);
    expect(
      screen.queryByRole("combobox", { name: /Empresa/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Empresa/ }),
    ).not.toBeInTheDocument();
    expect(within(empresaBloco).queryByRole("textbox")).toBeNull();
    expect(within(empresaBloco).queryByRole("combobox")).toBeNull();
  });

  it("pede só os campos do contrato atual, e nenhum dado pessoal novo", async () => {
    montar();
    await aguardarEmpresa();
    for (const campo of [nome, matricula, tipo, data, tipoDestino]) {
      expect(campo()).toHaveAttribute("aria-required", "true");
    }
    const form = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    const rotulos = [...form.querySelectorAll("label")].map(
      (l) => l.textContent ?? "",
    );
    for (const proibido of [
      /CPF/i,
      /nascimento/i,
      /endereço/i,
      /banc/i,
      /dependente/i,
      /saúde/i,
      /sindic/i,
      /documento/i,
    ]) {
      expect(rotulos.some((r) => proibido.test(r))).toBe(false);
    }
  });

  it("envio vazio: erros ancorados nos campos, foco no primeiro, nada enviado", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(admitir());
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(nome()).toHaveAttribute("aria-invalid", "true");
    expect(nome()).toHaveAccessibleDescription(/Nome é obrigatório/);
    expect(matricula()).toHaveAccessibleDescription(
      /Use apenas letras maiúsculas/,
    );
    expect(tipo()).toHaveAccessibleDescription(/Selecione o tipo de vínculo/);
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(tipoDestino()).toHaveAccessibleDescription(
      /Escolha o tipo de referência/,
    );
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("o foco vai ao primeiro campo com erro na ordem visual", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(admitir());
    await waitFor(() => expect(matricula()).toHaveFocus());
  });

  it("corrigir um campo limpa só o erro dele", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(admitir());
    await waitFor(() => expect(nome()).toHaveFocus());
    fireEvent.change(nome(), { target: { value: "Pessoa" } });
    expect(nome()).not.toHaveAttribute("aria-invalid");
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
  });

  it("envia exatamente o contrato atual: empresa da sessão, matrícula normalizada", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(admitirColaborador).toHaveBeenCalledWith({
      nome: "Pessoa Sintética Nova",
      empresaId: empresa.id,
      matricula: "MAT-0900",
      tipo: "clt",
      dataAdmissao: "2026-11-03",
      motivoCodigo: "admissao_inicial",
      departamentoId: departamento.id,
    });
  });

  it("área exige o departamento e envia os dois", async () => {
    vi.mocked(listarAreas).mockResolvedValue(
      paginado([
        {
          id: "66666666-6666-6666-6666-666666666666",
          departamentoId: departamento.id,
          codigo: "ARE1",
          nome: "Área Sintética (teste)",
          status: "ativo",
          criadoEm: "2025-01-01T12:00:00.000Z",
          atualizadoEm: "2025-01-01T12:00:00.000Z",
        },
      ]),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(tipoDestino(), { target: { value: "area" } });
    fireEvent.click(admitir());
    const depArea = await screen.findByLabelText(/Departamento da área/);
    await waitFor(() => expect(depArea).toHaveFocus());
    expect(depArea).toHaveAccessibleDescription(
      /Selecione o departamento da área/,
    );
    fireEvent.change(depArea, { target: { value: departamento.id } });
    await screen.findByRole("option", { name: /Área Sintética/ });
    fireEvent.change(destino(), {
      target: { value: "66666666-6666-6666-6666-666666666666" },
    });
    fireEvent.click(admitir());
    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith(
        expect.objectContaining({
          areaId: "66666666-6666-6666-6666-666666666666",
          departamentoId: departamento.id,
        }),
      ),
    );
  });

  it("um clique duplo envia uma vez só", async () => {
    let resolver: (r: AdmissaoRegistradaApi) => void = () => undefined;
    vi.mocked(admitirColaborador).mockReturnValue(
      new Promise((r) => {
        resolver = r;
      }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    const botao = admitir();
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
    resolver(resposta);
    await screen.findByText("Admissão registrada");
  });
});

describe("Nova admissão — recusa do servidor preserva os dados", () => {
  it("409: matrícula em uso, no campo, com foco e dados intactos", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(409));
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await waitFor(() => expect(matricula()).toHaveFocus());
    expect(matricula()).toHaveAccessibleDescription(
      /já está em uso nesta empresa/,
    );
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(tipo()).toHaveValue("clt");
    expect(data()).toHaveValue("2026-11-03");
    expect(destino()).toHaveValue(departamento.id);
    expect(admitir()).toBeEnabled();
  });

  it("422: a referência organizacional é apontada no campo dela", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(422));
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await waitFor(() => expect(destino()).toHaveFocus());
    expect(destino()).toHaveAccessibleDescription(/não foi aceita/);
  });

  it.each([
    [404, /A empresa ativa mudou/],
    [403, /não tem permissão para admitir/],
    [401, /Seu acesso expirou/],
    [500, /Os dados digitados foram mantidos/],
  ])(
    "%i: mensagem geral, com foco nela e dados intactos",
    async (status, texto) => {
      vi.mocked(admitirColaborador).mockRejectedValue(recusa(status));
      montar();
      await aguardarEmpresa();
      preencherValido();
      fireEvent.click(admitir());
      const alerta = await screen.findByText(texto);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(matricula()).toHaveValue("MAT-0900");
    },
  );

  it("depois da falha, corrigir e reenviar funciona", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(recusa(409))
      .mockResolvedValueOnce(resposta);
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await waitFor(() => expect(matricula()).toHaveFocus());
    fireEvent.change(matricula(), { target: { value: "MAT-0901" } });
    fireEvent.click(admitir());
    await screen.findByText("Admissão registrada");
    expect(admitirColaborador).toHaveBeenCalledTimes(2);
  });
});

describe("Nova admissão — empresa indefinida não envia", () => {
  it.each([[[]], [[empresa, { ...empresa, id: "outra", codigo: "EMP2" }]]])(
    "sem exatamente uma empresa na sessão, avisa e não envia",
    async (empresas) => {
      vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado(empresas));
      montar();
      expect(
        await screen.findByText(/Não foi possível confirmar a empresa ativa/),
      ).toBeInTheDocument();
      preencherValido();
      fireEvent.click(admitir());
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );
});

describe("Nova admissão — cancelar", () => {
  it("sem nada digitado, sai direto", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onSair).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com dados, pede confirmação; continuar mantém tudo", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const confirmacao = screen.getByRole("dialog", {
      name: "Descartar esta admissão?",
    });
    fireEvent.click(
      within(confirmacao).getByRole("button", {
        name: "Continuar preenchendo",
      }),
    );
    expect(onSair).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nome()).toHaveValue("Pessoa Sintética");
  });

  it("com dados, descartar sai sem enviar nada", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(matricula(), { target: { value: "MAT-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar e sair" }));
    expect(onSair).toHaveBeenCalledTimes(1);
    expect(admitirColaborador).not.toHaveBeenCalled();
  });
});

describe("Nova admissão — sucesso", () => {
  async function admitirComSucesso() {
    const handlers = montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await screen.findByText("Admissão registrada");
    return handlers;
  }

  it("confirma com o que o SERVIDOR gravou, e leva o foco à confirmação", async () => {
    await admitirComSucesso();
    const titulo = screen.getByRole("heading", {
      name: "Admissão de Pessoa Sintética Nova registrada",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    // Matrícula gravada, não a digitada.
    expect(screen.getByText("MAT-SRV1")).toBeInTheDocument();
    expect(screen.queryByText("MAT-0900")).not.toBeInTheDocument();
    expect(screen.getByText("CLT")).toBeInTheDocument();
    expect(screen.getByText("Previsto")).toBeInTheDocument();
    expect(screen.getByText("03/11/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Programada para a data de admissão"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Departamento: DEP1 — Departamento Sintético (teste)"),
    ).toBeInTheDocument();
    expectSemIsoVisivel(document.body);
  });

  it("abre a ficha do admitido com os dados da resposta", async () => {
    const { onAbrirAdmitido } = await admitirComSucesso();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Abrir ficha de Pessoa Sintética Nova",
      }),
    );
    expect(onAbrirAdmitido).toHaveBeenCalledWith(
      {
        id: resposta.id,
        nome: resposta.nome,
        situacao: resposta.situacao,
        criadoEm: resposta.criadoEm,
        atualizadoEm: resposta.atualizadoEm,
      },
      "ficha",
    );
  });

  it("completar contatos é uma ação separada", async () => {
    const { onAbrirAdmitido } = await admitirComSucesso();
    fireEvent.click(screen.getByRole("button", { name: "Completar contatos" }));
    expect(onAbrirAdmitido).toHaveBeenCalledWith(
      expect.objectContaining({ id: resposta.id }),
      "contatos",
    );
  });

  it("registrar outra admissão volta ao formulário vazio", async () => {
    await admitirComSucesso();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar outra admissão" }),
    );
    expect(nome()).toHaveValue("");
    expect(matricula()).toHaveValue("");
  });
});
