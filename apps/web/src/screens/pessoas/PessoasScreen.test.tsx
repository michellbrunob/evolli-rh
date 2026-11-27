import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PessoasScreen } from "./PessoasScreen";

/**
 * T215 — na página de Colaboradores (desenho da referência) a faixa de
 * seções de Pessoas não aparece; o atalho da ficha para o Histórico funcional
 * saiu com a aba Vida funcional (decisão de 2026-11-23).
 */
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

  it("T215 — na página de Colaboradores, sem a faixa de seções", () => {
    render(<PessoasScreen />);
    expect(
      screen.queryByRole("tablist", { name: "Seções de Pessoas" }),
    ).toBeNull();
  });

  it("NÃO oferece nenhuma aba demonstrativa — nem desabilitada, nem oculta", () => {
    render(<PessoasScreen />);
    for (const demonstrativa of ["Benefícios", "Dependentes", "Afastamentos"]) {
      expect(screen.queryByRole("tab", { name: demonstrativa })).toBeNull();
    }
    // E o conteúdo delas também não é montado: nenhuma tabela de exemplo.
    expect(screen.queryByText(/\(exemplo\)/)).toBeNull();
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

  it("informa o titleId do h1 visível via onTituloIdChange", () => {
    const onTituloIdChange = vi.fn();
    render(<PessoasScreen onTituloIdChange={onTituloIdChange} />);

    expect(onTituloIdChange).toHaveBeenCalledWith("colaboradores-titulo");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.id).toBe("colaboradores-titulo");
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

  it("não referencia autenticação, sessão, empresa, fornecedor nem dado real", () => {
    // `login` é o ÚNICO termo fora desta lista, e por um motivo verificado:
    // as três telas o usam dentro da própria negação — "Não há login, API,
    // persistência…". Proibi-lo reprovaria o aviso que torna a tela honesta,
    // e há teste exigindo que toda ocorrência esteja nessa negação
    // (`superficiesDemonstrativas.test.tsx`).
    //
    // `senha` e `sessão` NÃO têm essa desculpa: nenhuma das três os contém.
    // Uma versão anterior da T159 os tirou daqui junto com `login`, como se
    // o mesmo motivo valesse para os três. Não valia.
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
      "senha",
      "sessão",
    ]) {
      expect(texto).not.toContain(termoProibido);
    }
  });

  it("cada aba de exemplo declara, ela mesma, que não persiste nada", () => {
    render(<PessoasScreen modo="demonstrativo" />);
    for (const aba of ["Benefícios", "Dependentes", "Afastamentos"]) {
      fireEvent.click(screen.getByRole("tab", { name: aba }));
      expect(
        screen.getAllByText(/demonstraç|exemplo|ilustrativ/i).length,
      ).toBeGreaterThan(0);
    }
  });
});
