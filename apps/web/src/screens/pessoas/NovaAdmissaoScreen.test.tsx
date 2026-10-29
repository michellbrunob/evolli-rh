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
import { listarTabelasHorario } from "../../api/horariosClient";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  admitirColaborador,
} from "../../api/colaboradoresClient";
import {
  type DepartamentoApi,
  type EmpresaApi,
  type UnidadeOrganizacionalApi,
  criarDepartamento,
  criarUnidade,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, criarCargo, listarCargos } from "../../api/cargoClient";
import { type EnderecoDoCepApi, consultarCep } from "../../api/cepClient";
import {
  CsrfRequestError,
  CsrfSessionExpiredError,
} from "../../api/csrfClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");
// T183 — a jornada opcional lê as jornadas ativas (só para o RH).
vi.mock("../../api/horariosClient");
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
  vi.mocked(listarTabelasHorario).mockResolvedValue({
    itens: [],
    pagina: 1,
    tamanhoPagina: 100,
    total: 0,
  });
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

/** T196 — a linha "Escolha atual" de um seletor pesquisável. */
const escolhaDe = (campo: HTMLElement) =>
  document.getElementById(`${campo.id}-escolha`)!;

/** T196 — a lista de resultados de um seletor pesquisável. */
const listaDe = (campo: HTMLElement) =>
  document.getElementById(campo.getAttribute("aria-controls")!)!;

/**
 * T196 — escolhe uma referência no seletor pesquisável, como quem usa o
 * teclado: seta para baixo abre a lista (consulta ao servidor) e a opção é
 * clicada.
 */
async function escolher(campo: HTMLElement, referencia: { codigo: string }) {
  fireEvent.keyDown(campo, { key: "ArrowDown" });
  fireEvent.click(
    await within(listaDe(campo)).findByRole("option", {
      name: new RegExp(`^${referencia.codigo} — `),
      // Como os demais preenchimentos, vale também com a etapa 2 oculta.
      hidden: true,
    }),
  );
}
/** T195 — o título da etapa na tela ("Etapa N de 4: …"). */
const tituloDaEtapa = () =>
  screen.getByRole("heading", { level: 2, name: /^Etapa \d de 4/ });

/**
 * T195 — "Continuar" até a etapa cujo título termina em `titulo`. Falha se
 * alguma etapa do caminho não deixar avançar.
 */
function irAteEtapa(titulo: string) {
  const naEtapa = () => tituloDaEtapa().textContent?.endsWith(titulo) ?? false;
  if (naEtapa()) return;
  // Etapa já alcançada: pelo indicador (que, adiante, valida o caminho).
  const atalho = within(
    screen.getByRole("navigation", { name: "Etapas do cadastro" }),
  ).queryByRole("button", { name: new RegExp(`^Etapa \\d: ${titulo},`) });
  if (atalho) fireEvent.click(atalho);
  while (!naEtapa()) {
    const antes = tituloDaEtapa().id;
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    if (tituloDaEtapa().id === antes) {
      throw new Error(`A etapa ${antes} não deixou avançar até ${titulo}.`);
    }
  }
}

/**
 * T179 — "Salvar" só valida e abre a confirmação. T195 — o caminho virou o
 * das etapas: "Continuar" até a revisão, parando na etapa que tiver erro, e
 * nela "Confirmar admissão". Devolve o botão a clicar: na revisão, "Confirmar
 * admissão"; parado numa etapa com erro, o "Continuar" dela, que repete a
 * validação da etapa.
 */
function salvar(): HTMLElement {
  for (;;) {
    const confirmar = screen.queryByRole("button", {
      name: "Confirmar admissão",
    });
    if (confirmar) return confirmar;
    const continuar = screen.getByRole("button", { name: "Continuar" });
    const antes = tituloDaEtapa().id;
    fireEvent.click(continuar);
    if (tituloDaEtapa().id === antes) return continuar;
  }
}
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
async function preencherLotacao() {
  await escolher(departamentoSel(), departamento);
  await escolher(cargoSel(), cargo);
  await escolher(unidadeSel(), unidade);
}

async function preencherValido() {
  preencherContatos();
  fireEvent.change(nome(), { target: { value: "  Pessoa Sintética Nova " } });
  fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
  fireEvent.change(matricula(), { target: { value: "mat-0900" } });
  fireEvent.change(tipo(), { target: { value: "clt" } });
  fireEvent.change(data(), { target: { value: "2026-11-03" } });
  await preencherLotacao();
}

/**
 * T195 — leva à etapa 2 (Dados profissionais e lotação). Os obrigatórios da
 * etapa 1 ainda vazios recebem um valor sintético; o já digitado fica.
 */
function abrirLotacao() {
  if (tituloDaEtapa().textContent?.endsWith("Dados profissionais e lotação")) {
    return;
  }
  if (!(nome() as HTMLInputElement).value) {
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética Etapas" } });
  }
  if (!(dataNascimento() as HTMLInputElement).value) {
    fireEvent.change(dataNascimento(), { target: { value: "1992-03-04" } });
  }
  irAteEtapa("Dados profissionais e lotação");
}

/** T195 — leva à etapa 3 (Endereço), com os obrigatórios preenchidos. */
async function abrirEndereco() {
  await preencherValido();
  irAteEtapa("Endereço");
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

  it("T195 — quatro etapas na ordem, cada uma com os seus blocos; só a atual aparece", async () => {
    montar();
    await aguardarEmpresa();
    const etapas = [
      ...document.querySelectorAll<HTMLElement>("section.nova-admissao__etapa"),
    ];
    expect(etapas.map((e) => e.querySelector("h2")!.textContent)).toEqual([
      "Etapa 1 de 4: Dados básicos",
      "Etapa 2 de 4: Dados profissionais e lotação",
      "Etapa 3 de 4: Endereço",
      "Etapa 4 de 4: Revisão e conclusão",
    ]);
    expect(
      etapas.map((e) =>
        [...e.querySelectorAll("h3")].map((h) => h.textContent),
      ),
    ).toEqual([
      ["Dados pessoais", "Contatos"],
      // T183 — a jornada é opcional, só para o RH.
      ["Vínculo", "Lotação inicial", "Jornada de trabalho"],
      [],
      [
        "Dados básicos",
        "Dados profissionais e lotação",
        "Endereço",
        "Documentos",
      ],
    ]);
    // Montadas todas, visível só a atual: nada se perde ao trocar de etapa.
    expect(etapas.map((e) => e.hidden)).toEqual([false, true, true, true]);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Empresa", "Etapa 1 de 4: Dados básicos"]);
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

  it("continuar vazio: erros só da etapa atual, ancorados nos campos, foco no primeiro; nada enviado", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(nome()).toHaveAttribute("aria-invalid", "true");
    expect(nome()).toHaveAccessibleDescription(/Nome é obrigatório/);
    expect(dataNascimento()).toHaveAccessibleDescription(
      /Informe a data de nascimento/,
    );
    // T195 — a etapa 2 ainda não foi validada: nada acusa lá.
    for (const campo of [tipo, data, departamentoSel, cargoSel]) {
      expect(campo()).not.toHaveAttribute("aria-invalid");
    }

    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(tipo()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    expect(tipo()).toHaveAccessibleDescription(/Selecione o tipo de vínculo/);
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(departamentoSel()).toHaveAccessibleDescription(
      /Selecione o departamento/,
    );
    expect(cargoSel()).toHaveAccessibleDescription(/Selecione o cargo/);
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
    await preencherValido();
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
    await escolher(departamentoSel(), departamento);
    fireEvent.click(salvar());
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    await escolher(cargoSel(), cargo);
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

    /**
     * Rótulos de cada linha da grade de um grupo, sem o "(opcional)". T195 —
     * os grupos são h3 dentro das etapas (montadas, ocultas fora da atual);
     * o Endereço é a própria etapa 3.
     */
    function linhasDo(grupo: string): string[][] {
      const secao =
        grupo === "Endereço"
          ? document.getElementById("nova-admissao-etapa-3-titulo")!
              .parentElement!
          : screen
              .getByRole("heading", { level: 3, name: grupo, hidden: true })
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
    // T196 — duas colunas, para o campo de busca caber ao lado dos botões:
    // os obrigatórios primeiro, a Área logo abaixo do Departamento que a
    // filtra, os demais opcionais depois.
    expect(linhasDo("Lotação inicial")).toEqual([
      ["Departamento", "Cargo"],
      ["Área", "Unidade"],
      ["Equipe", "Centro de custo"],
    ]);

    // Classes de coluna: 2, 3 e a linha larga/estreita do logradouro.
    const endereco = document.getElementById(
      "nova-admissao-etapa-3-titulo",
    )!.parentElement!;
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
      "nova-admissao__linha--2",
    );
  });

  it("T178 — o e-mail pessoal está em Dados pessoais e continua indo em `contatos.emailPessoal`", async () => {
    montar();
    await aguardarEmpresa();

    const dadosPessoais = screen
      .getByRole("heading", { level: 3, name: "Dados pessoais" })
      .closest("section")!;
    const contatosSecao = screen
      .getByRole("heading", { level: 3, name: "Contatos" })
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

    await preencherValido();
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
      await preencherValido();
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
    await preencherValido();
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
    expect(dataNascimento()).toHaveAttribute("aria-invalid", "true");
  });

  it("envia exatamente o contrato: empresa da sessão, matrícula normalizada, Departamento, Cargo e Unidade, e a chave do envio", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
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
    await escolher(departamentoSel(), departamento);
    await escolher(cargoSel(), cargo);
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
    await preencherValido();
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
    await preencherValido();
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
    await preencherValido();
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
    await preencherValido();
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
    await preencherValido();
    abrirLotacao();
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
    abrirLotacao();
    await escolher(departamentoSel(), departamento);
    await screen.findByRole("option", { name: /ARE1/ });
    fireEvent.change(areaSel(), {
      target: { value: "66666666-6666-6666-6666-666666666666" },
    });
    await escolher(departamentoSel(), outro);
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
    await preencherValido();
    abrirLotacao();
    expect(
      within(equipeSel()).getByRole("option", {
        name: "EQP1 — Equipe Sintética (teste)",
      }),
    ).toBeInTheDocument();
    fireEvent.change(equipeSel(), {
      target: { value: "99999999-9999-4999-8999-999999999999" },
    });
    await escolher(centroSel(), { codigo: "CC1" });
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
    abrirLotacao();
    // T196 — a busca pede só ativos ao servidor, 20 por página.
    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    await within(listaDe(cargoSel())).findByRole("option", {
      name: /^CAR1 — /,
    });
    expect(listarCargos).toHaveBeenLastCalledWith({
      status: "ativo",
      tamanhoPagina: 20,
      pagina: 1,
    });
    // Defesa do cliente: o inativo devolvido indevidamente não vira opção.
    expect(
      within(listaDe(cargoSel()))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["CAR1 — Cargo Sintético (teste)"]);
  });

  // T196 — a defesa vale para as quatro referências da busca: a consulta
  // comum pede só ativos ao servidor e ainda descarta inativo devolvido
  // indevidamente, descontando-o da contagem exibida.
  it.each([
    {
      rotulo: "Departamento",
      campo: () => departamentoSel(),
      listar: listarDepartamentos,
      ativo: departamento,
    },
    {
      rotulo: "Cargo",
      campo: () => cargoSel(),
      listar: listarCargos,
      ativo: cargo,
    },
    {
      rotulo: "Unidade",
      campo: () => unidadeSel(),
      listar: listarUnidades,
      ativo: unidade,
    },
    {
      rotulo: "Centro de custo",
      campo: () => centroSel(),
      listar: listarCentrosCusto,
      ativo: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        codigo: "CC1",
        nome: "Centro Sintético (teste)",
        status: "ativo",
      },
    },
  ] as const)(
    "$rotulo: só ativos viram opção, mesmo se o servidor devolver um inativo",
    async ({ campo, listar, ativo }) => {
      vi.mocked(listar as typeof listarCargos).mockResolvedValue(
        paginado([
          ativo,
          { ...ativo, id: "inativo-1", codigo: "INATIVA", status: "inativo" },
        ]) as never,
      );
      montar();
      await aguardarEmpresa();
      abrirLotacao();
      fireEvent.keyDown(campo(), { key: "ArrowDown" });
      await within(listaDe(campo())).findByRole("option", {
        name: new RegExp(`^${ativo.codigo} — `),
      });
      expect(listar).toHaveBeenLastCalledWith({
        status: "ativo",
        tamanhoPagina: 20,
        pagina: 1,
      });
      expect(
        within(listaDe(campo()))
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual([`${ativo.codigo} — ${ativo.nome}`]);
      // O total anunciado desconta o inativo retirado (texto exato).
      await waitFor(() =>
        expect(
          campo()
            .closest(".seletor-referencia")!
            .querySelector('[role="status"]')?.textContent,
        ).toBe("1 resultado."),
      );
    },
  );

  // T196 — a paginação segue o total e a página do servidor; a defesa do
  // cliente só tira opções e desconta, da contagem exibida, os descartados de
  // todas as páginas carregadas. Servidor dublê de 20 em 20.
  const cargoAtivo = (n: number) => ({
    ...cargo,
    id: `cargo-${n}`,
    codigo: `CA${String(n).padStart(2, "0")}`,
    nome: `Cargo ${n} (teste)`,
  });
  const cargoInativo = (n: number) => ({
    ...cargo,
    id: `inativo-${n}`,
    codigo: `IN${String(n).padStart(2, "0")}`,
    nome: `Inativo ${n} (teste)`,
    status: "inativo",
  });
  const faixa = <T,>(de: number, ate: number, f: (n: number) => T) =>
    Array.from({ length: ate - de + 1 }, (_, k) => f(de + k));

  /**
   * Abre o Cargo e clica "Mostrar mais" até o fim. `contagens` é o anúncio
   * EXATO de cada página (comparação por igualdade: um trecho não basta) e
   * diz quantas páginas devem ser pedidas. `total` é o total que o servidor
   * informa (padrão: o tamanho real da lista).
   */
  async function paginarAteOFim({
    lista,
    contagens,
    total = lista.length,
  }: {
    lista: readonly ReturnType<typeof cargoAtivo>[];
    contagens: readonly string[];
    total?: number;
  }) {
    vi.mocked(listarCargos).mockImplementation(async (q = {}) => {
      const pagina = q.pagina ?? 1;
      const tamanho = q.tamanhoPagina ?? 20;
      return {
        itens: lista.slice((pagina - 1) * tamanho, pagina * tamanho),
        total,
        pagina,
        tamanhoPagina: tamanho,
      };
    });
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    const raiz = cargoSel().closest(".seletor-referencia") as HTMLElement;
    const status = () => raiz.querySelector('[role="status"]')?.textContent;
    const buscas = () =>
      vi
        .mocked(listarCargos)
        .mock.calls.filter(([q]) => q?.tamanhoPagina === 20);
    const ativosDaLista = lista
      .filter((c) => c.status === "ativo")
      .map((c) => `${c.codigo} — ${c.nome}`);

    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    await waitFor(() => expect(status()).toBe(contagens[0]));
    for (let pagina = 2; pagina <= contagens.length; pagina += 1) {
      const mais = within(raiz).getByRole("button", { name: "Mostrar mais" });
      mais.focus();
      fireEvent.click(mais);
      await waitFor(() => expect(status()).toBe(contagens[pagina - 1]));
    }

    // Todas as páginas do servidor foram pedidas, cada uma uma vez, só ativos.
    expect(buscas().map(([q]) => q)).toEqual(
      contagens.map((_, k) => ({
        status: "ativo",
        tamanhoPagina: 20,
        pagina: k + 1,
      })),
    );
    // Só ativos viraram opção, e todos eles.
    expect(
      within(listaDe(cargoSel()))
        .queryAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(ativosDaLista);
    // Fim: o botão some, nada mais é pedido e o foco volta ao campo.
    expect(
      within(raiz).queryByRole("button", { name: /Mostrar mais|Carregando/ }),
    ).toBeNull();
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    expect(buscas()).toHaveLength(contagens.length);
  }

  it.each([
    {
      caso: "um inativo na primeira página",
      lista: [cargoInativo(1), ...faixa(1, 40, cargoAtivo)],
      contagens: [
        "40 resultados; 19 exibidos.",
        "40 resultados; 39 exibidos.",
        "40 resultados; 40 exibidos.",
      ],
    },
    {
      caso: "um inativo numa página intermediária",
      lista: [
        ...faixa(1, 20, cargoAtivo),
        cargoInativo(1),
        ...faixa(21, 40, cargoAtivo),
      ],
      contagens: [
        "41 resultados; 20 exibidos.",
        "40 resultados; 39 exibidos.",
        "40 resultados; 40 exibidos.",
      ],
    },
    {
      // A página filtrada a zero opções pela defesa NÃO encerra: a seguinte,
      // com os ativos, ainda é pedida.
      caso: "uma página inteira de inativos seguida de ativos",
      lista: [...faixa(1, 20, cargoInativo), ...faixa(1, 5, cargoAtivo)],
      contagens: ["5 resultados; 0 exibidos.", "5 resultados; 5 exibidos."],
    },
    {
      caso: "sem inativos",
      lista: faixa(1, 45, cargoAtivo),
      contagens: [
        "45 resultados; 20 exibidos.",
        "45 resultados; 40 exibidos.",
        "45 resultados; 45 exibidos.",
      ],
    },
  ])(
    "paginação com $caso: carrega até a última página do servidor e termina",
    paginarAteOFim,
  );

  // T196 — o servidor informa um total maior do que tem: a página que ele
  // devolve vazia encerra (as opções já carregadas ficam), sem pedir as
  // páginas que o total sugeria.
  it("paginação: página vazia do servidor encerra, mesmo com total informado maior", async () => {
    await paginarAteOFim({
      lista: faixa(1, 25, cargoAtivo),
      total: 100,
      contagens: [
        "100 resultados; 20 exibidos.",
        "100 resultados; 25 exibidos.",
        "25 resultados; 25 exibidos.",
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// T179 — confirmação antes de gravar.
// ---------------------------------------------------------------------------
describe("T179 — confirmação antes de gravar", () => {
  it("só 'Salvar' não envia: abre a confirmação com o título e as duas ações", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
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
    await abrirEndereco();
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
    await preencherValido();
    fireEvent.change(matricula(), { target: { value: "" } });
    abrirLotacao();
    fireEvent.click(screen.getByRole("button", { name: "Limpar Unidade" }));
    expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
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
    await abrirEndereco();
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
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    expect(escolhaDe(cargoSel())).toHaveTextContent(
      `${cargo.codigo} — ${cargo.nome}`,
    );
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(screen.getByLabelText(/^CEP/)).toHaveValue("30140-071");
    expect(
      document.getElementById("nova-admissao-cep-status"),
    ).toHaveTextContent(/Endereço sugerido pelo CEP/);
  });

  it("Escape faz o mesmo que 'Voltar e revisar'", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
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
    await preencherValido();
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
      await preencherValido();
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
    await preencherValido();
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
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    expect(escolhaDe(cargoSel())).toHaveTextContent(
      `${cargo.codigo} — ${cargo.nome}`,
    );
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
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
    await preencherValido();
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
    await preencherValido();
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
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(/conflita com um registro/);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(matricula()).not.toHaveAttribute("aria-invalid");
  });

  it("422 sem código: a lotação é apontada, com foco no aviso dela", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(422));
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const aviso = await screen.findByText(/A lotação escolhida não foi aceita/);
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(
      screen.getByRole("group", { name: "Revise 1 campo antes de confirmar" }),
    ).toHaveTextContent("Lotação inicial");
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
  });

  it("422 idempotência divergente: explica que o envio já foi registrado com outros dados", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
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
    await preencherValido();
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
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(2));
    expect(chaveDaChamada(1)).toMatch(/^[0-9a-f-]{36}$/);
    expect(chaveDaChamada(1)).not.toBe(chaveRecusada);
  });

  it("outras recusas não oferecem recomeçar", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(500));
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    // T179 (revisão final) — 5xx é envio incerto: reconfirmar, não recomeçar.
    await screen.findByText(/Não foi possível confirmar se o cadastro/);
    expect(
      screen.queryByRole("button", { name: "Recomeçar a admissão" }),
    ).toBeNull();
  });

  it.each([
    [400, /O servidor recusou algum dos dados/],
    [404, /A empresa ativa mudou/],
    [403, /não tem permissão para admitir/],
    // T179 (revisão final) — 401 é sessão expirada, com a mensagem única.
    [401, /Sua sessão expirou e o cadastro não foi gravado/],
    // T179 (revisão final) — 5xx: o servidor pode ter gravado; a mensagem é
    // a do envio incerto, que manda reconfirmar com a mesma chave.
    [500, /Não foi possível confirmar se o cadastro foi gravado/],
    [502, /Não foi possível confirmar se o cadastro foi gravado/],
    [503, /Não foi possível confirmar se o cadastro foi gravado/],
    [504, /Não foi possível confirmar se o cadastro foi gravado/],
  ])(
    "%i: modal fecha, mensagem geral com foco nela e dados intactos",
    async (status, texto) => {
      vi.mocked(admitirColaborador).mockRejectedValue(recusa(status));
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      const alerta = await screen.findByText(texto);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(dialogoConfirmacao()).toBeNull();
      expect(matricula()).toHaveValue("MAT-0900");
      expect(escolhaDe(unidadeSel())).toHaveTextContent(
        `${unidade.codigo} — ${unidade.nome}`,
      );
    },
  );

  it("erro de rede: diz que não se sabe se gravou, e reconfirmar usa a MESMA chave", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(resposta);
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(
      "Não foi possível confirmar se o cadastro foi gravado. Antes de tentar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo: o mesmo envio não cria um segundo cadastro.",
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
    await preencherValido();
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
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText("Admissão registrada");
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar outra admissão" }),
    );
    await preencherValido();
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
      await preencherValido();
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

  it('RH: diz o que falta e orienta o "+" desta página; nada é enviado', async () => {
    montar("rh");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    // T179 — a Unidade é opcional: faltar unidade não entra no aviso.
    expect(aviso).toHaveTextContent(
      "Esta empresa ainda não tem cadastro ativo de Cargo, e a admissão exige Departamento e Cargo.",
    );
    // T180 — o RH cadastra aqui mesmo, sem ir a Estrutura.
    expect(aviso).toHaveTextContent(
      'Use o botão "+" ao lado de Cargo, em Lotação inicial, para cadastrar sem sair desta página.',
    );
    expect(aviso).not.toHaveTextContent(/Estrutura/);
    expect(aviso).not.toHaveTextContent(/abra esta página de novo/);
    expect(aviso).not.toHaveTextContent(/Unidade/);
    expect(aviso).not.toHaveTextContent(/O RH precisa/);

    preencherContatos();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    abrirLotacao();
    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    expect(
      await screen.findByText("Nenhum cargo ativo nesta empresa."),
    ).toBeInTheDocument();
    fireEvent.keyDown(cargoSel(), { key: "Escape" });
    // T195 — o aviso fica no bloco da empresa, visível em toda etapa, e
    // impede sair da etapa da lotação.
    fireEvent.click(salvar());
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(cargoSel()).toHaveAccessibleDescription(
      /Não há cargo ativo nesta empresa/,
    );
    expect(dialogoConfirmacao()).toBeNull();
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it('RH: sem departamento e sem cargo, aponta o "+" de cada um', async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    expect(aviso).toHaveTextContent(
      "Esta empresa ainda não tem cadastro ativo de Departamento e Cargo",
    );
    // T180 — sem sair da página.
    expect(aviso).toHaveTextContent(
      'Use o botão "+" ao lado de Departamento e Cargo, em Lotação inicial, para cadastrar sem sair desta página.',
    );
  });

  it("DP: diz que o RH precisa cadastrar o que falta", async () => {
    montar("dp");
    await aguardarEmpresa();
    const aviso = screen.getByText(/ainda não tem cadastro ativo de/);
    expect(aviso).toHaveTextContent(
      /O RH precisa cadastrar Cargo nesta empresa/,
    );
    expect(aviso).not.toHaveTextContent(/Unidade/);
    expect(aviso).not.toHaveTextContent(/Use o botão/);
    abrirLotacao();
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
    abrirLotacao();
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    expect(
      await screen.findByText("Nenhuma unidade ativa nesta empresa."),
    ).toBeInTheDocument();
    fireEvent.keyDown(unidadeSel(), { key: "Escape" });
    preencherContatos();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    await escolher(departamentoSel(), departamento);
    await escolher(cargoSel(), cargo);
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
    await preencherValido();
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
    await preencherValido();
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
    // T179 — a 2ª recusa igual é reanunciada: o texto volta logo depois.
    await waitFor(() =>
      expect(telefone()).toHaveAccessibleDescription(
        /O número não pode passar de 11 dígitos/,
      ),
    );
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
    await escolher(cargoSel(), cargo);
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
    await preencherValido();
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
    await preencherValido();
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
    // T179 — sem contatos, o bloco usa o mesmo texto da ficha.
    expect(screen.getByRole("region", { name: "Contatos" })).toHaveTextContent(
      "Nenhum contato registrado.",
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
    expect(escolhaDe(departamentoSel())).toHaveTextContent("Nenhuma escolha.");
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
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
    digitarCep("30140-07");
    fireEvent.blur(campoCep());
    expect(consultarCep).not.toHaveBeenCalled();
    expect(campoCep()).not.toHaveAttribute("aria-invalid");
  });

  it("'Buscar CEP' com CEP incompleto: mensagem no campo, sem consultar", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
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
    await abrirEndereco();
    digitarCep("30140071");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() => expect(estado()).toHaveValue("Minas Gerais"));
  });

  it("campo já digitado é mantido, com aviso; 'Usar endereço do CEP' substitui", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
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
    await abrirEndereco();
    digitarCep("30140-071");
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));

    fireEvent.change(logradouro(), { target: { value: "Avenida Editada" } });
    await preencherValido();
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
      await abrirEndereco();
      digitarCep("30140071");
      fireEvent.click(botaoBuscarCep()!);
      await waitFor(() => expect(statusCep()).toHaveTextContent(mensagem));
      // Não bloqueia: o CEP não fica inválido e o cadastro manual segue.
      expect(campoCep()).not.toHaveAttribute("aria-invalid");
      fireEvent.change(cidade(), { target: { value: "Cidade Manual" } });

      await preencherValido();
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

// ---------------------------------------------------------------------------
// T179 (revisão final) — descarte sem afirmar o que não se sabe, CEP e
// telefone sem excedente, matrícula só de espaços fora do corpo.
// ---------------------------------------------------------------------------

const DESCARTE_COMUM =
  "Os dados digitados nesta página serão perdidos. Nada foi salvo.";
const DESCARTE_INCERTO =
  "Os dados digitados nesta página serão descartados. Um envio anterior pode ter sido registrado: confira em Colaboradores.";

describe("T179 (revisão final) — descarte depois de envio incerto", () => {
  const dialogoDescarte = () =>
    screen.getByRole("dialog", { name: "Descartar esta admissão?" });

  it("cancelamento comum: 'Nada foi salvo.'", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialogoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
  });

  it("depois de erro de rede: não afirma nem nega gravação", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    const { onSair } = montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Não foi possível confirmar se o cadastro/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = dialogoDescarte();
    expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
    expect(dialogo).not.toHaveTextContent(/Nada foi salvo/);
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Descartar e sair" }),
    );
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("depois de 422 divergente, 'Conferir em Colaboradores' também não diz 'Nada foi salvo.'", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Este envio já foi registrado antes/);
    fireEvent.click(
      screen.getByRole("button", { name: "Conferir em Colaboradores" }),
    );
    const dialogo = dialogoDescarte();
    expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
    expect(dialogo).not.toHaveTextContent(/Nada foi salvo/);
  });

  it("a dúvida fica mesmo se a tentativa seguinte for recusada por 409", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(
        recusa(409, { erros: [{ campo: "matricula", motivo: "em_uso" }] }),
      );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Não foi possível confirmar se o cadastro/);
    await salvarEConfirmar();
    await waitFor(() => expect(matricula()).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialogoDescarte()).toHaveAccessibleDescription(DESCARTE_INCERTO);
  });

  // T179 — decisão da proprietária (2026-10-22): qualquer 5xx, inclusive 500,
  // é envio incerto.
  it.each([500, 502, 504])(
    "depois de %i: não afirma que nada foi salvo, manda conferir Colaboradores e preserva o formulário",
    async (status) => {
      vi.mocked(admitirColaborador).mockRejectedValueOnce(recusa(status));
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      const alerta = await screen.findByText(
        "Não foi possível confirmar se o cadastro foi gravado. Antes de tentar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo: o mesmo envio não cria um segundo cadastro.",
      );
      expect(alerta).toHaveTextContent(/confira em Colaboradores/);
      expect(alerta).not.toHaveTextContent(/Nada foi salvo|não foi gravad/i);
      // O formulário fica como estava, pronto para reconfirmar.
      expect(nome()).not.toHaveValue("");
      expect(matricula()).toHaveValue("MAT-0900");
      expect(escolhaDe(unidadeSel())).toHaveTextContent(
        `${unidade.codigo} — ${unidade.nome}`,
      );
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
      const dialogo = dialogoDescarte();
      expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
      expect(dialogo).not.toHaveTextContent(/Nada foi salvo/);
    },
  );

  it.each([500, 502, 504])(
    "depois de %i, reconfirmar usa a MESMA chave (o servidor reconhece o reenvio)",
    async (status) => {
      vi.mocked(admitirColaborador)
        .mockRejectedValueOnce(recusa(status))
        .mockResolvedValueOnce(resposta);
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      await screen.findByText(/Não foi possível confirmar se o cadastro/);
      await salvarEConfirmar();
      await screen.findByText("Admissão registrada");
      expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
    },
  );

  it("recomeçar a página com chave nova volta ao texto comum", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Este envio já foi registrado antes/);
    fireEvent.click(
      screen.getByRole("button", { name: "Recomeçar a admissão" }),
    );
    fireEvent.change(nome(), { target: { value: "Outra Pessoa Sintética" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialogoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
  });
});

describe("T179 (revisão final) — CEP e telefone sem excedente na página", () => {
  beforeEach(() => {
    vi.mocked(consultarCep).mockReset();
    vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
  });

  function colarNoCep(posicao: number, texto: string) {
    const campo = campoCep() as HTMLInputElement;
    campo.focus();
    campo.setSelectionRange(posicao, posicao);
    fireEvent.paste(campo, { clipboardData: { getData: () => texto } });
  }

  it("'0131' + colar '04567-000': recusado com aviso, e o ViaCEP não é consultado", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    digitarCep("0131");
    colarNoCep(4, "04567-000");
    expect(campoCep()).toHaveValue("0131");
    expect(campoCep()).toHaveAccessibleDescription(/O CEP tem 8 dígitos/);
    fireEvent.blur(campoCep());
    fireEvent.click(botaoBuscarCep()!);
    await waitFor(() =>
      expect(campoCep()).toHaveAccessibleDescription(
        /Informe os 8 dígitos do CEP/,
      ),
    );
    expect(consultarCep).not.toHaveBeenCalled();
    expect(logradouro()).toHaveValue("");
  });

  it("'01310-100' + colar '9' na posição 2: recusado; só o CEP válido do campo é consultado", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("01310-100");
    colarNoCep(2, "9");
    expect(campoCep()).toHaveValue("01310-100");
    expect((campoCep() as HTMLInputElement).selectionStart).toBe(2);
    expect(campoCep()).toHaveAccessibleDescription(/O CEP tem 8 dígitos/);
    fireEvent.blur(campoCep());
    await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(1));
    expect(consultarCep).toHaveBeenCalledWith("01310100");
    expect(consultarCep).not.toHaveBeenCalledWith("01931010");
  });

  it("CEP inteiro colado no campo vazio entra, sem aviso", async () => {
    montar();
    await aguardarEmpresa();
    colarNoCep(0, "01310-100");
    expect(campoCep()).toHaveValue("01310-100");
    expect(campoCep()).not.toHaveAccessibleDescription(/O CEP tem 8 dígitos/);
  });

  it("telefone de DDD 55 completo com dígitos soltos de uma vez: recusado e chega intacto ao servidor", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.change(telefone(), { target: { value: "(55) 99999-8888" } });
    fireEvent.change(telefone(), { target: { value: "(55) 99999-888877" } });
    expect(telefone()).toHaveValue("(55) 99999-8888");
    expect(telefone()).toHaveAccessibleDescription(
      /O número não pode passar de 11 dígitos/,
    );
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.contatos?.telefone).toBe("+5555999998888");
  });

  it("T179 (revisão final): telefone com ramal ou rótulo é recusado com aviso de formato, e o servidor recebe só os números certos", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    expect(celular()).toHaveValue("(31) 99999-0000");
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.paste(telefone(), {
      clipboardData: { getData: () => "3333-4444 ramal 25" },
    });
    expect(telefone()).toHaveValue("");
    expect(telefone()).toHaveAccessibleDescription(
      /Use um telefone brasileiro/,
    );
    // Preenchimento automático com rótulo sobre o celular certo: fica o certo.
    fireEvent.change(celular(), { target: { value: "Cel: 11 98765-4321" } });
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(celular()).toHaveAccessibleDescription(/Use um telefone brasileiro/);
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.contatos?.celular).toBe("+5531999990000");
    expect(dto.contatos).not.toHaveProperty("telefone");
  });

  it("T179 (revisão final): recomeçar a página tira os avisos da máscara", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      recusa(422, { codigo: "idempotencia_conteudo_divergente" }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText(/Este envio já foi registrado antes/);
    // Telefone vazio + colagem recusada: o valor segue vazio, com aviso.
    fireEvent.change(telefone(), { target: { value: "" } });
    fireEvent.paste(telefone(), {
      clipboardData: { getData: () => "ramal 25" },
    });
    expect(telefone()).toHaveAccessibleDescription(
      /Use um telefone brasileiro/,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Recomeçar a admissão" }),
    );
    expect(telefone()).toHaveValue("");
    expect(telefone()).not.toHaveAccessibleDescription(
      /Use um telefone brasileiro/,
    );
  });
});

describe("T179 (revisão final) — matrícula", () => {
  it.each([
    ["vazia", ""],
    ["só com espaços", "   "],
  ])("matrícula %s fica fora do corpo da admissão", async (_, valor) => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.change(matricula(), { target: { value: valor } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const [dto] = vi.mocked(admitirColaborador).mock.calls[0]!;
    expect(dto).not.toHaveProperty("matricula");
  });
});

// ---------------------------------------------------------------------------
// T179 (revisão final) — sessão expirada e falha ao preparar o envio NÃO são
// envio incerto; rede no POST e 5xx continuam sendo.
// ---------------------------------------------------------------------------

const MENSAGEM_SESSAO_EXPIRADA =
  "Sua sessão expirou e o cadastro não foi gravado. Entre de novo para continuar; os dados digitados foram mantidos nesta página.";
const MENSAGEM_FALHA_AO_PREPARAR =
  "Não foi possível preparar o envio e o cadastro não foi enviado. Confira a conexão e confirme de novo.";
const MENSAGEM_PERMISSAO =
  "Seu perfil não tem permissão para admitir colaboradores. Nada foi salvo.";
const MENSAGEM_INCERTO =
  "Não foi possível confirmar se o cadastro foi gravado. Antes de tentar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo: o mesmo envio não cria um segundo cadastro.";
const MENSAGEM_PAGINA_DESATUALIZADA =
  "Esta página ficou desatualizada. Confirme novamente; seus dados foram mantidos.";
const MENSAGEM_SESSAO_APOS_INCERTO =
  "Sua sessão expirou. Um envio anterior pode ter sido registrado: depois de entrar de novo, confira em Colaboradores; se ele não estiver lá, confirme de novo nesta página — o mesmo envio não cria um segundo cadastro. Os dados digitados foram mantidos.";
const MENSAGEM_PREPARO_APOS_INCERTO =
  "Não foi possível preparar o envio agora. Um envio anterior pode ter sido registrado: confira em Colaboradores antes de tentar de novo; o mesmo envio não cria um segundo cadastro.";

describe("T179 (revisão final) — sessão expirada separada de envio incerto", () => {
  const dialogoDescarte = () =>
    screen.getByRole("dialog", { name: "Descartar esta admissão?" });

  /** O formulário segue como foi preenchido por `preencherValido`. */
  function esperarFormularioPreservado() {
    expect(dialogoConfirmacao()).toBeNull();
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
    expect(celular()).toHaveValue("(31) 99999-0000");
  }

  /** Abre o descarte e devolve a descrição dele (diz se há envio incerto). */
  function descricaoDoDescarte(): HTMLElement {
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    return dialogoDescarte();
  }

  it.each([
    ["401 do POST da admissão", () => recusa(401)],
    [
      "CsrfSessionExpiredError na renovação do token",
      () => new CsrfSessionExpiredError(),
    ],
  ])(
    "%s: sessão expirada, foco na mensagem, formulário preservado e descarte sem envio incerto",
    async (_, erro) => {
      vi.mocked(admitirColaborador).mockRejectedValueOnce(erro());
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      const alerta = await screen.findByText(MENSAGEM_SESSAO_EXPIRADA);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(screen.queryByText(MENSAGEM_INCERTO)).toBeNull();
      expect(alerta).not.toHaveTextContent(
        /mesmo envio|confira em Colaboradores/,
      );
      expect(screen.queryByText(/Seu acesso expirou/)).toBeNull();
      esperarFormularioPreservado();
      expect(descricaoDoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
    },
  );

  // T179 (revisão definitiva) — duas abas: a outra renovou o token CSRF da
  // mesma sessão (válida); esta recebe 403 csrf_invalido. O cliente descarta o
  // token, e confirmar de novo renova e reenvia o MESMO pedido.
  it("403 csrf_invalido (outra aba renovou o token): página desatualizada, dados e chave mantidos; confirmar de novo conclui sem duplicar", async () => {
    vi.mocked(admitirColaborador)
      .mockRejectedValueOnce(recusa(403, { codigo: "csrf_invalido" }))
      .mockResolvedValueOnce(resposta);
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(MENSAGEM_PAGINA_DESATUALIZADA);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(screen.queryByText(MENSAGEM_SESSAO_EXPIRADA)).toBeNull();
    expect(screen.queryByText(MENSAGEM_INCERTO)).toBeNull();
    expect(alerta).not.toHaveTextContent(/sessão expirou|não foi gravado/);
    esperarFormularioPreservado();
    expect(descricaoDoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
    fireEvent.click(
      within(dialogoDescarte()).getByRole("button", {
        name: "Continuar preenchendo",
      }),
    );
    await salvarEConfirmar();
    await screen.findByText("Admissão registrada");
    expect(admitirColaborador).toHaveBeenCalledTimes(2);
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });

  it("403 de permissão (sem código): mensagem de permissão, não de sessão", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(recusa(403));
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(MENSAGEM_PERMISSAO);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(screen.queryByText(MENSAGEM_SESSAO_EXPIRADA)).toBeNull();
    esperarFormularioPreservado();
    expect(descricaoDoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
  });

  it("CsrfRequestError: o envio nem saiu — mensagem própria, sem envio incerto", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      new CsrfRequestError("Não foi possível obter o token CSRF."),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(MENSAGEM_FALHA_AO_PREPARAR);
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(screen.queryByText(MENSAGEM_INCERTO)).toBeNull();
    esperarFormularioPreservado();
    expect(descricaoDoDescarte()).toHaveAccessibleDescription(DESCARTE_COMUM);
  });

  it.each([
    ["rede no POST", () => new TypeError("Failed to fetch")],
    ["500", () => recusa(500)],
    ["502", () => recusa(502)],
    ["504", () => recusa(504)],
  ])(
    "%s: continua envio incerto, com foco, formulário preservado e descarte incerto",
    async (_, erro) => {
      vi.mocked(admitirColaborador).mockRejectedValueOnce(erro());
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      const alerta = await screen.findByText(MENSAGEM_INCERTO);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(screen.queryByText(MENSAGEM_SESSAO_EXPIRADA)).toBeNull();
      esperarFormularioPreservado();
      expect(descricaoDoDescarte()).toHaveAccessibleDescription(
        DESCARTE_INCERTO,
      );
    },
  );

  // T179 (revisão definitiva) — depois de um envio incerto, a falha de um
  // pedido SEGUINTE nada diz sobre o anterior: nenhuma mensagem nega a
  // gravação, todas mantêm a orientação de conferir Colaboradores (ou a de
  // confirmar de novo, que é seguro com a mesma chave), e a chave fica.
  const INCERTOS = [
    ["rede", () => new TypeError("Failed to fetch")],
    ["500", () => recusa(500)],
  ] as const;
  const FALHAS_SEGUINTES = [
    ["401", () => recusa(401), MENSAGEM_SESSAO_APOS_INCERTO],
    [
      "CsrfSessionExpiredError",
      () => new CsrfSessionExpiredError(),
      MENSAGEM_SESSAO_APOS_INCERTO,
    ],
    [
      "403 csrf_invalido",
      () => recusa(403, { codigo: "csrf_invalido" }),
      MENSAGEM_PAGINA_DESATUALIZADA,
    ],
    [
      "CsrfRequestError",
      () => new CsrfRequestError("Não foi possível obter o token CSRF."),
      MENSAGEM_PREPARO_APOS_INCERTO,
    ],
  ] as const;

  it.each(
    INCERTOS.flatMap(([incerto, criarIncerto]) =>
      FALHAS_SEGUINTES.map(
        ([falha, criarFalha, texto]) =>
          [incerto, falha, criarIncerto, criarFalha, texto] as const,
      ),
    ),
  )(
    "envio incerto (%s) seguido de %s: nenhuma mensagem nega a gravação; dados e chave mantidos",
    async (_incerto, _falha, criarIncerto, criarFalha, texto) => {
      vi.mocked(admitirColaborador)
        .mockRejectedValueOnce(criarIncerto())
        .mockRejectedValueOnce(criarFalha())
        .mockResolvedValueOnce(resposta);
      montar();
      await aguardarEmpresa();
      await preencherValido();
      await salvarEConfirmar();
      await screen.findByText(MENSAGEM_INCERTO);
      await salvarEConfirmar();
      const alerta = await screen.findByText(texto);
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(document.body).not.toHaveTextContent(
        /não foi gravado|não foi enviado|Nada foi salvo/,
      );
      esperarFormularioPreservado();
      const dialogo = descricaoDoDescarte();
      expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Continuar preenchendo" }),
      );
      // A chave é a mesma em todas as tentativas: reconfirmar não duplica.
      await salvarEConfirmar();
      await screen.findByText("Admissão registrada");
      expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
      expect(chaveDaChamada(2)).toBe(chaveDaChamada(0));
    },
  );
});

// ---------------------------------------------------------------------------
// T179 (revisão final) — CEP com texto misturado: recusado, e o ViaCEP nunca
// consulta um CEP tirado do texto. CEPs sintéticos.
// ---------------------------------------------------------------------------

const CEP_MISTURADO_NA_PAGINA = [
  "Nº 5, 0131010",
  "CEP: 01310-100",
  "01310-1OO",
  "01310 100",
  "０１３１０１００",
  "01310/100",
];

/** Os CEPs que um texto misturado daria se os números fossem tirados dele. */
const CEPS_DERIVADOS = ["50131010", "01310100", "013101", "0131010"];

describe("T179 (revisão final) — CEP com texto misturado na página", () => {
  beforeEach(() => {
    vi.mocked(consultarCep).mockReset();
    vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
  });

  function colarNoCep(inicio: number, fim: number, texto: string) {
    const campo = campoCep() as HTMLInputElement;
    campo.focus();
    campo.setSelectionRange(inicio, fim);
    fireEvent.paste(campo, { clipboardData: { getData: () => texto } });
  }

  it.each(CEP_MISTURADO_NA_PAGINA)(
    "colar %p no CEP vazio: recusado com aviso, e sair do campo não consulta nada",
    async (texto) => {
      montar();
      await aguardarEmpresa();
      colarNoCep(0, 0, texto);
      expect(campoCep()).toHaveValue("");
      expect(campoCep()).toHaveAccessibleDescription(/Use um CEP brasileiro/);
      fireEvent.blur(campoCep());
      // Dá tempo a uma consulta que, errada, sairia no blur.
      await act(async () => {});
      expect(consultarCep).not.toHaveBeenCalled();
      expect(logradouro()).toHaveValue("");
    },
  );

  it.each(CEP_MISTURADO_NA_PAGINA)(
    "preencher %p no CEP vazio: recusado, e nada é consultado",
    async (texto) => {
      montar();
      await aguardarEmpresa();
      digitarCep(texto);
      expect(campoCep()).toHaveValue("");
      expect(campoCep()).toHaveAccessibleDescription(/Use um CEP brasileiro/);
      fireEvent.blur(campoCep());
      await act(async () => {});
      expect(consultarCep).not.toHaveBeenCalled();
    },
  );

  it("colado sobre um CEP válido: o válido fica, e só ele pode ser consultado", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("04567-000");
    colarNoCep(0, 9, "Nº 5, 0131010");
    expect(campoCep()).toHaveValue("04567-000");
    expect(campoCep()).toHaveAccessibleDescription(/Use um CEP brasileiro/);
    fireEvent.blur(campoCep());
    await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(1));
    expect(consultarCep).toHaveBeenCalledWith("04567000");
    for (const derivado of CEPS_DERIVADOS) {
      expect(consultarCep).not.toHaveBeenCalledWith(derivado);
    }
  });

  it("letra no meio de um CEP (tecla ou arrastar): recusada, e nenhum CEP derivado é consultado", async () => {
    montar();
    await aguardarEmpresa();
    digitarCep("0131");
    // "0131" + "0-1OO" de uma vez: o texto misturado não entra.
    fireEvent.change(campoCep(), { target: { value: "01310-1OO" } });
    expect(campoCep()).toHaveValue("0131");
    expect(campoCep()).toHaveAccessibleDescription(/Use um CEP brasileiro/);
    fireEvent.blur(campoCep());
    await act(async () => {});
    expect(consultarCep).not.toHaveBeenCalled();
  });

  it("CEPs legítimos continuam aceitos e consultados", async () => {
    montar();
    await aguardarEmpresa();
    colarNoCep(0, 0, "01.310-100");
    expect(campoCep()).toHaveValue("01310-100");
    expect(campoCep()).not.toHaveAccessibleDescription(/Use um CEP brasileiro/);
    fireEvent.blur(campoCep());
    await waitFor(() => expect(consultarCep).toHaveBeenCalledWith("01310100"));
  });
});

// ---------------------------------------------------------------------------
// T180 — cadastro rápido de Departamento, Cargo e Unidade, sem sair da página
// (decisão da proprietária de 2026-10-23). Só o RH vê o "+"; o modal fecha
// sem tocar na admissão, o foco volta ao SELETOR, e a referência criada entra
// no seletor já escolhida — e é ela que a admissão envia.
// ---------------------------------------------------------------------------

/** Referências que o servidor "cria" nos testes (dados sintéticos). */
const departamentoNovo: DepartamentoApi = {
  ...departamento,
  id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  codigo: "DEP_RAPIDO",
  nome: "Departamento Rápido (teste)",
};
const cargoNovo: CargoApi = {
  ...cargo,
  id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
  codigo: "CAR_RAPIDO",
  nome: "Cargo Rápido (teste)",
};
const unidadeNova: UnidadeOrganizacionalApi = {
  ...unidade,
  id: "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3",
  codigo: "UNI_RAPIDA",
  nome: "Unidade Rápida (teste)",
};

/** T195 — o "+" fica na etapa 2: abre a etapa antes, se preciso. */
function botaoMais(nomeAcessivel: string) {
  abrirLotacao();
  return screen.getByRole("button", { name: nomeAcessivel });
}
const dialogoReferencia = () =>
  screen.queryByRole("dialog", {
    name: /^Cadastrar (departamento|cargo|unidade)$/,
  });

/** Abre o "+" e preenche código e nome no modal; não envia. */
async function abrirEPreencher(
  nomeAcessivel: string,
  codigoDigitado: string,
  nomeDigitado: string,
) {
  fireEvent.click(botaoMais(nomeAcessivel));
  const dialogo = await screen.findByRole("dialog", {
    name: /^Cadastrar (departamento|cargo|unidade)$/,
  });
  fireEvent.change(within(dialogo).getByLabelText(/^Código/), {
    target: { value: codigoDigitado },
  });
  fireEvent.change(within(dialogo).getByLabelText(/^Nome/), {
    target: { value: nomeDigitado },
  });
  return dialogo;
}

/** Abre, preenche e clica "Cadastrar". */
async function cadastrarPeloMais(
  nomeAcessivel: string,
  codigoDigitado: string,
  nomeDigitado: string,
) {
  const dialogo = await abrirEPreencher(
    nomeAcessivel,
    codigoDigitado,
    nomeDigitado,
  );
  fireEvent.click(within(dialogo).getByRole("button", { name: "Cadastrar" }));
  return dialogo;
}

/** Parte da admissão digitada ANTES do modal, para conferir que fica. */
function preencherParteDaAdmissao() {
  fireEvent.change(nome(), { target: { value: "Pessoa Sintética Rápida" } });
  fireEvent.change(dataNascimento(), { target: { value: "1991-02-03" } });
  fireEvent.change(tipo(), { target: { value: "clt" } });
  fireEvent.change(data(), { target: { value: "2026-11-10" } });
  fireEvent.change(emailPessoal(), {
    target: { value: "pessoa.rapida@exemplo.test" },
  });
}

function admissaoPreservada() {
  expect(nome()).toHaveValue("Pessoa Sintética Rápida");
  expect(dataNascimento()).toHaveValue("1991-02-03");
  expect(tipo()).toHaveValue("clt");
  expect(data()).toHaveValue("2026-11-10");
  expect(emailPessoal()).toHaveValue("pessoa.rapida@exemplo.test");
}

function recusaDeReferencia(status: number, codigo?: string) {
  return Object.assign(new Error("recusado"), {
    status,
    ...(codigo ? { codigo } : {}),
  });
}

describe("T180 — cadastro rápido de referências na Nova admissão", () => {
  beforeEach(() => {
    vi.mocked(criarDepartamento).mockResolvedValue(departamentoNovo);
    vi.mocked(criarCargo).mockResolvedValue(cargoNovo);
    vi.mocked(criarUnidade).mockResolvedValue(unidadeNova);
  });

  it('o RH vê os três "+", ao lado de Departamento, Cargo e Unidade', async () => {
    montar("rh");
    await aguardarEmpresa();
    for (const [rotulo, seletor] of [
      ["Cadastrar novo departamento", departamentoSel],
      ["Cadastrar novo cargo", cargoSel],
      ["Cadastrar nova unidade", unidadeSel],
    ] as const) {
      const botao = botaoMais(rotulo);
      expect(botao).toBeEnabled();
      // Na mesma linha do seletor, dentro do mesmo campo.
      expect(botao.parentElement).toContainElement(seletor());
    }
    // A obrigatoriedade não muda.
    expect(departamentoSel()).toHaveAttribute("aria-required", "true");
    expect(cargoSel()).toHaveAttribute("aria-required", "true");
    expect(unidadeSel()).not.toHaveAttribute("aria-required");
  });

  it.each(["dp", null])('%s não vê nenhum "+"', async (papel) => {
    montar(papel);
    await aguardarEmpresa();
    expect(
      screen.queryByRole("button", { name: /^Cadastrar nov[oa] / }),
    ).toBeNull();
  });

  it('enquanto as opções carregam, o "+" fica desabilitado', async () => {
    let liberar: () => void = () => undefined;
    vi.mocked(listarEmpresasMulti).mockReturnValue(
      new Promise((r) => {
        liberar = () => r(paginado([empresa]));
      }),
    );
    montar("rh");
    expect(botaoMais("Cadastrar novo departamento")).toBeDisabled();
    await act(async () => liberar());
    await aguardarEmpresa();
    expect(botaoMais("Cadastrar novo departamento")).toBeEnabled();
  });

  it('sem empresa resolvida, o "+" fica desabilitado', async () => {
    vi.mocked(listarEmpresasMulti).mockResolvedValue(paginado([]));
    montar("rh");
    await screen.findByText(/Não foi possível confirmar a empresa ativa/);
    expect(botaoMais("Cadastrar novo cargo")).toBeDisabled();
  });

  it("abre com o foco em Código; Escape fecha, o foco volta ao seletor e a admissão fica igual", async () => {
    montar("rh");
    await aguardarEmpresa();
    preencherParteDaAdmissao();
    fireEvent.click(botaoMais("Cadastrar novo departamento"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Cadastrar departamento",
    });
    expect(within(dialogo).getByLabelText(/^Código/)).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogoReferencia()).toBeNull();
    expect(departamentoSel()).toHaveFocus();
    admissaoPreservada();
    expect(criarDepartamento).not.toHaveBeenCalled();
  });

  it('"Cancelar" faz o mesmo: fecha, foco no seletor, admissão e erros iguais', async () => {
    montar("rh");
    await aguardarEmpresa();
    preencherParteDaAdmissao();
    // Um erro já na tela (matrícula inválida) também tem de ficar.
    fireEvent.change(matricula(), { target: { value: "x" } });
    fireEvent.click(salvar());
    await waitFor(() =>
      expect(matricula()).toHaveAttribute("aria-invalid", "true"),
    );
    const dialogo = await abrirEPreencher(
      "Cadastrar novo cargo",
      "CAR_X",
      "Cargo descartado",
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(dialogoReferencia()).toBeNull();
    expect(cargoSel()).toHaveFocus();
    admissaoPreservada();
    expect(matricula()).toHaveValue("X");
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
    expect(criarCargo).not.toHaveBeenCalled();
    // Reabrir começa vazio.
    fireEvent.click(botaoMais("Cadastrar novo cargo"));
    const reaberto = await screen.findByRole("dialog", {
      name: "Cadastrar cargo",
    });
    expect(within(reaberto).getByLabelText(/^Código/)).toHaveValue("");
    expect(within(reaberto).getByLabelText(/^Nome/)).toHaveValue("");
  });

  it.each([
    {
      rotulo: "Cadastrar novo departamento",
      criar: criarDepartamento,
      nova: departamentoNovo,
      seletor: departamentoSel,
      chave: "departamentoId",
    },
    {
      rotulo: "Cadastrar novo cargo",
      criar: criarCargo,
      nova: cargoNovo,
      seletor: cargoSel,
      chave: "cargoId",
    },
    {
      rotulo: "Cadastrar nova unidade",
      criar: criarUnidade,
      nova: unidadeNova,
      seletor: unidadeSel,
      chave: "unidadeOrganizacionalId",
    },
  ] as const)(
    "$rotulo: cria na empresa ativa, seleciona a nova opção e a admissão a envia",
    async ({ rotulo, criar, nova, seletor, chave }) => {
      montar("rh");
      await aguardarEmpresa();
      await preencherValido();
      await cadastrarPeloMais(rotulo, nova.codigo.toLowerCase(), nova.nome);
      await waitFor(() => expect(dialogoReferencia()).toBeNull());
      expect(criar).toHaveBeenCalledWith({
        codigo: nova.codigo,
        nome: nova.nome,
        empresaId: empresa.id,
      });
      // A nova referência fica escolhida, e o foco voltou ao campo.
      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );
      expect(seletor()).toHaveFocus();
      // O resto da admissão continua como estava.
      expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
      expect(data()).toHaveValue("2026-11-03");
      expect(tipo()).toHaveValue("clt");

      await salvarEConfirmar();
      await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
      const dto = vi.mocked(admitirColaborador).mock
        .calls[0]![0] as unknown as Record<string, unknown>;
      expect(dto[chave]).toBe(nova.id);
    },
  );

  it("o departamento criado passa pelo caminho da troca: limpa a Área e recarrega as áreas dele", async () => {
    montar("rh");
    await aguardarEmpresa();
    await escolher(departamentoSel(), departamento);
    await waitFor(() =>
      expect(listarAreas).toHaveBeenCalledWith(
        expect.objectContaining({ departamentoId: departamento.id }),
      ),
    );
    await cadastrarPeloMais(
      "Cadastrar novo departamento",
      departamentoNovo.codigo,
      departamentoNovo.nome,
    );
    await waitFor(() =>
      expect(listarAreas).toHaveBeenLastCalledWith(
        expect.objectContaining({ departamentoId: departamentoNovo.id }),
      ),
    );
    expect(areaSel()).toHaveValue("");
  });

  it("T196 — a referência criada fica escolhida mesmo que a busca do servidor ainda não a traga", async () => {
    vi.mocked(listarCargos).mockResolvedValue(
      paginado([
        { ...cargo, id: "c-a", codigo: "AAA", nome: "Primeiro" },
        { ...cargo, id: "c-z", codigo: "ZZZ", nome: "Último" },
      ]),
    );
    montar("rh");
    await aguardarEmpresa();
    await cadastrarPeloMais(
      "Cadastrar novo cargo",
      cargoNovo.codigo,
      cargoNovo.nome,
    );
    await waitFor(() => expect(dialogoReferencia()).toBeNull());
    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    await within(listaDe(cargoSel())).findByRole("option", { name: /^AAA/ });
    expect(
      within(listaDe(cargoSel()))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["AAA — Primeiro", "ZZZ — Último"]);
    expect(escolhaDe(cargoSel())).toHaveTextContent(
      "CAR_RAPIDO — Cargo Rápido (teste)",
    );
  });

  it("código inválido: nenhuma chamada e o erro no campo do modal", async () => {
    montar("rh");
    await aguardarEmpresa();
    const dialogo = await cadastrarPeloMais(
      "Cadastrar novo departamento",
      "x",
      "Departamento Sintético",
    );
    const codigoDoModal = within(dialogo).getByLabelText(/^Código/);
    expect(codigoDoModal).toHaveAttribute("aria-invalid", "true");
    expect(codigoDoModal).toHaveAccessibleDescription(
      /Código deve conter apenas letras maiúsculas, dígitos e _ \(2 a 32 caracteres\)\./,
    );
    expect(codigoDoModal).toHaveFocus();
    expect(criarDepartamento).not.toHaveBeenCalled();
    expect(dialogoReferencia()).toBeInTheDocument();
  });

  it("409: erro no Código, modal aberto e admissão preservada", async () => {
    vi.mocked(criarDepartamento).mockRejectedValue(recusaDeReferencia(409));
    montar("rh");
    await aguardarEmpresa();
    preencherParteDaAdmissao();
    const dialogo = await cadastrarPeloMais(
      "Cadastrar novo departamento",
      "DEP1",
      "Departamento repetido",
    );
    const codigoDoModal = within(dialogo).getByLabelText(/^Código/);
    await waitFor(() =>
      expect(codigoDoModal).toHaveAccessibleDescription(
        /Este código já está em uso nesta empresa\./,
      ),
    );
    expect(codigoDoModal).toHaveFocus();
    expect(dialogoReferencia()).toBeInTheDocument();
    expect(escolhaDe(departamentoSel())).toHaveTextContent("Nenhuma escolha.");
    admissaoPreservada();
  });

  it.each([
    [
      "400",
      () => recusaDeReferencia(400),
      "O servidor recusou os dados. Revise código e nome.",
    ],
    [
      "403 csrf_invalido",
      () => recusaDeReferencia(403, "csrf_invalido"),
      "Esta página ficou desatualizada. Cadastre novamente; seus dados foram mantidos.",
    ],
    [
      "403 de permissão",
      () => recusaDeReferencia(403),
      "Seu perfil não tem permissão para cadastrar unidades.",
    ],
    [
      "401",
      () => recusaDeReferencia(401),
      "Sua sessão expirou. Entre de novo para continuar; os dados digitados foram mantidos nesta página.",
    ],
    [
      "404",
      () => recusaDeReferencia(404),
      "A empresa ativa não pôde ser confirmada. Feche este cadastro e abra a página de novo.",
    ],
  ])(
    "%s: mensagem certa, modal aberto, admissão preservada",
    async (_caso, erro, mensagem) => {
      vi.mocked(criarUnidade).mockRejectedValue(erro());
      montar("rh");
      await aguardarEmpresa();
      preencherParteDaAdmissao();
      const dialogo = await cadastrarPeloMais(
        "Cadastrar nova unidade",
        "UNI_X",
        "Unidade Sintética",
      );
      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
        mensagem,
      );
      expect(dialogoReferencia()).toBeInTheDocument();
      // Recusa clara: nada é relido.
      expect(listarUnidades).not.toHaveBeenCalled();
      admissaoPreservada();
    },
  );

  it("rede: não afirma o cadastro e recarrega a lista daquela referência", async () => {
    vi.mocked(criarCargo).mockRejectedValue(new TypeError("Failed to fetch"));
    montar("rh");
    await aguardarEmpresa();
    expect(listarCargos).toHaveBeenCalledTimes(1);
    // O servidor gravou antes de a resposta se perder: a recarga já o traz.
    vi.mocked(listarCargos).mockResolvedValue(paginado([cargo, cargoNovo]));
    const dialogo = await cadastrarPeloMais(
      "Cadastrar novo cargo",
      cargoNovo.codigo,
      cargoNovo.nome,
    );
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert")).toHaveTextContent(
        "Não foi possível confirmar se o cadastro foi feito. A lista foi atualizada: confira se a referência já aparece antes de tentar de novo.",
      ),
    );
    // T196 — uma leitura de um item confere o servidor; a busca do seletor é
    // descartada e relida na próxima abertura.
    await waitFor(() => expect(listarCargos).toHaveBeenCalledTimes(2));
    expect(listarCargos).toHaveBeenLastCalledWith({
      status: "ativo",
      tamanhoPagina: 1,
    });
    expect(listarDepartamentos).toHaveBeenCalledTimes(1);
    expect(listarUnidades).not.toHaveBeenCalled();
    expect(dialogoReferencia()).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    expect(
      await within(listaDe(cargoSel())).findByRole("option", {
        name: `${cargoNovo.codigo} — ${cargoNovo.nome}`,
      }),
    ).toBeInTheDocument();
    // Nada foi escolhido por conta própria.
    expect(escolhaDe(cargoSel())).toHaveTextContent("Nenhuma escolha.");
  });

  it("rede e recarga falha: diz que a lista não pôde ser atualizada, e a lista e a admissão ficam", async () => {
    vi.mocked(criarCargo).mockRejectedValue(new TypeError("Failed to fetch"));
    montar("rh");
    await aguardarEmpresa();
    preencherParteDaAdmissao();
    vi.mocked(listarCargos).mockRejectedValue(new TypeError("Failed to fetch"));
    const dialogo = await cadastrarPeloMais(
      "Cadastrar novo cargo",
      cargoNovo.codigo,
      cargoNovo.nome,
    );
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert")).toHaveTextContent(
        "Não foi possível confirmar se o cadastro foi feito, e a lista não pôde ser atualizada.",
      ),
    );
    expect(within(dialogo).getByRole("alert")).not.toHaveTextContent(
      /foi atualizada/,
    );
    expect(listarCargos).toHaveBeenCalledTimes(2);
    expect(dialogoReferencia()).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    // T196 — a busca também falha: estado claro, escolha e admissão mantidas.
    fireEvent.keyDown(cargoSel(), { key: "ArrowDown" });
    expect(
      await screen.findByText(
        "Não foi possível carregar cargos. A escolha atual foi mantida.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
    expect(escolhaDe(cargoSel())).toHaveTextContent("Nenhuma escolha.");
    admissaoPreservada();
  });

  // T180 (revisão, B1) — a recarga pedida depois de um envio incerto pode
  // chegar DEPOIS de uma nova tentativa que criou a referência. Essa resposta
  // é antiga: não pode tirar a referência nova do seletor, e a confirmação
  // mostra exatamente o que a admissão envia.
  const CASOS_DA_RECARGA = [
    {
      rotulo: "Cadastrar novo departamento",
      criar: criarDepartamento,
      listar: listarDepartamentos,
      existente: departamento,
      nova: departamentoNovo,
      seletor: departamentoSel,
      linha: "Departamento",
      chave: "departamentoId",
    },
    {
      rotulo: "Cadastrar novo cargo",
      criar: criarCargo,
      listar: listarCargos,
      existente: cargo,
      nova: cargoNovo,
      seletor: cargoSel,
      linha: "Cargo",
      chave: "cargoId",
    },
    {
      rotulo: "Cadastrar nova unidade",
      criar: criarUnidade,
      listar: listarUnidades,
      existente: unidade,
      nova: unidadeNova,
      seletor: unidadeSel,
      linha: "Unidade",
      chave: "unidadeOrganizacionalId",
    },
  ] as const;

  it.each(CASOS_DA_RECARGA)(
    "$linha: recarga atrasada, que chega depois da criação, é descartada; confirmação e envio falam da referência nova",
    async ({
      rotulo,
      criar,
      listar,
      existente,
      nova,
      seletor,
      linha,
      chave,
    }) => {
      // 1ª tentativa sem resposta (rede); a 2ª cria.
      vi.mocked(criar as typeof criarCargo)
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(nova as CargoApi);
      montar("rh");
      await aguardarEmpresa();
      await preencherValido();
      // A recarga do envio incerto fica pendente, lida ANTES da criação.
      let liberarRecarga: () => void = () => undefined;
      const obsoleto = {
        ...existente,
        id: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4",
        codigo: "ZZ_OBSOLETO",
        nome: "Lido antes da criação (teste)",
      };
      vi.mocked(listar as typeof listarCargos).mockReturnValueOnce(
        new Promise((r) => {
          liberarRecarga = () => r(paginado([existente, obsoleto]) as never);
        }),
      );
      const dialogo = await cadastrarPeloMais(rotulo, nova.codigo, nova.nome);
      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
        "Atualizando a lista para você conferir…",
      );
      // Nova tentativa, com os dados mantidos: 201.
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Cadastrar" }),
      );
      await waitFor(() => expect(dialogoReferencia()).toBeNull());
      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );

      // Só agora chega a recarga antiga: não muda a escolha.
      await act(async () => liberarRecarga());

      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );

      fireEvent.click(salvar());
      const confirmacao = await screen.findByRole("dialog", {
        name: "Confirmar cadastro de colaborador?",
      });
      expect(confirmacao).toHaveTextContent(
        `${linha}: ${nova.codigo} — ${nova.nome}`,
      );
      expect(confirmacao.textContent ?? "").not.toMatch(
        new RegExp(`${linha}: Não informad`),
      );
      fireEvent.click(botaoConfirmar());
      await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
      const dto = vi.mocked(admitirColaborador).mock
        .calls[0]![0] as unknown as Record<string, unknown>;
      expect(dto[chave]).toBe(nova.id);
    },
  );

  it.each(CASOS_DA_RECARGA)(
    "$linha: uma recarga que não traz a referência escolhida não a tira do seletor nem da confirmação",
    async ({
      rotulo,
      criar,
      listar,
      existente,
      nova,
      seletor,
      linha,
      chave,
    }) => {
      // 1º "+": cria e seleciona. 2º "+": rede, e a recarga (a mais recente)
      // volta sem a referência escolhida.
      vi.mocked(criar as typeof criarCargo)
        .mockResolvedValueOnce(nova as CargoApi)
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));
      montar("rh");
      await aguardarEmpresa();
      await preencherValido();
      await cadastrarPeloMais(rotulo, nova.codigo, nova.nome);
      await waitFor(() => expect(dialogoReferencia()).toBeNull());
      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );

      vi.mocked(listar as typeof listarCargos).mockResolvedValueOnce(
        paginado([existente]) as never,
      );
      const dialogo = await cadastrarPeloMais(
        rotulo,
        "OUTRA_REF",
        "Outra referência (teste)",
      );
      await waitFor(() =>
        expect(within(dialogo).getByRole("alert")).toHaveTextContent(
          "A lista foi atualizada",
        ),
      );
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Cancelar" }),
      );

      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );
      fireEvent.click(salvar());
      const confirmacao = await screen.findByRole("dialog", {
        name: "Confirmar cadastro de colaborador?",
      });
      expect(confirmacao).toHaveTextContent(
        `${linha}: ${nova.codigo} — ${nova.nome}`,
      );
      fireEvent.click(botaoConfirmar());
      await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
      const dto = vi.mocked(admitirColaborador).mock
        .calls[0]![0] as unknown as Record<string, unknown>;
      expect(dto[chave]).toBe(nova.id);
    },
  );

  it('empresa sem Departamento e Cargo: o aviso orienta o "+", some depois de criar os dois e a admissão segue', async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
    vi.mocked(listarCargos).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    expect(
      screen.getByText(/ainda não tem cadastro ativo de/),
    ).toHaveTextContent(/Use o botão "\+" ao lado de Departamento e Cargo/);

    await cadastrarPeloMais(
      "Cadastrar novo departamento",
      departamentoNovo.codigo,
      departamentoNovo.nome,
    );
    await waitFor(() => expect(dialogoReferencia()).toBeNull());
    expect(
      screen.getByText(/ainda não tem cadastro ativo de/),
    ).toHaveTextContent(/Use o botão "\+" ao lado de Cargo,/);

    await cadastrarPeloMais(
      "Cadastrar novo cargo",
      cargoNovo.codigo,
      cargoNovo.nome,
    );
    await waitFor(() => expect(dialogoReferencia()).toBeNull());
    expect(screen.queryByText(/ainda não tem cadastro ativo de/)).toBeNull();

    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0]).toMatchObject({
      departamentoId: departamentoNovo.id,
      cargoId: cargoNovo.id,
    });
  });
});

describe("Nova admissão — jornada de trabalho opcional (T183)", () => {
  const JORNADA = {
    id: "jjjjjjjj-0000-4000-8000-000000000001",
    empresaId: "e",
    codigo: "COM_44H",
    nome: "Comercial 44h (teste)",
    ativo: true,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos: [],
  };

  it("o RH vê o campo opcional, com só as jornadas ativas e 'Sem jornada por enquanto'", async () => {
    vi.mocked(listarTabelasHorario).mockResolvedValue({
      itens: [JORNADA],
      pagina: 1,
      tamanhoPagina: 100,
      total: 1,
    });
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    const seletor = await screen.findByRole("combobox", {
      name: /Jornada de trabalho/,
    });
    await waitFor(() =>
      expect(
        within(seletor)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual([
        "Sem jornada por enquanto",
        "COM_44H — Comercial 44h (teste)",
      ]),
    );
    expect(listarTabelasHorario).toHaveBeenCalledWith({
      ativo: true,
      tamanhoPagina: 100,
    });
  });

  it("o DP admite sem o campo de jornada, e o catálogo de jornadas nem é lido", async () => {
    montar("dp");
    await aguardarEmpresa();
    expect(
      screen.queryByRole("combobox", { name: /Jornada de trabalho/ }),
    ).toBeNull();
    expect(listarTabelasHorario).not.toHaveBeenCalled();
  });

  function comJornada() {
    vi.mocked(listarTabelasHorario).mockResolvedValue({
      itens: [JORNADA],
      pagina: 1,
      tamanhoPagina: 100,
      total: 1,
    });
  }

  it("escolhida, a jornada vai no envio; sem escolha, o campo nem vai", async () => {
    comJornada();
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0]).not.toHaveProperty(
      "tabelaHorarioId",
    );
  });

  it("com jornada escolhida, envia o id e a confirmação mostra a jornada", async () => {
    comJornada();
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    const seletor = await screen.findByRole("combobox", {
      name: /Jornada de trabalho/,
    });
    await waitFor(() =>
      expect(within(seletor).getAllByRole("option")).toHaveLength(2),
    );
    fireEvent.change(seletor, { target: { value: JORNADA.id } });
    fireEvent.click(salvar());
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(
      within(dialogo).getByText(
        /COM_44H — Comercial 44h \(teste\), a partir de 03\/11\/2026/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(botaoConfirmar());
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0]).toMatchObject({
      tabelaHorarioId: JORNADA.id,
    });
  });

  it("jornada recusada pelo servidor (422 no campo): erro na jornada, digitado preservado", async () => {
    comJornada();
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(422, {
        erros: [{ campo: "tabelaHorarioId", motivo: "indisponivel" }],
      }),
    );
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    const seletor = await screen.findByRole("combobox", {
      name: /Jornada de trabalho/,
    });
    await waitFor(() =>
      expect(within(seletor).getAllByRole("option")).toHaveLength(2),
    );
    fireEvent.change(seletor, { target: { value: JORNADA.id } });
    await salvarEConfirmar();
    expect(
      await screen.findByText(/A jornada escolhida não está mais disponível/),
    ).toBeInTheDocument();
    expect(seletor).toHaveValue(JORNADA.id);
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
  });

  it("falha ao ler as jornadas não impede a admissão: avisa e segue sem jornada", async () => {
    vi.mocked(listarTabelasHorario).mockRejectedValue(new Error("rede"));
    montar("rh");
    await aguardarEmpresa();
    expect(
      await screen.findByText(/Não foi possível carregar as jornadas/),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T195 — cadastro individual em quatro etapas.
// ---------------------------------------------------------------------------

const indicador = () =>
  screen.getByRole("navigation", { name: "Etapas do cadastro" });
const progresso = () => within(indicador()).getByRole("progressbar");
const passoDoIndicador = (n: number) =>
  within(indicador()).getAllByRole("listitem")[n - 1]!;
const botaoVoltar = () => screen.getByRole("button", { name: "Voltar" });
const botaoContinuar = () => screen.getByRole("button", { name: "Continuar" });

/** As etapas 1 e 2 válidas e a 3 vazia: chega à revisão. */
async function ateARevisao() {
  await preencherValido();
  irAteEtapa("Revisão e conclusão");
}

describe("T195 — quatro etapas: indicador e progresso", () => {
  it("começa na etapa 1, com 25%, a etapa atual marcada e as demais não iniciadas, sem botão", async () => {
    montar();
    await aguardarEmpresa();
    expect(tituloDaEtapa()).toHaveTextContent("Etapa 1 de 4: Dados básicos");
    expect(within(indicador()).getByText("Etapa 1 de 4 · 25%")).toBeVisible();
    expect(progresso()).toHaveAttribute("value", "25");
    expect(progresso()).toHaveAccessibleName("Etapa 1 de 4 · 25%");
    expect(passoDoIndicador(1).querySelector("[aria-current]")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(passoDoIndicador(1)).toHaveTextContent("etapa atual");
    for (const n of [2, 3, 4]) {
      expect(passoDoIndicador(n)).toHaveTextContent("não iniciada");
    }
    // Nenhuma etapa é botão no começo: não há salto adiante.
    expect(within(indicador()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
  });

  it("avançar leva a 50%, 75% e 100%, com o foco no título de cada etapa", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    for (const [titulo, pct] of [
      ["Etapa 2 de 4: Dados profissionais e lotação", "50"],
      ["Etapa 3 de 4: Endereço", "75"],
      ["Etapa 4 de 4: Revisão e conclusão", "100"],
    ] as const) {
      fireEvent.click(botaoContinuar());
      expect(tituloDaEtapa()).toHaveTextContent(titulo);
      await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
      expect(progresso()).toHaveAttribute("value", pct);
    }
    // Na revisão, o botão principal é "Confirmar admissão".
    expect(screen.queryByRole("button", { name: "Continuar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Confirmar admissão" }),
    ).toHaveAttribute("type", "submit");
    // As três anteriores, concluídas, viram botões com o estado no nome.
    expect(within(indicador()).getAllByRole("button")).toHaveLength(3);
    for (const nome of [
      "Etapa 1: Dados básicos, concluída",
      "Etapa 2: Dados profissionais e lotação, concluída",
      "Etapa 3: Endereço, concluída",
    ]) {
      expect(
        within(indicador()).getByRole("button", { name: nome }),
      ).toBeEnabled();
    }
    expect(passoDoIndicador(4).querySelector("[aria-current]")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("Enter num campo faz o mesmo que Continuar", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.submit(nome().closest("form")!);
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    expect(dialogoConfirmacao()).toBeNull();
  });

  it("enquanto as opções carregam, a etapa 1 avança, e a 2 espera a carga", async () => {
    let liberar: () => void = () => {};
    vi.mocked(listarEmpresasMulti).mockReturnValue(
      new Promise((resolve) => {
        liberar = () => resolve(paginado([empresa]));
      }),
    );
    montar();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    expect(botaoContinuar()).toBeDisabled();
    await act(async () => liberar());
    await aguardarEmpresa();
    expect(botaoContinuar()).toBeEnabled();
  });
});

describe("T195 — quatro etapas: voltar, revisitar e não saltar", () => {
  it("Voltar não valida, preserva tudo e leva o foco ao título da etapa anterior", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.change(screen.getByLabelText(/^Saudação/), {
      target: { value: "Sra." },
    });
    irAteEtapa("Endereço");
    fireEvent.change(logradouro(), { target: { value: "Rua Sintética" } });
    fireEvent.click(botaoVoltar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
    // Apagar um obrigatório e voltar de novo: Voltar não acusa nada.
    fireEvent.change(tipo(), { target: { value: "" } });
    fireEvent.click(botaoVoltar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(tipo()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    // Tudo o que foi digitado continua, em todas as etapas.
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(screen.getByLabelText(/^Saudação/)).toHaveValue("Sra.");
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    expect(logradouro()).toHaveValue("Rua Sintética");
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("as etapas alcançadas são botões do indicador; voltar por ele preserva os dados", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 1: Dados básicos, concluída",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    // A revisão, já alcançada, continua ao alcance: o caminho é validado.
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 4: Revisão e conclusão, visitada",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Revisão e conclusão$/);
    expect(progresso()).toHaveAttribute("value", "100");
  });

  it("ir adiante pelo indicador para na etapa com erro, com o foco no campo", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 2: Dados profissionais e lotação, concluída",
      }),
    );
    fireEvent.change(data(), { target: { value: "" } });
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 4: Revisão e conclusão, visitada",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    await waitFor(() => expect(data()).toHaveFocus());
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(dialogoConfirmacao()).toBeNull();
  });

  it("sem a etapa atual válida, Continuar não avança e só ela é validada", async () => {
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.change(matricula(), { target: { value: "x" } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    await waitFor(() => expect(matricula()).toHaveFocus());
    // Etapa 3 nunca alcançada: nem botão no indicador.
    expect(passoDoIndicador(3)).toHaveTextContent("não iniciada");
    expect(within(passoDoIndicador(3)).queryByRole("button")).toBeNull();
    // Os campos do endereço não são validados antes da etapa deles.
    fireEvent.change(campoCep(), { target: { value: "123" } });
    expect(campoCep()).not.toHaveAttribute("aria-invalid");
  });
});

describe("T195 — revisão e conclusão", () => {
  it("mostra o que foi digitado, sem opcional em branco, com Editar por bloco", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    irAteEtapa("Endereço");
    fireEvent.change(cidade(), { target: { value: "Cidade Sintética" } });
    irAteEtapa("Revisão e conclusão");
    const bloco = (titulo: string) =>
      screen
        .getByRole("heading", { level: 3, name: titulo })
        .closest("section")!;

    const basicos = bloco("Dados básicos");
    expect(basicos).toHaveTextContent("Nome completoPessoa Sintética Nova");
    expect(basicos).toHaveTextContent("E-mail pessoalPessoa.Nova@Exemplo.TEST");
    expect(basicos).toHaveTextContent("Data de nascimento20/05/1990");
    expect(basicos).toHaveTextContent("Celular(31) 99999-0000");
    // Opcional em branco não aparece.
    expect(basicos).not.toHaveTextContent("Saudação");
    expect(basicos).not.toHaveTextContent("Sexo");

    const profissionais = bloco("Dados profissionais e lotação");
    expect(profissionais).toHaveTextContent("MatrículaMAT-0900");
    expect(profissionais).toHaveTextContent("Tipo de vínculoCLT");
    expect(profissionais).toHaveTextContent("Data de admissão03/11/2026");
    expect(profissionais).toHaveTextContent(
      `Departamento${departamento.codigo} — ${departamento.nome}`,
    );
    expect(profissionais).not.toHaveTextContent("Área");
    expect(profissionais).not.toHaveTextContent("Jornada");

    const endereco = bloco("Endereço");
    expect(endereco).toHaveTextContent("PaísBrasil");
    expect(endereco).toHaveTextContent("CidadeCidade Sintética");
    expect(endereco).not.toHaveTextContent("Logradouro");
    expectSemIsoVisivel(document.body);

    // Editar volta à etapa, com o foco no título e os dados no lugar.
    fireEvent.click(
      within(profissionais).getByRole("button", {
        name: "Editar Dados profissionais e lotação",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
    expect(matricula()).toHaveValue("MAT-0900");
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("documentos: aviso acessível de entrega própria, sem campo de arquivo nem envio", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    const documentos = screen
      .getByRole("heading", { level: 3, name: "Documentos" })
      .closest("section")!;
    expect(documentos).toHaveAccessibleName("Documentos");
    expect(documentos).toHaveTextContent(
      "Documentos serão liberados em uma próxima etapa do Evolli.",
    );
    expect(within(documentos).queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("Confirmar admissão abre a mesma confirmação e envia uma vez, com a chave", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar admissão" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(admitirColaborador).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Confirmar cadastro" }),
    );
    await screen.findByRole("heading", { name: /Admissão de .* registrada/ });
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
    expect(chaveDaChamada(0)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("recusa do servidor num campo de outra etapa abre a etapa dele, com o foco no campo", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(
      recusa(409, {
        erros: [
          { campo: "contatos.emailPessoal", motivo: "em_uso" },
          { campo: "matricula", motivo: "em_uso" },
        ],
      }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    // O primeiro da tela é o e-mail, na etapa 1.
    await waitFor(() => expect(emailPessoal()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    // O resumo leva ao outro campo, na etapa dele.
    const resumo = screen.getByRole("group", { name: /Revise 2 campos/ });
    fireEvent.click(within(resumo).getByRole("button", { name: "Matrícula" }));
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    await waitFor(() => expect(matricula()).toHaveFocus());
    expect(matricula()).toHaveAccessibleDescription(
      /Esta matrícula já está em uso nesta empresa/,
    );
    // Tudo preservado; nada reenviado sem nova confirmação.
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
  });

  it("erro geral (envio incerto) fica na revisão, com o foco nele, e reenviar repete a chave", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(new TypeError("rede"));
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByText(
      /Não foi possível confirmar se o cadastro foi gravado/,
    );
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Revisão e conclusão$/);
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(2));
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });

  it("DP: sem jornada na etapa 2 nem na revisão", async () => {
    montar("dp");
    await aguardarEmpresa();
    await ateARevisao();
    expect(
      screen
        .getByRole("heading", {
          level: 3,
          name: "Dados profissionais e lotação",
        })
        .closest("section"),
    ).not.toHaveTextContent("Jornada");
    expect(
      document.getElementById("nova-admissao-etapa-2-titulo")!.parentElement,
    ).not.toHaveTextContent("Jornada de trabalho");
  });
});

describe("T195 — cancelar e recomeçar", () => {
  it("Cancelar numa etapa adiante pede o descarte; continuar mantém a etapa e os dados", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    await preencherValido();
    irAteEtapa("Endereço");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Descartar esta admissão?",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Continuar preenchendo" }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(onSair).not.toHaveBeenCalled();
  });

  it("registrar outra admissão volta à etapa 1, com 25% e nada alcançado", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar outra admissão" }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(progresso()).toHaveAttribute("value", "25");
    expect(within(indicador()).queryAllByRole("button")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T195 (revisão final) — acionamento repetido e avanço pelo teclado.
// ---------------------------------------------------------------------------

/** Elementos alcançáveis por Tab, na ordem do documento. */
function tabulaveis(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]",
    ),
  ].filter(
    (e) =>
      e.tabIndex >= 0 &&
      !e.hasAttribute("disabled") &&
      e.closest("[hidden]") === null,
  );
}

describe("T195 (revisão final) — duplo clique não salta a revisão", () => {
  it("duplo clique em Continuar na etapa 3: para na revisão, e a confirmação só abre num clique novo", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    irAteEtapa("Endereço");
    const botao = botaoContinuar();
    // O navegador conta os cliques: 1 e depois 2, no mesmo lugar.
    fireEvent.click(botao, { detail: 1 });
    // O mesmo botão já virou "Confirmar admissão" — é onde o 2º clique cai.
    expect(botao).toHaveTextContent("Confirmar admissão");
    fireEvent.click(botao, { detail: 2 });
    expect(tituloDaEtapa()).toHaveTextContent(/Revisão e conclusão$/);
    expect(dialogoConfirmacao()).toBeNull();
    await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
    // Um clique novo, deliberado, abre a confirmação de sempre.
    fireEvent.click(botao, { detail: 1 });
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("duplo e triplo clique em Continuar avançam uma etapa só, sem perder nada", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.click(botaoContinuar(), { detail: 1 });
    fireEvent.click(botaoContinuar(), { detail: 2 });
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    fireEvent.click(botaoContinuar(), { detail: 1 });
    fireEvent.click(botaoContinuar(), { detail: 2 });
    fireEvent.click(botaoContinuar(), { detail: 3 });
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
  });

  it("teclado e Enter num campo seguem normais (sem contagem de cliques)", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    // Enter num campo de texto: envio implícito do navegador.
    fireEvent.submit(nome().closest("form")!);
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    // Enter ou Espaço no botão: ativação pelo teclado, `detail` 0.
    fireEvent.click(botaoContinuar(), { detail: 0 });
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
    fireEvent.click(botaoContinuar(), { detail: 0 });
    expect(tituloDaEtapa()).toHaveTextContent(/Revisão e conclusão$/);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar admissão" }),
      {
        detail: 0,
      },
    );
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
  });
});

describe("T195 (revisão final) — depois de um seletor, avança-se por Tab e Enter no botão", () => {
  it("Enter no seletor não envia; Tab leva a Cancelar, Voltar e Continuar, e Enter em Continuar avança", async () => {
    montar("dp");
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    await preencherLotacao();
    // O seletor nativo (Equipe) fica com o Enter: nada de envio a partir dele.
    fireEvent.keyDown(equipeSel(), { key: "Enter" });
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    // T196 — o último campo da etapa (Centro de custo, pesquisável), o botão
    // de opções dele e, logo depois, as ações — nesta ordem.
    const ordem = tabulaveis();
    const depois = ordem.slice(ordem.indexOf(centroSel()) + 1);
    expect(
      depois.map((e) => e.getAttribute("aria-label") ?? e.textContent),
    ).toEqual([
      "Mostrar opções de Centro de custo",
      "Cancelar",
      "Voltar",
      "Continuar",
    ]);
    const continuar = depois[3]!;
    expect(continuar).toHaveAttribute("type", "submit");
    continuar.focus();
    fireEvent.click(continuar, { detail: 0 });
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
  });
});

// ---------------------------------------------------------------------------
// T196 — Departamento, Cargo, Unidade e Centro de custo pela busca no servidor.
// ---------------------------------------------------------------------------
describe("T196 — busca nas referências da etapa 2", () => {
  it("a carga inicial não lê as listas: só confere se existe Departamento e Cargo ativos", async () => {
    montar();
    await aguardarEmpresa();
    expect(listarDepartamentos).toHaveBeenCalledWith({
      status: "ativo",
      tamanhoPagina: 1,
    });
    expect(listarCargos).toHaveBeenCalledWith({
      status: "ativo",
      tamanhoPagina: 1,
    });
    expect(listarUnidades).not.toHaveBeenCalled();
    expect(listarCentrosCusto).not.toHaveBeenCalled();
  });

  it("RH digita, o servidor busca ativos de 20 em 20 com o termo, e a admissão envia o escolhido", async () => {
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    fireEvent.change(departamentoSel(), { target: { value: " dep1 " } });
    await waitFor(() =>
      expect(listarDepartamentos).toHaveBeenLastCalledWith({
        status: "ativo",
        tamanhoPagina: 20,
        pagina: 1,
        busca: "dep1",
      }),
    );
    fireEvent.click(
      await within(listaDe(departamentoSel())).findByRole("option", {
        name: /^DEP1 — /,
      }),
    );
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0]).toMatchObject({
      departamentoId: departamento.id,
      cargoId: cargo.id,
      unidadeOrganizacionalId: unidade.id,
    });
  });

  it("DP pesquisa e escolhe as quatro referências, sem o '+' de cadastro", async () => {
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
    montar("dp");
    await aguardarEmpresa();
    abrirLotacao();
    expect(screen.queryByRole("button", { name: /^Cadastrar nov/ })).toBeNull();
    await escolher(departamentoSel(), departamento);
    await escolher(cargoSel(), cargo);
    await escolher(unidadeSel(), unidade);
    await escolher(centroSel(), { codigo: "CC1" });
    expect(escolhaDe(centroSel())).toHaveTextContent(
      "CC1 — Centro Sintético (teste)",
    );
  });

  it("o servidor segue soberano: referência escolhida pela busca e recusada na gravação aponta a lotação", async () => {
    vi.mocked(admitirColaborador).mockRejectedValue(recusa(422));
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    const aviso = await screen.findByText(/A lotação escolhida não foi aceita/);
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais e lotação$/);
    // A escolha não some: a pessoa decide trocar.
    expect(escolhaDe(cargoSel())).toHaveTextContent(
      `${cargo.codigo} — ${cargo.nome}`,
    );
  });

  it("obrigatórios seguem obrigatórios: sem Departamento, o erro fica no campo de busca, com o foco nele", async () => {
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    await escolher(cargoSel(), cargo);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(departamentoSel()).toHaveFocus());
    expect(departamentoSel()).toHaveAttribute("aria-invalid", "true");
    expect(departamentoSel()).toHaveAccessibleDescription(
      /Selecione o departamento\./,
    );
    // Abrir só por foco, não: a lista segue fechada.
    expect(departamentoSel()).toHaveAttribute("aria-expanded", "false");
  });
});
