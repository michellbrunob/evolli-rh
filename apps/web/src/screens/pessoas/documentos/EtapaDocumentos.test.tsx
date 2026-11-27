import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  EtapaDocumentos,
  documentosIniciais,
  type DocumentoDaEtapa,
} from "./EtapaDocumentos";

/**
 * T213 — etapa 4: depois de escolher, trocar ou remover um arquivo, o foco
 * fica num controle visível e lógico da mesma linha — "Ver" quando há
 * arquivo, "Enviar arquivo" quando não há. Arquivos sintéticos.
 */

function Etapa() {
  const [documentos, setDocumentos] =
    useState<DocumentoDaEtapa[]>(documentosIniciais);
  const mudar = (id: string, mudanca: Partial<DocumentoDaEtapa>) =>
    setDocumentos((atuais) =>
      atuais.map((d) => (d.id === id ? { ...d, ...mudanca } : d)),
    );
  return (
    <EtapaDocumentos
      documentos={documentos}
      onEscolherArquivo={(id, arquivo) =>
        mudar(id, { arquivo, chaveDeEnvio: "chave-sintetica" })
      }
      onTirarArquivo={(id) => mudar(id, { arquivo: null, chaveDeEnvio: null })}
      onAdicionarOutro={(nome) =>
        setDocumentos((atuais) => [
          ...atuais,
          {
            id: `outro-${nome}`,
            categoria: "outros",
            nome,
            arquivo: null,
            chaveDeEnvio: null,
          },
        ])
      }
      onRemoverOutro={(id) =>
        setDocumentos((atuais) => atuais.filter((d) => d.id !== id))
      }
    />
  );
}

const PDF = () =>
  new File(["%PDF-1.4 %%EOF"], "rg-sintetico.pdf", { type: "application/pdf" });

const linhaDe = (nome: string) =>
  screen.getByText(nome, { selector: ".documentos__nome" }).closest("li")!;

const abrirMenu = (botao: HTMLElement) =>
  fireEvent.pointerDown(botao, {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });

function escolher(nome: string, arquivo: File) {
  fireEvent.change(within(linhaDe(nome)).getByLabelText(`Arquivo de ${nome}`), {
    target: { files: [arquivo] },
  });
}

describe("EtapaDocumentos (T213) — foco depois de cada ação (teclado)", () => {
  it("escolher um arquivo: o foco vai ao Ver da mesma linha", async () => {
    render(<Etapa />);
    const enviar = screen.getByRole("button", { name: "Enviar arquivo de RG" });
    enviar.focus();
    fireEvent.click(enviar);
    escolher("RG", PDF());
    await waitFor(() =>
      expect(
        within(linhaDe("RG")).getByRole("button", {
          name: "Ver o arquivo de RG",
        }),
      ).toHaveFocus(),
    );
  });

  it("arquivo recusado no navegador: o foco fica no Enviar arquivo, com o motivo na linha", async () => {
    render(<Etapa />);
    escolher("RG", new File(["x"], "rg.heic", { type: "image/heic" }));
    expect(within(linhaDe("RG")).getByRole("alert")).toHaveTextContent(
      "Use um arquivo PDF, JPG ou PNG.",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enviar arquivo de RG" }),
      ).toHaveFocus(),
    );
  });

  it("remover o arquivo pelo menu: o foco vai ao Enviar arquivo da linha", async () => {
    render(<Etapa />);
    escolher("RG", PDF());
    abrirMenu(
      await within(linhaDe("RG")).findByRole("button", {
        name: "Mais ações: RG",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remover arquivo" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enviar arquivo de RG" }),
      ).toHaveFocus(),
    );
  });

  it("menu aberto logo depois de escolher: o foco adiado não fecha o menu (Remover arquivo funciona)", async () => {
    render(<Etapa />);
    escolher("RG", PDF());
    // Sem esperar: o menu abre antes de o foco adiado acontecer.
    abrirMenu(
      within(linhaDe("RG")).getByRole("button", { name: "Mais ações: RG" }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Remover arquivo" }),
    );
    await waitFor(() => expect(linhaDe("RG")).toHaveTextContent("Pendente"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enviar arquivo de RG" }),
      ).toHaveFocus(),
    );
  });

  it("trocar o arquivo pelo menu: o foco volta ao Ver, com o arquivo novo", async () => {
    render(<Etapa />);
    escolher("RG", PDF());
    abrirMenu(
      await within(linhaDe("RG")).findByRole("button", {
        name: "Mais ações: RG",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Trocar arquivo" }),
    );
    escolher(
      "RG",
      new File(["%PDF-1.4 %%EOF"], "rg-novo.pdf", { type: "application/pdf" }),
    );
    expect(linhaDe("RG")).toHaveTextContent("rg-novo.pdf");
    await waitFor(() =>
      expect(
        within(linhaDe("RG")).getByRole("button", {
          name: "Ver o arquivo de RG",
        }),
      ).toHaveFocus(),
    );
  });

  it("tirar um Outro da lista: a linha sai e o foco vai ao campo Novo documento", async () => {
    render(<Etapa />);
    fireEvent.change(screen.getByLabelText("Novo documento"), {
      target: { value: "Contrato sintético" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remover Contrato sintético da lista",
      }),
    );
    expect(screen.queryByText("Contrato sintético")).toBeNull();
    await waitFor(() =>
      expect(screen.getByLabelText("Novo documento")).toHaveFocus(),
    );
  });
});
