import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

interface Row {
  id: string;
  nome: string;
}

const columns: DataTableColumn<Row>[] = [
  { key: "id", header: "Identificador", cell: (r) => r.id },
  { key: "nome", header: "Rótulo", cell: (r) => r.nome },
];

const rows: Row[] = [
  { id: "Item A", nome: "Primeiro" },
  { id: "Item B", nome: "Segundo" },
];

describe("DataTable (UI-F03)", () => {
  it("renderiza uma <table> semântica com caption acessível", () => {
    render(
      <DataTable
        caption="Itens de teste"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    const table = screen.getByRole("table", { name: "Itens de teste" });
    expect(table).toBeInTheDocument();
    // A caption é o elemento de nome acessível da tabela.
    expect(table.querySelector("caption")?.textContent).toBe("Itens de teste");
  });

  it("usa cabeçalhos de coluna com scope=col", () => {
    render(
      <DataTable
        caption="Itens"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    headers.forEach((h) => expect(h).toHaveAttribute("scope", "col"));
    expect(headers[0]).toHaveTextContent("Identificador");
  });

  it("renderiza uma linha por item com as células projetadas", () => {
    render(
      <DataTable
        caption="Itens"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    // 1 linha de cabeçalho + 2 de corpo.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("cell", { name: "Item A" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Segundo" })).toBeInTheDocument();
  });

  it("mostra o estado vazio ocupando todas as colunas", () => {
    render(
      <DataTable
        caption="Itens"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nada aqui."
      />,
    );
    const cell = screen.getByRole("cell", { name: "Nada aqui." });
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("colspan", String(columns.length));
    // Sem linhas de dados: só cabeçalho + a linha de vazio.
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("expõe a região de rolagem focável rotulada pela caption", () => {
    render(
      <DataTable
        caption="Itens roláveis"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    const region = screen.getByRole("region", { name: "Itens roláveis" });
    expect(region).toHaveAttribute("tabindex", "0");
    // A tabela vive dentro da região rolável.
    expect(within(region).getByRole("table")).toBeInTheDocument();
  });

  it("pode ocultar visualmente a caption mantendo-a acessível", () => {
    render(
      <DataTable
        caption="Legenda oculta"
        captionVisible={false}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    // Continua sendo o nome acessível da tabela mesmo oculta visualmente.
    expect(
      screen.getByRole("table", { name: "Legenda oculta" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Legenda oculta")).toHaveClass(
      "evolli-datatable__caption--sr",
    );
  });
});
