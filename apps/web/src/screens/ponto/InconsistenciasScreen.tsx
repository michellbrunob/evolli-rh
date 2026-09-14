/**
 * Ponto > Inconsistências (T096) — tela visual estática.
 *
 * Demonstra referências técnicas de inconsistência de ponto por tipo,
 * prioridade e situação — sem criar, editar, corrigir, ajustar, aprovar,
 * recusar, bloquear, fechar, reabrir, calcular, compensar, salvar, importar,
 * exportar ou integrar inconsistência real. Tudo aqui é amostra sintética
 * própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, corrige,
 * ajusta, aprova, recusa, bloqueia, fecha, reabre, calcula, compensa, salva,
 * importa, exporta ou integra inconsistências reais.
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
  type InconsistenciaExemplo,
  INCONSISTENCIAS_EXEMPLO,
  type PrioridadeInconsistencia,
  ROTULO_PRIORIDADE_INCONSISTENCIA,
  ROTULO_SITUACAO_INCONSISTENCIA,
  ROTULO_TIPO_INCONSISTENCIA,
  type SituacaoInconsistencia,
  type TipoInconsistencia,
} from "./inconsistencias.fixtures";
import "./InconsistenciasScreen.css";

export const INCONSISTENCIAS_TITULO_ID = "inconsistencias-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoInconsistencia, StatusVariant> = {
  aguardando_analise_exemplo: "warning",
  em_verificacao_exemplo: "info",
  historico_ilustrativo: "neutral",
};

const VARIANTE_PRIORIDADE: Record<PrioridadeInconsistencia, StatusVariant> = {
  baixa_exemplo: "neutral",
  media_exemplo: "info",
  alta_exemplo: "warning",
};

const OPCAO_TODOS = "todos";

export function InconsistenciasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : INCONSISTENCIAS_EXEMPLO),
    [estadoDemo],
  );

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroTipo !== OPCAO_TODOS &&
        linha.tipoInconsistencia !== filtroTipo
      ) {
        return false;
      }
      if (
        filtroPrioridade !== OPCAO_TODOS &&
        linha.prioridade !== filtroPrioridade
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroTipo, filtroPrioridade, filtroSituacao]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroPrioridade !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroPrioridade(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    let totalAltaPrioridade = 0;
    let totalAguardandoAnalise = 0;
    let totalEmVerificacao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      if (linha.prioridade === "alta_exemplo") {
        totalAltaPrioridade += 1;
      }
      if (linha.situacao === "aguardando_analise_exemplo") {
        totalAguardandoAnalise += 1;
      }
      if (linha.situacao === "em_verificacao_exemplo") {
        totalEmVerificacao += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
    }
    return {
      totalReferencias: linhasBase.length,
      totalAltaPrioridade,
      totalAguardandoAnalise,
      totalEmVerificacao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<InconsistenciaExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "tipo",
      header: "Tipo de inconsistência",
      cell: (linha) => ROTULO_TIPO_INCONSISTENCIA[linha.tipoInconsistencia],
    },
    {
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => linha.periodoIlustrativo,
    },
    {
      key: "escopo",
      header: "Escopo técnico",
      cell: (linha) => linha.escopoTecnico,
    },
    {
      key: "prioridade",
      header: "Prioridade",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_PRIORIDADE[linha.prioridade]}>
          {ROTULO_PRIORIDADE_INCONSISTENCIA[linha.prioridade]}
        </StatusBadge>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_INCONSISTENCIA[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "encaminhamento",
      header: "Encaminhamento de referência",
      cell: (linha) => linha.encaminhamentoReferencia,
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
    <div className="inconsistencias-screen">
      <PageHeader
        headingLevel={1}
        titleId={INCONSISTENCIAS_TITULO_ID}
        title="Inconsistências"
        description="Demonstração visual de referências técnicas de inconsistência de ponto por tipo, prioridade e situação."
      />

      <Surface
        as="section"
        padding="md"
        className="inconsistencias-screen__aviso"
        aria-labelledby="inconsistencias-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="inconsistencias-aviso-rh-titulo"
          className="inconsistencias-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="inconsistencias-screen__aviso"
        aria-labelledby="inconsistencias-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="inconsistencias-aviso-demo-titulo"
          className="inconsistencias-screen__aviso-texto"
        >
          Não há login, API, persistência, correção, ajuste, aprovação,
          bloqueio, fechamento ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="inconsistencias-screen__aviso inconsistencias-screen__aviso--indisponivel"
        aria-labelledby="inconsistencias-aviso-indicador-titulo"
      >
        <StatusBadge variant="warning">Indicador não é decisão</StatusBadge>
        <p
          id="inconsistencias-aviso-indicador-titulo"
          className="inconsistencias-screen__aviso-texto"
        >
          Uma inconsistência não altera marcação original, ponto, vínculo, Banco
          de Horas, remuneração, benefícios, documentos, permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="inconsistencias-screen__aviso inconsistencias-screen__aviso--indisponivel"
        aria-labelledby="inconsistencias-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="inconsistencias-aviso-dados-titulo"
          className="inconsistencias-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="inconsistencias-resumo-titulo"
        className="inconsistencias-screen__resumo"
      >
        <h2
          id="inconsistencias-resumo-titulo"
          className="inconsistencias-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="inconsistencias-screen__resumo-lista">
          <li className="inconsistencias-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="inconsistencias-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="inconsistencias-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="inconsistencias-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="inconsistencias-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Prioridade alta</StatusBadge>
              <p className="inconsistencias-screen__resumo-item-texto">
                {resumo.totalAltaPrioridade} referência(s) de prioridade alta
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="inconsistencias-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="inconsistencias-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Aguardando análise</StatusBadge>
              <p className="inconsistencias-screen__resumo-item-texto">
                {resumo.totalAguardandoAnalise} item(ns) aguardando análise
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="inconsistencias-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="inconsistencias-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em verificação</StatusBadge>
              <p className="inconsistencias-screen__resumo-item-texto">
                {resumo.totalEmVerificacao} item(ns) em verificação (exemplo)
              </p>
            </Surface>
          </li>
          <li className="inconsistencias-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="inconsistencias-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="inconsistencias-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="inconsistencias-screen__nota">
          Não há cálculo de horas, extras, faltas, DSR, saldo, pagamento,
          desconto, compensação ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="inconsistencias-demo-titulo"
        className="inconsistencias-screen__demo"
      >
        <h2
          id="inconsistencias-demo-titulo"
          className="inconsistencias-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="inconsistencias-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das inconsistências"
          className="inconsistencias-screen__demo-botoes"
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
          className="inconsistencias-screen__erro"
          aria-labelledby="inconsistencias-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="inconsistencias-erro-titulo"
            className="inconsistencias-screen__section-title"
          >
            Não foi possível carregar as referências de inconsistências
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="inconsistencias-screen__erro-referencia">
            Referência: <code>REQ-DEMO-016104</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="inconsistencias-lista-titulo">
          <h2
            id="inconsistencias-lista-titulo"
            className="inconsistencias-screen__section-title"
          >
            Referências de inconsistências
          </h2>

          <div className="inconsistencias-screen__filtros">
            <FormField
              id="inconsistencias-filtro-tipo"
              label="Tipo de inconsistência"
            >
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(
                    Object.keys(
                      ROTULO_TIPO_INCONSISTENCIA,
                    ) as TipoInconsistencia[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_INCONSISTENCIA[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="inconsistencias-filtro-prioridade"
              label="Prioridade"
            >
              {(control) => (
                <select
                  value={filtroPrioridade}
                  onChange={(evento) =>
                    setFiltroPrioridade(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as prioridades</option>
                  {(
                    Object.keys(
                      ROTULO_PRIORIDADE_INCONSISTENCIA,
                    ) as PrioridadeInconsistencia[]
                  ).map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {ROTULO_PRIORIDADE_INCONSISTENCIA[prioridade]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="inconsistencias-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_INCONSISTENCIA,
                    ) as SituacaoInconsistencia[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_INCONSISTENCIA[situacao]}
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
          <p className="inconsistencias-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma inconsistência cadastrada"
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
              caption="Inconsistências de ponto (exemplo)"
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
          className="inconsistencias-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="inconsistencias-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="inconsistencias-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Tipo de inconsistência</dt>
              <dd>
                {ROTULO_TIPO_INCONSISTENCIA[detalheAberto.tipoInconsistencia]}
              </dd>
            </div>
            <div>
              <dt>Período ilustrativo</dt>
              <dd>{detalheAberto.periodoIlustrativo}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Prioridade</dt>
              <dd>
                {ROTULO_PRIORIDADE_INCONSISTENCIA[detalheAberto.prioridade]}
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_INCONSISTENCIA[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Encaminhamento de referência</dt>
              <dd>{detalheAberto.encaminhamentoReferencia}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="inconsistencias-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="inconsistencias-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="inconsistencias-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="inconsistencias-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, corrige, ajusta, aprova, recusa, bloqueia, fecha, reabre,
            calcula, compensa, salva, importa, exporta nem integra
            inconsistências reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
