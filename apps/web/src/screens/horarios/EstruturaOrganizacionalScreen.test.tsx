import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EstruturaOrganizacionalScreen } from "./EstruturaOrganizacionalScreen";

describe("EstruturaOrganizacionalScreen (T073 — tela visual estática)", () => {
  it("tem um único h1", () => {
    render(<EstruturaOrganizacionalScreen />);

    expect(
      screen.getAllByRole("heading", {
        level: 1,
        name: "Estrutura organizacional",
      }),
    ).toHaveLength(1);
  });

  it("exibe o aviso de que somente RH administra e nenhuma alteração é persistida", () => {
    render(<EstruturaOrganizacionalScreen />);

    expect(screen.getByText("Somente RH")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma alteração feita aqui é persistida/i),
    ).toBeInTheDocument();
  });

  it("exibe o aviso de que empresa real, CNPJ, cadastro fiscal, colaboradores, Folha, eSocial, API e importação ainda não estão disponíveis", () => {
    render(<EstruturaOrganizacionalScreen />);

    expect(screen.getByText("Ainda indisponível")).toBeInTheDocument();
    const aviso = document.getElementById(
      "estrutura-organizacional-aviso-indisponivel-titulo",
    )!;
    expect(aviso).toHaveTextContent(
      "Empresa real, CNPJ, cadastro fiscal, colaboradores, Folha, eSocial, API e importação ainda não estão disponíveis nesta demonstração.",
    );
  });

  it("mostra a hierarquia ilustrativa Empresa → Unidade → Departamento → Centro de custo", () => {
    render(<EstruturaOrganizacionalScreen />);

    const lista = screen
      .getByText("Hierarquia (exemplo)")
      .closest("section")!
      .querySelector("ol")!;
    const itens = within(lista).getAllByRole("listitem");

    expect(itens.map((item) => item.textContent)).toEqual([
      "Empresa",
      "Unidade",
      "Departamento",
      "Centro de custo",
    ]);
  });

  // As referências técnicas reaparecem como "vínculo superior" de outras
  // linhas (ex.: EST-2026-0001 é referência da 1ª linha e vínculo superior
  // da 2ª) — por isso a linha é localizada pela primeira célula (referência
  // técnica própria), nunca por `getByText`, que seria ambíguo.
  function localizarLinhaPorReferencia(
    tabela: HTMLElement,
    referenciaTecnica: string,
  ): HTMLElement {
    const linha = Array.from(tabela.querySelectorAll("tbody tr")).find(
      (tr) =>
        tr.querySelector("td:first-child")?.textContent === referenciaTecnica,
    );
    if (!linha) {
      throw new Error(
        `Linha com referência ${referenciaTecnica} não encontrada`,
      );
    }
    return linha as HTMLElement;
  }

  it("lista itens com referência técnica, tipo, vínculo superior, situação e responsável técnico", () => {
    render(<EstruturaOrganizacionalScreen />);

    const tabela = screen.getByRole("table", {
      name: "Itens da estrutura organizacional",
    });
    const linha = localizarLinhaPorReferencia(tabela, "EST-2026-0003");
    const dentroDaLinha = within(linha);
    expect(dentroDaLinha.getByText("Departamento")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Operações (exemplo)")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("EST-2026-0002")).toBeInTheDocument();
    expect(dentroDaLinha.getByText("Ativa")).toBeInTheDocument();
    expect(
      dentroDaLinha.getByText("RT-Estrutura-02 (exemplo)"),
    ).toBeInTheDocument();
  });

  it("mostra travessão para o item de topo, sem vínculo superior", () => {
    render(<EstruturaOrganizacionalScreen />);

    const tabela = screen.getByRole("table", {
      name: "Itens da estrutura organizacional",
    });
    const linha = localizarLinhaPorReferencia(tabela, "EST-2026-0001");
    expect(within(linha).getByText("—")).toBeInTheDocument();
  });

  it("filtra localmente por tipo e por situação", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativa" },
    });

    const tabela = screen.getByRole("table", {
      name: "Itens da estrutura organizacional",
    });
    expect(
      Array.from(tabela.querySelectorAll("tbody tr")).map(
        (tr) => tr.querySelector("td:first-child")?.textContent,
      ),
    ).toEqual(["EST-2026-0005"]);

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(Array.from(tabela.querySelectorAll("tbody tr"))).toHaveLength(5);
  });

  it("mostra EmptyState quando o filtro não corresponde a nenhum item", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.change(screen.getByLabelText("Tipo de estrutura"), {
      target: { value: "empresa" },
    });
    fireEvent.change(screen.getByLabelText("Situação"), {
      target: { value: "inativa" },
    });

    expect(
      screen.getByRole("heading", {
        name: "Nenhum item corresponde aos filtros",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado vazio e mostra o EmptyState", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Vazio" }));

    expect(
      screen.queryByRole("table", {
        name: "Itens da estrutura organizacional",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Nenhum item de estrutura cadastrado",
      }),
    ).toBeInTheDocument();
  });

  it("alterna para o estado de erro com referência ilustrativa e ação de retorno", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Erro" }));

    expect(
      screen.getByRole("heading", {
        name: "Não foi possível carregar a estrutura organizacional",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/REQ-DEMO-001034/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      screen.getByRole("table", {
        name: "Itens da estrutura organizacional",
      }),
    ).toBeInTheDocument();
  });

  it("abre o formulário 'Novo item de estrutura' e confirmar não cria, salva, altera nem persiste nada", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Novo item de estrutura" }),
    );

    const formulario = screen.getByRole("form", {
      name: "Formulário de novo item de estrutura",
    });
    expect(formulario).toBeInTheDocument();
    expect(
      screen.getByText(/nada é criado, salvo, alterado ou persistido/i),
    ).toBeInTheDocument();

    fireEvent.click(
      within(formulario).getByRole("button", {
        name: "Confirmar (demonstração)",
      }),
    );

    expect(
      screen.getByText(
        "Ação apenas demonstrativa: nenhum item de estrutura foi realmente criado, salvo, alterado ou persistido.",
      ),
    ).toBeInTheDocument();

    // A listagem não é alterada pela submissão do formulário demonstrativo.
    expect(
      screen.getByRole("table", {
        name: "Itens da estrutura organizacional",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(formulario).getByRole("button", { name: "Cancelar" }),
    );
    expect(
      screen.queryByRole("form", {
        name: "Formulário de novo item de estrutura",
      }),
    ).not.toBeInTheDocument();
  });

  it("o formulário demonstra um campo com erro de validação, comunicado por texto e semântica", () => {
    render(<EstruturaOrganizacionalScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Novo item de estrutura" }),
    );

    const erro = screen.getByText(
      "Referência técnica não encontrada nesta demonstração.",
    );
    expect(erro.closest('[role="alert"]')).toBeInTheDocument();

    const campoInvalido = screen.getByDisplayValue("EST-9999-9999");
    expect(campoInvalido).toHaveAttribute("aria-invalid", "true");
  });

  it("não contém razão social, CNPJ, nome de pessoa, endereço, documento ou valor financeiro", () => {
    render(<EstruturaOrganizacionalScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Novo item de estrutura" }),
    );

    const texto = document.body.innerHTML.toLowerCase();
    for (const termoProibido of [
      "secullum",
      "rwtech",
      "bioprox",
      "reserva fiscal",
      "senha",
      "sessão",
      "r$",
      ".pdf",
      "localstorage",
      "logradouro",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });
});
