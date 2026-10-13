/**
 * Testes de `AcaoSituacao` (T158).
 *
 * O que prendem, e por quê:
 *
 *  - que o botão oferecido corresponde à situação atual — inativar o que está
 *    ativo, reativar o que está inativo;
 *  - que **nenhum caminho emite `DELETE`**: exclusão física não existe no
 *    servidor e não pode aparecer aqui por acidente;
 *  - que a confirmação acontece antes da mutação, e que cancelar não chama
 *    nada;
 *  - que cada recusa prevista pelo contrato vira a mensagem certa, sem
 *    inventar causa — em especial o `409` de inativar, que o servidor
 *    deliberadamente **não** desambigua;
 *  - que falha de rede é distinguida de recusa do servidor.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcaoSituacao, mensagemDeErro } from "./AcaoSituacao";

class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

const ATIVO = {
  id: "id-1",
  codigo: "COD-1",
  nome: "Operações",
  status: "ativo",
};
const INATIVO = { ...ATIVO, status: "inativo" };

let inativar: ReturnType<typeof vi.fn>;
let reativar: ReturnType<typeof vi.fn>;
let onConcluido: ReturnType<typeof vi.fn>;

beforeEach(() => {
  inativar = vi.fn();
  reativar = vi.fn();
  onConcluido = vi.fn();
});

function montar(registro = ATIVO) {
  return render(
    <AcaoSituacao
      registro={registro}
      entidade="departamento"
      inativar={inativar}
      reativar={reativar}
      onConcluido={onConcluido}
    />,
  );
}

function clicarNoModal(rotulo: string) {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: rotulo }),
  );
}

describe("qual ação é oferecida", () => {
  it("registro ativo oferece Inativar", () => {
    montar(ATIVO);
    expect(
      screen.getByRole("button", { name: "Inativar departamento Operações" }),
    ).toBeInTheDocument();
  });

  it("registro inativo oferece Reativar", () => {
    montar(INATIVO);
    expect(
      screen.getByRole("button", { name: "Reativar departamento Operações" }),
    ).toBeInTheDocument();
  });

  it("nunca oferece excluir", () => {
    montar(ATIVO);
    expect(
      screen.queryByRole("button", { name: /excluir|remover|apagar|deletar/i }),
    ).toBeNull();
  });
});

describe("confirmação antes da mutação", () => {
  it("abrir o modal não chama o servidor", () => {
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(inativar).not.toHaveBeenCalled();
    expect(reativar).not.toHaveBeenCalled();
  });

  it("cancelar fecha e não chama nada", async () => {
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    clicarNoModal("Cancelar");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(inativar).not.toHaveBeenCalled();
  });

  it("o modal diz que nada é excluído", () => {
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    expect(
      within(screen.getByRole("dialog")).getByText(/Nada é excluído/),
    ).toBeInTheDocument();
  });

  it("Escape fecha sem mutar", async () => {
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(inativar).not.toHaveBeenCalled();
  });

  it("o foco entra no modal", () => {
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe("sucesso", () => {
  it("inativar chama só inativar e devolve o registro atualizado", async () => {
    inativar.mockResolvedValue({ ...ATIVO, status: "inativo" });
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    clicarNoModal("Inativar");
    await waitFor(() => expect(inativar).toHaveBeenCalledWith("id-1"));
    expect(reativar).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith(
      { ...ATIVO, status: "inativo" },
      "Operações foi inativado.",
    );
  });

  it("reativar chama só reativar", async () => {
    reativar.mockResolvedValue(ATIVO);
    montar(INATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Reativar/ }));
    clicarNoModal("Reativar");
    await waitFor(() => expect(reativar).toHaveBeenCalledWith("id-1"));
    expect(inativar).not.toHaveBeenCalled();
    expect(onConcluido).toHaveBeenCalledWith(ATIVO, "Operações foi reativado.");
  });

  it("dois cliques no mesmo quadro disparam um envio só", async () => {
    let resolver!: (v: unknown) => void;
    inativar.mockReturnValue(
      new Promise((r) => {
        resolver = r;
      }),
    );
    montar(ATIVO);
    fireEvent.click(screen.getByRole("button", { name: /^Inativar/ }));
    const botao = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Inativar",
    });
    fireEvent.click(botao);
    fireEvent.click(botao);
    expect(inativar).toHaveBeenCalledTimes(1);
    resolver({ ...ATIVO, status: "inativo" });
    await waitFor(() => expect(onConcluido).toHaveBeenCalled());
  });
});

describe("recusas do servidor e falha de rede", () => {
  async function recusar(erro: unknown, registro = ATIVO) {
    const fn = registro.status === "ativo" ? inativar : reativar;
    fn.mockRejectedValue(erro);
    montar(registro);
    const rotulo = registro.status === "ativo" ? "Inativar" : "Reativar";
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${rotulo}`) }),
    );
    clicarNoModal(rotulo);
    return screen.findByRole("alert");
  }

  it("403 diz que falta permissão", async () => {
    const alerta = await recusar(new ErroApi(403, "x"));
    expect(alerta.textContent).toContain("não tem permissão");
  });

  it("404 não distingue inexistente de outra empresa", async () => {
    const alerta = await recusar(new ErroApi(404, "x"));
    expect(alerta.textContent).toContain("não encontrado");
    expect(alerta.textContent).not.toMatch(/empresa/i);
  });

  it("409 ao inativar nomeia as DUAS possibilidades, sem escolher uma", async () => {
    const alerta = await recusar(new ErroApi(409, "x"));
    expect(alerta.textContent).toContain("já mudou");
    expect(alerta.textContent).toContain("registro ativo vinculado");
    // Não revela QUAL dependente — o servidor recusa genérico de propósito.
    expect(alerta.textContent).not.toMatch(/colaborador|pessoa alocada/i);
  });

  it("409 ao reativar é específico: só pode ser situação já mudada", async () => {
    const alerta = await recusar(new ErroApi(409, "x"), INATIVO);
    expect(alerta.textContent).toContain("a situação já mudou");
    expect(alerta.textContent).not.toContain("registro ativo vinculado");
  });

  it("422 ao reativar aponta o nível superior inativo", async () => {
    const alerta = await recusar(new ErroApi(422, "x"), INATIVO);
    expect(alerta.textContent).toContain("nível superior");
  });

  it("falha de rede é distinguida de recusa", async () => {
    const alerta = await recusar(new TypeError("Failed to fetch"));
    expect(alerta.textContent).toContain("Verifique a conexão");
  });

  it("recusa mantém o modal aberto e não conclui", async () => {
    await recusar(new ErroApi(409, "x"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onConcluido).not.toHaveBeenCalled();
  });
});

describe("mensagemDeErro — tabela de contrato", () => {
  it("cobre cada código que o contrato prevê", () => {
    expect(mensagemDeErro("inativar", 403)).toContain("permissão");
    expect(mensagemDeErro("inativar", 404)).toContain("não encontrado");
    expect(mensagemDeErro("inativar", 409)).toContain("ou ainda existe");
    expect(mensagemDeErro("reativar", 409)).toContain("já mudou");
    expect(mensagemDeErro("reativar", 422)).toContain("nível superior");
    expect(mensagemDeErro("inativar", null)).toContain("conexão");
  });

  it("422 em inativar não existe no contrato e cai no texto neutro", () => {
    // O servidor só devolve 422 na reativação (pai inativo). Inventar uma
    // explicação para um 422 ao inativar seria descrever regra que não existe.
    expect(mensagemDeErro("inativar", 422)).toBe(
      "Não foi possível concluir a operação. Tente de novo.",
    );
  });
});
