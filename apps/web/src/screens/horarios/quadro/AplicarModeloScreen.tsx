/**
 * T215 — Aplicar modelo de escala: uma escala do catálogo para várias pessoas
 * de uma vez, em 5 etapas (Quem, Escala, Turnos, Período e Prévia). Tudo vai
 * para o rascunho do quadro; "Sem data de fim" também troca o padrão de cada
 * pessoa a partir do início.
 */
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import {
  type PessoaDoQuadroApi,
  type RegrasDaEscalaApi,
  consultarQuadro,
  consultarRegras,
  definirEscala,
  gravarDias,
} from "../../../api/escalaClient";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../../api/horariosClient";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import {
  CadastroEmEtapas,
  LinhaDoCadastro,
  SecaoDoCadastro,
} from "../../../components/cadastro/CadastroEmEtapas";
import {
  diaCivilDeHoje,
  diaMesCurto,
  formatarDiaCivil,
  mesDoDia,
  numeroDoDia,
} from "../../../format/data";
import { plural } from "../../../format/plural";
import { Esqueleto } from "../../../ui/movimento";
import { ROTULO_DO_TIPO_DE_VINCULO } from "../../pessoas/edicao/dadosProfissionais";
import {
  beneficioPelosDiasUteis,
  diaDaSemana,
  diasNoMes,
  formatarHoras,
  somarDias,
} from "../../pessoas/ficha/escala/calendarioDaEscala";
import {
  DIAS_DA_SEMANA,
  GRUPOS_DE_ESCALA,
  MODELOS_DE_ESCALA,
  modeloDe,
  temCiclo,
} from "../../pessoas/ficha/escala/modelosDeEscala";
import { calcularAvisos } from "./avisosDaEscala";
import {
  DIAS_SUGERIDOS,
  type DistribuicaoDaFolga,
  type OpcoesDoModelo,
  aceitaTurnoPorDia,
  avisarNoQuadro,
  celulasDoModelo,
  diasDoModelo,
  diasFixosDo,
  folgaDaPessoa,
  esquecerPedidoDoModelo,
  lerPedidoDoModelo,
  pessoasComOModelo,
  planoDoModelo,
} from "./aplicarModelo";
import {
  LETRAS_DOS_DIAS,
  diasDoPeriodo,
  iniciais,
  inicioDaSemana,
  rotuloDaEscala,
} from "./quadroDaEscala";
import "./AplicarModeloScreen.css";

export const MODELO_ESCALA_TITULO_ID = "modelo-escala-titulo";

const ETAPAS = [
  {
    titulo: "Quem",
    subtitulo: "Pessoas ou filtro",
    descricao: "Escolha as pessoas que vão receber a escala.",
  },
  {
    titulo: "Escala",
    subtitulo: "Do catálogo",
    descricao:
      "O mesmo catálogo do cadastro. Os dias no mês valem para os benefícios pagos por dia.",
  },
  { titulo: "Turnos", subtitulo: "Horários e folgas", descricao: "" },
  {
    titulo: "Período",
    subtitulo: "De quando até quando",
    descricao: "Quando o modelo começa a valer e até quando.",
  },
  {
    titulo: "Prévia",
    subtitulo: "Conferir e aplicar",
    descricao: "Confira antes de aplicar. Nada é publicado agora.",
  },
] as const;

const TITULOS_DAS_ETAPAS = [
  "Quem recebe o modelo",
  "Qual escala",
  "Turnos e folgas",
  "Período",
  "Prévia",
];

/** O quadro aceita até 42 dias por consulta: períodos maiores vão em partes. */
const DIAS_POR_CONSULTA = 42;

async function consultarPessoas(
  inicio: string,
  fim: string,
): Promise<PessoaDoQuadroApi[]> {
  const porId = new Map<string, PessoaDoQuadroApi>();
  for (let de = inicio; de <= fim; de = somarDias(de, DIAS_POR_CONSULTA)) {
    const ate = somarDias(de, DIAS_POR_CONSULTA - 1);
    const q = await consultarQuadro(de, ate < fim ? ate : fim);
    for (const p of q.pessoas) {
      const antes = porId.get(p.colaboradorId);
      porId.set(
        p.colaboradorId,
        antes
          ? { ...antes, dias: [...(antes.dias ?? []), ...(p.dias ?? [])] }
          : p,
      );
    }
  }
  return [...porId.values()];
}

/** "Dias úteis do mês" ou "26 dias no mês". */
function rotuloDosDias(modelo: string, mes: string): string {
  return beneficioPelosDiasUteis(modelo)
    ? "Dias úteis do mês"
    : `${diasNoMes(modelo, mes)} dias no mês`;
}

function rotuloDoTurno(t: TabelaHorarioApi): string {
  const p = t.periodos[0];
  const faixa = p
    ? ` · ${p.inicio}–${t.periodos.filter((x) => x.dia === p.dia).at(-1)!.fim}`
    : "";
  return `${t.nome}${faixa}`;
}

const idDaEtapa = (i: number) => `modelo-etapa-${i}`;

/** A ajuda do "Substituir": o que fica como está sem marcar. */
function textoDoSubstituir(ocupadas: number): string {
  if (ocupadas === 0) {
    return "Nenhuma célula do período está preenchida: o modelo ocupa todas.";
  }
  return ocupadas === 1
    ? "Desmarcado, a célula já preenchida no rascunho ou publicada fica como está e o modelo só ocupa as vazias."
    : `Desmarcado, as ${ocupadas} células já preenchidas no rascunho ou publicadas ficam como estão e o modelo só ocupa as vazias.`;
}

const ORDEM_DA_CATEGORIA = { atencao: 0, conferir: 1, informativo: 2 } as const;

const rotuloDoContrato = (t: string) =>
  (ROTULO_DO_TIPO_DE_VINCULO as Record<string, string>)[t] ?? t;

const NOME_DO_DIA = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function AplicarModeloScreen({
  onVoltar,
  hojeFixo,
}: {
  readonly onVoltar: () => void;
  /** Só para testes: o dia de hoje. */
  readonly hojeFixo?: string;
}) {
  const hoje = hojeFixo ?? diaCivilDeHoje();
  const pedido = useRef(lerPedidoDoModelo());
  // O pedido do quadro vale para esta visita: ao sair, é esquecido.
  useEffect(() => esquecerPedidoDoModelo, []);
  const [regras, setRegras] = useState<RegrasDaEscalaApi | null>(null);
  const [turnos, setTurnos] = useState<TabelaHorarioApi[]>([]);
  const [pessoas, setPessoas] = useState<PessoaDoQuadroApi[] | null>(null);
  const [erroCarga, setErroCarga] = useState(false);

  const [atual, setAtual] = useState(0);
  const [alcancada, setAlcancada] = useState(0);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Aplicado: a guarda de saída libera e a página volta ao quadro. */
  const [concluido, setConcluido] = useState(false);

  // Etapa 1.
  const [paraQuem, setParaQuem] = useState<"filtro" | "escolher">(
    pedido.current && pedido.current.selecionadas.length === 0
      ? "filtro"
      : "escolher",
  );
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(
    () => new Set(pedido.current?.selecionadas ?? []),
  );
  const [busca, setBusca] = useState("");
  const [unidade, setUnidade] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [contrato, setContrato] = useState("");
  // Etapa 2.
  const [modelo, setModelo] = useState<string | null>(null);
  // Etapa 3.
  const [porDia, setPorDia] = useState(false);
  const [turnoId, setTurnoId] = useState("");
  const [turnoDoDia, setTurnoDoDia] = useState<
    Readonly<Record<number, string>>
  >({});
  const [diasTrabalho, setDiasTrabalho] = useState<readonly number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [folga, setFolga] = useState<DistribuicaoDaFolga>("mesmo");
  const [domingos, setDomingos] = useState(false);
  // Etapa 4.
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [semFim, setSemFim] = useState(true);
  const [substituir, setSubstituir] = useState(false);
  const [doPeriodo, setDoPeriodo] = useState<PessoaDoQuadroApi[] | null>(null);
  // Etapa 5.
  const [tiradas, setTiradas] = useState<ReadonlySet<string>>(new Set());
  const [todosOsAvisos, setTodosOsAvisos] = useState(false);

  useEdicaoEmAndamento("Aplicar modelo de escala", {
    pendente: !concluido && (alcancada > 0 || marcadas.size > 0),
    salvando: enviando && !concluido,
  });
  useEffect(() => {
    if (concluido) onVoltar();
  }, [concluido, onVoltar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await consultarRegras();
        const semana = inicioDaSemana(hoje, r.semanaComeca);
        const [ts, q] = await Promise.all([
          listarTabelasHorario({ ativo: true, tamanhoPagina: 100 }),
          consultarQuadro(semana, somarDias(semana, 6)),
        ]);
        if (!vivo) return;
        const proxima = somarDias(semana, 7);
        setRegras(r);
        setTurnos(ts.itens);
        setTurnoId(ts.itens[0]?.id ?? "");
        setPessoas(q.pessoas.filter((p) => p.situacao !== "encerrado"));
        setInicio(proxima);
        setFim(somarDias(proxima, DIAS_SUGERIDOS - 1));
      } catch {
        if (vivo) setErroCarga(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [hoje]);

  // Os dias já escalados no período (para "Substituir" e para a prévia).
  const ultimoDia = semFim ? null : fim;
  const dias = useMemo(
    () => (inicio ? diasDoModelo(inicio, ultimoDia) : []),
    [inicio, ultimoDia],
  );
  const precisaDoPeriodo = atual >= 3;
  useEffect(() => {
    if (!precisaDoPeriodo || dias.length === 0) return;
    let vivo = true;
    setDoPeriodo(null);
    consultarPessoas(dias[0]!, dias[dias.length - 1]!)
      .then((ps) => {
        if (vivo) setDoPeriodo(ps);
      })
      .catch(() => {
        if (vivo) setDoPeriodo([]);
      });
    return () => {
      vivo = false;
    };
  }, [precisaDoPeriodo, dias]);

  const todas = pessoas ?? [];
  const idsDoFiltro = pedido.current?.doFiltro;
  const doFiltroDoQuadro = idsDoFiltro
    ? todas.filter((p) => idsDoFiltro.includes(p.colaboradorId))
    : todas;
  const opcoes = (lista: readonly (readonly [string, string])[]) =>
    [...new Map(lista).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const unidades = opcoes(
    todas.flatMap((p) =>
      p.unidade ? [[p.unidade.id, p.unidade.nome] as const] : [],
    ),
  );
  const departamentos = opcoes(
    todas.flatMap((p) =>
      p.departamento ? [[p.departamento.id, p.departamento.nome] as const] : [],
    ),
  );
  const contratos = opcoes(
    todas.map((p) => [p.tipoVinculo, rotuloDoContrato(p.tipoVinculo)] as const),
  );
  const naLista = doFiltroDoQuadro.filter(
    (p) =>
      (!unidade || p.unidade?.id === unidade) &&
      (!departamento || p.departamento?.id === departamento) &&
      (!contrato || p.tipoVinculo === contrato) &&
      (!busca.trim() ||
        p.nome
          .toLocaleLowerCase("pt-BR")
          .includes(busca.trim().toLocaleLowerCase("pt-BR"))),
  );
  const escolhidas = (
    paraQuem === "filtro"
      ? naLista
      : todas.filter((p) => marcadas.has(p.colaboradorId))
  ).filter((p) => !tiradas.has(p.colaboradorId));

  const m = modeloDe(modelo);
  const turno = turnos.find((t) => t.id === turnoId) ?? null;
  const diasFixos = modelo ? diasFixosDo(modelo, diasTrabalho) : [];
  const usaPorDia = modelo !== null && aceitaTurnoPorDia(modelo) && porDia;
  let turnoPorDia: Map<number, TabelaHorarioApi> | undefined;
  if (usaPorDia) {
    turnoPorDia = new Map();
    for (const d of diasFixos) {
      const t = turnos.find((x) => x.id === turnoDoDia[d]);
      if (t) turnoPorDia.set(d, t);
    }
  }
  const turnoBase = usaPorDia
    ? (turnoPorDia?.values().next().value ?? null)
    : turno;

  const o: OpcoesDoModelo | null =
    modelo && inicio
      ? {
          modelo,
          turno: turnoBase,
          ...(turnoPorDia ? { turnoPorDia } : {}),
          folga,
          domingoACada3: domingos,
          diasTrabalho,
          inicio,
          fim: ultimoDia,
          substituir,
        }
      : null;

  // As pessoas com os dias já escalados no período (quando carregados).
  const doPeriodoPorId = new Map(
    (doPeriodo ?? []).map((p) => [p.colaboradorId, p]),
  );
  const comDias = escolhidas.map(
    (p) => doPeriodoPorId.get(p.colaboradorId) ?? p,
  );
  const plano = o ? planoDoModelo(comDias, o) : null;
  // Os avisos do período com o modelo: Atenção primeiro, depois Conferir e
  // os informativos (na ordem de cada pessoa e dia).
  const avisos =
    plano && atual === 4
      ? calcularAvisos(
          pessoasComOModelo(comDias, plano.gravar, turnos, o ?? undefined),
          dias,
          regras ?? undefined,
        ).sort(
          (a, b) =>
            ORDEM_DA_CATEGORIA[a.categoria] - ORDEM_DA_CATEGORIA[b.categoria],
        )
      : [];

  const nomeDoModelo = m
    ? `${m.nome}${turnoBase ? ` · ${turnoBase.nome}` : ""}`
    : "";
  const mes = inicio ? mesDoDia(inicio) : mesDoDia(hoje);

  // Na troca de etapa, o foco (e a rolagem) vai ao título da etapa nova.
  const primeiraEtapa = useRef(true);
  useEffect(() => {
    if (primeiraEtapa.current) {
      primeiraEtapa.current = false;
      return;
    }
    document.getElementById(idDaEtapa(atual))?.focus();
  }, [atual]);

  const irPara = (i: number) => {
    setMensagem(null);
    setAtual(i);
  };

  const validar = (): string | null => {
    if (atual === 0 && escolhidas.length === 0)
      return "Escolha ao menos uma pessoa.";
    if (atual === 1 && !modelo) return "Escolha uma escala.";
    if (atual === 2) {
      if (m?.tipo === "outra" && diasTrabalho.length === 0)
        return "Escolha ao menos um dia de trabalho.";
      if (usaPorDia ? diasFixos.some((d) => !turnoDoDia[d]) : !turno)
        return "Escolha o turno dos dias de trabalho.";
    }
    if (atual === 3) {
      if (!inicio) return "Informe quando o modelo começa.";
      if (!semFim && (!fim || fim < inicio))
        return "O fim precisa ser no início ou depois dele.";
      if (!semFim && fim > somarDias(inicio, 365))
        return "Escolha um fim até um ano depois do início.";
    }
    if (atual === 4) {
      if (doPeriodo === null) return "Aguarde: contando as células do período.";
      if (!semFim && plano?.gravar.length === 0) {
        return "Nada para aplicar: o período já está todo escalado. Volte ao Período e marque “Substituir o que já está escalado” para trocar.";
      }
    }
    return null;
  };

  const aplicar = async () => {
    if (!o || !plano || !modelo) return;
    setEnviando(true);
    setMensagem(null);
    try {
      const falhas: string[] = [];
      if (semFim) {
        for (const [i, p] of comDias.entries()) {
          const vigencia = inicio < p.dataAdmissao ? p.dataAdmissao : inicio;
          try {
            await definirEscala(p.colaboradorId, {
              modelo,
              tabelaHorarioId: turnoBase?.id ?? null,
              vigenciaInicio: vigencia,
              ...(modelo === "6x1"
                ? { folgaSemanal: folgaDaPessoa(folga, i) }
                : {}),
              ...(m?.tipo === "outra"
                ? { diasTrabalho: [...diasTrabalho] }
                : {}),
              ...(temCiclo(modelo) ? { inicioCiclo: inicio } : {}),
            });
          } catch (e) {
            const igual =
              e instanceof ApiError &&
              (e.erros ?? []).some((x) => x.motivo === "igual_a_vigente");
            if (!igual) falhas.push(p.nome);
          }
        }
      }
      await gravarDias(plano.gravar);
      avisarNoQuadro(
        `Modelo aplicado: ${plural(plano.gravar.length, "célula", "células")} no rascunho para ${plural(comDias.length, "pessoa", "pessoas")}` +
          (falhas.length > 0
            ? `. Sem trocar o padrão: ${falhas.join(", ")}.`
            : "."),
      );
      setConcluido(true);
    } catch {
      setMensagem(
        "Não foi possível aplicar o modelo. Nada foi publicado; tente de novo.",
      );
      setEnviando(false);
    }
  };

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const erro = validar();
    if (erro) {
      setMensagem(erro);
      return;
    }
    if (atual < ETAPAS.length - 1) {
      setAtual(atual + 1);
      setAlcancada(Math.max(alcancada, atual + 1));
      setMensagem(null);
      return;
    }
    void aplicar();
  };

  if (erroCarga) {
    return (
      <div className="modelo__aviso" role="alert">
        <p>Não foi possível carregar as pessoas e os turnos.</p>
      </div>
    );
  }
  if (!pessoas || !regras) {
    return <Esqueleto rotulo="Carregando o modelo…" linhas={6} />;
  }

  const descricaoDaEtapa =
    atual === 2 && m
      ? `${m.nome}: ${m.descricao.charAt(0).toLocaleLowerCase("pt-BR")}${m.descricao.slice(1)}.`
      : ETAPAS[atual]!.descricao;

  return (
    <CadastroEmEtapas
      tituloId={MODELO_ESCALA_TITULO_ID}
      titulo="Aplicar modelo de escala"
      descricao="Uma escala do catálogo para várias pessoas de uma vez. Tudo vai para o rascunho."
      rotuloVoltar="Voltar para a Escala de trabalho"
      onVoltarDaPagina={onVoltar}
      etapas={ETAPAS.map((e, i) =>
        i === atual ? { ...e, descricao: descricaoDaEtapa } : e,
      )}
      atual={atual}
      alcancada={alcancada}
      onIrParaEtapa={irPara}
      onSubmit={aoEnviar}
      rotuloConcluir="Aplicar ao rascunho"
      ocupado={enviando}
      mensagem={
        mensagem ? (
          <p role="alert" className="modelo__mensagem">
            {mensagem}
          </p>
        ) : undefined
      }
      tituloDaEtapa={TITULOS_DAS_ETAPAS[atual] ?? ""}
      className="modelo"
      idDoTituloDaEtapa={idDaEtapa}
    >
      {atual === 0 ? (
        <>
          <SecaoDoCadastro
            titulo="Pessoas"
            descricao="Os filtros da lista abaixo valem para as duas opções."
          >
            <LinhaDoCadastro rotulo="Para quem">
              <div
                className="modelo__opcoes"
                role="radiogroup"
                aria-label="Para quem"
              >
                <OpcaoEmCartao
                  marcada={paraQuem === "filtro"}
                  onMarcar={() => setParaQuem("filtro")}
                  titulo="Todo o time do filtro atual"
                  texto={`${pedido.current?.doFiltro ? "As pessoas do filtro do quadro" : "Todas as pessoas do quadro"} · ${plural(naLista.length, "pessoa", "pessoas")}`}
                />
                <OpcaoEmCartao
                  marcada={paraQuem === "escolher"}
                  onMarcar={() => setParaQuem("escolher")}
                  titulo="Escolher pessoas"
                  texto="Marque na lista abaixo."
                />
              </div>
            </LinhaDoCadastro>
          </SecaoDoCadastro>
          <SecaoDoCadastro
            titulo="Lista"
            descricao="Ativos, de férias e afastados da empresa ativa."
          >
            <div className="modelo__filtros">
              <input
                type="search"
                className="modelo__busca"
                placeholder="Buscar colaborador"
                aria-label="Buscar colaborador"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <FiltroDaLista
                rotulo="Unidade"
                valor={unidade}
                onMudar={setUnidade}
                opcoes={unidades}
                todos="Todas"
              />
              <FiltroDaLista
                rotulo="Departamento"
                valor={departamento}
                onMudar={setDepartamento}
                opcoes={departamentos}
                todos="Todos"
              />
              <FiltroDaLista
                rotulo="Contrato"
                valor={contrato}
                onMudar={setContrato}
                opcoes={contratos}
                todos="Todos"
              />
            </div>
            <table className="modelo__tabela">
              <thead>
                <tr>
                  {paraQuem === "escolher" ? (
                    <th scope="col" className="modelo__col-marca">
                      <span className="sr-only">Marcar</span>
                    </th>
                  ) : null}
                  <th scope="col">Colaborador</th>
                  <th scope="col">Contrato</th>
                  <th scope="col">Escala atual</th>
                </tr>
              </thead>
              <tbody>
                {naLista.map((p) => (
                  <tr key={p.colaboradorId}>
                    {paraQuem === "escolher" ? (
                      <td className="modelo__col-marca">
                        <input
                          type="checkbox"
                          aria-label={`Marcar ${p.nome}`}
                          checked={marcadas.has(p.colaboradorId)}
                          onChange={(e) => {
                            const novo = new Set(marcadas);
                            if (e.target.checked) novo.add(p.colaboradorId);
                            else novo.delete(p.colaboradorId);
                            setMarcadas(novo);
                          }}
                        />
                      </td>
                    ) : null}
                    <td>
                      <span className="modelo__pessoa">
                        <span className="modelo__avatar" aria-hidden="true">
                          {iniciais(p.nome)}
                        </span>
                        <span>
                          {p.nome}
                          {p.cargo ? <small>{p.cargo.nome}</small> : null}
                        </span>
                      </span>
                    </td>
                    <td>{rotuloDoContrato(p.tipoVinculo)}</td>
                    <td>{rotuloDaEscala(p, hoje)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {naLista.length === 0 ? (
              <p className="modelo__vazio">Ninguém com estes filtros.</p>
            ) : null}
            <p className="modelo__contagem" aria-live="polite">
              {plural(
                escolhidas.length,
                "pessoa selecionada",
                "pessoas selecionadas",
              )}
            </p>
          </SecaoDoCadastro>
        </>
      ) : null}

      {atual === 1 ? (
        <div className="modelo__catalogo">
          {GRUPOS_DE_ESCALA.map((g) => (
            <section key={g} className="modelo__grupo" aria-label={g}>
              <h3 className="modelo__grupo-titulo">{g}</h3>
              <div className="modelo__cartoes" role="radiogroup" aria-label={g}>
                {MODELOS_DE_ESCALA.filter((x) => x.grupo === g).map((x) => (
                  <button
                    key={x.codigo}
                    type="button"
                    role="radio"
                    aria-checked={modelo === x.codigo}
                    className={`modelo__cartao${modelo === x.codigo ? " modelo__cartao--marcado" : ""}`}
                    onClick={() => setModelo(x.codigo)}
                  >
                    <strong>{x.nome}</strong>
                    <span>{x.descricao}</span>
                    {x.tipo !== "outra" ? (
                      <small>{rotuloDosDias(x.codigo, mes)}</small>
                    ) : null}
                    {x.codigo === "5x2" ? (
                      <em className="modelo__selo modelo__selo--ok">
                        Padrão da EC 141
                      </em>
                    ) : null}
                    {x.codigo === "6x1" ? (
                      <em className="modelo__selo modelo__selo--atencao">{`Convenção a partir de ${diaMesCurto(regras.inicioTransicao)}`}</em>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {atual === 2 && m ? (
        <>
          <SecaoDoCadastro
            titulo="Turno"
            descricao="Pode trocar dia a dia depois, no quadro."
          >
            {m.tipo === "outra" ? (
              <LinhaDoCadastro
                rotulo="Dias de trabalho"
                ajuda="Os outros dias são folga; o domingo é o DSR."
              >
                <div
                  className="modelo__dias"
                  role="group"
                  aria-label="Dias de trabalho"
                >
                  {DIAS_DA_SEMANA.map((d) => (
                    <button
                      key={d.numero}
                      type="button"
                      aria-pressed={diasTrabalho.includes(d.numero)}
                      aria-label={d.nome}
                      className="modelo__dia"
                      onClick={() =>
                        setDiasTrabalho(
                          diasTrabalho.includes(d.numero)
                            ? diasTrabalho.filter((x) => x !== d.numero)
                            : [...diasTrabalho, d.numero].sort((a, b) => a - b),
                        )
                      }
                    >
                      {d.curto}
                    </button>
                  ))}
                </div>
              </LinhaDoCadastro>
            ) : null}
            {aceitaTurnoPorDia(m.codigo) ? (
              <LinhaDoCadastro
                rotulo="Horário"
                ajuda="Um turno para todos os dias ou um para cada dia."
                grupo={false}
              >
                <div
                  className="modelo__alternar"
                  role="radiogroup"
                  aria-label="Horário"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!porDia}
                    onClick={() => setPorDia(false)}
                  >
                    Mesmo turno todos os dias
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={porDia}
                    onClick={() => setPorDia(true)}
                  >
                    Um turno por dia
                  </button>
                </div>
              </LinhaDoCadastro>
            ) : null}
            {usaPorDia ? (
              <LinhaDoCadastro rotulo="Turno de cada dia">
                <div className="modelo__por-dia">
                  {diasFixos.map((d) => (
                    <label key={d}>
                      <span>{NOME_DO_DIA[d]}</span>
                      <select
                        value={turnoDoDia[d] ?? ""}
                        onChange={(e) =>
                          setTurnoDoDia({ ...turnoDoDia, [d]: e.target.value })
                        }
                      >
                        <option value="">Escolha um turno</option>
                        {turnos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {rotuloDoTurno(t)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </LinhaDoCadastro>
            ) : (
              <LinhaDoCadastro
                rotulo="Turno dos dias de trabalho"
                paraId="modelo-turno"
              >
                <select
                  id="modelo-turno"
                  value={turnoId}
                  onChange={(e) => setTurnoId(e.target.value)}
                >
                  <option value="">Escolha um turno</option>
                  {turnos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {rotuloDoTurno(t)}
                    </option>
                  ))}
                </select>
              </LinhaDoCadastro>
            )}
            <LinhaDoCadastro
              rotulo="Jornada na semana"
              ajuda="Calculada pelo turno e pela escala."
              grupo={false}
            >
              <dl className="modelo__jornada">
                <div>
                  <dt>Horas por semana</dt>
                  <dd>
                    {plano && plano.porPessoa[0]
                      ? formatarHoras(plano.porPessoa[0].minutosNaSemana)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Dias de benefício no mês</dt>
                  <dd>
                    {beneficioPelosDiasUteis(m.codigo)
                      ? "Dias úteis"
                      : diasNoMes(m.codigo, mes)}
                  </dd>
                </div>
              </dl>
            </LinhaDoCadastro>
          </SecaoDoCadastro>
          {m.codigo === "6x1" ? (
            <SecaoDoCadastro
              titulo="Folga semanal (DSR)"
              descricao="Um dia de descanso por semana."
            >
              <LinhaDoCadastro rotulo="Como distribuir">
                <div
                  className="modelo__opcoes"
                  role="radiogroup"
                  aria-label="Como distribuir"
                >
                  <OpcaoEmCartao
                    marcada={folga === "mesmo"}
                    onMarcar={() => setFolga("mesmo")}
                    titulo="Mesmo dia para todos"
                    texto="Todos folgam no domingo."
                  />
                  <OpcaoEmCartao
                    marcada={folga === "distribuir"}
                    onMarcar={() => setFolga("distribuir")}
                    titulo="Distribuir entre as pessoas"
                    texto="A folga gira para não deixar o mesmo dia sem ninguém."
                  />
                </div>
              </LinhaDoCadastro>
              <LinhaDoCadastro rotulo="Domingos" grupo={false}>
                <label className="modelo__marcar">
                  <input
                    type="checkbox"
                    checked={domingos}
                    onChange={(e) => setDomingos(e.target.checked)}
                  />
                  <span>
                    Folga no domingo pelo menos a cada 3 semanas
                    <small>
                      Regra do comércio (Lei 10.101/2000, art. 6º). Para
                      mulheres, a CLT prevê revezamento quinzenal (art. 386).
                      Confira a convenção coletiva.
                    </small>
                  </span>
                </label>
              </LinhaDoCadastro>
            </SecaoDoCadastro>
          ) : null}
          <SecaoDoCadastro
            titulo="Prévia"
            descricao="As duas primeiras semanas. Dá para ajustar no quadro."
          >
            <PreviaDasSemanas pessoas={comDias} o={o} />
          </SecaoDoCadastro>
        </>
      ) : null}

      {atual === 3 && m ? (
        <>
          <SecaoDoCadastro
            titulo="Datas"
            descricao="O início sugerido é o primeiro dia da próxima semana."
          >
            <LinhaDoCadastro rotulo="Começa em" paraId="modelo-inicio">
              <input
                id="modelo-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </LinhaDoCadastro>
            <LinhaDoCadastro rotulo="Termina">
              <div
                className="modelo__opcoes"
                role="radiogroup"
                aria-label="Termina"
              >
                <OpcaoEmCartao
                  marcada={!semFim}
                  onMarcar={() => setSemFim(false)}
                  titulo="Até uma data"
                  texto="Bom para uma escala de temporada."
                >
                  <input
                    type="date"
                    aria-label="Termina em"
                    value={fim}
                    disabled={semFim}
                    onChange={(e) => setFim(e.target.value)}
                  />
                </OpcaoEmCartao>
                <OpcaoEmCartao
                  marcada={semFim}
                  onMarcar={() => setSemFim(true)}
                  titulo="Sem data de fim"
                  texto={`Vira o padrão de cada pessoa e o quadro segue sozinho. A escala do cadastro muda para ${m.nome} a partir de ${diaMesCurto(inicio)}.`}
                />
              </div>
            </LinhaDoCadastro>
          </SecaoDoCadastro>
          <SecaoDoCadastro
            titulo="O que já existe no período"
            descricao="Dias com rascunho ou já publicados."
          >
            <LinhaDoCadastro rotulo="Células preenchidas" grupo={false}>
              <label className="modelo__marcar">
                <input
                  type="checkbox"
                  checked={substituir}
                  onChange={(e) => setSubstituir(e.target.checked)}
                />
                <span>
                  Substituir o que já está escalado
                  <small>
                    {doPeriodo === null
                      ? "Contando as células já preenchidas…"
                      : textoDoSubstituir(plano?.ocupadas ?? 0)}
                  </small>
                </span>
              </label>
            </LinhaDoCadastro>
            <LinhaDoCadastro rotulo="Publicação" grupo={false}>
              <p className="modelo__nota">
                A escala publicada não muda até você publicar de novo. Férias e
                ausências ainda não entram no quadro: confira antes de publicar.
              </p>
            </LinhaDoCadastro>
          </SecaoDoCadastro>
        </>
      ) : null}

      {atual === 4 && m && plano ? (
        <>
          <SecaoDoCadastro
            titulo="Resumo"
            descricao={
              semFim
                ? `Sem data de fim: o padrão de cada pessoa passa a ser ${nomeDoModelo} a partir de ${formatarDiaCivil(inicio)}, e o rascunho recebe as próximas 8 semanas. Depois, o quadro segue pelo padrão.`
                : `Até ${formatarDiaCivil(fim)}: só o rascunho muda; o padrão de cada pessoa continua o mesmo.`
            }
          >
            <dl className="modelo__resumo">
              <div>
                <dt>Pessoas</dt>
                <dd>{escolhidas.length}</dd>
              </div>
              <div>
                <dt>Escala</dt>
                <dd>{nomeDoModelo}</dd>
              </div>
              <div>
                <dt>A partir de</dt>
                <dd>{formatarDiaCivil(inicio)}</dd>
              </div>
              <div>
                <dt>Células no rascunho</dt>
                <dd>{doPeriodo === null ? "…" : plano.gravar.length}</dd>
              </div>
            </dl>
            {modelo === "6x1" && domingos ? (
              <p className="modelo__nota">
                {`A folga no domingo a cada 3 semanas vale para ${semFim ? "estas 8 semanas" : "este período"}. Depois, confira os avisos de domingo no quadro.`}
              </p>
            ) : null}
          </SecaoDoCadastro>
          <SecaoDoCadastro
            titulo="Por pessoa"
            descricao="Horas da primeira semana e dias de benefício no mês."
          >
            <table className="modelo__tabela">
              <thead>
                <tr>
                  <th scope="col">Colaborador</th>
                  <th scope="col">Horas na semana</th>
                  <th scope="col">Dias no mês</th>
                  <th scope="col">Avisos</th>
                  {escolhidas.length > 1 ? (
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {plano.porPessoa.map((x) => {
                  const dela = avisos.filter(
                    (a) => a.colaboradorId === x.colaboradorId,
                  );
                  return (
                    <tr key={x.colaboradorId}>
                      <td>
                        <span className="modelo__pessoa">
                          <span className="modelo__avatar" aria-hidden="true">
                            {iniciais(x.nome)}
                          </span>
                          {x.nome}
                        </span>
                      </td>
                      <td>{formatarHoras(x.minutosNaSemana)}</td>
                      <td>
                        {beneficioPelosDiasUteis(m.codigo)
                          ? "Dias úteis"
                          : diasNoMes(m.codigo, mes)}
                      </td>
                      <td>
                        {dela.length === 0 ? (
                          "Nenhum"
                        ) : (
                          <span
                            className={`modelo__selo modelo__selo--${dela.some((a) => a.categoria === "atencao") ? "perigo" : "atencao"}`}
                          >
                            {`${dela.length} · ${dela[0]!.titulo}`}
                          </span>
                        )}
                      </td>
                      {escolhidas.length > 1 ? (
                        <td>
                          <button
                            type="button"
                            className="modelo__tirar"
                            onClick={() =>
                              setTiradas(new Set([...tiradas, x.colaboradorId]))
                            }
                          >
                            {`Tirar ${x.nome} do modelo`}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SecaoDoCadastro>
          <SecaoDoCadastro
            titulo="Avisos encontrados"
            descricao="Não impedem aplicar. Dá para corrigir agora ou depois, no quadro."
          >
            {avisos.length === 0 ? (
              <p className="modelo__nota">Nenhum aviso da CLT.</p>
            ) : (
              <>
                <ul className="modelo__avisos">
                  {(todosOsAvisos ? avisos : avisos.slice(0, 5)).map((a, i) => (
                    <li
                      key={`${a.colaboradorId}-${a.chave}-${a.dia}-${i}`}
                      className={`modelo__aviso-item modelo__aviso-item--${a.categoria}`}
                    >
                      <strong>{`${a.nome}: ${a.titulo} · ${diaMesCurto(a.dia)}`}</strong>
                      <span>{a.explicacao}</span>
                    </li>
                  ))}
                </ul>
                {avisos.length > 5 && !todosOsAvisos ? (
                  <button
                    type="button"
                    className="modelo__tirar"
                    onClick={() => setTodosOsAvisos(true)}
                  >
                    {`Ver os ${avisos.length} avisos`}
                  </button>
                ) : null}
              </>
            )}
          </SecaoDoCadastro>
        </>
      ) : null}
    </CadastroEmEtapas>
  );
}

function OpcaoEmCartao({
  marcada,
  onMarcar,
  titulo,
  texto,
  children,
}: {
  readonly marcada: boolean;
  readonly onMarcar: () => void;
  readonly titulo: string;
  readonly texto: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className={`modelo__opcao${marcada ? " modelo__opcao--marcada" : ""}`}>
      <button
        type="button"
        role="radio"
        aria-checked={marcada}
        className="modelo__opcao-botao"
        onClick={onMarcar}
      >
        <span className="modelo__opcao-radio" aria-hidden="true" />
        <span className="modelo__opcao-textos">
          <strong>{titulo}</strong>
          <span>{texto}</span>
        </span>
      </button>
      {children ? <div className="modelo__opcao-extra">{children}</div> : null}
    </div>
  );
}

function FiltroDaLista({
  rotulo,
  valor,
  onMudar,
  opcoes,
  todos,
}: {
  readonly rotulo: string;
  readonly valor: string;
  readonly onMudar: (v: string) => void;
  readonly opcoes: readonly (readonly [string, string])[];
  readonly todos: string;
}) {
  return (
    <label className="modelo__filtro">
      <span>{`${rotulo}:`}</span>
      <select
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        aria-label={rotulo}
      >
        <option value="">{todos}</option>
        {opcoes.map(([id, nome]) => (
          <option key={id} value={id}>
            {nome}
          </option>
        ))}
      </select>
    </label>
  );
}

/** As duas primeiras semanas do modelo, por pessoa (até 6 pessoas). */
function PreviaDasSemanas({
  pessoas,
  o,
}: {
  readonly pessoas: readonly PessoaDoQuadroApi[];
  readonly o: OpcoesDoModelo | null;
}) {
  if (!o || pessoas.length === 0)
    return <p className="modelo__nota">Escolha o turno para ver a prévia.</p>;
  const dias = diasDoPeriodo(o.inicio, somarDias(o.inicio, 13));
  const mostradas = pessoas.slice(0, 6);
  return (
    <div
      className="modelo__previa"
      role="region"
      aria-label="Prévia das duas primeiras semanas"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Colaborador</span>
            </th>
            {dias.map((d) => (
              <th key={d} scope="col">
                {LETRAS_DOS_DIAS[diaDaSemana(d) - 1]}
                <small>{numeroDoDia(d)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mostradas.map((p, i) => (
            <tr key={p.colaboradorId}>
              <th scope="row">{p.nome}</th>
              {celulasDoModelo(p, o, i, dias).map((c, j) => (
                <td
                  key={dias[j]}
                  className={`modelo__sigla modelo__sigla--${c?.tipo ?? "fora"}`}
                >
                  {!c
                    ? "–"
                    : c.tipo === "trabalho"
                      ? c.turno?.sigla || c.turno?.nome.charAt(0) || "T"
                      : c.tipo === "dsr"
                        ? "D"
                        : "F"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pessoas.length > mostradas.length ? (
        <p className="modelo__nota">{`E mais ${plural(pessoas.length - mostradas.length, "pessoa", "pessoas")}.`}</p>
      ) : null}
    </div>
  );
}
