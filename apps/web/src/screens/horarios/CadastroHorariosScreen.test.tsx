import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { CadastroHorariosScreen } from "./CadastroHorariosScreen";
import {
  criarTabelaHorario,
  desativarTabelaHorario,
  listarTabelasHorario,
  reativarTabelaHorario,
} from "../../api/horariosClient";
import type {
  ResultadoPaginado,
  TabelaHorarioApi,
} from "../../api/horariosClient";

vi.mock("../../api/horariosClient");

const mockListarTabelasHorario = listarTabelasHorario as Mock;
const mockCriarTabelaHorario = criarTabelaHorario as Mock;
const mockDesativarTabelaHorario = desativarTabelaHorario as Mock;
const mockReativarTabelaHorario = reativarTabelaHorario as Mock;

const tabela1: TabelaHorarioApi = {
  id: "11111111-1111-1111-1111-111111111111",
  empresaId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  nome: "Comercial 44h (teste)",
  ativo: true,
  criadoPorUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
  periodos: [
    { dia: "segunda", inicio: "08:00", fim: "12:00" },
    { dia: "segunda", inicio: "13:00", fim: "18:00" },
  ],
};

const tabela2: TabelaHorarioApi = {
  id: "22222222-2222-2222-2222-222222222222",
  empresaId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  nome: "Meio Período (teste)",
  ativo: false,
  criadoPorUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
  criadoEm: "2026-02-01T00:00:00.000Z",
  atualizadoEm: "2026-02-01T00:00:00.000Z",
  periodos: [{ dia: "segunda", inicio: "09:00", fim: "13:00" }],
};

function paginado<T>(itens: T[]): ResultadoPaginado<T> {
  return { itens, pagina: 1, tamanhoPagina: 50, total: itens.length };
}

describe("CadastroHorariosScreen (T110 — funcional)", () => {
  beforeEach(() => {
    mockListarTabelasHorario.mockResolvedValue(paginado([tabela1, tabela2]));
    mockCriarTabelaHorario.mockResolvedValue({
      ...tabela1,
      id: "33333333-3333-3333-3333-333333333333",
    });
    mockDesativarTabelaHorario.mockResolvedValue({ ...tabela1, ativo: false });
    mockReativarTabelaHorario.mockResolvedValue({ ...tabela2, ativo: true });
  });

  it("tem um único h1 com texto 'Horários' e exibe o aviso Somente RH", () => {
    render(<CadastroHorariosScreen />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Horários" }),
    ).toHaveLength(1);
    expect(screen.getByText("Somente RH")).toBeInTheDocument();
  });

  it("exibe a listagem após carregar com sucesso", async () => {
    render(<CadastroHorariosScreen />);

    await screen.findByRole("table", { name: "Tabelas de horário" });
    expect(
      screen.getByRole("cell", { name: "Comercial 44h (teste)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Meio Período (teste)" }),
    ).toBeInTheDocument();
  });

  it("exibe estado de erro com retry quando a API falha", async () => {
    mockListarTabelasHorario.mockRejectedValue(new Error("Falha de rede"));

    render(<CadastroHorariosScreen />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar as tabelas de horário",
    });
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();
  });

  it("retry recarrega as tabelas com sucesso", async () => {
    mockListarTabelasHorario
      .mockRejectedValueOnce(new Error("Falha"))
      .mockResolvedValue(paginado([tabela1]));

    render(<CadastroHorariosScreen />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar as tabelas de horário",
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", { name: "Tabelas de horário" });
  });

  it("exibe EmptyState quando não há tabelas cadastradas", async () => {
    mockListarTabelasHorario.mockResolvedValue(paginado([]));

    render(<CadastroHorariosScreen />);

    await screen.findByRole("heading", {
      level: 3,
      name: "Nenhuma tabela de horário cadastrada",
    });
  });

  it("filtra por 'Ativa' e passa ativo=true para a API", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    mockListarTabelasHorario.mockResolvedValue(paginado([tabela1]));
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "ativo" },
    });

    await screen.findByRole("table", { name: "Tabelas de horário" });
    expect(mockListarTabelasHorario).toHaveBeenCalledWith({ ativo: true });
  });

  it("filtra por 'Inativa' e passa ativo=false para a API", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    mockListarTabelasHorario.mockResolvedValue(paginado([tabela2]));
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativo" },
    });

    await screen.findByRole("table", { name: "Tabelas de horário" });
    expect(mockListarTabelasHorario).toHaveBeenCalledWith({ ativo: false });
  });

  it("abre formulário vazio ao clicar em 'Nova tabela de horário'", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );

    expect(
      screen.getByRole("heading", { name: "Nova tabela de horário" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nome da tabela/i)).toHaveValue("");
  });

  it("fecha formulário ao cancelar", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByRole("heading", { name: "Nova tabela de horário" }),
    ).not.toBeInTheDocument();
  });

  it("valida nome obrigatório ao tentar salvar", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText("Nome é obrigatório.")).toBeInTheDocument();
    expect(mockCriarTabelaHorario).not.toHaveBeenCalled();
  });

  it("valida períodos incompletos (dia preenchido sem entrada/saída)", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.change(screen.getByLabelText(/nome da tabela/i), {
      target: { value: "Tabela Teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar período" }));
    fireEvent.change(screen.getByLabelText("Dia"), {
      target: { value: "segunda" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByText(/Preencha todos os campos/)).toBeInTheDocument();
    expect(mockCriarTabelaHorario).not.toHaveBeenCalled();
  });

  it("cria tabela com sucesso, fecha formulário e recarrega lista", async () => {
    const novaTabela: TabelaHorarioApi = {
      ...tabela1,
      id: "33333333-3333-3333-3333-333333333333",
      nome: "Nova 44h (teste)",
    };
    mockCriarTabelaHorario.mockResolvedValue(novaTabela);
    mockListarTabelasHorario
      .mockResolvedValueOnce(paginado([tabela1, tabela2]))
      .mockResolvedValue(paginado([tabela1, tabela2, novaTabela]));

    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.change(screen.getByLabelText(/nome da tabela/i), {
      target: { value: "Nova 44h (teste)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockCriarTabelaHorario).toHaveBeenCalledWith({
        nome: "Nova 44h (teste)",
        periodos: [],
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Nova tabela de horário" }),
      ).not.toBeInTheDocument();
    });
  });

  it("exibe erro geral da API ao falhar a criação", async () => {
    mockCriarTabelaHorario.mockRejectedValue(
      new Error("Período sobreposto no mesmo dia."),
    );

    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.change(screen.getByLabelText(/nome da tabela/i), {
      target: { value: "Tabela Teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Período sobreposto no mesmo dia.");
  });

  it("permite adicionar e remover linhas de período no formulário", async () => {
    render(<CadastroHorariosScreen />);
    await screen.findByRole("table", { name: "Tabelas de horário" });

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Adicionar período" }));

    expect(screen.getByLabelText("Dia")).toBeInTheDocument();

    const btnRemover = screen.getByRole("button", { name: /Remover/ });
    fireEvent.click(btnRemover);

    expect(screen.queryByLabelText("Dia")).not.toBeInTheDocument();
  });

  it("abre o detalhe ao clicar em 'Ver detalhes' e exibe a tabela de períodos", async () => {
    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);

    expect(
      screen.getByRole("heading", { name: "Comercial 44h (teste)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: /Períodos — Comercial 44h/ }),
    ).toBeInTheDocument();
  });

  it("fecha o detalhe ao clicar em 'Fechar'", async () => {
    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(
      screen.queryByRole("heading", { name: "Comercial 44h (teste)" }),
    ).not.toBeInTheDocument();
  });

  it("desativa uma tabela ativa no painel de detalhe", async () => {
    const desativada: TabelaHorarioApi = { ...tabela1, ativo: false };
    mockDesativarTabelaHorario.mockResolvedValue(desativada);

    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => {
      expect(mockDesativarTabelaHorario).toHaveBeenCalledWith(tabela1.id);
    });
    expect(
      screen.getByRole("button", { name: "Reativar" }),
    ).toBeInTheDocument();
  });

  it("reativa uma tabela inativa no painel de detalhe", async () => {
    const reativada: TabelaHorarioApi = { ...tabela2, ativo: true };
    mockReativarTabelaHorario.mockResolvedValue(reativada);

    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[1]!);

    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));

    await waitFor(() => {
      expect(mockReativarTabelaHorario).toHaveBeenCalledWith(tabela2.id);
    });
    expect(
      screen.getByRole("button", { name: "Desativar" }),
    ).toBeInTheDocument();
  });

  it("exibe erro no painel de detalhe quando a desativação falha", async () => {
    mockDesativarTabelaHorario.mockRejectedValue(
      new Error("Não foi possível desativar."),
    );

    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível desativar.");
  });

  it("abrir formulário fecha o detalhe aberto e vice-versa", async () => {
    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);
    expect(
      screen.getByRole("heading", { name: "Comercial 44h (teste)" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Nova tabela de horário" }),
    );
    expect(
      screen.queryByRole("heading", { name: "Comercial 44h (teste)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Nova tabela de horário" }),
    ).toBeInTheDocument();
  });

  it("detalhe de tabela sem períodos exibe mensagem e não renderiza tabela de períodos", async () => {
    const semPeriodos: TabelaHorarioApi = { ...tabela1, periodos: [] };
    mockListarTabelasHorario.mockResolvedValue(paginado([semPeriodos]));

    render(<CadastroHorariosScreen />);
    const botoes = await screen.findAllByRole("button", {
      name: /Ver detalhes/,
    });
    fireEvent.click(botoes[0]!);

    expect(screen.getByText("Nenhum período definido.")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /Períodos/ }),
    ).not.toBeInTheDocument();
  });
});
