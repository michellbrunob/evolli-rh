/**
 * Nova admissão (T176) — a admissão em página própria, fora de modal.
 *
 * ## De onde vem
 *
 * A proprietária resolveu o `DP-FLX-21` em 2026-10-20: cadastro longo e
 * estruturado de admissão usa página própria, e modal fica para consulta,
 * confirmação, seleção curta e edição delimitada. Esta é a primeira página
 * dessa decisão. Ela **não cria campo, regra, dado nem processo**: usa só o
 * contrato atual de `POST /v1/colaboradores` (T167), com os mesmos campos e as
 * mesmas validações do formulário que até aqui abria em modal na tela de
 * Colaboradores.
 *
 * ## O que a página preserva do contrato
 *
 * - **Admissão atômica.** Uma chamada cria, numa transação do servidor, o
 *   colaborador, o vínculo `previsto` e o ato de admissão (Baseline V1,
 *   decisão 15). A página não divide a operação em etapas.
 * - **Empresa só da sessão.** A empresa é a única que `GET /v1/empresas`
 *   devolve para a sessão. A página a mostra só para leitura e não oferece
 *   escolha; nenhuma, ou mais de uma, é estado que ela não sabe resolver, e
 *   então ela não envia.
 * - **Servidor como fonte.** A confirmação mostra o que o servidor gravou, não
 *   o que foi digitado.
 *
 * ## O que ela não faz
 *
 * Não coleta CPF, nascimento, endereço, documentos, dados bancários,
 * dependentes, saúde nem dado sindical; não tem etapas, devolução ou
 * aprovação; não gera matrícula. Tudo isso depende de gates ainda abertos
 * (`DP-FLX-04`, `-02`, `-03`, `-05`, `-06`, `-09`, `-10` e outros).
 *
 * ## Transição
 *
 * O formulário em modal da tela de Colaboradores continua existindo nesta
 * entrega, de propósito: a proprietária pediu que ele só saia depois que esta
 * página estiver validada. Ele é transitório, não a solução definitiva.
 */
import { useEffect, useRef, useState } from "react";
import {
  Button,
  FormActions,
  FormField,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
} from "../../components";
import {
  ApiError,
  type AdmissaoRegistradaApi,
  type AdmitirColaboradorDto,
  type ColaboradorApi,
  type TipoVinculo,
  admitirColaborador,
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
import { formatarDiaCivil } from "../../format/data";
import "./NovaAdmissaoScreen.css";

export const NOVA_ADMISSAO_TITULO_ID = "nova-admissao-titulo";

/** Mesmo padrão de `MATRICULA_PATTERN` do contrato (`pessoas.dto.ts`). */
const MATRICULA_PATTERN = /^[A-Z0-9_-]{2,32}$/;

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const ROTULO_SITUACAO_VINCULO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const ROTULO_STATUS_ADMISSAO: Record<string, string> = {
  solicitada: "Registrada, aguardando efetivação",
  programada: "Programada para a data de admissão",
};

type TipoDestino =
  "" | "unidade" | "departamento" | "area" | "equipe" | "cargo" | "centroCusto";

const OPCOES_TIPO_DESTINO: {
  valor: Exclude<TipoDestino, "">;
  rotulo: string;
}[] = [
  { valor: "unidade", rotulo: "Unidade organizacional" },
  { valor: "departamento", rotulo: "Departamento" },
  { valor: "area", rotulo: "Área" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "cargo", rotulo: "Cargo" },
  { valor: "centroCusto", rotulo: "Centro de custo" },
];

function rotuloTipoDestino(tipo: TipoDestino): string {
  return (
    OPCOES_TIPO_DESTINO.find((o) => o.valor === tipo)?.rotulo ?? "Registro"
  );
}

interface Erros {
  nome?: string;
  matricula?: string;
  tipo?: string;
  dataAdmissao?: string;
  tipoDestino?: string;
  departamentoArea?: string;
  destino?: string;
  geral?: string;
}

/** Ordem visual dos campos: o foco vai ao primeiro desta lista com erro. */
const ORDEM_DOS_ERROS: readonly (keyof Erros)[] = [
  "nome",
  "matricula",
  "tipo",
  "dataAdmissao",
  "tipoDestino",
  "departamentoArea",
  "destino",
  "geral",
];

const ERRO_GERAL_ID = "nova-admissao-erro-geral";

const ID_DO_CAMPO: Record<keyof Erros, string> = {
  nome: "nova-admissao-nome",
  matricula: "nova-admissao-matricula",
  tipo: "nova-admissao-tipo-vinculo",
  dataAdmissao: "nova-admissao-data-admissao",
  tipoDestino: "nova-admissao-tipo-destino",
  departamentoArea: "nova-admissao-departamento-area",
  destino: "nova-admissao-destino",
  geral: ERRO_GERAL_ID,
};

const MENSAGEM_EMPRESA_INDEFINIDA =
  "Não foi possível confirmar a empresa ativa em que você está trabalhando. Nada será enviado. Volte para Colaboradores e abra esta página de novo.";

/** Limpa o erro do campo em correção e preserva os demais, inclusive `geral`. */
function semErroDe(erros: Erros, ...campos: (keyof Erros)[]): Erros {
  const restante: Erros = { ...erros };
  for (const campo of campos) delete restante[campo];
  return restante;
}

/**
 * Traduz a recusa do servidor para o campo que a causou. O servidor responde
 * com mensagem fixa por status, sem dizer o campo; o mapeamento vale só para
 * `POST /v1/colaboradores` e é o mesmo do formulário da T167:
 *
 *  - 409 — a única unicidade que a admissão pode violar é a da matrícula
 *    dentro da empresa;
 *  - 422 — referência organizacional incoerente, de outra empresa ou inativa;
 *  - 404 — a empresa enviada deixou de ser a empresa ativa da sessão.
 *
 * Em todos os casos os dados digitados ficam na página.
 */
function errosDaRecusa(erro: unknown, temDestino: boolean): Erros {
  const status = erro instanceof ApiError ? erro.status : null;
  switch (status) {
    case 409:
      return {
        matricula:
          "Esta matrícula já está em uso nesta empresa. Informe outra.",
      };
    case 422:
      return temDestino
        ? {
            destino:
              "A referência organizacional escolhida não foi aceita: ela pode ter sido inativada ou não pertencer à empresa ativa. Escolha outra.",
          }
        : {
            geral:
              "O servidor recusou a referência organizacional. Revise a lotação inicial e tente de novo.",
          };
    case 404:
      return {
        geral:
          "A empresa ativa mudou desde que esta página foi aberta. Nada foi salvo. Volte para Colaboradores e abra a página de novo para admitir na empresa atual.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para admitir colaboradores. Nada foi salvo.",
      };
    case 401:
      return {
        geral:
          "Seu acesso expirou. Nada foi salvo. Entre novamente para concluir a admissão.",
      };
    case 400:
      return {
        geral:
          "O servidor recusou algum dos dados informados. Revise os campos e tente de novo.",
      };
    default:
      return {
        geral:
          "Não foi possível admitir o colaborador agora. Os dados digitados foram mantidos; tente de novo.",
      };
  }
}

interface Opcoes {
  empresas: EmpresaApi[];
  departamentos: DepartamentoApi[];
  unidades: UnidadeOrganizacionalApi[];
  equipes: EquipeApi[];
  cargos: CargoApi[];
  centrosCusto: CentroCustoApi[];
}

const OPCOES_VAZIAS: Opcoes = {
  empresas: [],
  departamentos: [],
  unidades: [],
  equipes: [],
  cargos: [],
  centrosCusto: [],
};

interface Campos {
  nome: string;
  matricula: string;
  tipo: TipoVinculo | "";
  dataAdmissao: string;
  tipoDestino: TipoDestino;
  destinoId: string;
  departamentoIdArea: string;
}

const CAMPOS_VAZIOS: Campos = {
  nome: "",
  matricula: "",
  tipo: "",
  dataAdmissao: "",
  tipoDestino: "",
  destinoId: "",
  departamentoIdArea: "",
};

/** Para onde levar quem acabou de admitir. */
export type FocoDoAdmitido = "ficha" | "contatos";

export interface NovaAdmissaoScreenProps {
  /** Sair da página sem admitir (depois da confirmação de descarte, se houver). */
  readonly onSair: () => void;
  /**
   * Abrir o colaborador que o SERVIDOR acabou de criar — a ficha, ou a ficha
   * já na seção de contatos aprovados (T169).
   */
  readonly onAbrirAdmitido: (
    colaborador: ColaboradorApi,
    foco: FocoDoAdmitido,
  ) => void;
}

export function NovaAdmissaoScreen({
  onSair,
  onAbrirAdmitido,
}: NovaAdmissaoScreenProps) {
  const [opcoes, setOpcoes] = useState<Opcoes>(OPCOES_VAZIAS);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);
  const [areas, setAreas] = useState<AreaApi[]>([]);
  const [carregandoAreas, setCarregandoAreas] = useState(false);
  const [campos, setCampos] = useState<Campos>(CAMPOS_VAZIOS);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [admissao, setAdmissao] = useState<AdmissaoRegistradaApi | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  /** Trava síncrona contra envio duplicado (cliques no mesmo quadro). */
  const enviandoRef = useRef(false);
  /** Gatilho de uma vez só: focar o primeiro erro depois que ele existe. */
  const focarPrimeiroErroRef = useRef(false);
  const sucessoTituloRef = useRef<HTMLHeadingElement | null>(null);

  const empresa = opcoes.empresas.length === 1 ? opcoes.empresas[0] : undefined;

  useEffect(() => {
    let vigente = true;
    void (async () => {
      try {
        const [empresas, departamentos, unidades, equipes, cargos, centros] =
          await Promise.all([
            listarEmpresasMulti(),
            listarDepartamentos({ status: "ativo", tamanhoPagina: 100 }),
            listarUnidades({ status: "ativo", tamanhoPagina: 100 }),
            listarEquipes({ status: "ativo", tamanhoPagina: 100 }),
            listarCargos({ status: "ativo", tamanhoPagina: 100 }),
            listarCentrosCusto({ status: "ativo", tamanhoPagina: 100 }),
          ]);
        if (!vigente) return;
        setOpcoes({
          empresas: empresas.itens,
          departamentos: departamentos.itens,
          unidades: unidades.itens,
          equipes: equipes.itens,
          cargos: cargos.itens,
          centrosCusto: centros.itens,
        });
        if (empresas.itens.length !== 1) {
          setErros({ geral: MENSAGEM_EMPRESA_INDEFINIDA });
        }
      } catch {
        if (!vigente) return;
        setErros({
          geral:
            "Não foi possível carregar a empresa ativa e as opções de lotação. Volte para Colaboradores e tente novamente.",
        });
      } finally {
        if (vigente) setCarregandoOpcoes(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (!focarPrimeiroErroRef.current) return;
    focarPrimeiroErroRef.current = false;
    const campo = ORDEM_DOS_ERROS.find((c) => erros[c]);
    if (campo) document.getElementById(ID_DO_CAMPO[campo])?.focus();
  }, [erros]);

  useEffect(() => {
    if (admissao) sucessoTituloRef.current?.focus();
  }, [admissao]);

  const alterado =
    campos.nome !== "" ||
    campos.matricula !== "" ||
    campos.tipo !== "" ||
    campos.dataAdmissao !== "" ||
    campos.tipoDestino !== "" ||
    campos.destinoId !== "";

  function atualizar<K extends keyof Campos>(
    campo: K,
    valor: Campos[K],
    ...errosLimpos: (keyof Erros)[]
  ) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => semErroDe(prev, ...errosLimpos));
  }

  function selecionarTipoDestino(tipoDestino: TipoDestino) {
    setCampos((prev) => ({
      ...prev,
      tipoDestino,
      destinoId: "",
      departamentoIdArea: "",
    }));
    setAreas([]);
    setErros((prev) =>
      semErroDe(prev, "tipoDestino", "departamentoArea", "destino"),
    );
  }

  async function selecionarDepartamentoArea(departamentoId: string) {
    setCampos((prev) => ({
      ...prev,
      departamentoIdArea: departamentoId,
      destinoId: "",
    }));
    setAreas([]);
    setErros((prev) => semErroDe(prev, "departamentoArea", "destino"));
    if (!departamentoId) return;
    setCarregandoAreas(true);
    try {
      const resp = await listarAreas({
        departamentoId,
        status: "ativo",
        tamanhoPagina: 100,
      });
      setAreas(resp.itens);
    } catch {
      setAreas([]);
    } finally {
      setCarregandoAreas(false);
    }
  }

  function validar(): Erros {
    const novos: Erros = {};
    const nome = campos.nome.trim();
    if (!nome) {
      novos.nome = "Nome é obrigatório.";
    } else if (nome.length < 2 || nome.length > 160) {
      novos.nome = "Nome deve ter entre 2 e 160 caracteres.";
    }
    if (!MATRICULA_PATTERN.test(campos.matricula.trim().toUpperCase())) {
      novos.matricula =
        "Use apenas letras maiúsculas, números, - e _ (2 a 32 caracteres).";
    }
    if (!campos.tipo) novos.tipo = "Selecione o tipo de vínculo.";
    if (!campos.dataAdmissao) {
      novos.dataAdmissao = "Informe a data de admissão.";
    }
    if (!campos.tipoDestino) {
      novos.tipoDestino = "Escolha o tipo de referência organizacional.";
    } else if (campos.tipoDestino === "area" && !campos.departamentoIdArea) {
      novos.departamentoArea = "Selecione o departamento da área.";
    } else if (!campos.destinoId) {
      novos.destino = `Selecione o registro de ${rotuloTipoDestino(
        campos.tipoDestino,
      ).toLowerCase()}.`;
    }
    if (!empresa) novos.geral = MENSAGEM_EMPRESA_INDEFINIDA;
    return novos;
  }

  function montarDto(empresaId: string): AdmitirColaboradorDto {
    const { tipoDestino, destinoId, departamentoIdArea } = campos;
    return {
      nome: campos.nome.trim(),
      empresaId,
      matricula: campos.matricula.trim().toUpperCase(),
      tipo: campos.tipo as TipoVinculo,
      dataAdmissao: campos.dataAdmissao,
      motivoCodigo: "admissao_inicial",
      ...(tipoDestino === "unidade"
        ? { unidadeOrganizacionalId: destinoId }
        : {}),
      ...(tipoDestino === "departamento" ? { departamentoId: destinoId } : {}),
      ...(tipoDestino === "area"
        ? { areaId: destinoId, departamentoId: departamentoIdArea }
        : {}),
      ...(tipoDestino === "equipe" ? { equipeId: destinoId } : {}),
      ...(tipoDestino === "cargo" ? { cargoId: destinoId } : {}),
      ...(tipoDestino === "centroCusto" ? { centroCustoId: destinoId } : {}),
    };
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (enviandoRef.current) return;

    const novos = validar();
    if (Object.keys(novos).length > 0 || !empresa) {
      focarPrimeiroErroRef.current = true;
      setErros(novos);
      return;
    }

    enviandoRef.current = true;
    setSalvando(true);
    setErros({});
    try {
      const resposta = await admitirColaborador(montarDto(empresa.id));
      setAdmissao(resposta);
    } catch (erro: unknown) {
      // Os dados digitados ficam: só as mensagens e o estado de envio mudam.
      focarPrimeiroErroRef.current = true;
      setErros(errosDaRecusa(erro, campos.tipoDestino !== ""));
    } finally {
      setSalvando(false);
      enviandoRef.current = false;
    }
  }

  function pedirCancelamento() {
    if (salvando) return;
    if (alterado) {
      setConfirmandoDescarte(true);
      return;
    }
    onSair();
  }

  function recomecar() {
    setCampos(CAMPOS_VAZIOS);
    setAreas([]);
    setErros({});
    setAdmissao(null);
  }

  const opcoesDestino: { id: string; rotulo: string }[] = (() => {
    const rotular = (r: { id: string; codigo: string; nome: string }) => ({
      id: r.id,
      rotulo: `${r.codigo} — ${r.nome}`,
    });
    switch (campos.tipoDestino) {
      case "unidade":
        return opcoes.unidades.map(rotular);
      case "departamento":
        return opcoes.departamentos.map(rotular);
      case "area":
        return areas.map(rotular);
      case "equipe":
        return opcoes.equipes.map(rotular);
      case "cargo":
        return opcoes.cargos.map(rotular);
      case "centroCusto":
        return opcoes.centrosCusto.map(rotular);
      default:
        return [];
    }
  })();

  if (admissao) {
    return (
      <ConfirmacaoDaAdmissao
        admissao={admissao}
        opcoes={opcoes}
        areas={areas}
        tituloRef={sucessoTituloRef}
        onAbrirAdmitido={onAbrirAdmitido}
        onRecomecar={recomecar}
        onSair={onSair}
      />
    );
  }

  return (
    <div className="nova-admissao">
      <PageHeader
        headingLevel={1}
        titleId={NOVA_ADMISSAO_TITULO_ID}
        title="Nova admissão"
        description="Registre a admissão de um colaborador na empresa ativa. Uma só operação cria o colaborador, o vínculo previsto e o ato de admissão; a efetivação continua sendo feita depois, pelo RH ou DP."
      />

      <Surface
        as="section"
        padding="md"
        className="nova-admissao__aviso"
        aria-labelledby="nova-admissao-aviso-titulo"
      >
        <StatusBadge variant="info">Somente o aprovado</StatusBadge>
        <p id="nova-admissao-aviso-titulo" className="nova-admissao__texto">
          Esta página pede só os dados que a admissão já aceita hoje. CPF,
          nascimento, endereço, documentos, dados bancários, dependentes e
          outros dados pessoais ainda não são coletados: dependem de decisões
          pendentes.
        </p>
      </Surface>

      <form
        className="nova-admissao__form"
        aria-label="Formulário de nova admissão"
        noValidate
        onSubmit={(e) => void enviar(e)}
      >
        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-empresa"
        >
          <h2
            id="nova-admissao-grupo-empresa"
            className="nova-admissao__grupo-titulo"
          >
            Empresa
          </h2>
          {carregandoOpcoes ? (
            <p className="nova-admissao__texto" role="status">
              Carregando a empresa ativa…
            </p>
          ) : empresa ? (
            <dl className="nova-admissao__leitura">
              <dt>Empresa ativa</dt>
              <dd id="nova-admissao-empresa">
                <strong>{empresa.nome}</strong> ({empresa.codigo})
                <span className="nova-admissao__ajuda">
                  {" "}
                  — a empresa em que você está trabalhando. Não é editável aqui.
                </span>
              </dd>
            </dl>
          ) : null}
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-identificacao"
        >
          <h2
            id="nova-admissao-grupo-identificacao"
            className="nova-admissao__grupo-titulo"
          >
            Identificação
          </h2>
          <FormField
            id={ID_DO_CAMPO.nome}
            label="Nome completo"
            required
            help="2 a 160 caracteres."
            {...(erros.nome ? { error: erros.nome } : {})}
          >
            {(control) => (
              <input
                type="text"
                maxLength={160}
                autoComplete="off"
                value={campos.nome}
                onChange={(e) => atualizar("nome", e.target.value, "nome")}
                {...control}
              />
            )}
          </FormField>
          <FormField
            id={ID_DO_CAMPO.matricula}
            label="Matrícula"
            required
            help="Letras maiúsculas, números, - e _ (2 a 32 caracteres)."
            {...(erros.matricula ? { error: erros.matricula } : {})}
          >
            {(control) => (
              <input
                type="text"
                maxLength={32}
                autoComplete="off"
                value={campos.matricula}
                onChange={(e) =>
                  atualizar(
                    "matricula",
                    e.target.value.toUpperCase(),
                    "matricula",
                  )
                }
                {...control}
              />
            )}
          </FormField>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-vinculo"
        >
          <h2
            id="nova-admissao-grupo-vinculo"
            className="nova-admissao__grupo-titulo"
          >
            Vínculo
          </h2>
          <FormField
            id={ID_DO_CAMPO.tipo}
            label="Tipo de vínculo"
            required
            {...(erros.tipo ? { error: erros.tipo } : {})}
          >
            {(control) => (
              <select
                value={campos.tipo}
                onChange={(e) =>
                  atualizar("tipo", e.target.value as TipoVinculo, "tipo")
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
            id={ID_DO_CAMPO.dataAdmissao}
            label="Data de admissão"
            required
            help="Data futura deixa o ato de admissão programado para ela."
            {...(erros.dataAdmissao ? { error: erros.dataAdmissao } : {})}
          >
            {(control) => (
              <input
                type="date"
                value={campos.dataAdmissao}
                onChange={(e) =>
                  atualizar("dataAdmissao", e.target.value, "dataAdmissao")
                }
                {...control}
              />
            )}
          </FormField>
        </section>

        <section
          className="nova-admissao__grupo"
          aria-labelledby="nova-admissao-grupo-lotacao"
        >
          <h2
            id="nova-admissao-grupo-lotacao"
            className="nova-admissao__grupo-titulo"
          >
            Lotação inicial
          </h2>
          <FormField
            id={ID_DO_CAMPO.tipoDestino}
            label="Tipo de referência organizacional"
            required
            help="Primeiro escolha o tipo; o registro é escolhido no campo seguinte."
            {...(erros.tipoDestino ? { error: erros.tipoDestino } : {})}
          >
            {(control) => (
              <select
                value={campos.tipoDestino}
                onChange={(e) =>
                  selecionarTipoDestino(e.target.value as TipoDestino)
                }
                disabled={carregandoOpcoes}
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

          {campos.tipoDestino === "area" ? (
            <FormField
              id={ID_DO_CAMPO.departamentoArea}
              label="Departamento da área"
              required
              help="A área só identifica a lotação junto com o departamento a que pertence."
              {...(erros.departamentoArea
                ? { error: erros.departamentoArea }
                : {})}
            >
              {(control) => (
                <select
                  value={campos.departamentoIdArea}
                  onChange={(e) =>
                    void selecionarDepartamentoArea(e.target.value)
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {opcoes.departamentos.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.codigo} — {dep.nome}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : null}

          {campos.tipoDestino ? (
            <FormField
              id={ID_DO_CAMPO.destino}
              label="Registro da referência organizacional"
              required
              help={`Tipo escolhido: ${rotuloTipoDestino(campos.tipoDestino)}. Uma referência é suficiente para efetivar a admissão.`}
              {...(erros.destino ? { error: erros.destino } : {})}
            >
              {(control) => (
                <select
                  value={campos.destinoId}
                  onChange={(e) =>
                    atualizar("destinoId", e.target.value, "destino")
                  }
                  disabled={
                    campos.tipoDestino === "area" &&
                    (!campos.departamentoIdArea || carregandoAreas)
                  }
                  {...control}
                >
                  <option value="">Selecione…</option>
                  {opcoesDestino.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          ) : null}
        </section>

        {erros.geral ? (
          <p
            className="nova-admissao__erro-geral"
            role="alert"
            id={ERRO_GERAL_ID}
            tabIndex={-1}
          >
            {erros.geral}
          </p>
        ) : null}

        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={pedirCancelamento}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={salvando || carregandoOpcoes}
          >
            {salvando ? "Admitindo…" : "Admitir colaborador"}
          </Button>
        </FormActions>
      </form>

      {/* Confirmação de descarte: é confirmação curta, o uso de modal que a
          decisão do `DP-FLX-21` mantém. O cadastro em si nunca abre em modal. */}
      <Modal
        aberto={confirmandoDescarte}
        titulo="Descartar esta admissão?"
        descricao="Os dados digitados nesta página serão perdidos. Nada foi salvo."
        onFechar={() => setConfirmandoDescarte(false)}
      >
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmandoDescarte(false)}
          >
            Continuar preenchendo
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setConfirmandoDescarte(false);
              onSair();
            }}
          >
            Descartar e sair
          </Button>
        </FormActions>
      </Modal>
    </div>
  );
}

interface ConfirmacaoProps {
  admissao: AdmissaoRegistradaApi;
  opcoes: Opcoes;
  areas: AreaApi[];
  tituloRef: React.RefObject<HTMLHeadingElement>;
  onAbrirAdmitido: NovaAdmissaoScreenProps["onAbrirAdmitido"];
  onRecomecar: () => void;
  onSair: () => void;
}

/**
 * Lotação inicial como o SERVIDOR a gravou: a referência devolvida na
 * resposta, nomeada pelas opções que a própria página carregou do servidor.
 * Se o registro não estiver entre elas, diz só o tipo — nunca um id cru.
 */
function lotacaoGravada(
  destino: AdmissaoRegistradaApi["movimentacao"]["destino"],
  opcoes: Opcoes,
  areas: AreaApi[],
): string {
  const nomear = (
    lista: { id: string; codigo: string; nome: string }[],
    id: string,
    rotulo: string,
  ) => {
    const achado = lista.find((r) => r.id === id);
    return achado
      ? `${rotulo}: ${achado.codigo} — ${achado.nome}`
      : `${rotulo} registrada`;
  };
  if (destino.areaId) return nomear(areas, destino.areaId, "Área");
  if (destino.departamentoId)
    return nomear(opcoes.departamentos, destino.departamentoId, "Departamento");
  if (destino.unidadeOrganizacionalId)
    return nomear(
      opcoes.unidades,
      destino.unidadeOrganizacionalId,
      "Unidade organizacional",
    );
  if (destino.equipeId)
    return nomear(opcoes.equipes, destino.equipeId, "Equipe");
  if (destino.cargoId) return nomear(opcoes.cargos, destino.cargoId, "Cargo");
  if (destino.centroCustoId)
    return nomear(
      opcoes.centrosCusto,
      destino.centroCustoId,
      "Centro de custo",
    );
  return "Sem referência registrada";
}

function ConfirmacaoDaAdmissao({
  admissao,
  opcoes,
  areas,
  tituloRef,
  onAbrirAdmitido,
  onRecomecar,
  onSair,
}: ConfirmacaoProps) {
  const colaborador: ColaboradorApi = {
    id: admissao.id,
    nome: admissao.nome,
    situacao: admissao.situacao,
    criadoEm: admissao.criadoEm,
    atualizadoEm: admissao.atualizadoEm,
  };
  return (
    <div className="nova-admissao">
      <PageHeader
        headingLevel={1}
        titleId={NOVA_ADMISSAO_TITULO_ID}
        title="Nova admissão"
      />
      <Surface
        as="section"
        padding="lg"
        className="nova-admissao__sucesso"
        aria-labelledby="nova-admissao-sucesso-titulo"
      >
        <StatusBadge variant="success">Admissão registrada</StatusBadge>
        <h2
          id="nova-admissao-sucesso-titulo"
          className="nova-admissao__grupo-titulo"
          tabIndex={-1}
          ref={tituloRef}
        >
          Admissão de {admissao.nome} registrada
        </h2>
        <p className="nova-admissao__texto" role="status">
          O servidor confirmou a admissão. Os dados abaixo são os que ele
          gravou. O colaborador fica{" "}
          {admissao.situacao === "ativo" ? "Ativo" : "Inativo"} e o vínculo{" "}
          {ROTULO_SITUACAO_VINCULO[admissao.vinculo.situacao] ??
            admissao.vinculo.situacao}{" "}
          até a efetivação da admissão.
        </p>
        <dl className="nova-admissao__resumo">
          <dt>Colaborador</dt>
          <dd>{admissao.nome}</dd>
          <dt>Matrícula</dt>
          <dd>{admissao.vinculo.matricula}</dd>
          <dt>Tipo de vínculo</dt>
          <dd>
            {ROTULO_TIPO_VINCULO[admissao.vinculo.tipo] ??
              admissao.vinculo.tipo}
          </dd>
          <dt>Situação do vínculo</dt>
          <dd>
            {ROTULO_SITUACAO_VINCULO[admissao.vinculo.situacao] ??
              admissao.vinculo.situacao}
          </dd>
          <dt>Data de admissão</dt>
          <dd>{formatarDiaCivil(admissao.vinculo.dataAdmissao)}</dd>
          <dt>Ato de admissão</dt>
          <dd>
            {ROTULO_STATUS_ADMISSAO[admissao.movimentacao.status] ??
              admissao.movimentacao.status}
          </dd>
          <dt>Lotação inicial</dt>
          <dd>
            {lotacaoGravada(admissao.movimentacao.destino, opcoes, areas)}
          </dd>
        </dl>
        <FormActions>
          <Button
            type="button"
            variant="primary"
            onClick={() => onAbrirAdmitido(colaborador, "ficha")}
          >
            Abrir ficha de {admissao.nome}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onAbrirAdmitido(colaborador, "contatos")}
          >
            Completar contatos
          </Button>
          <Button type="button" variant="secondary" onClick={onRecomecar}>
            Registrar outra admissão
          </Button>
          <Button type="button" variant="secondary" onClick={onSair}>
            Voltar para Colaboradores
          </Button>
        </FormActions>
      </Surface>
    </div>
  );
}
