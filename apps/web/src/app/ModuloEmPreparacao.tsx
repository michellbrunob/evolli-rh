/**
 * ModuloEmPreparacao (T044) — estado vazio claro para destinos ainda sem tela.
 *
 * Usado pelos quatro destinos do painel que não têm tela própria nesta fase
 * (Início, Pessoas, Ponto, Documentos): título de página (`h1`, único por
 * view) + um `EmptyState` explicando que o módulo está em preparação. Sem
 * dado de domínio, sem número, sem promessa de prazo.
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
