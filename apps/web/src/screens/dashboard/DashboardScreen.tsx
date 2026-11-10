/**
 * T205 — Dashboard inicial: a visão do ano, só com dados reais (D-1 a D-12).
 * T207 — Dashboard funcional: cinco abas com rota, o mesmo ano para todas
 * (V-3, V-4), e a Visão Geral reorganizada em resumo, indicadores, pessoas
 * hoje, tipo de vínculo e movimentação mensal (V-1).
 *
 * ## Só dado real
 *
 * Toda leitura vem de contratos existentes:
 * - `GET /v1/colaboradores` → `contadores` (pessoas hoje, por situação e por
 *   tipo de vínculo, da empresa inteira);
 * - `GET /v1/movimentacoes?tipo=&status=efetivada` → as quatro movimentações
 *   efetivadas no ano, agrupadas por mês da vigência, com o teto da T205.
 *
 * Turnover, absenteísmo e custo por pessoa não têm fonte no Evolli: aparecem
 * como cards honestos (V-2) — "—", um selo de estado em texto e a explicação
 * do que falta — sem porcentagem, tendência nem ação. Remuneração e Clima e
 * saúde são abas reais, com rota, mas sem número: dizem por que não há dado.
 *
 * ## O que não mudou desde a T205
 *
 * Geração por leitura (resposta atrasada descartada), paginação abandonada ao
 * trocar de ano ou desmontar, nenhum número parcial acima do teto, um nó de
 * status para carga e conclusão, alerta só para falha, nova tentativa por
 * bloco com o foco no título dele, e nenhuma consulta sem empresa ativa (D-6).
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "../../components";
import {
  listarColaboradores,
  type ContadoresColaboradoresApi,
  type TipoVinculo,
} from "../../api/colaboradoresClient";
import {
  listarMovimentacoes,
  type TipoMovimentacao,
} from "../../api/movimentacaoClient";
import { formatarInstante } from "../../format/data";
import {
  ABAS_DO_DASHBOARD,
  ANO_MINIMO_DO_DASHBOARD,
  ESTADO_INICIAL_DA_LISTAGEM,
  anoCorrente,
  rotaDaListagem,
  type AbaDoDashboard,
  type EstadoDaListagem,
} from "../../app/rotasDoShell";
import {
  ROTULO_DA_MOVIMENTACAO,
  TETO_DE_PAGINAS_POR_SERIE,
  TAMANHO_PAGINA_MOVIMENTACOES,
  TIPOS_DE_MOVIMENTACAO,
  fraseResumo,
  lerSerieMensal,
  nomeDoMes,
  periodoDoAno,
  plural,
  type PeriodoDoDashboard,
  type SerieMensal,
  lerTimeDeHoje,
  type TimeDeHoje,
} from "./dashboardDados";
import {
  BlocoSemDado,
  CartaoSemDado,
  ComoCalculamos,
  EstadoIndisponivel,
  type BlocoComVista,
  type VistaDoBloco,
} from "./componentesDoDashboard";
import { QuadroDeColaboradores } from "./QuadroDeColaboradores";
import { DistribuicaoDoTimeBloco, TempoDeCasaBloco } from "./BlocosDoTime";
import { GraficoMensal } from "./GraficoMensal";
import "./DashboardScreen.css";

export const DASHBOARD_TITULO_ID = "dashboard-titulo";

/** Limite de uma série, em vínculos (o teto da T205). */
export const LIMITE_DA_SERIE =
  TETO_DE_PAGINAS_POR_SERIE * TAMANHO_PAGINA_MOVIMENTACOES;
/**
 * O limite escrito para quem lê. Texto fixo (a formatação de números fica no
 * módulo central); o teste prende os dois juntos.
 */
export const LIMITE_DA_SERIE_TEXTO = "2.000";

const TIPOS: readonly TipoVinculo[] = [
  "clt",
  "estagio",
  "pj",
  "temporario",
  "outro_controlado",
];

const ROTULO_TIPO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

/** T207 — o nome de cada aba, na ordem da rota. */
export const ROTULO_DA_ABA: Readonly<Record<AbaDoDashboard, string>> = {
  "visao-geral": "Visão Geral",
  pessoas: "Pessoas",
  movimentacao: "Movimentação",
  remuneracao: "Remuneração",
  "clima-e-saude": "Clima e saúde",
};

/** T207 — abas que leem dados; as outras dizem por que não há. */
function abaLeDados(aba: AbaDoDashboard): boolean {
  return aba === "visao-geral" || aba === "pessoas" || aba === "movimentacao";
}

/** Uma parte da leitura: carregando, com dados, ou com falha. */
type Parte<T> =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "dados"; readonly dados: T }
  | {
      readonly tipo: "erro";
      readonly falhas: number;
      readonly relendo: boolean;
    };

interface Series {
  readonly periodo: PeriodoDoDashboard;
  readonly porTipo: Readonly<Record<TipoMovimentacao, SerieMensal>>;
}

function proximaFalha<T>(anterior: Parte<T>): Parte<T> {
  return {
    tipo: "erro",
    falhas: anterior.tipo === "erro" ? anterior.falhas + 1 : 1,
    relendo: false,
  };
}

function emNovaLeitura<T>(anterior: Parte<T>): Parte<T> {
  return anterior.tipo === "erro" ? { ...anterior, relendo: true } : anterior;
}

export interface DashboardScreenProps {
  /** O ano consultado (já validado pelo shell, a partir da URL). */
  readonly ano: number;
  /** T207 — a aba aberta (já validada pelo shell, a partir da URL). */
  readonly aba?: AbaDoDashboard;
  /** A empresa ativa da sessão; `null` = sem empresa (nada é consultado). */
  readonly empresaAtiva: { readonly nome: string } | null;
  /** Outro ano: o shell troca a URL (uma entrada nova no histórico). */
  readonly onTrocarAno: (ano: number) => void;
  /** T207 — outra aba: o shell troca a URL (uma entrada nova). */
  readonly onTrocarAba?: (aba: AbaDoDashboard) => void;
  /** Um indicador clicado: a listagem de Colaboradores com este estado. */
  readonly onAbrirListagem: (estado: EstadoDaListagem) => void;
  /**
   * T207 — gráfico ou tabela em cada bloco que tem as duas vistas. Guardado
   * por quem monta o shell, em memória e por conta (ver `AutenticacaoApp`):
   * vale só nesta aba do navegador e não passa para outra conta. Ausente, a
   * tela guarda sozinha, enquanto estiver montada.
   */
  readonly vistas?:
    Readonly<Partial<Record<BlocoComVista, VistaDoBloco>>> | undefined;
  readonly onTrocarVista?:
    ((bloco: BlocoComVista, vista: VistaDoBloco) => void) | undefined;
}

export function DashboardScreen({
  ano,
  aba = "visao-geral",
  empresaAtiva,
  onTrocarAno,
  onTrocarAba,
  onAbrirListagem,
  vistas,
  onTrocarVista,
}: DashboardScreenProps) {
  const prefixo = useId();
  const ids = {
    pessoas: `${prefixo}-pessoas`,
    serie: `${prefixo}-serie`,
    tipos: `${prefixo}-tipos`,
    seletorAno: `${prefixo}-ano`,
    hoje: `${prefixo}-hoje`,
    indicadores: `${prefixo}-indicadores`,
    distribuicao: `${prefixo}-distribuicao`,
    tempoDeCasa: `${prefixo}-tempo-de-casa`,
  };
  const idDaAba = (a: AbaDoDashboard) => `${prefixo}-aba-${a}`;
  const idDoPainel = (a: AbaDoDashboard) => `${prefixo}-painel-${a}`;
  const temEmpresa = empresaAtiva !== null;
  const lerDados = temEmpresa && abaLeDados(aba);

  const [contadores, setContadores] = useState<
    Parte<ContadoresColaboradoresApi>
  >({ tipo: "carregando" });
  const [series, setSeries] = useState<Parte<Series>>({ tipo: "carregando" });
  /** T207 — as pessoas ativas de hoje (distribuição e tempo de casa). */
  const [time, setTime] = useState<Parte<TimeDeHoje>>({ tipo: "carregando" });
  /**
   * O ano a que a última série lida (ou a última falha) se refere. Ao trocar
   * de ano, o que estava na tela é de outro ano e não pode ser desenhado com
   * o rótulo do ano novo, nem por um único desenho.
   */
  const [anoDaSerie, setAnoDaSerie] = useState<number | null>(null);
  const [lendo, setLendo] = useState(lerDados);
  /** O anúncio da última leitura concluída (um `span` novo por leitura). */
  const [aviso, setAviso] = useState<{
    readonly texto: string;
    readonly n: number;
  } | null>(null);
  const [lidoEm, setLidoEm] = useState<string | null>(null);
  const [vistasLocais, setVistasLocais] = useState<
    Partial<Record<BlocoComVista, VistaDoBloco>>
  >({});
  const vistaDe = (bloco: BlocoComVista): VistaDoBloco =>
    (vistas ?? vistasLocais)[bloco] ?? "grafico";
  const trocarVista = (bloco: BlocoComVista) => (vista: VistaDoBloco) => {
    if (onTrocarVista) onTrocarVista(bloco, vista);
    else setVistasLocais((atuais) => ({ ...atuais, [bloco]: vista }));
  };

  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /** Só a leitura mais recente de cada parte vale. */
  const geracaoRef = useRef({ leitura: 0, contadores: 0, series: 0, time: 0 });
  const contadorDeAvisosRef = useRef(0);
  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);

  const lerContadores = useCallback(async (): Promise<boolean> => {
    const geracao = ++geracaoRef.current.contadores;
    try {
      const resposta = await listarColaboradores({ tamanhoPagina: 1 });
      if (!vivaRef.current || geracao !== geracaoRef.current.contadores) {
        return false;
      }
      setContadores({ tipo: "dados", dados: resposta.contadores });
      return true;
    } catch {
      if (!vivaRef.current || geracao !== geracaoRef.current.contadores) {
        return false;
      }
      setContadores(proximaFalha);
      return false;
    }
  }, []);

  const lerSeries = useCallback(
    async (anoLido: number): Promise<Series | null> => {
      const geracao = ++geracaoRef.current.series;
      const periodo = periodoDoAno(anoLido);
      // Outro ano, outra leitura ou a tela desmontada: as páginas restantes
      // não são pedidas.
      const vale = () =>
        vivaRef.current && geracao === geracaoRef.current.series;
      try {
        const lidas = await Promise.all(
          TIPOS_DE_MOVIMENTACAO.map((tipo) =>
            lerSerieMensal(tipo, periodo, listarMovimentacoes, vale),
          ),
        );
        if (!vivaRef.current || geracao !== geracaoRef.current.series) {
          return null;
        }
        const porTipo = Object.fromEntries(
          TIPOS_DE_MOVIMENTACAO.map((tipo, i) => [tipo, lidas[i]!]),
        ) as Record<TipoMovimentacao, SerieMensal>;
        const dados = { periodo, porTipo };
        setSeries({ tipo: "dados", dados });
        setAnoDaSerie(anoLido);
        return dados;
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current.series) {
          return null;
        }
        setSeries(proximaFalha);
        setAnoDaSerie(anoLido);
        return null;
      }
    },
    [],
  );

  /**
   * T207 — as pessoas ativas de hoje, de 100 em 100, com o teto da T205.
   * Outra leitura ou a tela desmontada: as páginas restantes não são pedidas.
   */
  const lerTime = useCallback(async (): Promise<boolean> => {
    const geracao = ++geracaoRef.current.time;
    const vale = () => vivaRef.current && geracao === geracaoRef.current.time;
    try {
      const lido = await lerTimeDeHoje(
        (query) => listarColaboradores(query),
        vale,
      );
      if (!vale()) return false;
      setTime({ tipo: "dados", dados: lido });
      return true;
    } catch {
      if (!vale()) return false;
      setTime(proximaFalha);
      return false;
    }
  }, []);

  /** Conclui uma leitura: hora da leitura e um anúncio. */
  const concluir = useCallback((texto: string) => {
    const instante = formatarInstante(new Date().toISOString());
    setLidoEm(instante);
    contadorDeAvisosRef.current += 1;
    setAviso({
      texto: texto.replace("{instante}", instante),
      n: contadorDeAvisosRef.current,
    });
  }, []);

  /** Um anúncio no status, sem mexer na hora da leitura (exportações). */
  const anunciar = useCallback((texto: string) => {
    contadorDeAvisosRef.current += 1;
    setAviso({ texto, n: contadorDeAvisosRef.current });
  }, []);

  /** Leitura completa: na entrada, ao trocar de ano e em "Atualizar". */
  const lerTudo = useCallback(
    async (anoLido: number) => {
      const geracao = ++geracaoRef.current.leitura;
      setLendo(true);
      setAviso(null);
      // "Atualizar" mantém na tela o que já estava lido (do mesmo ano) até
      // a leitura nova chegar; outro ano começa do zero.
      setContadores((c) => (c.tipo === "dados" ? c : { tipo: "carregando" }));
      setSeries((s) =>
        s.tipo === "dados" && s.dados.periodo.ano === anoLido
          ? s
          : { tipo: "carregando" },
      );
      setTime((p) => (p.tipo === "dados" ? p : { tipo: "carregando" }));
      const [okContadores, dadosSeries, okTime] = await Promise.all([
        lerContadores(),
        lerSeries(anoLido),
        lerTime(),
      ]);
      if (!vivaRef.current || geracao !== geracaoRef.current.leitura) return;
      setLendo(false);
      if (okContadores || dadosSeries || okTime) {
        concluir(
          `Dashboard de ${anoLido} lido em {instante}.${
            dadosSeries && excedeu(dadosSeries)
              ? " Alguma movimentação do ano passa do limite desta visão."
              : ""
          }`,
        );
      }
    },
    [lerContadores, lerSeries, lerTime, concluir],
  );

  // Leitura na entrada, a cada ano e ao chegar numa aba que lê dados; sem
  // empresa ativa, ou numa aba sem dados, nenhuma.
  useEffect(() => {
    if (!lerDados) {
      // Uma leitura em andamento deixa de valer: a aba nova não a exibe.
      geracaoRef.current.leitura += 1;
      geracaoRef.current.series += 1;
      geracaoRef.current.contadores += 1;
      geracaoRef.current.time += 1;
      setLendo(false);
      return;
    }
    void lerTudo(ano);
  }, [lerDados, ano, lerTudo]);

  async function novaTentativaDosContadores() {
    if (contadores.tipo !== "erro" || contadores.relendo) return;
    setContadores(emNovaLeitura);
    if (await lerContadores()) {
      focoRef.current = ids.pessoas;
      concluir(`Totais de pessoas lidos em {instante}.`);
    }
  }

  async function novaTentativaDaSerie() {
    if (series.tipo !== "erro" || series.relendo) return;
    setSeries(emNovaLeitura);
    if ((await lerSeries(ano)) !== null) {
      focoRef.current = ids.serie;
      concluir(`Movimentações de ${ano} lidas em {instante}.`);
    }
  }

  async function novaTentativaDoTime() {
    if (time.tipo !== "erro" || time.relendo) return;
    setTime(emNovaLeitura);
    if (await lerTime()) {
      focoRef.current = ids.distribuicao;
      concluir(`Distribuição e tempo de casa lidos em {instante}.`);
    }
  }

  function atualizar() {
    if (lendo) return;
    void lerTudo(ano);
  }

  // Foco depois do desenho; e, ao abrir a tela sem foco em lugar nenhum (a
  // entrada pelo login, o "voltar" do navegador), o título.
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const ativo = document.activeElement;
    if (ativo === null || ativo === document.body) tituloRef.current?.focus();
  }, []);
  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  // ---- Abas: setas, Home e End movem o foco; Enter e Espaço ativam --------
  function aoTeclarNaAba(evento: KeyboardEvent<HTMLButtonElement>) {
    const atual = ABAS_DO_DASHBOARD.indexOf(
      (evento.currentTarget.dataset.aba ?? aba) as AbaDoDashboard,
    );
    const total = ABAS_DO_DASHBOARD.length;
    let alvo: number | null = null;
    if (evento.key === "ArrowRight") alvo = (atual + 1) % total;
    if (evento.key === "ArrowLeft") alvo = (atual - 1 + total) % total;
    if (evento.key === "Home") alvo = 0;
    if (evento.key === "End") alvo = total - 1;
    if (alvo === null) return;
    evento.preventDefault();
    document.getElementById(idDaAba(ABAS_DO_DASHBOARD[alvo]!))?.focus();
  }

  const corrente = anoCorrente();
  const titulo = (
    <h1
      id={DASHBOARD_TITULO_ID}
      ref={tituloRef}
      tabIndex={-1}
      className="dashboard__titulo"
    >
      Dashboard
    </h1>
  );

  if (!temEmpresa) {
    return (
      <section className="dashboard" aria-labelledby={DASHBOARD_TITULO_ID}>
        <header className="dashboard__cabecalho">{titulo}</header>
        <div className="dashboard__orientacao">
          <p>Escolha uma empresa ativa no menu para ver o Dashboard.</p>
          <p className="dashboard__nota">
            Sem empresa ativa, os números de empresas diferentes ficariam
            misturados; por isso nada é consultado.
          </p>
        </div>
      </section>
    );
  }

  const linkDaListagem = (estado: EstadoDaListagem) => ({
    href: rotaDaListagem(estado),
    onClick: (evento: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        evento.button !== 0 ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey ||
        evento.altKey
      ) {
        return;
      }
      evento.preventDefault();
      onAbrirListagem(estado);
    },
  });

  const anos: number[] = [];
  for (let a = corrente; a >= ANO_MINIMO_DO_DASHBOARD; a -= 1) anos.push(a);
  const dadosContadores = contadores.tipo === "dados" ? contadores.dados : null;
  // Só a série (ou a falha) do ano exibido conta; a de outro ano é tratada
  // como "carregando" até a leitura deste ano terminar.
  const dadosSeries =
    series.tipo === "dados" && series.dados.periodo.ano === ano
      ? series.dados
      : null;
  const falhaDaSerie =
    series.tipo === "erro" && anoDaSerie === ano ? series : null;
  const periodo = dadosSeries?.periodo ?? periodoDoAno(ano);
  const quando = periodo.ateHoje ? `em ${ano}, até hoje` : `em ${ano}`;
  const completa = (tipo: TipoMovimentacao) => {
    const s = dadosSeries?.porTipo[tipo];
    return s?.tipo === "completa" ? s : null;
  };
  const admissoes = completa("admissao");
  const desligamentos = completa("desligamento");

  const textoDoStatus = lendo ? `Carregando o Dashboard de ${ano}…` : null;
  const dadosDoTime = time.tipo === "dados" ? time.dados : null;
  const falhaDoTime =
    time.tipo === "erro" ? (
      <div className="dashboard__falha">
        <p key={time.falhas} role="alert">
          Não foi possível carregar as pessoas ativas de hoje.
        </p>
        <Button
          type="button"
          variant="secondary"
          aria-disabled={time.relendo}
          onClick={() => void novaTentativaDoTime()}
        >
          Tentar de novo
          <span className="dashboard__so-leitor">
            {" "}
            as pessoas ativas de hoje
          </span>
        </Button>
      </div>
    ) : null;

  const falhaDosContadores =
    contadores.tipo === "erro" ? (
      <div className="dashboard__falha">
        <p key={contadores.falhas} role="alert">
          Não foi possível carregar os totais de pessoas.
        </p>
        <Button
          type="button"
          variant="secondary"
          aria-disabled={contadores.relendo}
          onClick={() => void novaTentativaDosContadores()}
        >
          Tentar de novo
          <span className="dashboard__so-leitor"> os totais de pessoas</span>
        </Button>
      </div>
    ) : null;

  const estadoDaSerie = (
    tipos: readonly TipoMovimentacao[],
    conteudo: (
      series: Readonly<Record<TipoMovimentacao, number[]>>,
    ) => ReactNode,
  ): ReactNode => {
    if (falhaDaSerie) {
      return (
        <div className="dashboard__falha">
          <p key={falhaDaSerie.falhas} role="alert">
            Não foi possível carregar as movimentações de {ano}.
          </p>
          <Button
            type="button"
            variant="secondary"
            aria-disabled={falhaDaSerie.relendo}
            onClick={() => void novaTentativaDaSerie()}
          >
            Tentar de novo
            <span className="dashboard__so-leitor"> as movimentações</span>
          </Button>
        </div>
      );
    }
    if (dadosSeries === null) {
      return (
        <p className="dashboard__nota" aria-hidden="true">
          Carregando…
        </p>
      );
    }
    const excedidas = tipos.filter(
      (t) => dadosSeries.porTipo[t].tipo === "excedida",
    );
    if (excedidas.length > 0) {
      return (
        <p className="dashboard__aviso">
          {juntarRotulos(excedidas)}: mais de {LIMITE_DA_SERIE_TEXTO} vínculos
          efetivados {quando}, o limite desta visão. Os números não são exibidos
          para não mostrar um total incompleto.
        </p>
      );
    }
    const porTipo = Object.fromEntries(
      tipos.map((t) => {
        const s = dadosSeries.porTipo[t];
        return [t, s.tipo === "completa" ? [...s.porMes] : []];
      }),
    ) as Record<TipoMovimentacao, number[]>;
    return conteudo(porTipo);
  };

  // ---- Visão Geral --------------------------------------------------------
  const visaoGeral = (
    <>
      <section className="dashboard__resumo" aria-labelledby={ids.pessoas}>
        <div className="dashboard__resumo-topo">
          <h2 id={ids.pessoas} tabIndex={-1} className="dashboard__subtitulo">
            Resumo
          </h2>
          {/* A hora da leitura, uma vez só: na Visão Geral fica aqui, no
              card do Resumo; nas outras abas, junto de "Atualizar". */}
          <span className="dashboard__selo dashboard__selo--leitura">
            {lidoEm ? `Dados lidos em ${lidoEm}` : "Ainda não lido"}
          </span>
        </div>
        {dadosContadores && admissoes && desligamentos ? (
          <p className="dashboard__frase">
            {fraseResumo(
              dadosContadores.ativos,
              dadosContadores.emAdmissao,
              admissoes.total,
              desligamentos.total,
              periodo,
            )}
          </p>
        ) : null}
        {falhaDosContadores}
      </section>

      <section aria-labelledby={ids.indicadores}>
        <h2 id={ids.indicadores} className="dashboard__so-leitor">
          Indicadores
        </h2>
        <ul className="dashboard__indicadores">
          <li>
            <article
              className="dashboard__indicador"
              aria-labelledby={`${prefixo}-ind-ativos`}
            >
              <h3
                id={`${prefixo}-ind-ativos`}
                className="dashboard__indicador-rotulo"
              >
                Colaboradores ativos
              </h3>
              {dadosContadores ? (
                <>
                  <p className="dashboard__indicador-valor">
                    {String(dadosContadores.ativos)}
                    <span className="dashboard__indicador-unidade">
                      {dadosContadores.ativos === 1 ? " pessoa" : " pessoas"}
                    </span>
                  </p>
                  <p className="dashboard__indicador-nota">
                    Com vínculo ativo hoje
                    {admissoes && desligamentos ? (
                      <>
                        {" · "}
                        <span className="dashboard__saldo">
                          {sinal(admissoes.total - desligamentos.total)}
                        </span>{" "}
                        vínculos {quando}
                      </>
                    ) : null}
                  </p>
                  <a
                    className="dashboard__link"
                    {...linkDaListagem({
                      ...ESTADO_INICIAL_DA_LISTAGEM,
                      aba: "ativos",
                    })}
                  >
                    Abrir na listagem
                    <span className="dashboard__so-leitor">
                      {" "}
                      de Colaboradores: pessoas ativas
                    </span>
                  </a>
                  <ComoCalculamos assunto="colaboradores ativos">
                    <p>
                      Pessoas com vínculo principal ativo hoje, no cadastro de
                      Colaboradores da empresa ativa. Cada pessoa conta uma vez.
                    </p>
                    <p>
                      O saldo do ano é a diferença entre admissões e
                      desligamentos efetivados no ano escolhido, contados em
                      vínculos (uma pessoa pode ter mais de um vínculo).
                    </p>
                  </ComoCalculamos>
                </>
              ) : contadores.tipo === "erro" ? (
                <p className="dashboard__indicador-nota">
                  Totais de pessoas indisponíveis no momento.
                </p>
              ) : (
                <p className="dashboard__nota" aria-hidden="true">
                  Carregando…
                </p>
              )}
            </article>
          </li>
          <li>
            <CartaoSemDado
              id={`${prefixo}-ind-turnover`}
              rotulo="Turnover no ano"
              selo="Requer definição"
            >
              Para calcular a rotatividade, o Evolli precisa de uma regra
              aprovada e do histórico de pessoas ativas mês a mês, que ainda não
              é guardado.
            </CartaoSemDado>
          </li>
          <li>
            <CartaoSemDado
              id={`${prefixo}-ind-absenteismo`}
              rotulo="Absenteísmo"
              selo="Indisponível no Evolli"
            >
              Depende de horas previstas, faltas e afastamentos apurados. Hoje o
              ponto do Evolli guarda só as marcações, sem apuração.
            </CartaoSemDado>
          </li>
          <li>
            <CartaoSemDado
              id={`${prefixo}-ind-custo`}
              rotulo="Custo por pessoa"
              selo="Indisponível no Evolli"
            >
              Depende de folha e salários, que não fazem parte do Evolli. A
              folha oficial é processada fora dele.
            </CartaoSemDado>
          </li>
        </ul>
      </section>

      <QuadroDeColaboradores
        idTitulo={ids.serie}
        empresa={empresaAtiva.nome}
        periodo={periodo}
        quando={quando}
        ativosHoje={dadosContadores ? dadosContadores.ativos : null}
        dados={
          admissoes && desligamentos
            ? { entradas: admissoes.porMes, saidas: desligamentos.porMes }
            : null
        }
        semDados={
          admissoes && desligamentos
            ? null
            : estadoDaSerie(["admissao", "desligamento"], () => null)
        }
        vista={vistaDe("quadro")}
        onTrocarVista={trocarVista("quadro")}
        onAnunciar={anunciar}
      />

      <div className="dashboard__grade">
        <DistribuicaoDoTimeBloco
          idTitulo={ids.distribuicao}
          time={dadosDoTime}
          falha={falhaDoTime}
          empresa={empresaAtiva.nome}
          vista={vistaDe("distribuicao")}
          onTrocarVista={trocarVista("distribuicao")}
          onAnunciar={anunciar}
        />
        <BlocoSemDado
          titulo="eNPS"
          subtitulo="Quanto o time recomendaria a empresa como lugar para trabalhar."
          selo="Indisponível no Evolli"
        >
          O Evolli ainda não tem pesquisas internas. Sem uma pesquisa respondida
          pelo time, não há nota a mostrar.
        </BlocoSemDado>
        <BlocoSemDado
          titulo="Quem é o time"
          subtitulo="Retrato agregado de quem está ativo hoje."
          selo="Indisponível no Evolli"
        >
          Idade, gênero e escolaridade são dados pessoais restritos e não fazem
          parte da leitura do Dashboard. Um retrato agregado do time depende de
          uma regra de privacidade aprovada.
        </BlocoSemDado>
        <TempoDeCasaBloco
          idTitulo={ids.tempoDeCasa}
          time={dadosDoTime}
          empresa={empresaAtiva.nome}
          vista={vistaDe("tempo-de-casa")}
          onTrocarVista={trocarVista("tempo-de-casa")}
          onAnunciar={anunciar}
          falha={
            falhaDoTime ? (
              <p className="dashboard__nota">
                Depende da leitura das pessoas ativas de hoje, que não foi
                carregada. A nova tentativa fica em Distribuição do time.
              </p>
            ) : null
          }
        />
      </div>

      <div className="dashboard__duas-colunas">
        <section className="dashboard__bloco" aria-labelledby={ids.hoje}>
          <h2 id={ids.hoje} className="dashboard__subtitulo">
            Pessoas hoje
          </h2>
          {dadosContadores ? (
            <>
              <ul className="dashboard__situacoes">
                <li>
                  <a
                    className="dashboard__situacao"
                    {...linkDaListagem({
                      ...ESTADO_INICIAL_DA_LISTAGEM,
                      aba: "ativos",
                    })}
                  >
                    <span className="dashboard__situacao-rotulo">Ativas</span>
                    <span className="dashboard__situacao-valor">
                      {String(dadosContadores.ativos)}
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="dashboard__situacao"
                    {...linkDaListagem({
                      ...ESTADO_INICIAL_DA_LISTAGEM,
                      aba: "em-admissao",
                    })}
                  >
                    <span className="dashboard__situacao-rotulo">
                      Em admissão
                    </span>
                    <span className="dashboard__situacao-valor">
                      {String(dadosContadores.emAdmissao)}
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    className="dashboard__situacao"
                    {...linkDaListagem({
                      ...ESTADO_INICIAL_DA_LISTAGEM,
                      aba: "desligados",
                    })}
                  >
                    <span className="dashboard__situacao-rotulo">
                      Desligadas
                    </span>
                    <span className="dashboard__situacao-valor">
                      {String(dadosContadores.desligados)}
                    </span>
                  </a>
                </li>
                <li>
                  <div className="dashboard__situacao dashboard__situacao--total">
                    <span className="dashboard__situacao-rotulo">
                      Inativas
                      <span className="dashboard__situacao-detalhe">
                        em admissão ou desligadas
                      </span>
                    </span>
                    <span className="dashboard__situacao-valor">
                      {String(dadosContadores.inativos)}
                    </span>
                  </div>
                </li>
              </ul>
              <ComoCalculamos assunto="pessoas hoje">
                <p>
                  Situação de cada pessoa hoje, pelo vínculo principal: ativa,
                  em admissão (vínculo previsto) ou desligada (vínculo
                  encerrado). Inativas soma em admissão e desligadas; não é um
                  terceiro grupo.
                </p>
              </ComoCalculamos>
            </>
          ) : contadores.tipo === "erro" ? (
            <p className="dashboard__nota">Indisponível no momento.</p>
          ) : (
            <p className="dashboard__nota" aria-hidden="true">
              Carregando…
            </p>
          )}
        </section>

        <section className="dashboard__bloco" aria-labelledby={ids.tipos}>
          <h2 id={ids.tipos} className="dashboard__subtitulo">
            Pessoas ativas por tipo de vínculo
          </h2>
          {dadosContadores ? (
            <DistribuicaoPorTipo
              contadores={dadosContadores}
              linkDaListagem={linkDaListagem}
            />
          ) : contadores.tipo === "erro" ? (
            <p className="dashboard__nota">Indisponível no momento.</p>
          ) : (
            <p className="dashboard__nota" aria-hidden="true">
              Carregando…
            </p>
          )}
        </section>
      </div>
    </>
  );

  // ---- Pessoas ------------------------------------------------------------
  const pessoas = (
    <section className="dashboard__bloco" aria-labelledby={ids.pessoas}>
      <h2 id={ids.pessoas} tabIndex={-1} className="dashboard__subtitulo">
        Pessoas ativas por tipo de vínculo
      </h2>
      {falhaDosContadores}
      {dadosContadores ? (
        <>
          <DistribuicaoPorTipo
            contadores={dadosContadores}
            linkDaListagem={linkDaListagem}
            comTabela
          />
          <ComoCalculamos assunto="tipo de vínculo">
            <p>
              Pessoas ativas hoje, pelo tipo do vínculo principal ativo. A soma
              dos tipos é o total de pessoas ativas; o percentual é a parte de
              cada tipo nesse total.
            </p>
          </ComoCalculamos>
        </>
      ) : contadores.tipo === "erro" ? null : (
        <p className="dashboard__nota" aria-hidden="true">
          Carregando…
        </p>
      )}
    </section>
  );

  // ---- Movimentação -------------------------------------------------------
  const movimentacao = (
    <section className="dashboard__bloco" aria-labelledby={ids.serie}>
      <h2 id={ids.serie} tabIndex={-1} className="dashboard__subtitulo">
        Movimentações efetivadas por mês
      </h2>
      <p className="dashboard__explicacao">
        Admissões, desligamentos, transferências e mudanças de cargo efetivadas
        em cada mês do ano escolhido. São eventos do período, contados em
        vínculos.
      </p>
      {estadoDaSerie(TIPOS_DE_MOVIMENTACAO, (porTipo) => (
        <>
          <ul className="dashboard__totais">
            {TIPOS_DE_MOVIMENTACAO.map((t) => (
              <li key={t} className="dashboard__total">
                <span
                  className={`dashboard__marca dashboard__marca--${t}`}
                  aria-hidden="true"
                />
                <span className="dashboard__total-rotulo">
                  {ROTULO_DA_MOVIMENTACAO[t]}
                </span>
                <span className="dashboard__total-valor">
                  {String(porTipo[t].reduce((a, b) => a + b, 0))}
                </span>
              </li>
            ))}
          </ul>
          <SerieMensalVisual
            periodo={periodo}
            tipos={TIPOS_DE_MOVIMENTACAO}
            porTipo={porTipo}
            quando={quando}
          />
        </>
      ))}
      {dadosSeries ? <ComoCalculamosMovimentacao /> : null}
    </section>
  );

  const paineis: Record<AbaDoDashboard, ReactNode> = {
    "visao-geral": visaoGeral,
    pessoas,
    movimentacao,
    remuneracao: (
      <EstadoIndisponivel
        titulo="Remuneração"
        texto="O Evolli não recebe folha, salários nem benefícios: a folha oficial é processada fora dele. Por isso não há custo de pessoas nem remuneração a mostrar."
      />
    ),
    "clima-e-saude": (
      <EstadoIndisponivel
        titulo="Clima e saúde"
        texto="O Evolli não tem pesquisas de clima nem dados de saúde ocupacional. Por isso não há indicador a mostrar."
      />
    ),
  };

  return (
    <section className="dashboard" aria-labelledby={DASHBOARD_TITULO_ID}>
      <header className="dashboard__cabecalho">
        {titulo}
        <p className="dashboard__contexto">
          Visão geral de {empresaAtiva.nome}: pessoas hoje e movimentações
          efetivadas no ano.
        </p>
      </header>

      {/* Um só nó de status do começo ao fim: a carga e o fim de cada leitura
          (um `span` novo por leitura, para o mesmo texto ser anunciado de
          novo numa nova leitura). */}
      <p role="status" className="dashboard__so-leitor">
        {textoDoStatus ??
          (aviso ? <span key={aviso.n}>{aviso.texto}</span> : null)}
      </p>

      <div className="dashboard__navegacao">
        <div
          role="tablist"
          aria-label="Seções do Dashboard"
          className="dashboard__abas"
        >
          {ABAS_DO_DASHBOARD.map((a) => {
            const selecionada = a === aba;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                id={idDaAba(a)}
                data-aba={a}
                aria-selected={selecionada}
                aria-controls={idDoPainel(a)}
                tabIndex={selecionada ? 0 : -1}
                className={
                  selecionada
                    ? "dashboard__aba dashboard__aba--ativa"
                    : "dashboard__aba"
                }
                onClick={() => {
                  if (!selecionada) onTrocarAba?.(a);
                }}
                onKeyDown={aoTeclarNaAba}
              >
                {ROTULO_DA_ABA[a]}
              </button>
            );
          })}
        </div>

        <div className="dashboard__barra">
          <div
            className="dashboard__periodo"
            role="group"
            aria-label="Ano consultado"
          >
            <Button
              type="button"
              variant="secondary"
              aria-disabled={ano <= ANO_MINIMO_DO_DASHBOARD}
              onClick={() => {
                if (ano > ANO_MINIMO_DO_DASHBOARD) onTrocarAno(ano - 1);
              }}
            >
              Ano anterior
            </Button>
            <label className="dashboard__ano" htmlFor={ids.seletorAno}>
              <span className="dashboard__so-leitor">Ano</span>
              <select
                id={ids.seletorAno}
                value={ano}
                onChange={(e) => onTrocarAno(Number(e.target.value))}
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a === corrente ? `${a} (até hoje)` : String(a)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              aria-disabled={ano >= corrente}
              onClick={() => {
                if (ano < corrente) onTrocarAno(ano + 1);
              }}
            >
              Próximo ano
            </Button>
          </div>
          {abaLeDados(aba) ? (
            <div className="dashboard__leitura">
              {aba !== "visao-geral" ? (
                <span className="dashboard__nota">
                  {lidoEm ? `Lido em ${lidoEm}` : "Ainda não lido"}
                </span>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                aria-disabled={lendo}
                onClick={atualizar}
              >
                {lendo ? "Atualizando…" : "Atualizar"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {ABAS_DO_DASHBOARD.map((a) => (
        <div
          key={a}
          role="tabpanel"
          id={idDoPainel(a)}
          aria-labelledby={idDaAba(a)}
          hidden={a !== aba}
          className="dashboard__painel"
        >
          {a === aba ? paineis[a] : null}
        </div>
      ))}
    </section>
  );
}

/** "Admissões e desligamentos"; "A, b, c e d" — a partir do segundo, minúsculo. */
function juntarRotulos(tipos: readonly TipoMovimentacao[]): string {
  const rotulos = tipos.map((t, i) =>
    i === 0
      ? ROTULO_DA_MOVIMENTACAO[t]
      : ROTULO_DA_MOVIMENTACAO[t].toLocaleLowerCase("pt-BR"),
  );
  if (rotulos.length <= 1) return rotulos[0] ?? "";
  return `${rotulos.slice(0, -1).join(", ")} e ${rotulos[rotulos.length - 1]}`;
}

function excedeu(series: Series): boolean {
  return TIPOS_DE_MOVIMENTACAO.some(
    (t) => series.porTipo[t].tipo === "excedida",
  );
}

function sinal(n: number): string {
  if (n > 0) return `+${String(n)}`;
  if (n < 0) return `−${String(Math.abs(n))}`;
  return "0";
}

function ComoCalculamosMovimentacao() {
  return (
    <ComoCalculamos assunto="movimentação mensal">
      <p>
        Movimentações com status efetivada e vigência no ano escolhido (até
        hoje, no ano corrente), agrupadas pelo mês da vigência. Programadas,
        solicitadas, canceladas e retificadas não contam; a retificação conta
        pela movimentação nova, quando efetivada.
      </p>
      <p>
        A contagem é em vínculos. Cada tipo é lido até {LIMITE_DA_SERIE_TEXTO}{" "}
        movimentações no ano; acima disso, o total não é exibido.
      </p>
    </ComoCalculamos>
  );
}

function DistribuicaoPorTipo({
  contadores,
  linkDaListagem,
  comTabela = false,
}: {
  readonly contadores: ContadoresColaboradoresApi;
  readonly linkDaListagem: (estado: EstadoDaListagem) => {
    href: string;
    onClick: (evento: React.MouseEvent<HTMLAnchorElement>) => void;
  };
  readonly comTabela?: boolean;
}) {
  if (contadores.ativos === 0) {
    return <p className="dashboard__vazio">Nenhuma pessoa ativa hoje.</p>;
  }
  const presentes = TIPOS.filter((t) => contadores.ativosPorTipo[t] > 0);
  const pct = (n: number) => Math.round((n / contadores.ativos) * 100);
  return (
    <>
      <div className="dashboard__barra-tipos" aria-hidden="true">
        {presentes.map((t) => (
          <span
            key={t}
            className={`dashboard__barra-tipo dashboard__barra-tipo--${t}`}
            style={{ flexGrow: contadores.ativosPorTipo[t] }}
          />
        ))}
      </div>
      <ul className="dashboard__tipos">
        {presentes.map((t) => {
          const n = contadores.ativosPorTipo[t];
          return (
            <li key={t}>
              <a
                className="dashboard__tipo"
                {...linkDaListagem({
                  ...ESTADO_INICIAL_DA_LISTAGEM,
                  aba: "ativos",
                  tipo: t,
                })}
              >
                <span
                  className={`dashboard__marca dashboard__barra-tipo--${t}`}
                  aria-hidden="true"
                />
                <span>
                  {ROTULO_TIPO[t]}: {plural(n, "pessoa", "pessoas")} ({pct(n)}%)
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {comTabela ? (
        <div className="dashboard__quadro">
          <table className="dashboard__tabela">
            <caption>Pessoas ativas hoje por tipo de vínculo</caption>
            <thead>
              <tr>
                <th scope="col">Tipo de vínculo</th>
                <th scope="col">Pessoas</th>
                <th scope="col">Percentual</th>
              </tr>
            </thead>
            <tbody>
              {TIPOS.map((t) => (
                <tr key={t}>
                  <th scope="row">{ROTULO_TIPO[t]}</th>
                  <td>{contadores.ativosPorTipo[t]}</td>
                  <td>{pct(contadores.ativosPorTipo[t])}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{contadores.ativos}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </>
  );
}

function SerieMensalVisual({
  periodo,
  tipos,
  porTipo,
  quando,
}: {
  readonly periodo: PeriodoDoDashboard;
  readonly tipos: readonly TipoMovimentacao[];
  readonly porTipo: Readonly<Record<TipoMovimentacao, number[]>>;
  readonly quando: string;
}) {
  const valor = (t: TipoMovimentacao, i: number) => porTipo[t]?.[i] ?? 0;
  const total = (t: TipoMovimentacao) =>
    (porTipo[t] ?? []).reduce((a, b) => a + b, 0);
  if (tipos.every((t) => total(t) === 0)) {
    return (
      <p className="dashboard__vazio">
        {tipos.length === 2
          ? `Nenhuma admissão ou desligamento efetivado ${quando}.`
          : `Nenhuma movimentação efetivada ${quando}.`}
      </p>
    );
  }
  const meses = Array.from({ length: periodo.meses }, (_, i) => i);
  const comSaldo = tipos.includes("admissao") && tipos.includes("desligamento");
  return (
    <>
      <GraficoMensal
        ano={periodo.ano}
        meses={periodo.meses}
        tipos={tipos}
        porTipo={porTipo}
        rotulo={`${juntarRotulos(tipos)} por mês — use as setas para percorrer os meses`}
      />
      <div className="dashboard__quadro">
        <table className="dashboard__tabela">
          <caption>
            {juntarRotulos(tipos)} de vínculos efetivados por mês, {quando}
          </caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              {tipos.map((t) => (
                <th key={t} scope="col">
                  {ROTULO_DA_MOVIMENTACAO[t]}
                </th>
              ))}
              {comSaldo ? <th scope="col">Diferença</th> : null}
            </tr>
          </thead>
          <tbody>
            {meses.map((i) => (
              <tr key={i}>
                <th scope="row">{nomeDoMes(i)}</th>
                {tipos.map((t) => (
                  <td key={t}>{valor(t, i)}</td>
                ))}
                {comSaldo ? (
                  <td>
                    {sinal(valor("admissao", i) - valor("desligamento", i))}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {tipos.map((t) => (
                <td key={t}>{total(t)}</td>
              ))}
              {comSaldo ? (
                <td>{sinal(total("admissao") - total("desligamento"))}</td>
              ) : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
