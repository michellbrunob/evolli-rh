import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consultarQuadro,
  type DiaGravadoApi,
  type PessoaDoQuadroApi,
} from "../../../api/escalaClient";
import { DialogoExportar } from "./DialogoExportar";
import { escala, pessoa } from "./fixturasDoQuadro";

vi.mock("../../../api/escalaClient", async (original) => ({
  ...(await original<typeof import("../../../api/escalaClient")>()),
  consultarQuadro: vi.fn(),
}));

function publicado(
  d: string,
  extra: Partial<DiaGravadoApi> = {},
): DiaGravadoApi {
  return {
    dia: d,
    camada: "publicado",
    tipo: "trabalho",
    turno: { id: "t-c", nome: "Comercial", cor: "azul", sigla: "C" },
    periodos: [{ inicio: "09:00", fim: "18:00" }],
    intervaloMinutos: 60,
    sobreaviso: [],
    unidade: null,
    observacao: null,
    ...extra,
  };
}

const ANA = pessoa("Ana Lima", {
  colaboradorId: "c-ana",
  departamento: { id: "d1", nome: "Loja" },
  escalas: [escala()],
  dias: [
    publicado("2026-11-23"),
    publicado("2026-11-24", { camada: "rascunho" }),
  ],
});
const BRUNO = pessoa("Bruno Reis", {
  colaboradorId: "c-bruno",
  departamento: { id: "d2", nome: "Estoque" },
  escalas: [escala()],
});
let pessoas: PessoaDoQuadroApi[] = [];
let comPublicacao = true;

beforeEach(() => {
  pessoas = [ANA, BRUNO];
  comPublicacao = true;
  vi.mocked(consultarQuadro)
    .mockReset()
    .mockImplementation(async (inicio, fim) => ({
      empresaId: "e",
      inicio,
      fim,
      pessoas: inicio === "2026-11-23" ? pessoas : [],
      publicacao: comPublicacao
        ? {
            id: "p",
            inicio,
            fim,
            novas: 1,
            alteradas: 0,
            pessoas: 1,
            avisar: false,
            publicadaEm: "2026-11-24T15:00:00.000Z",
            publicadaPor: "RH",
          }
        : null,
    }));
});

function montar(extra: Partial<Parameters<typeof DialogoExportar>[0]> = {}) {
  const onBaixar = vi.fn();
  const onFechar = vi.fn();
  render(
    <DialogoExportar
      visao="semana"
      ancora="2026-11-25"
      semanaComeca={1}
      doFiltro={[ANA, BRUNO]}
      regras={undefined}
      empresa="Empresa Sintética"
      podeIncluirAvisos={false}
      onFechar={onFechar}
      onBaixar={onBaixar}
      {...extra}
    />,
  );
  return { onBaixar, onFechar };
}

describe("T215 — diálogo Exportar escala", () => {
  it("PDF da semana do quadro: só o publicado, a nota do rascunho, a prévia e o arquivo", async () => {
    const { onBaixar, onFechar } = montar();
    expect(
      screen.getByRole("dialog", { name: "Exportar escala" }),
    ).toBeInTheDocument();
    expect(screen.getByText("23 a 29 de novembro de 2026")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Sai a versão publicada em 24/11/2026. A mudança do rascunho não entra.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 pessoas · 2 departamentos")).toBeInTheDocument();
    expect(screen.getByText("A4 deitado · 1 página")).toBeInTheDocument();
    expect(
      screen.getByText("Arquivo: escala-semana-2026-11-23.pdf"),
    ).toBeInTheDocument();
    expect(screen.getByText("· agrupar por departamento")).toBeInTheDocument();
    // Só o RH vê "Avisos da CLT".
    expect(screen.queryByLabelText("Avisos da CLT (só para o RH)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" }));
    expect(onBaixar).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "escala-semana-2026-11-23.pdf",
        tipo: "application/pdf",
      }),
    );
    expect(onFechar).toHaveBeenCalled();
  });

  it("planilha: as opções do PDF somem; a prévia mostra as linhas", async () => {
    const { onBaixar } = montar({ podeIncluirAvisos: true });
    await screen.findByText(/Sai a versão publicada/);
    fireEvent.click(screen.getByLabelText(/Planilha \(.xlsx\)/));
    expect(screen.queryByLabelText("Uma página por")).toBeNull();
    expect(screen.queryByLabelText("Legenda dos turnos")).toBeNull();
    expect(
      screen.getByLabelText("Avisos da CLT (só para o RH)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Primeiras linhas da planilha" }),
    ).toHaveTextContent("Ana LimaComercial 09:00–18:00");
    expect(screen.getByText("1 pessoa · 7 dias")).toBeInTheDocument();
    expect(
      screen.getByText("Planilha · abas Escala, Horas previstas"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Avisos da CLT (só para o RH)"));
    expect(
      screen.getByText(
        "Planilha · abas Escala, Horas previstas, Avisos da CLT",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Baixar planilha" }));
    expect(onBaixar.mock.calls[0]![0].nome).toBe(
      "escala-semana-2026-11-23.xlsx",
    );
  });

  it("sem publicação no período: avisa e não baixa; outro período recarrega", async () => {
    const { onBaixar } = montar();
    await screen.findByText(/Sai a versão publicada/);
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    expect(
      screen.getByText("30 de novembro a 6 de dezembro de 2026"),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(consultarQuadro).toHaveBeenLastCalledWith(
        "2026-11-30",
        "2026-12-06",
      ),
    );
    expect(
      await screen.findByText(
        "Nada publicado neste período. Só a escala publicada sai no arquivo.",
      ),
    ).toBeInTheDocument();
    const baixar = screen.getByRole("button", { name: "Baixar PDF" });
    expect(baixar).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(baixar);
    expect(onBaixar).not.toHaveBeenCalled();
    // Mês e dia.
    fireEvent.click(screen.getByRole("radio", { name: "Mês" }));
    expect(screen.getByText("Novembro de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Dia" }));
    expect(screen.getByText("30/11/2026")).toBeInTheDocument();
  });

  it("da barra da seleção: as selecionadas; 'cada uma' vem por pessoa em .zip; Escolher filtra", async () => {
    const { onBaixar } = montar({ selecionadas: ["c-ana"], cadaUma: true });
    await screen.findByText(/Sai a versão publicada/);
    expect(screen.getByLabelText("As 1 pessoa selecionada")).toBeChecked();
    expect(screen.getByText("1 pessoa · 1 departamento")).toBeInTheDocument();
    expect(screen.getByLabelText("Uma página por")).toHaveValue("pessoa");
    expect(
      screen.getByLabelText("Um PDF por pessoa, num arquivo .zip"),
    ).toBeChecked();
    expect(screen.getByText("A4 em pé · 1 PDF")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Baixar .zip" }));
    expect(onBaixar.mock.calls[0]![0]).toMatchObject({
      nome: "escala-semana-2026-11-23.zip",
      tipo: "application/zip",
    });
    // Outra separação: volta a ser um PDF só.
    fireEvent.change(screen.getByLabelText("Uma página por"), {
      target: { value: "unidade" },
    });
    expect(
      screen.getByRole("button", { name: "Baixar PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Arquivo: escala-semana-2026-11-23.pdf"),
    ).toBeInTheDocument();
    // O filtro do quadro: só quem está nele.
    fireEvent.click(
      screen.getByLabelText("Quem está no filtro do quadro agora"),
    );
    expect(screen.getByText("2 pessoas · 2 departamentos")).toBeInTheDocument();
    // Escolher: por departamento.
    fireEvent.click(screen.getByLabelText("Escolher"));
    fireEvent.change(screen.getByLabelText("Departamento"), {
      target: { value: "Estoque" },
    });
    expect(screen.getByText("1 pessoa · 1 departamento")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nada publicado neste período. Só a escala publicada sai no arquivo.",
      ),
    ).toBeInTheDocument();
  });

  it("o filtro do quadro limita quem entra", async () => {
    montar({ doFiltro: [BRUNO] });
    await screen.findByText(
      "Nada publicado neste período. Só a escala publicada sai no arquivo.",
    );
    expect(screen.getByText("1 pessoa · 1 departamento")).toBeInTheDocument();
  });

  it("sem publicação registrada, mas com dias publicados: a nota não inventa data", async () => {
    comPublicacao = false;
    montar();
    expect(
      await screen.findByText(
        "Sai a versão publicada. A mudança do rascunho não entra.",
      ),
    ).toBeInTheDocument();
  });
});
