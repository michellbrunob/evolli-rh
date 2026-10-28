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
import type { DataTableColumn, StatusVariant } from "../../components";
import { listarColaboradores } from "../../api/colaboradoresClient";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../api/horariosClient";
import {
  type CriarVinculoHorarioDto,
  type EncerrarVinculoHorarioDto,
  type ListarVinculosHorarioQuery,
  type VinculoHorarioApi,
  criarVinculoHorario,
  encerrarVinculoHorario,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { formatarDiaCivil } from "../../format/data";
import {
  SeletorColaboradorPaginado,
  type ColaboradorEscolhido,
} from "./SeletorColaboradorPaginado";
import { PaginacaoSimples } from "./PaginacaoSimples";
import "./PessoasHorarioScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";

export const PESSOAS_HORARIO_TITULO_ID = "pessoas-horario-titulo";

/** T191 — vínculos por página, como as demais listas de Pessoas. */
export const TAMANHO_PAGINA_VINCULOS = 20;

/** T192 — quem pediu a carga da tabela (ver `carregarVinculos`). */
type OrigemDaCarga = "inicial" | "filtro" | "pagina" | "repeticao" | "criacao";

/**
 * T193 — a nova tentativa em curso e o aviso que a pediu: ele segue montado,
 * com o botão indisponível, até a resposta — sem linhas antigas no lugar e
 * sem o foco passar pelo `<body>`.
 */
type Repeticao = "falha" | "paginaVazia" | null;

/** T192 — alvos do foco quando o controle acionado some ou troca. */
const ID_TITULO_LISTA = "pessoas-horario-lista-titulo";
const ID_TENTAR_NOVAMENTE = "pessoas-horario-tentar-novamente";
const ID_FILTRAR_COLABORADOR = "pessoas-horario-filtrar-colaborador";
const ID_FILTRO_COLABORADOR = "pessoas-horario-filtro-colaborador";
/** O campo de busca do seletor (T188) usa `${id}-busca`. */
const ID_BUSCA_FILTRO_COLABORADOR = `${ID_FILTRO_COLABORADOR}-busca`;
const ID_RESUMO_FILTRO_COLABORADOR = "pessoas-horario-filtro-colaborador-ativo";
const ID_FILTRO_JORNADA = "pessoas-horario-filtro-jornada";
const ID_FORMULARIO_JORNADA = "pessoas-horario-tabela";
const ID_FORMULARIO_INICIO = "pessoas-horario-vigencia-inicio";
/** T193 — destino do foco depois de criar um vínculo. */
const ID_NOVO_VINCULO = "pessoas-horario-novo-vinculo";
/** T193 — o motivo de o formulário não salvar (sem jornada ou colaborador ativo). */
const ID_FORMULARIO_SEM_OPCOES = "pessoas-horario-formulario-sem-opcoes";
const ID_FORMULARIO_COLABORADOR = "pessoas-horario-colaborador";
const ID_FORMULARIO_COLABORADOR_BUSCA = `${ID_FORMULARIO_COLABORADOR}-busca`;

/** T192 — o que se anuncia ao fim de uma carga pedida. */
function descreverResultado(pagina: number, total: number): string {
  if (total === 0) return "Nenhum vínculo de horário no filtro atual.";
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA_VINCULOS));
  const quantos = total === 1 ? "1 vínculo" : `${total} vínculos`;
  return `Página ${pagina} de ${paginas} — ${quantos} no filtro atual.`;
}

/**
 * T191 — o nome vem do próprio vínculo. Sem ele (falha de leitura, servidor
 * anterior), um rótulo neutro: nunca o identificador técnico no lugar do nome.
 */
function nomeColaborador(v: VinculoHorarioApi): string {
  return v.colaborador?.nome ?? "Colaborador não identificado";
}

/** T191 — a jornada também vem do próprio vínculo (T183). */
function nomeJornada(v: VinculoHorarioApi): string {
  return v.tabela?.nome ?? "Jornada não identificada";
}

const VARIANTE_SITUACAO: Record<"vigente" | "encerrada", StatusVariant> = {
  vigente: "success",
  encerrada: "neutral",
};

interface FormularioErros {
  colaboradorId?: string;
  tabelaHorarioId?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  geral?: string;
}

interface FormularioState {
  colaboradorId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  erros: FormularioErros;
  salvando: boolean;
}

interface DetalheState {
  vinculo: VinculoHorarioApi;
  vigenciaFimEncerramento: string;
  encerrando: boolean;
  erroEncerramento: string | null;
}

export interface PessoasHorarioScreenProps {
  /**
   * T183 — o perfil vincula e encerra jornadas: só o RH. Sem isso (DP,
   * `master_tecnico`), a tela é só consulta, sem nenhum controle de escrita.
   * Só orienta a tela: quem recusa é o servidor.
   */
  readonly podeOperar?: boolean;
}

export function PessoasHorarioScreen({
  podeOperar = false,
}: PessoasHorarioScreenProps = {}) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [vinculos, setVinculos] = useState<VinculoHorarioApi[]>([]);
  /**
   * T191 — a tabela de vínculos pagina no servidor, de 20 em 20, com filtros
   * por colaborador e por jornada. Antes era UMA página de 100, e os nomes
   * vinham de um dicionário de 100 colaboradores: acima disso, vínculos
   * sumiam e nomes viravam identificadores técnicos.
   */
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtroColaborador, setFiltroColaborador] =
    useState<ColaboradorEscolhido | null>(null);
  const [filtroJornadaId, setFiltroJornadaId] = useState("");
  /**
   * T191 — a busca do filtro por colaborador abre sob pedido: aberta o tempo
   * todo, ela poria uma lista de nomes acima da tabela antes de alguém
   * querer filtrar.
   */
  const [buscandoColaborador, setBuscandoColaborador] = useState(false);
  /** Só a resposta mais recente é aplicada (filtro trocado durante a leitura). */
  const pedidoVinculosRef = useRef(0);
  /**
   * T192 — a página pedida na última leitura (os filtros são os do estado):
   * "Tentar novamente" repete exatamente ela, não a última que deu certo.
   */
  const [paginaPedida, setPaginaPedida] = useState(1);
  /**
   * T192 — o que a região viva estável anuncia: a carga pedida e, ao fim, a
   * página e o total. A carga inicial não anuncia nada.
   */
  const [anuncio, setAnuncio] = useState("");
  /**
   * T192 — para onde o foco vai depois da próxima renderização, quando o
   * controle acionado some ou troca por outro (filtro de colaborador, nova
   * tentativa). Sem isto, o foco cairia no `<body>`.
   */
  const [focoPendente, setFocoPendente] = useState<string | null>(null);
  /** Filtros da última carga feita pelo efeito: distingue a inicial. */
  const chaveFiltrosRef = useRef<string | null>(null);
  /**
   * T193 — a nova tentativa em curso (ver `Repeticao`). O ref é lido dentro da
   * carga, que não muda de identidade; o estado decide o que fica na tela.
   */
  const [repeticao, setRepeticao] = useState<Repeticao>(null);
  const repeticaoRef = useRef<Repeticao>(null);
  /**
   * T188 — quantos colaboradores ATIVOS o escopo tem, contados pelo servidor
   * (`situacao=ativo`, a regra por empresa da T178), e qual é, quando há um
   * só. Antes vinha da página de 100, e passava a errar acima dela.
   * T192 — carregado à parte das jornadas: a falha de um não derruba o outro,
   * e nenhuma das duas esconde a tabela. Sem a contagem, o formulário mostra
   * a busca de colaborador, que tem a própria carga.
   * T193 — a falha tem aviso e nova tentativa próprios, no formulário.
   */
  const [ativos, setAtivos] = useState<{
    total: number;
    unico: ColaboradorEscolhido | null;
  }>({ total: 0, unico: null });
  const [contagemAtivos, setContagemAtivos] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [ativosFalhou, setAtivosFalhou] = useState(false);
  const [falhasDaContagem, setFalhasDaContagem] = useState(0);
  /**
   * T192 — o catálogo de jornadas (filtro e formulário). A falha tem aviso e
   * nova tentativa próprios; tabela, filtros e página não reiniciam.
   */
  const [catalogoJornadas, setCatalogoJornadas] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [catalogoFalhou, setCatalogoFalhou] = useState(false);
  /** Cada falha remonta o aviso, para o leitor de tela anunciá-lo de novo. */
  const [falhasDoCatalogo, setFalhasDoCatalogo] = useState(0);
  const [colaboradorDoFormulario, setColaboradorDoFormulario] =
    useState<ColaboradorEscolhido | null>(null);
  const [tabelas, setTabelas] = useState<TabelaHorarioApi[]>([]);
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  // T189 — formulário aberto conta como edição em andamento, e envio como
  // salvamento: a troca de empresa pergunta antes de descartar, e espera
  // o envio terminar.
  useEdicaoEmAndamento("Horário de trabalho", {
    pendente: formulario !== null,
    salvando: formulario?.salvando === true,
  });
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  const formTituloId = useId();
  const detalheTituloId = useId();

  /**
   * T192 — `origem` diz quem pediu a carga:
   * - `inicial`: ao montar; não anuncia nada;
   * - `filtro`: filtro trocado ou vínculo criado; anuncia a carga e o fim;
   * - `pagina`: "Anterior"/"Próxima"; o foco fica no botão acionado, que segue
   *   à vista (indisponível) durante a carga; numa falha, vai a "Tentar
   *   novamente", porque a paginação some com a tabela;
   * - `repeticao`: "Tentar novamente" ou "Ir para a primeira página"; o botão
   *   some ao concluir, e o foco vai ao título da lista.
   * - `criacao` (T193): vínculo criado; anuncia a criação junto da carga.
   *
   * T193 — numa repetição, o aviso que a pediu fica montado até a resposta
   * (`repeticao`); numa falha, as linhas da leitura anterior saem da tela.
   */
  const carregarVinculos = useCallback(
    async (
      colaboradorId: string,
      tabelaHorarioId: string,
      paginaAlvo: number,
      origem: OrigemDaCarga,
    ) => {
      const pedido = ++pedidoVinculosRef.current;
      // Outra carga (filtro, página) substitui uma repetição em curso.
      if (origem !== "repeticao") {
        repeticaoRef.current = null;
        setRepeticao(null);
      }
      setPaginaPedida(paginaAlvo);
      setStatusCarregamento("carregando");
      if (origem !== "inicial") {
        setAnuncio(
          `${origem === "criacao" ? "Vínculo criado. " : ""}Carregando a página ${paginaAlvo} dos vínculos de horário…`,
        );
      }
      try {
        const query: ListarVinculosHorarioQuery = {
          pagina: paginaAlvo,
          tamanhoPagina: TAMANHO_PAGINA_VINCULOS,
        };
        if (colaboradorId) query.colaboradorId = colaboradorId;
        if (tabelaHorarioId) query.tabelaHorarioId = tabelaHorarioId;
        const resp = await listarVinculosHorario(query);
        if (pedido !== pedidoVinculosRef.current) return;
        repeticaoRef.current = null;
        setRepeticao(null);
        setVinculos(resp.itens);
        setPagina(resp.pagina);
        setTotal(resp.total);
        setStatusCarregamento("dados");
        if (origem !== "inicial") {
          setAnuncio(descreverResultado(resp.pagina, resp.total));
        }
        if (origem === "repeticao") setFocoPendente(ID_TITULO_LISTA);
      } catch {
        if (pedido !== pedidoVinculosRef.current) return;
        // T193 — o aviso de falha já estava montado (nova falha da mesma
        // repetição)? Então ele não é lido de novo: a região estável
        // anuncia a nova falha, uma vez. Senão, o aviso que monta é o
        // anúncio (`role="alert"`), e a região fica calada.
        const avisoSeguiuMontado = repeticaoRef.current === "falha";
        repeticaoRef.current = null;
        setRepeticao(null);
        setVinculos([]);
        setStatusCarregamento("erro");
        setAnuncio(
          avisoSeguiuMontado
            ? `A nova tentativa falhou: a página ${paginaAlvo} não carregou.`
            : "",
        );
        if (origem === "pagina" || origem === "repeticao") {
          setFocoPendente(ID_TENTAR_NOVAMENTE);
        }
      }
    },
    [],
  );

  // Trocar de filtro volta para a primeira página: o conjunto é outro.
  const filtroColaboradorId = filtroColaborador?.id ?? "";
  useEffect(() => {
    const chave = `${filtroColaboradorId}|${filtroJornadaId}`;
    // A mesma chave de novo é a montagem repetida do modo estrito, não um
    // filtro trocado: segue como carga inicial, sem anúncio.
    const origem: OrigemDaCarga =
      chaveFiltrosRef.current === null || chaveFiltrosRef.current === chave
        ? "inicial"
        : "filtro";
    chaveFiltrosRef.current = chave;
    void carregarVinculos(filtroColaboradorId, filtroJornadaId, 1, origem);
  }, [filtroColaboradorId, filtroJornadaId, carregarVinculos]);

  useEffect(() => {
    if (!focoPendente) return;
    document.getElementById(focoPendente)?.focus();
    setFocoPendente(null);
  }, [focoPendente]);

  /**
   * T188 — quantos ativos: decide se o formulário mostra a busca.
   * T193 — `repeticao`: a nova tentativa do aviso próprio. Ela anuncia a carga
   * e o fim, e o foco vai ao campo que a contagem libera — ou ao motivo de
   * não salvar, quando não há ativo. A falha remonta o aviso (anúncio único).
   */
  const carregarAtivos = useCallback(async (repeticao: boolean) => {
    setContagemAtivos("carregando");
    if (repeticao) setAnuncio("Conferindo os colaboradores ativos…");
    try {
      const ativosResp = await listarColaboradores({
        situacao: "ativo",
        tamanhoPagina: 1,
      });
      const primeiroAtivo = ativosResp.itens[0];
      const unico =
        ativosResp.total === 1 && primeiroAtivo
          ? { id: primeiroAtivo.id, nome: primeiroAtivo.nome }
          : null;
      setAtivos({ total: ativosResp.total, unico });
      setContagemAtivos("dados");
      setAtivosFalhou(false);
      // Com um só ativo, o formulário aberto já o recebe — a regra de
      // quando a contagem chega antes de abrir.
      if (unico) {
        setFormulario((prev) =>
          prev && !prev.colaboradorId
            ? { ...prev, colaboradorId: unico.id }
            : prev,
        );
        setColaboradorDoFormulario((prev) => prev ?? unico);
      }
      if (repeticao) {
        if (ativosResp.total === 0) {
          setAnuncio("");
          setFocoPendente(ID_FORMULARIO_SEM_OPCOES);
        } else {
          setAnuncio("Colaboradores ativos conferidos.");
          setFocoPendente(
            ativosResp.total > 1
              ? ID_FORMULARIO_COLABORADOR_BUSCA
              : ID_FORMULARIO_INICIO,
          );
        }
      }
    } catch {
      setContagemAtivos("erro");
      setAtivosFalhou(true);
      setFalhasDaContagem((n) => n + 1);
      if (repeticao) setAnuncio("");
    }
  }, []);

  /**
   * As jornadas (filtro e formulário) seguem numa página de 100 — catálogo da
   * empresa, limite registrado; a TABELA não depende dela: cada vínculo traz
   * a sua. `destinoDoFoco`: numa nova tentativa que dá certo, o botão
   * "Tentar carregar as jornadas" some, e o foco vai ao campo que ela libera.
   * T193 — a nova tentativa anuncia a carga e a recuperação uma vez, na região
   * estável; sem jornada ativa, o foco vai ao motivo de não salvar, que se
   * explica sozinho. A falha remonta um único aviso anunciado.
   */
  const carregarJornadas = useCallback(
    async (destinoDoFoco: "filtro" | "formulario" | null) => {
      setCatalogoJornadas("carregando");
      if (destinoDoFoco) setAnuncio("Carregando as jornadas…");
      try {
        const resp = await listarTabelasHorario({ tamanhoPagina: 100 });
        const ativas = resp.itens.filter((t) => t.ativo);
        setTabelas(resp.itens);
        setCatalogoJornadas("dados");
        setCatalogoFalhou(false);
        // Com uma só jornada ativa, o formulário aberto já a recebe — a
        // mesma regra de quando o catálogo carrega antes de abrir.
        if (ativas.length === 1) {
          const unica = ativas[0]!.id;
          setFormulario((prev) =>
            prev && !prev.tabelaHorarioId
              ? { ...prev, tabelaHorarioId: unica }
              : prev,
          );
        }
        if (destinoDoFoco === "formulario" && ativas.length === 0) {
          setAnuncio("");
          setFocoPendente(ID_FORMULARIO_SEM_OPCOES);
        } else if (destinoDoFoco) {
          setAnuncio("As jornadas foram carregadas.");
          setFocoPendente(
            destinoDoFoco === "filtro"
              ? ID_FILTRO_JORNADA
              : ativas.length > 1
                ? ID_FORMULARIO_JORNADA
                : ID_FORMULARIO_INICIO,
          );
        }
      } catch {
        setCatalogoJornadas("erro");
        setCatalogoFalhou(true);
        setFalhasDoCatalogo((n) => n + 1);
        if (destinoDoFoco) setAnuncio("");
      }
    },
    [],
  );

  useEffect(() => {
    void carregarAtivos(false);
    void carregarJornadas(null);
  }, [carregarAtivos, carregarJornadas]);

  /**
   * T192 — repete exatamente a página que falhou, com os mesmos filtros.
   * T193 — o aviso de falha segue montado, com o botão indisponível.
   */
  function tentarDeNovo() {
    if (statusCarregamento === "carregando") return;
    repeticaoRef.current = "falha";
    setRepeticao("falha");
    void carregarVinculos(
      filtroColaboradorId,
      filtroJornadaId,
      paginaPedida,
      "repeticao",
    );
  }

  /** T193 — da página que voltou vazia; o estado vazio segue montado. */
  function irParaPrimeiraPagina() {
    if (statusCarregamento === "carregando") return;
    repeticaoRef.current = "paginaVazia";
    setRepeticao("paginaVazia");
    void carregarVinculos(filtroColaboradorId, filtroJornadaId, 1, "repeticao");
  }

  /** T193 — só a contagem: tabela, página, filtros e catálogo ficam. */
  function tentarContagemAtivos() {
    if (contagemAtivos === "carregando") return;
    void carregarAtivos(true);
  }

  /** T192 — só o catálogo: tabela, filtros e página ficam como estão. */
  function tentarJornadas(destinoDoFoco: "filtro" | "formulario") {
    if (catalogoJornadas === "carregando") return;
    void carregarJornadas(destinoDoFoco);
  }

  const tabelasAtivas = useMemo(
    () => tabelas.filter((t) => t.ativo),
    [tabelas],
  );

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA_VINCULOS));
  const filtrando = filtroColaborador !== null || filtroJornadaId !== "";

  /** T192 — o botão acionado some com o estado vazio; o foco vai a filtrar. */
  function limparFiltros() {
    setFiltroColaborador(null);
    setBuscandoColaborador(false);
    setFiltroJornadaId("");
    setFocoPendente(ID_FILTRAR_COLABORADOR);
  }

  function abrirBuscaDeColaborador() {
    setBuscandoColaborador(true);
    setFocoPendente(ID_BUSCA_FILTRO_COLABORADOR);
  }

  function cancelarBuscaDeColaborador() {
    setBuscandoColaborador(false);
    setFocoPendente(ID_FILTRAR_COLABORADOR);
  }

  function escolherFiltroColaborador(c: ColaboradorEscolhido | null) {
    if (!c) return;
    setFiltroColaborador(c);
    setBuscandoColaborador(false);
    setFocoPendente(ID_RESUMO_FILTRO_COLABORADOR);
  }

  function removerFiltroColaborador() {
    setFiltroColaborador(null);
    setFocoPendente(ID_FILTRAR_COLABORADOR);
  }

  /** T188 — mais de um ativo; T192 — ou a contagem falhou. */
  const buscaNoFormulario = ativos.total > 1 || ativosFalhou;

  function abrirFormulario() {
    setDetalhe(null);
    setColaboradorDoFormulario(ativos.unico);
    setFormulario({
      colaboradorId: ativos.unico?.id ?? "",
      tabelaHorarioId: tabelasAtivas.length === 1 ? tabelasAtivas[0]!.id : "",
      vigenciaInicio: "",
      vigenciaFim: "",
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  function abrirDetalhe(vinculo: VinculoHorarioApi) {
    setFormulario(null);
    setDetalhe({
      vinculo,
      vigenciaFimEncerramento: "",
      encerrando: false,
      erroEncerramento: null,
    });
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (catalogoJornadas !== "dados") {
      // T192 — o botão de salvar já fica indisponível; guarda dupla.
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              erros: { geral: "Carregue as jornadas antes de salvar." },
            }
          : prev,
      );
      return;
    }
    if (semJornadaAtiva || semColaboradorAtivo) {
      // T193 — o botão de salvar já fica indisponível e o motivo, à vista;
      // guarda dupla: nunca enviar sem jornada ou colaborador.
      setFocoPendente(ID_FORMULARIO_SEM_OPCOES);
      return;
    }
    // T193 — exigidos sempre: com um só ativo (ou uma só jornada ativa), o
    // valor já vem escolhido e o campo nem aparece.
    if (!formulario.colaboradorId) {
      erros.colaboradorId = "Selecione o colaborador.";
    }
    if (!formulario.tabelaHorarioId) {
      erros.tabelaHorarioId = "Selecione a tabela de horário.";
    }
    if (!formulario.vigenciaInicio) {
      erros.vigenciaInicio = "Informe o início da vigência.";
    }
    if (
      formulario.vigenciaFim &&
      formulario.vigenciaInicio &&
      formulario.vigenciaFim <= formulario.vigenciaInicio
    ) {
      erros.vigenciaFim = "O fim da vigência deve ser posterior ao início.";
    }

    if (
      erros.colaboradorId ??
      erros.tabelaHorarioId ??
      erros.vigenciaInicio ??
      erros.vigenciaFim
    ) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      const dto: CriarVinculoHorarioDto = {
        colaboradorId: formulario.colaboradorId,
        tabelaHorarioId: formulario.tabelaHorarioId,
        vigenciaInicio: formulario.vigenciaInicio,
        ...(formulario.vigenciaFim
          ? { vigenciaFim: formulario.vigenciaFim }
          : {}),
      };
      await criarVinculoHorario(dto);
      setFormulario(null);
      // T193 — o formulário some; o foco volta a "Novo vínculo", de onde a
      // pessoa veio (fica habilitado durante a releitura da tabela).
      setFocoPendente(ID_NOVO_VINCULO);
      await carregarVinculos(
        filtroColaboradorId,
        filtroJornadaId,
        1,
        "criacao",
      );
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status: unknown }).status
          : undefined;
      const mensagem =
        status === 409
          ? "Este colaborador já possui uma tabela de horário vigente nesse período. Encerre o vínculo atual ou ajuste as datas antes de criar um novo."
          : err instanceof Error
            ? err.message
            : "Não foi possível criar o vínculo. Tente novamente.";
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

  async function handleEncerrar() {
    if (!detalhe) return;
    const { vigenciaFimEncerramento, vinculo } = detalhe;

    if (!vigenciaFimEncerramento) {
      setDetalhe((prev) =>
        prev
          ? { ...prev, erroEncerramento: "Informe a data de encerramento." }
          : prev,
      );
      return;
    }
    if (vigenciaFimEncerramento <= vinculo.vigenciaInicio) {
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              erroEncerramento:
                "A data de encerramento deve ser posterior ao início da vigência.",
            }
          : prev,
      );
      return;
    }

    setDetalhe((prev) =>
      prev ? { ...prev, encerrando: true, erroEncerramento: null } : prev,
    );
    try {
      const dto: EncerrarVinculoHorarioDto = {
        vigenciaFim: vigenciaFimEncerramento,
      };
      const atualizado = await encerrarVinculoHorario(vinculo.id, dto);
      setDetalhe((prev) =>
        prev ? { ...prev, vinculo: atualizado, encerrando: false } : prev,
      );
      setVinculos((prev) =>
        prev.map((v) => (v.id === atualizado.id ? atualizado : v)),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível encerrar a vigência. Tente novamente.";
      setDetalhe((prev) =>
        prev
          ? { ...prev, encerrando: false, erroEncerramento: mensagem }
          : prev,
      );
    }
  }

  /**
   * T192 — "sem opções" só quando a leitura deu certo e veio vazia. Falha da
   * contagem de ativos mostra a busca no formulário; falha das jornadas
   * deixa abrir o formulário, que avisa e oferece a nova tentativa.
   */
  const semColaboradorAtivo = contagemAtivos === "dados" && ativos.total === 0;
  const semJornadaAtiva =
    catalogoJornadas === "dados" && tabelasAtivas.length === 0;
  const semOpcoesValidas = semColaboradorAtivo || semJornadaAtiva;
  const catalogoAindaNaoCarregou =
    catalogoJornadas === "carregando" && !catalogoFalhou;
  /** T193 — a primeira contagem ainda não chegou (não é falha). */
  const contagemAindaNaoChegou =
    contagemAtivos === "carregando" && !ativosFalhou;

  const colunas: DataTableColumn<VinculoHorarioApi>[] = [
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (v) => nomeColaborador(v),
    },
    {
      key: "tabela",
      header: "Tabela de horário",
      cell: (v) => nomeJornada(v),
    },
    {
      key: "vigencia",
      header: "Vigência",
      cell: (v) =>
        v.vigenciaFim
          ? `${formatarDiaCivil(v.vigenciaInicio)} – ${formatarDiaCivil(v.vigenciaFim)}`
          : `${formatarDiaCivil(v.vigenciaInicio)} – vigente`,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO[v.vigenciaFim ? "encerrada" : "vigente"]}
        >
          {v.vigenciaFim ? "Encerrada" : "Vigente"}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (v) => (
        <Button variant="secondary" onClick={() => abrirDetalhe(v)}>
          Ver detalhes
          <span className="sr-only"> — {nomeColaborador(v)}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="pessoas-horario-screen">
      <PageHeader
        headingLevel={1}
        titleId={PESSOAS_HORARIO_TITULO_ID}
        title="Horário de trabalho"
        description="O RH vincula uma tabela de horário ao colaborador, com vigência — a mesma tabela pode ser reaproveitada por vários colaboradores, e uma nova vigência substitui a anterior somente dali em diante."
        actions={
          podeOperar ? (
            <Button
              id={ID_NOVO_VINCULO}
              onClick={abrirFormulario}
              // T193 — não depende da tabela: o formulário usa só a contagem
              // de ativos e o catálogo. Assim segue focável depois de criar.
              disabled={
                semOpcoesValidas ||
                catalogoAindaNaoCarregou ||
                contagemAindaNaoChegou
              }
            >
              Novo vínculo
            </Button>
          ) : undefined
        }
      />

      <Surface
        as="section"
        padding="md"
        className="pessoas-horario-screen__aviso"
        aria-labelledby="pessoas-horario-aviso-titulo"
      >
        <StatusBadge variant="info">
          {podeOperar ? "Somente RH" : "Somente consulta"}
        </StatusBadge>
        <p
          id="pessoas-horario-aviso-titulo"
          className="pessoas-horario-screen__aviso-texto"
        >
          {podeOperar
            ? "Somente o RH da própria empresa vincula ou encerra a tabela de horário de um colaborador. Uma nova vigência vale apenas a partir da data de início escolhida — ela nunca altera cálculo, apuração ou saldo já existentes."
            : "Você consulta as jornadas dos colaboradores da empresa ativa e as suas vigências. Só o RH vincula, troca e encerra."}
        </p>
      </Surface>

      {/* T192 — região viva estável: anuncia a carga pedida e, ao fim, a
          página e o total. Fica sempre montada — região viva recém-criada
          costuma não ser lida. */}
      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      <section aria-labelledby={ID_TITULO_LISTA}>
        <h2
          id={ID_TITULO_LISTA}
          className="pessoas-horario-screen__section-title"
          tabIndex={-1}
        >
          Colaboradores com tabela de horário vinculada
        </h2>

        {/* T191 — filtros combináveis, no servidor e antes da paginação:
            o colaborador por busca (o mesmo seletor da T188) e a jornada.
            T192 — ficam à vista também na falha da tabela, e cada comando do
            filtro de colaborador leva o foco ao controle que o substitui. */}
        <div
          className="pessoas-horario-screen__filtros"
          role="group"
          aria-label="Filtrar vínculos de horário"
        >
          <div className="pessoas-horario-screen__filtro-colaborador">
            {filtroColaborador ? (
              <p
                id={ID_RESUMO_FILTRO_COLABORADOR}
                className="pessoas-horario-screen__filtro-ativo"
                tabIndex={-1}
              >
                <span>
                  Colaborador: <strong>{filtroColaborador.nome}</strong>
                </span>
                <Button
                  variant="secondary"
                  aria-label={`Remover filtro de colaborador: ${filtroColaborador.nome}`}
                  onClick={removerFiltroColaborador}
                >
                  Remover <span aria-hidden="true">×</span>
                </Button>
              </p>
            ) : buscandoColaborador ? (
              <>
                <SeletorColaboradorPaginado
                  id={ID_FILTRO_COLABORADOR}
                  rotulo="Filtrar por colaborador (nome ou matrícula)"
                  selecionado={null}
                  onSelecionar={escolherFiltroColaborador}
                />
                <Button variant="subtle" onClick={cancelarBuscaDeColaborador}>
                  Cancelar filtro por colaborador
                </Button>
              </>
            ) : (
              <Button
                id={ID_FILTRAR_COLABORADOR}
                variant="secondary"
                onClick={abrirBuscaDeColaborador}
              >
                Filtrar por colaborador
              </Button>
            )}
          </div>
          <div className="pessoas-horario-screen__filtro-jornada">
            <FormField id={ID_FILTRO_JORNADA} label="Jornada">
              {(control) => (
                <select
                  value={filtroJornadaId}
                  onChange={(e) => setFiltroJornadaId(e.target.value)}
                  {...control}
                >
                  <option value="">Todas as jornadas</option>
                  {tabelas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ativo ? t.nome : `${t.nome} (inativa)`}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            {catalogoFalhou ? (
              <AvisoComNovaTentativa
                chave={falhasDoCatalogo}
                texto="Não foi possível carregar as jornadas. O filtro por jornada fica indisponível até carregar."
                rotuloBotao="Tentar carregar as jornadas"
                carregando={catalogoJornadas === "carregando"}
                // T193 — com o formulário aberto, só o aviso dele é anunciado.
                anunciar={formulario === null}
                onTentar={() => tentarJornadas("filtro")}
              />
            ) : null}
          </div>
        </div>

        {statusCarregamento === "erro" || repeticao === "falha" ? (
          // T193 — durante "Tentar novamente", o aviso segue montado e o
          // texto não muda (não é lido de novo); só o botão fica indisponível.
          <Surface
            as="div"
            padding="lg"
            className="pessoas-horario-screen__erro"
            role="alert"
          >
            <StatusBadge variant="danger">Erro</StatusBadge>
            <h3 className="pessoas-horario-screen__section-title">
              Não foi possível carregar os vínculos de horário
            </h3>
            <p>
              {paginaPedida > 1
                ? `A página ${paginaPedida} não carregou. `
                : ""}
              Verifique sua conexão e tente novamente. Se o problema persistir,
              contate o suporte.
            </p>
            <Button
              id={ID_TENTAR_NOVAMENTE}
              variant="secondary"
              aria-disabled={statusCarregamento === "carregando"}
              onClick={tentarDeNovo}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : repeticao === "paginaVazia" ||
          (statusCarregamento === "dados" &&
            vinculos.length === 0 &&
            total > 0 &&
            !filtrando) ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Nenhum vínculo nesta página"
            description="Esta página voltou vazia: o conjunto pode ter mudado desde a última leitura."
            action={
              <Button
                variant="secondary"
                aria-disabled={statusCarregamento === "carregando"}
                onClick={irParaPrimeiraPagina}
              >
                Ir para a primeira página
              </Button>
            }
          />
        ) : statusCarregamento === "carregando" && vinculos.length === 0 ? (
          // T193 — texto visível, sem região viva: quem anuncia a carga é a
          // região estável (e a carga inicial não é anunciada).
          <p className="pessoas-horario-screen__carregando">
            Carregando vínculos de horário…
          </p>
        ) : vinculos.length === 0 && filtrando ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Nenhum vínculo com estes filtros"
            description="Nenhum vínculo de horário corresponde ao colaborador ou à jornada escolhidos."
            action={
              <Button variant="secondary" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : vinculos.length === 0 ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Nenhum vínculo de horário cadastrado"
            description="Vincule uma tabela de horário a um colaborador desta empresa para que ela apareça aqui."
            {...(podeOperar
              ? {
                  action: (
                    <Button
                      onClick={abrirFormulario}
                      disabled={
                        semOpcoesValidas ||
                        catalogoAindaNaoCarregou ||
                        contagemAindaNaoChegou
                      }
                    >
                      Novo vínculo
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          // T192 — durante a carga de outra página (ou de outro filtro), a
          // tabela e a paginação continuam à vista, marcadas como ocupadas: o
          // botão acionado não some, e o foco fica nele.
          <div
            className="pessoas-horario-screen__lista"
            aria-busy={statusCarregamento === "carregando"}
          >
            <p className="pessoas-horario-screen__total">
              {total === 1
                ? "1 vínculo no filtro atual"
                : `${total} vínculos no filtro atual`}
            </p>
            <DataTable
              caption="Colaboradores com tabela de horário vinculada"
              columns={colunas}
              rows={vinculos}
              rowKey={(v) => v.id}
            />
            <PaginacaoSimples
              rotulo="Páginas de vínculos de horário"
              pagina={pagina}
              totalPaginas={totalPaginas}
              carregando={statusCarregamento === "carregando"}
              focoEstavel
              onIrPara={(destino) =>
                void carregarVinculos(
                  filtroColaboradorId,
                  filtroJornadaId,
                  destino,
                  "pagina",
                )
              }
            />
          </div>
        )}

        {/* T193 — texto à vista, sem região viva: não anuncia na carga. */}
        {podeOperar && statusCarregamento === "dados" && semOpcoesValidas ? (
          <p className="pessoas-horario-screen__form-erro">
            {semColaboradorAtivo
              ? "Nenhum colaborador ativo disponível para vincular. "
              : ""}
            {semJornadaAtiva
              ? "Nenhuma tabela de horário ativa disponível para vincular."
              : ""}
          </p>
        ) : null}
      </section>

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__formulario"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="pessoas-horario-screen__section-title"
          >
            {nomeColaborador(detalhe.vinculo)}
          </h2>
          <p>
            <StatusBadge
              variant={
                VARIANTE_SITUACAO[
                  detalhe.vinculo.vigenciaFim ? "encerrada" : "vigente"
                ]
              }
            >
              {detalhe.vinculo.vigenciaFim ? "Encerrada" : "Vigente"}
            </StatusBadge>
          </p>
          <p className="pessoas-horario-screen__aviso-texto">
            Tabela de horário: {nomeJornada(detalhe.vinculo)}
            <br />
            Vigência: {formatarDiaCivil(detalhe.vinculo.vigenciaInicio)} –{" "}
            {detalhe.vinculo.vigenciaFim
              ? formatarDiaCivil(detalhe.vinculo.vigenciaFim)
              : "vigente"}
          </p>
          <p className="pessoas-horario-screen__aviso-texto">
            Colaborador, tabela e início da vigência são imutáveis. Apenas o fim
            da vigência pode ser registrado, uma única vez — é só referência de
            horário, sem cálculo de jornada, tolerância, horas extras, faltas,
            DSR, saldo, Banco de Horas ou Folha.
          </p>

          {podeOperar && !detalhe.vinculo.vigenciaFim ? (
            <div className="pessoas-horario-screen__encerrar">
              <FormField
                id="pessoas-horario-encerrar-data"
                label="Encerrar vigência em"
                {...(detalhe.erroEncerramento
                  ? { error: detalhe.erroEncerramento }
                  : {})}
              >
                {(control) => (
                  <input
                    type="date"
                    value={detalhe.vigenciaFimEncerramento}
                    onChange={(e) =>
                      setDetalhe((prev) =>
                        prev
                          ? {
                              ...prev,
                              vigenciaFimEncerramento: e.target.value,
                              erroEncerramento: null,
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleEncerrar()}
                disabled={detalhe.encerrando}
              >
                {detalhe.encerrando ? "Encerrando…" : "Encerrar vigência"}
              </Button>
            </div>
          ) : null}

          <FormActions>
            <Button
              variant="secondary"
              type="button"
              onClick={fecharDetalhe}
              disabled={detalhe.encerrando}
            >
              Fechar
            </Button>
          </FormActions>
        </Surface>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="pessoas-horario-screen__section-title"
          >
            Novo vínculo de horário
          </h2>
          <p className="pessoas-horario-screen__aviso-texto">
            Colaborador, tabela de horário e início da vigência não poderão ser
            alterados depois de criados. Para corrigir, encerre a vigência e
            registre um novo vínculo.
          </p>

          <form
            className="pessoas-horario-screen__form"
            aria-label="Formulário de novo vínculo de horário"
            onSubmit={(e) => void handleSubmit(e)}
          >
            {/* T188 — qualquer colaborador ATIVO da empresa, por busca
                paginada no servidor; sem o teto de 100. Com um só ativo,
                ele já vem escolhido e o campo não aparece, como antes. */}
            {/* T193 — falha da contagem: aviso e nova tentativa próprios; a
                busca abaixo continua enquanto ela não volta. */}
            {ativosFalhou ? (
              <AvisoComNovaTentativa
                chave={falhasDaContagem}
                texto="Não foi possível conferir quantos colaboradores ativos há. A busca de colaborador continua disponível."
                rotuloBotao="Tentar conferir os colaboradores ativos"
                carregando={contagemAtivos === "carregando"}
                anunciar
                onTentar={tentarContagemAtivos}
              />
            ) : null}
            {buscaNoFormulario ? (
              <SeletorColaboradorPaginado
                id={ID_FORMULARIO_COLABORADOR}
                rotulo="Colaborador (buscar por nome ou matrícula)"
                situacao="ativo"
                autoSelecionarUnico={ativosFalhou}
                selecionado={colaboradorDoFormulario}
                onSelecionar={(c) => {
                  setColaboradorDoFormulario(c);
                  setFormulario((prev) =>
                    prev
                      ? { ...prev, colaboradorId: c?.id ?? "", erros: {} }
                      : prev,
                  );
                }}
                {...(formulario.erros.colaboradorId
                  ? { erro: formulario.erros.colaboradorId }
                  : {})}
              />
            ) : null}

            {/* T192 — sem o catálogo, o aviso fica no lugar do campo, com a
                nova tentativa; salvar espera as jornadas. */}
            {catalogoFalhou ? (
              <AvisoComNovaTentativa
                chave={falhasDoCatalogo}
                texto="Não foi possível carregar as jornadas. Sem elas, não dá para criar o vínculo."
                rotuloBotao="Tentar carregar as jornadas"
                carregando={catalogoJornadas === "carregando"}
                anunciar
                onTentar={() => tentarJornadas("formulario")}
              />
            ) : tabelasAtivas.length > 1 ? (
              <FormField
                id={ID_FORMULARIO_JORNADA}
                label="Tabela de horário"
                required
                {...(formulario.erros.tabelaHorarioId
                  ? { error: formulario.erros.tabelaHorarioId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.tabelaHorarioId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? {
                              ...prev,
                              tabelaHorarioId: e.target.value,
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {tabelasAtivas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {/* T193 — sem jornada ou colaborador ativo (o catálogo ou a
                contagem voltaram vazios com o formulário aberto): o motivo
                fica à vista e "Criar vínculo", indisponível. Recebe o foco
                quando a nova tentativa traz a lista vazia. */}
            {semJornadaAtiva || semColaboradorAtivo ? (
              <p
                id={ID_FORMULARIO_SEM_OPCOES}
                className="pessoas-horario-screen__form-erro"
                tabIndex={-1}
              >
                {semJornadaAtiva
                  ? "Nenhuma tabela de horário ativa disponível para vincular. Ative ou cadastre uma em Jornadas de trabalho para criar o vínculo. "
                  : ""}
                {semColaboradorAtivo
                  ? "Nenhum colaborador ativo disponível para vincular."
                  : ""}
              </p>
            ) : null}

            <FormField
              id={ID_FORMULARIO_INICIO}
              label="Vigência — início"
              required
              help="A partir desta data a tabela passa a valer para o colaborador."
              {...(formulario.erros.vigenciaInicio
                ? { error: formulario.erros.vigenciaInicio }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.vigenciaInicio}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            vigenciaInicio: e.target.value,
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="pessoas-horario-vigencia-fim"
              label="Vigência — fim (opcional)"
              help="Deixe em branco para vigência em aberto. Se informado, deve ser posterior ao início."
              {...(formulario.erros.vigenciaFim
                ? { error: formulario.erros.vigenciaFim }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.vigenciaFim}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, vigenciaFim: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.erros.geral ? (
              <p className="pessoas-horario-screen__form-erro" role="alert">
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={fecharFormulario}
                disabled={formulario.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  formulario.salvando ||
                  catalogoJornadas !== "dados" ||
                  semJornadaAtiva ||
                  semColaboradorAtivo
                }
              >
                {formulario.salvando ? "Criando…" : "Criar vínculo"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}

interface AvisoComNovaTentativaProps {
  /** Muda a cada falha: remonta o aviso, que o leitor de tela lê de novo. */
  readonly chave: number;
  readonly texto: string;
  readonly rotuloBotao: string;
  readonly carregando: boolean;
  /**
   * T193 — o aviso é anunciado (`role="alert"`). Quando a mesma falha aparece
   * em dois lugares (filtro e formulário), só um anuncia.
   */
  readonly anunciar: boolean;
  readonly onTentar: () => void;
}

/**
 * T192 — falha de uma carga de apoio (catálogo de jornadas; T193: também a
 * contagem de ativos): aviso e nova tentativa só dela. O botão não some nem
 * fica `disabled` durante a nova tentativa (perderia o foco): fica com
 * `aria-disabled` e ignora o clique até a resposta. T193 — o rótulo não muda
 * durante a carga: a região estável já anuncia, e o nome do botão focado
 * mudando seria um segundo anúncio.
 */
function AvisoComNovaTentativa({
  chave,
  texto,
  rotuloBotao,
  carregando,
  anunciar,
  onTentar,
}: AvisoComNovaTentativaProps) {
  return (
    <div className="pessoas-horario-screen__aviso-catalogo">
      <p
        key={chave}
        className="pessoas-horario-screen__form-erro"
        {...(anunciar ? { role: "alert" } : {})}
      >
        {texto}
      </p>
      <Button
        variant="secondary"
        aria-disabled={carregando}
        onClick={() => {
          if (!carregando) onTentar();
        }}
      >
        {rotuloBotao}
      </Button>
    </div>
  );
}
