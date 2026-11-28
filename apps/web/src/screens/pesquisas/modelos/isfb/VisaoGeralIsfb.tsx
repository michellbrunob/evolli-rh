/**
 * T216 — Saúde financeira: Visão geral, Análises e o resultado de uma
 * pessoa. A nota (0 a 100) vem da metodologia do índice; os perfis do time,
 * os sinais e os temas são leituras do Evolli sobre as mesmas respostas.
 */
import { useState } from "react";
import type {
  FaixaIsfb,
  PessoaIsfb,
  ResultadoDoPainel,
  ResultadoIsfb,
} from "../../../../api/modelosDePesquisaClient";
import type { CampoGrupo } from "../../../../api/pesquisasClient";
import { plural } from "../../../../format/plural";
import { CartaoDeSecao, Pilulas } from "../../componentes";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";
import { textoDoOculto } from "../../textosDasPesquisas";
import { BarraDeFaixas, BarraPercentual, MiniCartao } from "../ui";
import { ETAPAS_ISFB, PRODUTOS, etapaIsfb, itemIsfb } from "./definicao";
import {
  ABERTURA,
  ABERTURAS,
  FAIXAS_ISFB,
  FAIXA_ISFB,
  GRUPOS_DE_PRODUTOS,
  PERFIL,
  RENDA,
  SAUDE,
  SINAIS,
  SINAL,
  TEMA,
  COR_DA_RESPOSTA,
  diferenca,
  umaCasaBr,
} from "./textos";

const pct = (n: number) => `${Math.round(n)}%`;

/** Régua das 7 faixas com o marcador da nota e o da média do Brasil. */
export function ReguaIsfb({
  nota,
  brasil,
  rotulo,
}: {
  readonly nota: number | null;
  readonly brasil: number;
  readonly rotulo: string;
}) {
  return (
    <div>
      <div
        className="modelos__regua7"
        role="img"
        aria-label={`${rotulo}: ${nota ?? "sem nota"} de 100; média do Brasil ${umaCasaBr(brasil)}`}
      >
        {FAIXAS_ISFB.map((f) => (
          <span
            key={f}
            style={{
              width: `${FAIXA_ISFB[f].ate - FAIXA_ISFB[f].de + (f === "ruim" ? 0 : 1)}%`,
              background: FAIXA_ISFB[f].cor,
            }}
          />
        ))}
        <span
          className="modelos__marcador modelos__marcador--brasil"
          style={{ left: `${brasil}%` }}
        />
        {nota !== null ? (
          <span className="modelos__marcador" style={{ left: `${nota}%` }} />
        ) : null}
      </div>
      <p className="modelos__legenda">
        {FAIXAS_ISFB.map((f) => (
          <span key={f}>
            <span
              className="modelos__ponto"
              style={{ ["--cor" as string]: FAIXA_ISFB[f].cor }}
              aria-hidden="true"
            />
            {`${FAIXA_ISFB[f].rotulo} ${FAIXA_ISFB[f].de}–${FAIXA_ISFB[f].ate}`}
          </span>
        ))}
      </p>
    </div>
  );
}

export function SeloDaFaixa({ faixa }: { readonly faixa: FaixaIsfb | null }) {
  if (!faixa) return <span className="pesquisas__suave">—</span>;
  const f = FAIXA_ISFB[faixa];
  return (
    <span className="pesquisas__selo" style={{ color: f.cor }}>
      <span
        className="modelos__ponto"
        style={{ ["--cor" as string]: f.cor }}
        aria-hidden="true"
      />
      {`${f.rotulo} · ${f.de} a ${f.ate}`}
    </span>
  );
}

/** Leitura automática (por regras): urgente, atenção e ponto forte. */
export function leituraAutomatica(r: ResultadoIsfb): {
  urgente: string;
  atencao: string;
  pontoForte: string;
} {
  const sinais = SINAIS.map((s) => ({ s, ...r.sinais[s] })).sort(
    (a, b) => b.quantidade - a.quantidade,
  );
  const dims = r.dimensoes
    .filter((d) => d.id !== "autopercepcao" && d.nota !== null)
    .sort((a, b) => a.nota! - b.nota!);
  const pior = dims[0];
  const melhor = dims[dims.length - 1];
  const topo = sinais[0]!;
  return {
    urgente:
      topo.quantidade > 0
        ? `${pct(topo.percentual)} ${SINAL[topo.s].rotulo}.`
        : "Nenhum sinal de alerta apareceu nas respostas.",
    atencao: pior
      ? `${etapaIsfb(pior.id).curto} é a dimensão mais baixa (${pior.nota} de 100).`
      : "Sem dimensões calculadas.",
    pontoForte: melhor
      ? `${etapaIsfb(melhor.id).curto} é a dimensão mais alta (${melhor.nota} de 100).`
      : "Sem dimensões calculadas.",
  };
}

function Histograma({ r }: { readonly r: ResultadoIsfb }) {
  const maior = Math.max(1, ...r.distribuicao);
  const faixaDe = (inicio: number): FaixaIsfb =>
    FAIXAS_ISFB.find((f) => inicio + 4 <= FAIXA_ISFB[f].ate) ?? "otima";
  return (
    <div>
      <div
        className="modelos__histograma"
        role="img"
        aria-label={`Distribuição das notas: ${
          r.distribuicao
            .map((q, i) => `${i * 5} a ${i === 19 ? 100 : i * 5 + 4}: ${q}`)
            .filter((_, i) => r.distribuicao[i]! > 0)
            .join("; ") || "sem respostas"
        }`}
      >
        {r.distribuicao.map((q, i) => (
          <span
            key={i}
            className="modelos__histograma-barra"
            style={{
              height: `${(q * 100) / maior}%`,
              background: q ? FAIXA_ISFB[faixaDe(i * 5)].cor : "transparent",
            }}
          >
            {q ? <span>{q}</span> : null}
          </span>
        ))}
        <span
          className="modelos__marcador modelos__marcador--brasil"
          style={{ left: `${r.mediaDoBrasil}%`, top: 0, height: "100%" }}
        />
      </div>
      <div className="modelos__histograma-eixo">
        <span>0</span>
        <span>{`Brasil ${umaCasaBr(r.mediaDoBrasil)}${r.isfb !== null ? ` · Time ${r.isfb}` : ""}`}</span>
        <span>100</span>
      </div>
    </div>
  );
}

function Anel({
  fracao,
  rotulo,
}: {
  readonly fracao: number;
  readonly rotulo: string;
}) {
  const raio = 20;
  const c = 2 * Math.PI * raio;
  return (
    <svg
      viewBox="0 0 52 52"
      width={52}
      height={52}
      role="img"
      aria-label={rotulo}
    >
      <circle
        cx={26}
        cy={26}
        r={raio}
        fill="none"
        stroke="var(--surface-neutral)"
        strokeWidth={6}
      />
      <circle
        cx={26}
        cy={26}
        r={raio}
        fill="none"
        stroke="var(--status-danger-ink)"
        strokeWidth={6}
        strokeDasharray={`${c * fracao} ${c}`}
        transform="rotate(-90 26 26)"
      />
      <text
        x={26}
        y={30}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--color-ink)"
      >
        {pct(fracao * 100)}
      </text>
    </svg>
  );
}

export function VisaoGeralIsfb({
  resultado,
}: {
  readonly resultado: ResultadoDoPainel;
}) {
  const r = resultado.isfb!;
  const [filtro, setFiltro] = useState<string>("todas");
  const leitura = leituraAutomatica(r);
  const perguntas = r.perguntas.filter((p) => {
    const it = itemIsfb(p.id);
    if (it.etapa === "autopercepcao") return filtro === "autopercepcao";
    return filtro === "todas" || it.etapa === filtro;
  });
  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Saúde financeira do time"
        descricao={`${plural(r.pessoas, "pessoa", "pessoas")} com nota`}
      >
        <div className="modelos__destaque">
          <span
            className="modelos__numero"
            style={{ color: r.faixa ? FAIXA_ISFB[r.faixa].cor : undefined }}
          >
            {r.isfb ?? "—"}
          </span>
          <span className="pesquisas__suave">de 100</span>
          <SeloDaFaixa faixa={r.faixa} />
          {r.diferencaDoBrasil !== null ? (
            <span className="pesquisas__suave">{`Brasil ${umaCasaBr(r.mediaDoBrasil)} · ${diferenca(r.diferencaDoBrasil)}`}</span>
          ) : null}
        </div>
        {r.faixa ? (
          <p className="pesquisas__suave">{FAIXA_ISFB[r.faixa].frase}</p>
        ) : null}
        <ReguaIsfb
          nota={r.isfb}
          brasil={r.mediaDoBrasil}
          rotulo="Nota do time"
        />
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Distribuição das notas"
        descricao="Quantas pessoas em cada faixa de 5 pontos."
      >
        <Histograma r={r} />
        <BarraDeFaixas
          rotulo="Saúde financeira do time"
          partes={(["baixa", "no_limite", "saudavel"] as const).map((s) => ({
            rotulo: SAUDE[s].rotulo,
            valor: r.saude[s].quantidade,
            cor: SAUDE[s].cor,
          }))}
        />
        <p className="modelos__legenda">
          {(["baixa", "no_limite", "saudavel"] as const).map((s) => (
            <span key={s}>
              <span
                className="modelos__ponto"
                style={{ ["--cor" as string]: SAUDE[s].cor }}
                aria-hidden="true"
              />
              {`${pct(r.saude[s].percentual)} ${SAUDE[s].rotulo.toLowerCase()} (${SAUDE[s].faixa})`}
            </span>
          ))}
        </p>
      </CartaoDeSecao>

      <div className="modelos__grade">
        {SINAIS.map((s) => (
          <div key={s} className="modelos__cartao">
            <div className="modelos__cartao-topo">
              <Anel
                fracao={r.sinais[s].percentual / 100}
                rotulo={`${pct(r.sinais[s].percentual)} ${SINAL[s].rotulo}`}
              />
              <span className="pesquisas__suave">{`${r.sinais[s].quantidade} de ${plural(r.pessoas, "pessoa", "pessoas")}`}</span>
            </div>
            <strong>{`${pct(r.sinais[s].percentual)} ${SINAL[s].rotulo}`}</strong>
            <span className="pesquisas__suave">{SINAL[s].texto}</span>
          </div>
        ))}
      </div>

      <CartaoDeSecao
        titulo="Leitura automática"
        descricao="Gerada por regras a partir dos números (sem nomes)."
      >
        <div className="modelos__grade">
          <MiniCartao titulo="Urgente" valor="" texto={leitura.urgente} />
          <MiniCartao titulo="Atenção" valor="" texto={leitura.atencao} />
          <MiniCartao
            titulo="Ponto forte"
            valor=""
            texto={leitura.pontoForte}
          />
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Dimensões"
        descricao="Segurança, habilidade, comportamento e liberdade formam a nota; a autopercepção é opcional."
      >
        <div className="modelos__grade">
          {r.dimensoes.map((d) => {
            const e = etapaIsfb(d.id);
            return (
              <div key={d.id} className="modelos__cartao">
                <div className="modelos__cartao-topo">
                  <h3>{e.curto}</h3>
                  {d.id === "autopercepcao" ? (
                    <span className="pesquisas__selo">{`Opcional · ${plural(d.pessoas, "resposta", "respostas")}`}</span>
                  ) : null}
                </div>
                <span className="modelos__mini-valor">{d.nota ?? "—"}</span>
                <BarraPercentual
                  valor={d.nota ?? 0}
                  cor={e.cor}
                  rotulo={`${e.curto}: ${d.nota ?? 0} de 100`}
                />
                <SeloDaFaixa faixa={d.faixa} />
                <span className="pesquisas__suave">{e.texto}</span>
              </div>
            );
          })}
        </div>
      </CartaoDeSecao>

      <BaseFinanceira r={r} />

      <CartaoDeSecao
        titulo="Perfis do time"
        descricao="Segurança × capacidade (média de habilidade e comportamento), corte em 50."
      >
        <div
          className="modelos__quadrantes"
          role="table"
          aria-label="Perfis do time"
        >
          {(
            [
              "confortaveis_sem_metodo",
              "estaveis",
              "em_risco",
              "apertados_organizados",
            ] as const
          ).map((p) => (
            <div
              key={p}
              role="cell"
              className="modelos__quadrante"
              style={{ ["--cor-celula" as string]: PERFIL[p].cor }}
            >
              <strong>{PERFIL[p].rotulo}</strong>
              <span className="modelos__mini-valor">
                {r.perfis[p].quantidade}
              </span>
              <span className="pesquisas__suave">{`${pct(r.perfis[p].percentual)} · ${PERFIL[p].texto}`}</span>
              <span className="modelos__rotulo">{PERFIL[p].acao}</span>
            </div>
          ))}
        </div>
        <p className="pesquisas__suave">
          {r.pontoDoTime
            ? `Time: segurança ${r.pontoDoTime.seguranca} · capacidade ${r.pontoDoTime.capacidade}. Esquerda: capacidade abaixo de 50; embaixo: segurança abaixo de 50.`
            : "Sem respostas."}
        </p>
        <p className="pesquisas__nota">
          Os perfis são uma leitura do Evolli sobre as dimensões; não fazem
          parte da metodologia do índice.
        </p>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Respostas por pergunta"
        descricao="Frases negativas foram invertidas · favorável = as 2 opções mais positivas."
        acao={
          <Pilulas
            rotulo="Filtrar perguntas"
            valor={filtro}
            onMudar={setFiltro}
            opcoes={[
              { valor: "todas", rotulo: "Todas" },
              ...ETAPAS_ISFB.filter((e) => e.papel === "nota").map((e) => ({
                valor: e.id,
                rotulo: e.curto,
              })),
              ...(r.comAutopercepcao
                ? [{ valor: "autopercepcao", rotulo: "Autopercepção" }]
                : []),
            ]}
          />
        }
      >
        <div className="modelos__tabela-rolagem">
          <table className="modelos__tabela">
            <thead>
              <tr>
                <th>Pergunta</th>
                <th className="modelos__celula-barra">
                  Desfavorável × favorável
                </th>
                <th className="modelos__num">% Fav.</th>
              </tr>
            </thead>
            <tbody>
              {perguntas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="modelos__codigo">{p.id}</span>{" "}
                    {itemIsfb(p.id).rotulo}
                  </td>
                  <td className="modelos__celula-barra">
                    <BarraDeFaixas
                      rotulo={itemIsfb(p.id).rotulo}
                      partes={[
                        {
                          rotulo: "Desfavorável",
                          valor: p.desfavoravel,
                          cor: COR_DA_RESPOSTA.desfavoravel,
                        },
                        {
                          rotulo: "Neutro",
                          valor: Math.max(
                            0,
                            100 - p.desfavoravel - p.favoravel,
                          ),
                          cor: COR_DA_RESPOSTA.neutro,
                        },
                        {
                          rotulo: "Favorável",
                          valor: p.favoravel,
                          cor: COR_DA_RESPOSTA.favoravel,
                        },
                      ]}
                    />
                  </td>
                  <td className="modelos__num">{pct(p.favoravel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Saúde financeira por renda da casa"
        descricao="Baixa, no limite e saudável em cada faixa de renda."
      >
        <div className="modelos__tabela-rolagem">
          <table className="modelos__tabela">
            <thead>
              <tr>
                <th>Renda da casa</th>
                <th className="modelos__num">Respostas</th>
                <th className="modelos__celula-barra">
                  Baixa · No limite · Saudável
                </th>
              </tr>
            </thead>
            <tbody>
              {r.porRenda.map((g) => (
                <tr key={g.id}>
                  <td>{RENDA[g.id]}</td>
                  <td className="modelos__num">{g.respostas}</td>
                  <td className="modelos__celula-barra">
                    {g.visivel && g.saude ? (
                      <BarraDeFaixas
                        rotulo={RENDA[g.id] ?? g.id}
                        partes={(
                          ["baixa", "no_limite", "saudavel"] as const
                        ).map((s) => ({
                          rotulo: SAUDE[s].rotulo,
                          valor: g.saude![s],
                          cor: SAUDE[s].cor,
                        }))}
                      />
                    ) : g.respostas === 0 ? (
                      <span className="pesquisas__suave">—</span>
                    ) : (
                      <span className="pesquisas__suave">
                        {textoDoOculto(g.oculto, resultado.minimoPorGrupo)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CartaoDeSecao>
    </div>
  );
}

export function BaseFinanceira({ r }: { readonly r: ResultadoIsfb }) {
  const nome = new Map(PRODUTOS.map((p) => [p.id, p.texto]));
  return (
    <CartaoDeSecao
      titulo="Base financeira"
      descricao="Produtos que as casas têm (% do time)."
    >
      <div className="modelos__grade">
        <MiniCartao
          titulo="Sem reserva"
          valor={pct(r.base.semReserva.percentual)}
          texto="Sem poupança e sem investimentos"
        />
        <MiniCartao
          titulo="Com previdência"
          valor={pct(r.base.comPrevidencia.percentual)}
        />
        <MiniCartao
          titulo="2 ou mais financiamentos"
          valor={pct(r.base.doisOuMaisFinanciamentos.percentual)}
        />
        <MiniCartao
          titulo="Produtos por pessoa"
          valor={
            r.base.produtosPorPessoa === null
              ? "—"
              : `${umaCasaBr(r.base.produtosPorPessoa)} de 14`
          }
        />
      </div>
      <div className="modelos__grade modelos__grade--2">
        {GRUPOS_DE_PRODUTOS.map((g) => (
          <div key={g.rotulo} className="modelos__cartao">
            <h3>{g.rotulo}</h3>
            <ul className="modelos__lista">
              {g.produtos.map((p) => (
                <li key={p}>
                  <span>
                    {p === "seguro_saude"
                      ? `${nome.get(p)} (inclui plano da empresa)`
                      : nome.get(p)}
                  </span>
                  <BarraPercentual
                    valor={r.produtos[p]?.percentual ?? 0}
                    cor="var(--color-action)"
                    rotulo={`${nome.get(p)}: % do time`}
                  />
                  <span className="modelos__num">
                    {pct(r.produtos[p]?.percentual ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </CartaoDeSecao>
  );
}

const CAMPO_ROTULO = new Map(CAMPOS_DE_GRUPO.map((c) => [c.campo, c.rotulo]));

export function AnalisesIsfb({
  resultado,
  campo,
  onCampo,
}: {
  readonly resultado: ResultadoDoPainel;
  readonly campo: CampoGrupo | null;
  readonly onCampo: (c: CampoGrupo) => void;
}) {
  const r = resultado.isfb!;
  const tresOuMais = r.sinaisAcumulados[3]! + r.sinaisAcumulados[4]!;
  const maior = Math.max(1, ...r.sinaisAcumulados);
  const cr = r.creditoReserva;
  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Sinais acumulados por pessoa"
        descricao="Gasta mais do que ganha, estresse em casa, aperto e falta de reserva."
      >
        <ul className="modelos__lista">
          {r.sinaisAcumulados.map((q, i) => (
            <li key={i}>
              <span>
                {i === 0 ? "Nenhum sinal" : plural(i, "sinal", "sinais")}
              </span>
              <BarraPercentual
                valor={(q * 100) / maior}
                cor={
                  i >= 3
                    ? SAUDE.baixa.cor
                    : i
                      ? SAUDE.no_limite.cor
                      : COR_DA_RESPOSTA.favoravel
                }
                rotulo={`${i} sinais: ${q}`}
              />
              <span className="modelos__num">{q}</span>
            </li>
          ))}
        </ul>
        <p>
          <strong>
            {plural(
              tresOuMais,
              "pessoa com 3 ou 4 sinais",
              "pessoas com 3 ou 4 sinais",
            )}
          </strong>
          {` — ${pct(r.pessoas ? (tresOuMais * 100) / r.pessoas : 0)} do time · prioridade para apoio individual.`}
        </p>
        {resultado.recortes.length ? (
          <>
            <label className="modelos__campo">
              Onde estão — agrupar por
              <select
                className="pesquisas__campo"
                value={campo ?? resultado.recortes[0]}
                onChange={(e) => onCampo(e.target.value as CampoGrupo)}
              >
                {resultado.recortes.map((c) => (
                  <option key={c} value={c}>
                    {CAMPO_ROTULO.get(c)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modelos__tabela-rolagem">
              <table className="modelos__tabela">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th className="modelos__num">Respostas</th>
                    <th className="modelos__num">Nota</th>
                    <th className="modelos__num">Com 3 ou 4 sinais</th>
                  </tr>
                </thead>
                <tbody>
                  {(resultado.grupos ?? []).map((g) => (
                    <tr key={g.id}>
                      <td>{g.nome}</td>
                      <td className="modelos__num">{g.respostas}</td>
                      {g.visivel && g.isfb ? (
                        <>
                          <td className="modelos__num">{g.isfb.isfb ?? "—"}</td>
                          <td className="modelos__num">
                            {g.isfb.comTresOuMaisSinais}
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} className="pesquisas__suave">
                          {textoDoOculto(g.oculto, resultado.minimoPorGrupo)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Temas para educação financeira"
        descricao="Pessoas que se beneficiam de cada tema (respostas baixas nas perguntas ligadas a ele)."
      >
        <ul className="modelos__lista">
          {r.temas.map((t) => (
            <li key={t.id}>
              <span>{TEMA[t.id]}</span>
              <BarraPercentual
                valor={t.percentual}
                cor="var(--color-action)"
                rotulo={`${TEMA[t.id]}: ${pct(t.percentual)}`}
              />
              <span className="modelos__num">{t.quantidade}</span>
            </li>
          ))}
        </ul>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Crédito × reserva"
        descricao="Usa crédito = cartão de crédito, financiamento ou consórcio; reserva = poupança ou investimentos."
      >
        <div
          className="modelos__quadrantes"
          role="table"
          aria-label="Crédito por reserva"
        >
          <div
            role="cell"
            className="modelos__quadrante modelos__quadrante--alerta"
            style={{ ["--cor-celula" as string]: SAUDE.baixa.cor }}
          >
            <strong>Usa crédito e sem reserva</strong>
            <span className="modelos__mini-valor">{cr.creditoSemReserva}</span>
            <span className="pesquisas__suave">Risco de dívida cara</span>
          </div>
          <div
            role="cell"
            className="modelos__quadrante"
            style={{ ["--cor-celula" as string]: COR_DA_RESPOSTA.favoravel }}
          >
            <strong>Usa crédito e tem reserva</strong>
            <span className="modelos__mini-valor">{cr.creditoComReserva}</span>
          </div>
          <div
            role="cell"
            className="modelos__quadrante"
            style={{ ["--cor-celula" as string]: SAUDE.no_limite.cor }}
          >
            <strong>Sem crédito e sem reserva</strong>
            <span className="modelos__mini-valor">
              {cr.semCreditoSemReserva}
            </span>
          </div>
          <div
            role="cell"
            className="modelos__quadrante"
            style={{ ["--cor-celula" as string]: COR_DA_RESPOSTA.favoravel }}
          >
            <strong>Sem crédito e com reserva</strong>
            <span className="modelos__mini-valor">
              {cr.semCreditoComReserva}
            </span>
          </div>
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Quem está aberto a receber apoio"
        descricao={`Autopercepção × nota · ${plural(r.comAutopercepcao, "pessoa respondeu", "pessoas responderam")} as perguntas opcionais.`}
      >
        {r.comAutopercepcao ? (
          <div className="modelos__grade">
            {ABERTURAS.map((a) => (
              <MiniCartao
                key={a}
                titulo={ABERTURA[a].rotulo}
                valor={r.aberturas[a].quantidade}
                texto={`${pct(r.aberturas[a].percentual)} · ${ABERTURA[a].acao}`}
              />
            ))}
          </div>
        ) : (
          <p className="pesquisas__suave">
            Ninguém respondeu as perguntas de autopercepção.
          </p>
        )}
      </CartaoDeSecao>

      <CartaoDeSecao titulo="Próximos passos do RH">
        <ul className="modelos__checklist">
          {[
            "Compartilhar o resultado agregado com o time",
            "Abrir inscrições para consultoria financeira individual (voluntária e confidencial)",
            "Montar uma trilha de educação financeira com os temas acima",
            "Levar as lacunas de benefícios à diretoria",
            "Medir de novo daqui a 6 meses",
          ].map((t) => (
            <li key={t}>{`• ${t}`}</li>
          ))}
        </ul>
        <p className="pesquisas__nota">
          Use os resultados só para apoiar as pessoas: nunca para desempenho,
          promoção ou desligamento.
        </p>
      </CartaoDeSecao>
    </div>
  );
}

/** O resultado de uma pessoa (resultado individual). */
export function IndividualIsfb({ p }: { readonly p: PessoaIsfb }) {
  const dims = [
    "seguranca",
    "habilidade",
    "comportamento",
    "liberdade",
  ] as const;
  return (
    <div className="modelos">
      <CartaoDeSecao titulo="Saúde financeira desta resposta">
        <div className="modelos__destaque">
          <span
            className="modelos__numero"
            style={{ color: FAIXA_ISFB[p.faixa].cor }}
          >
            {p.isfb}
          </span>
          <span className="pesquisas__suave">de 100</span>
          <SeloDaFaixa faixa={p.faixa} />
        </div>
        <p className="pesquisas__suave">
          {`${diferenca(Math.round((p.isfb - p.mediaDoBrasil) * 10) / 10)} pontos em relação à média do Brasil (${umaCasaBr(p.mediaDoBrasil)})`}
          {p.isfbDoTime !== null ? ` · time ${p.isfbDoTime}` : ""}
        </p>
        <ReguaIsfb
          nota={p.isfb}
          brasil={p.mediaDoBrasil}
          rotulo="Nota desta resposta"
        />
      </CartaoDeSecao>
      <div className="modelos__grade">
        {dims.map((d) => {
          const e = etapaIsfb(d);
          return (
            <div key={d} className="modelos__cartao">
              <h3>{e.curto}</h3>
              <span className="modelos__mini-valor">{p.dimensoes[d]}</span>
              <BarraPercentual
                valor={p.dimensoes[d]}
                cor={e.cor}
                rotulo={`${e.curto}: ${p.dimensoes[d]}`}
              />
              <span className="pesquisas__suave">{`Time: ${p.dimensoesDoTime[d] ?? "—"}`}</span>
            </div>
          );
        })}
        {p.autopercepcao !== null ? (
          <div className="modelos__cartao">
            <h3>Autopercepção</h3>
            <span className="modelos__mini-valor">{p.autopercepcao}</span>
            <span className="pesquisas__suave">
              {p.abertura ? ABERTURA[p.abertura].rotulo : ""}
            </span>
          </div>
        ) : null}
      </div>
      <div className="modelos__grade">
        <MiniCartao
          titulo="Perfil"
          valor={PERFIL[p.perfil].rotulo}
          texto={PERFIL[p.perfil].texto}
        />
        <MiniCartao
          titulo="Sinais de alerta"
          valor={plural(p.sinais.length, "sinal", "sinais")}
          texto={
            p.sinais.length
              ? p.sinais.map((s) => SINAL[s].pessoa).join("; ")
              : "Nenhum"
          }
        />
      </div>
    </div>
  );
}
