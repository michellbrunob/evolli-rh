/**
 * Administração > Contas de acesso (T121) — interface web funcional sobre o
 * contrato já existente e testado de gestão de contas (T120): `GET
 * /v1/users/me`, `GET /v1/users`, `POST /v1/users`, `PATCH
 * /v1/users/:id/role` e `POST /v1/users/:id/disable`. Nenhum endpoint,
 * schema, migration, dependência ou regra de autorização nova — esta tela
 * só consome o que o backend já concede a cada papel.
 *
 * **O backend continua sendo a autoridade final.** `GET /v1/users/me` é lido
 * apenas para ORIENTAR quais controles esta tela oferece (criar, alterar
 * papel, desativar) — nunca para decidir sozinha se uma ação é permitida.
 * Toda mutação passa de novo pelo `AuthorizationGuard` no servidor,
 * independentemente do que esta tela decidiu mostrar; um 403 do servidor é
 * sempre a decisão que vale.
 *
 * **Diferença de interface por papel** (reflete exatamente `rbac.evaluator.ts`):
 * - `master_tecnico`: lista qualquer empresa (filtro opcional), cria conta,
 *   altera papel e desativa em qualquer empresa.
 * - `rh`: lista, cria, altera papel e desativa — só na própria empresa
 *   (nunca escolhida no navegador: vem sempre de `GET /v1/users/me`).
 * - `dp`: lista e desativa — só na própria empresa. NUNCA vê os controles de
 *   criar conta ou alterar papel (o backend nega isso a `dp` com 403; esta
 *   tela nem oferece o botão).
 * - Qualquer outro papel: a tela mostra "Sem permissão" e não chega a
 *   chamar `GET /v1/users` — `evaluatePermission("other_account","read")`
 *   negaria de qualquer forma, mas não há motivo para tentar.
 *
 * **Nunca oferecidos, por desenho** (não por validação de formulário):
 * - Alterar o próprio papel ou desativar a própria conta — a linha do ator
 *   autenticado nunca mostra essas ações (o backend também nega, mas esta
 *   tela nem propõe).
 * - Criar ou atribuir um papel privilegiado (`master_tecnico`,
 *   `admin_tecnico`, `dpo`, `auditor`) — os selects de papel só oferecem
 *   `PAPEIS_COMUNS`.
 * - Reativar ou excluir conta — nenhum dos dois endpoints existe no
 *   backend.
 * - Campo de ID digitado à mão — toda ação usa exclusivamente o `id` que já
 *   veio de `GET /v1/users` na própria listagem.
 * - Convite por e-mail, reset de senha ou sessão administrativa — fora do
 *   contrato desta entrega. O MFA está implementado, porém OPCIONAL no
 *   lançamento inicial (T131): as ações de MFA (ex.: "Redefinir MFA") só
 *   aparecem quando o servidor informa `mfaAvailable` em `GET /v1/users/me`;
 *   torná-lo obrigatório depende de gates operacionais externos (aviso fixo na
 *   tela).
 *
 * **Empresa no formulário de criação:** para `rh`, é sempre
 * `ator.companyId` (oculta, nunca um campo escolhido). Para
 * `master_tecnico`, usa `listarEmpresasMulti()` (já existente,
 * `organizacaoClient.ts`) — que o backend já escopa por ator (T037/ADR
 * 0006): um `rh` receberia dali só a própria empresa; só por isso o
 * `master_tecnico` (que recebe todas) precisa de um select.
 */
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
  ApiError,
  PAPEIS_COMUNS,
  ROTULO_PAPEL,
  ROTULO_STATUS,
  type ListarUsuariosQuery,
  type PapelComum,
  type SafeAccessUserApi,
  type StatusContaApi,
  alterarPapel,
  criarConta,
  desativarConta,
  listarUsuarios,
  obterUsuarioAtual,
  resetarMfa,
} from "../../api/usersClient";
import {
  type EmpresaApi,
  listarEmpresasMulti,
} from "../../api/organizacaoClient";
import { formatarInstante } from "../../format/data";
import "./ContasAcessoScreen.css";

export const CONTAS_ACESSO_TITULO_ID = "contas-acesso-titulo";

const LIMITE_PAGINA = 25;

const VARIANTE_STATUS: Record<StatusContaApi, StatusVariant> = {
  active: "success",
  disabled: "neutral",
  locked: "warning",
};

function ehPapelComum(role: string): role is PapelComum {
  return (PAPEIS_COMUNS as readonly string[]).includes(role);
}

interface FormularioErros {
  email?: string;
  password?: string;
  role?: string;
  empresaId?: string;
  geral?: string;
}

interface FormularioContaState {
  email: string;
  password: string;
  role: PapelComum | "";
  empresaId: string;
  precisaEscolherEmpresa: boolean;
  carregandoEmpresa: boolean;
  erros: FormularioErros;
  salvando: boolean;
}

interface EdicaoPapelState {
  id: string;
  email: string;
  novoPapel: PapelComum;
  salvando: boolean;
  erro: string | null;
}

interface ConfirmacaoDesativacaoState {
  id: string;
  email: string;
  desativando: boolean;
  erro: string | null;
}

interface ConfirmacaoResetMfaState {
  id: string;
  email: string;
  resetando: boolean;
  erro: string | null;
}

export interface ContasAcessoScreenProps {
  /** Chamado quando qualquer chamada desta tela descobre (via 401) que a
   * sessão não é mais válida. A tela limpa só o próprio estado em memória —
   * quem decide voltar ao login é o `AutenticacaoApp`, pelo mesmo caminho já
   * usado por `SessoesAtivasPanel` (T117). */
  onSessaoAtualEncerrada?: () => void;
}

export function ContasAcessoScreen({
  onSessaoAtualEncerrada,
}: ContasAcessoScreenProps = {}) {
  const [statusAtor, setStatusAtor] = useState<
    "carregando" | "erro" | "pronto"
  >("carregando");
  const [ator, setAtor] = useState<SafeAccessUserApi | null>(null);

  const [empresasMaster, setEmpresasMaster] = useState<EmpresaApi[]>([]);

  const [filtroStatus, setFiltroStatus] = useState<StatusContaApi | "todos">(
    "todos",
  );
  const [filtroRole, setFiltroRole] = useState<PapelComum | "todos">("todos");
  const [filtroEmpresaId, setFiltroEmpresaId] = useState("");

  const [statusLista, setStatusLista] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [itens, setItens] = useState<SafeAccessUserApi[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorAtual, setCursorAtual] = useState<string | null>(null);
  const [pilhaCursors, setPilhaCursors] = useState<(string | null)[]>([]);

  const [formulario, setFormulario] = useState<FormularioContaState | null>(
    null,
  );
  const [edicaoPapel, setEdicaoPapel] = useState<EdicaoPapelState | null>(null);
  const [confirmacaoDesativacao, setConfirmacaoDesativacao] =
    useState<ConfirmacaoDesativacaoState | null>(null);
  const [confirmacaoResetMfa, setConfirmacaoResetMfa] =
    useState<ConfirmacaoResetMfaState | null>(null);

  const formTituloId = useId();
  const edicaoTituloId = useId();
  const confirmacaoTituloId = useId();
  const resetMfaTituloId = useId();

  const podeVerTela =
    ator !== null &&
    (ator.role === "master_tecnico" ||
      ator.role === "rh" ||
      ator.role === "dp");
  const podeCriarOuAlterarPapel =
    ator !== null && (ator.role === "master_tecnico" || ator.role === "rh");
  const podeDesativar = podeVerTela;
  // Redefinição administrativa de MFA: só master_tecnico e RH (contrato T125);
  // DP NÃO. Além disso (T131), só quando o SERVIDOR informa que o MFA está
  // disponível (`mfaAvailable`) — com o MFA desativado no lançamento inicial, a
  // ação some. O backend é a autoridade final: com MFA desativado a rota
  // responde 404, e se negar por papel/escopo, mostramos erro genérico.
  const podeResetarMfa = podeCriarOuAlterarPapel && ator?.mfaAvailable === true;

  const tratarErroSessao = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.status === 401) {
        onSessaoAtualEncerrada?.();
        return true;
      }
      return false;
    },
    [onSessaoAtualEncerrada],
  );

  const carregarAtor = useCallback(async () => {
    setStatusAtor("carregando");
    try {
      const usuario = await obterUsuarioAtual();
      setAtor(usuario);
      setStatusAtor("pronto");
    } catch (err) {
      if (tratarErroSessao(err)) return;
      setStatusAtor("erro");
    }
  }, [tratarErroSessao]);

  useEffect(() => {
    void carregarAtor();
  }, [carregarAtor]);

  // Só o master_tecnico precisa de uma lista de empresas (filtro da
  // listagem + select do formulário de criação): `GET /v1/empresas` já vem
  // escopado pelo backend (rh/dp recebem só a própria empresa) — por isso
  // não há necessidade de chamá-lo para eles.
  useEffect(() => {
    if (ator?.role !== "master_tecnico") return;
    let cancelado = false;
    (async () => {
      try {
        const resp = await listarEmpresasMulti();
        if (!cancelado) setEmpresasMaster(resp.itens);
      } catch {
        // Falha ao carregar empresas não impede a listagem de contas — só
        // o filtro e o formulário de criação ficam sem a lista amigável.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ator]);

  const carregarLista = useCallback(
    async (cursor: string | null) => {
      if (ator === null || !podeVerTela) return;
      setStatusLista("carregando");
      try {
        const query: ListarUsuariosQuery = { limit: LIMITE_PAGINA };
        if (filtroStatus !== "todos") query.status = filtroStatus;
        if (filtroRole !== "todos") query.role = filtroRole;
        if (ator.role === "master_tecnico" && filtroEmpresaId !== "") {
          query.companyId = filtroEmpresaId;
        }
        if (cursor !== null) query.cursor = cursor;
        const resultado = await listarUsuarios(query);
        setItens(resultado.items);
        setNextCursor(resultado.nextCursor);
        setStatusLista("dados");
      } catch (err) {
        if (tratarErroSessao(err)) return;
        setStatusLista("erro");
      }
    },
    [
      ator,
      podeVerTela,
      filtroStatus,
      filtroRole,
      filtroEmpresaId,
      tratarErroSessao,
    ],
  );

  // Qualquer mudança de filtro reinicia a paginação (primeira página).
  useEffect(() => {
    if (ator === null || !podeVerTela) return;
    setCursorAtual(null);
    setPilhaCursors([]);
    void carregarLista(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ator, podeVerTela, filtroStatus, filtroRole, filtroEmpresaId]);

  function irParaProximaPagina() {
    if (nextCursor === null) return;
    setPilhaCursors((pilha) => [...pilha, cursorAtual]);
    setCursorAtual(nextCursor);
    void carregarLista(nextCursor);
  }

  function irParaPaginaAnterior() {
    setPilhaCursors((pilha) => {
      if (pilha.length === 0) return pilha;
      const anterior = pilha[pilha.length - 1] ?? null;
      setCursorAtual(anterior);
      void carregarLista(anterior);
      return pilha.slice(0, -1);
    });
  }

  async function abrirFormularioCriacao() {
    if (ator === null) return;
    setEdicaoPapel(null);
    setConfirmacaoDesativacao(null);

    if (ator.role === "master_tecnico") {
      setFormulario({
        email: "",
        password: "",
        role: "",
        empresaId: "",
        precisaEscolherEmpresa: true,
        carregandoEmpresa: empresasMaster.length === 0,
        erros: {},
        salvando: false,
      });
      if (empresasMaster.length > 0) return;
      try {
        const resp = await listarEmpresasMulti();
        setEmpresasMaster(resp.itens);
        setFormulario((prev) =>
          prev
            ? {
                ...prev,
                empresaId:
                  resp.itens.length === 1 ? (resp.itens[0]?.id ?? "") : "",
                carregandoEmpresa: false,
              }
            : prev,
        );
      } catch {
        setFormulario((prev) =>
          prev
            ? {
                ...prev,
                carregandoEmpresa: false,
                erros: {
                  geral:
                    "Não foi possível carregar as empresas. Feche e tente novamente.",
                },
              }
            : prev,
        );
      }
      return;
    }

    // rh: a empresa é sempre a própria — derivada de GET /v1/users/me,
    // nunca escolhida no navegador.
    setFormulario({
      email: "",
      password: "",
      role: "",
      empresaId: ator.companyId ?? "",
      precisaEscolherEmpresa: false,
      carregandoEmpresa: false,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormularioCriacao() {
    setFormulario(null);
  }

  function validarFormulario(f: FormularioContaState): FormularioErros {
    const erros: FormularioErros = {};
    if (!f.email.trim()) erros.email = "Informe o e-mail.";
    if (f.password.length < 15) {
      erros.password = "A senha deve ter pelo menos 15 caracteres.";
    }
    if (f.role === "") erros.role = "Selecione um papel.";
    if (!f.empresaId) erros.empresaId = "Selecione a empresa.";
    return erros;
  }

  function mensagemErroCriacao(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 422) {
        return "Senha não atende aos requisitos mínimos (mínimo 15 caracteres, sem padrões comuns).";
      }
      if (err.status === 403) {
        return "Você não tem permissão para criar esta conta.";
      }
      return "Não foi possível criar a conta. Tente novamente em instantes.";
    }
    return "Não foi possível criar a conta. Verifique sua conexão e tente novamente.";
  }

  async function handleSubmitCriacao(evento: React.FormEvent) {
    evento.preventDefault();
    if (formulario === null || formulario.salvando) return;

    const erros = validarFormulario(formulario);
    if (Object.keys(erros).length > 0) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );
    try {
      await criarConta({
        email: formulario.email.trim(),
        password: formulario.password,
        role: formulario.role as PapelComum,
        companyId: formulario.empresaId,
      });
      setFormulario(null);
      setCursorAtual(null);
      setPilhaCursors([]);
      await carregarLista(null);
    } catch (err) {
      if (tratarErroSessao(err)) return;
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              salvando: false,
              erros: { geral: mensagemErroCriacao(err) },
            }
          : prev,
      );
    }
  }

  function abrirEdicaoPapel(usuario: SafeAccessUserApi) {
    setFormulario(null);
    setConfirmacaoDesativacao(null);
    setEdicaoPapel({
      id: usuario.id,
      email: usuario.email,
      novoPapel: ehPapelComum(usuario.role) ? usuario.role : "colaborador",
      salvando: false,
      erro: null,
    });
  }

  function fecharEdicaoPapel() {
    setEdicaoPapel(null);
  }

  function mensagemErroPapel(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return "Você não tem permissão para alterar o papel desta conta.";
      }
      if (err.status === 404) {
        return "Esta conta não foi encontrada. Atualize a lista e tente novamente.";
      }
      return "Não foi possível alterar o papel. Tente novamente em instantes.";
    }
    return "Não foi possível alterar o papel. Verifique sua conexão e tente novamente.";
  }

  async function handleSalvarPapel() {
    if (edicaoPapel === null || edicaoPapel.salvando) return;
    setEdicaoPapel((prev) =>
      prev ? { ...prev, salvando: true, erro: null } : prev,
    );
    try {
      await alterarPapel(edicaoPapel.id, edicaoPapel.novoPapel);
      setEdicaoPapel(null);
      await carregarLista(cursorAtual);
    } catch (err) {
      if (tratarErroSessao(err)) return;
      setEdicaoPapel((prev) =>
        prev
          ? { ...prev, salvando: false, erro: mensagemErroPapel(err) }
          : prev,
      );
    }
  }

  function abrirConfirmacaoDesativacao(usuario: SafeAccessUserApi) {
    setFormulario(null);
    setEdicaoPapel(null);
    setConfirmacaoDesativacao({
      id: usuario.id,
      email: usuario.email,
      desativando: false,
      erro: null,
    });
  }

  function fecharConfirmacaoDesativacao() {
    setConfirmacaoDesativacao(null);
  }

  async function handleConfirmarDesativacao() {
    if (confirmacaoDesativacao === null || confirmacaoDesativacao.desativando) {
      return;
    }
    setConfirmacaoDesativacao((prev) =>
      prev ? { ...prev, desativando: true, erro: null } : prev,
    );
    try {
      await desativarConta(confirmacaoDesativacao.id);
      setConfirmacaoDesativacao(null);
      await carregarLista(cursorAtual);
    } catch (err) {
      if (tratarErroSessao(err)) return;
      setConfirmacaoDesativacao((prev) =>
        prev
          ? {
              ...prev,
              desativando: false,
              erro: "Não foi possível desativar a conta. Tente novamente.",
            }
          : prev,
      );
    }
  }

  function abrirConfirmacaoResetMfa(usuario: SafeAccessUserApi) {
    setFormulario(null);
    setEdicaoPapel(null);
    setConfirmacaoDesativacao(null);
    setConfirmacaoResetMfa({
      id: usuario.id,
      email: usuario.email,
      resetando: false,
      erro: null,
    });
  }

  function fecharConfirmacaoResetMfa() {
    setConfirmacaoResetMfa(null);
  }

  function mensagemErroResetMfa(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return "Você não tem permissão para redefinir o MFA desta conta.";
      }
      if (err.status === 404) {
        return "Esta conta não foi encontrada. Atualize a lista e tente novamente.";
      }
      return "Não foi possível redefinir o MFA. Tente novamente em instantes.";
    }
    return "Não foi possível redefinir o MFA. Verifique sua conexão e tente novamente.";
  }

  async function handleConfirmarResetMfa() {
    if (confirmacaoResetMfa === null || confirmacaoResetMfa.resetando) return;
    setConfirmacaoResetMfa((prev) =>
      prev ? { ...prev, resetando: true, erro: null } : prev,
    );
    try {
      await resetarMfa(confirmacaoResetMfa.id);
      setConfirmacaoResetMfa(null);
      await carregarLista(cursorAtual);
    } catch (err) {
      if (tratarErroSessao(err)) return;
      setConfirmacaoResetMfa((prev) =>
        prev
          ? { ...prev, resetando: false, erro: mensagemErroResetMfa(err) }
          : prev,
      );
    }
  }

  const nomeEmpresaPorId = new Map(
    empresasMaster.map((empresa) => [empresa.id, empresa.nome]),
  );

  const mostrarColunaEmpresa = ator?.role === "master_tecnico";

  const colunas: DataTableColumn<SafeAccessUserApi>[] = [
    { key: "email", header: "E-mail", cell: (u) => u.email },
    {
      key: "papel",
      header: "Papel",
      cell: (u) => ROTULO_PAPEL[u.role] ?? u.role,
    },
    ...(mostrarColunaEmpresa
      ? [
          {
            key: "empresa",
            header: "Empresa",
            cell: (u: SafeAccessUserApi) =>
              u.companyId
                ? (nomeEmpresaPorId.get(u.companyId) ?? u.companyId)
                : "—",
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <StatusBadge
          variant={VARIANTE_STATUS[u.status as StatusContaApi] ?? "neutral"}
        >
          {ROTULO_STATUS[u.status as StatusContaApi] ?? u.status}
        </StatusBadge>
      ),
    },
    {
      // `AccessUser.createdAt` é INSTANTE (`DateTime` sem `@db.Date`), então
      // vai pelo `formatarInstante`, que converte para `America/Sao_Paulo`.
      // Antes da T154 esta célula fatiava o ISO em UTC e exibia três horas a
      // mais — o formatador local que fazia isso era cópia literal do de
      // `SessoesAtivasPanel`, com outro nome.
      key: "criada",
      header: "Criada em",
      cell: (u) => formatarInstante(u.createdAt),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (u) => {
        // Nunca oferece alterar o próprio papel nem desativar a própria
        // conta — mesmo que o ator tenha capacidade administrativa, esta
        // linha específica (a dele mesmo) nunca mostra ação nenhuma.
        if (ator !== null && u.id === ator.id) {
          return (
            <span className="contas-acesso-screen__sua-conta">Sua conta</span>
          );
        }
        return (
          <div className="contas-acesso-screen__acoes-linha">
            {podeCriarOuAlterarPapel ? (
              <Button variant="secondary" onClick={() => abrirEdicaoPapel(u)}>
                Alterar papel
              </Button>
            ) : null}
            {podeDesativar && u.status === "active" ? (
              <Button
                variant="secondary"
                onClick={() => abrirConfirmacaoDesativacao(u)}
              >
                Desativar
              </Button>
            ) : null}
            {podeResetarMfa ? (
              <Button
                variant="secondary"
                onClick={() => abrirConfirmacaoResetMfa(u)}
              >
                Redefinir MFA
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="contas-acesso-screen">
      <PageHeader
        headingLevel={1}
        titleId={CONTAS_ACESSO_TITULO_ID}
        title="Contas de acesso"
        description="Crie, altere o papel e desative contas de acesso ao Painel Administrativo — sempre dentro do escopo que o backend concede à sua conta."
        actions={
          podeCriarOuAlterarPapel ? (
            <Button onClick={() => void abrirFormularioCriacao()}>
              Nova conta
            </Button>
          ) : undefined
        }
      />

      <Surface
        as="section"
        padding="md"
        className="contas-acesso-screen__aviso-mfa"
        aria-labelledby="contas-acesso-mfa-titulo"
      >
        <StatusBadge variant="warning">Limite de operação</StatusBadge>
        <p
          id="contas-acesso-mfa-titulo"
          className="contas-acesso-screen__aviso-texto"
        >
          O MFA está implementado, porém opcional no lançamento inicial
          (aceitação de risco de produto). Torná-lo obrigatório depende de gates
          operacionais externos (cofre de segredos e break-glass) e da decisão
          de rollout; esta tela não os substitui. As ações de MFA aparecem
          apenas quando o servidor as habilita.
        </p>
      </Surface>

      {statusAtor === "carregando" ? (
        <p className="contas-acesso-screen__carregando" role="status">
          Carregando…
        </p>
      ) : statusAtor === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="contas-acesso-screen__erro"
          aria-labelledby="contas-acesso-erro-ator-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="contas-acesso-erro-ator-titulo"
            className="contas-acesso-screen__section-title"
          >
            Não foi possível identificar sua conta
          </h2>
          <p>Verifique sua conexão e tente novamente.</p>
          <Button variant="secondary" onClick={() => void carregarAtor()}>
            Tentar novamente
          </Button>
        </Surface>
      ) : !podeVerTela ? (
        <EmptyState
          headingLevel={2}
          icon="—"
          title="Sem permissão"
          description="Sua conta não tem permissão para gerenciar contas de acesso."
        />
      ) : (
        <>
          <div className="contas-acesso-screen__filtros">
            <FormField id="contas-acesso-filtro-status" label="Status">
              {(control) => (
                <select
                  value={filtroStatus}
                  onChange={(e) =>
                    setFiltroStatus(e.target.value as StatusContaApi | "todos")
                  }
                  disabled={statusLista === "carregando"}
                  {...control}
                >
                  <option value="todos">Todos os status</option>
                  <option value="active">Ativa</option>
                  <option value="disabled">Desativada</option>
                  <option value="locked">Bloqueada</option>
                </select>
              )}
            </FormField>

            <FormField id="contas-acesso-filtro-papel" label="Papel">
              {(control) => (
                <select
                  value={filtroRole}
                  onChange={(e) =>
                    setFiltroRole(e.target.value as PapelComum | "todos")
                  }
                  disabled={statusLista === "carregando"}
                  {...control}
                >
                  <option value="todos">Todos os papéis</option>
                  {PAPEIS_COMUNS.map((papel) => (
                    <option key={papel} value={papel}>
                      {ROTULO_PAPEL[papel]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {ator?.role === "master_tecnico" && empresasMaster.length > 1 ? (
              <FormField id="contas-acesso-filtro-empresa" label="Empresa">
                {(control) => (
                  <select
                    value={filtroEmpresaId}
                    onChange={(e) => setFiltroEmpresaId(e.target.value)}
                    disabled={statusLista === "carregando"}
                    {...control}
                  >
                    <option value="">Todas as empresas</option>
                    {empresasMaster.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}
          </div>

          {statusLista === "erro" ? (
            <Surface
              as="section"
              padding="lg"
              className="contas-acesso-screen__erro"
              aria-labelledby="contas-acesso-erro-lista-titulo"
            >
              <StatusBadge variant="danger">Erro</StatusBadge>
              <h2
                id="contas-acesso-erro-lista-titulo"
                className="contas-acesso-screen__section-title"
              >
                Não foi possível carregar as contas de acesso
              </h2>
              <p>Verifique sua conexão e tente novamente.</p>
              <Button
                variant="secondary"
                onClick={() => void carregarLista(cursorAtual)}
              >
                Tentar novamente
              </Button>
            </Surface>
          ) : statusLista === "carregando" ? (
            <p className="contas-acesso-screen__carregando" role="status">
              Carregando contas…
            </p>
          ) : itens.length === 0 ? (
            <EmptyState
              headingLevel={2}
              icon="—"
              title="Nenhuma conta encontrada"
              description="Ajuste os filtros ou crie uma nova conta."
            />
          ) : (
            <>
              <DataTable
                caption="Contas de acesso"
                columns={colunas}
                rows={itens}
                rowKey={(u) => u.id}
              />
              <div className="contas-acesso-screen__paginacao">
                <Button
                  variant="secondary"
                  onClick={irParaPaginaAnterior}
                  disabled={pilhaCursors.length === 0}
                >
                  Página anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={irParaProximaPagina}
                  disabled={nextCursor === null}
                >
                  Próxima página
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="contas-acesso-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="contas-acesso-screen__section-title">
            Nova conta de acesso
          </h2>

          <form
            className="contas-acesso-screen__form"
            aria-label="Formulário de nova conta de acesso"
            onSubmit={(e) => void handleSubmitCriacao(e)}
          >
            <FormField
              id="contas-acesso-form-email"
              label="E-mail"
              required
              {...(formulario.erros.email
                ? { error: formulario.erros.email }
                : {})}
            >
              {(control) => (
                <input
                  type="email"
                  autoComplete="off"
                  value={formulario.email}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, email: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="contas-acesso-form-senha"
              label="Senha inicial"
              required
              help="Mínimo de 15 caracteres."
              {...(formulario.erros.password
                ? { error: formulario.erros.password }
                : {})}
            >
              {(control) => (
                <input
                  type="password"
                  autoComplete="new-password"
                  value={formulario.password}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, password: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="contas-acesso-form-papel"
              label="Papel da nova conta"
              required
              {...(formulario.erros.role
                ? { error: formulario.erros.role }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.role}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            role: e.target.value as PapelComum | "",
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {PAPEIS_COMUNS.map((papel) => (
                    <option key={papel} value={papel}>
                      {ROTULO_PAPEL[papel]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {formulario.precisaEscolherEmpresa ? (
              formulario.carregandoEmpresa ? (
                <p role="status">Carregando empresas…</p>
              ) : (
                <FormField
                  id="contas-acesso-form-empresa"
                  label="Empresa da nova conta"
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
                      <option value="">Selecione…</option>
                      {empresasMaster.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              )
            ) : null}

            {formulario.erros.geral ? (
              <p className="contas-acesso-screen__form-erro" role="alert">
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={fecharFormularioCriacao}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={formulario.salvando}>
                {formulario.salvando ? "Criando…" : "Criar conta"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {edicaoPapel ? (
        <Surface
          as="section"
          padding="lg"
          className="contas-acesso-screen__formulario"
          aria-labelledby={edicaoTituloId}
        >
          <h2
            id={edicaoTituloId}
            className="contas-acesso-screen__section-title"
          >
            Alterar papel — {edicaoPapel.email}
          </h2>
          <p className="contas-acesso-screen__aviso-texto">
            Só o papel é alterado. Empresa, unidade e equipe permanecem sempre
            as mesmas.
          </p>

          <FormField
            id="contas-acesso-edicao-papel"
            label="Novo papel"
            required
          >
            {(control) => (
              <select
                value={edicaoPapel.novoPapel}
                onChange={(e) =>
                  setEdicaoPapel((prev) =>
                    prev
                      ? { ...prev, novoPapel: e.target.value as PapelComum }
                      : prev,
                  )
                }
                {...control}
              >
                {PAPEIS_COMUNS.map((papel) => (
                  <option key={papel} value={papel}>
                    {ROTULO_PAPEL[papel]}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          {edicaoPapel.erro ? (
            <p className="contas-acesso-screen__form-erro" role="alert">
              {edicaoPapel.erro}
            </p>
          ) : null}

          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={fecharEdicaoPapel}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSalvarPapel()}
              disabled={edicaoPapel.salvando}
            >
              {edicaoPapel.salvando ? "Salvando…" : "Salvar papel"}
            </Button>
          </FormActions>
        </Surface>
      ) : null}

      {confirmacaoDesativacao ? (
        <Surface
          as="section"
          padding="lg"
          className="contas-acesso-screen__formulario"
          aria-labelledby={confirmacaoTituloId}
        >
          <h2
            id={confirmacaoTituloId}
            className="contas-acesso-screen__section-title"
          >
            Desativar conta — {confirmacaoDesativacao.email}
          </h2>
          <p role="alert" className="contas-acesso-screen__aviso-texto">
            Esta ação revoga imediatamente todas as sessões ativas desta conta.
            Não é possível reativar por esta tela.
          </p>

          {confirmacaoDesativacao.erro ? (
            <p className="contas-acesso-screen__form-erro" role="alert">
              {confirmacaoDesativacao.erro}
            </p>
          ) : null}

          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={fecharConfirmacaoDesativacao}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmarDesativacao()}
              disabled={confirmacaoDesativacao.desativando}
            >
              {confirmacaoDesativacao.desativando
                ? "Desativando…"
                : "Confirmar desativação"}
            </Button>
          </FormActions>
        </Surface>
      ) : null}

      {confirmacaoResetMfa ? (
        <Surface
          as="section"
          padding="lg"
          className="contas-acesso-screen__formulario"
          aria-labelledby={resetMfaTituloId}
        >
          <h2
            id={resetMfaTituloId}
            className="contas-acesso-screen__section-title"
          >
            Redefinir MFA — {confirmacaoResetMfa.email}
          </h2>
          <p role="alert" className="contas-acesso-screen__aviso-texto">
            Esta ação remove o fator de autenticação em duas etapas desta conta
            e revoga imediatamente todas as sessões ativas dela. A pessoa
            precisará configurar o MFA de novo no próximo acesso. Nenhum segredo
            ou código é exibido ou gerado aqui.
          </p>

          {confirmacaoResetMfa.erro ? (
            <p className="contas-acesso-screen__form-erro" role="alert">
              {confirmacaoResetMfa.erro}
            </p>
          ) : null}

          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={fecharConfirmacaoResetMfa}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmarResetMfa()}
              disabled={confirmacaoResetMfa.resetando}
            >
              {confirmacaoResetMfa.resetando
                ? "Redefinindo…"
                : "Confirmar redefinição"}
            </Button>
          </FormActions>
        </Surface>
      ) : null}
    </div>
  );
}
