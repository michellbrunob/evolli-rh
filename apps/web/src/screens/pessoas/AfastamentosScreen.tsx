/**
 * Pessoas > Afastamentos (T094) — tela visual estática.
 *
 * Demonstra referências técnicas de acompanhamento por categoria,
 * visibilidade prevista e escopo técnico — sem identificar, registrar,
 * validar, diagnosticar, aprovar, conceder, retornar, calcular, pagar,
 * descontar, importar, exportar ou integrar afastamento real. Tudo aqui é
 * amostra sintética própria, em memória — sem pessoa identificável, datas
 * reais, diagnóstico, CID, atestado, laudo, documento ou informação clínica.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, identifica,
 * registra, valida, diagnostica, aprova, concede, retorna, salva, anexa,
 * exibe, compartilha, calcula, paga, desconta, importa, exporta ou integra
 * afastamentos reais.
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
  AFASTAMENTOS_EXEMPLO,
  type AfastamentoExemplo,
  ROTULO_SITUACAO_AFASTAMENTOS,
  type SituacaoAfastamentos,
} from "./afastamentos.fixtures";
import "./AfastamentosScreen.css";

export const AFASTAMENTOS_TITULO_ID = "afastamentos-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoAfastamentos, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function AfastamentosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroCategoria, setFiltroCategoria] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : AFASTAMENTOS_EXEMPLO),
    [estadoDemo],
  );

  const categoriasDisponiveis = useMemo(() => {
    const unicos = new Set(
      AFASTAMENTOS_EXEMPLO.map((linha) => linha.categoriaReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      AFASTAMENTOS_EXEMPLO.map((linha) => linha.escopoTecnico),
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

  const colunas: DataTableColumn<AfastamentoExemplo>[] = [
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
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => linha.periodoIlustrativo,
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
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_AFASTAMENTOS[linha.situacao]}
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
    <div className="afastamentos-screen">
      <PageHeader
        headingLevel={1}
        titleId={AFASTAMENTOS_TITULO_ID}
        title="Afastamentos"
        description="Demonstração visual de referências técnicas de acompanhamento por categoria, visibilidade prevista e escopo técnico."
      />

      <Surface
        as="section"
        padding="md"
        className="afastamentos-screen__aviso"
        aria-labelledby="afastamentos-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="afastamentos-aviso-rh-titulo"
          className="afastamentos-screen__aviso-texto"
        >
          A consulta é restrita à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="afastamentos-screen__aviso"
        aria-labelledby="afastamentos-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="afastamentos-aviso-demo-titulo"
          className="afastamentos-screen__aviso-texto"
        >
          Não há login, API, persistência, registro, aprovação, validação,
          documento, pagamento, desconto ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="afastamentos-screen__aviso afastamentos-screen__aviso--indisponivel"
        aria-labelledby="afastamentos-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">
          Referência não é afastamento efetivado
        </StatusBadge>
        <p
          id="afastamentos-aviso-referencia-titulo"
          className="afastamentos-screen__aviso-texto"
        >
          Estas referências não alteram colaborador, vínculo, jornada, ponto,
          Banco de Horas, benefícios, remuneração, documentos, permissões ou
          acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="afastamentos-screen__aviso afastamentos-screen__aviso--indisponivel"
        aria-labelledby="afastamentos-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">
          Dados reais e saúde ocupacional bloqueados
        </StatusBadge>
        <p
          id="afastamentos-aviso-dados-titulo"
          className="afastamentos-screen__aviso-texto"
        >
          Qualquer ativação futura exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal,
          controles de acesso e validações aplicáveis de RH,
          Jurídico/privacidade e saúde ocupacional.
        </p>
      </Surface>

      <section
        aria-labelledby="afastamentos-resumo-titulo"
        className="afastamentos-screen__resumo"
      >
        <h2
          id="afastamentos-resumo-titulo"
          className="afastamentos-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="afastamentos-screen__resumo-lista">
          <li className="afastamentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="afastamentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="afastamentos-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="afastamentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="afastamentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Categorias de referência</StatusBadge>
              <p className="afastamentos-screen__resumo-item-texto">
                {resumo.totalCategorias} categoria(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="afastamentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="afastamentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="afastamentos-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="afastamentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="afastamentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="afastamentos-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="afastamentos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="afastamentos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="afastamentos-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="afastamentos-screen__nota">
          Não há dado clínico, cálculo, pagamento, desconto, benefício, retorno
          ao trabalho ou evento de Folha nestes indicadores.
        </p>
      </section>

      <section
        aria-labelledby="afastamentos-demo-titulo"
        className="afastamentos-screen__demo"
      >
        <h2
          id="afastamentos-demo-titulo"
          className="afastamentos-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="afastamentos-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos afastamentos"
          className="afastamentos-screen__demo-botoes"
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
          className="afastamentos-screen__erro"
          aria-labelledby="afastamentos-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="afastamentos-erro-titulo"
            className="afastamentos-screen__section-title"
          >
            Não foi possível carregar as referências de afastamentos
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="afastamentos-screen__erro-referencia">
            Referência: <code>REQ-DEMO-014082</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="afastamentos-lista-titulo">
          <h2
            id="afastamentos-lista-titulo"
            className="afastamentos-screen__section-title"
          >
            Referências de afastamentos
          </h2>

          <div className="afastamentos-screen__filtros">
            <FormField id="afastamentos-filtro-categoria" label="Categoria">
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

            <FormField id="afastamentos-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_AFASTAMENTOS,
                    ) as SituacaoAfastamentos[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_AFASTAMENTOS[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="afastamentos-filtro-escopo" label="Escopo técnico">
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
          <p className="afastamentos-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de afastamento cadastrada"
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
              caption="Afastamentos (exemplo)"
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
          className="afastamentos-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="afastamentos-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="afastamentos-screen__detalhe-lista">
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
              <dt>Período ilustrativo</dt>
              <dd>{detalheAberto.periodoIlustrativo}</dd>
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
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_AFASTAMENTOS[detalheAberto.situacao]}</dd>
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

          <h3 className="afastamentos-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="afastamentos-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="afastamentos-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="afastamentos-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, identifica, registra, valida, diagnostica, aprova, concede,
            retorna, salva, anexa, exibe, compartilha, calcula, paga, desconta,
            importa, exporta nem integra afastamentos reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
