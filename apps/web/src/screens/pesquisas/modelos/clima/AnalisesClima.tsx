/**
 * T216 — aba Análises da Pesquisa de Clima: agrupar por departamento (ou
 * outro recorte da pesquisa), o resultado de cada grupo (índice, faixa e as
 * 5 dimensões; grupos abaixo do mínimo ficam ocultos), a evolução do
 * índice desde a última Pesquisa de Clima (com "Duplicar para o próximo
 * ciclo") e, fora da identificada, o aviso das leituras que precisam
 * identificar quem respondeu. Na identificada: pessoas por faixa.
 */
import { useEffect, useState } from "react";
import type {
  CampoGrupo,
  PesquisaDetalhe,
  RespostaResumo,
  ResultadoClima,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { Esqueleto } from "../../../../ui/movimento";
import { Pilulas } from "../../componentes";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { DIMENSOES_CLIMA } from "./catalogo";
import { FAIXAS_CLIMA } from "./faixas";
import { SeloDaFaixaClima } from "./pecas";
import "../Resultados.css";

export interface GrupoDoClima {
  readonly id: string;
  readonly nome: string;
  readonly respostas: number;
  readonly resultado: ResultadoClima | null;
}

const climaDe = (g: ResultadosPesquisa | null): ResultadoClima | null =>
  g?.filtro.visivel !== false && g?.modelo?.modelo === "clima"
    ? g.modelo
    : null;

/** Os recortes da pesquisa (o departamento primeiro). */
export function recortesDoClima(geral: ResultadosPesquisa): CampoGrupo[] {
  const r = geral.recortes ?? [];
  return [...r].sort(
    (a, b) => Number(b === "departamento") - Number(a === "departamento"),
  );
}

/** O resultado do Clima de cada grupo do recorte (os ocultos sem números). */
export function useGruposDoClima(
  servico: ServicoDePesquisas,
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
  campo: CampoGrupo | null,
): GrupoDoClima[] | null {
  const [grupos, setGrupos] = useState<GrupoDoClima[] | null>(null);
  useEffect(() => {
    if (!campo) return;
    let vivo = true;
    setGrupos(null);
    const lista = geral.grupos?.[campo] ?? [];
    Promise.all(
      lista.map((g) =>
        g.visivel
          ? Promise.resolve(
              servico.resultadosDaPesquisa(detalhe.id, {
                campo,
                grupoId: g.id,
              }),
            ).catch(() => null)
          : Promise.resolve(null),
      ),
    ).then((resultados) => {
      if (vivo)
        setGrupos(
          lista.map((g, i) => ({
            id: g.id,
            nome: g.nome,
            respostas: g.respostas,
            resultado: g.visivel ? climaDe(resultados[i] ?? null) : null,
          })),
        );
    });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, geral, campo]);
  return grupos;
}

/** A Pesquisa de Clima anterior (publicada antes, com respostas) e o índice dela. */
function useAnterior(
  servico: ServicoDePesquisas,
  detalhe: PesquisaDetalhe,
): { nome: string; indice: number | null } | null | undefined {
  const [anterior, setAnterior] = useState<
    { nome: string; indice: number | null } | null | undefined
  >(undefined);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const lista = await Promise.resolve(
        servico.listarPesquisas({ tamanhoPagina: 100 }),
      );
      const candidatas = (lista?.itens ?? []).filter(
        (p) =>
          p.modelo === "clima" &&
          p.id !== detalhe.id &&
          p.respostas > 0 &&
          p.publicadaEm !== null &&
          (detalhe.publicadaEm === null || p.publicadaEm < detalhe.publicadaEm),
      );
      const ultima = candidatas
        .sort((a, b) => a.publicadaEm!.localeCompare(b.publicadaEm!))
        .at(-1);
      if (!ultima) return null;
      const r = await Promise.resolve(servico.resultadosDaPesquisa(ultima.id));
      return { nome: ultima.nome, indice: climaDe(r)?.favoravel ?? null };
    })()
      .catch(() => null)
      .then((a) => {
        if (vivo) setAnterior(a);
      });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, detalhe.publicadaEm]);
  return anterior;
}

export function AnalisesClima({
  servico,
  detalhe,
  geral,
  respostas,
  onDuplicar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  /** A lista das respostas (identificada: pessoas por faixa). */
  readonly respostas: readonly RespostaResumo[] | null;
  readonly onDuplicar?: () => void;
}) {
  const recortes = recortesDoClima(geral);
  const [campo, setCampo] = useState<CampoGrupo | null>(recortes[0] ?? null);
  const grupos = useGruposDoClima(servico, detalhe, geral, campo);
  const anterior = useAnterior(servico, detalhe);
  const r = climaDe(geral);
  const identificada = detalhe.identificacao === "identificada";
  const rotuloDoCampo = (c: CampoGrupo) =>
    CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.rotulo ?? c;
  const nomeDoCampo = (c: CampoGrupo) =>
    CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.nome ?? c;

  const porFaixa = FAIXAS_CLIMA.map((f) => ({
    ...f,
    pessoas: (respostas ?? []).filter(
      (x) =>
        x.resumoDoModelo?.modelo === "clima" &&
        x.resumoDoModelo.faixa === f.faixa,
    ).length,
  }));

  return (
    <div className="modelo-resultado">
      <section className="modelo-cartao" aria-labelledby="clima-por-grupo">
        <div className="modelo-secao-cabeca">
          <div>
            <h2 id="clima-por-grupo">
              {campo
                ? `Resultado por ${nomeDoCampo(campo)}`
                : "Resultado por departamento"}
            </h2>
            <p className="pesquisas__suave">
              {`% favorável · grupos com menos de ${plural(detalhe.minimoPorGrupo, "resposta", "respostas")} ficam ocultos`}
            </p>
          </div>
          {/* Mesmo sem recorte (anônima sem "separar por"), o seletor
              mostra o departamento: o vazio explica e leva à segmentação. */}
          <Pilulas
            rotulo="Agrupar por"
            valor={campo ?? "departamento"}
            onMudar={(c) => {
              if (recortes.includes(c)) setCampo(c);
            }}
            opcoes={(recortes.length > 0
              ? recortes
              : (["departamento"] as const)
            ).map((c) => ({
              valor: c,
              rotulo: `Agrupar por ${rotuloDoCampo(c)}`,
            }))}
          />
        </div>
        {!campo || (grupos !== null && grupos.length === 0) ? (
          <div className="pesquisas__vazio-acao">
            <p className="pesquisas__suave">
              {`Sem ${campo ? nomeDoCampo(campo) : "departamento"} informado para agrupar as respostas.`}
            </p>
            {recortes.length === 0 && onDuplicar ? (
              <>
                <p className="pesquisas__suave">
                  Duplique a pesquisa e ligue “Separar respostas por” no
                  assistente para comparar os grupos no próximo ciclo.
                </p>
                <div className="pesquisas__acoes">
                  <Button variant="secondary" onClick={onDuplicar}>
                    Ativar segmentação na próxima pesquisa
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : grupos === null ? (
          <Esqueleto rotulo="Carregando grupos…" linhas={3} />
        ) : (
          <div className="pesquisas__tabela-caixa">
            <table
              className="pesquisas__tabela"
              aria-label={`Resultado por ${nomeDoCampo(campo)}`}
            >
              <thead>
                <tr>
                  <th scope="col">{rotuloDoCampo(campo)}</th>
                  <th scope="col">Índice</th>
                  {DIMENSOES_CLIMA.map((d) => (
                    <th key={d.chave} scope="col">
                      {d.rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r ? (
                  <tr>
                    <th scope="row">{`Todo o time (${plural(geral.respostas, "resposta", "respostas")})`}</th>
                    <td>
                      <span className="clima-numero">{`${r.favoravel ?? "—"}%`}</span>{" "}
                      <SeloDaFaixaClima faixa={r.faixa} />
                    </td>
                    {r.dimensoes.map((d) => (
                      <td key={d.chave} className="clima-numero">
                        {d.favoravel === null ? "—" : `${d.favoravel}%`}
                      </td>
                    ))}
                  </tr>
                ) : null}
                {grupos.map((g) => (
                  <tr key={g.id}>
                    <th scope="row">{`${g.nome} (${plural(g.respostas, "resposta", "respostas")})`}</th>
                    {g.resultado ? (
                      <>
                        <td>
                          <span className="clima-numero">{`${g.resultado.favoravel ?? "—"}%`}</span>{" "}
                          <SeloDaFaixaClima faixa={g.resultado.faixa} />
                        </td>
                        {g.resultado.dimensoes.map((d) => (
                          <td key={d.chave} className="clima-numero">
                            {d.favoravel === null ? "—" : `${d.favoravel}%`}
                          </td>
                        ))}
                      </>
                    ) : (
                      <td colSpan={1 + DIMENSOES_CLIMA.length}>
                        <span className="pesquisas__suave">
                          Oculto para proteger quem respondeu
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="modelo-cartao" aria-labelledby="clima-evolucao">
        <h2 id="clima-evolucao">Evolução desde a última pesquisa</h2>
        {anterior === undefined ? (
          <Esqueleto rotulo="Carregando a pesquisa anterior…" linhas={1} />
        ) : anterior &&
          anterior.indice !== null &&
          r &&
          r.favoravel !== null ? (
          <p>
            {`${anterior.nome}: ${anterior.indice}% → agora ${r.favoravel}% (`}
            <strong>
              {r.favoravel - anterior.indice === 0
                ? "sem mudança"
                : `${r.favoravel - anterior.indice > 0 ? "+" : "−"}${plural(Math.abs(r.favoravel - anterior.indice), "p.p.", "p.p.")}`}
            </strong>
            )
          </p>
        ) : (
          <p className="pesquisas__suave">
            Esta é a primeira Pesquisa de Clima com respostas. A evolução do
            índice aparece a partir da próxima.
          </p>
        )}
        {onDuplicar ? (
          <div className="pesquisas__acoes">
            <Button variant="secondary" onClick={onDuplicar}>
              Duplicar para o próximo ciclo
            </Button>
          </div>
        ) : null}
      </section>

      {identificada ? (
        <section className="modelo-cartao" aria-labelledby="clima-faixas">
          <h2 id="clima-faixas">Pessoas por faixa</h2>
          <p className="pesquisas__suave">
            O índice de cada resposta, na faixa em que cai.
          </p>
          <ul className="clima-lista" aria-label="Pessoas por faixa">
            {porFaixa.map((f) => (
              <li key={f.faixa}>
                <span>
                  <SeloDaFaixaClima faixa={f.faixa} />{" "}
                  <span className="pesquisas__suave">{f.intervalo}</span>
                </span>
                <span className="clima-numero">
                  {plural(f.pessoas, "pessoa", "pessoas")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="pesquisas__nota" role="note">
          Onde agir primeiro, pessoas por faixa, participação por departamento e
          tempo de casa precisam de pesquisa identificada: nesta, ninguém é
          ligado à própria resposta.
        </div>
      )}
    </div>
  );
}
