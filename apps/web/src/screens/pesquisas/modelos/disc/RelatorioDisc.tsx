/**
 * T216 — Perfil comportamental (DISC): o relatório em PDF, no mesmo padrão
 * do módulo (páginas A4 em HTML e SVG, impressão do navegador).
 *
 * Time (4 páginas): capa com o perfil do time; resumo (01 composição,
 * 02 pessoas por fator, 03 diversidade, 04 pontos fortes e de atenção,
 * 05 o que move o time); 06 mapa de talentos; 07 como liderar, 08 lacunas e
 * 09 o que cada fator quer dizer. Individual: capa e o perfil completo
 * (só fora da confidencial, como a tela).
 */
import { useEffect, useState } from "react";
import type { PesquisaDetalhe } from "../../../../api/pesquisasClient";
import {
  formatarCompetenciaPorExtenso,
  formatarDiaCivil,
} from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { MarcaEvolli } from "../../../../app/marca/MarcaEvolli";
import { nomeDoArquivo } from "../../../dashboard/exportacao";
import {
  Carregando,
  Impressao,
  Pagina,
  RodapeDaCapa,
  Secao,
} from "../../RelatorioImprimivel";
import type { ServicoDePesquisas } from "../../servicoDePesquisas";
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import { areaPorId } from "./areas";
import { FATOR, FATORES } from "./fatores";
import {
  BarraDisc,
  LetraDoFator,
  MapaDeTalentos,
  ROTULO_DA_DIVERSIDADE,
  ReguaDaDiversidade,
  TEXTO_DA_DIVERSIDADE,
} from "./graficosDisc";
import { PerfilDaPessoa } from "./PerfilDaPessoa";
import { codigoDoPerfil, conteudoDoPerfil } from "./perfis";
import { nomeDaPessoa } from "./ResultadosDisc";
import { perfilComportamental, type ResultadoDisc } from "./tiposDisc";
import "./Disc.css";

const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0;

export function DocumentoDisc({
  servico,
  detalhe,
  empresa,
  imprimir,
  hoje,
  respostaId,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly empresa: string;
  readonly imprimir: boolean;
  readonly hoje: string;
  /** Com ele, o relatório individual da resposta. */
  readonly respostaId?: string;
}) {
  const [dados, setDados] = useState<ResultadoDisc | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.resolve(
      (servico.perfilComportamental ?? perfilComportamental)(detalhe.id),
    )
      .then((r) => {
        if (vivo) setDados(r);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id]);
  if (!dados) return <Carregando falhou={falhou} />;
  const mes = formatarCompetenciaPorExtenso(hoje.slice(0, 7)).toUpperCase();
  if (respostaId !== undefined) {
    const pessoa = dados.pessoas.find((p) => p.respostaId === respostaId);
    if (!pessoa) return <Carregando falhou />;
    const nome = nomeDaPessoa(pessoa);
    return (
      <Impressao
        titulo={nomeDoArquivo([detalhe.nome, nome], "pdf").replace(
          /\.pdf$/,
          "",
        )}
        imprimir={imprimir}
      >
        <div className="relatorio" data-relatorio="">
          <Pagina
            cabecalho={{
              esquerda: "Perfil comportamental · Resultado individual",
              direita: `${detalhe.nome} · ${formatarDiaCivil(hoje)}`,
            }}
            rodape={{
              texto: "Documento confidencial · uso interno",
              numero: 1,
              total: 1,
            }}
          >
            <div className="relatorio__titulo-interno">
              <h1>{nome}</h1>
              <p>{`${empresa || "Empresa"} · ${detalhe.nome}`}</p>
            </div>
            <PerfilDaPessoa perfil={pessoa.perfil} />
          </Pagina>
        </div>
      </Impressao>
    );
  }

  const time = dados.perfil;
  const c = time ? conteudoDoPerfil(time.classe) : null;
  const pessoas = dados.totalDePessoas;
  const total = 4;
  const cabecalho = {
    esquerda: "Perfil comportamental do time",
    direita: `${detalhe.nome} · ${formatarDiaCivil(hoje)}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento confidencial · uso interno",
    numero,
    total,
  });
  const contagem = new Map(dados.areas.map((a) => [a.area, a.pessoas]));

  return (
    <Impressao
      titulo={nomeDoArquivo([detalhe.nome, "perfil do time"], "pdf").replace(
        /\.pdf$/,
        "",
      )}
      imprimir={imprimir}
    >
      <div className="relatorio" data-relatorio="">
        <Pagina capa>
          <div className="relatorio__capa-topo">
            <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
            <span className="relatorio__pilula-capa">
              <span className="relatorio__selo-ponto" aria-hidden="true" />
              {mes}
            </span>
          </div>
          <p className="relatorio__sobretitulo">{`Perfil comportamental · ${mes}`}</p>
          <h1 className="relatorio__capa-titulo">Perfil do time</h1>
          <p className="relatorio__capa-subtitulo">
            {`${detalhe.nome} · ${plural(pessoas, "pessoa respondeu", "pessoas responderam")}`}
          </p>
          <div className="relatorio__cartao">
            {time && c ? (
              <>
                <div className="disc__time-cabeca">
                  <span className="disc__letras">
                    {time.classe.fatores.map((f) => (
                      <LetraDoFator key={f} fator={f} tamanho="md" />
                    ))}
                  </span>
                  <h2 className="disc__time-titulo">
                    {c.titulo}{" "}
                    <span className="disc__codigo">
                      {codigoDoPerfil(time.classe)}
                    </span>
                  </h2>
                </div>
                <BarraDisc
                  percentuais={time.percentuais}
                  rotulo="Composição do time"
                />
                <ul className="disc__grade disc__grade--4">
                  {FATORES.map((f) => (
                    <li key={f} className="disc__cartao">
                      <span className="disc__cartao-topo">
                        <LetraDoFator fator={f} tamanho="sm" />
                        {FATOR[f].nome}
                      </span>
                      <p className="disc__cartao-numero">
                        {dados.porPredominante[f]}
                      </p>
                      <p>
                        {dados.porPredominante[f] === 1 ? "pessoa" : "pessoas"}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Ainda não há respostas suficientes para o perfil do time.</p>
            )}
          </div>
          <RodapeDaCapa
            itens={[
              ["Empresa", empresa || "—"],
              ["Respostas", String(dados.respostas)],
              ["Identificação", ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]],
              ["Gerado em", formatarDiaCivil(hoje)],
            ]}
          />
        </Pagina>

        {time && c ? (
          <>
            <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
              <div className="relatorio__titulo-interno">
                <h1>Resumo do time</h1>
                <p>{`${empresa || "Empresa"} · ${plural(pessoas, "pessoa", "pessoas")}`}</p>
              </div>
              <Secao numero="01" titulo="Composição do perfil">
                <p>{`${c.titulo} (${codigoDoPerfil(time.classe)}): ${c.resumo}`}</p>
                <BarraDisc
                  percentuais={time.percentuais}
                  rotulo="Composição do time"
                />
              </Secao>
              <Secao numero="02" titulo="Colaboradores por perfil predominante">
                <table className="disc__tabela">
                  <thead>
                    <tr>
                      <th scope="col">Fator</th>
                      <th scope="col" className="disc__tabela-numero">
                        Pessoas
                      </th>
                      <th scope="col" className="disc__tabela-numero">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FATORES.map((f) => (
                      <tr key={f}>
                        <td>{`${f} · ${FATOR[f].nome}`}</td>
                        <td className="disc__tabela-numero">
                          {dados.porPredominante[f]}
                        </td>
                        <td className="disc__tabela-numero">
                          {`${pct(dados.porPredominante[f], pessoas)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Secao>
              <Secao numero="03" titulo="Diversidade comportamental">
                <p className="disc__diversidade-numero">
                  {dados.diversidade.score}
                  <span>{`de 100 · ${ROTULO_DA_DIVERSIDADE[dados.diversidade.faixa]}`}</span>
                </p>
                <ReguaDaDiversidade score={dados.diversidade.score} />
                <p>{TEXTO_DA_DIVERSIDADE[dados.diversidade.faixa]}</p>
                {dados.diversidade.ausentes.map((f) => (
                  <p
                    key={f}
                  >{`Fator ausente — ${FATOR[f].nome}: ${FATOR[f].risco}`}</p>
                ))}
              </Secao>
              <Secao numero="04" titulo="Pontos fortes e de atenção">
                <div className="disc__grade">
                  <div className="disc__cartao">
                    <h3 className="disc__subtitulo">Pontos fortes</h3>
                    <ul className="disc__lista">
                      {c.fortes.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="disc__cartao">
                    <h3 className="disc__subtitulo">Pontos de atenção</h3>
                    <ul className="disc__lista">
                      {c.atencao.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Secao>
              <Secao numero="05" titulo="O que move o time">
                <dl className="disc__linhas">
                  <div>
                    <dt>Medo básico</dt>
                    <dd>{c.medo}</dd>
                  </div>
                  <div>
                    <dt>O que motiva</dt>
                    <dd>{c.motivacao}</dd>
                  </div>
                  <div>
                    <dt>Valor para a empresa</dt>
                    <dd>{c.valor}</dd>
                  </div>
                </dl>
              </Secao>
            </Pagina>

            <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
              <Secao numero="06" titulo="Mapa de talentos">
                <MapaDeTalentos
                  pontos={dados.pontos}
                  centro={time.posicao}
                  contagem={contagem}
                />
                <p>
                  {`Centro do time: ${areaPorId(time.posicao.area)?.nome ?? "—"} — ${areaPorId(time.posicao.area)?.frase ?? ""}`}
                </p>
                <h3 className="disc__subtitulo">Áreas com mais pessoas</h3>
                <ul className="disc__lista">
                  {dados.areas.slice(0, 3).map((a) => (
                    <li key={a.area}>
                      {`${areaPorId(a.area)?.nome ?? "Área"}: ${plural(a.pessoas, "pessoa", "pessoas")} · ${areaPorId(a.area)?.cargos.join(", ") ?? ""}`}
                    </li>
                  ))}
                </ul>
              </Secao>
            </Pagina>

            <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
              <Secao numero="07" titulo="Como liderar este time">
                <dl className="disc__linhas">
                  {(
                    [
                      ["Onde brilha", c.fortes.slice(0, 3).join("; ")],
                      ["Cuidado com", c.atencao.slice(0, 3).join("; ")],
                      ["Como dar retorno", c.feedback.join("; ")],
                      ["Como motivar", c.motivar.join("; ")],
                      ["Estilo de comunicação", c.comunicacao],
                      ["Ambiente ideal", c.ambiente],
                    ] as const
                  ).map(([rotulo, texto]) => (
                    <div key={rotulo}>
                      <dt>{rotulo}</dt>
                      <dd>{texto}</dd>
                    </div>
                  ))}
                </dl>
              </Secao>
              <Secao numero="08" titulo="Lacunas e próximas contratações">
                {dados.lacunas.length ? (
                  <ul className="disc__lista">
                    {dados.lacunas.map((f) => (
                      <li
                        key={f}
                      >{`Reforçar ${FATOR[f].nome}: ${FATOR[f].reforco}`}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum fator abaixo de 20% das pessoas.</p>
                )}
              </Secao>
              <Secao numero="09" titulo="O que cada fator quer dizer">
                <table className="disc__tabela">
                  <thead>
                    <tr>
                      <th scope="col">Fator</th>
                      <th scope="col">Quando alto</th>
                      <th scope="col">Quando baixo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FATORES.map((f) => (
                      <tr key={f}>
                        <td>{`${FATOR[f].nome} (${f})`}</td>
                        <td>{FATOR[f].quandoAlto}</td>
                        <td>{FATOR[f].quandoBaixo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Secao>
            </Pagina>
          </>
        ) : null}
      </div>
    </Impressao>
  );
}
