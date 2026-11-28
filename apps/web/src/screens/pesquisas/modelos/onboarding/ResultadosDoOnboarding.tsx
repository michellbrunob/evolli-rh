/**
 * T216 — resultados do Onboarding: Visão geral (índice geral e por bloco de
 * 0 a 100 em cada rodada, o que mudou entre as rodadas, para onde foi a
 * intenção de ficar, o principal motivo para ficar, a recomendação, o peso
 * de cada bloco, contatos e o que melhorar/manter) e Envios (os convites
 * por pessoa, com "Pular envio"). Cada rodada só mostra números com 3
 * respostas ou mais. Exporta a planilha (.xlsx) no padrão do módulo e o
 * relatório em PDF (rota própria). Fora da anônima, "Ver por" recorta por
 * departamento, unidade ou centro de custo (cada rodada continua com o
 * mínimo de 3 respostas); na identificada, cada pessoa tem a sua jornada
 * (admissão, cargo, unidade e as rodadas). A intenção de ficar entre duas
 * rodadas aparece num diagrama de fluxo.
 */
import { useEffect, useMemo, useState } from "react";
import type { CampoGrupo, Secao } from "../../../../api/pesquisasClient";
import { Button, StatusBadge } from "../../../../components";
import { plural } from "../../../../format/plural";
import { baixarArquivo } from "../../../dashboard/exportacao";
import { TIPO_MIME_XLSX } from "../../../pessoas/importacao/planilhaXlsx";
import { Esqueleto } from "../../../../ui/movimento";
import { CampoDeBusca } from "../../componentes";
import { enderecoDaRota } from "../../rotasDePesquisas";
import {
  FAIXAS,
  ROTULOS_DA_INTENCAO,
  perguntaDaChave,
  rotuloDaRodada,
} from "./envio";
import type {
  ClienteDoOnboarding,
  EnviosDoOnboarding,
  JornadaDoOnboarding,
  ResultadosDoOnboarding as Resultados,
  SituacaoDoEnvio,
} from "./cliente";
import { nomeDaPlanilha, planilhaDoOnboarding } from "./exportacaoDoOnboarding";
import { formatarDiaCivil } from "../../../../format/data";
import { ROTULO_DA_SITUACAO } from "./regrasDoOnboarding";
import { EtapaPerguntas } from "./AssistenteDoOnboarding";
import "../AvaliacaoOnboarding.css";

type Aba = "geral" | "envios" | "perguntas";

/** Os recortes que a API sabe fazer (lotação gravada no envio). */
const CAMPOS_DO_RECORTE: readonly { campo: CampoGrupo; rotulo: string }[] = [
  { campo: "departamento", rotulo: "Departamento" },
  { campo: "unidade", rotulo: "Unidade" },
  { campo: "centroCusto", rotulo: "Centro de custo" },
];

const TOM_DA_SITUACAO: Readonly<
  Record<SituacaoDoEnvio, "neutral" | "success" | "warning" | "info" | "danger">
> = {
  agendado: "info",
  aguardando_email: "warning",
  enviado: "info",
  sem_email: "danger",
  respondido: "success",
  pulado: "neutral",
};

export function ResultadosDoOnboarding({
  pesquisaId,
  nome,
  secoes: secoesIniciais,
  cliente,
  hoje,
  abaInicial = "geral",
  podeEditar = false,
}: {
  readonly pesquisaId: string;
  readonly nome: string;
  readonly secoes: readonly Secao[];
  readonly cliente: Pick<
    ClienteDoOnboarding,
    "resultados" | "envios" | "pular"
  > &
    Partial<Pick<ClienteDoOnboarding, "alterarPerguntas">>;
  readonly hoje: string;
  readonly abaInicial?: Aba;
  /** RH/DP com a pesquisa ativa ou pausada: edita as perguntas. */
  readonly podeEditar?: boolean;
}) {
  const [secoes, setSecoes] = useState<readonly Secao[]>(secoesIniciais);
  const [r, setR] = useState<Resultados | null>(null);
  const [envios, setEnvios] = useState<EnviosDoOnboarding | null>(null);
  const [falha, setFalha] = useState(false);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [recarga, setRecarga] = useState(0);
  const [recorte, setRecorte] = useState<{
    campo: CampoGrupo;
    grupoId: string;
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      recorte
        ? cliente.resultados(pesquisaId, recorte)
        : cliente.resultados(pesquisaId),
      cliente.envios(pesquisaId),
    ])
      .then(([a, b]) => {
        if (!vivo) return;
        setR(a);
        setEnvios(b);
      })
      .catch(() => vivo && setFalha(true));
    return () => {
      vivo = false;
    };
  }, [cliente, pesquisaId, recarga, recorte]);

  if (falha) {
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar o onboarding.
      </p>
    );
  }
  if (!r || !envios)
    return <Esqueleto rotulo="Carregando o onboarding…" linhas={4} />;

  return (
    <div className="avaliacao__resultados">
      <div className="avaliacao__barra-de-acoes">
        <p className="pesquisas__suave">
          {plural(r.respostas, "resposta", "respostas")}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            baixarArquivo(
              planilhaDoOnboarding(nome, secoes, r, envios),
              nomeDaPlanilha(nome),
              TIPO_MIME_XLSX,
            )
          }
        >
          Exportar Excel (.xlsx)
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            // O relatório em PDF: páginas A4 próprias, em outra aba.
            window.open(
              enderecoDaRota({ tela: "relatorio", id: pesquisaId }),
              "_blank",
              "noopener",
            )
          }
        >
          Exportar PDF
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Resultados do onboarding"
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
          aria-selected={aba === "envios"}
          onClick={() => setAba("envios")}
        >
          {`Envios (${envios.itens.length})`}
        </button>
        {podeEditar && cliente.alterarPerguntas ? (
          <button
            type="button"
            role="tab"
            className="evolli-aba"
            aria-selected={aba === "perguntas"}
            onClick={() => setAba("perguntas")}
          >
            Perguntas
          </button>
        ) : null}
      </div>
      <div role="tabpanel" className="pesquisas__resultados">
        {aba === "geral" && r.identificacao !== "anonima" ? (
          <VerPor r={r} recorte={recorte} onRecorte={setRecorte} />
        ) : null}
        {aba === "geral" ? (
          <VisaoGeral
            r={r}
            secoes={secoes}
            envios={envios}
            hoje={hoje}
            onEnvios={() => setAba("envios")}
          />
        ) : aba === "perguntas" && cliente.alterarPerguntas ? (
          <EditarPerguntas
            secoes={secoes}
            temRespostas={r.respostas > 0}
            salvar={(novas) => cliente.alterarPerguntas!(pesquisaId, novas)}
            onSalvas={(novas) => {
              setSecoes(novas);
              setRecarga((n) => n + 1);
            }}
          />
        ) : (
          <Envios
            envios={envios}
            hoje={hoje}
            onPular={async (id) => {
              await cliente.pular(pesquisaId, id);
              setRecarga((n) => n + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

function SeloDaFaixa({
  faixa,
}: {
  readonly faixa: Resultados["rodadas"][number]["faixa"];
}) {
  if (!faixa) return null;
  return (
    <StatusBadge variant={FAIXAS[faixa].tom}>
      {FAIXAS[faixa].rotulo}
    </StatusBadge>
  );
}

function VisaoGeral({
  r,
  secoes,
  envios,
  hoje,
  onEnvios,
}: {
  readonly r: Resultados;
  readonly secoes: readonly Secao[];
  readonly envios: EnviosDoOnboarding;
  readonly hoje: string;
  readonly onEnvios: () => void;
}) {
  const visiveis = r.rodadas.filter((x) => x.visivel);
  const textoDaOpcao = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of secoes)
      for (const p of s.perguntas)
        for (const o of p.config.opcoes ?? []) m.set(o.id, o.texto);
    return m;
  }, [secoes]);
  const intencaoRotulo = (opcaoId: string) => {
    const q13 = perguntaDaChave(secoes, "q13");
    const i = q13?.config.opcoes?.findIndex((o) => o.id === opcaoId) ?? -1;
    return i >= 0 && i < ROTULOS_DA_INTENCAO.length
      ? ROTULOS_DA_INTENCAO[i]!
      : (textoDaOpcao.get(opcaoId) ?? "");
  };
  const proximo = envios.itens
    .filter((e) => e.situacao === "agendado" && e.dataPrevista >= hoje)
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista))[0];

  if (r.respostas === 0) {
    return (
      <section
        className="pesquisas__sem-respostas"
        aria-label="Ainda sem respostas"
      >
        <h2 className="pesquisas__cartao-secao-titulo">Ainda sem respostas</h2>
        <p className="pesquisas__suave">
          {proximo
            ? `A pesquisa está ativa. O próximo convite sai em ${formatarDiaCivil(proximo.dataPrevista)}, às ${envios.horario}. Os resultados aparecem a partir de 3 respostas.`
            : "A pesquisa está ativa. Os resultados aparecem a partir de 3 respostas."}
        </p>
        <Button variant="secondary" onClick={onEnvios}>
          Ver próximos envios
        </Button>
      </section>
    );
  }

  return (
    <>
      <div className="onboarding__numeros">
        {r.rodadas.map((x) => (
          <section
            key={x.rodada}
            className="pesquisas__cartao-secao"
            aria-label={`Rodada ${rotuloDaRodada(x.rodada)}`}
          >
            <p className="pesquisas__rotulo">{`Índice geral · ${rotuloDaRodada(x.rodada)}`}</p>
            {x.visivel ? (
              <>
                <p className="avaliacao__nota-grande">
                  {x.indice ?? "—"}{" "}
                  <span className="pesquisas__suave">/100</span>
                </p>
                <SeloDaFaixa faixa={x.faixa} />
                <p className="pesquisas__suave">
                  {plural(x.respostas, "resposta", "respostas")}
                </p>
              </>
            ) : (
              <p className="pesquisas__suave">
                {`Esta rodada tem ${plural(x.respostas, "resposta", "respostas")}. Os resultados aparecem com 3, para ninguém ser identificado. Faltam ${x.faltam}.`}
              </p>
            )}
          </section>
        ))}
      </div>

      {visiveis.length ? (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Média de cada bloco"
        >
          <h2 className="pesquisas__cartao-secao-titulo">
            Média de cada bloco, de 0 a 100
          </h2>
          <table className="pesquisas__tabela">
            <thead>
              <tr>
                <th scope="col">Bloco</th>
                {visiveis.map((x) => (
                  <th scope="col" key={x.rodada}>
                    {rotuloDaRodada(x.rodada)}
                  </th>
                ))}
                {r.comparacoes.length ? <th scope="col">Mudou</th> : null}
              </tr>
            </thead>
            <tbody>
              {visiveis[0]!.blocos.map((b) => {
                const mudou =
                  r.comparacoes.at(-1)?.blocos.find((x) => x.id === b.id)
                    ?.mudou ?? null;
                return (
                  <tr key={b.id}>
                    <th scope="row">{b.titulo}</th>
                    {visiveis.map((x) => {
                      const bx = x.blocos.find((y) => y.id === b.id);
                      return (
                        <td
                          key={x.rodada}
                          className={
                            bx?.faixa
                              ? `onboarding__faixa--${bx.faixa}`
                              : undefined
                          }
                        >
                          {bx?.indice ?? "—"}
                        </td>
                      );
                    })}
                    {r.comparacoes.length ? (
                      <td className="avaliacao__numero">
                        {mudou === null
                          ? "—"
                          : mudou > 0
                            ? `+${mudou}`
                            : mudou < 0
                              ? `−${Math.abs(mudou)}`
                              : "0"}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="pesquisas__suave">
            Crítico abaixo de 50 · Atenção 50 a 69 · Saudável 70 a 84 · Forte 85
            ou mais.
          </p>
          {visiveis.some(
            (x) => x.intencao?.querContinuar !== null && x.intencao,
          ) ? (
            <p>
              {`Quer continuar na empresa nos próximos 6 meses: ${visiveis
                .filter((x) => x.intencao?.querContinuar !== null && x.intencao)
                .map((x) =>
                  `${x.intencao!.querContinuar}% ${x.rodada ? `aos ${x.rodada} dias` : ""}`.trim(),
                )
                .join(" e ")}.`}
            </p>
          ) : null}
        </section>
      ) : null}

      {visiveis.some((x) => x.intencao) ? (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Intenção de ficar"
        >
          <h2 className="pesquisas__cartao-secao-titulo">
            Intenção nos próximos 6 meses
          </h2>
          {visiveis.map((x) =>
            x.intencao ? (
              <div key={x.rodada}>
                <p className="pesquisas__rotulo">{rotuloDaRodada(x.rodada)}</p>
                <ul className="onboarding__lista">
                  {x.intencao.opcoes.map((o) => (
                    <li key={o.opcaoId} className="avaliacao__ranking-linha">
                      {`${intencaoRotulo(o.opcaoId)}: ${o.percentual}% (${o.quantidade})`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {r.fluxo ? (
            r.fluxo.visivel ? (
              <div aria-label="Para onde foi a intenção de ficar">
                <p className="pesquisas__rotulo">{`Para onde foi a intenção de ficar (${rotuloDaRodada(r.fluxo.de)} → ${rotuloDaRodada(r.fluxo.para)})`}</p>
                <DiagramaDoFluxo
                  de={rotuloDaRodada(r.fluxo.de)}
                  para={rotuloDaRodada(r.fluxo.para)}
                  fluxos={r.fluxo.fluxos}
                  ordem={
                    perguntaDaChave(secoes, "q13")?.config.opcoes?.map(
                      (o) => o.id,
                    ) ?? []
                  }
                  rotulo={intencaoRotulo}
                />
                <ul className="onboarding__lista">
                  {r.fluxo.fluxos.map((f) => (
                    <li
                      key={`${f.de}-${f.para}`}
                    >{`${intencaoRotulo(f.de)} → ${intencaoRotulo(f.para)}: ${plural(f.quantidade, "pessoa", "pessoas")}`}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="pesquisas__suave">
                O caminho da intenção entre as rodadas aparece com 3 pessoas ou
                mais que responderam às duas.
              </p>
            )
          ) : r.identificacao === "confidencial" ? (
            <p className="pesquisas__suave">
              Na confidencial, as rodadas não são ligadas pessoa a pessoa.
            </p>
          ) : null}
        </section>
      ) : null}

      {visiveis.some((x) => x.motivos) ? (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Principal motivo para ficar"
        >
          <h2 className="pesquisas__cartao-secao-titulo">
            Principal motivo para ficar
          </h2>
          {visiveis.map((x) =>
            x.motivos ? (
              <div key={x.rodada}>
                <p className="pesquisas__rotulo">{rotuloDaRodada(x.rodada)}</p>
                <ul className="onboarding__lista">
                  {[...x.motivos.opcoes]
                    .sort((a, b) => b.quantidade - a.quantidade)
                    .map((o) => (
                      <li
                        key={o.opcaoId}
                      >{`${textoDaOpcao.get(o.opcaoId) ?? ""}: ${o.percentual}%`}</li>
                    ))}
                  {x.motivos.outros.length ? (
                    <li>{`Outro: ${x.motivos.outros.join("; ")}`}</li>
                  ) : null}
                </ul>
              </div>
            ) : null,
          )}
        </section>
      ) : null}

      {visiveis.some((x) => x.recomendacao) ? (
        <section className="pesquisas__cartao-secao" aria-label="Recomendação">
          <h2 className="pesquisas__cartao-secao-titulo">
            Recomendaria a empresa (0 a 10)
          </h2>
          <p className="pesquisas__suave">
            % de notas 9 e 10 menos % de notas 0 a 6.
          </p>
          <ul className="onboarding__lista">
            {visiveis.map((x) =>
              x.recomendacao ? (
                <li key={x.rodada}>
                  {`${rotuloDaRodada(x.rodada)}: ${x.recomendacao.indice ?? "—"} · ${x.recomendacao.promotores} 9–10 · ${x.recomendacao.neutros} 7–8 · ${x.recomendacao.detratores} 0–6`}
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <section
        className="pesquisas__cartao-secao"
        aria-label="Peso de cada bloco"
      >
        <h2 className="pesquisas__cartao-secao-titulo">
          Peso de cada bloco na vontade de ficar
        </h2>
        {r.peso.suficiente ? (
          <table className="pesquisas__tabela">
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
                  <th scope="row">{b.titulo}</th>
                  <td>{b.indice ?? "—"}</td>
                  <td>
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
          <p className="pesquisas__suave">
            O peso aparece com 20 respostas ou mais. Prioridade: nota abaixo de
            70 e peso 0,4 ou mais.
          </p>
        )}
      </section>

      {r.contatos.length ? (
        <section className="pesquisas__cartao-secao" aria-label="Contatos">
          <h2 className="pesquisas__cartao-secao-titulo">
            Quem quer conversar com o RH
          </h2>
          <p className="pesquisas__suave">
            Para não ligar o contato às respostas, a lista não mostra nome,
            rodada nem data.
          </p>
          <ul className="onboarding__lista">
            {r.contatos.map((c, i) => (
              <li key={`${c}-${i}`}>{c}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.melhorar.length || r.gosta.length ? (
        <section className="pesquisas__cartao-secao" aria-label="Comentários">
          <h2 className="pesquisas__cartao-secao-titulo">Comentários</h2>
          {r.melhorar.length ? (
            <>
              <p className="pesquisas__rotulo">
                O que poderia ter sido diferente
              </p>
              <ul className="onboarding__lista">
                {r.melhorar.map((t, i) => (
                  <li key={i}>{`“${t}”`}</li>
                ))}
              </ul>
            </>
          ) : null}
          {r.gosta.length ? (
            <>
              <p className="pesquisas__rotulo">
                O que a pessoa gosta e quer que continue
              </p>
              <ul className="onboarding__lista">
                {r.gosta.map((t, i) => (
                  <li key={i}>{`“${t}”`}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <section
        className="pesquisas__cartao-secao"
        aria-label="Funil dos convites"
      >
        <h2 className="pesquisas__cartao-secao-titulo">Funil dos convites</h2>
        <div className="onboarding__numeros">
          <div>
            <span className="pesquisas__suave">No público</span>
            <strong>{r.funil.noPublico}</strong>
          </div>
          <div>
            <span className="pesquisas__suave">Sem e-mail</span>
            <strong>{r.funil.semEmail}</strong>
          </div>
          <div>
            <span className="pesquisas__suave">Aguardando e-mail</span>
            <strong>{r.funil.aguardandoEmail}</strong>
          </div>
          <div>
            <span className="pesquisas__suave">Responderam</span>
            <strong>{r.funil.responderam}</strong>
          </div>
        </div>
        <p className="pesquisas__suave">
          Abrir e clicar no convite entram no funil quando o envio por e-mail
          estiver ligado.
        </p>
      </section>
    </>
  );
}

function Envios({
  envios,
  hoje,
  onPular,
}: {
  readonly envios: EnviosDoOnboarding;
  readonly hoje: string;
  readonly onPular: (id: string) => Promise<void>;
}) {
  const [filtro, setFiltro] = useState<
    "todos" | "proximos" | "enviados" | "sem_email"
  >("todos");
  const [busca, setBusca] = useState("");
  const [jornada, setJornada] = useState<string | null>(null);
  const jornadaAberta =
    envios.jornadas?.find((j) => j.colaboradorId === jornada) ?? null;
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const itens = envios.itens.filter((e) => {
    if (termo && !e.nome.toLocaleLowerCase("pt-BR").includes(termo))
      return false;
    if (filtro === "proximos") return e.situacao === "agendado";
    if (filtro === "enviados")
      return (
        e.situacao === "aguardando_email" ||
        e.situacao === "enviado" ||
        e.situacao === "respondido"
      );
    if (filtro === "sem_email") return e.situacao === "sem_email";
    return true;
  });
  const proximo = envios.itens
    .filter((e) => e.situacao === "agendado" && e.dataPrevista >= hoje)
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista))[0];
  return (
    <section className="pesquisas__cartao-secao" aria-label="Envios">
      <p className="pesquisas__nota" role="status">
        {proximo
          ? `Próximo envio: ${formatarDiaCivil(proximo.dataPrevista)} às ${envios.horario} · ${proximo.nome}.`
          : "Nenhum envio agendado."}
      </p>
      <div
        className="pesquisas__pilulas"
        role="group"
        aria-label="Filtrar envios"
      >
        {(
          [
            ["todos", "Todos"],
            ["proximos", "Próximos"],
            ["enviados", "Enviados"],
            ["sem_email", "Sem e-mail"],
          ] as const
        ).map(([v, rot]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filtro === v}
            onClick={() => setFiltro(v)}
          >
            {rot}
          </button>
        ))}
      </div>
      <CampoDeBusca
        rotulo="Buscar colaborador"
        valor={busca}
        onMudar={setBusca}
      />
      {jornadaAberta ? (
        <Jornada j={jornadaAberta} onFechar={() => setJornada(null)} />
      ) : null}
      <table className="pesquisas__tabela">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Colaborador</th>
            <th scope="col">Rodada</th>
            <th scope="col">Situação</th>
            <th scope="col">Ação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((e) => (
            <tr key={e.id}>
              <td>{formatarDiaCivil(e.dataPrevista)}</td>
              <th scope="row">
                {envios.jornadas ? (
                  <button
                    type="button"
                    className="pesquisas__acao-texto"
                    aria-label={`Ver a jornada de ${e.nome}`}
                    onClick={() => setJornada(e.colaboradorId)}
                  >
                    {e.nome}
                  </button>
                ) : (
                  e.nome
                )}
              </th>
              <td>{rotuloDaRodada(e.rodada)}</td>
              <td>
                <StatusBadge variant={TOM_DA_SITUACAO[e.situacao]}>
                  {e.situacao === "agendado"
                    ? `Agendado ${envios.horario}`
                    : ROTULO_DA_SITUACAO[e.situacao]}
                </StatusBadge>
              </td>
              <td>
                {e.situacao === "agendado" ? (
                  <Button
                    variant="subtle"
                    onClick={() => void onPular(e.id)}
                    aria-label={`Pular envio de ${e.nome}`}
                  >
                    Pular envio
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {envios.identificacao === "anonima" ? (
        <p className="pesquisas__suave">
          Na anônima, ninguém sabe quem respondeu: esta aba mostra só quem
          recebeu o convite.
        </p>
      ) : null}
    </section>
  );
}

/** "Ver por": o recorte por grupo (fora da anônima). */
function VerPor({
  r,
  recorte,
  onRecorte,
}: {
  readonly r: Resultados;
  readonly recorte: { campo: CampoGrupo; grupoId: string } | null;
  readonly onRecorte: (
    x: { campo: CampoGrupo; grupoId: string } | null,
  ) => void;
}) {
  const [campo, setCampo] = useState<CampoGrupo>(
    recorte?.campo ?? "departamento",
  );
  const grupos = r.grupos[campo] ?? [];
  const nomeDoGrupo = recorte
    ? (r.grupos[recorte.campo] ?? []).find((g) => g.id === recorte.grupoId)
        ?.nome
    : null;
  return (
    <div className="onboarding__ver-por" role="group" aria-label="Ver por">
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Ver por</span>
        <select
          value={campo}
          onChange={(e) => {
            setCampo(e.target.value as CampoGrupo);
            onRecorte(null);
          }}
        >
          {CAMPOS_DO_RECORTE.map((c) => (
            <option key={c.campo} value={c.campo}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="pesquisas__campo">
        <span className="pesquisas__rotulo">Grupo</span>
        <select
          value={recorte?.campo === campo ? recorte.grupoId : ""}
          onChange={(e) =>
            onRecorte(
              e.target.value ? { campo, grupoId: e.target.value } : null,
            )
          }
        >
          <option value="">Todas as respostas</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </select>
      </label>
      <p className="pesquisas__suave">
        {nomeDoGrupo
          ? `Mostrando só ${nomeDoGrupo}. Cada rodada continua com o mínimo de 3 respostas, para ninguém ser identificado.`
          : "Cada grupo só mostra números com 3 respostas ou mais na rodada."}
      </p>
    </div>
  );
}

/** A jornada de uma pessoa (identificada): cadastro e rodadas. */
function Jornada({
  j,
  onFechar,
}: {
  readonly j: JornadaDoOnboarding;
  readonly onFechar: () => void;
}) {
  return (
    <section
      className="pesquisas__cartao-secao"
      aria-label={`Jornada de ${j.nome}`}
    >
      <h2 className="pesquisas__cartao-secao-titulo">{`Jornada de ${j.nome}`}</h2>
      <dl className="avaliacao__resumo">
        <div>
          <dt>Admissão</dt>
          <dd>{j.admissao ? formatarDiaCivil(j.admissao) : "—"}</dd>
        </div>
        <div>
          <dt>Cargo</dt>
          <dd>{j.cargo ?? "—"}</dd>
        </div>
        <div>
          <dt>Unidade</dt>
          <dd>{j.unidade ?? "—"}</dd>
        </div>
        <div>
          <dt>Rodadas respondidas</dt>
          <dd>{`${j.respondidas} de ${j.rodadas.length}`}</dd>
        </div>
      </dl>
      <ol className="onboarding__lista" aria-label="Rodadas">
        {j.rodadas.map((x) => (
          <li key={x.rodada}>
            {`${rotuloDaRodada(x.rodada)} · ${formatarDiaCivil(x.dataPrevista)} · ${
              ROTULO_DA_SITUACAO[x.situacao as SituacaoDoEnvio] ?? x.situacao
            }`}
          </li>
        ))}
      </ol>
      <Button variant="subtle" onClick={onFechar}>
        Fechar a jornada
      </Button>
    </section>
  );
}

/**
 * O fluxo da intenção de ficar entre duas rodadas (diagrama de faixas):
 * à esquerda a resposta na 1ª rodada, à direita na 2ª; a espessura de cada
 * faixa é o número de pessoas. Só aparece com 3 pessoas ou mais.
 */
export function DiagramaDoFluxo({
  de,
  para,
  fluxos,
  ordem,
  rotulo,
}: {
  readonly de: string;
  readonly para: string;
  readonly fluxos: readonly { de: string; para: string; quantidade: number }[];
  /** A ordem das opções (a da pergunta). */
  readonly ordem: readonly string[];
  readonly rotulo: (opcaoId: string) => string;
}) {
  const total = fluxos.reduce((t, f) => t + f.quantidade, 0);
  if (total === 0) return null;
  const pos = (id: string) => {
    const i = ordem.indexOf(id);
    return i < 0 ? ordem.length : i;
  };
  const lado = (chave: "de" | "para") =>
    [...new Set(fluxos.map((f) => f[chave]))].sort((a, b) => pos(a) - pos(b));
  const esquerda = lado("de");
  const direita = lado("para");
  const LARGURA = 640;
  const ALTURA = 220;
  const NO = 14;
  const VAO = 10;
  const util = (n: number) => ALTURA - VAO * Math.max(n - 1, 0);
  const escala = (n: number) => util(n) / total;
  const nos = (ids: readonly string[], chave: "de" | "para") => {
    const k = escala(ids.length);
    let y = 0;
    return new Map(
      ids.map((id) => {
        const q = fluxos
          .filter((f) => f[chave] === id)
          .reduce((t, f) => t + f.quantidade, 0);
        const no = { y, altura: q * k, quantidade: q };
        y += q * k + VAO;
        return [id, no];
      }),
    );
  };
  const nosE = nos(esquerda, "de");
  const nosD = nos(direita, "para");
  const kE = escala(esquerda.length);
  const kD = escala(direita.length);
  const usadoE = new Map<string, number>();
  const usadoD = new Map<string, number>();
  const ordenados = [...fluxos].sort(
    (a, b) => pos(a.de) - pos(b.de) || pos(a.para) - pos(b.para),
  );
  const x0 = 170;
  const x1 = LARGURA - 170;
  const faixas = ordenados.map((f) => {
    const a = nosE.get(f.de)!;
    const b = nosD.get(f.para)!;
    const ya = a.y + (usadoE.get(f.de) ?? 0);
    const yb = b.y + (usadoD.get(f.para) ?? 0);
    const ha = f.quantidade * kE;
    const hb = f.quantidade * kD;
    usadoE.set(f.de, (usadoE.get(f.de) ?? 0) + ha);
    usadoD.set(f.para, (usadoD.get(f.para) ?? 0) + hb);
    const meio = (x0 + NO + x1) / 2;
    const d = [
      `M ${x0 + NO} ${ya}`,
      `C ${meio} ${ya}, ${meio} ${yb}, ${x1} ${yb}`,
      `L ${x1} ${yb + hb}`,
      `C ${meio} ${yb + hb}, ${meio} ${ya + ha}, ${x0 + NO} ${ya + ha}`,
      "Z",
    ].join(" ");
    return { f, d, mesma: f.de === f.para };
  });
  return (
    <svg
      className="onboarding__fluxo"
      viewBox={`0 -24 ${LARGURA} ${ALTURA + 32}`}
      role="img"
      aria-label={`Fluxo da intenção de ficar de ${de} para ${para}: ${plural(total, "pessoa", "pessoas")}`}
    >
      <text x={x0} y={-10} className="onboarding__fluxo-titulo">
        {de}
      </text>
      <text
        x={x1 + NO}
        y={-10}
        textAnchor="end"
        className="onboarding__fluxo-titulo"
      >
        {para}
      </text>
      {faixas.map(({ f, d, mesma }) => (
        <path
          key={`${f.de}-${f.para}`}
          d={d}
          className={`onboarding__fluxo-faixa${mesma ? "" : " onboarding__fluxo-faixa--mudou"}`}
        />
      ))}
      {[...nosE].map(([id, n]) => (
        <g key={`e-${id}`}>
          <rect
            x={x0}
            y={n.y}
            width={NO}
            height={Math.max(n.altura, 1)}
            className="onboarding__fluxo-no"
          />
          <text
            x={x0 - 6}
            y={n.y + n.altura / 2}
            textAnchor="end"
            dominantBaseline="middle"
            className="onboarding__fluxo-rotulo"
          >
            {`${rotulo(id)} (${n.quantidade})`}
          </text>
        </g>
      ))}
      {[...nosD].map(([id, n]) => (
        <g key={`d-${id}`}>
          <rect
            x={x1}
            y={n.y}
            width={NO}
            height={Math.max(n.altura, 1)}
            className="onboarding__fluxo-no"
          />
          <text
            x={x1 + NO + 6}
            y={n.y + n.altura / 2}
            dominantBaseline="middle"
            className="onboarding__fluxo-rotulo"
          >
            {`${rotulo(id)} (${n.quantidade})`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Publicado: as perguntas continuam editáveis. Depois da primeira
 * resposta, mudar uma pergunta cria uma nova versão; as respostas já dadas
 * continuam ligadas à versão em que foram respondidas.
 */
function EditarPerguntas({
  secoes,
  temRespostas,
  salvar,
  onSalvas,
}: {
  readonly secoes: readonly Secao[];
  readonly temRespostas: boolean;
  readonly salvar: (
    s: readonly Secao[],
  ) => Promise<{ secoes: Secao[]; novasVersoes: number }>;
  readonly onSalvas: (s: Secao[]) => void;
}) {
  const [rascunho, setRascunho] = useState<Secao[]>(() => [...secoes]);
  const [gravando, setGravando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const mudou = JSON.stringify(rascunho) !== JSON.stringify(secoes);
  return (
    <>
      <p className="avaliacao__aviso avaliacao__aviso--info" role="note">
        {temRespostas
          ? "Esta pesquisa já tem respostas: mudar uma pergunta cria uma nova versão. As respostas já dadas continuam ligadas à versão em que foram respondidas."
          : "Ainda sem respostas: as mudanças valem para todos os próximos convites."}
      </p>
      <EtapaPerguntas
        secoes={rascunho}
        onMudar={(s) => {
          setRascunho(s);
          setAviso(null);
        }}
      />
      {falha ? (
        <p className="pesquisas__erro" role="alert">
          {falha}
        </p>
      ) : null}
      {aviso ? (
        <p className="pesquisas__nota" role="status">
          {aviso}
        </p>
      ) : null}
      <div className="pesquisas__acoes">
        <Button
          variant="secondary"
          disabled={!mudou || gravando}
          onClick={() => setRascunho([...secoes])}
        >
          Desfazer
        </Button>
        <Button
          disabled={!mudou || gravando}
          onClick={async () => {
            setGravando(true);
            setFalha(null);
            try {
              const r = await salvar(rascunho);
              setRascunho(r.secoes);
              onSalvas(r.secoes);
              setAviso(
                r.novasVersoes
                  ? `Perguntas salvas · ${plural(r.novasVersoes, "nova versão criada", "novas versões criadas")}.`
                  : "Perguntas salvas.",
              );
            } catch {
              setFalha("Não foi possível salvar as perguntas. Tente de novo.");
            } finally {
              setGravando(false);
            }
          }}
        >
          Salvar perguntas
        </Button>
      </div>
    </>
  );
}
