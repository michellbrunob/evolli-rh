import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  type AdmitirColaboradorDto,
  type ColaboradorApi,
  type RetificarColaboradorDto,
  type TipoVinculo,
  type VinculoApi,
  admitirColaborador,
  listarColaboradores,
  listarVinculosDoColaborador,
  retificarColaborador,
} from "../../api/colaboradoresClient";
import {
  type AreaApi,
  type CentroCustoApi,
  type DepartamentoApi,
  type EmpresaApi,
  type EquipeApi,
  type UnidadeOrganizacionalApi,
  listarAreas,
  listarCentrosCusto,
  listarDepartamentos,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
} from "../../api/organizacaoClient";
import { type CargoApi, listarCargos } from "../../api/cargoClient";
import "./ColaboradoresScreen.css";

export const COLABORADORES_TITULO_ID = "colaboradores-titulo";

const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

type FiltroSituacao = "todos" | "ativo" | "inativo";
type FiltroSituacaoVinculo = "todos" | "previsto" | "ativo" | "encerrado";

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const VARIANTE_SITUACAO_COLABORADOR: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const VARIANTE_SITUACAO_VINCULO: Record<string, StatusVariant> = {
  previsto: "info",
  ativo: "success",
  encerrado: "neutral",
};

const ROTULO_SITUACAO_VINCULO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

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

interface FormularioErros {
  nome?: string;
  empresaId?: string;
  matricula?: string;
  tipo?: string;
  dataAdmissao?: string;
  destino?: string;
  geral?: string;
}

interface FormularioState {
  nome: string;
  empresas: EmpresaApi[];
  empresaId: string;
  matricula: string;
  tipo: TipoVinculo | "";
  dataAdmissao: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
  departamentos: DepartamentoApi[];
  unidades: UnidadeOrganizacionalApi[];
  equipes: EquipeApi[];
  cargos: CargoApi[];
  centrosCusto: CentroCustoApi[];
  areasDoDepartamento: AreaApi[];
  carregandoAreas: boolean;
  carregandoOpcoes: boolean;
  erros: FormularioErros;
  salvando: boolean;
}

interface DetalheState {
  colaborador: ColaboradorApi;
  statusVinculos: "carregando" | "erro" | "dados";
  vinculos: VinculoApi[];
  nomeEdicao: string;
  salvandoNome: boolean;
  erroNome: string | null;
}

export function ColaboradoresScreen() {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("todos");
  const [filtroSituacaoVinculo, setFiltroSituacaoVinculo] =
    useState<FiltroSituacaoVinculo>("todos");
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheState | null>(null);
  // T142 — confirmação de escrita. Antes, admitir fechava o formulário em
  // silêncio: a pessoa ficava olhando a lista sem saber se salvou.
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const formTituloId = useId();
  const detalheTituloId = useId();
  // T142 (piloto) — o painel de trabalho precisa ser encontrável: quando abre,
  // entra no campo de visão e recebe o foco; quando fecha, devolve o foco a
  // quem o abriu. Sem isto o botão "Novo colaborador" parecia não fazer nada,
  // porque o formulário nascia centenas de pixels abaixo da dobra.
  const painelId = useId();
  const tituloPainelRef = useRef<HTMLHeadingElement | null>(null);
  const gatilhoRef = useRef<HTMLElement | null>(null);
  // Identidade do painel aberto: muda quando ele abre, fecha ou troca de tipo
  // (formulário ↔ detalhe). É o gatilho de "traga para a vista e foque".
  const painelAtual =
    formulario !== null
      ? "formulario"
      : detalhe !== null
        ? `detalhe:${detalhe.colaborador.id}`
        : null;
  const painelAberto = painelAtual !== null;

  useEffect(() => {
    if (painelAtual === null) return;
    const titulo = tituloPainelRef.current;
    if (!titulo) return;
    titulo.focus({ preventScroll: true });
    // `scrollIntoView` não existe no jsdom; a chamada opcional mantém o
    // comportamento no navegador sem quebrar o ambiente de teste.
    titulo.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [painelAtual]);

  useEffect(() => {
    if (!painelAberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      // Escape só fecha o que é descartável sem perda silenciosa: um envio em
      // andamento continua até terminar.
      if (formulario?.salvando) return;
      evento.preventDefault();
      if (formulario) fecharFormulario();
      else fecharDetalhe();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  });

  /** Devolve o foco ao botão que abriu o painel. */
  function devolverFoco() {
    const alvo = gatilhoRef.current;
    if (alvo && document.contains(alvo)) alvo.focus();
    gatilhoRef.current = null;
  }

  const carregarDados = useCallback(
    async (
      situacao: FiltroSituacao,
      situacaoVinculo: FiltroSituacaoVinculo,
    ) => {
      setStatusCarregamento("carregando");
      try {
        const query: {
          situacao?: "ativo" | "inativo";
          situacaoVinculo?: "previsto" | "ativo" | "encerrado";
        } = {};
        if (situacao !== "todos") query.situacao = situacao;
        if (situacaoVinculo !== "todos")
          query.situacaoVinculo = situacaoVinculo;
        const resp = await listarColaboradores(query);
        setColaboradores(resp.itens);
        setStatusCarregamento("dados");
      } catch {
        setStatusCarregamento("erro");
      }
    },
    [],
  );

  useEffect(() => {
    void carregarDados(filtroSituacao, filtroSituacaoVinculo);
  }, [filtroSituacao, filtroSituacaoVinculo, carregarDados]);

  async function abrirFormulario() {
    setMensagemSucesso(null);
    setDetalhe(null);
    setFormulario({
      nome: "",
      empresas: [],
      empresaId: "",
      matricula: "",
      tipo: "",
      dataAdmissao: "",
      tipoDestino: "",
      destinoId: "",
      departamentoIdArea: "",
      departamentos: [],
      unidades: [],
      equipes: [],
      cargos: [],
      centrosCusto: [],
      areasDoDepartamento: [],
      carregandoAreas: false,
      carregandoOpcoes: true,
      erros: {},
      salvando: false,
    });

    try {
      const [
        empresasResp,
        departamentosResp,
        unidadesResp,
        equipesResp,
        cargosResp,
        centrosResp,
      ] = await Promise.all([
        listarEmpresasMulti(),
        listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
        listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
        listarEquipes({ status: "ativo", tamanhoPagina: 100 }),
        listarCargos({ status: "ativo", tamanhoPagina: 100 }),
        listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
      ]);
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              empresas: empresasResp.itens,
              empresaId:
                empresasResp.itens.length === 1
                  ? (empresasResp.itens[0]?.id ?? "")
                  : "",
              departamentos: departamentosResp.itens,
              unidades: unidadesResp.itens,
              equipes: equipesResp.itens,
              cargos: cargosResp.itens,
              centrosCusto: centrosResp.itens,
              carregandoOpcoes: false,
            }
          : prev,
      );
    } catch {
      setFormulario((prev) =>
        prev
          ? {
              ...prev,
              carregandoOpcoes: false,
              erros: {
                geral:
                  "Não foi possível carregar as opções de lotação. Feche e tente novamente.",
              },
            }
          : prev,
      );
    }
  }

  function fecharFormulario() {
    setFormulario(null);
    devolverFoco();
  }

  async function selecionarDepartamentoArea(departamentoId: string) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            departamentoIdArea: departamentoId,
            destinoId: "",
            areasDoDepartamento: [],
            carregandoAreas: departamentoId !== "",
            erros: {},
          }
        : prev,
    );
    if (!departamentoId) return;
    try {
      const resp = await listarAreas({
        departamentoId,
        status: "ativo",
        tamanhoPagina: 100,
      });
      setFormulario((prev) =>
        prev
          ? { ...prev, areasDoDepartamento: resp.itens, carregandoAreas: false }
          : prev,
      );
    } catch {
      setFormulario((prev) =>
        prev ? { ...prev, carregandoAreas: false } : prev,
      );
    }
  }

  function selecionarTipoDestino(tipoDestino: TipoDestino) {
    setFormulario((prev) =>
      prev
        ? {
            ...prev,
            tipoDestino,
            destinoId: "",
            departamentoIdArea: "",
            areasDoDepartamento: [],
            erros: {},
          }
        : prev,
    );
  }

  function abrirDetalhe(colaborador: ColaboradorApi) {
    setMensagemSucesso(null);
    setFormulario(null);
    setDetalhe({
      colaborador,
      statusVinculos: "carregando",
      vinculos: [],
      nomeEdicao: colaborador.nome,
      salvandoNome: false,
      erroNome: null,
    });
    void carregarVinculos(colaborador.id);
  }

  async function carregarVinculos(colaboradorId: string) {
    setDetalhe((prev) =>
      prev ? { ...prev, statusVinculos: "carregando" } : prev,
    );
    try {
      const vinculos = await listarVinculosDoColaborador(colaboradorId);
      setDetalhe((prev) =>
        prev ? { ...prev, vinculos, statusVinculos: "dados" } : prev,
      );
    } catch {
      setDetalhe((prev) => (prev ? { ...prev, statusVinculos: "erro" } : prev));
    }
  }

  function fecharDetalhe() {
    setDetalhe(null);
    devolverFoco();
  }

  async function handleSalvarNome() {
    if (!detalhe) return;
    const nome = detalhe.nomeEdicao.trim();
    if (!nome) {
      setDetalhe((prev) =>
        prev ? { ...prev, erroNome: "Nome é obrigatório." } : prev,
      );
      return;
    }
    if (nome.length > 160) {
      setDetalhe((prev) =>
        prev
          ? { ...prev, erroNome: "Nome deve ter no máximo 160 caracteres." }
          : prev,
      );
      return;
    }

    setDetalhe((prev) =>
      prev ? { ...prev, salvandoNome: true, erroNome: null } : prev,
    );
    try {
      const dto: RetificarColaboradorDto = { nome };
      const atualizado = await retificarColaborador(
        detalhe.colaborador.id,
        dto,
      );
      setDetalhe((prev) =>
        prev
          ? {
              ...prev,
              colaborador: atualizado,
              nomeEdicao: atualizado.nome,
              salvandoNome: false,
            }
          : prev,
      );
      setColaboradores((prev) =>
        prev.map((c) => (c.id === atualizado.id ? atualizado : c)),
      );
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o nome. Tente novamente.";
      setDetalhe((prev) =>
        prev ? { ...prev, salvandoNome: false, erroNome: mensagem } : prev,
      );
    }
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    const nome = formulario.nome.trim();
    if (!nome) {
      erros.nome = "Nome é obrigatório.";
    } else if (nome.length < 2 || nome.length > 160) {
      erros.nome = "Nome deve ter entre 2 e 160 caracteres.";
    }
    if (formulario.empresas.length > 1 && !formulario.empresaId) {
      erros.empresaId = "Selecione a empresa.";
    }
    const matricula = formulario.matricula.trim().toUpperCase();
    if (!MATRICULA_PATTERN.test(matricula)) {
      erros.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    if (!formulario.tipo) {
      erros.tipo = "Selecione o tipo de vínculo.";
    }
    if (!formulario.dataAdmissao) {
      erros.dataAdmissao = "Informe a data de admissão.";
    }
    if (!formulario.tipoDestino || !formulario.destinoId) {
      erros.destino = "Selecione a lotação inicial do colaborador.";
    } else if (
      formulario.tipoDestino === "area" &&
      !formulario.departamentoIdArea
    ) {
      erros.destino = "Selecione o departamento da área.";
    }

    if (
      erros.nome ??
      erros.empresaId ??
      erros.matricula ??
      erros.tipo ??
      erros.dataAdmissao ??
      erros.destino
    ) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      const empresaId =
        formulario.empresaId || (formulario.empresas[0]?.id ?? "");

      const dto: AdmitirColaboradorDto = {
        nome,
        empresaId,
        matricula,
        tipo: formulario.tipo as TipoVinculo,
        dataAdmissao: formulario.dataAdmissao,
        motivoCodigo: "admissao_inicial",
        ...(formulario.tipoDestino === "unidade"
          ? { unidadeOrganizacionalId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "departamento"
          ? { departamentoId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "area"
          ? {
              areaId: formulario.destinoId,
              departamentoId: formulario.departamentoIdArea,
            }
          : {}),
        ...(formulario.tipoDestino === "equipe"
          ? { equipeId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "cargo"
          ? { cargoId: formulario.destinoId }
          : {}),
        ...(formulario.tipoDestino === "centroCusto"
          ? { centroCustoId: formulario.destinoId }
          : {}),
      };
      await admitirColaborador(dto);
      const nomeAdmitido = formulario.nome.trim();
      fecharFormulario();
      setMensagemSucesso(
        `Colaborador ${nomeAdmitido} admitido. Ele já aparece na lista abaixo.`,
      );
      await carregarDados(filtroSituacao, filtroSituacaoVinculo);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível admitir o colaborador. Tente novamente.";
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

  const opcoesDestinoAtuais: { id: string; rotulo: string }[] =
    formulario?.tipoDestino === "unidade"
      ? (formulario.unidades.map((u) => ({
          id: u.id,
          rotulo: `${u.codigo} — ${u.nome}`,
        })) ?? [])
      : formulario?.tipoDestino === "departamento"
        ? formulario.departamentos.map((d) => ({
            id: d.id,
            rotulo: `${d.codigo} — ${d.nome}`,
          }))
        : formulario?.tipoDestino === "area"
          ? formulario.areasDoDepartamento.map((a) => ({
              id: a.id,
              rotulo: `${a.codigo} — ${a.nome}`,
            }))
          : formulario?.tipoDestino === "equipe"
            ? (formulario.equipes.map((e) => ({
                id: e.id,
                rotulo: `${e.codigo} — ${e.nome}`,
              })) ?? [])
            : formulario?.tipoDestino === "cargo"
              ? (formulario.cargos.map((c) => ({
                  id: c.id,
                  rotulo: `${c.codigo} — ${c.nome}`,
                })) ?? [])
              : formulario?.tipoDestino === "centroCusto"
                ? (formulario.centrosCusto.map((c) => ({
                    id: c.id,
                    rotulo: `${c.codigo} — ${c.nome}`,
                  })) ?? [])
                : [];

  const rotuloDestinoAtual =
    OPCOES_TIPO_DESTINO.find((o) => o.valor === formulario?.tipoDestino)
      ?.rotulo ?? "Registro";

  const colunasColaboradores: DataTableColumn<ColaboradorApi>[] = [
    { key: "nome", header: "Nome", cell: (c) => c.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (c) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_COLABORADOR[c.situacao] ?? "neutral"}
        >
          {c.situacao === "ativo" ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (c) => (
        <Button
          variant="secondary"
          onClick={(evento) => {
            gatilhoRef.current = evento.currentTarget;
            abrirDetalhe(c);
          }}
          aria-expanded={detalhe?.colaborador.id === c.id}
          aria-controls={painelId}
        >
          Ver detalhes
          <span className="sr-only"> — {c.nome}</span>
        </Button>
      ),
    },
  ];

  const colunasVinculos: DataTableColumn<VinculoApi>[] = [
    { key: "matricula", header: "Matrícula", cell: (v) => v.matricula },
    {
      key: "tipo",
      header: "Tipo",
      cell: (v) => ROTULO_TIPO_VINCULO[v.tipo] ?? v.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (v) => (
        <StatusBadge
          variant={VARIANTE_SITUACAO_VINCULO[v.situacao] ?? "neutral"}
        >
          {ROTULO_SITUACAO_VINCULO[v.situacao] ?? v.situacao}
        </StatusBadge>
      ),
    },
    { key: "admissao", header: "Admissão", cell: (v) => v.dataAdmissao },
    {
      key: "desligamento",
      header: "Desligamento",
      cell: (v) => v.dataDesligamento ?? "—",
    },
  ];

  return (
    <div className="colaboradores-screen">
      <PageHeader
        headingLevel={1}
        titleId={COLABORADORES_TITULO_ID}
        title="Colaboradores"
        description="Administre a admissão e o cadastro de colaboradores da sua empresa. Situação, vínculo e lotação seguem sempre a fonte de verdade do backend."
        actions={
          <Button
            onClick={(evento) => {
              gatilhoRef.current = evento.currentTarget;
              void abrirFormulario();
            }}
            aria-expanded={formulario !== null}
            aria-controls={painelId}
          >
            Novo colaborador
          </Button>
        }
      />

      {mensagemSucesso ? (
        <Surface
          as="section"
          padding="md"
          className="colaboradores-screen__sucesso"
        >
          {/* `role="status"` anuncia sem roubar o foco de quem está digitando. */}
          <p className="colaboradores-screen__sucesso-texto" role="status">
            {mensagemSucesso}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMensagemSucesso(null)}
          >
            Dispensar
          </Button>
        </Surface>
      ) : null}

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-rh-titulo"
      >
        <StatusBadge variant="info">RH e DP</StatusBadge>
        <p
          id="colaboradores-aviso-rh-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Este cadastro é operado exclusivamente pelo RH e DP da própria
          empresa. Admissão, consulta e alteração de nome aqui geram trilha de
          auditoria automática.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="colaboradores-screen__aviso"
        aria-labelledby="colaboradores-aviso-indisponivel-titulo"
      >
        <StatusBadge variant="warning">Ainda indisponível</StatusBadge>
        <p
          id="colaboradores-aviso-indisponivel-titulo"
          className="colaboradores-screen__aviso-texto"
        >
          Transferência, mudança de cargo, desligamento, reclassificação de
          vínculo, Folha, documentos, benefícios, dependentes, afastamentos e
          Banco de Horas ainda não têm operação nesta tela.
        </p>
      </Surface>

      {statusCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="colaboradores-screen__erro"
          aria-labelledby="colaboradores-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="colaboradores-erro-titulo"
            className="colaboradores-screen__section-title"
          >
            Não foi possível carregar os colaboradores
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              void carregarDados(filtroSituacao, filtroSituacaoVinculo)
            }
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section
          className="colaboradores-screen__lista"
          aria-labelledby="colaboradores-lista-titulo"
        >
          {/* O H1 da página já diz "Colaboradores"; repetir aqui só somava
              ruído. A seção passa a nomear o que a lista realmente é. */}
          <h2
            id="colaboradores-lista-titulo"
            className="colaboradores-screen__section-title"
          >
            Colaboradores desta empresa
          </h2>

          <div className="colaboradores-screen__filtros">
            <FormField id="colaboradores-filtro-situacao" label="Situação">
              {(control) => (
                <select
                  value={filtroSituacao}
                  onChange={(e) =>
                    setFiltroSituacao(e.target.value as FiltroSituacao)
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas as situações</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              )}
            </FormField>

            <FormField
              id="colaboradores-filtro-situacao-vinculo"
              label="Situação do vínculo"
            >
              {(control) => (
                <select
                  value={filtroSituacaoVinculo}
                  onChange={(e) =>
                    setFiltroSituacaoVinculo(
                      e.target.value as FiltroSituacaoVinculo,
                    )
                  }
                  disabled={statusCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas</option>
                  <option value="previsto">Previsto</option>
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              )}
            </FormField>
          </div>

          {statusCarregamento === "carregando" ? (
            <p className="colaboradores-screen__carregando" role="status">
              Carregando colaboradores…
            </p>
          ) : colaboradores.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhum colaborador cadastrado"
              description="Registre a admissão do primeiro colaborador desta empresa."
              action={
                <Button
                  onClick={(evento) => {
                    gatilhoRef.current = evento.currentTarget;
                    void abrirFormulario();
                  }}
                  aria-expanded={formulario !== null}
                  aria-controls={painelId}
                >
                  Novo colaborador
                </Button>
              }
            />
          ) : (
            <DataTable
              caption="Colaboradores desta empresa"
              captionVisible={false}
              columns={colunasColaboradores}
              rows={colaboradores}
              rowKey={(c) => c.id}
            />
          )}
        </section>
      )}

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="colaboradores-screen__painel"
          id={painelId}
          aria-labelledby={detalheTituloId}
        >
          <div className="colaboradores-screen__painel-cabecalho">
            <h2
              id={detalheTituloId}
              ref={tituloPainelRef}
              tabIndex={-1}
              className="colaboradores-screen__painel-titulo"
            >
              {detalhe.colaborador.nome}
            </h2>
            <Button type="button" variant="secondary" onClick={fecharDetalhe}>
              Fechar
            </Button>
          </div>
          <p>
            <StatusBadge
              variant={
                VARIANTE_SITUACAO_COLABORADOR[detalhe.colaborador.situacao] ??
                "neutral"
              }
            >
              {detalhe.colaborador.situacao === "ativo" ? "Ativo" : "Inativo"}
            </StatusBadge>
          </p>
          <p className="colaboradores-screen__aviso-texto">
            Matrícula, tipo de vínculo e data de admissão são imutáveis nesta
            tela. Apenas o nome pode ser corrigido abaixo.
          </p>

          <div className="colaboradores-screen__edicao-nome">
            <FormField
              id="colaboradores-detalhe-nome"
              label="Nome"
              {...(detalhe.erroNome ? { error: detalhe.erroNome } : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={detalhe.nomeEdicao}
                  onChange={(e) =>
                    setDetalhe((prev) =>
                      prev
                        ? {
                            ...prev,
                            nomeEdicao: e.target.value,
                            erroNome: null,
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
              onClick={() => void handleSalvarNome()}
              disabled={
                detalhe.salvandoNome ||
                detalhe.nomeEdicao.trim() === detalhe.colaborador.nome
              }
            >
              {detalhe.salvandoNome ? "Salvando…" : "Salvar nome"}
            </Button>
          </div>

          <div className="colaboradores-screen__vinculos">
            <h3 className="colaboradores-screen__section-title">Vínculos</h3>
            {detalhe.statusVinculos === "carregando" ? (
              <p className="colaboradores-screen__carregando" role="status">
                Carregando vínculos…
              </p>
            ) : detalhe.statusVinculos === "erro" ? (
              <p className="colaboradores-screen__form-erro" role="alert">
                Não foi possível carregar os vínculos deste colaborador.{" "}
                <Button
                  variant="secondary"
                  onClick={() => void carregarVinculos(detalhe.colaborador.id)}
                >
                  Tentar novamente
                </Button>
              </p>
            ) : detalhe.vinculos.length === 0 ? (
              <p>Nenhum vínculo encontrado.</p>
            ) : (
              <DataTable
                caption={`Vínculos — ${detalhe.colaborador.nome}`}
                columns={colunasVinculos}
                rows={detalhe.vinculos}
                rowKey={(v) => v.id}
              />
            )}
          </div>

          {/* A saída do painel é única e fica no cabeçalho, junto do título —
              o mesmo lugar nos dois painéis desta tela. Duas saídas com o
              mesmo rótulo em pontos diferentes era justamente parte da
              desorganização relatada. */}
        </Surface>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="colaboradores-screen__painel"
          id={painelId}
          aria-labelledby={formTituloId}
        >
          <div className="colaboradores-screen__painel-cabecalho">
            <h2
              id={formTituloId}
              ref={tituloPainelRef}
              tabIndex={-1}
              className="colaboradores-screen__painel-titulo"
            >
              Novo colaborador
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={fecharFormulario}
              disabled={formulario.salvando}
            >
              Fechar
            </Button>
          </div>
          <p className="colaboradores-screen__painel-descricao">
            A admissão cria o colaborador e o primeiro vínculo em conjunto.
            Matrícula, tipo de vínculo, data de admissão e lotação inicial são
            imutáveis nesta tela — corrija apenas o nome depois, se necessário.
          </p>

          <form
            className="colaboradores-screen__form"
            aria-label="Formulário de novo colaborador"
            onSubmit={(e) => void handleSubmit(e)}
          >
            <FormField
              id="colaboradores-nome"
              label="Nome completo"
              required
              help="2 a 160 caracteres."
              {...(formulario.erros.nome
                ? { error: formulario.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formulario.nome}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formulario.empresas.length > 1 ? (
              <FormField
                id="colaboradores-empresa"
                label="Empresa"
                required
                {...(formulario.erros.empresaId
                  ? { error: formulario.erros.empresaId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formulario.empresaId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? { ...prev, empresaId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {formulario.empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            <FormField
              id="colaboradores-matricula"
              label="Matrícula"
              required
              help="Letras maiúsculas, números, - e _ (2 a 32 caracteres)."
              {...(formulario.erros.matricula
                ? { error: formulario.erros.matricula }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={32}
                  value={formulario.matricula}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            matricula: e.target.value.toUpperCase(),
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
              id="colaboradores-tipo-vinculo"
              label="Tipo de vínculo"
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
                            tipo: e.target.value as TipoVinculo,
                            erros: {},
                          }
                        : prev,
                    )
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {(Object.keys(ROTULO_TIPO_VINCULO) as TipoVinculo[]).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {ROTULO_TIPO_VINCULO[tipo]}
                      </option>
                    ),
                  )}
                </select>
              )}
            </FormField>

            <FormField
              id="colaboradores-data-admissao"
              label="Data de admissão"
              required
              {...(formulario.erros.dataAdmissao
                ? { error: formulario.erros.dataAdmissao }
                : {})}
            >
              {(control) => (
                <input
                  type="date"
                  value={formulario.dataAdmissao}
                  onChange={(e) =>
                    setFormulario((prev) =>
                      prev
                        ? {
                            ...prev,
                            dataAdmissao: e.target.value,
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
              id="colaboradores-tipo-destino"
              label="Tipo de lotação inicial"
              required
              help="Ao menos uma referência organizacional é exigida para efetivar a admissão."
              {...(formulario.erros.destino
                ? { error: formulario.erros.destino }
                : {})}
            >
              {(control) => (
                <select
                  value={formulario.tipoDestino}
                  onChange={(e) =>
                    selecionarTipoDestino(e.target.value as TipoDestino)
                  }
                  disabled={formulario.carregandoOpcoes}
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {OPCOES_TIPO_DESTINO.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {formulario.tipoDestino === "area" ? (
              <FormField
                id="colaboradores-departamento-area"
                label="Departamento"
                required
              >
                {(control) => (
                  <select
                    value={formulario.departamentoIdArea}
                    onChange={(e) =>
                      void selecionarDepartamentoArea(e.target.value)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {formulario.departamentos.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.codigo} — {dep.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formulario.tipoDestino ? (
              <FormField
                id="colaboradores-destino"
                label={rotuloDestinoAtual}
                required
              >
                {(control) => (
                  <select
                    value={formulario.destinoId}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? { ...prev, destinoId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    disabled={
                      formulario.tipoDestino === "area" &&
                      (!formulario.departamentoIdArea ||
                        formulario.carregandoAreas)
                    }
                    {...control}
                  >
                    <option value="">Selecione…</option>
                    {opcoesDestinoAtuais.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formulario.erros.geral ? (
              <p className="colaboradores-screen__form-erro" role="alert">
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
                disabled={formulario.salvando || formulario.carregandoOpcoes}
              >
                {formulario.salvando ? "Admitindo…" : "Admitir colaborador"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
