/**
 * PainelNavigation (T044) — navegação visual do painel administrativo.
 *
 * Lista os cinco destinos previstos para o painel (Início, Cadastros,
 * Pessoas, Ponto, Documentos), sem rota real: a navegação troca apenas o
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

export interface DestinoPainel {
  readonly id: string;
  readonly label: string;
}

export const DESTINOS_PAINEL: readonly DestinoPainel[] = [
  { id: "inicio", label: "Início" },
  { id: "cadastros", label: "Cadastros" },
  { id: "pessoas", label: "Pessoas" },
  { id: "ponto", label: "Ponto" },
  { id: "documentos", label: "Documentos" },
];

/** Sub-rótulo exibido junto ao destino quando ele já tem tela própria. */
const SUB_ROTULO: Record<string, string> = {
  cadastros: "Horários",
  ponto: "Verificar folhas",
};

export interface PainelNavigationProps {
  destinoAtivoId: string;
  onSelecionar: (id: string) => void;
}

export function PainelNavigation({
  destinoAtivoId,
  onSelecionar,
}: PainelNavigationProps) {
  return (
    <nav className="painel-nav" aria-label="Navegação do painel">
      <ul className="painel-nav__lista">
        {DESTINOS_PAINEL.map((destino) => {
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
                {SUB_ROTULO[destino.id] ? (
                  <>
                    <span className="painel-nav__link-grupo">
                      {destino.label}
                    </span>
                    <span className="painel-nav__link-sub">
                      {" "}
                      › {SUB_ROTULO[destino.id]}
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
    </nav>
  );
}
