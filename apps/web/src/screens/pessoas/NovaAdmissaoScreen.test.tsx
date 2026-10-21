/**
 * Nova admissão (T176) — a página própria da admissão.
 *
 * Prende o que a decisão do `DP-FLX-21` e o contrato da T167 exigem: página
 * fora de modal, empresa só para leitura, só os campos que o contrato já
 * aceita, erro ancorado no campo com foco no primeiro, dados preservados na
 * falha, descarte confirmado e confirmação com o que o SERVIDOR gravou.
 *
 * T179 — "Salvar" só valida; quem grava é "Confirmar cadastro", no modal de
 * confirmação. Os testes que esperam um envio passam pelos dois.
 *
 * T179 — obrigatoriedade da decisão da proprietária de 2026-10-21: só nome,
 * data de nascimento, tipo de vínculo, data de admissão, Departamento e Cargo
 * são obrigatórios. Matrícula, Unidade, e-mail pessoal, celular e telefone
 * passaram a opcionais, e o sexo é lista fechada.
 */
import {
  act,
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
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import { type EnderecoDoCepApi, consultarCep } from "../../api/cepClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");
// T178 — a consulta de CEP nunca sai da página nos testes.
vi.mock("../../api/cepClient");

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

const cargo: CargoApi = {
  id: "77777777-7777-4777-8777-777777777777",
  codigo: "CAR1",
  nome: "Cargo Sintético (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const unidade: UnidadeOrganizacionalApi = {
  id: "88888888-8888-4888-8888-888888888888",
  codigo: "UNI1",
  nome: "Unidade Sintética (teste)",
  empresaId: empresa.id,
  status: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
} as UnidadeOrganizacionalApi;

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
      unidadeOrganizacionalId: unidade.id,
      departamentoId: departamento.id,
      areaId: null,
      equipeId: null,
      cargoId: cargo.id,
      centroCustoId: null,
    },
  },
  perfilPessoal: {
    dataNascimento: "1990-05-20",
    // T179 — gravado como código; a confirmação mostra o rótulo.
    sexo: "feminino",
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
    // T179 — CEP brasileiro gravado em 8 dígitos.
    cep: "30140071",
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
    // T179 — telefones gravados em `+55` + DDD + número.
    celular: "+5531999990000",
    telefone: "+553133330000",
    atualizadoEm: "2026-10-20T12:00:00.000Z",
  },
};

function recusa(
  status: number,
  detalhes: {
    erros?: { campo: string; motivo: string }[];
    codigo?: string;
  } = {},
): ApiError {
  const erro = new ApiError(status, "recusado");
  Object.assign(erro, { status, message: "recusado", ...detalhes });
  return erro;
}

/** T179 — chave de idempotência enviada na chamada `n` (0 = primeira). */
function chaveDaChamada(n: number): string | undefined {
  return vi.mocked(admitirColaborador).mock.calls[n]?.[1]?.chaveIdempotencia;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([empresa]));
  vi.mocked(listarDepartamentos).mockResolvedValue(paginado([departamento]));
  vi.mocked(listarUnidades).mockResolvedValue(paginado([unidade]));
  vi.mocked(listarEquipes).mockResolvedValue(paginado([]));
  vi.mocked(listarCargos).mockResolvedValue(paginado([cargo]));
  vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
  vi.mocked(listarAreas).mockResolvedValue(paginado([]));
  vi.mocked(admitirColaborador).mockResolvedValue(resposta);
});

function montar(papelDoAtor: string | null = "rh") {
  const onSair = vi.fn();
  const onAbrirAdmitido = vi.fn();
  render(
    <NovaAdmissaoScreen
      onSair={onSair}
      onAbrirAdmitido={onAbrirAdmitido}
      papelDoAtor={papelDoAtor}
    />,
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
// T179 — um seletor por referência da lotação.
const departamentoSel = () => screen.getByLabelText(/^Departamento/);
const cargoSel = () => screen.getByLabelText(/^Cargo/);
const unidadeSel = () => screen.getByLabelText(/^Unidade/);
const areaSel = () => screen.getByLabelText(/^Área/);
const equipeSel = () => screen.getByLabelText(/^Equipe/);
const centroSel = () => screen.getByLabelText(/^Centro de custo/);
/** T179 — "Salvar" só valida e abre a confirmação. */
const salvar = () => screen.getByRole("button", { name: "Salvar" });
const dialogoConfirmacao = () =>
  screen.queryByRole("dialog", { name: "Confirmar cadastro de colaborador?" });
const botaoConfirmar = () =>
  within(dialogoConfirmacao()!).getByRole("button", {
    name: /Confirmar cadastro|Cadastrando…/,
  });

/** "Salvar" e, no modal, "Confirmar cadastro": o caminho que grava. */
async function salvarEConfirmar() {
  fireEvent.click(salvar());
  await screen.findByRole("dialog", {
    name: "Confirmar cadastro de colaborador?",
  });
  fireEvent.click(botaoConfirmar());
}

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

/** T179 — Departamento, Cargo e Unidade: obrigatórios, um seletor cada. */
function preencherLotacao() {
  fireEvent.change(departamentoSel(), { target: { value: departamento.id } });
  fireEvent.change(cargoSel(), { target: { value: cargo.id } });
  fireEvent.change(unidadeSel(), { target: { value: unidade.id } });
}

function preencherValido() {
  preencherContatos();
  fireEvent.change(nome(), { target: { value: "  Pessoa Sintética Nova " } });
  fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
  fireEvent.change(matricula(), { target: { value: "mat-0900" } });
  fireEvent.change(tipo(), { target: { value: "clt" } });
  fireEvent.change(data(), { target: { value: "2026-11-03" } });
  preencherLotacao();
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
    // T179 — só estes seis são obrigatórios.
    for (const campo of [
      nome,
      dataNascimento,
      tipo,
      data,
      departamentoSel,
      cargoSel,
    ]) {
      expect(campo()).toHaveAttribute("aria-required", "true");
    }
    for (const campo of [
      emailPessoal,
      celular,
      telefone,
      matricula,
      unidadeSel,
    ]) {
      expect(campo()).not.toHaveAttribute("aria-required");
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
      // T179 — opcionais desde a decisão de 2026-10-21.
      "E-mail pessoal",
      "Celular",
      "Telefone",
      "Matrícula",
      "Unidade",
      "Área",
      "Equipe",
      "Centro de custo",
    ]) {
      const campo = screen.getByLabelText(`${rotulo} (opcional)`);
      expect(campo).not.toHaveAttribute("aria-required");
    }
    for (const campo of [
      nome,
      dataNascimento,
      tipo,
      data,
      departamentoSel,
      cargoSel,
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

  it("T179 — sexo é seletor de lista fechada: vazio + as quatro opções, sem texto livre", async () => {
    montar();
    await aguardarEmpresa();
    const sexo = screen.getByLabelText("Sexo (opcional)");
    expect(sexo.tagName).toBe("SELECT");
    expect(sexo).not.toHaveAttribute("aria-required");
    expect(sexo).toHaveValue("");
    expect(
      within(sexo)
        .getAllByRole("option")
        .map((o) => [(o as HTMLOptionElement).value, o.textContent]),
    ).toEqual([
      ["", "Selecione…"],
      ["feminino", "Feminino"],
      ["masculino", "Masculino"],
      ["intersexo", "Intersexo"],
      ["nao_informar", "Não informar"],
    ]);
  });

  it("sem outro select inventado: estado civil, escolaridade, cidade e estado são texto", async () => {
    montar();
    await aguardarEmpresa();
    for (const rotulo of [
      /^Estado civil/,
      /^Escolaridade/,
      /^Cidade/,
      /^Estado \(opcional\)$/,
      /^País/,
    ]) {
      expect(screen.getByLabelText(rotulo).tagName).toBe("INPUT");
    }
  });

  it("salvar vazio: erros ancorados nos campos, foco no primeiro, nada enviado e nenhuma confirmação", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(nome()).toHaveAttribute("aria-invalid", "true");
    expect(nome()).toHaveAccessibleDescription(/Nome é obrigatório/);
    expect(tipo()).toHaveAccessibleDescription(/Selecione o tipo de vínculo/);
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(departamentoSel()).toHaveAccessibleDescription(
      /Selecione o departamento/,
    );
    expect(cargoSel()).toHaveAccessibleDescription(/Selecione o cargo/);
    expect(dataNascimento()).toHaveAccessibleDescription(
      /Informe a data de nascimento/,
    );
    // T179 — os opcionais vazios não acusam erro.
    for (const campo of [
      matricula,
      unidadeSel,
      emailPessoal,
      celular,
      telefone,
    ]) {
      expect(campo()).not.toHaveAttribute("aria-invalid");
    }
    expect(dialogoConfirmacao()).toBeNull();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("data de nascimento é obrigatória: sem ela, nada é enviado", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(dataNascimento(), { target: { value: "" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(dataNascimento()).toHaveFocus());
    expect(dataNascimento()).toHaveAttribute("aria-invalid", "true");
    expect(dataNascimento()).toHaveAccessibleDescription(
      /Informe a data de nascimento/,
    );
    expect(dialogoConfirmacao()).toBeNull();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("o foco vai ao primeiro campo com erro na ordem visual", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(salvar());
    // T179 — o e-mail pessoal, ao lado do nome, é opcional: o primeiro
    // obrigatório vazio depois do nome é a data de nascimento.
    await waitFor(() => expect(dataNascimento()).toHaveFocus());
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.click(salvar());
    // Contatos e matrícula são opcionais: depois vem o tipo de vínculo.
    await waitFor(() => expect(tipo()).toHaveFocus());
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(data()).toHaveFocus());
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.click(salvar());
    // T179 — e, por fim, os dois seletores obrigatórios da lotação.
    await waitFor(() => expect(departamentoSel()).toHaveFocus());
    fireEvent.change(departamentoSel(), { target: { value: departamento.id } });
    fireEvent.click(salvar());
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    fireEvent.change(cargoSel(), { target: { value: cargo.id } });
    fireEvent.click(salvar());
    // Sem Unidade, o formulário está completo: abre a confirmação.
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("T178/T179 — os campos aparecem na disposição pedida, linha a linha", async () => {
    montar();
    await aguardarEmpresa();

    /** Rótulos de cada linha da grade de um grupo, sem o "(opcional)". */
    function linhasDo(grupo: string): string[][] {
      const secao = screen
        .getByRole("heading", { level: 2, name: grupo })
        .closest("section")!;
      return [...secao.querySelectorAll(".nova-admissao__linha")].map((linha) =>
        [...linha.querySelectorAll("label")].map((l) =>
          (l.textContent ?? "")
            .replace(" (opcional)", "")
            .replace("*", "")
            .replace(" (obrigatório)", "")
            .trim(),
        ),
      );
    }

    expect(linhasDo("Dados pessoais")).toEqual([
      ["Nome completo", "E-mail pessoal"],
      ["Data de nascimento", "Sexo", "Saudação"],
      ["Estado civil", "Nacionalidade", "Naturalidade"],
      ["Escolaridade", "Curso"],
      ["Nome do pai", "Nome da mãe"],
    ]);
    expect(linhasDo("Endereço")).toEqual([
      ["País", "CEP"],
      ["Logradouro", "Número"],
      ["Complemento", "Bairro"],
      ["Cidade", "Estado"],
    ]);
    expect(linhasDo("Contatos")).toEqual([["Celular", "Telefone"]]);
    expect(linhasDo("Vínculo")).toEqual([
      ["Matrícula", "Tipo de vínculo", "Data de admissão"],
    ]);
    // T179 — os três obrigatórios na primeira linha; os opcionais na
    // segunda, com a Área logo abaixo do Departamento que a filtra.
    expect(linhasDo("Lotação inicial")).toEqual([
      ["Departamento", "Cargo", "Unidade"],
      ["Área", "Equipe", "Centro de custo"],
    ]);

    // Classes de coluna: 2, 3 e a linha larga/estreita do logradouro.
    const endereco = screen
      .getByRole("heading", { level: 2, name: "Endereço" })
      .closest("section")!;
    expect(
      screen.getByLabelText(/^Logradouro/).closest(".nova-admissao__linha"),
    ).toHaveClass("nova-admissao__linha--larga-estreita");
    expect(endereco.querySelectorAll(".nova-admissao__linha--2")).toHaveLength(
      3,
    );
    expect(
      screen.getByLabelText(/^Matrícula/).closest(".nova-admissao__linha"),
    ).toHaveClass("nova-admissao__linha--3");
    expect(departamentoSel().closest(".nova-admissao__linha")).toHaveClass(
      "nova-admissao__linha--3",
    );
  });

  it("T178 — o e-mail pessoal está em Dados pessoais e continua indo em `contatos.emailPessoal`", async () => {
    montar();
    await aguardarEmpresa();

    const dadosPessoais = screen
      .getByRole("heading", { level: 2, name: "Dados pessoais" })
      .closest("section")!;
    const contatosSecao = screen
      .getByRole("heading", { level: 2, name: "Contatos" })
      .closest("section")!;
    expect(dadosPessoais).toContainElement(emailPessoal());
    expect(contatosSecao).not.toContainElement(emailPessoal());
    // Os ids não mudaram: só a posição.
    expect(emailPessoal()).toHaveAttribute("id", "nova-admissao-email-pessoal");
    expect(
      within(contatosSecao).getByText(
        /O e-mail pessoal fica em Dados pessoais/,
      ),
    ).toBeInTheDocument();

    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.contatos).toEqual({
      emailPessoal: "pessoa.nova@exemplo.test",
      celular: "+5531999990000",
      telefone: "+553133330000",
    });
    expect(dto.perfilPessoal).not.toHaveProperty("emailPessoal");
  });

  it("T179 — contatos opcionais: vazios não acusam erro nem dizem 'obrigatório'", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    for (const campo of [emailPessoal, celular, telefone]) {
      expect(campo()).not.toHaveAttribute("aria-invalid");
      expect(campo()).not.toHaveAccessibleDescription(/obrigatório/);
      expect(campo()).not.toHaveAccessibleName(/obrigatório/);
    }
  });

  it.each([
    [/Data de nascimento/, "2999-01-01", /não pode estar no futuro/],
    [/Data de nascimento/, "1899-12-31", /anterior a 01\/01\/1900/],
    // T179 — com país Brasil, o CEP precisa dos 8 dígitos.
    [/^CEP/, "3014", /Informe os 8 dígitos do CEP, no formato 00000-000/],
    [/^Saudação/, "x".repeat(41), /no máximo 40 caracteres/],
    [/^Celular/, "11 9876-5", /precisa do DDD e do número/],
    [/^Telefone/, "(11) 1000-0000", /não é um número brasileiro válido/],
    // T179 — opcionais, mas o formato ainda vale quando preenchidos.
    [/^Matrícula/, "M", /Use apenas letras maiúsculas/],
    [/^Matrícula/, "MAT 01", /Use apenas letras maiúsculas/],
    [/E-mail pessoal/, "sem-arroba", /Informe um e-mail válido/],
  ])(
    "valida %s no cliente, antes de enviar",
    async (rotulo, valor, mensagem) => {
      montar();
      await aguardarEmpresa();
      preencherValido();
      const campo = screen.getByLabelText(rotulo);
      fireEvent.change(campo, { target: { value: valor } });
      fireEvent.click(salvar());
      await waitFor(() => expect(campo).toHaveFocus());
      expect(campo).toHaveAccessibleDescription(mensagem);
      expect(dialogoConfirmacao()).toBeNull();
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

  it("com outro país, o CEP é texto livre e segue a forma de antes", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(pais(), { target: { value: "Portugal" } });
    const cep = screen.getByLabelText(/^CEP/);
    fireEvent.change(cep, { target: { value: "30140/071" } });
    expect(cep).toHaveValue("30140/071");
    fireEvent.click(salvar());
    await waitFor(() => expect(cep).toHaveFocus());
    expect(cep).toHaveAccessibleDescription(/letras, números, espaço e hífen/);
    fireEvent.change(cep, { target: { value: "1000-001" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(admitirColaborador).mock.calls[0]![0].endereco,
    ).toMatchObject({ pais: "Portugal", cep: "1000-001" });
  });

  it("corrigir um campo limpa só o erro dele", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    fireEvent.change(nome(), { target: { value: "Pessoa" } });
    expect(nome()).not.toHaveAttribute("aria-invalid");
    expect(tipo()).toHaveAttribute("aria-invalid", "true");
  });

  it("envia exatamente o contrato: empresa da sessão, matrícula normalizada, Departamento, Cargo e Unidade, e a chave do envio", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(admitirColaborador).toHaveBeenCalledWith(
      {
        nome: "Pessoa Sintética Nova",
        empresaId: empresa.id,
        matricula: "MAT-0900",
        tipo: "clt",
        dataAdmissao: "2026-11-03",
        motivoCodigo: "admissao_inicial",
        departamentoId: departamento.id,
        cargoId: cargo.id,
        unidadeOrganizacionalId: unidade.id,
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
          telefone: "+553133330000",
        },
      },
      { chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    );
  });

  it("T179 — só os obrigatórios: sem matrícula, unidade, contatos nem e-mail, o corpo os omite", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: " Pessoa Mínima " } });
    fireEvent.change(dataNascimento(), { target: { value: "1991-02-03" } });
    fireEvent.change(tipo(), { target: { value: "estagio" } });
    fireEvent.change(data(), { target: { value: "2026-11-04" } });
    fireEvent.change(departamentoSel(), { target: { value: departamento.id } });
    fireEvent.change(cargoSel(), { target: { value: cargo.id } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const [dto, opcoes] = vi.mocked(admitirColaborador).mock.calls[0]!;
    expect(dto).toEqual({
      nome: "Pessoa Mínima",
      empresaId: empresa.id,
      tipo: "estagio",
      dataAdmissao: "2026-11-04",
      motivoCodigo: "admissao_inicial",
      departamentoId: departamento.id,
      cargoId: cargo.id,
      perfilPessoal: {
        dataNascimento: "1991-02-03",
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
    });
    // Ausentes de verdade — nem `undefined`, nem string vazia.
    for (const chave of [
      "matricula",
      "unidadeOrganizacionalId",
      "areaId",
      "equipeId",
      "centroCustoId",
      "contatos",
    ]) {
      expect(Object.keys(dto)).not.toContain(chave);
    }
    expect(opcoes).toEqual({
      chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("T179 — um contato só: o bloco leva só ele", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(emailPessoal(), { target: { value: "" } });
    fireEvent.change(telefone(), { target: { value: "" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0].contatos).toEqual({
      celular: "+5531999990000",
    });
  });

  it.each([
    ["feminino", "Feminino"],
    ["masculino", "Masculino"],
    ["intersexo", "Intersexo"],
    ["nao_informar", "Não informar"],
  ])("T179 — sexo %s (%s) vai como código no corpo", async (codigo, rotulo) => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    const sexo = screen.getByLabelText("Sexo (opcional)");
    fireEvent.change(sexo, { target: { value: codigo } });
    expect(sexo).toHaveDisplayValue(rotulo);
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(admitirColaborador).mock.calls[0]![0].perfilPessoal.sexo,
    ).toBe(codigo);
  });

  it("T179 — sexo sem seleção vai null, e voltar a 'Selecione…' desfaz a escolha", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    const sexo = screen.getByLabelText("Sexo (opcional)");
    fireEvent.change(sexo, { target: { value: "masculino" } });
    fireEvent.change(sexo, { target: { value: "" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(admitirColaborador).mock.calls[0]![0].perfilPessoal.sexo,
    ).toBeNull();
  });

  it("T179 — valor de sexo fora da lista não é aceito pelo seletor", async () => {
    montar();
    await aguardarEmpresa();
    const sexo = screen.getByLabelText("Sexo (opcional)");
    fireEvent.change(sexo, { target: { value: "Feminino" } });
    // Sem opção com esse valor, o seletor fica sem seleção — nunca texto livre.
    expect(sexo).toHaveValue("");
  });

  it("envia os dados pessoais e o endereço normalizados, vazio como null", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(screen.getByLabelText(/Data de nascimento/), {
      target: { value: "1990-05-20" },
    });
    // T179 — sexo de lista fechada: vai o código.
    fireEvent.change(screen.getByLabelText(/^Sexo/), {
      target: { value: "feminino" },
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
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(admitirColaborador).toHaveBeenCalledWith(
      expect.objectContaining({
        perfilPessoal: expect.objectContaining({
          dataNascimento: "1990-05-20",
          sexo: "feminino",
          naturalidade: "Belo Horizonte",
          nomeMae: "Mãe Sintética",
          curso: null,
        }),
        // T179 — CEP brasileiro vai só com os 8 dígitos.
        endereco: expect.objectContaining({
          pais: "Brasil",
          cep: "30140071",
          estado: "MG",
          bairro: null,
        }),
      }),
      expect.anything(),
    );
  });

  it("T179 — a área é opcional, filtrada pelo departamento, e vai junto com ele", async () => {
    const area = {
      id: "66666666-6666-6666-6666-666666666666",
      departamentoId: departamento.id,
      codigo: "ARE1",
      nome: "Área Sintética (teste)",
      status: "ativo",
      criadoEm: "2025-01-01T12:00:00.000Z",
      atualizadoEm: "2025-01-01T12:00:00.000Z",
    };
    vi.mocked(listarAreas).mockResolvedValue(paginado([area]));
    montar();
    await aguardarEmpresa();
    // Sem departamento, a área não tem o que listar.
    expect(areaSel()).toBeDisabled();
    preencherValido();
    await screen.findByRole("option", {
      name: "ARE1 — Área Sintética (teste)",
    });
    expect(listarAreas).toHaveBeenCalledWith(
      expect.objectContaining({ departamentoId: departamento.id }),
    );
    fireEvent.change(areaSel(), { target: { value: area.id } });
    await salvarEConfirmar();
    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith(
        expect.objectContaining({
          areaId: area.id,
          departamentoId: departamento.id,
          cargoId: cargo.id,
          unidadeOrganizacionalId: unidade.id,
        }),
        expect.anything(),
      ),
    );
  });

  it("T179 — trocar o departamento limpa a área escolhida", async () => {
    const outro = {
      ...departamento,
      id: "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
      codigo: "DEP2",
    };
    vi.mocked(listarDepartamentos).mockResolvedValue(
      paginado([departamento, outro]),
    );
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
    fireEvent.change(departamentoSel(), { target: { value: departamento.id } });
    await screen.findByRole("option", { name: /ARE1/ });
    fireEvent.change(areaSel(), {
      target: { value: "66666666-6666-6666-6666-666666666666" },
    });
    fireEvent.change(departamentoSel(), { target: { value: outro.id } });
    expect(areaSel()).toHaveValue("");
  });

  it("T179 — equipe e centro de custo são opcionais e vão quando escolhidos", async () => {
    vi.mocked(listarEquipes).mockResolvedValue(
      paginado([
        {
          id: "99999999-9999-4999-8999-999999999999",
          codigo: "EQP1",
          nome: "Equipe Sintética (teste)",
          status: "ativo",
        } as never,
      ]),
    );
    vi.mocked(listarCentrosCusto).mockResolvedValue(
      paginado([
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          codigo: "CC1",
          nome: "Centro Sintético (teste)",
          status: "ativo",
        } as never,
      ]),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    expect(
      within(equipeSel()).getByRole("option", {
        name: "EQP1 — Equipe Sintética (teste)",
      }),
    ).toBeInTheDocument();
    fireEvent.change(equipeSel(), {
      target: { value: "99999999-9999-4999-8999-999999999999" },
    });
    fireEvent.change(centroSel(), {
      target: { value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    await salvarEConfirmar();
    await waitFor(() =>
      expect(admitirColaborador).toHaveBeenCalledWith(
        expect.objectContaining({
          equipeId: "99999999-9999-4999-8999-999999999999",
          centroCustoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
        expect.anything(),
      ),
    );
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0]).not.toHaveProperty(
      "areaId",
    );
  });

  it("T179 — só ativos viram opção, no formato CÓDIGO — Nome", async () => {
    vi.mocked(listarCargos).mockResolvedValue(
      paginado([
        cargo,
        { ...cargo, id: "inativo", codigo: "CARX", status: "inativo" },
      ]),
    );
    montar();
    await aguardarEmpresa();
    const opcoes = within(cargoSel())
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes).toEqual(["Selecione…", "CAR1 — Cargo Sintético (teste)"]);
  });
});

// ---------------------------------------------------------------------------
// T179 — confirmação antes de gravar.
// ---------------------------------------------------------------------------
describe("T179 — confirmação antes de gravar", () => {
  it("só 'Salvar' não envia: abre a confirmação com o título e as duas ações", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(salvar());
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialogo).getByRole("button", { name: "Voltar e revisar" }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByRole("button", { name: "Confirmar cadastro" }),
    ).toBeInTheDocument();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("o resumo traz empresa, nome, matrícula, vínculo, data e lotação — nunca contatos, endereço ou nascimento", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(screen.getByLabelText(/^CEP/), {
      target: { value: "30140071" },
    });
    fireEvent.change(screen.getByLabelText(/^Cidade/), {
      target: { value: "Cidade Resumo Sintética" },
    });
    fireEvent.change(screen.getByLabelText(/^Logradouro/), {
      target: { value: "Rua Resumo Sintética" },
    });
    fireEvent.click(salvar());
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(dialogo).toHaveTextContent("Empresa Sintética (teste) (EMP1)");
    expect(dialogo).toHaveTextContent("Pessoa Sintética Nova");
    expect(dialogo).toHaveTextContent("MAT-0900");
    expect(dialogo).toHaveTextContent("CLT");
    expect(dialogo).toHaveTextContent("03/11/2026");
    expect(dialogo).toHaveTextContent(
      "Departamento: DEP1 — Departamento Sintético (teste)",
    );
    expect(dialogo).toHaveTextContent("Cargo: CAR1 — Cargo Sintético (teste)");
    expect(dialogo).toHaveTextContent(
      "Unidade: UNI1 — Unidade Sintética (teste)",
    );
    // Nada de contatos, endereço ou nascimento — nem rótulo, nem valor.
    for (const proibido of [
      /e-mail/i,
      /exemplo\.test/i,
      /celular/i,
      /telefone/i,
      /99999-0000/,
      /3333-0000/,
      /CEP/,
      /30140/,
      /Cidade Resumo/,
      /Rua Resumo/,
      /endereço/i,
      /nascimento/i,
      /20\/05\/1990/,
      /1990/,
    ]) {
      expect(dialogo.textContent ?? "").not.toMatch(proibido);
    }
  });

  it("T179 — sem matrícula e sem unidade, o resumo diz 'Não informada'", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(matricula(), { target: { value: "" } });
    fireEvent.change(unidadeSel(), { target: { value: "" } });
    fireEvent.click(salvar());
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    const matriculaNoResumo = within(dialogo).getByText("Matrícula", {
      selector: "dt",
    }).nextElementSibling;
    expect(matriculaNoResumo).toHaveTextContent("Não informada");
    expect(dialogo).toHaveTextContent("Unidade: Não informada");
    expect(dialogo).toHaveTextContent("Área: Não informada");
    expect(dialogo).toHaveTextContent("Centro de custo: Não informado");
    expect(dialogo).not.toHaveTextContent("null");
  });

  it("'Voltar e revisar' fecha sem enviar, preserva tudo e devolve o foco a 'Salvar'", async () => {
    vi.mocked(consultarCep).mockResolvedValue({
      cep: "30140071",
      logradouro: "Avenida Sintética",
      bairro: "Bairro Sintético",
      cidade: "Cidade Sintética",
      uf: "MG",
      estado: "Minas Gerais",
    });
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.change(screen.getByLabelText(/^CEP/), {
      target: { value: "30140071" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar CEP" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Logradouro/)).toHaveValue(
        "Avenida Sintética",
      ),
    );
    salvar().focus();
    fireEvent.click(salvar());
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Voltar e revisar" }),
    );
    expect(dialogoConfirmacao()).toBeNull();
    await waitFor(() => expect(salvar()).toHaveFocus());
    expect(admitirColaborador).not.toHaveBeenCalled();
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(departamentoSel()).toHaveValue(departamento.id);
    expect(cargoSel()).toHaveValue(cargo.id);
    expect(unidadeSel()).toHaveValue(unidade.id);
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(screen.getByLabelText(/^CEP/)).toHaveValue("30140-071");
    expect(
      document.getElementById("nova-admissao-cep-status"),
    ).toHaveTextContent(/Endereço sugerido pelo CEP/);
  });

  it("Escape faz o mesmo que 'Voltar e revisar'", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(salvar());
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogoConfirmacao()).toBeNull();
    await waitFor(() => expect(salvar()).toHaveFocus());
    expect(admitirColaborador).not.toHaveBeenCalled();
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
  });

  it("duplo clique em 'Confirmar cadastro' envia uma vez; 'Cadastrando…' e o modal não fecha enquanto envia", async () => {
    let resolver: (r: AdmissaoRegistradaApi) => void = () => undefined;
    vi.mocked(admitirColaborador).mockReturnValue(
      new Promise((r) => {
        resolver = r;
      }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    fireEvent.click(salvar());
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    const botao = botaoConfirmar();
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(botao).toHaveTextContent("Cadastrando…"));
    expect(botao).toHaveAttribute("aria-disabled", "true");
    const dialogo = dialogoConfirmacao()!;
    expect(
      within(dialogo).getByRole("button", { name: "Voltar e revisar" }),
    ).toBeDisabled();
    // Escape não fecha durante o envio.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogoConfirmacao()).not.toBeNull();
    fireEvent.click(botao);
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
    await act(async () => resolver(resposta));
    await screen.findByText("Admissão registrada");
    expect(dialogoConfirmacao()).toBeNull();
  });

  it("a chave do envio é um UUID gerado por crypto.randomUUID", async () => {
    const espiao = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("12345678-1234-4234-8234-123456789abc");
    try {
      montar();
      await aguardarEmpresa();
      preencherValido();
      await salvarEConfirmar();
      await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
      expect(chaveDaChamada(0)).toBe("12345678-1234-4234-8234-123456789abc");
      expect(espiao).toHaveBeenCalledTimes(1);
    } finally {
      espiao.mockRestore();
    }
  });
});

describe("Nova admissão — recusa do servidor preserva os dados", () => {
  it("409 com a matrícula em uso: modal fecha, mensagem e foco no campo, dados intactos", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(409, { erros: [{ campo: "matricula", motivo: "em_uso" }] }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(matricula()).toHaveFocus());
    expect(dialogoConfirmacao()).toBeNull();
    expect(matricula()).toHaveAccessibleDescription(
      "Letras maiúsculas, números, - e _ (2 a 32 caracteres). Pode ficar em branco. Esta matrícula já está em uso nesta empresa.",
    );
    expect(emailPessoal()).not.toHaveAttribute("aria-invalid");
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(tipo()).toHaveValue("clt");
    expect(data()).toHaveValue("2026-11-03");
    expect(departamentoSel()).toHaveValue(departamento.id);
    expect(cargoSel()).toHaveValue(cargo.id);
    expect(unidadeSel()).toHaveValue(unidade.id);
    // `type="email"` apara as pontas no próprio campo; o resto fica como digitado.
    expect(emailPessoal()).toHaveValue("Pessoa.Nova@Exemplo.TEST");
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(pais()).toHaveValue("Brasil");
    expect(salvar()).toBeEnabled();
    // Resumo seguro no topo: o NOME do campo, nunca o valor.
    const resumo = screen.getByRole("group", {
      name: "Revise 1 campo antes de confirmar",
    });
    expect(
      within(resumo).getByRole("button", { name: "Matrícula" }),
    ).toBeInTheDocument();
    expect(resumo).not.toHaveTextContent("MAT-0900");
  });

  it("409 com o e-mail pessoal em uso: mensagem e foco no e-mail", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(409, {
        erros: [{ campo: "contatos.emailPessoal", motivo: "em_uso" }],
      }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(emailPessoal()).toHaveFocus());
    expect(emailPessoal()).toHaveAccessibleDescription(
      "Este e-mail pessoal já está em uso nesta empresa.",
    );
    expect(matricula()).not.toHaveAttribute("aria-invalid");
    expect(emailPessoal()).toHaveValue("Pessoa.Nova@Exemplo.TEST");
  });

  it("409 com os dois: os dois campos marcados, resumo com os dois nomes e foco no primeiro da tela", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(409, {
        erros: [
          { campo: "matricula", motivo: "em_uso" },
          { campo: "contatos.emailPessoal", motivo: "em_uso" },
        ],
      }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    // O e-mail vem antes da matrícula na tela.
    await waitFor(() => expect(emailPessoal()).toHaveFocus());
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
    const resumo = screen.getByRole("group", {
      name: "Revise 2 campos antes de confirmar",
    });
    expect(
      within(resumo)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["E-mail pessoal", "Matrícula"]);
    expect(resumo).not.toHaveTextContent(/exemplo\.test|MAT-0900/i);
    // O nome no resumo leva ao campo.
    fireEvent.click(within(resumo).getByRole("button", { name: "Matrícula" }));
    expect(matricula()).toHaveFocus();
    // Corrigir um tira só ele do resumo.
    fireEvent.change(matricula(), { target: { value: "MAT-0901" } });
    expect(
      screen.getByRole("group", { name: "Revise 1 campo antes de confirmar" }),
    ).toBeInTheDocument();
  });

  it("409 sem a lista de campos: mensagem geral, sem presumir que é a matrícula", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(409));
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(/conflita com um registro/);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(matricula()).not.toHaveAttribute("aria-invalid");
  });

  it("422 sem código: a lotação é apontada, com foco no aviso dela", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(422));
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    const aviso = await screen.findByText(/A lotação escolhida não foi aceita/);
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(
      screen.getByRole("group", { name: "Revise 1 campo antes de confirmar" }),
    ).toHaveTextContent("Lotação inicial");
    expect(departamentoSel()).toHaveValue(departamento.id);
  });

  it("422 idempotência divergente: explica que o envio já foi registrado com outros dados", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(
      /Este envio já foi registrado antes, com outros dados/,
    );
    expect(alerta).toHaveTextContent(/Confira em Colaboradores/);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(screen.queryByText(/A lotação escolhida/)).toBeNull();
    expect(matricula()).toHaveValue("MAT-0900");
  });

  it("422 idempotência divergente: oferece recomeçar com chave nova e conferir a listagem", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Este envio já foi registrado antes/);
    const chaveRecusada = chaveDaChamada(0);
    expect(
      screen.getByRole("button", { name: "Conferir em Colaboradores" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Recomeçar a admissão" }),
    );
    // Formulário vazio, foco no primeiro campo e nenhuma recusa na tela.
    expect(matricula()).toHaveValue("");
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(screen.queryByText(/Este envio já foi registrado antes/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Recomeçar a admissão" }),
    ).toBeNull();
    // O próximo envio é OUTRO: chave nova.
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(2));
    expect(chaveDaChamada(1)).toMatch(/^[0-9a-f-]{36}$/);
    expect(chaveDaChamada(1)).not.toBe(chaveRecusada);
  });

  it("outras recusas não oferecem recomeçar", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(500));
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Os dados digitados foram mantidos/);
    expect(
      screen.queryByRole("button", { name: "Recomeçar a admissão" }),
    ).toBeNull();
  });

  it.each([
    [400, /O servidor recusou algum dos dados/],
    [404, /A empresa ativa mudou/],
    [403, /não tem permissão para admitir/],
    [401, /Seu acesso expirou/],
    [500, /Os dados digitados foram mantidos/],
  ])(
    "%i: modal fecha, mensagem geral com foco nela e dados intactos",
    async (status, texto) => {
      vi.mocked(admitirColaborador).mockRejectedValue(recusa(status));
      montar();
      await aguardarEmpresa();
      preencherValido();
      await salvarEConfirmar();
      const alerta = await screen.findByText(texto);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(dialogoConfirmacao()).toBeNull();
      expect(matricula()).toHaveValue("MAT-0900");
      expect(unidadeSel()).toHaveValue(unidade.id);
    },
  );

  it("erro de rede: diz que não se sabe se gravou, e reconfirmar usa a MESMA chave", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(resposta);
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(
      "Não foi possível confirmar se o cadastro foi gravado. Tente confirmar de novo: o mesmo envio não cria um segundo cadastro.",
    );
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(dialogoConfirmacao()).toBeNull();
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");

    await salvarEConfirmar();
    await screen.findByText("Admissão registrada");
    expect(admitirColaborador).toHaveBeenCalledTimes(2);
    expect(chaveDaChamada(0)).toEqual(expect.any(String));
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });

  it("depois da falha, corrigir e reconfirmar funciona — com a mesma chave", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(
        recusa(409, { erros: [{ campo: "matricula", motivo: "em_uso" }] }),
      )
      .mockResolvedValueOnce(resposta);
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(matricula()).toHaveFocus());
    fireEvent.change(matricula(), { target: { value: "MAT-0901" } });
    await salvarEConfirmar();
    await screen.findByText("Admissão registrada");
    expect(admitirColaborador).toHaveBeenCalledTimes(2);
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });

  it("recomeçar a página gera uma chave NOVA para a próxima admissão", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
    await screen.findByText("Admissão registrada");
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar outra admissão" }),
    );
    preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(2));
    expect(chaveDaChamada(1)).toEqual(expect.any(String));
    expect(chaveDaChamada(1)).not.toBe(chaveDaChamada(0));
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
      fireEvent.click(salvar());
      expect(dialogoConfirmacao()).toBeNull();
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );
});

describe("T179 — empresa sem Departamento ou Cargo ativos", () => {
  beforeEach(() => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([]));
    vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
  });

  it("RH: diz o que falta e orienta a cadastrar em Estrutura; nada é enviado", async () => {
    montar("rh");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    // T179 — a Unidade é opcional: faltar unidade não entra no aviso.
    expect(aviso).toHaveTextContent(
      "Esta empresa ainda não tem cadastro ativo de Cargo, e a admissão exige Departamento e Cargo.",
    );
    expect(aviso).toHaveTextContent(/Cadastre o que falta em Estrutura/);
    expect(aviso).toHaveTextContent(/Cargo em Funções e cargos/);
    expect(aviso).not.toHaveTextContent(/Unidade/);
    expect(aviso).not.toHaveTextContent(/O RH precisa/);
    expect(
      within(cargoSel()).getByRole("option", { name: "Nenhum cargo ativo" }),
    ).toBeInTheDocument();

    preencherContatos();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(cargoSel()).toHaveAccessibleDescription(
      /Não há cargo ativo nesta empresa/,
    );
    expect(dialogoConfirmacao()).toBeNull();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("RH: sem departamento e sem cargo, aponta cada um ao seu lugar", async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    expect(aviso).toHaveTextContent(
      "Esta empresa ainda não tem cadastro ativo de Departamento e Cargo",
    );
    expect(aviso).toHaveTextContent(/Departamento em Estrutura organizacional/);
    expect(aviso).toHaveTextContent(/Cargo em Funções e cargos/);
  });

  it("DP: diz que o RH precisa cadastrar o que falta", async () => {
    montar("dp");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    expect(aviso).toHaveTextContent(
      /O RH precisa cadastrar Cargo nesta empresa/,
    );
    expect(aviso).not.toHaveTextContent(/Unidade/);
    expect(aviso).not.toHaveTextContent(/Cadastre o que falta/);
    fireEvent.click(salvar());
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("com as três referências ativas, não há aviso", async () => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([cargo]));
    vi.mocked(listarUnidades).mockResolvedValue(paginado([unidade]));
    montar("dp");
    await aguardarEmpresa();
    expect(screen.queryByText(/ainda não tem cadastro ativo de/)).toBeNull();
  });

  it("T179 — sem unidade ativa: não há aviso, o seletor diz isso e a admissão segue sem unidade", async () => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([cargo]));
    montar("rh");
    await aguardarEmpresa();
    expect(screen.queryByText(/ainda não tem cadastro ativo de/)).toBeNull();
    expect(
      within(unidadeSel()).getByRole("option", {
        name: "Nenhuma unidade ativa",
      }),
    ).toBeInTheDocument();
    preencherContatos();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.change(departamentoSel(), { target: { value: departamento.id } });
    fireEvent.change(cargoSel(), { target: { value: cargo.id } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      Object.keys(vi.mocked(admitirColaborador).mock.calls[0]![0]),
    ).not.toContain("unidadeOrganizacionalId");
  });
});

describe("T179 — máscaras na Nova admissão", () => {
  it("celular e telefone: máscara brasileira progressiva, dica de formato e colagem com +55", async () => {
    montar();
    await aguardarEmpresa();
    expect(celular()).toHaveAttribute("inputmode", "tel");
    expect(celular()).toHaveAccessibleDescription(/\(00\) 00000-0000/);
    fireEvent.change(celular(), { target: { value: "31999" } });
    expect(celular()).toHaveValue("(31) 999");
    fireEvent.change(celular(), { target: { value: "" } });
    fireEvent.paste(celular(), {
      clipboardData: { getData: () => "+55 31 99999-0000" },
    });
    expect(celular()).toHaveValue("(31) 99999-0000");
    fireEvent.change(telefone(), { target: { value: "553133330000" } });
    expect(telefone()).toHaveValue("(31) 3333-0000");
  });

  it("T179 (B1): +55 digitado tecla a tecla, com DDD comum e com DDD iniciado por 9, chega certo ao servidor", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    const teclar = (campo: HTMLElement, texto: string) => {
      fireEvent.change(campo, { target: { value: "" } });
      for (const tecla of texto) {
        const atual = (campo as HTMLInputElement).value;
        fireEvent.change(campo, { target: { value: atual + tecla } });
      }
    };
    teclar(celular(), "+55 91 98765-4321");
    teclar(telefone(), "+55 11 3333-0000");
    expect(celular()).toHaveValue("(91) 98765-4321");
    expect(telefone()).toHaveValue("(11) 3333-0000");
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.contatos?.celular).toBe("+5591987654321");
    expect(dto.contatos?.telefone).toBe("+551133330000");
  });

  it("T179 (B2): +55 digitado e o resto colado, e DDD 55 completo com dígitos a mais, chegam certos ao servidor", async () => {
    montar();
    await aguardarEmpresa();
    preencherValido();
    const teclar = (campo: HTMLElement, texto: string) => {
      for (const tecla of texto) {
        const atual = (campo as HTMLInputElement).value;
        fireEvent.change(campo, { target: { value: atual + tecla } });
      }
    };
    // Celular: `+55` tecla a tecla e, depois, o resto colado.
    fireEvent.change(celular(), { target: { value: "" } });
    teclar(celular(), "+55");
    expect(celular()).toHaveValue("+55");
    const c = celular() as HTMLInputElement;
    c.setSelectionRange(c.value.length, c.value.length);
    fireEvent.paste(celular(), {
      clipboardData: { getData: () => "91 98765-4321" },
    });
    expect(celular()).toHaveValue("(91) 98765-4321");
    // Telefone: DDD 55 completo e dois dígitos a mais — recusados, com aviso.
    fireEvent.change(telefone(), { target: { value: "" } });
    teclar(telefone(), "55999998888");
    teclar(telefone(), "12");
    expect(telefone()).toHaveValue("(55) 99999-8888");
    expect(telefone()).toHaveAccessibleDescription(/O número já está completo/);
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.contatos?.celular).toBe("+5591987654321");
    expect(dto.contatos?.telefone).toBe("+5555999998888");
  });

  it("CEP: máscara 00000-000 só com país Brasil", async () => {
    montar();
    await aguardarEmpresa();
    const cep = () => screen.getByLabelText(/^CEP/);
    expect(cep()).toHaveAttribute("inputmode", "numeric");
    expect(cep()).toHaveAccessibleDescription(/Formato 00000-000/);
    fireEvent.change(cep(), { target: { value: "301400" } });
    expect(cep()).toHaveValue("30140-0");
    fireEvent.change(pais(), { target: { value: "Portugal" } });
    expect(cep()).not.toHaveAttribute("inputmode");
    fireEvent.change(cep(), { target: { value: "1000-001 A" } });
    expect(cep()).toHaveValue("1000-001 A");
  });
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

  it("escolher só uma referência da lotação já conta como alteração", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(cargoSel(), { target: { value: cargo.id } });
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
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(409, { erros: [{ campo: "matricula", motivo: "em_uso" }] }),
    );
    montar();
    await aguardarEmpresa();
    preencherValido();
    await salvarEConfirmar();
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
    await salvarEConfirmar();
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
    expect(
      screen.getByText("Cargo: CAR1 — Cargo Sintético (teste)"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unidade: UNI1 — Unidade Sintética (teste)"),
    ).toBeInTheDocument();
    // Módulo 1: o que o SERVIDOR gravou, bloco a bloco.
    const dadosPessoais = screen.getByRole("region", {
      name: "Dados pessoais",
    });
    expect(dadosPessoais).toHaveTextContent("20/05/1990");
    expect(dadosPessoais).toHaveTextContent("Feminino");
    expect(dadosPessoais).not.toHaveTextContent("feminino");
    expect(dadosPessoais).toHaveTextContent("Mãe Sintética Servidor");
    expect(dadosPessoais).toHaveTextContent("Não informado");
    const enderecoGravado = screen.getByRole("region", { name: "Endereço" });
    expect(enderecoGravado).toHaveTextContent("Cidade Sintética");
    // T179 — gravado em 8 dígitos, exibido 00000-000.
    expect(enderecoGravado).toHaveTextContent("30140-071");
    const contatosGravados = screen.getByRole("region", { name: "Contatos" });
    expect(contatosGravados).toHaveTextContent("pessoa.servidor@exemplo.test");
    // T179 — gravados em +55, exibidos na forma brasileira.
    expect(contatosGravados).toHaveTextContent("(31) 99999-0000");
    expect(contatosGravados).toHaveTextContent("(31) 3333-0000");
    expect(contatosGravados).not.toHaveTextContent("+55");
    expectSemIsoVisivel(document.body);
  });

  it("T179 — sem matrícula, unidade nem contatos gravados: a confirmação diz isso, sem 'null'", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue({
      ...resposta,
      vinculo: { ...resposta.vinculo, matricula: null },
      movimentacao: {
        ...resposta.movimentacao,
        destino: {
          ...resposta.movimentacao.destino,
          unidadeOrganizacionalId: null,
        },
      },
      perfilPessoal: { ...resposta.perfilPessoal, sexo: null },
      contatos: null,
    });
    await admitirComSucesso();
    const matriculaGravada = screen.getByText("Matrícula", {
      selector: "dt",
    }).nextElementSibling;
    expect(matriculaGravada).toHaveTextContent("Não informada");
    expect(screen.getByText("Unidade: Não informada")).toBeInTheDocument();
    const sexoGravado = within(
      screen.getByRole("region", { name: "Dados pessoais" }),
    ).getByText("Sexo", { selector: "dt" }).nextElementSibling;
    expect(sexoGravado).toHaveTextContent("Não informado");
    expect(screen.getByRole("region", { name: "Contatos" })).toHaveTextContent(
      "Nada informado neste bloco.",
    );
    expect(document.body).not.toHaveTextContent("null");
  });

  it("T179 — contato gravado nulo aparece como 'Não informado'", async () => {
    vi.mocked(admitirColaborador).mockResolvedValue({
      ...resposta,
      contatos: { ...resposta.contatos!, emailPessoal: null, telefone: null },
    });
    await admitirComSucesso();
    const contatos = screen.getByRole("region", { name: "Contatos" });
    expect(contatos).toHaveTextContent("(31) 99999-0000");
    expect(within(contatos).getAllByText("Não informado")).toHaveLength(2);
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
    expect(celular()).toHaveValue("");
    expect(departamentoSel()).toHaveValue("");
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

// ---------------------------------------------------------------------------
// T178 — preenchimento ASSISTIDO do endereço pelo CEP (autorizado pela
// proprietária: só CEP brasileiro, campos editáveis, cadastro manual como
// alternativa). O cliente de CEP é automockado: nenhum teste sai da página.
// ---------------------------------------------------------------------------

const campoCep = () => screen.getByLabelText(/^CEP/);
const logradouro = () => screen.getByLabelText(/^Logradouro/);
const numero = () => screen.getByLabelText(/^Número/);
const complemento = () => screen.getByLabelText(/^Complemento/);
const bairro = () => screen.getByLabelText(/^Bairro/);
const cidade = () => screen.getByLabelText(/^Cidade/);
const estado = () => screen.getByLabelText(/^Estado \(opcional\)$/);
const botaoBuscarCep = () => screen.queryByRole("button", { name: /CEP…?$/ });
const statusCep = () => document.getElementById("nova-admissao-cep-status");

const RESPOSTA_CEP: EnderecoDoCepApi = {
  cep: "30140071",
  logradouro: "Avenida Sintética",
  bairro: "Bairro Sintético",
  cidade: "Cidade Sintética",
  uf: "MG",
  estado: "Minas Gerais",
};

/** Recusa por status, como o cliente real lança (lida por forma na tela). */
function recusaCep(status: number): Error {
  return Object.assign(new Error(`recusa ${status}`), { status });
}

function digitarCep(valor: string) {
  fireEvent.change(campoCep(), { target: { value: valor } });
}

describe("T178 — CEP: quando consulta", () => {
  beforeEach(() => {
    vi.mocked(consultarCep).mockReset();
    vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
  });

  it("'Buscar CEP' consulta com os 8 dígitos; o campo fica na máscara 00000-000", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep(" 30.140-071 ");
    // T179 — a máscara limpa pontos e espaços já na digitação.
    expect(campoCep()).toHaveValue("30140-071");
    fireEvent.click(botaoBuscarCep()!);

    await waitFor(() => expect(consultarCep).toHaveBeenCalledWith("30140071"));
    expect(consultarCep).toHaveBeenCalledTimes(1);
    expect(campoCep()).toHaveValue("30140-071");
  });

  it("digitar não consulta; sair do campo com CEP completo consulta UMA vez", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("3014");
    digitarCep("30140-071");
    expect(consultarCep).not.toHaveBeenCalled();

    fireEvent.blur(campoCep());
    await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));

    // O mesmo CEP de novo: sair do campo não repergunta.
    fireEvent.focus(campoCep());
    fireEvent.blur(campoCep());
    expect(consultarCep).toHaveBeenCalledTimes(1);
  });

  it("sair do campo com CEP incompleto não consulta nem acusa erro", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("30140-07");
    fireEvent.blur(campoCep());
    expect(consultarCep).not.toHaveBeenCalled();
    expect(campoCep()).not.toHaveAttribute("aria-invalid");
  });

  it("'Buscar CEP' com CEP incompleto: mensagem no campo, sem consultar", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("3014");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() =>
      expect(campoCep()).toHaveAccessibleDescription(
        /Informe os 8 dígitos do CEP/,
      ),
    );
    expect(consultarCep).not.toHaveBeenCalled();
  });

  it("com outro país não há botão e nada é consultado", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(pais(), { target: { value: "Portugal" } });
    expect(botaoBuscarCep()).toBeNull();
    expect(statusCep()).toBeNull();
    digitarCep("30140071");
    fireEvent.blur(campoCep());
    expect(consultarCep).not.toHaveBeenCalled();
  });

  it("'Brasil' é reconhecido sem diferenciar caixa, acento e espaços", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(pais(), { target: { value: "  BRASÍL " } });
    expect(botaoBuscarCep()).not.toBeNull();
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(1));
  });

  it("durante a busca o botão fica travado: duplo clique é UMA consulta", async () => {
    let concluir: (v: EnderecoDoCepApi) => void = () => {};
    vi.mocked(consultarCep).mockImplementation(
      () =>
        new Promise<EnderecoDoCepApi>((resolve) => {
          concluir = resolve;
        }),
    );
    montar();
    await aguardarEmpresa();
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);
    const botao = await screen.findByRole("button", { name: "Buscando CEP…" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(consultarCep).toHaveBeenCalledTimes(1);

    await act(async () => concluir(RESPOSTA_CEP));
    expect(screen.getByRole("button", { name: "Buscar CEP" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("resposta obsoleta (o CEP mudou durante a busca) é descartada", async () => {
    let concluir: (v: EnderecoDoCepApi) => void = () => {};
    vi.mocked(consultarCep).mockImplementationOnce(
      () =>
        new Promise<EnderecoDoCepApi>((resolve) => {
          concluir = resolve;
        }),
    );
    montar();
    await aguardarEmpresa();
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);
    await screen.findByRole("button", { name: "Buscando CEP…" });

    digitarCep("01310100");
    await act(async () => concluir(RESPOSTA_CEP));

    expect(logradouro()).toHaveValue("");
    expect(cidade()).toHaveValue("");
    expect(statusCep()).toHaveTextContent("");
  });
});

describe("T178 — CEP: o que faz com a resposta", () => {
  beforeEach(() => {
    vi.mocked(consultarCep).mockReset();
    vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
  });

  it("preenche os vazios (estado pela sigla) e nunca toca número nem complemento", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(numero(), { target: { value: "100" } });
    fireEvent.change(complemento(), { target: { value: "Sala 2" } });
    digitarCep("30140-071");
    fireEvent.click(botaoBuscarCep()!);

    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));
    expect(bairro()).toHaveValue("Bairro Sintético");
    expect(cidade()).toHaveValue("Cidade Sintética");
    expect(estado()).toHaveValue("MG");
    expect(numero()).toHaveValue("100");
    expect(complemento()).toHaveValue("Sala 2");
    expect(pais()).toHaveValue("Brasil");
    expect(statusCep()).toHaveAttribute("role", "status");
    expect(statusCep()).toHaveTextContent(/Endereço sugerido pelo CEP/);
    expect(
      screen.queryByRole("button", { name: "Usar endereço do CEP" }),
    ).toBeNull();
  });

  it("sem sigla, o estado vem por extenso", async () => {
    vi.mocked(consultarCep).mockResolvedValue({ ...RESPOSTA_CEP, uf: null });
    montar();
    await aguardarEmpresa();
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() => expect(estado()).toHaveValue("Minas Gerais"));
  });

  it("campo já digitado é mantido, com aviso; 'Usar endereço do CEP' substitui", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(logradouro(), { target: { value: "Rua Já Digitada" } });
    // Igual ao sugerido, a menos de caixa: não conta como conflito.
    fireEvent.change(bairro(), { target: { value: "bairro sintético" } });
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);

    await waitFor(() => expect(cidade()).toHaveValue("Cidade Sintética"));
    expect(logradouro()).toHaveValue("Rua Já Digitada");
    expect(bairro()).toHaveValue("bairro sintético");
    expect(statusCep()).toHaveTextContent(
      /já estava digitado foi mantido em Logradouro\./,
    );
    expect(statusCep()).not.toHaveTextContent(/mantido em .*Bairro/);

    fireEvent.click(
      screen.getByRole("button", { name: "Usar endereço do CEP" }),
    );
    expect(logradouro()).toHaveValue("Avenida Sintética");
    expect(bairro()).toHaveValue("bairro sintético");
    expect(statusCep()).toHaveTextContent(/aplicado em Logradouro/);
    expect(
      screen.queryByRole("button", { name: "Usar endereço do CEP" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Buscar CEP" })).toHaveFocus();
  });

  it("os campos seguem editáveis e a admissão leva o valor editado", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("30140-071");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));

    fireEvent.change(logradouro(), { target: { value: "Avenida Editada" } });
    preencherValido();
    await salvarEConfirmar();

    await waitFor(() => expect(admitirColaborador).toHaveBeenCalled());
    const dto = vi.mocked(admitirColaborador).mock.calls.at(-1)![0];
    expect(dto.endereco).toMatchObject({
      pais: "Brasil",
      cep: "30140071",
      logradouro: "Avenida Editada",
      bairro: "Bairro Sintético",
      cidade: "Cidade Sintética",
      estado: "MG",
      numero: null,
      complemento: null,
    });
    // Só o CEP saiu para a consulta — nenhum dado da pessoa.
    expect(vi.mocked(consultarCep).mock.calls).toEqual([["30140071"]]);
  });

  it.each([
    [404, "CEP não encontrado. Preencha o endereço manualmente."],
    [
      503,
      "Não foi possível consultar o CEP agora. Preencha o endereço manualmente ou tente de novo.",
    ],
    [
      429,
      "Muitas consultas de CEP em pouco tempo. Aguarde alguns minutos ou preencha manualmente.",
    ],
    [400, "CEP inválido. Use os 8 dígitos."],
    [
      403,
      "A consulta de CEP está indisponível agora. Preencha o endereço manualmente.",
    ],
  ])(
    "recusa %s: mensagem clara, e a admissão segue sendo enviada",
    async (status, mensagem) => {
      vi.mocked(consultarCep).mockRejectedValue(recusaCep(status));
      montar();
      await aguardarEmpresa();
      digitarCep("30140071");
      fireEvent.click(botaoBuscarCep()!);
      await waitFor(() => expect(statusCep()).toHaveTextContent(mensagem));
      // Não bloqueia: o CEP não fica inválido e o cadastro manual segue.
      expect(campoCep()).not.toHaveAttribute("aria-invalid");
      fireEvent.change(cidade(), { target: { value: "Cidade Manual" } });

      preencherValido();
      await salvarEConfirmar();
      await waitFor(() => expect(admitirColaborador).toHaveBeenCalled());
      const dto = vi.mocked(admitirColaborador).mock.calls.at(-1)![0];
      expect(dto.endereco).toMatchObject({
        cep: "30140071",
        cidade: "Cidade Manual",
      });
    },
  );
});
