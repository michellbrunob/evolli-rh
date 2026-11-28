/**
 * T216 — ficha › aba Pesquisas: as Avaliações 90°/180° sobre a pessoa (nota
 * do gestor, nível e, na 180°, a autoavaliação). Leitura de RH e DP,
 * auditada no servidor; sem avaliação, o cartão não aparece.
 */
import { useEffect, useState } from "react";
import { StatusBadge } from "../../../../components";
import { formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { NIVEIS, nota1 } from "./catalogo";
import { clienteDaAvaliacao, type AvaliacaoDaFicha } from "./cliente";
import "../modelos.css";

export function AvaliacoesDaFicha({
  colaboradorId,
  carregar = clienteDaAvaliacao.daFicha,
}: {
  readonly colaboradorId: string;
  readonly carregar?: (id: string) => Promise<AvaliacaoDaFicha[]>;
}) {
  const [itens, setItens] = useState<AvaliacaoDaFicha[] | null>(null);
  useEffect(() => {
    let vivo = true;
    // Resolve mesmo quando o carregador não devolve promessa (cliente simulado).
    Promise.resolve()
      .then(() => carregar(colaboradorId))
      .then((d) => vivo && setItens(Array.isArray(d) ? d : []))
      .catch(() => vivo && setItens([]));
    return () => {
      vivo = false;
    };
  }, [carregar, colaboradorId]);
  if (!itens || itens.length === 0) return null;
  return (
    <section
      className="pesquisas__cartao-secao"
      aria-labelledby="ficha-avaliacoes-titulo"
    >
      <header className="pesquisas__cartao-secao-cabeca">
        <div>
          <h2
            id="ficha-avaliacoes-titulo"
            className="pesquisas__cartao-secao-titulo"
          >
            Avaliações de desempenho
          </h2>
          <p className="pesquisas__suave">
            {plural(itens.length, "avaliação", "avaliações")}
          </p>
        </div>
      </header>
      <ul className="avaliacao__ficha">
        {itens.map((a) => (
          <li key={a.pesquisaId}>
            <span className="avaliacao__time-nome">
              <strong>{a.nome}</strong>
              <span className="pesquisas__suave">
                {`${a.modelo === "avaliacao180" ? "Avaliação 180°" : "Avaliação 90°"}${a.gestor ? ` · gestor: ${a.gestor}` : ""} · ${formatarInstante(a.respondidaEm)}`}
              </span>
            </span>
            <span className="avaliacao__numero">
              {a.geral === null ? "—" : `${nota1(a.geral)} /5`}
            </span>
            {a.nivel ? (
              <StatusBadge variant={NIVEIS[a.nivel].tom}>
                {NIVEIS[a.nivel].rotulo}
              </StatusBadge>
            ) : null}
            {a.autoavaliacao !== null ? (
              <span className="pesquisas__suave">{`Autoavaliação ${nota1(a.autoavaliacao)}`}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
