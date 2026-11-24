/**
 * T215 — aba Escala da ficha do colaborador: o PADRÃO DE ESCALA, com
 * vigência.
 *
 * - **Escala atual:** o modelo (5x2, 6x1, semana espanhola, revezamentos,
 *   plantões, embarque ou "outra"), o turno, o turno da noite (12x36), a
 *   folga semanal (6x1), os dias de trabalho ("outra"), o início do ciclo,
 *   as horas por semana, os dias para benefícios no mês e a vigência; e os
 *   próximos 14 dias, com trabalho e folga.
 * - **Histórico de escalas:** da mais nova à mais antiga.
 * - **Definir/Alterar padrão de escala** (gaveta): cada modelo mostra só os
 *   campos dele, e "O que muda" compara antes e depois.
 * - **Encerrar escala:** o último dia na escala.
 *
 * RH e DP (`podeOperar`) definem, alteram e encerram; os demais só leem. Os
 * turnos são as jornadas ativas da empresa (Jornadas de trabalho).
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
import { IconeCalendario, IconeRelogio } from "../../../../ui/icones";
import {
  AvisoAnimado,
  Esqueleto,
  Revelar,
  ehAvisoDeFalha,
} from "../../../../ui/movimento";
import { formatarDiaCivil } from "../../../../format/data";
import {
  diaAnteriorCivil,
  diaDeHoje,
  proximoDiaCivil,
  rotuloDaJornada,
} from "../../jornadaColaborador";
import {
  type PadraoDeEscala,
  diasNoMes,
  formatarHoras,
  horasPorSemana,
  proximosDias,
} from "./calendarioDaEscala";
import {
  DIAS_DA_SEMANA,
  GRUPOS_DE_ESCALA,
  MODELOS_DE_ESCALA,
  modeloDe,
  temCiclo,
} from "./modelosDeEscala";
import { formatarDuracao, gradeDaSemana } from "./resumoDaEscala";
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
  /** RH e DP: definir, alterar e encerrar. */
  readonly podeOperar: boolean;
  /** Abre Jornadas de trabalho (criar ou ajustar turnos). */
  readonly onAbrirJornadas?: () => void;
  /** Dia civil de hoje (testes). */
  readonly hoje?: string;
  readonly servico?: ServicoDeEscala;
}

const VAZIO = "—";
const SEM_TURNO = "sem";
const MESES = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "maio",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];
const DIAS_CURTOS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

type Situacao = "vigente" | "programada" | "encerrada";
const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: "Vigente",
  programada: "Programada",
  encerrada: "Encerrada",
};

type Turno = {
  codigo: string | null;
  nome: string;
  periodos: { dia: string; inicio: string; fim: string }[];
};

function situacaoDe(e: EscalaApi, hoje: string): Situacao {
  if (e.vigenciaInicio > hoje) return "programada";
  if (e.vigenciaFim !== null && e.vigenciaFim <= hoje) return "encerrada";
  return "vigente";
}

/** "09:00–18:00 · 1 h de intervalo". */
export function descricaoDoTurno(periodos: Turno["periodos"]): string {
  const dia = gradeDaSemana(periodos).find((d) => d.minutos > 0);
  if (!dia) return "sem horário";
  const faixa = `${dia.periodos[0]!.inicio}–${dia.periodos[dia.periodos.length - 1]!.fim}`;
  return dia.intervalo === 0
    ? `${faixa} · sem intervalo`
    : `${faixa} · ${formatarDuracao(dia.intervalo)} de intervalo`;
}

function nomeDoTurno(t: Turno | null): string {
  return t ? rotuloDaJornada(t) : "Sem turno fixo";
}

function curtoDoTurno(t: Turno | null): string {
  if (!t) return "Sem turno";
  const dia = gradeDaSemana(t.periodos).find((d) => d.minutos > 0);
  const faixa = dia
    ? ` ${dia.periodos[0]!.inicio}–${dia.periodos[dia.periodos.length - 1]!.fim}`
    : "";
  return `${t.nome}${faixa}`;
}

function listaDeDias(dias: readonly number[]): string {
  const nomes = dias.map(
    (n) => DIAS_DA_SEMANA.find((d) => d.numero === n)?.nome ?? "",
  );
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function padraoDe(e: EscalaApi): PadraoDeEscala {
  return {
    modelo: e.modelo,
    turno: e.turno?.periodos ?? null,
    turnoNoite: e.turnoNoite?.periodos ?? null,
    folgaSemanal: e.folgaSemanal,
    diasTrabalho: e.diasTrabalho,
    inicioCiclo: e.inicioCiclo,
    vigenciaInicio: e.vigenciaInicio,
  };
}

function mesDe(dia: string): string {
  return dia.slice(0, 7);
}

function rotuloDoMes(dia: string): string {
  return MESES[Number(dia.slice(5, 7)) - 1]!;
}

/** Detalhes do padrão que só alguns modelos têm. */
function particularidades(e: EscalaApi): string[] {
  const itens: string[] = [];
  if (e.folgaSemanal !== null) {
    itens.push(`Folga semanal: ${listaDeDias([e.folgaSemanal])}`);
  }
  if (e.diasTrabalho.length > 0) {
    itens.push(`Dias de trabalho: ${listaDeDias(e.diasTrabalho)}`);
  }
  if (e.turnoNoite) itens.push(`Turno da noite: ${nomeDoTurno(e.turnoNoite)}`);
  if (e.inicioCiclo) {
    itens.push(`Início do ciclo: ${formatarDiaCivil(e.inicioCiclo)}`);
  }
  return itens;
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
  podeOperar,
  onAbrirJornadas,
  hoje = diaDeHoje(),
  servico = servicoDeEscalaDoServidor,
}: Props) {
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [gaveta, setGaveta] = useState<Gaveta>(null);
  const [aviso, setAviso] = useState("");
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

  const gravado = (mensagem: string) => {
    focarTitulo.current = true;
    setGaveta(null);
    setAviso(mensagem);
    void carregar(true);
  };

  const verJornadas = onAbrirJornadas ? (
    <Button type="button" variant="secondary" onClick={onAbrirJornadas}>
      Ver jornadas de trabalho
    </Button>
  ) : null;

  const acoes = podeOperar ? (
    aberta ? (
      <>
        <Button type="button" onClick={() => setGaveta("alterar")}>
          Alterar escala
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setGaveta("encerrar")}
        >
          Encerrar escala
        </Button>
      </>
    ) : (
      <Button type="button" onClick={() => setGaveta("definir")}>
        Definir escala
      </Button>
    )
  ) : null;

  return (
    <Revelar>
      <div className="escala-ficha">
        {escalas.length === 0 ? (
          <section className="ficha-ref__cartao escala-ficha__vazio">
            <span className="ficha-ref__cartao-icone" aria-hidden="true">
              <IconeRelogio tamanho={18} />
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
                ? `Hoje vale a escala do cadastro (${cadastro.nome}): os benefícios pagos por dia usam os dias dela no mês. Defina o padrão aqui para guardar o turno e a vigência.`
                : "Sem escala, os benefícios pagos por dia usam os dias úteis do mês. Defina a escala aqui; os turnos ficam em Jornadas de trabalho."}
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
              escalas={escalas}
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
            {(atual ?? programada) ? (
              <ProximosDias escala={(atual ?? programada)!} hoje={hoje} />
            ) : null}
            <Historico escalas={escalas} hoje={hoje} />
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

        {gaveta === "definir" || gaveta === "alterar" ? (
          <GavetaDoPadrao
            modo={gaveta}
            colaboradorId={colaboradorId}
            nome={nome}
            dados={dados}
            aberta={aberta}
            turnos={turnos}
            hoje={hoje}
            servico={servico}
            {...(onAbrirJornadas ? { onAbrirJornadas } : {})}
            onFechar={() => setGaveta(null)}
            onGravado={gravado}
          />
        ) : null}
        {gaveta === "encerrar" && aberta ? (
          <GavetaDeEncerramento
            colaboradorId={colaboradorId}
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

// ------------------------------------------------------------ Escala atual

function Metricas({
  e,
  hoje,
}: {
  readonly e: EscalaApi;
  readonly hoje: string;
}) {
  const p = padraoDe(e);
  const ultimo = e.vigenciaFim ? diaAnteriorCivil(e.vigenciaFim) : null;
  const base = e.vigenciaInicio > hoje ? e.vigenciaInicio : hoje;
  const itens: [string, ReactNode][] = [
    [
      "Turno",
      e.turno ? (
        <>
          {nomeDoTurno(e.turno)}
          <span className="escala-ficha__sub">
            {descricaoDoTurno(e.turno.periodos)}
          </span>
        </>
      ) : (
        "Sem turno fixo"
      ),
    ],
  ];
  if (e.turnoNoite) {
    itens.push([
      "Turno da noite",
      <>
        {nomeDoTurno(e.turnoNoite)}
        <span className="escala-ficha__sub">
          {descricaoDoTurno(e.turnoNoite.periodos)}
        </span>
      </>,
    ]);
  }
  if (e.folgaSemanal !== null) {
    itens.push(["Folga semanal (DSR)", listaDeDias([e.folgaSemanal])]);
  }
  if (e.diasTrabalho.length > 0) {
    itens.push(["Dias de trabalho", listaDeDias(e.diasTrabalho)]);
  }
  if (e.inicioCiclo) {
    itens.push(["Início do ciclo", formatarDiaCivil(e.inicioCiclo)]);
  }
  itens.push(
    ["Horas por semana", formatarHoras(horasPorSemana(p, base))],
    [
      `Benefício em ${rotuloDoMes(base)}`,
      `${diasNoMes(e.modelo, mesDe(base))} dias`,
    ],
    ["Vale desde", formatarDiaCivil(e.vigenciaInicio)],
    ["Termina em", ultimo ? formatarDiaCivil(ultimo) : "Sem término"],
  );
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

function CabecaDoModelo({
  e,
  situacao,
}: {
  readonly e: EscalaApi;
  readonly situacao: Situacao;
}) {
  const m = modeloDe(e.modelo);
  return (
    <div className="escala-ficha__modelo">
      <p className="escala-ficha__modelo-nome">
        <strong>{m?.nome ?? e.modelo}</strong>
        <span className={`escala-ficha__selo escala-ficha__selo--${situacao}`}>
          {ROTULO_SITUACAO[situacao]}
        </span>
        {e.turno && !e.turno.ativo ? (
          <span className="escala-ficha__selo escala-ficha__selo--alerta">
            Turno inativo
          </span>
        ) : null}
      </p>
      {m ? <p className="escala-ficha__sub">{m.descricao}</p> : null}
    </div>
  );
}

function EscalaAtual({
  idTitulo,
  atual,
  programada,
  escalas,
  hoje,
  acoes,
}: {
  readonly idTitulo: string;
  readonly atual: EscalaApi | null;
  readonly programada: EscalaApi | null;
  readonly escalas: EscalaApi[];
  readonly hoje: string;
  readonly acoes: ReactNode;
}) {
  const ultimaEncerrada = escalas.find(
    (e) => situacaoDe(e, hoje) === "encerrada",
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
            <CabecaDoModelo e={atual} situacao="vigente" />
            <Metricas e={atual} hoje={hoje} />
          </>
        ) : (
          <p className="escala-ficha__sem-vigente">
            {ultimaEncerrada && !programada && ultimaEncerrada.vigenciaFim
              ? `Sem escala vigente hoje. A última terminou em ${formatarDiaCivil(diaAnteriorCivil(ultimaEncerrada.vigenciaFim))}.`
              : "Sem escala vigente hoje."}
          </p>
        )}
        {programada ? (
          <p className="escala-ficha__programada">
            <IconeCalendario tamanho={16} />
            <span>
              {`A partir de ${formatarDiaCivil(programada.vigenciaInicio)}: ${modeloDe(programada.modelo)?.nome ?? programada.modelo} · ${nomeDoTurno(programada.turno)}.`}
            </span>
          </p>
        ) : null}
        {acoes}
      </div>
    </section>
  );
}

// ---------------------------------------------------------- Próximos dias

function ProximosDias({
  escala,
  hoje,
}: {
  readonly escala: EscalaApi;
  readonly hoje: string;
}) {
  const id = useId();
  const inicio = escala.vigenciaInicio > hoje ? escala.vigenciaInicio : hoje;
  const fim = escala.vigenciaFim;
  const dias = proximosDias(padraoDe(escala), inicio, 14);
  return (
    <section
      className="ficha-ref__cartao escala-ficha__proximos"
      aria-labelledby={`${id}-titulo`}
    >
      <header className="ficha-ref__cartao-cabeca">
        <span className="ficha-ref__cartao-icone" aria-hidden="true">
          <IconeCalendario tamanho={18} />
        </span>
        <h3 id={`${id}-titulo`} className="escala-ficha__titulo">
          Próximos 14 dias
        </h3>
      </header>
      <ul className="escala-ficha__dias" aria-label="Próximos 14 dias">
        {dias.map((d) => {
          const fora = fim !== null && d.dia >= fim;
          const semana = new Date(`${d.dia}T12:00:00Z`).getUTCDay() || 7;
          const turno =
            d.trabalho === "noite" ? escala.turnoNoite : escala.turno;
          return (
            <li
              key={d.dia}
              className={`escala-ficha__dia${d.trabalho && !fora ? "" : " escala-ficha__dia--folga"}`}
            >
              <span className="escala-ficha__dia-data">
                <span>{DIAS_CURTOS[semana]}</span>
                <strong>{formatarDiaCivil(d.dia).slice(0, 5)}</strong>
              </span>
              {fora ? (
                <span className="escala-ficha__dia-estado">Sem escala</span>
              ) : d.trabalho ? (
                <span className="escala-ficha__dia-estado">
                  {`Trabalho · ${curtoDoTurno(turno)}`}
                  {d.trabalho === "noite" ? " (noite)" : ""}
                </span>
              ) : (
                <span className="escala-ficha__dia-estado">Folga</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// -------------------------------------------------------------- Histórico

function Historico({
  escalas,
  hoje,
}: {
  readonly escalas: EscalaApi[];
  readonly hoje: string;
}) {
  const id = useId();
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
        {escalas.map((e) => {
          const situacao = situacaoDe(e, hoje);
          const ultimo = e.vigenciaFim ? diaAnteriorCivil(e.vigenciaFim) : null;
          const base = e.vigenciaInicio;
          return (
            <li
              key={e.id}
              className={`escala-ficha__linha escala-ficha__linha--${situacao}`}
            >
              <span className="escala-ficha__marca" aria-hidden="true" />
              <div className="escala-ficha__linha-corpo">
                <CabecaDoModelo e={e} situacao={situacao} />
                <p className="escala-ficha__linha-detalhe">
                  {ultimo
                    ? `${formatarDiaCivil(e.vigenciaInicio)} a ${formatarDiaCivil(ultimo)}`
                    : `Desde ${formatarDiaCivil(e.vigenciaInicio)}`}
                  {` · ${nomeDoTurno(e.turno)} · ${formatarHoras(horasPorSemana(padraoDe(e), base))} por semana`}
                </p>
                {particularidades(e).length > 0 ? (
                  <p className="escala-ficha__linha-detalhe">
                    {particularidades(e).join(" · ")}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
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
    "A nova escala precisa começar depois do início da atual.",
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

function GavetaDoPadrao({
  modo,
  colaboradorId,
  nome,
  dados,
  aberta,
  turnos,
  hoje,
  servico,
  onAbrirJornadas,
  onFechar,
  onGravado,
}: {
  readonly modo: "definir" | "alterar";
  readonly colaboradorId: string;
  readonly nome: string;
  readonly dados: EscalasDoColaboradorApi;
  readonly aberta: EscalaApi | null;
  readonly turnos: TabelaHorarioApi[] | "erro";
  readonly hoje: string;
  readonly servico: ServicoDeEscala;
  readonly onAbrirJornadas?: () => void;
  readonly onFechar: () => void;
  readonly onGravado: (mensagem: string) => void;
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
  // Ao alterar, a nova começa no mínimo no dia seguinte ao início da atual.
  const depoisDaAtual =
    modo === "alterar" && aberta
      ? proximoDiaCivil(aberta.vigenciaInicio)
      : null;
  const valeInicial = [hoje, admissao, livre, depoisDaAtual].reduce<string>(
    (maior, d) => (d !== null && d > maior ? d : maior),
    hoje,
  );
  const inicial = {
    modelo: aberta?.modelo ?? modeloDe(dados.escalaDoCadastro)?.codigo ?? "5x2",
    turno: aberta
      ? (aberta.turno?.id ?? SEM_TURNO)
      : (lista[0]?.id ?? SEM_TURNO),
    noite: aberta?.turnoNoite?.id ?? "",
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
    folgaSemanal: modelo === "6x1" ? folga : null,
    diasTrabalho: modelo === "outra" ? dias : [],
    inicioCiclo: comCiclo ? ciclo || vale : null,
    vigenciaInicio: vale || hoje,
  };
  const dataBase = vale || hoje;
  const antes = modo === "alterar" ? aberta : null;

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
    } else if (modo === "alterar" && aberta && vale <= aberta.vigenciaInicio) {
      locais.vigenciaInicio = `A nova escala precisa começar depois de ${formatarDiaCivil(aberta.vigenciaInicio)}, início da atual.`;
    }
    if (Object.keys(locais).length > 0) {
      setErros(locais);
      focarPrimeiro(locais);
      return;
    }
    const dto: DefinirEscalaDto = {
      modelo,
      tabelaHorarioId: turnoId === SEM_TURNO ? null : turnoId,
      ...(eDoze && noiteId ? { turnoNoiteId: noiteId } : {}),
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
          ? `Escala alterada a partir de ${formatarDiaCivil(vale)}. A anterior fica no histórico.`
          : `Escala definida a partir de ${formatarDiaCivil(vale)}.`,
      );
    } catch (erro) {
      const recusa = errosDaRecusa(erro);
      setErros(recusa);
      focarPrimeiro(recusa);
    } finally {
      setEnviando(false);
    }
  }

  const descreve = (campo: Campo, ajuda?: boolean) =>
    erros[campo]
      ? `${ids[campo]}-erro`
      : ajuda
        ? `${ids[campo]}-ajuda`
        : undefined;

  const horasAntes = antes
    ? formatarHoras(horasPorSemana(padraoDe(antes), dataBase))
    : VAZIO;
  const linhas: [string, string, string][] = [
    [
      "Escala",
      antes ? (modeloDe(antes.modelo)?.nome ?? antes.modelo) : VAZIO,
      m?.nome ?? modelo,
    ],
    [
      "Turno",
      antes ? curtoDoTurno(antes.turno) : VAZIO,
      curtoDoTurno(turnoEscolhido),
    ],
    [
      "Horas por semana",
      horasAntes,
      formatarHoras(horasPorSemana(novo, dataBase)),
    ],
    [
      `Benefício em ${rotuloDoMes(dataBase)}`,
      `${diasNoMes(antes?.modelo ?? null, mesDe(dataBase))} dias`,
      `${diasNoMes(modelo, mesDe(dataBase))} dias`,
    ],
  ];

  return (
    <Sheet
      aberto
      titulo={
        modo === "alterar"
          ? "Alterar padrão de escala"
          : "Definir padrão de escala"
      }
      descricao={nome}
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
            {enviando ? "Salvando…" : "Salvar padrão"}
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
          <label htmlFor={ids.modelo}>Escala</label>
          <select
            id={ids.modelo}
            value={modelo}
            disabled={enviando}
            aria-describedby={descreve("modelo", true)}
            aria-invalid={erros.modelo ? "true" : undefined}
            onChange={(e) => {
              setModelo(e.target.value);
              limpar("modelo");
            }}
          >
            {GRUPOS_DE_ESCALA.map((grupo) => (
              <optgroup key={grupo} label={grupo}>
                {MODELOS_DE_ESCALA.filter((x) => x.grupo === grupo).map((x) => (
                  <option key={x.codigo} value={x.codigo}>
                    {x.nome}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Erro id={`${ids.modelo}-erro`} texto={erros.modelo} />
          <span id={`${ids.modelo}-ajuda`} className="escala-ficha__ajuda">
            {m?.descricao}
          </span>
        </div>

        <div className="escala-gaveta__campo">
          <label htmlFor={ids.tabelaHorarioId}>Turno</label>
          <select
            id={ids.tabelaHorarioId}
            value={turnoId}
            disabled={enviando}
            aria-describedby={descreve("tabelaHorarioId", true)}
            aria-invalid={erros.tabelaHorarioId ? "true" : undefined}
            onChange={(e) => {
              setTurnoId(e.target.value);
              limpar("tabelaHorarioId");
            }}
          >
            {lista.map((t) => (
              <option key={t.id} value={t.id}>
                {`${rotuloDaJornada(t)} · ${descricaoDoTurno(t.periodos)}`}
              </option>
            ))}
            <option value={SEM_TURNO}>Sem turno fixo</option>
          </select>
          <Erro
            id={`${ids.tabelaHorarioId}-erro`}
            texto={erros.tabelaHorarioId}
          />
          <span
            id={`${ids.tabelaHorarioId}-ajuda`}
            className="escala-ficha__ajuda"
          >
            {turnos === "erro"
              ? "Não foi possível carregar os turnos."
              : lista.length === 0
                ? "Nenhum turno ativo na empresa."
                : "Os turnos são as jornadas ativas da empresa."}
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
              Criar ou ajustar turno
            </button>
          ) : null}
        </div>

        {eDoze ? (
          <div className="escala-gaveta__campo">
            <span className="escala-gaveta__rotulo">
              <label htmlFor={ids.turnoNoiteId}>Turno da noite</label>
              <span className="escala-ficha__opcional">Opcional</span>
            </span>
            <select
              id={ids.turnoNoiteId}
              value={noiteId}
              disabled={enviando}
              aria-describedby={descreve("turnoNoiteId", true)}
              aria-invalid={erros.turnoNoiteId ? "true" : undefined}
              onChange={(e) => {
                setNoiteId(e.target.value);
                limpar("turnoNoiteId");
              }}
            >
              <option value="">Mesmo turno em todos os plantões</option>
              {lista.map((t) => (
                <option key={t.id} value={t.id}>
                  {`${rotuloDaJornada(t)} · ${descricaoDoTurno(t.periodos)}`}
                </option>
              ))}
            </select>
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
            A escala anterior termina no dia anterior e continua no histórico.
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
            {linhas.map(([rotulo, de, para]) => (
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
          <p className="escala-ficha__ajuda">
            Os benefícios pagos por dia usam os dias de trabalho da escala no
            mês; sem escala, os dias úteis.
          </p>
        </section>

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
  escala,
  servico,
  onFechar,
  onGravado,
}: {
  readonly colaboradorId: string;
  readonly escala: EscalaApi;
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
        `Escala encerrada. O último dia nela é ${formatarDiaCivil(ultimo)}.`,
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
