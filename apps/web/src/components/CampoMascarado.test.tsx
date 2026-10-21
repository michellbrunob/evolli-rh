/**
 * T179 — `CampoMascarado` ligado ao navegador: teclado numérico, dica de
 * formato por `aria-describedby`, digitação, colagem, edição no meio com o
 * cursor preservado e Backspace/Delete sobre separador.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CampoMascarado } from "./CampoMascarado";
import { FormField } from "./FormField";
import { DICA_DE_FORMATO } from "../format/mascaras";

function Campo({
  mascara,
  inicial = "",
  aoMudar,
}: {
  mascara: "cep" | "telefone";
  inicial?: string;
  aoMudar?: (v: string) => void;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <FormField
      id="campo"
      label={mascara === "cep" ? "CEP" : "Celular"}
      help={DICA_DE_FORMATO[mascara]}
    >
      {(control) => (
        <CampoMascarado
          mascara={mascara}
          value={valor}
          onValorChange={(v) => {
            setValor(v);
            aoMudar?.(v);
          }}
          {...control}
        />
      )}
    </FormField>
  );
}

const campo = () => screen.getByRole("textbox") as HTMLInputElement;

describe("T179 — CampoMascarado", () => {
  it("telefone: tipo tel, teclado de telefone, autocompletar desligado e dica ligada ao campo", () => {
    render(<Campo mascara="telefone" />);
    const input = campo();
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("inputmode", "tel");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAccessibleDescription(DICA_DE_FORMATO.telefone);
  });

  it("CEP: texto com teclado numérico e a dica 00000-000", () => {
    render(<Campo mascara="cep" />);
    expect(campo()).toHaveAttribute("type", "text");
    expect(campo()).toHaveAttribute("inputmode", "numeric");
    expect(campo()).toHaveAccessibleDescription(/00000-000/);
  });

  it("digitar mascara progressivamente e entrega o valor mascarado", () => {
    const aoMudar = vi.fn();
    render(<Campo mascara="telefone" aoMudar={aoMudar} />);
    fireEvent.change(campo(), { target: { value: "119" } });
    expect(campo()).toHaveValue("(11) 9");
    fireEvent.change(campo(), { target: { value: "(11) 98765-43210" } });
    expect(campo()).toHaveValue("(11) 98765-4321");
    expect(aoMudar).toHaveBeenLastCalledWith("(11) 98765-4321");
  });

  it("colar com +55 entra sem o código do país, no lugar da seleção", () => {
    render(<Campo mascara="telefone" />);
    fireEvent.paste(campo(), {
      clipboardData: { getData: () => "+55 11 98765-4321" },
    });
    expect(campo()).toHaveValue("(11) 98765-4321");
  });

  it("editar no meio mantém o cursor depois do dígito digitado", () => {
    render(<Campo mascara="telefone" inicial="(11) 3000-0000" />);
    const input = campo();
    input.focus();
    // Digita "5" logo depois do "-": "(11) 3000-|0000".
    fireEvent.change(input, {
      target: {
        value: "(11) 3000-50000",
        selectionStart: 11,
        selectionEnd: 11,
      },
    });
    expect(input).toHaveValue("(11) 30005-0000");
    expect(input.value.slice(0, input.selectionStart!)).toBe("(11) 30005");
  });

  it("Backspace logo depois do hífen apaga o dígito anterior", () => {
    render(<Campo mascara="cep" inicial="30140-071" />);
    const input = campo();
    input.focus();
    input.setSelectionRange(6, 6);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(input).toHaveValue("30140-71");
    expect(input.selectionStart).toBe(4);
  });

  it("Delete antes do separador apaga o dígito seguinte", () => {
    render(<Campo mascara="telefone" inicial="(11) 98765-4321" />);
    const input = campo();
    input.focus();
    input.setSelectionRange(10, 10);
    fireEvent.keyDown(input, { key: "Delete" });
    // Sem o "4", sobram 10 dígitos: a máscara volta à forma de fixo.
    expect(input).toHaveValue("(11) 9876-5321");
  });

  it("um dígito além do limite é recusado sem mover o cursor para o fim", () => {
    render(<Campo mascara="cep" inicial="30140-071" />);
    const input = campo();
    input.focus();
    fireEvent.change(input, {
      target: { value: "301940-071", selectionStart: 4, selectionEnd: 4 },
    });
    expect(input).toHaveValue("30140-071");
    expect(input.selectionStart).toBe(3);
  });
});

/** Digita caractere a caractere: cada tecla é um `change` com o valor atual + a tecla. */
function teclar(texto: string) {
  for (const tecla of texto) {
    fireEvent.change(campo(), { target: { value: campo().value + tecla } });
  }
}

describe("T179 (B1) — CampoMascarado com +55 digitado tecla a tecla", () => {
  it.each([
    ["+55 11 98765-4321", "(11) 98765-4321"],
    ["+55 91 98765-4321", "(91) 98765-4321"],
  ])("%p vira %p, como na colagem", (texto, esperado) => {
    const aoMudar = vi.fn();
    render(<Campo mascara="telefone" aoMudar={aoMudar} />);
    teclar(texto);
    expect(campo()).toHaveValue(esperado);
    expect(aoMudar).toHaveBeenLastCalledWith(esperado);
  });

  it("o + aparece enquanto o código do país é digitado, e a dica continua ligada", () => {
    render(<Campo mascara="telefone" />);
    teclar("+55");
    expect(campo()).toHaveValue("+55");
    teclar("9");
    expect(campo()).toHaveValue("(9");
    expect(campo()).toHaveAccessibleDescription(DICA_DE_FORMATO.telefone);
  });
});
