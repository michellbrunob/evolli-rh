/**
 * T216 — etapa "Colaboradores" (quem vai responder): dois cartões de
 * escolha. "Todo o time" mostra avatares, quantas pessoas recebem, de
 * quantos departamentos, a lista completa e uma pílula por departamento.
 * "Escolher pessoas" tem busca, filtros por departamento, centro de custo e
 * área, a barra "N selecionados de M" com "Selecionar todos" e a tabela.
 * Depois de publicar, quem já respondeu não sai da lista.
 */
import { useEffect, useId, useMemo, useState } from "react";
import type { ColaboradorListadoApi } from "../../api/colaboradoresClient";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { ListaDeEscolha, Sheet } from "../../ui";
import { IconeEquipe, IconeFiltrar } from "../../ui/icones";
import {
  Avatar,
  CampoDeBusca,
  PilhaDeAvatares,
  iniciaisDe,
} from "./componentes";
import type { PessoaEscolhida } from "./estadoDaPesquisa";
import type { GruposDaEmpresa, ServicoDePesquisas } from "./servicoDePesquisas";

const TAMANHO = 50;

export function departamentoDe(c: ColaboradorListadoApi): string | null {
  return (
    c.vinculos?.find((v) => v.lotacaoVigente?.departamento)?.lotacaoVigente
      ?.departamento?.nome ?? null
  );
}

function cargoDe(c: ColaboradorListadoApi): string | null {
  return (
    c.vinculos?.find((v) => v.lotacaoVigente?.cargo)?.lotacaoVigente?.cargo
      ?.nome ?? null
  );
}

export function EtapaColaboradores({
  servico,
  todos,
  escolhidos,
  responderam,
  publicada,
  erro,
  onMudar,
  onTotalDoTime,
}: {
  readonly servico: ServicoDePesquisas;
  readonly todos: boolean;
  readonly escolhidos: Readonly<Record<string, PessoaEscolhida>>;
  readonly responderam: readonly string[];
  /** Já publicada para todo o time: não volta a ser lista. */
  readonly publicada: boolean;
  readonly erro: string | undefined;
  readonly onMudar: (mudanca: {
    todos?: boolean;
    escolhidos?: Record<string, PessoaEscolhida>;
  }) => void;
  /** Quantos ativos a empresa tem (para "N pessoas vão receber"). */
  readonly onTotalDoTime?: (n: number) => void;
}) {
  const base = useId();
  const [time, setTime] = useState<readonly ColaboradorListadoApi[] | null>(
    null,
  );
  const [verLista, setVerLista] = useState(false);
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState({
    departamento: "",
    centroCusto: "",
    area: "",
  });
  const [pagina, setPagina] = useState(1);
  const [pessoas, setPessoas] = useState<ColaboradorListadoApi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const [selecionandoTodos, setSelecionandoTodos] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.listarTodosAtivos())
      .then((t) => {
        if (!vivo) return;
        setTime(t ?? []);
        onTotalDoTime?.((t ?? []).length);
      })
      .catch(() => {
        if (vivo) setTime([]);
      });
    Promise.resolve(servico.listarGrupos())
      .then((g) => {
        if (vivo && g) setGrupos(g);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // Carrega uma vez por serviço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico]);

  const consulta = useMemo(
    () => ({
      ...(busca.trim() ? { busca: busca.trim() } : {}),
      ...(filtro.departamento ? { departamentos: [filtro.departamento] } : {}),
      ...(filtro.centroCusto ? { centrosCusto: [filtro.centroCusto] } : {}),
      ...(filtro.area ? { areas: [filtro.area] } : {}),
    }),
    [busca, filtro],
  );

  useEffect(() => {
    if (todos) return;
    let vivo = true;
    setFalhou(false);
    Promise.resolve(
      servico.listarAtivos({ ...consulta, pagina, tamanhoPagina: TAMANHO }),
    )
      .then((r) => {
        if (!vivo) return;
        setTotal(r.total);
        setPessoas((antes) =>
          pagina === 1 ? r.itens : [...(antes ?? []), ...r.itens],
        );
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, todos, consulta, pagina]);

  const qtdEscolhidos = Object.keys(escolhidos).length;
  const respondeu = new Set(responderam);
  const porDepartamento = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of time ?? []) {
      const d = departamentoDe(c) ?? "Sem departamento";
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [time]);
  const departamentosComGente = porDepartamento.filter(
    ([d]) => d !== "Sem departamento",
  ).length;

  function marcar(c: ColaboradorListadoApi, marcado: boolean) {
    const novo = { ...escolhidos };
    if (marcado) novo[c.id] = { nome: c.nome, departamento: departamentoDe(c) };
    else delete novo[c.id];
    onMudar({ escolhidos: novo });
  }

  async function selecionarTodos() {
    setSelecionandoTodos(true);
    try {
      const novo = { ...escolhidos };
      for (let p = 1; ; p += 1) {
        const r = await servico.listarAtivos({
          ...consulta,
          pagina: p,
          tamanhoPagina: 100,
        });
        for (const c of r.itens)
          novo[c.id] = { nome: c.nome, departamento: departamentoDe(c) };
        if (r.itens.length === 0 || p * 100 >= r.total) break;
      }
      onMudar({ escolhidos: novo });
    } finally {
      setSelecionandoTodos(false);
    }
  }

  const filtroLista = (
    campo: keyof typeof filtro,
    rotulo: string,
    opcoes: readonly { id: string; nome: string }[],
  ) => (
    <div className="pesquisas__filtro-lista">
      <label htmlFor={`${base}-${campo}`} className="pesquisas__so-leitor">
        {rotulo}
      </label>
      <ListaDeEscolha
        id={`${base}-${campo}`}
        opcoes={[
          { valor: "", rotulo: `${rotulo}: todos` },
          ...opcoes.map((o) => ({ valor: o.id, rotulo: o.nome })),
        ]}
        valor={filtro[campo]}
        onMudar={(v) => {
          setFiltro((f) => ({ ...f, [campo]: v }));
          setPagina(1);
        }}
      />
    </div>
  );

  const nTime = time?.length ?? null;

  return (
    <div className="pesquisas__etapa">
      <div
        className="pesquisas__escolhas"
        role="radiogroup"
        aria-label="Quem vai responder"
      >
        <label className="pesquisas__escolha">
          <input
            type="radio"
            name={`${base}-quem`}
            checked={todos}
            onChange={() => onMudar({ todos: true })}
          />
          <span className="pesquisas__escolha-icone" aria-hidden="true">
            <IconeEquipe tamanho={18} />
          </span>
          <span className="pesquisas__escolha-textos">
            <strong>Todo o time</strong>
            <span className="pesquisas__suave">
              {nTime === null
                ? "Os colaboradores ativos"
                : `${nTime === 1 ? "O colaborador ativo" : `Os ${nTime} colaboradores ativos`}`}
            </span>
          </span>
        </label>
        <label className="pesquisas__escolha">
          <input
            type="radio"
            name={`${base}-quem`}
            checked={!todos}
            disabled={publicada && todos}
            onChange={() => onMudar({ todos: false })}
          />
          <span className="pesquisas__escolha-icone" aria-hidden="true">
            <IconeFiltrar tamanho={18} />
          </span>
          <span className="pesquisas__escolha-textos">
            <strong>Escolher pessoas</strong>
            <span className="pesquisas__suave">
              {publicada && todos
                ? "Publicada para todo o time, não volta a ser só para algumas pessoas."
                : "Por nome, departamento, centro de custo ou área"}
            </span>
          </span>
        </label>
      </div>

      {erro ? (
        <p className="pesquisas__erro" role="alert">
          {erro}
        </p>
      ) : null}

      {todos ? (
        <div className="pesquisas__time">
          {time === null ? (
            <p className="pesquisas__suave">Contando o time…</p>
          ) : (
            <>
              <div className="pesquisas__time-cabeca">
                <PilhaDeAvatares nomes={time.map((c) => c.nome)} />
                <div>
                  <p className="pesquisas__forte" role="status">
                    {`${plural(time.length, "pessoa vai", "pessoas vão")} receber a pesquisa`}
                  </p>
                  <p className="pesquisas__suave">
                    {`Todos os colaboradores ativos, de ${plural(departamentosComGente, "departamento", "departamentos")}`}
                  </p>
                </div>
                <Button variant="subtle" onClick={() => setVerLista(true)}>
                  Ver lista
                </Button>
              </div>
              <ul
                className="pesquisas__chips"
                aria-label="Pessoas por departamento"
              >
                {porDepartamento.map(([d, n]) => (
                  <li key={d} className="pesquisas__chip">
                    {d}
                    <span className="pesquisas__contagem">{n}</span>
                  </li>
                ))}
              </ul>
              <p className="pesquisas__suave">
                Para deixar alguém de fora, use &quot;Escolher pessoas&quot;.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="pesquisas__filtros">
            <CampoDeBusca
              rotulo="Buscar pessoa"
              valor={busca}
              onMudar={(v) => {
                setBusca(v);
                setPagina(1);
              }}
            />
            {filtroLista(
              "departamento",
              "Departamento",
              grupos?.departamento ?? [],
            )}
            {filtroLista(
              "centroCusto",
              "Centro de custo",
              grupos?.centroCusto ?? [],
            )}
            {filtroLista("area", "Área", grupos?.area ?? [])}
          </div>
          <div className="pesquisas__barra-selecao">
            <span role="status">
              {`${plural(qtdEscolhidos, "selecionado", "selecionados")} de ${plural(total, "colaborador", "colaboradores")}`}
            </span>
            {total > 0 ? (
              <Button
                variant="subtle"
                disabled={selecionandoTodos}
                onClick={() => void selecionarTodos()}
              >
                {`Selecionar todos os ${total}`}
              </Button>
            ) : null}
          </div>
          {falhou ? (
            <p className="pesquisas__erro" role="alert">
              Não foi possível carregar as pessoas. Tente outra busca.
            </p>
          ) : pessoas === null ? (
            <p className="pesquisas__suave">Carregando pessoas…</p>
          ) : pessoas.length === 0 ? (
            <p className="pesquisas__suave">
              Ninguém encontrado com esse filtro.
            </p>
          ) : (
            <div className="pesquisas__tabela-caixa">
              <table
                className="pesquisas__tabela"
                aria-label="Colaboradores ativos"
              >
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="pesquisas__so-leitor">Selecionar</span>
                    </th>
                    <th scope="col">Nome</th>
                    <th scope="col">Departamento</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((c) => {
                    const ja = respondeu.has(c.id);
                    const cargo = cargoDe(c);
                    return (
                      <tr
                        key={c.id}
                        {...(c.id in escolhidos ? { "data-marcada": "" } : {})}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={c.nome}
                            checked={c.id in escolhidos}
                            disabled={ja}
                            onChange={(e) => marcar(c, e.target.checked)}
                          />
                        </td>
                        <td>
                          <span className="pesquisas__pessoa-linha">
                            <Avatar texto={iniciaisDe(c.nome)} />
                            <span className="pesquisas__pessoa-textos">
                              <span>{c.nome}</span>
                              <span className="pesquisas__suave">
                                {[cargo, ja ? "já respondeu" : null]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>{departamentoDe(c) ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pessoas && pessoas.length < total ? (
            <div className="pesquisas__acoes">
              <Button
                variant="secondary"
                onClick={() => setPagina((n) => n + 1)}
              >
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Sheet
        aberto={verLista}
        titulo="Quem vai receber"
        subtitulo={
          nTime === null
            ? ""
            : plural(nTime, "colaborador ativo", "colaboradores ativos")
        }
        onFechar={() => setVerLista(false)}
      >
        <ul className="pesquisas__lista-pessoas">
          {(time ?? []).map((c) => (
            <li key={c.id}>
              <Avatar texto={iniciaisDe(c.nome)} />
              <span className="pesquisas__pessoa-textos">
                <span>{c.nome}</span>
                <span className="pesquisas__suave">
                  {departamentoDe(c) ?? "Sem departamento"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
