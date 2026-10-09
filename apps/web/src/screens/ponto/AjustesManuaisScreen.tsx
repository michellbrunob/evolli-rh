/**
 * Ponto > Ajustes manuais (T077) — tela visual estática.
 *
 * Demonstra como o RH poderá revisar solicitações de ajuste de marcação sem
 * apagar a marcação original, sem persistir dados e sem executar qualquer
 * regra trabalhista. Tudo aqui é amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, salva, aprova, nega,
 * reabre ou aplica um ajuste. Não calcula jornada, saldo, Banco de Horas,
 * compensação, pagamento, DSR, desconto, Folha ou fechamento.
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
  AJUSTES_MANUAIS_EXEMPLO,
  type AjusteManualExemplo,
  ROTULO_SITUACAO_AJUSTE,
  ROTULO_TIPO_AJUSTE,
  ROTULO_VALIDACAO_GESTOR,
  type SituacaoAjuste,
  type TipoAjuste,
  type ValidacaoGestorAjuste,
} from "./ajustesManuais.fixtures";
import "./AjustesManuaisScreen.css";

export const AJUSTES_MANUAIS_TITULO_ID = "ajustes-manuais-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoAjuste, StatusVariant> = {
  solicitado: "info",
  em_revisao_rh: "info",
  aguardando_justificativa: "warning",
  registrado_como_aditivo: "success",
};

const VARIANTE_VALIDACAO_GESTOR: Record<ValidacaoGestorAjuste, StatusVariant> =
  {
    pendente: "neutral",
    recomendado: "success",
    nao_recomendado: "danger",
  };

const OPCAO_TODOS = "todos";

export function AjustesManuaisScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroValidacao, setFiltroValidacao] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : AJUSTES_MANUAIS_EXEMPLO),
    [estadoDemo],
  );

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroTipo !== OPCAO_TODOS && linha.tipoAjuste !== filtroTipo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroValidacao !== OPCAO_TODOS &&
        linha.validacaoGestor !== filtroValidacao
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroTipo, filtroSituacao, filtroValidacao]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroValidacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroValidacao(OPCAO_TODOS);
  }

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<AjusteManualExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "periodo",
      header: "Período/dia ilustrativo",
      cell: (linha) => formatarDiaCivil(linha.periodoIlustrativo),
    },
    {
      key: "vinculo",
      header: "Vínculo técnico",
      cell: (linha) => linha.vinculoTecnico,
    },
    {
      key: "tipo",
      header: "Tipo de ajuste",
      cell: (linha) => ROTULO_TIPO_AJUSTE[linha.tipoAjuste],
    },
    {
      key: "motivo",
      header: "Motivo codificado",
      cell: (linha) => <code>{linha.motivoCodificado}</code>,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_AJUSTE[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "validacaoGestor",
      header: "Validação do gestor",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_VALIDACAO_GESTOR[linha.validacaoGestor]}>
          {ROTULO_VALIDACAO_GESTOR[linha.validacaoGestor]}
        </StatusBadge>
      ),
    },
    {
      key: "trilha",
      header: "Trilha/auditoria",
      cell: (linha) => linha.trilhaResumo,
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
    <div className="ajustes-manuais-screen">
      <PageHeader
        headingLevel={1}
        titleId={AJUSTES_MANUAIS_TITULO_ID}
        title="Ajustes manuais"
        description="Demonstração visual de como o RH poderá revisar solicitações de ajuste de marcação — sem apagar a marcação original, sem persistir dados e sem executar qualquer regra trabalhista."
      />

      <Surface
        as="section"
        padding="md"
        className="ajustes-manuais-screen__aviso"
        aria-labelledby="ajustes-manuais-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="ajustes-manuais-aviso-rh-titulo"
          className="ajustes-manuais-screen__aviso-texto"
        >
          O RH revisa somente solicitações de ajuste da própria empresa.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="ajustes-manuais-screen__aviso"
        aria-labelledby="ajustes-manuais-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="ajustes-manuais-aviso-demo-titulo"
          className="ajustes-manuais-screen__aviso-texto"
        >
          Esta é uma demonstração visual: não há login real, API, persistência,
          alteração de ponto ou dado real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="ajustes-manuais-screen__aviso ajustes-manuais-screen__aviso--indisponivel"
        aria-labelledby="ajustes-manuais-aviso-impacto-titulo"
      >
        <StatusBadge variant="warning">Sem impacto financeiro</StatusBadge>
        <p
          id="ajustes-manuais-aviso-impacto-titulo"
          className="ajustes-manuais-screen__aviso-texto"
        >
          Ajustes não geram saldo, compensação, quitação, pagamento, desconto,
          Folha ou fechamento automaticamente.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="ajustes-manuais-screen__aviso ajustes-manuais-screen__aviso--indisponivel"
        aria-labelledby="ajustes-manuais-aviso-periodo-titulo"
      >
        <StatusBadge variant="warning">Período fechado</StatusBadge>
        <p
          id="ajustes-manuais-aviso-periodo-titulo"
          className="ajustes-manuais-screen__aviso-texto"
        >
          Períodos fechados exigirão fluxo específico de reabertura autorizada —
          esta demonstração não reabre nem recalcula período fechado.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="ajustes-manuais-screen__aviso ajustes-manuais-screen__aviso--indisponivel"
        aria-labelledby="ajustes-manuais-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dado real bloqueado</StatusBadge>
        <p
          id="ajustes-manuais-aviso-bloqueio-titulo"
          className="ajustes-manuais-screen__aviso-texto"
        >
          Dado real continua bloqueado por MFA, pelo gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          demais validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="ajustes-manuais-fluxo-titulo"
        className="ajustes-manuais-screen__fluxo"
      >
        <h2
          id="ajustes-manuais-fluxo-titulo"
          className="ajustes-manuais-screen__section-title"
        >
          Como funciona (fluxo apenas informativo)
        </h2>
        <ol className="ajustes-manuais-screen__fluxo-lista">
          <li>Solicitação</li>
          <li>Revisão do RH</li>
          <li>Validação/recomendação do gestor</li>
          <li>Registro aditivo autorizado</li>
        </ol>
        <p className="ajustes-manuais-screen__nota">
          O gestor valida ou recomenda o ajuste, mas não altera a marcação
          bruta. Qualquer operação real depende de fluxo autorizado e de regras
          ainda em validação — este fluxo é apenas ilustrativo.
        </p>
      </section>

      <section
        aria-labelledby="ajustes-manuais-demo-titulo"
        className="ajustes-manuais-screen__demo"
      >
        <h2
          id="ajustes-manuais-demo-titulo"
          className="ajustes-manuais-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="ajustes-manuais-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos ajustes"
          className="ajustes-manuais-screen__demo-botoes"
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
          className="ajustes-manuais-screen__erro"
          aria-labelledby="ajustes-manuais-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="ajustes-manuais-erro-titulo"
            className="ajustes-manuais-screen__section-title"
          >
            Não foi possível carregar os ajustes manuais
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="ajustes-manuais-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001482</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="ajustes-manuais-lista-titulo">
          <h2
            id="ajustes-manuais-lista-titulo"
            className="ajustes-manuais-screen__section-title"
          >
            Solicitações de ajuste
          </h2>

          <div className="ajustes-manuais-screen__filtros">
            <FormField id="ajustes-manuais-filtro-tipo" label="Tipo">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO_AJUSTE) as TipoAjuste[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_AJUSTE[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField id="ajustes-manuais-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(ROTULO_SITUACAO_AJUSTE) as SituacaoAjuste[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_AJUSTE[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="ajustes-manuais-filtro-validacao"
              label="Validação do gestor"
            >
              {(control) => (
                <select
                  value={filtroValidacao}
                  onChange={(evento) => setFiltroValidacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as validações</option>
                  {(
                    Object.keys(
                      ROTULO_VALIDACAO_GESTOR,
                    ) as ValidacaoGestorAjuste[]
                  ).map((validacao) => (
                    <option key={validacao} value={validacao}>
                      {ROTULO_VALIDACAO_GESTOR[validacao]}
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
          <p className="ajustes-manuais-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma solicitação de ajuste cadastrada"
              description="Quando houver uma solicitação de ajuste desta empresa, ela aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum ajuste corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais solicitações desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Ajustes manuais de marcação (exemplo)"
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
          className="ajustes-manuais-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="ajustes-manuais-screen__section-title"
          >
            Detalhe do ajuste — {ROTULO_TIPO_AJUSTE[detalheAberto.tipoAjuste]}
          </h2>
          <dl className="ajustes-manuais-screen__detalhe-lista">
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
              <dt>Período/dia ilustrativo</dt>
              <dd>{formatarDiaCivil(detalheAberto.periodoIlustrativo)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_AJUSTE[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Validação do gestor</dt>
              <dd>{ROTULO_VALIDACAO_GESTOR[detalheAberto.validacaoGestor]}</dd>
            </div>
            <div>
              <dt>Trilha/auditoria</dt>
              <dd>{detalheAberto.trilhaResumo}</dd>
            </div>
            <div>
              <dt>Marcação original (ilustrativa)</dt>
              <dd>{detalheAberto.horarioOriginalIlustrativo}</dd>
            </div>
            <div>
              <dt>Proposta de ajuste (ilustrativa)</dt>
              <dd>{detalheAberto.horarioPropostoIlustrativo}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{detalheAberto.descricaoSintetica}</dd>
            </div>
          </dl>
          <p className="ajustes-manuais-screen__detalhe-aviso">
            <strong>A marcação original não é apagada nem sobrescrita.</strong>{" "}
            Se este ajuste for aprovado futuramente, ele será registrado como um
            evento aditivo e auditável — nunca substitui a marcação original.
          </p>
          <p className="ajustes-manuais-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> abrir este detalhe não
            cria, salva, aprova, nega, reabre nem aplica nenhum ajuste real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
