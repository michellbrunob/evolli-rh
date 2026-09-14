/**
 * Pessoas > Solicitações (T091) — tela visual estática.
 *
 * Demonstra o catálogo e acompanhamento de referências técnicas de
 * solicitação por tipo e escopo técnico — sem abrir, aprovar, recusar,
 * cancelar, efetivar, assinar, anexar, notificar, importar, exportar ou
 * integrar solicitações reais. Tudo aqui é amostra sintética própria, em
 * memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, envia, aprova,
 * recusa, devolve, cancela, efetiva, assina, anexa, notifica, importa,
 * exporta ou integra solicitações reais.
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
  ROTULO_SITUACAO_SOLICITACOES,
  SOLICITACOES_EXEMPLO,
  type SolicitacaoExemplo,
  type SituacaoSolicitacoes,
} from "./solicitacoes.fixtures";
import "./SolicitacoesScreen.css";

export const SOLICITACOES_TITULO_ID = "solicitacoes-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoSolicitacoes, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function SolicitacoesScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : SOLICITACOES_EXEMPLO),
    [estadoDemo],
  );

  const tiposDisponiveis = useMemo(() => {
    const unicos = new Set(
      SOLICITACOES_EXEMPLO.map((linha) => linha.tipoSolicitacao),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      SOLICITACOES_EXEMPLO.map((linha) => linha.escopoTecnico),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroTipo !== OPCAO_TODOS && linha.tipoSolicitacao !== filtroTipo) {
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
  }, [linhasBase, filtroTipo, filtroSituacao, filtroEscopo]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const tipos = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      tipos.add(linha.tipoSolicitacao);
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
      totalTipos: tipos.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<SolicitacaoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "tipo",
      header: "Tipo de solicitação",
      cell: (linha) => linha.tipoSolicitacao,
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
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_SOLICITACOES[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "encaminhamento",
      header: "Encaminhamento de referência",
      cell: (linha) => linha.encaminhamentoReferencia,
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
    <div className="solicitacoes-screen">
      <PageHeader
        headingLevel={1}
        titleId={SOLICITACOES_TITULO_ID}
        title="Solicitações"
        description="Demonstração visual do catálogo e acompanhamento de referências técnicas de solicitação por tipo e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="solicitacoes-screen__aviso"
        aria-labelledby="solicitacoes-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="solicitacoes-aviso-rh-titulo"
          className="solicitacoes-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="solicitacoes-screen__aviso"
        aria-labelledby="solicitacoes-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="solicitacoes-aviso-demo-titulo"
          className="solicitacoes-screen__aviso-texto"
        >
          Não há login, API, persistência, abertura, aprovação, recusa,
          cancelamento ou encaminhamento real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="solicitacoes-screen__aviso solicitacoes-screen__aviso--indisponivel"
        aria-labelledby="solicitacoes-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Acompanhamento não é decisão
        </StatusBadge>
        <p
          id="solicitacoes-aviso-referencia-titulo"
          className="solicitacoes-screen__aviso-texto"
        >
          Estas referências não concedem direito, não aprovam nem recusam
          solicitação e não alteram vínculo, ponto, Banco de Horas, Folha,
          documentos, permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="solicitacoes-screen__aviso solicitacoes-screen__aviso--indisponivel"
        aria-labelledby="solicitacoes-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="solicitacoes-aviso-dados-titulo"
          className="solicitacoes-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="solicitacoes-resumo-titulo"
        className="solicitacoes-screen__resumo"
      >
        <h2
          id="solicitacoes-resumo-titulo"
          className="solicitacoes-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="solicitacoes-screen__resumo-lista">
          <li className="solicitacoes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="solicitacoes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="solicitacoes-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="solicitacoes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="solicitacoes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Tipos de solicitação</StatusBadge>
              <p className="solicitacoes-screen__resumo-item-texto">
                {resumo.totalTipos} tipo(s) de solicitação (exemplo)
              </p>
            </Surface>
          </li>
          <li className="solicitacoes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="solicitacoes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="solicitacoes-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="solicitacoes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="solicitacoes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="solicitacoes-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="solicitacoes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="solicitacoes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="solicitacoes-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="solicitacoes-screen__nota">
          Estes indicadores não representam SLA operacional, cálculo, pagamento,
          desconto, quitação ou evento de Folha.
        </p>
      </section>

      <section
        aria-labelledby="solicitacoes-demo-titulo"
        className="solicitacoes-screen__demo"
      >
        <h2
          id="solicitacoes-demo-titulo"
          className="solicitacoes-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="solicitacoes-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das solicitações"
          className="solicitacoes-screen__demo-botoes"
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
          className="solicitacoes-screen__erro"
          aria-labelledby="solicitacoes-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="solicitacoes-erro-titulo"
            className="solicitacoes-screen__section-title"
          >
            Não foi possível carregar as referências de solicitações
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="solicitacoes-screen__erro-referencia">
            Referência: <code>REQ-DEMO-011048</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="solicitacoes-lista-titulo">
          <h2
            id="solicitacoes-lista-titulo"
            className="solicitacoes-screen__section-title"
          >
            Referências de solicitações
          </h2>

          <div className="solicitacoes-screen__filtros">
            <FormField id="solicitacoes-filtro-tipo" label="Tipo de referência">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {tiposDisponiveis.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="solicitacoes-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_SOLICITACOES,
                    ) as SituacaoSolicitacoes[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_SOLICITACOES[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="solicitacoes-filtro-escopo" label="Escopo técnico">
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
          <p className="solicitacoes-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de solicitação cadastrada"
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
              caption="Solicitações (exemplo)"
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
          className="solicitacoes-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="solicitacoes-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="solicitacoes-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Tipo de solicitação</dt>
              <dd>{detalheAberto.tipoSolicitacao}</dd>
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
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_SOLICITACOES[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Encaminhamento de referência</dt>
              <dd>{detalheAberto.encaminhamentoReferencia}</dd>
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

          <h3 className="solicitacoes-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="solicitacoes-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="solicitacoes-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="solicitacoes-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, envia, aprova, recusa, devolve, cancela, efetiva, assina,
            anexa, notifica, importa, exporta nem integra solicitações reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
