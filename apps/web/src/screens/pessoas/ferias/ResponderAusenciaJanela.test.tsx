/**
 * T215 — "Responder solicitação" (como a referência, 2026-11-26): aprovar
 * (mensagem opcional), sugerir outras datas (o novo período, diferente do
 * pedido) ou recusar (motivo obrigatório). Dados sintéticos.
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
import { ApiError } from "../../../api/colaboradoresClient";
import { ResponderAusenciaJanela } from "./ResponderAusenciaJanela";
import type { AusenciaApi, ServicoDeAusencias } from "./tiposAusencia";

const AUSENCIA: AusenciaApi = {
  id: "a-1",
  colaborador: {
    id: "11111111-1111-4111-8111-111111111111",
    nome: "Pedro Teste Lima",
    cargo: "Analista",
    foto: null,
  },
  tipo: "day_off",
  motivoAfastamento: null,
  inicio: "2026-11-30",
  fim: "2026-11-30",
  dias: 1,
  diasUteis: 1,
  diasVendidos: 0,
  periodoAquisitivo: null,
  status: "aguardando_rh",
  observacao: null,
  registradoEm: "2026-11-26T12:00:00.000Z",
  decididoEm: null,
};

function servico() {
  return {
    simular: vi.fn(async (c: { inicio: string; fim?: string }) => ({
      dias: 1,
      diasUteis: 1,
      volta: c.inicio === "2026-12-01" ? "2026-12-02" : "2026-12-01",
      periodo: null,
      saldoAntes: null,
      saldoDepois: null,
      maxVendaveis: null,
      prazoAbono: null,
      regraDeFerias: "calculada" as const,
    })),
    aprovar: vi.fn(async () => ({ ...AUSENCIA, status: "aprovada" as const })),
    recusar: vi.fn(async () => ({ ...AUSENCIA, status: "recusada" as const })),
    sugerir: vi.fn(async () => ({
      ...AUSENCIA,
      status: "ajuste_sugerido" as const,
    })),
  };
}

function montar(s = servico()) {
  const onFechar = vi.fn();
  const onRespondida = vi.fn();
  render(
    <ResponderAusenciaJanela
      ausencia={AUSENCIA}
      servico={s as unknown as ServicoDeAusencias}
      onFechar={onFechar}
      onRespondida={onRespondida}
    />,
  );
  return { s, onFechar, onRespondida };
}

const janela = () =>
  screen.getByRole("dialog", { name: "Responder solicitação" });
const botao = (nome: string) =>
  within(janela()).getByRole("button", { name: nome });

describe("ResponderAusenciaJanela (T215)", () => {
  it("o pedido: quando foi registrado, a data, o tipo, os dias e a volta", async () => {
    montar();
    expect(
      within(janela()).getByText("Registrada pelo RH em 26/11/2026"),
    ).toBeInTheDocument();
    expect(
      within(janela()).getByText("Day off aniversário"),
    ).toBeInTheDocument();
    expect(
      within(janela()).getByText("1 dia · 1 dia útil"),
    ).toBeInTheDocument();
    expect(
      await within(janela()).findByText("Volta em 01/12/2026"),
    ).toBeInTheDocument();
    const opcoes = within(janela()).getAllByRole("radio");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "AprovarO período entra no calendário.",
      "Sugerir outras datasO pedido fica em ajuste sugerido até você editar as datas ou recusar.",
      "RecusarInforme o motivo. Ele fica registrado na ausência.",
    ]);
    expect(opcoes[0]).toHaveAttribute("aria-checked", "true");
  });

  it("aprovar: mensagem opcional, aprova e avisa", async () => {
    const { s, onRespondida } = montar();
    fireEvent.change(within(janela()).getByLabelText("Mensagem"), {
      target: { value: "  Boa folga!  " },
    });
    await act(async () => {
      fireEvent.click(botao("Aprovar pedido"));
    });
    expect(s.aprovar).toHaveBeenCalledWith("a-1", "Boa folga!");
    expect(onRespondida).toHaveBeenCalledWith("Ausência aprovada.");
  });

  it("aprovar sem mensagem não envia texto vazio", async () => {
    const { s } = montar();
    await act(async () => {
      fireEvent.click(botao("Aprovar pedido"));
    });
    expect(s.aprovar).toHaveBeenCalledWith("a-1", undefined);
  });

  it("recusar: o motivo é obrigatório", async () => {
    const { s, onRespondida } = montar();
    fireEvent.click(within(janela()).getByRole("radio", { name: /^Recusar/ }));
    expect(
      within(janela()).getByText("O motivo fica registrado na ausência."),
    ).toBeInTheDocument();
    expect(botao("Recusar pedido")).toBeDisabled();
    const motivo = within(janela()).getByLabelText("Motivo da recusa");
    fireEvent.change(motivo, { target: { value: "   " } });
    expect(botao("Recusar pedido")).toBeDisabled();
    fireEvent.change(motivo, { target: { value: " Equipe desfalcada " } });
    await act(async () => {
      fireEvent.click(botao("Recusar pedido"));
    });
    expect(s.recusar).toHaveBeenCalledWith("a-1", "Equipe desfalcada");
    expect(onRespondida).toHaveBeenCalledWith("Ausência recusada.");
  });

  it("sugerir: começa nas datas pedidas, exige outras e diz o deslocamento", async () => {
    const { s, onRespondida } = montar();
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /^Sugerir outras datas/ }),
    );
    const primeiro = within(janela()).getByLabelText("Primeiro dia");
    const ultimo = within(janela()).getByLabelText("Último dia");
    expect(primeiro).toHaveValue("2026-11-30");
    expect(ultimo).toHaveValue("2026-11-30");
    expect(
      within(janela()).getByText(
        "Escolha datas diferentes das que foram pedidas.",
      ),
    ).toBeInTheDocument();
    expect(botao("Enviar sugestão")).toBeDisabled();
    fireEvent.change(primeiro, { target: { value: "2026-12-01" } });
    fireEvent.change(ultimo, { target: { value: "2026-12-01" } });
    expect(
      await within(janela()).findByText("1 dia (1 dia útil) · um dia depois"),
    ).toBeInTheDocument();
    expect(
      await within(janela()).findByText("Volta ao trabalho em 02/12/2026"),
    ).toBeInTheDocument();
    expect(
      within(janela()).getByText(
        "A sugestão fica registrada. Pedro poderá aceitar ou pedir outra data quando o Portal existir.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(within(janela()).getByLabelText("Por que outras datas?"), {
      target: { value: "Dia seguinte" },
    });
    await act(async () => {
      fireEvent.click(botao("Enviar sugestão"));
    });
    expect(s.sugerir).toHaveBeenCalledWith("a-1", {
      inicio: "2026-12-01",
      fim: "2026-12-01",
      mensagem: "Dia seguinte",
    });
    expect(onRespondida).toHaveBeenCalledWith("Sugestão enviada.");
  });

  it("deslocamento: dias antes e vários dias depois", async () => {
    montar();
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /^Sugerir outras datas/ }),
    );
    fireEvent.change(within(janela()).getByLabelText("Primeiro dia"), {
      target: { value: "2026-11-27" },
    });
    fireEvent.change(within(janela()).getByLabelText("Último dia"), {
      target: { value: "2026-11-27" },
    });
    expect(
      await within(janela()).findByText("1 dia (1 dia útil) · 3 dias antes"),
    ).toBeInTheDocument();
    fireEvent.change(within(janela()).getByLabelText("Primeiro dia"), {
      target: { value: "2026-12-04" },
    });
    fireEvent.change(within(janela()).getByLabelText("Último dia"), {
      target: { value: "2026-12-04" },
    });
    expect(
      await within(janela()).findByText("1 dia (1 dia útil) · 4 dias depois"),
    ).toBeInTheDocument();
  });

  it("recusa do servidor: o motivo aparece e a janela fica", async () => {
    const s = servico();
    s.sugerir.mockRejectedValueOnce(
      new ApiError(409, "x", {
        erros: [{ campo: "inicio", motivo: "sobreposicao" }],
      }),
    );
    const { onRespondida } = montar(s);
    fireEvent.click(
      within(janela()).getByRole("radio", { name: /^Sugerir outras datas/ }),
    );
    fireEvent.change(within(janela()).getByLabelText("Primeiro dia"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(within(janela()).getByLabelText("Último dia"), {
      target: { value: "2026-12-01" },
    });
    await waitFor(() => expect(botao("Enviar sugestão")).toBeEnabled());
    await act(async () => {
      fireEvent.click(botao("Enviar sugestão"));
    });
    expect(within(janela()).getByRole("alert")).toHaveTextContent(
      "Já existe uma ausência de Pedro nessas datas.",
    );
    expect(onRespondida).not.toHaveBeenCalled();
  });

  it("ajuste sugerido: só recusar, e a janela diz por quê", async () => {
    const s = servico();
    render(
      <ResponderAusenciaJanela
        ausencia={{
          ...AUSENCIA,
          status: "ajuste_sugerido",
          sugestao: { inicio: "2026-12-01", fim: "2026-12-01" },
        }}
        servico={s as unknown as ServicoDeAusencias}
        onFechar={vi.fn()}
        onRespondida={vi.fn()}
      />,
    );
    expect(within(janela()).getByRole("note")).toHaveTextContent(
      "Você sugeriu 01/12/2026. Sem o Portal, Pedro ainda não responde à sugestão: para ficar com as novas datas, edite a ausência; para encerrar o pedido, recuse.",
    );
    const opcoes = within(janela()).getAllByRole("radio");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "RecusarInforme o motivo. Ele fica registrado na ausência.",
    ]);
    expect(opcoes[0]).toHaveAttribute("aria-checked", "true");
    expect(
      within(janela()).queryByRole("button", { name: "Aprovar pedido" }),
    ).toBeNull();
  });

  it("aprovar recusado pelo servidor (ajuste sugerido): o motivo aparece", async () => {
    const s = servico();
    s.aprovar.mockRejectedValueOnce(
      new ApiError(422, "x", {
        erros: [{ campo: "sugestao", motivo: "aguardando_resposta" }],
      }),
    );
    montar(s);
    await act(async () => {
      fireEvent.click(botao("Aprovar pedido"));
    });
    expect(within(janela()).getByRole("alert")).toHaveTextContent(
      "A sugestão de outras datas ainda espera a resposta de Pedro. Edite as datas ou recuse o pedido.",
    );
  });
});
