import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PessoasHorarioScreen } from "./PessoasHorarioScreen";
import {
  type ColaboradorApi,
  type ListagemColaboradoresApi,
  listarColaboradores,
} from "../../api/colaboradoresClient";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../api/horariosClient";
import {
  type VinculoHorarioApi,
  criarVinculoHorario,
  encerrarVinculoHorario,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { expectSemIsoVisivel } from "../../test/semIsoVisivel";

vi.mock("../../api/colaboradoresClient");
vi.mock("../../api/horariosClient");
vi.mock("../../api/vinculoHorarioClient");

interface ResultadoPaginadoTeste<T> {
  itens: T[];
  pagina: number;
  tamanhoPagina: number;
  total: number;
}

function paginado<T>(itens: T[]): ResultadoPaginadoTeste<T> {
  return { itens, pagina: 1, tamanhoPagina: 100, total: itens.length };
}

/**
 * T178 — `GET /v1/colaboradores` passou a trazer os vínculos de cada item e os
 * `contadores` do escopo. Esta tela não usa nenhum dos dois; o envelope só
 * precisa ter a forma do contrato.
 */
function listagem(itens: ColaboradorApi[]): ListagemColaboradoresApi {
  return {
    ...paginado(itens.map((c) => ({ ...c, vinculos: [] }))),
    contadores: { ativos: 0, inativos: 0 },
  };
}

/**
 * T188 — o servidor filtra por `situacao` (a tela conta e busca só ativos);
 * o dublê faz o mesmo, em vez de devolver a lista inteira a qualquer pedido.
 */
function responderColaboradores(lista: ColaboradorApi[]) {
  vi.mocked(listarColaboradores).mockImplementation(async (q = {}) =>
    listagem(
      q.situacao ? lista.filter((c) => c.situacao === q.situacao) : lista,
    ),
  );
}

/** T188 — escolhe o colaborador na busca paginada do formulário. */
async function escolherColaborador(nome: string) {
  const lista = await screen.findByRole("list", {
    name: "Colaboradores encontrados",
  });
  fireEvent.click(within(lista).getByRole("button", { name: nome }));
}

const colaborador1: ColaboradorApi = {
  id: "11111111-1111-1111-1111-111111111111",
  nome: "Ana Colaboradora (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const colaborador2: ColaboradorApi = {
  id: "22222222-2222-2222-2222-222222222222",
  nome: "Bruno Colaborador (teste)",
  situacao: "ativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const colaboradorInativo: ColaboradorApi = {
  id: "33333333-3333-3333-3333-333333333333",
  nome: "Carla Inativa (teste)",
  situacao: "inativo",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
};

const tabelaAtiva: TabelaHorarioApi = {
  id: "44444444-4444-4444-4444-444444444444",
  empresaId: "77777777-7777-7777-7777-777777777777",
  codigo: null,
  nome: "Tabela Comercial (teste)",
  ativo: true,
  criadoPorUserId: "88888888-8888-8888-8888-888888888888",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
  periodos: [],
};

const tabelaInativa: TabelaHorarioApi = {
  id: "55555555-5555-5555-5555-555555555555",
  empresaId: "77777777-7777-7777-7777-777777777777",
  codigo: null,
  nome: "Tabela Descontinuada (teste)",
  ativo: false,
  criadoPorUserId: "88888888-8888-8888-8888-888888888888",
  criadoEm: "2025-01-01T12:00:00.000Z",
  atualizadoEm: "2025-01-01T12:00:00.000Z",
  periodos: [],
};

const vinculoVigente: VinculoHorarioApi = {
  id: "66666666-6666-6666-6666-666666666666",
  colaboradorId: colaborador1.id,
  // T191 — o colaborador vem no próprio vínculo (id e nome).
  colaborador: { id: colaborador1.id, nome: colaborador1.nome },
  empresaId: tabelaAtiva.empresaId,
  tabelaHorarioId: tabelaAtiva.id,
  tabela: {
    id: tabelaAtiva.id,
    codigo: tabelaAtiva.codigo,
    nome: tabelaAtiva.nome,
    ativo: tabelaAtiva.ativo,
  },
  vigenciaInicio: "2025-01-10",
  vigenciaFim: null,
  criadoPorUserId: "88888888-8888-8888-8888-888888888888",
  criadoEm: "2025-01-10T12:00:00.000Z",
  atualizadoEm: "2025-01-10T12:00:00.000Z",
};

const vinculoEncerrado: VinculoHorarioApi = {
  id: "99999999-9999-9999-9999-999999999999",
  colaboradorId: colaboradorInativo.id,
  colaborador: { id: colaboradorInativo.id, nome: colaboradorInativo.nome },
  empresaId: tabelaAtiva.empresaId,
  tabelaHorarioId: tabelaAtiva.id,
  tabela: {
    id: tabelaAtiva.id,
    codigo: tabelaAtiva.codigo,
    nome: tabelaAtiva.nome,
    ativo: tabelaAtiva.ativo,
  },
  // Forma REAL do fio: `vigenciaInicio`/`vigenciaFim` são `@db.Date`, e o
  // Prisma as entrega como `Date` — chegam ao navegador em ISO completo.
  // A fixture antiga usava "2024-01-01" puro e por isso não pegava o ISO cru
  // vazando para a coluna "Vigência".
  vigenciaInicio: "2024-01-01T00:00:00.000Z",
  vigenciaFim: "2024-12-31T00:00:00.000Z",
  criadoPorUserId: "88888888-8888-8888-8888-888888888888",
  criadoEm: "2024-01-01T12:00:00.000Z",
  atualizadoEm: "2024-12-31T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarVinculosHorario).mockResolvedValue(
    paginado([vinculoVigente, vinculoEncerrado]),
  );
  responderColaboradores([colaborador1, colaborador2, colaboradorInativo]);
  vi.mocked(listarTabelasHorario).mockResolvedValue(
    paginado([tabelaAtiva, tabelaInativa]),
  );
  vi.mocked(criarVinculoHorario).mockResolvedValue(vinculoVigente);
  vi.mocked(encerrarVinculoHorario).mockResolvedValue(vinculoVigente);
});

describe("PessoasHorarioScreen (T112 — funcional)", () => {
  it("tem um único h1 e exibe o aviso Somente RH", async () => {
    render(<PessoasHorarioScreen podeOperar />);

    expect(
      screen.getAllByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toHaveLength(1);
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

    await waitFor(() => expect(listarVinculosHorario).toHaveBeenCalled());
  });

  it("lista vínculos reais com nome do colaborador, tabela, vigência e situação", async () => {
    render(<PessoasHorarioScreen podeOperar />);

    const tabela = await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    const dentro = within(tabela);
    expect(dentro.getByText("Ana Colaboradora (teste)")).toBeInTheDocument();
    expect(dentro.getByText("Carla Inativa (teste)")).toBeInTheDocument();
    expect(dentro.getAllByText("Tabela Comercial (teste)").length).toBe(2);
    expect(dentro.getByText("10/01/2025 – vigente")).toBeInTheDocument();
    expect(dentro.getByText("01/01/2024 – 31/12/2024")).toBeInTheDocument();
    expect(dentro.getByText("Vigente")).toBeInTheDocument();
    expect(dentro.getByText("Encerrada")).toBeInTheDocument();

    // Guarda da T154: varre o texto visível inteiro da tela, não só a tabela.
    // O `value` de campo de formulário fica fora do alcance por ser atributo —
    // ali o ISO é contrato com o `<input type="date">`, não apresentação.
    expectSemIsoVisivel(document.body);
  });

  it("mostra o estado de carregamento antes dos dados chegarem", async () => {
    let resolver: (v: ResultadoPaginadoTeste<VinculoHorarioApi>) => void;
    vi.mocked(listarVinculosHorario).mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve;
      }) as ReturnType<typeof listarVinculosHorario>,
    );

    render(<PessoasHorarioScreen podeOperar />);

    expect(
      screen.getByText("Carregando vínculos de horário…"),
    ).toBeInTheDocument();

    resolver!(paginado([vinculoVigente]));
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    vi.mocked(listarVinculosHorario).mockRejectedValueOnce(new Error("falha"));

    render(<PessoasHorarioScreen podeOperar />);

    await screen.findByRole("heading", {
      name: "Não foi possível carregar os vínculos de horário",
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
  });

  it("mostra EmptyState quando não há vínculos", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(paginado([]));

    render(<PessoasHorarioScreen podeOperar />);

    expect(
      await screen.findByRole("heading", {
        name: "Nenhum vínculo de horário cadastrado",
      }),
    ).toBeInTheDocument();
  });

  it("abre o formulário: múltiplos colaboradores ativos exigem seleção explícita; tabela única fica oculta/resolvida", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    expect(
      screen.getByRole("form", {
        name: "Formulário de novo vínculo de horário",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Colaborador\b/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Tabela de horário/i),
    ).not.toBeInTheDocument();
  });

  it("valida vigência de início obrigatória", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    await escolherColaborador(colaborador1.nome);
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    expect(
      await screen.findByText("Informe o início da vigência."),
    ).toBeInTheDocument();
    expect(criarVinculoHorario).not.toHaveBeenCalled();
  });

  it("valida que o fim da vigência deve ser posterior ao início", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    await escolherColaborador(colaborador1.nome);
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByLabelText(/Vigência — fim/i), {
      target: { value: "2026-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    expect(
      await screen.findByText(
        "O fim da vigência deve ser posterior ao início.",
      ),
    ).toBeInTheDocument();
    expect(criarVinculoHorario).not.toHaveBeenCalled();
  });

  it("cria vínculo com sucesso (tabela única resolvida automaticamente) e recarrega a lista", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    const chamadasAntes = vi.mocked(listarVinculosHorario).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));
    await escolherColaborador(colaborador2.nome);
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    await waitFor(() =>
      expect(criarVinculoHorario).toHaveBeenCalledWith({
        colaboradorId: colaborador2.id,
        tabelaHorarioId: tabelaAtiva.id,
        vigenciaInicio: "2026-01-05",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("form", {
          name: "Formulário de novo vínculo de horário",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(vi.mocked(listarVinculosHorario).mock.calls.length).toBe(
      chamadasAntes + 1,
    );
  });

  it("mostra mensagem amigável de sobreposição em erro 409", async () => {
    vi.mocked(criarVinculoHorario).mockRejectedValueOnce(
      Object.assign(new Error("Conflict"), { status: 409 }),
    );

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));
    await escolherColaborador(colaborador1.nome);
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    expect(
      await screen.findByText(/já possui uma tabela de horário vigente/i),
    ).toBeInTheDocument();
  });

  it("bloqueia a criação quando não há colaborador ativo disponível", async () => {
    responderColaboradores([colaboradorInativo]);

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    expect(
      screen.getByText(/Nenhum colaborador ativo disponível para vincular/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo vínculo" })).toBeDisabled();
  });

  it("bloqueia a criação quando não há tabela de horário ativa disponível", async () => {
    vi.mocked(listarTabelasHorario).mockResolvedValue(
      paginado([tabelaInativa]),
    );

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    expect(
      screen.getByText(
        /Nenhuma tabela de horário ativa disponível para vincular/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo vínculo" })).toBeDisabled();
  });

  it("exige seleção explícita quando há múltiplas tabelas de horário ativas", async () => {
    const tabelaAtiva2: TabelaHorarioApi = {
      ...tabelaAtiva,
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      nome: "Tabela Administrativo (teste)",
    };
    vi.mocked(listarTabelasHorario).mockResolvedValue(
      paginado([tabelaAtiva, tabelaAtiva2]),
    );

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    expect(screen.getByLabelText(/^Tabela de horário/i)).toBeInTheDocument();

    await escolherColaborador(colaborador1.nome);
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    expect(
      await screen.findByText("Selecione a tabela de horário."),
    ).toBeInTheDocument();
    expect(criarVinculoHorario).not.toHaveBeenCalled();
  });

  it("resolve automaticamente o colaborador quando há só um ativo", async () => {
    responderColaboradores([colaborador1]);

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    expect(screen.queryByLabelText(/^Colaborador\b/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));

    await waitFor(() =>
      expect(criarVinculoHorario).toHaveBeenCalledWith(
        expect.objectContaining({ colaboradorId: colaborador1.id }),
      ),
    );
  });

  it("abre o detalhe e mostra colaborador, tabela e vigência, sem campos editáveis além do encerramento", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    expect(
      screen.getByRole("heading", { name: "Ana Colaboradora (teste)" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tabela de horário:/)).toHaveTextContent(
      "Tabela Comercial (teste)",
    );
    // Vigência é DATA CIVIL: o painel não pode mais vazar o ISO cru.
    expect(screen.getByText(/Tabela de horário:/)).toHaveTextContent(
      "Vigência: 10/01/2025 – vigente",
    );
    expect(screen.queryByLabelText(/^Colaborador\b/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/^Tabela de horário/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Encerrar vigência em")).toBeInTheDocument();
  });

  it("encerra a vigência com sucesso e atualiza lista e detalhe", async () => {
    const encerrado: VinculoHorarioApi = {
      ...vinculoVigente,
      vigenciaFim: "2026-02-01",
    };
    vi.mocked(encerrarVinculoHorario).mockResolvedValueOnce(encerrado);

    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    fireEvent.change(screen.getByLabelText("Encerrar vigência em"), {
      target: { value: "2026-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar vigência" }));

    await waitFor(() =>
      expect(encerrarVinculoHorario).toHaveBeenCalledWith(vinculoVigente.id, {
        vigenciaFim: "2026-02-01",
      }),
    );
    const painelDetalhe = screen
      .getByRole("heading", { name: "Ana Colaboradora (teste)" })
      .closest("section")!;
    expect(
      await within(painelDetalhe).findByText("Encerrada"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Encerrar vigência em"),
    ).not.toBeInTheDocument();
  });

  it("valida a data de encerramento obrigatória e posterior ao início", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Encerrar vigência" }));
    expect(
      await screen.findByText("Informe a data de encerramento."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Encerrar vigência em"), {
      target: { value: "2025-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar vigência" }));
    expect(
      await screen.findByText(
        "A data de encerramento deve ser posterior ao início da vigência.",
      ),
    ).toBeInTheDocument();
    expect(encerrarVinculoHorario).not.toHaveBeenCalled();
  });

  it("não mostra formulário de encerramento para vínculo já encerrado", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });

    const linha = screen.getByText("Carla Inativa (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    expect(
      screen.queryByLabelText("Encerrar vigência em"),
    ).not.toBeInTheDocument();
  });

  it("fecha o painel de detalhe", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(
      screen.queryByRole("heading", { name: "Ana Colaboradora (teste)" }),
    ).not.toBeInTheDocument();
  });

  it("abrir o formulário fecha um detalhe que estava aberto", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    expect(
      screen.queryByRole("heading", { name: "Ana Colaboradora (teste)" }),
    ).not.toBeInTheDocument();
  });

  it("não referencia cálculo de jornada, Banco de Horas, DSR, AFD, Folha, CPF, senha ou sessão", async () => {
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "senha",
      "sessão",
      "banco de horas",
      "dsr",
      "afd",
      "fechamento",
      "espelho",
      "folha",
      "tolerância",
      "hora extra",
      "localstorage",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("PessoasHorarioScreen — perfil leitor, como o DP (T183)", () => {
  it("diz 'Somente consulta', lista as vigências e não oferece vincular nem encerrar", async () => {
    render(<PessoasHorarioScreen />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    expect(screen.getByText("Somente consulta")).toBeInTheDocument();
    expect(screen.queryByText("Somente RH")).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo vínculo" })).toBeNull();

    const linha = screen.getByText("Ana Colaboradora (teste)").closest("tr")!;
    fireEvent.click(
      within(linha).getByRole("button", { name: /Ver detalhes/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Ana Colaboradora (teste)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Encerrar vigência/ }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Encerrar vigência em/)).toBeNull();
  });
});

/**
 * T188 — dublê de `GET /v1/colaboradores` com 150 pessoas: pagina, busca por
 * nome ou matrícula e filtra por situação, como o servidor (T178).
 */
function servidorComCentoECinquenta() {
  const lista = Array.from({ length: 150 }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      id: `c-${n}`,
      nome: `Pessoa Teste ${n}`,
      situacao: "ativo" as const,
      criadoEm: "2026-01-01T12:00:00.000Z",
      atualizadoEm: "2026-01-01T12:00:00.000Z",
      vinculos: [
        {
          id: `vf-${n}`,
          empresaId: "e-1",
          matricula: `MAT-${n}`,
          situacao: "ativo" as const,
          dataAdmissao: "2025-01-01",
          dataDesligamento: null,
          lotacaoVigente: null,
          vigenciasDeJornada: [],
        },
      ],
    };
  });
  vi.mocked(listarColaboradores).mockImplementation((async (
    q: {
      busca?: string;
      pagina?: number;
      tamanhoPagina?: number;
      situacao?: string;
    } = {},
  ) => {
    const termo = (q.busca ?? "").toLowerCase();
    const filtrada = lista.filter(
      (c) =>
        (!q.situacao || c.situacao === q.situacao) &&
        (!termo ||
          c.nome.toLowerCase().includes(termo) ||
          c.vinculos[0]!.matricula.toLowerCase().includes(termo)),
    );
    const pagina = q.pagina ?? 1;
    const tamanho = q.tamanhoPagina ?? 20;
    return {
      itens: filtrada.slice((pagina - 1) * tamanho, pagina * tamanho),
      pagina,
      tamanhoPagina: tamanho,
      total: filtrada.length,
      contadores: { ativos: filtrada.length, inativos: 0 },
    };
  }) as never);
}

async function buscarEEscolher(termo: string, nome: RegExp) {
  const campo = await screen.findByLabelText(
    "Colaborador (buscar por nome ou matrícula)",
  );
  fireEvent.change(campo, { target: { value: termo } });
  fireEvent.keyDown(campo, { key: "Enter" });
  const botao = await screen.findByRole("button", { name: nome });
  fireEvent.click(botao);
}

describe("T188 — Horário de trabalho sem o teto de 100", () => {
  it("vincula jornada à 140ª pessoa ativa, escolhida pela busca", async () => {
    servidorComCentoECinquenta();
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    fireEvent.click(screen.getByRole("button", { name: "Novo vínculo" }));
    await buscarEEscolher("Pessoa Teste 140", /^Pessoa Teste 140/);
    fireEvent.change(screen.getByLabelText(/Vigência — início/i), {
      target: { value: "2026-01-05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar vínculo" }));
    await waitFor(() =>
      expect(criarVinculoHorario).toHaveBeenCalledWith(
        expect.objectContaining({ colaboradorId: "c-140" }),
      ),
    );
    // A busca do formulário pede só ativos ao servidor.
    expect(listarColaboradores).toHaveBeenCalledWith(
      expect.objectContaining({ situacao: "ativo", busca: "Pessoa Teste 140" }),
    );
  });

  it("a contagem de ativos vem do servidor, não de uma página de 100", async () => {
    servidorComCentoECinquenta();
    render(<PessoasHorarioScreen podeOperar />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    expect(listarColaboradores).toHaveBeenCalledWith({
      situacao: "ativo",
      tamanhoPagina: 1,
    });
    expect(screen.getByRole("button", { name: "Novo vínculo" })).toBeEnabled();
  });

  it("perfil só de consulta: sem formulário e sem busca de colaborador", async () => {
    servidorComCentoECinquenta();
    render(<PessoasHorarioScreen />);
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    expect(screen.queryByRole("button", { name: "Novo vínculo" })).toBeNull();
    expect(
      screen.queryByLabelText("Colaborador (buscar por nome ou matrícula)"),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T191 — a tabela de vínculos deixa a página única de 100 e os dicionários de
// 100: nome e jornada vêm do próprio vínculo, de 20 em 20, com filtros por
// colaborador e por jornada.
// ---------------------------------------------------------------------------

describe("T191 — vínculos de horário paginados, com nome do próprio vínculo", () => {
  function pagina(
    itens: VinculoHorarioApi[],
    total: number,
    paginaAtual = 1,
  ): ResultadoPaginadoTeste<VinculoHorarioApi> {
    return { itens, pagina: paginaAtual, tamanhoPagina: 20, total };
  }

  function ultimaConsulta() {
    return vi.mocked(listarVinculosHorario).mock.lastCall![0];
  }

  async function montarComTabela(podeOperar = true) {
    render(<PessoasHorarioScreen podeOperar={podeOperar} />);
    return screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
  }

  it("pede a primeira página de 20 e não lê mais o dicionário de 100 colaboradores", async () => {
    await montarComTabela();
    expect(listarVinculosHorario).toHaveBeenCalledWith({
      pagina: 1,
      tamanhoPagina: 20,
    });
    // Só a contagem de ativos (T188); nada de página de 100.
    for (const [consulta] of vi.mocked(listarColaboradores).mock.calls) {
      expect(consulta?.tamanhoPagina).not.toBe(100);
    }
  });

  it("nome e jornada vêm do próprio vínculo — mesmo fora de qualquer lista carregada", async () => {
    const deFora: VinculoHorarioApi = {
      ...vinculoVigente,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      colaboradorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      colaborador: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        nome: "Zz Pessoa Depois do Centésimo (teste)",
      },
      tabelaHorarioId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      tabela: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        codigo: "NOTURNA",
        nome: "Jornada Fora do Catálogo (teste)",
        ativo: true,
      },
    };
    vi.mocked(listarVinculosHorario).mockResolvedValue(pagina([deFora], 1));
    const tabela = await montarComTabela();
    expect(
      within(tabela).getByText("Zz Pessoa Depois do Centésimo (teste)"),
    ).toBeInTheDocument();
    expect(
      within(tabela).getByText("Jornada Fora do Catálogo (teste)"),
    ).toBeInTheDocument();
  });

  it("sem o nome na resposta, um rótulo neutro — nunca o identificador técnico", async () => {
    const semNome = { ...vinculoVigente } as VinculoHorarioApi;
    delete (semNome as { colaborador?: unknown }).colaborador;
    vi.mocked(listarVinculosHorario).mockResolvedValue(pagina([semNome], 1));
    const tabela = await montarComTabela();
    expect(
      within(tabela).getByText("Colaborador não identificado"),
    ).toBeInTheDocument();
    expect(tabela.textContent).not.toContain(semNome.colaboradorId.slice(0, 8));
  });

  it("paginação de 20 em 20, com o total do filtro atual", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      pagina([vinculoVigente, vinculoEncerrado], 45),
    );
    await montarComTabela();
    expect(screen.getByText("45 vínculos no filtro atual")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({ pagina: 2, tamanhoPagina: 20 }),
    );
  });

  it("filtro por jornada: inclui as inativas, volta à página 1 e se mantém ao paginar", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      pagina([vinculoVigente], 45),
    );
    await montarComTabela();
    const seletor = screen.getByLabelText("Jornada") as HTMLSelectElement;
    expect([...seletor.options].map((o) => o.textContent)).toEqual([
      "Todas as jornadas",
      "Tabela Comercial (teste)",
      "Tabela Descontinuada (teste) (inativa)",
    ]);
    fireEvent.change(seletor, { target: { value: tabelaInativa.id } });
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        tabelaHorarioId: tabelaInativa.id,
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 2,
        tamanhoPagina: 20,
        tabelaHorarioId: tabelaInativa.id,
      }),
    );
  });

  it("filtro por colaborador: abre sob pedido, combina com a jornada e sai sozinho", async () => {
    await montarComTabela();
    expect(
      screen.queryByRole("list", { name: "Colaboradores encontrados" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Filtrar por colaborador" }),
    );
    const lista = await screen.findByRole("list", {
      name: "Colaboradores encontrados",
    });
    fireEvent.click(
      within(lista).getByRole("button", { name: colaborador2.nome }),
    );
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        colaboradorId: colaborador2.id,
      }),
    );
    fireEvent.change(screen.getByLabelText("Jornada"), {
      target: { value: tabelaAtiva.id },
    });
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        colaboradorId: colaborador2.id,
        tabelaHorarioId: tabelaAtiva.id,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Remover filtro de colaborador: ${colaborador2.nome}`,
      }),
    );
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({
        pagina: 1,
        tamanhoPagina: 20,
        tabelaHorarioId: tabelaAtiva.id,
      }),
    );
  });

  it("vazio com filtros: mensagem própria e “Limpar filtros” volta a tudo", async () => {
    await montarComTabela();
    vi.mocked(listarVinculosHorario).mockResolvedValue(pagina([], 0));
    fireEvent.change(screen.getByLabelText("Jornada"), {
      target: { value: tabelaInativa.id },
    });
    expect(
      await screen.findByText("Nenhum vínculo com estes filtros"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() =>
      expect(ultimaConsulta()).toEqual({ pagina: 1, tamanhoPagina: 20 }),
    );
  });

  it("vazio sem filtros continua dizendo que não há vínculo cadastrado", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(pagina([], 0));
    render(<PessoasHorarioScreen podeOperar />);
    expect(
      await screen.findByText("Nenhum vínculo de horário cadastrado"),
    ).toBeInTheDocument();
  });

  it("perfil leitor (DP): filtra e pagina, sem nenhum controle de escrita", async () => {
    vi.mocked(listarVinculosHorario).mockResolvedValue(
      pagina([vinculoVigente], 45),
    );
    await montarComTabela(false);
    expect(screen.getByLabelText("Jornada")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filtrar por colaborador" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo vínculo" })).toBeNull();
  });

  it("falha ao ler os vínculos: aviso e nova tentativa", async () => {
    vi.mocked(listarVinculosHorario).mockRejectedValueOnce(new Error("rede"));
    render(<PessoasHorarioScreen podeOperar />);
    expect(
      await screen.findByText(
        "Não foi possível carregar os vínculos de horário",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
  });

  it("resposta atrasada de um filtro anterior não sobrescreve a do filtro atual", async () => {
    await montarComTabela();
    let soltarAntiga!: (v: ResultadoPaginadoTeste<VinculoHorarioApi>) => void;
    vi.mocked(listarVinculosHorario)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            soltarAntiga = resolve;
          }),
      )
      .mockResolvedValueOnce(pagina([vinculoEncerrado], 1));
    fireEvent.change(screen.getByLabelText("Jornada"), {
      target: { value: tabelaInativa.id },
    });
    fireEvent.change(screen.getByLabelText("Jornada"), {
      target: { value: tabelaAtiva.id },
    });
    const tabela = await screen.findByRole("table", {
      name: "Colaboradores com tabela de horário vinculada",
    });
    await waitFor(() =>
      expect(
        within(tabela).getByText(colaboradorInativo.nome),
      ).toBeInTheDocument(),
    );
    soltarAntiga(pagina([vinculoVigente], 1));
    await new Promise((r) => setTimeout(r, 0));
    expect(within(tabela).queryByText(colaborador1.nome)).toBeNull();
  });

  it("375 px: filtros empilham e o filtro ativo quebra linha, sem alargar a página", () => {
    const css = readFileSync(
      "src/screens/pessoas/PessoasHorarioScreen.css",
      "utf8",
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\) \{[\s\S]*\.pessoas-horario-screen__filtros \{[^}]*flex-direction: column/,
    );
    const bloco = (seletor: string) =>
      new RegExp(`${seletor.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`).exec(
        css,
      )?.[1] ?? "";
    expect(bloco(".pessoas-horario-screen__filtro-ativo")).toMatch(
      /overflow-wrap: anywhere/,
    );
    expect(bloco(".pessoas-horario-screen__filtros")).toMatch(
      /flex-wrap: wrap/,
    );
    expect(bloco(".pessoas-horario-screen__filtros")).toMatch(/min-width: 0/);
  });
});
