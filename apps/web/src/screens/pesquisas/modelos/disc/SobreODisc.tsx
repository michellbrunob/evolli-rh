/**
 * T216 — Perfil comportamental (DISC): a página "Sobre o modelo". O que o
 * modelo mede, o que o RH recebe (com um exemplo de resultado em dados
 * fictícios), os 4 fatores, a ficha técnica, como a pessoa responde e o uso
 * recomendado. "Ver os 28 blocos" abre a gaveta com todos os blocos.
 */
import { useState } from "react";
import { Button } from "../../../../components";
import { IconButton, Sheet } from "../../../../ui";
import {
  IconeCadeado,
  IconeEquipe,
  IconeTempo,
  IconeVer,
  IconeVoltar,
} from "../../../../ui/icones";
import { CartaoDeSecao, IconeDoModelo } from "../../componentes";
import { PESQUISAS_TITULO_ID } from "../../tituloDasPesquisas";
import { BLOCOS_DISC, PERGUNTA_DO_BLOCO } from "./blocos";
import { MINUTOS_DO_DISC, NUMERO_DE_BLOCOS } from "./definicao";
import { FATOR, FATORES } from "./fatores";
import { BarraDisc, LetraDoFator } from "./graficosDisc";
import "./Disc.css";

/** Exemplo fictício da prévia do resultado. */
const EXEMPLO = {
  respostas: 38,
  percentuais: { D: 16, I: 39, S: 29, C: 16 },
  pessoas: { D: 6, I: 15, S: 11, C: 6 },
} as const;

export function SobreODisc({
  onVoltar,
  onUsar,
}: {
  readonly onVoltar: () => void;
  readonly onUsar: (id: string) => void;
}) {
  const [gaveta, setGaveta] = useState(false);
  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <IconeDoModelo id="disc" tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            Perfil comportamental (DISC)
            <span className="pesquisas__selo">{`${NUMERO_DE_BLOCOS} blocos`}</span>
          </h1>
          <p className="pesquisas__subtitulo">
            Mostra como cada pessoa age, se comunica e decide. Ajuda a montar
            times, dar retorno e planejar o desenvolvimento.
          </p>
          <ul className="disc__chips" aria-label="Sobre a aplicação">
            <li>
              <IconeTempo tamanho={14} />{" "}
              {`Cerca de ${MINUTOS_DO_DISC} minutos para responder`}
            </li>
            <li>
              <IconeCadeado tamanho={14} /> Identificada, confidencial ou
              anônima
            </li>
            <li>
              <IconeEquipe tamanho={14} /> Resultado individual e do time
            </li>
          </ul>
        </div>
        <div className="pesquisas__acoes-topo">
          <Button variant="secondary" onClick={() => setGaveta(true)}>
            <IconeVer tamanho={16} />
            {`Ver os ${NUMERO_DE_BLOCOS} blocos`}
          </Button>
          <Button onClick={() => onUsar("disc")}>Criar pesquisa →</Button>
        </div>
      </header>

      <section className="disc-sobre__faixa" aria-label="O que você recebe">
        <div>
          <p className="disc-sobre__sobretitulo">O que você recebe</p>
          <h2 className="pesquisas__cartao-secao-titulo">
            O perfil de cada pessoa e um retrato do time
          </h2>
          <ul className="disc-sobre__itens">
            <li>
              <span className="disc-sobre__visto" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Perfil individual</strong> — fator predominante, pontos
                fortes, pontos de atenção e como lidar com cada pessoa.
              </span>
            </li>
            <li>
              <span className="disc-sobre__visto" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Mapa do time</strong> — distribuição dos perfis, áreas
                de talento, diversidade e compatibilidade.
              </span>
            </li>
            <li>
              <span className="disc-sobre__visto" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Relatório e planilha</strong> — o perfil do time em PDF
                e todos os resultados em Excel.
              </span>
            </li>
          </ul>
        </div>
        <div className="disc-sobre__janela" aria-label="Exemplo de resultado">
          <p className="disc-sobre__bolinhas">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            {`Exemplo · ${EXEMPLO.respostas} respostas`}
          </p>
          <div className="disc__time-cabeca">
            <span className="disc__letras">
              <LetraDoFator fator="I" tamanho="sm" />
              <LetraDoFator fator="S" tamanho="sm" />
            </span>
            <strong>Perfil do time · Elo do time</strong>
          </div>
          <BarraDisc
            percentuais={EXEMPLO.percentuais}
            rotulo="Exemplo de composição do time"
          />
          <ul className="disc__grade disc__grade--4">
            {FATORES.map((f) => (
              <li key={f} className="disc__cartao">
                <span className="disc__cartao-topo">
                  <LetraDoFator fator={f} tamanho="sm" />
                  {FATOR[f].nome}
                </span>
                <p>{`${EXEMPLO.pessoas[f]} pessoas`}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="disc-sobre__colunas">
        <CartaoDeSecao
          titulo="Os 4 fatores do DISC"
          descricao="Todo mundo tem os 4; o que muda é a intensidade de cada um."
        >
          {FATORES.map((f) => (
            <div key={f} className="disc-sobre__fator">
              <LetraDoFator fator={f} tamanho="lg" />
              <div>
                <p>
                  <strong>{FATOR[f].nome}</strong> — {FATOR[f].foco}
                </p>
                <p className="pesquisas__suave">
                  {FATOR[f].palavras.join(" · ")}
                </p>
                <ul className="disc__chips">
                  {FATOR[f].comportamentos.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </CartaoDeSecao>
        <div className="disc">
          <CartaoDeSecao titulo="Ficha técnica">
            <dl className="disc-sobre__ficha">
              {(
                [
                  ["Instrumento", "DISC"],
                  ["Formato", `${NUMERO_DE_BLOCOS} blocos de 4 frases`],
                  ["Tempo", `Cerca de ${MINUTOS_DO_DISC} minutos`],
                  ["Resultado", "% de D, I, S e C"],
                  ["Identificação", "3 opções"],
                ] as const
              ).map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </CartaoDeSecao>
          <CartaoDeSecao
            titulo="Como a pessoa responde"
            descricao="Em cada bloco, escolhe a frase que mais combina com ela."
          >
            <p className="pesquisas__suave">{`BLOCO 1 DE ${NUMERO_DE_BLOCOS}`}</p>
            <p>
              <strong>{PERGUNTA_DO_BLOCO}</strong>
            </p>
            <ul className="disc__lista">
              {BLOCOS_DISC[0]!.frases.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </CartaoDeSecao>
          <CartaoDeSecao titulo="Uso recomendado">
            <p>
              O DISC descreve comportamento, não capacidade. Use o resultado
              para conversas e desenvolvimento, nunca como critério único de
              contratação, promoção ou desligamento.
            </p>
          </CartaoDeSecao>
        </div>
      </div>

      <Sheet
        aberto={gaveta}
        titulo="Perfil comportamental (DISC)"
        subtitulo={`${NUMERO_DE_BLOCOS} blocos prontos · os blocos não podem ser editados`}
        onFechar={() => setGaveta(false)}
      >
        <ol className="disc-blocos" aria-label="Blocos de frases">
          {BLOCOS_DISC.map((b, i) => (
            <li key={b.tema} className="disc-blocos__item">
              <p className="disc-blocos__botao">
                <strong>{`Bloco ${String(i + 1).padStart(2, "0")}`}</strong>
                <span className="disc-blocos__tema">{b.tema}</span>
              </p>
              <ul className="disc-blocos__frases">
                {b.frases.map((t, j) => (
                  <li key={t}>
                    <LetraDoFator fator={FATORES[j]!} tamanho="sm" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
