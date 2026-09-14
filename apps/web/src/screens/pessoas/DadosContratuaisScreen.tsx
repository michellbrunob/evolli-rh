/**
 * Pessoas > Dados contratuais (T089) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências técnicas de vínculo por
 * modalidade de referência e escopo/unidade técnica — sem criar, modificar
 * ou confirmar vínculo, função, cargo, remuneração, benefício, jornada,
 * ponto, Banco de Horas, documentos, permissões ou acessos. Tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, admite,
 * desliga, altera contrato, remuneração, jornada, ponto, Folha, documentos,
 * permissões, acessos, importa, exporta ou integra dados reais.
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
  DADOS_CONTRATUAIS_EXEMPLO,
  type DadosContratuaisExemplo,
  ROTULO_SITUACAO_DADOS_CONTRATUAIS,
  type SituacaoDadosContratuais,
} from "./dadosContratuais.fixtures";
import "./DadosContratuaisScreen.css";

export const DADOS_CONTRATUAIS_TITULO_ID = "dados-contratuais-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoDadosContratuais, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function DadosContratuaisScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroModalidade, setFiltroModalidade] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroEscopo, setFiltroEscopo] = useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : DADOS_CONTRATUAIS_EXEMPLO),
    [estadoDemo],
  );

  const modalidadesDisponiveis = useMemo(() => {
    const unicos = new Set(
      DADOS_CONTRATUAIS_EXEMPLO.map((linha) => linha.modalidadeReferencia),
    );
    return Array.from(unicos);
  }, []);

  const escoposDisponiveis = useMemo(() => {
    const unicos = new Set(
      DADOS_CONTRATUAIS_EXEMPLO.map((linha) => linha.referenciaOrganizacional),
    );
    return Array.from(unicos);
  }, []);

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (
        filtroModalidade !== OPCAO_TODOS &&
        linha.modalidadeReferencia !== filtroModalidade
      ) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroEscopo !== OPCAO_TODOS &&
        linha.referenciaOrganizacional !== filtroEscopo
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroModalidade, filtroSituacao, filtroEscopo]);

  const filtrosAtivos =
    filtroModalidade !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroEscopo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroModalidade(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroEscopo(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const vinculosReferencia = new Set<string>();
    let totalEmRevisao = 0;
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      vinculosReferencia.add(linha.vinculoTecnico);
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
      totalVinculos: vinculosReferencia.size,
      totalEmRevisao,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<DadosContratuaisExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "vinculo",
      header: "Vínculo técnico ilustrativo",
      cell: (linha) => linha.vinculoTecnico,
    },
    {
      key: "modalidade",
      header: "Modalidade de referência",
      cell: (linha) => linha.modalidadeReferencia,
    },
    {
      key: "periodo",
      header: "Período ilustrativo",
      cell: (linha) => linha.periodoIlustrativo,
    },
    {
      key: "referenciaOrganizacional",
      header: "Referência organizacional",
      cell: (linha) => linha.referenciaOrganizacional,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_DADOS_CONTRATUAIS[linha.situacao]}
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
    <div className="dados-contratuais-screen">
      <PageHeader
        headingLevel={1}
        titleId={DADOS_CONTRATUAIS_TITULO_ID}
        title="Dados contratuais"
        description="Demonstração visual de como o RH poderá consultar referências técnicas de vínculo por modalidade de referência e escopo/unidade técnica."
      />

      <Surface
        as="section"
        padding="md"
        className="dados-contratuais-screen__aviso"
        aria-labelledby="dados-contratuais-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="dados-contratuais-aviso-rh-titulo"
          className="dados-contratuais-screen__aviso-texto"
        >
          A consulta é limitada à própria empresa e às unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dados-contratuais-screen__aviso"
        aria-labelledby="dados-contratuais-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="dados-contratuais-aviso-demo-titulo"
          className="dados-contratuais-screen__aviso-texto"
        >
          Não há login, API, persistência, alteração contratual, admissão,
          desligamento ou Folha nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dados-contratuais-screen__aviso dados-contratuais-screen__aviso--indisponivel"
        aria-labelledby="dados-contratuais-aviso-referencia-titulo"
      >
        <StatusBadge variant="warning">Referência não é contrato</StatusBadge>
        <p
          id="dados-contratuais-aviso-referencia-titulo"
          className="dados-contratuais-screen__aviso-texto"
        >
          Estas referências não criam, modificam ou confirmam vínculo, função,
          cargo, remuneração, benefício, jornada, ponto, Banco de Horas,
          documentos, permissões ou acessos.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="dados-contratuais-screen__aviso dados-contratuais-screen__aviso--indisponivel"
        aria-labelledby="dados-contratuais-aviso-dados-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="dados-contratuais-aviso-dados-titulo"
          className="dados-contratuais-screen__aviso-texto"
        >
          Qualquer uso futuro exige MFA, o gate-mestre de segurança operacional
          (<code>DS-OPS-01</code>), auditoria, retenção/base legal e validações
          aplicáveis.
        </p>
      </Surface>

      <section
        aria-labelledby="dados-contratuais-resumo-titulo"
        className="dados-contratuais-screen__resumo"
      >
        <h2
          id="dados-contratuais-resumo-titulo"
          className="dados-contratuais-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="dados-contratuais-screen__resumo-lista">
          <li className="dados-contratuais-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dados-contratuais-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Referências técnicas</StatusBadge>
              <p className="dados-contratuais-screen__resumo-item-texto">
                {resumo.totalReferencias} referência(s) técnica(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dados-contratuais-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dados-contratuais-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Vínculos de referência</StatusBadge>
              <p className="dados-contratuais-screen__resumo-item-texto">
                {resumo.totalVinculos} vínculo(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dados-contratuais-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dados-contratuais-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Em revisão</StatusBadge>
              <p className="dados-contratuais-screen__resumo-item-texto">
                {resumo.totalEmRevisao} item(ns) em revisão (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dados-contratuais-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dados-contratuais-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">Pendentes de decisão</StatusBadge>
              <p className="dados-contratuais-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) pendente(s) de decisão
                (exemplo)
              </p>
            </Surface>
          </li>
          <li className="dados-contratuais-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="dados-contratuais-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="dados-contratuais-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="dados-contratuais-screen__nota">
          Os indicadores não criam, alteram, reconhecem, aprovam ou encerram
          vínculo; não há cálculo financeiro, pagamento, desconto ou evento de
          Folha.
        </p>
      </section>

      <section
        aria-labelledby="dados-contratuais-demo-titulo"
        className="dados-contratuais-screen__demo"
      >
        <h2
          id="dados-contratuais-demo-titulo"
          className="dados-contratuais-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="dados-contratuais-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração dos dados contratuais"
          className="dados-contratuais-screen__demo-botoes"
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
          className="dados-contratuais-screen__erro"
          aria-labelledby="dados-contratuais-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="dados-contratuais-erro-titulo"
            className="dados-contratuais-screen__section-title"
          >
            Não foi possível carregar as referências de dados contratuais
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="dados-contratuais-screen__erro-referencia">
            Referência: <code>REQ-DEMO-009021</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="dados-contratuais-lista-titulo">
          <h2
            id="dados-contratuais-lista-titulo"
            className="dados-contratuais-screen__section-title"
          >
            Referências de dados contratuais
          </h2>

          <div className="dados-contratuais-screen__filtros">
            <FormField
              id="dados-contratuais-filtro-modalidade"
              label="Modalidade de referência"
            >
              {(control) => (
                <select
                  value={filtroModalidade}
                  onChange={(evento) =>
                    setFiltroModalidade(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as modalidades</option>
                  {modalidadesDisponiveis.map((modalidade) => (
                    <option key={modalidade} value={modalidade}>
                      {modalidade}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="dados-contratuais-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_DADOS_CONTRATUAIS,
                    ) as SituacaoDadosContratuais[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_DADOS_CONTRATUAIS[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="dados-contratuais-filtro-escopo"
              label="Escopo/unidade técnica"
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
          <p className="dados-contratuais-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de dados contratuais cadastrada"
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
              caption="Dados contratuais (exemplo)"
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
          className="dados-contratuais-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="dados-contratuais-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="dados-contratuais-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Vínculo técnico ilustrativo</dt>
              <dd>{detalheAberto.vinculoTecnico}</dd>
            </div>
            <div>
              <dt>Modalidade de referência</dt>
              <dd>{detalheAberto.modalidadeReferencia}</dd>
            </div>
            <div>
              <dt>Referência organizacional</dt>
              <dd>{detalheAberto.referenciaOrganizacional}</dd>
            </div>
            <div>
              <dt>Período ilustrativo</dt>
              <dd>{detalheAberto.periodoIlustrativo}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                {ROTULO_SITUACAO_DADOS_CONTRATUAIS[detalheAberto.situacao]}
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

          <h3 className="dados-contratuais-screen__detalhe-subtitulo">
            Descrição de referência (exemplo)
          </h3>
          <p>{detalheAberto.descricaoReferencia}</p>

          <h3 className="dados-contratuais-screen__detalhe-subtitulo">
            Campos que dependem de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="dados-contratuais-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="dados-contratuais-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, admite, desliga, altera contrato, remuneração, jornada,
            ponto, Folha, documentos, permissões, acessos, importa, exporta nem
            integra dados reais.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
