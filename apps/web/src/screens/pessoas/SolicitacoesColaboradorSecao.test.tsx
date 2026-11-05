/**
 * T203 — aba Solicitações da ficha do colaborador. O que se prova aqui é a
 * seção: só consulta; só a pessoa e a empresa da sessão; todos os vínculos
 * dela na empresa (principal primeiro, encerrados inclusive); todas as
 * páginas de cada vínculo; os seis tipos (Atestado como os demais); detalhe e
 * linha do tempo com defesa de escopo; `master_tecnico` sem empresa sem
 * consulta; carga, vazio, falha, nova tentativa, atraso, desmontagem, foco e
 * anúncios. A rota, o DP e os perfis no shell estão em `App.ficha.test.tsx`.
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
  type SolicitacaoPessoaApi,
  type SolicitacaoPessoaEventoApi,
  type TipoSolicitacaoPessoa,
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import type { VinculoApi } from "../../api/colaboradoresClient";
import {
  SolicitacoesColaboradorSecao,
  TAMANHO_PAGINA_SOLICITACOES,
} from "./SolicitacoesColaboradorSecao";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});

vi.mock("../../api/solicitacoesPessoasClient", async () => {
  const actual = await vi.importActual<
    typeof import("../../api/solicitacoesPessoasClient")
  >("../../api/solicitacoesPessoasClient");
  return {
    ...actual,
    listarSolicitacoesPessoas: vi.fn(),
    detalharSolicitacaoPessoa: vi.fn(),
    historicoSolicitacaoPessoa: vi.fn(),
    registrarSolicitacaoPessoa: vi.fn(),
    transicionarSolicitacaoPessoa: vi.fn(),
  };
});

const EMPRESA = "44444444-4444-4444-4444-444444444444";
const OUTRA_EMPRESA = "66666666-6666-4666-8666-666666666666";
const ANA = "11111111-1111-4111-8111-111111111111";
const NOME = "Ana Sintética (teste)";

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
  dataDesligamento: "2024-12-31",
});
const DE_OUTRA_EMPRESA = vinculo({
  id: "v-outra",
  empresaId: OUTRA_EMPRESA,
  matricula: "MAT-9999",
});

let contador = 0;
function solicitacao(
  parcial: Partial<SolicitacaoPessoaApi> = {},
): SolicitacaoPessoaApi {
  contador += 1;
  return {
    id: `s-${contador}`,
    empresaId: EMPRESA,
    vinculoId: PRINCIPAL.id,
    tipo: "ferias",
    motivo: "periodo_ferias",
    situacao: "enviada",
    periodoReferencia: "2026-12-01",
    registradoPorUserId: "u-1",
    enviadaEm: "2026-10-05T12:30:00.000Z",
    primeiraRevisaoEm: null,
    criadoEm: "2026-10-05T12:00:00.000Z",
    atualizadoEm: "2026-10-05T12:30:00.000Z",
    ...parcial,
  };
}

function evento(
  s: SolicitacaoPessoaApi,
  parcial: Partial<SolicitacaoPessoaEventoApi> = {},
): SolicitacaoPessoaEventoApi {
  contador += 1;
  return {
    id: `ev-${contador}`,
    solicitacaoId: s.id,
    empresaId: EMPRESA,
    acao: "criar",
    situacaoDe: null,
    situacaoPara: "rascunho",
    motivo: null,
    registradoPorUserId: "u-1",
    requestId: "r-1",
    ocorridoEm: "2026-10-05T12:00:00.000Z",
    ...parcial,
  };
}

function pagina(
  itens: SolicitacaoPessoaApi[],
  total = itens.length,
  numero = 1,
) {
  return {
    itens,
    pagina: numero,
    tamanhoPagina: TAMANHO_PAGINA_SOLICITACOES,
    total,
  };
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
  vi.mocked(listarSolicitacoesPessoas).mockResolvedValue(pagina([]));
  vi.mocked(historicoSolicitacaoPessoa).mockResolvedValue([]);
});

function Secao(
  props: Partial<Parameters<typeof SolicitacoesColaboradorSecao>[0]> = {},
) {
  return (
    <SolicitacoesColaboradorSecao
      colaboradorId={ANA}
      nomeColaborador={NOME}
      vinculos={[ENCERRADO, PRINCIPAL, DE_OUTRA_EMPRESA]}
      vinculoPrincipalId={PRINCIPAL.id}
      {...props}
    />
  );
}

const bloco = (titulo: RegExp) => screen.findByRole("region", { name: titulo });
const ESCRITA =
  /registrar|enviar|encaminhar|aprovar|recusar|cancelar|reabrir|iniciar revis|retomar|aguardar|editar|salvar|excluir/i;
const ARQUIVO =
  /anexo|cid\b|arquivo|upload|download|baixar|visualizar arquivo/i;

/** Só com a lista principal pronta, e o detalhe vindo do mesmo registro. */
function comDetalheDe(s: SolicitacaoPessoaApi, eventos = [evento(s)]) {
  vi.mocked(detalharSolicitacaoPessoa).mockImplementation(async (id) =>
    id === s.id ? s : Promise.reject(new ApiError(404, "x")),
  );
  vi.mocked(historicoSolicitacaoPessoa).mockImplementation(async (id) =>
    id === s.id ? eventos : [],
  );
}

describe("T203 — vínculos, pessoa e empresa", () => {
  it("todos os vínculos da pessoa na empresa ativa, o principal primeiro, encerrado incluso; nada da outra empresa", async () => {
    render(<Secao />);
    await bloco(/^CLT · MAT-0001/);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["CLT · MAT-0001 · vínculo principal", "Estágio · MAT-0002"]);
    expect(
      within(await bloco(/^Estágio · MAT-0002/)).getByText("Encerrado"),
    ).toBeVisible();
    // Uma consulta por vínculo da empresa, 100 por página; nada da outra.
    expect(vi.mocked(listarSolicitacoesPessoas).mock.calls).toEqual([
      [{ vinculoId: PRINCIPAL.id, pagina: 1, tamanhoPagina: 100 }],
      [{ vinculoId: ENCERRADO.id, pagina: 1, tamanhoPagina: 100 }],
    ]);
  });

  it("descarta, além do servidor, solicitação de outro vínculo ou de outra empresa", async () => {
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id
        ? pagina([
            solicitacao(),
            solicitacao({ vinculoId: "v-intruso" }),
            solicitacao({ empresaId: OUTRA_EMPRESA }),
          ])
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    expect(within(principal).getAllByRole("row")).toHaveLength(2);
  });

  it("os seis tipos, com tipo, situação, motivo, dia de referência e data; Atestado como os demais", async () => {
    const tipos: [TipoSolicitacaoPessoa, string][] = [
      ["contestacao_ajuste_ponto", "Contestação de ajuste de ponto"],
      ["ausencia", "Ausência"],
      ["ferias", "Férias"],
      ["atualizacao_cadastral", "Atualização cadastral"],
      ["atestado", "Atestado"],
      ["beneficios", "Benefícios"],
    ];
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id
        ? pagina(
            tipos.map(([tipo]) =>
              solicitacao({
                tipo,
                motivo:
                  tipo === "atestado"
                    ? "atestado_apresentado"
                    : "outro_controlado",
              }),
            ),
          )
        : pagina([]),
    );
    const { container } = render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const linhas = within(principal).getAllByRole("row").slice(1);
    expect(
      linhas.map((l) => (l as HTMLTableRowElement).cells[0]!.textContent),
    ).toEqual(tipos.map(([, rotulo]) => rotulo));
    const atestado = linhas[4]!;
    expect(atestado).toHaveTextContent("Atestado apresentado");
    expect(atestado).toHaveTextContent("Enviada");
    expect(atestado).toHaveTextContent("01/12/2026");
    expect(container.textContent).not.toMatch(ARQUIVO);
    expect(container.querySelector('input[type="file"], a[href]')).toBeNull();
  });

  it("sem vínculo na empresa ativa: diz isso e não consulta", async () => {
    render(<Secao vinculos={[DE_OUTRA_EMPRESA]} vinculoPrincipalId={null} />);
    expect(
      await screen.findByText(
        `${NOME} não tem vínculo nesta empresa: não há solicitações a consultar.`,
      ),
    ).toBeInTheDocument();
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
  });

  it("master_tecnico sem empresa ativa: orienta a escolher a empresa e não chama nenhuma leitura de solicitações", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator({ role: "master_tecnico", companyId: null }),
    );
    const { container } = render(<Secao />);
    expect(
      await screen.findByText(
        `Escolha uma empresa ativa para consultar as solicitações de ${NOME}.`,
      ),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
    expect(detalharSolicitacaoPessoa).not.toHaveBeenCalled();
    expect(historicoSolicitacaoPessoa).not.toHaveBeenCalled();
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
  });

  it.each(["rh", "master_tecnico"])(
    "%s com empresa ativa lê, e o único controle é 'Ver detalhe'; nenhuma escrita",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: papel }));
      vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
        q?.vinculoId === PRINCIPAL.id
          ? pagina([solicitacao({ situacao: "em_revisao_rh" })])
          : pagina([]),
      );
      const { container } = render(<Secao />);
      await bloco(/^CLT · MAT-0001/);
      for (const botao of within(container).getAllByRole("button")) {
        expect(botao.textContent).toMatch(/^Ver detalhe/);
        expect(botao.textContent ?? "").not.toMatch(ESCRITA);
      }
      expect(
        container.querySelector("form, select, textarea, input"),
      ).toBeNull();
      expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
      expect(transicionarSolicitacaoPessoa).not.toHaveBeenCalled();
    },
  );
});

describe("T203 — todas as páginas", () => {
  it("mais de 100 solicitações num vínculo: lê todas as páginas pelo total, sem repetir", async () => {
    const todas = Array.from({ length: 130 }, () => solicitacao());
    const repetida = todas[99]!;
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id
        ? q.pagina === 2
          ? pagina([repetida, ...todas.slice(100)], 130, 2)
          : pagina(todas.slice(0, 100), 130, 1)
        : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    expect(within(principal).getAllByRole("row")).toHaveLength(131);
    expect(
      vi
        .mocked(listarSolicitacoesPessoas)
        .mock.calls.filter(([q]) => q?.vinculoId === PRINCIPAL.id)
        .map(([q]) => q?.pagina),
    ).toEqual([1, 2]);
  });

  it("falha numa página seguinte vira falha da lista: nada cortado na tela", async () => {
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) => {
      if (q?.vinculoId !== PRINCIPAL.id) return pagina([]);
      if (q.pagina === 2) throw new ApiError(500, "x");
      return pagina([solicitacao()], 150, 1);
    });
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as solicitações.",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("T203 — detalhe e linha do tempo", () => {
  it("'Ver detalhe' lê detalhe e linha do tempo, foca o título do painel; 'Fechar detalhe' devolve o foco ao botão", async () => {
    const s = solicitacao({ situacao: "recusada" });
    comDetalheDe(s, [
      evento(s, {
        acao: "enviar",
        situacaoDe: "rascunho",
        situacaoPara: "enviada",
        ocorridoEm: "2026-10-05T12:30:00.000Z",
      }),
      evento(s),
      evento(s, {
        acao: "recusar",
        situacaoDe: "em_revisao_rh",
        situacaoPara: "recusada",
        motivo: "duplicidade",
        ocorridoEm: "2026-10-07T15:00:00.000Z",
      }),
      // Defesa: evento de outra solicitação ou de outra empresa não entra.
      evento(s, { solicitacaoId: "s-outra" }),
      evento(s, { empresaId: OUTRA_EMPRESA }),
    ]);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const ver = within(principal).getByRole("button", {
      name: /^Ver detalhe da solicitação de Férias, registrada em /,
    });
    ver.focus();
    fireEvent.click(ver);
    const titulo = await screen.findByRole("heading", {
      level: 4,
      name: "Detalhe da solicitação de Férias",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(ver).toHaveAttribute("aria-expanded", "true");
    expect(detalharSolicitacaoPessoa).toHaveBeenCalledWith(s.id);
    expect(historicoSolicitacaoPessoa).toHaveBeenCalledWith(s.id);
    const painel = screen.getByRole("region", {
      name: "Detalhe da solicitação de Férias",
    });
    expect(painel).toHaveTextContent("Recusada");
    expect(painel).toHaveTextContent("Período de férias");
    const eventos = within(painel)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(eventos).toHaveLength(3);
    expect(eventos[0]).toMatch(/Registrada — Rascunho$/);
    expect(eventos[1]).toMatch(/Enviar — Rascunho → Enviada$/);
    expect(eventos[2]).toMatch(
      /Recusar — Em revisão pelo RH → Recusada · Motivo: Duplicidade$/,
    );
    // Só leitura: no painel, o único botão é "Fechar detalhe".
    expect(
      within(painel)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Fechar detalhe"]);
    fireEvent.click(
      within(painel).getByRole("button", { name: "Fechar detalhe" }),
    );
    expect(
      screen.queryByRole("region", { name: /Detalhe da solicitação/ }),
    ).toBeNull();
    expect(ver).toHaveFocus();
    expect(ver).toHaveAttribute("aria-expanded", "false");
  });

  it("detalhe fora do escopo (404) ou de outra empresa: 'não disponível', sem dados", async () => {
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    vi.mocked(detalharSolicitacaoPessoa).mockResolvedValueOnce({
      ...s,
      empresaId: OUTRA_EMPRESA,
    });
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta solicitação não está disponível na empresa ativa.",
    );
    expect(screen.queryByText("Linha do tempo")).toBeNull();

    vi.mocked(detalharSolicitacaoPessoa).mockRejectedValueOnce(
      new ApiError(404, "x"),
    );
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "não está disponível",
      ),
    );
  });

  it("falha do detalhe: alerta e nova tentativa; sucesso foca o título do painel", async () => {
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    vi.mocked(detalharSolicitacaoPessoa).mockRejectedValueOnce(
      new ApiError(500, "x"),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o detalhe da solicitação.",
    );
    comDetalheDe(s);
    const tentar = screen.getByRole("button", { name: "Tentar de novo" });
    tentar.focus();
    fireEvent.click(tentar);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 4,
          name: /Detalhe da solicitação/,
        }),
      ).toHaveFocus(),
    );
    expect(document.activeElement).not.toBe(document.body);
  });

  it("detalhe atrasado de outra solicitação não substitui o painel aberto", async () => {
    const primeira = solicitacao({ tipo: "ferias" });
    const segunda = solicitacao({
      tipo: "ausencia",
      motivo: "ausencia_programada",
    });
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([primeira, segunda]) : pagina([]),
    );
    const lenta = adiada<SolicitacaoPessoaApi>();
    vi.mocked(detalharSolicitacaoPessoa).mockImplementation(async (id) =>
      id === primeira.id ? lenta.promessa : segunda,
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const [verPrimeira, verSegunda] = within(principal).getAllByRole("button");
    fireEvent.click(verPrimeira!);
    fireEvent.click(verSegunda!);
    await screen.findByRole("heading", {
      level: 4,
      name: "Detalhe da solicitação de Ausência",
    });
    await act(async () => {
      lenta.resolver(primeira);
    });
    expect(
      screen.getByRole("heading", { level: 4, name: /Detalhe da solicitação/ }),
    ).toHaveTextContent("Ausência");
    expect(screen.getByRole("region", { name: /Detalhe/ })).toHaveTextContent(
      "Ausência programada",
    );
  });
});

describe("T203 — estados, foco e anúncios", () => {
  it("um só nó de status da sessão à lista; anuncia carga e resultado uma vez cada", async () => {
    const sessao = adiada<SafeAccessUserApi>();
    vi.mocked(obterUsuarioAtual).mockReturnValue(sessao.promessa);
    const leitura = adiada<Pagina>();
    vi.mocked(listarSolicitacoesPessoas)
      .mockReturnValueOnce(leitura.promessa)
      .mockResolvedValue(pagina([]));
    render(<Secao />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Carregando solicitações…");
    await act(async () => {
      sessao.resolver(ator());
    });
    await waitFor(() => expect(listarSolicitacoesPessoas).toHaveBeenCalled());
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Carregando solicitações…");
    await act(async () => {
      leitura.resolver(pagina([solicitacao()]));
    });
    await waitFor(() =>
      expect(status).toHaveTextContent(`Solicitações de ${NOME} carregadas.`),
    );
    expect(screen.getByRole("status")).toBe(status);
  });

  /** Os textos que o nó de status assume a partir de agora. */
  function textosDoStatus(status: HTMLElement) {
    const textos: string[] = [];
    const observador = new MutationObserver(() => {
      textos.push(status.textContent ?? "");
    });
    observador.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return { textos, parar: () => observador.disconnect() };
  }

  it("B1: abrir e concluir o detalhe não repete o anúncio da lista", async () => {
    const s = solicitacao();
    comDetalheDe(s);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const status = screen.getByRole("status");
    const anuncioDaLista = `Solicitações de ${NOME} carregadas.`;
    expect(status).toHaveTextContent(anuncioDaLista);
    const visto = textosDoStatus(status);
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    const titulo = await screen.findByRole("heading", {
      level: 4,
      name: /Detalhe da solicitação/,
    });
    await waitFor(() => expect(status).not.toHaveTextContent(/Carregando/));
    await waitFor(() => expect(titulo).toHaveFocus());
    visto.parar();
    expect(visto.textos).toContain("Carregando o detalhe da solicitação…");
    expect(visto.textos).not.toContain(anuncioDaLista);
    expect(status.textContent).not.toBe(anuncioDaLista);
  });

  it("B1: fechar o detalhe não restaura o anúncio da lista; o nó de status é o mesmo", async () => {
    const s = solicitacao();
    comDetalheDe(s);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const status = screen.getByRole("status");
    const anuncioDaLista = `Solicitações de ${NOME} carregadas.`;
    const ver = within(principal).getByRole("button", { name: /^Ver detalhe/ });
    fireEvent.click(ver);
    await screen.findByRole("heading", {
      level: 4,
      name: /Detalhe da solicitação/,
    });
    await waitFor(() => expect(status).not.toHaveTextContent(/Carregando/));
    const visto = textosDoStatus(status);
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhe" }));
    await waitFor(() => expect(ver).toHaveFocus());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    visto.parar();
    expect(visto.textos).not.toContain(anuncioDaLista);
    expect(status.textContent).not.toBe(anuncioDaLista);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
  });

  it("B1: falha do detalhe só anuncia a falha (um alerta), sem o anúncio da lista", async () => {
    const s = solicitacao();
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    vi.mocked(detalharSolicitacaoPessoa).mockRejectedValueOnce(
      new ApiError(500, "x"),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const status = screen.getByRole("status");
    const anuncioDaLista = `Solicitações de ${NOME} carregadas.`;
    const visto = textosDoStatus(status);
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o detalhe da solicitação.",
    );
    visto.parar();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(status.textContent).not.toBe(anuncioDaLista);
    expect(visto.textos).not.toContain(anuncioDaLista);
  });

  it("B1: uma releitura verdadeira da lista volta a anunciar, uma vez", async () => {
    const s = solicitacao();
    comDetalheDe(s);
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([s]) : pagina([]),
    );
    const vinculos = [ENCERRADO, PRINCIPAL];
    const { rerender } = render(<Secao vinculos={vinculos} />);
    const principal = await bloco(/^CLT · MAT-0001/);
    const status = screen.getByRole("status");
    const anuncioDaLista = `Solicitações de ${NOME} carregadas.`;
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    await screen.findByRole("heading", {
      level: 4,
      name: /Detalhe da solicitação/,
    });
    await waitFor(() => expect(status).not.toHaveTextContent(/Carregando/));
    const visto = textosDoStatus(status);
    // A ficha releu os vínculos (lista nova): a seção relê as solicitações.
    rerender(<Secao vinculos={[...vinculos]} />);
    await waitFor(() => expect(status).toHaveTextContent(anuncioDaLista));
    visto.parar();
    expect(visto.textos.filter((t) => t === anuncioDaLista)).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
  });

  it("vazio: anuncia e mostra 'nenhuma solicitação' por vínculo", async () => {
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    expect(
      within(principal).getByText("Nenhuma solicitação neste vínculo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `Nenhuma solicitação registrada para ${NOME}.`,
    );
  });

  it("falha da lista: alerta; nova tentativa mantém o foco no botão; sucesso leva o foco ao título", async () => {
    vi.mocked(listarSolicitacoesPessoas).mockRejectedValueOnce(
      new ApiError(500, "x"),
    );
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar as solicitações.",
    );
    const botao = screen.getByRole("button", { name: "Tentar de novo" });
    botao.focus();
    const leitura = adiada<Pagina>();
    vi.mocked(listarSolicitacoesPessoas)
      .mockReturnValueOnce(leitura.promessa)
      .mockResolvedValue(pagina([]));
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveFocus();
    await act(async () => {
      leitura.resolver(pagina([solicitacao()]));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Solicitações" }),
      ).toHaveFocus(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falha ao conferir o acesso: alerta e nova tentativa, sem ler solicitações antes", async () => {
    vi.mocked(obterUsuarioAtual).mockRejectedValueOnce(new Error("rede"));
    render(<Secao />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível conferir o seu acesso às solicitações.",
    );
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await bloco(/^CLT · MAT-0001/)).toBeInTheDocument();
  });

  it("lista atrasada de outra pessoa não substitui a atual", async () => {
    const BRUNO = "22222222-2222-4222-8222-222222222222";
    const vinculoBruno = vinculo({
      id: "v-bruno",
      colaboradorId: BRUNO,
      matricula: "MAT-0003",
    });
    const daAna = adiada<Pagina>();
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id
        ? daAna.promessa
        : q?.vinculoId === vinculoBruno.id
          ? pagina([solicitacao({ vinculoId: vinculoBruno.id })])
          : pagina([]),
    );
    const { rerender } = render(<Secao />);
    await waitFor(() => expect(listarSolicitacoesPessoas).toHaveBeenCalled());
    rerender(
      <Secao
        colaboradorId={BRUNO}
        nomeColaborador="Bruno Sintético (teste)"
        vinculos={[vinculoBruno]}
        vinculoPrincipalId={vinculoBruno.id}
      />,
    );
    const bruno = await bloco(/^CLT · MAT-0003/);
    await act(async () => {
      daAna.resolver(pagina([solicitacao(), solicitacao()]));
    });
    expect(
      screen.queryByRole("region", { name: /^CLT · MAT-0001/ }),
    ).toBeNull();
    expect(within(bruno).getAllByRole("row")).toHaveLength(2);
  });

  it("desmontada antes da resposta (troca de empresa remonta a árvore): nada é desenhado depois", async () => {
    const pendente = adiada<Pagina>();
    vi.mocked(listarSolicitacoesPessoas).mockReturnValue(pendente.promessa);
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount, container } = render(<Secao />);
    await waitFor(() => expect(listarSolicitacoesPessoas).toHaveBeenCalled());
    unmount();
    await act(async () => {
      pendente.resolver(pagina([solicitacao()]));
    });
    expect(container.textContent).toBe("");
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it("375 px: tabelas no quadro posicionado e painel de detalhe empilhado", async () => {
    const css = readFileSync(
      "src/screens/pessoas/SolicitacoesColaboradorSecao.css",
      "utf8",
    );
    expect(css).toMatch(
      /\.solicitacoes-colaborador__detalhe\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(css).toMatch(
      /\.solicitacoes-colaborador__campos\s*\{[^}]*minmax\(min\(100%, 12rem\), 1fr\)/,
    );
    vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
      q?.vinculoId === PRINCIPAL.id ? pagina([solicitacao()]) : pagina([]),
    );
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    expect(
      within(principal)
        .getByRole("table")
        .closest(".ficha-colaborador__quadro"),
    ).not.toBeNull();
  });
});
