/**
 * T203 — aba "Solicitações" da ficha do colaborador. **Só consulta.**
 *
 * Mostra as Solicitações de Pessoas (ajuste de ponto, ausência, férias,
 * atualização cadastral, atestado e benefícios) da pessoa aberta, na empresa
 * ativa da sessão: um bloco por vínculo dela nessa empresa (o principal
 * primeiro, inclusive encerrados — S-4), cada solicitação com detalhe e linha
 * do tempo. Solicitações de documento ficam na aba Documentos.
 *
 * Contratos que já existiam (os mesmos de Pessoas › Solicitações), sem
 * endpoint novo:
 * - `GET /v1/users/me` — a empresa ativa da SESSÃO;
 * - `GET /v1/solicitacoes-pessoas?vinculoId=` — uma consulta por vínculo (o
 *   servidor não filtra por pessoa), lendo TODAS as páginas (100 por página);
 * - `GET /v1/solicitacoes-pessoas/:id` e `/:id/historico` — o detalhe e a
 *   linha do tempo, ao abrir uma solicitação.
 * Os vínculos já vêm da ficha (`GET /v1/colaboradores/:id/vinculos`).
 *
 * Nada é escrito: registrar e dar andamento continuam na Central (Pessoas ›
 * Solicitações). Sem formulário, a aba não cria edição pendente. "Atestado" é
 * um tipo como os outros (S-5): tipo, motivo e datas, sem anexo nem CID.
 *
 * Empresa ativa (S-2): sem ela — o `master_tecnico` global —, a leitura do
 * servidor é de todas as empresas; a aba não consulta nada e orienta a
 * escolher a empresa. O DP nem chega aqui: o shell não oferece a aba (S-3).
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, DataTable, StatusBadge } from "../../components";
import type { DataTableColumn, StatusVariant } from "../../components";
import { obterUsuarioAtual } from "../../api/usersClient";
import type {
  SituacaoVinculo,
  TipoVinculo,
  VinculoApi,
} from "../../api/colaboradoresClient";
import {
  ApiError,
  ROTULO_ACAO,
  ROTULO_MOTIVO,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  VARIANTE_SITUACAO,
  type SolicitacaoPessoaApi,
  type SolicitacaoPessoaEventoApi,
  detalharSolicitacaoPessoa,
  historicoSolicitacaoPessoa,
  listarSolicitacoesPessoas,
} from "../../api/solicitacoesPessoasClient";
import { formatarDiaCivil, formatarInstante } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import "./SolicitacoesColaboradorSecao.css";

/** Itens por página pedidos ao servidor: o máximo que ele aceita. */
export const TAMANHO_PAGINA_SOLICITACOES = 100;

const ROTULO_TIPO_VINCULO: Record<TipoVinculo, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro controlado",
};

const ROTULO_SITUACAO_VINCULO: Record<SituacaoVinculo, string> = {
  ativo: "Ativo",
  previsto: "Previsto",
  encerrado: "Encerrado",
};

const VARIANTE_SITUACAO_VINCULO: Record<SituacaoVinculo, StatusVariant> = {
  ativo: "success",
  previsto: "info",
  encerrado: "neutral",
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
  | { readonly tipo: "pronta"; readonly empresaId: string };

type EstadoDaLista =
  | { readonly tipo: "carregando" }
  | Falha
  | {
      readonly tipo: "dados";
      readonly porVinculo: ReadonlyMap<string, readonly SolicitacaoPessoaApi[]>;
    };

type ConteudoDoDetalhe =
  | { readonly tipo: "carregando" }
  | Falha
  | { readonly tipo: "indisponivel" }
  | {
      readonly tipo: "dados";
      readonly solicitacao: SolicitacaoPessoaApi;
      readonly eventos: readonly SolicitacaoPessoaEventoApi[];
    };

interface Detalhe {
  /** A linha que abriu o detalhe (e cujo botão recebe o foco de volta). */
  readonly linha: SolicitacaoPessoaApi;
  readonly conteudo: ConteudoDoDetalhe;
}

/** "Férias, registrada em 05/10/2026 às 09:00" — nome acessível da linha. */
function descricaoDaLinha(s: SolicitacaoPessoaApi): string {
  return `${ROTULO_TIPO[s.tipo] ?? s.tipo}, registrada em ${formatarInstante(s.criadoEm)}`;
}

export interface SolicitacoesColaboradorSecaoProps {
  readonly colaboradorId: string;
  readonly nomeColaborador: string;
  /** Os vínculos da pessoa, como a ficha os leu (escopo da sessão). */
  readonly vinculos: readonly VinculoApi[];
  /** O vínculo principal (mesma regra do cabeçalho), ou `null`. */
  readonly vinculoPrincipalId: string | null;
}

export function SolicitacoesColaboradorSecao({
  colaboradorId,
  nomeColaborador,
  vinculos,
  vinculoPrincipalId,
}: SolicitacoesColaboradorSecaoProps) {
  const prefixo = useId();
  const ids = useMemo(
    () => ({
      titulo: `${prefixo}-titulo`,
      novaTentativa: `${prefixo}-nova-tentativa`,
      tituloDetalhe: `${prefixo}-detalhe`,
      tentarDetalhe: `${prefixo}-tentar-detalhe`,
      vinculo: (vinculoId: string) => `${prefixo}-vinculo-${vinculoId}`,
      verDetalhe: (solicitacaoId: string) => `${prefixo}-ver-${solicitacaoId}`,
    }),
    [prefixo],
  );

  const [sessao, setSessao] = useState<EstadoDaSessao>({ tipo: "carregando" });
  const [lista, setLista] = useState<EstadoDaLista>({ tipo: "carregando" });
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);

  /** `id` do elemento que recebe o foco depois do próximo desenho. */
  const focoRef = useRef<string | null>(null);
  const vivaRef = useRef(true);
  useEffect(() => {
    vivaRef.current = true;
    return () => {
      vivaRef.current = false;
    };
  }, []);
  /** Só vale a leitura mais recente de cada tipo. */
  const geracaoRef = useRef({ lista: 0, detalhe: 0 });

  // ---- Sessão: empresa ativa -------------------------------------------------
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
            : { tipo: "pronta", empresaId },
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

  /** Os vínculos desta pessoa NESTA empresa, o principal primeiro (S-4). */
  const vinculosDaEmpresa = useMemo(() => {
    if (empresaId === null) return [];
    const daEmpresa = vinculos.filter(
      (v) => v.colaboradorId === colaboradorId && v.empresaId === empresaId,
    );
    const principal = daEmpresa.find((v) => v.id === vinculoPrincipalId);
    return principal
      ? [principal, ...daEmpresa.filter((v) => v.id !== principal.id)]
      : daEmpresa;
  }, [vinculos, colaboradorId, empresaId, vinculoPrincipalId]);
  const idsDosVinculos = useMemo(
    () => new Set(vinculosDaEmpresa.map((v) => v.id)),
    [vinculosDaEmpresa],
  );

  // ---- Lista: todas as páginas de cada vínculo --------------------------------
  const carregarLista = useCallback(
    async (novaLeitura = false) => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current.lista;
      if (novaLeitura) setLista(emNovaLeitura);
      else setLista({ tipo: "carregando" });
      try {
        const lidas = await Promise.all(
          vinculosDaEmpresa.map(async (vinculo) => {
            const consulta = (pagina: number) =>
              listarSolicitacoesPessoas({
                vinculoId: vinculo.id,
                pagina,
                tamanhoPagina: TAMANHO_PAGINA_SOLICITACOES,
              });
            const primeira = await consulta(1);
            const paginas = Math.max(
              1,
              Math.ceil(primeira.total / TAMANHO_PAGINA_SOLICITACOES),
            );
            const demais = await Promise.all(
              Array.from({ length: paginas - 1 }, (_, i) => consulta(i + 2)),
            );
            // Defesa além do servidor: só deste vínculo e desta empresa, sem
            // repetir (um registro novo entre duas páginas empurraria uma
            // linha para a página seguinte).
            const vistos = new Set<string>();
            const itens = [primeira, ...demais]
              .flatMap((p) => p.itens)
              .filter((s) => {
                if (
                  s.vinculoId !== vinculo.id ||
                  s.empresaId !== empresaId ||
                  vistos.has(s.id)
                ) {
                  return false;
                }
                vistos.add(s.id);
                return true;
              });
            return [vinculo.id, itens] as const;
          }),
        );
        if (!vivaRef.current || geracao !== geracaoRef.current.lista) return;
        if (novaLeitura) focoRef.current = ids.titulo;
        setLista({ tipo: "dados", porVinculo: new Map(lidas) });
      } catch {
        if (!vivaRef.current || geracao !== geracaoRef.current.lista) return;
        setLista(proximaFalha);
      }
    },
    [empresaId, vinculosDaEmpresa, ids],
  );

  useEffect(() => {
    if (empresaId === null) return;
    void carregarLista();
  }, [empresaId, carregarLista]);

  // ---- Detalhe e linha do tempo -----------------------------------------------
  const carregarDetalhe = useCallback(
    async (linha: SolicitacaoPessoaApi, novaLeitura = false) => {
      if (empresaId === null) return;
      const geracao = ++geracaoRef.current.detalhe;
      setDetalhe((atual) =>
        novaLeitura && atual && atual.linha.id === linha.id
          ? { linha, conteudo: emNovaLeitura(atual.conteudo) }
          : { linha, conteudo: { tipo: "carregando" } },
      );
      try {
        const [solicitacao, eventos] = await Promise.all([
          detalharSolicitacaoPessoa(linha.id),
          historicoSolicitacaoPessoa(linha.id),
        ]);
        if (!vivaRef.current || geracao !== geracaoRef.current.detalhe) return;
        // Defesa além do servidor: o detalhe tem de ser o pedido, desta
        // empresa e de um vínculo desta pessoa; a linha do tempo, só dele.
        if (
          solicitacao.id !== linha.id ||
          solicitacao.empresaId !== empresaId ||
          !idsDosVinculos.has(solicitacao.vinculoId)
        ) {
          setDetalhe({ linha, conteudo: { tipo: "indisponivel" } });
          return;
        }
        const daSolicitacao = eventos
          .filter(
            (e) => e.solicitacaoId === linha.id && e.empresaId === empresaId,
          )
          .sort(
            (a, b) =>
              Date.parse(a.ocorridoEm) - Date.parse(b.ocorridoEm) ||
              a.id.localeCompare(b.id),
          );
        focoRef.current = ids.tituloDetalhe;
        setDetalhe({
          linha,
          conteudo: { tipo: "dados", solicitacao, eventos: daSolicitacao },
        });
      } catch (erro) {
        if (!vivaRef.current || geracao !== geracaoRef.current.detalhe) return;
        const foraDoEscopo =
          erro instanceof ApiError &&
          (erro.status === 404 || erro.status === 403);
        setDetalhe((atual) => ({
          linha,
          conteudo: foraDoEscopo
            ? { tipo: "indisponivel" }
            : proximaFalha(
                atual && atual.linha.id === linha.id
                  ? atual.conteudo
                  : { tipo: "carregando" },
              ),
        }));
      }
    },
    [empresaId, idsDosVinculos, ids],
  );

  function fecharDetalhe() {
    if (detalhe === null) return;
    // Fechar descarta qualquer leitura em curso do detalhe.
    geracaoRef.current.detalhe++;
    focoRef.current = ids.verDetalhe(detalhe.linha.id);
    setDetalhe(null);
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

  // ---- Desenho ----------------------------------------------------------------
  const cabecalho = (
    <>
      <h2
        id={ids.titulo}
        tabIndex={-1}
        className="ficha-colaborador__subtitulo"
      >
        Solicitações
      </h2>
      <p className="solicitacoes-colaborador__aviso">
        <StatusBadge variant="info">Somente consulta</StatusBadge> Pedidos de
        Pessoas desta pessoa, com detalhe e linha do tempo. Registrar e dar
        andamento às solicitações continua em Pessoas › Solicitações.
        Solicitações de documento ficam na aba Documentos.
      </p>
    </>
  );

  // Um só nó de status do começo ao fim (lição do B3 da T201): sessão e lista
  // carregando dizem o MESMO texto; o detalhe anuncia só a própria carga.
  const carregandoLista =
    sessao.tipo === "carregando" ||
    (sessao.tipo === "pronta" &&
      (lista.tipo === "carregando" ||
        (lista.tipo === "erro" && lista.relendo)));
  const carregandoDetalhe =
    detalhe !== null &&
    (detalhe.conteudo.tipo === "carregando" ||
      (detalhe.conteudo.tipo === "erro" && detalhe.conteudo.relendo));
  const totalDeItens =
    lista.tipo === "dados"
      ? [...lista.porVinculo.values()].reduce((n, l) => n + l.length, 0)
      : 0;
  const textoDoStatus = carregandoLista
    ? "Carregando solicitações…"
    : carregandoDetalhe
      ? "Carregando o detalhe da solicitação…"
      : sessao.tipo === "pronta" &&
          lista.tipo === "dados" &&
          vinculosDaEmpresa.length > 0
        ? totalDeItens === 0
          ? `Nenhuma solicitação registrada para ${nomeColaborador}.`
          : `Solicitações de ${nomeColaborador} carregadas.`
        : "";

  const colunas: DataTableColumn<SolicitacaoPessoaApi>[] = [
    {
      key: "tipo",
      header: "Tipo",
      cell: (s) => ROTULO_TIPO[s.tipo] ?? s.tipo,
    },
    {
      key: "situacao",
      header: "Situação",
      cell: (s) => (
        <StatusBadge variant={VARIANTE_SITUACAO[s.situacao] ?? "neutral"}>
          {ROTULO_SITUACAO[s.situacao] ?? s.situacao}
        </StatusBadge>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      cell: (s) => ROTULO_MOTIVO[s.motivo] ?? s.motivo,
    },
    {
      key: "referencia",
      header: "Dia de referência",
      cell: (s) => formatarDiaCivil(s.periodoReferencia),
    },
    {
      key: "registrada",
      header: "Registrada em",
      cell: (s) => formatarInstante(s.criadoEm),
    },
    {
      key: "detalhe",
      header: "Detalhe",
      cell: (s) => (
        <Button
          id={ids.verDetalhe(s.id)}
          variant="secondary"
          aria-expanded={detalhe?.linha.id === s.id}
          onClick={() => void carregarDetalhe(s)}
        >
          Ver detalhe
          <span className="ficha-colaborador__so-leitor">
            {` da solicitação de ${descricaoDaLinha(s)}`}
          </span>
        </Button>
      ),
    },
  ];

  function painelDoDetalhe(vinculoId: string) {
    if (detalhe === null || detalhe.linha.vinculoId !== vinculoId) return null;
    const { linha, conteudo } = detalhe;
    return (
      <section
        className="solicitacoes-colaborador__detalhe"
        aria-labelledby={ids.tituloDetalhe}
      >
        <h4
          id={ids.tituloDetalhe}
          tabIndex={-1}
          className="solicitacoes-colaborador__detalhe-titulo"
        >
          {`Detalhe da solicitação de ${ROTULO_TIPO[linha.tipo] ?? linha.tipo}`}
        </h4>
        {conteudo.tipo === "carregando" ? (
          <p className="ficha-colaborador__texto" aria-hidden="true">
            Carregando…
          </p>
        ) : conteudo.tipo === "indisponivel" ? (
          <p role="alert" className="ficha-colaborador__texto">
            Esta solicitação não está disponível na empresa ativa.
          </p>
        ) : conteudo.tipo === "erro" ? (
          <FalhaComNovaTentativa
            id={ids.tentarDetalhe}
            falha={conteudo}
            texto="Não foi possível carregar o detalhe da solicitação."
            onTentar={() => void carregarDetalhe(linha, true)}
          />
        ) : (
          <>
            <dl className="solicitacoes-colaborador__campos">
              <div>
                <dt>Tipo</dt>
                <dd>
                  {ROTULO_TIPO[conteudo.solicitacao.tipo] ??
                    conteudo.solicitacao.tipo}
                </dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>
                  <StatusBadge
                    variant={
                      VARIANTE_SITUACAO[conteudo.solicitacao.situacao] ??
                      "neutral"
                    }
                  >
                    {ROTULO_SITUACAO[conteudo.solicitacao.situacao] ??
                      conteudo.solicitacao.situacao}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>
                  {ROTULO_MOTIVO[conteudo.solicitacao.motivo] ??
                    conteudo.solicitacao.motivo}
                </dd>
              </div>
              <div>
                <dt>Dia de referência</dt>
                <dd>
                  {formatarDiaCivil(conteudo.solicitacao.periodoReferencia)}
                </dd>
              </div>
              <div>
                <dt>Registrada em</dt>
                <dd>{formatarInstante(conteudo.solicitacao.criadoEm)}</dd>
              </div>
              <div>
                <dt>Enviada em</dt>
                <dd>{formatarInstante(conteudo.solicitacao.enviadaEm)}</dd>
              </div>
              <div>
                <dt>Primeira revisão em</dt>
                <dd>
                  {formatarInstante(conteudo.solicitacao.primeiraRevisaoEm)}
                </dd>
              </div>
            </dl>
            <h5 className="solicitacoes-colaborador__linha-titulo">
              Linha do tempo
            </h5>
            {conteudo.eventos.length === 0 ? (
              <p className="ficha-colaborador__texto">
                Nenhum evento registrado.
              </p>
            ) : (
              <ol className="solicitacoes-colaborador__linha">
                {conteudo.eventos.map((e) => (
                  <li key={e.id}>
                    <span className="solicitacoes-colaborador__quando">
                      {formatarInstante(e.ocorridoEm)}
                    </span>{" "}
                    <strong>{ROTULO_ACAO[e.acao] ?? e.acao}</strong>
                    {` — ${
                      e.situacaoDe
                        ? `${ROTULO_SITUACAO[e.situacaoDe] ?? e.situacaoDe} → `
                        : ""
                    }${ROTULO_SITUACAO[e.situacaoPara] ?? e.situacaoPara}`}
                    {e.motivo
                      ? ` · Motivo: ${ROTULO_MOTIVO[e.motivo] ?? e.motivo}`
                      : ""}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
        <div className="solicitacoes-colaborador__acoes">
          <Button variant="secondary" onClick={fecharDetalhe}>
            Fechar detalhe
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="ficha-colaborador__cartao solicitacoes-colaborador"
      aria-labelledby={ids.titulo}
    >
      {cabecalho}
      <p role="status" className="ficha-colaborador__so-leitor">
        {textoDoStatus}
      </p>
      {sessao.tipo === "carregando" ? (
        <p className="ficha-colaborador__texto" aria-hidden="true">
          Carregando…
        </p>
      ) : sessao.tipo === "sem-empresa" ? (
        <div className="solicitacoes-colaborador__orientacao">
          <p className="ficha-colaborador__texto">
            Escolha uma empresa ativa para consultar as solicitações de{" "}
            {nomeColaborador}.
          </p>
          <p className="ficha-colaborador__cartao-contexto">
            Sem empresa ativa, as solicitações de empresas diferentes ficariam
            misturadas. Use o seletor de empresa do menu.
          </p>
        </div>
      ) : sessao.tipo === "erro" ? (
        <FalhaComNovaTentativa
          id={ids.novaTentativa}
          falha={sessao}
          texto="Não foi possível conferir o seu acesso às solicitações."
          onTentar={() => void carregarSessao(true)}
        />
      ) : vinculosDaEmpresa.length === 0 ? (
        <p className="ficha-colaborador__texto">
          {`${nomeColaborador} não tem vínculo nesta empresa: não há solicitações a consultar.`}
        </p>
      ) : lista.tipo === "erro" ? (
        <FalhaComNovaTentativa
          id={ids.novaTentativa}
          falha={lista}
          texto="Não foi possível carregar as solicitações."
          onTentar={() => void carregarLista(true)}
        />
      ) : lista.tipo === "carregando" ? (
        <p className="ficha-colaborador__texto" aria-hidden="true">
          Carregando…
        </p>
      ) : (
        vinculosDaEmpresa.map((vinculo) => {
          const itens = lista.porVinculo.get(vinculo.id) ?? [];
          return (
            <section
              key={vinculo.id}
              className="solicitacoes-colaborador__vinculo"
              aria-labelledby={ids.vinculo(vinculo.id)}
            >
              <h3
                id={ids.vinculo(vinculo.id)}
                className="ficha-colaborador__cartao-titulo"
              >
                {ROTULO_TIPO_VINCULO[vinculo.tipo] ?? vinculo.tipo} ·{" "}
                {exibirMatricula(vinculo.matricula)}
                {vinculo.id === vinculoPrincipalId
                  ? " · vínculo principal"
                  : ""}
              </h3>
              <p className="solicitacoes-colaborador__situacao">
                <StatusBadge
                  variant={VARIANTE_SITUACAO_VINCULO[vinculo.situacao]}
                >
                  {ROTULO_SITUACAO_VINCULO[vinculo.situacao] ??
                    vinculo.situacao}
                </StatusBadge>
              </p>
              {itens.length === 0 ? (
                <p className="ficha-colaborador__texto">
                  Nenhuma solicitação neste vínculo.
                </p>
              ) : (
                <div className="ficha-colaborador__quadro">
                  <DataTable
                    caption={`Solicitações — ${ROTULO_TIPO_VINCULO[vinculo.tipo] ?? vinculo.tipo} ${exibirMatricula(vinculo.matricula)}`}
                    columns={colunas}
                    rows={[...itens]}
                    rowKey={(s) => s.id}
                  />
                </div>
              )}
              {painelDoDetalhe(vinculo.id)}
            </section>
          );
        })
      )}
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
