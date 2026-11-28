/**
 * T216 — Riscos psicossociais (NR-1): Visão geral e Por grupo.
 *
 * Visão geral: panorama (quantas das 29 dimensões precisam de ação), os 4
 * níveis, a faixa de destaques (participação, comportamentos ofensivos,
 * plano de ação e conformidade), a matriz severidade × prevalência com a
 * dimensão em foco, o ranking de prioridades, saúde e bem-estar, os
 * comportamentos ofensivos e o perfil por domínio.
 */
import { useState } from "react";
import type {
  AcompanhamentoNr1,
  DimensaoNr1Resultado,
  NivelNr1,
  ResultadoDoPainel,
  ResultadoNr1,
} from "../../../../api/modelosDePesquisaClient";
import type {
  CampoGrupo,
  PesquisaDetalhe,
} from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { CartaoDeSecao, Pilulas } from "../../componentes";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";
import { textoDoOculto } from "../../textosDasPesquisas";
import {
  BarraDeFaixas,
  BarraPercentual,
  MiniCartao,
  Quadradinhos,
  SeloDoNivel,
  pessoasOuSigilo,
} from "../ui";
import {
  DIMENSOES_NR1,
  DOMINIOS_NR1,
  TIPOS_DE_OFENSA,
  dimensaoNr1,
  dominioNr1,
} from "./definicao";
import {
  ETAPAS_DA_CONFORMIDADE,
  FAIXA,
  MATRIZ,
  NIVEIS,
  NIVEL,
  ROTULO_DA_PREVALENCIA,
  ROTULO_DO_GRAU,
  ROTULO_DO_INDICADOR,
  COR_DA_FREQUENCIA,
  decimal,
  porcento,
} from "./textos";

export function partesDaDistribuicao(d: DimensaoNr1Resultado) {
  return [
    {
      rotulo: FAIXA.risco.rotulo,
      valor: d.distribuicao.risco,
      cor: FAIXA.risco.cor,
    },
    {
      rotulo: FAIXA.intermediario.rotulo,
      valor: d.distribuicao.intermediario,
      cor: FAIXA.intermediario.cor,
    },
    {
      rotulo: FAIXA.favoravel.rotulo,
      valor: d.distribuicao.favoravel,
      cor: FAIXA.favoravel.cor,
    },
  ];
}

/** "Exigências Laborais · dimensão de risco". */
export function legendaDaDimensao(id: string): string {
  const d = dimensaoNr1(id);
  return `${dominioNr1(d.dominio).rotulo} · ${d.tipo === "risco" ? "dimensão de risco" : "dimensão de proteção"}`;
}

export function MatrizNr1({
  r,
  limite = 3,
}: {
  readonly r: ResultadoNr1;
  readonly limite?: number;
}) {
  return (
    <div
      className="modelos__matriz"
      role="table"
      aria-label="Matriz de risco: severidade por prevalência"
    >
      <span
        role="row"
        className="modelos__matriz-linha-cabeca"
        style={{ display: "contents" }}
      >
        <span role="columnheader" className="modelos__matriz-eixo">
          Severidade ↓ · Prevalência →
        </span>
        {[1, 2, 3, 4].map((p) => (
          <span key={p} role="columnheader" className="modelos__matriz-eixo">
            <strong>{ROTULO_DO_GRAU[p]}</strong>
            {ROTULO_DA_PREVALENCIA[p]}
          </span>
        ))}
      </span>
      {[4, 3, 2, 1].map((sev, linha) => (
        <span key={sev} role="row" style={{ display: "contents" }}>
          <span role="rowheader" className="modelos__matriz-eixo">
            <strong>{`${ROTULO_DO_GRAU[sev]} severidade`}</strong>
            {sev}
          </span>
          {[0, 1, 2, 3].map((col) => {
            const nivel = MATRIZ[linha]![col]!;
            const ids = r.matriz[linha]?.[col] ?? [];
            return (
              <span
                key={col}
                role="cell"
                className="modelos__matriz-celula"
                style={{ ["--cor-celula" as string]: NIVEL[nivel].cor }}
                aria-label={`${NIVEL[nivel].rotulo}: ${plural(ids.length, "dimensão", "dimensões")}`}
              >
                {ids.slice(0, limite).map((id) => (
                  <span
                    key={id}
                    className="modelos__chip"
                    title={dimensaoNr1(id).rotulo}
                  >
                    {dimensaoNr1(id).rotulo}
                  </span>
                ))}
                {ids.length > limite ? (
                  <span className="pesquisas__suave">{`+${plural(ids.length - limite, "dimensão", "dimensões")}`}</span>
                ) : null}
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

export function LegendaDosNiveis() {
  return (
    <p className="modelos__legenda">
      {NIVEIS.map((n) => (
        <span key={n}>
          <span
            className="modelos__ponto"
            style={{ ["--cor" as string]: NIVEL[n].cor }}
            aria-hidden="true"
          />
          {`${NIVEL[n].rotulo} · ${NIVEL[n].acao}`}
        </span>
      ))}
    </p>
  );
}

function CartaoDaDimensao({
  d,
  total,
}: {
  readonly d: DimensaoNr1Resultado;
  readonly total: number;
}) {
  const dim = dimensaoNr1(d.id);
  return (
    <div className="modelos__cartao">
      <div className="modelos__cartao-topo">
        <h3>{dim.rotulo}</h3>
        <SeloDoNivel nivel={d.nivel} />
      </div>
      <span className="pesquisas__suave">{legendaDaDimensao(d.id)}</span>
      <div className="modelos__par">
        <div>
          <span className="modelos__rotulo">Severidade</span>
          <strong>{d.severidade ? ROTULO_DO_GRAU[d.severidade] : "—"}</strong>
          <span className="pesquisas__suave">{` · escore ${decimal(d.escore)} de 5`}</span>
        </div>
        <div>
          <span className="modelos__rotulo">Prevalência</span>
          <strong>{d.prevalencia ? ROTULO_DO_GRAU[d.prevalencia] : "—"}</strong>
          <span className="pesquisas__suave">{` · ${porcento(d.percentuais.risco)} em risco`}</span>
        </div>
      </div>
      <span className="modelos__rotulo">Distribuição das pessoas</span>
      <BarraDeFaixas
        partes={partesDaDistribuicao(d)}
        rotulo={`Distribuição em ${dim.rotulo}`}
      />
      <p className="pesquisas__suave">
        {`${dim.definicao} ${d.distribuicao.risco} de ${plural(total, "pessoa está", "pessoas estão")} na faixa de risco.`}
      </p>
      {d.regraDeProtecao ? (
        <p className="pesquisas__nota">
          Regra de proteção: com severidade alta, esta dimensão nunca fica
          abaixo de "alto".
        </p>
      ) : null}
    </div>
  );
}

export function VisaoGeralNr1({
  resultado,
  acompanhamento,
  detalhe,
  onIrPara,
}: {
  readonly resultado: ResultadoDoPainel;
  readonly acompanhamento: AcompanhamentoNr1 | null;
  readonly detalhe: PesquisaDetalhe;
  readonly onIrPara?: (aba: "plano" | "conformidade") => void;
}) {
  const r = resultado.nr1!;
  const [filtro, setFiltro] = useState<"acao" | "todas">("acao");
  const [foco, setFoco] = useState(0);
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  const emAcao = r.prioridades.filter((id) => {
    const n = porId.get(id)!.nivel;
    return n === "critico" || n === "alto";
  });
  const ranking = filtro === "acao" ? emAcao : r.prioridades;
  const dimFoco = emAcao.length
    ? porId.get(emAcao[Math.min(foco, emAcao.length - 1)]!)!
    : null;
  const minimo = resultado.minimoPorGrupo;
  const proxima = acompanhamento?.proxima
    ? ETAPAS_DA_CONFORMIDADE.find((e) => e.id === acompanhamento.proxima)
        ?.titulo
    : null;

  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Panorama de riscos psicossociais"
        descricao="Como estão os 29 aspectos do trabalho avaliados."
      >
        <div className="modelos__destaque">
          <span
            className="modelos__numero"
            style={{
              color: r.precisamDeAcao ? NIVEL.critico.cor : NIVEL.baixo.cor,
            }}
          >
            {r.precisamDeAcao}
          </span>
          <strong>{`de 29 dimensões ${r.precisamDeAcao === 1 ? "precisa" : "precisam"} de ação`}</strong>
          <span className="pesquisas__suave">
            {`${plural(r.niveis.critico, "em nível crítico", "em nível crítico")} · ${r.niveis.alto} em nível alto`}
          </span>
        </div>
        <p className="modelos__explicacao">
          Cada dimensão é um aspecto do trabalho (por exemplo, o ritmo ou o
          apoio da liderança). O nível combina quantas pessoas foram afetadas
          (prevalência) com a intensidade das respostas (severidade).
        </p>
        <div className="modelos__grade">
          {NIVEIS.map((n) => {
            const ids = r.prioridades.filter(
              (id) => porId.get(id)!.nivel === n,
            );
            return (
              <div
                key={n}
                className="modelos__cartao"
                aria-label={`Nível ${NIVEL[n].rotulo}`}
              >
                <div className="modelos__cartao-topo">
                  <SeloDoNivel nivel={n} />
                  <span className="pesquisas__suave">{NIVEL[n].acao}</span>
                </div>
                <span className="modelos__mini-valor">
                  {plural(ids.length, "dimensão", "dimensões")}
                </span>
                <Quadradinhos
                  cores={ids.map(() => NIVEL[n].cor)}
                  rotulo={plural(ids.length, "dimensão", "dimensões")}
                />
                <span className="pesquisas__suave">{NIVEL[n].frase}</span>
                {ids.length ? (
                  <>
                    <span className="modelos__rotulo">
                      Mais afetadas · % do time
                    </span>
                    <ul className="modelos__lista">
                      {ids.slice(0, 3).map((id) => (
                        <li key={id}>
                          <span>{dimensaoNr1(id).rotulo}</span>
                          <BarraPercentual
                            valor={porId.get(id)!.percentuais.risco}
                            cor={NIVEL[n].cor}
                            rotulo={`${dimensaoNr1(id).rotulo}: % em risco`}
                          />
                          <span className="modelos__num">
                            {porcento(porId.get(id)!.percentuais.risco)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </CartaoDeSecao>

      <div className="modelos__grade">
        <MiniCartao
          titulo="Participação"
          valor={plural(resultado.respostas, "resposta", "respostas")}
          texto={
            detalhe.identificacao === "anonima"
              ? "Respondida pelo link"
              : `De ${plural(detalhe.participantesTotal ?? detalhe.participantes ?? 0, "pessoa convidada", "pessoas convidadas")}`
          }
        />
        <MiniCartao
          titulo="Comportamentos ofensivos"
          valor={
            r.ofensivos.percentual === null
              ? "—"
              : porcento(r.ofensivos.percentual)
          }
          texto={`${pessoasOuSigilo(r.ofensivos.relataram, minimo)} relataram ocorrência nos últimos 12 meses`}
        />
        <MiniCartao
          titulo="Plano de ação"
          valor={
            acompanhamento
              ? plural(acompanhamento.plano.length, "medida", "medidas")
              : "—"
          }
          texto={
            onIrPara ? (
              <button
                type="button"
                className="modelos__link"
                onClick={() => onIrPara("plano")}
              >
                Abrir o plano de ação
              </button>
            ) : undefined
          }
        />
        <MiniCartao
          titulo="Conformidade NR-1"
          valor={
            acompanhamento ? `${acompanhamento.concluidas} de 7 etapas` : "—"
          }
          texto={
            proxima
              ? `Próxima: ${proxima}`
              : acompanhamento
                ? "Todas as etapas concluídas"
                : undefined
          }
        />
      </div>

      <CartaoDeSecao
        titulo="Matriz de risco psicossocial"
        descricao="Severidade (intensidade média) × prevalência (% de pessoas na faixa de risco)."
      >
        <MatrizNr1 r={r} />
        <LegendaDosNiveis />
        {dimFoco ? (
          <>
            <div className="modelos__carrossel-cabeca">
              <strong>{`${Math.min(foco, emAcao.length - 1) + 1} de ${emAcao.length} em risco alto ou crítico`}</strong>
              <span className="modelos__acoes">
                <Button
                  variant="secondary"
                  disabled={foco <= 0}
                  aria-label="Dimensão anterior"
                  onClick={() => setFoco((f) => Math.max(0, f - 1))}
                >
                  ‹
                </Button>
                <Button
                  variant="secondary"
                  disabled={foco >= emAcao.length - 1}
                  aria-label="Próxima dimensão"
                  onClick={() =>
                    setFoco((f) => Math.min(emAcao.length - 1, f + 1))
                  }
                >
                  ›
                </Button>
              </span>
            </div>
            <CartaoDaDimensao d={dimFoco} total={resultado.respostas} />
          </>
        ) : (
          <p className="pesquisas__suave">
            Nenhuma dimensão em nível alto ou crítico.
          </p>
        )}
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Ranking de prioridades"
        descricao="Ordem: nível, % em risco, severidade e nome."
        acao={
          <Pilulas
            rotulo="Filtrar o ranking"
            valor={filtro}
            onMudar={setFiltro}
            opcoes={[
              {
                valor: "acao",
                rotulo: "Alto e crítico",
                contagem: emAcao.length,
              },
              {
                valor: "todas",
                rotulo: "Todas",
                contagem: r.prioridades.length,
              },
            ]}
          />
        }
      >
        <TabelaDePrioridades r={r} ids={ranking} />
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Saúde e bem-estar"
        descricao="% de pessoas na faixa de risco em cada indicador."
      >
        <div className="modelos__grade">
          {r.saude.map((s) => (
            <div key={s.id} className="modelos__cartao">
              <div className="modelos__cartao-topo">
                <h3>{ROTULO_DO_INDICADOR[s.id]?.titulo ?? s.id}</h3>
                <SeloDoNivel nivel={s.nivel} />
              </div>
              <span className="pesquisas__suave">
                {ROTULO_DO_INDICADOR[s.id]?.texto}
              </span>
              <span className="modelos__mini-valor">
                {porcento(s.percentualEmRisco)}
              </span>
              <BarraPercentual
                valor={s.percentualEmRisco}
                cor={FAIXA.risco.cor}
                rotulo={`${ROTULO_DO_INDICADOR[s.id]?.titulo}: % em risco`}
              />
              <span className="pesquisas__suave">{`${s.pessoasEmRisco} de ${plural(s.pessoas, "pessoa", "pessoas")}`}</span>
            </div>
          ))}
        </div>
      </CartaoDeSecao>

      <OfensivosNr1 r={r} minimo={minimo} />

      <CartaoDeSecao
        titulo="Perfil por domínio"
        descricao="As 29 dimensões agrupadas em 8 temas."
      >
        <div className="modelos__acordeoes">
          {DOMINIOS_NR1.map((dom) => {
            const resumo = r.dominios.find((x) => x.id === dom.id);
            return (
              <details key={dom.id} className="modelos__acordeao">
                <summary className="modelos__acordeao-cabeca">
                  <span
                    className="modelos__ponto"
                    style={{ ["--cor" as string]: dom.cor }}
                    aria-hidden="true"
                  />
                  <span className="modelos__acordeao-titulo">{dom.rotulo}</span>
                  <span className="pesquisas__suave">
                    {plural(resumo?.dimensoes ?? 0, "dimensão", "dimensões")}
                  </span>
                  <span className="pesquisas__selo">
                    {resumo && resumo.precisamDeAcao > 0
                      ? `${resumo.precisamDeAcao} ${resumo.precisamDeAcao === 1 ? "precisa" : "precisam"} de ação`
                      : "Sob controle"}
                  </span>
                </summary>
                <div className="modelos__tabela-rolagem">
                  <table className="modelos__tabela">
                    <thead>
                      <tr>
                        <th>Dimensão</th>
                        <th className="modelos__num">Intensidade</th>
                        <th className="modelos__num">% do time em risco</th>
                        <th>Nível</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.dimensoes
                        .filter((d) => d.dominio === dom.id)
                        .map((d) => (
                          <tr key={d.id}>
                            <td>{dimensaoNr1(d.id).rotulo}</td>
                            <td className="modelos__num">{`${decimal(d.escore)} de 5`}</td>
                            <td className="modelos__num">
                              {porcento(d.percentuais.risco)}
                            </td>
                            <td>
                              <SeloDoNivel nivel={d.nivel} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      </CartaoDeSecao>
    </div>
  );
}

export function TabelaDePrioridades({
  r,
  ids,
}: {
  readonly r: ResultadoNr1;
  readonly ids: readonly string[];
}) {
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  return (
    <div className="modelos__tabela-rolagem">
      <table className="modelos__tabela">
        <thead>
          <tr>
            <th className="modelos__num">#</th>
            <th>Dimensão</th>
            <th>Severidade</th>
            <th className="modelos__num">Prevalência</th>
            <th>Distribuição das pessoas</th>
            <th>Nível</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id, i) => {
            const d = porId.get(id)!;
            return (
              <tr key={id}>
                <td className="modelos__num">{i + 1}</td>
                <td>
                  <strong>{dimensaoNr1(id).rotulo}</strong>
                  <span className="modelos__rotulo">
                    {legendaDaDimensao(id)}
                  </span>
                </td>
                <td>{`${d.severidade ? ROTULO_DO_GRAU[d.severidade] : "—"} · ${decimal(d.escore)} de 5`}</td>
                <td className="modelos__num">{`${porcento(d.percentuais.risco)} em risco`}</td>
                <td className="modelos__celula-barra">
                  <BarraDeFaixas
                    partes={partesDaDistribuicao(d)}
                    rotulo={`Distribuição em ${dimensaoNr1(id).rotulo}`}
                  />
                  <span className="modelos__rotulo">
                    {plural(d.pessoas, "pessoa", "pessoas")}
                  </span>
                </td>
                <td>
                  <SeloDoNivel nivel={d.nivel} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OfensivosNr1({
  r,
  minimo,
}: {
  readonly r: ResultadoNr1;
  readonly minimo: number;
}) {
  const o = r.ofensivos;
  return (
    <CartaoDeSecao
      titulo="Comportamentos ofensivos"
      descricao="Relatos nos últimos 12 meses · qualquer ocorrência deve ser tratada."
      acao={
        <span className="pesquisas__selo pesquisas__selo--destaque">
          Exige atenção mesmo com nível baixo
        </span>
      }
    >
      <p>
        <strong>{pessoasOuSigilo(o.relataram, minimo)}</strong>
        {o.percentual !== null ? ` (${porcento(o.percentual)})` : ""} relataram
        pelo menos um tipo.
      </p>
      <ul className="modelos__lista-dimensoes">
        {TIPOS_DE_OFENSA.map((t) => {
          const x = o.tipos.find((y) => y.id === t.id);
          const partes = [
            {
              rotulo: "Raramente",
              valor: x?.raramente ?? 0,
              cor: COR_DA_FREQUENCIA.raramente,
            },
            {
              rotulo: "Às vezes",
              valor: x?.asVezes ?? 0,
              cor: COR_DA_FREQUENCIA.asVezes,
            },
            {
              rotulo: "Frequentemente ou sempre",
              valor: x?.frequentementeOuSempre ?? 0,
              cor: COR_DA_FREQUENCIA.frequente,
            },
          ];
          const protegido = x
            ? [x.raramente, x.asVezes, x.frequentementeOuSempre].some(
                (v) => v === null,
              )
            : false;
          return (
            <li key={t.id} className="modelos__cartao">
              <div className="modelos__cartao-topo">
                <strong>{t.rotulo}</strong>
                <span className="pesquisas__suave">
                  {pessoasOuSigilo(x?.relataram ?? 0, minimo)}
                </span>
              </div>
              {protegido ? (
                <span className="pesquisas__suave">{`Detalhe oculto: menos de ${plural(minimo, "pessoa", "pessoas")} em alguma frequência.`}</span>
              ) : (
                <BarraDeFaixas
                  partes={partes}
                  rotulo={`${t.rotulo} por frequência`}
                />
              )}
            </li>
          );
        })}
      </ul>
      <p className="modelos__legenda">
        <span>
          <span
            className="modelos__ponto"
            style={{ ["--cor" as string]: COR_DA_FREQUENCIA.raramente }}
            aria-hidden="true"
          />
          Raramente
        </span>
        <span>
          <span
            className="modelos__ponto"
            style={{ ["--cor" as string]: COR_DA_FREQUENCIA.asVezes }}
            aria-hidden="true"
          />
          Às vezes
        </span>
        <span>
          <span
            className="modelos__ponto"
            style={{ ["--cor" as string]: COR_DA_FREQUENCIA.frequente }}
            aria-hidden="true"
          />
          Frequentemente ou sempre
        </span>
      </p>
      <p className="pesquisas__nota">
        Os relatos não identificam ninguém. Reforce o canal de denúncia e o
        acolhimento, e trate cada caso conforme a política da empresa.
      </p>
    </CartaoDeSecao>
  );
}

const CAMPO_ROTULO = new Map(CAMPOS_DE_GRUPO.map((c) => [c.campo, c.rotulo]));

/** Por grupo: pressão, recursos e dimensões em ação de cada grupo visível. */
export function PorGrupoNr1({
  resultado,
  campo,
  onCampo,
}: {
  readonly resultado: ResultadoDoPainel;
  readonly campo: CampoGrupo | null;
  readonly onCampo: (c: CampoGrupo) => void;
}) {
  const recortes = resultado.recortes;
  const grupos = resultado.grupos ?? [];
  const ocultos = grupos.filter((g) => !g.visivel).length;
  const empresa = resultado.nr1!;
  if (recortes.length === 0) {
    return (
      <div className="pesquisas__aba-vazia" role="status">
        <strong>Sem recortes nesta pesquisa</strong>
        <p className="pesquisas__suave">
          Na anônima, os recortes aparecem quando quem responde escolhe um grupo
          (configurado em "Separar respostas por").
        </p>
      </div>
    );
  }
  return (
    <CartaoDeSecao
      titulo={`Por ${(CAMPO_ROTULO.get(campo ?? recortes[0]!) ?? "grupo").toLowerCase()}`}
      descricao="Pressão = média das exigências; recursos = média de autonomia, desenvolvimento, liderança e apoio (1 a 5)."
      acao={
        <label className="modelos__campo">
          Agrupar por
          <select
            className="pesquisas__campo"
            value={campo ?? recortes[0]}
            onChange={(e) => onCampo(e.target.value as CampoGrupo)}
          >
            {recortes.map((c) => (
              <option key={c} value={c}>
                {CAMPO_ROTULO.get(c)}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {ocultos ? (
        <p className="pesquisas__nota">{`Grupos com menos de ${plural(resultado.minimoPorGrupo, "resposta", "respostas")} ficam ocultos (${ocultos}).`}</p>
      ) : null}
      {grupos.every((g) => !g.visivel) ? (
        <div className="pesquisas__aba-vazia" role="status">
          <strong>{`Nenhum grupo com ${plural(resultado.minimoPorGrupo, "resposta", "respostas")} ou mais`}</strong>
          <p className="pesquisas__suave">
            Para proteger quem respondeu, os resultados por grupo aparecem
            quando o grupo tem respostas suficientes.
          </p>
        </div>
      ) : null}
      <div className="modelos__tabela-rolagem">
        <table className="modelos__tabela">
          <thead>
            <tr>
              <th>Grupo</th>
              <th className="modelos__num">Respostas</th>
              <th className="modelos__num">Precisam de ação</th>
              <th className="modelos__num">Pressão</th>
              <th className="modelos__num">Recursos</th>
              <th>Destaque</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Toda a empresa</strong>
              </td>
              <td className="modelos__num">{resultado.respostas}</td>
              <td className="modelos__num">{empresa.precisamDeAcao}</td>
              <td className="modelos__num">{decimal(empresa.pressao, 2)}</td>
              <td className="modelos__num">{decimal(empresa.recursos, 2)}</td>
              <td>—</td>
            </tr>
            {grupos.map((g) => (
              <tr key={g.id}>
                <td>{g.nome}</td>
                <td className="modelos__num">{g.respostas}</td>
                {g.visivel && g.nr1 ? (
                  <>
                    <td className="modelos__num">{g.nr1.precisamDeAcao}</td>
                    <td className="modelos__num">
                      {decimal(g.nr1.pressao, 2)}
                    </td>
                    <td className="modelos__num">
                      {decimal(g.nr1.recursos, 2)}
                    </td>
                    <td>
                      {g.nr1.destaque ? (
                        <span className="pesquisas__selo pesquisas__selo--destaque">
                          Mais pressão e menos recursos
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="pesquisas__suave">
                    {textoDoOculto(g.oculto, resultado.minimoPorGrupo)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grupos.some((g) => g.visivel) ? (
        <details className="modelos__acordeao">
          <summary className="modelos__acordeao-cabeca">
            <span className="modelos__acordeao-titulo">
              Nível das 29 dimensões por grupo
            </span>
          </summary>
          <div className="modelos__tabela-rolagem">
            <table className="modelos__tabela">
              <thead>
                <tr>
                  <th>Dimensão</th>
                  {grupos
                    .filter((g) => g.visivel)
                    .map((g) => (
                      <th key={g.id}>{g.nome}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {DIMENSOES_NR1.map((dim) => (
                  <tr key={dim.id}>
                    <td>{dim.rotulo}</td>
                    {grupos
                      .filter((g) => g.visivel)
                      .map((g) => {
                        const x = g.nr1?.dimensoes.find((y) => y.id === dim.id);
                        return (
                          <td key={g.id}>
                            <SeloDoNivel
                              nivel={(x?.nivel ?? null) as NivelNr1 | null}
                            />
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </CartaoDeSecao>
  );
}
