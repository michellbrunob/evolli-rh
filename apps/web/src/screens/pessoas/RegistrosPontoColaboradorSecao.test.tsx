/**
 * T202 — aba Registros de ponto da ficha do colaborador. O que se prova aqui é
 * a seção: só consulta; só a pessoa, a empresa da sessão e a competência da
 * rota; todos os vínculos dela na empresa (principal primeiro, encerrados
 * inclusive); todas as páginas de cada vínculo; dia civil em São Paulo;
 * ajustada e anulada; nenhum cálculo nem escrita; `master_tecnico` sem
 * empresa sem consulta; carga, vazio, falha, nova tentativa, atraso, foco e
 * anúncios. A rota, o histórico e os perfis no shell estão em
 * `App.ficha.test.tsx`.
 */
import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  obterUsuarioAtual,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import {
  ApiError,
  type EventoPontoApi,
  listarPontosDoVinculo,
} from "../../api/pontoClient";
import type { VinculoApi } from "../../api/colaboradoresClient";
import {
  RegistrosPontoColaboradorSecao,
  TAMANHO_PAGINA_PONTO,
  agruparPorDia,
  rotuloDaCompetencia,
} from "./RegistrosPontoColaboradorSecao";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});

vi.mock("../../api/pontoClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/pontoClient")>(
    "../../api/pontoClient",
  );
  return {
    ...actual,
    listarPontosDoVinculo: vi.fn(),
    listarPontos: vi.fn(),
    buscarPonto: vi.fn(),
    registrarPonto: vi.fn(),
    registrarAjustePonto: vi.fn(),
  };
});

const EMPRESA = "44444444-4444-4444-4444-444444444444";
const OUTRA_EMPRESA = "66666666-6666-4666-8666-666666666666";
const ANA = "11111111-1111-4111-8111-111111111111";
const NOME = "Ana Sintética (teste)";
const NOV = "2026-11";

function ator(parcial: Partial<SafeAccessUserApi> = {}): SafeAccessUserApi {
  return {
    id: "ator-sintetico",
    email: "pessoa.teste@example.test",
    role: "rh",
    companyId: EMPRESA,
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...parcial,
  };
}

function vinculo(parcial: Partial<VinculoApi> = {}): VinculoApi {
  return {
    id: "v-principal",
    colaboradorId: ANA,
    empresaId: EMPRESA,
    matricula: "MAT-0001",
    tipo: "clt",
    situacao: "ativo",
    dataAdmissao: "2025-01-10",
    dataDesligamento: null,
    criadoEm: "2025-01-10T12:00:00.000Z",
    atualizadoEm: "2025-01-10T12:00:00.000Z",
    ...parcial,
  };
}

const PRINCIPAL = vinculo();
const ENCERRADO = vinculo({
  id: "v-encerrado",
  matricula: "MAT-0002",
  tipo: "estagio",
  situacao: "encerrado",
  dataAdmissao: "2024-01-10",
  dataDesligamento: "2024-12-31",
});
const DE_OUTRA_EMPRESA = vinculo({
  id: "v-outra",
  empresaId: OUTRA_EMPRESA,
  matricula: "MAT-9999",
});

let contador = 0;
function marcacao(parcial: Partial<EventoPontoApi> = {}): EventoPontoApi {
  contador += 1;
  const momento = parcial.momento ?? "2026-11-03T11:00:00.000Z";
  return {
    id: `e-${contador}`,
    vinculoId: PRINCIPAL.id,
    empresaId: EMPRESA,
    tipo: "entrada",
    momento,
    competencia: NOV,
    registradoPorUserId: "u-1",
    registradoEm: momento,
    efetivo: {
      tipo: parcial.tipo ?? "entrada",
      momento,
      anulado: false,
      totalAjustes: 0,
    },
    ...parcial,
  };
}

function pagina(itens: EventoPontoApi[], total = itens.length, numero = 1) {
  return { itens, pagina: numero, tamanhoPagina: TAMANHO_PAGINA_PONTO, total };
}

function adiada<T>() {
  let resolver!: (v: T) => void;
  let recusar!: (e: unknown) => void;
  const promessa = new Promise<T>((ok, falha) => {
    resolver = ok;
    recusar = falha;
  });
  return { promessa, resolver, recusar };
}

type Pagina = ReturnType<typeof pagina>;

beforeEach(() => {
  vi.clearAllMocks();
  contador = 0;
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ator());
  vi.mocked(listarPontosDoVinculo).mockResolvedValue(pagina([]));
});

function Secao(
  props: Partial<Parameters<typeof RegistrosPontoColaboradorSecao>[0]> = {},
) {
  return (
    <RegistrosPontoColaboradorSecao
      colaboradorId={ANA}
      nomeColaborador={NOME}
      vinculos={[ENCERRADO, PRINCIPAL, DE_OUTRA_EMPRESA]}
      vinculoPrincipalId={PRINCIPAL.id}
      competencia={NOV}
      onTrocarCompetencia={() => {}}
      {...props}
    />
  );
}

const bloco = (titulo: RegExp) => screen.findByRole("region", { name: titulo });
const ESCRITA =
  /registrar|ajustar|anular|corrigir|salvar|excluir|editar|enviar/i;
const CALCULO =
  /total|saldo|horas trabalhadas|banco de horas|hora extra|jornada esperada|esperad/i;

describe("T202 — vínculos, pessoa, empresa e competência", () => {
  it("todos os vínculos da pessoa na empresa ativa, o principal primeiro, encerrado incluso; nada da outra empresa", async () => {
    render(<Secao />);
    await bloco(/MAT-0001/);
    const titulos = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(titulos).toEqual([
      "CLT · MAT-0001 · vínculo principal",
      "Estágio · MAT-0002",
    ]);
    expect(
      within(await bloco(/MAT-0002/)).getByText("Encerrado"),
    ).toBeInTheDocument();
    // Uma consulta por vínculo da empresa, na competência da rota, 100 por
    // página. O vínculo de outra empresa nunca é consultado.
    expect(vi.mocked(listarPontosDoVinculo).mock.calls).toEqual([
      [PRINCIPAL.id, { competencia: NOV, pagina: 1, tamanhoPagina: 100 }],
      [ENCERRADO.id, { competencia: NOV, pagina: 1, tamanhoPagina: 100 }],
    ]);
  });

  it("descarta, além do servidor, marcação de outro vínculo, outra empresa ou outra competência", async () => {
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id) =>
      id === PRINCIPAL.id
        ? pagina([
            marcacao({ momento: "2026-11-03T11:00:00.000Z" }),
            marcacao({ vinculoId: "v-intruso" }),
            marcacao({ empresaId: OUTRA_EMPRESA }),
            marcacao({ competencia: "2026-10" }),
          ])
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/MAT-0001/);
    expect(within(principal).getAllByRole("listitem")).toHaveLength(1);
  });

  it("sem vínculo na empresa ativa: diz isso e não consulta", async () => {
    render(<Secao vinculos={[DE_OUTRA_EMPRESA]} vinculoPrincipalId={null} />);
    expect(
      await screen.findByText(
        `${NOME} não tem vínculo nesta empresa: não há registros de ponto a consultar.`,
      ),
    ).toBeInTheDocument();
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
  });

  it("master_tecnico sem empresa ativa: orienta a escolher a empresa e não consulta ponto", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator({ role: "master_tecnico", companyId: null }),
    );
    const { container } = render(<Secao />);
    expect(
      await screen.findByText(
        `Escolha uma empresa ativa para consultar os registros de ponto de ${NOME}.`,
      ),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
  });

  it.each(["rh", "dp", "master_tecnico"])(
    "%s com empresa ativa lê, sem nenhum controle de escrita",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: papel }));
      vi.mocked(listarPontosDoVinculo).mockResolvedValue(pagina([marcacao()]));
      const { container } = render(<Secao />);
      await bloco(/MAT-0001/);
      expect(
        within(container)
          .getAllByRole("button")
          .map((b) => b.textContent),
      ).toEqual(["Mês anterior", "Próximo mês"]);
      for (const botao of within(container).getAllByRole("button")) {
        expect(botao.textContent ?? "").not.toMatch(ESCRITA);
      }
      expect(container.querySelector("form")).toBeNull();
      expect(container.querySelector('input[type="file"]')).toBeNull();
    },
  );
});

describe("T202 — marcações: dia em São Paulo, ordem efetiva, ajustada e anulada", () => {
  it("agrupa pelo dia civil de São Paulo (não o UTC) e ordena pelo horário efetivo", () => {
    const dias = agruparPorDia([
      // 03/11 01:30 UTC = 02/11 22:30 em São Paulo.
      marcacao({ id: "tarde", momento: "2026-11-03T01:30:00.000Z" }),
      marcacao({ id: "manha", momento: "2026-11-02T11:00:00.000Z" }),
      marcacao({ id: "dia3", momento: "2026-11-03T12:00:00.000Z" }),
    ]);
    expect(dias.map((d) => d.dia)).toEqual(["02/11/2026", "03/11/2026"]);
    expect(dias[0]!.marcacoes.map((m) => [m.evento.id, m.hora])).toEqual([
      ["manha", "08:00"],
      ["tarde", "22:30"],
    ]);
  });

  it("a ordem é a do horário efetivo (o ajuste move a marcação)", () => {
    const ajustada = marcacao({
      id: "ajustada",
      momento: "2026-11-02T10:00:00.000Z",
      efetivo: {
        tipo: "entrada",
        momento: "2026-11-02T15:00:00.000Z",
        anulado: false,
        totalAjustes: 1,
      },
    });
    const meio = marcacao({ id: "meio", momento: "2026-11-02T13:00:00.000Z" });
    expect(
      agruparPorDia([ajustada, meio])[0]!.marcacoes.map((m) => m.evento.id),
    ).toEqual(["meio", "ajustada"]);
  });

  it("mostra ajustada (com o registro original) e anulada (marcada, não some)", async () => {
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id) =>
      id === PRINCIPAL.id
        ? pagina([
            marcacao({
              momento: "2026-11-03T11:10:00.000Z",
              tipo: "entrada",
              efetivo: {
                tipo: "entrada",
                momento: "2026-11-03T11:00:00.000Z",
                anulado: false,
                totalAjustes: 1,
              },
            }),
            marcacao({
              momento: "2026-11-03T20:00:00.000Z",
              tipo: "saida",
              efetivo: {
                tipo: "saida",
                momento: "2026-11-03T20:00:00.000Z",
                anulado: true,
                totalAjustes: 1,
              },
            }),
          ])
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/MAT-0001/);
    expect(
      within(principal).getByRole("heading", { level: 4 }),
    ).toHaveTextContent("03/11/2026");
    const [primeira, segunda] = within(principal).getAllByRole("listitem");
    expect(primeira).toHaveTextContent("08:00");
    expect(primeira).toHaveTextContent("Entrada");
    expect(primeira).toHaveTextContent("Ajustada");
    expect(primeira).toHaveTextContent("Registro original: 08:10 · Entrada");
    expect(segunda).toHaveTextContent("17:00");
    expect(segunda).toHaveTextContent("Saída");
    expect(segunda).toHaveTextContent("Anulada");
    expect(segunda).not.toHaveTextContent("Ajustada");
  });

  it("nenhum cálculo: sem total, saldo, horas trabalhadas ou comparação com a jornada", async () => {
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id) =>
      id === PRINCIPAL.id
        ? pagina([
            marcacao({ momento: "2026-11-03T11:00:00.000Z", tipo: "entrada" }),
            marcacao({ momento: "2026-11-03T20:00:00.000Z", tipo: "saida" }),
          ])
        : pagina([]),
    );
    const { container } = render(<Secao />);
    await bloco(/MAT-0001/);
    // O aviso fixo diz o que NÃO há; fora dele, nenhum número derivado.
    const aviso = screen.getByText(/Mostra as marcações registradas/);
    const semAviso = (container.textContent ?? "").replace(
      aviso.textContent ?? "",
      "",
    );
    expect(semAviso).not.toMatch(CALCULO);
    expect(semAviso).not.toMatch(/\b9h|09:00 trabalhad|\d+ marca/i);
  });
});

describe("T202 — todas as páginas do mês", () => {
  it("mês com mais de 100 marcações: lê todas as páginas pelo total e mostra todas", async () => {
    const todas = Array.from({ length: 130 }, (_, i) =>
      marcacao({
        id: `m-${String(i).padStart(3, "0")}`,
        momento: new Date(
          Date.UTC(2026, 10, 1 + (i % 30), 11, Math.floor(i / 30)),
        ).toISOString(),
      }),
    );
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id, q) =>
      id === PRINCIPAL.id
        ? q?.pagina === 2
          ? pagina(todas.slice(100), 130, 2)
          : pagina(todas.slice(0, 100), 130, 1)
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/MAT-0001/);
    expect(within(principal).getAllByRole("listitem")).toHaveLength(130);
    expect(
      vi
        .mocked(listarPontosDoVinculo)
        .mock.calls.filter(([id]) => id === PRINCIPAL.id)
        .map(([, q]) => q?.pagina),
    ).toEqual([1, 2]);
  });

  it("marcação repetida entre páginas aparece uma vez", async () => {
    const repetida = marcacao({ id: "rep" });
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id, q) =>
      id === PRINCIPAL.id
        ? q?.pagina === 2
          ? pagina([repetida], 101, 2)
          : pagina(
              [
                repetida,
                ...Array.from({ length: 99 }, (_, i) =>
                  marcacao({ id: `x-${i}` }),
                ),
              ],
              101,
              1,
            )
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/MAT-0001/);
    expect(within(principal).getAllByRole("listitem")).toHaveLength(100);
  });

  it("falha numa página seguinte vira falha do mês: nada cortado na tela", async () => {
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id, q) => {
      if (id !== PRINCIPAL.id) return pagina([]);
      if (q?.pagina === 2) throw new ApiError(500, "x");
      return pagina([marcacao()], 150, 1);
    });
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os registros de ponto de novembro de 2026.",
    );
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});

describe("T202 — estados, foco e anúncios", () => {
  it("um só nó de status da sessão às marcações; anuncia carga e resultado uma vez cada", async () => {
    const sessao = adiada<SafeAccessUserApi>();
    vi.mocked(obterUsuarioAtual).mockReturnValue(sessao.promessa);
    const leitura = adiada<Pagina>();
    vi.mocked(listarPontosDoVinculo)
      .mockReturnValueOnce(leitura.promessa)
      .mockResolvedValue(pagina([]));
    render(<Secao />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Carregando registros de ponto de novembro de 2026…",
    );
    await act(async () => {
      sessao.resolver(ator());
    });
    await waitFor(() => expect(listarPontosDoVinculo).toHaveBeenCalled());
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(
      "Carregando registros de ponto de novembro de 2026…",
    );
    await act(async () => {
      leitura.resolver(pagina([marcacao()]));
    });
    await waitFor(() =>
      expect(status).toHaveTextContent(
        "Registros de ponto de novembro de 2026 carregados.",
      ),
    );
    expect(screen.getByRole("status")).toBe(status);
  });

  it("vazio: anuncia e mostra 'nenhuma marcação' por vínculo", async () => {
    render(<Secao />);
    const principal = await bloco(/MAT-0001/);
    expect(
      within(principal).getByText(
        "Nenhuma marcação neste vínculo em novembro de 2026.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Nenhuma marcação em novembro de 2026.",
    );
  });

  it("falha: alerta; nova tentativa mantém o foco no botão; sucesso leva o foco ao título", async () => {
    vi.mocked(listarPontosDoVinculo).mockRejectedValueOnce(
      new ApiError(500, "x"),
    );
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os registros de ponto de novembro de 2026.",
    );
    const botao = screen.getByRole("button", { name: "Tentar de novo" });
    botao.focus();
    const leitura = adiada<Pagina>();
    vi.mocked(listarPontosDoVinculo)
      .mockReturnValueOnce(leitura.promessa)
      .mockResolvedValue(pagina([]));
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveFocus();
    await act(async () => {
      leitura.resolver(pagina([marcacao()]));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Registros de ponto" }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("falha ao conferir o acesso: alerta e nova tentativa, sem consultar ponto antes", async () => {
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("rede"));
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conferir o seu acesso aos registros de ponto.",
    );
    expect(listarPontosDoVinculo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await bloco(/MAT-0001/)).toBeInTheDocument();
  });
});

describe("T202 — troca de mês", () => {
  it("mês anterior e próximo pedem a competência vizinha; o foco fica no botão usado", async () => {
    const trocar = vi.fn();
    const { rerender } = render(<Secao onTrocarCompetencia={trocar} />);
    await bloco(/MAT-0001/);
    const anterior = screen.getByRole("button", { name: "Mês anterior" });
    anterior.focus();
    fireEvent.click(anterior);
    expect(trocar).toHaveBeenLastCalledWith("2026-10");
    // O shell troca a rota e a competência volta por prop.
    rerender(<Secao onTrocarCompetencia={trocar} competencia="2026-10" />);
    await waitFor(() =>
      expect(screen.getByText("outubro de 2026")).toBeInTheDocument(),
    );
    await bloco(/MAT-0001/);
    expect(anterior).toHaveFocus();
    expect(listarPontosDoVinculo).toHaveBeenLastCalledWith(ENCERRADO.id, {
      competencia: "2026-10",
      pagina: 1,
      tamanhoPagina: 100,
    });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(trocar).toHaveBeenLastCalledWith("2026-11");
  });

  it("virada de ano nos dois sentidos", async () => {
    const trocar = vi.fn();
    render(<Secao onTrocarCompetencia={trocar} competencia="2026-01" />);
    await bloco(/MAT-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(trocar).toHaveBeenLastCalledWith("2025-12");
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(trocar).toHaveBeenLastCalledWith("2026-02");
  });

  it("campo de mês: só um mês válido vira pedido; inválido ou vazio não", async () => {
    const trocar = vi.fn();
    render(<Secao onTrocarCompetencia={trocar} />);
    await bloco(/MAT-0001/);
    const campo = screen.getByLabelText("Mês");
    expect(campo).toHaveValue(NOV);
    fireEvent.change(campo, { target: { value: "" } });
    expect(trocar).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "2026-03" } });
    expect(trocar).toHaveBeenLastCalledWith("2026-03");
    // Ao sair do campo sem rota nova, ele volta ao mês da rota.
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue(NOV);
  });

  it("resposta atrasada do mês anterior não substitui o mês atual", async () => {
    const novembro = adiada<Pagina>();
    vi.mocked(listarPontosDoVinculo).mockImplementation(async (id, q) => {
      if (q?.competencia === NOV && id === PRINCIPAL.id)
        return novembro.promessa;
      if (q?.competencia === "2026-10" && id === PRINCIPAL.id) {
        return pagina([
          marcacao({
            competencia: "2026-10",
            momento: "2026-10-05T11:00:00.000Z",
          }),
        ]);
      }
      return pagina([]);
    });
    const { rerender } = render(<Secao />);
    await waitFor(() => expect(listarPontosDoVinculo).toHaveBeenCalled());
    rerender(<Secao competencia="2026-10" />);
    const principal = await bloco(/MAT-0001/);
    await waitFor(() =>
      expect(within(principal).getAllByRole("listitem")).toHaveLength(1),
    );
    await act(async () => {
      novembro.resolver(pagina([marcacao(), marcacao()]));
    });
    expect(screen.getByText("outubro de 2026")).toBeInTheDocument();
    const depois = await bloco(/MAT-0001/);
    expect(within(depois).getAllByRole("listitem")).toHaveLength(1);
    expect(depois).toHaveTextContent("05/10/2026");
  });

  it("desmontada antes da resposta (troca de empresa remonta a árvore): nada é desenhado depois", async () => {
    const pendente = adiada<Pagina>();
    vi.mocked(listarPontosDoVinculo).mockReturnValue(pendente.promessa);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount, container } = render(<Secao />);
    await waitFor(() => expect(listarPontosDoVinculo).toHaveBeenCalled());
    unmount();
    await act(async () => {
      pendente.resolver(pagina([marcacao()]));
    });
    expect(container.textContent).toBe("");
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });
});

describe("T202 — utilidades e largura", () => {
  it("rótulo da competência", () => {
    expect(rotuloDaCompetencia("2026-11")).toBe("novembro de 2026");
    expect(rotuloDaCompetencia("2027-01")).toBe("janeiro de 2027");
  });

  it("375 px: controles do mês quebram linha, campo com 44 px, listas sem tabela", async () => {
    const css = readFileSync(
      "src/screens/pessoas/RegistrosPontoColaboradorSecao.css",
      "utf8",
    );
    const corpo = (seletor: string) => {
      const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = new RegExp(
        String.raw`(?:^|\})\s*${escapado}\s*\{([^}]*)\}`,
        "m",
      ).exec(css);
      return m ? (m[1] ?? "") : null;
    };
    expect(corpo(".registros-ponto__mes")).toMatch(/flex-wrap:\s*wrap/);
    expect(corpo(".registros-ponto__campo input")).toMatch(
      /min-height:\s*var\(--touch-target\)/,
    );
    expect(corpo(".registros-ponto__marcacao")).toMatch(/flex-wrap:\s*wrap/);
    vi.mocked(listarPontosDoVinculo).mockResolvedValue(pagina([marcacao()]));
    const { container } = render(<Secao />);
    await bloco(/MAT-0001/);
    expect(container.querySelector("table")).toBeNull();
  });
});
