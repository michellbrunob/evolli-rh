/**
 * T216 — as perguntas da Pesquisa de Clima no assistente: agrupadas por
 * dimensão ("Credibilidade · 12 afirmações") e, por último, as perguntas
 * abertas (selo "Texto livre"). Cada linha pode ser editada (até 300
 * caracteres) ou removida; "Adicionar pergunta" pede o texto e a dimensão
 * (ou "Texto livre"). Com respostas, nada muda. Sempre fica ao menos uma
 * afirmação (o índice precisa dela).
 */
import { useId, useState } from "react";
import type { Pergunta, Secao } from "../../../../api/pesquisasClient";
import { Button } from "../../../../components";
import { plural } from "../../../../format/plural";
import { IconButton } from "../../../../ui";
import {
  IconeEditar,
  IconeFechar,
  IconeMais,
  IconeRemover,
  IconeVisto,
} from "../../../../ui/icones";
import { useAvisar } from "../../avisos";
import { CartaoDeSecao } from "../../componentes";
import { excluirPergunta } from "../../estadoDaPesquisa";
import { LIMITES, novoId } from "../../textosDasPesquisas";
import { textoParaOPainel } from "../empresa";
import {
  DIMENSOES_CLIMA,
  PREFIXO_DAS_ABERTAS,
  TITULO_DAS_ABERTAS,
  chaveNova,
  dimensaoDaChave,
} from "./catalogo";
import "./Clima.css";

const TEXTO_LIVRE = "texto_livre";

const ehAberta = (p: Pergunta) =>
  p.tipo === "paragrafo" && Boolean(p.chave?.startsWith(PREFIXO_DAS_ABERTAS));

/** "60 afirmações · 2 abertas" (resumo da etapa Enviar). */
export function resumoDasPerguntasDoClima(
  perguntas: readonly Pergunta[],
): string {
  const afirmacoes = perguntas.filter((p) => p.tipo === "concordancia").length;
  const abertas = perguntas.filter(ehAberta).length;
  return `${plural(afirmacoes, "afirmação", "afirmações")} · ${plural(abertas, "aberta", "abertas")}`;
}

/** Acrescenta a pergunta na seção da dimensão (ou na das abertas). */
export function acrescentarNoClima(
  secoes: readonly Secao[],
  dimensao: string | null,
  texto: string,
): Secao[] {
  const id = novoId();
  const nova: Pergunta = {
    id,
    chave: chaveNova(dimensao, id),
    tipo: dimensao ? "concordancia" : "paragrafo",
    texto,
    descricao: null,
    obrigatoria: true,
    config: {},
    condicao: null,
    rotulo: null,
  };
  const rotulo = dimensao
    ? DIMENSOES_CLIMA.find((d) => d.chave === dimensao)!.rotulo
    : TITULO_DAS_ABERTAS;
  const daSecao = (s: Secao) =>
    dimensao
      ? s.perguntas.some((p) => dimensaoDaChave(p.chave) === dimensao) ||
        s.titulo === rotulo
      : s.perguntas.some(ehAberta) || s.titulo === TITULO_DAS_ABERTAS;
  const i = secoes.findIndex(daSecao);
  if (i >= 0)
    return secoes.map((s, j) =>
      j === i ? { ...s, perguntas: [...s.perguntas, nova] } : s,
    );
  const secao: Secao = {
    id: novoId(),
    titulo: rotulo,
    descricao: null,
    perguntas: [nova],
  };
  // A dimensão nova entra antes das abertas; as abertas, no fim.
  const abertas = secoes.findIndex(
    (s) => s.perguntas.some(ehAberta) || s.titulo === TITULO_DAS_ABERTAS,
  );
  if (!dimensao || abertas < 0) return [...secoes, secao];
  return [...secoes.slice(0, abertas), secao, ...secoes.slice(abertas)];
}

export function PerguntasDoClima({
  secoes,
  travado,
  erro,
  onMudar,
}: {
  readonly secoes: readonly Secao[];
  readonly travado: boolean;
  readonly erro?: string | undefined;
  readonly onMudar: (secoes: Secao[]) => void;
}) {
  const ids = useId();
  const avisar = useAvisar();
  const [adicionando, setAdicionando] = useState(false);
  const [texto, setTexto] = useState("");
  const [destino, setDestino] = useState<string>(DIMENSOES_CLIMA[0].chave);
  const [editando, setEditando] = useState<{
    id: string;
    texto: string;
  } | null>(null);
  const todas = secoes.flatMap((s) => s.perguntas);
  const numero = new Map(todas.map((p, i) => [p.id, i + 1]));
  const afirmacoes = todas.filter((p) => p.tipo === "concordancia");
  const grupos = [
    ...DIMENSOES_CLIMA.map((d) => ({
      chave: d.chave as string,
      titulo: d.rotulo as string,
      cor: d.cor as string,
      perguntas: todas.filter((p) => dimensaoDaChave(p.chave) === d.chave),
      contagem: (n: number) => plural(n, "afirmação", "afirmações"),
    })),
    {
      chave: TEXTO_LIVRE,
      titulo: TITULO_DAS_ABERTAS,
      cor: "--modelo-cinza",
      perguntas: todas.filter(ehAberta),
      contagem: (n: number) => plural(n, "pergunta", "perguntas"),
    },
  ];
  const noLimite = todas.length >= LIMITES.perguntas;

  function salvarEdicao() {
    if (!editando || !editando.texto.trim()) return;
    onMudar(
      secoes.map((s) => ({
        ...s,
        perguntas: s.perguntas.map((p) =>
          p.id === editando.id ? { ...p, texto: editando.texto.trim() } : p,
        ),
      })),
    );
    setEditando(null);
  }

  function adicionar() {
    const t = texto.trim();
    if (!t) return;
    onMudar(
      acrescentarNoClima(secoes, destino === TEXTO_LIVRE ? null : destino, t),
    );
    setTexto("");
    setAdicionando(false);
  }

  return (
    <CartaoDeSecao
      titulo="Perguntas"
      contador={String(todas.length)}
      descricao="Edite, remova ou acrescente perguntas. As afirmações entram no índice da dimensão escolhida."
      acao={
        travado ? null : (
          <Button
            variant="secondary"
            disabled={noLimite}
            aria-expanded={adicionando}
            onClick={() => setAdicionando(true)}
          >
            <IconeMais tamanho={16} />
            Adicionar pergunta
          </Button>
        )
      }
    >
      {travado ? (
        <p className="pesquisas__nota">
          Esta pesquisa já tem respostas: as perguntas não mudam mais.
        </p>
      ) : null}
      <div className="pesquisas__faixa-escala">
        <div>
          <strong>Escala de concordância de 1 a 5</strong>
          <span className="pesquisas__suave">
            1 = Discordo totalmente · 5 = Concordo totalmente · 4 e 5 contam
            como favoráveis
          </span>
        </div>
      </div>
      {erro ? (
        <p className="pesquisas__erro" role="alert">
          {erro}
        </p>
      ) : null}
      {adicionando ? (
        <div className="pesquisas__caixa-inline pesquisas__caixa-inline--nova clima-perguntas__nova">
          <textarea
            className="pesquisas__campo"
            aria-label="Nova pergunta"
            placeholder="Escreva a pergunta como quem responde vai ler"
            maxLength={LIMITES.textoPergunta}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="clima-perguntas__nova-linha">
            <label htmlFor={`${ids}-destino`} className="pesquisas__rotulo">
              Dimensão
            </label>
            <select
              id={`${ids}-destino`}
              className="pesquisas__campo"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            >
              {DIMENSOES_CLIMA.map((d) => (
                <option key={d.chave} value={d.chave}>
                  {d.rotulo}
                </option>
              ))}
              <option value={TEXTO_LIVRE}>Texto livre</option>
            </select>
          </div>
          <div className="pesquisas__caixa-inline-rodape">
            <span className="pesquisas__suave">{`${texto.length}/${LIMITES.textoPergunta}`}</span>
            <Button
              variant="subtle"
              onClick={() => {
                setAdicionando(false);
                setTexto("");
              }}
            >
              Cancelar
            </Button>
            <Button disabled={!texto.trim()} onClick={adicionar}>
              Adicionar
            </Button>
          </div>
        </div>
      ) : null}
      <ul className="fixas__grupos">
        {grupos.map((g) => (
          <li key={g.chave} className="fixas__grupo">
            <section aria-label={g.titulo}>
              <h3 className="fixas__gatilho">
                <span
                  className="galeria__bolinha"
                  style={{ background: `var(${g.cor})` }}
                  aria-hidden="true"
                />
                <strong>{g.titulo}</strong>
                <span className="pesquisas__suave">
                  {` · ${g.contagem(g.perguntas.length)}`}
                </span>
              </h3>
              <ol className="fixas__perguntas">
                {g.perguntas.map((p) => {
                  const n = numero.get(p.id) ?? 0;
                  const ultimaAfirmacao =
                    p.tipo === "concordancia" && afirmacoes.length <= 1;
                  return (
                    <li key={p.id}>
                      <span
                        className="pesquisas__numero-pergunta"
                        aria-hidden="true"
                      >
                        {String(n).padStart(2, "0")}
                      </span>
                      {editando?.id === p.id ? (
                        <span className="pesquisas__caixa-inline pesquisas__caixa-inline--linha">
                          <input
                            className="pesquisas__campo"
                            aria-label={`Texto da pergunta ${n}`}
                            maxLength={LIMITES.textoPergunta}
                            value={editando.texto}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                salvarEdicao();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditando(null);
                              }
                            }}
                            onChange={(e) =>
                              setEditando({ id: p.id, texto: e.target.value })
                            }
                          />
                          <span className="pesquisas__suave">{`${editando.texto.length}/${LIMITES.textoPergunta}`}</span>
                          <IconButton
                            label="Salvar a pergunta"
                            icon={<IconeVisto tamanho={14} />}
                            variant="subtle"
                            disabled={!editando.texto.trim()}
                            onClick={salvarEdicao}
                          />
                          <IconButton
                            label="Cancelar a edição"
                            icon={<IconeFechar tamanho={14} />}
                            variant="subtle"
                            onClick={() => setEditando(null)}
                          />
                        </span>
                      ) : (
                        <span className="fixas__texto">
                          {textoParaOPainel(p.texto) || "Pergunta sem texto"}
                        </span>
                      )}
                      <span className="pesquisas__selo">
                        {p.tipo === "concordancia" ? "1–5" : "Texto livre"}
                      </span>
                      {travado || editando?.id === p.id ? null : (
                        <span className="pesquisas__linha-acoes">
                          <IconButton
                            label={`Editar pergunta ${n}`}
                            icon={<IconeEditar tamanho={14} />}
                            variant="subtle"
                            onClick={() =>
                              setEditando({ id: p.id, texto: p.texto })
                            }
                          />
                          <IconButton
                            label={`Remover pergunta ${n}`}
                            icon={<IconeRemover tamanho={14} />}
                            variant="subtle"
                            disabled={ultimaAfirmacao}
                            onClick={() => {
                              const antes = [...secoes];
                              onMudar(excluirPergunta(secoes, p.id));
                              avisar("Pergunta removida.", {
                                acao: {
                                  rotulo: "Desfazer",
                                  onClick: () => onMudar(antes),
                                },
                              });
                            }}
                          />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </li>
        ))}
      </ul>
    </CartaoDeSecao>
  );
}
