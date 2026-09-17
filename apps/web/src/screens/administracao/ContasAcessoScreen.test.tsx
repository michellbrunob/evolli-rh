import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContasAcessoScreen } from "./ContasAcessoScreen";
import {
  ApiError,
  type SafeAccessUserApi,
  alterarPapel,
  criarConta,
  desativarConta,
  listarUsuarios,
  obterUsuarioAtual,
} from "../../api/usersClient";
import { listarEmpresasMulti } from "../../api/organizacaoClient";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return {
    ...actual,
    obterUsuarioAtual: vi.fn(),
    listarUsuarios: vi.fn(),
    criarConta: vi.fn(),
    alterarPapel: vi.fn(),
    desativarConta: vi.fn(),
  };
});

vi.mock("../../api/organizacaoClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/organizacaoClient")
  >("../../api/organizacaoClient");
  return {
    ...actual,
    listarEmpresasMulti: vi.fn(),
  };
});

const PAPEIS_PRIVILEGIADOS = [
  "master_tecnico",
  "admin_tecnico",
  "dpo",
  "auditor",
];

function usuario(overrides: Partial<SafeAccessUserApi>): SafeAccessUserApi {
  return {
    id: "id-generico",
    email: "generico@example.test",
    role: "colaborador",
    companyId: "empresa-a",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

const masterAtor = usuario({
  id: "master-1",
  email: "master@example.test",
  role: "master_tecnico",
  companyId: null,
});
const rhAtor = usuario({
  id: "rh-1",
  email: "rh@example.test",
  role: "rh",
  companyId: "empresa-a",
});
const dpAtor = usuario({
  id: "dp-1",
  email: "dp@example.test",
  role: "dp",
  companyId: "empresa-a",
});
const colaboradorAtor = usuario({
  id: "colab-1",
  email: "colaborador@example.test",
  role: "colaborador",
  companyId: "empresa-a",
});

const contaAtiva = usuario({
  id: "conta-1",
  email: "pessoa1@example.test",
  role: "colaborador",
  status: "active",
  createdAt: "2026-01-05T10:00:00.000Z",
});
const contaDesativada = usuario({
  id: "conta-2",
  email: "pessoa2@example.test",
  role: "gestor",
  status: "disabled",
  createdAt: "2026-01-04T10:00:00.000Z",
});

function mockListaVazia() {
  vi.mocked(listarUsuarios).mockResolvedValue({ items: [], nextCursor: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContasAcessoScreen (T121)", () => {
  describe("carregamento, vazio, erro e retry", () => {
    it("mostra 'Carregando…' antes do /me resolver", async () => {
      let resolver: (v: SafeAccessUserApi) => void = () => undefined;
      vi.mocked(obterUsuarioAtual).mockReturnValueOnce(
        new Promise((resolve) => {
          resolver = resolve;
        }),
      );

      render(<ContasAcessoScreen />);

      expect(screen.getByText("Carregando…")).toBeInTheDocument();

      resolver(rhAtor);
      mockListaVazia();
      await screen.findByText("Nenhuma conta encontrada");
    });

    it("erro ao identificar o ator: mostra mensagem e permite tentar novamente", async () => {
      vi.mocked(obterUsuarioAtual)
        .mockRejectedValueOnce(new Error("falha de rede"))
        .mockResolvedValueOnce(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);

      await screen.findByText("Não foi possível identificar sua conta");

      fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

      await screen.findByText("Nenhuma conta encontrada");
      expect(obterUsuarioAtual).toHaveBeenCalledTimes(2);
    });

    it("vazio: lista sem itens mostra EmptyState", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);

      expect(
        await screen.findByText("Nenhuma conta encontrada"),
      ).toBeInTheDocument();
    });

    it("erro ao carregar a lista: mostra mensagem e permite tentar novamente", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios)
        .mockRejectedValueOnce(new Error("falha de rede"))
        .mockResolvedValueOnce({ items: [contaAtiva], nextCursor: null });

      render(<ContasAcessoScreen />);

      await screen.findByText("Não foi possível carregar as contas de acesso");

      fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

      await screen.findByText("pessoa1@example.test");
    });
  });

  describe("diferença de interface por papel", () => {
    it("master_tecnico: vê 'Nova conta', 'Alterar papel' e 'Desativar'", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(masterAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });
      vi.mocked(listarEmpresasMulti).mockResolvedValue({
        itens: [
          { id: "empresa-a", codigo: "A", nome: "Empresa A", status: "ativo" },
        ],
        pagina: 1,
        tamanhoPagina: 100,
        total: 1,
      });

      render(<ContasAcessoScreen />);

      await screen.findByText("pessoa1@example.test");
      expect(
        screen.getByRole("button", { name: "Nova conta" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Alterar papel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Desativar" }),
      ).toBeInTheDocument();
    });

    it("rh: vê 'Nova conta', 'Alterar papel' e 'Desativar' dentro da própria empresa", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);

      await screen.findByText("pessoa1@example.test");
      expect(
        screen.getByRole("button", { name: "Nova conta" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Alterar papel" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Desativar" }),
      ).toBeInTheDocument();
      // rh nunca vê filtro/coluna de empresa (só existe a própria).
      expect(listarEmpresasMulti).not.toHaveBeenCalled();
    });

    it("dp: NÃO vê 'Nova conta' nem 'Alterar papel' — só 'Desativar'", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(dpAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);

      await screen.findByText("pessoa1@example.test");
      expect(
        screen.queryByRole("button", { name: "Nova conta" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Alterar papel" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Desativar" }),
      ).toBeInTheDocument();
    });

    it("papel sem permissão (colaborador): mostra 'Sem permissão' e nunca chama GET /v1/users", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(colaboradorAtor);

      render(<ContasAcessoScreen />);

      await screen.findByText("Sem permissão");
      expect(listarUsuarios).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("button", { name: "Nova conta" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("filtros e paginação keyset", () => {
    it("filtro de status dispara nova consulta com o parâmetro certo", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.change(screen.getByLabelText("Status"), {
        target: { value: "disabled" },
      });

      await waitFor(() =>
        expect(listarUsuarios).toHaveBeenLastCalledWith(
          expect.objectContaining({ status: "disabled" }),
        ),
      );
    });

    it("filtro de papel dispara nova consulta com o parâmetro certo", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.change(screen.getByLabelText("Papel"), {
        target: { value: "gestor" },
      });

      await waitFor(() =>
        expect(listarUsuarios).toHaveBeenLastCalledWith(
          expect.objectContaining({ role: "gestor" }),
        ),
      );
    });

    it("próxima página usa o nextCursor recebido; página anterior volta ao cursor nulo", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios)
        .mockResolvedValueOnce({ items: [contaAtiva], nextCursor: "cursor-2" })
        .mockResolvedValueOnce({
          items: [contaDesativada],
          nextCursor: null,
        })
        .mockResolvedValueOnce({ items: [contaAtiva], nextCursor: "cursor-2" });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      const anterior = screen.getByRole("button", { name: "Página anterior" });
      const proxima = screen.getByRole("button", { name: "Próxima página" });
      expect(anterior).toBeDisabled();
      expect(proxima).not.toBeDisabled();

      fireEvent.click(proxima);
      await screen.findByText("pessoa2@example.test");
      expect(listarUsuarios).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: "cursor-2" }),
      );

      fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
      await screen.findByText("pessoa1@example.test");
      const ultimaChamada = vi.mocked(listarUsuarios).mock.calls.at(-1)![0]!;
      expect(ultimaChamada.cursor).toBeUndefined();
    });

    it("master_tecnico pode filtrar por empresa quando há mais de uma", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(masterAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });
      vi.mocked(listarEmpresasMulti).mockResolvedValue({
        itens: [
          { id: "empresa-a", codigo: "A", nome: "Empresa A", status: "ativo" },
          { id: "empresa-b", codigo: "B", nome: "Empresa B", status: "ativo" },
        ],
        pagina: 1,
        tamanhoPagina: 100,
        total: 2,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      const filtroEmpresa = await screen.findByLabelText("Empresa");
      fireEvent.change(filtroEmpresa, { target: { value: "empresa-b" } });

      await waitFor(() =>
        expect(listarUsuarios).toHaveBeenLastCalledWith(
          expect.objectContaining({ companyId: "empresa-b" }),
        ),
      );
    });

    it("rh nunca envia companyId — mesmo sem campo de filtro de empresa", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      expect(screen.queryByLabelText("Empresa")).not.toBeInTheDocument();
      const chamada = vi.mocked(listarUsuarios).mock.calls[0]![0]!;
      expect(chamada.companyId).toBeUndefined();
    });
  });

  describe("criação de conta", () => {
    it("rh: formulário não pede empresa (implícita, da própria sessão)", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");

      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));

      await screen.findByRole("heading", { name: "Nova conta de acesso" });
      expect(screen.queryByLabelText("Empresa")).not.toBeInTheDocument();
    });

    it("master_tecnico: formulário exige escolher a empresa", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(masterAtor);
      mockListaVazia();
      vi.mocked(listarEmpresasMulti).mockResolvedValue({
        itens: [
          { id: "empresa-a", codigo: "A", nome: "Empresa A", status: "ativo" },
          { id: "empresa-b", codigo: "B", nome: "Empresa B", status: "ativo" },
        ],
        pagina: 1,
        tamanhoPagina: 100,
        total: 2,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");

      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));

      expect(
        await screen.findByLabelText(/^Empresa da nova conta/),
      ).toBeInTheDocument();
    });

    it("select de papel nunca oferece papel privilegiado", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));

      const selectPapel = await screen.findByLabelText(/^Papel da nova conta/);
      const opcoes = within(selectPapel)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value);
      for (const privilegiado of PAPEIS_PRIVILEGIADOS) {
        expect(opcoes).not.toContain(privilegiado);
      }
    });

    it("validação: senha curta bloqueia o envio, sem chamar a API", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));
      await screen.findByRole("heading", { name: "Nova conta de acesso" });

      fireEvent.change(screen.getByLabelText(/^E-mail/), {
        target: { value: "novo@example.test" },
      });
      fireEvent.change(screen.getByLabelText(/^Senha inicial/), {
        target: { value: "curta" },
      });
      fireEvent.change(screen.getByLabelText(/^Papel da nova conta/), {
        target: { value: "colaborador" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText("A senha deve ter pelo menos 15 caracteres."),
      ).toBeInTheDocument();
      expect(criarConta).not.toHaveBeenCalled();
    });

    it("envio válido (rh): usa a própria empresa e recarrega a lista ao suceder", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios)
        .mockResolvedValueOnce({ items: [], nextCursor: null })
        .mockResolvedValueOnce({ items: [contaAtiva], nextCursor: null });
      vi.mocked(criarConta).mockResolvedValue(contaAtiva);

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));
      await screen.findByRole("heading", { name: "Nova conta de acesso" });

      fireEvent.change(screen.getByLabelText(/^E-mail/), {
        target: { value: "novo@example.test" },
      });
      fireEvent.change(screen.getByLabelText(/^Senha inicial/), {
        target: { value: "senha-sintetica-bem-longa" },
      });
      fireEvent.change(screen.getByLabelText(/^Papel da nova conta/), {
        target: { value: "colaborador" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

      await waitFor(() =>
        expect(criarConta).toHaveBeenCalledWith({
          email: "novo@example.test",
          password: "senha-sintetica-bem-longa",
          role: "colaborador",
          companyId: "empresa-a",
        }),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Nova conta de acesso" }),
        ).not.toBeInTheDocument(),
      );
      expect(
        await screen.findByText("pessoa1@example.test"),
      ).toBeInTheDocument();
    });

    it("erro 422 mostra mensagem genérica sobre política de senha", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();
      vi.mocked(criarConta).mockRejectedValue(new ApiError(422, "..."));

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));
      await screen.findByRole("heading", { name: "Nova conta de acesso" });

      fireEvent.change(screen.getByLabelText(/^E-mail/), {
        target: { value: "novo@example.test" },
      });
      fireEvent.change(screen.getByLabelText(/^Senha inicial/), {
        target: { value: "senha-sintetica-bem-longa" },
      });
      fireEvent.change(screen.getByLabelText(/^Papel da nova conta/), {
        target: { value: "colaborador" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));

      expect(
        await screen.findByText(/requisitos mínimos/i),
      ).toBeInTheDocument();
    });

    it("cancelar fecha o formulário sem chamar a API", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));
      await screen.findByRole("heading", { name: "Nova conta de acesso" });

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(
        screen.queryByRole("heading", { name: "Nova conta de acesso" }),
      ).not.toBeInTheDocument();
      expect(criarConta).not.toHaveBeenCalled();
    });
  });

  describe("alteração de papel", () => {
    it("abre formulário só com select de papel; salva chamando alterarPapel(id, novoPapel)", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });
      vi.mocked(alterarPapel).mockResolvedValue({
        ...contaAtiva,
        role: "gestor",
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.click(screen.getByRole("button", { name: "Alterar papel" }));

      const heading = await screen.findByRole("heading", {
        name: /Alterar papel/,
      });
      expect(heading).toHaveTextContent("pessoa1@example.test");

      // Só existe o campo de papel — nenhum campo de empresa/unidade/equipe.
      expect(screen.queryByLabelText("Empresa")).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/unidade/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/equipe/i)).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/^Novo papel/), {
        target: { value: "gestor" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Salvar papel" }));

      await waitFor(() =>
        expect(alterarPapel).toHaveBeenCalledWith(contaAtiva.id, "gestor"),
      );
    });

    it("select de novo papel nunca oferece papel privilegiado", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");
      fireEvent.click(screen.getByRole("button", { name: "Alterar papel" }));

      const selectPapel = await screen.findByLabelText(/^Novo papel/);
      const opcoes = within(selectPapel)
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value);
      for (const privilegiado of PAPEIS_PRIVILEGIADOS) {
        expect(opcoes).not.toContain(privilegiado);
      }
    });
  });

  describe("desativação", () => {
    it("exige confirmação explícita com aviso de revogação de sessões", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

      expect(
        await screen.findByText(/revoga imediatamente todas as sessões/i),
      ).toBeInTheDocument();
      expect(desativarConta).not.toHaveBeenCalled();
    });

    it("cancelar não desativa", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");
      fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
      await screen.findByText(/revoga imediatamente/i);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(desativarConta).not.toHaveBeenCalled();
      expect(
        screen.queryByText(/revoga imediatamente/i),
      ).not.toBeInTheDocument();
    });

    it("confirmar desativa e recarrega a lista", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios)
        .mockResolvedValueOnce({ items: [contaAtiva], nextCursor: null })
        .mockResolvedValueOnce({
          items: [{ ...contaAtiva, status: "disabled" }],
          nextCursor: null,
        });
      vi.mocked(desativarConta).mockResolvedValue(undefined);

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");
      fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
      await screen.findByText(/revoga imediatamente/i);

      fireEvent.click(
        screen.getByRole("button", { name: "Confirmar desativação" }),
      );

      await waitFor(() =>
        expect(desativarConta).toHaveBeenCalledWith(contaAtiva.id),
      );
      await waitFor(() => expect(listarUsuarios).toHaveBeenCalledTimes(2));
    });

    it("conta já desativada não oferece 'Desativar' de novo (nem 'Reativar')", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaDesativada],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa2@example.test");

      expect(
        screen.queryByRole("button", { name: "Desativar" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /reativar/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("ausência de autoelevação, privilégio, reativação, exclusão e ID manual", () => {
    it("a própria linha do ator não mostra nenhuma ação administrativa", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [rhAtor, contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      const linhaPropria = screen.getByText("rh@example.test").closest("tr")!;
      expect(within(linhaPropria).getByText("Sua conta")).toBeInTheDocument();
      expect(
        within(linhaPropria).queryByRole("button", { name: "Alterar papel" }),
      ).not.toBeInTheDocument();
      expect(
        within(linhaPropria).queryByRole("button", { name: "Desativar" }),
      ).not.toBeInTheDocument();
    });

    it("nunca há botão 'Excluir' em nenhuma linha", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(masterAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva, contaDesativada],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      expect(
        screen.queryByRole("button", { name: /excluir/i }),
      ).not.toBeInTheDocument();
    });

    it("nenhum campo de texto livre para digitar um ID em toda a tela", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(masterAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });
      vi.mocked(listarEmpresasMulti).mockResolvedValue({
        itens: [
          { id: "empresa-a", codigo: "A", nome: "Empresa A", status: "ativo" },
        ],
        pagina: 1,
        tamanhoPagina: 100,
        total: 1,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.click(screen.getByRole("button", { name: "Alterar papel" }));
      await screen.findByRole("heading", { name: /Alterar papel/ });

      // Nenhum <input type="text"> em lugar nenhum (e-mail/senha são
      // e-mail/senha do FORMULÁRIO DE CRIAÇÃO, não campos de id).
      const inputsTexto = document.querySelectorAll('input[type="text"]');
      expect(inputsTexto.length).toBe(0);
    });
  });

  describe("sessão expirada (401)", () => {
    it("401 ao identificar o ator: chama onSessaoAtualEncerrada, nunca mostra 'Sem permissão'", async () => {
      const onSessaoAtualEncerrada = vi.fn();
      vi.mocked(obterUsuarioAtual).mockRejectedValue(
        new ApiError(401, "Não autorizado."),
      );

      render(
        <ContasAcessoScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />,
      );

      await waitFor(() =>
        expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
      );
      expect(screen.queryByText("Sem permissão")).not.toBeInTheDocument();
      expect(listarUsuarios).not.toHaveBeenCalled();
    });

    it("401 ao carregar a lista: chama onSessaoAtualEncerrada", async () => {
      const onSessaoAtualEncerrada = vi.fn();
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockRejectedValue(
        new ApiError(401, "Não autorizado."),
      );

      render(
        <ContasAcessoScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />,
      );

      await waitFor(() =>
        expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
      );
    });
  });

  describe("segredo, storage e acessibilidade", () => {
    it("nunca grava em localStorage/sessionStorage ao longo do fluxo completo", async () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });
      vi.mocked(alterarPapel).mockResolvedValue(contaAtiva);
      vi.mocked(desativarConta).mockResolvedValue(undefined);

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      fireEvent.click(screen.getByRole("button", { name: "Alterar papel" }));
      await screen.findByRole("heading", { name: /Alterar papel/ });
      fireEvent.click(screen.getByRole("button", { name: "Salvar papel" }));
      await waitFor(() => expect(alterarPapel).toHaveBeenCalled());

      expect(localStorageSpy).not.toHaveBeenCalled();
    });

    it("nenhum texto renderizado contém segredo técnico (hash/token/cookie)", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      vi.mocked(listarUsuarios).mockResolvedValue({
        items: [contaAtiva],
        nextCursor: null,
      });

      render(<ContasAcessoScreen />);
      await screen.findByText("pessoa1@example.test");

      const texto = document.body.innerHTML.toLowerCase();
      for (const termo of [
        "passwordhash",
        "csrftoken",
        "cookie",
        "sessionid",
      ]) {
        expect(texto).not.toContain(termo);
      }
    });

    it("campos do formulário de criação têm rótulo associado (acessível)", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");
      fireEvent.click(screen.getByRole("button", { name: "Nova conta" }));

      expect(await screen.findByLabelText(/^E-mail/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Senha inicial/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Papel da nova conta/)).toBeInTheDocument();
    });

    it("aviso de MFA como limite de operação está sempre visível", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);

      expect(
        await screen.findByText(/MFA é pré-requisito/i),
      ).toBeInTheDocument();
    });

    it("nunca declara conformidade legal", async () => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(rhAtor);
      mockListaVazia();

      render(<ContasAcessoScreen />);
      await screen.findByText("Nenhuma conta encontrada");

      const texto = document.body.innerHTML.toLowerCase();
      for (const termo of ["lgpd", "conformidade", "compliance", "legal"]) {
        expect(texto).not.toContain(termo);
      }
    });
  });
});
