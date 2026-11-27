/**
 * T215 — "Planejar a transição" da EC 141/2026 (sub-página do quadro), no
 * desenho da referência: quem está em 6x1 quando a transição começa, o
 * caminho (passar para 5x2, manter 6x1 com convenção ou outra escala), o
 * horário (8h24 por dia para 42 h, ou 8 h por dia e já 40 h) e as pessoas.
 *
 * Diferença assumida: no Evolli o padrão de escala de cada pessoa muda na
 * data da transição (aba Escala da ficha); o quadro mostra o novo padrão nos
 * dias sem alocação própria. Benefícios por dia ainda não existem no Evolli.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type PessoaDoQuadroApi,
  type RegrasDaEscalaApi,
  consultarQuadro,
  consultarRegras,
  definirEscala,
  salvarRegras,
} from "../../../api/escalaClient";
import {
  criarTabelaHorario,
  listarTabelasHorario,
  type PeriodoInputDto,
  type TabelaHorarioApi,
} from "../../../api/horariosClient";
import { Button } from "../../../ui";
import { IconeVoltar } from "../../../ui/icones";
import { Esqueleto, Revelar } from "../../../ui/movimento";
import { diaMesCurto, formatarDiaCivil } from "../../../format/data";
import { plural } from "../../../format/plural";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import { escalaDoDia } from "../../pessoas/ficha/escala/diaDaEscala";
import {
  MODELOS_DE_ESCALA,
  modeloDe,
  temCiclo,
} from "../../pessoas/ficha/escala/modelosDeEscala";
import { pessoasEm6x1NaTransicao } from "./avisosDaEscala";
import { diasDoPeriodo, periodosNoDia } from "./quadroDaEscala";
import "./QuadroDaEscalaScreen.css";

export const TRANSICAO_TITULO_ID = "transicao-escala-titulo";

type Caminho = "5x2" | "convencao" | "outra";
type Horario = "8h24" | "8h";

const DIAS_UTEIS = ["segunda", "terca", "quarta", "quinta", "sexta"] as const;

function somarMinutos(hora: string, n: number): string {
  const [h, m] = hora.split(":").map(Number);
  const t = ((h ?? 0) * 60 + (m ?? 0) + n + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Os períodos de segunda a sexta com 24 min a mais no fim do dia. */
export function periodosCom8h24(t: TabelaHorarioApi): PeriodoInputDto[] {
  return DIAS_UTEIS.flatMap((dia, i) => {
    const ps = periodosNoDia(
      { ...t, intervaloMinutos: t.intervaloMinutos ?? 0 },
      `2026-11-${String(23 + i).padStart(2, "0")}`,
    );
    return ps.map((p, j) => ({
      dia,
      inicio: p.inicio,
      fim: j === ps.length - 1 ? somarMinutos(p.fim, 24) : p.fim,
    }));
  });
}

export function PlanejarTransicaoScreen({
  onVoltar,
}: {
  readonly onVoltar: () => void;
}) {
  const [regras, setRegras] = useState<RegrasDaEscalaApi | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDoQuadroApi[] | null>(null);
  const [turnos, setTurnos] = useState<TabelaHorarioApi[]>([]);
  const [erroCarga, setErroCarga] = useState(false);
  const [caminho, setCaminho] = useState<Caminho>("5x2");
  const [horario, setHorario] = useState<Horario>("8h24");
  const [outroModelo, setOutroModelo] = useState("4x3");
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    tituloRef.current?.focus();
    let vivo = true;
    (async () => {
      try {
        const r = await consultarRegras();
        const fim = somarDias(r.inicioTransicao, 6);
        const [q, ts] = await Promise.all([
          consultarQuadro(r.inicioTransicao, fim),
          listarTabelasHorario({ ativo: true, tamanhoPagina: 100 }),
        ]);
        if (!vivo) return;
        const em6x1 = pessoasEm6x1NaTransicao(
          q.pessoas,
          diasDoPeriodo(r.inicioTransicao, fim),
          { ...r, convencao: { ...r.convencao, "6x1_autorizada": false } },
        );
        setRegras(r);
        setTurnos(ts.itens);
        setPessoas(em6x1);
        setMarcadas(new Set(em6x1.map((p) => p.colaboradorId)));
      } catch {
        if (vivo) setErroCarga(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const transicao = regras?.inicioTransicao ?? "";
  const turnoDe = (p: PessoaDoQuadroApi) =>
    escalaDoDia(p.escalas, transicao)?.turno ?? null;

  // Os turnos de hoje e o que vira cada um a partir da transição.
  const grupos = useMemo(() => {
    const m = new Map<
      string,
      {
        nome: string;
        faixa: string;
        pessoas: number;
        turno: TabelaHorarioApi | null;
      }
    >();
    for (const p of pessoas ?? []) {
      const t = turnoDe(p);
      const chave = t?.id ?? "";
      const completo = turnos.find((x) => x.id === t?.id) ?? null;
      const ps = completo
        ? periodosNoDia(
            { ...completo, intervaloMinutos: completo.intervaloMinutos ?? 0 },
            "2026-11-23",
          )
        : [];
      const atual = m.get(chave) ?? {
        nome: t?.nome ?? "Sem turno fixo",
        faixa: ps.length ? `${ps[0]!.inicio}–${ps[ps.length - 1]!.fim}` : "",
        pessoas: 0,
        turno: completo,
      };
      atual.pessoas += 1;
      m.set(chave, atual);
    }
    return [...m.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, turnos, transicao]);

  const modeloNovo = caminho === "5x2" ? "5x2" : outroModelo;
  const rotuloDoNovoTurno = (g: (typeof grupos)[number]) =>
    !g.turno
      ? "Sem turno fixo"
      : horario === "8h24" && caminho === "5x2"
        ? `${g.nome} 8h24 ${g.faixa.split("–")[0]}–${somarMinutos(g.faixa.split("–")[1] ?? "", 24)} (novo turno)`
        : `${g.nome} ${g.faixa}`;

  const aplicar = async () => {
    if (!regras || !pessoas) return;
    setEnviando(true);
    setErro(null);
    setResultado(null);
    try {
      if (caminho === "convencao") {
        await salvarRegras({
          inicioTransicao: regras.personalizadas
            ? regras.inicioTransicao
            : null,
          semanaComeca: regras.semanaComeca,
          convencao: { ...regras.convencao, "6x1_autorizada": true },
          avisos: regras.avisos,
          antecedenciaDias: regras.antecedenciaDias,
          avisarPadrao: regras.avisarPadrao,
        });
        setResultado(
          "A 6x1 ficou autorizada por convenção nas Regras. Os avisos da 6x1 deixam de aparecer.",
        );
        return;
      }
      // Turnos de 8h24 (um por turno de hoje), reaproveitando o que já existe.
      const novos = new Map<string, string>();
      if (caminho === "5x2" && horario === "8h24") {
        for (const g of grupos) {
          if (!g.turno) continue;
          const nome = `${g.turno.nome} 8h24`.slice(0, 120);
          const existente = turnos.find((t) => t.nome === nome);
          const criado =
            existente ??
            (await criarTabelaHorario({
              nome,
              periodos: periodosCom8h24(g.turno),
              modo: "por_dia",
              intervaloMinutos: g.turno.intervaloMinutos ?? 0,
              ...(g.turno.cor ? { cor: g.turno.cor } : {}),
            }));
          novos.set(g.turno.id, criado.id);
        }
      }
      const falhas: string[] = [];
      let feitas = 0;
      for (const p of pessoas.filter((x) => marcadas.has(x.colaboradorId))) {
        const atual = turnoDe(p);
        try {
          await definirEscala(p.colaboradorId, {
            modelo: modeloNovo,
            tabelaHorarioId: atual ? (novos.get(atual.id) ?? atual.id) : null,
            vigenciaInicio: transicao,
            ...(temCiclo(modeloNovo) ? { inicioCiclo: transicao } : {}),
          });
          feitas += 1;
        } catch {
          falhas.push(p.nome);
        }
      }
      setResultado(
        `${plural(feitas, "pessoa passa", "pessoas passam")} para ${modeloDe(modeloNovo)?.nome ?? modeloNovo} a partir de ${formatarDiaCivil(transicao)}.` +
          (falhas.length > 0
            ? ` Não foi possível mudar: ${falhas.join(", ")} (confira a aba Escala da ficha).`
            : ""),
      );
    } catch {
      setErro("Não foi possível aplicar a transição. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const qtd = marcadas.size;

  return (
    <Revelar>
      <section className="regras" aria-labelledby={TRANSICAO_TITULO_ID}>
        <header className="quadro__cabeca">
          <button
            type="button"
            className="quadro__icone-botao"
            aria-label="Voltar para a escala"
            onClick={onVoltar}
          >
            <IconeVoltar tamanho={18} />
          </button>
          <div className="quadro__cabeca-textos">
            <h1
              id={TRANSICAO_TITULO_ID}
              ref={tituloRef}
              tabIndex={-1}
              className="quadro__titulo"
            >
              Planejar a transição
            </h1>
            <p className="quadro__subtitulo">
              {regras
                ? `EC 141/2026 · vale a partir de ${formatarDiaCivil(transicao)}`
                : "EC 141/2026"}
            </p>
          </div>
        </header>

        {erroCarga ? (
          <p role="alert" className="quadro__falha">
            Não foi possível carregar quem está em 6x1 na transição.
          </p>
        ) : !regras || !pessoas ? (
          <Esqueleto rotulo="Carregando a transição…" linhas={5} />
        ) : (
          <>
            <dl className="transicao__indicadores">
              <div>
                <dt>Pessoas em 6x1</dt>
                <dd>{pessoas.length}</dd>
                <small>na empresa ativa</small>
              </div>
              <div>
                <dt>Horas por semana</dt>
                <dd>44 h → 42 h</dd>
                <small>{`até ${formatarDiaCivil(somarDias(`${Number(transicao.slice(0, 4)) + 1}${transicao.slice(4)}`, -1))}; depois 40 h`}</small>
              </div>
            </dl>

            {pessoas.length === 0 ? (
              <p className="dialogo-massa__ajuda">
                Ninguém está em 6x1 na transição. Nada a planejar.
              </p>
            ) : (
              <>
                <section
                  className="regras__bloco"
                  aria-labelledby="transicao-caminho"
                >
                  <h2 id="transicao-caminho" className="regras__titulo">
                    1. Caminho
                  </h2>
                  <p className="regras__texto">
                    Vale para as pessoas marcadas na lista abaixo.
                  </p>
                  {(
                    [
                      [
                        "5x2",
                        "Passar para 5x2",
                        `Aplica o modelo 5x2 a partir de ${diaMesCurto(transicao)}, com sábado e domingo de folga.`,
                      ],
                      [
                        "convencao",
                        "Manter 6x1 com convenção",
                        "Marca nas regras que a convenção autoriza. Os avisos deixam de aparecer.",
                      ],
                      [
                        "outra",
                        "Outra escala",
                        "Escolher outra no catálogo, como 4x3 ou 12x36.",
                      ],
                    ] as const
                  ).map(([v, r, a]) => (
                    <label key={v} className="dialogo-massa__opcao">
                      <input
                        type="radio"
                        name="transicao-caminho"
                        checked={caminho === v}
                        onChange={() => setCaminho(v)}
                      />
                      <span>
                        <strong>{r}</strong>
                        <small>{a}</small>
                      </span>
                    </label>
                  ))}
                  {caminho === "outra" ? (
                    <label className="painel-dia__campo">
                      <span>Escala</span>
                      <select
                        value={outroModelo}
                        onChange={(e) => setOutroModelo(e.target.value)}
                      >
                        {MODELOS_DE_ESCALA.filter(
                          (m) => m.codigo !== "6x1" && m.tipo !== "outra",
                        ).map((m) => (
                          <option key={m.codigo} value={m.codigo}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </section>

                {caminho === "5x2" ? (
                  <section
                    className="regras__bloco"
                    aria-labelledby="transicao-horario"
                  >
                    <h2 id="transicao-horario" className="regras__titulo">
                      2. Horário
                    </h2>
                    <p className="regras__texto">
                      Com 5x2 e 42 h, cada dia passa a ter 8h24. Você pode
                      manter 8 h por dia e já ficar com 40 h.
                    </p>
                    {(
                      [
                        [
                          "8h24",
                          "8h24 por dia (42 h)",
                          "Cria um turno com 24 min a mais no fim do dia, de segunda a sexta.",
                        ],
                        [
                          "8h",
                          "8 h por dia (40 h)",
                          `Mantém o turno de hoje. Já cumpre a regra de ${formatarDiaCivil(`${Number(transicao.slice(0, 4)) + 1}${transicao.slice(4)}`)}.`,
                        ],
                      ] as const
                    ).map(([v, r, a]) => (
                      <label key={v} className="dialogo-massa__opcao">
                        <input
                          type="radio"
                          name="transicao-horario"
                          checked={horario === v}
                          onChange={() => setHorario(v)}
                        />
                        <span>
                          <strong>{r}</strong>
                          <small>{a}</small>
                        </span>
                      </label>
                    ))}
                    {horario === "8h24" ? (
                      <p className="dialogo-massa__ajuda">
                        Mais de 8 h por dia na transição: confira se a convenção
                        amplia a jornada diária (EC 141/2026).
                      </p>
                    ) : null}
                    <table className="regras__tabela">
                      <thead>
                        <tr>
                          <th scope="col">Turno de hoje</th>
                          <th scope="col">{`A partir de ${diaMesCurto(transicao)}`}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map((g) => (
                          <tr key={g.nome}>
                            <td>{`${g.nome} ${g.faixa} · ${plural(g.pessoas, "pessoa", "pessoas")}`}</td>
                            <td>{rotuloDoNovoTurno(g)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ) : null}

                {caminho !== "convencao" ? (
                  <section
                    className="regras__bloco"
                    aria-labelledby="transicao-pessoas"
                  >
                    <h2 id="transicao-pessoas" className="regras__titulo">
                      {caminho === "5x2" ? "3. Pessoas" : "2. Pessoas"}
                    </h2>
                    <p className="regras__texto">
                      {`${plural(pessoas.length, "pessoa", "pessoas")} em 6x1. Desmarque quem a convenção mantém em 6x1.`}
                    </p>
                    <table className="regras__tabela">
                      <thead>
                        <tr>
                          <th scope="col">
                            <input
                              type="checkbox"
                              aria-label="Marcar todas as pessoas"
                              checked={qtd === pessoas.length}
                              onChange={() =>
                                setMarcadas(
                                  qtd === pessoas.length
                                    ? new Set()
                                    : new Set(
                                        pessoas.map((p) => p.colaboradorId),
                                      ),
                                )
                              }
                            />
                          </th>
                          <th scope="col">Colaborador</th>
                          <th scope="col">Unidade</th>
                          <th scope="col">Hoje</th>
                          <th scope="col">{`A partir de ${diaMesCurto(transicao)}`}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pessoas.map((p) => {
                          const t = turnoDe(p);
                          const g = grupos.find((x) => x.turno?.id === t?.id);
                          return (
                            <tr key={p.colaboradorId}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`Marcar ${p.nome}`}
                                  checked={marcadas.has(p.colaboradorId)}
                                  onChange={() =>
                                    setMarcadas((atual) => {
                                      const n = new Set(atual);
                                      if (n.has(p.colaboradorId))
                                        n.delete(p.colaboradorId);
                                      else n.add(p.colaboradorId);
                                      return n;
                                    })
                                  }
                                />
                              </td>
                              <td>{p.nome}</td>
                              <td>{p.unidade?.nome ?? "—"}</td>
                              <td>{`6x1 · ${t?.nome ?? "sem turno"}`}</td>
                              <td>
                                {`${modeloDe(modeloNovo)?.nome ?? modeloNovo} · ${
                                  g
                                    ? rotuloDoNovoTurno(g)
                                        .replace(" (novo turno)", "")
                                        .replace(
                                          / \d{2}:\d{2}–\d{2}:\d{2}$/,
                                          "",
                                        )
                                    : (t?.nome ?? "sem turno")
                                }`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                ) : null}

                <footer className="regras__rodape">
                  <p className="regras__estado" role="status">
                    {erro ??
                      resultado ??
                      (caminho === "convencao"
                        ? "As Regras passam a autorizar a 6x1 por convenção."
                        : `O padrão de escala de cada pessoa marcada muda em ${formatarDiaCivil(transicao)} (aba Escala da ficha). Benefícios por dia ainda não existem no Evolli.`)}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onVoltar}
                    disabled={enviando}
                  >
                    {resultado ? "Voltar ao quadro" : "Cancelar"}
                  </Button>
                  {!resultado ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={
                        enviando || (caminho !== "convencao" && qtd === 0)
                      }
                      onClick={() => void aplicar()}
                    >
                      {caminho === "convencao"
                        ? "Marcar convenção nas Regras"
                        : `Aplicar a ${plural(qtd, "pessoa", "pessoas")}`}
                    </Button>
                  ) : null}
                </footer>
              </>
            )}
          </>
        )}
      </section>
    </Revelar>
  );
}
