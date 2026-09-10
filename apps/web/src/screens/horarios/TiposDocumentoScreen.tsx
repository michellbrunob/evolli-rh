/**
 * Cadastros > Tipos de documento (T084) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências de catálogo de tipo
 * documental por categoria e escopo organizacional técnico — sem criar
 * documento, solicitação, permissão, assinatura, validade, retenção,
 * publicação ao colaborador ou encaminhamento à Folha. Tudo aqui é amostra
 * sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, ativa, aprova,
 * salva, anexa, recebe, exibe, assina, publica, solicita, importa, exporta
 * nem altera documentos reais.
 */
import { useId, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  ROTULO_SITUACAO_TIPO_DOCUMENTO,
  type SituacaoTipoDocumento,
  TIPOS_DOCUMENTO_EXEMPLO,
  type TipoDocumentoExemplo,
  RETENCAO_A_DEFINIR_EXEMPLO,
  VISIBILIDADE_A_DEFINIR_EXEMPLO,
} from "./tiposDocumento.fixtures";
import "./TiposDocumentoScreen.css";

export const TIPOS_DOCUMENTO_TITULO_ID = "tipos-documento-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoTipoDocumento, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function TiposDocumentoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : TIPOS_DOCUMENTO_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      TIPOS_DOCUMENTO_EXEMPLO.map((linha) => linha.categoriaReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      TIPOS_DOCUMENTO_EXEMPLO.map((linha) => linha.escopoOrganizacionalTecnico),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroCategoria !== OPCAO_TODOS &&
        linha.categoriaReferencia !== filtroCategoria
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.escopoOrganizacionalTecnico !== filtroEscopo
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroCategoria, filtroSituacao, filtroEscopo]);

  const filtrosAtivos =
    filtroCategoria !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroCategoria(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const categoriasReferencia = new Set<string>();
    let totalRetencaoADefinir = 0;
    let totalVisibilidadeADefinir = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categoriasReferencia.add(linha.categoriaReferencia);
      if (linha.camposPendentes.includes(RETENCAO_A_DEFINIR_EXEMPLO)) {
        totalRetencaoADefinir += 1;
      }
      if (linha.visibilidadePrevista === VISIBILIDADE_A_DEFINIR_EXEMPLO) {
        totalVisibilidadeADefinir += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
    }
    return {
      totalTiposDocumentais: linhasBase.length,
      totalCategoriasReferencia: categoriasReferencia.size,
      totalRetencaoADefinir,
      totalVisibilidadeADefinir,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<TipoDocumentoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "tipoDocumental",
      header: "Tipo documental",
      cell: (linha) => linha.tipoDocumental,
    },
    {
      key: "categoria",
      header: "Categoria de referência",
      cell: (linha) => linha.categoriaReferencia,
    },
    {
      key: "escopo",
      header: "Escopo organizacional técnico",
      cell: (linha) => linha.escopoOrganizacionalTecnico,
    },
    {
      key: "visibilidade",
      header: "Visibilidade prevista",
      cell: (linha) => linha.visibilidadePrevista,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_TIPO_DOCUMENTO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
    {
      key: "trilha",
      header: "Trilha de auditoria",
      cell: (linha) => linha.trilhaAuditoria,
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="subtle" onClick={() => setDetalheAbertoId(linha.id)}>
          Ver detalhe
          <span className="sr-only"> — {linha.id}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="tipos-documento-screen">
      <PageHeader
        headingLevel={1}
        titleId={TIPOS_DOCUMENTO_TITULO_ID}
        title="Tipos de documento"
        description="Demonstração visual de como o RH poderá consultar referências de catálogo de tipo documental por categoria e escopo organizacional técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="tipos-documento-screen__aviso"
        aria-labelledby="tipos-documento-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="tipos-documento-aviso-rh-titulo"
          className="tipos-documento-screen__aviso-texto"
        >
          O catálogo é consultado somente no escopo da própria empresa e das
          unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="tipos-documento-screen__aviso"
        aria-labelledby="tipos-documento-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="tipos-documento-aviso-demo-titulo"
          className="tipos-documento-screen__aviso-texto"
        >
          Não há login, API, persistência, upload, download, assinatura,
          geração, importação, exportação ou alteração documental real nesta
          tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="tipos-documento-screen__aviso tipos-documento-screen__aviso--indisponivel"
        aria-labelledby="tipos-documento-aviso-catalogo-titulo"
      >
        <StatusBadge variant="warning">Catálogo não é documento</StatusBadge>
        <p
          id="tipos-documento-aviso-catalogo-titulo"
          className="tipos-documento-screen__aviso-texto"
        >
          O tipo de documento é apenas uma referência; não cria documento,
          solicitação, permissão, assinatura, validade, retenção, publicação ao
          colaborador ou encaminhamento à Folha.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="tipos-documento-screen__aviso tipos-documento-screen__aviso--indisponivel"
        aria-labelledby="tipos-documento-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">
          Dados e documentos reais bloqueados
        </StatusBadge>
        <p
          id="tipos-documento-aviso-dados-titulo"
          className="tipos-documento-screen__aviso-texto"
        >
          Qualquer tratamento real depende de MFA, do gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade, saúde ocupacional,
          Folha/DP e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="tipos-documento-resumo-titulo"
        className="tipos-documento-screen__resumo"
      >
        <h2
          id="tipos-documento-resumo-titulo"
          className="tipos-documento-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="tipos-documento-screen__resumo-lista">
          <li className="tipos-documento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="tipos-documento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Tipos documentais</StatusBadge>
              <p className="tipos-documento-screen__resumo-item-texto">
                {resumo.totalTiposDocumentais} tipo(s) documental(is) de
                referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="tipos-documento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="tipos-documento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias</StatusBadge>
              <p className="tipos-documento-screen__resumo-item-texto">
                {resumo.totalCategoriasReferencia} categoria(s) de referência
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="tipos-documento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="tipos-documento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Retenção a definir</StatusBadge>
              <p className="tipos-documento-screen__resumo-item-texto">
                {resumo.totalRetencaoADefinir} item(ns) com retenção a definir
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="tipos-documento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="tipos-documento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">
                Visibilidade a definir
              </StatusBadge>
              <p className="tipos-documento-screen__resumo-item-texto">
                {resumo.totalVisibilidadeADefinir} item(ns) com visibilidade a
                definir (exemplo)
              </p>
            </Surface>
          </li>
          <li className="tipos-documento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="tipos-documento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="tipos-documento-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) ilustrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="tipos-documento-screen__nota">
          Estes indicadores não aceitam arquivo, não exibem documento, não
          calculam validade, não controlam retenção, não concedem acesso e não
          geram assinatura, pagamento, desconto, Folha ou integração.
        </p>
      </section>

      <section
        aria-labelledby="tipos-documento-demo-titulo"
        className="tipos-documento-screen__demo"
      >
        <h2
          id="tipos-documento-demo-titulo"
          className="tipos-documento-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="tipos-documento-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos tipos de documento"
          className="tipos-documento-screen__demo-botoes"
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
          className="tipos-documento-screen__erro"
          aria-labelledby="tipos-documento-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="tipos-documento-erro-titulo"
            className="tipos-documento-screen__section-title"
          >
            Não foi possível carregar as referências de tipo de documento
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="tipos-documento-screen__erro-referencia">
            Referência: <code>REQ-DEMO-004014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="tipos-documento-lista-titulo">
          <h2
            id="tipos-documento-lista-titulo"
            className="tipos-documento-screen__section-title"
          >
            Referências de tipo de documento
          </h2>

          <div className="tipos-documento-screen__filtros">
            <FormField
              id="tipos-documento-filtro-categoria"
              label="Categoria de referência"
            >
              {(control) => (
                <select
                  value={filtroCategoria}
                  onChange={(evento) => setFiltroCategoria(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as categorias</option>
                  {categoriasDisponiveis.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="tipos-documento-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_TIPO_DOCUMENTO,
                    ) as SituacaoTipoDocumento[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_TIPO_DOCUMENTO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="tipos-documento-filtro-escopo"
              label="Escopo organizacional técnico"
            >
              {(control) => (
                <select
                  value={filtroEscopo}
                  onChange={(evento) => setFiltroEscopo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os escopos</option>
                  {escoposDisponiveis.map((escopo) => (
                    <option key={escopo} value={escopo}>
                      {escopo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <Button
              variant="subtle"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            >
              Limpar filtros
            </Button>
          </div>
          <p className="tipos-documento-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de tipo de documento cadastrada"
              description="Quando houver uma referência desta empresa, ela aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais referências desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Tipos de documento (exemplo)"
              columns={colunas}
              rows={linhasFiltradas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {detalheAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="tipos-documento-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="tipos-documento-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="tipos-documento-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Tipo documental</dt>
              <dd>{detalheAberto.tipoDocumental}</dd>
            </div>
            <div>
              <dt>Categoria de referência</dt>
              <dd>{detalheAberto.categoriaReferencia}</dd>
            </div>
            <div>
              <dt>Escopo organizacional técnico</dt>
              <dd>{detalheAberto.escopoOrganizacionalTecnico}</dd>
            </div>
            <div>
              <dt>Visibilidade ilustrativa</dt>
              <dd>{detalheAberto.visibilidadePrevista}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_TIPO_DOCUMENTO[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Responsável técnico</dt>
              <dd>{detalheAberto.responsavelTecnico}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="tipos-documento-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="tipos-documento-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="tipos-documento-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="tipos-documento-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, ativa, aprova, salva, anexa, recebe, exibe, assina, publica,
            solicita, importa, exporta nem altera documentos reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
