/**
 * Cadastros > Funções e cargos (T080) — tela visual estática.
 *
 * Demonstra como o RH poderá consultar referências organizacionais de
 * função e cargo por empresa/unidade e departamento/estrutura técnica —
 * sem conceder permissão de acesso, sem alterar vínculo, remuneração,
 * jornada, escala, Banco de Horas, Folha ou qualquer dado real. Tudo aqui é
 * amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * O painel de detalhe é só leitura: nenhuma ação cria, edita, vincula,
 * ativa, aprova, salva, importa, exporta ou altera registro real.
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
  FUNCOES_CARGOS_EXEMPLO,
  type FuncaoCargoExemplo,
  ROTULO_SITUACAO_FUNCAO_CARGO,
  type SituacaoFuncaoCargo,
} from "./funcoesCargos.fixtures";
import "./FuncoesCargosScreen.css";

export const FUNCOES_CARGOS_TITULO_ID = "funcoes-cargos-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoFuncaoCargo, StatusVariant> = {
  referencia_em_revisao_exemplo: "info",
  aguardando_decisao_exemplo: "warning",
  historico_ilustrativo: "neutral",
};

const OPCAO_TODOS = "todos";

export function FuncoesCargosScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroUnidade, setFiltroUnidade] = useState<string>(OPCAO_TODOS);
  const [filtroDepartamento, setFiltroDepartamento] =
    useState<string>(OPCAO_TODOS);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const detalheTituloId = useId();

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : FUNCOES_CARGOS_EXEMPLO),
    [estadoDemo],
  );

  const unidadesDisponiveis = useMemo(() => {
    const unicas = new Set(
      FUNCOES_CARGOS_EXEMPLO.map((linha) => linha.empresaUnidadeTecnica),
    );
    return Array.from(unicas);
  }, []);

  const departamentosDisponiveis = useMemo(() => {
    const unicos = new Set(
      FUNCOES_CARGOS_EXEMPLO.map((linha) => linha.departamentoEstruturaTecnica),
    );
    return Array.from(unicos);
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
      if (
        filtroDepartamento !== OPCAO_TODOS &&
        linha.departamentoEstruturaTecnica !== filtroDepartamento
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroSituacao, filtroUnidade, filtroDepartamento]);

  const filtrosAtivos =
    filtroSituacao !== OPCAO_TODOS ||
    filtroUnidade !== OPCAO_TODOS ||
    filtroDepartamento !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroUnidade(OPCAO_TODOS);
    setFiltroDepartamento(OPCAO_TODOS);
  }

  const resumo = useMemo(() => {
    const funcoesUnicas = new Set(linhasBase.map((linha) => linha.funcao));
    const cargosUnicos = new Set(linhasBase.map((linha) => linha.cargo));
    let totalAguardandoDecisao = 0;
    let totalHistorico = 0;
    for (const linha of linhasBase) {
      if (linha.situacao === "aguardando_decisao_exemplo") {
        totalAguardandoDecisao += 1;
      }
      if (linha.situacao === "historico_ilustrativo") {
        totalHistorico += 1;
      }
    }
    return {
      totalFuncoes: funcoesUnicas.size,
      totalCargos: cargosUnicos.size,
      totalVinculos: linhasBase.length,
      totalAguardandoDecisao,
      totalHistorico,
    };
  }, [linhasBase]);

  const detalheAberto =
    detalheAbertoId != null
      ? linhasBase.find((linha) => linha.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<FuncaoCargoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "funcao",
      header: "Função",
      cell: (linha) => linha.funcao,
    },
    {
      key: "cargo",
      header: "Cargo",
      cell: (linha) => linha.cargo,
    },
    {
      key: "unidade",
      header: "Empresa/unidade técnica",
      cell: (linha) => linha.empresaUnidadeTecnica,
    },
    {
      key: "departamento",
      header: "Departamento/estrutura técnica",
      cell: (linha) => linha.departamentoEstruturaTecnica,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_FUNCAO_CARGO[linha.situacao]}
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
    <div className="funcoes-cargos-screen">
      <PageHeader
        headingLevel={1}
        titleId={FUNCOES_CARGOS_TITULO_ID}
        title="Funções e cargos"
        description="Demonstração visual de como o RH poderá consultar referências organizacionais de função e cargo por empresa/unidade e departamento/estrutura técnica."
      />

      <Surface
        as="section"
        padding="md"
        className="funcoes-cargos-screen__aviso"
        aria-labelledby="funcoes-cargos-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="funcoes-cargos-aviso-rh-titulo"
          className="funcoes-cargos-screen__aviso-texto"
        >
          O RH consulta somente referências de função e cargo da própria empresa
          e das unidades autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="funcoes-cargos-screen__aviso"
        aria-labelledby="funcoes-cargos-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="funcoes-cargos-aviso-demo-titulo"
          className="funcoes-cargos-screen__aviso-texto"
        >
          Não há login, API, persistência, importação, exportação, integração,
          cálculo ou alteração cadastral real nesta tela.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="funcoes-cargos-screen__aviso funcoes-cargos-screen__aviso--indisponivel"
        aria-labelledby="funcoes-cargos-aviso-referencias-titulo"
      >
        <StatusBadge variant="warning">Referências organizacionais</StatusBadge>
        <p
          id="funcoes-cargos-aviso-referencias-titulo"
          className="funcoes-cargos-screen__aviso-texto"
        >
          Cargo, função, departamento, centro de custo e estrutura são
          referências distintas e não concedem permissão de acesso.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="funcoes-cargos-screen__aviso funcoes-cargos-screen__aviso--indisponivel"
        aria-labelledby="funcoes-cargos-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dados reais bloqueados</StatusBadge>
        <p
          id="funcoes-cargos-aviso-bloqueio-titulo"
          className="funcoes-cargos-screen__aviso-texto"
        >
          Qualquer operação real exige MFA, o gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          validações aplicáveis de RH, Jurídico/privacidade e TI.
        </p>
      </Surface>

      <section
        aria-labelledby="funcoes-cargos-resumo-titulo"
        className="funcoes-cargos-screen__resumo"
      >
        <h2
          id="funcoes-cargos-resumo-titulo"
          className="funcoes-cargos-screen__section-title"
        >
          Resumo (exemplo)
        </h2>
        <ul className="funcoes-cargos-screen__resumo-lista">
          <li className="funcoes-cargos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="funcoes-cargos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Funções de referência</StatusBadge>
              <p className="funcoes-cargos-screen__resumo-item-texto">
                {resumo.totalFuncoes} função(ões) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="funcoes-cargos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="funcoes-cargos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="info">Cargos de referência</StatusBadge>
              <p className="funcoes-cargos-screen__resumo-item-texto">
                {resumo.totalCargos} cargo(s) de referência (exemplo)
              </p>
            </Surface>
          </li>
          <li className="funcoes-cargos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="funcoes-cargos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">
                Vínculos organizacionais
              </StatusBadge>
              <p className="funcoes-cargos-screen__resumo-item-texto">
                {resumo.totalVinculos} vínculo(s) organizacional(is)
                ilustrativo(s) (exemplo)
              </p>
            </Surface>
          </li>
          <li className="funcoes-cargos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="funcoes-cargos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="warning">
                Aguardando decisão formal
              </StatusBadge>
              <p className="funcoes-cargos-screen__resumo-item-texto">
                {resumo.totalAguardandoDecisao} item(ns) aguardando decisão
                formal (exemplo)
              </p>
            </Surface>
          </li>
          <li className="funcoes-cargos-screen__resumo-item">
            <Surface
              as="div"
              padding="md"
              className="funcoes-cargos-screen__resumo-item-conteudo"
            >
              <StatusBadge variant="neutral">Itens históricos</StatusBadge>
              <p className="funcoes-cargos-screen__resumo-item-texto">
                {resumo.totalHistorico} item(ns) histórico(s) demonstrativo(s)
                (exemplo)
              </p>
            </Surface>
          </li>
        </ul>
        <p className="funcoes-cargos-screen__nota">
          Estes indicadores não alteram vínculo, remuneração, jornada, escala,
          Banco de Horas, Folha, permissões ou acesso ao sistema.
        </p>
      </section>

      <section
        aria-labelledby="funcoes-cargos-demo-titulo"
        className="funcoes-cargos-screen__demo"
      >
        <h2
          id="funcoes-cargos-demo-titulo"
          className="funcoes-cargos-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="funcoes-cargos-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das referências"
          className="funcoes-cargos-screen__demo-botoes"
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
          className="funcoes-cargos-screen__erro"
          aria-labelledby="funcoes-cargos-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="funcoes-cargos-erro-titulo"
            className="funcoes-cargos-screen__section-title"
          >
            Não foi possível carregar as referências de função e cargo
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="funcoes-cargos-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001922</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="funcoes-cargos-lista-titulo">
          <h2
            id="funcoes-cargos-lista-titulo"
            className="funcoes-cargos-screen__section-title"
          >
            Referências de função e cargo
          </h2>

          <div className="funcoes-cargos-screen__filtros">
            <FormField id="funcoes-cargos-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_FUNCAO_CARGO,
                    ) as SituacaoFuncaoCargo[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_FUNCAO_CARGO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="funcoes-cargos-filtro-unidade"
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

            <FormField
              id="funcoes-cargos-filtro-departamento"
              label="Departamento/estrutura técnica"
            >
              {(control) => (
                <select
                  value={filtroDepartamento}
                  onChange={(evento) =>
                    setFiltroDepartamento(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os departamentos</option>
                  {departamentosDisponiveis.map((departamento) => (
                    <option key={departamento} value={departamento}>
                      {departamento}
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
          <p className="funcoes-cargos-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma referência de função ou cargo cadastrada"
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
              caption="Funções e cargos (exemplo)"
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
          className="funcoes-cargos-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <StatusBadge variant="info">Detalhe demonstrativo</StatusBadge>
          <h2
            id={detalheTituloId}
            className="funcoes-cargos-screen__section-title"
          >
            Detalhe da referência — {detalheAberto.id}
          </h2>
          <dl className="funcoes-cargos-screen__detalhe-lista">
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Função</dt>
              <dd>{detalheAberto.funcao}</dd>
            </div>
            <div>
              <dt>Cargo</dt>
              <dd>{detalheAberto.cargo}</dd>
            </div>
            <div>
              <dt>Empresa/unidade técnica</dt>
              <dd>{detalheAberto.empresaUnidadeTecnica}</dd>
            </div>
            <div>
              <dt>Departamento/estrutura técnica</dt>
              <dd>{detalheAberto.departamentoEstruturaTecnica}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_SITUACAO_FUNCAO_CARGO[detalheAberto.situacao]}</dd>
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

          <h3 className="funcoes-cargos-screen__detalhe-subtitulo">
            Campos pendentes de decisão formal (exemplo)
          </h3>
          {detalheAberto.camposPendentes.length === 0 ? (
            <p>Nenhum campo pendente (exemplo).</p>
          ) : (
            <ul className="funcoes-cargos-screen__detalhe-lista-simples">
              {detalheAberto.camposPendentes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="funcoes-cargos-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> este painel não cria,
            edita, vincula, ativa, aprova, salva, importa, exporta nem altera
            registro real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
