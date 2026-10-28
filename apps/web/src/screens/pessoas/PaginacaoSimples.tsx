/**
 * T188 — navegação entre páginas de um conjunto paginado pelo servidor:
 * "Anterior", "Página X de Y" e "Próxima". Usada pelo seletor de colaborador e
 * pela lista de movimentações do Histórico funcional.
 *
 * A posição é lida pelo leitor de tela como região viva discreta
 * (`aria-live="polite"`), e os botões nas pontas ficam desabilitados — nunca
 * pedem uma página que não existe.
 *
 * T192 — `focoEstavel`: os botões indisponíveis (nas pontas ou durante a
 * carga) ficam com `aria-disabled` em vez de `disabled`, para o foco
 * permanecer no botão acionado — botão desabilitado de verdade perde o foco
 * no navegador. Nesse modo quem usa o componente anuncia a carga e a posição
 * numa região viva própria, e a posição aqui deixa de ser região viva, para
 * não ser anunciada duas vezes.
 */
import { Button } from "../../components";

export interface PaginacaoSimplesProps {
  /** Rótulo da navegação, ex.: "Páginas de resultados de colaboradores". */
  readonly rotulo: string;
  readonly pagina: number;
  readonly totalPaginas: number;
  readonly carregando?: boolean;
  /** T192 — mantém o foco no botão acionado durante e depois da carga. */
  readonly focoEstavel?: boolean;
  readonly onIrPara: (pagina: number) => void;
}

export function PaginacaoSimples({
  rotulo,
  pagina,
  totalPaginas,
  carregando = false,
  focoEstavel = false,
  onIrPara,
}: PaginacaoSimplesProps) {
  if (totalPaginas <= 1) return null;
  const anteriorIndisponivel = carregando || pagina <= 1;
  const proximaIndisponivel = carregando || pagina >= totalPaginas;
  function indisponivel(sim: boolean) {
    return focoEstavel
      ? { "aria-disabled": sim, disabled: false }
      : { disabled: sim };
  }
  return (
    <nav aria-label={rotulo} className="pessoas-paginacao">
      <Button
        variant="secondary"
        {...indisponivel(anteriorIndisponivel)}
        onClick={() => {
          if (!anteriorIndisponivel) onIrPara(pagina - 1);
        }}
      >
        Anterior
      </Button>
      <span
        className="pessoas-paginacao__posicao"
        {...(focoEstavel ? {} : { "aria-live": "polite" as const })}
      >
        Página {pagina} de {totalPaginas}
      </span>
      <Button
        variant="secondary"
        {...indisponivel(proximaIndisponivel)}
        onClick={() => {
          if (!proximaIndisponivel) onIrPara(pagina + 1);
        }}
      >
        Próxima
      </Button>
    </nav>
  );
}
