/**
 * Relatórios > Extrato de Banco de Horas (T098) — tela visual estática.
 *
 * Demonstra referências técnicas de extrato de Banco de Horas por período,
 * tipo de referência e situação — sem criar, editar, calcular, movimentar,
 * compensar, quitar, fechar, reabrir, pagar, descontar, salvar, gerar,
 * exportar, importar ou integrar extrato real. Crédito, débito e saldo são
 * textos ilustrativos não numéricos, sem fórmula ou cálculo. Tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, calcula,
 * movimenta, compensa, quita, fecha, reabre, paga, desconta, salva, gera,
 * exporta, importa ou integra extratos reais.
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
  type ExtratoBancoHorasExemplo,
  EXTRATO_BANCO_HORAS_EXEMPLO,
  ROTULO_SITUACAO_EXTRATO,
  ROTULO_TIPO_REFERENCIA_EXTRATO,
  type SituacaoExtrato,
  type TipoReferenciaExtrato,
} from "./extratoBancoHoras.fixtures";
import "./ExtratoBancoHorasScreen.css";

export const EXTRATO_BANCO_HORAS_TITULO_ID = "extrato-banco-horas-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoExtrato, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function ExtratoBancoHorasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>(OPCAO_TODOS);
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : EXTRATO_BANCO_HORAS_EXEMPLO),
    [estadoDemo],
  );

  const periodosDisponiveis = useMemo(() => {
    const unicos = new Set(
      EXTRATO_BANCO_HORAS_EXEMPLO.map((linha) => linha.periodoIlustrativo),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroPeriodo !== OPCAO_TODOS &&
        linha.periodoIlustrativo !== filtroPeriodo
      ) {
        return false;
      }
      if (filtroTipo !== OPCAO_TODOS && linha.tipoReferencia !== filtroTipo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroPeriodo, filtroTipo, filtroSituacao]);

  const filtrosAtivos =
    filtroPeriodo !== OPCAO_TODOS ||
    filtroTipo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroPeriodo(OPCAO_TODOS);
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    let totalCreditos = 0;
    let totalDebitos = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      if (linha.tipoReferencia === "credito_ilustrativo_exemplo") {
        totalCreditos += 1;
      }
      if (linha.tipoReferencia === "debito_ilustrativo_exemplo") {
        totalDebitos += 1;
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
      totalCreditos,
      totalDebitos,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<ExtratoBancoHorasExemplo>[] = [
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
      key: "tipo",
      header: "Tipo de referência",
      cell: (linha) => ROTULO_TIPO_REFERENCIA_EXTRATO[linha.tipoReferencia],
    },
    {
      key: "credito",
      header: "Crédito ilustrativo",
      cell: (linha) => linha.creditoIlustrativo,
    },
    {
      key: "debito",
      header: "Débito ilustrativo",
      cell: (linha) => linha.debitoIlustrativo,
    },
    {
      key: "saldo",
      header: "Saldo de referência",
      cell: (linha) => linha.saldoReferencia,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_EXTRATO[linha.situacao]}
        </StatusBadge>
      ),
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
    <div className="extrato-banco-horas-screen">
      <PageHeader
        headingLevel={1}
        titleId={EXTRATO_BANCO_HORAS_TITULO_ID}
        title="Extrato de Banco de Horas"
        description="Demonstração visual de referências técnicas de extrato de Banco de Horas por período, tipo de referência e situação."
      />

      <Surface
        as="section"
        padding="md"
        className="extrato-banco-horas-screen__aviso"
        aria-labelledby="extrato-banco-horas-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="extrato-banco-horas-aviso-rh-titulo"
          className="extrato-banco-horas-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="extrato-banco-horas-screen__aviso"
        aria-labelledby="extrato-banco-horas-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="extrato-banco-horas-aviso-demo-titulo"
          className="extrato-banco-horas-screen__aviso-texto"
        >
          Não há login, API, persistência, cálculo, movimentação, compensação,
          quitação, fechamento, geração, exportação ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="extrato-banco-horas-screen__aviso extrato-banco-horas-screen__aviso--indisponivel"
        aria-labelledby="extrato-banco-horas-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Extrato não é saldo operacional
        </StatusBadge>
        <p
          id="extrato-banco-horas-aviso-referencia-titulo"
          className="extrato-banco-horas-screen__aviso-texto"
        >
          Estas referências não alteram crédito, débito, saldo derivado, ponto,
          vínculo, jornada, remuneração, benefícios, documentos, permissões ou
          acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="extrato-banco-horas-screen__aviso extrato-banco-horas-screen__aviso--indisponivel"
        aria-labelledby="extrato-banco-horas-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="extrato-banco-horas-aviso-dados-titulo"
          className="extrato-banco-horas-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="extrato-banco-horas-resumo-titulo"
        className="extrato-banco-horas-screen__resumo"
      >
        <h2
          id="extrato-banco-horas-resumo-titulo"
          className="extrato-banco-horas-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="extrato-banco-horas-screen__resumo-lista">
          <li className="extrato-banco-horas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="extrato-banco-horas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="extrato-banco-horas-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="extrato-banco-horas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="extrato-banco-horas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Créditos ilustrativos</StatusBadge>
              <p className="extrato-banco-horas-screen__resumo-item-texto">
                {resumo.totalCreditos} referência(s) de crédito (exemplo)
              </p>
            </Surface>
          </li>
          <li className="extrato-banco-horas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="extrato-banco-horas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Débitos ilustrativos</StatusBadge>
              <p className="extrato-banco-horas-screen__resumo-item-texto">
                {resumo.totalDebitos} referência(s) de débito (exemplo)
              </p>
            </Surface>
          </li>
          <li className="extrato-banco-horas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="extrato-banco-horas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="extrato-banco-horas-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="extrato-banco-horas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="extrato-banco-horas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="extrato-banco-horas-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="extrato-banco-horas-screen__nota">
          Não há cálculo de saldo, compensação, quitação, pagamento, desconto,
          DSR ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="extrato-banco-horas-demo-titulo"
        className="extrato-banco-horas-screen__demo"
      >
        <h2
          id="extrato-banco-horas-demo-titulo"
          className="extrato-banco-horas-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="extrato-banco-horas-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do extrato"
          className="extrato-banco-horas-screen__demo-botoes"
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
          className="extrato-banco-horas-screen__erro"
          aria-labelledby="extrato-banco-horas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="extrato-banco-horas-erro-titulo"
            className="extrato-banco-horas-screen__section-title"
          >
            Não foi possível carregar as referências de extrato
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="extrato-banco-horas-screen__erro-referencia">
            Referência: <code>REQ-DEMO-018230</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="extrato-banco-horas-lista-titulo">
          <h2
            id="extrato-banco-horas-lista-titulo"
            className="extrato-banco-horas-screen__section-title"
          >
            Referências de extrato
          </h2>

          <div className="extrato-banco-horas-screen__filtros">
            <FormField
              id="extrato-banco-horas-filtro-periodo"
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

            <FormField
              id="extrato-banco-horas-filtro-tipo"
              label="Tipo de movimento de referência"
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
                      ROTULO_TIPO_REFERENCIA_EXTRATO,
                    ) as TipoReferenciaExtrato[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_REFERENCIA_EXTRATO[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="extrato-banco-horas-filtro-situacao"
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
                    Object.keys(ROTULO_SITUACAO_EXTRATO) as SituacaoExtrato[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_EXTRATO[situacao]}
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
          <p className="extrato-banco-horas-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de extrato cadastrada"
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
              caption="Extrato de Banco de Horas (exemplo)"
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
          className="extrato-banco-horas-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="extrato-banco-horas-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="extrato-banco-horas-screen__detalhe-lista">
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
              <dt>Tipo de referência</dt>
              <dd>
                {ROTULO_TIPO_REFERENCIA_EXTRATO[detalheAberto.tipoReferencia]}
              </dd>
            </div>
            <div>
              <dt>Crédito ilustrativo</dt>
              <dd>{detalheAberto.creditoIlustrativo}</dd>
            </div>
            <div>
              <dt>Débito ilustrativo</dt>
              <dd>{detalheAberto.debitoIlustrativo}</dd>
            </div>
            <div>
              <dt>Saldo de referência</dt>
              <dd>{detalheAberto.saldoReferencia}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_EXTRATO[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="extrato-banco-horas-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="extrato-banco-horas-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="extrato-banco-horas-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="extrato-banco-horas-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, calcula, movimenta, compensa, quita, fecha, reabre, paga,
            desconta, salva, gera, exporta, importa nem integra extratos reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
