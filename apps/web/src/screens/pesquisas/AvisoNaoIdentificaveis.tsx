/**
 * T216 — aviso de quem não consegue confirmar quem é no link (sem CPF ou sem
 * data de nascimento na ficha). Só na identificada e na confidencial; não
 * bloqueia a publicação. Mostra a contagem e "Ver lista" (gaveta com os
 * nomes); cada nome abre a ficha da pessoa em outra aba, para o assistente
 * ou os resultados continuarem onde estão.
 */
import { useState } from "react";
import type {
  Identificacao,
  ParticipanteDaPesquisa,
} from "../../api/pesquisasClient";
import { rotaDaFicha } from "../../app/rotasDoShell";
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { Sheet } from "../../ui";
import { IconeAviso } from "../../ui/icones";

export function textoDosNaoIdentificaveis(
  n: number,
  publicada = false,
): string {
  const um = n === 1;
  return `${plural(n, "pessoa não tem", "pessoas não têm")} CPF ou data de nascimento na ficha e não ${um ? "consegue" : "conseguem"} confirmar quem ${um ? "é" : "são"} no link. ${
    publicada
      ? "Complete o cadastro para que consigam responder."
      : "Complete o cadastro antes de enviar."
  }`;
}

export function AvisoNaoIdentificaveis({
  identificacao,
  naoIdentificaveis,
  participantes,
  publicada = false,
}: {
  readonly identificacao: Identificacao;
  /** Ausente (API antiga) ou zero: nada aparece. */
  readonly naoIdentificaveis: number | undefined;
  readonly participantes: readonly ParticipanteDaPesquisa[];
  /** Já publicada: o texto não fala em "antes de enviar". */
  readonly publicada?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
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
          {textoDosNaoIdentificaveis(naoIdentificaveis, publicada)}
        </p>
        {pessoas.length > 0 ? (
          <div>
            <Button variant="subtle" onClick={() => setAberta(true)}>
              Ver lista
            </Button>
          </div>
        ) : null}
      </div>
      <Sheet
        aberto={aberta}
        titulo="Sem CPF ou data de nascimento"
        subtitulo={plural(pessoas.length, "pessoa", "pessoas")}
        onFechar={() => setAberta(false)}
      >
        <ul
          className="pesquisas__lista-pessoas"
          aria-label="Pessoas sem os dados"
        >
          {pessoas.map((p) => (
            <li key={p.colaboradorId}>
              <span className="pesquisas__pessoa-textos">
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
                  <span className="pesquisas__suave">{p.departamento}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </section>
  );
}
