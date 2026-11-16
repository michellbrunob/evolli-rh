/**
 * T209 — a trilha contextual da barra superior ("Pessoas / Colaboradores").
 *
 * Derivada, nunca escrita à mão por tela: a seção vem do menu lateral
 * (`menuLateral.ts`), o módulo e a tela vêm do mapa de destinos
 * (`mapaNavegacao.ts`). Nome igual ao anterior não se repete (o Dashboard é
 * só "Dashboard"). Numa sub-página (`agrupadoEm`), o item do pai leva a ele.
 * Destino desconhecido não ganha caminho inventado.
 */
import type { IconeModuloId } from "./IconeModulo";
import { GRUPOS, destinoPorId } from "./mapaNavegacao";
import { MENU_LATERAL } from "./menuLateral";

export interface ItemDaTrilha {
  readonly rotulo: string;
  /** Presente quando o item leva a uma tela (o pai de uma sub-página). */
  readonly destinoId?: string;
}

/**
 * A tela real atrás do destino, quando o rótulo do destino é o do módulo:
 * `#/configuracoes` abre em `#/configuracoes/meu-perfil` (T208).
 */
const TELA_DO_DESTINO: Readonly<Record<string, string>> = {
  configuracoes: "Meu perfil",
};

/** O ícone do módulo da tela (o mesmo do menu lateral), ou `null`. */
export function iconeDaTrilha(destinoId: string): IconeModuloId | null {
  const destino = destinoPorId(destinoId);
  if (!destino) return null;
  const baseId = destino.agrupadoEm ?? destino.id;
  return (
    GRUPOS.find((g) => g.destinos.some((d) => d.id === baseId))?.icone ?? null
  );
}

export function trilhaDoDestino(destinoId: string): ItemDaTrilha[] {
  const destino = destinoPorId(destinoId);
  if (!destino) return [];
  const base = destino.agrupadoEm
    ? (destinoPorId(destino.agrupadoEm) ?? destino)
    : destino;
  const grupo = GRUPOS.find((g) => g.destinos.some((d) => d.id === base.id));
  if (!grupo) return [];

  let secao: string | undefined;
  let modulo: string = grupo.titulo;
  for (const s of MENU_LATERAL) {
    for (const entrada of s.entradas) {
      if (entrada.tipo === "modulo" && entrada.grupo === grupo.titulo) {
        secao = s.titulo;
        modulo = entrada.rotulo ?? grupo.titulo;
      }
    }
  }

  const itens: ItemDaTrilha[] = [];
  const somar = (item: ItemDaTrilha) => {
    if (itens[itens.length - 1]?.rotulo === item.rotulo) {
      // O mesmo nome seguido: fica um só (o que leva a algum lugar).
      if (item.destinoId) itens[itens.length - 1] = item;
      return;
    }
    itens.push(item);
  };
  if (secao) somar({ rotulo: secao });
  somar({ rotulo: modulo });
  if (destino.agrupadoEm) {
    somar({ rotulo: base.label, destinoId: base.id });
    somar({ rotulo: destino.label });
  } else {
    somar({ rotulo: base.label });
    const tela = TELA_DO_DESTINO[destino.id];
    if (tela) somar({ rotulo: tela });
  }
  return itens;
}
