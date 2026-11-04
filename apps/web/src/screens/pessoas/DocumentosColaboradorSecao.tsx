/**
 * T201 — aba "Documentos" da ficha do colaborador.
 *
 * Mostra os registros de documento e as solicitações de documento SÓ da
 * pessoa aberta, na empresa ativa da sessão. Sem conteúdo documental, por
 * construção (ADR 0011): nada de arquivo, upload, download, link ou
 * visualização — só o registro (tipo, situação e datas).
 *
 * Contratos que já existiam (os mesmos da visão coletiva de Pessoas >
 * Documentos), sem endpoint novo:
 * - `GET /v1/users/me` — o papel e a empresa ativa da SESSÃO;
 * - `GET /v1/tipos-documento` — rótulos e opções de tipo;
 * - `GET /v1/documentos?colaboradorId=` e
 *   `GET /v1/solicitacoes-documento?colaboradorId=` — as duas listas;
 * - `POST /v1/documentos`, `POST /v1/documentos/:id/substituicoes` e
 *   `POST /v1/solicitacoes-documento` — registrar, corrigir o tipo e
 *   solicitar (RH e DP).
 *
 * Empresa ativa (decisão F-4 da T201): sem ela — o `master_tecnico` global —,
 * a leitura de documentos do servidor é de todas as empresas; a aba não
 * consulta nada e orienta a escolher a empresa. Com ela, o servidor já
 * restringe à empresa da sessão, e a aba ainda descarta o que não for desta
 * pessoa nesta empresa.
 *
 * Quem opera (F-2): RH e DP, com empresa ativa — as mesmas ações da visão
 * coletiva. O `master_tecnico` só consulta, sem nenhum controle de escrita.
 * O servidor decide cada requisição.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, DataTable, FormField, StatusBadge } from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  ApiError,
  ROTULO_ESTADO_DOCUMENTO,
  ROTULO_ESTADO_SOLICITACAO,
  criarDocumento,
  criarSolicitacaoDocumento,
  listarDocumentos,
  listarSolicitacoesDocumento,
  listarTiposDocumento,
  substituirDocumento,
  type DocumentoMetadadoApi,
  type EstadoDocumento,
  type SolicitacaoDocumentoApi,
  type TipoDocumentoApi,
} from "../../api/documentosClient";
import { formatarInstante } from "../../format/data";
import { PaginacaoSimples } from "./PaginacaoSimples";
import "./DocumentosColaboradorSecao.css";

/** Itens por página de cada lista (o mesmo da visão coletiva). */
export const TAMANHO_PAGINA_DOCUMENTOS = 20;

const SEM_TIPOS: readonly TipoDocumentoApi[] = [];

/** Papéis que registram, corrigem o tipo e solicitam (F-2). */
const PAPEIS_QUE_OPERAM: readonly string[] = ["rh", "dp"];

const VARIANTE_ESTADO_DOC: Record<EstadoDocumento, StatusVariant> = {
  upload_desabilitado: "info",
  substituido: "neutral",
};

/** Falha com nova tentativa: o aviso e o botão ficam no lugar ao reler. */
interface Falha {
  readonly tipo: "erro";
  readonly relendo: boolean;
  readonly falhas: number;
}

function proximaFalha(anterior: { readonly tipo: string }): Falha {
  const falhas = anterior.tipo === "erro" ? (anterior as Falha).falhas : 0;
  return { tipo: "erro", relendo: false, falhas: falhas + 1 };
}

function emNovaLeitura<T extends { readonly tipo: string }>(anterior: T): T {
  return anterior.tipo === "erro" ? { ...anterior, relendo: true } : anterior;
}

type EstadoDaSessao =
  | { readonly tipo: "carregando" }
  | Falha
  | { readonly tipo: "sem-empresa" }
  | {
      readonly tipo: "pronta";
      readonly empresaId: string;
      readonly podeOperar: boolean;
    };

interface Pagina<T> {
  readonly itens: readonly T[];
  readonly pagina: number;
  readonly total: number;
}

type EstadoDoConteudo =
  | { readonly tipo: "carregando" }
  | Falha
  | {
      readonly tipo: "dados";
      readonly tipos: readonly TipoDocumentoApi[];
      readonly documentos: Pagina<DocumentoMetadadoApi>;
      readonly solicitacoes: Pagina<SolicitacaoDocumentoApi>;
    };

type Lista = "documentos" | "solicitacoes";

/** Troca de página em curso ou que falhou, por lista. */
interface TrocaDePagina {
  readonly pagina: number;
  readonly carregando: boolean;
  readonly falhas: number;
}

type Formulario =
  | {
      readonly modo: "registrar" | "solicitar";
      readonly tipoDocumentoId: string;
      readonly erroCampo: string | null;
      readonly erroGeral: string | null;
      readonly salvando: boolean;
    }
  | {
      readonly modo: "corrigir";
      readonly documento: DocumentoMetadadoApi;
      readonly tipoDocumentoId: string;
      readonly erroCampo: string | null;
      readonly erroGeral: string | null;
      readonly salvando: boolean;
    };

/** Recusa de uma gravação, em linguagem da tela; nunca o corpo do servidor. */
function mensagemDaRecusa(erro: unknown, modo: Formulario["modo"]): string {
  if (erro instanceof ApiError) {
    switch (erro.status) {
      case 409:
        return "Este documento já foi corrigido por outra pessoa. A lista foi atualizada; nada foi salvo.";
      case 404:
        return "Pessoa ou documento não encontrados na empresa ativa. Nada foi salvo.";
      case 403:
        return "Seu perfil não tem permissão para esta ação. Nada foi salvo.";
      case 400:
      case 422:
        return "O tipo escolhido foi recusado. Confira o tipo e tente de novo.";
      default:
        break;
    }
  }
  return modo === "solicitar"
    ? "Não foi possível confirmar se a solicitação foi registrada. Atualize a lista para conferir antes de tentar de novo."
    : "Não foi possível confirmar se o documento foi salvo. Atualize a lista para conferir antes de tentar de novo.";
}

export interface DocumentosColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly nomeColaborador: string;
  /** Formulário com tipo escolhido e não salvo: a guarda de saída pergunta. */
  readonly onAlteradoChange?: (alterado: boolean) => void;
  /** Gravação em curso: a guarda de saída espera. */
  readonly onSalvandoChange?: (salvando: boolean) => void;
}

export function DocumentosColaboradorSecao({
  colaboradorId,
  nomeColaborador,
  onAlteradoChange,
  onSalvandoChange,
}: DocumentosColaboradorSecaoProps) {
  const prefixo = useId();
  const ids = useMemo(
    () => ({
      titulo: `${prefixo}-titulo`,
      tituloDocumentos: `${prefixo}-documentos`,
      tituloSolicitacoes: `${prefixo}-solicitacoes`,
      campoTipo: `${prefixo}-tipo`,
      erroGeral: `${prefixo}-erro-geral`,
      novaTentativa: `${prefixo}-nova-tentativa`,
      registrar: `${prefixo}-registrar`,
      solicitar: `${prefixo}-solicitar`,
      corrigir: (documentoId: string) => `${prefixo}-corrigir-${documentoId}`,
    }),
    [prefixo],
  );

  const [sessao, setSessao] = useState<EstadoDaSessao>({ tipo: "carregando" });
  const [conteudo, setConteudo] = useState<EstadoDoConteudo>({
    tipo: "carregando",
  });
  const [trocas, setTrocas] = useState<
    Partial<Record<Lista, TrocaDePagina | null>>
  >({});
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; n: number } | null>(null);
  const salvandoRef = useRef(false);
  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);

  // Resposta atrasada (troca de pessoa, de página ou desmontagem): só vale a
  // requisição mais recente de cada leitura, e só com a seção montada.
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  const geracaoRef = useRef({ conteudo: 0, documentos: 0, solicitacoes: 0 });

  // ---- Sessão: papel e empresa ativa -----------------------------------------
  const carregarSessao = useCallback(
    async (novaLeitura = false) => {
      if (novaLeitura) setSessao(emNovaLeitura);
      else setSessao({ tipo: "carregando" });
      try {
        const ator = await obterUsuarioAtual();
        if (!vivaRef.current) return;
        const empresaId =
          typeof ator.companyId === "string" && ator.companyId.length > 0
            ? ator.companyId
            : null;
        if (novaLeitura) focoRef.current = ids.titulo;
        setSessao(
          empresaId === null
            ? { tipo: "sem-empresa" }
            : {
                tipo: "pronta",
                empresaId,
                podeOperar: PAPEIS_QUE_OPERAM.includes(ator.role),
              },
        );
      } catch {
        if (vivaRef.current) setSessao(proximaFalha);
      }
    },
    [ids],
  );

  useEffect(() => {
    void carregarSessao();
  }, [carregarSessao]);

  const empresaId = sessao.tipo === "pronta" ? sessao.empresaId : null;
  const podeOperar = sessao.tipo === "pronta" && sessao.podeOperar;

  /** Só o que é desta pessoa NESTA empresa — defesa além do servidor. */
  const daPessoa = useCallback(
    <T extends { colaboradorId: string; empresaId: string }>(
      itens: readonly T[],
    ): T[] =>
      itens.filter(
        (i) => i.colaboradorId === colaboradorId && i.empresaId === empresaId,
      ),
    [colaboradorId, empresaId],
  );

  // ---- Conteúdo: tipos e a primeira página das duas listas ------------------
  const carregarConteudo = useCallback(
    async (novaLeitura = false, focarEm: string | null = null) => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current.conteudo;
      // Uma leitura do conteúdo inteiro vence trocas de página em curso.
      geracaoRef.current.documentos++;
      geracaoRef.current.solicitacoes++;
      if (novaLeitura) setConteudo(emNovaLeitura);
      else if (focarEm === null) setConteudo({ tipo: "carregando" });
      try {
        const [tipos, documentos, solicitacoes] = await Promise.all([
          listarTiposDocumento({ tamanhoPagina: 100 }),
          listarDocumentos({
            colaboradorId,
            pagina: 1,
            tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
          }),
          listarSolicitacoesDocumento({
            colaboradorId,
            pagina: 1,
            tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
          }),
        ]);
        if (!vivaRef.current || geracao !== geracaoRef.current.conteudo) return;
        if (novaLeitura) focoRef.current = ids.titulo;
        if (focarEm !== null) focoRef.current = focarEm;
        setTrocas({});
        setConteudo({
          tipo: "dados",
          tipos: tipos.itens,
          documentos: {
            itens: daPessoa(documentos.itens),
            pagina: 1,
            total: documentos.total,
          },
          solicitacoes: {
            itens: daPessoa(solicitacoes.itens),
            pagina: 1,
            total: solicitacoes.total,
          },
        });
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current.conteudo) return;
        // Releitura depois de uma gravação: o botão que tinha o foco saiu;
        // o foco vai ao "Tentar de novo" que toma o lugar das listas.
        if (focarEm !== null) focoRef.current = ids.novaTentativa;
        setConteudo(proximaFalha);
      }
    },
    [colaboradorId, empresaId, daPessoa, ids],
  );

  useEffect(() => {
    if (empresaId === null) return;
    void carregarConteudo();
  }, [empresaId, carregarConteudo]);

  // ---- Troca de página de uma lista -----------------------------------------
  async function irParaPagina(lista: Lista, pagina: number) {
    if (conteudo.tipo !== "dados") return;
    const geracao = ++geracaoRef.current[lista];
    setTrocas((t) => ({
      ...t,
      [lista]: { pagina, carregando: true, falhas: t[lista]?.falhas ?? 0 },
    }));
    try {
      const consulta = {
        colaboradorId,
        pagina,
        tamanhoPagina: TAMANHO_PAGINA_DOCUMENTOS,
      };
      if (lista === "documentos") {
        const resposta = await listarDocumentos(consulta);
        if (!vivaRef.current || geracao !== geracaoRef.current[lista]) return;
        setConteudo((c) =>
          c.tipo === "dados"
            ? {
                ...c,
                documentos: {
                  itens: daPessoa(resposta.itens),
                  pagina,
                  total: resposta.total,
                },
              }
            : c,
        );
      } else {
        const resposta = await listarSolicitacoesDocumento(consulta);
        if (!vivaRef.current || geracao !== geracaoRef.current[lista]) return;
        setConteudo((c) =>
          c.tipo === "dados"
            ? {
                ...c,
                solicitacoes: {
                  itens: daPessoa(resposta.itens),
                  pagina,
                  total: resposta.total,
                },
              }
            : c,
        );
      }
      setTrocas((t) => ({ ...t, [lista]: null }));
    } catch {
      if (!vivaRef.current || geracao !== geracaoRef.current[lista]) return;
      setTrocas((t) => ({
        ...t,
        [lista]: {
          pagina,
          carregando: false,
          falhas: (t[lista]?.falhas ?? 0) + 1,
        },
      }));
    }
  }

  // ---- Foco depois do desenho -----------------------------------------------
  useEffect(() => {
    const id = focoRef.current;
    if (id === null) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    focoRef.current = null;
    alvo.focus();
  });

  // ---- Guarda de saída: formulário preenchido e gravação em curso -----------
  const preenchido =
    formulario !== null &&
    (formulario.tipoDocumentoId !== "" || formulario.salvando);
  useEffect(() => {
    onAlteradoChange?.(preenchido);
  }, [preenchido, onAlteradoChange]);
  const salvando = formulario?.salvando ?? false;
  useEffect(() => {
    onSalvandoChange?.(salvando);
  }, [salvando, onSalvandoChange]);
  // Ao sair (troca de pessoa ou desmontagem), nada fica pendurado na guarda.
  useEffect(
    () => () => {
      onAlteradoChange?.(false);
      onSalvandoChange?.(false);
    },
    [onAlteradoChange, onSalvandoChange],
  );

  const tipos = conteudo.tipo === "dados" ? conteudo.tipos : SEM_TIPOS;
  const mapaTipos = useMemo(() => {
    const mapa = new Map<string, TipoDocumentoApi>();
    for (const tipo of tipos) mapa.set(tipo.id, tipo);
    return mapa;
  }, [tipos]);

  function rotuloTipo(tipoId: string): string {
    const tipo = mapaTipos.get(tipoId);
    return tipo ? `${tipo.nome} (${tipo.codigo})` : "Tipo fora do catálogo";
  }

  // ---- Formulários ------------------------------------------------------------
  function abrir(modo: "registrar" | "solicitar"): void;
  function abrir(modo: "corrigir", documento: DocumentoMetadadoApi): void;
  function abrir(
    modo: Formulario["modo"],
    documento?: DocumentoMetadadoApi,
  ): void {
    setAviso(null);
    const base = {
      tipoDocumentoId: "",
      erroCampo: null,
      erroGeral: null,
      salvando: false,
    };
    setFormulario(
      modo === "corrigir" && documento
        ? { modo, documento, ...base }
        : { modo: modo === "solicitar" ? "solicitar" : "registrar", ...base },
    );
    focoRef.current = ids.campoTipo;
  }

  /** Quem abriu o formulário recebe o foco de volta ao cancelar. */
  function origemDo(f: Formulario): string {
    return f.modo === "corrigir"
      ? ids.corrigir(f.documento.id)
      : f.modo === "solicitar"
        ? ids.solicitar
        : ids.registrar;
  }

  function cancelar() {
    if (salvandoRef.current || formulario === null) return;
    // O "Corrigir tipo" de origem some se o registro já foi substituído
    // (conflito): o foco vai ao título do bloco.
    const origemSumiu =
      formulario.modo === "corrigir" &&
      !(
        conteudo.tipo === "dados" &&
        conteudo.documentos.itens.some(
          (d) => d.id === formulario.documento.id && d.estado !== "substituido",
        )
      );
    focoRef.current = origemSumiu ? ids.tituloDocumentos : origemDo(formulario);
    setFormulario(null);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (formulario === null || salvandoRef.current || empresaId === null) {
      return;
    }
    if (!formulario.tipoDocumentoId) {
      setFormulario({
        ...formulario,
        erroCampo: "Escolha o tipo do documento.",
        erroGeral: null,
      });
      focoRef.current = ids.campoTipo;
      return;
    }
    salvandoRef.current = true;
    setFormulario({
      ...formulario,
      salvando: true,
      erroCampo: null,
      erroGeral: null,
    });
    try {
      let texto: string;
      let titulo: string;
      if (formulario.modo === "registrar") {
        await criarDocumento({
          empresaId,
          colaboradorId,
          tipoDocumentoId: formulario.tipoDocumentoId,
        });
        texto = `Documento ${rotuloTipo(formulario.tipoDocumentoId)} registrado, sem arquivo.`;
        titulo = ids.tituloDocumentos;
      } else if (formulario.modo === "corrigir") {
        await substituirDocumento(
          formulario.documento.id,
          formulario.tipoDocumentoId,
        );
        texto = `Tipo corrigido para ${rotuloTipo(formulario.tipoDocumentoId)}. O registro anterior fica como substituído.`;
        titulo = ids.tituloDocumentos;
      } else {
        await criarSolicitacaoDocumento({
          empresaId,
          colaboradorId,
          tipoDocumentoId: formulario.tipoDocumentoId,
        });
        texto = `Solicitação de ${rotuloTipo(formulario.tipoDocumentoId)} registrada como pendente.`;
        titulo = ids.tituloSolicitacoes;
      }
      if (!vivaRef.current) return;
      setFormulario(null);
      setAviso((a) => ({ texto, n: (a?.n ?? 0) + 1 }));
      // As listas são relidas sem trocar por "Carregando…": o foco vai ao
      // título do bloco alterado quando a lista nova chega.
      await carregarConteudo(false, titulo);
    } catch (erro: unknown) {
      if (!vivaRef.current) return;
      const conflito = erro instanceof ApiError && erro.status === 409;
      setFormulario((f) =>
        f
          ? {
              ...f,
              salvando: false,
              erroGeral: mensagemDaRecusa(erro, f.modo),
            }
          : f,
      );
      focoRef.current = ids.erroGeral;
      // Corrigido por outra pessoa: a lista desatualizada é relida.
      if (conflito) void carregarConteudo(false, ids.erroGeral);
    } finally {
      salvandoRef.current = false;
    }
  }

  // ---- Desenho ----------------------------------------------------------------
  const cabecalho = (
    <>
      <h2
        id={ids.titulo}
        tabIndex={-1}
        className="ficha-colaborador__subtitulo"
      >
        Documentos
      </h2>
      <p className="documentos-colaborador__aviso">
        <StatusBadge variant="info">Somente registro</StatusBadge> O Evolli
        guarda só o registro do documento: tipo, situação e datas. Arquivo,
        envio, download e visualização não estão disponíveis.
      </p>
    </>
  );

  // Um aviso novo por gravação (a `key`): anunciado uma vez. Fica à vista
  // mesmo se a releitura das listas falhar — a gravação deu certo.
  const avisoDeGravacao = aviso ? (
    <p key={aviso.n} role="status" className="documentos-colaborador__sucesso">
      {aviso.texto}
    </p>
  ) : null;

  if (sessao.tipo !== "pronta") {
    return (
      <section
        className="ficha-colaborador__cartao documentos-colaborador"
        aria-labelledby={ids.titulo}
      >
        {cabecalho}
        {sessao.tipo === "carregando" ? (
          <p role="status">Carregando documentos…</p>
        ) : sessao.tipo === "sem-empresa" ? (
          <div className="documentos-colaborador__orientacao">
            <p className="ficha-colaborador__texto">
              Escolha uma empresa ativa para consultar os documentos de{" "}
              {nomeColaborador}.
            </p>
            <p className="ficha-colaborador__cartao-contexto">
              Sem empresa ativa, os documentos de empresas diferentes ficariam
              misturados. Use o seletor de empresa do menu.
            </p>
          </div>
        ) : (
          <FalhaComNovaTentativa
            id={ids.novaTentativa}
            falha={sessao}
            texto="Não foi possível conferir o seu acesso aos documentos."
            onTentar={() => void carregarSessao(true)}
          />
        )}
      </section>
    );
  }

  if (conteudo.tipo !== "dados") {
    return (
      <section
        className="ficha-colaborador__cartao documentos-colaborador"
        aria-labelledby={ids.titulo}
      >
        {cabecalho}
        {avisoDeGravacao}
        {conteudo.tipo === "carregando" ? (
          <p role="status">Carregando documentos…</p>
        ) : (
          <FalhaComNovaTentativa
            id={ids.novaTentativa}
            falha={conteudo}
            texto="Não foi possível carregar os documentos."
            onTentar={() => void carregarConteudo(true)}
          />
        )}
      </section>
    );
  }

  const semTipos = conteudo.tipos.length === 0;
  const formularioAberto = formulario !== null;

  const colunasDocumentos: DataTableColumn<DocumentoMetadadoApi>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (d) => rotuloTipo(d.tipoDocumentoId),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (d) => (
        <StatusBadge variant={VARIANTE_ESTADO_DOC[d.estado]}>
          {ROTULO_ESTADO_DOCUMENTO[d.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "registrado",
      header: "Registrado em",
      cell: (d) => formatarInstante(d.criadoEm),
    },
    ...(podeOperar
      ? [
          {
            key: "acoes",
            header: "Ações",
            cell: (d: DocumentoMetadadoApi) =>
              d.estado === "substituido" || formularioAberto ? null : (
                <Button
                  id={ids.corrigir(d.id)}
                  variant="secondary"
                  onClick={() => abrir("corrigir", d)}
                >
                  Corrigir tipo
                  <span className="ficha-colaborador__so-leitor">
                    {` de ${rotuloTipo(d.tipoDocumentoId)}, registrado em ${formatarInstante(d.criadoEm)}`}
                  </span>
                </Button>
              ),
          },
        ]
      : []),
  ];

  const colunasSolicitacoes: DataTableColumn<SolicitacaoDocumentoApi>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (s) => rotuloTipo(s.tipoDocumentoId),
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (s) => (
        <StatusBadge variant="warning">
          {ROTULO_ESTADO_SOLICITACAO[s.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "solicitada",
      header: "Solicitada em",
      cell: (s) => formatarInstante(s.solicitadaEm),
    },
  ];

  function formularioDoBloco(bloco: Lista) {
    if (formulario === null) return null;
    const doBloco =
      bloco === "solicitacoes"
        ? formulario.modo === "solicitar"
        : formulario.modo !== "solicitar";
    if (!doBloco) return null;
    const titulo =
      formulario.modo === "registrar"
        ? "Registrar documento"
        : formulario.modo === "corrigir"
          ? "Corrigir o tipo do documento"
          : "Solicitar documento";
    const opcoes =
      formulario.modo === "corrigir"
        ? conteudo.tipo === "dados"
          ? conteudo.tipos.filter(
              (t) => t.id !== formulario.documento.tipoDocumentoId,
            )
          : []
        : tipos;
    return (
      <form
        className="documentos-colaborador__form"
        aria-label={titulo}
        noValidate
        onSubmit={(e) => void salvar(e)}
      >
        {formulario.modo === "corrigir" ? (
          <p className="ficha-colaborador__cartao-contexto">
            {`Registro atual: ${rotuloTipo(formulario.documento.tipoDocumentoId)}, de ${formatarInstante(formulario.documento.criadoEm)}. Ele fica no histórico como substituído.`}
          </p>
        ) : null}
        <FormField
          id={ids.campoTipo}
          label={
            formulario.modo === "corrigir"
              ? "Tipo correto"
              : formulario.modo === "solicitar"
                ? "Tipo do documento a solicitar"
                : "Tipo do documento"
          }
          required
          disabled={formulario.salvando}
          {...(formulario.erroCampo ? { error: formulario.erroCampo } : {})}
        >
          {(control) => (
            <select
              value={formulario.tipoDocumentoId}
              onChange={(e) =>
                setFormulario((f) =>
                  f
                    ? {
                        ...f,
                        tipoDocumentoId: e.target.value,
                        erroCampo: null,
                      }
                    : f,
                )
              }
              {...control}
            >
              <option value="">Selecione</option>
              {opcoes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} ({t.codigo})
                </option>
              ))}
            </select>
          )}
        </FormField>
        {formulario.erroGeral ? (
          <p
            id={ids.erroGeral}
            tabIndex={-1}
            className="documentos-colaborador__erro"
          >
            {formulario.erroGeral}
          </p>
        ) : null}
        <div className="documentos-colaborador__acoes">
          <Button
            type="submit"
            variant="primary"
            aria-disabled={formulario.salvando}
          >
            {formulario.salvando
              ? "Salvando…"
              : formulario.modo === "corrigir"
                ? "Corrigir tipo"
                : formulario.modo === "solicitar"
                  ? "Solicitar"
                  : "Registrar"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-disabled={formulario.salvando}
            onClick={cancelar}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  function paginacao(lista: Lista, rotulo: string) {
    if (conteudo.tipo !== "dados") return null;
    const pagina = conteudo[lista];
    const troca = trocas[lista] ?? null;
    const totalPaginas = Math.max(
      1,
      Math.ceil(pagina.total / TAMANHO_PAGINA_DOCUMENTOS),
    );
    if (totalPaginas <= 1) return null;
    return (
      <>
        <PaginacaoSimples
          rotulo={rotulo}
          pagina={pagina.pagina}
          totalPaginas={totalPaginas}
          carregando={troca?.carregando === true}
          focoEstavel
          onIrPara={(p) => void irParaPagina(lista, p)}
        />
        {/* Região viva única da paginação (o componente, com foco estável,
            não anuncia a posição). Uma falha monta um alerta novo. */}
        {troca !== null && !troca.carregando ? (
          <p
            key={troca.falhas}
            role="alert"
            className="documentos-colaborador__erro"
          >
            {`Não foi possível carregar a página ${troca.pagina}. Use o mesmo botão para tentar de novo.`}
          </p>
        ) : (
          <p role="status" className="ficha-colaborador__so-leitor">
            {troca?.carregando
              ? `Carregando a página ${troca.pagina}…`
              : `Página ${pagina.pagina} de ${totalPaginas}.`}
          </p>
        )}
      </>
    );
  }

  return (
    <section
      className="ficha-colaborador__cartao documentos-colaborador"
      aria-labelledby={ids.titulo}
    >
      {cabecalho}
      {podeOperar ? null : (
        <p className="ficha-colaborador__cartao-contexto">
          Somente consulta: registrar, corrigir o tipo e solicitar documento são
          ações do RH e do DP.
        </p>
      )}
      {avisoDeGravacao}
      {podeOperar && semTipos ? (
        <p className="ficha-colaborador__cartao-contexto">
          Não há tipos de documento cadastrados na empresa ativa; registrar e
          solicitar ficam indisponíveis até haver um.
        </p>
      ) : null}

      <section
        className="documentos-colaborador__bloco"
        aria-labelledby={ids.tituloDocumentos}
      >
        <div className="documentos-colaborador__bloco-topo">
          <h3
            id={ids.tituloDocumentos}
            tabIndex={-1}
            className="ficha-colaborador__cartao-titulo"
          >
            Documentos registrados
          </h3>
          {podeOperar && !formularioAberto && !semTipos ? (
            <Button
              id={ids.registrar}
              variant="secondary"
              onClick={() => abrir("registrar")}
            >
              Registrar documento
            </Button>
          ) : null}
        </div>
        {formularioDoBloco("documentos")}
        {conteudo.documentos.itens.length === 0 ? (
          <p className="ficha-colaborador__texto">
            {`Ainda não há documentos registrados para ${nomeColaborador}.`}
          </p>
        ) : (
          <div className="ficha-colaborador__quadro">
            <DataTable
              caption={`Documentos registrados — ${nomeColaborador}`}
              columns={colunasDocumentos}
              rows={[...conteudo.documentos.itens]}
              rowKey={(d) => d.id}
            />
          </div>
        )}
        {paginacao("documentos", "Páginas de documentos registrados")}
      </section>

      <section
        className="documentos-colaborador__bloco"
        aria-labelledby={ids.tituloSolicitacoes}
      >
        <div className="documentos-colaborador__bloco-topo">
          <h3
            id={ids.tituloSolicitacoes}
            tabIndex={-1}
            className="ficha-colaborador__cartao-titulo"
          >
            Solicitações de documento
          </h3>
          {podeOperar && !formularioAberto && !semTipos ? (
            <Button
              id={ids.solicitar}
              variant="secondary"
              onClick={() => abrir("solicitar")}
            >
              Solicitar documento
            </Button>
          ) : null}
        </div>
        {formularioDoBloco("solicitacoes")}
        {conteudo.solicitacoes.itens.length === 0 ? (
          <p className="ficha-colaborador__texto">
            {`Ainda não há solicitações de documento para ${nomeColaborador}.`}
          </p>
        ) : (
          <div className="ficha-colaborador__quadro">
            <DataTable
              caption={`Solicitações de documento — ${nomeColaborador}`}
              columns={colunasSolicitacoes}
              rows={[...conteudo.solicitacoes.itens]}
              rowKey={(s) => s.id}
            />
          </div>
        )}
        {paginacao("solicitacoes", "Páginas de solicitações de documento")}
      </section>
    </section>
  );
}

/**
 * Aviso de falha com o botão de nova tentativa. Durante a nova leitura o
 * botão fica no lugar, focado, com `aria-disabled`; cada falha monta um
 * alerta novo (a `key`), anunciado uma vez.
 */
function FalhaComNovaTentativa({
  id,
  falha,
  texto,
  onTentar,
}: {
  readonly id: string;
  readonly falha: Falha;
  readonly texto: string;
  readonly onTentar: () => void;
}) {
  return (
    <div className="ficha-colaborador__aviso">
      <p key={falha.falhas} role="alert" className="ficha-colaborador__texto">
        {texto}
      </p>
      <Button
        id={id}
        variant="secondary"
        aria-disabled={falha.relendo}
        onClick={() => {
          if (!falha.relendo) onTentar();
        }}
      >
        Tentar de novo
      </Button>
    </div>
  );
}
