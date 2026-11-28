/**
 * T216 — a aba Respostas da TAD e do Pulso e Clima: cada resposta com o
 * número na régua do modelo (`RespostaResumo.resumoDoModelo`) — TAD: score
 * de 1 a 7 com o nível; Pulso e Clima: score de 0 a 100 com a faixa —, no
 * lugar da média de 0 a 10.
 */
import type { ReactNode } from "react";
import type {
  ModeloPesquisa,
  PesquisaDetalhe,
  RespostaResumo,
} from "../../../api/pesquisasClient";
import { formatarInstante } from "../../../format/data";
import { plural } from "../../../format/plural";
import { IconeAvancar } from "../../../ui/icones";
import { Esqueleto } from "../../../ui/movimento";
import { Avatar, iniciaisDe } from "../componentes";
import {
  ROTULO_DA_FAIXA,
  ROTULO_DO_NIVEL,
  SeloDaFaixa,
  VISUAL_DO_NIVEL,
  duasCasas,
} from "./resultadoComum";

/** "27/11 · 11:23". */
const diaEHora = (iso: string) =>
  formatarInstante(iso).replace(/^(\d{2}\/\d{2})\/\d{4} às /, "$1 · ");

/** Os modelos com a aba Respostas na régua própria. */
export const temRespostasNaRegua = (m: ModeloPesquisa) =>
  m === "tad" || m === "pulso_clima";

/** O título da coluna do modelo. */
export function tituloDaColuna(m: ModeloPesquisa): string {
  return m === "tad" ? "Score de motivação" : "Score da resposta";
}

/** A célula da resposta na régua do modelo ("4,39 /7 Moderado"). */
export function celulaDaRegua(r: RespostaResumo): ReactNode {
  const x = r.resumoDoModelo;
  if (x?.modelo === "tad" && x.valor !== null && x.nivel)
    return (
      <span className="modelo-celula-indicador">
        <strong>{`${duasCasas(x.valor)} /7`}</strong>
        <SeloDaFaixa
          faixa={VISUAL_DO_NIVEL[x.nivel]}
          texto={ROTULO_DO_NIVEL[x.nivel]}
        />
      </span>
    );
  if (x?.modelo === "pulso_clima" && x.valor !== null && x.faixa)
    return (
      <span className="modelo-celula-indicador">
        <strong>{`${x.valor}/100`}</strong>
        <SeloDaFaixa faixa={x.faixa} texto={ROTULO_DA_FAIXA[x.faixa]} />
      </span>
    );
  return "—";
}

/** O número curto da resposta (seletor do resultado individual), ou `null`. */
export function textoDaRegua(r: RespostaResumo): string | null {
  const x = r.resumoDoModelo;
  if (x?.modelo === "tad")
    return x.valor === null ? "—" : `Score ${duasCasas(x.valor)}`;
  if (x?.modelo === "pulso_clima")
    return x.valor === null ? "—" : `Score ${x.valor}`;
  return null;
}

export function RespostasNaRegua({
  detalhe,
  respostas,
  onAbrir,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onAbrir: (id: string) => void;
}) {
  const identificada = detalhe.identificacao === "identificada";
  if (!respostas)
    return <Esqueleto rotulo="Carregando respostas…" linhas={4} />;
  if (respostas.length === 0)
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Ninguém respondeu ainda.</strong>
      </div>
    );
  return (
    <>
      {identificada ? (
        <p className="pesquisas__suave">
          A consulta às respostas individuais fica registrada na auditoria.
        </p>
      ) : null}
      <div className="pesquisas__tabela-caixa">
        <table
          className="pesquisas__tabela pesquisas__tabela--clicavel"
          aria-label="Respostas"
        >
          <thead>
            <tr>
              <th scope="col">Resposta</th>
              <th scope="col">{tituloDaColuna(detalhe.modelo)}</th>
              <th scope="col">Respondeu em</th>
              <th scope="col">
                <span className="pesquisas__so-leitor">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {respostas.map((r) => {
              const nome =
                identificada && r.nome
                  ? r.nome
                  : `Resposta anônima #${r.numero}`;
              return (
                <tr key={r.id} onClick={() => onAbrir(r.id)}>
                  <td>
                    <span className="pesquisas__pessoa-linha">
                      <Avatar
                        texto={
                          identificada && r.nome
                            ? iniciaisDe(r.nome)
                            : `R${r.numero}`
                        }
                      />
                      <span className="pesquisas__pessoa-textos">
                        <span className="pesquisas__forte">{nome}</span>
                        {identificada && r.departamento ? (
                          <span className="pesquisas__suave">
                            {r.departamento}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td>{celulaDaRegua(r)}</td>
                  <td className="pesquisas__data">
                    {diaEHora(r.respondidaEm)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="pesquisas__acao-texto pesquisas__acao-texto--primaria"
                      aria-label={`Ver resultado de ${nome}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(r.id);
                      }}
                    >
                      Ver resultado
                      <IconeAvancar tamanho={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pesquisas__tabela-rodape">
          <span>{plural(respostas.length, "resposta", "respostas")}</span>
          <span className="pesquisas__suave">
            Da mais recente para a mais antiga
          </span>
        </div>
      </div>
    </>
  );
}
