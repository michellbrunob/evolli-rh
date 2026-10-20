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
import { readFileSync } from "node:fs";
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
  perfilPessoal: {
    dataNascimento: "1990-05-20",
    sexo: "Feminino",
    saudacao: null,
    estadoCivil: "Solteira",
    nacionalidade: "Brasileira",
    naturalidade: null,
    escolaridade: null,
    curso: null,
    nomePai: null,
    nomeMae: "Mãe Sintética Servidor",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
  endereco: {
    pais: "Brasil",
    cep: "30140-071",
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: "Cidade Sintética",
    estado: "MG",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
  contatos: {
    emailPessoal: "pessoa.servidor@exemplo.test",
    celular: "+5531999990000",
    telefone: "3133330000",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
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
const dataNascimento = () => screen.getByLabelText(/^Data de nascimento/);
const matricula = () => screen.getByLabelText(/^Matrícula/);
const tipo = () => screen.getByLabelText(/Tipo de vínculo/);
const data = () => screen.getByLabelText(/Data de admissão/);
const tipoDestino = () =>
  screen.getByLabelText(/Tipo de referência organizacional/);
const destino = () =>
  screen.getByLabelText(/Registro da referência organizacional/);
const admitir = () =>
  screen.getByRole("button", { name: "Admitir colaborador" });

const emailPessoal = () => screen.getByLabelText(/E-mail pessoal/);
const celular = () => screen.getByLabelText(/^Celular/);
const telefone = () => screen.getByLabelText(/^Telefone/);
const pais = () => screen.getByLabelText(/^País/);

/** Os três contatos da ficha da T169 — obrigatórios na página. */
function preencherContatos() {
  fireEvent.change(emailPessoal(), {
    target: { value: " Pessoa.Nova@Exemplo.TEST " },
  });
  fireEvent.change(celular(), { target: { value: "+55 (31) 99999-0000" } });
  fireEvent.change(telefone(), { target: { value: "31 3333-0000" } });
}

function preencherValido() {
  preencherContatos();
  fireEvent.change(nome(), { target: { value: "  Pessoa Sintética Nova " } });
  fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
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

  it("pede os campos do Módulo 1, e nenhum campo de módulo futuro", async () => {
    montar();
    await aguardarEmpresa();
    for (const campo of [
      nome,
      dataNascimento,
      emailPessoal,
      celular,
      telefone,
      matricula,
      tipo,
      data,
      tipoDestino,
    ]) {
      expect(campo()).toHaveAttribute("aria-required", "true");
    }
    const form = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    const rotulos = [...form.querySelectorAll("label")].map((l) =>
      (l.textContent ?? "").replace(/\*|obrigatório|opcional/g, "").trim(),
    );
    for (const esperado of [
      "Nome completo",
      "Data de nascimento",
      "Sexo",
      "Saudação",
      "Estado civil",
      "Nacionalidade",
      "Naturalidade",
      "Escolaridade",
      "Curso",
      "Nome do pai",
      "Nome da mãe",
      "País",
      "CEP",
      "Logradouro",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
      "E-mail pessoal",
      "Celular",
      "Telefone",
    ]) {
      expect(rotulos.some((r) => r.startsWith(esperado))).toBe(true);
    }
    for (const proibido of [
      /CPF/i,
      /nome social/i,
      /gênero/i,
      /raça|etnia/i,
      /foto/i,
      /deficiência/i,
      /emergência/i,
      /corporativo/i,
      /banc|agência|conta corrente/i,
      /dependente/i,
      /saúde/i,
      /sindic/i,
      /documento|\bRG\b|CNH|CTPS|\bPIS\b|eleitor|reservista/i,
      /fuso/i,
      /filhos|camisa/i,
    ]) {
      expect(rotulos.filter((r) => proibido.test(r))).toEqual([]);
    }
  });

  it("obrigatoriedade campo a campo: os opcionais dizem que são opcionais", async () => {
    montar();
    await aguardarEmpresa();
    expect(
      screen.getByText(/Campos com \* são obrigatórios/),
    ).toBeInTheDocument();
    for (const rotulo of [
      "Sexo",
      "Saudação",
      "Estado civil",
      "Nacionalidade",
      "Naturalidade",
      "Escolaridade",
      "Curso",
      "Nome do pai",
      "Nome da mãe",
      "País",
      "CEP",
      "Logradouro",
      "Número",
      "Complemento",
      "Bairro",
      "Cidade",
      "Estado",
    ]) {
      const campo = screen.getByLabelText(`${rotulo} (opcional)`);
      expect(campo).not.toHaveAttribute("aria-required");
    }
    for (const campo of [
      nome,
      dataNascimento,
      emailPessoal,
      celular,
      telefone,
    ]) {
      expect(campo()).toHaveAttribute("aria-required", "true");
      expect(campo()).toHaveAccessibleName(/obrigatório/);
      expect(campo()).not.toHaveAccessibleName(/opcional/);
    }
  });

  it("os blocos aparecem na ordem dos prints: dados pessoais, endereço, contatos", async () => {
    montar();
    await aguardarEmpresa();
    const titulos = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(titulos).toEqual([
      "Empresa",
      "Dados pessoais",
      "Endereço",
      "Contatos",
      "Vínculo",
      "Lotação inicial",
    ]);
  });

  it("país começa sugerido como Brasil e pode ser editado", async () => {
    montar();
    await aguardarEmpresa();
    expect(pais()).toHaveValue("Brasil");
    fireEvent.change(pais(), { target: { value: "Portugal" } });
    expect(pais()).toHaveValue("Portugal");
  });

  it("sem nenhum select inventado: sexo, estado civil, escolaridade, cidade e estado são texto", async () => {
    montar();
    await aguardarEmpresa();
    for (const rotulo of [
      /^Sexo/,
      /^Estado civil/,
      /^Escolaridade/,
      /^Cidade/,
      /^Estado \(opcional\)$/,
      /^País/,
    ]) {
      expect(screen.getByLabelText(rotulo).tagName).toBe("INPUT");
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
    expect(dataNascimento()).toHaveAccessibleDescription(
      /Informe a data de nascimento/,
    );
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("data de nascimento é obrigatória: sem ela, nada é enviado", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(dataNascimento(), { target: { value: "" } });
    fireEvent.click(admitir());
    await waitFor(() => expect(dataNascimento()).toHaveFocus());
    expect(dataNascimento()).toHaveAttribute("aria-invalid", "true");
    expect(dataNascimento()).toHaveAccessibleDescription(
      /Informe a data de nascimento/,
    );
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("o foco vai ao primeiro campo com erro na ordem visual", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(admitir());
    // Depois do nome, o primeiro obrigatório vazio é a data de nascimento.
    await waitFor(() => expect(dataNascimento()).toHaveFocus());
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.click(admitir());
    // Depois dela, o e-mail pessoal.
    await waitFor(() => expect(emailPessoal()).toHaveFocus());
    preencherContatos();
    fireEvent.click(admitir());
    await waitFor(() => expect(matricula()).toHaveFocus());
  });

  it("contatos seguem a ficha da T169: os três obrigatórios, com mensagem no campo", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(admitir());
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(emailPessoal()).toHaveAccessibleDescription(
      /E-mail pessoal é obrigatório/,
    );
    expect(celular()).toHaveAccessibleDescription(/Celular é obrigatório/);
    expect(telefone()).toHaveAccessibleDescription(/Telefone é obrigatório/);
  });

  it.each([
    [/Data de nascimento/, "2999-01-01", /não pode estar no futuro/],
    [/Data de nascimento/, "1899-12-31", /anterior a 01\/01\/1900/],
    [/^CEP/, "30140/071", /letras, números, espaço e hífen/],
    [/^Saudação/, "x".repeat(41), /no máximo 40 caracteres/],
  ])(
    "valida %s no cliente, antes de enviar",
    async (rotulo, valor, mensagem) => {
      montar();
      await aguardarEmpresa();
      preencherValido();
      const campo = screen.getByLabelText(rotulo);
      fireEvent.change(campo, { target: { value: valor } });
      fireEvent.click(admitir());
      await waitFor(() => expect(campo).toHaveFocus());
      expect(campo).toHaveAccessibleDescription(mensagem);
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

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
      perfilPessoal: {
        dataNascimento: "1990-05-20",
        sexo: null,
        saudacao: null,
        estadoCivil: null,
        nacionalidade: null,
        naturalidade: null,
        escolaridade: null,
        curso: null,
        nomePai: null,
        nomeMae: null,
      },
      endereco: {
        pais: "Brasil",
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        estado: null,
      },
      contatos: {
        emailPessoal: "pessoa.nova@exemplo.test",
        celular: "+5531999990000",
        telefone: "3133330000",
      },
    });
  });

  it("envia os dados pessoais e o endereço normalizados, vazio como null", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
      target: { value: "1990-05-20" },
    });
    fireEvent.change(screen.getByLabelText(/^Sexo/), {
      target: { value: "  Feminino " },
    });
    fireEvent.change(screen.getByLabelText(/^Naturalidade/), {
      target: { value: "Belo   Horizonte" },
    });
    fireEvent.change(screen.getByLabelText(/^Nome da mãe/), {
      target: { value: "Mãe Sintética" },
    });
    fireEvent.change(screen.getByLabelText(/^CEP/), {
      target: { value: "30140-071" },
    });
    fireEvent.change(screen.getByLabelText(/^Estado \(opcional\)$/), {
      target: { value: "MG" },
    });
    fireEvent.click(admitir());
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(admitirColaborador).toHaveBeenCalledWith(
      expect.objectContaining({
        perfilPessoal: expect.objectContaining({
          dataNascimento: "1990-05-20",
          sexo: "Feminino",
          naturalidade: "Belo Horizonte",
          nomeMae: "Mãe Sintética",
          curso: null,
        }),
        endereco: expect.objectContaining({
          pais: "Brasil",
          cep: "30140-071",
          estado: "MG",
          bairro: null,
        }),
      }),
    );
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
    // `type="email"` apara as pontas no próprio campo; o resto fica como digitado.
    expect(emailPessoal()).toHaveValue("Pessoa.Nova@Exemplo.TEST");
    expect(pais()).toHaveValue("Brasil");
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
  it("o país sugerido, sozinho, não conta como dado digitado", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    expect(pais()).toHaveValue("Brasil");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("editar só o país já conta como alteração e pede confirmação", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(pais(), { target: { value: "Argentina" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.getByRole("dialog", { name: "Descartar esta admissão?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

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
    // T176 — "Nada foi salvo", e não "Nada foi enviado": depois de uma
    // tentativa recusada, algo FOI enviado; o que não houve foi gravação.
    expect(confirmacao).toHaveAccessibleDescription(
      "Os dados digitados nesta página serão perdidos. Nada foi salvo.",
    );
    expect(confirmacao).not.toHaveTextContent(/Nada foi enviado/);
    fireEvent.click(
      within(confirmacao).getByRole("button", {
        name: "Continuar preenchendo",
      }),
    );
    expect(onSair).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(nome()).toHaveValue("Pessoa Sintética");
  });

  it("depois de uma recusa do servidor, o descarte continua dizendo só que nada foi salvo", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(409));
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(admitir());
    await waitFor(() => expect(matricula()).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.getByRole("dialog", { name: "Descartar esta admissão?" }),
    ).toHaveAccessibleDescription(/Nada foi salvo\.$/);
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
    // Módulo 1: o que o SERVIDOR gravou, bloco a bloco.
    const dadosPessoais = screen.getByRole("region", {
      name: "Dados pessoais",
    });
    expect(dadosPessoais).toHaveTextContent("20/05/1990");
    expect(dadosPessoais).toHaveTextContent("Mãe Sintética Servidor");
    expect(dadosPessoais).toHaveTextContent("Não informado");
    const enderecoGravado = screen.getByRole("region", { name: "Endereço" });
    expect(enderecoGravado).toHaveTextContent("Cidade Sintética");
    expect(enderecoGravado).toHaveTextContent("30140-071");
    const contatosGravados = screen.getByRole("region", { name: "Contatos" });
    expect(contatosGravados).toHaveTextContent("pessoa.servidor@exemplo.test");
    expect(contatosGravados).toHaveTextContent("+5531999990000");
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

  it("revisar contatos na ficha é uma ação separada", async () => {
    const { onAbrirAdmitido } = await admitirComSucesso();
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar contatos na ficha" }),
    );
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
    expect(emailPessoal()).toHaveValue("");
    expect(pais()).toHaveValue("Brasil");
  });
});

// ---------------------------------------------------------------------------
// T176 — contrato de CSS da confirmação de sucesso.
//
// O ambiente de teste não carrega CSS (`css: false`), então o vão vertical que
// a validação no navegador achou é preso aqui pela FONTE: `flex: 1 1 16rem` no
// texto genérico virava ALTURA de 16rem na confirmação, que é coluna flex. A
// base flexível só pode existir na faixa de aviso, que é linha.
// ---------------------------------------------------------------------------
describe("Nova admissão — contrato de CSS da confirmação", () => {
  const css = readFileSync(
    "src/screens/pessoas/NovaAdmissaoScreen.css",
    "utf8",
  );

  /** Corpo da regra cujo seletor é exatamente `seletor`, ou `null`. */
  function corpoDaRegra(seletor: string): string | null {
    const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(
      String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
      "m",
    ).exec(css);
    return m ? (m[1] ?? "") : null;
  }

  it("o texto genérico não tem nenhuma propriedade flex", () => {
    const corpo = corpoDaRegra(".nova-admissao__texto");
    expect(corpo).not.toBeNull();
    expect(corpo).not.toMatch(/(?:^|[;\s])flex(?:-grow|-basis|-shrink)?\s*:/);
    expect(corpo).not.toMatch(/(?:^|[;\s])(?:min-)?height\s*:/);
  });

  it("a base flexível existe só na faixa de aviso, que é linha", () => {
    expect(corpoDaRegra(".nova-admissao__aviso .nova-admissao__texto")).toMatch(
      /flex:\s*1\s+1\s+16rem\s*;/,
    );
    expect(css.match(/flex:\s*1\s+1\s+16rem/g)).toHaveLength(1);
    expect(corpoDaRegra(".nova-admissao__aviso")).not.toMatch(
      /flex-direction:\s*column/,
    );
  });

  it("a confirmação é coluna flex — a premissa que fazia a base virar altura", () => {
    const corpo = corpoDaRegra(".nova-admissao__sucesso");
    expect(corpo).toMatch(/display:\s*flex/);
    expect(corpo).toMatch(/flex-direction:\s*column/);
  });
});
