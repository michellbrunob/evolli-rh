/**
 * T216 — etapa "Colaboradores" (quem vai responder): dois cartões de
 * escolha. "Todo o time" mostra avatares, quantas pessoas recebem, de
 * quantos departamentos, a lista completa (cargo · departamento) e uma
 * pílula com ponto colorido por departamento. "Escolher pessoas" começa sem
 * ninguém marcado e tem busca, filtros por departamento, centro de custo e
 * unidade (no servidor, `GET /pesquisas/candidatos`), a barra "N
 * selecionados de M" (contada dentro do filtro) com a caixa geral,
 * "Selecionar todos" (sobre o total do filtro, todas as páginas) e
 * "Limpar", e a tabela (Colaborador, Departamento, Centro de custo e
 * Unidade). Depois de publicar, quem já respondeu não sai da lista.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ColaboradorListadoApi } from "../../api/colaboradoresClient";
import type { CandidatoPesquisa } from "../../api/pesquisasClient";
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
import {
  todosOsCandidatos,
  type GruposDaEmpresa,
  type ServicoDePesquisas,
} from "./servicoDePesquisas";

/** A lotação como a listagem a projeta (centro de custo e área, se vierem). */
interface LotacaoLida {
  readonly cargo?: { readonly nome: string } | null;
  readonly departamento?: { readonly nome: string } | null;
  readonly centroCusto?: { readonly nome: string } | null;
  readonly area?: { readonly nome: string } | null;
}

function lotacaoDe(c: ColaboradorListadoApi): LotacaoLida {
  return (c.vinculos?.find((v) => v.lotacaoVigente)?.lotacaoVigente ??
    {}) as LotacaoLida;
}

/** O departamento vigente na listagem de colaboradores (edição da pesquisa). */
export function departamentoDe(c: ColaboradorListadoApi): string | null {
  return lotacaoDe(c).departamento?.nome ?? null;
}

/** Cor do ponto da pílula de um departamento (estável pela ordem). */
const CORES_DOS_GRUPOS = [
  "--turno-azul",
  "--turno-verde",
  "--turno-laranja",
  "--turno-roxo",
  "--turno-ciano",
  "--turno-mostarda",
  "--turno-indigo",
  "--turno-verde-agua",
];

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
  const [time, setTime] = useState<readonly CandidatoPesquisa[] | null>(null);
  const [verLista, setVerLista] = useState(false);
  const [grupos, setGrupos] = useState<GruposDaEmpresa | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState({
    departamento: "",
    centroCusto: "",
    unidade: "",
  });
  const [pessoas, setPessoas] = useState<CandidatoPesquisa[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const geralRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.listarTodosCandidatos())
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
      ...(filtro.departamento ? { departamentoId: filtro.departamento } : {}),
      ...(filtro.centroCusto ? { centroCustoId: filtro.centroCusto } : {}),
      ...(filtro.unidade ? { unidadeId: filtro.unidade } : {}),
    }),
    [busca, filtro],
  );

  // Todo o filtro, página a página no servidor (para contar e marcar
  // dentro dele, e "Selecionar todos" valer para o total).
  useEffect(() => {
    if (todos) return;
    let vivo = true;
    setFalhou(false);
    todosOsCandidatos(
      (q) => Promise.resolve(servico.listarCandidatos(q)),
      consulta,
    )
      .then((lista) => {
        if (vivo) setPessoas(lista);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [servico, todos, consulta]);

  const respondeu = useMemo(() => new Set(responderam), [responderam]);
  const doFiltro = pessoas ?? [];
  const marcadosNoFiltro = doFiltro.filter(
    (c) => c.colaboradorId in escolhidos,
  ).length;
  const todosMarcados =
    doFiltro.length > 0 && marcadosNoFiltro === doFiltro.length;

  useEffect(() => {
    if (geralRef.current)
      geralRef.current.indeterminate = marcadosNoFiltro > 0 && !todosMarcados;
  }, [marcadosNoFiltro, todosMarcados]);

  const porDepartamento = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of time ?? []) {
      const d = c.departamento ?? "Sem departamento";
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [time]);
  const departamentosComGente = porDepartamento.filter(
    ([d]) => d !== "Sem departamento",
  ).length;

  const pessoaEscolhida = (c: CandidatoPesquisa): PessoaEscolhida => ({
    nome: c.nome,
    departamento: c.departamento,
  });

  /** Só quem já respondeu fica (não sai da lista depois de responder). */
  const soQuemRespondeu = () =>
    Object.fromEntries(
      Object.entries(escolhidos).filter(([id]) => respondeu.has(id)),
    );

  function marcar(c: CandidatoPesquisa, marcado: boolean) {
    const novo = { ...escolhidos };
    if (marcado) novo[c.colaboradorId] = pessoaEscolhida(c);
    else delete novo[c.colaboradorId];
    onMudar({ escolhidos: novo });
  }

  function marcarTodosDoFiltro(marcado: boolean) {
    const novo = { ...escolhidos };
    for (const c of doFiltro) {
      if (marcado) novo[c.colaboradorId] = pessoaEscolhida(c);
      else if (!respondeu.has(c.colaboradorId)) delete novo[c.colaboradorId];
    }
    onMudar({ escolhidos: novo });
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
        onMudar={(v) => setFiltro((f) => ({ ...f, [campo]: v }))}
      />
    </div>
  );

  const nTime = time?.length ?? null;
  const total = doFiltro.length;

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
                : nTime === 1
                  ? "O colaborador ativo"
                  : `Os ${nTime} colaboradores ativos`}
            </span>
          </span>
        </label>
        <label className="pesquisas__escolha">
          <input
            type="radio"
            name={`${base}-quem`}
            checked={!todos}
            disabled={publicada && todos}
            onChange={() =>
              // Começa sem ninguém marcado (só quem já respondeu fica).
              onMudar({ todos: false, escolhidos: soQuemRespondeu() })
            }
          />
          <span className="pesquisas__escolha-icone" aria-hidden="true">
            <IconeFiltrar tamanho={18} />
          </span>
          <span className="pesquisas__escolha-textos">
            <strong>Escolher pessoas</strong>
            <span className="pesquisas__suave">
              {publicada && todos
                ? "Publicada para todo o time, não volta a ser só para algumas pessoas."
                : "Por nome, departamento, centro de custo ou unidade"}
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
                {porDepartamento.map(([d, n], i) => (
                  <li key={d} className="pesquisas__chip">
                    <span
                      className="pesquisas__ponto"
                      aria-hidden="true"
                      style={{
                        background: `var(${CORES_DOS_GRUPOS[i % CORES_DOS_GRUPOS.length]})`,
                      }}
                    />
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
              onMudar={setBusca}
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
            {filtroLista("unidade", "Unidade", grupos?.unidade ?? [])}
          </div>
          <div className="pesquisas__barra-selecao">
            <label className="pesquisas__marcacao">
              <input
                ref={geralRef}
                type="checkbox"
                aria-label="Marcar todos do filtro"
                checked={todosMarcados}
                disabled={total === 0}
                onChange={(e) => marcarTodosDoFiltro(e.target.checked)}
              />
              <span role="status">
                {`${plural(marcadosNoFiltro, "selecionado", "selecionados")} de ${plural(total, "colaborador", "colaboradores")}`}
              </span>
            </label>
            <span className="pesquisas__acoes">
              {total > 0 && !todosMarcados ? (
                <Button
                  variant="subtle"
                  onClick={() => marcarTodosDoFiltro(true)}
                >
                  {`Selecionar todos os ${total}`}
                </Button>
              ) : null}
              {Object.keys(escolhidos).length > 0 ? (
                <Button
                  variant="subtle"
                  onClick={() => onMudar({ escolhidos: soQuemRespondeu() })}
                >
                  Limpar
                </Button>
              ) : null}
            </span>
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
                    <th scope="col">Colaborador</th>
                    <th scope="col">Departamento</th>
                    <th scope="col">Centro de custo</th>
                    <th scope="col">Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((c) => {
                    const marcada = c.colaboradorId in escolhidos;
                    const ja = respondeu.has(c.colaboradorId);
                    return (
                      <tr
                        key={c.colaboradorId}
                        {...(marcada ? { "data-marcada": "" } : {})}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={c.nome}
                            checked={marcada}
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
                                {[c.cargo, ja ? "já respondeu" : null]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td>{c.departamento ?? "—"}</td>
                        <td>{c.centroCusto ?? "—"}</td>
                        <td>{c.unidade ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
          {(time ?? []).map((c) => {
            return (
              <li key={c.colaboradorId}>
                <Avatar texto={iniciaisDe(c.nome)} />
                <span className="pesquisas__pessoa-textos">
                  <span>{c.nome}</span>
                  <span className="pesquisas__suave">
                    {[c.cargo, c.departamento, c.unidade]
                      .filter(Boolean)
                      .join(" · ") || "Sem lotação"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}
