/**
 * Relatórios > Listagem de Colaboradores (T103) — tela visual estática.
 *
 * Demonstra referências técnicas de vínculo por categoria, escopo técnico
 * e função de referência — sem criar, editar, identificar, admitir,
 * desligar, vincular, atribuir, aprovar, salvar, calcular, pagar, descontar,
 * gerar, exportar, importar ou integrar colaborador real. Tudo aqui é
 * amostra sintética própria, em memória — sem pessoa identificável, nome,
 * CPF, matrícula real, e-mail, telefone, endereço, data de nascimento,
 * documento, empresa ou unidade real.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, identifica,
 * admite, desliga, vincula, atribui, aprova, salva, calcula, paga, desconta,
 * gera, exporta, importa ou integra colaboradores reais.
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
  type RelatorioListagemColaboradorExemplo,
  RELATORIO_LISTAGEM_COLABORADORES_EXEMPLO,
  ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES,
  type SituacaoRelatorioListagemColaboradores,
} from "./relatorioListagemColaboradores.fixtures";
import "./RelatorioListagemColaboradoresScreen.css";

export const RELATORIO_LISTAGEM_COLABORADORES_TITULO_ID =
  "relatorio-listagem-colaboradores-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<
  SituacaoRelatorioListagemColaboradores,
  StatusVariant
> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function RelatorioListagemColaboradoresScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () =>
      estadoDemo === "vazio" ? [] : RELATORIO_LISTAGEM_COLABORADORES_EXEMPLO,
    [estadoDemo],
  );

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      RELATORIO_LISTAGEM_COLABORADORES_EXEMPLO.map(
        (linha) => linha.escopoTecnico,
      ),
    );
    return Array.from(unicos);
  }, []);

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      RELATORIO_LISTAGEM_COLABORADORES_EXEMPLO.map(
        (linha) => linha.categoriaVinculo,
      ),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.escopoTecnico !== filtroEscopo
      ) {
        return false;
      }
      if (
        filtroCategoria !== OPCAO_TODOS &&
        linha.categoriaVinculo !== filtroCategoria
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroSituacao, filtroEscopo, filtroCategoria]);

  const filtrosAtivos =
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS ||
    filtroCategoria !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
    setFiltroCategoria(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const categorias = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categorias.add(linha.categoriaVinculo);
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
      totalCategorias: categorias.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<RelatorioListagemColaboradorExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "vinculo",
      header: "Vínculo técnico ilustrativo",
      cell: (linha) => linha.vinculoTecnicoIlustrativo,
    },
    {
      key: "categoria",
      header: "Categoria de vínculo",
      cell: (linha) => linha.categoriaVinculo,
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
          {ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "funcao",
      header: "Função de referência",
      cell: (linha) => linha.funcaoReferencia,
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
    <div className="relatorio-listagem-colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={RELATORIO_LISTAGEM_COLABORADORES_TITULO_ID}
        title="Listagem de Colaboradores"
        description="Demonstração visual de referências técnicas de vínculo por categoria, escopo técnico e função de referência."
      />

      <Surface
        as="section"
        padding="md"
        className="relatorio-listagem-colaboradores-screen__aviso"
        aria-labelledby="relatorio-listagem-colaboradores-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="relatorio-listagem-colaboradores-aviso-rh-titulo"
          className="relatorio-listagem-colaboradores-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-listagem-colaboradores-screen__aviso"
        aria-labelledby="relatorio-listagem-colaboradores-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="relatorio-listagem-colaboradores-aviso-demo-titulo"
          className="relatorio-listagem-colaboradores-screen__aviso-texto"
        >
          Não há login, API, persistência, geração, exportação, admissão,
          edição, desligamento, alteração de vínculo ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-listagem-colaboradores-screen__aviso relatorio-listagem-colaboradores-screen__aviso--indisponivel"
        aria-labelledby="relatorio-listagem-colaboradores-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">Listagem não é cadastro</StatusBadge>
        <p
          id="relatorio-listagem-colaboradores-aviso-referencia-titulo"
          className="relatorio-listagem-colaboradores-screen__aviso-texto"
        >
          Estas referências não alteram colaborador, vínculo, função, cargo,
          jornada, ponto, Banco de Horas, remuneração, benefícios, documentos,
          permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="relatorio-listagem-colaboradores-screen__aviso relatorio-listagem-colaboradores-screen__aviso--indisponivel"
        aria-labelledby="relatorio-listagem-colaboradores-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="relatorio-listagem-colaboradores-aviso-dados-titulo"
          className="relatorio-listagem-colaboradores-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="relatorio-listagem-colaboradores-resumo-titulo"
        className="relatorio-listagem-colaboradores-screen__resumo"
      >
        <h2
          id="relatorio-listagem-colaboradores-resumo-titulo"
          className="relatorio-listagem-colaboradores-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="relatorio-listagem-colaboradores-screen__resumo-lista">
          <li className="relatorio-listagem-colaboradores-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-listagem-colaboradores-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="relatorio-listagem-colaboradores-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-listagem-colaboradores-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-listagem-colaboradores-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias de vínculo</StatusBadge>
              <p className="relatorio-listagem-colaboradores-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de vínculo (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-listagem-colaboradores-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-listagem-colaboradores-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="relatorio-listagem-colaboradores-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-listagem-colaboradores-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-listagem-colaboradores-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="relatorio-listagem-colaboradores-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="relatorio-listagem-colaboradores-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="relatorio-listagem-colaboradores-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="relatorio-listagem-colaboradores-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="relatorio-listagem-colaboradores-screen__nota">
          Não há PII, cálculo, pagamento, desconto, elegibilidade, evento de
          Folha ou decisão operacional nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="relatorio-listagem-colaboradores-demo-titulo"
        className="relatorio-listagem-colaboradores-screen__demo"
      >
        <h2
          id="relatorio-listagem-colaboradores-demo-titulo"
          className="relatorio-listagem-colaboradores-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="relatorio-listagem-colaboradores-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="relatorio-listagem-colaboradores-screen__demo-botoes"
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
          className="relatorio-listagem-colaboradores-screen__erro"
          aria-labelledby="relatorio-listagem-colaboradores-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="relatorio-listagem-colaboradores-erro-titulo"
            className="relatorio-listagem-colaboradores-screen__section-title"
          >
            Não foi possível carregar as referências de colaboradores
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="relatorio-listagem-colaboradores-screen__erro-referencia">
            Referência: <code>REQ-DEMO-023789</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="relatorio-listagem-colaboradores-lista-titulo">
          <h2
            id="relatorio-listagem-colaboradores-lista-titulo"
            className="relatorio-listagem-colaboradores-screen__section-title"
          >
            Referências de vínculo
          </h2>

          <div className="relatorio-listagem-colaboradores-screen__filtros">
            <FormField
              id="relatorio-listagem-colaboradores-filtro-situacao"
              label="Situação de referência"
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
                      ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES,
                    ) as SituacaoRelatorioListagemColaboradores[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {
                        ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES[
                          situacao
                        ]
                      }
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="relatorio-listagem-colaboradores-filtro-escopo"
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

            <FormField
              id="relatorio-listagem-colaboradores-filtro-categoria"
              label="Categoria de vínculo"
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

            <Button
              variant="subtle"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
            >
              Limpar filtros
            </Button>
          </div>
          <p className="relatorio-listagem-colaboradores-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de vínculo cadastrada"
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
              caption="Listagem de Colaboradores (exemplo)"
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
          className="relatorio-listagem-colaboradores-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="relatorio-listagem-colaboradores-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="relatorio-listagem-colaboradores-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Vínculo técnico ilustrativo</dt>
              <dd>{detalheAberto.vinculoTecnicoIlustrativo}</dd>
            </div>
            <div>
              <dt>Categoria de vínculo</dt>
              <dd>{detalheAberto.categoriaVinculo}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {
                  ROTULO_SITUACAO_RELATORIO_LISTAGEM_COLABORADORES[
                    detalheAberto.situacao
                  ]
                }
              </dd>
            </div>
            <div>
              <dt>Função de referência</dt>
              <dd>{detalheAberto.funcaoReferencia}</dd>
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

          <h3 className="relatorio-listagem-colaboradores-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="relatorio-listagem-colaboradores-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="relatorio-listagem-colaboradores-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="relatorio-listagem-colaboradores-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, identifica, admite, desliga, vincula, atribui, aprova, salva,
            calcula, paga, desconta, gera, exporta, importa nem integra
            colaboradores reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
