/**
 * T188 — navegação entre páginas de um conjunto paginado pelo servidor:
 * "Anterior", "Página X de Y" e "Próxima". Usada pelo seletor de colaborador e
 * pela lista de movimentações do Histórico funcional.
 *
 * A posição é lida pelo leitor de tela como região viva discreta
 * (`aria-live="polite"`), e os botões nas pontas ficam desabilitados — nunca
 * pedem uma página que não existe.
 */
import { Button } from "../../components";

export interface PaginacaoSimplesProps {
  /** Rótulo da navegação, ex.: "Páginas de resultados de colaboradores". */
  readonly rotulo: string;
  readonly pagina: number;
  readonly totalPaginas: number;
  readonly carregando?: boolean;
  readonly onIrPara: (pagina: number) => void;
}

export function PaginacaoSimples({
  rotulo,
  pagina,
  totalPaginas,
  carregando = false,
  onIrPara,
}: PaginacaoSimplesProps) {
  if (totalPaginas <= 1) return null;
  return (
    <nav aria-label={rotulo} className="pessoas-paginacao">
      <Button
        variant="secondary"
        disabled={carregando || pagina <= 1}
        onClick={() => onIrPara(pagina - 1)}
      >
        Anterior
      </Button>
      <span className="pessoas-paginacao__posicao" aria-live="polite">
        Página {pagina} de {totalPaginas}
      </span>
      <Button
        variant="secondary"
        disabled={carregando || pagina >= totalPaginas}
        onClick={() => onIrPara(pagina + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
