/**
 * T215 — Editar colaborador › Dependentes (como a referência): lista, novo
 * com validação, editar, remover e a recusa do servidor por campo. Dados
 * sintéticos; o servidor é simulado.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DependenteApi } from "../../../api/beneficiosClient";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  SecaoDependentes,
  type ServicoDeDependentes,
  idadeHoje,
} from "./SecaoDependentes";

const FILHO: DependenteApi = {
  id: "d-1",
  nome: "Filho Teste",
  parentesco: "filho",
  dataNascimento: "2018-05-10",
  cpf: null,
  telefone: null,
  email: null,
};

function servico(lista: DependenteApi[] = [FILHO]) {
  return {
    listar: vi.fn(async () => ({ dependentes: lista })),
    criar: vi.fn(async () => FILHO),
    alterar: vi.fn(async () => FILHO),
    remover: vi.fn(async () => ({ removido: true })),
  } satisfies ServicoDeDependentes;
}

const montar = (s = servico(), podeOperar = true) =>
  render(
    <SecaoDependentes
      colaboradorId="c-1"
      podeOperar={podeOperar}
      servico={s}
    />,
  );

describe("SecaoDependentes (T215)", () => {
  it("lista com parentesco, nascimento e idade", async () => {
    montar();
    const lista = await screen.findByRole("list", { name: "Dependentes" });
    expect(within(lista).getByText("Filho Teste")).toBeInTheDocument();
    expect(within(lista).getByText("Filho(a)")).toBeInTheDocument();
    expect(lista).toHaveTextContent(
      `10/05/2018 · ${idadeHoje("2018-05-10")} anos`,
    );
  });

  it("idade: completa no dia do aniversário", () => {
    expect(idadeHoje("2018-05-10", "2026-05-09")).toBe(7);
    expect(idadeHoje("2018-05-10", "2026-05-10")).toBe(8);
    expect(idadeHoje("2025-11-27", "2026-11-26")).toBe(0);
  });

  it("vazio: o texto da referência; sem permissão, sem botão", async () => {
    montar(servico([]), false);
    expect(
      await screen.findByText("Nenhum dependente cadastrado"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Adicionar dependente/ }),
    ).toBeNull();
  });

  it("novo: nome e parentesco obrigatórios; depois grava e relê", async () => {
    const s = servico([]);
    montar(s);
    fireEvent.click(
      await screen.findByRole("button", { name: /Adicionar dependente/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Novo dependente" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar dependente" }),
    );
    expect(screen.getByText("Informe o nome completo.")).toBeInTheDocument();
    expect(
      screen.getByText("Escolha o grau de parentesco."),
    ).toBeInTheDocument();
    expect(s.criar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Filho Teste" },
    });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Grau de parentesco" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Filho(a)" }));
    fireEvent.change(screen.getByLabelText("Data de nascimento"), {
      target: { value: "2018-05-10" },
    });
    expect(
      screen.getByText(`${idadeHoje("2018-05-10")} anos`),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Adicionar dependente" }),
      );
    });
    expect(s.criar).toHaveBeenCalledWith("c-1", {
      nome: "Filho Teste",
      parentesco: "filho",
      dataNascimento: "2018-05-10",
      cpf: null,
      telefone: null,
      email: null,
    });
    expect(
      await screen.findByText("Dependente adicionado."),
    ).toBeInTheDocument();
    expect(s.listar).toHaveBeenCalledTimes(2);
  });

  it("recusa do servidor por campo (CPF inválido)", async () => {
    const s = servico([]);
    s.criar.mockRejectedValueOnce(
      new ApiError(422, "x", { erros: [{ campo: "cpf", motivo: "invalido" }] }),
    );
    montar(s);
    fireEvent.click(
      await screen.findByRole("button", { name: /Adicionar dependente/ }),
    );
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Ana" },
    });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Grau de parentesco" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Cônjuge" }));
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: "123" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Adicionar dependente" }),
      );
    });
    expect(await screen.findByText("CPF inválido.")).toBeInTheDocument();
  });

  it("editar abre preenchido; remover pede confirmação", async () => {
    const s = servico();
    montar(s);
    fireEvent.pointerDown(
      await screen.findByRole("button", { name: "Ações de Filho Teste" }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: "mouse",
      },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    expect(screen.getByLabelText("Nome completo")).toHaveValue("Filho Teste");
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Filho Teste Silva" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar dependente" }),
      );
    });
    expect(s.alterar).toHaveBeenCalledWith(
      "c-1",
      "d-1",
      expect.objectContaining({
        nome: "Filho Teste Silva",
        parentesco: "filho",
      }),
    );

    fireEvent.pointerDown(
      await screen.findByRole("button", { name: "Ações de Filho Teste" }),
      {
        button: 0,
        ctrlKey: false,
        pointerType: "mouse",
      },
    );
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remover" }));
    const janela = screen.getByRole("dialog", { name: "Remover Filho Teste?" });
    await act(async () => {
      fireEvent.click(within(janela).getByRole("button", { name: "Remover" }));
    });
    expect(s.remover).toHaveBeenCalledWith("c-1", "d-1");
  });
});
