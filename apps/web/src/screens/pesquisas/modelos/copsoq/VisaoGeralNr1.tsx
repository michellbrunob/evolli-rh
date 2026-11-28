/**
 * T216 — Riscos psicossociais (NR-1): Visão geral e Por grupo.
 *
 * Visão geral: panorama (quantas das 29 dimensões precisam de ação) com
 * "Como o nível é definido", os 4 níveis (com "Ver todas"), a faixa de
 * destaques (participação, comportamentos ofensivos, plano de ação e
 * conformidade, que levam às abas), a matriz severidade × prevalência
 * (chips clicáveis) com a dimensão em foco e o atalho para o plano dela, o
 * ranking de prioridades (linhas clicáveis), saúde e bem-estar, os
 * comportamentos ofensivos e o perfil por domínio.
 *
 * Por grupo: tabela, ranking de grupos clicável (as 29 dimensões por nível e
 * onde está o risco do grupo × empresa), mapa de calor por domínio e o
 * gráfico exigências × recursos com os quatro quadrantes.
 */
import { useRef, useState } from "react";
import type {
  AcompanhamentoNr1,
  DimensaoNr1Resultado,
  GrupoDoModelo,
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
import { estrategiasSugeridas } from "./medidasSugeridas";
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
import "./Nr1.css";

/** As abas para onde a Visão geral leva (com a dimensão, no plano). */
export type DestinoDaVisaoGeral = "plano" | "conformidade";

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

/** Rola até o elemento, se o navegador souber (o jsdom não sabe). */
function rolarAte(el: HTMLElement | null) {
  el?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
}

export function MatrizNr1({
  r,
  limite = 3,
  onEscolher,
}: {
  readonly r: ResultadoNr1;
  readonly limite?: number;
  /** Chips clicáveis: abre a dimensão (sem isto, só texto). */
  readonly onEscolher?: (id: string) => void;
}) {
  const [abertas, setAbertas] = useState<readonly string[]>([]);
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
            const chave = `${linha}-${col}`;
            const aberta = abertas.includes(chave);
            // Até limite + 1 cabem todas: "+1 dimensão" esconderia só uma.
            const cabem = ids.length <= limite + 1;
            const visiveis = aberta || cabem ? ids : ids.slice(0, limite);
            return (
              <span
                key={col}
                role="cell"
                className="modelos__matriz-celula"
                style={{ ["--cor-celula" as string]: NIVEL[nivel].cor }}
                aria-label={`${NIVEL[nivel].rotulo}: ${plural(ids.length, "dimensão", "dimensões")}`}
              >
                {visiveis.map((id) =>
                  onEscolher ? (
                    <button
                      key={id}
                      type="button"
                      className="modelos__chip nr1__chip-botao"
                      title={dimensaoNr1(id).rotulo}
                      onClick={() => onEscolher(id)}
                    >
                      {dimensaoNr1(id).rotuloCurto}
                    </button>
                  ) : (
                    <span
                      key={id}
                      className="modelos__chip"
                      title={dimensaoNr1(id).rotulo}
                    >
                      {dimensaoNr1(id).rotuloCurto}
                    </span>
                  ),
                )}
                {!cabem ? (
                  onEscolher ? (
                    <button
                      type="button"
                      className="modelos__link"
                      aria-expanded={aberta}
                      onClick={() =>
                        setAbertas((a) =>
                          aberta ? a.filter((x) => x !== chave) : [...a, chave],
                        )
                      }
                    >
                      {aberta
                        ? "Mostrar menos"
                        : `+${plural(ids.length - limite, "dimensão", "dimensões")}`}
                    </button>
                  ) : (
                    <span className="pesquisas__suave">{`+${plural(ids.length - limite, "dimensão", "dimensões")}`}</span>
                  )
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

/** "Como o nível é definido": severidade, prevalência, matriz e ação. */
export function ComoONivelEDefinido() {
  return (
    <details className="modelos__acordeao nr1__como">
      <summary className="modelos__acordeao-cabeca">
        <span className="modelos__acordeao-titulo">
          Como o nível é definido
        </span>
      </summary>
      <div className="nr1__como-corpo">
        <p>
          <strong>Severidade</strong> é a intensidade média das respostas na
          dimensão, num escore de 1 a 5 (nas dimensões de proteção, o escore é
          espelhado). Acima de 4 é muito alta; acima de 3, alta; acima de 2,
          média; até 2, baixa.
        </p>
        <p>
          <strong>Prevalência</strong> é o % de pessoas na faixa de risco: 60%
          ou mais é muito alta; de 40%, alta; de 20%, média; abaixo, baixa. Com
          menos de 10 respostas, basta uma pessoa em risco para a prevalência
          ser alta.
        </p>
        <p>
          O nível sai do cruzamento das duas na matriz. Sintomas depressivos e
          comportamentos ofensivos com severidade alta nunca ficam abaixo de
          alto.
        </p>
        <ul className="nr1__como-niveis">
          {NIVEIS.map((n) => (
            <li key={n}>
              <SeloDoNivel nivel={n} />
              <span>{`${NIVEL[n].acao}. ${NIVEL[n].comoAgir}`}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function CartaoDaDimensao({
  d,
  total,
  onVerPlano,
}: {
  readonly d: DimensaoNr1Resultado;
  readonly total: number;
  readonly onVerPlano?: () => void;
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
      {onVerPlano ? (
        <div>
          <button type="button" className="modelos__link" onClick={onVerPlano}>
            Ver o plano de ação desta dimensão
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Principais achados": 3 frases por regra (sem IA), no molde da leitura
 * automática da saúde financeira — o maior risco (com o % em risco), o ponto
 * mais forte (com o % favorável) e os comportamentos ofensivos (respeitando
 * o sigilo: contagem oculta vira "menos de N").
 */
export function principaisAchadosNr1(
  r: ResultadoNr1,
  minimo: number,
): [string, string, string] {
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  const maior = r.prioridades
    .map((id) => porId.get(id))
    .find((d) => d && d.nivel !== null && d.percentuais.risco > 0);
  const risco = maior
    ? `${dimensaoNr1(maior.id).rotulo} é o maior risco: ${porcento(maior.percentuais.risco)} do time está na faixa de risco (nível ${NIVEL[maior.nivel!].rotulo.toLowerCase()}).`
    : "Nenhuma dimensão tem pessoas na faixa de risco.";
  // O ponto forte: o maior % favorável; no empate, a ordem do catálogo.
  const forte = DIMENSOES_NR1.map((x) => porId.get(x.id))
    .filter((d) => d !== undefined && d.nivel !== null)
    .reduce<DimensaoNr1Resultado | null>(
      (m, d) =>
        d!.percentuais.favoravel > (m?.percentuais.favoravel ?? 0) ? d! : m,
      null,
    );
  const pontoForte = forte
    ? `${dimensaoNr1(forte.id).rotulo} é o ponto mais forte: ${porcento(forte.percentuais.favoravel)} do time está na faixa favorável.`
    : "Nenhuma dimensão tem pessoas na faixa favorável ainda.";
  const o = r.ofensivos;
  const ofensivos =
    o.relataram === null
      ? `Menos de ${plural(minimo, "pessoa", "pessoas")} relataram algum comportamento ofensivo nos últimos 12 meses: mesmo poucos relatos pedem acolhimento e apuração.`
      : o.relataram > 0
        ? `${plural(o.relataram, "pessoa", "pessoas")}${o.percentual !== null ? ` (${porcento(o.percentual)})` : ""} ${o.relataram === 1 ? "relatou" : "relataram"} algum comportamento ofensivo nos últimos 12 meses: acolha, apure cada caso e reforce o canal de denúncia.`
        : "Ninguém relatou comportamento ofensivo nos últimos 12 meses; mantenha o canal de denúncia ativo.";
  return [risco, pontoForte, ofensivos];
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
  readonly onIrPara?: (aba: DestinoDaVisaoGeral, dimensaoId?: string) => void;
}) {
  const r = resultado.nr1!;
  const [filtro, setFiltro] = useState<"acao" | "todas">("acao");
  const [foco, setFoco] = useState(0);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [niveisAbertos, setNiveisAbertos] = useState<readonly NivelNr1[]>([]);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  const emAcao = r.prioridades.filter((id) => {
    const n = porId.get(id)!.nivel;
    return n === "critico" || n === "alto";
  });
  const ranking = filtro === "acao" ? emAcao : r.prioridades;
  const dimFoco = escolhida
    ? (porId.get(escolhida) ?? null)
    : emAcao.length
      ? porId.get(emAcao[Math.min(foco, emAcao.length - 1)]!)!
      : null;
  const minimo = resultado.minimoPorGrupo;
  const proxima = acompanhamento?.proxima
    ? ETAPAS_DA_CONFORMIDADE.find((e) => e.id === acompanhamento.proxima)
        ?.titulo
    : null;

  /** Abre a dimensão no cartão da matriz (no carrossel, se for de ação). */
  function escolher(id: string) {
    const i = emAcao.indexOf(id);
    if (i >= 0) {
      setFoco(i);
      setEscolhida(null);
    } else {
      setEscolhida(id);
    }
    rolarAte(cartaoRef.current);
  }

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
            {`${r.niveis.critico} em nível crítico · ${r.niveis.alto} em nível alto`}
          </span>
        </div>
        <p className="modelos__explicacao">
          Cada dimensão é um aspecto do trabalho (por exemplo, o ritmo ou o
          apoio da liderança). O nível combina quantas pessoas foram afetadas
          (prevalência) com a intensidade das respostas (severidade).
        </p>
        <ComoONivelEDefinido />
        <div className="modelos__grade">
          {NIVEIS.map((n) => {
            const ids = r.prioridades.filter(
              (id) => porId.get(id)!.nivel === n,
            );
            const aberto = niveisAbertos.includes(n);
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
                      {(aberto ? ids : ids.slice(0, 3)).map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            className="modelos__link nr1__link-texto"
                            onClick={() => escolher(id)}
                          >
                            {dimensaoNr1(id).rotulo}
                          </button>
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
                    {ids.length > 3 ? (
                      <button
                        type="button"
                        className="modelos__link"
                        aria-expanded={aberto}
                        onClick={() =>
                          setNiveisAbertos((a) =>
                            aberto ? a.filter((x) => x !== n) : [...a, n],
                          )
                        }
                      >
                        {aberto ? "Ver menos" : `Ver todas as ${ids.length} ›`}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Principais achados"
        descricao="Leitura automática dos resultados, por regra: o maior risco, o ponto mais forte e os comportamentos ofensivos."
      >
        <ul className="nr1__achados">
          {principaisAchadosNr1(r, minimo).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
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
          valor={plural(
            estrategiasSugeridas(r),
            "estratégia sugerida",
            "estratégias sugeridas",
          )}
          texto={
            <>
              {acompanhamento
                ? plural(
                    acompanhamento.plano.length,
                    "medida no plano",
                    "medidas no plano",
                  )
                : null}
              {onIrPara ? (
                <button
                  type="button"
                  className="modelos__link nr1__link-bloco"
                  onClick={() => onIrPara("plano")}
                >
                  Abrir o plano de ação
                </button>
              ) : null}
            </>
          }
        />
        <MiniCartao
          titulo="Conformidade NR-1"
          valor={
            acompanhamento ? `${acompanhamento.concluidas} de 7 etapas` : "—"
          }
          texto={
            <>
              {textoDaProxima(proxima, acompanhamento !== null)}
              {onIrPara ? (
                <button
                  type="button"
                  className="modelos__link nr1__link-bloco"
                  onClick={() => onIrPara("conformidade")}
                >
                  Abrir a conformidade
                </button>
              ) : null}
            </>
          }
        />
      </div>

      <CartaoDeSecao
        titulo="Matriz de risco psicossocial"
        descricao="Severidade (intensidade média) × prevalência (% de pessoas na faixa de risco)."
      >
        <MatrizNr1 r={r} onEscolher={escolher} />
        <LegendaDosNiveis />
        <div ref={cartaoRef} className="nr1__foco">
          {dimFoco && escolhida ? (
            <div className="modelos__carrossel-cabeca">
              <strong>Dimensão escolhida</strong>
              {emAcao.length ? (
                <button
                  type="button"
                  className="modelos__link"
                  onClick={() => setEscolhida(null)}
                >
                  Voltar às de risco alto ou crítico
                </button>
              ) : null}
            </div>
          ) : dimFoco ? (
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
          ) : null}
          {dimFoco ? (
            <CartaoDaDimensao
              d={dimFoco}
              total={resultado.respostas}
              {...(onIrPara
                ? { onVerPlano: () => onIrPara("plano", dimFoco.id) }
                : {})}
            />
          ) : (
            <p className="pesquisas__suave">
              Nenhuma dimensão em nível alto ou crítico.
            </p>
          )}
        </div>
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
        <TabelaDePrioridades r={r} ids={ranking} onEscolher={escolher} />
        {filtro === "acao" && r.prioridades.length > emAcao.length ? (
          <div>
            <button
              type="button"
              className="modelos__link"
              onClick={() => setFiltro("todas")}
            >
              {`Ver todas as ${r.prioridades.length} dimensões`}
            </button>
          </div>
        ) : null}
      </CartaoDeSecao>

      <SaudeNr1 r={r} />

      <OfensivosNr1 r={r} minimo={minimo} />

      <CartaoDeSecao
        titulo="Perfil por domínio"
        descricao="As 29 dimensões agrupadas em 8 temas."
      >
        <div className="modelos__acordeoes">
          {DOMINIOS_NR1.map((dom, i) => {
            const resumo = r.dominios.find((x) => x.id === dom.id);
            return (
              <details
                key={dom.id}
                className="modelos__acordeao"
                // O 1º domínio já vem aberto.
                open={i === 0 ? true : undefined}
              >
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

function textoDaProxima(proxima: string | null | undefined, comDados: boolean) {
  if (proxima) return `Próxima: ${proxima}`;
  return comDados ? "Todas as etapas concluídas" : null;
}

/** Saúde e bem-estar: % em risco e a barra das três faixas. */
export function SaudeNr1({ r }: { readonly r: ResultadoNr1 }) {
  const porId = new Map(r.dimensoes.map((d) => [d.id, d]));
  return (
    <CartaoDeSecao
      titulo="Saúde e bem-estar"
      descricao="% de pessoas na faixa de risco em cada indicador."
    >
      <div className="modelos__grade nr1__saude">
        {r.saude.map((s) => {
          const dim = porId.get(s.id);
          const titulo = ROTULO_DO_INDICADOR[s.id]?.titulo ?? s.id;
          return (
            <div key={s.id} className="modelos__cartao">
              <div className="modelos__cartao-topo">
                <h3>{titulo}</h3>
                <SeloDoNivel nivel={s.nivel} />
              </div>
              <span className="pesquisas__suave">
                {ROTULO_DO_INDICADOR[s.id]?.texto}
              </span>
              <span className="modelos__mini-valor">
                {porcento(s.percentualEmRisco)}
              </span>
              {dim ? (
                <BarraDeFaixas
                  partes={partesDaDistribuicao(dim)}
                  rotulo={`${titulo}: distribuição das pessoas`}
                />
              ) : (
                <BarraPercentual
                  valor={s.percentualEmRisco}
                  cor={FAIXA.risco.cor}
                  rotulo={`${titulo}: % em risco`}
                />
              )}
              <span className="pesquisas__suave">{`${s.pessoasEmRisco} de ${plural(s.pessoas, "pessoa", "pessoas")} em risco`}</span>
            </div>
          );
        })}
      </div>
    </CartaoDeSecao>
  );
}

export function TabelaDePrioridades({
  r,
  ids,
  onEscolher,
}: {
  readonly r: ResultadoNr1;
  readonly ids: readonly string[];
  /** Linhas clicáveis: abre a dimensão na matriz. */
  readonly onEscolher?: (id: string) => void;
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
              <tr
                key={id}
                {...(onEscolher
                  ? {
                      className: "nr1__linha-clicavel",
                      onClick: () => onEscolher(id),
                    }
                  : {})}
              >
                <td className="modelos__num">{i + 1}</td>
                <td>
                  {onEscolher ? (
                    <button
                      type="button"
                      className="modelos__link nr1__link-forte"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEscolher(id);
                      }}
                    >
                      {dimensaoNr1(id).rotulo}
                    </button>
                  ) : (
                    <strong>{dimensaoNr1(id).rotulo}</strong>
                  )}
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
                    {`${plural(d.distribuicao.risco, "pessoa", "pessoas")} em risco`}
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

const FREQUENCIAS = [
  { campo: "raramente", rotulo: "Raramente", cor: COR_DA_FREQUENCIA.raramente },
  { campo: "asVezes", rotulo: "Às vezes", cor: COR_DA_FREQUENCIA.asVezes },
  {
    campo: "frequentementeOuSempre",
    rotulo: "Frequentemente ou sempre",
    cor: COR_DA_FREQUENCIA.frequente,
  },
] as const;

/** As frequências do tipo: visíveis (barra) e ocultas pelo sigilo. */
export function frequenciasDoTipo(x: {
  raramente: number | null;
  asVezes: number | null;
  frequentementeOuSempre: number | null;
}) {
  return {
    visiveis: FREQUENCIAS.filter((f) => x[f.campo] !== null).map((f) => ({
      rotulo: f.rotulo,
      valor: x[f.campo]!,
      cor: f.cor,
    })),
    ocultas: FREQUENCIAS.filter((f) => x[f.campo] === null).map(
      (f) => f.rotulo,
    ),
  };
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
          // `null` é sigilo ("menos de N"), nunca zero.
          const relataram = x ? x.relataram : 0;
          const f = x ? frequenciasDoTipo(x) : null;
          const comBarra =
            relataram !== null && relataram > 0 && f && f.visiveis.length > 0;
          return (
            <li key={t.id} className="modelos__cartao">
              <div className="modelos__cartao-topo">
                <strong>{t.rotulo}</strong>
                <span className="pesquisas__suave">
                  {`${pessoasOuSigilo(relataram, minimo)}${
                    relataram !== null && o.pessoas > 0
                      ? ` (${porcento((relataram * 100) / o.pessoas)})`
                      : ""
                  }`}
                </span>
              </div>
              {comBarra ? (
                <BarraDeFaixas
                  partes={f.visiveis}
                  rotulo={`${t.rotulo} por frequência`}
                />
              ) : null}
              {relataram !== null && relataram > 0 && f?.ocultas.length ? (
                <span className="pesquisas__suave">{`Oculto para proteger quem respondeu: ${f.ocultas.join(", ")}.`}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="modelos__legenda">
        {FREQUENCIAS.map((fq) => (
          <span key={fq.campo}>
            <span
              className="modelos__ponto"
              style={{ ["--cor" as string]: fq.cor }}
              aria-hidden="true"
            />
            {fq.rotulo}
          </span>
        ))}
      </p>
      <p className="pesquisas__nota">
        {`Os relatos não identificam ninguém: frequências com menos de ${plural(minimo, "pessoa", "pessoas")} ficam ocultas (e, se só uma ficasse, também a menor das outras). Reforce o canal de denúncia e o acolhimento, e trate cada caso conforme a política da empresa.`}
      </p>
    </CartaoDeSecao>
  );
}

const CAMPO_ROTULO = new Map(CAMPOS_DE_GRUPO.map((c) => [c.campo, c.rotulo]));

export type Quadrante =
  "alta_tensao" | "trabalho_ativo" | "passivo" | "baixa_tensao";

export const QUADRANTES: Readonly<
  Record<Quadrante, { readonly rotulo: string; readonly texto: string }>
> = {
  alta_tensao: {
    rotulo: "Alta tensão",
    texto: "Muitas exigências e poucos recursos: o maior risco.",
  },
  trabalho_ativo: {
    rotulo: "Trabalho ativo",
    texto: "Muitas exigências, compensadas por recursos.",
  },
  passivo: {
    rotulo: "Passivo",
    texto: "Poucas exigências e poucos recursos: risco de desmotivação.",
  },
  baixa_tensao: {
    rotulo: "Baixa tensão",
    texto: "Poucas exigências e bons recursos.",
  },
};

/** O quadrante pela pressão (exigências) e recursos, com o meio da escala (3). */
export function quadranteDe(
  pressao: number | null,
  recursos: number | null,
): Quadrante | null {
  if (pressao === null || recursos === null) return null;
  const exigente = pressao > 3;
  const comRecursos = recursos >= 3;
  if (exigente) return comRecursos ? "trabalho_ativo" : "alta_tensao";
  return comRecursos ? "baixa_tensao" : "passivo";
}

/** A posição de cada dimensão no catálogo (`DIMENSOES_NR1`). */
const ORDEM = new Map(DIMENSOES_NR1.map((d, i) => [d.id, i]));

/** As N dimensões com mais gente em risco no grupo, comparadas com a empresa. */
export function ondeEstaORisco(
  grupo: NonNullable<GrupoDoModelo["nr1"]>,
  empresa: ResultadoNr1,
  n = 6,
) {
  const daEmpresa = new Map(
    empresa.dimensoes.map((d) => [d.id, d.percentuais.risco]),
  );
  return (
    grupo.dimensoes
      .filter((d) => d.nivel !== null)
      .map((d) => {
        const e = daEmpresa.get(d.id) ?? 0;
        return {
          id: d.id,
          grupo: d.percentualEmRisco,
          empresa: e,
          diferenca: Math.round((d.percentualEmRisco - e) * 10) / 10,
          nivel: d.nivel,
        };
      })
      // % em risco; no empate, a ordem do catálogo (nunca o nome).
      .sort((a, b) => b.grupo - a.grupo || ORDEM.get(a.id)! - ORDEM.get(b.id)!)
      .slice(0, n)
  );
}

/**
 * % em risco de um conjunto de dimensões: a média dos % JÁ ARREDONDADOS de
 * cada uma (o que a tela mostra), arredondada ao inteiro. Sem dados: null.
 */
export function mediaArredondada(
  dimensoes: readonly { percentualEmRisco: number }[],
): number | null {
  if (!dimensoes.length) return null;
  return Math.round(
    dimensoes.reduce((t, d) => t + Math.round(d.percentualEmRisco), 0) /
      dimensoes.length,
  );
}

/** % do time em risco no grupo: a média das dimensões com nível. */
export function percentualEmRiscoDoGrupo(
  dimensoes: readonly { percentualEmRisco: number; nivel: NivelNr1 | null }[],
): number {
  return mediaArredondada(dimensoes.filter((d) => d.nivel !== null)) ?? 0;
}

/** % em risco por domínio: a média das dimensões com dados. */
export function riscoPorDominio(
  dimensoes: readonly {
    id: string;
    percentualEmRisco: number;
    nivel: NivelNr1 | null;
  }[],
): Record<string, number | null> {
  const saida: Record<string, number | null> = {};
  for (const dom of DOMINIOS_NR1) {
    const lista = dimensoes.filter(
      (d) => d.nivel !== null && dimensaoNr1(d.id).dominio === dom.id,
    );
    saida[dom.id] = mediaArredondada(lista);
  }
  return saida;
}

/** Os grupos visíveis em ordem de risco: precisam de ação, depois % médio. */
export function rankingDosGrupos(grupos: readonly GrupoDoModelo[]) {
  const media = (g: GrupoDoModelo) =>
    percentualEmRiscoDoGrupo(g.nr1?.dimensoes ?? []);
  return grupos
    .filter((g) => g.visivel && g.nr1)
    .sort(
      (a, b) =>
        b.nr1!.precisamDeAcao - a.nr1!.precisamDeAcao ||
        media(b) - media(a) ||
        a.nome.localeCompare(b.nome),
    );
}

const empresaComoDimensoes = (r: ResultadoNr1) =>
  r.dimensoes.map((d) => ({
    id: d.id,
    percentualEmRisco: d.percentuais.risco,
    nivel: d.nivel,
  }));

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
  const ocultos = grupos.filter((g) => !g.visivel && !g.falhou).length;
  const falharam = grupos.filter((g) => g.falhou).length;
  const empresa = resultado.nr1!;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const detalheRef = useRef<HTMLDivElement>(null);
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
  const rotuloDoCampo = (
    CAMPO_ROTULO.get(campo ?? recortes[0]!) ?? "grupo"
  ).toLowerCase();
  const ranking = rankingDosGrupos(grupos);
  const grupo = ranking.find((g) => g.id === escolhido) ?? ranking[0] ?? null;
  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo={`Por ${rotuloDoCampo}`}
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
        {falharam ? (
          <p className="pesquisas__erro" role="alert">
            {`Não foi possível carregar ${plural(falharam, "grupo", "grupos")}. Recarregue a página para tentar de novo.`}
          </p>
        ) : null}
        {grupos.length > 0 && grupos.every((g) => !g.visivel) && !falharam ? (
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
                  ) : g.falhou ? (
                    <td colSpan={4} className="pesquisas__erro">
                      Não foi possível carregar este grupo.
                    </td>
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
      </CartaoDeSecao>

      {ranking.length ? (
        <>
          <CartaoDeSecao
            titulo={`Ranking por ${rotuloDoCampo}`}
            descricao="Grupos em ordem de risco: dimensões que precisam de ação e % médio em risco. Escolha um grupo para ver onde está o risco."
          >
            <div className="modelos__tabela-rolagem">
              <table className="modelos__tabela nr1__ranking-grupos">
                <thead>
                  <tr>
                    <th className="modelos__num">#</th>
                    <th>Grupo</th>
                    <th className="modelos__num">Precisam de ação</th>
                    <th className="modelos__num">% do time em risco</th>
                    <th>Dimensões por nível</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((g, i) => (
                    <tr
                      key={g.id}
                      className="nr1__linha-clicavel"
                      {...(grupo?.id === g.id ? { "data-escolhido": "" } : {})}
                      onClick={() => {
                        setEscolhido(g.id);
                        rolarAte(detalheRef.current);
                      }}
                    >
                      <td className="modelos__num">{i + 1}</td>
                      <td>
                        <button
                          type="button"
                          className="modelos__link nr1__link-forte"
                          aria-pressed={grupo?.id === g.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEscolhido(g.id);
                            rolarAte(detalheRef.current);
                          }}
                        >
                          {g.nome}
                        </button>
                        <span className="modelos__rotulo">
                          {plural(g.respostas, "resposta", "respostas")}
                        </span>
                      </td>
                      <td className="modelos__num">{`${g.nr1!.precisamDeAcao} de 29`}</td>
                      <td className="modelos__num">
                        {porcento(percentualEmRiscoDoGrupo(g.nr1!.dimensoes))}
                      </td>
                      <td className="modelos__celula-barra">
                        <BarraDosNiveis niveis={g.nr1!.niveis} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CartaoDeSecao>

          {grupo ? (
            <div ref={detalheRef}>
              <OndeEstaORisco grupo={grupo} empresa={empresa} />
            </div>
          ) : null}

          <MapaDeCalorNr1 grupos={ranking} empresa={empresa} />

          <ExigenciasERecursos
            grupos={ranking}
            empresa={empresa}
            respostasDaEmpresa={resultado.respostas}
            rotuloDoCampo={rotuloDoCampo}
          />
        </>
      ) : null}
    </div>
  );
}

/** "{grupo} · onde está o risco": 6 dimensões e as 29 por nível. */
function OndeEstaORisco({
  grupo,
  empresa,
}: {
  readonly grupo: GrupoDoModelo;
  readonly empresa: ResultadoNr1;
}) {
  const g = grupo.nr1!;
  const linhas = ondeEstaORisco(g, empresa);
  return (
    <CartaoDeSecao
      titulo={`${grupo.nome} · onde está o risco`}
      descricao={`As ${linhas.length} dimensões com mais gente em risco no grupo, comparadas com a empresa.`}
    >
      <div className="modelos__tabela-rolagem">
        <table className="modelos__tabela">
          <thead>
            <tr>
              <th>Dimensão</th>
              <th className="modelos__num">{grupo.nome}</th>
              <th className="modelos__num">Empresa</th>
              <th className="modelos__num">Diferença</th>
              <th>Nível no grupo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td>{dimensaoNr1(l.id).rotulo}</td>
                <td className="modelos__num">{porcento(l.grupo)}</td>
                <td className="modelos__num">{porcento(l.empresa)}</td>
                <td className="modelos__num">
                  {`${l.diferenca > 0 ? "+" : l.diferenca < 0 ? "−" : ""}${Math.abs(Math.round(l.diferenca))} p.p.`}
                </td>
                <td>
                  <SeloDoNivel nivel={l.nivel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="modelos__acordeao">
        <summary className="modelos__acordeao-cabeca">
          <span className="modelos__acordeao-titulo">
            {`As 29 dimensões de ${grupo.nome} por nível`}
          </span>
        </summary>
        <div className="nr1__por-nivel">
          {NIVEIS.map((n) => {
            const ids = g.dimensoes
              .filter((d) => d.nivel === n)
              .map((d) => d.id);
            return (
              <div key={n}>
                <p className="modelos__grupo-titulo">{`${NIVEL[n].rotulo} · ${ids.length}`}</p>
                <ul className="nr1__lista-curta">
                  {ids.map((id) => (
                    <li key={id}>{dimensaoNr1(id).rotulo}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </CartaoDeSecao>
  );
}

/** Intensidade do vermelho pelo % em risco (0 a 100). */
const corDoCalor = (p: number | null) =>
  p === null
    ? "transparent"
    : `color-mix(in srgb, ${FAIXA.risco.cor} ${Math.round(Math.min(100, p) * 0.85)}%, transparent)`;

/** Mapa de calor: % em risco de cada domínio, por grupo e na empresa. */
function MapaDeCalorNr1({
  grupos,
  empresa,
}: {
  readonly grupos: readonly GrupoDoModelo[];
  readonly empresa: ResultadoNr1;
}) {
  const linhas = [
    {
      id: "empresa",
      nome: "Toda a empresa",
      dom: riscoPorDominio(empresaComoDimensoes(empresa)),
    },
    ...grupos.map((g) => ({
      id: g.id,
      nome: g.nome,
      dom: riscoPorDominio(g.nr1!.dimensoes),
    })),
  ];
  return (
    <CartaoDeSecao
      titulo="Mapa de calor por domínio"
      descricao="% médio de pessoas em risco nas dimensões de cada domínio. Quanto mais forte o vermelho, mais gente em risco."
    >
      <div className="modelos__tabela-rolagem">
        <table className="modelos__tabela nr1__calor">
          <thead>
            <tr>
              <th>Grupo</th>
              {DOMINIOS_NR1.map((d) => (
                <th key={d.id} className="modelos__num" title={d.rotulo}>
                  {d.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.id === "empresa" ? <strong>{l.nome}</strong> : l.nome}
                </td>
                {DOMINIOS_NR1.map((d) => {
                  const p = l.dom[d.id] ?? null;
                  return (
                    <td
                      key={d.id}
                      className="modelos__num nr1__calor-celula"
                      style={{ background: corDoCalor(p) }}
                    >
                      {porcento(p)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CartaoDeSecao>
  );
}

/** As dimensões por nível do grupo: barra empilhada com os números. */
export function BarraDosNiveis({
  niveis,
}: {
  readonly niveis: Readonly<Record<NivelNr1, number>>;
}) {
  const total = NIVEIS.reduce((t, n) => t + niveis[n], 0);
  return (
    <span
      className="nr1__barra-niveis"
      role="img"
      aria-label={`Dimensões por nível: ${NIVEIS.map((n) => `${NIVEL[n].rotulo} ${niveis[n]}`).join(", ")}`}
    >
      {NIVEIS.map((n) =>
        niveis[n] > 0 ? (
          <span
            key={n}
            className={`nr1__barra-nivel nr1__barra-nivel--${n}`}
            style={{
              width: `${(niveis[n] * 100) / (total || 1)}%`,
              background: NIVEL[n].cor,
            }}
            aria-hidden="true"
          >
            {niveis[n]}
          </span>
        ) : null,
      )}
    </span>
  );
}

/**
 * O intervalo do eixo pelos dados, com folga de 0,25 e o meio da escala (3,
 * que divide os quadrantes) sempre dentro; no mínimo 1 ponto de largura,
 * dentro de 1 a 5, em passos de 0,25.
 */
export function escalaDoEixo(valores: readonly number[]): [number, number] {
  const todos = [...valores, 3];
  let lo = Math.floor((Math.min(...todos) - 0.25) * 4) / 4;
  let hi = Math.ceil((Math.max(...todos) + 0.25) * 4) / 4;
  if (hi - lo < 1) {
    const falta = (1 - (hi - lo)) / 2;
    lo -= falta;
    hi += falta;
  }
  return [Math.max(1, lo), Math.min(5, hi)];
}

/** O raio da bolha pela quantidade de respostas (área proporcional). */
export function raioDaBolha(respostas: number, maior: number): number {
  return 5 + 9 * Math.sqrt(Math.max(0, respostas) / Math.max(1, maior));
}

const hexParaRgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A cor da bolha pelo % em risco: verde (0%), âmbar (50%), vermelho (100%). */
export function corDoRisco(percentual: number): string {
  const p = Math.min(100, Math.max(0, percentual)) / 100;
  const [de, para, t] =
    p <= 0.5
      ? [FAIXA.favoravel.cor, FAIXA.intermediario.cor, p * 2]
      : [FAIXA.intermediario.cor, FAIXA.risco.cor, (p - 0.5) * 2];
  const a = hexParaRgb(de);
  const b = hexParaRgb(para);
  return `#${a
    .map((x, i) =>
      Math.round(x + (b[i]! - x) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Os valores do eixo em passos de 0,5. */
function marcasDoEixo([lo, hi]: readonly [number, number]): number[] {
  const marcas: number[] = [];
  for (let v = Math.ceil(lo * 2) / 2; v <= hi + 1e-9; v += 0.5) marcas.push(v);
  return marcas;
}

/**
 * Exigências × recursos: pressão (exigências) na vertical, apoio (recursos)
 * na horizontal, escala ajustada aos dados; tamanho da bolha = respostas e
 * cor = % do time em risco; o meio da escala divide os quatro quadrantes.
 */
function ExigenciasERecursos({
  grupos,
  empresa,
  respostasDaEmpresa,
  rotuloDoCampo,
}: {
  readonly grupos: readonly GrupoDoModelo[];
  readonly empresa: ResultadoNr1;
  readonly respostasDaEmpresa: number;
  readonly rotuloDoCampo: string;
}) {
  const L = 380;
  const A = 300;
  const m = { e: 52, d: 18, t: 18, b: 44 };
  const pontos = [
    {
      id: "empresa",
      nome: "Toda a empresa",
      pressao: empresa.pressao,
      recursos: empresa.recursos,
      respostas: respostasDaEmpresa,
      risco: percentualEmRiscoDoGrupo(empresaComoDimensoes(empresa)),
    },
    ...grupos.map((g) => ({
      id: g.id,
      nome: g.nome,
      pressao: g.nr1!.pressao,
      recursos: g.nr1!.recursos,
      respostas: g.respostas,
      risco: percentualEmRiscoDoGrupo(g.nr1!.dimensoes),
    })),
  ].filter(
    (p): p is typeof p & { pressao: number; recursos: number } =>
      p.pressao !== null && p.recursos !== null,
  );
  const ex = escalaDoEixo(pontos.map((p) => p.recursos));
  const ey = escalaDoEixo(pontos.map((p) => p.pressao));
  const x = (v: number) =>
    m.e + ((v - ex[0]) / (ex[1] - ex[0])) * (L - m.e - m.d);
  const y = (v: number) =>
    A - m.b - ((v - ey[0]) / (ey[1] - ey[0])) * (A - m.t - m.b);
  const maior = Math.max(1, ...pontos.map((p) => p.respostas));
  const meioX = x(Math.min(ex[1], Math.max(ex[0], 3)));
  const meioY = y(Math.min(ey[1], Math.max(ey[0], 3)));
  return (
    <CartaoDeSecao
      titulo="Exigências × recursos"
      descricao="Cada bolha é um grupo: mais acima, mais pressão (exigências); mais à direita, mais apoio (recursos). O meio da escala (3) divide os quadrantes."
    >
      <svg
        className="nr1__dispersao"
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label={`Pressão por apoio: ${pontos
          .map(
            (p) =>
              `${p.nome}, ${QUADRANTES[quadranteDe(p.pressao, p.recursos)!].rotulo}, ${plural(p.respostas, "resposta", "respostas")}, ${porcento(p.risco)} em risco`,
          )
          .join("; ")}`}
      >
        <rect
          x={x(ex[0])}
          y={y(ey[1])}
          width={meioX - x(ex[0])}
          height={meioY - y(ey[1])}
          className="nr1__quadrante-alerta"
        />
        {marcasDoEixo(ex).map((v) => (
          <text
            key={`x${v}`}
            x={x(v)}
            y={A - m.b + 14}
            textAnchor="middle"
            className="nr1__marca-eixo"
          >
            {decimal(v)}
          </text>
        ))}
        {marcasDoEixo(ey).map((v) => (
          <text
            key={`y${v}`}
            x={m.e - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="nr1__marca-eixo"
          >
            {decimal(v)}
          </text>
        ))}
        <line
          x1={meioX}
          y1={y(ey[1])}
          x2={meioX}
          y2={y(ey[0])}
          className="nr1__eixo"
        />
        <line
          x1={x(ex[0])}
          y1={meioY}
          x2={x(ex[1])}
          y2={meioY}
          className="nr1__eixo"
        />
        <line
          x1={x(ex[0])}
          y1={y(ey[0])}
          x2={x(ex[1])}
          y2={y(ey[0])}
          className="nr1__eixo"
        />
        <line
          x1={x(ex[0])}
          y1={y(ey[0])}
          x2={x(ex[0])}
          y2={y(ey[1])}
          className="nr1__eixo"
        />
        <text
          x={x(ex[0]) + 4}
          y={y(ey[1]) + 12}
          className="nr1__rotulo-quadrante"
        >
          Alta tensão
        </text>
        <text
          x={x(ex[1]) - 4}
          y={y(ey[1]) + 12}
          textAnchor="end"
          className="nr1__rotulo-quadrante"
        >
          Trabalho ativo
        </text>
        <text
          x={x(ex[0]) + 4}
          y={y(ey[0]) - 6}
          className="nr1__rotulo-quadrante"
        >
          Passivo
        </text>
        <text
          x={x(ex[1]) - 4}
          y={y(ey[0]) - 6}
          textAnchor="end"
          className="nr1__rotulo-quadrante"
        >
          Baixa tensão
        </text>
        <text
          x={(x(ex[0]) + x(ex[1])) / 2}
          y={A - 8}
          textAnchor="middle"
          className="nr1__rotulo-eixo"
        >
          Apoio (recursos) →
        </text>
        <text
          x={14}
          y={(y(ey[0]) + y(ey[1])) / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(y(ey[0]) + y(ey[1])) / 2})`}
          className="nr1__rotulo-eixo"
        >
          Pressão (exigências) →
        </text>
        {pontos.map((p) => {
          const r = raioDaBolha(p.respostas, maior);
          return (
            <g key={p.id} data-grupo={p.nome}>
              <circle
                cx={x(p.recursos)}
                cy={y(p.pressao)}
                r={r}
                fill={corDoRisco(p.risco)}
                className={
                  p.id === "empresa"
                    ? "nr1__bolha nr1__bolha-empresa"
                    : "nr1__bolha"
                }
              />
              <text
                x={x(p.recursos) + r + 3}
                y={y(p.pressao) + 4}
                className="nr1__rotulo-ponto"
              >
                {p.nome.length > 16 ? `${p.nome.slice(0, 15)}…` : p.nome}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="nr1__legenda-bolhas" aria-label="Legenda do gráfico">
        <li>
          <span className="nr1__legenda-tamanho" aria-hidden="true">
            <span />
            <span />
          </span>
          Tamanho da bolha: respostas
        </li>
        <li>
          <span className="nr1__legenda-cor" aria-hidden="true" />
          Cor: % do time em risco (de 0% a 100%)
        </li>
        <li>
          <span className="nr1__legenda-empresa" aria-hidden="true" />
          Contorno escuro: toda a empresa
        </li>
      </ul>
      <div className="modelos__tabela-rolagem">
        <table className="modelos__tabela">
          <thead>
            <tr>
              <th>{`${rotuloDoCampo.charAt(0).toUpperCase()}${rotuloDoCampo.slice(1)}`}</th>
              <th className="modelos__num">Respostas</th>
              <th className="modelos__num">Pressão</th>
              <th className="modelos__num">Apoio</th>
              <th className="modelos__num">% em risco</th>
              <th>Quadrante</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => {
              const q = quadranteDe(p.pressao, p.recursos)!;
              return (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td className="modelos__num">{p.respostas}</td>
                  <td className="modelos__num">{decimal(p.pressao, 2)}</td>
                  <td className="modelos__num">{decimal(p.recursos, 2)}</td>
                  <td className="modelos__num">{porcento(p.risco)}</td>
                  <td>
                    <strong>{QUADRANTES[q].rotulo}</strong>
                    <span className="modelos__rotulo">
                      {QUADRANTES[q].texto}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CartaoDeSecao>
  );
}
