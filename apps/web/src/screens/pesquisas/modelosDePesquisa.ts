/**
 * T216 — a galeria de modelos: pontos de partida com perguntas escritas pelo
 * Evolli. Cada modelo é descrito de forma declarativa e vira seções e
 * perguntas com ids novos a cada uso (`secoesDoModelo`). A quantidade de
 * perguntas do card, da gaveta e do assistente sai da mesma descrição
 * (`totalDePerguntas`), sem número escrito à mão.
 *
 * O comentário final (opcional, sempre por último e fora das médias) fica
 * separado das demais perguntas: a gaveta e o assistente o mostram à parte.
 */
import type {
  ModeloPesquisa,
  Pergunta,
  Secao,
} from "../../api/pesquisasClient";
import { novoId } from "./textosDasPesquisas";
import type {
  CategoriaDoModelo,
  CategoriaPersonalizada,
  ModeloDaGaleria,
} from "./modelos/tipos";
import { MODELOS_DA_GALERIA, SUBMODELOS_PERSONALIZADA } from "./modelos/indice";

export type * from "./modelos/tipos";

export const CATEGORIAS_DE_MODELO: Readonly<
  Record<
    CategoriaDoModelo,
    { readonly nome: string; readonly titulo: string; readonly texto: string }
  >
> = {
  clima: {
    nome: "Clima e engajamento",
    titulo: "Clima e engajamento",
    texto: "Para acompanhar como o time está, de forma recorrente",
  },
  saude: {
    nome: "Saúde e NR-1",
    titulo: "Saúde e NR-1",
    texto: "Riscos psicossociais e bem-estar",
  },
  desempenho: {
    nome: "Desempenho",
    titulo: "Desempenho",
    texto: "Avaliações feitas pelo gestor",
  },
  outros: {
    nome: "Outros",
    titulo: "Comportamento e personalizada",
    texto: "",
  },
};

export const CATEGORIAS_PERSONALIZADAS: Readonly<
  Record<CategoriaPersonalizada, string>
> = {
  integracao: "Integração",
  desempenho: "Desempenho",
  satisfacao: "Satisfação",
  saida: "Desligamento",
};

/** Os 12 modelos da galeria, na ordem dos cards. */
export const MODELOS_DE_PESQUISA: readonly ModeloDaGaleria[] =
  MODELOS_DA_GALERIA;

/** Os modelos prontos da página da Personalizada. */
export const ROTEIROS_PERSONALIZADOS: readonly ModeloDaGaleria[] =
  SUBMODELOS_PERSONALIZADA;

export function modeloDaGaleria(id: string): ModeloDaGaleria {
  return (
    [...MODELOS_DE_PESQUISA, ...ROTEIROS_PERSONALIZADOS].find(
      (m) => m.id === id,
    ) ?? MODELOS_DE_PESQUISA[MODELOS_DE_PESQUISA.length - 1]!
  );
}

/** Perguntas do modelo sem o comentário final. */
export function perguntasPrincipais(m: ModeloDaGaleria): number {
  return m.secoes.reduce((t, s) => t + s.perguntas.length, 0);
}

/** O comentário opcional de uma dimensão (fora da contagem do modelo). */
export function ehComentarioDeDimensao(p: {
  readonly chave?: string | null;
}): boolean {
  return Boolean(p.chave?.startsWith("__comentario_"));
}

/**
 * Quantas perguntas o modelo traz, com o comentário final e sem os
 * comentários por dimensão (card = gaveta = assistente). Sem as perguntas
 * no catálogo, a soma dos grupos.
 */
export function totalDePerguntas(m: ModeloDaGaleria): number {
  if (m.secoes.length === 0 && m.grupos) {
    return m.grupos.reduce((t, g) => t + g.quantidade, 0);
  }
  const semComentarios = m.secoes.reduce(
    (t, s) => t + s.perguntas.filter((p) => !ehComentarioDeDimensao(p)).length,
    0,
  );
  return semComentarios + (m.comentarioFinal ? 1 : 0);
}

/** O nome sugerido da pesquisa do modelo. */
export function nomeDoModelo(m: ModeloDaGaleria, hoje: string): string | null {
  return m.nomeDaPesquisa ? m.nomeDaPesquisa(hoje) : null;
}

/** A pergunta do comentário final (opcional, sem condição). */
export function perguntaDeComentario(
  texto: string,
  tipo: "paragrafo" | "texto_curto" = "paragrafo",
): Pergunta {
  return {
    id: novoId(),
    tipo,
    texto,
    descricao: null,
    obrigatoria: false,
    config: {},
    condicao: null,
    rotulo: "Comentário",
  };
}

/**
 * As seções do modelo com ids novos (perguntas, opções e condições). O
 * comentário final vai por último, na última seção.
 */
export function secoesDoModelo(m: ModeloDaGaleria): Secao[] {
  const idDaChave = new Map<string, Pergunta>();
  const secoes: Secao[] = m.secoes.map((s) => ({
    id: novoId(),
    titulo: s.titulo,
    descricao: s.descricao ?? null,
    perguntas: s.perguntas.map((p) => {
      const config: Pergunta["config"] = { ...(p.config ?? {}) };
      if (p.opcoes) {
        config.opcoes = p.opcoes.map((o) =>
          typeof o === "string"
            ? { id: novoId(), texto: o }
            : { id: novoId(), texto: o.texto, fator: o.fator },
        );
        if (p.tipo !== "escolha_forcada") config.outro = config.outro ?? false;
      }
      let condicao: Pergunta["condicao"] = null;
      if (p.condicao) {
        const alvo = idDaChave.get(p.condicao.ref);
        const opcao = p.condicao.opcao;
        if (alvo) {
          const opcaoId =
            typeof opcao === "number"
              ? (alvo.config.opcoes?.[opcao]?.id ?? null)
              : opcao;
          if (opcaoId) condicao = { perguntaId: alvo.id, opcaoId };
        }
      }
      const pergunta: Pergunta = {
        id: novoId(),
        ...(p.chave ? { chave: p.chave } : {}),
        tipo: p.tipo,
        texto: p.texto,
        descricao: p.descricao ?? null,
        obrigatoria: p.obrigatoria ?? true,
        config,
        condicao,
        rotulo: p.rotulo ?? null,
      };
      if (p.ref) idDaChave.set(p.ref, pergunta);
      return pergunta;
    }),
  }));
  if (m.comentarioFinal) {
    const ultima = secoes[secoes.length - 1]!;
    ultima.perguntas.push(
      perguntaDeComentario(m.comentarioFinal, m.tipoDoComentario),
    );
  }
  return secoes;
}

/** O modelo pronto (assistente de 3 etapas) ou a personalizada (5 etapas). */
export function ehModeloPronto(modelo: ModeloPesquisa): boolean {
  return modelo !== "personalizada";
}
