/**
 * Cadastros > Motivos de ausência e justificativas (T081) — tela visual
 * estática.
 *
 * Demonstra como o RH poderá consultar referências de motivo de ausência e
 * justificativa por escopo organizacional técnico — sem efetivar abono,
 * ajuste, lançamento ou alteração de ponto. Tudo aqui é amostra sintética
 * própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, aprova,
 * recusa, reconhece, abona, salva, importa, exporta, envia ou anexa
 * documento, nem altera registro real. Sem dado médico, CID, diagnóstico,
 * atestado ou documento real em nenhum lugar desta tela.
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
  MOTIVOS_AUSENCIA_JUSTIFICATIVAS_EXEMPLO,
  type MotivoJustificativaExemplo,
  ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA,
  ROTULO_TIPO_REFERENCIA,
  type SituacaoMotivoJustificativa,
  type TipoReferenciaMotivoJustificativa,
} from "./motivosAusenciaJustificativas.fixtures";
import "./MotivosAusenciaJustificativasScreen.css";

export const MOTIVOS_AUSENCIA_JUSTIFICATIVAS_TITULO_ID =
  "motivos-ausencia-justificativas-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoMotivoJustificativa, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

const EVIDENCIA_PENDENTE = "Evidência ilustrativa pendente (exemplo)";

export function MotivosAusenciaJustificativasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () =>
      estadoDemo === "vazio" ? [] : MOTIVOS_AUSENCIA_JUSTIFICATIVAS_EXEMPLO,
    [estadoDemo],
  );

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      MOTIVOS_AUSENCIA_JUSTIFICATIVAS_EXEMPLO.map(
        (linha) => linha.escopoOrganizacionalTecnico,
      ),
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
        linha.escopoOrganizacionalTecnico !== filtroEscopo
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
    let totalMotivos = 0;
    let totalJustificativas = 0;
    let totalAguardandoDecisao = 0;
    let totalEvidenciaPendente = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      if (linha.tipoReferencia === "motivo_ausencia") {
        totalMotivos += 1;
      } else {
        totalJustificativas += 1;
      }
      if (linha.situacao === "aguardando_decisao_exemplo") {
        totalAguardandoDecisao += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
      if (linha.exigenciaEvidencia === EVIDENCIA_PENDENTE) {
        totalEvidenciaPendente += 1;
      }
    }
    return {
      totalMotivos,
      totalJustificativas,
      totalAguardandoDecisao,
      totalEvidenciaPendente,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<MotivoJustificativaExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "tipo",
      header: "Tipo de referência",
      cell: (linha) => ROTULO_TIPO_REFERENCIA[linha.tipoReferencia],
    },
    {
      key: "motivoJustificativa",
      header: "Motivo/justificativa",
      cell: (linha) => linha.motivoJustificativa,
    },
    {
      key: "escopo",
      header: "Escopo organizacional técnico",
      cell: (linha) => linha.escopoOrganizacionalTecnico,
    },
    {
      key: "evidencia",
      header: "Exigência de evidência",
      cell: (linha) => linha.exigenciaEvidencia,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA[linha.situacao]}
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
    <div className="motivos-ausencia-justificativas-screen">
      <PageHeader
        headingLevel={1}
        titleId={MOTIVOS_AUSENCIA_JUSTIFICATIVAS_TITULO_ID}
        title="Motivos de ausência e justificativas"
        description="Demonstração visual de como o RH poderá consultar referências de motivo de ausência e justificativa por escopo organizacional técnico — sem efetivar abono, ajuste, lançamento ou alteração de ponto."
      />

      <Surface
        as="section"
        padding="md"
        className="motivos-ausencia-justificativas-screen__aviso"
        aria-labelledby="motivos-ausencia-justificativas-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="motivos-ausencia-justificativas-aviso-rh-titulo"
          className="motivos-ausencia-justificativas-screen__aviso-texto"
        >
          O RH consulta somente referências de motivo e justificativa da própria
          empresa e das unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-ausencia-justificativas-screen__aviso"
        aria-labelledby="motivos-ausencia-justificativas-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="motivos-ausencia-justificativas-aviso-demo-titulo"
          className="motivos-ausencia-justificativas-screen__aviso-texto"
        >
          Não há login, API, persistência, importação, exportação, cálculo,
          integração, alteração de ponto ou lançamento real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-ausencia-justificativas-screen__aviso motivos-ausencia-justificativas-screen__aviso--indisponivel"
        aria-labelledby="motivos-ausencia-justificativas-aviso-decisao-titulo"
      >
        <StatusBadge variant="warning">Referência não é decisão</StatusBadge>
        <p
          id="motivos-ausencia-justificativas-aviso-decisao-titulo"
          className="motivos-ausencia-justificativas-screen__aviso-texto"
        >
          Motivo, justificativa e documento são referências distintas; sua
          existência não concede abono, não aprova ausência e não altera
          marcação, jornada, saldo, Banco de Horas ou Folha.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-ausencia-justificativas-screen__aviso motivos-ausencia-justificativas-screen__aviso--indisponivel"
        aria-labelledby="motivos-ausencia-justificativas-aviso-saude-titulo"
      >
        <StatusBadge variant="warning">Saúde e privacidade</StatusBadge>
        <p
          id="motivos-ausencia-justificativas-aviso-saude-titulo"
          className="motivos-ausencia-justificativas-screen__aviso-texto"
        >
          Dados médicos e documentos sensíveis não são exibidos nesta tela;
          qualquer dado real depende de acesso restrito, MFA, o gate-mestre de
          segurança operacional (<code>DS-OPS-01</code>), auditoria,
          retenção/base legal e validações aplicáveis de RH,
          Jurídico/privacidade e saúde ocupacional.
        </p>
      </Surface>

      <section
        aria-labelledby="motivos-ausencia-justificativas-resumo-titulo"
        className="motivos-ausencia-justificativas-screen__resumo"
      >
        <h2
          id="motivos-ausencia-justificativas-resumo-titulo"
          className="motivos-ausencia-justificativas-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="motivos-ausencia-justificativas-screen__resumo-lista">
          <li className="motivos-ausencia-justificativas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-ausencia-justificativas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Motivos de referência</StatusBadge>
              <p className="motivos-ausencia-justificativas-screen__resumo-item-texto">
                {resumo.totalMotivos} motivo(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-ausencia-justificativas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-ausencia-justificativas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">
                Justificativas de referência
              </StatusBadge>
              <p className="motivos-ausencia-justificativas-screen__resumo-item-texto">
                {resumo.totalJustificativas} justificativa(s) de referência
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-ausencia-justificativas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-ausencia-justificativas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Exigem decisão formal</StatusBadge>
              <p className="motivos-ausencia-justificativas-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) exigindo decisão formal
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-ausencia-justificativas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-ausencia-justificativas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Evidência pendente</StatusBadge>
              <p className="motivos-ausencia-justificativas-screen__resumo-item-texto">
                {resumo.totalEvidenciaPendente} referência(s) com evidência
                pendente (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-ausencia-justificativas-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-ausencia-justificativas-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="motivos-ausencia-justificativas-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) demonstrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="motivos-ausencia-justificativas-screen__nota">
          Estes indicadores não reconhecem ausência, não concedem abono, não
          aprovam documento, não ajustam ponto e não geram pagamento, desconto,
          DSR, compensação, Banco de Horas ou lançamento na Folha.
        </p>
      </section>

      <section
        aria-labelledby="motivos-ausencia-justificativas-demo-titulo"
        className="motivos-ausencia-justificativas-screen__demo"
      >
        <h2
          id="motivos-ausencia-justificativas-demo-titulo"
          className="motivos-ausencia-justificativas-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="motivos-ausencia-justificativas-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das referências"
          className="motivos-ausencia-justificativas-screen__demo-botoes"
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
          className="motivos-ausencia-justificativas-screen__erro"
          aria-labelledby="motivos-ausencia-justificativas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="motivos-ausencia-justificativas-erro-titulo"
            className="motivos-ausencia-justificativas-screen__section-title"
          >
            Não foi possível carregar as referências de motivo e justificativa
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="motivos-ausencia-justificativas-screen__erro-referencia">
            Referência: <code>REQ-DEMO-002014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="motivos-ausencia-justificativas-lista-titulo">
          <h2
            id="motivos-ausencia-justificativas-lista-titulo"
            className="motivos-ausencia-justificativas-screen__section-title"
          >
            Referências de motivo e justificativa
          </h2>

          <div className="motivos-ausencia-justificativas-screen__filtros">
            <FormField
              id="motivos-ausencia-justificativas-filtro-tipo"
              label="Tipo de referência"
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
                      ROTULO_TIPO_REFERENCIA,
                    ) as TipoReferenciaMotivoJustificativa[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_REFERENCIA[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="motivos-ausencia-justificativas-filtro-situacao"
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
                      ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA,
                    ) as SituacaoMotivoJustificativa[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="motivos-ausencia-justificativas-filtro-escopo"
              label="Escopo organizacional técnico"
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
          <p className="motivos-ausencia-justificativas-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de motivo ou justificativa cadastrada"
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
              caption="Motivos de ausência e justificativas (exemplo)"
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
          className="motivos-ausencia-justificativas-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="motivos-ausencia-justificativas-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="motivos-ausencia-justificativas-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Tipo de referência</dt>
              <dd>{ROTULO_TIPO_REFERENCIA[detalheAberto.tipoReferencia]}</dd>
            </div>
            <div>
              <dt>Motivo/justificativa</dt>
              <dd>{detalheAberto.motivoJustificativa}</dd>
            </div>
            <div>
              <dt>Escopo organizacional técnico</dt>
              <dd>{detalheAberto.escopoOrganizacionalTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_MOTIVO_JUSTIFICATIVA[detalheAberto.situacao]}
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

          <h3 className="motivos-ausencia-justificativas-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="motivos-ausencia-justificativas-screen__detalhe-subtitulo">
            Evidência ilustrativa (exemplo)
          </h3>
          <p>{detalheAberto.evidenciaIlustrativa}</p>

          <h3 className="motivos-ausencia-justificativas-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="motivos-ausencia-justificativas-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="motivos-ausencia-justificativas-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, aprova, recusa, reconhece, abona, salva, importa, exporta,
            envia, anexa documento nem altera registros reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
