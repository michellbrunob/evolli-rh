/**
 * Minha conta > Sessões ativas (T117) — reaproveita exclusivamente
 * `GET /v1/auth/sessions` e `DELETE /v1/auth/sessions/:id`, ambos já
 * existentes. Sem endpoint, migration, schema ou dependência novos.
 *
 * `GET /v1/auth/sessions` (`SessionService.listActiveForUser`) já escopa a
 * listagem à própria conta autenticada — nunca aceita nem devolve id de
 * outro usuário. Os únicos campos projetados são `id`, `createdAt`,
 * `lastSeenAt`, `expiresAt`, `ip` e `userAgent`: nunca token, cookie, hash ou
 * cabeçalho de autenticação. Este painel nunca oferece um campo para digitar
 * um id — toda revogação parte de um id que já veio dessa mesma listagem.
 *
 * Identificar "qual sessão é esta aba": a API não expõe isso em nenhum
 * endpoint (nem login, nem `/auth/csrf`, nem `/users/me` devolvem o id
 * interno da sessão) — não existe campo para marcar uma linha como "atual"
 * sem inventar uma regra. Em vez de adivinhar, este painel reage ao que o
 * próprio backend já decide: depois de qualquer revogação bem-sucedida, ele
 * tenta recarregar a lista; se essa releitura responder 401, é porque a
 * sessão usada por ESTA aba para fazer a chamada não existe mais — ou seja,
 * a sessão revogada era a própria (`onSessaoAtualEncerrada`). Se a releitura
 * funcionar normalmente, a sessão revogada era outra, e a lista atualizada
 * (uma linha a menos) é exibida sem afetar a sessão corrente. O mesmo
 * raciocínio vale para a carga inicial: um 401 ali também significa "esta
 * sessão não é mais válida".
 */
import { useCallback, useEffect, useId, useState } from "react";
import { Button, DataTable, EmptyState, Surface } from "../components";
import type { DataTableColumn } from "../components";
import {
  ApiError,
  type SessaoApi,
  listarSessoesAtivas,
  revogarSessao,
} from "../api/sessoesClient";
import "./SessoesAtivasPanel.css";

export interface SessoesAtivasPanelProps {
  aberto: boolean;
  onFechar: () => void;
  /** Chamado quando a própria sessão desta aba deixou de ser válida (foi a
   * sessão revogada, ou já havia expirado). Nunca chamado por revogar a
   * sessão de outra aba/dispositivo da mesma conta. */
  onSessaoAtualEncerrada: () => void;
}

function formatarDataHora(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

export function SessoesAtivasPanel({
  aberto,
  onFechar,
  onSessaoAtualEncerrada,
}: SessoesAtivasPanelProps) {
  const [status, setStatus] = useState<"carregando" | "erro" | "dados">(
    "carregando",
  );
  const [sessoes, setSessoes] = useState<SessaoApi[]>([]);
  const [revogandoId, setRevogandoId] = useState<string | null>(null);
  const [erroRevogar, setErroRevogar] = useState<string | null>(null);
  const tituloId = useId();

  const carregarSessoes = useCallback(async () => {
    setStatus("carregando");
    try {
      const lista = await listarSessoesAtivas();
      setSessoes(lista);
      setStatus("dados");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onSessaoAtualEncerrada();
        return;
      }
      setStatus("erro");
    }
  }, [onSessaoAtualEncerrada]);

  useEffect(() => {
    if (!aberto) return;
    setErroRevogar(null);
    void carregarSessoes();
  }, [aberto, carregarSessoes]);

  async function handleRevogar(id: string) {
    setRevogandoId(id);
    setErroRevogar(null);
    try {
      await revogarSessao(id);
    } catch (err) {
      setRevogandoId(null);
      if (err instanceof ApiError && err.status === 401) {
        onSessaoAtualEncerrada();
        return;
      }
      setErroRevogar(
        err instanceof Error
          ? err.message
          : "Não foi possível encerrar a sessão.",
      );
      return;
    }
    setRevogandoId(null);
    // Recarrega para saber se a sessão revogada era a desta aba (ver
    // cabeçalho do arquivo): um 401 aqui dispara `onSessaoAtualEncerrada`
    // de dentro de `carregarSessoes`, sem precisar adivinhar antes.
    await carregarSessoes();
  }

  if (!aberto) return null;

  const colunas: DataTableColumn<SessaoApi>[] = [
    {
      key: "dispositivo",
      header: "Dispositivo / navegador",
      cell: (s) => s.userAgent ?? "—",
    },
    { key: "ip", header: "IP", cell: (s) => s.ip ?? "—" },
    {
      key: "criada",
      header: "Criada em",
      cell: (s) => formatarDataHora(s.createdAt),
    },
    {
      key: "ultimaAtividade",
      header: "Última atividade",
      cell: (s) => formatarDataHora(s.lastSeenAt),
    },
    {
      key: "expira",
      header: "Expira em",
      cell: (s) => formatarDataHora(s.expiresAt),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (s) => (
        <Button
          variant="secondary"
          onClick={() => void handleRevogar(s.id)}
          disabled={revogandoId !== null}
        >
          {revogandoId === s.id ? "Encerrando…" : "Encerrar sessão"}
        </Button>
      ),
    },
  ];

  return (
    <Surface
      as="section"
      padding="lg"
      className="sessoes-ativas-painel"
      aria-labelledby={tituloId}
    >
      <div className="sessoes-ativas-painel__cabecalho">
        <h2 id={tituloId} className="sessoes-ativas-painel__titulo">
          Sessões ativas
        </h2>
        <Button variant="subtle" onClick={onFechar}>
          Fechar
        </Button>
      </div>
      <p className="sessoes-ativas-painel__aviso">
        Sessões ativas da sua própria conta, nesta e em outros dispositivos.
        Encerrar uma sessão derruba o acesso dela imediatamente — inclusive esta
        aba, se for a sessão que você está usando agora.
      </p>

      {status === "erro" ? (
        <div className="sessoes-ativas-painel__erro">
          <p role="alert">Não foi possível carregar suas sessões ativas.</p>
          <Button variant="secondary" onClick={() => void carregarSessoes()}>
            Tentar novamente
          </Button>
        </div>
      ) : status === "carregando" ? (
        <p className="sessoes-ativas-painel__carregando" role="status">
          Carregando sessões…
        </p>
      ) : sessoes.length === 0 ? (
        <EmptyState
          headingLevel={3}
          icon="—"
          title="Nenhuma sessão ativa"
          description="Quando houver uma sessão ativa nesta conta, ela aparece aqui."
        />
      ) : (
        <DataTable
          caption="Sessões ativas da sua conta"
          columns={colunas}
          rows={sessoes}
          rowKey={(s) => s.id}
        />
      )}

      {erroRevogar ? (
        <p className="sessoes-ativas-painel__erro-revogar" role="alert">
          {erroRevogar}
        </p>
      ) : null}
    </Surface>
  );
}
