/**
 * T216 — resultados de uma pesquisa: cabeçalho (nome, status com menu,
 * modelo, criação, identificação, participação e link) e as abas Visão
 * geral, Por departamento e Respostas (só na identificada, para RH e DP).
 * Exportar CSV respeita a identificação. Recortes abaixo do mínimo por
 * grupo não mostram números ("Poucas respostas para mostrar").
 */
import { type ReactNode, useEffect, useId, useState } from "react";
import type {
  Pergunta,
  PesquisaDetalhe,
  RespostaIndividual,
  ResultadoPergunta,
  ResultadosPesquisa,
  StatusPesquisa,
} from "../../api/pesquisasClient";
import { Button, FormActions, StatusBadge } from "../../components";
import { formatarDiaCivil } from "../../format/data";
import { plural } from "../../format/plural";
import {
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  ListaDeEscolha,
} from "../../ui";
import {
  IconeAbrir,
  IconeBaixarArquivo,
  IconeEditar,
  IconeVoltar,
} from "../../ui/icones";
import { Esqueleto } from "../../ui/movimento";
import { baixarArquivo } from "../dashboard/exportacao";
import { CampoDoLink } from "./AssistenteDePesquisa";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { csvDasRespostas, csvDoResumo, nomeDoCsv } from "./exportarResultados";
import { RespostasDaPessoa } from "./RespostasDaPessoa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";
import {
  ROTULO_DA_IDENTIFICACAO,
  ROTULO_DO_MODELO,
  ROTULO_DO_STATUS,
  TOM_DO_STATUS,
  dataDoInstante,
  participacao,
  percentual,
  podeEditarPesquisa,
  proximosStatus,
  umaCasa,
} from "./textosDasPesquisas";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";
import "./Pesquisas.css";

type Aba = "geral" | "departamentos" | "respostas";

const TIPOS_DE_ESCALA = new Set([
  "concordancia",
  "escala",
  "estrelas",
  "nota_0_10",
]);

const CONFIRMACAO: Readonly<
  Partial<
    Record<StatusPesquisa, { titulo: string; texto: string; botao: string }>
  >
> = {
  finalizada: {
    titulo: "Finalizar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. Os resultados recebidos continuam aqui.",
    botao: "Finalizar pesquisa",
  },
  cancelada: {
    titulo: "Cancelar a pesquisa?",
    texto:
      "O link deixa de aceitar respostas e a pesquisa não volta a ficar ativa. As respostas recebidas continuam guardadas.",
    botao: "Cancelar pesquisa",
  },
};

export function ResultadosDaPesquisa({
  servico,
  pesquisaId,
  podeEditar,
  avisoInicial = null,
  onVoltar,
  onEditar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly pesquisaId: string;
  /** RH e DP: mudam status, editam e leem respostas individuais. */
  readonly podeEditar: boolean;
  readonly avisoInicial?: string | null;
  readonly onVoltar: (mensagem?: string) => void;
  readonly onEditar: (detalhe: PesquisaDetalhe) => void;
}) {
  const ids = useId();
  const [detalhe, setDetalhe] = useState<PesquisaDetalhe | null>(null);
  const [resultados, setResultados] = useState<ResultadosPesquisa | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [versao, setVersao] = useState(0);
  const [aba, setAba] = useState<Aba>("geral");
  const [departamentoId, setDepartamentoId] = useState("");
  const [filtrando, setFiltrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(avisoInicial);
  const [confirmar, setConfirmar] = useState<StatusPesquisa | null>(null);
  const [mudando, setMudando] = useState(false);
  const [respostas, setRespostas] = useState<RespostaIndividual[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.all([
      Promise.resolve(servico.obterPesquisa(pesquisaId)),
      Promise.resolve(servico.resultadosDaPesquisa(pesquisaId, null)),
    ])
      .then(([d, r]) => {
        if (!vivo) return;
        setDetalhe(d);
        setResultados(r);
        setDepartamentoId("");
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, versao]);

  async function filtrar(dep: string) {
    setDepartamentoId(dep);
    setFiltrando(true);
    try {
      setResultados(
        await servico.resultadosDaPesquisa(pesquisaId, dep || null),
      );
    } catch {
      setAviso("Não foi possível carregar o recorte. Tente de novo.");
    } finally {
      setFiltrando(false);
    }
  }

  async function mudarStatus(status: StatusPesquisa) {
    setMudando(true);
    try {
      const d = await servico.alterarStatusDaPesquisa(pesquisaId, status);
      setDetalhe(d);
      setAviso(`Status alterado para ${ROTULO_DO_STATUS[status]}.`);
    } catch {
      setAviso(
        "Não foi possível mudar o status. Atualize a página e tente de novo.",
      );
    } finally {
      setMudando(false);
      setConfirmar(null);
    }
  }

  async function carregarRespostas(): Promise<RespostaIndividual[]> {
    if (respostas) return respostas;
    const r = (await servico.respostasDaPesquisa(pesquisaId)) ?? [];
    setRespostas(r);
    return r;
  }

  async function exportar(tipo: "resumo" | "respostas") {
    if (!detalhe || !resultados) return;
    if (tipo === "resumo") {
      baixarArquivo(
        csvDoResumo(detalhe, resultados),
        nomeDoCsv(detalhe.nome, "resumo"),
      );
      return;
    }
    try {
      const csv = csvDasRespostas(detalhe, await carregarRespostas());
      if (csv) baixarArquivo(csv, nomeDoCsv(detalhe.nome, "respostas"));
    } catch {
      setAviso("Não foi possível exportar as respostas. Tente de novo.");
    }
  }

  if (falhou) {
    return (
      <div className="pesquisas">
        <Cabecalho titulo="Resultados" onVoltar={() => onVoltar()} />
        <div className="pesquisas__caixa-erro" role="alert">
          <p className="pesquisas__erro">
            Não foi possível carregar os resultados.
          </p>
          <Button variant="secondary" onClick={() => setVersao((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
  if (!detalhe || !resultados) {
    return (
      <div className="pesquisas">
        <Esqueleto rotulo="Carregando resultados…" linhas={6} />
      </div>
    );
  }

  const identificada = detalhe.identificacao === "identificada";
  const veRespostas = identificada && podeEditar;
  const proximos = podeEditar ? proximosStatus(detalhe.status) : [];
  const pct = participacao(detalhe.respostas, detalhe.participantes);
  const abas: { valor: Aba; rotulo: string }[] = [
    { valor: "geral", rotulo: "Visão geral" },
    { valor: "departamentos", rotulo: "Por departamento" },
    ...(veRespostas
      ? [{ valor: "respostas" as const, rotulo: "Respostas" }]
      : []),
  ];

  return (
    <div className="pesquisas">
      <Cabecalho
        titulo={detalhe.nome}
        onVoltar={() => onVoltar()}
        acoes={
          <>
            {proximos.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="evolli-button evolli-button--secondary"
                  aria-label={`Mudar status, hoje ${ROTULO_DO_STATUS[detalhe.status]}`}
                  disabled={mudando}
                >
                  <StatusBadge variant={TOM_DO_STATUS[detalhe.status]}>
                    {ROTULO_DO_STATUS[detalhe.status]}
                  </StatusBadge>
                  <IconeAbrir tamanho={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {proximos.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      onSelect={() =>
                        CONFIRMACAO[s] ? setConfirmar(s) : void mudarStatus(s)
                      }
                    >
                      {ROTULO_DO_STATUS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <StatusBadge variant={TOM_DO_STATUS[detalhe.status]}>
                {ROTULO_DO_STATUS[detalhe.status]}
              </StatusBadge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="evolli-button evolli-button--secondary"
                aria-label="Exportar CSV"
              >
                <IconeBaixarArquivo tamanho={16} />
                Exportar CSV
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => void exportar("resumo")}>
                  Resumo por pergunta
                </DropdownMenuItem>
                {veRespostas ? (
                  <DropdownMenuItem onSelect={() => void exportar("respostas")}>
                    Respostas por pessoa
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {podeEditar && podeEditarPesquisa(detalhe.status) ? (
              <Button variant="secondary" onClick={() => onEditar(detalhe)}>
                <IconeEditar tamanho={16} />
                Editar
              </Button>
            ) : null}
          </>
        }
      />

      {aviso ? (
        <p className="pesquisas__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      <section aria-label="Sobre a pesquisa" className="pesquisas__etapa">
        <dl className="pesquisas__meta">
          <div>
            <dt>Modelo</dt>
            <dd>{ROTULO_DO_MODELO[detalhe.modelo]}</dd>
          </div>
          <div>
            <dt>Criada em</dt>
            <dd>{dataDoInstante(detalhe.criadaEm)}</dd>
          </div>
          <div>
            <dt>Identificação</dt>
            <dd>{ROTULO_DA_IDENTIFICACAO[detalhe.identificacao]}</dd>
          </div>
          <div>
            <dt>Participação</dt>
            <dd>{`${detalhe.respostas} de ${detalhe.participantes} · ${pct}%`}</dd>
          </div>
          <div>
            <dt>Encerramento</dt>
            <dd>
              {detalhe.encerraEm
                ? formatarDiaCivil(detalhe.encerraEm)
                : "Sem prazo"}
            </dd>
          </div>
        </dl>
        {detalhe.link &&
        (detalhe.status === "ativa" || detalhe.status === "pausada") ? (
          <CampoDoLink link={detalhe.link} />
        ) : null}
      </section>

      <div role="tablist" aria-label="Resultados" className="pesquisas__abas">
        {abas.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            id={`${ids}-aba-${a.valor}`}
            aria-selected={aba === a.valor}
            aria-controls={`${ids}-painel`}
            onClick={() => setAba(a.valor)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div
        id={`${ids}-painel`}
        role="tabpanel"
        aria-labelledby={`${ids}-aba-${aba}`}
        className="pesquisas__resultados"
      >
        {aba === "geral" ? (
          <VisaoGeral
            detalhe={detalhe}
            resultados={resultados}
            departamentoId={departamentoId}
            filtrando={filtrando}
            onFiltrar={(d) => void filtrar(d)}
          />
        ) : aba === "departamentos" ? (
          <PorDepartamento
            servico={servico}
            detalhe={detalhe}
            geral={resultados}
          />
        ) : (
          <RespostasIndividuais
            carregar={carregarRespostas}
            detalhe={detalhe}
          />
        )}
      </div>

      <Dialog
        aberto={confirmar !== null}
        titulo={confirmar ? (CONFIRMACAO[confirmar]?.titulo ?? "") : ""}
        onFechar={() => setConfirmar(null)}
        bloqueado={mudando}
        rodape={
          <FormActions>
            <Button variant="secondary" onClick={() => setConfirmar(null)}>
              Voltar
            </Button>
            <Button
              className="pesquisas__botao-perigo"
              disabled={mudando}
              onClick={() => confirmar && void mudarStatus(confirmar)}
            >
              {confirmar ? CONFIRMACAO[confirmar]?.botao : ""}
            </Button>
          </FormActions>
        }
      >
        <p>{confirmar ? CONFIRMACAO[confirmar]?.texto : ""}</p>
      </Dialog>
    </div>
  );
}

function Cabecalho({
  titulo,
  onVoltar,
  acoes,
}: {
  readonly titulo: string;
  readonly onVoltar: () => void;
  readonly acoes?: ReactNode;
}) {
  return (
    <header className="pesquisas__cabecalho">
      <IconButton
        label="Voltar para Pesquisas"
        icon={<IconeVoltar tamanho={18} />}
        className="pesquisas__voltar"
        onClick={onVoltar}
      />
      <div className="pesquisas__titulos">
        <h1
          id={PESQUISAS_TITULO_ID}
          className="pesquisas__titulo"
          tabIndex={-1}
        >
          {titulo}
        </h1>
        <p className="pesquisas__subtitulo">Resultados da pesquisa</p>
      </div>
      {acoes ? <div className="pesquisas__acoes-topo">{acoes}</div> : null}
    </header>
  );
}

function PoucasRespostas({ minimo }: { readonly minimo: number }) {
  return (
    <div className="pesquisas__aba-vazia">
      <strong>Poucas respostas para mostrar</strong>
      <span className="pesquisas__suave">
        {`Este grupo tem menos de ${plural(minimo, "resposta", "respostas")}. Para proteger quem respondeu, os números não aparecem.`}
      </span>
    </div>
  );
}

function VisaoGeral({
  detalhe,
  resultados,
  departamentoId,
  filtrando,
  onFiltrar,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly resultados: ResultadosPesquisa;
  readonly departamentoId: string;
  readonly filtrando: boolean;
  readonly onFiltrar: (departamentoId: string) => void;
}) {
  const idDep = useId();
  const porId = new Map(resultados.perguntas.map((r) => [r.perguntaId, r]));
  const todas = perguntasEmOrdem(detalhe.secoes);
  return (
    <>
      {resultados.departamentos.length > 0 ? (
        <div className="pesquisas__filtro-departamento">
          <label htmlFor={idDep} className="pesquisas__suave">
            Departamento
          </label>
          <ListaDeEscolha
            id={idDep}
            opcoes={[
              { valor: "", rotulo: "Todos os departamentos" },
              ...resultados.departamentos.map((d) => ({
                valor: d.id,
                rotulo: d.nome,
                descricao: plural(d.respostas, "resposta", "respostas"),
              })),
            ]}
            valor={departamentoId}
            onMudar={onFiltrar}
          />
        </div>
      ) : null}
      <div
        className="pesquisas__resultados"
        {...(filtrando ? { "aria-busy": true, style: { opacity: 0.6 } } : {})}
      >
        {!resultados.filtro.visivel ? (
          <PoucasRespostas minimo={detalhe.minimoPorGrupo} />
        ) : resultados.respostas === 0 ? (
          <div className="pesquisas__aba-vazia">
            <strong>Ainda não há respostas.</strong>
            <span className="pesquisas__suave">
              Os resultados aparecem aqui assim que as respostas chegarem.
            </span>
          </div>
        ) : (
          todas.map((p, i) => (
            <ResultadoDaPergunta
              key={p.id}
              numero={i + 1}
              pergunta={p}
              resultado={porId.get(p.id)}
              identificada={detalhe.identificacao === "identificada"}
            />
          ))
        )}
      </div>
    </>
  );
}

function LinhaComBarra({
  rotulo,
  quantidade,
  total,
}: {
  readonly rotulo: string;
  readonly quantidade: number;
  readonly total: number;
}) {
  const pct = percentual(quantidade, total);
  return (
    <li>
      <span>{rotulo}</span>
      <span className="pesquisas__barra" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span>{`${quantidade} · ${pct}%`}</span>
    </li>
  );
}

function ResultadoDaPergunta({
  numero,
  pergunta: p,
  resultado: r,
  identificada,
}: {
  readonly numero: number;
  readonly pergunta: Pergunta;
  readonly resultado: ResultadoPergunta | undefined;
  readonly identificada: boolean;
}) {
  const nome = `${numero}. ${p.texto}`;
  return (
    <section className="pesquisas__resultado" aria-label={nome}>
      <h3>{nome}</h3>
      {!r ? (
        <p className="pesquisas__suave">Sem respostas ainda.</p>
      ) : (
        <>
          <p className="pesquisas__suave">
            {[
              plural(r.respondidas, "resposta", "respostas"),
              p.condicao
                ? `${plural(r.viram, "pessoa viu", "pessoas viram")} esta pergunta`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {"enps" in r ? (
            <section aria-label="eNPS" className="pesquisas__enps">
              <div className="pesquisas__enps-indice">
                <strong>{r.enps.indice === null ? "—" : r.enps.indice}</strong>
                <span className="pesquisas__suave">eNPS</span>
              </div>
              <ul className="pesquisas__linhas">
                {(
                  [
                    ["Promotores (9–10)", r.enps.promotores],
                    ["Neutros (7–8)", r.enps.neutros],
                    ["Detratores (0–6)", r.enps.detratores],
                  ] as const
                ).map(([rotulo, q]) => (
                  <LinhaComBarra
                    key={rotulo}
                    rotulo={rotulo}
                    quantidade={q}
                    total={
                      r.enps.promotores + r.enps.neutros + r.enps.detratores
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}
          {"media" in r && r.media !== undefined ? (
            <>
              <p className="pesquisas__forte">
                {`Média ${r.media === null ? "—" : umaCasa(r.media)}`}
              </p>
              {r.distribuicao && r.distribuicao.length > 0 ? (
                <ul className="pesquisas__linhas" aria-label="Distribuição">
                  {r.distribuicao.map((d) => (
                    <LinhaComBarra
                      key={d.valor}
                      rotulo={String(d.valor)}
                      quantidade={d.quantidade}
                      total={r.respondidas}
                    />
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          {"opcoes" in r ? (
            <>
              <ul className="pesquisas__linhas">
                {r.opcoes.map((o) => (
                  <LinhaComBarra
                    key={o.opcaoId}
                    rotulo={
                      p.config.opcoes?.find((x) => x.id === o.opcaoId)?.texto ??
                      "Opção removida"
                    }
                    quantidade={o.quantidade}
                    total={r.respondidas}
                  />
                ))}
              </ul>
              {r.outros.length > 0 ? (
                <>
                  <p className="pesquisas__suave">
                    Escritas em &quot;Outro&quot;
                  </p>
                  <ul className="pesquisas__textos">
                    {r.outros.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : null}
          {"sim" in r ? (
            <ul className="pesquisas__linhas">
              <LinhaComBarra
                rotulo="Sim"
                quantidade={r.sim}
                total={r.sim + r.nao}
              />
              <LinhaComBarra
                rotulo="Não"
                quantidade={r.nao}
                total={r.sim + r.nao}
              />
            </ul>
          ) : null}
          {"textos" in r ? (
            r.textos.length === 0 ? (
              <p className="pesquisas__suave">Nenhum texto escrito.</p>
            ) : (
              <ul className="pesquisas__textos">
                {r.textos.map((t, i) => (
                  <li key={i}>
                    {t.texto}
                    {identificada && t.autor ? (
                      <span className="pesquisas__suave">{` — ${t.autor}`}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}
          {"datas" in r ? (
            <ul className="pesquisas__linhas">
              {r.datas.map((d) => (
                <LinhaComBarra
                  key={d.valor}
                  rotulo={formatarDiaCivil(d.valor)}
                  quantidade={d.quantidade}
                  total={r.respondidas}
                />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

function PorDepartamento({
  servico,
  detalhe,
  geral,
}: {
  readonly servico: ServicoDePesquisas;
  readonly detalhe: PesquisaDetalhe;
  readonly geral: ResultadosPesquisa;
}) {
  const [porDep, setPorDep] = useState<Record<string, ResultadosPesquisa>>({});
  const [falhou, setFalhou] = useState(false);
  const todas = perguntasEmOrdem(detalhe.secoes);
  const escalas = todas
    .map((p, i) => ({ p, n: i + 1 }))
    .filter(({ p }) => TIPOS_DE_ESCALA.has(p.tipo));
  const visiveis = geral.departamentos.filter((d) => d.visivel);

  useEffect(() => {
    let vivo = true;
    Promise.all(
      visiveis.map((d) =>
        Promise.resolve(servico.resultadosDaPesquisa(detalhe.id, d.id)).then(
          (r) => [d.id, r] as const,
        ),
      ),
    )
      .then((pares) => {
        if (vivo) setPorDep(Object.fromEntries(pares));
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
    // Os departamentos visíveis vêm do resultado geral já carregado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, detalhe.id, geral]);

  if (geral.departamentos.length === 0) {
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Sem departamentos para comparar.</strong>
        <span className="pesquisas__suave">
          Os recortes aparecem quando quem respondeu tem departamento.
        </span>
      </div>
    );
  }
  if (escalas.length === 0) {
    return (
      <p className="pesquisas__suave">
        Esta pesquisa não tem perguntas de escala para comparar entre
        departamentos.
      </p>
    );
  }

  const media = (depId: string, perguntaId: string): string => {
    const r = porDep[depId]?.perguntas.find((x) => x.perguntaId === perguntaId);
    if (!r || !("media" in r) || r.media === undefined || r.media === null)
      return "—";
    return umaCasa(r.media);
  };

  return (
    <>
      {falhou ? (
        <p className="pesquisas__erro" role="alert">
          Não foi possível carregar algum departamento.
        </p>
      ) : null}
      <div className="pesquisas__tabela-caixa">
        <table
          className="pesquisas__tabela"
          aria-label="Médias por departamento"
        >
          <thead>
            <tr>
              <th scope="col">Departamento</th>
              <th scope="col" className="pesquisas__numero">
                Respostas
              </th>
              {escalas.map(({ p, n }) => (
                <th key={p.id} scope="col" className="pesquisas__numero">
                  <abbr title={p.texto}>{`P${n}`}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {geral.departamentos.map((d) => {
              const dados = porDep[d.id];
              const escondido = !d.visivel || (dados && !dados.filtro.visivel);
              return (
                <tr key={d.id}>
                  <th scope="row">{d.nome}</th>
                  <td className="pesquisas__numero">{d.respostas}</td>
                  {escondido ? (
                    <td colSpan={escalas.length} className="pesquisas__suave">
                      Poucas respostas para mostrar
                    </td>
                  ) : (
                    escalas.map(({ p }) => (
                      <td key={p.id} className="pesquisas__numero">
                        {media(d.id, p.id)}
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ol className="pesquisas__gaveta-lista" aria-label="Perguntas comparadas">
        {escalas.map(({ p, n }) => (
          <li key={p.id} value={n}>
            {p.texto}
          </li>
        ))}
      </ol>
      <p className="pesquisas__suave">
        {`Departamentos com menos de ${plural(detalhe.minimoPorGrupo, "resposta", "respostas")} não mostram números.`}
      </p>
    </>
  );
}

function RespostasIndividuais({
  carregar,
  detalhe,
}: {
  readonly carregar: () => Promise<RespostaIndividual[]>;
  readonly detalhe: PesquisaDetalhe;
}) {
  const [lista, setLista] = useState<RespostaIndividual[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(carregar())
      .then((r) => {
        if (vivo) setLista(r);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
    // Carrega uma vez ao abrir a aba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (falhou) {
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar as respostas.
      </p>
    );
  }
  if (!lista) return <Esqueleto rotulo="Carregando respostas…" linhas={4} />;
  if (lista.length === 0) {
    return (
      <div className="pesquisas__aba-vazia">
        <strong>Ninguém respondeu ainda.</strong>
      </div>
    );
  }
  return (
    <>
      <p className="pesquisas__suave">
        A consulta às respostas individuais fica registrada na auditoria.
      </p>
      <ul className="pesquisas__ficha-lista">
        {lista.map((r) => {
          const abertaAgora = aberta === r.colaboradorId;
          return (
            <li key={r.colaboradorId} className="pesquisas__ficha-item">
              <button
                type="button"
                className="pesquisas__ficha-botao"
                aria-expanded={abertaAgora}
                onClick={() => setAberta(abertaAgora ? null : r.colaboradorId)}
              >
                <span className="pesquisas__forte">{r.nome}</span>
                <span className="pesquisas__suave">
                  {[
                    r.departamento,
                    `respondida em ${dataDoInstante(r.respondidaEm)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
              {abertaAgora ? (
                <RespostasDaPessoa
                  rotulo={`Respostas de ${r.nome}`}
                  secoes={detalhe.secoes}
                  valores={r.valores}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
