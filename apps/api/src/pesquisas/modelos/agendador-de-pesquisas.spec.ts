import { AgendadorDePesquisas } from "./agendador-de-pesquisas";
import type { ProcessadorDePesquisas } from "./processador-de-pesquisas";

/** T216 — o agendador das pesquisas: intervalo, uma rodada por vez. */

function falso(impl: () => Promise<number>) {
  const processar = jest.fn(impl);
  return {
    processar,
    agendador: new AgendadorDePesquisas({
      processar,
    } as unknown as ProcessadorDePesquisas),
  };
}

describe("T216 — agendador das pesquisas", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.useRealTimers();
  });

  it("roda o processo e devolve as mudanças", async () => {
    const { agendador, processar } = falso(async () => 3);
    const agora = new Date("2026-11-27T12:00:00Z");
    await expect(agendador.rodar(agora)).resolves.toBe(3);
    expect(processar).toHaveBeenCalledWith(agora);
  });

  it("não roda duas vezes ao mesmo tempo", async () => {
    let soltar!: () => void;
    let chamadas = 0;
    const { agendador, processar } = falso(() => {
      chamadas += 1;
      return chamadas === 1
        ? new Promise<number>((r) => (soltar = () => r(1)))
        : Promise.resolve(1);
    });
    const primeira = agendador.rodar();
    await expect(agendador.rodar()).resolves.toBeNull();
    soltar();
    await expect(primeira).resolves.toBe(1);
    expect(processar).toHaveBeenCalledTimes(1);
    await expect(agendador.rodar()).resolves.toBe(1);
  });

  it("uma falha não derruba o agendador", async () => {
    const { agendador } = falso(async () => {
      throw new Error("banco fora");
    });
    await expect(agendador.rodar()).resolves.toBeNull();
    await expect(agendador.rodar()).resolves.toBeNull();
  });

  it("liga com o intervalo do ambiente e desliga no fim", async () => {
    jest.useFakeTimers();
    process.env.PESQUISAS_AGENDADOR_INTERVALO_MS = "20000";
    const { agendador, processar } = falso(async () => 0);
    agendador.onModuleInit();
    await jest.advanceTimersByTimeAsync(20_000);
    expect(processar).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(20_000);
    expect(processar).toHaveBeenCalledTimes(2);
    agendador.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(processar).toHaveBeenCalledTimes(2);
  });

  it("com 0 (ou nos testes sem a variável), não liga", async () => {
    jest.useFakeTimers();
    process.env.PESQUISAS_AGENDADOR_INTERVALO_MS = "0";
    const { agendador, processar } = falso(async () => 0);
    agendador.onModuleInit();
    await jest.advanceTimersByTimeAsync(10 * 60_000);
    expect(processar).not.toHaveBeenCalled();
    agendador.onModuleDestroy();
  });
});
