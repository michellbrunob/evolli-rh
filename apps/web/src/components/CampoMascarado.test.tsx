/**
 * T179 — `CampoMascarado` ligado ao navegador: teclado numérico, dica de
 * formato por `aria-describedby`, digitação, colagem, edição no meio com o
 * cursor preservado e Backspace/Delete sobre separador.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ATRASO_DO_REANUNCIO_MS, CampoMascarado } from "./CampoMascarado";
import { FormField } from "./FormField";
import { AVISO_DE_RECUSA, DICA_DE_FORMATO } from "../format/mascaras";

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
    fireEvent.change(campo(), { target: { value: "(11) 98765-4321" } });
    expect(campo()).toHaveValue("(11) 98765-4321");
    expect(aoMudar).toHaveBeenLastCalledWith("(11) 98765-4321");
    // T179 (B2) — entrada que passa de 11 dígitos é recusada inteira, com
    // aviso: o valor certo fica, nenhum dígito some calado.
    fireEvent.change(campo(), { target: { value: "(11) 98765-43210" } });
    expect(campo()).toHaveValue("(11) 98765-4321");
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneExcedente,
    );
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

describe("T179 (B2) — CampoMascarado: colar depois de +, +5 ou +55, e DDD 55 completo", () => {
  function colar(texto: string) {
    const input = campo();
    input.setSelectionRange(input.value.length, input.value.length);
    fireEvent.paste(input, { clipboardData: { getData: () => texto } });
  }

  it.each([
    ["+", "55 91 98765-4321"],
    ["+5", "5 91 98765-4321"],
    ["+55", "91 98765-4321"],
  ])("digitar %p e colar %p dá (91) 98765-4321, sem aviso", (texto, colado) => {
    const aoMudar = vi.fn();
    render(<Campo mascara="telefone" aoMudar={aoMudar} />);
    teclar(texto);
    expect(campo()).toHaveValue(texto);
    colar(colado);
    expect(campo()).toHaveValue("(91) 98765-4321");
    expect(aoMudar).toHaveBeenLastCalledWith("(91) 98765-4321");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("DDD 55 completo recusa dígitos a mais, com aviso ligado ao campo, e o número fica", async () => {
    render(<Campo mascara="telefone" />);
    teclar("55999998888");
    expect(campo()).toHaveValue("(55) 99999-8888");
    teclar("12");
    expect(campo()).toHaveValue("(55) 99999-8888");
    const aviso = screen.getByRole("status");
    // T179 — a 2ª recusa igual esvazia a região e devolve o texto logo depois.
    await waitFor(() =>
      expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneExcedente),
    );
    expect(campo()).toHaveAccessibleDescription(
      new RegExp(AVISO_DE_RECUSA.telefoneExcedente.slice(0, 30)),
    );
    // A próxima mudança aceita tira o aviso.
    fireEvent.change(campo(), { target: { value: "(55) 99999-888" } });
    expect(campo()).toHaveValue("(55) 9999-9888");
    expect(aviso).toBeEmptyDOMElement();
  });

  it("colar estrangeiro com + fica sem máscara", () => {
    render(<Campo mascara="telefone" />);
    colar("+49 911 1234567");
    expect(campo()).toHaveValue("+499111234567");
  });
});

describe("T179 (revisão final) — CampoMascarado: inserção múltipla, motivo do aviso e reanúncio", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Simula arrastar/soltar, IME ou ditado: vários caracteres num `change`. */
  function inserirDeUmaVez(pos: number, extra: string) {
    const input = campo();
    const valor = input.value.slice(0, pos) + extra + input.value.slice(pos);
    const cursor = pos + extra.length;
    fireEvent.change(input, {
      target: { value: valor, selectionStart: cursor, selectionEnd: cursor },
    });
  }

  it.each([
    ["(55) 99999-8888", 15, "77"],
    ["(55) 3333-4444", 14, "55"],
    ["(11) 98765-4321", 8, "123"],
    ["(11) 3333-4444", 1, "12345"],
  ])(
    "%p com %p + %p de uma vez: recusado, valor e cursor preservados, aviso de excedente",
    (inicial, pos, extra) => {
      render(<Campo mascara="telefone" inicial={inicial} />);
      const input = campo();
      input.focus();
      inserirDeUmaVez(pos, extra);
      expect(input).toHaveValue(inicial);
      expect(input.selectionStart).toBe(pos);
      expect(screen.getByRole("status")).toHaveTextContent(
        AVISO_DE_RECUSA.telefoneExcedente,
      );
    },
  );

  it("colar num número completo é recusado, com o cursor onde estava", () => {
    render(<Campo mascara="telefone" inicial="(55) 99999-8888" />);
    const input = campo();
    input.focus();
    input.setSelectionRange(6, 6);
    fireEvent.paste(input, { clipboardData: { getData: () => "123" } });
    expect(input).toHaveValue("(55) 99999-8888");
    expect(input.selectionStart).toBe(6);
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneExcedente,
    );
  });

  it.each(["(011) 98765-4321", "Tel: 11 98765-4321 ramal 2", "55119876543210"])(
    "colar %p em campo vazio dá o aviso de formato, nunca o de excedente",
    (texto) => {
      render(<Campo mascara="telefone" />);
      fireEvent.paste(campo(), { clipboardData: { getData: () => texto } });
      expect(campo()).toHaveValue("");
      const aviso = screen.getByRole("status");
      expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneFormato);
      expect(aviso).not.toHaveTextContent(/não pode passar|completo/);
      expect(campo()).toHaveAccessibleDescription(/Use um telefone brasileiro/);
    },
  );

  it("colar em campo vazio, com +55 ou 55, continua aceito e sem aviso", () => {
    render(<Campo mascara="telefone" />);
    fireEvent.paste(campo(), {
      clipboardData: { getData: () => "5591987654321" },
    });
    expect(campo()).toHaveValue("(91) 98765-4321");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("a mesma recusa repetida é anunciada de novo: a região esvazia e o texto volta", () => {
    vi.useFakeTimers();
    render(<Campo mascara="telefone" inicial="(55) 99999-8888" />);
    const aviso = screen.getByRole("status");
    teclar("1");
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneExcedente);

    // 2ª tentativa idêntica: limpa agora…
    teclar("1");
    expect(aviso).toBeEmptyDOMElement();
    // …e o texto volta no próximo tique, para o leitor de tela repetir.
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_REANUNCIO_MS);
    });
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneExcedente);

    // 3ª tentativa: o mesmo ciclo.
    teclar("2");
    expect(aviso).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_REANUNCIO_MS);
    });
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneExcedente);
    expect(campo()).toHaveValue("(55) 99999-8888");
  });

  it("aviso de outro motivo troca na hora; mudança aceita cancela o reanúncio pendente", () => {
    vi.useFakeTimers();
    render(<Campo mascara="telefone" />);
    const aviso = screen.getByRole("status");
    fireEvent.paste(campo(), {
      clipboardData: { getData: () => "(011) 98765-4321" },
    });
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.telefoneFormato);
    fireEvent.paste(campo(), {
      clipboardData: { getData: () => "(011) 98765-4321" },
    });
    expect(aviso).toBeEmptyDOMElement();
    teclar("1");
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_REANUNCIO_MS);
    });
    expect(campo()).toHaveValue("(1");
    expect(aviso).toBeEmptyDOMElement();
  });

  it("CEP: colar além de 8 dígitos é recusado com o aviso do CEP", () => {
    render(<Campo mascara="cep" inicial="0131" />);
    const input = campo();
    input.focus();
    input.setSelectionRange(4, 4);
    fireEvent.paste(input, { clipboardData: { getData: () => "04567-000" } });
    expect(input).toHaveValue("0131");
    expect(input.selectionStart).toBe(4);
    expect(screen.getByRole("status")).toHaveTextContent(AVISO_DE_RECUSA.cep);
    expect(input).toHaveAccessibleDescription(/O CEP tem 8 dígitos/);
  });
});

// ---------------------------------------------------------------------------
// T179 (revisão final) — telefone com ramal, rótulo ou letra: recusado com o
// aviso de formato, por qualquer caminho de entrada.
// ---------------------------------------------------------------------------

const COM_TEXTO = [
  "3333-4444 ramal 25",
  "Tel 3333-4444 / ramal 21",
  "2345-6789 ramal 12",
  "ramal 25",
  "11 98765-4321 x12",
  "Cel: 11 98765-4321",
  "11 98765-4321 (WhatsApp)",
];

describe("T179 (revisão final) — CampoMascarado: telefone só com caracteres de telefone", () => {
  function esperarAvisoDeFormato() {
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneFormato,
    );
    expect(campo()).toHaveAccessibleDescription(/Use um telefone brasileiro/);
  }

  it.each(COM_TEXTO)(
    "colar %p sobre o número correto: recusado, o número fica",
    (texto) => {
      const aoMudar = vi.fn();
      render(
        <Campo
          mascara="telefone"
          inicial="(11) 98765-4321"
          aoMudar={aoMudar}
        />,
      );
      const input = campo();
      input.focus();
      input.setSelectionRange(15, 15);
      fireEvent.paste(input, { clipboardData: { getData: () => texto } });
      expect(input).toHaveValue("(11) 98765-4321");
      expect(input.selectionStart).toBe(15);
      expect(aoMudar).not.toHaveBeenCalled();
      esperarAvisoDeFormato();
    },
  );

  it.each(COM_TEXTO)("colar %p no campo vazio: recusado", (texto) => {
    render(<Campo mascara="telefone" />);
    fireEvent.paste(campo(), { clipboardData: { getData: () => texto } });
    expect(campo()).toHaveValue("");
    esperarAvisoDeFormato();
  });

  it.each(COM_TEXTO)(
    "preenchimento automático com %p (troca do valor inteiro): recusado",
    (texto) => {
      render(<Campo mascara="telefone" inicial="(11) 98765-4321" />);
      fireEvent.change(campo(), { target: { value: texto } });
      expect(campo()).toHaveValue("(11) 98765-4321");
      esperarAvisoDeFormato();
    },
  );

  it("letra digitada tecla a tecla: recusada com o mesmo aviso", () => {
    render(<Campo mascara="telefone" />);
    teclar("119876");
    teclar("x");
    expect(campo()).toHaveValue("(11) 9876");
    esperarAvisoDeFormato();
  });

  it("letra no meio do número: recusada, cursor onde estava", () => {
    render(<Campo mascara="telefone" inicial="(11) 98765-4321" />);
    const input = campo();
    input.focus();
    fireEvent.change(input, {
      target: { value: "(11) 98r765-4321", selectionStart: 8, selectionEnd: 8 },
    });
    expect(input).toHaveValue("(11) 98765-4321");
    expect(input.selectionStart).toBe(7);
    esperarAvisoDeFormato();
  });

  it.each([
    "11 98765 4321",
    "(11) 98765-4321",
    "11.98765.4321",
    "+55 (11) 98765-4321",
  ])("%p continua aceito, sem aviso", (texto) => {
    render(<Campo mascara="telefone" />);
    fireEvent.paste(campo(), { clipboardData: { getData: () => texto } });
    expect(campo()).toHaveValue("(11) 98765-4321");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// T179 (revisão final) — avisos velhos: somem quando o valor muda por fora e
// quando a tela pede (`limparAvisos`).
// ---------------------------------------------------------------------------

/** Campo com os controles da tela: trocar o valor por fora e limpar avisos. */
function CampoNaTela({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const [limpeza, setLimpeza] = useState(0);
  return (
    <>
      <FormField id="campo" label="Celular" help={DICA_DE_FORMATO.telefone}>
        {(control) => (
          <CampoMascarado
            mascara="telefone"
            value={valor}
            onValorChange={setValor}
            limparAvisos={limpeza}
            {...control}
          />
        )}
      </FormField>
      <button type="button" onClick={() => setValor("(21) 3333-4444")}>
        Trocar por fora
      </button>
      <button type="button" onClick={() => setLimpeza((n) => n + 1)}>
        Limpar avisos
      </button>
    </>
  );
}

describe("T179 (revisão final) — CampoMascarado: avisos velhos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a tela limpa o aviso com limparAvisos, mesmo com o valor igual", () => {
    render(<CampoNaTela inicial="(11) 98765-4321" />);
    teclar("1");
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneExcedente,
    );
    fireEvent.click(screen.getByRole("button", { name: "Limpar avisos" }));
    expect(campo()).toHaveValue("(11) 98765-4321");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(campo()).toHaveAccessibleDescription(DICA_DE_FORMATO.telefone);
    // Nova recusa depois da limpeza volta a avisar na hora.
    teclar("1");
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneExcedente,
    );
  });

  it("o valor trocado por fora tira o aviso", () => {
    render(<CampoNaTela inicial="(11) 98765-4321" />);
    teclar("1");
    expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Trocar por fora" }));
    expect(campo()).toHaveValue("(21) 3333-4444");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(campo()).toHaveAccessibleDescription(DICA_DE_FORMATO.telefone);
  });

  it("limpar cancela o reanúncio pendente: o aviso não volta depois", () => {
    vi.useFakeTimers();
    render(<CampoNaTela inicial="(11) 98765-4321" />);
    teclar("1");
    teclar("1");
    // Reanúncio pendente: a região está vazia à espera do texto.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "Limpar avisos" }));
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_REANUNCIO_MS * 2);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// T179 (revisão final) — `+` trocando uma seleção parcial e CEP com texto
// misturado: recusados com o aviso de formato, na região viva.
// ---------------------------------------------------------------------------

describe("T179 (revisão final) — CampoMascarado: + sobre seleção parcial", () => {
  /** Troca a seleção `[inicio, fim)` por `texto` num `change` só (tecla ou arrastar). */
  function trocarSelecao(inicio: number, fim: number, texto: string) {
    const input = campo();
    input.focus();
    input.setSelectionRange(inicio, fim);
    const valor = input.value.slice(0, inicio) + texto + input.value.slice(fim);
    const cursor = inicio + texto.length;
    fireEvent.change(input, {
      target: { value: valor, selectionStart: cursor, selectionEnd: cursor },
    });
  }

  it.each([
    ["(55) 98765-4321", 0, 1],
    ["(55) 98765-4321", 0, 2],
    ["(55) 98765-4321", 0, 3],
    ["(55) 3234-5678", 0, 1],
    ["(55) 3234-5678", 0, 8],
    ["(11) 98765-4321", 0, 1],
    ["(11) 98765-4321", 5, 8],
  ])(
    "%p com [%i,%i) trocado por + digitado: recusado, valor e cursor preservados, aviso de formato",
    (inicial, inicio, fim) => {
      render(<Campo mascara="telefone" inicial={inicial} />);
      trocarSelecao(inicio, fim, "+");
      expect(campo()).toHaveValue(inicial);
      expect(campo().selectionStart).toBe(fim);
      expect(screen.getByRole("status")).toHaveTextContent(
        AVISO_DE_RECUSA.telefoneFormato,
      );
      expect(campo()).toHaveAccessibleDescription(/Use um telefone brasileiro/);
    },
  );

  it.each([
    ["+", 0, 1],
    ["+", 0, 2],
    ["+55", 0, 1],
    ["+55", 0, 3],
    ["+55 ", 0, 8],
  ])(
    "colar %p sobre [%i,%i) de (55) 98765-4321: recusado, cursor no início da seleção",
    (colado, inicio, fim) => {
      render(<Campo mascara="telefone" inicial="(55) 98765-4321" />);
      const input = campo();
      input.focus();
      input.setSelectionRange(inicio, fim);
      fireEvent.paste(input, { clipboardData: { getData: () => colado } });
      expect(input).toHaveValue("(55) 98765-4321");
      expect(input.selectionStart).toBe(inicio);
      expect(screen.getByRole("status")).toHaveTextContent(
        AVISO_DE_RECUSA.telefoneFormato,
      );
    },
  );

  it("digitar depois da recusa não leva a outro número", () => {
    render(<Campo mascara="telefone" inicial="(55) 3234-5678" />);
    trocarSelecao(0, 1, "+");
    expect(campo()).toHaveValue("(55) 3234-5678");
    // No fim: o 9 vira o 11º dígito e o 0 é excedente; o DDD segue 55.
    teclar("90");
    expect(campo()).toHaveValue("(55) 32345-6789");
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.telefoneExcedente,
    );
  });

  it("colar +55… com o número inteiro selecionado continua aceito, sem aviso", () => {
    render(<Campo mascara="telefone" inicial="(55) 98765-4321" />);
    const input = campo();
    input.focus();
    input.setSelectionRange(0, 15);
    fireEvent.paste(input, {
      clipboardData: { getData: () => "+55 11 3333-4444" },
    });
    expect(input).toHaveValue("(11) 3333-4444");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("T179 (revisão final) — CampoMascarado: CEP com texto misturado", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    "Nº 5, 0131010",
    "CEP: 01310-100",
    "01310-1OO",
    "01310 100",
    "０１３１０１００",
    "01310/100",
  ])(
    "colar %p é recusado com o aviso de formato do CEP, e o campo fica vazio",
    (texto) => {
      render(<Campo mascara="cep" />);
      fireEvent.paste(campo(), { clipboardData: { getData: () => texto } });
      expect(campo()).toHaveValue("");
      expect(screen.getByRole("status")).toHaveTextContent(
        AVISO_DE_RECUSA.cepFormato,
      );
      expect(campo()).toHaveAccessibleDescription(/Use um CEP brasileiro/);
    },
  );

  it("letra digitada no meio: recusada, cursor onde estava", () => {
    render(<Campo mascara="cep" inicial="01310-100" />);
    const input = campo();
    input.focus();
    fireEvent.change(input, {
      target: { value: "01310O-100", selectionStart: 6, selectionEnd: 6 },
    });
    expect(input).toHaveValue("01310-100");
    expect(input.selectionStart).toBe(5);
    expect(screen.getByRole("status")).toHaveTextContent(
      AVISO_DE_RECUSA.cepFormato,
    );
  });

  it("formato e excedente têm avisos próprios, e a mesma recusa é reanunciada", () => {
    vi.useFakeTimers();
    render(<Campo mascara="cep" inicial="01310-100" />);
    const aviso = screen.getByRole("status");
    teclar("1");
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.cep);
    teclar("a");
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.cepFormato);
    teclar("a");
    expect(aviso).toBeEmptyDOMElement();
    act(() => {
      vi.advanceTimersByTime(ATRASO_DO_REANUNCIO_MS);
    });
    expect(aviso).toHaveTextContent(AVISO_DE_RECUSA.cepFormato);
    expect(campo()).toHaveValue("01310-100");
  });

  it.each(["01310-100", "01310100", "01310 100", "01.310-100"])(
    "%p continua aceito, sem aviso",
    (texto) => {
      render(<Campo mascara="cep" />);
      fireEvent.paste(campo(), { clipboardData: { getData: () => texto } });
      expect(campo()).toHaveValue("01310-100");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    },
  );
});
