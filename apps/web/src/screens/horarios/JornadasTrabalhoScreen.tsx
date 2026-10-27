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
import type { DataTableColumn } from "../../components";
import {
  type DiaSemana,
  type PeriodoApi,
  type TabelaHorarioApi,
  criarTabelaHorario,
  desativarTabelaHorario,
  editarTabelaHorario,
  listarTabelasHorario,
  reativarTabelaHorario,
} from "../../api/horariosClient";
import {
  falhaAoPrepararEnvio,
  falhaPorSessaoExpirada,
  falhaPorTokenDesatualizado,
} from "../../api/csrfClient";
import "./JornadasTrabalhoScreen.css";
import { useEdicaoEmAndamento } from "../../app/edicoesPendentes";

/**
 * T182 — Estrutura › Jornadas de trabalho (decisão da proprietária de
 * 2026-10-23). Catálogo das jornadas da empresa ativa: turnos reutilizáveis,
 * futuramente associados aos colaboradores. Evolui a antiga aba
 * Estrutura › Horários (T110), sobre o mesmo contrato (`/v1/horarios`, a
 * `tabela_horario` da T038).
 *
 * - **RH** cria, edita (nome e código) e inativa/reativa. **DP** e
 *   `master_tecnico` só consultam: sem `podeOperar`, a tela não mostra nenhuma
 *   ação de escrita, e o servidor recusa de qualquer forma.
 * - Uma jornada tem código (único na empresa), nome e os dias e horários que o
 *   contrato já tem. **Dias e horários são imutáveis** depois de criados
 *   (T038, no banco): para mudar, cria-se uma nova jornada a partir desta e
 *   inativa-se a antiga. Inativar é lógico; nada é excluído.
 * - A empresa nunca é enviada: o servidor a resolve pela sessão.
 * - Fuso horário não faz parte do produto: horários são horas locais.
 */
export const JORNADAS_TRABALHO_TITULO_ID = "jornadas-trabalho-titulo";

const DIAS_SEMANA: { valor: DiaSemana; rotulo: string; curto: string }[] = [
  { valor: "segunda", rotulo: "Segunda-feira", curto: "Seg" },
  { valor: "terca", rotulo: "Terça-feira", curto: "Ter" },
  { valor: "quarta", rotulo: "Quarta-feira", curto: "Qua" },
  { valor: "quinta", rotulo: "Quinta-feira", curto: "Qui" },
  { valor: "sexta", rotulo: "Sexta-feira", curto: "Sex" },
  { valor: "sabado", rotulo: "Sábado", curto: "Sáb" },
  { valor: "domingo", rotulo: "Domingo", curto: "Dom" },
];

const ROTULO_DIA: Record<string, string> = Object.fromEntries(
  DIAS_SEMANA.map(({ valor, rotulo }) => [valor, rotulo]),
);

/** Mesma forma do servidor (`CODIGO_JORNADA`). */
const CODIGO_PATTERN = /^[A-Z0-9_]{2,32}$/;
const NOME_MAXIMO = 120;
/** O maior lote que o servidor devolve de uma vez. */
const TAMANHO_PAGINA = 100;

type FiltroAtivo = "todos" | "ativo" | "inativo";

let uidCounter = 0;
function novoUid(): string {
  return `p${++uidCounter}`;
}

interface PeriodoRow {
  uid: string;
  dia: DiaSemana | "";
  inicio: string;
  fim: string;
}

interface Erros {
  codigo?: string;
  nome?: string;
  periodos?: string;
  geral?: string;
}

interface Formulario {
  /** `null`: nova jornada; senão, a jornada em edição (nome e código). */
  readonly jornada: TabelaHorarioApi | null;
  codigo: string;
  nome: string;
  periodos: PeriodoRow[];
  erros: Erros;
  salvando: boolean;
}

interface Detalhe {
  tabela: TabelaHorarioApi;
  alterando: boolean;
  erro: string | null;
}

const ID_CODIGO = "jornadas-codigo";
const ID_NOME = "jornadas-nome";
const ID_PERIODOS_ERRO = "jornadas-periodos-erro";
const ID_ERRO_GERAL = "jornadas-erro-geral";
const ID_DETALHE_TITULO = "jornadas-detalhe-titulo";

/** `status` numérico do erro, lido por forma; `null` sem resposta. */
function statusDe(erro: unknown): number | null {
  return typeof erro === "object" &&
    erro !== null &&
    typeof (erro as { status?: unknown }).status === "number"
    ? (erro as { status: number }).status
    : null;
}

/** O 409 aponta o código como em uso (o servidor não devolve o valor). */
function codigoEmUso(erro: unknown): boolean {
  const erros =
    typeof erro === "object" && erro !== null
      ? (erro as { erros?: unknown }).erros
      : undefined;
  return (
    Array.isArray(erros) &&
    erros.some(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        (e as { campo?: unknown }).campo === "codigo" &&
        (e as { motivo?: unknown }).motivo === "em_uso",
    )
  );
}

/**
 * Recusa de uma gravação, pelo que o contrato produz. O digitado fica no
 * formulário em todos os casos; sem resposta ou com 5xx, a mensagem não
 * afirma nem nega a gravação.
 */
function errosDaRecusa(erro: unknown, nova: boolean): Erros {
  if (falhaPorTokenDesatualizado(erro)) {
    return {
      geral:
        "Esta página ficou desatualizada, e nada foi salvo. Tente de novo; seus dados foram mantidos.",
    };
  }
  if (falhaPorSessaoExpirada(erro)) {
    return {
      geral:
        "Sua sessão expirou, e nada foi salvo. Entre de novo para continuar.",
    };
  }
  if (falhaAoPrepararEnvio(erro)) {
    return {
      geral:
        "Não foi possível preparar o envio, e nada foi salvo. Confira a conexão e tente de novo.",
    };
  }
  const status = statusDe(erro);
  if (status === 409 && codigoEmUso(erro)) {
    return { codigo: "Este código já está em uso nesta empresa." };
  }
  switch (status) {
    case 400:
      return {
        geral:
          "O servidor recusou os dados, e nada foi salvo. Revise o código, o nome e os horários.",
      };
    case 403:
      return {
        geral:
          "Seu perfil não tem permissão para alterar jornadas. Nada foi salvo.",
      };
    case 404:
      return {
        geral: "Jornada não encontrada na empresa ativa. Nada foi salvo.",
      };
    case 409:
      return {
        geral:
          "A jornada não foi salva: outra gravação aconteceu ao mesmo tempo. Atualize a lista e tente de novo.",
      };
    case 422:
      return {
        periodos:
          "Os dias e horários foram recusados: há períodos sobrepostos ou inválidos. Revise e tente de novo.",
      };
    default:
      return {
        geral: nova
          ? "Não foi possível confirmar se a jornada foi salva. Atualize a lista antes de tentar de novo: se ela já tiver sido criada, o código aparecerá como em uso."
          : "Não foi possível confirmar se a alteração foi salva. Atualize a lista para conferir.",
      };
  }
}

/** "Seg, Ter, Qua · 6 períodos" — o resumo da linha da lista. */
function resumoDosPeriodos(periodos: readonly PeriodoApi[]): string {
  if (periodos.length === 0) return "Sem dias e horários";
  const dias = DIAS_SEMANA.filter((d) =>
    periodos.some((p) => p.dia === d.valor),
  ).map((d) => d.curto);
  const quantos =
    periodos.length === 1 ? "1 período" : `${periodos.length} períodos`;
  return `${dias.join(", ")} · ${quantos}`;
}

function validar(form: Formulario): Erros {
  const erros: Erros = {};
  const codigo = form.codigo.trim();
  if (!codigo) erros.codigo = "Informe o código.";
  else if (!CODIGO_PATTERN.test(codigo)) {
    erros.codigo =
      "Use de 2 a 32 letras maiúsculas, números ou _ (sem espaço ou acento).";
  }
  const nome = form.nome.trim();
  if (!nome) erros.nome = "Informe o nome.";
  else if (nome.length > NOME_MAXIMO) {
    erros.nome = `O nome deve ter no máximo ${NOME_MAXIMO} caracteres.`;
  }
  if (form.jornada === null) {
    if (form.periodos.some((p) => !p.dia || !p.inicio || !p.fim)) {
      erros.periodos =
        "Preencha o dia, a entrada e a saída de cada período, ou remova o período.";
    } else if (form.periodos.some((p) => p.fim <= p.inicio)) {
      erros.periodos = "Em cada período, a saída deve ser depois da entrada.";
    }
  }
  return erros;
}

function rotuloDe(tabela: TabelaHorarioApi): string {
  return tabela.codigo ?? tabela.nome;
}

export interface JornadasTrabalhoScreenProps {
  /**
   * O perfil OPERA o catálogo: só o RH. Sem isso, a tela é só consulta, sem
   * nenhuma ação de escrita. Só orienta a tela: quem recusa é o servidor.
   */
  readonly podeOperar?: boolean;
}

export function JornadasTrabalhoScreen({
  podeOperar = false,
}: JornadasTrabalhoScreenProps) {
  const [status, setStatus] = useState<"carregando" | "erro" | "dados">(
    "carregando",
  );
  const [tabelas, setTabelas] = useState<TabelaHorarioApi[]>([]);
  const [total, setTotal] = useState(0);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("todos");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  // T189 — formulário aberto conta como edição em andamento, e envio como
  // salvamento: a troca de empresa pergunta antes de descartar, e espera
  // o envio terminar.
  useEdicaoEmAndamento("Jornadas de trabalho", {
    pendente: formulario !== null,
    salvando: formulario?.salvando === true,
  });
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const formTituloId = useId();
  /** Só a resposta mais recente da lista vale (filtro ou busca trocados). */
  const pedidoRef = useRef(0);
  /** Trava síncrona contra envio duplicado. */
  const salvandoRef = useRef(false);
  /** Foco pedido para depois do desenho. */
  const focoRef = useRef<string | null>(null);

  const carregar = useCallback(async (filtro: FiltroAtivo, termo: string) => {
    const pedido = ++pedidoRef.current;
    setStatus("carregando");
    try {
      const resp = await listarTabelasHorario({
        ...(filtro === "ativo" ? { ativo: true } : {}),
        ...(filtro === "inativo" ? { ativo: false } : {}),
        ...(termo ? { busca: termo } : {}),
        tamanhoPagina: TAMANHO_PAGINA,
      });
      if (pedido !== pedidoRef.current) return;
      setTabelas(resp.itens);
      setTotal(resp.total);
      setStatus("dados");
    } catch {
      if (pedido !== pedidoRef.current) return;
      setStatus("erro");
    }
  }, []);

  useEffect(() => {
    void carregar(filtroAtivo, buscaAplicada);
  }, [filtroAtivo, buscaAplicada, carregar]);

  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  function abrirNova(base: TabelaHorarioApi | null) {
    setFormulario({
      jornada: null,
      codigo: "",
      nome: "",
      // "Nova jornada a partir desta": os dias e horários vêm copiados; o
      // código e o nome começam vazios (o código é único na empresa).
      periodos: (base?.periodos ?? []).map((p) => ({
        uid: novoUid(),
        dia: p.dia as DiaSemana,
        inicio: p.inicio,
        fim: p.fim,
      })),
      erros: {},
      salvando: false,
    });
    setDetalhe(null);
    setAviso(null);
    focoRef.current = ID_CODIGO;
  }

  function abrirEdicao(tabela: TabelaHorarioApi) {
    setFormulario({
      jornada: tabela,
      codigo: tabela.codigo ?? "",
      nome: tabela.nome,
      periodos: [],
      erros: {},
      salvando: false,
    });
    setDetalhe(null);
    setAviso(null);
    focoRef.current = ID_CODIGO;
  }

  function fecharFormulario() {
    if (salvandoRef.current) return;
    setFormulario(null);
  }

  function abrirDetalhe(tabela: TabelaHorarioApi) {
    setDetalhe({ tabela, alterando: false, erro: null });
    setFormulario(null);
    setAviso(null);
    focoRef.current = ID_DETALHE_TITULO;
  }

  function alterarForm(mudanca: Partial<Formulario>, campo?: keyof Erros) {
    setFormulario((prev) => {
      if (!prev) return prev;
      const erros = { ...prev.erros };
      if (campo) delete erros[campo];
      return { ...prev, ...mudanca, erros };
    });
  }

  function atualizarPeriodo(
    uid: string,
    campo: keyof Omit<PeriodoRow, "uid">,
    valor: string,
  ) {
    setFormulario((prev) => {
      if (!prev) return prev;
      const erros = { ...prev.erros };
      delete erros.periodos;
      return {
        ...prev,
        periodos: prev.periodos.map((p) =>
          p.uid === uid ? { ...p, [campo]: valor } : p,
        ),
        erros,
      };
    });
  }

  function focarPrimeiroErro(erros: Erros) {
    focoRef.current = erros.codigo
      ? ID_CODIGO
      : erros.nome
        ? ID_NOME
        : erros.periodos
          ? ID_PERIODOS_ERRO
          : erros.geral
            ? ID_ERRO_GERAL
            : null;
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formulario || salvandoRef.current) return;
    const locais = validar(formulario);
    if (Object.values(locais).some(Boolean)) {
      setFormulario((prev) => (prev ? { ...prev, erros: locais } : prev));
      focarPrimeiroErro(locais);
      return;
    }
    salvandoRef.current = true;
    setFormulario((prev) =>
      prev ? { ...prev, salvando: true, erros: {} } : prev,
    );
    const { jornada } = formulario;
    try {
      const salva =
        jornada === null
          ? await criarTabelaHorario({
              codigo: formulario.codigo.trim(),
              nome: formulario.nome.trim(),
              periodos: formulario.periodos.map((p) => ({
                dia: p.dia as DiaSemana,
                inicio: p.inicio,
                fim: p.fim,
              })),
            })
          : await editarTabelaHorario(jornada.id, {
              codigo: formulario.codigo.trim(),
              nome: formulario.nome.trim(),
            });
      setFormulario(null);
      setAviso(
        jornada === null
          ? `Jornada ${rotuloDe(salva)} criada.`
          : `Jornada ${rotuloDe(salva)} atualizada.`,
      );
      setDetalhe({ tabela: salva, alterando: false, erro: null });
      focoRef.current = ID_DETALHE_TITULO;
      void carregar(filtroAtivo, buscaAplicada);
    } catch (erro: unknown) {
      const erros = errosDaRecusa(erro, jornada === null);
      setFormulario((prev) =>
        prev ? { ...prev, salvando: false, erros } : prev,
      );
      focarPrimeiroErro(erros);
    } finally {
      salvandoRef.current = false;
    }
  }

  async function alterarSituacao() {
    if (!detalhe || detalhe.alterando) return;
    const { tabela } = detalhe;
    setDetalhe((prev) =>
      prev ? { ...prev, alterando: true, erro: null } : prev,
    );
    try {
      const atualizada = tabela.ativo
        ? await desativarTabelaHorario(tabela.id)
        : await reativarTabelaHorario(tabela.id);
      setDetalhe({ tabela: atualizada, alterando: false, erro: null });
      // Com o filtro de situação, a jornada que deixa de corresponder a ele
      // sai da lista na hora (o detalhe continua aberto, com Reativar).
      const saiDoFiltro =
        (filtroAtivo === "ativo" && !atualizada.ativo) ||
        (filtroAtivo === "inativo" && atualizada.ativo);
      setTabelas((prev) =>
        saiDoFiltro
          ? prev.filter((t) => t.id !== atualizada.id)
          : prev.map((t) => (t.id === atualizada.id ? atualizada : t)),
      );
      if (saiDoFiltro) setTotal((anterior) => Math.max(0, anterior - 1));
      setAviso(
        atualizada.ativo
          ? `Jornada ${rotuloDe(atualizada)} reativada.`
          : `Jornada ${rotuloDe(atualizada)} inativada. Ela continua no histórico.`,
      );
    } catch (erro: unknown) {
      const mensagem =
        errosDaRecusa(erro, false).geral ??
        "Não foi possível alterar a situação da jornada. Atualize a lista para conferir.";
      setDetalhe((prev) =>
        prev ? { ...prev, alterando: false, erro: mensagem } : prev,
      );
    }
  }

  function aplicarBusca(evento: React.FormEvent) {
    evento.preventDefault();
    const termo = busca.trim();
    // O mesmo termo não muda o estado: buscar de novo recarrega a lista.
    if (termo === buscaAplicada) void carregar(filtroAtivo, termo);
    else setBuscaAplicada(termo);
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
  }

  const colunasPeriodos: DataTableColumn<PeriodoApi>[] = [
    { key: "dia", header: "Dia", cell: (p) => ROTULO_DIA[p.dia] ?? p.dia },
    { key: "inicio", header: "Entrada", cell: (p) => p.inicio },
    { key: "fim", header: "Saída", cell: (p) => p.fim },
  ];

  const colunas: DataTableColumn<TabelaHorarioApi>[] = [
    {
      key: "codigo",
      header: "Código",
      cell: (t) =>
        t.codigo ?? (
          <span className="horarios-screen__sem-codigo">Sem código</span>
        ),
    },
    { key: "nome", header: "Nome", cell: (t) => t.nome },
    {
      key: "periodos",
      header: "Dias e horários",
      cell: (t) => resumoDosPeriodos(t.periodos),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (t) => (
        <StatusBadge variant={t.ativo ? "success" : "neutral"}>
          {t.ativo ? "Ativa" : "Inativa"}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (t) => (
        <Button variant="secondary" onClick={() => abrirDetalhe(t)}>
          Ver detalhes
          <span className="sr-only"> — {t.nome}</span>
        </Button>
      ),
    },
  ];

  const temFiltro = buscaAplicada !== "" || filtroAtivo !== "todos";

  return (
    <div className="horarios-screen">
      <PageHeader
        headingLevel={1}
        titleId={JORNADAS_TRABALHO_TITULO_ID}
        title="Jornadas de trabalho"
        description="Turnos reutilizáveis da empresa ativa: código, nome e os dias e horários de cada um. Dias e horários não mudam depois de criados; para mudar, crie uma nova jornada a partir de uma existente e inative a antiga."
        {...(podeOperar
          ? {
              actions: (
                <Button onClick={() => abrirNova(null)}>Nova jornada</Button>
              ),
            }
          : {})}
      />

      <Surface
        as="section"
        padding="md"
        className="horarios-screen__aviso"
        aria-labelledby="jornadas-aviso-texto"
      >
        <StatusBadge variant="info">
          {podeOperar ? "Operação do RH" : "Somente consulta"}
        </StatusBadge>
        <p id="jornadas-aviso-texto" className="horarios-screen__aviso-texto">
          {podeOperar
            ? "Só o RH cria, edita e inativa as jornadas da empresa. Inativar não apaga nada: a jornada continua no histórico. Cada operação fica na trilha de auditoria."
            : "Você consulta as jornadas da empresa ativa. Só o RH cria, edita e inativa jornadas."}
        </p>
      </Surface>

      {aviso ? (
        <p className="horarios-screen__sucesso" role="status">
          {aviso}
        </p>
      ) : null}

      {formulario ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__formulario"
          aria-labelledby={formTituloId}
        >
          <h2 id={formTituloId} className="horarios-screen__section-title">
            {formulario.jornada === null
              ? "Nova jornada"
              : `Editar jornada ${formulario.jornada.nome}`}
          </h2>
          <form
            className="horarios-screen__form"
            aria-labelledby={formTituloId}
            noValidate
            onSubmit={(e) => void salvar(e)}
          >
            <FormField
              id={ID_CODIGO}
              label="Código"
              required
              disabled={formulario.salvando}
              help="Letras maiúsculas, números e _ (2 a 32). Único na empresa."
              {...(formulario.erros.codigo
                ? { error: formulario.erros.codigo }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={32}
                  autoComplete="off"
                  placeholder="Ex.: COMERCIAL_44H"
                  value={formulario.codigo}
                  onChange={(e) =>
                    alterarForm(
                      { codigo: e.target.value.toUpperCase() },
                      "codigo",
                    )
                  }
                  {...control}
                />
              )}
            </FormField>

            <FormField
              id={ID_NOME}
              label="Nome"
              required
              disabled={formulario.salvando}
              help={`Até ${NOME_MAXIMO} caracteres.`}
              {...(formulario.erros.nome
                ? { error: formulario.erros.nome }
                : {})}
            >
              {(control) => (
                <input
                  type="text"
                  maxLength={NOME_MAXIMO}
                  autoComplete="off"
                  placeholder="Ex.: Comercial 44 horas"
                  value={formulario.nome}
                  onChange={(e) =>
                    alterarForm({ nome: e.target.value }, "nome")
                  }
                  {...control}
                />
              )}
            </FormField>

            <fieldset className="horarios-screen__periodos">
              <legend className="horarios-screen__section-title">
                Dias e horários
              </legend>
              {formulario.jornada === null ? (
                <>
                  <p className="horarios-screen__aviso-texto">
                    Formato 24 horas. Depois de criados, os dias e horários não
                    mudam. Sem nenhum período, a jornada fica sem horário
                    previsto.
                  </p>
                  {formulario.erros.periodos ? (
                    <p
                      id={ID_PERIODOS_ERRO}
                      className="horarios-screen__form-erro"
                      role="alert"
                      tabIndex={-1}
                    >
                      {formulario.erros.periodos}
                    </p>
                  ) : null}
                  {formulario.periodos.map((periodo, indice) => (
                    <div
                      key={periodo.uid}
                      className="horarios-screen__periodo-row"
                    >
                      <FormField
                        id={`jornadas-periodo-${periodo.uid}-dia`}
                        label={`Dia do período ${indice + 1}`}
                        disabled={formulario.salvando}
                      >
                        {(control) => (
                          <select
                            value={periodo.dia}
                            onChange={(e) =>
                              atualizarPeriodo(
                                periodo.uid,
                                "dia",
                                e.target.value,
                              )
                            }
                            {...control}
                          >
                            <option value="">Selecione</option>
                            {DIAS_SEMANA.map((d) => (
                              <option key={d.valor} value={d.valor}>
                                {d.rotulo}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                      <FormField
                        id={`jornadas-periodo-${periodo.uid}-inicio`}
                        label={`Entrada do período ${indice + 1}`}
                        disabled={formulario.salvando}
                      >
                        {(control) => (
                          <input
                            type="time"
                            value={periodo.inicio}
                            onChange={(e) =>
                              atualizarPeriodo(
                                periodo.uid,
                                "inicio",
                                e.target.value,
                              )
                            }
                            {...control}
                          />
                        )}
                      </FormField>
                      <FormField
                        id={`jornadas-periodo-${periodo.uid}-fim`}
                        label={`Saída do período ${indice + 1}`}
                        disabled={formulario.salvando}
                      >
                        {(control) => (
                          <input
                            type="time"
                            value={periodo.fim}
                            onChange={(e) =>
                              atualizarPeriodo(
                                periodo.uid,
                                "fim",
                                e.target.value,
                              )
                            }
                            {...control}
                          />
                        )}
                      </FormField>
                      <Button
                        type="button"
                        variant="subtle"
                        disabled={formulario.salvando}
                        onClick={() =>
                          alterarForm(
                            {
                              periodos: formulario.periodos.filter(
                                (p) => p.uid !== periodo.uid,
                              ),
                            },
                            "periodos",
                          )
                        }
                      >
                        Remover
                        <span className="sr-only"> o período {indice + 1}</span>
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={formulario.salvando}
                      onClick={() =>
                        alterarForm(
                          {
                            periodos: [
                              ...formulario.periodos,
                              { uid: novoUid(), dia: "", inicio: "", fim: "" },
                            ],
                          },
                          "periodos",
                        )
                      }
                    >
                      Adicionar período
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="horarios-screen__aviso-texto">
                    Dias e horários não mudam depois de criados. Para mudar, use
                    &quot;Nova jornada a partir desta&quot; e inative esta
                    jornada.
                  </p>
                  {formulario.jornada.periodos.length === 0 ? (
                    <p>Sem dias e horários.</p>
                  ) : (
                    <DataTable
                      caption={`Dias e horários — ${formulario.jornada.nome}`}
                      columns={colunasPeriodos}
                      rows={formulario.jornada.periodos}
                      rowKey={(p) => `${p.dia}-${p.inicio}-${p.fim}`}
                    />
                  )}
                </>
              )}
            </fieldset>

            {formulario.erros.geral ? (
              <p
                id={ID_ERRO_GERAL}
                className="horarios-screen__form-erro"
                role="alert"
                tabIndex={-1}
              >
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
                aria-disabled={formulario.salvando}
              >
                {formulario.salvando
                  ? "Salvando…"
                  : formulario.jornada === null
                    ? "Criar jornada"
                    : "Salvar alterações"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {detalhe ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__formulario"
          aria-labelledby={ID_DETALHE_TITULO}
        >
          <h2
            id={ID_DETALHE_TITULO}
            className="horarios-screen__section-title"
            tabIndex={-1}
          >
            {detalhe.tabela.nome}
          </h2>
          <dl className="horarios-screen__dados">
            <div>
              <dt>Código</dt>
              <dd>{detalhe.tabela.codigo ?? "Sem código"}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>
                <StatusBadge
                  variant={detalhe.tabela.ativo ? "success" : "neutral"}
                >
                  {detalhe.tabela.ativo ? "Ativa" : "Inativa"}
                </StatusBadge>
              </dd>
            </div>
          </dl>
          {detalhe.tabela.periodos.length === 0 ? (
            <p>Sem dias e horários.</p>
          ) : (
            <DataTable
              caption={`Dias e horários — ${detalhe.tabela.nome}`}
              columns={colunasPeriodos}
              rows={detalhe.tabela.periodos}
              rowKey={(p) => `${p.dia}-${p.inicio}-${p.fim}`}
            />
          )}
          {detalhe.erro ? (
            <p className="horarios-screen__form-erro" role="alert">
              {detalhe.erro}
            </p>
          ) : null}
          <FormActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDetalhe(null)}
              disabled={detalhe.alterando}
            >
              Fechar
            </Button>
            {podeOperar ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => abrirEdicao(detalhe.tabela)}
                  disabled={detalhe.alterando}
                >
                  Editar nome e código
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => abrirNova(detalhe.tabela)}
                  disabled={detalhe.alterando}
                >
                  Nova jornada a partir desta
                </Button>
                <Button
                  type="button"
                  variant={detalhe.tabela.ativo ? "secondary" : "primary"}
                  onClick={() => void alterarSituacao()}
                  aria-disabled={detalhe.alterando}
                >
                  {detalhe.alterando
                    ? detalhe.tabela.ativo
                      ? "Inativando…"
                      : "Reativando…"
                    : detalhe.tabela.ativo
                      ? "Inativar"
                      : "Reativar"}
                </Button>
              </>
            ) : null}
          </FormActions>
        </Surface>
      ) : null}

      {status === "erro" ? (
        <Surface
          as="section"
          padding="lg"
          className="horarios-screen__erro"
          aria-labelledby="jornadas-erro-titulo"
        >
          <StatusBadge variant="danger">Erro</StatusBadge>
          <h2
            id="jornadas-erro-titulo"
            className="horarios-screen__section-title"
          >
            Não foi possível carregar as jornadas de trabalho
          </h2>
          <p>Verifique sua conexão e tente novamente.</p>
          <Button
            variant="secondary"
            onClick={() => void carregar(filtroAtivo, buscaAplicada)}
          >
            Tentar novamente
          </Button>
        </Surface>
      ) : (
        <section aria-labelledby="jornadas-lista-titulo">
          <h2
            id="jornadas-lista-titulo"
            className="horarios-screen__section-title"
          >
            Jornadas da empresa
          </h2>

          <div className="horarios-screen__filtros">
            <form
              className="horarios-screen__busca"
              role="search"
              aria-label="Buscar jornadas"
              onSubmit={aplicarBusca}
            >
              <FormField id="jornadas-busca" label="Buscar por nome ou código">
                {(control) => (
                  <input
                    type="search"
                    maxLength={160}
                    autoComplete="off"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    {...control}
                  />
                )}
              </FormField>
              <div className="horarios-screen__busca-acoes">
                <Button type="submit" variant="secondary">
                  Buscar
                </Button>
                {buscaAplicada ? (
                  <Button type="button" variant="subtle" onClick={limparBusca}>
                    Limpar busca
                  </Button>
                ) : null}
              </div>
            </form>
            <FormField id="jornadas-filtro-ativo" label="Situação">
              {(control) => (
                <select
                  value={filtroAtivo}
                  onChange={(e) =>
                    setFiltroAtivo(e.target.value as FiltroAtivo)
                  }
                  {...control}
                >
                  <option value="todos">Todas</option>
                  <option value="ativo">Ativas</option>
                  <option value="inativo">Inativas</option>
                </select>
              )}
            </FormField>
          </div>

          {status === "carregando" ? (
            <p className="horarios-screen__carregando" role="status">
              Carregando jornadas…
            </p>
          ) : tabelas.length === 0 ? (
            temFiltro ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma jornada encontrada"
                description="Nenhuma jornada desta empresa corresponde à busca ou à situação escolhida."
              />
            ) : (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma jornada cadastrada"
                description={
                  podeOperar
                    ? "Crie a primeira jornada de trabalho desta empresa."
                    : "Esta empresa ainda não tem jornadas de trabalho. Só o RH as cadastra."
                }
                {...(podeOperar
                  ? {
                      action: (
                        <Button onClick={() => abrirNova(null)}>
                          Nova jornada
                        </Button>
                      ),
                    }
                  : {})}
              />
            )
          ) : (
            <>
              <DataTable
                caption="Jornadas de trabalho da empresa ativa"
                columns={colunas}
                rows={tabelas}
                rowKey={(t) => t.id}
              />
              {total > tabelas.length ? (
                <p className="horarios-screen__aviso-texto">
                  {`Mostrando ${tabelas.length} de ${total} jornadas. Use a busca para encontrar as demais.`}
                </p>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}
