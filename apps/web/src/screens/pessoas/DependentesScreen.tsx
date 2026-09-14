/**
 * Pessoas > Dependentes (T093) — tela visual estática.
 *
 * Demonstra categorias de referência técnica de dependência por vínculo
 * ilustrativo e escopo técnico — sem identificar, vincular, validar,
 * comprovar, conceder, aprovar, calcular, descontar, pagar, reembolsar,
 * importar, exportar ou integrar dependente real. Tudo aqui é amostra
 * sintética própria, em memória — sem nome de pessoa, data de nascimento,
 * CPF, documento ou endereço.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, identifica,
 * vincula, valida, comprova, concede, aprova, salva, calcula, desconta,
 * paga, reembolsa, importa, exporta ou integra dependente real.
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
  DEPENDENTES_EXEMPLO,
  type DependenteExemplo,
  ROTULO_SITUACAO_DEPENDENTES,
  type SituacaoDependentes,
} from "./dependentes.fixtures";
import "./DependentesScreen.css";

export const DEPENDENTES_TITULO_ID = "dependentes-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoDependentes, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function DependentesScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : DEPENDENTES_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      DEPENDENTES_EXEMPLO.map((linha) => linha.categoriaReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      DEPENDENTES_EXEMPLO.map((linha) => linha.escopoTecnico),
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
        linha.escopoTecnico !== filtroEscopo
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
    const categorias = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      categorias.add(linha.categoriaReferencia);
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

  const colunas: DataTableColumn<DependenteExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "categoria",
      header: "Categoria de referência",
      cell: (linha) => linha.categoriaReferencia,
    },
    {
      key: "vinculo",
      header: "Vínculo ilustrativo",
      cell: (linha) => linha.vinculoIlustrativo,
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
          {ROTULO_SITUACAO_DEPENDENTES[linha.situacao]}
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
    <div className="dependentes-screen">
      <PageHeader
        headingLevel={1}
        titleId={DEPENDENTES_TITULO_ID}
        title="Dependentes"
        description="Demonstração visual de categorias de referência técnica de dependência por vínculo ilustrativo e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="dependentes-screen__aviso"
        aria-labelledby="dependentes-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="dependentes-aviso-rh-titulo"
          className="dependentes-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dependentes-screen__aviso"
        aria-labelledby="dependentes-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="dependentes-aviso-demo-titulo"
          className="dependentes-screen__aviso-texto"
        >
          Não há login, API, persistência, cadastro, vínculo, validação,
          documentos, benefício, pagamento, desconto ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dependentes-screen__aviso dependentes-screen__aviso--indisponivel"
        aria-labelledby="dependentes-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Referência não é dependente vinculado
        </StatusBadge>
        <p
          id="dependentes-aviso-referencia-titulo"
          className="dependentes-screen__aviso-texto"
        >
          Estas referências não alteram colaborador, vínculo, remuneração,
          elegibilidade, ponto, Banco de Horas, benefícios, documentos,
          permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dependentes-screen__aviso dependentes-screen__aviso--indisponivel"
        aria-labelledby="dependentes-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="dependentes-aviso-dados-titulo"
          className="dependentes-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="dependentes-resumo-titulo"
        className="dependentes-screen__resumo"
      >
        <h2
          id="dependentes-resumo-titulo"
          className="dependentes-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="dependentes-screen__resumo-lista">
          <li className="dependentes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dependentes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="dependentes-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dependentes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dependentes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias de referência</StatusBadge>
              <p className="dependentes-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dependentes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dependentes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="dependentes-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dependentes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dependentes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="dependentes-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dependentes-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dependentes-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="dependentes-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="dependentes-screen__nota">
          Não há pessoa identificável, elegibilidade, valor, pagamento,
          desconto, reembolso ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="dependentes-demo-titulo"
        className="dependentes-screen__demo"
      >
        <h2
          id="dependentes-demo-titulo"
          className="dependentes-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="dependentes-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos dependentes"
          className="dependentes-screen__demo-botoes"
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
          className="dependentes-screen__erro"
          aria-labelledby="dependentes-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="dependentes-erro-titulo"
            className="dependentes-screen__section-title"
          >
            Não foi possível carregar as referências de dependentes
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="dependentes-screen__erro-referencia">
            Referência: <code>REQ-DEMO-013071</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="dependentes-lista-titulo">
          <h2
            id="dependentes-lista-titulo"
            className="dependentes-screen__section-title"
          >
            Referências de dependentes
          </h2>

          <div className="dependentes-screen__filtros">
            <FormField id="dependentes-filtro-categoria" label="Categoria">
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

            <FormField id="dependentes-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_DEPENDENTES,
                    ) as SituacaoDependentes[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_DEPENDENTES[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="dependentes-filtro-escopo" label="Escopo técnico">
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
          <p className="dependentes-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de dependente cadastrada"
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
              caption="Dependentes (exemplo)"
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
          className="dependentes-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="dependentes-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="dependentes-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Categoria de referência</dt>
              <dd>{detalheAberto.categoriaReferencia}</dd>
            </div>
            <div>
              <dt>Vínculo ilustrativo</dt>
              <dd>{detalheAberto.vinculoIlustrativo}</dd>
            </div>
            <div>
              <dt>Escopo técnico</dt>
              <dd>{detalheAberto.escopoTecnico}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_DEPENDENTES[detalheAberto.situacao]}</dd>
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

          <h3 className="dependentes-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="dependentes-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="dependentes-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="dependentes-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, identifica, vincula, valida, comprova, concede, aprova,
            salva, calcula, desconta, paga, reembolsa, importa, exporta nem
            integra dependentes reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
