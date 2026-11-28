/**
 * T216 — relatório em PDF do Onboarding (rota `#/pesquisas/<id>/relatorio`):
 * páginas A4 próprias, no padrão dos relatórios do módulo, em vez de
 * imprimir a tela.
 *
 * Capa: índice geral de cada rodada, o que mudou e o funil dos convites.
 * 01 Índice por rodada e blocos, 02 O que mudou entre as rodadas, 03
 * Vontade de ficar (intenção, motivo e recomendação), 04 Peso de cada
 * bloco e 05 Jornada (identificada), contatos e comentários. Cada rodada só
 * mostra números com 3 respostas ou mais; a lista de contatos não liga o
 * contato às respostas.
 */
import { useEffect, useState } from "react";
import type { Secao as SecaoDaPesquisa } from "../../../../api/pesquisasClient";
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
import { ROTULO_DA_IDENTIFICACAO } from "../../textosDasPesquisas";
import type {
  ClienteDoOnboarding,
  EnviosDoOnboarding,
  ResultadosDoOnboarding as Resultados,
} from "./cliente";
import {
  FAIXAS,
  rotuloDaIntencao,
  rotuloDaRodada,
  textosDasOpcoes,
} from "./envio";
import { ROTULO_DA_SITUACAO } from "./regrasDoOnboarding";

const sinal = (n: number | null) =>
  n === null ? "—" : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";

export function RelatorioDoOnboarding({
  pesquisaId,
  nome,
  secoes,
  empresa,
  imprimir,
  hoje,
  cliente,
}: {
  readonly pesquisaId: string;
  readonly nome: string;
  readonly secoes: readonly SecaoDaPesquisa[];
  readonly empresa: string;
  readonly imprimir: boolean;
  readonly hoje: string;
  readonly cliente: Pick<ClienteDoOnboarding, "resultados" | "envios">;
}) {
  const [dados, setDados] = useState<{
    r: Resultados;
    envios: EnviosDoOnboarding;
  } | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([cliente.resultados(pesquisaId), cliente.envios(pesquisaId)])
      .then(([r, envios]) => {
        if (vivo) setDados({ r, envios });
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [cliente, pesquisaId]);
  if (!dados) return <Carregando falhou={falhou} />;
  return (
    <Impressao
      titulo={nomeDoArquivo([nome, "relatorio"], "pdf").replace(/\.pdf$/, "")}
      imprimir={imprimir}
    >
      <DocumentoDoOnboarding
        r={dados.r}
        envios={dados.envios}
        nome={nome}
        secoes={secoes}
        empresa={empresa}
        hoje={hoje}
      />
    </Impressao>
  );
}

export function DocumentoDoOnboarding({
  r,
  envios,
  nome,
  secoes,
  empresa,
  hoje,
}: {
  readonly r: Resultados;
  readonly envios: EnviosDoOnboarding;
  readonly nome: string;
  readonly secoes: readonly SecaoDaPesquisa[];
  readonly empresa: string;
  readonly hoje: string;
}) {
  const mes = formatarCompetenciaPorExtenso(hoje.slice(0, 7)).toUpperCase();
  const rodadas = r.rodadas.map((x) => rotuloDaRodada(x.rodada));
  const visiveis = r.rodadas.filter((x) => x.visivel);
  const textoDaOpcao = textosDasOpcoes(secoes);
  const ultima = r.comparacoes.at(-1) ?? null;
  const total = 5;
  const cabecalho = {
    esquerda: "Pesquisa de Onboarding · Relatório de resultados",
    direita: `${nome} · Emitido em ${formatarDiaCivil(hoje)}`,
  };
  const rodape = (numero: number) => ({
    texto: `Documento confidencial · ${ROTULO_DA_IDENTIFICACAO[r.identificacao]}`,
    numero,
    total,
  });
  const titulo = (
    <div className="relatorio__titulo-interno">
      <h1>{nome}</h1>
      <p>{`${empresa || "Empresa"} · ${plural(r.respostas, "resposta", "respostas")}`}</p>
    </div>
  );
  const secoesDoSumario = [
    [
      "01",
      "Índice por rodada e blocos",
      "A nota de 0 a 100 de cada rodada e de cada bloco.",
    ],
    [
      "02",
      "O que mudou entre as rodadas",
      "A diferença de cada bloco desde a primeira rodada.",
    ],
    [
      "03",
      "Vontade de ficar",
      "Intenção nos próximos 6 meses, motivo para ficar e recomendação.",
    ],
    [
      "04",
      "Peso de cada bloco",
      "O quanto cada bloco anda junto com a vontade de ficar.",
    ],
    [
      "05",
      envios.jornadas
        ? "Jornada, contatos e comentários"
        : "Contatos e comentários",
      "Quem pediu conversa com o RH e o que foi escrito.",
    ],
  ] as const;
  const paginaDe = [3, 3, 4, 4, 5];

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
        <p className="relatorio__sobretitulo">{`Pesquisa de Onboarding · ${rodadas.join(" e ") || "Envio único"}`}</p>
        <h1 className="relatorio__capa-titulo">{nome}</h1>
        <p className="relatorio__capa-subtitulo">
          {`${empresa || "Empresa"} · ${plural(r.respostas, "resposta", "respostas")}`}
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao" aria-label="Índice geral">
            <p className="relatorio__cartao-titulo">
              Índice geral<span>de 0 a 100</span>
            </p>
            <ul className="relatorio__destaques">
              {r.rodadas.map((x) => (
                <li key={x.rodada}>
                  <span>{rotuloDaRodada(x.rodada)}</span>
                  <span className="relatorio__rotulo">
                    {x.visivel
                      ? x.faixa
                        ? FAIXAS[x.faixa].rotulo
                        : "—"
                      : `Faltam ${plural(x.faltam, "resposta", "respostas")}`}
                  </span>
                  <strong>{x.visivel ? (x.indice ?? "—") : "—"}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao" aria-label="O que mudou">
            <p className="relatorio__cartao-titulo">
              O que mudou
              <span>
                {ultima
                  ? `${rotuloDaRodada(ultima.de)} → ${rotuloDaRodada(ultima.para)}`
                  : "Uma rodada só"}
              </span>
            </p>
            <p className="relatorio__capa-nota">
              {ultima ? sinal(ultima.geral.mudou) : "—"}
            </p>
            <p>
              {ultima
                ? "pontos no índice geral"
                : "A comparação aparece com duas rodadas visíveis."}
            </p>
          </div>
          <div className="relatorio__cartao" aria-label="Funil dos convites">
            <p className="relatorio__cartao-titulo">Funil dos convites</p>
            <ul className="relatorio__destaques">
              {(
                [
                  ["No público", r.funil.noPublico],
                  ["Sem e-mail", r.funil.semEmail],
                  ["Aguardando e-mail", r.funil.aguardandoEmail],
                  ["Responderam", r.funil.responderam],
                ] as const
              ).map(([rotulo, n]) => (
                <li key={rotulo}>
                  <span>{rotulo}</span>
                  <span className="relatorio__rotulo" />
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Identificação", ROTULO_DA_IDENTIFICACAO[r.identificacao]],
            ["Emitido em", formatarDiaCivil(hoje)],
            ["Classificação", "Confidencial · uso do RH"],
          ]}
        />
      </Pagina>

      {/* Sumário */}
      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h1 className="relatorio__sumario-titulo">Sumário</h1>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {secoesDoSumario.map(([numero, t, texto], i) => (
            <li key={numero}>
              <span className="relatorio__sumario-numero">{numero}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
                <span>{texto}</span>
              </span>
              <span className="relatorio__sumario-pagina">{paginaDe[i]}</span>
            </li>
          ))}
        </ol>
        <div className="relatorio__quadro">
          <h2>Como ler este relatório</h2>
          <p>
            As respostas de concordância e satisfação viram uma nota de 0 a 100.
            Cada rodada só mostra números com 3 respostas ou mais, para ninguém
            ser identificado. A cor diz a faixa:
          </p>
          <ul className="relatorio__faixas" aria-label="Faixas do índice">
            {(Object.keys(FAIXAS) as (keyof typeof FAIXAS)[]).map((f) => (
              <li key={f}>
                <strong>{FAIXAS[f].faixa}</strong>
                <span>{FAIXAS[f].rotulo}</span>
              </li>
            ))}
          </ul>
        </div>
      </Pagina>

      {/* 01 e 02 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        {titulo}
        <Secao numero="01" titulo="Índice por rodada e blocos">
          {visiveis.length ? (
            <table className="relatorio__tabela" aria-label="Índice por bloco">
              <thead>
                <tr>
                  <th scope="col">Bloco</th>
                  {visiveis.map((x) => (
                    <th scope="col" key={x.rodada}>
                      {rotuloDaRodada(x.rodada)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Índice geral</th>
                  {visiveis.map((x) => (
                    <td key={x.rodada} className="relatorio__numero">
                      {x.indice ?? "—"}
                    </td>
                  ))}
                </tr>
                {visiveis[0]!.blocos.map((b) => (
                  <tr key={b.id}>
                    <td>{b.titulo}</td>
                    {visiveis.map((x) => {
                      const bx = x.blocos.find((y) => y.id === b.id);
                      return (
                        <td key={x.rodada} className="relatorio__numero">
                          {bx?.indice ?? "—"}
                          {bx?.faixa ? ` · ${FAIXAS[bx.faixa].rotulo}` : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              Nenhuma rodada tem 3 respostas ainda: os números aparecem a partir
              daí.
            </p>
          )}
        </Secao>
        <Secao numero="02" titulo="O que mudou entre as rodadas">
          {r.comparacoes.length ? (
            <table className="relatorio__tabela" aria-label="Mudança por bloco">
              <thead>
                <tr>
                  <th scope="col">Bloco</th>
                  {r.comparacoes.map((c) => (
                    <th scope="col" key={`${c.de}-${c.para}`}>
                      {`${rotuloDaRodada(c.de)} → ${rotuloDaRodada(c.para)}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Índice geral</th>
                  {r.comparacoes.map((c) => (
                    <td key={`${c.de}-${c.para}`} className="relatorio__numero">
                      {sinal(c.geral.mudou)}
                    </td>
                  ))}
                </tr>
                {r.comparacoes[0]!.blocos.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {visiveis[0]?.blocos.find((x) => x.id === b.id)?.titulo ??
                        b.id}
                    </td>
                    {r.comparacoes.map((c) => (
                      <td
                        key={`${c.de}-${c.para}`}
                        className="relatorio__numero"
                      >
                        {sinal(
                          c.blocos.find((x) => x.id === b.id)?.mudou ?? null,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              A comparação aparece quando duas rodadas têm 3 respostas ou mais.
            </p>
          )}
        </Secao>
      </Pagina>

      {/* 03 e 04 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        {titulo}
        <Secao numero="03" titulo="Vontade de ficar">
          {visiveis.some((x) => x.intencao || x.motivos || x.recomendacao) ? (
            <table className="relatorio__tabela" aria-label="Vontade de ficar">
              <thead>
                <tr>
                  <th scope="col">Rodada</th>
                  <th scope="col">Intenção nos próximos 6 meses</th>
                  <th scope="col">Principal motivo para ficar</th>
                  <th scope="col">Recomendação (0 a 10)</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((x) => (
                  <tr key={x.rodada}>
                    <td>{rotuloDaRodada(x.rodada)}</td>
                    <td>
                      {x.intencao
                        ? x.intencao.opcoes
                            .map(
                              (o) =>
                                `${rotuloDaIntencao(secoes, o.opcaoId)} ${o.percentual}%`,
                            )
                            .join(" · ")
                        : "—"}
                    </td>
                    <td>
                      {x.motivos
                        ? [...x.motivos.opcoes]
                            .sort((a, b) => b.quantidade - a.quantidade)
                            .slice(0, 3)
                            .map(
                              (o) =>
                                `${textoDaOpcao.get(o.opcaoId) ?? ""} ${o.percentual}%`,
                            )
                            .join(" · ")
                        : "—"}
                    </td>
                    <td className="relatorio__numero">
                      {x.recomendacao?.indice ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Sem rodada com 3 respostas ou mais ainda.</p>
          )}
          {r.fluxo?.visivel ? (
            <p>
              {`Para onde foi a intenção (${rotuloDaRodada(r.fluxo.de)} → ${rotuloDaRodada(r.fluxo.para)}): ${r.fluxo.fluxos
                .map(
                  (f) =>
                    `${rotuloDaIntencao(secoes, f.de)} → ${rotuloDaIntencao(secoes, f.para)}: ${plural(f.quantidade, "pessoa", "pessoas")}`,
                )
                .join("; ")}.`}
            </p>
          ) : null}
        </Secao>
        <Secao numero="04" titulo="Peso de cada bloco">
          {r.peso.suficiente ? (
            <table
              className="relatorio__tabela"
              aria-label="Peso de cada bloco"
            >
              <thead>
                <tr>
                  <th scope="col">Bloco</th>
                  <th scope="col">Nota</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Prioridade</th>
                </tr>
              </thead>
              <tbody>
                {r.peso.blocos.map((b) => (
                  <tr key={b.id}>
                    <td>{b.titulo}</td>
                    <td className="relatorio__numero">{b.indice ?? "—"}</td>
                    <td className="relatorio__numero">
                      {b.peso === null
                        ? "—"
                        : b.peso.toFixed(2).replace(".", ",")}
                    </td>
                    <td>{b.prioridade ? "Prioridade" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              O peso aparece com 20 respostas ou mais. Prioridade: nota abaixo
              de 70 e peso 0,4 ou mais.
            </p>
          )}
        </Secao>
      </Pagina>

      {/* 05 */}
      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        {titulo}
        <Secao numero="05" titulo={secoesDoSumario[4][1]}>
          {envios.jornadas?.length ? (
            <table className="relatorio__tabela" aria-label="Jornada">
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Admissão</th>
                  <th scope="col">Cargo · unidade</th>
                  <th scope="col">Rodadas</th>
                </tr>
              </thead>
              <tbody>
                {envios.jornadas.map((j) => (
                  <tr key={j.colaboradorId}>
                    <td>{j.nome}</td>
                    <td>{j.admissao ? formatarDiaCivil(j.admissao) : "—"}</td>
                    <td>
                      {[j.cargo, j.unidade].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td>
                      {j.rodadas
                        .map(
                          (x) =>
                            `${rotuloDaRodada(x.rodada)}: ${
                              ROTULO_DA_SITUACAO[
                                x.situacao as keyof typeof ROTULO_DA_SITUACAO
                              ] ?? x.situacao
                            }`,
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <h3>Quem quer conversar com o RH</h3>
          {r.contatos.length ? (
            <ul className="relatorio__comentarios">
              {r.contatos.map((c, i) => (
                <li key={`${c}-${i}`}>{c}</li>
              ))}
            </ul>
          ) : (
            <p>Nenhum contato deixado.</p>
          )}
          {r.melhorar.length || r.gosta.length ? (
            <>
              <h3>Comentários</h3>
              <ul className="relatorio__comentarios">
                {r.melhorar.map((t, i) => (
                  <li
                    key={`m-${i}`}
                  >{`O que poderia ter sido diferente: “${t}”`}</li>
                ))}
                {r.gosta.map((t, i) => (
                  <li
                    key={`g-${i}`}
                  >{`O que a pessoa quer que continue: “${t}”`}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Secao>
        <div className="relatorio__quadro" role="note">
          <h3>Metodologia</h3>
          <p>
            Índice de 0 a 100 por rodada e por bloco (concordância e satisfação
            de 4 pontos). Recomendação: % de notas 9 e 10 menos % de notas 0 a
            6. Peso: correlação de cada bloco com a vontade de ficar, com 20
            respostas ou mais. A lista de contatos não mostra nome, rodada nem
            data, para não ligar o contato às respostas.
          </p>
        </div>
      </Pagina>
    </div>
  );
}
