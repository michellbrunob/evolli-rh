/**
 * T215 — "Ajustar período" (como a referência, 2026-11-26): quando a
 * contagem de férias recomeça fora dos 12 meses — férias coletivas (CLT,
 * art. 140), perda do direito (art. 133) ou outro motivo combinado com a
 * contabilidade.
 *
 * - Os reinícios já registrados, cada um com a lixeira (remove na hora; a
 *   janela fica aberta, como a referência).
 * - Quatro perguntas: a data do novo período (depois da admissão), o motivo
 *   (férias coletivas já marcada), os dias que o período anterior deu
 *   (em branco, o proporcional — "Calculado: N") e uma observação interna.
 * - "Períodos hoje" e, com a data, "Como os períodos vão ficar" — quem
 *   calcula é sempre o servidor.
 */
import { useEffect, useId, useRef, useState } from "react";
import type {
  MotivoReinicio,
  NovoReinicioDto,
  PeriodoAquisitivoApi,
  ReinicioApi,
  SimulacaoDeReinicioApi,
} from "../../../../api/ausenciasClient";
import { FormActions } from "../../../../components";
import { formatarDiaCivil } from "../../../../format/data";
import { Button, IconButton, Sheet } from "../../../../ui";
import { IconeCalendario, IconeRemover } from "../../../../ui/icones";
import "../../ferias/FeriasEAusencias.css";
import "./AjustarPeriodoGaveta.css";

export interface ServicoDeReinicio {
  readonly simularReinicio: (
    colaboradorId: string,
    proposta?: { inicio?: string; motivo?: MotivoReinicio; dias?: number },
  ) => Promise<SimulacaoDeReinicioApi>;
  readonly registrarReinicio: (
    colaboradorId: string,
    dto: NovoReinicioDto,
  ) => Promise<ReinicioApi>;
  readonly removerReinicio: (
    colaboradorId: string,
    reinicioId: string,
  ) => Promise<void>;
}

export const MOTIVOS_DE_REINICIO: readonly {
  readonly valor: MotivoReinicio;
  readonly rotulo: string;
  readonly ajuda: string;
  /** Como aparece no meio da frase ("Período encurtado: férias coletivas"). */
  readonly naFrase: string;
}[] = [
  {
    valor: "ferias_coletivas",
    rotulo: "Férias coletivas",
    ajuda:
      "Menos de 12 meses de casa: férias proporcionais e novo período (CLT, art. 140)",
    naFrase: "férias coletivas",
  },
  {
    valor: "perda_direito",
    rotulo: "Perda do direito",
    ajuda:
      "Licença remunerada ou paralisação acima de 30 dias, ou auxílio-doença acima de 6 meses (CLT, art. 133)",
    naFrase: "perda do direito",
  },
  {
    valor: "outro",
    rotulo: "Outro motivo",
    ajuda: "Ajuste combinado com a contabilidade",
    naFrase: "outro motivo",
  },
];

const ROTULO_DO_MOTIVO = Object.fromEntries(
  MOTIVOS_DE_REINICIO.map((m) => [m.valor, m.rotulo]),
) as Record<MotivoReinicio, string>;

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

function resumoDoPeriodo(p: PeriodoAquisitivoApi): string {
  const sufixo =
    p.situacao === "em_aquisicao"
      ? " · em aquisição"
      : p.situacao === "vencido"
        ? " · vencido"
        : "";
  return `${dias(p.direito)}${sufixo}`;
}

/** Recusa do servidor, na voz da tela. */
function mensagemDaRecusa(erro: unknown): string {
  const motivo = (erro as { erros?: readonly { motivo: string }[] }).erros?.[0]
    ?.motivo;
  switch (motivo) {
    case "ja_existe":
      return "Já existe um reinício nessa data.";
    case "ferias_sem_periodo":
      return "Há férias lançadas num período que deixaria de existir. Ajuste essas férias antes.";
    case "abaixo_das_ferias":
      return "O período anterior ficaria com menos dias do que as férias já lançadas nele.";
    case "antes_da_admissao":
      return "A data precisa ser depois da admissão.";
    default:
      return "Não foi possível ajustar o período. Tente de novo.";
  }
}

export function AjustarPeriodoGaveta({
  aberta,
  colaboradorId,
  primeiroNome,
  dataAdmissao,
  reinicios,
  servico,
  onFechar,
  onAlterado,
}: {
  readonly aberta: boolean;
  readonly colaboradorId: string;
  readonly primeiroNome: string;
  readonly dataAdmissao: string;
  readonly reinicios: readonly ReinicioApi[];
  readonly servico: ServicoDeReinicio;
  readonly onFechar: () => void;
  /** Depois de salvar (`fechar`) ou remover (a janela fica aberta). */
  readonly onAlterado: (mensagem: string, fechar: boolean) => void;
}) {
  const base = useId();
  const [inicio, setInicio] = useState("");
  const [motivo, setMotivo] = useState<MotivoReinicio>("ferias_coletivas");
  const [diasInformados, setDiasInformados] = useState("");
  const [observacao, setObservacao] = useState("");
  const [simulacao, setSimulacao] = useState<SimulacaoDeReinicioApi | null>(
    null,
  );
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pedido = useRef(0);

  // Abrir de novo começa do zero.
  useEffect(() => {
    if (!aberta) return;
    setInicio("");
    setMotivo("ferias_coletivas");
    setDiasInformados("");
    setObservacao("");
    setSimulacao(null);
    setFalha(null);
  }, [aberta]);

  const dataValida = inicio !== "" && inicio > dataAdmissao;
  const diasNumero = diasInformados === "" ? null : Number(diasInformados);
  const diasValidos =
    diasNumero === null ||
    (Number.isInteger(diasNumero) && diasNumero >= 0 && diasNumero <= 30);

  // "Períodos hoje" ou "Como os períodos vão ficar", sempre do servidor; a
  // resposta de um pedido antigo não sobrescreve a do mais novo.
  useEffect(() => {
    if (!aberta) return;
    const proposta =
      dataValida && diasValidos
        ? {
            inicio,
            motivo,
            ...(diasNumero !== null ? { dias: diasNumero } : {}),
          }
        : {};
    const este = ++pedido.current;
    servico.simularReinicio(colaboradorId, proposta).then(
      (s) => {
        if (este === pedido.current) setSimulacao(s);
      },
      () => {
        if (este === pedido.current) setSimulacao(null);
      },
    );
    // `reinicios` muda depois de remover: os períodos de hoje também.
  }, [
    aberta,
    colaboradorId,
    dataValida,
    diasValidos,
    inicio,
    motivo,
    diasNumero,
    servico,
    reinicios,
  ]);

  const simulando = dataValida && diasValidos;
  const alterado = inicio !== "" || diasInformados !== "" || observacao !== "";

  async function salvar() {
    if (!dataValida || !diasValidos || enviando) return;
    setEnviando(true);
    setFalha(null);
    try {
      await servico.registrarReinicio(colaboradorId, {
        inicio,
        motivo,
        ...(diasNumero !== null ? { diasPeriodoAnterior: diasNumero } : {}),
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      });
      onAlterado(
        "Período aquisitivo ajustado. O saldo já foi recalculado.",
        true,
      );
    } catch (erro) {
      setFalha(mensagemDaRecusa(erro));
    } finally {
      setEnviando(false);
    }
  }

  async function remover(r: ReinicioApi) {
    if (enviando) return;
    setEnviando(true);
    setFalha(null);
    try {
      await servico.removerReinicio(colaboradorId, r.id);
      onAlterado("Reinício removido. O saldo já foi recalculado.", false);
    } catch (erro) {
      setFalha(mensagemDaRecusa(erro));
    } finally {
      setEnviando(false);
    }
  }

  const tituloDaLista = simulando
    ? "Como os períodos vão ficar"
    : "Períodos hoje";

  return (
    <Sheet
      aberto={aberta}
      titulo="Período aquisitivo"
      subtitulo={`Quando a contagem de férias de ${primeiroNome} recomeça fora dos 12 meses.`}
      icone={<IconeCalendario tamanho={20} />}
      onFechar={onFechar}
      bloqueado={enviando}
      alterado={alterado}
      className="ausencias-gaveta ajustar-periodo"
      rodape={
        <FormActions>
          <Button type="button" variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!dataValida || !diasValidos || enviando}
            onClick={() => void salvar()}
          >
            {enviando ? "Salvando…" : "Salvar reinício"}
          </Button>
        </FormActions>
      }
    >
      {reinicios.length > 0 ? (
        <section
          className="ajustar-periodo__registrados"
          aria-labelledby={`${base}-registrados`}
        >
          <h3 id={`${base}-registrados`} className="ajustar-periodo__subtitulo">
            Reinícios registrados
          </h3>
          <ul className="ajustar-periodo__reinicios">
            {reinicios.map((r) => (
              <li key={r.id} className="ajustar-periodo__reinicio">
                <span className="ajustar-periodo__reinicio-textos">
                  <span className="ajustar-periodo__forte">
                    {`Novo período em ${formatarDiaCivil(r.inicio)}`}
                  </span>
                  <span className="ausencias-gaveta__ajuda">
                    {r.observacao
                      ? `${ROTULO_DO_MOTIVO[r.motivo]} · ${r.observacao}`
                      : ROTULO_DO_MOTIVO[r.motivo]}
                  </span>
                </span>
                <IconButton
                  label={`Remover reinício de ${formatarDiaCivil(r.inicio)}`}
                  icon={<IconeRemover tamanho={18} />}
                  variant="subtle"
                  disabled={enviando}
                  onClick={() => void remover(r)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ol className="ausencias-gaveta__perguntas">
        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo">
            Quando começa o novo período?
          </h3>
          <label className="ausencias-gaveta__data">
            <span>Primeiro dia do novo período</span>
            <input
              type="date"
              className="ausencias-gaveta__campo"
              value={inicio}
              aria-describedby={`${base}-data-ajuda`}
              {...(inicio !== "" && !dataValida
                ? { "aria-invalid": true }
                : {})}
              onChange={(e) => {
                setInicio(e.target.value);
                setFalha(null);
              }}
            />
          </label>
          <p
            id={`${base}-data-ajuda`}
            className={
              inicio !== "" && !dataValida
                ? "ajustar-periodo__erro"
                : "ausencias-gaveta__ajuda"
            }
          >
            {inicio !== "" && !dataValida
              ? "A data precisa ser depois da admissão."
              : "Nas férias coletivas, é o primeiro dia da coletiva."}
          </p>
        </li>

        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo" id={`${base}-motivo`}>
            Por que a contagem recomeça?
          </h3>
          <div
            role="radiogroup"
            aria-labelledby={`${base}-motivo`}
            className="ausencias-gaveta__escolhas"
          >
            {MOTIVOS_DE_REINICIO.map((m) => (
              <button
                key={m.valor}
                type="button"
                role="radio"
                aria-checked={motivo === m.valor}
                className="ausencias-gaveta__escolha-opcao"
                onClick={() => setMotivo(m.valor)}
              >
                <span className="ausencias-gaveta__escolha-titulo">
                  {m.rotulo}
                </span>
                <span className="ausencias-gaveta__ajuda">{m.ajuda}</span>
              </button>
            ))}
          </div>
        </li>

        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo" id={`${base}-dias`}>
            Quantos dias de férias o período anterior deu?
          </h3>
          <span className="ausencias-gaveta__opcional">Opcional</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={30}
            className="ausencias-gaveta__campo ajustar-periodo__dias"
            aria-labelledby={`${base}-dias`}
            aria-describedby={`${base}-dias-ajuda`}
            placeholder={
              simulacao?.diasCalculados !== null &&
              simulacao?.diasCalculados !== undefined
                ? `Calculado: ${simulacao.diasCalculados}`
                : undefined
            }
            {...(!diasValidos ? { "aria-invalid": true } : {})}
            value={diasInformados}
            onChange={(e) => setDiasInformados(e.target.value)}
          />
          <p
            id={`${base}-dias-ajuda`}
            className={
              diasValidos ? "ausencias-gaveta__ajuda" : "ajustar-periodo__erro"
            }
          >
            {diasValidos
              ? "Em branco, o Evolli calcula pelos meses trabalhados (2,5 dias por mês)."
              : "Informe de 0 a 30 dias."}
          </p>
        </li>

        <li className="ausencias-gaveta__pergunta">
          <h3 className="ausencias-gaveta__titulo" id={`${base}-obs`}>
            Observação interna
          </h3>
          <span className="ausencias-gaveta__opcional">Opcional</span>
          <textarea
            className="ausencias-gaveta__campo ausencias-gaveta__observacao"
            aria-labelledby={`${base}-obs`}
            placeholder="Ex.: coletiva de fim de ano, conforme a contabilidade"
            maxLength={300}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </li>
      </ol>

      <section className="ajustar-periodo__periodos">
        <h3 className="ajustar-periodo__subtitulo">{tituloDaLista}</h3>
        {simulacao ? (
          <ul className="ajustar-periodo__lista" aria-label={tituloDaLista}>
            {simulacao.periodos.map((p) => (
              <li key={p.inicio} className="ajustar-periodo__periodo">
                <span className="ajustar-periodo__forte">
                  {`${formatarDiaCivil(p.inicio)} – ${formatarDiaCivil(p.fim)}`}
                </span>
                <span className="ausencias-gaveta__ajuda">
                  {resumoDoPeriodo(p)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {falha ? (
        <p className="ausencias-gaveta__falha" role="alert">
          {falha}
        </p>
      ) : null}
    </Sheet>
  );
}
