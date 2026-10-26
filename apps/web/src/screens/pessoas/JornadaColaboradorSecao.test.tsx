import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { JornadaColaboradorSecao } from "./JornadaColaboradorSecao";
import {
  atribuirJornada,
  encerrarVinculoHorario,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import type { VinculoHorarioApi } from "../../api/vinculoHorarioClient";
import { listarTabelasHorario } from "../../api/horariosClient";
import type { TabelaHorarioApi } from "../../api/horariosClient";

vi.mock("../../api/vinculoHorarioClient");
vi.mock("../../api/horariosClient");

const mockListar = listarVinculosHorario as Mock;
const mockAtribuir = atribuirJornada as Mock;
const mockEncerrar = encerrarVinculoHorario as Mock;
const mockJornadas = listarTabelasHorario as Mock;

const COLAB = "c0000000-0000-4000-8000-000000000001";
const HOJE = "2026-05-10";

function jornada(
  id: string,
  codigo: string,
  nome: string,
  ativo = true,
): TabelaHorarioApi {
  return {
    id,
    empresaId: "e",
    codigo,
    nome,
    ativo,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    periodos: [],
  };
}

const J1 = jornada("j1", "COM_44H", "Comercial 44h (teste)");
const J2 = jornada("j2", "MEIO_P", "Meio período (teste)");

function vinculo(
  id: string,
  j: TabelaHorarioApi,
  vigenciaInicio: string,
  vigenciaFim: string | null,
  ativo = j.ativo,
): VinculoHorarioApi {
  return {
    id,
    colaboradorId: COLAB,
    empresaId: "e",
    tabelaHorarioId: j.id,
    tabela: { id: j.id, codigo: j.codigo, nome: j.nome, ativo },
    vigenciaInicio,
    vigenciaFim,
    criadoPorUserId: "u",
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
  };
}

function paginado<T>(itens: T[]) {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

/** Controles de escrita da seção. */
function botoesDeEscrita() {
  return screen
    .queryAllByRole("button")
    .filter((b) =>
      /^(Atribuir|Trocar|Encerrar) jornada/.test(b.textContent?.trim() ?? ""),
    );
}

function montar(podeOperar: boolean) {
  const onAlterado = vi.fn();
  render(
    <JornadaColaboradorSecao
      colaboradorId={COLAB}
      podeOperar={podeOperar}
      hoje={HOJE}
      onAlteradoChange={onAlterado}
    />,
  );
  return { onAlterado };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockListar.mockResolvedValue(
    paginado([
      vinculo("v2", J1, "2026-03-01", null),
      vinculo("v1", J2, "2026-01-01", "2026-03-01", false),
    ]),
  );
  mockJornadas.mockResolvedValue(paginado([J1, J2]));
});

describe("JornadaColaboradorSecao (T183) — consulta", () => {
  it("mostra a jornada atual e o histórico, com a jornada inativada indicada e o último dia", async () => {
    montar(false);
    expect(
      await screen.findByText(
        /COM_44H — Comercial 44h \(teste\) — desde 01\/03\/2026/,
      ),
    ).toBeInTheDocument();
    const tabela = screen.getByRole("table", { name: "Histórico de jornadas" });
    const linhas = within(tabela).getAllByRole("row");
    expect(linhas).toHaveLength(3);
    expect(within(linhas[2]!).getByText("Jornada inativa")).toBeInTheDocument();
    expect(within(linhas[2]!).getByText("28/02/2026")).toBeInTheDocument();
    expect(within(linhas[1]!).getByText("Sem término")).toBeInTheDocument();
    expect(within(linhas[1]!).getByText("Vigente")).toBeInTheDocument();
    expect(within(linhas[2]!).getByText("Encerrada")).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledWith({
      colaboradorId: COLAB,
      tamanhoPagina: 100,
    });
  });

  it("quem só consulta não vê nenhum controle de escrita e não lê o catálogo", async () => {
    montar(false);
    await screen.findByRole("table", { name: "Histórico de jornadas" });
    expect(screen.getByText(/Somente consulta/)).toBeInTheDocument();
    expect(botoesDeEscrita()).toEqual([]);
    expect(mockJornadas).not.toHaveBeenCalled();
  });

  it("sem nenhuma vigência: estado vazio claro", async () => {
    mockListar.mockResolvedValue(paginado([]));
    montar(false);
    expect(
      await screen.findByText("Nenhuma jornada atribuída a este colaborador."),
    ).toBeInTheDocument();
    expect(screen.getByText("Sem jornada vigente hoje.")).toBeInTheDocument();
  });

  it("troca programada: a atual segue a de hoje e a próxima aparece como programada", async () => {
    mockListar.mockResolvedValue(
      paginado([
        vinculo("v2", J2, "2026-06-01", null),
        vinculo("v1", J1, "2026-01-01", "2026-06-01"),
      ]),
    );
    montar(false);
    expect(
      await screen.findByText(
        /COM_44H — Comercial 44h \(teste\) — desde 01\/01\/2026, até 31\/05\/2026/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /MEIO_P — Meio período \(teste\) — a partir de 01\/06\/2026/,
      ),
    ).toBeInTheDocument();
  });

  it("erro ao carregar oferece tentar de novo", async () => {
    mockListar
      .mockRejectedValueOnce(new Error("falha"))
      .mockResolvedValue(paginado([]));
    montar(false);
    fireEvent.click(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    );
    expect(
      await screen.findByText("Nenhuma jornada atribuída a este colaborador."),
    ).toBeInTheDocument();
  });
});

describe("JornadaColaboradorSecao (T183) — RH", () => {
  it("troca a jornada: só jornadas ativas e diferentes da atual; envia colaborador, jornada e início", async () => {
    mockAtribuir.mockResolvedValue(vinculo("v3", J2, "2026-06-01", null));
    montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Trocar jornada" }),
    );
    const seletor = screen.getByLabelText(/^Nova jornada/);
    const opcoes = within(seletor as HTMLElement)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opcoes).toEqual(["Selecione", "MEIO_P — Meio período (teste)"]);
    fireEvent.change(seletor, { target: { value: "j2" } });
    fireEvent.change(screen.getByLabelText(/^Primeiro dia/), {
      target: { value: "2026-06-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trocar jornada" }));
    await waitFor(() =>
      expect(mockAtribuir).toHaveBeenCalledWith({
        colaboradorId: COLAB,
        tabelaHorarioId: "j2",
        vigenciaInicio: "2026-06-01",
      }),
    );
    expect(
      await screen.findByText(/Jornada trocada a partir de 01\/06\/2026/),
    ).toBeInTheDocument();
    expect(mockListar).toHaveBeenCalledTimes(2);
  });

  it("valida antes de enviar: jornada e início obrigatórios, e início depois da atual", async () => {
    montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Trocar jornada" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trocar jornada" }));
    expect(await screen.findByText("Escolha a jornada.")).toBeInTheDocument();
    expect(
      screen.getByText("Informe o primeiro dia da jornada."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Nova jornada/), {
      target: { value: "j2" },
    });
    fireEvent.change(screen.getByLabelText(/^Primeiro dia/), {
      target: { value: "2026-03-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Trocar jornada" }));
    expect(
      await screen.findByText(
        /precisa começar depois do início da jornada atual/,
      ),
    ).toBeInTheDocument();
    expect(mockAtribuir).not.toHaveBeenCalled();
  });

  it.each([
    [
      409,
      [{ campo: "vigenciaInicio", motivo: "sobreposta" }],
      /cruza outra vigência/,
    ],
    [
      422,
      [{ campo: "tabelaHorarioId", motivo: "indisponivel" }],
      /não está disponível/,
    ],
  ])(
    "recusa %s por campo vai ao campo, com o digitado mantido",
    async (status, erros, texto) => {
      mockAtribuir.mockRejectedValue({ status, erros });
      montar(true);
      fireEvent.click(
        await screen.findByRole("button", { name: "Trocar jornada" }),
      );
      fireEvent.change(screen.getByLabelText(/^Nova jornada/), {
        target: { value: "j2" },
      });
      fireEvent.change(screen.getByLabelText(/^Primeiro dia/), {
        target: { value: "2026-06-01" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Trocar jornada" }));
      expect(await screen.findByText(texto)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Primeiro dia/)).toHaveValue("2026-06-01");
      expect(screen.getByLabelText(/^Nova jornada/)).toHaveValue("j2");
    },
  );

  it.each([
    [{ status: 403 }, /não tem permissão/],
    [{ status: 404 }, /não encontrados na empresa ativa/],
    [
      new TypeError("rede"),
      /Não foi possível confirmar se a alteração foi salva/,
    ],
    [{ status: 401 }, /sessão expirou/],
  ])(
    "recusa sem campo: mensagem geral, sem perder o digitado",
    async (erro, texto) => {
      mockAtribuir.mockRejectedValue(erro);
      montar(true);
      fireEvent.click(
        await screen.findByRole("button", { name: "Trocar jornada" }),
      );
      fireEvent.change(screen.getByLabelText(/^Nova jornada/), {
        target: { value: "j2" },
      });
      fireEvent.change(screen.getByLabelText(/^Primeiro dia/), {
        target: { value: "2026-06-01" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Trocar jornada" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(texto);
      expect(screen.getByLabelText(/^Primeiro dia/)).toHaveValue("2026-06-01");
    },
  );

  it("encerra pelo último dia: envia o dia seguinte como fim", async () => {
    mockEncerrar.mockResolvedValue(
      vinculo("v2", J1, "2026-03-01", "2026-08-01"),
    );
    montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Encerrar jornada" }),
    );
    fireEvent.change(screen.getByLabelText(/^Último dia com a jornada/), {
      target: { value: "2026-07-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar jornada" }));
    await waitFor(() =>
      expect(mockEncerrar).toHaveBeenCalledWith("v2", {
        vigenciaFim: "2026-08-01",
      }),
    );
    expect(
      await screen.findByText(/O último dia nela é 31\/07\/2026/),
    ).toBeInTheDocument();
  });

  it("encerrar antes do início é recusado antes de enviar", async () => {
    montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Encerrar jornada" }),
    );
    fireEvent.change(screen.getByLabelText(/^Último dia com a jornada/), {
      target: { value: "2026-02-15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar jornada" }));
    expect(
      await screen.findByText(/não pode ser antes do primeiro dia/),
    ).toBeInTheDocument();
    expect(mockEncerrar).not.toHaveBeenCalled();
  });

  it("sem jornada vigente, oferece atribuir; o formulário preenchido avisa o modal", async () => {
    mockListar.mockResolvedValue(paginado([]));
    mockAtribuir.mockResolvedValue(vinculo("v9", J1, "2026-05-10", null));
    const { onAlterado } = montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Atribuir jornada" }),
    );
    expect(screen.queryByRole("button", { name: "Trocar jornada" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: /^Jornada/ }), {
      target: { value: "j1" },
    });
    expect(onAlterado).toHaveBeenLastCalledWith(true);
    fireEvent.change(screen.getByLabelText(/^Primeiro dia/), {
      target: { value: "2026-05-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Atribuir jornada" }));
    expect(
      await screen.findByText(/Jornada atribuída a partir de 10\/05\/2026/),
    ).toBeInTheDocument();
    expect(onAlterado).toHaveBeenLastCalledWith(false);
  });

  it("sem jornada ativa para escolher, explica onde cadastrar", async () => {
    mockJornadas.mockResolvedValue(paginado([]));
    mockListar.mockResolvedValue(paginado([]));
    montar(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Atribuir jornada" }),
    );
    expect(
      screen.getByText(/Nenhuma jornada ativa disponível/),
    ).toBeInTheDocument();
  });
});
