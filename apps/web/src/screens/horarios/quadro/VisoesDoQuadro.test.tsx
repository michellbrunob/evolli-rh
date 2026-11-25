import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  criarVisao,
  removerVisao,
  renomearVisao,
} from "../../../api/escalaClient";
import { FILTROS_DO_QUADRO_VAZIOS } from "./filtrosDoQuadro";
import { DialogoGerenciarVisoes, DialogoSalvarVisao } from "./VisoesDoQuadro";

vi.mock("../../../api/escalaClient");

const FILTROS = { ...FILTROS_DO_QUADRO_VAZIOS, semEscala: true };
const visao = (id: string, nome: string) => ({
  id,
  nome,
  filtros: FILTROS,
});

describe("T215 — Salvar como visão", () => {
  beforeEach(() => vi.mocked(criarVisao).mockReset());

  it("nome obrigatório (aparado), grava os filtros e devolve a lista", async () => {
    vi.mocked(criarVisao).mockResolvedValue({
      visoes: [visao("v1", "Sem escala")],
    });
    const onSalva = vi.fn();
    render(
      <DialogoSalvarVisao
        aberto
        filtros={FILTROS}
        onFechar={vi.fn()}
        onSalva={onSalva}
      />,
    );
    expect(
      screen.getByText(
        "A visão guarda os filtros para abrir de novo com um clique. Só você vê.",
      ),
    ).toBeInTheDocument();
    const salvar = screen.getByRole("button", { name: "Salvar visão" });
    expect(salvar).toBeDisabled();
    const nome = screen.getByRole("textbox", { name: "Nome" });
    expect(nome).toHaveAttribute("maxLength", "60");
    fireEvent.change(nome, { target: { value: "   " } });
    expect(salvar).toBeDisabled();
    fireEvent.change(nome, { target: { value: "  Sem escala  " } });
    fireEvent.click(salvar);
    await waitFor(() =>
      expect(onSalva).toHaveBeenCalledWith([visao("v1", "Sem escala")]),
    );
    expect(criarVisao).toHaveBeenCalledWith({
      nome: "Sem escala",
      filtros: FILTROS,
    });
  });

  it("Enter salva; nome repetido, teto e falha explicam sem fechar", async () => {
    const onSalva = vi.fn();
    render(
      <DialogoSalvarVisao
        aberto
        filtros={FILTROS}
        onFechar={vi.fn()}
        onSalva={onSalva}
      />,
    );
    const nome = screen.getByRole("textbox", { name: "Nome" });
    fireEvent.change(nome, { target: { value: "Loja" } });

    vi.mocked(criarVisao).mockRejectedValueOnce(
      new ApiError(409, "x", { erros: [{ campo: "nome", motivo: "em_uso" }] }),
    );
    fireEvent.submit(nome.closest("form")!);
    expect(
      await screen.findByText("Você já tem uma visão com esse nome."),
    ).toBeInTheDocument();
    expect(nome).toHaveAttribute("aria-invalid", "true");

    vi.mocked(criarVisao).mockRejectedValueOnce(
      new ApiError(422, "x", { erros: [{ campo: "nome", motivo: "limite" }] }),
    );
    fireEvent.submit(nome.closest("form")!);
    expect(
      await screen.findByText(
        "Você chegou a 30 visões. Apague uma em Gerenciar para salvar outra.",
      ),
    ).toBeInTheDocument();

    vi.mocked(criarVisao).mockRejectedValueOnce(new Error("rede"));
    fireEvent.submit(nome.closest("form")!);
    expect(
      await screen.findByText(
        "Não foi possível salvar a visão. Tente de novo.",
      ),
    ).toBeInTheDocument();
    expect(onSalva).not.toHaveBeenCalled();
  });
});

describe("T215 — Gerenciar visões", () => {
  beforeEach(() => {
    vi.mocked(renomearVisao).mockReset();
    vi.mocked(removerVisao).mockReset();
  });

  it("renomeia e apaga (com confirmação), devolvendo a lista nova", async () => {
    const onMudou = vi.fn();
    vi.mocked(renomearVisao).mockResolvedValue({
      visoes: [visao("v1", "Loja Centro"), visao("v2", "Sem escala")],
    });
    vi.mocked(removerVisao).mockResolvedValue({
      visoes: [visao("v1", "Loja Centro")],
    });
    render(
      <DialogoGerenciarVisoes
        aberto
        visoes={[visao("v1", "Loja"), visao("v2", "Sem escala")]}
        onFechar={vi.fn()}
        onMudou={onMudou}
      />,
    );
    expect(screen.getByText("2 visões salvas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Renomear Loja" }));
    const campo = screen.getByRole("textbox", { name: "Novo nome de Loja" });
    expect(campo).toHaveValue("Loja");
    fireEvent.change(campo, { target: { value: " Loja Centro " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nome" }));
    await waitFor(() =>
      expect(renomearVisao).toHaveBeenCalledWith("v1", "Loja Centro"),
    );
    expect(onMudou).toHaveBeenLastCalledWith(
      [visao("v1", "Loja Centro"), visao("v2", "Sem escala")],
      'Visão renomeada para "Loja Centro".',
    );
    // O foco volta à linha renomeada.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Renomear Loja" }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Apagar Sem escala" }));
    expect(screen.getByText('Apagar "Sem escala"?')).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Manter" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(removerVisao).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Renomear Sem escala" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Apagar Sem escala" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar visão" }));
    await waitFor(() => expect(removerVisao).toHaveBeenCalledWith("v2"));
    expect(onMudou).toHaveBeenLastCalledWith(
      [visao("v1", "Loja Centro")],
      'Visão "Sem escala" apagada.',
    );
  });

  it("nome repetido ao renomear explica; Esc no campo cancela só a edição; sem visões, diz como criar", async () => {
    vi.mocked(renomearVisao).mockRejectedValueOnce(
      new ApiError(409, "x", { erros: [{ campo: "nome", motivo: "em_uso" }] }),
    );
    const { rerender } = render(
      <DialogoGerenciarVisoes
        aberto
        visoes={[visao("v1", "Loja"), visao("v2", "Sem escala")]}
        onFechar={vi.fn()}
        onMudou={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Renomear Loja" }));
    const campo = screen.getByRole("textbox", { name: "Novo nome de Loja" });
    fireEvent.change(campo, { target: { value: "Sem escala" } });
    fireEvent.submit(campo.closest("form")!);
    expect(
      await screen.findByText("Você já tem uma visão com esse nome."),
    ).toBeInTheDocument();
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(
      screen.queryByRole("textbox", { name: "Novo nome de Loja" }),
    ).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(
      <DialogoGerenciarVisoes
        aberto
        visoes={[]}
        onFechar={vi.fn()}
        onMudou={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        'Nenhuma visão salva. Marque os filtros e use "Salvar como visão".',
      ),
    ).toBeInTheDocument();
  });
});
