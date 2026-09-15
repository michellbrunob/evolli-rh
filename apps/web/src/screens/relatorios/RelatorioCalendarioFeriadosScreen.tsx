/**
 * Relatórios > Calendário de Feriados (T102) — tela visual estática.
 *
 * Demonstra referências técnicas de calendário por categoria, escopo
 * técnico e abrangência ilustrativa — sem criar, editar, importar, ativar,
 * desativar, aplicar, atribuir, recalcular, marcar, ajustar, compensar,
 * fechar, salvar, gerar, exportar ou integrar calendário real. Tudo aqui é
 * amostra sintética própria, em memória — sem nome oficial de feriado, data
 * real, localidade real, pessoa, empresa ou unidade real.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, importa,
 * ativa, desativa, aplica, atribui, recalcula, marca, ajusta, compensa,
 * fecha, salva, gera, exporta ou integra calendários reais.
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
  type RelatorioCalendarioFeriadoExemplo,
  RELATORIO_CALENDARIO_FERIADOS_EXEMPLO,
  ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS,
  type SituacaoRelatorioCalendarioFeriados,
} from "./relatorioCalendarioFeriados.fixtures";
import "./RelatorioCalendarioFeriadosScreen.css";

export const RELATORIO_CALENDARIO_FERIADOS_TITULO_ID =
  "relatorio-calendario-feriados-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<
  SituacaoRelatorioCalendarioFeriados,
  StatusVariant
> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function RelatorioCalendarioFeriadosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : RELATORIO_CALENDARIO_FERIADOS_EXEMPLO),
    [estadoDemo],
  );

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      RELATORIO_CALENDARIO_FERIADOS_EXEMPLO.map((linha) => linha.escopoTecnico),
    );
    return Array.from(unicos);
  }, []);

  const periodosDisponiveis = useMemo(() => {
    const unicos = new Set(
      RELATORIO_CALENDARIO_FERIADOS_EXEMPLO.map(
        (linha) => linha.periodoIlustrativo,
      ),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.escopoTecnico !== filtroEscopo
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroPeriodo !== OPCAO_TODOS &&
        linha.periodoIlustrativo !== filtroPeriodo
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroEscopo, filtroSituacao, filtroPeriodo]);

  const filtrosAtivos =
    filtroEscopo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroPeriodo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroEscopo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroPeriodo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const categorias = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categorias.add(linha.categoriaReferencia);
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

  const colunas: DataTableColumn<RelatorioCalendarioFeriadoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => linha.periodoIlustrativo,
    },
    {
      key: "categoria",
      header: "Categoria de referência",
      cell: (linha) => linha.categoriaReferencia,
    },
    {
      key: "escopo",
      header: "Escopo técnico",
      cell: (linha) => linha.escopoTecnico,
    },
    {
      key: "abrangencia",
      header: "Abrangência ilustrativa",
      cell: (linha) => linha.abrangenciaIlustrativa,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS[linha.situacao]}
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
    <div className="relatorio-calendario-feriados-screen">
      <PageHeader
        headingLevel={1}
        titleId={RELATORIO_CALENDARIO_FERIADOS_TITULO_ID}
        title="Calendário de Feriados"
        description="Demonstração visual de referências técnicas de calendário por categoria, escopo técnico e abrangência ilustrativa."
      />

      <Surface
        as="section"
        padding="md"
        className="relatorio-calendario-feriados-screen__aviso"
        aria-labelledby="relatorio-calendario-feriados-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="relatorio-calendario-feriados-aviso-rh-titulo"
          className="relatorio-calendario-feriados-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-calendario-feriados-screen__aviso"
        aria-labelledby="relatorio-calendario-feriados-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="relatorio-calendario-feriados-aviso-demo-titulo"
          className="relatorio-calendario-feriados-screen__aviso-texto"
        >
          Não há login, API, persistência, criação, importação, edição,
          ativação, aplicação, cálculo, exportação ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-calendario-feriados-screen__aviso relatorio-calendario-feriados-screen__aviso--indisponivel"
        aria-labelledby="relatorio-calendario-feriados-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Calendário não é regra aplicada
        </StatusBadge>
        <p
          id="relatorio-calendario-feriados-aviso-referencia-titulo"
          className="relatorio-calendario-feriados-screen__aviso-texto"
        >
          Estas referências não alteram unidade, escala, jornada, ponto,
          marcação original, Banco de Horas, remuneração, benefícios,
          documentos, permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-calendario-feriados-screen__aviso relatorio-calendario-feriados-screen__aviso--indisponivel"
        aria-labelledby="relatorio-calendario-feriados-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="relatorio-calendario-feriados-aviso-dados-titulo"
          className="relatorio-calendario-feriados-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="relatorio-calendario-feriados-resumo-titulo"
        className="relatorio-calendario-feriados-screen__resumo"
      >
        <h2
          id="relatorio-calendario-feriados-resumo-titulo"
          className="relatorio-calendario-feriados-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="relatorio-calendario-feriados-screen__resumo-lista">
          <li className="relatorio-calendario-feriados-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-calendario-feriados-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="relatorio-calendario-feriados-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-calendario-feriados-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-calendario-feriados-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias de referência</StatusBadge>
              <p className="relatorio-calendario-feriados-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-calendario-feriados-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-calendario-feriados-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="relatorio-calendario-feriados-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-calendario-feriados-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-calendario-feriados-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="relatorio-calendario-feriados-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-calendario-feriados-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-calendario-feriados-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="relatorio-calendario-feriados-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="relatorio-calendario-feriados-screen__nota">
          Não há cálculo de jornada, escala, horas, extras, faltas, saldo,
          pagamento, desconto, compensação ou evento de Folha nestes
          indicadores.
        </p>
      </section>

      <section
        aria-labelledby="relatorio-calendario-feriados-demo-titulo"
        className="relatorio-calendario-feriados-screen__demo"
      >
        <h2
          id="relatorio-calendario-feriados-demo-titulo"
          className="relatorio-calendario-feriados-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="relatorio-calendario-feriados-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do calendário"
          className="relatorio-calendario-feriados-screen__demo-botoes"
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
          className="relatorio-calendario-feriados-screen__erro"
          aria-labelledby="relatorio-calendario-feriados-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="relatorio-calendario-feriados-erro-titulo"
            className="relatorio-calendario-feriados-screen__section-title"
          >
            Não foi possível carregar as referências de calendário
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="relatorio-calendario-feriados-screen__erro-referencia">
            Referência: <code>REQ-DEMO-022678</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="relatorio-calendario-feriados-lista-titulo">
          <h2
            id="relatorio-calendario-feriados-lista-titulo"
            className="relatorio-calendario-feriados-screen__section-title"
          >
            Referências de calendário
          </h2>

          <div className="relatorio-calendario-feriados-screen__filtros">
            <FormField
              id="relatorio-calendario-feriados-filtro-escopo"
              label="Escopo de referência"
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

            <FormField
              id="relatorio-calendario-feriados-filtro-situacao"
              label="Situação"
            >
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS,
                    ) as SituacaoRelatorioCalendarioFeriados[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="relatorio-calendario-feriados-filtro-periodo"
              label="Período ilustrativo"
            >
              {(control) => (
                <select
                  value={filtroPeriodo}
                  onChange={(evento) => setFiltroPeriodo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os períodos</option>
                  {periodosDisponiveis.map((periodo) => (
                    <option key={periodo} value={periodo}>
                      {periodo}
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
          <p className="relatorio-calendario-feriados-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de calendário cadastrada"
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
              caption="Calendário de Feriados (exemplo)"
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
          className="relatorio-calendario-feriados-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="relatorio-calendario-feriados-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="relatorio-calendario-feriados-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Período ilustrativo</dt>
              <dd>{detalheAberto.periodoIlustrativo}</dd>
            </div>
            <div>
              <dt>Categoria de referência</dt>
              <dd>{detalheAberto.categoriaReferencia}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Abrangência ilustrativa</dt>
              <dd>{detalheAberto.abrangenciaIlustrativa}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {
                  ROTULO_SITUACAO_RELATORIO_CALENDARIO_FERIADOS[
                    detalheAberto.situacao
                  ]
                }
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

          <h3 className="relatorio-calendario-feriados-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="relatorio-calendario-feriados-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="relatorio-calendario-feriados-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="relatorio-calendario-feriados-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, importa, ativa, desativa, aplica, atribui, recalcula, marca,
            ajusta, compensa, fecha, salva, gera, exporta nem integra
            calendários reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
