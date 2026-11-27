import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/colaboradoresClient", () => ({
  consultarCpfEmUso: vi.fn(),
}));

import { consultarCpfEmUso } from "../../api/colaboradoresClient";
import { useCpfEmUso } from "./useCpfEmUso";

const CPF = "52998224725";
const valido = () => true;

describe("T215 — useCpfEmUso", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(consultarCpfEmUso).mockReset();
  });

  it("CPF em uso: avisa depois da espera", async () => {
    vi.mocked(consultarCpfEmUso).mockResolvedValue(true);
    const { result } = renderHook(() => useCpfEmUso(CPF, valido));
    expect(result.current).toBe(false);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current).toBe(true);
  });

  it("resposta fora do contrato (sem promessa) não derruba a tela", async () => {
    vi.mocked(consultarCpfEmUso).mockReturnValue(undefined as never);
    const { result } = renderHook(() => useCpfEmUso(CPF, valido));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current).toBe(false);
  });
});
