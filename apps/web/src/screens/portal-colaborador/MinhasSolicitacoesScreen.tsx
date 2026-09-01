/**
 * Portal do Colaborador > Minhas solicitações (T067) — tela visual estática.
 *
 * Demonstra a lista de solicitações do colaborador, com estados
 * **compatíveis** com a Central de Solicitações do Colaborador (T065/T066) —
 * mas sem chamar aquele núcleo: tudo aqui é amostra sintética própria.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF, sem
 * rota real, sem persistência. O formulário "Nova solicitação" só abre/fecha
 * localmente; confirmar não cria, altera, encaminha, persiste ou integra
 * nenhuma solicitação real.
 */
import { useId, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormActions,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type EstadoSolicitacaoExemplo,
  formatarDataBr,
  ROTULO_ESTADO_SOLICITACAO,
  ROTULO_TIPO_SOLICITACAO,
  SOLICITACOES_EXEMPLO,
  type SolicitacaoExemplo,
  type TipoSolicitacaoExemplo,
} from "./minhasSolicitacoes.fixtures";
import "./MinhasSolicitacoesScreen.css";

export const MINHAS_SOLICITACOES_TITULO_ID = "portal-solicitacoes-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_ESTADO: Record<EstadoSolicitacaoExemplo, StatusVariant> = {
  rascunho: "neutral",
  enviada: "info",
  em_revisao_rh: "info",
  aguardando_informacao: "warning",
  encaminhada_para_operacao_rh: "success",
  recusada: "danger",
  cancelada: "neutral",
};

export function MinhasSolicitacoesScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const detalheTituloId = useId();
  const formTituloId = useId();

  const linhas = useMemo(
    () => (estadoDemo === "vazio" ? [] : SOLICITACOES_EXEMPLO),
    [estadoDemo],
  );

  const detalheAberto =
    detalheAbertoId != null
      ? linhas.find((item) => item.id === detalheAbertoId)
      : undefined;

  const colunas: DataTableColumn<SolicitacaoExemplo>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (linha) => ROTULO_TIPO_SOLICITACAO[linha.tipo],
    },
    {
      key: "periodo",
      header: "Período de referência",
      cell: (linha) =>
        linha.periodoReferencia ? formatarDataBr(linha.periodoReferencia) : "—",
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_ESTADO[linha.situacao]}>
          {ROTULO_ESTADO_SOLICITACAO[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.id}</code>,
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="subtle" onClick={() => setDetalheAbertoId(linha.id)}>
          Ver detalhe
          <span className="sr-only">
            {" "}
            — {ROTULO_TIPO_SOLICITACAO[linha.tipo]}
          </span>
        </Button>
      ),
    },
  ];

  return (
    <div className="minhas-solicitacoes-screen">
      <PageHeader
        headingLevel={1}
        titleId={MINHAS_SOLICITACOES_TITULO_ID}
        title="Minhas solicitações"
        description="Solicitações enviadas pelo colaborador — apenas exemplo, com estados compatíveis com a Central de Solicitações do Colaborador."
        actions={
          <Button onClick={() => setFormularioAberto((aberto) => !aberto)}>
            {formularioAberto ? "Fechar formulário" : "Nova solicitação"}
          </Button>
        }
      />

      <Surface
        as="section"
        padding="md"
        className="minhas-solicitacoes-screen__aviso"
        aria-labelledby="portal-solicitacoes-aviso-titulo"
      >
        <StatusBadge variant="info">Somente demonstração</StatusBadge>
        <p
          id="portal-solicitacoes-aviso-titulo"
          className="minhas-solicitacoes-screen__aviso-texto"
        >
          O colaborador consulta e envia apenas a intenção sobre os próprios
          dados. Nenhum envio aqui cria, altera, encaminha, persiste ou integra
          nenhuma solicitação real — a operação efetiva segue sob
          responsabilidade do RH.
        </p>
      </Surface>

      <section
        aria-labelledby="portal-solicitacoes-demo-titulo"
        className="minhas-solicitacoes-screen__demo"
      >
        <h2
          id="portal-solicitacoes-demo-titulo"
          className="minhas-solicitacoes-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="minhas-solicitacoes-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração das solicitações"
          className="minhas-solicitacoes-screen__demo-botoes"
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

      {formularioAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="minhas-solicitacoes-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="minhas-solicitacoes-screen__section-title"
          >
            Nova solicitação (demonstração)
          </h2>
          <p className="minhas-solicitacoes-screen__demo-texto">
            Formulário só demonstrativo: nada é enviado, criado ou salvo ao
            confirmar.
          </p>
          <form
            className="minhas-solicitacoes-screen__form"
            aria-label="Formulário de nova solicitação"
            onSubmit={(evento) => {
              evento.preventDefault();
              setFormularioAberto(false);
            }}
          >
            <FormField id="portal-nova-solicitacao-tipo" label="Tipo" required>
              {(control) => (
                <select defaultValue="contestacao_ajuste_ponto" {...control}>
                  {(
                    Object.keys(
                      ROTULO_TIPO_SOLICITACAO,
                    ) as TipoSolicitacaoExemplo[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_SOLICITACAO[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="portal-nova-solicitacao-periodo"
              label="Período de referência"
              help="Deixe em branco quando não aplicável a este tipo."
            >
              {(control) => <input type="date" {...control} />}
            </FormField>

            <FormField
              id="portal-nova-solicitacao-motivo"
              label="Motivo (codificado)"
              help="Rótulo técnico ilustrativo — sem texto livre."
            >
              {(control) => (
                <input
                  type="text"
                  defaultValue="motivo_exemplo_demo"
                  readOnly
                  {...control}
                />
              )}
            </FormField>

            <FormActions>
              <Button
                variant="secondary"
                onClick={() => setFormularioAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Confirmar (demonstração)
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {estadoDemo === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="minhas-solicitacoes-screen__erro"
          aria-labelledby="portal-solicitacoes-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="portal-solicitacoes-erro-titulo"
            className="minhas-solicitacoes-screen__section-title"
          >
            Não foi possível carregar as solicitações
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="minhas-solicitacoes-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000321</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="portal-solicitacoes-lista-titulo">
          <h2
            id="portal-solicitacoes-lista-titulo"
            className="minhas-solicitacoes-screen__section-title"
          >
            Lista de solicitações
          </h2>

          {linhas.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma solicitação enviada"
              description="Quando você enviar uma solicitação, ela aparece aqui (exemplo)."
              action={
                <Button onClick={() => setFormularioAberto(true)}>
                  Nova solicitação
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Minhas solicitações"
              columns={colunas}
              rows={linhas}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {detalheAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="minhas-solicitacoes-screen__detalhe"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="minhas-solicitacoes-screen__section-title"
          >
            Detalhe da solicitação —{" "}
            {ROTULO_TIPO_SOLICITACAO[detalheAberto.tipo]}
          </h2>
          <dl className="minhas-solicitacoes-screen__detalhe-lista">
            <div>
              <dt>Período de referência</dt>
              <dd>
                {detalheAberto.periodoReferencia
                  ? formatarDataBr(detalheAberto.periodoReferencia)
                  : "Não aplicável"}
              </dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{ROTULO_ESTADO_SOLICITACAO[detalheAberto.situacao]}</dd>
            </div>
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheAberto.id}</code>
              </dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{detalheAberto.detalhe}</dd>
            </div>
          </dl>
          <p className="minhas-solicitacoes-screen__detalhe-aviso">
            <strong>Ação apenas demonstrativa:</strong> abrir este detalhe não
            cria, altera, encaminha nem aprova nenhuma solicitação real.
          </p>
          <Button variant="secondary" onClick={() => setDetalheAbertoId(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
