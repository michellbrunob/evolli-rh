/**
 * T216 — cartão "Encerrar automaticamente": ícone e título, interruptor à
 * direita; ligado, já sugere a data daqui a 14 dias às 23:59 (horário de
 * Brasília), com data e hora lado a lado na largura do cartão. A frase que
 * explica o que acontece fica numa caixa cinza com ícone.
 *
 * `compacto` (coluna estreita de "Editar pesquisa"): "Encerramento", a frase
 * embaixo do título e os campos um embaixo do outro.
 */
import { useId } from "react";
import { formatarDiaCivil } from "../../format/data";
import { IconeCalendario, IconeLocal, IconeTempo } from "../../ui/icones";
import {
  DIAS_PADRAO,
  HORA_PADRAO,
  diasDepois,
  erroDoEncerramento,
} from "./encerramento";

export function CartaoDeEncerramento({
  data,
  hora,
  hoje,
  erro,
  compacto = false,
  onMudar,
}: {
  /** `null` sem prazo. */
  readonly data: string | null;
  readonly hora: string;
  readonly hoje: string;
  /** O erro da validação da etapa; sem ele, o campo já avisa ao digitar. */
  readonly erro?: string | undefined;
  readonly compacto?: boolean;
  readonly onMudar: (m: {
    encerraEm: string | null;
    encerraHora: string;
  }) => void;
}) {
  const ids = useId();
  const ligado = data !== null;
  // A data passada aparece já no campo, sem esperar o avanço da etapa.
  const aviso = erro ?? erroDoEncerramento(data, hora, hoje) ?? undefined;
  const titulo = compacto ? "Encerramento" : "Encerrar automaticamente";
  const frase = ligado
    ? data
      ? `Depois de ${formatarDiaCivil(data)} às ${hora}, o link avisa que a pesquisa encerrou e não aceita mais respostas. Você ainda pode finalizar antes, pelo status.`
      : "Depois da data e da hora escolhidas, o link avisa que a pesquisa encerrou e não aceita mais respostas."
    : "Sem prazo, a pesquisa fica aberta até você mudar o status para Finalizada.";
  return (
    <section
      className={`pesquisas__cartao-secao pesquisas__encerramento-cartao${compacto ? " pesquisas__encerramento-cartao--compacto" : ""}`}
      aria-label={titulo}
      {...(ligado ? { "data-ligado": "" } : {})}
    >
      <header className="pesquisas__encerramento-cabeca">
        {compacto ? null : (
          <span className="pesquisas__encerramento-icone" aria-hidden="true">
            <IconeCalendario tamanho={16} />
          </span>
        )}
        <div className="pesquisas__encerramento-textos">
          <h2 className="pesquisas__cartao-secao-titulo">{titulo}</h2>
          <p className="pesquisas__suave">
            {compacto
              ? frase
              : "A pesquisa fecha sozinha na data escolhida e deixa de aceitar respostas."}
          </p>
        </div>
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
      </header>
      {ligado ? (
        <div className="pesquisas__encerramento">
          <div className="pesquisas__encerramento-campos">
            <div className="pesquisas__campos">
              <label htmlFor={`${ids}-data`} className="pesquisas__rotulo">
                Data de encerramento
              </label>
              <input
                id={`${ids}-data`}
                type="date"
                min={hoje}
                className="pesquisas__campo"
                value={data ?? ""}
                aria-invalid={aviso ? true : undefined}
                {...(aviso ? { "aria-describedby": `${ids}-erro` } : {})}
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
                className="pesquisas__campo"
                value={hora}
                onChange={(e) =>
                  onMudar({ encerraEm: data, encerraHora: e.target.value })
                }
              />
            </div>
          </div>
          <p className="pesquisas__suave pesquisas__com-icone pesquisas__encerramento-fuso">
            <IconeLocal tamanho={12} />
            Horário de Brasília
          </p>
          {aviso ? (
            <p id={`${ids}-erro`} className="pesquisas__erro" role="alert">
              {aviso}
            </p>
          ) : null}
        </div>
      ) : null}
      {compacto ? null : (
        <p className="pesquisas__nota-cinza pesquisas__com-icone" role="note">
          <IconeTempo tamanho={14} />
          {frase}
        </p>
      )}
    </section>
  );
}
