/**
 * Pessoas > Histórico funcional (T115) — leitura e operação real de
 * movimentação funcional sobre o contrato já existente do backend.
 *
 * Reaproveita exclusivamente endpoints já existentes:
 * `GET/POST /v1/movimentacoes`, `POST /v1/movimentacoes/:id/{efetivar,
 * cancelar,retificar}`, `GET /v1/vinculos/:id/linha-do-tempo`,
 * `GET /v1/colaboradores`, `GET /v1/colaboradores/:id/vinculos` e as
 * listagens organizacionais (departamentos, unidades, áreas, equipes,
 * cargos, centros de custo). Nenhum endpoint, migration, schema ou
 * dependência novo.
 *
 * Fora de escopo, por decisão do próprio backend (Baseline V1, itens 7 e 11):
 * não há aprovação/rejeição, e o motivo é sempre um código controlado, nunca
 * texto livre. Esta tela também não cria admissão (ela nasce junto do
 * vínculo, em "Colaboradores" — T111) nem toca acesso, remuneração, salário,
 * cálculo, Folha, documentos, benefícios, dependentes, afastamentos, jornada
 * ou Banco de Horas. Retificação sempre cria um registro novo e preserva o
 * original na linha do tempo — nada é apagado, editado ou ocultado.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  DataTable,
  EmptyState,
  FormActions,
  FormField,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import type { DataTableColumn } from "../../components";
import {
  type ColaboradorApi,
  type TipoVinculo,
  type VinculoApi,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import {
  type DestinoOrganizacionalDto,
  type ListarMovimentacoesQuery,
  type MotivoMovimentacao,
  type MovimentacaoApi,
  type RegistrarMovimentacaoDto,
  type RetificarMovimentacaoDto,
  type StatusMovimentacao,
  type TipoMovimentacao,
  type TipoMovimentacaoRegistravel,
  buscarLinhaDoTempo,
  cancelarMovimentacao,
  efetivarMovimentacao,
  listarMovimentacoes,
  registrarMovimentacao,
  retificarMovimentacao,
} from "../../api/movimentacaoClient";
import {
  ROTULO_MOTIVO,
  ROTULO_STATUS_MOVIMENTACAO,
  ROTULO_TIPO_MOVIMENTACAO,
  VARIANTE_STATUS_MOVIMENTACAO,
} from "./movimentacaoRotulos";
import "./HistoricoFuncionalScreen.css";

export const HISTORICO_FUNCIONAL_TITULO_ID = "historico-funcional-titulo";

type TipoDestino =
  "" | "unidade" | "departamento" | "area" | "equipe" | "cargo" | "centroCusto";

const OPCOES_TIPO_DESTINO: { valor: TipoDestino; rotulo: string }[] = [
  { valor: "unidade", rotulo: "Unidade organizacional" },
  { valor: "departamento", rotulo: "Departamento" },
  { valor: "area", rotulo: "Área" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "cargo", rotulo: "Cargo" },
  { valor: "centroCusto", rotulo: "Centro de custo" },
];

const TIPOS_REGISTRAVEIS: readonly TipoMovimentacaoRegistravel[] = [
  "transferencia_organizacional",
  "mudanca_cargo",
  "desligamento",
];

const MOTIVOS: readonly MotivoMovimentacao[] = Object.keys(
  ROTULO_MOTIVO,
) as MotivoMovimentacao[];

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

interface RegistroErros {
  tipo?: string;
  motivoCodigo?: string;
  vigenciaInicio?: string;
  destino?: string;
  geral?: string;
}

interface FormularioRegistroState {
  vinculoId: string;
  tipo: TipoMovimentacaoRegistravel | "";
  motivoCodigo: MotivoMovimentacao | "";
  vigenciaInicio: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
  erros: RegistroErros;
  salvando: boolean;
}

interface RetificarErros {
  motivoCodigo?: string;
  vigenciaInicio?: string;
  destino?: string;
  geral?: string;
}

interface RetificarFormState {
  movimentacaoId: string;
  tipoOriginal: TipoMovimentacao;
  motivoCodigo: MotivoMovimentacao | "";
  vigenciaInicio: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
  erros: RetificarErros;
  salvando: boolean;
}

interface LinhaDoTempoState {
  vinculoId: string;
  vinculoLabel: string;
  status: "carregando" | "erro" | "dados";
  itens: MovimentacaoApi[];
  acaoEmAndamentoId: string | null;
  erroAcao: string | null;
  retificar: RetificarFormState | null;
}

/** Ao menos uma referência exigida — exceto `desligamento`, que não aceita nenhuma (espelha `assertDestinoCoerente`). */
function validarDestino(
  tipo: string,
  tipoDestino: TipoDestino,
  destinoId: string,
  departamentoIdArea: string,
): string | undefined {
  if (tipo === "desligamento") return undefined;
  if (!tipoDestino || !destinoId) {
    return "Selecione o destino organizacional.";
  }
  if (tipoDestino === "area" && !departamentoIdArea) {
    return "Selecione o departamento da área.";
  }
  return undefined;
}

function montarDestinoDto(
  tipoDestino: TipoDestino,
  destinoId: string,
  departamentoIdArea: string,
): DestinoOrganizacionalDto {
  switch (tipoDestino) {
    case "unidade":
      return { unidadeOrganizacionalId: destinoId };
    case "departamento":
      return { departamentoId: destinoId };
    case "area":
      return { areaId: destinoId, departamentoId: departamentoIdArea };
    case "equipe":
      return { equipeId: destinoId };
    case "cargo":
      return { cargoId: destinoId };
    case "centroCusto":
      return { centroCustoId: destinoId };
    default:
      return {};
  }
}

export interface HistoricoFuncionalScreenProps {
  /**
   * T187 — aberto pelo atalho da "Vida funcional" da ficha: já chega com o
   * colaborador e o vínculo filtrados. Só seleciona o que o servidor devolve
   * para a sessão — os vínculos vêm de `GET /colaboradores/:id/vinculos`, já
   * no escopo da empresa ativa; um vínculo que não esteja lá não é
   * selecionado, e nada de outra empresa aparece.
   */
  readonly selecaoInicial?: {
    readonly colaboradorId: string;
    readonly vinculoId: string;
  } | null;
}

export function HistoricoFuncionalScreen({
  selecaoInicial = null,
}: HistoricoFuncionalScreenProps = {}) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [departamentosLista, setDepartamentosLista] = useState<
    DepartamentoApi[]
  >([]);
  const [unidadesLista, setUnidadesLista] = useState<
    UnidadeOrganizacionalApi[]
  >([]);
  const [areasLista, setAreasLista] = useState<AreaApi[]>([]);
  const [equipesLista, setEquipesLista] = useState<EquipeApi[]>([]);
  const [cargosLista, setCargosLista] = useState<CargoApi[]>([]);
  const [centrosCustoLista, setCentrosCustoLista] = useState<CentroCustoApi[]>(
    [],
  );

  const [filtroColaboradorId, setFiltroColaboradorId] = useState("todos");
  const [vinculosDoColaborador, setVinculosDoColaborador] = useState<
    VinculoApi[]
  >([]);
  const [statusVinculos, setStatusVinculos] = useState<
    "ocioso" | "carregando" | "erro" | "dados"
  >("ocioso");
  const [filtroVinculoId, setFiltroVinculoId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [statusListagem, setStatusListagem] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoApi[]>([]);

  const [formulario, setFormulario] = useState<FormularioRegistroState | null>(
    null,
  );
  const [linhaDoTempo, setLinhaDoTempo] = useState<LinhaDoTempoState | null>(
    null,
  );

  const formTituloId = useId();
  const linhaTituloId = useId();

  const carregarBase = useCallback(async () => {
    setStatusCarregamento("carregando");
    try {
      const [colabResp, deps, unis, areas, equipes, cargos, centros] =
        await Promise.all([
          listarColaboradores({ tamanhoPagina: 100 }),
          listarDepartamentos({ tamanhoPagina: 100 }),
          listarUnidades({ tamanhoPagina: 100 }),
          listarAreas({ tamanhoPagina: 100 }),
          listarEquipes({ tamanhoPagina: 100 }),
          listarCargos({ tamanhoPagina: 100 }),
          listarCentrosCusto({ tamanhoPagina: 100 }),
        ]);
      setColaboradores(colabResp.itens);
      setDepartamentosLista(deps.itens);
      setUnidadesLista(unis.itens);
      setAreasLista(areas.itens);
      setEquipesLista(equipes.itens);
      setCargosLista(cargos.itens);
      setCentrosCustoLista(centros.itens);
      setStatusCarregamento("dados");
    } catch {
      setStatusCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  const carregarListagem = useCallback(async () => {
    setStatusListagem("carregando");
    try {
      const query: ListarMovimentacoesQuery = { tamanhoPagina: 100 };
      if (filtroVinculoId) query.vinculoId = filtroVinculoId;
      if (filtroTipo !== "todos") query.tipo = filtroTipo as TipoMovimentacao;
      if (filtroStatus !== "todos")
        query.status = filtroStatus as StatusMovimentacao;
      const resp = await listarMovimentacoes(query);
      setMovimentacoes(resp.itens);
      setStatusListagem("dados");
    } catch {
      setStatusListagem("erro");
    }
  }, [filtroVinculoId, filtroTipo, filtroStatus]);

  useEffect(() => {
    void carregarListagem();
  }, [carregarListagem]);

  const colaboradoresPorId = useMemo(
    () => new Map(colaboradores.map((c) => [c.id, c])),
    [colaboradores],
  );

  async function selecionarColaborador(
    colaboradorId: string,
    vinculoPreferido?: string,
  ) {
    setFiltroColaboradorId(colaboradorId);
    setFormulario(null);
    setFiltroVinculoId("");
    setVinculosDoColaborador([]);
    if (!colaboradorId || colaboradorId === "todos") {
      setStatusVinculos("ocioso");
      return;
    }
    setStatusVinculos("carregando");
    try {
      const vinculos = await listarVinculosDoColaborador(colaboradorId);
      setVinculosDoColaborador(vinculos);
      setStatusVinculos("dados");
      // T187 — o vínculo pedido pela ficha só vale se veio nesta resposta.
      if (vinculoPreferido && vinculos.some((v) => v.id === vinculoPreferido)) {
        setFiltroVinculoId(vinculoPreferido);
      } else if (vinculos.length === 1) {
        setFiltroVinculoId(vinculos[0]!.id);
      }
    } catch {
      setStatusVinculos("erro");
    }
  }

  // T187 — a seleção vinda da ficha é aplicada uma vez, na montagem.
  const selecaoAplicadaRef = useRef(false);
  useEffect(() => {
    if (!selecaoInicial || selecaoAplicadaRef.current) return;
    selecaoAplicadaRef.current = true;
    void selecionarColaborador(
      selecaoInicial.colaboradorId,
      selecaoInicial.vinculoId,
    );
    // `selecionarColaborador` é recriada a cada desenho; vale só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecaoInicial]);

  function selecionarVinculo(vinculoId: string) {
    setFiltroVinculoId(vinculoId);
    setFormulario(null);
  }

  function resolverVinculo(vinculoId: string): string {
    const vinculo = vinculosDoColaborador.find((v) => v.id === vinculoId);
    if (!vinculo) return `Vínculo ${vinculoId.slice(0, 8)}`;
    const colaborador = colaboradoresPorId.get(vinculo.colaboradorId);
    const nomeColaborador =
      colaborador?.nome ?? `Colaborador ${vinculo.colaboradorId.slice(0, 8)}`;
    return `${exibirMatricula(vinculo.matricula)} (${ROTULO_TIPO_VINCULO[vinculo.tipo]}) — ${nomeColaborador}`;
  }

  function resolverDestino(m: MovimentacaoApi): string {
    const candidatos: [
      string | null,
      string,
      { id: string; codigo: string; nome: string }[],
    ][] = [
      [m.destinoUnidadeOrganizacionalId, "Unidade", unidadesLista],
      [m.destinoDepartamentoId, "Departamento", departamentosLista],
      [m.destinoAreaId, "Área", areasLista],
      [m.destinoEquipeId, "Equipe", equipesLista],
      [m.destinoCargoId, "Cargo", cargosLista],
      [m.destinoCentroCustoId, "Centro de custo", centrosCustoLista],
    ];
    for (const [id, rotulo, lista] of candidatos) {
      if (id) {
        const item = lista.find((x) => x.id === id);
        return item
          ? `${rotulo}: ${item.codigo} — ${item.nome}`
          : `${rotulo} ${id.slice(0, 8)}`;
      }
    }
    return "—";
  }

  function opcoesDestinoAtuais(
    tipoDestino: TipoDestino,
    departamentoIdArea: string,
  ): { id: string; rotulo: string }[] {
    switch (tipoDestino) {
      case "unidade":
        return unidadesLista
          .filter((u) => u.status === "ativo")
          .map((u) => ({ id: u.id, rotulo: `${u.codigo} — ${u.nome}` }));
      case "departamento":
        return departamentosLista
          .filter((d) => d.status === "ativo")
          .map((d) => ({ id: d.id, rotulo: `${d.codigo} — ${d.nome}` }));
      case "area":
        return areasLista
          .filter(
            (a) =>
              a.status === "ativo" && a.departamentoId === departamentoIdArea,
          )
          .map((a) => ({ id: a.id, rotulo: `${a.codigo} — ${a.nome}` }));
      case "equipe":
        return equipesLista
          .filter((e) => e.status === "ativo")
          .map((e) => ({ id: e.id, rotulo: `${e.codigo} — ${e.nome}` }));
      case "cargo":
        return cargosLista
          .filter((c) => c.status === "ativo")
          .map((c) => ({ id: c.id, rotulo: `${c.codigo} — ${c.nome}` }));
      case "centroCusto":
        return centrosCustoLista
          .filter((c) => c.status === "ativo")
          .map((c) => ({ id: c.id, rotulo: `${c.codigo} — ${c.nome}` }));
      default:
        return [];
    }
  }

  const departamentosAtivos = useMemo(
    () => departamentosLista.filter((d) => d.status === "ativo"),
    [departamentosLista],
  );

  function abrirFormulario() {
    if (!filtroVinculoId) return;
    setLinhaDoTempo(null);
    setFormulario({
      vinculoId: filtroVinculoId,
      tipo: "",
      motivoCodigo: "",
      vigenciaInicio: "",
      tipoDestino: "",
      destinoId: "",
      departamentoIdArea: "",
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  async function handleSubmitRegistro(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: RegistroErros = {};
    if (!formulario.tipo) erros.tipo = "Selecione o tipo de movimentação.";
    if (!formulario.motivoCodigo) erros.motivoCodigo = "Selecione o motivo.";
    if (!formulario.vigenciaInicio)
      erros.vigenciaInicio = "Informe o início da vigência.";
    const erroDestino = validarDestino(
      formulario.tipo,
      formulario.tipoDestino,
      formulario.destinoId,
      formulario.departamentoIdArea,
    );
    if (erroDestino) erros.destino = erroDestino;

    if (
      erros.tipo ??
      erros.motivoCodigo ??
      erros.vigenciaInicio ??
      erros.destino
    ) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );
    try {
      const dto: RegistrarMovimentacaoDto = {
        vinculoId: formulario.vinculoId,
        tipo: formulario.tipo as TipoMovimentacaoRegistravel,
        motivoCodigo: formulario.motivoCodigo as MotivoMovimentacao,
        vigenciaInicio: formulario.vigenciaInicio,
        ...(formulario.tipo !== "desligamento"
          ? montarDestinoDto(
              formulario.tipoDestino,
              formulario.destinoId,
              formulario.departamentoIdArea,
            )
          : {}),
      };
      await registrarMovimentacao(dto);
      setFormulario(null);
      await carregarListagem();
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a movimentação. Tente novamente.";
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              salvando: false,
              erros: { ...prev.erros, geral: mensagem },
            }
          : prev,
      );
    }
  }

  async function carregarLinhaDoTempo(vinculoId: string) {
    setLinhaDoTempo((prev) =>
      prev && prev.vinculoId === vinculoId
        ? { ...prev, status: "carregando" }
        : prev,
    );
    try {
      const itens = await buscarLinhaDoTempo(vinculoId);
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, itens, status: "dados" }
          : prev,
      );
    } catch {
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, status: "erro" }
          : prev,
      );
    }
  }

  /** Atualiza a linha do tempo sem piscar para "carregando" — usado após ações. */
  async function atualizarLinhaDoTempoSilenciosa(vinculoId: string) {
    try {
      const itens = await buscarLinhaDoTempo(vinculoId);
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, itens, status: "dados" }
          : prev,
      );
    } catch {
      // Mantém os itens já exibidos; a falha de atualização silenciosa não
      // interrompe o fluxo — o botão "Tentar novamente" cobre o caso.
    }
  }

  async function abrirLinhaDoTempo(vinculoId: string, vinculoLabel: string) {
    setFormulario(null);
    setLinhaDoTempo({
      vinculoId,
      vinculoLabel,
      status: "carregando",
      itens: [],
      acaoEmAndamentoId: null,
      erroAcao: null,
      retificar: null,
    });
    await carregarLinhaDoTempo(vinculoId);
  }

  function fecharLinhaDoTempo() {
    setLinhaDoTempo(null);
  }

  async function handleEfetivar(movimentacaoId: string) {
    if (!linhaDoTempo) return;
    const vinculoId = linhaDoTempo.vinculoId;
    setLinhaDoTempo((prev) =>
      prev && prev.vinculoId === vinculoId
        ? { ...prev, acaoEmAndamentoId: movimentacaoId, erroAcao: null }
        : prev,
    );
    try {
      await efetivarMovimentacao(movimentacaoId);
      await atualizarLinhaDoTempoSilenciosa(vinculoId);
      await carregarListagem();
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, acaoEmAndamentoId: null }
          : prev,
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível efetivar a movimentação. Tente novamente.";
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, acaoEmAndamentoId: null, erroAcao: mensagem }
          : prev,
      );
    }
  }

  async function handleCancelar(movimentacaoId: string) {
    if (!linhaDoTempo) return;
    const vinculoId = linhaDoTempo.vinculoId;
    setLinhaDoTempo((prev) =>
      prev && prev.vinculoId === vinculoId
        ? { ...prev, acaoEmAndamentoId: movimentacaoId, erroAcao: null }
        : prev,
    );
    try {
      await cancelarMovimentacao(movimentacaoId);
      await atualizarLinhaDoTempoSilenciosa(vinculoId);
      await carregarListagem();
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, acaoEmAndamentoId: null }
          : prev,
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível cancelar a movimentação. Tente novamente.";
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, acaoEmAndamentoId: null, erroAcao: mensagem }
          : prev,
      );
    }
  }

  function abrirRetificar(m: MovimentacaoApi) {
    setLinhaDoTempo((prev) =>
      prev
        ? {
            ...prev,
            erroAcao: null,
            retificar: {
              movimentacaoId: m.id,
              tipoOriginal: m.tipo,
              motivoCodigo: "",
              vigenciaInicio: "",
              tipoDestino: "",
              destinoId: "",
              departamentoIdArea: "",
              erros: {},
              salvando: false,
            },
          }
        : prev,
    );
  }

  function fecharRetificar() {
    setLinhaDoTempo((prev) => (prev ? { ...prev, retificar: null } : prev));
  }

  async function handleSubmitRetificar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!linhaDoTempo?.retificar) return;
    const r = linhaDoTempo.retificar;

    const erros: RetificarErros = {};
    if (!r.motivoCodigo) erros.motivoCodigo = "Selecione o motivo.";
    if (!r.vigenciaInicio)
      erros.vigenciaInicio = "Informe o início da vigência.";
    const erroDestino = validarDestino(
      r.tipoOriginal,
      r.tipoDestino,
      r.destinoId,
      r.departamentoIdArea,
    );
    if (erroDestino) erros.destino = erroDestino;

    if (erros.motivoCodigo ?? erros.vigenciaInicio ?? erros.destino) {
      setLinhaDoTempo((prev) =>
        prev && prev.retificar
          ? { ...prev, retificar: { ...prev.retificar, erros } }
          : prev,
      );
      return;
    }

    const vinculoId = linhaDoTempo.vinculoId;
    setLinhaDoTempo((prev) =>
      prev && prev.retificar
        ? {
            ...prev,
            retificar: { ...prev.retificar, salvando: true, erros: {} },
          }
        : prev,
    );
    try {
      const dto: RetificarMovimentacaoDto = {
        motivoCodigo: r.motivoCodigo as MotivoMovimentacao,
        vigenciaInicio: r.vigenciaInicio,
        ...(r.tipoOriginal !== "desligamento"
          ? montarDestinoDto(r.tipoDestino, r.destinoId, r.departamentoIdArea)
          : {}),
      };
      await retificarMovimentacao(r.movimentacaoId, dto);
      setLinhaDoTempo((prev) =>
        prev && prev.vinculoId === vinculoId
          ? { ...prev, retificar: null }
          : prev,
      );
      await atualizarLinhaDoTempoSilenciosa(vinculoId);
      await carregarListagem();
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível retificar a movimentação. Tente novamente.";
      setLinhaDoTempo((prev) =>
        prev && prev.retificar
          ? {
              ...prev,
              retificar: {
                ...prev.retificar,
                salvando: false,
                erros: { ...prev.retificar.erros, geral: mensagem },
              },
            }
          : prev,
      );
    }
  }

  function renderAcoesLinhaDoTempo(m: MovimentacaoApi) {
    if (!linhaDoTempo) return null;
    const algumaAcaoEmAndamento = linhaDoTempo.acaoEmAndamentoId !== null;
    const estaEmAndamento = linhaDoTempo.acaoEmAndamentoId === m.id;

    if (m.status === "solicitada" || m.status === "programada") {
      return (
        <div className="historico-funcional-screen__acoes-linha">
          <Button
            variant="secondary"
            onClick={() => void handleEfetivar(m.id)}
            disabled={algumaAcaoEmAndamento}
          >
            {estaEmAndamento ? "Efetivando…" : "Efetivar"}
          </Button>
          <Button
            variant="subtle"
            onClick={() => void handleCancelar(m.id)}
            disabled={algumaAcaoEmAndamento}
          >
            {estaEmAndamento ? "Cancelando…" : "Cancelar"}
          </Button>
        </div>
      );
    }
    if (m.status === "efetivada") {
      return (
        <Button
          variant="secondary"
          onClick={() => abrirRetificar(m)}
          disabled={linhaDoTempo.retificar !== null || algumaAcaoEmAndamento}
        >
          Retificar
        </Button>
      );
    }
    return <span className="historico-funcional-screen__nota">—</span>;
  }

  function renderRetificacaoInfo(m: MovimentacaoApi): string {
    if (m.status === "retificada") {
      const correcao = linhaDoTempo?.itens.find((x) => x.retificaId === m.id);
      return correcao
        ? `Corrigida — nova vigência ${formatarDiaCivil(correcao.vigenciaInicio)}`
        : "Corrigida";
    }
    if (m.retificaId) return "É a correção de outra movimentação";
    return "—";
  }

  const colunasMovimentacoes: DataTableColumn<MovimentacaoApi>[] = [
    {
      key: "vinculo",
      header: "Vínculo",
      cell: (m) => resolverVinculo(m.vinculoId),
    },
    {
      key: "tipo",
      header: "Tipo",
      cell: (m) => ROTULO_TIPO_MOVIMENTACAO[m.tipo],
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => (
        <StatusBadge variant={VARIANTE_STATUS_MOVIMENTACAO[m.status]}>
          {ROTULO_STATUS_MOVIMENTACAO[m.status]}
        </StatusBadge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (m) => ROTULO_MOTIVO[m.motivoCodigo],
    },
    {
      key: "vigencia",
      header: "Vigência início",
      cell: (m) => formatarDiaCivil(m.vigenciaInicio),
    },
    {
      key: "registrada",
      header: "Registrada em",
      cell: (m) => formatarInstante(m.registradaEm),
    },
    {
      key: "efetivada",
      header: "Efetivada em",
      cell: (m) => formatarInstante(m.efetivadaEm),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (m) => (
        <Button
          variant="subtle"
          onClick={() =>
            void abrirLinhaDoTempo(m.vinculoId, resolverVinculo(m.vinculoId))
          }
        >
          Ver linha do tempo
          <span className="sr-only"> — {resolverVinculo(m.vinculoId)}</span>
        </Button>
      ),
    },
  ];

  const colunasLinhaDoTempo: DataTableColumn<MovimentacaoApi>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (m) => ROTULO_TIPO_MOVIMENTACAO[m.tipo],
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => (
        <StatusBadge variant={VARIANTE_STATUS_MOVIMENTACAO[m.status]}>
          {ROTULO_STATUS_MOVIMENTACAO[m.status]}
        </StatusBadge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (m) => ROTULO_MOTIVO[m.motivoCodigo],
    },
    { key: "destino", header: "Destino", cell: (m) => resolverDestino(m) },
    {
      key: "vigencia",
      header: "Vigência início",
      cell: (m) => formatarDiaCivil(m.vigenciaInicio),
    },
    {
      key: "registrada",
      header: "Registrada em",
      cell: (m) => formatarInstante(m.registradaEm),
    },
    {
      key: "efetivada",
      header: "Efetivada em",
      cell: (m) => formatarInstante(m.efetivadaEm),
    },
    {
      key: "retificacao",
      header: "Retificação",
      cell: (m) => renderRetificacaoInfo(m),
    },
    { key: "acoes", header: "Ações", cell: (m) => renderAcoesLinhaDoTempo(m) },
  ];

  const opcoesDestinoRegistro = formulario
    ? opcoesDestinoAtuais(formulario.tipoDestino, formulario.departamentoIdArea)
    : [];
  const rotuloDestinoRegistro =
    OPCOES_TIPO_DESTINO.find((o) => o.valor === formulario?.tipoDestino)
      ?.rotulo ?? "Destino organizacional";

  const opcoesDestinoRetificar = linhaDoTempo?.retificar
    ? opcoesDestinoAtuais(
        linhaDoTempo.retificar.tipoDestino,
        linhaDoTempo.retificar.departamentoIdArea,
      )
    : [];
  const rotuloDestinoRetificar =
    OPCOES_TIPO_DESTINO.find(
      (o) => o.valor === linhaDoTempo?.retificar?.tipoDestino,
    )?.rotulo ?? "Destino organizacional";

  return (
    <div className="historico-funcional-screen">
      <PageHeader
        headingLevel={1}
        titleId={HISTORICO_FUNCIONAL_TITULO_ID}
        title="Histórico funcional"
        description="Registre, efetive, cancele e retifique movimentações funcionais de um vínculo — transferência, mudança de cargo e desligamento — e consulte a linha do tempo completa de cada vínculo."
      />

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso"
        aria-labelledby="historico-funcional-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH e DP</StatusBadge>
        <p
          id="historico-funcional-aviso-rh-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          Esta tela é operada exclusivamente pelo RH e DP da própria empresa.
          Master técnico apenas consulta, em qualquer empresa. Toda ação gera
          trilha de auditoria automática.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="historico-funcional-screen__aviso historico-funcional-screen__aviso--indisponivel"
        aria-labelledby="historico-funcional-aviso-indisponivel-titulo"
      >
        <StatusBadge variant="warning">Fora de escopo</StatusBadge>
        <p
          id="historico-funcional-aviso-indisponivel-titulo"
          className="historico-funcional-screen__aviso-texto"
        >
          Não há aprovação/rejeição — RH/DP registram e efetivam diretamente,
          sob responsabilidade auditada. Esta tela não cria admissão (ela nasce
          junto do vínculo, em "Colaboradores"), nem calcula ou altera acesso,
          remuneração, salário, cálculo, Folha, documentos, benefícios,
          dependentes, afastamentos, jornada ou Banco de Horas. Retificar sempre
          cria um registro novo e preserva o original na linha do tempo — nada é
          apagado, editado ou ocultado.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="historico-funcional-screen__erro"
          aria-labelledby="historico-funcional-erro-base-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="historico-funcional-erro-base-titulo"
            className="historico-funcional-screen__section-title"
          >
            Não foi possível carregar os dados desta tela
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button variant="secondary" onClick={() => void carregarBase()}>
            Tentar novamente
          </Button>
        </Surface>
      ) : statusCarregamento === "carregando" ? (
        <p className="historico-funcional-screen__carregando" role="status">
          Carregando colaboradores…
        </p>
      ) : colaboradores.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon="—"
          title="Nenhum colaborador cadastrado"
          description="Cadastre um colaborador na aba Colaboradores para começar a registrar movimentações."
        />
      ) : (
        <>
          <section aria-labelledby="historico-funcional-filtros-titulo">
            <h2
              id="historico-funcional-filtros-titulo"
              className="historico-funcional-screen__section-title"
            >
              Filtros
            </h2>
            <div className="historico-funcional-screen__filtros">
              <FormField
                id="historico-funcional-filtro-colaborador"
                label="Colaborador"
              >
                {(control) => (
                  <select
                    value={filtroColaboradorId}
                    onChange={(e) => void selecionarColaborador(e.target.value)}
                    {...control}
                  >
                    <option value="todos">Todos os colaboradores</option>
                    {colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField
                id="historico-funcional-filtro-vinculo"
                label="Vínculo"
              >
                {(control) => (
                  <select
                    value={filtroVinculoId}
                    onChange={(e) => selecionarVinculo(e.target.value)}
                    disabled={
                      filtroColaboradorId === "todos" ||
                      statusVinculos !== "dados"
                    }
                    {...control}
                  >
                    <option value="">
                      {filtroColaboradorId === "todos"
                        ? "Selecione um colaborador primeiro"
                        : "Selecione…"}
                    </option>
                    {vinculosDoColaborador.map((v) => (
                      <option key={v.id} value={v.id}>
                        {exibirMatricula(v.matricula)} —{" "}
                        {ROTULO_TIPO_VINCULO[v.tipo]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField id="historico-funcional-filtro-tipo" label="Tipo">
                {(control) => (
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    {...control}
                  >
                    <option value="todos">Todos os tipos</option>
                    {(
                      Object.keys(
                        ROTULO_TIPO_MOVIMENTACAO,
                      ) as TipoMovimentacao[]
                    ).map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_MOVIMENTACAO[tipo]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField id="historico-funcional-filtro-status" label="Status">
                {(control) => (
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    {...control}
                  >
                    <option value="todos">Todos os status</option>
                    {(
                      Object.keys(
                        ROTULO_STATUS_MOVIMENTACAO,
                      ) as StatusMovimentacao[]
                    ).map((status) => (
                      <option key={status} value={status}>
                        {ROTULO_STATUS_MOVIMENTACAO[status]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <Button onClick={abrirFormulario} disabled={!filtroVinculoId}>
                Registrar movimentação
              </Button>
            </div>
            {statusVinculos === "erro" ? (
              <p className="historico-funcional-screen__form-erro" role="alert">
                Não foi possível carregar os vínculos deste colaborador.
              </p>
            ) : null}
            {statusVinculos === "dados" &&
            vinculosDoColaborador.length === 0 ? (
              <p className="historico-funcional-screen__nota">
                Este colaborador não tem nenhum vínculo.
              </p>
            ) : null}
            {!filtroVinculoId ? (
              <p className="historico-funcional-screen__nota">
                Selecione um colaborador e um vínculo específico para registrar
                uma nova movimentação — a escolha nunca é automática quando há
                mais de uma opção.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="historico-funcional-lista-titulo">
            <h2
              id="historico-funcional-lista-titulo"
              className="historico-funcional-screen__section-title"
            >
              Movimentações
            </h2>

            {statusListagem === "erro" ? (
              <Surface
                as="div"
                padding="lg"
                className="historico-funcional-screen__erro"
              >
                <StatusBadge variant="danger">Erro</StatusBadge>
                <p>Não foi possível carregar as movimentações.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarListagem()}
                >
                  Tentar novamente
                </Button>
              </Surface>
            ) : statusListagem === "carregando" ? (
              <p
                className="historico-funcional-screen__carregando"
                role="status"
              >
                Carregando movimentações…
              </p>
            ) : movimentacoes.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma movimentação encontrada"
                description="Ajuste os filtros ou registre uma nova movimentação para um vínculo selecionado."
              />
            ) : (
              <DataTable
                caption="Movimentações funcionais"
                columns={colunasMovimentacoes}
                rows={movimentacoes}
                rowKey={(m) => m.id}
              />
            )}
          </section>
        </>
      )}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="historico-funcional-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="historico-funcional-screen__section-title"
          >
            Registrar movimentação — {resolverVinculo(formulario.vinculoId)}
          </h2>
          <p className="historico-funcional-screen__aviso-texto">
            A movimentação só produz efeito quando efetivada — o registro
            sozinho não altera cargo, departamento, jornada, salário ou qualquer
            cálculo.
          </p>

          <form
            className="historico-funcional-screen__form"
            aria-label="Formulário de registro de movimentação"
            onSubmit={(e) => void handleSubmitRegistro(e)}
          >
            <FormField
              id="historico-funcional-registrar-tipo"
              label="Tipo de movimentação"
              required
              {...(formulario.erros.tipo
                ? { error: formulario.erros.tipo }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.tipo}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            tipo: e.target.value as TipoMovimentacaoRegistravel,
                            tipoDestino: "",
                            destinoId: "",
                            departamentoIdArea: "",
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_REGISTRAVEIS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_TIPO_MOVIMENTACAO[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="historico-funcional-registrar-motivo"
              label="Motivo"
              required
              {...(formulario.erros.motivoCodigo
                ? { error: formulario.erros.motivoCodigo }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.motivoCodigo}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            motivoCodigo: e.target.value as MotivoMovimentacao,
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {MOTIVOS.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {ROTULO_MOTIVO[motivo]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="historico-funcional-registrar-vigencia"
              label="Vigência — início"
              required
              {...(formulario.erros.vigenciaInicio
                ? { error: formulario.erros.vigenciaInicio }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.vigenciaInicio}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, vigenciaInicio: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.tipo && formulario.tipo !== "desligamento" ? (
              <>
                <FormField
                  id="historico-funcional-registrar-tipo-destino"
                  label="Tipo de destino organizacional"
                  required
                  {...(formulario.erros.destino
                    ? { error: formulario.erros.destino }
                    : {})}
                >
                  {(control) => (
                    <select
                      value={formulario.tipoDestino}
                      onChange={(e) =>
                        setFormulario((prev) =>
                          prev
                            ? {
                                ...prev,
                                tipoDestino: e.target.value as TipoDestino,
                                destinoId: "",
                                departamentoIdArea: "",
                                erros: {},
                              }
                            : prev,
                        )
                      }
                      {...control}
                    >
                      <option value="">Selecione…</option>
                      {OPCOES_TIPO_DESTINO.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>

                {formulario.tipoDestino === "area" ? (
                  <FormField
                    id="historico-funcional-registrar-departamento-area"
                    label="Departamento"
                    required
                  >
                    {(control) => (
                      <select
                        value={formulario.departamentoIdArea}
                        onChange={(e) =>
                          setFormulario((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  departamentoIdArea: e.target.value,
                                  destinoId: "",
                                  erros: {},
                                }
                              : prev,
                          )
                        }
                        {...control}
                      >
                        <option value="">Selecione…</option>
                        {departamentosAtivos.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.codigo} — {d.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                ) : null}

                {formulario.tipoDestino ? (
                  <FormField
                    id="historico-funcional-registrar-destino"
                    label={rotuloDestinoRegistro}
                    required
                  >
                    {(control) => (
                      <select
                        value={formulario.destinoId}
                        onChange={(e) =>
                          setFormulario((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  destinoId: e.target.value,
                                  erros: {},
                                }
                              : prev,
                          )
                        }
                        disabled={
                          formulario.tipoDestino === "area" &&
                          !formulario.departamentoIdArea
                        }
                        {...control}
                      >
                        <option value="">Selecione…</option>
                        {opcoesDestinoRegistro.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                ) : null}
              </>
            ) : null}

            {formulario.erros.geral ? (
              <p className="historico-funcional-screen__form-erro" role="alert">
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={fecharFormulario}
                disabled={formulario.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formulario.salvando}
              >
                {formulario.salvando ? "Registrando…" : "Confirmar registro"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {linhaDoTempo ? (
        <Surface
          as="section"
          padding="lg"
          className="historico-funcional-screen__linha-do-tempo"
          aria-labelledby={linhaTituloId}
        >
          <h2
            id={linhaTituloId}
            className="historico-funcional-screen__section-title"
          >
            Linha do tempo — {linhaDoTempo.vinculoLabel}
          </h2>
          <p className="historico-funcional-screen__aviso-texto">
            Inclui movimentações canceladas e retificadas — nada é omitido do
            histórico. Uma movimentação retificada permanece aqui, com a
            correção listada logo abaixo dela.
          </p>

          {linhaDoTempo.erroAcao ? (
            <p className="historico-funcional-screen__form-erro" role="alert">
              {linhaDoTempo.erroAcao}
            </p>
          ) : null}

          {linhaDoTempo.status === "erro" ? (
            <Surface
              as="div"
              padding="lg"
              className="historico-funcional-screen__erro"
            >
              <StatusBadge variant="danger">Erro</StatusBadge>
              <p>Não foi possível carregar a linha do tempo deste vínculo.</p>
              <Button
                variant="secondary"
                onClick={() =>
                  void carregarLinhaDoTempo(linhaDoTempo.vinculoId)
                }
              >
                Tentar novamente
              </Button>
            </Surface>
          ) : linhaDoTempo.status === "carregando" ? (
            <p className="historico-funcional-screen__carregando" role="status">
              Carregando linha do tempo…
            </p>
          ) : linhaDoTempo.itens.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma movimentação neste vínculo"
              description="Ainda não há movimentação registrada para este vínculo."
            />
          ) : (
            <DataTable
              caption={`Linha do tempo — ${linhaDoTempo.vinculoLabel}`}
              columns={colunasLinhaDoTempo}
              rows={linhaDoTempo.itens}
              rowKey={(m) => m.id}
            />
          )}

          {linhaDoTempo.retificar ? (
            <Surface
              as="div"
              padding="md"
              className="historico-funcional-screen__retificar"
            >
              <h3 className="historico-funcional-screen__section-title">
                Retificar movimentação
              </h3>
              <p className="historico-funcional-screen__aviso-texto">
                Cria uma movimentação nova, corrigida — a original permanece na
                linha do tempo, marcada como retificada.
              </p>
              <form
                className="historico-funcional-screen__form"
                aria-label="Formulário de retificação de movimentação"
                onSubmit={(e) => void handleSubmitRetificar(e)}
              >
                <FormField
                  id="historico-funcional-retificar-motivo"
                  label="Motivo"
                  required
                  {...(linhaDoTempo.retificar.erros.motivoCodigo
                    ? { error: linhaDoTempo.retificar.erros.motivoCodigo }
                    : {})}
                >
                  {(control) => (
                    <select
                      value={linhaDoTempo.retificar!.motivoCodigo}
                      onChange={(e) =>
                        setLinhaDoTempo((prev) =>
                          prev && prev.retificar
                            ? {
                                ...prev,
                                retificar: {
                                  ...prev.retificar,
                                  motivoCodigo: e.target
                                    .value as MotivoMovimentacao,
                                  erros: {},
                                },
                              }
                            : prev,
                        )
                      }
                      {...control}
                    >
                      <option value="">Selecione…</option>
                      {MOTIVOS.map((motivo) => (
                        <option key={motivo} value={motivo}>
                          {ROTULO_MOTIVO[motivo]}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>

                <FormField
                  id="historico-funcional-retificar-vigencia"
                  label="Vigência — início"
                  required
                  {...(linhaDoTempo.retificar.erros.vigenciaInicio
                    ? { error: linhaDoTempo.retificar.erros.vigenciaInicio }
                    : {})}
                >
                  {(control) => (
                    <input
                      type="date"
                      value={linhaDoTempo.retificar!.vigenciaInicio}
                      onChange={(e) =>
                        setLinhaDoTempo((prev) =>
                          prev && prev.retificar
                            ? {
                                ...prev,
                                retificar: {
                                  ...prev.retificar,
                                  vigenciaInicio: e.target.value,
                                  erros: {},
                                },
                              }
                            : prev,
                        )
                      }
                      {...control}
                    />
                  )}
                </FormField>

                {linhaDoTempo.retificar.tipoOriginal !== "desligamento" ? (
                  <>
                    <FormField
                      id="historico-funcional-retificar-tipo-destino"
                      label="Tipo de destino organizacional"
                      required
                      {...(linhaDoTempo.retificar.erros.destino
                        ? { error: linhaDoTempo.retificar.erros.destino }
                        : {})}
                    >
                      {(control) => (
                        <select
                          value={linhaDoTempo.retificar!.tipoDestino}
                          onChange={(e) =>
                            setLinhaDoTempo((prev) =>
                              prev && prev.retificar
                                ? {
                                    ...prev,
                                    retificar: {
                                      ...prev.retificar,
                                      tipoDestino: e.target
                                        .value as TipoDestino,
                                      destinoId: "",
                                      departamentoIdArea: "",
                                      erros: {},
                                    },
                                  }
                                : prev,
                            )
                          }
                          {...control}
                        >
                          <option value="">Selecione…</option>
                          {OPCOES_TIPO_DESTINO.map((o) => (
                            <option key={o.valor} value={o.valor}>
                              {o.rotulo}
                            </option>
                          ))}
                        </select>
                      )}
                    </FormField>

                    {linhaDoTempo.retificar.tipoDestino === "area" ? (
                      <FormField
                        id="historico-funcional-retificar-departamento-area"
                        label="Departamento"
                        required
                      >
                        {(control) => (
                          <select
                            value={linhaDoTempo.retificar!.departamentoIdArea}
                            onChange={(e) =>
                              setLinhaDoTempo((prev) =>
                                prev && prev.retificar
                                  ? {
                                      ...prev,
                                      retificar: {
                                        ...prev.retificar,
                                        departamentoIdArea: e.target.value,
                                        destinoId: "",
                                        erros: {},
                                      },
                                    }
                                  : prev,
                              )
                            }
                            {...control}
                          >
                            <option value="">Selecione…</option>
                            {departamentosAtivos.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.codigo} — {d.nome}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    ) : null}

                    {linhaDoTempo.retificar.tipoDestino ? (
                      <FormField
                        id="historico-funcional-retificar-destino"
                        label={rotuloDestinoRetificar}
                        required
                      >
                        {(control) => (
                          <select
                            value={linhaDoTempo.retificar!.destinoId}
                            onChange={(e) =>
                              setLinhaDoTempo((prev) =>
                                prev && prev.retificar
                                  ? {
                                      ...prev,
                                      retificar: {
                                        ...prev.retificar,
                                        destinoId: e.target.value,
                                        erros: {},
                                      },
                                    }
                                  : prev,
                              )
                            }
                            disabled={
                              linhaDoTempo.retificar!.tipoDestino === "area" &&
                              !linhaDoTempo.retificar!.departamentoIdArea
                            }
                            {...control}
                          >
                            <option value="">Selecione…</option>
                            {opcoesDestinoRetificar.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    ) : null}
                  </>
                ) : null}

                {linhaDoTempo.retificar.erros.geral ? (
                  <p
                    className="historico-funcional-screen__form-erro"
                    role="alert"
                  >
                    {linhaDoTempo.retificar.erros.geral}
                  </p>
                ) : null}

                <FormActions>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fecharRetificar}
                    disabled={linhaDoTempo.retificar.salvando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={linhaDoTempo.retificar.salvando}
                  >
                    {linhaDoTempo.retificar.salvando
                      ? "Retificando…"
                      : "Confirmar retificação"}
                  </Button>
                </FormActions>
              </form>
            </Surface>
          ) : null}

          <FormActions>
            <Button
              variant="secondary"
              type="button"
              onClick={fecharLinhaDoTempo}
            >
              Fechar
            </Button>
          </FormActions>
        </Surface>
      ) : null}
    </div>
  );
}
