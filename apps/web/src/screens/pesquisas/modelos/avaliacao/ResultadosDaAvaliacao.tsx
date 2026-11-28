/**
 * T216 — resultados da Avaliação 90°/180° (sempre nominais; só RH e DP):
 * Visão geral (nota do time, roda de competências, ranking, grupos, mapa
 * de talentos e, na 180°, gestor × autoavaliação), Pessoas (uma linha por
 * pessoa avaliada; abre o resultado da pessoa), Análises (por competência,
 * calibração entre gestores e recortes) e Andamento (quem já respondeu).
 * Exporta a planilha (.xlsx) no padrão do módulo.
 */
import { useEffect, useState } from "react";
import { Button, StatusBadge } from "../../../../components";
import { plural } from "../../../../format/plural";
import { baixarArquivo } from "../../../dashboard/exportacao";
import { TIPO_MIME_XLSX } from "../../../pessoas/importacao/planilhaXlsx";
import { Esqueleto } from "../../../../ui/movimento";
import { Avatar, iniciaisDe } from "../../componentes";
import {
  ALINHAMENTO,
  CALIBRACAO,
  GRUPOS_DA_NOTA,
  MAPA,
  NIVEIS,
  QUADRANTES,
  TEMPO_DE_CASA,
  competencia,
  diferenca1,
  item,
  nota1,
  type ModeloDeAvaliacao,
} from "./catalogo";
import type {
  AvaliacaoDetalhe,
  ClienteDaAvaliacao,
  ResultadosDaAvaliacao as Resultados,
} from "./cliente";
import { nomeDaPlanilha, planilhaDaAvaliacao } from "./exportacaoDaAvaliacao";
import {
  BarraDaNota,
  Halteres,
  RodaDeCompetencias,
} from "./graficosDaAvaliacao";
import { ResultadoDaPessoa } from "./ResultadoDaPessoa";
import "../AvaliacaoOnboarding.css";

type Aba = "geral" | "pessoas" | "analises" | "andamento";

export function ResultadosDaAvaliacao({
  pesquisaId,
  nome,
  modelo,
  cliente,
}: {
  readonly pesquisaId: string;
  readonly nome: string;
  readonly modelo: ModeloDeAvaliacao;
  readonly cliente: Pick<ClienteDaAvaliacao, "resultados" | "pessoa" | "obter">;
}) {
  const [r, setR] = useState<Resultados | null>(null);
  const [andamento, setAndamento] = useState<AvaliacaoDetalhe | null>(null);
  const [falha, setFalha] = useState<"sem-acesso" | "erro" | null>(null);
  const [aba, setAba] = useState<Aba>("geral");
  const [pessoa, setPessoa] = useState<string | null>(null);
  const e180 = modelo === "avaliacao180";

  useEffect(() => {
    let vivo = true;
    Promise.all([cliente.resultados(pesquisaId), cliente.obter(pesquisaId)])
      .then(([res, det]) => {
        if (!vivo) return;
        setR(res);
        setAndamento(det);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setFalha(
          (e as { status?: number })?.status === 403 ? "sem-acesso" : "erro",
        );
      });
    return () => {
      vivo = false;
    };
  }, [cliente, pesquisaId]);

  if (falha === "sem-acesso") {
    return (
      <p className="pesquisas__nota" role="status">
        As notas da avaliação são nominais: só o RH e o DP veem.
      </p>
    );
  }
  if (falha) {
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar a avaliação.
      </p>
    );
  }
  if (!r || !andamento)
    return <Esqueleto rotulo="Carregando a avaliação…" linhas={4} />;

  if (pessoa) {
    return (
      <ResultadoDaPessoa
        pesquisaId={pesquisaId}
        colaboradorId={pessoa}
        carregar={cliente.pessoa}
        onVoltar={() => setPessoa(null)}
      />
    );
  }

  const nomeDe = new Map(r.pessoas.map((p) => [p.colaboradorId, p.nome]));
  const abas: { valor: Aba; rotulo: string }[] = [
    { valor: "geral", rotulo: "Visão geral" },
    { valor: "pessoas", rotulo: `Pessoas (${r.pessoas.length})` },
    { valor: "analises", rotulo: "Análises" },
    { valor: "andamento", rotulo: "Andamento" },
  ];

  return (
    <div className="avaliacao__resultados">
      <div className="avaliacao__barra-de-acoes">
        <p className="pesquisas__suave">
          {`${plural(r.avaliadas, "pessoa avaliada", "pessoas avaliadas")} de ${r.previstas}`}
          {e180
            ? ` · ${plural(r.autoavaliacoes.respondidas, "autoavaliação", "autoavaliações")} de ${r.autoavaliacoes.previstas}`
            : ""}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            baixarArquivo(
              planilhaDaAvaliacao(nome, r),
              nomeDaPlanilha(nome),
              TIPO_MIME_XLSX,
            )
          }
        >
          Exportar Excel (.xlsx)
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Exportar PDF
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Resultados da avaliação"
        className="pesquisas__abas"
      >
        {abas.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            className="evolli-aba"
            aria-selected={aba === a.valor}
            onClick={() => setAba(a.valor)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pesquisas__resultados">
        {aba === "geral" ? (
          r.avaliadas === 0 ? (
            <section
              className="pesquisas__sem-respostas"
              aria-label="Ainda sem avaliações"
            >
              <h2 className="pesquisas__cartao-secao-titulo">
                Ainda sem avaliações
              </h2>
              <p className="pesquisas__suave">
                Os resultados aparecem assim que os gestores enviarem as
                primeiras avaliações.
              </p>
            </section>
          ) : (
            <VisaoGeral r={r} e180={e180} nomeDe={nomeDe} />
          )
        ) : aba === "pessoas" ? (
          <TabelaDePessoas r={r} e180={e180} onAbrir={setPessoa} />
        ) : aba === "analises" ? (
          <Analises r={r} />
        ) : (
          <Andamento det={andamento} e180={e180} />
        )}
      </div>
    </div>
  );
}

function VisaoGeral({
  r,
  e180,
  nomeDe,
}: {
  readonly r: Resultados;
  readonly e180: boolean;
  readonly nomeDe: Map<string, string>;
}) {
  const nivel = r.time.nivel ? NIVEIS[r.time.nivel] : null;
  const medias = Object.fromEntries(
    r.time.competencias.map((c) => [c.competencia, c.media]),
  );
  return (
    <>
      <div className="avaliacao__indicadores">
        <section className="pesquisas__cartao-secao" aria-label="Nota do time">
          <p className="pesquisas__rotulo">Nota do time</p>
          <p className="avaliacao__nota-grande">
            {nota1(r.time.media)} <span className="pesquisas__suave">/5</span>
          </p>
          {nivel ? (
            <StatusBadge variant={nivel.tom}>{nivel.rotulo}</StatusBadge>
          ) : null}
          <p className="pesquisas__suave">
            Média das notas gerais das pessoas avaliadas.
          </p>
        </section>
        <section
          className="pesquisas__cartao-secao"
          aria-label="Roda de competências"
        >
          <RodaDeCompetencias
            rotulo="Roda de competências do time, de 1 a 5"
            series={[
              {
                nome: "Time",
                classe: "avaliacao__radar-serie--gestor",
                valores: medias,
              },
              ...(e180 && r.comparativo
                ? [
                    {
                      nome: "Autoavaliação",
                      classe: "avaliacao__radar-serie--auto",
                      valores: Object.fromEntries(
                        r.comparativo.competencias.map((c) => [
                          c.competencia,
                          c.autoavaliacao,
                        ]),
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>
      </div>

      <section
        className="pesquisas__cartao-secao"
        aria-label="Do mais forte ao mais fraco"
      >
        <h2 className="pesquisas__cartao-secao-titulo">
          Do mais forte ao mais fraco
        </h2>
        <p className="pesquisas__suave">
          Média de 1 a 5 de cada competência no time.
        </p>
        <ol className="avaliacao__ranking">
          {r.time.competencias.map((c) => {
            const comp = competencia(c.competencia);
            return (
              <li key={c.competencia}>
                <span>{comp.rotulo}</span>
                <BarraDaNota
                  nota={c.media}
                  cor={comp.cor}
                  rotulo={`${comp.rotulo}: ${nota1(c.media)}`}
                />
                <strong className="avaliacao__numero">{nota1(c.media)}</strong>
              </li>
            );
          })}
        </ol>
      </section>

      {e180 && r.comparativo && r.comparativo.completas > 0 ? (
        <section
          className="pesquisas__cartao-secao"
          aria-label="Gestor × autoavaliação"
        >
          <h2 className="pesquisas__cartao-secao-titulo">
            Gestor × autoavaliação
          </h2>
          <p className="pesquisas__suave">
            {`${plural(r.comparativo.completas, "avaliação completa", "avaliações completas")} · ordenado pela diferença (autoavaliação − gestor)`}
          </p>
          <Halteres linhas={r.comparativo.competencias} />
          <p className="avaliacao__rodape-grafico">
            {`${plural(r.comparativo.acima, "pessoa se vê acima", "pessoas se veem acima")} · ${plural(r.comparativo.alinhadas, "alinhada", "alinhadas")} · ${r.comparativo.abaixo} abaixo`}
          </p>
        </section>
      ) : null}

      <section
        className="pesquisas__cartao-secao"
        aria-label="Grupos pela nota"
      >
        <h2 className="pesquisas__cartao-secao-titulo">
          Grupos pela nota geral
        </h2>
        <div className="avaliacao__grupos">
          {(Object.keys(GRUPOS_DA_NOTA) as (keyof typeof GRUPOS_DA_NOTA)[]).map(
            (g) => (
              <div
                key={g}
                className={`avaliacao__grupo avaliacao__grupo--${g}`}
              >
                <strong>{`${GRUPOS_DA_NOTA[g].rotulo} · ${r.time.grupos[g].length}`}</strong>
                <span className="pesquisas__suave">
                  {GRUPOS_DA_NOTA[g].regra}
                </span>
                <ul>
                  {r.time.grupos[g].map((id) => (
                    <li key={id}>{nomeDe.get(id) ?? ""}</li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      </section>

      <section
        className="pesquisas__cartao-secao"
        aria-label="Mapa de talentos"
      >
        <h2 className="pesquisas__cartao-secao-titulo">Mapa de talentos</h2>
        <p className="pesquisas__suave">
          Entrega (o que a pessoa faz acontecer) × Pessoas (como trabalha com os
          outros). Alto: 4 ou mais; médio: 3 a 3,9; baixo: abaixo de 3.
        </p>
        <div
          className="avaliacao__mapa"
          role="table"
          aria-label="Mapa de talentos"
        >
          {MAPA.map((linha, i) => (
            <div role="row" key={i} className="avaliacao__mapa-linha">
              <span role="rowheader" className="avaliacao__mapa-eixo">
                {["Entrega alta", "Entrega média", "Entrega baixa"][i]}
              </span>
              {linha.map((q) => (
                <div
                  role="cell"
                  key={q}
                  className={`avaliacao__celula avaliacao__celula--${q}`}
                >
                  <strong>{`${QUADRANTES[q].rotulo} · ${r.time.mapa[q].length}`}</strong>
                  <span className="pesquisas__suave">
                    {QUADRANTES[q].regra}
                  </span>
                  <ul>
                    {r.time.mapa[q].map((id) => (
                      <li key={id}>
                        <Avatar
                          texto={iniciaisDe(nomeDe.get(id) ?? "")}
                          rotulo={nomeDe.get(id) ?? ""}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
          <div
            role="row"
            className="avaliacao__mapa-linha avaliacao__mapa-rodape"
          >
            <span role="cell" />
            <span role="columnheader">Pessoas baixa</span>
            <span role="columnheader">Pessoas média</span>
            <span role="columnheader">Pessoas alta</span>
          </div>
        </div>
      </section>
      <p className="pesquisas__nota">
        A nota é a percepção de um gestor: nunca use como critério único para
        promover ou desligar.
      </p>
    </>
  );
}

function TabelaDePessoas({
  r,
  e180,
  onAbrir,
}: {
  readonly r: Resultados;
  readonly e180: boolean;
  readonly onAbrir: (id: string) => void;
}) {
  return (
    <table className="pesquisas__tabela avaliacao__tabela">
      <thead>
        <tr>
          <th scope="col">Pessoa</th>
          <th scope="col">Gestor</th>
          <th scope="col">Nota</th>
          <th scope="col">Nível</th>
          <th scope="col">Mapa de talentos</th>
          {e180 ? <th scope="col">Autoavaliação</th> : null}
          {e180 ? <th scope="col">Diferença</th> : null}
          <th scope="col">Alertas</th>
        </tr>
      </thead>
      <tbody>
        {r.pessoas.map((p) => (
          <tr key={p.colaboradorId}>
            <th scope="row">
              <button
                type="button"
                className="pesquisas__acao-texto"
                onClick={() => onAbrir(p.colaboradorId)}
              >
                {p.nome}
              </button>
              {p.cargo ? (
                <span className="pesquisas__suave">{p.cargo}</span>
              ) : null}
            </th>
            <td>{p.gestor.nome}</td>
            <td className="avaliacao__numero">
              {p.nota ? nota1(p.nota.geral) : "Pendente"}
            </td>
            <td>
              {p.nota?.nivel ? (
                <StatusBadge variant={NIVEIS[p.nota.nivel].tom}>
                  {NIVEIS[p.nota.nivel].curto}
                </StatusBadge>
              ) : (
                "—"
              )}
            </td>
            <td>
              {p.nota?.quadrante ? QUADRANTES[p.nota.quadrante].rotulo : "—"}
            </td>
            {e180 ? (
              <td className="avaliacao__numero">
                {!p.temAutoavaliacao
                  ? "Sem autoavaliação"
                  : p.autoavaliacao
                    ? nota1(p.autoavaliacao.geral)
                    : "Pendente"}
              </td>
            ) : null}
            {e180 ? (
              <td>
                {p.alinhamento
                  ? `${diferenca1(p.diferenca)} · ${ALINHAMENTO[p.alinhamento]}`
                  : "—"}
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
  );
}

function Analises({ r }: { readonly r: Resultados }) {
  return (
    <>
      <section className="pesquisas__cartao-secao" aria-label="Por competência">
        <h2 className="pesquisas__cartao-secao-titulo">Por competência</h2>
        <table className="pesquisas__tabela">
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
                <th scope="row">{competencia(c.competencia).rotulo}</th>
                <td className="avaliacao__numero">{nota1(c.media)}</td>
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
      </section>
      <section
        className="pesquisas__cartao-secao"
        aria-label="Calibração entre gestores"
      >
        <h2 className="pesquisas__cartao-secao-titulo">
          Calibração entre gestores
        </h2>
        <p className="pesquisas__suave">
          A média que cada gestor deu comparada com a da empresa. Com 5
          avaliações ou mais; diferença de 0,4 ou mais indica outro critério.
        </p>
        <table className="pesquisas__tabela">
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
                <th scope="row">{c.nome}</th>
                <td>{plural(c.avaliadas, "pessoa", "pessoas")}</td>
                <td className="avaliacao__numero">{nota1(c.media)}</td>
                <td className="avaliacao__numero">{diferenca1(c.diferenca)}</td>
                <td>{CALIBRACAO[c.leitura]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="pesquisas__cartao-secao" aria-label="Recortes">
        <h2 className="pesquisas__cartao-secao-titulo">Recortes</h2>
        <p className="pesquisas__suave">
          Grupos com menos de 3 pessoas avaliadas ficam ocultos.
        </p>
        <div className="avaliacao__recortes">
          {(
            [
              [
                "Tempo de casa",
                r.recortes.tempoDeCasa,
                (g: string) =>
                  TEMPO_DE_CASA[g as keyof typeof TEMPO_DE_CASA] ?? g,
              ],
              ["Departamento", r.recortes.departamento, (g: string) => g],
            ] as const
          ).map(([titulo, linhas, rotulo]) => (
            <table key={titulo} className="pesquisas__tabela">
              <caption>{titulo}</caption>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.grupo}>
                    <th scope="row">{rotulo(l.grupo)}</th>
                    <td>{plural(l.avaliadas, "pessoa", "pessoas")}</td>
                    <td className="avaliacao__numero">
                      {l.visivel ? nota1(l.media) : "Oculto · menos de 3"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>
    </>
  );
}

function Andamento({
  det,
  e180,
}: {
  readonly det: AvaliacaoDetalhe;
  readonly e180: boolean;
}) {
  return (
    <section className="pesquisas__cartao-secao" aria-label="Andamento">
      <h2 className="pesquisas__cartao-secao-titulo">Andamento</h2>
      <p className="pesquisas__suave">
        {`${plural(det.totais.respondidas, "avaliação enviada", "avaliações enviadas")} · ${plural(det.totais.pendentes, "pendente", "pendentes")}`}
        {det.convites.aguardandoEmail
          ? ` · ${plural(det.convites.aguardandoEmail, "convite aguardando e-mail", "convites aguardando e-mail")}`
          : ""}
      </p>
      <ul className="avaliacao__lista-times">
        {det.times.map((t) => (
          <li key={t.gestor.id} className="avaliacao__time">
            <div className="avaliacao__time-cabeca">
              <Avatar texto={iniciaisDe(t.gestor.nome)} />
              <span className="avaliacao__time-nome">
                <strong>{t.gestor.nome}</strong>
                <span className="pesquisas__suave">
                  {`${t.pessoas.filter((p) => p.gestorRespondeu).length} de ${plural(t.pessoas.length, "pessoa avaliada", "pessoas avaliadas")}`}
                </span>
              </span>
            </div>
            <ul className="avaliacao__time-corpo">
              {t.pessoas.map((p) => (
                <li key={p.id} className="avaliacao__pessoa">
                  <span>{p.nome}</span>
                  <StatusBadge
                    variant={p.gestorRespondeu ? "success" : "neutral"}
                  >
                    {p.gestorRespondeu ? "Gestor avaliou" : "Gestor pendente"}
                  </StatusBadge>
                  {e180 ? (
                    p.autoavaliacao ? (
                      <StatusBadge
                        variant={
                          p.autoavaliacao.respondeu ? "success" : "neutral"
                        }
                      >
                        {p.autoavaliacao.respondeu
                          ? "Autoavaliação feita"
                          : "Autoavaliação pendente"}
                      </StatusBadge>
                    ) : (
                      <span className="pesquisas__suave">
                        Sem autoavaliação (sem CPF)
                      </span>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
