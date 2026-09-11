/**
 * Cadastros > Escolaridade (T086) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências de catálogo de
 * escolaridade por categoria e escopo organizacional técnico — sem alterar
 * colaborador, vínculo, função, cargo, remuneração, elegibilidade, acesso,
 * jornada, ponto, Banco de Horas ou Folha. Tudo aqui é amostra sintética
 * própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, valida,
 * comprova, associa, aprova, salva, importa, exporta, solicita ou altera
 * dados reais.
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
  ESCOLARIDADE_EXEMPLO,
  type EscolaridadeExemplo,
  ROTULO_SITUACAO_ESCOLARIDADE,
  type SituacaoEscolaridade,
} from "./escolaridade.fixtures";
import "./EscolaridadeScreen.css";

export const ESCOLARIDADE_TITULO_ID = "escolaridade-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoEscolaridade, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function EscolaridadeScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : ESCOLARIDADE_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      ESCOLARIDADE_EXEMPLO.map((linha) => linha.categoriaReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      ESCOLARIDADE_EXEMPLO.map((linha) => linha.escopoOrganizacionalTecnico),
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
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categoriasReferencia.add(linha.categoriaReferencia);
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
      totalCategorias: categoriasReferencia.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<EscolaridadeExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "codigo",
      header: "Código ilustrativo",
      cell: (linha) => linha.codigoIlustrativo,
    },
    {
      key: "referenciaEscolaridade",
      header: "Referência de escolaridade",
      cell: (linha) => linha.referenciaEscolaridade,
    },
    {
      key: "categoria",
      header: "Categoria",
      cell: (linha) => linha.categoriaReferencia,
    },
    {
      key: "escopo",
      header: "Escopo organizacional técnico",
      cell: (linha) => linha.escopoOrganizacionalTecnico,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_ESCOLARIDADE[linha.situacao]}
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
    <div className="escolaridade-screen">
      <PageHeader
        headingLevel={1}
        titleId={ESCOLARIDADE_TITULO_ID}
        title="Escolaridade"
        description="Demonstração visual de como o RH poderá consultar referências de catálogo de escolaridade por categoria e escopo organizacional técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="escolaridade-screen__aviso"
        aria-labelledby="escolaridade-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="escolaridade-aviso-rh-titulo"
          className="escolaridade-screen__aviso-texto"
        >
          O catálogo é limitado à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="escolaridade-screen__aviso"
        aria-labelledby="escolaridade-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="escolaridade-aviso-demo-titulo"
          className="escolaridade-screen__aviso-texto"
        >
          Não há login, API, persistência, importação, exportação, documento,
          validação de diploma, alteração cadastral ou operação real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="escolaridade-screen__aviso escolaridade-screen__aviso--indisponivel"
        aria-labelledby="escolaridade-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">Referência não é cadastro</StatusBadge>
        <p
          id="escolaridade-aviso-referencia-titulo"
          className="escolaridade-screen__aviso-texto"
        >
          Nível ou referência de escolaridade não altera colaborador, vínculo,
          função, cargo, remuneração, elegibilidade, acesso, jornada, ponto,
          Banco de Horas ou Folha.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="escolaridade-screen__aviso escolaridade-screen__aviso--indisponivel"
        aria-labelledby="escolaridade-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="escolaridade-aviso-dados-titulo"
          className="escolaridade-screen__aviso-texto"
        >
          Qualquer operação real exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="escolaridade-resumo-titulo"
        className="escolaridade-screen__resumo"
      >
        <h2
          id="escolaridade-resumo-titulo"
          className="escolaridade-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="escolaridade-screen__resumo-lista">
          <li className="escolaridade-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="escolaridade-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">
                Referências de escolaridade
              </StatusBadge>
              <p className="escolaridade-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) de escolaridade
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="escolaridade-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="escolaridade-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias</StatusBadge>
              <p className="escolaridade-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="escolaridade-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="escolaridade-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="escolaridade-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="escolaridade-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="escolaridade-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="escolaridade-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="escolaridade-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="escolaridade-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="escolaridade-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) ilustrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="escolaridade-screen__nota">
          Os indicadores não validam curso, diploma ou instituição; não alteram
          cadastro, elegibilidade, acesso, remuneração, Folha ou integração.
        </p>
      </section>

      <section
        aria-labelledby="escolaridade-demo-titulo"
        className="escolaridade-screen__demo"
      >
        <h2
          id="escolaridade-demo-titulo"
          className="escolaridade-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="escolaridade-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das referências de escolaridade"
          className="escolaridade-screen__demo-botoes"
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
          className="escolaridade-screen__erro"
          aria-labelledby="escolaridade-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="escolaridade-erro-titulo"
            className="escolaridade-screen__section-title"
          >
            Não foi possível carregar as referências de escolaridade
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="escolaridade-screen__erro-referencia">
            Referência: <code>REQ-DEMO-006014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="escolaridade-lista-titulo">
          <h2
            id="escolaridade-lista-titulo"
            className="escolaridade-screen__section-title"
          >
            Referências de escolaridade
          </h2>

          <div className="escolaridade-screen__filtros">
            <FormField id="escolaridade-filtro-categoria" label="Categoria">
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

            <FormField id="escolaridade-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_ESCOLARIDADE,
                    ) as SituacaoEscolaridade[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_ESCOLARIDADE[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="escolaridade-filtro-escopo"
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
          <p className="escolaridade-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de escolaridade cadastrada"
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
              caption="Escolaridade (exemplo)"
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
          className="escolaridade-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="escolaridade-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="escolaridade-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Código ilustrativo</dt>
              <dd>{detalheAberto.codigoIlustrativo}</dd>
            </div>
            <div>
              <dt>Referência de escolaridade</dt>
              <dd>{detalheAberto.referenciaEscolaridade}</dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{detalheAberto.categoriaReferencia}</dd>
            </div>
            <div>
              <dt>Escopo organizacional técnico</dt>
              <dd>{detalheAberto.escopoOrganizacionalTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_ESCOLARIDADE[detalheAberto.situacao]}</dd>
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

          <h3 className="escolaridade-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="escolaridade-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="escolaridade-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="escolaridade-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, valida, comprova, associa, aprova, salva, importa, exporta,
            solicita nem altera dados reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
