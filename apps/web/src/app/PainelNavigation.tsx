/**
 * PainelNavigation (T044) — navegação visual do painel administrativo.
 *
 * Lista os oito destinos previstos para o painel (Início, Cadastros,
 * Pessoas, Ponto, Documentos, Portal do Colaborador, Solicitações,
 * Relatórios), sem rota real: a navegação troca apenas o
 * estado local de "destino selecionado" — não há React Router, `history`,
 * `<a href>` real, API nem fetch. É coerente com
 * `docs/modules/painel-administrativo-web-v1.md` (§3.6): a ocultação/seleção
 * de item é conveniência de interface, nunca controle de autorização — cada
 * tela futura seguirá dependendo da decisão do servidor.
 *
 * Layout responsivo por CSS apenas: a MESMA lista de botões vira uma barra
 * lateral vertical em telas largas e uma faixa horizontal (com rolagem
 * própria, contida) em telas estreitas — nunca dois DOMs paralelos, para não
 * duplicar a ordem de tabulação.
 *
 * Item ativo nunca depende só de cor: usa `aria-current="page"` (semântica),
 * peso de fonte maior e uma barra lateral sólida (forma), reforçando o
 * mesmo princípio já usado no `StatusBadge` (texto + glifo + cor).
 */
import "./PainelNavigation.css";

import {
  DESTINOS,
  GRUPOS,
  destinoVisivelPara,
  type DestinoNavegacao,
} from "./mapaNavegacao";

/**
 * T159 — os destinos e os grupos deixam de ser declarados aqui.
 *
 * A fonte única passou a ser `mapaNavegacao.ts`, porque a mesma informação era
 * precisa em três lugares (lista, sub-rótulo e agrupamento) e já tinha
 * divergido entre eles. Reexportado para não quebrar quem importava daqui.
 */
export type DestinoPainel = DestinoNavegacao;
export const DESTINOS_PAINEL = DESTINOS;

export interface PainelNavigationProps {
  destinoAtivoId: string;
  onSelecionar: (id: string) => void;
  /**
   * Papel que o SERVIDOR informou. Decide quais destinos condicionados a uma
   * capacidade aparecem — `null` enquanto não se sabe, que é o padrão seguro:
   * na dúvida não se oferece.
   *
   * Isto é conveniência de interface, nunca autorização (spec §3.6). Esconder
   * um item não protege nada; o RBAC decide cada requisição. O que se evita é
   * oferecer um caminho que sempre responderia 403.
   */
  papel?: string | null;
}

export function PainelNavigation({
  destinoAtivoId,
  onSelecionar,
  papel = null,
}: PainelNavigationProps) {
  return (
    <nav className="painel-nav" aria-label="Navegação do painel">
      {GRUPOS.map((grupo) => {
        const visiveis = grupo.destinos.filter((d) =>
          destinoVisivelPara(d, papel),
        );
        // Grupo que ficou sem destino não vira cabeçalho órfão.
        if (visiveis.length === 0) return null;
        const tituloId = `nav-grupo-${grupo.titulo}`;
        const descricaoId = grupo.descricao
          ? `${tituloId}-descricao`
          : undefined;
        return (
          <div className="painel-nav__grupo" key={grupo.titulo}>
            <p className="painel-nav__grupo-titulo" id={tituloId}>
              {grupo.titulo}
            </p>
            {grupo.descricao ? (
              <p className="painel-nav__grupo-descricao" id={descricaoId}>
                {grupo.descricao}
              </p>
            ) : null}
            <ul
              className="painel-nav__lista"
              aria-labelledby={tituloId}
              {...(descricaoId ? { "aria-describedby": descricaoId } : {})}
            >
              {visiveis.map((destino) => {
                const ativo = destino.id === destinoAtivoId;
                return (
                  <li key={destino.id} className="painel-nav__item">
                    <button
                      type="button"
                      className={
                        ativo
                          ? "painel-nav__link painel-nav__link--ativo"
                          : "painel-nav__link"
                      }
                      aria-current={ativo ? "page" : undefined}
                      onClick={() => onSelecionar(destino.id)}
                    >
                      {destino.subRotulo ? (
                        <>
                          <span className="painel-nav__link-grupo">
                            {destino.label}
                          </span>
                          <span className="painel-nav__link-sub">
                            {" "}
                            › {destino.subRotulo}
                          </span>
                        </>
                      ) : (
                        destino.label
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
