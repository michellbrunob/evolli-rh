/**
 * T216 — o relatório em PDF: páginas A4 desenhadas em HTML e SVG, abertas
 * numa aba própria (`#/pesquisas/<id>/relatorio` e
 * `#/pesquisas/<id>/respostas/<respostaId>/relatorio`) que chama a impressão
 * do navegador ("Salvar como PDF"). Vetorial, sem biblioteca nova; o nome
 * sugerido do arquivo vem do título do documento.
 *
 * Relatório de resultados: capa (medidor da média, por pergunta,
 * destaques e rodapé com empresa, período, emissão e classificação),
 * sumário e as seções 01 a 05 com rodapé paginado. Resultado individual:
 * capa no mesmo padrão e as respostas por pergunta.
 *
 * Privacidade: segue a identificação (ver `dadosDoRelatorio.ts`); o
 * resultado individual só existe fora da confidencial.
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type {
  Identificacao,
  PesquisaDetalhe,
  RespostaDetalhe,
} from "../../api/pesquisasClient";
import { MarcaEvolli } from "../../app/marca/MarcaEvolli";
import {
  diaCivilDeHoje,
  formatarDiaCivil,
  formatarInstante,
} from "../../format/data";
import { plural } from "../../format/plural";
import { Esqueleto } from "../../ui/movimento";
import { nomeDoArquivo } from "../dashboard/exportacao";
import {
  carregarRelatorio,
  type RelatorioCarregado,
} from "./carregarRelatorio";
import {
  NOME_DA_FAIXA,
  RESPOSTAS_DA_IDENTIFICACAO,
  textoDaFaixa,
  type RelatorioDeResultados,
} from "./dadosDoRelatorio";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { METODOLOGIA } from "./exportarResultados";
import {
  ROTULO_DA_FAIXA_DA_MEDIA,
  ehDeEscala,
  escalaDe,
  faixaDaMedia10,
  mediaNa10,
  type Faixa,
} from "./indicadores";
import { modeloDaGaleria } from "./modelosDePesquisa";
import { detalheParaOPainel } from "./modelos/empresa";
import { RespostasDaPessoa } from "./RespostasDaPessoa";
import { RelatorioDoModelo, temRelatorioProprio } from "./modelos/relatorio";
import { RelatorioClima } from "./modelos/clima/RelatorioClima";
import { temTelasDoClima } from "./modelos/clima/catalogo";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { percentual, textoDoOculto, umaCasa } from "./textosDasPesquisas";
import { DocumentoDisc } from "./modelos/disc/RelatorioDisc";
import "./RelatorioImprimivel.css";

const COR_DA_FAIXA: Readonly<Record<Faixa, string>> = {
  baixa: "var(--status-danger-ink)",
  media: "var(--turno-mostarda)",
  alta: "var(--turno-verde)",
};

/** Ponto na circunferência (ângulo em graus, 180 = esquerda, 0 = direita). */
function ponto(cx: number, cy: number, r: number, graus: number) {
  const rad = (graus * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/** Arco do medidor entre dois valores da escala de 0 a 10. */
function arco(r: number, de: number, ate: number) {
  const a = ponto(100, 100, r, 180 - de * 18);
  const b = ponto(100, 100, r, 180 - ate * 18);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** Medidor semicircular: trilha em três faixas e o arco até a média. */
export function Medidor({
  valor,
  rotulo,
}: {
  readonly valor: number | null;
  readonly rotulo: string;
}) {
  const v = valor === null ? 0 : Math.max(0, Math.min(10, valor));
  const marca = ponto(100, 100, 64, 180 - v * 18);
  return (
    <svg
      className="relatorio__medidor"
      viewBox="0 0 200 118"
      role="img"
      aria-label={rotulo}
    >
      <path
        d={arco(84, 0, 6.5)}
        stroke={COR_DA_FAIXA.baixa}
        className="relatorio__trilha"
      />
      <path
        d={arco(84, 6.5, 8)}
        stroke={COR_DA_FAIXA.media}
        className="relatorio__trilha"
      />
      <path
        d={arco(84, 8, 10)}
        stroke={COR_DA_FAIXA.alta}
        className="relatorio__trilha"
      />
      <path d={arco(64, 0, 10)} className="relatorio__fundo-do-arco" />
      {valor !== null && v > 0 ? (
        <path d={arco(64, 0, v)} className="relatorio__arco" />
      ) : null}
      {valor !== null ? (
        <circle
          cx={marca.x}
          cy={marca.y}
          r={6}
          className="relatorio__marcador"
        />
      ) : null}
      <text
        x={100}
        y={96}
        textAnchor="middle"
        className="relatorio__medidor-valor"
      >
        {valor === null ? "—" : umaCasa(valor)}
      </text>
    </svg>
  );
}

function SeloDaFaixa({ faixa }: { readonly faixa: Faixa | null }) {
  if (!faixa) return null;
  return (
    <span className="relatorio__selo" data-faixa={faixa}>
      <span className="relatorio__selo-ponto" aria-hidden="true" />
      {textoDaFaixa(faixa)}
    </span>
  );
}

/** Barra horizontal de uma média (0 a 10), com o traço opcional do time. */
function BarraDaMedia({
  valor,
  time,
}: {
  readonly valor: number | null;
  readonly time?: number | null;
}) {
  const f = valor === null ? null : faixaDaMedia10(valor);
  return (
    <span className="relatorio__barra">
      {valor !== null ? (
        <span
          className="relatorio__barra-cheia"
          style={{ width: `${valor * 10}%`, background: COR_DA_FAIXA[f!] }}
        />
      ) : null}
      {typeof time === "number" ? (
        <span
          className="relatorio__barra-time"
          style={{ left: `${time * 10}%` }}
        />
      ) : null}
    </span>
  );
}

export function RodapeDaCapa({
  itens,
}: {
  readonly itens: readonly (readonly [string, string])[];
}) {
  return (
    <dl className="relatorio__capa-rodape">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagina({
  children,
  capa = false,
  cabecalho,
  rodape,
}: {
  readonly children: ReactNode;
  readonly capa?: boolean;
  readonly cabecalho?: { readonly esquerda: string; readonly direita: string };
  readonly rodape?: {
    readonly texto: string;
    readonly numero: number;
    readonly total: number;
  };
}) {
  return (
    <section
      className={`relatorio__pagina${capa ? " relatorio__pagina--capa" : ""}`}
    >
      {cabecalho ? (
        <header className="relatorio__cabecalho">
          <span className="relatorio__cabecalho-esquerda">
            <MarcaEvolli variante="horizontal" altura={18} />
            <span>{cabecalho.esquerda}</span>
          </span>
          <span>{cabecalho.direita}</span>
        </header>
      ) : null}
      <div className="relatorio__conteudo">{children}</div>
      {rodape ? (
        <footer className="relatorio__rodape">
          <span>Gerado pelo Evolli RH</span>
          <span>{rodape.texto}</span>
          <span>{`${rodape.numero} / ${rodape.total}`}</span>
        </footer>
      ) : null}
    </section>
  );
}

export function Secao({
  numero,
  titulo,
  children,
}: {
  readonly numero: string;
  readonly titulo: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="relatorio__secao" aria-label={`${numero} ${titulo}`}>
      <h2 className="relatorio__secao-titulo">
        <span className="relatorio__secao-numero">{numero}</span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** As seções do sumário (a de departamento só com recorte). */
function secoesDo(rel: RelatorioDeResultados) {
  const base = [
    {
      chave: "resumo",
      titulo: "Resumo executivo",
      texto: "Média geral, eNPS e participação.",
    },
    {
      chave: "perguntas",
      titulo: "Resultados por pergunta",
      texto: "Distribuição, favorável e média de cada pergunta.",
    },
    ...(rel.departamentos
      ? [
          {
            chave: "departamentos",
            titulo: "Por grupo",
            texto: "A média de cada grupo; os pequenos ficam ocultos.",
          },
        ]
      : []),
    {
      chave: "evolucao",
      titulo: "Evolução",
      texto: "A média geral nas aplicações do mesmo modelo.",
    },
    {
      chave: "comentarios",
      titulo: "Comentários e metodologia",
      texto: "O que foi escrito e como os números são calculados.",
    },
  ];
  return base.map((s, i) => ({ ...s, numero: String(i + 1).padStart(2, "0") }));
}

/** O relatório de resultados, pronto para imprimir. */
export function DocumentoDoRelatorio({
  rel,
}: {
  readonly rel: RelatorioDeResultados;
}) {
  const secoes = secoesDo(rel);
  const numeroDe = (chave: string) =>
    secoes.find((s) => s.chave === chave)?.numero ?? "";
  const total = 5;
  const rodape = (numero: number) => ({
    texto: `Documento confidencial · ${RESPOSTAS_DA_IDENTIFICACAO[rel.identificacao]}`,
    numero,
    total,
  });
  const cabecalho = {
    esquerda: `${rel.modelo} · Relatório de resultados`,
    direita: `${rel.mesDeReferencia} · Emitido em ${formatarDiaCivil(rel.emitidoEm)}`,
  };
  const paginaDe: Record<string, number> = {
    resumo: 3,
    perguntas: 3,
    departamentos: 4,
    evolucao: 4,
    comentarios: 5,
  };
  const tituloDasPaginas = (
    <div className="relatorio__titulo-interno">
      <h1>{rel.nome}</h1>
      <p>{`${rel.empresa || "Empresa"} · ${plural(rel.respostas, "resposta", "respostas")}`}</p>
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
            {rel.mesDeReferencia}
          </span>
        </div>
        <p className="relatorio__sobretitulo">Relatório de resultados</p>
        <h1 className="relatorio__capa-titulo">{rel.modelo}</h1>
        <p className="relatorio__capa-subtitulo">{`${rel.empresa || "Empresa"} · ${rel.periodo}`}</p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao relatorio__cartao--medidor">
            <p className="relatorio__cartao-titulo">
              Média geral do time
              <span>{plural(rel.respostas, "resposta", "respostas")}</span>
            </p>
            <Medidor
              valor={rel.mediaGeral}
              rotulo={`Média geral ${rel.mediaGeral === null ? "sem dados" : umaCasa(rel.mediaGeral)} de 0 a 10`}
            />
            <SeloDaFaixa faixa={rel.faixaGeral} />
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Por pergunta<span>Média de 0 a 10</span>
            </p>
            <ul
              className="relatorio__lista-perguntas"
              aria-label="Média por pergunta"
            >
              {rel.perguntas.map((p) => (
                <li key={p.id}>
                  <span
                    className="relatorio__ponto"
                    style={{
                      background: p.faixa ? COR_DA_FAIXA[p.faixa] : undefined,
                    }}
                    aria-hidden="true"
                  />
                  <span className="relatorio__rotulo">{p.rotulo}</span>
                  <BarraDaMedia valor={p.media10} />
                  <strong>
                    {p.media10 === null ? "—" : umaCasa(p.media10)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Destaques</p>
            <ul className="relatorio__destaques" aria-label="Destaques">
              <li>
                <span>↑ Maior média</span>
                <span className="relatorio__rotulo">
                  {rel.maior?.rotulo ?? "—"}
                </span>
                <strong data-faixa="alta">
                  {rel.maior?.media10 != null
                    ? umaCasa(rel.maior.media10)
                    : "—"}
                </strong>
              </li>
              <li>
                <span>↓ Menor média</span>
                <span className="relatorio__rotulo">
                  {rel.menor?.rotulo ?? "—"}
                </span>
                <strong data-faixa="baixa">
                  {rel.menor?.media10 != null
                    ? umaCasa(rel.menor.media10)
                    : "—"}
                </strong>
              </li>
              <li>
                <span>+ eNPS</span>
                <span className="relatorio__rotulo">
                  {rel.enps?.rotuloDaZona ?? "Sem a pergunta de recomendação"}
                </span>
                <strong>{rel.enps ? String(rel.enps.indice) : "—"}</strong>
              </li>
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", rel.empresa || "—"],
            ["Período", rel.periodo],
            ["Emitido em", formatarDiaCivil(rel.emitidoEm)],
            ["Classificação", rel.classificacao],
          ]}
        />
      </Pagina>

      {/* Sumário */}
      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h1 className="relatorio__sumario-titulo">Sumário</h1>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {secoes.map((s) => (
            <li key={s.chave}>
              <span className="relatorio__sumario-numero">{s.numero}</span>
              <span className="relatorio__sumario-textos">
                <strong>{s.titulo}</strong>
                <span>{s.texto}</span>
              </span>
              <span className="relatorio__sumario-pagina">
                {paginaDe[s.chave]}
              </span>
            </li>
          ))}
        </ol>
        <div className="relatorio__quadro">
          <h2>Como ler este relatório</h2>
          <p>
            Toda média é mostrada de 0 a 10, mesmo quando a pergunta usa outra
            escala. A cor diz em que faixa a média está:
          </p>
          <ul className="relatorio__faixas" aria-label="Faixas da média">
            {(["baixa", "media", "alta"] as const).map((f) => (
              <li key={f} data-faixa={f}>
                <strong>{ROTULO_DA_FAIXA_DA_MEDIA[f]}</strong>
                <span>{NOME_DA_FAIXA[f]}</span>
              </li>
            ))}
          </ul>
        </div>
      </Pagina>

      {/* 01 e 02 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        {tituloDasPaginas}
        {rel.numerosOcultos ? (
          <div className="relatorio__quadro" role="note">
            <h3>Números ocultos</h3>
            <p>
              {`Esta pesquisa tem menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} por grupo: para proteger quem respondeu, médias, favorável, eNPS e comentários não aparecem.`}
            </p>
          </div>
        ) : null}
        <Secao numero={numeroDe("resumo")} titulo="Resumo executivo">
          <div className="relatorio__indicadores">
            <div className="relatorio__indicador relatorio__indicador--destaque">
              <span>Média geral</span>
              <strong>
                {rel.mediaGeral === null ? "—" : umaCasa(rel.mediaGeral)}
              </strong>
              <span>
                de 0 a 10
                {rel.faixaGeral ? ` · ${NOME_DA_FAIXA[rel.faixaGeral]}` : ""}
              </span>
            </div>
            <div className="relatorio__indicador">
              <span>eNPS</span>
              <strong>{rel.enps ? rel.enps.indice : "—"}</strong>
              <span>
                {rel.enps?.rotuloDaZona ?? "Sem a pergunta de recomendação"}
              </span>
            </div>
            <div className="relatorio__indicador">
              <span>Participação</span>
              <strong>
                {rel.participacao === null
                  ? rel.respostas
                  : `${rel.participacao}%`}
              </strong>
              <span>
                {rel.convidados === null
                  ? `${plural(rel.respostas, "resposta", "respostas")} pelo link aberto`
                  : `${rel.respostas} de ${plural(rel.convidados, "pessoa", "pessoas")}`}
              </span>
            </div>
          </div>
        </Secao>
        <Secao numero={numeroDe("perguntas")} titulo="Resultados por pergunta">
          <table
            className="relatorio__tabela"
            aria-label="Resultados por pergunta"
          >
            <thead>
              <tr>
                <th scope="col">Pergunta</th>
                <th scope="col">
                  Distribuição
                  <span className="relatorio__legenda">
                    desfavorável · neutro · favorável
                  </span>
                </th>
                <th scope="col">Fav.</th>
                <th scope="col">Média</th>
              </tr>
            </thead>
            <tbody>
              {rel.perguntas.map((p) => (
                <tr key={p.id}>
                  <td>{p.texto}</td>
                  <td>
                    <span className="relatorio__empilhada" aria-hidden="true">
                      <span
                        style={{
                          width: `${p.desfavoravel ?? 0}%`,
                          background: COR_DA_FAIXA.baixa,
                        }}
                      />
                      <span
                        style={{
                          width: `${p.neutro ?? 0}%`,
                          background: COR_DA_FAIXA.media,
                        }}
                      />
                      <span
                        style={{
                          width: `${p.favoravel ?? 0}%`,
                          background: COR_DA_FAIXA.alta,
                        }}
                      />
                    </span>
                  </td>
                  <td className="relatorio__numero">
                    {p.favoravel === null ? "—" : `${p.favoravel}%`}
                  </td>
                  <td
                    className="relatorio__numero"
                    data-faixa={p.faixa ?? undefined}
                  >
                    {p.media10 === null ? "—" : umaCasa(p.media10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rel.enps ? (
            <div className="relatorio__quadro relatorio__quadro--enps">
              <h3>Recomendação (eNPS)</h3>
              <p>
                {`${percentual(rel.enps.promotores, rel.enps.total)}% promotores · ${percentual(rel.enps.neutros, rel.enps.total)}% neutros · ${percentual(rel.enps.detratores, rel.enps.total)}% detratores`}
              </p>
              <span className="relatorio__empilhada" aria-hidden="true">
                <span
                  style={{
                    width: `${percentual(rel.enps.detratores, rel.enps.total)}%`,
                    background: COR_DA_FAIXA.baixa,
                  }}
                />
                <span
                  style={{
                    width: `${percentual(rel.enps.neutros, rel.enps.total)}%`,
                    background: COR_DA_FAIXA.media,
                  }}
                />
                <span
                  style={{
                    width: `${percentual(rel.enps.promotores, rel.enps.total)}%`,
                    background: COR_DA_FAIXA.alta,
                  }}
                />
              </span>
              <strong>{`eNPS ${rel.enps.indice} · ${rel.enps.rotuloDaZona}`}</strong>
            </div>
          ) : null}
        </Secao>
      </Pagina>

      {/* 03 e 04 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        {tituloDasPaginas}
        {rel.departamentos ? (
          <Secao numero={numeroDe("departamentos")} titulo="Por grupo">
            <table className="relatorio__tabela" aria-label="Média por grupo">
              <thead>
                <tr>
                  <th scope="col">Grupo</th>
                  <th scope="col">Respostas</th>
                  <th scope="col">Média</th>
                </tr>
              </thead>
              <tbody>
                {rel.departamentos.linhas.map((l) => (
                  <tr key={l.grupoId ?? "todos"}>
                    <td>{l.nome}</td>
                    <td className="relatorio__numero">
                      {l.visivel ? l.respostas : "—"}
                    </td>
                    <td
                      className="relatorio__numero"
                      data-faixa={
                        l.visivel && l.media !== null
                          ? faixaDaMedia10(l.media)
                          : undefined
                      }
                    >
                      {!l.visivel
                        ? textoDoOculto(l.oculto, rel.minimoPorGrupo)
                        : l.media === null
                          ? "—"
                          : umaCasa(l.media)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        ) : null}
        <Secao numero={numeroDe("evolucao")} titulo="Evolução">
          {rel.evolucao.length <= 1 ? (
            <div className="relatorio__quadro">
              <p>{`Esta é a primeira aplicação de ${rel.modelo} com respostas. A evolução aparece a partir da próxima.`}</p>
            </div>
          ) : (
            <ul
              className="relatorio__lista-perguntas"
              aria-label="Média geral por aplicação"
            >
              {rel.evolucao.map((e) => (
                <li key={e.pesquisaId}>
                  <span className="relatorio__rotulo">{`${e.nome} · ${formatarDiaCivil(diaCivilDeHoje(new Date(e.publicadaEm)))}`}</span>
                  <BarraDaMedia valor={e.mediaGeral} />
                  <strong>
                    {e.mediaGeral === null ? "—" : umaCasa(e.mediaGeral)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </Pagina>

      {/* 05 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        {tituloDasPaginas}
        <Secao
          numero={numeroDe("comentarios")}
          titulo="Comentários e metodologia"
        >
          {rel.comentarios.length === 0 ? (
            <div className="relatorio__quadro">
              <p>Nenhum comentário livre nesta pesquisa.</p>
            </div>
          ) : (
            rel.comentarios.map((c) => (
              <div key={c.pergunta} className="relatorio__quadro">
                <h3>
                  {c.pergunta}
                  <span>
                    {plural(c.textos.length, "comentário", "comentários")}
                  </span>
                </h3>
                <ul className="relatorio__comentarios">
                  {c.textos.map((t, i) => (
                    <li key={i}>
                      {`“${t.texto}”`}
                      {t.autor ? <span>{t.autor}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <div className="relatorio__quadro">
            <h3>Metodologia</h3>
            <dl className="relatorio__metodologia">
              {METODOLOGIA.map(([tema, texto]) => (
                <div key={tema}>
                  <dt>{tema}</dt>
                  <dd>{texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Secao>
      </Pagina>
    </div>
  );
}

const CLASSIFICACAO_INDIVIDUAL: Readonly<Record<Identificacao, string>> = {
  identificada: "Confidencial · identificada",
  confidencial: "Confidencial",
  anonima: "Confidencial · anônima",
};

/** O PDF de uma resposta: capa no mesmo padrão e as respostas. */
export function DocumentoDaResposta({
  detalhe,
  resposta: r,
  empresa,
  hoje,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly resposta: RespostaDetalhe;
  readonly empresa: string;
  readonly hoje: string;
}) {
  const identificada = detalhe.identificacao === "identificada" && r.nome;
  const titulo = identificada ? r.nome! : `Resposta anônima #${r.numero}`;
  const modelo = modeloDaGaleria(detalhe.modelo).nome;
  const todas = perguntasEmOrdem(detalhe.secoes);
  const porId = new Map(r.valores.map((v) => [v.perguntaId, v]));
  const escalas = todas
    .filter((p) => ehDeEscala(p) && !(p.tipo === "nota_0_10" && p.config.enps))
    .map((p) => {
      const v = porId.get(p.id);
      const e = escalaDe(p);
      const nota =
        v && typeof v.valor === "number" ? mediaNa10(v.valor, e) : null;
      const time = v && v.mediaTime !== null ? mediaNa10(v.mediaTime, e) : null;
      return { id: p.id, rotulo: p.rotulo || p.texto, nota, time };
    });
  const ind = r.indicadores;
  const comparado =
    ind.media !== null && ind.mediaTime !== null
      ? ind.media - ind.mediaTime
      : null;
  const sinal = (n: number) =>
    `${n > 0 ? "+" : n < 0 ? "−" : ""}${umaCasa(Math.abs(n))}`;
  const textoDe = (id: string | undefined) => {
    const p = todas.find((x) => x.id === id);
    return p ? p.rotulo || p.texto : "—";
  };
  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            Confidencial
          </span>
        </div>
        <p className="relatorio__sobretitulo">{`Resultado individual · ${modelo}`}</p>
        <h1 className="relatorio__capa-titulo">{titulo}</h1>
        <p className="relatorio__capa-subtitulo">
          {`${identificada ? (r.departamento ?? "Sem departamento") : "Identidade oculta"} · respondeu em ${formatarInstante(r.respondidaEm)}`}
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao relatorio__cartao--medidor">
            <p className="relatorio__cartao-titulo">
              Média das respostas
              <span>{plural(escalas.length, "pergunta", "perguntas")}</span>
            </p>
            <Medidor
              valor={ind.media}
              rotulo={`Média da resposta ${ind.media === null ? "sem dados" : umaCasa(ind.media)} de 0 a 10`}
            />
            {comparado !== null ? (
              <span
                className="relatorio__selo"
                data-faixa={comparado >= 0 ? "alta" : "baixa"}
              >
                <span className="relatorio__selo-ponto" aria-hidden="true" />
                {`${comparado >= 0 ? "Acima do time" : "Abaixo do time"} · ${umaCasa(ind.mediaTime!)}`}
              </span>
            ) : null}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Por pergunta<span>resposta · traço = média do time</span>
            </p>
            <ul
              className="relatorio__lista-perguntas"
              aria-label="Nota por pergunta"
            >
              {escalas.map((p) => (
                <li key={p.id}>
                  <span
                    className="relatorio__ponto"
                    style={{
                      background:
                        p.nota === null
                          ? undefined
                          : COR_DA_FAIXA[faixaDaMedia10(p.nota)],
                    }}
                    aria-hidden="true"
                  />
                  <span className="relatorio__rotulo">{p.rotulo}</span>
                  <BarraDaMedia valor={p.nota} time={p.time} />
                  <strong>{p.nota === null ? "—" : umaCasa(p.nota)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Destaques</p>
            <ul className="relatorio__destaques" aria-label="Destaques">
              <li>
                <span>↑ Maior nota</span>
                <span className="relatorio__rotulo">
                  {textoDe(ind.maior?.perguntaId)}
                </span>
                <strong data-faixa="alta">
                  {ind.maior ? umaCasa(ind.maior.valor) : "—"}
                </strong>
              </li>
              <li>
                <span>↓ Menor nota</span>
                <span className="relatorio__rotulo">
                  {textoDe(ind.menor?.perguntaId)}
                </span>
                <strong data-faixa="baixa">
                  {ind.menor ? umaCasa(ind.menor.valor) : "—"}
                </strong>
              </li>
              <li>
                <span>Comparado ao time</span>
                <span className="relatorio__rotulo">Média geral</span>
                <strong>{comparado === null ? "—" : sinal(comparado)}</strong>
              </li>
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Pesquisa", detalhe.nome],
            ["Emitido em", formatarDiaCivil(hoje)],
            ["Classificação", CLASSIFICACAO_INDIVIDUAL[detalhe.identificacao]],
          ]}
        />
      </Pagina>
      <Pagina
        cabecalho={{
          esquerda: `${modelo} · Resultado individual`,
          direita: `Emitido em ${formatarDiaCivil(hoje)}`,
        }}
        rodape={{
          texto: `Documento confidencial · ${RESPOSTAS_DA_IDENTIFICACAO[detalhe.identificacao]}`,
          numero: 2,
          total: 2,
        }}
      >
        <div className="relatorio__titulo-interno">
          <h1>{titulo}</h1>
          <p>{detalhe.nome}</p>
        </div>
        <RespostasDaPessoa
          rotulo={`Respostas de ${titulo}`}
          secoes={detalhe.secoes}
          valores={r.valores}
        />
      </Pagina>
    </div>
  );
}

/** Põe o documento direto no `body` (a impressão esconde o resto). */
export function Impressao({
  titulo,
  imprimir,
  children,
}: {
  readonly titulo: string;
  readonly imprimir: boolean;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    const antes = document.title;
    document.title = titulo;
    document.body.classList.add("relatorio-imprimindo");
    const t = imprimir
      ? window.setTimeout(() => {
          try {
            window.print();
          } catch {
            // Sem impressão (ambiente sem navegador): o documento fica na tela.
          }
        }, 400)
      : undefined;
    return () => {
      if (t !== undefined) window.clearTimeout(t);
      document.title = antes;
      document.body.classList.remove("relatorio-imprimindo");
    };
  }, [titulo, imprimir]);
  return createPortal(
    <div className="relatorio-raiz">{children}</div>,
    document.body,
  );
}

export function Carregando({ falhou }: { readonly falhou: boolean }) {
  return falhou ? (
    <p className="pesquisas__erro" role="alert">
      Não foi possível montar o relatório.
    </p>
  ) : (
    <Esqueleto rotulo="Montando o relatório…" linhas={4} />
  );
}

/** Rota `#/pesquisas/<id>/relatorio`. */
export function RelatorioDaPesquisa({
  servico,
  pesquisaId,
  imprimir = true,
  hoje = diaCivilDeHoje(),
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  readonly imprimir?: boolean;
  readonly hoje?: string;
}) {
  const [dados, setDados] = useState<RelatorioCarregado | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregarRelatorio(servico, pesquisaId, hoje)
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, hoje]);
  if (!dados) return <Carregando falhou={falhou} />;
  if (dados.detalhe.modelo === "disc")
    return (
      <DocumentoDisc
        servico={servico}
        detalhe={dados.detalhe}
        empresa={dados.empresa}
        imprimir={imprimir}
        hoje={hoje}
      />
    );
  // Pesquisa de Clima: o relatório próprio (modelos/clima).
  if (temTelasDoClima(dados.detalhe, dados.geral))
    return (
      <RelatorioClima carregado={dados} servico={servico} imprimir={imprimir} />
    );
  // Modelos com metodologia própria: o relatório deles (modelos/relatorio).
  if (temRelatorioProprio(dados.detalhe.modelo))
    return <RelatorioDoModelo carregado={dados} imprimir={imprimir} />;
  return (
    <Impressao
      titulo={nomeDoArquivo([dados.rel.nome, "resultados"], "pdf").replace(
        /\.pdf$/,
        "",
      )}
      imprimir={imprimir}
    >
      <DocumentoDoRelatorio rel={dados.rel} />
    </Impressao>
  );
}

/** Rota `#/pesquisas/<id>/respostas/<respostaId>/relatorio`. */
export function RelatorioDaResposta({
  servico,
  pesquisaId,
  respostaId,
  imprimir = true,
  hoje = diaCivilDeHoje(),
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  readonly respostaId: string;
  readonly imprimir?: boolean;
  readonly hoje?: string;
}) {
  const [dados, setDados] = useState<{
    detalhe: PesquisaDetalhe;
    resposta: RespostaDetalhe;
    empresa: string;
  } | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      Promise.resolve(servico.obterPesquisa(pesquisaId)),
      Promise.resolve(servico.respostaDaPesquisa(pesquisaId, respostaId)),
      Promise.resolve(servico.empresaAtiva()).catch(() => null),
    ])
      .then(([detalhe, resposta, empresa]) => {
        if (!vivo) return;
        // Na confidencial não há resultado individual.
        if (detalhe.identificacao === "confidencial") return setFalhou(true);
        setDados({
          detalhe: detalheParaOPainel(detalhe),
          resposta,
          empresa: empresa?.nome ?? "",
        });
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, respostaId]);
  if (!dados) return <Carregando falhou={falhou} />;
  if (dados.detalhe.modelo === "disc")
    return (
      <DocumentoDisc
        servico={servico}
        detalhe={dados.detalhe}
        empresa={dados.empresa}
        imprimir={imprimir}
        hoje={hoje}
        respostaId={respostaId}
      />
    );
  const titulo =
    dados.detalhe.identificacao === "identificada" && dados.resposta.nome
      ? dados.resposta.nome
      : `resposta ${dados.resposta.numero}`;
  return (
    <Impressao
      titulo={nomeDoArquivo([dados.detalhe.nome, titulo], "pdf").replace(
        /\.pdf$/,
        "",
      )}
      imprimir={imprimir}
    >
      <DocumentoDaResposta {...dados} hoje={hoje} />
    </Impressao>
  );
}
