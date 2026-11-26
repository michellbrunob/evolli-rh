/**
 * T215 — "Responder solicitação" (como a referência, 2026-11-26), aberta
 * pelo "Responder" do ⋯ de um pedido pendente, na ficha e na lista:
 *
 * - **Aprovar:** o período entra no calendário; mensagem opcional.
 * - **Sugerir outras datas:** o novo período (começa nas datas pedidas e
 *   precisa ser outro), com os dias, a volta e quanto andou; o porquê é
 *   opcional. O pedido fica em "Ajuste sugerido".
 * - **Recusar:** o motivo é obrigatório.
 *
 * Os dias e a volta vêm sempre do servidor (a mesma simulação do registro).
 */
import { useEffect, useId, useState } from "react";
import { FormActions } from "../../../components";
import { diaEMesAbreviado, formatarDiaCivil } from "../../../format/data";
import { Button, Sheet } from "../../../ui";
import { IconeRegistrarAusencia } from "../../../ui/icones";
import {
  type AusenciaApi,
  type ServicoDeAusencias,
  ROTULO_NA_LISTA,
} from "./tiposAusencia";
import "./FeriasEAusencias.css";

type Resposta = "aprovar" | "sugerir" | "recusar";

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);
const diasUteis = (n: number) => (n === 1 ? "1 dia útil" : `${n} dias úteis`);

function diasEntre(de: string, ate: string): number {
  const t = (d: string) =>
    Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(ate) - t(de)) / 86_400_000);
}

/** "um dia depois", "3 dias antes"; sem deslocamento do início, nada. */
function deslocamento(de: string, para: string): string | null {
  const n = diasEntre(de, para);
  if (n === 0) return null;
  const quantos = Math.abs(n) === 1 ? "um dia" : `${Math.abs(n)} dias`;
  return `${quantos} ${n > 0 ? "depois" : "antes"}`;
}

function mensagemDaRecusa(erro: unknown, nome: string): string {
  const motivo = (erro as { erros?: readonly { motivo: string }[] }).erros?.[0]
    ?.motivo;
  switch (motivo) {
    case "sobreposicao":
      return `Já existe uma ausência de ${nome} nessas datas.`;
    case "igual_ao_pedido":
      return "Escolha datas diferentes das que foram pedidas.";
    case "fim_antes_do_inicio":
      return "O último dia não pode ser antes do primeiro.";
    default:
      return "Não foi possível responder agora. Tente de novo.";
  }
}

export function ResponderAusenciaJanela({
  ausencia,
  servico,
  onFechar,
  onRespondida,
}: {
  /** O pedido a responder; `null` fecha a janela. */
  readonly ausencia: AusenciaApi | null;
  readonly servico: ServicoDeAusencias;
  readonly onFechar: () => void;
  readonly onRespondida: (aviso: string) => void;
}) {
  const base = useId();
  const a = ausencia;
  const nome = a
    ? (a.colaborador.nome.split(" ")[0] ?? a.colaborador.nome)
    : "";
  const [resposta, setResposta] = useState<Resposta>("aprovar");
  const [mensagem, setMensagem] = useState("");
  const [motivo, setMotivo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [voltaDoPedido, setVoltaDoPedido] = useState<string | null>(null);
  const [simulacao, setSimulacao] = useState<{
    dias: number | null;
    diasUteis: number | null;
    volta: string | null;
  } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Abrir começa do zero, nas datas do pedido.
  useEffect(() => {
    if (!a) return;
    setResposta("aprovar");
    setMensagem("");
    setMotivo("");
    setInicio(a.inicio);
    setFim(a.fim ?? a.inicio);
    setSimulacao(null);
    setVoltaDoPedido(null);
    setFalha(null);
  }, [a]);

  // A volta do pedido, pelo servidor.
  useEffect(() => {
    if (!a || !a.fim) return;
    const controle = new AbortController();
    servico
      .simular(
        {
          colaboradorId: a.colaborador.id,
          tipo: a.tipo,
          inicio: a.inicio,
          fim: a.fim,
          ignorar: a.id,
        },
        { signal: controle.signal },
      )
      .then(
        (s) => {
          if (!controle.signal.aborted) setVoltaDoPedido(s.volta);
        },
        () => undefined,
      );
    return () => controle.abort();
  }, [a, servico]);

  const igualAoPedido =
    a !== null && inicio === a.inicio && fim === (a.fim ?? a.inicio);
  const datasValidas = inicio !== "" && fim !== "" && fim >= inicio;

  // Sugerir: os dias e a volta do novo período, pelo servidor.
  useEffect(() => {
    if (!a || resposta !== "sugerir" || !datasValidas || igualAoPedido) {
      setSimulacao(null);
      return;
    }
    const controle = new AbortController();
    servico
      .simular(
        {
          colaboradorId: a.colaborador.id,
          tipo: a.tipo,
          inicio,
          fim,
          ignorar: a.id,
        },
        { signal: controle.signal },
      )
      .then(
        (s) => {
          if (!controle.signal.aborted) setSimulacao(s);
        },
        () => {
          if (!controle.signal.aborted) setSimulacao(null);
        },
      );
    return () => controle.abort();
  }, [a, resposta, inicio, fim, datasValidas, igualAoPedido, servico]);

  const podeEnviar =
    !enviando &&
    (resposta === "aprovar" ||
      (resposta === "recusar" && motivo.trim() !== "") ||
      (resposta === "sugerir" && datasValidas && !igualAoPedido));

  async function enviar() {
    if (!a || !podeEnviar) return;
    setEnviando(true);
    setFalha(null);
    try {
      if (resposta === "aprovar") {
        await servico.aprovar(a.id, mensagem.trim() || undefined);
        onRespondida("Ausência aprovada.");
      } else if (resposta === "recusar") {
        await servico.recusar(a.id, motivo.trim());
        onRespondida("Ausência recusada.");
      } else if (servico.sugerir) {
        await servico.sugerir(a.id, {
          inicio,
          fim,
          ...(mensagem.trim() ? { mensagem: mensagem.trim() } : {}),
        });
        onRespondida("Sugestão enviada.");
      }
    } catch (erro) {
      setFalha(mensagemDaRecusa(erro, nome));
    } finally {
      setEnviando(false);
    }
  }

  const data = a ? diaEMesAbreviado(a.inicio) : null;
  const opcoes: readonly {
    readonly valor: Resposta;
    readonly titulo: string;
    readonly ajuda: string;
  }[] = [
    {
      valor: "aprovar",
      titulo: "Aprovar",
      ajuda: `O período entra no calendário e ${nome} recebe o aviso.`,
    },
    ...(servico.sugerir
      ? [
          {
            valor: "sugerir" as const,
            titulo: "Sugerir outras datas",
            ajuda: `Proponha um novo período para ${nome} avaliar.`,
          },
        ]
      : []),
    {
      valor: "recusar",
      titulo: "Recusar",
      ajuda: `Explique o motivo para ${nome}.`,
    },
  ];
  const rotuloDoBotao =
    resposta === "aprovar"
      ? "Aprovar pedido"
      : resposta === "recusar"
        ? "Recusar pedido"
        : "Enviar sugestão";
  const desloc = a && simulacao ? deslocamento(a.inicio, inicio) : null;

  return (
    <Sheet
      aberto={a !== null}
      titulo="Responder solicitação"
      subtitulo={
        a
          ? `Registrada pelo RH em ${formatarDiaCivil(a.registradoEm.slice(0, 10))}`
          : ""
      }
      icone={<IconeRegistrarAusencia tamanho={20} />}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={mensagem !== "" || motivo !== ""}
      className="ausencias-gaveta responder"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!podeEnviar}
            onClick={() => void enviar()}
          >
            {enviando ? "Enviando…" : rotuloDoBotao}
          </Button>
        </FormActions>
      }
    >
      {a ? (
        <>
          <div className="responder__pedido">
            {data ? (
              <span className="responder__calendario" aria-hidden="true">
                <span className="responder__mes">{data.mes}</span>
                <span className="responder__dia">{data.dia}</span>
              </span>
            ) : null}
            <span className="responder__pedido-textos">
              <span className="responder__tipo">{ROTULO_NA_LISTA[a.tipo]}</span>
              {a.dias !== null && a.diasUteis !== null ? (
                <span className="ausencias-gaveta__ajuda">
                  {`${dias(a.dias)} · ${diasUteis(a.diasUteis)}`}
                </span>
              ) : null}
              {voltaDoPedido ? (
                <span className="ausencias-gaveta__ajuda">
                  {`Volta em ${formatarDiaCivil(voltaDoPedido)}`}
                </span>
              ) : null}
            </span>
          </div>

          <h3
            className="ausencias-gaveta__titulo responder__pergunta"
            id={`${base}-r`}
          >
            Qual a sua resposta?
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={`${base}-r`}
            className="ausencias-gaveta__escolhas"
          >
            {opcoes.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={resposta === o.valor}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => {
                  setResposta(o.valor);
                  setFalha(null);
                }}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  {o.titulo}
                </span>
                <span className="ausencias-gaveta__ajuda">{o.ajuda}</span>
              </button>
            ))}
          </div>

          {resposta === "sugerir" ? (
            <div className="responder__bloco">
              <h4 className="responder__subtitulo">Novo período sugerido</h4>
              <div className="ausencias-gaveta__datas">
                <label className="ausencias-gaveta__data">
                  <span>Primeiro dia</span>
                  <input
                    type="date"
                    className="ausencias-gaveta__campo"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                  />
                </label>
                <label className="ausencias-gaveta__data">
                  <span>Último dia</span>
                  <input
                    type="date"
                    className="ausencias-gaveta__campo"
                    min={inicio || undefined}
                    value={fim}
                    onChange={(e) => setFim(e.target.value)}
                  />
                </label>
              </div>
              {igualAoPedido ? (
                <p className="ausencias-gaveta__ajuda">
                  Escolha datas diferentes das que foram pedidas.
                </p>
              ) : simulacao &&
                simulacao.dias !== null &&
                simulacao.diasUteis !== null ? (
                <div className="ausencias-gaveta__resumo" role="status">
                  <p>
                    {`${dias(simulacao.dias)} (${diasUteis(simulacao.diasUteis)})${desloc ? ` · ${desloc}` : ""}`}
                  </p>
                  {simulacao.volta ? (
                    <p>{`Volta ao trabalho em ${formatarDiaCivil(simulacao.volta)}`}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {resposta === "recusar" ? (
            <div className="responder__bloco">
              <label className="responder__rotulo" htmlFor={`${base}-motivo`}>
                Motivo da recusa{" "}
                <span className="ausencias-gaveta__opcional">Obrigatório</span>
              </label>
              <textarea
                id={`${base}-motivo`}
                className="ausencias-gaveta__campo ausencias-gaveta__observacao"
                aria-label="Motivo da recusa"
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <p className="ausencias-gaveta__ajuda">
                {`${nome} verá esta mensagem.`}
              </p>
            </div>
          ) : (
            <div className="responder__bloco">
              <label className="responder__rotulo" htmlFor={`${base}-msg`}>
                {resposta === "sugerir"
                  ? "Por que outras datas?"
                  : `Mensagem para ${nome}`}{" "}
                <span className="ausencias-gaveta__opcional">Opcional</span>
              </label>
              <textarea
                id={`${base}-msg`}
                className="ausencias-gaveta__campo ausencias-gaveta__observacao"
                aria-label={
                  resposta === "sugerir"
                    ? "Por que outras datas?"
                    : `Mensagem para ${nome}`
                }
                maxLength={1000}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
              {resposta === "sugerir" ? (
                <p className="ausencias-gaveta__ajuda">
                  {`${nome} recebe a sugestão e pode aceitar ou pedir outra data.`}
                </p>
              ) : null}
            </div>
          )}

          {falha ? (
            <p className="ausencias-gaveta__falha" role="alert">
              {falha}
            </p>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
