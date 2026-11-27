/**
 * T215 — "Publicar a escala", como a referência: o período (a semana, o mês
 * ou 4 semanas), quantas alocações são novas, alteradas ou removidas,
 * quantas pessoas, "O período já começou" quando é o caso, e o aviso às
 * pessoas (registrado; o envio pelo Portal e por e-mail depende dessas
 * integrações). Publica todo o rascunho do período escolhido de uma vez.
 */
import { useEffect, useId, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import { Button, Dialog } from "../../../ui";
import { plural } from "../../../format/plural";
import { diaDaSemanaEDiaMes } from "../../../format/data";
import { somarDias } from "../../pessoas/ficha/escala/calendarioDaEscala";
import type { AvisoDaEscala } from "./avisosDaEscala";
import type {
  PeriodoDaPublicacao,
  ResumoDaPublicacao,
} from "./publicacaoDaEscala";

export function DialogoPublicar({
  periodos,
  resumoInicial,
  resumir,
  hoje,
  onPublicar,
  onFechar,
  avisos = [],
  onVerAvisos,
  avisarPadrao = true,
  antecedenciaDias = 0,
}: {
  /** Os períodos (o do quadro primeiro). */
  readonly periodos: readonly PeriodoDaPublicacao[];
  /** O resumo do primeiro período (já carregado no quadro). */
  readonly resumoInicial: ResumoDaPublicacao;
  /** O resumo de outro período (lê o quadro dele). */
  readonly resumir: (
    inicio: string,
    fim: string,
  ) => Promise<ResumoDaPublicacao>;
  readonly hoje: string;
  readonly onPublicar: (
    avisar: boolean,
    inicio: string,
    fim: string,
  ) => Promise<void>;
  readonly onFechar: () => void;
  /** Avisos de atenção da CLT que continuam no período do quadro. */
  readonly avisos?: readonly AvisoDaEscala[];
  readonly onVerAvisos?: () => void;
  /** O aviso às pessoas vem marcado? (Regras › Publicação) */
  readonly avisarPadrao?: boolean;
  /** Antecedência mínima das Regras (dias). */
  readonly antecedenciaDias?: number;
}) {
  const id = useId();
  const [avisar, setAvisar] = useState(avisarPadrao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState(0);
  const [resumo, setResumo] = useState<ResumoDaPublicacao | null>(
    resumoInicial,
  );
  const periodo = periodos[escolhido]!;

  // Outro período: lê o resumo dele (o do quadro já veio pronto).
  useEffect(() => {
    if (escolhido === 0) {
      setResumo(resumoInicial);
      return;
    }
    let vivo = true;
    setResumo(null);
    resumir(periodo.inicio, periodo.fim).then(
      (r) => {
        if (vivo) setResumo(r);
      },
      () => {
        if (vivo) setErro("Não foi possível ler o período. Tente de novo.");
      },
    );
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolhido]);

  const jaComecou = periodo.inicio <= hoje;
  const antecedenciaFaltando =
    !jaComecou &&
    antecedenciaDias > 0 &&
    periodo.inicio < somarDias(hoje, antecedenciaDias)
      ? antecedenciaDias
      : null;

  const publicar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await onPublicar(avisar, periodo.inicio, periodo.fim);
    } catch (e) {
      setErro(
        e instanceof ApiError && e.codigo === "escala_nada_para_publicar"
          ? "Nada para publicar neste período."
          : "Não foi possível publicar. Tente de novo.",
      );
      setEnviando(false);
    }
  };

  return (
    <Dialog
      aberto
      titulo="Publicar a escala"
      descricao="As pessoas passam a ver a escala publicada; o rascunho do período deixa de existir."
      onFechar={onFechar}
      bloqueado={enviando}
      className="dialogo-publicar"
      rodape={
        <>
          <Button variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={publicar}
            disabled={enviando || resumo === null}
          >
            {avisos.length > 0 ? "Publicar mesmo assim" : "Publicar"}
          </Button>
        </>
      }
    >
      <label className="painel-dia__campo painel-dia__campo--largo">
        <span>Período</span>
        <select
          value={escolhido}
          disabled={enviando}
          onChange={(e) => {
            setErro(null);
            setEscolhido(Number(e.target.value));
          }}
        >
          {periodos.map((p, i) => (
            <option key={p.rotulo} value={i}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <dl className="dialogo-publicar__resumo" aria-busy={resumo === null}>
        {(
          [
            ["Alocações novas", resumo?.novas],
            ["Alteradas", resumo?.alteradas],
            ["Removidas", resumo?.removidas],
            ["Pessoas afetadas", resumo?.pessoas],
          ] as const
        ).map(([rotulo, n]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{n ?? "…"}</dd>
          </div>
        ))}
      </dl>
      {jaComecou ? (
        <p role="note" className="dialogo-publicar__comecou">
          O período já começou. Avise as pessoas o quanto antes.
        </p>
      ) : null}
      {avisos.length > 0 ? (
        <div role="note" className="dialogo-publicar__clt">
          <p className="painel-dia__subtitulo">
            {avisos.length === 1
              ? "1 aviso da CLT continua no período"
              : `${avisos.length} avisos da CLT continuam no período`}
          </p>
          <ul>
            {avisos.slice(0, 3).map((a, i) => (
              <li
                key={i}
              >{`${a.nome}, ${diaDaSemanaEDiaMes(a.dia)}: ${a.titulo}`}</li>
            ))}
          </ul>
          {onVerAvisos ? (
            <Button variant="subtle" onClick={onVerAvisos}>
              Ver avisos
            </Button>
          ) : null}
        </div>
      ) : null}
      {antecedenciaFaltando !== null ? (
        <p role="note" className="dialogo-publicar__ajuda">
          {`As Regras pedem publicar ${plural(antecedenciaFaltando, "dia", "dias")} antes do início; este período começa antes disso.`}
        </p>
      ) : null}
      <div className="dialogo-publicar__aviso">
        <input
          id={`${id}-avisar`}
          type="checkbox"
          checked={avisar}
          onChange={(e) => setAvisar(e.target.checked)}
          aria-describedby={`${id}-avisar-ajuda`}
        />
        <label htmlFor={`${id}-avisar`}>
          Avisar as pessoas pelo Portal e por e-mail
        </label>
        <p id={`${id}-avisar-ajuda`} className="dialogo-publicar__ajuda">
          {`Só quem teve a escala mudada recebe (${plural(
            resumo?.pessoas ?? 0,
            "pessoa",
            "pessoas",
          )}). Quem não tem Portal não recebe nada. A escolha fica registrada; o envio começa quando o Portal e o e-mail estiverem ligados ao Evolli.`}
        </p>
      </div>
      {erro ? (
        <p role="alert" className="painel-dia__erro">
          {erro}
        </p>
      ) : null}
    </Dialog>
  );
}
