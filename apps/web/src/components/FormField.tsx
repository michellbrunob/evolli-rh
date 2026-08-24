/**
 * FormField (UI-F03) — campo de formulário acessível e reutilizável.
 *
 * Fornece rótulo, texto de ajuda, marca de obrigatório, mensagem de erro e
 * estado desabilitado, e conecta tudo ao controle via um objeto de props tipado
 * entregue por render-prop (composição). Assim o mesmo campo serve a `input`,
 * `select` e `textarea` sem clonagem frágil: o consumidor espalha `control` no
 * elemento que quiser.
 *
 * O erro é comunicado por TEXTO + ÍCONE + semântica (`aria-invalid`,
 * `role="alert"`, `aria-describedby`) — nunca só por cor.
 */
import type { ReactNode } from "react";
import "./FormField.css";

/** Props de acessibilidade a espalhar no controle (`input`/`select`/`textarea`). */
export interface FormFieldControl {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
  disabled?: boolean;
}

export interface FormFieldProps {
  /** `id` do controle — liga rótulo, ajuda e erro de forma determinística. */
  id: string;
  /** Rótulo visível, associado ao controle por `htmlFor`. */
  label: string;
  /** Texto de ajuda opcional (referenciado por `aria-describedby`). */
  help?: string;
  /** Mensagem de erro opcional (referenciada por `aria-describedby`). */
  error?: string;
  /** Marca o campo como obrigatório (visual + `aria-required` + texto p/ leitor). */
  required?: boolean;
  /** Desabilita o controle. */
  disabled?: boolean;
  /** Render-prop: recebe as props de acessibilidade a espalhar no controle. */
  children: (control: FormFieldControl) => ReactNode;
}

export function FormField({
  id,
  label,
  help,
  error,
  required = false,
  disabled = false,
  children,
}: FormFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ");

  // Monta o objeto por atribuição condicional para respeitar
  // exactOptionalPropertyTypes (nunca atribui `undefined` a prop opcional).
  const control: FormFieldControl = { id };
  if (describedBy) control["aria-describedby"] = describedBy;
  if (error) control["aria-invalid"] = true;
  if (required) control["aria-required"] = true;
  if (disabled) control.disabled = true;

  return (
    <div
      className="evolli-field"
      data-disabled={disabled || undefined}
      data-invalid={error ? true : undefined}
    >
      <label htmlFor={id} className="evolli-field__label">
        {label}
        {required ? (
          <>
            <span className="evolli-field__required" aria-hidden="true">
              *
            </span>
            <span className="evolli-field__sr"> (obrigatório)</span>
          </>
        ) : null}
      </label>

      {help ? (
        <p id={helpId} className="evolli-field__help">
          {help}
        </p>
      ) : null}

      {children(control)}

      {error ? (
        <p id={errorId} className="evolli-field__error" role="alert">
          <span className="evolli-field__error-icon" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
