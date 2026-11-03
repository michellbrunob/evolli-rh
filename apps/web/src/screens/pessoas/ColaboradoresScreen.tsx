import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  BUSCA_COLABORADORES_MAXIMO,
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type GrupoColaboradores,
  type ListarColaboradoresQuery,
  type LotacaoListadaApi,
  type VinculoListadoApi,
  listarColaboradores,
} from "../../api/colaboradoresClient";
import {
  type DepartamentoApi,
  listarDepartamentos,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import {
  type AbaDaListagem,
  type EstadoDaListagem,
  type OpcoesDaMudancaDaListagem,
  type TipoDeVinculo,
  ABAS_DA_LISTAGEM,
  ESTADO_INICIAL_DA_LISTAGEM,
  TIPOS_DE_VINCULO,
  abaTemLotacao,
  normalizarEstadoDaListagem,
} from "../../app/rotasDoShell";
import { formatarDiaCivil } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import {
  diaDeHoje,
  rotuloDaJornada,
  situacaoDaVigencia,
} from "./jornadaColaborador";
import {
  IconeAdicionarPessoa,
  PainelAdicionarColaborador,
} from "./PainelAdicionarColaborador";
import { iniciaisDe } from "./FichaColaboradorScreen";
import { PessoasHorarioScreen } from "./PessoasHorarioScreen";
import "./ColaboradoresScreen.css";

export const COLABORADORES_TITULO_ID = "colaboradores-titulo";

/**
 * T199 — dashboard de Colaboradores. A antiga listagem (T178 a T190) ganhou
 * indicadores calculados no servidor, abas por grupo e o estado na URL:
 *
 * - **Grupos exclusivos** (N-1, ativo > previsto > encerrado): Ativos, Em
 *   admissão (D-4), Desligados (D-1) e Todos — cada um consultado e paginado
 *   no servidor (`grupo`). As abas substituem os antigos seletores
 *   Todos/Ativos/Inativos e o select "Situação do vínculo" (N-3).
 * - **Jornada de trabalho** (D-5, N-4): a mesma visão da empresa que já
 *   existia, com as mesmas permissões (só o RH opera).
 * - **Tipo de vínculo** (D-2, N-5): filtro aplicado ao vínculo que define a
 *   aba; distribuição dos ativos pelo vínculo principal (N-2).
 * - **URL** (D-3): aba, página e ids dos filtros, guardados pelo shell. A
 *   busca nunca vai para a URL.
 * - **Escopo** (D-6): sem empresa ativa (`master_tecnico` global), os textos
 *   dizem "no seu escopo", nunca "nesta empresa".
 *
 * Nada de CPF, salário ou contatos na visão coletiva.
 */

/**
 * T190 — catálogos dos filtros de lotação: só departamentos e cargos ATIVOS
 * da empresa ativa (o servidor escopa pela sessão). Uma página de 100, o
 * limite já registrado para os catálogos organizacionais.
 */
type CatalogosDeLotacao =
  | { readonly status: "carregando" }
  | { readonly status: "erro" }
  | {
      readonly status: "dados";
      readonly departamentos: readonly DepartamentoApi[];
      readonly cargos: readonly CargoApi[];
    };

function rotuloDaReferencia(ref: { nome: string; codigo: string }): string {
  return `${ref.nome} (${ref.codigo})`;
}

const ROTULO_DA_ABA: Readonly<Record<AbaDaListagem, string>> = {
  ativos: "Ativos",
  "em-admissao": "Em admissão",
  desligados: "Desligados",
  todos: "Todos",
  jornada: "Jornada de trabalho",
};

/** O grupo que cada aba pede ao servidor ("Todos": sem grupo). */
const GRUPO_DA_ABA: Readonly<
  Partial<Record<AbaDaListagem, GrupoColaboradores>>
> = {
  ativos: "ativos",
  "em-admissao": "em_admissao",
  desligados: "desligados",
};

/** O total de cada aba, dos contadores do servidor (sem filtros). */
function totalDaAba(
  aba: AbaDaListagem,
  c: ContadoresColaboradoresApi,
): number | null {
  switch (aba) {
    case "ativos":
      return c.ativos;
    case "em-admissao":
      return c.emAdmissao;
    case "desligados":
      return c.desligados;
    case "todos":
      return c.total;
    default:
      return null;
  }
}

export const ROTULO_TIPO_DE_VINCULO: Readonly<Record<TipoDeVinculo, string>> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

/** A situação da pessoa no escopo, pela mesma regra dos grupos (N-1). */
type SituacaoNoEscopo = "ativo" | "em_admissao" | "desligado";

function situacaoNoEscopo(c: ColaboradorListadoApi): SituacaoNoEscopo | null {
  if (c.vinculos.some((v) => v.situacao === "ativo")) return "ativo";
  if (c.vinculos.some((v) => v.situacao === "previsto")) return "em_admissao";
  if (c.vinculos.some((v) => v.situacao === "encerrado")) return "desligado";
  return null;
}

const SITUACAO_NO_ESCOPO: Readonly<
  Record<SituacaoNoEscopo, { rotulo: string; variante: StatusVariant }>
> = {
  ativo: { rotulo: "Ativo", variante: "success" },
  em_admissao: { rotulo: "Em admissão", variante: "info" },
  desligado: { rotulo: "Desligado", variante: "neutral" },
};

/** A situação de vínculo que define cada aba (N-5). */
const SITUACAO_DA_ABA: Readonly<
  Partial<Record<AbaDaListagem, VinculoListadoApi["situacao"]>>
> = {
  ativos: "ativo",
  "em-admissao": "previsto",
  desligados: "encerrado",
};

/**
 * T199 — o vínculo que a linha mostra: o que define a aba (ativo em Ativos,
 * previsto em Em admissão, encerrado em Desligados), do tipo filtrado quando
 * há filtro (N-5). Em Todos, o principal (o servidor já ordena: ativo,
 * previsto, encerrado; admissão mais recente primeiro).
 */
function vinculoDaLinha(
  c: ColaboradorListadoApi,
  aba: AbaDaListagem,
  tipo: TipoDeVinculo | null,
): VinculoListadoApi | undefined {
  const situacao = SITUACAO_DA_ABA[aba];
  return (
    c.vinculos.find(
      (v) =>
        (situacao === undefined || v.situacao === situacao) &&
        (tipo === null || v.tipo === tipo),
    ) ?? c.vinculos[0]
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
 * R-1 — o tamanho de página da resposta, quando ele é utilizável. Ausente,
 * não numérico, zero, negativo, fracionário ou não finito volta ao tamanho
 * pedido: uma paginação inventada é pior que nenhuma.
 */
function tamanhoDePaginaValido(valor: unknown): number {
  return typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    Number.isFinite(valor)
    ? valor
    : TAMANHO_PAGINA;
}

/**
 * T178 — o termo como o servidor o aceita: aparado e no teto de 160; `""` é
 * "sem busca". Mora aqui, e não no cliente, porque os testes automockam o
 * cliente inteiro: uma função de lá viraria `vi.fn`.
 */
function normalizarBusca(termo: string): string {
  return termo.trim().slice(0, BUSCA_COLABORADORES_MAXIMO).trim();
}

/**
 * T199 — uma ação disparada de um estado vazio ("Ir para a primeira página",
 * "Limpar filtros"). O estado vazio que a pediu fica montado, como estava,
 * até a resposta: o botão conserva o foco, indisponível. No sucesso, o foco
 * vai ao destino; numa falha, fica no botão e a falha é anunciada uma vez.
 */
interface AcaoDoVazio {
  readonly titulo: string;
  readonly descricao: string;
  readonly rotulo: string;
  /** `id` de quem recebe o foco quando a leitura dá certo. */
  readonly destinoDoFoco: string;
  readonly fase: "carregando" | "falha";
}

/** O campo de busca: destino do foco depois de limpar filtros ou busca. */
const ID_CAMPO_BUSCA = "colaboradores-busca";

const FALHA_DA_LISTA = "Não foi possível carregar os colaboradores.";

const DESCRICAO_PAGINA_VAZIA =
  "Esta página voltou vazia, embora a consulta tenha colaboradores: o conjunto pode ter mudado desde a última leitura.";

function mesmoEstado(a: EstadoDaListagem, b: EstadoDaListagem): boolean {
  return (
    a.aba === b.aba &&
    a.pagina === b.pagina &&
    a.departamentoId === b.departamentoId &&
    a.cargoId === b.cargoId &&
    a.tipo === b.tipo
  );
}

/** Concordância de "N vínculo(s)", para o texto lido por leitor de tela. */
function vinculosAMais(quantidade: number): string {
  return quantidade === 1 ? "1 vínculo" : `${quantidade} vínculos`;
}

export interface ColaboradoresScreenProps {
  /**
   * T164 — a empresa de trabalho ATIVA, resolvida pelo servidor e repassada
   * pelo shell. `null`: `master_tecnico` sem empresa ativa (escopo global).
   */
  readonly empresaAtiva?: {
    readonly nome: string;
    readonly codigo: string;
  } | null;
  readonly onTituloIdChange?: (tituloId: string) => void;
  /**
   * T198 — o nome na linha leva à ficha unificada, em página própria: quem
   * decide o endereço é o shell. Sem esta prop, o nome é só texto.
   */
  readonly onAbrirFicha?: (colaboradorId: string) => void;
  /**
   * T198 — muda quando a pessoa volta da ficha: o dashboard (que ficou
   * montado, com busca, filtros e página) relê a página atual.
   */
  readonly atualizacao?: number;
  /**
   * T194 — "Adicionar colaborador" abre o painel das formas de entrada; o
   * "Cadastro individual" dele chama esta prop. Sem ela (perfil que não
   * admite), nem botão nem painel existem.
   */
  readonly onNovaAdmissao?: () => void;
  /**
   * T199 — o estado do dashboard (aba, página e ids de filtros), guardado
   * pelo shell na URL. Sem ele, o dashboard guarda o próprio estado.
   */
  readonly estado?: EstadoDaListagem;
  readonly onEstadoChange?: (
    estado: EstadoDaListagem,
    opcoes?: OpcoesDaMudancaDaListagem,
  ) => void;
  /** T183/T199 — a aba de jornada opera só para o RH. */
  readonly podeOperarJornada?: boolean;
}

/**
 * T184 — cargo ou departamento da lotação vigente do vínculo da linha. Sem
 * lotação vigente, o texto neutro diz isso; sem a referência, "Não
 * informado". Sem vínculo, "—".
 */
function celulaDaLotacao(
  vinculo: VinculoListadoApi | undefined,
  campo: keyof LotacaoListadaApi,
): ReactNode {
  if (!vinculo) return "—";
  const lotacao = vinculo.lotacaoVigente;
  if (!lotacao) {
    return (
      <span className="colaboradores-screen__sem-lotacao">
        Sem lotação vigente
      </span>
    );
  }
  const referencia = lotacao[campo];
  return referencia ? (
    referencia.nome
  ) : (
    <span className="colaboradores-screen__sem-lotacao">Não informado</span>
  );
}

/**
 * T185 — jornada vigente HOJE (dia civil do navegador) do vínculo ativo da
 * linha. Sem vínculo, "—".
 */
function celulaDaJornada(
  vinculo: VinculoListadoApi | undefined,
  hoje: string,
): ReactNode {
  if (!vinculo) return "—";
  const vigente =
    vinculo.situacao === "ativo"
      ? vinculo.vigenciasDeJornada.find(
          (v) => situacaoDaVigencia(v, hoje) === "vigente",
        )
      : undefined;
  if (!vigente) {
    return (
      <span className="colaboradores-screen__sem-lotacao">
        Sem jornada vigente
      </span>
    );
  }
  return (
    <>
      {rotuloDaJornada(vigente.jornada)}
      {vigente.jornada.ativo ? null : (
        <>
          {" "}
          <StatusBadge variant="warning">Jornada inativa</StatusBadge>
        </>
      )}
    </>
  );
}

export function ColaboradoresScreen({
  empresaAtiva = null,
  onNovaAdmissao,
  onAbrirFicha,
  atualizacao = 0,
  estado: estadoControlado,
  onEstadoChange,
  podeOperarJornada = false,
}: ColaboradoresScreenProps = {}) {
  const prefixo = useId();
  const idDaAba = (aba: AbaDaListagem) => `${prefixo}-aba-${aba}`;
  const idDoPainel = `${prefixo}-painel`;
  const idDoTituloDaSecao = `${prefixo}-secao-titulo`;

  // T199 — controlado pelo shell (URL) ou, montado sozinho, pelo próprio
  // componente. Sempre normalizado: lotação só onde ela existe.
  const [estadoInterno, setEstadoInterno] = useState(
    ESTADO_INICIAL_DA_LISTAGEM,
  );
  const estado = normalizarEstadoDaListagem(estadoControlado ?? estadoInterno);
  const mudarEstado = useCallback(
    (novo: EstadoDaListagem, opcoes?: OpcoesDaMudancaDaListagem) => {
      const normalizado = normalizarEstadoDaListagem(novo);
      if (onEstadoChange) {
        if (opcoes) onEstadoChange(normalizado, opcoes);
        else onEstadoChange(normalizado);
      } else setEstadoInterno(normalizado);
    },
    [onEstadoChange],
  );
  const { aba, tipo, departamentoId, cargoId } = estado;
  const temTabela = aba !== "jornada";

  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  // T178 — a lista vive só nesta montagem: voltar da Nova admissão relê.
  const [colaboradores, setColaboradores] = useState<ColaboradorListadoApi[]>(
    [],
  );
  /**
   * T178 — busca em dois tempos: o que está no campo e o que foi PEDIDO ao
   * servidor (já normalizado). Vai ao servidor só quando a pessoa envia.
   * T199 — nunca vai para a URL (D-3).
   */
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [catalogos, setCatalogos] = useState<CatalogosDeLotacao>({
    status: "carregando",
  });
  const [tentativaCatalogos, setTentativaCatalogos] = useState(0);
  const campoBuscaRef = useRef<HTMLInputElement | null>(null);
  /**
   * T178/T199 — contagens do escopo inteiro, vindas do servidor, SEM busca,
   * filtros nem aba. `null` até a primeira resposta. Nunca somadas no
   * cliente: a página só tem parte do conjunto.
   */
  const [contadores, setContadores] =
    useState<ContadoresColaboradoresApi | null>(null);
  /**
   * T199 — a leitura mínima dos contadores (aba Jornada) falhou: em vez de
   * "…" para sempre, um aviso e "Tentar novamente", que relê SÓ os
   * contadores — a visão de jornadas ao lado continua montada.
   */
  const [falhaContadores, setFalhaContadores] = useState(false);
  const [repetindoContadores, setRepetindoContadores] = useState(false);
  const [tentativaContadores, setTentativaContadores] = useState(0);
  /** Anúncio único da falha e da volta dos totais (região sempre montada). */
  const [anuncioTotais, setAnuncioTotais] = useState("");
  /** Na volta depois de uma falha, o botão some: o foco vai ao título. */
  const focarTotaisRef = useRef(false);
  const tituloTotaisRef = useRef<HTMLHeadingElement | null>(null);
  // T164 — página e total da RESPOSTA: o servidor é quem sabe o conjunto.
  const [paginaRespondida, setPaginaRespondida] = useState(estado.pagina);
  const [total, setTotal] = useState(0);
  const [tamanhoPaginaEfetivo, setTamanhoPaginaEfetivo] =
    useState(TAMANHO_PAGINA);
  /** T194 — painel "Adicionar colaborador": só estado local. */
  const [painelAdicionarAberto, setPainelAdicionarAberto] = useState(false);
  /**
   * Sequência do pedido em voo: a resposta só é aplicada se ainda for a mais
   * recente — um filtro trocado depressa nunca é sobrescrito pelo anterior.
   */
  const pedidoListaRef = useRef(0);
  const [acaoDoVazio, setAcaoDoVazio] = useState<AcaoDoVazio | null>(null);
  const acaoDoVazioRef = useRef(acaoDoVazio);
  acaoDoVazioRef.current = acaoDoVazio;
  /** A próxima carga do efeito foi pedida pela ação do estado vazio. */
  const cargaDaAcaoRef = useRef(false);
  /** Anúncio único da falha de uma ação do vazio (região sempre montada). */
  const [anuncioDaLista, setAnuncioDaLista] = useState("");
  const [focoPendente, setFocoPendente] = useState<string | null>(null);

  const carregarDados = useCallback(
    async (
      consulta: EstadoDaListagem,
      busca: string,
      // T198 — a releitura na volta da ficha não troca a tabela pelo aviso
      // de carregamento: as linhas (e o botão que recebe o foco) continuam.
      silenciosa = false,
      // T199 — pedida por uma ação do estado vazio (ver `AcaoDoVazio`).
      daAcaoDoVazio = false,
    ) => {
      const pedido = ++pedidoListaRef.current;
      // Qualquer outra carga (aba, filtro, página, busca) encerra a ação.
      if (!daAcaoDoVazio) setAcaoDoVazio(null);
      if (!silenciosa) setStatusCarregamento("carregando");
      try {
        // A empresa nunca entra na query: é a da sessão.
        const query: ListarColaboradoresQuery = {
          pagina: consulta.pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        };
        const grupo = GRUPO_DA_ABA[consulta.aba];
        if (grupo) query.grupo = grupo;
        if (consulta.tipo) query.tipoVinculo = consulta.tipo;
        if (busca) query.busca = busca;
        if (consulta.departamentoId)
          query.departamentoId = consulta.departamentoId;
        if (consulta.cargoId) query.cargoId = consulta.cargoId;
        const resp = await listarColaboradores(query);
        if (pedido !== pedidoListaRef.current) return;
        setColaboradores(resp.itens);
        setPaginaRespondida(resp.pagina);
        setTotal(resp.total);
        setTamanhoPaginaEfetivo(tamanhoDePaginaValido(resp.tamanhoPagina));
        setContadores(resp.contadores);
        setFalhaContadores(false);
        setStatusCarregamento("dados");
        if (daAcaoDoVazio) {
          setFocoPendente(acaoDoVazioRef.current?.destinoDoFoco ?? null);
          setAcaoDoVazio(null);
        }
      } catch {
        if (pedido !== pedidoListaRef.current) return;
        setStatusCarregamento("erro");
        const acao = acaoDoVazioRef.current;
        if (daAcaoDoVazio && acao) {
          setAcaoDoVazio({ ...acao, fase: "falha" });
          setAnuncioDaLista(FALHA_DA_LISTA);
        }
      }
    },
    [],
  );

  // O destino do foco depois de uma ação, quando ele já está na tela.
  useEffect(() => {
    if (!focoPendente) return;
    document.getElementById(focoPendente)?.focus();
    setFocoPendente(null);
  }, [focoPendente]);

  /**
   * T199 — um id de lotação vindo da URL só vira consulta depois de
   * conferido nos catálogos da empresa ativa (só ativos): enquanto eles
   * carregam, espera; se o id não está lá (outra empresa, inativo, apagado),
   * cai no padrão, com a URL corrigida no lugar. Se os catálogos falham, o
   * servidor decide (o escopo dele nunca devolve outra empresa).
   */
  const comLotacaoNaAba = abaTemLotacao(aba);
  const aguardandoCatalogos =
    comLotacaoNaAba &&
    (departamentoId !== null || cargoId !== null) &&
    catalogos.status === "carregando";
  const departamentoDesconhecido =
    comLotacaoNaAba &&
    departamentoId !== null &&
    catalogos.status === "dados" &&
    !catalogos.departamentos.some((d) => d.id === departamentoId);
  const cargoDesconhecido =
    comLotacaoNaAba &&
    cargoId !== null &&
    catalogos.status === "dados" &&
    !catalogos.cargos.some((c) => c.id === cargoId);
  const lotacaoDesconhecida = departamentoDesconhecido || cargoDesconhecido;
  useEffect(() => {
    if (!lotacaoDesconhecida) return;
    mudarEstado(
      {
        ...estado,
        pagina: 1,
        departamentoId: departamentoDesconhecido ? null : departamentoId,
        cargoId: cargoDesconhecido ? null : cargoId,
      },
      { substituir: true },
    );
    // A cada estado novo vindo do shell, não só na primeira descoberta: se a
    // URL inválida é reaplicada (voltar, `popstate` e `hashchange` do mesmo
    // passo), a correção é pedida de novo, em vez de ficar presa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotacaoDesconhecida, estadoControlado]);

  // Relê a cada mudança de aba, página, filtro ou busca enviada. A aba de
  // jornada é outra visão: o dashboard não consulta a listagem por ela.
  useEffect(() => {
    if (!temTabela || aguardandoCatalogos || lotacaoDesconhecida) return;
    const daAcaoDoVazio = cargaDaAcaoRef.current;
    cargaDaAcaoRef.current = false;
    void carregarDados(
      { aba, pagina: estado.pagina, departamentoId, cargoId, tipo },
      buscaAplicada,
      false,
      daAcaoDoVazio,
    );
  }, [
    temTabela,
    aguardandoCatalogos,
    lotacaoDesconhecida,
    aba,
    estado.pagina,
    departamentoId,
    cargoId,
    tipo,
    buscaAplicada,
    carregarDados,
  ]);

  // Os indicadores aparecem também na aba de jornada: uma leitura mínima só
  // dos contadores, sem grupo nem filtros. Falhou: aviso e nova tentativa.
  const falhaContadoresRef = useRef(falhaContadores);
  falhaContadoresRef.current = falhaContadores;
  useEffect(() => {
    if (temTabela || contadores !== null) return;
    let vigente = true;
    listarColaboradores({ pagina: 1, tamanhoPagina: 1 })
      .then((resp) => {
        if (!vigente) return;
        setContadores(resp.contadores);
        if (falhaContadoresRef.current) {
          focarTotaisRef.current = true;
          setAnuncioTotais("Totais de colaboradores carregados.");
        }
        setFalhaContadores(false);
      })
      .catch(() => {
        if (!vigente) return;
        setFalhaContadores(true);
        setAnuncioTotais(
          "Não foi possível carregar os totais de colaboradores.",
        );
      })
      .finally(() => {
        if (vigente) setRepetindoContadores(false);
      });
    return () => {
      vigente = false;
    };
  }, [temTabela, contadores, tentativaContadores]);

  useEffect(() => {
    if (contadores === null || !focarTotaisRef.current) return;
    focarTotaisRef.current = false;
    tituloTotaisRef.current?.focus();
  }, [contadores]);

  function repetirContadores() {
    if (repetindoContadores) return;
    // Limpa o anúncio antes: a mesma falha, de novo, é anunciada de novo.
    setAnuncioTotais("");
    setRepetindoContadores(true);
    setTentativaContadores((n) => n + 1);
  }

  // T198 — volta da ficha: relê a página atual, com a mesma consulta.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const buscaRef = useRef(buscaAplicada);
  buscaRef.current = buscaAplicada;
  useEffect(() => {
    if (atualizacao === 0 || estadoRef.current.aba === "jornada") return;
    void carregarDados(estadoRef.current, buscaRef.current, true);
  }, [atualizacao, carregarDados]);

  // T190 — catálogos dos filtros de lotação: uma leitura por montagem (e a
  // cada "Recarregar"), só ativos.
  useEffect(() => {
    let vigente = true;
    setCatalogos({ status: "carregando" });
    Promise.all([
      listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
      listarCargos({ status: "ativo", tamanhoPagina: 100 }),
    ])
      .then(([departamentos, cargos]) => {
        if (!vigente) return;
        setCatalogos({
          status: "dados",
          departamentos: departamentos.itens.filter(
            (d) => d.status === "ativo",
          ),
          cargos: cargos.itens.filter((c) => c.status === "ativo"),
        });
      })
      .catch(() => {
        if (vigente) setCatalogos({ status: "erro" });
      });
    return () => {
      vigente = false;
    };
  }, [tentativaCatalogos]);

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPaginaEfetivo));
  const carregando = statusCarregamento === "carregando";
  const comLotacao = abaTemLotacao(aba);
  const temFiltroDeLotacao =
    comLotacao && (departamentoId !== null || cargoId !== null);
  const temFiltro = temFiltroDeLotacao || tipo !== null;
  const filtrando = temFiltro || buscaAplicada !== "";
  const onde = empresaAtiva ? "nesta empresa" : "no seu escopo";

  const departamentoFiltrado =
    catalogos.status === "dados"
      ? catalogos.departamentos.find((d) => d.id === departamentoId)
      : undefined;
  const cargoFiltrado =
    catalogos.status === "dados"
      ? catalogos.cargos.find((c) => c.id === cargoId)
      : undefined;

  /**
   * T199 — dispara a ação de um estado vazio: congela o estado vazio como
   * está e leva ao estado `alvo` (uma única mudança); se o estado já é o
   * alvo, relê direto. Cliques durante a leitura são ignorados.
   */
  function iniciarAcaoDoVazio(
    acao: Omit<AcaoDoVazio, "fase">,
    alvo: EstadoDaListagem,
  ) {
    if (acaoDoVazio?.fase === "carregando") return;
    setAnuncioDaLista("");
    setAcaoDoVazio({ ...acao, fase: "carregando" });
    const normalizado = normalizarEstadoDaListagem(alvo);
    if (mesmoEstado(normalizado, estado)) {
      void carregarDados(normalizado, buscaAplicada, false, true);
    } else {
      cargaDaAcaoRef.current = true;
      mudarEstado(normalizado);
    }
  }

  /** Depois de uma falha: o estado já é o alvo; relê, no mesmo botão. */
  function repetirAcaoDoVazio() {
    if (!acaoDoVazio || acaoDoVazio.fase === "carregando") return;
    setAnuncioDaLista("");
    setAcaoDoVazio({ ...acaoDoVazio, fase: "carregando" });
    void carregarDados(estado, buscaAplicada, false, true);
  }

  function irParaPagina(destino: number) {
    if (destino < 1 || destino > totalPaginas || carregando) return;
    mudarEstado({ ...estado, pagina: destino });
  }

  function trocarAba(nova: AbaDaListagem) {
    if (nova === aba) return;
    // A aba nova começa na primeira página; tipo e lotação seguem quando
    // fazem sentido nela (a normalização tira o que não faz).
    mudarEstado({ ...estado, aba: nova, pagina: 1 });
  }

  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    const atual = ABAS_DA_LISTAGEM.indexOf(
      (evento.currentTarget.dataset.aba ?? aba) as AbaDaListagem,
    );
    const n = ABAS_DA_LISTAGEM.length;
    let alvo: number | null = null;
    if (evento.key === "ArrowRight") alvo = (atual + 1) % n;
    if (evento.key === "ArrowLeft") alvo = (atual - 1 + n) % n;
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = n - 1;
    if (alvo === null) return;
    evento.preventDefault();
    document.getElementById(idDaAba(ABAS_DA_LISTAGEM[alvo]!))?.focus();
  }

  /**
   * T178 — enviar a busca. Um termo novo relê pelo efeito (na página 1); o
   * MESMO termo reenviado também relê, porque reenviar é pedir de novo.
   */
  function handleBuscar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const termo = normalizarBusca(buscaDigitada);
    setBuscaDigitada(termo);
    if (estado.pagina !== 1) mudarEstado({ ...estado, pagina: 1 });
    if (termo === buscaAplicada && estado.pagina === 1) {
      void carregarDados(estado, termo);
      return;
    }
    setBuscaAplicada(termo);
  }

  /** T178 — "Limpar busca": o foco vai ao campo (o botão some com o termo). */
  function limparBusca() {
    setBuscaDigitada("");
    setBuscaAplicada("");
    if (estado.pagina !== 1) mudarEstado({ ...estado, pagina: 1 });
    campoBuscaRef.current?.focus();
  }

  /**
   * T199 — busca, lotação e tipo saem numa ÚNICA mudança de estado: duas
   * (filtros, depois página) partiriam do mesmo estado antigo, e a segunda
   * devolveria os filtros que a primeira tirou.
   */
  function limparBuscaEFiltros() {
    mudarEstado({
      ...estado,
      pagina: 1,
      departamentoId: null,
      cargoId: null,
      tipo: null,
    });
    setBuscaDigitada("");
    setBuscaAplicada("");
    campoBuscaRef.current?.focus();
  }

  /** O vazio de uma consulta filtrada: diz o que não foi achado e como desfazer. */
  function vazioDaConsulta(): {
    titulo: string;
    descricao: string;
    acao: { rotulo: string; executar: () => void };
  } {
    if (buscaAplicada && !temFiltro) {
      return {
        titulo: "Nenhum colaborador encontrado",
        descricao: `Nenhum colaborador em “${ROTULO_DA_ABA[aba]}” corresponde a “${buscaAplicada}” por nome ou matrícula.`,
        acao: { rotulo: "Limpar busca", executar: limparBusca },
      };
    }
    if (!buscaAplicada) {
      const titulo = "Nenhum colaborador com estes filtros";
      const descricao = `Nenhum colaborador em “${ROTULO_DA_ABA[aba]}” corresponde aos filtros selecionados.`;
      return {
        titulo,
        descricao,
        acao: {
          rotulo: "Limpar filtros",
          // T199 — do estado vazio: ele segue montado durante a leitura e,
          // no fim, o foco vai ao campo de busca.
          executar: () =>
            iniciarAcaoDoVazio(
              {
                titulo,
                descricao,
                rotulo: "Limpar filtros",
                destinoDoFoco: ID_CAMPO_BUSCA,
              },
              {
                ...estado,
                pagina: 1,
                departamentoId: null,
                cargoId: null,
                tipo: null,
              },
            ),
        },
      };
    }
    return {
      titulo: "Nenhum colaborador encontrado com estes filtros",
      descricao: `Nenhum colaborador corresponde a “${buscaAplicada}” com os filtros selecionados.`,
      acao: { rotulo: "Limpar busca e filtros", executar: limparBuscaEFiltros },
    };
  }

  /** O vazio de uma aba sem ninguém (sem busca nem filtros). */
  function vazioDaAba(): { titulo: string; descricao: string } {
    switch (aba) {
      case "ativos":
        return {
          titulo: `Nenhum colaborador ativo ${onde}`,
          descricao: "Quem tem vínculo ativo aparece aqui.",
        };
      case "em-admissao":
        return {
          titulo: `Nenhuma admissão em andamento ${onde}`,
          descricao:
            "Quem tem vínculo previsto, ainda sem vínculo ativo, aparece aqui.",
        };
      case "desligados":
        return {
          titulo: `Nenhum colaborador desligado ${onde}`,
          descricao:
            "Quem não tem vínculo ativo nem previsto, e tem vínculo encerrado, aparece aqui.",
        };
      default:
        return {
          titulo: `Nenhum colaborador cadastrado ${onde}`,
          descricao: onNovaAdmissao
            ? "Registre a admissão do primeiro colaborador."
            : "Ainda não há colaboradores admitidos.",
        };
    }
  }

  const hoje = diaDeHoje();
  const colunasColaboradores: DataTableColumn<ColaboradorListadoApi>[] = [
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (c) => (
        <span className="colaboradores-screen__pessoa">
          {/* Avatar neutro por iniciais: o nome está ao lado. */}
          <span className="colaboradores-screen__avatar" aria-hidden="true">
            {iniciaisDe(c.nome)}
          </span>
          {onAbrirFicha ? (
            <button
              type="button"
              className="colaboradores-screen__nome"
              aria-label={`Abrir ficha de ${c.nome}`}
              onClick={(evento) => {
                evento.currentTarget.focus();
                onAbrirFicha(c.id);
              }}
            >
              {c.nome}
            </button>
          ) : (
            <span className="colaboradores-screen__nome-texto">{c.nome}</span>
          )}
        </span>
      ),
    },
    {
      key: "matricula",
      header: "Matrícula",
      cell: (c) => {
        const vinculo = vinculoDaLinha(c, aba, tipo);
        if (!vinculo) return "—";
        const aMais = c.vinculos.length - 1;
        return (
          <>
            {exibirMatricula(vinculo.matricula)}
            {aMais > 0 ? (
              <>
                <span
                  className="colaboradores-screen__vinculos-a-mais"
                  aria-hidden="true"
                >
                  {" "}
                  +{aMais}
                </span>
                <span className="colaboradores-screen__so-leitor">
                  {" "}
                  e mais {vinculosAMais(aMais)}
                </span>
              </>
            ) : null}
          </>
        );
      },
    },
    {
      key: "cargo",
      header: "Cargo",
      cell: (c) => celulaDaLotacao(vinculoDaLinha(c, aba, tipo), "cargo"),
    },
    {
      key: "departamento",
      header: "Departamento",
      cell: (c) =>
        celulaDaLotacao(vinculoDaLinha(c, aba, tipo), "departamento"),
    },
    {
      key: "jornada",
      header: "Jornada de trabalho",
      cell: (c) => celulaDaJornada(vinculoDaLinha(c, aba, tipo), hoje),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (c) => {
        const vinculo = vinculoDaLinha(c, aba, tipo);
        return vinculo ? ROTULO_TIPO_DE_VINCULO[vinculo.tipo] : "—";
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (c) => {
        const situacao = situacaoNoEscopo(c);
        // Sem vínculo na resposta: a situação do próprio item.
        if (!situacao) {
          return (
            <StatusBadge
              variant={c.situacao === "ativo" ? "success" : "neutral"}
            >
              {c.situacao === "ativo" ? "Ativo" : "Inativo"}
            </StatusBadge>
          );
        }
        const { rotulo, variante } = SITUACAO_NO_ESCOPO[situacao];
        return <StatusBadge variant={variante}>{rotulo}</StatusBadge>;
      },
    },
    {
      key: "admissao",
      header: "Admissão",
      cell: (c) => formatarDiaCivil(vinculoDaLinha(c, aba, tipo)?.dataAdmissao),
    },
    ...(aba === "desligados"
      ? [
          {
            key: "desligamento",
            header: "Desligamento",
            cell: (c: ColaboradorListadoApi) =>
              formatarDiaCivil(vinculoDaLinha(c, aba, tipo)?.dataDesligamento),
          },
        ]
      : []),
  ];

  const valor = (n: number | undefined) =>
    contadores && n !== undefined ? String(n) : "…";
  const distribuicao = contadores
    ? TIPOS_DE_VINCULO.map((t) => ({
        tipo: t,
        quantidade: contadores.ativosPorTipo?.[t] ?? 0,
      })).filter((d) => d.quantidade > 0)
    : [];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Acompanhe quem está ativo, em admissão ou desligado, filtre pela lotação e pelo tipo de vínculo e abra a ficha de cada pessoa."
        actions={
          /* T194 — "Adicionar colaborador" abre o painel das formas de
             entrada. Só o que existe: nada de exportar. */
          onNovaAdmissao ? (
            <Button
              aria-haspopup="dialog"
              onClick={() => setPainelAdicionarAberto(true)}
            >
              <IconeAdicionarPessoa />
              Adicionar colaborador
            </Button>
          ) : null
        }
      />

      {/* T199 — indicadores do escopo inteiro, como o servidor os contou:
          não acompanham aba, busca nem filtros (o rótulo diz isso). Sem
          região viva: o número não é anunciado a cada filtro. */}
      <section
        className="colaboradores-screen__indicadores"
        aria-labelledby="colaboradores-indicadores-titulo"
      >
        <h2
          id="colaboradores-indicadores-titulo"
          className="colaboradores-screen__indicadores-titulo"
          ref={tituloTotaisRef}
          tabIndex={-1}
        >
          {empresaAtiva
            ? `Totais de ${empresaAtiva.nome}, sem filtros`
            : "Totais no seu escopo, sem filtros"}
        </h2>
        <p
          className="colaboradores-screen__anuncio-totais colaboradores-screen__so-leitor"
          role="status"
        >
          {anuncioTotais}
        </p>
        {!temTabela && contadores === null && falhaContadores ? (
          <div className="colaboradores-screen__totais-falha">
            <p className="colaboradores-screen__totais-falha-texto">
              Não foi possível carregar os totais de colaboradores.
            </p>
            <Button
              variant="secondary"
              onClick={repetirContadores}
              aria-disabled={repetindoContadores}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <dl className="colaboradores-screen__cartoes">
              {(
                [
                  ["Ativos", contadores?.ativos],
                  ["Em admissão", contadores?.emAdmissao],
                  ["Desligados", contadores?.desligados],
                  [
                    empresaAtiva
                      ? "Total nesta empresa"
                      : "Total no seu escopo",
                    contadores?.total,
                  ],
                ] as const
              ).map(([rotulo, numero]) => (
                <div key={rotulo} className="colaboradores-screen__cartao">
                  <dt>{rotulo}</dt>
                  <dd>{valor(numero)}</dd>
                </div>
              ))}
            </dl>
            <div className="colaboradores-screen__distribuicao">
              <h3 className="colaboradores-screen__distribuicao-titulo">
                Ativos por tipo de vínculo
              </h3>
              {contadores === null ? (
                <p className="colaboradores-screen__distribuicao-vazio">…</p>
              ) : distribuicao.length === 0 ? (
                <p className="colaboradores-screen__distribuicao-vazio">
                  Nenhum colaborador ativo {onde}.
                </p>
              ) : (
                <>
                  {/* Barra só visual; a legenda em texto diz os mesmos números. */}
                  <div
                    className="colaboradores-screen__barra-tipos"
                    aria-hidden="true"
                  >
                    {distribuicao.map((d) => (
                      <span
                        key={d.tipo}
                        className={`colaboradores-screen__barra-tipo colaboradores-screen__barra-tipo--${d.tipo}`}
                        style={{ flexGrow: d.quantidade }}
                      />
                    ))}
                  </div>
                  <ul className="colaboradores-screen__legenda-tipos">
                    {distribuicao.map((d) => (
                      <li key={d.tipo}>
                        <span
                          className={`colaboradores-screen__marcador colaboradores-screen__barra-tipo--${d.tipo}`}
                          aria-hidden="true"
                        />
                        {ROTULO_TIPO_DE_VINCULO[d.tipo]}:{" "}
                        <strong>{d.quantidade}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <div className="colaboradores-screen__painel">
        <div
          role="tablist"
          aria-label="Grupos de colaboradores"
          className="colaboradores-screen__abas"
        >
          {ABAS_DA_LISTAGEM.map((a) => {
            const selecionada = a === aba;
            const numero = contadores ? totalDaAba(a, contadores) : null;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                id={idDaAba(a)}
                data-aba={a}
                aria-selected={selecionada}
                aria-controls={idDoPainel}
                tabIndex={selecionada ? 0 : -1}
                className={
                  selecionada
                    ? "colaboradores-screen__aba colaboradores-screen__aba--ativa"
                    : "colaboradores-screen__aba"
                }
                // Nome acessível "Ativos, 12": a pausa que o número
                // colado ao rótulo não dá.
                {...(numero !== null
                  ? { "aria-label": `${ROTULO_DA_ABA[a]}, ${numero}` }
                  : {})}
                onClick={() => trocarAba(a)}
                onKeyDown={aoTeclarNaAba}
              >
                {ROTULO_DA_ABA[a]}
                {numero !== null ? (
                  <span
                    className="colaboradores-screen__aba-total"
                    aria-hidden="true"
                  >
                    {numero}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          id={idDoPainel}
          aria-labelledby={idDaAba(aba)}
          className="colaboradores-screen__painel-conteudo"
        >
          {aba === "jornada" ? (
            /* D-5, N-4 — a mesma visão de jornadas da empresa, com as mesmas
               permissões: só o RH opera. */
            <PessoasHorarioScreen
              embutida
              podeOperar={podeOperarJornada}
              {...(onAbrirFicha ? { onAbrirFicha } : {})}
            />
          ) : (
            <>
              {/* T199 — o título da seção da aba: os estados vazios (h3)
                  e o erro ficam abaixo dele, e não de "Totais…". Só para
                  leitor de tela; a aba selecionada já o mostra. */}
              <h2
                id={idDoTituloDaSecao}
                className="colaboradores-screen__so-leitor"
                tabIndex={-1}
              >
                {`Colaboradores — ${ROTULO_DA_ABA[aba]}`}
              </h2>
              <p
                className="colaboradores-screen__anuncio-lista colaboradores-screen__so-leitor"
                role="status"
              >
                {anuncioDaLista}
              </p>
              <div className="colaboradores-screen__filtros">
                <form
                  role="search"
                  aria-label="Buscar colaboradores"
                  className="colaboradores-screen__busca"
                  onSubmit={handleBuscar}
                >
                  <FormField
                    id="colaboradores-busca"
                    label="Buscar por nome ou matrícula"
                  >
                    {(control) => (
                      <input
                        ref={campoBuscaRef}
                        type="search"
                        maxLength={BUSCA_COLABORADORES_MAXIMO}
                        autoComplete="off"
                        value={buscaDigitada}
                        onChange={(e) => setBuscaDigitada(e.target.value)}
                        {...control}
                      />
                    )}
                  </FormField>
                  <div className="colaboradores-screen__busca-acoes">
                    <Button type="submit" variant="secondary">
                      Buscar
                    </Button>
                    {buscaDigitada !== "" || buscaAplicada !== "" ? (
                      <Button
                        type="button"
                        variant="subtle"
                        onClick={limparBusca}
                      >
                        Limpar busca
                      </Button>
                    ) : null}
                  </div>
                </form>

                {/* T190 — lotação vigente: só existe em vínculo ativo, então
                    só em Ativos e Todos. */}
                {comLotacao ? (
                  <>
                    <FormField
                      id="colaboradores-filtro-departamento"
                      label="Departamento"
                      {...(catalogos.status === "erro"
                        ? {
                            help: "Não foi possível carregar departamentos e cargos.",
                          }
                        : {})}
                    >
                      {(control) => (
                        <select
                          value={departamentoId ?? ""}
                          onChange={(e) =>
                            mudarEstado({
                              ...estado,
                              pagina: 1,
                              departamentoId: e.target.value || null,
                            })
                          }
                          disabled={carregando || catalogos.status !== "dados"}
                          {...control}
                        >
                          <option value="">
                            {catalogos.status === "carregando"
                              ? "Carregando…"
                              : "Todos os departamentos"}
                          </option>
                          {catalogos.status === "dados"
                            ? catalogos.departamentos.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {rotuloDaReferencia(d)}
                                </option>
                              ))
                            : null}
                        </select>
                      )}
                    </FormField>

                    <FormField id="colaboradores-filtro-cargo" label="Cargo">
                      {(control) => (
                        <select
                          value={cargoId ?? ""}
                          onChange={(e) =>
                            mudarEstado({
                              ...estado,
                              pagina: 1,
                              cargoId: e.target.value || null,
                            })
                          }
                          disabled={carregando || catalogos.status !== "dados"}
                          {...control}
                        >
                          <option value="">
                            {catalogos.status === "carregando"
                              ? "Carregando…"
                              : "Todos os cargos"}
                          </option>
                          {catalogos.status === "dados"
                            ? catalogos.cargos.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {rotuloDaReferencia(c)}
                                </option>
                              ))
                            : null}
                        </select>
                      )}
                    </FormField>
                  </>
                ) : null}

                <FormField
                  id="colaboradores-filtro-tipo"
                  label="Tipo de vínculo"
                >
                  {(control) => (
                    <select
                      value={tipo ?? ""}
                      onChange={(e) =>
                        mudarEstado({
                          ...estado,
                          pagina: 1,
                          tipo: (e.target.value ||
                            null) as TipoDeVinculo | null,
                        })
                      }
                      disabled={carregando}
                      {...control}
                    >
                      <option value="">Todos os tipos</option>
                      {TIPOS_DE_VINCULO.map((t) => (
                        <option key={t} value={t}>
                          {ROTULO_TIPO_DE_VINCULO[t]}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>

                {comLotacao && catalogos.status === "erro" ? (
                  <Button
                    variant="subtle"
                    className="colaboradores-screen__filtros-retry"
                    onClick={() => setTentativaCatalogos((n) => n + 1)}
                  >
                    Recarregar departamentos e cargos
                  </Button>
                ) : null}
              </div>

              {/* O que está filtrando, à vista, e como desfazer cada um. */}
              {temFiltro ? (
                <div
                  className="colaboradores-screen__filtros-ativos"
                  role="group"
                  aria-label="Filtros ativos"
                >
                  {temFiltroDeLotacao && departamentoId ? (
                    <Button
                      variant="secondary"
                      className="colaboradores-screen__filtro-ativo"
                      aria-label={`Remover filtro de departamento: ${
                        departamentoFiltrado
                          ? rotuloDaReferencia(departamentoFiltrado)
                          : "selecionado"
                      }`}
                      onClick={() =>
                        mudarEstado({
                          ...estado,
                          pagina: 1,
                          departamentoId: null,
                        })
                      }
                    >
                      Departamento:{" "}
                      {departamentoFiltrado
                        ? rotuloDaReferencia(departamentoFiltrado)
                        : "selecionado"}{" "}
                      <span aria-hidden="true">×</span>
                    </Button>
                  ) : null}
                  {temFiltroDeLotacao && cargoId ? (
                    <Button
                      variant="secondary"
                      className="colaboradores-screen__filtro-ativo"
                      aria-label={`Remover filtro de cargo: ${
                        cargoFiltrado
                          ? rotuloDaReferencia(cargoFiltrado)
                          : "selecionado"
                      }`}
                      onClick={() =>
                        mudarEstado({ ...estado, pagina: 1, cargoId: null })
                      }
                    >
                      Cargo:{" "}
                      {cargoFiltrado
                        ? rotuloDaReferencia(cargoFiltrado)
                        : "selecionado"}{" "}
                      <span aria-hidden="true">×</span>
                    </Button>
                  ) : null}
                  {tipo ? (
                    <Button
                      variant="secondary"
                      className="colaboradores-screen__filtro-ativo"
                      aria-label={`Remover filtro de tipo de vínculo: ${ROTULO_TIPO_DE_VINCULO[tipo]}`}
                      onClick={() =>
                        mudarEstado({ ...estado, pagina: 1, tipo: null })
                      }
                    >
                      Tipo: {ROTULO_TIPO_DE_VINCULO[tipo]}{" "}
                      <span aria-hidden="true">×</span>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {statusCarregamento === "erro" && acaoDoVazio === null ? (
                <Surface
                  as="section"
                  padding="lg"
                  className="colaboradores-screen__erro"
                  aria-labelledby="colaboradores-erro-titulo"
                >
                  <StatusBadge variant="danger">Erro</StatusBadge>
                  <h3
                    id="colaboradores-erro-titulo"
                    className="colaboradores-screen__section-title"
                  >
                    Não foi possível carregar os colaboradores
                  </h3>
                  <p>
                    Verifique sua conexão e tente novamente. Se o problema
                    persistir, contate o suporte.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => void carregarDados(estado, buscaAplicada)}
                  >
                    Tentar novamente
                  </Button>
                </Surface>
              ) : (
                <>
                  {/* O total da consulta vem do SERVIDOR; sem região viva —
                      a paginação já anuncia a posição. */}
                  <p className="colaboradores-screen__contexto">
                    <span className="colaboradores-screen__total">
                      {statusCarregamento === "dados"
                        ? total === 1
                          ? "1 colaborador nesta consulta"
                          : `${total} colaboradores nesta consulta`
                        : "Contando…"}
                    </span>
                  </p>

                  {acaoDoVazio ? (
                    /* T199 — o estado vazio que pediu a ação, no MESMO lugar
                       e com o mesmo botão (o foco fica nele). */
                    <EmptyState
                      headingLevel={3}
                      icon="—"
                      title={acaoDoVazio.titulo}
                      description={
                        acaoDoVazio.fase === "falha"
                          ? `${FALHA_DA_LISTA} Verifique sua conexão e tente novamente.`
                          : acaoDoVazio.descricao
                      }
                      action={
                        <Button
                          variant="secondary"
                          aria-disabled={acaoDoVazio.fase === "carregando"}
                          onClick={repetirAcaoDoVazio}
                        >
                          {acaoDoVazio.rotulo}
                        </Button>
                      }
                    />
                  ) : statusCarregamento === "carregando" ? (
                    <p
                      className="colaboradores-screen__carregando"
                      role="status"
                    >
                      Carregando colaboradores…
                    </p>
                  ) : colaboradores.length === 0 && total > 0 ? (
                    /* T199 — vazia, mas a consulta tem gente (o servidor
                       diz): página além do fim (URL, voltar, conjunto que
                       encolheu). Com ou sem busca e filtros, que ficam. */
                    <EmptyState
                      headingLevel={3}
                      icon="—"
                      title="Nenhum colaborador nesta página"
                      description={DESCRICAO_PAGINA_VAZIA}
                      action={
                        <Button
                          variant="secondary"
                          onClick={() =>
                            iniciarAcaoDoVazio(
                              {
                                titulo: "Nenhum colaborador nesta página",
                                descricao: DESCRICAO_PAGINA_VAZIA,
                                rotulo: "Ir para a primeira página",
                                destinoDoFoco: idDoTituloDaSecao,
                              },
                              { ...estado, pagina: 1 },
                            )
                          }
                        >
                          Ir para a primeira página
                        </Button>
                      }
                    />
                  ) : colaboradores.length === 0 ? (
                    filtrando ? (
                      (() => {
                        const vazio = vazioDaConsulta();
                        return (
                          <EmptyState
                            headingLevel={3}
                            icon="—"
                            title={vazio.titulo}
                            description={vazio.descricao}
                            action={
                              <Button
                                variant="secondary"
                                onClick={vazio.acao.executar}
                              >
                                {vazio.acao.rotulo}
                              </Button>
                            }
                          />
                        );
                      })()
                    ) : (
                      (() => {
                        const vazio = vazioDaAba();
                        const admitir =
                          onNovaAdmissao &&
                          (aba === "ativos" || aba === "todos");
                        return (
                          <EmptyState
                            headingLevel={3}
                            icon="—"
                            title={vazio.titulo}
                            description={vazio.descricao}
                            {...(admitir
                              ? {
                                  action: (
                                    <Button
                                      aria-haspopup="dialog"
                                      onClick={() =>
                                        setPainelAdicionarAberto(true)
                                      }
                                    >
                                      <IconeAdicionarPessoa />
                                      Adicionar colaborador
                                    </Button>
                                  ),
                                }
                              : {})}
                          />
                        );
                      })()
                    )
                  ) : (
                    <DataTable
                      caption={`Colaboradores — ${ROTULO_DA_ABA[aba]}`}
                      captionVisible={false}
                      columns={colunasColaboradores}
                      rows={colaboradores}
                      rowKey={(c) => c.id}
                    />
                  )}

                  {/* T164/R-2 — a navegação fica fora do ramo que troca na
                      carga e usa `aria-disabled`: o botão focado continua
                      focado enquanto a página nova chega. */}
                  {/* Página além do fim: o estado vazio já oferece a
                      primeira; nada de "Página 4 de 2". */}
                  {totalPaginas > 1 && paginaRespondida <= totalPaginas ? (
                    <nav
                      className="colaboradores-screen__paginacao"
                      aria-label="Paginação de colaboradores"
                      aria-busy={carregando}
                    >
                      <Button
                        variant="secondary"
                        onClick={() => irParaPagina(paginaRespondida - 1)}
                        aria-disabled={paginaRespondida <= 1 || carregando}
                      >
                        Página anterior
                      </Button>
                      <span
                        role="status"
                        className="colaboradores-screen__paginacao-posicao"
                      >
                        {carregando
                          ? "Carregando página…"
                          : `Página ${paginaRespondida} de ${totalPaginas}`}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => irParaPagina(paginaRespondida + 1)}
                        aria-disabled={
                          paginaRespondida >= totalPaginas || carregando
                        }
                      >
                        Próxima página
                      </Button>
                    </nav>
                  ) : null}
                </>
              )}
            </>
          )}
        </section>
      </div>

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
          Admissão e correções deste cadastro são feitas pelo RH e pelo DP da
          própria empresa; o suporte técnico apenas consulta. Consulta e
          alteração de nome geram trilha de auditoria automática; a admissão é
          registrada na página de Nova admissão.
        </p>
      </Surface>

      {/* T194 — painel "Adicionar colaborador": só para quem pode admitir. */}
      {onNovaAdmissao ? (
        <PainelAdicionarColaborador
          aberto={painelAdicionarAberto}
          empresaAtiva={empresaAtiva ?? null}
          onFechar={() => setPainelAdicionarAberto(false)}
          onCadastroIndividual={() => {
            setPainelAdicionarAberto(false);
            onNovaAdmissao();
          }}
        />
      ) : null}
    </div>
  );
}
