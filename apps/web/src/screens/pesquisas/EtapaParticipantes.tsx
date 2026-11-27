/**
 * T216 — etapa "Participantes" do assistente: todo o time (colaboradores
 * ativos da empresa) ou pessoas escolhidas, com busca e filtro por
 * departamento (clientes de colaboradores e de departamentos que já
 * existem). A contagem mostra quantas pessoas vão receber. Depois de
 * publicar, quem já respondeu não sai da lista.
 */
import { useEffect, useId, useState } from "react";
import type { ColaboradorListadoApi } from "../../api/colaboradoresClient";
import type { DepartamentoApi } from "../../api/organizacaoClient";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { ListaDeEscolha } from "../../ui";
import type { PessoaEscolhida } from "./estadoDaPesquisa";
import type { ServicoDePesquisas } from "./servicoDePesquisas";

const TAMANHO = 50;

function departamentoDe(c: ColaboradorListadoApi): string | null {
  return (
    c.vinculos?.find((v) => v.lotacaoVigente?.departamento)?.lotacaoVigente
      ?.departamento?.nome ?? null
  );
}

export function EtapaParticipantes({
  servico,
  todos,
  escolhidos,
  responderam,
  publicada,
  erro,
  onMudar,
}: {
  readonly servico: ServicoDePesquisas;
  readonly todos: boolean;
  readonly escolhidos: Readonly<Record<string, PessoaEscolhida>>;
  readonly responderam: readonly string[];
  /** Já publicada: "todo o time" não volta a ser lista. */
  readonly publicada: boolean;
  readonly erro: string | undefined;
  readonly onMudar: (mudanca: {
    todos?: boolean;
    escolhidos?: Record<string, PessoaEscolhida>;
  }) => void;
}) {
  const base = useId();
  const [totalAtivos, setTotalAtivos] = useState<number | null>(null);
  const [departamentos, setDepartamentos] = useState<
    readonly DepartamentoApi[]
  >([]);
  const [busca, setBusca] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [pagina, setPagina] = useState(1);
  const [pessoas, setPessoas] = useState<ColaboradorListadoApi[] | null>(null);
  const [total, setTotal] = useState(0);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.resolve(servico.listarAtivos({ tamanhoPagina: 1 }))
      .then((r) => {
        if (vivo) setTotalAtivos(r?.total ?? null);
      })
      .catch(() => undefined);
    Promise.resolve(servico.listarDepartamentos())
      .then((d) => {
        if (vivo) setDepartamentos(d ?? []);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [servico]);

  useEffect(() => {
    if (todos) return;
    let vivo = true;
    setFalhou(false);
    Promise.resolve(
      servico.listarAtivos({
        ...(busca.trim() ? { busca: busca.trim() } : {}),
        ...(departamentoId ? { departamentoId } : {}),
        pagina,
        tamanhoPagina: TAMANHO,
      }),
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
  }, [servico, todos, busca, departamentoId, pagina]);

  const qtdEscolhidos = Object.keys(escolhidos).length;
  const vaoReceber = todos ? totalAtivos : qtdEscolhidos;
  const respondeu = new Set(responderam);

  function marcar(c: ColaboradorListadoApi, marcado: boolean) {
    const novo = { ...escolhidos };
    if (marcado) novo[c.id] = { nome: c.nome, departamento: departamentoDe(c) };
    else delete novo[c.id];
    onMudar({ escolhidos: novo });
  }

  return (
    <div className="pesquisas__etapa">
      <div
        className="pesquisas__opcoes-cartao"
        role="radiogroup"
        aria-label="Quem responde"
      >
        <label className="pesquisas__opcao-cartao">
          <input
            type="radio"
            name={`${base}-quem`}
            checked={todos}
            onChange={() => onMudar({ todos: true })}
          />
          <span>
            <strong>Todo o time</strong>
            <span className="pesquisas__suave">
              Todos os colaboradores ativos da empresa, contados na publicação.
            </span>
          </span>
        </label>
        <label className="pesquisas__opcao-cartao">
          <input
            type="radio"
            name={`${base}-quem`}
            checked={!todos}
            disabled={publicada && todos}
            onChange={() => onMudar({ todos: false })}
          />
          <span>
            <strong>Escolher pessoas</strong>
            <span className="pesquisas__suave">
              {publicada && todos
                ? "Depois de publicada para todo o time, a pesquisa não volta a ser só para algumas pessoas."
                : "Busque por nome ou filtre por departamento."}
            </span>
          </span>
        </label>
      </div>

      <p className="pesquisas__forte" role="status">
        {vaoReceber === null
          ? "Contando quem vai receber…"
          : `Vão receber: ${plural(vaoReceber, "pessoa", "pessoas")}`}
      </p>
      {erro ? (
        <p className="pesquisas__erro" role="alert">
          {erro}
        </p>
      ) : null}

      {todos ? null : (
        <>
          <div className="pesquisas__filtros">
            <input
              type="search"
              className="pesquisas__busca"
              aria-label="Buscar pessoa"
              placeholder="Buscar pessoa"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
            <div className="pesquisas__filtro-departamento">
              <label htmlFor={`${base}-dep`} className="pesquisas__suave">
                Departamento
              </label>
              <ListaDeEscolha
                id={`${base}-dep`}
                opcoes={[
                  { valor: "", rotulo: "Todos os departamentos" },
                  ...departamentos.map((d) => ({
                    valor: d.id,
                    rotulo: d.nome,
                  })),
                ]}
                valor={departamentoId}
                onMudar={(v) => {
                  setDepartamentoId(v);
                  setPagina(1);
                }}
              />
            </div>
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
            <ul
              className="pesquisas__pessoas"
              aria-label="Colaboradores ativos"
            >
              {pessoas.map((c) => {
                const ja = respondeu.has(c.id);
                const dep = departamentoDe(c);
                return (
                  <li key={c.id}>
                    <label className="pesquisas__pessoa">
                      <input
                        type="checkbox"
                        checked={c.id in escolhidos}
                        disabled={ja}
                        onChange={(e) => marcar(c, e.target.checked)}
                      />
                      <span>
                        <span>{c.nome}</span>
                        <span className="pesquisas__suave">
                          {[dep, ja ? "já respondeu" : null]
                            .filter(Boolean)
                            .join(" · ") || "Sem departamento"}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
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

          {qtdEscolhidos > 0 ? (
            <div className="pesquisas__etapa">
              <p className="pesquisas__suave">
                {`${plural(qtdEscolhidos, "pessoa escolhida", "pessoas escolhidas")}:`}
              </p>
              <ul
                className="pesquisas__escolhidos"
                aria-label="Pessoas escolhidas"
              >
                {Object.entries(escolhidos).map(([id, p]) => (
                  <li key={id} className="pesquisas__chip">
                    {p.nome}
                    {respondeu.has(id) ? null : (
                      <button
                        type="button"
                        aria-label={`Tirar ${p.nome}`}
                        onClick={() => {
                          const novo = { ...escolhidos };
                          delete novo[id];
                          onMudar({ escolhidos: novo });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
