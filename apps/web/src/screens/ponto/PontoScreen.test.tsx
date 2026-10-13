/**
 * PontoScreen — contêiner de abas (T063…T097, separado por modo na T159).
 *
 * A T159 dividiu as abas por ESTADO. Jornada é o caso mais desigual do
 * produto: **uma** aba fala com o servidor (Visão do período) e **sete** são
 * maquetes. Mantê-las na mesma faixa fazia a navegação operacional prometer
 * apuração, banco de horas e fechamento que não existem.
 *
 * Nenhuma tela foi removida e nenhuma asserção foi enfraquecida: cada troca de
 * aba, cada `h1` único, cada `titleId` e cada ida-e-volta continuam testados —
 * agora dentro do modo em que a aba vive. O que deixou de ser testado é a
 * coexistência entre os dois conjuntos, porque é exatamente ela que acabou, e
 * há teste explícito provando que acabou.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PontoScreen } from "./PontoScreen";

/** As sete abas de exemplo, com o `h1` e o `titleId` de cada uma. */
const DEMONSTRATIVAS = [
  {
    aba: "Verificar folhas",
    titulo: "Verificar folhas",
    id: "verificar-folhas-titulo",
  },
  { aba: "Banco de Horas", titulo: "Banco de Horas", id: "banco-horas-titulo" },
  {
    aba: "Ajustes manuais",
    titulo: "Ajustes manuais",
    id: "ajustes-manuais-titulo",
  },
  {
    aba: "Fechamento e Espelho",
    titulo: "Fechamento e Espelho",
    id: "fechamento-espelho-titulo",
  },
  {
    aba: "Escalas e jornadas",
    titulo: "Escalas e jornadas",
    id: "escalas-jornadas-titulo",
  },
  {
    aba: "Inconsistências",
    titulo: "Inconsistências",
    id: "inconsistencias-titulo",
  },
  {
    aba: "Justificativas",
    titulo: "Justificativas",
    id: "justificativas-titulo",
  },
] as const;

describe("PontoScreen — modo funcional (T063)", () => {
  it("mostra 'Visão do período' por padrão, com h1 único", () => {
    render(<PontoScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeInTheDocument();
  });

  it("expõe só a aba funcional, selecionada, dentro do tablist", () => {
    render(<PontoScreen />);

    expect(
      screen.getByRole("tablist", { name: "Seções de Ponto" }),
    ).toBeInTheDocument();
    const abas = screen.getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual(["Visão do período"]);
    expect(abas[0]!.tagName).toBe("BUTTON");
    expect(abas[0]).toHaveAttribute("aria-selected", "true");
  });

  it("NÃO oferece nenhuma das sete abas demonstrativas", () => {
    render(<PontoScreen />);
    for (const { aba } of DEMONSTRATIVAS) {
      expect(screen.queryByRole("tab", { name: aba })).toBeNull();
    }
  });

  it("não monta o conteúdo de nenhuma maquete", () => {
    // A ausência da aba não bastaria: se o painel fosse renderizado escondido,
    // a promessa continuaria no DOM e num leitor de tela.
    render(<PontoScreen />);
    expect(screen.queryByText(/\(exemplo\)/)).toBeNull();
    for (const { titulo } of DEMONSTRATIVAS) {
      expect(
        screen.queryByRole("heading", { level: 1, name: titulo }),
      ).toBeNull();
    }
  });

  it("informa o titleId do h1 visível via onTituloIdChange", () => {
    const onTituloIdChange = vi.fn();
    render(<PontoScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("visao-periodo-titulo");
    expect(screen.getByRole("heading", { level: 1 }).id).toBe(
      "visao-periodo-titulo",
    );
  });
});

describe("PontoScreen — modo demonstrativo (T069/T077/T079/T095/T096/T097)", () => {
  it("abre em 'Verificar folhas' e lista as sete abas de exemplo, na ordem", () => {
    render(<PontoScreen modo="demonstrativo" />);

    expect(screen.getAllByRole("tab").map((a) => a.textContent)).toEqual(
      DEMONSTRATIVAS.map((d) => d.aba),
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();
  });

  it("NÃO oferece a aba funcional", () => {
    render(<PontoScreen modo="demonstrativo" />);
    expect(screen.queryByRole("tab", { name: "Visão do período" })).toBeNull();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Visão do período" }),
    ).toBeNull();
  });

  for (const { aba, titulo, id } of DEMONSTRATIVAS) {
    it(`troca para '${aba}' com h1 único e informa o titleId`, () => {
      const onTituloIdChange = vi.fn();
      render(
        <PontoScreen
          modo="demonstrativo"
          onTituloIdChange={onTituloIdChange}
        />,
      );

      fireEvent.click(screen.getByRole("tab", { name: aba }));

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(
        screen.getByRole("heading", { level: 1, name: titulo }),
      ).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: aba })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // Exatamente uma aba selecionada por vez.
      expect(
        screen
          .getAllByRole("tab")
          .filter((t) => t.getAttribute("aria-selected") === "true"),
      ).toHaveLength(1);
      expect(onTituloIdChange).toHaveBeenCalledWith(id);
    });
  }

  it("ida e volta entre abas não deixa resíduo: sempre um h1, sempre o da aba ativa", () => {
    // Substitui os quatro testes de "sem regressão" que existiam no arquivo
    // antigo — mesma garantia, percorrendo as sete em vez de pares escolhidos.
    render(<PontoScreen modo="demonstrativo" />);

    for (const { aba, titulo } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      const titulos = screen.getAllByRole("heading", { level: 1 });
      expect(titulos).toHaveLength(1);
      expect(titulos[0]!.textContent).toBe(titulo);
    }

    // E de volta à primeira, para provar que nada ficou preso no caminho.
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Verificar folhas" }),
    ).toBeInTheDocument();
  });

  it("clicar de novo na aba ativa não quebra nem duplica o h1", () => {
    render(<PontoScreen modo="demonstrativo" />);
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    fireEvent.click(screen.getByRole("tab", { name: "Verificar folhas" }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("não referencia CPF, salário, senha, sessão nem dado real", () => {
    // Lista IDÊNTICA à que existia antes da T159. Uma versão anterior desta
    // tarefa tirou "senha" e "sessão" daqui alegando que as telas contêm as
    // palavras no próprio aviso — o aviso diz "Não há login, API,
    // persistência…", e nenhuma das sete contém "senha" nem "sessão". A
    // alegação era falsa e a guarda voltou.
    render(<PontoScreen modo="demonstrativo" />);
    for (const { aba } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
    }

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "cpf",
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "senha",
      "sessão",
      "salário",
      "salario",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("cada aba de exemplo se identifica como exemplo", () => {
    render(<PontoScreen modo="demonstrativo" />);
    for (const { aba } of DEMONSTRATIVAS) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      expect(
        screen.getAllByText(/demonstraç|exemplo|ilustrativ/i).length,
      ).toBeGreaterThan(0);
    }
  });
});
