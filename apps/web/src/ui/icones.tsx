/**
 * T209 — ícones do ecossistema: Iconsax (`iconsax-react`, MIT), variante
 * "Bulk" (duas camadas, a de fundo com opacidade). Um ponto só de entrada:
 * as telas pedem o ícone pelo papel dele, não pelo pacote, e a troca de
 * pacote ou de variante fica aqui.
 *
 * Sempre decorativos (`aria-hidden`): o nome vem do texto ao lado.
 */
import {
  Building,
  Profile,
  Profile2User,
  ShieldTick,
  type Icon,
} from "iconsax-react";

export interface IconeProps {
  /** Tamanho em px (padrão 18, o da navegação). */
  readonly tamanho?: number;
  readonly className?: string;
}

function decorativo(Componente: Icon) {
  function IconeDoEcossistema({ tamanho = 18, className }: IconeProps) {
    return (
      <Componente
        variant="Bulk"
        size={tamanho}
        color="currentColor"
        aria-hidden="true"
        focusable="false"
        {...(className ? { className } : {})}
      />
    );
  }
  return IconeDoEcossistema;
}

export const IconePerfil = decorativo(Profile);
export const IconeSeguranca = decorativo(ShieldTick);
export const IconeEmpresa = decorativo(Building);
export const IconeEquipe = decorativo(Profile2User);
