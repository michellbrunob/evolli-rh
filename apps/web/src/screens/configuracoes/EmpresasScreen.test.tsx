/**
 * T209 — Configurações › Empresas: as empresas que a conta alcança, a
 * principal primeiro (selo "Principal"), com CNPJ, colaboradores ativos e
 * cidade; "Adicionar empresa" só para quem cria (RH e master técnico).
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmpresasApiError,
  atualizarEmpresa,
  listarEmpresasDaConta,
} from "../../api/empresasClient";
import { ComGuardaDeSaida } from "../../test/ComGuardaDeSaida";
import { EmpresasScreen, EMPRESAS_TITULO_ID } from "./EmpresasScreen";

vi.mock("../../api/empresasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/empresasClient")
  >("../../api/empresasClient");
  return {
    ...actual,
    listarEmpresasDaConta: vi.fn(),
    atualizarEmpresa: vi.fn(),
  };
});

const ITENS = [
  {
    id: "e1",
    codigo: "ALFA",
    nome: "Empresa Alfa Sintetica",
    cnpj: "11222333000181",
    porte: "11_50" as const,
    cep: "30140071",
    logradouro: "Avenida Sintetica",
    numero: "100",
    complemento: null,
    bairro: "Bairro Sintetico",
    cidade: "Cidade Sintetica",
    uf: "MG",
    principal: true,
    colaboradoresAtivos: 6,
  },
  {
    id: "e2",
    codigo: "BETA",
    nome: "Empresa Beta Sintetica",
    cnpj: null,
    porte: null,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
    principal: false,
    colaboradoresAtivos: 1,
  },
];

function montar(podeAdicionar = true) {
  const onAdicionar = vi.fn();
  render(
    <ComGuardaDeSaida>
      <EmpresasScreen
        podeAdicionar={podeAdicionar}
        podeEditar={podeAdicionar}
        onAdicionar={onAdicionar}
      />
    </ComGuardaDeSaida>,
  );
  return { onAdicionar };
}

beforeEach(() => {
  vi.mocked(listarEmpresasDaConta).mockReset();
  vi.mocked(listarEmpresasDaConta).mockResolvedValue(ITENS);
  vi.mocked(atualizarEmpresa).mockReset();
});

describe("T209 — Configurações › Empresas", () => {
  it("título, navegação interna e textos", async () => {
    montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Configurações" }),
    ).toHaveAttribute("id", EMPRESAS_TITULO_ID);
    const nav = screen.getByRole("navigation", { name: "Configurações" });
    expect(
      within(nav).getByRole("link", { name: "Meu perfil" }),
    ).toHaveAttribute("href", "#/configuracoes/meu-perfil");
    expect(within(nav).getByRole("link", { name: "Empresas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Empresas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Os CNPJs que a sua conta alcança."),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Empresas da conta",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A principal é a empresa da sua conta."),
    ).toBeInTheDocument();
  });

  it("tabela: principal primeiro com selo, CNPJ com máscara, ativos e cidade/UF; sem CNPJ e sem cidade, travessão", async () => {
    montar();
    const tabela = await screen.findByRole("table", {
      name: "Empresas da conta",
    });
    const linhas = within(tabela).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("Empresa Alfa Sintetica");
    expect(linhas[0]).toHaveTextContent("Principal");
    // T216 — o selo "Principal" é o status padrão (informação).
    expect(
      within(linhas[0]!).getByText("Principal").closest(".evolli-badge"),
    ).toHaveClass("evolli-badge--info");
    expect(linhas[0]).toHaveTextContent("11.222.333/0001-81");
    expect(linhas[0]).toHaveTextContent("6 ativos");
    expect(linhas[0]).toHaveTextContent("Cidade Sintetica/MG");
    expect(linhas[1]).not.toHaveTextContent("Principal");
    expect(linhas[1]).toHaveTextContent("Sem CNPJ");
    expect(linhas[1]).toHaveTextContent("1 ativo");
    expect(linhas[1]).toHaveTextContent("—");
  });

  it("'Adicionar empresa' leva à Nova empresa; sem permissão, não aparece", async () => {
    const { onAdicionar } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar empresa" }));
    expect(onAdicionar).toHaveBeenCalledTimes(1);
    document.body.innerHTML = "";
    montar(false);
    await screen.findByRole("table");
    expect(
      screen.queryByRole("button", { name: "Adicionar empresa" }),
    ).toBeNull();
  });

  it("falha ao carregar: mensagem e 'Tentar novamente'", async () => {
    vi.mocked(listarEmpresasDaConta).mockRejectedValueOnce(new Error("rede"));
    montar();
    expect(
      await screen.findByText("Não foi possível carregar as empresas."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(listarEmpresasDaConta).toHaveBeenCalledTimes(2);
  });

  it("aviso de empresa criada, quando vem da Nova empresa", async () => {
    render(
      <EmpresasScreen
        podeAdicionar
        podeEditar
        onAdicionar={() => {}}
        aviso="Empresa Gama Sintetica criada."
      />,
    );
    expect(screen.getByText("Empresa Gama Sintetica criada.")).toHaveAttribute(
      "role",
      "status",
    );
  });
});

describe("T209 — editar empresa no painel lateral", () => {
  async function abrirEdicao(nome = "Empresa Alfa Sintetica") {
    montar();
    fireEvent.click(
      await screen.findByRole("button", { name: `Editar ${nome}` }),
    );
    return screen.findByRole("dialog", { name: nome });
  }

  it("o lápis abre o painel com o nome, 'CNPJ · Principal' e os dados atuais", async () => {
    const painel = await abrirEdicao();
    expect(painel).toHaveTextContent("11.222.333/0001-81 · Principal");
    expect(
      within(painel).getByText("Empresa", { selector: "p" }),
    ).toBeInTheDocument();
    expect(within(painel).getByLabelText(/^Razão social ou nome/)).toHaveValue(
      "Empresa Alfa Sintetica",
    );
    expect(within(painel).getByLabelText(/^CNPJ/)).toHaveValue(
      "11.222.333/0001-81",
    );
    expect(within(painel).getByLabelText(/^Porte/)).toHaveValue("11_50");
    expect(within(painel).getByLabelText(/^CEP/)).toHaveValue("30140-071");
    expect(within(painel).getByLabelText(/^Logradouro/)).toHaveValue(
      "Avenida Sintetica",
    );
    expect(within(painel).getByLabelText(/^Número/)).toHaveValue("100");
    expect(within(painel).getByLabelText(/^Bairro/)).toHaveValue(
      "Bairro Sintetico",
    );
    expect(within(painel).getByLabelText(/^Cidade/)).toHaveValue(
      "Cidade Sintetica",
    );
    expect(within(painel).getByLabelText(/^UF/)).toHaveValue("MG");
    expect(
      within(painel).getByRole("button", { name: "Salvar" }),
    ).toBeInTheDocument();
    expect(
      within(painel).getByRole("button", { name: "Cancelar" }),
    ).toBeInTheDocument();
  });

  it("salvar envia o cadastro inteiro, fecha, recarrega a lista e avisa", async () => {
    vi.mocked(atualizarEmpresa).mockResolvedValue({
      id: "e1",
      codigo: "ALFA",
      nome: "Empresa Alfa Renomeada",
      cnpj: "11222333000181",
      porte: "11_50",
    });
    const painel = await abrirEdicao();
    fireEvent.change(within(painel).getByLabelText(/^Razão social ou nome/), {
      target: { value: "  Empresa Alfa Renomeada " },
    });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(atualizarEmpresa).toHaveBeenCalledTimes(1));
    expect(atualizarEmpresa).toHaveBeenCalledWith("e1", {
      cnpj: "11222333000181",
      nome: "Empresa Alfa Renomeada",
      porte: "11_50",
      endereco: {
        cep: "30140071",
        logradouro: "Avenida Sintetica",
        numero: "100",
        bairro: "Bairro Sintetico",
        cidade: "Cidade Sintetica",
        uf: "MG",
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(listarEmpresasDaConta).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("Empresa Alfa Renomeada atualizada."),
    ).toBeInTheDocument();
  });

  it("obrigatórios: sem nome ou com CNPJ inválido, não envia e mostra no campo", async () => {
    const painel = await abrirEdicao("Empresa Beta Sintetica");
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(within(painel).getByLabelText(/^CNPJ/)).toHaveFocus(),
    );
    expect(within(painel).getByLabelText(/^CNPJ/)).toHaveAccessibleDescription(
      "CNPJ é obrigatório",
    );
    fireEvent.change(within(painel).getByLabelText(/^Razão social ou nome/), {
      target: { value: "  " },
    });
    fireEvent.change(within(painel).getByLabelText(/^CNPJ/), {
      target: { value: "11222333000182" },
    });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(
        within(painel).getByLabelText(/^CNPJ/),
      ).toHaveAccessibleDescription("CNPJ inválido. Confira os números."),
    );
    expect(
      within(painel).getByLabelText(/^Razão social ou nome/),
    ).toHaveAccessibleDescription("Informe o nome da empresa");
    expect(atualizarEmpresa).not.toHaveBeenCalled();
  });

  it("CNPJ de outra empresa (409): mensagem no CNPJ e o painel fica aberto", async () => {
    vi.mocked(atualizarEmpresa).mockRejectedValue(
      new EmpresasApiError(409, "Conflito", [
        { campo: "cnpj", motivo: "em_uso" },
      ]),
    );
    const painel = await abrirEdicao();
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(
        within(painel).getByLabelText(/^CNPJ/),
      ).toHaveAccessibleDescription("Este CNPJ já está cadastrado."),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sem permissão de editar, não há lápis", async () => {
    render(
      <ComGuardaDeSaida>
        <EmpresasScreen
          podeAdicionar={false}
          podeEditar={false}
          onAdicionar={() => {}}
        />
      </ComGuardaDeSaida>,
    );
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /^Editar / })).toBeNull();
  });
});
