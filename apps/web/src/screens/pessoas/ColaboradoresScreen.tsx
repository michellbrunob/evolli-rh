/**
 * Pessoas > Colaboradores (T072) — tela visual estática.
 *
 * Visão administrativa demonstrativa que organiza o ecossistema para o
 * futuro cadastro/vínculo de pessoas — apenas referências técnicas,
 * situação, tipo de vínculo, unidade/departamento de exemplo e vigência.
 * Não ativa nenhuma operação real de cadastro.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Todo dado é sintético (`colaboradores.fixtures.ts`), independente do
 * catálogo de "Horário de trabalho" (T046). O formulário "Novo colaborador"
 * é inteiramente demonstrativo: confirmar não cria, salva nem altera nenhum
 * colaborador de verdade, e a listagem nunca é modificada por ele.
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
  COLABORADORES_EXEMPLO,
  type ColaboradorExemplo,
  formatarVigenciaColaborador,
  ROTULO_SITUACAO_COLABORADOR,
  ROTULO_TIPO_VINCULO,
  type SituacaoColaborador,
  type TipoVinculoColaborador,
  UNIDADES_EXEMPLO,
} from "./colaboradores.fixtures";
import "./ColaboradoresScreen.css";

export const COLABORADORES_TITULO_ID = "colaboradores-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoColaborador, StatusVariant> = {
  ativo: "success",
  afastado: "warning",
  desligado: "neutral",
};

const OPCAO_TODOS = "todos";

export function ColaboradoresScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [filtroTipoVinculo, setFiltroTipoVinculo] =
    useState<string>(OPCAO_TODOS);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [confirmacaoVisivel, setConfirmacaoVisivel] = useState(false);
  const formTituloId = useId();

  const colaboradoresBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : COLABORADORES_EXEMPLO),
    [estadoDemo],
  );

  const colaboradoresFiltrados = useMemo(() => {
    return colaboradoresBase.filter((colaborador) => {
      if (
        filtroSituacao !== OPCAO_TODOS &&
        colaborador.situacao !== filtroSituacao
      ) {
        return false;
      }
      if (
        filtroTipoVinculo !== OPCAO_TODOS &&
        colaborador.tipoVinculo !== filtroTipoVinculo
      ) {
        return false;
      }
      return true;
    });
  }, [colaboradoresBase, filtroSituacao, filtroTipoVinculo]);

  const filtrosAtivos =
    filtroSituacao !== OPCAO_TODOS || filtroTipoVinculo !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroSituacao(OPCAO_TODOS);
    setFiltroTipoVinculo(OPCAO_TODOS);
  }

  function abrirNovo() {
    setConfirmacaoVisivel(false);
    setFormularioAberto(true);
  }

  function fecharFormulario() {
    setFormularioAberto(false);
  }

  const colunas: DataTableColumn<ColaboradorExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_COLABORADOR[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "tipoVinculo",
      header: "Tipo de vínculo",
      cell: (linha) => ROTULO_TIPO_VINCULO[linha.tipoVinculo],
    },
    {
      key: "unidade",
      header: "Unidade/departamento",
      cell: (linha) => linha.unidade,
    },
    {
      key: "vigencia",
      header: "Vigência",
      cell: (linha) => formatarVigenciaColaborador(linha),
    },
  ];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Visão administrativa demonstrativa que organiza o ecossistema para o futuro cadastro e vínculo de pessoas — apenas referências técnicas e situação de cada registro, nunca dado pessoal real."
        actions={<Button onClick={abrirNovo}>Novo colaborador</Button>}
      />

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="colaboradores-aviso-rh-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Somente o RH da própria empresa administra colaboradores nesta
          demonstração. Nenhuma alteração feita aqui é persistida — é uma
          amostra visual, sempre restrita à sua empresa.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-indisponivel-titulo"
      >
        <StatusBadge variant="warning">Ainda indisponível</StatusBadge>
        <p
          id="colaboradores-aviso-indisponivel-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          CPF, documentos, admissão real, Folha, eSocial e upload de arquivos
          ainda não estão disponíveis nesta demonstração.
        </p>
      </Surface>

      <section
        aria-labelledby="colaboradores-demo-titulo"
        className="colaboradores-screen__demo"
      >
        <h2
          id="colaboradores-demo-titulo"
          className="colaboradores-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="colaboradores-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="colaboradores-screen__demo-botoes"
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
          className="colaboradores-screen__erro"
          aria-labelledby="colaboradores-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="colaboradores-erro-titulo"
            className="colaboradores-screen__section-title"
          >
            Não foi possível carregar os colaboradores
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="colaboradores-screen__erro-referencia">
            Referência: <code>REQ-DEMO-000912</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="colaboradores-lista-titulo">
          <h2
            id="colaboradores-lista-titulo"
            className="colaboradores-screen__section-title"
          >
            Colaboradores
          </h2>

          <div className="colaboradores-screen__filtros">
            <FormField id="colaboradores-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_COLABORADOR,
                    ) as SituacaoColaborador[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_COLABORADOR[situacao]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="colaboradores-filtro-tipo-vinculo"
              label="Tipo de vínculo"
            >
              {(control) => (
                <select
                  value={filtroTipoVinculo}
                  onChange={(evento) =>
                    setFiltroTipoVinculo(evento.target.value)
                  }
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(
                    Object.keys(ROTULO_TIPO_VINCULO) as TipoVinculoColaborador[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_VINCULO[tipo]}
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
          <p className="colaboradores-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {colaboradoresBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum colaborador cadastrado"
              description="Quando houver um colaborador registrado para esta empresa, ele aparece aqui (exemplo)."
              action={<Button onClick={abrirNovo}>Novo colaborador</Button>}
            />
          ) : colaboradoresFiltrados.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum colaborador corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver os demais colaboradores desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Colaboradores desta empresa"
              columns={colunas}
              rows={colaboradoresFiltrados}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formularioAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="colaboradores-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="colaboradores-screen__section-title">
            Novo colaborador
          </h2>
          <p className="colaboradores-screen__demo-texto">
            Demonstração visual: nada é criado, salvo ou realmente alterado ao
            confirmar. CPF, documentos, admissão real, Folha, eSocial e upload
            ainda não estão disponíveis.
          </p>

          <form
            className="colaboradores-screen__form"
            aria-label="Formulário de novo colaborador"
            onSubmit={(evento) => {
              evento.preventDefault();
              setConfirmacaoVisivel(true);
            }}
          >
            <FormField
              id="colaborador-tipo-vinculo"
              label="Tipo de vínculo"
              required
            >
              {(control) => (
                <select defaultValue="" {...control}>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {(
                    Object.keys(ROTULO_TIPO_VINCULO) as TipoVinculoColaborador[]
                  ).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_VINCULO[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="colaborador-unidade"
              label="Unidade/departamento"
              required
              help="Rótulo de exemplo — a estrutura organizacional real ainda não está disponível nesta demonstração."
            >
              {(control) => (
                <select defaultValue="" {...control}>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {UNIDADES_EXEMPLO.map((unidade) => (
                    <option key={unidade} value={unidade}>
                      {unidade}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="colaborador-vigencia-inicio"
              label="Vigência — início"
              required
              help="Data ilustrativa de início do vínculo nesta demonstração."
            >
              {(control) => <input type="date" {...control} />}
            </FormField>

            <FormField
              id="colaborador-vigencia-exemplo-erro"
              label="Vigência — início (exemplo de validação)"
              error="Informe uma data no formato AAAA-MM-DD."
            >
              {(control) => (
                <input type="text" defaultValue="31/02/2026" {...control} />
              )}
            </FormField>

            {confirmacaoVisivel ? (
              <p className="colaboradores-screen__confirmacao" role="status">
                Ação apenas demonstrativa: nenhum colaborador foi realmente
                criado, salvo ou alterado.
              </p>
            ) : null}

            <FormActions>
              <Button variant="secondary" onClick={fecharFormulario}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                Confirmar (demonstração)
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
