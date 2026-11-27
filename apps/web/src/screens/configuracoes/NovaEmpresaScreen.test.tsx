/**
 * T209 — Configurações › Empresas › Nova empresa, em duas etapas (padrão de
 * cadastro em etapas): Dados da empresa (CNPJ e razão social obrigatórios;
 * porte e endereço opcionais, o endereço pelo CEP) e Colaboradores (importar
 * planilha, cadastro individual ou depois). Ao concluir, a empresa é criada
 * e, conforme a escolha, a tela abre a empresa nova na importação ou no
 * Novo colaborador, ou volta a Empresas.
 *
 * Dados sintéticos; CNPJs só de exemplo.
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
import { EmpresasApiError, cadastrarEmpresa } from "../../api/empresasClient";
import { trocarEmpresaDoContexto } from "../../api/contextoEmpresarialClient";
import { consultarCep } from "../../api/cepClient";
import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
} from "../../app/edicoesPendentes";
import { NovaEmpresaScreen, NOVA_EMPRESA_TITULO_ID } from "./NovaEmpresaScreen";

vi.mock("../../api/empresasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/empresasClient")
  >("../../api/empresasClient");
  return { ...actual, cadastrarEmpresa: vi.fn() };
});
vi.mock("../../api/contextoEmpresarialClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/contextoEmpresarialClient")
  >("../../api/contextoEmpresarialClient");
  return { ...actual, trocarEmpresaDoContexto: vi.fn() };
});
vi.mock("../../api/cepClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/cepClient")>(
    "../../api/cepClient",
  );
  return { ...actual, consultarCep: vi.fn() };
});

const CNPJ = "11.222.333/0001-81";
const CRIADA = {
  id: "empresa-nova-sintetica",
  codigo: "COMERCIO_SINTETICO",
  nome: "Comercio Sintetico",
  cnpj: "11222333000181",
  porte: null,
};

function montar() {
  const onSair = vi.fn();
  const onCriadaSemAbrir = vi.fn();
  const onEmpresaAberta = vi.fn();
  render(
    <ComGuardaDeSaida>
      <NovaEmpresaScreen
        onSair={onSair}
        onCriadaSemAbrir={onCriadaSemAbrir}
        onEmpresaAberta={onEmpresaAberta}
      />
    </ComGuardaDeSaida>,
  );
  return { onSair, onCriadaSemAbrir, onEmpresaAberta };
}

const cnpj = () => screen.getByLabelText(/^CNPJ$/);
const razao = () => screen.getByLabelText(/^Razão social ou nome$/);
const porte = () => screen.getByLabelText(/^Porte$/);
const cep = () => screen.getByLabelText(/^CEP$/);
const proxima = () => screen.getByRole("button", { name: /Próxima etapa/ });
const tituloDaEtapa = () => screen.getAllByRole("heading", { level: 2 })[0]!;

function preencherEtapa1() {
  fireEvent.change(cnpj(), { target: { value: CNPJ } });
  fireEvent.change(razao(), { target: { value: "  Comercio   Sintetico " } });
}

beforeEach(() => {
  vi.mocked(cadastrarEmpresa).mockReset();
  vi.mocked(trocarEmpresaDoContexto).mockReset();
  vi.mocked(consultarCep).mockReset();
  vi.mocked(cadastrarEmpresa).mockResolvedValue(CRIADA);
  vi.mocked(trocarEmpresaDoContexto).mockResolvedValue({
    id: CRIADA.id,
    codigo: CRIADA.codigo,
    nome: CRIADA.nome,
    cnpj: CRIADA.cnpj,
  });
});

describe("T209 — Nova empresa: etapa 1 (Dados da empresa)", () => {
  it("cabeçalho, etapas e textos do padrão de cadastro", () => {
    montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Nova empresa" }),
    ).toHaveAttribute("id", NOVA_EMPRESA_TITULO_ID);
    expect(
      screen.getByText("Duas etapas: os dados do CNPJ e, se quiser, a equipe."),
    ).toBeInTheDocument();
    const etapas = screen.getByRole("navigation", {
      name: "Etapas do cadastro",
    });
    expect(etapas).toHaveTextContent("Dados da empresa");
    expect(etapas).toHaveTextContent("Identificação e endereço");
    expect(etapas).toHaveTextContent("Colaboradores");
    expect(etapas).toHaveTextContent("Como incluir a equipe");
    expect(tituloDaEtapa()).toHaveTextContent(/Dados da empresa$/);
    expect(screen.getByText("Etapa 1 de 2")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Identificação" }),
    ).toHaveTextContent("Como a empresa aparece no seletor e nos cadastros.");
    expect(screen.getByRole("region", { name: "Endereço" })).toHaveTextContent(
      "O CEP completa o endereço; revise número e complemento.",
    );
    expect(screen.getByText("50% concluído")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
  });

  it("CNPJ com máscara progressiva e o selo 'Válido' só com verificadores certos", () => {
    montar();
    fireEvent.change(cnpj(), { target: { value: "11222333000182" } });
    expect(cnpj()).toHaveValue("11.222.333/0001-82");
    expect(screen.queryByText("Válido")).toBeNull();
    fireEvent.change(cnpj(), { target: { value: "11222333000181" } });
    expect(cnpj()).toHaveValue(CNPJ);
    expect(screen.getByText("Válido")).toBeInTheDocument();
    // T216 — o selo é o status padrão de sucesso.
    expect(screen.getByText("Válido").closest(".evolli-badge")).toHaveClass(
      "evolli-badge--success",
    );
    expect(cnpj()).toHaveAccessibleDescription(/CNPJ válido/);
  });

  it("vazio: 'CNPJ é obrigatório' e 'Informe o nome da empresa', foco no CNPJ; não avança", async () => {
    montar();
    fireEvent.click(proxima());
    await waitFor(() => expect(cnpj()).toHaveFocus());
    expect(cnpj()).toHaveAttribute("aria-invalid", "true");
    expect(cnpj()).toHaveAccessibleDescription("CNPJ é obrigatório");
    expect(razao()).toHaveAccessibleDescription(/Informe o nome da empresa/);
    expect(tituloDaEtapa()).toHaveTextContent(/Dados da empresa$/);
  });

  it("CNPJ com verificador errado: mensagem própria e não avança", async () => {
    montar();
    fireEvent.change(cnpj(), { target: { value: "11222333000182" } });
    fireEvent.change(razao(), { target: { value: "Empresa" } });
    fireEvent.click(proxima());
    await waitFor(() => expect(cnpj()).toHaveFocus());
    expect(cnpj()).toHaveAccessibleDescription(
      "CNPJ inválido. Confira os números.",
    );
  });

  it("porte com as seis faixas; endereço e porte opcionais", () => {
    montar();
    expect(
      [...(porte() as HTMLSelectElement).options].map((o) => o.textContent),
    ).toEqual([
      "Selecione",
      "1-10 colaboradores",
      "11-50 colaboradores",
      "51-200 colaboradores",
      "201-500 colaboradores",
      "501-1000 colaboradores",
      "Mais de 1000 colaboradores",
    ]);
    preencherEtapa1();
    fireEvent.click(proxima());
    expect(tituloDaEtapa()).toHaveTextContent(
      /Colaboradores da Comercio Sintetico$/,
    );
  });

  it("CEP completo preenche o endereço sozinho, com 'Endereço localizado pelo CEP'", async () => {
    vi.mocked(consultarCep).mockResolvedValue({
      cep: "30140071",
      logradouro: "Avenida Sintetica",
      bairro: "Bairro Sintetico",
      cidade: "Cidade Sintetica",
      uf: "MG",
      estado: "Minas Gerais",
    });
    montar();
    fireEvent.change(cep(), { target: { value: "30140071" } });
    await waitFor(() =>
      expect(screen.getByLabelText(/^Logradouro$/)).toHaveValue(
        "Avenida Sintetica",
      ),
    );
    expect(screen.getByLabelText(/^Bairro$/)).toHaveValue("Bairro Sintetico");
    expect(screen.getByLabelText(/^Cidade$/)).toHaveValue("Cidade Sintetica");
    expect(screen.getByLabelText(/^UF$/)).toHaveValue("MG");
    expect(
      screen.getByText("Endereço localizado pelo CEP"),
    ).toBeInTheDocument();
  });
});

describe("T209 — Nova empresa: etapa 2 (Colaboradores) e conclusão", () => {
  async function irParaEtapa2() {
    montar();
    preencherEtapa1();
    fireEvent.click(proxima());
    await screen.findByText("Etapa 2 de 2");
  }

  it("três opções em cartões de rádio; importar vem marcada; o botão muda com a escolha", async () => {
    await irParaEtapa2();
    expect(
      screen.getByText("Escolha como incluir as pessoas desta empresa."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`As pessoas ficarão no CNPJ ${CNPJ}.`),
    ).toBeInTheDocument();
    const grupo = screen.getByRole("radiogroup", {
      name: "Como incluir a equipe?",
    });
    expect(within(grupo).getAllByRole("radio")).toHaveLength(3);
    expect(
      within(grupo).getByRole("radio", { name: /Importar planilha/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Criar e importar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("100% concluído")).toBeInTheDocument();
    fireEvent.click(
      within(grupo).getByRole("radio", { name: /Cadastro individual/ }),
    );
    expect(
      screen.getByRole("button", { name: "Criar empresa" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(grupo).getByRole("radio", { name: /Incluir depois/ }),
    );
    expect(
      screen.getByRole("button", { name: "Criar empresa" }),
    ).toBeInTheDocument();
  });

  it("Voltar preserva o que foi digitado", async () => {
    await irParaEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(cnpj()).toHaveValue(CNPJ);
    expect(razao()).toHaveValue("  Comercio   Sintetico ");
  });

  it("importar: cria com o CNPJ sem máscara e o nome aparado, abre a empresa nova e leva à importação", async () => {
    await irParaEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Criar e importar" }));
    await waitFor(() => expect(cadastrarEmpresa).toHaveBeenCalledTimes(1));
    expect(cadastrarEmpresa).toHaveBeenCalledWith({
      cnpj: "11222333000181",
      nome: "Comercio Sintetico",
    });
    await waitFor(() =>
      expect(trocarEmpresaDoContexto).toHaveBeenCalledWith(CRIADA.id),
    );
  });

  it("cadastro individual: abre a empresa nova no Novo colaborador", async () => {
    const chamadas: unknown[] = [];
    montar();
    preencherEtapa1();
    fireEvent.change(porte(), { target: { value: "11_50" } });
    fireEvent.click(proxima());
    await screen.findByText("Etapa 2 de 2");
    fireEvent.click(screen.getByRole("radio", { name: /Cadastro individual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar empresa" }));
    await waitFor(() => expect(trocarEmpresaDoContexto).toHaveBeenCalled());
    chamadas.push(vi.mocked(cadastrarEmpresa).mock.calls[0]![0]);
    expect(chamadas[0]).toMatchObject({ porte: "11_50" });
  });

  it("os destinos depois de criar: importação, Novo colaborador ou Empresas", async () => {
    for (const [opcao, botao, esperado] of [
      [/Importar planilha/, "Criar e importar", "importar-colaboradores"],
      [/Cadastro individual/, "Criar empresa", "nova-admissao"],
    ] as const) {
      const { onEmpresaAberta } = montar();
      preencherEtapa1();
      fireEvent.click(proxima());
      await screen.findByText("Etapa 2 de 2");
      fireEvent.click(screen.getByRole("radio", { name: opcao }));
      fireEvent.click(screen.getByRole("button", { name: botao }));
      await waitFor(() => expect(onEmpresaAberta).toHaveBeenCalledTimes(1));
      expect(onEmpresaAberta.mock.calls[0]![1]).toBe(esperado);
      document.body.innerHTML = "";
    }
    vi.mocked(trocarEmpresaDoContexto).mockClear();
    const { onCriadaSemAbrir } = montar();
    preencherEtapa1();
    fireEvent.click(proxima());
    await screen.findByText("Etapa 2 de 2");
    fireEvent.click(screen.getByRole("radio", { name: /Incluir depois/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar empresa" }));
    await waitFor(() => expect(onCriadaSemAbrir).toHaveBeenCalledTimes(1));
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
  });

  it("CNPJ já cadastrado (409): volta à etapa 1 com a mensagem no CNPJ", async () => {
    vi.mocked(cadastrarEmpresa).mockRejectedValue(
      new EmpresasApiError(409, "Conflito", [
        { campo: "cnpj", motivo: "em_uso" },
      ]),
    );
    await irParaEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Criar e importar" }));
    await waitFor(() => expect(cnpj()).toHaveFocus());
    expect(cnpj()).toHaveAccessibleDescription("Este CNPJ já está cadastrado.");
    expect(tituloDaEtapa()).toHaveTextContent(/Dados da empresa$/);
  });

  it("falha geral: mensagem e nada é trocado; dá para tentar de novo", async () => {
    vi.mocked(cadastrarEmpresa).mockRejectedValueOnce(new Error("rede"));
    await irParaEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Criar e importar" }));
    expect(
      await screen.findByText(
        "Não foi possível criar a empresa agora. Tente de novo.",
      ),
    ).toBeInTheDocument();
    expect(trocarEmpresaDoContexto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Criar e importar" }));
    await waitFor(() => expect(cadastrarEmpresa).toHaveBeenCalledTimes(2));
  });

  it("criada, mas a troca falhou: diz que a empresa existe e oferece ir a Empresas", async () => {
    vi.mocked(trocarEmpresaDoContexto).mockRejectedValue(new Error("rede"));
    await irParaEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Criar e importar" }));
    expect(
      await screen.findByText(
        /A empresa Comercio Sintetico foi criada, mas não foi possível abri-la agora/,
      ),
    ).toBeInTheDocument();
    await act(async () => {});
    expect(cadastrarEmpresa).toHaveBeenCalledTimes(1);
  });

  it("duplo clique em 'Criar e importar' cria uma vez só", async () => {
    let concluir: (v: typeof CRIADA) => void = () => {};
    vi.mocked(cadastrarEmpresa).mockImplementation(
      () => new Promise((r) => (concluir = r)),
    );
    await irParaEtapa2();
    const botao = screen.getByRole("button", { name: "Criar e importar" });
    fireEvent.click(botao);
    fireEvent.click(botao);
    await act(async () => concluir(CRIADA));
    expect(cadastrarEmpresa).toHaveBeenCalledTimes(1);
  });
});

describe("T209 — Nova empresa: o padrão compartilhado", () => {
  it("usa o assistente compartilhado (sem CSS de cores próprias)", () => {
    const fonte = readFileSync(
      "src/screens/configuracoes/NovaEmpresaScreen.tsx",
      "utf8",
    );
    expect(fonte).toMatch(/CadastroEmEtapas/);
    expect(fonte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("T209 — Nova empresa: sair depois de criar não esbarra na guarda", () => {
  it.each([
    ["Incluir depois", "Criar empresa", "semAbrir"],
    ["Importar planilha", "Criar e importar", "aberta"],
  ] as const)(
    "%s: quando a tela pede a navegação, nada está salvando nem pendente",
    async (opcao, botao, qual) => {
      const registro = new RegistroDeEdicoes();
      const vistos: unknown[] = [];
      const anotar = () => vistos.push(registro.obter());
      render(
        <ProvedorDeEdicoes registro={registro}>
          <NovaEmpresaScreen
            onSair={() => {}}
            onCriadaSemAbrir={anotar}
            onEmpresaAberta={anotar}
          />
        </ProvedorDeEdicoes>,
      );
      preencherEtapa1();
      fireEvent.click(proxima());
      await screen.findByText("Etapa 2 de 2");
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(opcao) }));
      fireEvent.click(screen.getByRole("button", { name: botao }));
      await waitFor(() => expect(vistos).toHaveLength(1));
      expect(vistos[0]).toEqual({ pendentes: [], salvando: [] });
      void qual;
    },
  );
});
