/**
 * T205 — rota do Dashboard (D-3) e aterrissagem por papel (D-2).
 */
import { describe, expect, it } from "vitest";
import {
  ANO_MINIMO_DO_DASHBOARD,
  anoDoDashboardValido,
  dashboardDaRota,
  destinoAposTrocaDeEmpresa,
  destinoDaRota,
  rotaDoDashboard,
} from "./rotasDoShell";
import {
  PAPEIS_DASHBOARD,
  capacidadeFuncionalDe,
  destinoInicialPara,
  destinoPosLoginPara,
} from "./mapaNavegacao";

const AGORA = new Date(2026, 10, 9, 12, 0, 0);

describe("T205 — rota do Dashboard", () => {
  it("sem ano: o ano corrente do navegador", () => {
    expect(dashboardDaRota("#/dashboard", AGORA)).toEqual({ ano: 2026 });
  });

  it("com ano válido: o ano pedido", () => {
    expect(dashboardDaRota("#/dashboard?ano=2024", AGORA)).toEqual({
      ano: 2024,
    });
    expect(
      dashboardDaRota(`#/dashboard?ano=${ANO_MINIMO_DO_DASHBOARD}`, AGORA),
    ).toEqual({ ano: ANO_MINIMO_DO_DASHBOARD });
  });

  it.each([
    "#/dashboard?ano=2027",
    "#/dashboard?ano=1999",
    "#/dashboard?ano=20x6",
    "#/dashboard?ano=02026",
    "#/dashboard?ano=",
    "#/dashboard?outra=1",
  ])("ano ausente, inválido ou futuro (%s) vira o corrente", (rota) => {
    expect(dashboardDaRota(rota, AGORA)).toEqual({ ano: 2026 });
  });

  it("outra rota não é do Dashboard", () => {
    expect(dashboardDaRota("#/pessoas/colaboradores", AGORA)).toBeNull();
    expect(dashboardDaRota("#/dashboardx", AGORA)).toBeNull();
    expect(dashboardDaRota("", AGORA)).toBeNull();
  });

  it("forma canônica, destino e troca de empresa", () => {
    expect(rotaDoDashboard(2025)).toBe("#/dashboard?ano=2025");
    expect(destinoDaRota("#/dashboard?ano=2025")).toBe("dashboard");
    expect(destinoDaRota("#/dashboard")).toBe("dashboard");
    // A troca de empresa devolve ao próprio Dashboard (remontado).
    expect(destinoAposTrocaDeEmpresa("dashboard")).toBe("dashboard");
  });

  it("intervalo consultável: do mínimo até o ano corrente", () => {
    expect(anoDoDashboardValido(2026, AGORA)).toBe(true);
    expect(anoDoDashboardValido(2027, AGORA)).toBe(false);
    expect(anoDoDashboardValido(ANO_MINIMO_DO_DASHBOARD - 1, AGORA)).toBe(
      false,
    );
    expect(anoDoDashboardValido(2025.5, AGORA)).toBe(false);
  });
});

describe("T205 — aterrissagem e capacidade (D-2)", () => {
  it("Dashboard para RH, DP e master_tecnico; Minha equipe para o gestor; Hub para os demais", () => {
    expect(destinoPosLoginPara("rh")).toBe("dashboard");
    expect(destinoPosLoginPara("dp")).toBe("dashboard");
    expect(destinoPosLoginPara("master_tecnico")).toBe("dashboard");
    expect(destinoPosLoginPara("gestor")).toBe("equipe");
    for (const papel of [
      "colaborador",
      "financeiro",
      "auditor",
      "dpo",
      "admin_tecnico",
    ]) {
      expect(destinoPosLoginPara(papel)).toBeNull();
    }
    expect(destinoPosLoginPara(null)).toBeNull();
  });

  it("só os papéis do Dashboard o têm na capacidade (e na barra)", () => {
    expect([...PAPEIS_DASHBOARD]).toEqual(["rh", "dp", "master_tecnico"]);
    for (const papel of ["rh", "dp", "master_tecnico"]) {
      expect(capacidadeFuncionalDe(papel).map((d) => d.id)[0]).toBe(
        "dashboard",
      );
    }
    for (const papel of ["gestor", "colaborador", "financeiro", "auditor"]) {
      expect(capacidadeFuncionalDe(papel).map((d) => d.id)).not.toContain(
        "dashboard",
      );
    }
  });

  it("o destino de reserva do shell não muda (só o pós-login aterrissa no Dashboard)", () => {
    expect(destinoInicialPara("rh")).toBe("pessoas");
    expect(destinoInicialPara("gestor")).toBe("equipe");
  });
});
