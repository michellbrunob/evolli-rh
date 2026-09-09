/**
 * Relatórios > Relatórios disponíveis (T075) — tela visual estática.
 *
 * Lista demonstrativa de relatórios futuros do módulo de Ponto — apenas
 * nome e descrição, sem gerar, baixar, assinar ou exportar nenhum arquivo.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Todo dado é sintético (`relatoriosDisponiveis.fixtures.ts`).
 */
import { DataTable, PageHeader, StatusBadge, Surface } from "../../components";
import type { DataTableColumn } from "../../components";
import {
  RELATORIOS_DISPONIVEIS_EXEMPLO,
  type RelatorioDisponivelExemplo,
} from "./relatoriosDisponiveis.fixtures";
import "./RelatoriosDisponiveisScreen.css";

export const RELATORIOS_DISPONIVEIS_TITULO_ID = "relatorios-disponiveis-titulo";

export function RelatoriosDisponiveisScreen() {
  const colunas: DataTableColumn<RelatorioDisponivelExemplo>[] = [
    { key: "nome", header: "Relatório", cell: (linha) => linha.nome },
    {
      key: "descricao",
      header: "Descrição",
      cell: (linha) => linha.descricao,
    },
    {
      key: "status",
      header: "Status",
      cell: () => (
        <StatusBadge variant="neutral">Ainda não disponível</StatusBadge>
      ),
    },
  ];

  return (
    <div className="relatorios-disponiveis-screen">
      <PageHeader
        headingLevel={1}
        titleId={RELATORIOS_DISPONIVEIS_TITULO_ID}
        title="Relatórios disponíveis"
        description="Lista demonstrativa dos relatórios futuros do módulo de Ponto — apenas nome e descrição de alto nível, sem gerar nenhum arquivo."
      />

      <Surface
        as="section"
        padding="md"
        className="relatorios-disponiveis-screen__aviso"
        aria-labelledby="relatorios-disponiveis-aviso-titulo"
      >
        <StatusBadge variant="warning">Ainda não disponível</StatusBadge>
        <p
          id="relatorios-disponiveis-aviso-titulo"
          className="relatorios-disponiveis-screen__aviso-texto"
        >
          PDF, assinatura, arquivo fiscal e exportação ainda não estão
          disponíveis nesta demonstração — esta é só uma lista ilustrativa do
          que está planejado.
        </p>
      </Surface>

      <section aria-labelledby="relatorios-disponiveis-lista-titulo">
        <h2
          id="relatorios-disponiveis-lista-titulo"
          className="relatorios-disponiveis-screen__section-title"
        >
          Relatórios planejados
        </h2>
        <DataTable
          caption="Relatórios futuros do módulo de Ponto"
          columns={colunas}
          rows={RELATORIOS_DISPONIVEIS_EXEMPLO}
          rowKey={(linha) => linha.id}
        />
      </section>
    </div>
  );
}
