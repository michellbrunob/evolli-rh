/**
 * Cadastros > Centros de custo (T083) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências organizacionais de centro
 * de custo por empresa/unidade e estrutura técnica — sem criar rateio,
 * orçamento, pagamento, desconto, lançamento contábil, regra de Folha ou
 * permissão de acesso real. Tudo aqui é amostra sintética própria, em
 * memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, vincula, ativa,
 * aprova, salva, importa, exporta, integra, calcula valor, gera rateio nem
 * altera registro real.
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
  CENTROS_CUSTO_EXEMPLO,
  type CentroCustoExemplo,
  ROTULO_SITUACAO_CENTRO_CUSTO,
  type SituacaoCentroCusto,
} from "./centrosCusto.fixtures";
import "./CentrosCustoScreen.css";

export const CENTROS_CUSTO_TITULO_ID = "centros-custo-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoCentroCusto, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function CentrosCustoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroUnidade, setFiltroUnidade] = useState<string>(OPCAO_TODOS);
  const [filtroEstrutura, setFiltroEstrutura] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : CENTROS_CUSTO_EXEMPLO),
    [estadoDemo],
  );

  const unidadesDisponiveis = useMemo(() => {
    const unicos = new Set(
      CENTROS_CUSTO_EXEMPLO.map((linha) => linha.empresaUnidadeTecnica),
    );
    return Array.from(unicos);
  }, []);

  const estruturasDisponiveis = useMemo(() => {
    const unicos = new Set(
      CENTROS_CUSTO_EXEMPLO.map((linha) => linha.estruturaDepartamentoTecnico),
    );
    return Array.from(unicos);
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
      if (
        filtroEstrutura !== OPCAO_TODOS &&
        linha.estruturaDepartamentoTecnico !== filtroEstrutura
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroSituacao, filtroUnidade, filtroEstrutura]);

  const filtrosAtivos =
    filtroSituacao !== OPCAO_TODOS ||
    filtroUnidade !== OPCAO_TODOS ||
    filtroEstrutura !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroUnidade(OPCAO_TODOS);
    setFiltroEstrutura(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const unidadesRelacionadas = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      unidadesRelacionadas.add(linha.empresaUnidadeTecnica);
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
      totalCentrosCusto: linhasBase.length,
      totalUnidadesRelacionadas: unidadesRelacionadas.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<CentroCustoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "codigoTecnico",
      header: "Código técnico ilustrativo",
      cell: (linha) => linha.codigoTecnico,
    },
    {
      key: "centroCusto",
      header: "Centro de custo",
      cell: (linha) => linha.centroCusto,
    },
    {
      key: "unidade",
      header: "Empresa/unidade técnica",
      cell: (linha) => linha.empresaUnidadeTecnica,
    },
    {
      key: "estrutura",
      header: "Estrutura/departamento técnico",
      cell: (linha) => linha.estruturaDepartamentoTecnico,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_CENTRO_CUSTO[linha.situacao]}
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
    <div className="centros-custo-screen">
      <PageHeader
        headingLevel={1}
        titleId={CENTROS_CUSTO_TITULO_ID}
        title="Centros de custo"
        description="Demonstração visual de como o RH poderá consultar referências organizacionais de centro de custo por empresa/unidade e estrutura técnica."
      />

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso"
        aria-labelledby="centros-custo-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="centros-custo-aviso-rh-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          O RH consulta somente referências de centro de custo da própria
          empresa e das unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso"
        aria-labelledby="centros-custo-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="centros-custo-aviso-demo-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          Não há login, API, persistência, importação, exportação, cálculo,
          integração, lançamento ou alteração cadastral real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso centros-custo-screen__aviso--indisponivel"
        aria-labelledby="centros-custo-aviso-financeiro-titulo"
      >
        <StatusBadge variant="warning">
          Referência não é regra financeira
        </StatusBadge>
        <p
          id="centros-custo-aviso-financeiro-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          Centro de custo é referência organizacional e não cria rateio,
          orçamento, pagamento, desconto, lançamento contábil, regra de Folha ou
          permissão de acesso.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso centros-custo-screen__aviso--indisponivel"
        aria-labelledby="centros-custo-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="centros-custo-aviso-dados-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          Qualquer operação real depende de MFA, do gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade, Folha/DP,
          Contabilidade e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="centros-custo-resumo-titulo"
        className="centros-custo-screen__resumo"
      >
        <h2
          id="centros-custo-resumo-titulo"
          className="centros-custo-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="centros-custo-screen__resumo-lista">
          <li className="centros-custo-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="centros-custo-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Centros de custo</StatusBadge>
              <p className="centros-custo-screen__resumo-item-texto">
                {resumo.totalCentrosCusto} centro(s) de custo de referência
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="centros-custo-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="centros-custo-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Unidades relacionadas</StatusBadge>
              <p className="centros-custo-screen__resumo-item-texto">
                {resumo.totalUnidadesRelacionadas} unidade(s) técnica(s)
                relacionada(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="centros-custo-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="centros-custo-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="centros-custo-screen__resumo-item-texto">
                {resumo.totalEmRevisao} referência(s) organizacional(is) em
                revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="centros-custo-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="centros-custo-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Exigem decisão formal</StatusBadge>
              <p className="centros-custo-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) aguardando decisão
                formal (exemplo)
              </p>
            </Surface>
          </li>
          <li className="centros-custo-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="centros-custo-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="centros-custo-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) ilustrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="centros-custo-screen__nota">
          Estes indicadores não calculam valores, orçamento, rateio, pagamento,
          desconto, jornada, Banco de Horas, Folha, contabilidade, permissões ou
          acesso.
        </p>
      </section>

      <section
        aria-labelledby="centros-custo-demo-titulo"
        className="centros-custo-screen__demo"
      >
        <h2
          id="centros-custo-demo-titulo"
          className="centros-custo-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="centros-custo-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos centros de custo"
          className="centros-custo-screen__demo-botoes"
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
          className="centros-custo-screen__erro"
          aria-labelledby="centros-custo-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="centros-custo-erro-titulo"
            className="centros-custo-screen__section-title"
          >
            Não foi possível carregar as referências de centro de custo
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="centros-custo-screen__erro-referencia">
            Referência: <code>REQ-DEMO-003014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="centros-custo-lista-titulo">
          <h2
            id="centros-custo-lista-titulo"
            className="centros-custo-screen__section-title"
          >
            Referências de centro de custo
          </h2>

          <div className="centros-custo-screen__filtros">
            <FormField id="centros-custo-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_CENTRO_CUSTO,
                    ) as SituacaoCentroCusto[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_CENTRO_CUSTO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="centros-custo-filtro-unidade"
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

            <FormField
              id="centros-custo-filtro-estrutura"
              label="Estrutura/departamento técnico"
            >
              {(control) => (
                <select
                  value={filtroEstrutura}
                  onChange={(evento) => setFiltroEstrutura(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as estruturas</option>
                  {estruturasDisponiveis.map((estrutura) => (
                    <option key={estrutura} value={estrutura}>
                      {estrutura}
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
          <p className="centros-custo-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de centro de custo cadastrada"
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
              caption="Centros de custo (exemplo)"
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
          className="centros-custo-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="centros-custo-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="centros-custo-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Código técnico ilustrativo</dt>
              <dd>{detalheAberto.codigoTecnico}</dd>
            </div>
            <div>
              <dt>Centro de custo</dt>
              <dd>{detalheAberto.centroCusto}</dd>
            </div>
            <div>
              <dt>Empresa/unidade técnica</dt>
              <dd>{detalheAberto.empresaUnidadeTecnica}</dd>
            </div>
            <div>
              <dt>Estrutura/departamento técnico</dt>
              <dd>{detalheAberto.estruturaDepartamentoTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_CENTRO_CUSTO[detalheAberto.situacao]}</dd>
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

          <h3 className="centros-custo-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="centros-custo-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="centros-custo-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="centros-custo-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, vincula, ativa, aprova, salva, importa, exporta, integra,
            calcula valor, gera rateio nem altera qualquer registro real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
