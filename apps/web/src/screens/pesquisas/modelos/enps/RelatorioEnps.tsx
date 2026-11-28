/**
 * T216 — o relatório imprimível (PDF pelo navegador) do eNPS, no padrão
 * dos relatórios dos modelos (`modelos/relatorio.tsx`): capa com o eNPS,
 * a zona e os grupos; 01 resultado (medidor, conta e grupos); 02
 * distribuição das notas; 03 perguntas complementares; 04 respostas
 * abertas; 05 como ler (fórmula, zonas e proteção dos dados).
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
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import { BarraDasZonas } from "./SobreEnps";
import {
  FRASE_DA_ZONA,
  GRUPOS_DO_ENPS,
  TITULO_DA_ZONA,
  comSinal,
  pctDe,
  umaCasaBr,
  zonaDoEnps,
} from "./textos";
import { DistribuicaoDaComplementar, MedidorDoEnps } from "./VisaoGeralEnps";
import "../Modelos.css";
import "../Resultados.css";
import "./Enps.css";

const MESES = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

const mesEAno = (dia: string) =>
  `${MESES[Number(dia.slice(5, 7)) - 1] ?? ""} DE ${dia.slice(0, 4)}`;

function quantos(r: ResultadoDoEnps, grupo: string): number {
  return grupo === "promotor"
    ? r.promotores
    : grupo === "neutro"
      ? r.neutros
      : r.detratores;
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
  const total = 3;
  const cabecalho = {
    esquerda: "eNPS · Relatório de resultados",
    direita: `${detalhe.nome} · Gerado em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento confidencial",
    numero,
    total,
  });
  const comMedia = r?.complementares.filter((c) => c.media !== null) ?? [];
  const menor = comMedia.at(-1);
  const comAutor = rel.identificacao === "identificada";
  const oculto = (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            Recomendação da empresa
          </span>
        </div>
        <p className="relatorio__sobretitulo">{`ENPS · ${mesEAno(rel.emitidoEm)}`}</p>
        <h1 className="relatorio__capa-titulo">{detalhe.nome}</h1>
        <p className="relatorio__capa-subtitulo">
          Quanto as pessoas recomendariam a empresa como lugar para trabalhar e
          o que explica a nota.
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">eNPS do time</p>
            {comNota ? (
              <>
                <strong className="relatorio__numero">
                  {comSinal(comNota.indice!)}
                </strong>
                <span>{TITULO_DA_ZONA[comNota.zona!]}</span>
              </>
            ) : (
              <span>
                {rel.numerosOcultos ? "Números ocultos" : "Sem notas"}
              </span>
            )}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">{`${plural(rel.respostas, "resposta", "respostas")} · ${ROTULO_DA_IDENTIFICACAO[rel.identificacao].toLowerCase()}`}</p>
            <span>
              {rel.participacao !== null
                ? `Participação de ${rel.participacao}%`
                : "Link aberto"}
            </span>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Quem respondeu o quê</p>
            <ul className="relatorio__destaques">
              {comNota
                ? GRUPOS_DO_ENPS.map((g) => (
                    <li key={g.grupo}>
                      <span>{g.plural}</span>
                      <strong>{`${pctDe(quantos(comNota, g.grupo), comNota.respostas)}%`}</strong>
                    </li>
                  ))
                : null}
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Aplicação", rel.periodo],
            ["Instrumento", "eNPS"],
            ["Gerado em", emitido],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <Secao numero="01" titulo="Resultado">
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
                {TITULO_DA_ZONA[comNota.zona!]}
              </span>
              <p>{FRASE_DA_ZONA[comNota.zona!]}</p>
              <p className="enps-conta">{`${pctDe(comNota.promotores, comNota.respostas)}% promotores − ${pctDe(comNota.detratores, comNota.respostas)}% detratores = ${comNota.indice}`}</p>
            </div>
          ) : (
            oculto
          )}
          {comNota ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Notas</th>
                  <th>Pessoas</th>
                  <th>Do total</th>
                </tr>
              </thead>
              <tbody>
                {GRUPOS_DO_ENPS.map((g) => (
                  <tr key={g.grupo}>
                    <td>{g.plural}</td>
                    <td>{g.notas}</td>
                    <td>{quantos(comNota, g.grupo)}</td>
                    <td>{`${pctDe(quantos(comNota, g.grupo), comNota.respostas)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Secao>
        <Secao numero="02" titulo="Distribuição das notas">
          {comNota ? (
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
          ) : (
            <p>—</p>
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <Secao numero="03" titulo="Perguntas complementares">
          {r && r.complementares.length > 0 ? (
            <>
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>Pergunta</th>
                    <th>Distribuição (0–6 · 7–8 · 9–10)</th>
                    <th>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {r.complementares.map((c) => (
                    <tr key={c.perguntaId}>
                      <td>{rotuloDe(c.perguntaId)}</td>
                      <td>
                        <DistribuicaoDaComplementar
                          c={c}
                          rotulo={rotuloDe(c.perguntaId)}
                        />
                      </td>
                      <td>{c.media === null ? "—" : umaCasaBr(c.media)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {menor && comMedia.length > 1 ? (
                <p>{`${rotuloDe(menor.perguntaId)} é o ponto que mais pede atenção (média ${umaCasaBr(menor.media!)}).`}</p>
              ) : null}
            </>
          ) : (
            <p>
              {rel.numerosOcultos
                ? "Números ocultos."
                : "Esta pesquisa não tem perguntas complementares."}
            </p>
          )}
        </Secao>
        <Secao numero="04" titulo="Respostas abertas">
          {rel.numerosOcultos ? (
            <p>Números ocultos.</p>
          ) : rel.comentarios.every((c) => c.textos.length === 0) ? (
            <p>Nenhuma resposta aberta.</p>
          ) : (
            rel.comentarios
              .filter((c) => c.textos.length > 0)
              .map((c) => (
                <div key={c.pergunta} className="relatorio__quadro">
                  <h3>{textoParaOPainel(c.pergunta)}</h3>
                  <ul>
                    {c.textos.map((t, i) => (
                      <li key={i}>
                        {t.texto}
                        {comAutor && t.autor ? ` — ${t.autor}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </Secao>
        <Secao numero="05" titulo="Como ler">
          <p>
            eNPS = % de promotores (notas 9 e 10) − % de detratores (notas 0 a
            6). Os neutros (7 e 8) contam no total. O resultado vai de −100 a
            100.
          </p>
          <BarraDasZonas valor={comNota?.indice ?? null} />
          <p>{`Grupos com menos de ${plural(rel.minimoPorGrupo, "resposta", "respostas")} não aparecem nos recortes, para ninguém ser reconhecido.`}</p>
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
