/**
 * T216 — Riscos psicossociais (NR-1): Plano de ação e Conformidade.
 *
 * O plano é escrito pelo RH (sem sugestão automática): por dimensão,
 * medidas com o controle na ordem de prioridade da NR-1, responsável,
 * prazo, indicador e situação. A conformidade lista as 7 etapas: as duas
 * primeiras concluem sozinhas; nas outras, a empresa marca os itens,
 * descreve onde guardou as evidências e conclui. Tudo é gravado junto
 * (`PUT /pesquisas/:id/modelo/acompanhamento`).
 */
import { useEffect, useId, useMemo, useState } from "react";
import type {
  AcompanhamentoNr1,
  AcompanhamentoNr1Entrada,
  ControleNr1,
  MedidaDoPlano,
  ResultadoNr1,
  ServicoDosModelos,
  SituacaoDaMedida,
} from "../../../../api/modelosDePesquisaClient";
import { Button } from "../../../../components";
import { formatarDiaCivil, formatarInstante } from "../../../../format/data";
import { plural } from "../../../../format/plural";
import { CartaoDeSecao } from "../../componentes";
import { novoId } from "../../textosDasPesquisas";
import { SeloDoNivel } from "../ui";
import { DIMENSOES_NR1, dimensaoNr1 } from "./definicao";
import {
  CONTROLES,
  ETAPAS_DA_CONFORMIDADE,
  NIVEIS,
  NIVEL,
  ROTULO_DA_SITUACAO,
} from "./textos";
import { legendaDaDimensao } from "./VisaoGeralNr1";

export function entradaDoAcompanhamento(
  a: AcompanhamentoNr1,
): AcompanhamentoNr1Entrada {
  return {
    etapas: a.etapas
      .filter((e) => !e.automatica)
      .map((e) => ({
        id: e.id,
        itens: e.itens,
        evidencias: e.evidencias,
        concluida: e.concluidaEm !== null,
      })),
    plano: a.plano,
    profissionalSst: a.profissionalSst,
  };
}

/** Carrega e grava o acompanhamento (estado local até salvar). */
export function useAcompanhamentoNr1(
  servico: ServicoDosModelos,
  pesquisaId: string,
  /** Só a NR-1 tem acompanhamento. */
  ativo = true,
) {
  const [gravado, setGravado] = useState<AcompanhamentoNr1 | null>(null);
  const [rascunho, setRascunho] = useState<AcompanhamentoNr1Entrada | null>(
    null,
  );
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    Promise.resolve(servico.acompanhamentoNr1(pesquisaId))
      .then((a) => {
        if (!vivo) return;
        setGravado(a);
        setRascunho(entradaDoAcompanhamento(a));
      })
      .catch(() => {
        if (vivo) setFalha("Não foi possível carregar o acompanhamento.");
      });
    return () => {
      vivo = false;
    };
  }, [servico, pesquisaId, ativo]);
  const pendente =
    gravado !== null &&
    rascunho !== null &&
    JSON.stringify(entradaDoAcompanhamento(gravado)) !==
      JSON.stringify(rascunho);
  async function salvar(entrada = rascunho): Promise<boolean> {
    if (!entrada) return false;
    setSalvando(true);
    try {
      const a = await servico.gravarAcompanhamentoNr1(pesquisaId, entrada);
      setGravado(a);
      setRascunho(entradaDoAcompanhamento(a));
      setFalha(null);
      return true;
    } catch (erro) {
      const status = (erro as { status?: unknown } | null)?.status;
      setFalha(
        status === 422
          ? "Revise os campos: algum ficou vazio ou longo demais."
          : "Não foi possível salvar. Tente de novo.",
      );
      return false;
    } finally {
      setSalvando(false);
    }
  }
  return { gravado, rascunho, setRascunho, pendente, salvando, falha, salvar };
}

type Acompanhamento = ReturnType<typeof useAcompanhamentoNr1>;

function medidaNova(dimensaoId: string): MedidaDoPlano {
  return {
    id: novoId()
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 40),
    dimensaoId,
    titulo: "",
    descricao: null,
    controle: "administrativo",
    responsavel: null,
    prazo: null,
    indicador: null,
    situacao: "planejada",
  };
}

const vazioParaNulo = (t: string) => (t.trim() ? t : null);

export function PlanoDeAcaoNr1({
  r,
  acompanhamento: a,
  podeEditar,
}: {
  readonly r: ResultadoNr1;
  readonly acompanhamento: Acompanhamento;
  readonly podeEditar: boolean;
}) {
  const ids = useId();
  const porId = useMemo(() => new Map(r.dimensoes.map((d) => [d.id, d])), [r]);
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<string>(
    r.prioridades[0] ?? DIMENSOES_NR1[0]!.id,
  );
  const plano = a.rascunho?.plano ?? [];
  const mudarPlano = (novo: MedidaDoPlano[]) =>
    a.setRascunho((x) => (x ? { ...x, plano: novo } : x));
  const mudarMedida = (id: string, m: Partial<MedidaDoPlano>) =>
    mudarPlano(plano.map((x) => (x.id === id ? { ...x, ...m } : x)));

  if (!a.rascunho) {
    return (
      <p className="pesquisas__suave">{a.falha ?? "Carregando o plano…"}</p>
    );
  }
  const visiveis = r.prioridades.filter((id) =>
    dimensaoNr1(id).rotulo.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const daDimensao = plano.filter((m) => m.dimensaoId === escolhida);
  const d = porId.get(escolhida);
  const dim = dimensaoNr1(escolhida);
  const contagem = {
    medidas: plano.length,
    critico: r.niveis.critico,
    alto: r.niveis.alto,
    medio: r.niveis.medio,
  };

  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Plano de ação"
        descricao="Medidas por dimensão, na ordem de controles da NR-1, com responsável, prazo e indicador."
        acao={
          podeEditar ? (
            <Button
              disabled={!a.pendente || a.salvando}
              onClick={() => void a.salvar()}
            >
              {a.salvando ? "Salvando…" : "Salvar plano"}
            </Button>
          ) : null
        }
      >
        <div className="modelos__grade">
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Medidas no plano</span>
            <strong className="modelos__mini-valor">{contagem.medidas}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Dimensões críticas</span>
            <strong className="modelos__mini-valor">{contagem.critico}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Em nível alto</span>
            <strong className="modelos__mini-valor">{contagem.alto}</strong>
          </div>
          <div className="modelos__mini">
            <span className="modelos__mini-titulo">Em nível médio</span>
            <strong className="modelos__mini-valor">{contagem.medio}</strong>
          </div>
        </div>
        <p className="pesquisas__nota" role="note">
          O plano é responsabilidade da empresa: revise, date e valide as
          medidas com o profissional de SST (e, quando couber, psicólogo ou
          médico do trabalho) antes de levá-lo ao PGR.
        </p>
        {a.falha ? (
          <p className="pesquisas__erro" role="alert">
            {a.falha}
          </p>
        ) : null}
        {a.gravado?.atualizadoEm ? (
          <p className="pesquisas__suave">{`Atualizado em ${formatarInstante(a.gravado.atualizadoEm)}`}</p>
        ) : null}
      </CartaoDeSecao>

      <div className="modelos__mestre-detalhe">
        <nav aria-label="Dimensões do plano">
          <input
            className="pesquisas__campo"
            type="search"
            placeholder="Buscar dimensão"
            aria-label="Buscar dimensão"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {NIVEIS.map((n) => {
            const lista = visiveis.filter((id) => porId.get(id)?.nivel === n);
            if (!lista.length) return null;
            return (
              <div key={n}>
                <p className="modelos__grupo-titulo">{`${NIVEL[n].rotulo} · ${lista.length}`}</p>
                <ul className="modelos__lista-dimensoes">
                  {lista.map((id) => {
                    const qtd = plano.filter((m) => m.dimensaoId === id).length;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className="modelos__item-dimensao"
                          aria-current={id === escolhida ? "true" : undefined}
                          onClick={() => setEscolhida(id)}
                        >
                          <span>{dimensaoNr1(id).rotulo}</span>
                          <span className="pesquisas__suave">
                            {plural(qtd, "medida", "medidas")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <section
          className="modelos__cartao"
          aria-label={`Medidas de ${dim.rotulo}`}
        >
          <div className="modelos__cartao-topo">
            <h3>{dim.rotulo}</h3>
            <SeloDoNivel nivel={d?.nivel ?? null} />
          </div>
          <span className="pesquisas__suave">{`${legendaDaDimensao(escolhida)} · ${plural(daDimensao.length, "medida", "medidas")}`}</span>
          <p className="pesquisas__suave">{dim.definicao}</p>
          <span className="modelos__rotulo">Ordem de prioridade da NR-1</span>
          <ol className="modelos__regua-controles">
            {CONTROLES.map((c, i) => (
              <li key={c.id}>
                <strong>{`${i + 1} ${c.rotulo}`}</strong>
                <span className="modelos__rotulo">{c.texto}</span>
              </li>
            ))}
          </ol>
          {daDimensao.map((m, i) => {
            const base = `${ids}-${m.id}`;
            return (
              <fieldset
                key={m.id}
                className="modelos__medida"
                disabled={!podeEditar}
              >
                <legend className="pesquisas__suave">{`Medida ${i + 1}`}</legend>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-t`}
                >
                  O que fazer
                  <input
                    id={`${base}-t`}
                    className="pesquisas__campo"
                    maxLength={200}
                    value={m.titulo}
                    onChange={(e) =>
                      mudarMedida(m.id, { titulo: e.target.value })
                    }
                  />
                </label>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-d`}
                >
                  Como (opcional)
                  <textarea
                    id={`${base}-d`}
                    className="pesquisas__campo"
                    maxLength={1000}
                    value={m.descricao ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        descricao: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-c`}>
                  Controle
                  <select
                    id={`${base}-c`}
                    className="pesquisas__campo"
                    value={m.controle}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        controle: e.target.value as ControleNr1,
                      })
                    }
                  >
                    {CONTROLES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="modelos__campo" htmlFor={`${base}-r`}>
                  Responsável
                  <input
                    id={`${base}-r`}
                    className="pesquisas__campo"
                    maxLength={120}
                    value={m.responsavel ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        responsavel: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-p`}>
                  Prazo
                  <input
                    id={`${base}-p`}
                    type="date"
                    className="pesquisas__campo"
                    value={m.prazo ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, { prazo: e.target.value || null })
                    }
                  />
                </label>
                <label className="modelos__campo" htmlFor={`${base}-s`}>
                  Situação
                  <select
                    id={`${base}-s`}
                    className="pesquisas__campo"
                    value={m.situacao}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        situacao: e.target.value as SituacaoDaMedida,
                      })
                    }
                  >
                    {(
                      Object.keys(ROTULO_DA_SITUACAO) as SituacaoDaMedida[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_DA_SITUACAO[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="modelos__campo modelos__medida-largo"
                  htmlFor={`${base}-i`}
                >
                  Indicador de acompanhamento
                  <input
                    id={`${base}-i`}
                    className="pesquisas__campo"
                    maxLength={300}
                    value={m.indicador ?? ""}
                    onChange={(e) =>
                      mudarMedida(m.id, {
                        indicador: vazioParaNulo(e.target.value),
                      })
                    }
                  />
                </label>
                {podeEditar ? (
                  <div className="modelos__acoes modelos__medida-largo">
                    <Button
                      variant="subtle"
                      onClick={() =>
                        mudarPlano(plano.filter((x) => x.id !== m.id))
                      }
                    >
                      Excluir medida
                    </Button>
                  </div>
                ) : null}
              </fieldset>
            );
          })}
          {podeEditar ? (
            <div>
              <Button
                variant="secondary"
                onClick={() => mudarPlano([...plano, medidaNova(escolhida)])}
              >
                + Adicionar medida
              </Button>
            </div>
          ) : daDimensao.length === 0 ? (
            <p className="pesquisas__suave">
              Nenhuma medida para esta dimensão.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

/** Anel de progresso das etapas ("2/7"). */
function Anel({
  feitas,
  total,
}: {
  readonly feitas: number;
  readonly total: number;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className="modelos__anel"
      viewBox="0 0 56 56"
      width={56}
      height={56}
      role="img"
      aria-label={`${feitas} de ${total} etapas concluídas`}
    >
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="var(--surface-neutral)"
        strokeWidth={6}
      />
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke="var(--color-action)"
        strokeWidth={6}
        strokeDasharray={`${(c * feitas) / total} ${c}`}
        transform="rotate(-90 28 28)"
        strokeLinecap="round"
      />
      <text
        x={28}
        y={32}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill="var(--color-ink)"
      >{`${feitas}/${total}`}</text>
    </svg>
  );
}

export function ConformidadeNr1({
  acompanhamento: a,
  podeEditar,
  onVerResultados,
  onVerPlano,
}: {
  readonly acompanhamento: Acompanhamento;
  readonly podeEditar: boolean;
  readonly onVerResultados?: () => void;
  readonly onVerPlano?: () => void;
}) {
  const ids = useId();
  if (!a.gravado || !a.rascunho) {
    return (
      <p className="pesquisas__suave">
        {a.falha ?? "Carregando a conformidade…"}
      </p>
    );
  }
  const g = a.gravado;
  const rascunho = a.rascunho;
  const etapaDoRascunho = (id: string) =>
    rascunho.etapas.find((e) => e.id === id);
  const mudarEtapa = (
    id: string,
    m: Partial<AcompanhamentoNr1Entrada["etapas"][number]>,
  ) =>
    a.setRascunho((x) =>
      x
        ? {
            ...x,
            etapas: x.etapas.map((e) => (e.id === id ? { ...e, ...m } : e)),
          }
        : x,
    );
  const proxima = ETAPAS_DA_CONFORMIDADE.find((e) => e.id === g.proxima);

  return (
    <div className="modelos">
      <CartaoDeSecao
        titulo="Conformidade com a NR-1"
        descricao={`${g.concluidas} de 7 etapas concluídas${proxima ? ` · próxima: ${proxima.titulo}` : ""}`}
        acao={<Anel feitas={g.concluidas} total={7} />}
      >
        {a.falha ? (
          <p className="pesquisas__erro" role="alert">
            {a.falha}
          </p>
        ) : null}
        <ol className="modelos__lista-dimensoes">
          {ETAPAS_DA_CONFORMIDADE.map((def, i) => {
            const e = g.etapas.find((x) => x.id === def.id)!;
            const r = etapaDoRascunho(def.id);
            const marcouAlgo = r
              ? r.itens.some(Boolean) || Boolean(r.evidencias?.trim())
              : false;
            return (
              <li
                key={def.id}
                className="modelos__etapa"
                {...(e.concluida ? { "data-concluida": "" } : {})}
              >
                <span className="modelos__etapa-numero" aria-hidden="true">
                  {e.concluida ? "✓" : i + 1}
                </span>
                <div>
                  <div className="modelos__cartao-topo">
                    <strong>{def.titulo}</strong>
                    <span
                      className={`pesquisas__selo${e.concluida ? " pesquisas__selo--sucesso" : ""}`}
                    >
                      {e.concluida
                        ? e.concluidaEm
                          ? `Concluída em ${formatarInstante(e.concluidaEm).slice(0, 10)}`
                          : "Concluída"
                        : def.id === "revisar" && g.revisarEm
                          ? `Prevista para ${formatarDiaCivil(`${g.revisarEm}-01`).slice(3)}`
                          : "Pendente"}
                    </span>
                  </div>
                  <p className="pesquisas__suave">{def.texto}</p>
                  {e.automatica ? (
                    <Button
                      variant="subtle"
                      onClick={
                        def.id === "mapear" ? onVerResultados : onVerPlano
                      }
                    >
                      {def.id === "mapear"
                        ? "Ver resultados da pesquisa"
                        : "Ver plano de ação"}
                    </Button>
                  ) : r ? (
                    <>
                      <ul className="modelos__checklist">
                        {def.itens.map((t, j) => (
                          <li key={t}>
                            <label>
                              <input
                                type="checkbox"
                                checked={r.itens[j] ?? false}
                                disabled={!podeEditar}
                                onChange={(ev) =>
                                  mudarEtapa(def.id, {
                                    itens: r.itens.map((v, k) =>
                                      k === j ? ev.target.checked : v,
                                    ),
                                  })
                                }
                              />
                              {t}
                            </label>
                          </li>
                        ))}
                      </ul>
                      <label
                        className="modelos__campo"
                        htmlFor={`${ids}-${def.id}`}
                      >
                        {`Evidências guardadas (${def.evidencias ?? "documentos"}): o que e onde`}
                        <textarea
                          id={`${ids}-${def.id}`}
                          className="pesquisas__campo"
                          maxLength={2000}
                          disabled={!podeEditar}
                          value={r.evidencias ?? ""}
                          onChange={(ev) =>
                            mudarEtapa(def.id, {
                              evidencias: ev.target.value.trim()
                                ? ev.target.value
                                : null,
                            })
                          }
                        />
                      </label>
                      {podeEditar ? (
                        <div className="modelos__acoes">
                          <Button
                            variant={r.concluida ? "secondary" : "primary"}
                            disabled={
                              a.salvando || (!r.concluida && !marcouAlgo)
                            }
                            onClick={() => {
                              const etapas = rascunho.etapas.map((x) =>
                                x.id === def.id
                                  ? { ...x, concluida: !r.concluida }
                                  : x,
                              );
                              void a.salvar({ ...rascunho, etapas });
                            }}
                          >
                            {r.concluida ? "Reabrir etapa" : "Concluir etapa"}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CartaoDeSecao>

      <CartaoDeSecao
        titulo="Profissional de SST"
        descricao="Quem valida o inventário e o plano (aparece no relatório para assinatura)."
        acao={
          podeEditar ? (
            <Button
              disabled={!a.pendente || a.salvando}
              onClick={() => void a.salvar()}
            >
              {a.salvando ? "Salvando…" : "Salvar"}
            </Button>
          ) : null
        }
      >
        <div className="modelos__par">
          <label className="modelos__campo" htmlFor={`${ids}-sst-nome`}>
            Nome
            <input
              id={`${ids}-sst-nome`}
              className="pesquisas__campo"
              maxLength={120}
              disabled={!podeEditar}
              value={rascunho.profissionalSst.nome ?? ""}
              onChange={(e) =>
                a.setRascunho((x) =>
                  x
                    ? {
                        ...x,
                        profissionalSst: {
                          ...x.profissionalSst,
                          nome: e.target.value || null,
                        },
                      }
                    : x,
                )
              }
            />
          </label>
          <label className="modelos__campo" htmlFor={`${ids}-sst-registro`}>
            Registro profissional
            <input
              id={`${ids}-sst-registro`}
              className="pesquisas__campo"
              maxLength={60}
              disabled={!podeEditar}
              value={rascunho.profissionalSst.registro ?? ""}
              onChange={(e) =>
                a.setRascunho((x) =>
                  x
                    ? {
                        ...x,
                        profissionalSst: {
                          ...x.profissionalSst,
                          registro: e.target.value || null,
                        },
                      }
                    : x,
                )
              }
            />
          </label>
        </div>
      </CartaoDeSecao>
    </div>
  );
}
