/**
 * T216 — relatório em PDF da Avaliação 90°/180° (rota
 * `#/pesquisas/<id>/relatorio`): páginas A4 próprias, no padrão dos
 * relatórios do módulo (capa, sumário, seções numeradas e rodapé
 * paginado), em vez de imprimir a tela. As notas são nominais: o documento
 * é de uso do RH e do DP.
 *
 * Capa: nota do time, nível, competências e grupos. 01 Resultado do time
 * (por competência), 02 Mapa de talentos, 03 Pessoas, 04 Calibração e
 * recortes, 05 (180°) Gestor × autoavaliação e a metodologia.
 */
import { useEffect, useState } from "react";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import {
  formatarCompetenciaPorExtenso,
  formatarDiaCivil,
} from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import {
  Carregando,
  Impressao,
  Pagina,
  RodapeDaCapa,
  Secao,
} from "../../RelatorioImprimivel";
import {
  ALINHAMENTO,
  CALIBRACAO,
  GRUPOS_DA_NOTA,
  MAPA,
  NIVEIS,
  ORDEM_DOS_NIVEIS,
  QUADRANTES,
  TEMPO_DE_CASA,
  competencia,
  diferenca1,
  item,
  nota1,
  type ModeloDeAvaliacao,
} from "./catalogo";
import type {
  ClienteDaAvaliacao,
  ResultadosDaAvaliacao as Resultados,
} from "./cliente";
import "../AvaliacaoOnboarding.css";

const CLASSIFICACAO = "Confidencial · nominal (RH e DP)";

/** A barra de uma nota de 1 a 5 (largura proporcional, cor do nível). */
function BarraDe1a5({ nota }: { readonly nota: number | null }) {
  const largura = nota === null ? 0 : ((nota - 1) / 4) * 100;
  return (
    <span className="relatorio__barra" aria-hidden="true">
      {nota !== null ? (
        <span
          className="relatorio__barra-cheia avaliacao__barra-relatorio"
          style={{ width: `${Math.max(largura, 2)}%` }}
        />
      ) : null}
    </span>
  );
}

export function RelatorioDaAvaliacao({
  pesquisaId,
  nome,
  modelo,
  empresa,
  imprimir,
  hoje,
  cliente,
}: {
  readonly pesquisaId: string;
  readonly nome: string;
  readonly modelo: ModeloDeAvaliacao;
  readonly empresa: string;
  readonly imprimir: boolean;
  readonly hoje: string;
  readonly cliente: Pick<ClienteDaAvaliacao, "resultados">;
}) {
  const [r, setR] = useState<Resultados | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    cliente
      .resultados(pesquisaId)
      .then((x) => {
        if (vivo) setR(x);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [cliente, pesquisaId]);
  if (!r) return <Carregando falhou={falhou} />;
  return (
    <Impressao
      titulo={nomeDoArquivo([nome, "relatorio"], "pdf").replace(/\.pdf$/, "")}
      imprimir={imprimir}
    >
      <DocumentoDaAvaliacao
        r={r}
        nome={nome}
        modelo={modelo}
        empresa={empresa}
        hoje={hoje}
      />
    </Impressao>
  );
}

export function DocumentoDaAvaliacao({
  r,
  nome,
  modelo,
  empresa,
  hoje,
}: {
  readonly r: Resultados;
  readonly nome: string;
  readonly modelo: ModeloDeAvaliacao;
  readonly empresa: string;
  readonly hoje: string;
}) {
  const e180 = modelo === "avaliacao180";
  const rotuloDoModelo = e180 ? "Avaliação 180°" : "Avaliação 90°";
  const mes = formatarCompetenciaPorExtenso(hoje.slice(0, 7)).toUpperCase();
  const nivel = r.time.nivel ? NIVEIS[r.time.nivel] : null;
  const nomeDe = new Map(r.pessoas.map((p) => [p.colaboradorId, p.nome]));
  const nomes = (ids: readonly string[]) =>
    ids.map((id) => nomeDe.get(id) ?? "").filter(Boolean);
  const comparativo =
    e180 && r.comparativo && r.comparativo.completas > 0 ? r.comparativo : null;
  const secoes = [
    [
      "01",
      "Resultado do time",
      "A média de cada competência e onde o time está mais baixo.",
    ],
    [
      "02",
      "Mapa de talentos",
      "Entrega × Pessoas e os grupos pela nota geral.",
    ],
    ["03", "Pessoas", "A nota, o nível e os alertas de cada pessoa avaliada."],
    [
      "04",
      "Calibração e recortes",
      "O critério de cada gestor, por tempo de casa e por departamento.",
    ],
    ...(comparativo
      ? [
          [
            "05",
            "Gestor × autoavaliação",
            "Onde as duas visões se encontram e onde se afastam.",
          ],
        ]
      : []),
  ] as const;
  const total = comparativo ? 6 : 5;
  const cabecalho = {
    esquerda: `${rotuloDoModelo} · Relatório de resultados`,
    direita: `${nome} · Emitido em ${formatarDiaCivil(hoje)}`,
  };
  const rodape = (numero: number) => ({
    texto: `Documento confidencial · ${plural(r.avaliadas, "pessoa avaliada", "pessoas avaliadas")}`,
    numero,
    total,
  });
  const titulo = (
    <div className="relatorio__titulo-interno">
      <h1>{nome}</h1>
      <p>{`${empresa || "Empresa"} · ${plural(r.avaliadas, "pessoa avaliada", "pessoas avaliadas")} de ${r.previstas}`}</p>
    </div>
  );

  return (
    <div className="relatorio" data-relatorio="">
      {/* Capa */}
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            {mes}
          </span>
        </div>
        <p className="relatorio__sobretitulo">{`Avaliação de desempenho · ${rotuloDoModelo}`}</p>
        <h1 className="relatorio__capa-titulo">{nome}</h1>
        <p className="relatorio__capa-subtitulo">
          {`${empresa || "Empresa"} · ${plural(r.avaliadas, "pessoa avaliada", "pessoas avaliadas")} de ${r.previstas}${e180 ? ` · ${plural(r.autoavaliacoes.respondidas, "autoavaliação", "autoavaliações")}` : ""}`}
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao" aria-label="Nota do time">
            <p className="relatorio__cartao-titulo">
              Nota do time<span>de 1 a 5</span>
            </p>
            <p className="relatorio__capa-nota">{nota1(r.time.media)}</p>
            {nivel ? (
              <span className="relatorio__selo">
                <span className="relatorio__selo-ponto" aria-hidden="true" />
                {nivel.rotulo}
              </span>
            ) : null}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Por competência<span>Média de 1 a 5</span>
            </p>
            <ul
              className="relatorio__lista-perguntas"
              aria-label="Média por competência"
            >
              {r.time.competencias.map((c) => (
                <li key={c.competencia}>
                  <span className="relatorio__rotulo">
                    {competencia(c.competencia).rotulo}
                  </span>
                  <BarraDe1a5 nota={c.media} />
                  <strong>{nota1(c.media)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Grupos pela nota</p>
            <ul className="relatorio__destaques" aria-label="Grupos pela nota">
              {(
                Object.keys(GRUPOS_DA_NOTA) as (keyof typeof GRUPOS_DA_NOTA)[]
              ).map((g) => (
                <li key={g}>
                  <span>{GRUPOS_DA_NOTA[g].regra}</span>
                  <span className="relatorio__rotulo">
                    {GRUPOS_DA_NOTA[g].rotulo}
                  </span>
                  <strong>{r.time.grupos[g].length}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Modelo", rotuloDoModelo],
            ["Emitido em", formatarDiaCivil(hoje)],
            ["Classificação", CLASSIFICACAO],
          ]}
        />
      </Pagina>

      {/* Sumário */}
      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h1 className="relatorio__sumario-titulo">Sumário</h1>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {secoes.map(([numero, t, texto], i) => (
            <li key={numero}>
              <span className="relatorio__sumario-numero">{numero}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
                <span>{texto}</span>
              </span>
              <span className="relatorio__sumario-pagina">
                {Math.min(3 + i, total)}
              </span>
            </li>
          ))}
        </ol>
        <div className="relatorio__quadro">
          <h2>Como ler este relatório</h2>
          <p>
            Cada afirmação vai de 1 (Insuficiente) a 5 (Excepcional). A
            competência é a média das 3 afirmações; a nota geral, a média das 8
            competências. O nível vem da nota arredondada:
          </p>
          <ul className="relatorio__faixas" aria-label="Níveis da nota">
            {ORDEM_DOS_NIVEIS.map((n) => (
              <li key={n}>
                <strong>{NIVEIS[n].faixa}</strong>
                <span>{NIVEIS[n].rotulo}</span>
              </li>
            ))}
          </ul>
        </div>
      </Pagina>

      {/* 01 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        {titulo}
        <Secao numero="01" titulo="Resultado do time">
          <table
            className="relatorio__tabela"
            aria-label="Resultado por competência"
          >
            <thead>
              <tr>
                <th scope="col">Competência</th>
                <th scope="col">Média</th>
                <th scope="col">Abaixo de 3</th>
                <th scope="col">Afirmação mais baixa</th>
              </tr>
            </thead>
            <tbody>
              {r.time.competencias.map((c) => (
                <tr key={c.competencia}>
                  <td>{competencia(c.competencia).rotulo}</td>
                  <td className="relatorio__numero">{nota1(c.media)}</td>
                  <td>{`${plural(c.abaixoDe3.length, "pessoa", "pessoas")} · ${c.percentualAbaixoDe3}%`}</td>
                  <td>
                    {c.menorAfirmacao
                      ? `${item(c.menorAfirmacao.itemId)?.rotulo ?? ""} · ${nota1(c.menorAfirmacao.media)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
      </Pagina>

      {/* 02 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        {titulo}
        <Secao numero="02" titulo="Mapa de talentos">
          <p>
            Entrega (o que a pessoa faz acontecer) × Pessoas (como trabalha com
            os outros). Alto: 4 ou mais; médio: 3 a 3,9; baixo: abaixo de 3.
          </p>
          <table className="relatorio__tabela" aria-label="Mapa de talentos">
            <thead>
              <tr>
                <th scope="col">Entrega × Pessoas</th>
                <th scope="col">Pessoas baixa</th>
                <th scope="col">Pessoas média</th>
                <th scope="col">Pessoas alta</th>
              </tr>
            </thead>
            <tbody>
              {MAPA.map((linha, i) => (
                <tr key={i}>
                  <th scope="row">
                    {["Entrega alta", "Entrega média", "Entrega baixa"][i]}
                  </th>
                  {linha.map((q) => (
                    <td key={q}>
                      <strong>{`${QUADRANTES[q].rotulo} · ${r.time.mapa[q].length}`}</strong>
                      {r.time.mapa[q].length ? (
                        <span className="relatorio__legenda">
                          {nomes(r.time.mapa[q]).join(", ")}
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ul
            className="relatorio__destaques"
            aria-label="Quem está em cada grupo"
          >
            {(
              Object.keys(GRUPOS_DA_NOTA) as (keyof typeof GRUPOS_DA_NOTA)[]
            ).map((g) => (
              <li key={g}>
                <span>{`${GRUPOS_DA_NOTA[g].rotulo} · ${r.time.grupos[g].length}`}</span>
                <span className="relatorio__rotulo">
                  {nomes(r.time.grupos[g]).join(", ") || "Ninguém"}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      </Pagina>

      {/* 03 e 04 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        {titulo}
        <Secao numero="03" titulo="Pessoas">
          <table className="relatorio__tabela" aria-label="Pessoas avaliadas">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Gestor</th>
                <th scope="col">Nota</th>
                <th scope="col">Nível</th>
                <th scope="col">Mapa de talentos</th>
                {e180 ? <th scope="col">Autoavaliação</th> : null}
                <th scope="col">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {r.pessoas.map((p) => (
                <tr key={p.colaboradorId}>
                  <td>{p.nome}</td>
                  <td>{p.gestor.nome}</td>
                  <td className="relatorio__numero">
                    {p.nota ? nota1(p.nota.geral) : "Pendente"}
                  </td>
                  <td>{p.nota?.nivel ? NIVEIS[p.nota.nivel].curto : "—"}</td>
                  <td>
                    {p.nota?.quadrante
                      ? QUADRANTES[p.nota.quadrante].rotulo
                      : "—"}
                  </td>
                  {e180 ? (
                    <td>
                      {!p.temAutoavaliacao
                        ? "Sem autoavaliação"
                        : p.autoavaliacao
                          ? `${nota1(p.autoavaliacao.geral)}${p.alinhamento ? ` · ${ALINHAMENTO[p.alinhamento]}` : ""}`
                          : "Pendente"}
                    </td>
                  ) : null}
                  <td>
                    {p.alertas.length === 0
                      ? "—"
                      : p.alertas
                          .map((a) =>
                            a.tipo === "linha_reta"
                              ? "Todas as 24 notas iguais"
                              : `${plural(a.competencias.length, "nota extrema", "notas extremas")} sem comentário`,
                          )
                          .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
        <Secao numero="04" titulo="Calibração e recortes">
          <table
            className="relatorio__tabela"
            aria-label="Calibração entre gestores"
          >
            <thead>
              <tr>
                <th scope="col">Gestor</th>
                <th scope="col">Avaliou</th>
                <th scope="col">Média dada</th>
                <th scope="col">Diferença</th>
                <th scope="col">Leitura</th>
              </tr>
            </thead>
            <tbody>
              {r.calibracao.map((c) => (
                <tr key={c.avaliadorId}>
                  <td>{c.nome}</td>
                  <td>{plural(c.avaliadas, "pessoa", "pessoas")}</td>
                  <td className="relatorio__numero">{nota1(c.media)}</td>
                  <td className="relatorio__numero">
                    {diferenca1(c.diferenca)}
                  </td>
                  <td>{CALIBRACAO[c.leitura]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="relatorio__tabela" aria-label="Recortes">
            <thead>
              <tr>
                <th scope="col">Recorte</th>
                <th scope="col">Grupo</th>
                <th scope="col">Avaliadas</th>
                <th scope="col">Média</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...r.recortes.tempoDeCasa.map((l) => ({
                  recorte: "Tempo de casa",
                  grupo:
                    TEMPO_DE_CASA[l.grupo as keyof typeof TEMPO_DE_CASA] ??
                    l.grupo,
                  l,
                })),
                ...r.recortes.departamento.map((l) => ({
                  recorte: "Departamento",
                  grupo: l.grupo,
                  l,
                })),
              ].map(({ recorte, grupo, l }) => (
                <tr key={`${recorte}-${l.grupo}`}>
                  <td>{recorte}</td>
                  <td>{grupo}</td>
                  <td>{l.avaliadas}</td>
                  <td className="relatorio__numero">
                    {l.visivel ? nota1(l.media) : "Oculto · menos de 3"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Secao>
        {comparativo ? null : <Metodologia />}
      </Pagina>

      {/* 05 (180°) */}
      {comparativo ? (
        <Pagina cabecalho={cabecalho} rodape={rodape(6)}>
          {titulo}
          <Secao numero="05" titulo="Gestor × autoavaliação">
            <p>
              {`${plural(comparativo.completas, "avaliação completa", "avaliações completas")} · ${plural(comparativo.acima, "pessoa se vê acima", "pessoas se veem acima")} · ${plural(comparativo.alinhadas, "alinhada", "alinhadas")} · ${comparativo.abaixo} abaixo`}
            </p>
            <table
              className="relatorio__tabela"
              aria-label="Gestor × autoavaliação"
            >
              <thead>
                <tr>
                  <th scope="col">Competência</th>
                  <th scope="col">Gestor</th>
                  <th scope="col">Autoavaliação</th>
                  <th scope="col">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {comparativo.competencias.map((c) => (
                  <tr key={c.competencia}>
                    <td>{competencia(c.competencia).rotulo}</td>
                    <td className="relatorio__numero">{nota1(c.gestor)}</td>
                    <td className="relatorio__numero">
                      {nota1(c.autoavaliacao)}
                    </td>
                    <td className="relatorio__numero">
                      {diferenca1(c.diferenca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
          <Metodologia />
        </Pagina>
      ) : null}
    </div>
  );
}

function Metodologia() {
  return (
    <div className="relatorio__quadro" role="note">
      <h3>Metodologia</h3>
      <p>
        Entrega = média de Responsabilidade, Organização, Proatividade e
        Resolução de problemas; Pessoas = média de Comunicação, Trabalho em
        equipe, Liderança e Adaptabilidade. Calibração: com 5 avaliações ou
        mais, diferença de 0,4 ou mais em relação à média da empresa indica
        outro critério. Recortes com menos de 3 pessoas avaliadas ficam ocultos.
        A nota é a percepção de um gestor: nunca use como critério único para
        promover ou desligar.
      </p>
    </div>
  );
}
