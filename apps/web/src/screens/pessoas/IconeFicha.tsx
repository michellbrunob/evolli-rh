/**
 * T198 — ícones da ficha do colaborador.
 *
 * Mesmo padrão de `IconeModulo` (T159): SVG escrito à mão, com geometria
 * elementar — círculos, retas e retângulos —, sem biblioteca e sem desenho de
 * conjunto alheio. Todo ícone é `aria-hidden` e `focusable="false"`: o nome
 * acessível vem sempre do texto ao lado, e nenhum estado é comunicado só pelo
 * desenho. `currentColor` em todo traço, para herdar o contraste do texto.
 */

import type { ReactNode } from "react";

export type IconeFichaId =
  | "dados"
  | "vida-funcional"
  | "contratuais"
  | "jornada"
  | "calendario"
  | "estrutura"
  | "cracha";

const TRACOS: Readonly<Record<IconeFichaId, ReactNode>> = {
  // Uma pessoa: cabeça e ombros.
  dados: (
    <>
      <circle cx="10" cy="6.5" r="3.25" />
      <path d="M3.75 16.25c0-3.04 2.8-5.25 6.25-5.25s6.25 2.21 6.25 5.25" />
    </>
  ),
  // Linha do tempo: três marcos ligados.
  "vida-funcional": (
    <>
      <circle cx="4.5" cy="10" r="1.75" />
      <circle cx="10" cy="10" r="1.75" />
      <circle cx="15.5" cy="10" r="1.75" />
      <path d="M6.25 10h2M11.75 10h2" />
    </>
  ),
  // Folha com linhas: o documento do vínculo.
  contratuais: (
    <>
      <rect x="4.25" y="2.75" width="11.5" height="14.5" rx="1.5" />
      <path d="M7.25 7h5.5M7.25 10h5.5M7.25 13h3.5" />
    </>
  ),
  // Relógio: jornada é tempo.
  jornada: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 5.75V10l3 2" />
    </>
  ),
  // Calendário: uma data.
  calendario: (
    <>
      <rect x="3" y="4.25" width="14" height="12.75" rx="1.5" />
      <path d="M3 8.25h14M7 2.75v3M13 2.75v3" />
    </>
  ),
  // Organograma: um nó acima, dois abaixo.
  estrutura: (
    <>
      <rect x="7.25" y="2.75" width="5.5" height="4" rx="1" />
      <rect x="2.25" y="13.25" width="5.5" height="4" rx="1" />
      <rect x="12.25" y="13.25" width="5.5" height="4" rx="1" />
      <path d="M10 6.75v3.5M5 13.25v-3h10v3" />
    </>
  ),
  // Crachá: identificação do vínculo.
  cracha: (
    <>
      <rect x="3.25" y="4.75" width="13.5" height="11.5" rx="1.5" />
      <circle cx="7.5" cy="9.75" r="1.75" />
      <path d="M5.25 13.5c.4-1.1 1.2-1.6 2.25-1.6s1.85.5 2.25 1.6M11.75 9h3M11.75 11.75h3" />
    </>
  ),
};

export interface IconeFichaProps {
  readonly nome: IconeFichaId;
}

export function IconeFicha({ nome }: IconeFichaProps) {
  return (
    <svg
      className="ficha-colaborador__icone"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACOS[nome]}
    </svg>
  );
}
