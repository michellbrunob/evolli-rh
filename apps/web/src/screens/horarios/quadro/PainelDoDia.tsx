/**
 * T215 — o painel do dia do quadro da escala ("Abrir detalhes"), como o da
 * referência: a pessoa, o dia (com anterior e próximo), a semana e de onde
 * vem o dia; abas Trabalho, Folga, DSR, Sobreaviso e Ausência (esta vem de
 * Férias e ausências); turno, início, fim, intervalo, segundo período (turno
 * partido), sobreaviso depois do turno, local e observação; o resumo e os
 * avisos da CLT ao vivo (não impedem salvar). Salva no RASCUNHO.
 */
import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import type {
  GravarDiaDto,
  PeriodoDoDiaApi,
  PessoaDoQuadroApi,
} from "../../../api/escalaClient";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import type { UnidadeOrganizacionalApi } from "../../../api/organizacaoClient";
import { Button, Sheet } from "../../../ui";
import {
  diaPorExtensoComSemana,
  intervaloCurtoDeDias,
} from "../../../format/data";
import {
  formatarHoras,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { INTERVALOS } from "../turnos/turnos";
import {
  type CelulaDoQuadro,
  duracao,
  minutosDosPeriodos,
  periodosNoDia,
  segundaDaSemana,
} from "./quadroDaEscala";

export type AbaDoPainel = "trabalho" | "folga" | "dsr" | "sobreaviso";

/** O que pôr em evidência ao abrir (vindo do menu da célula). */
export type FocoDoPainel =
  | "inicio"
  | "segundo-periodo"
  | "sobreaviso"
  | "sobreaviso-depois"
  | "observacao";

interface Faixa {
  inicio: string;
  fim: string;
}

interface Formulario {
  aba: AbaDoPainel;
  turnoId: string;
  inicio: string;
  fim: string;
  intervalo: number;
  segundo: Faixa | null;
  depois: Faixa | null;
  sobreaviso: Faixa[];
  unidadeId: string;
  observacao: string;
}

const ROTULO_DA_ABA: Readonly<Record<AbaDoPainel, string>> = {
  trabalho: "Trabalho",
  folga: "Folga",
  dsr: "DSR",
  sobreaviso: "Sobreaviso",
};

const MAX_OBSERVACAO = 300;

function minutosDaHora(h: string): number {
  const [a, b] = h.split(":").map(Number);
  return (a ?? 0) * 60 + (b ?? 0);
}

/** O trecho corrido [início, fim) a partir da 00:00 do dia. */
function trecho(p: Faixa, base = 0): [number, number] {
  const i = minutosDaHora(p.inicio) + base;
  let f = minutosDaHora(p.fim) + base;
  if (f <= i) f += 24 * 60;
  return [i, f];
}

function completo(p: Faixa | null): p is Faixa {
  return !!p && /^\d{2}:\d{2}$/.test(p.inicio) && /^\d{2}:\d{2}$/.test(p.fim);
}

/** Os períodos do trabalho em sequência; `null` se o 2º cruza o 1º. */
function trechosDoTrabalho(f: Formulario): [number, number][] | null {
  const um = trecho({ inicio: f.inicio, fim: f.fim });
  if (!completo(f.segundo)) return [um];
  let dois = trecho(f.segundo);
  if (dois[0] < um[0]) dois = trecho(f.segundo, 24 * 60);
  return dois[0] < um[1] ? null : [um, dois];
}

function inicialDe(
  c: CelulaDoQuadro,
  turnos: readonly TabelaHorarioApi[],
  foco: FocoDoPainel | null,
): Formulario {
  const base: Formulario = {
    aba:
      c.tipo === "folga" || c.tipo === "dsr" || c.tipo === "sobreaviso"
        ? c.tipo
        : "trabalho",
    turnoId: c.turno?.id ?? "",
    inicio: c.periodos[0]?.inicio ?? "",
    fim: c.periodos[0]?.fim ?? "",
    intervalo: c.intervaloMinutos,
    segundo:
      c.tipo === "trabalho" && c.periodos[1] ? { ...c.periodos[1] } : null,
    depois:
      c.tipo === "trabalho" && c.sobreaviso[0] ? { ...c.sobreaviso[0] } : null,
    sobreaviso:
      c.tipo === "sobreaviso" ? c.periodos.map((p) => ({ ...p })) : [],
    unidadeId: c.unidade?.id ?? "",
    observacao: c.observacao ?? "",
  };
  // Trabalho sem horário (sem turno fixo ou dia que não era trabalho): o
  // primeiro turno da lista, no horário dele.
  if (base.aba === "trabalho" && !base.inicio && turnos[0]) {
    Object.assign(base, preencherDoTurno(turnos[0], c.dia));
  }
  if (base.aba === "trabalho" && !base.inicio) {
    base.inicio = "09:00";
    base.fim = "18:00";
  }
  if (foco === "segundo-periodo" && !base.segundo) {
    base.segundo = { inicio: "", fim: "" };
  }
  if (foco === "sobreaviso") {
    base.aba = "sobreaviso";
    if (base.sobreaviso.length === 0)
      base.sobreaviso = [{ inicio: "", fim: "" }];
  }
  if (foco === "sobreaviso-depois" && !base.depois && base.inicio) {
    base.depois = { inicio: base.fim, fim: base.inicio };
  }
  return base;
}

function preencherDoTurno(
  t: TabelaHorarioApi,
  dia: string,
): Pick<Formulario, "turnoId" | "inicio" | "fim" | "intervalo" | "segundo"> {
  const ps = periodosNoDia(
    { ...t, intervaloMinutos: t.intervaloMinutos ?? 0 },
    dia,
  );
  // O dia do quadro tem até 2 períodos (turno partido); um turno de 3
  // períodos traz os dois primeiros para o RH ajustar.
  return {
    turnoId: t.id,
    inicio: ps[0]?.inicio ?? "",
    fim: ps[0]?.fim ?? "",
    intervalo: ps.length === 1 ? (t.intervaloMinutos ?? 0) : 0,
    segundo: ps[1] ? { inicio: ps[1].inicio, fim: ps[1].fim } : null,
  };
}

function terminaNoDiaSeguinte(trechos: readonly [number, number][]): boolean {
  return trechos.some(([, f]) => f > 24 * 60);
}

/** Avisos da CLT para o dia (não impedem salvar). */
export function avisosDoDia(f: {
  aba: AbaDoPainel;
  periodos: readonly PeriodoDoDiaApi[];
  intervalo: number;
  sobreaviso: readonly PeriodoDoDiaApi[];
}): string[] {
  const avisos: string[] = [];
  if (f.aba === "trabalho" && f.periodos.length > 0) {
    const m = minutosDosPeriodos(f.periodos, f.intervalo);
    if (m > 10 * 60) {
      avisos.push(
        `${formatarHoras(m)} no dia: passa de 10 h (8 h normais + 2 h extras, CLT, art. 59).`,
      );
    }
    if (f.periodos.length === 1) {
      const bruto = duracao(f.periodos[0]!);
      if (bruto > 6 * 60 && (f.intervalo < 60 || f.intervalo > 120)) {
        avisos.push(
          "Turno com mais de 6 h de trabalho precisa de intervalo de 1 h a 2 h (CLT, art. 71).",
        );
      } else if (bruto > 4 * 60 && bruto <= 6 * 60 && f.intervalo < 15) {
        avisos.push(
          "Turno de 4 h a 6 h precisa de pausa de 15 min (CLT, art. 71, § 1º).",
        );
      }
    }
  }
  const sob = f.sobreaviso.reduce((t, p) => t + duracao(p), 0);
  if (sob > 24 * 60) {
    avisos.push("Sobreaviso acima de 24 h seguidas (CLT, art. 244, § 2º).");
  }
  return avisos;
}

const MENSAGEM_DA_RECUSA: Readonly<Record<string, string>> = {
  "periodos:sobreposta": "O 2º período não pode começar antes do fim do 1º.",
  "sobreaviso:sobreposta": "O sobreaviso começa no fim do turno ou depois.",
  "tabelaHorarioId:indisponivel": "Este turno não está mais disponível.",
  "unidadeOrganizacionalId:indisponivel":
    "Este local não está mais disponível.",
  "dia:fora_do_vinculo": "Este dia está fora do vínculo da pessoa na empresa.",
};

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError) {
    for (const e of erro.erros ?? []) {
      const m = MENSAGEM_DA_RECUSA[`${e.campo}:${e.motivo}`];
      if (m) return m;
    }
    if (erro.status === 403)
      return "Você não tem permissão para alterar a escala.";
  }
  return "Não foi possível salvar o dia. Tente de novo.";
}

export interface PainelDoDiaProps {
  readonly pessoa: PessoaDoQuadroApi;
  readonly celula: CelulaDoQuadro;
  readonly turnos: readonly TabelaHorarioApi[];
  readonly unidades: readonly UnidadeOrganizacionalApi[];
  readonly foco: FocoDoPainel | null;
  /** "TI · CLT · 6x1". */
  readonly subtitulo: string;
  readonly onSalvar: (
    dto: Omit<GravarDiaDto, "colaboradorId" | "dia">,
  ) => Promise<void>;
  readonly onLimpar: () => Promise<void>;
  readonly onTrocarDia: (dia: string) => void;
  readonly onVerSemana: (dia: string) => void;
  readonly onFechar: () => void;
}

export function PainelDoDia({
  pessoa,
  celula,
  turnos,
  unidades,
  foco,
  subtitulo,
  onSalvar,
  onLimpar,
  onTrocarDia,
  onVerSemana,
  onFechar,
}: PainelDoDiaProps) {
  const id = useId();
  const [inicial, setInicial] = useState(() => inicialDe(celula, turnos, foco));
  const [f, setF] = useState<Formulario>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const observacaoRef = useRef<HTMLTextAreaElement | null>(null);
  const segundoRef = useRef<HTMLInputElement | null>(null);
  const sobreavisoRef = useRef<HTMLInputElement | null>(null);
  const depoisRef = useRef<HTMLInputElement | null>(null);

  // Outro dia (anterior/próximo): recomeça do que está no quadro.
  useEffect(() => {
    const novo = inicialDe(celula, turnos, foco);
    setInicial(novo);
    setF(novo);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celula.dia, pessoa.colaboradorId]);

  // O campo que o menu pediu recebe o foco ao abrir (sem pedido, o título).
  const focoInicialRef =
    foco === "observacao"
      ? observacaoRef
      : foco === "segundo-periodo"
        ? segundoRef
        : foco === "sobreaviso"
          ? sobreavisoRef
          : foco === "sobreaviso-depois"
            ? depoisRef
            : undefined;

  const alterado = JSON.stringify(f) !== JSON.stringify(inicial);
  const mudar = (parcial: Partial<Formulario>) => {
    setErro(null);
    setF((atual) => ({ ...atual, ...parcial }));
  };

  const periodos: PeriodoDoDiaApi[] =
    f.aba === "trabalho"
      ? [
          ...(completo({ inicio: f.inicio, fim: f.fim })
            ? [{ inicio: f.inicio, fim: f.fim }]
            : []),
          ...(completo(f.segundo) ? [f.segundo] : []),
        ]
      : f.aba === "sobreaviso"
        ? f.sobreaviso.filter(completo)
        : [];
  const trechos = f.aba === "trabalho" ? trechosDoTrabalho(f) : null;
  const minutos =
    f.aba === "trabalho" && periodos.length > 0
      ? minutosDosPeriodos(periodos, periodos.length === 1 ? f.intervalo : 0)
      : 0;

  const problemas: string[] = [];
  if (f.aba === "trabalho") {
    if (!completo({ inicio: f.inicio, fim: f.fim })) {
      problemas.push("Informe o início e o fim do trabalho.");
    } else if (f.inicio === f.fim) {
      problemas.push("O início e o fim do trabalho não podem ser iguais.");
    }
    if (f.segundo && !completo(f.segundo)) {
      problemas.push("Informe o início e o fim do 2º período, ou remova-o.");
    } else if (trechos === null) {
      problemas.push(MENSAGEM_DA_RECUSA["periodos:sobreposta"]!);
    }
    if (f.depois && !completo(f.depois)) {
      problemas.push("Informe o início e o fim do sobreaviso, ou remova-o.");
    } else if (f.depois && trechos) {
      let s = trecho(f.depois);
      if (s[0] < trechos[0]![0]) s = trecho(f.depois, 24 * 60);
      if (s[0] < trechos[trechos.length - 1]![1]) {
        problemas.push(MENSAGEM_DA_RECUSA["sobreaviso:sobreposta"]!);
      }
    }
  }
  if (f.aba === "sobreaviso" && periodos.length === 0) {
    problemas.push("Informe o início e o fim do sobreaviso.");
  }

  const avisos = avisosDoDia({
    aba: f.aba,
    periodos,
    intervalo: periodos.length === 1 ? f.intervalo : 0,
    sobreaviso:
      f.aba === "sobreaviso" ? periodos : completo(f.depois) ? [f.depois] : [],
  });

  const salvar = async () => {
    if (problemas.length > 0) {
      setErro(problemas[0]!);
      return;
    }
    const comLocal = f.aba === "trabalho" || f.aba === "sobreaviso";
    const dto: Omit<GravarDiaDto, "colaboradorId" | "dia"> = {
      tipo: f.aba,
      ...(f.aba === "trabalho"
        ? {
            tabelaHorarioId: f.turnoId || null,
            periodos,
            intervaloMinutos: periodos.length === 1 ? f.intervalo : 0,
            sobreaviso: completo(f.depois) ? [f.depois] : [],
          }
        : {}),
      ...(f.aba === "sobreaviso" ? { periodos } : {}),
      ...(comLocal ? { unidadeOrganizacionalId: f.unidadeId || null } : {}),
      observacao: f.observacao.trim() || null,
    };
    setEnviando(true);
    try {
      await onSalvar(dto);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const limpar = async () => {
    setEnviando(true);
    try {
      await onLimpar();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const segunda = segundaDaSemana(celula.dia);
  const origem =
    celula.origem === "rascunho"
      ? "rascunho"
      : celula.origem === "publicado"
        ? "publicada"
        : "pelo padrão";

  const resumoTrabalho =
    trechos && periodos.length > 0
      ? `${formatarHoras(minutos)} de trabalho · termina ${
          terminaNoDiaSeguinte(trechos) ? "no dia seguinte" : "no mesmo dia"
        }`
      : null;

  const resumoSobreaviso = (ps: readonly Faixa[]) => {
    const validos = ps.filter(completo);
    if (validos.length === 0) return null;
    const total = validos.reduce((t, p) => t + duracao(p), 0);
    const seguinte = validos.some((p) => trecho(p)[1] > 24 * 60);
    return `${formatarHoras(total)} de sobreaviso (1/3 da hora na folha) · termina ${
      seguinte ? "no dia seguinte" : "no mesmo dia"
    }`;
  };

  const campoHora = (
    rotulo: string,
    valor: string,
    onChange: (v: string) => void,
    ref?: React.Ref<HTMLInputElement>,
  ) => (
    <label className="painel-dia__campo">
      <span>{rotulo}</span>
      <input
        ref={ref}
        type="time"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );

  const local = (
    <div className="painel-dia__campo painel-dia__campo--largo">
      <label htmlFor={`${id}-local`}>Local</label>
      <select
        id={`${id}-local`}
        value={f.unidadeId}
        aria-describedby={`${id}-local-ajuda`}
        onChange={(e) => mudar({ unidadeId: e.target.value })}
      >
        <option value="">Unidade do colaborador</option>
        {unidades.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </select>
      <small id={`${id}-local-ajuda`}>Padrão: unidade do colaborador</small>
    </div>
  );

  return (
    <Sheet
      aberto
      titulo={pessoa.nome}
      subtitulo={subtitulo}
      onFechar={onFechar}
      alterado={alterado}
      bloqueado={enviando}
      className="painel-dia"
      {...(focoInicialRef ? { focoInicialRef } : {})}
      rodape={
        <>
          {celula.origem === "rascunho" ? (
            <Button variant="subtle" onClick={limpar} disabled={enviando}>
              Limpar o dia
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} disabled={enviando}>
            Salvar no rascunho
          </Button>
        </>
      }
    >
      <div className="painel-dia__corpo">
        <div className="painel-dia__navegacao">
          <button
            type="button"
            className="quadro__icone-botao"
            aria-label="Dia anterior"
            disabled={alterado}
            aria-describedby={alterado ? `${id}-salve` : undefined}
            onClick={() => onTrocarDia(somarDias(celula.dia, -1))}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <div className="painel-dia__dia">
            <p className="painel-dia__data">
              {diaPorExtensoComSemana(celula.dia)}
            </p>
            <p className="painel-dia__semana">
              {`Semana de ${intervaloCurtoDeDias(segunda, somarDias(segunda, 6))} · ${origem}`}
            </p>
          </div>
          <button
            type="button"
            className="quadro__icone-botao"
            aria-label="Próximo dia"
            disabled={alterado}
            aria-describedby={alterado ? `${id}-salve` : undefined}
            onClick={() => onTrocarDia(somarDias(celula.dia, 1))}
          >
            <span aria-hidden="true">›</span>
          </button>
          <Button variant="subtle" onClick={() => onVerSemana(celula.dia)}>
            Ver semana
          </Button>
        </div>
        {alterado ? (
          <p id={`${id}-salve`} className="painel-dia__dica">
            Salve ou cancele antes de trocar de dia.
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="Tipo do dia"
          className="painel-dia__abas"
        >
          {(Object.keys(ROTULO_DA_ABA) as AbaDoPainel[]).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={f.aba === a}
              className="painel-dia__aba"
              onClick={() => {
                const parcial: Partial<Formulario> = { aba: a };
                if (a === "sobreaviso" && f.sobreaviso.length === 0) {
                  parcial.sobreaviso = [{ inicio: "", fim: "" }];
                }
                mudar(parcial);
              }}
            >
              {ROTULO_DA_ABA[a]}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={false}
            aria-disabled="true"
            disabled
            title="Ausências vêm de Férias e ausências."
            className="painel-dia__aba"
          >
            Ausência
          </button>
        </div>

        {f.aba === "trabalho" ? (
          <div className="painel-dia__secao">
            <label className="painel-dia__campo painel-dia__campo--largo">
              <span>Turno</span>
              <select
                value={f.turnoId}
                onChange={(e) => {
                  const t = turnos.find((x) => x.id === e.target.value);
                  mudar(t ? preencherDoTurno(t, celula.dia) : { turnoId: "" });
                }}
              >
                <option value="">Sem turno (horário do dia)</option>
                {turnos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="painel-dia__linha">
              {campoHora("Início", f.inicio, (v) => mudar({ inicio: v }))}
              {campoHora("Fim", f.fim, (v) => mudar({ fim: v }))}
              <label className="painel-dia__campo">
                <span>Intervalo</span>
                <select
                  value={f.intervalo}
                  disabled={!!f.segundo}
                  onChange={(e) => mudar({ intervalo: Number(e.target.value) })}
                >
                  {INTERVALOS.map((i) => (
                    <option key={i.minutos} value={i.minutos}>
                      {i.minutos === 0 ? "Sem" : i.rotulo}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {f.segundo ? (
              <div className="painel-dia__linha">
                {campoHora(
                  "Início do 2º período",
                  f.segundo.inicio,
                  (v) => mudar({ segundo: { ...f.segundo!, inicio: v } }),
                  segundoRef,
                )}
                {campoHora("Fim", f.segundo.fim, (v) =>
                  mudar({ segundo: { ...f.segundo!, fim: v } }),
                )}
                <Button
                  variant="subtle"
                  onClick={() => mudar({ segundo: null })}
                >
                  Remover
                </Button>
              </div>
            ) : (
              <Button
                variant="subtle"
                onClick={() => {
                  mudar({ segundo: { inicio: "", fim: "" }, intervalo: 0 });
                  setTimeout(() => segundoRef.current?.focus(), 0);
                }}
              >
                + Segundo período (turno partido)
              </Button>
            )}
            {resumoTrabalho ? (
              <p className="painel-dia__resumo">{resumoTrabalho}</p>
            ) : null}

            {f.depois ? (
              <div className="painel-dia__bloco">
                <p className="painel-dia__subtitulo">
                  Sobreaviso depois do turno
                </p>
                <div className="painel-dia__linha">
                  {campoHora(
                    "Início",
                    f.depois.inicio,
                    (v) => mudar({ depois: { ...f.depois!, inicio: v } }),
                    depoisRef,
                  )}
                  {campoHora("Fim", f.depois.fim, (v) =>
                    mudar({ depois: { ...f.depois!, fim: v } }),
                  )}
                  <Button
                    variant="subtle"
                    onClick={() => mudar({ depois: null })}
                  >
                    Remover
                  </Button>
                </div>
                {resumoSobreaviso([f.depois]) ? (
                  <p className="painel-dia__resumo">
                    {resumoSobreaviso([f.depois])}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                variant="subtle"
                onClick={() => {
                  mudar({
                    depois: { inicio: f.segundo?.fim || f.fim, fim: f.inicio },
                  });
                  setTimeout(() => depoisRef.current?.focus(), 0);
                }}
              >
                + Sobreaviso depois do turno
              </Button>
            )}
            {local}
          </div>
        ) : null}

        {f.aba === "sobreaviso" ? (
          <div className="painel-dia__secao">
            {f.sobreaviso.map((p, i) => (
              <div key={i} className="painel-dia__linha">
                {campoHora(
                  i === 0 ? "Início" : "Início do 2º período",
                  p.inicio,
                  (v) =>
                    mudar({
                      sobreaviso: f.sobreaviso.map((x, j) =>
                        j === i ? { ...x, inicio: v } : x,
                      ),
                    }),
                  i === 0 ? sobreavisoRef : undefined,
                )}
                {campoHora("Fim", p.fim, (v) =>
                  mudar({
                    sobreaviso: f.sobreaviso.map((x, j) =>
                      j === i ? { ...x, fim: v } : x,
                    ),
                  }),
                )}
                {i > 0 ? (
                  <Button
                    variant="subtle"
                    onClick={() =>
                      mudar({
                        sobreaviso: f.sobreaviso.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            ))}
            {f.sobreaviso.length < 2 ? (
              <Button
                variant="subtle"
                onClick={() =>
                  mudar({
                    sobreaviso: [...f.sobreaviso, { inicio: "", fim: "" }],
                  })
                }
              >
                + Segundo período
              </Button>
            ) : null}
            {resumoSobreaviso(f.sobreaviso) ? (
              <p className="painel-dia__resumo">
                {resumoSobreaviso(f.sobreaviso)}
              </p>
            ) : null}
            {local}
          </div>
        ) : null}

        <label className="painel-dia__campo painel-dia__campo--largo">
          <span>
            Observação <small>Opcional</small>
          </span>
          <textarea
            ref={observacaoRef}
            rows={3}
            maxLength={MAX_OBSERVACAO}
            placeholder="Ex.: cobre a abertura da loja"
            value={f.observacao}
            onChange={(e) => mudar({ observacao: e.target.value })}
          />
          <small aria-live="polite">{`${f.observacao.length}/${MAX_OBSERVACAO}`}</small>
        </label>

        {avisos.length > 0 ? (
          <div
            role="note"
            aria-label="Atenção à legislação"
            className="painel-dia__avisos"
          >
            <p className="painel-dia__subtitulo">Atenção à legislação</p>
            <ul>
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="painel-dia__erro">
            {erro}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
