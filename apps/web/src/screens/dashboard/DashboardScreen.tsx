/**
 * T205 — Dashboard inicial: a visão do ano, só com dados reais (D-1 a D-12).
 *
 * Cinco elementos (E-1 a E-5):
 * 1. período anual consultável, com o ano na URL (o shell guarda o ano);
 * 2. resumo — pessoas ativas e em admissão hoje (`contadores` de
 *    `GET /v1/colaboradores`), admissões e desligamentos efetivados no ano
 *    (vínculos, de `GET /v1/movimentacoes`), a diferença e a frase-resumo;
 * 3. pessoas ativas por tipo de vínculo;
 * 4. admissões e desligamentos efetivados por mês (barras em CSS, ocultas ao
 *    leitor de tela, e a tabela equivalente como leitura principal);
 * 5. momento da leitura e "Atualizar" (sem atualização automática).
 *
 * Só os indicadores de pessoas ativas, em admissão e cada tipo levam a algum
 * lugar: a listagem de Colaboradores já filtrada (a aba e o tipo que ela
 * aceita). Admissões e desligamentos não têm destino: não existe listagem por
 * período (D-5).
 *
 * Sem empresa ativa (`master_tecnico` global), nada é consultado: a tela só
 * orienta a escolher a empresa (D-6). Com ela, o servidor restringe tudo à
 * empresa da sessão. Nenhum endpoint novo, nenhuma biblioteca nova, nenhum
 * número de exemplo.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components";
import {
  listarColaboradores,
  type ContadoresColaboradoresApi,
  type TipoVinculo,
} from "../../api/colaboradoresClient";
import { listarMovimentacoes } from "../../api/movimentacaoClient";
import { formatarInstante } from "../../format/data";
import {
  ANO_MINIMO_DO_DASHBOARD,
  ESTADO_INICIAL_DA_LISTAGEM,
  anoCorrente,
  rotaDaListagem,
  type EstadoDaListagem,
} from "../../app/rotasDoShell";
import {
  fraseResumo,
  lerSerieMensal,
  mesAbreviado,
  nomeDoMes,
  periodoDoAno,
  plural,
  type PeriodoDoDashboard,
  type SerieMensal,
} from "./dashboardDados";
import "./DashboardScreen.css";

export const DASHBOARD_TITULO_ID = "dashboard-titulo";

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
  readonly admissoes: SerieMensal;
  readonly desligamentos: SerieMensal;
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
  /** A empresa ativa da sessão; `null` = sem empresa (nada é consultado). */
  readonly empresaAtiva: { readonly nome: string } | null;
  /** Outro ano: o shell troca a URL (uma entrada nova no histórico). */
  readonly onTrocarAno: (ano: number) => void;
  /** Um indicador clicado: a listagem de Colaboradores com este estado. */
  readonly onAbrirListagem: (estado: EstadoDaListagem) => void;
}

export function DashboardScreen({
  ano,
  empresaAtiva,
  onTrocarAno,
  onAbrirListagem,
}: DashboardScreenProps) {
  const prefixo = useId();
  const ids = {
    pessoas: `${prefixo}-pessoas`,
    serie: `${prefixo}-serie`,
    tipos: `${prefixo}-tipos`,
    seletorAno: `${prefixo}-ano`,
  };
  const temEmpresa = empresaAtiva !== null;

  const [contadores, setContadores] = useState<
    Parte<ContadoresColaboradoresApi>
  >({ tipo: "carregando" });
  const [series, setSeries] = useState<Parte<Series>>({ tipo: "carregando" });
  const [lendo, setLendo] = useState(temEmpresa);
  /** O anúncio da última leitura concluída (um `span` novo por leitura). */
  const [aviso, setAviso] = useState<{
    readonly texto: string;
    readonly n: number;
  } | null>(null);
  const [lidoEm, setLidoEm] = useState<string | null>(null);

  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /** Só a leitura mais recente de cada parte vale. */
  const geracaoRef = useRef({ leitura: 0, contadores: 0, series: 0 });
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
        const [admissoes, desligamentos] = await Promise.all([
          lerSerieMensal("admissao", periodo, listarMovimentacoes, vale),
          lerSerieMensal("desligamento", periodo, listarMovimentacoes, vale),
        ]);
        if (!vivaRef.current || geracao !== geracaoRef.current.series) {
          return null;
        }
        const dados = { periodo, admissoes, desligamentos };
        setSeries({ tipo: "dados", dados });
        return dados;
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current.series) {
          return null;
        }
        setSeries(proximaFalha);
        return null;
      }
    },
    [],
  );

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
      const [okContadores, dadosSeries] = await Promise.all([
        lerContadores(),
        lerSeries(anoLido),
      ]);
      if (!vivaRef.current || geracao !== geracaoRef.current.leitura) return;
      setLendo(false);
      if (okContadores || dadosSeries) {
        concluir(
          `Dashboard de ${anoLido} lido em {instante}.${
            dadosSeries && excedeu(dadosSeries)
              ? " As admissões ou os desligamentos do ano passam do limite desta visão."
              : ""
          }`,
        );
      }
    },
    [lerContadores, lerSeries, concluir],
  );

  // Leitura na entrada e a cada ano; sem empresa ativa, nenhuma.
  useEffect(() => {
    if (!temEmpresa) return;
    void lerTudo(ano);
  }, [temEmpresa, ano, lerTudo]);

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
      concluir(`Admissões e desligamentos de ${ano} lidos em {instante}.`);
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
  const periodo = periodoDoAno(ano);
  const quando = periodo.ateHoje ? `em ${ano}, até hoje` : `em ${ano}`;

  const dadosContadores = contadores.tipo === "dados" ? contadores.dados : null;
  const dadosSeries = series.tipo === "dados" ? series.dados : null;
  const admissoes =
    dadosSeries?.admissoes.tipo === "completa" ? dadosSeries.admissoes : null;
  const desligamentos =
    dadosSeries?.desligamentos.tipo === "completa"
      ? dadosSeries.desligamentos
      : null;
  const serieCompleta = admissoes !== null && desligamentos !== null;
  const serieExcedida =
    dadosSeries !== null &&
    (dadosSeries.admissoes.tipo === "excedida" ||
      dadosSeries.desligamentos.tipo === "excedida");

  const textoDoStatus = lendo ? `Carregando o Dashboard de ${ano}…` : null;

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
        <div className="dashboard__leitura">
          <span className="dashboard__nota">
            {lidoEm ? `Lido em ${lidoEm}` : "Ainda não lido"}
          </span>
          <Button
            type="button"
            variant="secondary"
            aria-disabled={lendo}
            onClick={atualizar}
          >
            {lendo ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </div>

      {/* E-2 — resumo ------------------------------------------------------ */}
      <section className="dashboard__bloco" aria-labelledby={ids.pessoas}>
        <h2 id={ids.pessoas} tabIndex={-1} className="dashboard__subtitulo">
          Resumo
        </h2>
        {dadosContadores && serieCompleta ? (
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
        {contadores.tipo === "erro" ? (
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
              <span className="dashboard__so-leitor">
                {" "}
                os totais de pessoas
              </span>
            </Button>
          </div>
        ) : null}
        <ul className="dashboard__cartoes">
          {dadosContadores ? (
            <>
              <li>
                <a
                  className="dashboard__cartao dashboard__cartao--link"
                  {...linkDaListagem({
                    ...ESTADO_INICIAL_DA_LISTAGEM,
                    aba: "ativos",
                  })}
                >
                  <span className="dashboard__cartao-rotulo">
                    Pessoas ativas hoje
                  </span>
                  <span className="dashboard__cartao-valor">
                    {String(dadosContadores.ativos)}
                  </span>
                  <span className="dashboard__cartao-nota">
                    Abrir na listagem de Colaboradores
                  </span>
                </a>
              </li>
              <li>
                <a
                  className="dashboard__cartao dashboard__cartao--link"
                  {...linkDaListagem({
                    ...ESTADO_INICIAL_DA_LISTAGEM,
                    aba: "em-admissao",
                  })}
                >
                  <span className="dashboard__cartao-rotulo">
                    Pessoas em admissão hoje
                  </span>
                  <span className="dashboard__cartao-valor">
                    {String(dadosContadores.emAdmissao)}
                  </span>
                  <span className="dashboard__cartao-nota">
                    Abrir na listagem de Colaboradores
                  </span>
                </a>
              </li>
            </>
          ) : null}
          {admissoes && desligamentos ? (
            <>
              <li>
                <div className="dashboard__cartao">
                  <span className="dashboard__cartao-rotulo">
                    Admissões efetivadas
                  </span>
                  <span className="dashboard__cartao-valor">
                    {String(admissoes.total)}
                  </span>
                  <span className="dashboard__cartao-nota">
                    Vínculos, {quando}
                  </span>
                </div>
              </li>
              <li>
                <div className="dashboard__cartao">
                  <span className="dashboard__cartao-rotulo">
                    Desligamentos efetivados
                  </span>
                  <span className="dashboard__cartao-valor">
                    {String(desligamentos.total)}
                  </span>
                  <span className="dashboard__cartao-nota">
                    Vínculos, {quando}
                  </span>
                </div>
              </li>
              <li>
                <div className="dashboard__cartao">
                  <span className="dashboard__cartao-rotulo">Diferença</span>
                  <span className="dashboard__cartao-valor">
                    {sinal(admissoes.total - desligamentos.total)}
                  </span>
                  <span className="dashboard__cartao-nota">
                    Admissões menos desligamentos de vínculos
                  </span>
                </div>
              </li>
            </>
          ) : null}
        </ul>
      </section>

      {/* E-3 — ativos por tipo ----------------------------------------------- */}
      {dadosContadores ? (
        <section className="dashboard__bloco" aria-labelledby={ids.tipos}>
          <h2 id={ids.tipos} className="dashboard__subtitulo">
            Pessoas ativas por tipo de vínculo
          </h2>
          {dadosContadores.ativos === 0 ? (
            <p className="dashboard__vazio">Nenhuma pessoa ativa hoje.</p>
          ) : (
            <>
              <div className="dashboard__barra-tipos" aria-hidden="true">
                {TIPOS.filter((t) => dadosContadores.ativosPorTipo[t] > 0).map(
                  (t) => (
                    <span
                      key={t}
                      className={`dashboard__barra-tipo dashboard__barra-tipo--${t}`}
                      style={{ flexGrow: dadosContadores.ativosPorTipo[t] }}
                    />
                  ),
                )}
              </div>
              <ul className="dashboard__tipos">
                {TIPOS.filter((t) => dadosContadores.ativosPorTipo[t] > 0).map(
                  (t) => {
                    const n = dadosContadores.ativosPorTipo[t];
                    const pct = Math.round((n / dadosContadores.ativos) * 100);
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
                            {ROTULO_TIPO[t]}: {plural(n, "pessoa", "pessoas")} (
                            {pct}%)
                          </span>
                        </a>
                      </li>
                    );
                  },
                )}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {/* E-4 — admissões e desligamentos por mês ----------------------------- */}
      <section className="dashboard__bloco" aria-labelledby={ids.serie}>
        <h2 id={ids.serie} tabIndex={-1} className="dashboard__subtitulo">
          Admissões e desligamentos efetivados por mês
        </h2>
        {series.tipo === "erro" ? (
          <div className="dashboard__falha">
            <p key={series.falhas} role="alert">
              Não foi possível carregar as admissões e os desligamentos de {ano}
              .
            </p>
            <Button
              type="button"
              variant="secondary"
              aria-disabled={series.relendo}
              onClick={() => void novaTentativaDaSerie()}
            >
              Tentar de novo
              <span className="dashboard__so-leitor">
                {" "}
                as admissões e os desligamentos
              </span>
            </Button>
          </div>
        ) : series.tipo === "carregando" ? (
          <p className="dashboard__nota" aria-hidden="true">
            Carregando…
          </p>
        ) : serieExcedida ? (
          <p className="dashboard__aviso">
            As admissões ou os desligamentos efetivados {quando} passam de 2.000
            vínculos, o limite desta visão. Os números não são exibidos para não
            mostrar um total incompleto.
          </p>
        ) : admissoes && desligamentos ? (
          admissoes.total === 0 && desligamentos.total === 0 ? (
            <p className="dashboard__vazio">
              Nenhuma admissão ou desligamento efetivado {quando}.
            </p>
          ) : (
            <SerieMensalVisual
              periodo={periodo}
              admissoes={admissoes.porMes}
              desligamentos={desligamentos.porMes}
              quando={quando}
            />
          )
        ) : null}
      </section>
    </section>
  );
}

function excedeu(series: Series): boolean {
  return (
    series.admissoes.tipo === "excedida" ||
    series.desligamentos.tipo === "excedida"
  );
}

function sinal(n: number): string {
  if (n > 0) return `+${String(n)}`;
  if (n < 0) return `−${String(Math.abs(n))}`;
  return "0";
}

function SerieMensalVisual({
  periodo,
  admissoes,
  desligamentos,
  quando,
}: {
  readonly periodo: PeriodoDoDashboard;
  readonly admissoes: readonly number[];
  readonly desligamentos: readonly number[];
  readonly quando: string;
}) {
  const maximo = Math.max(1, ...admissoes, ...desligamentos);
  const meses = Array.from({ length: periodo.meses }, (_, i) => i);
  const totalA = admissoes.reduce((a, b) => a + b, 0);
  const totalD = desligamentos.reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="dashboard__grafico" aria-hidden="true">
        <div className="dashboard__legenda">
          <span>
            <span className="dashboard__marca dashboard__marca--admissao" />
            Admissões
          </span>
          <span>
            <span className="dashboard__marca dashboard__marca--desligamento" />
            Desligamentos
          </span>
        </div>
        <div className="dashboard__colunas">
          {meses.map((i) => (
            <div key={i} className="dashboard__coluna">
              <div className="dashboard__barras">
                <span
                  className="dashboard__barra-mes dashboard__barra-mes--admissao"
                  style={{ height: `${((admissoes[i] ?? 0) / maximo) * 100}%` }}
                />
                <span
                  className="dashboard__barra-mes dashboard__barra-mes--desligamento"
                  style={{
                    height: `${((desligamentos[i] ?? 0) / maximo) * 100}%`,
                  }}
                />
              </div>
              <span className="dashboard__mes">{mesAbreviado(i)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="dashboard__quadro">
        <table className="dashboard__tabela">
          <caption>
            Admissões e desligamentos de vínculos efetivados por mês, {quando}
          </caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Admissões</th>
              <th scope="col">Desligamentos</th>
              <th scope="col">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((i) => (
              <tr key={i}>
                <th scope="row">{nomeDoMes(i)}</th>
                <td>{admissoes[i] ?? 0}</td>
                <td>{desligamentos[i] ?? 0}</td>
                <td>{sinal((admissoes[i] ?? 0) - (desligamentos[i] ?? 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{totalA}</td>
              <td>{totalD}</td>
              <td>{sinal(totalA - totalD)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
