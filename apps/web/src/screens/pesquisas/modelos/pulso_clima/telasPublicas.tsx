/**
 * T216 — Pulso e Clima na página pública: a ordem das telas por dimensão.
 *
 * - Cada dimensão (e o LNPS e o eNPS) abre com uma tela de apresentação: a
 *   trilha com a dimensão atual e a próxima, o selo, o título e o que ela
 *   avalia.
 * - Cada afirmação leva o selo da dimensão e "Pergunta N de T", contando só
 *   as perguntas (os comentários e as aberturas ficam fora da conta).
 * - O comentário da dimensão vem numa tela própria ("Comentário
 *   (opcional)"); o do LNPS e o do eNPS ficam na MESMA tela da nota, com o
 *   contador de caracteres.
 */
import { useId } from "react";
import type { Secao } from "../../../../api/pesquisaPublicaClient";
import type {
  PerguntaNaOrdem,
  ValorRascunho,
} from "../../../publico/regrasDaPesquisa";
import { DIMENSOES_PULSO_CLIMA, corDaDimensao } from "./catalogo";
import "./PulsoClima.css";

/** O limite do comentário que acompanha a nota (LNPS e eNPS). */
export const LIMITE_DO_COMENTARIO_DA_NOTA = 2000;

export interface TelaDoPulsoClima {
  readonly id: string;
  readonly secao: Secao;
  readonly perguntas: readonly PerguntaNaOrdem[];
  /** Tela de apresentação da dimensão (sem perguntas). */
  readonly abertura?: {
    readonly titulo: string;
    readonly texto: string | null;
    readonly proxima: string | null;
  };
  /** O selo da dimensão (texto e cor). */
  readonly selo: { readonly texto: string; readonly cor: string };
  /** "Pergunta N de T" (só nas perguntas que contam); `null` nas outras. */
  readonly contagem: {
    readonly posicao: number;
    readonly total: number;
  } | null;
  /** A barra de progresso (a próxima pergunta, nas telas que não contam). */
  readonly progresso: { readonly posicao: number; readonly total: number };
  /** O sobretítulo da tela ("Comentário (opcional)"). */
  readonly sobretitulo?: string;
  /** O comentário que fica na mesma tela da nota (LNPS e eNPS). */
  readonly comentarioJunto?: PerguntaNaOrdem;
}

const ehComentario = (o: PerguntaNaOrdem) =>
  (o.pergunta.chave ?? "").startsWith("__comentario_");

/** A cor da dimensão pela seção (o título ou a primeira pergunta). */
function corDaSecao(secao: Secao): string {
  const i = DIMENSOES_PULSO_CLIMA.findIndex((d) => d.rotulo === secao.titulo);
  if (i >= 0) return `var(${corDaDimensao(i)})`;
  const chaves = secao.perguntas.map((p) => p.chave ?? "");
  if (chaves.includes("pc_lnps_01")) return "var(--modelo-celeste)";
  if (chaves.includes("pc_enps_01")) return "var(--modelo-coral)";
  return "var(--color-action)";
}

export function telasDoPulsoClima(
  ordem: readonly PerguntaNaOrdem[],
): TelaDoPulsoClima[] {
  // As seções na ordem, com as perguntas visíveis de cada uma.
  const grupos: { secao: Secao; itens: PerguntaNaOrdem[] }[] = [];
  for (const o of ordem) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.secao.id === o.secao.id) ultimo.itens.push(o);
    else grupos.push({ secao: o.secao, itens: [o] });
  }
  const total = ordem.filter((o) => !ehComentario(o)).length;
  const telas: TelaDoPulsoClima[] = [];
  let contadas = 0;
  grupos.forEach(({ secao, itens }, g) => {
    const titulo = secao.titulo ?? `Parte ${g + 1}`;
    const selo = { texto: titulo, cor: corDaSecao(secao) };
    const proximo = () => ({
      posicao: Math.min(Math.max(contadas + 1, 1), Math.max(total, 1)),
      total,
    });
    telas.push({
      id: `abertura-${secao.id}`,
      secao,
      perguntas: [],
      abertura: {
        titulo,
        texto: secao.descricao,
        proxima: grupos[g + 1]?.secao.titulo ?? null,
      },
      selo,
      contagem: null,
      progresso: proximo(),
    });
    for (const o of itens) {
      const anterior = telas[telas.length - 1]!;
      if (ehComentario(o)) {
        const daNota =
          anterior.secao.id === secao.id &&
          !anterior.abertura &&
          !anterior.comentarioJunto &&
          anterior.perguntas[0]?.pergunta.tipo === "nota_0_10";
        if (daNota) {
          telas[telas.length - 1] = { ...anterior, comentarioJunto: o };
        } else {
          telas.push({
            id: o.pergunta.id,
            secao,
            perguntas: [o],
            selo,
            contagem: null,
            progresso: proximo(),
            sobretitulo: "Comentário (opcional)",
          });
        }
        continue;
      }
      contadas += 1;
      telas.push({
        id: o.pergunta.id,
        secao,
        perguntas: [o],
        selo,
        contagem: { posicao: contadas, total },
        progresso: { posicao: contadas, total },
      });
    }
  });
  return telas;
}

/** A trilha e a apresentação da dimensão. */
export function AberturaDaDimensao({
  tela,
  titulo,
}: {
  readonly tela: TelaDoPulsoClima;
  /** O título da tela (recebe o foco). */
  readonly titulo: (texto: string) => JSX.Element;
}) {
  const a = tela.abertura!;
  return (
    <div className="pc-abertura">
      <ol className="pc-trilha" aria-label="Dimensões">
        <li aria-current="step">{a.titulo}</li>
        {a.proxima ? <li>{`Próxima: ${a.proxima}`}</li> : null}
      </ol>
      <SeloDaDimensao selo={tela.selo} />
      {titulo(a.titulo)}
      {a.texto ? <p className="pesquisa-publica__texto">{a.texto}</p> : null}
    </div>
  );
}

export function SeloDaDimensao({
  selo,
}: {
  readonly selo: TelaDoPulsoClima["selo"];
}) {
  return (
    <span className="pc-selo" style={{ ["--selo-cor" as string]: selo.cor }}>
      {selo.texto}
    </span>
  );
}

/** O comentário opcional na mesma tela da nota, com o contador. */
export function ComentarioDaNota({
  pergunta,
  valor,
  aoMudar,
}: {
  readonly pergunta: PerguntaNaOrdem["pergunta"];
  readonly valor: ValorRascunho | undefined;
  readonly aoMudar: (texto: string) => void;
}) {
  const base = useId();
  const texto = typeof valor === "string" ? valor : "";
  return (
    <div className="pc-comentario-da-nota">
      <label
        htmlFor={`${base}-campo`}
        className="pesquisa-pergunta__rotulo-menor"
      >
        {pergunta.texto}
        <span className="pesquisa-pergunta__opcional"> (opcional)</span>
      </label>
      <textarea
        id={`${base}-campo`}
        className="pesquisa-campo"
        rows={4}
        maxLength={LIMITE_DO_COMENTARIO_DA_NOTA}
        value={texto}
        aria-describedby={`${base}-contador`}
        onChange={(e) => aoMudar(e.target.value)}
      />
      <p
        id={`${base}-contador`}
        className="pc-comentario-da-nota__contador"
        aria-live="polite"
      >
        {`${texto.length}/${LIMITE_DO_COMENTARIO_DA_NOTA}`}
      </p>
    </div>
  );
}
