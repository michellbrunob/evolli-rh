/**
 * Testes da tela "Minha equipe" (T153).
 *
 * Os testes de corrida usam `deferred` + `resolverECommitar`, o par já
 * comprovado em `SolicitacoesScreen.test.tsx` (T140): sem resolver a promessa
 * DENTRO de `act` e dar um tick ao microtask queue, a escrita de estado
 * tardia acontece fora do que o React confirmou, e o teste passa sem provar
 * nada.
 *
 * Todo teste de corrida tem evidência **positiva** (o dado correto está) e
 * **negativa** (o dado obsoleto não está). Só a negativa não basta: se a tela
 * quebrasse e não renderizasse nada, a negativa passaria sozinha.
 *
 * LIMITE CONHECIDO: o Vitest roda em jsdom com `css: false`
 * (`apps/web/vite.config.ts`). Não há motor de layout e nenhum teste do
 * projeto pode medir largura, `scrollWidth` ou overflow. Por isso o requisito
 * de 375 px é coberto aqui por **contrato de CSS** (as regras que de fato
 * impedem o vazamento existem no arquivo) e verificado de verdade em
 * navegador real, como manda o guia visual do projeto.
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
import { readFileSync } from "node:fs";
import { EquipeScreen, PAPEIS_COM_CONSULTA_DE_EQUIPE } from "./EquipeScreen";
import { ApiError } from "../../api/gestorClient";
import { detalharVinculo, listarEquipe } from "../../api/gestorClient";
import { obterUsuarioAtual } from "../../api/usersClient";

vi.mock("../../api/gestorClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/gestorClient")>(
    "../../api/gestorClient",
  );
  return { ...actual, listarEquipe: vi.fn(), detalharVinculo: vi.fn() };
});

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return { ...actual, obterUsuarioAtual: vi.fn() };
});

function deferred<T>() {
  let resolver!: (value: T) => void;
  let rejeitar!: (motivo: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promise, resolve: resolver, reject: rejeitar };
}

/** Resolve uma promessa e deixa o React confirmar o efeito dela. */
async function resolverECommitar(acao: () => void): Promise<void> {
  await act(async () => {
    acao();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function ator(role: string) {
  return {
    id: "u1",
    email: "gestor.alfa@evolli.local",
    role,
    companyId: "empresa-alfa",
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    mfaAvailable: false,
  };
}

function membro(over: Partial<Record<string, unknown>> = {}) {
  return {
    vinculoId: "v-1",
    colaboradorId: "c-1",
    nome: "Pessoa Demo Alfa Turno A",
    matricula: "DEMO-A-0201",
    situacaoVinculo: "ativo",
    tipoVinculo: "efetivo",
    dataAdmissao: "2026-01-05T00:00:00.000Z",
    dataDesligamento: null,
    cargoVigente: { id: "cg1", nome: "Operador" },
    lotacaoVigente: {
      equipe: { id: "e1", nome: "Turno A" },
      departamento: null,
      unidadeOrganizacional: null,
      vigenteDe: "2026-01-05T00:00:00.000Z",
    },
    ...over,
  } as never;
}

function detalhe(over: Partial<Record<string, unknown>> = {}) {
  return {
    ...(membro() as object),
    dataReferencia: "2026-10-08",
    horarioVigente: null,
    resumoJornada: null,
    andamentoSolicitacoes: null,
    ...over,
  } as never;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// 1 e 2 — a lista é a do servidor; carregando / vazio / erro / retry.
// ---------------------------------------------------------------------------

describe("lista da equipe", () => {
  it("T153.1 mostra apenas as pessoas que o servidor devolveu", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [
        membro(),
        membro({
          vinculoId: "v-2",
          nome: "Outra Pessoa",
          matricula: "DEMO-A-0203",
        }),
      ],
    } as never);

    render(<EquipeScreen />);

    expect(
      await screen.findByText("Pessoa Demo Alfa Turno A"),
    ).toBeInTheDocument();
    expect(screen.getByText("Outra Pessoa")).toBeInTheDocument();
    // Contraprova: quem o servidor NÃO mandou não aparece — a tela não
    // completa a lista por inferência nenhuma.
    expect(
      screen.queryByText("Pessoa Demo Alfa Turno B"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("DEMO-A-0202")).not.toBeInTheDocument();
    expect(screen.queryByText("DEMO-B-0001")).not.toBeInTheDocument();
  });

  it("T153.2 percorre carregando → erro → nova tentativa → dados", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    const d1 = deferred<unknown>();
    vi.mocked(listarEquipe).mockReturnValueOnce(d1.promise as never);

    render(<EquipeScreen />);
    expect(
      await screen.findByText(/Carregando sua equipe/),
    ).toBeInTheDocument();

    await resolverECommitar(() => d1.reject(new ApiError(500, "x")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar sua equipe.",
    );

    vi.mocked(listarEquipe).mockResolvedValueOnce({
      dataReferencia: "2026-10-08",
      itens: [membro()],
    } as never);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText("Pessoa Demo Alfa Turno A"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("T153.3 lista vazia explica que é o comportamento esperado (ADR 0015)", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [],
    } as never);

    render(<EquipeScreen />);

    expect(
      await screen.findByText("Nenhuma pessoa sob sua gestão hoje"),
    ).toBeInTheDocument();
    // A ADR 0015 exigiu que a interface explicasse que vazio é correto, não
    // defeito. Sem esta frase o gestor conclui que a tela está quebrada.
    expect(
      screen.getByText(/é o comportamento esperado, não um erro/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/atribuição de equipe vigente/),
    ).toBeInTheDocument();
  });

  it("T153.4 busca filtra só o que já veio, sem consultar o servidor", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [
        membro(),
        membro({
          vinculoId: "v-2",
          nome: "Zulmira Souza",
          matricula: "DEMO-A-0203",
        }),
      ],
    } as never);

    render(<EquipeScreen />);
    await screen.findByText("Pessoa Demo Alfa Turno A");
    const chamadasAntes = vi.mocked(listarEquipe).mock.calls.length;

    fireEvent.change(screen.getByLabelText("Buscar na lista"), {
      target: { value: "zulmira" },
    });

    expect(screen.getByText("Zulmira Souza")).toBeInTheDocument();
    expect(
      screen.queryByText("Pessoa Demo Alfa Turno A"),
    ).not.toBeInTheDocument();
    // O ponto do teste: filtrar não é consultar. Mandar query para estas
    // rotas responde 400.
    expect(vi.mocked(listarEquipe).mock.calls.length).toBe(chamadasAntes);
  });

  it("T153.5 exibe a data de referência do servidor e não oferece como mudá-la", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro()],
    } as never);

    const { container } = render(<EquipeScreen />);
    await screen.findByText("Pessoa Demo Alfa Turno A");

    expect(screen.getByText("2026-10-08")).toBeInTheDocument();
    // Nenhum CONTROLE de data: nem input, nem select, nem seletor. A
    // fronteira de autorização não é negociável pelo cliente (ADR 0015,
    // decisão 8). A asserção é sobre controles, não sobre o texto — o aviso
    // legitimamente menciona "data de referência" em prosa.
    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    const campos = [...container.querySelectorAll("input")];
    expect(campos).toHaveLength(1);
    expect(campos[0]).toHaveAttribute("type", "search");
  });
});

// ---------------------------------------------------------------------------
// 3, 4, 5 — detalhe autorizado, 404 seguro, nenhum corpo interno de erro.
// ---------------------------------------------------------------------------

describe("detalhe consultivo", () => {
  async function abrirLista() {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [
        membro(),
        membro({
          vinculoId: "v-2",
          nome: "Outra Pessoa",
          matricula: "DEMO-A-0203",
        }),
      ],
    } as never);
    render(<EquipeScreen />);
    await screen.findByText("Pessoa Demo Alfa Turno A");
  }

  it("T153.6 abre o detalhe autorizado em modal, somente leitura", async () => {
    await abrirLista();
    vi.mocked(detalharVinculo).mockResolvedValue(
      detalhe({
        horarioVigente: {
          tabelaId: "t1",
          nome: "Turno A 08-17",
          vigenciaInicio: "2026-01-05T00:00:00.000Z",
          vigenciaFim: null,
        },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhe de Pessoa Demo Alfa Turno A",
      }),
    );

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    // Escopado ao diálogo: a matrícula também aparece na tabela atrás dele.
    const dentro = within(dialogo);
    await waitFor(() =>
      expect(dentro.getByText("DEMO-A-0201")).toBeInTheDocument(),
    );
    expect(dentro.getByText(/Turno A 08-17/)).toBeInTheDocument();
    expect(dentro.getByText("Consulta somente leitura.")).toBeInTheDocument();
  });

  it("T153.7 404 vira indisponibilidade, sem enumerar", async () => {
    await abrirLista();
    vi.mocked(detalharVinculo).mockRejectedValue(
      new ApiError(404, "Este registro não está disponível para consulta."),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhe de Pessoa Demo Alfa Turno A",
      }),
    );

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Este registro não está disponível para consulta.",
    );
    // Nada que distinga "não existe" de "existe, mas é de outra equipe".
    expect(alerta.textContent).not.toMatch(
      /outra equipe|outra empresa|inexistente|não existe|403|404/i,
    );
  });

  it("T153.8 nunca exibe o corpo interno do erro do servidor", async () => {
    await abrirLista();
    vi.mocked(detalharVinculo).mockRejectedValue(
      new ApiError(500, "Não foi possível carregar o detalhe."),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhe de Pessoa Demo Alfa Turno A",
      }),
    );
    await screen.findByRole("alert");

    const texto = document.body.textContent ?? "";
    for (const vazamento of [
      "request_id",
      "status_code",
      "timestamp",
      "stack",
      "PrismaClient",
      "detalhe interno",
    ]) {
      expect(texto).not.toContain(vazamento);
    }
  });

  it("T153.9 não oferece nenhum controle de mutação", async () => {
    await abrirLista();
    vi.mocked(detalharVinculo).mockResolvedValue(detalhe());

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhe de Pessoa Demo Alfa Turno A",
      }),
    );
    await screen.findByRole("dialog");

    for (const nome of [
      /salvar/i,
      /editar/i,
      /aprovar/i,
      /reprovar/i,
      /excluir/i,
      /remover/i,
      /enviar/i,
      /confirmar/i,
      /alterar/i,
      /encerrar/i,
      /criar/i,
    ]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("T153.10 não desenha jornada, solicitações nem saúde como funcional", async () => {
    await abrirLista();
    vi.mocked(detalharVinculo).mockResolvedValue(detalhe());

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver detalhe de Pessoa Demo Alfa Turno A",
      }),
    );
    await screen.findByRole("dialog");

    const texto = document.body.textContent ?? "";
    // `resumoJornada` e `andamentoSolicitacoes` chegam null de propósito.
    // Nem cartão vazio, nem "em breve", nem placeholder.
    for (const proibido of [
      "Resumo de jornada",
      "Jornada",
      "Banco de horas",
      "Espelho de ponto",
      "Solicitações",
      "Andamento",
      "Atestado",
      "CID",
      "Diagnóstico",
      "Afastamento médico",
      "em breve",
      "Em breve",
    ]) {
      expect(texto).not.toContain(proibido);
    }
  });
});

// ---------------------------------------------------------------------------
// 7 — papel sem capacidade não vê a interface funcional.
// ---------------------------------------------------------------------------

describe("papéis", () => {
  it("T153.11 a lista de papéis espelha exatamente o RBAC", () => {
    // `rbac.evaluator.ts`, ramo `gestor_equipe`: dois `case` — gestor e rh.
    // Acrescentar um papel aqui sem o servidor conceder produz uma tela que
    // carrega e leva 403.
    expect([...PAPEIS_COM_CONSULTA_DE_EQUIPE].sort()).toEqual(["gestor", "rh"]);
  });

  it.each([
    "dp",
    "colaborador",
    "master_tecnico",
    "financeiro",
    "auditor",
    "dpo",
    "admin_tecnico",
  ])(
    "T153.12 papel %s não vê a interface funcional e não consulta",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator(papel) as never);
      vi.mocked(listarEquipe).mockResolvedValue({
        dataReferencia: "2026-10-08",
        itens: [membro()],
      } as never);

      render(<EquipeScreen />);

      expect(await screen.findByText("Sem permissão")).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByLabelText("Buscar na lista")).toBeNull();
      expect(screen.queryByText("Pessoa Demo Alfa Turno A")).toBeNull();
      // E não chama a rota: pedir 403 de propósito seria ruído na trilha.
      expect(vi.mocked(listarEquipe)).not.toHaveBeenCalled();
    },
  );

  it.each(["gestor", "rh"])(
    "T153.13 papel %s, concedido pelo contrato, vê a interface",
    async (papel) => {
      vi.mocked(obterUsuarioAtual).mockResolvedValue(ator(papel) as never);
      vi.mocked(listarEquipe).mockResolvedValue({
        dataReferencia: "2026-10-08",
        itens: [membro()],
      } as never);

      render(<EquipeScreen />);

      expect(
        await screen.findByText("Pessoa Demo Alfa Turno A"),
      ).toBeInTheDocument();
      expect(screen.queryByText("Sem permissão")).toBeNull();
    },
  );
});

// ---------------------------------------------------------------------------
// 8 a 12 — concorrência. O coração desta tarefa.
// ---------------------------------------------------------------------------

describe("corrida e invalidação", () => {
  it("T153.14 resposta tardia da LISTA é descartada", async () => {
    // Como duas cargas da lista se sobrepõem de verdade: o componente pai
    // re-renderiza passando um `onSessaoAtualEncerrada` com identidade nova
    // (uma arrow inline, o caso comum). Isso refaz `tratarErroSessao` →
    // `carregarLista` → o efeito dispara uma segunda carga enquanto a
    // primeira ainda está em voo. Nenhum truque: é o que acontece quando o
    // shell re-renderiza.
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    const dObsoleta = deferred<unknown>();
    const dAtual = deferred<unknown>();
    // A PRIMEIRA chamada é a que vai ficar obsoleta; todas as seguintes
    // recebem a promessa "atual". A contagem exata não importa — e não deve
    // importar: o rerender também refaz o carregador do ator, o que pode
    // disparar mais de uma recarga. O que o teste prende é que houve
    // sobreposição e que a resposta vencida não escreve estado.
    vi.mocked(listarEquipe)
      .mockReturnValueOnce(dObsoleta.promise as never)
      .mockReturnValue(dAtual.promise as never);

    const { rerender } = render(
      <EquipeScreen onSessaoAtualEncerrada={() => {}} />,
    );
    await screen.findByText(/Carregando sua equipe/);
    expect(vi.mocked(listarEquipe)).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(<EquipeScreen onSessaoAtualEncerrada={() => {}} />);
      await new Promise((r) => setTimeout(r, 0));
    });
    // Houve uma segunda carga enquanto a primeira continuava em voo.
    expect(vi.mocked(listarEquipe).mock.calls.length).toBeGreaterThanOrEqual(2);

    await resolverECommitar(() =>
      dAtual.resolve({
        dataReferencia: "2026-10-08",
        itens: [membro({ nome: "RESPOSTA ATUAL" })],
      }),
    );
    expect(await screen.findByText("RESPOSTA ATUAL")).toBeInTheDocument();

    // A primeira resposta chega atrasada. Não pode sobrescrever dados, nem
    // data de referência, nem voltar a tela para "carregando".
    await resolverECommitar(() =>
      dObsoleta.resolve({
        dataReferencia: "1999-01-01",
        itens: [membro({ vinculoId: "v-velho", nome: "RESPOSTA OBSOLETA" })],
      }),
    );

    expect(screen.getByText("RESPOSTA ATUAL")).toBeInTheDocument();
    expect(screen.queryByText("RESPOSTA OBSOLETA")).not.toBeInTheDocument();
    expect(screen.queryByText("1999-01-01")).not.toBeInTheDocument();
    expect(screen.queryByText(/Carregando sua equipe/)).not.toBeInTheDocument();
  });

  it("T153.15 resposta tardia do DETALHE é descartada após trocar de vínculo", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [
        membro({ vinculoId: "v-A", nome: "Pessoa A" }),
        membro({ vinculoId: "v-B", nome: "Pessoa B" }),
      ],
    } as never);

    const dA = deferred<unknown>();
    const dB = deferred<unknown>();
    vi.mocked(detalharVinculo)
      .mockReturnValueOnce(dA.promise as never)
      .mockReturnValueOnce(dB.promise as never);

    render(<EquipeScreen />);
    await screen.findByText("Pessoa A");

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhe de Pessoa A" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhe de Pessoa B" }),
    );

    await resolverECommitar(() =>
      dB.resolve(
        detalhe({ vinculoId: "v-B", nome: "Pessoa B", matricula: "MAT-B" }),
      ),
    );
    expect(await screen.findByText("MAT-B")).toBeInTheDocument();

    // A resposta de A chega atrasada. Este é o risco real: o dado de uma
    // pessoa aparecer sob o nome de outra.
    await resolverECommitar(() =>
      dA.resolve(
        detalhe({ vinculoId: "v-A", nome: "Pessoa A", matricula: "MAT-A" }),
      ),
    );

    expect(screen.getByText("MAT-B")).toBeInTheDocument();
    expect(screen.queryByText("MAT-A")).not.toBeInTheDocument();
  });

  it("T153.16 nova tentativa do MESMO vínculo mantém só a resposta mais recente", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro({ vinculoId: "v-A", nome: "Pessoa A" })],
    } as never);

    const dPrimeira = deferred<unknown>();
    const dSegunda = deferred<unknown>();
    vi.mocked(detalharVinculo)
      .mockReturnValueOnce(dPrimeira.promise as never)
      .mockReturnValueOnce(dSegunda.promise as never);

    render(<EquipeScreen />);
    await screen.findByText("Pessoa A");

    const acionador = screen.getByRole("button", {
      name: "Ver detalhe de Pessoa A",
    });
    fireEvent.click(acionador);
    // Segunda consulta do MESMO vínculo com a primeira ainda em voo.
    fireEvent.click(acionador);
    expect(vi.mocked(detalharVinculo)).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(detalharVinculo).mock.calls.every(([id]) => id === "v-A"),
    ).toBe(true);

    await resolverECommitar(() =>
      dSegunda.resolve(detalhe({ matricula: "MAT-RECENTE" })),
    );
    const dialogo = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialogo).getByText("MAT-RECENTE")).toBeInTheDocument(),
    );

    await resolverECommitar(() =>
      dPrimeira.resolve(detalhe({ matricula: "MAT-ANTIGA" })),
    );

    expect(within(dialogo).getByText("MAT-RECENTE")).toBeInTheDocument();
    expect(within(dialogo).queryByText("MAT-ANTIGA")).not.toBeInTheDocument();
  });

  it("T153.17 fechar o detalhe invalida a resposta pendente", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro({ vinculoId: "v-A", nome: "Pessoa A" })],
    } as never);

    const dA = deferred<unknown>();
    vi.mocked(detalharVinculo).mockReturnValueOnce(dA.promise as never);

    render(<EquipeScreen />);
    await screen.findByText("Pessoa A");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhe de Pessoa A" }),
    );
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // A resposta chega depois de fechado: não pode reabrir nem escrever.
    await resolverECommitar(() =>
      dA.resolve(detalhe({ matricula: "MAT-TARDIA" })),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("MAT-TARDIA")).not.toBeInTheDocument();
  });

  it("T153.18 fim de sessão (401) limpa os dados e avisa o shell", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    const dLista = deferred<unknown>();
    vi.mocked(listarEquipe).mockReturnValueOnce(dLista.promise as never);
    const onSessaoAtualEncerrada = vi.fn();

    render(<EquipeScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />);
    await screen.findByText(/Carregando sua equipe/);

    await resolverECommitar(() =>
      dLista.reject(new ApiError(401, "nao autorizado")),
    );

    expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Pessoa Demo Alfa Turno A")).toBeNull();
    // 401 não é "erro de carregamento": a tela não oferece "Tentar novamente"
    // para uma sessão que acabou.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("T153.19 resposta anterior ao 401 não ressuscita dados da sessão encerrada", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    const dLista = deferred<unknown>();
    const dDetalhe = deferred<unknown>();
    vi.mocked(listarEquipe)
      .mockResolvedValueOnce({
        dataReferencia: "2026-10-08",
        itens: [membro({ vinculoId: "v-A", nome: "Pessoa A" })],
      } as never)
      .mockReturnValueOnce(dLista.promise as never);
    vi.mocked(detalharVinculo).mockReturnValueOnce(dDetalhe.promise as never);
    const onSessaoAtualEncerrada = vi.fn();

    render(<EquipeScreen onSessaoAtualEncerrada={onSessaoAtualEncerrada} />);
    await screen.findByText("Pessoa A");

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhe de Pessoa A" }),
    );
    // O detalhe ainda está em voo quando a sessão cai por outra via.
    await resolverECommitar(() =>
      dDetalhe.reject(new ApiError(401, "nao autorizado")),
    );
    expect(onSessaoAtualEncerrada).toHaveBeenCalled();

    // Uma resposta de lista da sessão ANTIGA chega depois do 401.
    await resolverECommitar(() =>
      dLista.resolve({
        dataReferencia: "2026-10-08",
        itens: [membro({ nome: "DADO DA SESSAO ANTIGA" })],
      }),
    );
    expect(screen.queryByText("DADO DA SESSAO ANTIGA")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 13 — teclado e foco. 14 — contrato anti-overflow.
// ---------------------------------------------------------------------------

describe("acessibilidade", () => {
  it("T153.20 Escape fecha o modal e o foco volta a quem abriu", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro({ vinculoId: "v-A", nome: "Pessoa A" })],
    } as never);
    vi.mocked(detalharVinculo).mockResolvedValue(detalhe());

    render(<EquipeScreen />);
    await screen.findByText("Pessoa A");

    const acionador = screen.getByRole("button", {
      name: "Ver detalhe de Pessoa A",
    });
    acionador.focus();
    expect(document.activeElement).toBe(acionador);

    fireEvent.click(acionador);
    const dialogo = await screen.findByRole("dialog");

    // Foco inicial no título da janela, não no fundo.
    await waitFor(() =>
      expect(dialogo.contains(document.activeElement)).toBe(true),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Devolução do foco: sem isso, quem navega por teclado é jogado ao início
    // do documento a cada consulta.
    expect(document.activeElement).toBe(acionador);
  });

  it("T153.21 o modal é um diálogo nomeado pelo título", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro({ vinculoId: "v-A", nome: "Pessoa A" })],
    } as never);
    vi.mocked(detalharVinculo).mockResolvedValue(detalhe());

    render(<EquipeScreen />);
    await screen.findByText("Pessoa A");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhe de Pessoa A" }),
    );

    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    const rotuloId = dialogo.getAttribute("aria-labelledby");
    expect(rotuloId).toBeTruthy();
    expect(document.getElementById(rotuloId!)?.textContent).toBe("Pessoa A");
  });

  it("T153.22 a tabela rola por dentro, em região focável rotulada", async () => {
    vi.mocked(obterUsuarioAtual).mockResolvedValue(ator("gestor") as never);
    vi.mocked(listarEquipe).mockResolvedValue({
      dataReferencia: "2026-10-08",
      itens: [membro()],
    } as never);

    render(<EquipeScreen />);
    await screen.findByText("Pessoa Demo Alfa Turno A");

    // Semântica, não geometria: jsdom roda com `css: false` e não mede nada.
    const regiao = screen.getByRole("region", {
      name: /Colaboradores sob sua gestão/,
    });
    expect(regiao).toHaveAttribute("tabindex", "0");
  });

  it("T153.24 os rótulos cobrem os enums REAIS do schema, sem inventar valor", () => {
    // Regressão da validação visual: a primeira versão mapeava `efetivo`,
    // `afastado` e `desligado` — nenhum deles existe. O resultado foi a tela
    // mostrando o enum cru "clt". Enum do schema:
    //   SituacaoVinculo = previsto | ativo | encerrado
    //   TipoVinculo     = clt | estagio | pj | temporario | outro_controlado
    const fonte = readFileSync("src/screens/equipe/EquipeScreen.tsx", "utf8");
    const bloco = (nome: string) =>
      fonte.slice(
        fonte.indexOf(nome),
        fonte.indexOf("};", fonte.indexOf(nome)),
      );

    const situacao = bloco("const ROTULO_SITUACAO");
    for (const v of ["previsto", "ativo", "encerrado"]) {
      expect(situacao).toContain(`${v}:`);
    }
    // E nada além deles: valor inventado vira rótulo que nunca aparece.
    for (const v of ["afastado", "desligado", "suspenso"]) {
      expect(situacao).not.toContain(`${v}:`);
    }

    const tipo = bloco("const ROTULO_TIPO");
    for (const v of [
      "clt",
      "estagio",
      "pj",
      "temporario",
      "outro_controlado",
    ]) {
      expect(tipo).toContain(`${v}:`);
    }
    for (const v of ["efetivo", "aprendiz"]) {
      expect(tipo).not.toContain(`${v}:`);
    }
  });

  it("T153.23 o CSS mantém o contrato que impede overflow da página em 375 px", () => {
    // Teste de CONTRATO, no mesmo espírito do teste de workflow da T152: o
    // runner não mede largura, mas pode exigir que o mecanismo que de fato
    // impede o vazamento esteja presente. Remover `min-width: 0` dos filhos
    // diretos é exatamente o que faz a tabela empurrar a página inteira.
    const css = readFileSync("src/screens/equipe/EquipeScreen.css", "utf8");
    expect(css).toMatch(/\.equipe-screen\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.equipe-screen\s*>\s*\*\s*\{[^}]*min-width:\s*0/);
    // A armadilha já documentada: `.sr-only` absoluto dentro da tabela escapa
    // do `overflow-x: auto` sem um contêiner posicionado.
    expect(css).toMatch(
      /\.equipe-screen\s+\.evolli-datatable\s*\{[^}]*position:\s*relative/,
    );
  });
});
