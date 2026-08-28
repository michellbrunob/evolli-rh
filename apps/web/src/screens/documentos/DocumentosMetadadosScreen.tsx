/**
 * Documentos > Metadados (T047) — tela visual estática.
 *
 * Demonstra o catálogo de tipos documentais e os registros de documentos e
 * solicitações, refletindo os conceitos já materializados no backend
 * (`apps/api/src/documentos/`, ADR 0011): metadado e conteúdo são
 * segregados por construção — "nenhuma entidade de metadado carrega bytes,
 * base64, stream... nem caminho público de conteúdo" (decisão 1) — e o
 * upload permanece desabilitado como estado sem transição de saída
 * (decisão 2).
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência. Todo dado é sintético
 * (`documentosMetadados.fixtures.ts`).
 *
 * Proibições absolutas nesta tela, por design: nada de upload, anexo,
 * visualização, download, URL, storage, arquivo ou botão que sugira
 * qualquer uma dessas ações — só metadado (identificadores técnicos,
 * situação, data e validade ilustrativa) é exibido.
 */
import { useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type CategoriaRegistro,
  formatarDataBr,
  formatarValidade,
  REGISTROS_DOCUMENTO_EXEMPLO,
  type RegistroDocumentoExemplo,
  ROTULO_CATEGORIA,
  ROTULO_SITUACAO,
  type SituacaoRegistroDocumento,
  TIPOS_DOCUMENTO_EXEMPLO,
} from "./documentosMetadados.fixtures";
import "./DocumentosMetadadosScreen.css";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoRegistroDocumento, StatusVariant> = {
  metadado_ativo: "success",
  metadado_substituido: "neutral",
  solicitacao_pendente: "warning",
};

const VARIANTE_CATEGORIA: Record<CategoriaRegistro, StatusVariant> = {
  documento: "info",
  solicitacao: "neutral",
};

export function DocumentosMetadadosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");

  const linhas = estadoDemo === "vazio" ? [] : REGISTROS_DOCUMENTO_EXEMPLO;

  const colunasTipos: DataTableColumn<
    (typeof TIPOS_DOCUMENTO_EXEMPLO)[number]
  >[] = [
    { key: "codigo", header: "Código", cell: (linha) => linha.codigo },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "classificacao",
      header: "Classificação",
      cell: () => <StatusBadge variant="neutral">Restrito</StatusBadge>,
    },
  ];

  const colunasRegistros: DataTableColumn<RegistroDocumentoExemplo>[] = [
    { key: "vinculo", header: "Colaborador", cell: (linha) => linha.vinculo },
    {
      key: "tipo",
      header: "Tipo documental",
      cell: (linha) => linha.tipoDocumento,
    },
    {
      key: "categoria",
      header: "Registro",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_CATEGORIA[linha.categoria]}>
          {ROTULO_CATEGORIA[linha.categoria]}
        </StatusBadge>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "data",
      header: "Data",
      cell: (linha) => formatarDataBr(linha.data),
    },
    {
      key: "validade",
      header: "Validade",
      cell: (linha) => formatarValidade(linha),
    },
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
  ];

  return (
    <div className="documentos-metadados-screen">
      <PageHeader
        headingLevel={1}
        titleId="documentos-metadados-titulo"
        title="Metadados de documentos"
        description="Catálogo de tipos documentais e os registros de documentos e solicitações desta empresa — apenas o metadado (situação, data e referência técnica), nunca o conteúdo do arquivo."
      />

      <Surface
        as="section"
        padding="md"
        className="documentos-metadados-screen__aviso"
        aria-labelledby="documentos-metadados-aviso-conteudo-titulo"
      >
        <StatusBadge variant="info">Somente metadados</StatusBadge>
        <p
          id="documentos-metadados-aviso-conteudo-titulo"
          className="documentos-metadados-screen__aviso-texto"
        >
          Esta versão trabalha somente com metadados de documentos. Não há
          upload, anexo, visualização, download ou armazenamento de conteúdo
          nesta tela — apenas informações técnicas sobre a existência e a
          situação de cada registro.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="documentos-metadados-screen__aviso"
        aria-labelledby="documentos-metadados-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="documentos-metadados-aviso-rh-titulo"
          className="documentos-metadados-screen__aviso-texto"
        >
          Somente o RH da própria empresa opera este módulo — consulta, solicita
          e administra o catálogo, sempre restrito à sua empresa.
        </p>
      </Surface>

      <section aria-labelledby="documentos-metadados-tipos-titulo">
        <h2
          id="documentos-metadados-tipos-titulo"
          className="documentos-metadados-screen__section-title"
        >
          Tipos documentais
        </h2>
        <DataTable
          caption="Catálogo de tipos documentais"
          columns={colunasTipos}
          rows={TIPOS_DOCUMENTO_EXEMPLO}
          rowKey={(linha) => linha.id}
        />
      </section>

      <section
        aria-labelledby="documentos-metadados-demo-titulo"
        className="documentos-metadados-screen__demo"
      >
        <h2
          id="documentos-metadados-demo-titulo"
          className="documentos-metadados-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="documentos-metadados-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="documentos-metadados-screen__demo-botoes"
        >
          {(Object.keys(ROTULO_ESTADO_DEMO) as EstadoDemonstracao[]).map(
            (chave) => (
              <Button
                key={chave}
                type="button"
                variant={estadoDemo === chave ? "primary" : "secondary"}
                aria-pressed={estadoDemo === chave}
                onClick={() => setEstadoDemo(chave)}
              >
                {ROTULO_ESTADO_DEMO[chave]}
              </Button>
            ),
          )}
        </div>
      </section>

      {estadoDemo === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="documentos-metadados-screen__erro"
          aria-labelledby="documentos-metadados-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="documentos-metadados-erro-titulo"
            className="documentos-metadados-screen__section-title"
          >
            Não foi possível carregar os registros de documentos
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="documentos-metadados-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000234</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="documentos-metadados-lista-titulo">
          <h2
            id="documentos-metadados-lista-titulo"
            className="documentos-metadados-screen__section-title"
          >
            Documentos e solicitações
          </h2>

          {linhas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum registro de documento nesta empresa"
              description="Quando houver um documento ou uma solicitação registrada para esta empresa, ela aparece aqui."
            />
          ) : (
            <>
              <DataTable
                caption="Documentos e solicitações desta empresa"
                columns={colunasRegistros}
                rows={linhas}
                rowKey={(linha) => linha.id}
              />
              <p className="documentos-metadados-screen__validade-nota">
                A validade exibida é ilustrativa — a política de
                validade/expiração de documento ainda não foi definida pelo
                produto.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
