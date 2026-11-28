/**
 * T216 — o resultado de uma pessoa na Avaliação 90°/180°: nota geral e por
 * competência (com o time ao lado), as 24 afirmações, os comentários, o que
 * desenvolver e, na 180°, gestor × autoavaliação com o mapa da conversa e o
 * roteiro de feedback. Leitura nominal (auditada no servidor).
 */
import { useEffect, useState } from "react";
import { StatusBadge } from "../../../../components";
import { IconButton } from "../../../../ui";
import { IconeVoltar } from "../../../../ui/icones";
import { Esqueleto } from "../../../../ui/movimento";
import { Avatar, iniciaisDe } from "../../componentes";
import {
  ALINHAMENTO,
  CATALOGO,
  LEITURAS,
  NIVEIS,
  PASSOS_DO_ROTEIRO,
  QUADRANTES,
  competencia,
  diferenca1,
  nota1,
} from "./catalogo";
import type { ClienteDaAvaliacao, ResultadoDaPessoa as Dados } from "./cliente";
import { BarraDaNota, Halteres, RodaDeCompetencias } from "./graficosDaAvaliacao";

export function ResultadoDaPessoa({
  pesquisaId,
  colaboradorId,
  carregar,
  onVoltar,
}: {
  readonly pesquisaId: string;
  readonly colaboradorId: string;
  readonly carregar: ClienteDaAvaliacao["pessoa"];
  readonly onVoltar: () => void;
}) {
  const [d, setD] = useState<Dados | null>(null);
  const [falha, setFalha] = useState(false);
  useEffect(() => {
    let vivo = true;
    carregar(pesquisaId, colaboradorId)
      .then((x) => vivo && setD(x))
      .catch(() => vivo && setFalha(true));
    return () => {
      vivo = false;
    };
  }, [carregar, pesquisaId, colaboradorId]);

  if (falha) {
    return (
      <p className="pesquisas__erro" role="alert">
        Não foi possível carregar o resultado da pessoa.
      </p>
    );
  }
  if (!d) return <Esqueleto rotulo="Carregando o resultado…" linhas={4} />;
  const g = d.gestorAvaliacao;
  const a = d.autoavaliacao;
  const nivel = g?.nota.nivel ? NIVEIS[g.nota.nivel] : null;

  return (
    <div className="avaliacao__pessoa-pagina">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar para a avaliação"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <Avatar texto={iniciaisDe(d.nome)} />
        <div className="pesquisas__titulos">
          <h2 className="pesquisas__titulo">{d.nome}</h2>
          <p className="pesquisas__subtitulo">
            {[d.cargo, d.departamento, `Gestor: ${d.gestor.nome}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {!g ? (
        <p className="pesquisas__nota" role="status">
          O gestor ainda não enviou a avaliação desta pessoa.
        </p>
      ) : (
        <>
          <div className="avaliacao__indicadores">
            <section className="pesquisas__cartao-secao" aria-label="Nota geral">
              <p className="pesquisas__rotulo">Nota geral (gestor)</p>
              <p className="avaliacao__nota-grande">
                {nota1(g.nota.geral)} <span className="pesquisas__suave">/5</span>
              </p>
              {nivel ? <StatusBadge variant={nivel.tom}>{nivel.rotulo}</StatusBadge> : null}
              <p className="pesquisas__suave">{`Time: ${nota1(d.time.media)}`}</p>
              <dl className="avaliacao__eixos">
                <div>
                  <dt>Entrega</dt>
                  <dd>{nota1(g.nota.entrega)}</dd>
                </div>
                <div>
                  <dt>Pessoas</dt>
                  <dd>{nota1(g.nota.pessoas)}</dd>
                </div>
                <div>
                  <dt>Mapa de talentos</dt>
                  <dd>{g.nota.quadrante ? QUADRANTES[g.nota.quadrante].rotulo : "—"}</dd>
                </div>
              </dl>
            </section>
            <section className="pesquisas__cartao-secao" aria-label="Roda de competências">
              <RodaDeCompetencias
                rotulo={`Competências de ${d.nome}, de 1 a 5`}
                series={[
                  { nome: "Gestor", classe: "avaliacao__radar-serie--gestor", valores: g.nota.competencias },
                  ...(a
                    ? [{ nome: "Autoavaliação", classe: "avaliacao__radar-serie--auto", valores: a.nota.competencias }]
                    : []),
                ]}
              />
            </section>
          </div>

          {g.alertas.length ? (
            <p className="avaliacao__aviso avaliacao__aviso--atencao" role="note">
              {g.alertas
                .map((x) =>
                  x.tipo === "linha_reta"
                    ? "As 24 notas foram iguais: confira com o gestor se a avaliação foi feita com atenção."
                    : `Notas extremas sem comentário em ${x.competencias.map((c) => competencia(c).rotulo).join(", ")}.`,
                )
                .join(" ")}
            </p>
          ) : null}

          {d.comparativo ? (
            <section className="pesquisas__cartao-secao" aria-label="Gestor × autoavaliação">
              <h3 className="pesquisas__cartao-secao-titulo">Gestor × autoavaliação</h3>
              <p className="pesquisas__suave">
                {`Nota geral: gestor ${nota1(d.comparativo.gestor)} · autoavaliação ${nota1(d.comparativo.autoavaliacao)} · ${diferenca1(d.comparativo.diferenca)}${d.comparativo.alinhamento ? ` (${ALINHAMENTO[d.comparativo.alinhamento]})` : ""}`}
              </p>
              <Halteres linhas={d.comparativo.competencias} />
              <h4 className="pesquisas__rotulo">Mapa da conversa</h4>
              <ul className="avaliacao__leituras">
                {d.comparativo.competencias
                  .filter((c) => c.leitura && c.leitura !== "alinhada")
                  .map((c) => (
                    <li key={c.competencia}>
                      <strong>{competencia(c.competencia).rotulo}</strong>
                      {` · ${LEITURAS[c.leitura!].rotulo}: ${LEITURAS[c.leitura!].texto}`}
                    </li>
                  ))}
              </ul>
              {d.roteiro ? (
                <>
                  <h4 className="pesquisas__rotulo">Roteiro de feedback</h4>
                  <ol className="avaliacao__roteiro">
                    {d.roteiro.map((p) => (
                      <li key={p.passo}>
                        <strong>{PASSOS_DO_ROTEIRO[p.passo]}</strong>
                        {p.competencias.length
                          ? `: ${p.competencias.map((c) => competencia(c).rotulo).join(", ")}`
                          : ""}
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
            </section>
          ) : d.temAutoavaliacao && !a ? (
            <p className="pesquisas__nota">A autoavaliação ainda não foi enviada.</p>
          ) : null}

          {d.desenvolver.length ? (
            <section className="pesquisas__cartao-secao" aria-label="O que desenvolver">
              <h3 className="pesquisas__cartao-secao-titulo">O que desenvolver</h3>
              <p className="pesquisas__suave">Competências abaixo de 3, da menor para a maior.</p>
              <ul>
                {d.desenvolver.map((c) => (
                  <li key={c}>{`${competencia(c).rotulo} · ${nota1(g.nota.competencias[c])}`}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="pesquisas__cartao-secao" aria-label="Por competência">
            <h3 className="pesquisas__cartao-secao-titulo">Por competência e afirmação</h3>
            {CATALOGO.map((c) => (
              <div key={c.id} className="avaliacao__bloco-competencia">
                <p className="avaliacao__bloco-titulo">
                  <span className="avaliacao__bolinha" style={{ ["--cor" as string]: `var(${c.cor})` }} aria-hidden="true" />
                  <strong>{c.rotulo}</strong>
                  <span className="avaliacao__numero">{nota1(g.nota.competencias[c.id])}</span>
                  <span className="pesquisas__suave">{`time ${nota1(d.time.competencias[c.id])}`}</span>
                </p>
                <ul>
                  {c.itens.map((i) => (
                    <li key={i.id} className="avaliacao__linha-item">
                      <span>{i.gestor}</span>
                      <BarraDaNota nota={g.notas[i.id] ?? null} cor={c.cor} rotulo={`${i.rotulo}: ${g.notas[i.id] ?? "—"}`} />
                      <span className="avaliacao__numero">{g.notas[i.id] ?? "—"}</span>
                      {a ? <span className="avaliacao__numero pesquisas__suave">{`auto ${a.notas[i.id] ?? "—"}`}</span> : null}
                    </li>
                  ))}
                </ul>
                {g.comentarios[c.id] ? (
                  <blockquote className="avaliacao__comentario">
                    <span className="pesquisas__suave">Gestor:</span> {g.comentarios[c.id]}
                  </blockquote>
                ) : null}
                {a?.comentarios[c.id] ? (
                  <blockquote className="avaliacao__comentario">
                    <span className="pesquisas__suave">Autoavaliação:</span> {a.comentarios[c.id]}
                  </blockquote>
                ) : null}
              </div>
            ))}
          </section>
          <p className="pesquisas__nota">
            Diferença entre as visões é ponto de partida para conversa, não veredito.
          </p>
        </>
      )}
    </div>
  );
}
