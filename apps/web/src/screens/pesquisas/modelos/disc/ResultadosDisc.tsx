/**
 * T216 — Perfil comportamental (DISC): o conteúdo das abas de resultado.
 *
 * Visão geral: perfil do time, pessoas por fator predominante, mapa de
 * talentos (com o centro do time e as áreas mais cheias), diversidade
 * comportamental e como o time funciona. Análises: compatibilidade, quão
 * definido é cada perfil e lacunas para as próximas contratações.
 * Respostas: o perfil de cada pessoa (identificada com o nome, anônima
 * numerada; nunca na confidencial).
 *
 * Recorte por grupo com as regras da API (mínimo e proteção do grupo
 * menor): grupo oculto não mostra número.
 */
import { useEffect, useId, useState } from "react";
import type {
  CampoGrupo,
  PesquisaDetalhe,
} from "../../../../api/pesquisasClient";
import { StatusBadge, type StatusVariant } from "../../../../components";
import { formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { Esqueleto } from "../../../../ui/movimento";
import { CartaoDeSecao } from "../../componentes";
import { BarraEmpilhada } from "../../graficos";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";
import { textoDoOculto } from "../../textosDasPesquisas";
import { PARES, ROTULO_DO_PAR, areaPorId } from "./areas";
import { FATOR, FATORES, corDoFator, type FatorDisc } from "./fatores";
import {
  BarraDisc,
  LetraDoFator,
  MapaDeTalentos,
  ROTULO_DA_DIVERSIDADE,
  ReguaDaDiversidade,
  TEXTO_DA_DIVERSIDADE,
} from "./graficosDisc";
import {
  ROTULO_DA_INTENSIDADE,
  TEXTO_DA_INTENSIDADE,
  chipsDoTime,
  codigoDoPerfil,
  fatorMaisAusente,
  nomesDosFatores,
  resumoDoTime,
  tituloDoPerfil,
} from "./perfis";
import {
  INTENSIDADES,
  perfilComportamental,
  type CarregarPerfil,
  type FaixaDeDiversidade,
  type PessoaDisc,
  type ResultadoDisc,
} from "./tiposDisc";
import "./Disc.css";

export type AbaDisc = "geral" | "analises" | "respostas";

export const TOM_DA_DIVERSIDADE: Readonly<
  Record<FaixaDeDiversidade, StatusVariant>
> = {
  pouco_diverso: "danger",
  moderado: "warning",
  equilibrado: "info",
  altamente_diverso: "success",
};

const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 100) : 0;

/** "Resposta anônima #3" ou o nome. */
export const nomeDaPessoa = (p: Pick<PessoaDisc, "nome" | "numero">) =>
  p.nome ?? `Resposta anônima #${p.numero}`;

export function ResultadosDisc({
  detalhe,
  aba,
  carregar = perfilComportamental,
  onAbrirResposta,
  onIrParaAnalises,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly aba: AbaDisc;
  readonly carregar?: CarregarPerfil;
  readonly onAbrirResposta?: (respostaId: string) => void;
  readonly onIrParaAnalises?: (() => void) | undefined;
}) {
  const [recorte, setRecorte] = useState<{
    campo: CampoGrupo;
    grupoId: string;
  } | null>(null);
  const [dados, setDados] = useState<ResultadoDisc | null>(null);
  const [falhou, setFalhou] = useState(false);
  const idFiltro = useId();

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    Promise.resolve(carregar(detalhe.id, recorte))
      .then((r) => {
        if (vivo) setDados(r);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [carregar, detalhe.id, recorte]);

  if (falhou)
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar o perfil comportamental.
      </p>
    );
  if (!dados)
    return <Esqueleto rotulo="Carregando o perfil do time…" linhas={4} />;

  if (aba === "respostas")
    return (
      <RespostasDisc
        detalhe={detalhe}
        pessoas={dados.pessoas}
        onAbrir={onAbrirResposta}
      />
    );

  const opcoesDoFiltro = dados.recortes.flatMap((campo) =>
    (dados.grupos[campo] ?? []).map((g) => ({
      valor: `${campo}:${g.id}`,
      rotulo: `${CAMPOS_DE_GRUPO.find((c) => c.campo === campo)?.rotulo ?? campo} · ${g.nome}`,
      oculto: g.oculto ?? null,
    })),
  );
  const filtro =
    opcoesDoFiltro.length > 0 ? (
      <div className="disc__filtros">
        <label htmlFor={idFiltro}>
          Recorte
          <select
            id={idFiltro}
            className="pesquisas__campo"
            value={recorte ? `${recorte.campo}:${recorte.grupoId}` : ""}
            onChange={(e) => {
              const [campo, grupoId] = e.target.value.split(":");
              setRecorte(
                campo && grupoId
                  ? { campo: campo as CampoGrupo, grupoId }
                  : null,
              );
            }}
          >
            <option value="">Toda a empresa</option>
            {opcoesDoFiltro.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.oculto ? `${o.rotulo} (oculto)` : o.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
    ) : null;

  if (!dados.filtro.visivel || !dados.perfil) {
    const motivo = recorte
      ? opcoesDoFiltro.find(
          (o) => o.valor === `${recorte.campo}:${recorte.grupoId}`,
        )?.oculto
      : null;
    return (
      <div className="disc">
        {filtro}
        <section className="pesquisas__sem-respostas" aria-label="Sem dados">
          <h2 className="pesquisas__cartao-secao-titulo">
            {dados.filtro.visivel
              ? "Ainda sem perfis"
              : "Poucas respostas para mostrar"}
          </h2>
          <p className="pesquisas__suave">
            {dados.filtro.visivel
              ? "O perfil do time aparece assim que alguém responder."
              : motivo
                ? textoDoOculto(motivo, detalhe.minimoPorGrupo)
                : `Os resultados aparecem a partir de ${detalhe.minimoPorGrupo} respostas, para proteger quem respondeu.`}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="disc">
      {filtro}
      {aba === "geral" ? (
        <VisaoGeralDisc dados={dados} onIrParaAnalises={onIrParaAnalises} />
      ) : (
        <AnalisesDisc dados={dados} />
      )}
    </div>
  );
}

function VisaoGeralDisc({
  dados,
  onIrParaAnalises,
}: {
  readonly dados: ResultadoDisc;
  readonly onIrParaAnalises?: (() => void) | undefined;
}) {
  const time = dados.perfil!;
  const pessoas = dados.totalDePessoas;
  const ausente = fatorMaisAusente(
    dados.diversidade.ausentes,
    time.percentuais,
  );
  const centro = areaPorId(time.posicao.area);
  const contagem = new Map(dados.areas.map((a) => [a.area, a.pessoas]));
  return (
    <>
      <CartaoDeSecao titulo="Perfil do time">
        <div className="disc__time">
          <div className="disc__time-cabeca">
            <span className="disc__letras">
              {time.classe.fatores.map((f) => (
                <LetraDoFator key={f} fator={f} tamanho="md" />
              ))}
            </span>
            <h3 className="disc__time-titulo">
              {tituloDoPerfil(time.classe)}{" "}
              <span className="disc__codigo">
                {codigoDoPerfil(time.classe)}
              </span>
            </h3>
          </div>
          <p>{resumoDoTime(time.classe)}</p>
          <BarraDisc
            percentuais={time.percentuais}
            rotulo="Composição do time"
          />
          <p className="pesquisas__suave">
            {`Composição média das respostas de ${plural(pessoas, "pessoa", "pessoas")}: a soma das escolhas de todo mundo.`}
          </p>
          {onIrParaAnalises ? (
            <button
              type="button"
              className="disc__link"
              onClick={onIrParaAnalises}
            >
              Ver análises do time ›
            </button>
          ) : null}
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Colaboradores por perfil"
        descricao="Quantas pessoas têm cada fator como predominante."
      >
        <ul
          className="disc__grade disc__grade--4"
          aria-label="Pessoas por fator predominante"
        >
          {FATORES.map((f) => (
            <li
              key={f}
              className="disc__cartao"
              style={{ ["--cor-do-fator" as string]: corDoFator(f) }}
            >
              <span className="disc__cartao-topo">
                <LetraDoFator fator={f} tamanho="sm" />
                <span>{FATOR[f].nome}</span>
              </span>
              <p className="disc__cartao-numero">{dados.porPredominante[f]}</p>
              <p className="pesquisas__suave">
                {`${dados.porPredominante[f] === 1 ? "pessoa" : "pessoas"} · ${pct(dados.porPredominante[f], pessoas)}%`}
              </p>
              <span className="disc__trilha-mini" aria-hidden="true">
                <span
                  style={{
                    width: `${pct(dados.porPredominante[f], pessoas)}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Mapa de talentos do time"
        descricao="Cada ponto é uma pessoa, na cor do fator predominante. O anel marca o centro do time."
      >
        <div className="disc__mapa-colunas">
          <MapaDeTalentos
            pontos={dados.pontos}
            centro={time.posicao}
            contagem={contagem}
          />
          <div className="disc">
            {centro ? (
              <div className="disc__destaque">
                <div>
                  <p className="pesquisas__suave">Centro do time</p>
                  <p className="disc__destaque-titulo">{centro.nome}</p>
                  <p>{centro.frase}</p>
                </div>
              </div>
            ) : null}
            <div>
              <h3 className="disc__subtitulo">Áreas com mais pessoas</h3>
              <ul className="disc__lista">
                {dados.areas.slice(0, 3).map((a) => (
                  <li key={a.area}>
                    {`${areaPorId(a.area)?.nome ?? "Área"}: ${plural(a.pessoas, "pessoa", "pessoas")}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Diversidade comportamental"
        descricao="Quanto os fatores predominantes variam entre as pessoas, de 0 a 100."
      >
        <p className="disc__diversidade-numero">
          {dados.diversidade.score}
          <span>de 100</span>
          <StatusBadge variant={TOM_DA_DIVERSIDADE[dados.diversidade.faixa]}>
            {ROTULO_DA_DIVERSIDADE[dados.diversidade.faixa]}
          </StatusBadge>
        </p>
        <ReguaDaDiversidade score={dados.diversidade.score} />
        <p>{TEXTO_DA_DIVERSIDADE[dados.diversidade.faixa]}</p>
        {ausente ? (
          <div className="disc__destaque">
            <div>
              <p className="disc__destaque-titulo">Fator ausente no time</p>
              <p>{`${FATOR[ausente].nome}: ${FATOR[ausente].risco}`}</p>
            </div>
          </div>
        ) : null}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Como o time funciona"
        descricao={`Leitura a partir ${time.classe.fatores.length > 1 ? "dos fatores principais" : "do fator principal"} do time (${nomesDosFatores(time.classe.fatores)}).`}
      >
        <dl className="disc__linhas">
          {(
            [
              ["Pontos fortes", "fortes"],
              ["Pontos de atenção", "atencao"],
              ["Como se comunicar", "feedback"],
              ["O que gera estresse", "estresse"],
            ] as const
          ).map(([rotulo, campo]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>
                <ul className="disc__chips">
                  {chipsDoTime(time.classe, campo).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </CartaoDeSecao>
    </>
  );
}

function AnalisesDisc({ dados }: { readonly dados: ResultadoDisc }) {
  const comp = dados.compatibilidade;
  const pessoas = dados.totalDePessoas;
  const celula = (a: FatorDisc, b: FatorDisc) =>
    comp.matriz.find(
      (m) => (m.a === a && m.b === b) || (m.a === b && m.b === a),
    )!;
  const maior = comp.maiorAtencao;
  return (
    <>
      <CartaoDeSecao
        titulo="Compatibilidade no time"
        descricao="Pares de pessoas pelo fator predominante de cada uma."
      >
        {comp.totalDePares === 0 ? (
          <p className="pesquisas__suave">
            A compatibilidade aparece a partir de 2 pessoas.
          </p>
        ) : (
          <>
            <BarraEmpilhada
              rotulo="Pares de pessoas por tipo"
              partes={[
                {
                  rotulo: ROTULO_DO_PAR.mesma_linguagem,
                  valor: comp.porTipo.mesma_linguagem.pares,
                  cor: "var(--turno-verde)",
                },
                {
                  rotulo: ROTULO_DO_PAR.complementar,
                  valor: comp.porTipo.complementar.pares,
                  cor: "var(--turno-azul)",
                },
                {
                  rotulo: ROTULO_DO_PAR.pede_atencao,
                  valor: comp.porTipo.pede_atencao.pares,
                  cor: "var(--status-danger-ink)",
                },
              ]}
            />
            <div className="disc__rolagem">
              <table className="disc__tabela" aria-label="Matriz de pares">
                <caption className="disc__sr">
                  Quantidade de pares de pessoas entre cada fator
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="disc__sr">Fator</span>
                    </th>
                    {FATORES.map((f) => (
                      <th key={f} scope="col">
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FATORES.map((a) => (
                    <tr key={a}>
                      <th scope="row">{FATOR[a].nome}</th>
                      {FATORES.map((b) => {
                        const m = celula(a, b);
                        return (
                          <td key={b}>
                            <span
                              className="disc__par"
                              data-tipo={m.tipo}
                              title={ROTULO_DO_PAR[m.tipo]}
                            >
                              {m.pares}
                            </span>
                            <span className="disc__sr">{` ${ROTULO_DO_PAR[m.tipo]}`}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {maior ? (
              <div className="disc__destaque">
                <div>
                  <p className="disc__destaque-titulo">{`Maior ponto de atenção: ${FATOR[maior.a].nome} × ${FATOR[maior.b].nome}`}</p>
                  <p>{`${PARES[`${maior.a}${maior.b}`]?.resumo ?? ""} · ${plural(maior.pares, "par", "pares")} de pessoas.`}</p>
                  <p>{PARES[`${maior.a}${maior.b}`]?.dica}</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Quão definido é cada perfil"
        descricao="A intensidade do perfil de cada pessoa."
      >
        <ul className="disc__grade disc__grade--4" aria-label="Intensidade">
          {INTENSIDADES.map((i) => (
            <li key={i} className="disc__cartao">
              <span className="disc__cartao-topo">
                {ROTULO_DA_INTENSIDADE[i]}
              </span>
              <p className="disc__cartao-numero">{dados.intensidades[i]}</p>
              <p className="pesquisas__suave">{`${pct(dados.intensidades[i], pessoas)}% das pessoas`}</p>
              <p>{TEXTO_DA_INTENSIDADE[i]}</p>
            </li>
          ))}
        </ul>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Lacunas e próximas contratações"
        descricao="Fatores predominantes em menos de 20% das pessoas."
      >
        {dados.lacunas.length === 0 ? (
          <p className="pesquisas__suave">
            Nenhum fator abaixo de 20% das pessoas: o time está bem distribuído.
          </p>
        ) : (
          <ul className="disc__grade" aria-label="Lacunas">
            {dados.lacunas.map((f) => (
              <li
                key={f}
                className="disc__cartao"
                style={{ ["--cor-do-fator" as string]: corDoFator(f) }}
              >
                <span className="disc__cartao-topo">
                  <LetraDoFator fator={f} tamanho="sm" />
                  <strong>{`Reforçar ${FATOR[f].nome}`}</strong>
                </span>
                <p>{FATOR[f].reforco}</p>
              </li>
            ))}
          </ul>
        )}
      </CartaoDeSecao>
    </>
  );
}

function RespostasDisc({
  detalhe,
  pessoas,
  onAbrir,
}: {
  readonly detalhe: PesquisaDetalhe;
  readonly pessoas: readonly PessoaDisc[];
  readonly onAbrir?: ((respostaId: string) => void) | undefined;
}) {
  if (detalhe.identificacao === "confidencial")
    return (
      <p className="pesquisas__nota">
        Pesquisa confidencial: o perfil aparece só agrupado, na Visão geral e
        nas Análises.
      </p>
    );
  const lista = [...pessoas].reverse();
  return (
    <div className="disc">
      {detalhe.identificacao === "anonima" ? (
        <p className="pesquisas__nota">
          Pesquisa anônima: nenhuma resposta fica ligada a uma pessoa.
        </p>
      ) : null}
      {lista.length === 0 ? (
        <p className="pesquisas__suave">Ainda sem respostas.</p>
      ) : (
        <div className="disc__rolagem">
          <table className="disc__tabela">
            <caption className="disc__sr">Perfil de cada resposta</caption>
            <thead>
              <tr>
                <th scope="col">Resposta</th>
                <th scope="col">Perfil</th>
                {FATORES.map((f) => (
                  <th key={f} scope="col" className="disc__tabela-numero">
                    {f}
                  </th>
                ))}
                <th scope="col">Respondeu em</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.respostaId}>
                  <td>
                    {onAbrir ? (
                      <button
                        type="button"
                        className="disc__link"
                        onClick={() => onAbrir(p.respostaId)}
                      >
                        {nomeDaPessoa(p)}
                      </button>
                    ) : (
                      nomeDaPessoa(p)
                    )}
                  </td>
                  <td>
                    <span className="disc__cartao-topo">
                      <LetraDoFator
                        fator={p.perfil.predominante}
                        tamanho="sm"
                      />
                      {tituloDoPerfil(p.perfil.classe)}
                    </span>
                  </td>
                  {FATORES.map((f) => (
                    <td key={f} className="disc__tabela-numero">
                      {`${p.perfil.percentuais[f]}%`}
                    </td>
                  ))}
                  <td>{formatarInstante(p.respondidaEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pesquisas__suave">
        {plural(lista.length, "resposta", "respostas")}
      </p>
    </div>
  );
}
