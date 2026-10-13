/**
 * AdministracaoLiderancaScreen (T157) — configuração do escopo do gestor, RH.
 *
 * Fecha o elo que faltava: a T151 entregou as tabelas, o RBAC e as rotas, e a
 * T153 entregou a consulta do gestor — mas **configurar** quem é gestor de qual
 * equipe só era possível por chamada HTTP crua ou pelo seed de demonstração.
 * Na prática, todo gestor real via lista vazia em "Minha equipe". Esta tela não
 * acrescenta capacidade: torna alcançável a que já existia.
 *
 * ## O que esta tela deliberadamente NÃO faz
 *
 *  - **Não decide autorização.** O gate de papel é conveniência de interface.
 *    Quem decide é o RBAC (`gestor_atribuicao`) e o escopo de empresa resolvido
 *    no servidor a partir da sessão. Esconder a tela de quem não tem o papel
 *    evita um "Acesso negado" inútil; não protegeria nada se alguém chamasse a
 *    API direto — e é por isso que o servidor segue sendo a fronteira real.
 *  - **Não administra exceções de acesso.** As três rotas de `excecoes` existem
 *    e continuam sem interface: `motivoCodigo` é catálogo fechado cujo conteúdo
 *    depende de validação com RH (ADR 0015, decisão 9). Oferecer o formulário
 *    antes disso seria escolher o catálogo por conta própria.
 *  - **Não exclui nada.** Encerrar preenche `vigenciaFim`; o registro continua
 *    visível no histórico. Não existe rota `DELETE`, e a ausência é a evidência
 *    que a decisão 8 exige.
 *  - **Não envia empresa.** A empresa vem da sessão, sempre. Nenhum formulário
 *    tem campo de empresa, e nenhuma chamada o aceita.
 *  - **Não inventa parâmetro.** As duas listagens administrativas devolvem
 *    array simples; mandar `?pagina=` responderia 400.
 *
 * ## Paginação
 *
 * A T156 registrou que nenhuma tela funcional consumia paginação. Aqui a
 * distinção é literal:
 *
 *  - `GET …/ligacoes` e `GET …/atribuicoes` **não paginam** — o contrato
 *    devolve array simples, então não há página além da primeira e nada fica
 *    oculto;
 *  - os catálogos de apoio (contas, colaboradores, equipes) **paginam**, e são
 *    percorridos **até o fim** por `carregarTodasAs*`. Se o conjunto exceder o
 *    teto de voltas, a tela mostra erro explícito — nunca uma lista truncada
 *    que se apresenta como completa.
 *
 * ## Concorrência
 *
 * Guarda monotônica por carregador (`useRef` + sequência), no padrão de
 * `SolicitacoesScreen` (T140) e `EquipeScreen` (T153). A resposta só escreve
 * estado se ainda for a mais recente — inclusive o `loading`, porque deixá-lo
 * escapar da guarda é como a tela trava em "carregando" para sempre.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  CatalogoIncompletoError,
  PAPEIS_COM_ADMINISTRACAO_DE_LIDERANCA,
  PAPEIS_GESTOR_EQUIPE,
  carregarTodasAsContas,
  carregarTodasAsEquipes,
  carregarTodosOsColaboradores,
  criarAtribuicao,
  encerrarAtribuicao,
  encerrarLigacao,
  listarAtribuicoes,
  listarLigacoes,
  vincularConta,
  type AtribuicaoApi,
  type LigacaoApi,
  type PapelGestorEquipe,
} from "../../api/gestorAdminClient";
import type { ColaboradorApi } from "../../api/colaboradoresClient";
import type { EquipeApi } from "../../api/organizacaoClient";
import type { SafeAccessUserApi } from "../../api/usersClient";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  Button,
  DataTable,
  EmptyState,
  FormActions,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
  type DataTableColumn,
} from "../../components";
import { formatarDiaCivil } from "../../format/data";
import "./AdministracaoLiderancaScreen.css";

export const ADMINISTRACAO_LIDERANCA_TITULO_ID =
  "administracao-lideranca-titulo";

type StatusCarregamento = "carregando" | "erro" | "pronto";
type Aba = "ligacoes" | "atribuicoes";
type Filtro = "vigentes" | "todas";

const ROTULO_PAPEL_EQUIPE: Record<string, string> = {
  principal: "Principal",
  substituto: "Substituto",
};

/**
 * Dia civil de hoje em `AAAA-MM-DD`, montado a partir dos componentes locais.
 *
 * Nunca `toISOString().slice(0, 10)`: aquilo converte para UTC e, a oeste de
 * Greenwich, devolve o dia anterior durante boa parte da tarde. O dia em que
 * alguém passa a ver outra pessoa não pode depender do fuso do navegador — é a
 * mesma razão pela qual o servidor exige `AAAA-MM-DD` sem hora (T154).
 */
export function diaDeHoje(agora: Date = new Date()): string {
  const ano = String(agora.getFullYear()).padStart(4, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mesma regra do `ehDiaIso` do servidor: dia puro, sem hora e sem fuso.
 *
 * A validação não para no formato: `2026-02-29` casa com o padrão e não
 * existe. Reconstruir a data em UTC e conferir os três componentes é o que
 * separa "parece uma data" de "é uma data" — e o servidor recusaria depois,
 * com uma mensagem que o formulário não saberia atribuir a um campo.
 */
export function ehDiaValido(valor: string): boolean {
  if (!DIA.test(valor)) return false;
  const ano = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/**
 * Props de erro de um campo, prontas para espalhar.
 *
 * Com `exactOptionalPropertyTypes`, passar `error={undefined}` a uma prop
 * `error?: string` é erro de tipo — a ausência da chave e a chave com
 * `undefined` deixam de ser a mesma coisa. Espalhar `{}` quando não há erro
 * resolve nos nove campos sem afrouxar a configuração.
 */
function erroDe(
  erros: Record<string, string>,
  campo: string,
): { error?: string } {
  const mensagem = erros[campo];
  return mensagem ? { error: mensagem } : {};
}

/**
 * Vigente = começou e não terminou, na data informada.
 *
 * Replica a leitura do servidor para EXIBIÇÃO apenas. Não é autorização: o
 * escopo real é resolvido no backend, e esta função nunca decide acesso.
 */
export function estaVigente(
  registro: { vigenciaInicio: string; vigenciaFim: string | null },
  hoje: string,
): boolean {
  if (registro.vigenciaInicio > hoje) return false;
  return registro.vigenciaFim === null || registro.vigenciaFim >= hoje;
}

export interface AdministracaoLiderancaScreenProps {
  /** Sessão desta aba deixou de ser válida (401); o shell volta ao login. */
  onSessaoAtualEncerrada?: () => void;
}

export function AdministracaoLiderancaScreen({
  onSessaoAtualEncerrada,
}: AdministracaoLiderancaScreenProps = {}) {
  const [statusAtor, setStatusAtor] =
    useState<StatusCarregamento>("carregando");
  const [papel, setPapel] = useState<string | null>(null);

  const [statusDados, setStatusDados] =
    useState<StatusCarregamento>("carregando");
  const [erroDados, setErroDados] = useState<string | null>(null);
  const [ligacoes, setLigacoes] = useState<LigacaoApi[]>([]);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoApi[]>([]);
  const [contas, setContas] = useState<SafeAccessUserApi[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [equipes, setEquipes] = useState<EquipeApi[]>([]);

  const [aba, setAba] = useState<Aba>("ligacoes");
  const [filtro, setFiltro] = useState<Filtro>("vigentes");
  const [aviso, setAviso] = useState<string | null>(null);

  const [formLigacao, setFormLigacao] = useState(false);
  const [formAtribuicao, setFormAtribuicao] = useState(false);
  const [encerrando, setEncerrando] = useState<{
    tipo: Aba;
    id: string;
    descricao: string;
  } | null>(null);

  const seqAtor = useRef(0);
  const seqDados = useRef(0);

  const hoje = useMemo(() => diaDeHoje(), []);

  const tratarErroSessao = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.status === 401) {
        seqAtor.current += 1;
        seqDados.current += 1;
        setLigacoes([]);
        setAtribuicoes([]);
        setContas([]);
        setColaboradores([]);
        setEquipes([]);
        setFormLigacao(false);
        setFormAtribuicao(false);
        setEncerrando(null);
        onSessaoAtualEncerrada?.();
        return true;
      }
      return false;
    },
    [onSessaoAtualEncerrada],
  );

  const carregarAtor = useCallback(async () => {
    const seq = ++seqAtor.current;
    setStatusAtor("carregando");
    try {
      const eu = await obterUsuarioAtual();
      if (seq !== seqAtor.current) return;
      setPapel(eu.role);
      setStatusAtor("pronto");
    } catch (err) {
      if (seq !== seqAtor.current) return;
      if (tratarErroSessao(err)) return;
      setStatusAtor("erro");
    }
  }, [tratarErroSessao]);

  const carregarDados = useCallback(async () => {
    const seq = ++seqDados.current;
    setStatusDados("carregando");
    setErroDados(null);
    try {
      // Em paralelo: nenhuma depende da outra, e serializar cinco chamadas só
      // tornaria a tela mais lenta sem tornar nada mais correto.
      const [ls, as, cs, cols, eqs] = await Promise.all([
        listarLigacoes(),
        listarAtribuicoes(),
        carregarTodasAsContas(),
        carregarTodosOsColaboradores(),
        carregarTodasAsEquipes(),
      ]);
      if (seq !== seqDados.current) return;
      setLigacoes(ls);
      setAtribuicoes(as);
      setContas(cs);
      setColaboradores(cols);
      setEquipes(eqs);
      setStatusDados("pronto");
    } catch (err) {
      if (seq !== seqDados.current) return;
      if (tratarErroSessao(err)) return;
      setErroDados(
        err instanceof CatalogoIncompletoError
          ? err.message
          : err instanceof ApiError
            ? err.message
            : "Não foi possível carregar a configuração de liderança.",
      );
      setStatusDados("erro");
    }
  }, [tratarErroSessao]);

  useEffect(() => {
    void carregarAtor();
  }, [carregarAtor]);

  const podeAdministrar =
    statusAtor === "pronto" &&
    papel !== null &&
    PAPEIS_COM_ADMINISTRACAO_DE_LIDERANCA.includes(papel);

  useEffect(() => {
    if (!podeAdministrar) {
      // Sem capacidade: invalida o que estiver em voo e NÃO deixa o estado
      // preso em "carregando" — sem isto a tela de quem não tem o papel ficaria
      // girando para sempre.
      seqDados.current += 1;
      setLigacoes([]);
      setAtribuicoes([]);
      setStatusDados("pronto");
      return;
    }
    void carregarDados();
  }, [podeAdministrar, carregarDados]);

  // --- resolução de nomes ---------------------------------------------------
  // As projeções do servidor devolvem só identificadores. Os nomes vêm dos
  // catálogos já carregados; um id sem correspondência vira o tracinho do
  // produto, nunca `undefined` na tela.
  const nomeDaConta = useMemo(() => {
    const mapa = new Map(contas.map((c) => [c.id, c.email]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [contas]);

  const nomeDoColaborador = useMemo(() => {
    const mapa = new Map(colaboradores.map((c) => [c.id, c.nome]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [colaboradores]);

  const nomeDaEquipe = useMemo(() => {
    const mapa = new Map(equipes.map((e) => [e.id, e.nome]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [equipes]);

  const ligacoesVisiveis = useMemo(
    () =>
      filtro === "todas"
        ? ligacoes
        : ligacoes.filter((l) => estaVigente(l, hoje)),
    [ligacoes, filtro, hoje],
  );

  const atribuicoesVisiveis = useMemo(
    () =>
      filtro === "todas"
        ? atribuicoes
        : atribuicoes.filter((a) => estaVigente(a, hoje)),
    [atribuicoes, filtro, hoje],
  );

  const aposMutacao = useCallback(
    (mensagem: string) => {
      setAviso(mensagem);
      setFormLigacao(false);
      setFormAtribuicao(false);
      setEncerrando(null);
      void carregarDados();
    },
    [carregarDados],
  );

  const colunasLigacoes: DataTableColumn<LigacaoApi>[] = useMemo(
    () => [
      {
        key: "conta",
        header: "Conta de acesso",
        cell: (l) => nomeDaConta(l.userId),
      },
      {
        key: "colaborador",
        header: "Colaborador",
        cell: (l) => nomeDoColaborador(l.colaboradorId),
      },
      {
        key: "inicio",
        header: "Início",
        cell: (l) => formatarDiaCivil(l.vigenciaInicio),
      },
      {
        key: "fim",
        header: "Fim",
        cell: (l) => formatarDiaCivil(l.vigenciaFim),
      },
      {
        key: "situacao",
        header: "Situação",
        cell: (l) =>
          estaVigente(l, hoje) ? (
            <StatusBadge variant="success">Vigente</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Encerrada</StatusBadge>
          ),
      },
      {
        key: "acoes",
        header: "Ações",
        cell: (l) =>
          estaVigente(l, hoje) ? (
            <Button
              variant="subtle"
              onClick={() =>
                setEncerrando({
                  tipo: "ligacoes",
                  id: l.id,
                  descricao: `a ligação de ${nomeDaConta(l.userId)} com ${nomeDoColaborador(l.colaboradorId)}`,
                })
              }
            >
              Encerrar
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [nomeDaConta, nomeDoColaborador, hoje],
  );

  const colunasAtribuicoes: DataTableColumn<AtribuicaoApi>[] = useMemo(
    () => [
      {
        key: "gestor",
        header: "Gestor",
        cell: (a) => nomeDoColaborador(a.gestorColaboradorId),
      },
      {
        key: "equipe",
        header: "Equipe",
        cell: (a) => nomeDaEquipe(a.equipeId),
      },
      {
        key: "papel",
        header: "Papel",
        cell: (a) => ROTULO_PAPEL_EQUIPE[a.papel] ?? a.papel,
      },
      {
        key: "inicio",
        header: "Início",
        cell: (a) => formatarDiaCivil(a.vigenciaInicio),
      },
      {
        key: "fim",
        header: "Fim",
        cell: (a) => formatarDiaCivil(a.vigenciaFim),
      },
      {
        key: "situacao",
        header: "Situação",
        cell: (a) =>
          estaVigente(a, hoje) ? (
            <StatusBadge variant="success">Vigente</StatusBadge>
          ) : (
            <StatusBadge variant="neutral">Encerrada</StatusBadge>
          ),
      },
      {
        key: "acoes",
        header: "Ações",
        cell: (a) =>
          estaVigente(a, hoje) ? (
            <Button
              variant="subtle"
              onClick={() =>
                setEncerrando({
                  tipo: "atribuicoes",
                  id: a.id,
                  descricao: `a atribuição de ${nomeDoColaborador(a.gestorColaboradorId)} na equipe ${nomeDaEquipe(a.equipeId)}`,
                })
              }
            >
              Encerrar
            </Button>
          ) : (
            "—"
          ),
      },
    ],
    [nomeDoColaborador, nomeDaEquipe, hoje],
  );

  return (
    <div className="admin-lideranca">
      <PageHeader
        headingLevel={1}
        titleId={ADMINISTRACAO_LIDERANCA_TITULO_ID}
        title="Administração da liderança"
        description="Liga contas de acesso a colaboradores e define quem responde por cada equipe. É esta configuração que preenche a tela “Minha equipe” do gestor."
      />

      {statusAtor === "carregando" ? (
        <p role="status">Verificando suas permissões…</p>
      ) : statusAtor === "erro" ? (
        <div className="admin-lideranca__erro">
          <p role="alert">Não foi possível verificar suas permissões.</p>
          <Button variant="secondary" onClick={() => void carregarAtor()}>
            Tentar novamente
          </Button>
        </div>
      ) : !podeAdministrar ? (
        <EmptyState
          headingLevel={2}
          icon="—"
          title="Sem permissão"
          description="Sua conta não tem permissão para administrar a liderança. Essa capacidade é concedida pelo servidor apenas ao RH, na própria empresa."
        />
      ) : (
        <>
          <Surface
            as="section"
            padding="md"
            className="admin-lideranca__aviso"
            aria-labelledby="admin-lideranca-aviso-titulo"
          >
            <StatusBadge variant="info">Configuração auditada</StatusBadge>
            <p
              id="admin-lideranca-aviso-titulo"
              className="admin-lideranca__aviso-texto"
            >
              Encerrar nunca apaga: preenche a data de fim e o registro continua
              no histórico. Exceções individuais de acesso não são administradas
              aqui — dependem de decisão de RH ainda pendente.
            </p>
          </Surface>

          {aviso ? (
            <p className="admin-lideranca__sucesso" role="status">
              {aviso}
            </p>
          ) : null}

          {statusDados === "carregando" ? (
            <p role="status">Carregando a configuração de liderança…</p>
          ) : statusDados === "erro" ? (
            <div className="admin-lideranca__erro">
              <p role="alert">{erroDados}</p>
              <Button variant="secondary" onClick={() => void carregarDados()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div
                className="admin-lideranca__abas"
                role="tablist"
                aria-label="Seções da administração da liderança"
              >
                <button
                  type="button"
                  role="tab"
                  id="aba-ligacoes"
                  aria-selected={aba === "ligacoes"}
                  aria-controls="painel-ligacoes"
                  className={
                    aba === "ligacoes"
                      ? "admin-lideranca__aba admin-lideranca__aba--ativa"
                      : "admin-lideranca__aba"
                  }
                  onClick={() => setAba("ligacoes")}
                >
                  Contas e colaboradores
                </button>
                <button
                  type="button"
                  role="tab"
                  id="aba-atribuicoes"
                  aria-selected={aba === "atribuicoes"}
                  aria-controls="painel-atribuicoes"
                  className={
                    aba === "atribuicoes"
                      ? "admin-lideranca__aba admin-lideranca__aba--ativa"
                      : "admin-lideranca__aba"
                  }
                  onClick={() => setAba("atribuicoes")}
                >
                  Gestores e equipes
                </button>
              </div>

              <div className="admin-lideranca__filtro">
                <label htmlFor="admin-lideranca-filtro">Exibir</label>
                <select
                  id="admin-lideranca-filtro"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value as Filtro)}
                >
                  <option value="vigentes">Somente vigentes hoje</option>
                  <option value="todas">Todas, inclusive encerradas</option>
                </select>
              </div>

              {aba === "ligacoes" ? (
                <section
                  id="painel-ligacoes"
                  role="tabpanel"
                  aria-labelledby="aba-ligacoes"
                  className="admin-lideranca__painel"
                >
                  <div className="admin-lideranca__painel-cabecalho">
                    <h2>Ligações entre conta e colaborador</h2>
                    <Button onClick={() => setFormLigacao(true)}>
                      Nova ligação
                    </Button>
                  </div>
                  <p className="admin-lideranca__painel-ajuda">
                    Sem esta ligação o sistema não sabe qual colaborador é a
                    pessoa autenticada, e nenhuma atribuição de equipe produz
                    efeito.
                  </p>
                  {ligacoesVisiveis.length === 0 ? (
                    <EmptyState
                      headingLevel={3}
                      icon="—"
                      title="Nenhuma ligação para este filtro"
                      description="Crie uma ligação para que uma conta de acesso passe a representar um colaborador desta empresa."
                    />
                  ) : (
                    <DataTable
                      caption="Ligações entre conta de acesso e colaborador"
                      captionVisible={false}
                      columns={colunasLigacoes}
                      rows={ligacoesVisiveis}
                      rowKey={(l) => l.id}
                    />
                  )}
                </section>
              ) : (
                <section
                  id="painel-atribuicoes"
                  role="tabpanel"
                  aria-labelledby="aba-atribuicoes"
                  className="admin-lideranca__painel"
                >
                  <div className="admin-lideranca__painel-cabecalho">
                    <h2>Atribuições de gestor a equipe</h2>
                    <Button onClick={() => setFormAtribuicao(true)}>
                      Nova atribuição
                    </Button>
                  </div>
                  <p className="admin-lideranca__painel-ajuda">
                    Cada equipe admite um principal e, no máximo, um substituto
                    vigentes ao mesmo tempo. O servidor recusa períodos que se
                    sobreponham.
                  </p>
                  {atribuicoesVisiveis.length === 0 ? (
                    <EmptyState
                      headingLevel={3}
                      icon="—"
                      title="Nenhuma atribuição para este filtro"
                      description="Atribua um colaborador já ligado a uma conta como gestor de uma equipe."
                    />
                  ) : (
                    <DataTable
                      caption="Atribuições de gestor a equipe"
                      captionVisible={false}
                      columns={colunasAtribuicoes}
                      rows={atribuicoesVisiveis}
                      rowKey={(a) => a.id}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {formLigacao ? (
        <FormularioLigacao
          contas={contas}
          colaboradores={colaboradores}
          hoje={hoje}
          onFechar={() => setFormLigacao(false)}
          onSucesso={() => aposMutacao("Ligação criada.")}
          onSessaoEncerrada={tratarErroSessao}
        />
      ) : null}

      {formAtribuicao ? (
        <FormularioAtribuicao
          colaboradores={colaboradores}
          equipes={equipes}
          hoje={hoje}
          onFechar={() => setFormAtribuicao(false)}
          onSucesso={() => aposMutacao("Atribuição criada.")}
          onSessaoEncerrada={tratarErroSessao}
        />
      ) : null}

      {encerrando ? (
        <FormularioEncerramento
          alvo={encerrando}
          hoje={hoje}
          onFechar={() => setEncerrando(null)}
          onSucesso={() => aposMutacao("Registro encerrado.")}
          onSessaoEncerrada={tratarErroSessao}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

/**
 * Trava síncrona contra duplo envio.
 *
 * `useState` é assíncrono: dois cliques no mesmo quadro leem `enviando` como
 * `false` nas duas vezes e disparam dois `POST`. O `useRef` fecha a janela de
 * imediato; o estado existe só para a interface refletir o que já aconteceu.
 */
function useEnvio() {
  const emVoo = useRef(false);
  const [enviando, setEnviando] = useState(false);
  const iniciar = useCallback(() => {
    if (emVoo.current) return false;
    emVoo.current = true;
    setEnviando(true);
    return true;
  }, []);
  const encerrar = useCallback(() => {
    emVoo.current = false;
    setEnviando(false);
  }, []);
  return { enviando, iniciar, encerrar };
}

interface FormularioLigacaoProps {
  contas: readonly SafeAccessUserApi[];
  colaboradores: readonly ColaboradorApi[];
  hoje: string;
  onFechar: () => void;
  onSucesso: () => void;
  onSessaoEncerrada: (err: unknown) => boolean;
}

function FormularioLigacao({
  contas,
  colaboradores,
  hoje,
  onFechar,
  onSucesso,
  onSessaoEncerrada,
}: FormularioLigacaoProps) {
  const [userId, setUserId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [vigenciaInicio, setVigenciaInicio] = useState(hoje);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { enviando, iniciar, encerrar } = useEnvio();

  const alterado =
    userId !== "" || colaboradorId !== "" || vigenciaInicio !== hoje;

  const enviar = useCallback(async () => {
    const novos: Record<string, string> = {};
    if (!userId) novos.userId = "Escolha a conta de acesso.";
    if (!colaboradorId) novos.colaboradorId = "Escolha o colaborador.";
    if (!ehDiaValido(vigenciaInicio))
      novos.vigenciaInicio = "Informe uma data válida.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    if (!iniciar()) return;
    setErroGeral(null);
    try {
      await vincularConta({ userId, colaboradorId, vigenciaInicio });
      onSucesso();
    } catch (err) {
      if (onSessaoEncerrada(err)) return;
      setErroGeral(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a ligação.",
      );
    } finally {
      encerrar();
    }
  }, [
    userId,
    colaboradorId,
    vigenciaInicio,
    iniciar,
    encerrar,
    onSucesso,
    onSessaoEncerrada,
  ]);

  return (
    <Modal
      aberto
      titulo="Nova ligação entre conta e colaborador"
      descricao="A conta passa a representar este colaborador a partir da data informada."
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={enviando}>
            {enviando ? "Criando…" : "Criar ligação"}
          </Button>
        </FormActions>
      }
    >
      {erroGeral ? <p role="alert">{erroGeral}</p> : null}

      <FormField
        id="ligacao-conta"
        label="Conta de acesso"
        required
        {...erroDe(erros, "userId")}
        disabled={enviando}
      >
        {(control) => (
          <select
            {...control}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="ligacao-colaborador"
        label="Colaborador"
        required
        {...erroDe(erros, "colaboradorId")}
        disabled={enviando}
      >
        {(control) => (
          <select
            {...control}
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="ligacao-inicio"
        label="Início da vigência"
        required
        help="Dia em que a ligação passa a valer."
        {...erroDe(erros, "vigenciaInicio")}
        disabled={enviando}
      >
        {(control) => (
          <input
            {...control}
            type="date"
            value={vigenciaInicio}
            onChange={(e) => setVigenciaInicio(e.target.value)}
          />
        )}
      </FormField>
    </Modal>
  );
}

interface FormularioAtribuicaoProps {
  colaboradores: readonly ColaboradorApi[];
  equipes: readonly EquipeApi[];
  hoje: string;
  onFechar: () => void;
  onSucesso: () => void;
  onSessaoEncerrada: (err: unknown) => boolean;
}

function FormularioAtribuicao({
  colaboradores,
  equipes,
  hoje,
  onFechar,
  onSucesso,
  onSessaoEncerrada,
}: FormularioAtribuicaoProps) {
  const [gestorColaboradorId, setGestorColaboradorId] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [papel, setPapel] = useState<PapelGestorEquipe>("principal");
  const [vigenciaInicio, setVigenciaInicio] = useState(hoje);
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { enviando, iniciar, encerrar } = useEnvio();

  const alterado =
    gestorColaboradorId !== "" ||
    equipeId !== "" ||
    papel !== "principal" ||
    vigenciaInicio !== hoje ||
    vigenciaFim !== "";

  const enviar = useCallback(async () => {
    const novos: Record<string, string> = {};
    if (!gestorColaboradorId)
      novos.gestorColaboradorId = "Escolha o colaborador que será gestor.";
    if (!equipeId) novos.equipeId = "Escolha a equipe.";
    if (!ehDiaValido(vigenciaInicio))
      novos.vigenciaInicio = "Informe uma data válida.";
    if (vigenciaFim !== "" && !ehDiaValido(vigenciaFim))
      novos.vigenciaFim = "Informe uma data válida.";
    if (
      vigenciaFim !== "" &&
      ehDiaValido(vigenciaFim) &&
      ehDiaValido(vigenciaInicio) &&
      vigenciaFim < vigenciaInicio
    )
      novos.vigenciaFim = "O fim não pode ser anterior ao início.";
    setErros(novos);
    if (Object.keys(novos).length > 0) return;
    if (!iniciar()) return;
    setErroGeral(null);
    try {
      await criarAtribuicao({
        gestorColaboradorId,
        equipeId,
        papel,
        vigenciaInicio,
        // Campo omitido quando vazio: o DTO o marca opcional, e mandar string
        // vazia reprovaria em `IsISO8601`.
        ...(vigenciaFim ? { vigenciaFim } : {}),
      });
      onSucesso();
    } catch (err) {
      if (onSessaoEncerrada(err)) return;
      setErroGeral(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a atribuição.",
      );
    } finally {
      encerrar();
    }
  }, [
    gestorColaboradorId,
    equipeId,
    papel,
    vigenciaInicio,
    vigenciaFim,
    iniciar,
    encerrar,
    onSucesso,
    onSessaoEncerrada,
  ]);

  return (
    <Modal
      aberto
      titulo="Nova atribuição de gestor a equipe"
      descricao="Define quem responde pela equipe no período informado."
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      largura="larga"
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={enviando}>
            {enviando ? "Criando…" : "Criar atribuição"}
          </Button>
        </FormActions>
      }
    >
      {erroGeral ? <p role="alert">{erroGeral}</p> : null}

      <FormField
        id="atribuicao-gestor"
        label="Colaborador que será gestor"
        required
        help="Precisa estar ligado a uma conta de acesso para enxergar a equipe."
        {...erroDe(erros, "gestorColaboradorId")}
        disabled={enviando}
      >
        {(control) => (
          <select
            {...control}
            value={gestorColaboradorId}
            onChange={(e) => setGestorColaboradorId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="atribuicao-equipe"
        label="Equipe"
        required
        {...erroDe(erros, "equipeId")}
        disabled={enviando}
      >
        {(control) => (
          <select
            {...control}
            value={equipeId}
            onChange={(e) => setEquipeId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="atribuicao-papel"
        label="Papel"
        required
        disabled={enviando}
      >
        {(control) => (
          <select
            {...control}
            value={papel}
            onChange={(e) => setPapel(e.target.value as PapelGestorEquipe)}
          >
            {PAPEIS_GESTOR_EQUIPE.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PAPEL_EQUIPE[p]}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField
        id="atribuicao-inicio"
        label="Início da vigência"
        required
        {...erroDe(erros, "vigenciaInicio")}
        disabled={enviando}
      >
        {(control) => (
          <input
            {...control}
            type="date"
            value={vigenciaInicio}
            onChange={(e) => setVigenciaInicio(e.target.value)}
          />
        )}
      </FormField>

      <FormField
        id="atribuicao-fim"
        label="Fim da vigência"
        help="Opcional. Em branco, a atribuição vale por prazo indeterminado."
        {...erroDe(erros, "vigenciaFim")}
        disabled={enviando}
      >
        {(control) => (
          <input
            {...control}
            type="date"
            value={vigenciaFim}
            onChange={(e) => setVigenciaFim(e.target.value)}
          />
        )}
      </FormField>
    </Modal>
  );
}

interface FormularioEncerramentoProps {
  alvo: { tipo: Aba; id: string; descricao: string };
  hoje: string;
  onFechar: () => void;
  onSucesso: () => void;
  onSessaoEncerrada: (err: unknown) => boolean;
}

function FormularioEncerramento({
  alvo,
  hoje,
  onFechar,
  onSucesso,
  onSessaoEncerrada,
}: FormularioEncerramentoProps) {
  const [vigenciaFim, setVigenciaFim] = useState(hoje);
  const [erro, setErro] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const { enviando, iniciar, encerrar } = useEnvio();

  const enviar = useCallback(async () => {
    if (!ehDiaValido(vigenciaFim)) {
      setErro("Informe uma data válida.");
      return;
    }
    setErro(undefined);
    if (!iniciar()) return;
    setErroGeral(null);
    try {
      if (alvo.tipo === "ligacoes") {
        await encerrarLigacao(alvo.id, { vigenciaFim });
      } else {
        await encerrarAtribuicao(alvo.id, { vigenciaFim });
      }
      onSucesso();
    } catch (err) {
      if (onSessaoEncerrada(err)) return;
      setErroGeral(
        err instanceof ApiError
          ? err.message
          : "Não foi possível encerrar o registro.",
      );
    } finally {
      encerrar();
    }
  }, [alvo, vigenciaFim, iniciar, encerrar, onSucesso, onSessaoEncerrada]);

  return (
    <Modal
      aberto
      titulo="Encerrar registro"
      descricao={`Encerrar ${alvo.descricao}. O registro permanece no histórico.`}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={vigenciaFim !== hoje}
      rodape={
        <FormActions>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => void enviar()} disabled={enviando}>
            {enviando ? "Encerrando…" : "Encerrar"}
          </Button>
        </FormActions>
      }
    >
      {erroGeral ? <p role="alert">{erroGeral}</p> : null}
      <FormField
        id="encerramento-fim"
        label="Fim da vigência"
        required
        help="Último dia em que o registro ainda vale."
        {...(erro ? { error: erro } : {})}
        disabled={enviando}
      >
        {(control) => (
          <input
            {...control}
            type="date"
            value={vigenciaFim}
            onChange={(e) => setVigenciaFim(e.target.value)}
          />
        )}
      </FormField>
    </Modal>
  );
}
