/**
 * Relatórios > Espelho de Ponto (T099) — tela visual estática.
 *
 * Demonstra referências técnicas de visualização de espelho por período,
 * situação e escopo técnico — sem criar, editar, marcar, ajustar, contestar,
 * aprovar, recusar, fechar, reabrir, assinar, gerar, exportar, salvar,
 * importar ou integrar espelho real. Tudo aqui é amostra sintética própria,
 * em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, marca, ajusta,
 * contesta, aprova, recusa, fecha, reabre, assina, gera, exporta, salva,
 * importa ou integra espelhos reais.
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
  type EspelhoPontoExemplo,
  ESPELHO_PONTO_EXEMPLO,
  ROTULO_SITUACAO_ESPELHO_PONTO,
  type SituacaoEspelhoPonto,
} from "./espelhoPonto.fixtures";
import "./EspelhoPontoScreen.css";

export const ESPELHO_PONTO_TITULO_ID = "espelho-ponto-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoEspelhoPonto, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function EspelhoPontoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : ESPELHO_PONTO_EXEMPLO),
    [estadoDemo],
  );

  const periodosDisponiveis = useMemo(() => {
    const unicos = new Set(
      ESPELHO_PONTO_EXEMPLO.map((linha) => linha.periodoIlustrativo),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      ESPELHO_PONTO_EXEMPLO.map((linha) => linha.escopoTecnico),
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
  }, [linhasBase, filtroPeriodo, filtroSituacao, filtroEscopo]);

  const filtrosAtivos =
    filtroPeriodo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroPeriodo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const tiposEvidencia = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      tiposEvidencia.add(linha.tipoEvidencia);
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
      totalTiposEvidencia: tiposEvidencia.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<EspelhoPontoExemplo>[] = [
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
      header: "Tipo de evidência",
      cell: (linha) => linha.tipoEvidencia,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_ESPELHO_PONTO[linha.situacao]}
        </StatusBadge>
      ),
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
    <div className="espelho-ponto-screen">
      <PageHeader
        headingLevel={1}
        titleId={ESPELHO_PONTO_TITULO_ID}
        title="Espelho de Ponto"
        description="Demonstração visual de referências técnicas de visualização de espelho por período, situação e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="espelho-ponto-screen__aviso"
        aria-labelledby="espelho-ponto-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="espelho-ponto-aviso-rh-titulo"
          className="espelho-ponto-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="espelho-ponto-screen__aviso"
        aria-labelledby="espelho-ponto-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="espelho-ponto-aviso-demo-titulo"
          className="espelho-ponto-screen__aviso-texto"
        >
          Não há login, API, persistência, geração, assinatura, exportação,
          ajuste, contestação, fechamento ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="espelho-ponto-screen__aviso espelho-ponto-screen__aviso--indisponivel"
        aria-labelledby="espelho-ponto-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Visualização não é espelho oficial
        </StatusBadge>
        <p
          id="espelho-ponto-aviso-referencia-titulo"
          className="espelho-ponto-screen__aviso-texto"
        >
          Estas referências não alteram marcação original, ponto, vínculo,
          jornada, Banco de Horas, remuneração, benefícios, documentos,
          permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="espelho-ponto-screen__aviso espelho-ponto-screen__aviso--indisponivel"
        aria-labelledby="espelho-ponto-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="espelho-ponto-aviso-dados-titulo"
          className="espelho-ponto-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="espelho-ponto-resumo-titulo"
        className="espelho-ponto-screen__resumo"
      >
        <h2
          id="espelho-ponto-resumo-titulo"
          className="espelho-ponto-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="espelho-ponto-screen__resumo-lista">
          <li className="espelho-ponto-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="espelho-ponto-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="espelho-ponto-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="espelho-ponto-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="espelho-ponto-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Tipos de evidência</StatusBadge>
              <p className="espelho-ponto-screen__resumo-item-texto">
                {resumo.totalTiposEvidencia} tipo(s) de evidência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="espelho-ponto-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="espelho-ponto-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="espelho-ponto-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="espelho-ponto-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="espelho-ponto-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="espelho-ponto-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="espelho-ponto-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="espelho-ponto-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="espelho-ponto-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="espelho-ponto-screen__nota">
          Não há cálculo de horas, extras, faltas, DSR, saldo, pagamento,
          desconto, compensação ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="espelho-ponto-demo-titulo"
        className="espelho-ponto-screen__demo"
      >
        <h2
          id="espelho-ponto-demo-titulo"
          className="espelho-ponto-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="espelho-ponto-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do espelho"
          className="espelho-ponto-screen__demo-botoes"
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
          className="espelho-ponto-screen__erro"
          aria-labelledby="espelho-ponto-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="espelho-ponto-erro-titulo"
            className="espelho-ponto-screen__section-title"
          >
            Não foi possível carregar as referências de espelho
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="espelho-ponto-screen__erro-referencia">
            Referência: <code>REQ-DEMO-019341</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="espelho-ponto-lista-titulo">
          <h2
            id="espelho-ponto-lista-titulo"
            className="espelho-ponto-screen__section-title"
          >
            Referências de espelho
          </h2>

          <div className="espelho-ponto-screen__filtros">
            <FormField
              id="espelho-ponto-filtro-periodo"
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

            <FormField id="espelho-ponto-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_ESPELHO_PONTO,
                    ) as SituacaoEspelhoPonto[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_ESPELHO_PONTO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="espelho-ponto-filtro-escopo" label="Escopo técnico">
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
          <p className="espelho-ponto-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de espelho cadastrada"
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
              caption="Espelho de Ponto (exemplo)"
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
          className="espelho-ponto-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="espelho-ponto-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="espelho-ponto-screen__detalhe-lista">
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
              <dt>Tipo de evidência</dt>
              <dd>{detalheAberto.tipoEvidencia}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_ESPELHO_PONTO[detalheAberto.situacao]}</dd>
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
              <dt>Responsável técnico</dt>
              <dd>{detalheAberto.responsavelTecnico}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="espelho-ponto-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="espelho-ponto-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="espelho-ponto-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="espelho-ponto-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, marca, ajusta, contesta, aprova, recusa, fecha, reabre,
            assina, gera, exporta, salva, importa nem integra espelhos reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
