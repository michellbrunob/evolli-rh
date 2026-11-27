/**
 * T216 — aviso de quem não consegue confirmar quem é no link (sem CPF ou sem
 * data de nascimento na ficha). Só na identificada e na confidencial; não
 * bloqueia a publicação. Cada nome abre a ficha da pessoa em outra aba, para
 * o assistente ou os resultados continuarem onde estão.
 */
import type {
  Identificacao,
  ParticipanteDaPesquisa,
} from "../../api/pesquisasClient";
import { rotaDaFicha } from "../../app/rotasDoShell";
import { plural } from "../../format/plural";
import { IconeAviso } from "../../ui/icones";

export function textoDosNaoIdentificaveis(n: number): string {
  const um = n === 1;
  return `${plural(n, "pessoa não tem", "pessoas não têm")} CPF ou data de nascimento na ficha e não ${um ? "consegue" : "conseguem"} confirmar quem ${um ? "é" : "são"} no link. Complete o cadastro antes de enviar.`;
}

export function AvisoNaoIdentificaveis({
  identificacao,
  naoIdentificaveis,
  participantes,
}: {
  readonly identificacao: Identificacao;
  /** Ausente (API antiga) ou zero: nada aparece. */
  readonly naoIdentificaveis: number | undefined;
  readonly participantes: readonly ParticipanteDaPesquisa[];
}) {
  if (identificacao === "anonima") return null;
  if (!naoIdentificaveis || naoIdentificaveis <= 0) return null;
  const pessoas = participantes.filter((p) => p.identificavel === false);
  return (
    <section
      className="pesquisas__alerta"
      aria-label="Pessoas que não conseguem se identificar"
    >
      <span className="pesquisas__alerta-icone" aria-hidden="true">
        <IconeAviso tamanho={20} />
      </span>
      <div className="pesquisas__alerta-corpo">
        <p className="pesquisas__forte">
          {textoDosNaoIdentificaveis(naoIdentificaveis)}
        </p>
        {pessoas.length > 0 ? (
          <ul className="pesquisas__alerta-lista">
            {pessoas.map((p) => (
              <li key={p.colaboradorId}>
                <a
                  href={rotaDaFicha({
                    colaboradorId: p.colaboradorId,
                    aba: "dados",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {p.nome}
                  <span className="pesquisas__so-leitor">
                    {" "}
                    (abre a ficha em outra aba)
                  </span>
                </a>
                {p.departamento ? (
                  <span className="pesquisas__suave">{` · ${p.departamento}`}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
