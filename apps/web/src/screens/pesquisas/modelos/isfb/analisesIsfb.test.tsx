/**
 * T216 — Saúde financeira no painel: o selo dos cartões de dimensão mostra
 * só a faixa (sem o intervalo da régua geral), a Visão geral leva às
 * Análises e as Análises cruzam os benefícios da empresa (módulo
 * Benefícios) com as necessidades do time.
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  LinhaDeBeneficioApi,
  ListaDeBeneficiosApi,
} from "../../../../api/beneficiosClient";
import { ApiError } from "../../../../api/colaboradoresClient";
import { PAINEL_ISFB_DE_TESTE } from "./resultadoDeTeste";
import { modeloDaGaleria, secoesDoModelo } from "../../modelosDePesquisa";
import { PerguntasFixas } from "../PerguntasFixas";
import { comAutopercepcao } from "./Autopercepcao";
import { AnalisesIsfb, VisaoGeralIsfb } from "./VisaoGeralIsfb";

const linha = (
  nome: string,
  categoria: LinhaDeBeneficioApi["categoria"],
  situacao: LinhaDeBeneficioApi["situacao"] = "ativo",
): LinhaDeBeneficioApi => ({
  id: nome,
  nome,
  categoria,
  situacao,
  suspensoAPartirDe: null,
  pessoas: 3,
  dependentes: 0,
  empresa: 0,
  desconto: 0,
});

const lista = (beneficios: LinhaDeBeneficioApi[]): ListaDeBeneficiosApi => ({
  competencia: "2026-11",
  beneficios,
  resumo: {
    pessoas: 3,
    comDesconto: 0,
    empresa: 0,
    desconto: 0,
    beneficiosAtivos: beneficios.length,
    ativos: 3,
    semBeneficio: [],
  },
});

describe("saúde financeira — cartões de dimensão", () => {
  it("o selo mostra só a faixa da dimensão; a nota do time mantém o intervalo", () => {
    render(<VisaoGeralIsfb resultado={PAINEL_ISFB_DE_TESTE} />);
    const dimensoes = screen.getByRole("region", { name: "Dimensões" });
    const cartoes = within(dimensoes).getAllByRole("heading", { level: 3 });
    const cartao = (nome: string) =>
      cartoes.find((h) => h.textContent === nome)!.closest("div")!
        .parentElement!;
    expect(cartao("Segurança")).toHaveTextContent("Baixa");
    expect(cartao("Comportamento")).toHaveTextContent("OK");
    expect(dimensoes).not.toHaveTextContent(/\d+ a \d+/);
    expect(screen.getAllByText("Baixa · 50 a 56")).toHaveLength(1);
  });
});

describe("saúde financeira — atalho para as Análises", () => {
  it("'Ver análises do time' troca a aba", () => {
    const onIrPara = vi.fn();
    render(
      <VisaoGeralIsfb resultado={PAINEL_ISFB_DE_TESTE} onIrPara={onIrPara} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Ver análises do time/ }),
    );
    expect(onIrPara).toHaveBeenCalledWith("analises");
    expect(onIrPara).toHaveBeenCalledTimes(1);
  });

  it("sem para onde ir, não mostra o atalho", () => {
    render(<VisaoGeralIsfb resultado={PAINEL_ISFB_DE_TESTE} />);
    expect(
      screen.queryByRole("button", { name: /Ver análises do time/ }),
    ).toBeNull();
  });
});

describe("saúde financeira — benefícios da empresa × necessidades do time", () => {
  const montar = (carregar: () => Promise<ListaDeBeneficiosApi>) =>
    render(
      <AnalisesIsfb
        resultado={PAINEL_ISFB_DE_TESTE}
        campo={null}
        onCampo={() => undefined}
        carregarBeneficios={carregar}
      />,
    );

  it("cada necessidade com oferecido ou não e o dado do time", async () => {
    const carregar = vi.fn(() =>
      Promise.resolve(
        lista([
          linha("Vale-refeição", "alimentacao"),
          linha("Plano de saúde", "saude"),
          linha("Seguro de vida", "seguro_vida", "pausado"),
          linha("Previdência privada", "outros"),
        ]),
      ),
    );
    montar(carregar);
    const tabela = await screen.findByRole("table", {
      name: "Benefícios da empresa × necessidades do time",
    });
    const linhas = within(tabela)
      .getAllByRole("row")
      .slice(1)
      .map((tr) =>
        within(tr)
          .getAllByRole("cell")
          .map((td) => td.textContent),
      );
    expect(linhas).toEqual([
      [
        "Antecipação salarial",
        "Não oferecido",
        "33% gastam mais do que ganham",
      ],
      [
        "Educação financeira",
        "Não oferecido",
        "33% se beneficiam de “Reserva de emergência”",
      ],
      ["Previdência complementar", "Oferecido", "0% têm previdência privada"],
      [
        "Vale-alimentação ou refeição",
        "Oferecido",
        "33% estão apertados financeiramente",
      ],
      [
        "Plano de saúde",
        "Oferecido",
        "67% têm seguro saúde ou convênio (conta o plano da empresa)",
      ],
      ["Seguro de vida", "Não oferecido", "33% não têm nenhuma reserva"],
    ]);
    expect(screen.getByText("Do módulo Benefícios")).toBeInTheDocument();
    expect(carregar).toHaveBeenCalledTimes(1);
  });

  it("sem acesso ao módulo Benefícios, avisa em vez de dizer 'não oferecido'", async () => {
    montar(() => Promise.reject(new ApiError(403, "x")));
    expect(
      await screen.findByText(
        "Seu acesso não inclui o módulo Benefícios: não dá para cruzar com o que a empresa oferece.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Não oferecido")).toBeNull();
  });

  it("falha ao ler: mensagem própria", async () => {
    montar(() => Promise.reject(new Error("rede")));
    await waitFor(() =>
      expect(
        screen.getByText(
          "Não foi possível ler os benefícios da empresa agora.",
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Oferecido")).toBeNull();
  });
});

describe("saúde financeira — 4ª revisão", () => {
  const isfb = modeloDaGaleria("isfb");
  const secoes = secoesDoModelo(isfb);

  it("resumo do assistente: 15 do índice + 3 de autopercepção (ou só as 15)", () => {
    const todas = secoes.flatMap((s) => s.perguntas);
    expect(isfb.resumoDasPerguntas!(todas)).toBe(
      "15 perguntas do índice + 3 de autopercepção",
    );
    const sem = comAutopercepcao(secoes, false).flatMap((s) => s.perguntas);
    expect(isfb.resumoDasPerguntas!(sem)).toBe("15 perguntas do índice");
  });

  it("blocos marcados Obrigatória; a autopercepção, Opcional", () => {
    render(<PerguntasFixas modelo={isfb} secoes={secoes} />);
    const gatilhos = screen
      .getAllByRole("button", { expanded: true })
      .concat(screen.getAllByRole("button", { expanded: false }))
      .filter((b) => b.className.includes("fixas__gatilho"));
    expect(gatilhos).toHaveLength(secoes.length);
    const ultimo = gatilhos.find((b) =>
      b.textContent?.includes(secoes.at(-1)!.titulo!),
    )!;
    expect(ultimo).toHaveTextContent("Opcional");
    for (const b of gatilhos.filter((x) => x !== ultimo))
      expect(b).toHaveTextContent("Obrigatória");
  });

  it("base financeira: produtos por pessoa em inteiro, 'de 14 possíveis'", () => {
    render(
      <VisaoGeralIsfb
        resultado={{
          ...PAINEL_ISFB_DE_TESTE,
          isfb: {
            ...PAINEL_ISFB_DE_TESTE.isfb!,
            base: {
              ...PAINEL_ISFB_DE_TESTE.isfb!.base,
              produtosPorPessoa: 2.33,
            },
          },
        }}
      />,
    );
    const base = screen.getByRole("region", { name: "Base financeira" });
    expect(within(base).getByText("2 de 14 possíveis")).toBeInTheDocument();
  });

  it("por renda da casa: só as faixas que têm respostas", () => {
    render(
      <VisaoGeralIsfb
        resultado={{
          ...PAINEL_ISFB_DE_TESTE,
          isfb: {
            ...PAINEL_ISFB_DE_TESTE.isfb!,
            porRenda: [
              {
                id: "ate_1_5",
                respostas: 1,
                visivel: false,
                oculto: "minimo",
                saude: null,
              },
              {
                id: "de_1_5_a_4_2",
                respostas: 0,
                visivel: false,
                oculto: null,
                saude: null,
              },
            ],
          },
        }}
      />,
    );
    const renda = screen.getByRole("region", {
      name: "Saúde financeira por renda da casa",
    });
    expect(within(renda).getAllByRole("row")).toHaveLength(2);
  });
});
