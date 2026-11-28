/**
 * T216 — o relatório imprimível (PDF pelo navegador) do eNPS, no padrão
 * do PDF do Clima (`clima/RelatorioClima.tsx`): capa com o medidor, quem
 * respondeu e as complementares; sumário (6 seções) e como ler; 01 resumo
 * executivo e conclusões; 02 quem respondeu o quê (grupos e distribuição
 * das notas); 03 perguntas complementares; 04 eNPS por departamento
 * (grupos pequenos ocultos); 05 evolução; 06 comentários (2 colunas) e
 * metodologia.
 */
import type { ResultadoDoEnps } from "../../../../api/pesquisasClient";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import { formatarDiaCivil } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import type { RelatorioCarregado } from "../../carregarRelatorio";
import { perguntasEmOrdem } from "../../estadoDaPesquisa";
import {
  Impressao,
  Pagina,
  RodapeDaCapa,
  Secao,
} from "../../RelatorioImprimivel";
import {
  ROTULO_DA_IDENTIFICACAO,
  dataDoInstante,
  textoDoOculto,
} from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { EvolucaoDoEnps } from "./AnalisesEnps";
import {
  GRUPOS_DO_ENPS,
  TITULO_DA_ZONA,
  ZONAS_DO_ENPS,
  comSinal,
  grupoDaMedia,
  pctDe,
  umaCasaBr,
  zonaDoEnps,
} from "./textos";
import { DistribuicaoDaComplementar, MedidorDoEnps } from "./VisaoGeralEnps";
import "../Modelos.css";
import "../Resultados.css";
import "./Enps.css";

const TOTAL_DE_PAGINAS = 4;

/** "−100 a −1" (com o sinal de menos tipográfico). */
const intervaloDaZona = (de: number, ate: number) =>
  `${comSinal(de)} a ${comSinal(ate)}`.replace(/\+/g, "");

/** A zona de um eNPS (−100 a 100). */
const zonaDoIndice = (indice: number) =>
  ZONAS_DO_ENPS.find((z) => indice >= z.de && indice <= z.ate) ??
  ZONAS_DO_ENPS[0]!;

function quantos(r: ResultadoDoEnps, grupo: string): number {
  return grupo === "promotor"
    ? r.promotores
    : grupo === "neutro"
      ? r.neutros
      : r.detratores;
}

/** As conclusões do resumo: a zona, os grupos e a complementar mais baixa. */
export function conclusoesDoEnps(
  r: ResultadoDoEnps,
  rotuloDe: (perguntaId: string) => string,
): string[] {
  if (r.indice === null || r.zona === null) return [];
  const saida = [
    `O eNPS do time é ${comSinal(r.indice)}, na ${TITULO_DA_ZONA[r.zona].toLowerCase()}.`,
    `${pctDe(r.promotores, r.respostas)}% do time é promotor e ${pctDe(r.detratores, r.respostas)}% é detrator.`,
  ];
  const comMedia = r.complementares.filter((c) => c.media !== null);
  const menor = comMedia.reduce<(typeof comMedia)[number] | null>(
    (m, c) => (m === null || c.media! < m.media! ? c : m),
    null,
  );
  if (menor)
    saida.push(
      `${rotuloDe(menor.perguntaId)} tem a menor média entre as complementares (${umaCasaBr(menor.media!)}).`,
    );
  return saida;
}

export function DocumentoEnps({
  carregado,
}: {
  readonly carregado: RelatorioCarregado;
}) {
  const { detalhe, geral, empresa, rel } = carregado;
  const r =
    !rel.numerosOcultos && geral.modelo?.modelo === "enps"
      ? geral.modelo
      : null;
  const comNota = r && r.indice !== null && r.zona !== null ? r : null;
  const perguntas = perguntasEmOrdem(detalhe.secoes);
  const porId = new Map(perguntas.map((p) => [p.id, p]));
  const rotuloDe = (id: string) => {
    const p = porId.get(id);
    return p ? textoParaOPainel(p.rotulo || p.texto) : "Pergunta";
  };
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const identificada = rel.identificacao === "identificada";
  const cabecalho = {
    esquerda: "eNPS · Relatório de resultados",
    direita: `${rel.periodo} · Emitido em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: `Documento confidencial${identificada ? " · RH" : " · respostas sem identificação"}`,
    numero,
    total: TOTAL_DE_PAGINAS,
  });
  const oculto = (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );
  const complementares = r?.complementares ?? [];
  const grupos = rel.grupos;
  const pontos = rel.evolucao
    .filter((e): e is typeof e & { enps: number } => typeof e.enps === "number")
    .map((e) => ({
      rotulo: `${e.nome} · ${dataDoInstante(e.publicadaEm)}`,
      valor: e.enps,
    }));
  // Identificada: o servidor manda na ordem de chegada (a mais recente vai
  // primeiro); nas demais, a ordem alfabética, sem ligar texto a pessoa.
  const comentarios = rel.comentarios.map((c) => ({
    ...c,
    textos: identificada ? [...c.textos].reverse() : c.textos,
  }));
  const sumario = [
    ["01", "Resumo executivo", "eNPS, participação e conclusões", "3"],
    [
      "02",
      "Quem respondeu o quê",
      "Promotores, neutros, detratores e a distribuição das notas",
      "3",
    ],
    [
      "03",
      "Perguntas complementares",
      "A média de cada pergunta, de 0 a 10",
      "3",
    ],
    ["04", "eNPS por departamento", "O resultado de cada grupo", "4"],
    ["05", "Evolução", "O eNPS das pesquisas anteriores", "4"],
    [
      "06",
      "Comentários e metodologia",
      "As respostas abertas e como o eNPS é calculado",
      "4",
    ],
  ] as const;

  const gruposDoEnps = (rr: ResultadoDoEnps) =>
    GRUPOS_DO_ENPS.map((g) => ({
      ...g,
      n: quantos(rr, g.grupo),
      pct: pctDe(quantos(rr, g.grupo), rr.respostas),
    }));

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            {rel.periodo}
          </span>
        </div>
        <p className="relatorio__sobretitulo">Relatório de resultados</p>
        <h1 className="relatorio__capa-titulo">eNPS do time</h1>
        <p className="relatorio__capa-subtitulo">{`${empresa || "Empresa"} · ${rel.periodo}`}</p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao relatorio__cartao--medidor">
            <p className="relatorio__cartao-titulo">
              eNPS do time
              <span>{plural(rel.respostas, "resposta", "respostas")}</span>
            </p>
            {comNota ? (
              <div className="enps-medidor">
                <MedidorDoEnps valor={comNota.indice!} />
                <span className="enps-medidor__valor">
                  {comSinal(comNota.indice!)}
                </span>
                <span
                  className="modelo-faixa"
                  data-faixa={zonaDoEnps(comNota.zona!).faixa}
                >
                  {zonaDoEnps(comNota.zona!).rotulo}
                </span>
              </div>
            ) : (
              <span>
                {rel.numerosOcultos ? "Números ocultos" : "Sem notas"}
              </span>
            )}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Quem respondeu</p>
            {comNota ? (
              <ul
                className="relatorio__destaques"
                aria-label="Quem respondeu na capa"
              >
                {gruposDoEnps(comNota).map((g) => (
                  <li key={g.grupo} data-grupo={g.grupo}>
                    <span>{`${g.plural} · notas ${g.notas}`}</span>
                    <span>{plural(g.n, "pessoa", "pessoas")}</span>
                    <strong>{`${g.pct}%`}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Perguntas complementares<span>Média de 0 a 10</span>
            </p>
            {complementares.length > 0 ? (
              <ul
                className="relatorio__destaques"
                aria-label="Complementares na capa"
              >
                {complementares.map((c) => (
                  <li
                    key={c.perguntaId}
                    {...(c.media !== null
                      ? { "data-grupo": grupoDaMedia(c.media) }
                      : {})}
                  >
                    <span>{rotuloDe(c.perguntaId)}</span>
                    <strong>
                      {c.media === null ? "—" : umaCasaBr(c.media)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Período", rel.periodo],
            [
              "Emitido em",
              rel.emitidoPor ? `${emitido} · ${rel.emitidoPor}` : emitido,
            ],
            ["Classificação", "Confidencial · RH"],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h2 className="relatorio__sumario-titulo">Sumário</h2>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {sumario.map(([n, t, texto, p]) => (
            <li key={n}>
              <span className="relatorio__sumario-numero">{n}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
                <span>{texto}</span>
              </span>
              <span className="relatorio__sumario-pagina">{p}</span>
            </li>
          ))}
        </ol>
        <div className="relatorio__quadro">
          <h3>Como ler este relatório</h3>
          <p>
            Cada pessoa dá uma nota de 0 a 10. O eNPS é o % de promotores (notas
            9 e 10) menos o % de detratores (notas 0 a 6) e vai de −100 a 100.
          </p>
          <ul className="relatorio__faixas" aria-label="Zonas do eNPS">
            {ZONAS_DO_ENPS.map((z) => (
              <li key={z.zona} data-faixa-enps={z.faixa}>
                <strong>{z.rotulo}</strong>
                <span>{intervaloDaZona(z.de, z.ate)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <h2 className="relatorio__titulo-interno">{detalhe.nome}</h2>
        <p className="pesquisas__suave">{`${empresa || "Empresa"} · ${plural(rel.respostas, "resposta", "respostas")}`}</p>
        <Secao numero="01" titulo="Resumo executivo">
          {comNota ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>eNPS</span>
                  <strong>{comSinal(comNota.indice!)}</strong>
                  <span>{zonaDoEnps(comNota.zona!).rotulo}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Respostas</span>
                  <strong>{rel.respostas}</strong>
                  <span>
                    {rel.convidados === null
                      ? "link aberto"
                      : ROTULO_DA_IDENTIFICACAO[rel.identificacao]}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Promotores</span>
                  <strong>{`${pctDe(comNota.promotores, comNota.respostas)}%`}</strong>
                  <span>{plural(comNota.promotores, "pessoa", "pessoas")}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Detratores</span>
                  <strong>{`${pctDe(comNota.detratores, comNota.respostas)}%`}</strong>
                  <span>{plural(comNota.detratores, "pessoa", "pessoas")}</span>
                </div>
              </div>
              <div className="relatorio__quadro">
                <h3>Principais conclusões</h3>
                <ol aria-label="Principais conclusões">
                  {conclusoesDoEnps(comNota, rotuloDe).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            oculto
          )}
        </Secao>
        <Secao numero="02" titulo="Quem respondeu o quê">
          {comNota ? (
            <div className="enps-relatorio__duas">
              <ul className="enps-relatorio__grupos">
                {gruposDoEnps(comNota).map((g) => (
                  <li key={g.grupo} data-grupo={g.grupo}>
                    <span>
                      <strong>{g.plural}</strong>
                      <span>{`notas ${g.notas} · ${plural(g.n, "pessoa", "pessoas")}`}</span>
                    </span>
                    <strong>{`${g.pct}%`}</strong>
                  </li>
                ))}
              </ul>
              <figure
                className="modelo-histograma"
                aria-label={`Distribuição das notas de 0 a 10: ${comNota.distribuicao.map((d) => `nota ${d.valor}, ${d.quantidade}`).join("; ")}`}
              >
                <ol>
                  {comNota.distribuicao.map((d) => (
                    <li key={d.valor}>
                      <span className="modelo-histograma__qtd">
                        {d.quantidade > 0 ? d.quantidade : ""}
                      </span>
                      <span
                        className="modelo-histograma__barra"
                        data-grupo={
                          d.valor >= 9
                            ? "promotor"
                            : d.valor >= 7
                              ? "neutro"
                              : "detrator"
                        }
                        style={{
                          height: `${(d.quantidade / Math.max(1, ...comNota.distribuicao.map((x) => x.quantidade))) * 100}%`,
                        }}
                        aria-hidden="true"
                      />
                      <span className="modelo-histograma__nota">{d.valor}</span>
                    </li>
                  ))}
                </ol>
              </figure>
            </div>
          ) : (
            oculto
          )}
        </Secao>
        <Secao numero="03" titulo="Perguntas complementares">
          {r && complementares.length > 0 ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Pergunta</th>
                  <th>0–6 · 7–8 · 9–10</th>
                  <th>Média</th>
                </tr>
              </thead>
              <tbody>
                {complementares.map((c) => (
                  <tr key={c.perguntaId}>
                    <td>
                      {textoParaOPainel(porId.get(c.perguntaId)?.texto ?? "")}
                    </td>
                    <td>
                      <span className="enps-distribuicao-celula">
                        <DistribuicaoDaComplementar
                          c={c}
                          rotulo={rotuloDe(c.perguntaId)}
                        />
                        <span>{`${c.detratores} · ${c.neutros} · ${plural(c.promotores, "pessoa", "pessoas")}`}</span>
                      </span>
                    </td>
                    <td>
                      {c.media === null ? (
                        "—"
                      ) : (
                        <span
                          className="enps-media"
                          data-grupo={grupoDaMedia(c.media)}
                        >
                          {umaCasaBr(c.media)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              {rel.numerosOcultos
                ? "Números ocultos."
                : "Esta pesquisa não tem perguntas complementares."}
            </p>
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        <Secao numero="04" titulo="eNPS por departamento">
          <p className="pesquisas__suave">{`Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} ficam ocultos`}</p>
          {!grupos ||
          grupos.linhas.filter((l) => l.grupoId !== null).length === 0 ? (
            <p className="relatorio__quadro">
              Sem departamento informado para agrupar as respostas.
            </p>
          ) : (
            <table
              className="relatorio__tabela"
              aria-label="eNPS por departamento"
            >
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col">eNPS</th>
                  <th scope="col">Zona</th>
                  <th scope="col">Respostas</th>
                </tr>
              </thead>
              <tbody>
                {grupos.linhas
                  .filter((l) => l.grupoId !== null)
                  .map((l) => (
                    <tr key={l.grupoId}>
                      <th scope="row">{l.nome}</th>
                      {l.visivel && l.enps ? (
                        <>
                          <td>{comSinal(l.enps.indice)}</td>
                          <td>
                            {TITULO_DA_ZONA[zonaDoIndice(l.enps.indice).zona]}
                          </td>
                          <td>{l.respostas}</td>
                        </>
                      ) : (
                        <td colSpan={3}>
                          {textoDoOculto(l.oculto, rel.minimoPorGrupo)}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Secao>
        <Secao numero="05" titulo="Evolução">
          <p className="pesquisas__suave">eNPS por pesquisa</p>
          {pontos.length >= 2 ? (
            <EvolucaoDoEnps pontos={pontos} />
          ) : (
            <p className="relatorio__quadro">
              A evolução aparece a partir da 2ª pesquisa eNPS.
            </p>
          )}
        </Secao>
        <Secao numero="06" titulo="Comentários e metodologia">
          {rel.numerosOcultos ? (
            <p>Números ocultos.</p>
          ) : comentarios.length === 0 ? (
            <p className="relatorio__quadro">Nenhuma resposta aberta.</p>
          ) : (
            <div className="enps-relatorio__colunas">
              {comentarios.map((c) => (
                <div
                  key={c.pergunta}
                  role="group"
                  aria-label={textoParaOPainel(c.pergunta)}
                  className="relatorio__quadro"
                >
                  <h3>{textoParaOPainel(c.pergunta)}</h3>
                  <ul className="relatorio__comentarios">
                    {c.textos.map((t, i) => (
                      <li key={i}>
                        {`“${t.texto}”`}
                        {identificada && t.autor ? (
                          <span>{t.autor}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="relatorio__quadro">
            {`eNPS = % de promotores (notas 9 e 10) − % de detratores (notas 0 a 6); os neutros (7 e 8) contam no total. Zonas: ${ZONAS_DO_ENPS.map((z) => `${z.rotulo} ${intervaloDaZona(z.de, z.ate)}`).join(" · ")}. Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não aparecem, para ninguém ser reconhecido.`}
          </p>
        </Secao>
      </Pagina>
    </div>
  );
}

export function RelatorioEnps({
  carregado,
  imprimir,
}: {
  readonly carregado: RelatorioCarregado;
  readonly imprimir: boolean;
}) {
  const titulo = nomeDoArquivo(
    [carregado.detalhe.nome, "relatorio"],
    "pdf",
  ).replace(/\.pdf$/, "");
  return (
    <Impressao titulo={titulo} imprimir={imprimir}>
      <DocumentoEnps carregado={carregado} />
    </Impressao>
  );
}
