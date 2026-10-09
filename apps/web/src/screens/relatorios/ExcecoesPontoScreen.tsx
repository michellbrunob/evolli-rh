/**
 * Relatórios > Exceções de Ponto (T075) — tela visual estática.
 *
 * Demonstra uma lista de pendências diárias de Ponto para priorização e
 * revisão humana do RH — vocabulário de tipo compatível com o contrato
 * conceitual da fila "Verificar folhas"
 * (`docs/modules/etapa3-fila-verificar-folhas-contrato-v1.md`), mas esta
 * tela **não** importa nem chama aquele núcleo: é um relatório de leitura
 * com amostra sintética própria, em memória.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Todo dado é sintético (`excecoesPonto.fixtures.ts`). O encaminhamento
 * exibido é só um rótulo de leitura derivado da situação — nunca uma ação
 * que muta ponto, saldo, compensação, Folha ou fechamento. Filtros e o
 * alternador de "estado de demonstração" só recalculam o que é exibido em
 * memória.
 */
import { useMemo, useState } from "react";
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
  EXCECOES_PONTO_EXEMPLO,
  type ExcecaoPontoExemplo,
  type PrioridadeExcecao,
  ROTULO_ENCAMINHAMENTO_POR_SITUACAO,
  ROTULO_PRIORIDADE_EXCECAO,
  ROTULO_SITUACAO_EXCECAO,
  ROTULO_TIPO_EXCECAO,
  type SituacaoExcecao,
  type TipoExcecaoPonto,
} from "./excecoesPonto.fixtures";
import "./ExcecoesPontoScreen.css";

export const EXCECOES_PONTO_TITULO_ID = "excecoes-ponto-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_PRIORIDADE: Record<PrioridadeExcecao, StatusVariant> = {
  baixa: "info",
  media: "warning",
  alta: "danger",
};

const VARIANTE_SITUACAO: Record<SituacaoExcecao, StatusVariant> = {
  aberta: "neutral",
  em_analise_rh: "info",
  resolvida: "success",
};

const OPCAO_TODOS = "todos";

export function ExcecoesPontoScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>(OPCAO_TODOS);

  const linhasBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : EXCECOES_PONTO_EXEMPLO),
    [estadoDemo],
  );

  const linhasFiltradas = useMemo(() => {
    return linhasBase.filter((linha) => {
      if (filtroTipo !== OPCAO_TODOS && linha.tipo !== filtroTipo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && linha.situacao !== filtroSituacao) {
        return false;
      }
      if (
        filtroPrioridade !== OPCAO_TODOS &&
        linha.prioridade !== filtroPrioridade
      ) {
        return false;
      }
      return true;
    });
  }, [linhasBase, filtroTipo, filtroSituacao, filtroPrioridade]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS ||
    filtroSituacao !== OPCAO_TODOS ||
    filtroPrioridade !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroPrioridade(OPCAO_TODOS);
  }

  const colunas: DataTableColumn<ExcecaoPontoExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
    {
      key: "periodo",
      header: "Período/dia",
      cell: (linha) => formatarDiaCivil(linha.periodoReferencia),
    },
    {
      key: "vinculo",
      header: "Vínculo técnico",
      cell: (linha) => linha.vinculoRef,
    },
    {
      key: "tipo",
      header: "Tipo de pendência",
      cell: (linha) => ROTULO_TIPO_EXCECAO[linha.tipo],
    },
    {
      key: "prioridade",
      header: "Prioridade",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_PRIORIDADE[linha.prioridade]}>
          {ROTULO_PRIORIDADE_EXCECAO[linha.prioridade]}
        </StatusBadge>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_EXCECAO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "encaminhamento",
      header: "Encaminhamento",
      cell: (linha) => ROTULO_ENCAMINHAMENTO_POR_SITUACAO[linha.situacao],
    },
  ];

  return (
    <div className="excecoes-ponto-screen">
      <PageHeader
        headingLevel={1}
        titleId={EXCECOES_PONTO_TITULO_ID}
        title="Exceções de Ponto"
        description="Lista demonstrativa de pendências diárias de Ponto para priorização e revisão humana do RH — apenas referências técnicas, nunca dado real."
      />

      <Surface
        as="section"
        padding="md"
        className="excecoes-ponto-screen__aviso"
        aria-labelledby="excecoes-ponto-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="excecoes-ponto-aviso-rh-titulo"
          className="excecoes-ponto-screen__aviso-texto"
        >
          O RH revisa somente exceções de Ponto da própria empresa. Ajuste
          manual, fechamento, compensação, quitação e integração com a Folha
          permanecem em fluxos separados e autorizados, fora deste relatório.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="excecoes-ponto-screen__aviso"
        aria-labelledby="excecoes-ponto-aviso-demo-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="excecoes-ponto-aviso-demo-titulo"
          className="excecoes-ponto-screen__aviso-texto"
        >
          Esta é uma demonstração visual, sem login real, API, persistência,
          cálculo financeiro, arquivo, PDF, assinatura ou operação trabalhista.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="excecoes-ponto-screen__aviso excecoes-ponto-screen__aviso--indisponivel"
        aria-labelledby="excecoes-ponto-aviso-bloqueio-titulo"
      >
        <StatusBadge variant="warning">Dado real bloqueado</StatusBadge>
        <p
          id="excecoes-ponto-aviso-bloqueio-titulo"
          className="excecoes-ponto-screen__aviso-texto"
        >
          Dado real continua bloqueado por MFA, pelo gate-mestre de segurança
          operacional (<code>DS-OPS-01</code>), auditoria, retenção/base legal e
          demais validações aplicáveis.
        </p>
      </Surface>

      <p className="excecoes-ponto-screen__nota-banco-horas">
        Alertas de Banco de Horas (ex.: saldo alto ou negativo) são apenas
        informativos nesta demonstração — não calculam dinheiro, não bloqueiam
        automaticamente e não fecham o período sozinhos.
      </p>

      <section
        aria-labelledby="excecoes-ponto-demo-titulo"
        className="excecoes-ponto-screen__demo"
      >
        <h2
          id="excecoes-ponto-demo-titulo"
          className="excecoes-ponto-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="excecoes-ponto-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="excecoes-ponto-screen__demo-botoes"
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
          className="excecoes-ponto-screen__erro"
          aria-labelledby="excecoes-ponto-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="excecoes-ponto-erro-titulo"
            className="excecoes-ponto-screen__section-title"
          >
            Não foi possível carregar as exceções de Ponto
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="excecoes-ponto-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001145</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="excecoes-ponto-lista-titulo">
          <h2
            id="excecoes-ponto-lista-titulo"
            className="excecoes-ponto-screen__section-title"
          >
            Exceções
          </h2>

          <div className="excecoes-ponto-screen__filtros">
            <FormField id="excecoes-ponto-filtro-tipo" label="Tipo">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO_EXCECAO) as TipoExcecaoPonto[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_EXCECAO[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField id="excecoes-ponto-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(ROTULO_SITUACAO_EXCECAO) as SituacaoExcecao[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_EXCECAO[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField id="excecoes-ponto-filtro-prioridade" label="Prioridade">
              {(control) => (
                <select
                  value={filtroPrioridade}
                  onChange={(evento) =>
                    setFiltroPrioridade(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as prioridades</option>
                  {(
                    Object.keys(
                      ROTULO_PRIORIDADE_EXCECAO,
                    ) as PrioridadeExcecao[]
                  ).map((prioridade) => (
                    <option key={prioridade} value={prioridade}>
                      {ROTULO_PRIORIDADE_EXCECAO[prioridade]}
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
          <p className="excecoes-ponto-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {linhasBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma exceção de Ponto nesta empresa"
              description="Quando houver uma pendência diária desta empresa, ela aparece aqui para priorização do RH (exemplo)."
            />
          ) : linhasFiltradas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma exceção corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver as demais exceções desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Exceções de Ponto para priorização e revisão do RH"
              columns={colunas}
              rows={linhasFiltradas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}
    </div>
  );
}
