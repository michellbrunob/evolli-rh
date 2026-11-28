/**
 * T216 — o resultado de uma resposta (identificada: com o nome; anônima:
 * numerada, sem pessoa). Paginação entre as respostas, exportar em PDF e
 * duas abas: Visão geral (média, recomendação, nota mais alta e mais baixa,
 * cada pergunta comparada com a média do time) e Respostas (tudo o que foi
 * respondido). Também abre pela aba Pesquisas da ficha.
 */
import {
  paginaIndividualDoModelo,
  resultadoIndividualDoModelo,
  visaoIndividualDoModelo,
} from "./modelos/resultados";
import { useEffect, useState } from "react";
import { useTrilhaComplementar } from "../../app/trilhaComplementar";
import type {
  Identificacao,
  PesquisaDetalhe,
  RespostaDetalhe,
  Pergunta,
  RespostaResumo,
  Secao,
} from "../../api/pesquisasClient";
import { Button } from "../../components";
import { formatarInstante } from "../../format/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from "../../ui";
import {
  IconeAvancar,
  IconeBaixarArquivo,
  IconeAbrir,
  IconeVoltar,
} from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { Avatar, iniciaisDe } from "./componentes";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { Regua } from "./graficos";
import { detalheParaOPainel, secoesParaOPainel } from "./modelos/empresa";
import { enderecoDaRota } from "./rotasDePesquisas";
import {
  ROTULO_DA_FAIXA_DA_MEDIA,
  ehDeEscala,
  escalaDe,
  faixaDaMedia10,
  mediaNa10,
} from "./indicadores";
import { RespostasDaPessoa } from "./RespostasDaPessoa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import { umaCasa } from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

/** Nota inteira sem casa ("3"); média com uma casa ("3,5"). */
const nota = (v: number) => (Number.isInteger(v) ? String(v) : umaCasa(v));

/**
 * A diferença com uma casa, arredondando o meio para cima no valor com sinal
 * (−2,75 vira −2,7; +2,75 vira +2,8), sem o erro do ponto flutuante.
 */
const diferencaComUmaCasa = (v: number, time: number) =>
  Math.round(Number(((v - time) * 10).toFixed(6))) / 10;

const diferenca = (v: number, time: number) => {
  const d = diferencaComUmaCasa(v, time);
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${umaCasa(Math.abs(d))}`;
};

/** "+1,5 acima do time (8,5)", "−0,4 abaixo…" ou "igual ao time (8,5)". */
const comparadoAoTime = (v: number, time: number) => {
  const d = diferencaComUmaCasa(v, time);
  const quanto =
    d === 0
      ? "igual ao time"
      : `${diferenca(v, time)} ${d > 0 ? "acima" : "abaixo"} do time`;
  return `${quanto} (${umaCasa(time)})`;
};

function grupoDoEnps(v: number): string {
  return v >= 9 ? "Promotor" : v >= 7 ? "Neutro" : "Detrator";
}

/** A cor da nota de recomendação: promotor, neutro ou detrator. */
const faixaDaRecomendacao = (v: number) =>
  v >= 9 ? "alta" : v >= 7 ? "media" : "baixa";

const ehRecomendacao = (p: Pergunta) =>
  p.tipo === "nota_0_10" && p.config.enps === true;

/**
 * A página na tela do módulo: carrega a pesquisa e a resposta. A trilha
 * ganha dois níveis: o nome da pesquisa (leva aos resultados) e a resposta.
 */
export function ResultadoIndividual({
  servico,
  pesquisaId,
  respostaId,
  onVoltar,
  onLista,
  onIr,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  readonly respostaId: string;
  readonly onVoltar: () => void;
  /** O "Pesquisas" da trilha: a lista. */
  readonly onLista: () => void;
  readonly onIr: (respostaId: string) => void;
}) {
  const [pesquisa, setPesquisa] = useState<PesquisaDetalhe | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tituloDaResposta, setTituloDaResposta] = useState<string | null>(null);
  useTrilhaComplementar(
    pesquisa
      ? [
          { rotulo: pesquisa.nome, onSelecionar: onVoltar },
          { rotulo: tituloDaResposta ?? "Resultado individual" },
        ]
      : [{ rotulo: "Resultado individual" }],
    onLista,
  );
  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.obterPesquisa(pesquisaId))
      .then((d) => {
        if (vivo) setPesquisa(detalheParaOPainel(d));
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId]);
  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar a pesquisa.
      </p>
    );
  if (!pesquisa) return <Esqueleto rotulo="Carregando resposta…" linhas={5} />;
  const propria = paginaIndividualDoModelo({
    pesquisa,
    respostaId,
    carregarPerfil: servico.perfilComportamental,
    onVoltar,
    onIr,
  });
  if (propria) return propria;
  return (
    <PaginaDaResposta
      nomeDaPesquisa={pesquisa.nome}
      identificacao={pesquisa.identificacao}
      secoes={pesquisa.secoes}
      respostaId={respostaId}
      carregar={(id) => servico.respostaDaPesquisa(pesquisaId, id)}
      listar={() => servico.respostasDaPesquisa(pesquisaId)}
      pesquisaIdDoPdf={pesquisaId}
      rotuloVoltar="Voltar para os resultados"
      onVoltar={onVoltar}
      onIr={onIr}
      onTitulo={setTituloDaResposta}
    />
  );
}

export function PaginaDaResposta({
  nomeDaPesquisa,
  identificacao,
  secoes,
  respostaId,
  carregar,
  listar,
  pesquisaIdDoPdf,
  rotuloVoltar,
  onVoltar,
  onIr,
  onTitulo,
}: {
  readonly nomeDaPesquisa: string;
  readonly identificacao: Identificacao;
  readonly secoes: readonly Secao[];
  readonly respostaId: string;
  readonly carregar: (respostaId: string) => Promise<RespostaDetalhe>;
  /** Todas as respostas (o seletor "N de M"); sem ele, só anterior/próxima. */
  readonly listar?: () => Promise<readonly RespostaResumo[]>;
  /** A pesquisa da resposta: com ele, "Exportar PDF" abre o relatório. */
  readonly pesquisaIdDoPdf?: string;
  readonly rotuloVoltar: string;
  readonly onVoltar: () => void;
  /** Sem `onIr`, não há paginação (ex.: ficha). */
  readonly onIr?: (respostaId: string) => void;
  /** O título da resposta, quando carregada (o nível atual da trilha). */
  readonly onTitulo?: (titulo: string) => void;
}) {
  const [r, setR] = useState<RespostaDetalhe | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aba, setAba] = useState<"geral" | "respostas">("geral");
  const [todasAsRespostas, setTodasAsRespostas] = useState<
    readonly RespostaResumo[] | null
  >(null);

  useEffect(() => {
    if (!listar || !onIr) return;
    let vivo = true;
    Promise.resolve(listar())
      .then((l) => {
        if (vivo)
          setTodasAsRespostas(
            [...(l ?? [])].sort((a, b) =>
              b.respondidaEm.localeCompare(a.respondidaEm),
            ),
          );
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Uma vez: a lista não muda ao trocar de resposta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.resolve(carregar(respostaId))
      .then((d) => {
        if (vivo) setR(d);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
    // `carregar` muda a cada render do pai; a resposta é o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respostaId]);

  const tituloCarregado = r
    ? identificacao === "identificada" && r.nome
      ? r.nome
      : `Resposta anônima #${r.numero}`
    : null;
  useEffect(() => {
    if (tituloCarregado) onTitulo?.(tituloCarregado);
    // `onTitulo` muda a cada render do pai; o título é o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tituloCarregado]);

  if (falhou)
    return (
      <div className="pesquisas">
        <p className="pesquisas__erro" role="alert">
          Não foi possível carregar a resposta.
        </p>
        <Button variant="secondary" onClick={onVoltar}>
          {rotuloVoltar}
        </Button>
      </div>
    );
  if (!r) return <Esqueleto rotulo="Carregando resposta…" linhas={5} />;

  const identificada = identificacao === "identificada" && r.nome;
  const titulo = identificada ? r.nome! : `Resposta anônima #${r.numero}`;
  const todas = perguntasEmOrdem(secoesParaOPainel(secoes));
  const porId = new Map(r.valores.map((v) => [v.perguntaId, v]));
  const textoDe = (id: string | undefined) =>
    todas.find((p) => p.id === id)?.texto ?? "";
  const ind = r.indicadores;
  /** O texto livre respondido (o último parágrafo com conteúdo). */
  const comentario =
    todas
      .filter((p) => p.tipo === "paragrafo" || p.tipo === "texto_curto")
      .map((p) => porId.get(p.id)?.valor)
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .at(-1) ?? null;
  // As perguntas de escala e, no fim, a recomendação (de 0 a 10).
  const respondidas = todas.filter((p) => ehDeEscala(p) && porId.has(p.id));
  const escalas = [
    ...respondidas.filter((p) => !ehRecomendacao(p)),
    ...respondidas.filter(ehRecomendacao),
  ];

  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label={rotuloVoltar}
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <Avatar texto={identificada ? iniciaisDe(r.nome!) : `R${r.numero}`} />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            {titulo}
          </h1>
          <p className="pesquisas__subtitulo">
            {`${identificada ? (r.departamento ?? nomeDaPesquisa) : "Identidade oculta"} · respondeu em ${formatarInstante(r.respondidaEm)}`}
          </p>
        </div>
        <div className="pesquisas__acoes-topo">
          {pesquisaIdDoPdf ? (
            <Button
              variant="secondary"
              onClick={() =>
                // O PDF da resposta: página A4 imprimível, em outra aba.
                window.open(
                  enderecoDaRota({
                    tela: "relatorioDaResposta",
                    id: pesquisaIdDoPdf,
                    respostaId: r.id,
                  }),
                  "_blank",
                  "noopener",
                )
              }
            >
              <IconeBaixarArquivo tamanho={16} />
              Exportar PDF
            </Button>
          ) : null}
          {onIr ? (
            <nav className="pesquisas__paginacao" aria-label="Outras respostas">
              <IconButton
                label="Resposta anterior"
                icon={<IconeVoltar tamanho={16} />}
                disabled={!r.anteriorId}
                onClick={() => r.anteriorId && onIr(r.anteriorId)}
              />
              {todasAsRespostas && todasAsRespostas.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="pesquisas__seletor-resposta"
                    aria-label={`Resposta ${r.posicao} de ${r.total}. Escolher outra`}
                  >
                    {`${r.posicao} de ${r.total}`}
                    <IconeAbrir tamanho={14} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="pesquisas__menu">
                    {todasAsRespostas.map((x) => (
                      <DropdownMenuItem
                        key={x.id}
                        onSelect={() => x.id !== r.id && onIr(x.id)}
                        {...(x.id === r.id ? { "aria-current": "true" } : {})}
                      >
                        <span className="pesquisas__item-resposta">
                          <span>
                            {identificacao === "identificada" && x.nome
                              ? x.nome
                              : `Resposta #${x.numero}`}
                          </span>
                          <span className="pesquisas__suave">
                            {x.resumoDoModelo?.modelo === "clima"
                              ? x.resumoDoModelo.indice === null
                                ? "—"
                                : `Índice ${x.resumoDoModelo.indice}%`
                              : x.media === null
                                ? "—"
                                : `Média ${umaCasa(x.media)}`}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span>{`${r.posicao} de ${r.total}`}</span>
              )}
              <IconButton
                label="Próxima resposta"
                icon={<IconeAvancar tamanho={16} />}
                disabled={!r.proximaId}
                onClick={() => r.proximaId && onIr(r.proximaId)}
              />
            </nav>
          ) : null}
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Resultado individual"
        className="pesquisas__abas"
      >
        <button
          type="button"
          role="tab"
          className="evolli-aba"
          aria-selected={aba === "geral"}
          onClick={() => setAba("geral")}
        >
          Visão geral
        </button>
        <button
          type="button"
          role="tab"
          className="evolli-aba"
          aria-selected={aba === "respostas"}
          onClick={() => setAba("respostas")}
        >
          Respostas{" "}
          <span className="pesquisas__contagem">{r.valores.length}</span>
        </button>
      </div>

      {aba === "respostas" ? (
        <RespostasDaPessoa
          rotulo={`Respostas de ${titulo}`}
          secoes={secoes}
          valores={r.valores}
        />
      ) : visaoIndividualDoModelo(r, secoes) ? (
        visaoIndividualDoModelo(r, secoes)
      ) : (
        <>
          {resultadoIndividualDoModelo(r)}
          <section
            className="pesquisas__indicadores"
            aria-label="Indicadores da resposta"
          >
            <div className="pesquisas__indicador">
              <h3>Média geral</h3>
              <p className="pesquisas__indicador-valor">
                <span
                  className="pesquisas__indicador-numero"
                  {...(ind.media !== null
                    ? { "data-faixa": faixaDaMedia10(ind.media) }
                    : {})}
                >
                  {ind.media === null ? "—" : umaCasa(ind.media)}
                </span>
                <span className="pesquisas__indicador-sufixo"> /10</span>
              </p>
              {ind.media !== null ? (
                <span
                  className="pesquisas__nota-colorida"
                  data-faixa={faixaDaMedia10(ind.media)}
                >
                  {ROTULO_DA_FAIXA_DA_MEDIA[faixaDaMedia10(ind.media)]}
                </span>
              ) : null}
              {ind.media !== null && ind.mediaTime !== null ? (
                <p className="pesquisas__suave">
                  {comparadoAoTime(ind.media, ind.mediaTime)}
                </p>
              ) : null}
              <Regua
                valor={ind.media}
                referencia={ind.mediaTime}
                rotulo="Média geral da resposta"
              />
            </div>
            <div className="pesquisas__indicador">
              <h3>Recomendação</h3>
              {ind.recomendacao === null ? (
                <p className="pesquisas__suave">
                  Sem a pergunta de recomendação.
                </p>
              ) : (
                <>
                  <p className="pesquisas__indicador-valor">
                    <span
                      className="pesquisas__indicador-numero"
                      data-faixa={faixaDaRecomendacao(ind.recomendacao)}
                    >
                      {ind.recomendacao}
                    </span>
                    <span className="pesquisas__indicador-sufixo"> /10</span>
                  </p>
                  <p className="pesquisas__suave">
                    {`${grupoDoEnps(ind.recomendacao)}${ind.enpsTime !== null ? ` · eNPS do time ${ind.enpsTime}` : ""}`}
                  </p>
                </>
              )}
            </div>
            {(
              [
                ["Nota mais alta", ind.maior],
                ["Nota mais baixa", ind.menor],
              ] as const
            ).map(([rotulo, x]) => {
              const time = x
                ? (porId.get(x.perguntaId)?.mediaTime ?? null)
                : null;
              const pergunta = x
                ? todas.find((p) => p.id === x.perguntaId)
                : undefined;
              const escala = pergunta
                ? escalaDe(pergunta)
                : { minimo: 0, maximo: 10 };
              return (
                <div key={rotulo} className="pesquisas__indicador">
                  <h3>{rotulo}</h3>
                  {x ? (
                    <>
                      <p className="pesquisas__indicador-valor">
                        <span
                          className="pesquisas__indicador-numero"
                          data-faixa={faixaDaMedia10(
                            mediaNa10(x.valor, escala),
                          )}
                        >
                          {nota(x.valor)}
                        </span>
                        <span className="pesquisas__indicador-sufixo">{` /${escala.maximo}`}</span>
                      </p>
                      <p className="pesquisas__suave">
                        {textoDe(x.perguntaId)}
                      </p>
                      {time !== null ? (
                        <p className="pesquisas__suave">
                          {diferencaComUmaCasa(x.valor, time) === 0
                            ? `igual ao time (${umaCasa(time)})`
                            : `${diferenca(x.valor, time)} em relação ao time (${umaCasa(time)})`}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="pesquisas__suave">—</p>
                  )}
                </div>
              );
            })}
            <div className="pesquisas__indicador">
              <h3>Média nos últimos pulsos</h3>
              {typeof ind.mediaUltimosPulsos === "number" ? (
                <>
                  <p className="pesquisas__indicador-valor">
                    {umaCasa(ind.mediaUltimosPulsos)}
                    <span className="pesquisas__suave"> /10</span>
                  </p>
                  {ind.media !== null ? (
                    <p className="pesquisas__suave">{`${diferenca(ind.media, ind.mediaUltimosPulsos)} nesta resposta`}</p>
                  ) : null}
                </>
              ) : (
                <p className="pesquisas__suave">
                  Sem pulsos anteriores para comparar.
                </p>
              )}
            </div>
            <div className="pesquisas__indicador pesquisas__indicador--largo">
              <h3>Comentário livre</h3>
              {comentario ? (
                <blockquote className="pesquisas__comentario">
                  {comentario}
                </blockquote>
              ) : (
                <p className="pesquisas__suave">Nenhum comentário deixado.</p>
              )}
            </div>
          </section>

          <section
            className="pesquisas__cartao-secao"
            aria-label="Respostas por pergunta"
          >
            <header className="pesquisas__cartao-secao-cabeca">
              <h2 className="pesquisas__cartao-secao-titulo">
                Respostas por pergunta
              </h2>
            </header>
            {escalas.length === 0 ? (
              <p className="pesquisas__suave">
                Esta pesquisa não tem perguntas de escala para comparar.
              </p>
            ) : (
              <div className="pesquisas__tabela-caixa">
                <table
                  className="pesquisas__tabela"
                  aria-label="Comparação com o time"
                >
                  <thead>
                    <tr>
                      <th scope="col">Pergunta</th>
                      <th scope="col">Nota</th>
                      <th scope="col">Comparação com o time</th>
                      <th scope="col">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalas.map((p) => {
                      const v = porId.get(p.id)!;
                      const e = escalaDe(p);
                      const valorDaNota =
                        typeof v.valor === "number" ? v.valor : Number(v.valor);
                      const nota10 = Number.isFinite(valorDaNota)
                        ? mediaNa10(valorDaNota, e)
                        : null;
                      const time10 =
                        v.mediaTime === null ? null : mediaNa10(v.mediaTime, e);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="pesquisas__pessoa-textos">
                              {ehRecomendacao(p) ? (
                                <span className="pesquisas__rotulo-curto">
                                  Recomendação · 0 a 10
                                </span>
                              ) : p.rotulo ? (
                                <span className="pesquisas__rotulo-curto">
                                  {p.rotulo}
                                </span>
                              ) : null}
                              <span>{p.texto}</span>
                            </span>
                          </td>
                          <td>
                            {nota10 === null ? (
                              "—"
                            ) : (
                              <span
                                className="pesquisas__nota-colorida"
                                data-faixa={faixaDaMedia10(nota10)}
                              >
                                {`${nota(valorDaNota)} /${e.maximo}`}
                              </span>
                            )}
                          </td>
                          <td>
                            <Regua
                              valor={nota10}
                              referencia={time10}
                              rotulo={p.rotulo || p.texto}
                            />
                          </td>
                          <td className="pesquisas__numero">
                            {nota10 !== null && v.mediaTime !== null ? (
                              <span className="pesquisas__pessoa-textos">
                                <span className="pesquisas__forte">
                                  {diferencaComUmaCasa(
                                    valorDaNota,
                                    v.mediaTime,
                                  ) === 0
                                    ? "igual"
                                    : diferenca(valorDaNota, v.mediaTime)}
                                </span>
                                <span className="pesquisas__suave">{`time ${umaCasa(v.mediaTime)}`}</span>
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
