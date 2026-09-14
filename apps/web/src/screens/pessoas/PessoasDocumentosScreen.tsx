/**
 * Pessoas > Documentos (T090) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências técnicas de evidências
 * documentais por categoria, finalidade de referência e escopo técnico —
 * sem receber, exibir, validar, assinar, publicar, reter, excluir,
 * compartilhar, importar, exportar ou integrar documentos reais. Tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, envia, anexa,
 * recebe, abre, baixa, exibe, assina, aprova, publica, retém, exclui,
 * compartilha, importa, exporta ou integra documentos reais.
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
  PESSOAS_DOCUMENTOS_EXEMPLO,
  type PessoasDocumentoExemplo,
  ROTULO_SITUACAO_PESSOAS_DOCUMENTOS,
  type SituacaoPessoasDocumentos,
} from "./pessoasDocumentos.fixtures";
import "./PessoasDocumentosScreen.css";

export const PESSOAS_DOCUMENTOS_TITULO_ID = "pessoas-documentos-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoPessoasDocumentos, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function PessoasDocumentosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : PESSOAS_DOCUMENTOS_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      PESSOAS_DOCUMENTOS_EXEMPLO.map((linha) => linha.categoriaDocumental),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      PESSOAS_DOCUMENTOS_EXEMPLO.map((linha) => linha.escopoTecnico),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroCategoria !== OPCAO_TODOS &&
        linha.categoriaDocumental !== filtroCategoria
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.escopoTecnico !== filtroEscopo
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
    const categorias = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categorias.add(linha.categoriaDocumental);
      if (linha.situacao === "referencia_em_revisao_exemplo") {
        totalEmRevisao += 1;
      }
      if (linha.situacao === "aguardando_decisao_exemplo") {
        totalAguardandoDecisao += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
    }
    return {
      totalReferencias: linhasBase.length,
      totalCategorias: categorias.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<PessoasDocumentoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "categoria",
      header: "Categoria documental",
      cell: (linha) => linha.categoriaDocumental,
    },
    {
      key: "finalidade",
      header: "Finalidade de referência",
      cell: (linha) => linha.finalidadeReferencia,
    },
    {
      key: "visibilidade",
      header: "Visibilidade prevista",
      cell: (linha) => linha.visibilidadePrevista,
    },
    {
      key: "escopo",
      header: "Escopo técnico",
      cell: (linha) => linha.escopoTecnico,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_PESSOAS_DOCUMENTOS[linha.situacao]}
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
    <div className="pessoas-documentos-screen">
      <PageHeader
        headingLevel={1}
        titleId={PESSOAS_DOCUMENTOS_TITULO_ID}
        title="Documentos"
        description="Demonstração visual de como o RH poderá consultar referências técnicas de evidências documentais por categoria, finalidade de referência e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="pessoas-documentos-screen__aviso"
        aria-labelledby="pessoas-documentos-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="pessoas-documentos-aviso-rh-titulo"
          className="pessoas-documentos-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="pessoas-documentos-screen__aviso"
        aria-labelledby="pessoas-documentos-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="pessoas-documentos-aviso-demo-titulo"
          className="pessoas-documentos-screen__aviso-texto"
        >
          Não há login, API, persistência, upload, download, visualização,
          assinatura, retenção ou integração real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="pessoas-documentos-screen__aviso pessoas-documentos-screen__aviso--indisponivel"
        aria-labelledby="pessoas-documentos-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">Referência não é documento</StatusBadge>
        <p
          id="pessoas-documentos-aviso-referencia-titulo"
          className="pessoas-documentos-screen__aviso-texto"
        >
          Estas referências não recebem, abrem, exibem, assinam, aprovam,
          publicam, retêm ou substituem nenhum documento real.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="pessoas-documentos-screen__aviso pessoas-documentos-screen__aviso--indisponivel"
        aria-labelledby="pessoas-documentos-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">
          Dados/documentos reais bloqueados
        </StatusBadge>
        <p
          id="pessoas-documentos-aviso-dados-titulo"
          className="pessoas-documentos-screen__aviso-texto"
        >
          Qualquer uso futuro exige MFA, o gate-mestre de segurança operacional
          (<code>DS-OPS-01</code>), auditoria, retenção/base legal e validações
          aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="pessoas-documentos-resumo-titulo"
        className="pessoas-documentos-screen__resumo"
      >
        <h2
          id="pessoas-documentos-resumo-titulo"
          className="pessoas-documentos-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="pessoas-documentos-screen__resumo-lista">
          <li className="pessoas-documentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="pessoas-documentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="pessoas-documentos-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="pessoas-documentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="pessoas-documentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias documentais</StatusBadge>
              <p className="pessoas-documentos-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) documental(is) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="pessoas-documentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="pessoas-documentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="pessoas-documentos-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="pessoas-documentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="pessoas-documentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="pessoas-documentos-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="pessoas-documentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="pessoas-documentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="pessoas-documentos-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="pessoas-documentos-screen__nota">
          Estes indicadores não recebem, exibem, validam, assinam, publicam ou
          retêm documentos; não representam arquivo, upload ou download real.
        </p>
      </section>

      <section
        aria-labelledby="pessoas-documentos-demo-titulo"
        className="pessoas-documentos-screen__demo"
      >
        <h2
          id="pessoas-documentos-demo-titulo"
          className="pessoas-documentos-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="pessoas-documentos-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos documentos"
          className="pessoas-documentos-screen__demo-botoes"
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
          className="pessoas-documentos-screen__erro"
          aria-labelledby="pessoas-documentos-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="pessoas-documentos-erro-titulo"
            className="pessoas-documentos-screen__section-title"
          >
            Não foi possível carregar as referências de documentos
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="pessoas-documentos-screen__erro-referencia">
            Referência: <code>REQ-DEMO-010037</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="pessoas-documentos-lista-titulo">
          <h2
            id="pessoas-documentos-lista-titulo"
            className="pessoas-documentos-screen__section-title"
          >
            Referências de documentos
          </h2>

          <div className="pessoas-documentos-screen__filtros">
            <FormField
              id="pessoas-documentos-filtro-categoria"
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

            <FormField id="pessoas-documentos-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_PESSOAS_DOCUMENTOS,
                    ) as SituacaoPessoasDocumentos[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_PESSOAS_DOCUMENTOS[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="pessoas-documentos-filtro-escopo"
              label="Escopo técnico"
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
          <p className="pessoas-documentos-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de documento cadastrada"
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
              caption="Documentos (exemplo)"
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
          className="pessoas-documentos-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="pessoas-documentos-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="pessoas-documentos-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Categoria documental</dt>
              <dd>{detalheAberto.categoriaDocumental}</dd>
            </div>
            <div>
              <dt>Finalidade de referência</dt>
              <dd>{detalheAberto.finalidadeReferencia}</dd>
            </div>
            <div>
              <dt>Visibilidade prevista</dt>
              <dd>{detalheAberto.visibilidadePrevista}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_PESSOAS_DOCUMENTOS[detalheAberto.situacao]}
              </dd>
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

          <h3 className="pessoas-documentos-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="pessoas-documentos-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="pessoas-documentos-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="pessoas-documentos-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, envia, anexa, recebe, abre, baixa, exibe, assina, aprova,
            publica, retém, exclui, compartilha, importa, exporta nem integra
            documentos reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
