/**
 * Cadastros > Motivos de desligamento (T085) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências de catálogo de motivo de
 * desligamento por categoria e escopo organizacional técnico — sem alterar
 * vínculo, acesso, jornada, ponto, documentos, Banco de Horas, pagamento,
 * desconto, evento de Folha ou obrigação. Tudo aqui é amostra sintética
 * própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, ativa, aprova,
 * salva, desliga, bloqueia acesso, calcula verbas, gera evento, envia à
 * Folha, importa ou exporta.
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
  type MotivoDesligamentoExemplo,
  MOTIVOS_DESLIGAMENTO_EXEMPLO,
  ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO,
  type SituacaoMotivoDesligamento,
} from "./motivosDesligamento.fixtures";
import "./MotivosDesligamentoScreen.css";

export const MOTIVOS_DESLIGAMENTO_TITULO_ID = "motivos-desligamento-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoMotivoDesligamento, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function MotivosDesligamentoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : MOTIVOS_DESLIGAMENTO_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      MOTIVOS_DESLIGAMENTO_EXEMPLO.map((linha) => linha.categoriaReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      MOTIVOS_DESLIGAMENTO_EXEMPLO.map(
        (linha) => linha.escopoOrganizacionalTecnico,
      ),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroCategoria !== OPCAO_TODOS &&
        linha.categoriaReferencia !== filtroCategoria
      ) {
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
  }, [linhasBase, filtroCategoria, filtroSituacao, filtroEscopo]);

  const filtrosAtivos =
    filtroCategoria !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroCategoria(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const categoriasReferencia = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categoriasReferencia.add(linha.categoriaReferencia);
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
      totalMotivos: linhasBase.length,
      totalCategorias: categoriasReferencia.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<MotivoDesligamentoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "codigo",
      header: "Código ilustrativo",
      cell: (linha) => linha.codigoIlustrativo,
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (linha) => linha.motivo,
    },
    {
      key: "categoria",
      header: "Categoria de referência",
      cell: (linha) => linha.categoriaReferencia,
    },
    {
      key: "escopo",
      header: "Escopo organizacional técnico",
      cell: (linha) => linha.escopoOrganizacionalTecnico,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO[linha.situacao]}
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
    <div className="motivos-desligamento-screen">
      <PageHeader
        headingLevel={1}
        titleId={MOTIVOS_DESLIGAMENTO_TITULO_ID}
        title="Motivos de desligamento"
        description="Demonstração visual de como o RH poderá consultar referências de catálogo de motivo de desligamento por categoria e escopo organizacional técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="motivos-desligamento-screen__aviso"
        aria-labelledby="motivos-desligamento-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="motivos-desligamento-aviso-rh-titulo"
          className="motivos-desligamento-screen__aviso-texto"
        >
          O catálogo é limitado à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-desligamento-screen__aviso"
        aria-labelledby="motivos-desligamento-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="motivos-desligamento-aviso-demo-titulo"
          className="motivos-desligamento-screen__aviso-texto"
        >
          Não há login, API, persistência, cálculo, integração, alteração
          cadastral ou desligamento real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-desligamento-screen__aviso motivos-desligamento-screen__aviso--indisponivel"
        aria-labelledby="motivos-desligamento-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Referência não é desligamento
        </StatusBadge>
        <p
          id="motivos-desligamento-aviso-referencia-titulo"
          className="motivos-desligamento-screen__aviso-texto"
        >
          O motivo é apenas catálogo; não altera vínculo, acesso, jornada,
          ponto, documentos, Banco de Horas, pagamento, desconto, evento de
          Folha ou obrigação.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="motivos-desligamento-screen__aviso motivos-desligamento-screen__aviso--indisponivel"
        aria-labelledby="motivos-desligamento-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="motivos-desligamento-aviso-dados-titulo"
          className="motivos-desligamento-screen__aviso-texto"
        >
          Qualquer operação real exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade, Folha/DP e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="motivos-desligamento-resumo-titulo"
        className="motivos-desligamento-screen__resumo"
      >
        <h2
          id="motivos-desligamento-resumo-titulo"
          className="motivos-desligamento-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="motivos-desligamento-screen__resumo-lista">
          <li className="motivos-desligamento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-desligamento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Motivos de referência</StatusBadge>
              <p className="motivos-desligamento-screen__resumo-item-texto">
                {resumo.totalMotivos} motivo(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-desligamento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-desligamento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias</StatusBadge>
              <p className="motivos-desligamento-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-desligamento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-desligamento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="motivos-desligamento-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-desligamento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-desligamento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="motivos-desligamento-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="motivos-desligamento-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="motivos-desligamento-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="motivos-desligamento-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) ilustrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="motivos-desligamento-screen__nota">
          Estes indicadores não desligam colaborador, não bloqueiam acesso, não
          calculam verbas, não alteram saldo, não enviam à Folha nem geram
          eventos.
        </p>
      </section>

      <section
        aria-labelledby="motivos-desligamento-demo-titulo"
        className="motivos-desligamento-screen__demo"
      >
        <h2
          id="motivos-desligamento-demo-titulo"
          className="motivos-desligamento-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="motivos-desligamento-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos motivos de desligamento"
          className="motivos-desligamento-screen__demo-botoes"
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
          className="motivos-desligamento-screen__erro"
          aria-labelledby="motivos-desligamento-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="motivos-desligamento-erro-titulo"
            className="motivos-desligamento-screen__section-title"
          >
            Não foi possível carregar as referências de motivo de desligamento
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="motivos-desligamento-screen__erro-referencia">
            Referência: <code>REQ-DEMO-005014</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="motivos-desligamento-lista-titulo">
          <h2
            id="motivos-desligamento-lista-titulo"
            className="motivos-desligamento-screen__section-title"
          >
            Referências de motivo de desligamento
          </h2>

          <div className="motivos-desligamento-screen__filtros">
            <FormField
              id="motivos-desligamento-filtro-categoria"
              label="Categoria de referência"
            >
              {(control) => (
                <select
                  value={filtroCategoria}
                  onChange={(evento) => setFiltroCategoria(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as categorias</option>
                  {categoriasDisponiveis.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="motivos-desligamento-filtro-situacao"
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
                      ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO,
                    ) as SituacaoMotivoDesligamento[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="motivos-desligamento-filtro-escopo"
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
          <p className="motivos-desligamento-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de motivo de desligamento cadastrada"
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
              caption="Motivos de desligamento (exemplo)"
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
          className="motivos-desligamento-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="motivos-desligamento-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="motivos-desligamento-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Código ilustrativo</dt>
              <dd>{detalheAberto.codigoIlustrativo}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{detalheAberto.motivo}</dd>
            </div>
            <div>
              <dt>Categoria de referência</dt>
              <dd>{detalheAberto.categoriaReferencia}</dd>
            </div>
            <div>
              <dt>Escopo organizacional técnico</dt>
              <dd>{detalheAberto.escopoOrganizacionalTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_MOTIVO_DESLIGAMENTO[detalheAberto.situacao]}
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

          <h3 className="motivos-desligamento-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="motivos-desligamento-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="motivos-desligamento-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="motivos-desligamento-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, ativa, aprova, salva, desliga, bloqueia acesso, calcula
            verbas, gera evento, envia à Folha, importa ou exporta.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
