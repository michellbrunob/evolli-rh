/**
 * Ícones dos módulos de navegação (T159; T209 — Iconsax Bulk, decisão da
 * proprietária de 2026-11-17: um desenho só no produto inteiro, pelo ponto
 * único `ui/icones.tsx`).
 *
 * ## Contrato de acessibilidade
 *
 * Todo ícone é `aria-hidden` e `focusable="false"`: o nome acessível do item
 * de navegação vem SEMPRE do texto ao lado, nunca do desenho. Nenhum estado é
 * comunicado só pelo ícone — o item ativo soma `aria-current`, peso de fonte,
 * superfície e barra indicadora (ver `PainelNavigation.css`).
 *
 * `currentColor`: o ícone acompanha a cor do texto do item, e portanto o
 * contraste já verificado dele.
 */

import {
  IconeAdministracao,
  IconeConfiguracoes,
  IconeDemonstracao,
  IconeEstrutura,
  IconeJornada,
  IconeLideranca,
  IconePainel,
  IconePessoas,
  type IconeDoEcossistema,
} from "../ui/icones";

/** Identificadores aceitos — um por módulo da navegação. */
export type IconeModuloId =
  | "painel"
  | "pessoas"
  | "estrutura"
  | "jornada"
  | "lideranca"
  | "administracao"
  | "configuracoes"
  | "demonstracao";

export interface IconeModuloProps {
  readonly nome: IconeModuloId;
}

const ICONES: Readonly<Record<IconeModuloId, IconeDoEcossistema>> = {
  painel: IconePainel,
  pessoas: IconePessoas,
  estrutura: IconeEstrutura,
  jornada: IconeJornada,
  lideranca: IconeLideranca,
  administracao: IconeAdministracao,
  configuracoes: IconeConfiguracoes,
  demonstracao: IconeDemonstracao,
};

export function IconeModulo({ nome }: IconeModuloProps) {
  const Icone = ICONES[nome];
  return <Icone className="painel-nav__icone" tamanho={20} />;
}

/**
 * Marca do Evolli — desenho próprio: um quadrado arredondado com três barras
 * de larguras decrescentes, que é o "E" reduzido ao essencial. Não reproduz
 * marca, monograma nem assinatura de terceiro.
 *
 * `aria-hidden` porque o nome "Evolli RH" aparece em texto ao lado; o leitor
 * de tela não deve ouvir a marca duas vezes.
 *
 * Dois tons, um desenho só (T160): `acao` é o padrão histórico — quadrado na
 * cor do texto ao redor, barras brancas — e serve sobre superfície clara.
 * `clara` inverte para superfície da cor de ação, onde o padrão desapareceria
 * (quadrado branco com barras brancas). Duplicar o desenho num segundo
 * componente faria a marca divergir de si mesma na primeira alteração.
 */
export interface MarcaEvolliProps {
  readonly tom?: "acao" | "clara";
}

export function MarcaEvolli({ tom = "acao" }: MarcaEvolliProps = {}) {
  const fundo = tom === "clara" ? "var(--surface-canvas)" : "currentColor";
  const barras = tom === "clara" ? "var(--color-action)" : "var(--color-on-action)";
  return (
    <svg
      className="app-shell__marca-simbolo"
      viewBox="0 0 28 28"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="28" height="28" rx="7" fill={fundo} />
      <g fill={barras}>
        <rect x="7" y="8" width="14" height="2.75" rx="1.375" />
        <rect x="7" y="12.625" width="10" height="2.75" rx="1.375" />
        <rect x="7" y="17.25" width="6" height="2.75" rx="1.375" />
      </g>
    </svg>
  );
}
