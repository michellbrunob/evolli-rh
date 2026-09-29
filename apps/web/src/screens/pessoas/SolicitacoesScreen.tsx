/**
 * Pessoas > Solicitações (T140) — interface FUNCIONAL da Central de Solicitações
 * de Pessoas, conectada exclusivamente aos cinco contratos reais integrados pela
 * T139 em `apps/api/src/solicitacoes-pessoas/`.
 *
 * **A Central registra e encaminha; não executa.** Encaminhar é _handoff_: nada
 * aqui altera ponto, férias, cadastro, vínculo, benefício, Banco de Horas, Folha
 * ou fechamento, e nada dispara automação em outro módulo.
 *
 * **Sem conteúdo, por construção** (`PD-SOL-05`, ADR 0013): esta tela nunca
 * recebe, exibe, envia, baixa, pré-visualiza ou linka arquivo, upload, anexo,
 * URL, base64, blob ou storage, e nunca coleta diagnóstico, CID ou descrição
 * clínica. `atestado` usa exatamente a mesma estrutura dos outros cinco tipos.
 *
 * **Não existe ESS** (`DP-23`, deliberadamente não materializado): não há vínculo
 * autenticado `AccessUser <-> Colaborador`. O RH registra **em nome do
 * colaborador** e permanece o ator real na auditoria, como já ocorre em
 * `solicitacoes-documento`. Nenhum login de colaborador é simulado.
 *
 * **Backend é a autoridade final.** A tabela de ações por situação existe só para
 * não oferecer o que o servidor recusaria; esconder botão é usabilidade, não
 * segurança. O `empresaId` das mutações vem de `GET /v1/users/me` apenas para o
 * servidor reconferir contra a sessão (divergência responde 404, nunca 403).
 *
 * **Sem SLA automático** (`PD-SOL-04`): `enviadaEm` e `primeiraRevisaoEm` são
 * marcos registrados pelo servidor. A tela não calcula prazo, não conta tempo e
 * não promete conclusão.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
import type { DataTableColumn } from "../../components";
import {
  obterUsuarioAtual,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import {
  listarColaboradores,
  listarVinculosDoColaborador,
  type ColaboradorApi,
  type VinculoApi,
} from "../../api/colaboradoresClient";
import {
  ACOES_COM_MOTIVO_OBRIGATORIO,
  ACOES_POR_SITUACAO,
  ApiError,
  MOTIVOS_SOLICITACAO_PESSOA,
  ROTULO_ACAO,
  ROTULO_MOTIVO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  SITUACOES_SOLICITACAO_PESSOA,
  TIPOS_SOLICITACAO_PESSOA,
  VARIANTE_SITUACAO,
  detalharSolicitacaoPessoa,
  formatarDiaReferencia,
  formatarMomento,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
  registrarSolicitacaoPessoa,
  transicionarSolicitacaoPessoa,
  type AcaoTransicaoSolicitacaoPessoa,
  type MotivoSolicitacaoPessoa,
  type SituacaoSolicitacaoPessoa,
  type SolicitacaoPessoaApi,
  type SolicitacaoPessoaEventoApi,
  type TipoSolicitacaoPessoa,
} from "../../api/solicitacoesPessoasClient";
import "./SolicitacoesScreen.css";

export const SOLICITACOES_TITULO_ID = "solicitacoes-titulo";

const TAMANHO_PAGINA = 20;
const OPCAO_TODOS = "todos";

type StatusCarregamento = "carregando" | "erro" | "pronto";

/**
 * Em que regime a listagem está. Existe porque a API filtra por **vínculo**,
 * não por colaborador: com um colaborador escolhido e nenhum vínculo válido
 * não há consulta possível, e cair na listagem geral mostraria solicitações de
 * outras pessoas sob o nome do colaborador selecionado — a tabela não tem
 * coluna de sujeito, então nada desmentiria essa leitura.
 *
 * Só `geral` e `filtrada` chamam a API. Os demais modos esvaziam a lista e
 * explicam, para QUALQUER papel, por que não há dados.
 */
type ModoLista =
  | { tipo: "aguardando_colaboradores" }
  | { tipo: "geral" }
  | { tipo: "aguardando_vinculos" }
  | { tipo: "erro_vinculos" }
  | { tipo: "sem_vinculo" }
  | { tipo: "escolher_vinculo" }
  | { tipo: "filtrada"; vinculoId: string };

/**
 * Só o `rh` muta, e só com empresa na sessão (`PD-SOL-01`). `master_tecnico` lê
 * globalmente e nunca muta; `dp`, `gestor` e `colaborador` são negados por
 * padrão. Falha ao identificar o ator resulta em `null` — fail-closed.
 */
function podeMutar(ator: SafeAccessUserApi | null): boolean {
  return (
    ator !== null &&
    ator.role === "rh" &&
    typeof ator.companyId === "string" &&
    ator.companyId.length > 0
  );
}

interface FormularioRegistro {
  tipo: TipoSolicitacaoPessoa | "";
  motivo: MotivoSolicitacaoPessoa | "";
  periodoReferencia: string;
  salvando: boolean;
  erro: string | null;
}

interface FormularioTransicao {
  acao: AcaoTransicaoSolicitacaoPessoa;
  motivo: MotivoSolicitacaoPessoa | "";
  salvando: boolean;
  erro: string | null;
}

const REGISTRO_VAZIO: FormularioRegistro = {
  tipo: "",
  motivo: "",
  periodoReferencia: "",
  salvando: false,
  erro: null,
};

/** Referência técnica curta — nunca um identificador digitável pelo usuário. */
function referenciaCurta(id: string): string {
  return id.slice(0, 8);
}

export function SolicitacoesScreen() {
  const [ator, setAtor] = useState<SafeAccessUserApi | null>(null);

  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [statusColaboradores, setStatusColaboradores] =
    useState<StatusCarregamento>("carregando");
  const [colaboradorId, setColaboradorId] = useState("");

  const [vinculos, setVinculos] = useState<VinculoApi[]>([]);
  const [statusVinculos, setStatusVinculos] =
    useState<StatusCarregamento>("pronto");
  const [vinculoId, setVinculoId] = useState("");

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPessoaApi[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [filtroSituacao, setFiltroSituacao] = useState<string>(OPCAO_TODOS);
  const [statusLista, setStatusLista] =
    useState<StatusCarregamento>("carregando");

  const [detalhe, setDetalhe] = useState<SolicitacaoPessoaApi | null>(null);
  const [statusDetalhe, setStatusDetalhe] =
    useState<StatusCarregamento>("pronto");
  const [historico, setHistorico] = useState<SolicitacaoPessoaEventoApi[]>([]);
  const [statusHistorico, setStatusHistorico] =
    useState<StatusCarregamento>("pronto");

  const [formRegistro, setFormRegistro] = useState<FormularioRegistro | null>(
    null,
  );
  const [formTransicao, setFormTransicao] =
    useState<FormularioTransicao | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  /**
   * Aviso de falha que pertence à TELA, não a um formulário.
   *
   * Existe porque o 404 de uma transição precisa fechar o painel — o recurso
   * saiu do escopo e mantê-lo aberto seria mentira — e um erro guardado no
   * formulário morreria no mesmo lote de atualizações que o destrói, deixando
   * a mutação falhar em silêncio. `fecharDetalhe` não toca neste estado.
   */
  const [mensagemFalha, setMensagemFalha] = useState<string | null>(null);

  /**
   * Incrementado a cada troca de colaborador. Entra nas dependências do efeito
   * da listagem para que ela SEMPRE recarregue na troca, mesmo quando `pagina`
   * e `vinculoId` já estavam nos valores neutros — sem isso, limpar a lista no
   * próprio evento deixaria a tela presa em "carregando".
   */
  const [geracaoContexto, setGeracaoContexto] = useState(0);

  // Cada carregador tem seu contador monotônico: só a tentativa MAIS RECENTE
  // pode escrever no estado. Uma resposta atrasada de uma seleção, de um filtro
  // ou de uma página anterior é descartada em vez de sobrescrever a atual.
  const seqVinculos = useRef(0);
  const seqLista = useRef(0);
  const seqDetalhe = useRef(0);
  const seqHistorico = useRef(0);

  const tituloDetalheId = useId();
  const tituloRegistroId = useId();
  const tituloTransicaoId = useId();
  const detalheRef = useRef<HTMLHeadingElement | null>(null);
  const abrirDetalheRef = useRef<HTMLButtonElement | null>(null);

  // ---- Carregamentos base -------------------------------------------------

  const carregarAtor = useCallback(async () => {
    try {
      setAtor(await obterUsuarioAtual());
    } catch {
      // Sem ator identificado não há mutação (fail-closed); a leitura segue.
      setAtor(null);
    }
  }, []);

  const carregarColaboradores = useCallback(async () => {
    setStatusColaboradores("carregando");
    try {
      const res = await listarColaboradores({ tamanhoPagina: 100 });
      setColaboradores(res.itens);
      // Zero bloqueia; exatamente uma resolve; múltiplas exigem escolha
      // explícita — nunca a primeira em silêncio.
      setColaboradorId((atual) => {
        if (atual) return atual;
        return res.itens.length === 1 ? res.itens[0]!.id : "";
      });
      setStatusColaboradores("pronto");
    } catch {
      setStatusColaboradores("erro");
    }
  }, []);

  /**
   * `vinculo` é `null` SOMENTE na visão geral da empresa (nenhum colaborador
   * escolhido). Com colaborador escolhido, quem chama sempre passa um vínculo.
   */
  const carregarLista = useCallback(
    async (
      paginaAlvo: number,
      tipo: string,
      situacao: string,
      vinculo: string | null,
    ) => {
      const seq = ++seqLista.current;
      setStatusLista("carregando");
      try {
        const res = await listarSolicitacoesPessoas({
          pagina: paginaAlvo,
          tamanhoPagina: TAMANHO_PAGINA,
          ...(tipo !== OPCAO_TODOS
            ? { tipo: tipo as TipoSolicitacaoPessoa }
            : {}),
          ...(situacao !== OPCAO_TODOS
            ? { situacao: situacao as SituacaoSolicitacaoPessoa }
            : {}),
          ...(vinculo !== null ? { vinculoId: vinculo } : {}),
        });
        if (seq !== seqLista.current) return; // resposta superada: descarta
        setSolicitacoes(res.itens);
        setTotal(res.total);
        setStatusLista("pronto");
      } catch {
        if (seq !== seqLista.current) return;
        setStatusLista("erro");
      }
    },
    [],
  );

  const carregarVinculos = useCallback(async (id: string) => {
    const seq = ++seqVinculos.current;
    setStatusVinculos("carregando");
    try {
      const lista = await listarVinculosDoColaborador(id);
      if (seq !== seqVinculos.current) return;
      setVinculos(lista);
      setVinculoId(lista.length === 1 ? lista[0]!.id : "");
      setStatusVinculos("pronto");
    } catch {
      if (seq !== seqVinculos.current) return;
      setStatusVinculos("erro");
    }
  }, []);

  useEffect(() => {
    void carregarAtor();
    void carregarColaboradores();
  }, [carregarAtor, carregarColaboradores]);

  useEffect(() => {
    if (!colaboradorId) {
      // Sem colaborador: invalida cargas em voo e limpa o que depende dele.
      seqVinculos.current++;
      // Mantém a MESMA referência quando já está vazio: React descarta o
      // update e a tela não re-renderiza à toa.
      setVinculos((atual) => (atual.length === 0 ? atual : []));
      setVinculoId("");
      setStatusVinculos("pronto");
      return;
    }
    void carregarVinculos(colaboradorId);
  }, [colaboradorId, carregarVinculos]);

  /**
   * Só vale um vínculo que pertence à lista JÁ carregada do colaborador atual.
   * Conferir a pertinência, e não apenas se há algo selecionado, fecha de vez
   * a possibilidade de consultar ou submeter com o vínculo de um colaborador
   * anterior.
   */
  const vinculoValido =
    vinculoId !== "" && vinculos.some((v) => v.id === vinculoId);

  const semVinculos = vinculos.length === 0;

  /**
   * Depende só de PRIMITIVOS. Depender do array `vinculos` faria a identidade
   * de `modoLista` mudar a cada `setVinculos([])` — e o efeito da listagem
   * dispararia uma segunda consulta idêntica em toda montagem.
   */
  const modoLista: ModoLista = useMemo(() => {
    // Enquanto os colaboradores carregam não se sabe se um será resolvido
    // automaticamente. Consultar a visão geral aqui gastaria uma requisição e
    // piscaria dados de toda a empresa que seriam substituídos em seguida.
    if (statusColaboradores === "carregando")
      return { tipo: "aguardando_colaboradores" };
    if (!colaboradorId) return { tipo: "geral" };
    if (statusVinculos === "carregando") return { tipo: "aguardando_vinculos" };
    if (statusVinculos === "erro") return { tipo: "erro_vinculos" };
    if (semVinculos) return { tipo: "sem_vinculo" };
    if (!vinculoValido) return { tipo: "escolher_vinculo" };
    return { tipo: "filtrada", vinculoId };
  }, [
    statusColaboradores,
    colaboradorId,
    statusVinculos,
    semVinculos,
    vinculoId,
    vinculoValido,
  ]);

  useEffect(() => {
    if (modoLista.tipo === "geral") {
      void carregarLista(pagina, filtroTipo, filtroSituacao, null);
      return;
    }
    if (modoLista.tipo === "filtrada") {
      void carregarLista(
        pagina,
        filtroTipo,
        filtroSituacao,
        modoLista.vinculoId,
      );
      return;
    }
    // Nenhuma consulta é possível neste modo. Invalida o que estiver em voo e
    // esvazia a lista: nunca cair na listagem geral com colaborador escolhido.
    seqLista.current += 1;
    setSolicitacoes([]);
    setTotal(0);
    setStatusLista("pronto");
  }, [
    geracaoContexto,
    pagina,
    filtroTipo,
    filtroSituacao,
    modoLista,
    carregarLista,
  ]);

  // ---- Detalhe e histórico ------------------------------------------------

  const carregarDetalhe = useCallback(async (id: string) => {
    const seq = ++seqDetalhe.current;
    setStatusDetalhe("carregando");
    try {
      const s = await detalharSolicitacaoPessoa(id);
      if (seq !== seqDetalhe.current) return;
      setDetalhe(s);
      setStatusDetalhe("pronto");
    } catch {
      if (seq !== seqDetalhe.current) return;
      setStatusDetalhe("erro");
    }
  }, []);

  const carregarHistorico = useCallback(async (id: string) => {
    const seq = ++seqHistorico.current;
    setStatusHistorico("carregando");
    try {
      const eventos = await historicoSolicitacaoPessoa(id);
      if (seq !== seqHistorico.current) return;
      setHistorico(eventos);
      setStatusHistorico("pronto");
    } catch {
      if (seq !== seqHistorico.current) return;
      setStatusHistorico("erro");
    }
  }, []);

  function abrirDetalhe(
    solicitacao: SolicitacaoPessoaApi,
    origem: HTMLButtonElement | null,
  ) {
    abrirDetalheRef.current = origem;
    setDetalhe(solicitacao);
    setHistorico([]);
    setFormTransicao(null);
    setMensagemSucesso(null);
    setMensagemFalha(null);
    void carregarDetalhe(solicitacao.id);
    void carregarHistorico(solicitacao.id);
  }

  function fecharDetalhe() {
    // Invalida cargas em voo do painel: uma resposta atrasada não pode
    // reabrir nem repovoar um detalhe que já foi fechado.
    seqDetalhe.current++;
    seqHistorico.current++;
    setDetalhe(null);
    setHistorico([]);
    setFormTransicao(null);
    setStatusDetalhe("pronto");
    setStatusHistorico("pronto");
    abrirDetalheRef.current?.focus();
  }

  // Foco vai para o título do painel quando ele abre (retorna ao botão de
  // origem no fechamento) — o detalhe é o novo contexto de leitura. Depende só
  // do id: recarregar o mesmo detalhe não rouba o foco de volta.
  const detalheId = detalhe?.id ?? null;
  useEffect(() => {
    if (detalheId) detalheRef.current?.focus();
  }, [detalheId]);

  // ---- Erros --------------------------------------------------------------

  function mensagemErro(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return "Esta solicitação não está mais no seu escopo. A lista foi atualizada.";
      }
      if (err.status === 403) {
        return "Você não tem permissão para esta ação.";
      }
      if (err.status === 409) {
        return "Outra alteração ocorreu antes desta. O estado atual foi recarregado.";
      }
      if (err.status === 422) {
        return "Esta ação não é mais possível para a situação atual. O estado atual foi recarregado.";
      }
      if (err.status === 400) {
        return "Dados inválidos para esta operação. Confira os campos selecionados.";
      }
      return "Não foi possível concluir a operação. Tente novamente em instantes.";
    }
    return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
  }

  /**
   * Conflito nunca é projetado localmente: o servidor é a autoridade, então o
   * estado visível é relido dele antes de o usuário decidir o próximo passo.
   */
  function recarregarTudo(solicitacaoId: string | null) {
    void carregarLista(pagina, filtroTipo, filtroSituacao, vinculoId);
    if (solicitacaoId) {
      void carregarDetalhe(solicitacaoId);
      void carregarHistorico(solicitacaoId);
    }
  }

  // ---- Mutações -----------------------------------------------------------

  const empresaId =
    ator && typeof ator.companyId === "string" ? ator.companyId : null;

  async function submeterRegistro(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formRegistro || formRegistro.salvando || !empresaId) return;
    // Barreira final: o vínculo precisa ser do colaborador atualmente
    // carregado, nunca um resíduo da seleção anterior.
    if (!vinculoId || !vinculos.some((v) => v.id === vinculoId)) {
      setFormRegistro({ ...formRegistro, erro: "Selecione um vínculo." });
      return;
    }
    if (!formRegistro.tipo || !formRegistro.motivo) {
      setFormRegistro({
        ...formRegistro,
        erro: "Selecione o tipo e o motivo.",
      });
      return;
    }
    setFormRegistro({ ...formRegistro, salvando: true, erro: null });
    try {
      await registrarSolicitacaoPessoa({
        empresaId,
        vinculoId,
        tipo: formRegistro.tipo,
        motivo: formRegistro.motivo,
        ...(formRegistro.periodoReferencia
          ? { periodoReferencia: formRegistro.periodoReferencia }
          : {}),
      });
      setFormRegistro(null);
      setMensagemSucesso("Solicitação registrada em rascunho.");
      if (pagina !== 1) setPagina(1);
      else void carregarLista(1, filtroTipo, filtroSituacao, vinculoId);
    } catch (err) {
      setFormRegistro({
        ...formRegistro,
        salvando: false,
        erro: mensagemErro(err),
      });
    }
  }

  async function submeterTransicao(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formTransicao || formTransicao.salvando || !detalhe) return;
    const exigeMotivo = ACOES_COM_MOTIVO_OBRIGATORIO.includes(
      formTransicao.acao,
    );
    if (exigeMotivo && !formTransicao.motivo) {
      setFormTransicao({
        ...formTransicao,
        erro: "Esta ação exige uma justificativa registrada.",
      });
      return;
    }
    setFormTransicao({ ...formTransicao, salvando: true, erro: null });
    setMensagemFalha(null);
    const alvoId = detalhe.id;
    try {
      await transicionarSolicitacaoPessoa(alvoId, {
        acao: formTransicao.acao,
        ...(formTransicao.motivo ? { motivo: formTransicao.motivo } : {}),
      });
      setFormTransicao(null);
      setMensagemFalha(null);
      setMensagemSucesso(
        `Ação registrada: ${ROTULO_ACAO[formTransicao.acao]}.`,
      );
      recarregarTudo(alvoId);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : null;
      const mensagem = mensagemErro(err);

      if (status === 404) {
        // O recurso saiu do escopo: manter o painel aberto seria mentira, mas
        // fechá-lo em silêncio faria a falha parecer sucesso — o caminho feliz
        // também fecha o formulário. Por isso o aviso vai para o estado da
        // TELA, que `fecharDetalhe` não limpa e que sobrevive ao mesmo lote de
        // atualizações. Ele só sai numa próxima ação do operador.
        setMensagemSucesso(null);
        setMensagemFalha(mensagem);
        recarregarTudo(null);
        fecharDetalhe();
        return;
      }

      setFormTransicao({ ...formTransicao, salvando: false, erro: mensagem });
      // 409 e 422 mantêm o painel aberto: o operador precisa do contexto para
      // entender o conflito. O estado real é relido do servidor, e nada é
      // projetado localmente como se tivesse dado certo.
      if (status === 409 || status === 422) {
        recarregarTudo(alvoId);
      }
    }
  }

  // ---- Derivados ----------------------------------------------------------

  const mutavel = podeMutar(ator);
  const somenteLeitura = ator !== null && !mutavel;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const acoesDisponiveis = detalhe ? ACOES_POR_SITUACAO[detalhe.situacao] : [];

  /**
   * Troca de colaborador — invalidação e limpeza acontecem NESTE evento, nunca
   * num efeito posterior.
   *
   * Depender do efeito abriria uma janela, do tamanho da requisição de
   * vínculos, em que o seletor já mostra B enquanto `vinculoId` ainda aponta
   * para o vínculo de A: a lista continuaria filtrada por A e o botão de
   * registro continuaria habilitado com o vínculo de A.
   */
  function trocarColaborador(id: string) {
    // Reselecionar o MESMO colaborador não é troca de contexto. Sair aqui
    // evita marcar "carregando" sem que o efeito de vínculos volte a rodar —
    // o React descarta um `setColaboradorId` com valor idêntico, e a tela
    // ficaria presa carregando para sempre.
    if (id === colaboradorId) return;

    // 1. Invalida toda carga em voo do contexto anterior, antes de qualquer
    //    escrita de estado: uma resposta atrasada de A não pode reidratar
    //    vínculo, lista, detalhe ou histórico já no contexto de B. Cada
    //    contador também distingue duas cargas do MESMO id (A -> B -> A).
    seqVinculos.current += 1;
    seqLista.current += 1;
    seqDetalhe.current += 1;
    seqHistorico.current += 1;

    // 2. Zera imediatamente tudo que dependia do colaborador anterior.
    setColaboradorId(id);
    setVinculoId("");
    setVinculos([]);
    setStatusVinculos(id ? "carregando" : "pronto");

    setSolicitacoes([]);
    setTotal(0);
    setPagina(1);
    setStatusLista("carregando");
    setGeracaoContexto((geracao) => geracao + 1);

    setDetalhe(null);
    setHistorico([]);
    setStatusDetalhe("pronto");
    setStatusHistorico("pronto");

    setFormRegistro(null);
    setFormTransicao(null);
    setMensagemSucesso(null);
    setMensagemFalha(null);
  }

  function trocarVinculo(id: string) {
    setVinculoId(id);
    setPagina(1);
  }

  function trocarFiltro(qual: "tipo" | "situacao", valor: string) {
    if (qual === "tipo") setFiltroTipo(valor);
    else setFiltroSituacao(valor);
    setPagina(1);
  }

  const colunas: DataTableColumn<SolicitacaoPessoaApi>[] = [
    {
      key: "referencia",
      header: "Referência",
      cell: (s) => <code>{referenciaCurta(s.id)}</code>,
    },
    { key: "tipo", header: "Tipo", cell: (s) => ROTULO_TIPO[s.tipo] },
    {
      key: "situacao",
      header: "Situação",
      cell: (s) => (
        <StatusBadge variant={VARIANTE_SITUACAO[s.situacao]}>
          {ROTULO_SITUACAO[s.situacao]}
        </StatusBadge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (s) => ROTULO_MOTIVO[s.motivo],
    },
    {
      key: "periodo",
      header: "Dia de referência",
      cell: (s) => formatarDiaReferencia(s.periodoReferencia),
    },
    {
      key: "criado",
      header: "Registrada em",
      cell: (s) => formatarMomento(s.criadoEm),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (s) => (
        // O nome acessível vai em `aria-label`, não num `<span>` visualmente
        // oculto: um filho `position: absolute` dentro da tabela escaparia do
        // contêiner de rolagem dela e esticaria a rolagem horizontal da PÁGINA.
        <Button
          variant="subtle"
          aria-label={`Ver detalhe da solicitação ${referenciaCurta(s.id)}`}
          onClick={(e) => abrirDetalhe(s, e.currentTarget)}
        >
          Ver detalhe
        </Button>
      ),
    },
  ];

  return (
    <div className="solicitacoes-screen">
      <PageHeader
        headingLevel={1}
        titleId={SOLICITACOES_TITULO_ID}
        title="Solicitações"
        description="Central de Solicitações de Pessoas — o RH registra, analisa e encaminha. Escopo e permissões são decididos pelo servidor."
      />

      <Surface
        as="section"
        padding="md"
        className="solicitacoes-screen__aviso"
        aria-labelledby="solicitacoes-aviso-titulo"
      >
        <StatusBadge variant="info">Registra e encaminha</StatusBadge>
        <p
          id="solicitacoes-aviso-titulo"
          className="solicitacoes-screen__aviso-texto"
        >
          Encaminhar é um repasse para o fluxo próprio do RH: nada aqui altera
          ponto, férias, cadastro, vínculo, benefícios, Banco de Horas, Folha ou
          fechamento. Não há anexo, arquivo ou informação clínica — nem para
          solicitações do tipo Atestado. Como ainda não existe autoatendimento
          do colaborador, o RH registra em nome dele e permanece o responsável
          na trilha de auditoria.
        </p>
      </Surface>

      {somenteLeitura ? (
        <p className="solicitacoes-screen__somente-leitura" role="status">
          Seu perfil tem acesso somente de leitura nesta tela.
        </p>
      ) : null}

      {mensagemSucesso ? (
        <p className="solicitacoes-screen__sucesso" role="status">
          {mensagemSucesso}
        </p>
      ) : null}

      {mensagemFalha ? (
        <p className="solicitacoes-screen__falha" role="alert">
          {mensagemFalha}
        </p>
      ) : null}

      {/* Colaborador e vínculo ---------------------------------------------- */}
      <section
        aria-labelledby="solicitacoes-colaborador-titulo"
        className="solicitacoes-screen__secao"
      >
        <h2
          id="solicitacoes-colaborador-titulo"
          className="solicitacoes-screen__section-title"
        >
          Colaborador e vínculo
        </h2>
        <p className="solicitacoes-screen__ajuda">
          {colaboradorId
            ? "Com um colaborador escolhido, é preciso selecionar um vínculo válido para ver as solicitações dessa pessoa — a consulta é sempre por vínculo."
            : "Sem colaborador escolhido, a lista abaixo mostra a visão geral da empresa."}
        </p>

        {statusColaboradores === "carregando" ? (
          <p role="status">Carregando colaboradores…</p>
        ) : statusColaboradores === "erro" ? (
          <Surface as="div" padding="md" className="solicitacoes-screen__erro">
            <p role="alert">Não foi possível carregar os colaboradores.</p>
            <Button
              variant="secondary"
              onClick={() => void carregarColaboradores()}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : colaboradores.length === 0 ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Nenhum colaborador no seu escopo"
            description="Sem colaborador com vínculo na sua empresa não é possível registrar uma solicitação."
          />
        ) : (
          <div className="solicitacoes-screen__selecao">
            <FormField id="solicitacoes-colaborador" label="Colaborador">
              {(control) => (
                <select
                  value={colaboradorId}
                  onChange={(e) => trocarColaborador(e.target.value)}
                  {...control}
                >
                  <option value="">Todos (sem filtro por pessoa)</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {colaboradorId ? (
              statusVinculos === "carregando" ? (
                <p role="status">Carregando vínculos…</p>
              ) : statusVinculos === "erro" ? (
                <p role="alert">Não foi possível carregar os vínculos.</p>
              ) : vinculos.length === 0 ? (
                <p className="solicitacoes-screen__ajuda">
                  Este colaborador não tem vínculo nesta empresa — não é
                  possível registrar solicitação para ele.
                </p>
              ) : (
                <FormField
                  id="solicitacoes-vinculo"
                  label="Vínculo"
                  // `exactOptionalPropertyTypes`: a prop só existe quando há
                  // texto — nunca recebe `undefined` explícito.
                  {...(vinculos.length > 1
                    ? {
                        help: "Há mais de um vínculo: escolha explicitamente.",
                      }
                    : {})}
                >
                  {(control) => (
                    <select
                      value={vinculoId}
                      onChange={(e) => trocarVinculo(e.target.value)}
                      {...control}
                    >
                      <option value="">Selecione…</option>
                      {vinculos.map((v) => (
                        <option key={v.id} value={v.id}>
                          matrícula {v.matricula} · {v.tipo} · {v.situacao}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
              )
            ) : null}
          </div>
        )}
      </section>

      {/* Lista ------------------------------------------------------------- */}
      <section
        aria-labelledby="solicitacoes-lista-titulo"
        className="solicitacoes-screen__secao"
      >
        <div className="solicitacoes-screen__secao-cabecalho">
          <h2
            id="solicitacoes-lista-titulo"
            className="solicitacoes-screen__section-title"
          >
            Solicitações
          </h2>
          {mutavel ? (
            <Button
              onClick={() => {
                setFormRegistro({ ...REGISTRO_VAZIO });
                setMensagemSucesso(null);
                setMensagemFalha(null);
              }}
              disabled={!vinculoValido}
            >
              Registrar solicitação
            </Button>
          ) : null}
        </div>

        {/* Escopo da lista, visível para QUALQUER papel — inclusive
            `master_tecnico`, que não vê a dica de registro abaixo. */}
        <p className="solicitacoes-screen__ajuda">
          {modoLista.tipo === "geral"
            ? "Visão geral da empresa: todas as solicitações no seu escopo."
            : modoLista.tipo === "aguardando_colaboradores"
              ? "Definindo o escopo da consulta…"
              : modoLista.tipo === "filtrada"
                ? "Filtrado pelo vínculo selecionado deste colaborador."
                : "Sem vínculo selecionado, não há solicitações a exibir para este colaborador."}
        </p>

        {mutavel && !vinculoValido ? (
          <p className="solicitacoes-screen__ajuda">
            Selecione um colaborador e um vínculo para registrar uma
            solicitação.
          </p>
        ) : null}

        {modoLista.tipo === "aguardando_colaboradores" ? (
          <p role="status">Carregando solicitações…</p>
        ) : modoLista.tipo === "aguardando_vinculos" ? (
          <p role="status">Carregando os vínculos do colaborador…</p>
        ) : modoLista.tipo === "erro_vinculos" ? (
          <p role="alert">
            Não foi possível carregar os vínculos deste colaborador, então não
            há como listar as solicitações dele.
          </p>
        ) : modoLista.tipo === "sem_vinculo" ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Colaborador sem vínculo nesta empresa"
            description="Não há vínculo disponível para consultar ou registrar solicitações deste colaborador."
          />
        ) : modoLista.tipo === "escolher_vinculo" ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Vínculo não selecionado"
            description="Selecione um vínculo para visualizar as solicitações deste colaborador."
          />
        ) : (
          <>
            <div className="solicitacoes-screen__filtros">
              <FormField id="solicitacoes-filtro-tipo" label="Filtrar por tipo">
                {(control) => (
                  <select
                    value={filtroTipo}
                    onChange={(e) => trocarFiltro("tipo", e.target.value)}
                    {...control}
                  >
                    <option value={OPCAO_TODOS}>Todos</option>
                    {TIPOS_SOLICITACAO_PESSOA.map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_TIPO[t]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField
                id="solicitacoes-filtro-situacao"
                label="Filtrar por situação"
              >
                {(control) => (
                  <select
                    value={filtroSituacao}
                    onChange={(e) => trocarFiltro("situacao", e.target.value)}
                    {...control}
                  >
                    <option value={OPCAO_TODOS}>Todas</option>
                    {SITUACOES_SOLICITACAO_PESSOA.map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_SITUACAO[s]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>

            {/* Enquanto há linhas, a tabela PERMANECE visível durante a recarga:
            trocar de página ou de filtro não pode fazer a lista sumir e voltar,
            e os controles de paginação continuam operáveis. */}
            {statusLista === "carregando" && solicitacoes.length === 0 ? (
              <p role="status">Carregando solicitações…</p>
            ) : statusLista === "erro" ? (
              <Surface
                as="div"
                padding="md"
                className="solicitacoes-screen__erro"
              >
                <p role="alert">Não foi possível carregar as solicitações.</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void carregarLista(
                      pagina,
                      filtroTipo,
                      filtroSituacao,
                      vinculoId,
                    )
                  }
                >
                  Tentar novamente
                </Button>
              </Surface>
            ) : solicitacoes.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma solicitação encontrada"
                description="Quando houver solicitação no seu escopo que atenda aos filtros, ela aparece aqui."
              />
            ) : (
              <>
                {statusLista === "carregando" ? (
                  <p role="status" className="solicitacoes-screen__ajuda">
                    Atualizando solicitações…
                  </p>
                ) : null}
                <DataTable
                  caption="Solicitações de pessoas no seu escopo"
                  columns={colunas}
                  rows={solicitacoes}
                  rowKey={(s) => s.id}
                />
                <div className="solicitacoes-screen__paginacao">
                  <Button
                    variant="secondary"
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    disabled={pagina <= 1}
                  >
                    Página anterior
                  </Button>
                  <p role="status">
                    Página {pagina} de {totalPaginas} · {total} no total
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setPagina((p) => Math.min(totalPaginas, p + 1))
                    }
                    disabled={pagina >= totalPaginas}
                  >
                    Próxima página
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* Formulário de registro -------------------------------------------- */}
      {formRegistro && mutavel ? (
        <Surface
          as="section"
          padding="md"
          className="solicitacoes-screen__form"
          aria-labelledby={tituloRegistroId}
        >
          <h2
            id={tituloRegistroId}
            className="solicitacoes-screen__section-title"
          >
            Registrar solicitação
          </h2>
          <p className="solicitacoes-screen__ajuda">
            A solicitação nasce em rascunho. Não há campo de anexo, descrição
            livre ou informação clínica.
          </p>
          <form onSubmit={(e) => void submeterRegistro(e)}>
            <FormField id="solicitacoes-registro-tipo" label="Tipo" required>
              {(control) => (
                <select
                  value={formRegistro.tipo}
                  onChange={(e) =>
                    setFormRegistro({
                      ...formRegistro,
                      tipo: e.target.value as TipoSolicitacaoPessoa,
                    })
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_SOLICITACAO_PESSOA.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO[t]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="solicitacoes-registro-motivo"
              label="Motivo"
              help="Motivo codificado — não há texto livre."
              required
            >
              {(control) => (
                <select
                  value={formRegistro.motivo}
                  onChange={(e) =>
                    setFormRegistro({
                      ...formRegistro,
                      motivo: e.target.value as MotivoSolicitacaoPessoa,
                    })
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {MOTIVOS_SOLICITACAO_PESSOA.map((m) => (
                    <option key={m} value={m}>
                      {ROTULO_MOTIVO[m]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="solicitacoes-registro-periodo"
              label="Dia de referência"
              help="Opcional para todos os tipos."
            >
              {(control) => (
                <input
                  type="date"
                  value={formRegistro.periodoReferencia}
                  onChange={(e) =>
                    setFormRegistro({
                      ...formRegistro,
                      periodoReferencia: e.target.value,
                    })
                  }
                  {...control}
                />
              )}
            </FormField>

            {formRegistro.erro ? (
              <p className="solicitacoes-screen__form-erro" role="alert">
                {formRegistro.erro}
              </p>
            ) : null}

            <FormActions>
              <Button type="submit" disabled={formRegistro.salvando}>
                {formRegistro.salvando ? "Registrando…" : "Registrar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormRegistro(null)}
              >
                Cancelar
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {/* Detalhe + histórico ------------------------------------------------ */}
      {detalhe ? (
        <Surface
          as="section"
          padding="md"
          className="solicitacoes-screen__detalhe"
          aria-labelledby={tituloDetalheId}
        >
          <div className="solicitacoes-screen__secao-cabecalho">
            <h2
              id={tituloDetalheId}
              className="solicitacoes-screen__section-title"
              tabIndex={-1}
              ref={detalheRef}
            >
              Solicitação {referenciaCurta(detalhe.id)}
            </h2>
            <Button variant="secondary" onClick={fecharDetalhe}>
              Fechar
            </Button>
          </div>

          {statusDetalhe === "carregando" ? (
            <p role="status">Atualizando detalhe…</p>
          ) : statusDetalhe === "erro" ? (
            <p role="alert">Não foi possível atualizar o detalhe.</p>
          ) : null}

          <dl className="solicitacoes-screen__campos">
            <div>
              <dt>Tipo</dt>
              <dd>{ROTULO_TIPO[detalhe.tipo]}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <StatusBadge variant={VARIANTE_SITUACAO[detalhe.situacao]}>
                  {ROTULO_SITUACAO[detalhe.situacao]}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{ROTULO_MOTIVO[detalhe.motivo]}</dd>
            </div>
            <div>
              <dt>Dia de referência</dt>
              <dd>{formatarDiaReferencia(detalhe.periodoReferencia)}</dd>
            </div>
            <div>
              <dt>Registrada em</dt>
              <dd>{formatarMomento(detalhe.criadoEm)}</dd>
            </div>
            <div>
              <dt>Enviada em</dt>
              <dd>{formatarMomento(detalhe.enviadaEm)}</dd>
            </div>
            <div>
              <dt>Primeiro retorno do RH</dt>
              <dd>{formatarMomento(detalhe.primeiraRevisaoEm)}</dd>
            </div>
          </dl>

          {mutavel && acoesDisponiveis.length > 0 ? (
            <div className="solicitacoes-screen__acoes">
              <h3 className="solicitacoes-screen__subtitulo">
                Ações disponíveis
              </h3>
              <FormActions>
                {acoesDisponiveis.map((acao) => (
                  <Button
                    key={acao}
                    variant="secondary"
                    onClick={() =>
                      setFormTransicao({
                        acao,
                        motivo: "",
                        salvando: false,
                        erro: null,
                      })
                    }
                  >
                    {ROTULO_ACAO[acao]}
                  </Button>
                ))}
              </FormActions>
            </div>
          ) : mutavel ? (
            <p className="solicitacoes-screen__ajuda">
              Esta solicitação não admite novas ações.
            </p>
          ) : null}

          {formTransicao ? (
            <form
              onSubmit={(e) => void submeterTransicao(e)}
              aria-labelledby={tituloTransicaoId}
            >
              <h3
                id={tituloTransicaoId}
                className="solicitacoes-screen__subtitulo"
              >
                {ROTULO_ACAO[formTransicao.acao]}
              </h3>
              <FormField
                id="solicitacoes-transicao-motivo"
                label="Justificativa"
                help={
                  ACOES_COM_MOTIVO_OBRIGATORIO.includes(formTransicao.acao)
                    ? "Obrigatória nesta ação e registrada na trilha."
                    : "Opcional nesta ação."
                }
                required={ACOES_COM_MOTIVO_OBRIGATORIO.includes(
                  formTransicao.acao,
                )}
              >
                {(control) => (
                  <select
                    value={formTransicao.motivo}
                    onChange={(e) =>
                      setFormTransicao({
                        ...formTransicao,
                        motivo: e.target.value as MotivoSolicitacaoPessoa,
                      })
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {MOTIVOS_SOLICITACAO_PESSOA.map((m) => (
                      <option key={m} value={m}>
                        {ROTULO_MOTIVO[m]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              {formTransicao.erro ? (
                <p className="solicitacoes-screen__form-erro" role="alert">
                  {formTransicao.erro}
                </p>
              ) : null}

              <FormActions>
                <Button type="submit" disabled={formTransicao.salvando}>
                  {formTransicao.salvando
                    ? "Registrando…"
                    : `Confirmar ${ROTULO_ACAO[formTransicao.acao].toLowerCase()}`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFormTransicao(null)}
                >
                  Cancelar
                </Button>
              </FormActions>
            </form>
          ) : null}

          <div className="solicitacoes-screen__historico">
            <h3 className="solicitacoes-screen__subtitulo">Histórico</h3>
            {statusHistorico === "carregando" ? (
              <p role="status">Carregando histórico…</p>
            ) : statusHistorico === "erro" ? (
              <div>
                <p role="alert">Não foi possível carregar o histórico.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarHistorico(detalhe.id)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : historico.length === 0 ? (
              <p>Sem eventos registrados.</p>
            ) : (
              <DataTable
                caption="Histórico da solicitação, em ordem cronológica"
                columns={[
                  {
                    key: "quando",
                    header: "Quando",
                    cell: (e: SolicitacaoPessoaEventoApi) =>
                      formatarMomento(e.ocorridoEm),
                  },
                  {
                    key: "acao",
                    header: "Evento",
                    cell: (e: SolicitacaoPessoaEventoApi) =>
                      ROTULO_ACAO[e.acao],
                  },
                  {
                    key: "de",
                    header: "De",
                    cell: (e: SolicitacaoPessoaEventoApi) =>
                      e.situacaoDe ? ROTULO_SITUACAO[e.situacaoDe] : "—",
                  },
                  {
                    key: "para",
                    header: "Para",
                    cell: (e: SolicitacaoPessoaEventoApi) =>
                      ROTULO_SITUACAO[e.situacaoPara],
                  },
                  {
                    key: "motivo",
                    header: "Justificativa",
                    cell: (e: SolicitacaoPessoaEventoApi) =>
                      e.motivo ? ROTULO_MOTIVO[e.motivo] : "—",
                  },
                ]}
                rows={historico}
                rowKey={(e) => e.id}
              />
            )}
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
