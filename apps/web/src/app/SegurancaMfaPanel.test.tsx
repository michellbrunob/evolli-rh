import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SegurancaMfaPanel } from "./SegurancaMfaPanel";
import {
  ApiError,
  confirmarEnrollmentMfa,
  iniciarEnrollmentMfa,
} from "../api/mfaClient";

vi.mock("../api/mfaClient", async () => {
  const actual =
    await vi.importActual<typeof import("../api/mfaClient")>(
      "../api/mfaClient",
    );
  return {
    ...actual,
    iniciarEnrollmentMfa: vi.fn(),
    confirmarEnrollmentMfa: vi.fn(),
  };
});

const MATERIAL = {
  secretBase32: "GEZDGNBVGY3TQOJQ",
  otpauthUri: "otpauth://totp/Evolli%20RH:pessoa@example.test?secret=GEZ...",
};
const RECOVERY = Array.from({ length: 10 }, (_, i) => `AB${i}DE-FG${i}HJ`);

beforeEach(() => {
  vi.clearAllMocks();
});

function abrir() {
  return render(
    <SegurancaMfaPanel
      aberto
      onFechar={vi.fn()}
      onSessaoAtualEncerrada={vi.fn()}
    />,
  );
}

describe("SegurancaMfaPanel (T126)", () => {
  it("não renderiza nada quando fechado", () => {
    const { container } = render(
      <SegurancaMfaPanel
        aberto={false}
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("estado inicial: oferece configurar 2FA, sem exibir chave nem códigos", () => {
    abrir();
    expect(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Chave/i)).not.toBeInTheDocument();
  });

  it("enrollment mostra a chave manual e o otpauth apenas durante o cadastro", async () => {
    vi.mocked(iniciarEnrollmentMfa).mockResolvedValueOnce(MATERIAL);
    abrir();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );

    const campoChave = await screen.findByLabelText(
      /Chave \(entrada manual\)/i,
    );
    expect(campoChave).toHaveValue(MATERIAL.secretBase32);
    expect(screen.getByLabelText(/otpauth/i)).toHaveValue(MATERIAL.otpauthUri);
  });

  it("confirmação exibe exatamente 10 códigos uma vez e não os reexibe após concluir", async () => {
    vi.mocked(iniciarEnrollmentMfa).mockResolvedValueOnce(MATERIAL);
    vi.mocked(confirmarEnrollmentMfa).mockResolvedValueOnce({
      recoveryCodes: RECOVERY,
    });
    abrir();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    await screen.findByLabelText(/Chave \(entrada manual\)/i);

    fireEvent.change(screen.getByLabelText(/Código de 6 dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ativar 2FA" }));

    await waitFor(() =>
      expect(confirmarEnrollmentMfa).toHaveBeenCalledWith("123456"),
    );
    // Os 10 códigos aparecem uma vez.
    for (const c of RECOVERY) {
      expect(screen.getByText(c)).toBeInTheDocument();
    }

    fireEvent.click(
      screen.getByRole("button", { name: "Já guardei meus códigos" }),
    );

    // Depois de concluir, nenhum código continua na tela.
    for (const c of RECOVERY) {
      expect(screen.queryByText(c)).not.toBeInTheDocument();
    }
    expect(
      screen.getByText(/Autenticação em duas etapas ativada/i),
    ).toBeInTheDocument();
  });

  it("código inválido na confirmação (422): erro genérico, sem expor segredo", async () => {
    vi.mocked(iniciarEnrollmentMfa).mockResolvedValueOnce(MATERIAL);
    vi.mocked(confirmarEnrollmentMfa).mockRejectedValueOnce(
      new ApiError(422, "detalhe interno"),
    );
    abrir();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    await screen.findByLabelText(/Chave \(entrada manual\)/i);
    fireEvent.change(screen.getByLabelText(/Código de 6 dígitos/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ativar 2FA" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Código inválido/i,
    );
  });

  it("erro ao iniciar: mostra retry; já configurado (409): mensagem própria sem retry", async () => {
    vi.mocked(iniciarEnrollmentMfa)
      .mockRejectedValueOnce(new Error("rede"))
      .mockRejectedValueOnce(new ApiError(409, "já configurado"));
    abrir();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Tentar novamente" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/já tem autenticação em duas etapas/i);
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
  });

  it("cancelar durante o enrollment volta ao estado inicial e descarta a chave", async () => {
    vi.mocked(iniciarEnrollmentMfa).mockResolvedValueOnce(MATERIAL);
    abrir();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    await screen.findByLabelText(/Chave \(entrada manual\)/i);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(MATERIAL.secretBase32)).not.toBeInTheDocument();
  });

  it("401 em qualquer etapa aciona onSessaoAtualEncerrada", async () => {
    const onSessaoAtualEncerrada = vi.fn();
    vi.mocked(iniciarEnrollmentMfa).mockRejectedValueOnce(
      new ApiError(401, "Não autorizado."),
    );
    render(
      <SegurancaMfaPanel
        aberto
        onFechar={vi.fn()}
        onSessaoAtualEncerrada={onSessaoAtualEncerrada}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    await waitFor(() =>
      expect(onSessaoAtualEncerrada).toHaveBeenCalledTimes(1),
    );
  });

  it("nunca grava em localStorage/sessionStorage durante o fluxo", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.mocked(iniciarEnrollmentMfa).mockResolvedValueOnce(MATERIAL);
    vi.mocked(confirmarEnrollmentMfa).mockResolvedValueOnce({
      recoveryCodes: RECOVERY,
    });
    abrir();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Configurar autenticação em duas etapas",
      }),
    );
    await screen.findByLabelText(/Chave \(entrada manual\)/i);
    fireEvent.change(screen.getByLabelText(/Código de 6 dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ativar 2FA" }));
    await screen.findByText(RECOVERY[0]!);

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
