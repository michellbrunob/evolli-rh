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
 *
 * T209 — etapa 2 (decisão da proprietária de 2026-11-17): o Cargo é texto,
 * resolvido pelo nome só ao confirmar; Departamento e Cargo deixaram de ser
 * obrigatórios — basta uma referência da lotação — e o salário bruto passou a
 * obrigatório. Os testes do comportamento genérico dos seletores usam a
 * Unidade (que tem "+" e «Criar»).
 */
import { campoPeloRotulo } from "../../test/campoPeloRotulo";
import {
  act,
  fireEvent,
  render as renderSemGuarda,
  screen,
  waitFor,
  within,
  type RenderOptions,
} from "@testing-library/react";
import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NovaAdmissaoScreen } from "./NovaAdmissaoScreen";
import { listarTabelasHorario } from "../../api/horariosClient";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  admitirColaborador,
  consultarCpfEmUso,
  descartarRascunhoAdmissao,
  type DocumentoColaboradorApi,
  enviarDocumentoDoColaborador,
  enviarFotoColaborador,
  obterRascunhoAdmissao,
  salvarRascunhoAdmissao,
} from "../../api/colaboradoresClient";
import {
  type DepartamentoApi,
  type EmpresaApi,
  type UnidadeOrganizacionalApi,
  criarCentroCusto,
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
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
} from "../../app/edicoesPendentes";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");
// T183 — a jornada opcional lê as jornadas ativas (só para o RH).
vi.mock("../../api/horariosClient");
// T178 — a consulta de CEP nunca sai da página nos testes.
vi.mock("../../api/cepClient");
// T209 — o assistente percorre etapas e seletores pesquisáveis: o caminho
// completo até a confirmação passa dos 5 s padrão em máquina carregada.
vi.setConfig({ testTimeout: 20_000 });

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
    // T209 — etapa 1.
    cpf: "52998224725",
    rg: null,
    genero: "feminino",
    contatoEmergenciaNome: "Contato Sintético Servidor",
    contatoEmergenciaTelefone: "+5531988887777",
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

const nome = () => campoPeloRotulo(/Nome completo/);
const dataNascimento = () => campoPeloRotulo(/^Data de nascimento/);
const matricula = () => campoPeloRotulo(/^Matrícula/);
const tipo = () => campoPeloRotulo(/Tipo de contratação/);
const data = () => campoPeloRotulo(/Data de admissão/);
// T179 — um seletor por referência da lotação.
// T209 — etapa 2: as linhas "Cargo e nível" e "Departamento e área" também
// têm nome; os campos são procurados pelo nome exato. O cargo é texto.
const departamentoSel = () => campoPeloRotulo(/^Departamento$/);
const cargoSel = () => campoPeloRotulo(/^Cargo$/);
const unidadeSel = () => campoPeloRotulo(/^Unidade$/);
const salarioBruto = () => campoPeloRotulo(/^Salário bruto/);
const areaSel = () => campoPeloRotulo(/^Área/);
const centroSel = () => campoPeloRotulo(/^Centro de custo$/);

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
 * T195 — "Próxima etapa" até a etapa cujo título termina em `titulo`. Falha se
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
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    if (tituloDaEtapa().id === antes) {
      throw new Error(`A etapa ${antes} não deixou avançar até ${titulo}.`);
    }
  }
}

/**
 * T179 — "Salvar" só valida e abre a confirmação. T195 — o caminho virou o
 * das etapas: "Próxima etapa" até a revisão, parando na etapa que tiver erro, e
 * nela "Concluir". Devolve o botão a clicar: na revisão, "Confirmar
 * admissão"; parado numa etapa com erro, o "Próxima etapa" dela, que repete a
 * validação da etapa.
 */
function salvar(): HTMLElement {
  for (;;) {
    const confirmar = screen.queryByRole("button", {
      name: "Cadastrar colaborador",
    });
    if (confirmar) return confirmar;
    const continuar = screen.getByRole("button", { name: "Próxima etapa" });
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

const emailPessoal = () => campoPeloRotulo(/E-mail pessoal/);
const celular = () => campoPeloRotulo(/^Telefone pessoal/);
// T209 — o telefone fixo saiu da etapa 1; quem o usava passa ao do contato
// de emergência, o segundo telefone da etapa.
const telefone = () => campoPeloRotulo(/^Telefone do contato/);
/** T209 — CPF sintético com dígitos verificadores válidos. */
const CPF_VALIDO = "529.982.247-25";
const cpf = () => campoPeloRotulo(/^CPF$/);
/**
 * T209 — sair da Nova admissão: "Cancelar" na etapa 1; nas demais (como no
 * novo rodapé), o voltar do cabeçalho — o mesmo caminho, com a guarda.
 */
const botaoSair = () =>
  screen.queryByRole("button", { name: "Cancelar" }) ??
  screen.getByRole("button", { name: "Voltar para Colaboradores" });

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
  // T209 — o cargo é digitado; ao concluir, vira o cargo do cadastro.
  fireEvent.change(cargoSel(), { target: { value: cargo.nome } });
  await escolher(unidadeSel(), unidade);
  // T209 — o salário bruto é obrigatório na etapa 2.
  fireEvent.change(salarioBruto(), { target: { value: "500000" } });
}

async function preencherValido() {
  preencherContatos();
  fireEvent.change(nome(), { target: { value: "  Pessoa Sintética Nova " } });
  fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
  fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
  fireEvent.change(matricula(), { target: { value: "mat-0900" } });
  fireEvent.change(tipo(), { target: { value: "clt" } });
  fireEvent.change(data(), { target: { value: "2026-11-03" } });
  await preencherLotacao();
}

/**
 * T195 — leva à etapa 2 (Dados profissionais). Os obrigatórios da
 * etapa 1 ainda vazios recebem um valor sintético; o já digitado fica.
 */
function abrirLotacao() {
  if (tituloDaEtapa().textContent?.endsWith("Dados profissionais")) {
    return;
  }
  if (!(nome() as HTMLInputElement).value) {
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética Etapas" } });
  }
  if (!(dataNascimento() as HTMLInputElement).value) {
    fireEvent.change(dataNascimento(), { target: { value: "1992-03-04" } });
  }
  if (!(cpf() as HTMLInputElement).value) {
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
  }
  irAteEtapa("Dados profissionais");
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
      screen.getByRole("heading", { level: 1, name: "Novo colaborador" }),
    ).toBeInTheDocument();
    const form = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    expect(form.closest("[role='dialog']")).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("mostra a empresa ativa só para leitura, sem controle para trocá-la", async () => {
    montar();
    await aguardarEmpresa();
    const empresaBloco = document.getElementById("nova-admissao-empresa")!;
    // T209 — só a frase, com o nome da empresa ativa.
    expect(empresaBloco).toHaveTextContent(
      "Você está cadastrando um novo colaborador para: Empresa Sintética (teste)",
    );
    expect(
      screen.queryByRole("combobox", { name: /Empresa/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Empresa/ }),
    ).not.toBeInTheDocument();
    expect(within(empresaBloco).queryByRole("textbox")).toBeNull();
    expect(within(empresaBloco).queryByRole("combobox")).toBeNull();
  });

  it("continuar vazio: erros só da etapa atual, ancorados nos campos, foco no primeiro; nada enviado", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(nome()).toHaveAttribute("aria-invalid", "true");
    expect(nome()).toHaveAccessibleDescription(
      "Informe o nome completo (pelo menos 3 letras).",
    );
    // T209 — CPF obrigatório; a data de nascimento passou a opcional.
    expect(cpf()).toHaveAccessibleDescription("Informe o CPF.");
    expect(dataNascimento()).not.toHaveAttribute("aria-invalid");
    // T195 — a etapa 2 ainda não foi validada: nada acusa lá.
    for (const campo of [tipo, data, departamentoSel, cargoSel]) {
      expect(campo()).not.toHaveAttribute("aria-invalid");
    }

    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.click(salvar());
    // T209 — o primeiro da etapa 2 é o cargo, onde fica o aviso de que falta
    // ao menos uma referência da lotação.
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    expect(cargoSel()).toHaveAccessibleDescription(
      "Informe ao menos o cargo, o departamento, a unidade ou o centro de custo.",
    );
    expect(tipo()).toHaveAccessibleDescription(
      /Selecione o tipo de contratação/,
    );
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(salarioBruto()).toHaveAccessibleDescription(
      /Informe o salário bruto\./,
    );
    // T179 — os opcionais vazios não acusam erro. T209 — Departamento
    // deixou de ser obrigatório.
    for (const campo of [
      departamentoSel,
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

  it("o foco vai ao primeiro campo com erro na ordem visual", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(salvar());
    // T209 — depois do nome, o primeiro obrigatório é o CPF.
    await waitFor(() => expect(cpf()).toHaveFocus());
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.click(salvar());
    // T209 — na etapa 2, primeiro o cargo (ao menos uma referência da
    // lotação), depois o tipo de contratação, a data e o salário bruto.
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    fireEvent.change(cargoSel(), { target: { value: cargo.nome } });
    fireEvent.click(salvar());
    await waitFor(() => expect(tipo()).toHaveFocus());
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(data()).toHaveFocus());
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.click(salvar());
    await waitFor(() => expect(salarioBruto()).toHaveFocus());
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    fireEvent.click(salvar());
    // Sem Departamento nem Unidade, o formulário está completo: abre a
    // confirmação.
    await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    expect(admitirColaborador).not.toHaveBeenCalled();
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
    [/^Telefone pessoal/, "11 9876-5", /precisa do DDD e do número/],
    // T209 — o telefone do contato de emergência.
    [
      /^Telefone do contato/,
      "(11) 1000-0000",
      /Informe o telefone com DDD, no formato \(00\) 00000-0000/,
    ],
    // T209 — CPF com dígito verificador errado.
    [/^CPF$/, "529.982.247-26", /Informe um CPF válido/],
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

  it("corrigir um campo limpa só o erro dele", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(salvar());
    await waitFor(() => expect(nome()).toHaveFocus());
    fireEvent.change(nome(), { target: { value: "Pessoa" } });
    expect(nome()).not.toHaveAttribute("aria-invalid");
    expect(cpf()).toHaveAttribute("aria-invalid", "true");
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
          // T209 — etapa 1: CPF só com dígitos; o segundo telefone da
          // etapa é o do contato de emergência.
          cpf: "52998224725",
          rg: null,
          genero: null,
          contatoEmergenciaNome: null,
          contatoEmergenciaTelefone: "+553133330000",
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
        },
        // T209 — o salário bruto, obrigatório, vai no bloco do contrato.
        contrato: { salarioBruto: "5000.00" },
      },
      { chaveIdempotencia: expect.stringMatching(/^[0-9a-f-]{36}$/) },
    );
    // T209 — o cargo digitado foi conferido no cadastro pelo nome.
    expect(listarCargos).toHaveBeenCalledWith(
      expect.objectContaining({ busca: cargo.nome, status: "ativo" }),
    );
    expect(criarCargo).not.toHaveBeenCalled();
  });

  it("T179 — só os obrigatórios: sem matrícula, departamento, unidade, contatos nem e-mail, o corpo os omite", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: " Pessoa Mínima " } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.change(dataNascimento(), { target: { value: "1991-02-03" } });
    fireEvent.change(tipo(), { target: { value: "estagio" } });
    fireEvent.change(data(), { target: { value: "2026-11-04" } });
    // T209 — da lotação, só o cargo (digitado); e o salário bruto.
    fireEvent.change(cargoSel(), { target: { value: cargo.nome } });
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    const [dto, opcoes] = vi.mocked(admitirColaborador).mock.calls[0]!;
    expect(dto).toEqual({
      nome: "Pessoa Mínima",
      empresaId: empresa.id,
      tipo: "estagio",
      dataAdmissao: "2026-11-04",
      motivoCodigo: "admissao_inicial",
      cargoId: cargo.id,
      contrato: { salarioBruto: "5000.00" },
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
        cpf: "52998224725",
        rg: null,
        genero: null,
        contatoEmergenciaNome: null,
        contatoEmergenciaTelefone: null,
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
      "departamentoId",
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

  // T196 — a defesa vale para as referências da busca: a consulta comum pede
  // só ativos ao servidor, 20 por página, mostra CÓDIGO — Nome e ainda
  // descarta inativo devolvido indevidamente, descontando-o da contagem
  // exibida. T209 — o cargo virou texto; ficam as três pesquisáveis.
  it.each([
    {
      rotulo: "Departamento",
      campo: () => departamentoSel(),
      listar: listarDepartamentos,
      ativo: departamento,
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
  // todas as páginas carregadas. Servidor dublê de 20 em 20. T209 — o cargo
  // virou texto: a paginação é conferida na Unidade.
  const unidadeAtiva = (n: number): UnidadeOrganizacionalApi => ({
    ...unidade,
    id: `unidade-${n}`,
    codigo: `UN${String(n).padStart(2, "0")}`,
    nome: `Unidade ${n} (teste)`,
  });
  const unidadeInativa = (n: number): UnidadeOrganizacionalApi => ({
    ...unidade,
    id: `inativo-${n}`,
    codigo: `IN${String(n).padStart(2, "0")}`,
    nome: `Inativo ${n} (teste)`,
    status: "inativo",
  });
  const faixa = <T,>(de: number, ate: number, f: (n: number) => T) =>
    Array.from({ length: ate - de + 1 }, (_, k) => f(de + k));

  /**
   * Abre a Unidade e clica "Mostrar mais" até o fim. `contagens` é o anúncio
   * EXATO de cada página (comparação por igualdade: um trecho não basta) e
   * diz quantas páginas devem ser pedidas. `total` é o total que o servidor
   * informa (padrão: o tamanho real da lista).
   */
  async function paginarAteOFim({
    lista,
    contagens,
    total = lista.length,
  }: {
    lista: readonly UnidadeOrganizacionalApi[];
    contagens: readonly string[];
    total?: number;
  }) {
    vi.mocked(listarUnidades).mockImplementation(async (q = {}) => {
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
    const raiz = unidadeSel().closest(".seletor-referencia") as HTMLElement;
    const status = () => raiz.querySelector('[role="status"]')?.textContent;
    const buscas = () =>
      vi
        .mocked(listarUnidades)
        .mock.calls.filter(([q]) => q?.tamanhoPagina === 20);
    const ativosDaLista = lista
      .filter((c) => c.status === "ativo")
      .map((c) => `${c.codigo} — ${c.nome}`);

    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
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
      within(listaDe(unidadeSel()))
        .queryAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(ativosDaLista);
    // Fim: o botão some, nada mais é pedido e o foco volta ao campo.
    expect(
      within(raiz).queryByRole("button", { name: /Mostrar mais|Carregando/ }),
    ).toBeNull();
    await waitFor(() => expect(unidadeSel()).toHaveFocus());
    expect(buscas()).toHaveLength(contagens.length);
  }

  it.each([
    {
      caso: "um inativo na primeira página",
      lista: [unidadeInativa(1), ...faixa(1, 40, unidadeAtiva)],
      contagens: [
        "40 resultados; 19 exibidos.",
        "40 resultados; 39 exibidos.",
        "40 resultados; 40 exibidos.",
      ],
    },
    {
      caso: "um inativo numa página intermediária",
      lista: [
        ...faixa(1, 20, unidadeAtiva),
        unidadeInativa(1),
        ...faixa(21, 40, unidadeAtiva),
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
      lista: [...faixa(1, 20, unidadeInativa), ...faixa(1, 5, unidadeAtiva)],
      contagens: ["5 resultados; 0 exibidos.", "5 resultados; 5 exibidos."],
    },
    {
      caso: "sem inativos",
      lista: faixa(1, 45, unidadeAtiva),
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
  // T196 — o servidor informa um total maior e a última página vem
  // incompleta (não vazia): a paginação termina pela conta normal e a
  // contagem final é o que foi carregado, não o total informado.
  it("paginação: ao terminar, a contagem é o que foi carregado, mesmo com total informado maior", async () => {
    await paginarAteOFim({
      lista: faixa(1, 25, unidadeAtiva),
      total: 30,
      contagens: ["30 resultados; 20 exibidos.", "25 resultados; 25 exibidos."],
    });
  });

  it("paginação: página vazia do servidor encerra, mesmo com total informado maior", async () => {
    await paginarAteOFim({
      lista: faixa(1, 25, unidadeAtiva),
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
    fireEvent.change(campoPeloRotulo(/^CEP/), {
      target: { value: "30140071" },
    });
    fireEvent.change(campoPeloRotulo(/^Cidade$/), {
      target: { value: "Cidade Resumo Sintética" },
    });
    fireEvent.change(campoPeloRotulo(/^Logradouro$/), {
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
    // T209 — o cargo é digitado e só vira referência ao confirmar: a linha
    // dele no resumo não é conferida aqui.
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
    fireEvent.change(campoPeloRotulo(/^CEP/), {
      target: { value: "30140071" },
    });
    // T209 — completar o CEP consulta sozinho.
    await waitFor(() =>
      expect(campoPeloRotulo(/^Logradouro$/)).toHaveValue("Avenida Sintética"),
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
    expect(cargoSel()).toHaveValue(cargo.nome);
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(campoPeloRotulo(/^CEP/)).toHaveValue("30140-071");
    expect(
      document.getElementById("nova-admissao-cep-status"),
    ).toHaveTextContent(/^Endereço localizado pelo CEP$/);
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
    // T209 — antes de admitir, o cargo digitado é conferido no cadastro (uma
    // vez só): o envio sai logo depois.
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(listarCargos).mock.calls.filter(([q]) => q?.busca),
    ).toHaveLength(1);
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
      // T209 — a ajuda da matrícula virou a dica "?"; fica só o erro.
      "Esta matrícula já está em uso nesta empresa.",
    );
    expect(emailPessoal()).not.toHaveAttribute("aria-invalid");
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(matricula()).toHaveValue("MAT-0900");
    expect(tipo()).toHaveValue("clt");
    expect(data()).toHaveValue("2026-11-03");
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    expect(cargoSel()).toHaveValue(cargo.nome);
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
    // `type="email"` apara as pontas no próprio campo; o resto fica como digitado.
    expect(emailPessoal()).toHaveValue("Pessoa.Nova@Exemplo.TEST");
    expect(celular()).toHaveValue("(31) 99999-0000");
    expect(salvar()).toBeEnabled();
    // T209 — sem bloco de revisão no topo: o erro fica embaixo do campo.
    expect(screen.queryByRole("group", { name: /^Revise / })).toBeNull();
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
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

  it("409 com os dois: os dois campos marcados, cada um com a sua mensagem, e foco no primeiro da tela", async () => {
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
    expect(matricula()).toHaveAccessibleDescription(
      /Esta matrícula já está em uso nesta empresa/,
    );
    // T209 — sem bloco de revisão no topo: o erro fica embaixo do campo.
    expect(screen.queryByRole("group", { name: /^Revise / })).toBeNull();
    // Corrigir um tira só a mensagem dele.
    fireEvent.change(matricula(), { target: { value: "MAT-0901" } });
    expect(matricula()).not.toHaveAttribute("aria-invalid");
    expect(emailPessoal()).toHaveAttribute("aria-invalid", "true");
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
    // T209 — sem bloco de revisão no topo: o erro fica embaixo do campo.
    expect(screen.queryByRole("group", { name: /^Revise / })).toBeNull();
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

describe("T179 — máscaras na Nova admissão", () => {
  it("celular e telefone: máscara brasileira progressiva, dica de formato e colagem com +55", async () => {
    montar();
    await aguardarEmpresa();
    expect(celular()).toHaveAttribute("inputmode", "tel");
    // T209 — a dica agora é "Com DDD."; o formato fica no placeholder.
    expect(celular()).toHaveAccessibleName("Telefone pessoal");
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
    expect(dto.perfilPessoal.contatoEmergenciaTelefone).toBe("+551133330000");
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
    expect(dto.perfilPessoal.contatoEmergenciaTelefone).toBe("+5555999998888");
  });

  it("CEP: máscara 00000-000 (T209: o endereço é sempre do Brasil)", async () => {
    montar();
    await aguardarEmpresa();
    const cep = () => campoPeloRotulo(/^CEP/);
    expect(cep()).toHaveAttribute("inputmode", "numeric");
    expect(cep()).toHaveAttribute("placeholder", "00000-000");
    fireEvent.change(cep(), { target: { value: "301400" } });
    expect(cep()).toHaveValue("30140-0");
  });
});

describe("Nova admissão — cancelar", () => {
  it("o país sugerido, sozinho, não conta como dado digitado", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.click(botaoSair());
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("escolher só uma referência da lotação já conta como alteração", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    await escolher(unidadeSel(), unidade);
    fireEvent.click(botaoSair());
    expect(
      screen.getByRole("alertdialog", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("sem nada digitado, sai direto", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.click(botaoSair());
    expect(onSair).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("com dados, pede confirmação; continuar mantém tudo", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(botaoSair());
    const confirmacao = screen.getByRole("alertdialog", {
      name: "Sair sem salvar?",
    });
    // T176 — "Nada foi salvo", e não "Nada foi enviado": depois de uma
    // tentativa recusada, algo FOI enviado; o que não houve foi gravação.
    expect(confirmacao).toHaveAccessibleDescription(DESCARTE_COMUM);
    expect(confirmacao).not.toHaveTextContent(/Nada foi enviado/);
    fireEvent.click(
      within(confirmacao).getByRole("button", {
        name: "Continuar editando",
      }),
    );
    expect(onSair).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
    fireEvent.click(botaoSair());
    expect(
      screen.getByRole("alertdialog", { name: "Sair sem salvar?" }),
    ).toHaveAccessibleDescription(DESCARTE_COMUM);
  });

  it("com dados, descartar sai sem enviar nada", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(matricula(), { target: { value: "MAT-1" } });
    fireEvent.click(botaoSair());
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
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
    // T209 — o cargo gravado veio do nome digitado; a linha dele existe.
    expect(
      screen.getByText(
        /^Cargo(: CAR1 — Cargo Sintético \(teste\)| registrado)$/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Unidade: UNI1 — Unidade Sintética (teste)"),
    ).toBeInTheDocument();
    // Módulo 1: o que o SERVIDOR gravou, bloco a bloco.
    const dadosPessoais = screen.getByRole("region", {
      name: "Dados básicos",
    });
    expect(dadosPessoais).toHaveTextContent("20/05/1990");
    // T209 — CPF exibido com a máscara; gênero pelo rótulo; emergência.
    expect(dadosPessoais).toHaveTextContent("529.982.247-25");
    expect(dadosPessoais).toHaveTextContent("Feminino");
    expect(dadosPessoais).not.toHaveTextContent("feminino");
    expect(dadosPessoais).toHaveTextContent("Contato Sintético Servidor");
    expect(dadosPessoais).toHaveTextContent("(31) 98888-7777");
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
      perfilPessoal: { ...resposta.perfilPessoal!, genero: null },
      contatos: null,
    });
    await admitirComSucesso();
    const matriculaGravada = screen.getByText("Matrícula", {
      selector: "dt",
    }).nextElementSibling;
    expect(matriculaGravada).toHaveTextContent("Não informada");
    expect(screen.getByText("Unidade: Não informada")).toBeInTheDocument();
    const generoGravado = within(
      screen.getByRole("region", { name: "Dados básicos" }),
    ).getByText("Gênero", { selector: "dt" }).nextElementSibling;
    expect(generoGravado).toHaveTextContent("Não informado");
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
    fireEvent.click(screen.getByRole("button", { name: "Revisar contatos" }));
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

const campoCep = () => campoPeloRotulo(/^CEP/);
// T209 — etapa 3: "Logradouro e número" e "Cidade e estado" são grupos;
// cada campo tem o próprio nome.
const logradouro = () => campoPeloRotulo(/^Logradouro$/);
// T209 — "Número do registro" (etapa 2) também começa por "Número".
const numero = () => campoPeloRotulo(/^Número(?! do registro)/);
const complemento = () => campoPeloRotulo(/^Complemento/);
const bairro = () => campoPeloRotulo(/^Bairro/);
const cidade = () => campoPeloRotulo(/^Cidade$/);
const estado = () => campoPeloRotulo(/^Estado$/);
const botaoConsultarDeNovo = () =>
  screen.queryByRole("button", { name: "Consultar de novo" });
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

describe("T209 — etapa 3: endereço residencial", () => {
  beforeEach(() => {
    vi.mocked(consultarCep).mockReset();
    vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
  });

  it("uma seção 'Endereço residencial', sem País nem 'Buscar CEP'; tudo opcional", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    const secao = screen.getByRole("region", { name: "Endereço residencial" });
    expect(secao).toHaveTextContent(
      "Digite o CEP e o Evolli completa o endereço.",
    );
    expect(screen.queryByLabelText(/^País/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Buscar CEP/ })).toBeNull();
    expect(
      screen.getByRole("group", { name: "Logradouro e número" }),
    ).toContainElement(numero());
    expect(
      screen.getByRole("group", { name: "Cidade e estado" }),
    ).toContainElement(estado());
    expect(campoCep()).toHaveAttribute("placeholder", "00000-000");
    expect(campoCep()).toHaveAttribute("inputmode", "numeric");
    expect(logradouro()).toHaveAttribute("placeholder", "Rua, avenida…");
    expect(logradouro()).toHaveAttribute("maxlength", "200");
    expect(numero()).toHaveAttribute("placeholder", "Nº");
    expect(numero()).toHaveAttribute("maxlength", "20");
    expect(complemento()).toHaveAttribute("placeholder", "Apto, bloco, sala…");
    expect(complemento()).toHaveAttribute("maxlength", "120");
    expect(bairro()).toHaveAttribute("maxlength", "120");
    expect(cidade()).toHaveAttribute("placeholder", "Cidade");
    expect(cidade()).toHaveAttribute("maxlength", "120");
    for (const campo of [campoCep(), logradouro(), cidade(), estado()]) {
      expect(campo).not.toBeRequired();
    }
    // Sem nada preenchido, a etapa avança.
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
  });

  it("o estado é uma das 27 siglas, em ordem alfabética do nome", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    const opcoes = [...(estado() as HTMLSelectElement).options].map(
      (o) => o.value,
    );
    expect(opcoes).toEqual([
      "",
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO",
    ]);
    expect((estado() as HTMLSelectElement).options[0]).toHaveTextContent("UF");
  });

  it("completar os 8 dígitos consulta sozinho e preenche o resto; 'Endereço localizado pelo CEP'", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    fireEvent.change(numero(), { target: { value: "100" } });
    fireEvent.change(complemento(), { target: { value: "Sala 2" } });
    digitarCep("3014");
    expect(consultarCep).not.toHaveBeenCalled();
    digitarCep(" 30.140-071 ");
    // A máscara limpa pontos e espaços já na digitação.
    expect(campoCep()).toHaveValue("30140-071");
    await waitFor(() => expect(consultarCep).toHaveBeenCalledWith("30140071"));
    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));
    expect(bairro()).toHaveValue("Bairro Sintético");
    expect(cidade()).toHaveValue("Cidade Sintética");
    expect(estado()).toHaveValue("MG");
    // Número e complemento nunca são tocados.
    expect(numero()).toHaveValue("100");
    expect(complemento()).toHaveValue("Sala 2");
    expect(statusCep()).toHaveAttribute("role", "status");
    expect(statusCep()).toHaveTextContent(/^Endereço localizado pelo CEP$/);
    expect(statusCep()).toHaveClass("nova-admissao__cep-status--encontrado");

    // Sair do campo com o mesmo CEP não repergunta.
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
    await act(async () => {});
    expect(consultarCep).not.toHaveBeenCalled();
    expect(campoCep()).not.toHaveAttribute("aria-invalid");
  });

  it("durante a busca, 'Buscando endereço…'; sair do campo não pergunta de novo", async () => {
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
    await waitFor(() =>
      expect(statusCep()).toHaveTextContent("Buscando endereço…"),
    );
    fireEvent.blur(campoCep());
    expect(consultarCep).toHaveBeenCalledTimes(1);
    await act(async () => concluir(RESPOSTA_CEP));
    expect(statusCep()).toHaveTextContent(/^Endereço localizado pelo CEP$/);
  });

  it("resposta obsoleta (o CEP mudou durante a busca) é descartada", async () => {
    let concluir: (v: EnderecoDoCepApi) => void = () => {};
    vi.mocked(consultarCep).mockImplementationOnce(
      () =>
        new Promise<EnderecoDoCepApi>((resolve) => {
          concluir = resolve;
        }),
    );
    vi.mocked(consultarCep).mockImplementationOnce(
      () => new Promise<EnderecoDoCepApi>(() => {}),
    );
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    digitarCep("30140071");
    await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(1));
    digitarCep("01310100");
    await act(async () => concluir(RESPOSTA_CEP));
    expect(logradouro()).toHaveValue("");
    expect(cidade()).toHaveValue("");
    expect(statusCep()).not.toHaveTextContent("Endereço localizado pelo CEP");
  });

  it("sem sigla, o estado por extenso vira a sigla do seletor", async () => {
    vi.mocked(consultarCep).mockResolvedValue({ ...RESPOSTA_CEP, uf: null });
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    digitarCep("30140071");
    await waitFor(() => expect(cidade()).toHaveValue("Cidade Sintética"));
    expect(estado()).toHaveValue("MG");
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalled());
    expect(
      vi.mocked(admitirColaborador).mock.calls.at(-1)![0].endereco,
    ).toMatchObject({ estado: "MG" });
  });

  it("campo já digitado é mantido, com aviso; 'Usar endereço do CEP' substitui e o foco volta ao CEP", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    fireEvent.change(logradouro(), { target: { value: "Rua Já Digitada" } });
    // Igual ao sugerido, a menos de caixa: não conta como conflito.
    fireEvent.change(bairro(), { target: { value: "bairro sintético" } });
    digitarCep("30140071");

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
    expect(campoCep()).toHaveFocus();
  });

  it("os campos seguem editáveis e a admissão leva o valor editado, com país Brasil", async () => {
    montar();
    await aguardarEmpresa();
    await abrirEndereco();
    digitarCep("30140-071");
    await waitFor(() => expect(logradouro()).toHaveValue("Avenida Sintética"));

    fireEvent.change(logradouro(), { target: { value: "Avenida Editada" } });
    fireEvent.change(estado(), { target: { value: "SP" } });
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
      estado: "SP",
      numero: null,
      complemento: null,
    });
    // Só o CEP saiu para a consulta — nenhum dado da pessoa.
    expect(vi.mocked(consultarCep).mock.calls).toEqual([["30140071"]]);
  });

  it.each([
    [404, "CEP não encontrado. Preencha o endereço manualmente.", false],
    [
      503,
      "Não foi possível consultar o CEP agora. Preencha o endereço manualmente ou tente de novo.",
      true,
    ],
    [
      429,
      "Muitas consultas de CEP em pouco tempo. Aguarde alguns minutos ou preencha manualmente.",
      true,
    ],
    [400, "CEP inválido. Use os 8 dígitos.", false],
    [
      403,
      "A consulta de CEP está indisponível agora. Preencha o endereço manualmente.",
      true,
    ],
  ])(
    "recusa %s: mensagem clara, sem bloquear; 'Consultar de novo' só quando faz sentido",
    async (status, mensagem, repetivel) => {
      vi.mocked(consultarCep).mockRejectedValue(recusaCep(status));
      montar();
      await aguardarEmpresa();
      await abrirEndereco();
      digitarCep("30140071");
      await waitFor(() => expect(statusCep()).toHaveTextContent(mensagem));
      expect(campoCep()).not.toHaveAttribute("aria-invalid");
      if (repetivel) {
        vi.mocked(consultarCep).mockResolvedValue(RESPOSTA_CEP);
        fireEvent.click(botaoConsultarDeNovo()!);
        await waitFor(() => expect(consultarCep).toHaveBeenCalledTimes(2));
        await waitFor(() =>
          expect(statusCep()).toHaveTextContent(
            /^Endereço localizado pelo CEP$/,
          ),
        );
        expect(botaoConsultarDeNovo()).toBeNull();
      } else {
        expect(botaoConsultarDeNovo()).toBeNull();
      }
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

// T200 — o diálogo único da guarda: a lista das telas, o descarte e a frase
// que a Nova admissão declara (T179: certo que nada foi salvo, ou incerto).
const DESCARTE_COMUM =
  /^Há alterações não salvas em: Nova admissão Saindo agora, elas serão descartadas\. Nada da Nova admissão foi salvo\.$/;
const DESCARTE_INCERTO =
  /^Há alterações não salvas em: Nova admissão Saindo agora, elas serão descartadas\. Um envio anterior da Nova admissão pode ter sido registrado: confira em Colaboradores\.$/;

describe("T179 (revisão final) — descarte depois de envio incerto", () => {
  const dialogoDescarte = () =>
    screen.getByRole("alertdialog", { name: "Sair sem salvar?" });

  it("cancelamento comum: 'Nada foi salvo.'", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(botaoSair());
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
    fireEvent.click(botaoSair());
    const dialogo = dialogoDescarte();
    expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
    expect(dialogo).not.toHaveTextContent(/Nada da Nova admissão foi salvo/);
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Sair sem salvar" }),
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
    expect(dialogo).not.toHaveTextContent(/Nada da Nova admissão foi salvo/);
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
    fireEvent.click(botaoSair());
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
      fireEvent.click(botaoSair());
      const dialogo = dialogoDescarte();
      expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
      expect(dialogo).not.toHaveTextContent(/Nada da Nova admissão foi salvo/);
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
    fireEvent.click(botaoSair());
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
    await act(async () => {});
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
    expect(dto.perfilPessoal.contatoEmergenciaTelefone).toBe("+5555999998888");
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
    screen.getByRole("alertdialog", { name: "Sair sem salvar?" });

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
    fireEvent.click(botaoSair());
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
        name: "Continuar editando",
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
        /não foi gravado|não foi enviado|Nada foi salvo|Nada da Nova admissão foi salvo/,
      );
      esperarFormularioPreservado();
      const dialogo = descricaoDoDescarte();
      expect(dialogo).toHaveAccessibleDescription(DESCARTE_INCERTO);
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Continuar editando" }),
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
  fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
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

  it('o RH vê os dois "+", ao lado de Departamento e Unidade; o cargo é texto, sem "+"', async () => {
    montar("rh");
    await aguardarEmpresa();
    for (const [rotulo, seletor] of [
      ["Cadastrar novo departamento", departamentoSel],
      ["Cadastrar nova unidade", unidadeSel],
    ] as const) {
      const botao = botaoMais(rotulo);
      expect(botao).toBeEnabled();
      // Na mesma linha do seletor, dentro do mesmo campo.
      expect(botao.parentElement).toContainElement(seletor());
    }
    expect(
      screen.queryByRole("button", { name: "Cadastrar novo cargo" }),
    ).toBeNull();
    expect(cargoSel()).toHaveAttribute("type", "text");
    expect(cargoSel()).toHaveAttribute("placeholder", "Ex.: Analista de RH");
    // T209 — nenhuma referência da lotação é obrigatória sozinha.
    expect(departamentoSel()).not.toHaveAttribute("aria-required");
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
    expect(botaoMais("Cadastrar nova unidade")).toBeDisabled();
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
      "Cadastrar nova unidade",
      "UNI_X",
      "Unidade descartada",
    );
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(dialogoReferencia()).toBeNull();
    expect(unidadeSel()).toHaveFocus();
    admissaoPreservada();
    expect(matricula()).toHaveValue("X");
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
    expect(criarUnidade).not.toHaveBeenCalled();
    // Reabrir começa vazio.
    fireEvent.click(botaoMais("Cadastrar nova unidade"));
    const reaberto = await screen.findByRole("dialog", {
      name: "Cadastrar unidade",
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
    vi.mocked(listarUnidades).mockResolvedValue(
      paginado([
        { ...unidade, id: "u-a", codigo: "AAA", nome: "Primeira" },
        { ...unidade, id: "u-z", codigo: "ZZZ", nome: "Última" },
      ]),
    );
    montar("rh");
    await aguardarEmpresa();
    await cadastrarPeloMais(
      "Cadastrar nova unidade",
      unidadeNova.codigo,
      unidadeNova.nome,
    );
    await waitFor(() => expect(dialogoReferencia()).toBeNull());
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    await within(listaDe(unidadeSel())).findByRole("option", {
      name: /^AAA/,
    });
    expect(
      within(listaDe(unidadeSel()))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["AAA — Primeira", "ZZZ — Última"]);
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      "UNI_RAPIDA — Unidade Rápida (teste)",
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
    vi.mocked(criarUnidade).mockRejectedValue(new TypeError("Failed to fetch"));
    montar("rh");
    await aguardarEmpresa();
    // A Unidade nem é lida na carga inicial.
    expect(listarUnidades).not.toHaveBeenCalled();
    // O servidor gravou antes de a resposta se perder: a recarga já o traz.
    vi.mocked(listarUnidades).mockResolvedValue(
      paginado([unidade, unidadeNova]),
    );
    const dialogo = await cadastrarPeloMais(
      "Cadastrar nova unidade",
      unidadeNova.codigo,
      unidadeNova.nome,
    );
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert")).toHaveTextContent(
        "Não foi possível confirmar se o cadastro foi feito. A lista foi atualizada: confira se a referência já aparece antes de tentar de novo.",
      ),
    );
    // T196 — uma leitura de um item confere o servidor; a busca do seletor é
    // descartada e relida na próxima abertura.
    await waitFor(() => expect(listarUnidades).toHaveBeenCalledTimes(1));
    expect(listarUnidades).toHaveBeenLastCalledWith({
      status: "ativo",
      tamanhoPagina: 1,
    });
    // Só a referência daquele "+" é relida.
    expect(listarDepartamentos).toHaveBeenCalledTimes(1);
    expect(listarCargos).toHaveBeenCalledTimes(1);
    expect(dialogoReferencia()).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    expect(
      await within(listaDe(unidadeSel())).findByRole("option", {
        name: `${unidadeNova.codigo} — ${unidadeNova.nome}`,
      }),
    ).toBeInTheDocument();
    // Nada foi escolhido por conta própria.
    expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
  });

  it("rede e recarga falha: diz que a lista não pôde ser atualizada, e a lista e a admissão ficam", async () => {
    vi.mocked(criarUnidade).mockRejectedValue(new TypeError("Failed to fetch"));
    montar("rh");
    await aguardarEmpresa();
    preencherParteDaAdmissao();
    vi.mocked(listarUnidades).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const dialogo = await cadastrarPeloMais(
      "Cadastrar nova unidade",
      unidadeNova.codigo,
      unidadeNova.nome,
    );
    await waitFor(() =>
      expect(within(dialogo).getByRole("alert")).toHaveTextContent(
        "Não foi possível confirmar se o cadastro foi feito, e a lista não pôde ser atualizada.",
      ),
    );
    expect(within(dialogo).getByRole("alert")).not.toHaveTextContent(
      /foi atualizada/,
    );
    expect(listarUnidades).toHaveBeenCalledTimes(1);
    expect(dialogoReferencia()).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    // T196 — a busca também falha: estado claro, escolha e admissão mantidas.
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    expect(
      await screen.findByText(
        "Não foi possível carregar unidades. A escolha atual foi mantida.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
    expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
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
      vi.mocked(criar as typeof criarUnidade)
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(nova as UnidadeOrganizacionalApi);
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
      vi.mocked(listar as typeof listarUnidades).mockReturnValueOnce(
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
      vi.mocked(criar as typeof criarUnidade)
        .mockResolvedValueOnce(nova as UnidadeOrganizacionalApi)
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));
      montar("rh");
      await aguardarEmpresa();
      await preencherValido();
      await cadastrarPeloMais(rotulo, nova.codigo, nova.nome);
      await waitFor(() => expect(dialogoReferencia()).toBeNull());
      expect(escolhaDe(seletor())).toHaveTextContent(
        `${nova.codigo} — ${nova.nome}`,
      );

      vi.mocked(listar as typeof listarUnidades).mockResolvedValueOnce(
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

  it("T209 — empresa sem Departamento nem Cargo ativos: sem aviso nem bloqueio; o RH digita o cargo, que é criado ao confirmar", async () => {
    vi.mocked(listarDepartamentos).mockResolvedValue(paginado([]));
    vi.mocked(listarCargos).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    expect(screen.queryByText(/ainda não tem cadastro ativo de/)).toBeNull();

    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.change(cargoSel(), { target: { value: `  ${cargoNovo.nome} ` } });
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    // Sem cargo com esse nome no cadastro: o RH o cria, só com nome e empresa.
    expect(criarCargo).toHaveBeenCalledTimes(1);
    expect(criarCargo).toHaveBeenCalledWith({
      nome: cargoNovo.nome,
      empresaId: empresa.id,
    });
    const dto = vi.mocked(admitirColaborador).mock.calls[0]![0];
    expect(dto.cargoId).toBe(cargoNovo.id);
    expect(Object.keys(dto)).not.toContain("departamentoId");
  });
});

// ---------------------------------------------------------------------------
// T195 — cadastro individual em quatro etapas.
// ---------------------------------------------------------------------------

const indicador = () =>
  screen.getByRole("navigation", { name: "Etapas do cadastro" });
// T209 — o progresso fica no rodapé fixo do assistente.
const rodapeDoAssistente = () =>
  document.querySelector<HTMLElement>(".cadastro-etapas__rodape")!;
const progresso = () => within(rodapeDoAssistente()).getByRole("progressbar");
const passoDoIndicador = (n: number) =>
  within(indicador()).getAllByRole("listitem")[n - 1]!;
const botaoVoltar = () => screen.getByRole("button", { name: "Voltar" });
const botaoContinuar = () =>
  screen.getByRole("button", { name: "Próxima etapa" });

/** As etapas 1 e 2 válidas e a 3 vazia: chega à revisão. */
async function ateARevisao() {
  await preencherValido();
  irAteEtapa("Documentos");
}

describe("T195 — quatro etapas: indicador e progresso", () => {
  it("começa na etapa 1, com 25%, a etapa atual marcada e as demais não iniciadas, sem botão", async () => {
    montar();
    await aguardarEmpresa();
    expect(tituloDaEtapa()).toHaveTextContent("Etapa 1 de 4: Dados básicos");
    expect(
      within(rodapeDoAssistente()).getByText("25% concluído"),
    ).toBeVisible();
    expect(progresso()).toHaveAttribute("value", "25");
    expect(progresso()).toHaveAccessibleName("25% concluído");
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
      ["Etapa 2 de 4: Dados profissionais", "50"],
      ["Etapa 3 de 4: Endereço", "75"],
      ["Etapa 4 de 4: Documentos", "100"],
    ] as const) {
      fireEvent.click(botaoContinuar());
      expect(tituloDaEtapa()).toHaveTextContent(titulo);
      await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
      expect(progresso()).toHaveAttribute("value", pct);
    }
    // Na revisão, o botão principal é "Concluir".
    expect(screen.queryByRole("button", { name: "Próxima etapa" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
    ).toHaveAttribute("type", "submit");
    // As três anteriores, concluídas, viram botões com o estado no nome.
    expect(within(indicador()).getAllByRole("button")).toHaveLength(3);
    for (const nome of [
      "Etapa 1: Dados básicos, concluída",
      "Etapa 2: Dados profissionais, concluída",
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
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.submit(nome().closest("form")!);
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
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
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
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
    fireEvent.change(screen.getByLabelText("RG"), {
      target: { value: "12.345.678-9" },
    });
    irAteEtapa("Endereço");
    fireEvent.change(logradouro(), { target: { value: "Rua Sintética" } });
    fireEvent.click(botaoVoltar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    await waitFor(() => expect(tituloDaEtapa()).toHaveFocus());
    // Apagar um obrigatório e voltar de novo: Voltar não acusa nada.
    fireEvent.change(tipo(), { target: { value: "" } });
    fireEvent.click(botaoVoltar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(tipo()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    // Tudo o que foi digitado continua, em todas as etapas.
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    expect(screen.getByLabelText("RG")).toHaveValue("12.345.678-9");
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
        name: "Etapa 4: Documentos, visitada",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
    expect(progresso()).toHaveAttribute("value", "100");
  });

  it("ir adiante pelo indicador para na etapa com erro, com o foco no campo", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 2: Dados profissionais, concluída",
      }),
    );
    fireEvent.change(data(), { target: { value: "" } });
    fireEvent.click(
      within(indicador()).getByRole("button", {
        name: "Etapa 4: Documentos, visitada",
      }),
    );
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    await waitFor(() => expect(data()).toHaveFocus());
    expect(data()).toHaveAccessibleDescription(/Informe a data de admissão/);
    expect(dialogoConfirmacao()).toBeNull();
  });

  it("sem a etapa atual válida, Continuar não avança e só ela é validada", async () => {
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    // T209 — os obrigatórios da etapa 2 em ordem; só a matrícula inválida.
    fireEvent.change(cargoSel(), { target: { value: cargo.nome } });
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    fireEvent.change(matricula(), { target: { value: "x" } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
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
  it("T213 — a etapa 4 é Documentos: cinco principais Pendente, Outros documentos, nada obrigatório", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
    const principais = screen
      .getByRole("heading", { level: 3, name: "Documentos principais" })
      .closest("section")!;
    for (const nome of [
      "RG",
      "CPF",
      "Comprovante de endereço",
      "Carteira de Trabalho",
      "Certidões",
    ]) {
      expect(
        within(principais).getByRole("button", {
          name: `Enviar arquivo de ${nome}`,
        }),
      ).toBeInTheDocument();
    }
    expect(within(principais).getAllByText("Pendente")).toHaveLength(5);
    expect(principais).toHaveTextContent("0 de 5 anexados.");
    expect(
      screen.getByRole("heading", { level: 3, name: "Outros documentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
    ).toBeEnabled();
  });

  it("T213 — campos de arquivo: a foto e um por documento, nenhum obrigatório", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    // T213 — além da foto (PNG ou JPEG), um campo por documento da etapa 4
    // (PDF, JPG ou PNG); nenhum é obrigatório.
    const arquivos = [...document.querySelectorAll('input[type="file"]')];
    expect(arquivos[0]).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(arquivos.slice(1)).toHaveLength(5);
    for (const campo of arquivos) expect(campo).not.toBeRequired();
  });

  it("Confirmar admissão abre a mesma confirmação e envia uma vez, com a chave", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
    );
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
    // T209 — sem bloco de revisão no topo: o erro fica embaixo do campo.
    expect(screen.queryByRole("group", { name: /^Revise / })).toBeNull();
    // O outro campo, na etapa dele, já traz a própria mensagem.
    expect(matricula()).toHaveAttribute("aria-invalid", "true");
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
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(2));
    expect(chaveDaChamada(1)).toBe(chaveDaChamada(0));
  });
});

describe("T195 — cancelar e recomeçar", () => {
  it("Cancelar numa etapa adiante pede o descarte; continuar mantém a etapa e os dados", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    await preencherValido();
    irAteEtapa("Endereço");
    fireEvent.click(botaoSair());
    const dialogo = await screen.findByRole("alertdialog", {
      name: "Sair sem salvar?",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Continuar editando" }),
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
    // O mesmo botão já virou "Concluir" — é onde o 2º clique cai.
    expect(botao).toHaveTextContent("Cadastrar colaborador");
    fireEvent.click(botao, { detail: 2 });
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
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
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
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
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    // Enter ou Espaço no botão: ativação pelo teclado, `detail` 0.
    fireEvent.click(botaoContinuar(), { detail: 0 });
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
    fireEvent.click(botaoContinuar(), { detail: 0 });
    expect(tituloDaEtapa()).toHaveTextContent(/Documentos$/);
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
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
    // O seletor nativo (Nível) fica com o Enter: nada de envio a partir dele.
    // T209 — a Equipe saiu da tela.
    fireEvent.keyDown(screen.getByLabelText("Nível"), { key: "Enter" });
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    // T196 — o seletor pesquisável é seguido do botão de opções dele.
    const ordem = tabulaveis();
    expect(
      ordem[ordem.indexOf(centroSel()) + 1]!.getAttribute("aria-label"),
    ).toBe("Mostrar opções de Centro de custo");
    // T209 — o último campo da etapa (Pensão alimentícia) e, logo depois, as
    // ações — nesta ordem.
    const depois = ordem.slice(
      ordem.indexOf(campoPeloRotulo(/^Pensão alimentícia/)) + 1,
    );
    expect(
      depois.map((e) => e.getAttribute("aria-label") ?? e.textContent),
    ).toEqual(["Voltar", "Próxima etapa"]);
    const continuar = depois[1]!;
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

  it("DP pesquisa e escolhe as três referências pesquisáveis, sem o '+' de cadastro", async () => {
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
    await escolher(unidadeSel(), unidade);
    await escolher(centroSel(), { codigo: "CC1" });
    expect(escolhaDe(departamentoSel())).toHaveTextContent(
      `${departamento.codigo} — ${departamento.nome}`,
    );
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
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
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    // A escolha não some: a pessoa decide trocar.
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `${unidade.codigo} — ${unidade.nome}`,
    );
    expect(cargoSel()).toHaveValue(cargo.nome);
  });
});

// ---------------------------------------------------------------------------
// T209 — etapa 2 (decisão da proprietária de 2026-11-17): o cargo é texto e
// vira referência só ao confirmar; da lotação, basta uma referência; o
// salário bruto é obrigatório.
// ---------------------------------------------------------------------------
describe("T209 — etapa 2: cargo digitado, ao menos uma referência e salário bruto", () => {
  it("o cargo digitado com outra caixa e espaços vira o cargo existente de mesmo nome; nada é criado", async () => {
    vi.mocked(listarCargos).mockResolvedValue(
      paginado([
        { ...cargo, id: "c-parecido", codigo: "CAR9", nome: "Cargo Sintético" },
        cargo,
      ]),
    );
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    fireEvent.change(cargoSel(), {
      target: { value: "  cargo   SINTÉTICO (teste) " },
    });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(listarCargos).toHaveBeenLastCalledWith(
      expect.objectContaining({
        busca: "cargo SINTÉTICO (teste)",
        status: "ativo",
      }),
    );
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0].cargoId).toBe(
      cargo.id,
    );
    expect(criarCargo).not.toHaveBeenCalled();
  });

  it("DP com um cargo que não está no cadastro: erro no campo Cargo, nada é criado nem enviado", async () => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([cargo]));
    montar("dp");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    fireEvent.change(cargoSel(), {
      target: { value: "Cargo Inexistente (teste)" },
    });
    await salvarEConfirmar();
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    expect(cargoSel()).toHaveAttribute("aria-invalid", "true");
    expect(cargoSel()).toHaveAccessibleDescription(
      /Este cargo não está no cadastro\. Peça ao RH para cadastrá-lo, ou deixe o campo em branco\./,
    );
    expect(dialogoConfirmacao()).toBeNull();
    expect(criarCargo).not.toHaveBeenCalled();
    expect(admitirColaborador).not.toHaveBeenCalled();
    // O que foi digitado fica.
    expect(cargoSel()).toHaveValue("Cargo Inexistente (teste)");
  });

  it("RH: se outro usuário criou o cargo no meio do caminho (409 com a referência), a admissão usa esse cargo", async () => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([]));
    vi.mocked(criarCargo).mockRejectedValue(
      Object.assign(new Error("nome em uso"), {
        status: 409,
        referencia: { id: "c-concorrente", codigo: "CAR7", nome: "Cargo X" },
      }),
    );
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    fireEvent.change(cargoSel(), { target: { value: "Cargo X" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(criarCargo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(admitirColaborador).mock.calls[0]![0].cargoId).toBe(
      "c-concorrente",
    );
  });

  it("RH: falha ao criar o cargo, sem referência: erro no Cargo e nada é enviado", async () => {
    vi.mocked(listarCargos).mockResolvedValue(paginado([]));
    vi.mocked(criarCargo).mockRejectedValue(new Error("falha"));
    montar("rh");
    await aguardarEmpresa();
    await preencherValido();
    abrirLotacao();
    fireEvent.change(cargoSel(), { target: { value: "Cargo Y" } });
    await salvarEConfirmar();
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    expect(cargoSel()).toHaveAccessibleDescription(
      /Não foi possível usar este cargo\. Confira o nome e tente de novo\./,
    );
    expect(admitirColaborador).not.toHaveBeenCalled();
  });

  it("sem cargo e sem nenhuma referência da lotação: a mensagem fica no Cargo e a etapa não avança", async () => {
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    await waitFor(() => expect(cargoSel()).toHaveFocus());
    expect(cargoSel()).toHaveAccessibleDescription(
      "Informe ao menos o cargo, o departamento, a unidade ou o centro de custo.",
    );
    // Uma referência basta — aqui, só a Unidade.
    await escolher(unidadeSel(), unidade);
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
  });

  it("sem salário bruto, a etapa 2 não avança e o campo explica por quê", async () => {
    montar();
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.change(tipo(), { target: { value: "clt" } });
    fireEvent.change(data(), { target: { value: "2026-11-03" } });
    fireEvent.change(cargoSel(), { target: { value: cargo.nome } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/);
    await waitFor(() => expect(salarioBruto()).toHaveFocus());
    expect(salarioBruto()).toHaveAttribute("aria-invalid", "true");
    expect(salarioBruto()).toHaveAccessibleDescription(
      "Informe o salário bruto.",
    );
    expect(cargoSel()).not.toHaveAttribute("aria-invalid");
    fireEvent.change(salarioBruto(), { target: { value: "500000" } });
    fireEvent.click(botaoContinuar());
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
  });

  it("o tipo de contratação traz as opções da decisão", async () => {
    montar();
    await aguardarEmpresa();
    expect(
      [...(tipo() as HTMLSelectElement).options].map((o) => o.textContent),
    ).toEqual([
      "Selecione",
      "CLT",
      "PJ",
      "Estágio",
      "Aprendiz",
      "Part-time",
      "Freelancer",
      "Trainee",
    ]);
  });
});

// ---------------------------------------------------------------------------
// T197 — criação inline a partir da busca dos seletores da etapa 2: "Criar
// «termo»" só para o RH, confirmação curta, código gerado no servidor e a
// referência criada já escolhida. Dados sintéticos.
// ---------------------------------------------------------------------------

const centroNovo = {
  ...departamento,
  id: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4",
  codigo: "CENTRO_NOVO",
  nome: "Centro Novo (teste)",
};

const TIPOS_INLINE = [
  {
    tipo: "departamento",
    rotulo: "Departamento",
    campo: () => departamentoSel(),
    listar: listarDepartamentos,
    criar: criarDepartamento,
    novo: { ...departamentoNovo, nome: "Nova Referência Sintética" },
  },
  {
    tipo: "unidade",
    rotulo: "Unidade",
    campo: () => unidadeSel(),
    listar: listarUnidades,
    criar: criarUnidade,
    novo: { ...unidadeNova, nome: "Nova Referência Sintética" },
  },
  {
    tipo: "centro de custo",
    rotulo: "Centro de custo",
    campo: () => centroSel(),
    listar: listarCentrosCusto,
    criar: criarCentroCusto,
    novo: { ...centroNovo, nome: "Nova Referência Sintética" },
  },
] as const;

type CriarQualquer = (dto: {
  nome: string;
  empresaId: string;
  codigo?: string;
}) => Promise<unknown>;

/** Digita no seletor e espera a resposta da busca (sem espera fixa). */
async function buscarNo(campo: HTMLElement, termo: string) {
  fireEvent.change(campo, { target: { value: termo } });
  await waitFor(() =>
    expect(
      campo.closest(".seletor-referencia")!.querySelector('[role="status"]')
        ?.textContent,
    ).not.toBe(""),
  );
}

const opcaoCriar = (campo: HTMLElement) =>
  within(listaDe(campo)).queryByRole("option", { name: /^Criar / });
const statusDo = (campo: HTMLElement) =>
  campo.closest(".seletor-referencia")!.querySelector('[role="status"]')
    ?.textContent;
const dialogoCriacao = () => screen.queryByRole("dialog", { name: /^Criar / });

describe("T197 — criação inline de referências na Nova admissão", () => {
  beforeEach(() => {
    vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
  });

  it.each(TIPOS_INLINE)(
    "$rotulo: no vazio, o RH cria pelo «Criar», confirma e a referência fica escolhida sem perder a admissão",
    async ({ tipo, campo, listar, criar, novo }) => {
      vi.mocked(listar as typeof listarCargos).mockResolvedValue(
        paginado([]) as never,
      );
      vi.mocked(criar as CriarQualquer).mockResolvedValue(novo);
      montar("rh");
      await aguardarEmpresa();
      preencherParteDaAdmissao();
      abrirLotacao();
      await buscarNo(campo(), "  Nova   Referência Sintética ");
      // No vazio, a mensagem de nenhum resultado e a oferta de criar.
      expect(listaDe(campo()).parentElement).toHaveTextContent(
        /encontrad[oa] para a busca/,
      );
      const criarOpcao = opcaoCriar(campo())!;
      expect(criarOpcao).toHaveTextContent(
        `Criar ${tipo} «Nova Referência Sintética»`,
      );
      expect(statusDo(campo())).toContain(
        "A opção de criar «Nova Referência Sintética» está no fim da lista.",
      );
      fireEvent.click(criarOpcao);
      const dialogo = await screen.findByRole("dialog", {
        name: `Criar ${tipo}`,
      });
      expect(dialogo).toHaveTextContent("Nome: Nova Referência Sintética");
      expect(dialogo).toHaveTextContent("O código é gerado automaticamente.");
      expect(dialogo).not.toHaveTextContent(novo.codigo);
      expect(criar).not.toHaveBeenCalled();
      fireEvent.click(
        within(dialogo).getByRole("button", { name: "Criar e escolher" }),
      );
      await waitFor(() => expect(dialogoCriacao()).toBeNull());
      // Só o nome normalizado e a empresa ativa; nunca código.
      expect(criar).toHaveBeenCalledTimes(1);
      expect(criar).toHaveBeenCalledWith({
        nome: "Nova Referência Sintética",
        empresaId: empresa.id,
      });
      expect(escolhaDe(campo())).toHaveTextContent(
        `Escolha atual: ${novo.codigo} — Nova Referência Sintética`,
      );
      await waitFor(() => expect(campo()).toHaveFocus());
      // A busca é limpa, como numa escolha feita na própria lista.
      expect(campo()).toHaveValue("");
      expect(statusDo(campo())).toBe(
        `Criado e escolhido: ${novo.codigo} — Nova Referência Sintética.`,
      );
      admissaoPreservada();
      expect(admitirColaborador).not.toHaveBeenCalled();
    },
  );

  it("no fim dos resultados: setas chegam ao «Criar», Enter abre a confirmação e não envia nem avança", async () => {
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(unidadeSel(), "Unidade");
    const opcoes = within(listaDe(unidadeSel())).getAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "UNI1 — Unidade Sintética (teste)",
      "Criar unidade «Unidade»",
    ]);
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    expect(unidadeSel()).toHaveAttribute(
      "aria-activedescendant",
      opcaoCriar(unidadeSel())!.id,
    );
    fireEvent.keyDown(unidadeSel(), { key: "Enter" });
    expect(
      await screen.findByRole("dialog", { name: "Criar unidade" }),
    ).toBeInTheDocument();
    expect(tituloDaEtapa()).toHaveTextContent("Dados profissionais");
    expect(admitirColaborador).not.toHaveBeenCalled();
    expect(criarUnidade).not.toHaveBeenCalled();
  });

  it("nome idêntico entre os resultados (maiúsculas e espaços à parte): sem «Criar»", async () => {
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(unidadeSel(), "unidade   sintética (TESTE)");
    expect(within(listaDe(unidadeSel())).getAllByRole("option")).toHaveLength(
      1,
    );
    expect(opcaoCriar(unidadeSel())).toBeNull();
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "    "],
    ["com caractere de controle", "Nome\u0007Sintetico"],
    ["acima de 160", "x".repeat(161)],
  ])("termo %s: sem «Criar»", async (_caso, termo) => {
    vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    fireEvent.keyDown(unidadeSel(), { key: "ArrowDown" });
    await buscarNo(unidadeSel(), termo);
    expect(opcaoCriar(unidadeSel())).toBeNull();
  });

  it.each(TIPOS_INLINE)(
    "$rotulo: o DP pesquisa e escolhe, mas nunca vê «Criar» nem diálogo",
    async ({ campo, listar }) => {
      vi.mocked(listar as typeof listarUnidades).mockResolvedValue(
        paginado([]) as never,
      );
      montar("dp");
      await aguardarEmpresa();
      abrirLotacao();
      await buscarNo(campo(), "Nova Referência Sintética");
      expect(opcaoCriar(campo())).toBeNull();
      expect(dialogoCriacao()).toBeNull();
    },
  );

  it("vazio no feminino: «Nenhuma unidade encontrada», no anúncio e na lista", async () => {
    vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
    montar("dp");
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(unidadeSel(), "Inexistente");
    expect(statusDo(unidadeSel())).toBe("Nenhuma unidade encontrada.");
    expect(listaDe(unidadeSel()).parentElement).toHaveTextContent(
      "Nenhuma unidade ativa encontrada para a busca.",
    );
  });

  it('o "+" segue em Departamento e Unidade; Cargo (texto) e Centro de custo não têm "+"', async () => {
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    for (const rotulo of [
      "Cadastrar novo departamento",
      "Cadastrar nova unidade",
    ]) {
      expect(screen.getByRole("button", { name: rotulo })).toBeEnabled();
    }
    expect(
      screen.queryByRole("button", { name: "Cadastrar novo cargo" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Cadastrar novo centro de custo/ }),
    ).toBeNull();
  });

  it.each([
    [
      "Cancelar",
      () => {
        fireEvent.click(
          within(dialogoCriacao()!).getByRole("button", { name: "Cancelar" }),
        );
      },
    ],
    [
      "Escape",
      () => {
        fireEvent.keyDown(document, { key: "Escape" });
      },
    ],
    [
      "Fechar",
      () => {
        fireEvent.click(
          within(dialogoCriacao()!).getByRole("button", { name: /^Fechar/ }),
        );
      },
    ],
  ])(
    "%s: não cria, o foco volta ao seletor com o termo e a admissão fica igual",
    async (_caso, fechar) => {
      vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
      montar("rh");
      await aguardarEmpresa();
      preencherParteDaAdmissao();
      abrirLotacao();
      await buscarNo(unidadeSel(), "Nova Referência Sintética");
      fireEvent.click(opcaoCriar(unidadeSel())!);
      await screen.findByRole("dialog", { name: "Criar unidade" });
      fechar();
      await waitFor(() => expect(dialogoCriacao()).toBeNull());
      await waitFor(() => expect(unidadeSel()).toHaveFocus());
      expect(unidadeSel()).toHaveValue("Nova Referência Sintética");
      expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
      expect(criarUnidade).not.toHaveBeenCalled();
      admissaoPreservada();
    },
  );

  /** Abre a confirmação de "Unidade" com um nome sem resultado. */
  async function abrirConfirmacaoDeUnidade() {
    vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(unidadeSel(), "Nova Referência Sintética");
    fireEvent.click(opcaoCriar(unidadeSel())!);
    return screen.findByRole("dialog", { name: "Criar unidade" });
  }
  /** Ativa "Criar e escolher" como no navegador: o botão recebe o foco. */
  const confirmar = (dialogo: HTMLElement) => {
    const botao = within(dialogo).getByRole("button", {
      name: /^Criar e escolher|^Criando/,
    });
    botao.focus();
    fireEvent.click(botao);
  };

  it("nome já em uso (ativo): oferece escolher a existente, sem criar outra", async () => {
    vi.mocked(criarUnidade).mockRejectedValue(
      Object.assign(recusaDeReferencia(409, "nome_em_uso"), {
        referencia: {
          id: unidadeNova.id,
          codigo: "UNI_EXISTENTE",
          nome: "Nova Referência Sintética",
        },
      }),
    );
    const dialogo = await abrirConfirmacaoDeUnidade();
    confirmar(dialogo);
    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Já existe uma unidade ativa com este nome",
    );
    expect(alerta).toHaveTextContent(
      "UNI_EXISTENTE — Nova Referência Sintética",
    );
    expect(
      within(dialogo).queryByRole("button", { name: "Criar e escolher" }),
    ).toBeNull();
    // A ação em foco virou "Escolher …" sem sair da tela: o foco fica nela.
    const escolher = within(dialogo).getByRole("button", {
      name: "Escolher UNI_EXISTENTE — Nova Referência Sintética",
    });
    expect(escolher).toHaveFocus();
    fireEvent.click(escolher);
    await waitFor(() => expect(dialogoCriacao()).toBeNull());
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      "Escolha atual: UNI_EXISTENTE — Nova Referência Sintética",
    );
    expect(statusDo(unidadeSel())).toBe(
      "Escolhido: UNI_EXISTENTE — Nova Referência Sintética.",
    );
    expect(criarUnidade).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "nome_inativo",
      recusaDeReferencia(409, "nome_inativo"),
      "Já existe uma unidade inativa com este nome, e nada foi criado.",
    ],
    [
      "codigo_indisponivel",
      recusaDeReferencia(409, "codigo_indisponivel"),
      'Use outro nome ou o botão "+" para escolher o código.',
    ],
    [
      "400",
      recusaDeReferencia(400),
      "O servidor recusou este nome, e nada foi criado.",
    ],
    [
      "403",
      recusaDeReferencia(403),
      "Seu perfil não tem permissão para criar unidades.",
    ],
    [
      "404",
      recusaDeReferencia(404),
      "A empresa ativa não pôde ser confirmada, e nada foi criado.",
    ],
  ])(
    "%s: mensagem no diálogo, sem nova tentativa e sem escolher nada",
    async (_caso, erro, mensagem) => {
      vi.mocked(criarUnidade).mockRejectedValue(erro);
      const dialogo = await abrirConfirmacaoDeUnidade();
      confirmar(dialogo);
      // A ação principal, que tinha o foco, sai; o foco vai à mensagem, dentro
      // do diálogo, e não ao corpo da página.
      await waitFor(() =>
        expect(document.activeElement).toHaveTextContent(mensagem),
      );
      const foco = document.activeElement as HTMLElement;
      expect(dialogo).toContainElement(foco);
      expect(foco.tagName).toBe("P");
      expect(foco).toHaveAttribute("tabindex", "-1");
      expect(
        within(dialogo).queryByRole("button", { name: "Criar e escolher" }),
      ).toBeNull();
      // Lida uma vez, pelo foco: sem `alert` repetindo a mesma mensagem.
      expect(within(dialogo).queryByRole("alert")).toBeNull();
      expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
    },
  );

  it("Centro de custo sem código livre: a mensagem não fala do «+», que ele não tem", async () => {
    vi.mocked(listarCentrosCusto).mockResolvedValue(paginado([]));
    vi.mocked(criarCentroCusto).mockRejectedValue(
      recusaDeReferencia(409, "codigo_indisponivel"),
    );
    montar("rh");
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(centroSel(), "Nova Referência Sintética");
    fireEvent.click(opcaoCriar(centroSel())!);
    const dialogo = await screen.findByRole("dialog", {
      name: "Criar centro de custo",
    });
    confirmar(dialogo);
    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent("Use outro nome."),
    );
    expect(dialogo).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toHaveTextContent("+");
  });

  it.each([
    [
      "sessão expirada",
      new CsrfSessionExpiredError(),
      "Sua sessão expirou e nada foi criado.",
    ],
    ["401", recusaDeReferencia(401), "Sua sessão expirou e nada foi criado."],
    [
      "CSRF desatualizado",
      recusaDeReferencia(403, "csrf_invalido"),
      "Esta página ficou desatualizada e nada foi criado.",
    ],
  ])(
    "%s: diz que nada foi criado e permite confirmar de novo, que então cria",
    async (_caso, erro, mensagem) => {
      vi.mocked(criarUnidade)
        .mockRejectedValueOnce(erro)
        .mockResolvedValueOnce({
          ...unidadeNova,
          nome: "Nova Referência Sintética",
        });
      const dialogo = await abrirConfirmacaoDeUnidade();
      confirmar(dialogo);
      expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
        mensagem,
      );
      // Pode repetir: o foco continua na ação de confirmar.
      expect(
        within(dialogo).getByRole("button", { name: "Criar e escolher" }),
      ).toHaveFocus();
      expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
      confirmar(dialogo);
      await waitFor(() => expect(dialogoCriacao()).toBeNull());
      expect(escolhaDe(unidadeSel())).toHaveTextContent(
        `Escolha atual: ${unidadeNova.codigo} — Nova Referência Sintética`,
      );
      expect(criarUnidade).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    ["rede", new TypeError("Failed to fetch")],
    ["5xx", recusaDeReferencia(503)],
  ])(
    "%s: não afirma que criou; confirmar de novo devolve a já criada para escolher",
    async (_caso, erro) => {
      vi.mocked(criarUnidade)
        .mockRejectedValueOnce(erro)
        .mockRejectedValueOnce(
          Object.assign(recusaDeReferencia(409, "nome_em_uso"), {
            referencia: {
              id: unidadeNova.id,
              codigo: unidadeNova.codigo,
              nome: "Nova Referência Sintética",
            },
          }),
        );
      const dialogo = await abrirConfirmacaoDeUnidade();
      confirmar(dialogo);
      const alerta = await within(dialogo).findByRole("alert");
      expect(alerta).toHaveTextContent(
        "Não foi possível confirmar se a unidade foi criada.",
      );
      expect(alerta).not.toHaveTextContent(/criado e escolhido/i);
      expect(
        within(dialogo).getByRole("button", { name: "Criar e escolher" }),
      ).toHaveFocus();
      expect(escolhaDe(unidadeSel())).toHaveTextContent("Nenhuma escolha.");
      confirmar(dialogo);
      fireEvent.click(
        await within(dialogo).findByRole("button", {
          name: `Escolher ${unidadeNova.codigo} — Nova Referência Sintética`,
        }),
      );
      await waitFor(() => expect(dialogoCriacao()).toBeNull());
      expect(escolhaDe(unidadeSel())).toHaveTextContent(
        `Escolha atual: ${unidadeNova.codigo} — Nova Referência Sintética`,
      );
    },
  );

  it("duplo clique cria uma vez; durante o envio o diálogo não fecha e a resposta atrasada escolhe", async () => {
    let liberar: (v: UnidadeOrganizacionalApi) => void = () => undefined;
    vi.mocked(criarUnidade).mockReturnValue(
      new Promise((r) => {
        liberar = r;
      }),
    );
    const dialogo = await abrirConfirmacaoDeUnidade();
    confirmar(dialogo);
    confirmar(dialogo);
    expect(criarUnidade).toHaveBeenCalledTimes(1);
    expect(
      within(dialogo).getByRole("button", { name: "Criando…" }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogoCriacao()).not.toBeNull();
    await act(async () =>
      liberar({ ...unidadeNova, nome: "Nova Referência Sintética" }),
    );
    await waitFor(() => expect(dialogoCriacao()).toBeNull());
    expect(escolhaDe(unidadeSel())).toHaveTextContent(
      `Escolha atual: ${unidadeNova.codigo} — Nova Referência Sintética`,
    );
  });

  it("troca de empresa: a confirmação aberta e o envio contam como edição; a resposta depois da troca não escolhe nada", async () => {
    const registro = new RegistroDeEdicoes();
    let liberar: (v: UnidadeOrganizacionalApi) => void = () => undefined;
    vi.mocked(listarUnidades).mockResolvedValue(paginado([]));
    vi.mocked(criarUnidade).mockReturnValue(
      new Promise((r) => {
        liberar = r;
      }),
    );
    const { unmount } = render(
      <ProvedorDeEdicoes registro={registro}>
        <NovaAdmissaoScreen
          onSair={vi.fn()}
          onAbrirAdmitido={vi.fn()}
          papelDoAtor="rh"
        />
      </ProvedorDeEdicoes>,
    );
    await aguardarEmpresa();
    abrirLotacao();
    await buscarNo(unidadeSel(), "Nova Referência Sintética");
    fireEvent.click(opcaoCriar(unidadeSel())!);
    const dialogo = await screen.findByRole("dialog", {
      name: "Criar unidade",
    });
    expect(registro.obter().pendentes).toContain("Criar unidade");
    confirmar(dialogo);
    await waitFor(() =>
      expect(registro.obter().salvando).toContain("Criar unidade"),
    );
    // A troca de empresa remonta a página (T189): a anterior sai de cena.
    unmount();
    await act(async () =>
      liberar({ ...unidadeNova, nome: "Nova Referência Sintética" }),
    );
    expect(registro.obter()).toEqual({ pendentes: [], salvando: [] });
  });

  it("375 px: a opção de criar não tem largura própria e herda o alvo de 44 px", () => {
    const css = readFileSync(
      "src/screens/pessoas/SeletorDeReferencia.css",
      "utf8",
    );
    const regra = css.match(
      /\.seletor-referencia__opcao--criar\s*\{[^}]*\}/,
    )![0];
    expect(regra).not.toMatch(/(?:^|[\s;{])(?:min-)?width\s*:/);
    expect(css).toMatch(
      /\.seletor-referencia__opcao\s*\{[^}]*min-height:\s*var\(--touch-target\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// T209 — a Nova admissão como assistente operacional: cabeçalho próprio com
// "Voltar para Colaboradores", etapas à esquerda (no desktop), conteúdo em uma
// coluna e rodapé fixo com o progresso e as ações. Só campos reais: sem foto,
// CPF, RG, documentos nem "Salvar rascunho".
// ---------------------------------------------------------------------------
const ETAPAS_REAIS = [
  "Dados básicos",
  "Dados profissionais",
  "Endereço",
  "Documentos",
];

const rodape = () =>
  document.querySelector<HTMLElement>(".cadastro-etapas__rodape")!;

function botoesDoRodape(): string[] {
  return within(rodape())
    .getAllByRole("button")
    .map((b) => b.textContent ?? "");
}

describe("T209 — Nova admissão como assistente de etapas", () => {
  it("cabeçalho próprio: título, descrição curta e 'Voltar para Colaboradores'", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    const cabecalho = document.querySelector<HTMLElement>(
      ".cadastro-etapas__cabecalho",
    )!;
    expect(
      within(cabecalho).getByRole("heading", {
        level: 1,
        name: "Novo colaborador",
      }),
    ).toBeInTheDocument();
    expect(cabecalho).toHaveTextContent(
      "Quatro etapas. Salve o rascunho a qualquer momento e termine depois.",
    );
    fireEvent.click(
      within(cabecalho).getByRole("button", {
        name: "Voltar para Colaboradores",
      }),
    );
    // Sem nada digitado, sai direto (o mesmo caminho do Cancelar).
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("com dados digitados, 'Voltar para Colaboradores' pergunta antes de sair (guarda)", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("as etapas são as reais, na ordem; nenhuma de documentos", async () => {
    montar();
    await aguardarEmpresa();
    const nav = screen.getByRole("navigation", { name: "Etapas do cadastro" });
    expect(
      [...nav.querySelectorAll(".cadastro-etapas__etapa-nome")].map(
        (e) => e.firstChild?.textContent,
      ),
    ).toEqual(ETAPAS_REAIS);
    // T209 — o subtítulo de cada etapa, embaixo do nome.
    expect(
      [...nav.querySelectorAll(".cadastro-etapas__etapa-sub")].map(
        (e) => e.textContent,
      ),
    ).toEqual([
      "Identificação e contatos",
      "Lotação e contrato",
      "CEP e endereço",
      "Envio de arquivos",
    ]);
    expect(
      screen.getByRole("heading", { level: 2, name: /Dados básicos$/ }),
    ).toBeVisible();
  });

  it("nada que o contrato não suporta: sem PIS; documentos só como arquivo opcional na etapa 4 (T213)", async () => {
    montar();
    await aguardarEmpresa();
    const formulario = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    expect(formulario).toBeInTheDocument();
    // T213 — além da foto (PNG ou JPEG), um campo por documento da etapa 4
    // (PDF, JPG ou PNG); nenhum é obrigatório.
    const arquivos = [...document.querySelectorAll('input[type="file"]')];
    expect(arquivos[0]).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(arquivos.slice(1)).toHaveLength(5);
    for (const campo of arquivos) expect(campo).not.toBeRequired();
    // T209 — CPF e RG entraram na etapa 1; continua sem campo de documento.
    for (const proibido of [/\bPIS\b/, /Carteira de Trabalho/]) {
      expect(
        screen
          .queryAllByLabelText(proibido)
          // T213 — o anexo da carteira (campo de arquivo) é permitido; o
          // dado dela (número, série) continua fora.
          .filter(
            (e) =>
              ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName) &&
              e.getAttribute("type") !== "file",
          ),
      ).toEqual([]);
    }
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeInTheDocument();
  });

  it("rodapé fixo: progresso e ações; Cancelar só na primeira etapa; Cadastrar colaborador na última", async () => {
    montar();
    await aguardarEmpresa();
    expect(rodape()).toHaveTextContent("25% concluído");
    expect(within(rodape()).getByRole("progressbar")).toHaveAttribute(
      "value",
      "25",
    );
    expect(botoesDoRodape()).toEqual(["Cancelar", "Próxima etapa"]);

    await preencherValido();
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await waitFor(() => expect(rodape()).toHaveTextContent("50% concluído"));
    expect(botoesDoRodape()).toEqual(["Voltar", "Próxima etapa"]);

    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await waitFor(() => expect(rodape()).toHaveTextContent("75% concluído"));
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await waitFor(() => expect(rodape()).toHaveTextContent("100% concluído"));
    expect(botoesDoRodape()).toEqual(["Voltar", "Cadastrar colaborador"]);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(rodape()).toHaveTextContent("75% concluído"));
    expect(
      screen.getByRole("heading", { level: 2, name: /Endereço$/ }),
    ).toHaveFocus();
  });

  it("Próxima etapa valida só a etapa atual: com erro, fica e foca o primeiro campo inválido", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    expect(rodape()).toHaveTextContent("25% concluído");
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(nome()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("T209 — assistente: teclado, Escape e guarda de saída", () => {
  it("Escape na pergunta de saída mantém a etapa e os dados e devolve o foco a 'Voltar para Colaboradores'", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    await preencherValido();
    irAteEtapa("Endereço");
    const voltar = screen.getByRole("button", {
      name: "Voltar para Colaboradores",
    });
    voltar.focus();
    fireEvent.click(voltar);
    await screen.findByRole("alertdialog", { name: "Sair sem salvar?" });
    fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", { name: "Sair sem salvar?" }),
      ).toBeNull(),
    );
    expect(onSair).not.toHaveBeenCalled();
    expect(tituloDaEtapa()).toHaveTextContent(/Endereço$/);
    expect(nome()).toHaveValue("  Pessoa Sintética Nova ");
    await waitFor(() => expect(voltar).toHaveFocus());
  });

  it("'Sair sem salvar' na pergunta sai pelo mesmo caminho do Cancelar", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Sintética" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    );
    const dialogo = await screen.findByRole("alertdialog", {
      name: "Sair sem salvar?",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Sair sem salvar" }),
    );
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("Enter num campo vale como 'Próxima etapa' e leva o foco ao título da etapa seguinte", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.submit(
      screen.getByRole("form", { name: "Formulário de nova admissão" }),
    );
    await waitFor(() =>
      expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/),
    );
    expect(tituloDaEtapa()).toHaveFocus();
    expect(rodape()).toHaveTextContent("50% concluído");
  });

  it("o rodapé fica dentro do formulário: 'Próxima etapa'/'Concluir' são o envio dele", async () => {
    montar();
    await aguardarEmpresa();
    const formulario = screen.getByRole("form", {
      name: "Formulário de nova admissão",
    });
    expect(formulario).toContainElement(rodape());
    expect(
      screen.getByRole("button", { name: "Próxima etapa" }),
    ).toHaveAttribute("type", "submit");
    expect(botaoSair()).toHaveAttribute("type", "button");
  });
});

describe("T209 — contrato de CSS do assistente (desktop e 375 px)", () => {
  const css = readFileSync(
    "src/screens/pessoas/NovaAdmissaoScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  // T209 — a moldura saiu para o padrão compartilhado; o bloco da tela
  // começa no que é só dela (foto, endereço, linhas da etapa 2).
  const inicio = css.indexOf("/* ---- T209 — foto opcional");
  const bloco = inicio > -1 ? css.slice(inicio) : "";
  // T209 — a moldura (etapas, corpo, rodapé) é a do padrão compartilhado.
  const compartilhado = readFileSync(
    "src/components/cadastro/CadastroEmEtapas.css",
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("o bloco existe e usa só tokens", () => {
    expect(inicio).toBeGreaterThan(-1);
    // T209 — o novo desenho (2026-11-17) define as próprias cores como
    // propriedades personalizadas (`--cadastro-…`); fora dessas definições,
    // as regras só usam tokens.
    const regras = bloco.replace(/^\s*--[\w-]+\s*:[^;]*;/gm, "");
    expect(regras).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(regras).not.toMatch(/\brgba?\(|\bhsla?\(/);
    // E as cores literais ficam só nessas definições.
    for (const cor of bloco.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      expect(bloco).toMatch(
        new RegExp(String.raw`--cadastro-[\w-]+:\s*${cor};`),
      );
    }
  });

  it("desktop: etapas à esquerda (fixas ao rolar) e o conteúdo em uma coluna", () => {
    expect(compartilhado).toMatch(
      /\.cadastro-etapas \{[^}]*container-type: inline-size;/,
    );
    expect(compartilhado).toMatch(
      /@container \(min-width: 52rem\) \{[^@]*\.cadastro-etapas__corpo \{[^}]*grid-template-columns: minmax\(0, 15rem\) minmax\(0, 1fr\);/,
    );
    expect(compartilhado).toMatch(
      /@container \(min-width: 52rem\) \{[^@]*\.cadastro-etapas__etapas \{[^}]*position: sticky;/,
    );
    expect(compartilhado).toMatch(
      /@container \(min-width: 52rem\) \{[^@]*\.cadastro-etapas__etapas-lista \{[^}]*grid-template-columns: minmax\(0, 1fr\);/,
    );
  });

  it("rodapé fixo ao pé da tela, com divisor, que quebra linha em vez de alargar", () => {
    expect(compartilhado).toMatch(
      /\.cadastro-etapas__rodape \{[^}]*position: sticky;[^}]*bottom: 0;[^}]*flex-wrap: wrap;[^}]*border-top: var\(--divisor\);/,
    );
    expect(compartilhado).toMatch(
      /\.cadastro-etapas__rodape-acoes \{[^}]*flex-wrap: wrap;/,
    );
  });

  it("375 px: rodapé em grade de duas linhas — progresso e Cancelar; Voltar e a ação principal larga", () => {
    const celular = compartilhado.slice(
      compartilhado.lastIndexOf("@media (max-width: 640px)"),
    );
    expect(celular).toMatch(
      /\.cadastro-etapas__rodape \{[^}]*display: grid;[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto;/,
    );
    expect(celular).toMatch(
      /\.cadastro-etapas__rodape-acoes \{\s*display: contents;/,
    );
    expect(celular).toMatch(
      /\.cadastro-etapas__rodape-acoes > \[type="submit"\] \{[^}]*grid-column: 2 \/ 4;/,
    );
    expect(celular).toMatch(
      /\.cadastro-etapas__rodape-acoes > \[type="submit"\]:nth-child\(2\) \{[^}]*grid-column: 1 \/ 4;/,
    );
  });
});

/**
 * T200 — as telas montadas como no shell: com o registro de edições e a
 * guarda de saída (sem ela, a saída não pergunta).
 */
function render(
  ui: Parameters<typeof renderSemGuarda>[0],
  opcoes?: Omit<RenderOptions, "wrapper">,
) {
  return renderSemGuarda(ui, { wrapper: ComGuardaDeSaida, ...opcoes });
}

describe("T209 — Novo colaborador: cabeçalho, empresa e o que saiu da tela", () => {
  it("título, subtítulo, Salvar rascunho e só a frase da empresa ativa", async () => {
    montar();
    await aguardarEmpresa();
    expect(
      screen.getByRole("heading", { level: 1, name: "Novo colaborador" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Quatro etapas. Salve o rascunho a qualquer momento e termine depois.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar rascunho" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Você está cadastrando um novo colaborador para:/),
    ).toHaveTextContent(
      "Você está cadastrando um novo colaborador para: Empresa Sintética (teste)",
    );
    expect(
      screen.getByRole("button", { name: "Voltar para Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("sem aviso interno, explicação longa, documentos futuros nem trilha repetida", async () => {
    montar();
    await aguardarEmpresa();
    const corpo = document.body.textContent ?? "";
    expect(corpo).not.toMatch(/Módulo 1/);
    expect(corpo).not.toMatch(/não é editável/i);
    expect(corpo).not.toMatch(/Documentos serão liberados/);
    expect(corpo).not.toMatch(/T209|em desenvolvimento|branch/i);
    expect(screen.queryByRole("navigation", { name: /trilha/i })).toBeNull();
    // T213 — além da foto (PNG ou JPEG), um campo por documento da etapa 4
    // (PDF, JPG ou PNG); nenhum é obrigatório.
    const arquivos = [...document.querySelectorAll('input[type="file"]')];
    expect(arquivos[0]).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(arquivos.slice(1)).toHaveLength(5);
    for (const campo of arquivos) expect(campo).not.toBeRequired();
  });

  it("as quatro etapas, nos nomes pedidos", async () => {
    montar();
    await aguardarEmpresa();
    const etapas = screen.getByRole("navigation", { name: /Etapas/ });
    expect(etapas).toHaveTextContent("Dados básicos");
    expect(etapas).toHaveTextContent("Dados profissionais");
    expect(etapas).toHaveTextContent("Endereço");
    expect(etapas).toHaveTextContent("Documentos");
  });
});

describe("T209 — rascunho da Nova admissão (persistente no servidor)", () => {
  beforeEach(() => {
    vi.mocked(obterRascunhoAdmissao).mockResolvedValue(null);
    vi.mocked(salvarRascunhoAdmissao).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-16T15:30:00.000Z",
    });
    vi.mocked(descartarRascunhoAdmissao).mockResolvedValue(undefined);
  });

  it("Salvar rascunho grava só o formulário — nunca admite nem envia foto", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho" } });
    fireEvent.change(dataNascimento(), { target: { value: "1990-05-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() =>
      expect(salvarRascunhoAdmissao).toHaveBeenCalledTimes(1),
    );
    const dados = vi.mocked(salvarRascunhoAdmissao).mock.calls[0]![0];
    expect(dados.etapa).toBe(0);
    expect(dados.campos?.nome).toBe("Pessoa Rascunho");
    expect(dados.perfil?.dataNascimento).toBe("1990-05-20");
    expect(JSON.stringify(dados)).not.toMatch(/foto|arquivo/i);
    expect(admitirColaborador).not.toHaveBeenCalled();
    expect(await screen.findByText(/Rascunho salvo/)).toBeInTheDocument();
  });

  it("depois de salvo e sem mudanças, sair não pergunta; mudou de novo, pergunta", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText(/Rascunho salvo/);
    fireEvent.click(botaoSair());
    expect(onSair).toHaveBeenCalledTimes(1);

    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho 2" } });
    fireEvent.click(botaoSair());
    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it("falha ao salvar o rascunho: avisa, mantém os dados e a guarda", async () => {
    vi.mocked(salvarRascunhoAdmissao).mockRejectedValueOnce(
      new ApiError(500, "erro", {}),
    );
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(
      await screen.findByText(
        "Não foi possível salvar o rascunho agora. Os dados digitados continuam aqui.",
      ),
    ).toBeInTheDocument();
    expect(nome()).toHaveValue("Pessoa Rascunho");
    fireEvent.click(botaoSair());
    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("recupera o rascunho salvo (da conta, na empresa ativa): campos, referência e etapa", async () => {
    vi.mocked(obterRascunhoAdmissao).mockResolvedValue({
      versao: 3,
      atualizadoEm: "2026-11-15T13:00:00.000Z",
      dados: {
        etapa: 1,
        campos: {
          nome: "Pessoa Recuperada",
          tipo: "clt",
          departamentoId: departamento.id,
        },
        perfil: { dataNascimento: "1991-02-03" },
        referencias: {
          departamento: {
            id: departamento.id,
            codigo: departamento.codigo,
            nome: departamento.nome,
          },
        },
      },
    });
    montar();
    await aguardarEmpresa();
    expect(
      await screen.findByText(/Rascunho de 15\/11\/2026.* recuperado/),
    ).toBeInTheDocument();
    expect(tituloDaEtapa()).toHaveTextContent("Dados profissionais");
    expect(escolhaDe(departamentoSel())).toHaveTextContent(departamento.nome);
    expect(nome()).toHaveValue("Pessoa Recuperada");
  });

  it("Descartar rascunho apaga no servidor e limpa o formulário", async () => {
    vi.mocked(obterRascunhoAdmissao).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-15T13:00:00.000Z",
      dados: { etapa: 0, campos: { nome: "Pessoa Recuperada" } },
    });
    montar();
    await aguardarEmpresa();
    await screen.findByText(/recuperado/);
    fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    await waitFor(() =>
      expect(descartarRascunhoAdmissao).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(nome()).toHaveValue(""));
  });

  it("concluir a admissão apaga o rascunho", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(descartarRascunhoAdmissao).toHaveBeenCalledTimes(1),
    );
  });

  it("com a leitura do rascunho falhando, a página começa vazia", async () => {
    vi.mocked(obterRascunhoAdmissao).mockRejectedValue(new Error("rede"));
    montar();
    await aguardarEmpresa();
    expect(nome()).toHaveValue("");
    expect(screen.queryByText(/recuperado/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T209 — foto opcional do colaborador (ADR 0020). Escolhida na etapa 1, com
// prévia local; enviada só DEPOIS de a admissão ser concluída; a falha da
// foto nunca desfaz a admissão e permite nova tentativa. Nunca vai para o
// rascunho.
// ---------------------------------------------------------------------------
function arquivoDeFoto(
  nomeDoArquivo = "retrato.png",
  tipo = "image/png",
  tamanho = 2048,
): File {
  const arquivo = new File([new Uint8Array(8)], nomeDoArquivo, { type: tipo });
  Object.defineProperty(arquivo, "size", { value: tamanho });
  return arquivo;
}

const campoDaFoto = () =>
  document.getElementById("nova-admissao-foto-arquivo") as HTMLInputElement;
const escolherFoto = (arquivo: File) =>
  fireEvent.change(campoDaFoto(), { target: { files: [arquivo] } });
const blocoDaFoto = () => screen.getByRole("group", { name: "Foto" });

describe("T209 — foto do colaborador na Nova admissão", () => {
  beforeEach(() => {
    vi.mocked(obterRascunhoAdmissao).mockResolvedValue(null);
    vi.mocked(salvarRascunhoAdmissao).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-16T15:30:00.000Z",
    });
    vi.mocked(descartarRascunhoAdmissao).mockResolvedValue(undefined);
    vi.mocked(enviarFotoColaborador).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-16T15:31:00.000Z",
    });
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:previa-${++n}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.mocked(URL.createObjectURL).mockReset();
    vi.mocked(URL.revokeObjectURL).mockReset();
  });

  it("etapa 1: avatar neutro, Enviar foto, regras; sem Remover antes de escolher", async () => {
    montar();
    await aguardarEmpresa();
    const bloco = blocoDaFoto();
    expect(
      within(bloco).getByRole("button", { name: "Enviar foto" }),
    ).toBeVisible();
    expect(within(bloco).queryByRole("button", { name: "Remover" })).toBeNull();
    expect(within(bloco).queryByRole("img")).toBeNull();
    expect(bloco).toHaveTextContent("PNG ou JPG, até 5 MB.");
    expect(campoDaFoto()).toHaveAttribute("accept", "image/png,image/jpeg");
  });

  it("escolher PNG mostra a prévia local e o Remover; nada é enviado ainda", async () => {
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    const previa = await within(blocoDaFoto()).findByRole("img", {
      name: "Prévia da foto do colaborador",
    });
    expect(previa).toHaveAttribute("src", "blob:previa-1");
    expect(
      within(blocoDaFoto()).getByRole("button", { name: "Remover" }),
    ).toBeVisible();
    expect(enviarFotoColaborador).not.toHaveBeenCalled();
  });

  it("JPEG (.jpeg) também é aceito", async () => {
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto("retrato.jpeg", "image/jpeg"));
    expect(
      await within(blocoDaFoto()).findByRole("img", {
        name: "Prévia da foto do colaborador",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ["GIF", "anim.gif", "image/gif", 2048, "Use uma imagem PNG ou JPEG."],
    ["WebP", "a.webp", "image/webp", 2048, "Use uma imagem PNG ou JPEG."],
    [
      "extensão trocada",
      "a.txt",
      "image/png",
      2048,
      "Use uma imagem PNG ou JPEG.",
    ],
    [
      "tipo diferente da extensão",
      "a.png",
      "image/jpeg",
      2048,
      "Use uma imagem PNG ou JPEG.",
    ],
    [
      "acima de 5 MB",
      "grande.png",
      "image/png",
      5 * 1024 * 1024 + 1,
      "A foto deve ter até 5 MB.",
    ],
  ])(
    "recusa no navegador: %s",
    async (_rotulo, nomeDoArquivo, tipo, tamanho, mensagem) => {
      montar();
      await aguardarEmpresa();
      escolherFoto(arquivoDeFoto(nomeDoArquivo, tipo, tamanho));
      expect(
        await within(blocoDaFoto()).findByText(mensagem),
      ).toBeInTheDocument();
      expect(within(blocoDaFoto()).queryByRole("img")).toBeNull();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it("Remover tira a prévia, libera a URL local e devolve o foco ao Enviar foto", async () => {
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    fireEvent.click(
      await within(blocoDaFoto()).findByRole("button", { name: "Remover" }),
    );
    expect(within(blocoDaFoto()).queryByRole("img")).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa-1");
    await waitFor(() =>
      expect(
        within(blocoDaFoto()).getByRole("button", { name: "Enviar foto" }),
      ).toHaveFocus(),
    );
  });

  it("trocar a foto libera a prévia anterior", async () => {
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    await within(blocoDaFoto()).findByRole("img");
    escolherFoto(arquivoDeFoto("outra.jpg", "image/jpeg"));
    await waitFor(() =>
      expect(within(blocoDaFoto()).getByRole("img")).toHaveAttribute(
        "src",
        "blob:previa-2",
      ),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:previa-1");
  });

  it("a foto só é enviada DEPOIS da admissão, para o colaborador criado", async () => {
    montar();
    await aguardarEmpresa();
    const arquivo = arquivoDeFoto();
    escolherFoto(arquivo);
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(enviarFotoColaborador).toHaveBeenCalledTimes(1));
    expect(enviarFotoColaborador).toHaveBeenCalledWith(resposta.id, arquivo);
    expect(
      vi.mocked(admitirColaborador).mock.invocationCallOrder[0]!,
    ).toBeLessThan(
      vi.mocked(enviarFotoColaborador).mock.invocationCallOrder[0]!,
    );
    expect(await screen.findByText("Foto salva.")).toBeInTheDocument();
    // A admissão não leva a foto.
    expect(
      JSON.stringify(vi.mocked(admitirColaborador).mock.calls[0]),
    ).not.toMatch(/foto|blob:/i);
  });

  it("sem foto escolhida, nada é enviado e a confirmação não fala de foto", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByRole("heading", { name: /Admissão de .* registrada/ });
    expect(enviarFotoColaborador).not.toHaveBeenCalled();
    expect(screen.queryByText(/foto/i)).toBeNull();
  });

  it("falha da foto: a admissão fica, o aviso é claro e a nova tentativa envia de novo", async () => {
    vi.mocked(enviarFotoColaborador)
      .mockRejectedValueOnce(recusa(503))
      .mockResolvedValueOnce({
        versao: 1,
        atualizadoEm: "2026-11-16T15:32:00.000Z",
      });
    montar();
    await aguardarEmpresa();
    const arquivo = arquivoDeFoto();
    escolherFoto(arquivo);
    await preencherValido();
    await salvarEConfirmar();
    expect(
      await screen.findByRole("heading", { name: /Admissão de .* registrada/ }),
    ).toBeInTheDocument();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "O colaborador foi criado, mas a foto não foi salva.",
    );
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar enviar foto novamente" }),
    );
    expect(await screen.findByText("Foto salva.")).toBeInTheDocument();
    expect(enviarFotoColaborador).toHaveBeenCalledTimes(2);
    expect(vi.mocked(enviarFotoColaborador).mock.calls[1]).toEqual([
      resposta.id,
      arquivo,
    ]);
    // A nova tentativa nunca admite de novo.
    expect(admitirColaborador).toHaveBeenCalledTimes(1);
  });

  it("recusa da foto pelo servidor: diz o motivo e oferece escolher outra", async () => {
    vi.mocked(enviarFotoColaborador)
      .mockRejectedValueOnce(recusa(422, { codigo: "foto_pequena" }))
      .mockResolvedValueOnce({
        versao: 1,
        atualizadoEm: "2026-11-16T15:33:00.000Z",
      });
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    await preencherValido();
    await salvarEConfirmar();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "O colaborador foi criado, mas a foto não foi salva.",
    );
    expect(alerta).toHaveTextContent(
      "A imagem é pequena demais: use ao menos 64 × 64 pixels.",
    );
    expect(
      screen.queryByRole("button", { name: "Tentar enviar foto novamente" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Escolher outra foto" }),
    ).toBeVisible();
    const outra = arquivoDeFoto("maior.jpg", "image/jpeg");
    fireEvent.change(
      document.getElementById("nova-admissao-foto-outra") as HTMLInputElement,
      { target: { files: [outra] } },
    );
    expect(await screen.findByText("Foto salva.")).toBeInTheDocument();
    expect(vi.mocked(enviarFotoColaborador).mock.calls[1]).toEqual([
      resposta.id,
      outra,
    ]);
  });

  it("só a foto escolhida já é alteração: sair pergunta", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    fireEvent.click(botaoSair());
    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("o rascunho nunca leva a foto; com foto escolhida, sair ainda pergunta", async () => {
    const { onSair } = montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho" } });
    escolherFoto(arquivoDeFoto());
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText(/Rascunho salvo/);
    const dados = vi.mocked(salvarRascunhoAdmissao).mock.calls[0]![0];
    expect(JSON.stringify(dados)).not.toMatch(/foto|arquivo|blob:/i);
    fireEvent.click(botaoSair());
    expect(
      await screen.findByRole("heading", { name: "Sair sem salvar?" }),
    ).toBeInTheDocument();
    expect(onSair).not.toHaveBeenCalled();
  });

  it("Registrar outra admissão começa sem foto", async () => {
    montar();
    await aguardarEmpresa();
    escolherFoto(arquivoDeFoto());
    await preencherValido();
    await salvarEConfirmar();
    await screen.findByText("Foto salva.");
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar outra admissão" }),
    );
    await waitFor(() =>
      expect(within(blocoDaFoto()).queryByRole("img")).toBeNull(),
    );
    expect(
      within(blocoDaFoto()).queryByRole("button", { name: "Remover" }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T209 — etapa 1 do Novo colaborador (decisão de 2026-11-17): seções,
// linhas (rótulo e ajuda à esquerda, campos à direita), textos, listas e
// regras. Nome com pelo menos 3 letras; CPF obrigatório; nascimento opcional.
// ---------------------------------------------------------------------------
describe("T209 — etapa 1: dados básicos", () => {
  beforeEach(() => {
    vi.mocked(obterRascunhoAdmissao).mockResolvedValue(null);
  });

  const etapa1 = () =>
    screen
      .getByRole("heading", { level: 2, name: /Dados básicos$/ })
      .closest("section") as HTMLElement;

  it("cabeçalho da etapa: título, descrição e o selo 'Etapa 1 de 4'", async () => {
    montar();
    await aguardarEmpresa();
    const painel = etapa1();
    expect(painel).toHaveTextContent("Quem é a pessoa e como falar com ela.");
    expect(
      painel.querySelector(".cadastro-etapas__etapa-selo"),
    ).toHaveTextContent("Etapa 1 de 4");
  });

  it("três seções, na ordem, com as descrições", async () => {
    montar();
    await aguardarEmpresa();
    const secoes = [...etapa1().querySelectorAll("h3")].map((h) => [
      h.textContent,
      h.nextElementSibling?.textContent,
    ]);
    expect(secoes).toEqual([
      ["Identificação", "Dados que identificam a pessoa no Evolli."],
      ["Contato", "Como a empresa fala com a pessoa."],
      ["Contato de emergência", "Quem avisar se algo acontecer."],
    ]);
  });

  it("as linhas, na ordem, com as ajudas", async () => {
    montar();
    await aguardarEmpresa();
    const linhas = [
      ...etapa1().querySelectorAll(".cadastro-etapas__linha-rotulo"),
    ].map((l) => [...l.children].map((c) => c.textContent));
    expect(linhas).toEqual([
      ["Foto", "Mostrada na lista e na ficha."],
      ["Nome completo", "Igual ao documento de identidade."],
      ["CPF e RG", "Documentos de identificação da pessoa."],
      ["Data de nascimento"],
      ["Gênero e estado civil"],
      ["E-mail pessoal", "O e-mail particular, não o da empresa."],
      ["Telefone pessoal", "Com DDD."],
      ["Nome do contato"],
      ["Telefone do contato"],
    ]);
  });

  it("placeholders dos campos", async () => {
    montar();
    await aguardarEmpresa();
    expect(nome()).toHaveAttribute("placeholder", "Nome completo");
    expect(cpf()).toHaveAttribute("placeholder", "000.000.000-00");
    expect(screen.getByLabelText("RG")).toHaveAttribute(
      "placeholder",
      "00.000.000-0",
    );
    expect(emailPessoal()).toHaveAttribute("placeholder", "email@exemplo.com");
    expect(celular()).toHaveAttribute("placeholder", "(00) 00000-0000");
    expect(screen.getByLabelText("Nome do contato")).toHaveAttribute(
      "placeholder",
      "Nome do contato",
    );
    expect(telefone()).toHaveAttribute("placeholder", "(00) 00000-0000");
  });

  it("gênero e estado civil: 'Selecione' e as opções", async () => {
    montar();
    await aguardarEmpresa();
    const opcoes = (rotulo: string) =>
      [...(screen.getByLabelText(rotulo) as HTMLSelectElement).options].map(
        (o) => o.textContent,
      );
    expect(opcoes("Gênero")).toEqual([
      "Selecione",
      "Feminino",
      "Masculino",
      "Outro",
      "Prefiro não informar",
    ]);
    expect(opcoes("Estado civil")).toEqual([
      "Selecione",
      "Solteiro(a)",
      "Casado(a)",
      "Divorciado(a)",
      "Viúvo(a)",
      "União estável",
    ]);
  });

  it("saíram da etapa 1: sexo, saudação, nacionalidade, naturalidade, escolaridade, curso, pai, mãe e telefone fixo", async () => {
    montar();
    await aguardarEmpresa();
    for (const rotulo of [
      /^Sexo/,
      /^Saudação/,
      /^Nacionalidade/,
      /^Naturalidade/,
      /^Escolaridade/,
      /^Curso/,
      /^Nome do pai/,
      /^Nome da mãe/,
      /^Celular/,
      /^Telefone \(opcional\)/,
    ]) {
      expect(screen.queryByLabelText(rotulo)).toBeNull();
    }
  });

  it("CPF ganha a máscara enquanto se digita", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(cpf(), { target: { value: "52998224725" } });
    expect(cpf()).toHaveValue("529.982.247-25");
    fireEvent.change(cpf(), { target: { value: "529982" } });
    expect(cpf()).toHaveValue("529.982");
  });

  it("nome: pelo menos 3 letras", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "A1 B2" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await waitFor(() => expect(nome()).toHaveFocus());
    expect(nome()).toHaveAccessibleDescription(
      "Informe o nome completo (pelo menos 3 letras).",
    );
  });

  it("CPF inválido: mensagem no campo; data de nascimento vazia não acusa", async () => {
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Ana Sintética" } });
    fireEvent.change(cpf(), { target: { value: "111.111.111-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await waitFor(() => expect(cpf()).toHaveFocus());
    expect(cpf()).toHaveAccessibleDescription("Informe um CPF válido.");
    expect(dataNascimento()).not.toHaveAttribute("aria-invalid");
  });

  it("sem data de nascimento, avança e o corpo leva `null`", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.change(dataNascimento(), { target: { value: "" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(admitirColaborador).mock.calls[0]![0].perfilPessoal
        .dataNascimento,
    ).toBeNull();
  });

  it("o corpo leva CPF, RG, gênero, estado civil e o contato de emergência", async () => {
    montar();
    await aguardarEmpresa();
    await preencherValido();
    fireEvent.change(screen.getByLabelText("RG"), {
      target: { value: " 12.345.678-9 " },
    });
    fireEvent.change(screen.getByLabelText("Gênero"), {
      target: { value: "prefiro_nao_informar" },
    });
    fireEvent.change(screen.getByLabelText("Estado civil"), {
      target: { value: "União estável" },
    });
    fireEvent.change(screen.getByLabelText("Nome do contato"), {
      target: { value: "  Contato   Sintético " },
    });
    fireEvent.change(telefone(), { target: { value: "(31) 98888-7777" } });
    await salvarEConfirmar();
    await waitFor(() => expect(admitirColaborador).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(admitirColaborador).mock.calls[0]![0].perfilPessoal,
    ).toMatchObject({
      cpf: "52998224725",
      rg: "12.345.678-9",
      genero: "prefiro_nao_informar",
      estadoCivil: "União estável",
      contatoEmergenciaNome: "Contato Sintético",
      contatoEmergenciaTelefone: "+5531988887777",
    });
  });

  it("CPF já cadastrado na empresa (409): mensagem no CPF, na etapa 1", async () => {
    vi.mocked(admitirColaborador).mockRejectedValueOnce(
      recusa(409, {
        erros: [{ campo: "perfilPessoal.cpf", motivo: "em_uso" }],
      }),
    );
    montar();
    await aguardarEmpresa();
    await preencherValido();
    await salvarEConfirmar();
    await waitFor(() => expect(cpf()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(cpf()).toHaveAccessibleDescription(
      "Este CPF já está cadastrado nesta empresa.",
    );
  });

  it("o rascunho guarda os campos novos da etapa 1", async () => {
    vi.mocked(salvarRascunhoAdmissao).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-17T12:00:00.000Z",
    });
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Pessoa Rascunho" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    fireEvent.change(screen.getByLabelText("Gênero"), {
      target: { value: "outro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(salvarRascunhoAdmissao).toHaveBeenCalled());
    expect(
      vi.mocked(salvarRascunhoAdmissao).mock.calls[0]![0].perfil,
    ).toMatchObject({ cpf: CPF_VALIDO, genero: "outro" });
  });

  it("rodapé: 'Cancelar' só na etapa 1; o botão final é 'Cadastrar colaborador'", async () => {
    montar();
    await aguardarEmpresa();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
    await ateARevisao();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T213 — documentos da etapa 4 (arquivos sintéticos).

describe("T213 — documentos da etapa 4 e envio depois do cadastro", () => {
  const pdf = (nome = "rg-sintetico.pdf") =>
    new File(["%PDF-1.4 sintetico %%EOF"], nome, { type: "application/pdf" });
  const escolherDocumento = (nome: string, arquivo: File) =>
    fireEvent.change(screen.getByLabelText(`Arquivo de ${nome}`), {
      target: { files: [arquivo] },
    });
  const abrirMenu = (botao: HTMLElement) =>
    fireEvent.pointerDown(botao, {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    });
  const gravado = (
    categoria: DocumentoColaboradorApi["categoria"],
    estado: DocumentoColaboradorApi["estado"],
  ): DocumentoColaboradorApi => ({
    id: `doc-${categoria}`,
    categoria,
    nome: null,
    estado,
    formato: "pdf",
    tamanhoBytes: 24,
    versao: 1,
    enviadoEm: "2026-11-19T12:00:00.000Z",
    verificadoEm:
      estado === "em_verificacao" ? null : "2026-11-19T12:00:01.000Z",
  });
  const linhaDe = (nome: string) =>
    screen
      .getAllByText(nome, { selector: ".documentos__nome" })
      .at(-1)!
      .closest("li")!;

  async function cadastrar() {
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar colaborador" }),
    );
    const dialogo = await screen.findByRole("dialog", {
      name: "Confirmar cadastro de colaborador?",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Confirmar cadastro" }),
    );
    await screen.findByText("Admissão registrada");
  }

  it("escolher o arquivo: a linha mostra nome e tamanho, Ver e o menu; nada sobe antes de cadastrar", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento("RG", pdf());
    const linha = linhaDe("RG");
    expect(linha).toHaveTextContent("rg-sintetico.pdf");
    expect(linha).toHaveTextContent("1 KB");
    expect(
      within(linha).getByRole("button", { name: "Ver o arquivo de RG" }),
    ).toBeInTheDocument();
    expect(
      within(linha).getByRole("button", { name: "Mais ações: RG" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 de 5 anexados.")).toBeInTheDocument();
    expect(enviarDocumentoDoColaborador).not.toHaveBeenCalled();
  });

  it("arquivo fora de PDF, JPG ou PNG é recusado ali mesmo e a linha segue Pendente", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento(
      "CPF",
      new File(["x"], "cpf.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    const linha = linhaDe("CPF");
    expect(within(linha).getByRole("alert")).toHaveTextContent(
      "Use um arquivo PDF, JPG ou PNG.",
    );
    expect(linha).toHaveTextContent("Pendente");
  });

  it("menu do arquivo: Remover arquivo volta a linha a Pendente", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento("RG", pdf());
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remover arquivo" }),
    );
    await waitFor(() => expect(linhaDe("RG")).toHaveTextContent("Pendente"));
    expect(screen.getByText("0 de 5 anexados.")).toBeInTheDocument();
  });

  it("proteção de saída: arquivo escolhido conta como edição pendente", async () => {
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <NovaAdmissaoScreen
          onSair={vi.fn()}
          onAbrirAdmitido={vi.fn()}
          papelDoAtor="rh"
        />
      </ProvedorDeEdicoes>,
    );
    await aguardarEmpresa();
    await ateARevisao();
    // Com o rascunho salvo, o formulário não tem pendência…
    vi.mocked(salvarRascunhoAdmissao).mockResolvedValue({
      versao: 1,
      atualizadoEm: "2026-11-19T12:00:00.000Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() =>
      expect(registro.obter().pendentes).not.toContain("Nova admissão"),
    );
    // …e o arquivo escolhido (que nunca vai ao rascunho) passa a ser uma.
    escolherDocumento("Comprovante de endereço", pdf("comprovante.pdf"));
    await waitFor(() =>
      expect(registro.obter().pendentes).toContain("Nova admissão"),
    );
  });

  it("cadastrar envia cada arquivo depois da admissão, com categoria e chave própria; Aprovado aparece com texto", async () => {
    vi.mocked(enviarDocumentoDoColaborador).mockImplementation(
      async (_id, pedido) => gravado(pedido.categoria, "aprovado"),
    );
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    const arquivo = pdf();
    escolherDocumento("RG", arquivo);
    await cadastrar();
    await waitFor(() =>
      expect(enviarDocumentoDoColaborador).toHaveBeenCalledTimes(1),
    );
    const [colaboradorId, pedido] = vi.mocked(enviarDocumentoDoColaborador).mock
      .calls[0]!;
    expect(colaboradorId).toBe(resposta.id);
    expect(pedido.categoria).toBe("rg");
    expect(pedido.arquivo).toBe(arquivo);
    expect(pedido.chaveIdempotencia).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const envio = await screen.findByRole("heading", {
      level: 3,
      name: "Documentos",
    });
    await waitFor(() =>
      expect(envio.closest("section")!).toHaveTextContent("Aprovado"),
    );
  });

  it("falha transitória: Não enviado com Tentar de novo, que repete a mesma chave", async () => {
    vi.mocked(enviarDocumentoDoColaborador)
      .mockRejectedValueOnce(recusa(503))
      .mockResolvedValueOnce(gravado("rg", "aprovado"));
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento("RG", pdf());
    await cadastrar();
    const tentar = await screen.findByRole("button", {
      name: "Tentar de novo o envio de RG",
    });
    expect(tentar.closest("li")!).toHaveTextContent("Não enviado");
    fireEvent.click(tentar);
    await waitFor(() =>
      expect(enviarDocumentoDoColaborador).toHaveBeenCalledTimes(2),
    );
    const chaves = vi
      .mocked(enviarDocumentoDoColaborador)
      .mock.calls.map(([, p]) => p.chaveIdempotencia);
    expect(chaves[1]).toBe(chaves[0]);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Tentar de novo o envio de RG" }),
      ).toBeNull(),
    );
  });

  it.each([
    [
      "formato",
      recusa(422, { codigo: "documento_formato_invalido" }),
      /não é um PDF, JPG ou PNG válido/,
    ],
    [
      "conteúdo corrompido",
      recusa(422, { codigo: "documento_arquivo_malformado" }),
      /corrompido ou incompleto/,
    ],
    ["tamanho", recusa(413), /passa de 10 MB/],
    ["acesso recusado", recusa(403), /acesso não permite/],
  ])(
    "recusa definitiva (%s): mensagem acionável, sem Tentar de novo",
    async (_, erro, mensagem) => {
      vi.mocked(enviarDocumentoDoColaborador).mockRejectedValueOnce(erro);
      montar();
      await aguardarEmpresa();
      await ateARevisao();
      escolherDocumento("RG", pdf());
      await cadastrar();
      await waitFor(() =>
        expect(screen.getByText(mensagem)).toBeInTheDocument(),
      );
      expect(screen.getByText(mensagem).closest("li")!).toHaveTextContent(
        "Não enviado",
      );
      expect(
        screen.queryByRole("button", { name: "Tentar de novo o envio de RG" }),
      ).toBeNull();
    },
  );

  it("arquivo reprovado pelo antivírus: Reprovado, explicado, sem nova tentativa", async () => {
    vi.mocked(enviarDocumentoDoColaborador).mockResolvedValueOnce(
      gravado("rg", "reprovado"),
    );
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento("RG", pdf());
    await cadastrar();
    const detalhe = await screen.findByText(/antivírus recusou este arquivo/);
    expect(detalhe.closest("li")!).toHaveTextContent("Reprovado");
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).toBeNull();
  });

  it("durante o envio, Registrar outra admissão fica bloqueado, com aviso; a página conta como salvando", async () => {
    let liberar: (v: DocumentoColaboradorApi) => void = () => undefined;
    vi.mocked(enviarDocumentoDoColaborador).mockReturnValue(
      new Promise((r) => {
        liberar = r;
      }),
    );
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <NovaAdmissaoScreen
          onSair={vi.fn()}
          onAbrirAdmitido={vi.fn()}
          papelDoAtor="rh"
        />
      </ProvedorDeEdicoes>,
    );
    await aguardarEmpresa();
    await ateARevisao();
    escolherDocumento("RG", pdf());
    await cadastrar();
    const outra = screen.getByRole("button", {
      name: "Registrar outra admissão",
    });
    expect(outra).toBeDisabled();
    expect(outra).toHaveAccessibleDescription(/Aguarde terminar/);
    expect(registro.obter().salvando).toContain("Nova admissão");
    await act(async () => liberar(gravado("rg", "aprovado")));
    await waitFor(() => expect(outra).toBeEnabled());
    expect(registro.obter().salvando).not.toContain("Nova admissão");
  });

  it("sem arquivo, cadastrar não envia documento e não mostra o bloco", async () => {
    montar();
    await aguardarEmpresa();
    await ateARevisao();
    await cadastrar();
    expect(enviarDocumentoDoColaborador).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { level: 3, name: "Documentos" }),
    ).toBeNull();
  });
});

describe("T215 — CPF já cadastrado, conferido ao digitar", () => {
  const AVISO = "Este CPF já está cadastrado nesta empresa.";
  const proxima = () => screen.getByRole("button", { name: "Próxima etapa" });
  const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("CPF completo e válido: consulta só os dígitos e avisa no campo; não avança", async () => {
    vi.mocked(consultarCpfEmUso).mockResolvedValue(true);
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Ana Sintética" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    await waitFor(() => expect(cpf()).toHaveAccessibleDescription(AVISO));
    expect(cpf()).toHaveAttribute("aria-invalid", "true");
    expect(consultarCpfEmUso).toHaveBeenCalledTimes(1);
    expect(consultarCpfEmUso).toHaveBeenCalledWith("52998224725");
    fireEvent.click(proxima());
    await waitFor(() => expect(cpf()).toHaveFocus());
    expect(tituloDaEtapa()).toHaveTextContent(/Dados básicos$/);
    expect(cpf()).toHaveAccessibleDescription(AVISO);
  });

  it("incompleto ou inválido não consulta; trocar o CPF tira o aviso; o livre não acusa", async () => {
    vi.mocked(consultarCpfEmUso).mockImplementation(
      async (c) => c === "52998224725",
    );
    montar();
    await aguardarEmpresa();
    fireEvent.change(cpf(), { target: { value: "529.982.247" } });
    fireEvent.change(cpf(), { target: { value: "111.111.111-11" } });
    await esperar(700);
    expect(consultarCpfEmUso).not.toHaveBeenCalled();
    expect(cpf()).not.toHaveAttribute("aria-invalid");

    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    await waitFor(() => expect(cpf()).toHaveAccessibleDescription(AVISO));
    fireEvent.change(cpf(), { target: { value: "111.444.777-35" } });
    expect(cpf()).not.toHaveAttribute("aria-invalid");
    await waitFor(() =>
      expect(consultarCpfEmUso).toHaveBeenLastCalledWith("11144477735"),
    );
    await esperar(50);
    expect(cpf()).not.toHaveAttribute("aria-invalid");
  });

  it("digitação rápida: uma consulta só, a do CPF que ficou; resposta velha não acusa", async () => {
    let responderVelho: (v: boolean) => void = () => {};
    vi.mocked(consultarCpfEmUso).mockImplementation((c) =>
      c === "52998224725"
        ? new Promise<boolean>((r) => {
            responderVelho = r;
          })
        : Promise.resolve(false),
    );
    montar();
    await aguardarEmpresa();
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    await waitFor(() => expect(consultarCpfEmUso).toHaveBeenCalledTimes(1));
    fireEvent.change(cpf(), { target: { value: "111.444.777-35" } });
    await waitFor(() => expect(consultarCpfEmUso).toHaveBeenCalledTimes(2));
    responderVelho(true);
    await esperar(50);
    expect(cpf()).not.toHaveAttribute("aria-invalid");

    vi.mocked(consultarCpfEmUso).mockClear();
    fireEvent.change(cpf(), { target: { value: "390.533.447" } });
    fireEvent.change(cpf(), { target: { value: "390.533.447-05" } });
    await esperar(700);
    expect(consultarCpfEmUso).toHaveBeenCalledTimes(1);
    expect(consultarCpfEmUso).toHaveBeenCalledWith("39053344705");
  });

  it("falha na conferência não trava: a etapa avança e o servidor confere ao gravar", async () => {
    vi.mocked(consultarCpfEmUso).mockRejectedValue(new Error("rede"));
    montar();
    await aguardarEmpresa();
    fireEvent.change(nome(), { target: { value: "Ana Sintética" } });
    fireEvent.change(cpf(), { target: { value: CPF_VALIDO } });
    await waitFor(() => expect(consultarCpfEmUso).toHaveBeenCalledTimes(1));
    await esperar(50);
    expect(cpf()).not.toHaveAttribute("aria-invalid");
    fireEvent.click(proxima());
    await waitFor(() =>
      expect(tituloDaEtapa()).toHaveTextContent(/Dados profissionais$/),
    );
  });
});
