/**
 * T215 — o período como um botão que abre um calendário: no topo, o período
 * com anterior e próximo; embaixo, o mês, com o período escolhido marcado.
 * Um clique num dia escolhe o dia, a semana ou o mês que o contém.
 * Teclado: setas andam pelos dias, Enter escolhe, Esc fecha.
 */
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  diaCivilDeHoje,
  formatarDiaCivil,
  mesDoDia,
  numeroDoDia,
} from "../../../format/data";
import { IconeAvancar, IconeCalendario, IconeVoltar } from "../../../ui/icones";
import {
  diaDaSemana,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import {
  DIAS_CURTOS,
  deslocar,
  diasDoPeriodo,
  inicioDaSemana,
  periodoDa,
  tituloDoPeriodo,
} from "./quadroDaEscala";

export type TamanhoDoPeriodo = "dia" | "semana" | "mes";

/** O primeiro e o último dia do período que contém `ancora`. */
export function periodoQueContem(
  tamanho: TamanhoDoPeriodo,
  ancora: string,
  semanaComeca: number,
): { inicio: string; fim: string } {
  if (tamanho === "dia") return { inicio: ancora, fim: ancora };
  return periodoDa(tamanho, ancora, semanaComeca);
}

/** A âncora do período seguinte (`1`) ou anterior (`-1`). */
export function deslocarPeriodo(
  tamanho: TamanhoDoPeriodo,
  ancora: string,
  passo: 1 | -1,
  semanaComeca: number,
): string {
  if (tamanho === "dia") return somarDias(ancora, passo);
  return deslocar(tamanho, ancora, passo, semanaComeca);
}

/** "23 a 29 de novembro de 2026", "Novembro de 2026" ou "25/11/2026". */
export function rotuloDoPeriodo(
  tamanho: TamanhoDoPeriodo,
  ancora: string,
  semanaComeca: number,
): string {
  const { inicio, fim } = periodoQueContem(tamanho, ancora, semanaComeca);
  if (tamanho === "dia") return formatarDiaCivil(inicio);
  return tituloDoPeriodo(tamanho, inicio, fim);
}

/** As 6 semanas do mês de `dia`, a partir do dia de início da semana. */
export function diasDoCalendario(dia: string, semanaComeca: number): string[] {
  const primeiro = periodoDa("mes", dia).inicio;
  const inicio = inicioDaSemana(primeiro, semanaComeca);
  return diasDoPeriodo(inicio, somarDias(inicio, 41));
}

export function SeletorDePeriodo({
  tamanho,
  ancora,
  semanaComeca,
  onEscolher,
  hoje = diaCivilDeHoje(),
}: {
  readonly tamanho: TamanhoDoPeriodo;
  readonly ancora: string;
  readonly semanaComeca: number;
  readonly onEscolher: (ancora: string) => void;
  /** Para testes: o dia de hoje. */
  readonly hoje?: string;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(ancora);
  const raiz = useRef<HTMLDivElement | null>(null);
  const gatilho = useRef<HTMLButtonElement | null>(null);
  const grade = useRef<HTMLDivElement | null>(null);
  const rotulo = rotuloDoPeriodo(tamanho, ancora, semanaComeca);
  const { inicio, fim } = periodoQueContem(tamanho, ancora, semanaComeca);
  const dias = diasDoCalendario(foco, semanaComeca);
  const mesVisivel = mesDoDia(foco);

  // Clique fora fecha.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  // O foco acompanha o dia em destaque.
  useEffect(() => {
    if (!aberto) return;
    grade.current
      ?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)
      ?.focus();
  }, [aberto, foco]);

  const abrir = () => {
    setFoco(ancora);
    setAberto(true);
  };
  const fechar = () => {
    setAberto(false);
    gatilho.current?.focus();
  };
  const escolher = (dia: string) => {
    onEscolher(dia);
    fechar();
  };

  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      fechar();
      return;
    }
    const passo = passos[e.key];
    if (passo !== undefined) {
      e.preventDefault();
      setFoco(somarDias(foco, passo));
    }
  };

  return (
    <div className="periodo" ref={raiz}>
      <button
        ref={gatilho}
        type="button"
        className="periodo__gatilho"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? `${id}-calendario` : undefined}
        aria-label={`Período: ${rotulo}. Abrir calendário`}
        onClick={() => (aberto ? fechar() : abrir())}
      >
        <IconeCalendario tamanho={16} />
        <span>{rotulo}</span>
        <span className="periodo__seta" aria-hidden="true">
          ▾
        </span>
      </button>
      {aberto ? (
        <div
          id={`${id}-calendario`}
          className="periodo__calendario"
          role="dialog"
          aria-label="Escolher o período"
          data-esc-proprio=""
          onKeyDown={teclas}
        >
          <div className="periodo__topo">
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Período anterior"
              onClick={() => {
                const novo = deslocarPeriodo(tamanho, ancora, -1, semanaComeca);
                onEscolher(novo);
                setFoco(novo);
              }}
            >
              <IconeVoltar tamanho={14} />
            </button>
            <span aria-live="polite">{rotulo}</span>
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Próximo período"
              onClick={() => {
                const novo = deslocarPeriodo(tamanho, ancora, 1, semanaComeca);
                onEscolher(novo);
                setFoco(novo);
              }}
            >
              <IconeAvancar tamanho={14} />
            </button>
          </div>
          <div className="periodo__mes">
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Mês anterior"
              onClick={() => setFoco(deslocar("mes", foco, -1))}
            >
              <IconeVoltar tamanho={12} />
            </button>
            <strong>{tituloDoPeriodo("mes", foco, foco)}</strong>
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Próximo mês"
              onClick={() => setFoco(deslocar("mes", foco, 1))}
            >
              <IconeAvancar tamanho={12} />
            </button>
          </div>
          <div className="periodo__grade" ref={grade} role="grid">
            <div role="row" className="periodo__semana">
              {dias.slice(0, 7).map((d) => (
                <span key={d} role="columnheader" className="periodo__nome-dia">
                  {DIAS_CURTOS[diaDaSemana(d) - 1]}
                </span>
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <div role="row" key={s} className="periodo__semana">
                {dias.slice(s * 7, s * 7 + 7).map((d) => {
                  const escolhido = d >= inicio && d <= fim;
                  const classes = [
                    "periodo__dia",
                    mesDoDia(d) !== mesVisivel ? "periodo__dia--fora" : "",
                    escolhido ? "periodo__dia--escolhido" : "",
                    escolhido && d === inicio ? "periodo__dia--inicio" : "",
                    escolhido && d === fim ? "periodo__dia--fim" : "",
                    d === hoje ? "periodo__dia--hoje" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <span role="gridcell" key={d} aria-selected={escolhido}>
                      <button
                        type="button"
                        className={classes}
                        data-dia={d}
                        tabIndex={d === foco ? 0 : -1}
                        aria-label={`${formatarDiaCivil(d)}${d === hoje ? ", hoje" : ""}`}
                        onClick={() => escolher(d)}
                      >
                        {numeroDoDia(d)}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
