/**
 * T204 — "Nova solicitação" na aba Solicitações da ficha (decisões A-1 a A-6).
 *
 * O que se prova: só `rh` com empresa ativa registra e envia; vínculos da
 * pessoa na empresa, o principal pré-selecionado, situação no rótulo; tipo,
 * motivo natural e "Outro (controlado)"; dia opcional e validado; revisão;
 * registrar e DEPOIS enviar, uma vez, sem repetição automática; registro
 * recusado ou incerto sem envio; envio falhando depois do registro com o
 * detalhe do rascunho e "Enviar" só para ele; envio repetido ou concorrente
 * pela resposta do servidor; sucesso com lista relida, foco e um anúncio;
 * Escape, foco e clique repetido; desmontagem; nenhuma outra transição. A
 * guarda de saída no shell está em `App.ficha.test.tsx`.
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
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import type { VinculoApi } from "../../api/colaboradoresClient";
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
} from "../../app/edicoesPendentes";
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
const PREVISTO = vinculo({
  id: "v-previsto",
  matricula: "MAT-0003",
  tipo: "temporario",
  situacao: "previsto",
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
    periodoReferencia: null,
    registradoPorUserId: "u-1",
    enviadaEm: "2026-11-09T12:30:00.000Z",
    primeiraRevisaoEm: null,
    criadoEm: "2026-11-09T12:00:00.000Z",
    atualizadoEm: "2026-11-09T12:30:00.000Z",
    ...parcial,
  };
}

function pagina(itens: SolicitacaoPessoaApi[]) {
  return {
    itens,
    pagina: 1,
    tamanhoPagina: TAMANHO_PAGINA_SOLICITACOES,
    total: itens.length,
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

/**
 * "Servidor" em memória: o registro nasce em rascunho, o envio só sai de
 * rascunho (senão 422, como a máquina de estados do servidor), e a lista e o
 * detalhe leem o mesmo estado.
 */
function servidor(inicial: SolicitacaoPessoaApi[] = []) {
  const linhas = new Map(inicial.map((s) => [s.id, s]));
  let proximo = 100;
  vi.mocked(listarSolicitacoesPessoas).mockImplementation(async (q) =>
    pagina([...linhas.values()].filter((s) => s.vinculoId === q?.vinculoId)),
  );
  vi.mocked(detalharSolicitacaoPessoa).mockImplementation(async (id) => {
    const s = linhas.get(id);
    if (!s) throw new ApiError(404, "x");
    return s;
  });
  vi.mocked(registrarSolicitacaoPessoa).mockImplementation(async (dto) => {
    proximo += 1;
    const s = solicitacao({
      id: `nova-${proximo}`,
      empresaId: dto.empresaId,
      vinculoId: dto.vinculoId,
      tipo: dto.tipo,
      motivo: dto.motivo,
      periodoReferencia: dto.periodoReferencia ?? null,
      situacao: "rascunho",
      enviadaEm: null,
    });
    linhas.set(s.id, s);
    return s;
  });
  vi.mocked(transicionarSolicitacaoPessoa).mockImplementation(
    async (id, dto) => {
      const s = linhas.get(id);
      if (!s) throw new ApiError(404, "x");
      if (dto.acao !== "enviar" || s.situacao !== "rascunho") {
        throw new ApiError(422, "x");
      }
      const enviada = {
        ...s,
        situacao: "enviada" as const,
        enviadaEm: "2026-11-09T12:31:00.000Z",
      };
      linhas.set(id, enviada);
      return enviada;
    },
  );
  return linhas;
}

beforeEach(() => {
  vi.clearAllMocks();
  contador = 0;
  vi.mocked(obterUsuarioAtual).mockResolvedValue(ator());
  vi.mocked(historicoSolicitacaoPessoa).mockResolvedValue([]);
  servidor();
});

function Secao(
  props: Partial<Parameters<typeof SolicitacoesColaboradorSecao>[0]> = {},
) {
  return (
    <SolicitacoesColaboradorSecao
      colaboradorId={ANA}
      nomeColaborador={NOME}
      vinculos={[ENCERRADO, PRINCIPAL, PREVISTO, DE_OUTRA_EMPRESA]}
      vinculoPrincipalId={PRINCIPAL.id}
      {...props}
    />
  );
}

const bloco = (titulo: RegExp) => screen.findByRole("region", { name: titulo });
const janela = () => screen.getByRole("dialog", { name: "Nova solicitação" });
const campo = (rotulo: RegExp) =>
  within(janela()).getByLabelText(rotulo) as
    HTMLSelectElement | HTMLInputElement;
const opcoes = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((o) => o.textContent);
const tecla = (key: string) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key });

async function abrirNova() {
  render(<Secao />);
  await bloco(/^CLT · MAT-0001/);
  const botao = screen.getByRole("button", { name: "Nova solicitação" });
  botao.focus();
  fireEvent.click(botao);
  return { botao, dialogo: janela() };
}

function preencher(
  tipo = "ferias",
  { vinculoId, dia }: { vinculoId?: string; dia?: string } = {},
) {
  fireEvent.change(campo(/^Tipo/), { target: { value: tipo } });
  if (vinculoId) {
    fireEvent.change(campo(/^Vínculo/), { target: { value: vinculoId } });
  }
  if (dia !== undefined) {
    fireEvent.change(campo(/^Dia de referência/), { target: { value: dia } });
  }
}

const revisar = () =>
  fireEvent.click(within(janela()).getByRole("button", { name: "Revisar" }));
const confirmar = () =>
  fireEvent.click(
    within(janela()).getByRole("button", {
      name: /^(Confirmar e enviar|Enviando…)$/,
    }),
  );

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

const TRANSICOES_FORA =
  /cancelar solicita|^cancelar$|iniciar revis|aguardar|retomar|encaminhar|recusar|reabrir/i;

describe("T204 — quem vê 'Nova solicitação'", () => {
  it("RH com empresa ativa vê o botão e o aviso de registro e envio", async () => {
    render(<Secao />);
    await bloco(/^CLT · MAT-0001/);
    expect(
      screen.getByRole("button", { name: "Nova solicitação" }),
    ).toBeVisible();
    expect(screen.getByText("Registro e envio")).toBeVisible();
    expect(screen.queryByText("Somente consulta")).toBeNull();
  });

  it.each(["master_tecnico", "dp", "gestor"])(
    "%s com empresa: sem 'Nova solicitação', sem janela, sem escrita",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ role: papel }));
      render(<Secao />);
      await bloco(/^CLT · MAT-0001/);
      expect(screen.queryByRole("button", { name: "Nova solicitação" })).toBe(
        null,
      );
      expect(screen.getByText("Somente consulta")).toBeVisible();
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("RH sem empresa ativa: orientação, nenhuma consulta e nenhum botão", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator({ companyId: null }));
    render(<Secao />);
    await screen.findByText(/Escolha uma empresa ativa/);
    expect(screen.queryByRole("button", { name: "Nova solicitação" })).toBe(
      null,
    );
    expect(listarSolicitacoesPessoas).not.toHaveBeenCalled();
  });

  it("com a lista em falha ou sem vínculo na empresa, o botão não aparece", async () => {
    vi.mocked(listarSolicitacoesPessoas).mockRejectedValue(
      new ApiError(500, "x"),
    );
    const { unmount } = render(<Secao />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Nova solicitação" })).toBe(
      null,
    );
    unmount();

    render(<Secao vinculos={[DE_OUTRA_EMPRESA]} />);
    await screen.findByText(/não tem vínculo nesta empresa/);
    expect(screen.queryByRole("button", { name: "Nova solicitação" })).toBe(
      null,
    );
  });
});

describe("T204 — formulário", () => {
  it("abre a janela com o foco no título; vínculos da pessoa na empresa, o principal pré-selecionado, situação no rótulo", async () => {
    const { dialogo } = await abrirNova();
    expect(
      within(dialogo).getByRole("heading", { name: "Nova solicitação" }),
    ).toHaveFocus();
    const vinculos = campo(/^Vínculo/) as HTMLSelectElement;
    expect(vinculos.value).toBe(PRINCIPAL.id);
    expect(opcoes(vinculos)).toEqual([
      "CLT · MAT-0001 · Ativo · vínculo principal",
      "Estágio · MAT-0002 · Encerrado",
      "Temporário · MAT-0003 · Previsto",
    ]);
    // Sem texto livre, anexo ou arquivo.
    expect(dialogo.querySelector("textarea, input[type=file]")).toBeNull();
    expect([...dialogo.querySelectorAll("input")].map((i) => i.type)).toEqual([
      "date",
    ]);
  });

  it("os seis tipos; o motivo começa no natural de cada tipo, com 'Outro (controlado)' como única alternativa", async () => {
    await abrirNova();
    const tipo = campo(/^Tipo/) as HTMLSelectElement;
    expect(opcoes(tipo)).toEqual([
      "Selecione…",
      "Contestação de ajuste de ponto",
      "Ausência",
      "Férias",
      "Atualização cadastral",
      "Atestado",
      "Benefícios",
    ]);
    expect(campo(/^Motivo/)).toBeDisabled();
    const natural: [string, string][] = [
      ["contestacao_ajuste_ponto", "Divergência de marcação"],
      ["ausencia", "Ausência programada"],
      ["ferias", "Período de férias"],
      ["atualizacao_cadastral", "Dado cadastral desatualizado"],
      ["atestado", "Atestado apresentado"],
      ["beneficios", "Benefício solicitado"],
    ];
    for (const [valor, rotulo] of natural) {
      fireEvent.change(tipo, { target: { value: valor } });
      const motivo = campo(/^Motivo/) as HTMLSelectElement;
      expect(opcoes(motivo)).toEqual([rotulo, "Outro (controlado)"]);
      expect(motivo.selectedOptions[0]!.textContent).toBe(rotulo);
    }
  });

  it("validação: sem tipo, aviso no campo e foco nele; dia fora do calendário recusado; nada é gravado", async () => {
    await abrirNova();
    revisar();
    const tipo = campo(/^Tipo/);
    expect(tipo).toHaveAccessibleDescription(/Escolha o tipo da solicitação/);
    await waitFor(() => expect(tipo).toHaveFocus());

    preencher("ferias", { dia: "0002-01-01" });
    revisar();
    const dia = campo(/^Dia de referência/);
    expect(dia).toHaveAccessibleDescription(/Informe uma data válida/);
    await waitFor(() => expect(dia).toHaveFocus());
    expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("revisão com o resumo (dia só quando preenchido); 'Voltar' devolve o formulário com os valores", async () => {
    await abrirNova();
    preencher("atestado", { vinculoId: ENCERRADO.id, dia: "2026-11-03" });
    fireEvent.change(campo(/^Motivo/), {
      target: { value: "outro_controlado" },
    });
    revisar();
    const passo = await within(janela()).findByRole("heading", {
      name: "Confira antes de enviar",
    });
    await waitFor(() => expect(passo).toHaveFocus());
    const resumo = janela().querySelector("dl")!;
    expect(resumo.textContent).toContain("Atestado");
    expect(resumo.textContent).toContain("Estágio · MAT-0002 · Encerrado");
    expect(resumo.textContent).toContain("Outro (controlado)");
    expect(resumo.textContent).toContain("03/11/2026");

    fireEvent.click(within(janela()).getByRole("button", { name: "Voltar" }));
    expect(campo(/^Tipo/)).toHaveValue("atestado");
    expect(campo(/^Vínculo/)).toHaveValue(ENCERRADO.id);
    expect(campo(/^Motivo/)).toHaveValue("outro_controlado");
    expect(campo(/^Dia de referência/)).toHaveValue("2026-11-03");

    fireEvent.change(campo(/^Dia de referência/), { target: { value: "" } });
    revisar();
    await within(janela()).findByRole("heading", {
      name: "Confira antes de enviar",
    });
    expect(within(janela()).queryByText("Dia de referência")).toBeNull();
    expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("Escape sem alteração fecha e devolve o foco a 'Nova solicitação'; com alteração, pede para descartar", async () => {
    const { botao } = await abrirNova();
    tecla("Escape");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(botao).toHaveFocus();

    fireEvent.click(botao);
    preencher("ausencia");
    tecla("Escape");
    expect(
      await screen.findByRole("alertdialog", {
        name: /Há alterações não salvas nesta janela/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(campo(/^Tipo/)).toHaveValue("ausencia");

    fireEvent.click(within(janela()).getByRole("button", { name: "Cancelar" }));
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: /^Descartar/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(registrarSolicitacaoPessoa).not.toHaveBeenCalled();
  });
});

describe("T204 — registrar e enviar", () => {
  it("sucesso: registra (corpo exato, empresa da sessão) e DEPOIS envia; lista relida com 'Enviada'; foco no bloco; um anúncio", async () => {
    await abrirNova();
    const status = screen.getByRole("status");
    preencher("ferias", { dia: "2026-12-01" });
    revisar();
    await within(janela()).findByRole("heading", {
      name: "Confira antes de enviar",
    });
    const visto = textosDoStatus(status);
    confirmar();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledWith({
      empresaId: EMPRESA,
      vinculoId: PRINCIPAL.id,
      tipo: "ferias",
      motivo: "periodo_ferias",
      periodoReferencia: "2026-12-01",
    });
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledWith("nova-101", {
      acao: "enviar",
    });
    expect(
      vi.mocked(registrarSolicitacaoPessoa).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(transicionarSolicitacaoPessoa).mock.invocationCallOrder[0]!,
    );

    const principal = await bloco(/^CLT · MAT-0001/);
    await waitFor(() =>
      expect(within(principal).getAllByRole("row")).toHaveLength(2),
    );
    expect(within(principal).getByText("Enviada")).toBeVisible();
    expect(within(principal).getByRole("heading", { level: 3 })).toHaveFocus();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    visto.parar();
    const anuncio = "Solicitação de Férias registrada e enviada.";
    expect(status).toHaveTextContent(anuncio);
    expect(visto.textos.filter((t) => t === anuncio)).toHaveLength(1);
    expect(visto.textos).not.toContain(`Solicitações de ${NOME} carregadas.`);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toBe(status);
  });

  it("dia vazio: o corpo não leva dia de referência; vínculo previsto aceito", async () => {
    await abrirNova();
    preencher("beneficios", { vinculoId: PREVISTO.id });
    revisar();
    confirmar();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledWith({
      empresaId: EMPRESA,
      vinculoId: PREVISTO.id,
      tipo: "beneficios",
      motivo: "beneficio_solicitado",
    });
    const previsto = await bloco(/^Temporário · MAT-0003/);
    expect(within(previsto).getByRole("heading", { level: 3 })).toHaveFocus();
  });

  it("clique repetido e Escape durante o envio: um só registro, um só envio, a janela não fecha", async () => {
    const registro = adiada<SolicitacaoPessoaApi>();
    vi.mocked(registrarSolicitacaoPessoa).mockReturnValueOnce(
      registro.promessa,
    );
    await abrirNova();
    preencher("ferias");
    revisar();
    // Três cliques no mesmo lote, sem redesenho entre eles: só a trava
    // síncrona da seção os segura.
    const confirmacao = within(janela()).getByRole("button", {
      name: "Confirmar e enviar",
    });
    act(() => {
      confirmacao.click();
      confirmacao.click();
      confirmacao.click();
    });
    confirmar();
    const botao = within(janela()).getByRole("button", { name: "Enviando…" });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    tecla("Escape");
    expect(janela()).toBeInTheDocument();
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);

    await act(async () => {
      registro.resolver(
        solicitacao({ id: "nova-x", situacao: "rascunho", enviadaEm: null }),
      );
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
  });

  it.each([
    [422, /Os dados foram recusados e nada foi registrado/],
    [400, /Os dados foram recusados e nada foi registrado/],
    [403, /não tem permissão para registrar.*Nada foi registrado/],
    [404, /vínculo escolhido não está disponível.*Nada foi registrado/],
    [401, /sessão expirou e nada foi registrado/],
  ])(
    "registro recusado (%i): aviso, formulário mantido, nenhum envio",
    async (status, texto) => {
      vi.mocked(registrarSolicitacaoPessoa).mockRejectedValueOnce(
        new ApiError(status, "x"),
      );
      await abrirNova();
      preencher("ausencia", { dia: "2026-11-20" });
      revisar();
      confirmar();
      const alerta = await within(janela()).findByRole("alert");
      expect(alerta).toHaveTextContent(texto);
      expect(alerta.textContent).not.toMatch(/registrada e enviada/);
      expect(campo(/^Tipo/)).toHaveValue("ausencia");
      expect(campo(/^Dia de referência/)).toHaveValue("2026-11-20");
      await waitFor(() =>
        expect(
          within(janela()).getByRole("heading", {
            name: "Dados da solicitação",
          }),
        ).toHaveFocus(),
      );
      expect(transicionarSolicitacaoPessoa).not.toHaveBeenCalled();
      expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ["rede", new TypeError("Failed to fetch")],
    ["5xx", new ApiError(502, "x")],
  ])(
    "registro incerto (%s): não afirma criação, não envia, não repete; ao fechar, a lista é relida para conferir",
    async (_nome, erro) => {
      vi.mocked(registrarSolicitacaoPessoa).mockRejectedValueOnce(erro);
      await abrirNova();
      preencher("ferias");
      revisar();
      confirmar();
      const alerta = await within(janela()).findByRole("alert");
      expect(alerta).toHaveTextContent(
        /Não foi possível confirmar se a solicitação foi registrada.*confira a lista.*nada é repetido automaticamente/,
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
      expect(transicionarSolicitacaoPessoa).not.toHaveBeenCalled();
      const leituras = vi.mocked(listarSolicitacoesPessoas).mock.calls.length;

      fireEvent.click(
        within(janela()).getByRole("button", { name: "Cancelar" }),
      );
      fireEvent.click(
        await screen.findByRole("button", { name: /^Descartar/ }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await waitFor(() =>
        expect(
          vi.mocked(listarSolicitacoesPessoas).mock.calls.length,
        ).toBeGreaterThan(leituras),
      );
      // Releitura silenciosa: sem "Carregando…" no lugar dos blocos.
      expect(screen.getByRole("region", { name: /^CLT · MAT-0001/ })).toBe(
        screen.getByRole("region", { name: /^CLT · MAT-0001/ }),
      );
    },
  );

  it("registro concluído e envio falhando: um só rascunho, o detalhe dele aberto com 'Enviar'; 'Enviar' conclui sem novo registro", async () => {
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    await abrirNova();
    preencher("ferias");
    revisar();
    confirmar();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const titulo = await screen.findByRole("heading", {
      level: 4,
      name: "Detalhe da solicitação de Férias",
    });
    await waitFor(() => expect(titulo).toHaveFocus());
    const painel = titulo.closest("section")!;
    expect(within(painel).getByRole("alert")).toHaveTextContent(
      /registrada, mas o envio não foi confirmado.*use “Enviar”/,
    );
    const principal = await bloco(/^CLT · MAT-0001/);
    await waitFor(() =>
      expect(within(principal).getAllByRole("row")).toHaveLength(2),
    );
    expect(within(principal).getAllByText("Rascunho").length).toBeGreaterThan(
      0,
    );
    // Só "Enviar" e "Fechar detalhe": nenhuma outra transição.
    expect(
      within(painel)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Enviar", "Fechar detalhe"]);
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);

    const status = screen.getByRole("status");
    fireEvent.click(within(painel).getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(status).toHaveTextContent("Solicitação de Férias enviada."),
    );
    await waitFor(() =>
      expect(
        within(painel).queryByRole("button", { name: "Enviar" }),
      ).toBeNull(),
    );
    expect(within(painel).getAllByText("Enviada").length).toBeGreaterThan(0);
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledTimes(2);
    expect(vi.mocked(transicionarSolicitacaoPessoa).mock.calls[1]).toEqual([
      "nova-101",
      { acao: "enviar" },
    ]);
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it("'Enviar' concorrente (já enviada ou cancelada na tela coletiva): a resposta 422 do servidor, situação relida, sem efeito duplo", async () => {
    const linhas = servidor();
    // Só o envio da confirmação falha; o "Enviar" do detalhe vai ao servidor.
    vi.mocked(transicionarSolicitacaoPessoa).mockRejectedValueOnce(
      new ApiError(500, "x"),
    );
    await abrirNova();
    preencher("ferias");
    revisar();
    confirmar();
    const titulo = await screen.findByRole("heading", {
      level: 4,
      name: "Detalhe da solicitação de Férias",
    });
    const painel = titulo.closest("section")!;
    const enviar = await within(painel).findByRole("button", {
      name: "Enviar",
    });
    // Outra pessoa enviou pela tela coletiva enquanto isso.
    const id = [...linhas.keys()][0]!;
    linhas.set(id, { ...linhas.get(id)!, situacao: "cancelada" });

    act(() => {
      enviar.click();
      enviar.click();
    });
    await waitFor(() =>
      expect(within(painel).getByRole("alert")).toHaveTextContent(
        "O envio não é mais possível na situação atual. A solicitação foi atualizada.",
      ),
    );
    await waitFor(() =>
      expect(within(painel).queryByRole("button", { name: "Enviar" })).toBe(
        null,
      ),
    );
    expect(within(painel).getAllByText("Cancelada").length).toBeGreaterThan(0);
    // Um envio na confirmação e um no detalhe (o clique repetido não conta).
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledTimes(2);
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
  });

  it("rascunho que a ficha não criou (veio da tela coletiva): o detalhe não oferece 'Enviar' nem outra transição", async () => {
    servidor([solicitacao({ situacao: "rascunho", enviadaEm: null })]);
    render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    fireEvent.click(
      within(principal).getByRole("button", { name: /^Ver detalhe/ }),
    );
    const titulo = await screen.findByRole("heading", {
      level: 4,
      name: /Detalhe da solicitação/,
    });
    const painel = titulo.closest("section")!;
    await within(painel).findByText("Linha do tempo");
    expect(
      within(painel)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Fechar detalhe"]);
  });

  it("nenhuma das transições fora de escopo aparece na aba, em nenhuma situação", async () => {
    servidor(
      (
        [
          "rascunho",
          "enviada",
          "em_revisao_rh",
          "aguardando_informacao",
          "encaminhada_para_operacao_rh",
          "recusada",
          "cancelada",
        ] as const
      ).map((situacao) => solicitacao({ situacao })),
    );
    const { container } = render(<Secao />);
    const principal = await bloco(/^CLT · MAT-0001/);
    for (const ver of within(principal).getAllByRole("button", {
      name: /^Ver detalhe/,
    })) {
      fireEvent.click(ver);
      await within(container).findByText("Linha do tempo");
      for (const b of within(container).getAllByRole("button")) {
        expect(b.textContent ?? "").not.toMatch(TRANSICOES_FORA);
      }
    }
    expect(transicionarSolicitacaoPessoa).not.toHaveBeenCalled();
  });

  it("desmontagem entre o registro e o envio: o registro recém-criado ainda é enviado (nada fica órfão), sem atualizar a tela", async () => {
    const registro = adiada<SolicitacaoPessoaApi>();
    vi.mocked(registrarSolicitacaoPessoa).mockReturnValueOnce(
      registro.promessa,
    );
    const { unmount } = render(<Secao />);
    await bloco(/^CLT · MAT-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    preencher("ferias");
    revisar();
    confirmar();
    expect(registrarSolicitacaoPessoa).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      registro.resolver(
        solicitacao({ id: "nova-z", situacao: "rascunho", enviadaEm: null }),
      );
    });
    expect(transicionarSolicitacaoPessoa).toHaveBeenCalledWith("nova-z", {
      acao: "enviar",
    });
  });
});

describe("T204 — guarda de saída (registro de edições)", () => {
  it("janela alterada é edição pendente; registro e envio em curso, salvamento; sem alteração, nada", async () => {
    const registro = new RegistroDeEdicoes();
    const envio = adiada<SolicitacaoPessoaApi>();
    vi.mocked(registrarSolicitacaoPessoa).mockReturnValueOnce(envio.promessa);
    render(
      <ProvedorDeEdicoes registro={registro}>
        <Secao />
      </ProvedorDeEdicoes>,
    );
    await bloco(/^CLT · MAT-0001/);
    fireEvent.click(screen.getByRole("button", { name: "Nova solicitação" }));
    expect(registro.obter().pendentes).toEqual([]);
    preencher("ferias");
    await waitFor(() =>
      expect(registro.obter().pendentes).toContain("Nova solicitação"),
    );
    revisar();
    confirmar();
    await waitFor(() =>
      expect(registro.obter().salvando).toContain("Nova solicitação"),
    );
    await act(async () => {
      envio.resolver(
        solicitacao({ id: "nova-g", situacao: "rascunho", enviadaEm: null }),
      );
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(registro.obter().pendentes).toEqual([]);
    expect(registro.obter().salvando).toEqual([]);
  });
});

describe("T204 — 375 px", () => {
  it("formulário e revisão empilhados numa coluna que encolhe; aviso que quebra a linha", () => {
    const css = readFileSync(
      "src/screens/pessoas/SolicitacoesColaboradorSecao.css",
      "utf8",
    );
    const regra = (seletor: string) => {
      const inicio = css.indexOf(`${seletor} {`);
      expect(inicio).toBeGreaterThanOrEqual(0);
      return css.slice(inicio, css.indexOf("}", inicio));
    };
    expect(regra(".solicitacoes-colaborador__formulario")).toContain(
      "grid-template-columns: minmax(0, 1fr)",
    );
    expect(regra(".solicitacoes-colaborador__formulario")).toContain(
      "overflow-wrap: anywhere",
    );
    expect(regra(".solicitacoes-colaborador__erro")).toContain(
      "overflow-wrap: anywhere",
    );
  });
});
