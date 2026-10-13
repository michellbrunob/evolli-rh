import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

/**
 * PessoasScreen — contêiner de abas (T072…T094, separado por modo na T159).
 *
 * A T159 dividiu as abas por ESTADO: o modo `funcional` (padrão) lista só as
 * seis que falam com o servidor; o modo `demonstrativo` lista as três de
 * exemplo, alcançáveis pelo grupo Demonstração da navegação.
 *
 * Nenhuma tela foi removida, e nenhuma deixou de ser testada: os casos das
 * abas demonstrativas continuam aqui, exercitados no modo em que elas vivem.
 * O que some é a mistura — e há teste explícito provando que ela sumiu.
 */
describe("PessoasScreen — modo funcional (T072/T088/T089/T090/T091)", () => {
  it("mostra 'Colaboradores' por padrão, com h1 único", () => {
    render(<PessoasScreen />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("expõe as seis abas funcionais, com aria-selected correto por padrão", () => {
    render(<PessoasScreen />);

    const tablist = screen.getByRole("tablist", { name: "Seções de Pessoas" });
    expect(tablist).toBeInTheDocument();

    const esperadas = [
      "Colaboradores",
      "Horário de trabalho",
      "Histórico funcional",
      "Dados contratuais",
      "Documentos",
      "Solicitações",
    ];
    const abas = screen.getAllByRole("tab");
    expect(abas.map((a) => a.textContent)).toEqual(esperadas);

    for (const aba of abas) {
      expect(aba.tagName).toBe("BUTTON");
      expect(aba).toHaveAttribute(
        "aria-selected",
        aba.textContent === "Colaboradores" ? "true" : "false",
      );
    }
  });

  it("NÃO oferece nenhuma aba demonstrativa — nem desabilitada, nem oculta", () => {
    render(<PessoasScreen />);
    for (const demonstrativa of ["Benefícios", "Dependentes", "Afastamentos"]) {
      expect(screen.queryByRole("tab", { name: demonstrativa })).toBeNull();
    }
    // E o conteúdo delas também não é montado: nenhuma tabela de exemplo.
    expect(screen.queryByText(/\(exemplo\)/)).toBeNull();
  });

  it("troca para 'Horário de trabalho' ao clicar na aba — preservado sem regressão (T112)", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Horário de trabalho" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-horario-titulo");
  });

  it("troca para 'Histórico funcional' ao clicar na aba — preservado sem regressão (T115)", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Histórico funcional" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH e DP")).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Histórico funcional" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("historico-funcional-titulo");
  });

  it("troca para 'Dados contratuais' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Dados contratuais" }));

    // T134 — a aba Dados contratuais passou a ser funcional (carrega dados
    // reais). Aqui (sem mocks de rede) validamos só o contrato de NAVEGAÇÃO: h1
    // único e titleId reportado. O comportamento funcional é coberto por
    // DadosContratuaisScreen.test.tsx.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dados contratuais" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", { name: "Dados contratuais" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("dados-contratuais-titulo");
  });

  it("troca para 'Documentos' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Documentos" }));

    // T133 — a aba Documentos passou a ser funcional (carrega dados reais). Aqui
    // (sem mocks de rede) só validamos o contrato de NAVEGAÇÃO: h1 único e o
    // titleId reportado. O comportamento funcional é coberto por
    // PessoasDocumentosScreen.test.tsx.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Documentos" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Documentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-documentos-titulo");
  });

  it("troca para 'Solicitações' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Solicitações" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Solicitações" }),
    ).toBeInTheDocument();
    // T140: a aba deixou de ser demonstrativa. O que a identifica agora é o
    // aviso de escopo da Central funcional, renderizado de forma síncrona —
    // a listagem em si depende da API e é coberta em SolicitacoesScreen.test.
    expect(screen.getByText(/Encaminhar é um repasse/)).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Solicitações" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Colaboradores" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("solicitacoes-titulo");
  });

  it("troca para 'Benefícios' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(
      <PessoasScreen
        modo="demonstrativo"
        onTituloIdChange={onTituloIdChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Benefícios" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Benefícios" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Benefícios (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Benefícios" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Dependentes" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("beneficios-titulo");
  });

  it("troca para 'Dependentes' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(
      <PessoasScreen
        modo="demonstrativo"
        onTituloIdChange={onTituloIdChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Dependentes" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dependentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Dependentes (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Dependentes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Benefícios" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("dependentes-titulo");
  });

  it("troca para 'Afastamentos' ao clicar na aba, com h1 único e informa o titleId", () => {
    const onTituloIdChange = vi.fn();
    render(
      <PessoasScreen
        modo="demonstrativo"
        onTituloIdChange={onTituloIdChange}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Afastamentos" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Afastamentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Afastamentos (exemplo)" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: "Afastamentos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Benefícios" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(onTituloIdChange).toHaveBeenCalledWith("afastamentos-titulo");
  });

  it("volta para 'Colaboradores' ao clicar de novo na aba", () => {
    render(<PessoasScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("passa por 'Histórico funcional' e volta para 'Colaboradores', preservando 'Horário de trabalho' sem regressão", () => {
    render(<PessoasScreen />);

    fireEvent.click(screen.getByRole("tab", { name: "Histórico funcional" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Histórico funcional" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Horário de trabalho" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Somente RH")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Colaboradores" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Colaboradores" }),
    ).toBeInTheDocument();
  });

  it("informa o titleId do h1 visível via onTituloIdChange, inclusive ao trocar de aba", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("colaboradores-titulo");

    fireEvent.click(screen.getByRole("tab", { name: "Horário de trabalho" }));
    expect(onTituloIdChange).toHaveBeenCalledWith("pessoas-horario-titulo");

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("pessoas-horario-titulo");
  });

  it("não referencia autenticação, sessão, CPF, dinheiro ou dado real", () => {
    render(<PessoasScreen />);
    for (const aba of [
      "Horário de trabalho",
      "Histórico funcional",
      "Dados contratuais",
      "Documentos",
      "Solicitações",
      "Colaboradores",
    ]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
    }

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
      "login",
      "senha",
      "sessão",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});

describe("PessoasScreen — modo demonstrativo (T092/T093/T094)", () => {
  it("abre em 'Benefícios' e lista só as três abas de exemplo", () => {
    render(<PessoasScreen modo="demonstrativo" />);

    expect(screen.getAllByRole("tab").map((a) => a.textContent)).toEqual([
      "Benefícios",
      "Dependentes",
      "Afastamentos",
    ]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Benefícios" }),
    ).toBeInTheDocument();
  });

  it("NÃO oferece nenhuma aba funcional", () => {
    render(<PessoasScreen modo="demonstrativo" />);
    for (const funcional of [
      "Colaboradores",
      "Horário de trabalho",
      "Histórico funcional",
      "Dados contratuais",
      "Documentos",
      "Solicitações",
    ]) {
      expect(screen.queryByRole("tab", { name: funcional })).toBeNull();
    }
  });

  it("não referencia empresa, fornecedor nem dado real", () => {
    render(<PessoasScreen modo="demonstrativo" />);
    for (const aba of ["Dependentes", "Afastamentos", "Benefícios"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
    }

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "reserva fiscal",
      "secullum",
      "rwtech",
      "bioprox",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("cada aba de exemplo declara, ela mesma, que não persiste nada", () => {
    // Por que a lista de termos acima não inclui "login", "senha" e "sessão",
    // como a do modo funcional: nestas telas essas palavras aparecem **na
    // própria negação** — "não há login, api, persistência…". Proibir o termo
    // reprovaria justamente o aviso que torna a tela honesta. O que se exige
    // aqui é o contrário: que o aviso exista.
    render(<PessoasScreen modo="demonstrativo" />);
    for (const aba of ["Benefícios", "Dependentes", "Afastamentos"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      expect(
        screen.getAllByText(/demonstraç|exemplo|ilustrativ/i).length,
      ).toBeGreaterThan(0);
    }
  });
});
