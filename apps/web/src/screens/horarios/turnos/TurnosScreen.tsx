/**
 * T215 — Turnos da escala (Colaboradores › Escala de trabalho › Turnos), no
 * desenho da referência:
 *
 * - **Lista:** Turno (sigla na cor), Horário, Intervalo, Trabalho no dia,
 *   Unidade e Em uso; filtro por unidade; ⋯ com Editar, Duplicar e
 *   Arquivar (Reativar nos arquivados, que ficam numa seção à parte).
 * - **Novo/Editar turno:** identificação (nome, cor, unidade), prévia "No
 *   quadro" e a sigla do mês; horários "Mesmo horário todo dia" ou "Horário
 *   por dia da semana" (até 3 períodos por dia, intervalo, totais e as notas
 *   da CLT); marcação e cobertura (tolerância e mínimo por dia).
 *
 * Os turnos são as jornadas da empresa. Só o RH cria, edita, arquiva e
 * reativa; DP e master consultam. Mudar o horário vale para o rascunho a
 * partir de hoje; o que já foi publicado não muda.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ApiError,
  criarTabelaHorario,
  desativarTabelaHorario,
  editarTabelaHorario,
  listarTabelasHorario,
  reativarTabelaHorario,
  type CriarTabelaHorarioDto,
  type DiaSemana,
  type EditarTabelaHorarioDto,
  type TabelaHorarioApi,
} from "../../../api/horariosClient";
import {
  listarUnidadesParaEquipe,
  type UnidadeOrganizacionalApi,
} from "../../../api/organizacaoClient";
import { Button } from "../../../components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../ui";
import { IconeMais, IconeMaisAcoes, IconeVoltar } from "../../../ui/icones";
import { AvisoAnimado, Esqueleto, Revelar } from "../../../ui/movimento";
import { useEdicaoEmAndamento } from "../../../app/edicoesPendentes";
import {
  CORES_DE_TURNO,
  DIAS,
  INTERVALOS,
  type Periodo,
  corDoTurno,
  diaTipico,
  faixa,
  horasCompactas,
  horasLegiveis,
  minutos,
  pausaDoDia,
  periodosPorDia,
  resumoPorDia,
  rotuloDeUso,
  rotuloDoIntervalo,
  siglaDoNome,
  trabalhoNoDia,
} from "./turnos";
import "./TurnosScreen.css";

export const TURNOS_TITULO_ID = "turnos-titulo";

/** As operações da tela (o servidor, ou um dublê nos testes). */
export interface ServicoDeTurnos {
  listar(): Promise<TabelaHorarioApi[]>;
  unidades(): Promise<UnidadeOrganizacionalApi[]>;
  criar(dto: CriarTabelaHorarioDto): Promise<TabelaHorarioApi>;
  editar(id: string, dto: EditarTabelaHorarioDto): Promise<TabelaHorarioApi>;
  arquivar(id: string): Promise<TabelaHorarioApi>;
  reativar(id: string): Promise<TabelaHorarioApi>;
}

export const servicoDeTurnosDoServidor: ServicoDeTurnos = {
  listar: async () =>
    (await listarTabelasHorario({ tamanhoPagina: 100 })).itens,
  unidades: async () => (await listarUnidadesParaEquipe()).itens,
  criar: criarTabelaHorario,
  editar: editarTabelaHorario,
  arquivar: desativarTabelaHorario,
  reativar: reativarTabelaHorario,
};

export interface TurnosScreenProps {
  /** Só o RH cria, edita, arquiva e reativa. */
  readonly podeOperar?: boolean;
  /** Volta para o quadro da escala. */
  readonly onVoltar?: () => void;
  readonly servico?: ServicoDeTurnos;
}

type Formulario =
  | { readonly modo: "novo"; readonly base?: TabelaHorarioApi }
  | { readonly modo: "editar"; readonly turno: TabelaHorarioApi };

function nomeDaUnidade(
  id: string | null | undefined,
  unidades: readonly UnidadeOrganizacionalApi[],
): string {
  if (!id) return "Todas";
  return unidades.find((u) => u.id === id)?.nome ?? "Unidade";
}

export function TurnosScreen({
  podeOperar = false,
  onVoltar,
  servico = servicoDeTurnosDoServidor,
}: TurnosScreenProps) {
  const [estado, setEstado] = useState<"carregando" | "erro" | "pronto">(
    "carregando",
  );
  const [turnos, setTurnos] = useState<TabelaHorarioApi[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOrganizacionalApi[]>([]);
  const [unidade, setUnidade] = useState("");
  const [arquivadosAbertos, setArquivadosAbertos] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aviso, setAviso] = useState("");
  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const focarTitulo = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const [lista, unidadesDaEmpresa] = await Promise.all([
        servico.listar(),
        servico.unidades().catch(() => []),
      ]);
      setTurnos(lista);
      setUnidades(unidadesDaEmpresa);
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  }, [servico]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!focarTitulo.current || formulario !== null) return;
    focarTitulo.current = false;
    tituloRef.current?.focus();
  });

  if (formulario) {
    return (
      <FormularioDeTurno
        formulario={formulario}
        turnos={turnos}
        unidades={unidades}
        servico={servico}
        onCancelar={() => {
          focarTitulo.current = true;
          setFormulario(null);
        }}
        onGravado={(mensagem) => {
          focarTitulo.current = true;
          setAviso(mensagem);
          setFormulario(null);
          void carregar();
        }}
      />
    );
  }

  const filtrados = turnos.filter(
    (t) =>
      unidade === "" ||
      !t.unidadeOrganizacionalId ||
      t.unidadeOrganizacionalId === unidade,
  );
  const ativos = filtrados.filter((t) => t.ativo);
  const arquivados = filtrados.filter((t) => !t.ativo);

  async function arquivar(t: TabelaHorarioApi) {
    try {
      await servico.arquivar(t.id);
      setAviso(
        `${t.nome} foi arquivado. Saiu do menu do quadro; o histórico continua.`,
      );
      await carregar();
    } catch {
      setAviso("Não foi possível arquivar o turno. Tente de novo.");
    }
  }

  async function reativar(t: TabelaHorarioApi) {
    try {
      await servico.reativar(t.id);
      setAviso(`${t.nome} voltou para o menu do quadro.`);
      await carregar();
    } catch {
      setAviso("Não foi possível reativar o turno. Tente de novo.");
    }
  }

  const contagem = `${ativos.length} ${ativos.length === 1 ? "turno ativo" : "turnos ativos"}${
    arquivados.length > 0
      ? ` · ${arquivados.length} ${arquivados.length === 1 ? "arquivado" : "arquivados"}`
      : ""
  }`;

  return (
    <Revelar>
      <section className="turnos" aria-labelledby={TURNOS_TITULO_ID}>
        <header className="turnos__cabeca">
          {onVoltar ? (
            <button
              type="button"
              className="turnos__voltar"
              aria-label="Voltar para a escala de trabalho"
              onClick={onVoltar}
            >
              <IconeVoltar tamanho={18} />
            </button>
          ) : null}
          <div className="turnos__cabeca-textos">
            <h1
              id={TURNOS_TITULO_ID}
              ref={tituloRef}
              tabIndex={-1}
              className="turnos__titulo"
            >
              Turnos
            </h1>
            <p className="turnos__subtitulo">
              Os horários que a empresa usa no quadro de escala.
            </p>
          </div>
          {!podeOperar ? (
            <span className="turnos__consulta">Somente consulta</span>
          ) : null}
          {podeOperar ? (
            <Button
              type="button"
              onClick={() => setFormulario({ modo: "novo" })}
            >
              <IconeMais tamanho={16} />
              Novo turno
            </Button>
          ) : null}
        </header>

        <AvisoAnimado className="turnos__status" mensagem={aviso} />

        {estado === "carregando" ? (
          <Esqueleto rotulo="Carregando turnos…" linhas={4} />
        ) : estado === "erro" ? (
          <div className="turnos__aviso" role="alert">
            <p>Não foi possível carregar os turnos.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEstado("carregando");
                void carregar();
              }}
            >
              Tentar de novo
            </Button>
          </div>
        ) : (
          <>
            <div className="turnos__barra">
              <label className="turnos__filtro">
                <span>Unidade:</span>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  aria-label="Unidade"
                >
                  <option value="">Todas</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </label>
              <p className="turnos__contagem">{contagem}</p>
            </div>

            {ativos.length === 0 ? (
              <div className="turnos__vazio">
                <p className="turnos__vazio-titulo">Nenhum turno ativo</p>
                <p className="turnos__vazio-texto">
                  Crie um turno para usá-lo no quadro e na escala de cada
                  pessoa.
                </p>
              </div>
            ) : (
              <TabelaDeTurnos
                rotulo="Turnos ativos"
                turnos={ativos}
                unidades={unidades}
                podeOperar={podeOperar}
                onEditar={(t) => setFormulario({ modo: "editar", turno: t })}
                onDuplicar={(t) => setFormulario({ modo: "novo", base: t })}
                onArquivar={(t) => void arquivar(t)}
                onReativar={(t) => void reativar(t)}
              />
            )}

            {arquivados.length > 0 ? (
              <div className="turnos__arquivados">
                <button
                  type="button"
                  className="turnos__arquivados-botao"
                  aria-expanded={arquivadosAbertos}
                  onClick={() => setArquivadosAbertos((a) => !a)}
                >
                  <strong>Arquivados</strong>
                  <span>
                    {arquivados
                      .map((t) => `${t.nome} · ${faixa(diaTipico(t))}`)
                      .join(", ")}
                  </span>
                  <span className="turnos__arquivados-nota">
                    Fica no histórico das escalas antigas
                  </span>
                </button>
                {arquivadosAbertos ? (
                  <TabelaDeTurnos
                    rotulo="Turnos arquivados"
                    turnos={arquivados}
                    unidades={unidades}
                    podeOperar={podeOperar}
                    onEditar={(t) =>
                      setFormulario({ modo: "editar", turno: t })
                    }
                    onDuplicar={(t) => setFormulario({ modo: "novo", base: t })}
                    onArquivar={(t) => void arquivar(t)}
                    onReativar={(t) => void reativar(t)}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </Revelar>
  );
}

function SiglaDoTurno({ t }: { readonly t: TabelaHorarioApi }) {
  return (
    <span
      className="turnos__sigla"
      style={{ background: corDoTurno(t.cor) }}
      aria-hidden="true"
    >
      {t.sigla ?? siglaDoNome(t.nome)}
    </span>
  );
}

function TabelaDeTurnos({
  rotulo,
  turnos,
  unidades,
  podeOperar,
  onEditar,
  onDuplicar,
  onArquivar,
  onReativar,
}: {
  readonly rotulo: string;
  readonly turnos: TabelaHorarioApi[];
  readonly unidades: readonly UnidadeOrganizacionalApi[];
  readonly podeOperar: boolean;
  readonly onEditar: (t: TabelaHorarioApi) => void;
  readonly onDuplicar: (t: TabelaHorarioApi) => void;
  readonly onArquivar: (t: TabelaHorarioApi) => void;
  readonly onReativar: (t: TabelaHorarioApi) => void;
}) {
  return (
    <div className="turnos__tabela-moldura">
      <table className="turnos__tabela" aria-label={rotulo}>
        <thead>
          <tr>
            <th scope="col">Turno</th>
            <th scope="col">Horário</th>
            <th scope="col">Intervalo</th>
            <th scope="col">Trabalho no dia</th>
            <th scope="col">Unidade</th>
            <th scope="col">Em uso</th>
            {podeOperar ? (
              <th scope="col">
                <span className="ev:sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => {
            const dia = diaTipico(t);
            const intervalo = t.intervaloMinutos ?? 0;
            const pausa = pausaDoDia(dia, intervalo);
            return (
              <tr key={t.id}>
                <th scope="row">
                  <span className="turnos__nome">
                    <SiglaDoTurno t={t} />
                    {t.nome}
                  </span>
                </th>
                <td data-rotulo="Horário">{faixa(dia) || "—"}</td>
                <td data-rotulo="Intervalo">
                  {pausa === 0 ? "Sem" : rotuloDoIntervalo(pausa)}
                </td>
                <td data-rotulo="Trabalho no dia">
                  {horasLegiveis(trabalhoNoDia(dia, intervalo))}
                </td>
                <td data-rotulo="Unidade">
                  {nomeDaUnidade(t.unidadeOrganizacionalId, unidades)}
                </td>
                <td data-rotulo="Em uso">{rotuloDeUso(t.emUso)}</td>
                {podeOperar ? (
                  <td className="turnos__acoes">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="turnos__mais"
                        aria-label={`Ações do turno ${t.nome}`}
                      >
                        <IconeMaisAcoes tamanho={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => onEditar(t)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onDuplicar(t)}>
                          <span className="turnos__item">
                            Duplicar
                            <small>{`Cria "${t.nome} (cópia)" para ajustar`}</small>
                          </span>
                        </DropdownMenuItem>
                        {t.ativo ? (
                          <DropdownMenuItem onSelect={() => onArquivar(t)}>
                            <span className="turnos__item">
                              Arquivar
                              <small>
                                Sai do menu do quadro; o histórico fica
                              </small>
                            </span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => onReativar(t)}>
                            <span className="turnos__item">
                              Reativar
                              <small>Volta para o menu do quadro</small>
                            </span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------ Formulário

type Erros = Partial<
  Record<"nome" | "sigla" | "horarios" | "unidade" | "geral", string>
>;

function horariosIniciais(base: TabelaHorarioApi | undefined) {
  if (!base) {
    return {
      modo: "mesmo_horario" as const,
      todoDia: [{ inicio: "08:00", fim: "17:00" }] as Periodo[],
      porDia: new Map(
        DIAS.map((d, i) => [
          d.dia,
          i < 5 ? [{ inicio: "08:00", fim: "17:00" }] : [],
        ]),
      ) as Map<string, Periodo[]>,
      intervalo: 60,
    };
  }
  const mapa = periodosPorDia(base);
  const modo = base.modo === "mesmo_horario" ? "mesmo_horario" : "por_dia";
  return {
    modo,
    todoDia: diaTipico(base),
    porDia: new Map(DIAS.map((d) => [d.dia, mapa.get(d.dia) ?? []])) as Map<
      string,
      Periodo[]
    >,
    intervalo: base.intervaloMinutos ?? 0,
  } as const;
}

function FormularioDeTurno({
  formulario,
  turnos,
  unidades,
  servico,
  onCancelar,
  onGravado,
}: {
  readonly formulario: Formulario;
  readonly turnos: TabelaHorarioApi[];
  readonly unidades: readonly UnidadeOrganizacionalApi[];
  readonly servico: ServicoDeTurnos;
  readonly onCancelar: () => void;
  readonly onGravado: (mensagem: string) => void;
}) {
  const base = useId();
  const editando = formulario.modo === "editar" ? formulario.turno : null;
  const origem =
    formulario.modo === "editar" ? formulario.turno : formulario.base;
  const outros = turnos.filter((t) => t.id !== editando?.id && t.ativo);
  const corLivre =
    CORES_DE_TURNO.find((c) => !outros.some((t) => t.cor === c.codigo))
      ?.codigo ?? "azul";
  const inicial = {
    nome: editando?.nome ?? (origem ? `${origem.nome} (cópia)` : ""),
    cor: editando?.cor ?? (origem ? corLivre : corLivre),
    unidade: origem?.unidadeOrganizacionalId ?? "",
    sigla: editando?.sigla ?? "",
    tolerancia:
      origem?.toleranciaMinutos === undefined
        ? "5"
        : origem.toleranciaMinutos === null
          ? ""
          : String(origem.toleranciaMinutos),
    minimo:
      origem?.minimoPorDia === undefined || origem.minimoPorDia === null
        ? ""
        : String(origem.minimoPorDia),
  };
  const horarios = horariosIniciais(origem);

  const [nome, setNome] = useState(inicial.nome);
  const [cor, setCor] = useState(inicial.cor);
  const [unidade, setUnidade] = useState(inicial.unidade);
  const [sigla, setSigla] = useState(inicial.sigla);
  const [siglaTocada, setSiglaTocada] = useState(editando !== null);
  const [modo, setModo] = useState<"mesmo_horario" | "por_dia">(horarios.modo);
  const [todoDia, setTodoDia] = useState<Periodo[]>(horarios.todoDia);
  const [porDia, setPorDia] = useState<Map<string, Periodo[]>>(horarios.porDia);
  const [intervalo, setIntervalo] = useState(horarios.intervalo);
  const [tolerancia, setTolerancia] = useState(inicial.tolerancia);
  const [minimo, setMinimo] = useState(inicial.minimo);
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const focoRef = useRef<string | null>(null);

  const horariosMudaram =
    modo !== horarios.modo ||
    intervalo !== horarios.intervalo ||
    JSON.stringify(todoDia) !== JSON.stringify(horarios.todoDia) ||
    JSON.stringify([...porDia]) !== JSON.stringify([...horarios.porDia]);
  const siglaEfetiva = (siglaTocada ? sigla : siglaDoNome(nome)).toUpperCase();
  const alterado =
    nome !== inicial.nome ||
    cor !== inicial.cor ||
    unidade !== inicial.unidade ||
    (siglaTocada && sigla !== inicial.sigla) ||
    tolerancia !== inicial.tolerancia ||
    minimo !== inicial.minimo ||
    horariosMudaram;

  useEdicaoEmAndamento("Turnos", {
    pendente: alterado,
    salvando: enviando,
  });

  useEffect(() => {
    const alvo = focoRef.current;
    if (alvo === null) return;
    focoRef.current = null;
    document.getElementById(alvo)?.focus();
  });

  const diasDoTurno =
    modo === "mesmo_horario"
      ? new Map(DIAS.map((d) => [d.dia, todoDia]))
      : porDia;
  const totalSemana = DIAS.reduce(
    (total, d) =>
      total + trabalhoNoDia(diasDoTurno.get(d.dia) ?? [], intervalo),
    0,
  );
  const exemplo = modo === "mesmo_horario" ? todoDia : diaDoExemplo(porDia);
  const trabalhoDoExemplo = trabalhoNoDia(exemplo, intervalo);
  const maisDeSeis = DIAS.some(
    (d) =>
      trabalhoNoDia(diasDoTurno.get(d.dia) ?? [], intervalo) > 6 * 60 &&
      pausaDoDia(diasDoTurno.get(d.dia) ?? [], intervalo) < 60,
  );
  const maisDeDez = DIAS.some(
    (d) => trabalhoNoDia(diasDoTurno.get(d.dia) ?? [], intervalo) > 10 * 60,
  );

  function validar(): Erros {
    const e: Erros = {};
    if (!nome.trim()) e.nome = "Dê um nome ao turno.";
    if (!/^[A-Za-zÀ-ÿ0-9]{1,2}$/.test(siglaEfetiva)) {
      e.sigla = "Use 1 ou 2 letras.";
    }
    {
      const todos = modo === "mesmo_horario" ? [todoDia] : [...porDia.values()];
      if (todos.every((l) => l.length === 0)) {
        e.horarios = "Marque ao menos um dia de trabalho.";
      } else if (
        todos.some((l) => l.some((p) => minutos(p.fim) <= minutos(p.inicio)))
      ) {
        // T215 — turno que passa da meia-noite ainda não é aceito na
        // jornada (o ponto e as horas previstas leem o dia civil); o horário
        // da noite vai no quadro da escala, dia a dia.
        e.horarios =
          "O fim de cada período precisa ser depois do início, no mesmo dia. Horário que passa da meia-noite vai no quadro da escala, dia a dia.";
      } else if (todos.some((l) => sobrepostos(l))) {
        e.horarios = "Os períodos de um dia não podem se sobrepor.";
      }
    }
    return e;
  }

  async function gravar(evento?: FormEvent) {
    evento?.preventDefault();
    if (enviando) return;
    const e = validar();
    if (Object.keys(e).length > 0) {
      setErros(e);
      focoRef.current = e.nome
        ? `${base}-nome`
        : e.sigla
          ? `${base}-sigla`
          : `${base}-horarios`;
      return;
    }
    setEnviando(true);
    setErros({});
    const comuns = {
      cor,
      sigla: siglaEfetiva,
      unidadeOrganizacionalId: unidade || null,
      toleranciaMinutos: tolerancia === "" ? null : Number(tolerancia),
      minimoPorDia: minimo === "" ? null : Number(minimo),
    };
    const periodos =
      modo === "mesmo_horario"
        ? todoDia.map((p) => ({ dia: "segunda" as DiaSemana, ...p }))
        : DIAS.flatMap((d) =>
            (porDia.get(d.dia) ?? []).map((p) => ({
              dia: d.dia as DiaSemana,
              ...p,
            })),
          );
    try {
      if (editando) {
        await servico.editar(editando.id, {
          nome: nome.trim(),
          ...comuns,
          ...(horariosMudaram
            ? { periodos, modo, intervaloMinutos: intervalo }
            : {}),
        });
        onGravado(`Turno ${nome.trim()} salvo.`);
      } else {
        await servico.criar({
          nome: nome.trim(),
          periodos,
          modo,
          intervaloMinutos: intervalo,
          ...comuns,
        });
        onGravado(
          `Turno ${nome.trim()} criado. Já aparece no menu das células do quadro.`,
        );
      }
    } catch (erro) {
      const campos = erro instanceof ApiError ? (erro.erros ?? []) : [];
      if (campos.some((c) => c.campo === "unidadeOrganizacionalId")) {
        setErros({ unidade: "Esta unidade não está disponível." });
        focoRef.current = `${base}-unidade`;
      } else {
        setErros({
          geral:
            "Não foi possível salvar o turno. Confira os campos e tente de novo.",
        });
        focoRef.current = `${base}-geral`;
      }
    } finally {
      setEnviando(false);
    }
  }

  const uso = origem?.emUso ?? 0;
  const tituloId = `${base}-titulo`;

  return (
    <section className="turno-form" aria-labelledby={tituloId}>
      <header className="turnos__cabeca">
        <button
          type="button"
          className="turnos__voltar"
          aria-label="Voltar para turnos"
          onClick={onCancelar}
        >
          <IconeVoltar tamanho={18} />
        </button>
        <div className="turnos__cabeca-textos">
          <h1 id={tituloId} tabIndex={-1} className="turnos__titulo">
            {editando ? "Editar turno" : "Novo turno"}
          </h1>
          <p className="turnos__subtitulo">
            {editando
              ? `${editando.nome} · ${uso > 0 ? `usado por ${rotuloDeUso(uso)}` : "sem uso"}`
              : "Fica disponível no quadro assim que você criar."}
          </p>
        </div>
      </header>

      <form
        className="turno-form__corpo"
        noValidate
        onSubmit={(e) => void gravar(e)}
      >
        <div className="turno-form__secao turno-form__secao--dupla">
          <div className="turno-form__campos">
            <h2 className="turno-form__secao-titulo">Identificação</h2>
            <p className="turno-form__ajuda">
              Como o turno aparece no quadro, na ficha e no Portal.
            </p>
            <div className="turno-form__campo">
              <label htmlFor={`${base}-nome`}>
                Nome do turno <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${base}-nome`}
                value={nome}
                maxLength={40}
                required
                placeholder="Ex.: Manhã, Comercial"
                aria-invalid={erros.nome ? "true" : undefined}
                aria-describedby={`${base}-nome-ajuda`}
                disabled={enviando}
                onChange={(e) => {
                  setNome(e.target.value);
                  setErros((atual) => semErro(atual, "nome"));
                }}
              />
              <span id={`${base}-nome-ajuda`} className="turno-form__ajuda">
                {erros.nome ??
                  "Até 40 caracteres. Aparece na célula do quadro."}
              </span>
            </div>
            <fieldset className="turno-form__cores">
              <legend>Cor</legend>
              <div className="turno-form__cores-lista" role="radiogroup">
                {CORES_DE_TURNO.map((c) => {
                  const dono = outros.find((t) => t.cor === c.codigo);
                  return (
                    <label
                      key={c.codigo}
                      className={`turno-form__cor${dono ? " turno-form__cor--usada" : ""}`}
                      title={dono ? `Usada por ${dono.nome}` : c.nome}
                    >
                      <input
                        type="radio"
                        name={`${base}-cor`}
                        aria-label={
                          dono ? `${c.nome}, usada por ${dono.nome}` : c.nome
                        }
                        checked={cor === c.codigo}
                        disabled={enviando}
                        onChange={() => setCor(c.codigo)}
                      />
                      <span
                        className="turno-form__cor-amostra"
                        style={{ background: corDoTurno(c.codigo) }}
                        aria-hidden="true"
                      />
                    </label>
                  );
                })}
              </div>
              <p className="turno-form__ajuda">
                As cores apagadas já são de outros turnos. Passe o mouse para
                ver de qual.
              </p>
            </fieldset>
            <div className="turno-form__campo">
              <label htmlFor={`${base}-unidade`}>Unidade</label>
              <select
                id={`${base}-unidade`}
                value={unidade}
                disabled={enviando}
                aria-invalid={erros.unidade ? "true" : undefined}
                onChange={(e) => setUnidade(e.target.value)}
              >
                <option value="">Todas as unidades</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
              <span className="turno-form__ajuda">
                {erros.unidade ??
                  "Com uma unidade, o turno só aparece para quem é dela."}
              </span>
            </div>
          </div>

          <aside className="turno-form__previa" aria-label="No quadro">
            <p className="turno-form__previa-rotulo">No quadro</p>
            <div className="turno-form__previa-linha">
              <div className="turno-form__previa-cartao">
                <span className="turno-form__previa-nome">
                  <span
                    className="turno-form__ponto"
                    style={{ background: corDoTurno(cor) }}
                    aria-hidden="true"
                  />
                  {nome.trim() || "Nome do turno"}
                </span>
                <span className="turno-form__previa-horario">
                  {faixa(exemplo) || "—"}
                </span>
                <span className="turno-form__previa-legenda">Semana</span>
              </div>
              <div className="turno-form__previa-mes">
                <span
                  className="turno-form__previa-sigla"
                  style={{ borderColor: corDoTurno(cor) }}
                >
                  {siglaEfetiva || "?"}
                </span>
                <span className="turno-form__previa-legenda">Mês</span>
              </div>
            </div>
            <div className="turno-form__campo">
              <label htmlFor={`${base}-sigla`}>Sigla no mês</label>
              <input
                id={`${base}-sigla`}
                value={siglaEfetiva}
                maxLength={2}
                disabled={enviando}
                aria-invalid={erros.sigla ? "true" : undefined}
                aria-describedby={`${base}-sigla-ajuda`}
                onChange={(e) => {
                  setSiglaTocada(true);
                  setSigla(e.target.value.toUpperCase());
                  setErros((atual) => semErro(atual, "sigla"));
                }}
              />
              <span id={`${base}-sigla-ajuda`} className="turno-form__ajuda">
                {erros.sigla ?? "1 ou 2 letras."}
              </span>
            </div>
          </aside>
        </div>

        <div className="turno-form__secao">
          <h2 className="turno-form__secao-titulo">Horários</h2>
          <p className="turno-form__ajuda">
            Cada dia pode ter até 3 períodos. A pausa entre eles é calculada.
          </p>
          <div
            className="turno-form__abas"
            role="tablist"
            aria-label="Horários"
          >
            {(
              [
                ["mesmo_horario", "Mesmo horário todo dia"],
                ["por_dia", "Horário por dia da semana"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={modo === valor}
                className="turno-form__aba"
                disabled={enviando}
                onClick={() => setModo(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <p className="turno-form__ajuda">
            {modo === "mesmo_horario"
              ? "Para revezamento (6x1, 12x36): os dias vêm da escala de cada pessoa."
              : "Jornada fixa na semana: o dia desligado é folga."}
          </p>

          <div
            id={`${base}-horarios`}
            tabIndex={-1}
            className="turno-form__grade"
            aria-describedby={
              erros.horarios ? `${base}-horarios-erro` : undefined
            }
          >
            {modo === "mesmo_horario" ? (
              <LinhaDoDia
                rotulo="Todo dia de trabalho"
                periodos={todoDia}
                intervalo={intervalo}
                desabilitado={enviando}
                onMudar={setTodoDia}
              />
            ) : (
              DIAS.map((d) => (
                <LinhaDoDia
                  key={d.dia}
                  rotulo={d.nome}
                  periodos={porDia.get(d.dia) ?? []}
                  intervalo={intervalo}
                  desabilitado={enviando}
                  comLiga
                  onMudar={(lista) =>
                    setPorDia((atual) => new Map(atual).set(d.dia, lista))
                  }
                />
              ))
            )}
          </div>
          {erros.horarios ? (
            <p id={`${base}-horarios-erro`} className="turno-form__erro">
              {erros.horarios}
            </p>
          ) : null}

          <div className="turno-form__campo turno-form__campo--curto">
            <label htmlFor={`${base}-intervalo`}>Intervalo</label>
            <select
              id={`${base}-intervalo`}
              value={intervalo}
              disabled={enviando}
              onChange={(e) => setIntervalo(Number(e.target.value))}
            >
              {INTERVALOS.map((i) => (
                <option key={i.minutos} value={i.minutos}>
                  {i.rotulo}
                </option>
              ))}
            </select>
            <span className="turno-form__ajuda">
              Descontado do dia com um período só.
            </span>
          </div>

          <p className="turno-form__resumo">
            <strong>Resumo:</strong>{" "}
            {modo === "mesmo_horario"
              ? `Todo dia de trabalho, ${faixa(todoDia)} ${intervalo > 0 && todoDia.length === 1 ? `com ${rotuloDoIntervalo(intervalo)} de intervalo` : "sem intervalo"} · ${horasCompactas(trabalhoDoExemplo)} por dia`
              : `${resumoPorDia(porDia)} · ${horasCompactas(totalSemana)} na semana`}
          </p>
          <ul className="turno-form__notas">
            <li data-ok={!maisDeSeis}>
              Dias acima de 6 h têm pausa de pelo menos 1 h (CLT, art. 71).
            </li>
            <li data-ok={!maisDeDez}>
              Nenhum dia passa de 10 h (CLT, art. 59).
            </li>
          </ul>
        </div>

        <div className="turno-form__secao">
          <h2 className="turno-form__secao-titulo">Marcação e cobertura</h2>
          <p className="turno-form__ajuda">
            Opcional. Vale quando houver registro de ponto e na visão de
            cobertura.
          </p>
          <div className="turno-form__linha">
            <div className="turno-form__campo turno-form__campo--curto">
              <label htmlFor={`${base}-tolerancia`}>
                Tolerância de marcação
              </label>
              <input
                id={`${base}-tolerancia`}
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={tolerancia}
                disabled={enviando}
                onChange={(e) => setTolerancia(e.target.value)}
              />
              <span className="turno-form__ajuda">
                minutos por marcação. A CLT não conta até 5 min por marcação, no
                máximo 10 min por dia (art. 58, § 1º).
              </span>
            </div>
            <div className="turno-form__campo turno-form__campo--curto">
              <label htmlFor={`${base}-minimo`}>
                Mínimo de pessoas por dia
              </label>
              <input
                id={`${base}-minimo`}
                type="number"
                min={0}
                max={999}
                inputMode="numeric"
                value={minimo}
                placeholder="—"
                disabled={enviando}
                onChange={(e) => setMinimo(e.target.value)}
              />
              <span className="turno-form__ajuda">
                por unidade. Abaixo disso, o dia fica vermelho na cobertura.
              </span>
            </div>
          </div>
        </div>

        {erros.geral ? (
          <p
            id={`${base}-geral`}
            role="alert"
            tabIndex={-1}
            className="turno-form__erro"
          >
            {erros.geral}
          </p>
        ) : null}

        <footer className="turno-form__rodape">
          <p className="turno-form__ajuda">
            {editando
              ? "Mudar o horário vale para o rascunho a partir de hoje. O que já foi publicado não muda."
              : "Nenhuma pessoa usa este turno ainda."}
          </p>
          <div className="turno-form__botoes">
            <Button type="button" variant="secondary" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={enviando || (editando !== null && !alterado)}
            >
              {enviando
                ? "Salvando…"
                : editando
                  ? "Salvar alterações"
                  : "Criar turno"}
            </Button>
          </div>
        </footer>
      </form>
    </section>
  );
}

function semErro(erros: Erros, campo: keyof Erros): Erros {
  const resto = { ...erros };
  delete resto[campo];
  return resto;
}

function diaDoExemplo(porDia: ReadonlyMap<string, Periodo[]>): Periodo[] {
  for (const d of DIAS) {
    const lista = porDia.get(d.dia);
    if (lista && lista.length > 0) return lista;
  }
  return [];
}

function sobrepostos(lista: readonly Periodo[]): boolean {
  const ordenados = [...lista].sort(
    (a, b) => minutos(a.inicio) - minutos(b.inicio),
  );
  return ordenados.some(
    (p, i) => i > 0 && minutos(p.inicio) < minutos(ordenados[i - 1]!.fim),
  );
}

function LinhaDoDia({
  rotulo,
  periodos,
  intervalo,
  desabilitado,
  comLiga = false,
  onMudar,
}: {
  readonly rotulo: string;
  readonly periodos: Periodo[];
  readonly intervalo: number;
  readonly desabilitado: boolean;
  readonly comLiga?: boolean;
  readonly onMudar: (lista: Periodo[]) => void;
}) {
  const trabalha = periodos.length > 0;
  const mudar = (i: number, campo: keyof Periodo, valor: string) =>
    onMudar(periodos.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  const proximo = (): Periodo => {
    const fim = periodos[periodos.length - 1]?.fim ?? "08:00";
    const inicio = Math.min(minutos(fim) + 60, 22 * 60);
    const h = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return { inicio: h(inicio), fim: h(Math.min(inicio + 120, 23 * 60 + 59)) };
  };
  return (
    <div className="turno-form__dia" role="group" aria-label={rotulo}>
      <span className="turno-form__dia-nome">
        {comLiga ? (
          <label className="turno-form__liga">
            <input
              type="checkbox"
              checked={trabalha}
              disabled={desabilitado}
              aria-label={`${rotulo}: ${trabalha ? "dia de trabalho" : "folga"}`}
              onChange={(e) =>
                onMudar(
                  e.target.checked ? [{ inicio: "08:00", fim: "17:00" }] : [],
                )
              }
            />
            <span aria-hidden="true">{rotulo}</span>
          </label>
        ) : (
          rotulo
        )}
      </span>
      <div className="turno-form__periodos">
        {!trabalha ? (
          <span className="turno-form__folga">Folga</span>
        ) : (
          periodos.map((p, i) => (
            <span key={i} className="turno-form__periodo">
              <input
                type="time"
                value={p.inicio}
                aria-label={`${rotulo}, ${i + 1}º período: início`}
                disabled={desabilitado}
                onChange={(e) => mudar(i, "inicio", e.target.value)}
              />
              <span aria-hidden="true">–</span>
              <input
                type="time"
                value={p.fim}
                aria-label={`${rotulo}, ${i + 1}º período: fim`}
                disabled={desabilitado}
                onChange={(e) => mudar(i, "fim", e.target.value)}
              />
              {i > 0 && !desabilitado ? (
                <button
                  type="button"
                  className="turno-form__remover"
                  aria-label={`Remover o ${i + 1}º período de ${rotulo}`}
                  onClick={() => onMudar(periodos.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
        {trabalha && periodos.length < 3 && !desabilitado ? (
          <button
            type="button"
            className="turno-form__adicionar"
            onClick={() => onMudar([...periodos, proximo()])}
          >
            + Período
          </button>
        ) : null}
      </div>
      <span className="turno-form__dia-total">
        {trabalha ? horasCompactas(trabalhoNoDia(periodos, intervalo)) : "—"}
      </span>
    </div>
  );
}
