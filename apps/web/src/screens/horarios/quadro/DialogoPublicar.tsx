/**
 * T215 — "Publicar a escala": o período, quantas alocações são novas ou
 * alteradas, quantas pessoas, e o aviso às pessoas (registrado; o envio pelo
 * Portal e por e-mail depende dessas integrações). Publica todo o rascunho do
 * período de uma vez.
 */
import { useId, useState } from "react";
import { ApiError } from "../../../api/colaboradoresClient";
import { Button, Dialog } from "../../../ui";
import { plural } from "../../../format/plural";
import { diaDaSemanaEDiaMes } from "../../../format/data";
import type { AvisoDaEscala } from "./avisosDaEscala";

export interface ResumoDaPublicacao {
  readonly novas: number;
  readonly alteradas: number;
  readonly pessoas: number;
}

export function DialogoPublicar({
  periodo,
  resumo,
  onPublicar,
  onFechar,
  avisos = [],
  onVerAvisos,
  avisarPadrao = true,
  antecedenciaFaltando = null,
}: {
  /** "Semana de 23 a 29 de novembro de 2026" ou "Novembro de 2026". */
  readonly periodo: string;
  readonly resumo: ResumoDaPublicacao;
  readonly onPublicar: (avisar: boolean) => Promise<void>;
  readonly onFechar: () => void;
  /** Avisos de atenção da CLT que continuam no período. */
  readonly avisos?: readonly AvisoDaEscala[];
  readonly onVerAvisos?: () => void;
  /** O aviso às pessoas vem marcado? (Regras › Publicação) */
  readonly avisarPadrao?: boolean;
  /** Antecedência mínima das Regras, quando o período começa antes dela. */
  readonly antecedenciaFaltando?: number | null;
}) {
  const id = useId();
  const [avisar, setAvisar] = useState(avisarPadrao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const publicar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await onPublicar(avisar);
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
          <Button variant="primary" onClick={publicar} disabled={enviando}>
            {avisos.length > 0 ? "Publicar mesmo assim" : "Publicar"}
          </Button>
        </>
      }
    >
      <dl className="dialogo-publicar__resumo">
        <div>
          <dt>Período</dt>
          <dd>{periodo}</dd>
        </div>
        <div>
          <dt>Alocações novas</dt>
          <dd>{resumo.novas}</dd>
        </div>
        <div>
          <dt>Alteradas</dt>
          <dd>{resumo.alteradas}</dd>
        </div>
        <div>
          <dt>Pessoas afetadas</dt>
          <dd>{resumo.pessoas}</dd>
        </div>
      </dl>
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
            resumo.pessoas,
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
