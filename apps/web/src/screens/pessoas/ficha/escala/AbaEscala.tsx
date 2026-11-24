/**
 * T215 — aba Escala da ficha do colaborador, no desenho da referência:
 *
 * - **Escala atual:** o padrão (5x2, 6x1, revezamentos, plantões, embarque
 *   ou "outra") com o turno, desde quando vale e os indicadores (horas por
 *   semana, dias de benefício no mês e a particularidade do modelo); "Abrir
 *   no quadro" e "Alterar padrão".
 * - **Próximos 7 dias** e o **calendário do mês** (com os feriados).
 * - **Histórico da escala:** cada mudança de padrão, com o período, quem
 *   definiu e quando.
 * - **Definir/Alterar padrão de escala** (gaveta): cada modelo mostra só os
 *   campos dele; "O que muda" compara antes e depois. "Encerrar escala" fica
 *   no rodapé da gaveta de alteração.
 *
 * RH e DP (`podeOperar`) definem, alteram e encerram; os demais só leem. Os
 * turnos são as jornadas ativas da empresa.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError } from "../../../../api/colaboradoresClient";
import {
  consultarEscalas,
  definirEscala,
  encerrarEscala,
  type DefinirEscalaDto,
  type EscalaApi,
  type EscalasDoColaboradorApi,
} from "../../../../api/escalaClient";
import {
  listarTabelasHorario,
  type TabelaHorarioApi,
} from "../../../../api/horariosClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../../../api/csrfClient";
import { Button, FormActions } from "../../../../components";
import { Sheet } from "../../../../ui";
import {
  AvisoFlutuante,
  type ConteudoDoAviso,
} from "../../../../ui/AvisoFlutuante";
import {
  IconeCalendario,
  IconeMais,
  IconeRelogio,
  IconeRemover,
} from "../../../../ui/icones";
import { Esqueleto, Revelar } from "../../../../ui/movimento";
import { formatarDiaCivil } from "../../../../format/data";
import {
  diaAnteriorCivil,
  diaDeHoje,
  proximoDiaCivil,
} from "../../jornadaColaborador";
import {
  type PadraoDeEscala,
  diaDaSemana,
  diasNoMes,
  feriadoDe,
  avisosDaJornada,
  beneficioPelosDiasUteis,
  formatarHoras,
  horasPorSemana,
  jornadaPorSemana,
  minutosNoDia,
  somarDias,
  trabalhoNoDia,
} from "./calendarioDaEscala";
import {
  DIAS_DA_SEMANA,
  GRUPOS_DE_ESCALA,
  MODELOS_DE_ESCALA,
  modeloDe,
  temCiclo,
} from "./modelosDeEscala";
import { formatarDuracao, gradeDaSemana } from "./resumoDaEscala";
import { SeletorRico, type GrupoRico } from "./SeletorRico";
import "./AbaEscala.css";

/** As operações da aba (o servidor, ou um dublê nos testes). */
export interface ServicoDeEscala {
  consultar(colaboradorId: string): Promise<EscalasDoColaboradorApi>;
  turnos(): Promise<TabelaHorarioApi[]>;
  definir(
    colaboradorId: string,
    dto: DefinirEscalaDto,
  ): Promise<EscalasDoColaboradorApi>;
  encerrar(
    colaboradorId: string,
    escalaId: string,
    vigenciaFim: string,
  ): Promise<EscalasDoColaboradorApi>;
}

export const servicoDeEscalaDoServidor: ServicoDeEscala = {
  consultar: consultarEscalas,
  turnos: async () =>
    (await listarTabelasHorario({ ativo: true, tamanhoPagina: 100 })).itens,
  definir: definirEscala,
  encerrar: encerrarEscala,
};

interface Props {
  readonly colaboradorId: string;
  readonly nome: string;
  readonly primeiroNome: string;
  /** "TI · CLT" — cargo e tipo de contrato, para o cabeçalho da gaveta. */
  readonly detalhe?: string;
  /** RH e DP: definir, alterar e encerrar. */
  readonly podeOperar: boolean;
  /** Abre o quadro da Escala de trabalho. */
  readonly onAbrirQuadro?: () => void;
  /** T215 — jornada semanal do contrato (horas), para "por semana". */
  readonly jornadaContratoHoras?: number | null;
  /** T215 — a unidade da lotação, mostrada como "local". */
  readonly local?: string | null;
  /** Dia civil de hoje (testes). */
  readonly hoje?: string;
  readonly servico?: ServicoDeEscala;
}

const VAZIO = "—";
const SEM_TURNO = "sem";
const MESMO_TURNO = "mesmo";
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const DIAS_CURTOS = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const CABECALHO_DO_MES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Cor dos turnos enquanto o catálogo não guarda cor própria. */
const COR_DO_TURNO = "var(--color-ink-subtle)";

type Situacao = "vigente" | "programada" | "encerrada";
const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: "Vigente",
  programada: "Programada",
  encerrada: "Encerrada",
};

type Turno = {
  nome: string;
  periodos: { dia: string; inicio: string; fim: string }[];
  intervaloMinutos?: number;
};

function situacaoDe(e: EscalaApi, hoje: string): Situacao {
  if (e.vigenciaInicio > hoje) return "programada";
  if (e.vigenciaFim !== null && e.vigenciaFim <= hoje) return "encerrada";
  return "vigente";
}

function diaTipico(periodos: Turno["periodos"]) {
  return gradeDaSemana(periodos).find((d) => d.minutos > 0) ?? null;
}

/** "09:00–18:00". */
function faixaDoTurno(t: Turno | null): string {
  const dia = t ? diaTipico(t.periodos) : null;
  return dia
    ? `${dia.periodos[0]!.inicio}–${dia.periodos[dia.periodos.length - 1]!.fim}`
    : "";
}

/**
 * "09:00–18:00 · 1 h de intervalo". T215 — num período corrido, o intervalo
 * é o do turno; com dois ou mais, o vão entre eles.
 */
export function descricaoDoTurno(
  periodos: Turno["periodos"],
  intervaloMinutos = 0,
): string {
  const dia = diaTipico(periodos);
  if (!dia) return "sem horário";
  const faixa = `${dia.periodos[0]!.inicio}–${dia.periodos[dia.periodos.length - 1]!.fim}`;
  const intervalo =
    dia.periodos.length === 1 ? intervaloMinutos : dia.intervalo;
  return intervalo === 0
    ? `${faixa} · sem intervalo`
    : `${faixa} · ${formatarDuracao(intervalo)} de intervalo`;
}

/** "Comercial 09:00–18:00" (sem turno: "Sem turno"). */
function curtoDoTurno(t: Turno | null): string {
  return t ? `${t.nome} ${faixaDoTurno(t)}`.trim() : "Sem turno";
}

function siglaDe(t: Turno | null): string {
  return (t?.nome.trim()[0] ?? "?").toUpperCase();
}

function nomeDoDia(n: number): string {
  return DIAS_DA_SEMANA.find((d) => d.numero === n)?.nome ?? "";
}

function listaDeDias(dias: readonly number[]): string {
  const nomes = dias.map(nomeDoDia);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function padraoDe(e: EscalaApi): PadraoDeEscala {
  return {
    modelo: e.modelo,
    turno: e.turno?.periodos ?? null,
    turnoNoite: e.turnoNoite?.periodos ?? null,
    intervaloTurno: e.turno?.intervaloMinutos ?? 0,
    intervaloTurnoNoite: e.turnoNoite?.intervaloMinutos ?? 0,
    folgaSemanal: e.folgaSemanal,
    diasTrabalho: e.diasTrabalho,
    inicioCiclo: e.inicioCiclo,
    vigenciaInicio: e.vigenciaInicio,
  };
}

function mesDe(dia: string): string {
  return dia.slice(0, 7);
}

function mesCurto(dia: string): string {
  const nome = MESES[Number(dia.slice(5, 7)) - 1]!;
  return nome.length <= 5 ? nome : `${nome.slice(0, 3)}.`;
}

/** A escala que vale no dia, entre todas. */
function escalaDoDia(escalas: EscalaApi[], dia: string): EscalaApi | null {
  return (
    escalas.find(
      (e) =>
        e.vigenciaInicio <= dia &&
        (e.vigenciaFim === null || dia < e.vigenciaFim),
    ) ?? null
  );
}

interface DiaResolvido {
  readonly tipo: "trabalho" | "folga" | "dsr" | "sem-escala";
  readonly turno: Turno | null;
}

function resolverDia(escalas: EscalaApi[], dia: string): DiaResolvido {
  const e = escalaDoDia(escalas, dia);
  if (!e) return { tipo: "sem-escala", turno: null };
  const t = trabalhoNoDia(padraoDe(e), dia);
  if (t === null) {
    // DSR: a folga escolhida no 6x1 e o domingo nas semanas fixas; nos
    // revezamentos, plantões e embarque, a folga é do ciclo.
    const tipo = modeloDe(e.modelo)?.tipo;
    const dsr =
      e.modelo === "6x1"
        ? diaDaSemana(dia) === (e.folgaSemanal ?? 7)
        : (tipo === "semanal" || tipo === "outra") && diaDaSemana(dia) === 7;
    return { tipo: dsr ? "dsr" : "folga", turno: null };
  }
  return {
    tipo: "trabalho",
    turno: t === "noite" ? e.turnoNoite : e.turno,
  };
}

type Carga =
  | { estado: "carregando" }
  | { estado: "erro" }
  | {
      estado: "pronto";
      dados: EscalasDoColaboradorApi;
      turnos: TabelaHorarioApi[] | "erro";
    };

type Gaveta = "definir" | "alterar" | "encerrar" | null;

export function AbaEscala({
  colaboradorId,
  nome,
  primeiroNome,
  detalhe,
  podeOperar,
  onAbrirQuadro,
  jornadaContratoHoras = null,
  local = null,
  hoje = diaDeHoje(),
  servico = servicoDeEscalaDoServidor,
}: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [aviso, setAviso] = useState<ConteudoDoAviso | null>(null);
  const idTitulo = useId();
  const focarTitulo = useRef(false);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarga({ estado: "carregando" });
      try {
        const [dados, turnos] = await Promise.all([
          servico.consultar(colaboradorId),
          podeOperar
            ? servico.turnos().catch(() => "erro" as const)
            : Promise.resolve([]),
        ]);
        setCarga({ estado: "pronto", dados, turnos });
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

  const { dados, turnos } = carga;
  const { escalas } = dados;
  const aberta = escalas.find((e) => e.vigenciaFim === null) ?? null;
  const atual = escalas.find((e) => situacaoDe(e, hoje) === "vigente") ?? null;
  const programada =
    escalas.find((e) => situacaoDe(e, hoje) === "programada") ?? null;
  const cadastro = modeloDe(dados.escalaDoCadastro);

  const gravado = (titulo: string, texto: string) => {
    focarTitulo.current = true;
    setGaveta(null);
    setAviso({ id: Date.now(), titulo, texto });
    void carregar(true);
  };

  return (
    <Revelar>
      <div className="escala-ficha">
        {escalas.length === 0 ? (
          <section className="ficha-ref__cartao escala-ficha__vazio">
            <span className="escala-ficha__vazio-icone" aria-hidden="true">
              <IconeRelogio tamanho={20} />
            </span>
            <h3
              id={idTitulo}
              tabIndex={-1}
              className="escala-ficha__vazio-titulo"
            >
              {`${primeiroNome} ainda não tem escala`}
            </h3>
            <p className="escala-ficha__vazio-texto">
              {cadastro
                ? `Hoje vale a escala do cadastro (${cadastro.nome}): os benefícios pagos por dia usam os dias dela no mês. Defina o padrão aqui ou aplique um modelo para várias pessoas no quadro.`
                : "Sem escala, os benefícios pagos por dia usam os dias úteis do mês. Defina a escala aqui ou aplique um modelo para várias pessoas no quadro."}
            </p>
            <div className="escala-ficha__acoes">
              {onAbrirQuadro ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onAbrirQuadro}
                >
                  Abrir o quadro
                </Button>
              ) : null}
              {podeOperar ? (
                <Button type="button" onClick={() => setGaveta("definir")}>
                  <IconeMais tamanho={16} />
                  Definir escala
                </Button>
              ) : null}
            </div>
          </section>
        ) : (
          <>
            <EscalaAtual
              idTitulo={idTitulo}
              atual={atual}
              programada={programada}
              escalas={escalas}
              hoje={hoje}
              jornadaContratoHoras={jornadaContratoHoras}
              local={local}
              acoes={
                <>
                  {onAbrirQuadro ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onAbrirQuadro}
                    >
                      Abrir no quadro
                    </Button>
                  ) : null}
                  {podeOperar ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setGaveta(aberta ? "alterar" : "definir")}
                    >
                      {aberta ? "Alterar padrão" : "Definir escala"}
                    </Button>
                  ) : null}
                </>
              }
            />
            <ProximosDias escalas={escalas} hoje={hoje} />
            <CalendarioDoMes escalas={escalas} hoje={hoje} />
            <Historico escalas={escalas} hoje={hoje} />
          </>
        )}

        {!podeOperar ? (
          <p className="escala-ficha__nota">
            Somente consulta: RH e DP definem, alteram e encerram a escala.
          </p>
        ) : null}

        <AvisoFlutuante aviso={aviso} onFechar={() => setAviso(null)} />

        {gaveta === "definir" || gaveta === "alterar" ? (
          <GavetaDoPadrao
            modo={gaveta}
            colaboradorId={colaboradorId}
            nome={nome}
            detalhe={detalhe}
            dados={dados}
            aberta={aberta}
            turnos={turnos}
            hoje={hoje}
            jornadaContratoHoras={jornadaContratoHoras}
            servico={servico}
            onFechar={() => setGaveta(null)}
            onEncerrar={() => setGaveta("encerrar")}
            onGravado={gravado}
          />
        ) : null}
        {gaveta === "encerrar" && aberta ? (
          <GavetaDeEncerramento
            colaboradorId={colaboradorId}
            nome={nome}
            detalhe={detalhe}
            escala={aberta}
            servico={servico}
            onFechar={() => setGaveta(null)}
            onGravado={gravado}
          />
        ) : null}
      </div>
    </Revelar>
  );
}

// ------------------------------------------------------------- Cartões

function Cartao({
  icone,
  titulo,
  idTitulo,
  subtitulo,
  acoes,
  className,
  children,
}: {
  readonly icone: ReactNode;
  readonly titulo: string;
  readonly idTitulo?: string;
  readonly subtitulo?: string;
  readonly acoes?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const proprio = useId();
  const id = idTitulo ?? proprio;
  return (
    <section
      className={`ficha-ref__cartao escala-ficha__cartao ${className ?? ""}`}
      aria-labelledby={id}
    >
      <header className="escala-ficha__cabeca">
        <span className="escala-ficha__cabeca-icone" aria-hidden="true">
          {icone}
        </span>
        <div className="escala-ficha__cabeca-textos">
          <h3 id={id} tabIndex={-1} className="escala-ficha__titulo">
            {titulo}
          </h3>
          {subtitulo ? (
            <p className="escala-ficha__subtitulo">{subtitulo}</p>
          ) : null}
        </div>
        {acoes ? (
          <div className="escala-ficha__cabeca-acoes">{acoes}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function EscalaAtual({
  idTitulo,
  atual,
  programada,
  escalas,
  hoje,
  jornadaContratoHoras,
  local,
  acoes,
}: {
  readonly idTitulo: string;
  readonly atual: EscalaApi | null;
  readonly programada: EscalaApi | null;
  readonly escalas: EscalaApi[];
  readonly hoje: string;
  readonly jornadaContratoHoras: number | null;
  readonly local: string | null;
  readonly acoes: ReactNode;
}) {
  const e = atual ?? programada;
  const subtitulo = e
    ? `Definida na ficha em ${formatarDiaCivil(e.definidaEm.slice(0, 10))}${e.definidaPor ? ` · ${e.definidaPor}` : ""}`
    : undefined;
  const ultimaEncerrada = escalas.find(
    (x) => situacaoDe(x, hoje) === "encerrada",
  );
  return (
    <Cartao
      icone={<IconeRelogio tamanho={18} />}
      titulo="Escala atual"
      idTitulo={idTitulo}
      {...(subtitulo ? { subtitulo } : {})}
      acoes={acoes}
    >
      <div className="escala-ficha__corpo">
        {e ? (
          <Resumo
            e={e}
            hoje={hoje}
            programada={!atual}
            jornadaContratoHoras={jornadaContratoHoras}
            local={local}
          />
        ) : (
          <p className="escala-ficha__sem-vigente">
            {ultimaEncerrada?.vigenciaFim
              ? `Sem escala vigente hoje. A última terminou em ${formatarDiaCivil(diaAnteriorCivil(ultimaEncerrada.vigenciaFim))}.`
              : "Sem escala vigente hoje."}
          </p>
        )}
        {atual && programada ? (
          <p className="escala-ficha__programada">
            <IconeCalendario tamanho={16} />
            <span>
              {`A partir de ${formatarDiaCivil(programada.vigenciaInicio)}: ${modeloDe(programada.modelo)?.nome ?? programada.modelo} · ${curtoDoTurno(programada.turno)}.`}
            </span>
          </p>
        ) : null}
      </div>
    </Cartao>
  );
}

/** Um indicador da Escala atual, com a explicação (dica) opcional. */
type Indicador = [
  valor: string,
  rotulo: string,
  dica?: { readonly titulo: string; readonly texto: string },
];

const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function Resumo({
  e,
  hoje,
  programada,
  jornadaContratoHoras,
  local,
}: {
  readonly e: EscalaApi;
  readonly hoje: string;
  readonly programada: boolean;
  readonly jornadaContratoHoras: number | null;
  readonly local: string | null;
}) {
  const idDica = useId();
  const base = e.vigenciaInicio > hoje ? e.vigenciaInicio : hoje;
  const ultimo = e.vigenciaFim ? diaAnteriorCivil(e.vigenciaFim) : null;
  const beneficio = diasNoMes(e.modelo, mesDe(base));
  const nomeDoModelo = modeloDe(e.modelo)?.nome ?? e.modelo;
  // T215 — como na referência: a jornada do contrato e o limite legal da
  // data (EC 141/2026), o menor; o benefício pelos dias úteis ou pelo
  // catálogo da escala.
  const indicadores: Indicador[] = [
    [
      formatarHoras(jornadaPorSemana(jornadaContratoHoras, base)),
      "por semana",
      {
        titulo: "Jornada por semana",
        texto:
          "Pela jornada do contrato e pela data (EC 141/2026): vale o menor limite.",
      },
    ],
    [
      `${beneficio} dias`,
      `de benefício em ${mesCurto(base)}`,
      {
        titulo: `${beneficio} dias de benefício em ${NOMES_DOS_MESES[Number(base.slice(5, 7)) - 1]}`,
        texto: beneficioPelosDiasUteis(e.modelo)
          ? "Pelos dias úteis do mês (sem escala no catálogo)."
          : `Pelo catálogo (${nomeDoModelo}).`,
      },
    ],
  ];
  if (e.folgaSemanal !== null) {
    indicadores.push([maiuscula(nomeDoDia(e.folgaSemanal)), "folga semanal"]);
  }
  if (e.diasTrabalho.length > 0) {
    indicadores.push([
      maiuscula(listaDeDias(e.diasTrabalho)),
      "dias de trabalho",
    ]);
  }
  if (e.turnoNoite) {
    indicadores.push([e.turnoNoite.nome, "turno da noite"]);
  }
  if (e.inicioCiclo) {
    indicadores.push([formatarDiaCivil(e.inicioCiclo), "início do ciclo"]);
  }
  if (local) indicadores.push([local, "local"]);
  return (
    <div className="escala-ficha__resumo">
      <div className="escala-ficha__padrao">
        <p className="escala-ficha__padrao-linha">
          <strong className="escala-ficha__modelo">
            {modeloDe(e.modelo)?.nome ?? e.modelo}
          </strong>
          <span className="escala-ficha__turno">
            <span
              className="seletor-rico__ponto"
              style={{ background: COR_DO_TURNO }}
              aria-hidden="true"
            />
            {e.turno?.nome ?? "Sem turno fixo"}
          </span>
          {programada ? (
            <span className="escala-ficha__selo escala-ficha__selo--programada">
              Programada
            </span>
          ) : null}
          {e.turno && !e.turno.ativo ? (
            <span className="escala-ficha__selo escala-ficha__selo--alerta">
              Turno inativo
            </span>
          ) : null}
        </p>
        <p className="escala-ficha__sub">
          {[
            e.turno
              ? descricaoDoTurno(e.turno.periodos, e.turno.intervaloMinutos)
              : null,
            programada
              ? `a partir de ${formatarDiaCivil(e.vigenciaInicio)}`
              : `desde ${formatarDiaCivil(e.vigenciaInicio)}`,
            ultimo ? `até ${formatarDiaCivil(ultimo)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <dl className="escala-ficha__indicadores">
        {indicadores.map(([valor, rotulo, dica], i) => (
          <div
            key={rotulo}
            className="escala-ficha__indicador"
            {...(dica
              ? { tabIndex: 0, "aria-describedby": `${idDica}-${i}` }
              : {})}
          >
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
            {dica ? (
              <span
                role="tooltip"
                id={`${idDica}-${i}`}
                className="escala-ficha__dica"
              >
                <strong>{dica.titulo}</strong> <span>{dica.texto}</span>
              </span>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function DescricaoDoDia({ d }: { readonly d: DiaResolvido }) {
  if (d.tipo === "sem-escala") {
    return <span className="escala-ficha__folga">Sem escala</span>;
  }
  if (d.tipo === "dsr") {
    return <span className="escala-ficha__folga">Folga · DSR</span>;
  }
  if (d.tipo === "folga") {
    return <span className="escala-ficha__folga">Folga</span>;
  }
  return (
    <span className="escala-ficha__turno">
      <span
        className="seletor-rico__ponto"
        style={{ background: COR_DO_TURNO }}
        aria-hidden="true"
      />
      <strong>{d.turno?.nome ?? "Trabalho"}</strong>
      {d.turno ? (
        <span className="escala-ficha__sub">
          {descricaoDoTurno(d.turno.periodos, d.turno.intervaloMinutos)}
        </span>
      ) : null}
    </span>
  );
}

function ProximosDias({
  escalas,
  hoje,
}: {
  readonly escalas: EscalaApi[];
  readonly hoje: string;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(hoje, i));
  const rotulo = (dia: string, i: number) =>
    i === 0
      ? "Hoje"
      : i === 1
        ? "Amanhã"
        : `${DIAS_CURTOS[diaDaSemana(dia)]}, ${formatarDiaCivil(dia).slice(0, 5)}`;
  return (
    <Cartao
      icone={<IconeCalendario tamanho={18} />}
      titulo="Próximos 7 dias"
      subtitulo={`De hoje até ${formatarDiaCivil(dias[6]!).slice(0, 5)}, com o que ainda está em rascunho`}
    >
      <ul className="escala-ficha__dias" aria-label="Próximos 7 dias">
        {dias.map((dia, i) => (
          <li key={dia} className="escala-ficha__dia">
            <span
              className={`escala-ficha__dia-rotulo${i === 0 ? " escala-ficha__dia-rotulo--hoje" : ""}`}
            >
              {rotulo(dia, i)}
            </span>
            <DescricaoDoDia d={resolverDia(escalas, dia)} />
            <span className="escala-ficha__etiqueta">Não publicado</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

function CalendarioDoMes({
  escalas,
  hoje,
}: {
  readonly escalas: EscalaApi[];
  readonly hoje: string;
}) {
  const [mes, setMes] = useState(mesDe(hoje));
  const primeiro = `${mes}-01`;
  const ano = Number(mes.slice(0, 4));
  const numeroMes = Number(mes.slice(5, 7));
  const totalDias = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const deslocamento = diaDaSemana(primeiro) % 7; // domingo = 0
  const dias = Array.from({ length: totalDias }, (_, i) =>
    somarDias(primeiro, i),
  );
  let trabalhados = 0;
  let minutos = 0;
  const turnosUsados = new Map<string, Turno>();
  let temFeriado = false;
  for (const dia of dias) {
    if (feriadoDe(dia)) temFeriado = true;
    const e = escalaDoDia(escalas, dia);
    if (!e) continue;
    const r = resolverDia(escalas, dia);
    if (r.tipo === "trabalho") {
      trabalhados += 1;
      minutos += minutosNoDia(padraoDe(e), dia);
      if (r.turno) turnosUsados.set(r.turno.nome, r.turno);
    }
  }
  const mover = (n: number) => {
    const d = new Date(Date.UTC(ano, numeroMes - 1 + n, 1));
    setMes(d.toISOString().slice(0, 7));
  };
  const titulo = `${maiuscula(MESES[numeroMes - 1]!)} de ${ano}`;
  return (
    <Cartao
      icone={<IconeCalendario tamanho={18} />}
      titulo={titulo}
      subtitulo={`${trabalhados} dias de trabalho · ${formatarHoras(minutos)} previstas · ainda não publicada`}
      acoes={
        <div className="escala-ficha__navegar">
          <button
            type="button"
            className="escala-ficha__seta escala-ficha__seta--anterior"
            aria-label="Mês anterior"
            onClick={() => mover(-1)}
          />
          <button
            type="button"
            className="escala-ficha__seta"
            aria-label="Próximo mês"
            onClick={() => mover(1)}
          />
        </div>
      }
    >
      <div className="escala-ficha__calendario-moldura">
        <div className="escala-ficha__calendario" aria-label={titulo}>
          <div className="escala-ficha__semana-linha" aria-hidden="true">
            {CABECALHO_DO_MES.map((c) => (
              <span key={c} className="escala-ficha__semana-dia">
                {c}
              </span>
            ))}
          </div>
          <ol className="escala-ficha__grade" aria-label={`Dias de ${titulo}`}>
            {Array.from({ length: deslocamento }, (_, i) => (
              <li
                key={`v${i}`}
                aria-hidden="true"
                className="escala-ficha__celula escala-ficha__celula--vazia"
              />
            ))}
            {dias.map((dia) => {
              const feriado = feriadoDe(dia);
              const r = resolverDia(escalas, dia);
              return (
                <li
                  key={dia}
                  className={`escala-ficha__celula${feriado ? " escala-ficha__celula--feriado" : ""}`}
                  aria-current={dia === hoje ? "date" : undefined}
                >
                  <span className="escala-ficha__celula-topo">
                    <span
                      className={`escala-ficha__numero${dia === hoje ? " escala-ficha__numero--hoje" : ""}`}
                    >
                      {Number(dia.slice(8, 10))}
                    </span>
                    {feriado ? (
                      <span className="escala-ficha__feriado" title={feriado}>
                        {feriado}
                      </span>
                    ) : null}
                  </span>
                  {r.tipo === "trabalho" ? (
                    <span className="escala-ficha__celula-turno">
                      <span className="escala-ficha__sigla">
                        {siglaDe(r.turno)}
                      </span>
                      <span>{faixaDoTurno(r.turno)}</span>
                    </span>
                  ) : r.tipo === "dsr" ? (
                    <span className="escala-ficha__folga">Folga · DSR</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <p className="escala-ficha__legenda">
        {[...turnosUsados.values()].map((t) => (
          <span key={t.nome} className="escala-ficha__legenda-item">
            <span className="escala-ficha__sigla">{siglaDe(t)}</span>
            {curtoDoTurno(t)}
          </span>
        ))}
        {temFeriado ? (
          <span className="escala-ficha__legenda-item">
            <span className="escala-ficha__legenda-feriado">2</span>
            Feriado
          </span>
        ) : null}
      </p>
    </Cartao>
  );
}

function Historico({
  escalas,
  hoje,
}: {
  readonly escalas: EscalaApi[];
  readonly hoje: string;
}) {
  return (
    <Cartao
      icone={<IconeRelogio tamanho={18} />}
      titulo="Histórico da escala"
      subtitulo="Cada mudança de padrão, com o período em que valeu"
    >
      <ol className="escala-ficha__linhas" aria-label="Histórico da escala">
        {escalas.map((e) => {
          const situacao = situacaoDe(e, hoje);
          const ultimo = e.vigenciaFim ? diaAnteriorCivil(e.vigenciaFim) : null;
          const extras = [
            e.folgaSemanal !== null
              ? `Folga semanal: ${nomeDoDia(e.folgaSemanal)}`
              : null,
            e.diasTrabalho.length > 0
              ? `Dias de trabalho: ${listaDeDias(e.diasTrabalho)}`
              : null,
            e.turnoNoite ? `Turno da noite: ${e.turnoNoite.nome}` : null,
            e.inicioCiclo
              ? `Início do ciclo: ${formatarDiaCivil(e.inicioCiclo)}`
              : null,
          ].filter(Boolean);
          return (
            <li
              key={e.id}
              className={`escala-ficha__linha escala-ficha__linha--${situacao}`}
            >
              <span className="escala-ficha__marca" aria-hidden="true" />
              <div className="escala-ficha__linha-corpo">
                <p className="escala-ficha__linha-titulo">
                  <strong>{modeloDe(e.modelo)?.nome ?? e.modelo}</strong>
                  <span className="escala-ficha__turno">
                    <span
                      className="seletor-rico__ponto"
                      style={{ background: COR_DO_TURNO }}
                      aria-hidden="true"
                    />
                    {e.turno
                      ? `${e.turno.nome} · ${faixaDoTurno(e.turno)}`
                      : "Sem turno fixo"}
                  </span>
                  <span
                    className={`escala-ficha__selo escala-ficha__selo--${situacao}`}
                  >
                    {ROTULO_SITUACAO[situacao]}
                  </span>
                </p>
                <p className="escala-ficha__linha-detalhe">
                  {`${formatarDiaCivil(e.vigenciaInicio)} até ${ultimo ? formatarDiaCivil(ultimo) : "atual"} · Ficha do colaborador${e.definidaPor ? ` · ${e.definidaPor}` : ""} em ${formatarDiaCivil(e.definidaEm.slice(0, 10))}`}
                </p>
                {extras.length > 0 ? (
                  <p className="escala-ficha__linha-detalhe">
                    {extras.join(" · ")}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Cartao>
  );
}

// ---------------------------------------------------------------- Gavetas

type Campo =
  | "modelo"
  | "tabelaHorarioId"
  | "turnoNoiteId"
  | "folgaSemanal"
  | "diasTrabalho"
  | "inicioCiclo"
  | "vigenciaInicio"
  | "vigenciaFim";
type Erros = Partial<Record<Campo | "geral", string>>;

const MENSAGEM_DO_SERVIDOR: Record<string, string> = {
  "vigenciaInicio:sobreposta":
    "Este período cruza outra escala. Escolha outra data.",
  "vigenciaInicio:fora_de_ordem":
    "A nova escala não pode começar antes do início da atual.",
  "vigenciaInicio:antes_da_admissao":
    "A escala não pode começar antes da admissão.",
  "modelo:igual_a_vigente":
    "Este padrão é igual ao atual. Mude a escala, o turno ou os dias.",
  "tabelaHorarioId:indisponivel":
    "Este turno não está disponível. Escolha um turno ativo.",
  "turnoNoiteId:indisponivel":
    "Este turno não está disponível. Escolha um turno ativo.",
  "folgaSemanal:obrigatorio": "Escolha o dia da folga semanal.",
  "diasTrabalho:obrigatorio": "Escolha ao menos um dia de trabalho.",
  "inicioCiclo:obrigatorio": "Informe o início do ciclo.",
  "vigenciaFim:ja_encerrada":
    "Esta escala já foi encerrada. Atualize a aba para conferir.",
  "vigenciaFim:fora_de_ordem":
    "O último dia não pode ser antes do início da escala.",
};

function errosDaRecusa(erro: unknown): Erros {
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
      const texto = MENSAGEM_DO_SERVIDOR[`${campo}:${motivo}`];
      if (texto) porCampo[campo as Campo] = texto;
    }
    if (Object.keys(porCampo).length > 0) return porCampo;
    if (erro.status === 403) {
      return {
        geral:
          "Seu perfil não tem permissão para alterar a escala. Nada foi salvo.",
      };
    }
    if (erro.status === 404) {
      return {
        geral: "Colaborador não encontrado na empresa ativa. Nada foi salvo.",
      };
    }
    if (erro.status === 409) {
      return {
        geral: "A escala de quem foi desligado não muda. Nada foi salvo.",
      };
    }
  }
  return {
    geral:
      "Não foi possível confirmar se a alteração foi salva. Atualize a aba para conferir antes de tentar de novo.",
  };
}

const ORDEM_DOS_CAMPOS: Campo[] = [
  "modelo",
  "tabelaHorarioId",
  "turnoNoiteId",
  "folgaSemanal",
  "diasTrabalho",
  "inicioCiclo",
  "vigenciaInicio",
  "vigenciaFim",
];

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

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima =
    partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return `${primeira}${ultima}`.toUpperCase();
}

function GavetaDoPadrao({
  modo,
  colaboradorId,
  nome,
  detalhe,
  dados,
  aberta,
  turnos,
  hoje,
  jornadaContratoHoras,
  servico,
  onFechar,
  onEncerrar,
  onGravado,
}: {
  readonly modo: "definir" | "alterar";
  readonly colaboradorId: string;
  readonly nome: string;
  readonly detalhe: string | undefined;
  readonly dados: EscalasDoColaboradorApi;
  readonly aberta: EscalaApi | null;
  readonly turnos: TabelaHorarioApi[] | "erro";
  readonly hoje: string;
  readonly jornadaContratoHoras: number | null;
  readonly servico: ServicoDeEscala;
  readonly onFechar: () => void;
  readonly onEncerrar: () => void;
  readonly onGravado: (titulo: string, texto: string) => void;
}) {
  const base = useId();
  const ids = {
    modelo: `${base}-modelo`,
    tabelaHorarioId: `${base}-turno`,
    turnoNoiteId: `${base}-noite`,
    folgaSemanal: `${base}-folga`,
    diasTrabalho: `${base}-dias`,
    inicioCiclo: `${base}-ciclo`,
    vigenciaInicio: `${base}-vale`,
    vigenciaFim: `${base}-fim`,
    geral: `${base}-geral`,
  } satisfies Record<Campo | "geral", string>;

  const lista = turnos === "erro" ? [] : turnos;
  const admissao = dados.vinculo.dataAdmissao;
  // O primeiro dia livre depois das escalas já encerradas.
  const livre = dados.escalas.reduce<string | null>(
    (maior, e) =>
      e.vigenciaFim !== null && (maior === null || e.vigenciaFim > maior)
        ? e.vigenciaFim
        : maior,
    null,
  );
  const minimo = [
    admissao,
    livre,
    modo === "alterar" ? (aberta?.vigenciaInicio ?? null) : null,
  ]
    .filter((d): d is string => d !== null)
    .reduce((maior, d) => (d > maior ? d : maior), admissao);
  const valeInicial = hoje > minimo ? hoje : minimo;
  const inicial = {
    modelo: aberta?.modelo ?? modeloDe(dados.escalaDoCadastro)?.codigo ?? "5x2",
    turno: aberta
      ? (aberta.turno?.id ?? SEM_TURNO)
      : (lista[0]?.id ?? SEM_TURNO),
    noite: aberta?.turnoNoite?.id ?? MESMO_TURNO,
    folga: aberta?.folgaSemanal ?? 7,
    dias:
      aberta && aberta.diasTrabalho.length > 0
        ? aberta.diasTrabalho
        : [1, 2, 3, 4, 5],
    ciclo: aberta?.inicioCiclo ?? valeInicial,
    vale: valeInicial,
  };

  const [modelo, setModelo] = useState(inicial.modelo);
  const [turnoId, setTurnoId] = useState(inicial.turno);
  const [noiteId, setNoiteId] = useState(inicial.noite);
  const [folga, setFolga] = useState<number>(inicial.folga);
  const [dias, setDias] = useState<number[]>([...inicial.dias]);
  const [ciclo, setCiclo] = useState(inicial.ciclo);
  const [vale, setVale] = useState(inicial.vale);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const focoRef = useRef<string | null>(null);

  useEffect(() => {
    const alvo = focoRef.current;
    if (alvo === null) return;
    focoRef.current = null;
    const el = document.getElementById(alvo);
    (el?.matches("fieldset")
      ? el.querySelector<HTMLElement>("input")
      : el
    )?.focus();
  });

  const m = modeloDe(modelo);
  const comCiclo = temCiclo(modelo);
  const eDoze = modelo === "12x36";
  const turnoEscolhido = lista.find((t) => t.id === turnoId) ?? null;
  const noiteEscolhida = eDoze
    ? (lista.find((t) => t.id === noiteId) ?? null)
    : null;

  const alterado =
    modelo !== inicial.modelo ||
    turnoId !== inicial.turno ||
    noiteId !== inicial.noite ||
    folga !== inicial.folga ||
    dias.join() !== inicial.dias.join() ||
    ciclo !== inicial.ciclo ||
    vale !== inicial.vale;

  const novo: PadraoDeEscala = {
    modelo,
    turno: turnoEscolhido?.periodos ?? null,
    turnoNoite: noiteEscolhida?.periodos ?? null,
    intervaloTurno: turnoEscolhido?.intervaloMinutos ?? 0,
    intervaloTurnoNoite: noiteEscolhida?.intervaloMinutos ?? 0,
    folgaSemanal: modelo === "6x1" ? folga : null,
    diasTrabalho: modelo === "outra" ? dias : [],
    inicioCiclo: comCiclo ? ciclo || vale : null,
    vigenciaInicio: vale || hoje,
  };
  const dataBase = vale || hoje;
  // T215 — CLT e EC 141/2026: avisos na própria gaveta, sem impedir salvar.
  const avisosLegais = avisosDaJornada(
    novo,
    jornadaPorSemana(jornadaContratoHoras, dataBase) / 60,
    dataBase,
  );
  const antes = aberta;
  const modeloAntes = antes?.modelo ?? dados.escalaDoCadastro;

  function limpar(campo: Campo) {
    setErros((atual) => {
      const resto = { ...atual };
      delete resto[campo];
      return resto;
    });
  }

  function focarPrimeiro(e: Erros) {
    const campo = [...ORDEM_DOS_CAMPOS, "geral" as const].find((c) => e[c]);
    focoRef.current = campo ? ids[campo] : null;
  }

  async function gravar(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando) return;
    const locais: Erros = {};
    if (modelo === "outra" && dias.length === 0) {
      locais.diasTrabalho = "Escolha ao menos um dia de trabalho.";
    }
    if (comCiclo && !ciclo) {
      locais.inicioCiclo = "Informe o início do ciclo.";
    }
    if (!vale) {
      locais.vigenciaInicio = "Informe a data em que a escala passa a valer.";
    } else if (vale < admissao) {
      locais.vigenciaInicio = `A escala não pode começar antes da admissão (${formatarDiaCivil(admissao)}).`;
    } else if (livre !== null && vale < livre) {
      locais.vigenciaInicio = `Já existe escala até ${formatarDiaCivil(diaAnteriorCivil(livre))}. A nova precisa começar a partir de ${formatarDiaCivil(livre)}.`;
    } else if (modo === "alterar" && aberta && vale < aberta.vigenciaInicio) {
      locais.vigenciaInicio = `A nova escala não pode começar antes de ${formatarDiaCivil(aberta.vigenciaInicio)}, início da atual.`;
    }
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      focarPrimeiro(locais);
      return;
    }
    const dto: DefinirEscalaDto = {
      modelo,
      tabelaHorarioId: turnoId === SEM_TURNO ? null : turnoId,
      ...(eDoze && noiteId !== MESMO_TURNO ? { turnoNoiteId: noiteId } : {}),
      ...(modelo === "6x1" ? { folgaSemanal: folga } : {}),
      ...(modelo === "outra"
        ? { diasTrabalho: [...dias].sort((a, b) => a - b) }
        : {}),
      ...(comCiclo ? { inicioCiclo: ciclo } : {}),
      vigenciaInicio: vale,
    };
    setEnviando(true);
    setErros({});
    try {
      await servico.definir(colaboradorId, dto);
      onGravado(
        modo === "alterar"
          ? "Padrão de escala alterado"
          : "Padrão de escala definido",
        `Vale a partir de ${formatarDiaCivil(vale)}.`,
      );
    } catch (erro) {
      const recusa = errosDaRecusa(erro);
      setErros(recusa);
      focarPrimeiro(recusa);
    } finally {
      setEnviando(false);
    }
  }

  const descreve = (campo: Campo, ajuda?: boolean): string | undefined =>
    erros[campo]
      ? `${ids[campo]}-erro`
      : ajuda
        ? `${ids[campo]}-ajuda`
        : undefined;

  const opcaoDoTurno = (t: TabelaHorarioApi) => ({
    valor: t.id,
    nome: t.nome,
    descricao: descricaoDoTurno(t.periodos, t.intervaloMinutos),
    cor: COR_DO_TURNO,
  });
  const gruposDeEscala: GrupoRico[] = GRUPOS_DE_ESCALA.map((grupo) => ({
    rotulo: grupo,
    opcoes: MODELOS_DE_ESCALA.filter((x) => x.grupo === grupo).map((x) => ({
      valor: x.codigo,
      nome: x.nome,
      descricao: x.descricao,
    })),
  }));
  const gruposDeTurno: GrupoRico[] = [
    ...(lista.length > 0 ? [{ opcoes: lista.map(opcaoDoTurno) }] : []),
    { opcoes: [{ valor: SEM_TURNO, nome: "Sem turno fixo" }] },
  ];
  const gruposDaNoite: GrupoRico[] = [
    ...(lista.length > 0 ? [{ opcoes: lista.map(opcaoDoTurno) }] : []),
    {
      opcoes: [
        { valor: MESMO_TURNO, nome: "Mesmo turno em todos os plantões" },
      ],
    },
  ];

  const nomeDoModelo = (c: string | null) =>
    c ? (modeloDe(c)?.nome ?? c) : VAZIO;
  const linhas: [string, string, string][] = [
    ["Escala", nomeDoModelo(modeloAntes), m?.nome ?? modelo],
    [
      "Turno",
      antes ? curtoDoTurno(antes.turno) : VAZIO,
      curtoDoTurno(turnoEscolhido),
    ],
    [
      "Horas por semana",
      antes ? formatarHoras(horasPorSemana(padraoDe(antes), dataBase)) : VAZIO,
      formatarHoras(horasPorSemana(novo, dataBase)),
    ],
    [
      `Benefício em ${mesCurto(dataBase)}`,
      `${diasNoMes(modeloAntes, mesDe(dataBase))} dias`,
      `${diasNoMes(modelo, mesDe(dataBase))} dias`,
    ],
  ];
  // Como na referência: a escala sai do quadro quando não muda.
  const visiveis = linhas.filter(
    ([r, de, para]) => r !== "Escala" || de !== para,
  );

  const turnoDescritoPor = descreve("tabelaHorarioId", lista.length === 0);
  const noiteDescritaPor = descreve("turnoNoiteId", true);

  return (
    <Sheet
      aberto
      titulo={
        modo === "alterar"
          ? "Alterar padrão de escala"
          : "Definir padrão de escala"
      }
      subtitulo={[nome, detalhe].filter(Boolean).join(" · ")}
      icone={<span className="escala-gaveta__iniciais">{iniciais(nome)}</span>}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      className="escala-gaveta"
      rodape={
        <div className="escala-gaveta__rodape">
          {modo === "alterar" ? (
            <button
              type="button"
              className="escala-gaveta__encerrar"
              onClick={onEncerrar}
              disabled={enviando}
            >
              <IconeRemover tamanho={16} />
              Encerrar escala
            </button>
          ) : null}
          <FormActions>
            <Button type="button" variant="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={enviando}
              onClick={() => void gravar()}
            >
              {enviando ? "Salvando…" : "Salvar padrão"}
            </Button>
          </FormActions>
        </div>
      }
    >
      <form
        className="escala-gaveta__campos"
        noValidate
        onSubmit={(e) => void gravar(e)}
      >
        <div className="escala-gaveta__campo">
          <span className="escala-gaveta__rotulo-campo">Escala</span>
          <SeletorRico
            id={ids.modelo}
            rotulo="Escala"
            valor={modelo}
            grupos={gruposDeEscala}
            desabilitado={enviando}
            invalido={!!erros.modelo}
            {...(erros.modelo ? { descritoPor: `${ids.modelo}-erro` } : {})}
            onEscolher={(v) => {
              setModelo(v);
              limpar("modelo");
            }}
          />
          <Erro id={`${ids.modelo}-erro`} texto={erros.modelo} />
        </div>

        <div className="escala-gaveta__campo">
          <span className="escala-gaveta__rotulo-campo">Turno</span>
          <SeletorRico
            id={ids.tabelaHorarioId}
            rotulo="Turno"
            valor={turnoId}
            grupos={gruposDeTurno}
            desabilitado={enviando}
            invalido={!!erros.tabelaHorarioId}
            {...(turnoDescritoPor ? { descritoPor: turnoDescritoPor } : {})}
            onEscolher={(v) => {
              setTurnoId(v);
              limpar("tabelaHorarioId");
            }}
          />
          <Erro
            id={`${ids.tabelaHorarioId}-erro`}
            texto={erros.tabelaHorarioId}
          />
          {lista.length === 0 ? (
            <span
              id={`${ids.tabelaHorarioId}-ajuda`}
              className="escala-ficha__ajuda"
            >
              {turnos === "erro"
                ? "Não foi possível carregar os turnos."
                : "Nenhum turno ativo na empresa. Os turnos ficam em Jornadas de trabalho."}
            </span>
          ) : null}
        </div>

        {eDoze ? (
          <div className="escala-gaveta__campo">
            <span className="escala-gaveta__rotulo-campo">
              Turno da noite
              <span className="escala-ficha__opcional">Opcional</span>
            </span>
            <SeletorRico
              id={ids.turnoNoiteId}
              rotulo="Turno da noite"
              valor={noiteId}
              grupos={gruposDaNoite}
              desabilitado={enviando}
              {...(noiteDescritaPor ? { descritoPor: noiteDescritaPor } : {})}
              onEscolher={(v) => {
                setNoiteId(v);
                limpar("turnoNoiteId");
              }}
            />
            <Erro id={`${ids.turnoNoiteId}-erro`} texto={erros.turnoNoiteId} />
            <span
              id={`${ids.turnoNoiteId}-ajuda`}
              className="escala-ficha__ajuda"
            >
              Um mês de dia, o seguinte de noite, sempre com 36 h de descanso na
              troca. Sem turno da noite, todo plantão usa o turno acima.
            </span>
          </div>
        ) : null}

        {modelo === "6x1" ? (
          <fieldset
            id={ids.folgaSemanal}
            className="escala-gaveta__dias"
            role="radiogroup"
            aria-labelledby={`${ids.folgaSemanal}-legenda`}
            aria-describedby={descreve("folgaSemanal", true)}
          >
            <legend id={`${ids.folgaSemanal}-legenda`}>
              Folga semanal (DSR)
            </legend>
            <div className="escala-gaveta__dias-lista">
              {DIAS_DA_SEMANA.map((d) => (
                <label key={d.numero} className="escala-gaveta__dia">
                  <input
                    type="radio"
                    name={`${base}-folga`}
                    aria-label={d.nome}
                    checked={folga === d.numero}
                    disabled={enviando}
                    onChange={() => {
                      setFolga(d.numero);
                      limpar("folgaSemanal");
                    }}
                  />
                  <span aria-hidden="true">{d.curto}</span>
                </label>
              ))}
            </div>
            <Erro id={`${ids.folgaSemanal}-erro`} texto={erros.folgaSemanal} />
            <span
              id={`${ids.folgaSemanal}-ajuda`}
              className="escala-ficha__ajuda"
            >
              No comércio, a folga cai no domingo pelo menos a cada 3 semanas
              (Lei 10.101/2000).
            </span>
          </fieldset>
        ) : null}

        {modelo === "outra" ? (
          <fieldset
            id={ids.diasTrabalho}
            className="escala-gaveta__dias"
            aria-describedby={descreve("diasTrabalho")}
          >
            <legend>Dias de trabalho</legend>
            <div className="escala-gaveta__dias-lista">
              {DIAS_DA_SEMANA.map((d) => (
                <label key={d.numero} className="escala-gaveta__dia">
                  <input
                    type="checkbox"
                    aria-label={d.nome}
                    checked={dias.includes(d.numero)}
                    disabled={enviando}
                    aria-invalid={erros.diasTrabalho ? "true" : undefined}
                    onChange={(e) => {
                      setDias((atual) =>
                        e.target.checked
                          ? [...atual, d.numero]
                          : atual.filter((n) => n !== d.numero),
                      );
                      limpar("diasTrabalho");
                    }}
                  />
                  <span aria-hidden="true">{d.curto}</span>
                </label>
              ))}
            </div>
            <Erro id={`${ids.diasTrabalho}-erro`} texto={erros.diasTrabalho} />
          </fieldset>
        ) : null}

        {comCiclo ? (
          <div className="escala-gaveta__campo">
            <label htmlFor={ids.inicioCiclo}>Início do ciclo</label>
            <input
              id={ids.inicioCiclo}
              type="date"
              value={ciclo}
              disabled={enviando}
              aria-describedby={descreve("inicioCiclo", true)}
              aria-invalid={erros.inicioCiclo ? "true" : undefined}
              onChange={(e) => {
                setCiclo(e.target.value);
                limpar("inicioCiclo");
              }}
            />
            <Erro id={`${ids.inicioCiclo}-erro`} texto={erros.inicioCiclo} />
            <span
              id={`${ids.inicioCiclo}-ajuda`}
              className="escala-ficha__ajuda"
            >
              Primeiro dia de trabalho do ciclo. Muda em que dias caem as
              folgas.
            </span>
          </div>
        ) : null}

        <div className="escala-gaveta__campo">
          <label htmlFor={ids.vigenciaInicio}>Vale a partir de</label>
          <input
            id={ids.vigenciaInicio}
            type="date"
            value={vale}
            min={admissao}
            disabled={enviando}
            aria-describedby={descreve("vigenciaInicio", true)}
            aria-invalid={erros.vigenciaInicio ? "true" : undefined}
            onChange={(e) => {
              setVale(e.target.value);
              limpar("vigenciaInicio");
            }}
          />
          <Erro
            id={`${ids.vigenciaInicio}-erro`}
            texto={erros.vigenciaInicio}
          />
          <span
            id={`${ids.vigenciaInicio}-ajuda`}
            className="escala-ficha__ajuda"
          >
            Dias já publicados não mudam. O quadro usa o padrão novo a partir
            dessa data.
          </span>
        </div>

        <section
          className="escala-gaveta__muda"
          aria-labelledby={`${base}-muda`}
        >
          <h4 id={`${base}-muda`} className="escala-gaveta__muda-titulo">
            O que muda
          </h4>
          <dl className="escala-gaveta__muda-lista">
            {visiveis.map(([rotulo, de, para]) => (
              <div key={rotulo} className="escala-gaveta__muda-linha">
                <dt>{rotulo}</dt>
                <dd>
                  <span className="escala-gaveta__antes">{de}</span>
                  <span className="escala-gaveta__seta" aria-hidden="true">
                    ›
                  </span>
                  <span className="ev:sr-only"> passa a </span>
                  <strong
                    className={de === para ? "escala-gaveta__igual" : undefined}
                  >
                    {para}
                  </strong>
                </dd>
              </div>
            ))}
          </dl>
        </section>
        {avisosLegais.length > 0 ? (
          <div
            role="note"
            aria-labelledby={`${base}-legislacao`}
            className="escala-gaveta__legislacao"
          >
            <p
              id={`${base}-legislacao`}
              className="escala-gaveta__legislacao-titulo"
            >
              Atenção à legislação
            </p>
            <ul>
              {avisosLegais.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="escala-ficha__ajuda">
          Dias com férias ou ausência aprovada não mudam. Os benefícios só mudam
          quando a escala for publicada.
        </p>

        {erros.geral ? (
          <p
            id={ids.geral}
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
  colaboradorId,
  nome,
  detalhe,
  escala,
  servico,
  onFechar,
  onGravado,
}: {
  readonly colaboradorId: string;
  readonly nome: string;
  readonly detalhe: string | undefined;
  readonly escala: EscalaApi;
  readonly servico: ServicoDeEscala;
  readonly onFechar: () => void;
  readonly onGravado: (titulo: string, texto: string) => void;
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
    else if (ultimo < escala.vigenciaInicio) {
      local = `O último dia não pode ser antes de ${formatarDiaCivil(escala.vigenciaInicio)}, início da escala.`;
    }
    if (local) {
      setErros({ vigenciaFim: local });
      focoRef.current = idData;
      return;
    }
    setEnviando(true);
    setErros({});
    try {
      await servico.encerrar(colaboradorId, escala.id, proximoDiaCivil(ultimo));
      onGravado(
        "Escala encerrada",
        `O último dia nela é ${formatarDiaCivil(ultimo)}.`,
      );
    } catch (erro) {
      const recusa = errosDaRecusa(erro);
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
      subtitulo={[nome, detalhe].filter(Boolean).join(" · ")}
      icone={<span className="escala-gaveta__iniciais">{iniciais(nome)}</span>}
      descricao={`Informe o último dia na escala ${modeloDe(escala.modelo)?.nome ?? escala.modelo}, que começou em ${formatarDiaCivil(escala.vigenciaInicio)}. Ela continua no histórico.`}
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
            min={escala.vigenciaInicio}
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
