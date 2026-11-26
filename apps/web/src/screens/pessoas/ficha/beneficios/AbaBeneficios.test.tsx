/**
 * T215 — ficha › aba Benefícios (como a referência): o custo mensal da
 * empresa, o % do salário bruto, o custo anual, a rosca, "Por categoria" e a
 * lista; além da referência, o desconto no holerite e as pendências.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FichaDeBeneficiosApi } from "../../../../api/beneficiosClient";
import { AbaBeneficios } from "./AbaBeneficios";

const DADOS: FichaDeBeneficiosApi = {
  competencia: "2026-11",
  salarioBruto: 1621,
  beneficios: [
    {
      id: "b-1",
      nome: "VR teste",
      categoria: "alimentacao",
      situacao: "ativo",
      valor: 45000,
      empresa: 36000,
      desconto: 9000,
      adicional: 0,
      pendencia: null,
    },
    {
      id: "b-2",
      nome: "Saúde teste",
      categoria: "saude",
      situacao: "ativo",
      valor: 28000,
      empresa: 21400,
      desconto: 6600,
      adicional: 0,
      pendencia: null,
    },
  ],
};

const montar = (
  dados: FichaDeBeneficiosApi = DADOS,
  onAbrirBeneficios?: () => void,
) =>
  render(
    <AbaBeneficios
      colaboradorId="c-1"
      primeiroNome="Pedro"
      carregar={vi.fn(async () => dados)}
      {...(onAbrirBeneficios ? { onAbrirBeneficios } : {})}
    />,
  );

describe("AbaBeneficios (T215)", () => {
  it("custo mensal, % do salário, custo anual e desconto", async () => {
    montar();
    const custo = await screen.findByRole("region", {
      name: "Custo mensal com benefícios",
    });
    expect(custo).toHaveTextContent("R$574,00/mês");
    expect(custo).toHaveTextContent("35,4% do salário bruto");
    expect(custo).toHaveTextContent("sobre R$ 1.621,00");
    expect(custo).toHaveTextContent("Custo anualR$ 6.888,00");
    expect(custo).toHaveTextContent("Desconto no holeriteR$ 156,00/mês");
    expect(custo).toHaveTextContent("Benefícios ativos2");
    const legenda = within(custo).getByRole("list", {
      name: "Participação por benefício",
    });
    expect(legenda).toHaveTextContent("VR teste63%");
    expect(legenda).toHaveTextContent("Saúde teste37%");
  });

  it("por categoria e benefícios vinculados", async () => {
    const abrir = vi.fn();
    montar(DADOS, abrir);
    const cat = await screen.findByRole("region", { name: "Por categoria" });
    expect(cat).toHaveTextContent("AlimentaçãoR$ 360,00 63%");
    expect(cat).toHaveTextContent("SaúdeR$ 214,00 37%");
    const vinc = screen.getByRole("region", { name: "Benefícios vinculados" });
    expect(vinc).toHaveTextContent("2 benefícios ativos para Pedro");
    expect(vinc).toHaveTextContent("desconto de R$ 90,00");
    fireEvent.click(
      within(vinc).getByRole("button", { name: /Vincular outro benefício/ }),
    );
    expect(abrir).toHaveBeenCalled();
  });

  it("pendência: o benefício aparece pendente e o motivo é dito", async () => {
    montar({
      ...DADOS,
      beneficios: [
        DADOS.beneficios[0]!,
        {
          ...DADOS.beneficios[1]!,
          valor: 0,
          empresa: 0,
          desconto: 0,
          pendencia: "sem_nascimento",
        },
      ],
    });
    expect(await screen.findByRole("note")).toHaveTextContent(
      "1 benefício está fora da conta até completar o cadastro: Saúde teste (sem nascimento: completar cadastro).",
    );
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("vazio: o convite; sem permissão, sem Vincular", async () => {
    montar({ competencia: "2026-11", salarioBruto: null, beneficios: [] });
    expect(
      await screen.findByText("Nenhum benefício vinculado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Vincule os benefícios de Pedro para acompanhar o custo mensal, a distribuição por categoria e quanto eles representam do salário.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Vincular benefício/ }),
    ).toBeNull();
  });

  it("sem salário no cadastro", async () => {
    montar({ ...DADOS, salarioBruto: null });
    expect(
      await screen.findByText("Sem salário no cadastro."),
    ).toBeInTheDocument();
  });
});
