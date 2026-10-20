import { useCallback, useEffect, useRef, useState } from "react";
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
  usePedirFechamentoModal,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  type AdmitirColaboradorDto,
  type ColaboradorApi,
  type RetificarColaboradorDto,
  type TipoVinculo,
  type VinculoApi,
  admitirColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EmpresaApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import { ContatosColaboradorSecao } from "./ContatosColaboradorSecao";
import { DadosPessoaisColaboradorSecao } from "./DadosPessoaisColaboradorSecao";
import "./ColaboradoresScreen.css";

export const COLABORADORES_TITULO_ID = "colaboradores-titulo";

const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

type FiltroSituacao = "todos" | "ativo" | "inativo";
type FiltroSituacaoVinculo = "todos" | "previsto" | "ativo" | "encerrado";

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const VARIANTE_SITUACAO_COLABORADOR: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const VARIANTE_SITUACAO_VINCULO: Record<string, StatusVariant> = {
  previsto: "info",
  ativo: "success",
  encerrado: "neutral",
};

const ROTULO_SITUACAO_VINCULO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

type TipoDestino =
  "" | "unidade" | "departamento" | "area" | "equipe" | "cargo" | "centroCusto";

const OPCOES_TIPO_DESTINO: { valor: TipoDestino; rotulo: string }[] = [
  { valor: "unidade", rotulo: "Unidade organizacional" },
  { valor: "departamento", rotulo: "Departamento" },
  { valor: "area", rotulo: "Área" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "cargo", rotulo: "Cargo" },
  { valor: "centroCusto", rotulo: "Centro de custo" },
];

interface FormularioErros {
  nome?: string;
  matricula?: string;
  tipo?: string;
  dataAdmissao?: string;
  /** Falta escolher o TIPO de referência (categoria). */
  tipoDestino?: string;
  /** Falta o departamento que qualifica a área escolhida. */
  departamentoArea?: string;
  /** Falta escolher o REGISTRO da referência. */
  destino?: string;
  geral?: string;
}

interface FormularioState {
  nome: string;
  empresas: EmpresaApi[];
  empresaId: string;
  matricula: string;
  tipo: TipoVinculo | "";
  dataAdmissao: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
  departamentos: DepartamentoApi[];
  unidades: UnidadeOrganizacionalApi[];
  equipes: EquipeApi[];
  cargos: CargoApi[];
  centrosCusto: CentroCustoApi[];
  areasDoDepartamento: AreaApi[];
  carregandoAreas: boolean;
  carregandoOpcoes: boolean;
  erros: FormularioErros;
  salvando: boolean;
}

interface DetalheState {
  colaborador: ColaboradorApi;
  statusVinculos: "carregando" | "erro" | "dados";
  vinculos: VinculoApi[];
  nomeEdicao: string;
  salvandoNome: boolean;
  erroNome: string | null;
}

/** Rótulo do TIPO de referência organizacional (categoria), nunca do registro. */
/**
 * Limpa o erro do campo que está sendo corrigido e PRESERVA `geral`.
 *
 * Antes, todo `onChange` fazia `erros: {}`. Como a mensagem devolvida pelo
 * servidor (matrícula duplicada, por exemplo) vive em `geral`, começar a
 * corrigir apagava a explicação do que havia dado errado — justamente no
 * momento em que ela é necessária. `geral` só é limpo no próximo envio.
 */
function limparErroDoCampo(
  erros: FormularioErros,
  campo: keyof FormularioErros,
): FormularioErros {
  const restante: FormularioErros = { ...erros };
  delete restante[campo];
  return restante;
}

/**
 * T167 — a empresa da admissão vem SÓ da sessão. Se o servidor não devolver
 * exatamente uma empresa para ela, o formulário não tem como saber onde
 * admitir, e não oferece escolha: recusa enviar e diz por quê.
 */
const MENSAGEM_EMPRESA_INDEFINIDA =
  "Não foi possível confirmar a empresa ativa em que você está trabalhando. Nada será enviado. Feche a janela e tente novamente.";

/** `id` da mensagem geral do formulário — alvo de foco quando é o único erro. */
const ERRO_GERAL_ID = "colaboradores-form-erro-geral";

/**
 * T167 — ordem VISUAL dos campos do formulário. Depois de um envio com erro, o
 * foco vai ao primeiro desta lista que tiver mensagem: quem usa teclado ou
 * leitor de tela chega direto ao que precisa corrigir, em vez de procurar a
 * marca vermelha numa janela longa.
 */
const ORDEM_DOS_ERROS: readonly (keyof FormularioErros)[] = [
  "nome",
  "matricula",
  "tipo",
  "dataAdmissao",
  "tipoDestino",
  "departamentoArea",
  "destino",
  "geral",
];

const ID_DO_ERRO: Record<keyof FormularioErros, string> = {
  nome: "colaboradores-nome",
  matricula: "colaboradores-matricula",
  tipo: "colaboradores-tipo-vinculo",
  dataAdmissao: "colaboradores-data-admissao",
  tipoDestino: "colaboradores-tipo-destino",
  departamentoArea: "colaboradores-departamento-area",
  destino: "colaboradores-destino",
  geral: ERRO_GERAL_ID,
};

/**
 * T167 — traduz a recusa do servidor para o campo que a causou.
 *
 * O servidor responde com mensagem FIXA por status (`AllExceptionsFilter`),
 * sem dizer o campo; antes, a tela mostrava essa mensagem crua — "Conflito ao
 * processar a requisição." — no rodapé, sem apontar o que corrigir. O
 * mapeamento abaixo vale SÓ para `POST /v1/colaboradores` e se apoia no que o
 * código do servidor pode produzir nessa rota, não em suposição:
 *
 *  - 409 — a admissão cria um colaborador NOVO, então a única unicidade que ela
 *    pode violar é a da matrícula dentro da empresa (`traduzirErroPessoas`,
 *    P2002). Nenhum período de alocação é gravado na admissão, então a
 *    exclusão de sobreposição (23P01) não ocorre nela.
 *  - 422 — destino incoerente, inexistente, de outra empresa ou inativo
 *    (`assertDestinoCoerente`, `assertDestinoValidoEAtivo`, FK composta).
 *  - 404 — a empresa enviada não é a empresa ativa da sessão: o contexto mudou
 *    depois que a janela abriu (em outra aba, por exemplo).
 *
 * Em todos os casos os dados digitados ficam no formulário.
 */
function errosDaAdmissaoRecusada(
  erro: unknown,
  temDestino: boolean,
): FormularioErros {
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 409:
      return {
        matricula:
          "Esta matrícula já está em uso nesta empresa. Informe outra.",
      };
    case 422:
      return temDestino
        ? {
            destino:
              "A referência organizacional escolhida não foi aceita: ela pode ter sido inativada ou não pertencer à empresa ativa. Escolha outra.",
          }
        : {
            geral:
              "O servidor recusou a referência organizacional. Revise a lotação e tente de novo.",
          };
    case 404:
      return {
        geral:
          "A empresa ativa mudou desde que esta janela foi aberta. Nada foi salvo. Feche a janela e abra de novo para admitir na empresa atual.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para admitir colaboradores. Nada foi salvo.",
      };
    case 401:
      return {
        geral:
          "Seu acesso expirou. Nada foi salvo. Entre novamente para concluir a admissão.",
      };
    case 400:
      return {
        geral:
          "O servidor recusou algum dos dados informados. Revise os campos e tente de novo.",
      };
    default:
      return {
        geral:
          "Não foi possível admitir o colaborador agora. Os dados digitados foram mantidos; tente de novo.",
      };
  }
}

/**
 * "Cancelar" do formulário, ligado ao pedido de fechamento do `Modal` (T167).
 * Chamava o fechamento da tela direto e descartava, sem perguntar, o que já
 * estava digitado — só "Fechar" e Escape pediam confirmação.
 */
function CancelarFormulario({ desabilitado }: { desabilitado: boolean }) {
  const pedirFechamento = usePedirFechamentoModal();
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={pedirFechamento}
      disabled={desabilitado}
    >
      Cancelar
    </Button>
  );
}

function rotuloTipoDestino(tipo: TipoDestino): string {
  return (
    OPCOES_TIPO_DESTINO.find((o) => o.valor === tipo)?.rotulo ?? "Registro"
  );
}

/**
 * Quantas linhas por página.
 *
 * Explícito, e não herdado do padrão do servidor, porque a paginação só é
 * honesta se a tela souber o tamanho que pediu: é esse número que faz
 * "Página 2 de 5" significar alguma coisa. Vinte é o padrão do backend
 * (`TAMANHO_PAGINA_PADRAO`), bem abaixo do teto de 100.
 */
const TAMANHO_PAGINA = 20;

/**
 * R-1 — o tamanho de página da resposta, quando ele é utilizável.
 *
 * Recusa o que não serve para dividir: ausente, não numérico, zero, negativo,
 * fracionário ou não finito. Qualquer um deles produziria uma contagem de
 * páginas sem sentido — `Infinity`, `NaN` ou uma divisão por zero —, e uma
 * paginação inventada é pior que nenhuma.
 *
 * A recusa **volta ao tamanho pedido**, que é o que a tela de fato usou na
 * requisição. Não há degradação para "sem paginação": o comportamento fica
 * exatamente o de antes desta correção.
 */
function tamanhoDePaginaValido(valor: unknown): number {
  return typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    Number.isFinite(valor)
    ? valor
    : TAMANHO_PAGINA;
}

export interface ColaboradoresScreenProps {
  /**
   * T164 — a empresa de trabalho ATIVA, resolvida pelo servidor e repassada
   * pelo shell. É contexto, não controle: quem troca de empresa é o Hub, e só
   * para os papéis que o servidor autoriza.
   *
   * Vem por prop em vez de uma leitura própria porque o `AutenticacaoApp` já
   * tem o ator — pedir `/v1/users/me` de novo aqui seria uma requisição a mais
   * para um dado que já está em memória.
   */
  readonly empresaAtiva?: {
    readonly nome: string;
    readonly codigo: string;
  } | null;
  readonly onTituloIdChange?: (tituloId: string) => void;
  /**
   * T176 — colaborador a abrir assim que a tela montar: é o destino das ações
   * "Abrir ficha" e "Completar contatos" da página de Nova admissão. Vem da
   * RESPOSTA da admissão, não de nova busca. `foco: "contatos"` leva o foco ao
   * primeiro campo de contatos quando eles carregam.
   */
  readonly aberturaInicial?: {
    readonly colaborador: ColaboradorApi;
    readonly foco: "ficha" | "contatos";
  } | null;
  /** Avisa que `aberturaInicial` foi atendida, para o shell não repeti-la. */
  readonly onAberturaAtendida?: () => void;
}

export function ColaboradoresScreen({
  empresaAtiva = null,
  aberturaInicial = null,
  onAberturaAtendida,
}: ColaboradoresScreenProps = {}) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("todos");
  const [filtroSituacaoVinculo, setFiltroSituacaoVinculo] =
    useState<FiltroSituacaoVinculo>("todos");
  /**
   * T164 — paginação real.
   *
   * Antes desta tarefa a tela pedia a lista **sem** `pagina`, recebia a
   * primeira página do servidor e descartava o `total`. O efeito era silencioso
   * e grave: a partir do vigésimo primeiro colaborador, as pessoas seguintes
   * simplesmente não existiam na interface, sem nada na tela sugerindo que
   * houvesse mais. Uma lista que esconde registros é pior que uma lista vazia,
   * porque parece completa.
   *
   * `pagina` e `total` vêm da RESPOSTA, não do que a tela pediu: o servidor é
   * quem sabe quantos registros o escopo ativo tem.
   */
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  /**
   * R-1 — o tamanho de página que o SERVIDOR aplicou.
   *
   * Contar as páginas com a constante local assumia que o servidor sempre
   * honra o tamanho pedido. Ele honra hoje, mas a resposta carrega o valor
   * efetivo justamente para que o cliente não precise supor: no dia em que a
   * rota limitar a página, contar com 20 um conjunto servido de 10 em 10
   * ofereceria metade das páginas — e cada uma delas voltaria vazia.
   *
   * Começa na constante porque é o que foi pedido na primeira carga.
   */
  const [tamanhoPaginaEfetivo, setTamanhoPaginaEfetivo] =
    useState(TAMANHO_PAGINA);
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  // T169 — a seção de contatos do detalhe edita por conta própria e avisa
  // aqui quando há edição não salva e quando está gravando, para que o
  // `Modal` peça confirmação de descarte e não feche no meio da gravação.
  const [contatosAlterados, setContatosAlterados] = useState(false);
  const [salvandoContatos, setSalvandoContatos] = useState(false);
  // T176 — "Completar contatos" vindo da página de Nova admissão.
  const [focarContatos, setFocarContatos] = useState(false);
  // T142 — confirmação de escrita. Antes, admitir fechava o formulário em
  // silêncio: a pessoa ficava olhando a lista sem saber se salvou.
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  // T167 — o colaborador recém-admitido, para a confirmação oferecer o
  // caminho até a ficha dele. Vem da RESPOSTA da admissão, não de nova busca.
  const [admitidoRecente, setAdmitidoRecente] = useState<ColaboradorApi | null>(
    null,
  );
  /**
   * Pedido de foco no primeiro erro, atendido depois que o React desenha as
   * mensagens. Um ref, e não estado: é um gatilho de uma vez só, e não deve
   * causar outro desenho.
   */
  const focarPrimeiroErroRef = useRef(false);
  // T142 (piloto) — o painel de trabalho precisa ser encontrável: quando abre,
  // entra no campo de visão e recebe o foco; quando fecha, devolve o foco a
  // quem o abriu. Sem isto o botão "Novo colaborador" parecia não fazer nada,
  // porque o formulário nascia centenas de pixels abaixo da dobra.
  // O foco inicial, o foco preso, o Escape e a devolução do foco ao acionador
  // são responsabilidade do `Modal` (UI-F04) — a tela só diz o que abre.
  /** Envio em curso — trava síncrona, ver `handleSubmit`. */
  const enviandoRef = useRef(false);
  /** Salvamento do nome em curso — mesma trava síncrona, ver `handleSalvarNome`. */
  const salvandoNomeRef = useRef(false);
  /**
   * Sequência do pedido de lista em voo.
   *
   * Trocar um filtro dispara `carregarDados` sem cancelar o anterior. Se a
   * primeira resposta chegar DEPOIS da segunda, ela sobrescreve a lista com
   * dados que não correspondem ao filtro na tela. O contador resolve sem
   * `AbortController`: a resposta só é aplicada se ainda for a mais recente.
   */
  const pedidoListaRef = useRef(0);

  // T167 — foco no primeiro campo com erro, depois que as mensagens existem.
  useEffect(() => {
    if (!focarPrimeiroErroRef.current || !formulario) return;
    focarPrimeiroErroRef.current = false;
    const campo = ORDEM_DOS_ERROS.find((c) => formulario.erros[c]);
    if (!campo) return;
    document.getElementById(ID_DO_ERRO[campo])?.focus();
  }, [formulario]);

  const formularioAlterado =
    formulario !== null &&
    (formulario.nome !== "" ||
      formulario.matricula !== "" ||
      formulario.tipo !== "" ||
      formulario.dataAdmissao !== "" ||
      formulario.tipoDestino !== "" ||
      formulario.destinoId !== "");

  // T144 (R1) — o detalhe também edita, e portanto também tem o que perder: o
  // nome. Um só derivado governa a confirmação de descarte do `Modal` e o
  // botão de salvar; se divergissem, a janela fecharia calada com o botão
  // ainda habilitado. Compara o valor normalizado com o nome já carregado, e
  // por isso volta sozinho a `false` depois de salvar, quando o nome gravado
  // passa a ser o nome em edição.
  const detalheNomeAlterado =
    detalhe !== null && detalhe.nomeEdicao.trim() !== detalhe.colaborador.nome;

  const carregarDados = useCallback(
    async (
      situacao: FiltroSituacao,
      situacaoVinculo: FiltroSituacaoVinculo,
      paginaPedida: number,
    ) => {
      const pedido = ++pedidoListaRef.current;
      setStatusCarregamento("carregando");
      try {
        const query: {
          situacao?: "ativo" | "inativo";
          situacaoVinculo?: "previsto" | "ativo" | "encerrado";
          pagina: number;
          tamanhoPagina: number;
        } = { pagina: paginaPedida, tamanhoPagina: TAMANHO_PAGINA };
        if (situacao !== "todos") query.situacao = situacao;
        if (situacaoVinculo !== "todos")
          query.situacaoVinculo = situacaoVinculo;
        const resp = await listarColaboradores(query);
        // Resposta obsoleta: outro filtro já pediu a lista depois desta.
        // Aplicá-la mostraria dados que não correspondem ao filtro na tela.
        if (pedido !== pedidoListaRef.current) return null;
        setColaboradores(resp.itens);
        // Página e total saem da RESPOSTA. Se a tela guardasse o que pediu, um
        // servidor que ajustasse a página (ou um filtro que encolhesse o
        // conjunto) deixaria o rodapé mentindo sobre onde a pessoa está.
        setPagina(resp.pagina);
        setTotal(resp.total);
        setTamanhoPaginaEfetivo(tamanhoDePaginaValido(resp.tamanhoPagina));
        setStatusCarregamento("dados");
        return resp.itens;
      } catch {
        if (pedido !== pedidoListaRef.current) return null;
        setStatusCarregamento("erro");
        return null;
      }
    },
    [],
  );

  /**
   * Trocar de filtro volta para a PRIMEIRA página.
   *
   * Sem isto, quem estivesse na página 3 e filtrasse por "Ativo" pediria a
   * página 3 de um conjunto que talvez tenha uma só — e receberia uma lista
   * vazia que parece "nenhum colaborador ativo", quando na verdade há vários
   * na página 1. O filtro muda o conjunto; a posição dentro dele não
   * sobrevive à mudança.
   */
  useEffect(() => {
    void carregarDados(filtroSituacao, filtroSituacaoVinculo, 1);
  }, [filtroSituacao, filtroSituacaoVinculo, carregarDados]);

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPaginaEfetivo));
  const carregando = statusCarregamento === "carregando";

  function irParaPagina(destino: number) {
    if (destino < 1 || destino > totalPaginas || carregando) return;
    void carregarDados(filtroSituacao, filtroSituacaoVinculo, destino);
  }

  async function abrirFormulario() {
    setMensagemSucesso(null);
    setAdmitidoRecente(null);
    setDetalhe(null);
    setFormulario({
      nome: "",
      empresas: [],
      empresaId: "",
      matricula: "",
      tipo: "",
      dataAdmissao: "",
      tipoDestino: "",
      destinoId: "",
      departamentoIdArea: "",
      departamentos: [],
      unidades: [],
      equipes: [],
      cargos: [],
      centrosCusto: [],
      areasDoDepartamento: [],
      carregandoAreas: false,
      carregandoOpcoes: true,
      erros: {},
      salvando: false,
    });

    try {
      const [
        empresasResp,
        departamentosResp,
        unidadesResp,
        equipesResp,
        cargosResp,
        centrosResp,
      ] = await Promise.all([
        listarEmpresasMulti(),
        listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
        listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
        listarEquipes({ status: "ativo", tamanhoPagina: 100 }),
        listarCargos({ status: "ativo", tamanhoPagina: 100 }),
        listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
      ]);
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              empresas: empresasResp.itens,
              // T167 — a empresa da admissão é a ÚNICA que o servidor devolve
              // para a sessão (`GET /v1/empresas` já vem escopado pela empresa
              // ativa). Nenhuma, ou mais de uma, não é escolha a oferecer: é
              // estado que o formulário não sabe resolver, e ele não envia.
              empresaId:
                empresasResp.itens.length === 1
                  ? (empresasResp.itens[0]?.id ?? "")
                  : "",
              ...(empresasResp.itens.length === 1
                ? {}
                : { erros: { geral: MENSAGEM_EMPRESA_INDEFINIDA } }),
              departamentos: departamentosResp.itens,
              unidades: unidadesResp.itens,
              equipes: equipesResp.itens,
              cargos: cargosResp.itens,
              centrosCusto: centrosResp.itens,
              carregandoOpcoes: false,
            }
          : prev,
      );
    } catch {
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              carregandoOpcoes: false,
              erros: {
                geral:
                  "Não foi possível carregar as opções de lotação. Feche e tente novamente.",
              },
            }
          : prev,
      );
    } finally {
      enviandoRef.current = false;
    }
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  async function selecionarDepartamentoArea(departamentoId: string) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            departamentoIdArea: departamentoId,
            destinoId: "",
            areasDoDepartamento: [],
            carregandoAreas: departamentoId !== "",
            erros: limparErroDoCampo(
              limparErroDoCampo(prev.erros, "departamentoArea"),
              "destino",
            ),
          }
        : prev,
    );
    if (!departamentoId) return;
    try {
      const resp = await listarAreas({
        departamentoId,
        status: "ativo",
        tamanhoPagina: 100,
      });
      setFormulario((prev) =>
        prev
          ? { ...prev, areasDoDepartamento: resp.itens, carregandoAreas: false }
          : prev,
      );
    } catch {
      setFormulario((prev) =>
        prev ? { ...prev, carregandoAreas: false } : prev,
      );
    }
  }

  function selecionarTipoDestino(tipoDestino: TipoDestino) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            tipoDestino,
            destinoId: "",
            departamentoIdArea: "",
            areasDoDepartamento: [],
            erros: limparErroDoCampo(
              limparErroDoCampo(
                limparErroDoCampo(prev.erros, "tipoDestino"),
                "departamentoArea",
              ),
              "destino",
            ),
          }
        : prev,
    );
  }

  // T176 — atende a abertura pedida pela página de Nova admissão, uma vez.
  const aberturaAtendidaRef = useRef(false);
  useEffect(() => {
    if (!aberturaInicial || aberturaAtendidaRef.current) return;
    aberturaAtendidaRef.current = true;
    abrirDetalhe(aberturaInicial.colaborador);
    setFocarContatos(aberturaInicial.foco === "contatos");
    onAberturaAtendida?.();
    // `abrirDetalhe` é recriada a cada desenho; a abertura vale só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberturaInicial, onAberturaAtendida]);

  function abrirDetalhe(colaborador: ColaboradorApi) {
    setMensagemSucesso(null);
    setAdmitidoRecente(null);
    setFormulario(null);
    setDetalhe({
      colaborador,
      statusVinculos: "carregando",
      vinculos: [],
      nomeEdicao: colaborador.nome,
      salvandoNome: false,
      erroNome: null,
    });
    void carregarVinculos(colaborador.id);
  }

  async function carregarVinculos(colaboradorId: string) {
    setDetalhe((prev) =>
      prev ? { ...prev, statusVinculos: "carregando" } : prev,
    );
    try {
      const vinculos = await listarVinculosDoColaborador(colaboradorId);
      // Só escreve se o detalhe aberto ainda for o MESMO colaborador. Sem esta
      // conferência, fechar o detalhe de A e abrir o de B fazia a resposta
      // atrasada de A gravar os vínculos de A no painel de B — dado de uma
      // pessoa aparecendo na ficha de outra.
      setDetalhe((prev) =>
        prev && prev.colaborador.id === colaboradorId
          ? { ...prev, vinculos, statusVinculos: "dados" }
          : prev,
      );
    } catch {
      setDetalhe((prev) =>
        prev && prev.colaborador.id === colaboradorId
          ? { ...prev, statusVinculos: "erro" }
          : prev,
      );
    }
  }

  function fecharDetalhe() {
    setDetalhe(null);
    setFocarContatos(false);
  }

  async function handleSalvarNome() {
    if (!detalhe) return;
    // Mesma trava síncrona da admissão: `disabled` depende de um `setState`,
    // que só chega no próximo render, e cliques no mesmo quadro escapam dele.
    if (salvandoNomeRef.current) return;
    const nome = detalhe.nomeEdicao.trim();
    if (!nome) {
      setDetalhe((prev) =>
        prev ? { ...prev, erroNome: "Nome é obrigatório." } : prev,
      );
      return;
    }
    if (nome.length > 160) {
      setDetalhe((prev) =>
        prev
          ? { ...prev, erroNome: "Nome deve ter no máximo 160 caracteres." }
          : prev,
      );
      return;
    }

    salvandoNomeRef.current = true;
    setDetalhe((prev) =>
      prev ? { ...prev, salvandoNome: true, erroNome: null } : prev,
    );
    try {
      const dto: RetificarColaboradorDto = { nome };
      const atualizado = await retificarColaborador(
        detalhe.colaborador.id,
        dto,
      );
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              colaborador: atualizado,
              nomeEdicao: atualizado.nome,
              salvandoNome: false,
            }
          : prev,
      );
      setColaboradores((prev) =>
        prev.map((c) => (c.id === atualizado.id ? atualizado : c)),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o nome. Tente novamente.";
      setDetalhe((prev) =>
        prev ? { ...prev, salvandoNome: false, erroNome: mensagem } : prev,
      );
    } finally {
      // Libera só depois que a tentativa termina — sucesso ou falha —, para
      // que corrigir e reenviar continue possível.
      salvandoNomeRef.current = false;
    }
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;
    // Trava SÍNCRONA contra envio duplicado. `disabled` no botão depende de um
    // `setState`, que só chega no próximo render: cliques repetidos no mesmo
    // quadro escapariam dele — e escapavam, medido no navegador (três cliques,
    // três requisições). O ref fecha a porta no mesmo instante.
    if (enviandoRef.current) return;

    const erros: FormularioErros = {};
    const nome = formulario.nome.trim();
    if (!nome) {
      erros.nome = "Nome é obrigatório.";
    } else if (nome.length < 2 || nome.length > 160) {
      erros.nome = "Nome deve ter entre 2 e 160 caracteres.";
    }
    if (!formulario.empresaId) {
      erros.geral = MENSAGEM_EMPRESA_INDEFINIDA;
    }
    const matricula = formulario.matricula.trim().toUpperCase();
    if (!MATRICULA_PATTERN.test(matricula)) {
      erros.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    if (!formulario.tipo) {
      erros.tipo = "Selecione o tipo de vínculo.";
    }
    if (!formulario.dataAdmissao) {
      erros.dataAdmissao = "Informe a data de admissão.";
    }
    // T142 — cada erro fica no campo que precisa ser preenchido. Antes, faltar
    // o REGISTRO marcava o seletor de TIPO, que já estava preenchido: a tela
    // apontava para o campo errado e deixava o campo vazio sem marcação.
    if (!formulario.tipoDestino) {
      erros.tipoDestino = "Escolha o tipo de referência organizacional.";
    } else if (
      formulario.tipoDestino === "area" &&
      !formulario.departamentoIdArea
    ) {
      erros.departamentoArea = "Selecione o departamento da área.";
    } else if (!formulario.destinoId) {
      erros.destino = `Selecione o registro de ${rotuloTipoDestino(
        formulario.tipoDestino,
      ).toLowerCase()}.`;
    }

    if (
      erros.nome ??
      erros.geral ??
      erros.matricula ??
      erros.tipo ??
      erros.dataAdmissao ??
      erros.tipoDestino ??
      erros.departamentoArea ??
      erros.destino
    ) {
      focarPrimeiroErroRef.current = true;
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    enviandoRef.current = true;
    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      // Só a empresa que o servidor devolveu para a sessão — nunca escolha.
      const empresaId = formulario.empresaId;

      const dto: AdmitirColaboradorDto = {
        nome,
        empresaId,
        matricula,
        tipo: formulario.tipo as TipoVinculo,
        dataAdmissao: formulario.dataAdmissao,
        motivoCodigo: "admissao_inicial",
        ...(formulario.tipoDestino === "unidade"
          ? { unidadeOrganizacionalId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "departamento"
          ? { departamentoId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "area"
          ? {
              areaId: formulario.destinoId,
              departamentoId: formulario.departamentoIdArea,
            }
          : {}),
        ...(formulario.tipoDestino === "equipe"
          ? { equipeId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "cargo"
          ? { cargoId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "centroCusto"
          ? { centroCustoId: formulario.destinoId }
          : {}),
      };
      const admitido: AdmissaoRegistradaApi = await admitirColaborador(dto);
      const nomeAdmitido = admitido.nome;
      fecharFormulario();
      // A confirmação sai assim que o SERVIDOR confirma — não depende do
      // refetch —, mas não pode mais afirmar que o registro está visível.
      // A admissão nasce com colaborador `inativo` e vínculo `previsto`
      // (contrato: só a efetivação ativa); com o filtro em "Ativo", o
      // recém-admitido não volta na lista, e o texto antigo garantia que sim.
      const ocultoPorSituacao =
        filtroSituacao !== "todos" && filtroSituacao !== admitido.situacao;
      const ocultoPorVinculo =
        filtroSituacaoVinculo !== "todos" &&
        filtroSituacaoVinculo !== "previsto";
      // T167 — a confirmação usa o que o SERVIDOR gravou (matrícula e
      // situação do vínculo vêm da resposta), não o que estava digitado.
      const confirmacao = `Colaborador ${nomeAdmitido} admitido com a matrícula ${admitido.vinculo.matricula}. O vínculo começa ${ROTULO_SITUACAO_VINCULO[admitido.vinculo.situacao] ?? admitido.vinculo.situacao} e o colaborador ${admitido.situacao === "ativo" ? "Ativo" : "Inativo"} até a efetivação da admissão.`;
      setMensagemSucesso(
        ocultoPorSituacao || ocultoPorVinculo
          ? `${confirmacao} Ele não aparece na lista porque os filtros atuais o excluem.`
          : `${confirmacao} Ele já aparece na lista abaixo.`,
      );
      setAdmitidoRecente({
        id: admitido.id,
        nome: admitido.nome,
        situacao: admitido.situacao,
        criadoEm: admitido.criadoEm,
        atualizadoEm: admitido.atualizadoEm,
      });
      await carregarDados(filtroSituacao, filtroSituacaoVinculo, pagina);
    } catch (err: unknown) {
      // Os dados digitados ficam: só o estado de envio e as mensagens mudam.
      const erros = errosDaAdmissaoRecusada(err, formulario.tipoDestino !== "");
      focarPrimeiroErroRef.current = true;
      setFormulario((prev) =>
        prev ? { ...prev, salvando: false, erros } : prev,
      );
    } finally {
      // Libera a trava só aqui: depois que a tentativa termina de verdade
      // (sucesso ou falha), nunca antes. Sem isto, uma falha deixava
      // `enviandoRef.current` travado para sempre — o botão reaparecia
      // habilitado, mas o próximo clique retornava em silêncio em `:416`,
      // e não havia como corrigir o campo e reenviar sem fechar o modal.
      enviandoRef.current = false;
    }
  }

  const opcoesDestinoAtuais: { id: string; rotulo: string }[] =
    formulario?.tipoDestino === "unidade"
      ? (formulario.unidades.map((u) => ({
          id: u.id,
          rotulo: `${u.codigo} — ${u.nome}`,
        })) ?? [])
      : formulario?.tipoDestino === "departamento"
        ? formulario.departamentos.map((d) => ({
            id: d.id,
            rotulo: `${d.codigo} — ${d.nome}`,
          }))
        : formulario?.tipoDestino === "area"
          ? formulario.areasDoDepartamento.map((a) => ({
              id: a.id,
              rotulo: `${a.codigo} — ${a.nome}`,
            }))
          : formulario?.tipoDestino === "equipe"
            ? (formulario.equipes.map((e) => ({
                id: e.id,
                rotulo: `${e.codigo} — ${e.nome}`,
              })) ?? [])
            : formulario?.tipoDestino === "cargo"
              ? (formulario.cargos.map((c) => ({
                  id: c.id,
                  rotulo: `${c.codigo} — ${c.nome}`,
                })) ?? [])
              : formulario?.tipoDestino === "centroCusto"
                ? (formulario.centrosCusto.map((c) => ({
                    id: c.id,
                    rotulo: `${c.codigo} — ${c.nome}`,
                  })) ?? [])
                : [];

  const tipoDestinoEscolhido = formulario?.tipoDestino
    ? rotuloTipoDestino(formulario.tipoDestino)
    : null;

  const colunasColaboradores: DataTableColumn<ColaboradorApi>[] = [
    { key: "nome", header: "Nome", cell: (c) => c.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (c) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_COLABORADOR[c.situacao] ?? "neutral"}
        >
          {c.situacao === "ativo" ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      // T164 — `criadoEm` é quando o CADASTRO nasceu, e o rótulo diz isso.
      // Não é data de admissão: admissão vive no vínculo, que esta rota não
      // projeta. Chamar de "Admissão" seria barato e errado.
      key: "criadoEm",
      header: "Cadastrado em",
      cell: (c) => formatarInstante(c.criadoEm),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (c) => (
        <Button
          variant="secondary"
          onClick={(evento) => {
            evento.currentTarget.focus();
            abrirDetalhe(c);
          }}
          aria-haspopup="dialog"
          aria-expanded={detalhe?.colaborador.id === c.id}
        >
          Ver detalhes
          <span className="sr-only"> — {c.nome}</span>
        </Button>
      ),
    },
  ];

  const colunasVinculos: DataTableColumn<VinculoApi>[] = [
    { key: "matricula", header: "Matrícula", cell: (v) => v.matricula },
    {
      key: "tipo",
      header: "Tipo",
      cell: (v) => ROTULO_TIPO_VINCULO[v.tipo] ?? v.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_VINCULO[v.situacao] ?? "neutral"}
        >
          {ROTULO_SITUACAO_VINCULO[v.situacao] ?? v.situacao}
        </StatusBadge>
      ),
    },
    {
      // Dias civis (`@db.Date`): o Prisma os entrega como datetime ISO, e
      // `formatarDiaCivil` lê os componentes direto da string — `Date` não
      // entra no caminho, logo o dia exibido nunca recua a oeste de Greenwich.
      key: "admissao",
      header: "Admissão",
      cell: (v) => formatarDiaCivil(v.dataAdmissao),
    },
    {
      key: "desligamento",
      header: "Desligamento",
      cell: (v) => formatarDiaCivil(v.dataDesligamento),
    },
  ];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Administre a admissão e o cadastro de colaboradores da sua empresa. Situação, vínculo e lotação seguem sempre a fonte de verdade do backend."
        actions={
          <Button
            onClick={(evento) => {
              evento.currentTarget.focus();
              void abrirFormulario();
            }}
            aria-haspopup="dialog"
            aria-expanded={formulario !== null}
          >
            Novo colaborador
          </Button>
        }
      />

      {mensagemSucesso ? (
        <Surface
          as="section"
          padding="md"
          className="colaboradores-screen__sucesso"
        >
          {/* `role="status"` anuncia sem roubar o foco de quem está digitando. */}
          <p className="colaboradores-screen__sucesso-texto" role="status">
            {mensagemSucesso}
          </p>
          {admitidoRecente ? (
            <Button
              type="button"
              variant="primary"
              aria-haspopup="dialog"
              onClick={() => abrirDetalhe(admitidoRecente)}
            >
              Abrir ficha de {admitidoRecente.nome}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMensagemSucesso(null);
              setAdmitidoRecente(null);
            }}
          >
            Dispensar
          </Button>
        </Surface>
      ) : null}

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-rh-titulo"
      >
        <StatusBadge variant="info">RH e DP</StatusBadge>
        <p
          id="colaboradores-aviso-rh-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Este cadastro é operado exclusivamente pelo RH e DP da própria
          empresa. Admissão, consulta e alteração de nome aqui geram trilha de
          auditoria automática.
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
          Transferência, mudança de cargo, desligamento, reclassificação de
          vínculo, Folha, documentos, benefícios, dependentes, afastamentos e
          Banco de Horas ainda não têm operação nesta tela.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
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
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void carregarDados(filtroSituacao, filtroSituacaoVinculo, pagina)
            }
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section
          className="colaboradores-screen__lista"
          aria-labelledby="colaboradores-lista-titulo"
        >
          {/* O H1 da página já diz "Colaboradores"; repetir aqui só somava
              ruído. A seção passa a nomear o que a lista realmente é. */}
          <h2
            id="colaboradores-lista-titulo"
            className="colaboradores-screen__section-title"
          >
            {empresaAtiva
              ? `Colaboradores de ${empresaAtiva.nome}`
              : "Colaboradores desta empresa"}
          </h2>

          {/* T164 — contexto e tamanho do conjunto, lado a lado.

              O total vem do SERVIDOR, do mesmo `total` que paginou a consulta.
              Não é `colaboradores.length`: esse número seria o da página, e
              exibi-lo como total faria "20" significar "vinte pessoas" numa
              empresa com duzentas.

              Não há contagem por situação porque a API não a oferece — só o
              total do conjunto já filtrado. Desenhar contadores por faixa
              exigiria somá-los no cliente, o que obrigaria a baixar tudo. */}
          <p className="colaboradores-screen__contexto">
            {empresaAtiva ? (
              <span className="colaboradores-screen__empresa">
                {empresaAtiva.nome}{" "}
                <span className="colaboradores-screen__empresa-codigo">
                  ({empresaAtiva.codigo})
                </span>
              </span>
            ) : null}
            {/* Sem `role="status"`: a tela ja tem duas regioes vivas - a
                mensagem de carregamento e a posicao da paginacao. Uma terceira
                faria o leitor de tela anunciar o total a cada filtro, por cima
                das outras duas, e tres avisos simultaneos nao informam: atropelam. */}
            <span className="colaboradores-screen__total">
              {statusCarregamento === "dados"
                ? total === 1
                  ? "1 colaborador no filtro atual"
                  : `${total} colaboradores no filtro atual`
                : "Contando…"}
            </span>
          </p>

          <div className="colaboradores-screen__filtros">
            <FormField id="colaboradores-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(e) =>
                    setFiltroSituacao(e.target.value as FiltroSituacao)
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

            <FormField
              id="colaboradores-filtro-situacao-vinculo"
              label="Situação do vínculo"
            >
              {(control) => (
                <select
                  value={filtroSituacaoVinculo}
                  onChange={(e) =>
                    setFiltroSituacaoVinculo(
                      e.target.value as FiltroSituacaoVinculo,
                    )
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas</option>
                  <option value="previsto">Previsto</option>
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="colaboradores-screen__carregando" role="status">
              Carregando colaboradores…
            </p>
          ) : colaboradores.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum colaborador cadastrado"
              description="Registre a admissão do primeiro colaborador desta empresa."
              action={
                <Button
                  onClick={(evento) => {
                    evento.currentTarget.focus();
                    void abrirFormulario();
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={formulario !== null}
                >
                  Novo colaborador
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Colaboradores desta empresa"
              captionVisible={false}
              columns={colunasColaboradores}
              rows={colaboradores}
              rowKey={(c) => c.id}
            />
          )}

          {/* T164, com a correção R-2 da revisão adversarial.

              A navegação fica FORA do ramo que troca durante o carregamento.
              Antes ela vivia junto da tabela, dentro do `else`: acionar
              "Próxima página" desmontava o botão que tinha o foco, e o foco
              caía no `<body>` — quem navega por teclado perdia a posição a
              cada troca de página e tinha de tabular de volta.

              Os controles ficam inertes por `aria-disabled`, e não por
              `disabled`. A diferença é exatamente o ponto: um botão
              `disabled` que tem o foco também o perde, porque deixa de ser
              focalizável. Com `aria-disabled` ele permanece no foco e na
              ordem de tabulação, anuncia o estado ao leitor de tela, e quem
              recusa a ação é `irParaPagina` — que já retorna cedo quando a
              página é inválida ou há carga em voo.

              `aria-busy` no `<nav>` informa o carregamento sem depender de o
              texto mudar. */}
          {totalPaginas > 1 ? (
            <nav
              className="colaboradores-screen__paginacao"
              aria-label="Paginação de colaboradores"
              aria-busy={carregando}
            >
              <Button
                variant="secondary"
                onClick={() => irParaPagina(pagina - 1)}
                aria-disabled={pagina <= 1 || carregando}
              >
                Página anterior
              </Button>
              <span
                role="status"
                className="colaboradores-screen__paginacao-posicao"
              >
                {carregando
                  ? "Carregando página…"
                  : `Página ${pagina} de ${totalPaginas}`}
              </span>
              <Button
                variant="secondary"
                onClick={() => irParaPagina(pagina + 1)}
                aria-disabled={pagina >= totalPaginas || carregando}
              >
                Próxima página
              </Button>
            </nav>
          ) : null}
        </section>
      )}

      <Modal
        aberto={detalhe !== null}
        titulo={detalhe?.colaborador.nome ?? ""}
        onFechar={fecharDetalhe}
        bloqueado={(detalhe?.salvandoNome ?? false) || salvandoContatos}
        alterado={detalheNomeAlterado || contatosAlterados}
        largura="media"
      >
        {detalhe ? (
          <>
            <p>
              <StatusBadge
                variant={
                  VARIANTE_SITUACAO_COLABORADOR[detalhe.colaborador.situacao] ??
                  "neutral"
                }
              >
                {detalhe.colaborador.situacao === "ativo" ? "Ativo" : "Inativo"}
              </StatusBadge>
            </p>
            <p className="colaboradores-screen__aviso-texto">
              Matrícula, tipo de vínculo e data de admissão são imutáveis nesta
              tela. Apenas o nome e os contatos podem ser corrigidos abaixo.
            </p>

            <div className="colaboradores-screen__edicao-nome">
              <FormField
                id="colaboradores-detalhe-nome"
                label="Nome"
                {...(detalhe.erroNome ? { error: detalhe.erroNome } : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={160}
                    value={detalhe.nomeEdicao}
                    onChange={(e) =>
                      setDetalhe((prev) =>
                        prev
                          ? {
                              ...prev,
                              nomeEdicao: e.target.value,
                              erroNome: null,
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
                onClick={() => void handleSalvarNome()}
                disabled={detalhe.salvandoNome || !detalheNomeAlterado}
              >
                {detalhe.salvandoNome ? "Salvando…" : "Salvar nome"}
              </Button>
            </div>

            {/* T177 — Módulo 1: dados pessoais e endereço, só leitura. */}
            <DadosPessoaisColaboradorSecao
              key={`dados-${detalhe.colaborador.id}`}
              colaboradorId={detalhe.colaborador.id}
            />

            <ContatosColaboradorSecao
              key={detalhe.colaborador.id}
              colaboradorId={detalhe.colaborador.id}
              onAlteradoChange={setContatosAlterados}
              onSalvandoChange={setSalvandoContatos}
              focarAoCarregar={focarContatos}
            />

            <div className="colaboradores-screen__vinculos">
              <h3 className="colaboradores-screen__section-title">Vínculos</h3>
              {detalhe.statusVinculos === "carregando" ? (
                <p className="colaboradores-screen__carregando" role="status">
                  Carregando vínculos…
                </p>
              ) : detalhe.statusVinculos === "erro" ? (
                <p className="colaboradores-screen__form-erro" role="alert">
                  Não foi possível carregar os vínculos deste colaborador.{" "}
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void carregarVinculos(detalhe.colaborador.id)
                    }
                  >
                    Tentar novamente
                  </Button>
                </p>
              ) : detalhe.vinculos.length === 0 ? (
                <p>Nenhum vínculo encontrado.</p>
              ) : (
                <DataTable
                  caption={`Vínculos — ${detalhe.colaborador.nome}`}
                  columns={colunasVinculos}
                  rows={detalhe.vinculos}
                  rowKey={(v) => v.id}
                />
              )}
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        aberto={formulario !== null}
        titulo="Novo colaborador"
        descricao="A admissão cria o colaborador e o primeiro vínculo em conjunto. Matrícula, tipo de vínculo, data de admissão e referência inicial são imutáveis nesta tela — corrija apenas o nome depois, se necessário."
        onFechar={fecharFormulario}
        bloqueado={formulario?.salvando ?? false}
        alterado={formularioAlterado}
        largura="larga"
      >
        {formulario ? (
          <form
            className="colaboradores-screen__form"
            aria-label="Formulário de novo colaborador"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <FormField
              id="colaboradores-nome"
              label="Nome completo"
              required
              help="2 a 160 caracteres."
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
                        ? {
                            ...prev,
                            nome: e.target.value,
                            erros: limparErroDoCampo(prev.erros, "nome"),
                          }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.empresas.length === 1 && formulario.empresas[0] ? (
              <p
                className="colaboradores-screen__aviso-texto"
                id="colaboradores-empresa-contexto"
              >
                Empresa da admissão:{" "}
                <strong>{formulario.empresas[0].nome}</strong> (
                {formulario.empresas[0].codigo}) — a empresa ativa em que você
                está trabalhando. Não é editável aqui.
              </p>
            ) : null}

            <FormField
              id="colaboradores-matricula"
              label="Matrícula"
              required
              help="Letras maiúsculas, números, - e _ (2 a 32 caracteres)."
              {...(formulario.erros.matricula
                ? { error: formulario.erros.matricula }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={32}
                  value={formulario.matricula}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            matricula: e.target.value.toUpperCase(),
                            erros: limparErroDoCampo(prev.erros, "matricula"),
                          }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="colaboradores-tipo-vinculo"
              label="Tipo de vínculo"
              required
              {...(formulario.erros.tipo
                ? { error: formulario.erros.tipo }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.tipo}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            tipo: e.target.value as TipoVinculo,
                            erros: limparErroDoCampo(prev.erros, "tipo"),
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {(Object.keys(ROTULO_TIPO_VINCULO) as TipoVinculo[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_VINCULO[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField
              id="colaboradores-data-admissao"
              label="Data de admissão"
              required
              {...(formulario.erros.dataAdmissao
                ? { error: formulario.erros.dataAdmissao }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.dataAdmissao}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            dataAdmissao: e.target.value,
                            erros: limparErroDoCampo(
                              prev.erros,
                              "dataAdmissao",
                            ),
                          }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="colaboradores-tipo-destino"
              label="Tipo de referência organizacional"
              required
              help="Primeiro escolha o tipo; o registro é escolhido no campo seguinte."
              {...(formulario.erros.tipoDestino
                ? { error: formulario.erros.tipoDestino }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.tipoDestino}
                  onChange={(e) =>
                    selecionarTipoDestino(e.target.value as TipoDestino)
                  }
                  disabled={formulario.carregandoOpcoes}
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {OPCOES_TIPO_DESTINO.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {formulario.tipoDestino === "area" ? (
              <FormField
                id="colaboradores-departamento-area"
                label="Departamento da área"
                required
                help="A área só identifica a lotação junto com o departamento a que pertence."
                {...(formulario.erros.departamentoArea
                  ? { error: formulario.erros.departamentoArea }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.departamentoIdArea}
                    onChange={(e) =>
                      void selecionarDepartamentoArea(e.target.value)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {formulario.departamentos.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.codigo} — {dep.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formulario.tipoDestino ? (
              <FormField
                id="colaboradores-destino"
                label="Registro da referência organizacional"
                required
                help={`Tipo escolhido: ${tipoDestinoEscolhido}. Uma referência é suficiente para efetivar a admissão.`}
                {...(formulario.erros.destino
                  ? { error: formulario.erros.destino }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.destinoId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? {
                              ...prev,
                              destinoId: e.target.value,
                              erros: limparErroDoCampo(prev.erros, "destino"),
                            }
                          : prev,
                      )
                    }
                    disabled={
                      formulario.tipoDestino === "area" &&
                      (!formulario.departamentoIdArea ||
                        formulario.carregandoAreas)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {opcoesDestinoAtuais.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formulario.erros.geral ? (
              <p
                className="colaboradores-screen__form-erro"
                role="alert"
                id={ERRO_GERAL_ID}
                tabIndex={-1}
              >
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <CancelarFormulario desabilitado={formulario.salvando} />
              <Button
                type="submit"
                variant="primary"
                disabled={formulario.salvando || formulario.carregandoOpcoes}
              >
                {formulario.salvando ? "Admitindo…" : "Admitir colaborador"}
              </Button>
            </FormActions>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
