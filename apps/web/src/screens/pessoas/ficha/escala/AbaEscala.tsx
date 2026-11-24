/**
 * T215 — aba Escala da ficha do colaborador.
 *
 * - **Escala atual:** a jornada que vale hoje, com carga semanal, dias de
 *   trabalho, horário, intervalo e vigência; a programada, quando houver.
 * - **Semana de trabalho:** os 7 dias, com os períodos de cada um ou folga.
 * - **Histórico de escalas:** todas as vigências, da mais nova à mais antiga,
 *   com a situação (vigente, programada, encerrada) e a jornada inativada.
 *
 * RH e DP (`podeOperar`) definem, alteram e encerram a escala, sempre com a
 * data de vigência; os demais só leem. A jornada em si (dias e horários) é
 * criada e ajustada em Jornadas de trabalho — a aba leva até lá.
 *
 * Definir e alterar são a mesma operação no servidor: com escala aberta, ele
 * a encerra no novo início e cria a nova, numa transação; sobreposição de
 * vigências é recusada (409) e aparece no campo da data.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ApiError,
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../../../api/horariosClient";
import {
  atribuirJornada,
  encerrarVinculoHorario,
  listarVinculosHorario,
  type AtribuirJornadaDto,
  type EncerrarVinculoHorarioDto,
  type VinculoHorarioApi,
} from "../../../../api/vinculoHorarioClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../../../api/csrfClient";
import { Button, FormActions } from "../../../../components";
import { Sheet } from "../../../../ui";
import { IconeCalendario, IconeRelogio } from "../../../../ui/icones";
import {
  AvisoAnimado,
  Esqueleto,
  Revelar,
  ehAvisoDeFalha,
} from "../../../../ui/movimento";
import { formatarDiaCivil } from "../../../../format/data";
import {
  type SituacaoDaVigencia,
  diaAnteriorCivil,
  diaDeHoje,
  jornadaDeHoje,
  mensagemDoCampo,
  proximoDiaCivil,
  rotuloDaJornada,
  situacaoDaVigencia,
  ultimoDiaDaVigencia,
  vigenciaAberta,
} from "../../jornadaColaborador";
import {
  type PeriodoDaGrade,
  cargaSemanal,
  formatarDuracao,
  gradeDaSemana,
  horarioTipico,
  intervaloTipico,
  resumoDosDias,
} from "./resumoDaEscala";
import "./AbaEscala.css";

/** As operações da aba (o servidor, ou um dublê nos testes). */
export interface ServicoDeEscala {
  historico(colaboradorId: string): Promise<VinculoHorarioApi[]>;
  jornadas(): Promise<TabelaHorarioApi[]>;
  atribuir(dto: AtribuirJornadaDto): Promise<unknown>;
  encerrar(vinculoId: string, dto: EncerrarVinculoHorarioDto): Promise<unknown>;
}

export const servicoDeEscalaDoServidor: ServicoDeEscala = {
  historico: async (colaboradorId) =>
    (await listarVinculosHorario({ colaboradorId, tamanhoPagina: 100 })).itens,
  jornadas: async () =>
    (await listarTabelasHorario({ ativo: true, tamanhoPagina: 100 })).itens,
  atribuir: atribuirJornada,
  encerrar: encerrarVinculoHorario,
};

interface Props {
  readonly colaboradorId: string;
  /** "da Ana", "do João" — o trato da ficha. */
  readonly doNome: string;
  /** Data de admissão (`AAAA-MM-DD`): a escala não começa antes dela. */
  readonly dataAdmissao?: string | null;
  /** RH e DP: definir, alterar e encerrar. */
  readonly podeOperar: boolean;
  /** Abre Jornadas de trabalho (criar ou ajustar a jornada). */
  readonly onAbrirJornadas?: () => void;
  /** Dia civil de hoje (testes). */
  readonly hoje?: string;
  readonly servico?: ServicoDeEscala;
}

const VAZIO = "—";

const ROTULO_SITUACAO: Record<SituacaoDaVigencia, string> = {
  vigente: "Vigente",
  programada: "Programada",
  encerrada: "Encerrada",
};

type Carga =
  | { estado: "carregando" }
  | { estado: "erro" }
  | {
      estado: "pronto";
      historico: VinculoHorarioApi[];
      catalogo: TabelaHorarioApi[] | "erro";
    };

type Gaveta = { modo: "definir" | "alterar" } | { modo: "encerrar" } | null;

function grade(v: { tabela: { periodos?: PeriodoDaGrade[] } }) {
  return v.tabela.periodos ?? [];
}

export function AbaEscala({
  colaboradorId,
  doNome,
  dataAdmissao = null,
  podeOperar,
  onAbrirJornadas,
  hoje = diaDeHoje(),
  servico = servicoDeEscalaDoServidor,
}: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [aviso, setAviso] = useState("");
  // Depois de gravar, o foco vai ao título do cartão (o botão que abriu a
  // gaveta pode ter mudado: “Encerrar” vira “Definir”).
  const idTitulo = useId();
  const focarTitulo = useRef(false);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarga({ estado: "carregando" });
      try {
        const [historico, catalogo] = await Promise.all([
          servico.historico(colaboradorId),
          // Só quem opera escolhe jornada: o catálogo só é lido aí.
          podeOperar
            ? servico.jornadas().catch(() => "erro" as const)
            : Promise.resolve([]),
        ]);
        setCarga({ estado: "pronto", historico, catalogo });
      } catch {
        setCarga({ estado: "erro" });
      }
    },
    [colaboradorId, podeOperar, servico],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!focarTitulo.current || carga.estado !== "pronto") return;
    focarTitulo.current = false;
    document.getElementById(idTitulo)?.focus();
  }, [carga, idTitulo]);

  if (carga.estado === "carregando") {
    return <Esqueleto rotulo="Carregando escala…" linhas={4} />;
  }
  if (carga.estado === "erro") {
    return (
      <div className="escala-ficha__aviso" role="alert">
        <p>Não foi possível carregar a escala.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void carregar()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const { historico, catalogo } = carga;
  const atual = jornadaDeHoje(historico, hoje);
  const aberta = vigenciaAberta(historico);
  const programada =
    historico.find((v) => situacaoDaVigencia(v, hoje) === "programada") ?? null;
  const daSemana = atual ?? programada;

  const verJornadas = onAbrirJornadas ? (
    <Button type="button" variant="secondary" onClick={onAbrirJornadas}>
      Ver jornadas de trabalho
    </Button>
  ) : null;

  const acoes = podeOperar ? (
    aberta ? (
      <>
        <Button type="button" onClick={() => setGaveta({ modo: "alterar" })}>
          Alterar escala
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setGaveta({ modo: "encerrar" })}
        >
          Encerrar escala
        </Button>
      </>
    ) : (
      <Button type="button" onClick={() => setGaveta({ modo: "definir" })}>
        Definir escala
      </Button>
    )
  ) : null;

  return (
    <Revelar>
      <div className="escala-ficha">
        {historico.length === 0 ? (
          <section className="ficha-ref__cartao escala-ficha__vazio">
            <span className="ficha-ref__cartao-icone" aria-hidden="true">
              <IconeRelogio tamanho={18} />
            </span>
            <h3
              id={idTitulo}
              tabIndex={-1}
              className="escala-ficha__vazio-titulo"
            >
              Escala ainda não definida
            </h3>
            <p className="escala-ficha__vazio-texto">
              {`Defina a jornada ${doNome} e a data em que ela passa a valer. Para criar ou ajustar uma jornada, use Jornadas de trabalho.`}
            </p>
            <div className="escala-ficha__acoes">
              {verJornadas}
              {acoes}
            </div>
          </section>
        ) : (
          <>
            <EscalaAtual
              idTitulo={idTitulo}
              atual={atual}
              programada={programada}
              historico={historico}
              hoje={hoje}
              acoes={
                acoes || verJornadas ? (
                  <div className="escala-ficha__acoes">
                    {acoes}
                    {verJornadas}
                  </div>
                ) : null
              }
            />
            {daSemana ? <Semana vinculo={daSemana} /> : null}
            <Historico historico={historico} hoje={hoje} />
          </>
        )}

        {!podeOperar ? (
          <p className="escala-ficha__nota">
            Somente consulta: RH e DP definem, alteram e encerram a escala.
          </p>
        ) : null}

        <AvisoAnimado
          className="escala-ficha__status"
          mensagem={aviso}
          tipo={ehAvisoDeFalha(aviso) ? "neutro" : "sucesso"}
        />

        {gaveta && gaveta.modo !== "encerrar" ? (
          <GavetaDaEscala
            modo={gaveta.modo}
            colaboradorId={colaboradorId}
            aberta={aberta}
            historico={historico}
            catalogo={catalogo}
            dataAdmissao={dataAdmissao}
            hoje={hoje}
            servico={servico}
            {...(onAbrirJornadas ? { onAbrirJornadas } : {})}
            onFechar={() => setGaveta(null)}
            onGravado={(mensagem) => {
              focarTitulo.current = true;
              setGaveta(null);
              setAviso(mensagem);
              void carregar(true);
            }}
          />
        ) : null}
        {gaveta?.modo === "encerrar" && aberta ? (
          <GavetaDeEncerramento
            vinculo={aberta}
            servico={servico}
            onFechar={() => setGaveta(null)}
            onGravado={(mensagem) => {
              focarTitulo.current = true;
              setGaveta(null);
              setAviso(mensagem);
              void carregar(true);
            }}
          />
        ) : null}
      </div>
    </Revelar>
  );
}

// ------------------------------------------------------------ Escala atual

function EscalaAtual({
  idTitulo,
  atual,
  programada,
  historico,
  hoje,
  acoes,
}: {
  readonly idTitulo: string;
  readonly atual: VinculoHorarioApi | null;
  readonly programada: VinculoHorarioApi | null;
  readonly historico: VinculoHorarioApi[];
  readonly hoje: string;
  readonly acoes: ReactNode;
}) {
  const ultimaEncerrada = historico.find(
    (v) => situacaoDaVigencia(v, hoje) === "encerrada",
  );
  return (
    <section
      className="ficha-ref__cartao escala-ficha__atual"
      aria-labelledby={idTitulo}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          <IconeRelogio tamanho={18} />
        </span>
        <h3 id={idTitulo} tabIndex={-1} className="escala-ficha__titulo">
          Escala atual
        </h3>
      </header>
      <div className="escala-ficha__corpo">
        {atual ? (
          <>
            <p className="escala-ficha__jornada">
              <strong>{rotuloDaJornada(atual.tabela)}</strong>
              <span className="escala-ficha__selo escala-ficha__selo--vigente">
                Vigente
              </span>
              {atual.tabela.ativo ? null : (
                <span className="escala-ficha__selo escala-ficha__selo--alerta">
                  Jornada inativa
                </span>
              )}
            </p>
            <Metricas vinculo={atual} />
          </>
        ) : (
          <p className="escala-ficha__sem-vigente">
            {ultimaEncerrada && !programada
              ? `Sem escala vigente hoje. A última terminou em ${formatarDiaCivil(ultimoDiaDaVigencia(ultimaEncerrada) ?? ultimaEncerrada.vigenciaInicio)}.`
              : "Sem escala vigente hoje."}
          </p>
        )}
        {programada ? (
          <p className="escala-ficha__programada">
            <IconeCalendario tamanho={16} />
            <span>
              {`A partir de ${formatarDiaCivil(programada.vigenciaInicio)}, ${rotuloDaJornada(programada.tabela)}`}
              {grade(programada).length > 0
                ? ` · ${formatarDuracao(cargaSemanal(grade(programada)))} por semana.`
                : "."}
            </span>
          </p>
        ) : null}
        {acoes}
      </div>
    </section>
  );
}

function Metricas({ vinculo }: { readonly vinculo: VinculoHorarioApi }) {
  const periodos = grade(vinculo);
  const ultimo = ultimoDiaDaVigencia(vinculo);
  const itens: [string, string][] = [
    [
      "Carga semanal",
      periodos.length > 0 ? formatarDuracao(cargaSemanal(periodos)) : VAZIO,
    ],
    ["Dias de trabalho", periodos.length > 0 ? resumoDosDias(periodos) : VAZIO],
    ["Horário", horarioTipico(periodos) ?? VAZIO],
    ["Intervalo", intervaloTipico(periodos) ?? VAZIO],
    ["Vale desde", formatarDiaCivil(vinculo.vigenciaInicio)],
    ["Termina em", ultimo ? formatarDiaCivil(ultimo) : "Sem término"],
  ];
  return (
    <dl className="escala-ficha__metricas">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="escala-ficha__metrica">
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// ----------------------------------------------------------------- Semana

function Semana({ vinculo }: { readonly vinculo: VinculoHorarioApi }) {
  const id = useId();
  const dias = gradeDaSemana(grade(vinculo));
  return (
    <section
      className="ficha-ref__cartao escala-ficha__semana-cartao"
      aria-labelledby={`${id}-titulo`}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          <IconeCalendario tamanho={18} />
        </span>
        <h3 id={`${id}-titulo`} className="escala-ficha__titulo">
          Semana de trabalho
        </h3>
      </header>
      <ul className="escala-ficha__semana" aria-label="Semana de trabalho">
        {dias.map((d) => (
          <li
            key={d.dia}
            className={`escala-ficha__dia${d.minutos === 0 ? " escala-ficha__dia--folga" : ""}`}
          >
            <span className="escala-ficha__dia-nome">
              <abbr title={d.nome}>{d.curto}</abbr>
            </span>
            {d.minutos === 0 ? (
              <span className="escala-ficha__dia-folga">Folga</span>
            ) : (
              <>
                <span className="escala-ficha__dia-periodos">
                  {d.periodos.map((p) => (
                    <span key={p.inicio}>{`${p.inicio}–${p.fim}`}</span>
                  ))}
                </span>
                <span className="escala-ficha__dia-total">
                  {formatarDuracao(d.minutos)}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// -------------------------------------------------------------- Histórico

function Historico({
  historico,
  hoje,
}: {
  readonly historico: VinculoHorarioApi[];
  readonly hoje: string;
}) {
  const id = useId();
  const ordenado = [...historico].sort((a, b) =>
    b.vigenciaInicio.localeCompare(a.vigenciaInicio),
  );
  return (
    <section
      className="ficha-ref__cartao escala-ficha__historico"
      aria-labelledby={`${id}-titulo`}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          <IconeCalendario tamanho={18} />
        </span>
        <h3 id={`${id}-titulo`} className="escala-ficha__titulo">
          Histórico de escalas
        </h3>
      </header>
      <ol className="escala-ficha__linhas" aria-label="Histórico de escalas">
        {ordenado.map((v) => {
          const situacao = situacaoDaVigencia(v, hoje);
          const ultimo = ultimoDiaDaVigencia(v);
          const periodos = grade(v);
          return (
            <li
              key={v.id}
              className={`escala-ficha__linha escala-ficha__linha--${situacao}`}
            >
              <span className="escala-ficha__marca" aria-hidden="true" />
              <div className="escala-ficha__linha-corpo">
                <p className="escala-ficha__linha-titulo">
                  <strong>{rotuloDaJornada(v.tabela)}</strong>
                  <span
                    className={`escala-ficha__selo escala-ficha__selo--${situacao}`}
                  >
                    {ROTULO_SITUACAO[situacao]}
                  </span>
                  {v.tabela.ativo ? null : (
                    <span className="escala-ficha__selo escala-ficha__selo--alerta">
                      Jornada inativa
                    </span>
                  )}
                </p>
                <p className="escala-ficha__linha-detalhe">
                  {ultimo
                    ? `${formatarDiaCivil(v.vigenciaInicio)} a ${formatarDiaCivil(ultimo)}`
                    : `Desde ${formatarDiaCivil(v.vigenciaInicio)}`}
                  {periodos.length > 0
                    ? ` · ${formatarDuracao(cargaSemanal(periodos))} por semana`
                    : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- Gavetas

type CampoDaGaveta = "tabelaHorarioId" | "vigenciaInicio" | "vigenciaFim";
type Erros = Partial<Record<CampoDaGaveta | "geral", string>>;

/** Os erros sem o do campo editado agora. */
function semErro(erros: Erros, campo: CampoDaGaveta): Erros {
  const resto = { ...erros };
  delete resto[campo];
  return resto;
}

/** A recusa de uma gravação, pelo que o contrato produz. */
function errosDaRecusa(erro: unknown, campoDaData: CampoDaGaveta): Erros {
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      geral:
        "Esta página ficou desatualizada, e nada foi salvo. Tente de novo; seus dados foram mantidos.",
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      geral:
        "Sua sessão expirou, e nada foi salvo. Entre de novo para continuar.",
    };
  }
  if (falhaAoPrepararEnvio(erro)) {
    return {
      geral:
        "Não foi possível preparar o envio, e nada foi salvo. Confira a conexão e tente de novo.",
    };
  }
  if (erro instanceof ApiError) {
    const porCampo: Erros = {};
    for (const { campo, motivo } of erro.erros ?? []) {
      if (campo === "vigenciaInicio" && motivo === "antes_da_admissao") {
        porCampo.vigenciaInicio =
          "A escala não pode começar antes da admissão.";
        continue;
      }
      const traduzido = mensagemDoCampo(campo, motivo);
      if (traduzido) porCampo[traduzido.campo] = traduzido.mensagem;
    }
    if (Object.keys(porCampo).length > 0) return porCampo;
    if (erro.status === 400)
      return { [campoDaData]: "Informe uma data válida." };
    if (erro.status === 403) {
      return {
        geral:
          "Seu perfil não tem permissão para alterar a escala. Nada foi salvo.",
      };
    }
    if (erro.status === 404) {
      return {
        geral:
          "Colaborador ou jornada não encontrados na empresa ativa. Nada foi salvo.",
      };
    }
    if (erro.status === 409 || erro.status === 422) {
      return {
        geral: "A alteração foi recusada. Atualize a aba e tente de novo.",
      };
    }
  }
  return {
    geral:
      "Não foi possível confirmar se a alteração foi salva. Atualize a aba para conferir antes de tentar de novo.",
  };
}

function Erro({
  id,
  texto,
}: {
  readonly id: string;
  readonly texto: string | undefined;
}) {
  return texto ? (
    <span id={id} className="escala-ficha__erro">
      {texto}
    </span>
  ) : null;
}

function GavetaDaEscala({
  modo,
  colaboradorId,
  aberta,
  historico,
  catalogo,
  dataAdmissao,
  hoje,
  servico,
  onAbrirJornadas,
  onFechar,
  onGravado,
}: {
  readonly modo: "definir" | "alterar";
  readonly colaboradorId: string;
  readonly aberta: VinculoHorarioApi | null;
  readonly historico: VinculoHorarioApi[];
  readonly catalogo: TabelaHorarioApi[] | "erro";
  readonly dataAdmissao: string | null;
  readonly hoje: string;
  readonly servico: ServicoDeEscala;
  readonly onAbrirJornadas?: () => void;
  readonly onFechar: () => void;
  readonly onGravado: (mensagem: string) => void;
}) {
  const base = useId();
  const idJornada = `${base}-jornada`;
  const idData = `${base}-data`;
  // O primeiro dia sem escala depois das já encerradas: antes dele, a nova
  // cruzaria uma vigência (o servidor recusaria com 409).
  const livre = historico.reduce<string | null>(
    (maior, v) =>
      v.vigenciaFim !== null && (maior === null || v.vigenciaFim > maior)
        ? v.vigenciaFim
        : maior,
    null,
  );
  const inicial = [hoje, dataAdmissao, livre].reduce<string>(
    (maior, d) => (d !== null && d > maior ? d : maior),
    hoje,
  );
  const [jornadaId, setJornadaId] = useState("");
  const [data, setData] = useState(inicial);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const focoRef = useRef<string | null>(null);

  useEffect(() => {
    const alvo = focoRef.current;
    if (alvo === null) return;
    focoRef.current = null;
    document.getElementById(alvo)?.focus();
  });

  const titulo = modo === "alterar" ? "Alterar escala" : "Definir escala";
  const opcoes =
    catalogo === "erro"
      ? []
      : catalogo.filter(
          (j) => modo !== "alterar" || j.id !== aberta?.tabelaHorarioId,
        );
  const escolhida = opcoes.find((j) => j.id === jornadaId) ?? null;
  const alterado = jornadaId !== "" || data !== inicial;

  function focarPrimeiro(e: Erros) {
    focoRef.current = e.tabelaHorarioId
      ? idJornada
      : e.vigenciaInicio
        ? idData
        : e.geral
          ? `${base}-geral`
          : null;
  }

  async function gravar(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando) return;
    const locais: Erros = {};
    if (!jornadaId) locais.tabelaHorarioId = "Escolha a jornada.";
    if (!data) {
      locais.vigenciaInicio = "Informe a data em que a escala passa a valer.";
    } else if (dataAdmissao !== null && data < dataAdmissao) {
      locais.vigenciaInicio = `A escala não pode começar antes da admissão (${formatarDiaCivil(dataAdmissao)}).`;
    } else if (livre !== null && data < livre) {
      locais.vigenciaInicio = `Já existe escala até ${formatarDiaCivil(diaAnteriorCivil(livre))}. A nova precisa começar a partir de ${formatarDiaCivil(livre)}.`;
    } else if (modo === "alterar" && aberta && data <= aberta.vigenciaInicio) {
      locais.vigenciaInicio = `A nova escala precisa começar depois de ${formatarDiaCivil(aberta.vigenciaInicio)}, início da atual.`;
    }
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      focarPrimeiro(locais);
      return;
    }
    setEnviando(true);
    setErros({});
    try {
      await servico.atribuir({
        colaboradorId,
        tabelaHorarioId: jornadaId,
        vigenciaInicio: data,
      });
      onGravado(
        modo === "alterar"
          ? `Escala alterada a partir de ${formatarDiaCivil(data)}. A anterior fica no histórico.`
          : `Escala definida a partir de ${formatarDiaCivil(data)}.`,
      );
    } catch (erro) {
      const recusa = errosDaRecusa(erro, "vigenciaInicio");
      setErros(recusa);
      focarPrimeiro(recusa);
    } finally {
      setEnviando(false);
    }
  }

  const antes = modo === "alterar" ? aberta : null;
  const linhasDoQueMuda: [string, string, string][] = escolhida
    ? [
        [
          "Jornada",
          antes ? rotuloDaJornada(antes.tabela) : VAZIO,
          rotuloDaJornada(escolhida),
        ],
        [
          "Carga semanal",
          antes ? formatarDuracao(cargaSemanal(grade(antes))) : VAZIO,
          formatarDuracao(cargaSemanal(escolhida.periodos)),
        ],
        [
          "Dias de trabalho",
          antes ? resumoDosDias(grade(antes)) : VAZIO,
          resumoDosDias(escolhida.periodos),
        ],
        [
          "Horário",
          antes ? (horarioTipico(grade(antes)) ?? VAZIO) : VAZIO,
          horarioTipico(escolhida.periodos) ?? VAZIO,
        ],
      ]
    : [];

  return (
    <Sheet
      aberto
      titulo={titulo}
      descricao="Escolha a jornada e a data em que ela passa a valer. A escala anterior termina no dia anterior e continua no histórico."
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      className="escala-gaveta"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={enviando}
            onClick={() => void gravar()}
          >
            {enviando ? "Salvando…" : "Salvar escala"}
          </Button>
        </FormActions>
      }
    >
      <form
        className="escala-gaveta__campos"
        noValidate
        onSubmit={(e) => void gravar(e)}
      >
        <div className="escala-gaveta__campo">
          <label htmlFor={idJornada}>
            {modo === "alterar" ? "Nova jornada" : "Jornada"}
          </label>
          <select
            id={idJornada}
            value={jornadaId}
            disabled={enviando}
            aria-invalid={erros.tabelaHorarioId ? "true" : undefined}
            aria-describedby={
              erros.tabelaHorarioId ? `${idJornada}-erro` : `${idJornada}-ajuda`
            }
            onChange={(e) => {
              setJornadaId(e.target.value);
              setErros((atual) => semErro(atual, "tabelaHorarioId"));
            }}
          >
            <option value="">Selecione a jornada</option>
            {opcoes.map((j) => (
              <option key={j.id} value={j.id}>
                {`${rotuloDaJornada(j)} · ${formatarDuracao(cargaSemanal(j.periodos))} por semana`}
              </option>
            ))}
          </select>
          <Erro id={`${idJornada}-erro`} texto={erros.tabelaHorarioId} />
          <span id={`${idJornada}-ajuda`} className="escala-ficha__ajuda">
            {catalogo === "erro"
              ? "Não foi possível carregar as jornadas."
              : catalogo.length === 0
                ? "Nenhuma jornada ativa na empresa."
                : opcoes.length === 0
                  ? "Nenhuma outra jornada ativa na empresa."
                  : "Só jornadas ativas da empresa."}
          </span>
          {onAbrirJornadas ? (
            <button
              type="button"
              className="escala-gaveta__link"
              onClick={() => {
                onFechar();
                onAbrirJornadas();
              }}
            >
              Criar ou ajustar jornada
            </button>
          ) : null}
        </div>

        <div className="escala-gaveta__campo">
          <label htmlFor={idData}>Vale a partir de</label>
          <input
            id={idData}
            type="date"
            value={data}
            min={dataAdmissao ?? undefined}
            disabled={enviando}
            aria-invalid={erros.vigenciaInicio ? "true" : undefined}
            aria-describedby={
              erros.vigenciaInicio ? `${idData}-erro` : `${idData}-ajuda`
            }
            onChange={(e) => {
              setData(e.target.value);
              setErros((atual) => semErro(atual, "vigenciaInicio"));
            }}
          />
          <Erro id={`${idData}-erro`} texto={erros.vigenciaInicio} />
          <span id={`${idData}-ajuda`} className="escala-ficha__ajuda">
            Pode ser uma data passada ou futura, a partir da admissão.
          </span>
        </div>

        {escolhida ? (
          <section
            className="escala-gaveta__muda"
            aria-labelledby={`${base}-muda`}
          >
            <h4 id={`${base}-muda`} className="escala-gaveta__muda-titulo">
              O que muda
            </h4>
            <dl className="escala-gaveta__muda-lista">
              {linhasDoQueMuda.map(([rotulo, de, para]) => (
                <div key={rotulo} className="escala-gaveta__muda-linha">
                  <dt>{rotulo}</dt>
                  <dd>
                    <span className="escala-gaveta__antes">{de}</span>
                    <span aria-hidden="true"> → </span>
                    <span className="ev:sr-only"> passa a </span>
                    <strong>{para}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {erros.geral ? (
          <p
            id={`${base}-geral`}
            className="escala-ficha__erro"
            role="alert"
            tabIndex={-1}
          >
            {erros.geral}
          </p>
        ) : null}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function GavetaDeEncerramento({
  vinculo,
  servico,
  onFechar,
  onGravado,
}: {
  readonly vinculo: VinculoHorarioApi;
  readonly servico: ServicoDeEscala;
  readonly onFechar: () => void;
  readonly onGravado: (mensagem: string) => void;
}) {
  const base = useId();
  const idData = `${base}-ultimo`;
  const [ultimo, setUltimo] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const focoRef = useRef<string | null>(null);

  useEffect(() => {
    const alvo = focoRef.current;
    if (alvo === null) return;
    focoRef.current = null;
    document.getElementById(alvo)?.focus();
  });

  async function gravar(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando) return;
    let local: string | null = null;
    if (!ultimo) local = "Informe o último dia na escala.";
    else if (ultimo < vinculo.vigenciaInicio) {
      local = `O último dia não pode ser antes de ${formatarDiaCivil(vinculo.vigenciaInicio)}, início da escala.`;
    }
    if (local) {
      setErros({ vigenciaFim: local });
      focoRef.current = idData;
      return;
    }
    setEnviando(true);
    setErros({});
    try {
      await servico.encerrar(vinculo.id, {
        vigenciaFim: proximoDiaCivil(ultimo),
      });
      onGravado(
        `Escala encerrada. O último dia nela é ${formatarDiaCivil(ultimo)}.`,
      );
    } catch (erro) {
      const recusa = errosDaRecusa(erro, "vigenciaFim");
      setErros(recusa);
      focoRef.current = recusa.vigenciaFim ? idData : `${base}-geral`;
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet
      aberto
      titulo="Encerrar escala"
      descricao={`Informe o último dia em ${rotuloDaJornada(vinculo.tabela)}, que começou em ${formatarDiaCivil(vinculo.vigenciaInicio)}. A escala continua no histórico.`}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={ultimo !== ""}
      className="escala-gaveta"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={enviando}
            onClick={() => void gravar()}
          >
            {enviando ? "Encerrando…" : "Encerrar escala"}
          </Button>
        </FormActions>
      }
    >
      <form
        className="escala-gaveta__campos"
        noValidate
        onSubmit={(e) => void gravar(e)}
      >
        <div className="escala-gaveta__campo">
          <label htmlFor={idData}>Último dia na escala</label>
          <input
            id={idData}
            type="date"
            value={ultimo}
            min={vinculo.vigenciaInicio}
            disabled={enviando}
            aria-invalid={erros.vigenciaFim ? "true" : undefined}
            aria-describedby={erros.vigenciaFim ? `${idData}-erro` : undefined}
            onChange={(e) => {
              setUltimo(e.target.value);
              setErros({});
            }}
          />
          <Erro id={`${idData}-erro`} texto={erros.vigenciaFim} />
        </div>
        {erros.geral ? (
          <p
            id={`${base}-geral`}
            className="escala-ficha__erro"
            role="alert"
            tabIndex={-1}
          >
            {erros.geral}
          </p>
        ) : null}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
}
