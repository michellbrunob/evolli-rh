/**
 * T215 — "Avisos da semana" (ou do mês), como na referência: abas Atenção,
 * Conferir e Informativos com as contagens; cada aviso com a pessoa, o dia, o
 * título e a explicação (com a base legal). Escolher um aviso leva à célula.
 * Avisos não impedem publicar; ligam e desligam nas Regras.
 */
import { useState } from "react";
import { Button, Sheet } from "../../../ui";
import { diaDaSemanaEDiaMes } from "../../../format/data";
import type { AvisoDaEscala, CategoriaDoAviso } from "./avisosDaEscala";
import { iniciais } from "./quadroDaEscala";

const ABAS: readonly [CategoriaDoAviso, string][] = [
  ["atencao", "Atenção"],
  ["conferir", "Conferir"],
  ["informativo", "Informativos"],
];

const VAZIO: Readonly<Record<CategoriaDoAviso, string>> = {
  atencao: "Nenhum aviso de atenção.",
  conferir: "Nada para conferir.",
  informativo: "Nenhum aviso informativo.",
};

export function PainelDeAvisos({
  titulo,
  subtitulo,
  avisos,
  onIrParaCelula,
  onAbrirRegras,
  onFechar,
}: {
  /** "Avisos da semana" ou "Avisos do mês". */
  readonly titulo: string;
  /** "1 a 7 de março · calculados no rascunho". */
  readonly subtitulo: string;
  readonly avisos: readonly AvisoDaEscala[];
  readonly onIrParaCelula: (aviso: AvisoDaEscala) => void;
  readonly onAbrirRegras?: () => void;
  readonly onFechar: () => void;
}) {
  const contagem = (c: CategoriaDoAviso) =>
    avisos.filter((a) => a.categoria === c).length;
  const [aba, setAba] = useState<CategoriaDoAviso>(
    () => ABAS.find(([c]) => contagem(c) > 0)?.[0] ?? "atencao",
  );
  const daAba = avisos.filter((a) => a.categoria === aba);

  return (
    <Sheet
      aberto
      titulo={titulo}
      subtitulo={subtitulo}
      onFechar={onFechar}
      className="painel-avisos"
      rodape={
        <>
          {onAbrirRegras ? (
            <Button variant="subtle" onClick={onAbrirRegras}>
              Regras dos avisos
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onFechar}>
            Fechar
          </Button>
        </>
      }
    >
      <div className="painel-avisos__corpo">
        <div
          role="tablist"
          aria-label="Tipo de aviso"
          className="painel-dia__abas"
        >
          {ABAS.map(([c, rotulo]) => (
            <button
              key={c}
              type="button"
              role="tab"
              id={`aba-avisos-${c}`}
              aria-selected={aba === c}
              aria-controls="lista-avisos"
              className={`painel-dia__aba painel-avisos__aba--${c}`}
              onClick={() => setAba(c)}
            >
              {rotulo}
              <span className="painel-avisos__numero">{contagem(c)}</span>
            </button>
          ))}
        </div>
        <div
          id="lista-avisos"
          role="tabpanel"
          aria-labelledby={`aba-avisos-${aba}`}
        >
          {daAba.length === 0 ? (
            <p className="dialogo-massa__ajuda">{VAZIO[aba]}</p>
          ) : (
            <ul className="painel-avisos__lista">
              {daAba.map((a, i) => (
                <li key={`${a.colaboradorId}-${a.dia}-${a.chave}-${i}`}>
                  <button
                    type="button"
                    className={`painel-avisos__item painel-avisos__item--${a.categoria}`}
                    onClick={() => onIrParaCelula(a)}
                  >
                    <span className="quadro__avatar" aria-hidden="true">
                      {iniciais(a.nome)}
                    </span>
                    <span className="painel-avisos__textos">
                      <span className="painel-avisos__quem">
                        {`${a.nome} · ${diaDaSemanaEDiaMes(a.dia)}`}
                      </span>
                      <strong>{a.titulo}</strong>
                      <span className="painel-avisos__explicacao">
                        {a.explicacao}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="dialogo-massa__ajuda">
          Avisos não impedem publicar. Convenções coletivas podem mudar estas
          regras; ligue ou desligue cada aviso em Regras.
        </p>
      </div>
    </Sheet>
  );
}
