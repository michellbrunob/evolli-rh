/**
 * T216 — a aba Análises do eNPS: o eNPS por grupo (departamento, centro
 * de custo ou unidade; grupos abaixo do mínimo ficam ocultos), a evolução
 * do eNPS a partir da segunda pesquisa do modelo e, só na identificada, o
 * que mais pesa na nota (a correlação de cada complementar com a
 * principal).
 */
import { useEffect, useState } from "react";
import type {
  AnalisesPesquisa,
  CampoGrupo,
  PesquisaDetalhe,
  ResultadoDoEnps,
  ResultadosPesquisa,
} from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { IconeCadeado } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { Pilulas } from "../../componentes";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { dataDoInstante, textoDoOculto } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { BarraDasZonas } from "./SobreEnps";
import { TITULO_DA_ZONA, comSinal, zonaDoEnps } from "./textos";
import "../Resultados.css";
import "./Enps.css";

/** Os recortes da pesquisa (anônima: os escolhidos em "separar por"). */
export function recortesDoEnps(
  detalhe: PesquisaDetalhe,
  geral: ResultadosPesquisa,
): CampoGrupo[] {
  if (geral.recortes && geral.recortes.length > 0) return geral.recortes;
  if (detalhe.identificacao === "anonima")
    return [...(detalhe.separarPor ?? [])];
  return ["departamento", "centroCusto", "unidade"];
}

interface GrupoComEnps {
  id: string;
  nome: string;
  respostas: number;
  visivel: boolean;
  oculto: "minimo" | "protege_grupo_menor" | null;
  enps: ResultadoDoEnps | null;
}

/** A linha da evolução do eNPS (−100 a 100). */
export function EvolucaoDoEnps({
  pontos,
}: {
  readonly pontos: readonly { rotulo: string; valor: number }[];
}) {
  const largura = 300;
  const altura = 130;
  const x = (i: number) =>
    pontos.length <= 1
      ? largura / 2
      : 24 + (i * (largura - 48)) / (pontos.length - 1);
  const y = (v: number) => altura - 15 - ((v + 100) / 200) * (altura - 30);
  return (
    <figure className="pesquisas__evolucao">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label={`Evolução do eNPS: ${pontos.map((p) => `${p.rotulo} ${p.valor}`).join("; ")}`}
      >
        <line
          x1="0"
          x2={largura}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--hairline)"
          strokeDasharray="4 3"
        />
        <polyline
          fill="none"
          stroke="var(--color-action)"
          strokeWidth="2"
          points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")}
        />
        {pontos.map((p, i) => (
          <g key={`${p.rotulo}-${i}`}>
            <circle
              cx={x(i)}
              cy={y(p.valor)}
              r="4"
              fill="var(--color-action)"
            />
            <text
              x={x(i)}
              y={y(p.valor) - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink)"
            >
              {comSinal(p.valor)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        <ol className="pesquisas__evolucao-rotulos">
          {pontos.map((p, i) => (
            <li key={`${p.rotulo}-${i}`}>{p.rotulo}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

export function AnalisesEnps({
  servico,
  detalhe,
  geral,
  r,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
  readonly r: ResultadoDoEnps;
}) {
  const recortes = recortesDoEnps(detalhe, geral);
  const [campo, setCampo] = useState<CampoGrupo | null>(recortes[0] ?? null);
  const [grupos, setGrupos] = useState<GrupoComEnps[] | null>(null);
  const [evolucao, setEvolucao] = useState<AnalisesPesquisa["evolucao"] | null>(
    null,
  );
  const identificada = detalhe.identificacao === "identificada";

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
      if (!vivo) return;
      setGrupos(
        lista.map((g, i) => {
          const m = resultados[i]?.modelo;
          return {
            id: g.id,
            nome: g.nome,
            respostas: g.respostas,
            visivel: g.visivel && m?.modelo === "enps",
            oculto: g.oculto ?? (g.visivel ? null : "minimo"),
            enps: m?.modelo === "enps" ? m : null,
          };
        }),
      );
    });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, geral, campo]);

  // A evolução não depende do recorte: a anônima sem "separar por" também
  // compara com as pesquisas eNPS anteriores.
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.evolucaoDaPesquisa(detalhe.id))
      .then((d) => {
        if (vivo) setEvolucao(d?.evolucao ?? []);
      })
      .catch(() => {
        if (vivo) setEvolucao([]);
      });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id]);

  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const rotuloDe = (id: string) => {
    const p = perguntas.find((x) => x.id === id);
    return p ? textoParaOPainel(p.rotulo || p.texto) : "Pergunta";
  };
  const rotuloDoCampo = (c: CampoGrupo) =>
    CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.nome ?? c;
  const pontos = (evolucao ?? [])
    .filter((e): e is typeof e & { enps: number } => typeof e.enps === "number")
    .map((e) => ({
      rotulo: `${e.nome} · ${dataDoInstante(e.publicadaEm)}`,
      valor: e.enps,
    }));
  const pesos = r.complementares
    .filter((c): c is typeof c & { peso: number } => c.peso !== null)
    .sort((a, b) => b.peso - a.peso);

  return (
    <div className="modelo-resultado">
      <section className="pesquisas__cartao-secao" aria-label="eNPS por grupo">
        <header className="pesquisas__cartao-secao-cabeca">
          <div>
            <h2 className="pesquisas__cartao-secao-titulo">
              {`eNPS por ${campo ? rotuloDoCampo(campo) : "grupo"}`}
            </h2>
            <p className="pesquisas__suave">
              {`Grupos com menos de ${plural(detalhe.minimoPorGrupo, "resposta", "respostas")} ficam ocultos.`}
            </p>
          </div>
          {recortes.length > 1 ? (
            <Pilulas
              rotulo="Agrupar por"
              valor={campo ?? recortes[0]!}
              onMudar={(c) => setCampo(c)}
              opcoes={recortes.map((c) => ({
                valor: c,
                rotulo: CAMPOS_DE_GRUPO.find((x) => x.campo === c)?.rotulo ?? c,
              }))}
            />
          ) : null}
        </header>
        {recortes.length === 0 ? (
          <p className="pesquisas__nota">
            Esta pesquisa anônima não pediu para separar as respostas por grupo:
            não há recortes para comparar.
          </p>
        ) : !grupos ? (
          <Esqueleto rotulo="Carregando os grupos…" linhas={3} />
        ) : grupos.length === 0 ? (
          <p className="pesquisas__suave">Nenhum grupo com respostas.</p>
        ) : (
          <div className="pesquisas__tabela-caixa">
            <table
              className="pesquisas__tabela enps-tabela"
              aria-label={`eNPS por ${campo ? rotuloDoCampo(campo) : "grupo"}`}
            >
              <thead>
                <tr>
                  <th scope="col">
                    {campo
                      ? CAMPOS_DE_GRUPO.find((x) => x.campo === campo)?.rotulo
                      : "Grupo"}
                  </th>
                  <th scope="col" className="pesquisas__numero">
                    eNPS
                  </th>
                  <th scope="col">Zona</th>
                  <th scope="col" className="pesquisas__numero">
                    Respostas
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <tr key={g.id}>
                    <th scope="row">{g.nome}</th>
                    {g.visivel && g.enps ? (
                      <>
                        <td className="pesquisas__numero">
                          {g.enps.indice === null
                            ? "—"
                            : comSinal(g.enps.indice)}
                        </td>
                        <td>
                          {g.enps.zona ? (
                            <span
                              className="modelo-faixa"
                              data-faixa={zonaDoEnps(g.enps.zona).faixa}
                            >
                              {TITULO_DA_ZONA[g.enps.zona]}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="pesquisas__numero">{g.respostas}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="pesquisas__suave">
                        <IconeCadeado tamanho={12} />
                        {` ${textoDoOculto(g.oculto, detalhe.minimoPorGrupo)}`}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="pesquisas__cartao-secao"
        aria-label="Evolução do eNPS"
      >
        <header className="pesquisas__cartao-secao-cabeca">
          <div>
            <h2 className="pesquisas__cartao-secao-titulo">Evolução do eNPS</h2>
            <p className="pesquisas__suave">Pesquisas eNPS anteriores</p>
          </div>
        </header>
        {evolucao === null ? (
          <Esqueleto rotulo="Carregando a evolução…" linhas={2} />
        ) : pontos.length >= 2 ? (
          <>
            <EvolucaoDoEnps pontos={pontos} />
            <BarraDasZonas />
          </>
        ) : (
          <p className="pesquisas__suave">
            A evolução aparece a partir da segunda pesquisa eNPS.
          </p>
        )}
      </section>

      <section
        className="pesquisas__cartao-secao"
        aria-label="O que mais pesa na nota"
      >
        <header className="pesquisas__cartao-secao-cabeca">
          <div>
            <h2 className="pesquisas__cartao-secao-titulo">
              O que mais pesa na nota
            </h2>
            <p className="pesquisas__suave">
              As complementares que mais andam junto com a nota principal.
            </p>
          </div>
        </header>
        {!identificada ? (
          <p className="pesquisas__nota">
            Disponível só na pesquisa identificada: a leitura cruza as notas de
            cada pessoa.
          </p>
        ) : pesos.length === 0 ? (
          <p className="pesquisas__suave">
            Precisa de pelo menos 3 respostas com notas diferentes.
          </p>
        ) : (
          <ol
            className="pesquisas__linhas"
            aria-label="Peso de cada complementar"
          >
            {pesos.map((c) => (
              <li key={c.perguntaId}>
                <span>{rotuloDe(c.perguntaId)}</span>
                <span className="pesquisas__barra" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, c.peso) * 100}%` }} />
                </span>
                <span>{`${Math.round(c.peso * 100)}%`}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
