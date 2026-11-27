/**
 * T216 — Perfil comportamental (DISC): o cartão do questionário no
 * assistente. Os blocos não são editáveis; cada bloco abre e mostra as 4
 * frases com a letra do fator. Os primeiros aparecem; "Ver os outros N
 * blocos" mostra o resto.
 */
import { useState } from "react";
import type { Pergunta } from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { CartaoDeSecao } from "../../componentes";
import { PERGUNTA_DO_BLOCO } from "./blocos";
import { FATORES } from "./fatores";
import { LetraDoFator } from "./graficosDisc";
import "./Disc.css";

const VISIVEIS_DE_INICIO = 4;

export function CartaoDosBlocos({
  blocos,
}: {
  readonly blocos: readonly Pergunta[];
}) {
  const [aberto, setAberto] = useState<string | null>(blocos[0]?.id ?? null);
  const [todos, setTodos] = useState(false);
  const mostrados = todos ? blocos : blocos.slice(0, VISIVEIS_DE_INICIO);
  const restantes = blocos.length - mostrados.length;
  return (
    <CartaoDeSecao
      titulo="Blocos de frases"
      contador={String(blocos.length)}
      descricao="Metodologia DISC · os blocos não podem ser editados."
    >
      <p className="pesquisas__nota">
        {`Em todos os blocos a pergunta é a mesma: “${PERGUNTA_DO_BLOCO}” Quem responde escolhe uma das 4 frases; a ordem das frases muda de um bloco para outro.`}
      </p>
      <ol className="disc-blocos" aria-label="Blocos de frases">
        {mostrados.map((b, i) => {
          const expandido = aberto === b.id;
          const idFrases = `disc-bloco-${b.id}`;
          return (
            <li key={b.id} className="disc-blocos__item">
              <button
                type="button"
                className="disc-blocos__botao"
                aria-expanded={expandido}
                aria-controls={idFrases}
                onClick={() => setAberto(expandido ? null : b.id)}
              >
                <strong>{`Bloco ${i + 1} · 4 frases`}</strong>
                <span className="disc-blocos__tema">{b.rotulo ?? ""}</span>
                <span className="disc__letras" aria-hidden="true">
                  {FATORES.map((f) => (
                    <LetraDoFator key={f} fator={f} tamanho="sm" />
                  ))}
                </span>
              </button>
              {expandido ? (
                <ul id={idFrases} className="disc-blocos__frases">
                  {(b.config.opcoes ?? []).map((o) => (
                    <li key={o.id}>
                      {o.fator ? (
                        <LetraDoFator fator={o.fator} tamanho="sm" />
                      ) : null}
                      <span>{o.texto}</span>
                      {o.fator ? (
                        <span className="disc__sr">{`(fator ${o.fator})`}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
      {restantes > 0 ? (
        <Button variant="secondary" onClick={() => setTodos(true)}>
          {`Ver os outros ${restantes} blocos`}
        </Button>
      ) : null}
    </CartaoDeSecao>
  );
}
