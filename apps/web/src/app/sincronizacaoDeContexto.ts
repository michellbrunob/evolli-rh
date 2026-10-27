/**
 * T189 — aviso entre abas de que a empresa ativa mudou.
 *
 * ## O problema
 *
 * A empresa ativa vive na SESSÃO (T163), e todas as abas do mesmo navegador
 * compartilham o mesmo cookie de sessão. Trocar de empresa numa aba muda o
 * contexto do servidor para todas — e as outras continuariam mostrando a
 * empresa anterior, com o que fosse salvo nelas indo para a nova.
 *
 * ## A mitigação
 *
 * Depois de uma troca confirmada pelo servidor, esta aba avisa as outras por
 * `BroadcastChannel`. Quem recebe o aviso **não acredita nele**: reconfere
 * `GET /v1/users/me` e só então recria a tela no contexto que o servidor
 * informou. O aviso não carrega id, nome nem código de empresa — só "algo
 * mudou, confira".
 *
 * É mitigação no navegador, e só isso: uma requisição já em voo, ou uma aba de
 * navegador sem `BroadcastChannel`, escapam dela. A correção definitiva é o
 * servidor recusar a requisição cuja empresa esperada diverge da ativa — fora
 * desta tarefa, porque muda a API.
 *
 * Sem `localStorage`: ele seria um segundo lugar com "a empresa" escrita pelo
 * navegador, que é exatamente o que a T163 proíbe.
 */

const NOME_DO_CANAL = "evolli-contexto-empresarial";

interface MensagemDeContexto {
  readonly tipo: "contexto-empresarial-alterado";
}

export interface CanalDeContexto {
  /** Avisa as OUTRAS abas (a própria não recebe). */
  avisar(): void;
  /** Registra quem reage ao aviso; devolve o cancelamento. */
  ouvir(ouvinte: () => void): () => void;
  fechar(): void;
}

function ehMensagemDeContexto(dado: unknown): dado is MensagemDeContexto {
  return (
    typeof dado === "object" &&
    dado !== null &&
    (dado as { tipo?: unknown }).tipo === "contexto-empresarial-alterado"
  );
}

/** O canal, ou `null` onde o navegador não oferece `BroadcastChannel`. */
export function abrirCanalDeContexto(): CanalDeContexto | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const canal = new BroadcastChannel(NOME_DO_CANAL);
  return {
    avisar() {
      const mensagem: MensagemDeContexto = {
        tipo: "contexto-empresarial-alterado",
      };
      canal.postMessage(mensagem);
    },
    ouvir(ouvinte) {
      const aoReceber = (evento: MessageEvent) => {
        if (ehMensagemDeContexto(evento.data)) ouvinte();
      };
      canal.addEventListener("message", aoReceber);
      return () => canal.removeEventListener("message", aoReceber);
    },
    fechar() {
      canal.close();
    },
  };
}
