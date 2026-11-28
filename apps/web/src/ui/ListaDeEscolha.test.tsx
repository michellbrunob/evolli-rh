/**
 * T215 — lista de escolha própria (combobox só de seleção, padrão WAI-ARIA):
 * abre embaixo do campo, marca a opção escolhida, teclado completo, fecha com
 * Esc ou clique fora sem propagar o Esc para janelas ao redor.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListaDeEscolha, type OpcaoDaLista } from "./ListaDeEscolha";

const GENEROS: readonly OpcaoDaLista[] = [
  { valor: "feminino", rotulo: "Feminino" },
  { valor: "masculino", rotulo: "Masculino" },
  { valor: "outro", rotulo: "Outro" },
  { valor: "nao_informado", rotulo: "Prefiro não informar" },
];

function Controlada({
  inicial = "",
  onMudar,
  opcoes = GENEROS,
}: {
  readonly inicial?: string;
  readonly onMudar?: (v: string) => void;
  readonly opcoes?: readonly OpcaoDaLista[];
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="genero">Gênero</label>
      <ListaDeEscolha
        id="genero"
        opcoes={opcoes}
        valor={valor}
        vazio="Selecione"
        onMudar={(v) => {
          setValor(v);
          onMudar?.(v);
        }}
      />
      <button type="button">Fora</button>
    </>
  );
}

const campo = () => screen.getByRole("combobox", { name: "Gênero" });
const lista = () => screen.queryByRole("listbox");

describe("ListaDeEscolha", () => {
  it("mostra o vazio, abre com clique e escolhe a opção", () => {
    const onMudar = vi.fn();
    render(<Controlada onMudar={onMudar} />);
    expect(campo()).toHaveTextContent("Selecione");
    expect(campo()).toHaveAttribute("aria-expanded", "false");
    expect(lista()).toBeNull();

    fireEvent.click(campo());
    expect(campo()).toHaveAttribute("aria-expanded", "true");
    const opcoes = within(lista()!).getAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual([
      "Feminino",
      "Masculino",
      "Outro",
      "Prefiro não informar",
    ]);

    fireEvent.click(screen.getByRole("option", { name: "Masculino" }));
    expect(onMudar).toHaveBeenCalledWith("masculino");
    expect(lista()).toBeNull();
    expect(campo()).toHaveTextContent("Masculino");
    expect(campo()).toHaveFocus();
  });

  it("marca a opção escolhida e abre nela", () => {
    render(<Controlada inicial="outro" />);
    fireEvent.click(campo());
    const marcada = screen.getByRole("option", { name: "Outro" });
    expect(marcada).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Feminino" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(campo()).toHaveAttribute("aria-activedescendant", marcada.id);
  });

  it("teclado: setas, Home, End, Enter escolhe; sem volta nas pontas", () => {
    const onMudar = vi.fn();
    render(<Controlada onMudar={onMudar} />);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    const ativa = () =>
      document.getElementById(campo().getAttribute("aria-activedescendant")!);
    expect(ativa()).toHaveTextContent("Feminino");
    fireEvent.keyDown(campo(), { key: "ArrowUp" });
    expect(ativa()).toHaveTextContent("Feminino");
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    expect(ativa()).toHaveTextContent("Masculino");
    fireEvent.keyDown(campo(), { key: "End" });
    expect(ativa()).toHaveTextContent("Prefiro não informar");
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    expect(ativa()).toHaveTextContent("Prefiro não informar");
    fireEvent.keyDown(campo(), { key: "Home" });
    expect(ativa()).toHaveTextContent("Feminino");
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(onMudar).toHaveBeenCalledWith("feminino");
    expect(lista()).toBeNull();
  });

  it("seta para cima fechada abre na última; Espaço abre e escolhe", () => {
    const onMudar = vi.fn();
    render(<Controlada onMudar={onMudar} />);
    fireEvent.keyDown(campo(), { key: "ArrowUp" });
    expect(
      document.getElementById(campo().getAttribute("aria-activedescendant")!),
    ).toHaveTextContent("Prefiro não informar");
    fireEvent.keyDown(campo(), { key: " " });
    expect(onMudar).toHaveBeenCalledWith("nao_informado");
  });

  it("Esc fecha sem escolher e não chega a quem está em volta", () => {
    const fora = vi.fn();
    const onMudar = vi.fn();
    render(
      <div
        onKeyDown={(e) => {
          if (e.key === "Escape") fora();
        }}
      >
        <Controlada inicial="masculino" onMudar={onMudar} />
      </div>,
    );
    fireEvent.click(campo());
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    fireEvent.keyDown(campo(), { key: "Escape" });
    expect(lista()).toBeNull();
    expect(onMudar).not.toHaveBeenCalled();
    expect(campo()).toHaveTextContent("Masculino");
    expect(fora).not.toHaveBeenCalled();
    // Fechada, o Esc segue para quem está em volta (fechar a janela).
    fireEvent.keyDown(campo(), { key: "Escape" });
    expect(fora).toHaveBeenCalledTimes(1);
  });

  it("clique fora e Tab fecham sem escolher", () => {
    const onMudar = vi.fn();
    render(<Controlada onMudar={onMudar} />);
    fireEvent.click(campo());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Fora" }));
    expect(lista()).toBeNull();
    fireEvent.click(campo());
    fireEvent.keyDown(campo(), { key: "Tab" });
    expect(lista()).toBeNull();
    expect(onMudar).not.toHaveBeenCalled();
  });

  it("busca pela letra digitada, sem acento e sem caixa", () => {
    vi.useFakeTimers();
    try {
      const onMudar = vi.fn();
      render(<Controlada onMudar={onMudar} />);
      fireEvent.keyDown(campo(), { key: "p" });
      expect(lista()).not.toBeNull();
      const ativa = () =>
        document.getElementById(campo().getAttribute("aria-activedescendant")!);
      expect(ativa()).toHaveTextContent("Prefiro não informar");
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      fireEvent.keyDown(campo(), { key: "M" });
      expect(ativa()).toHaveTextContent("Masculino");
      fireEvent.keyDown(campo(), { key: "Enter" });
      expect(onMudar).toHaveBeenCalledWith("masculino");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a letra sem acento acha a opção acentuada", () => {
    const onMudar = vi.fn();
    render(
      <Controlada
        onMudar={onMudar}
        opcoes={[
          { valor: "a", rotulo: "Área técnica" },
          { valor: "q", rotulo: "Arquivo" },
        ]}
      />,
    );
    fireEvent.keyDown(campo(), { key: "a" });
    fireEvent.keyDown(campo(), { key: "r" });
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(onMudar).toHaveBeenCalledWith("a");
  });

  it("valor fora das opções aparece como está (dado antigo)", () => {
    render(<Controlada inicial="Separado(a)" />);
    expect(campo()).toHaveTextContent("Separado(a)");
  });

  it("desabilitada não abre; inválida e descrição chegam ao campo", () => {
    render(
      <>
        <ListaDeEscolha
          aria-label="UF"
          opcoes={[{ valor: "SP", rotulo: "SP" }]}
          valor=""
          vazio="UF"
          disabled
          onMudar={() => undefined}
        />
        <ListaDeEscolha
          aria-label="Nível"
          aria-invalid
          aria-describedby="erro-nivel"
          opcoes={[{ valor: "pleno", rotulo: "Pleno" }]}
          valor=""
          vazio="Nível"
          onMudar={() => undefined}
        />
      </>,
    );
    const uf = screen.getByRole("combobox", { name: "UF" });
    fireEvent.click(uf);
    expect(lista()).toBeNull();
    expect(uf).toBeDisabled();
    const nivel = screen.getByRole("combobox", { name: "Nível" });
    expect(nivel).toHaveAttribute("aria-invalid", "true");
    expect(nivel).toHaveAttribute("aria-describedby", "erro-nivel");
  });

  it("opção com descrição mostra as duas linhas", () => {
    render(
      <Controlada
        opcoes={[{ valor: "5x2", rotulo: "5x2", descricao: "Segunda a sexta" }]}
      />,
    );
    fireEvent.click(campo());
    const opcao = screen.getByRole("option", { name: /5x2/ });
    expect(opcao).toHaveTextContent("5x2");
    expect(opcao).toHaveTextContent("Segunda a sexta");
  });

  it("perto do pé da tela abre para cima; com direção 'abaixo', sempre embaixo", () => {
    const pertoDoPe = {
      top: window.innerHeight - 50,
      bottom: window.innerHeight - 10,
      left: 0,
      right: 100,
      width: 100,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    const { unmount } = render(<Controlada />);
    vi.spyOn(campo(), "getBoundingClientRect").mockReturnValue(pertoDoPe);
    fireEvent.click(campo());
    expect(lista()).toHaveClass("lista-escolha__lista--acima");
    unmount();
    render(
      <>
        <label htmlFor="d">Departamento</label>
        <ListaDeEscolha
          id="d"
          direcao="abaixo"
          opcoes={GENEROS}
          valor=""
          onMudar={() => undefined}
        />
      </>,
    );
    const outro = screen.getByRole("combobox", { name: "Departamento" });
    vi.spyOn(outro, "getBoundingClientRect").mockReturnValue(pertoDoPe);
    fireEvent.click(outro);
    expect(lista()).not.toHaveClass("lista-escolha__lista--acima");
  });
});
