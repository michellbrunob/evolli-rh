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
import { AcaoSituacao } from "./AcaoSituacao";
import {
  type AtualizarCentroCustoDto,
  type CentroCustoApi,
  type CriarCentroCustoDto,
  type EmpresaApi,
  type ListarCentrosCustoQuery,
  atualizarCentroCusto,
  criarCentroCusto,
  inativarCentroCusto,
  listarCentrosCusto,
  reativarCentroCusto,
  listarEmpresasParaCentroCusto,
} from "../../api/organizacaoClient";
import "./CentrosCustoScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";

export const CENTROS_CUSTO_TITULO_ID = "centros-custo-titulo";

const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;

const VARIANTE_STATUS: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const ROTULO_STATUS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

type StatusFiltro = "todos" | "ativo" | "inativo";

interface FormularioErros {
  empresaId?: string;
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioState {
  modo: "criar" | "editar";
  centroCustoId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  empresaId: string;
  erros: FormularioErros;
  salvando: boolean;
}

export interface CentrosCustoScreenProps {
  /**
   * T182 — o perfil OPERA os centros de custo (criar, editar, inativar e reativar):
   * `rh` e `master_tecnico` (ver `podeOperarEstrutura`). Sem isso a tela é só
   * consulta: nenhum controle de escrita aparece. Só orienta a tela — quem
   * recusa é o servidor.
   */
  readonly podeOperar?: boolean;
}

export function CentrosCustoScreen({
  podeOperar = false,
}: CentrosCustoScreenProps) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoApi[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaApi[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  // T189 — formulário aberto conta como edição em andamento, e envio como
  // salvamento: a troca de empresa pergunta antes de descartar, e espera
  // o envio terminar.
  useEdicaoEmAndamento("Centros de custo", {
    pendente: formulario !== null,
    salvando: formulario?.salvando === true,
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const formTituloId = useId();

  const carregarDados = useCallback(async (status: StatusFiltro) => {
    setStatusCarregamento("carregando");
    try {
      const query: ListarCentrosCustoQuery = {};
      if (status !== "todos") query.status = status;
      const [empresaResp, centrosResp] = await Promise.all([
        listarEmpresasParaCentroCusto(),
        listarCentrosCusto(query),
      ]);
      setEmpresas(empresaResp.itens);
      setCentrosCusto(centrosResp.itens);
      setStatusCarregamento("dados");
    } catch {
      setStatusCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    void carregarDados(filtroStatus);
  }, [filtroStatus, carregarDados]);

  function abrirCriar() {
    setFormulario({
      modo: "criar",
      codigo: "",
      nome: "",
      empresaId: empresas.length === 1 ? (empresas[0]?.id ?? "") : "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditar(cc: CentroCustoApi) {
    setFormulario({
      modo: "editar",
      centroCustoId: cc.id,
      codigoAtual: cc.codigo,
      codigo: "",
      nome: cc.nome,
      empresaId: cc.empresaId,
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
      if (empresas.length > 1 && !formulario.empresaId) {
        erros.empresaId = "Selecione a empresa.";
      }
      const erroCodigo = validarCodigo(formulario.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formulario.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.empresaId ?? erros.codigo ?? erros.nome) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formulario.modo === "criar") {
        const dto: CriarCentroCustoDto = {
          codigo: formulario.codigo.trim(),
          nome: formulario.nome.trim(),
          empresaId: formulario.empresaId,
        };
        await criarCentroCusto(dto);
      } else {
        const dto: AtualizarCentroCustoDto = { nome: formulario.nome.trim() };
        await atualizarCentroCusto(formulario.centroCustoId!, dto);
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

  const colunas: DataTableColumn<CentroCustoApi>[] = [
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
        <div className="centros-custo-screen__acoes">
          <Button variant="secondary" onClick={() => abrirEditar(linha)}>
            Editar
          </Button>
          <AcaoSituacao
            registro={linha}
            entidade="centro de custo"
            inativar={inativarCentroCusto}
            reativar={reativarCentroCusto}
            onConcluido={(atualizado, mensagem) => {
              // A lista reflete a mudança sem esconder a linha: o registro
              // continua visível, com a nova situação. Só o filtro do usuário
              // decide o que aparece, e por isso ele é recarregado quando não
              // é "todos" — a linha sairia da consulta, e mantê-la na tela
              // seria mostrar um resultado que o filtro já não contempla.
              setCentrosCusto((prev) =>
                prev.map((c) => (c.id === atualizado.id ? atualizado : c)),
              );
              setAviso(mensagem);
              if (filtroStatus !== "todos") void carregarDados(filtroStatus);
            }}
          />
        </div>
      ),
    },
  ];

  const podeCriar = statusCarregamento === "dados" && empresas.length > 0;

  /** T182 — sem `podeOperar`, a coluna de ações (editar, inativar e
   * reativar) não aparece. */
  function colunasVisiveis<T>(
    colunas: DataTableColumn<T>[],
  ): DataTableColumn<T>[] {
    return podeOperar ? colunas : colunas.filter((c) => c.key !== "acoes");
  }

  return (
    <div className="centros-custo-screen">
      <PageHeader
        headingLevel={1}
        titleId={CENTROS_CUSTO_TITULO_ID}
        title="Centros de custo"
        description={
          podeOperar
            ? "Gerencie os centros de custo da sua empresa: cadastre, consulte e edite dentro do seu escopo autorizado. Centro de custo é referência organizacional e não cria rateio, orçamento ou lançamento contábil."
            : "Consulte os centros de custo da sua empresa. Centro de custo é referência organizacional e não cria rateio, orçamento ou lançamento contábil."
        }
        actions={
          podeOperar ? (
            <Button onClick={abrirCriar} disabled={!podeCriar}>
              Novo centro de custo
            </Button>
          ) : undefined
        }
      />

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso"
        aria-labelledby="centros-custo-aviso-rh-titulo"
      >
        <StatusBadge variant="info">
          {podeOperar ? "Somente RH" : "Somente consulta"}
        </StatusBadge>
        <p
          id="centros-custo-aviso-rh-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          {podeOperar
            ? "Somente o RH da própria empresa administra centros de custo. Todas as operações são restritas ao escopo autorizado e não concedem permissão de acesso, alteram vínculo, remuneração, jornada, escala ou Banco de Horas."
            : "Você consulta os centros de custo da empresa ativa. Só o RH cria, edita e inativa centros de custo."}
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso centros-custo-screen__aviso--auditado"
        aria-labelledby="centros-custo-aviso-auditado-titulo"
      >
        <StatusBadge variant="warning">Auditado</StatusBadge>
        <p
          id="centros-custo-aviso-auditado-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          Cadastros e edições de centros de custo geram trilha de auditoria
          automática. Não é possível excluir um centro de custo — apenas
          inativar.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="centros-custo-screen__aviso centros-custo-screen__aviso--indisponivel"
        aria-labelledby="centros-custo-aviso-referencias-titulo"
      >
        <StatusBadge variant="warning">Referências organizacionais</StatusBadge>
        <p
          id="centros-custo-aviso-referencias-titulo"
          className="centros-custo-screen__aviso-texto"
        >
          Cargo, função, departamento, centro de custo e estrutura são
          referências distintas e não concedem permissão de acesso.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="centros-custo-screen__erro"
          aria-labelledby="centros-custo-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="centros-custo-erro-titulo"
            className="centros-custo-screen__section-title"
          >
            Não foi possível carregar os centros de custo
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
        <section aria-labelledby="centros-custo-lista-titulo">
          <h2
            id="centros-custo-lista-titulo"
            className="centros-custo-screen__section-title"
          >
            Centros de custo
          </h2>

          {aviso ? (
            <p className="centros-custo-screen__resultado" role="status">
              {aviso}
            </p>
          ) : null}

          <div className="centros-custo-screen__filtros">
            <FormField id="centros-custo-filtro-status" label="Situação">
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
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="centros-custo-screen__carregando" role="status">
              Carregando centros de custo…
            </p>
          ) : centrosCusto.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum centro de custo cadastrado"
              description="Cadastre o primeiro centro de custo para esta empresa."
              action={
                podeOperar && podeCriar ? (
                  <Button onClick={abrirCriar}>Novo centro de custo</Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              caption="Centros de custo"
              columns={colunasVisiveis(colunas)}
              rows={centrosCusto}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="centros-custo-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="centros-custo-screen__section-title">
            {formulario.modo === "criar"
              ? "Novo centro de custo"
              : "Editar centro de custo"}
          </h2>

          <form
            className="centros-custo-screen__form"
            aria-label={
              formulario.modo === "criar"
                ? "Formulário de novo centro de custo"
                : "Formulário de edição de centro de custo"
            }
            onSubmit={(e) => void handleSubmit(e)}
          >
            {formulario.modo === "criar" && empresas.length > 1 ? (
              <FormField
                id="centros-custo-empresa"
                label="Empresa"
                required
                {...(formulario.erros.empresaId
                  ? { error: formulario.erros.empresaId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.empresaId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? { ...prev, empresaId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione a empresa</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formulario.modo === "criar" ? (
              <FormField
                id="centros-custo-codigo"
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
                    placeholder="Ex.: CC_ADM"
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
              <FormField id="centros-custo-codigo-fixo" label="Código">
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
              id="centros-custo-nome"
              label="Nome"
              required
              help="Identificador do centro de custo. Máximo 160 caracteres."
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
              <p className="centros-custo-screen__form-erro" role="alert">
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
    </div>
  );
}
