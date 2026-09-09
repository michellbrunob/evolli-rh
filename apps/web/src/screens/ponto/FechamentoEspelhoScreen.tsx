/**
 * Ponto > Fechamento e Espelho (T079) — tela visual estática.
 *
 * Demonstra como o RH poderá acompanhar a revisão de um período antes de um
 * eventual fechamento — pendências bloqueadoras, alertas informativos,
 * ajustes manuais em revisão, validação/recomendação do gestor e situação do
 * espelho. Tudo aqui é amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação fecha, reabre, aprova,
 * rejeita, calcula, salva, assina, envia ou altera dado real. Não calcula
 * jornada, saldo, compensação, pagamento, desconto, DSR, Banco de Horas ou
 * Folha.
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
  FECHAMENTOS_ESPELHO_EXEMPLO,
  type FechamentoEspelhoExemplo,
  formatarPeriodoIlustrativo,
  ROTULO_SITUACAO_FECHAMENTO,
  type SituacaoFechamento,
} from "./fechamentoEspelho.fixtures";
import "./FechamentoEspelhoScreen.css";

export const FECHAMENTO_ESPELHO_TITULO_ID = "fechamento-espelho-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoFechamento, StatusVariant> = {
  em_revisao_exemplo: "info",
  aguardando_validacao_exemplo: "warning",
  pronto_para_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

const ETAPAS_LINHA_DO_TEMPO: readonly string[] = [
  "Período em revisão",
  "Tratamento de pendências",
  "Validação/recomendação do gestor",
  "Revisão final do RH",
  "Fechamento autorizado",
  "Espelho disponibilizado",
];

export function FechamentoEspelhoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroUnidade, setFiltroUnidade] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : FECHAMENTOS_ESPELHO_EXEMPLO),
    [estadoDemo],
  );

  const unidadesDisponiveis = useMemo(() => {
    const unicas = new Set(
      FECHAMENTOS_ESPELHO_EXEMPLO.map((linha) => linha.empresaUnidadeTecnica),
    );
    return Array.from(unicas);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroUnidade !== OPCAO_TODOS &&
        linha.empresaUnidadeTecnica !== filtroUnidade
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroSituacao, filtroUnidade]);

  const filtrosAtivos =
    filtroSituacao !== OPCAO_TODOS || filtroUnidade !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroUnidade(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    let totalPendencias = 0;
    let totalAlertas = 0;
    let totalAjustesEmRevisao = 0;
    let totalValidacoesGestor = 0;
    let totalEspelhoDisponibilizado = 0;
    for (const linha of linhasBase) {
      totalPendencias += linha.pendenciasBloqueadoras.length;
      totalAlertas += linha.alertasInformativos.length;
      totalAjustesEmRevisao += linha.ajustesManuaisEmRevisao;
      if (linha.validacaoGestor !== "Pendente (exemplo)") {
        totalValidacoesGestor += 1;
      }
      if (linha.situacaoEspelho === "Disponibilizado (exemplo)") {
        totalEspelhoDisponibilizado += 1;
      }
    }
    return {
      totalPendencias,
      totalAlertas,
      totalAjustesEmRevisao,
      totalValidacoesGestor,
      totalEspelhoDisponibilizado,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<FechamentoEspelhoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => formatarPeriodoIlustrativo(linha),
    },
    {
      key: "unidade",
      header: "Empresa/unidade técnica",
      cell: (linha) => linha.empresaUnidadeTecnica,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_FECHAMENTO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "pendencias",
      header: "Pendências bloqueadoras",
      cell: (linha) =>
        `${linha.pendenciasBloqueadoras.length} pendência(s) (exemplo)`,
    },
    {
      key: "alertas",
      header: "Alertas informativos",
      cell: (linha) =>
        `${linha.alertasInformativos.length} alerta(s) (exemplo)`,
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
    <div className="fechamento-espelho-screen">
      <PageHeader
        headingLevel={1}
        titleId={FECHAMENTO_ESPELHO_TITULO_ID}
        title="Fechamento e Espelho"
        description="Demonstração visual de como o RH poderá acompanhar a revisão de um período antes de um eventual fechamento — sem calcular jornada, saldo ou executar fechamento real."
      />

      <Surface
        as="section"
        padding="md"
        className="fechamento-espelho-screen__aviso"
        aria-labelledby="fechamento-espelho-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="fechamento-espelho-aviso-rh-titulo"
          className="fechamento-espelho-screen__aviso-texto"
        >
          RH atua somente na empresa/unidades sob seu escopo. Gestor apenas
          valida, recomenda, devolve ou rejeita itens no fluxo aplicável; não
          altera marcação nem fecha período.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="fechamento-espelho-screen__aviso"
        aria-labelledby="fechamento-espelho-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="fechamento-espelho-aviso-demo-titulo"
          className="fechamento-espelho-screen__aviso-texto"
        >
          Não há login, API, persistência, cálculo real, geração de PDF,
          assinatura, integração com Folha nem fechamento operacional nesta
          tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="fechamento-espelho-screen__aviso fechamento-espelho-screen__aviso--indisponivel"
        aria-labelledby="fechamento-espelho-aviso-nao-automatico-titulo"
      >
        <StatusBadge variant="warning">Fechamento não automático</StatusBadge>
        <p
          id="fechamento-espelho-aviso-nao-automatico-titulo"
          className="fechamento-espelho-screen__aviso-texto"
        >
          Alertas, pendências cadastrais ou exceções não fecham o período
          sozinhos. O fechamento real depende de decisão formal e dos gates
          definidos para o domínio.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="fechamento-espelho-screen__aviso fechamento-espelho-screen__aviso--indisponivel"
        aria-labelledby="fechamento-espelho-aviso-preservacao-titulo"
      >
        <StatusBadge variant="warning">Preservação</StatusBadge>
        <p
          id="fechamento-espelho-aviso-preservacao-titulo"
          className="fechamento-espelho-screen__aviso-texto"
        >
          Marcações originais nunca são apagadas ou sobrescritas; ajustes são
          aditivos, identificados e auditáveis.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="fechamento-espelho-screen__aviso fechamento-espelho-screen__aviso--indisponivel"
        aria-labelledby="fechamento-espelho-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dado real bloqueado</StatusBadge>
        <p
          id="fechamento-espelho-aviso-bloqueio-titulo"
          className="fechamento-espelho-screen__aviso-texto"
        >
          Qualquer operação com dado real depende de MFA, do gate-mestre de
          segurança operacional (<code>DS-OPS-01</code>), auditoria,
          retenção/base legal e validações aplicáveis de RH,
          Jurídico/privacidade e Folha.
        </p>
      </Surface>

      <section
        aria-labelledby="fechamento-espelho-linha-tempo-titulo"
        className="fechamento-espelho-screen__linha-tempo"
      >
        <h2
          id="fechamento-espelho-linha-tempo-titulo"
          className="fechamento-espelho-screen__section-title"
        >
          Linha do tempo do fechamento (apenas informativo)
        </h2>
        <ol className="fechamento-espelho-screen__linha-tempo-lista">
          {ETAPAS_LINHA_DO_TEMPO.map((etapa) => (
            <li key={etapa}>{etapa}</li>
          ))}
        </ol>
        <p className="fechamento-espelho-screen__nota">
          Todos os passos acima são apenas ilustrativos — nenhum botão desta
          tela executa fechamento, reabertura, cálculo, aprovação, assinatura,
          geração ou envio.
        </p>
      </section>

      <section
        aria-labelledby="fechamento-espelho-resumo-titulo"
        className="fechamento-espelho-screen__resumo"
      >
        <h2
          id="fechamento-espelho-resumo-titulo"
          className="fechamento-espelho-screen__section-title"
        >
          Resumo do período (exemplo)
        </h2>
        <ul className="fechamento-espelho-screen__resumo-lista">
          <li className="fechamento-espelho-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="fechamento-espelho-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">
                Pendências bloqueadoras
              </StatusBadge>
              <p className="fechamento-espelho-screen__resumo-item-texto">
                {resumo.totalPendencias} pendência(s) bloqueadora(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="fechamento-espelho-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="fechamento-espelho-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Alertas informativos</StatusBadge>
              <p className="fechamento-espelho-screen__resumo-item-texto">
                {resumo.totalAlertas} alerta(s) informativo(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="fechamento-espelho-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="fechamento-espelho-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">
                Ajustes manuais em revisão
              </StatusBadge>
              <p className="fechamento-espelho-screen__resumo-item-texto">
                {resumo.totalAjustesEmRevisao} ajuste(s) manual(is) em revisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="fechamento-espelho-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="fechamento-espelho-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="success">Validação do gestor</StatusBadge>
              <p className="fechamento-espelho-screen__resumo-item-texto">
                {resumo.totalValidacoesGestor} validação(ões)/recomendação(ões)
                de gestor (exemplo)
              </p>
            </Surface>
          </li>
          <li className="fechamento-espelho-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="fechamento-espelho-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Situação do espelho</StatusBadge>
              <p className="fechamento-espelho-screen__resumo-item-texto">
                {resumo.totalEspelhoDisponibilizado} espelho(s)
                disponibilizado(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="fechamento-espelho-screen__nota">
          Estes números são apenas exemplos de interface — não calculam jornada,
          saldo, compensação, pagamento, desconto, DSR, Banco de Horas ou Folha.
        </p>
      </section>

      <section
        aria-labelledby="fechamento-espelho-demo-titulo"
        className="fechamento-espelho-screen__demo"
      >
        <h2
          id="fechamento-espelho-demo-titulo"
          className="fechamento-espelho-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="fechamento-espelho-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos períodos"
          className="fechamento-espelho-screen__demo-botoes"
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
          className="fechamento-espelho-screen__erro"
          aria-labelledby="fechamento-espelho-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="fechamento-espelho-erro-titulo"
            className="fechamento-espelho-screen__section-title"
          >
            Não foi possível carregar os períodos de fechamento
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="fechamento-espelho-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001854</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="fechamento-espelho-lista-titulo">
          <h2
            id="fechamento-espelho-lista-titulo"
            className="fechamento-espelho-screen__section-title"
          >
            Períodos em acompanhamento
          </h2>

          <div className="fechamento-espelho-screen__filtros">
            <FormField id="fechamento-espelho-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_FECHAMENTO,
                    ) as SituacaoFechamento[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_FECHAMENTO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="fechamento-espelho-filtro-unidade"
              label="Empresa/unidade técnica"
            >
              {(control) => (
                <select
                  value={filtroUnidade}
                  onChange={(evento) => setFiltroUnidade(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as unidades</option>
                  {unidadesDisponiveis.map((unidade) => (
                    <option key={unidade} value={unidade}>
                      {unidade}
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
          <p className="fechamento-espelho-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum período em acompanhamento"
              description="Quando houver um período desta empresa em revisão, ele aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum período corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver os demais períodos desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Fechamento e Espelho — períodos (exemplo)"
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
          className="fechamento-espelho-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="fechamento-espelho-screen__section-title"
          >
            Detalhe do período — {detalheAberto.id}
          </h2>
          <dl className="fechamento-espelho-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Período ilustrativo</dt>
              <dd>{formatarPeriodoIlustrativo(detalheAberto)}</dd>
            </div>
            <div>
              <dt>Empresa/unidade técnica</dt>
              <dd>{detalheAberto.empresaUnidadeTecnica}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_FECHAMENTO[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Responsável técnico</dt>
              <dd>{detalheAberto.responsavelTecnico}</dd>
            </div>
            <div>
              <dt>Validação/recomendação do gestor</dt>
              <dd>{detalheAberto.validacaoGestor}</dd>
            </div>
            <div>
              <dt>Condição do espelho</dt>
              <dd>{detalheAberto.situacaoEspelho}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="fechamento-espelho-screen__detalhe-subtitulo">
            Pendências bloqueadoras (exemplo)
          </h3>
          {detalheAberto.pendenciasBloqueadoras.length === 0 ? (
            <p>Nenhuma pendência bloqueadora (exemplo).</p>
          ) : (
            <ul className="fechamento-espelho-screen__detalhe-lista-simples">
              {detalheAberto.pendenciasBloqueadoras.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <h3 className="fechamento-espelho-screen__detalhe-subtitulo">
            Alertas informativos (exemplo)
          </h3>
          {detalheAberto.alertasInformativos.length === 0 ? (
            <p>Nenhum alerta informativo (exemplo).</p>
          ) : (
            <ul className="fechamento-espelho-screen__detalhe-lista-simples">
              {detalheAberto.alertasInformativos.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="fechamento-espelho-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não fecha,
            reabre, aprova, rejeita, calcula, salva, assina, envia nem altera
            dado real. O gestor não edita marcações nem executa fechamento aqui.
          </p>
          <p className="fechamento-espelho-screen__detalhe-aviso">
            Qualquer fechamento real exige fluxo, autorização e gates
            específicos. Eventual reabertura não recalcula automaticamente
            períodos históricos nem cria lançamento automático na Folha.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
