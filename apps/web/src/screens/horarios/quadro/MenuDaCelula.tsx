/**
 * T215 — o menu da célula do quadro, como o da referência: os TURNOS da
 * empresa (nome, horário e intervalo), o DIA (Folga, DSR, Sobreaviso,
 * Sobreaviso depois do turno, Dois turnos no dia) e as ações do dia (Abrir
 * detalhes, observação, Limpar).
 *
 * Menu acessível: `role="menu"`, setas, Home/End, Escape e Tab fecham e
 * devolvem o foco à célula; clique fora fecha.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TabelaHorarioApi } from "../../../api/horariosClient";
import { corDoTurno, rotuloDoIntervalo } from "../turnos/turnos";
import type { CelulaDoQuadro } from "./quadroDaEscala";
import { periodosNoDia } from "./quadroDaEscala";

export type AcaoDaCelula =
  | { readonly tipo: "turno"; readonly turno: TabelaHorarioApi }
  | { readonly tipo: "folga" }
  | { readonly tipo: "dsr" }
  | { readonly tipo: "sobreaviso" }
  | { readonly tipo: "sobreaviso-depois" }
  | { readonly tipo: "dois-turnos" }
  | { readonly tipo: "detalhes" }
  | { readonly tipo: "observacao" }
  | { readonly tipo: "limpar" };

/** "09:00–18:00 · 1 h de intervalo" do turno no dia. */
export function descricaoDoTurnoNoDia(
  t: TabelaHorarioApi,
  dia: string,
): string {
  const ps = periodosNoDia(
    { ...t, periodos: t.periodos, intervaloMinutos: t.intervaloMinutos ?? 0 },
    dia,
  );
  if (ps.length === 0) return "sem horário neste dia";
  const faixa = ps.map((p) => `${p.inicio}–${p.fim}`).join(" · ");
  const intervalo = t.intervaloMinutos ?? 0;
  return ps.length === 1 && intervalo > 0
    ? `${faixa} · ${rotuloDoIntervalo(intervalo)} de intervalo`
    : faixa;
}

/** O sobreaviso depois do turno: do fim do trabalho ao início do turno no dia seguinte. */
export function sobreavisoDepoisDoTurno(
  c: CelulaDoQuadro,
): { inicio: string; fim: string } | null {
  if (c.tipo !== "trabalho" || c.periodos.length === 0) return null;
  const fim = c.periodos[c.periodos.length - 1]!.fim;
  const inicio = c.periodos[0]!.inicio;
  return { inicio: fim, fim: inicio };
}

interface ItemDoMenu {
  readonly chave: string;
  readonly rotulo: string;
  readonly detalhe?: string;
  readonly cor?: string;
  readonly marcado?: boolean;
  readonly acao: AcaoDaCelula;
}

export function MenuDaCelula({
  ancora,
  rotulo,
  celula,
  turnos,
  onEscolher,
  onFechar,
}: {
  readonly ancora: HTMLElement;
  /** "Ações de Ana, terça 24/11". */
  readonly rotulo: string;
  readonly celula: CelulaDoQuadro;
  readonly turnos: readonly TabelaHorarioApi[];
  readonly onEscolher: (acao: AcaoDaCelula) => void;
  readonly onFechar: (devolverFoco: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [posicao, setPosicao] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const depois = sobreavisoDepoisDoTurno(celula);
  const grupos: { titulo: string; itens: ItemDoMenu[] }[] = [
    {
      titulo: "Turnos",
      itens: turnos.map((t) => ({
        chave: `turno-${t.id}`,
        rotulo: t.nome,
        detalhe: descricaoDoTurnoNoDia(t, celula.dia),
        cor: corDoTurno(t.cor),
        marcado: celula.tipo === "trabalho" && celula.turno?.id === t.id,
        acao: { tipo: "turno", turno: t },
      })),
    },
    {
      titulo: "Dia",
      itens: [
        {
          chave: "folga",
          rotulo: "Folga",
          marcado: celula.tipo === "folga",
          acao: { tipo: "folga" },
        },
        {
          chave: "dsr",
          rotulo: "DSR",
          detalhe: "Descanso semanal remunerado",
          marcado: celula.tipo === "dsr",
          acao: { tipo: "dsr" },
        },
        {
          chave: "sobreaviso",
          rotulo: "Sobreaviso",
          detalhe: "Fora do trabalho, esperando chamado · 1/3 da hora",
          marcado: celula.tipo === "sobreaviso",
          acao: { tipo: "sobreaviso" },
        },
        ...(depois && celula.sobreaviso.length === 0
          ? [
              {
                chave: "sobreaviso-depois",
                rotulo: "Sobreaviso depois do turno",
                detalhe: `${depois.inicio}–${depois.fim} · 1/3 da hora`,
                acao: { tipo: "sobreaviso-depois" } as const,
              },
            ]
          : []),
        {
          chave: "dois-turnos",
          rotulo: "Dois turnos no dia",
          detalhe: "Turno partido, sem sobreposição",
          acao: { tipo: "dois-turnos" },
        },
      ],
    },
    {
      titulo: "",
      itens: [
        {
          chave: "detalhes",
          rotulo: "Abrir detalhes",
          detalhe: "Enter",
          acao: { tipo: "detalhes" },
        },
        {
          chave: "observacao",
          rotulo: celula.observacao
            ? "Editar observação"
            : "Adicionar observação",
          acao: { tipo: "observacao" },
        },
        ...(celula.origem === "rascunho"
          ? [
              {
                chave: "limpar",
                rotulo: "Limpar",
                detalhe: "Del",
                acao: { tipo: "limpar" } as const,
              },
            ]
          : []),
      ],
    },
  ];

  useLayoutEffect(() => {
    const r = ancora.getBoundingClientRect();
    const largura = 320;
    const altura = menuRef.current?.offsetHeight ?? 420;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    const abaixo = r.bottom + 4;
    const top =
      abaixo + altura > window.innerHeight && r.top - altura - 4 > 8
        ? r.top - altura - 4
        : Math.max(8, Math.min(abaixo, window.innerHeight - altura - 8));
    setPosicao({ top, left });
  }, [ancora]);

  const itens = () => [
    ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"], [role="menuitemradio"]',
    ) ?? []),
  ];

  useEffect(() => {
    itens()[0]?.focus();
    const fora = (e: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !ancora.contains(e.target as Node)
      ) {
        onFechar(false);
      }
    };
    // pointerdown: os gatilhos do Radix cancelam o mousedown.
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teclado = (e: React.KeyboardEvent) => {
    const lista = itens();
    const atual = lista.indexOf(document.activeElement as HTMLButtonElement);
    const ir = (i: number) => {
      e.preventDefault();
      lista[(i + lista.length) % lista.length]?.focus();
    };
    if (e.key === "ArrowDown") ir(atual + 1);
    else if (e.key === "ArrowUp") ir(atual - 1);
    else if (e.key === "Home") ir(0);
    else if (e.key === "End") ir(lista.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      onFechar(true);
    } else if (e.key === "Tab") {
      e.preventDefault();
      onFechar(true);
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={rotulo}
      className="menu-celula"
      style={{ top: posicao.top, left: posicao.left }}
      onKeyDown={teclado}
    >
      {grupos.map((g, gi) =>
        g.itens.length === 0 ? null : (
          <div
            key={g.titulo || `grupo-${gi}`}
            role="group"
            aria-label={g.titulo || "Ações do dia"}
            className="menu-celula__grupo"
          >
            {g.titulo ? (
              <p className="menu-celula__titulo" aria-hidden="true">
                {g.titulo}
              </p>
            ) : null}
            {g.itens.map((i) => (
              <button
                key={i.chave}
                type="button"
                role={i.marcado !== undefined ? "menuitemradio" : "menuitem"}
                {...(i.marcado !== undefined
                  ? { "aria-checked": i.marcado }
                  : {})}
                tabIndex={-1}
                className="menu-celula__item"
                onClick={() => onEscolher(i.acao)}
              >
                {i.cor ? (
                  <span
                    className="menu-celula__ponto"
                    style={{ background: i.cor }}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="menu-celula__ponto--vazio"
                    aria-hidden="true"
                  />
                )}
                <span className="menu-celula__textos">
                  <span className="menu-celula__rotulo">{i.rotulo}</span>
                  {i.detalhe ? (
                    <span className="menu-celula__detalhe">{i.detalhe}</span>
                  ) : null}
                </span>
                {i.marcado ? (
                  <span className="menu-celula__marca" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
