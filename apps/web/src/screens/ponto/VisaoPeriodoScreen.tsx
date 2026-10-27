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
import type { DataTableColumn, StatusVariant } from "../../components";
import {
  type VinculoApi,
  listarColaboradores,
  listarVinculosDoColaborador,
} from "../../api/colaboradoresClient";
import {
  type PeriodoApi,
  type TabelaHorarioApi,
  buscarTabelaHorario,
} from "../../api/horariosClient";
import {
  type AjustePontoApi,
  type EventoPontoApi,
  type EventoPontoDetalhadoApi,
  type MotivoAjustePonto,
  type RegistrarAjustePontoDto,
  type RegistrarEventoPontoDto,
  type TipoEventoPonto,
  buscarPonto,
  listarPontos,
  registrarAjustePonto,
  registrarPonto,
} from "../../api/pontoClient";
import {
  type VinculoHorarioApi,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import {
  formatarDiaCivil,
  formatarInstante,
  formatarMesReferencia,
} from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import "./VisaoPeriodoScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";

export const VISAO_PERIODO_TITULO_ID = "visao-periodo-titulo";

const TIPOS_EVENTO: { valor: TipoEventoPonto; rotulo: string }[] = [
  { valor: "entrada", rotulo: "Entrada" },
  { valor: "saida", rotulo: "Saída" },
  { valor: "inicio_pausa", rotulo: "Início de pausa" },
  { valor: "fim_pausa", rotulo: "Fim de pausa" },
];

const ROTULO_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_EVENTO.map(({ valor, rotulo }) => [valor, rotulo]),
);

const MOTIVOS_AJUSTE: { valor: MotivoAjustePonto; rotulo: string }[] = [
  { valor: "erro_de_digitacao", rotulo: "Erro de digitação" },
  { valor: "registro_duplicado", rotulo: "Registro duplicado" },
  { valor: "registro_indevido", rotulo: "Registro indevido" },
  { valor: "outro_controlado", rotulo: "Outro (controlado)" },
];

const ROTULO_MOTIVO: Record<string, string> = Object.fromEntries(
  MOTIVOS_AJUSTE.map(({ valor, rotulo }) => [valor, rotulo]),
);

const ROTULO_DIA: Record<string, string> = {
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
  domingo: "Domingo",
};

type FiltroTipo = "todos" | TipoEventoPonto;

interface VinculoComColaborador extends VinculoApi {
  nomeColaborador: string;
}

// T183 — o vínculo agora traz a jornada resumida (`tabela`); aqui ela é
// trocada pela tabela COMPLETA (com os períodos), buscada à parte.
interface VinculoHorarioComTabela extends Omit<VinculoHorarioApi, "tabela"> {
  tabela: TabelaHorarioApi | null;
}

interface ReferenciaHorarioState {
  vinculoId: string;
  competencia: string;
  status: "carregando" | "erro" | "dados";
  itens: VinculoHorarioComTabela[];
}

/**
 * Limites `[inicio, fim)` (ISO `AAAA-MM-DD`) da competência `AAAA-MM` — mesma
 * semântica de intervalo semiaberto usada pelo backend para vigência.
 */
function limitesCompetencia(competencia: string): {
  inicio: string;
  fim: string;
} {
  const [anoStr, mesStr] = competencia.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const inicio = `${anoStr}-${mesStr}-01`;
  const fim = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  return { inicio, fim };
}

/** Um vínculo de horário se sobrepõe à competência se seu intervalo de
 * vigência `[vigenciaInicio, vigenciaFim)` intersecta `[inicio, fim)`. */
function vigenciaSeSobrepoe(
  v: VinculoHorarioApi,
  inicio: string,
  fim: string,
): boolean {
  const comecaAntesDoFim = v.vigenciaInicio < fim;
  const terminaDepoisDoInicio =
    v.vigenciaFim === null || v.vigenciaFim > inicio;
  return comecaAntesDoFim && terminaDepoisDoInicio;
}

/**
 * "AAAA-MM-DDTHH:MM" (datetime-local) → ISO completo com fuso.
 *
 * TRANSPORTE, não apresentação: alimenta o payload da API. A exibição de
 * instantes é de `formatarInstante` (`format/data`), que converte para
 * `America/Sao_Paulo`.
 */
function paraIso(local: string): string {
  return new Date(local).toISOString();
}

interface FormularioErros {
  vinculoId?: string;
  tipo?: string;
  momento?: string;
  geral?: string;
}

interface FormularioState {
  vinculoId: string;
  tipo: TipoEventoPonto | "";
  momento: string;
  erros: FormularioErros;
  salvando: boolean;
}

interface AjusteErros {
  motivoCodigo?: string;
  correcao?: string;
  geral?: string;
}

type ModoAjuste = "corrigir" | "anular";

interface DetalheState {
  pontoId: string;
  status: "carregando" | "erro" | "dados";
  evento: EventoPontoDetalhadoApi | null;
  modoAjuste: ModoAjuste;
  ajusteMotivo: MotivoAjustePonto | "";
  ajusteMomento: string;
  ajusteTipo: TipoEventoPonto | "";
  ajusteErros: AjusteErros;
  salvandoAjuste: boolean;
}

export function VisaoPeriodoScreen() {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [eventos, setEventos] = useState<EventoPontoApi[]>([]);
  const [vinculos, setVinculos] = useState<VinculoComColaborador[]>([]);
  const [filtroVinculo, setFiltroVinculo] = useState<string>("todos");
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  // T189 — formulário aberto conta como edição em andamento, e envio como
  // salvamento: a troca de empresa pergunta antes de descartar, e espera
  // o envio terminar.
  useEdicaoEmAndamento("Registro de ponto", {
    pendente: formulario !== null,
    salvando: formulario?.salvando === true,
  });
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  const [referenciaHorario, setReferenciaHorario] =
    useState<ReferenciaHorarioState | null>(null);
  const formTituloId = useId();
  const detalheTituloId = useId();
  const referenciaHorarioTituloId = useId();
  const referenciasCarregadas = useRef(false);

  const carregarReferencias = useCallback(async () => {
    const colaboradoresResp = await listarColaboradores({ tamanhoPagina: 100 });
    const ativos = colaboradoresResp.itens.filter(
      (c) => c.situacao === "ativo",
    );
    const listas = await Promise.all(
      ativos.map(async (c) => {
        const vs = await listarVinculosDoColaborador(c.id);
        return vs.map((v): VinculoComColaborador => ({
          ...v,
          nomeColaborador: c.nome,
        }));
      }),
    );
    return listas.flat();
  }, []);

  const carregarDados = useCallback(
    async (vinculoId: string, competencia: string, tipo: FiltroTipo) => {
      setStatusCarregamento("carregando");
      try {
        const query: {
          vinculoId?: string;
          competencia?: string;
          tipo?: TipoEventoPonto;
        } = {};
        if (vinculoId !== "todos") query.vinculoId = vinculoId;
        if (competencia) query.competencia = competencia;
        if (tipo !== "todos") query.tipo = tipo;

        // Referências (colaboradores/vínculos) só na primeira carga; depois
        // os filtros só refazem a listagem de marcações.
        const precisaRefs = !referenciasCarregadas.current;
        const [eventosResp, refs] = await Promise.all([
          listarPontos({ ...query, tamanhoPagina: 100 }),
          precisaRefs ? carregarReferencias() : Promise.resolve(null),
        ]);
        setEventos(eventosResp.itens);
        if (refs) {
          setVinculos(refs);
          referenciasCarregadas.current = true;
        }
        setStatusCarregamento("dados");
      } catch {
        setStatusCarregamento("erro");
      }
    },
    [carregarReferencias],
  );

  useEffect(() => {
    void carregarDados(filtroVinculo, filtroCompetencia, filtroTipo);
  }, [filtroVinculo, filtroCompetencia, filtroTipo, carregarDados]);

  const vinculosPorId = useMemo(
    () => new Map(vinculos.map((v) => [v.id, v])),
    [vinculos],
  );
  const vinculosAtivos = useMemo(
    () => vinculos.filter((v) => v.situacao === "ativo"),
    [vinculos],
  );

  function rotuloVinculo(v: VinculoComColaborador): string {
    // T179 — matrícula opcional: sem ela, "Sem matrícula", nunca "null".
    return `${v.nomeColaborador} — ${exibirMatricula(v.matricula)}`;
  }
  function nomePorVinculoId(id: string): string {
    const v = vinculosPorId.get(id);
    return v ? rotuloVinculo(v) : `Vínculo ${id.slice(0, 8)}`;
  }

  function situacaoEvento(e: EventoPontoApi): {
    rotulo: string;
    variante: StatusVariant;
  } {
    if (e.efetivo.anulado) return { rotulo: "Anulada", variante: "neutral" };
    if (e.efetivo.totalAjustes > 0)
      return { rotulo: "Ajustada", variante: "warning" };
    return { rotulo: "Original", variante: "success" };
  }

  function abrirFormulario() {
    setDetalhe(null);
    setReferenciaHorario(null);
    setFormulario({
      vinculoId: vinculosAtivos.length === 1 ? vinculosAtivos[0]!.id : "",
      tipo: "",
      momento: "",
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  async function abrirDetalhe(pontoId: string) {
    setFormulario(null);
    setReferenciaHorario(null);
    setDetalhe({
      pontoId,
      status: "carregando",
      evento: null,
      modoAjuste: "corrigir",
      ajusteMotivo: "",
      ajusteMomento: "",
      ajusteTipo: "",
      ajusteErros: {},
      salvandoAjuste: false,
    });
    await recarregarDetalhe(pontoId);
  }

  async function recarregarDetalhe(pontoId: string) {
    setDetalhe((prev) =>
      prev && prev.pontoId === pontoId
        ? { ...prev, status: "carregando" }
        : prev,
    );
    try {
      const evento = await buscarPonto(pontoId);
      setDetalhe((prev) =>
        prev && prev.pontoId === pontoId
          ? { ...prev, evento, status: "dados" }
          : prev,
      );
    } catch {
      setDetalhe((prev) =>
        prev && prev.pontoId === pontoId ? { ...prev, status: "erro" } : prev,
      );
    }
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  /**
   * Referência de horário: consulta somente leitura, nunca resolvida
   * silenciosamente. Só habilita quando o vínculo (colaborador autorizado,
   * já resolvido em `vinculosPorId`) e a competência foram explicitamente
   * escolhidos nos filtros acima — nunca assume "hoje" nem "o mais recente".
   */
  /**
   * `vinculoId`/`competencia` são os mesmos parâmetros já gravados em
   * `referenciaHorario` no momento da chamada — servem só para confirmar,
   * a cada `setReferenciaHorario`, que a resposta (sucesso ou erro) ainda
   * corresponde ao painel aberto. Sem essa checagem, uma resposta atrasada
   * de uma consulta anterior (outro vínculo/competência, já fechada ou
   * substituída) poderia preencher o painel errado — mesmo padrão já usado
   * em `recarregarDetalhe`.
   */
  async function carregarReferenciaHorario(
    vinculoId: string,
    competencia: string,
    colaboradorId: string,
  ) {
    const aindaCorresponde = (prev: ReferenciaHorarioState | null) =>
      prev !== null &&
      prev.vinculoId === vinculoId &&
      prev.competencia === competencia;

    setReferenciaHorario((prev) =>
      aindaCorresponde(prev) ? { ...prev!, status: "carregando" } : prev,
    );
    try {
      const { inicio, fim } = limitesCompetencia(competencia);
      const resp = await listarVinculosHorario({
        colaboradorId,
        tamanhoPagina: 100,
      });
      const sobrepostos = resp.itens
        .filter((v) => vigenciaSeSobrepoe(v, inicio, fim))
        .sort((a, b) => a.vigenciaInicio.localeCompare(b.vigenciaInicio));
      const comTabela = await Promise.all(
        sobrepostos.map(async (v): Promise<VinculoHorarioComTabela> => {
          try {
            const tabela = await buscarTabelaHorario(v.tabelaHorarioId);
            return { ...v, tabela };
          } catch {
            return { ...v, tabela: null };
          }
        }),
      );
      setReferenciaHorario((prev) =>
        aindaCorresponde(prev)
          ? { ...prev!, status: "dados", itens: comTabela }
          : prev,
      );
    } catch {
      setReferenciaHorario((prev) =>
        aindaCorresponde(prev) ? { ...prev!, status: "erro" } : prev,
      );
    }
  }

  async function abrirReferenciaHorario() {
    if (filtroVinculo === "todos" || !filtroCompetencia) return;
    const vinculo = vinculosPorId.get(filtroVinculo);
    if (!vinculo) return;
    const vinculoId = filtroVinculo;
    const competencia = filtroCompetencia;
    setFormulario(null);
    setDetalhe(null);
    setReferenciaHorario({
      vinculoId,
      competencia,
      status: "carregando",
      itens: [],
    });
    await carregarReferenciaHorario(
      vinculoId,
      competencia,
      vinculo.colaboradorId,
    );
  }

  function tentarNovamenteReferenciaHorario() {
    if (!referenciaHorario) return;
    const vinculo = vinculosPorId.get(referenciaHorario.vinculoId);
    if (!vinculo) return;
    void carregarReferenciaHorario(
      referenciaHorario.vinculoId,
      referenciaHorario.competencia,
      vinculo.colaboradorId,
    );
  }

  function fecharReferenciaHorario() {
    setReferenciaHorario(null);
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (vinculosAtivos.length > 1 && !formulario.vinculoId) {
      erros.vinculoId = "Selecione o vínculo.";
    }
    if (!formulario.tipo) {
      erros.tipo = "Selecione o tipo de marcação.";
    }
    if (!formulario.momento) {
      erros.momento = "Informe a data e hora da marcação.";
    }
    if (erros.vinculoId ?? erros.tipo ?? erros.momento) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );
    try {
      const dto: RegistrarEventoPontoDto = {
        vinculoId: formulario.vinculoId,
        tipo: formulario.tipo as TipoEventoPonto,
        momento: paraIso(formulario.momento),
      };
      await registrarPonto(dto);
      setFormulario(null);
      await carregarDados(filtroVinculo, filtroCompetencia, filtroTipo);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a marcação. Tente novamente.";
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

  async function handleSubmitAjuste(evento: React.FormEvent) {
    evento.preventDefault();
    if (!detalhe || !detalhe.evento) return;

    const erros: AjusteErros = {};
    if (!detalhe.ajusteMotivo) {
      erros.motivoCodigo = "Selecione o motivo do ajuste.";
    }
    if (
      detalhe.modoAjuste === "corrigir" &&
      !detalhe.ajusteMomento &&
      !detalhe.ajusteTipo
    ) {
      erros.correcao =
        "Informe ao menos um novo valor (data/hora ou tipo) para corrigir.";
    }
    if (erros.motivoCodigo ?? erros.correcao) {
      setDetalhe((prev) => (prev ? { ...prev, ajusteErros: erros } : prev));
      return;
    }

    setDetalhe((prev) =>
      prev ? { ...prev, salvandoAjuste: true, ajusteErros: {} } : prev,
    );
    try {
      const dto: RegistrarAjustePontoDto =
        detalhe.modoAjuste === "anular"
          ? {
              motivoCodigo: detalhe.ajusteMotivo as MotivoAjustePonto,
              anula: true,
            }
          : {
              motivoCodigo: detalhe.ajusteMotivo as MotivoAjustePonto,
              ...(detalhe.ajusteMomento
                ? { momentoCorrigido: paraIso(detalhe.ajusteMomento) }
                : {}),
              ...(detalhe.ajusteTipo
                ? { tipoCorrigido: detalhe.ajusteTipo as TipoEventoPonto }
                : {}),
            };
      await registrarAjustePonto(detalhe.pontoId, dto);
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              salvandoAjuste: false,
              ajusteMotivo: "",
              ajusteMomento: "",
              ajusteTipo: "",
              modoAjuste: "corrigir",
            }
          : prev,
      );
      await recarregarDetalhe(detalhe.pontoId);
      await carregarDados(filtroVinculo, filtroCompetencia, filtroTipo);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível registrar o ajuste. Tente novamente.";
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              salvandoAjuste: false,
              ajusteErros: { ...prev.ajusteErros, geral: mensagem },
            }
          : prev,
      );
    }
  }

  const colunas: DataTableColumn<EventoPontoApi>[] = [
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (e) => nomePorVinculoId(e.vinculoId),
    },
    { key: "tipo", header: "Tipo", cell: (e) => ROTULO_TIPO[e.tipo] ?? e.tipo },
    {
      key: "momento",
      header: "Momento",
      cell: (e) => formatarInstante(e.momento),
    },
    {
      key: "competencia",
      header: "Competência",
      cell: (e) => formatarMesReferencia(e.competencia),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (e) => {
        const s = situacaoEvento(e);
        return <StatusBadge variant={s.variante}>{s.rotulo}</StatusBadge>;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (e) => (
        <Button variant="secondary" onClick={() => void abrirDetalhe(e.id)}>
          Ver detalhes
          <span className="sr-only"> — {formatarInstante(e.momento)}</span>
        </Button>
      ),
    },
  ];

  const colunasAjustes: DataTableColumn<AjustePontoApi>[] = [
    {
      key: "efeito",
      header: "Efeito",
      cell: (a) => (a.anula ? "Anulação" : "Correção"),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (a) => ROTULO_MOTIVO[a.motivoCodigo] ?? a.motivoCodigo,
    },
    {
      key: "novoMomento",
      header: "Novo momento",
      // `formatarInstante` já devolve o traço quando não há correção de momento.
      cell: (a) => formatarInstante(a.momentoCorrigido),
    },
    {
      key: "novoTipo",
      header: "Novo tipo",
      cell: (a) =>
        a.tipoCorrigido
          ? (ROTULO_TIPO[a.tipoCorrigido] ?? a.tipoCorrigido)
          : "—",
    },
    {
      key: "registradoEm",
      header: "Registrado em",
      cell: (a) => formatarInstante(a.registradoEm),
    },
  ];

  const colunasPeriodos: DataTableColumn<PeriodoApi>[] = [
    { key: "dia", header: "Dia", cell: (p) => ROTULO_DIA[p.dia] ?? p.dia },
    { key: "inicio", header: "Entrada", cell: (p) => p.inicio },
    { key: "fim", header: "Saída", cell: (p) => p.fim },
  ];

  const semVinculosAtivos =
    statusCarregamento === "dados" && vinculosAtivos.length === 0;
  const referenciaHorarioDesabilitada =
    filtroVinculo === "todos" || !filtroCompetencia;

  return (
    <div className="visao-periodo-screen">
      <PageHeader
        headingLevel={1}
        titleId={VISAO_PERIODO_TITULO_ID}
        title="Visão do período"
        description="Marcações de ponto por vínculo e competência. Cada marcação é imutável — correções são sempre ajustes aditivos que preservam o registro original. Esta tela apenas registra e corrige marcações; não faz nenhum cálculo nem apuração."
        actions={
          <Button
            onClick={abrirFormulario}
            disabled={statusCarregamento !== "dados" || semVinculosAtivos}
          >
            Registrar marcação
          </Button>
        }
      />

      <Surface
        as="section"
        padding="md"
        className="visao-periodo-screen__aviso"
        aria-labelledby="visao-periodo-aviso-titulo"
      >
        <StatusBadge variant="info">RH e DP</StatusBadge>
        <p
          id="visao-periodo-aviso-titulo"
          className="visao-periodo-screen__aviso-texto"
        >
          Somente o RH e o DP da própria empresa registram e corrigem marcações.
          A marcação original nunca é editada nem excluída: toda correção é um
          ajuste aditivo rastreável, e cada ação gera trilha de auditoria.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="visao-periodo-screen__erro"
          aria-labelledby="visao-periodo-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="visao-periodo-erro-titulo"
            className="visao-periodo-screen__section-title"
          >
            Não foi possível carregar as marcações
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void carregarDados(filtroVinculo, filtroCompetencia, filtroTipo)
            }
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="visao-periodo-lista-titulo">
          <h2
            id="visao-periodo-lista-titulo"
            className="visao-periodo-screen__section-title"
          >
            Marcações
          </h2>

          <div className="visao-periodo-screen__filtros">
            <FormField id="visao-periodo-filtro-vinculo" label="Vínculo">
              {(control) => (
                <select
                  value={filtroVinculo}
                  onChange={(e) => setFiltroVinculo(e.target.value)}
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todos os vínculos</option>
                  {vinculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {rotuloVinculo(v)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="visao-periodo-filtro-competencia"
              label="Competência"
            >
              {(control) => (
                <input
                  type="month"
                  value={filtroCompetencia}
                  onChange={(e) => setFiltroCompetencia(e.target.value)}
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                />
              )}
            </FormField>

            <FormField id="visao-periodo-filtro-tipo" label="Tipo">
              {(control) => (
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todos os tipos</option>
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="visao-periodo-screen__referencia-acao">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void abrirReferenciaHorario()}
              disabled={
                statusCarregamento !== "dados" || referenciaHorarioDesabilitada
              }
            >
              Ver horários de referência
            </Button>
            {referenciaHorarioDesabilitada ? (
              <p className="visao-periodo-screen__nota">
                Selecione um vínculo específico e uma competência acima para ver
                os horários de referência.
              </p>
            ) : null}
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="visao-periodo-screen__carregando" role="status">
              Carregando marcações…
            </p>
          ) : eventos.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma marcação encontrada"
              description="Ajuste os filtros ou registre uma marcação para esta empresa."
            />
          ) : (
            <DataTable
              caption="Marcações de ponto"
              columns={colunas}
              rows={eventos}
              rowKey={(e) => e.id}
            />
          )}

          {semVinculosAtivos ? (
            <p className="visao-periodo-screen__nota" role="status">
              Nenhum vínculo ativo disponível para registrar marcação.
            </p>
          ) : null}
        </section>
      )}

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="visao-periodo-screen__formulario"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="visao-periodo-screen__section-title"
          >
            Detalhe da marcação
          </h2>

          {detalhe.status === "carregando" ? (
            <p className="visao-periodo-screen__carregando" role="status">
              Carregando detalhe…
            </p>
          ) : detalhe.status === "erro" || !detalhe.evento ? (
            <>
              <p className="visao-periodo-screen__form-erro" role="alert">
                Não foi possível carregar o detalhe desta marcação.
              </p>
              <FormActions>
                <Button
                  variant="secondary"
                  onClick={() => void recarregarDetalhe(detalhe.pontoId)}
                >
                  Tentar novamente
                </Button>
                <Button variant="secondary" onClick={fecharDetalhe}>
                  Fechar
                </Button>
              </FormActions>
            </>
          ) : (
            <>
              <dl className="visao-periodo-screen__resumo-lista">
                <div>
                  <dt>Colaborador</dt>
                  <dd>{nomePorVinculoId(detalhe.evento.vinculoId)}</dd>
                </div>
                <div>
                  <dt>Competência</dt>
                  <dd>{formatarMesReferencia(detalhe.evento.competencia)}</dd>
                </div>
                <div>
                  <dt>Registro original</dt>
                  <dd>
                    {ROTULO_TIPO[detalhe.evento.tipo] ?? detalhe.evento.tipo} ·{" "}
                    {formatarInstante(detalhe.evento.momento)}
                  </dd>
                </div>
                <div>
                  <dt>Valor efetivo</dt>
                  <dd>
                    {detalhe.evento.efetivo.anulado
                      ? "Anulada"
                      : `${ROTULO_TIPO[detalhe.evento.efetivo.tipo] ?? detalhe.evento.efetivo.tipo} · ${formatarInstante(detalhe.evento.efetivo.momento)}`}
                  </dd>
                </div>
              </dl>

              <p className="visao-periodo-screen__nota">
                O registro original é imutável e permanece preservado, qualquer
                que seja o histórico de ajustes abaixo.
              </p>

              <div className="visao-periodo-screen__bloco">
                <h3 className="visao-periodo-screen__section-title">
                  Histórico de ajustes
                </h3>
                {detalhe.evento.ajustes.length === 0 ? (
                  <p>Nenhum ajuste — vale o registro original.</p>
                ) : (
                  <DataTable
                    caption={`Histórico de ajustes — ${formatarInstante(detalhe.evento.momento)}`}
                    columns={colunasAjustes}
                    rows={detalhe.evento.ajustes}
                    rowKey={(a) => a.id}
                  />
                )}
              </div>

              {detalhe.evento.efetivo.anulado ? (
                <p className="visao-periodo-screen__nota">
                  Esta marcação foi anulada — a anulação é terminal e não aceita
                  novos ajustes.
                </p>
              ) : (
                <form
                  className="visao-periodo-screen__form"
                  aria-label="Formulário de ajuste de marcação"
                  onSubmit={(e) => void handleSubmitAjuste(e)}
                >
                  <h3 className="visao-periodo-screen__section-title">
                    Registrar ajuste
                  </h3>
                  <p className="visao-periodo-screen__nota">
                    O ajuste é aditivo: corrige o valor efetivo ou anula a
                    marcação, sem nunca apagar o registro original.
                  </p>

                  <FormField
                    id="visao-periodo-ajuste-modo"
                    label="Tipo de ajuste"
                    required
                  >
                    {(control) => (
                      <select
                        value={detalhe.modoAjuste}
                        onChange={(e) =>
                          setDetalhe((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  modoAjuste: e.target.value as ModoAjuste,
                                  ajusteErros: {},
                                }
                              : prev,
                          )
                        }
                        {...control}
                      >
                        <option value="corrigir">Corrigir</option>
                        <option value="anular">Anular</option>
                      </select>
                    )}
                  </FormField>

                  <FormField
                    id="visao-periodo-ajuste-motivo"
                    label="Motivo"
                    required
                    {...(detalhe.ajusteErros.motivoCodigo
                      ? { error: detalhe.ajusteErros.motivoCodigo }
                      : {})}
                  >
                    {(control) => (
                      <select
                        value={detalhe.ajusteMotivo}
                        onChange={(e) =>
                          setDetalhe((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  ajusteMotivo: e.target
                                    .value as MotivoAjustePonto,
                                  ajusteErros: {},
                                }
                              : prev,
                          )
                        }
                        {...control}
                      >
                        <option value="">Selecione…</option>
                        {MOTIVOS_AJUSTE.map((m) => (
                          <option key={m.valor} value={m.valor}>
                            {m.rotulo}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>

                  {detalhe.modoAjuste === "corrigir" ? (
                    <>
                      <FormField
                        id="visao-periodo-ajuste-momento"
                        label="Novo momento (opcional)"
                        help="Deve permanecer na mesma competência da marcação original."
                        {...(detalhe.ajusteErros.correcao
                          ? { error: detalhe.ajusteErros.correcao }
                          : {})}
                      >
                        {(control) => (
                          <input
                            type="datetime-local"
                            value={detalhe.ajusteMomento}
                            onChange={(e) =>
                              setDetalhe((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      ajusteMomento: e.target.value,
                                      ajusteErros: {},
                                    }
                                  : prev,
                              )
                            }
                            {...control}
                          />
                        )}
                      </FormField>

                      <FormField
                        id="visao-periodo-ajuste-tipo"
                        label="Novo tipo (opcional)"
                      >
                        {(control) => (
                          <select
                            value={detalhe.ajusteTipo}
                            onChange={(e) =>
                              setDetalhe((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      ajusteTipo: e.target
                                        .value as TipoEventoPonto,
                                      ajusteErros: {},
                                    }
                                  : prev,
                              )
                            }
                            {...control}
                          >
                            <option value="">Manter</option>
                            {TIPOS_EVENTO.map((t) => (
                              <option key={t.valor} value={t.valor}>
                                {t.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    </>
                  ) : null}

                  {detalhe.ajusteErros.geral ? (
                    <p className="visao-periodo-screen__form-erro" role="alert">
                      {detalhe.ajusteErros.geral}
                    </p>
                  ) : null}

                  <FormActions>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={fecharDetalhe}
                      disabled={detalhe.salvandoAjuste}
                    >
                      Fechar
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={detalhe.salvandoAjuste}
                    >
                      {detalhe.salvandoAjuste
                        ? "Registrando…"
                        : "Registrar ajuste"}
                    </Button>
                  </FormActions>
                </form>
              )}

              {detalhe.evento.efetivo.anulado ? (
                <FormActions>
                  <Button variant="secondary" onClick={fecharDetalhe}>
                    Fechar
                  </Button>
                </FormActions>
              ) : null}
            </>
          )}
        </Surface>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="visao-periodo-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="visao-periodo-screen__section-title">
            Registrar marcação
          </h2>
          <p className="visao-periodo-screen__aviso-texto">
            A marcação é registrada como veio e passa a ser imutável. Correções
            posteriores são sempre ajustes aditivos.
          </p>

          <form
            className="visao-periodo-screen__form"
            aria-label="Formulário de nova marcação"
            onSubmit={(e) => void handleSubmit(e)}
          >
            {vinculosAtivos.length > 1 ? (
              <FormField
                id="visao-periodo-vinculo"
                label="Vínculo"
                required
                {...(formulario.erros.vinculoId
                  ? { error: formulario.erros.vinculoId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.vinculoId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? { ...prev, vinculoId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {vinculosAtivos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {rotuloVinculo(v)}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            <FormField
              id="visao-periodo-tipo"
              label="Tipo de marcação"
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
                            tipo: e.target.value as TipoEventoPonto,
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            <FormField
              id="visao-periodo-momento"
              label="Data e hora"
              required
              {...(formulario.erros.momento
                ? { error: formulario.erros.momento }
                : {})}
            >
              {(control) => (
                <input
                  type="datetime-local"
                  value={formulario.momento}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, momento: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.erros.geral ? (
              <p className="visao-periodo-screen__form-erro" role="alert">
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
                {formulario.salvando ? "Registrando…" : "Registrar marcação"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {referenciaHorario ? (
        <Surface
          as="section"
          padding="lg"
          className="visao-periodo-screen__formulario"
          aria-labelledby={referenciaHorarioTituloId}
        >
          <h2
            id={referenciaHorarioTituloId}
            className="visao-periodo-screen__section-title"
          >
            Horários de referência —{" "}
            {nomePorVinculoId(referenciaHorario.vinculoId)} ·{" "}
            {formatarMesReferencia(referenciaHorario.competencia)}
          </h2>
          <p className="visao-periodo-screen__nota">
            Consulta somente leitura: não corrige marcação, não calcula jornada,
            tolerância, horas extras, faltas ou DSR, não gera ajuste, não fecha
            período e não altera saldo, Banco de Horas ou Folha.
          </p>

          {referenciaHorario.status === "carregando" ? (
            <p className="visao-periodo-screen__carregando" role="status">
              Carregando horários de referência…
            </p>
          ) : referenciaHorario.status === "erro" ? (
            <>
              <p className="visao-periodo-screen__form-erro" role="alert">
                Não foi possível carregar os horários de referência.
              </p>
              <Button
                variant="secondary"
                onClick={tentarNovamenteReferenciaHorario}
              >
                Tentar novamente
              </Button>
            </>
          ) : referenciaHorario.itens.length === 0 ? (
            <p>Nenhum horário de referência aplicável a esta competência.</p>
          ) : (
            <div className="visao-periodo-screen__bloco">
              {referenciaHorario.itens.length > 1 ? (
                <p className="visao-periodo-screen__nota" role="status">
                  Mais de uma tabela de horário vigorou nesta competência —
                  nenhuma delas vale sozinha para o mês inteiro. Exibidas em
                  ordem cronológica.
                </p>
              ) : null}
              {referenciaHorario.itens.map((item) => (
                <div key={item.id} className="visao-periodo-screen__bloco">
                  <h3 className="visao-periodo-screen__section-title">
                    {item.tabela
                      ? item.tabela.nome
                      : `Tabela ${item.tabelaHorarioId.slice(0, 8)}`}
                  </h3>
                  {/* Datas civis (`@db.Date`): formatadas direto da string,
                      sem `Date`, para não deslocar o dia. O fim ausente
                      continua "vigente" — é semântico (vigência aberta) e,
                      por isso, não vira traço. */}
                  <p className="visao-periodo-screen__nota">
                    Vigência: {formatarDiaCivil(item.vigenciaInicio)} –{" "}
                    {item.vigenciaFim
                      ? formatarDiaCivil(item.vigenciaFim)
                      : "vigente"}
                  </p>
                  {!item.tabela || item.tabela.periodos.length === 0 ? (
                    <p>Nenhum período cadastrado nesta tabela.</p>
                  ) : (
                    <DataTable
                      caption={`Períodos — ${item.tabela.nome}`}
                      columns={colunasPeriodos}
                      rows={item.tabela.periodos}
                      rowKey={(p, i) => `${item.id}-${p.dia}-${i}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <FormActions>
            <Button variant="secondary" onClick={fecharReferenciaHorario}>
              Fechar
            </Button>
          </FormActions>
        </Surface>
      ) : null}
    </div>
  );
}
