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
  IconeBeneficios,
  IconeConfiguracoes,
  IconeDemonstracao,
  IconeEstrutura,
  IconeJornada,
  IconeLideranca,
  IconePainel,
  IconePessoas,
  IconeSeguranca,
  type IconeDoEcossistema,
} from "../ui/icones";

/** Identificadores aceitos — um por módulo da navegação. */
export type IconeModuloId =
  | "painel"
  | "pessoas"
  | "estrutura"
  | "jornada"
  | "lideranca"
  | "beneficios"
  | "administracao"
  | "seguranca"
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
  beneficios: IconeBeneficios,
  administracao: IconeAdministracao,
  seguranca: IconeSeguranca,
  configuracoes: IconeConfiguracoes,
  demonstracao: IconeDemonstracao,
};

export function IconeModulo({ nome }: IconeModuloProps) {
  const Icone = ICONES[nome];
  return <Icone className="painel-nav__icone" tamanho={20} />;
}
