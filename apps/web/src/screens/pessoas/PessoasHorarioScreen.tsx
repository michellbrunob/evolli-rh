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
import { listarColaboradores } from "../../api/colaboradoresClient";
import {
  type TabelaHorarioApi,
  listarTabelasHorario,
} from "../../api/horariosClient";
import {
  type CriarVinculoHorarioDto,
  type EncerrarVinculoHorarioDto,
  type ListarVinculosHorarioQuery,
  type VinculoHorarioApi,
  criarVinculoHorario,
  encerrarVinculoHorario,
  listarVinculosHorario,
} from "../../api/vinculoHorarioClient";
import { formatarDiaCivil } from "../../format/data";
import {
  SeletorColaboradorPaginado,
  type ColaboradorEscolhido,
} from "./SeletorColaboradorPaginado";
import { PaginacaoSimples } from "./PaginacaoSimples";
import "./PessoasHorarioScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";

export const PESSOAS_HORARIO_TITULO_ID = "pessoas-horario-titulo";

/** T191 — vínculos por página, como as demais listas de Pessoas. */
export const TAMANHO_PAGINA_VINCULOS = 20;

/**
 * T191 — o nome vem do próprio vínculo. Sem ele (falha de leitura, servidor
 * anterior), um rótulo neutro: nunca o identificador técnico no lugar do nome.
 */
function nomeColaborador(v: VinculoHorarioApi): string {
  return v.colaborador?.nome ?? "Colaborador não identificado";
}

/** T191 — a jornada também vem do próprio vínculo (T183). */
function nomeJornada(v: VinculoHorarioApi): string {
  return v.tabela?.nome ?? "Jornada não identificada";
}

const VARIANTE_SITUACAO: Record<"vigente" | "encerrada", StatusVariant> = {
  vigente: "success",
  encerrada: "neutral",
};

interface FormularioErros {
  colaboradorId?: string;
  tabelaHorarioId?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  geral?: string;
}

interface FormularioState {
  colaboradorId: string;
  tabelaHorarioId: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  erros: FormularioErros;
  salvando: boolean;
}

interface DetalheState {
  vinculo: VinculoHorarioApi;
  vigenciaFimEncerramento: string;
  encerrando: boolean;
  erroEncerramento: string | null;
}

export interface PessoasHorarioScreenProps {
  /**
   * T183 — o perfil vincula e encerra jornadas: só o RH. Sem isso (DP,
   * `master_tecnico`), a tela é só consulta, sem nenhum controle de escrita.
   * Só orienta a tela: quem recusa é o servidor.
   */
  readonly podeOperar?: boolean;
}

export function PessoasHorarioScreen({
  podeOperar = false,
}: PessoasHorarioScreenProps = {}) {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [vinculos, setVinculos] = useState<VinculoHorarioApi[]>([]);
  /**
   * T191 — a tabela de vínculos pagina no servidor, de 20 em 20, com filtros
   * por colaborador e por jornada. Antes era UMA página de 100, e os nomes
   * vinham de um dicionário de 100 colaboradores: acima disso, vínculos
   * sumiam e nomes viravam identificadores técnicos.
   */
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [filtroColaborador, setFiltroColaborador] =
    useState<ColaboradorEscolhido | null>(null);
  const [filtroJornadaId, setFiltroJornadaId] = useState("");
  /**
   * T191 — a busca do filtro por colaborador abre sob pedido: aberta o tempo
   * todo, ela poria uma lista de nomes acima da tabela antes de alguém
   * querer filtrar.
   */
  const [buscandoColaborador, setBuscandoColaborador] = useState(false);
  /** Só a resposta mais recente é aplicada (filtro trocado durante a leitura). */
  const pedidoVinculosRef = useRef(0);
  /** Ativos e jornadas (formulário e filtro) não carregaram. */
  const [apoioFalhou, setApoioFalhou] = useState(false);
  /**
   * T188 — quantos colaboradores ATIVOS o escopo tem, contados pelo servidor
   * (`situacao=ativo`, a regra por empresa da T178), e qual é, quando há um
   * só. Antes vinha da página de 100, e passava a errar acima dela.
   */
  const [ativos, setAtivos] = useState<{
    total: number;
    unico: ColaboradorEscolhido | null;
  }>({ total: 0, unico: null });
  const [colaboradorDoFormulario, setColaboradorDoFormulario] =
    useState<ColaboradorEscolhido | null>(null);
  const [tabelas, setTabelas] = useState<TabelaHorarioApi[]>([]);
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  // T189 — formulário aberto conta como edição em andamento, e envio como
  // salvamento: a troca de empresa pergunta antes de descartar, e espera
  // o envio terminar.
  useEdicaoEmAndamento("Horário de trabalho", {
    pendente: formulario !== null,
    salvando: formulario?.salvando === true,
  });
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  const formTituloId = useId();
  const detalheTituloId = useId();

  const carregarVinculos = useCallback(
    async (
      colaboradorId: string,
      tabelaHorarioId: string,
      paginaPedida: number,
    ) => {
      const pedido = ++pedidoVinculosRef.current;
      setStatusCarregamento("carregando");
      try {
        const query: ListarVinculosHorarioQuery = {
          pagina: paginaPedida,
          tamanhoPagina: TAMANHO_PAGINA_VINCULOS,
        };
        if (colaboradorId) query.colaboradorId = colaboradorId;
        if (tabelaHorarioId) query.tabelaHorarioId = tabelaHorarioId;
        const resp = await listarVinculosHorario(query);
        if (pedido !== pedidoVinculosRef.current) return;
        setVinculos(resp.itens);
        setPagina(resp.pagina);
        setTotal(resp.total);
        setStatusCarregamento("dados");
      } catch {
        if (pedido !== pedidoVinculosRef.current) return;
        setStatusCarregamento("erro");
      }
    },
    [],
  );

  // Trocar de filtro volta para a primeira página: o conjunto é outro.
  const filtroColaboradorId = filtroColaborador?.id ?? "";
  useEffect(() => {
    void carregarVinculos(filtroColaboradorId, filtroJornadaId, 1);
  }, [filtroColaboradorId, filtroJornadaId, carregarVinculos]);

  /**
   * Apoio do formulário e do filtro: quantos ativos (T188) e as jornadas. As
   * jornadas seguem numa página de 100 — catálogo da empresa, limite
   * registrado; a TABELA não depende mais dela: cada vínculo traz a sua.
   */
  const carregarApoio = useCallback(async () => {
    try {
      const [ativosResp, tabelasResp] = await Promise.all([
        listarColaboradores({ situacao: "ativo", tamanhoPagina: 1 }),
        listarTabelasHorario({ tamanhoPagina: 100 }),
      ]);
      const primeiroAtivo = ativosResp.itens[0];
      setAtivos({
        total: ativosResp.total,
        unico:
          ativosResp.total === 1 && primeiroAtivo
            ? { id: primeiroAtivo.id, nome: primeiroAtivo.nome }
            : null,
      });
      setTabelas(tabelasResp.itens);
      setApoioFalhou(false);
    } catch {
      setApoioFalhou(true);
    }
  }, []);

  useEffect(() => {
    void carregarApoio();
  }, [carregarApoio]);

  function tentarDeNovo() {
    void carregarApoio();
    void carregarVinculos(filtroColaboradorId, filtroJornadaId, pagina);
  }

  const tabelasAtivas = useMemo(
    () => tabelas.filter((t) => t.ativo),
    [tabelas],
  );

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA_VINCULOS));
  const filtrando = filtroColaborador !== null || filtroJornadaId !== "";

  function limparFiltros() {
    setFiltroColaborador(null);
    setBuscandoColaborador(false);
    setFiltroJornadaId("");
  }

  function abrirFormulario() {
    setDetalhe(null);
    setColaboradorDoFormulario(ativos.unico);
    setFormulario({
      colaboradorId: ativos.unico?.id ?? "",
      tabelaHorarioId: tabelasAtivas.length === 1 ? tabelasAtivas[0]!.id : "",
      vigenciaInicio: "",
      vigenciaFim: "",
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  function abrirDetalhe(vinculo: VinculoHorarioApi) {
    setFormulario(null);
    setDetalhe({
      vinculo,
      vigenciaFimEncerramento: "",
      encerrando: false,
      erroEncerramento: null,
    });
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (ativos.total > 1 && !formulario.colaboradorId) {
      erros.colaboradorId = "Selecione o colaborador.";
    }
    if (tabelasAtivas.length > 1 && !formulario.tabelaHorarioId) {
      erros.tabelaHorarioId = "Selecione a tabela de horário.";
    }
    if (!formulario.vigenciaInicio) {
      erros.vigenciaInicio = "Informe o início da vigência.";
    }
    if (
      formulario.vigenciaFim &&
      formulario.vigenciaInicio &&
      formulario.vigenciaFim <= formulario.vigenciaInicio
    ) {
      erros.vigenciaFim = "O fim da vigência deve ser posterior ao início.";
    }

    if (
      erros.colaboradorId ??
      erros.tabelaHorarioId ??
      erros.vigenciaInicio ??
      erros.vigenciaFim
    ) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      const dto: CriarVinculoHorarioDto = {
        colaboradorId: formulario.colaboradorId,
        tabelaHorarioId: formulario.tabelaHorarioId,
        vigenciaInicio: formulario.vigenciaInicio,
        ...(formulario.vigenciaFim
          ? { vigenciaFim: formulario.vigenciaFim }
          : {}),
      };
      await criarVinculoHorario(dto);
      setFormulario(null);
      await carregarVinculos(filtroColaboradorId, filtroJornadaId, 1);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status: unknown }).status
          : undefined;
      const mensagem =
        status === 409
          ? "Este colaborador já possui uma tabela de horário vigente nesse período. Encerre o vínculo atual ou ajuste as datas antes de criar um novo."
          : err instanceof Error
            ? err.message
            : "Não foi possível criar o vínculo. Tente novamente.";
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

  async function handleEncerrar() {
    if (!detalhe) return;
    const { vigenciaFimEncerramento, vinculo } = detalhe;

    if (!vigenciaFimEncerramento) {
      setDetalhe((prev) =>
        prev
          ? { ...prev, erroEncerramento: "Informe a data de encerramento." }
          : prev,
      );
      return;
    }
    if (vigenciaFimEncerramento <= vinculo.vigenciaInicio) {
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              erroEncerramento:
                "A data de encerramento deve ser posterior ao início da vigência.",
            }
          : prev,
      );
      return;
    }

    setDetalhe((prev) =>
      prev ? { ...prev, encerrando: true, erroEncerramento: null } : prev,
    );
    try {
      const dto: EncerrarVinculoHorarioDto = {
        vigenciaFim: vigenciaFimEncerramento,
      };
      const atualizado = await encerrarVinculoHorario(vinculo.id, dto);
      setDetalhe((prev) =>
        prev ? { ...prev, vinculo: atualizado, encerrando: false } : prev,
      );
      setVinculos((prev) =>
        prev.map((v) => (v.id === atualizado.id ? atualizado : v)),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível encerrar a vigência. Tente novamente.";
      setDetalhe((prev) =>
        prev
          ? { ...prev, encerrando: false, erroEncerramento: mensagem }
          : prev,
      );
    }
  }

  const semOpcoesValidas = ativos.total === 0 || tabelasAtivas.length === 0;

  const colunas: DataTableColumn<VinculoHorarioApi>[] = [
    {
      key: "colaborador",
      header: "Colaborador",
      cell: (v) => nomeColaborador(v),
    },
    {
      key: "tabela",
      header: "Tabela de horário",
      cell: (v) => nomeJornada(v),
    },
    {
      key: "vigencia",
      header: "Vigência",
      cell: (v) =>
        v.vigenciaFim
          ? `${formatarDiaCivil(v.vigenciaInicio)} – ${formatarDiaCivil(v.vigenciaFim)}`
          : `${formatarDiaCivil(v.vigenciaInicio)} – vigente`,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO[v.vigenciaFim ? "encerrada" : "vigente"]}
        >
          {v.vigenciaFim ? "Encerrada" : "Vigente"}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (v) => (
        <Button variant="secondary" onClick={() => abrirDetalhe(v)}>
          Ver detalhes
          <span className="sr-only"> — {nomeColaborador(v)}</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="pessoas-horario-screen">
      <PageHeader
        headingLevel={1}
        titleId={PESSOAS_HORARIO_TITULO_ID}
        title="Horário de trabalho"
        description="O RH vincula uma tabela de horário ao colaborador, com vigência — a mesma tabela pode ser reaproveitada por vários colaboradores, e uma nova vigência substitui a anterior somente dali em diante."
        actions={
          podeOperar ? (
            <Button
              onClick={abrirFormulario}
              disabled={statusCarregamento !== "dados" || semOpcoesValidas}
            >
              Novo vínculo
            </Button>
          ) : undefined
        }
      />

      <Surface
        as="section"
        padding="md"
        className="pessoas-horario-screen__aviso"
        aria-labelledby="pessoas-horario-aviso-titulo"
      >
        <StatusBadge variant="info">
          {podeOperar ? "Somente RH" : "Somente consulta"}
        </StatusBadge>
        <p
          id="pessoas-horario-aviso-titulo"
          className="pessoas-horario-screen__aviso-texto"
        >
          {podeOperar
            ? "Somente o RH da própria empresa vincula ou encerra a tabela de horário de um colaborador. Uma nova vigência vale apenas a partir da data de início escolhida — ela nunca altera cálculo, apuração ou saldo já existentes."
            : "Você consulta as jornadas dos colaboradores da empresa ativa e as suas vigências. Só o RH vincula, troca e encerra."}
        </p>
      </Surface>

      {statusCarregamento === "erro" || apoioFalhou ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__erro"
          aria-labelledby="pessoas-horario-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="pessoas-horario-erro-titulo"
            className="pessoas-horario-screen__section-title"
          >
            Não foi possível carregar os vínculos de horário
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button variant="secondary" onClick={tentarDeNovo}>
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="pessoas-horario-lista-titulo">
          <h2
            id="pessoas-horario-lista-titulo"
            className="pessoas-horario-screen__section-title"
          >
            Colaboradores com tabela de horário vinculada
          </h2>

          {/* T191 — filtros combináveis, no servidor e antes da paginação:
              o colaborador por busca (o mesmo seletor da T188) e a jornada. */}
          <div
            className="pessoas-horario-screen__filtros"
            role="group"
            aria-label="Filtrar vínculos de horário"
          >
            <div className="pessoas-horario-screen__filtro-colaborador">
              {filtroColaborador ? (
                <p className="pessoas-horario-screen__filtro-ativo">
                  <span>
                    Colaborador: <strong>{filtroColaborador.nome}</strong>
                  </span>
                  <Button
                    variant="secondary"
                    aria-label={`Remover filtro de colaborador: ${filtroColaborador.nome}`}
                    onClick={() => setFiltroColaborador(null)}
                  >
                    Remover <span aria-hidden="true">×</span>
                  </Button>
                </p>
              ) : buscandoColaborador ? (
                <>
                  <SeletorColaboradorPaginado
                    id="pessoas-horario-filtro-colaborador"
                    rotulo="Filtrar por colaborador (nome ou matrícula)"
                    selecionado={null}
                    onSelecionar={(c) => {
                      setFiltroColaborador(c);
                      setBuscandoColaborador(false);
                    }}
                  />
                  <Button
                    variant="subtle"
                    onClick={() => setBuscandoColaborador(false)}
                  >
                    Cancelar filtro por colaborador
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setBuscandoColaborador(true)}
                >
                  Filtrar por colaborador
                </Button>
              )}
            </div>
            <FormField id="pessoas-horario-filtro-jornada" label="Jornada">
              {(control) => (
                <select
                  value={filtroJornadaId}
                  onChange={(e) => setFiltroJornadaId(e.target.value)}
                  {...control}
                >
                  <option value="">Todas as jornadas</option>
                  {tabelas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ativo ? t.nome : `${t.nome} (inativa)`}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="pessoas-horario-screen__carregando" role="status">
              Carregando vínculos de horário…
            </p>
          ) : vinculos.length === 0 && filtrando ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum vínculo com estes filtros"
              description="Nenhum vínculo de horário corresponde ao colaborador ou à jornada escolhidos."
              action={
                <Button variant="secondary" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : vinculos.length === 0 && total > 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum vínculo nesta página"
              description="Esta página voltou vazia: o conjunto pode ter mudado desde a última leitura."
              action={
                <Button
                  variant="secondary"
                  onClick={() =>
                    void carregarVinculos(
                      filtroColaboradorId,
                      filtroJornadaId,
                      1,
                    )
                  }
                >
                  Ir para a primeira página
                </Button>
              }
            />
          ) : vinculos.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum vínculo de horário cadastrado"
              description="Vincule uma tabela de horário a um colaborador desta empresa para que ela apareça aqui."
              {...(podeOperar
                ? {
                    action: (
                      <Button
                        onClick={abrirFormulario}
                        disabled={semOpcoesValidas}
                      >
                        Novo vínculo
                      </Button>
                    ),
                  }
                : {})}
            />
          ) : (
            <>
              <p className="pessoas-horario-screen__total">
                {total === 1
                  ? "1 vínculo no filtro atual"
                  : `${total} vínculos no filtro atual`}
              </p>
              <DataTable
                caption="Colaboradores com tabela de horário vinculada"
                columns={colunas}
                rows={vinculos}
                rowKey={(v) => v.id}
              />
              <PaginacaoSimples
                rotulo="Páginas de vínculos de horário"
                pagina={pagina}
                totalPaginas={totalPaginas}
                onIrPara={(destino) =>
                  void carregarVinculos(
                    filtroColaboradorId,
                    filtroJornadaId,
                    destino,
                  )
                }
              />
            </>
          )}

          {podeOperar && statusCarregamento === "dados" && semOpcoesValidas ? (
            <p className="pessoas-horario-screen__form-erro" role="status">
              {ativos.total === 0
                ? "Nenhum colaborador ativo disponível para vincular. "
                : ""}
              {tabelasAtivas.length === 0
                ? "Nenhuma tabela de horário ativa disponível para vincular."
                : ""}
            </p>
          ) : null}
        </section>
      )}

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__formulario"
          aria-labelledby={detalheTituloId}
        >
          <h2
            id={detalheTituloId}
            className="pessoas-horario-screen__section-title"
          >
            {nomeColaborador(detalhe.vinculo)}
          </h2>
          <p>
            <StatusBadge
              variant={
                VARIANTE_SITUACAO[
                  detalhe.vinculo.vigenciaFim ? "encerrada" : "vigente"
                ]
              }
            >
              {detalhe.vinculo.vigenciaFim ? "Encerrada" : "Vigente"}
            </StatusBadge>
          </p>
          <p className="pessoas-horario-screen__aviso-texto">
            Tabela de horário: {nomeJornada(detalhe.vinculo)}
            <br />
            Vigência: {formatarDiaCivil(detalhe.vinculo.vigenciaInicio)} –{" "}
            {detalhe.vinculo.vigenciaFim
              ? formatarDiaCivil(detalhe.vinculo.vigenciaFim)
              : "vigente"}
          </p>
          <p className="pessoas-horario-screen__aviso-texto">
            Colaborador, tabela e início da vigência são imutáveis. Apenas o fim
            da vigência pode ser registrado, uma única vez — é só referência de
            horário, sem cálculo de jornada, tolerância, horas extras, faltas,
            DSR, saldo, Banco de Horas ou Folha.
          </p>

          {podeOperar && !detalhe.vinculo.vigenciaFim ? (
            <div className="pessoas-horario-screen__encerrar">
              <FormField
                id="pessoas-horario-encerrar-data"
                label="Encerrar vigência em"
                {...(detalhe.erroEncerramento
                  ? { error: detalhe.erroEncerramento }
                  : {})}
              >
                {(control) => (
                  <input
                    type="date"
                    value={detalhe.vigenciaFimEncerramento}
                    onChange={(e) =>
                      setDetalhe((prev) =>
                        prev
                          ? {
                              ...prev,
                              vigenciaFimEncerramento: e.target.value,
                              erroEncerramento: null,
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleEncerrar()}
                disabled={detalhe.encerrando}
              >
                {detalhe.encerrando ? "Encerrando…" : "Encerrar vigência"}
              </Button>
            </div>
          ) : null}

          <FormActions>
            <Button
              variant="secondary"
              type="button"
              onClick={fecharDetalhe}
              disabled={detalhe.encerrando}
            >
              Fechar
            </Button>
          </FormActions>
        </Surface>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-horario-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="pessoas-horario-screen__section-title"
          >
            Novo vínculo de horário
          </h2>
          <p className="pessoas-horario-screen__aviso-texto">
            Colaborador, tabela de horário e início da vigência não poderão ser
            alterados depois de criados. Para corrigir, encerre a vigência e
            registre um novo vínculo.
          </p>

          <form
            className="pessoas-horario-screen__form"
            aria-label="Formulário de novo vínculo de horário"
            onSubmit={(e) => void handleSubmit(e)}
          >
            {/* T188 — qualquer colaborador ATIVO da empresa, por busca
                paginada no servidor; sem o teto de 100. Com um só ativo,
                ele já vem escolhido e o campo não aparece, como antes. */}
            {ativos.total > 1 ? (
              <SeletorColaboradorPaginado
                id="pessoas-horario-colaborador"
                rotulo="Colaborador (buscar por nome ou matrícula)"
                situacao="ativo"
                selecionado={colaboradorDoFormulario}
                onSelecionar={(c) => {
                  setColaboradorDoFormulario(c);
                  setFormulario((prev) =>
                    prev
                      ? { ...prev, colaboradorId: c?.id ?? "", erros: {} }
                      : prev,
                  );
                }}
                {...(formulario.erros.colaboradorId
                  ? { erro: formulario.erros.colaboradorId }
                  : {})}
              />
            ) : null}

            {tabelasAtivas.length > 1 ? (
              <FormField
                id="pessoas-horario-tabela"
                label="Tabela de horário"
                required
                {...(formulario.erros.tabelaHorarioId
                  ? { error: formulario.erros.tabelaHorarioId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.tabelaHorarioId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? {
                              ...prev,
                              tabelaHorarioId: e.target.value,
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {tabelasAtivas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            <FormField
              id="pessoas-horario-vigencia-inicio"
              label="Vigência — início"
              required
              help="A partir desta data a tabela passa a valer para o colaborador."
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
                        ? {
                            ...prev,
                            vigenciaInicio: e.target.value,
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id="pessoas-horario-vigencia-fim"
              label="Vigência — fim (opcional)"
              help="Deixe em branco para vigência em aberto. Se informado, deve ser posterior ao início."
              {...(formulario.erros.vigenciaFim
                ? { error: formulario.erros.vigenciaFim }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.vigenciaFim}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, vigenciaFim: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.erros.geral ? (
              <p className="pessoas-horario-screen__form-erro" role="alert">
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
                {formulario.salvando ? "Criando…" : "Criar vínculo"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
