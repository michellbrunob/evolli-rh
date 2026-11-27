/**
 * T215 — Políticas de férias (como a referência, 2026-11-26): a lista, quem
 * fica sem política, desativar e reativar, e o assistente de 6 etapas
 * (criar, editar, duplicar). Dados sintéticos; o servidor é simulado.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ListaDePoliticasApi,
  PoliticaFeriasApi,
} from "../../../../api/politicasFeriasClient";
import { ApiError } from "../../../../api/colaboradoresClient";
import { PoliticasFeriasScreen } from "./PoliticasFeriasScreen";
import type { ServicoDePoliticas } from "./servicoDePoliticas";

const REGRAS = {
  antecedenciaMinimaDias: 30,
  antecedenciaMaximaMeses: null,
  alemDoSaldo: "nao_aceitar" as const,
  duracaoMinimaDias: 10,
  duracaoMaximaDias: 20,
  periodosPorAno: 2,
  periodoMaiorDias: null,
  intervaloDias: null,
  inicioNaoAntesDeDescanso: false,
  inicioNaoNoFimDeSemana: false,
  voltaNaoNaSexta: true,
  voltaNaoNaVespera: false,
  bloqueios: [
    {
      nome: "Fechamento",
      inicio: "2026-12-20",
      fim: "2026-12-31",
      todoAno: true,
    },
  ],
  foraAoMesmoTempo: null,
};

const POLITICA: PoliticaFeriasApi = {
  id: "p-1",
  nome: "Time do escritório",
  descricao: null,
  textoColaborador: null,
  tiposVinculo: ["clt"],
  abrangencia: "algumas",
  alvos: [{ tipo: "pessoa", id: "c-1", nome: "Pedro Teste" }],
  valeAPartirDe: "2026-11-26",
  regras: REGRAS,
  aprovacao: { quem: "rh", lembreteDias: null, foraDaPolitica: "avisar" },
  rascunho: false,
  ativa: true,
};

const LISTA: ListaDePoliticasApi = {
  politicas: [
    {
      id: "p-1",
      nome: "Time do escritório",
      ativa: true,
      rascunho: false,
      tiposVinculo: ["clt"],
      abrangencia: "algumas",
      pessoas: 1,
      principaisRegras: {
        primeira: "Antecedência de 30 dias",
        segunda: "Até 2 períodos",
        mais: 4,
      },
      foraDaPolitica: "avisar",
    },
    {
      id: "p-2",
      nome: "Antiga",
      ativa: false,
      rascunho: false,
      tiposVinculo: ["clt", "estagio"],
      abrangencia: "todos",
      pessoas: 0,
      principaisRegras: {
        primeira: "Não aceita além do saldo",
        segunda: null,
        mais: 0,
      },
      foraDaPolitica: "bloquear",
    },
  ],
  semPolitica: {
    total: 5,
    pessoas: [
      { id: "c-2", nome: "Ana Teste Lima", contrato: "clt" },
      { id: "c-3", nome: "Bia Teste Souza", contrato: "estagio" },
      { id: "c-4", nome: "Caio Teste Reis", contrato: "pj" },
      { id: "c-5", nome: "Duda Teste Melo", contrato: "clt" },
      { id: "c-6", nome: "Eva Teste Dias", contrato: "aprendiz" },
    ],
  },
};

function servico(lista: ListaDePoliticasApi = LISTA) {
  return {
    listar: vi.fn(async () => lista),
    obter: vi.fn(async () => POLITICA),
    criar: vi.fn(async () => POLITICA),
    alterar: vi.fn(async () => POLITICA),
    desativar: vi.fn(async () => POLITICA),
    reativar: vi.fn(async () => POLITICA),
    opcoesDeAlvo: vi.fn(async () => [
      { id: "c-1", nome: "Pedro Teste" },
      { id: "c-2", nome: "Ana Teste Lima" },
    ]),
  } satisfies ServicoDePoliticas;
}

function montar(s = servico(), podeEditar = true) {
  const onVoltar = vi.fn();
  render(
    <PoliticasFeriasScreen
      servico={s}
      podeEditar={podeEditar}
      onVoltar={onVoltar}
    />,
  );
  return { s, onVoltar };
}

const abrirMenu = (nome: string) =>
  fireEvent.pointerDown(
    screen.getByRole("button", { name: `Ações da política ${nome}` }),
    {
      button: 0,
      ctrlKey: false,
      pointerType: "mouse",
    },
  );

describe("PoliticasFeriasScreen (T215) — lista", () => {
  it("cabeçalho, quem fica sem política e a tabela, como a referência", async () => {
    const { onVoltar } = montar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Políticas de férias" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "O Evolli confere estas regras em cada registro de férias do RH.",
      ),
    ).toBeInTheDocument();
    const faixa = await screen.findByRole("region", {
      name: "Pessoas sem política de férias",
    });
    expect(
      within(faixa).getByText("5 pessoas sem política de férias"),
    ).toBeInTheDocument();
    expect(
      within(faixa).getByText(
        "Ana Teste Lima, Bia Teste Souza, Caio Teste Reis e mais 2 não entram em nenhuma política. Para quem é CLT, valem só os pisos da lei, como aviso.",
      ),
    ).toBeInTheDocument();
    const tabela = screen.getByRole("table", { name: "Políticas de férias" });
    expect(
      within(tabela)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual([
      "Política",
      "Vale para",
      "Principais regras",
      "Quando não seguir",
      "Ações",
    ]);
    const [, ativa, inativa] = within(tabela).getAllByRole("row");
    expect(ativa).toHaveTextContent("Time do escritório");
    expect(ativa).toHaveTextContent("CLT");
    expect(ativa).toHaveTextContent("Algumas pessoas · 1 pessoa");
    expect(ativa).toHaveTextContent("Antecedência de 30 dias");
    expect(ativa).toHaveTextContent("Até 2 períodos · e mais 4");
    expect(ativa).toHaveTextContent("Avisa e deixa enviar");
    expect(ativa).toHaveTextContent("Quando o Portal existir");
    expect(inativa).toHaveTextContent("Inativa");
    expect(inativa).toHaveTextContent("CLT, Estágio");
    expect(inativa).toHaveTextContent("Todas as pessoas · 0 pessoas");
    expect(inativa).toHaveTextContent("Não deixa enviar");
    expect(screen.getByText("2 políticas")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar para Férias e ausências" }),
    );
    expect(onVoltar).toHaveBeenCalled();
  });

  it("Ver pessoas: quem fica sem política, com o contrato", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Ver pessoas" }));
    const janela = screen.getByRole("dialog", {
      name: "Pessoas sem política de férias",
    });
    expect(
      within(janela)
        .getAllByRole("listitem")
        .map((l) => l.textContent),
    ).toEqual([
      "ALAna Teste LimaCLT",
      "BSBia Teste SouzaEstágio",
      "CRCaio Teste ReisPJ",
      "DMDuda Teste MeloCLT",
      "EDEva Teste DiasAprendiz",
    ]);
  });

  it("⋯: Editar, Duplicar e Desativar; desativar confirma e relê", async () => {
    const { s } = montar();
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Time do escritório");
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Editar", "Duplicar", "Desativar"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Desativar" }));
    const janela = screen.getByRole("dialog", {
      name: "Desativar a política Time do escritório?",
    });
    expect(janela).toHaveTextContent(
      "1 pessoa fica sem política de férias, e os pedidos novos não passam mais por estas regras. Nada é apagado: dá para reativar depois.",
    );
    await act(async () => {
      fireEvent.click(
        within(janela).getByRole("button", { name: "Desativar" }),
      );
    });
    expect(s.desativar).toHaveBeenCalledWith("p-1");
    expect(await screen.findByText("Política desativada.")).toBeInTheDocument();
    expect(s.listar).toHaveBeenCalledTimes(2);
  });

  it("inativa: Reativar", async () => {
    const { s } = montar();
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Antiga");
    const menu = await screen.findByRole("menu");
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem", { name: "Reativar" }));
    });
    expect(s.reativar).toHaveBeenCalledWith("p-2");
    expect(await screen.findByText("Política reativada.")).toBeInTheDocument();
  });

  it("vazio e sem permissão", async () => {
    montar(
      servico({ politicas: [], semPolitica: { total: 0, pessoas: [] } }),
      false,
    );
    expect(
      await screen.findByText("Nenhuma política de férias"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Crie a primeira para o sistema conferir os pedidos."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova política/ })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Pessoas sem política de férias" }),
    ).toBeNull();
  });
});

describe("PoliticasFeriasScreen (T215) — assistente", () => {
  const proxima = () =>
    fireEvent.click(screen.getByRole("button", { name: /Próxima etapa/ }));

  it("nova: as 6 etapas, a revisão e salvar política", async () => {
    const { s } = montar();
    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Nova política/ }))[0]!,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Nova política de férias",
      }),
    ).toBeInTheDocument();
    // Sem nome e sem contrato não avança.
    proxima();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Preencha o nome, escolha ao menos um contrato e diga quem entra.",
    );
    fireEvent.change(screen.getByLabelText("Nome da política"), {
      target: { value: "  Escritório  " },
    });
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Tipo de contrato" }),
      ).getByLabelText("CLT"),
    );
    proxima();
    expect(
      screen.getByText(
        "Esta política é só para CLT, então esta etapa não se aplica: o direito segue a lei, 30 dias a cada 12 meses, menos as faltas sem justificativa (art. 130). Siga para a próxima etapa.",
      ),
    ).toBeVisible();
    proxima();
    // O servidor nunca registra férias além do saldo: não há o que escolher.
    expect(
      screen.queryByRole("radio", { name: /Aceitar, e quem aprova decide/ }),
    ).toBeNull();
    expect(
      screen.getByText(
        "Não aceita. O Evolli não registra férias além do saldo do período (CLT).",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Antecedência mínima em dias"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Períodos por ano"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Duração mínima em dias"), {
      target: { value: "5" },
    });
    proxima();
    fireEvent.click(screen.getByLabelText("Em sexta-feira"));
    proxima();
    // Aprovação pelo gestor depende do Portal: aparece, mas não se escolhe.
    const gestor = screen.getByRole("radio", { name: /^Só o gestor direto/ });
    expect(gestor).toBeDisabled();
    expect(gestor).toHaveTextContent("Quando o Portal existir.");
    fireEvent.click(gestor);
    // Lembrete: nada o usa hoje, não aparece.
    expect(screen.queryByText(/Lembrete/)).toBeNull();
    expect(
      screen.getByText(
        "Vale para os pedidos do colaborador, quando o Portal existir. Hoje, o RH registra com motivo.",
      ),
    ).toBeInTheDocument();
    proxima();
    const revisao = screen.getByRole("region", { name: "Pedido e períodos" });
    expect(revisao).toHaveTextContent(
      "Pedido além do saldoNão aceita (a CLT não deixa)",
    );
    expect(
      screen.getByRole("region", { name: "Aprovação" }),
    ).not.toHaveTextContent("Lembrete");
    expect(revisao).toHaveTextContent("30 dias, no mínimo");
    expect(revisao).toHaveTextContent("Duração de cada período5 dias ou mais");
    expect(revisao).toHaveTextContent("até 2 períodos por ano");
    expect(
      screen.getByRole("region", { name: "Datas e equipe" }),
    ).toHaveTextContent("Em sexta-feira");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    });
    expect(s.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Escritório",
        tiposVinculo: ["clt"],
        abrangencia: "todos",
        alvos: [],
        rascunho: false,
        regras: expect.objectContaining({
          antecedenciaMinimaDias: 30,
          periodosPorAno: 2,
          voltaNaoNaSexta: true,
        }),
        aprovacao: expect.objectContaining({ quem: "rh" }),
      }),
    );
    expect(await screen.findByText("Política salva.")).toBeInTheDocument();
  });

  it("só algumas pessoas: escolhe e adiciona; salvar rascunho", async () => {
    const { s } = montar();
    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Nova política/ }))[0]!,
    );
    fireEvent.change(screen.getByLabelText("Nome da política"), {
      target: { value: "Só Pedro" },
    });
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Tipo de contrato" }),
      ).getByLabelText("CLT"),
    );
    fireEvent.click(screen.getByRole("radio", { name: /^Só algumas pessoas/ }));
    fireEvent.click(screen.getByRole("combobox", { name: "Por" }));
    fireEvent.click(screen.getByRole("option", { name: "Por: Pessoa" }));
    await waitFor(() =>
      expect(s.opcoesDeAlvo).toHaveBeenLastCalledWith("pessoa"),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Escolha" }));
    fireEvent.click(await screen.findByRole("option", { name: "Pedro Teste" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(
      within(screen.getByRole("list", { name: "Quem entra" })).getByText(
        "Pessoa: Pedro Teste",
      ),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    });
    expect(s.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        abrangencia: "algumas",
        alvos: [{ tipo: "pessoa", id: "c-1" }],
        rascunho: true,
      }),
    );
    expect(await screen.findByText("Rascunho salvo.")).toBeInTheDocument();
  });

  it("editar abre preenchido e altera; duplicar cria a cópia", async () => {
    const { s } = montar();
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Time do escritório");
    await act(async () => {
      fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    });
    expect(s.obter).toHaveBeenCalledWith("p-1");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Editar política de férias",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da política")).toHaveValue(
      "Time do escritório",
    );
    // Na edição, dá para ir direto à revisão.
    fireEvent.click(screen.getByRole("button", { name: /Etapa 6: Revisão/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    });
    expect(s.alterar).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({ nome: "Time do escritório" }),
    );
    // Duplicar.
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Time do escritório");
    await act(async () => {
      fireEvent.click(
        await screen.findByRole("menuitem", { name: "Duplicar" }),
      );
    });
    expect(screen.getByLabelText("Nome da política")).toHaveValue(
      "Time do escritório (cópia)",
    );
    fireEvent.click(screen.getByRole("button", { name: /Etapa 6: Revisão/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    });
    expect(s.criar).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Time do escritório (cópia)" }),
    );
  });

  it.each([
    [
      { campo: "regras.bloqueios", motivo: "fim_antes_do_inicio" },
      "Um período bloqueado termina antes de começar. Confira as datas ou marque Todo ano.",
    ],
    [
      { campo: "regras.duracaoMaximaDias", motivo: "fora_de_ordem" },
      "A duração mínima de cada período passa da máxima.",
    ],
    [
      { campo: "alvos", motivo: "indisponivel" },
      "Algum departamento, unidade ou pessoa não é desta empresa. Escolha de novo.",
    ],
  ])("recusa do servidor ao salvar: %o", async (erro, texto) => {
    const s = servico();
    s.alterar.mockRejectedValueOnce(new ApiError(422, "x", { erros: [erro] }));
    montar(s);
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Time do escritório");
    await act(async () => {
      fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    });
    fireEvent.click(screen.getByRole("button", { name: /Etapa 6: Revisão/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(texto);
  });

  it("política antiga com 'aceitar além do saldo' grava o que o sistema cumpre", async () => {
    const s = servico();
    s.obter.mockResolvedValueOnce({
      ...POLITICA,
      regras: { ...REGRAS, alemDoSaldo: "aceitar" as const },
    });
    montar(s);
    await screen.findByRole("table", { name: "Políticas de férias" });
    abrirMenu("Time do escritório");
    await act(async () => {
      fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    });
    fireEvent.click(screen.getByRole("button", { name: /Etapa 6: Revisão/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar política" }));
    });
    expect(s.alterar).toHaveBeenCalledWith(
      "p-1",
      expect.objectContaining({
        regras: expect.objectContaining({ alemDoSaldo: "nao_aceitar" }),
      }),
    );
  });
});
