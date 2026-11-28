/**
 * T216 — a gaveta de um modelo pronto da Personalizada: perguntas, tempo e
 * formato no cabeçalho; a descrição e "Quando usar"; cada seção ("Seção N ·
 * título") com as perguntas, o tipo de cada uma, "Mostra outra pergunta"
 * (a origem de uma condição) e "Opcional"; a nota de que tudo pode ser
 * editado e os botões "Fechar" e "Usar este modelo".
 */
import type { TipoPergunta } from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { Sheet } from "../../../../ui";
import { IconeDoModelo } from "../../componentes";
import { totalDePerguntas } from "../../modelosDePesquisa";
import { minutosEstimados } from "../../tempoEstimado";
import { textoParaOPainel } from "../empresa";
import type { ModeloDaGaleria, PerguntaDoModelo } from "../tipos";
import "./Personalizada.css";

/** O nome do tipo da pergunta, como no editor da Personalizada. */
export const TIPO_NA_GAVETA: Readonly<Record<TipoPergunta, string>> = {
  texto_curto: "Resposta curta",
  paragrafo: "Parágrafo",
  escolha_unica: "Escolha única",
  multipla_escolha: "Múltipla escolha",
  sim_nao: "Sim ou não",
  concordancia: "Concordância 1 a 5",
  concordancia_4: "Concordância · 4 pontos",
  satisfacao_4: "Satisfação · 4 pontos",
  nota_0_10: "Nota 0 a 10",
  estrelas: "Estrelas 1 a 5",
  escala: "Escala personalizada",
  data: "Data",
  numero: "Número",
  escolha_forcada: "Bloco de frases",
};

/** Os minutos do card e da gaveta (o do modelo, ou a estimativa). */
export function minutosDoSubmodelo(m: ModeloDaGaleria): number {
  return m.minutos ?? minutosEstimados(totalDePerguntas(m));
}

/** "8 perguntas · 2 min" (card) e, com o formato, o cabeçalho da gaveta. */
export function resumoDoSubmodelo(
  m: ModeloDaGaleria,
  comFormato = false,
): string {
  const base = `${plural(totalDePerguntas(m), "pergunta", "perguntas")} · ${minutosDoSubmodelo(m)} min`;
  return comFormato ? `${base} · ${formatoDe(m)}` : base;
}

export const formatoDe = (m: ModeloDaGaleria) =>
  m.formato ?? "Cada pessoa responde";

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function GavetaDoSubmodelo({
  modelo: m,
  onFechar,
  onUsar,
}: {
  readonly modelo: ModeloDaGaleria | null;
  readonly onFechar: () => void;
  readonly onUsar: (id: string) => void;
}) {
  const todas = m ? m.secoes.flatMap((s) => s.perguntas) : [];
  const mostraOutra = (p: PerguntaDoModelo) =>
    p.ref !== undefined && todas.some((x) => x.condicao?.ref === p.ref);
  return (
    <Sheet
      aberto={m !== null}
      className="pesquisas__janela"
      titulo={m?.nome ?? ""}
      subtitulo={m ? resumoDoSubmodelo(m, true) : ""}
      icone={m ? <IconeDoModelo id={m.id} /> : undefined}
      onFechar={onFechar}
      rodape={
        m ? (
          <div className="submodelo__rodape">
            <p className="pesquisas__suave">
              Tudo pode ser editado depois de usar o modelo.
            </p>
            <div className="pesquisas__gaveta-rodape">
              <Button variant="secondary" onClick={onFechar}>
                Fechar
              </Button>
              <Button onClick={() => onUsar(m.id)}>Usar este modelo</Button>
            </div>
          </div>
        ) : null
      }
    >
      {m ? (
        <div className="submodelo">
          <p>{m.descricao}</p>
          <p className="pesquisas__suave">{`Quando usar: ${minuscula(m.frequencia)}`}</p>
          {m.secoes.map((s, i) => {
            const nome = `Seção ${i + 1}${s.titulo ? ` · ${s.titulo}` : ""}`;
            return (
              <section
                key={nome}
                className="submodelo__secao"
                aria-label={nome}
              >
                <p className="submodelo__secao-titulo">
                  <span className="pesquisas__suave">{`Seção ${i + 1}`}</span>
                  {s.titulo ? <strong>{s.titulo}</strong> : null}
                </p>
                <ol className="submodelo__perguntas">
                  {s.perguntas.map((p, j) => (
                    <li key={`${i}-${j}`}>
                      <span>{textoParaOPainel(p.texto)}</span>
                      <span className="submodelo__selos">
                        <span className="galeria__selo" data-tom="cinza">
                          {TIPO_NA_GAVETA[p.tipo]}
                        </span>
                        {mostraOutra(p) ? (
                          <span className="galeria__selo" data-tom="rosa">
                            Mostra outra pergunta
                          </span>
                        ) : null}
                        {p.obrigatoria === false ? (
                          <span className="galeria__selo" data-tom="cinza">
                            Opcional
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      ) : null}
    </Sheet>
  );
}
