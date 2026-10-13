import { useCallback, useEffect, useId, useState } from "react";
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
  type AreaApi,
  type AtualizarAreaDto,
  type AtualizarDepartamentoDto,
  type AtualizarEquipeDto,
  type AtualizarUnidadeDto,
  type CriarAreaDto,
  type CriarDepartamentoDto,
  type CriarEquipeDto,
  type CriarUnidadeDto,
  type DepartamentoApi,
  type EquipeApi,
  type EmpresaApi,
  type ListarAreasQuery,
  type ListarDepartamentosQuery,
  type ListarEquipesQuery,
  type ListarUnidadesQuery,
  type UnidadeOrganizacionalApi,
  atualizarArea,
  atualizarDepartamento,
  atualizarEquipe,
  atualizarUnidade,
  criarArea,
  criarDepartamento,
  criarEquipe,
  criarUnidade,
  listarAreas,
  listarDepartamentos,
  listarDepartamentosParaArea,
  listarDepartamentosParaEquipe,
  listarEmpresas,
  listarEmpresasMulti,
  listarEquipes,
  listarUnidades,
  listarUnidadesParaEquipe,
  inativarArea,
  inativarDepartamento,
  inativarEquipe,
  inativarUnidade,
  reativarArea,
  reativarDepartamento,
  reativarEquipe,
  reativarUnidade,
} from "../../api/organizacaoClient";
import { AcaoSituacao } from "./AcaoSituacao";
import "./EstruturaOrganizacionalScreen.css";

export const ESTRUTURA_ORGANIZACIONAL_TITULO_ID =
  "estrutura-organizacional-titulo";

const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;

const VARIANTE_STATUS: Record<string, StatusVariant> = {
  ativo: "success",
  inativo: "neutral",
};

const ROTULO_STATUS: Record<string, string> = {
  ativo: "Ativa",
  inativo: "Inativa",
};

type StatusFiltro = "todos" | "ativo" | "inativo";
type AbaAtiva = "unidades" | "departamentos" | "areas" | "equipes";

interface FormularioErros {
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioState {
  modo: "criar" | "editar";
  unidadeId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  erros: FormularioErros;
  salvando: boolean;
}

interface FormularioDepErros {
  empresaId?: string;
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioDepState {
  modo: "criar" | "editar";
  depId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  empresaId: string;
  erros: FormularioDepErros;
  salvando: boolean;
}

interface FormularioAreaErros {
  departamentoId?: string;
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioAreaState {
  modo: "criar" | "editar";
  areaId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  departamentoId: string;
  erros: FormularioAreaErros;
  salvando: boolean;
}

interface FormularioEquipeErros {
  departamentoId?: string;
  codigo?: string;
  nome?: string;
  geral?: string;
}

interface FormularioEquipeState {
  modo: "criar" | "editar";
  equipeId?: string;
  codigoAtual?: string;
  codigo: string;
  nome: string;
  departamentoId: string;
  unidadeOrganizacionalId: string;
  erros: FormularioEquipeErros;
  salvando: boolean;
}

export function EstruturaOrganizacionalScreen() {
  const [statusCarregamento, setStatusCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [unidades, setUnidades] = useState<UnidadeOrganizacionalApi[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaApi | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusFiltro>("todos");
  const [aviso, setAviso] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioState | null>(null);
  const formTituloId = useId();

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("unidades");

  const [statusDepCarregamento, setStatusDepCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [departamentos, setDepartamentos] = useState<DepartamentoApi[]>([]);
  const [empresasDep, setEmpresasDep] = useState<EmpresaApi[]>([]);
  const [filtroDepStatus, setFiltroDepStatus] = useState<StatusFiltro>("todos");
  const [formularioDep, setFormularioDep] = useState<FormularioDepState | null>(
    null,
  );
  const formDepTituloId = useId();

  const [statusAreaCarregamento, setStatusAreaCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [areas, setAreas] = useState<AreaApi[]>([]);
  const [departamentosArea, setDepartamentosArea] = useState<DepartamentoApi[]>(
    [],
  );
  const [filtroAreaStatus, setFiltroAreaStatus] =
    useState<StatusFiltro>("todos");
  const [formularioArea, setFormularioArea] =
    useState<FormularioAreaState | null>(null);
  const formAreaTituloId = useId();

  const [statusEquipeCarregamento, setStatusEquipeCarregamento] = useState<
    "carregando" | "erro" | "dados"
  >("carregando");
  const [equipes, setEquipes] = useState<EquipeApi[]>([]);
  const [departamentosEquipe, setDepartamentosEquipe] = useState<
    DepartamentoApi[]
  >([]);
  const [unidadesEquipe, setUnidadesEquipe] = useState<
    UnidadeOrganizacionalApi[]
  >([]);
  const [filtroEquipeStatus, setFiltroEquipeStatus] =
    useState<StatusFiltro>("todos");
  const [formularioEquipe, setFormularioEquipe] =
    useState<FormularioEquipeState | null>(null);
  const formEquipeTituloId = useId();

  const carregarDados = useCallback(async (status: StatusFiltro) => {
    setStatusCarregamento("carregando");
    try {
      const query: ListarUnidadesQuery = {};
      if (status !== "todos") query.status = status;
      const [empresaResp, unidadesResp] = await Promise.all([
        listarEmpresas(),
        listarUnidades(query),
      ]);
      setEmpresa(empresaResp.itens[0] ?? null);
      setUnidades(unidadesResp.itens);
      setStatusCarregamento("dados");
    } catch {
      setStatusCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    void carregarDados(filtroStatus);
  }, [filtroStatus, carregarDados]);

  const carregarDepartamentos = useCallback(async (status: StatusFiltro) => {
    setStatusDepCarregamento("carregando");
    try {
      const query: ListarDepartamentosQuery = {};
      if (status !== "todos") query.status = status;
      const [empresasResp, depsResp] = await Promise.all([
        listarEmpresasMulti(),
        listarDepartamentos(query),
      ]);
      setEmpresasDep(empresasResp.itens);
      setDepartamentos(depsResp.itens);
      setStatusDepCarregamento("dados");
    } catch {
      setStatusDepCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "departamentos") {
      void carregarDepartamentos(filtroDepStatus);
    }
  }, [abaAtiva, filtroDepStatus, carregarDepartamentos]);

  const carregarAreas = useCallback(async (status: StatusFiltro) => {
    setStatusAreaCarregamento("carregando");
    try {
      const query: ListarAreasQuery = {};
      if (status !== "todos") query.status = status;
      const [depsResp, areasResp] = await Promise.all([
        listarDepartamentosParaArea(),
        listarAreas(query),
      ]);
      setDepartamentosArea(depsResp.itens);
      setAreas(areasResp.itens);
      setStatusAreaCarregamento("dados");
    } catch {
      setStatusAreaCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "areas") {
      void carregarAreas(filtroAreaStatus);
    }
  }, [abaAtiva, filtroAreaStatus, carregarAreas]);

  const carregarEquipes = useCallback(async (status: StatusFiltro) => {
    setStatusEquipeCarregamento("carregando");
    try {
      const query: ListarEquipesQuery = {};
      if (status !== "todos") query.status = status;
      const [depsResp, unidsResp, equipesResp] = await Promise.all([
        listarDepartamentosParaEquipe(),
        listarUnidadesParaEquipe(),
        listarEquipes(query),
      ]);
      setDepartamentosEquipe(depsResp.itens);
      setUnidadesEquipe(unidsResp.itens);
      setEquipes(equipesResp.itens);
      setStatusEquipeCarregamento("dados");
    } catch {
      setStatusEquipeCarregamento("erro");
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "equipes") {
      void carregarEquipes(filtroEquipeStatus);
    }
  }, [abaAtiva, filtroEquipeStatus, carregarEquipes]);

  function abrirCriar() {
    setFormulario({
      modo: "criar",
      codigo: "",
      nome: "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditar(unidade: UnidadeOrganizacionalApi) {
    setFormulario({
      modo: "editar",
      unidadeId: unidade.id,
      codigoAtual: unidade.codigo,
      codigo: "",
      nome: unidade.nome,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormulario() {
    setFormulario(null);
  }

  function validarCodigo(codigo: string): string | undefined {
    if (!codigo.trim()) return "Código é obrigatório.";
    if (!CODIGO_PATTERN.test(codigo))
      return "Código deve conter apenas letras maiúsculas, dígitos e _ (2 a 32 caracteres).";
    return undefined;
  }

  function validarNome(nome: string): string | undefined {
    if (!nome.trim()) return "Nome é obrigatório.";
    if (nome.trim().length > 160)
      return "Nome deve ter no máximo 160 caracteres.";
    return undefined;
  }

  async function handleSubmit(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario) return;

    const erros: FormularioErros = {};
    if (formulario.modo === "criar") {
      const erroCodigo = validarCodigo(formulario.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formulario.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.codigo || erros.nome) {
      setFormulario((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formulario.modo === "criar") {
        const dto: CriarUnidadeDto = {
          codigo: formulario.codigo.trim(),
          nome: formulario.nome.trim(),
          empresaId: empresa!.id,
        };
        await criarUnidade(dto);
      } else {
        const dto: AtualizarUnidadeDto = { nome: formulario.nome.trim() };
        await atualizarUnidade(formulario.unidadeId!, dto);
      }
      setFormulario(null);
      await carregarDados(filtroStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
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

  const podeCriarDep =
    statusDepCarregamento === "dados" && empresasDep.length > 0;

  function abrirCriarDep() {
    setFormularioDep({
      modo: "criar",
      codigo: "",
      nome: "",
      empresaId: empresasDep.length === 1 ? (empresasDep[0]?.id ?? "") : "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditarDep(dep: DepartamentoApi) {
    setFormularioDep({
      modo: "editar",
      depId: dep.id,
      codigoAtual: dep.codigo,
      codigo: "",
      nome: dep.nome,
      empresaId: dep.empresaId,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormularioDep() {
    setFormularioDep(null);
  }

  async function handleSubmitDep(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formularioDep) return;

    const erros: FormularioDepErros = {};
    if (formularioDep.modo === "criar") {
      if (empresasDep.length > 1 && !formularioDep.empresaId) {
        erros.empresaId = "Selecione a empresa.";
      }
      const erroCodigo = validarCodigo(formularioDep.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formularioDep.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.empresaId ?? erros.codigo ?? erros.nome) {
      setFormularioDep((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormularioDep((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formularioDep.modo === "criar") {
        const dto: CriarDepartamentoDto = {
          codigo: formularioDep.codigo.trim(),
          nome: formularioDep.nome.trim(),
          empresaId: formularioDep.empresaId,
        };
        await criarDepartamento(dto);
      } else {
        const dto: AtualizarDepartamentoDto = {
          nome: formularioDep.nome.trim(),
        };
        await atualizarDepartamento(formularioDep.depId!, dto);
      }
      setFormularioDep(null);
      await carregarDepartamentos(filtroDepStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormularioDep((prev) =>
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

  const departamentosAtivosArea = departamentosArea.filter(
    (d) => d.status === "ativo",
  );
  const podeCriarArea =
    statusAreaCarregamento === "dados" && departamentosAtivosArea.length > 0;

  function abrirCriarArea() {
    setFormularioArea({
      modo: "criar",
      codigo: "",
      nome: "",
      departamentoId:
        departamentosAtivosArea.length === 1
          ? (departamentosAtivosArea[0]?.id ?? "")
          : "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditarArea(area: AreaApi) {
    setFormularioArea({
      modo: "editar",
      areaId: area.id,
      codigoAtual: area.codigo,
      codigo: "",
      nome: area.nome,
      departamentoId: area.departamentoId,
      erros: {},
      salvando: false,
    });
  }

  function fecharFormularioArea() {
    setFormularioArea(null);
  }

  const departamentosAtivosEquipe = departamentosEquipe.filter(
    (d) => d.status === "ativo",
  );
  const unidadesAtivasEquipe = unidadesEquipe.filter(
    (u) => u.status === "ativo",
  );
  const podeCriarEquipe =
    statusEquipeCarregamento === "dados" &&
    departamentosAtivosEquipe.length > 0;

  function abrirCriarEquipe() {
    setFormularioEquipe({
      modo: "criar",
      codigo: "",
      nome: "",
      departamentoId:
        departamentosAtivosEquipe.length === 1
          ? (departamentosAtivosEquipe[0]?.id ?? "")
          : "",
      unidadeOrganizacionalId: "",
      erros: {},
      salvando: false,
    });
  }

  function abrirEditarEquipe(equipe: EquipeApi) {
    setFormularioEquipe({
      modo: "editar",
      equipeId: equipe.id,
      codigoAtual: equipe.codigo,
      codigo: "",
      nome: equipe.nome,
      departamentoId: equipe.departamentoId,
      unidadeOrganizacionalId: equipe.unidadeOrganizacionalId ?? "",
      erros: {},
      salvando: false,
    });
  }

  function fecharFormularioEquipe() {
    setFormularioEquipe(null);
  }

  async function handleSubmitEquipe(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formularioEquipe) return;

    const erros: FormularioEquipeErros = {};
    if (formularioEquipe.modo === "criar") {
      if (
        departamentosAtivosEquipe.length > 1 &&
        !formularioEquipe.departamentoId
      ) {
        erros.departamentoId = "Selecione o departamento.";
      }
      const erroCodigo = validarCodigo(formularioEquipe.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formularioEquipe.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.departamentoId ?? erros.codigo ?? erros.nome) {
      setFormularioEquipe((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormularioEquipe((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formularioEquipe.modo === "criar") {
        const dto: CriarEquipeDto = {
          codigo: formularioEquipe.codigo.trim(),
          nome: formularioEquipe.nome.trim(),
          departamentoId: formularioEquipe.departamentoId,
          ...(formularioEquipe.unidadeOrganizacionalId
            ? {
                unidadeOrganizacionalId:
                  formularioEquipe.unidadeOrganizacionalId,
              }
            : {}),
        };
        await criarEquipe(dto);
      } else {
        const dto: AtualizarEquipeDto = { nome: formularioEquipe.nome.trim() };
        await atualizarEquipe(formularioEquipe.equipeId!, dto);
      }
      setFormularioEquipe(null);
      await carregarEquipes(filtroEquipeStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormularioEquipe((prev) =>
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

  async function handleSubmitArea(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formularioArea) return;

    const erros: FormularioAreaErros = {};
    if (formularioArea.modo === "criar") {
      if (
        departamentosAtivosArea.length > 1 &&
        !formularioArea.departamentoId
      ) {
        erros.departamentoId = "Selecione o departamento.";
      }
      const erroCodigo = validarCodigo(formularioArea.codigo);
      if (erroCodigo) erros.codigo = erroCodigo;
    }
    const erroNome = validarNome(formularioArea.nome);
    if (erroNome) erros.nome = erroNome;

    if (erros.departamentoId ?? erros.codigo ?? erros.nome) {
      setFormularioArea((prev) => (prev ? { ...prev, erros } : prev));
      return;
    }

    setFormularioArea((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );

    try {
      if (formularioArea.modo === "criar") {
        const dto: CriarAreaDto = {
          codigo: formularioArea.codigo.trim(),
          nome: formularioArea.nome.trim(),
          departamentoId: formularioArea.departamentoId,
        };
        await criarArea(dto);
      } else {
        const dto: AtualizarAreaDto = { nome: formularioArea.nome.trim() };
        await atualizarArea(formularioArea.areaId!, dto);
      }
      setFormularioArea(null);
      await carregarAreas(filtroAreaStatus);
    } catch (err: unknown) {
      const mensagem =
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.";
      setFormularioArea((prev) =>
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

  const colunas: DataTableColumn<UnidadeOrganizacionalApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <div className="estrutura-organizacional-screen__acoes">
          <Button variant="secondary" onClick={() => abrirEditar(linha)}>
            Editar
          </Button>
          <AcaoSituacao
            registro={linha}
            entidade="unidade"
            inativar={inativarUnidade}
            reativar={reativarUnidade}
            onConcluido={(atualizado, mensagem) => {
              setUnidades((prev) =>
                prev.map((x) => (x.id === atualizado.id ? atualizado : x)),
              );
              setAviso(mensagem);
              if (filtroStatus !== "todos") void carregarDados(filtroStatus);
            }}
          />
        </div>
      ),
    },
  ];

  const colunasDep: DataTableColumn<DepartamentoApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <div className="estrutura-organizacional-screen__acoes">
          <Button variant="secondary" onClick={() => abrirEditarDep(linha)}>
            Editar
          </Button>
          <AcaoSituacao
            registro={linha}
            entidade="departamento"
            inativar={inativarDepartamento}
            reativar={reativarDepartamento}
            onConcluido={(atualizado, mensagem) => {
              setDepartamentos((prev) =>
                prev.map((x) => (x.id === atualizado.id ? atualizado : x)),
              );
              setAviso(mensagem);
              if (filtroDepStatus !== "todos")
                void carregarDepartamentos(filtroDepStatus);
            }}
          />
        </div>
      ),
    },
  ];

  const colunasArea: DataTableColumn<AreaApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "departamento",
      header: "Departamento",
      cell: (linha) => {
        const dep = departamentosArea.find(
          (d) => d.id === linha.departamentoId,
        );
        return dep ? <code>{dep.codigo}</code> : "—";
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <div className="estrutura-organizacional-screen__acoes">
          <Button variant="secondary" onClick={() => abrirEditarArea(linha)}>
            Editar
          </Button>
          <AcaoSituacao
            registro={linha}
            entidade="área"
            inativar={inativarArea}
            reativar={reativarArea}
            onConcluido={(atualizado, mensagem) => {
              setAreas((prev) =>
                prev.map((x) => (x.id === atualizado.id ? atualizado : x)),
              );
              setAviso(mensagem);
              if (filtroAreaStatus !== "todos")
                void carregarAreas(filtroAreaStatus);
            }}
          />
        </div>
      ),
    },
  ];

  const colunasEquipe: DataTableColumn<EquipeApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (linha) => <code>{linha.codigo}</code>,
    },
    { key: "nome", header: "Nome", cell: (linha) => linha.nome },
    {
      key: "departamento",
      header: "Departamento",
      cell: (linha) => {
        const dep = departamentosEquipe.find(
          (d) => d.id === linha.departamentoId,
        );
        return dep ? <code>{dep.codigo}</code> : "—";
      },
    },
    {
      key: "unidade",
      header: "Unidade",
      cell: (linha) => {
        if (!linha.unidadeOrganizacionalId) return "—";
        const unid = unidadesEquipe.find(
          (u) => u.id === linha.unidadeOrganizacionalId,
        );
        return unid ? <code>{unid.codigo}</code> : "—";
      },
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (linha) => (
        <StatusBadge variant={VARIANTE_STATUS[linha.status] ?? "neutral"}>
          {ROTULO_STATUS[linha.status] ?? linha.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (linha) => (
        <div className="estrutura-organizacional-screen__acoes">
          <Button variant="secondary" onClick={() => abrirEditarEquipe(linha)}>
            Editar
          </Button>
          <AcaoSituacao
            registro={linha}
            entidade="equipe"
            inativar={inativarEquipe}
            reativar={reativarEquipe}
            onConcluido={(atualizado, mensagem) => {
              setEquipes((prev) =>
                prev.map((x) => (x.id === atualizado.id ? atualizado : x)),
              );
              setAviso(mensagem);
              if (filtroEquipeStatus !== "todos")
                void carregarEquipes(filtroEquipeStatus);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="estrutura-organizacional-screen">
      <PageHeader
        headingLevel={1}
        titleId={ESTRUTURA_ORGANIZACIONAL_TITULO_ID}
        title="Estrutura organizacional"
        description="Gerencie as unidades, departamentos, áreas e equipes organizacionais da sua empresa: cadastre, consulte e edite as referências de estrutura dentro do seu escopo."
        actions={
          abaAtiva === "unidades" ? (
            <Button
              onClick={abrirCriar}
              disabled={statusCarregamento !== "dados" || !empresa}
            >
              Nova unidade
            </Button>
          ) : abaAtiva === "departamentos" ? (
            <Button onClick={abrirCriarDep} disabled={!podeCriarDep}>
              Novo departamento
            </Button>
          ) : abaAtiva === "areas" ? (
            <Button onClick={abrirCriarArea} disabled={!podeCriarArea}>
              Nova área
            </Button>
          ) : (
            <Button onClick={abrirCriarEquipe} disabled={!podeCriarEquipe}>
              Nova equipe
            </Button>
          )
        }
      />

      <Surface
        as="section"
        padding="md"
        className="estrutura-organizacional-screen__aviso"
        aria-labelledby="estrutura-organizacional-aviso-rh-titulo"
      >
        <StatusBadge variant="info">Somente RH</StatusBadge>
        <p
          id="estrutura-organizacional-aviso-rh-titulo"
          className="estrutura-organizacional-screen__aviso-texto"
        >
          Somente o RH da própria empresa administra a estrutura organizacional.
          Todas as operações são restritas ao escopo da sua empresa e unidades
          autorizadas.
        </p>
      </Surface>

      <Surface
        as="section"
        padding="md"
        className="estrutura-organizacional-screen__aviso estrutura-organizacional-screen__aviso--auditado"
        aria-labelledby="estrutura-organizacional-aviso-auditado-titulo"
      >
        <StatusBadge variant="warning">Auditado</StatusBadge>
        <p
          id="estrutura-organizacional-aviso-auditado-titulo"
          className="estrutura-organizacional-screen__aviso-texto"
        >
          Cadastros e edições de unidades, departamentos, áreas e equipes
          organizacionais geram trilha de auditoria automática. Não é possível
          excluir — apenas inativar.
        </p>
      </Surface>

      <div
        className="estrutura-organizacional-screen__abas"
        role="tablist"
        aria-label="Categorias da estrutura organizacional"
      >
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "unidades" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "unidades"}
          onClick={() => setAbaAtiva("unidades")}
        >
          Unidades
        </button>
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "departamentos" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "departamentos"}
          onClick={() => setAbaAtiva("departamentos")}
        >
          Departamentos
        </button>
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "areas" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "areas"}
          onClick={() => setAbaAtiva("areas")}
        >
          Áreas
        </button>
        <button
          role="tab"
          type="button"
          className={`estrutura-organizacional-screen__aba${abaAtiva === "equipes" ? " estrutura-organizacional-screen__aba--ativa" : ""}`}
          aria-selected={abaAtiva === "equipes"}
          onClick={() => setAbaAtiva("equipes")}
        >
          Equipes
        </button>
      </div>

      {/* Resultado da última mudança de situação. Fica fora das abas de
          propósito: a confirmação pode acontecer em qualquer uma delas, e
          repetir o bloco quatro vezes só multiplicaria o mesmo estado. */}
      {aviso ? (
        <p className="estrutura-organizacional-screen__resultado" role="status">
          {aviso}
        </p>
      ) : null}

      {abaAtiva === "unidades" ? (
        statusCarregamento === "erro" ? (
          <Surface
            as="section"
            padding="lg"
            className="estrutura-organizacional-screen__erro"
            aria-labelledby="estrutura-organizacional-erro-titulo"
          >
            <StatusBadge variant="danger">Erro</StatusBadge>
            <h2
              id="estrutura-organizacional-erro-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Não foi possível carregar a estrutura organizacional
            </h2>
            <p>
              Verifique sua conexão e tente novamente. Se o problema persistir,
              contate o suporte.
            </p>
            <Button
              variant="secondary"
              onClick={() => void carregarDados(filtroStatus)}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : (
          <section aria-labelledby="estrutura-organizacional-lista-titulo">
            <h2
              id="estrutura-organizacional-lista-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Unidades organizacionais
            </h2>

            <div className="estrutura-organizacional-screen__filtros">
              <FormField id="estrutura-filtro-status" label="Situação">
                {(control) => (
                  <select
                    value={filtroStatus}
                    onChange={(evento) =>
                      setFiltroStatus(evento.target.value as StatusFiltro)
                    }
                    disabled={statusCarregamento === "carregando"}
                    {...control}
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Inativa</option>
                  </select>
                )}
              </FormField>
            </div>

            {statusCarregamento === "carregando" ? (
              <p
                className="estrutura-organizacional-screen__carregando"
                role="status"
              >
                Carregando unidades…
              </p>
            ) : unidades.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma unidade organizacional cadastrada"
                description="Cadastre a primeira unidade organizacional para esta empresa."
                action={
                  empresa ? (
                    <Button onClick={abrirCriar}>Nova unidade</Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                caption="Unidades organizacionais"
                columns={colunas}
                rows={unidades}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        )
      ) : abaAtiva === "departamentos" ? (
        statusDepCarregamento === "erro" ? (
          <Surface
            as="section"
            padding="lg"
            className="estrutura-organizacional-screen__erro"
            aria-labelledby="estrutura-dep-erro-titulo"
          >
            <StatusBadge variant="danger">Erro</StatusBadge>
            <h2
              id="estrutura-dep-erro-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Não foi possível carregar os departamentos
            </h2>
            <p>
              Verifique sua conexão e tente novamente. Se o problema persistir,
              contate o suporte.
            </p>
            <Button
              variant="secondary"
              onClick={() => void carregarDepartamentos(filtroDepStatus)}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : (
          <section aria-labelledby="estrutura-dep-lista-titulo">
            <h2
              id="estrutura-dep-lista-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Departamentos
            </h2>

            <div className="estrutura-organizacional-screen__filtros">
              <FormField id="estrutura-dep-filtro-status" label="Situação">
                {(control) => (
                  <select
                    value={filtroDepStatus}
                    onChange={(evento) =>
                      setFiltroDepStatus(evento.target.value as StatusFiltro)
                    }
                    disabled={statusDepCarregamento === "carregando"}
                    {...control}
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Inativa</option>
                  </select>
                )}
              </FormField>
            </div>

            {statusDepCarregamento === "carregando" ? (
              <p
                className="estrutura-organizacional-screen__carregando"
                role="status"
              >
                Carregando departamentos…
              </p>
            ) : departamentos.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum departamento cadastrado"
                description="Cadastre o primeiro departamento para esta empresa."
                action={
                  podeCriarDep ? (
                    <Button onClick={abrirCriarDep}>Novo departamento</Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                caption="Departamentos"
                columns={colunasDep}
                rows={departamentos}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        )
      ) : abaAtiva === "areas" ? (
        statusAreaCarregamento === "erro" ? (
          <Surface
            as="section"
            padding="lg"
            className="estrutura-organizacional-screen__erro"
            aria-labelledby="estrutura-area-erro-titulo"
          >
            <StatusBadge variant="danger">Erro</StatusBadge>
            <h2
              id="estrutura-area-erro-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Não foi possível carregar as áreas
            </h2>
            <p>
              Verifique sua conexão e tente novamente. Se o problema persistir,
              contate o suporte.
            </p>
            <Button
              variant="secondary"
              onClick={() => void carregarAreas(filtroAreaStatus)}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : (
          <section aria-labelledby="estrutura-area-lista-titulo">
            <h2
              id="estrutura-area-lista-titulo"
              className="estrutura-organizacional-screen__section-title"
            >
              Áreas
            </h2>

            <div className="estrutura-organizacional-screen__filtros">
              <FormField id="estrutura-area-filtro-status" label="Situação">
                {(control) => (
                  <select
                    value={filtroAreaStatus}
                    onChange={(evento) =>
                      setFiltroAreaStatus(evento.target.value as StatusFiltro)
                    }
                    disabled={statusAreaCarregamento === "carregando"}
                    {...control}
                  >
                    <option value="todos">Todas as situações</option>
                    <option value="ativo">Ativa</option>
                    <option value="inativo">Inativa</option>
                  </select>
                )}
              </FormField>
            </div>

            {statusAreaCarregamento === "carregando" ? (
              <p
                className="estrutura-organizacional-screen__carregando"
                role="status"
              >
                Carregando áreas…
              </p>
            ) : areas.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma área cadastrada"
                description="Cadastre a primeira área para um departamento desta empresa."
                action={
                  podeCriarArea ? (
                    <Button onClick={abrirCriarArea}>Nova área</Button>
                  ) : undefined
                }
              />
            ) : (
              <DataTable
                caption="Áreas"
                columns={colunasArea}
                rows={areas}
                rowKey={(linha) => linha.id}
              />
            )}
          </section>
        )
      ) : statusEquipeCarregamento === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__erro"
          aria-labelledby="estrutura-equipe-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="estrutura-equipe-erro-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Não foi possível carregar as equipes
          </h2>
          <p>
            Verifique sua conexão e tente novamente. Se o problema persistir,
            contate o suporte.
          </p>
          <Button
            variant="secondary"
            onClick={() => void carregarEquipes(filtroEquipeStatus)}
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="estrutura-equipe-lista-titulo">
          <h2
            id="estrutura-equipe-lista-titulo"
            className="estrutura-organizacional-screen__section-title"
          >
            Equipes
          </h2>

          <div className="estrutura-organizacional-screen__filtros">
            <FormField id="estrutura-equipe-filtro-status" label="Situação">
              {(control) => (
                <select
                  value={filtroEquipeStatus}
                  onChange={(evento) =>
                    setFiltroEquipeStatus(evento.target.value as StatusFiltro)
                  }
                  disabled={statusEquipeCarregamento === "carregando"}
                  {...control}
                >
                  <option value="todos">Todas as situações</option>
                  <option value="ativo">Ativa</option>
                  <option value="inativo">Inativa</option>
                </select>
              )}
            </FormField>
          </div>

          {statusEquipeCarregamento === "carregando" ? (
            <p
              className="estrutura-organizacional-screen__carregando"
              role="status"
            >
              Carregando equipes…
            </p>
          ) : equipes.length === 0 ? (
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nenhuma equipe cadastrada"
              description="Cadastre a primeira equipe para um departamento desta empresa."
              action={
                podeCriarEquipe ? (
                  <Button onClick={abrirCriarEquipe}>Nova equipe</Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              caption="Equipes"
              columns={colunasEquipe}
              rows={equipes}
              rowKey={(linha) => linha.id}
            />
          )}
        </section>
      )}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2
            id={formTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            {formulario.modo === "criar"
              ? "Nova unidade organizacional"
              : "Editar unidade organizacional"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formulario.modo === "criar"
                ? "Formulário de nova unidade organizacional"
                : "Formulário de edição de unidade organizacional"
            }
            onSubmit={(e) => void handleSubmit(e)}
          >
            {formulario.modo === "criar" ? (
              <FormField
                id="estrutura-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formulario.erros.codigo
                  ? { error: formulario.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: UNID_SP"
                    value={formulario.codigo}
                    onChange={(e) =>
                      setFormulario((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formulario.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-nome"
              label="Nome"
              required
              help="Identificador da unidade. Máximo 160 caracteres."
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

            {formulario.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formulario.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
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
                {formulario.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {formularioDep ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formDepTituloId}
        >
          <h2
            id={formDepTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            {formularioDep.modo === "criar"
              ? "Novo departamento"
              : "Editar departamento"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formularioDep.modo === "criar"
                ? "Formulário de novo departamento"
                : "Formulário de edição de departamento"
            }
            onSubmit={(e) => void handleSubmitDep(e)}
          >
            {formularioDep.modo === "criar" && empresasDep.length > 1 ? (
              <FormField
                id="estrutura-dep-empresa"
                label="Empresa"
                required
                {...(formularioDep.erros.empresaId
                  ? { error: formularioDep.erros.empresaId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formularioDep.empresaId}
                    onChange={(e) =>
                      setFormularioDep((prev) =>
                        prev
                          ? { ...prev, empresaId: e.target.value, erros: {} }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione a empresa</option>
                    {empresasDep.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formularioDep.modo === "criar" ? (
              <FormField
                id="estrutura-dep-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formularioDep.erros.codigo
                  ? { error: formularioDep.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: FIN"
                    value={formularioDep.codigo}
                    onChange={(e) =>
                      setFormularioDep((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-dep-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formularioDep.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-dep-nome"
              label="Nome"
              required
              help="Identificador do departamento. Máximo 160 caracteres."
              {...(formularioDep.erros.nome
                ? { error: formularioDep.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formularioDep.nome}
                  onChange={(e) =>
                    setFormularioDep((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formularioDep.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formularioDep.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
                onClick={fecharFormularioDep}
                disabled={formularioDep.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formularioDep.salvando}
              >
                {formularioDep.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {formularioEquipe ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formEquipeTituloId}
        >
          <h2
            id={formEquipeTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            {formularioEquipe.modo === "criar"
              ? "Nova equipe"
              : "Editar equipe"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formularioEquipe.modo === "criar"
                ? "Formulário de nova equipe"
                : "Formulário de edição de equipe"
            }
            onSubmit={(e) => void handleSubmitEquipe(e)}
          >
            {formularioEquipe.modo === "criar" &&
            departamentosAtivosEquipe.length > 1 ? (
              <FormField
                id="estrutura-equipe-departamento"
                label="Departamento"
                required
                {...(formularioEquipe.erros.departamentoId
                  ? { error: formularioEquipe.erros.departamentoId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formularioEquipe.departamentoId}
                    onChange={(e) =>
                      setFormularioEquipe((prev) =>
                        prev
                          ? {
                              ...prev,
                              departamentoId: e.target.value,
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione o departamento</option>
                    {departamentosAtivosEquipe.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.codigo} — {dep.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formularioEquipe.modo === "criar" ? (
              <FormField
                id="estrutura-equipe-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formularioEquipe.erros.codigo
                  ? { error: formularioEquipe.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: EQUIPE_TI"
                    value={formularioEquipe.codigo}
                    onChange={(e) =>
                      setFormularioEquipe((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-equipe-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formularioEquipe.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-equipe-nome"
              label="Nome"
              required
              help="Identificador da equipe. Máximo 160 caracteres."
              {...(formularioEquipe.erros.nome
                ? { error: formularioEquipe.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formularioEquipe.nome}
                  onChange={(e) =>
                    setFormularioEquipe((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formularioEquipe.modo === "criar" ? (
              <FormField
                id="estrutura-equipe-unidade"
                label="Unidade (opcional)"
                help="Vincule a equipe a uma unidade organizacional, se aplicável."
              >
                {(control) => (
                  <select
                    value={formularioEquipe.unidadeOrganizacionalId}
                    onChange={(e) =>
                      setFormularioEquipe((prev) =>
                        prev
                          ? {
                              ...prev,
                              unidadeOrganizacionalId: e.target.value,
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Sem unidade</option>
                    {unidadesAtivasEquipe.map((unid) => (
                      <option key={unid.id} value={unid.id}>
                        {unid.codigo} — {unid.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formularioEquipe.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formularioEquipe.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
                onClick={fecharFormularioEquipe}
                disabled={formularioEquipe.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formularioEquipe.salvando}
              >
                {formularioEquipe.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {formularioArea ? (
        <Surface
          as="section"
          padding="lg"
          className="estrutura-organizacional-screen__formulario"
          aria-labelledby={formAreaTituloId}
        >
          <h2
            id={formAreaTituloId}
            className="estrutura-organizacional-screen__section-title"
          >
            {formularioArea.modo === "criar" ? "Nova área" : "Editar área"}
          </h2>

          <form
            className="estrutura-organizacional-screen__form"
            aria-label={
              formularioArea.modo === "criar"
                ? "Formulário de nova área"
                : "Formulário de edição de área"
            }
            onSubmit={(e) => void handleSubmitArea(e)}
          >
            {formularioArea.modo === "criar" &&
            departamentosAtivosArea.length > 1 ? (
              <FormField
                id="estrutura-area-departamento"
                label="Departamento"
                required
                {...(formularioArea.erros.departamentoId
                  ? { error: formularioArea.erros.departamentoId }
                  : {})}
              >
                {(control) => (
                  <select
                    value={formularioArea.departamentoId}
                    onChange={(e) =>
                      setFormularioArea((prev) =>
                        prev
                          ? {
                              ...prev,
                              departamentoId: e.target.value,
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  >
                    <option value="">Selecione o departamento</option>
                    {departamentosAtivosArea.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.codigo} — {dep.nome}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            ) : null}

            {formularioArea.modo === "criar" ? (
              <FormField
                id="estrutura-area-codigo"
                label="Código"
                required
                help="Letras maiúsculas, dígitos e _ (2 a 32 caracteres). Imutável após o cadastro."
                {...(formularioArea.erros.codigo
                  ? { error: formularioArea.erros.codigo }
                  : {})}
              >
                {(control) => (
                  <input
                    type="text"
                    maxLength={32}
                    placeholder="Ex.: CONTAS"
                    value={formularioArea.codigo}
                    onChange={(e) =>
                      setFormularioArea((prev) =>
                        prev
                          ? {
                              ...prev,
                              codigo: e.target.value.toUpperCase(),
                              erros: {},
                            }
                          : prev,
                      )
                    }
                    {...control}
                  />
                )}
              </FormField>
            ) : (
              <FormField id="estrutura-area-codigo-fixo" label="Código">
                {(control) => (
                  <input
                    type="text"
                    readOnly
                    value={formularioArea.codigoAtual ?? ""}
                    aria-readonly="true"
                    {...control}
                  />
                )}
              </FormField>
            )}

            <FormField
              id="estrutura-area-nome"
              label="Nome"
              required
              help="Identificador da área. Máximo 160 caracteres."
              {...(formularioArea.erros.nome
                ? { error: formularioArea.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={160}
                  value={formularioArea.nome}
                  onChange={(e) =>
                    setFormularioArea((prev) =>
                      prev
                        ? { ...prev, nome: e.target.value, erros: {} }
                        : prev,
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            {formularioArea.erros.geral ? (
              <p
                className="estrutura-organizacional-screen__form-erro"
                role="alert"
              >
                {formularioArea.erros.geral}
              </p>
            ) : null}

            <FormActions>
              <Button
                variant="secondary"
                type="button"
                onClick={fecharFormularioArea}
                disabled={formularioArea.salvando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={formularioArea.salvando}
              >
                {formularioArea.salvando ? "Salvando…" : "Salvar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}
    </div>
  );
}
