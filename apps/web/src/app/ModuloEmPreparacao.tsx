/**
 * ModuloEmPreparacao (T044) — estado vazio claro para destinos ainda sem tela.
 *
 * Título de página (`h1`, único por view) + um `EmptyState` explicando que o
 * módulo está em preparação. Sem dado de domínio, sem número, sem promessa
 * de prazo. Desde T048, todos os itens de `DESTINOS_PAINEL` têm tela
 * própria; este componente permanece como retorno defensivo de `App` para
 * qualquer destino futuro fora dessa lista.
 */
import { EmptyState, PageHeader } from "../components";
import "./ModuloEmPreparacao.css";

export interface ModuloEmPreparacaoProps {
  titulo: string;
  descricao: string;
}

export function ModuloEmPreparacao({
  titulo,
  descricao,
}: ModuloEmPreparacaoProps) {
  return (
    <div className="modulo-em-preparo">
      <PageHeader headingLevel={1} titleId="modulo-titulo" title={titulo} />
      <EmptyState
        headingLevel={2}
        icon="—"
        title="Módulo em preparação"
        description={descricao}
      />
    </div>
  );
}
