/**
 * Solicitações > Central do RH (T068) — tela visual estática.
 *
 * Demonstra a fila de revisão do RH para solicitações do colaborador, com
 * tipos e estados **compatíveis** com a Central de Solicitações do Colaborador
 * (T065/T066, `docs/modules/etapa3-central-solicitacoes-colaborador-contrato-v1.md`,
 * `apps/api/src/solicitacoes/`) — mas sem chamar aquele núcleo: tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência, sem anexo/upload/download. O botão
 * "Encaminhar (demonstração)" só troca a situação exibida **em memória**,
 * respeitando a mesma transição do contrato (`em_revisao_rh` →
 * `encaminhada_para_operacao_rh`) — nunca corrige marcação, gera débito,
 * altera saldo, férias, cadastro, documento, Folha ou fechamento, e não
 * persiste nem integra nada.
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
import { formatarDiaCivil } from "../../format/data";
import {
  type EstadoSolicitacaoRH,
  type PrioridadeSolicitacaoRH,
  ROTULO_ESTADO_RH,
  ROTULO_PRIORIDADE_RH,
  ROTULO_TIPO_RH,
  SOLICITACOES_RH_EXEMPLO,
  type SolicitacaoRHExemplo,
  type TipoSolicitacaoRH,
} from "./centralSolicitacoesRH.fixtures";
import "./CentralSolicitacoesRHScreen.css";

export const CENTRAL_SOLICITACOES_RH_TITULO_ID =
  "central-solicitacoes-rh-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_ESTADO: Record<EstadoSolicitacaoRH, StatusVariant> = {
  rascunho: "neutral",
  enviada: "info",
  em_revisao_rh: "info",
  aguardando_informacao: "warning",
  encaminhada_para_operacao_rh: "success",
  recusada: "danger",
  cancelada: "neutral",
};

const VARIANTE_PRIORIDADE: Record<PrioridadeSolicitacaoRH, StatusVariant> = {
  informativa: "info",
  atencao: "warning",
  critica: "danger",
};

const OPCAO_TODOS = "todos";

export function CentralSolicitacoesRHScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, EstadoSolicitacaoRH>
  >({});
  const detalheTituloId = useId();

  const baseLinhas = useMemo(
    () => (estadoDemo === "vazio" ? [] : SOLICITACOES_RH_EXEMPLO),
    [estadoDemo],
  );

  const linhasComOverride = useMemo(
    () =>
      baseLinhas.map((item) =>
        overrides[item.id] ? { ...item, situacao: overrides[item.id]! } : item,
      ),
    [baseLinhas, overrides],
  );

  const linhasFiltradas = useMemo(() => {
    return linhasComOverride.filter((item) => {
      if (filtroTipo !== OPCAO_TODOS && item.tipo !== filtroTipo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && item.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroPrioridade !== OPCAO_TODOS &&
        item.prioridade !== filtroPrioridade
      ) {
        return false;
      }
      return true;
    });
  }, [linhasComOverride, filtroTipo, filtroSituacao, filtroPrioridade]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroPrioridade !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroPrioridade(OPCAO_TODOS);
  }

  function encaminharDemonstracao(id: string) {
    setOverrides((atual) => ({
      ...atual,
      [id]: "encaminhada_para_operacao_rh",
    }));
  }

  const detalheAberto =
    detalheAbertoId != null
      ? linhasComOverride.find((item) => item.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<SolicitacaoRHExemplo>[] = [
    {
      key: "referencia",
      header: "Referência",
      cell: (linha) => <code>{linha.id}</code>,
    },
    { key: "vinculo", header: "Vínculo", cell: (linha) => linha.vinculoRef },
    {
      key: "tipo",
      header: "Tipo",
      cell: (linha) => ROTULO_TIPO_RH[linha.tipo],
    },
    {
      key: "periodo",
      header: "Período",
      cell: (linha) => formatarDiaCivil(linha.periodoReferencia),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_ESTADO[linha.situacao]}>
          {ROTULO_ESTADO_RH[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "prioridade",
      header: "Prioridade",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_PRIORIDADE[linha.prioridade]}>
          {ROTULO_PRIORIDADE_RH[linha.prioridade]}
        </StatusBadge>
      ),
    },
    {
      key: "encaminhamento",
      header: "Encaminhamento",
      cell: (linha) => {
        if (linha.situacao === "em_revisao_rh") {
          return (
            <Button
              variant="subtle"
              onClick={() => encaminharDemonstracao(linha.id)}
            >
              Encaminhar (demonstração)
              <span className="sr-only"> — {linha.id}</span>
            </Button>
          );
        }
        if (linha.situacao === "encaminhada_para_operacao_rh") {
          return <StatusBadge variant="success">Já encaminhada</StatusBadge>;
        }
        if (linha.situacao === "recusada" || linha.situacao === "cancelada") {
          return <StatusBadge variant="neutral">Não encaminhada</StatusBadge>;
        }
        return <StatusBadge variant="neutral">Aguardando revisão</StatusBadge>;
      },
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
    <div className="central-solicitacoes-rh-screen">
      <PageHeader
        headingLevel={1}
        titleId={CENTRAL_SOLICITACOES_RH_TITULO_ID}
        title="Central do RH"
        description="Fila de revisão demonstrativa das solicitações do colaborador — apenas exemplo, com tipos e estados compatíveis com a Central de Solicitações do Colaborador."
      />

      <Surface
        as="section"
        padding="md"
        className="central-solicitacoes-rh-screen__aviso"
        aria-labelledby="central-solicitacoes-rh-aviso-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="central-solicitacoes-rh-aviso-titulo"
          className="central-solicitacoes-rh-screen__aviso-texto"
        >
          O RH revisa apenas solicitações da própria empresa. Toda ação nesta
          tela é apenas demonstrativa: encaminhar não altera automaticamente
          ponto, saldo, férias, cadastro, documento, Folha ou fechamento — a
          operação efetiva segue os fluxos próprios do RH, fora desta
          demonstração.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="central-solicitacoes-rh-screen__aviso central-solicitacoes-rh-screen__aviso--indisponivel"
        aria-labelledby="central-solicitacoes-rh-anexos-titulo"
      >
        <StatusBadge variant="warning">Ainda não disponível</StatusBadge>
        <p
          id="central-solicitacoes-rh-anexos-titulo"
          className="central-solicitacoes-rh-screen__aviso-texto"
        >
          Anexos, upload, download e armazenamento documental ainda não estão
          disponíveis nesta demonstração.
        </p>
      </Surface>

      <section
        aria-labelledby="central-solicitacoes-rh-demo-titulo"
        className="central-solicitacoes-rh-screen__demo"
      >
        <h2
          id="central-solicitacoes-rh-demo-titulo"
          className="central-solicitacoes-rh-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="central-solicitacoes-rh-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das solicitações"
          className="central-solicitacoes-rh-screen__demo-botoes"
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
          className="central-solicitacoes-rh-screen__erro"
          aria-labelledby="central-solicitacoes-rh-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="central-solicitacoes-rh-erro-titulo"
            className="central-solicitacoes-rh-screen__section-title"
          >
            Não foi possível carregar as solicitações
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="central-solicitacoes-rh-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000789</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <>
          <div className="central-solicitacoes-rh-screen__filtros">
            <FormField id="central-rh-filtro-tipo" label="Tipo">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO_RH) as TipoSolicitacaoRH[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_RH[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField id="central-rh-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(Object.keys(ROTULO_ESTADO_RH) as EstadoSolicitacaoRH[]).map(
                    (estado) => (
                      <option key={estado} value={estado}>
                        {ROTULO_ESTADO_RH[estado]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField id="central-rh-filtro-prioridade" label="Prioridade">
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
                      ROTULO_PRIORIDADE_RH,
                    ) as PrioridadeSolicitacaoRH[]
                  ).map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {ROTULO_PRIORIDADE_RH[prioridade]}
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
          <p className="central-solicitacoes-rh-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          <section aria-labelledby="central-solicitacoes-rh-lista-titulo">
            <h2
              id="central-solicitacoes-rh-lista-titulo"
              className="central-solicitacoes-rh-screen__section-title"
            >
              Solicitações
            </h2>

            {baseLinhas.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma solicitação para revisar"
                description="Quando houver solicitação desta empresa, ela aparece aqui para triagem do RH (exemplo)."
              />
            ) : linhasFiltradas.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma solicitação corresponde aos filtros"
                description="Ajuste ou limpe os filtros para ver as demais solicitações desta demonstração."
                action={
                  <Button variant="primary" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <DataTable
                caption="Solicitações para revisão do RH"
                columns={colunas}
                rows={linhasFiltradas}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        </>
      )}

      {detalheAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="central-solicitacoes-rh-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="central-solicitacoes-rh-screen__section-title"
          >
            Detalhe da solicitação — {ROTULO_TIPO_RH[detalheAberto.tipo]}
          </h2>
          <dl className="central-solicitacoes-rh-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Vínculo</dt>
              <dd>{detalheAberto.vinculoRef}</dd>
            </div>
            <div>
              <dt>Período</dt>
              {/*
                Mesmo campo, mesma solicitação: o detalhe mostrava "Não
                aplicável" onde a tabela mostra o traço, então clicar em "Ver
                detalhe" de uma linha vazia trocava o texto da ausência. A T154
                unifica os dois no mesmo traço.
              */}
              <dd>{formatarDiaCivil(detalheAberto.periodoReferencia)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_ESTADO_RH[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Prioridade</dt>
              <dd>{ROTULO_PRIORIDADE_RH[detalheAberto.prioridade]}</dd>
            </div>
            <div>
              <dt>Motivo codificado</dt>
              <dd>
                <code>{detalheAberto.motivoCodificado}</code>
              </dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{detalheAberto.detalhe}</dd>
            </div>
          </dl>
          <p className="central-solicitacoes-rh-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> abrir este detalhe não
            altera, corrige, aprova, encaminha nem persiste nenhuma solicitação
            real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
