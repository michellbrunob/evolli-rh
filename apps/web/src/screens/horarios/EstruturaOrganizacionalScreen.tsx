import { useCallback, useEffect, useId, useState } from "react";
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
  type AtualizarDepartamentoDto,
  type AtualizarUnidadeDto,
  type CriarDepartamentoDto,
  type CriarUnidadeDto,
  type DepartamentoApi,
  type EmpresaApi,
  type ListarDepartamentosQuery,
  type ListarUnidadesQuery,
  type UnidadeOrganizacionalApi,
  atualizarDepartamento,
  atualizarUnidade,
  criarDepartamento,
  criarUnidade,
  listarDepartamentos,
  listarEmpresas,
  listarEmpresasMulti,
  listarUnidades,
} from "../../api/organizacaoClient";
import "./EstruturaOrganizacionalScreen.css";

export const ESTRUTURA_ORGANIZACIONAL_TITULO_ID =
  "estrutura-organizacional-titulo";

const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;

const VARIANTE_STATUS: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const ROTULO_STATUS: Record<string, string> = {
  ativo: "Ativa",
  inativo: "Inativa",
};

type StatusFiltro = "todos" | "ativo" | "inativo";
type AbaAtiva = "unidades" | "departamentos";

interface FormularioErros {
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioState {
  modo: "criar" | "editar";
  unidadeId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  erros: FormularioErros;
  salvando: boolean;
}

interface FormularioDepErros {
  empresaId?: string;
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioDepState {
  modo: "criar" | "editar";
  depId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  empresaId: string;
  erros: FormularioDepErros;
  salvando: boolean;
}

export function EstruturaOrganizacionalScreen() {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [unidades, setUnidades] = useState<UnidadeOrganizacionalApi[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaApi | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  const formTituloId = useId();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("unidades");

  const [statusDepCarregamento, setStatusDepCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [departamentos, setDepartamentos] = useState<DepartamentoApi[]>([]);
  const [empresasDep, setEmpresasDep] = useState<EmpresaApi[]>([]);
  const [filtroDepStatus, setFiltroDepStatus] = useState<StatusFiltro>("todos");
  const [formularioDep, setFormularioDep] = useState<FormularioDepState | null>(
    null,
  );
  const formDepTituloId = useId();

  const carregarDados = useCallback(async (status: StatusFiltro) => {
    setStatusCarregamento("carregando");
    try {
      const query: ListarUnidadesQuery = {};
      if (status !== "todos") query.status = status;
      const [empresaResp, unidadesResp] = await Promise.all([
        listarEmpresas(),
        listarUnidades(query),
      ]);
      setEmpresa(empresaResp.itens[0] ?? null);
      setUnidades(unidadesResp.itens);
      setStatusCarregamento("dados");
    } catch {
      setStatusCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    void carregarDados(filtroStatus);
  }, [filtroStatus, carregarDados]);

  const carregarDepartamentos = useCallback(async (status: StatusFiltro) => {
    setStatusDepCarregamento("carregando");
    try {
      const query: ListarDepartamentosQuery = {};
      if (status !== "todos") query.status = status;
      const [empresasResp, depsResp] = await Promise.all([
        listarEmpresasMulti(),
        listarDepartamentos(query),
      ]);
      setEmpresasDep(empresasResp.itens);
      setDepartamentos(depsResp.itens);
      setStatusDepCarregamento("dados");
    } catch {
      setStatusDepCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "departamentos") {
      void carregarDepartamentos(filtroDepStatus);
    }
  }, [abaAtiva, filtroDepStatus, carregarDepartamentos]);

  function abrirCriar() {
    setFormulario({
      modo: "criar",
      codigo: "",
      nome: "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditar(unidade: UnidadeOrganizacionalApi) {
    setFormulario({
      modo: "editar",
      unidadeId: unidade.id,
      codigoAtual: unidade.codigo,
      codigo: "",
      nome: unidade.nome,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  function validarCodigo(codigo: string): string | undefined {
    if (!codigo.trim()) return "Código é obrigatório.";
    if (!CODIGO_PATTERN.test(codigo))
      return "Código deve conter apenas letras maiúsculas, dígitos e _ (2 a 32 caracteres).";
    return undefined;
  }

  function validarNome(nome: string): string | undefined {
    if (!nome.trim()) return "Nome é obrigatório.";
    if (nome.trim().length > 160)
      return "Nome deve ter no máximo 160 caracteres.";
    return undefined;
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (formulario.modo === "criar") {
      const erroCodigo = validarCodigo(formulario.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formulario.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.codigo || erros.nome) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formulario.modo === "criar") {
        const dto: CriarUnidadeDto = {
          codigo: formulario.codigo.trim(),
          nome: formulario.nome.trim(),
          empresaId: empresa!.id,
        };
        await criarUnidade(dto);
      } else {
        const dto: AtualizarUnidadeDto = { nome: formulario.nome.trim() };
        await atualizarUnidade(formulario.unidadeId!, dto);
      }
      setFormulario(null);
      await carregarDados(filtroStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              salvando: false,
              erros: { ...prev.erros, geral: mensagem },
            }
          : prev,
      );
    }
  }

  const podeCriarDep =
    statusDepCarregamento === "dados" && empresasDep.length > 0;

  function abrirCriarDep() {
    setFormularioDep({
      modo: "criar",
      codigo: "",
      nome: "",
      empresaId: empresasDep.length === 1 ? (empresasDep[0]?.id ?? "") : "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditarDep(dep: DepartamentoApi) {
    setFormularioDep({
      modo: "editar",
      depId: dep.id,
      codigoAtual: dep.codigo,
      codigo: "",
      nome: dep.nome,
      empresaId: dep.empresaId,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormularioDep() {
    setFormularioDep(null);
  }

  async function handleSubmitDep(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formularioDep) return;

    const erros: FormularioDepErros = {};
    if (formularioDep.modo === "criar") {
      if (empresasDep.length > 1 && !formularioDep.empresaId) {
        erros.empresaId = "Selecione a empresa.";
      }
      const erroCodigo = validarCodigo(formularioDep.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formularioDep.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.empresaId ?? erros.codigo ?? erros.nome) {
      setFormularioDep((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormularioDep((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formularioDep.modo === "criar") {
        const dto: CriarDepartamentoDto = {
          codigo: formularioDep.codigo.trim(),
          nome: formularioDep.nome.trim(),
          empresaId: formularioDep.empresaId,
        };
        await criarDepartamento(dto);
      } else {
        const dto: AtualizarDepartamentoDto = {
          nome: formularioDep.nome.trim(),
        };
        await atualizarDepartamento(formularioDep.depId!, dto);
      }
      setFormularioDep(null);
      await carregarDepartamentos(filtroDepStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormularioDep((prev) =>
        prev
          ? {
              ...prev,
              salvando: false,
              erros: { ...prev.erros, geral: mensagem },
            }
          : prev,
      );
    }
  }

  const colunas: DataTableColumn<UnidadeOrganizacionalApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="secondary" onClick={() => abrirEditar(linha)}>
          Editar
        </Button>
      ),
    },
  ];

  const colunasDep: DataTableColumn<DepartamentoApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <Button variant="secondary" onClick={() => abrirEditarDep(linha)}>
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="estrutura-organizacional-screen">
      <PageHeader
        headingLevel={1}
        titleId={ESTRUTURA_ORGANIZACIONAL_TITULO_ID}
        title="Estrutura organizacional"
        description="Gerencie as unidades e departamentos organizacionais da sua empresa: cadastre, consulte e edite as referências de estrutura dentro do seu escopo."
        actions={
          abaAtiva === "unidades" ? (
            <Button
              onClick={abrirCriar}
              disabled={statusCarregamento !== "dados" || !empresa}
            >
              Nova unidade
            </Button>
          ) : (
            <Button onClick={abrirCriarDep} disabled={!podeCriarDep}>
              Novo departamento
            </Button>
          )
        }
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
          Somente o RH da própria empresa administra a estrutura organizacional.
          Todas as operações são restritas ao escopo da sua empresa e unidades
          autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="estrutura-organizacional-screen__aviso estrutura-organizacional-screen__aviso--auditado"
        aria-labelledby="estrutura-organizacional-aviso-auditado-titulo"
      >
        <StatusBadge variant="warning">Auditado</StatusBadge>
        <p
          id="estrutura-organizacional-aviso-auditado-titulo"
          className="estrutura-organizacional-screen__aviso-texto"
        >
          Cadastros e edições de unidades e departamentos organizacionais geram
          trilha de auditoria automática. Não é possível excluir — apenas
          inativar.
        </p>
      </Surface>

      <div
        className="estrutura-organizacional-screen__abas"
        role="tablist"
        aria-label="Categorias da estrutura organizacional"
      >
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "unidades" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "unidades"}
          onClick={() => setAbaAtiva("unidades")}
        >
          Unidades
        </button>
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "departamentos" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "departamentos"}
          onClick={() => setAbaAtiva("departamentos")}
        >
          Departamentos
        </button>
      </div>

      {abaAtiva === "unidades" ? (
        statusCarregamento === "erro" ? (
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
              Verifique sua conexão e tente novamente. Se o problema persistir,
              contate o suporte.
            </p>
            <Button
              variant="secondary"
              onClick={() => void carregarDados(filtroStatus)}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : (
          <section aria-labelledby="estrutura-organizacional-lista-titulo">
            <h2
              id="estrutura-organizacional-lista-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Unidades organizacionais
            </h2>

            <div className="estrutura-organizacional-screen__filtros">
              <FormField id="estrutura-filtro-status" label="Situação">
                {(control) => (
                  <select
                    value={filtroStatus}
                    onChange={(evento) =>
                      setFiltroStatus(evento.target.value as StatusFiltro)
                    }
                    disabled={statusCarregamento === "carregando"}
                    {...control}
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Inativa</option>
                  </select>
                )}
              </FormField>
            </div>

            {statusCarregamento === "carregando" ? (
              <p
                className="estrutura-organizacional-screen__carregando"
                role="status"
              >
                Carregando unidades…
              </p>
            ) : unidades.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma unidade organizacional cadastrada"
                description="Cadastre a primeira unidade organizacional para esta empresa."
                action={
                  empresa ? (
                    <Button onClick={abrirCriar}>Nova unidade</Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                caption="Unidades organizacionais"
                columns={colunas}
                rows={unidades}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        )
      ) : statusDepCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__erro"
          aria-labelledby="estrutura-dep-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="estrutura-dep-erro-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Não foi possível carregar os departamentos
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() => void carregarDepartamentos(filtroDepStatus)}
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="estrutura-dep-lista-titulo">
          <h2
            id="estrutura-dep-lista-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Departamentos
          </h2>

          <div className="estrutura-organizacional-screen__filtros">
            <FormField id="estrutura-dep-filtro-status" label="Situação">
              {(control) => (
                <select
                  value={filtroDepStatus}
                  onChange={(evento) =>
                    setFiltroDepStatus(evento.target.value as StatusFiltro)
                  }
                  disabled={statusDepCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas as situações</option>
                  <option value="ativo">Ativa</option>
                  <option value="inativo">Inativa</option>
                </select>
              )}
            </FormField>
          </div>

          {statusDepCarregamento === "carregando" ? (
            <p
              className="estrutura-organizacional-screen__carregando"
              role="status"
            >
              Carregando departamentos…
            </p>
          ) : departamentos.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum departamento cadastrado"
              description="Cadastre o primeiro departamento para esta empresa."
              action={
                podeCriarDep ? (
                  <Button onClick={abrirCriarDep}>Novo departamento</Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              caption="Departamentos"
              columns={colunasDep}
              rows={departamentos}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formulario ? (
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
            {formulario.modo === "criar"
              ? "Nova unidade organizacional"
              : "Editar unidade organizacional"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formulario.modo === "criar"
                ? "Formulário de nova unidade organizacional"
                : "Formulário de edição de unidade organizacional"
            }
            onSubmit={(e) => void handleSubmit(e)}
          >
            {formulario.modo === "criar" ? (
              <FormField
                id="estrutura-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formulario.erros.codigo
                  ? { error: formulario.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: UNID_SP"
                    value={formulario.codigo}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formulario.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-nome"
              label="Nome"
              required
              help="Identificador da unidade. Máximo 160 caracteres."
              {...(formulario.erros.nome
                ? { error: formulario.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formulario.nome}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
                onClick={fecharFormulario}
                disabled={formulario.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formulario.salvando}
              >
                {formulario.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {formularioDep ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formDepTituloId}
        >
          <h2
            id={formDepTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            {formularioDep.modo === "criar"
              ? "Novo departamento"
              : "Editar departamento"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formularioDep.modo === "criar"
                ? "Formulário de novo departamento"
                : "Formulário de edição de departamento"
            }
            onSubmit={(e) => void handleSubmitDep(e)}
          >
            {formularioDep.modo === "criar" && empresasDep.length > 1 ? (
              <FormField
                id="estrutura-dep-empresa"
                label="Empresa"
                required
                {...(formularioDep.erros.empresaId
                  ? { error: formularioDep.erros.empresaId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formularioDep.empresaId}
                    onChange={(e) =>
                      setFormularioDep((prev) =>
                        prev
                          ? { ...prev, empresaId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione a empresa</option>
                    {empresasDep.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formularioDep.modo === "criar" ? (
              <FormField
                id="estrutura-dep-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formularioDep.erros.codigo
                  ? { error: formularioDep.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: FIN"
                    value={formularioDep.codigo}
                    onChange={(e) =>
                      setFormularioDep((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-dep-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formularioDep.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-dep-nome"
              label="Nome"
              required
              help="Identificador do departamento. Máximo 160 caracteres."
              {...(formularioDep.erros.nome
                ? { error: formularioDep.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formularioDep.nome}
                  onChange={(e) =>
                    setFormularioDep((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formularioDep.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formularioDep.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
                onClick={fecharFormularioDep}
                disabled={formularioDep.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formularioDep.salvando}
              >
                {formularioDep.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
