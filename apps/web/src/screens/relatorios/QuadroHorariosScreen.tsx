/**
 * Relatórios > Quadro de Horários (T101) — tela visual estática.
 *
 * Demonstra referências técnicas de jornada e horário por tipo de
 * referência e escopo técnico — sem criar, editar, atribuir, ativar,
 * desativar, calcular, marcar, ajustar, compensar, fechar, reabrir, salvar,
 * gerar, exportar, importar ou integrar horário real. Tudo aqui é amostra
 * sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, atribui,
 * ativa, desativa, calcula, marca, ajusta, compensa, fecha, reabre, salva,
 * gera, exporta, importa ou integra horários reais.
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
  type QuadroHorarioExemplo,
  QUADRO_HORARIOS_EXEMPLO,
  ROTULO_SITUACAO_QUADRO_HORARIOS,
  type SituacaoQuadroHorarios,
} from "./quadroHorarios.fixtures";
import "./QuadroHorariosScreen.css";

export const QUADRO_HORARIOS_TITULO_ID = "quadro-horarios-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoQuadroHorarios, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function QuadroHorariosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : QUADRO_HORARIOS_EXEMPLO),
    [estadoDemo],
  );

  const tiposDisponiveis = useMemo(() => {
    const unicos = new Set(
      QUADRO_HORARIOS_EXEMPLO.map((linha) => linha.tipoReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      QUADRO_HORARIOS_EXEMPLO.map((linha) => linha.escopoTecnico),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroTipo !== OPCAO_TODOS && linha.tipoReferencia !== filtroTipo) {
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
    const jornadas = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      jornadas.add(linha.jornadaIlustrativa);
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
      totalJornadas: jornadas.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<QuadroHorarioExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "jornada",
      header: "Jornada ilustrativa",
      cell: (linha) => linha.jornadaIlustrativa,
    },
    {
      key: "tipo",
      header: "Tipo de referência",
      cell: (linha) => linha.tipoReferencia,
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
          {ROTULO_SITUACAO_QUADRO_HORARIOS[linha.situacao]}
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
    <div className="quadro-horarios-screen">
      <PageHeader
        headingLevel={1}
        titleId={QUADRO_HORARIOS_TITULO_ID}
        title="Quadro de Horários"
        description="Demonstração visual de referências técnicas de jornada e horário por tipo de referência e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="quadro-horarios-screen__aviso"
        aria-labelledby="quadro-horarios-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="quadro-horarios-aviso-rh-titulo"
          className="quadro-horarios-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="quadro-horarios-screen__aviso"
        aria-labelledby="quadro-horarios-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="quadro-horarios-aviso-demo-titulo"
          className="quadro-horarios-screen__aviso-texto"
        >
          Não há login, API, persistência, criação, atribuição, ativação,
          cálculo, marcação, ajuste, compensação, fechamento, geração ou Folha
          nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="quadro-horarios-screen__aviso quadro-horarios-screen__aviso--indisponivel"
        aria-labelledby="quadro-horarios-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Quadro não é jornada aplicada
        </StatusBadge>
        <p
          id="quadro-horarios-aviso-referencia-titulo"
          className="quadro-horarios-screen__aviso-texto"
        >
          Estas referências não alteram colaborador, vínculo, ponto, marcação
          original, Banco de Horas, remuneração, benefícios, documentos,
          permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="quadro-horarios-screen__aviso quadro-horarios-screen__aviso--indisponivel"
        aria-labelledby="quadro-horarios-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="quadro-horarios-aviso-dados-titulo"
          className="quadro-horarios-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="quadro-horarios-resumo-titulo"
        className="quadro-horarios-screen__resumo"
      >
        <h2
          id="quadro-horarios-resumo-titulo"
          className="quadro-horarios-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="quadro-horarios-screen__resumo-lista">
          <li className="quadro-horarios-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="quadro-horarios-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="quadro-horarios-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="quadro-horarios-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="quadro-horarios-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Jornadas ilustrativas</StatusBadge>
              <p className="quadro-horarios-screen__resumo-item-texto">
                {resumo.totalJornadas} jornada(s) ilustrativa(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="quadro-horarios-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="quadro-horarios-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="quadro-horarios-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="quadro-horarios-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="quadro-horarios-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="quadro-horarios-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="quadro-horarios-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="quadro-horarios-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="quadro-horarios-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="quadro-horarios-screen__nota">
          Não há cálculo de horas, extras, faltas, DSR, saldo, pagamento,
          desconto, compensação ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="quadro-horarios-demo-titulo"
        className="quadro-horarios-screen__demo"
      >
        <h2
          id="quadro-horarios-demo-titulo"
          className="quadro-horarios-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="quadro-horarios-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração do quadro de horários"
          className="quadro-horarios-screen__demo-botoes"
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
          className="quadro-horarios-screen__erro"
          aria-labelledby="quadro-horarios-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="quadro-horarios-erro-titulo"
            className="quadro-horarios-screen__section-title"
          >
            Não foi possível carregar as referências do quadro de horários
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="quadro-horarios-screen__erro-referencia">
            Referência: <code>REQ-DEMO-021567</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="quadro-horarios-lista-titulo">
          <h2
            id="quadro-horarios-lista-titulo"
            className="quadro-horarios-screen__section-title"
          >
            Referências do quadro de horários
          </h2>

          <div className="quadro-horarios-screen__filtros">
            <FormField id="quadro-horarios-filtro-tipo" label="Tipo de jornada">
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

            <FormField id="quadro-horarios-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_QUADRO_HORARIOS,
                    ) as SituacaoQuadroHorarios[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_QUADRO_HORARIOS[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="quadro-horarios-filtro-escopo"
              label="Escopo técnico"
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
          <p className="quadro-horarios-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de jornada ou horário cadastrada"
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
              caption="Quadro de Horários (exemplo)"
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
          className="quadro-horarios-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="quadro-horarios-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="quadro-horarios-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Jornada ilustrativa</dt>
              <dd>{detalheAberto.jornadaIlustrativa}</dd>
            </div>
            <div>
              <dt>Tipo de referência</dt>
              <dd>{detalheAberto.tipoReferencia}</dd>
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
              <dd>{ROTULO_SITUACAO_QUADRO_HORARIOS[detalheAberto.situacao]}</dd>
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

          <h3 className="quadro-horarios-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="quadro-horarios-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="quadro-horarios-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="quadro-horarios-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, atribui, ativa, desativa, calcula, marca, ajusta, compensa,
            fecha, reabre, salva, gera, exporta, importa nem integra horários
            reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
