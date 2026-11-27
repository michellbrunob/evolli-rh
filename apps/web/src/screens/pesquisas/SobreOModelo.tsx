/**
 * T216 — página "Sobre o modelo": o que o modelo mede, os números dele
 * (perguntas por tipo, comentário, frequência sugerida), as perguntas
 * agrupadas pelo jeito de responder, como a pessoa responde (uma pergunta
 * por tela) e o que o RH vê depois (um exemplo ilustrativo do resultado).
 */
import { Button } from "../../components";
import { plural } from "../../format/plural";
import { IconButton } from "../../ui";
import { IconeTempo, IconeVer, IconeVoltar } from "../../ui/icones";
import type { Pergunta } from "../../api/pesquisasClient";
import { useState } from "react";
import { CartaoDeSecao, IconeDoModelo } from "./componentes";
import { perguntasEmOrdem } from "./estadoDaPesquisa";
import { GavetaDoModelo } from "./GaleriaDeModelos";
import { BarrasPorNota, Rosca } from "./graficos";
import { corDaNota } from "./indicadores";
import {
  modeloDaGaleria,
  perguntasPrincipais,
  secoesDoModelo,
  totalDePerguntas,
} from "./modelosDePesquisa";
import { minutosEstimados } from "./PreVisualizacao";
import { PESQUISAS_TITULO_ID } from "./tituloDasPesquisas";

/** Como a pergunta é respondida, em poucas palavras (grupo da lista). */
export function grupoDaPergunta(p: Pergunta): string {
  switch (p.tipo) {
    case "escala":
      return `Escala de ${p.config.minimo ?? 1} a ${p.config.maximo ?? 5}`;
    case "nota_0_10":
      return p.config.enps ? "Recomendação (eNPS) · 0 a 10" : "Nota de 0 a 10";
    case "concordancia":
      return "Concordância · 1 a 5";
    case "estrelas":
      return "Estrelas · 1 a 5";
    case "escolha_unica":
    case "multipla_escolha":
      return "Escolha";
    case "sim_nao":
      return "Sim ou não";
    case "paragrafo":
    case "texto_curto":
      return "Resposta escrita";
    default:
      return "Outros formatos";
  }
}

/** Exemplo ilustrativo do resultado de uma pergunta de 1 a 10. */
const EXEMPLO = [0, 0, 0, 1, 0, 1, 2, 5, 6, 5].map((q, i) => ({
  valor: i + 1,
  quantidade: q,
}));

export function SobreOModelo({
  id,
  onVoltar,
  onUsar,
}: {
  readonly id: string;
  readonly onVoltar: () => void;
  readonly onUsar: (id: string) => void;
}) {
  const m = modeloDaGaleria(id);
  const [gaveta, setGaveta] = useState(false);
  const todas = perguntasEmOrdem(secoesDoModelo(m));
  const principais = todas.slice(0, perguntasPrincipais(m));
  const grupos = new Map<string, Pergunta[]>();
  for (const p of principais) {
    const g = grupoDaPergunta(p);
    grupos.set(g, [...(grupos.get(g) ?? []), p]);
  }
  const exemplo = principais.find((p) => p.tipo === "escala") ?? principais[0];
  const total = totalDePerguntas(m);
  const numeros: { valor: string; rotulo: string }[] = [
    ...[...grupos.entries()].slice(0, 2).map(([g, ps]) => ({
      valor: String(ps.length),
      rotulo: `${ps.length === 1 ? "pergunta" : "perguntas"} · ${g.toLowerCase()}`,
    })),
    ...(m.comentarioFinal ? [{ valor: "1", rotulo: "comentário livre" }] : []),
    { valor: m.frequencia, rotulo: "frequência sugerida" },
  ];
  let n = 0;

  return (
    <div className="pesquisas">
      <header className="pesquisas__cabecalho">
        <IconButton
          label="Voltar"
          icon={<IconeVoltar tamanho={18} />}
          className="pesquisas__voltar"
          onClick={onVoltar}
        />
        <IconeDoModelo id={m.id} tamanho="lg" />
        <div className="pesquisas__titulos">
          <h1
            id={PESQUISAS_TITULO_ID}
            className="pesquisas__titulo"
            tabIndex={-1}
          >
            {m.nome}
            <span className="pesquisas__selo pesquisas__selo--destaque">
              {m.ritmo}
            </span>
          </h1>
          <p className="pesquisas__subtitulo">{m.sobre}</p>
        </div>
        <div className="pesquisas__acoes-topo">
          <Button variant="secondary" onClick={() => setGaveta(true)}>
            <IconeVer tamanho={16} />
            Ver perguntas
          </Button>
          <Button onClick={() => onUsar(m.id)}>Criar pesquisa →</Button>
        </div>
      </header>

      <dl className="pesquisas__faixa" aria-label="Resumo do modelo">
        {numeros.map((x) => (
          <div key={x.rotulo}>
            <dt>{x.rotulo}</dt>
            <dd>{x.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="pesquisas__sobre-colunas">
        <CartaoDeSecao
          titulo="As perguntas"
          descricao="Já vêm prontas. Ao criar, dá para editar, incluir ou tirar perguntas."
          contador={plural(total, "pergunta", "perguntas")}
        >
          {[...grupos.entries()].map(([g, ps]) => (
            <div key={g} className="pesquisas__grupo-perguntas">
              <p className="pesquisas__grupo-titulo">
                <span>{g}</span>
                <span className="pesquisas__suave">
                  {ps.every((p) => p.obrigatoria)
                    ? "Obrigatórias"
                    : "Opcional em parte"}
                </span>
              </p>
              <ol className="pesquisas__lista-numerada">
                {ps.map((p) => {
                  n += 1;
                  return (
                    <li key={p.id}>
                      <span
                        className="pesquisas__numero-pergunta"
                        aria-hidden="true"
                      >
                        {String(n).padStart(2, "0")}
                      </span>
                      <span>{p.texto}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {m.comentarioFinal ? (
            <div className="pesquisas__grupo-perguntas">
              <p className="pesquisas__grupo-titulo">
                <span>Comentário livre</span>
                <span className="pesquisas__suave">Opcional</span>
              </p>
              <ol className="pesquisas__lista-numerada" start={n + 1}>
                <li>
                  <span
                    className="pesquisas__numero-pergunta"
                    aria-hidden="true"
                  >
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <span>{m.comentarioFinal}</span>
                </li>
              </ol>
            </div>
          ) : null}
        </CartaoDeSecao>

        <div className="pesquisas__sobre-lado">
          <CartaoDeSecao
            titulo="Como a pessoa responde"
            acao={
              <span className="pesquisas__suave">
                <IconeTempo tamanho={14} />
                {` cerca de ${plural(minutosEstimados(total), "minuto", "minutos")}`}
              </span>
            }
          >
            {exemplo ? (
              <div className="pesquisas__mock-resposta" aria-hidden="true">
                <p className="pesquisas__suave">{`Pergunta 1 de ${total}`}</p>
                <span className="pesquisas__progresso-fino">
                  <span
                    style={{ width: `${(1 / Math.max(1, total)) * 100}%` }}
                  />
                </span>
                <strong>{exemplo.texto}</strong>
                {exemplo.tipo === "escala" ? (
                  <span className="pesquisas__previa-escala">
                    {Array.from(
                      {
                        length:
                          (exemplo.config.maximo ?? 5) -
                          (exemplo.config.minimo ?? 1) +
                          1,
                      },
                      (_, i) => (exemplo.config.minimo ?? 1) + i,
                    ).map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </span>
                ) : null}
                <span className="pesquisas__mock-botao">Próxima →</span>
              </div>
            ) : (
              <p className="pesquisas__suave">
                Uma pergunta por tela, com barra de progresso.
              </p>
            )}
          </CartaoDeSecao>
          <CartaoDeSecao
            titulo="O que o RH vê"
            acao={
              <span className="pesquisas__suave">exemplo, por pergunta</span>
            }
          >
            <div className="pesquisas__mock-resultado">
              <Rosca
                fracao={0.84}
                centro="8,4"
                sufixo="/ 10"
                cor="var(--turno-verde)"
                rotulo="Exemplo: média 8,4 de 10"
              />
              <BarrasPorNota
                valores={EXEMPLO}
                cor={(v) => corDaNota(v, { minimo: 1, maximo: 10 })}
                rotulo="Exemplo de distribuição das notas"
              />
            </div>
            <ul className="pesquisas__legenda">
              <li>
                <span
                  className="pesquisas__ponto"
                  style={{ background: "var(--status-danger-ink)" }}
                />
                1 a 4 · desfavorável
              </li>
              <li>
                <span
                  className="pesquisas__ponto"
                  style={{ background: "var(--turno-mostarda)" }}
                />
                5 a 7 · neutro
              </li>
              <li>
                <span
                  className="pesquisas__ponto"
                  style={{ background: "var(--turno-verde)" }}
                />
                8 a 10 · favorável
              </li>
            </ul>
          </CartaoDeSecao>
        </div>
      </div>

      <GavetaDoModelo
        modelo={gaveta ? m : null}
        onFechar={() => setGaveta(false)}
        onUsar={onUsar}
      />
    </div>
  );
}
