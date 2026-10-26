/**
 * CadastrosScreen → módulo Estrutura (T073…T087, separado por modo na T159).
 *
 * A T159 dividiu as abas por ESTADO: as que falam com o servidor — hoje
 * Estrutura organizacional, Funções e cargos e Centros de custo — e sete
 * catálogos de apoio que só desenham exemplos. A T182 tirou daqui a aba
 * Horários: ela virou a tela própria Estrutura › Jornadas de trabalho.
 *
 * ## Por que os onze testes de "sem regressão" viraram dois
 *
 * O arquivo antigo tinha uma cadeia cumulativa: cada aba nova ganhava um teste
 * que reconferia todas as anteriores. Essa cadeia existia para garantir a
 * **coexistência** das onze abas — exatamente o que esta tarefa desfaz.
 *
 * Em lugar dela, cada modo tem um teste que percorre **todas** as suas abas e
 * exige, a cada passo, um `h1` único e o título da aba ativa. É mais forte que
 * a cadeia antiga, não mais fraco: a cadeia conferia pares escolhidos à mão e
 * crescia por acréscimo; o laço cobre o conjunto inteiro e não pode esquecer
 * uma aba nova.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CadastrosScreen } from "./CadastrosScreen";

/**
 * Abas DESTE contêiner, não as de telas aninhadas.
 *
 * `Estrutura organizacional` tem um tablist próprio (unidades, departamentos,
 * áreas, equipes). Uma busca global por `role="tab"` encontra os dois níveis e
 * acusa duas abas selecionadas — o que seria um falso positivo, porque cada
 * tablist tem a sua seleção.
 */
function abasDoContainer() {
  return within(
    screen.getByRole("tablist", { name: "Seções de Cadastros" }),
  ).getAllByRole("tab");
}

const FUNCIONAIS = [
  {
    aba: "Estrutura organizacional",
    titulo: "Estrutura organizacional",
    id: "estrutura-organizacional-titulo",
  },
  {
    aba: "Funções e cargos",
    titulo: "Funções e cargos",
    id: "funcoes-cargos-titulo",
  },
  {
    aba: "Centros de custo",
    titulo: "Centros de custo",
    id: "centros-custo-titulo",
  },
] as const;

const DEMONSTRATIVAS = [
  {
    aba: "Calendário de feriados",
    titulo: "Calendário de feriados",
    id: "calendario-feriados-titulo",
  },
  {
    aba: "Políticas de Banco de Horas",
    titulo: "Políticas de Banco de Horas",
    id: "politicas-banco-horas-titulo",
  },
  {
    aba: "Motivos de ausência e justificativas",
    titulo: "Motivos de ausência e justificativas",
    id: "motivos-ausencia-justificativas-titulo",
  },
  {
    aba: "Tipos de documento",
    titulo: "Tipos de documento",
    id: "tipos-documento-titulo",
  },
  {
    aba: "Motivos de desligamento",
    titulo: "Motivos de desligamento",
    id: "motivos-desligamento-titulo",
  },
  { aba: "Escolaridade", titulo: "Escolaridade", id: "escolaridade-titulo" },
  {
    aba: "Cidades e localidades",
    titulo: "Cidades e localidades",
    id: "cidades-localidades-titulo",
  },
] as const;

describe("CadastrosScreen — modo funcional (T073/T080/T083/T182)", () => {
  it("mostra 'Estrutura organizacional' por padrão, com h1 único", () => {
    render(<CadastrosScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
  });

  it("T182 — não tem mais a aba Horários (virou Jornadas de trabalho)", () => {
    render(<CadastrosScreen />);
    expect(screen.queryByRole("tab", { name: "Horários" })).toBeNull();
  });

  it("expõe as três abas funcionais, na ordem, com aria-selected correto", () => {
    render(<CadastrosScreen />);

    expect(
      screen.getByRole("tablist", { name: "Seções de Cadastros" }),
    ).toBeInTheDocument();
    const abas = abasDoContainer();
    expect(abas.map((a) => a.textContent)).toEqual(
      FUNCIONAIS.map((f) => f.aba),
    );
    for (const aba of abas) {
      expect(aba.tagName).toBe("BUTTON");
      expect(aba).toHaveAttribute(
        "aria-selected",
        aba.textContent === "Estrutura organizacional" ? "true" : "false",
      );
    }
  });

  it("NÃO oferece nenhum catálogo de apoio demonstrativo", () => {
    render(<CadastrosScreen />);
    for (const { aba } of DEMONSTRATIVAS) {
      expect(screen.queryByRole("tab", { name: aba })).toBeNull();
    }
  });

  it("não monta o conteúdo de nenhuma maquete", () => {
    render(<CadastrosScreen />);
    for (const { titulo } of DEMONSTRATIVAS) {
      expect(
        screen.queryByRole("heading", { level: 1, name: titulo }),
      ).toBeNull();
    }
  });

  for (const { aba, titulo, id } of FUNCIONAIS) {
    it(`troca para '${aba}' com h1 único e informa o titleId`, () => {
      const onTituloIdChange = vi.fn();
      render(<CadastrosScreen onTituloIdChange={onTituloIdChange} />);

      fireEvent.click(screen.getByRole("tab", { name: aba }));

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(
        screen.getByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: aba })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(
        abasDoContainer().filter(
          (t) => t.getAttribute("aria-selected") === "true",
        ),
      ).toHaveLength(1);
      expect(onTituloIdChange).toHaveBeenCalledWith(id);
    });
  }

  it("percorrer todas as abas e voltar não deixa resíduo", () => {
    render(<CadastrosScreen />);
    for (const { aba, titulo } of FUNCIONAIS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      const titulos = screen.getAllByRole("heading", { level: 1 });
      expect(titulos).toHaveLength(1);
      expect(titulos[0]!.textContent).toBe(titulo);
    }
    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toBeInTheDocument();
  });

  it("clicar de novo na aba ativa não duplica o h1", () => {
    render(<CadastrosScreen />);
    fireEvent.click(
      screen.getByRole("tab", { name: "Estrutura organizacional" }),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não referencia autenticação, sessão, razão social nem dado real", () => {
    render(<CadastrosScreen />);
    for (const { aba } of FUNCIONAIS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
    }

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "senha",
      "sessão",
      "razão social",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("CadastrosScreen — modo demonstrativo (T076/T078/T081/T084/T085/T086/T087)", () => {
  it("abre no primeiro catálogo e lista os sete, na ordem", () => {
    render(<CadastrosScreen modo="demonstrativo" />);

    expect(abasDoContainer().map((a) => a.textContent)).toEqual(
      DEMONSTRATIVAS.map((d) => d.aba),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Calendário de feriados" }),
    ).toBeInTheDocument();
  });

  it("NÃO oferece nenhuma aba funcional", () => {
    render(<CadastrosScreen modo="demonstrativo" />);
    for (const { aba } of FUNCIONAIS) {
      expect(screen.queryByRole("tab", { name: aba })).toBeNull();
    }
  });

  for (const { aba, titulo, id } of DEMONSTRATIVAS) {
    it(`troca para '${aba}' com h1 único e informa o titleId`, () => {
      const onTituloIdChange = vi.fn();
      render(
        <CadastrosScreen
          modo="demonstrativo"
          onTituloIdChange={onTituloIdChange}
        />,
      );

      fireEvent.click(screen.getByRole("tab", { name: aba }));

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(
        screen.getByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(
        abasDoContainer().filter(
          (t) => t.getAttribute("aria-selected") === "true",
        ),
      ).toHaveLength(1);
      expect(onTituloIdChange).toHaveBeenCalledWith(id);
    });
  }

  it("percorrer os sete catálogos e voltar não deixa resíduo", () => {
    render(<CadastrosScreen modo="demonstrativo" />);
    for (const { aba, titulo } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      const titulos = screen.getAllByRole("heading", { level: 1 });
      expect(titulos).toHaveLength(1);
      expect(titulos[0]!.textContent).toBe(titulo);
    }
    fireEvent.click(
      screen.getByRole("tab", { name: "Calendário de feriados" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Calendário de feriados" }),
    ).toBeInTheDocument();
  });

  it("não referencia autenticação, sessão, empresa, fornecedor nem dado real", () => {
    // Lista IDÊNTICA à do modo funcional e à que existia antes da T159. Uma
    // versão anterior desta tarefa tirou "senha" e "sessão" daqui alegando
    // que as telas de exemplo contêm as palavras no próprio aviso — o aviso
    // diz "Não há login, API, persistência…", e nenhuma das sete contém
    // "senha" nem "sessão". A alegação era falsa e a guarda voltou.
    render(<CadastrosScreen modo="demonstrativo" />);
    for (const { aba } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
    }

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "senha",
      "sessão",
      "razão social",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("cada catálogo se identifica como exemplo", () => {
    render(<CadastrosScreen modo="demonstrativo" />);
    for (const { aba } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      expect(
        screen.getAllByText(/demonstraç|exemplo|ilustrativ/i).length,
      ).toBeGreaterThan(0);
    }
  });
});
