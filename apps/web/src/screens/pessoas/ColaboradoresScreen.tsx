import { NumeroSuave } from "../../ui/movimento";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import {
  BUSCA_COLABORADORES_MAXIMO,
  type ColaboradorListadoApi,
  type ContadoresColaboradoresApi,
  type GrupoColaboradores,
  type ListarColaboradoresQuery,
  type VinculoListadoApi,
  listarColaboradores,
} from "../../api/colaboradoresClient";
import {
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarUnidades,
} from "../../api/organizacaoClient";
import { listarCargos } from "../../api/cargoClient";
import {
  type AbaDaFicha,
  type AbaDaListagem,
  type EstadoDaListagem,
  type OpcoesDaMudancaDaListagem,
  type TipoDeVinculo,
  type FiltrosDaListagem,
  ABAS_DA_LISTAGEM,
  ESTADO_INICIAL_DA_LISTAGEM,
  FILTROS_VAZIOS,
  abaTemLotacao,
  abaTemTabela,
  normalizarEstadoDaListagem,
  quantidadeDeFiltros,
} from "../../app/rotasDoShell";
import {
  type CatalogosDaGaveta,
  type GrupoDeCatalogo,
  FALHA_DOS_CATALOGOS,
  GRUPOS_DE_CATALOGO,
  GavetaDeFiltros,
  ROTULO_DO_GRUPO,
  rotuloDaReferencia,
} from "./GavetaDeFiltros";
import { OPCOES_GENERO, OPCOES_NIVEL } from "./NovaAdmissaoScreen";
import { diaDeHoje } from "./jornadaColaborador";
import { PainelAdicionarColaborador } from "./PainelAdicionarColaborador";
import { iniciaisDe } from "./iniciais";
import { MenuAcoesDaPessoa } from "./MenuAcoesDaPessoa";
import {
  IconeBaixarArquivo,
  IconeBuscar,
  IconeCalendario,
  IconeEditar,
  IconeFiltrar,
  IconeMais,
  IconePessoas,
  IconePlanilha,
  IconeVer,
} from "../../ui/icones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui";
import { exibirTelefone } from "../../format/mascaras";
import { mascararCpf } from "./NovaAdmissaoScreen";
import { formatarReais } from "./salarioLiquido";
import {
  baixarArquivo,
  imprimirSomente,
  nomeDoArquivo,
} from "../dashboard/exportacao";
import { TIPO_MIME_XLSX, montarXlsx } from "./importacao/planilhaXlsx";
import {
  type ColaboradorDaLista,
  COLUNAS_DA_EXPORTACAO,
  lerTudoParaExportar,
  linhasDaExportacao,
} from "./exportacaoColaboradores";
import { PessoasHorarioScreen } from "./PessoasHorarioScreen";
import { AREAS_DE_EDICAO, AreaDeEdicao } from "../../app/edicoesPendentes";
import { useGuardaDeSaida } from "../../app/guardaDeSaida";
import {
  Input,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TabsList,
  TabsPanel,
  TabsTrigger,
} from "../../ui";
import "./ColaboradoresScreen.css";
import {
  CartoesDeAusencias,
  FeriasEAusenciasAba,
} from "./ferias/FeriasEAusenciasAba";
import type {
  IndicadoresDeAusencias,
  ServicoDeAusencias,
} from "./ferias/tiposAusencia";
import { FotoDoColaborador } from "./FotoDoColaborador";
import { plural } from "../../format/plural";

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
 * T215 — no desenho da referência (2026-11-23): cabeçalho com Exportar e
 * Novo colaborador, três cartões, abas sem "Em admissão", busca por nome,
 * CPF, e-mail ou ID, e a tabela com CPF, contatos, salário e contrato —
 * cada dado só quando o servidor o manda (a permissão é dele).
 */

/** T215 — rótulos de nível e gênero: os mesmos do Novo colaborador. */
function rotuloDoNivel(nivel: string): string {
  return OPCOES_NIVEL.find((o) => o.codigo === nivel)?.rotulo ?? nivel;
}
function rotuloDoGenero(genero: string): string {
  return OPCOES_GENERO.find((o) => o.codigo === genero)?.rotulo ?? genero;
}
function rotuloDoTipo(tipo: string): string {
  return ROTULO_TIPO_DE_VINCULO[tipo as TipoDeVinculo] ?? tipo;
}

const ROTULO_DA_ABA: Readonly<Record<AbaDaListagem, string>> = {
  ativos: "Ativos",
  "em-admissao": "Em admissão",
  ferias: "Férias e ausências",
  jornada: "Escala de trabalho",
  desligados: "Desligados",
  todos: "Todos",
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
    // T215 — ausências chegam com o módulo de Férias e ausências.
    case "ferias":
      return 0;
    default:
      return null;
  }
}

export const ROTULO_TIPO_DE_VINCULO: Readonly<Record<TipoDeVinculo, string>> = {
  clt: "CLT",
  estagio: "Estágio",
  aprendiz: "Aprendiz",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
  part_time: "Part-time",
  freelancer: "Freelancer",
  trainee: "Trainee",
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
  tipos: readonly TipoDeVinculo[],
): VinculoListadoApi | undefined {
  const situacao = SITUACAO_DA_ABA[aba];
  return (
    c.vinculos.find(
      (v) =>
        (situacao === undefined || v.situacao === situacao) &&
        (tipos.length === 0 || tipos.includes(v.tipo)),
    ) ?? c.vinculos[0]
  );
}

/**
 * Quantas linhas por página: T209 — o tamanho escolhido (20, 50 ou 100; C-2),
 * guardado na URL pelo shell.
 *
 * Sempre explícito na consulta, e não herdado do padrão do servidor, porque a
 * paginação só é honesta se a tela souber o tamanho que pediu: é esse número
 * que faz "Página 2 de 5" significar alguma coisa.
 *
 * R-1 — o tamanho de página da RESPOSTA, quando ele é utilizável. Ausente,
 * não numérico, zero, negativo, fracionário ou não finito volta ao tamanho
 * pedido: uma paginação inventada é pior que nenhuma.
 */
function tamanhoDePaginaValido(valor: unknown, pedido: number): number {
  return typeof valor === "number" &&
    Number.isInteger(valor) &&
    valor > 0 &&
    Number.isFinite(valor)
    ? valor
    : pedido;
}

/**
 * T209 — a janela de botões numerados (C-3): até cinco páginas em volta da
 * atual, sem sair de 1..total. Primeira e última têm botões próprios.
 */
const JANELA_DE_PAGINAS = 5;

export function paginasDaJanela(atual: number, total: number): number[] {
  const largura = Math.min(JANELA_DE_PAGINAS, total);
  const inicio = Math.min(
    Math.max(1, atual - Math.floor(JANELA_DE_PAGINAS / 2)),
    total - largura + 1,
  );
  return Array.from({ length: largura }, (_, i) => inicio + i);
}

/**
 * T209 — "Mostrando X–Y de Z" (C-3): do primeiro ao último item da página
 * que o servidor devolveu, sobre o total da consulta.
 */
export function textoDoIntervalo(
  pagina: number,
  tamanho: number,
  quantidadeNaPagina: number,
  total: number,
): string {
  const primeiro = (pagina - 1) * tamanho + 1;
  const ultimo = primeiro + quantidadeNaPagina - 1;
  const quantos = total === 1 ? "1 colaborador" : `${total} colaboradores`;
  return `Mostrando ${primeiro}–${ultimo} de ${quantos}`;
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
  /** `id` de quem recebe o foco quando a leitura dá certo (sempre visível). */
  readonly destinoDoFoco: string;
  /** "Ir para a primeira página": anuncia a página carregada no sucesso. */
  readonly anunciarPrimeiraPagina?: boolean;
  readonly fase: "carregando" | "falha";
}

/** O campo de busca: destino do foco depois de limpar filtros ou busca. */
const ID_CAMPO_BUSCA = "colaboradores-busca";

const FALHA_DA_LISTA = "Não foi possível carregar os colaboradores.";

/** T215 — os grupos de lotação na gaveta: destino do foco na recarga. */
const ID_GRUPOS_DE_LOTACAO = "colaboradores-gaveta-lotacao";

/** T215 — o botão "Filtrar": destino do foco quando o último chip sai. */
const ID_BOTAO_FILTRAR = "colaboradores-filtrar";

/** T215 — um valor de filtro aplicado: vira um chip removível. */
interface FiltroAplicado {
  readonly grupo: keyof FiltrosDaListagem;
  readonly valor: string;
  readonly texto: string;
}

const DESCRICAO_PAGINA_VAZIA =
  "Esta página voltou vazia, embora a consulta tenha colaboradores: o conjunto pode ter mudado desde a última leitura.";

/**
 * O anúncio de "Ir para a primeira página" que deu certo: a página, quantos
 * há na consulta e o que ficou (busca e filtros não mudam com a página).
 */
function anuncioDaPrimeiraPagina(
  total: number,
  comBusca: boolean,
  comFiltros: boolean,
): string {
  const quantos = total === 1 ? "1 colaborador" : `${total} colaboradores`;
  const mantidos =
    comBusca && comFiltros
      ? ", com a busca e os filtros mantidos"
      : comBusca
        ? ", com a busca mantida"
        : comFiltros
          ? ", com os filtros mantidos"
          : "";
  return `Página 1 carregada: ${quantos} nesta consulta${mantidos}.`;
}

function mesmoEstado(a: EstadoDaListagem, b: EstadoDaListagem): boolean {
  return (
    a.aba === b.aba &&
    a.pagina === b.pagina &&
    a.tamanho === b.tamanho &&
    JSON.stringify(a.filtros) === JSON.stringify(b.filtros)
  );
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
   * T209 — o menu "Ações" da linha abre a ficha já numa aba (C-4); sem esta
   * prop, não há menu.
   */
  readonly onAbrirFicha?: (colaboradorId: string, aba?: AbaDaFicha) => void;
  /** T215 — "Editar colaborador" no ⋯ da linha: só para quem edita. */
  readonly onEditarColaborador?: (colaboradorId: string) => void;
  /**
   * T215 — a aba "Organograma" leva à estrutura (outra tela, decidida pelo
   * shell). Sem esta prop, a aba não aparece.
   */
  readonly onAbrirOrganograma?: () => void;
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
  /** T209 (Bloco C) — leva à página de importação por planilha. */
  readonly onImportarPlanilha?: () => void;
  /**
   * T212 — o arquivo escolhido no passo 3 do painel "Adicionar
   * colaborador": o shell abre a importação já na conferência.
   */
  readonly onImportarArquivo?: (arquivo: File) => void;
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
  /**
   * T215 — Férias e ausências: as chamadas ao servidor e quem registra e
   * decide. Sem serviço, a aba só avisa que o módulo não está disponível.
   */
  readonly servicoDeAusencias?: ServicoDeAusencias;
  readonly podeRegistrarAusencia?: boolean;
  /** T215 — a engrenagem da aba leva às Políticas de férias. */
  readonly onPoliticasDeFerias?: () => void;
}

/** T215 — os filtros da gaveta como a API os recebe (lista vazia: fora). */
function consultaDosFiltros(
  filtros: FiltrosDaListagem,
): Partial<ListarColaboradoresQuery> {
  const query: Partial<ListarColaboradoresQuery> = {};
  for (const grupo of Object.keys(filtros) as (keyof FiltrosDaListagem)[]) {
    if (filtros[grupo].length > 0) query[grupo] = filtros[grupo];
  }
  return query;
}

/** T215 — coluna da tabela: o cabeçalho pode ser conteúdo (a seleção). */
interface ColunaDaLista {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (c: ColaboradorListadoApi) => ReactNode;
}

/** T215 — o minigráfico dos ativos nos últimos meses (só visual). */
function Minigrafico({ serie }: { readonly serie: readonly number[] }) {
  if (serie.length < 2) return null;
  const largura = 90;
  const altura = 28;
  const maximo = Math.max(...serie);
  const minimo = Math.min(...serie);
  const faixa = Math.max(1, maximo - minimo);
  const pontos = serie.map((v, i) => [
    (i / (serie.length - 1)) * (largura - 4) + 2,
    altura - 2 - ((v - minimo) / faixa) * (altura - 4),
  ]);
  const [ultimoX, ultimoY] = pontos[pontos.length - 1]!;
  return (
    <svg
      className="colaboradores-screen__minigrafico"
      viewBox={`0 0 ${largura} ${altura}`}
      width={largura}
      height={altura}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={pontos.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ultimoX} cy={ultimoY} r="2.5" fill="currentColor" />
    </svg>
  );
}

type ContadoresDaPagina = ContadoresColaboradoresApi & {
  readonly admitidosNoMes?: number;
  readonly desligadosNoAno?: number;
  readonly serieAtivos?: readonly number[];
};

function CartaoAtivos({
  contadores,
}: {
  readonly contadores: ContadoresColaboradoresApi | null;
}) {
  const id = useId();
  const c = contadores as ContadoresDaPagina | null;
  const ano = new Date().getFullYear();
  return (
    <div
      className="colaboradores-screen__cartao-resumo"
      role="group"
      aria-labelledby={id}
    >
      <div className="colaboradores-screen__cartao-cabeca">
        <span className="colaboradores-screen__cartao-icone" aria-hidden="true">
          <IconePessoas tamanho={18} />
        </span>
        <h3 id={id} className="colaboradores-screen__cartao-titulo">
          Colaboradores ativos
        </h3>
      </div>
      <div className="colaboradores-screen__cartao-linha">
        <p className="colaboradores-screen__cartao-numero">
          {c ? <NumeroSuave valor={c.ativos} /> : "…"}
        </p>
        {c && (c.admitidosNoMes ?? 0) > 0 ? (
          <span className="colaboradores-screen__variacao">
            <span aria-hidden="true">↑</span>
            <span>{c.admitidosNoMes} no mês</span>
          </span>
        ) : null}
        {c?.serieAtivos ? <Minigrafico serie={c.serieAtivos} /> : null}
      </div>
      <p className="colaboradores-screen__cartao-rodape">
        {c
          ? c.desligadosNoAno !== undefined
            ? `${c.total} cadastrados · ${c.desligadosNoAno} desligados em ${ano}`
            : `${c.total} cadastrados`
          : "…"}
      </p>
    </div>
  );
}

/** T215 — os grupos do cartão "Por tipo de contrato", como a referência. */
const GRUPOS_DE_CONTRATO = [
  { chave: "clt", rotulo: "CLT", tipos: ["clt"] },
  { chave: "pj", rotulo: "PJ", tipos: ["pj"] },
  { chave: "estagio", rotulo: "Estágio", tipos: ["estagio"] },
  { chave: "aprendiz", rotulo: "Aprendiz", tipos: ["aprendiz"] },
  {
    chave: "outros",
    rotulo: "Outros",
    tipos: [
      "temporario",
      "outro_controlado",
      "part_time",
      "freelancer",
      "trainee",
    ],
  },
] as const;

function CartaoTiposDeContrato({
  contadores,
}: {
  readonly contadores: ContadoresColaboradoresApi | null;
}) {
  const id = useId();
  const grupos = GRUPOS_DE_CONTRATO.map((g) => ({
    ...g,
    quantidade: contadores
      ? g.tipos.reduce(
          (soma, t) => soma + (contadores.ativosPorTipo?.[t] ?? 0),
          0,
        )
      : 0,
  }));
  const comAlguem = grupos.filter((g) => g.quantidade > 0);
  return (
    <div
      className="colaboradores-screen__cartao-resumo"
      role="group"
      aria-labelledby={id}
    >
      <div className="colaboradores-screen__cartao-cabeca">
        <span className="colaboradores-screen__cartao-icone" aria-hidden="true">
          <IconePlanilha tamanho={18} />
        </span>
        <h3 id={id} className="colaboradores-screen__cartao-titulo">
          Por tipo de contrato
        </h3>
      </div>
      {/* Barra só visual; a legenda em texto diz os mesmos números. */}
      <div className="colaboradores-screen__barra-contratos" aria-hidden="true">
        {comAlguem.map((g) => (
          <span
            key={g.chave}
            className={`colaboradores-screen__barra-contrato colaboradores-screen__grupo-contrato--${g.chave}`}
            style={{ flexGrow: g.quantidade }}
          />
        ))}
      </div>
      <ul className="colaboradores-screen__legenda-contratos">
        {grupos.map((g) => (
          <li key={g.chave}>
            <span
              className={`colaboradores-screen__marcador-contrato colaboradores-screen__grupo-contrato--${g.chave}`}
              aria-hidden="true"
            />
            {g.rotulo} <strong>{contadores ? g.quantidade : "…"}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ColaboradoresScreen({
  empresaAtiva = null,
  onNovaAdmissao,
  onImportarPlanilha,
  onImportarArquivo,
  onAbrirFicha,
  onEditarColaborador,
  onAbrirOrganograma,
  atualizacao = 0,
  estado: estadoControlado,
  onEstadoChange,
  podeOperarJornada = false,
  servicoDeAusencias,
  podeRegistrarAusencia = false,
  onPoliticasDeFerias,
}: ColaboradoresScreenProps = {}) {
  /** T215 — os números da aba Férias e ausências (cartões e aba). */
  const [indicadoresDeAusencias, setIndicadoresDeAusencias] =
    useState<IndicadoresDeAusencias | null>(null);
  const prefixo = useId();
  const idDaAba = (aba: AbaDaListagem) => `${prefixo}-aba-${aba}`;
  const idDoPainel = `${prefixo}-painel`;

  // T199 — controlado pelo shell (URL) ou, montado sozinho, pelo próprio
  // componente. Sempre normalizado: lotação só onde ela existe.
  const guarda = useGuardaDeSaida();
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
  const { aba, filtros, tamanho } = estado;
  /** T215 — o mesmo conjunto de filtros dá sempre a mesma chave. */
  const chaveDosFiltros = JSON.stringify(filtros);
  /** T215 — a gaveta "Filtrar": só estado local. */
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const temTabela = abaTemTabela(aba);

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
  const [catalogos, setCatalogos] = useState<CatalogosDaGaveta>({
    status: "carregando",
  });
  const [tentativaCatalogos, setTentativaCatalogos] = useState(0);
  /**
   * T199 — "Recarregar departamentos e cargos" no padrão seguro: o botão fica
   * montado (indisponível, com o foco) durante a nova leitura; no sucesso, o
   * foco vai à select de Departamento; numa nova falha, fica no botão e a
   * falha é anunciada uma vez. A listagem não é relida por isso.
   */
  const [repetindoCatalogos, setRepetindoCatalogos] = useState(false);
  /** T215 — a falha de uma recarga, anunciada dentro da gaveta. */
  const [anuncioDosCatalogos, setAnuncioDosCatalogos] = useState("");
  const repetindoCatalogosRef = useRef(repetindoCatalogos);
  repetindoCatalogosRef.current = repetindoCatalogos;
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
  const [tamanhoPaginaEfetivo, setTamanhoPaginaEfetivo] = useState<number>(
    estado.tamanho,
  );
  /** T194 — painel "Adicionar colaborador": só estado local. */
  const [painelAdicionarAberto, setPainelAdicionarAberto] = useState(false);
  /** T215 — linhas marcadas (só desta página). */
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  /** T215 — exportação em andamento e o relatório para impressão. */
  const [exportando, setExportando] = useState(false);
  const [falhaDaExportacao, setFalhaDaExportacao] = useState("");
  const [impressao, setImpressao] = useState<string[][] | null>(null);
  const blocoDaImpressaoRef = useRef<HTMLDivElement | null>(null);
  /**
   * Sequência do pedido em voo: a resposta só é aplicada se ainda for a mais
   * recente — um filtro trocado depressa nunca é sobrescrito pelo anterior.
   */
  const pedidoListaRef = useRef(0);
  /**
   * T209 — a requisição da leitura em voo: uma leitura nova (busca, filtro,
   * aba, página ou tamanho) cancela a anterior, e desmontar a tela (troca de
   * empresa, saída do módulo) cancela a que estiver em voo. A sequência acima
   * continua: um cliente que ignore o cancelamento não sobrescreve nada.
   */
  const controleListaRef = useRef<AbortController | null>(null);
  useEffect(() => () => controleListaRef.current?.abort(), []);
  const [acaoDoVazio, setAcaoDoVazio] = useState<AcaoDoVazio | null>(null);
  const acaoDoVazioRef = useRef(acaoDoVazio);
  acaoDoVazioRef.current = acaoDoVazio;
  /** A próxima carga do efeito foi pedida pela ação do estado vazio. */
  const cargaDaAcaoRef = useRef(false);
  /** Anúncio único da falha de uma ação do vazio (região sempre montada). */
  const [anuncioDaLista, setAnuncioDaLista] = useState("");
  const [focoPendente, setFocoPendente] = useState<string | null>(null);
  /**
   * T199 — "Tentar novamente" do erro da tabela, no mesmo padrão seguro: o
   * bloco de erro fica montado durante a nova leitura, com o mesmo botão
   * focado e indisponível; no sucesso, o foco vai ao campo de busca; numa
   * nova falha, fica no botão e a falha é anunciada uma vez.
   */
  const [repetindoErro, setRepetindoErro] = useState(false);

  const carregarDados = useCallback(
    async (
      consulta: EstadoDaListagem,
      busca: string,
      // T198 — a releitura na volta da ficha não troca a tabela pelo aviso
      // de carregamento: as linhas (e o botão que recebe o foco) continuam.
      silenciosa = false,
      // T199 — pedida por uma ação do estado vazio (ver `AcaoDoVazio`).
      daAcaoDoVazio = false,
      // T199 — pedida pelo "Tentar novamente" do erro da tabela.
      daRepeticaoDoErro = false,
    ) => {
      const pedido = ++pedidoListaRef.current;
      controleListaRef.current?.abort();
      const controle = new AbortController();
      controleListaRef.current = controle;
      // Qualquer outra carga (aba, filtro, página, busca) encerra a ação.
      if (!daAcaoDoVazio) setAcaoDoVazio(null);
      if (!daRepeticaoDoErro) setRepetindoErro(false);
      if (!silenciosa) setStatusCarregamento("carregando");
      try {
        // A empresa nunca entra na query: é a da sessão.
        const query: ListarColaboradoresQuery = {
          pagina: consulta.pagina,
          tamanhoPagina: consulta.tamanho,
        };
        const grupo = GRUPO_DA_ABA[consulta.aba];
        if (grupo) query.grupo = grupo;
        if (busca) query.busca = busca;
        Object.assign(query, consultaDosFiltros(consulta.filtros));
        const resp = await listarColaboradores(query, {
          signal: controle.signal,
        });
        if (pedido !== pedidoListaRef.current) return;
        setColaboradores(resp.itens);
        setSelecionados(new Set());
        setPaginaRespondida(resp.pagina);
        setTotal(resp.total);
        setTamanhoPaginaEfetivo(
          tamanhoDePaginaValido(resp.tamanhoPagina, consulta.tamanho),
        );
        setContadores(resp.contadores);
        setFalhaContadores(false);
        setStatusCarregamento("dados");
        if (daAcaoDoVazio) {
          const acao = acaoDoVazioRef.current;
          setFocoPendente(acao?.destinoDoFoco ?? null);
          if (acao?.anunciarPrimeiraPagina) {
            setAnuncioDaLista(
              anuncioDaPrimeiraPagina(
                resp.total,
                busca !== "",
                quantidadeDeFiltros(consulta.filtros) > 0,
              ),
            );
          }
          setAcaoDoVazio(null);
        }
        if (daRepeticaoDoErro) {
          setRepetindoErro(false);
          setFocoPendente(ID_CAMPO_BUSCA);
        }
      } catch {
        // Uma leitura cancelada já foi substituída (a sequência avançou) ou a
        // tela foi desmontada: nunca vira erro na tela.
        if (pedido !== pedidoListaRef.current) return;
        setStatusCarregamento("erro");
        const acao = acaoDoVazioRef.current;
        if (daAcaoDoVazio && acao) {
          setAcaoDoVazio({ ...acao, fase: "falha" });
          setAnuncioDaLista(FALHA_DA_LISTA);
        }
        if (daRepeticaoDoErro) {
          setRepetindoErro(false);
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
  const comIdsDeCatalogo =
    comLotacaoNaAba && GRUPOS_DE_CATALOGO.some((g) => filtros[g].length > 0);
  // Só a primeira leitura dos catálogos segura a tabela: uma recarga depois
  // de falha não relê a listagem (o servidor já decidiu sem os catálogos).
  const aguardandoCatalogos =
    tentativaCatalogos === 0 &&
    comIdsDeCatalogo &&
    catalogos.status === "carregando";
  // T215 — os filtros com os ids conferidos nos 5 catálogos.
  const filtrosConferidos: FiltrosDaListagem | null =
    comIdsDeCatalogo && catalogos.status === "dados"
      ? GRUPOS_DE_CATALOGO.reduce<FiltrosDaListagem>(
          (acc, g) => ({
            ...acc,
            [g]: filtros[g].filter((id) =>
              catalogos[g].some((r) => r.id === id),
            ),
          }),
          filtros,
        )
      : null;
  const lotacaoDesconhecida =
    filtrosConferidos !== null &&
    GRUPOS_DE_CATALOGO.some(
      (g) => filtrosConferidos[g].length !== filtros[g].length,
    );
  useEffect(() => {
    if (!lotacaoDesconhecida || filtrosConferidos === null) return;
    mudarEstado(
      { ...estado, pagina: 1, filtros: filtrosConferidos },
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
      { aba, pagina: estado.pagina, tamanho, filtros },
      buscaAplicada,
      false,
      daAcaoDoVazio,
    );
    // `filtros` entra pela chave: um objeto novo com os mesmos valores não
    // relê.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    temTabela,
    aguardandoCatalogos,
    lotacaoDesconhecida,
    aba,
    estado.pagina,
    tamanho,
    chaveDosFiltros,
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
    // T209 — desmontar (ou sair da aba Jornada) cancela a leitura em voo.
    const controle = new AbortController();
    listarColaboradores(
      { pagina: 1, tamanhoPagina: 1 },
      { signal: controle.signal },
    )
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
      controle.abort();
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
    if (atualizacao === 0 || !abaTemTabela(estadoRef.current.aba)) return;
    void carregarDados(estadoRef.current, buscaRef.current, true);
  }, [atualizacao, carregarDados]);

  // T190 — catálogos dos filtros de lotação: uma leitura por montagem (e a
  // cada "Recarregar"), só ativos. T215 — os 5 catálogos da gaveta.
  useEffect(() => {
    let vigente = true;
    setCatalogos({ status: "carregando" });
    const consulta = { status: "ativo", tamanhoPagina: 100 } as const;
    const ativos = (itens: readonly { status: string }[] | undefined) =>
      (itens ?? []).filter((r) => r.status === "ativo");
    Promise.all([
      listarDepartamentos(consulta),
      listarAreas(consulta),
      listarCentrosCusto(consulta),
      listarUnidades(consulta),
      listarCargos(consulta),
    ])
      .then(([departamentos, areas, centrosCusto, unidades, cargos]) => {
        if (!vigente) return;
        setCatalogos({
          status: "dados",
          departamentos: ativos(departamentos.itens) as never,
          areas: ativos(areas.itens) as never,
          centrosCusto: ativos(centrosCusto.itens) as never,
          unidades: ativos(unidades.itens) as never,
          cargos: ativos(cargos.itens) as never,
        });
        if (repetindoCatalogosRef.current) {
          setRepetindoCatalogos(false);
          setFocoPendente(ID_GRUPOS_DE_LOTACAO);
        }
      })
      .catch(() => {
        if (!vigente) return;
        setCatalogos({ status: "erro" });
        if (repetindoCatalogosRef.current) {
          setRepetindoCatalogos(false);
          setAnuncioDosCatalogos(FALHA_DOS_CATALOGOS);
        }
      });
    return () => {
      vigente = false;
    };
  }, [tentativaCatalogos]);

  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPaginaEfetivo));
  const carregando = statusCarregamento === "carregando";
  const comLotacao = abaTemLotacao(aba);
  const quantosFiltros = quantidadeDeFiltros(filtros);
  const temFiltro = quantosFiltros > 0;
  const filtrando = temFiltro || buscaAplicada !== "";
  const onde = empresaAtiva ? "nesta empresa" : "no seu escopo";

  /** T215 — cada valor aplicado, na ordem dos grupos da gaveta. */
  const nomeNoCatalogo = (grupo: GrupoDeCatalogo, id: string) => {
    const ref =
      catalogos.status === "dados"
        ? catalogos[grupo].find((r) => r.id === id)
        : undefined;
    return ref ? rotuloDaReferencia(ref) : "selecionado";
  };
  const filtrosAplicados: FiltroAplicado[] = [
    ...GRUPOS_DE_CATALOGO.flatMap((g) =>
      filtros[g].map((id) => ({
        grupo: g,
        valor: id,
        texto: `${ROTULO_DO_GRUPO[g]}: ${nomeNoCatalogo(g, id)}`,
      })),
    ),
    ...filtros.niveis.map((n) => ({
      grupo: "niveis" as const,
      valor: n,
      texto: `Nível: ${rotuloDoNivel(n)}`,
    })),
    ...filtros.tipos.map((t) => ({
      grupo: "tipos" as const,
      valor: t,
      texto: `Tipo: ${rotuloDoTipo(t)}`,
    })),
    ...filtros.generos.map((g) => ({
      grupo: "generos" as const,
      valor: g,
      texto: `Gênero: ${rotuloDoGenero(g)}`,
    })),
  ];

  /** T215 — quantos o rascunho da gaveta traria (aba e busca aplicadas). */
  const contarNaGaveta = useCallback(
    async (rascunho: FiltrosDaListagem, sinal: AbortSignal) => {
      const query: ListarColaboradoresQuery = {
        pagina: 1,
        tamanhoPagina: 1,
        ...consultaDosFiltros(
          normalizarEstadoDaListagem({ ...estado, filtros: rascunho }).filtros,
        ),
      };
      const grupo = GRUPO_DA_ABA[aba];
      if (grupo) query.grupo = grupo;
      if (buscaAplicada) query.busca = buscaAplicada;
      const resp = await listarColaboradores(query, { signal: sinal });
      return resp.total;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aba, buscaAplicada, estado.tamanho],
  );

  /** T215 — "Ver N resultados": uma única mudança, na página 1. */
  function aplicarFiltros(rascunho: FiltrosDaListagem) {
    setGavetaAberta(false);
    mudarEstado({ ...estado, pagina: 1, filtros: rascunho });
  }

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

  function recarregarCatalogos() {
    if (repetindoCatalogos) return;
    // Limpa o anúncio antes: a mesma falha, de novo, é anunciada de novo.
    setAnuncioDosCatalogos("");
    setRepetindoCatalogos(true);
    setTentativaCatalogos((n) => n + 1);
  }

  const idDoChip = (f: Pick<FiltroAplicado, "grupo" | "valor">) =>
    `${prefixo}-chip-${f.grupo}-${f.valor}`;

  /**
   * T199 — remove um filtro pelo chip (uma única mudança de estado). O chip
   * some: o foco vai ao chip seguinte, ou ao anterior, ou ao campo de busca.
   * T215 — um chip por valor.
   */
  function removerFiltro(filtro: FiltroAplicado) {
    const i = filtrosAplicados.findIndex(
      (f) => f.grupo === filtro.grupo && f.valor === filtro.valor,
    );
    const destino = filtrosAplicados[i + 1] ?? filtrosAplicados[i - 1];
    mudarEstado({
      ...estado,
      pagina: 1,
      filtros: {
        ...filtros,
        [filtro.grupo]: (filtros[filtro.grupo] as readonly string[]).filter(
          (v) => v !== filtro.valor,
        ),
      },
    });
    setFocoPendente(destino ? idDoChip(destino) : ID_CAMPO_BUSCA);
  }

  /**
   * T215 — a busca também vai sozinha, pouco depois de a pessoa parar de
   * digitar (Enter continua valendo na hora).
   */
  useEffect(() => {
    const termo = normalizarBusca(buscaDigitada);
    if (termo === buscaAplicada) return;
    const espera = window.setTimeout(() => {
      if (estadoRef.current.pagina !== 1) {
        mudarEstado({ ...estadoRef.current, pagina: 1 });
      }
      setBuscaAplicada(termo);
    }, 350);
    return () => window.clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDigitada]);

  /** A consulta da tela, sem página: a mesma que a exportação lê. */
  function consultaAtual(): Omit<
    ListarColaboradoresQuery,
    "pagina" | "tamanhoPagina"
  > {
    const consulta: Omit<ListarColaboradoresQuery, "pagina" | "tamanhoPagina"> =
      { ...consultaDosFiltros(filtros) };
    const grupo = GRUPO_DA_ABA[aba];
    if (grupo) consulta.grupo = grupo;
    if (buscaAplicada) consulta.busca = buscaAplicada;
    return consulta;
  }

  /** T215 — Exportar em Excel: a planilha da consulta atual. */
  async function exportarExcel() {
    if (exportando) return;
    setExportando(true);
    setFalhaDaExportacao("");
    try {
      const itens = await lerTudoParaExportar(consultaAtual());
      const bytes = montarXlsx([
        {
          nome: "Colaboradores",
          cabecalho: true,
          larguras: [34, 24, 24, 16, 30, 18, 14, 16, 14, 12, 14, 16],
          linhas: [
            [...COLUNAS_DA_EXPORTACAO],
            ...linhasDaExportacao(itens, rotuloDoTipo),
          ],
        },
      ]);
      baixarArquivo(
        bytes,
        nomeDoArquivo(
          ["colaboradores", empresaAtiva?.nome ?? "escopo", diaDeHoje()],
          "xlsx",
        ),
        TIPO_MIME_XLSX,
      );
    } catch {
      setFalhaDaExportacao("Não foi possível exportar agora. Tente de novo.");
    } finally {
      setExportando(false);
    }
  }

  /** T215 — Exportar em PDF: o relatório da consulta, na impressão. */
  async function exportarPdf() {
    if (exportando) return;
    setExportando(true);
    setFalhaDaExportacao("");
    try {
      const itens = await lerTudoParaExportar(consultaAtual());
      setImpressao(linhasDaExportacao(itens, rotuloDoTipo));
    } catch {
      setFalhaDaExportacao("Não foi possível exportar agora. Tente de novo.");
    } finally {
      setExportando(false);
    }
  }

  // O relatório montado: imprime só ele e, depois, sai da página.
  useEffect(() => {
    if (impressao === null || !blocoDaImpressaoRef.current) return;
    const terminar = () => setImpressao(null);
    window.addEventListener("afterprint", terminar, { once: true });
    imprimirSomente(blocoDaImpressaoRef.current);
    return () => window.removeEventListener("afterprint", terminar);
  }, [impressao]);

  /** "Tentar novamente" do erro da tabela: relê a mesma consulta. */
  function repetirLeitura() {
    if (repetindoErro) return;
    // Limpa o anúncio antes: a mesma falha, de novo, é anunciada de novo.
    setAnuncioDaLista("");
    setRepetindoErro(true);
    void carregarDados(estado, buscaAplicada, false, false, true);
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
    if (destino === paginaRespondida) return;
    mudarEstado({ ...estado, pagina: destino });
  }

  /** T209 — as abas da ficha que o papel vê, na ordem da ficha (C-4). */

  function trocarAba(nova: AbaDaListagem) {
    if (nova === aba) return;
    // A aba nova começa na primeira página; tipo e lotação seguem quando
    // fazem sentido nela (a normalização tira o que não faz).
    const trocar = () => mudarEstado({ ...estado, aba: nova, pagina: 1 });
    // T200 — sair da aba Jornada desmonta a visão de jornadas embutida: com
    // edição pendente nela, a guarda do shell pergunta antes.
    if (aba === "jornada") {
      guarda.solicitarSaida({
        area: AREAS_DE_EDICAO.jornadaDoDashboard,
        executar: trocar,
      });
      return;
    }
    trocar();
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
    mudarEstado({ ...estado, pagina: 1, filtros: FILTROS_VAZIOS });
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
              { ...estado, pagina: 1, filtros: FILTROS_VAZIOS },
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

  const idsDaPagina = colaboradores.map((c) => c.id);
  const marcadosNaPagina = idsDaPagina.filter((id) => selecionados.has(id));
  const todosMarcados =
    idsDaPagina.length > 0 && marcadosNaPagina.length === idsDaPagina.length;
  const algunsMarcados = marcadosNaPagina.length > 0 && !todosMarcados;
  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(idsDaPagina));
  }
  function alternarUm(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const colunasColaboradores: ColunaDaLista[] = [
    {
      key: "selecao",
      header: (
        <label className="colaboradores-screen__marcar">
          <input
            type="checkbox"
            checked={todosMarcados}
            ref={(no) => {
              if (no) no.indeterminate = algunsMarcados;
            }}
            onChange={alternarTodos}
          />
          <span className="colaboradores-screen__so-leitor">
            Selecionar todos desta página
          </span>
        </label>
      ),
      cell: (c) => (
        <label className="colaboradores-screen__marcar">
          <input
            type="checkbox"
            checked={selecionados.has(c.id)}
            onChange={() => alternarUm(c.id)}
          />
          <span className="colaboradores-screen__so-leitor">
            {`Selecionar ${c.nome}`}
          </span>
        </label>
      ),
    },
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (c) => {
        const cargo = vinculoDaLinha(c, aba, filtros.tipos)?.lotacaoVigente
          ?.cargo?.nome;
        return (
          <span className="colaboradores-screen__pessoa">
            {/* T209 — a foto de 96 px, preguiçosa, quando o servidor a
                anuncia; senão (ou na falha), as iniciais. */}
            <FotoDoColaborador
              colaboradorId={c.id}
              foto={c.foto}
              tamanho={96}
              className="colaboradores-screen__avatar"
            >
              {iniciaisDe(c.nome)}
            </FotoDoColaborador>
            <span className="colaboradores-screen__pessoa-texto">
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
                <span className="colaboradores-screen__nome-texto">
                  {c.nome}
                </span>
              )}
              <span className="colaboradores-screen__cargo">
                {cargo ?? "Sem cargo"}
                {(c as ColaboradorDaLista).desativado ? (
                  <StatusBadge variant="neutral">Inativo</StatusBadge>
                ) : null}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      key: "cpf",
      header: "CPF",
      cell: (c) => {
        const cpf = (c as ColaboradorDaLista).cpf;
        return cpf ? mascararCpf(cpf) : "—";
      },
    },
    {
      key: "contatos",
      header: "Contatos",
      cell: (c) => {
        const contatos = (c as ColaboradorDaLista).contatos;
        const email = contatos?.emailPessoal;
        const telefone = contatos?.celular;
        if (!email && !telefone) {
          return (
            <span className="colaboradores-screen__sem-lotacao">
              Sem contato
            </span>
          );
        }
        return (
          <span className="colaboradores-screen__contatos">
            {email ? <span>{email}</span> : null}
            {telefone ? (
              <span className="colaboradores-screen__telefone">
                {exibirTelefone(telefone)}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "salario",
      header: "Salário",
      cell: (c) => {
        const salario = (c as ColaboradorDaLista).salarioBruto;
        return salario ? (
          <span className="colaboradores-screen__salario">
            R$ {formatarReais(Number(salario))}
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      key: "contrato",
      header: "Contrato",
      cell: (c) => {
        const vinculo = vinculoDaLinha(c, aba, filtros.tipos);
        return (
          <span
            className={
              vinculo
                ? `colaboradores-screen__contrato colaboradores-screen__contrato--${vinculo.tipo}`
                : "colaboradores-screen__contrato colaboradores-screen__contrato--vazio"
            }
          >
            <span
              className="colaboradores-screen__contrato-ponto"
              aria-hidden="true"
            />
            {vinculo ? ROTULO_TIPO_DE_VINCULO[vinculo.tipo] : "—"}
          </span>
        );
      },
    },
    // T215 — o ⋯ da linha: Ver ficha e, para quem edita, Editar
    // colaborador. Sem ficha, sem menu.
    ...(onAbrirFicha
      ? [
          {
            key: "acoes",
            header: (
              <span className="colaboradores-screen__so-leitor">Ações</span>
            ),
            cell: (c: ColaboradorListadoApi) => (
              <MenuAcoesDaPessoa
                nome={c.nome}
                atalhos={[
                  {
                    id: "ver-ficha",
                    rotulo: "Ver ficha",
                    icone: IconeVer,
                    aoEscolher: () => onAbrirFicha(c.id),
                  },
                  ...(onEditarColaborador
                    ? [
                        {
                          id: "editar",
                          rotulo: "Editar colaborador",
                          icone: IconeEditar,
                          aoEscolher: () => onEditarColaborador(c.id),
                        },
                      ]
                    : []),
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Gerencie contratos, dados e documentos do time."
        actions={
          <div className="colaboradores-screen__acoes-do-topo">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="colaboradores-screen__exportar"
                disabled={exportando}
              >
                <IconeBaixarArquivo tamanho={18} />
                Exportar
              </DropdownMenuTrigger>
              <DropdownMenuContent className="colaboradores-screen__menu-exportar">
                <DropdownMenuItem
                  className="colaboradores-screen__opcao-exportar"
                  onSelect={() => void exportarPdf()}
                >
                  <IconePlanilha tamanho={20} />
                  <span className="colaboradores-screen__opcao-texto">
                    <span className="colaboradores-screen__opcao-titulo">
                      Exportar em PDF
                    </span>
                    <span className="colaboradores-screen__opcao-descricao">
                      Relatório para impressão
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="colaboradores-screen__opcao-exportar"
                  onSelect={() => void exportarExcel()}
                >
                  <IconePlanilha tamanho={20} />
                  <span className="colaboradores-screen__opcao-texto">
                    <span className="colaboradores-screen__opcao-titulo">
                      Exportar em Excel
                    </span>
                    <span className="colaboradores-screen__opcao-descricao">
                      Planilha com todas as colunas
                    </span>
                  </span>
                </DropdownMenuItem>
                <p className="colaboradores-screen__nota-exportar">
                  Busca e filtros atuais são respeitados.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* T194 — "Novo colaborador" abre o painel das formas de
                entrada (cadastro e planilha). */}
            {onNovaAdmissao ? (
              <Button
                aria-haspopup="dialog"
                onClick={() => setPainelAdicionarAberto(true)}
              >
                <IconeMais tamanho={18} />
                Novo colaborador
              </Button>
            ) : null}
          </div>
        }
      />
      {exportando ? (
        <p className="colaboradores-screen__so-leitor" role="status">
          Preparando a exportação…
        </p>
      ) : null}
      {falhaDaExportacao ? (
        <p className="colaboradores-screen__falha-exportar" role="alert">
          {falhaDaExportacao}
        </p>
      ) : null}

      {/* T215 — três cartões, como a referência. Os números são do
          servidor, do escopo inteiro (sem aba, busca nem filtros). */}
      <section
        className="colaboradores-screen__resumo"
        aria-labelledby="colaboradores-indicadores-titulo"
      >
        <h2
          id="colaboradores-indicadores-titulo"
          className="colaboradores-screen__so-leitor"
          ref={tituloTotaisRef}
          tabIndex={-1}
        >
          Resumo de colaboradores
        </h2>
        <p
          className="colaboradores-screen__anuncio-totais colaboradores-screen__so-leitor"
          role="status"
        >
          {anuncioTotais}
        </p>
        {aba === "ferias" && servicoDeAusencias ? (
          <CartoesDeAusencias indicadores={indicadoresDeAusencias} />
        ) : !temTabela && contadores === null && falhaContadores ? (
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
          <div className="colaboradores-screen__cartoes-resumo">
            <CartaoAtivos contadores={contadores} />
            <CartaoTiposDeContrato contadores={contadores} />
            <div
              className="colaboradores-screen__cartao-resumo"
              role="group"
              aria-labelledby={`${prefixo}-ausentes`}
            >
              <div className="colaboradores-screen__cartao-cabeca">
                <span
                  className="colaboradores-screen__cartao-icone"
                  aria-hidden="true"
                >
                  <IconeCalendario tamanho={18} />
                </span>
                <h3
                  id={`${prefixo}-ausentes`}
                  className="colaboradores-screen__cartao-titulo"
                >
                  Ausentes hoje
                </h3>
                <button
                  type="button"
                  className="colaboradores-screen__cartao-link"
                  onClick={() => trocarAba("ferias")}
                >
                  Ver calendário
                </button>
              </div>
              <p className="colaboradores-screen__cartao-numero">0</p>
              <p className="colaboradores-screen__cartao-rodape">
                Ninguém ausente hoje
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="colaboradores-screen__painel">
        {/* T209 — Tabs da camada `src/ui` (ativação manual: setas, Home e
            End só movem o foco; clique, Enter ou Espaço trocam). */}
        <TabsList
          label="Grupos de colaboradores"
          className="colaboradores-screen__abas"
        >
          {ABAS_DA_LISTAGEM.filter(
            (a) => a !== "em-admissao" || aba === "em-admissao",
          ).map((a) => {
            const selecionada = a === aba;
            const numero =
              a === "ferias" && indicadoresDeAusencias
                ? indicadoresDeAusencias.pendentes
                : contadores
                  ? totalDaAba(a, contadores)
                  : null;
            return (
              <Fragment key={a}>
                <TabsTrigger
                  key={a}
                  id={idDaAba(a)}
                  data-aba={a}
                  selected={selecionada}
                  controls={idDoPainel}
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
                </TabsTrigger>
                {a === "jornada" && onAbrirOrganograma ? (
                  // T215 — atalho: abre a estrutura (outra tela); nunca fica
                  // selecionado nem controla o painel.
                  <TabsTrigger
                    data-aba="organograma"
                    selected={false}
                    controls={idDoPainel}
                    aria-controls={undefined}
                    className="colaboradores-screen__aba"
                    onClick={onAbrirOrganograma}
                  >
                    Organograma
                  </TabsTrigger>
                ) : null}
              </Fragment>
            );
          })}
        </TabsList>

        <TabsPanel
          id={idDoPainel}
          labelledBy={idDaAba(aba)}
          className="colaboradores-screen__painel-conteudo"
        >
          {aba === "ferias" && servicoDeAusencias ? (
            /* T215 — o módulo de Férias e ausências. */
            <FeriasEAusenciasAba
              servico={servicoDeAusencias}
              podeRegistrar={podeRegistrarAusencia}
              podeDecidir={podeRegistrarAusencia}
              onIndicadores={setIndicadoresDeAusencias}
              {...(onPoliticasDeFerias
                ? { onPoliticas: onPoliticasDeFerias }
                : {})}
            />
          ) : aba === "ferias" ? (
            <div className="colaboradores-screen__aba-em-breve">
              <h2>Férias e ausências</h2>
              <p>
                O registro de férias e ausências está em construção e chega na
                próxima versão.
              </p>
            </div>
          ) : aba === "jornada" ? (
            /* D-5, N-4 — a mesma visão de jornadas da empresa, com as mesmas
               permissões: só o RH opera. */
            <AreaDeEdicao id={AREAS_DE_EDICAO.jornadaDoDashboard}>
              <PessoasHorarioScreen
                embutida
                podeOperar={podeOperarJornada}
                {...(onAbrirFicha ? { onAbrirFicha } : {})}
              />
            </AreaDeEdicao>
          ) : (
            <>
              {/* T199 — o título da seção da aba: os estados vazios (h3)
                  e o erro ficam abaixo dele, e não de "Totais…". Só para
                  leitor de tela; a aba selecionada já o mostra. */}
              <h2 className="colaboradores-screen__so-leitor">
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
                  <span
                    className="colaboradores-screen__busca-icone"
                    aria-hidden="true"
                  >
                    <IconeBuscar tamanho={16} />
                  </span>
                  <Input
                    id="colaboradores-busca"
                    ref={campoBuscaRef}
                    type="search"
                    maxLength={BUSCA_COLABORADORES_MAXIMO}
                    autoComplete="off"
                    placeholder="Buscar por nome, CPF, e-mail ou ID"
                    aria-label="Buscar por nome, CPF, e-mail ou ID"
                    className="colaboradores-screen__busca-campo"
                    value={buscaDigitada}
                    onChange={(e) => setBuscaDigitada(e.target.value)}
                  />
                </form>

                {/* T215 — os filtros moram na gaveta "Filtrar". */}
                <Button
                  id={ID_BOTAO_FILTRAR}
                  variant="secondary"
                  className="colaboradores-screen__botao-filtrar"
                  aria-haspopup="dialog"
                  {...(quantosFiltros > 0
                    ? {
                        "aria-label": `Filtrar, ${
                          quantosFiltros === 1
                            ? "1 filtro ativo"
                            : `${quantosFiltros} filtros ativos`
                        }`,
                      }
                    : {})}
                  onClick={() => setGavetaAberta(true)}
                >
                  <IconeFiltrar tamanho={16} />
                  Filtrar
                  {quantosFiltros > 0 ? (
                    <span
                      className="colaboradores-screen__filtrar-total"
                      aria-hidden="true"
                    >
                      {quantosFiltros}
                    </span>
                  ) : null}
                </Button>
              </div>

              <GavetaDeFiltros
                aberta={gavetaAberta}
                onFechar={() => setGavetaAberta(false)}
                filtros={filtros}
                comLotacao={comLotacao}
                catalogos={catalogos}
                repetindoCatalogos={repetindoCatalogos}
                onRecarregarCatalogos={recarregarCatalogos}
                anuncioDosCatalogos={anuncioDosCatalogos}
                idDosGruposDeLotacao={ID_GRUPOS_DE_LOTACAO}
                rotuloDoNivel={rotuloDoNivel}
                rotuloDoTipo={rotuloDoTipo}
                rotuloDoGenero={rotuloDoGenero}
                contar={contarNaGaveta}
                onAplicar={aplicarFiltros}
              />

              {/* O que está filtrando, à vista, e como desfazer cada um. */}
              {temFiltro ? (
                <div
                  className="colaboradores-screen__filtros-ativos"
                  role="group"
                  aria-label="Filtros ativos"
                >
                  {filtrosAplicados.map((f) => (
                    <Button
                      key={`${f.grupo}-${f.valor}`}
                      id={idDoChip(f)}
                      variant="secondary"
                      className="colaboradores-screen__filtro-ativo"
                      aria-label={`Remover filtro ${f.texto}`}
                      onClick={() => removerFiltro(f)}
                    >
                      {f.texto} <span aria-hidden="true">×</span>
                    </Button>
                  ))}
                </div>
              ) : null}

              {(statusCarregamento === "erro" || repetindoErro) &&
              acaoDoVazio === null ? (
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
                    aria-disabled={repetindoErro}
                    onClick={repetirLeitura}
                  >
                    Tentar novamente
                  </Button>
                </Surface>
              ) : (
                <>
                  {/* O total da consulta vem do SERVIDOR; sem região viva —
                      a paginação já anuncia a posição. Depois de uma falha
                      (o estado vazio da ação segue à vista), nenhum total:
                      nem "Contando…", nem o número de antes. */}
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
                                // O campo de busca: visível para quem usa
                                // teclado; o anúncio dá o contexto.
                                destinoDoFoco: ID_CAMPO_BUSCA,
                                anunciarPrimeiraPagina: true,
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
                                      <IconeMais tamanho={18} />
                                      Novo colaborador
                                    </Button>
                                  ),
                                }
                              : {})}
                          />
                        );
                      })()
                    )
                  ) : (
                    /* T209 — primitivas de tabela da camada `src/ui`: a
                       mesma semântica e as mesmas classes do DataTable. */
                    <TableContainer
                      label={`Colaboradores — ${ROTULO_DA_ABA[aba]}`}
                    >
                      <Table>
                        <TableCaption visible={false}>
                          {`Colaboradores — ${ROTULO_DA_ABA[aba]}`}
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            {colunasColaboradores.map((coluna) => (
                              <TableHead
                                key={coluna.key}
                                className={`colaboradores-screen__coluna--${coluna.key}`}
                              >
                                {coluna.header}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {colaboradores.map((c) => (
                            <TableRow
                              key={c.id}
                              className={
                                selecionados.has(c.id)
                                  ? "colaboradores-screen__linha--marcada"
                                  : undefined
                              }
                            >
                              {colunasColaboradores.map((coluna) => (
                                <TableCell
                                  key={coluna.key}
                                  className={`colaboradores-screen__coluna--${coluna.key}`}
                                >
                                  {coluna.cell(c)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* T164/R-2 — a navegação fica fora do ramo que troca na
                      carga e usa `aria-disabled`: o botão focado continua
                      focado enquanto a página nova chega. */}
                  {/* Página além do fim: o estado vazio já oferece a
                      primeira; nada de "Página 4 de 2". */}
                  {/* T209 — rodapé da tabela: tamanho da página (C-2) e
                      paginação numerada (C-3). O seletor fica fora do ramo
                      que troca na carga: o foco não se perde. */}
                  <div className="colaboradores-screen__rodape-tabela">
                    {statusCarregamento !== "erro" ? (
                      <p className="colaboradores-screen__resultados">
                        {statusCarregamento !== "dados"
                          ? "Contando…"
                          : total === 1
                            ? "1 resultado"
                            : `${total} resultados`}
                      </p>
                    ) : null}
                    {totalPaginas > 1 && paginaRespondida <= totalPaginas ? (
                      <nav
                        className="colaboradores-screen__paginacao"
                        aria-label="Paginação de colaboradores"
                        aria-busy={carregando}
                      >
                        <Button
                          variant="secondary"
                          onClick={() => irParaPagina(1)}
                          aria-disabled={paginaRespondida <= 1 || carregando}
                        >
                          Primeira página
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => irParaPagina(paginaRespondida - 1)}
                          aria-disabled={paginaRespondida <= 1 || carregando}
                        >
                          Página anterior
                        </Button>
                        <ul className="colaboradores-screen__paginas">
                          {paginasDaJanela(paginaRespondida, totalPaginas).map(
                            (n) => (
                              <li key={n}>
                                <button
                                  type="button"
                                  className="colaboradores-screen__pagina-numero"
                                  aria-label={`Página ${n}`}
                                  aria-current={
                                    n === paginaRespondida ? "page" : undefined
                                  }
                                  aria-disabled={carregando}
                                  onClick={() => irParaPagina(n)}
                                >
                                  {n}
                                </button>
                              </li>
                            ),
                          )}
                        </ul>
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
                        <Button
                          variant="secondary"
                          onClick={() => irParaPagina(totalPaginas)}
                          aria-disabled={
                            paginaRespondida >= totalPaginas || carregando
                          }
                        >
                          Última página
                        </Button>
                      </nav>
                    ) : null}
                  </div>
                </>
              )}
            </>
          )}
        </TabsPanel>
      </div>

      {impressao !== null ? (
        <div
          ref={blocoDaImpressaoRef}
          className="colaboradores-screen__impressao"
        >
          <h1>Colaboradores</h1>
          <p>
            {empresaAtiva ? empresaAtiva.nome : "Seu escopo"} —{" "}
            {ROTULO_DA_ABA[aba]}
            {buscaAplicada ? ` · busca “${buscaAplicada}”` : ""}
            {quantosFiltros > 0
              ? ` · ${plural(quantosFiltros, "filtro", "filtros")}`
              : ""}
          </p>
          <table>
            <thead>
              <tr>
                {COLUNAS_DA_EXPORTACAO.map((coluna) => (
                  <th key={coluna}>{coluna}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {impressao.map((linha, i) => (
                <tr key={i}>
                  {linha.map((celula, j) => (
                    <td key={j}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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
          {...(onImportarPlanilha
            ? {
                onImportarPlanilha: () => {
                  setPainelAdicionarAberto(false);
                  onImportarPlanilha();
                },
              }
            : {})}
          {...(onImportarPlanilha && onImportarArquivo
            ? {
                onImportarArquivo: (arquivo: File) => {
                  setPainelAdicionarAberto(false);
                  onImportarArquivo(arquivo);
                },
              }
            : {})}
        />
      ) : null}
    </div>
  );
}
