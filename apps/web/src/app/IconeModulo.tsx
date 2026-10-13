/**
 * Ícones dos módulos de navegação (T159 — evolução visual).
 *
 * ## Por que SVG escrito à mão, e não uma biblioteca
 *
 * O `apps/web` não tem biblioteca de ícones, e a T159 não pode acrescentar
 * dependência nem lockfile. Mais importante: a decisão registrada em
 * `docs/decisions/t159-direcao-visual-navegacao.md` proíbe ícone proprietário
 * de terceiro. Estes seis são desenhados aqui, com geometria elementar —
 * círculos, retas e retângulos — e nada neles vem de um conjunto alheio.
 *
 * ## Contrato de acessibilidade
 *
 * Todo ícone é `aria-hidden` e `focusable="false"`: o nome acessível do item
 * de navegação vem SEMPRE do texto ao lado, nunca do desenho. Nenhum estado é
 * comunicado só pelo ícone — o item ativo soma `aria-current`, peso de fonte,
 * superfície e barra indicadora (ver `PainelNavigation.css`).
 *
 * `currentColor` em todo traço: o ícone acompanha a cor do texto do item, e
 * portanto o contraste já verificado dele.
 */

import type { ReactNode } from "react";

/** Identificadores aceitos — um por módulo da navegação. */
export type IconeModuloId =
  | "pessoas"
  | "estrutura"
  | "jornada"
  | "lideranca"
  | "administracao"
  | "demonstracao";

export interface IconeModuloProps {
  readonly nome: IconeModuloId;
}

/**
 * Traços de cada módulo. Separados num mapa para que o componente seja só
 * moldura: mesmo `viewBox`, mesma espessura, mesmo alinhamento óptico.
 */
const TRACOS: Readonly<Record<IconeModuloId, ReactNode>> = {
  // Uma pessoa: cabeça e ombros.
  pessoas: (
    <>
      <circle cx="10" cy="6.5" r="3.25" />
      <path d="M3.75 16.25c0-3.04 2.8-5.25 6.25-5.25s6.25 2.21 6.25 5.25" />
    </>
  ),
  // Organograma: um nó acima, dois abaixo, com as ligações explícitas.
  estrutura: (
    <>
      <rect x="7.25" y="2.75" width="5.5" height="4" rx="1" />
      <rect x="2.25" y="13.25" width="5.5" height="4" rx="1" />
      <rect x="12.25" y="13.25" width="5.5" height="4" rx="1" />
      <path d="M10 6.75v3.5M5 13.25v-3h10v3" />
    </>
  ),
  // Relógio: jornada é tempo.
  jornada: (
    <>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 5.75V10l3 2" />
    </>
  ),
  // Duas pessoas: quem lidera e quem é liderado.
  lideranca: (
    <>
      <circle cx="7.75" cy="6.75" r="2.75" />
      <path d="M2.5 16.25c0-2.76 2.35-4.75 5.25-4.75s5.25 1.99 5.25 4.75" />
      <path d="M13.5 4.5a2.75 2.75 0 0 1 0 5.25M15 11.75c1.6.63 2.5 2.1 2.5 3.75" />
    </>
  ),
  // Chave: o módulo administra contas de acesso.
  administracao: (
    <>
      <circle cx="6.75" cy="13.25" r="3.5" />
      <path d="M9.25 10.75 16.5 3.5M13.5 6.5l2 2M15.25 4.75l2 2" />
    </>
  ),
  // Retângulo tracejado: a convenção de "maquete", não de capacidade.
  demonstracao: (
    <>
      <rect
        x="2.75"
        y="4.25"
        width="14.5"
        height="11.5"
        rx="1.5"
        strokeDasharray="3 2.5"
      />
      <path d="M7 19.25h6" />
    </>
  ),
};

export function IconeModulo({ nome }: IconeModuloProps) {
  return (
    <svg
      className="painel-nav__icone"
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

/**
 * Marca do Evolli — desenho próprio: um quadrado arredondado com três barras
 * de larguras decrescentes, que é o "E" reduzido ao essencial. Não reproduz
 * marca, monograma nem assinatura de terceiro.
 *
 * `aria-hidden` porque o nome "Evolli RH" aparece em texto ao lado; o leitor
 * de tela não deve ouvir a marca duas vezes.
 */
export function MarcaEvolli() {
  return (
    <svg
      className="app-shell__marca-simbolo"
      viewBox="0 0 28 28"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="28" height="28" rx="7" fill="currentColor" />
      <g fill="#ffffff">
        <rect x="7" y="8" width="14" height="2.75" rx="1.375" />
        <rect x="7" y="12.625" width="10" height="2.75" rx="1.375" />
        <rect x="7" y="17.25" width="6" height="2.75" rx="1.375" />
      </g>
    </svg>
  );
}
