/**
 * T216 — Riscos psicossociais (NR-1): o resultado de uma resposta. Mesma
 * regra do time, com a prevalência pela faixa da pessoa (risco → 4,
 * intermediário → 2, favorável → 1) e a comparação com o escore do time.
 */
import type { IndividualNr1 } from "../../../../api/modelosDePesquisaClient";
import { CartaoDeSecao } from "../../componentes";
import { MiniCartao, SeloDoNivel } from "../ui";
import { DOMINIOS_NR1, TIPOS_DE_OFENSA, dimensaoNr1 } from "./definicao";
import { ESCALAS_NR1 } from "./definicao";
import {
  FAIXA,
  MATRIZ,
  NIVEL,
  NIVEIS,
  ROTULO_DO_GRAU,
  decimal,
} from "./textos";
import { LegendaDosNiveis } from "./VisaoGeralNr1";

const COMPARACAO = {
  acima: "Acima do time",
  abaixo: "Abaixo do time",
  na_media: "Na média do time",
} as const;

export function IndividualNr1Tela({ p }: { readonly p: IndividualNr1 }) {
  const contagem = (sev: number, prev: number) =>
    p.dimensoes.filter((d) => d.severidade === sev && d.prevalencia === prev)
      .length;
  return (
    <div className="modelos">
      <div className="modelos__grade">
        {NIVEIS.map((n) => (
          <MiniCartao
            key={n}
            titulo={n === "critico" ? "Críticas" : `${NIVEL[n].rotulo} risco`}
            valor={p.niveis[n]}
            texto={NIVEL[n].acao}
          />
        ))}
      </div>
      <CartaoDeSecao
        titulo="Matriz de risco psicossocial desta resposta"
        descricao="Quantas dimensões em cada célula (severidade × prevalência pela faixa da pessoa)."
      >
        <div
          className="modelos__matriz"
          role="table"
          aria-label="Matriz desta resposta"
        >
          <span role="row" style={{ display: "contents" }}>
            <span role="columnheader" className="modelos__matriz-eixo">
              Severidade ↓ · Prevalência →
            </span>
            {[1, 2, 3, 4].map((x) => (
              <span
                key={x}
                role="columnheader"
                className="modelos__matriz-eixo"
              >
                {ROTULO_DO_GRAU[x]}
              </span>
            ))}
          </span>
          {[4, 3, 2, 1].map((sev, linha) => (
            <span key={sev} role="row" style={{ display: "contents" }}>
              <span role="rowheader" className="modelos__matriz-eixo">
                {ROTULO_DO_GRAU[sev]}
              </span>
              {[1, 2, 3, 4].map((prev) => (
                <span
                  key={prev}
                  role="cell"
                  className="modelos__matriz-celula modelos__matriz-celula--mini"
                  style={{
                    ["--cor-celula" as string]:
                      NIVEL[MATRIZ[linha]![prev - 1]!].cor,
                  }}
                >
                  {contagem(sev, prev) || ""}
                </span>
              ))}
            </span>
          ))}
        </div>
        <LegendaDosNiveis />
      </CartaoDeSecao>
      <CartaoDeSecao
        titulo="Dimensões"
        descricao="Escore de 1 a 5, faixa, nível e a comparação com o time (diferença de mais de 0,5)."
      >
        <div className="modelos__tabela-rolagem">
          <table className="modelos__tabela">
            <thead>
              <tr>
                <th>Dimensão</th>
                <th className="modelos__num">Escore</th>
                <th>Faixa</th>
                <th>Nível</th>
                <th>Comparação</th>
              </tr>
            </thead>
            <tbody>
              {DOMINIOS_NR1.flatMap((dom) =>
                p.dimensoes
                  .filter((d) => dimensaoNr1(d.id).dominio === dom.id)
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        {dimensaoNr1(d.id).rotulo}
                        <span className="modelos__rotulo">{dom.rotulo}</span>
                      </td>
                      <td className="modelos__num">{`${decimal(d.escore)}${d.escoreDoTime !== null ? ` · time ${decimal(d.escoreDoTime)}` : ""}`}</td>
                      <td>{d.faixa ? FAIXA[d.faixa].rotulo : "—"}</td>
                      <td>
                        <SeloDoNivel nivel={d.nivel} />
                      </td>
                      <td>{d.comparacao ? COMPARACAO[d.comparacao] : "—"}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      </CartaoDeSecao>
      <CartaoDeSecao titulo="Comportamentos ofensivos (últimos 12 meses)">
        <ul className="modelos__lista-dimensoes">
          {TIPOS_DE_OFENSA.map((t) => {
            const v = p.ofensivos.find((o) => o.id === t.id)?.resposta ?? null;
            return (
              <li key={t.id} className="modelos__cartao-topo">
                <span>{t.rotulo}</span>
                <strong>
                  {v === null
                    ? "Sem resposta"
                    : ESCALAS_NR1.frequencia.rotulos[v - 1]}
                </strong>
              </li>
            );
          })}
        </ul>
      </CartaoDeSecao>
    </div>
  );
}
