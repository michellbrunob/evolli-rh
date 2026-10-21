/**
 * TrilhaNavegacao (T178) — trilha de navegação ("onde estou") da página.
 *
 * Um `<nav>` rotulado com lista ORDENADA: a ordem é o conteúdo — do módulo à
 * página atual. O último item é a página atual, marcado com
 * `aria-current="page"` e nunca clicável (levaria aonde já se está).
 *
 * Itens intermediários com `onSelecionar` viram `<button>`, não `<a href>`, e
 * isso é deliberado: voltar por eles precisa passar pelo mesmo fluxo de saída
 * da página — por exemplo a confirmação de descarte da Nova admissão. Um link
 * trocaria a URL direto e pularia a confirmação. Item sem `onSelecionar` (o
 * nome do módulo, que não é uma página) é só texto.
 *
 * O separador é desenho, não conteúdo: fica `aria-hidden`, e o leitor de tela
 * ouve a lista ("lista, 3 itens") em vez de "maior que" entre os nomes.
 */
import "./TrilhaNavegacao.css";

export interface ItemTrilha {
  /** Texto visível do item. */
  readonly rotulo: string;
  /** Torna o item acionável. Ignorado no último item (a página atual). */
  readonly onSelecionar?: () => void;
}

export interface TrilhaNavegacaoProps {
  /** Do mais amplo ao atual; o último é a página atual. */
  readonly itens: readonly ItemTrilha[];
}

export function TrilhaNavegacao({ itens }: TrilhaNavegacaoProps) {
  return (
    <nav className="evolli-trilha" aria-label="Trilha de navegação">
      <ol className="evolli-trilha__lista">
        {itens.map((item, indice) => {
          const atual = indice === itens.length - 1;
          return (
            <li
              className="evolli-trilha__item"
              key={`${indice}-${item.rotulo}`}
            >
              {indice > 0 ? (
                <span className="evolli-trilha__separador" aria-hidden="true">
                  ›
                </span>
              ) : null}
              {atual ? (
                <span className="evolli-trilha__atual" aria-current="page">
                  {item.rotulo}
                </span>
              ) : item.onSelecionar ? (
                <button
                  type="button"
                  className="evolli-trilha__link"
                  onClick={item.onSelecionar}
                >
                  {item.rotulo}
                </button>
              ) : (
                <span className="evolli-trilha__texto">{item.rotulo}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
