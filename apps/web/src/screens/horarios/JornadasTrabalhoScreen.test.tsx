import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { JornadasTrabalhoScreen } from "./JornadasTrabalhoScreen";
import {
  criarTabelaHorario,
  desativarTabelaHorario,
  editarTabelaHorario,
  listarTabelasHorario,
  reativarTabelaHorario,
} from "../../api/horariosClient";
import type {
  ResultadoPaginado,
  TabelaHorarioApi,
} from "../../api/horariosClient";

vi.mock("../../api/horariosClient");

const mockListar = listarTabelasHorario as Mock;
const mockCriar = criarTabelaHorario as Mock;
const mockEditar = editarTabelaHorario as Mock;
const mockDesativar = desativarTabelaHorario as Mock;
const mockReativar = reativarTabelaHorario as Mock;

const tabela1: TabelaHorarioApi = {
  id: "11111111-1111-1111-1111-111111111111",
  empresaId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  codigo: "COM_44H",
  nome: "Comercial 44h (teste)",
  ativo: true,
  criadoPorUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
  criadoEm: "2026-01-01T00:00:00.000Z",
  atualizadoEm: "2026-01-01T00:00:00.000Z",
  periodos: [
    { dia: "segunda", inicio: "08:00", fim: "12:00" },
    { dia: "segunda", inicio: "13:00", fim: "18:00" },
    { dia: "terca", inicio: "08:00", fim: "12:00" },
  ],
};

/** Gravada antes do código existir (T182): `codigo` nulo. */
const tabela2: TabelaHorarioApi = {
  id: "22222222-2222-2222-2222-222222222222",
  empresaId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  codigo: null,
  nome: "Meio Período (teste)",
  ativo: false,
  criadoPorUserId: "uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu",
  criadoEm: "2026-02-01T00:00:00.000Z",
  atualizadoEm: "2026-02-01T00:00:00.000Z",
  periodos: [{ dia: "segunda", inicio: "09:00", fim: "13:00" }],
};

function paginado<T>(itens: T[]): ResultadoPaginado<T> {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

const LISTA = { name: "Jornadas de trabalho da empresa ativa" };

async function abrirDetalhe(indice: number) {
  const botoes = await screen.findAllByRole("button", {
    name: /Ver detalhes/,
  });
  fireEvent.click(botoes[indice]!);
}

function preencher(rotulo: RegExp | string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), {
    target: { value: valor },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockListar.mockResolvedValue(paginado([tabela1, tabela2]));
  mockCriar.mockResolvedValue({
    ...tabela1,
    id: "33333333-3333-3333-3333-333333333333",
  });
  mockEditar.mockResolvedValue(tabela1);
  mockDesativar.mockResolvedValue({ ...tabela1, ativo: false });
  mockReativar.mockResolvedValue({ ...tabela2, ativo: true });
});

describe("JornadasTrabalhoScreen (T182) — consulta", () => {
  it("tem um único h1 'Jornadas de trabalho'", () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Jornadas de trabalho",
      }),
    ).toHaveLength(1);
  });

  it("lista código, nome, resumo dos dias e situação; sem código aparece como tal", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    expect(screen.getByRole("cell", { name: "COM_44H" })).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Comercial 44h (teste)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Seg, Ter · 3 períodos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("cell", { name: "Sem código" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText("Inativa")).toBeInTheDocument();
  });

  it("pede o maior lote e nunca envia a empresa", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    expect(mockListar).toHaveBeenCalledWith({ tamanhoPagina: 100 });
    for (const [query] of mockListar.mock.calls) {
      expect(query).not.toHaveProperty("empresaId");
    }
  });

  it("busca por nome ou código e limpa a busca", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    mockListar.mockResolvedValue(paginado([tabela1]));
    preencher("Buscar por nome ou código", "  com_44  ");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(mockListar).toHaveBeenLastCalledWith({
        busca: "com_44",
        tamanhoPagina: 100,
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Limpar busca" }),
    );
    await waitFor(() =>
      expect(mockListar).toHaveBeenLastCalledWith({ tamanhoPagina: 100 }),
    );
  });

  it("buscar de novo com o mesmo termo recarrega a lista", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(mockListar).toHaveBeenCalledTimes(2));
  });

  it("filtra por situação", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    preencher("Situação", "inativo");
    await waitFor(() =>
      expect(mockListar).toHaveBeenLastCalledWith({
        ativo: false,
        tamanhoPagina: 100,
      }),
    );
    preencher("Situação", "ativo");
    await waitFor(() =>
      expect(mockListar).toHaveBeenLastCalledWith({
        ativo: true,
        tamanhoPagina: 100,
      }),
    );
  });

  it("estado vazio sem filtro: o RH é convidado a criar", async () => {
    mockListar.mockResolvedValue(paginado([]));
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("heading", {
      level: 3,
      name: "Nenhuma jornada cadastrada",
    });
    expect(
      screen.getAllByRole("button", { name: "Nova jornada" }),
    ).toHaveLength(2);
  });

  it("estado vazio para quem só consulta não oferece criar", async () => {
    mockListar.mockResolvedValue(paginado([]));
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("heading", {
      level: 3,
      name: "Nenhuma jornada cadastrada",
    });
    expect(
      screen.queryByRole("button", { name: "Nova jornada" }),
    ).not.toBeInTheDocument();
  });

  it("busca sem resultado tem estado próprio", async () => {
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("table", LISTA);
    mockListar.mockResolvedValue(paginado([]));
    preencher("Buscar por nome ou código", "nada");
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByRole("heading", {
      level: 3,
      name: "Nenhuma jornada encontrada",
    });
  });

  it("avisa quando há mais jornadas do que as mostradas", async () => {
    mockListar.mockResolvedValue({ ...paginado([tabela1]), total: 140 });
    render(<JornadasTrabalhoScreen />);
    await screen.findByText(/Mostrando 1 de 140 jornadas/);
  });

  it("erro ao carregar oferece tentar de novo", async () => {
    mockListar
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValue(paginado([tabela1]));
    render(<JornadasTrabalhoScreen />);
    await screen.findByRole("heading", {
      name: "Não foi possível carregar as jornadas de trabalho",
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", LISTA);
  });

  it("quem só consulta vê o detalhe, sem nenhuma ação de escrita", async () => {
    render(<JornadasTrabalhoScreen />);
    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    await abrirDetalhe(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "Comercial 44h (teste)" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("table", { name: /Dias e horários — Comercial 44h/ }),
    ).toBeInTheDocument();
    for (const nome of [
      "Nova jornada",
      "Editar nome e código",
      "Nova jornada a partir desta",
      "Inativar",
      "Reativar",
    ]) {
      expect(
        screen.queryByRole("button", { name: nome }),
      ).not.toBeInTheDocument();
    }
  });
});

describe("JornadasTrabalhoScreen (T182) — operação do RH", () => {
  it("valida código e nome antes de enviar, e foca o primeiro erro", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    expect(screen.getByLabelText(/^Código/)).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(await screen.findByText("Informe o código.")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^Código/)).toHaveFocus());
    preencher(/^Código/, "a b");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(
      await screen.findByText(/Use de 2 a 32 letras maiúsculas/),
    ).toBeInTheDocument();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it("código digitado vira maiúsculo", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "turno_a");
    expect(screen.getByLabelText(/^Código/)).toHaveValue("TURNO_A");
  });

  it("valida períodos incompletos e saída antes da entrada", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "TURNO_A");
    preencher(/^Nome/, "Turno A");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar período" }));
    preencher("Dia do período 1", "segunda");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(
      await screen.findByText(/Preencha o dia, a entrada/),
    ).toBeInTheDocument();
    preencher("Entrada do período 1", "12:00");
    preencher("Saída do período 1", "08:00");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(
      await screen.findByText(/a saída deve ser depois da entrada/),
    ).toBeInTheDocument();
    expect(mockCriar).not.toHaveBeenCalled();
  });

  it("cria com código, nome e períodos; mostra o detalhe e recarrega a lista", async () => {
    const nova: TabelaHorarioApi = {
      ...tabela1,
      id: "33333333-3333-3333-3333-333333333333",
      codigo: "TURNO_A",
      nome: "Turno A",
      periodos: [{ dia: "segunda", inicio: "08:00", fim: "12:00" }],
    };
    mockCriar.mockResolvedValue(nova);
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "TURNO_A");
    preencher(/^Nome/, "  Turno A  ");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar período" }));
    preencher("Dia do período 1", "segunda");
    preencher("Entrada do período 1", "08:00");
    preencher("Saída do período 1", "12:00");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    await waitFor(() =>
      expect(mockCriar).toHaveBeenCalledWith({
        codigo: "TURNO_A",
        nome: "Turno A",
        periodos: [{ dia: "segunda", inicio: "08:00", fim: "12:00" }],
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Jornada TURNO_A criada.",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Turno A" }),
    ).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it("código em uso: erro no campo Código, digitado preservado e foco nele", async () => {
    mockCriar.mockRejectedValue({
      status: 409,
      erros: [{ campo: "codigo", motivo: "em_uso" }],
    });
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "COM_44H");
    preencher(/^Nome/, "Outra");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(
      await screen.findByText("Este código já está em uso nesta empresa."),
    ).toBeInTheDocument();
    const codigo = screen.getByLabelText(/^Código/);
    expect(codigo).toHaveValue("COM_44H");
    expect(codigo).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(codigo).toHaveFocus());
    expect(screen.getByLabelText(/^Nome/)).toHaveValue("Outra");
  });

  it.each([
    [403, /não tem permissão/],
    [404, /não encontrada na empresa ativa/],
    [500, /Não foi possível confirmar se a jornada foi salva/],
  ])(
    "recusa %s: mensagem geral, sem perder o digitado",
    async (status, texto) => {
      mockCriar.mockRejectedValue({ status });
      render(<JornadasTrabalhoScreen podeOperar />);
      await screen.findByRole("table", LISTA);
      fireEvent.click(
        screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
      );
      preencher(/^Código/, "TURNO_B");
      preencher(/^Nome/, "Turno B");
      fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(texto);
      expect(screen.getByLabelText(/^Código/)).toHaveValue("TURNO_B");
    },
  );

  it("período recusado (422) aparece junto dos dias e horários", async () => {
    mockCriar.mockRejectedValue({ status: 422 });
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "TURNO_C");
    preencher(/^Nome/, "Turno C");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /períodos sobrepostos ou inválidos/,
    );
  });

  it("edita só nome e código; os períodos aparecem só para leitura", async () => {
    mockEditar.mockResolvedValue({
      ...tabela1,
      codigo: "COM_40H",
      nome: "Comercial 40h",
    });
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome e código" }),
    );
    expect(screen.getByLabelText(/^Código/)).toHaveValue("COM_44H");
    expect(screen.getByLabelText(/^Nome/)).toHaveValue("Comercial 44h (teste)");
    expect(
      screen.queryByRole("button", { name: "Adicionar período" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/use "Nova jornada a partir desta" e inative/),
    ).toBeInTheDocument();
    preencher(/^Código/, "COM_40H");
    preencher(/^Nome/, "Comercial 40h");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(mockEditar).toHaveBeenCalledWith(tabela1.id, {
        codigo: "COM_40H",
        nome: "Comercial 40h",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Jornada COM_40H atualizada.",
    );
  });

  it("jornada sem código: a edição exige um", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(1);
    expect(
      screen.getByText("Sem código", { selector: "dd" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Editar nome e código" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("Informe o código.")).toBeInTheDocument();
    expect(mockEditar).not.toHaveBeenCalled();
  });

  it("nova jornada a partir desta copia os dias e horários, com código e nome vazios", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Nova jornada a partir desta" }),
    );
    expect(
      screen.getByRole("heading", { name: "Nova jornada" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Código/)).toHaveValue("");
    expect(screen.getByLabelText(/^Nome/)).toHaveValue("");
    expect(screen.getByLabelText("Dia do período 3")).toHaveValue("terca");
    expect(screen.getByLabelText("Saída do período 2")).toHaveValue("18:00");
  });

  it("inativa (lógico) e reativa no detalhe", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(0);
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    await waitFor(() => expect(mockDesativar).toHaveBeenCalledWith(tabela1.id));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Jornada COM_44H inativada. Ela continua no histórico.",
    );
    mockReativar.mockResolvedValue({ ...tabela1, ativo: true });
    fireEvent.click(screen.getByRole("button", { name: "Reativar" }));
    await waitFor(() => expect(mockReativar).toHaveBeenCalledWith(tabela1.id));
    expect(
      await screen.findByRole("button", { name: "Inativar" }),
    ).toBeInTheDocument();
  });

  it("falha ao inativar fica no detalhe, sem mudar a situação", async () => {
    mockDesativar.mockRejectedValue({ status: 403 });
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(0);
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não tem permissão/,
    );
    expect(
      screen.getByRole("button", { name: "Inativar" }),
    ).toBeInTheDocument();
  });

  it("abrir o formulário fecha o detalhe, e cancelar fecha o formulário", async () => {
    render(<JornadasTrabalhoScreen podeOperar />);
    await abrirDetalhe(0);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Comercial 44h (teste)",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("heading", { name: "Nova jornada" }),
    ).not.toBeInTheDocument();
  });

  it("envio duplicado é ignorado enquanto salva", async () => {
    let resolver: (v: TabelaHorarioApi) => void = () => {};
    mockCriar.mockImplementation(
      () => new Promise<TabelaHorarioApi>((r) => (resolver = r)),
    );
    render(<JornadasTrabalhoScreen podeOperar />);
    await screen.findByRole("table", LISTA);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Nova jornada" })[0]!,
    );
    preencher(/^Código/, "TURNO_D");
    preencher(/^Nome/, "Turno D");
    fireEvent.click(screen.getByRole("button", { name: "Criar jornada" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvando…" }));
    expect(mockCriar).toHaveBeenCalledTimes(1);
    resolver({ ...tabela1, codigo: "TURNO_D", nome: "Turno D" });
    await screen.findByRole("status");
  });
});
