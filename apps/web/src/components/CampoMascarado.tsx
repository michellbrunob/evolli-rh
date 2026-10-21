/**
 * CampoMascarado (T179) — `input` controlado com máscara de CEP ou telefone.
 *
 * Feito para viver DENTRO de um `FormField`: o consumidor espalha nele o
 * `control` do campo (id, `aria-describedby`, `aria-invalid`…), e a dica de
 * formato vai no `help` do `FormField` — que já a liga ao controle por
 * `aria-describedby`, para o leitor de tela ler o formato junto do rótulo.
 *
 * Toda a regra da máscara é pura e mora em `format/mascaras.ts`. Aqui só se
 * liga essa regra aos eventos do navegador:
 *
 *  - `onChange` — digitação, apagar, preenchimento automático: o valor é
 *    remascarado e o cursor volta para depois do mesmo DÍGITO;
 *  - `onKeyDown` — Backspace/Delete sobre separador apagam o dígito vizinho,
 *    em vez de parecerem não fazer nada;
 *  - `onPaste` — o texto colado é limpo sozinho (tira o `+55` do telefone)
 *    antes de entrar na posição da seleção.
 *
 * O teclado é o de números (`inputMode`), e nada impede a navegação comum:
 * setas, Home/End, seleção e Tab seguem do navegador.
 *
 * `autoComplete` começa desligado de propósito: neste produto quem digita é o
 * RH ou o DP, cadastrando OUTRA pessoa — sugerir o telefone ou o CEP de quem
 * está operando seria preencher o dado errado. Quem precisar pode sobrescrever.
 */
import { useLayoutEffect, useRef } from "react";
import type {
  ClipboardEvent,
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
} from "react";
import {
  type EstadoDoCampo,
  type TipoMascara,
  aplicarMascara,
  apagarComSeparador,
  colarNaMascara,
} from "../format/mascaras";

export interface CampoMascaradoProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode" | "defaultValue"
> {
  /** Qual máscara: `cep` (`00000-000`) ou `telefone` (`(00) 00000-0000`). */
  readonly mascara: TipoMascara;
  /** Valor exibido, já mascarado. */
  readonly value: string;
  /** Recebe o valor novo, já mascarado. */
  readonly onValorChange: (valor: string) => void;
}

export function CampoMascarado({
  mascara,
  value,
  onValorChange,
  onKeyDown,
  onPaste,
  autoComplete = "off",
  ...resto
}: CampoMascaradoProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  /** Cursor a aplicar depois que o valor novo chegar ao DOM. */
  const cursorPendenteRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const cursor = cursorPendenteRef.current;
    if (cursor === null) return;
    cursorPendenteRef.current = null;
    const campo = ref.current;
    // Só mexe na seleção de quem está em foco: pôr o cursor num campo de fora
    // roubaria o foco em alguns navegadores.
    if (campo && document.activeElement === campo) {
      campo.setSelectionRange(cursor, cursor);
    }
  });

  function aplicar(campo: HTMLInputElement, estado: EstadoDoCampo) {
    if (estado.valor === value) {
      // O estado não muda, então não há novo desenho: o DOM volta ao valor
      // atual aqui mesmo, sem o cursor saltar para o fim.
      campo.value = estado.valor;
      if (document.activeElement === campo) {
        campo.setSelectionRange(estado.cursor, estado.cursor);
      }
      return;
    }
    cursorPendenteRef.current = estado.cursor;
    onValorChange(estado.valor);
  }

  function aoMudar(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.target;
    const cursor = campo.selectionStart ?? campo.value.length;
    aplicar(campo, aplicarMascara(mascara, value, campo.value, cursor));
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(evento);
    if (evento.defaultPrevented) return;
    if (evento.key !== "Backspace" && evento.key !== "Delete") return;
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
    const campo = evento.currentTarget;
    const estado = apagarComSeparador(
      mascara,
      campo.value,
      campo.selectionStart ?? 0,
      campo.selectionEnd ?? 0,
      evento.key,
    );
    if (!estado) return;
    evento.preventDefault();
    aplicar(campo, estado);
  }

  function aoColar(evento: ClipboardEvent<HTMLInputElement>) {
    onPaste?.(evento);
    if (evento.defaultPrevented) return;
    const colado = evento.clipboardData?.getData("text") ?? "";
    if (colado === "") return;
    evento.preventDefault();
    const campo = evento.currentTarget;
    aplicar(
      campo,
      colarNaMascara(
        mascara,
        campo.value,
        campo.selectionStart ?? campo.value.length,
        campo.selectionEnd ?? campo.value.length,
        colado,
      ),
    );
  }

  return (
    <input
      {...resto}
      ref={ref}
      type={mascara === "telefone" ? "tel" : "text"}
      inputMode={mascara === "telefone" ? "tel" : "numeric"}
      autoComplete={autoComplete}
      value={value}
      onChange={aoMudar}
      onKeyDown={aoTeclar}
      onPaste={aoColar}
    />
  );
}
