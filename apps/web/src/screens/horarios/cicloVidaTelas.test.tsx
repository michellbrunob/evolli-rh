/**
 * Ciclo de vida nas telas (T158) — uma entidade por bloco.
 *
 * `AcaoSituacao.test.tsx` já prova o componente em isolamento. Estes testes
 * provam a **integração**, que é onde o erro caro mora: a tela certa chamando
 * a função certa, para a entidade certa.
 *
 * Por que uma suíte própria, e não acréscimo aos testes já existentes das três
 * telas: a asserção que importa aqui é a mesma nas seis entidades, e repeti-la
 * em três arquivos com três harnesses diferentes esconderia a entidade que
 * ficou de fora. Aqui a tabela é a lista de cobertura — se uma entidade sumir,
 * o arquivo encolhe visivelmente.
 *
 * As seis cobertas: unidade, departamento, área, equipe (Estrutura
 * organizacional), cargo (Funções e cargos) e centro de custo (Centros de
 * custo). Fora, por divergirem de contrato: `tabela_horario` (verbo
 * `desativar`, permissão `alter`, estado booleano, sem 409 — e já com
 * interface desde a T037) e `empresa` (sem tela no produto).
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/organizacaoClient");
vi.mock("../../api/cargoClient");

import * as organizacaoClient from "../../api/organizacaoClient";
import * as cargoClient from "../../api/cargoClient";
import { EstruturaOrganizacionalScreen } from "./EstruturaOrganizacionalScreen";
import { FuncoesCargosScreen } from "./FuncoesCargosScreen";
import { CentrosCustoScreen } from "./CentrosCustoScreen";

const EMPRESA = {
  id: "emp-1",
  codigo: "EMP-01",
  nome: "Empresa Exemplo (teste)",
  status: "ativo",
};

function pagina<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 20, total: itens.length };
}

function registro(over: Record<string, unknown> = {}) {
  return {
    id: "reg-1",
    codigo: "COD-1",
    nome: "Registro Teste",
    status: "ativo",
    empresaId: EMPRESA.id,
    departamentoId: "dep-1",
    unidadeOrganizacionalId: null,
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const org = vi.mocked(organizacaoClient);
  // Catálogos de apoio: vazios bastam, a asserção é sobre a transição.
  org.listarEmpresas?.mockResolvedValue(pagina([EMPRESA]) as never);
  org.listarEmpresasMulti?.mockResolvedValue(pagina([EMPRESA]) as never);
  org.listarEmpresasParaCentroCusto?.mockResolvedValue(
    pagina([EMPRESA]) as never,
  );
  org.listarDepartamentosParaArea?.mockResolvedValue(pagina([]) as never);
  org.listarDepartamentosParaEquipe?.mockResolvedValue(pagina([]) as never);
  org.listarUnidadesParaEquipe?.mockResolvedValue(pagina([]) as never);
  org.listarUnidades?.mockResolvedValue(pagina([]) as never);
  org.listarDepartamentos?.mockResolvedValue(pagina([]) as never);
  org.listarAreas?.mockResolvedValue(pagina([]) as never);
  org.listarEquipes?.mockResolvedValue(pagina([]) as never);
  org.listarCentrosCusto?.mockResolvedValue(pagina([]) as never);
  const cg = vi.mocked(cargoClient);
  cg.listarEmpresas?.mockResolvedValue(pagina([EMPRESA]) as never);
  cg.listarCargos?.mockResolvedValue(pagina([]) as never);
});

/** Abre a confirmação da linha e confirma, devolvendo o rótulo usado. */
async function inativarPrimeiraLinha(rotuloEsperado = "Inativar") {
  const gatilho = await screen.findByRole("button", {
    name: new RegExp(`^${rotuloEsperado} `),
  });
  fireEvent.click(gatilho);
  const dialog = await screen.findByRole("dialog");
  // Dentro de `act` e com um tique do microtask queue: a confirmação dispara
  // uma promessa cujo `finally` ainda escreve estado depois do clique, e sem
  // isto a escrita acontece fora do que o React confirmou — o teste passa e
  // o runner avisa que não provou nada.
  await act(async () => {
    fireEvent.click(
      within(dialog).getByRole("button", { name: rotuloEsperado }),
    );
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("Estrutura organizacional — quatro entidades, quatro funções", () => {
  const org = () => vi.mocked(organizacaoClient);

  async function abrirAba(aba: string) {
    render(<EstruturaOrganizacionalScreen />);
    if (aba !== "Unidades") {
      fireEvent.click(await screen.findByRole("tab", { name: aba }));
    }
  }

  it("unidade chama inativarUnidade, e nenhuma outra", async () => {
    org().listarUnidades.mockResolvedValue(pagina([registro()]) as never);
    org().inativarUnidade.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    await abrirAba("Unidades");
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(org().inativarUnidade).toHaveBeenCalledWith("reg-1"),
    );
    expect(org().inativarDepartamento).not.toHaveBeenCalled();
    expect(org().inativarArea).not.toHaveBeenCalled();
    expect(org().inativarEquipe).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Registro Teste foi inativado.",
    );
  });

  it("departamento chama inativarDepartamento", async () => {
    org().listarDepartamentos.mockResolvedValue(pagina([registro()]) as never);
    org().inativarDepartamento.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    await abrirAba("Departamentos");
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(org().inativarDepartamento).toHaveBeenCalledWith("reg-1"),
    );
    expect(org().inativarUnidade).not.toHaveBeenCalled();
  });

  it("área chama inativarArea", async () => {
    org().listarAreas.mockResolvedValue(pagina([registro()]) as never);
    org().inativarArea.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    await abrirAba("Áreas");
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(org().inativarArea).toHaveBeenCalledWith("reg-1"),
    );
  });

  it("equipe chama inativarEquipe", async () => {
    org().listarEquipes.mockResolvedValue(pagina([registro()]) as never);
    org().inativarEquipe.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    await abrirAba("Equipes");
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(org().inativarEquipe).toHaveBeenCalledWith("reg-1"),
    );
  });

  it("registro inativo oferece reativar, e chama a função de reativação", async () => {
    org().listarUnidades.mockResolvedValue(
      pagina([registro({ status: "inativo" })]) as never,
    );
    org().reativarUnidade.mockResolvedValue(registro() as never);
    await abrirAba("Unidades");
    await inativarPrimeiraLinha("Reativar");
    await waitFor(() =>
      expect(org().reativarUnidade).toHaveBeenCalledWith("reg-1"),
    );
    expect(org().inativarUnidade).not.toHaveBeenCalled();
  });

  it("recusa do servidor não altera a lista nem anuncia sucesso", async () => {
    org().listarUnidades.mockResolvedValue(pagina([registro()]) as never);
    org().inativarUnidade.mockRejectedValue(
      Object.assign(new Error("conflito"), { status: 409 }),
    );
    await abrirAba("Unidades");
    await inativarPrimeiraLinha();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "registro ativo vinculado",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Funções e cargos", () => {
  it("cargo chama inativarCargo e anuncia o resultado", async () => {
    vi.mocked(cargoClient).listarCargos.mockResolvedValue(
      pagina([registro()]) as never,
    );
    vi.mocked(cargoClient).inativarCargo.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    render(<FuncoesCargosScreen />);
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(vi.mocked(cargoClient).inativarCargo).toHaveBeenCalledWith(
        "reg-1",
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Registro Teste foi inativado.",
    );
  });

  it("erro de rede aparece como problema de conexão", async () => {
    vi.mocked(cargoClient).listarCargos.mockResolvedValue(
      pagina([registro()]) as never,
    );
    vi.mocked(cargoClient).inativarCargo.mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    render(<FuncoesCargosScreen />);
    await inativarPrimeiraLinha();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verifique a conexão",
    );
  });
});

describe("Centros de custo", () => {
  it("centro de custo chama inativarCentroCusto", async () => {
    vi.mocked(organizacaoClient).listarCentrosCusto.mockResolvedValue(
      pagina([registro()]) as never,
    );
    vi.mocked(organizacaoClient).inativarCentroCusto.mockResolvedValue(
      registro({ status: "inativo" }) as never,
    );
    render(<CentrosCustoScreen />);
    await inativarPrimeiraLinha();
    await waitFor(() =>
      expect(
        vi.mocked(organizacaoClient).inativarCentroCusto,
      ).toHaveBeenCalledWith("reg-1"),
    );
  });

  it("422 só é explicado na reativação, que é onde o contrato o prevê", async () => {
    vi.mocked(organizacaoClient).listarCentrosCusto.mockResolvedValue(
      pagina([registro({ status: "inativo" })]) as never,
    );
    vi.mocked(organizacaoClient).reativarCentroCusto.mockRejectedValue(
      Object.assign(new Error("pai inativo"), { status: 422 }),
    );
    render(<CentrosCustoScreen />);
    await inativarPrimeiraLinha("Reativar");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "nível superior",
    );
  });
});

describe("exclusão não aparece em nenhuma das três telas", () => {
  it("nenhum botão de excluir é renderizado", async () => {
    vi.mocked(organizacaoClient).listarCentrosCusto.mockResolvedValue(
      pagina([registro()]) as never,
    );
    render(<CentrosCustoScreen />);
    await screen.findByRole("button", { name: /^Inativar / });
    expect(
      screen.queryByRole("button", { name: /excluir|remover|apagar|deletar/i }),
    ).toBeNull();
  });
});
