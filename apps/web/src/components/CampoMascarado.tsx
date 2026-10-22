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
 * T179 (revisão final) — a recusa é avisada numa região viva (`role=status`)
 * com o texto do motivo (`avisoDaRecusa`). A MESMA recusa repetida também é
 * anunciada: a região é esvaziada e o texto volta logo depois
 * (`ATRASO_DO_REANUNCIO_MS`) — texto igual, sem a troca, o leitor de tela não
 * repetiria.
 *
 * T179 (revisão final) — o aviso vale para o valor em que a recusa aconteceu:
 * some quando o valor muda por fora (a tela recarregou ou trocou o campo) e
 * quando a tela pede (`limparAvisos`), mesmo com o valor igual — depois de
 * salvar, por exemplo. O reanúncio pendente é cancelado junto.
 *
 * O teclado é o de números (`inputMode`), e nada impede a navegação comum:
 * setas, Home/End, seleção e Tab seguem do navegador.
 *
 * `autoComplete` começa desligado de propósito: neste produto quem digita é o
 * RH ou o DP, cadastrando OUTRA pessoa — sugerir o telefone ou o CEP de quem
 * está operando seria preencher o dado errado. Quem precisar pode sobrescrever.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  avisoDaRecusa,
  colarNaMascara,
} from "../format/mascaras";
import "./CampoMascarado.css";

/**
 * T179 — quanto a região viva fica vazia antes de receber de novo o MESMO
 * aviso. Curto para quem vê, longo o bastante para a árvore de
 * acessibilidade registrar a troca (no mesmo quadro, ela se perderia).
 */
export const ATRASO_DO_REANUNCIO_MS = 100;

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
  /**
   * T179 (revisão final) — a tela limpa o aviso da recusa mudando este número
   * (um contador): depois de salvar, remover ou recomeçar.
   */
  readonly limparAvisos?: number;
}

export function CampoMascarado({
  mascara,
  value,
  onValorChange,
  limparAvisos = 0,
  onKeyDown,
  onPaste,
  autoComplete = "off",
  ...resto
}: CampoMascaradoProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  /** Cursor a aplicar depois que o valor novo chegar ao DOM. */
  const cursorPendenteRef = useRef<number | null>(null);
  /**
   * T179 (B2) — a entrada foi recusada: o valor fica como estava, e o aviso
   * diz por quê. Some na próxima mudança aceita. T179 (revisão final) —
   * guarda também o valor e a limpeza em que nasceu: só aparece enquanto os
   * dois forem os de agora.
   */
  const [recusa, setRecusa] = useState<{
    readonly texto: string;
    readonly valor: string;
    readonly limpeza: number;
  } | null>(null);
  const aviso =
    recusa && recusa.valor === value && recusa.limpeza === limparAvisos
      ? recusa.texto
      : null;
  /**
   * T179 — a região viva está vazia de propósito, à espera de receber de
   * novo o mesmo aviso (nova tentativa recusada).
   */
  const [reanunciando, setReanunciando] = useState(false);
  const reanuncioRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelarReanuncio() {
    if (reanuncioRef.current === null) return;
    clearTimeout(reanuncioRef.current);
    reanuncioRef.current = null;
  }

  // Desmontado o campo, nenhum reanúncio fica pendurado. T179 (revisão
  // final) — nem quando o valor muda por fora ou a tela limpa os avisos.
  useEffect(() => {
    const pendente = reanuncioRef;
    return () => {
      if (pendente.current !== null) clearTimeout(pendente.current);
      pendente.current = null;
    };
  }, [value, limparAvisos]);

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

  /**
   * T179 — mostra o aviso da recusa ou o tira. O mesmo aviso de novo (outra
   * tentativa recusada) esvazia a região agora e o devolve logo depois, para
   * ser anunciado outra vez.
   */
  function avisar(novo: string | null) {
    cancelarReanuncio();
    if (novo !== null && novo === aviso) {
      setReanunciando(true);
      reanuncioRef.current = setTimeout(() => {
        reanuncioRef.current = null;
        setReanunciando(false);
      }, ATRASO_DO_REANUNCIO_MS);
      return;
    }
    setReanunciando(false);
    setRecusa(
      novo === null
        ? null
        : { texto: novo, valor: value, limpeza: limparAvisos },
    );
  }

  function aplicar(campo: HTMLInputElement, estado: EstadoDoCampo) {
    avisar(estado.recusado ? avisoDaRecusa(mascara, estado.recusado) : null);
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

  const idDoAviso = resto.id ? `${resto.id}-aviso` : undefined;
  const descritoPor =
    [resto["aria-describedby"], aviso ? idDoAviso : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <>
      <input
        {...resto}
        aria-describedby={descritoPor}
        ref={ref}
        type={mascara === "telefone" ? "tel" : "text"}
        inputMode={mascara === "telefone" ? "tel" : "numeric"}
        autoComplete={autoComplete}
        value={value}
        onChange={aoMudar}
        onKeyDown={aoTeclar}
        onPaste={aoColar}
      />
      {/* Região viva SEMPRE montada (vazia sem aviso): é o que faz o leitor de
          tela anunciar a recusa no momento em que ela acontece. */}
      <span id={idDoAviso} className="campo-mascarado__aviso" role="status">
        {reanunciando ? "" : (aviso ?? "")}
      </span>
    </>
  );
}
