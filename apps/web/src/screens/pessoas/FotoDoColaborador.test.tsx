/**
 * T209 — a foto do colaborador na listagem e na ficha (ADR 0020).
 *
 * A tela só conhece a VERSÃO anunciada pelo servidor; a imagem vem da rota
 * autenticada do Evolli (`/v1/colaboradores/:id/foto`), nunca de endereço do
 * armazenamento. Sem foto, ou com falha de leitura, ficam as iniciais.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FotoDoColaborador, urlDaFotoDoColaborador } from "./FotoDoColaborador";

const ID = "11111111-1111-4111-8111-111111111111";

describe("T209 — FotoDoColaborador", () => {
  it("a URL é só a rota autenticada, com tamanho e versão", () => {
    expect(urlDaFotoDoColaborador(ID, 96, 3)).toBe(
      `/v1/colaboradores/${ID}/foto?tamanho=96&v=3`,
    );
    expect(urlDaFotoDoColaborador(ID, 256, 1)).toBe(
      `/v1/colaboradores/${ID}/foto?tamanho=256&v=1`,
    );
  });

  it("com foto: imagem preguiçosa, decorativa, do tamanho pedido", () => {
    const { container } = render(
      <FotoDoColaborador
        colaboradorId={ID}
        foto={{ versao: 2 }}
        tamanho={96}
        className="avatar"
      >
        AS
      </FotoDoColaborador>,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute(
      "src",
      `/v1/colaboradores/${ID}/foto?tamanho=96&v=2`,
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("alt", "");
    expect(container.firstElementChild).toHaveClass("avatar");
    expect(container.firstElementChild).toHaveClass("avatar--foto");
    expect(container).not.toHaveTextContent("AS");
  });

  it("sem foto: as iniciais, sem nenhuma imagem nem pedido", () => {
    const { container } = render(
      <FotoDoColaborador colaboradorId={ID} foto={null} tamanho={96}>
        AS
      </FotoDoColaborador>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("falha ao ler a imagem: volta às iniciais", () => {
    const { container } = render(
      <FotoDoColaborador colaboradorId={ID} foto={{ versao: 1 }} tamanho={256}>
        AS
      </FotoDoColaborador>,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("versão nova depois de uma falha: tenta a imagem de novo", () => {
    const { container, rerender } = render(
      <FotoDoColaborador colaboradorId={ID} foto={{ versao: 1 }} tamanho={96}>
        AS
      </FotoDoColaborador>,
    );
    fireEvent.error(container.querySelector("img")!);
    rerender(
      <FotoDoColaborador colaboradorId={ID} foto={{ versao: 2 }} tamanho={96}>
        AS
      </FotoDoColaborador>,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      `/v1/colaboradores/${ID}/foto?tamanho=96&v=2`,
    );
  });
});
