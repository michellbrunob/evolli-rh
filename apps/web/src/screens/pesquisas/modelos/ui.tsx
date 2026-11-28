/**
 * T216 — peças visuais comuns aos resultados dos modelos com metodologia
 * própria: selo de nível, barra das três faixas, quadradinhos, mini
 * cartões e o aviso de poucas respostas.
 */
import type { ReactNode } from "react";
import type { PesquisaDetalhe } from "../../../api/pesquisasClient";
import type { NivelNr1 } from "../../../api/modelosDePesquisaClient";
import { StatusBadge, type StatusVariant } from "../../../components";
import { plural } from "../../../format/plural";
import { NIVEL } from "./copsoq/textos";
import "./Modelos.css";
import "./copsoq/Nr1.css";

/**
 * As cores dos níveis da NR-1: crítico vermelho, alto laranja, médio âmbar
 * e baixo verde. O alto usa a pílula de atenção com o tom laranja do
 * modelo (o sistema não tem variante laranja).
 */
export const VARIANTE_DO_NIVEL: Readonly<Record<NivelNr1, StatusVariant>> = {
  critico: "danger",
  alto: "warning",
  medio: "warning",
  baixo: "success",
};

export function SeloDoNivel({ nivel }: { readonly nivel: NivelNr1 | null }) {
  if (!nivel) return <span className="pesquisas__suave">—</span>;
  return (
    <StatusBadge
      variant={VARIANTE_DO_NIVEL[nivel]}
      {...(nivel === "alto" ? { className: "nr1__selo-alto" } : {})}
    >
      {NIVEL[nivel].rotulo}
    </StatusBadge>
  );
}

export interface ParteDaFaixa {
  readonly rotulo: string;
  readonly valor: number;
  readonly cor: string;
}

/** Barra empilhada simples (larguras proporcionais), acessível. */
export function BarraDeFaixas({
  partes,
  rotulo,
}: {
  readonly partes: readonly ParteDaFaixa[];
  readonly rotulo: string;
}) {
  const total = partes.reduce((t, p) => t + p.valor, 0);
  const descricao = partes
    .map(
      (p) => `${p.rotulo}: ${total ? Math.round((p.valor * 100) / total) : 0}%`,
    )
    .join(", ");
  return (
    <span
      className="modelos__barra-faixas"
      role="img"
      aria-label={`${rotulo}. ${descricao}`}
    >
      {partes.map((p) =>
        p.valor > 0 ? (
          <span
            key={p.rotulo}
            style={{
              width: `${(p.valor * 100) / (total || 1)}%`,
              background: p.cor,
            }}
          />
        ) : null,
      )}
    </span>
  );
}

/** Uma barra de 0 a 100 com a cor dada. */
export function BarraPercentual({
  valor,
  cor,
  rotulo,
}: {
  readonly valor: number;
  readonly cor: string;
  readonly rotulo: string;
}) {
  return (
    <span
      className="modelos__barra"
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
    >
      <span
        style={{
          width: `${Math.max(0, Math.min(100, valor))}%`,
          background: cor,
        }}
      />
    </span>
  );
}

/** Fileira de quadradinhos coloridos (um por item). */
export function Quadradinhos({
  cores,
  rotulo,
}: {
  readonly cores: readonly string[];
  readonly rotulo: string;
}) {
  return (
    <span className="modelos__quadradinhos" role="img" aria-label={rotulo}>
      {cores.map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
    </span>
  );
}

export function MiniCartao({
  titulo,
  valor,
  texto,
}: {
  readonly titulo: string;
  readonly valor: ReactNode;
  readonly texto?: ReactNode;
}) {
  return (
    <div className="modelos__mini">
      <span className="modelos__mini-titulo">{titulo}</span>
      <strong className="modelos__mini-valor">{valor}</strong>
      {texto ? <span className="pesquisas__suave">{texto}</span> : null}
    </div>
  );
}

/** "menos de 3 pessoas" quando a contagem está protegida pelo sigilo. */
export function pessoasOuSigilo(n: number | null, minimo: number): string {
  return n === null
    ? `menos de ${plural(minimo, "pessoa", "pessoas")}`
    : plural(n, "pessoa", "pessoas");
}

/** Confidencial abaixo do mínimo: nada aparece. */
export function PoucasRespostasDoModelo({
  detalhe,
  minimo,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly minimo: number;
}) {
  return (
    <div className="pesquisas__aba-vazia" role="status">
      <strong>Poucas respostas para mostrar</strong>
      <p className="pesquisas__suave">
        {`Para proteger quem respondeu, os resultados aparecem a partir de ${plural(minimo, "resposta", "respostas")} (hoje são ${detalhe.respostas}).`}
      </p>
    </div>
  );
}
