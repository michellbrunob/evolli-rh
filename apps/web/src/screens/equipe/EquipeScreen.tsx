/**
 * EquipeScreen (T153) — consulta consultiva do gestor, SOMENTE LEITURA.
 *
 * Primeira interface do papel `gestor` no produto. Mostra a equipe que o
 * SERVIDOR autoriza e, por vínculo, o detalhe da projeção fechada da decisão 7
 * (ADR 0015), numa janela modal do padrão B.
 *
 * ## O que esta tela deliberadamente NÃO faz
 *
 *  - **Não decide autorização.** O gate de papel abaixo é conveniência de
 *    interface, não controle de acesso: quem decide é o RBAC
 *    (`gestor_equipe`/`read`) e o escopo resolvido no servidor a partir da
 *    sessão. Esconder a tela de quem não tem o papel evita um "Acesso negado"
 *    inútil; não evitaria nada se alguém chamasse a API direto — e é por isso
 *    que o servidor continua sendo a única fronteira real.
 *  - **Não oferece data.** Não há seletor, campo nem parâmetro de
 *    `dataReferencia`. A data vem na resposta e é exibida como informação.
 *    Mandar qualquer query para essas rotas responde 400 (`ConsultaEquipeQueryDto`
 *    é vazia de propósito), e o motivo é de autorização: quem pergunta não
 *    escolhe em que data é autorizado (ADR 0015, decisão 8).
 *  - **Não infere subordinação.** Nenhum filtro por e-mail, nome, `unitId`,
 *    `teamId` ou lotação decide quem aparece. A lista é exatamente `itens` do
 *    servidor; a busca local só esconde linhas que já vieram.
 *  - **Não muta nada.** Não há formulário, botão de ação, aprovação ou edição.
 *    O módulo `gestorClient` não exporta uma única função de escrita.
 *  - **Não finge capacidade que não existe.** `resumoJornada` e
 *    `andamentoSolicitacoes` chegam `null` do servidor de propósito
 *    (`DP-3J-12` e `PD-SOL-05` seguem pendentes). A tela não desenha cartão
 *    vazio, "em breve" nem placeholder para eles — o que não existe não ocupa
 *    espaço fingindo que existe.
 *
 * ## Papéis
 *
 * O RBAC concede `gestor_equipe`/`read` a **dois** papéis, ambos restritos à
 * própria empresa: `gestor` (consulta o próprio escopo) e `rh` (lê para
 * conferir o que configurou). `master_tecnico`, `admin_tecnico`, `dp`,
 * `financeiro`, `colaborador`, `auditor` e `dpo` são negados. O gate reproduz
 * exatamente essa lista — negar `rh` aqui seria inventar uma restrição que o
 * contrato não tem, e conceder a qualquer outro seria conveniência contra o
 * contrato.
 *
 * ## Concorrência
 *
 * Guarda monotônica por carregador, no padrão já comprovado em
 * `SolicitacoesScreen` (T140): um contador em `useRef` por carregador; a
 * resposta só escreve estado se ainda for a mais recente. Vale para dados,
 * erro E carregamento — deixar o `loading` escapar da guarda é como a tela
 * trava em "carregando" para sempre.
 *
 * O risco concreto que isso fecha: abrir o detalhe de A, trocar para B e a
 * resposta de A chegar depois — fazendo o dado de uma pessoa aparecer sob o
 * nome de outra. Em RH isso não é um glitch visual.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  detalharVinculo,
  listarEquipe,
  type DetalheVinculoApi,
  type MembroEquipeApi,
} from "../../api/gestorClient";
import { obterUsuarioAtual } from "../../api/usersClient";
import {
  Button,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  StatusBadge,
  Surface,
  type DataTableColumn,
  type StatusVariant,
} from "../../components";
import { formatarDiaCivil } from "../../format/data";
import { exibirMatricula } from "../../format/matricula";
import "./EquipeScreen.css";

export const EQUIPE_TITULO_ID = "equipe-titulo";

/**
 * Papéis a que o RBAC concede `gestor_equipe`/`read`.
 *
 * Espelha `rbac.evaluator.ts` — a função `gestor_equipe` tem exatamente dois
 * `case`: `gestor` e `rh`. Mantido como constante exportada para que o teste
 * prenda a lista: acrescentar um papel aqui sem que o servidor conceda
 * produziria uma tela que carrega e responde 403.
 */
export const PAPEIS_COM_CONSULTA_DE_EQUIPE: readonly string[] = [
  "gestor",
  "rh",
];

type StatusCarregamento = "carregando" | "erro" | "pronto";

/**
 * Rótulos das situações de vínculo.
 *
 * O enum cru do backend nunca vai à tela. Situação desconhecida cai no próprio
 * valor — melhor mostrar o código do que mentir um rótulo.
 */
// Valores do enum `SituacaoVinculo` do schema: previsto | ativo | encerrado.
// Conferidos na fonte depois de a validação visual mostrar o enum cru na tela
// — a primeira versão deste mapa tinha `afastado` e `desligado`, que NÃO
// existem (o schema registra, em comentário, que `suspenso` ficou de fora de
// propósito). Inventar rótulo é tão errado quanto exibir o código.
const ROTULO_SITUACAO: Record<string, string> = {
  previsto: "Previsto",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

const VARIANTE_SITUACAO: Record<string, StatusVariant> = {
  previsto: "info",
  ativo: "success",
  encerrado: "neutral",
};

// Valores do enum `TipoVinculo`: clt | estagio | pj | temporario |
// outro_controlado.
const ROTULO_TIPO: Record<string, string> = {
  clt: "CLT",
  estagio: "Estágio",
  pj: "PJ",
  temporario: "Temporário",
  outro_controlado: "Outro (controlado)",
};

function rotuloSituacao(valor: string): string {
  return ROTULO_SITUACAO[valor] ?? valor;
}

function varianteSituacao(valor: string): StatusVariant {
  return VARIANTE_SITUACAO[valor] ?? "neutral";
}

function rotuloTipo(valor: string): string {
  return ROTULO_TIPO[valor] ?? valor;
}

/** Texto pesquisável de um membro — só o que já está visível na lista. */
function textoDeBusca(m: MembroEquipeApi): string {
  return [
    m.nome,
    // T179 — matrícula opcional: sem ela, nada entra na busca.
    m.matricula ?? "",
    m.cargoVigente?.nome ?? "",
    m.lotacaoVigente?.equipe?.nome ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export interface EquipeScreenProps {
  /**
   * Chamado quando a sessão desta aba deixa de ser válida (401). O shell volta
   * ao login; aqui só repassamos o sinal.
   */
  onSessaoAtualEncerrada?: () => void;
}

export function EquipeScreen({
  onSessaoAtualEncerrada,
}: EquipeScreenProps = {}) {
  // --- papel do ator (quem pode ver a interface funcional) ------------------
  const [statusAtor, setStatusAtor] =
    useState<StatusCarregamento>("carregando");
  const [papel, setPapel] = useState<string | null>(null);

  // --- lista ---------------------------------------------------------------
  const [statusLista, setStatusLista] =
    useState<StatusCarregamento>("carregando");
  const [itens, setItens] = useState<MembroEquipeApi[]>([]);
  const [dataReferencia, setDataReferencia] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // --- detalhe -------------------------------------------------------------
  const [vinculoAberto, setVinculoAberto] = useState<string | null>(null);
  const [statusDetalhe, setStatusDetalhe] =
    useState<StatusCarregamento>("pronto");
  const [detalhe, setDetalhe] = useState<DetalheVinculoApi | null>(null);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);

  // Contadores monotônicos: um por carregador. Incrementar invalida tudo que
  // estiver em voo daquele carregador, sem cancelar a requisição (não há
  // AbortController no padrão da casa) — a resposta chega e é descartada.
  const seqAtor = useRef(0);
  const seqLista = useRef(0);
  const seqDetalhe = useRef(0);

  const tratarErroSessao = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.status === 401) {
        // Sessão encerrada: invalida TUDO que estiver em voo antes de avisar o
        // shell, para que nenhuma resposta tardia escreva dados da sessão
        // anterior numa tela que já voltou ao login.
        seqAtor.current += 1;
        seqLista.current += 1;
        seqDetalhe.current += 1;
        setItens([]);
        setDataReferencia(null);
        setDetalhe(null);
        setVinculoAberto(null);
        onSessaoAtualEncerrada?.();
        return true;
      }
      return false;
    },
    [onSessaoAtualEncerrada],
  );

  const carregarAtor = useCallback(async () => {
    const seq = ++seqAtor.current;
    setStatusAtor("carregando");
    try {
      const eu = await obterUsuarioAtual();
      if (seq !== seqAtor.current) return;
      setPapel(eu.role);
      setStatusAtor("pronto");
    } catch (err) {
      if (seq !== seqAtor.current) return;
      if (tratarErroSessao(err)) return;
      setStatusAtor("erro");
    }
  }, [tratarErroSessao]);

  const carregarLista = useCallback(async () => {
    const seq = ++seqLista.current;
    setStatusLista("carregando");
    try {
      const resposta = await listarEquipe();
      if (seq !== seqLista.current) return;
      setItens(resposta.itens);
      setDataReferencia(resposta.dataReferencia);
      setStatusLista("pronto");
    } catch (err) {
      if (seq !== seqLista.current) return;
      if (tratarErroSessao(err)) return;
      setStatusLista("erro");
    }
  }, [tratarErroSessao]);

  const carregarDetalhe = useCallback(
    async (vinculoId: string) => {
      const seq = ++seqDetalhe.current;
      setStatusDetalhe("carregando");
      setErroDetalhe(null);
      try {
        const resposta = await detalharVinculo(vinculoId);
        if (seq !== seqDetalhe.current) return;
        setDetalhe(resposta);
        setStatusDetalhe("pronto");
      } catch (err) {
        if (seq !== seqDetalhe.current) return;
        if (tratarErroSessao(err)) return;
        // A mensagem é a do cliente, nunca a do servidor. 404 não distingue
        // inexistente de alheio — se distinguisse, seria enumeração.
        setErroDetalhe(
          err instanceof ApiError
            ? err.message
            : "Não foi possível carregar o detalhe.",
        );
        setStatusDetalhe("erro");
      }
    },
    [tratarErroSessao],
  );

  useEffect(() => {
    void carregarAtor();
  }, [carregarAtor]);

  // A consulta só sai quando há escopo válido para consultar: papel conhecido
  // E com a capacidade. Centralizar a decisão aqui evita a chamada 403 que
  // sairia se a lista carregasse em paralelo com o papel.
  const podeConsultar =
    statusAtor === "pronto" &&
    papel !== null &&
    PAPEIS_COM_CONSULTA_DE_EQUIPE.includes(papel);

  useEffect(() => {
    if (!podeConsultar) {
      // Ramo sem consulta possível: invalida o que estiver em voo e NÃO deixa
      // o estado preso em "carregando" — sem este `setStatusLista("pronto")` a
      // tela de quem não tem o papel ficaria girando para sempre.
      seqLista.current += 1;
      setItens([]);
      setDataReferencia(null);
      setStatusLista("pronto");
      return;
    }
    void carregarLista();
  }, [podeConsultar, carregarLista]);

  const abrirDetalhe = useCallback(
    (vinculoId: string) => {
      // Troca de vínculo descarta o detalhe anterior ANTES de pedir o novo: o
      // incremento acontece dentro de `carregarDetalhe`, mas o estado precisa
      // ser limpo aqui para que a janela não mostre, por um instante, os dados
      // da pessoa anterior sob o nome da nova.
      setDetalhe(null);
      setErroDetalhe(null);
      setVinculoAberto(vinculoId);
      void carregarDetalhe(vinculoId);
    },
    [carregarDetalhe],
  );

  const fecharDetalhe = useCallback(() => {
    // Fechar descarta o detalhe. A INVALIDAÇÃO da requisição pendente não
    // mora aqui: mora em `carregarDetalhe`, que incrementa `seqDetalhe` em
    // TODA abertura — então a resposta de uma consulta já fechada chega com
    // sequência vencida e é descartada lá, e com `vinculoAberto` nulo o modal
    // nem renderiza.
    //
    // Havia um `seqDetalhe.current += 1` nesta função. Duas rodadas de
    // mutação mostraram que removê-lo não quebrava teste nenhum — nem os seis
    // cenários de corrida, nem as sondas de fechar-e-reabrir. Era código
    // inobservável, e um guarda que não guarda nada é pior que a ausência
    // dele: cria confiança falsa. Removido em vez de justificado por teste
    // fabricado.
    setVinculoAberto(null);
    setDetalhe(null);
    setErroDetalhe(null);
    setStatusDetalhe("pronto");
  }, []);

  // Busca puramente local, sobre o que o servidor já devolveu. Não existe
  // parâmetro de busca nas rotas, e inventar um aqui mandaria query — que
  // responde 400.
  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return itens;
    return itens.filter((m) => textoDeBusca(m).includes(termo));
  }, [itens, busca]);

  const colunas: DataTableColumn<MembroEquipeApi>[] = useMemo(
    () => [
      {
        key: "nome",
        header: "Nome",
        cell: (m) => (
          <Button
            variant="subtle"
            onClick={() => abrirDetalhe(m.vinculoId)}
            aria-label={`Ver detalhe de ${m.nome}`}
          >
            {m.nome}
          </Button>
        ),
      },
      {
        key: "matricula",
        header: "Matrícula",
        cell: (m) => exibirMatricula(m.matricula),
      },
      {
        key: "situacao",
        header: "Situação",
        cell: (m) => (
          <StatusBadge variant={varianteSituacao(m.situacaoVinculo)}>
            {rotuloSituacao(m.situacaoVinculo)}
          </StatusBadge>
        ),
      },
      {
        key: "cargo",
        header: "Cargo",
        cell: (m) => m.cargoVigente?.nome ?? "—",
      },
      {
        key: "equipe",
        header: "Equipe",
        cell: (m) => m.lotacaoVigente?.equipe?.nome ?? "—",
      },
    ],
    [abrirDetalhe],
  );

  const membroAberto = itens.find((m) => m.vinculoId === vinculoAberto) ?? null;

  return (
    <div className="equipe-screen">
      <PageHeader
        headingLevel={1}
        titleId={EQUIPE_TITULO_ID}
        title="Minha equipe"
        description="Consulta das pessoas sob sua gestão na data de referência do servidor."
      />

      {statusAtor === "carregando" ? (
        <p role="status">Verificando suas permissões…</p>
      ) : statusAtor === "erro" ? (
        <div className="equipe-screen__erro">
          <p role="alert">Não foi possível verificar suas permissões.</p>
          <Button variant="secondary" onClick={() => void carregarAtor()}>
            Tentar novamente
          </Button>
        </div>
      ) : !podeConsultar ? (
        // Papel sem a capacidade: nenhuma interface funcional é renderizada —
        // nem tabela, nem busca, nem botão. E nenhuma chamada é feita.
        <EmptyState
          headingLevel={2}
          icon="—"
          title="Sem permissão"
          description="Sua conta não tem permissão para consultar equipes. Essa consulta é concedida apenas aos papéis definidos pelo servidor."
        />
      ) : (
        <>
          <Surface
            as="section"
            padding="md"
            className="equipe-screen__aviso"
            aria-labelledby="equipe-aviso-titulo"
          >
            <StatusBadge variant="info">Somente leitura</StatusBadge>
            <p id="equipe-aviso-titulo" className="equipe-screen__aviso-texto">
              Esta tela é consultiva: não há aprovação, edição ou qualquer
              alteração.{" "}
              {dataReferencia ? (
                <>
                  Escopo resolvido pelo servidor na data de referência{" "}
                  <strong>{formatarDiaCivil(dataReferencia)}</strong>.
                </>
              ) : null}
            </p>
          </Surface>

          <section
            className="equipe-screen__lista"
            aria-labelledby="equipe-lista-titulo"
          >
            <h2 id="equipe-lista-titulo">Colaboradores</h2>

            {statusLista === "carregando" ? (
              <p role="status">Carregando sua equipe…</p>
            ) : statusLista === "erro" ? (
              <div className="equipe-screen__erro">
                <p role="alert">Não foi possível carregar sua equipe.</p>
                <Button
                  variant="secondary"
                  onClick={() => void carregarLista()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : itens.length === 0 ? (
              // A ADR 0015 antecipou este estado e exigiu que a interface o
              // explicasse: lista vazia é o comportamento CORRETO de quem não
              // tem atribuição vigente, não um defeito.
              <EmptyState
                headingLevel={3}
                icon="—"
                title="Nenhuma pessoa sob sua gestão hoje"
                description="O escopo vem da atribuição de equipe vigente, registrada pelo RH. Enquanto não houver atribuição vigente para a sua conta, esta lista fica vazia — é o comportamento esperado, não um erro."
              />
            ) : (
              <>
                <div className="equipe-screen__busca">
                  <label htmlFor="equipe-busca">Buscar na lista</label>
                  <input
                    id="equipe-busca"
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Nome, matrícula, cargo ou equipe"
                  />
                  <p className="equipe-screen__busca-ajuda">
                    Filtra apenas as pessoas já listadas acima; não consulta o
                    servidor.
                  </p>
                </div>

                {itensFiltrados.length === 0 ? (
                  <EmptyState
                    headingLevel={3}
                    icon="—"
                    title="Nenhum resultado para esta busca"
                    description="Nenhuma das pessoas da sua equipe corresponde ao termo digitado."
                  />
                ) : (
                  <DataTable
                    caption={`Colaboradores sob sua gestão (${itensFiltrados.length} de ${itens.length})`}
                    columns={colunas}
                    rows={itensFiltrados}
                    rowKey={(m) => m.vinculoId}
                  />
                )}
              </>
            )}
          </section>
        </>
      )}

      <Modal
        aberto={vinculoAberto !== null}
        titulo={membroAberto ? membroAberto.nome : "Detalhe do colaborador"}
        descricao="Consulta somente leitura."
        onFechar={fecharDetalhe}
        // Somente leitura: não há o que bloquear nem o que descartar, então
        // `Escape` e "Fechar" encerram direto, sem confirmação.
        bloqueado={false}
        alterado={false}
        largura="media"
      >
        {statusDetalhe === "carregando" ? (
          <p role="status">Carregando detalhe…</p>
        ) : statusDetalhe === "erro" ? (
          <div className="equipe-screen__erro">
            <p role="alert">{erroDetalhe}</p>
            {vinculoAberto ? (
              <Button
                variant="secondary"
                onClick={() => void carregarDetalhe(vinculoAberto)}
              >
                Tentar novamente
              </Button>
            ) : null}
          </div>
        ) : detalhe ? (
          <dl className="equipe-screen__detalhe">
            <div>
              <dt>Matrícula</dt>
              <dd>{exibirMatricula(detalhe.matricula)}</dd>
            </div>
            <div>
              <dt>Situação do vínculo</dt>
              <dd>
                <StatusBadge
                  variant={varianteSituacao(detalhe.situacaoVinculo)}
                >
                  {rotuloSituacao(detalhe.situacaoVinculo)}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt>Tipo de vínculo</dt>
              <dd>{rotuloTipo(detalhe.tipoVinculo)}</dd>
            </div>
            <div>
              <dt>Admissão</dt>
              <dd>{formatarDiaCivil(detalhe.dataAdmissao)}</dd>
            </div>
            <div>
              <dt>Desligamento</dt>
              <dd>{formatarDiaCivil(detalhe.dataDesligamento)}</dd>
            </div>
            <div>
              <dt>Cargo vigente</dt>
              <dd>{detalhe.cargoVigente?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt>Equipe</dt>
              <dd>{detalhe.lotacaoVigente?.equipe?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt>Departamento</dt>
              <dd>{detalhe.lotacaoVigente?.departamento?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt>Unidade organizacional</dt>
              <dd>
                {detalhe.lotacaoVigente?.unidadeOrganizacional?.nome ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Horário vigente</dt>
              <dd>
                {detalhe.horarioVigente
                  ? `${detalhe.horarioVigente.nome} (desde ${formatarDiaCivil(
                      detalhe.horarioVigente.vigenciaInicio,
                    )})`
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}
        {/* `resumoJornada` e `andamentoSolicitacoes` chegam `null` de
            propósito e NÃO são renderizados — nem como cartão vazio, nem como
            "em breve". `DP-3J-12` e `PD-SOL-05` seguem sem contrato seguro, e
            desenhar um espaço para eles afirmaria que a capacidade existe. */}
      </Modal>
    </div>
  );
}
