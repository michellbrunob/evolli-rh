/**
 * T215 — o quadro "Escala de trabalho" (semana e mês), no desenho da
 * referência: pessoas × dias, com o turno (cor, nome e horário; no mês, a
 * sigla), folga, DSR, "Escalados no dia", horas da pessoa e do grupo, meta do
 * mês, busca, agrupamento e paginação. Os dias saem dos padrões de escala de
 * cada pessoa (aba Escala da ficha), pela mesma regra.
 *
 * Esta fatia só lê: editar uma célula, rascunho e publicação, ações em massa,
 * avisos da CLT e exportação vêm nas próximas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  consultarQuadro,
  type PessoaDoQuadroApi,
  type QuadroDaEscalaApi,
  type TurnoDaEscalaApi,
} from "../../../api/escalaClient";
import { Button } from "../../../components";
import { diaCivilDeHoje, diaDaSemanaEDiaMes } from "../../../format/data";
import { plural } from "../../../format/plural";
import {
  IconeAbrir,
  IconeAvancar,
  IconeBuscar,
  IconeFiltrar,
  IconeVoltar,
} from "../../../ui/icones";
import { Esqueleto, Revelar } from "../../../ui/movimento";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../pessoas/edicao/dadosProfissionais";
import { OPCOES_GENERO, OPCOES_NIVEL } from "../../pessoas/NovaAdmissaoScreen";
import { GavetaDoQuadro } from "./GavetaDoQuadro";
import {
  type FiltrosDoQuadro,
  type RotulosDosCodigos,
  FILTROS_DO_QUADRO_VAZIOS,
  filtrar,
  quantosFiltros,
} from "./filtrosDoQuadro";
import {
  diaDaSemana,
  feriadoDe,
  formatarHoras,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import { corDoTurno, siglaDoNome } from "../turnos/turnos";
import {
  type Agrupamento,
  type CelulaDoQuadro,
  type GrupoDoQuadro,
  type Visao,
  DIAS_CURTOS,
  LETRAS_DOS_DIAS,
  ROTULO_DO_AGRUPAMENTO,
  agrupar,
  buscar,
  celulaDoDia,
  deslocar,
  diasDoPeriodo,
  iniciais,
  metaDoPeriodo,
  nomeDosGrupos,
  ordenar,
  periodoDa,
  rotuloDaEscala,
  tituloDoPeriodo,
} from "./quadroDaEscala";
import "./QuadroDaEscalaScreen.css";

export const QUADRO_ESCALA_TITULO_ID = "quadro-escala-titulo";

const POR_PAGINA = [10, 50, 100] as const;

const AGRUPAMENTOS: readonly Agrupamento[] = [
  "departamento",
  "unidade",
  "turno",
  "gestor",
  "nenhum",
];

const ROTULOS: RotulosDosCodigos = {
  tipo: (c) => (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[c] ?? c,
  nivel: (c) => OPCOES_NIVEL.find((o) => o.codigo === c)?.rotulo ?? c,
  genero: (c) => OPCOES_GENERO.find((o) => o.codigo === c)?.rotulo ?? c,
};

type Carga =
  | { estado: "carregando" }
  | { estado: "erro"; semEmpresa: boolean }
  | { estado: "pronto"; dados: QuadroDaEscalaApi };

export interface QuadroDaEscalaScreenProps {
  /** "← Colaboradores". */
  readonly onVoltar?: () => void;
  readonly onAbrirTurnos?: () => void;
  /**
   * Aberto pela ficha ("Abrir no quadro"): já filtra o departamento da
   * pessoa (na gaveta "Filtros", removível).
   */
  readonly colaboradorEmFoco?: string | null;
  /** Para testes: o dia de hoje. */
  readonly hoje?: string;
}

function siglaDe(t: TurnoDaEscalaApi): string {
  return t.sigla ?? siglaDoNome(t.nome);
}

/** "Comercial, 09:00–18:00" etc. — o que a célula diz a quem lê pela tela. */
function descricaoDaCelula(c: CelulaDoQuadro): string {
  switch (c.tipo) {
    case "trabalho":
      return c.turno
        ? `${c.turno.nome}, ${c.horario ?? ""}`
        : "Trabalho, sem turno fixo";
    case "folga":
      return "Folga";
    case "dsr":
      return "DSR, descanso semanal remunerado";
    case "sem-escala":
      return "Sem escala";
    case "fora":
      return "Fora do vínculo";
  }
}

function CelulaDaSemana({ c }: { c: CelulaDoQuadro }) {
  if (c.tipo === "trabalho") {
    return c.turno ? (
      <div className="quadro__turno">
        <span className="quadro__turno-nome">
          <span
            className="quadro__ponto"
            style={{ background: corDoTurno(c.turno.cor) }}
            aria-hidden="true"
          />
          {c.turno.nome}
        </span>
        <span className="quadro__turno-horario">{c.horario}</span>
      </div>
    ) : (
      <div className="quadro__turno">
        <span className="quadro__turno-nome">Trabalho</span>
        <span className="quadro__turno-horario">Sem turno fixo</span>
      </div>
    );
  }
  if (c.tipo === "dsr") {
    return (
      <div className="quadro__descanso">
        <span className="quadro__descanso-nome">DSR</span>
        <span className="quadro__turno-horario">Descanso</span>
      </div>
    );
  }
  if (c.tipo === "folga") {
    return <span className="quadro__descanso-nome">Folga</span>;
  }
  return <span className="sr-only">{descricaoDaCelula(c)}</span>;
}

function CelulaDoMes({ c }: { c: CelulaDoQuadro }) {
  if (c.tipo === "trabalho") {
    const t = c.turno;
    return (
      <span
        className="quadro__sigla"
        style={t ? { color: corDoTurno(t.cor) } : undefined}
        title={descricaoDaCelula(c)}
      >
        <span aria-hidden="true">{t ? siglaDe(t) : "T"}</span>
        <span className="sr-only">{descricaoDaCelula(c)}</span>
      </span>
    );
  }
  if (c.tipo === "dsr") {
    return (
      <span className="quadro__sigla quadro__sigla--dsr" title="DSR">
        <span aria-hidden="true">D</span>
        <span className="sr-only">{descricaoDaCelula(c)}</span>
      </span>
    );
  }
  return <span className="sr-only">{descricaoDaCelula(c)}</span>;
}

export function QuadroDaEscalaScreen({
  onVoltar,
  onAbrirTurnos,
  colaboradorEmFoco = null,
  hoje: hojeFixo,
}: QuadroDaEscalaScreenProps) {
  const hoje = hojeFixo ?? diaCivilDeHoje();
  const [visao, setVisao] = useState<Visao>("semana");
  const [ancora, setAncora] = useState(hoje);
  const [tentativa, setTentativa] = useState(0);
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const [busca, setBusca] = useState("");
  const [agruparPor, setAgruparPor] = useState<Agrupamento>("departamento");
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");
  const [porPagina, setPorPagina] = useState<number>(10);
  const [pagina, setPagina] = useState(1);
  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [filtros, setFiltros] = useState<FiltrosDoQuadro>(
    FILTROS_DO_QUADRO_VAZIOS,
  );
  const [gaveta, setGaveta] = useState(false);
  const focoAplicado = useRef(false);
  const tituloRef = useRef<HTMLHeadingElement | null>(null);

  const { inicio, fim } = periodoDa(visao, ancora);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });
    consultarQuadro(inicio, fim).then(
      (dados) => {
        if (vivo) setCarga({ estado: "pronto", dados });
      },
      (erro: unknown) => {
        if (!vivo) return;
        setCarga({
          estado: "erro",
          semEmpresa: erro instanceof ApiError && erro.status === 403,
        });
      },
    );
    return () => {
      vivo = false;
    };
  }, [inicio, fim, tentativa]);

  // Aberto pela ficha: o departamento da pessoa, uma vez.
  useEffect(() => {
    if (focoAplicado.current || carga.estado !== "pronto") return;
    focoAplicado.current = true;
    if (!colaboradorEmFoco) return;
    const p = carga.dados.pessoas.find(
      (x) => x.colaboradorId === colaboradorEmFoco,
    );
    if (p?.departamento) {
      setFiltros({
        ...FILTROS_DO_QUADRO_VAZIOS,
        departamentos: [p.departamento.id],
      });
    }
  }, [carga, colaboradorEmFoco]);

  const dias = useMemo(() => diasDoPeriodo(inicio, fim), [inicio, fim]);
  const referencia = hoje >= inicio && hoje <= fim ? hoje : inicio;
  const todas = useMemo(
    () => (carga.estado === "pronto" ? carga.dados.pessoas : []),
    [carga],
  );

  const filtradas = useMemo(
    () => buscar(filtrar(todas, filtros, referencia), busca),
    [todas, filtros, referencia, busca],
  );
  const ligados = quantosFiltros(filtros);

  const celulas = useMemo(() => {
    const m = new Map<string, CelulaDoQuadro[]>();
    for (const p of filtradas) {
      m.set(
        p.colaboradorId,
        dias.map((d) => celulaDoDia(p, d)),
      );
    }
    return m;
  }, [filtradas, dias]);

  const minutosDe = (p: PessoaDoQuadroApi) =>
    (celulas.get(p.colaboradorId) ?? []).reduce((s, c) => s + c.minutos, 0);

  const grupos = useMemo(
    () => agrupar(ordenar(filtradas, ordem), agruparPor, referencia),
    [filtradas, ordem, agruparPor, referencia],
  );
  const emOrdem = grupos.flatMap((g) => g.pessoas);
  const total = emOrdem.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaAtual = Math.min(pagina, paginas);
  const daPagina = emOrdem.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina,
  );
  const naPagina = new Set(daPagina.map((p) => p.colaboradorId));
  const gruposDaPagina: GrupoDoQuadro[] = grupos
    .map((g) => ({
      ...g,
      pessoas: g.pessoas.filter((p) => naPagina.has(p.colaboradorId)),
    }))
    .filter((g) => g.pessoas.length > 0);

  const escalados = dias.map(
    (_, i) =>
      filtradas.filter(
        (p) => celulas.get(p.colaboradorId)?.[i]?.tipo === "trabalho",
      ).length,
  );
  const minutosTotais = filtradas.reduce((s, p) => s + minutosDe(p), 0);

  const turnosNaPagina = new Map<string, TurnoDaEscalaApi>();
  for (const p of daPagina) {
    for (const c of celulas.get(p.colaboradorId) ?? []) {
      if (c.turno) turnosNaPagina.set(c.turno.id, c.turno);
    }
  }

  const filtrando = ligados > 0 || busca.trim() !== "";
  const contagem = filtrando
    ? `${total} de ${plural(todas.length, "pessoa", "pessoas")}`
    : agruparPor === "nenhum"
      ? plural(total, "pessoa", "pessoas")
      : `${plural(total, "pessoa", "pessoas")} · ${nomeDosGrupos(agruparPor, grupos.length)}`;

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    setPagina(1);
  };
  const irPara = (dia: string) => {
    setAncora(dia);
  };
  const alternarGrupo = (chave: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const titulo = tituloDoPeriodo(visao, inicio, fim);
  const colunas = dias.length + 2;

  const cabecaDoGrupo = (g: GrupoDoQuadro) => {
    const completo = grupos.find((x) => x.chave === g.chave) ?? g;
    const aberto = !recolhidos.has(g.chave);
    const minutos = completo.pessoas.reduce((s, p) => s + minutosDe(p), 0);
    return (
      <tr className="quadro__grupo">
        <th scope="colgroup" colSpan={colunas}>
          <div className="quadro__grupo-linha">
            <button
              type="button"
              className="quadro__grupo-botao"
              aria-expanded={aberto}
              onClick={() => alternarGrupo(g.chave)}
            >
              <IconeAbrir
                tamanho={14}
                className={`quadro__seta${aberto ? "" : " quadro__seta--fechada"}`}
              />
              <span className="quadro__grupo-nome">{g.nome}</span>
            </button>
            <span className="quadro__grupo-info">
              {plural(completo.pessoas.length, "pessoa", "pessoas")}
              {completo.unidade ? ` · ${completo.unidade}` : ""}
            </span>
            {visao === "semana" ? (
              <span className="quadro__grupo-horas">
                {formatarHoras(minutos)} na semana
              </span>
            ) : null}
          </div>
        </th>
      </tr>
    );
  };

  const cabecaDaPessoa = (p: PessoaDoQuadroApi) => {
    const tipo =
      p.tipoVinculo !== "clt"
        ? ((ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[
            p.tipoVinculo
          ] ?? null)
        : null;
    return (
      <th scope="row" className="quadro__pessoa">
        <div className="quadro__pessoa-linha">
          <span className="quadro__avatar" aria-hidden="true">
            {iniciais(p.nome)}
          </span>
          <span className="quadro__pessoa-textos">
            <span className="quadro__pessoa-nome">{p.nome}</span>
            <span className="quadro__pessoa-escala">
              {tipo ? <span className="quadro__tag">{tipo}</span> : null}
              {rotuloDaEscala(p, referencia)}
            </span>
          </span>
        </div>
      </th>
    );
  };

  const corpo = () => {
    if (total === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={colunas} className="quadro__vazio">
              {todas.length === 0
                ? "Nenhuma pessoa com vínculo neste período."
                : "Nenhuma pessoa encontrada. Confira a busca ou o filtro."}
            </td>
          </tr>
        </tbody>
      );
    }
    return gruposDaPagina.map((g) => (
      <tbody key={g.chave || "sem-grupo"}>
        {agruparPor !== "nenhum" ? cabecaDoGrupo(g) : null}
        {agruparPor === "nenhum" || !recolhidos.has(g.chave)
          ? g.pessoas.map((p) => {
              const cs = celulas.get(p.colaboradorId) ?? [];
              const minutos = minutosDe(p);
              return (
                <tr key={p.colaboradorId} className="quadro__linha">
                  {cabecaDaPessoa(p)}
                  {cs.map((c) => (
                    <td
                      key={c.dia}
                      className={`quadro__celula quadro__celula--${c.tipo}${
                        c.dia === hoje ? " quadro__celula--hoje" : ""
                      }`}
                    >
                      {visao === "semana" ? (
                        <CelulaDaSemana c={c} />
                      ) : (
                        <CelulaDoMes c={c} />
                      )}
                    </td>
                  ))}
                  <td className="quadro__horas">
                    {visao === "semana" ? (
                      formatarHoras(minutos)
                    ) : (
                      <HorasDoMes
                        minutos={minutos}
                        meta={metaDoPeriodo(p, dias)}
                        diasDeTrabalho={
                          cs.filter((c) => c.tipo === "trabalho").length
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })
          : null}
      </tbody>
    ));
  };

  return (
    <Revelar>
      <section className="quadro" aria-labelledby={QUADRO_ESCALA_TITULO_ID}>
        <header className="quadro__cabeca">
          {onVoltar ? (
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Voltar para Colaboradores"
              onClick={onVoltar}
            >
              <IconeVoltar tamanho={18} />
            </button>
          ) : null}
          <div className="quadro__cabeca-textos">
            <h1
              id={QUADRO_ESCALA_TITULO_ID}
              ref={tituloRef}
              tabIndex={-1}
              className="quadro__titulo"
            >
              Escala de trabalho
            </h1>
            <p className="quadro__subtitulo">{titulo}</p>
          </div>
        </header>

        <div className="quadro__barra">
          <div className="quadro__visao" role="group" aria-label="Visão">
            {(["semana", "mes"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="quadro__visao-botao"
                aria-pressed={visao === v}
                onClick={() => trocarVisao(v)}
              >
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <div className="quadro__periodo">
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Período anterior"
              onClick={() => irPara(deslocar(visao, ancora, -1))}
            >
              <IconeVoltar tamanho={16} />
            </button>
            <span className="quadro__periodo-texto" aria-live="polite">
              {visao === "semana" ? titulo.replace(" a ", " – ") : titulo}
            </span>
            <button
              type="button"
              className="quadro__icone-botao"
              aria-label="Próximo período"
              onClick={() => irPara(deslocar(visao, ancora, 1))}
            >
              <IconeAvancar tamanho={16} />
            </button>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => irPara(hoje)}
            disabled={hoje >= inicio && hoje <= fim}
          >
            Hoje
          </Button>
          {onAbrirTurnos ? (
            <Button type="button" variant="secondary" onClick={onAbrirTurnos}>
              Turnos
            </Button>
          ) : null}
        </div>

        <div className="quadro__filtros">
          <label className="quadro__busca">
            <IconeBuscar tamanho={16} />
            <span className="sr-only">Buscar colaborador</span>
            <input
              type="search"
              placeholder="Buscar colaborador"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          <label className="quadro__agrupar">
            <span>Agrupar por:</span>
            <select
              value={agruparPor}
              onChange={(e) => {
                setAgruparPor(e.target.value as Agrupamento);
                setPagina(1);
              }}
            >
              {AGRUPAMENTOS.map((a) => (
                <option key={a} value={a}>
                  {ROTULO_DO_AGRUPAMENTO[a]}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            aria-haspopup="dialog"
            onClick={() => setGaveta(true)}
          >
            <IconeFiltrar tamanho={16} />
            Filtrar
            {ligados > 0 ? (
              <span className="quadro__filtrar-numero">
                <span aria-hidden="true">{ligados}</span>
                <span className="sr-only">
                  {`, ${plural(ligados, "filtro ligado", "filtros ligados")}`}
                </span>
              </span>
            ) : null}
          </Button>
          {ligados > 0 ? (
            <Button
              type="button"
              variant="subtle"
              onClick={() => {
                setFiltros(FILTROS_DO_QUADRO_VAZIOS);
                setPagina(1);
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
          {carga.estado === "pronto" ? (
            <p className="quadro__contagem" aria-live="polite">
              {contagem}
            </p>
          ) : null}
        </div>

        {carga.estado === "carregando" ? (
          <Esqueleto rotulo="Carregando o quadro…" linhas={5} />
        ) : carga.estado === "erro" ? (
          <div className="quadro__aviso" role="alert">
            <p>
              {carga.semEmpresa
                ? "Escolha uma empresa para ver o quadro de escala."
                : "Não foi possível carregar o quadro de escala."}
            </p>
            {carga.semEmpresa ? null : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTentativa((n) => n + 1)}
              >
                Tentar de novo
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`quadro__rolagem quadro__rolagem--${visao}`}
              tabIndex={0}
              role="region"
              aria-label={`Quadro de escala ${visao === "semana" ? "da semana" : "do mês"}`}
            >
              <table className={`quadro__tabela quadro__tabela--${visao}`}>
                <caption className="sr-only">
                  {`Escala de trabalho: ${titulo}`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="quadro__col-pessoa">
                      <button
                        type="button"
                        className="quadro__ordenar"
                        onClick={() =>
                          setOrdem((o) => (o === "asc" ? "desc" : "asc"))
                        }
                      >
                        Colaborador
                        <span aria-hidden="true">
                          {ordem === "asc" ? " ↑" : " ↓"}
                        </span>
                        <span className="sr-only">
                          {ordem === "asc"
                            ? ", em ordem de A a Z"
                            : ", em ordem de Z a A"}
                        </span>
                      </button>
                    </th>
                    {dias.map((d) => {
                      const feriado = feriadoDe(d);
                      const semana = diaDaSemana(d) - 1;
                      return (
                        <th
                          key={d}
                          scope="col"
                          className={`quadro__dia${d === hoje ? " quadro__dia--hoje" : ""}${
                            feriado ? " quadro__dia--feriado" : ""
                          }`}
                          title={feriado ?? undefined}
                        >
                          {visao === "semana" ? (
                            <>
                              <span className="quadro__dia-nome">
                                {DIAS_CURTOS[semana]}
                              </span>
                              <span className="quadro__dia-numero">
                                {Number(d.slice(8, 10))}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="quadro__dia-numero">
                                {Number(d.slice(8, 10))}
                              </span>
                              <span className="quadro__dia-nome">
                                {LETRAS_DOS_DIAS[semana]}
                              </span>
                            </>
                          )}
                          <span className="sr-only">
                            {diaDaSemanaEDiaMes(d)}
                          </span>
                          {d === hoje && visao === "semana" ? (
                            <span className="quadro__hoje">Hoje</span>
                          ) : null}
                          {feriado ? (
                            <span className="sr-only">{`, feriado: ${feriado}`}</span>
                          ) : null}
                        </th>
                      );
                    })}
                    <th scope="col" className="quadro__col-horas">
                      {visao === "semana" ? "Horas" : "Horas no mês"}
                    </th>
                  </tr>
                  {visao === "semana" ? (
                    <tr className="quadro__escalados">
                      <th scope="row">Escalados no dia</th>
                      {escalados.map((n, i) => (
                        <td key={dias[i]}>
                          <strong>{n}</strong>
                          <span> de {filtradas.length}</span>
                        </td>
                      ))}
                      <td className="quadro__horas">
                        {formatarHoras(minutosTotais)}
                      </td>
                    </tr>
                  ) : null}
                </thead>
                {corpo()}
              </table>
            </div>

            <footer className="quadro__rodape">
              <nav className="quadro__paginacao" aria-label="Páginas">
                <p>
                  {total === 0
                    ? "Nenhuma pessoa"
                    : `Mostrando ${(paginaAtual - 1) * porPagina + 1}–${Math.min(
                        paginaAtual * porPagina,
                        total,
                      )} de ${plural(total, "pessoa", "pessoas")}`}
                </p>
                <label className="quadro__por-pagina">
                  <span className="sr-only">Pessoas por página</span>
                  <select
                    value={porPagina}
                    onChange={(e) => {
                      setPorPagina(Number(e.target.value));
                      setPagina(1);
                    }}
                  >
                    {POR_PAGINA.map((n) => (
                      <option key={n} value={n}>
                        {n} por página
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="quadro__icone-botao"
                  aria-label="Página anterior"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  <IconeVoltar tamanho={14} />
                </button>
                <span aria-current="page">{paginaAtual}</span>
                <button
                  type="button"
                  className="quadro__icone-botao"
                  aria-label="Próxima página"
                  disabled={paginaAtual >= paginas}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  <IconeAvancar tamanho={14} />
                </button>
              </nav>
              <ul className="quadro__legenda" aria-label="Legenda">
                {[...turnosNaPagina.values()].map((t) => (
                  <li key={t.id}>
                    {visao === "semana" ? (
                      <span
                        className="quadro__ponto"
                        style={{ background: corDoTurno(t.cor) }}
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="quadro__sigla"
                        style={{ color: corDoTurno(t.cor) }}
                        aria-hidden="true"
                      >
                        {siglaDe(t)}
                      </span>
                    )}
                    {t.nome}
                  </li>
                ))}
                {visao === "mes" ? (
                  <li>
                    <span
                      className="quadro__sigla quadro__sigla--dsr"
                      aria-hidden="true"
                    >
                      D
                    </span>
                    DSR
                  </li>
                ) : null}
              </ul>
              {visao === "mes" ? (
                <p className="quadro__dica">Shift + rolar para os lados</p>
              ) : null}
            </footer>
          </>
        )}
        <GavetaDoQuadro
          aberta={gaveta}
          pessoas={todas}
          quantas={total}
          filtros={filtros}
          referencia={referencia}
          rotulos={ROTULOS}
          onMudar={(f) => {
            setFiltros(f);
            setPagina(1);
          }}
          onFechar={() => setGaveta(false)}
        />
      </section>
    </Revelar>
  );
}

function HorasDoMes({
  minutos,
  meta,
  diasDeTrabalho,
}: {
  minutos: number;
  meta: number;
  diasDeTrabalho: number;
}) {
  const horas = Math.round(minutos / 60);
  const metaHoras = Math.round(meta / 60);
  const proporcao = meta > 0 ? Math.min(1, minutos / meta) : 0;
  return (
    <div className="quadro__mes-horas">
      <span>
        {horas}/{metaHoras} h
      </span>
      <span className="quadro__barra-horas" aria-hidden="true">
        <span style={{ width: `${Math.round(proporcao * 100)}%` }} />
      </span>
      <span className="quadro__mes-dias">
        {plural(diasDeTrabalho, "dia", "dias")}
      </span>
    </div>
  );
}
