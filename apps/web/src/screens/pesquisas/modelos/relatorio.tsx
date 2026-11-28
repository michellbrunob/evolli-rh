/**
 * T216 — o relatório imprimível (PDF pelo navegador) dos modelos com
 * metodologia própria, no padrão do módulo (`RelatorioImprimivel`).
 *
 * NR-1: capa, ficha técnica e sumário, 01 resumo executivo, 02 inventário
 * de riscos (matriz e como agir), 03 perfil das 29 dimensões, 04 saúde e
 * comportamentos ofensivos, 05 plano de ação (o do RH), 06 conformidade,
 * metodologia e campos de assinatura.
 * Saúde financeira: capa, sumário e como ler, resumo, distribuição e
 * sinais, dimensões, perguntas, base, crédito × reserva, perfis, renda,
 * sinais acumulados, temas, abertura a apoio e próximos passos.
 */
import { useEffect, useState } from "react";
import {
  SERVICO_DOS_MODELOS,
  type AcompanhamentoNr1,
  type ResultadoDoPainel,
  type ServicoDosModelos,
} from "../../../api/modelosDePesquisaClient";
import type { ModeloPesquisa } from "../../../api/pesquisasClient";
import { MarcaEvolli } from "../../../app/marca/MarcaEvolli";
import { formatarDiaCivil, formatarInstante } from "../../../format/data";
import { plural } from "../../../format/plural";
import { nomeDoArquivo } from "../../dashboard/exportacao";
import type { RelatorioCarregado } from "../carregarRelatorio";
import {
  Carregando,
  Impressao,
  Pagina,
  RodapeDaCapa,
  Secao,
} from "../RelatorioImprimivel";
import { ROTULO_DA_IDENTIFICACAO } from "../textosDasPesquisas";
import { DOMINIOS_NR1, TIPOS_DE_OFENSA, dimensaoNr1 } from "./copsoq/definicao";
import {
  COR_DO_FATOR,
  CONTROLES,
  ETAPAS_DA_CONFORMIDADE,
  MATRIZ,
  NIVEIS,
  NIVEL,
  ROTULO_DA_PREVALENCIA,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_CONTROLE,
  ROTULO_DO_GRAU,
  ROTULO_DO_INDICADOR,
  decimal,
  porcento,
} from "./copsoq/textos";
import { partesDaDistribuicao } from "./copsoq/VisaoGeralNr1";
import { etapaIsfb, itemIsfb, PRODUTOS } from "./isfb/definicao";
import {
  ABERTURA,
  ABERTURAS,
  FAIXAS_ISFB,
  FAIXA_ISFB,
  PERFIL,
  PERFIS,
  RENDA,
  SAUDE,
  SINAIS,
  SINAL,
  TEMA,
  COR_DA_RESPOSTA,
  diferenca,
  umaCasaBr,
} from "./isfb/textos";
import { leituraAutomatica } from "./isfb/VisaoGeralIsfb";
import { painelDe } from "./registro";
import { DocumentoPulsoClima } from "./pulso_clima/RelatorioPulsoClima";
import { DocumentoTad } from "./tad/RelatorioTad";
import {
  BarraDeFaixas,
  BarraPercentual,
  Quadradinhos,
  pessoasOuSigilo,
} from "./ui";
import "./Modelos.css";

export const temRelatorioProprio = (m: ModeloPesquisa): boolean =>
  m === "copsoq" || m === "isfb" || m === "pulso_clima" || m === "tad";

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

function mesEAno(dia: string): string {
  const [ano, mes] = dia.split("-");
  return `${MESES[Number(mes) - 1] ?? ""} DE ${ano}`;
}

export function RelatorioDoModelo({
  carregado,
  imprimir,
  servico = SERVICO_DOS_MODELOS,
}: {
  readonly carregado: RelatorioCarregado;
  readonly imprimir: boolean;
  readonly servico?: ServicoDosModelos;
}) {
  const { detalhe } = carregado;
  // O resultado do modelo já vem nos resultados da pesquisa; a NR-1 traz
  // também o acompanhamento (plano e etapas).
  const resultado = painelDe(detalhe, carregado.geral);
  const [acompanhamento, setAcompanhamento] =
    useState<AcompanhamentoNr1 | null>(null);
  const [pronto, setPronto] = useState(detalhe.modelo !== "copsoq");
  useEffect(() => {
    if (detalhe.modelo !== "copsoq") return;
    let vivo = true;
    Promise.resolve(servico.acompanhamentoNr1(detalhe.id))
      .catch(() => null)
      .then((a) => {
        if (!vivo) return;
        setAcompanhamento(a);
        setPronto(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, detalhe.id, detalhe.modelo]);
  if (!pronto) return <Carregando falhou={false} />;
  const dados = { resultado, acompanhamento };
  const titulo = nomeDoArquivo([detalhe.nome, "relatorio"], "pdf").replace(
    /\.pdf$/,
    "",
  );
  return (
    <Impressao titulo={titulo} imprimir={imprimir}>
      {detalhe.modelo === "pulso_clima" ? (
        <DocumentoPulsoClima
          carregado={carregado}
          r={
            carregado.geral.modelo?.modelo === "pulso_clima"
              ? carregado.geral.modelo
              : null
          }
        />
      ) : detalhe.modelo === "tad" ? (
        <DocumentoTad
          carregado={carregado}
          r={
            carregado.geral.modelo?.modelo === "tad"
              ? carregado.geral.modelo
              : null
          }
        />
      ) : detalhe.modelo === "copsoq" ? (
        <DocumentoNr1 carregado={carregado} {...dados} />
      ) : (
        <DocumentoIsfb carregado={carregado} resultado={dados.resultado} />
      )}
    </Impressao>
  );
}

function NumerosOcultos({ minimo }: { readonly minimo: number }) {
  return (
    <div className="relatorio__quadro" role="note">
      <h3>Números ocultos</h3>
      <p>{`Menos de ${plural(minimo, "resposta", "respostas")}: para proteger quem respondeu, os resultados não aparecem.`}</p>
    </div>
  );
}

export function DocumentoNr1({
  carregado,
  resultado,
  acompanhamento,
}: {
  readonly carregado: RelatorioCarregado;
  readonly resultado: ResultadoDoPainel;
  readonly acompanhamento: AcompanhamentoNr1 | null;
}) {
  const { detalhe, empresa, rel } = carregado;
  const r = resultado.visivel ? resultado.nr1 : null;
  const total = 8;
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const cabecalho = {
    esquerda: "NR-1 · Relatório de riscos psicossociais",
    direita: `Riscos psicossociais · Gerado em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento confidencial · anexo do PGR",
    numero,
    total,
  });
  const porId = new Map(r?.dimensoes.map((d) => [d.id, d]) ?? []);
  const emAcao = r
    ? r.prioridades.filter((id) =>
        ["critico", "alto"].includes(porId.get(id)!.nivel ?? ""),
      )
    : [];
  const minimo = resultado.minimoPorGrupo;
  const sumario = [
    ["01", "Resumo executivo", 3],
    ["02", "Inventário de riscos", 4],
    ["03", "Perfil das 29 dimensões", 5],
    ["04", "Saúde e comportamentos ofensivos", 6],
    ["05", "Plano de ação", 7],
    ["06", "Conformidade e aprovação", 8],
  ] as const;

  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            Inventário de riscos · PGR
          </span>
        </div>
        <p className="relatorio__sobretitulo">{`NR-1 · RISCOS PSICOSSOCIAIS · ${mesEAno(rel.emitidoEm)}`}</p>
        <h1 className="relatorio__capa-titulo">
          Riscos psicossociais no trabalho
        </h1>
        <p className="relatorio__capa-subtitulo">
          Inventário dos 29 aspectos do trabalho que afetam a saúde mental, para
          o PGR.
        </p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Nível de risco das 29 dimensões
            </p>
            {r ? (
              <>
                <strong className="relatorio__numero">
                  {r.precisamDeAcao}
                </strong>
                <span>em risco alto ou crítico</span>
                <Quadradinhos
                  cores={r.prioridades.map(
                    (id) => NIVEL[porId.get(id)!.nivel!].cor,
                  )}
                  rotulo="Dimensões por nível"
                />
                <ul className="relatorio__destaques">
                  {NIVEIS.map((n) => (
                    <li key={n}>
                      <span>{NIVEL[n].rotulo}</span>
                      <strong>{r.niveis[n]}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <span>Números ocultos</span>
            )}
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">{`${plural(resultado.respostas, "resposta", "respostas")} · ${ROTULO_DA_IDENTIFICACAO[detalhe.identificacao].toLowerCase()}`}</p>
            <span>
              {rel.participacao !== null
                ? `Participação de ${rel.participacao}%`
                : "Link aberto"}
            </span>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Prioridades</p>
            <ul className="relatorio__destaques">
              {emAcao.slice(0, 3).map((id) => (
                <li key={id}>
                  <span>{dimensaoNr1(id).rotulo}</span>
                  <strong>{porcento(porId.get(id)!.percentuais.risco)}</strong>
                </li>
              ))}
              {emAcao.length === 0 ? (
                <li>
                  <span>Nenhuma dimensão em nível alto ou crítico</span>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Aplicação", rel.periodo],
            ["Instrumento", "Riscos psicossociais (NR-1)"],
            ["Gerado em", emitido],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <h1 className="relatorio__sumario-titulo">Ficha técnica</h1>
        <p className="relatorio__rotulo">
          Informações da aplicação para registro no PGR
        </p>
        <table className="relatorio__tabela">
          <tbody>
            <tr>
              <th>Empresa</th>
              <td>{empresa || "—"}</td>
            </tr>
            <tr>
              <th>Instrumento</th>
              <td>
                Riscos psicossociais (NR-1) · 76 perguntas, 29 dimensões, 8
                domínios
              </td>
            </tr>
            <tr>
              <th>Período de aplicação</th>
              <td>{rel.periodo}</td>
            </tr>
            <tr>
              <th>População convidada</th>
              <td>
                {rel.convidados === null
                  ? "Link aberto (anônima)"
                  : plural(rel.convidados, "pessoa", "pessoas")}
              </td>
            </tr>
            <tr>
              <th>Respostas válidas</th>
              <td>{resultado.respostas}</td>
            </tr>
            <tr>
              <th>Identificação</th>
              <td>{ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]}</td>
            </tr>
            <tr>
              <th>Proteção dos dados</th>
              <td>{`Grupos com menos de ${plural(minimo, "resposta", "respostas")} não aparecem nos recortes.`}</td>
            </tr>
            <tr>
              <th>Classificação de risco</th>
              <td>
                Tercis do escore (1 a 5) e matriz severidade × prevalência (4 ×
                4)
              </td>
            </tr>
            <tr>
              <th>Profissional de SST</th>
              <td>
                {acompanhamento?.profissionalSst.nome
                  ? `${acompanhamento.profissionalSst.nome}${acompanhamento.profissionalSst.registro ? ` · ${acompanhamento.profissionalSst.registro}` : ""}`
                  : "Nome e registro: ________________________________"}
              </td>
            </tr>
          </tbody>
        </table>
        <h2 className="relatorio__sumario-titulo">Sumário</h2>
        <ol className="relatorio__sumario" aria-label="Sumário">
          {sumario.map(([n, t, p]) => (
            <li key={n}>
              <span className="relatorio__sumario-numero">{n}</span>
              <span className="relatorio__sumario-textos">
                <strong>{t}</strong>
              </span>
              <span className="relatorio__sumario-pagina">{p}</span>
            </li>
          ))}
        </ol>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        <Secao numero="01" titulo="Resumo executivo">
          {r ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>Alto ou crítico</span>
                  <strong>{r.precisamDeAcao}</strong>
                  <span>de 29 dimensões</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Participação</span>
                  <strong>{resultado.respostas}</strong>
                  <span>
                    {plural(resultado.respostas, "resposta", "respostas")}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Comportamentos ofensivos</span>
                  <strong>
                    {r.ofensivos.percentual === null
                      ? "—"
                      : porcento(r.ofensivos.percentual)}
                  </strong>
                  <span>{pessoasOuSigilo(r.ofensivos.relataram, minimo)}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Plano de ação</span>
                  <strong>{acompanhamento?.plano.length ?? 0}</strong>
                  <span>medidas registradas</span>
                </div>
              </div>
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>Nível</th>
                    <th>Ação</th>
                    <th>Dimensões</th>
                  </tr>
                </thead>
                <tbody>
                  {NIVEIS.map((n) => (
                    <tr key={n}>
                      <td>{`${NIVEL[n].rotulo} (${r.niveis[n]})`}</td>
                      <td>{NIVEL[n].acao}</td>
                      <td>
                        {r.prioridades
                          .filter((id) => porId.get(id)!.nivel === n)
                          .map((id) => dimensaoNr1(id).rotulo)
                          .join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Prioridades de ação</h3>
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Dimensão</th>
                    <th>% em risco</th>
                    <th>Distribuição</th>
                    <th>Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {emAcao.slice(0, 10).map((id, i) => {
                    const d = porId.get(id)!;
                    return (
                      <tr key={id}>
                        <td>{i + 1}</td>
                        <td>{dimensaoNr1(id).rotulo}</td>
                        <td>{porcento(d.percentuais.risco)}</td>
                        <td>
                          <BarraDeFaixas
                            partes={partesDaDistribuicao(d)}
                            rotulo={dimensaoNr1(id).rotulo}
                          />
                        </td>
                        <td>{NIVEL[d.nivel!].rotulo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <NumerosOcultos minimo={minimo} />
          )}
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        <Secao numero="02" titulo="Inventário de riscos">
          {r ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Severidade \ Prevalência</th>
                  {[1, 2, 3, 4].map((p) => (
                    <th
                      key={p}
                    >{`${ROTULO_DO_GRAU[p]} · ${ROTULO_DA_PREVALENCIA[p]}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[4, 3, 2, 1].map((sev, linha) => (
                  <tr key={sev}>
                    <th>{`${ROTULO_DO_GRAU[sev]} (${sev})`}</th>
                    {[0, 1, 2, 3].map((col) => (
                      <td
                        key={col}
                        style={{
                          background: `color-mix(in srgb, ${NIVEL[MATRIZ[linha]![col]!].cor} 18%, white)`,
                        }}
                      >
                        {(r.matriz[linha]?.[col] ?? [])
                          .map((id) => dimensaoNr1(id).rotulo)
                          .join("; ") || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <NumerosOcultos minimo={minimo} />
          )}
          <h3>Como agir em cada nível</h3>
          <ul className="relatorio__faixas">
            {NIVEIS.map((n) => (
              <li key={n}>
                <strong>{NIVEL[n].rotulo}</strong>
                <span>{NIVEL[n].comoAgir}</span>
              </li>
            ))}
          </ul>
          <div className="relatorio__quadro">
            <h3>Regra de proteção</h3>
            <p>
              Sintomas depressivos e comportamentos ofensivos nunca ficam abaixo
              de "alto" quando a severidade é alta ou muito alta.
            </p>
          </div>
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        <Secao numero="03" titulo="Perfil das 29 dimensões">
          {r ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Dimensão</th>
                  <th>Tipo</th>
                  <th>Escore</th>
                  <th>Distribuição</th>
                  <th>% em risco</th>
                  <th>Nível</th>
                </tr>
              </thead>
              <tbody>
                {DOMINIOS_NR1.flatMap((dom) => [
                  <tr key={dom.id}>
                    <th colSpan={6}>{dom.rotulo}</th>
                  </tr>,
                  ...r.dimensoes
                    .filter((d) => d.dominio === dom.id)
                    .map((d) => (
                      <tr key={d.id}>
                        <td>{dimensaoNr1(d.id).rotulo}</td>
                        <td style={{ color: COR_DO_FATOR[d.tipo] }}>
                          {d.tipo === "risco" ? "Risco" : "Proteção"}
                        </td>
                        <td>{decimal(d.escore)}</td>
                        <td>
                          <BarraDeFaixas
                            partes={partesDaDistribuicao(d)}
                            rotulo={dimensaoNr1(d.id).rotulo}
                          />
                        </td>
                        <td>{porcento(d.percentuais.risco)}</td>
                        <td>{d.nivel ? NIVEL[d.nivel].rotulo : "—"}</td>
                      </tr>
                    )),
                ])}
              </tbody>
            </table>
          ) : (
            <NumerosOcultos minimo={minimo} />
          )}
          <p className="relatorio__rotulo">
            Escore de 1 a 5. Nas dimensões de risco, escore alto é pior; nas de
            proteção, escore baixo é pior.
          </p>
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(6)}>
        <Secao numero="04" titulo="Saúde e bem-estar">
          {r ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>% em risco</th>
                  <th></th>
                  <th>Pessoas</th>
                  <th>Nível</th>
                </tr>
              </thead>
              <tbody>
                {r.saude.map((s) => (
                  <tr key={s.id}>
                    <td>{ROTULO_DO_INDICADOR[s.id]?.titulo}</td>
                    <td>{porcento(s.percentualEmRisco)}</td>
                    <td>
                      <BarraPercentual
                        valor={s.percentualEmRisco}
                        cor={COR_DA_RESPOSTA.desfavoravel}
                        rotulo={ROTULO_DO_INDICADOR[s.id]?.titulo ?? s.id}
                      />
                    </td>
                    <td>{`${s.pessoasEmRisco} de ${s.pessoas}`}</td>
                    <td>{s.nivel ? NIVEL[s.nivel].rotulo : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <h3>Comportamentos ofensivos</h3>
          {r ? (
            <>
              <p>{`${pessoasOuSigilo(r.ofensivos.relataram, minimo)}${r.ofensivos.percentual !== null ? ` (${porcento(r.ofensivos.percentual)})` : ""} relataram pelo menos um tipo nos últimos 12 meses.`}</p>
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Raramente</th>
                    <th>Às vezes</th>
                    <th>Frequentemente ou sempre</th>
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_DE_OFENSA.map((t) => {
                    const x = r.ofensivos.tipos.find((y) => y.id === t.id);
                    // Oculta: abaixo do mínimo ou pelo sigilo complementar.
                    const c = (n: number | null | undefined) =>
                      n === null ? "oculto" : String(n ?? 0);
                    return (
                      <tr key={t.id}>
                        <td>{t.rotulo}</td>
                        <td>{c(x?.raramente)}</td>
                        <td>{c(x?.asVezes)}</td>
                        <td>{c(x?.frequentementeOuSempre)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : null}
          <div className="relatorio__quadro">
            <h3>Recomendação</h3>
            <p>
              Qualquer relato deve ser tratado: reforce o canal de denúncia, o
              acolhimento e a política contra o assédio.
            </p>
          </div>
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(7)}>
        <Secao numero="05" titulo="Plano de ação">
          <p className="relatorio__rotulo">{`Ordem de prioridade dos controles: ${CONTROLES.map((c, i) => `${i + 1} ${c.rotulo}`).join(" · ")}`}</p>
          {acompanhamento && acompanhamento.plano.length ? (
            <table className="relatorio__tabela">
              <thead>
                <tr>
                  <th>Dimensão</th>
                  <th>Medida</th>
                  <th>Controle</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Indicador</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {acompanhamento.plano.map((m) => (
                  <tr key={m.id}>
                    <td>{dimensaoNr1(m.dimensaoId).rotulo}</td>
                    <td>
                      {m.titulo}
                      {m.descricao ? (
                        <span className="relatorio__rotulo">{` ${m.descricao}`}</span>
                      ) : null}
                    </td>
                    <td>{ROTULO_DO_CONTROLE[m.controle]}</td>
                    <td>{m.responsavel ?? "—"}</td>
                    <td>{m.prazo ? formatarDiaCivil(m.prazo) : "—"}</td>
                    <td>{m.indicador ?? "—"}</td>
                    <td>{ROTULO_DA_SITUACAO[m.situacao]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="relatorio__quadro">
              <p>
                Nenhuma medida registrada ainda. O plano é escrito pelo RH na
                aba Plano de ação.
              </p>
            </div>
          )}
          <div className="relatorio__quadro">
            <p>
              O plano é responsabilidade da empresa e deve ser revisado e
              validado com o profissional de SST antes de integrar o PGR.
            </p>
          </div>
        </Secao>
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(8)}>
        <Secao numero="06" titulo="Conformidade NR-1 e evidências">
          <table className="relatorio__tabela">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Situação</th>
                <th>Evidências</th>
              </tr>
            </thead>
            <tbody>
              {ETAPAS_DA_CONFORMIDADE.map((def, i) => {
                const e = acompanhamento?.etapas.find((x) => x.id === def.id);
                return (
                  <tr key={def.id}>
                    <td>{`${i + 1}. ${def.titulo}`}</td>
                    <td>
                      {e?.concluida
                        ? e.concluidaEm
                          ? `Concluída em ${formatarInstante(e.concluidaEm)}`
                          : "Concluída"
                        : def.id === "revisar" && acompanhamento?.revisarEm
                          ? `Prevista para ${formatarDiaCivil(`${acompanhamento.revisarEm}-01`).slice(3)}`
                          : "Pendente"}
                    </td>
                    <td>{e?.evidencias ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h3>Metodologia</h3>
          <dl className="relatorio__metodologia">
            <dt>Escore</dt>
            <dd>Média dos itens da dimensão, de 1 a 5.</dd>
            <dt>Tercis</dt>
            <dd>Até 2,33; até 3,66; acima de 3,66.</dd>
            <dt>Severidade</dt>
            <dd>
              Do escore médio (proteção espelhada), de baixa a muito alta.
            </dd>
            <dt>Prevalência</dt>
            <dd>
              % de pessoas na faixa de risco (menos de 10 pessoas: regra de
              amostra pequena).
            </dd>
            <dt>Nível</dt>
            <dd>
              Matriz 4 × 4 severidade × prevalência, com a regra de proteção.
            </dd>
          </dl>
          <h3>Revisão e aprovação</h3>
          <div className="relatorio__indicadores">
            <div className="relatorio__indicador">
              <span>______________________________</span>
              <span>Nome e cargo — Responsável pela organização — Data</span>
            </div>
            <div className="relatorio__indicador">
              <span>______________________________</span>
              <span>
                Nome e registro profissional — Profissional de SST — Data
              </span>
            </div>
          </div>
          <p className="relatorio__rotulo">
            Resultados agregados; não são diagnóstico individual. A gestão dos
            riscos e o PGR são responsabilidade da empresa.
          </p>
        </Secao>
      </Pagina>
    </div>
  );
}

export function DocumentoIsfb({
  carregado,
  resultado,
}: {
  readonly carregado: RelatorioCarregado;
  readonly resultado: ResultadoDoPainel;
}) {
  const { detalhe, empresa, rel } = carregado;
  const r = resultado.visivel ? resultado.isfb : null;
  const total = 5;
  const emitido = formatarDiaCivil(rel.emitidoEm);
  const cabecalho = {
    esquerda: "Saúde financeira · Relatório de resultados",
    direita: `${rel.mesDeReferencia} · Emitido em ${emitido}`,
  };
  const rodape = (numero: number) => ({
    texto: "Documento confidencial · RH",
    numero,
    total,
  });
  const minimo = resultado.minimoPorGrupo;
  const leitura = r ? leituraAutomatica(r) : null;
  const nomeProduto = new Map(PRODUTOS.map((p) => [p.id, p.texto]));
  return (
    <div className="relatorio" data-relatorio="">
      <Pagina capa>
        <div className="relatorio__capa-topo">
          <MarcaEvolli variante="horizontal" tom="branco" altura={26} />
          <span className="relatorio__pilula-capa">
            <span className="relatorio__selo-ponto" aria-hidden="true" />
            {rel.mesDeReferencia}
          </span>
        </div>
        <p className="relatorio__sobretitulo">Relatório de resultados</p>
        <h1 className="relatorio__capa-titulo">Saúde financeira</h1>
        <p className="relatorio__capa-subtitulo">{`${empresa || "Empresa"} · ${rel.periodo}`}</p>
        <div className="relatorio__capa-cartoes">
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">
              Nota do time<span>de 0 a 100</span>
            </p>
            <strong className="relatorio__numero">{r?.isfb ?? "—"}</strong>
            <span>
              {r?.faixa ? FAIXA_ISFB[r.faixa].rotulo : "Números ocultos"}
            </span>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Por dimensão</p>
            <ul className="relatorio__destaques">
              {r?.dimensoes.map((d) => (
                <li key={d.id}>
                  <span>{etapaIsfb(d.id).curto}</span>
                  <strong>{d.nota ?? "—"}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="relatorio__cartao">
            <p className="relatorio__cartao-titulo">Sinais de alerta</p>
            <ul className="relatorio__destaques">
              {r
                ? SINAIS.slice(0, 3).map((s) => (
                    <li key={s}>
                      <span>{SINAL[s].pessoa}</span>
                      <strong>{`${Math.round(r.sinais[s].percentual)}%`}</strong>
                    </li>
                  ))
                : null}
            </ul>
          </div>
        </div>
        <RodapeDaCapa
          itens={[
            ["Empresa", empresa || "—"],
            ["Período", rel.periodo],
            ["Emitido em", emitido],
            ["Classificação", "Confidencial · RH"],
          ]}
        />
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(2)}>
        <div className="relatorio__quadro">
          <h2>Como ler este relatório</h2>
          <p>{`A nota vai de 0 a 100 e é comparável com a média do Brasil (${umaCasaBr(r?.mediaDoBrasil ?? 56.7)}, referência nacional de 2024).`}</p>
          <ul className="relatorio__faixas">
            {FAIXAS_ISFB.map((f) => (
              <li key={f}>
                <strong>{`${FAIXA_ISFB[f].rotulo} · ${FAIXA_ISFB[f].de} a ${FAIXA_ISFB[f].ate}`}</strong>
                <span>{FAIXA_ISFB[f].frase}</span>
              </li>
            ))}
          </ul>
        </div>
        <Secao numero="01" titulo="Resumo executivo">
          {r ? (
            <>
              <div className="relatorio__indicadores">
                <div className="relatorio__indicador relatorio__indicador--destaque">
                  <span>Nota do time</span>
                  <strong>{r.isfb ?? "—"}</strong>
                  <span>{r.faixa ? FAIXA_ISFB[r.faixa].rotulo : ""}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Média do Brasil</span>
                  <strong>{umaCasaBr(r.mediaDoBrasil)}</strong>
                  <span>
                    {r.diferencaDoBrasil !== null
                      ? diferenca(r.diferencaDoBrasil)
                      : ""}
                  </span>
                </div>
                <div className="relatorio__indicador">
                  <span>Participação</span>
                  <strong>{resultado.respostas}</strong>
                  <span>{ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]}</span>
                </div>
                <div className="relatorio__indicador">
                  <span>Saúde baixa</span>
                  <strong>{`${Math.round(r.saude.baixa.percentual)}%`}</strong>
                  <span>até 56</span>
                </div>
              </div>
              {leitura ? (
                <ul className="relatorio__faixas">
                  <li>
                    <strong>Urgente</strong>
                    <span>{leitura.urgente}</span>
                  </li>
                  <li>
                    <strong>Atenção</strong>
                    <span>{leitura.atencao}</span>
                  </li>
                  <li>
                    <strong>Ponto forte</strong>
                    <span>{leitura.pontoForte}</span>
                  </li>
                </ul>
              ) : null}
            </>
          ) : (
            <NumerosOcultos minimo={minimo} />
          )}
        </Secao>
        {r ? (
          <Secao numero="02" titulo="Distribuição e sinais de alerta">
            <table className="relatorio__tabela">
              <tbody>
                {(["baixa", "no_limite", "saudavel"] as const).map((s) => (
                  <tr key={s}>
                    <th>{`${SAUDE[s].rotulo} (${SAUDE[s].faixa})`}</th>
                    <td>{r.saude[s].quantidade}</td>
                    <td>{`${Math.round(r.saude[s].percentual)}%`}</td>
                  </tr>
                ))}
                {SINAIS.map((s) => (
                  <tr key={s}>
                    <th>{SINAL[s].pessoa}</th>
                    <td>{r.sinais[s].quantidade}</td>
                    <td>{`${Math.round(r.sinais[s].percentual)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Secao>
        ) : null}
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(3)}>
        {r ? (
          <>
            <Secao numero="03" titulo="As dimensões">
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>Dimensão</th>
                    <th>Nota</th>
                    <th></th>
                    <th>Faixa</th>
                  </tr>
                </thead>
                <tbody>
                  {r.dimensoes.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.id === "autopercepcao"
                          ? "Autopercepção (não entra na nota)"
                          : etapaIsfb(d.id).rotulo}
                      </td>
                      <td>{d.nota ?? "—"}</td>
                      <td>
                        <BarraPercentual
                          valor={d.nota ?? 0}
                          cor={etapaIsfb(d.id).cor}
                          rotulo={etapaIsfb(d.id).curto}
                        />
                      </td>
                      <td>{d.faixa ? FAIXA_ISFB[d.faixa].rotulo : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Secao>
            <Secao numero="04" titulo="Resultado por pergunta">
              <table className="relatorio__tabela">
                <thead>
                  <tr>
                    <th>Pergunta</th>
                    <th>Favorável</th>
                    <th>Desfavorável</th>
                  </tr>
                </thead>
                <tbody>
                  {r.perguntas
                    .filter((p) => p.respostas > 0)
                    .map((p) => (
                      <tr key={p.id}>
                        <td>{`${p.id} · ${itemIsfb(p.id).rotulo}`}</td>
                        <td>{`${Math.round(p.favoravel)}%`}</td>
                        <td>{`${Math.round(p.desfavoravel)}%`}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Secao>
          </>
        ) : (
          <NumerosOcultos minimo={minimo} />
        )}
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(4)}>
        {r ? (
          <>
            <Secao numero="05" titulo="Base financeira e crédito × reserva">
              <table className="relatorio__tabela">
                <tbody>
                  {Object.entries(r.produtos).map(([id, c]) => (
                    <tr key={id}>
                      <td>{nomeProduto.get(id)}</td>
                      <td>{`${Math.round(c.percentual)}%`}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Usa crédito e sem reserva (risco de dívida cara)</th>
                    <td>{r.creditoReserva.creditoSemReserva}</td>
                  </tr>
                  <tr>
                    <th>Usa crédito e tem reserva</th>
                    <td>{r.creditoReserva.creditoComReserva}</td>
                  </tr>
                  <tr>
                    <th>Sem crédito e sem reserva</th>
                    <td>{r.creditoReserva.semCreditoSemReserva}</td>
                  </tr>
                  <tr>
                    <th>Sem crédito e com reserva</th>
                    <td>{r.creditoReserva.semCreditoComReserva}</td>
                  </tr>
                </tbody>
              </table>
            </Secao>
            <Secao numero="06" titulo="Perfis do time e renda da casa">
              <table className="relatorio__tabela">
                <tbody>
                  {PERFIS.map((p) => (
                    <tr key={p}>
                      <th>{PERFIL[p].rotulo}</th>
                      <td>{r.perfis[p].quantidade}</td>
                      <td>{PERFIL[p].acao}</td>
                    </tr>
                  ))}
                  {r.porRenda.map((g) => (
                    <tr key={g.id}>
                      <th>{RENDA[g.id]}</th>
                      <td>{g.respostas}</td>
                      <td>
                        {g.visivel && g.saude
                          ? `Baixa ${g.saude.baixa} · No limite ${g.saude.no_limite} · Saudável ${g.saude.saudavel}`
                          : g.respostas
                            ? "Oculto"
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="relatorio__rotulo">
                Os perfis são uma leitura do Evolli sobre as dimensões, não
                fazem parte da metodologia do índice.
              </p>
            </Secao>
          </>
        ) : null}
      </Pagina>

      <Pagina cabecalho={cabecalho} rodape={rodape(5)}>
        {r ? (
          <>
            <Secao
              numero="07"
              titulo="Sinais acumulados, temas e abertura a apoio"
            >
              <table className="relatorio__tabela">
                <tbody>
                  {r.sinaisAcumulados.map((q, i) => (
                    <tr key={i}>
                      <th>
                        {i === 0
                          ? "Nenhum sinal"
                          : plural(i, "sinal", "sinais")}
                      </th>
                      <td>{q}</td>
                    </tr>
                  ))}
                  {r.temas.map((t) => (
                    <tr key={t.id}>
                      <th>{TEMA[t.id]}</th>
                      <td>{t.quantidade}</td>
                    </tr>
                  ))}
                  {r.comAutopercepcao
                    ? ABERTURAS.map((a) => (
                        <tr key={a}>
                          <th>{ABERTURA[a].rotulo}</th>
                          <td>{r.aberturas[a].quantidade}</td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </Secao>
          </>
        ) : null}
        <Secao numero="08" titulo="Próximos passos do RH">
          <ul className="relatorio__faixas">
            {[
              "Compartilhar o resultado agregado",
              "Abrir inscrições de consultoria individual (voluntária e confidencial)",
              "Montar a trilha de educação financeira",
              "Levar as lacunas de benefícios à diretoria",
              "Medir de novo daqui a 6 meses",
            ].map((t) => (
              <li key={t}>
                <strong>☐</strong>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="relatorio__quadro">
            <p>{`Período: ${rel.periodo} · Respostas: ${resultado.respostas} · Identificação: ${ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]} · Grupo mínimo: ${minimo}. Os resultados servem para apoiar as pessoas — nunca para desempenho, promoção ou desligamento.`}</p>
          </div>
        </Secao>
      </Pagina>
    </div>
  );
}
