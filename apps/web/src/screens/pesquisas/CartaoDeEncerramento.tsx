/**
 * T216 — cartão "Encerrar automaticamente": interruptor; ligado, já sugere
 * a data daqui a 14 dias às 23:59 (horário de Brasília). A frase explica o
 * que acontece em cada caso.
 */
import { useId } from "react";
import { formatarDiaCivil } from "../../format/data";
import { CartaoDeSecao } from "./componentes";
import { DIAS_PADRAO, HORA_PADRAO, diasDepois } from "./encerramento";

export function CartaoDeEncerramento({
  data,
  hora,
  hoje,
  erro,
  onMudar,
}: {
  /** `null` sem prazo. */
  readonly data: string | null;
  readonly hora: string;
  readonly hoje: string;
  readonly erro?: string | undefined;
  readonly onMudar: (m: {
    encerraEm: string | null;
    encerraHora: string;
  }) => void;
}) {
  const ids = useId();
  const ligado = data !== null;
  return (
    <CartaoDeSecao
      titulo="Encerrar automaticamente"
      descricao={
        ligado
          ? data
            ? `Depois de ${formatarDiaCivil(data)} às ${hora}, o link avisa que a pesquisa encerrou e não aceita mais respostas.`
            : "Depois da data e da hora escolhidas, o link avisa que a pesquisa encerrou e não aceita mais respostas."
          : "Sem prazo, a pesquisa fica aberta até você mudar o status para Finalizada."
      }
      acao={
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          aria-label="Encerrar automaticamente"
          className="pesquisas__interruptor"
          onClick={() =>
            onMudar(
              ligado
                ? { encerraEm: null, encerraHora: hora }
                : {
                    encerraEm: diasDepois(hoje, DIAS_PADRAO),
                    encerraHora: HORA_PADRAO,
                  },
            )
          }
        >
          <span className="pesquisas__interruptor-trilho" aria-hidden="true" />
        </button>
      }
    >
      {ligado ? (
        <div className="pesquisas__encerramento">
          <div className="pesquisas__campos">
            <label htmlFor={`${ids}-data`} className="pesquisas__rotulo">
              Data de encerramento
            </label>
            <input
              id={`${ids}-data`}
              type="date"
              min={hoje}
              className="pesquisas__campo pesquisas__campo--curto"
              value={data ?? ""}
              aria-invalid={erro ? true : undefined}
              onChange={(e) =>
                onMudar({ encerraEm: e.target.value, encerraHora: hora })
              }
            />
          </div>
          <div className="pesquisas__campos">
            <label htmlFor={`${ids}-hora`} className="pesquisas__rotulo">
              Hora
            </label>
            <input
              id={`${ids}-hora`}
              type="time"
              className="pesquisas__campo pesquisas__campo--curto"
              value={hora}
              onChange={(e) =>
                onMudar({ encerraEm: data, encerraHora: e.target.value })
              }
            />
          </div>
          <p className="pesquisas__suave">Horário de Brasília</p>
          {erro ? (
            <p className="pesquisas__erro" role="alert">
              {erro}
            </p>
          ) : null}
        </div>
      ) : null}
    </CartaoDeSecao>
  );
}
