/**
 * Cadastros > Estrutura organizacional (T073) — tela visual estática.
 *
 * Visão administrativa demonstrativa que organiza o ecossistema para as
 * futuras relações entre empresas, unidades, departamentos e centros de
 * custo — apenas referências técnicas, tipo, vínculo superior, situação e
 * responsável técnico de exemplo. Não ativa nenhuma operação real de
 * cadastro.
 *
 * Escopo: PURAMENTE visual. Sem `fetch`, sem autenticação/sessão/CSRF/MFA,
 * sem rota real, sem persistência, sem backend, schema ou dependência nova.
 * Todo dado é sintético (`estruturaOrganizacional.fixtures.ts`),
 * independente do catálogo de "Horários" (T043). O formulário "Novo item de
 * estrutura" é inteiramente demonstrativo: confirmar não cria, salva, altera
 * nem persiste nenhum item de verdade, e a listagem nunca é modificada por
 * ele.
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
  HIERARQUIA_TIPOS,
  type ItemEstruturaExemplo,
  ITENS_ESTRUTURA_EXEMPLO,
  ROTULO_SITUACAO_ESTRUTURA,
  ROTULO_TIPO_ESTRUTURA,
  type SituacaoEstrutura,
  type TipoEstrutura,
} from "./estruturaOrganizacional.fixtures";
import "./EstruturaOrganizacionalScreen.css";

export const ESTRUTURA_ORGANIZACIONAL_TITULO_ID =
  "estrutura-organizacional-titulo";

type EstadoDemonstracao = "dados" | "vazio" | "erro";

const ROTULO_ESTADO_DEMO: Record<EstadoDemonstracao, string> = {
  dados: "Com dados",
  vazio: "Vazio",
  erro: "Erro",
};

const VARIANTE_SITUACAO: Record<SituacaoEstrutura, StatusVariant> = {
  ativa: "success",
  inativa: "neutral",
};

const OPCAO_TODOS = "todos";

export function EstruturaOrganizacionalScreen() {
  const [estadoDemo, setEstadoDemo] = useState<EstadoDemonstracao>("dados");
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [confirmacaoVisivel, setConfirmacaoVisivel] = useState(false);
  const formTituloId = useId();

  const itensBase = useMemo(
    () => (estadoDemo === "vazio" ? [] : ITENS_ESTRUTURA_EXEMPLO),
    [estadoDemo],
  );

  const itensFiltrados = useMemo(() => {
    return itensBase.filter((item) => {
      if (filtroTipo !== OPCAO_TODOS && item.tipo !== filtroTipo) {
        return false;
      }
      if (filtroSituacao !== OPCAO_TODOS && item.situacao !== filtroSituacao) {
        return false;
      }
      return true;
    });
  }, [itensBase, filtroTipo, filtroSituacao]);

  const filtrosAtivos =
    filtroTipo !== OPCAO_TODOS || filtroSituacao !== OPCAO_TODOS;

  function limparFiltros() {
    setFiltroTipo(OPCAO_TODOS);
    setFiltroSituacao(OPCAO_TODOS);
  }

  function abrirNovo() {
    setConfirmacaoVisivel(false);
    setFormularioAberto(true);
  }

  function fecharFormulario() {
    setFormularioAberto(false);
  }

  const colunas: DataTableColumn<ItemEstruturaExemplo>[] = [
    {
      key: "referencia",
      header: "Referência técnica",
      cell: (linha) => <code>{linha.referenciaTecnica}</code>,
    },
    {
      key: "tipo",
      header: "Tipo de estrutura",
      cell: (linha) => ROTULO_TIPO_ESTRUTURA[linha.tipo],
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "vinculoSuperior",
      header: "Vínculo superior",
      cell: (linha) =>
        linha.vinculoSuperior ? <code>{linha.vinculoSuperior}</code> : "—",
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_SITUACAO[linha.situacao]}>
          {ROTULO_SITUACAO_ESTRUTURA[linha.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "responsavel",
      header: "Responsável técnico",
      cell: (linha) => linha.responsavelTecnico,
    },
  ];

  return (
    <div className="estrutura-organizacional-screen">
      <PageHeader
        headingLevel={1}
        titleId={ESTRUTURA_ORGANIZACIONAL_TITULO_ID}
        title="Estrutura organizacional"
        description="Demonstração visual da futura hierarquia entre empresas, unidades, departamentos e centros de custo — apenas referências técnicas e situação de cada item, nunca dado real."
        actions={<Button onClick={abrirNovo}>Novo item de estrutura</Button>}
      />

      <Surface
        as="section"
        padding="md"
        className="estrutura-organizacional-screen__aviso"
        aria-labelledby="estrutura-organizacional-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="estrutura-organizacional-aviso-rh-titulo"
          className="estrutura-organizacional-screen__aviso-texto"
        >
          Somente o RH da própria empresa administra a estrutura organizacional
          nesta demonstração. Nenhuma alteração feita aqui é persistida — é uma
          amostra visual, sempre restrita à sua empresa.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="estrutura-organizacional-screen__aviso"
        aria-labelledby="estrutura-organizacional-aviso-indisponivel-titulo"
      >
        <StatusBadge variant="warning">Ainda indisponível</StatusBadge>
        <p
          id="estrutura-organizacional-aviso-indisponivel-titulo"
          className="estrutura-organizacional-screen__aviso-texto"
        >
          Empresa real, CNPJ, cadastro fiscal, colaboradores, Folha, eSocial,
          API e importação ainda não estão disponíveis nesta demonstração.
        </p>
      </Surface>

      <section
        aria-labelledby="estrutura-organizacional-hierarquia-titulo"
        className="estrutura-organizacional-screen__hierarquia"
      >
        <h2
          id="estrutura-organizacional-hierarquia-titulo"
          className="estrutura-organizacional-screen__section-title"
        >
          Hierarquia (exemplo)
        </h2>
        <ol className="estrutura-organizacional-screen__hierarquia-lista">
          {HIERARQUIA_TIPOS.map((tipo) => (
            <li key={tipo}>{ROTULO_TIPO_ESTRUTURA[tipo]}</li>
          ))}
        </ol>
        <p className="estrutura-organizacional-screen__demo-texto">
          Cada nível se vincula ao nível imediatamente superior — a ilustração
          acima é só uma amostra da relação, não a estrutura real desta empresa.
        </p>
      </section>

      <section
        aria-labelledby="estrutura-organizacional-demo-titulo"
        className="estrutura-organizacional-screen__demo"
      >
        <h2
          id="estrutura-organizacional-demo-titulo"
          className="estrutura-organizacional-screen__section-title"
        >
          Estado de demonstração
        </h2>
        <p className="estrutura-organizacional-screen__demo-texto">
          Alterna a amostra visual exibida abaixo — não representa uma chamada
          real à API.
        </p>
        <div
          role="group"
          aria-label="Selecionar estado de demonstração da listagem"
          className="estrutura-organizacional-screen__demo-botoes"
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
          className="estrutura-organizacional-screen__erro"
          aria-labelledby="estrutura-organizacional-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="estrutura-organizacional-erro-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Não foi possível carregar a estrutura organizacional
          </h2>
          <p>
            Tente novamente em instantes. Se o problema persistir, contate o
            suporte informando a referência abaixo.
          </p>
          <p className="estrutura-organizacional-screen__erro-referencia">
            Referência: <code>REQ-DEMO-001034</code> (ilustrativa)
          </p>
          <Button variant="secondary" onClick={() => setEstadoDemo("dados")}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="estrutura-organizacional-lista-titulo">
          <h2
            id="estrutura-organizacional-lista-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Itens de estrutura
          </h2>

          <div className="estrutura-organizacional-screen__filtros">
            <FormField id="estrutura-filtro-tipo" label="Tipo de estrutura">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(evento) => setFiltroTipo(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todos os tipos</option>
                  {(Object.keys(ROTULO_TIPO_ESTRUTURA) as TipoEstrutura[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_ESTRUTURA[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField id="estrutura-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(evento) => setFiltroSituacao(evento.target.value)}
                  {...control}
                >
                  <option value={OPCAO_TODOS}>Todas as situações</option>
                  {(
                    Object.keys(
                      ROTULO_SITUACAO_ESTRUTURA,
                    ) as SituacaoEstrutura[]
                  ).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_SITUACAO_ESTRUTURA[situacao]}
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
          <p className="estrutura-organizacional-screen__filtros-nota">
            Filtro só local, apenas para esta demonstração — não é enviado a
            nenhum servidor nem fica salvo ao recarregar a página.
          </p>

          {itensBase.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum item de estrutura cadastrado"
              description="Quando houver um item de estrutura organizacional para esta empresa, ele aparece aqui (exemplo)."
              action={
                <Button onClick={abrirNovo}>Novo item de estrutura</Button>
              }
            />
          ) : itensFiltrados.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum item corresponde aos filtros"
              description="Ajuste ou limpe os filtros para ver os demais itens desta demonstração."
              action={
                <Button variant="primary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Itens da estrutura organizacional"
              columns={colunas}
              rows={itensFiltrados}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formularioAberto ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            Novo item de estrutura
          </h2>
          <p className="estrutura-organizacional-screen__demo-texto">
            Demonstração visual: nada é criado, salvo, alterado ou persistido ao
            confirmar. Empresa real, CNPJ, cadastro fiscal, colaboradores,
            Folha, eSocial, API e importação ainda não estão disponíveis.
          </p>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label="Formulário de novo item de estrutura"
            onSubmit={(evento) => {
              evento.preventDefault();
              setConfirmacaoVisivel(true);
            }}
          >
            <FormField id="estrutura-tipo" label="Tipo de estrutura" required>
              {(control) => (
                <select defaultValue="" {...control}>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {(Object.keys(ROTULO_TIPO_ESTRUTURA) as TipoEstrutura[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_ESTRUTURA[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField
              id="estrutura-nome"
              label="Nome"
              required
              help="Identificador de exemplo — nunca razão social ou nome real."
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Ex.: Departamento Operações (exemplo)"
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="estrutura-vinculo-superior"
              label="Vínculo superior"
              help="Referência técnica ilustrativa do item hierarquicamente acima — deixe em branco para o nível mais alto (Empresa)."
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={40}
                  placeholder="Ex.: EST-2026-0001"
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="estrutura-vinculo-exemplo-erro"
              label="Vínculo superior (exemplo de validação)"
              error="Referência técnica não encontrada nesta demonstração."
            >
              {(control) => (
                <input type="text" defaultValue="EST-9999-9999" {...control} />
              )}
            </FormField>

            {confirmacaoVisivel ? (
              <p
                className="estrutura-organizacional-screen__confirmacao"
                role="status"
              >
                Ação apenas demonstrativa: nenhum item de estrutura foi
                realmente criado, salvo, alterado ou persistido.
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
