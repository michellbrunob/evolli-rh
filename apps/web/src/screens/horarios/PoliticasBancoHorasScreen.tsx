/**
 * Cadastros > Políticas de Banco de Horas (T078) — tela visual estática.
 *
 * Demonstra como políticas futuras de Banco de Horas poderão ser
 * versionadas por empresa/unidade e vigência — sem ativar regra, calcular
 * saldo ou alterar período fechado. Tudo aqui é amostra sintética própria,
 * em memória; nenhuma linha representa uma política "ativa", "aprovada" ou
 * operacional.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, aprova,
 * ativa, salva, importa, exporta ou aplica política. Sem número, prazo,
 * limite, fórmula ou cálculo de Banco de Horas.
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
  formatarVigenciaIlustrativa,
  POLITICAS_BANCO_HORAS_EXEMPLO,
  type PoliticaBancoHorasExemplo,
  ROTULO_SITUACAO_POLITICA,
  type SituacaoPoliticaBancoHoras,
} from "./politicasBancoHoras.fixtures";
import "./PoliticasBancoHorasScreen.css";

export const POLITICAS_BANCO_HORAS_TITULO_ID = "politicas-banco-horas-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoPoliticaBancoHoras, StatusVariant> = {
  rascunho: "neutral",
  aguardando_validacao: "warning",
  versao_historica_exemplo: "info",
};

const OPCAO_TODOS = "todos";

const GRUPOS_EM_DEFINICAO: readonly string[] = [
  "Expiração/validade",
  "Ordem de consumo",
  "Saldo negativo",
  "Alertas",
  "Compensação",
  "Quitação",
  "Folha",
];

export function PoliticasBancoHorasScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroUnidade, setFiltroUnidade] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : POLITICAS_BANCO_HORAS_EXEMPLO),
    [estadoDemo],
  );

  const unidadesDisponiveis = useMemo(() => {
    const unicas = new Set(
      POLITICAS_BANCO_HORAS_EXEMPLO.map((linha) => linha.empresaUnidadeTecnica),
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

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<PoliticaBancoHorasExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "unidade",
      header: "Empresa/unidade técnica",
      cell: (linha) => linha.empresaUnidadeTecnica,
    },
    {
      key: "versao",
      header: "Versão",
      cell: (linha) => linha.versao,
    },
    {
      key: "vigencia",
      header: "Vigência ilustrativa",
      cell: (linha) => formatarVigenciaIlustrativa(linha),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_POLITICA[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
    {
      key: "gate",
      header: "Decisão/gate pendente",
      cell: (linha) => linha.decisaoGatePendente,
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
    <div className="politicas-banco-horas-screen">
      <PageHeader
        headingLevel={1}
        titleId={POLITICAS_BANCO_HORAS_TITULO_ID}
        title="Políticas de Banco de Horas"
        description="Demonstração visual de como políticas futuras de Banco de Horas poderão ser versionadas por empresa/unidade e vigência — sem ativar regra, calcular saldo ou alterar período fechado."
      />

      <Surface
        as="section"
        padding="md"
        className="politicas-banco-horas-screen__aviso"
        aria-labelledby="politicas-banco-horas-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="politicas-banco-horas-aviso-rh-titulo"
          className="politicas-banco-horas-screen__aviso-texto"
        >
          O RH administra somente referências de política da própria empresa e
          das unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="politicas-banco-horas-screen__aviso"
        aria-labelledby="politicas-banco-horas-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="politicas-banco-horas-aviso-demo-titulo"
          className="politicas-banco-horas-screen__aviso-texto"
        >
          Esta é uma demonstração visual, sem política real, API, persistência,
          cálculo ou efeito operacional.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="politicas-banco-horas-screen__aviso politicas-banco-horas-screen__aviso--indisponivel"
        aria-labelledby="politicas-banco-horas-aviso-gates-titulo"
      >
        <StatusBadge variant="warning">
          Compensação/quitação/Folha bloqueadas
        </StatusBadge>
        <p
          id="politicas-banco-horas-aviso-gates-titulo"
          className="politicas-banco-horas-screen__aviso-texto"
        >
          Compensação, quitação e Folha continuam bloqueadas pelas
          decisões/gates existentes.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="politicas-banco-horas-screen__aviso politicas-banco-horas-screen__aviso--indisponivel"
        aria-labelledby="politicas-banco-horas-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dado real bloqueado</StatusBadge>
        <p
          id="politicas-banco-horas-aviso-bloqueio-titulo"
          className="politicas-banco-horas-screen__aviso-texto"
        >
          Dado real depende de MFA, do gate-mestre de segurança operacional (
          <code>DS-OPS-01</code>), auditoria, retenção/base legal e validações
          RH, Jurídico e Folha aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="politicas-banco-horas-principios-titulo"
        className="politicas-banco-horas-screen__principios"
      >
        <h2
          id="politicas-banco-horas-principios-titulo"
          className="politicas-banco-horas-screen__section-title"
        >
          Princípios (apenas informativo)
        </h2>
        <ul className="politicas-banco-horas-screen__principios-lista">
          <li>
            Política futura possui escopo, versão, vigência, responsável e
            auditoria.
          </li>
          <li>
            Mudança futura não recalcula, substitui nem altera períodos
            fechados.
          </li>
          <li>Crédito e débito continuam separados, e saldo é derivado.</li>
          <li>Proposta aprovada não cria débito efetivo automático.</li>
          <li>Ponto não calcula salário, DSR, pagamento ou desconto.</li>
        </ul>
      </section>

      <section
        aria-labelledby="politicas-banco-horas-demo-titulo"
        className="politicas-banco-horas-screen__demo"
      >
        <h2
          id="politicas-banco-horas-demo-titulo"
          className="politicas-banco-horas-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="politicas-banco-horas-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das políticas"
          className="politicas-banco-horas-screen__demo-botoes"
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
          className="politicas-banco-horas-screen__erro"
          aria-labelledby="politicas-banco-horas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="politicas-banco-horas-erro-titulo"
            className="politicas-banco-horas-screen__section-title"
          >
            Não foi possível carregar as políticas de Banco de Horas
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="politicas-banco-horas-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001739</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="politicas-banco-horas-lista-titulo">
          <h2
            id="politicas-banco-horas-lista-titulo"
            className="politicas-banco-horas-screen__section-title"
          >
            Versões de política
          </h2>

          <div className="politicas-banco-horas-screen__filtros">
            <FormField
              id="politicas-banco-horas-filtro-situacao"
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
                      ROTULO_SITUACAO_POLITICA,
                    ) as SituacaoPoliticaBancoHoras[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_POLITICA[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="politicas-banco-horas-filtro-unidade"
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
          <p className="politicas-banco-horas-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma versão de política cadastrada"
              description="Quando houver uma versão de política desta empresa, ela aparece aqui (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma versão corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais versões desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Políticas de Banco de Horas (exemplo)"
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
          className="politicas-banco-horas-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="politicas-banco-horas-screen__section-title"
          >
            Detalhe da versão — {detalheAberto.id}
          </h2>
          <dl className="politicas-banco-horas-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Empresa/unidade técnica</dt>
              <dd>{detalheAberto.empresaUnidadeTecnica}</dd>
            </div>
            <div>
              <dt>Versão</dt>
              <dd>{detalheAberto.versao}</dd>
            </div>
            <div>
              <dt>Vigência ilustrativa</dt>
              <dd>{formatarVigenciaIlustrativa(detalheAberto)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_POLITICA[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Responsável técnico</dt>
              <dd>{detalheAberto.responsavelTecnico}</dd>
            </div>
            <div>
              <dt>Decisão/gate pendente</dt>
              <dd>{detalheAberto.decisaoGatePendente}</dd>
            </div>
            <div>
              <dt>Trilha de auditoria</dt>
              <dd>{detalheAberto.trilhaAuditoria}</dd>
            </div>
          </dl>

          <h3 className="politicas-banco-horas-screen__detalhe-subtitulo">
            Grupos de parâmetros (em definição)
          </h3>
          <ul className="politicas-banco-horas-screen__parametros-lista">
            {GRUPOS_EM_DEFINICAO.map((grupo) => (
              <li key={grupo}>
                <StatusBadge variant="neutral">Em definição</StatusBadge>
                <span>
                  {grupo}: pendente de decisão formal — sem número, prazo,
                  limite ou fórmula nesta demonstração.
                </span>
              </li>
            ))}
          </ul>

          <p className="politicas-banco-horas-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> abrir este detalhe não
            cria, edita, aprova, ativa, salva nem aplica nenhuma política real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
