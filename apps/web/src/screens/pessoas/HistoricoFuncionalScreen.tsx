/**
 * Pessoas > Histórico funcional (T088) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências de vínculo e
 * movimentação funcional por referência organizacional — sem criar, alterar,
 * reconhecer, aprovar ou encerrar vínculo, cargo, função, salário, jornada,
 * ponto, documentos, Banco de Horas, Folha, permissão ou acesso. Tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, admite,
 * transfere, promove, altera salário, altera jornada, desliga, bloqueia
 * acesso, salva, importa, exporta, aprova ou integra dados reais.
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
  HISTORICO_FUNCIONAL_EXEMPLO,
  type HistoricoFuncionalExemplo,
  ROTULO_SITUACAO_HISTORICO_FUNCIONAL,
  type SituacaoHistoricoFuncional,
} from "./historicoFuncional.fixtures";
import "./HistoricoFuncionalScreen.css";

export const HISTORICO_FUNCIONAL_TITULO_ID = "historico-funcional-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoHistoricoFuncional, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function HistoricoFuncionalScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroOrganizacional, setFiltroOrganizacional] =
    useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : HISTORICO_FUNCIONAL_EXEMPLO),
    [estadoDemo],
  );

  const tiposEventoDisponiveis = useMemo(() => {
    const unicos = new Set(
      HISTORICO_FUNCIONAL_EXEMPLO.map((linha) => linha.tipoEventoIlustrativo),
    );
    return Array.from(unicos);
  }, []);

  const referenciasOrganizacionaisDisponiveis = useMemo(() => {
    const unicos = new Set(
      HISTORICO_FUNCIONAL_EXEMPLO.map(
        (linha) => linha.referenciaOrganizacional,
      ),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroTipoEvento !== OPCAO_TODOS &&
        linha.tipoEventoIlustrativo !== filtroTipoEvento
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroOrganizacional !== OPCAO_TODOS &&
        linha.referenciaOrganizacional !== filtroOrganizacional
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroTipoEvento, filtroSituacao, filtroOrganizacional]);

  const filtrosAtivos =
    filtroTipoEvento !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroOrganizacional !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipoEvento(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroOrganizacional(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const vinculosReferencia = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      vinculosReferencia.add(linha.vinculoTecnico);
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
      totalVinculos: vinculosReferencia.size,
      totalMovimentos: linhasBase.length,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<HistoricoFuncionalExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "vinculo",
      header: "Vínculo técnico",
      cell: (linha) => linha.vinculoTecnico,
    },
    {
      key: "tipoEvento",
      header: "Tipo de evento ilustrativo",
      cell: (linha) => linha.tipoEventoIlustrativo,
    },
    {
      key: "referenciaOrganizacional",
      header: "Referência organizacional",
      cell: (linha) => linha.referenciaOrganizacional,
    },
    {
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => linha.periodoIlustrativo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_HISTORICO_FUNCIONAL[linha.situacao]}
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
    <div className="historico-funcional-screen">
      <PageHeader
        headingLevel={1}
        titleId={HISTORICO_FUNCIONAL_TITULO_ID}
        title="Histórico funcional"
        description="Demonstração visual de como o RH poderá consultar referências de vínculo e movimentação funcional por referência organizacional."
      />

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso"
        aria-labelledby="historico-funcional-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="historico-funcional-aviso-rh-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso"
        aria-labelledby="historico-funcional-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="historico-funcional-aviso-demo-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          Não há login, API, persistência, alteração cadastral, admissão,
          transferência, promoção, desligamento ou integração real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso historico-funcional-screen__aviso--indisponivel"
        aria-labelledby="historico-funcional-aviso-historico-titulo"
      >
        <StatusBadge variant="warning">Histórico não é alteração</StatusBadge>
        <p
          id="historico-funcional-aviso-historico-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          Referências de vínculo e movimentação não alteram colaborador, cargo,
          função, salário, jornada, ponto, documentos, Banco de Horas, Folha,
          permissão ou acesso.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso historico-funcional-screen__aviso--indisponivel"
        aria-labelledby="historico-funcional-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="historico-funcional-aviso-dados-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          Qualquer operação real exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade, Folha/DP e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="historico-funcional-resumo-titulo"
        className="historico-funcional-screen__resumo"
      >
        <h2
          id="historico-funcional-resumo-titulo"
          className="historico-funcional-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="historico-funcional-screen__resumo-lista">
          <li className="historico-funcional-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Vínculos de referência</StatusBadge>
              <p className="historico-funcional-screen__resumo-item-texto">
                {resumo.totalVinculos} vínculo(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="historico-funcional-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Movimentos ilustrativos</StatusBadge>
              <p className="historico-funcional-screen__resumo-item-texto">
                {resumo.totalMovimentos} movimento(s) funcional(is)
                ilustrativo(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="historico-funcional-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="historico-funcional-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="historico-funcional-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="historico-funcional-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="historico-funcional-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="historico-funcional-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="historico-funcional-screen__nota">
          Os indicadores não criam, alteram, reconhecem, aprovam ou encerram
          vínculo; não calculam remuneração, pagamento, desconto, jornada, Banco
          de Horas, Folha ou integração.
        </p>
      </section>

      <section
        aria-labelledby="historico-funcional-demo-titulo"
        className="historico-funcional-screen__demo"
      >
        <h2
          id="historico-funcional-demo-titulo"
          className="historico-funcional-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="historico-funcional-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do histórico funcional"
          className="historico-funcional-screen__demo-botoes"
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
          className="historico-funcional-screen__erro"
          aria-labelledby="historico-funcional-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="historico-funcional-erro-titulo"
            className="historico-funcional-screen__section-title"
          >
            Não foi possível carregar as referências de histórico funcional
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="historico-funcional-screen__erro-referencia">
            Referência: <code>REQ-DEMO-008014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="historico-funcional-lista-titulo">
          <h2
            id="historico-funcional-lista-titulo"
            className="historico-funcional-screen__section-title"
          >
            Referências de histórico funcional
          </h2>

          <div className="historico-funcional-screen__filtros">
            <FormField
              id="historico-funcional-filtro-tipo-evento"
              label="Tipo de evento"
            >
              {(control) => (
                <select
                  value={filtroTipoEvento}
                  onChange={(evento) =>
                    setFiltroTipoEvento(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {tiposEventoDisponiveis.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="historico-funcional-filtro-situacao"
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
                      ROTULO_SITUACAO_HISTORICO_FUNCIONAL,
                    ) as SituacaoHistoricoFuncional[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_HISTORICO_FUNCIONAL[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="historico-funcional-filtro-organizacional"
              label="Referência organizacional"
            >
              {(control) => (
                <select
                  value={filtroOrganizacional}
                  onChange={(evento) =>
                    setFiltroOrganizacional(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as referências</option>
                  {referenciasOrganizacionaisDisponiveis.map((referencia) => (
                    <option key={referencia} value={referencia}>
                      {referencia}
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
          <p className="historico-funcional-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de histórico funcional cadastrada"
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
              caption="Histórico funcional (exemplo)"
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
          className="historico-funcional-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="historico-funcional-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="historico-funcional-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Vínculo técnico</dt>
              <dd>{detalheAberto.vinculoTecnico}</dd>
            </div>
            <div>
              <dt>Tipo de evento ilustrativo</dt>
              <dd>{detalheAberto.tipoEventoIlustrativo}</dd>
            </div>
            <div>
              <dt>Referência organizacional</dt>
              <dd>{detalheAberto.referenciaOrganizacional}</dd>
            </div>
            <div>
              <dt>Período ilustrativo</dt>
              <dd>{detalheAberto.periodoIlustrativo}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_HISTORICO_FUNCIONAL[detalheAberto.situacao]}
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

          <h3 className="historico-funcional-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="historico-funcional-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="historico-funcional-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="historico-funcional-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, admite, transfere, promove, altera salário, altera jornada,
            desliga, bloqueia acesso, salva, importa, exporta, aprova nem
            integra dados reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
