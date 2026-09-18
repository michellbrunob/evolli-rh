/**
 * Pessoas > Documentos (T133) — interface FUNCIONAL de metadados e solicitações,
 * conectada exclusivamente aos contratos reais de `apps/api/src/documentos/`.
 *
 * **Sem conteúdo documental, por construção** (ADR 0011): esta tela nunca
 * recebe, exibe, envia, baixa, pré-visualiza, assina, retém ou linka arquivo,
 * upload, download, base64, blob ou storage. Ela opera só sobre **metadados**
 * (identificadores técnicos, estado e datas) e **solicitações** (pedidos).
 *
 * Contratos usados (nenhum inventado):
 * - `GET /v1/documentos` (lista, filtros colaborador/tipo/estado) e
 *   `GET /v1/documentos/:id` (detalhe só leitura).
 * - `POST /v1/documentos` (registra metadado) e
 *   `POST /v1/documentos/:id/substituicoes` (corrige o tipo, preserva histórico;
 *   409 se já substituído). Não há transição de estado além dessa; sem DELETE.
 * - `GET/POST /v1/solicitacoes-documento` (lista/detalhe/solicitar). A
 *   solicitação permanece `pendente` — não há transição de estado na V1.
 * - `GET /v1/tipos-documento` (catálogo, leitura) para rótulos e seletores.
 * - `GET /v1/colaboradores` (+ vínculos) para escolher o sujeito autorizado.
 *
 * **Backend é a autoridade final.** O escopo/RBAC não são inferidos aqui: o
 * `empresaId` das mutações vem de `GET /v1/users/me` só para preencher o campo
 * que o servidor reconfere contra a sessão (divergência → 404). Recurso de
 * outra empresa some das listas e responde 404 no detalhe (anti-enumeração).
 */
import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
  obterUsuarioAtual,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import {
  listarColaboradores,
  listarVinculosDoColaborador,
  type ColaboradorApi,
  type VinculoApi,
} from "../../api/colaboradoresClient";
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
import "./PessoasDocumentosScreen.css";

export const PESSOAS_DOCUMENTOS_TITULO_ID = "pessoas-documentos-titulo";

const TAMANHO_PAGINA = 20;
const OPCAO_TODOS = "todos";

const VARIANTE_ESTADO_DOC: Record<EstadoDocumento, StatusVariant> = {
  upload_desabilitado: "info",
  substituido: "neutral",
};

type StatusCarregamento = "carregando" | "erro" | "pronto";

function formatarData(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

/** Papéis que podem mutar documentos (RH e DP); backend reconfere. */
function podeMutar(ator: SafeAccessUserApi | null): boolean {
  return (
    ator !== null &&
    (ator.role === "rh" || ator.role === "dp") &&
    typeof ator.companyId === "string" &&
    ator.companyId.length > 0
  );
}

interface FormularioTipoState {
  tipoDocumentoId: string;
  salvando: boolean;
  erro: string | null;
}

export function PessoasDocumentosScreen() {
  const [ator, setAtor] = useState<SafeAccessUserApi | null>(null);

  const [tipos, setTipos] = useState<TipoDocumentoApi[]>([]);
  const [statusTipos, setStatusTipos] =
    useState<StatusCarregamento>("carregando");

  const [colaboradores, setColaboradores] = useState<ColaboradorApi[]>([]);
  const [statusColaboradores, setStatusColaboradores] =
    useState<StatusCarregamento>("carregando");
  const [colaboradorId, setColaboradorId] = useState<string>("");

  const [vinculos, setVinculos] = useState<VinculoApi[]>([]);
  const [statusVinculos, setStatusVinculos] =
    useState<StatusCarregamento>("carregando");

  const [documentos, setDocumentos] = useState<DocumentoMetadadoApi[]>([]);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [paginaDocumentos, setPaginaDocumentos] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState<string>(OPCAO_TODOS);
  const [filtroTipo, setFiltroTipo] = useState<string>(OPCAO_TODOS);
  const [statusDocumentos, setStatusDocumentos] =
    useState<StatusCarregamento>("carregando");

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoDocumentoApi[]>(
    [],
  );
  const [totalSolicitacoes, setTotalSolicitacoes] = useState(0);
  const [paginaSolicitacoes, setPaginaSolicitacoes] = useState(1);
  const [statusSolicitacoes, setStatusSolicitacoes] =
    useState<StatusCarregamento>("carregando");

  const [detalheDoc, setDetalheDoc] = useState<DocumentoMetadadoApi | null>(
    null,
  );
  const [detalheSolic, setDetalheSolic] =
    useState<SolicitacaoDocumentoApi | null>(null);

  const [formCriarDoc, setFormCriarDoc] = useState<FormularioTipoState | null>(
    null,
  );
  const [formSubstituir, setFormSubstituir] = useState<
    (FormularioTipoState & { documentoId: string }) | null
  >(null);
  const [formSolicitar, setFormSolicitar] =
    useState<FormularioTipoState | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const tituloDetalheDocId = useId();
  const tituloDetalheSolicId = useId();
  const tituloFormId = useId();

  const mapaTipos = useMemo(() => {
    const mapa = new Map<string, TipoDocumentoApi>();
    for (const tipo of tipos) mapa.set(tipo.id, tipo);
    return mapa;
  }, [tipos]);

  function rotuloTipo(tipoId: string): string {
    const tipo = mapaTipos.get(tipoId);
    return tipo ? `${tipo.nome} (${tipo.codigo})` : "Tipo fora do catálogo";
  }

  // ---- Carregamentos base (ator, tipos, colaboradores) --------------------

  const carregarAtor = useCallback(async () => {
    try {
      setAtor(await obterUsuarioAtual());
    } catch {
      // Falha ao identificar o ator → sem capacidade de mutação (seguro). As
      // ações de mutação simplesmente não aparecem; leitura segue tentando.
      setAtor(null);
    }
  }, []);

  const carregarTipos = useCallback(async () => {
    setStatusTipos("carregando");
    try {
      const res = await listarTiposDocumento({ tamanhoPagina: 100 });
      setTipos(res.itens);
      setStatusTipos("pronto");
    } catch {
      setStatusTipos("erro");
    }
  }, []);

  const carregarColaboradores = useCallback(async () => {
    setStatusColaboradores("carregando");
    try {
      const res = await listarColaboradores({ tamanhoPagina: 100 });
      setColaboradores(res.itens);
      // Zero/múltiplas opções: nunca seleciona em silêncio. Exatamente uma:
      // seleciona a única (não é escolha silenciosa entre várias).
      setColaboradorId((atual) => {
        if (atual) return atual;
        return res.itens.length === 1 ? res.itens[0]!.id : "";
      });
      setStatusColaboradores("pronto");
    } catch {
      setStatusColaboradores("erro");
    }
  }, []);

  useEffect(() => {
    void carregarAtor();
    void carregarTipos();
    void carregarColaboradores();
  }, [carregarAtor, carregarTipos, carregarColaboradores]);

  // ---- Carregamentos dependentes do colaborador selecionado ---------------

  const carregarVinculos = useCallback(async (id: string) => {
    setStatusVinculos("carregando");
    try {
      setVinculos(await listarVinculosDoColaborador(id));
      setStatusVinculos("pronto");
    } catch {
      setStatusVinculos("erro");
    }
  }, []);

  const carregarDocumentos = useCallback(
    async (id: string, pagina: number, estado: string, tipo: string) => {
      setStatusDocumentos("carregando");
      try {
        const res = await listarDocumentos({
          colaboradorId: id,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
          ...(estado !== OPCAO_TODOS
            ? { estado: estado as EstadoDocumento }
            : {}),
          ...(tipo !== OPCAO_TODOS ? { tipoDocumentoId: tipo } : {}),
        });
        setDocumentos(res.itens);
        setTotalDocumentos(res.total);
        setStatusDocumentos("pronto");
      } catch {
        setStatusDocumentos("erro");
      }
    },
    [],
  );

  const carregarSolicitacoes = useCallback(
    async (id: string, pagina: number) => {
      setStatusSolicitacoes("carregando");
      try {
        const res = await listarSolicitacoesDocumento({
          colaboradorId: id,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        });
        setSolicitacoes(res.itens);
        setTotalSolicitacoes(res.total);
        setStatusSolicitacoes("pronto");
      } catch {
        setStatusSolicitacoes("erro");
      }
    },
    [],
  );

  useEffect(() => {
    if (!colaboradorId) return;
    void carregarVinculos(colaboradorId);
  }, [colaboradorId, carregarVinculos]);

  useEffect(() => {
    if (!colaboradorId) return;
    void carregarDocumentos(
      colaboradorId,
      paginaDocumentos,
      filtroEstado,
      filtroTipo,
    );
  }, [
    colaboradorId,
    paginaDocumentos,
    filtroEstado,
    filtroTipo,
    carregarDocumentos,
  ]);

  useEffect(() => {
    if (!colaboradorId) return;
    void carregarSolicitacoes(colaboradorId, paginaSolicitacoes);
  }, [colaboradorId, paginaSolicitacoes, carregarSolicitacoes]);

  function selecionarColaborador(id: string) {
    setColaboradorId(id);
    setPaginaDocumentos(1);
    setPaginaSolicitacoes(1);
    setFiltroEstado(OPCAO_TODOS);
    setFiltroTipo(OPCAO_TODOS);
    setDetalheDoc(null);
    setDetalheSolic(null);
    setMensagemSucesso(null);
  }

  function mensagemErroMutacao(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return "Este documento já foi substituído. Atualize a lista e parta do registro atual.";
      }
      if (err.status === 404) {
        return "Recurso não encontrado no seu escopo. Atualize a lista e tente novamente.";
      }
      if (err.status === 403) {
        return "Você não tem permissão para esta ação.";
      }
      if (err.status === 422 || err.status === 400) {
        return "Dados inválidos para esta operação. Confira o tipo selecionado.";
      }
      return "Não foi possível concluir a operação. Tente novamente em instantes.";
    }
    return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
  }

  function empresaIdMutacao(): string | null {
    return ator && typeof ator.companyId === "string" ? ator.companyId : null;
  }

  // ---- Mutações -----------------------------------------------------------

  async function submeterCriarDoc(evento: React.FormEvent) {
    evento.preventDefault();
    const empresaId = empresaIdMutacao();
    if (!formCriarDoc || formCriarDoc.salvando || !empresaId) return;
    if (!formCriarDoc.tipoDocumentoId) {
      setFormCriarDoc({ ...formCriarDoc, erro: "Selecione um tipo." });
      return;
    }
    setFormCriarDoc({ ...formCriarDoc, salvando: true, erro: null });
    try {
      await criarDocumento({
        empresaId,
        colaboradorId,
        tipoDocumentoId: formCriarDoc.tipoDocumentoId,
      });
      setFormCriarDoc(null);
      setMensagemSucesso("Documento registrado (sem conteúdo).");
      await carregarDocumentos(
        colaboradorId,
        paginaDocumentos,
        filtroEstado,
        filtroTipo,
      );
    } catch (err) {
      setFormCriarDoc({
        ...formCriarDoc,
        salvando: false,
        erro: mensagemErroMutacao(err),
      });
    }
  }

  async function submeterSubstituir(evento: React.FormEvent) {
    evento.preventDefault();
    if (!formSubstituir || formSubstituir.salvando) return;
    if (!formSubstituir.tipoDocumentoId) {
      setFormSubstituir({ ...formSubstituir, erro: "Selecione um tipo." });
      return;
    }
    setFormSubstituir({ ...formSubstituir, salvando: true, erro: null });
    try {
      await substituirDocumento(
        formSubstituir.documentoId,
        formSubstituir.tipoDocumentoId,
      );
      setFormSubstituir(null);
      setMensagemSucesso(
        "Documento substituído; o registro anterior foi preservado.",
      );
      await carregarDocumentos(
        colaboradorId,
        paginaDocumentos,
        filtroEstado,
        filtroTipo,
      );
    } catch (err) {
      setFormSubstituir({
        ...formSubstituir,
        salvando: false,
        erro: mensagemErroMutacao(err),
      });
    }
  }

  async function submeterSolicitar(evento: React.FormEvent) {
    evento.preventDefault();
    const empresaId = empresaIdMutacao();
    if (!formSolicitar || formSolicitar.salvando || !empresaId) return;
    if (!formSolicitar.tipoDocumentoId) {
      setFormSolicitar({ ...formSolicitar, erro: "Selecione um tipo." });
      return;
    }
    setFormSolicitar({ ...formSolicitar, salvando: true, erro: null });
    try {
      await criarSolicitacaoDocumento({
        empresaId,
        colaboradorId,
        tipoDocumentoId: formSolicitar.tipoDocumentoId,
      });
      setFormSolicitar(null);
      setMensagemSucesso("Solicitação registrada (pendente).");
      await carregarSolicitacoes(colaboradorId, paginaSolicitacoes);
    } catch (err) {
      setFormSolicitar({
        ...formSolicitar,
        salvando: false,
        erro: mensagemErroMutacao(err),
      });
    }
  }

  const mutavel = podeMutar(ator);
  const semTipos = statusTipos === "pronto" && tipos.length === 0;

  const colunasDocumentos: DataTableColumn<DocumentoMetadadoApi>[] = [
    {
      key: "tipo",
      header: "Tipo documental",
      cell: (d) => rotuloTipo(d.tipoDocumentoId),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (d) => (
        <StatusBadge variant={VARIANTE_ESTADO_DOC[d.estado]}>
          {ROTULO_ESTADO_DOCUMENTO[d.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "criado",
      header: "Registrado em",
      cell: (d) => formatarData(d.criadoEm),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (d) => (
        <div className="pessoas-documentos-screen__acoes-linha">
          <Button variant="subtle" onClick={() => setDetalheDoc(d)}>
            Ver detalhe
            <span className="sr-only"> do documento</span>
          </Button>
          {mutavel && d.estado !== "substituido" ? (
            <Button
              variant="secondary"
              onClick={() => {
                setFormSubstituir({
                  documentoId: d.id,
                  tipoDocumentoId: "",
                  salvando: false,
                  erro: null,
                });
                setMensagemSucesso(null);
              }}
            >
              Substituir
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const colunasSolicitacoes: DataTableColumn<SolicitacaoDocumentoApi>[] = [
    {
      key: "tipo",
      header: "Tipo documental",
      cell: (s) => rotuloTipo(s.tipoDocumentoId),
    },
    {
      key: "estado",
      header: "Estado",
      cell: (s) => (
        <StatusBadge variant="warning">
          {ROTULO_ESTADO_SOLICITACAO[s.estado]}
        </StatusBadge>
      ),
    },
    {
      key: "solicitada",
      header: "Solicitada em",
      cell: (s) => formatarData(s.solicitadaEm),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (s) => (
        <Button variant="subtle" onClick={() => setDetalheSolic(s)}>
          Ver detalhe
          <span className="sr-only"> da solicitação</span>
        </Button>
      ),
    },
  ];

  const totalPaginasDoc = Math.max(
    1,
    Math.ceil(totalDocumentos / TAMANHO_PAGINA),
  );
  const totalPaginasSolic = Math.max(
    1,
    Math.ceil(totalSolicitacoes / TAMANHO_PAGINA),
  );

  return (
    <div className="pessoas-documentos-screen">
      <PageHeader
        headingLevel={1}
        titleId={PESSOAS_DOCUMENTOS_TITULO_ID}
        title="Documentos"
        description="Metadados e solicitações de documento do colaborador — sem conteúdo, upload, download ou visualização de arquivo (ADR 0011). Escopo e permissões são decididos pelo servidor."
      />

      <Surface
        as="section"
        padding="md"
        className="pessoas-documentos-screen__aviso"
        aria-labelledby="pessoas-documentos-aviso-titulo"
      >
        <StatusBadge variant="info">Somente metadados</StatusBadge>
        <p
          id="pessoas-documentos-aviso-titulo"
          className="pessoas-documentos-screen__aviso-texto"
        >
          Esta tela registra e consulta o documento como referência técnica
          (tipo, estado e datas). Não há arquivo, upload, download, link ou
          conteúdo — a substituição corrige o tipo e preserva o histórico, sem
          apagar.
        </p>
      </Surface>

      {mensagemSucesso ? (
        <p className="pessoas-documentos-screen__sucesso" role="status">
          {mensagemSucesso}
        </p>
      ) : null}

      {/* Seleção de colaborador ------------------------------------------- */}
      <section
        aria-labelledby="pessoas-documentos-colaborador-titulo"
        className="pessoas-documentos-screen__secao"
      >
        <h2
          id="pessoas-documentos-colaborador-titulo"
          className="pessoas-documentos-screen__section-title"
        >
          Colaborador
        </h2>

        {statusColaboradores === "carregando" ? (
          <p role="status">Carregando colaboradores…</p>
        ) : statusColaboradores === "erro" ? (
          <Surface
            as="div"
            padding="md"
            className="pessoas-documentos-screen__erro"
          >
            <p role="alert">Não foi possível carregar os colaboradores.</p>
            <Button
              variant="secondary"
              onClick={() => void carregarColaboradores()}
            >
              Tentar novamente
            </Button>
          </Surface>
        ) : colaboradores.length === 0 ? (
          <EmptyState
            headingLevel={3}
            icon="—"
            title="Nenhum colaborador no seu escopo"
            description="Quando houver um colaborador com vínculo na sua empresa, ele aparece aqui."
          />
        ) : (
          <FormField
            id="pessoas-documentos-colaborador"
            label="Selecione o colaborador"
          >
            {(control) => (
              <select
                value={colaboradorId}
                onChange={(e) => selecionarColaborador(e.target.value)}
                {...control}
              >
                <option value="">Selecione…</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        )}

        {colaboradorId ? (
          <div className="pessoas-documentos-screen__vinculos">
            <h3 className="pessoas-documentos-screen__subtitulo">
              Vínculos (relação autorizada)
            </h3>
            {statusVinculos === "carregando" ? (
              <p role="status">Carregando vínculos…</p>
            ) : statusVinculos === "erro" ? (
              <p role="alert">Não foi possível carregar os vínculos.</p>
            ) : vinculos.length === 0 ? (
              <p>Sem vínculo nesta empresa para este colaborador.</p>
            ) : (
              <ul className="pessoas-documentos-screen__vinculos-lista">
                {vinculos.map((v) => (
                  <li key={v.id}>
                    {v.tipo} · {v.situacao} · matrícula {v.matricula}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {colaboradorId ? (
        <>
          {/* Metadados -------------------------------------------------- */}
          <section
            aria-labelledby="pessoas-documentos-lista-titulo"
            className="pessoas-documentos-screen__secao"
          >
            <div className="pessoas-documentos-screen__secao-cabecalho">
              <h2
                id="pessoas-documentos-lista-titulo"
                className="pessoas-documentos-screen__section-title"
              >
                Documentos do colaborador
              </h2>
              {mutavel ? (
                <Button
                  onClick={() => {
                    setFormCriarDoc({
                      tipoDocumentoId: "",
                      salvando: false,
                      erro: null,
                    });
                    setMensagemSucesso(null);
                  }}
                  disabled={semTipos}
                >
                  Registrar documento
                </Button>
              ) : null}
            </div>

            <div className="pessoas-documentos-screen__filtros">
              <FormField id="pessoas-documentos-filtro-estado" label="Estado">
                {(control) => (
                  <select
                    value={filtroEstado}
                    onChange={(e) => {
                      setFiltroEstado(e.target.value);
                      setPaginaDocumentos(1);
                    }}
                    {...control}
                  >
                    <option value={OPCAO_TODOS}>Todos os estados</option>
                    {(
                      Object.keys(ROTULO_ESTADO_DOCUMENTO) as EstadoDocumento[]
                    ).map((estado) => (
                      <option key={estado} value={estado}>
                        {ROTULO_ESTADO_DOCUMENTO[estado]}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField
                id="pessoas-documentos-filtro-tipo"
                label="Tipo documental"
              >
                {(control) => (
                  <select
                    value={filtroTipo}
                    onChange={(e) => {
                      setFiltroTipo(e.target.value);
                      setPaginaDocumentos(1);
                    }}
                    {...control}
                  >
                    <option value={OPCAO_TODOS}>Todos os tipos</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome} ({t.codigo})
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>

            {statusDocumentos === "carregando" ? (
              <p role="status">Carregando documentos…</p>
            ) : statusDocumentos === "erro" ? (
              <Surface
                as="div"
                padding="md"
                className="pessoas-documentos-screen__erro"
              >
                <p role="alert">Não foi possível carregar os documentos.</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void carregarDocumentos(
                      colaboradorId,
                      paginaDocumentos,
                      filtroEstado,
                      filtroTipo,
                    )
                  }
                >
                  Tentar novamente
                </Button>
              </Surface>
            ) : documentos.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhum documento para este colaborador"
                description="Registre um metadado de documento (sem conteúdo) ou ajuste os filtros."
              />
            ) : (
              <>
                <DataTable
                  caption="Documentos do colaborador"
                  columns={colunasDocumentos}
                  rows={documentos}
                  rowKey={(d) => d.id}
                />
                <div className="pessoas-documentos-screen__paginacao">
                  <Button
                    variant="subtle"
                    disabled={paginaDocumentos <= 1}
                    onClick={() =>
                      setPaginaDocumentos((p) => Math.max(1, p - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <span aria-live="polite">
                    Página {paginaDocumentos} de {totalPaginasDoc}
                  </span>
                  <Button
                    variant="subtle"
                    disabled={paginaDocumentos >= totalPaginasDoc}
                    onClick={() => setPaginaDocumentos((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Solicitações ---------------------------------------------- */}
          <section
            aria-labelledby="pessoas-documentos-solic-titulo"
            className="pessoas-documentos-screen__secao"
          >
            <div className="pessoas-documentos-screen__secao-cabecalho">
              <h2
                id="pessoas-documentos-solic-titulo"
                className="pessoas-documentos-screen__section-title"
              >
                Solicitações de documento
              </h2>
              {mutavel ? (
                <Button
                  onClick={() => {
                    setFormSolicitar({
                      tipoDocumentoId: "",
                      salvando: false,
                      erro: null,
                    });
                    setMensagemSucesso(null);
                  }}
                  disabled={semTipos}
                >
                  Solicitar documento
                </Button>
              ) : null}
            </div>

            {statusSolicitacoes === "carregando" ? (
              <p role="status">Carregando solicitações…</p>
            ) : statusSolicitacoes === "erro" ? (
              <Surface
                as="div"
                padding="md"
                className="pessoas-documentos-screen__erro"
              >
                <p role="alert">Não foi possível carregar as solicitações.</p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    void carregarSolicitacoes(colaboradorId, paginaSolicitacoes)
                  }
                >
                  Tentar novamente
                </Button>
              </Surface>
            ) : solicitacoes.length === 0 ? (
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma solicitação para este colaborador"
                description="Solicite um documento (pedido, sem conteúdo) para acompanhá-lo aqui."
              />
            ) : (
              <>
                <DataTable
                  caption="Solicitações de documento do colaborador"
                  columns={colunasSolicitacoes}
                  rows={solicitacoes}
                  rowKey={(s) => s.id}
                />
                <div className="pessoas-documentos-screen__paginacao">
                  <Button
                    variant="subtle"
                    disabled={paginaSolicitacoes <= 1}
                    onClick={() =>
                      setPaginaSolicitacoes((p) => Math.max(1, p - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <span aria-live="polite">
                    Página {paginaSolicitacoes} de {totalPaginasSolic}
                  </span>
                  <Button
                    variant="subtle"
                    disabled={paginaSolicitacoes >= totalPaginasSolic}
                    onClick={() => setPaginaSolicitacoes((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {/* Formulário: registrar documento --------------------------------- */}
      {formCriarDoc ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-documentos-screen__form"
          aria-labelledby={tituloFormId}
        >
          <h2
            id={tituloFormId}
            className="pessoas-documentos-screen__section-title"
          >
            Registrar documento (sem conteúdo)
          </h2>
          <form onSubmit={(e) => void submeterCriarDoc(e)}>
            <FormField
              id="pessoas-documentos-criar-tipo"
              label="Tipo do documento a registrar"
              required
              {...(formCriarDoc.erro ? { error: formCriarDoc.erro } : {})}
            >
              {(control) => (
                <select
                  value={formCriarDoc.tipoDocumentoId}
                  onChange={(e) =>
                    setFormCriarDoc({
                      ...formCriarDoc,
                      tipoDocumentoId: e.target.value,
                      erro: null,
                    })
                  }
                  {...control}
                >
                  <option value="">Selecione o tipo…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.codigo})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormCriarDoc(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={formCriarDoc.salvando}>
                {formCriarDoc.salvando ? "Registrando…" : "Registrar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {/* Formulário: substituir ------------------------------------------ */}
      {formSubstituir ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-documentos-screen__form"
          aria-labelledby={`${tituloFormId}-sub`}
        >
          <h2
            id={`${tituloFormId}-sub`}
            className="pessoas-documentos-screen__section-title"
          >
            Substituir documento (corrige o tipo, preserva o histórico)
          </h2>
          <form onSubmit={(e) => void submeterSubstituir(e)}>
            <FormField
              id="pessoas-documentos-sub-tipo"
              label="Novo tipo documental"
              required
              {...(formSubstituir.erro ? { error: formSubstituir.erro } : {})}
            >
              {(control) => (
                <select
                  value={formSubstituir.tipoDocumentoId}
                  onChange={(e) =>
                    setFormSubstituir({
                      ...formSubstituir,
                      tipoDocumentoId: e.target.value,
                      erro: null,
                    })
                  }
                  {...control}
                >
                  <option value="">Selecione o tipo…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.codigo})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormSubstituir(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={formSubstituir.salvando}>
                {formSubstituir.salvando
                  ? "Substituindo…"
                  : "Confirmar substituição"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {/* Formulário: solicitar ------------------------------------------- */}
      {formSolicitar ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-documentos-screen__form"
          aria-labelledby={`${tituloFormId}-sol`}
        >
          <h2
            id={`${tituloFormId}-sol`}
            className="pessoas-documentos-screen__section-title"
          >
            Solicitar documento (pedido, sem conteúdo)
          </h2>
          <form onSubmit={(e) => void submeterSolicitar(e)}>
            <FormField
              id="pessoas-documentos-solic-tipo"
              label="Tipo do documento a solicitar"
              required
              {...(formSolicitar.erro ? { error: formSolicitar.erro } : {})}
            >
              {(control) => (
                <select
                  value={formSolicitar.tipoDocumentoId}
                  onChange={(e) =>
                    setFormSolicitar({
                      ...formSolicitar,
                      tipoDocumentoId: e.target.value,
                      erro: null,
                    })
                  }
                  {...control}
                >
                  <option value="">Selecione o tipo…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.codigo})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormSolicitar(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={formSolicitar.salvando}>
                {formSolicitar.salvando ? "Solicitando…" : "Solicitar"}
              </Button>
            </FormActions>
          </form>
        </Surface>
      ) : null}

      {/* Detalhe do documento (só leitura) ------------------------------- */}
      {detalheDoc ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-documentos-screen__detalhe"
          aria-labelledby={tituloDetalheDocId}
        >
          <StatusBadge variant={VARIANTE_ESTADO_DOC[detalheDoc.estado]}>
            {ROTULO_ESTADO_DOCUMENTO[detalheDoc.estado]}
          </StatusBadge>
          <h2
            id={tituloDetalheDocId}
            className="pessoas-documentos-screen__section-title"
          >
            Detalhe do documento
          </h2>
          <dl className="pessoas-documentos-screen__detalhe-lista">
            <div>
              <dt>Tipo documental</dt>
              <dd>{rotuloTipo(detalheDoc.tipoDocumentoId)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ROTULO_ESTADO_DOCUMENTO[detalheDoc.estado]}</dd>
            </div>
            <div>
              <dt>Registrado em</dt>
              <dd>{formatarData(detalheDoc.criadoEm)}</dd>
            </div>
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheDoc.id}</code>
              </dd>
            </div>
            {detalheDoc.substituiDocumentoId ? (
              <div>
                <dt>Substitui a referência</dt>
                <dd>
                  <code>{detalheDoc.substituiDocumentoId}</code>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="pessoas-documentos-screen__detalhe-aviso">
            Detalhe apenas de metadados — nenhum conteúdo, arquivo, upload,
            download, link ou visualização é exibido ou disponível.
          </p>
          <Button variant="secondary" onClick={() => setDetalheDoc(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}

      {/* Detalhe da solicitação (só leitura) ----------------------------- */}
      {detalheSolic ? (
        <Surface
          as="section"
          padding="lg"
          className="pessoas-documentos-screen__detalhe"
          aria-labelledby={tituloDetalheSolicId}
        >
          <StatusBadge variant="warning">
            {ROTULO_ESTADO_SOLICITACAO[detalheSolic.estado]}
          </StatusBadge>
          <h2
            id={tituloDetalheSolicId}
            className="pessoas-documentos-screen__section-title"
          >
            Detalhe da solicitação
          </h2>
          <dl className="pessoas-documentos-screen__detalhe-lista">
            <div>
              <dt>Tipo documental</dt>
              <dd>{rotuloTipo(detalheSolic.tipoDocumentoId)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{ROTULO_ESTADO_SOLICITACAO[detalheSolic.estado]}</dd>
            </div>
            <div>
              <dt>Solicitada em</dt>
              <dd>{formatarData(detalheSolic.solicitadaEm)}</dd>
            </div>
            <div>
              <dt>Referência técnica</dt>
              <dd>
                <code>{detalheSolic.id}</code>
              </dd>
            </div>
          </dl>
          <p className="pessoas-documentos-screen__detalhe-aviso">
            Pedido registrado; permanece pendente. Nenhum conteúdo é recebido,
            exibido ou disponibilizado nesta V1.
          </p>
          <Button variant="secondary" onClick={() => setDetalheSolic(null)}>
            Fechar
          </Button>
        </Surface>
      ) : null}
    </div>
  );
}
